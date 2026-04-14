/**
 * ParticleSystem — 通用粒子子系统
 *
 * 提供完整的粒子发射、物理模拟与 Canvas 渲染功能。
 * 适用于放置游戏中的特效需求（如升级光效、资源飘落、背景氛围等）。
 *
 * 设计原则：
 * - 零外部依赖，纯 TypeScript 实现
 * - 只使用 Canvas 2D API（实色圆形，不使用 neon/glow/闪烁效果）
 * - 支持多种发射器形状（point / circle / rect / ring）
 * - 支持自动发射与手动触发两种模式
 * - 颜色插值、尺寸衰减、重力、旋转一应俱全
 *
 * @module engines/idle/modules/ParticleSystem
 */

// ============================================================
// 类型定义
// ============================================================

/** 发射器形状定义 */
export type EmitterShape =
  | { type: "point" }
  | { type: "circle"; radius: number }
  | { type: "rect"; width: number; height: number }
  | { type: "ring"; innerRadius: number; outerRadius: number };

/** 粒子颜色配置（起始色 → 结束色线性插值） */
export interface ParticleColorConfig {
  /** 起始颜色（CSS 颜色字符串，如 "#ff0000" 或 "rgba(255,0,0,1)"） */
  start: string;
  /** 结束颜色 */
  end: string;
}

/** 粒子尺寸配置（起始 → 结束线性插值） */
export interface ParticleSizeConfig {
  /** 起始半径（px） */
  start: number;
  /** 结束半径（px） */
  end: number;
}

/** 粒子速度配置 */
export interface ParticleSpeedConfig {
  /** 最小速度（px/s） */
  min: number;
  /** 最大速度（px/s） */
  max: number;
  /** 发射角度（弧度），null 表示随机 360° */
  angle: number | null;
  /** 扩散角度（弧度），以 angle 为中心对称扩散 */
  spread: number;
}

/** 发射器配置 */
export interface EmitterConfig {
  /** 发射器唯一标识 */
  id: string;
  /** 发射器形状 */
  shape: EmitterShape;
  /** 每次发射产生的粒子数量 */
  emitCount: number;
  /** 每秒发射次数，0 表示仅手动触发 */
  emitRate: number;
  /** 粒子生命周期范围 [min, max]（秒） */
  lifetime: [number, number];
  /** 速度配置 */
  speed: ParticleSpeedConfig;
  /** 颜色配置 */
  color: ParticleColorConfig;
  /** 尺寸配置 */
  size: ParticleSizeConfig;
  /** 重力加速度（px/s²），正值向下 */
  gravity: number;
  /** 整体不透明度 [0, 1] */
  opacity: number;
  /** 纹理资源标识（保留扩展用，当前版本未使用） */
  textureAsset: string | null;
  /** 是否自动旋转 */
  autoRotate: boolean;
  /** 旋转速度（弧度/s） */
  rotationSpeed: number;
}

/** 粒子实例 */
export interface Particle {
  /** 唯一标识 */
  uid: number;
  /** X 坐标（px） */
  x: number;
  /** Y 坐标（px） */
  y: number;
  /** X 方向速度（px/s） */
  vx: number;
  /** Y 方向速度（px/s） */
  vy: number;
  /** 当前半径（px） */
  size: number;
  /** 当前颜色（CSS 颜色字符串） */
  color: string;
  /** 当前不透明度 [0, 1] */
  opacity: number;
  /** 当前旋转角度（弧度） */
  rotation: number;
  /** 已存活时间（秒） */
  age: number;
  /** 最大存活时间（秒） */
  maxAge: number;
  /** 所属发射器 ID */
  emitterId: string;
  /** 是否存活 */
  alive: boolean;
}

// ============================================================
// 内部辅助：发射器运行时状态
// ============================================================

/** 发射器运行时状态（包含配置 + 发射位置 + 累积计时器） */
interface EmitterRuntime {
  config: EmitterConfig;
  /** 发射器中心 X 坐标 */
  cx: number;
  /** 发射器中心 Y 坐标 */
  cy: number;
  /** 自上次发射以来累积的时间（秒） */
  emitAccumulator: number;
}

