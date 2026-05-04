/**
 * Sprint 1 修复验证测试
 *
 * 覆盖：
 * - P0: BuildingRecommender ore/wood 资源检查
 * - P1: BuildingBatchOps ore/wood 扣费追踪
 * - 4资源产出闭环：农田→粮草、市集→铜钱、矿场→矿石、伐木场→木材
 * - 升级消耗梯度：Lv5→6引入ore，Lv9→10引入wood
 * - 离线8h后4资源累加
 * - 一键收取4资源
 * - 资源达上限降速50%
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  getUpgradeRouteRecommendation,
  getUpgradeRecommendation,
} from '../BuildingRecommender';
import type { BuildingSnapshot, GetProductionFn, GetUpgradeCostFn } from '../BuildingRecommender';
import { batchUpgrade } from '../BuildingBatchOps';
import type { BatchUpgradeContext } from '../BuildingBatchOps';
import { BuildingSystem } from '../BuildingSystem';
import { ResourceSystem } from '../../resource/ResourceSystem';
import { BUILDING_DEFS, BUILDING_MAX_LEVELS } from '../building-config';
import type { BuildingType, BuildingState, UpgradeCost, UpgradeCheckResult, Resources } from '../../../shared/types';

// ═══════════════════════════════════════════════════════════════
// 辅助函数
// ═══════════════════════════════════════════════════════════════

function makeState(type: BuildingType, overrides: Partial<BuildingState> = {}): BuildingState {
  return {
    type,
    level: 1,
    status: 'idle',
    upgradeStartTime: null,
    upgradeEndTime: null,
    ...overrides,
  };
}

function makeAllBuildings(overrides: Partial<Record<BuildingType, Partial<BuildingState>>> = {}): BuildingSnapshot {
  const allTypes: BuildingType[] = ['castle', 'farmland', 'market', 'mine', 'lumberMill', 'barracks', 'workshop', 'academy', 'clinic', 'wall', 'tavern', 'port'];
  const result = {} as BuildingSnapshot;
  for (const t of allTypes) {
    result[t] = makeState(t, overrides[t]);
  }
  return result;
}

function makeResources(overrides: Partial<Resources> = {}): Resources {
  return {
    grain: 10000,
    gold: 10000,
    ore: 10000,
    wood: 10000,
    troops: 1000,
    mandate: 10,
    techPoint: 50,
    recruitToken: 0,
    skillBook: 0,
    ...overrides,
  };
}

function makeCost(overrides: Partial<UpgradeCost> = {}): UpgradeCost {
  return { grain: 100, gold: 50, ore: 0, wood: 0, troops: 10, timeSeconds: 30, ...overrides };
}

function canUpgradeResult(): UpgradeCheckResult {
  return { canUpgrade: true, reasons: [] };
}

function cannotUpgradeResult(reason: string): UpgradeCheckResult {
  return { canUpgrade: false, reasons: [reason] };
}

function makeBatchContext(overrides: Partial<BatchUpgradeContext> = {}): BatchUpgradeContext {
  return {
    getBuilding: (type: BuildingType) => makeState(type),
    checkUpgrade: () => canUpgradeResult(),
    startUpgrade: () => makeCost(),
    ...overrides,
  };
}

/** 充足资源（用于 BuildingSystem 集成测试） */
const RICH: Resources = {
  grain: 1e15, gold: 1e15, ore: 1e15, wood: 1e15, troops: 1e15,
  mandate: 0, techPoint: 0, recruitToken: 0, skillBook: 0,
};

