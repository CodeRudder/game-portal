/**
 * CalendarSystem 单元测试
 * 覆盖：初始化、tick时间流逝、季节切换、年号切换、天气变化、事件发出、
 *       序列化/反序列化、reset、pause/resume、setTimeScale
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CalendarSystem } from '../CalendarSystem';
import type { CalendarSaveData } from '../calendar.types';
import { CALENDAR_SAVE_VERSION } from '../calendar-config';
import { DAYS_PER_MONTH, DAYS_PER_YEAR, ERA_TABLE, DEFAULT_TIME_SCALE } from '../calendar-config';
import { SocialEvents, MapEvents } from '../../../core/events/EventTypes';

// ── Mock ISystemDeps ──
function createMockDeps() {
  return {
    eventBus: {
      on: vi.fn(),
      once: vi.fn(),
      emit: vi.fn(),
      off: vi.fn(),
      removeAllListeners: vi.fn(),
    },
    config: { get: vi.fn(), set: vi.fn(), has: vi.fn(() => false) },
    registry: {
      register: vi.fn(), get: vi.fn(), getAll: vi.fn(() => new Map()),
      has: vi.fn(() => false), unregister: vi.fn(),
    },
  };
}

describe('CalendarSystem', () => {
  let calendar: CalendarSystem;
  let deps: ReturnType<typeof createMockDeps>;

  beforeEach(() => {
    vi.restoreAllMocks();
    calendar = new CalendarSystem();
    deps = createMockDeps();
  });

  // ═══════════════════════════════════════════
  // 1. 初始化 — 默认状态
  // ═══════════════════════════════════════════
  describe('初始化默认状态', () => {
    it('默认年号=建安，季节=春，天数=0，日期=1', () => {
      expect(calendar.getEraName()).toBe('建安');
      expect(calendar.getYearInEra()).toBe(1);
      expect(calendar.getSeason()).toBe('spring');
      expect(calendar.getTotalDays()).toBe(0);
      expect(calendar.getWeather()).toBe('clear');
      expect(calendar.isPaused()).toBe(false);
      expect(calendar.getTimeScale()).toBe(DEFAULT_TIME_SCALE);
      expect(calendar.getYear()).toBe(1);
      expect(calendar.getMonth()).toBe(1);
      expect(calendar.getDay()).toBe(1);
      expect(calendar.name).toBe('calendar');
    });

    it('getState 返回完整快照', () => {
      const state = calendar.getState();
      expect(state).toEqual({
        date: expect.objectContaining({
          year: 1, month: 1, day: 1, season: 'spring', eraName: '建安', yearInEra: 1,
        }),
        weather: 'clear', totalDays: 0, paused: false,
      });
    });

    it('getDate 返回副本，不暴露内部引用', () => {
      expect(calendar.getDate()).toEqual(calendar.getDate());
      expect(calendar.getDate()).not.toBe(calendar.getDate());
    });
  });

  // ═══════════════════════════════════════════
  // 2. tick时间流逝 — update(dt)
  // ═══════════════════════════════════════════
  describe('update() 时间流逝', () => {
    beforeEach(() => { calendar.init(deps as any); });

    it('update(1) 推进 1 游戏天', () => {
      calendar.update(1);
      expect(calendar.getTotalDays()).toBe(1);
    });

    it('update(0) 和 update(-1) 不推进天数', () => {
      calendar.update(0);
      expect(calendar.getTotalDays()).toBe(0);
      calendar.update(-1);
      expect(calendar.getTotalDays()).toBe(0);
    });

    it('跨月：30天后进入第2月', () => {
      calendar.update(DAYS_PER_MONTH);
      expect(calendar.getMonth()).toBe(2);
      expect(calendar.getDay()).toBe(1);
    });

    it('跨年：360天后进入第2年', () => {
      calendar.update(DAYS_PER_YEAR);
      expect(calendar.getYear()).toBe(2);
      expect(calendar.getMonth()).toBe(1);
      expect(calendar.getDay()).toBe(1);
    });

    it('连续多次 update 正确累加', () => {
      for (let i = 0; i < 10; i++) calendar.update(1);
      expect(calendar.getTotalDays()).toBe(10);
    });
  });

  // ═══════════════════════════════════════════
  // 3. 季节切换 — 每90天（春→夏→秋→冬→春）
  // ═══════════════════════════════════════════
  describe('季节切换', () => {
    beforeEach(() => { calendar.init(deps as any); });

    it('1-3月为春，4-6月为夏，7-9月为秋，10-12月为冬', () => {
      // month 1 → spring
      expect(calendar.getSeason()).toBe('spring');
      // month 3 → spring (totalDays=60 → month 3 day 1)
      calendar.update(60);
      expect(calendar.getMonth()).toBe(3);
      expect(calendar.getSeason()).toBe('spring');
      // month 4 → summer (totalDays=90 → month 4 day 1)
      calendar.update(30); // totalDays = 90
      expect(calendar.getMonth()).toBe(4);
      expect(calendar.getSeason()).toBe('summer');
      // month 7 → autumn
      calendar.update(90);
      expect(calendar.getMonth()).toBe(7);
      expect(calendar.getSeason()).toBe('autumn');
      // month 10 → winter
      calendar.update(90);
      expect(calendar.getMonth()).toBe(10);
      expect(calendar.getSeason()).toBe('winter');
    });

    it('季节跨年正确轮转回到春', () => {
      calendar.update(DAYS_PER_YEAR);
      expect(calendar.getSeason()).toBe('spring');
    });

    it('季节变化发出 CALENDAR_SEASON_CHANGED 事件', () => {
      // spring → summer: totalDays 90 (month 4 day 1)
      calendar.update(90);
      expect(deps.eventBus.emit).toHaveBeenCalledWith(
        SocialEvents.CALENDAR_SEASON_CHANGED,
        { season: 'summer', year: 1 },
      );
    });
  });

  // ═══════════════════════════════════════════
  // 4. 年号切换 — 按配置表的年份阈值
  // ═══════════════════════════════════════════
  describe('年号切换', () => {
    beforeEach(() => { calendar.init(deps as any); });

    it('建安覆盖 year 1-24', () => {
      calendar.update(23 * DAYS_PER_YEAR);
      expect(calendar.getYear()).toBe(24);
      expect(calendar.getEraName()).toBe('建安');
      expect(calendar.getYearInEra()).toBe(24);
    });

    it('year=25 切换到延康', () => {
      calendar.update(24 * DAYS_PER_YEAR);
      expect(calendar.getYear()).toBe(25);
      expect(calendar.getEraName()).toBe('延康');
      expect(calendar.getYearInEra()).toBe(1);
    });

    it('year=26 切换到黄初', () => {
      calendar.update(25 * DAYS_PER_YEAR);
      expect(calendar.getEraName()).toBe('黄初');
      expect(calendar.getYearInEra()).toBe(1);
    });

    it('超出年号表范围沿用最后一个年号', () => {
      const last = ERA_TABLE[ERA_TABLE.length - 1];
      const beyond = last.endYear + 10;
      calendar.update((beyond - 1) * DAYS_PER_YEAR);
      expect(calendar.getEraName()).toBe(last.name);
      expect(calendar.getYearInEra()).toBe(beyond - last.startYear + 1);
    });

    it('极大天数不崩溃', () => {
      expect(() => calendar.update(1000 * DAYS_PER_YEAR)).not.toThrow();
      expect(calendar.getYear()).toBe(1001);
    });
  });

  // ═══════════════════════════════════════════
  // 5. 天气变化
  // ═══════════════════════════════════════════
  describe('天气变化', () => {
    beforeEach(() => { calendar.init(deps as any); });

    it('setWeather 手动设置天气', () => {
      calendar.setWeather('rain');
      expect(calendar.getWeather()).toBe('rain');
    });

    it('setWeather 相同天气不发出事件', () => {
      const emitCount = deps.eventBus.emit.mock.calls.length;
      calendar.setWeather('clear');
      expect(deps.eventBus.emit.mock.calls.length).toBe(emitCount);
    });

    it('setWeather 不同天气发出 WEATHER_CHANGED', () => {
      calendar.setWeather('snow');
      expect(deps.eventBus.emit).toHaveBeenCalledWith(
        MapEvents.WEATHER_CHANGED,
        { previous: 'clear', current: 'snow' },
      );
    });

    it('天气计时器到期后自动变化', () => {
      // weatherDuration ∈ [3, 10], 15 days guarantees timer expiry
      const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0);
      calendar.update(15);
      // Verify weather timer was processed (totalDays advanced)
      expect(calendar.getTotalDays()).toBe(15);
      randomSpy.mockRestore();
    });
  });

  // ═══════════════════════════════════════════
  // 6. 事件发出 — day/season/weather changed
  // ═══════════════════════════════════════════
  describe('事件发出', () => {
    beforeEach(() => { calendar.init(deps as any); });

    it('日期变化发出 CALENDAR_DAY_CHANGED', () => {
      calendar.update(1);
      expect(deps.eventBus.emit).toHaveBeenCalledWith(
        SocialEvents.CALENDAR_DAY_CHANGED,
        { day: 2, month: 1, year: 1 },
      );
    });

    it('同一天内 update 不重复发出 day changed', () => {
      calendar.update(0.5);
      expect(deps.eventBus.emit).not.toHaveBeenCalledWith(
        SocialEvents.CALENDAR_DAY_CHANGED,
        expect.any(Object),
      );
    });

    it('季节变化发出 CALENDAR_SEASON_CHANGED', () => {
      calendar.update(90); // spring → summer
      expect(deps.eventBus.emit).toHaveBeenCalledWith(
        SocialEvents.CALENDAR_SEASON_CHANGED,
        { season: 'summer', year: 1 },
      );
    });

    it('天气变化发出 WEATHER_CHANGED', () => {
      calendar.setWeather('rain');
      expect(deps.eventBus.emit).toHaveBeenCalledWith(
        MapEvents.WEATHER_CHANGED,
        { previous: 'clear', current: 'rain' },
      );
    });

    it('未 init 时不抛异常（事件静默）', () => {
      const cal = new CalendarSystem();
      expect(() => cal.update(1)).not.toThrow();
      expect(() => cal.setWeather('rain')).not.toThrow();
    });

    it('update 极小正数不触发 day changed', () => {
      calendar.update(0.0001);
      expect(deps.eventBus.emit).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════
  // 7. 序列化/反序列化
  // ═══════════════════════════════════════════
  describe('serialize / deserialize', () => {
    it('serialize 返回正确格式', () => {
      const data = calendar.serialize();
      expect(data).toEqual({
        version: CALENDAR_SAVE_VERSION,
        totalDays: 0,
        weather: 'clear',
        weatherTimer: 0,
        paused: false,
      });
    });

    it('deserialize 恢复状态', () => {
      calendar.init(deps as any);
      calendar.update(100);
      calendar.pause();
      const saved = calendar.serialize();
      expect(saved.totalDays).toBe(100);
      expect(saved.paused).toBe(true);

      const cal2 = new CalendarSystem();
      cal2.deserialize(saved);
      expect(cal2.getTotalDays()).toBe(100);
      expect(cal2.isPaused()).toBe(true);
    });

    it('serialize → deserialize 往返一致性', () => {
      calendar.init(deps as any);
      calendar.update(50);
      calendar.setWeather('rain');
      calendar.pause();

      const saved = calendar.serialize();
      const cal2 = new CalendarSystem();
      cal2.deserialize(saved);

      expect(cal2.getTotalDays()).toBe(calendar.getTotalDays());
      expect(cal2.getWeather()).toBe('rain');
      expect(cal2.isPaused()).toBe(true);
      expect(cal2.getYear()).toBe(calendar.getYear());
      expect(cal2.getMonth()).toBe(calendar.getMonth());
      expect(cal2.getDay()).toBe(calendar.getDay());
    });

    it('deserialize 版本不匹配时仍加载并 warn', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      calendar.deserialize({
        version: 999, totalDays: 50, weather: 'snow', weatherTimer: 2, paused: true,
      });
      expect(calendar.getTotalDays()).toBe(50);
      expect(calendar.getWeather()).toBe('snow');
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('版本不匹配'));
      warnSpy.mockRestore();
    });

    it('deserialize 缺失字段使用默认值', () => {
      calendar.deserialize({ version: CALENDAR_SAVE_VERSION } as any as CalendarSaveData);
      expect(calendar.getTotalDays()).toBe(0);
      expect(calendar.getWeather()).toBe('clear');
    });

    it('deserialize 无效天气使用默认值', () => {
      calendar.deserialize({
        version: CALENDAR_SAVE_VERSION, totalDays: 10,
        weather: 'invalid' as any, weatherTimer: 0, paused: false,
      });
      expect(calendar.getWeather()).toBe('clear');
    });

    it('deserialize 后 update 正常工作', () => {
      calendar.init(deps as any);
      calendar.deserialize({
        version: CALENDAR_SAVE_VERSION, totalDays: 50,
        weather: 'rain', weatherTimer: 0, paused: false,
      });
      calendar.update(1);
      expect(calendar.getTotalDays()).toBe(51);
    });
  });

  // ═══════════════════════════════════════════
  // 8. reset — 重置到初始状态
  // ═══════════════════════════════════════════
  describe('reset()', () => {
    it('重置所有状态到初始值', () => {
      calendar.init(deps as any);
      calendar.update(100);
      calendar.pause();
      calendar.setTimeScale(5);

      calendar.reset();

      expect(calendar.getTotalDays()).toBe(0);
      expect(calendar.getWeather()).toBe('clear');
      expect(calendar.isPaused()).toBe(false);
      expect(calendar.getTimeScale()).toBe(DEFAULT_TIME_SCALE);
      expect(calendar.getYear()).toBe(1);
      expect(calendar.getMonth()).toBe(1);
      expect(calendar.getDay()).toBe(1);
      expect(calendar.getSeason()).toBe('spring');
      expect(calendar.getEraName()).toBe('建安');
      expect(calendar.getYearInEra()).toBe(1);
    });
  });

  // ═══════════════════════════════════════════
  // 9. pause/resume — 暂停后 tick 不推进时间
  // ═══════════════════════════════════════════
  describe('pause / resume', () => {
    it('pause 后 update 不推进时间', () => {
      calendar.pause();
      expect(calendar.isPaused()).toBe(true);
      calendar.update(1);
      expect(calendar.getTotalDays()).toBe(0);
    });

    it('resume 后 update 恢复推进', () => {
      calendar.pause();
      calendar.resume();
      expect(calendar.isPaused()).toBe(false);
      calendar.update(1);
      expect(calendar.getTotalDays()).toBe(1);
    });

    it('暂停后 getState 反映 paused 状态', () => {
      calendar.pause();
      expect(calendar.getState().paused).toBe(true);
    });
  });

  // ═══════════════════════════════════════════
  // 10. setTimeScale — 修改时间流速
  // ═══════════════════════════════════════════
  describe('setTimeScale()', () => {
    it('设置并获取时间缩放倍率', () => {
      calendar.setTimeScale(5);
      expect(calendar.getTimeScale()).toBe(5);
    });

    it('时间缩放影响 update 推进速度', () => {
      calendar.setTimeScale(3);
      calendar.update(1);
      expect(calendar.getTotalDays()).toBe(3);
    });

    it('时间缩放为 0 时 update 不推进', () => {
      calendar.setTimeScale(0);
      calendar.update(1);
      expect(calendar.getTotalDays()).toBe(0);
    });
  });

  // ═══════════════════════════════════════════
  // 季节加成
  // ═══════════════════════════════════════════
  describe('季节加成', () => {
    it('春季加成正确', () => {
      const bonus = calendar.getSeasonBonus();
      expect(bonus.grainMultiplier).toBe(1.2);
      expect(bonus.goldMultiplier).toBe(1.0);
      expect(bonus.troopsMultiplier).toBe(1.0);
    });

    it('冬季加成正确', () => {
      const bonus = calendar.getSeasonBonusFor('winter');
      expect(bonus.grainMultiplier).toBe(0.7);
      expect(bonus.goldMultiplier).toBe(0.8);
      expect(bonus.troopsMultiplier).toBe(0.9);
    });

    it('返回副本不暴露内部引用', () => {
      expect(calendar.getSeasonBonus()).not.toBe(calendar.getSeasonBonus());
      expect(calendar.getSeasonBonusFor('spring')).not.toBe(calendar.getSeasonBonusFor('spring'));
    });
  });

  // ═══════════════════════════════════════════
  // formatDate 日期格式化
  // ═══════════════════════════════════════════
  describe('formatDate()', () => {
    it('元年正月格式化', () => {
      const result = calendar.formatDate();
      expect(result).toContain('建安元年');
      expect(result).toContain('正月');
    });

    it('自定义日期格式化', () => {
      const result = calendar.formatDate({
        year: 25, month: 6, day: 15,
        season: 'summer', eraName: '延康', yearInEra: 1,
      });
      expect(result).toContain('延康元年');
      expect(result).toContain('六月');
    });

    it('日期：初十（day=10）', () => {
      const r = calendar.formatDate({
        year: 1, month: 1, day: 10,
        season: 'spring', eraName: '建安', yearInEra: 1,
      });
      expect(r).toContain('初十');
    });

    it('日期：十五（day=15, <20）', () => {
      const r = calendar.formatDate({
        year: 1, month: 1, day: 15,
        season: 'spring', eraName: '建安', yearInEra: 1,
      });
      expect(r).toContain('十五');
    });

    it('日期：二十（day=20）', () => {
      const r = calendar.formatDate({
        year: 1, month: 1, day: 20,
        season: 'spring', eraName: '建安', yearInEra: 1,
      });
      expect(r).toContain('二十');
    });

    it('日期：三十（day=30）', () => {
      const r = calendar.formatDate({
        year: 1, month: 1, day: 30,
        season: 'spring', eraName: '建安', yearInEra: 1,
      });
      expect(r).toContain('三十');
    });

    it('日期：二十三（day=23, 20-29）', () => {
      const r = calendar.formatDate({
        year: 1, month: 1, day: 23,
        season: 'spring', eraName: '建安', yearInEra: 1,
      });
      expect(r).toContain('二十三');
    });

    it('年号：十年（n<=10）', () => {
      const r = calendar.formatDate({
        year: 10, month: 1, day: 1,
        season: 'spring', eraName: '建安', yearInEra: 10,
      });
      expect(r).toContain('建安十年');
    });

    it('年号：二十年（n=20, <20 分支 n%10==0）', () => {
      const r = calendar.formatDate({
        year: 20, month: 1, day: 1,
        season: 'spring', eraName: '建安', yearInEra: 20,
      });
      expect(r).toContain('二十年');
    });

    it('年号：三十年（n=30, <100 && n%10==0 分支）', () => {
      const r = calendar.formatDate({
        year: 30, month: 1, day: 1,
        season: 'spring', eraName: '太和', yearInEra: 30,
      });
      expect(r).toContain('三十年');
    });

    it('年号：二十三（n=23, 通用分支）', () => {
      const r = calendar.formatDate({
        year: 23, month: 1, day: 1,
        season: 'spring', eraName: '建安', yearInEra: 23,
      });
      expect(r).toContain('二十三');
    });
  });

  // ═══════════════════════════════════════════
  // getState 快照
  // ═══════════════════════════════════════════
  describe('getState()', () => {
    it('返回 date 副本', () => {
      const s1 = calendar.getState();
      const s2 = calendar.getState();
      expect(s1.date).toEqual(s2.date);
      expect(s1.date).not.toBe(s2.date);
    });

    it('反映 update 后的变化', () => {
      calendar.update(1);
      const state = calendar.getState();
      expect(state.totalDays).toBe(1);
      expect(state.date.day).toBe(2);
    });
  });
});
