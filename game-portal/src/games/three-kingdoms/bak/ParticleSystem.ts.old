/**
 * ParticleSystem — 三国霸业轻量级视觉粒子系统
 *
 * 提供四种古风氛围粒子效果：
 * - petal: 樱花花瓣飘落（淡粉色）
 * - smoke: 烟雾上升（淡灰色）
 * - spark: 金色火花爆发（升级/建造时）
 * - snow: 雪花飘落（冬季场景）
 *
 * 纯 Canvas 2D 渲染，零外部依赖。
 * 不使用 neon/glow/闪烁效果。
 *
 * @module games/three-kingdoms/ParticleSystem
 */

// ═══════════════════════════════════════════════════════════════
// 类型定义
// ═══════════════════════════════════════════════════════════════

/** 粒子类型 */
export type ParticleType = 'petal' | 'smoke' | 'spark' | 'snow';

/** 单个粒子实例 */
export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  /** 旋转角度（弧度），花瓣/雪花使用 */
  rotation: number;
  /** 旋转速度（弧度/秒） */
  rotationSpeed: number;
  /** 水平摆动相位 */
  wobblePhase: number;
  /** 水平摆动幅度 */
  wobbleAmp: number;
  /** 水平摆动频率 */
  wobbleFreq: number;
}

/** 粒子类型配置 */
interface ParticleTypeConfig {
  /** 粒子颜色池（随机选择） */
  colors: string[];
  /** 最小尺寸 */
  minSize: number;
  /** 最大尺寸 */
  maxSize: number;
  /** 最小速度 */
  minSpeed: number;
  /** 最大速度 */
  maxSpeed: number;
  /** 最小生命周期（秒） */
  minLife: number;
  /** 最大生命周期（秒） */
  maxLife: number;
  /** 重力（正=向下） */
  gravity: number;
  /** 水平摆动幅度 */
  wobbleAmp: number;
  /** 水平摆动频率 */
  wobbleFreq: number;
}

// ═══════════════════════════════════════════════════════════════
// 粒子类型预设配置
// ═══════════════════════════════════════════════════════════════

const PARTICLE_CONFIGS: Record<ParticleType, ParticleTypeConfig> = {
  petal: {
    colors: [
      'rgba(255,183,197,0.7)',
      'rgba(255,192,203,0.6)',
      'rgba(255,170,190,0.65)',
      'rgba(248,200,210,0.55)',
    ],
    minSize: 2,
    maxSize: 5,
    minSpeed: 15,
    maxSpeed: 40,
    minLife: 4,
    maxLife: 8,
    gravity: 8,
    wobbleAmp: 20,
    wobbleFreq: 1.5,
  },
  smoke: {
    colors: [
      'rgba(180,170,160,0.15)',
      'rgba(160,150,140,0.12)',
      'rgba(200,190,180,0.1)',
    ],
    minSize: 4,
    maxSize: 10,
    minSpeed: 5,
    maxSpeed: 15,
    minLife: 3,
    maxLife: 6,
    gravity: -6,
    wobbleAmp: 8,
    wobbleFreq: 0.8,
  },
  spark: {
    colors: [
      'rgba(255,215,0,0.9)',
      'rgba(255,200,50,0.85)',
      'rgba(255,180,30,0.8)',
      'rgba(212,160,48,0.9)',
    ],
    minSize: 1.5,
    maxSize: 3.5,
    minSpeed: 40,
    maxSpeed: 120,
    minLife: 0.4,
    maxLife: 1.2,
    gravity: 60,
    wobbleAmp: 0,
    wobbleFreq: 0,
  },
  snow: {
    colors: [
      'rgba(255,255,255,0.7)',
      'rgba(240,245,255,0.6)',
      'rgba(220,230,245,0.55)',
    ],
    minSize: 1.5,
    maxSize: 4,
    minSpeed: 10,
    maxSpeed: 30,
    minLife: 5,
    maxLife: 10,
    gravity: 5,
    wobbleAmp: 15,
    wobbleFreq: 1.0,
  },
};

// ═══════════════════════════════════════════════════════════════
// ParticleSystem 实现
// ═══════════════════════════════════════════════════════════════

