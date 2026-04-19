/**
 * 战斗系统 — 战斗加速控制器
 *
 * 职责：管理战斗速度档位切换、计算速度缩放系数
 * 来源：v4.0 CBT-6 战斗加速
 *
 * 速度档位：
 * - 1x：正常速度（回合间隔1000ms，动画正常播放）
 * - 2x：双倍速（回合间隔500ms，动画加速2倍）
 * - 4x：四倍速（回合间隔250ms，动画加速4倍 + 简化特效）
 *
 * @module engine/battle/BattleSpeedController
 */

import type { BattleSpeedState, SpeedChangeEvent } from './battle.types';
import { BattleSpeed } from './battle.types';
import { BATTLE_CONFIG } from './battle-config';

// ─────────────────────────────────────────────
// 速度变更监听器
// ─────────────────────────────────────────────

/**
 * 速度变更监听器接口
 *
 * UI层可注册监听器以响应速度变化
 */
export interface ISpeedChangeListener {
  /** 速度变更回调 */
  onSpeedChange(event: SpeedChangeEvent): void;
}

// ─────────────────────────────────────────────
// BattleSpeedController
// ─────────────────────────────────────────────

/**
 * 战斗加速控制器
 *
 * 管理战斗速度的切换和缩放计算。
 * 速度状态在战斗内持久化，切换场景不丢失。
 *
 * @example
 * ```ts
 * const controller = new BattleSpeedController();
 *
 * // 切换到2倍速
 * controller.setSpeed(BattleSpeed.X2);
 *
 * // 获取回合间隔
 * const interval = controller.getAdjustedTurnInterval(); // 500ms
 *
 * // 获取动画速度
 * const animSpeed = controller.getAnimationSpeedScale(); // 2.0
 * ```
 */
export class BattleSpeedController {
  /** 当前速度状态 */
  private speedState: BattleSpeedState;

  /** 速度变更监听器列表 */
  private listeners: ISpeedChangeListener[] = [];

  /** 历史速度变更记录（用于调试和回放） */
  private changeHistory: SpeedChangeEvent[] = [];

  constructor() {
    this.speedState = this.createSpeedState(
      BATTLE_CONFIG.DEFAULT_BATTLE_SPEED as BattleSpeed,
    );
  }

  // ─────────────────────────────────────────
  // 公共API
  // ─────────────────────────────────────────

  /**
   * 设置战斗速度
   *
   * @param speed - 目标速度档位
   * @returns 是否变更成功（相同速度返回false）
   */
  setSpeed(speed: BattleSpeed): boolean {
    // 验证速度档位
    if (!this.isValidSpeed(speed)) {
      return false;
    }

    // 相同速度不需要变更
    if (this.speedState.speed === speed) {
      return false;
    }

    const previousSpeed = this.speedState.speed;
    this.speedState = this.createSpeedState(speed);

    // 记录变更事件
    const event: SpeedChangeEvent = {
      previousSpeed,
      newSpeed: speed,
      timestamp: Date.now(),
    };
    this.changeHistory.push(event);

    // 通知监听器
    this.notifyListeners(event);

    return true;
  }

  /**
   * 获取当前速度状态
   */
  getSpeedState(): BattleSpeedState {
    return { ...this.speedState };
  }

  /**
   * 获取当前速度档位
   */
  getSpeed(): BattleSpeed {
    return this.speedState.speed;
  }

  /**
   * 切换到下一个速度档位
   *
   * 循环切换：1x → 2x → 4x → 1x
   *
   * @returns 切换后的速度档位
   */
  cycleSpeed(): BattleSpeed {
    const speeds = BATTLE_CONFIG.AVAILABLE_SPEEDS as readonly number[];
    const currentIndex = speeds.indexOf(this.speedState.speed);
    const nextIndex = (currentIndex + 1) % speeds.length;
    const nextSpeed = speeds[nextIndex] as BattleSpeed;

    this.setSpeed(nextSpeed);
    return nextSpeed;
  }

  /**
   * 获取调整后的回合间隔（ms）
   *
   * 实际间隔 = 基础间隔 / 速度倍率
   *
   * @returns 调整后的回合间隔
   */
  getAdjustedTurnInterval(): number {
    return Math.floor(
      BATTLE_CONFIG.BASE_TURN_INTERVAL_MS / this.speedState.speed,
    );
  }

  /**
   * 获取动画速度缩放系数
   *
   * 动画播放速度 = 正常速度 × 缩放系数
   *
   * @returns 动画速度缩放系数
   */
  getAnimationSpeedScale(): number {
    return this.speedState.animationSpeedScale;
  }

  /**
   * 获取回合间隔缩放系数
   *
   * @returns 间隔缩放系数（1/speed）
   */
  getTurnIntervalScale(): number {
    return this.speedState.turnIntervalScale;
  }

  /**
   * 是否需要简化特效
   *
   * 4x速度时为避免性能问题，简化粒子/光效
   */
  shouldSimplifyEffects(): boolean {
    return this.speedState.simplifiedEffects;
  }

  /**
   * 注册速度变更监听器
   *
   * @param listener - 监听器
   */
  addListener(listener: ISpeedChangeListener): void {
    if (!this.listeners.includes(listener)) {
      this.listeners.push(listener);
    }
  }

  /**
   * 移除速度变更监听器
   *
   * @param listener - 监听器
   */
  removeListener(listener: ISpeedChangeListener): void {
    const index = this.listeners.indexOf(listener);
    if (index >= 0) {
      this.listeners.splice(index, 1);
    }
  }

  /**
   * 获取速度变更历史
   */
  getChangeHistory(): SpeedChangeEvent[] {
    return [...this.changeHistory];
  }

  /**
   * 重置为默认速度
   */
  reset(): void {
    this.setSpeed(BATTLE_CONFIG.DEFAULT_BATTLE_SPEED as BattleSpeed);
    this.changeHistory = [];
  }

  /**
   * 序列化速度状态（用于存档）
   */
  serialize(): BattleSpeedState {
    return { ...this.speedState };
  }

  /**
   * 从存档恢复速度状态
   */
  deserialize(state: BattleSpeedState): void {
    this.speedState = { ...state };
  }

  // ─────────────────────────────────────────
  // 静态工具方法
  // ─────────────────────────────────────────

  /**
   * 验证速度档位是否合法
   */
  static isValidSpeed(speed: number): boolean {
    return (BATTLE_CONFIG.AVAILABLE_SPEEDS as readonly number[]).includes(speed);
  }

  /**
   * 获取所有可用速度档位
   */
  static getAvailableSpeeds(): BattleSpeed[] {
    return [...BATTLE_CONFIG.AVAILABLE_SPEEDS] as BattleSpeed[];
  }

  // ─────────────────────────────────────────
  // 内部方法
  // ─────────────────────────────────────────

  /**
   * 创建速度状态
   */
  private createSpeedState(speed: BattleSpeed): BattleSpeedState {
    return {
      speed,
      turnIntervalScale: 1 / speed,
      animationSpeedScale: speed,
      simplifiedEffects:
        BATTLE_CONFIG.SIMPLIFY_EFFECTS_AT_X4 && speed >= BattleSpeed.X4,
    };
  }

  /**
   * 验证速度档位
   */
  private isValidSpeed(speed: number): boolean {
    return BattleSpeedController.isValidSpeed(speed);
  }

  /**
   * 通知所有监听器
   */
  private notifyListeners(event: SpeedChangeEvent): void {
    for (const listener of this.listeners) {
      listener.onSpeedChange(event);
    }
  }
}
