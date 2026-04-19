/**
 * SpeedManager — 放置游戏加速管理器
 *
 * 管理游戏速度倍率（1x, 2x, 5x, 10x 等），支持临时加速道具效果、
 * 加速上限、以及速度变更事件通知。
 *
 * 设计原则：
 * - 零外部依赖，纯 TypeScript 实现
 * - 事件驱动，支持 UI 层监听速度变化
 * - 完整的存档/读档支持（含校验）
 * - 临时加速可叠加在基础速度之上
 *
 * @module engines/idle/modules/SpeedManager
 */

// ============================================================
// 类型定义
// ============================================================

/** 加速管理器配置 */
export interface SpeedConfig {
  /** 基础速度倍率，默认 1 */
  baseSpeed: number;
  /** 最大速度倍率，默认 10 */
  maxSpeed: number;
  /** 允许的速度档位，如 [1, 2, 5, 10] */
  allowedSpeeds: number[];
  /** 临时加速默认持续时间（毫秒），可选 */
  temporaryBoostDuration?: number;
}

/** 加速管理器状态 */
export interface SpeedState {
  /** 当前基础速度 */
  currentSpeed: number;
  /** 基础速度配置 */
  baseSpeed: number;
  /** 临时加速信息（null 表示无临时加速） */
  temporaryBoost: {
    /** 加速倍率 */
    multiplier: number;
    /** 剩余时间（毫秒） */
    remainingMs: number;
  } | null;
}

/** 加速管理器事件 */
export type SpeedEvent =
  | { type: 'speed_changed'; data: { from: number; to: number } }
  | { type: 'boost_activated'; data: { multiplier: number; durationMs: number } }
  | { type: 'boost_expired'; data: Record<string, never> }
  | { type: 'boost_updated'; data: { remainingMs: number } };

/** 事件监听器类型 */
export type SpeedEventListener = (event: SpeedEvent) => void;

// ============================================================
// 默认配置
// ============================================================

/** 默认加速配置 */
const DEFAULT_CONFIG: SpeedConfig = {
  baseSpeed: 1,
  maxSpeed: 10,
  allowedSpeeds: [1, 2, 5, 10],
};

// ============================================================
// SpeedManager 实现
// ============================================================

/**
 * 加速管理器 — 管理游戏速度倍率与临时加速
 *
 * @example
 * ```typescript
 * const speedMgr = new SpeedManager({
 *   baseSpeed: 1,
 *   maxSpeed: 10,
 *   allowedSpeeds: [1, 2, 5, 10],
 * });
 *
 * speedMgr.setSpeed(2);           // 设置 2 倍速
 * speedMgr.activateBoost(3, 5000); // 激活 3 倍临时加速 5 秒
 * speedMgr.getSpeed();            // 返回 6（2 × 3）
 * ```
 */
export class SpeedManager {
  /** 当前基础速度 */
  private currentSpeed: number;
  /** 基础速度配置 */
  private readonly baseSpeed: number;
  /** 最大速度倍率 */
  private readonly maxSpeed: number;
  /** 允许的速度档位 */
  private readonly allowedSpeeds: number[];
  /** 临时加速默认持续时间 */
  private readonly defaultBoostDuration: number;
  /** 临时加速状态 */
  private temporaryBoost: { multiplier: number; remainingMs: number } | null = null;
  /** 事件监听器列表 */
  private readonly listeners: SpeedEventListener[] = [];

  // ============================================================
  // 初始化
  // ============================================================

  /**
   * 创建加速管理器实例
   *
   * @param config - 加速配置，缺省字段使用默认值
   */
  constructor(config: Partial<SpeedConfig> = {}) {
    const merged: SpeedConfig = { ...DEFAULT_CONFIG, ...config };
    this.baseSpeed = merged.baseSpeed;
    this.maxSpeed = merged.maxSpeed;
    this.allowedSpeeds = [...merged.allowedSpeeds].sort((a, b) => a - b);
    this.defaultBoostDuration = merged.temporaryBoostDuration ?? 0;
    this.currentSpeed = this.baseSpeed;
  }

  // ============================================================
  // 速度控制
  // ============================================================

  /**
   * 设置基础速度
   *
   * @param speed - 目标速度（必须在 allowedSpeeds 中且不超过 maxSpeed）
   * @returns 是否设置成功
   */
  setSpeed(speed: number): boolean {
    if (!this.allowedSpeeds.includes(speed)) {
      return false;
    }
    if (speed > this.maxSpeed) {
      return false;
    }
    if (speed < 1) {
      return false;
    }
    const oldSpeed = this.currentSpeed;
    this.currentSpeed = speed;
    if (oldSpeed !== speed) {
      this.emit({ type: 'speed_changed', data: { from: oldSpeed, to: speed } });
    }
    return true;
  }

