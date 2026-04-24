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
  | 'INSUFFICIENT_TROOPS' | 'INSUFFICIENT_GRAIN' | 'NO_TROOPS_AVAILABLE'
  | 'DAILY_LIMIT_REACHED' | 'CAPTURE_COOLDOWN';

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
  /** 攻城失败时损失的兵力（MAP PRD v1.1: 30%出征兵力） */
  defeatTroopLoss?: number;
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
  /** 今日已攻城次数 */
  dailySiegeCount: number;
  /** 最后攻城日期（YYYY-MM-DD），用于跨天重置判断 */
  lastSiegeDate: string;
  version: number;
}

// ─────────────────────────────────────────────
// 配置常量
// ─────────────────────────────────────────────

/** 攻城最低兵力要求 */
const MIN_SIEGE_TROOPS = 100;
/** 兵力消耗系数 */
const TROOP_COST_FACTOR = 1.0;
/**
 * 粮草固定消耗量
 * ⚠️ PRD MAP-4 统一声明：粮草×500（固定消耗），旧公式"出征距离×50+城防等级×100"已废弃
 */
const GRAIN_FIXED_COST = 500;
/** 每日攻城次数上限（PRD MAP-4: 3次） */
const DAILY_SIEGE_LIMIT = 3;
/** 攻城存档版本 */
const SIEGE_SAVE_VERSION = 1;
/**
 * 占领冷却时间（PRD §7.5: 24小时）
 * 攻占后24小时内不可被反攻
 */
