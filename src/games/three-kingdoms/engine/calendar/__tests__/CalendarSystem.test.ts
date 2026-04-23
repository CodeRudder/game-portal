import { vi } from 'vitest';
/**
 * CalendarSystem 核心单元测试
 *
 * 覆盖：初始化默认状态、update() 时间流逝、季节切换、年号切换。
 */

import { CalendarSystem } from '../CalendarSystem';
import { DAYS_PER_MONTH, DAYS_PER_YEAR, ERA_TABLE, DEFAULT_TIME_SCALE } from '../calendar-config';
import { SocialEvents } from '../../../core/events/EventTypes';
import type { ISystemDeps } from '../../../core/types';

// ── Mock ISystemDeps — 类型安全的 mock 工厂 ──
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
    beforeEach(() => { calendar.init(deps); });

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
    beforeEach(() => { calendar.init(deps); });

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
    beforeEach(() => { calendar.init(deps); });

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
});