/**
 * 轻量级视觉粒子系统
 *
 * 用于在 Canvas 上渲染古风氛围粒子效果。
 * 支持四种粒子类型：花瓣、烟雾、火花、雪花。
 *
 * 使用方式：
 * ```ts
 * const ps = new ParticleSystem();
 * // 在游戏循环中每帧调用
 * ps.update(deltaTime);
 * ps.render(ctx);
 * // 触发粒子效果
 * ps.emit(100, 50, 'petal', 20);
 * ps.emit(200, 100, 'spark', 15);
 * ```
 */
export class TKParticleSystem {
  /** 存活粒子列表 */
  private particles: Particle[] = [];

  /** 粒子上限（防止性能问题） */
  private readonly maxParticles: number = 500;

  /** 画布宽度（用于自动发射定位） */
  private canvasWidth: number = 800;

  /** 画布高度（用于自动发射定位） */
  private canvasHeight: number = 600;

  /** 自动发射器配置 */
  private autoEmitters: Map<string, {
    type: ParticleType;
    rate: number;      // 每秒发射数量
    accumulator: number;
    x: number;
    y: number;
    spread: number;    // 发射范围半径
  }> = new Map();

  // ─── 公共方法 ─────────────────────────────────────────────

  /**
   * 在指定位置发射粒子
   *
   * @param x - 发射中心 X 坐标
   * @param y - 发射中心 Y 坐标
   * @param type - 粒子类型
   * @param count - 发射数量
   */
  emit(x: number, y: number, type: ParticleType, count: number): void {
    const config = PARTICLE_CONFIGS[type];
    if (!config) return;

    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.maxParticles) break;
      this.particles.push(this.createParticle(x, y, config, type));
    }
  }

  /**
   * 注册自动发射器（持续发射粒子）
   *
   * @param id - 发射器唯一标识
   * @param type - 粒子类型
   * @param rate - 每秒发射数量
   * @param x - 发射中心 X
   * @param y - 发射中心 Y
   * @param spread - 发射范围半径
   */
  registerAutoEmitter(
    id: string,
    type: ParticleType,
    rate: number,
    x: number,
    y: number,
    spread: number = 50,
  ): void {
    this.autoEmitters.set(id, {
      type,
      rate,
      accumulator: 0,
      x,
      y,
      spread,
    });
  }

  /**
   * 移除自动发射器
   */
  removeAutoEmitter(id: string): void {
    this.autoEmitters.delete(id);
  }

  /**
   * 设置画布尺寸（用于自动发射定位）
   */
  setCanvasSize(width: number, height: number): void {
    this.canvasWidth = width;
    this.canvasHeight = height;
  }

  /**
   * 每帧更新
   *
   * @param deltaTime - 帧间隔时间（秒）
   */
  update(deltaTime: number): void {
    const dt = Math.min(deltaTime, 0.1); // 防止长时间挂起

    // 自动发射器
    this.autoEmitters.forEach((emitter) => {
      emitter.accumulator += dt;
      const interval = 1 / emitter.rate;
      while (emitter.accumulator >= interval) {
        emitter.accumulator -= interval;
        const ox = (Math.random() - 0.5) * emitter.spread * 2;
        const oy = (Math.random() - 0.5) * emitter.spread * 2;
        this.emit(emitter.x + ox, emitter.y + oy, emitter.type, 1);
      }
    });

    // 更新粒子
    let writeIdx = 0;
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];

      // 更新生命
      p.life -= dt;
      if (p.life <= 0) continue; // 粒子死亡，跳过

      // 物理更新
      p.vy += PARTICLE_CONFIGS.spark.gravity !== 0 ? this.getGravity(p) * dt : 0;
      p.x += p.vx * dt + Math.sin(p.wobblePhase) * p.wobbleAmp * dt;
      p.y += p.vy * dt;
      p.rotation += p.rotationSpeed * dt;
      p.wobblePhase += p.wobbleFreq * dt;

      // 尺寸衰减
      const lifeRatio = p.life / p.maxLife;
      // 烟雾粒子尺寸随时间增大（膨胀效果）
      if (p.wobbleAmp > 0 && p.vy < 0) {
        // 烟雾类：膨胀
        p.size *= (1 + dt * 0.3);
      }

      this.particles[writeIdx++] = p;
    }
    this.particles.length = writeIdx;
  }

  /**
   * 渲染所有粒子到 Canvas
   *
   * @param ctx - Canvas 2D 渲染上下文
   */
  render(ctx: CanvasRenderingContext2D): void {
    if (this.particles.length === 0) return;

    ctx.save();

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      const lifeRatio = p.life / p.maxLife;
      const alpha = Math.min(1, lifeRatio * 2) * this.getBaseAlpha(p);

      if (alpha <= 0.01 || p.size <= 0.1) continue;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.fillStyle = p.color;

      // 根据粒子类型选择绘制形状
      if (p.wobbleAmp > 0 && p.vy > 0) {
        // 花瓣/雪花：绘制椭圆
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size, p.size * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.wobbleAmp === 0) {
        // 火花：绘制小圆
        ctx.beginPath();
        ctx.arc(0, 0, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // 烟雾：绘制柔和圆形
        ctx.beginPath();
        ctx.arc(0, 0, p.size, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }

    ctx.restore();
  }

  /**
   * 获取当前存活粒子数量
   */
  getAliveCount(): number {
    return this.particles.length;
  }

  /**
   * 清除所有粒子
   */
  clear(): void {
    this.particles.length = 0;
  }

  /**
   * 序列化（仅保存自动发射器配置）
   */
  serialize(): Record<string, unknown> {
    const emitters: Record<string, unknown> = {};
    this.autoEmitters.forEach((emitter, id) => {
      emitters[id] = {
        type: emitter.type,
        rate: emitter.rate,
        x: emitter.x,
        y: emitter.y,
        spread: emitter.spread,
      };
    });
    return { emitters, particleCount: this.particles.length };
  }

  // ─── 私有方法 ─────────────────────────────────────────────

  /**
   * 创建单个粒子
   */
  private createParticle(x: number, y: number, config: ParticleTypeConfig, type: ParticleType): Particle {
    const color = config.colors[Math.floor(Math.random() * config.colors.length)];
    const size = config.minSize + Math.random() * (config.maxSize - config.minSize);
    const speed = config.minSpeed + Math.random() * (config.maxSpeed - config.minSpeed);
    const life = config.minLife + Math.random() * (config.maxLife - config.minLife);

    // 根据类型确定初始方向
    let vx: number, vy: number;
    if (type === 'petal' || type === 'snow') {
      // 从上方飘落：初始在顶部，向下飘
      vx = (Math.random() - 0.5) * speed * 0.5;
      vy = Math.random() * speed * 0.3 + speed * 0.2;
    } else if (type === 'smoke') {
      // 向上飘
      vx = (Math.random() - 0.5) * speed * 0.3;
      vy = -speed;
    } else {
      // spark：向四周爆发
      const angle = Math.random() * Math.PI * 2;
      vx = Math.cos(angle) * speed;
      vy = Math.sin(angle) * speed;
    }

    return {
      x: x + (Math.random() - 0.5) * 10,
      y: type === 'petal' || type === 'snow' ? -10 : y, // 花瓣/雪花从顶部外开始
      vx,
      vy,
      life,
      maxLife: life,
      color,
      size,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 3,
      wobblePhase: Math.random() * Math.PI * 2,
      wobbleAmp: config.wobbleAmp,
      wobbleFreq: config.wobbleFreq,
    };
  }

  /**
   * 获取粒子重力
   */
  private getGravity(p: Particle): number {
    // 烟雾向上，花瓣/雪花缓慢向下，火花快速向下
    if (p.wobbleAmp > 0 && p.vy < 0) return -6;   // smoke
    if (p.wobbleAmp > 0) return 8;                   // petal/snow
    return 60;                                        // spark
  }

  /**
   * 获取粒子基础透明度
   */
  private getBaseAlpha(p: Particle): number {
    // 从颜色字符串中提取 alpha
    const match = p.color.match(/[\d.]+(?=\))/);
    return match ? parseFloat(match[0]) : 0.7;
  }
}
