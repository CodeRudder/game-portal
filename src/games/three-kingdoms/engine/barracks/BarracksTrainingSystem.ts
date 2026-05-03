/**
 * 兵营训练系统 — 引擎层
 *
 * 职责：通过消耗资源训练兵力
 * 训练模式：
 *   - normal（普通）: grain × count × 5  → troops × 1.0
 *   - accelerated（加速）: grain × count × 10 → troops × 1.5 (+50%)
 *   - elite（精英）: grain × count × 25 + gold × 1000 → troops × 2.0 (+100%)
 *
 * @module engine/barracks/BarracksTrainingSystem
 */

import type { TrainingMode } from './barracks.types';

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

/** 普通训练：每兵消耗粮草 */
const NORMAL_GRAIN_PER_TROOP = 5;
/** 加速训练：每兵消耗粮草 */
const ACCELERATED_GRAIN_PER_TROOP = 10;
/** 精英训练：每兵消耗粮草 */
const ELITE_GRAIN_PER_TROOP = 25;
/** 精英训练：固定消耗铜钱 */
const ELITE_GOLD_COST = 1000;

/** 训练效率倍率 */
const TRAINING_EFFICIENCY: Record<TrainingMode, number> = {
  normal: 1.0,
  accelerated: 1.5,
  elite: 2.0,
};

// ─────────────────────────────────────────────
// 序列化版本
// ─────────────────────────────────────────────

interface BarracksTrainingSaveData {
  version: number;
  barracksLevel: number;
  totalTroopsTrained: number;
  totalGrainSpent: number;
  totalGoldSpent: number;
}

// ─────────────────────────────────────────────
// 资源接口
// ─────────────────────────────────────────────

export type GetResourceFn = (type: string) => number;
export type SpendResourceFn = (type: string, amount: number) => boolean;

// ─────────────────────────────────────────────
// 训练系统
// ─────────────────────────────────────────────

export class BarracksTrainingSystem {
  private barracksLevel: number = 1;
  private getResource: GetResourceFn | null = null;
  private spendResource: SpendResourceFn | null = null;

  /** 累计训练兵力 */
  private totalTroopsTrained: number = 0;
  /** 累计消耗粮草 */
  private totalGrainSpent: number = 0;
  /** 累计消耗铜钱 */
  private totalGoldSpent: number = 0;

  // ── 初始化 ──

  /**
   * 初始化训练系统
   *
   * @param barracksLevel - 兵营等级
   * @param getResource - 获取资源的回调函数
   * @param spendResource - 消耗资源的回调函数（成功返回true）
   */
  init(
    barracksLevel: number,
    getResource: GetResourceFn,
    spendResource: SpendResourceFn,
  ): void {
    this.barracksLevel = Math.max(1, Math.floor(barracksLevel));
    this.getResource = getResource;
    this.spendResource = spendResource;
  }

  // ── 训练 ──

  /**
   * 执行训练
   *
   * @param mode - 训练模式：normal / accelerated / elite
   * @param troopCount - 目标训练兵力数量
   * @returns 训练结果
   */
  train(
    mode: TrainingMode,
    troopCount: number,
  ): { success: boolean; troopsGained: number; cost: Record<string, number>; reason?: string } {
    // 参数校验
    if (troopCount <= 0) {
      return {
        success: false,
        troopsGained: 0,
        cost: {},
        reason: '训练兵力数量必须大于0',
      };
    }

    if (!this.getResource || !this.spendResource) {
      return {
        success: false,
        troopsGained: 0,
        cost: {},
        reason: '系统未初始化',
      };
    }

    // 计算消耗
    const cost = this.getTrainingCost(mode, troopCount);

    // 检查粮草
    const currentGrain = this.getResource('grain');
    if (currentGrain < cost.grain) {
      return {
        success: false,
        troopsGained: 0,
        cost,
        reason: '粮草不足',
      };
    }

    // 检查铜钱（精英模式）
    if (cost.gold !== undefined && cost.gold > 0) {
      const currentGold = this.getResource('gold');
      if (currentGold < cost.gold) {
        return {
          success: false,
          troopsGained: 0,
          cost,
          reason: '铜钱不足',
        };
      }
    }

    // 扣除资源
    const grainSpent = this.spendResource('grain', cost.grain);
    if (!grainSpent) {
      return {
        success: false,
        troopsGained: 0,
        cost,
        reason: '粮草扣除失败',
      };
    }

    if (cost.gold !== undefined && cost.gold > 0) {
      const goldSpent = this.spendResource('gold', cost.gold);
      if (!goldSpent) {
        return {
          success: false,
          troopsGained: 0,
          cost,
          reason: '铜钱扣除失败',
        };
      }
      this.totalGoldSpent += cost.gold;
    }

    // 计算获得兵力
    const efficiency = TRAINING_EFFICIENCY[mode];
    const troopsGained = Math.floor(troopCount * efficiency);

    // 更新统计
    this.totalTroopsTrained += troopsGained;
    this.totalGrainSpent += cost.grain;

    return {
      success: true,
      troopsGained,
      cost,
    };
  }

