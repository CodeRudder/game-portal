/**
 * renderer/managers/ParticleSystem.ts — 粒子系统
 *
 * 轻量级粒子发射器，提供：
 * - 粒子池（对象复用，避免 GC）
 * - 多种粒子形状（圆形、方形、三角形、星形）
 * - 重力和风力参数
 * - 生命周期管理
 * - 批量更新和渲染
 *
 * @module renderer/managers/ParticleSystem
 */

import { Container, Graphics } from 'pixi.js';
import gsap from 'gsap';

// ═══════════════════════════════════════════════════════════════
// 类型定义
// ═══════════════════════════════════════════════════════════════

/** 粒子形状 */
export type ParticleShape = 'circle' | 'square' | 'triangle' | 'star' | 'diamond';

/** 粒子发射器配置 */
export interface ParticleEmitterConfig {
  /** 发射位置 X */
  x: number;
  /** 发射位置 Y */
  y: number;
  /** 粒子数量（默认 10） */
  count?: number;
  /** 粒子颜色（十六进制数字或 CSS 颜色字符串） */
  color?: string | number;
  /** 粒子颜色范围（随机在两色之间插值） */
  colorRange?: [string | number, string | number];
  /** 粒子大小（默认 3） */
  size?: number;
  /** 粒子大小范围 [min, max] */
  sizeRange?: [number, number];
  /** 粒子形状（默认 'circle'） */
  shape?: ParticleShape;
  /** 粒子初始速度（默认 80） */
  speed?: number;
  /** 粒子速度范围 [min, max] */
  speedRange?: [number, number];
  /** 发射角度（弧度，默认 0） */
  angle?: number;
  /** 发射角度扩散范围（弧度，默认 Math.PI * 2 即全方向） */
  spread?: number;
  /** 粒子生命周期（秒，默认 0.6） */
  lifetime?: number;
  /** 粒子生命周期范围 [min, max] */
  lifetimeRange?: [number, number];
  /** 重力 X（像素/秒²，默认 0） */
  gravityX?: number;
  /** 重力 Y（像素/秒²，默认 0） */
  gravityY?: number;
  /** 风力 X（像素/秒²，默认 0） */
  windX?: number;
  /** 风力 Y（像素/秒²，默认 0） */
  windY?: number;
  /** 初始透明度（默认 1） */
  alpha?: number;
  /** 动画缓动（默认 'power2.out'） */
  ease?: string;
  /** 是否在开始时缩放为 0（默认 false） */
  scaleIn?: boolean;
  /** 初始旋转角度（弧度，默认 0） */
  rotation?: number;
  /** 旋转速度（弧度/秒，默认 0） */
  rotationSpeed?: number;
}

/** 池中单个粒子对象 */
interface PooledParticle {
  /** PixiJS Graphics 对象 */
  gfx: Graphics;
  /** 是否正在使用中 */
  active: boolean;
  /** 创建时间戳（秒） */
  createdAt: number;
  /** 生命周期（秒） */
  lifetime: number;
  /** 速度 X（像素/秒） */
  vx: number;
  /** 速度 Y（像素/秒） */
  vy: number;
  /** 重力 X（像素/秒²） */
  gravityX: number;
  /** 重力 Y（像素/秒²） */
  gravityY: number;
  /** 风力 X（像素/秒²） */
  windX: number;
  /** 风力 Y（像素/秒²） */
  windY: number;
  /** 旋转速度（弧度/秒） */
  rotationSpeed: number;
  /** 关联的 GSAP timeline */
  timeline: gsap.core.Timeline | null;
}

// ═══════════════════════════════════════════════════════════════
// ParticleSystem
// ═══════════════════════════════════════════════════════════════

/**
 * 粒子系统
 *
 * 管理粒子池和粒子发射。通过对象复用避免频繁 GC。
 * 每个粒子是一个 PixiJS Graphics，通过 GSAP 控制动画。
 *
 * @example
 * ```ts
 * const ps = new ParticleSystem();
 * ps.init(container);
 * ps.emit({
 *   x: 100, y: 100,
 *   count: 20,
 *   color: '#ff4444',
 *   shape: 'circle',
 *   speed: 100,
 *   lifetime: 0.8,
 * });
 * ```
 */
export class ParticleSystem {
  /** 粒子池 */
  private pool: PooledParticle[] = [];

  /** 粒子池最大容量 */
  private poolSize: number;

  /** 粒子渲染容器 */
  private container: Container | null = null;

  /** 活跃的 Timeline 列表（用于统一管理） */
  private activeTimelines: gsap.core.Timeline[] = [];

