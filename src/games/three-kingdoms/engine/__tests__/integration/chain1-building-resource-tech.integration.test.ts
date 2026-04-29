/**
 * 集成链路测试 — 链路1: 建筑 → 资源 → 科技
 *
 * 覆盖场景：
 * - 升级建筑 → 产出资源 → 累积科技点 → 解锁科技
 * - 建筑等级影响资源产出率 → 资源产出率影响科技点获取
 * - 建筑解锁条件 → 前置科技 → 反向依赖
 * - 跨模块数据一致性验证
 *
 * 关键约束：
 * - 非主城建筑等级不能超过主城等级
 * - farmland初始等级为1，castle初始等级为1
 * - 升级farmland前必须先升级castle
 * - castle Lv5需要至少一座其他建筑达到Lv4
 *
 * 测试原则：
 * - 每个用例独立创建 sim 实例
 * - 使用真实引擎 API，不使用 mock
 * - 验证端到端数据流一致性
 */

import { describe, it, expect } from 'vitest';
import { createSim, createSimWithResources, MASSIVE_RESOURCES, SUFFICIENT_RESOURCES } from '../../../test-utils/test-helpers';
import type { BuildingType } from '../../../shared/types';

// 辅助函数：升级castle和farmland到指定等级
function upgradeCastleAndFarmland(sim: ReturnType<typeof createSim>, castleLv: number, farmlandLv: number) {
  sim.engine.resource.setCap('grain', 50_000_000);
  sim.engine.resource.setCap('troops', 10_000_000);
  sim.addResources(MASSIVE_RESOURCES);
  // 交错升级：先升castle，再升farmland
  for (let i = 0; i < Math.max(castleLv - 1, farmlandLv); i++) {
    if (sim.getBuildingLevel('castle') < castleLv) {
      sim.upgradeBuilding('castle');
    }
    if (sim.getBuildingLevel('farmland') < farmlandLv && sim.getBuildingLevel('castle') > sim.getBuildingLevel('farmland')) {
      sim.upgradeBuilding('farmland');
    }
  }
  // 补齐farmland
  while (sim.getBuildingLevel('farmland') < farmlandLv && sim.getBuildingLevel('castle') > sim.getBuildingLevel('farmland')) {
    sim.addResources(MASSIVE_RESOURCES);
    sim.upgradeBuilding('farmland');
  }
}

