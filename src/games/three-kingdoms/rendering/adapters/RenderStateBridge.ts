/**
 * 渲染状态桥接
 *
 * 连接 L1 core/state/RenderStateAdapter 与 L4 渲染层各渲染器。
 * 订阅 L1 渲染状态变更，将状态分发到对应的渲染器。
 *
 * 依赖方向：L4 rendering → L1 core（仅此文件直接依赖 L1）
 * 其他渲染器文件只依赖此文件定义的接口，不直接 import L1。
 *
 * @module rendering/adapters/RenderStateBridge
 */

import { Container } from 'pixi.js';
import type { IRenderState, IRenderStateAdapter } from '../../core/state/RenderStateAdapter';
import type { Unsubscribe } from '../../core/types/events';

// ─────────────────────────────────────────────
// 渲染器基接口
// ─────────────────────────────────────────────

/**
 * 渲染器基接口
 *
 * 所有 L4 渲染器必须实现此接口，提供统一的生命周期管理。
 *
 * @example
 * ```ts
 * class MyRenderer implements IRenderer {
 *   init(container: Container) { ... }
 *   update(dt: number) { ... }
 *   destroy() { ... }
 *   get visible() { return true; }
 *   set visible(v: boolean) { ... }
 * }
 * ```
 */
export interface IRenderer {
  /** 初始化渲染器，创建 PIXI 对象并挂载到指定容器 */
  init(container: Container): void;
  /** 每帧更新，由 RenderLoop 调用 */
  update(dt: number): void;
  /** 销毁渲染器，释放所有 PIXI 资源和事件监听 */
  destroy(): void;
  /** 是否可见 */
  visible: boolean;
}

/** 渲染器状态变更回调，当 IRenderState 变更时由 RenderStateBridge 调用 */
export type RenderStateCallback = (state: IRenderState) => void;

/** 渲染器注册信息（内部使用） */
interface RegisteredRenderer {
  name: string;
  onStateChange: RenderStateCallback;
}

// ─────────────────────────────────────────────
// RenderStateBridge 类
// ─────────────────────────────────────────────

/**
 * 渲染状态桥接
 *
 * 作为 L1 与 L4 之间的唯一连接点，
 * 订阅 L1 的渲染状态变更并分发到各渲染器。
 *
 * @example
 * ```ts
 * const bridge = new RenderStateBridge(renderStateAdapter);
 * bridge.register('map', (state) => mapRenderer.updateState(state));
 * bridge.start();
 * bridge.destroy();
 * ```
 */
export class RenderStateBridge {
  private readonly adapter: IRenderStateAdapter;
  private readonly renderers = new Map<string, RegisteredRenderer>();
  private unsubscribe: Unsubscribe | null = null;
  private _started = false;

  constructor(adapter: IRenderStateAdapter) {
    this.adapter = adapter;
  }

  /** 注册渲染器状态回调 */
  register(name: string, onStateChange: RenderStateCallback): void {
    this.renderers.set(name, { name, onStateChange });
  }

  /** 注销渲染器状态回调 */
  unregister(name: string): void {
    this.renderers.delete(name);
  }

  /** 启动状态监听，订阅 L1 RenderStateAdapter 的状态变更通知 */
  start(): void {
    if (this._started) return;
    this.unsubscribe = this.adapter.subscribe((state) => {
      this.dispatchState(state);
    });
    this._started = true;
  }

  /** 停止状态监听 */
  stop(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    this._started = false;
  }

  /** 销毁桥接，停止监听并清空所有注册 */
  destroy(): void {
    this.stop();
    this.renderers.clear();
  }

  /** 手动触发一次状态分发，用于初始化时将当前状态推送到所有渲染器 */
  flush(): void {
    const state = this.adapter.getRenderState();
    this.dispatchState(state);
  }

  /** 将状态分发到所有已注册的渲染器（异常隔离） */
  private dispatchState(state: IRenderState): void {
    for (const [, entry] of this.renderers) {
      try {
        entry.onStateChange(state);
      } catch (e) {
        console.warn(`[RenderStateBridge] Renderer "${entry.name}" state callback error:`, e);
      }
    }
  }

  /** 是否已启动 */
  get started(): boolean {
    return this._started;
  }

  /** 已注册的渲染器数量 */
  get size(): number {
    return this.renderers.size;
  }
}

// ─────────────────────────────────────────────
// 重新导出 L1 渲染状态类型
// ─────────────────────────────────────────────

export type {
  IRenderState,
  IRenderStateAdapter,
  IBuildingRenderData,
  IResourceRenderData,
  IRenderEffect,
} from '../../core/state/RenderStateAdapter';