  // ── 查询 ──

  /**
   * 获取训练消耗
   *
   * @param mode - 训练模式
   * @param troopCount - 训练兵力数量
   * @returns 资源消耗明细
   */
  getTrainingCost(mode: TrainingMode, troopCount: number): Record<string, number> {
    let grain = 0;
    let gold = 0;

    switch (mode) {
      case 'normal':
        grain = troopCount * NORMAL_GRAIN_PER_TROOP;
        break;
      case 'accelerated':
        grain = troopCount * ACCELERATED_GRAIN_PER_TROOP;
        break;
      case 'elite':
        grain = troopCount * ELITE_GRAIN_PER_TROOP;
        gold = ELITE_GOLD_COST;
        break;
    }

    const result: Record<string, number> = { grain };
    if (gold > 0) {
      result.gold = gold;
    }
    return result;
  }

  /**
   * 获取兵营等级
   */
  getBarracksLevel(): number {
    return this.barracksLevel;
  }

  /**
   * 获取训练效率倍率
   *
   * @param mode - 训练模式
   * @returns 效率倍率
   */
  getTrainingEfficiency(mode: string): number {
    return TRAINING_EFFICIENCY[mode as TrainingMode] ?? 1.0;
  }

  /**
   * 获取累计训练统计
   */
  getStats(): { totalTroopsTrained: number; totalGrainSpent: number; totalGoldSpent: number } {
    return {
      totalTroopsTrained: this.totalTroopsTrained,
      totalGrainSpent: this.totalGrainSpent,
      totalGoldSpent: this.totalGoldSpent,
    };
  }

  // ── 序列化 ──

  /**
   * 序列化为JSON字符串
   */
  serialize(): string {
    const saveData: BarracksTrainingSaveData = {
      version: 1,
      barracksLevel: this.barracksLevel,
      totalTroopsTrained: this.totalTroopsTrained,
      totalGrainSpent: this.totalGrainSpent,
      totalGoldSpent: this.totalGoldSpent,
    };
    return JSON.stringify(saveData);
  }

  /**
   * 从JSON字符串反序列化
   */
  deserialize(data: string): void {
    try {
      const saveData: BarracksTrainingSaveData = JSON.parse(data);
      if (saveData.version === 1) {
        this.barracksLevel = saveData.barracksLevel ?? 1;
        this.totalTroopsTrained = saveData.totalTroopsTrained ?? 0;
        this.totalGrainSpent = saveData.totalGrainSpent ?? 0;
        this.totalGoldSpent = saveData.totalGoldSpent ?? 0;
      }
    } catch {
      // 反序列化失败时保持当前状态不变
    }
  }

  /**
   * 重置系统状态
   */
  reset(): void {
    this.barracksLevel = 1;
    this.getResource = null;
    this.spendResource = null;
    this.totalTroopsTrained = 0;
    this.totalGrainSpent = 0;
    this.totalGoldSpent = 0;
  }
}
