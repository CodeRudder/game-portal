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
 *   - 攻城结果处理
 *   - 存档序列化/反序列化
 *
 * @module engine/map/SiegeSystem
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';
import type {
  OwnershipStatus,
  LandmarkLevel,
} from '../../core/map';
import type {
  TerritoryData,
} from '../../core/map';

// ─────────────────────────────────────────────
// 攻城战类型定义
// ─────────────────────────────────────────────

/** 攻城条件校验错误码 */
export type SiegeErrorCode =
  | 'TARGET_NOT_FOUND'
  | 'TARGET_ALREADY_OWNED'
  | 'NOT_ADJACENT'
  | 'INSUFFICIENT_TROOPS'
  | 'INSUFFICIENT_GRAIN'
  | 'NO_TROOPS_AVAILABLE';

/** 攻城条件校验结果 */
export interface SiegeConditionResult {
  /** 是否满足攻城条件 */
  canSiege: boolean;
  /** 错误码（不满足时） */
  errorCode?: SiegeErrorCode;
  /** 错误描述 */
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
  /** 攻城是否成功发起 */
  launched: boolean;
  /** 战斗是否胜利 */
  victory: boolean;
  /** 目标领土ID */
  targetId: string;
  /** 目标领土名称 */
  targetName: string;
  /** 攻城消耗 */
  cost: SiegeCost;
  /** 占领结果（胜利时有值） */
  capture?: {
    territoryId: string;
    newOwner: OwnershipStatus;
    previousOwner: OwnershipStatus;
  };
  /** 失败原因 */
  failureReason?: string;
}

/** 攻城系统状态 */
export interface SiegeState {
  /** 攻城历史 */
  history: SiegeResult[];
  /** 总攻城次数 */
  totalSieges: number;
  /** 胜利次数 */
  victories: number;
  /** 失败次数 */
  defeats: number;
}

/** 攻城系统存档数据 */
export interface SiegeSaveData {
  /** 总攻城次数 */
  totalSieges: number;
  /** 胜利次数 */
  victories: number;
  /** 失败次数 */
  defeats: number;
  /** 版本号 */
  version: number;
}

// ─────────────────────────────────────────────
// 攻城配置常量
// ─────────────────────────────────────────────

/** 攻城最低兵力要求 */
const MIN_SIEGE_TROOPS = 100;

/** 攻城最低粮草要求 */
const MIN_SIEGE_GRAIN = 50;

/** 兵力消耗系数：基础消耗 × 目标防御值 / 100 */
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
 *
 * @example
 * ```ts
 * const siegeSystem = new SiegeSystem();
 * siegeSystem.init(deps);
 *
 * // 校验攻城条件
 * const result = siegeSystem.checkSiegeConditions('city-xuchang', 'player', 500, 200);
 *
 * // 执行攻城
 * const siegeResult = siegeSystem.executeSiege('city-xuchang', 'player', 500, 200);
 * ```
 */
export class SiegeSystem implements ISubsystem {
  readonly name = 'siege';

  private deps!: ISystemDeps;
  private history: SiegeResult[] = [];
  private totalSieges = 0;
  private victories = 0;
  private defeats = 0;

  // ─── ISubsystem 接口 ───────────────────────

  /** 初始化攻城系统 */
  init(deps: ISystemDeps): void {
    this.deps = deps;
    this.history = [];
    this.totalSieges = 0;
    this.victories = 0;
    this.defeats = 0;
  }

  /** 每帧更新（预留） */
  update(_dt: number): void {
    // 预留：后续版本用于攻城动画/计时
  }

  /** 获取系统状态快照 */
  getState(): SiegeState {
    return {
      history: [...this.history],
      totalSieges: this.totalSieges,
      victories: this.victories,
      defeats: this.defeats,
    };
  }

