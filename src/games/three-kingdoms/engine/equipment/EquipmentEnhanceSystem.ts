/**
 * 装备强化系统 — 成功率曲线/降级规则/保护符/自动强化/强化转移/一键强化
 *
 * 职责：
 *   - 强化成功率曲线（15级）
 *   - 失败降级规则（安全等级以上）
 *   - 保护符防降级
 *   - 自动强化（循环强化到目标）
 *   - 强化转移（源→目标）
 *   - 一键强化（批量最优强化）
 *
 * @module engine/equipment/EquipmentEnhanceSystem
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';
import type { EquipmentInstance } from '../../core/equipment/equipment.types';
import type {
  EnhanceResult,
  EnhanceOutcome,
  AutoEnhanceConfig,
  AutoEnhanceResult,
  EnhanceTransferResult,
} from '../../core/equipment/equipment-forge.types';
import {
  ENHANCE_CONFIG,
  ENHANCE_STAT_GROWTH,
  TRANSFER_COST_FACTOR,
  TRANSFER_LEVEL_LOSS,
} from '../../core/equipment/equipment-config';
import { RARITY_ENHANCE_CAP } from '../../core/equipment/equipment-config';
import type { EquipmentSystem } from './EquipmentSystem';

// ─────────────────────────────────────────────
// EquipmentEnhanceSystem
// ─────────────────────────────────────────────

/** 资源扣除回调类型 */
export type ResourceDeductFn = (copper: number, stone: number) => boolean;

export class EquipmentEnhanceSystem implements ISubsystem {
  readonly name = 'equipmentEnhance';
  private deps: ISystemDeps | null = null;
  private readonly equipmentSystem: EquipmentSystem;
  private protectionCount = 0;
  private rngState = 67890;
  /** 资源扣除回调（通过 setter 注入） */
  private deductResources: ResourceDeductFn | null = null;

  constructor(equipmentSystem: EquipmentSystem) {
    this.equipmentSystem = equipmentSystem;
  }

  // ─── ISubsystem 接口 ───────────────────────

  init(deps: ISystemDeps): void { this.deps = deps; }
  update(_dt: number): void {}
  getState(): { protectionCount: number } { return this.serialize(); }

  /** 注入资源扣除回调 */
  setResourceDeductor(fn: ResourceDeductFn): void {
    this.deductResources = fn;
  }

  // ── 单次强化（#10, #11, #12） ──

  /** 强化装备 */
  enhance(uid: string, useProtection: boolean = false): EnhanceResult {
    const eq = this.equipmentSystem.getEquipment(uid);
    if (!eq) {
      return this.failResult(0, 0, false, 0);
    }
    if (eq.enhanceLevel >= ENHANCE_CONFIG.maxLevel) {
      return this.failResult(eq.enhanceLevel, 0, false, 0);
    }

    // 品质强化上限校验
    const rarityCap = RARITY_ENHANCE_CAP[eq.rarity] ?? ENHANCE_CONFIG.maxLevel;
    if (eq.enhanceLevel >= rarityCap) {
      return this.failResult(eq.enhanceLevel, 0, false, 0);
    }

    const level = eq.enhanceLevel;
    const successRate = this.getSuccessRate(level);
    const copperCost = this.getCopperCost(level);
    const stoneCost = this.getStoneCost(level);

    // 保护符检查
    const protCost = ENHANCE_CONFIG.protectionCost[level + 1] ?? 0;
    if (useProtection && protCost > 0) {
      if (this.protectionCount < protCost) {
        useProtection = false; // 保护符不足，不使用
      }
    }

    // FIX-603: 资源扣除验证 — 未注入资源扣除回调时拒绝强化，防止免费强化
    if (!this.deductResources) {
      return this.failResult(level, 0, false, 0);
    }
    const deducted = this.deductResources(copperCost, stoneCost);
    if (!deducted) {
      return this.failResult(level, 0, false, 0);
    }

    // 模拟随机
    const roll = this.randomFloat();
    const isSuccess = roll < successRate;

    let outcome: EnhanceOutcome;
    let newLevel = level;

    if (isSuccess) {
      outcome = 'success';
      newLevel = level + 1;
    } else {
      // 失败：检查是否降级
      // PRD规则：金色装备+12以上失败不降级
      const isGoldSafe = eq.rarity === 'gold' && level >= 12;
      if (level > ENHANCE_CONFIG.safeLevel && !isGoldSafe) {
        if (useProtection) {
          // 保护符保护不降级
          outcome = 'fail';
          this.protectionCount -= protCost;
        } else {
          // 50%概率降级
          const downgradeRoll = this.randomFloat();
          if (downgradeRoll < ENHANCE_CONFIG.downgradeChance) {
            outcome = 'downgrade';
            newLevel = level - 1;
          } else {
            outcome = 'fail';
          }
        }
      } else {
        outcome = 'fail'; // 安全等级内不降级
      }
    }

    // 更新装备
    const updated = this.equipmentSystem.recalcStats({ ...eq, enhanceLevel: newLevel });
    this.equipmentSystem.updateEquipment(updated);

    return {
      outcome,
      previousLevel: level,
      currentLevel: newLevel,
      copperCost,
      stoneCost,
      protectionUsed: useProtection && !isSuccess,
      successRate,
    };
  }

  // ── 自动强化（#13） ──