  /** 默认池大小 */
  private static readonly DEFAULT_POOL_SIZE = 300;

  constructor(poolSize = ParticleSystem.DEFAULT_POOL_SIZE) {
    this.poolSize = poolSize;
  }

  // ═══════════════════════════════════════════════════════════
  // 初始化
  // ═══════════════════════════════════════════════════════════

  /**
   * 初始化粒子系统
   *
   * @param container - 粒子渲染到哪个容器
   */
  init(container: Container): void {
    this.container = container;
  }

  /**
   * 获取粒子容器
   */
  getContainer(): Container | null {
    return this.container;
  }

  // ═══════════════════════════════════════════════════════════
  // 发射
  // ═══════════════════════════════════════════════════════════

  /**
   * 发射粒子
   *
   * 根据配置从指定位置发射一组粒子。
   *
   * @param config - 发射器配置
   * @returns 发射的粒子数量
   */
  emit(config: ParticleEmitterConfig): number {
    if (!this.container) return 0;

    const {
      x,
      y,
      count = 10,
      color = '#ffffff',
      colorRange,
      size = 3,
      sizeRange,
      shape = 'circle',
      speed = 80,
      speedRange,
      angle = 0,
      spread = Math.PI * 2,
      lifetime = 0.6,
      lifetimeRange,
      gravityX = 0,
      gravityY = 0,
      windX = 0,
      windY = 0,
      alpha = 1,
      ease = 'power2.out',
      scaleIn = false,
      rotation = 0,
      rotationSpeed = 0,
    } = config;

    let emitted = 0;

    for (let i = 0; i < count; i++) {
      const particle = this.acquire();
      if (!particle) break;

      // 随机参数
      const particleSize = sizeRange
        ? sizeRange[0] + Math.random() * (sizeRange[1] - sizeRange[0])
        : size;

      const particleSpeed = speedRange
        ? speedRange[0] + Math.random() * (speedRange[1] - speedRange[0])
        : speed;

      const particleLifetime = lifetimeRange
        ? lifetimeRange[0] + Math.random() * (lifetimeRange[1] - lifetimeRange[0])
        : lifetime;

      const particleAngle = angle + (Math.random() - 0.5) * spread;

      // 颜色选择
      let particleColor: string | number;
      if (colorRange) {
        particleColor = Math.random() > 0.5 ? colorRange[0] : colorRange[1];
      } else {
        particleColor = color;
      }

      // 设置速度
      particle.vx = Math.cos(particleAngle) * particleSpeed;
      particle.vy = Math.sin(particleAngle) * particleSpeed;
      particle.gravityX = gravityX;
      particle.gravityY = gravityY;
      particle.windX = windX;
      particle.windY = windY;
      particle.rotationSpeed = rotationSpeed;
      particle.lifetime = particleLifetime;
      particle.createdAt = performance.now() / 1000;

      // 绘制形状
      const gfx = particle.gfx;
      gfx.clear();
      this.drawShape(gfx, shape, particleSize, particleColor);
      gfx.alpha = alpha;
      gfx.position.set(x, y);

      if (scaleIn) {
        gfx.scale.set(0);
      } else {
        gfx.scale.set(1);
      }

      gfx.rotation = rotation;

      // 计算目标位置（考虑速度和重力/风力的近似）
      const targetX = x + particle.vx * particleLifetime + 0.5 * (gravityX + windX) * particleLifetime * particleLifetime;
      const targetY = y + particle.vy * particleLifetime + 0.5 * (gravityY + windY) * particleLifetime * particleLifetime;

      // GSAP 动画
      const tl = gsap.timeline({
        onComplete: () => {
          this.release(particle);
          this.removeTimeline(tl);
        },
      });

      tl.to(gfx, {
        x: targetX,
        y: targetY,
        alpha: 0,
        rotation: rotation + rotationSpeed * particleLifetime,
        duration: particleLifetime,
        ease,
      }).to(gfx.scale, {
        x: 0.1,
        y: 0.1,
        duration: particleLifetime,
        ease: 'power1.in',
      }, 0);

      if (scaleIn) {
        tl.to(gfx.scale, {
          x: 1,
          y: 1,
          duration: particleLifetime * 0.2,
          ease: 'back.out(2)',
        }, 0);
      }

      particle.timeline = tl;
      this.addTimeline(tl);
      emitted++;
    }

    return emitted;
  }

  // ═══════════════════════════════════════════════════════════
  // 形状绘制
  // ═══════════════════════════════════════════════════════════

