/**
 * 端到端验证 + 交叉验证 Play 流程集成测试 (v1.0 E2E-FLOW-1~2 + CROSS-FLOW-1~3)
 *
 * 覆盖范围：
 * - E2E-FLOW-1: 完整游戏循环
 * - E2E-FLOW-2: 30秒可理解性验证
 * - CROSS-FLOW-1: 建筑升级→资源产出→UI刷新
 * - CROSS-FLOW-2: 主城升级→建筑解锁→新建筑可升级
 * - CROSS-FLOW-3: 自动保存→刷新→数据恢复
 *
 * 测试原则：
 * - 每个用例创建独立的 sim 实例
 * - 使用真实引擎 API，不使用 mock
 * - 以实际代码行为为准
 *
 * 关键约束：
 * - 非主城建筑等级不能超过主城等级（初始 castle=1, farmland=1）
 * - 升级 farmland 前必须先升级 castle
 */

import { describe, it, expect } from 'vitest';
import { createSim } from '../../../test-utils/test-helpers';
import { GameEventSimulator } from '../../../test-utils/GameEventSimulator';
import type { BuildingType } from '../../../shared/types';

/**
 * 辅助：升级 castle 后再升级 farmland
 * 因为 farmland 等级不能超过 castle 等级
 */
function upgradeFarmlandWithCastle(sim: GameEventSimulator): void {
  sim.addResources({ grain: 100000, gold: 100000 });
  sim.upgradeBuilding('castle');
  sim.upgradeBuilding('farmland');
}