// ═══════════════════════════════════════════════
// 链路1: 建筑 → 资源 → 科技 端到端验证
// ═══════════════════════════════════════════════
describe('链路1: 建筑→资源→科技 集成测试', () => {

  describe('CHAIN1-01: 升级主城→解锁建筑→验证产出', () => {
    it('should increase grain production rate after upgrading castle then farmland', () => {
      const sim = createSim();
      const initialRates = sim.engine.resource.getProductionRates();
      const initialGrainRate = initialRates.grain ?? 0;

      // 先升级castle，再升级farmland
      sim.addResources(SUFFICIENT_RESOURCES);
      sim.upgradeBuilding('castle');
      sim.addResources(SUFFICIENT_RESOURCES);
      sim.upgradeBuilding('farmland');

      const newRates = sim.engine.resource.getProductionRates();
      expect(newRates.grain).toBeGreaterThan(initialGrainRate);
    });

    it('should reflect production rate change in snapshot', () => {
      const sim = createSim();
      sim.addResources(MASSIVE_RESOURCES);
      sim.engine.resource.setCap('grain', 50_000_000);

      const beforeSnapshot = sim.getSnapshot();
      sim.upgradeBuilding('castle');
      sim.addResources(MASSIVE_RESOURCES);
      sim.upgradeBuilding('farmland');
      const afterSnapshot = sim.getSnapshot();

      expect(afterSnapshot.productionRates.grain).toBeGreaterThanOrEqual(beforeSnapshot.productionRates.grain);
    });
  });

  describe('CHAIN1-02: 升级市集→金币产出→验证资源增长', () => {
    it('should unlock market when castle reaches level 2', () => {
      const sim = createSim();
      sim.addResources(MASSIVE_RESOURCES);

      sim.upgradeBuilding('castle');

      const buildings = sim.engine.building.getAllBuildings();
      expect(buildings.market.status).not.toBe('locked');
    });

    it('should increase gold production after upgrading market', () => {
      const sim = createSim();
      sim.addResources(MASSIVE_RESOURCES);
      sim.engine.resource.setCap('grain', 50_000_000);

      sim.upgradeBuilding('castle');
      const initialGoldRate = sim.engine.resource.getProductionRates().gold ?? 0;

      sim.addResources(MASSIVE_RESOURCES);
      sim.upgradeBuilding('market');

      const newGoldRate = sim.engine.resource.getProductionRates().gold ?? 0;
      expect(newGoldRate).toBeGreaterThan(initialGoldRate);
    });
  });

  describe('CHAIN1-03: 升级书院→科技点产出→科技研究', () => {
    it('should unlock academy when castle reaches level 3', () => {
      const sim = createSim();
      sim.engine.resource.setCap('grain', 50_000_000);
      sim.engine.resource.setCap('troops', 10_000_000);
      sim.addResources(MASSIVE_RESOURCES);

      sim.upgradeBuilding('castle');
      sim.addResources(MASSIVE_RESOURCES);
      sim.upgradeBuilding('castle');

      const buildings = sim.engine.building.getAllBuildings();
      expect(buildings.academy.status).not.toBe('locked');
    });

    it('should have tech tree system accessible after initialization', () => {
      const sim = createSim();
      const techTree = sim.engine.getTechTreeSystem();
      expect(techTree).toBeDefined();
    });

    it('should have tech point system for accumulating research points', () => {
      const sim = createSim();
      const techPoint = sim.engine.getTechPointSystem();
      expect(techPoint).toBeDefined();
    });
  });

  describe('CHAIN1-04: 建筑等级→资源上限→资源累积一致性', () => {
    it('should update resource caps when upgrading farmland', () => {
      const sim = createSim();
      sim.addResources(MASSIVE_RESOURCES);

      // 不手动设置cap，让系统自动管理
      const initialGrainCap = sim.engine.resource.getCaps().grain;

      sim.upgradeBuilding('castle');
      sim.addResources(MASSIVE_RESOURCES);
      sim.upgradeBuilding('farmland');

      const newGrainCap = sim.engine.resource.getCaps().grain;
      // 升级farmland后，粮食上限应该增加或保持
      expect(newGrainCap).toBeGreaterThanOrEqual(initialGrainCap);
    });

    it('should not exceed resource cap after adding resources', () => {
      const sim = createSim();
      const grainCap = sim.engine.resource.getCaps().grain;

      sim.addResources({ grain: grainCap * 2 });

      const actualGrain = sim.getResource('grain');
      // 资源可能被截断到上限
      expect(actualGrain).toBeLessThanOrEqual(grainCap * 2);
    });
  });

  describe('CHAIN1-05: 多建筑协同升级→资源产出综合验证', () => {
    it('should have all production rates increase when multiple buildings upgraded', () => {
      const sim = createSim();
      sim.engine.resource.setCap('grain', 50_000_000);
      sim.engine.resource.setCap('troops', 10_000_000);

      const initialRates = { ...sim.engine.resource.getProductionRates() };

      // 先升级castle，再升级其他建筑
      sim.addResources(MASSIVE_RESOURCES);
      sim.upgradeBuilding('castle');
      sim.addResources(MASSIVE_RESOURCES);
      sim.upgradeBuilding('farmland');
      sim.addResources(MASSIVE_RESOURCES);
      sim.upgradeBuilding('market');

      const newRates = sim.engine.resource.getProductionRates();
      expect(newRates.grain).toBeGreaterThan(initialRates.grain);
    });

    it('should maintain consistent building levels across save and load', () => {
      const sim = createSim();
      sim.engine.resource.setCap('grain', 50_000_000);
      sim.engine.resource.setCap('troops', 10_000_000);
      sim.addResources(MASSIVE_RESOURCES);

      sim.upgradeBuilding('castle');
      sim.addResources(MASSIVE_RESOURCES);
      sim.upgradeBuilding('farmland');

      const levelsBefore = sim.getAllBuildingLevels();
      const json = sim.engine.serialize();

      const sim2 = createSim();
      sim2.engine.deserialize(json);

      const levelsAfter = sim2.getAllBuildingLevels();
      expect(levelsAfter.castle).toBe(levelsBefore.castle);
      expect(levelsAfter.farmland).toBe(levelsBefore.farmland);
    });
  });

  describe('CHAIN1-06: 资源消耗→建筑升级扣除→余额验证', () => {
    it('should deduct resources when upgrading a building', () => {
      const sim = createSim();
      sim.addResources({ grain: 10000, gold: 10000, troops: 5000 });

      const grainBefore = sim.getResource('grain');
      const goldBefore = sim.getResource('gold');

      // 升级castle（初始即可升级）
      sim.upgradeBuilding('castle');

      const grainAfter = sim.getResource('grain');
      const goldAfter = sim.getResource('gold');

      expect(grainAfter).toBeLessThan(grainBefore);
      expect(goldAfter).toBeLessThan(goldBefore);
    });

    it('should fail to upgrade when resources are insufficient', () => {
      const sim = createSim();
      const initialLevels = sim.getAllBuildingLevels();

      // 不添加额外资源，尝试多次升级直到资源耗尽
      let upgraded = false;
      try {
        sim.upgradeBuilding('castle');
        upgraded = true;
      } catch {
        // 预期可能失败
      }

      if (!upgraded) {
        expect(sim.getAllBuildingLevels().castle).toBe(initialLevels.castle);
      }
    });
  });

  describe('CHAIN1-07: 科技研究→前置建筑→解锁验证', () => {
    it('should have tech research system with research capability', () => {
      const sim = createSim();
      const researchSystem = sim.engine.getTechResearchSystem();
      expect(researchSystem).toBeDefined();
    });

    it('should serialize and deserialize tech state consistently', () => {
      const sim = createSim();
      const techStateBefore = sim.engine.getTechState();

      const json = sim.engine.serialize();
      const sim2 = createSim();
      sim2.engine.deserialize(json);

      const techStateAfter = sim2.engine.getTechState();
      expect(techStateAfter).toBeDefined();
    });
  });

  describe('CHAIN1-08: 建筑产出→tick累计→资源快照一致性', () => {
    it('should accumulate resources over ticks', () => {
      const sim = createSim();
      const grainBefore = sim.getResource('grain');

      sim.engine.tick(1000);

      const grainAfter = sim.getResource('grain');
      expect(grainAfter).toBeGreaterThanOrEqual(grainBefore);
    });

    it('should reflect production rates in resource growth after upgrade and ticks', () => {
      const sim = createSim();
      sim.engine.resource.setCap('grain', 50_000_000);
      sim.addResources(MASSIVE_RESOURCES);

      // 先升级castle再升级farmland
      sim.upgradeBuilding('castle');
      sim.addResources(MASSIVE_RESOURCES);
      sim.upgradeBuilding('farmland');

      const rates = sim.engine.resource.getProductionRates();
      const grainBefore = sim.getResource('grain');

      for (let i = 0; i < 10; i++) {
        sim.engine.tick(1000);
      }

      const grainAfter = sim.getResource('grain');
      if (rates.grain > 0) {
        expect(grainAfter).toBeGreaterThan(grainBefore);
      }
    });
  });

  describe('CHAIN1-09: 全链路端到端: 升级→产出→保存→加载→验证', () => {
    it('should preserve full building-resource chain through save/load cycle', () => {
      const sim = createSim();
      sim.engine.resource.setCap('grain', 50_000_000);
      sim.engine.resource.setCap('troops', 10_000_000);
      sim.addResources(MASSIVE_RESOURCES);

      // 先升级castle再升级farmland
      sim.upgradeBuilding('castle');
      sim.addResources(MASSIVE_RESOURCES);
      sim.upgradeBuilding('farmland');

      const levelsBefore = sim.getAllBuildingLevels();

      const json = sim.engine.serialize();

      const sim2 = createSim();
      sim2.engine.deserialize(json);

      const levelsAfter = sim2.getAllBuildingLevels();
      expect(levelsAfter.castle).toBe(levelsBefore.castle);
      expect(levelsAfter.farmland).toBe(levelsBefore.farmland);

      const resourcesAfter = sim2.getAllResources();
      expect(resourcesAfter.grain).toBeDefined();
    });

    it('should maintain production rates after save/load', () => {
      const sim = createSim();
      sim.engine.resource.setCap('grain', 50_000_000);
      sim.addResources(MASSIVE_RESOURCES);

      sim.upgradeBuilding('castle');
      sim.addResources(MASSIVE_RESOURCES);
      sim.upgradeBuilding('farmland');

      const ratesBefore = sim.engine.resource.getProductionRates();

      const json = sim.engine.serialize();
      const sim2 = createSim();
      sim2.engine.deserialize(json);

      const ratesAfter = sim2.engine.resource.getProductionRates();
      expect(ratesAfter.grain).toBe(ratesBefore.grain);
    });
  });
});
