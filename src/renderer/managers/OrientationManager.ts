/**
 * renderer/managers/OrientationManager.ts — 横竖屏管理器
 *
 * 负责检测和处理横竖屏切换：
 * - 监听窗口尺寸变化
 * - 计算设计分辨率到实际分辨率的缩放比
 * - 通知渲染层调整布局策略
 *
 * @module renderer/managers/OrientationManager
 */

import type { RendererConfig, OrientationLayout, IOrientationManager } from '../types';

// ═══════════════════════════════════════════════════════════════
// OrientationManager
// ═══════════════════════════════════════════════════════════════

/**
 * 横竖屏管理器
 *
 * 设计分辨率策略：
 * - 横屏：designWidth × designHeight（默认 1920×1080）
 * - 竖屏：designWidthPortrait × designHeightPortrait（默认 1080×1920）
 *
 * 缩放策略：contain（等比缩放，保持完整画面，可能有黑边）
 *
 * @example
 * ```ts
 * const om = new OrientationManager();
 * om.init(containerEl, config);
 * const layout = om.getOrientation(); // 'landscape' | 'portrait'
 * ```
 */
export class OrientationManager implements IOrientationManager {
  // ─── 配置 ─────────────────────────────────────────────────

  /** 渲染器配置 */
  private config: RendererConfig | null = null;

  // ─── 状态 ─────────────────────────────────────────────────

  /** 当前方向 */
  private orientation: OrientationLayout = 'landscape';

  /** 当前设计尺寸 */
  private designSize: { width: number; height: number } = { width: 1920, height: 1080 };

  /** 当前缩放值 */
  private scale: number = 1;

  // ─── DOM 引用 ─────────────────────────────────────────────

  /** 容器 DOM 元素 */
  private container: HTMLDivElement | null = null;

  // ─── 事件 ─────────────────────────────────────────────────

  /** 方向变化回调列表 */
  private callbacks: Set<(layout: OrientationLayout) => void> = new Set();

  // ─── ResizeObserver ───────────────────────────────────────

  /** ResizeObserver 实例 */
  private resizeObserver: ResizeObserver | null = null;

  /** window resize 绑定函数（用于 cleanup） */
  private boundResizeHandler: (() => void) | null = null;

  // ═══════════════════════════════════════════════════════════
  // 初始化
  // ═══════════════════════════════════════════════════════════

  /**
   * 初始化横竖屏管理器
   *
   * @param container - 渲染器容器 DOM
   * @param config - 渲染器配置
   */
  init(container: HTMLDivElement, config: RendererConfig): void {
    this.container = container;
    this.config = config;

    // 初始计算
    this.update(container.clientWidth, container.clientHeight);

    // 监听容器尺寸变化（使用 ResizeObserver）
    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          this.update(width, height);
        }
      }
    });
    this.resizeObserver.observe(container);

    // 备用：监听 window resize
    this.boundResizeHandler = () => {
      if (this.container) {
        this.update(this.container.clientWidth, this.container.clientHeight);
      }
    };
    window.addEventListener('resize', this.boundResizeHandler);
  }

  // ═══════════════════════════════════════════════════════════
  // 公共接口
  // ═══════════════════════════════════════════════════════════

  /**
   * 获取当前方向
   */
  getOrientation(): OrientationLayout {
    return this.orientation;
  }

  /**
   * 获取当前设计尺寸
   */
  getDesignSize(): { width: number; height: number } {
    return { ...this.designSize };
  }

  /**
   * 获取当前缩放值
   */
  getScale(): number {
    return this.scale;
  }

  /**
   * 注册方向变化回调
   *
   * @returns 取消注册的函数
   */
  onOrientationChange(callback: (layout: OrientationLayout) => void): () => void {
    this.callbacks.add(callback);
    return () => {
      this.callbacks.delete(callback);
    };
  }

  /**
   * 外部触发的 resize 处理
   *
   * 由 GameRenderer.resize() 调用。
   */
  handleResize(width: number, height: number): void {
    this.update(width, height);
  }

  /**
   * 销毁
   */
  destroy(): void {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    if (this.boundResizeHandler) {
      window.removeEventListener('resize', this.boundResizeHandler);
      this.boundResizeHandler = null;
    }
    this.callbacks.clear();
    this.container = null;
    this.config = null;
  }

  // ═══════════════════════════════════════════════════════════
  // 内部方法
  // ═══════════════════════════════════════════════════════════

  /**
   * 更新方向和缩放
   */
  private update(width: number, height: number): void {
    if (!this.config) return;

    // 检测方向
    const newOrientation: OrientationLayout = width >= height ? 'landscape' : 'portrait';

    // 计算设计尺寸
    if (newOrientation === 'landscape') {
      this.designSize = {
        width: this.config.designWidth,
        height: this.config.designHeight,
      };
    } else {
      this.designSize = {
        width: this.config.designWidthPortrait ?? this.config.designHeight,
        height: this.config.designHeightPortrait ?? this.config.designWidth,
      };
    }

    // 计算缩放比（contain 策略）
    const scaleX = width / this.designSize.width;
    const scaleY = height / this.designSize.height;
    this.scale = Math.min(scaleX, scaleY);

    // 检测方向变化
    const changed = newOrientation !== this.orientation;
    this.orientation = newOrientation;

    // 通知回调
    if (changed) {
      for (const cb of this.callbacks) {
        try {
          cb(this.orientation);
        } catch (err) {
          console.error('[OrientationManager] Callback error:', err);
        }
      }
    }
  }
}