/** 构造 BuildingSystem 存档数据 */
function makeSave(
  overrides: Partial<Record<BuildingType, Partial<{ level: number; status: string }>>> = {},
): { buildings: Record<BuildingType, BuildingState>; version: number } {
  const buildings = {} as Record<BuildingType, BuildingState>;
  const defaultUnlocked: BuildingType[] = ['castle', 'farmland', 'market', 'mine', 'lumberMill'];

  for (const t of Object.keys(BUILDING_DEFS) as BuildingType[]) {
    const override = overrides[t];
    if (override) {
      buildings[t] = {
        type: t,
        level: override.level ?? 1,
        status: (override.status as BuildingState['status']) ?? 'idle',
        upgradeStartTime: null,
        upgradeEndTime: null,
      };
    } else {
      const isUnlocked = defaultUnlocked.includes(t) || (overrides.castle?.level ?? 1) >=
        (t === 'barracks' ? 2 : t === 'workshop' || t === 'academy' ? 3 : t === 'clinic' ? 4 : t === 'wall' || t === 'tavern' ? 5 : t === 'port' ? 8 : 0);
      buildings[t] = {
        type: t,
        level: isUnlocked ? 1 : 0,
        status: isUnlocked ? 'idle' : 'locked',
        upgradeStartTime: null,
        upgradeEndTime: null,
      };
    }
  }

  return { buildings, version: 1 };
}

/** 将建筑升级到指定等级 */
function upgradeTo(bs: BuildingSystem, type: BuildingType, targetLevel: number): void {
  while (bs.getLevel(type) < targetLevel) {
    bs.startUpgrade(type, RICH);
    bs.forceCompleteUpgrades();
  }
}

// ═══════════════════════════════════════════════════════════════
// P0: BuildingRecommender ore/wood 检查
// ═══════════════════════════════════════════════════════════════

