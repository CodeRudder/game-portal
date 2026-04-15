/**
 * renderer/managers/CameraManager.ts — 摄像机管理器
 *
 * 管理 PixiJS 场景中的虚拟摄像机：
 * - 平移（pan）
 * - 缩放（zoom）
 * - 平滑跟随目标
 * - 边界限制
 *
 * @module renderer/managers/CameraManager
 */

import { Container } from 'pixi.js';
import type { CameraBounds, ICameraManager } from '../types';

// ═══════════════════════════════════════════════════════════════
// 常量
// ═══════════════════════════════════════════════════════════════

/** 默认平滑系数（0~1，越大越快） */
const DEFAULT_SMOOTH_FACTOR = 0.1;

/** 默认最小缩放 */
const MIN_ZOOM = 0.3;

/** 默认最大缩放 */
const MAX_ZOOM = 3.0;

/** 默认边界 */
const DEFAULT_BOUNDS: CameraBounds = {
  minX: -2000,
  maxX: 4000,
  minY: -2000,
  maxY: 4000,
};

// ═══════════════════════════════════════════════════════════════
// CameraManager
// ═══════════════════════════════════════════════════════════════

/**
 * 摄像机管理器
 *
 * 通过修改目标容器的 position 和 scale 来模拟摄像机效果。
 * 支持平滑插值，避免生硬跳变。
 *
 * @example
 * ```ts
 * const cam = new CameraManager();
 * cam.attach(sceneRoot);
 * cam.setBounds({ minX: 0, maxX: 2000, minY: 0, maxY: 1500 });
 * cam.panTo(500, 300, true); // 平滑移动到 (500, 300)
 * cam.zoomTo(1.5, true);    // 平滑缩放到 1.5x
 * ```
 */
export class CameraManager implements ICameraManager {
  // ─── 目标容器 ─────────────────────────────────────────────

  /** 摄像机控制的容器 */
  private target: Container | null = null;

  // ─── 摄像机状态 ───────────────────────────────────────────

  /** 当前位置 */
  private position: { x: number; y: number } = { x: 0, y: 0 };

  /** 目标位置（平滑插值目标） */
  private targetPosition: { x: number; y: number } = { x: 0, y: 0 };

  /** 当前缩放 */
  private zoom: number = 1;

  /** 目标缩放（平滑插值目标） */
  private targetZoom: number = 1;

  /** 平滑系数 */
  private smoothFactor: number = DEFAULT_SMOOTH_FACTOR;

  // ─── 边界 ─────────────────────────────────────────────────

  /** 摄像机边界 */
  private bounds: CameraBounds = { ...DEFAULT_BOUNDS };

  // ─── 跟随 ─────────────────────────────────────────────────

  /** 跟随目标函数 */
  private followFn: (() => { x: number; y: number }) | null = null;

  /** 是否正在跟随 */
  private following: boolean = false;

  // ═══════════════════════════════════════════════════════════
  // 公共接口
  // ═══════════════════════════════════════════════════════════

  /**
   * 设置摄像机目标容器
   *
   * @param container - 要控制的 PixiJS Container
   */
  attach(container: Container): void {
    this.target = container;
  }

  /**
   * 平移到指定位置
   *
   * @param x - 目标 X 坐标
   * @param y - 目标 Y 坐标
   * @param smooth - 是否平滑过渡（默认 true）
   */
  panTo(x: number, y: number, smooth: boolean = true): void {
    // 应用边界限制
    const clampedX = Math.max(this.bounds.minX, Math.min(this.bounds.maxX, x));
    const clampedY = Math.max(this.bounds.minY, Math.min(this.bounds.maxY, y));

    if (smooth) {
      this.targetPosition = { x: clampedX, y: clampedY };
    } else {
      this.position = { x: clampedX, y: clampedY };
      this.targetPosition = { x: clampedX, y: clampedY };
      this.applyToContainer();
    }
  }

  /**
   * 缩放到指定级别
   *
   * @param level - 缩放级别（1 = 100%）
   * @param smooth - 是否平滑过渡（默认 true）
   */
  zoomTo(level: number, smooth: boolean = true): void {
    const clampedZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, level));

    if (smooth) {
      this.targetZoom = clampedZoom;
    } else {
      this.zoom = clampedZoom;
      this.targetZoom = clampedZoom;
      this.applyToContainer();
    }
  }

  /**
   * 平滑跟随目标
   *
   * 每帧从 getPosition 获取最新位置，平滑移动摄像机。
   *
   * @param getPosition - 获取跟随目标位置的函数
   */
  followTarget(getPosition: () => { x: number; y: number }): void {
    this.followFn = getPosition;
    this.following = true;
  }

  /**
   * 停止跟随
   */
  stopFollow(): void {
    this.followFn = null;
    this.following = false;
  }

  /**
   * 设置边界
   */
  setBounds(bounds: CameraBounds): void {
    this.bounds = { ...bounds };
  }

  /**
   * 获取当前摄像机状态
   */
  getState(): { x: number; y: number; zoom: number } {
    return {
      x: this.position.x,
      y: this.position.y,
      zoom: this.zoom,
    };
  }

  /**
   * 设置平滑系数
   *
   * @param factor - 0~1，越大越快（默认 0.1）
   */
  setSmoothFactor(factor: number): void {
    this.smoothFactor = Math.max(0.01, Math.min(1, factor));
  }

  // ═══════════════════════════════════════════════════════════
  // 更新
  // ═══════════════════════════════════════════════════════════

  /**
   * 每帧更新
   *
   * 由 GameRenderer 的 ticker 驱动。
   */
  update(_deltaTime: number): void {
    // 跟随模式：更新目标位置
    if (this.following && this.followFn) {
      const pos = this.followFn();
      this.targetPosition = {
        x: Math.max(this.bounds.minX, Math.min(this.bounds.maxX, pos.x)),
        y: Math.max(this.bounds.minY, Math.min(this.bounds.maxY, pos.y)),
      };
    }

    // 平滑插值位置
    const dx = this.targetPosition.x - this.position.x;
    const dy = this.targetPosition.y - this.position.y;
    if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
      this.position.x += dx * this.smoothFactor;
      this.position.y += dy * this.smoothFactor;
    } else {
      this.position.x = this.targetPosition.x;
      this.position.y = this.targetPosition.y;
    }

    // 平滑插值缩放
    const dz = this.targetZoom - this.zoom;
    if (Math.abs(dz) > 0.001) {
      this.zoom += dz * this.smoothFactor;
    } else {
      this.zoom = this.targetZoom;
    }

    // 应用到容器
    this.applyToContainer();
  }

  // ═══════════════════════════════════════════════════════════
  // 销毁
  // ═══════════════════════════════════════════════════════════

  /**
   * 销毁
   */
  destroy(): void {
    this.target = null;
    this.followFn = null;
    this.following = false;
  }

  // ═══════════════════════════════════════════════════════════
  // 内部方法
  // ═══════════════════════════════════════════════════════════

  /**
   * 将摄像机状态应用到目标容器
   */
  private applyToContainer(): void {
    if (!this.target) return;

    // 摄像机位移 = 负偏移（向右移动摄像机 = 世界向左移动）
    this.target.position.set(-this.position.x, -this.position.y);
    this.target.scale.set(this.zoom);
  }
}
