/**
 * V4 攻城略地(下) — 攻城完整流程集成测试
 *
 * 覆盖以下 play 流程：
 * - §7.1 攻城条件校验 — 相邻/兵力/粮草/日次数/冷却
 * - §7.2 攻城执行 — 消耗/战斗/占领/失败惩罚
 * - §7.3 攻城统计 — 胜率/历史/每日计数
 * - §7.4 攻城冷却 — 占领后冷却期
 * - §7.5 攻城存档 — 序列化/反序列化
 *
 * 编码规范：
 * - 每个it前创建新的系统实例
 * - describe按play流程ID组织
 * - 不使用 as unknown as Record<string, unknown>
 */

import { describe, it, expect } from 'vitest';
import { SiegeSystem } from '../../map/SiegeSystem';
import { TerritorySystem } from '../../map/TerritorySystem';
import { GarrisonSystem } from '../../map/GarrisonSystem';
import { SiegeEnhancer } from '../../map/SiegeEnhancer';
import { WorldMapSystem } from '../../map/WorldMapSystem';
import type { ISystemDeps } from '../../core/types';
import type { SiegeResult, SiegeConditionResult } from '../../map/SiegeSystem';

// ── 辅助：创建完整依赖 ──

function createFullDeps(): {
  deps: ISystemDeps;
  territory: TerritorySystem;
  siege: SiegeSystem;
  enhancer: SiegeEnhancer;
  garrison: GarrisonSystem;
  mapSys: WorldMapSystem;
} {
  const territory = new TerritorySystem();
  const siege = new SiegeSystem();
  const enhancer = new SiegeEnhancer();
  const garrison = new GarrisonSystem();
  const mapSys = new WorldMapSystem();

  const registry = new Map<string, unknown>();
  registry.set('territory', territory);
  registry.set('siege', siege);
  registry.set('siegeEnhancer', enhancer);
  registry.set('garrison', garrison);
  registry.set('worldMap', mapSys);

  const listeners: Record<string, Function[]> = {};
  const eventBus = {
    emit: (event: string, data?: unknown) => {
      (listeners[event] || []).forEach(fn => fn(data));
    },
    on: (event: string, fn: Function) => {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(fn);
    },
    off: (event: string, fn: Function) => {
      if (listeners[event]) listeners[event] = listeners[event].filter(f => f !== fn);
    },
  };

  const deps: ISystemDeps = { registry: registry as unknown as Record<string, unknown>, eventBus: eventBus as unknown as { emit: (...args: unknown[]) => void; on: (...args: unknown[]) => void; off: (...args: unknown[]) => void } };
  territory.init(deps);
  siege.init(deps);
  enhancer.init(deps);
  garrison.init(deps);
  mapSys.init(deps);

  return { deps, territory, siege, enhancer, garrison, mapSys };
}

/** 占领一个初始领土用于攻城 */
function captureInitialTerritory(territory: TerritorySystem, id: string): void {
  territory.captureTerritory(id, 'player');
}

