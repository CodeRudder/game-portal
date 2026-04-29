/**
 * AchievementHelpers 单元测试
 *
 * 覆盖：
 * 1. createAchievementInstance — 创建成就实例
 * 2. createInitialState — 创建初始状态
 * 3. initChainProgress — 初始化链进度
 */

import {
  createAchievementInstance,
  createInitialState,
  initChainProgress,
} from '../AchievementHelpers';

import type { AchievementDef } from '../../../core/achievement';

describe('AchievementHelpers', () => {
  // ─── createAchievementInstance ────────────

  describe('createAchievementInstance', () => {
    it('应创建无前置的成就实例（in_progress）', () => {
      const def: AchievementDef = {
        id: 'ach_1',
        dimension: 'battle',
        name: '首胜',
        description: '获得第一场胜利',
        conditions: [{ type: 'wins', target: 1 }],
        rewards: { gold: 100 },
        prerequisiteId: undefined,
      };
      const instance = createAchievementInstance(def);
      expect(instance.defId).toBe('ach_1');
      expect(instance.status).toBe('in_progress');
      expect(instance.progress.wins).toBe(0);
      expect(instance.completedAt).toBeNull();
    });

    it('有前置的成就应为 locked', () => {
      const def: AchievementDef = {
        id: 'ach_2',
        dimension: 'battle',
        name: '十胜',
        description: '获得十场胜利',
        conditions: [{ type: 'wins', target: 10 }],
        rewards: { gold: 500 },
        prerequisiteId: 'ach_1',
      };
      const instance = createAchievementInstance(def);
      expect(instance.status).toBe('locked');
    });

    it('多条件应初始化所有进度', () => {
      const def: AchievementDef = {
        id: 'ach_3',
        dimension: 'collection',
        name: '收集家',
        description: '收集武将和装备',
        conditions: [
          { type: 'heroes', target: 10 },
          { type: 'equipment', target: 5 },
        ],
        rewards: { gold: 200 },
      };
      const instance = createAchievementInstance(def);
      expect(instance.progress.heroes).toBe(0);
      expect(instance.progress.equipment).toBe(0);
    });
  });

  // ─── createInitialState ───────────────────

  describe('createInitialState', () => {
    it('应创建包含成就的状态', () => {
      const state = createInitialState();
      expect(Object.keys(state.achievements).length).toBeGreaterThan(0);
    });

    it('totalPoints 初始应为0', () => {
      const state = createInitialState();
      expect(state.totalPoints).toBe(0);
    });

    it('应包含维度统计', () => {
      const state = createInitialState();
      expect(state.dimensionStats).toBeDefined();
      expect(Object.keys(state.dimensionStats).length).toBeGreaterThan(0);
    });

    it('completedChains 应为空', () => {
      const state = createInitialState();
      expect(state.completedChains).toEqual([]);
    });
  });

  // ─── initChainProgress ────────────────────

  describe('initChainProgress', () => {
    it('应返回链进度对象', () => {
      const progress = initChainProgress();
      expect(typeof progress).toBe('object');
    });

    it('所有链进度应初始为0', () => {
      const progress = initChainProgress();
      for (const value of Object.values(progress)) {
        expect(value).toBe(0);
      }
    });
  });
});
