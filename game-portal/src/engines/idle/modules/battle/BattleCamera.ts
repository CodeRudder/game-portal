/**
 * BattleCamera — 战斗镜头系统
 *
 * 纯数学计算的 2D 镜头系统，不依赖任何渲染 API。
 * 支持平移、缩放、平滑跟随、镜头震动等功能。
 *
 * 设计原则：
 * - 零外部依赖，纯 TypeScript 实现
 * - 所有坐标均为世界坐标系（像素）
 * - 缩放影响视口大小：实际视口 = viewportSize / zoom
 *
 * @module engines/idle/modules/battle/BattleCamera
 */

// ============================================================
// 接口定义
// ============================================================

/** 镜头配置 */
export interface CameraConfig {
  /** 视口宽度（像素） */
  viewportWidth: number;
  /** 视口高度（像素） */
  viewportHeight: number;
  /** 地图总宽度（像素） */
  mapWidth: number;
  /** 地图总高度（像素） */
  mapHeight: number;
  /** 镜头移动速度（像素/秒） */
  moveSpeed: number;
  /** 最小缩放 */
  minZoom: number;
  /** 最大缩放 */
  maxZoom: number;
  /** 平滑跟随因子（0-1，越大越快） */
  followSmoothFactor: number;
}

/** 镜头状态（可序列化，用于存档） */
export interface CameraState {
  /** 镜头中心 X */
  x: number;
  /** 镜头中心 Y */
  y: number;
  /** 缩放倍率 */
  zoom: number;
  /** 目标 X（平滑移动用） */
  targetX: number;
  /** 目标 Y（平滑移动用） */
  targetY: number;
  /** 是否正在震动 */
  isShaking: boolean;
  /** 震动强度 */
  shakeIntensity: number;
  /** 震动总持续时间（毫秒） */
  shakeDurationMs: number;
  /** 震动已过时间（毫秒） */
  shakeElapsedMs: number;
}

// ============================================================
// 默认配置
// ============================================================

/** 默认镜头配置 */
const DEFAULT_CAMERA_CONFIG: CameraConfig = {
  viewportWidth: 800,
  viewportHeight: 600,
  mapWidth: 2000,
  mapHeight: 2000,
  moveSpeed: 300,
  minZoom: 0.5,
  maxZoom: 3.0,
  followSmoothFactor: 0.1,
};

// ============================================================
// BattleCamera 实现
// ============================================================

/**
 * 战斗镜头 — 管理视口位置、缩放、跟随和震动效果
 *
 * @example
 * ```typescript
 * const camera = new BattleCamera({
 *   viewportWidth: 800,
 *   viewportHeight: 600,
 *   mapWidth: 2000,
 *   mapHeight: 1500,
 *   moveSpeed: 300,
 *   minZoom: 0.5,
 *   maxZoom: 3.0,
 *   followSmoothFactor: 0.1,
 * });
 *
 * // 平滑移动到指定位置
 * camera.panTo(500, 300);
 *
 * // 每帧更新
 * camera.update(16); // dt = 16ms
 *
 * // 世界坐标转屏幕坐标
 * const screenPos = camera.worldToScreen(400, 200);
 * ```
 */
export class BattleCamera {
  /** 镜头配置 */
  private readonly config: CameraConfig;

  /** 镜头状态 */
  private state: CameraState;

  /** 跟随目标（可空） */
  private followTarget: { x: number; y: number } | null = null;

  /** 震动前的位置（用于震动恢复） */
  private preShakeX = 0;
  private preShakeY = 0;

  /** 当前震动偏移 */
  private shakeOffsetX = 0;
  private shakeOffsetY = 0;

  /** 震动随机种子（用于确定性测试） */
  private shakeSeed = 0;

  // ============================================================
  // 构造函数
  // ============================================================

  /**
   * 创建战斗镜头实例
   *
   * @param config - 镜头配置，未指定的字段使用默认值
   */
  constructor(config: Partial<CameraConfig> & Pick<CameraConfig, 'viewportWidth' | 'viewportHeight' | 'mapWidth' | 'mapHeight'>) {
    this.config = { ...DEFAULT_CAMERA_CONFIG, ...config };

    // 初始位置：地图中心
    const initialX = this.config.mapWidth / 2;
    const initialY = this.config.mapHeight / 2;

    this.state = {
      x: initialX,
      y: initialY,
      zoom: 1,
      targetX: initialX,
      targetY: initialY,
      isShaking: false,
      shakeIntensity: 0,
      shakeDurationMs: 0,
      shakeElapsedMs: 0,
    };
  }

  // ============================================================
  // 位置查询
  // ============================================================

  /**
   * 获取当前镜头中心位置
   *
   * @returns 镜头中心坐标（包含震动偏移）
   */
  getPosition(): { x: number; y: number } {
    return {
      x: this.state.x + this.shakeOffsetX,
      y: this.state.y + this.shakeOffsetY,
    };
  }

  /**
   * 获取当前缩放倍率
   */
  getZoom(): number {
    return this.state.zoom;
  }

  /**
   * 获取完整镜头状态（用于存档）
   */
  getState(): CameraState {
    return { ...this.state };
  }

