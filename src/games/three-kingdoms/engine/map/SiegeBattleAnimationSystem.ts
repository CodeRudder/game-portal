/**
 * 攻城战斗动画系统 (I12)
 *
 * 管理攻城战斗的视觉表现:
 * - 行军→攻城动画无缝切换 (集结阶段 3s)
 * - 城防血条实时显示
 * - 策略特效 (强攻/围困/夜袭/内应)
 * - 战斗进度指示
 *
 * 生命周期:
 *   startSiegeAnimation() → assembly(3s) → battle → completeSiegeAnimation()
 *
 * 此系统是纯引擎层逻辑，不依赖任何 React 或 DOM API。
 * 渲染层通过 getActiveAnimations() 获取状态后自行绘制。
 *
 * @module engine/map/SiegeBattleAnimationSystem
 * @see flows.md MAP-F06 I12
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';
import type { SiegeStrategyType } from '../../core/map/siege-enhancer.types';
import type { BattleStartedEvent, BattleCompletedEvent } from './SiegeBattleSystem';

// ─────────────────────────────────────────────
// 类型定义
// ─────────────────────────────────────────────

/** 攻城动画阶段 */
export type SiegeAnimPhase = 'assembly' | 'battle' | 'completed';

/** 攻城动画状态 */
export interface SiegeAnimationState {
  /** 关联的攻占任务ID */
  taskId: string;
  /** 目标城池ID */
  targetCityId: string;
  /** 目标城池X坐标 (格子坐标) */
  targetX: number;
  /** 目标城池Y坐标 (格子坐标) */
  targetY: number;
  /** 当前动画阶段 */
  phase: SiegeAnimPhase;
  /** 集结阶段已过时间 (ms) */
  assemblyElapsedMs: number;
  /** 攻城策略 */
  strategy: SiegeStrategyType;
  /** 城防比值 (0~1, current/max) */
  defenseRatio: number;
  /** 进攻方阵营 */
  faction: 'wei' | 'shu' | 'wu' | 'neutral';
  /** 参战兵力 */
  troops: number;
  /** 动画开始时间戳 */
  startTimeMs: number;
  /** 战斗是否胜利 (仅在 completed 阶段有值) */
  victory: boolean | null;
}

/** 攻城动画配置 */
export interface SiegeAnimConfig {
  /** 集结阶段持续时间 (ms) */
  assemblyDurationMs: number;
  /** 完成后延迟移除 (ms) */
  completedLingerMs: number;
}

/** 攻城动画系统状态快照 */
export interface SiegeBattleAnimSystemState {
  /** 所有活跃动画 */
  activeAnimations: SiegeAnimationState[];
}

/** 已完成动画的停留信息 */
export interface CompletedLingerInfo {
  /** 关联的攻占任务ID */
  taskId: string;
  /** 已停留时间 (ms) */
  lingerElapsedMs: number;
}

/** 攻城动画系统存档数据 */
export interface SiegeBattleAnimSaveData {
  version: number;
  animations: SiegeAnimationState[];
  /** 已完成动画的停留经过时间 (用于精确恢复 linger 计时) */
  completedLinger?: CompletedLingerInfo[];
}

/** siegeAnim:started 事件数据 */
export interface SiegeAnimStartedEvent {
  taskId: string;
  targetCityId: string;
  phase: SiegeAnimPhase;
}

/** siegeAnim:phaseChanged 事件数据 */
export interface SiegeAnimPhaseChangedEvent {
  taskId: string;
  fromPhase: SiegeAnimPhase;
  toPhase: SiegeAnimPhase;
}

/** siegeAnim:completed 事件数据 */
export interface SiegeAnimCompletedEvent {
  taskId: string;
  targetCityId: string;
  victory: boolean;
}

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

/** 默认动画配置 */
const DEFAULT_ANIM_CONFIG: SiegeAnimConfig = {
  assemblyDurationMs: 3_000,   // 集结3秒
  completedLingerMs: 2_000,    // 完成后停留2秒
};

/** 序列化版本号 */
const SAVE_VERSION = 1;

// ─────────────────────────────────────────────
// SiegeBattleAnimationSystem
// ─────────────────────────────────────────────

