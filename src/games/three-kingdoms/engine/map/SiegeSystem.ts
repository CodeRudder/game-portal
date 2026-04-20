/**
 * 引擎层 — 攻城战系统
 *
 * 管理攻城条件校验、攻城执行和领土占领变更。
 * 实现 ISubsystem 接口，可注册到引擎子系统中统一管理。
 *
 * 职责：
 *   - 攻城条件校验（相邻领土 + 兵力 + 粮草）
 *   - 攻城消耗计算
 *   - 攻城执行（消耗资源 → 触发战斗 → 占领变更）
 *   - 存档序列化/反序列化
 *
 * @module engine/map/SiegeSystem
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';
import type { OwnershipStatus } from '../../core/map';
import type { TerritoryData } from '../../core/map';

// ─────────────────────────────────────────────
// 类型定义
// ─────────────────────────────────────────────

/** 攻城条件校验错误码 */
export type SiegeErrorCode =
  | 'TARGET_NOT_FOUND' | 'TARGET_ALREADY_OWNED' | 'NOT_ADJACENT'
  | 'INSUFFICIENT_TROOPS' | 'INSUFFICIENT_GRAIN' | 'NO_TROOPS_AVAILABLE';

/** 攻城条件校验结果 */
export interface SiegeConditionResult {
  canSiege: boolean;
  errorCode?: SiegeErrorCode;
  errorMessage?: string;
}

/** 攻城消耗 */
export interface SiegeCost {
  /** 兵力消耗 */
  troops: number;
  /** 粮草消耗 */
  grain: number;
}

/** 攻城结果 */
export interface SiegeResult {
  launched: boolean;
  victory: boolean;
  targetId: string;
  targetName: string;
  cost: SiegeCost;
  capture?: { territoryId: string; newOwner: OwnershipStatus; previousOwner: OwnershipStatus };
  failureReason?: string;
}

/** 攻城系统状态 */
export interface SiegeState {
  history: SiegeResult[];
  totalSieges: number;
  victories: number;
  defeats: number;
}

/** 攻城系统存档数据 */
export interface SiegeSaveData {
  totalSieges: number;
  victories: number;
  defeats: number;
  version: number;
}

// ─────────────────────────────────────────────
// 配置常量
// ─────────────────────────────────────────────

/** 攻城最低兵力要求 */
const MIN_SIEGE_TROOPS = 100;
/** 兵力消耗系数 */
const TROOP_COST_FACTOR = 1.0;
/** 粮草消耗系数：基础消耗 × 目标等级 */
const GRAIN_COST_FACTOR = 30;
/** 攻城存档版本 */
const SIEGE_SAVE_VERSION = 1;

// ─────────────────────────────────────────────
// 攻城战系统
// ─────────────────────────────────────────────

/**
 * 攻城战系统
 *
 * 管理攻城条件校验、攻城执行和领土占领变更。
 * 依赖 TerritorySystem 进行领土查询和归属变更。
 */
export class SiegeSystem implements ISubsystem {
  readonly name = 'siege';

  private deps!: ISystemDeps;
  private history: SiegeResult[] = [];
  private totalSieges = 0;
  private victories = 0;
  private defeats = 0;

  // ─── ISubsystem 接口 ───────────────────────

  init(deps: ISystemDeps): void {
    this.deps = deps;
    this.history = [];
    this.totalSieges = 0;
    this.victories = 0;
    this.defeats = 0;
  }

  update(_dt: number): void { /* 预留 */ }

  getState(): SiegeState {
    return {
      history: [...this.history],
      totalSieges: this.totalSieges,
      victories: this.victories,
      defeats: this.defeats,
    };
  }

  reset(): void {
    this.history = [];
    this.totalSieges = 0;
    this.victories = 0;
    this.defeats = 0;
  }

  // ─── 攻城条件校验（#19）──────────────────────

  /**
   * 校验攻城条件
   *
   * 条件：目标存在、非己方、与己方相邻、兵力≥阈值、粮草≥消耗
   */
  checkSiegeConditions(
    targetId: string,
    attackerOwner: OwnershipStatus,
    availableTroops: number,
    availableGrain: number,
  ): SiegeConditionResult {
    const territory = this.territorySys?.getTerritoryById(targetId);

    if (!territory) {
      return { canSiege: false, errorCode: 'TARGET_NOT_FOUND', errorMessage: `领土 ${targetId} 不存在` };
    }
    if (territory.ownership === attackerOwner) {
      return { canSiege: false, errorCode: 'TARGET_ALREADY_OWNED', errorMessage: `${territory.name} 已是己方领土` };
    }
    if (this.territorySys && !this.territorySys.canAttackTerritory(targetId, attackerOwner)) {
      return { canSiege: false, errorCode: 'NOT_ADJACENT', errorMessage: `${territory.name} 不与己方领土相邻` };
    }

    const cost = this.calculateSiegeCost(territory);
    if (availableTroops < cost.troops) {
      return { canSiege: false, errorCode: 'INSUFFICIENT_TROOPS', errorMessage: `兵力不足，需要 ${cost.troops}，当前 ${availableTroops}` };
    }
    if (availableGrain < cost.grain) {
      return { canSiege: false, errorCode: 'INSUFFICIENT_GRAIN', errorMessage: `粮草不足，需要 ${cost.grain}，当前 ${availableGrain}` };
    }

    return { canSiege: true };
  }

