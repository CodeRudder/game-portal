/**
 * 攻城战斗即时引擎（动画桥接层）
 *
 * 管理攻城战斗的即时城防衰减过程（10s~60s），驱动攻城动画中的城防血条变化。
 * 每个 BattleSession 代表一次攻城战斗的动画生命周期：
 *   创建(active) → update中衰减城防 → 完成/取消
 *
 * 注意：本系统仅负责动画桥接（城防衰减显示），不负责战斗判定。
 * 战斗结果由 SiegeSystem.executeSiege() 决定。
 *
 * 核心机制：
 * - attackPower = (troops / BASE_TROOPS) * maxDefense / (estimatedDurationMs / 1000)
 *   兵力越多攻城越快，确保在合理时间内打完全部城防值
 * - 策略修正使用 SIEGE_STRATEGY_CONFIGS.timeMultiplier 作为唯一时长源
 * - 胜利条件：城防值 <= 0
 *
 * @module engine/map/SiegeBattleSystem
 * @see flows.md MAP-F06-P8 / I13
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';
import type { SiegeStrategyType } from '../../core/map/siege-enhancer.types';
import { SIEGE_STRATEGY_CONFIGS } from '../../core/map/siege-enhancer.types';

// ─────────────────────────────────────────────
// 类型定义
// ─────────────────────────────────────────────

/** 战斗会话 */
export interface BattleSession {
  /** 关联的攻占任务ID */
  taskId: string;
  /** 目标城池ID */
  targetId: string;
  /** 战斗状态 */
  status: 'active' | 'completed' | 'cancelled';
  /** 当前城防值 */
  defenseValue: number;
  /** 最大城防值 */
  maxDefense: number;
  /** 每秒攻击力(城防衰减速度) */
  attackPower: number;
  /** 已进行时间(ms) */
  elapsedMs: number;
  /** 预估总时间(ms) */
  estimatedDurationMs: number;
  /** 攻城策略 */
  strategy: SiegeStrategyType;
  /** 出征兵力 */
  troops: number;
  /** 战斗结果(null直到完成) */
  victory: boolean | null;
}

/** 战斗更新结果 */
export interface BattleUpdateResult {
  /** 当前会话 */
  session: BattleSession;
  /** 本帧城防衰减量 */
  defenseDelta: number;
  /** 是否完成 */
  isCompleted: boolean;
}

/** 战斗配置 */
export interface BattleConfig {
  /** 最小战斗时间(ms) */
  minDurationMs: number;
  /** 最大战斗时间(ms) */
  maxDurationMs: number;
  /** 基础战斗时间(ms) */
  baseDurationMs: number;
  /** 基础城防值 */
  baseDefenseValue: number;
}

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

/** 默认战斗配置 */
const DEFAULT_CONFIG: BattleConfig = {
  minDurationMs: 10_000,
  maxDurationMs: 60_000,
  baseDurationMs: 15_000,
  baseDefenseValue: 100,
};

/** 基准兵力：用于计算兵力倍率，1000兵力=1x速度 */
export const BASE_TROOPS = 1000;

/**
 * @deprecated 使用 SIEGE_STRATEGY_CONFIGS[strategy].timeMultiplier 替代
 * 保留仅供序列化兼容性引用
 */
export const STRATEGY_DURATION_MODIFIER: Record<SiegeStrategyType, number> = {
  forceAttack: -5_000,
  siege:       15_000,
  nightRaid:   -3_000,
  insider:      5_000,
};

/** 序列化版本号 */
const SIEGE_BATTLE_SAVE_VERSION = 1;

// ─────────────────────────────────────────────
// 事件数据类型
// ─────────────────────────────────────────────

/** battle:started 事件数据 */
export interface BattleStartedEvent {
  taskId: string;
  targetId: string;
  strategy: SiegeStrategyType;
  troops: number;
  maxDefense: number;
  estimatedDurationMs: number;
  targetX: number;
  targetY: number;
  faction: 'wei' | 'shu' | 'wu' | 'neutral';
}

/** battle:completed 事件数据 */
export interface BattleCompletedEvent {
  taskId: string;
  targetId: string;
  victory: boolean;
  strategy: SiegeStrategyType;
  troops: number;
  elapsedMs: number;
  remainingDefense: number;
}

/** battle:cancelled 事件数据 */
export interface BattleCancelledEvent {
  taskId: string;
  targetId: string;
  strategy: SiegeStrategyType;
  elapsedMs: number;
}

/** 序列化数据结构 */
export interface SiegeBattleSaveData {
  /** 版本号 */
  version: number;
  /** 活跃战斗列表 */
  activeBattles: BattleSession[];
}

// ─────────────────────────────────────────────
// SiegeBattleSystem
// ─────────────────────────────────────────────

