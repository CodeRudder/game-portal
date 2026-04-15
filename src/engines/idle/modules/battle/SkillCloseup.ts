/**
 * SkillCloseup — 武将技能特写系统
 *
 * 当武将释放强力技能时，镜头快速推进到施法者位置，
 * 展示技能动画后拉回原位。
 *
 * 流程：
 * 1. zooming_in（0.3秒）：镜头快速推进到施法者位置，zoom 到 2.0
 * 2. showing（0.5秒）：停留展示技能
 * 3. zooming_out（0.3秒）：镜头拉回原位
 *
 * @module engines/idle/modules/battle/SkillCloseup
 */

import type { BattleCamera } from './BattleCamera';

// ============================================================
// 接口定义
// ============================================================

/** 技能特写配置 */
export interface CloseupConfig {
  /** 特写总持续时间（毫秒） */
  durationMs: number;
  /** 缩放倍率 */
  zoomLevel: number;
  /** 是否启用慢动作 */
  slowMotion: boolean;
  /** 慢动作倍率（0-1，越小越慢） */
  slowMotionFactor: number;
}

/** 技能特写状态 */
export type CloseupState = 'idle' | 'zooming_in' | 'showing' | 'zooming_out';

/** 技能特写事件 */
export type CloseupEvent =
  | { type: 'closeup_started'; data: { unitId: string; skillName: string } }
  | { type: 'closeup_zooming_in'; data: { progress: number } }
  | { type: 'closeup_showing'; data: { unitId: string; skillName: string } }
  | { type: 'closeup_zooming_out'; data: { progress: number } }
  | { type: 'closeup_finished'; data: Record<string, never> };

// ============================================================
// 默认配置
// ============================================================

/** 默认特写配置 */
const DEFAULT_CLOSEUP_CONFIG: CloseupConfig = {
  durationMs: 1100, // 300 + 500 + 300
  zoomLevel: 2.0,
  slowMotion: false,
  slowMotionFactor: 0.3,
};

/** 推进阶段持续时间（毫秒） */
const ZOOM_IN_DURATION_MS = 300;

/** 展示阶段持续时间（毫秒） */
const SHOWING_DURATION_MS = 500;

/** 拉回阶段持续时间（毫秒） */
const ZOOM_OUT_DURATION_MS = 300;

// ============================================================
// SkillCloseup 实现
// ============================================================

/**
 * 技能特写系统 — 管理技能释放时的镜头特写动画
 *
 * @example
 * ```typescript
 * const closeup = new SkillCloseup();
 *
 * closeup.on((event) => {
 *   console.log('特写事件:', event.type);
 * });
 *
 * // 触发特写
 * closeup.trigger('hero-1', { x: 400, y: 300 }, '烈焰斩', camera);
 *
 * // 每帧更新
 * closeup.update(16);
 * ```
 */
export class SkillCloseup {
  /** 配置 */
  private readonly config: CloseupConfig;

  /** 当前状态 */
  private state: CloseupState = 'idle';

  /** 当前阶段已过时间（毫秒） */
  private phaseElapsedMs = 0;

  /** 保存特写前的镜头状态 */
  private savedCameraX = 0;
  private savedCameraY = 0;
  private savedCameraZoom = 1;

  /** 特写目标信息 */
  private targetUnitId = '';
  private targetUnitPosition = { x: 0, y: 0 };
  private targetSkillName = '';

  /** 事件监听器 */
  private readonly listeners: ((event: CloseupEvent) => void)[] = [];

  // ============================================================
  // 构造函数
  // ============================================================

  /**
   * 创建技能特写系统
   *
   * @param config - 可选的配置覆盖
   */
  constructor(config?: Partial<CloseupConfig>) {
    this.config = { ...DEFAULT_CLOSEUP_CONFIG, ...config };
  }

  // ============================================================
  // 触发特写
  // ============================================================

