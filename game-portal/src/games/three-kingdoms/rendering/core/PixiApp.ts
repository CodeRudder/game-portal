/**
 * PixiJS Application 封装
 *
 * 对 PIXI.Application 的生命周期管理进行封装，
 * 提供 canvas 创建、场景管理和渲染循环的统一入口。
 *
 * 职责：
 *   - 创建和销毁 PIXI.Application 实例
 *   - 管理 canvas 元素的挂载和卸载
 *   - 提供统一的 addChild / removeChild 接口
 *   - 暴露 ticker 供渲染循环使用
 *
 * @module rendering/core/PixiApp
 */

import { Application, Container } from 'pixi.js';
import type { RenderLoop } from './RenderLoop';

// ─────────────────────────────────────────────
// 配置接口
// ─────────────────────────────────────────────

/** PixiApp 初始化配置 */
export interface IPixiAppConfig {
  /** 画布宽度（像素） */
  width: number;
  /** 画布高度（像素） */
  height: number;
  /** 背景颜色（十六进制） */
  backgroundColor: number;
  /** 设备像素比，默认 window.devicePixelRatio */
  resolution?: number;
  /** 是否抗锯齿 */
  antialias?: boolean;
}

/** PixiApp 的默认配置 */
const DEFAULT_CONFIG: IPixiAppConfig = {
  width: 800,
  height: 600,
  backgroundColor: 0x1a1a2e,
  resolution: typeof window !== 'undefined' ? window.devicePixelRatio : 1,
  antialias: true,
};

// ─────────────────────────────────────────────
// PixiApp 类
// ─────────────────────────────────────────────

/**
 * PixiJS Application 封装
 *
 * 管理 PIXI.Application 的完整生命周期，提供场景树操作和渲染循环接入点。
 * 所有渲染器通过 PixiApp 获取 stage 和 ticker。
 *
 * @example
 * ```ts
 * const app = new PixiApp();
 * await app.init({ width: 1280, height: 720 });
 * app.mount(document.getElementById('game-container')!);
 *
 * // 添加渲染层
 * const mapLayer = new Container();
 * app.addChild(mapLayer);
 *
 * // 销毁
 * app.destroy();
 * ```
 */
export class PixiApp {
  private app: Application | null = null;
  private config: IPixiAppConfig;
  private _initialized = false;
  private _destroyed = false;

  constructor(config?: Partial<IPixiAppConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ─── 生命周期 ───────────────────────────────

  /**
   * 初始化 PixiJS Application
   *
   * 创建 PIXI.Application 实例并完成初始化。
   * 必须在使用其他方法之前调用。
   */
  async init(): Promise<void> {
    if (this._initialized) return;

    this.app = new Application();
    await this.app.init({
      width: this.config.width,
      height: this.config.height,
      background: this.config.backgroundColor,
      resolution: this.config.resolution,
      antialias: this.config.antialias,
      autoDensity: true,
    });

    this._initialized = true;
  }

  /**
   * 将 canvas 挂载到 DOM 元素
   *
   * @param container - 挂载目标 DOM 元素
   */
  mount(container: HTMLElement): void {
    if (!this.app?.canvas) {
      throw new Error('[PixiApp] Cannot mount before init()');
    }
    container.appendChild(this.app.canvas);
  }

  /**
   * 销毁 PixiJS Application
   *
   * 释放所有 GPU 资源、移除 canvas、清理事件监听。
   */
  destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;
    this._initialized = false;

    if (this.app) {
      this.app.destroy(true);
      this.app = null;
    }
  }

  // ─── 场景管理 ───────────────────────────────

  /**
   * 向 stage 添加子容器
   *
   * @param child - 要添加的 PIXI.Container
   */
  addChild(child: Container): void {
    this.getApp().stage.addChild(child);
  }

  /**
   * 从 stage 移除子容器
   *
   * @param child - 要移除的 PIXI.Container
   */
  removeChild(child: Container): void {
    this.getApp().stage.removeChild(child);
  }

  // ─── 访问器 ─────────────────────────────────

  /** 获取 PIXI.Application 实例（已初始化状态） */
  getApp(): Application {
    if (!this.app) {
      throw new Error('[PixiApp] Application not initialized. Call init() first.');
    }
    return this.app;
  }

  /** 获取 ticker，供 RenderLoop 注册更新回调 */
  get ticker() {
    return this.getApp().ticker;
  }

  /** 获取 canvas 元素 */
  get canvas(): HTMLCanvasElement {
    return this.getApp().canvas as HTMLCanvasElement;
  }

  /** 获取画布宽度 */
  get width(): number {
    return this.config.width;
  }

  /** 获取画布高度 */
  get height(): number {
    return this.config.height;
  }

  /** 是否已初始化 */
  get initialized(): boolean {
    return this._initialized;
  }

  /** 是否已销毁 */
  get destroyed(): boolean {
    return this._destroyed;
  }
}
