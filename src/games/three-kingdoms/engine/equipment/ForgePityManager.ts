/**
 * 装备域 — 炼制保底管理器
 *
 * 职责：保底计数器管理、保底触发判定、保底品质确定
 * 从 EquipmentForgeSystem 拆分，降低主文件行数
 *
 * @module engine/equipment/ForgePityManager
 */

import type { EquipmentRarity, ForgeType, ForgePityState } from '../../core/equipment';
import { RARITY_ORDER, EQUIPMENT_RARITIES } from '../../core/equipment';

// ─────────────────────────────────────────────
// 保底阈值配置
// ─────────────────────────────────────────────

/** 保底阈值：连续未出紫色 */
const PITY_PURPLE_THRESHOLD = 10;
/** 保底阈值：连续未出金色 */
const PITY_GOLD_THRESHOLD = 30;

// ─────────────────────────────────────────────
// ForgePityManager
// ─────────────────────────────────────────────

export class ForgePityManager {
  /** 保底状态 */
  private pityState: ForgePityState = {
    basicBluePity: 0,
    advancedPurplePity: 0,
    targetedGoldPity: 0,
  };

  // ─── 查询 ─────────────────────────────────

  /** 获取保底状态快照 */
  getState(): ForgePityState {
    return { ...this.pityState };
  }

  /** 从存档恢复 */
  restore(state: ForgePityState): void {
    this.pityState = state ?? { basicBluePity: 0, advancedPurplePity: 0, targetedGoldPity: 0 };
  }

  /** 重置 */
  reset(): void {
    this.pityState = { basicBluePity: 0, advancedPurplePity: 0, targetedGoldPity: 0 };
  }

  // ─── 保底判定 ─────────────────────────────

  /** 检查是否触发保底 */
  shouldTrigger(type: ForgeType): boolean {
    switch (type) {
      case 'basic': return this.pityState.basicBluePity >= PITY_PURPLE_THRESHOLD;
      case 'advanced': return this.pityState.advancedPurplePity >= PITY_PURPLE_THRESHOLD;
      case 'targeted': return this.pityState.targetedGoldPity >= PITY_GOLD_THRESHOLD;
      default: return false;
    }
  }

  /** 获取保底品质 */
  getPityRarity(type: ForgeType): EquipmentRarity {
    switch (type) {
      case 'basic':
      case 'advanced': return 'purple';
      case 'targeted': return 'gold';
      default: return 'purple';
    }
  }

  /**
   * 更新保底计数器
   * @returns 是否触发了保底
   */
  update(type: ForgeType, outputRarity: EquipmentRarity): boolean {
    let triggered = false;

    switch (type) {
      case 'basic': {
        if (RARITY_ORDER[outputRarity] >= RARITY_ORDER.purple) {
          this.pityState.basicBluePity = 0;
        } else {
          this.pityState.basicBluePity++;
        }
        triggered = this.pityState.basicBluePity >= PITY_PURPLE_THRESHOLD;
        if (triggered) this.pityState.basicBluePity = 0;
        break;
      }
      case 'advanced': {
        if (RARITY_ORDER[outputRarity] >= RARITY_ORDER.purple) {
          this.pityState.advancedPurplePity = 0;
        } else {
          this.pityState.advancedPurplePity++;
        }
        triggered = this.pityState.advancedPurplePity >= PITY_PURPLE_THRESHOLD;
        if (triggered) this.pityState.advancedPurplePity = 0;
        break;
      }
      case 'targeted': {
        if (RARITY_ORDER[outputRarity] >= RARITY_ORDER.gold) {
          this.pityState.targetedGoldPity = 0;
        } else {
          this.pityState.targetedGoldPity++;
        }
        triggered = this.pityState.targetedGoldPity >= PITY_GOLD_THRESHOLD;
        if (triggered) this.pityState.targetedGoldPity = 0;
        break;
      }
    }

    return triggered;
  }

  // ─── 阈值查询 ─────────────────────────────

  /** 获取保底阈值（UI展示用） */
  getThreshold(type: ForgeType): number {
    switch (type) {
      case 'basic':
      case 'advanced': return PITY_PURPLE_THRESHOLD;
      case 'targeted': return PITY_GOLD_THRESHOLD;
      default: return PITY_PURPLE_THRESHOLD;
    }
  }

  /** 获取当前保底进度 */
  getProgress(type: ForgeType): { current: number; threshold: number } {
    let current = 0;
    switch (type) {
      case 'basic': current = this.pityState.basicBluePity; break;
      case 'advanced': current = this.pityState.advancedPurplePity; break;
      case 'targeted': current = this.pityState.targetedGoldPity; break;
    }
    return { current, threshold: this.getThreshold(type) };
  }
}