  // ─── 攻城消耗计算 ──────────────────────────

  /** 计算攻城消耗：兵力 = 基础 × 防御/100，粮草 = 系数 × 等级 */
  calculateSiegeCost(territory: TerritoryData): SiegeCost {
    return {
      troops: Math.ceil(MIN_SIEGE_TROOPS * (territory.defenseValue / 100) * TROOP_COST_FACTOR),
      grain: Math.ceil(GRAIN_COST_FACTOR * territory.level),
    };
  }

  /** 按领土ID获取攻城消耗 */
  getSiegeCostById(targetId: string): SiegeCost | null {
    const territory = this.territorySys?.getTerritoryById(targetId);
    return territory ? this.calculateSiegeCost(territory) : null;
  }

  // ─── 攻城执行（#20）──────────────────────────

  /** 执行攻城（简化版战斗模拟） */
  executeSiege(
    targetId: string,
    attackerOwner: OwnershipStatus,
    availableTroops: number,
    availableGrain: number,
  ): SiegeResult {
    const condition = this.checkSiegeConditions(targetId, attackerOwner, availableTroops, availableGrain);
    const territory = this.territorySys?.getTerritoryById(targetId);

    if (!condition.canSiege || !territory) {
      return {
        launched: false, victory: false, targetId,
        targetName: territory?.name ?? targetId,
        cost: { troops: 0, grain: 0 },
        failureReason: condition.errorMessage ?? '条件不满足',
      };
    }

    const cost = this.calculateSiegeCost(territory);
    const victory = this.simulateBattle(availableTroops, territory);
    return this.resolveSiege(targetId, territory, attackerOwner, cost, victory);
  }

  /** 使用外部战斗结果执行攻城 */
  executeSiegeWithResult(
    targetId: string,
    attackerOwner: OwnershipStatus,
    availableTroops: number,
    availableGrain: number,
    battleVictory: boolean,
  ): SiegeResult {
    const condition = this.checkSiegeConditions(targetId, attackerOwner, availableTroops, availableGrain);
    const territory = this.territorySys?.getTerritoryById(targetId);

    if (!condition.canSiege || !territory) {
      return {
        launched: false, victory: false, targetId,
        targetName: territory?.name ?? targetId,
        cost: { troops: 0, grain: 0 },
        failureReason: condition.errorMessage ?? '条件不满足',
      };
    }

    const cost = this.calculateSiegeCost(territory);
    return this.resolveSiege(targetId, territory, attackerOwner, cost, battleVictory);
  }

  // ─── 战斗模拟 ──────────────────────────────

  /** 简化版战斗：基于兵力对比和防御加成 */
  private simulateBattle(attackerTroops: number, target: TerritoryData): boolean {
    const defenderPower = target.defenseValue * (1 + (target.level - 1) * 0.15);
    const cost = this.calculateSiegeCost(target);
    const effectiveTroops = attackerTroops - cost.troops;
    const winRate = effectiveTroops / (effectiveTroops + defenderPower);
    return winRate > 0.4;
  }

  // ─── 统计查询 ──────────────────────────────

  getHistory(): SiegeResult[] { return [...this.history]; }
  getTotalSieges(): number { return this.totalSieges; }
  getVictories(): number { return this.victories; }
  getDefeats(): number { return this.defeats; }

  getWinRate(): number {
    if (this.totalSieges === 0) return 0;
    return Math.round((this.victories / this.totalSieges) * 100) / 100;
  }

  // ─── 序列化 ────────────────────────────────

  serialize(): SiegeSaveData {
    return {
      totalSieges: this.totalSieges,
      victories: this.victories,
      defeats: this.defeats,
      version: SIEGE_SAVE_VERSION,
    };
  }

  deserialize(data: SiegeSaveData): void {
    this.totalSieges = data.totalSieges;
    this.victories = data.victories;
    this.defeats = data.defeats;
    this.history = [];
  }

  // ─── 内部方法 ──────────────────────────────

  /** 统一处理攻城结果 */
  private resolveSiege(
    targetId: string,
    territory: TerritoryData,
    attackerOwner: OwnershipStatus,
    cost: SiegeCost,
    victory: boolean,
  ): SiegeResult {
    const previousOwner = territory.ownership;
    const result: SiegeResult = {
      launched: true, victory, targetId, targetName: territory.name, cost,
    };

    this.totalSieges++;

    if (victory) {
      this.victories++;
      this.territorySys?.captureTerritory(targetId, attackerOwner);
      result.capture = { territoryId: targetId, newOwner: attackerOwner, previousOwner };
      this.deps?.eventBus.emit('siege:victory', {
        territoryId: targetId, territoryName: territory.name,
        newOwner: attackerOwner, previousOwner, cost,
      });
    } else {
      this.defeats++;
      result.failureReason = '攻城失败，兵力不足以攻破防线';
      this.deps?.eventBus.emit('siege:defeat', {
        territoryId: targetId, territoryName: territory.name, cost,
      });
    }

    this.history.push(result);
    return result;
  }

  /** 获取 TerritorySystem 子系统 */
  private get territorySys(): import('./TerritorySystem').TerritorySystem | null {
    try {
      return this.deps?.registry?.get<import('./TerritorySystem').TerritorySystem>('territory') ?? null;
    } catch { return null; }
  }
}