// ============================================================
// ParticleSystem 实现
// ============================================================

/**
 * 通用粒子子系统
 *
 * 负责管理多个发射器，每帧执行：
 * 1. 自动发射器的定时发射
 * 2. 粒子物理更新（速度、重力、位置）
 * 3. 粒子生命周期管理（颜色/尺寸插值、老化、移除）
 * 4. Canvas 渲染（实色圆形）
 */
export class ParticleSystem {
  // ----------------------------------------------------------
  // 私有属性
  // ----------------------------------------------------------

  /** 所有已注册的发射器运行时（id → runtime） */
  private emitters: Map<string, EmitterRuntime> = new Map();

  /** 所有存活粒子列表 */
  private particles: Particle[] = [];

  /** 粒子 UID 自增计数器 */
  private nextUid: number = 1;

  // ----------------------------------------------------------
  // 构造函数
  // ----------------------------------------------------------

  /**
   * 创建 ParticleSystem 实例
   */
  constructor() {
    this.emitters = new Map();
    this.particles = [];
    this.nextUid = 1;
  }

  // ----------------------------------------------------------
  // 公共方法
  // ----------------------------------------------------------

  /**
   * 注册发射器
   *
   * 如果同 id 发射器已存在，将覆盖旧配置。
   * 新注册的发射器默认位置为 (0, 0)，需通过 emit() 指定位置。
   *
   * @param config - 发射器配置
   */
  registerEmitter(config: EmitterConfig): void {
    const existing = this.emitters.get(config.id);
    if (existing) {
      // 保留已有位置，更新配置
      existing.config = config;
    } else {
      this.emitters.set(config.id, {
        config,
        cx: 0,
        cy: 0,
        emitAccumulator: 0,
      });
    }
  }

  /**
   * 手动触发发射
   *
   * 在指定位置发射粒子。同时更新发射器的位置记录，
   * 以便自动发射模式也能在最新位置继续发射。
   *
   * @param emitterId - 发射器 ID
   * @param x - 发射中心 X 坐标
   * @param y - 发射中心 Y 坐标
   * @param count - 发射粒子数量（默认使用配置中的 emitCount）
   */
  emit(emitterId: string, x: number, y: number, count?: number): void {
    const runtime = this.emitters.get(emitterId);
    if (!runtime) {
      return;
    }

    // 更新发射器位置
    runtime.cx = x;
    runtime.cy = y;

    const emitCount = count ?? runtime.config.emitCount;
    for (let i = 0; i < emitCount; i++) {
      const particle = this.createParticle(runtime.config, x, y);
      this.particles.push(particle);
    }
  }

  /**
   * 每帧更新
   *
   * 执行三个步骤：
   * 1. 自动发射器定时发射
   * 2. 粒子物理更新（速度 + 重力 → 位置）
   * 3. 粒子生命周期更新（颜色/尺寸插值、老化、标记死亡）
   *
   * @param dt - 帧间隔时间（秒）
   */
  update(dt: number): void {
    // 限制 dt 防止长时间挂起后产生大量粒子
    const clampedDt = Math.min(dt, 0.1);

    // Step 1: 自动发射器定时发射
    this.processAutoEmit(clampedDt);

    // Step 2 & 3: 物理更新 + 生命周期
    this.processParticleUpdate(clampedDt);
  }

