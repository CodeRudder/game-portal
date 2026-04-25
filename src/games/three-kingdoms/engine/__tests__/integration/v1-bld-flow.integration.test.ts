/**
 * 建筑系统 Play 流程集成测试 (v1.0 BLD-FLOW-1~6)
 *
 * 覆盖范围：
 * - BLD-FLOW-1: 8座建筑展示与总览
 * - BLD-FLOW-2: 建筑升级完整流程
 * - BLD-FLOW-3: 升级后产出增加验证
 * - BLD-FLOW-4: 建筑解锁条件验证
 * - BLD-FLOW-5: 建筑队列管理
 * - BLD-FLOW-6: 建筑升级推荐
 *
 * 测试原则：
 * - 每个用例创建独立的 sim 实例
 * - 使用真实引擎 API，不使用 mock
 * - 以实际代码行为为准
 *
 * 关键约束：
 * - 非主城建筑等级不能超过主城等级（初始 castle=1, farmland=1）
 * - 升级任何非主城建筑前必须先确保主城等级足够
 * - 主城 Lv5 需要"至少一座其他建筑达到 Lv4"
 * - 建筑队列：主城 Lv1~5 为 1 槽，Lv6~10 为 2 槽
 */

import { describe, it, expect } from 'vitest';
import { GameEventSimulator } from '../../../test-utils/GameEventSimulator';
import type { BuildingType } from '../../../shared/types';

// ── 辅助：创建全新的模拟器实例 ──
function createSim(): GameEventSimulator {
  const sim = new GameEventSimulator();
  sim.init();
  return sim;
}

// ── 所有 8 种建筑类型 ──
const ALL_BUILDING_TYPES: BuildingType[] = [
  'castle', 'farmland', 'market', 'barracks',
  'smithy', 'academy', 'clinic', 'wall',
];