/**
 * 攻城战斗动画系统
 *
 * 管理从行军到达→攻城战斗的视觉动画状态机。
 * 是纯引擎层逻辑，通过 update(dt) 驱动，渲染层轮询 getActiveAnimations() 获取绘制数据。
 *
 * @example
 * ```ts
 * const animSystem = new SiegeBattleAnimationSystem();
 * animSystem.init(deps);
 *
 * // 行军到达时启动动画
 * animSystem.startSiegeAnimation({
 *   taskId: 'task-001',
 *   targetCityId: 'city-luoyang',
 *   targetX: 25,
 *   targetY: 15,
 *   strategy: 'forceAttack',
 *   faction: 'wei',
 *   troops: 5000,
 * });
 *
 * // 游戏循环中更新
 * animSystem.update(deltaSeconds);
 *
 * // 战斗进度更新
 * animSystem.updateBattleProgress('task-001', 0.65);
 *
 * // 战斗完成
 * animSystem.completeSiegeAnimation('task-001', true);
 *
 * // 获取当前动画状态供渲染
 * const animations = animSystem.getActiveAnimations();
 * ```
 */
export class SiegeBattleAnimationSystem implements ISubsystem {
  readonly name = 'siegeBattleAnim';

  private deps!: ISystemDeps;
  private animations: Map<string, SiegeAnimationState> = new Map();
  private config: SiegeAnimConfig;

  /** 完成后等待移除的动画 taskId → 完成时累计经过时间 (ms) */
  private completedAtElapsedMs: Map<string, number> = new Map();

  /** 系统累计经过时间 (ms) */
  private totalElapsedMs: number = 0;

  /** 是否已初始化 (幂等守卫) */
  private _initialized: boolean = false;

  /** init() 注册的事件取消订阅函数 */
  private unsubscribers: Array<() => void> = [];

  constructor(config?: Partial<SiegeAnimConfig>) {
    this.config = { ...DEFAULT_ANIM_CONFIG, ...config };
  }

  // ── ISubsystem 生命周期 ──────────────────────

  /**
   * 初始化子系统，注入依赖并注册事件监听
   *
   * 幂等：多次调用只注册一次事件监听。
   */
  init(deps: ISystemDeps): void {
    if (this._initialized) return; // 幂等守卫
    this._initialized = true;

    this.deps = deps;
    this.animations.clear();
    this.completedAtElapsedMs.clear();
    this.totalElapsedMs = 0;

    // 监听 battle:started → 自动启动动画
    const unsub1 = this.deps.eventBus.on<BattleStartedEvent>('battle:started', (data) => {
      this.startSiegeAnimation({
        taskId: data.taskId,
        targetCityId: data.targetId,
        targetX: data.targetX,
        targetY: data.targetY,
        strategy: data.strategy,
        faction: data.faction,
        troops: data.troops,
      });
    });

    // 监听 battle:completed → 自动完成动画
    const unsub2 = this.deps.eventBus.on<BattleCompletedEvent>('battle:completed', (data) => {
      this.completeSiegeAnimation(data.taskId, data.victory);
    });

    this.unsubscribers = [unsub1, unsub2].filter(Boolean);
  }

  /**
   * 每帧/每回合更新
   *
   * 驱动动画状态机:
   * - assembly → battle: 集结时间到达后自动转换
   * - completed → 移除: 停留时间到达后自动移除
   *
   * @param dt - 距离上次更新的时间增量（秒）
   */
  update(dt: number): void {
    if (this.animations.size === 0) return;

    const dtMs = dt * 1000;
    this.totalElapsedMs += dtMs;
    const toRemove: string[] = [];

    for (const [taskId, anim] of this.animations) {
      // Phase: assembly → battle transition
      if (anim.phase === 'assembly') {
        anim.assemblyElapsedMs += dtMs;

        if (anim.assemblyElapsedMs >= this.config.assemblyDurationMs) {
          const fromPhase = anim.phase;
          anim.phase = 'battle';
          anim.assemblyElapsedMs = this.config.assemblyDurationMs;

          this.deps.eventBus.emit<SiegeAnimPhaseChangedEvent>('siegeAnim:phaseChanged', {
            taskId,
            fromPhase,
            toPhase: 'battle',
          });
        }
      }

      // Phase: completed → remove (linger then cleanup)
      if (anim.phase === 'completed') {
        const completedElapsed = this.completedAtElapsedMs.get(taskId);
        if (completedElapsed != null && this.totalElapsedMs - completedElapsed >= this.config.completedLingerMs) {
          toRemove.push(taskId);
        }
      }
    }

    // 移除过期的完成动画
    for (const taskId of toRemove) {
      this.animations.delete(taskId);
      this.completedAtElapsedMs.delete(taskId);
    }
  }

