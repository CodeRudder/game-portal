/**
 * 引擎生命周期管理器
 *
 * 管理引擎运行状态机（idle → running → paused → destroyed），
 * 使用 setInterval 驱动 tick 回调。
 *
 * 设计原则：
 * - 严格状态转换校验，非法转换抛异常
 * - destroy 为终态，不可逆
 * - 暂停时记录时间戳，恢复时重置避免 dt 跳跃
 *
 * @module core/engine/LifecycleManager
 */

import type { EngineState } from '../types/engine';

/** 合法状态转换表 */
const TRANSITIONS: Record<EngineState, EngineState[]> = {
  idle: ['running'],
  running: ['paused', 'idle', 'destroyed'],
  paused: ['running', 'idle', 'destroyed'],
  destroyed: [],
};

/**
 * 生命周期管理器
 *
 * 管理引擎状态机，驱动游戏主循环。
 *
 * @example
 * ```ts
 * const lc = new LifecycleManager();
 * lc.start((dt) => updateSystems(dt), 1000);
 * lc.pause();
 * lc.resume((dt) => updateSystems(dt), 1000);
 * lc.stop();     // → idle
 * lc.destroy();  // → destroyed（终态）
 * ```
 */
export class LifecycleManager {
  private _state: EngineState = 'idle';
  private lastTickTime: number = 0;
  private tickIntervalId: ReturnType<typeof setInterval> | null = null;

  /** 当前引擎状态 */
  get state(): EngineState {
    return this._state;
  }

  /** 启动主循环：idle → running */
  start(tickCallback: (dt: number) => void, intervalMs: number): void {
    this.ensureTransition('running');
    this.lastTickTime = Date.now();
    this.tickIntervalId = setInterval(() => {
      const now = Date.now();
      const dt = (now - this.lastTickTime) / 1000;
      this.lastTickTime = now;
      tickCallback(dt);
    }, intervalMs);
    this._state = 'running';
  }

  /** 暂停主循环：running → paused */
  pause(): void {
    this.ensureTransition('paused');
    this.clearTimer();
    this._state = 'paused';
  }

  /** 恢复主循环：paused → running，重置时间戳避免 dt 跳跃 */
  resume(tickCallback: (dt: number) => void, intervalMs: number): void {
    this.ensureTransition('running');
    this.lastTickTime = Date.now();
    this.tickIntervalId = setInterval(() => {
      const now = Date.now();
      const dt = (now - this.lastTickTime) / 1000;
      this.lastTickTime = now;
      tickCallback(dt);
    }, intervalMs);
    this._state = 'running';
  }

  /** 停止主循环：running/paused → idle */
  stop(): void {
    this.ensureTransition('idle');
    this.clearTimer();
    this._state = 'idle';
  }

  /** 销毁引擎（终态）：任何非 destroyed 状态 → destroyed */
  destroy(): void {
    this.ensureTransition('destroyed');
    this.clearTimer();
    this._state = 'destroyed';
  }

  /** 检查是否可以转换到目标状态 */
  canTransition(to: EngineState): boolean {
    return TRANSITIONS[this._state]?.includes(to) ?? false;
  }

  /** 确保状态转换合法，否则抛异常 */
  private ensureTransition(to: EngineState): void {
    if (!this.canTransition(to)) {
      throw new Error(
        `[LifecycleManager] Invalid transition: "${this._state}" → "${to}". ` +
        `Allowed: [${TRANSITIONS[this._state].join(', ')}]`,
      );
    }
  }

  /** 清除定时器 */
  private clearTimer(): void {
    if (this.tickIntervalId !== null) {
      clearInterval(this.tickIntervalId);
      this.tickIntervalId = null;
    }
  }
}
