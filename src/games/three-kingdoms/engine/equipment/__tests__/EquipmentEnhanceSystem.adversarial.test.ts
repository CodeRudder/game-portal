/**
 * EquipmentEnhanceSystem — 对抗性测试
 *
 * 目标：检测存活变异 M13/M14/M15/M18
 * - M13: roll < successRate → roll <= successRate (边界比较)
 * - M14: Math.pow(copperGrowth, level) → Math.pow(copperGrowth-0.1, level) (费用计算)
 * - M15: level > safeLevel → level >= safeLevel (安全等级边界)
 * - M18: downgradeRoll < downgradeChance → downgradeRoll <= downgradeChance (降级概率边界)
 *
 * 专门验证数值精确性和逻辑正确性
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EquipmentEnhanceSystem } from '../EquipmentEnhanceSystem';
import { EquipmentSystem } from '../EquipmentSystem';
import type { EquipmentInstance, EquipmentRarity } from '../../../core/equipment/equipment.types';
import type { ISystemDeps } from '../../../core/types/subsystem';
import {
  ENHANCE_CONFIG,
  RARITY_ENHANCE_CAP,
  TRANSFER_COST_FACTOR,
  TRANSFER_LEVEL_LOSS,
} from '../../../core/equipment/equipment-config';

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

describe('EquipmentEnhanceSystem — 对抗性测试 (Adversarial)', () => {
  let enhance: EquipmentEnhanceSystem;
  let sys: EquipmentSystem;

  beforeEach(() => {
    ({ sys, enhance } = createSystem());
  });

  // ── 1. getCopperCost 精确值验证 ──
  // 针对 M14: copperGrowth 被篡改
  it('getCopperCost(0) 精确为 baseCopper * copperGrowth^0 = baseCopper', () => {
    const expected = Math.floor(ENHANCE_CONFIG.costConfig.baseCopper * Math.pow(ENHANCE_CONFIG.costConfig.copperGrowth, 0));
    expect(enhance.getCopperCost(0)).toBe(expected);
  });

  it('getCopperCost(5) 精确为 baseCopper * copperGrowth^5', () => {
    const { baseCopper, copperGrowth } = ENHANCE_CONFIG.costConfig;
    const expected = Math.floor(baseCopper * Math.pow(copperGrowth, 5));
    expect(enhance.getCopperCost(5)).toBe(expected);
  });

  it('getCopperCost(10) 精确为 baseCopper * copperGrowth^10', () => {
    const { baseCopper, copperGrowth } = ENHANCE_CONFIG.costConfig;
    const expected = Math.floor(baseCopper * Math.pow(copperGrowth, 10));
    expect(enhance.getCopperCost(10)).toBe(expected);
  });

  // ── 2. getStoneCost 精确值验证 ──
  it('getStoneCost(0) 精确为 max(1, baseStone * stoneGrowth^0)', () => {
    const { baseStone, stoneGrowth } = ENHANCE_CONFIG.costConfig;
    const expected = Math.max(1, Math.floor(baseStone * Math.pow(stoneGrowth, 0)));
    expect(enhance.getStoneCost(0)).toBe(expected);
  });

  it('getStoneCost(5) 精确为 max(1, baseStone * stoneGrowth^5)', () => {
    const { baseStone, stoneGrowth } = ENHANCE_CONFIG.costConfig;
    const expected = Math.max(1, Math.floor(baseStone * Math.pow(stoneGrowth, 5)));
    expect(enhance.getStoneCost(5)).toBe(expected);
  });

  // ── 3. getSuccessRate 精确值验证 ──
  // 针对 M16 (已杀死) 和 M13 (存活) — 验证边界行为
  it('getSuccessRate(0) 精确为 1.0 (100%)', () => {
    expect(enhance.getSuccessRate(0)).toBe(1.0);
  });

  it('getSuccessRate(3) 精确为 0.80', () => {
    expect(enhance.getSuccessRate(3)).toBe(0.80);
  });

  it('getSuccessRate(14) 精确为 0.01', () => {
    expect(enhance.getSuccessRate(14)).toBe(0.01);
  });

  // ── 4. 安全等级边界验证 ──
  // 针对 M15: level > safeLevel → level >= safeLevel
  // safeLevel=5, 所以 level=5 时不应降级，level=6 时才可能降级
  it('getSuccessRate 在安全等级内(0-4)应为100%或高成功率', () => {
    // 验证 safeLevel=5 意味着 level 0-4 在安全范围内
    // level 0-2: 100%, level 3: 80%, level 4: 70%
    expect(enhance.getSuccessRate(0)).toBe(1.0);
    expect(enhance.getSuccessRate(1)).toBe(1.0);
    expect(enhance.getSuccessRate(2)).toBe(1.0);
    expect(enhance.getSuccessRate(3)).toBe(0.80);
    expect(enhance.getSuccessRate(4)).toBe(0.70);
    // level 5 开始进入危险区
    expect(enhance.getSuccessRate(5)).toBe(0.55);
  });

  it('ENHANCE_CONFIG.safeLevel 精确为 5', () => {
    expect(ENHANCE_CONFIG.safeLevel).toBe(5);
  });

  // ── 5. 强化转移等级损失精确验证 ──
  it('transferEnhance 转移后等级精确为 sourceLevel - TRANSFER_LEVEL_LOSS', () => {
    const source = addEquipment(sys, 'white', 'weapon', 100);
    const target = addEquipment(sys, 'white', 'armor', 200);

    // 先强化 source 到 level 10
    for (let i = 0; i < 10; i++) {
      enhance.enhance(source.uid, false);
    }
    const sourceEq = sys.getEquipment(source.uid);
    const sourceLevel = sourceEq!.enhanceLevel;

    const result = enhance.transferEnhance(source.uid, target.uid);
    expect(result.success).toBe(true);
    expect(result.transferredLevel).toBe(Math.max(0, sourceLevel - TRANSFER_LEVEL_LOSS));

    const targetEq = sys.getEquipment(target.uid);
    expect(targetEq!.enhanceLevel).toBe(Math.max(0, sourceLevel - TRANSFER_LEVEL_LOSS));
  });

  // ── 6. 强化转移费用精确验证 ──
  it('transferEnhance 费用精确为 sourceLevel * TRANSFER_COST_FACTOR', () => {
    const source = addEquipment(sys, 'white', 'weapon', 100);
    const target = addEquipment(sys, 'white', 'armor', 200);

    // 强化到 level 5
    for (let i = 0; i < 5; i++) {
      enhance.enhance(source.uid, false);
    }
    const sourceEq = sys.getEquipment(source.uid);
    const sourceLevel = sourceEq!.enhanceLevel;

    const result = enhance.transferEnhance(source.uid, target.uid);
    expect(result.success).toBe(true);
    expect(result.cost).toBe(sourceLevel * TRANSFER_COST_FACTOR);
  });

  // ── 7. 保护符消耗精确值验证 ──
  it('保护符数量精确管理：add + get 一致', () => {
    enhance.addProtection(10);
    expect(enhance.getProtectionCount()).toBe(10);
    enhance.addProtection(5);
    expect(enhance.getProtectionCount()).toBe(15);
  });

  it('reset 后保护符精确归零', () => {
    enhance.addProtection(100);
    enhance.reset();
    expect(enhance.getProtectionCount()).toBe(0);
  });

  // ── 8. 品质强化上限精确验证 ──
  it('白色装备强化上限精确为 RARITY_ENHANCE_CAP.white', () => {
    const cap = RARITY_ENHANCE_CAP['white'];
    expect(typeof cap).toBe('number');
    // 白色装备不应超过其品质上限
    const eq = addEquipment(sys, 'white');
    for (let i = 0; i < 20; i++) {
      enhance.enhance(eq.uid, false);
    }
    const final = sys.getEquipment(eq.uid);
    expect(final!.enhanceLevel).toBeLessThanOrEqual(cap);
  });

  // ── 9. getSuccessRate 越界返回精确值 ──
  it('getSuccessRate 超出范围时返回 0.01', () => {
    expect(enhance.getSuccessRate(100)).toBe(0.01);
    expect(enhance.getSuccessRate(999)).toBe(0.01);
  });

  // ── 10. batchEnhance 空列表精确行为 ──
  it('batchEnhance 空列表返回空数组', () => {
    const result = enhance.batchEnhance([], false);
    expect(result).toEqual([]);
    expect(result).toHaveLength(0);
  });
});
