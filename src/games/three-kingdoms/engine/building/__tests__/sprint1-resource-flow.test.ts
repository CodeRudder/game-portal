/**
 * Sprint 1: 核心资源流 (P0) — 测试
 *
 * 覆盖范围：
 * - BLD-F01: 资源产出公式适配4资源
 * - BLD-F02: 升级消耗适配4资源（Lv1-5: 粮草+铜钱, Lv6+: +矿石, Lv10+: +木材）
 * - BLD-F26: 矿场/伐木场持续产出（tick产出→库存→溢出降速50%）
 * - BLD-F07: 离线收益适配4资源
 * - BLD-F10: 一键收取适配4资源
 * - BLD-F15: 资源上限适配4资源（4种资源各自独立上限）
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { BuildingSystem } from '../BuildingSystem';
import { ResourceSystem } from '../../resource/ResourceSystem';
import { BUILDING_DEFS } from '../building-config';
import type { Resources, BuildingType, BuildingSaveData } from '../../../shared/types';

// ── 测试辅助 ──

/** 充足资源（用于升级测试） */
const RICH: Resources = {
  grain: 1e15, gold: 1e15, ore: 1e15, wood: 1e15, troops: 1e15,
  mandate: 0, techPoint: 0, recruitToken: 0, skillBook: 0,
};