// ═══════════════════════════════════════════════
// V1 E2E-FLOW 端到端验证
// ═══════════════════════════════════════════════
describe('V1 E2E-FLOW 端到端验证', () => {

  // ═══════════════════════════════════════════════
  // E2E-FLOW-1: 完整游戏循环
  // ═══════════════════════════════════════════════
  describe('E2E-FLOW-1: 完整游戏循环', () => {
    it('should complete full game loop: init → tick → upgrade → verify', () => {
      // E2E-FLOW-1: 完整游戏循环验证
      const sim = createSim();

      // 步骤1: 验证初始资源
      expect(sim.getResource('grain')).toBe(500);
      expect(sim.getResource('gold')).toBe(300);
      expect(sim.getResource('troops')).toBe(50);
      expect(sim.getResource('mandate')).toBe(0);

      // 步骤2: fastForwardSeconds(60) → 验证资源增长
      const grainBefore = sim.getResource('grain');
      sim.fastForwardSeconds(60);
      const grainAfter = sim.getResource('grain');
      expect(grainAfter).toBeGreaterThan(grainBefore);

      // 步骤3: upgradeBuilding('farmland') → 验证升级成功
      // 注意：farmland初始为Lv1，castle初始为Lv1，需要先升级castle
      sim.addResources({ grain: 10000, gold: 10000 });
      sim.upgradeBuilding('castle'); // castle → Lv2
      const farmlandBefore = sim.getBuildingLevel('farmland');
      sim.upgradeBuilding('farmland'); // farmland → Lv2
      expect(sim.getBuildingLevel('farmland')).toBe(farmlandBefore + 1);

      // 步骤4: upgradeBuildingTo('castle', 2) 已经完成
      expect(sim.getBuildingLevel('castle')).toBe(2);

      // 验证解锁 market/barracks — 可以 checkUpgrade
      const checkMarket = sim.engine.checkUpgrade('market');
      expect(checkMarket).toBeDefined();
    });

    it('should unlock market and barracks at castle level 2', () => {
      // E2E-FLOW-1 步骤4: 验证 castle=2 解锁 market/barracks
      const sim = createSim();
      sim.addResources({ grain: 100000, gold: 100000 });

      sim.upgradeBuildingTo('castle', 2);

      // 升级 market
      sim.upgradeBuilding('market');
      expect(sim.getBuildingLevel('market')).toBeGreaterThan(0);

      // 升级 barracks
      sim.upgradeBuilding('barracks');
      expect(sim.getBuildingLevel('barracks')).toBeGreaterThan(0);
    });

    it('should increase gold production after upgrading market', () => {
      // E2E-FLOW-1 步骤5: upgradeBuilding('market') → gold产出增加
      const sim = createSim();
      sim.addResources({ grain: 100000, gold: 100000 });

      // 先升级主城到2解锁market
      sim.upgradeBuildingTo('castle', 2);

      const goldRateBefore = sim.engine.resource.getProductionRates().gold;
      sim.upgradeBuilding('market');
      const goldRateAfter = sim.engine.resource.getProductionRates().gold;

      expect(goldRateAfter).toBeGreaterThan(goldRateBefore);
    });

    it('should unlock smithy and academy at castle level 3', () => {
      // E2E-FLOW-1 步骤6: upgradeBuildingTo('castle', 3) → 解锁 smithy/academy
      const sim = createSim();
      sim.addResources({ grain: 1000000, gold: 1000000 });

      // 升级到 castle 3
      sim.upgradeBuildingTo('castle', 3);
      expect(sim.getBuildingLevel('castle')).toBe(3);

      // 升级 smithy
      sim.upgradeBuilding('smithy');
      expect(sim.getBuildingLevel('smithy')).toBeGreaterThan(0);

      // 升级 academy
      sim.upgradeBuilding('academy');
      expect(sim.getBuildingLevel('academy')).toBeGreaterThan(0);
    });
  });

  // ═══════════════════════════════════════════════
  // E2E-FLOW-2: 30秒可理解性验证
  // ═══════════════════════════════════════════════
  describe('E2E-FLOW-2: 30秒可理解性验证', () => {
    it('should auto-grow resources after init', () => {
      // E2E-FLOW-2: init()后资源自动增长
      const sim = createSim();

      const grainBefore = sim.getResource('grain');
      sim.fastForwardSeconds(30);
      const grainAfter = sim.getResource('grain');

      expect(grainAfter).toBeGreaterThan(grainBefore);
    });

    it('should increase production after building upgrade', () => {
      // E2E-FLOW-2: 升级建筑后产出增加
      const sim = createSim();
      sim.addResources({ grain: 100000, gold: 100000 });

      const ratesBefore = sim.engine.resource.getProductionRates();
      // 先升级castle再升级farmland
      sim.upgradeBuilding('castle');
      sim.upgradeBuilding('farmland');
      const ratesAfter = sim.engine.resource.getProductionRates();

      // 农田升级后粮草产出应增加
      expect(ratesAfter.grain).toBeGreaterThan(ratesBefore.grain);
    });

    it('should demonstrate the core loop: upgrade → produce → upgrade', () => {
      // E2E-FLOW-2: 循环逻辑：建筑升级→产出增加→更多资源→更多升级
      const sim = createSim();
      sim.addResources({ grain: 500000, gold: 500000 });

      // 第一次升级：先castle再farmland
      const rate1 = sim.engine.resource.getProductionRates().grain;
      sim.upgradeBuilding('castle');
      sim.upgradeBuilding('farmland');
      const rate2 = sim.engine.resource.getProductionRates().grain;
      expect(rate2).toBeGreaterThan(rate1);

      // 快进积累资源
      sim.fastForwardSeconds(60);
      const grainAfterGrowth = sim.getResource('grain');
      expect(grainAfterGrowth).toBeGreaterThan(0);

      // 第二次升级
      sim.addResources({ grain: 500000, gold: 500000 });
      sim.upgradeBuilding('castle');
      sim.upgradeBuilding('farmland');
      const rate3 = sim.engine.resource.getProductionRates().grain;
      expect(rate3).toBeGreaterThan(rate2);
    });
  });
});

