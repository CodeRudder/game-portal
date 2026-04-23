/**
 * 渲染循环管理
 *
 * 管理所有注册渲染器的 update 调度，支持暂停/恢复。
 * 基于 PIXI.Ticker 驱动，统一分发 dt（delta time）到各渲染器。
 *
 * 职责：
 *   - 注册/注销渲染器
 *   - 每帧调用所有渲染器的 update(dt)
 *   - 支持暂停/恢复渲染循环
 *   - 异常隔离：单个渲染器报错不影响其他渲染器
 *
 * @module rendering/core/RenderLoop
 */

import type { IRenderer } from '../adapters/RenderStateBridge';
import { gameLog } from '../../core/logger';

// ─────────────────────────────────────────────
// 类型定义
// ─────────────────────────────────────────────

/** 渲染器注册条目 */
interface RendererEntry {
  /** 渲染器名称（用于调试和日志） */
  name: string;
  /** 渲染器实例 */
  renderer: IRenderer;
  /** 更新优先级（数值越小越先执行） */
  priority: number;
}

/** 渲染器注册选项 */
export interface IRendererRegistration {
  /** 渲染器名称 */
  name: string;
  /** 渲染器实例 */
  renderer: IRenderer;
  /** 更新优先级，默认 0 */
  priority?: number;
}

// ─────────────────────────────────────────────
// RenderLoop 类
// ─────────────────────────────────────────────

/**
 * 渲染循环管理器
 *
 * 统一管理所有渲染器的帧更新调度。
 * 支持按优先级排序、暂停/恢复和异常隔离。
 *
 * @example
 * ```ts
 * const loop = new RenderLoop();
 * loop.register({ name: 'map', renderer: mapRenderer, priority: 0 });
 * loop.register({ name: 'battle', renderer: battleRenderer, priority: 10 });
 *
 * // 绑定到 PixiJS ticker
 * pixiApp.ticker.add((ticker) => loop.update(ticker.deltaTime));
 *
 * loop.pause();
 * loop.resume();
 * ```
 */
export class RenderLoop {
  private readonly entries: RendererEntry[] = [];
  private _paused = false;
  private _sorted = true;

  // ─── 注册管理 ───────────────────────────────

  /**
   * 注册渲染器
   *
   * @param options - 注册选项
   */
  register(options: IRendererRegistration): void {
    const entry: RendererEntry = {
      name: options.name,
      renderer: options.renderer,
      priority: options.priority ?? 0,
    };
    this.entries.push(entry);
    this._sorted = false;
  }

  /**
   * 注销渲染器
   *
   * @param name - 渲染器名称
   */
  unregister(name: string): void {
    const idx = this.entries.findIndex((e) => e.name === name);
    if (idx >= 0) {
      this.entries.splice(idx, 1);
    }
  }

  /**
   * 按名称查找渲染器
   *
   * @param name - 渲染器名称
   */
  getRenderer<T extends IRenderer>(name: string): T | undefined {
    return this.entries.find((e) => e.name === name)?.renderer as T | undefined;
  }

  // ─── 帧更新 ─────────────────────────────────

  /**
   * 每帧调用所有渲染器的 update
   *
   * 按优先级从小到大依次执行，暂停时跳过。
   * 单个渲染器异常不影响后续渲染器。
   *
   * @param dt - 帧间隔时间（秒）
   */
  update(dt: number): void {
    if (this._paused) return;

    // 惰性排序
    if (!this._sorted) {
      this.entries.sort((a, b) => a.priority - b.priority);
      this._sorted = true;
    }

    for (const entry of this.entries) {
      try {
        if (entry.renderer.visible) {
          entry.renderer.update(dt);
        }
      } catch (e) {
        gameLog.warn(`[RenderLoop] Renderer "${entry.name}" update error:`, e);
      }
    }
  }

  // ─── 暂停/恢复 ─────────────────────────────

  /** 暂停渲染循环 */
  pause(): void {
    this._paused = true;
  }

  /** 恢复渲染循环 */
  resume(): void {
    this._paused = false;
  }

  // ─── 访问器 ─────────────────────────────────

  /** 是否暂停 */
  get paused(): boolean {
    return this._paused;
  }

  /** 已注册的渲染器数量 */
  get size(): number {
    return this.entries.length;
  }
}