  /**
   * 获取镜头配置
   */
  getConfig(): CameraConfig {
    return { ...this.config };
  }

  // ============================================================
  // 位置控制
  // ============================================================

  /**
   * 立即移动到指定位置（无平滑过渡）
   *
   * 位置会被限制在地图边界内。
   *
   * @param x - 目标 X 坐标
   * @param y - 目标 Y 坐标
   */
  moveTo(x: number, y: number): void {
    this.state.x = this.clampX(x);
    this.state.y = this.clampY(y);
    this.state.targetX = this.state.x;
    this.state.targetY = this.state.y;
  }

  /**
   * 平滑移动到指定位置
   *
   * 每帧通过 lerp 逼近目标位置。
   *
   * @param x - 目标 X 坐标
   * @param y - 目标 Y 坐标
   */
  panTo(x: number, y: number): void {
    this.state.targetX = this.clampX(x);
    this.state.targetY = this.clampY(y);
    // 取消跟随
    this.followTarget = null;
  }

  /**
   * 设置跟随目标
   *
   * 镜头会每帧平滑跟随目标位置。
   * 传入 null 取消跟随。
   *
   * @param target - 跟随目标（具有 x, y 属性），或 null
   */
  follow(target: { x: number; y: number } | null): void {
    this.followTarget = target;
  }

  // ============================================================
  // 缩放控制
  // ============================================================

  /**
   * 设置缩放到指定倍率
   *
   * @param zoom - 缩放倍率，会被限制在 minZoom~maxZoom 范围内
   */
  zoomTo(zoom: number): void {
    this.state.zoom = this.clampZoom(zoom);
    // 缩放后重新限制位置
    this.state.x = this.clampX(this.state.x);
    this.state.y = this.clampY(this.state.y);
    this.state.targetX = this.clampX(this.state.targetX);
    this.state.targetY = this.clampY(this.state.targetY);
  }

  /**
   * 放大一级
   *
   * 每次增加 0.25 倍。
   */
  zoomIn(): void {
    this.zoomTo(this.state.zoom + 0.25);
  }

  /**
   * 缩小一级
   *
   * 每次减少 0.25 倍。
   */
  zoomOut(): void {
    this.zoomTo(this.state.zoom - 0.25);
  }

  // ============================================================
  // 震动效果
  // ============================================================

  /**
   * 触发镜头震动
   *
   * 震动效果在当前位置上叠加随机偏移，随时间衰减。
   *
   * @param intensity - 震动强度（像素偏移幅度）
   * @param durationMs - 震动持续时间（毫秒）
   */
  shake(intensity: number, durationMs: number): void {
    if (intensity <= 0 || durationMs <= 0) return;

    this.state.isShaking = true;
    this.state.shakeIntensity = intensity;
    this.state.shakeDurationMs = durationMs;
    this.state.shakeElapsedMs = 0;
    this.preShakeX = this.state.x;
    this.preShakeY = this.state.y;
    this.shakeSeed = Math.random() * 1000;
  }

  // ============================================================
  // 每帧更新
  // ============================================================

  /**
   * 每帧更新
   *
   * 处理平滑移动、跟随目标、震动衰减。
   *
   * @param dt - 距上次更新的时间增量（毫秒）
   */
  update(dt: number): void {
    if (dt <= 0) return;

    const dtSec = dt / 1000;

    // 1. 处理跟随目标
    if (this.followTarget) {
      this.state.targetX = this.clampX(this.followTarget.x);
      this.state.targetY = this.clampY(this.followTarget.y);
    }

    // 2. 平滑移动（lerp）
    const factor = Math.min(1, this.config.followSmoothFactor * dtSec * 60);
    this.state.x += (this.state.targetX - this.state.x) * factor;
    this.state.y += (this.state.targetY - this.state.y) * factor;

    // 3. 限制位置
    this.state.x = this.clampX(this.state.x);
    this.state.y = this.clampY(this.state.y);

    // 4. 更新震动
    this.updateShake(dt);
  }

  // ============================================================
  // 坐标转换
  // ============================================================

  /**
   * 世界坐标转屏幕坐标
   *
   * @param worldX - 世界 X 坐标
   * @param worldY - 世界 Y 坐标
   * @returns 屏幕坐标
   */
  worldToScreen(worldX: number, worldY: number): { x: number; y: number } {
    const pos = this.getPosition();
    const halfW = (this.config.viewportWidth / 2) / this.state.zoom;
    const halfH = (this.config.viewportHeight / 2) / this.state.zoom;

    return {
      x: (worldX - pos.x + halfW) * this.state.zoom,
      y: (worldY - pos.y + halfH) * this.state.zoom,
    };
  }

  /**
   * 屏幕坐标转世界坐标
   *
   * @param screenX - 屏幕 X 坐标
   * @param screenY - 屏幕 Y 坐标
   * @returns 世界坐标
   */
  screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    const pos = this.getPosition();
    const halfW = (this.config.viewportWidth / 2) / this.state.zoom;
    const halfH = (this.config.viewportHeight / 2) / this.state.zoom;

