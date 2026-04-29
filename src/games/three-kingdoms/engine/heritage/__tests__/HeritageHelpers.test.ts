/**
 * HeritageHelpers 单元测试
 *
 * 覆盖：
 * 1. createInitialHeritageState — 创建初始状态
 * 2. getTodayStr — 获取今天日期
 * 3. EVENT_PREFIX 常量
 */

import {
  createInitialHeritageState,
  getTodayStr,
  EVENT_PREFIX,
} from '../HeritageHelpers';

describe('HeritageHelpers', () => {
  // ─── createInitialHeritageState ───────────

  describe('createInitialHeritageState', () => {
    it('应创建初始状态', () => {
      const state = createInitialHeritageState();
      expect(state.heroHeritageCount).toBe(0);
      expect(state.equipmentHeritageCount).toBe(0);
      expect(state.experienceHeritageCount).toBe(0);
      expect(state.dailyHeritageCount).toBe(0);
      expect(state.heritageHistory).toEqual([]);
    });

    it('lastDailyReset 应为今天的日期字符串', () => {
      const state = createInitialHeritageState();
      expect(state.lastDailyReset).toBe(getTodayStr());
    });

    it('每次调用应返回独立对象', () => {
      const s1 = createInitialHeritageState();
      const s2 = createInitialHeritageState();
      expect(s1).not.toBe(s2);
    });
  });

  // ─── getTodayStr ──────────────────────────

  describe('getTodayStr', () => {
    it('应返回 YYYY-MM-DD 格式', () => {
      const str = getTodayStr();
      expect(str).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  // ─── EVENT_PREFIX ─────────────────────────

  describe('EVENT_PREFIX', () => {
    it('应为 heritage', () => {
      expect(EVENT_PREFIX).toBe('heritage');
    });
  });
});
