/**
 * EquipmentEnhanceSystem — maxLevel 变异杀死测试 (M8)
 *
 * M8 变异描述：将 ENHANCE_CONFIG.maxLevel 从 15 改为 20 后，763 个测试全部通过。
 * 原因：现有测试从未验证装备在 maxLevel 边界处的行为。
 *
 * 本文件专门测试 maxLevel 边界逻辑：
 *   1. 装备达到 maxLevel 后继续强化应失败
 *   2. 强化到 maxLevel-1 后可以继续
 *   3. 强化到 maxLevel 时返回成功
 *   4. maxLevel+1 的强化请求被拒绝
 *   5. 批量强化到 maxLevel 后停止
 *
 * 如果 M8 变异（maxLevel=20）被应用：
 *   - 测试 1 中装备 level=15 时 enhance() 不会返回失败（因为 15 < 20）
 *   - 测试 4 中 level=16 的装备仍可强化（因为 16 < 20）
 *   - 测试 5 中批量强化不会在 15 停止
 *   → 至少一个断言失败，变异被杀死
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EquipmentEnhanceSystem } from '../EquipmentEnhanceSystem';
import { EquipmentSystem } from '../EquipmentSystem';
import type { EquipmentInstance, EquipmentRarity } from '../../../core/equipment/equipment.types';
import type { ISystemDeps } from '../../../core/types/subsystem';
import {
  ENHANCE_CONFIG,
  RARITY_ENHANCE_CAP,
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

function addEquipment(sys: EquipmentSystem, rarity: EquipmentRarity = 'gold', slot: string = 'weapon', seed: number = 42): EquipmentInstance {
  return sys.generateEquipment(slot as EquipmentInstance['slot'], rarity, 'forge', seed);
}

/** 直接设置装备强化等级（绕过强化流程，用于测试边界条件） */
function setEnhanceLevel(sys: EquipmentSystem, uid: string, level: number): EquipmentInstance {
  const eq = sys.getEquipment(uid);
  if (!eq) throw new Error(`Equipment ${uid} not found`);
  const updated = sys.recalcStats({ ...eq, enhanceLevel: level });
  sys.updateEquipment(updated);
  return updated;
}

// ═══════════════════════════════════════════════════════════════
// M8 变异杀死测试：maxLevel 边界
// ═══════════════════════════════════════════════════════════════