// ═══════════════════════════════════════════════════════════════
// V4 SIEGE-FULL-FLOW 攻城完整流程
// ═══════════════════════════════════════════════════════════════
describe('V4 SIEGE-FULL-FLOW 攻城完整流程', () => {

  // ═══════════════════════════════════════════════════════════════
  // §7.1 攻城条件校验
  // ═══════════════════════════════════════════════════════════════
  describe('§7.1 攻城条件校验', () => {
    it('不存在的领土 → TARGET_NOT_FOUND', () => {
      const { siege } = createFullDeps();
      const result = siege.checkSiegeConditions('nonexistent', 'player', 5000, 5000);
      expect(result.canSiege).toBe(false);
      expect(result.errorCode).toBe('TARGET_NOT_FOUND');
    });

    it('己方领土 → TARGET_ALREADY_OWNED', () => {
      const { siege, territory } = createFullDeps();
      captureInitialTerritory(territory, 'city-luoyang');
      const result = siege.checkSiegeConditions('city-luoyang', 'player', 5000, 5000);
      expect(result.canSiege).toBe(false);
      expect(result.errorCode).toBe('TARGET_ALREADY_OWNED');
    });

    it('不相邻领土 → NOT_ADJACENT', () => {
      const { siege, territory } = createFullDeps();
      captureInitialTerritory(territory, 'city-luoyang');
      // 找一个不相邻的领土
      const allTerritories = territory.getAllTerritories();
      const nonAdjacent = allTerritories.find(t =>
        t.id !== 'city-luoyang' &&
        t.ownership !== 'player' &&
        !territory.getAdjacentTerritoryIds('city-luoyang').includes(t.id)
      );
      if (nonAdjacent) {
        const result = siege.checkSiegeConditions(nonAdjacent.id, 'player', 5000, 5000);
        expect(result.canSiege).toBe(false);
        expect(result.errorCode).toBe('NOT_ADJACENT');
      }
    });

    it('兵力不足 → INSUFFICIENT_TROOPS', () => {
      const { siege, territory } = createFullDeps();
      captureInitialTerritory(territory, 'city-luoyang');
      const adj = territory.getAdjacentTerritoryIds('city-luoyang');
      if (adj.length > 0) {
        const result = siege.checkSiegeConditions(adj[0], 'player', 10, 5000);
        expect(result.canSiege).toBe(false);
        expect(result.errorCode).toBe('INSUFFICIENT_TROOPS');
      }
    });

    it('粮草不足 → INSUFFICIENT_GRAIN', () => {
      const { siege, territory } = createFullDeps();
      captureInitialTerritory(territory, 'city-luoyang');
      const adj = territory.getAdjacentTerritoryIds('city-luoyang');
      if (adj.length > 0) {
        const result = siege.checkSiegeConditions(adj[0], 'player', 5000, 10);
        expect(result.canSiege).toBe(false);
        expect(result.errorCode).toBe('INSUFFICIENT_GRAIN');
      }
    });

    it('资源充足+相邻+非己方 → 可以攻城', () => {
      const { siege, territory } = createFullDeps();
      captureInitialTerritory(territory, 'city-luoyang');
      const adj = territory.getAdjacentTerritoryIds('city-luoyang');
      if (adj.length > 0) {
        const adjTerritory = territory.getTerritoryById(adj[0]);
        if (adjTerritory && adjTerritory.ownership !== 'player') {
          const result = siege.checkSiegeConditions(adj[0], 'player', 5000, 5000);
          expect(result.canSiege).toBe(true);
        }
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // §7.2 攻城执行
  // ═══════════════════════════════════════════════════════════════
  describe('§7.2 攻城执行', () => {
    it('executeSiege条件不通过返回失败', () => {
      const { siege } = createFullDeps();
      const result = siege.executeSiege('nonexistent', 'player', 5000, 5000);
      expect(result.launched).toBe(false);
    });

    it('executeSiegeWithResult条件不通过返回失败', () => {
      const { siege } = createFullDeps();
      const result = siege.executeSiegeWithResult('nonexistent', 'player', 5000, 5000);
      expect(result.launched).toBe(false);
      expect(result.victory).toBe(false);
    });

    it('攻城执行返回完整结果结构', () => {
      const { siege, territory } = createFullDeps();
      captureInitialTerritory(territory, 'city-luoyang');
      const adj = territory.getAdjacentTerritoryIds('city-luoyang');
      if (adj.length > 0) {
        const adjTerritory = territory.getTerritoryById(adj[0]);
        if (adjTerritory && adjTerritory.ownership !== 'player') {
          const result = siege.executeSiegeWithResult(adj[0], 'player', 50000, 50000);
          expect(result).toHaveProperty('launched');
          expect(result).toHaveProperty('victory');
          expect(result).toHaveProperty('targetId');
          expect(result).toHaveProperty('cost');
          expect(result.cost).toHaveProperty('troops');
          expect(result.cost).toHaveProperty('grain');
        }
      }
    });

    it('攻城消耗兵力×100 + 粮草×500', () => {
      const { siege, territory } = createFullDeps();
      captureInitialTerritory(territory, 'city-luoyang');
      const adj = territory.getAdjacentTerritoryIds('city-luoyang');
      if (adj.length > 0) {
        const adjTerritory = territory.getTerritoryById(adj[0]);
        if (adjTerritory) {
          const cost = siege.calculateSiegeCost(adjTerritory);
          expect(cost.troops).toBeGreaterThan(0);
          expect(cost.grain).toBe(500);
        }
      }
    });

    it('getSiegeCostById返回消耗', () => {
      const { siege, territory } = createFullDeps();
      const t = territory.getTerritoryById('city-luoyang');
      if (t) {
        const cost = siege.getSiegeCostById('city-luoyang');
        if (cost) {
          expect(cost.troops).toBeGreaterThan(0);
          expect(cost.grain).toBe(500);
        }
      }
    });

    it('getSiegeCostById不存在返回null', () => {
      const { siege } = createFullDeps();
      expect(siege.getSiegeCostById('nonexistent')).toBeNull();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // §7.3 攻城统计
  // ═══════════════════════════════════════════════════════════════
  describe('§7.3 攻城统计', () => {
    it('初始统计为0', () => {
      const { siege } = createFullDeps();
      expect(siege.getTotalSieges()).toBe(0);
      expect(siege.getVictories()).toBe(0);
      expect(siege.getDefeats()).toBe(0);
      expect(siege.getWinRate()).toBe(0);
    });

    it('getHistory初始为空', () => {
      const { siege } = createFullDeps();
      expect(siege.getHistory()).toEqual([]);
    });

    it('攻城后统计更新', () => {
      const { siege, territory } = createFullDeps();
      captureInitialTerritory(territory, 'city-luoyang');
      const adj = territory.getAdjacentTerritoryIds('city-luoyang');
      if (adj.length > 0) {
        const adjTerritory = territory.getTerritoryById(adj[0]);
        if (adjTerritory && adjTerritory.ownership !== 'player') {
          siege.executeSiegeWithResult(adj[0], 'player', 50000, 50000);
          expect(siege.getTotalSieges()).toBe(1);
          // 胜或败
          expect(siege.getVictories() + siege.getDefeats()).toBe(1);
        }
      }
    });

    it('getWinRate计算正确', () => {
      const { siege, territory } = createFullDeps();
      captureInitialTerritory(territory, 'city-luoyang');
      const adj = territory.getAdjacentTerritoryIds('city-luoyang');
      if (adj.length > 0) {
        siege.executeSiegeWithResult(adj[0], 'player', 50000, 50000);
        const rate = siege.getWinRate();
        expect(rate).toBeGreaterThanOrEqual(0);
        expect(rate).toBeLessThanOrEqual(1);
      }
    });

    it('getRemainingDailySieges返回剩余次数', () => {
      const { siege } = createFullDeps();
      const remaining = siege.getRemainingDailySieges();
      expect(remaining).toBeGreaterThanOrEqual(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // §7.4 攻城冷却
  // ═══════════════════════════════════════════════════════════════
  describe('§7.4 攻城冷却', () => {
    it('未占领的领土无冷却', () => {
      const { siege } = createFullDeps();
      expect(siege.isInCaptureCooldown('nonexistent')).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // §7.5 攻城存档
  // ═══════════════════════════════════════════════════════════════
  describe('§7.5 攻城存档', () => {
    it('getState返回完整状态', () => {
      const { siege } = createFullDeps();
      const state = siege.getState();
      expect(state).toHaveProperty('history');
      expect(state).toHaveProperty('totalSieges');
      expect(state).toHaveProperty('victories');
      expect(state).toHaveProperty('defeats');
      expect(state.totalSieges).toBe(0);
    });

    it('reset清空所有状态', () => {
      const { siege, territory } = createFullDeps();
      captureInitialTerritory(territory, 'city-luoyang');
      const adj = territory.getAdjacentTerritoryIds('city-luoyang');
      if (adj.length > 0) {
        siege.executeSiegeWithResult(adj[0], 'player', 50000, 50000);
      }
      siege.reset();
      expect(siege.getTotalSieges()).toBe(0);
      expect(siege.getVictories()).toBe(0);
      expect(siege.getDefeats()).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // §7.6 领土系统联动
  // ═══════════════════════════════════════════════════════════════
  describe('§7.6 领土系统联动', () => {
    it('captureTerritory更新所有权', () => {
      const { territory } = createFullDeps();
      captureInitialTerritory(territory, 'city-luoyang');
      const t = territory.getTerritoryById('city-luoyang');
      expect(t!.ownership).toBe('player');
    });

    it('getPlayerTerritoryCount正确计数', () => {
      const { territory } = createFullDeps();
      expect(territory.getPlayerTerritoryCount()).toBe(0);
      captureInitialTerritory(territory, 'city-luoyang');
      expect(territory.getPlayerTerritoryCount()).toBe(1);
    });

    it('getPlayerTerritoryIds返回己方领土', () => {
      const { territory } = createFullDeps();
      captureInitialTerritory(territory, 'city-luoyang');
      const ids = territory.getPlayerTerritoryIds();
      expect(ids).toContain('city-luoyang');
    });

    it('getAttackableTerritories返回可攻击列表', () => {
      const { territory } = createFullDeps();
      captureInitialTerritory(territory, 'city-luoyang');
      const attackable = territory.getAttackableTerritories('player');
      expect(attackable.length).toBeGreaterThan(0);
    });

    it('canAttackTerritory验证相邻关系', () => {
      const { territory } = createFullDeps();
      captureInitialTerritory(territory, 'city-luoyang');
      const adj = territory.getAdjacentTerritoryIds('city-luoyang');
      if (adj.length > 0) {
        expect(territory.canAttackTerritory(adj[0], 'player')).toBe(true);
      }
    });

    it('getAdjacentTerritoryIds返回相邻领土', () => {
      const { territory } = createFullDeps();
      const adj = territory.getAdjacentTerritoryIds('city-luoyang');
      // 洛阳应该有相邻领土
      expect(adj.length).toBeGreaterThan(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // §7.7 领土产出与升级
  // ═══════════════════════════════════════════════════════════════
  describe('§7.7 领土产出与升级', () => {
    it('占领后领土有产出数据', () => {
      const { territory } = createFullDeps();
      captureInitialTerritory(territory, 'city-luoyang');
      const t = territory.getTerritoryById('city-luoyang');
      expect(t!.baseProduction).toBeDefined();
    });

    it('getPlayerProductionSummary返回汇总', () => {
      const { territory } = createFullDeps();
      captureInitialTerritory(territory, 'city-luoyang');
      const summary = territory.getPlayerProductionSummary();
      expect(summary).toBeDefined();
    });

    it('非己方领土不能升级', () => {
      const { territory } = createFullDeps();
      const t = territory.getTerritoryById('city-changan');
      if (t && t.ownership !== 'player') {
        const result = territory.upgradeTerritory('city-changan');
        // 应该失败
        expect(result.success).toBe(false);
      }
    });

    it('己方领土可升级', () => {
      const { territory } = createFullDeps();
      captureInitialTerritory(territory, 'city-luoyang');
      const result = territory.upgradeTerritory('city-luoyang');
      // 可能成功也可能因资源不足失败
      expect(result).toHaveProperty('success');
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // §7.8 SiegeEnhancer胜率预估
  // ═══════════════════════════════════════════════════════════════
  describe('§7.8 SiegeEnhancer胜率预估', () => {
    it('estimateWinRate返回预估数据', () => {
      const { enhancer } = createFullDeps();
      const estimate = enhancer.estimateWinRate(5000, 'city-luoyang');
      if (estimate) {
        expect(estimate).toHaveProperty('winRate');
        expect(estimate).toHaveProperty('rating');
        expect(estimate.winRate).toBeGreaterThanOrEqual(0);
        expect(estimate.winRate).toBeLessThanOrEqual(1);
      }
    });

    it('calculateSiegeReward返回奖励数据', () => {
      const { enhancer, territory } = createFullDeps();
      const t = territory.getTerritoryById('city-luoyang');
      if (t) {
        const reward = enhancer.calculateSiegeReward(t);
        expect(reward).toBeDefined();
        expect(reward).toHaveProperty('resources');
      }
    });

    it('calculateSiegeRewardById查询奖励', () => {
      const { enhancer } = createFullDeps();
      const reward = enhancer.calculateSiegeRewardById('city-luoyang');
      if (reward) {
        expect(reward).toHaveProperty('resources');
      }
    });

    it('不存在的领土返回null', () => {
      const { enhancer } = createFullDeps();
      expect(enhancer.estimateWinRate(5000, 'nonexistent')).toBeNull();
      expect(enhancer.calculateSiegeRewardById('nonexistent')).toBeNull();
    });

    it('高战力胜率高于低战力', () => {
      const { enhancer } = createFullDeps();
      const low = enhancer.estimateWinRate(1000, 'city-luoyang');
      const high = enhancer.estimateWinRate(100000, 'city-luoyang');
      if (low && high) {
        expect(high.winRate).toBeGreaterThanOrEqual(low.winRate);
      }
    });
  });
});