  /** 自动强化到目标等级 */
  autoEnhance(uid: string, config: AutoEnhanceConfig): AutoEnhanceResult {
    const steps: EnhanceResult[] = [];
    let totalCopper = 0;
    let totalStone = 0;
    let totalProtection = 0;

    const eq = this.equipmentSystem.getEquipment(uid);
    if (!eq) {
      return { steps, finalLevel: 0, totalCopper: 0, totalStone: 0, totalProtection: 0 };
    }

    while (true) {
      const current = this.equipmentSystem.getEquipment(uid);
      if (!current) break;
      if (current.enhanceLevel >= config.targetLevel) break;
      if (totalCopper >= config.maxCopper) break;
      if (totalStone >= config.maxStone) break;

      const shouldProtect = config.useProtection && current.enhanceLevel >= config.protectionThreshold;
      const result = this.enhance(uid, shouldProtect);
      steps.push(result);
      totalCopper += result.copperCost;
      totalStone += result.stoneCost;
      if (result.protectionUsed) {
        totalProtection += ENHANCE_CONFIG.protectionCost[current.enhanceLevel + 1] ?? 1;
      }

      // 安全：防止无限循环
      if (steps.length >= 100) break;
    }

    const final = this.equipmentSystem.getEquipment(uid);
    return {
      steps,
      finalLevel: final?.enhanceLevel ?? 0,
      totalCopper,
      totalStone,
      totalProtection,
    };
  }

  // ── 强化转移（#14） ──

  /** 将源装备强化等级转移到目标装备 */
  transferEnhance(sourceUid: string, targetUid: string): EnhanceTransferResult {
    const source = this.equipmentSystem.getEquipment(sourceUid);
    const target = this.equipmentSystem.getEquipment(targetUid);
    if (!source || !target) {
      return { success: false, sourceUid, targetUid, transferredLevel: 0, cost: 0 };
    }
    if (source.enhanceLevel === 0) {
      return { success: false, sourceUid, targetUid, transferredLevel: 0, cost: 0 };
    }

    const transferLevel = Math.max(0, source.enhanceLevel - TRANSFER_LEVEL_LOSS);
    const cost = source.enhanceLevel * TRANSFER_COST_FACTOR;

    // FIX-610: 强化转移需扣除资源，防止免费转移
    if (this.deductResources && cost > 0) {
      const deducted = this.deductResources(cost, 0);
      if (!deducted) {
        return { success: false, sourceUid, targetUid, transferredLevel: 0, cost: 0 };
      }
    }

    // 重置源装备
    const resetSource = this.equipmentSystem.recalculateStats({ ...source, enhanceLevel: 0 });
    this.equipmentSystem.updateEquipment(resetSource);

    // 设置目标装备
    const updatedTarget = this.equipmentSystem.recalculateStats({ ...target, enhanceLevel: transferLevel });
    this.equipmentSystem.updateEquipment(updatedTarget);

    return {
      success: true,
      sourceUid,
      targetUid,
      transferredLevel: transferLevel,
      cost,
    };
  }

  // ── 一键强化（#15） ──

  /** 一键强化：对指定装备列表批量强化一次 */
  batchEnhance(uids: string[], useProtection: boolean = false): EnhanceResult[] {
    const results: EnhanceResult[] = [];
    for (const uid of uids) {
      const eq = this.equipmentSystem.getEquipment(uid);
      if (!eq || eq.enhanceLevel >= ENHANCE_CONFIG.maxLevel) continue;
      results.push(this.enhance(uid, useProtection));
    }
    return results;
  }

  // ── 成功率/费用查询 ──

  /** 获取指定等级成功率 */
  getSuccessRate(level: number): number {
    if (level >= ENHANCE_CONFIG.successRates.length) return 0.01;
    return ENHANCE_CONFIG.successRates[level] ?? 0.01;
  }

  /** 获取铜钱消耗 */
  getCopperCost(level: number): number {
    const { baseCopper, copperGrowth } = ENHANCE_CONFIG.costConfig;
    return Math.floor(baseCopper * Math.pow(copperGrowth, level));
  }

  /** 获取强化石消耗 */
  getStoneCost(level: number): number {
    const { baseStone, stoneGrowth } = ENHANCE_CONFIG.costConfig;
    return Math.max(1, Math.floor(baseStone * Math.pow(stoneGrowth, level)));
  }

  /** 获取保护符消耗 */
  getProtectionCost(level: number): number {
    return ENHANCE_CONFIG.protectionCost[level] ?? 0;
  }

  // ── 保护符管理 ──

  static readonly MAX_PROTECTION_COUNT = 9999;

  addProtection(count: number): void {
    if (!Number.isFinite(count) || count <= 0) return;
    this.protectionCount = Math.min(
      this.protectionCount + count,
      EquipmentEnhanceSystem.MAX_PROTECTION_COUNT,
    );
  }

  getProtectionCount(): number {
    return this.protectionCount;
  }

  // ── 存档 ──

  serialize(): { protectionCount: number } {
    return { protectionCount: this.protectionCount };
  }

  deserialize(data: { protectionCount: number }): void {
    this.protectionCount = data.protectionCount ?? 0;
  }

  reset(): void {
    this.protectionCount = 0;
  }

  // ── 内部 ──

  private failResult(level: number, cost: number, prot: boolean, rate: number): EnhanceResult {
    return {
      outcome: 'fail',
      previousLevel: level,
      currentLevel: level,
      copperCost: cost,
      stoneCost: 0,
      protectionUsed: prot,
      successRate: rate,
    };
  }

  private randomFloat(): number {
    this.rngState = (this.rngState * 1103515245 + 12345) & 0x7fffffff;
    return this.rngState / 0x7fffffff;
  }
}