  /**
   * 在 Graphics 上绘制指定形状
   *
   * @param gfx - 目标 Graphics
   * @param shape - 形状类型
   * @param size - 大小（半径或半边长）
   * @param color - 填充颜色
   */
  drawShape(gfx: Graphics, shape: ParticleShape, size: number, color: string | number): void {
    switch (shape) {
      case 'circle':
        gfx.circle(0, 0, size);
        gfx.fill(color);
        break;

      case 'square':
        gfx.rect(-size, -size, size * 2, size * 2);
        gfx.fill(color);
        break;

      case 'triangle':
        gfx.moveTo(0, -size);
        gfx.lineTo(size, size);
        gfx.lineTo(-size, size);
        gfx.closePath();
        gfx.fill(color);
        break;

      case 'star': {
        const spikes = 5;
        const outerRadius = size;
        const innerRadius = size * 0.4;
        gfx.moveTo(0, -outerRadius);
        for (let i = 0; i < spikes; i++) {
          const outerAngle = (Math.PI * 2 * i) / spikes - Math.PI / 2;
          const innerAngle = outerAngle + Math.PI / spikes;
          gfx.lineTo(
            Math.cos(outerAngle) * outerRadius,
            Math.sin(outerAngle) * outerRadius,
          );
          gfx.lineTo(
            Math.cos(innerAngle) * innerRadius,
            Math.sin(innerAngle) * innerRadius,
          );
        }
        gfx.closePath();
        gfx.fill(color);
        break;
      }

      case 'diamond': {
        const half = size;
        gfx.moveTo(0, -half);
        gfx.lineTo(half * 0.7, 0);
        gfx.lineTo(0, half);
        gfx.lineTo(-half * 0.7, 0);
        gfx.closePath();
        gfx.fill(color);
        break;
      }
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 池管理
  // ═══════════════════════════════════════════════════════════

  /**
   * 获取活跃粒子数量
   */
  getActiveCount(): number {
    return this.pool.filter((p) => p.active).length;
  }

  /**
   * 获取池总大小
   */
  getPoolSize(): number {
    return this.pool.length;
  }

  /**
   * 获取池最大容量
   */
  getMaxPoolSize(): number {
    return this.poolSize;
  }

  /**
   * 获取空闲粒子数量
   */
  getIdleCount(): number {
    return this.pool.filter((p) => !p.active).length;
  }

  /**
   * 从池中获取一个粒子
   */
  private acquire(): PooledParticle | null {
    // 尝试复用空闲粒子
    for (const p of this.pool) {
      if (!p.active) {
        p.active = true;
        p.gfx.clear();
        p.gfx.alpha = 1;
        p.gfx.scale.set(1);
        p.timeline = null;
        if (this.container) {
          this.container.addChild(p.gfx);
        }
        return p;
      }
    }

    // 池未满则新建
    if (this.pool.length < this.poolSize) {
      const gfx = new Graphics();
      const p: PooledParticle = {
        gfx,
        active: true,
        createdAt: 0,
        lifetime: 0,
        vx: 0,
        vy: 0,
        gravityX: 0,
        gravityY: 0,
        windX: 0,
        windY: 0,
        rotationSpeed: 0,
        timeline: null,
      };
      this.pool.push(p);
      if (this.container) {
        this.container.addChild(gfx);
      }
      return p;
    }

    return null; // 池已满
  }

  /**
   * 释放粒子回池
   */
  private release(particle: PooledParticle): void {
    particle.active = false;
    particle.gfx.clear();
    particle.gfx.removeFromParent();
    particle.timeline = null;
  }

  // ═══════════════════════════════════════════════════════════
  // Timeline 管理
  // ═══════════════════════════════════════════════════════════

  /** 添加 Timeline 到追踪列表 */
  private addTimeline(tl: gsap.core.Timeline): void {
    this.activeTimelines.push(tl);
  }

  /** 从追踪列表移除 Timeline */
  private removeTimeline(tl: gsap.core.Timeline): void {
    const idx = this.activeTimelines.indexOf(tl);
    if (idx >= 0) {
      this.activeTimelines.splice(idx, 1);
    }
  }

  /**
   * 获取活跃 Timeline 数量
   */
  getActiveTimelineCount(): number {
    return this.activeTimelines.length;
  }

  // ═══════════════════════════════════════════════════════════
  // 销毁
  // ═══════════════════════════════════════════════════════════

  /**
   * 销毁粒子系统，释放所有资源
   */
  destroy(): void {
    // 杀死所有活跃 Timeline
    for (const tl of this.activeTimelines) {
      tl.kill();
    }
    this.activeTimelines = [];

    // 销毁所有粒子 Graphics
    for (const p of this.pool) {
      p.gfx.destroy();
    }
    this.pool = [];
    this.container = null;
  }
}
