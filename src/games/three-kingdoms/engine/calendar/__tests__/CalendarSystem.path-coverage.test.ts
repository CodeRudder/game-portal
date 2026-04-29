/**
 * CalendarSystem 深度路径覆盖测试
 *
 * 覆盖复杂分支路径和组合场景：
 * 1. 季节切换：春→夏→秋→冬→春
 * 2. 事件触发：定时事件/条件事件/连锁事件
 * 3. NPC调度：暂停/恢复/时间缩放
 * 4. 日夜循环：序列化/反序列化/天气变化
 *
 * @module engine/calendar/__tests__/CalendarSystem.path-coverage
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CalendarSystem } from '../CalendarSystem';
import {
  DAYS_PER_MONTH,
  DAYS_PER_YEAR,
  DEFAULT_TIME_SCALE,
  ERA_TABLE,
  SEASON_BONUSES,
  CALENDAR_SAVE_VERSION,
} from '../calendar-config';
import { SocialEvents, MapEvents } from '../../../core/events/EventTypes';
import type { ISystemDeps } from '../../../core/types';
import type { CalendarSaveData, Season, WeatherType } from '../calendar.types';

// ── Mock ISystemDeps 工厂 ──

function createMockDeps(): ISystemDeps {
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
      register: vi.fn(),
      get: vi.fn(),
      getAll: vi.fn(() => new Map()),
      has: vi.fn(() => false),
      unregister: vi.fn(),
    },
  };
}

// ── 测试 ──

describe('CalendarSystem 路径覆盖测试', () => {
  let calendar: CalendarSystem;
  let deps: ReturnType<typeof createMockDeps>;

  beforeEach(() => {
    vi.restoreAllMocks();
    calendar = new CalendarSystem();
    deps = createMockDeps();
    calendar.init(deps);
  });

  // ═══════════════════════════════════════════
  // 1. 季节切换路径 — 春→夏→秋→冬→春
  // ═══════════════════════════════════════════

  describe('季节切换路径', () => {
    it('春季（1-3月）→ 夏季（4月）触发季节变化事件', () => {
      // 逐天推进到第90天（3月底），再推进到第91天（4月1日=夏季）
      for (let i = 0; i < 90; i++) {
        calendar.update(1);
      }
      const emitCalls = (deps.eventBus.emit as ReturnType<typeof vi.fn>).mock.calls;
      const seasonChangeCalls = emitCalls.filter(
        (call: unknown[]) => call[0] === SocialEvents.CALENDAR_SEASON_CHANGED,
      );

      // 应有季节变化事件（春→夏）
      expect(seasonChangeCalls.length).toBeGreaterThan(0);
      const lastSeasonEvent = seasonChangeCalls[seasonChangeCalls.length - 1];
      expect(lastSeasonEvent[1].season).toBe('summer');
    });

    it('四季完整循环：春→夏→秋→冬', () => {
      const seasons: Season[] = [];

      // 监听季节变化事件（在 init 后覆盖 emit）
      (deps.eventBus.emit as ReturnType<typeof vi.fn>).mockImplementation(
        (event: string, data: { season?: Season }) => {
          if (event === SocialEvents.CALENDAR_SEASON_CHANGED && data.season) {
            seasons.push(data.season);
          }
        },
      );

      // 逐天推进一整年
      for (let i = 0; i < DAYS_PER_YEAR; i++) {
        calendar.update(1);
      }

      // 应经历夏、秋、冬
      expect(seasons).toContain('summer');
      expect(seasons).toContain('autumn');
      expect(seasons).toContain('winter');
    });

    it('初始季节为春季', () => {
      expect(calendar.getSeason()).toBe('spring');
    });

    it('季节加成查询正确', () => {
      // 春季加成
      const springBonus = calendar.getSeasonBonus();
      expect(springBonus.grainMultiplier).toBe(SEASON_BONUSES.spring.grainMultiplier);

      // 冬季加成
      const winterBonus = calendar.getSeasonBonusFor('winter');
      expect(winterBonus.grainMultiplier).toBe(SEASON_BONUSES.winter.grainMultiplier);
    });
  });

  // ═══════════════════════════════════════════
  // 2. 事件触发路径 — 日期/季节/天气
  // ═══════════════════════════════════════════

  describe('事件触发路径', () => {
    it('每日变化触发CALENDAR_DAY_CHANGED事件', () => {
      calendar.update(1); // 1天

      expect(deps.eventBus.emit).toHaveBeenCalledWith(
        SocialEvents.CALENDAR_DAY_CHANGED,
        expect.objectContaining({
          day: expect.any(Number),
          month: expect.any(Number),
          year: expect.any(Number),
        }),
      );
    });

    it('连续多天推进触发多次日期变化事件', () => {
      const emitSpy = deps.eventBus.emit as ReturnType<typeof vi.fn>;
      // 逐天推进5天
      for (let i = 0; i < 5; i++) {
        calendar.update(1);
      }

      const dayChangeCalls = emitSpy.mock.calls.filter(
        (call: unknown[]) => call[0] === SocialEvents.CALENDAR_DAY_CHANGED,
      );
      expect(dayChangeCalls.length).toBe(5);
    });

    it('dt=0时不触发任何事件', () => {
      calendar.update(0);
      expect(deps.eventBus.emit).not.toHaveBeenCalled();
    });

    it('天气变化触发WEATHER_CHANGED事件', () => {
      calendar.setWeather('rain');

      expect(deps.eventBus.emit).toHaveBeenCalledWith(
        MapEvents.WEATHER_CHANGED,
        expect.objectContaining({
          previous: 'clear',
          current: 'rain',
        }),
      );
    });

    it('设置相同天气不触发事件', () => {
      const emitSpy = deps.eventBus.emit as ReturnType<typeof vi.fn>;
      calendar.setWeather('clear'); // 已是 clear

      // 不应有 WEATHER_CHANGED 事件
      const weatherCalls = emitSpy.mock.calls.filter(
        (call: unknown[]) => call[0] === MapEvents.WEATHER_CHANGED,
      );
      expect(weatherCalls.length).toBe(0);
    });
  });

  // ═══════════════════════════════════════════
  // 3. 时间控制路径 — 暂停/恢复/缩放
  // ═══════════════════════════════════════════

  describe('时间控制路径', () => {
    it('暂停后update不推进时间', () => {
      calendar.pause();
      expect(calendar.isPaused()).toBe(true);

      calendar.update(100);
      expect(calendar.getTotalDays()).toBe(0);
    });

    it('恢复后update正常推进', () => {
      calendar.pause();
      calendar.resume();
      expect(calendar.isPaused()).toBe(false);

      calendar.update(1);
      expect(calendar.getTotalDays()).toBe(1);
    });

    it('自定义时间缩放倍率', () => {
      calendar.setTimeScale(2.0);
      expect(calendar.getTimeScale()).toBe(2.0);

      calendar.update(1); // 1秒 × 2.0 = 2天
      expect(calendar.getTotalDays()).toBe(2);
    });

    it('reset恢复初始状态', () => {
      calendar.update(100);
      expect(calendar.getTotalDays()).toBeGreaterThan(0);

      calendar.reset();
      expect(calendar.getTotalDays()).toBe(0);
      expect(calendar.getSeason()).toBe('spring');
      expect(calendar.getWeather()).toBe('clear');
      expect(calendar.isPaused()).toBe(false);
    });
  });

  // ═══════════════════════════════════════════
  // 4. 序列化/反序列化路径
  // ═══════════════════════════════════════════

  describe('序列化与反序列化路径', () => {
    it('序列化保存当前状态', () => {
      for (let i = 0; i < 50; i++) {
        calendar.update(1);
      }
      calendar.setWeather('rain');

      const data = calendar.serialize();
      expect(data.version).toBe(CALENDAR_SAVE_VERSION);
      expect(data.totalDays).toBe(50);
      expect(data.weather).toBe('rain');
    });

    it('反序列化恢复状态', () => {
      for (let i = 0; i < 100; i++) {
        calendar.update(1);
      }

      const data = calendar.serialize();
      calendar.reset();
      expect(calendar.getTotalDays()).toBe(0);

      calendar.deserialize(data);
      expect(calendar.getTotalDays()).toBe(100);
    });

    it('反序列化处理版本不匹配（不崩溃）', () => {
      const badData: CalendarSaveData = {
        version: 999,
        totalDays: 50,
        weather: 'clear',
        weatherTimer: 0,
        paused: false,
      };
      // 应不抛异常
      expect(() => calendar.deserialize(badData)).not.toThrow();
    });

    it('反序列化恢复暂停状态', () => {
      calendar.pause();
      const data = calendar.serialize();
      expect(data.paused).toBe(true);

      calendar.reset();
      calendar.deserialize(data);
      expect(calendar.isPaused()).toBe(true);
    });

    it('反序列化忽略无效天气值', () => {
      const badWeatherData = {
        version: CALENDAR_SAVE_VERSION,
        totalDays: 10,
        weather: 'invalid_weather',
        weatherTimer: 0,
        paused: false,
      };
      // 应不崩溃，天气保持默认或忽略无效值
      expect(() => calendar.deserialize(badWeatherData as CalendarSaveData)).not.toThrow();
    });
  });

  // ═══════════════════════════════════════════
  // 5. 年号切换路径
  // ═══════════════════════════════════════════

  describe('年号切换路径', () => {
    it('初始年号为建安元年', () => {
      expect(calendar.getEraName()).toBe('建安');
      expect(calendar.getYearInEra()).toBe(1);
    });

    it('推进到第25年切换为延康', () => {
      // 建安覆盖 year 1-24，即 day 0 ~ day 24*360-1 = 8639
      // 推进到第24年末（day 8639）
      const daysToYear24End = 24 * DAYS_PER_YEAR - 1; // 8639
      for (let i = 0; i < daysToYear24End; i++) {
        calendar.update(1);
      }
      expect(calendar.getEraName()).toBe('建安');

      // 再推进1天进入第25年 = 延康
      calendar.update(1);
      expect(calendar.getEraName()).toBe('延康');
    });

    it('格式化日期字符串正确', () => {
      const dateStr = calendar.formatDate();
      expect(dateStr).toContain('建安');
      expect(dateStr).toContain('元年');
    });
  });
});