  /**
   * 获取当前有效速度（基础速度 × 临时加速倍率）
   *
   * @returns 当前有效速度
   */
  getSpeed(): number {
    const base = this.currentSpeed;
    if (this.temporaryBoost) {
      return Math.min(base * this.temporaryBoost.multiplier, this.maxSpeed);
    }
    return base;
  }

  /**
   * 获取当前基础速度（不含临时加速）
   *
   * @returns 基础速度
   */
  getBaseSpeed(): number {
    return this.currentSpeed;
  }

  // ============================================================
  // 临时加速
  // ============================================================

  /**
   * 激活临时加速
   *
   * @param multiplier - 加速倍率（必须 > 1）
   * @param durationMs - 持续时间（毫秒），默认使用配置值
   * @returns 是否激活成功
   */
  activateBoost(multiplier: number, durationMs?: number): boolean {
    if (multiplier <= 1) {
      return false;
    }
    const duration = durationMs ?? this.defaultBoostDuration;
    if (duration <= 0) {
      return false;
    }
    this.temporaryBoost = {
      multiplier,
      remainingMs: duration,
    };
    this.emit({
      type: 'boost_activated',
      data: { multiplier, durationMs: duration },
    });
    return true;
  }

  /**
   * 更新临时加速倒计时
   *
   * @param dt - 距上次更新的时间增量（毫秒）
   */
  update(dt: number): void {
    if (!this.temporaryBoost) return;
    this.temporaryBoost.remainingMs -= dt;
    if (this.temporaryBoost.remainingMs <= 0) {
      this.temporaryBoost = null;
      this.emit({ type: 'boost_expired', data: {} });
    } else {
      this.emit({
        type: 'boost_updated',
        data: { remainingMs: this.temporaryBoost.remainingMs },
      });
    }
  }

  // ============================================================
  // 状态管理
  // ============================================================

  /**
   * 获取当前完整状态（用于存档）
   *
   * @returns 加速管理器状态快照
   */
  getState(): SpeedState {
    return {
      currentSpeed: this.currentSpeed,
      baseSpeed: this.baseSpeed,
      temporaryBoost: this.temporaryBoost
        ? { ...this.temporaryBoost }
        : null,
    };
  }

  /**
   * 加载状态（含校验）
   *
   * @param state - 要加载的状态
   * @throws 当状态不合法时抛出错误
   */
  loadState(state: SpeedState): void {
    // 校验 currentSpeed
    if (typeof state.currentSpeed !== 'number' || state.currentSpeed < 1) {
      throw new Error('SpeedManager.loadState: currentSpeed 必须为 >= 1 的数字');
    }
    if (!this.allowedSpeeds.includes(state.currentSpeed)) {
      throw new Error(
        `SpeedManager.loadState: currentSpeed ${state.currentSpeed} 不在允许的速度档位中`,
      );
    }
    // 校验 temporaryBoost
    if (state.temporaryBoost !== null) {
      if (typeof state.temporaryBoost.multiplier !== 'number' || state.temporaryBoost.multiplier <= 1) {
        throw new Error('SpeedManager.loadState: temporaryBoost.multiplier 必须为 > 1 的数字');
      }
      if (typeof state.temporaryBoost.remainingMs !== 'number' || state.temporaryBoost.remainingMs < 0) {
        throw new Error('SpeedManager.loadState: temporaryBoost.remainingMs 必须为 >= 0 的数字');
      }
    }
    this.currentSpeed = state.currentSpeed;
    this.temporaryBoost = state.temporaryBoost
      ? { ...state.temporaryBoost }
      : null;
  }

  /**
   * 重置为初始状态
   */
  reset(): void {
    this.currentSpeed = this.baseSpeed;
    this.temporaryBoost = null;
  }

  // ============================================================
  // 事件系统
  // ============================================================

  /**
   * 注册事件监听器
   *
   * @param handler - 事件处理回调
   */
  on(handler: SpeedEventListener): void {
    this.listeners.push(handler);
  }

  /**
   * 注销事件监听器
   *
   * @param handler - 要移除的事件处理回调
   */
  off(handler: SpeedEventListener): void {
    const idx = this.listeners.indexOf(handler);
    if (idx !== -1) {
      this.listeners.splice(idx, 1);
    }
  }

  /**
   * 内部事件发射
   *
   * @param event - 要发射的事件
   */
  private emit(event: SpeedEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}