    return {
      x: screenX / this.state.zoom + pos.x - halfW,
      y: screenY / this.state.zoom + pos.y - halfH,
    };
  }

  // ============================================================
  // 可见性检测
  // ============================================================

  /**
   * 获取当前可见区域的世界坐标边界
   *
   * @returns 可见区域边界 { left, top, right, bottom }
   */
  getVisibleBounds(): { left: number; top: number; right: number; bottom: number } {
    const pos = this.getPosition();
    const halfW = (this.config.viewportWidth / 2) / this.state.zoom;
    const halfH = (this.config.viewportHeight / 2) / this.state.zoom;

    return {
      left: pos.x - halfW,
      top: pos.y - halfH,
      right: pos.x + halfW,
      bottom: pos.y + halfH,
    };
  }

  /**
   * 检查世界坐标是否在当前视口内
   *
   * @param worldX - 世界 X 坐标
   * @param worldY - 世界 Y 坐标
   * @returns 是否可见
   */
  isVisible(worldX: number, worldY: number): boolean {
    const bounds = this.getVisibleBounds();
    return worldX >= bounds.left && worldX <= bounds.right &&
           worldY >= bounds.top && worldY <= bounds.bottom;
  }

  // ============================================================
  // 状态管理
  // ============================================================

  /**
   * 重置镜头到初始位置（地图中心，缩放 1.0）
   */
  reset(): void {
    const initialX = this.config.mapWidth / 2;
    const initialY = this.config.mapHeight / 2;

    this.state = {
      x: initialX,
      y: initialY,
      zoom: 1,
      targetX: initialX,
      targetY: initialY,
      isShaking: false,
      shakeIntensity: 0,
      shakeDurationMs: 0,
      shakeElapsedMs: 0,
    };
    this.followTarget = null;
    this.shakeOffsetX = 0;
    this.shakeOffsetY = 0;
  }

  /**
   * 加载镜头状态（用于读档）
   *
   * @param state - 镜头状态
   */
  loadState(state: CameraState): void {
    this.state = {
      x: this.clampX(state.x),
      y: this.clampY(state.y),
      zoom: this.clampZoom(state.zoom),
      targetX: this.clampX(state.targetX),
      targetY: this.clampY(state.targetY),
      isShaking: !!state.isShaking,
      shakeIntensity: Math.max(0, state.shakeIntensity),
      shakeDurationMs: Math.max(0, state.shakeDurationMs),
      shakeElapsedMs: Math.max(0, state.shakeElapsedMs),
    };
    this.followTarget = null;
    this.shakeOffsetX = 0;
    this.shakeOffsetY = 0;
  }

  // ============================================================
  // 私有方法
  // ============================================================

  /**
   * 限制 X 坐标在地图边界内
   *
   * 镜头中心不能超出地图边界（考虑视口半宽）
   */
  private clampX(x: number): number {
    const halfW = (this.config.viewportWidth / 2) / this.state.zoom;
    const minX = halfW;
    const maxX = this.config.mapWidth - halfW;

    // 如果地图比视口小，居中
    if (minX > maxX) return this.config.mapWidth / 2;

    return Math.max(minX, Math.min(maxX, x));
  }

  /**
   * 限制 Y 坐标在地图边界内
   */
  private clampY(y: number): number {
    const halfH = (this.config.viewportHeight / 2) / this.state.zoom;
    const minY = halfH;
    const maxY = this.config.mapHeight - halfH;

    if (minY > maxY) return this.config.mapHeight / 2;

    return Math.max(minY, Math.min(maxY, y));
  }

  /**
   * 限制缩放在配置范围内
   */
  private clampZoom(zoom: number): number {
    return Math.max(this.config.minZoom, Math.min(this.config.maxZoom, zoom));
  }

  /**
   * 更新震动效果
   *
   * 震动偏移随时间衰减：offset = intensity * (1 - elapsed/duration) * random
   */
  private updateShake(dt: number): void {
    if (!this.state.isShaking) {
      this.shakeOffsetX = 0;
      this.shakeOffsetY = 0;
      return;
    }

    this.state.shakeElapsedMs += dt;

    // 震动结束
    if (this.state.shakeElapsedMs >= this.state.shakeDurationMs) {
      this.state.isShaking = false;
      this.state.shakeIntensity = 0;
      this.state.shakeDurationMs = 0;
      this.state.shakeElapsedMs = 0;
      this.shakeOffsetX = 0;
      this.shakeOffsetY = 0;
      return;
    }

    // 计算衰减因子
    const progress = this.state.shakeElapsedMs / this.state.shakeDurationMs;
    const decay = 1 - progress;
    const intensity = this.state.shakeIntensity * decay;

    // 生成随机偏移（使用简单的伪随机）
    this.shakeSeed += dt * 0.1;
    const angle1 = Math.sin(this.shakeSeed * 7.3) * Math.PI * 2;
    const angle2 = Math.cos(this.shakeSeed * 13.7) * Math.PI * 2;

    this.shakeOffsetX = Math.cos(angle1) * intensity;
    this.shakeOffsetY = Math.sin(angle2) * intensity;
  }
}