  /** 重置到初始状态 */
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
   * 条件：
   * 1. 目标领土存在
   * 2. 目标领土非己方
   * 3. 必须与己方领土相邻
   * 4. 兵力 ≥ 最低要求
   * 5. 粮草 ≥ 最低要求
   *
   * @param targetId - 目标领土ID
   * @param attackerOwner - 攻击方归属
   * @param availableTroops - 可用兵力
   * @param availableGrain - 可用粮草
   * @returns 校验结果
   */
  checkSiegeConditions(
    targetId: string,
    attackerOwner: OwnershipStatus,
    availableTroops: number,
    availableGrain: number,
  ): SiegeConditionResult {
    const territory = this.getTerritorySystem()?.getTerritoryById(targetId);

    // 条件1：目标领土存在
    if (!territory) {
      return {
        canSiege: false,
        errorCode: 'TARGET_NOT_FOUND',
        errorMessage: `领土 ${targetId} 不存在`,
      };
    }

    // 条件2：目标非己方
    if (territory.ownership === attackerOwner) {
      return {
        canSiege: false,
        errorCode: 'TARGET_ALREADY_OWNED',
        errorMessage: `${territory.name} 已是己方领土`,
      };
    }

    // 条件3：必须与己方领土相邻
    const territorySys = this.getTerritorySystem();
    if (territorySys && !territorySys.canAttackTerritory(targetId, attackerOwner)) {
      return {
        canSiege: false,
        errorCode: 'NOT_ADJACENT',
        errorMessage: `${territory.name} 不与己方领土相邻`,
      };
    }

    // 条件4：兵力检查
    const cost = this.calculateSiegeCost(territory);
    if (availableTroops < cost.troops) {
      return {
        canSiege: false,
        errorCode: 'INSUFFICIENT_TROOPS',
        errorMessage: `兵力不足，需要 ${cost.troops}，当前 ${availableTroops}`,
      };
    }

    // 条件5：粮草检查
    if (availableGrain < cost.grain) {
      return {
        canSiege: false,
        errorCode: 'INSUFFICIENT_GRAIN',
        errorMessage: `粮草不足，需要 ${cost.grain}，当前 ${availableGrain}`,
      };
    }

    return { canSiege: true };
  }

  // ─── 攻城消耗计算 ──────────────────────────

  /**
   * 计算攻城消耗
   *
   * 兵力消耗 = 基础消耗 × 目标防御值 / 100
   * 粮草消耗 = 基础消耗 × 目标等级
   *
   * @param territory - 目标领土
   * @returns 攻城消耗
   */
  calculateSiegeCost(territory: TerritoryData): SiegeCost {
    return {
      troops: Math.ceil(MIN_SIEGE_TROOPS * (territory.defenseValue / 100) * TROOP_COST_FACTOR),
      grain: Math.ceil(GRAIN_COST_FACTOR * territory.level),
    };
  }

  /**
   * 获取攻城消耗（按领土ID）
   *
   * @param targetId - 目标领土ID
   * @returns 攻城消耗（null 表示领土不存在）
   */
  getSiegeCostById(targetId: string): SiegeCost | null {
    const territory = this.getTerritorySystem()?.getTerritoryById(targetId);
    if (!territory) return null;
    return this.calculateSiegeCost(territory);
  }

  // ─── 攻城执行（#20）──────────────────────────

  /**
   * 执行攻城
   *
   * 流程：
   * 1. 校验攻城条件
   * 2. 计算攻城消耗
   * 3. 模拟战斗（简化版，基于兵力对比）
   * 4. 胜利则占领领土
   *
   * @param targetId - 目标领土ID
   * @param attackerOwner - 攻击方归属
   * @param availableTroops - 可用兵力
   * @param availableGrain - 可用粮草
   * @returns 攻城结果
   */
  executeSiege(
    targetId: string,
    attackerOwner: OwnershipStatus,
    availableTroops: number,
    availableGrain: number,
  ): SiegeResult {
    // 1. 校验条件
    const condition = this.checkSiegeConditions(targetId, attackerOwner, availableTroops, availableGrain);
    const territory = this.getTerritorySystem()?.getTerritoryById(targetId);

    if (!condition.canSiege || !territory) {
      return {
        launched: false,
        victory: false,
        targetId,
        targetName: territory?.name ?? targetId,
        cost: { troops: 0, grain: 0 },
        failureReason: condition.errorMessage ?? '条件不满足',
      };
    }

    // 2. 计算消耗
    const cost = this.calculateSiegeCost(territory);

    // 3. 模拟战斗（简化版）
    const victory = this.simulateBattle(availableTroops, territory);

    // 4. 处理结果
    const previousOwner = territory.ownership;
    const result: SiegeResult = {
      launched: true,
      victory,
      targetId,
      targetName: territory.name,
      cost,
    };

    this.totalSieges++;

    if (victory) {
      // 胜利：占领领土
      this.victories++;
      const captured = this.getTerritorySystem()?.captureTerritory(targetId, attackerOwner);
      result.capture = {
        territoryId: targetId,
        newOwner: attackerOwner,
        previousOwner,
      };

      // 发出攻城胜利事件
      this.deps?.eventBus.emit('siege:victory', {
        territoryId: targetId,
        territoryName: territory.name,
        newOwner: attackerOwner,
        previousOwner,
        cost,
      });
    } else {
      // 失败
      this.defeats++;
      result.failureReason = '攻城失败，兵力不足以攻破防线';

      this.deps?.eventBus.emit('siege:defeat', {
        territoryId: targetId,
        territoryName: territory.name,
        cost,
      });
    }

    this.history.push(result);
    return result;
  }

