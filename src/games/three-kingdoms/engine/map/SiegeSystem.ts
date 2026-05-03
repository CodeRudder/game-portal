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
import type { SiegeStrategyType, SiegeStrategyConfig } from '../../core/map/siege-enhancer.types';
import { SIEGE_STRATEGY_CONFIGS } from '../../core/map/siege-enhancer.types';

// ─────────────────────────────────────────────
// 类型定义
// ─────────────────────────────────────────────

/** 攻城条件校验错误码 */
export type SiegeErrorCode =
  | 'TARGET_NOT_FOUND' | 'TARGET_ALREADY_OWNED' | 'NOT_ADJACENT'
  | 'INSUFFICIENT_TROOPS' | 'INSUFFICIENT_GRAIN' | 'NO_TROOPS_AVAILABLE'
  | 'DAILY_LIMIT_REACHED' | 'CAPTURE_COOLDOWN'
  | 'STRATEGY_ITEM_MISSING' | 'INSIDER_EXPOSED';

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
  /** 使用的攻城策略(MAP-F06-02) */
  strategy?: SiegeStrategyType;
  /** 策略奖励倍率 */
  rewardMultiplier?: number;
  /** 策略特殊效果是否触发 */
  specialEffectTriggered?: boolean;
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
  /** FIX-704: 占领冷却时间戳（领土ID -> 时间戳ms） */
  captureTimestamps?: Record<string, number>;
  /** 内应暴露冷却时间戳（领土ID -> 时间戳ms） */
  insiderExposures?: Record<string, number>;
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

  update(_dt: number): void {
    // P1-2: 自动检查跨天重置每日攻城次数
    const today = new Date().toISOString().slice(0, 10);
    if (this.lastSiegeDate && this.lastSiegeDate !== today) {
      this.dailySiegeCount = 0;
      this.lastSiegeDate = '';
    }
  }

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
    this.insiderExposures.clear();
  }

  // ─── 攻城策略（MAP-F06-02）────────────────────

  /** 获取策略配置 */
  getStrategyConfig(strategy: SiegeStrategyType): SiegeStrategyConfig {
    return SIEGE_STRATEGY_CONFIGS[strategy];
  }

  /** 获取所有可用策略配置 */
  getAllStrategies(): SiegeStrategyConfig[] {
    return Object.values(SIEGE_STRATEGY_CONFIGS);
  }

  /**
   * 计算策略修正后的攻城消耗
   * 策略影响兵力消耗倍率
   */
  calculateStrategySiegeCost(territory: TerritoryData, strategy: SiegeStrategyType): SiegeCost {
    const baseCost = this.calculateSiegeCost(territory);
    const config = SIEGE_STRATEGY_CONFIGS[strategy];
    return {
      troops: Math.ceil(baseCost.troops * config.troopCostMultiplier),
      grain: baseCost.grain,
    };
  }

  /**
   * 计算策略修正后的胜率
   * 策略影响胜率加成
   */
  computeStrategyWinRate(attackerPower: number, defenderPower: number, strategy: SiegeStrategyType): number {
    const baseRate = this.computeWinRate(attackerPower, defenderPower);
    const config = SIEGE_STRATEGY_CONFIGS[strategy];
    const WIN_RATE_MIN = 0.05;
    const WIN_RATE_MAX = 0.95;
    return Math.min(WIN_RATE_MAX, Math.max(WIN_RATE_MIN, baseRate + config.winRateBonus));
  }

  /**
   * 获取策略奖励倍率
   */
  getStrategyRewardMultiplier(strategy: SiegeStrategyType): number {
    return SIEGE_STRATEGY_CONFIGS[strategy].rewardMultiplier;
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
    strategy?: SiegeStrategyType,
  ): SiegeConditionResult {
    // FIX-701: NaN防护 — 兵力/粮草为NaN时拒绝攻城
    if (!Number.isFinite(availableTroops) || !Number.isFinite(availableGrain)) {
      return { canSiege: false, errorCode: 'INSUFFICIENT_TROOPS', errorMessage: '兵力或粮草数据异常' };
    }

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

    // 策略修正消耗
    const cost = strategy ? this.calculateStrategySiegeCost(territory, strategy) : this.calculateSiegeCost(territory);
    if (availableTroops < cost.troops) {
      return { canSiege: false, errorCode: 'INSUFFICIENT_TROOPS', errorMessage: `兵力不足，需要 ${cost.troops}，当前 ${availableTroops}` };
    }
    if (availableGrain < cost.grain) {
      return { canSiege: false, errorCode: 'INSUFFICIENT_GRAIN', errorMessage: `粮草不足，需要 ${cost.grain}，当前 ${availableGrain}` };
    }
    // 策略道具校验
    if (strategy) {
      const config = SIEGE_STRATEGY_CONFIGS[strategy];
      if (config.requiredItem && !this.hasItem(config.requiredItem)) {
        return { canSiege: false, errorCode: 'STRATEGY_ITEM_MISSING', errorMessage: `需要道具: ${config.name}令` };
      }
      // 内应策略: 检查暴露冷却
      if (strategy === 'insider' && this.isInsiderExposed(targetId)) {
        const remaining = this.getInsiderCooldownRemaining(targetId);
        const hours = Math.ceil(remaining / (60 * 60 * 1000));
        return { canSiege: false, errorCode: 'INSIDER_EXPOSED', errorMessage: `内应已暴露，${hours}小时后方可再次使用` };
      }
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

  /**
   * 计算攻城消耗：兵力 = 基础 × 防御/100 × 类型系数，粮草 = 固定500（⚠️PRD MAP-4统一声明）
   *
   * 类型系数（新手友好，最低80%）：
   *   - 资源点(res-*): 80% → 1级约800兵力
   *   - 关隘(pass-*): 100% → 1级约1000兵力
   *   - 城市(city-*): 80% → 1级约800兵力
   */
  calculateSiegeCost(territory: TerritoryData): SiegeCost {
    // FIX-702: 防御值NaN/负值/零值防护
    const defense = territory.defenseValue;
    if (!Number.isFinite(defense) || defense <= 0) {
      return { troops: MIN_SIEGE_TROOPS, grain: GRAIN_FIXED_COST };
    }
    // 按领土类型调整攻城兵力要求（资源点80%、关隘100%、城市80%）
    const typeFactor = territory.id.startsWith('res-') ? 0.8
      : territory.id.startsWith('pass-') ? 1.0
      : 0.8;
    return {
      troops: Math.ceil(MIN_SIEGE_TROOPS * (defense / 100) * TROOP_COST_FACTOR * typeFactor),
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
    strategy?: SiegeStrategyType,
  ): SiegeResult {
    const condition = this.checkSiegeConditions(targetId, attackerOwner, availableTroops, availableGrain, strategy);
    const territory = this.territorySys?.getTerritoryById(targetId);

    if (!condition.canSiege || !territory) {
      return {
        launched: false, victory: false, targetId,
        targetName: territory?.name ?? targetId,
        cost: { troops: 0, grain: 0 },
        failureReason: condition.errorMessage ?? '条件不满足',
        strategy,
      };
    }

    const cost = strategy ? this.calculateStrategySiegeCost(territory, strategy) : this.calculateSiegeCost(territory);
    const victory = strategy
      ? this.simulateBattleWithStrategy(availableTroops, territory, strategy)
      : this.simulateBattle(availableTroops, territory);
    return this.resolveSiege(targetId, territory, attackerOwner, cost, victory, strategy);
  }

  /** 使用外部战斗结果执行攻城 */
  executeSiegeWithResult(
    targetId: string,
    attackerOwner: OwnershipStatus,
    availableTroops: number,
    availableGrain: number,
    battleVictory: boolean,
    strategy?: SiegeStrategyType,
  ): SiegeResult {
    const condition = this.checkSiegeConditions(targetId, attackerOwner, availableTroops, availableGrain, strategy);
    const territory = this.territorySys?.getTerritoryById(targetId);

    if (!condition.canSiege || !territory) {
      return {
        launched: false, victory: false, targetId,
        targetName: territory?.name ?? targetId,
        cost: { troops: 0, grain: 0 },
        failureReason: condition.errorMessage ?? '条件不满足',
        strategy,
      };
    }

    const cost = strategy ? this.calculateStrategySiegeCost(territory, strategy) : this.calculateSiegeCost(territory);
    return this.resolveSiege(targetId, territory, attackerOwner, cost, battleVictory, strategy);
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
   * 策略修正战斗模拟（MAP-F06-02）
   * 策略影响兵力消耗和胜率
   */
  simulateBattleWithStrategy(attackerTroops: number, target: TerritoryData, strategy: SiegeStrategyType): boolean {
    const defenderPower = target.defenseValue;
    const cost = this.calculateStrategySiegeCost(target, strategy);
    const effectiveTroops = attackerTroops - cost.troops;
    if (effectiveTroops <= 0) return false;
    const winRate = this.computeStrategyWinRate(effectiveTroops, defenderPower, strategy);
    return Math.random() < winRate;
  }

  /**
   * 核心胜率计算公式（PRD §7.6 线性比率公式）
   *
   * 公式: min(95%, max(5%, (attackerPower / defenderPower) × 50%))
   * - 线性比率，直观易懂
   * - 攻防相等时胜率 = 50%
   */
  computeWinRate(attackerPower: number, defenderPower: number): number {
    const WIN_RATE_MIN = 0.05;
    const WIN_RATE_MAX = 0.95;
    const WIN_RATE_BASE = 0.5;

    // FIX-703: NaN防护 — 攻防战力为NaN时返回最低胜率
    if (!Number.isFinite(attackerPower) || !Number.isFinite(defenderPower)) return WIN_RATE_MIN;
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
    // FIX-704: 保存captureTimestamps冷却时间戳
    const captureTimestamps: Record<string, number> = {};
    for (const [id, ts] of this.captureTimestamps) {
      captureTimestamps[id] = ts;
    }
    // 保存内应暴露冷却
    const insiderExposures: Record<string, number> = {};
    for (const [id, ts] of this.insiderExposures) {
      insiderExposures[id] = ts;
    }
    return {
      totalSieges: this.totalSieges,
      victories: this.victories,
      defeats: this.defeats,
      dailySiegeCount: this.dailySiegeCount,
      lastSiegeDate: this.lastSiegeDate,
      captureTimestamps,
      insiderExposures,
      version: SIEGE_SAVE_VERSION,
    };
  }

  deserialize(data: SiegeSaveData): void {
    // FIX-705: null防护
    if (!data) return;
    this.totalSieges = data.totalSieges;
    this.victories = data.victories;
    this.defeats = data.defeats;
    this.dailySiegeCount = data.dailySiegeCount ?? 0;
    this.lastSiegeDate = data.lastSiegeDate ?? '';
    this.history = [];
    // FIX-704: 恢复captureTimestamps冷却时间戳
    this.captureTimestamps.clear();
    if (data.captureTimestamps) {
      for (const [id, ts] of Object.entries(data.captureTimestamps)) {
        if (Number.isFinite(ts)) {
          this.captureTimestamps.set(id, ts);
        }
      }
    }
    // 恢复内应暴露冷却
    this.insiderExposures.clear();
    if (data.insiderExposures) {
      for (const [id, ts] of Object.entries(data.insiderExposures)) {
        if (Number.isFinite(ts)) {
          this.insiderExposures.set(id, ts);
        }
      }
    }
  }

  // ─── 内部方法 ──────────────────────────────

  /** 统一处理攻城结果 */
  private resolveSiege(
    targetId: string,
    territory: TerritoryData,
    attackerOwner: OwnershipStatus,
    cost: SiegeCost,
    victory: boolean,
    strategy?: SiegeStrategyType,
  ): SiegeResult {
    const previousOwner = territory.ownership;
    const strategyConfig = strategy ? SIEGE_STRATEGY_CONFIGS[strategy] : null;
    const result: SiegeResult = {
      launched: true, victory, targetId, targetName: territory.name, cost,
      strategy,
      rewardMultiplier: strategyConfig?.rewardMultiplier ?? 1.0,
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

      // 策略特殊效果: 胜利时
      if (strategy === 'forceAttack') {
        // 强攻: 城防损坏(占领后城防-50%)
        this.applyDefenseReduction(targetId, 0.5);
        result.specialEffectTriggered = true;
      } else if (strategy === 'siege') {
        // 围困: 民心下降(占领后产出-20%持续24h)
        this.applyProductionDebuff(targetId, 0.2, 24 * 60 * 60 * 1000);
        result.specialEffectTriggered = true;
      } else if (strategy === 'insider') {
        // 内应: 城防完整保留 + 清除暴露状态
        this.clearInsiderExposure(targetId);
        result.specialEffectTriggered = true;
      }

      // 消耗策略道具
      if (strategyConfig?.requiredItem) {
        this.consumeItem(strategyConfig.requiredItem);
      }

      // P0-3修复：直接扣减攻城资源（不再依赖事件通知）
      this.deductSiegeResources(cost);

      this.deps?.eventBus.emit('siege:victory', {
        territoryId: targetId, territoryName: territory.name,
        newOwner: attackerOwner, previousOwner, cost, strategy,
        rewardMultiplier: result.rewardMultiplier,
      });
    } else {
      this.defeats++;
      // ⚠️ MAP PRD v1.1统一声明：攻城失败损失30%出征兵力，粮草不返还
      const defeatTroopLoss = Math.floor(cost.troops * 0.3);
      result.failureReason = '攻城失败，兵力不足以攻破防线';
      result.defeatTroopLoss = defeatTroopLoss;

      // 内应策略失败: 暴露标记(24h冷却)
      if (strategy === 'insider') {
        this.setInsiderExposure(targetId);
        result.specialEffectTriggered = true;
      }

      // 消耗策略道具(失败也消耗)
      if (strategyConfig?.requiredItem) {
        this.consumeItem(strategyConfig.requiredItem);
      }

      // P0-3修复：失败时也直接扣减资源（30%兵力+全部粮草）
      this.deductSiegeResources({ troops: defeatTroopLoss, grain: cost.grain });

      this.deps?.eventBus.emit('siege:defeat', {
        territoryId: targetId, territoryName: territory.name, cost,
        defeatTroopLoss, strategy,
      });
    }

    this.history.push(result);
    return result;
  }

  /** 直接扣减攻城资源（P0-3修复） */
  private deductSiegeResources(cost: SiegeCost): void {
    try {
      const resourceSys = this.deps?.registry?.get<any>('resource');
      if (resourceSys) {
        if (cost.troops > 0) resourceSys.consume?.('troops', cost.troops);
        if (cost.grain > 0) resourceSys.consume?.('grain', cost.grain);
      }
    } catch {
      // 资源系统不可用时静默处理（测试环境）
    }
  }

  // ─── 策略效果辅助方法 ────────────────────────

  /** 检查玩家是否拥有指定道具 */
  private hasItem(itemId: string): boolean {
    try {
      const resourceSys = this.deps?.registry?.get<any>('resource');
      if (resourceSys?.getItemCount) {
        return resourceSys.getItemCount(itemId) > 0;
      }
      return true; // 资源系统不可用时默认有道具(测试环境)
    } catch { return true; }
  }

  /** 消耗指定道具 */
  private consumeItem(itemId: string): void {
    try {
      const resourceSys = this.deps?.registry?.get<any>('resource');
      if (resourceSys?.consumeItem) {
        resourceSys.consumeItem(itemId, 1);
      }
    } catch { /* 资源系统不可用时静默处理 */ }
  }

  /** 内应暴露状态存储 */
  private insiderExposures: Map<string, number> = new Map();
  private static readonly INSIDER_COOLDOWN_MS = 24 * 60 * 60 * 1000;

  /** 检查城池内应是否已暴露 */
  isInsiderExposed(territoryId: string): boolean {
    const timestamp = this.insiderExposures.get(territoryId);
    if (!timestamp) return false;
    return Date.now() - timestamp < SiegeSystem.INSIDER_COOLDOWN_MS;
  }

  /** 获取内应冷却剩余时间(ms) */
  getInsiderCooldownRemaining(territoryId: string): number {
    const timestamp = this.insiderExposures.get(territoryId);
    if (!timestamp) return 0;
    return Math.max(0, SiegeSystem.INSIDER_COOLDOWN_MS - (Date.now() - timestamp));
  }

  /** 设置内应暴露标记 */
  private setInsiderExposure(territoryId: string): void {
    this.insiderExposures.set(territoryId, Date.now());
    this.deps?.eventBus.emit('siege:insiderExposed', { territoryId, cooldownMs: SiegeSystem.INSIDER_COOLDOWN_MS });
  }

  /** 清除内应暴露标记(攻城成功时) */
  private clearInsiderExposure(territoryId: string): void {
    this.insiderExposures.delete(territoryId);
  }

  /** 应用城防降低效果(强攻策略) */
  private applyDefenseReduction(territoryId: string, reductionRate: number): void {
    this.deps?.eventBus.emit('siege:defenseReduced', { territoryId, reductionRate });
  }

  /** 应用产出降低效果(围困策略) */
  private applyProductionDebuff(territoryId: string, debuffRate: number, durationMs: number): void {
    this.deps?.eventBus.emit('siege:productionDebuff', { territoryId, debuffRate, durationMs });
  }

  /** 获取 TerritorySystem 子系统 */
  private get territorySys(): import('./TerritorySystem').TerritorySystem | null {
    try {
      return this.deps?.registry?.get<import('./TerritorySystem').TerritorySystem>('territory') ?? null;
    } catch { return null; }
  }

  /** 获取 ExpeditionSystem 子系统 */
  private get expeditionSys(): import('./ExpeditionSystem').ExpeditionSystem | null {
    try {
      return this.deps?.registry?.get<import('./ExpeditionSystem').ExpeditionSystem>('expedition') ?? null;
    } catch { return null; }
  }

  // ─── 编队攻城（G5+H4）──────────────────────────

  /**
   * 使用出征编队执行攻城（新流程）
   *
   * 流程: 校验编队 → 计算消耗 → 战斗模拟 → 伤亡计算 → 领土变更
   *
   * @param forceId 出征编队ID
   * @param targetId 目标领土ID
   * @param attackerOwner 攻城方
   * @param availableGrain 可用粮草
   * @param strategy 攻城策略（可选）
   * @returns 攻城结果（含伤亡详情）
   */
  executeSiegeWithExpedition(
    forceId: string,
    targetId: string,
    attackerOwner: OwnershipStatus,
    availableGrain: number,
    strategy?: SiegeStrategyType,
  ): import('./SiegeSystem').SiegeResult & { casualties?: import('./expedition-types').CasualtyResult } {
    const expeditionSys = this.expeditionSys;

    // 如果没有ExpeditionSystem，回退到旧流程
    if (!expeditionSys) {
      return {
        launched: false, victory: false, targetId, targetName: targetId,
        cost: { troops: 0, grain: 0 },
        failureReason: '出征系统未初始化',
        strategy,
      };
    }

    // 校验编队
    const forceValidation = expeditionSys.validateForceForExpedition(forceId);
    if (!forceValidation.valid) {
      const force = expeditionSys.getForce(forceId);
      return {
        launched: false, victory: false, targetId,
        targetName: this.territorySys?.getTerritoryById(targetId)?.name ?? targetId,
        cost: { troops: 0, grain: 0 },
        failureReason: forceValidation.errorMessage ?? '编队校验失败',
        strategy,
      };
    }

    const force = expeditionSys.getForce(forceId)!;

    // 校验攻城条件（使用编队的兵力）
    const condition = this.checkSiegeConditions(targetId, attackerOwner, force.troops, availableGrain, strategy);
    if (!condition.canSiege) {
      return {
        launched: false, victory: false, targetId,
        targetName: this.territorySys?.getTerritoryById(targetId)?.name ?? targetId,
        cost: { troops: 0, grain: 0 },
        failureReason: condition.errorMessage ?? '条件不满足',
        strategy,
      };
    }

    const territory = this.territorySys?.getTerritoryById(targetId)!;

    // 计算消耗
    const cost = strategy ? this.calculateStrategySiegeCost(territory, strategy) : this.calculateSiegeCost(territory);

    // 应用将领战力加成（考虑受伤）
    const heroPowerMultiplier = expeditionSys.getHeroPowerMultiplier(force.heroId);
    const effectiveTroops = Math.floor(force.troops * heroPowerMultiplier);

    // 战斗模拟
    const victory = strategy
      ? this.simulateBattleWithStrategy(effectiveTroops, territory, strategy)
      : this.simulateBattle(effectiveTroops, territory);

    // 计算战斗结果类型（用于伤亡计算）
    const battleResultType = this.determineBattleResult(effectiveTroops, territory, victory);

    // 计算伤亡
    const casualties = expeditionSys.calculateCasualties(forceId, battleResultType);

    // 执行攻城结果
    const result = this.resolveSiege(targetId, territory, attackerOwner, cost, victory, strategy);

    return {
      ...result,
      casualties: casualties ?? undefined,
    };
  }

  /**
   * 判断战斗结果类型（用于伤亡计算）
   *
   * 胜利时根据胜率判断是普通胜利还是大胜
   * 失败时根据兵力差距判断是普通失败还是惨败
   */
  private determineBattleResult(
    attackerTroops: number,
    target: TerritoryData,
    victory: boolean,
  ): 'victory' | 'defeat' | 'rout' {
    if (victory) {
      return 'victory';
    }

    // 失败时，根据兵力差距判断
    const defenderPower = target.defenseValue;
    const ratio = attackerTroops / defenderPower;

    if (ratio < 0.3) {
      return 'rout'; // 兵力差距悬殊，惨败
    }
    return 'defeat'; // 普通失败
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