  /**
   * 渲染所有存活粒子到 Canvas
   *
   * 使用 Canvas 2D API 绘制实色圆形。
   * 通过 save/restore 保护外部 Canvas 状态。
   * 不使用任何 neon/glow/闪烁效果。
   *
   * @param ctx - Canvas 2D 渲染上下文
   */
  render(ctx: CanvasRenderingContext2D): void {
    ctx.save();

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (!p.alive || p.opacity <= 0 || p.size <= 0) {
        continue;
      }

      ctx.save();
      ctx.globalAlpha = p.opacity;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.fillStyle = p.color;

      ctx.beginPath();
      ctx.arc(0, 0, p.size, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    ctx.restore();
  }

  /**
   * 获取当前存活粒子数量
   *
   * @returns 存活粒子数
   */
  getAliveCount(): number {
    let count = 0;
    for (let i = 0; i < this.particles.length; i++) {
      if (this.particles[i].alive) {
        count++;
      }
    }
    return count;
  }

  /**
   * 清除所有粒子
   *
   * 保留已注册的发射器，仅清除粒子列表。
   */
  clear(): void {
    this.particles = [];
  }

  /**
   * 移除发射器及其产生的所有粒子
   *
   * @param id - 要移除的发射器 ID
   */
  removeEmitter(id: string): void {
    this.emitters.delete(id);

    // 标记该发射器产生的所有粒子为死亡
    for (let i = 0; i < this.particles.length; i++) {
      if (this.particles[i].emitterId === id) {
        this.particles[i].alive = false;
      }
    }

    // 立即清除死亡粒子，释放内存
    this.compactParticles();
  }

  /**
   * 获取所有已注册发射器的 ID 列表
   *
   * @returns 发射器 ID 数组
   */
  getEmitterIds(): string[] {
    const ids: string[] = [];
    this.emitters.forEach((_runtime, id) => {
      ids.push(id);
    });
    return ids;
  }

  // ----------------------------------------------------------
  // 公共方法结束
  // ----------------------------------------------------------

  // ----------------------------------------------------------
  // 私有方法
  // ----------------------------------------------------------

  /**
   * 创建单个粒子
   *
   * 根据发射器配置在指定中心点附近生成一个粒子实例。
   * 粒子的初始位置由发射器形状决定，速度由配置决定。
   *
   * @param config - 发射器配置
   * @param cx - 发射器中心 X
   * @param cy - 发射器中心 Y
   * @returns 新创建的粒子实例
   */
  private createParticle(config: EmitterConfig, cx: number, cy: number): Particle {
    // 在发射器形状内取随机位置
    const pos = this.randomPositionInShape(config.shape, cx, cy);

    // 计算随机速度
    const speed = this.randomRange(config.speed.min, config.speed.max);

    // 计算发射角度
    let angle: number;
    if (config.speed.angle === null) {
      // 随机 360°
      angle = Math.random() * Math.PI * 2;
    } else {
      // 以 angle 为中心，在 spread 范围内随机
      const halfSpread = config.speed.spread / 2;
      angle = config.speed.angle + this.randomRange(-halfSpread, halfSpread);
    }

    // 计算随机生命周期
    const maxAge = this.randomRange(config.lifetime[0], config.lifetime[1]);

    const particle: Particle = {
      uid: this.nextUid++,
      x: pos.x,
      y: pos.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: config.size.start,
      color: config.color.start,
      opacity: config.opacity,
      rotation: 0,
      age: 0,
      maxAge: maxAge,
      emitterId: config.id,
      alive: true,
    };

    return particle;
  }

  /**
   * 在发射器形状内随机取一个点
   *
   * - point:  精确中心点
   * - circle: 圆内均匀随机
   * - rect:   矩形内均匀随机
   * - ring:   环形区域内均匀随机
   *
   * @param shape - 发射器形状
   * @param cx - 中心 X
   * @param cy - 中心 Y
   * @returns 随机位置坐标
   */
  private randomPositionInShape(
    shape: EmitterShape,
    cx: number,
    cy: number,
  ): { x: number; y: number } {
    switch (shape.type) {
      case "point": {
        return { x: cx, y: cy };
      }

      case "circle": {
        // 使用 sqrt 均匀分布保证圆内均匀
        const r = Math.sqrt(Math.random()) * shape.radius;
        const theta = Math.random() * Math.PI * 2;
        return {
          x: cx + Math.cos(theta) * r,
          y: cy + Math.sin(theta) * r,
        };
      }

      case "rect": {
        const halfW = shape.width / 2;
        const halfH = shape.height / 2;
        return {
          x: cx + this.randomRange(-halfW, halfW),
          y: cy + this.randomRange(-halfH, halfH),
        };
      }

      case "ring": {
        // 在 [innerRadius, outerRadius] 之间均匀分布
        const innerR2 = shape.innerRadius * shape.innerRadius;
        const outerR2 = shape.outerRadius * shape.outerRadius;
        // 用面积比保证均匀分布：r² = random * (outer² - inner²) + inner²
        const rSquared = Math.random() * (outerR2 - innerR2) + innerR2;
        const r = Math.sqrt(rSquared);
        const theta = Math.random() * Math.PI * 2;
        return {
          x: cx + Math.cos(theta) * r,
          y: cy + Math.sin(theta) * r,
        };
      }

      default: {
        // 兜底：返回中心点
        return { x: cx, y: cy };
      }
    }
  }

  /**
   * 生成 [min, max] 范围内的随机数
   *
   * @param min - 最小值
   * @param max - 最大值
   * @returns 范围内的随机数
   */
  private randomRange(min: number, max: number): number {
    return min + Math.random() * (max - min);
  }

  // ----------------------------------------------------------
  // 内部更新辅助方法
  // ----------------------------------------------------------

  /**
   * 处理自动发射器的定时发射
   *
   * 遍历所有 emitRate > 0 的发射器，根据累积时间判断是否需要发射。
   *
   * @param dt - 帧间隔（秒）
   */
  private processAutoEmit(dt: number): void {
    this.emitters.forEach((runtime) => {
      const config = runtime.config;

      // emitRate === 0 表示手动模式，跳过
      if (config.emitRate <= 0) {
        return;
      }

      // 累积时间
      runtime.emitAccumulator += dt;

      // 计算发射间隔
      const interval = 1 / config.emitRate;

      // 可能一帧内需要发射多次（低帧率 + 高发射率的情况）
      while (runtime.emitAccumulator >= interval) {
        runtime.emitAccumulator -= interval;

        // 发射粒子
        for (let i = 0; i < config.emitCount; i++) {
          const particle = this.createParticle(config, runtime.cx, runtime.cy);
          this.particles.push(particle);
        }
      }
    });
  }

  /**
   * 处理粒子物理更新和生命周期管理
   *
   * 遍历所有粒子，执行：
   * 1. 重力影响 vy
   * 2. 位置更新
   * 3. 旋转更新
   * 4. 生命周期进度计算
   * 5. 颜色/尺寸/透明度插值
   * 6. 死亡标记
   * 7. 清除死亡粒子
   *
   * @param dt - 帧间隔（秒）
   */
  private processParticleUpdate(dt: number): void {
    // 用于批量收集需要查找的发射器配置（颜色/尺寸插值用）
    let aliveCount = 0;

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];

      // 跳过已死亡粒子
      if (!p.alive) {
        continue;
      }

      // 更新年龄
      p.age += dt;

      // 检查是否超过最大寿命
      if (p.age >= p.maxAge) {
        p.alive = false;
        continue;
      }

      // 计算生命周期进度 t ∈ [0, 1]
      const t = p.age / p.maxAge;

      // 获取发射器配置用于插值
      const runtime = this.emitters.get(p.emitterId);
      if (runtime) {
        const config = runtime.config;

        // 颜色插值
        p.color = this.interpolateColor(config.color.start, config.color.end, t);

        // 尺寸插值
        p.size = config.size.start + (config.size.end - config.size.start) * t;

        // 不透明度随生命周期衰减
        p.opacity = config.opacity * (1 - t);
      }

      // 物理更新：重力
      if (runtime && runtime.config.gravity !== 0) {
        p.vy += runtime.config.gravity * dt;
      }

      // 物理更新：位置
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // 旋转更新
      if (runtime && runtime.config.autoRotate) {
        p.rotation += runtime.config.rotationSpeed * dt;
      }

      aliveCount++;
    }