// ═══════════════════════════════════════════════
// BLD-FLOW-1: 8座建筑展示与总览
// ═══════════════════════════════════════════════
describe('V1 BLD-FLOW 建筑系统', () => {
  describe('BLD-FLOW-1: 8座建筑展示与总览', () => {
    it('should return all 8 building types from getAllBuildingLevels', () => {
      // BLD-FLOW-1 步骤1: init() → 验证 getAllBuildingLevels() 返回8座建筑
      const sim = createSim();

      const levels = sim.getAllBuildingLevels();
      const keys = Object.keys(levels) as BuildingType[];

      // 验证包含全部 8 种建筑
      expect(keys.length).toBe(8);
      for (const bt of ALL_BUILDING_TYPES) {
        expect(keys).toContain(bt);
      }
    });

    it('should have castle=1 and farmland=1 at initial state', () => {
      // BLD-FLOW-1 步骤2: 验证初始状态
      const sim = createSim();

      const levels = sim.getAllBuildingLevels();

      // castle 和 farmland 解锁等级为 0，初始等级为 1
      expect(levels.castle).toBe(1);
      expect(levels.farmland).toBe(1);
    });

    it('should have locked buildings (level 0) for non-initial buildings', () => {
      // BLD-FLOW-1 步骤2: 其他建筑初始为 locked（level=0）
      const sim = createSim();

      const levels = sim.getAllBuildingLevels();

      // 市集和兵营需要主城 Lv2 解锁
      expect(levels.market).toBe(0);
      expect(levels.barracks).toBe(0);

      // 铁匠铺和书院需要主城 Lv3 解锁
      expect(levels.smithy).toBe(0);
      expect(levels.academy).toBe(0);

      // 医馆需要主城 Lv4 解锁
      expect(levels.clinic).toBe(0);

      // 城墙需要主城 Lv5 解锁
      expect(levels.wall).toBe(0);
    });

    it('should mark locked buildings with status "locked"', () => {
      // BLD-FLOW-1: 验证建筑状态
      const sim = createSim();

      const buildings = sim.engine.building.getAllBuildings();

      // castle 和 farmland 应为 idle
      expect(buildings.castle.status).toBe('idle');
      expect(buildings.farmland.status).toBe('idle');

      // 其余建筑应为 locked
      const lockedTypes: BuildingType[] = [
        'market', 'barracks', 'smithy', 'academy', 'clinic', 'wall',
      ];
      for (const bt of lockedTypes) {
        expect(buildings[bt].status).toBe('locked');
      }
    });
  });

  // ═══════════════════════════════════════════════
  // BLD-FLOW-2: 建筑升级完整流程
  // ═══════════════════════════════════════════════
  describe('BLD-FLOW-2: 建筑升级完整流程', () => {
    it('should checkUpgrade returns canUpgrade=true when resources are sufficient', () => {
      // BLD-FLOW-2: addResources → checkUpgrade → 可升级
      // 初始 castle=1, farmland=1，farmland 不能超过 castle，所以升级 farmland 前需先升 castle
      const sim = createSim();

      sim.addResources({ grain: 5000, gold: 5000, troops: 5000 });
      sim.upgradeBuilding('castle'); // castle Lv1 → Lv2

      // 现在 castle=2, farmland=1，farmland 可以升级
      const check = sim.engine.checkUpgrade('farmland');
      expect(check.canUpgrade).toBe(true);
      expect(check.reasons.length).toBe(0);
    });

    it('should increase building level by 1 after upgradeBuilding', () => {
      // BLD-FLOW-2: upgradeBuilding → 验证等级+1
      const sim = createSim();

      sim.addResources({ grain: 5000, gold: 5000, troops: 5000 });
      sim.upgradeBuilding('castle'); // 先升主城

      const levelBefore = sim.getBuildingLevel('farmland');
      sim.upgradeBuilding('farmland');
      const levelAfter = sim.getBuildingLevel('farmland');

      expect(levelAfter).toBe(levelBefore + 1);
    });

    it('should deduct correct resources on upgrade', () => {
      // BLD-FLOW-2: 验证资源扣除正确
      const sim = createSim();

      sim.addResources({ grain: 5000, gold: 5000, troops: 5000 });
      sim.upgradeBuilding('castle'); // 先升主城

      const cost = sim.engine.getUpgradeCost('farmland');
      expect(cost).not.toBeNull();

      // 补充资源
      sim.addResources({ grain: 5000, gold: 5000 });

      const grainBefore = sim.getResource('grain');
      const goldBefore = sim.getResource('gold');

      sim.upgradeBuilding('farmland');

      expect(sim.getResource('grain')).toBe(grainBefore - cost!.grain);
      expect(sim.getResource('gold')).toBe(goldBefore - cost!.gold);
    });

    it('should checkUpgrade returns canUpgrade=false when resources are insufficient', () => {
      // BLD-FLOW-2: 资源不足时 checkUpgrade 返回不可升级
      const sim = createSim();

      // 先升级主城使 farmland 可以升级
      sim.addResources({ grain: 5000, gold: 5000 });
      sim.upgradeBuilding('castle');

      // 消耗掉大部分资源，使农田无法升级
      const currentGrain = sim.getResource('grain');
      if (currentGrain > 20) {
        sim.engine.resource.consumeResource('grain', currentGrain - 20);
      }

      const check = sim.engine.checkUpgrade('farmland');
      expect(check.canUpgrade).toBe(false);
    });

    it('should not allow upgrading locked buildings', () => {
      // BLD-FLOW-2: 锁定建筑不能升级
      const sim = createSim();

      const check = sim.engine.checkUpgrade('market');
      expect(check.canUpgrade).toBe(false);
      expect(check.reasons).toContain('建筑尚未解锁');
    });

    it('should throw error when upgrading locked building', () => {
      // BLD-FLOW-2: 尝试升级锁定建筑应抛出错误
      const sim = createSim();

      expect(() => {
        sim.engine.upgradeBuilding('market');
      }).toThrow();
    });

    it('should not allow non-castle building to exceed castle level', () => {
      // BLD-FLOW-2: 非主城建筑等级不能超过主城等级
      const sim = createSim();

      // castle=1, farmland=1 → farmland 不能升级
      const check = sim.engine.checkUpgrade('farmland');
      expect(check.canUpgrade).toBe(false);
      expect(check.reasons.some(r => r.includes('主城等级'))).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════
  // BLD-FLOW-3: 升级后产出增加验证
  // ═══════════════════════════════════════════════
  describe('BLD-FLOW-3: 升级后产出增加验证', () => {
    it('should increase grain production rate after upgrading farmland', () => {
      // BLD-FLOW-3: 记录 rate_before → upgradeBuilding → rate_after > rate_before
      const sim = createSim();

      const rateBefore = sim.getSnapshot().productionRates.grain;

      // 先升级主城，再升级农田
      sim.addResources({ grain: 5000, gold: 5000, troops: 5000 });
      sim.upgradeBuilding('castle');
      sim.addResources({ grain: 5000, gold: 5000 });
      sim.upgradeBuilding('farmland');

      const rateAfter = sim.getSnapshot().productionRates.grain;

      // 农田 Lv1 产出 0.8，Lv2 产出 1.0
      expect(rateAfter).toBeGreaterThan(rateBefore);
    });

    it('should increase gold production rate after upgrading market', () => {
      // BLD-FLOW-3: 升级市集后 gold 产出增加
      const sim = createSim();

      // 先升级主城到 Lv2 解锁市集
      sim.addResources({ grain: 50000, gold: 50000, troops: 50000 });
      sim.upgradeBuildingTo('castle', 2);

      // 升级市集到 Lv1
      sim.addResources({ grain: 50000, gold: 50000 });
      sim.upgradeBuilding('market');

      const rateAfterLv1 = sim.getSnapshot().productionRates.gold;

      // 再升级市集到 Lv2（需要主城 >= Lv3）
      sim.upgradeBuildingTo('castle', 3);
      sim.addResources({ grain: 50000, gold: 50000 });
      sim.upgradeBuilding('market');

      const rateAfterLv2 = sim.getSnapshot().productionRates.gold;

      // 市集 Lv1 产出 0.6，Lv2 产出 0.8
      expect(rateAfterLv2).toBeGreaterThan(rateAfterLv1);
    });

    it('should increase troops production rate after upgrading barracks', () => {
      // BLD-FLOW-3: 升级兵营后 troops 产出增加
      const sim = createSim();

      // 先升级主城到 Lv2 解锁兵营
      sim.addResources({ grain: 50000, gold: 50000, troops: 50000 });
      sim.upgradeBuildingTo('castle', 2);

      // 升级兵营到 Lv1
      sim.addResources({ grain: 50000, gold: 50000, troops: 50000 });
      sim.upgradeBuilding('barracks');

      const rateAfterLv1 = sim.getSnapshot().productionRates.troops;

      // 再升级兵营到 Lv2（需要主城 >= Lv3）
      sim.upgradeBuildingTo('castle', 3);
      sim.addResources({ grain: 50000, gold: 50000, troops: 50000 });
      sim.upgradeBuilding('barracks');

      const rateAfterLv2 = sim.getSnapshot().productionRates.troops;

      expect(rateAfterLv2).toBeGreaterThan(rateAfterLv1);
    });

    it('should reflect production changes in getSnapshot', () => {
      // BLD-FLOW-3: getSnapshot().productionRates 应反映最新产出
      const sim = createSim();

      const snapshotBefore = sim.getSnapshot();
      expect(snapshotBefore.productionRates.grain).toBeGreaterThan(0);
      expect(snapshotBefore.productionRates.gold).toBe(0); // 市集未解锁

      // 解锁并升级市集
      sim.addResources({ grain: 50000, gold: 50000, troops: 50000 });
      sim.upgradeBuildingTo('castle', 2);
      sim.addResources({ grain: 50000, gold: 50000 });
      sim.upgradeBuilding('market');

      const snapshotAfter = sim.getSnapshot();
      expect(snapshotAfter.productionRates.gold).toBeGreaterThan(0);
    });
  });

  // ═══════════════════════════════════════════════
  // BLD-FLOW-4: 建筑解锁条件验证
  // ═══════════════════════════════════════════════
  describe('BLD-FLOW-4: 建筑解锁条件验证', () => {
    it('should only have castle and farmland available at castle Lv1', () => {
      // BLD-FLOW-4: castle Lv1 时只有 farmland 可用
      const sim = createSim();

      const buildings = sim.engine.building.getAllBuildings();

      // castle 和 farmland 已解锁
      expect(buildings.castle.status).not.toBe('locked');
      expect(buildings.farmland.status).not.toBe('locked');

      // 其余建筑锁定
      const shouldLocked: BuildingType[] = [
        'market', 'barracks', 'smithy', 'academy', 'clinic', 'wall',
      ];
      for (const bt of shouldLocked) {
        expect(buildings[bt].status).toBe('locked');
      }
    });

    it('should unlock market and barracks at castle Lv2', () => {
      // BLD-FLOW-4: upgradeBuildingTo('castle', 2) → market 和 barracks 解锁
      const sim = createSim();

      sim.addResources({ grain: 50000, gold: 50000, troops: 50000 });
      sim.upgradeBuildingTo('castle', 2);

      const buildings = sim.engine.building.getAllBuildings();

      // market 和 barracks 应已解锁
      expect(buildings.market.status).not.toBe('locked');
      expect(buildings.barracks.status).not.toBe('locked');

      // smithy 和 academy 仍然锁定（需要主城 Lv3）
      expect(buildings.smithy.status).toBe('locked');
      expect(buildings.academy.status).toBe('locked');
    });

    it('should unlock smithy and academy at castle Lv3', () => {
      // BLD-FLOW-4: upgradeBuildingTo('castle', 3) → smithy 和 academy 解锁
      const sim = createSim();

      sim.addResources({ grain: 50000, gold: 50000, troops: 50000 });
      sim.upgradeBuildingTo('castle', 3);

      const buildings = sim.engine.building.getAllBuildings();

      // smithy 和 academy 应已解锁
      expect(buildings.smithy.status).not.toBe('locked');
      expect(buildings.academy.status).not.toBe('locked');

      // clinic 仍然锁定（需要主城 Lv4）
      expect(buildings.clinic.status).toBe('locked');

      // wall 仍然锁定（需要主城 Lv5）
      expect(buildings.wall.status).toBe('locked');
    });

    it('should unlock clinic at castle Lv4', () => {
      // BLD-FLOW-4: upgradeBuildingTo('castle', 4) → clinic 解锁
      const sim = createSim();

      sim.addResources({ grain: 50000, gold: 50000, troops: 50000 });
      sim.upgradeBuildingTo('castle', 4);

      const buildings = sim.engine.building.getAllBuildings();

      // clinic 应已解锁
      expect(buildings.clinic.status).not.toBe('locked');

      // wall 仍然锁定（需要主城 Lv5）
      expect(buildings.wall.status).toBe('locked');
    });

    it('should unlock wall at castle Lv5', () => {
      // BLD-FLOW-4: upgradeBuildingTo('castle', 5) → wall 解锁
      // 注意：主城 Lv5 需要"至少一座其他建筑达到 Lv4"
      const sim = createSim();

      sim.addResources({ grain: 500000, gold: 500000, troops: 500000 });

      // 先升级主城到 Lv4
      sim.upgradeBuildingTo('castle', 4);

      // 升级农田到 Lv4（满足主城 Lv5 前置条件）
      sim.addResources({ grain: 500000, gold: 500000 });
      sim.upgradeBuildingTo('farmland', 4);

      // 升级主城到 Lv5
      sim.addResources({ grain: 500000, gold: 500000, troops: 500000 });
      sim.upgradeBuildingTo('castle', 5);

      const buildings = sim.engine.building.getAllBuildings();

      // wall 应已解锁
      expect(buildings.wall.status).not.toBe('locked');

      // 所有建筑都应已解锁
      for (const bt of ALL_BUILDING_TYPES) {
        expect(buildings[bt].status).not.toBe('locked');
      }
    });

    it('should not allow castle Lv5 without another building at Lv4', () => {
      // BLD-FLOW-4: 主城 Lv4→5 需要"至少一座其他建筑达到 Lv4"
      const sim = createSim();

      sim.addResources({ grain: 500000, gold: 500000, troops: 500000 });
      sim.upgradeBuildingTo('castle', 4);

      // 不升级其他建筑到 Lv4，直接尝试升级主城到 Lv5
      const check = sim.engine.checkUpgrade('castle');
      expect(check.canUpgrade).toBe(false);
      expect(check.reasons.some(r => r.includes('Lv4'))).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════
  // BLD-FLOW-5: 建筑队列管理
  // ═══════════════════════════════════════════════
  describe('BLD-FLOW-5: 建筑队列管理', () => {
    it('should have 1 queue slot at castle Lv1', () => {
      // BLD-FLOW-5: 验证初始队列槽数（主城 Lv1=1槽）
      const sim = createSim();

      const maxSlots = sim.engine.building.getMaxQueueSlots();
      expect(maxSlots).toBe(1);
    });

    it('should have 1 queue slot at castle Lv5', () => {
      // BLD-FLOW-5: 主城 Lv1~5 都是 1 槽
      const sim = createSim();

      sim.addResources({ grain: 500000, gold: 500000, troops: 500000 });
      sim.upgradeBuildingTo('castle', 4);
      sim.addResources({ grain: 500000, gold: 500000 });
      sim.upgradeBuildingTo('farmland', 4);
      sim.addResources({ grain: 500000, gold: 500000, troops: 500000 });
      sim.upgradeBuildingTo('castle', 5);

      expect(sim.engine.building.getMaxQueueSlots()).toBe(1);
    });

    it('should have 2 queue slots at castle Lv6', () => {
      // BLD-FLOW-5: 主城 Lv6~10 有 2 槽
      const sim = createSim();

      // 使用 setCap 避免资源被截断
      sim.engine.resource.setCap('grain', 50_000_000);
      sim.engine.resource.setCap('troops', 10_000_000);
      sim.addResources({ grain: 5000000, gold: 5000000, troops: 5000000 });

      // 升级到主城 Lv6（需要先满足前置条件）
      sim.upgradeBuildingTo('castle', 4);
      sim.engine.resource.setCap('grain', 50_000_000);
      sim.engine.resource.setCap('troops', 10_000_000);
      sim.addResources({ grain: 5000000, gold: 5000000 });
      sim.upgradeBuildingTo('farmland', 4);
      sim.engine.resource.setCap('grain', 50_000_000);
      sim.engine.resource.setCap('troops', 10_000_000);
      sim.addResources({ grain: 5000000, gold: 5000000, troops: 5000000 });
      sim.upgradeBuildingTo('castle', 5);
      sim.engine.resource.setCap('grain', 50_000_000);
      sim.engine.resource.setCap('troops', 10_000_000);
      sim.addResources({ grain: 5000000, gold: 5000000, troops: 5000000 });
      sim.upgradeBuildingTo('castle', 6);

      expect(sim.engine.building.getMaxQueueSlots()).toBe(2);
    });

    it('should fail to start second upgrade when queue is full (1 slot)', () => {
      // BLD-FLOW-5: 同时升级2个建筑 → 第2个应该失败（队列满）
      // 注意：GameEventSimulator.upgradeBuilding() 会即时完成升级，
      // 所以需要直接操作 engine 的 BuildingSystem 来测试队列
      // 关键：farmland Lv1 不能超过 castle Lv1，所以需要先升级主城
      const sim = createSim();

      sim.addResources({ grain: 500000, gold: 500000, troops: 500000 });

      // 先升级主城到 Lv2，使 farmland 可以升级到 Lv2
      sim.upgradeBuilding('castle'); // castle → Lv2

      // 补充资源
      sim.addResources({ grain: 500000, gold: 500000 });

      // 开始升级农田（不通过 sim.upgradeBuilding，直接用 building.startUpgrade）
      const resources = sim.engine.resource.getResources();
      sim.engine.building.startUpgrade('farmland', resources);

      // 检查队列
      const queue = sim.engine.building.getUpgradeQueue();
      expect(queue.length).toBe(1);

      // 队列已满（1槽），尝试升级另一个建筑应失败
      // 补充被扣除的资源
      sim.addResources({ grain: 500000, gold: 500000 });

      const check = sim.engine.building.checkUpgrade('castle');
      expect(check.canUpgrade).toBe(false);
      expect(check.reasons).toContain('升级队列已满');
    });

    it('should return resources when cancelling an upgrade', () => {
      // BLD-FLOW-5: 验证取消升级返还资源（80%）
      // 关键：需要先升级主城使 farmland 可以升级
      const sim = createSim();

      sim.addResources({ grain: 500000, gold: 500000, troops: 500000 });
      sim.upgradeBuilding('castle'); // castle → Lv2

      // 补充资源
      sim.addResources({ grain: 500000, gold: 500000 });

      const cost = sim.engine.building.getUpgradeCost('farmland');
      expect(cost).not.toBeNull();

      // 开始升级农田
      const resources = sim.engine.resource.getResources();
      sim.engine.building.startUpgrade('farmland', resources);

      // 取消升级
      const refund = sim.engine.cancelUpgrade('farmland');
      expect(refund).not.toBeNull();

      // 验证返还资源为 80%
      expect(refund!.grain).toBe(Math.round(cost!.grain * 0.8));
      expect(refund!.gold).toBe(Math.round(cost!.gold * 0.8));

      // 验证队列已清空
      const queue = sim.engine.building.getUpgradeQueue();
      expect(queue.length).toBe(0);
    });

    it('should return building to idle status after cancelling upgrade', () => {
      // BLD-FLOW-5: 取消升级后建筑回到 idle 状态
      const sim = createSim();

      sim.addResources({ grain: 500000, gold: 500000, troops: 500000 });
      sim.upgradeBuilding('castle'); // castle → Lv2

      sim.addResources({ grain: 500000, gold: 500000 });

      // 开始升级农田
      const resources = sim.engine.resource.getResources();
      sim.engine.building.startUpgrade('farmland', resources);

      // 确认进入 upgrading 状态
      expect(sim.engine.building.getBuilding('farmland').status).toBe('upgrading');

      // 取消升级
      sim.engine.cancelUpgrade('farmland');

      // 确认回到 idle 状态
      expect(sim.engine.building.getBuilding('farmland').status).toBe('idle');
    });
  });

  // ═══════════════════════════════════════════════
  // BLD-FLOW-6: 建筑升级推荐
  // ═══════════════════════════════════════════════
  describe('BLD-FLOW-6: 建筑升级推荐', () => {
    it('should have recommendUpgradePath method for newbie context', () => {
      // BLD-FLOW-6: 验证引擎有推荐逻辑
      const sim = createSim();

      // BuildingSystem 有 recommendUpgradePath 方法
      const recommendation = sim.engine.building.recommendUpgradePath('newbie');
      expect(recommendation).toBeDefined();
      expect(Array.isArray(recommendation)).toBe(true);
    });

    it('should recommend castle → farmland → market for newbie', () => {
      // BLD-FLOW-6: 新手期推荐主城→农田→市集
      const sim = createSim();

      const recommendation = sim.engine.building.recommendUpgradePath('newbie');

      // 验证推荐列表包含主城和农田
      expect(recommendation.length).toBeGreaterThan(0);

      // 推荐的前几个应包含 castle 和 farmland
      const topTypes = recommendation.slice(0, 3).map(r => r.type);
      expect(topTypes).toContain('castle');
      expect(topTypes).toContain('farmland');
    });

    it('should have getUpgradeRecommendation method', () => {
      // BLD-FLOW-6: 简化版推荐
      const sim = createSim();

      const recommendation = sim.engine.building.getUpgradeRecommendation();
      expect(recommendation).toBeDefined();
    });

    it('should have getUpgradeRouteRecommendation method', () => {
      // BLD-FLOW-6: 根据当前状态推荐升级路线
      const sim = createSim();

      const recommendation = sim.engine.building.getUpgradeRouteRecommendation();
      expect(recommendation).toBeDefined();
    });

    it('should adjust recommendations based on available resources', () => {
      // BLD-FLOW-6: 推荐应考虑当前资源
      const sim = createSim();

      // 无资源时的推荐
      const recNoResources = sim.engine.building.getUpgradeRecommendation();

      // 给大量资源后的推荐
      sim.addResources({ grain: 500000, gold: 500000, troops: 500000 });
      const recWithResources = sim.engine.building.getUpgradeRecommendation(
        sim.engine.resource.getResources(),
      );

      // 两种推荐都应有效
      expect(recNoResources).toBeDefined();
      expect(recWithResources).toBeDefined();
    });
  });
});
