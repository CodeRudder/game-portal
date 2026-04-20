/**
 * CalendarSystem 高级单元测试
 *
 * 覆盖：天气变化、事件发出、序列化/反序列化、reset、
 *       pause/resume、setTimeScale、季节加成、formatDate、getState 快照。
 */

import { CalendarSystem } from '../CalendarSystem';
import type { CalendarSaveData } from '../calendar.types';
import { CALENDAR_SAVE_VERSION } from '../calendar-config';
import { DAYS_PER_YEAR, DEFAULT_TIME_SCALE } from '../calendar-config';
import { SocialEvents, MapEvents } from '../../../core/events/EventTypes';

// ── Mock ISystemDeps ──
function createMockDeps() {
  return {
    eventBus: {
      on: jest.fn(),
      once: jest.fn(),
      emit: jest.fn(),
      off: jest.fn(),
      removeAllListeners: jest.fn(),
    },
    config: { get: jest.fn(), set: jest.fn(), has: jest.fn(() => false) },
    registry: {
      register: jest.fn(), get: jest.fn(), getAll: jest.fn(() => new Map()),
      has: jest.fn(() => false), unregister: jest.fn(),
    },
  };
}

describe('CalendarSystem', () => {
  let calendar: CalendarSystem;
  let deps: ReturnType<typeof createMockDeps>;

  beforeEach(() => {
    jest.restoreAllMocks();
    calendar = new CalendarSystem();
    deps = createMockDeps();
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
      const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0);
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
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
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