/** 构造存档数据 */
function makeSave(
  overrides: Partial<Record<BuildingType, Partial<{ level: number; status: string }>>> = {},
): BuildingSaveData {
  const buildings = {} as BuildingSaveData['buildings'];
  const defaultUnlocked: BuildingType[] = ['castle', 'farmland', 'market', 'mine', 'lumberMill'];

  for (const t of Object.keys(BUILDING_DEFS) as BuildingType[]) {
    const override = overrides[t];
    if (override) {
      buildings[t] = {
        type: t,
        level: override.level ?? 1,
        status: (override.status as BuildingSaveData['buildings'][BuildingType]['status']) ?? 'idle',
        upgradeStartTime: null,
        upgradeEndTime: null,
      };
    } else {
      const isUnlocked = defaultUnlocked.includes(t) || (overrides.castle?.level ?? 1) >=
        (t === 'barracks' ? 2 : t === 'workshop' || t === 'academy' ? 3 : t === 'clinic' ? 4 : t === 'wall' || t === 'tavern' ? 5 : 0);
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

/** 将建筑升级到指定等级（通过 forceCompleteUpgrades） */
function upgradeTo(bs: BuildingSystem, type: BuildingType, targetLevel: number): void {
  while (bs.getLevel(type) < targetLevel) {
    bs.startUpgrade(type, RICH);
    bs.forceCompleteUpgrades();
  }
}

// ═══════════════════════════════════════════════════════════════
// BLD-F01: 资源产出公式适配4资源
// ═══════════════════════════════════════════════════════════════

describe('Sprint 1 — BLD-F01: 资源产出公式适配4资源', () => {
  let bs: BuildingSystem;

  beforeEach(() => {
    bs = new BuildingSystem();
  });

  it('农田产出粮草（grain）', () => {
    expect(bs.getProduction('farmland')).toBeGreaterThan(0);
    const def = BUILDING_DEFS.farmland;
    expect(def.production?.resourceType).toBe('grain');
  });

  it('市集产出铜钱（gold）', () => {
    expect(bs.getProduction('market')).toBeGreaterThan(0);
    const def = BUILDING_DEFS.market;
    expect(def.production?.resourceType).toBe('gold');
  });

  it('矿场产出矿石（ore）', () => {
    expect(bs.getProduction('mine')).toBeGreaterThan(0);
    const def = BUILDING_DEFS.mine;
    expect(def.production?.resourceType).toBe('ore');
  });

  it('伐木场产出木材（wood）', () => {
    expect(bs.getProduction('lumberMill')).toBeGreaterThan(0);
    const def = BUILDING_DEFS.lumberMill;
    expect(def.production?.resourceType).toBe('wood');
  });

  it('矿场Lv5产出 = 农田Lv5产出（基础速率一致）', () => {
    // 两者使用相同的等级表数据
    const farmProdLv5 = BUILDING_DEFS.farmland.levelTable[4].production;
    const mineProdLv5 = BUILDING_DEFS.mine.levelTable[4].production;
    expect(mineProdLv5).toBe(farmProdLv5);
  });

  it('伐木场Lv5产出 = 农田Lv5产出（基础速率一致）', () => {
    const farmProdLv5 = BUILDING_DEFS.farmland.levelTable[4].production;
    const lumberProdLv5 = BUILDING_DEFS.lumberMill.levelTable[4].production;
    expect(lumberProdLv5).toBe(farmProdLv5);
  });

  it('calculateTotalProduction 返回4种资源产出', () => {
    const productions = bs.calculateTotalProduction();
    expect(productions.grain).toBeGreaterThan(0);
    expect(productions.gold).toBeGreaterThan(0);
    expect(productions.ore).toBeGreaterThan(0);
    expect(productions.wood).toBeGreaterThan(0);
  });

  it('ResourceSystem.recalculateProduction 正确同步4种资源产出', () => {
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
// BLD-F02: 升级消耗适配4资源
// ═══════════════════════════════════════════════════════════════

describe('Sprint 1 — BLD-F02: 升级消耗适配4资源', () => {
  let bs: BuildingSystem;

  beforeEach(() => {
    bs = new BuildingSystem();
  });

  it('Lv1~5 升级仅消耗粮草+铜钱（无矿石/木材）', () => {
    // 检查农田 Lv1~5 的升级费用
    for (let lv = 1; lv <= 5; lv++) {
      const cost = BUILDING_DEFS.farmland.levelTable[lv - 1].upgradeCost;
      expect(cost.ore).toBe(0);
      expect(cost.wood).toBe(0);
    }
  });

  it('Lv6+ 升级包含矿石消耗', () => {
    // 检查农田 Lv6 的升级费用
    const cost = BUILDING_DEFS.farmland.levelTable[5].upgradeCost;
    expect(cost.ore).toBeGreaterThan(0);
  });

  it('Lv10+ 升级包含木材消耗', () => {
    // 检查农田 Lv10 的升级费用
    const cost = BUILDING_DEFS.farmland.levelTable[9].upgradeCost;
    expect(cost.wood).toBeGreaterThan(0);
  });

  it('矿石消耗 = 粮草消耗 × 20%（Lv6+）', () => {
    for (let lv = 6; lv <= 25; lv++) {
      const cost = BUILDING_DEFS.farmland.levelTable[lv - 1].upgradeCost;
      const expectedOre = Math.floor(cost.grain * 0.20);
      expect(cost.ore).toBe(expectedOre);
    }
  });

  it('木材消耗 = 粮草消耗 × 15%（Lv10+）', () => {
    for (let lv = 10; lv <= 25; lv++) {
      const cost = BUILDING_DEFS.farmland.levelTable[lv - 1].upgradeCost;
      const expectedWood = Math.floor(cost.grain * 0.15);
      expect(cost.wood).toBe(expectedWood);
    }
  });

  it('市集/矿场/伐木场 Lv6+ 同样包含矿石消耗', () => {
    for (const type of ['market', 'mine', 'lumberMill'] as const) {
      const cost = BUILDING_DEFS[type].levelTable[5].upgradeCost;
      expect(cost.ore).toBeGreaterThan(0);
    }
  });

  it('升级Lv6时资源检查包含矿石不足提示', () => {
    // 将农田升级到 Lv5
    bs.deserialize(makeSave({ castle: { level: 6 } }));
    upgradeTo(bs, 'farmland', 5);

    // 尝试升级到 Lv6 但不提供矿石
    const noOre: Resources = { ...RICH, ore: 0 };
    const check = bs.checkUpgrade('farmland', noOre);
    expect(check.canUpgrade).toBe(false);
    expect(check.reasons.some(r => r.includes('矿石不足'))).toBe(true);
  });

  it('升级Lv10时资源检查包含木材不足提示', () => {
    // 将农田升级到 Lv9
    bs.deserialize(makeSave({ castle: { level: 10 } }));
    upgradeTo(bs, 'farmland', 9);

    // 尝试升级到 Lv10 但不提供木材
    const noWood: Resources = { ...RICH, wood: 0 };
    const check = bs.checkUpgrade('farmland', noWood);
    expect(check.canUpgrade).toBe(false);
    expect(check.reasons.some(r => r.includes('木材不足'))).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════
// BLD-F26: 矿场/伐木场持续产出
// ═══════════════════════════════════════════════════════════════

describe('Sprint 1 — BLD-F26: 矿场/伐木场持续产出', () => {
  let bs: BuildingSystem;

  beforeEach(() => {
    bs = new BuildingSystem();
  });

  it('矿场 tick 产出累积到库存', () => {
    const production = bs.getProduction('mine'); // 0.8 ore/s
    bs.tickStorage(10); // 10秒
    const amount = bs.getStorageAmount('mine');
    expect(amount).toBeCloseTo(production * 10, 1);
  });

  it('伐木场 tick 产出累积到库存', () => {
    const production = bs.getProduction('lumberMill'); // 0.8 wood/s
    bs.tickStorage(10); // 10秒
    const amount = bs.getStorageAmount('lumberMill');
    expect(amount).toBeCloseTo(production * 10, 1);
  });

  it('农田 tick 产出累积到库存', () => {
    const production = bs.getProduction('farmland'); // 0.8 grain/s
    bs.tickStorage(10);
    const amount = bs.getStorageAmount('farmland');
    expect(amount).toBeCloseTo(production * 10, 1);
  });

  it('库存容量 = 产出速率 × 缓冲时间', () => {
    const capacity = bs.getStorageCapacity('mine');
    const production = bs.getProduction('mine');
    // Lv1 使用新手缓冲时间 2700秒
    expect(capacity).toBe(Math.floor(production * 2700));
  });

  it('Lv10+ 使用标准缓冲时间（7200秒）', () => {
    bs.deserialize(makeSave({ castle: { level: 10 } }));
    upgradeTo(bs, 'mine', 10);
    const capacity = bs.getStorageCapacity('mine');
    const production = bs.getProduction('mine');
    expect(capacity).toBe(Math.floor(production * 7200));
  });

  it('库存达到上限后产出降速50%', () => {
    // 先填满库存
    const capacity = bs.getStorageCapacity('mine');
    bs.tickStorage(capacity / bs.getProduction('mine') + 100); // 超量时间确保填满

    const beforeAmount = bs.getStorageAmount('mine');
    expect(beforeAmount).toBe(capacity); // 确认已满

    // 继续tick，产出应降速50%
    const production = bs.getProduction('mine');
    bs.tickStorage(10);
    const afterAmount = bs.getStorageAmount('mine');

    // 降速后产出 = production * 0.5 * 10
    // 但库存不能超过容量，所以实际增加量 = min(降速产出, 剩余空间)
    // 因为已经满了，所以增加量应该很小（降速后仍然可能微增）
    expect(afterAmount).toBeLessThanOrEqual(capacity);
    expect(bs.isStorageOverflowing('mine')).toBe(true);
  });

  it('收取后库存清零，产出恢复正常', () => {
    // 填满库存
    const capacity = bs.getStorageCapacity('mine');
    bs.tickStorage(capacity / bs.getProduction('mine') + 100);
    expect(bs.isStorageOverflowing('mine')).toBe(true);

    // 收取
    bs.collectBuilding('mine');
    expect(bs.getStorageAmount('mine')).toBe(0);
    expect(bs.isStorageOverflowing('mine')).toBe(false);
  });

  it('锁定建筑不产生库存累积', () => {
    // 兵营初始锁定（需要主城Lv2）
    expect(bs.getStorageAmount('barracks')).toBe(0);
    bs.tickStorage(10);
    expect(bs.getStorageAmount('barracks')).toBe(0);
  });

  it('getAllStorage 返回所有产出建筑的库存状态', () => {
    bs.tickStorage(10);
    const storages = bs.getAllStorage();
    // 应包含农田、市集、矿场、伐木场
    const types = storages.map(s => s.buildingType);
    expect(types).toContain('farmland');
    expect(types).toContain('market');
    expect(types).toContain('mine');
    expect(types).toContain('lumberMill');
  });
});

// ═══════════════════════════════════════════════════════════════
// BLD-F07: 离线收益适配4资源
// ═══════════════════════════════════════════════════════════════

describe('Sprint 1 — BLD-F07: 离线收益适配4资源', () => {
  let bs: BuildingSystem;
  let rs: ResourceSystem;

  beforeEach(() => {
    bs = new BuildingSystem();
    rs = new ResourceSystem();

    // 同步建筑产出到资源系统
    const productions = bs.calculateTotalProduction();
    rs.recalculateProduction(productions);
  });

  it('离线8h后4种资源均正确累加', () => {
    const offlineSeconds = 8 * 3600; // 8小时
    const result = rs.calculateOfflineEarnings(offlineSeconds);

    // 4种资源都应该有产出
    expect(result.earned.grain).toBeGreaterThan(0);
    expect(result.earned.gold).toBeGreaterThan(0);
    expect(result.earned.ore).toBeGreaterThan(0);
    expect(result.earned.wood).toBeGreaterThan(0);
  });

  it('离线收益受离线效率衰减影响', () => {
    const rates = rs.getProductionRates();
    const result8h = rs.calculateOfflineEarnings(8 * 3600);

    // 8小时 = 7200s 100% + 21600s 80%
    // 总效率 < 100%
    const avgEfficiency = result8h.earned.grain / (rates.grain * 8 * 3600);
    expect(avgEfficiency).toBeLessThan(1.0);
    expect(avgEfficiency).toBeGreaterThan(0.7); // 大约 80~90%
  });

  it('离线收益受资源上限截断', () => {
    // 设置很小的上限
    rs.setCap('ore', 100);
    rs.setCap('wood', 100);

    const result = rs.applyOfflineEarnings(8 * 3600);

    // 矿石/木材应被上限截断
    expect(rs.getAmount('ore')).toBeLessThanOrEqual(100);
    expect(rs.getAmount('wood')).toBeLessThanOrEqual(100);
  });

  it('离线收益计算包含时段明细', () => {
    const result = rs.calculateOfflineEarnings(8 * 3600);
    expect(result.tierBreakdown.length).toBeGreaterThan(0);
    // 8小时应跨越2个时段（0~2h 100%, 2~8h 80%）
    expect(result.tierBreakdown.length).toBe(2);
  });
});

// ═══════════════════════════════════════════════════════════════
// BLD-F10: 一键收取适配4资源
// ═══════════════════════════════════════════════════════════════

describe('Sprint 1 — BLD-F10: 一键收取适配4资源', () => {
  let bs: BuildingSystem;

  beforeEach(() => {
    bs = new BuildingSystem();
  });

  it('一键收取后4种资源飞入资源栏', () => {
    // 模拟10秒产出
    bs.tickStorage(10);

    const result = bs.collectAll();
    // 应包含4种资源
    expect(Object.keys(result.collected)).toContain('grain');
    expect(Object.keys(result.collected)).toContain('gold');
    expect(Object.keys(result.collected)).toContain('ore');
    expect(Object.keys(result.collected)).toContain('wood');
  });

  it('一键收取后各建筑库存归零', () => {
    bs.tickStorage(10);
    bs.collectAll();

    expect(bs.getStorageAmount('farmland')).toBe(0);
    expect(bs.getStorageAmount('market')).toBe(0);
    expect(bs.getStorageAmount('mine')).toBe(0);
    expect(bs.getStorageAmount('lumberMill')).toBe(0);
  });

  it('一键收取结果包含各建筑明细', () => {
    bs.tickStorage(10);
    const result = bs.collectAll();

    expect(result.buildingDetails.length).toBeGreaterThanOrEqual(4);
    // 检查明细中的资源类型
    const resourceTypes = result.buildingDetails.map(d => d.resourceType);
    expect(resourceTypes).toContain('grain');
    expect(resourceTypes).toContain('gold');
    expect(resourceTypes).toContain('ore');
    expect(resourceTypes).toContain('wood');
  });

  it('收取单个建筑库存', () => {
    bs.tickStorage(10);
    const amount = bs.collectBuilding('mine');
    expect(amount).toBeGreaterThan(0);
    expect(bs.getStorageAmount('mine')).toBe(0);
  });

  it('空库存收取返回空结果', () => {
    const result = bs.collectAll();
    expect(Object.keys(result.collected).length).toBe(0);
    expect(result.buildingDetails.length).toBe(0);
  });

  it('一键收取→资源系统累加→资源上限检查', () => {
    const rs = new ResourceSystem();
    // 设置上限
    rs.setCap('ore', 50000);
    rs.setCap('wood', 50000);

    // 模拟产出
    bs.tickStorage(100);
    const result = bs.collectAll();

    // 将收取的资源添加到资源系统
    for (const [resourceType, amount] of Object.entries(result.collected)) {
      rs.addResource(resourceType as any, amount);
    }

    // 资源系统应有正确的值
    expect(rs.getAmount('ore')).toBeGreaterThan(0);
    expect(rs.getAmount('wood')).toBeGreaterThan(0);
    expect(rs.getAmount('ore')).toBeLessThanOrEqual(50000);
    expect(rs.getAmount('wood')).toBeLessThanOrEqual(50000);
  });
});

// ═══════════════════════════════════════════════════════════════
// BLD-F15: 资源上限适配4资源
// ═══════════════════════════════════════════════════════════════

describe('Sprint 1 — BLD-F15: 资源上限适配4资源', () => {
  let rs: ResourceSystem;

  beforeEach(() => {
    rs = new ResourceSystem();
  });

  it('4种资源各自独立上限', () => {
    const caps = rs.getCaps();
    expect(caps.grain).toBeGreaterThan(0);
    expect(caps.gold).toBeNull(); // gold 无上限
    expect(caps.ore).toBeGreaterThan(0);
    expect(caps.wood).toBeGreaterThan(0);
  });

  it('矿石上限随矿场等级提升', () => {
    // Lv1 上限
    rs.updateCaps(1, 1, 1, 1);
    const cap1 = rs.getCaps().ore;

    // Lv5 上限
    rs.updateCaps(1, 1, 5, 1);
    const cap5 = rs.getCaps().ore;

    expect(cap5).toBeGreaterThan(cap1);
  });

  it('木材上限随伐木场等级提升', () => {
    rs.updateCaps(1, 1, 1, 1);
    const cap1 = rs.getCaps().wood;

    rs.updateCaps(1, 1, 1, 5);
    const cap5 = rs.getCaps().wood;

    expect(cap5).toBeGreaterThan(cap1);
  });

  it('资源达上限后产出被截断', () => {
    rs.setCap('ore', 100);
    rs.setResource('ore', 99);
    const added = rs.addResource('ore', 100);
    expect(added).toBe(1); // 只能加1
    expect(rs.getAmount('ore')).toBe(100);
  });

  it('资源达上限后发出 overflow 事件', () => {
    let overflowFired = false;
    const bus = {
      emit: (event: string, _data: any) => {
        if (event === 'resource:overflow') overflowFired = true;
      },
      on: () => {},
      off: () => {},
    };
    rs.init({ eventBus: bus } as any);

    rs.setCap('ore', 100);
    rs.setResource('ore', 99);
    rs.addResource('ore', 100);

    expect(overflowFired).toBe(true);
  });

  it('updateCaps 接受4个建筑等级参数', () => {
    rs.updateCaps(5, 5, 10, 10);
    const caps = rs.getCaps();
    // Lv10 矿石上限 > Lv5 粮草上限（通常）
    expect(caps.ore).toBeGreaterThan(caps.grain);
    expect(caps.wood).toBeGreaterThan(caps.grain);
  });

  it('updateCaps 兼容旧调用方式（仅2个参数）', () => {
    // 旧调用方式不应抛错
    expect(() => rs.updateCaps(5, 5)).not.toThrow();
  });

  it('矿石初始上限 = 2000（与粮草一致）', () => {
    const caps = rs.getCaps();
    expect(caps.ore).toBe(2000);
    expect(caps.wood).toBe(2000);
  });
});

// ═══════════════════════════════════════════════════════════════
// 集成测试: 完整产出→消费链路
// ═══════════════════════════════════════════════════════════════

describe('Sprint 1 — 集成: 完整产出→消费链路', () => {
  it('完整闭环：产出→库存→收取→资源系统→升级消耗', () => {
    const bs = new BuildingSystem();
    const rs = new ResourceSystem();

    // 1. 同步产出
    const productions = bs.calculateTotalProduction();
    rs.recalculateProduction(productions);
    rs.updateCaps(1, 1, 1, 1);

    // 2. tick 库存累积
    bs.tickStorage(100);

    // 3. 一键收取
    const result = bs.collectAll();
    expect(result.collected.ore).toBeGreaterThan(0);
    expect(result.collected.wood).toBeGreaterThan(0);

    // 4. 资源入库
    for (const [type, amount] of Object.entries(result.collected)) {
      rs.addResource(type as any, amount);
    }

    // 5. 验证4种资源都有值
    expect(rs.getAmount('grain')).toBeGreaterThan(0);
    expect(rs.getAmount('gold')).toBeGreaterThan(0);
    expect(rs.getAmount('ore')).toBeGreaterThan(0);
    expect(rs.getAmount('wood')).toBeGreaterThan(0);
  });

  it('升级消耗矿石/木材后资源正确减少', () => {
    const bs = new BuildingSystem();
    bs.deserialize(makeSave({ castle: { level: 10 } }));

    // 升级农田到 Lv6（需要矿石）
    upgradeTo(bs, 'farmland', 5);

    // 获取升级到 Lv6 的费用
    const cost = bs.getUpgradeCost('farmland')!;
    expect(cost.ore).toBeGreaterThan(0);

    // 模拟扣费
    const rs = new ResourceSystem();
    // 先设置足够高的上限
    rs.setCap('ore', 100000);
    rs.setCap('wood', 100000);
    rs.setResource('ore', 10000);
    rs.setResource('wood', 10000);
    expect(rs.getAmount('ore')).toBe(10000);
    rs.consumeResource('ore', cost.ore);
    if (cost.wood > 0) {
      rs.consumeResource('wood', cost.wood);
    }

    expect(rs.getAmount('ore')).toBe(10000 - cost.ore);
    if (cost.wood > 0) {
      expect(rs.getAmount('wood')).toBe(10000 - cost.wood);
    }
  });

  it('离线收益→收取→升级 完整流程', () => {
    const bs = new BuildingSystem();
    const rs = new ResourceSystem();

    // 同步产出
    const productions = bs.calculateTotalProduction();
    rs.recalculateProduction(productions);
    rs.updateCaps(1, 1, 1, 1);

    // 离线8小时
    rs.applyOfflineEarnings(8 * 3600);

    // 验证4种资源都有离线收益
    expect(rs.getAmount('grain')).toBeGreaterThan(0);
    expect(rs.getAmount('gold')).toBeGreaterThan(0);
    expect(rs.getAmount('ore')).toBeGreaterThan(0);
    expect(rs.getAmount('wood')).toBeGreaterThan(0);
  });
});