  /**
   * 触发技能特写
   *
   * 如果当前已有特写在播放，会被取消后重新触发。
   *
   * @param unitId - 施法单位 ID
   * @param unitPosition - 施法单位位置（世界坐标）
   * @param skillName - 技能名称
   * @param camera - 镜头实例
   */
  trigger(unitId: string, unitPosition: { x: number; y: number }, skillName: string, camera: BattleCamera): void {
    // 如果正在播放，先取消
    if (this.state !== 'idle') {
      this.cancel();
    }

    // 保存当前镜头状态
    this.savedCameraX = camera.getPosition().x;
    this.savedCameraY = camera.getPosition().y;
    this.savedCameraZoom = camera.getZoom();

    // 设置目标信息
    this.targetUnitId = unitId;
    this.targetUnitPosition = { ...unitPosition };
    this.targetSkillName = skillName;

    // 进入推进阶段
    this.state = 'zooming_in';
    this.phaseElapsedMs = 0;

    // 取消镜头跟随
    camera.follow(null);

    this.emit({
      type: 'closeup_started',
      data: { unitId, skillName },
    });
  }

  // ============================================================
  // 每帧更新
  // ============================================================

  /**
   * 更新特写动画
   *
   * @param dt - 距上次更新的时间增量（毫秒）
   */
  update(dt: number): void {
    if (this.state === 'idle') return;
    if (dt <= 0) return;

    this.phaseElapsedMs += dt;

    // 循环处理阶段转换，确保大 dt 能正确推进所有阶段
    let maxIterations = 10;
    while (this.state !== 'idle' && maxIterations-- > 0) {
      const prevState = this.state;

      switch (this.state) {
        case 'zooming_in':
          this.updateZoomIn();
          break;
        case 'showing':
          this.updateShowing();
          break;
        case 'zooming_out':
          this.updateZoomOut();
          break;
      }

      // 如果状态没有改变，说明还在当前阶段中，无需继续
      if (this.state === prevState) break;
      // 状态改变了，继续循环处理剩余时间
    }
  }

  // ============================================================
  // 状态查询
  // ============================================================

  /**
   * 获取当前特写状态
   */
  getState(): CloseupState {
    return this.state;
  }

  /**
   * 检查特写是否正在播放
   */
  isActive(): boolean {
    return this.state !== 'idle';
  }

  /**
   * 获取配置
   */
  getConfig(): CloseupConfig {
    return { ...this.config };
  }

  /**
   * 获取当前阶段进度（0-1）
   */
  getProgress(): number {
    switch (this.state) {
      case 'zooming_in':
        return Math.min(1, this.phaseElapsedMs / ZOOM_IN_DURATION_MS);
      case 'showing':
        // zooming_in 已完成，进度视为 1
        return 1;
      case 'zooming_out':
        return Math.min(1, this.phaseElapsedMs / ZOOM_OUT_DURATION_MS);
      default:
        return 0;
    }
  }

  /**
   * 获取慢动作倍率
   *
   * 如果特写正在进行且启用了慢动作，返回慢动作倍率；否则返回 1.0。
   */
  getSlowMotionFactor(): number {
    if (this.isActive() && this.config.slowMotion) {
      return this.config.slowMotionFactor;
    }
    return 1.0;
  }

  // ============================================================
  // 控制
  // ============================================================

  /**
   * 取消当前特写
   *
   * 镜头不会恢复到原位（由调用者负责恢复）。
   */
  cancel(): void {
    if (this.state === 'idle') return;

    this.state = 'idle';
    this.phaseElapsedMs = 0;
    this.targetUnitId = '';
    this.targetSkillName = '';

    this.emit({ type: 'closeup_finished', data: {} });
  }

  /**
   * 重置到初始状态
   */
  reset(): void {
    this.state = 'idle';
    this.phaseElapsedMs = 0;
    this.targetUnitId = '';
    this.targetUnitPosition = { x: 0, y: 0 };
    this.targetSkillName = '';
    this.savedCameraX = 0;
    this.savedCameraY = 0;
    this.savedCameraZoom = 1;
  }

  // ============================================================
  // 事件系统
  // ============================================================

  /**
   * 注册事件监听器
   *
   * @param handler - 事件处理回调
   */
  on(handler: (event: CloseupEvent) => void): void {
    this.listeners.push(handler);
  }

