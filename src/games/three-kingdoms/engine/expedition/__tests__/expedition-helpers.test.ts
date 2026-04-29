/**
 * expedition-helpers 测试
 *
 * 覆盖：
 *   - createDefaultExpeditionState 默认状态创建
 *   - 各种 basePower 参数
 *   - 默认路线和区域配置
 */

import { describe, it, expect } from 'vitest';
import { createDefaultExpeditionState, SAVE_VERSION } from '../expedition-helpers';

describe('expedition-helpers', () => {
  describe('SAVE_VERSION', () => {
    it('应为正整数', () => {
      expect(SAVE_VERSION).toBeGreaterThan(0);
    });
  });

  describe('createDefaultExpeditionState', () => {
    it('应创建完整的远征状态（默认 basePower）', () => {
      const state = createDefaultExpeditionState();
      expect(state.routes).toBeDefined();
      expect(state.regions).toBeDefined();
      expect(state.teams).toEqual({});
      expect(state.unlockedSlots).toBe(1);
      expect(state.clearedRouteIds).toBeInstanceOf(Set);
      expect(state.routeStars).toEqual({});
      expect(state.sweepCounts).toEqual({});
      expect(state.achievedMilestones).toBeInstanceOf(Set);
      expect(state.consecutiveFailures).toBe(0);
      expect(state.isAutoExpeditioning).toBe(false);
    });

    it('应包含正确的默认区域', () => {
      const state = createDefaultExpeditionState();
      expect(Object.keys(state.regions)).toContain('region_hulao');
      expect(Object.keys(state.regions)).toContain('region_yishui');
      expect(Object.keys(state.regions)).toContain('region_luoyang');
    });

    it('应包含多条默认路线', () => {
      const state = createDefaultExpeditionState();
      const routeCount = Object.keys(state.routes).length;
      expect(routeCount).toBeGreaterThanOrEqual(10);
    });

    it('自定义 basePower 应影响节点推荐战力', () => {
      const state1000 = createDefaultExpeditionState(1000);
      const state2000 = createDefaultExpeditionState(2000);
      const route1000 = state1000.routes['route_hulao_easy'];
      const route2000 = state2000.routes['route_hulao_easy'];
      // 更高 basePower → 更高推荐战力
      const firstNode1000 = Object.values(route1000.nodes)[0];
      const firstNode2000 = Object.values(route2000.nodes)[0];
      expect(firstNode2000.recommendedPower).toBeGreaterThan(firstNode1000.recommendedPower);
    });

    it('autoConfig 应有正确的默认值', () => {
      const state = createDefaultExpeditionState();
      expect(state.autoConfig.repeatCount).toBe(0);
      expect(state.autoConfig.failureAction).toBe('pause');
      expect(state.autoConfig.bagFullAction).toBe('pause');
      expect(state.autoConfig.lowTroopAction).toBe('pause');
    });

    it('初始路线应有解锁和未解锁之分', () => {
      const state = createDefaultExpeditionState();
      const unlockedRoutes = Object.values(state.routes).filter(r => r.unlocked);
      const lockedRoutes = Object.values(state.routes).filter(r => !r.unlocked);
      expect(unlockedRoutes.length).toBeGreaterThan(0);
      expect(lockedRoutes.length).toBeGreaterThan(0);
    });
  });
});