  /**
   * 获取子系统状态快照
   */
  getState(): SiegeBattleAnimSystemState {
    return {
      activeAnimations: Array.from(this.animations.values()),
    };
  }

  /**
   * 重置子系统到初始状态
   *
   * 清除动画数据但保留事件监听（不重置 _initialized），
   * 使得 reset 后系统仍能响应 battle:started / battle:completed 事件。
   */
  reset(): void {
    this.animations.clear();
    this.completedAtElapsedMs.clear();
    this.totalElapsedMs = 0;
    // 不重置 _initialized — 保持事件监听跨 reset 存活
  }

  /**
   * 销毁子系统
   *
   * 移除所有事件监听，清除动画数据，释放所有资源。
   * 销毁后可通过 init() 重新初始化。
   */
  destroy(): void {
    // 取消所有事件监听
    for (const unsub of this.unsubscribers) {
      unsub();
    }
    this.unsubscribers = [];

    // 清除动画数据
    this.animations.clear();
    this.completedAtElapsedMs.clear();

    // 重置初始化状态，允许重新 init
    this._initialized = false;
  }

  // ── 业务方法 ──────────────────────────────────

  /**
   * 启动攻城动画
   *
   * 当行军到达目标城池时调用，初始化动画状态为 assembly 阶段。
   *
   * @param params - 动画参数
   * @returns 创建的动画状态
   */
  startSiegeAnimation(params: {
    taskId: string;
    targetCityId: string;
    targetX: number;
    targetY: number;
    strategy: SiegeStrategyType;
    faction: 'wei' | 'shu' | 'wu' | 'neutral';
    troops: number;
  }): SiegeAnimationState {
    const { taskId, targetCityId, targetX, targetY, strategy, faction, troops } = params;

    // 如果已存在，先移除旧的
    if (this.animations.has(taskId)) {
      this.animations.delete(taskId);
      this.completedAtElapsedMs.delete(taskId);
    }

    const anim: SiegeAnimationState = {
      taskId,
      targetCityId,
      targetX,
      targetY,
      phase: 'assembly',
      assemblyElapsedMs: 0,
      strategy,
      defenseRatio: 1.0, // 初始满血
      faction,
      troops,
      startTimeMs: Date.now(),
      victory: null,
    };

    this.animations.set(taskId, anim);

    // 触发动画开始事件
    this.deps.eventBus.emit<SiegeAnimStartedEvent>('siegeAnim:started', {
      taskId,
      targetCityId,
      phase: 'assembly',
    });

    return anim;
  }

  /**
   * 更新战斗进度
   *
   * 由外部战斗系统调用，更新城防血条比例。
   *
   * @param taskId - 攻占任务ID
   * @param defenseRatio - 城防比值 (0~1)
   */
  updateBattleProgress(taskId: string, defenseRatio: number): void {
    const anim = this.animations.get(taskId);
    if (!anim) return;

    anim.defenseRatio = Math.max(0, Math.min(1, defenseRatio));
  }

  /**
   * 更新目标城池坐标
   *
   * 当目标城池坐标在后续确定时（如从 battle:started 事件中获取），
   * 可以通过此方法更新。
   *
   * @param taskId - 攻占任务ID
   * @param x - 城池X坐标
   * @param y - 城池Y坐标
   */
  updateTargetPosition(taskId: string, x: number, y: number): void {
    const anim = this.animations.get(taskId);
    if (!anim) return;
    anim.targetX = x;
    anim.targetY = y;
  }