// ═══════════════════════════════════════════════
// V1 CROSS-FLOW 交叉验证
// ═══════════════════════════════════════════════
describe('V1 CROSS-FLOW 交叉验证', () => {

  // ═══════════════════════════════════════════════
  // CROSS-FLOW-1: 建筑升级→资源产出→UI刷新
  // ═══════════════════════════════════════════════
  describe('CROSS-FLOW-1: 建筑升级→资源产出→UI刷新', () => {
    it('should increase production rate after farmland upgrade', () => {
      // CROSS-FLOW-1: 记录产出 → upgradeBuilding('farmland') → 验证产出增加
      const sim = createSim();
      sim.addResources({ grain: 100000, gold: 100000 });

      // 记录升级前产出
      const ratesBefore = sim.engine.resource.getProductionRates();
      const grainRateBefore = ratesBefore.grain;

      // 先升级castle再升级farmland
      sim.upgradeBuilding('castle');
      sim.upgradeBuilding('farmland');

      // 验证产出增加
      const ratesAfter = sim.engine.resource.getProductionRates();
      expect(ratesAfter.grain).toBeGreaterThan(grainRateBefore);
    });

    it('should reflect production change in getSnapshot', () => {
      // CROSS-FLOW-1: 验证getSnapshot()反映变化
      const sim = createSim();
      sim.addResources({ grain: 100000, gold: 100000 });

      const snapshotBefore = sim.getSnapshot();
      const grainRateBefore = snapshotBefore.productionRates.grain;

      sim.upgradeBuilding('castle');
      sim.upgradeBuilding('farmland');

      const snapshotAfter = sim.getSnapshot();
      expect(snapshotAfter.productionRates.grain).toBeGreaterThan(grainRateBefore);
    });

    it('should accumulate more resources with higher production rate', () => {
      // CROSS-FLOW-1: 产出增加后资源积累更快
      const sim1 = createSim();
      const sim2 = createSim();

      // sim2 升级castle+farmland，sim1 保持原样
      sim2.addResources({ grain: 100000, gold: 100000 });
      sim2.upgradeBuilding('castle');
      sim2.upgradeBuilding('farmland');

      // 两个都快进相同时间
      sim1.fastForwardSeconds(60);
      sim2.fastForwardSeconds(60);

      // sim2 应该积累更多粮草
      const grain1 = sim1.getResource('grain');
      const grain2 = sim2.getResource('grain');
      expect(grain2).toBeGreaterThan(grain1);
    });
  });

  // ═══════════════════════════════════════════════
  // CROSS-FLOW-2: 主城升级→建筑解锁→新建筑可升级
  // ═══════════════════════════════════════════════
  describe('CROSS-FLOW-2: 主城升级→建筑解锁→新建筑可升级', () => {
    it('should unlock market and barracks at castle level 2', () => {
      // CROSS-FLOW-2: upgradeBuildingTo('castle', 2) → market/barracks解锁
      const sim = createSim();
      sim.addResources({ grain: 100000, gold: 100000 });

      // 初始状态 market/barracks 为 0（锁定）
      expect(sim.getBuildingLevel('market')).toBe(0);
      expect(sim.getBuildingLevel('barracks')).toBe(0);

      // 升级主城到2
      sim.upgradeBuildingTo('castle', 2);
      expect(sim.getBuildingLevel('castle')).toBe(2);

      // market/barracks 应该可以升级了
      sim.upgradeBuilding('market');
      expect(sim.getBuildingLevel('market')).toBeGreaterThan(0);

      sim.upgradeBuilding('barracks');
      expect(sim.getBuildingLevel('barracks')).toBeGreaterThan(0);
    });

    it('should allow market upgrade after castle reaches level 2', () => {
      // CROSS-FLOW-2: 验证 market 在 castle=2 后可升级
      const sim = createSim();
      sim.addResources({ grain: 100000, gold: 100000 });

      sim.upgradeBuildingTo('castle', 2);

      // 直接升级 market 应该成功
      const marketLevelBefore = sim.getBuildingLevel('market');
      sim.upgradeBuilding('market');
      expect(sim.getBuildingLevel('market')).toBe(marketLevelBefore + 1);
    });

    it('should unlock higher tier buildings at castle level 3', () => {
      // CROSS-FLOW-2: castle=3 解锁更多建筑
      const sim = createSim();
      sim.addResources({ grain: 1000000, gold: 1000000 });

      sim.upgradeBuildingTo('castle', 3);

      // smithy 和 academy 应该可以升级
      sim.upgradeBuilding('smithy');
      expect(sim.getBuildingLevel('smithy')).toBeGreaterThan(0);

      sim.upgradeBuilding('academy');
      expect(sim.getBuildingLevel('academy')).toBeGreaterThan(0);
    });
  });

  // ═══════════════════════════════════════════════
  // CROSS-FLOW-3: 自动保存→刷新→数据恢复
  // ═══════════════════════════════════════════════
  describe('CROSS-FLOW-3: 自动保存→刷新→数据恢复', () => {
    it('should save and restore state via save/load cycle', () => {
      // CROSS-FLOW-3: 操作引擎 → save() → 记录状态 → 新引擎 load() → 验证状态恢复
      // 注意：reset() 会调用 deleteSave() 清除 localStorage，所以用新引擎来 load
      const sim = createSim();
      sim.addResources({ grain: 100000, gold: 100000 });
      sim.upgradeBuilding('castle');
      sim.upgradeBuilding('farmland');

      // 记录状态
      const farmlandLevel = sim.getBuildingLevel('farmland');
      const castleLevel = sim.getBuildingLevel('castle');

      // 保存到 localStorage
      sim.engine.save();
      expect(sim.engine.hasSaveData()).toBe(true);

      // 使用新引擎加载（避免 reset() 删除存档）
      const sim2 = new GameEventSimulator();
      const offlineEarnings = sim2.engine.load();

      // 验证加载成功
      expect(offlineEarnings).toBeDefined();

      // 验证状态恢复
      expect(sim2.getBuildingLevel('farmland')).toBe(farmlandLevel);
      expect(sim2.getBuildingLevel('castle')).toBe(castleLevel);

      // 清理
      sim.reset();
    });

    it('should save and restore via serialize/deserialize cycle', () => {
      // CROSS-FLOW-3: serialize → reset → deserialize → 验证
      const sim = createSim();
      sim.addResources({ grain: 100000, gold: 100000 });
      sim.upgradeBuilding('castle');
      sim.upgradeBuilding('farmland');

      // 记录状态
      const farmlandLevel = sim.getBuildingLevel('farmland');
      const castleLevel = sim.getBuildingLevel('castle');

      // 序列化
      const json = sim.engine.serialize();
      expect(typeof json).toBe('string');

      // 重置
      sim.reset();

      // 反序列化
      sim.engine.deserialize(json);

      // 验证恢复
      expect(sim.getBuildingLevel('farmland')).toBe(farmlandLevel);
      expect(sim.getBuildingLevel('castle')).toBe(castleLevel);
    });

    it('should preserve production rates after save/restore', () => {
      // CROSS-FLOW-3: 验证产出速率在存档恢复后正确
      const sim = createSim();
      sim.addResources({ grain: 100000, gold: 100000 });
      sim.upgradeBuilding('castle');
      sim.upgradeBuilding('farmland');

      const ratesBefore = sim.engine.resource.getProductionRates();
      const json = sim.engine.serialize();

      sim.reset();
      sim.engine.deserialize(json);

      const ratesAfter = sim.engine.resource.getProductionRates();
      expect(ratesAfter.grain).toBeCloseTo(ratesBefore.grain, 3);
    });

    it('should handle multiple save/restore cycles without data loss', () => {
      // CROSS-FLOW-3: 多次存档/恢复循环不会丢失数据
      const sim = createSim();
      sim.addResources({ grain: 100000, gold: 100000 });

      // 第一次循环：升级castle+farmland
      sim.upgradeBuilding('castle');
      sim.upgradeBuilding('farmland');
      const json1 = sim.engine.serialize();
      const farmlandLevel1 = sim.getBuildingLevel('farmland');

      sim.reset();
      sim.engine.deserialize(json1);
      expect(sim.getBuildingLevel('farmland')).toBe(farmlandLevel1);

      // 第二次循环（在恢复的基础上继续操作）
      sim.addResources({ grain: 100000, gold: 100000 });
      sim.upgradeBuilding('castle');
      sim.upgradeBuilding('farmland');
      const farmlandLevel2 = sim.getBuildingLevel('farmland');
      const json2 = sim.engine.serialize();

      sim.reset();
      sim.engine.deserialize(json2);
      expect(sim.getBuildingLevel('farmland')).toBe(farmlandLevel2);
      expect(sim.getBuildingLevel('farmland')).toBeGreaterThan(farmlandLevel1);
    });
  });
});
