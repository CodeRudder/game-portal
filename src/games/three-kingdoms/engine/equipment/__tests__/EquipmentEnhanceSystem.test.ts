/**
 * EquipmentEnhanceSystem 单元测试
 *
 * 覆盖：单次强化、自动强化、强化转移、一键强化、成功率/费用查询、保护符管理
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EquipmentEnhanceSystem } from '../EquipmentEnhanceSystem';
import { EquipmentSystem } from '../EquipmentSystem';
import type { EquipmentInstance, EquipmentRarity } from '../../../core/equipment';
import type { ISystemDeps } from '../../../core/types/subsystem';
import type { AutoEnhanceConfig } from '../../../core/equipment';
import {
  ENHANCE_CONFIG,
  RARITY_ENHANCE_CAP,
  TRANSFER_COST_FACTOR,
  TRANSFER_LEVEL_LOSS,
} from '../../../core/equipment';

// ── 测试辅助 ──

function createMockDeps(): ISystemDeps {
  return {
    eventBus: { emit: vi.fn(), on: vi.fn(), off: vi.fn(), once: vi.fn(), removeAllListeners: vi.fn() } as unknown as ISystemDeps['eventBus'],
    config: { get: vi.fn() } as unknown as ISystemDeps['config'],
    registry: { get: vi.fn() } as unknown as ISystemDeps['registry'],
  };
}

function createSystem(): { sys: EquipmentSystem; enhance: EquipmentEnhanceSystem } {
  const sys = new EquipmentSystem();
  sys.init(createMockDeps());
  const enhance = new EquipmentEnhanceSystem(sys);
  enhance.init(createMockDeps());
  return { sys, enhance };
}

function addEquipment(sys: EquipmentSystem, rarity: EquipmentRarity = 'white', slot: string = 'weapon', seed: number = 42): EquipmentInstance {
  return sys.generateEquipment(slot as EquipmentInstance['slot'], rarity, 'forge', seed);
}

// ═══════════════════════════════════════════════════
// ISubsystem 接口
// ═══════════════════════════════════════════════════

describe('EquipmentEnhanceSystem — ISubsystem', () => {
  it('name 应为 equipmentEnhance', () => {
    const { enhance } = createSystem();
    expect(enhance.name).toBe('equipmentEnhance');
  });

  it('reset 应清零保护符', () => {
    const { enhance } = createSystem();
    enhance.addProtection(10);
    enhance.reset();
    expect(enhance.getProtectionCount()).toBe(0);
  });
});

// ═══════════════════════════════════════════════════
// 成功率/费用查询
// ═══════════════════════════════════════════════════

describe('EquipmentEnhanceSystem — 成功率/费用查询', () => {
  let enhance: EquipmentEnhanceSystem;

  beforeEach(() => {
    ({ enhance } = createSystem());
  });

  it('getSuccessRate 等级 0-2 应为 100%', () => {
    expect(enhance.getSuccessRate(0)).toBe(1.0);
    expect(enhance.getSuccessRate(1)).toBe(1.0);
    expect(enhance.getSuccessRate(2)).toBe(1.0);
  });

  it('getSuccessRate 高等级应递减', () => {
    const r3 = enhance.getSuccessRate(3);
    const r5 = enhance.getSuccessRate(5);
    const r10 = enhance.getSuccessRate(10);
    expect(r3).toBeLessThan(1.0);
    expect(r5).toBeLessThan(r3);
    expect(r10).toBeLessThan(r5);
  });

  it('getSuccessRate 超出范围应返回 0.01', () => {
    expect(enhance.getSuccessRate(999)).toBe(0.01);
  });

  it('getCopperCost 应随等级指数增长', () => {
    const cost0 = enhance.getCopperCost(0);
    const cost5 = enhance.getCopperCost(5);
    const cost10 = enhance.getCopperCost(10);
    expect(cost5).toBeGreaterThan(cost0);
    expect(cost10).toBeGreaterThan(cost5);
  });

  it('getStoneCost 应至少为 1', () => {
    expect(enhance.getStoneCost(0)).toBeGreaterThanOrEqual(1);
  });

  it('getProtectionCost 应返回配置值', () => {
    expect(enhance.getProtectionCost(6)).toBe(1);
    expect(enhance.getProtectionCost(0)).toBe(0);
    expect(enhance.getProtectionCost(999)).toBe(0);
  });
});

// ═══════════════════════════════════════════════════
// 单次强化
// ═══════════════════════════════════════════════════

describe('EquipmentEnhanceSystem — enhance', () => {
  let sys: EquipmentSystem;
  let enhance: EquipmentEnhanceSystem;

  beforeEach(() => {
    ({ sys, enhance } = createSystem());
    enhance.setResourceDeductor(() => true); // 默认资源充足
  });

  it('不存在的装备应返回失败', () => {
    const result = enhance.enhance('nonexistent');
    expect(result.outcome).toBe('fail');
    expect(result.currentLevel).toBe(0);
  });

  it('等级 0→1 应成功（100%成功率）', () => {
    const eq = addEquipment(sys, 'white');
    const result = enhance.enhance(eq.uid);
    expect(result.outcome).toBe('success');
    expect(result.previousLevel).toBe(0);
    expect(result.currentLevel).toBe(1);
    expect(result.copperCost).toBeGreaterThan(0);
  });

  it('等级 1→2 应成功', () => {
    const eq = addEquipment(sys, 'white');
    enhance.enhance(eq.uid); // 0→1
    const result = enhance.enhance(eq.uid); // 1→2
    expect(result.outcome).toBe('success');
    expect(result.currentLevel).toBe(2);
  });

  it('等级 2→3 应成功', () => {
    const eq = addEquipment(sys, 'white');
    enhance.enhance(eq.uid); // 0→1
    enhance.enhance(eq.uid); // 1→2
    const result = enhance.enhance(eq.uid); // 2→3
    expect(result.outcome).toBe('success');
    expect(result.currentLevel).toBe(3);
  });

  it('达到品质强化上限应失败', () => {
    const eq = addEquipment(sys, 'white');
    // 白色上限5级，手动设置到上限
    const updated = { ...eq, enhanceLevel: RARITY_ENHANCE_CAP.white };
    sys.updateEquipment(updated);
    const result = enhance.enhance(eq.uid);
    expect(result.outcome).toBe('fail');
    expect(result.currentLevel).toBe(RARITY_ENHANCE_CAP.white);
  });

  it('达到最大等级应失败', () => {
    const eq = addEquipment(sys, 'gold');
    const updated = { ...eq, enhanceLevel: ENHANCE_CONFIG.maxLevel };
    sys.updateEquipment(updated);
    const result = enhance.enhance(eq.uid);
    expect(result.outcome).toBe('fail');
  });

  it('资源不足应失败', () => {
    const eq = addEquipment(sys, 'white');
    enhance.setResourceDeductor(() => false);
    const result = enhance.enhance(eq.uid);
    expect(result.outcome).toBe('fail');
    expect(result.currentLevel).toBe(0);
  });

  it('强化后装备属性应更新', () => {
    const eq = addEquipment(sys, 'white');
    const beforeValue = sys.getEquipment(eq.uid)!.mainStat.value;
    enhance.enhance(eq.uid);
    const afterValue = sys.getEquipment(eq.uid)!.mainStat.value;
    expect(afterValue).toBeGreaterThanOrEqual(beforeValue);
  });

  it('successRate 应返回当前等级的成功率', () => {
    const eq = addEquipment(sys, 'white');
    const result = enhance.enhance(eq.uid);
    expect(result.successRate).toBe(enhance.getSuccessRate(0));
  });
});

// ═══════════════════════════════════════════════════
// 自动强化
// ═══════════════════════════════════════════════════

describe('EquipmentEnhanceSystem — autoEnhance', () => {
  let sys: EquipmentSystem;
  let enhance: EquipmentEnhanceSystem;

  beforeEach(() => {
    ({ sys, enhance } = createSystem());
    enhance.setResourceDeductor(() => true);
  });

  it('应强化到目标等级', () => {
    const eq = addEquipment(sys, 'gold'); // 金色上限15
    const config: AutoEnhanceConfig = {
      targetLevel: 3,
      maxCopper: 100000,
      maxStone: 1000,
      useProtection: false,
      protectionThreshold: 10,
    };
    const result = enhance.autoEnhance(eq.uid, config);
    expect(result.finalLevel).toBe(3);
    expect(result.steps.length).toBe(3);
    expect(result.totalCopper).toBeGreaterThan(0);
  });

  it('不存在的装备应返回空结果', () => {
    const config: AutoEnhanceConfig = {
      targetLevel: 5,
      maxCopper: 100000,
      maxStone: 1000,
      useProtection: false,
      protectionThreshold: 10,
    };
    const result = enhance.autoEnhance('nonexistent', config);
    expect(result.steps).toHaveLength(0);
    expect(result.finalLevel).toBe(0);
  });

  it('铜钱耗尽应停止强化循环', () => {
    const eq = addEquipment(sys, 'gold');
    const config: AutoEnhanceConfig = {
      targetLevel: 15,
      maxCopper: 500, // 很少的铜钱
      maxStone: 1000,
      useProtection: false,
      protectionThreshold: 10,
    };
    const result = enhance.autoEnhance(eq.uid, config);
    expect(result.finalLevel).toBeLessThan(15);
    // 循环在 totalCopper >= maxCopper 时停止，但当前步已经执行
    // 所以 totalCopper 可能超过 maxCopper
    expect(result.steps.length).toBeLessThan(15);
  });

  it('强化石耗尽应停止', () => {
    const eq = addEquipment(sys, 'gold');
    const config: AutoEnhanceConfig = {
      targetLevel: 15,
      maxCopper: 1000000,
      maxStone: 5,
      useProtection: false,
      protectionThreshold: 10,
    };
    const result = enhance.autoEnhance(eq.uid, config);
    expect(result.totalStone).toBeLessThanOrEqual(5);
  });

  it('超过100步应安全停止', () => {
    const eq = addEquipment(sys, 'gold');
    const config: AutoEnhanceConfig = {
      targetLevel: 15,
      maxCopper: 999999999,
      maxStone: 999999999,
      useProtection: false,
      protectionThreshold: 10,
    };
    const result = enhance.autoEnhance(eq.uid, config);
    expect(result.steps.length).toBeLessThanOrEqual(100);
  });
});

// ═══════════════════════════════════════════════════
// 强化转移
// ═══════════════════════════════════════════════════

describe('EquipmentEnhanceSystem — transferEnhance', () => {
  let sys: EquipmentSystem;
  let enhance: EquipmentEnhanceSystem;

  beforeEach(() => {
    ({ sys, enhance } = createSystem());
    enhance.setResourceDeductor(() => true);
  });

  it('应成功转移强化等级', () => {
    const source = addEquipment(sys, 'gold', 'weapon', 1);
    const target = addEquipment(sys, 'gold', 'armor', 2);

    // 手动设置源装备等级
    const updated = { ...source, enhanceLevel: 10 };
    sys.updateEquipment(updated);

    const result = enhance.transferEnhance(source.uid, target.uid);
    expect(result.success).toBe(true);
    expect(result.transferredLevel).toBe(10 - TRANSFER_LEVEL_LOSS);
    expect(result.cost).toBe(10 * TRANSFER_COST_FACTOR);

    // 验证源装备等级归零
    const sourceEq = sys.getEquipment(source.uid);
    expect(sourceEq!.enhanceLevel).toBe(0);

    // 验证目标装备等级
    const targetEq = sys.getEquipment(target.uid);
    expect(targetEq!.enhanceLevel).toBe(10 - TRANSFER_LEVEL_LOSS);
  });

  it('源装备等级为 0 应失败', () => {
    const source = addEquipment(sys, 'white', 'weapon', 1);
    const target = addEquipment(sys, 'white', 'armor', 2);

    const result = enhance.transferEnhance(source.uid, target.uid);
    expect(result.success).toBe(false);
    expect(result.transferredLevel).toBe(0);
  });

  it('不存在的装备应失败', () => {
    const result = enhance.transferEnhance('ghost1', 'ghost2');
    expect(result.success).toBe(false);
  });
});

// ═══════════════════════════════════════════════════
// 一键强化
// ═══════════════════════════════════════════════════

describe('EquipmentEnhanceSystem — batchEnhance', () => {
  let sys: EquipmentSystem;
  let enhance: EquipmentEnhanceSystem;

  beforeEach(() => {
    ({ sys, enhance } = createSystem());
    enhance.setResourceDeductor(() => true);
  });

  it('应批量强化多件装备', () => {
    const eq1 = addEquipment(sys, 'white', 'weapon', 1);
    const eq2 = addEquipment(sys, 'white', 'armor', 2);
    const eq3 = addEquipment(sys, 'white', 'accessory', 3);

    const results = enhance.batchEnhance([eq1.uid, eq2.uid, eq3.uid]);
    expect(results).toHaveLength(3);
    for (const r of results) {
      expect(r.outcome).toBe('success');
      expect(r.currentLevel).toBe(1);
    }
  });

  it('空列表应返回空结果', () => {
    const results = enhance.batchEnhance([]);
    expect(results).toHaveLength(0);
  });

  it('不存在的 uid 应被跳过', () => {
    const eq = addEquipment(sys, 'white', 'weapon', 1);
    const results = enhance.batchEnhance([eq.uid, 'ghost']);
    expect(results).toHaveLength(1);
  });

  it('已达最大等级的装备应被跳过', () => {
    const eq = addEquipment(sys, 'gold', 'weapon', 1);
    const updated = { ...eq, enhanceLevel: ENHANCE_CONFIG.maxLevel };
    sys.updateEquipment(updated);
    const results = enhance.batchEnhance([eq.uid]);
    expect(results).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════
// 保护符管理
// ═══════════════════════════════════════════════════

describe('EquipmentEnhanceSystem — 保护符', () => {
  let enhance: EquipmentEnhanceSystem;

  beforeEach(() => {
    ({ enhance } = createSystem());
  });

  it('addProtection 应增加保护符数量', () => {
    enhance.addProtection(5);
    expect(enhance.getProtectionCount()).toBe(5);
  });

  it('多次 addProtection 应累加', () => {
    enhance.addProtection(3);
    enhance.addProtection(2);
    expect(enhance.getProtectionCount()).toBe(5);
  });

  it('serialize 应包含保护符数量', () => {
    enhance.addProtection(7);
    const data = enhance.serialize();
    expect(data.protectionCount).toBe(7);
  });

  it('deserialize 应恢复保护符数量', () => {
    enhance.deserialize({ protectionCount: 10 });
    expect(enhance.getProtectionCount()).toBe(10);
  });
});