  /**
   * 完成攻城动画
   *
   * 当战斗结束时调用，将动画状态切换为 completed。
   * 动画不会立即移除，而是在 completedLingerMs 后自动清除。
   *
   * @param taskId - 攻占任务ID
   * @param victory - 是否胜利
   */
  completeSiegeAnimation(taskId: string, victory: boolean): void {
    const anim = this.animations.get(taskId);
    if (!anim) return;

    const fromPhase = anim.phase;
    anim.phase = 'completed';
    anim.victory = victory;
    anim.defenseRatio = victory ? 0 : anim.defenseRatio;

    // 记录完成时的累计时间，用于 linger 后自动移除
    this.completedAtElapsedMs.set(taskId, this.totalElapsedMs);

    // 触发阶段变更事件
    this.deps.eventBus.emit<SiegeAnimPhaseChangedEvent>('siegeAnim:phaseChanged', {
      taskId,
      fromPhase,
      toPhase: 'completed',
    });

    // 触发完成事件
    this.deps.eventBus.emit<SiegeAnimCompletedEvent>('siegeAnim:completed', {
      taskId,
      targetCityId: anim.targetCityId,
      victory,
    });
  }

  /**
   * 取消攻城动画
   *
   * 立即移除动画，不经过 completed 阶段。
   *
   * @param taskId - 攻占任务ID
   */
  cancelSiegeAnimation(taskId: string): void {
    this.animations.delete(taskId);
    this.completedAtElapsedMs.delete(taskId);
  }

  /**
   * 获取指定任务的动画状态
   *
   * @param taskId - 攻占任务ID
   * @returns 动画状态，不存在则返回 null
   */
  getAnimation(taskId: string): SiegeAnimationState | null {
    return this.animations.get(taskId) ?? null;
  }

  /**
   * 获取所有活跃动画列表
   *
   * 供渲染层轮询获取当前需要绘制的动画状态。
   *
   * @returns 所有活跃动画状态数组
   */
  getActiveAnimations(): SiegeAnimationState[] {
    return Array.from(this.animations.values());
  }

  /**
   * 获取处于指定阶段的动画数量
   *
   * @param phase - 动画阶段
   * @returns 处于该阶段的动画数量
   */
  getAnimCountByPhase(phase: SiegeAnimPhase): number {
    let count = 0;
    for (const anim of this.animations.values()) {
      if (anim.phase === phase) count++;
    }
    return count;
  }

  // ── 序列化 ──────────────────────────────────

  /**
   * 序列化当前状态用于存档
   */
  serialize(): SiegeBattleAnimSaveData {
    // 保存已完成动画的停留经过时间
    const completedLinger: CompletedLingerInfo[] = [];
    for (const [taskId, completedAt] of this.completedAtElapsedMs) {
      const anim = this.animations.get(taskId);
      if (anim && anim.phase === 'completed') {
        completedLinger.push({
          taskId,
          lingerElapsedMs: this.totalElapsedMs - completedAt,
        });
      }
    }

    return {
      version: SAVE_VERSION,
      animations: Array.from(this.animations.values()),
      completedLinger: completedLinger.length > 0 ? completedLinger : undefined,
    };
  }

  /**
   * 从存档数据反序列化恢复状态
   */
  deserialize(data: unknown): void {
    this.animations.clear();
    this.completedAtElapsedMs.clear();

    if (!data || typeof data !== 'object') return;

    const saveData = data as SiegeBattleAnimSaveData;

    // 版本检查
    if (saveData.version !== SAVE_VERSION) {
      console.warn(
        `[SiegeBattleAnimSystem] Save version mismatch: expected ${SAVE_VERSION}, got ${saveData.version}. Attempting recovery.`,
      );
    }

    // 构建 completedLinger 映射
    const lingerMap = new Map<string, number>();
    if (Array.isArray(saveData.completedLinger)) {
      for (const info of saveData.completedLinger) {
        if (info && info.taskId) {
          lingerMap.set(info.taskId, info.lingerElapsedMs);
        }
      }
    }

    // 恢复动画
    if (Array.isArray(saveData.animations)) {
      for (const anim of saveData.animations) {
        if (anim && anim.taskId) {
          this.animations.set(anim.taskId, { ...anim });

          // completed 阶段的动画需要恢复停留计时
          if (anim.phase === 'completed') {
            const elapsedLinger = lingerMap.get(anim.taskId);
            if (elapsedLinger != null) {
              // 精确恢复: completedAt = totalElapsed - elapsedLinger
              this.completedAtElapsedMs.set(anim.taskId, this.totalElapsedMs - elapsedLinger);
            } else {
              // 向后兼容: 旧存档没有 completedLinger，重置停留计时
              this.completedAtElapsedMs.set(anim.taskId, this.totalElapsedMs);
            }
          }
        }
      }
    }
  }
}