  /**
   * 使用外部战斗结果执行攻城
   *
   * 当使用 BattleEngine 进行完整战斗后，用战斗结果来决定攻城胜负。
   *
   * @param targetId - 目标领土ID
   * @param attackerOwner - 攻击方归属
   * @param availableTroops - 可用兵力
   * @param availableGrain - 可用粮草
   * @param battleVictory - 外部战斗是否胜利
   * @returns 攻城结果
   */
  executeSiegeWithResult(
    targetId: string,
    attackerOwner: OwnershipStatus,
    availableTroops: number,
    availableGrain: number,
    battleVictory: boolean,
  ): SiegeResult {
    // 校验条件
    const condition = this.checkSiegeConditions(targetId, attackerOwner, availableTroops, availableGrain);
    const territory = this.getTerritorySystem()?.getTerritoryById(targetId);

    if (!condition.canSiege || !territory) {
      return {
        launched: false,
        victory: false,
        targetId,
        targetName: territory?.name ?? targetId,
        cost: { troops: 0, grain: 0 },
        failureReason: condition.errorMessage ?? '条件不满足',
      };
    }

    const cost = this.calculateSiegeCost(territory);
    const previousOwner = territory.ownership;

    const result: SiegeResult = {
      launched: true,
      victory: battleVictory,
      targetId,
      targetName: territory.name,
      cost,
    };

    this.totalSieges++;

    if (battleVictory) {
      this.victories++;
      this.getTerritorySystem()?.captureTerritory(targetId, attackerOwner);
      result.capture = {
        territoryId: targetId,
        newOwner: attackerOwner,
        previousOwner,
      };

      this.deps?.eventBus.emit('siege:victory', {
        territoryId: targetId,
        territoryName: territory.name,
        newOwner: attackerOwner,
        previousOwner,
        cost,
      });
    } else {
      this.defeats++;
      result.failureReason = '攻城失败，战斗落败';

      this.deps?.eventBus.emit('siege:defeat', {
        territoryId: targetId,
        territoryName: territory.name,
        cost,
      });
    }

    this.history.push(result);
    return result;
  }

  // ─── 战斗模拟 ──────────────────────────────

  /**
   * 简化版战斗模拟
   *
   * 基于攻守兵力对比和防御加成计算胜率。
   * 攻方兵力 vs 守方防御值，考虑防御加成。
   *
   * @param attackerTroops - 攻方兵力
   * @param target - 目标领土
   * @returns 是否胜利
   */
  private simulateBattle(attackerTroops: number, target: TerritoryData): boolean {
    // 守方有效防御 = 防御值 × 等级加成
    const defenderPower = target.defenseValue * (1 + (target.level - 1) * 0.15);

    // 攻方有效兵力（扣除消耗后的剩余）
    const cost = this.calculateSiegeCost(target);
    const effectiveTroops = attackerTroops - cost.troops;

    // 胜率 = 攻方有效兵力 / (攻方有效兵力 + 守方有效防御)
    const winRate = effectiveTroops / (effectiveTroops + defenderPower);

    // 使用确定性种子避免随机性（基于领土ID的简单哈希）
    // 实际项目中应由 BattleEngine 决定
    return winRate > 0.4;
  }

  // ─── 统计查询 ──────────────────────────────

  /** 获取攻城历史 */
  getHistory(): SiegeResult[] {
    return [...this.history];
  }

  /** 获取总攻城次数 */
  getTotalSieges(): number {
    return this.totalSieges;
  }

  /** 获取胜利次数 */
  getVictories(): number {
    return this.victories;
  }

  /** 获取失败次数 */
  getDefeats(): number {
    return this.defeats;
  }

  /** 获取胜率 */
  getWinRate(): number {
    if (this.totalSieges === 0) return 0;
    return Math.round((this.victories / this.totalSieges) * 100) / 100;
  }

  // ─── 序列化 ────────────────────────────────

  /** 序列化为存档数据 */
  serialize(): SiegeSaveData {
    return {
      totalSieges: this.totalSieges,
      victories: this.victories,
      defeats: this.defeats,
      version: SIEGE_SAVE_VERSION,
    };
  }

  /** 从存档数据恢复 */
  deserialize(data: SiegeSaveData): void {
    this.totalSieges = data.totalSieges;
    this.victories = data.victories;
    this.defeats = data.defeats;
    this.history = [];
  }

  // ─── 内部方法 ──────────────────────────────

  /** 获取 TerritorySystem 子系统 */
  private getTerritorySystem(): import('./TerritorySystem').TerritorySystem | null {
    try {
      return this.deps?.registry?.get<import('./TerritorySystem').TerritorySystem>('territory') ?? null;
    } catch {
      return null;
    }
  }
}