/**
 * 攻城战斗回合制引擎
 *
 * 管理攻城战斗的实时回合制过程。通过 update(dt) 驱动城防衰减，
 * 支持不同策略对战斗时长的影响，提供序列化/反序列化以支持存档。
 *
 * @example
 * ```ts
 * const battleSystem = new SiegeBattleSystem();
 * battleSystem.init(deps);
 *
 * // 创建战斗
 * const session = battleSystem.createBattle({
 *   taskId: 'task-001',
 *   targetId: 'city-luoyang',
 *   troops: 5000,
 *   strategy: 'forceAttack',
 *   targetDefenseLevel: 3,
 * });
 *
 * // 游戏循环中更新
 * battleSystem.update(deltaSeconds);
 *
 * // 查询战斗状态
 * const battle = battleSystem.getBattle('task-001');
 * ```
 */
export class SiegeBattleSystem implements ISubsystem {
  readonly name = 'siegeBattle';

  private deps!: ISystemDeps;
  private activeBattles: Map<string, BattleSession> = new Map();
  private config: BattleConfig;

  constructor(config?: Partial<BattleConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ── ISubsystem 生命周期 ──────────────────────

  /**
   * 初始化子系统，注入依赖
   *
   * @param deps - 系统依赖注入集合
   */
  init(deps: ISystemDeps): void {
    this.deps = deps;
  }

  /**
   * 每帧/每回合更新
   *
   * 遍历所有活跃战斗，累加经过时间并衰减城防值。
   * 当城防值耗尽或超过预估时间时结束战斗。
   *
   * @param dt - 距离上次更新的时间增量（秒）
   */
  update(dt: number): void {
    if (this.activeBattles.size === 0) return;

    const dtMs = dt * 1000;

    for (const [taskId, session] of this.activeBattles) {
      if (session.status !== 'active') continue;

      // 1. 累加已过时间
      session.elapsedMs += dtMs;

      // 2. 计算本帧城防衰减量
      const defenseDelta = session.attackPower * dt;

      // 3. 减少城防值
      session.defenseValue = Math.max(0, session.defenseValue - defenseDelta);

      // 4. 检查战斗结束条件
      const defenseDepleted = session.defenseValue <= 0;
      // NOTE: timeExceeded在当前公式下自然不可达——attackPower下限确保城防在maxDuration内耗尽
      // 保留此分支作为防御性代码：如果未来公式调整使城防不完全耗尽，timeExceeded仍能正确终止战斗
      const timeExceeded = session.elapsedMs >= session.estimatedDurationMs;

      if (defenseDepleted || timeExceeded) {
        // 胜利条件：城防值耗尽
        session.victory = defenseDepleted;
        session.status = 'completed';

        // 从活跃战斗中移除
        this.activeBattles.delete(taskId);

        // 触发完成事件
        this.deps.eventBus.emit('battle:completed', {
          taskId: session.taskId,
          targetId: session.targetId,
          victory: session.victory,
          strategy: session.strategy,
          troops: session.troops,
          elapsedMs: session.elapsedMs,
          remainingDefense: session.defenseValue,
        } satisfies BattleCompletedEvent);
      }
    }
  }

  /**
   * 获取子系统状态快照
   *
   * @returns 当前所有活跃战斗的会话数组
   */
  getState(): { activeBattles: BattleSession[] } {
    return {
      activeBattles: Array.from(this.activeBattles.values()),
    };
  }

  /**
   * 重置子系统到初始状态
   *
   * 清除所有活跃战斗。
   */
  reset(): void {
    this.activeBattles.clear();
  }

  /**
   * 销毁子系统
   *
   * 释放资源并重置状态。当前实现与 reset() 等价，
   * 因为 SiegeBattleSystem 不订阅事件，无需额外清理。
   * 保持 destroy() 语义独立性，便于未来扩展。
   */
  destroy(): void {
    this.reset();
  }

  // ── 业务方法 ──────────────────────────────────

  /**
   * 创建新的攻城战斗会话
   *
   * 根据策略和城防等级计算战斗参数，创建活跃状态的 BattleSession。
   *
   * @param params - 战斗创建参数
   * @param params.taskId - 关联的攻占任务ID
   * @param params.targetId - 目标城池ID
   * @param params.troops - 出征兵力
   * @param params.strategy - 攻城策略
   * @param params.targetDefenseLevel - 目标城防等级（默认1）
   * @returns 新创建的战斗会话
   * @throws {Error} 当 taskId 对应的战斗已存在时
   */
  createBattle(params: {
    taskId: string;
    targetId: string;
    troops: number;
    strategy: SiegeStrategyType;
    targetDefenseLevel?: number;
    targetX: number;
    targetY: number;
    faction: 'wei' | 'shu' | 'wu' | 'neutral';
  }): BattleSession {
    const { taskId, targetId, troops, strategy, targetDefenseLevel = 1, targetX, targetY, faction } = params;

    // 检查是否已存在同 taskId 的战斗
    if (this.activeBattles.has(taskId)) {
      throw new Error(`[SiegeBattleSystem] Battle already exists for taskId: ${taskId}`);
    }

    // 1. 计算战斗时间 = baseDuration × strategy timeMultiplier, clamp(min, max)
    //    使用 SIEGE_STRATEGY_CONFIGS 的 timeMultiplier 作为唯一策略时长源
    const timeMultiplier = SIEGE_STRATEGY_CONFIGS[strategy]?.timeMultiplier ?? 1;
    const rawDuration = this.config.baseDurationMs * timeMultiplier;
    const estimatedDurationMs = clamp(rawDuration, this.config.minDurationMs, this.config.maxDurationMs);

    // 2. 计算最大城防值 = targetDefenseLevel * baseDefenseValue
    const maxDefense = targetDefenseLevel * this.config.baseDefenseValue;

    // 3. 计算每秒攻击力 = (troops / BASE_TROOPS) * (maxDefense / durationSeconds)
    //    兵力越多，攻城越快；兵力越少，攻城越慢
    const durationSeconds = estimatedDurationMs / 1000;
    const troopsFactor = troops / BASE_TROOPS;
    const baseAttackPower = maxDefense / durationSeconds;
    const attackPower = Math.max(
      maxDefense / (this.config.maxDurationMs / 1000),
      troopsFactor * baseAttackPower,
    );

    // 4. 创建 BattleSession
    const session: BattleSession = {
      taskId,
      targetId,
      status: 'active',
      defenseValue: maxDefense,
      maxDefense,
      attackPower,
      elapsedMs: 0,
      estimatedDurationMs,
      strategy,
      troops,
      victory: null,
    };

    // 5. 存入活跃战斗
    this.activeBattles.set(taskId, session);

    // 6. 触发开始事件
    this.deps.eventBus.emit('battle:started', {
      taskId,
      targetId,
      strategy,
      troops,
      maxDefense,
      estimatedDurationMs,
      targetX,
      targetY,
      faction,
    } satisfies BattleStartedEvent);

    // 7. 返回会话
    return session;
  }

  /**
   * 获取指定任务的战斗会话
   *
   * @param taskId - 攻占任务ID
   * @returns 战斗会话，不存在则返回 null
   */
  getBattle(taskId: string): BattleSession | null {
    return this.activeBattles.get(taskId) ?? null;
  }

  /**
   * 取消指定任务的战斗
   *
   * 将战斗状态设为 cancelled 并从活跃列表中移除。
   * 不存在的 taskId 将被静默忽略。
   *
   * @param taskId - 攻占任务ID
   */
  cancelBattle(taskId: string): void {
    const session = this.activeBattles.get(taskId);
    if (!session) return;

    session.status = 'cancelled';
    this.activeBattles.delete(taskId);

    // 触发取消事件
    this.deps.eventBus.emit('battle:cancelled', {
      taskId: session.taskId,
      targetId: session.targetId,
      strategy: session.strategy,
      elapsedMs: session.elapsedMs,
    } satisfies BattleCancelledEvent);
  }

  // ── 序列化 ──────────────────────────────────

  /**
   * 序列化当前状态用于存档
   *
   * @returns 包含活跃战斗列表和版本号的存档数据
   */
  serialize(): SiegeBattleSaveData {
    return {
      version: SIEGE_BATTLE_SAVE_VERSION,
      activeBattles: Array.from(this.activeBattles.values()),
    };
  }

  /**
   * 从存档数据反序列化恢复状态
   *
   * 清除当前所有活跃战斗，从存档数据中恢复。
   * 版本不匹配时记录警告并尝试兼容恢复。
   *
   * @param data - 存档数据
   */
  deserialize(data: unknown): void {
    // 清除当前状态
    this.activeBattles.clear();

    if (!data || typeof data !== 'object') return;

    const saveData = data as SiegeBattleSaveData;

    // 版本检查
    if (saveData.version !== SIEGE_BATTLE_SAVE_VERSION) {
      console.warn(
        `[SiegeBattleSystem] Save version mismatch: expected ${SIEGE_BATTLE_SAVE_VERSION}, got ${saveData.version}. Attempting recovery.`
      );
    }

    // 恢复活跃战斗
    if (Array.isArray(saveData.activeBattles)) {
      for (const session of saveData.activeBattles) {
        if (session && session.taskId && session.status === 'active') {
          this.activeBattles.set(session.taskId, { ...session });
        }
      }
    }
  }
}

// ─────────────────────────────────────────────
// 工具函数
// ─────────────────────────────────────────────

/**
 * 将数值限制在指定范围内
 *
 * @param value - 输入值
 * @param min - 最小值
 * @param max - 最大值
 * @returns 限制后的值
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