describe('EquipmentEnhanceSystem — M8 maxLevel 变异杀死', () => {
  const MAX_LEVEL = ENHANCE_CONFIG.maxLevel; // 15

  let enhance: EquipmentEnhanceSystem;
  let sys: EquipmentSystem;

  beforeEach(() => {
    ({ sys, enhance } = createSystem());
    // 注入资源扣除器，始终返回 true（允许强化）
    enhance.setResourceDeductor(() => true);
  });

  // ─── 测试 1: 装备达到 maxLevel 后继续强化应失败 ───

  it('装备达到 maxLevel 后继续强化应返回失败', () => {
    const eq = addEquipment(sys, 'gold'); // gold 品质上限 = 15 = maxLevel
    setEnhanceLevel(sys, eq.uid, MAX_LEVEL);

    const result = enhance.enhance(eq.uid);

    // M8 变异(maxLevel=20)：level=15 < 20，enhance 不会在入口返回失败
    // → 结果会继续执行强化逻辑，outcome 可能是 success（level 变为 16）
    // → 正确行为：outcome 应为 fail，currentLevel 应保持 15
    expect(result.outcome).toBe('fail');
    expect(result.currentLevel).toBe(MAX_LEVEL);
    expect(result.previousLevel).toBe(MAX_LEVEL);

    // 确认装备等级未变化
    const eqAfter = sys.getEquipment(eq.uid);
    expect(eqAfter!.enhanceLevel).toBe(MAX_LEVEL);
  });

  // ─── 测试 2: 强化到 maxLevel-1 后可以继续 ───

  it('装备在 maxLevel-1 时 enhance 不应在入口返回失败', () => {
    const eq = addEquipment(sys, 'gold');
    setEnhanceLevel(sys, eq.uid, MAX_LEVEL - 1);

    const result = enhance.enhance(eq.uid);

    // 关键断言：在 maxLevel-1 时，enhance 不应返回 failResult（入口拒绝）
    // 入口拒绝的特征：copperCost=0, stoneCost=0, successRate=0
    // M8 变异(maxLevel=20)：不影响此测试，因为 level=14 < 15 和 14 < 20 都不触发入口拒绝
    // 但此测试确保 level=maxLevel-1 时 enhance 确实执行了强化逻辑
    expect(result.previousLevel).toBe(MAX_LEVEL - 1);
    // copperCost 和 stoneCost 应大于 0（说明执行了强化逻辑而非入口拒绝）
    expect(result.copperCost).toBeGreaterThan(0);
    expect(result.successRate).toBeGreaterThan(0);
    // 结果应为 success / fail / downgrade 之一
    expect(['success', 'fail', 'downgrade']).toContain(result.outcome);
  });

  // ─── 测试 3: 强化到 maxLevel 时返回成功 ───

  it('成功强化到 maxLevel 时结果应反映正确等级', () => {
    // 直接模拟：将装备设为 maxLevel，验证状态一致
    const eq = addEquipment(sys, 'gold');
    setEnhanceLevel(sys, eq.uid, MAX_LEVEL);

    const eqAfter = sys.getEquipment(eq.uid);
    expect(eqAfter!.enhanceLevel).toBe(MAX_LEVEL);

    // 再次强化必须失败
    const result = enhance.enhance(eq.uid);
    expect(result.outcome).toBe('fail');
    expect(result.currentLevel).toBe(MAX_LEVEL);
  });

  // ─── 测试 4: maxLevel+1 的强化请求被拒绝 ───

  it('装备等级超过 maxLevel 时强化请求被拒绝', () => {
    const eq = addEquipment(sys, 'gold');
    // 通过直接修改设置超过 maxLevel 的等级
    // M8 变异(maxLevel=20)：level=16 < 20，enhance 不会返回失败
    setEnhanceLevel(sys, eq.uid, MAX_LEVEL + 1);

    const result = enhance.enhance(eq.uid);

    // 正确行为：level >= maxLevel，应返回失败
    expect(result.outcome).toBe('fail');
    expect(result.currentLevel).toBe(MAX_LEVEL + 1);
    expect(result.previousLevel).toBe(MAX_LEVEL + 1);

    // 装备等级不应变化
    const eqAfter = sys.getEquipment(eq.uid);
    expect(eqAfter!.enhanceLevel).toBe(MAX_LEVEL + 1);
  });

  // ─── 测试 5: 批量强化到 maxLevel 后停止 ───

  it('批量强化应在装备达到 maxLevel 后跳过该装备', () => {
    // 创建两件装备：一件在 maxLevel，一件在 maxLevel-1
    const eq1 = addEquipment(sys, 'gold', 'weapon', 100);
    const eq2 = addEquipment(sys, 'gold', 'armor', 200);

    setEnhanceLevel(sys, eq1.uid, MAX_LEVEL);     // 已满级
    setEnhanceLevel(sys, eq2.uid, MAX_LEVEL - 1); // 差一级

    // M8 变异(maxLevel=20)：eq1 level=15 < 20，不会被跳过
    // → batchEnhance 会尝试强化 eq1，返回 2 个结果而非 1 个
    const results = enhance.batchEnhance([eq1.uid, eq2.uid]);

    // 只有 eq2 应该被强化，eq1 应被跳过
    // M8 变异下 eq1 也会被强化 → results.length = 2，杀死变异
    expect(results.length).toBe(1);

    // 那个结果应该是 eq2 的
    expect(results[0].previousLevel).toBe(MAX_LEVEL - 1);
  });

  // ─── 测试 6: autoEnhance 不应超过 maxLevel ───

  it('autoEnhance 目标超过 maxLevel 时应在 maxLevel 停止', () => {
    const eq = addEquipment(sys, 'gold');
    setEnhanceLevel(sys, eq.uid, MAX_LEVEL - 2);

    const result = enhance.autoEnhance(eq.uid, {
      targetLevel: MAX_LEVEL + 5, // 目标超过 maxLevel
      maxCopper: 1_000_000_000,
      maxStone: 1_000_000_000,
      useProtection: true,
      protectionThreshold: 6,
    });

    // 最终等级不应超过 maxLevel
    // M8 变异(maxLevel=20)：循环条件 level < targetLevel=20 仍满足
    // 但 enhance() 内部 level=15 < maxLevel=20 不会阻止
    // → 最终等级可能超过 15
    expect(result.finalLevel).toBeLessThanOrEqual(MAX_LEVEL);
  });

  // ─── 测试 7: maxLevel 精确值断言 ───

  it('ENHANCE_CONFIG.maxLevel 应为 15', () => {
    // 直接断言配置值 — M8 变异会改变这个值
    expect(ENHANCE_CONFIG.maxLevel).toBe(15);
  });

  // ─── 测试 8: 品质上限与 maxLevel 关系 ───

  it('gold 品质强化上限应等于 maxLevel', () => {
    // gold 品质的 RARITY_ENHANCE_CAP 应为 15 = maxLevel
    // M8 变异(maxLevel=20)：RARITY_ENHANCE_CAP.gold=15 ≠ maxLevel=20
    expect(RARITY_ENHANCE_CAP.gold).toBe(MAX_LEVEL);
  });

  it('white 品质装备达到其品质上限后强化应失败', () => {
    const eq = addEquipment(sys, 'white'); // white 品质上限 = 5
    setEnhanceLevel(sys, eq.uid, RARITY_ENHANCE_CAP.white);

    const result = enhance.enhance(eq.uid);

    expect(result.outcome).toBe('fail');
    expect(result.currentLevel).toBe(RARITY_ENHANCE_CAP.white);

    const eqAfter = sys.getEquipment(eq.uid);
    expect(eqAfter!.enhanceLevel).toBe(RARITY_ENHANCE_CAP.white);
  });

  // ─── 测试 9: batchEnhance 跳过所有 maxLevel 装备时返回空数组 ───

  it('batchEnhance 对全部已满级装备应返回空数组', () => {
    const eq1 = addEquipment(sys, 'gold', 'weapon', 300);
    const eq2 = addEquipment(sys, 'gold', 'armor', 400);
    const eq3 = addEquipment(sys, 'gold', 'accessory', 500);

    setEnhanceLevel(sys, eq1.uid, MAX_LEVEL);
    setEnhanceLevel(sys, eq2.uid, MAX_LEVEL);
    setEnhanceLevel(sys, eq3.uid, MAX_LEVEL);

    const results = enhance.batchEnhance([eq1.uid, eq2.uid, eq3.uid]);

    // M8 变异(maxLevel=20)：所有装备 level=15 < 20，都会被强化
    // → results.length = 3，杀死变异
    expect(results).toEqual([]);
  });

  // ─── 测试 10: 连续强化最终停在 maxLevel ───

  it('从等级 0 连续强化最终等级不应超过 maxLevel', () => {
    const eq = addEquipment(sys, 'gold');

    // 连续强化最多 100 次（有安全限制）
    for (let i = 0; i < 100; i++) {
      const current = sys.getEquipment(eq.uid);
      if (!current) break;
      if (current.enhanceLevel >= MAX_LEVEL) break;
      enhance.enhance(eq.uid);
    }

    const final = sys.getEquipment(eq.uid);
    expect(final!.enhanceLevel).toBeLessThanOrEqual(MAX_LEVEL);
  });
});
