/**
 * HeritageSimulation 单元测试
 *
 * 覆盖：
 * 1. claimInitialGift — 领取转生初始资源
 * 2. executeRebuild — 一键重建
 * 3. instantUpgrade — 瞬间升级
 * 4. createInitialAccelState — 初始加速状态
 * 5. getRebirthUnlocks / isHeritageUnlocked — 转生解锁
 * 6. simulateEarnings — 收益模拟
 */

import {
  claimInitialGift,
  executeRebuild,
  instantUpgrade,
  createInitialAccelState,
  getRebirthUnlocks,
  isHeritageUnlocked,
  simulateEarnings,
} from '../HeritageSimulation';

import type { RebirthAccelerationState } from '../../../core/heritage';

describe('HeritageSimulation', () => {
  const mockDeps = {
    eventBus: { on: vi.fn(), emit: vi.fn(), off: vi.fn() },
    registry: { get: vi.fn() },
  };

  // ─── claimInitialGift ─────────────────────

  describe('claimInitialGift', () => {
    it('应成功领取初始资源', () => {
      const state = createInitialAccelState();
      const callbacks = { addResources: vi.fn() };
      const result = claimInitialGift(state, callbacks, mockDeps);
      expect(result.success).toBe(true);
      expect(result.resources.grain).toBeGreaterThan(0);
      expect(callbacks.addResources).toHaveBeenCalled();
    });

    it('已领取应失败', () => {
      const state: RebirthAccelerationState = {
        ...createInitialAccelState(),
        initialGiftClaimed: true,
      };
      const result = claimInitialGift(state, {}, mockDeps);
      expect(result.success).toBe(false);
      expect(result.reason).toContain('已领取');
    });
  });

  // ─── executeRebuild ───────────────────────

  describe('executeRebuild', () => {
    it('应执行一键重建', () => {
      const state = createInitialAccelState();
      const callbacks = { upgradeBuilding: vi.fn().mockReturnValue(true) };
      const result = executeRebuild(state, callbacks, mockDeps);
      expect(result.success).toBe(true);
      expect(result.upgradedBuildings.length).toBeGreaterThan(0);
    });

    it('已执行过应失败', () => {
      const state: RebirthAccelerationState = {
        ...createInitialAccelState(),
        rebuildCompleted: true,
      };
      const result = executeRebuild(state, {}, mockDeps);
      expect(result.success).toBe(false);
      expect(result.reason).toContain('已执行');
    });
  });

  // ─── instantUpgrade ───────────────────────

  describe('instantUpgrade', () => {
    it('应成功瞬间升级', () => {
      const state = createInitialAccelState();
      const callbacks = {
        upgradeBuilding: vi.fn().mockReturnValue(true),
        getRebirthCount: vi.fn().mockReturnValue(5),
      };
      const result = instantUpgrade('building_1', state, callbacks);
      expect(result.success).toBe(true);
      expect(result.newState.instantUpgradeCount).toBe(1);
    });

    it('次数用完应失败', () => {
      const state: RebirthAccelerationState = {
        ...createInitialAccelState(),
        instantUpgradeCount: 100,
      };
      const callbacks = {
        upgradeBuilding: vi.fn().mockReturnValue(true),
        getRebirthCount: vi.fn().mockReturnValue(1),
      };
      const result = instantUpgrade('building_1', state, callbacks);
      expect(result.success).toBe(false);
    });

    it('已升级过应失败', () => {
      const state: RebirthAccelerationState = {
        ...createInitialAccelState(),
        instantUpgradedBuildings: ['building_1'],
      };
      const callbacks = {
        upgradeBuilding: vi.fn().mockReturnValue(true),
        getRebirthCount: vi.fn().mockReturnValue(10),
      };
      const result = instantUpgrade('building_1', state, callbacks);
      expect(result.success).toBe(false);
    });
  });

  // ─── createInitialAccelState ──────────────

  describe('createInitialAccelState', () => {
    it('应返回正确的初始状态', () => {
      const state = createInitialAccelState();
      expect(state.initialGiftClaimed).toBe(false);
      expect(state.rebuildCompleted).toBe(false);
      expect(state.instantUpgradeCount).toBe(0);
      expect(state.instantUpgradedBuildings).toEqual([]);
    });
  });

  // ─── getRebirthUnlocks ────────────────────

  describe('getRebirthUnlocks', () => {
    it('应返回解锁列表', () => {
      const unlocks = getRebirthUnlocks(0);
      expect(unlocks.length).toBeGreaterThan(0);
    });

    it('高转生次数应解锁更多内容', () => {
      const low = getRebirthUnlocks(0).filter(u => u.unlocked);
      const high = getRebirthUnlocks(10).filter(u => u.unlocked);
      expect(high.length).toBeGreaterThanOrEqual(low.length);
    });
  });

  // ─── isHeritageUnlocked ───────────────────

  describe('isHeritageUnlocked', () => {
    it('未达到转生次数应返回 false', () => {
      expect(isHeritageUnlocked('some_unlock', 0)).toBe(false);
    });
  });

  // ─── simulateEarnings ─────────────────────

  describe('simulateEarnings', () => {
    it('应返回模拟结果', () => {
      const result = simulateEarnings({
        currentRebirthCount: 1,
        waitHours: 24,
        dailyOnlineHours: 4,
      });
      expect(result.immediateMultiplier).toBeGreaterThan(0);
      expect(result.immediateEarnings).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('置信度应与在线时长正相关', () => {
      const low = simulateEarnings({ currentRebirthCount: 1, waitHours: 0, dailyOnlineHours: 2 });
      const high = simulateEarnings({ currentRebirthCount: 1, waitHours: 0, dailyOnlineHours: 8 });
      expect(high.confidence).toBeGreaterThanOrEqual(low.confidence);
    });
  });
});