    // 定期清除死亡粒子，防止数组无限增长
    // 当死亡粒子占比超过 25% 或粒子总数超过 2000 时执行清理
    if (this.particles.length > 0) {
      const deadCount = this.particles.length - aliveCount;
      if (deadCount > 100 || (deadCount > 0 && this.particles.length > 2000)) {
        this.compactParticles();
      }
    }
  }

  /**
   * 压缩粒子数组，移除所有死亡粒子
   */
  private compactParticles(): void {
    const alive: Particle[] = [];
    for (let i = 0; i < this.particles.length; i++) {
      if (this.particles[i].alive) {
        alive.push(this.particles[i]);
      }
    }
    this.particles = alive;
  }

  /**
   * 在两个 CSS 颜色字符串之间进行线性插值
   *
   * 支持以下格式：
   * - "#rrggbb"
   * - "#rrggbbaa"
   * - "rgba(r, g, b, a)"
   * - "rgb(r, g, b)"
   *
   * @param startColor - 起始颜色
   * @param endColor - 结束颜色
   * @param t - 插值因子 [0, 1]
   * @returns 插值后的颜色字符串（rgba 格式）
   */
  private interpolateColor(startColor: string, endColor: string, t: number): string {
    const start = this.parseColor(startColor);
    const end = this.parseColor(endColor);

    const r = Math.round(start.r + (end.r - start.r) * t);
    const g = Math.round(start.g + (end.g - start.g) * t);
    const b = Math.round(start.b + (end.b - start.b) * t);
    const a = start.a + (end.a - start.a) * t;

    return `rgba(${r},${g},${b},${a.toFixed(3)})`;
  }

  /**
   * 解析 CSS 颜色字符串为 RGBA 分量
   *
   * @param color - CSS 颜色字符串
   * @returns RGBA 分量对象
   */
  private parseColor(color: string): { r: number; g: number; b: number; a: number } {
    const trimmed = color.trim().toLowerCase();

    // 格式: rgba(r, g, b, a)
    if (trimmed.startsWith("rgba(")) {
      const inner = trimmed.slice(5, -1);
      const parts = inner.split(",").map((s) => parseFloat(s.trim()));
      return {
        r: parts[0] || 0,
        g: parts[1] || 0,
        b: parts[2] || 0,
        a: isNaN(parts[3]) ? 1 : parts[3],
      };
    }

    // 格式: rgb(r, g, b)
    if (trimmed.startsWith("rgb(")) {
      const inner = trimmed.slice(4, -1);
      const parts = inner.split(",").map((s) => parseFloat(s.trim()));
      return {
        r: parts[0] || 0,
        g: parts[1] || 0,
        b: parts[2] || 0,
        a: 1,
      };
    }

    // 格式: #rrggbb 或 #rrggbbaa
    if (trimmed.startsWith("#")) {
      const hex = trimmed.slice(1);
      if (hex.length === 6) {
        // #rrggbb
        return {
          r: parseInt(hex.substring(0, 2), 16),
          g: parseInt(hex.substring(2, 4), 16),
          b: parseInt(hex.substring(4, 6), 16),
          a: 1,
        };
      }
      if (hex.length === 8) {
        // #rrggbbaa
        return {
          r: parseInt(hex.substring(0, 2), 16),
          g: parseInt(hex.substring(2, 4), 16),
          b: parseInt(hex.substring(4, 6), 16),
          a: parseInt(hex.substring(6, 8), 16) / 255,
        };
      }
      if (hex.length === 3) {
        // #rgb 短格式
        return {
          r: parseInt(hex[0] + hex[0], 16),
          g: parseInt(hex[1] + hex[1], 16),
          b: parseInt(hex[2] + hex[2], 16),
          a: 1,
        };
      }
    }

    // 兜底：返回白色
    return { r: 255, g: 255, b: 255, a: 1 };
  }

  // ----------------------------------------------------------
  // 私有方法结束
  // ----------------------------------------------------------
}