  /**
   * 注销事件监听器
   *
   * @param handler - 要移除的事件处理回调
   */
  off(handler: (event: CloseupEvent) => void): void {
    const idx = this.listeners.indexOf(handler);
    if (idx !== -1) {
      this.listeners.splice(idx, 1);
    }
  }

  // ============================================================
  // 私有方法
  // ============================================================

  /**
   * 更新推进阶段
   */
  private updateZoomIn(): void {
    const progress = Math.min(1, this.phaseElapsedMs / ZOOM_IN_DURATION_MS);

    this.emit({
      type: 'closeup_zooming_in',
      data: { progress },
    });

    if (progress >= 1) {
      // 进入展示阶段
      const remaining = this.phaseElapsedMs - ZOOM_IN_DURATION_MS;
      this.state = 'showing';
      this.phaseElapsedMs = remaining;

      this.emit({
        type: 'closeup_showing',
        data: { unitId: this.targetUnitId, skillName: this.targetSkillName },
      });
    }
  }

  /**
   * 更新展示阶段
   */
  private updateShowing(): void {
    const progress = Math.min(1, this.phaseElapsedMs / SHOWING_DURATION_MS);

    if (progress >= 1) {
      // 进入拉回阶段
      const remaining = this.phaseElapsedMs - SHOWING_DURATION_MS;
      this.state = 'zooming_out';
      this.phaseElapsedMs = remaining;
    }
  }

  /**
   * 更新拉回阶段
   */
  private updateZoomOut(): void {
    const progress = Math.min(1, this.phaseElapsedMs / ZOOM_OUT_DURATION_MS);

    this.emit({
      type: 'closeup_zooming_out',
      data: { progress },
    });

    if (progress >= 1) {
      // 特写结束
      this.state = 'idle';
      this.phaseElapsedMs = 0;

      this.emit({ type: 'closeup_finished', data: {} });
    }
  }

  /**
   * 发射事件
   */
  private emit(event: CloseupEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  // ============================================================
  // 公开的镜头控制辅助方法
  // ============================================================

  /**
   * 获取特写期间的镜头插值参数
   *
   * 由调用者在 update 循环中调用，根据返回值控制镜头。
   *
   * @returns 镜头目标位置和缩放，null 表示无特写
   */
  getCameraInterpolation(): { x: number; y: number; zoom: number } | null {
    switch (this.state) {
      case 'zooming_in': {
        const progress = this.easeInOutCubic(Math.min(1, this.phaseElapsedMs / ZOOM_IN_DURATION_MS));
        return {
          x: this.lerp(this.savedCameraX, this.targetUnitPosition.x, progress),
          y: this.lerp(this.savedCameraY, this.targetUnitPosition.y, progress),
          zoom: this.lerp(this.savedCameraZoom, this.config.zoomLevel, progress),
        };
      }
      case 'showing':
        return {
          x: this.targetUnitPosition.x,
          y: this.targetUnitPosition.y,
          zoom: this.config.zoomLevel,
        };
      case 'zooming_out': {
        const progress = this.easeInOutCubic(Math.min(1, this.phaseElapsedMs / ZOOM_OUT_DURATION_MS));
        return {
          x: this.lerp(this.targetUnitPosition.x, this.savedCameraX, progress),
          y: this.lerp(this.targetUnitPosition.y, this.savedCameraY, progress),
          zoom: this.lerp(this.config.zoomLevel, this.savedCameraZoom, progress),
        };
      }
      default:
        return null;
    }
  }

  /**
   * 获取保存的镜头状态（用于外部恢复镜头）
   */
  getSavedCameraState(): { x: number; y: number; zoom: number } {
    return {
      x: this.savedCameraX,
      y: this.savedCameraY,
      zoom: this.savedCameraZoom,
    };
  }

  // ============================================================
  // 数学工具
  // ============================================================

  /** 线性插值 */
  private lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }

  /** 缓入缓出三次方 */
  private easeInOutCubic(t: number): number {
    return t < 0.5
      ? 4 * t * t * t
      : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }
}