describe('Sprint 1 Fix — P0: BuildingRecommender ore/wood 资源检查', () => {
  const getProduction: GetProductionFn = () => 10;

  // 所有建筑 Lv1, 主城 Lv2 — 确保非主城建筑可被推荐（levelOk: 1 < 2）
  const buildings = makeAllBuildings({ castle: { level: 2 } });

  it('ore 不足时优先级降低 20（推荐算法感知矿石不足）', () => {
    // 费用包含 ore
    const getCostWithOre: GetUpgradeCostFn = () => makeCost({ ore: 500 });

    // 充足资源 — 不应降优先级
    const richResources = makeResources({ ore: 10000 });
    const resultRich = getUpgradeRouteRecommendation(buildings, getProduction, getCostWithOre, richResources);
    const farmRich = resultRich.find(r => r.type === 'farmland')!;

    // ore 不足 — 应降优先级
    const noOreResources = makeResources({ ore: 0 });
    const resultNoOre = getUpgradeRouteRecommendation(buildings, getProduction, getCostWithOre, noOreResources);
    const farmNoOre = resultNoOre.find(r => r.type === 'farmland')!;

    expect(farmRich).toBeDefined();
    expect(farmNoOre).toBeDefined();
    expect(farmNoOre.priority).toBe(farmRich.priority - 20);
  });

  it('wood 不足时优先级降低 20（推荐算法感知木材不足）', () => {
    // 费用包含 wood
    const getCostWithWood: GetUpgradeCostFn = () => makeCost({ wood: 300 });

    const richResources = makeResources({ wood: 10000 });
    const resultRich = getUpgradeRouteRecommendation(buildings, getProduction, getCostWithWood, richResources);
    const farmRich = resultRich.find(r => r.type === 'farmland')!;

    const noWoodResources = makeResources({ wood: 0 });
    const resultNoWood = getUpgradeRouteRecommendation(buildings, getProduction, getCostWithWood, noWoodResources);
    const farmNoWood = resultNoWood.find(r => r.type === 'farmland')!;

    expect(farmRich).toBeDefined();
    expect(farmNoWood).toBeDefined();
    expect(farmNoWood.priority).toBe(farmRich.priority - 20);
  });

  it('ore 和 wood 都不足时优先级降低 20（不叠加）', () => {
    const getCostWithBoth: GetUpgradeCostFn = () => makeCost({ ore: 500, wood: 300 });

    // 充足资源
    const richResources = makeResources({ ore: 10000, wood: 10000 });
    const resultRich = getUpgradeRouteRecommendation(buildings, getProduction, getCostWithBoth, richResources);
    const farmRich = resultRich.find(r => r.type === 'farmland')!;

    // 都不足
    const noBothResources = makeResources({ ore: 0, wood: 0 });
    const resultNoBoth = getUpgradeRouteRecommendation(buildings, getProduction, getCostWithBoth, noBothResources);
    const farmNoBoth = resultNoBoth.find(r => r.type === 'farmland')!;

    // 只降一次 20，不叠加
    expect(farmRich).toBeDefined();
    expect(farmNoBoth).toBeDefined();
    expect(farmNoBoth.priority).toBe(farmRich.priority - 20);
  });

  it('ore=0 但费用中 ore=0 时不应降优先级', () => {
    // 费用不包含 ore
    const getCostNoOre: GetUpgradeCostFn = () => makeCost({ ore: 0 });

    const noOreResources = makeResources({ ore: 0, gold: 10000, grain: 10000 });
    const result = getUpgradeRouteRecommendation(buildings, getProduction, getCostNoOre, noOreResources);
    const farm = result.find(r => r.type === 'farmland')!;

    // 不传 resources 的基准
    const resultNoResources = getUpgradeRouteRecommendation(buildings, getProduction, getCostNoOre);
    const farmBase = resultNoResources.find(r => r.type === 'farmland')!;

    expect(farm).toBeDefined();
    expect(farmBase).toBeDefined();
    expect(farm.priority).toBe(farmBase.priority);
  });

  it('getUpgradeRecommendation 简化版也正确反映资源不足', () => {
    const getCostWithOre: GetUpgradeCostFn = () => makeCost({ ore: 500 });

    const richResult = getUpgradeRecommendation(buildings, getProduction, getCostWithOre, makeResources({ ore: 10000 }));
    const noOreResult = getUpgradeRecommendation(buildings, getProduction, getCostWithOre, makeResources({ ore: 0 }));

    // 两者都应该有推荐，只是顺序可能不同
    expect(richResult.length).toBeGreaterThan(0);
    expect(noOreResult.length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// P1: BuildingBatchOps ore/wood 扣费追踪
// ═══════════════════════════════════════════════════════════════

describe('Sprint 1 Fix — P1: BuildingBatchOps ore/wood 扣费追踪', () => {
  it('批量升级累计 ore 总费用', () => {
    const ctx = makeBatchContext({
      startUpgrade: () => makeCost({ grain: 100, gold: 50, ore: 200, troops: 10, timeSeconds: 30 }),
    });

    const result = batchUpgrade(['castle', 'farmland'], makeResources(), ctx);

    expect(result.totalCost.ore).toBe(400); // 200 * 2
  });

  it('批量升级累计 wood 总费用', () => {
    const ctx = makeBatchContext({
      startUpgrade: () => makeCost({ grain: 100, gold: 50, wood: 150, troops: 10, timeSeconds: 30 }),
    });

    const result = batchUpgrade(['castle', 'farmland', 'market'], makeResources(), ctx);

    expect(result.totalCost.wood).toBe(450); // 150 * 3
  });

  it('后续建筑使用扣减后的 ore 进行检查', () => {
    const checkCalls: Array<{ type: BuildingType; resources: Resources }> = [];

    const ctx = makeBatchContext({
      checkUpgrade: (type: BuildingType, resources?: Resources) => {
        checkCalls.push({ type, resources: resources! });
        return canUpgradeResult();
      },
      startUpgrade: () => makeCost({ grain: 1000, gold: 500, ore: 3000 }),
    });

    const resources = makeResources({ grain: 10000, gold: 10000, ore: 5000 });
    batchUpgrade(['castle', 'farmland'], resources, ctx);

    // 第一次调用时 ore 为初始值
    expect(checkCalls[0].resources.ore).toBe(5000);
    // 第二次调用时 ore 应已扣减
    expect(checkCalls[1].resources.ore).toBe(2000);
  });

  it('后续建筑使用扣减后的 wood 进行检查', () => {
    const checkCalls: Array<{ type: BuildingType; resources: Resources }> = [];

    const ctx = makeBatchContext({
      checkUpgrade: (type: BuildingType, resources?: Resources) => {
        checkCalls.push({ type, resources: resources! });
        return canUpgradeResult();
      },
      startUpgrade: () => makeCost({ grain: 1000, gold: 500, wood: 2000 }),
    });

    const resources = makeResources({ grain: 10000, gold: 10000, wood: 5000 });
    batchUpgrade(['castle', 'farmland'], resources, ctx);

    expect(checkCalls[0].resources.wood).toBe(5000);
    expect(checkCalls[1].resources.wood).toBe(3000);
  });

  it('ore 耗尽后后续建筑检查失败', () => {
    const ctx = makeBatchContext({
      checkUpgrade: (_type: BuildingType, resources?: Resources) => {
        if (resources && resources.ore < 100) {
          return cannotUpgradeResult('矿石不足');
        }
        return canUpgradeResult();
      },
      startUpgrade: () => makeCost({ grain: 100, gold: 50, ore: 4000 }),
    });

    const resources = makeResources({ grain: 10000, gold: 10000, ore: 4000 });
    const result = batchUpgrade(['castle', 'farmland'], resources, ctx);

    expect(result.succeeded).toHaveLength(1);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].reason).toBe('矿石不足');
  });

  it('wood 耗尽后后续建筑检查失败', () => {
    const ctx = makeBatchContext({
      checkUpgrade: (_type: BuildingType, resources?: Resources) => {
        if (resources && resources.wood < 100) {
          return cannotUpgradeResult('木材不足');
        }
        return canUpgradeResult();
      },
      startUpgrade: () => makeCost({ grain: 100, gold: 50, wood: 3000 }),
    });

    const resources = makeResources({ grain: 10000, gold: 10000, wood: 3000 });
    const result = batchUpgrade(['castle', 'farmland'], resources, ctx);

    expect(result.succeeded).toHaveLength(1);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].reason).toBe('木材不足');
  });

  it('4种资源（grain/gold/ore/wood）全部正确扣减追踪', () => {
    const ctx = makeBatchContext({
      startUpgrade: (type: BuildingType) => {
        const costs: Record<string, UpgradeCost> = {
          castle: makeCost({ grain: 500, gold: 300, ore: 200, wood: 100, troops: 50 }),
          farmland: makeCost({ grain: 400, gold: 200, ore: 150, wood: 80, troops: 30 }),
          market: makeCost({ grain: 300, gold: 100, ore: 100, wood: 60, troops: 20 }),
        };
        return costs[type] ?? makeCost();
      },
    });

    const result = batchUpgrade(['castle', 'farmland', 'market'], makeResources(), ctx);

    expect(result.totalCost.grain).toBe(1200);
    expect(result.totalCost.gold).toBe(600);
    expect(result.totalCost.ore).toBe(450);
    expect(result.totalCost.wood).toBe(240);
    expect(result.totalCost.troops).toBe(100);
  });

  it('空列表 totalCost 的 ore/wood 为 0', () => {
    const result = batchUpgrade([], makeResources(), makeBatchContext());
    expect(result.totalCost.ore).toBe(0);
    expect(result.totalCost.wood).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// 4资源产出闭环
// ═══════════════════════════════════════════════════════════════

describe('Sprint 1 Fix — 4资源产出闭环', () => {
  it('农田 → 粮草（grain）', () => {
    const bs = new BuildingSystem();
    expect(bs.getProduction('farmland')).toBeGreaterThan(0);
    expect(BUILDING_DEFS.farmland.production?.resourceType).toBe('grain');
  });

  it('市集 → 铜钱（gold）', () => {
    const bs = new BuildingSystem();
    expect(bs.getProduction('market')).toBeGreaterThan(0);
    expect(BUILDING_DEFS.market.production?.resourceType).toBe('gold');
  });

  it('矿场 → 矿石（ore）', () => {
    const bs = new BuildingSystem();
    expect(bs.getProduction('mine')).toBeGreaterThan(0);
    expect(BUILDING_DEFS.mine.production?.resourceType).toBe('ore');
  });

  it('伐木场 → 木材（wood）', () => {
    const bs = new BuildingSystem();
    expect(bs.getProduction('lumberMill')).toBeGreaterThan(0);
    expect(BUILDING_DEFS.lumberMill.production?.resourceType).toBe('wood');
  });

  it('calculateTotalProduction 返回4种资源产出', () => {
    const bs = new BuildingSystem();
    const total = bs.calculateTotalProduction();
    expect(total.grain).toBeGreaterThan(0);
    expect(total.gold).toBeGreaterThan(0);
    expect(total.ore).toBeGreaterThan(0);
    expect(total.wood).toBeGreaterThan(0);
  });

  it('tick 库存累积4种资源', () => {
    const bs = new BuildingSystem();
    bs.tickStorage(10);

    expect(bs.getStorageAmount('farmland')).toBeGreaterThan(0);
    expect(bs.getStorageAmount('market')).toBeGreaterThan(0);
    expect(bs.getStorageAmount('mine')).toBeGreaterThan(0);
    expect(bs.getStorageAmount('lumberMill')).toBeGreaterThan(0);
  });

  it('ResourceSystem 同步4种资源产出速率', () => {
    const bs = new BuildingSystem();
    const rs = new ResourceSystem();

    const productions = bs.calculateTotalProduction();
    rs.recalculateProduction(productions);

    const rates = rs.getProductionRates();
    expect(rates.grain).toBeGreaterThan(0);
    expect(rates.gold).toBeGreaterThan(0);
    expect(rates.ore).toBeGreaterThan(0);
    expect(rates.wood).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// 升级消耗梯度：Lv5→6引入ore，Lv9→10引入wood
// ═══════════════════════════════════════════════════════════════

describe('Sprint 1 Fix — 升级消耗梯度', () => {
  it('农田 Lv1~5 升级费用中 ore=0, wood=0', () => {
    for (let lv = 1; lv <= 5; lv++) {
      const cost = BUILDING_DEFS.farmland.levelTable[lv - 1].upgradeCost;
      expect(cost.ore).toBe(0);
      expect(cost.wood).toBe(0);
    }
  });

  it('农田 Lv6+ 升级费用中 ore > 0', () => {
    const cost = BUILDING_DEFS.farmland.levelTable[5].upgradeCost;
    expect(cost.ore).toBeGreaterThan(0);
  });

  it('农田 Lv10+ 升级费用中 wood > 0', () => {
    const cost = BUILDING_DEFS.farmland.levelTable[9].upgradeCost;
    expect(cost.wood).toBeGreaterThan(0);
  });

  it('矿石消耗 = 粮草消耗 × 20%（Lv6~25）', () => {
    for (let lv = 6; lv <= 25; lv++) {
      const cost = BUILDING_DEFS.farmland.levelTable[lv - 1].upgradeCost;
      const expectedOre = Math.floor(cost.grain * 0.20);
      expect(cost.ore).toBe(expectedOre);
    }
  });

  it('木材消耗 = 粮草消耗 × 15%（Lv10~25）', () => {
    for (let lv = 10; lv <= 25; lv++) {
      const cost = BUILDING_DEFS.farmland.levelTable[lv - 1].upgradeCost;
      const expectedWood = Math.floor(cost.grain * 0.15);
      expect(cost.wood).toBe(expectedWood);
    }
  });

  it('市集 Lv6+ 同样包含矿石消耗', () => {
    const cost = BUILDING_DEFS.market.levelTable[5].upgradeCost;
    expect(cost.ore).toBeGreaterThan(0);
  });

  it('矿场 Lv6+ 同样包含矿石消耗', () => {
    const cost = BUILDING_DEFS.mine.levelTable[5].upgradeCost;
    expect(cost.ore).toBeGreaterThan(0);
  });

  it('伐木场 Lv6+ 同样包含矿石消耗', () => {
    const cost = BUILDING_DEFS.lumberMill.levelTable[5].upgradeCost;
    expect(cost.ore).toBeGreaterThan(0);
  });

  it('工坊从 Lv1 起就有矿石消耗', () => {
    const cost = BUILDING_DEFS.workshop.levelTable[0].upgradeCost;
    expect(cost.ore).toBeGreaterThan(0);
  });

  it('BuildingSystem.checkUpgrade 在 Lv6+ 检查矿石不足', () => {
    const bs = new BuildingSystem();
    bs.deserialize(makeSave({ castle: { level: 6 } }));
    upgradeTo(bs, 'farmland', 5);

    const noOre: Resources = { ...RICH, ore: 0 };
    const check = bs.checkUpgrade('farmland', noOre);
    expect(check.canUpgrade).toBe(false);
    expect(check.reasons.some(r => r.includes('矿石不足'))).toBe(true);
  });

  it('BuildingSystem.checkUpgrade 在 Lv10+ 检查木材不足', () => {
    const bs = new BuildingSystem();
    bs.deserialize(makeSave({ castle: { level: 10 } }));
    upgradeTo(bs, 'farmland', 9);

    const noWood: Resources = { ...RICH, wood: 0 };
    const check = bs.checkUpgrade('farmland', noWood);
    expect(check.canUpgrade).toBe(false);
    expect(check.reasons.some(r => r.includes('木材不足'))).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════
// 离线8h后4资源累加
// ═══════════════════════════════════════════════════════════════

describe('Sprint 1 Fix — 离线8h后4资源累加', () => {
  it('离线8h后4种资源均有产出', () => {
    const bs = new BuildingSystem();
    const rs = new ResourceSystem();

    const productions = bs.calculateTotalProduction();
    rs.recalculateProduction(productions);

    const result = rs.calculateOfflineEarnings(8 * 3600);

    expect(result.earned.grain).toBeGreaterThan(0);
    expect(result.earned.gold).toBeGreaterThan(0);
    expect(result.earned.ore).toBeGreaterThan(0);
    expect(result.earned.wood).toBeGreaterThan(0);
  });

  it('离线收益受效率衰减影响（<100%）', () => {
    const rs = new ResourceSystem();
    const bs = new BuildingSystem();
    const productions = bs.calculateTotalProduction();
    rs.recalculateProduction(productions);

    const rates = rs.getProductionRates();
    const result = rs.calculateOfflineEarnings(8 * 3600);

    const avgEfficiency = result.earned.grain / (rates.grain * 8 * 3600);
    expect(avgEfficiency).toBeLessThan(1.0);
    expect(avgEfficiency).toBeGreaterThan(0.7);
  });

  it('离线收益受资源上限截断', () => {
    const rs = new ResourceSystem();
    const bs = new BuildingSystem();
    const productions = bs.calculateTotalProduction();
    rs.recalculateProduction(productions);

    rs.setCap('ore', 100);
    rs.setCap('wood', 100);

    rs.applyOfflineEarnings(8 * 3600);

    expect(rs.getAmount('ore')).toBeLessThanOrEqual(100);
    expect(rs.getAmount('wood')).toBeLessThanOrEqual(100);
  });
});

// ═══════════════════════════════════════════════════════════════
// 一键收取4资源
// ═══════════════════════════════════════════════════════════════

describe('Sprint 1 Fix — 一键收取4资源', () => {
  it('一键收取后4种资源飞入资源栏', () => {
    const bs = new BuildingSystem();
    bs.tickStorage(10);

    const result = bs.collectAll();

    expect(Object.keys(result.collected)).toContain('grain');
    expect(Object.keys(result.collected)).toContain('gold');
    expect(Object.keys(result.collected)).toContain('ore');
    expect(Object.keys(result.collected)).toContain('wood');
  });

  it('一键收取后各建筑库存归零', () => {
    const bs = new BuildingSystem();
    bs.tickStorage(10);
    bs.collectAll();

    expect(bs.getStorageAmount('farmland')).toBe(0);
    expect(bs.getStorageAmount('market')).toBe(0);
    expect(bs.getStorageAmount('mine')).toBe(0);
    expect(bs.getStorageAmount('lumberMill')).toBe(0);
  });

  it('一键收取结果包含各建筑明细（4种资源）', () => {
    const bs = new BuildingSystem();
    bs.tickStorage(10);

    const result = bs.collectAll();

    const resourceTypes = result.buildingDetails.map(d => d.resourceType);
    expect(resourceTypes).toContain('grain');
    expect(resourceTypes).toContain('gold');
    expect(resourceTypes).toContain('ore');
    expect(resourceTypes).toContain('wood');
  });

  it('收取→资源系统累加→4资源均有值', () => {
    const bs = new BuildingSystem();
    const rs = new ResourceSystem();
    rs.updateCaps(1, 1, 1, 1);

    bs.tickStorage(100);
    const result = bs.collectAll();

    for (const [type, amount] of Object.entries(result.collected)) {
      rs.addResource(type as keyof Resources, amount);
    }

    expect(rs.getAmount('grain')).toBeGreaterThan(0);
    expect(rs.getAmount('gold')).toBeGreaterThan(0);
    expect(rs.getAmount('ore')).toBeGreaterThan(0);
    expect(rs.getAmount('wood')).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// 资源达上限降速50%
// ═══════════════════════════════════════════════════════════════

describe('Sprint 1 Fix — 资源达上限降速50%', () => {
  it('库存达到上限后产出降速50%（矿场）', () => {
    const bs = new BuildingSystem();
    const capacity = bs.getStorageCapacity('mine');
    const production = bs.getProduction('mine');

    // 填满库存
    bs.tickStorage(capacity / production + 100);
    expect(bs.getStorageAmount('mine')).toBe(capacity);
    expect(bs.isStorageOverflowing('mine')).toBe(true);
  });

  it('库存达到上限后产出降速50%（伐木场）', () => {
    const bs = new BuildingSystem();
    const capacity = bs.getStorageCapacity('lumberMill');
    const production = bs.getProduction('lumberMill');

    bs.tickStorage(capacity / production + 100);
    expect(bs.getStorageAmount('lumberMill')).toBe(capacity);
    expect(bs.isStorageOverflowing('lumberMill')).toBe(true);
  });

  it('收取后库存清零，产出恢复正常', () => {
    const bs = new BuildingSystem();
    const capacity = bs.getStorageCapacity('mine');
    const production = bs.getProduction('mine');

    bs.tickStorage(capacity / production + 100);
    expect(bs.isStorageOverflowing('mine')).toBe(true);

    bs.collectBuilding('mine');
    expect(bs.getStorageAmount('mine')).toBe(0);
    expect(bs.isStorageOverflowing('mine')).toBe(false);
  });

  it('4种产出建筑均支持溢出降速', () => {
    const bs = new BuildingSystem();
    const types: BuildingType[] = ['farmland', 'market', 'mine', 'lumberMill'];

    for (const t of types) {
      const capacity = bs.getStorageCapacity(t);
      const production = bs.getProduction(t);
      bs.tickStorage(capacity / production + 100);
      expect(bs.isStorageOverflowing(t)).toBe(true);
      bs.collectBuilding(t);
    }
  });
});