const CAPTURE_COOLDOWN_MS = 24 * 60 * 60 * 1000;

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
  /** 今日已攻城次数 */
  private dailySiegeCount = 0;
  /** 最后攻城日期（YYYY-MM-DD），用于跨天重置判断 */
  private lastSiegeDate = '';
  /**
   * 领土占领时间戳（PRD §7.5: 24h冷却）
   * key: territoryId, value: 占领时的时间戳(ms)
   */
  private captureTimestamps: Map<string, number> = new Map();

  // ─── ISubsystem 接口 ───────────────────────

  init(deps: ISystemDeps): void {
    this.deps = deps;
    this.history = [];
    this.totalSieges = 0;
    this.victories = 0;
    this.defeats = 0;
    this.captureTimestamps.clear();
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
    this.captureTimestamps.clear();
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
    if (this.dailySiegeCount >= DAILY_SIEGE_LIMIT) {
      return { canSiege: false, errorCode: 'DAILY_LIMIT_REACHED', errorMessage: `今日攻城次数已用完(${DAILY_SIEGE_LIMIT}次)` };
    }

    // PRD §7.5: 攻占后24小时内不可被反攻
    if (this.isInCaptureCooldown(targetId)) {
      const remaining = this.getRemainingCooldown(targetId);
      const hours = Math.ceil(remaining / (60 * 60 * 1000));
      return {
        canSiege: false,
        errorCode: 'CAPTURE_COOLDOWN',
        errorMessage: `${territory.name} 刚被攻占，${hours}小时后方可被攻击`,
      };
    }

    return { canSiege: true };
  }

  // ─── 攻城消耗计算 ──────────────────────────

  /** 计算攻城消耗：兵力 = 基础 × 防御/100，粮草 = 固定500（⚠️PRD MAP-4统一声明） */
  calculateSiegeCost(territory: TerritoryData): SiegeCost {
    return {
      troops: Math.ceil(MIN_SIEGE_TROOPS * (territory.defenseValue / 100) * TROOP_COST_FACTOR),
      grain: GRAIN_FIXED_COST,
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

  /**
   * 战斗模拟：基于攻防战力对比的概率判定（PRD §7.6 线性比率公式）
   *
   * 公式: min(95%, max(5%, (攻方战力/防方战力) × 50%))
   * 与 SiegeEnhancer.computeWinRate 保持一致
   *
   * ⚠️ 战斗判定权归属 SiegeSystem（单一权威源），SiegeEnhancer 应调用此方法
   */
  simulateBattle(attackerTroops: number, target: TerritoryData): boolean {
    // ⚠️ PRD MAP-4 统一声明：defenseValue 已按"基础(1000)×城市等级"生成
    const defenderPower = target.defenseValue;
    const cost = this.calculateSiegeCost(target);
    const effectiveTroops = attackerTroops - cost.troops;
    if (effectiveTroops <= 0) return false;
    const winRate = this.computeWinRate(effectiveTroops, defenderPower);
    return Math.random() < winRate;
  }

  /**
   * 核心胜率计算公式（PRD §7.6 线性比率公式）
   *
   * 公式: min(95%, max(5%, (attackerPower / defenderPower) × 50%))
   * - 线性比率，直观易懂
   * - 攻防相等时胜率 = 50%
   */
  private computeWinRate(attackerPower: number, defenderPower: number): number {
    const WIN_RATE_MIN = 0.05;
    const WIN_RATE_MAX = 0.95;
    const WIN_RATE_BASE = 0.5;

    if (attackerPower <= 0) return WIN_RATE_MIN;
    if (defenderPower <= 0) return WIN_RATE_MAX;

    const ratio = attackerPower / defenderPower;
    const rawRate = ratio * WIN_RATE_BASE;
    return Math.min(WIN_RATE_MAX, Math.max(WIN_RATE_MIN, rawRate));
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

  /** 获取今日剩余攻城次数 */
  getRemainingDailySieges(): number {
    return Math.max(0, DAILY_SIEGE_LIMIT - this.dailySiegeCount);
  }

  /** 重置每日攻城次数（每日刷新调用） */
  resetDailySiegeCount(): void {
    this.dailySiegeCount = 0;
    this.lastSiegeDate = '';
  }

  // ─── 占领冷却（PRD §7.5）─────────────────────

  /**
   * 检查领土是否在占领冷却期内
   * 攻占后24小时内不可被反攻
   */
  isInCaptureCooldown(territoryId: string): boolean {
    const timestamp = this.captureTimestamps.get(territoryId);
    if (!timestamp) return false;
    return Date.now() - timestamp < CAPTURE_COOLDOWN_MS;
  }

  /**
   * 获取领土冷却剩余时间（毫秒）
   */
  getRemainingCooldown(territoryId: string): number {
    const timestamp = this.captureTimestamps.get(territoryId);
    if (!timestamp) return 0;
    return Math.max(0, CAPTURE_COOLDOWN_MS - (Date.now() - timestamp));
  }

  /**
   * 设置领土占领时间戳（供外部或测试调用）
   */
  setCaptureTimestamp(territoryId: string, timestamp: number): void {
    this.captureTimestamps.set(territoryId, timestamp);
  }

  // ─── 序列化 ────────────────────────────────

  serialize(): SiegeSaveData {
    return {
      totalSieges: this.totalSieges,
      victories: this.victories,
      defeats: this.defeats,
      dailySiegeCount: this.dailySiegeCount,
      lastSiegeDate: this.lastSiegeDate,
      version: SIEGE_SAVE_VERSION,
    };
  }

  deserialize(data: SiegeSaveData): void {
    this.totalSieges = data.totalSieges;
    this.victories = data.victories;
    this.defeats = data.defeats;
    this.dailySiegeCount = data.dailySiegeCount ?? 0;
    this.lastSiegeDate = data.lastSiegeDate ?? '';
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
    this.dailySiegeCount++;
    this.lastSiegeDate = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    if (victory) {
      this.victories++;
      this.territorySys?.captureTerritory(targetId, attackerOwner);
      // PRD §7.5: 记录占领时间戳，24h冷却
      this.captureTimestamps.set(targetId, Date.now());
      // PRD §7.5: 自动驻防（50%兵力上限）
      this.autoGarrison(targetId, attackerOwner, cost.troops);
      result.capture = { territoryId: targetId, newOwner: attackerOwner, previousOwner };
      this.deps?.eventBus.emit('siege:victory', {
        territoryId: targetId, territoryName: territory.name,
        newOwner: attackerOwner, previousOwner, cost,
      });
    } else {
      this.defeats++;
      // ⚠️ MAP PRD v1.1统一声明：攻城失败损失30%出征兵力，粮草不返还
      const defeatTroopLoss = Math.floor(cost.troops * 0.3);
      result.failureReason = '攻城失败，兵力不足以攻破防线';
      result.defeatTroopLoss = defeatTroopLoss;
      this.deps?.eventBus.emit('siege:defeat', {
        territoryId: targetId, territoryName: territory.name, cost,
        defeatTroopLoss,
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

  /**
   * 自动驻防（PRD §7.5: 50%兵力上限）
   *
   * 占领成功后自动将50%剩余兵力部署为驻防。
   * 由于驻防系统基于武将派遣，此处以事件通知上层处理。
   * 实际兵力扣减由上层消费 siege:autoGarrison 事件完成。
   *
   * @param territoryId - 领土ID
   * @param owner - 占领方
   * @param troopsUsed - 攻城消耗兵力
   */
  private autoGarrison(territoryId: string, owner: OwnershipStatus, troopsUsed: number): void {
    const garrisonTroops = Math.floor(troopsUsed * 0.5);
    if (garrisonTroops <= 0) return;

    this.deps?.eventBus.emit('siege:autoGarrison', {
      territoryId,
      owner,
      garrisonTroops,
      timestamp: Date.now(),
    });
  }
}
