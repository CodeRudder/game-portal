/**
 * renderer/managers/AnimationManager.ts — 动画管理器
 *
 * 基于 GSAP 的动画编排系统，提供：
 * - 建筑建造/升级动画
 * - 战斗动画序列
 * - 伤害飘字动画
 * - 场景过渡动画
 * - UI 过渡动画
 *
 * @module renderer/managers/AnimationManager
 */

import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import gsap from 'gsap';
import type { SceneTransition, DamageNumberData } from '../types';
import type { IAnimationManager } from '../types';

// ═══════════════════════════════════════════════════════════════
// 特效类型
// ═══════════════════════════════════════════════════════════════

/** 支持的特效类型 */
export type EffectType =
  | 'attack_slash'     // 三角形斩击弧线
  | 'attack_pierce'    // 线性穿刺
  | 'attack_blunt'     // 圆形冲击波
  | 'magic_fire'       // 红橙色粒子向上扩散
  | 'magic_ice'        // 蓝白色菱形粒子四散
  | 'magic_lightning'  // 黄色锯齿线段闪烁
  | 'magic_heal'       // 绿色光环从底部上升
  | 'buff_shield'      // 蓝色半透明圆形护盾
  | 'buff_speed'       // 绿色条纹向后流动
  | 'debuff_poison'    // 紫色气泡上升
  | 'debuff_slow'      // 灰色锁链环绕
  | 'critical_hit'     // 大号伤害数字 + 白色闪光
  | 'level_up'         // 金色光柱从底部升起
  | 'death'            // 目标淡出 + 灰色粒子下沉
  | 'explosion';       // 橙红色圆形扩散 + 碎片

/** 特效配置 */
export interface EffectConfig {
  /** 特效类型 */
  type: EffectType;
  /** 特效位置 X */
  x: number;
  /** 特效位置 Y */
  y: number;
  /** 持续时间秒（默认根据特效类型） */
  duration?: number;
  /** 缩放（默认 1） */
  scale?: number;
  /** 自定义颜色覆盖 */
  color?: string | number;
  /** 完成回调 */
  onComplete?: () => void;
}

// ═══════════════════════════════════════════════════════════════
// 粒子类型
// ═══════════════════════════════════════════════════════════════

/** 粒子对象（池复用） */
interface Particle {
  /** Graphics 小圆点 */
  gfx: Graphics;
  /** 是否正在使用中 */
  active: boolean;
}

/** 滑入方向 */
type SlideDirection = 'left' | 'right' | 'top' | 'bottom';

// ═══════════════════════════════════════════════════════════════
// AnimationManager
// ═══════════════════════════════════════════════════════════════

/**
 * 动画管理器
 *
 * 封装 GSAP，为游戏场景提供统一的动画接口。
 * 所有动画通过 gsap.timeline() 编排，确保可暂停/可取消。
 *
 * @example
 * ```ts
 * const am = new AnimationManager();
 * am.playBuildingAnimation(buildingContainer, 'build', () => {
 *   console.log('建造完成');
 * });
 * ```
 */
export class AnimationManager implements IAnimationManager {
  // ─── 活跃动画追踪 ────────────────────────────────────────

  /** 活跃的 Timeline 列表（用于统一管理） */
  private activeTimelines: gsap.core.Timeline[] = [];

  /** 粒子池（复用 Graphics 对象，避免频繁创建/销毁） */
  private particlePool: Particle[] = [];

  /** 粒子池最大容量 */
  private static readonly PARTICLE_POOL_SIZE = 200;

  /** 粒子容器（所有粒子添加到此容器，方便统一管理） */
  private particleContainer: Container | null = null;

  /** 屏幕效果覆盖层 */
  private flashOverlay: Graphics | null = null;

  /** 慢动作原始时间缩放 */
  private previousTimeScale = 1;

  // ═══════════════════════════════════════════════════════════
  // 粒子系统
  // ═══════════════════════════════════════════════════════════

  /**
   * 设置粒子容器
   *
   * 必须在使用粒子系统前调用，将粒子渲染到指定容器。
   *
   * @param container - 粒子容器（通常添加到场景顶层）
   */
  setParticleContainer(container: Container): void {
    this.particleContainer = container;
  }

  /**
   * 创建粒子爆发效果
   *
   * 从中心点向四周发射粒子，适用于爆炸、命中反馈等。
   *
   * @param x - 爆发中心 X
   * @param y - 爆发中心 Y
   * @param count - 粒子数量（默认 12）
   * @param color - 粒子颜色（默认 '#ffffff'）
   * @param duration - 持续时间秒（默认 0.6）
   */
  createParticleBurst(
    x: number,
    y: number,
    count = 12,
    color: string | number = '#ffffff',
    duration = 0.6,
  ): void {
    if (!this.particleContainer) return;

    for (let i = 0; i < count; i++) {
      const particle = this.acquireParticle();
      if (!particle) continue;

      const gfx = particle.gfx;
      gfx.tint = typeof color === 'string' ? color : color;
      gfx.alpha = 1;
      gfx.scale.set(1);
      gfx.position.set(x, y);

      // 随机角度和速度
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
      const speed = 60 + Math.random() * 80;
      const targetX = x + Math.cos(angle) * speed;
      const targetY = y + Math.sin(angle) * speed;
      const particleSize = 2 + Math.random() * 3;

      gfx.circle(0, 0, particleSize);
      gfx.fill(color);

      const tl = gsap.timeline({
        onComplete: () => this.releaseParticle(particle),
      });

      tl.to(gfx, {
        x: targetX,
        y: targetY,
        alpha: 0,
        duration,
        ease: 'power2.out',
      }).to(gfx.scale, {
        x: 0.2,
        y: 0.2,
        duration,
        ease: 'power1.in',
      }, 0);

      this.addTimeline(tl);
    }
  }

  /**
   * 创建粒子拖尾效果
   *
   * 在指定位置生成短生命周期的粒子，适用于移动拖尾。
   *
   * @param x - 粒子位置 X
   * @param y - 粒子位置 Y
   * @param color - 粒子颜色（默认 '#ffffff'）
   */
  createParticleTrail(x: number, y: number, color: string | number = '#ffffff'): void {
    if (!this.particleContainer) return;

    const particle = this.acquireParticle();
    if (!particle) return;

    const gfx = particle.gfx;
    const offsetX = (Math.random() - 0.5) * 6;
    const offsetY = (Math.random() - 0.5) * 6;
    const particleSize = 1.5 + Math.random() * 2;

    gfx.clear();
    gfx.circle(0, 0, particleSize);
    gfx.fill(color);
    gfx.alpha = 0.8;
    gfx.scale.set(1);
    gfx.position.set(x + offsetX, y + offsetY);

    const tl = gsap.timeline({
      onComplete: () => this.releaseParticle(particle),
    });

    tl.to(gfx, {
      y: gfx.y - 15 - Math.random() * 10,
      alpha: 0,
      duration: 0.3 + Math.random() * 0.2,
      ease: 'power1.out',
    }).to(gfx.scale, {
      x: 0.3,
      y: 0.3,
      duration: 0.4,
      ease: 'power1.in',
    }, 0);

    this.addTimeline(tl);
  }

  /**
   * 获取一个可用粒子（从池中取或新建）
   */
  private acquireParticle(): Particle | null {
    // 尝试从池中取空闲粒子
    for (const p of this.particlePool) {
      if (!p.active) {
        p.active = true;
        p.gfx.clear();
        p.gfx.alpha = 1;
        p.gfx.scale.set(1);
        this.particleContainer!.addChild(p.gfx);
        return p;
      }
    }

    // 池未满则新建
    if (this.particlePool.length < AnimationManager.PARTICLE_POOL_SIZE) {
      const gfx = new Graphics();
      const p: Particle = { gfx, active: true };
      this.particlePool.push(p);
      this.particleContainer!.addChild(gfx);
      return p;
    }

    return null; // 池已满
  }

  /**
   * 释放粒子回池
   */
  private releaseParticle(particle: Particle): void {
    particle.active = false;
    particle.gfx.clear();
    particle.gfx.removeFromParent();
  }

  // ═══════════════════════════════════════════════════════════
  // 屏幕效果
  // ═══════════════════════════════════════════════════════════

  /**
   * 屏幕震动效果
   *
   * 对容器施加随机位移抖动，适用于爆炸、受击等。
   *
   * @param intensity - 震动强度（像素，默认 8）
   * @param duration - 持续时间秒（默认 0.3）
   * @param container - 要震动的容器（默认 particleContainer）
   */
  screenShake(intensity = 8, duration = 0.3, container?: Container): void {
    const target = container ?? this.particleContainer?.parent;
    if (!target) return;

    const originalX = target.x;
    const originalY = target.y;

    const tl = gsap.timeline({
      onComplete: () => {
        target.x = originalX;
        target.y = originalY;
        this.removeTimeline(tl);
      },
    });

    // 快速来回抖动
    const steps = Math.max(4, Math.round(duration / 0.03));
    for (let i = 0; i < steps; i++) {
      const decay = 1 - i / steps; // 逐渐减弱
      tl.to(target, {
        x: originalX + (Math.random() - 0.5) * 2 * intensity * decay,
        y: originalY + (Math.random() - 0.5) * 2 * intensity * decay,
        duration: duration / steps,
        ease: 'none',
      });
    }

    this.addTimeline(tl);
  }

  /**
   * 屏幕闪光效果
   *
   * 全屏覆盖一层半透明颜色然后淡出。
   *
   * @param color - 闪光颜色（默认 '#ffffff'）
   * @param duration - 持续时间秒（默认 0.2）
   * @param parent - 覆盖层添加到的父容器（默认 particleContainer）
   */
  screenFlash(color: string | number = '#ffffff', duration = 0.2, parent?: Container): void {
    const target = parent ?? this.particleContainer;
    if (!target) return;

    const overlay = new Graphics();
    // 覆盖足够大的区域
    overlay.rect(-2000, -2000, 6000, 6000);
    overlay.fill({ color, alpha: 0.6 });
    target.addChild(overlay);

    const tl = gsap.timeline({
      onComplete: () => {
        target.removeChild(overlay);
        overlay.destroy();
        this.removeTimeline(tl);
      },
    });

    tl.to(overlay, { alpha: 0, duration, ease: 'power1.out' });
    this.addTimeline(tl);
  }

  /**
   * 慢动作效果
   *
   * 临时降低 GSAP 全局时间缩放，到期后恢复。
   *
   * @param scale - 时间缩放（0~1，默认 0.3）
   * @param duration - 持续时间秒（默认 1）
   */
  slowMotion(scale = 0.3, duration = 1): void {
    this.previousTimeScale = gsap.globalTimeline.timeScale();
    gsap.globalTimeline.timeScale(scale);

    gsap.delayedCall(duration, () => {
      gsap.globalTimeline.timeScale(this.previousTimeScale);
    });
  }

  // ═══════════════════════════════════════════════════════════
  // UI 动画
  // ═══════════════════════════════════════════════════════════

  /**
   * 从指定方向滑入容器
   *
   * @param container - 目标容器
   * @param direction - 滑入方向
   * @param duration - 持续时间秒（默认 0.4）
   */
  async slideIn(container: Container, direction: SlideDirection = 'left', duration = 0.4): Promise<void> {
    const parentWidth = container.parent?.width ?? 1920;
    const parentHeight = container.parent?.height ?? 1080;
    const targetX = container.x;
    const targetY = container.y;

    // 根据方向设置初始位置
    switch (direction) {
      case 'left':
        container.x = -parentWidth;
        break;
      case 'right':
        container.x = parentWidth;
        break;
      case 'top':
        container.y = -parentHeight;
        break;
      case 'bottom':
        container.y = parentHeight;
        break;
    }

    return new Promise<void>((resolve) => {
      const tl = gsap.timeline({
        onComplete: () => {
          container.x = targetX;
          container.y = targetY;
          this.removeTimeline(tl);
          resolve();
        },
      });

      tl.to(container, {
        x: targetX,
        y: targetY,
        duration,
        ease: 'power2.out',
      });

      this.addTimeline(tl);
    });
  }

  /**
   * 渐入效果
   *
   * @param container - 目标容器
   * @param duration - 持续时间秒（默认 0.3）
   */
  async fadeIn(container: Container, duration = 0.3): Promise<void> {
    container.alpha = 0;

    return new Promise<void>((resolve) => {
      const tl = gsap.timeline({
        onComplete: () => {
          this.removeTimeline(tl);
          resolve();
        },
      });

      tl.to(container, { alpha: 1, duration, ease: 'power1.out' });
      this.addTimeline(tl);
    });
  }

  /**
   * 渐出效果
   *
   * @param container - 目标容器
   * @param duration - 持续时间秒（默认 0.3）
   */
  async fadeOut(container: Container, duration = 0.3): Promise<void> {
    return new Promise<void>((resolve) => {
      const tl = gsap.timeline({
        onComplete: () => {
          this.removeTimeline(tl);
          resolve();
        },
      });

      tl.to(container, { alpha: 0, duration, ease: 'power1.in' });
      this.addTimeline(tl);
    });
  }

  /**
   * 弹入效果（缩放弹跳）
   *
   * @param container - 目标容器
   * @param duration - 持续时间秒（默认 0.5）
   */
  async bounceIn(container: Container, duration = 0.5): Promise<void> {
    container.scale.set(0);
    container.alpha = 0;

    return new Promise<void>((resolve) => {
      const tl = gsap.timeline({
        onComplete: () => {
          this.removeTimeline(tl);
          resolve();
        },
      });

      tl.to(container, { alpha: 1, duration: duration * 0.3, ease: 'power1.out' })
        .to(container.scale, {
          x: 1,
          y: 1,
          duration: duration * 0.7,
          ease: 'elastic.out(1, 0.5)',
        }, 0);

      this.addTimeline(tl);
    });
  }

  // ═══════════════════════════════════════════════════════════
  // 建筑动画
  // ═══════════════════════════════════════════════════════════

  /**
   * 播放建筑动画
   *
   * @param target - 建筑容器
   * @param type - 动画类型
   *   - 'build': 新建动画（从无到有）
   *   - 'upgrade': 升级动画（闪光+缩放弹跳）
   *   - 'produce': 产出动画（轻微脉冲）
   * @param onComplete - 动画完成回调
   */
  playBuildingAnimation(
    target: Container,
    type: 'build' | 'upgrade' | 'produce',
    onComplete?: () => void,
  ): void {
    const tl = gsap.timeline({
      onComplete: () => {
        this.removeTimeline(tl);
        onComplete?.();
      },
    });

    switch (type) {
      case 'build':
        // 从 0 缩放到 1，带弹跳效果
        target.scale.set(0);
        target.alpha = 0;
        tl.to(target, { alpha: 1, duration: 0.2, ease: 'power1.out' })
          .to(target.scale, {
            x: 1,
            y: 1,
            duration: 0.5,
            ease: 'back.out(1.7)',
          }, '<');
        break;

      case 'upgrade':
        // 闪光 + 缩放弹跳
        tl.to(target.scale, {
          x: 1.2,
          y: 1.2,
          duration: 0.15,
          ease: 'power2.in',
        })
          .to(target.scale, {
            x: 1,
            y: 1,
            duration: 0.3,
            ease: 'elastic.out(1, 0.5)',
          })
          .fromTo(
            target,
            { alpha: 0.5 },
            { alpha: 1, duration: 0.2, ease: 'power1.out' },
            0,
          );
        break;

      case 'produce':
        // 轻微脉冲
        tl.to(target.scale, {
          x: 1.05,
          y: 1.05,
          duration: 0.2,
          ease: 'power1.inOut',
          yoyo: true,
          repeat: 1,
        });
        break;
    }

    this.addTimeline(tl);
  }

  // ═══════════════════════════════════════════════════════════
  // 战斗动画
  // ═══════════════════════════════════════════════════════════

  /**
   * 播放战斗动画
   *
   * @param attacker - 攻击方容器
   * @param target - 被攻击方容器
   * @param effectType - 特效类型
   * @param damage - 伤害值（用于飘字）
   * @param onComplete - 动画完成回调
   */
  playCombatAnimation(
    attacker: Container,
    target: Container,
    effectType: string,
    damage: number,
    onComplete?: () => void,
  ): void {
    const tl = gsap.timeline({
      onComplete: () => {
        this.removeTimeline(tl);
        onComplete?.();
      },
    });

    // 攻击方前冲
    const originalX = attacker.x;
    const rushDistance = (target.x - attacker.x) * 0.3;

    tl.to(attacker, {
      x: originalX + rushDistance,
      duration: 0.15,
      ease: 'power2.in',
    })
      // 被攻击方受击抖动
      .to(target, {
        x: target.x + 5,
        duration: 0.05,
        yoyo: true,
        repeat: 3,
        ease: 'power1.inOut',
      })
      // 攻击方回归
      .to(attacker, {
        x: originalX,
        duration: 0.2,
        ease: 'power2.out',
      }, '<')
      // 被攻击方闪烁
      .fromTo(
        target,
        { alpha: 0.3 },
        { alpha: 1, duration: 0.1, repeat: 2 },
        '-=0.15',
      );

    // 根据效果类型添加特效
    if (this.particleContainer) {
      this.createEffectInternal(
        effectType,
        target.x + (target.width ?? 0) / 2,
        target.y + (target.height ?? 0) / 2,
        tl,
      );
    }

    this.addTimeline(tl);
  }

  // ═══════════════════════════════════════════════════════════
  // 特效系统
  // ═══════════════════════════════════════════════════════════

  /**
   * 创建特效
   *
   * 根据特效类型在指定位置程序化渲染特效。
   * 所有特效使用 PixiJS Graphics API 绘制，配合 GSAP 动画。
   *
   * @param config - 特效配置
   * @returns 创建的 Timeline（可用于控制特效）
   */
  createEffect(config: EffectConfig): gsap.core.Timeline | null {
    if (!this.particleContainer) return null;

    const {
      type,
      x,
      y,
      scale = 1,
      color,
      onComplete,
    } = config;

    const tl = gsap.timeline({
      onComplete: () => {
        this.removeTimeline(tl);
        onComplete?.();
      },
    });

    this.createEffectInternal(type, x, y, tl, scale, color);
    this.addTimeline(tl);
    return tl;
  }

  /**
   * 内部特效渲染分发
   *
   * 根据 effectType 调用对应的程序化绘制方法。
   *
   * @param effectType - 特效类型字符串
   * @param x - 特效中心 X
   * @param y - 特效中心 Y
   * @param tl - 追加动画的 Timeline
   * @param scale - 缩放
   * @param color - 可选颜色覆盖
   */
  private createEffectInternal(
    effectType: string,
    x: number,
    y: number,
    tl: gsap.core.Timeline,
    scale = 1,
    color?: string | number,
  ): void {
    switch (effectType) {
      case 'attack_slash':
        this.renderAttackSlash(x, y, tl, scale, color);
        break;
      case 'attack_pierce':
        this.renderAttackPierce(x, y, tl, scale, color);
        break;
      case 'attack_blunt':
        this.renderAttackBlunt(x, y, tl, scale, color);
        break;
      case 'magic_fire':
        this.renderMagicFire(x, y, tl, scale, color);
        break;
      case 'magic_ice':
        this.renderMagicIce(x, y, tl, scale, color);
        break;
      case 'magic_lightning':
        this.renderMagicLightning(x, y, tl, scale, color);
        break;
      case 'magic_heal':
        this.renderMagicHeal(x, y, tl, scale, color);
        break;
      case 'buff_shield':
        this.renderBuffShield(x, y, tl, scale, color);
        break;
      case 'buff_speed':
        this.renderBuffSpeed(x, y, tl, scale, color);
        break;
      case 'debuff_poison':
        this.renderDebuffPoison(x, y, tl, scale, color);
        break;
      case 'debuff_slow':
        this.renderDebuffSlow(x, y, tl, scale, color);
        break;
      case 'critical_hit':
        this.renderCriticalHit(x, y, tl, scale, color);
        break;
      case 'level_up':
        this.renderLevelUp(x, y, tl, scale, color);
        break;
      case 'death':
        this.renderDeath(x, y, tl, scale, color);
        break;
      case 'explosion':
        this.renderExplosion(x, y, tl, scale, color);
        break;
      default:
        // 未知类型 — 不渲染特效
        break;
    }
  }

  // ─── 攻击特效 ─────────────────────────────────────────────

  /**
   * 斩击弧线 — 三角形弧线快速出现→消失
   */
  private renderAttackSlash(
    x: number, y: number, tl: gsap.core.Timeline,
    scale: number, color?: string | number,
  ): void {
    const gfx = new Graphics();
    const slashColor = color ?? 0xcccccc;

    // 绘制弧形斩击线
    gfx.moveTo(0, 0);
    gfx.arc(0, 0, 40 * scale, -Math.PI * 0.7, Math.PI * 0.2);
    gfx.lineTo(0, 0);
    gfx.closePath();
    gfx.fill({ color: slashColor, alpha: 0.8 });

    // 外发光
    gfx.moveTo(0, 0);
    gfx.arc(0, 0, 45 * scale, -Math.PI * 0.7, Math.PI * 0.2);
    gfx.lineTo(0, 0);
    gfx.closePath();
    gfx.fill({ color: 0xffffff, alpha: 0.3 });

    gfx.position.set(x, y);
    gfx.alpha = 0;
    gfx.scale.set(0.3);
    this.particleContainer!.addChild(gfx);

    tl.to(gfx, { alpha: 1, duration: 0.05, ease: 'power1.in' }, 0)
      .to(gfx.scale, { x: 1.2 * scale, y: 1.2 * scale, duration: 0.1, ease: 'power2.out' }, 0)
      .to(gfx, { alpha: 0, duration: 0.15, ease: 'power1.in' }, 0.1)
      .call(() => {
        gfx.removeFromParent();
        gfx.destroy();
      });
  }

  /**
   * 线性穿刺 — 细长矩形快速穿过
   */
  private renderAttackPierce(
    x: number, y: number, tl: gsap.core.Timeline,
    scale: number, color?: string | number,
  ): void {
    const gfx = new Graphics();
    const pierceColor = color ?? 0xdddddd;

    // 细长穿刺线
    gfx.rect(-3 * scale, -30 * scale, 6 * scale, 60 * scale);
    gfx.fill({ color: pierceColor, alpha: 0.9 });
    // 尖端
    gfx.moveTo(0, -30 * scale);
    gfx.lineTo(5 * scale, -20 * scale);
    gfx.lineTo(-5 * scale, -20 * scale);
    gfx.closePath();
    gfx.fill({ color: 0xffffff, alpha: 0.7 });

    gfx.position.set(x - 40 * scale, y);
    gfx.alpha = 0;
    this.particleContainer!.addChild(gfx);

    tl.to(gfx, { x: x + 40 * scale, alpha: 1, duration: 0.08, ease: 'power2.in' }, 0)
      .to(gfx, { alpha: 0, duration: 0.1, ease: 'power1.in' }, 0.08)
      .call(() => {
        gfx.removeFromParent();
        gfx.destroy();
      });
  }

  /**
   * 圆形冲击波 — 扩散环
   */
  private renderAttackBlunt(
    x: number, y: number, tl: gsap.core.Timeline,
    scale: number, color?: string | number,
  ): void {
    const gfx = new Graphics();
    const ringColor = color ?? 0xffaa44;

    // 冲击波环
    gfx.circle(0, 0, 10 * scale);
    gfx.stroke({ color: ringColor, width: 4 * scale, alpha: 0.9 });

    // 内部填充
    gfx.circle(0, 0, 8 * scale);
    gfx.fill({ color: ringColor, alpha: 0.3 });

    gfx.position.set(x, y);
    gfx.alpha = 1;
    this.particleContainer!.addChild(gfx);

    tl.to(gfx.scale, { x: 3 * scale, y: 3 * scale, duration: 0.3, ease: 'power2.out' }, 0)
      .to(gfx, { alpha: 0, duration: 0.3, ease: 'power1.in' }, 0)
      .call(() => {
        gfx.removeFromParent();
        gfx.destroy();
      });
  }

  // ─── 魔法特效 ─────────────────────────────────────────────

  /**
   * 火焰 — 红橙色粒子向上扩散
   */
  private renderMagicFire(
    x: number, y: number, tl: gsap.core.Timeline,
    scale: number, color?: string | number,
  ): void {
    const count = 12;
    for (let i = 0; i < count; i++) {
      const particle = this.acquireParticle();
      if (!particle) continue;

      const gfx = particle.gfx;
      gfx.clear();
      const offsetX = (Math.random() - 0.5) * 20 * scale;
      const offsetY = (Math.random() - 0.5) * 10 * scale;
      const size = (3 + Math.random() * 4) * scale;
      const fireColor = color ?? (Math.random() > 0.5 ? 0xff4500 : 0xff8c00);

      gfx.circle(0, 0, size);
      gfx.fill(fireColor);
      gfx.position.set(x + offsetX, y + offsetY);
      gfx.alpha = 0.9;

      tl.to(gfx, {
        y: y - 40 * scale - Math.random() * 30 * scale,
        x: x + offsetX + (Math.random() - 0.5) * 20 * scale,
        alpha: 0,
        duration: 0.4 + Math.random() * 0.3,
        ease: 'power1.out',
        onComplete: () => this.releaseParticle(particle),
      }, Math.random() * 0.15);
    }
  }

  /**
   * 冰霜 — 蓝白色菱形粒子四散
   */
  private renderMagicIce(
    x: number, y: number, tl: gsap.core.Timeline,
    scale: number, color?: string | number,
  ): void {
    const count = 10;
    for (let i = 0; i < count; i++) {
      const particle = this.acquireParticle();
      if (!particle) continue;

      const gfx = particle.gfx;
      gfx.clear();
      const size = (3 + Math.random() * 3) * scale;
      const iceColor = color ?? (Math.random() > 0.5 ? 0x00bfff : 0xe0f0ff);

      // 菱形
      gfx.moveTo(0, -size);
      gfx.lineTo(size * 0.7, 0);
      gfx.lineTo(0, size);
      gfx.lineTo(-size * 0.7, 0);
      gfx.closePath();
      gfx.fill(iceColor);

      const angle = (Math.PI * 2 * i) / count;
      const dist = (30 + Math.random() * 30) * scale;
      gfx.position.set(x, y);
      gfx.alpha = 0.9;
      gfx.rotation = Math.random() * Math.PI;

      tl.to(gfx, {
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist,
        alpha: 0,
        rotation: gfx.rotation + Math.PI * 0.5,
        duration: 0.4 + Math.random() * 0.2,
        ease: 'power2.out',
        onComplete: () => this.releaseParticle(particle),
      }, Math.random() * 0.1);
    }
  }

  /**
   * 闪电 — 黄色锯齿线段闪烁
   */
  private renderMagicLightning(
    x: number, y: number, tl: gsap.core.Timeline,
    scale: number, color?: string | number,
  ): void {
    const boltColor = color ?? 0xffff00;

    // 生成锯齿线段
    const gfx = new Graphics();
    const segments = 6;
    const startX = x - 30 * scale;
    const startY = y - 30 * scale;
    const endX = x + 30 * scale;
    const endY = y + 30 * scale;

    gfx.moveTo(startX, startY);
    for (let i = 1; i < segments; i++) {
      const t = i / segments;
      const px = startX + (endX - startX) * t + (Math.random() - 0.5) * 20 * scale;
      const py = startY + (endY - startY) * t + (Math.random() - 0.5) * 20 * scale;
      gfx.lineTo(px, py);
    }
    gfx.lineTo(endX, endY);
    gfx.stroke({ color: boltColor, width: 3 * scale, alpha: 0.9 });

    // 分支
    const branch = new Graphics();
    branch.moveTo(x, y - 10 * scale);
    branch.lineTo(x + 20 * scale, y + 5 * scale);
    branch.lineTo(x + 15 * scale, y + 20 * scale);
    branch.stroke({ color: boltColor, width: 2 * scale, alpha: 0.7 });

    gfx.alpha = 0;
    branch.alpha = 0;
    this.particleContainer!.addChild(gfx);
    this.particleContainer!.addChild(branch);

    // 闪烁效果
    tl.to(gfx, { alpha: 1, duration: 0.03 }, 0)
      .to(gfx, { alpha: 0.2, duration: 0.03 }, 0.03)
      .to(gfx, { alpha: 1, duration: 0.03 }, 0.06)
      .to(gfx, { alpha: 0, duration: 0.1, ease: 'power1.in' }, 0.09)
      .to(branch, { alpha: 1, duration: 0.03 }, 0.02)
      .to(branch, { alpha: 0, duration: 0.1, ease: 'power1.in' }, 0.08)
      .call(() => {
        gfx.removeFromParent();
        gfx.destroy();
        branch.removeFromParent();
        branch.destroy();
      });
  }

  /**
   * 治疗 — 绿色光环从底部上升
   */
  private renderMagicHeal(
    x: number, y: number, tl: gsap.core.Timeline,
    scale: number, color?: string | number,
  ): void {
    const healColor = color ?? 0x00ff7f;

    // 上升的光环
    for (let i = 0; i < 3; i++) {
      const ring = new Graphics();
      ring.circle(0, 0, 15 * scale);
      ring.stroke({ color: healColor, width: 2 * scale, alpha: 0.7 });
      ring.circle(0, 0, 8 * scale);
      ring.fill({ color: healColor, alpha: 0.2 });
      ring.position.set(x, y + 20 * scale);
      ring.alpha = 0;
      this.particleContainer!.addChild(ring);

      tl.to(ring, { alpha: 0.8, duration: 0.1 }, i * 0.15)
        .to(ring, {
          y: y - 30 * scale,
          alpha: 0,
          duration: 0.5,
          ease: 'power1.out',
        }, i * 0.15)
        .to(ring.scale, { x: 1.5 * scale, y: 1.5 * scale, duration: 0.5 }, i * 0.15)
        .call(() => {
          ring.removeFromParent();
          ring.destroy();
        });
    }
  }

  // ─── 增益/减益特效 ─────────────────────────────────────────

  /**
   * 护盾 — 蓝色半透明圆形护盾
   */
  private renderBuffShield(
    x: number, y: number, tl: gsap.core.Timeline,
    scale: number, color?: string | number,
  ): void {
    const shieldColor = color ?? 0x4488ff;
    const gfx = new Graphics();

    // 外圈
    gfx.circle(0, 0, 30 * scale);
    gfx.fill({ color: shieldColor, alpha: 0.2 });
    gfx.circle(0, 0, 30 * scale);
    gfx.stroke({ color: shieldColor, width: 3 * scale, alpha: 0.7 });

    // 内部六边形纹理
    const hexRadius = 15 * scale;
    gfx.moveTo(0, -hexRadius);
    for (let i = 1; i <= 6; i++) {
      const angle = (Math.PI * 2 * i) / 6 - Math.PI / 2;
      gfx.lineTo(Math.cos(angle) * hexRadius, Math.sin(angle) * hexRadius);
    }
    gfx.closePath();
    gfx.stroke({ color: shieldColor, width: 1.5 * scale, alpha: 0.4 });

    gfx.position.set(x, y);
    gfx.alpha = 0;
    gfx.scale.set(0.5);
    this.particleContainer!.addChild(gfx);

    tl.to(gfx, { alpha: 1, duration: 0.2, ease: 'power1.out' }, 0)
      .to(gfx.scale, { x: scale, y: scale, duration: 0.3, ease: 'back.out(1.5)' }, 0)
      .to(gfx, { alpha: 0, duration: 0.3, ease: 'power1.in' }, 0.5)
      .call(() => {
        gfx.removeFromParent();
        gfx.destroy();
      });
  }

  /**
   * 加速 — 绿色条纹向后流动
   */
  private renderBuffSpeed(
    x: number, y: number, tl: gsap.core.Timeline,
    scale: number, color?: string | number,
  ): void {
    const speedColor = color ?? 0x44ff88;
    const stripeCount = 5;

    for (let i = 0; i < stripeCount; i++) {
      const stripe = new Graphics();
      stripe.rect(-2 * scale, -15 * scale, 4 * scale, 30 * scale);
      stripe.fill({ color: speedColor, alpha: 0.6 });
      stripe.position.set(x + 20 * scale + i * 8 * scale, y + (i - 2) * 6 * scale);
      stripe.alpha = 0;
      this.particleContainer!.addChild(stripe);

      tl.to(stripe, { alpha: 0.8, duration: 0.05 }, i * 0.04)
        .to(stripe, {
          x: x - 30 * scale,
          alpha: 0,
          duration: 0.3,
          ease: 'power1.in',
        }, i * 0.04)
        .call(() => {
          stripe.removeFromParent();
          stripe.destroy();
        });
    }
  }

  /**
   * 中毒 — 紫色气泡上升
   */
  private renderDebuffPoison(
    x: number, y: number, tl: gsap.core.Timeline,
    scale: number, color?: string | number,
  ): void {
    const poisonColor = color ?? 0x9933cc;
    const bubbleCount = 6;

    for (let i = 0; i < bubbleCount; i++) {
      const bubble = new Graphics();
      const size = (3 + Math.random() * 4) * scale;
      bubble.circle(0, 0, size);
      bubble.fill({ color: poisonColor, alpha: 0.5 });
      bubble.circle(-size * 0.3, -size * 0.3, size * 0.2);
      bubble.fill({ color: 0xffffff, alpha: 0.4 });

      const offsetX = (Math.random() - 0.5) * 30 * scale;
      bubble.position.set(x + offsetX, y);
      bubble.alpha = 0;
      this.particleContainer!.addChild(bubble);

      tl.to(bubble, { alpha: 0.7, duration: 0.1 }, i * 0.08)
        .to(bubble, {
          y: y - 40 * scale - Math.random() * 20 * scale,
          x: x + offsetX + (Math.random() - 0.5) * 10 * scale,
          alpha: 0,
          duration: 0.5 + Math.random() * 0.2,
          ease: 'power1.out',
        }, i * 0.08)
        .call(() => {
          bubble.removeFromParent();
          bubble.destroy();
        });
    }
  }

  /**
   * 减速 — 灰色锁链环绕
   */
  private renderDebuffSlow(
    x: number, y: number, tl: gsap.core.Timeline,
    scale: number, color?: string | number,
  ): void {
    const chainColor = color ?? 0x888899;
    const gfx = new Graphics();

    // 绘制锁链环
    const linkCount = 6;
    const chainRadius = 25 * scale;
    for (let i = 0; i < linkCount; i++) {
      const angle = (Math.PI * 2 * i) / linkCount;
      const cx = Math.cos(angle) * chainRadius;
      const cy = Math.sin(angle) * chainRadius;
      gfx.ellipse(cx, cy, 6 * scale, 3 * scale);
      gfx.stroke({ color: chainColor, width: 2 * scale, alpha: 0.8 });
      gfx.rotation = angle;
    }

    gfx.position.set(x, y);
    gfx.alpha = 0;
    this.particleContainer!.addChild(gfx);

    tl.to(gfx, { alpha: 1, duration: 0.2, ease: 'power1.out' }, 0)
      .to(gfx, {
        rotation: Math.PI * 2,
        duration: 0.6,
        ease: 'none',
      }, 0)
      .to(gfx, { alpha: 0, duration: 0.2, ease: 'power1.in' }, 0.4)
      .call(() => {
        gfx.removeFromParent();
        gfx.destroy();
      });
  }

  // ─── 特殊特效 ─────────────────────────────────────────────

  /**
   * 暴击 — 大号伤害数字 + 白色闪光
   */
  private renderCriticalHit(
    x: number, y: number, tl: gsap.core.Timeline,
    scale: number, color?: string | number,
  ): void {
    // 白色闪光
    const flash = new Graphics();
    flash.rect(-40 * scale, -40 * scale, 80 * scale, 80 * scale);
    flash.fill({ color: color ?? 0xffffff, alpha: 0.6 });
    flash.position.set(x, y);
    flash.alpha = 0;
    this.particleContainer!.addChild(flash);

    tl.to(flash, { alpha: 0.8, duration: 0.05 }, 0)
      .to(flash, { alpha: 0, duration: 0.15, ease: 'power1.in' }, 0.05)
      .call(() => {
        flash.removeFromParent();
        flash.destroy();
      });

    // 冲击线条
    for (let i = 0; i < 6; i++) {
      const line = new Graphics();
      const angle = (Math.PI * 2 * i) / 6;
      line.moveTo(0, 0);
      line.lineTo(Math.cos(angle) * 35 * scale, Math.sin(angle) * 35 * scale);
      line.stroke({ color: 0xffdd44, width: 2 * scale, alpha: 0.8 });
      line.position.set(x, y);
      line.alpha = 0;
      line.scale.set(0.3);
      this.particleContainer!.addChild(line);

      tl.to(line, { alpha: 1, duration: 0.05 }, 0.02)
        .to(line.scale, { x: scale, y: scale, duration: 0.1, ease: 'power2.out' }, 0.02)
        .to(line, { alpha: 0, duration: 0.15 }, 0.1)
        .call(() => {
          line.removeFromParent();
          line.destroy();
        });
    }
  }

  /**
   * 升级 — 金色光柱从底部升起
   */
  private renderLevelUp(
    x: number, y: number, tl: gsap.core.Timeline,
    scale: number, color?: string | number,
  ): void {
    const goldColor = color ?? 0xffd700;

    // 光柱
    const pillar = new Graphics();
    pillar.rect(-15 * scale, -80 * scale, 30 * scale, 80 * scale);
    pillar.fill({ color: goldColor, alpha: 0.4 });
    // 光柱边缘
    pillar.rect(-15 * scale, -80 * scale, 5 * scale, 80 * scale);
    pillar.fill({ color: goldColor, alpha: 0.6 });
    pillar.rect(10 * scale, -80 * scale, 5 * scale, 80 * scale);
    pillar.fill({ color: goldColor, alpha: 0.6 });
    pillar.position.set(x, y + 40 * scale);
    pillar.alpha = 0;
    this.particleContainer!.addChild(pillar);

    tl.to(pillar, { alpha: 1, duration: 0.2, ease: 'power1.out' }, 0)
      .to(pillar, { y: y - 20 * scale, duration: 0.5, ease: 'power2.out' }, 0)
      .to(pillar, { alpha: 0, duration: 0.3, ease: 'power1.in' }, 0.4)
      .call(() => {
        pillar.removeFromParent();
        pillar.destroy();
      });

    // 金色粒子
    for (let i = 0; i < 8; i++) {
      const spark = this.acquireParticle();
      if (!spark) continue;

      const gfx = spark.gfx;
      gfx.clear();
      const size = (2 + Math.random() * 2) * scale;
      gfx.circle(0, 0, size);
      gfx.fill(goldColor);

      const offsetX = (Math.random() - 0.5) * 30 * scale;
      gfx.position.set(x + offsetX, y);
      gfx.alpha = 0;

      tl.to(gfx, { alpha: 0.9, duration: 0.1 }, i * 0.05)
        .to(gfx, {
          y: y - 50 * scale - Math.random() * 30 * scale,
          alpha: 0,
          duration: 0.5 + Math.random() * 0.2,
          ease: 'power1.out',
          onComplete: () => this.releaseParticle(spark),
        }, i * 0.05);
    }
  }

  /**
   * 死亡 — 目标淡出 + 灰色粒子下沉
   */
  private renderDeath(
    x: number, y: number, tl: gsap.core.Timeline,
    scale: number, _color?: string | number,
  ): void {
    // 灰色粒子下沉
    const count = 10;
    for (let i = 0; i < count; i++) {
      const particle = this.acquireParticle();
      if (!particle) continue;

      const gfx = particle.gfx;
      gfx.clear();
      const size = (2 + Math.random() * 3) * scale;
      const gray = 0.5 + Math.random() * 0.3;
      const grayColor = Math.round(gray * 255) * 0x010101;

      gfx.circle(0, 0, size);
      gfx.fill(grayColor);

      const offsetX = (Math.random() - 0.5) * 30 * scale;
      const offsetY = (Math.random() - 0.5) * 20 * scale;
      gfx.position.set(x + offsetX, y + offsetY);
      gfx.alpha = 0.7;

      tl.to(gfx, {
        y: y + 30 * scale + Math.random() * 20 * scale,
        alpha: 0,
        duration: 0.6 + Math.random() * 0.3,
        ease: 'power1.in',
        onComplete: () => this.releaseParticle(particle),
      }, Math.random() * 0.2);
    }
  }

  /**
   * 爆炸 — 橙红色圆形扩散 + 碎片
   */
  private renderExplosion(
    x: number, y: number, tl: gsap.core.Timeline,
    scale: number, color?: string | number,
  ): void {
    const explosionColor = color ?? 0xff4500;

    // 扩散圆
    const circle = new Graphics();
    circle.circle(0, 0, 10 * scale);
    circle.fill({ color: explosionColor, alpha: 0.6 });
    circle.circle(0, 0, 10 * scale);
    circle.stroke({ color: 0xff6600, width: 3 * scale, alpha: 0.8 });
    circle.position.set(x, y);
    circle.alpha = 1;
    this.particleContainer!.addChild(circle);

    tl.to(circle.scale, { x: 3 * scale, y: 3 * scale, duration: 0.3, ease: 'power2.out' }, 0)
      .to(circle, { alpha: 0, duration: 0.3, ease: 'power1.in' }, 0)
      .call(() => {
        circle.removeFromParent();
        circle.destroy();
      });

    // 碎片
    const fragmentCount = 8;
    for (let i = 0; i < fragmentCount; i++) {
      const frag = new Graphics();
      const fragSize = (3 + Math.random() * 4) * scale;
      frag.rect(-fragSize / 2, -fragSize / 2, fragSize, fragSize * 0.6);
      frag.fill(Math.random() > 0.5 ? explosionColor : 0xff8800);

      const angle = (Math.PI * 2 * i) / fragmentCount + (Math.random() - 0.5) * 0.3;
      const dist = (40 + Math.random() * 30) * scale;
      frag.position.set(x, y);
      frag.alpha = 1;
      frag.rotation = Math.random() * Math.PI;
      this.particleContainer!.addChild(frag);

      tl.to(frag, {
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist,
        alpha: 0,
        rotation: frag.rotation + Math.PI,
        duration: 0.4 + Math.random() * 0.2,
        ease: 'power2.out',
      }, 0);

      tl.call(() => {
        frag.removeFromParent();
        frag.destroy();
      }, undefined, 0.6);
    }
  }

  // ─── 特效序列与组合 ────────────────────────────────────────

  /**
   * 按序列播放多个特效
   *
   * 特效按顺序依次播放，前一个完成后才开始下一个。
   *
   * @param effects - 特效配置数组
   * @returns 包含所有特效的 Timeline
   */
  playEffectSequence(effects: EffectConfig[]): gsap.core.Timeline | null {
    if (!this.particleContainer || effects.length === 0) return null;

    const masterTl = gsap.timeline({
      onComplete: () => this.removeTimeline(masterTl),
    });

    let offset = 0;
    for (const config of effects) {
      const effectTl = this.createEffect({
        ...config,
        onComplete: undefined, // 由 masterTl 管理
      });
      if (effectTl) {
        masterTl.add(effectTl, offset);
        offset += (config.duration ?? 0.5) + 0.1; // 间隔 0.1s
      }
    }

    this.addTimeline(masterTl);
    return masterTl;
  }

  /**
   * 同时播放多个特效
   *
   * 所有特效同时开始播放。
   *
   * @param effects - 特效配置数组
   * @returns 包含所有特效的 Timeline
   */
  playEffectCombo(effects: EffectConfig[]): gsap.core.Timeline | null {
    if (!this.particleContainer || effects.length === 0) return null;

    const masterTl = gsap.timeline({
      onComplete: () => this.removeTimeline(masterTl),
    });

    for (const config of effects) {
      const effectTl = this.createEffect({
        ...config,
        onComplete: undefined,
      });
      if (effectTl) {
        masterTl.add(effectTl, 0); // 所有特效从时间 0 开始
      }
    }

    this.addTimeline(masterTl);
    return masterTl;
  }

  // ═══════════════════════════════════════════════════════════
  // 伤害飘字
  // ═══════════════════════════════════════════════════════════

  /**
   * 播放伤害飘字动画
   *
   * @param parent - 父容器（飘字添加到此容器）
   * @param data - 飘字数据
   */
  playDamageNumber(parent: Container, data: DamageNumberData): void {
    // 1. 创建 Text 对象
    const colorMap: Record<DamageNumberData['type'], string> = {
      normal: '#ffffff',
      critical: '#ffd700',
      heal: '#4ecdc4',
      miss: '#888888',
    };
    const text = new Text({
      text: data.type === 'miss' ? 'MISS' : `${data.value}`,
      style: new TextStyle({
        fontSize: data.type === 'critical' ? 28 : 20,
        fill: data.color ?? colorMap[data.type],
        fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
        fontWeight: 'bold',
        stroke: { color: '#000000', width: 2 },
      }),
    });
    text.anchor.set(0.5);
    text.position.set(data.position.x, data.position.y);
    parent.addChild(text);

    // 2. GSAP 动画：缩放弹跳 → 上升 + 淡出
    const tl = gsap.timeline({
      onComplete: () => {
        parent.removeChild(text);
        text.destroy();
        this.removeTimeline(tl);
      },
    });

    tl.from(text.scale, { x: 0.5, y: 0.5, duration: 0.1, ease: 'back.out(2)' })
      .to(text, { y: text.y - 60, duration: 0.8, ease: 'power2.out' }, 0)
      .to(text, { alpha: 0, duration: 0.3, ease: 'power1.in' }, 0.5);

    this.addTimeline(tl);
  }

  // ═══════════════════════════════════════════════════════════
  // 场景过渡动画
  // ═══════════════════════════════════════════════════════════

  /**
   * 播放场景过渡动画
   *
   * @param container - 场景容器
   * @param transition - 过渡类型
   * @param duration - 持续时间（毫秒）
   * @param direction - 'in'（进入）或 'out'（退出）
   */
  async playSceneTransition(
    container: Container,
    transition: SceneTransition,
    duration: number,
    direction: 'in' | 'out',
  ): Promise<void> {
    const dur = duration / 1000; // 转为秒

    return new Promise<void>((resolve) => {
      const tl = gsap.timeline({
        onComplete: () => {
          this.removeTimeline(tl);
          resolve();
        },
      });

      switch (transition) {
        case 'fade':
          if (direction === 'in') {
            container.alpha = 0;
            tl.to(container, { alpha: 1, duration: dur, ease: 'power1.out' });
          } else {
            tl.to(container, { alpha: 0, duration: dur, ease: 'power1.in' });
          }
          break;

        case 'slide-left':
          if (direction === 'in') {
            container.x = (container.parent?.width ?? 1920);
            tl.to(container, { x: 0, duration: dur, ease: 'power2.out' });
          } else {
            tl.to(container, { x: -(container.parent?.width ?? 1920), duration: dur, ease: 'power2.in' });
          }
          break;

        case 'slide-right':
          if (direction === 'in') {
            container.x = -(container.parent?.width ?? 1920);
            tl.to(container, { x: 0, duration: dur, ease: 'power2.out' });
          } else {
            tl.to(container, { x: (container.parent?.width ?? 1920), duration: dur, ease: 'power2.in' });
          }
          break;

        case 'zoom-in':
          if (direction === 'in') {
            container.scale.set(0);
            container.alpha = 0;
            tl.to(container.scale, { x: 1, y: 1, duration: dur, ease: 'back.out(1.7)' })
              .to(container, { alpha: 1, duration: dur * 0.5 }, 0);
          } else {
            tl.to(container.scale, { x: 0, y: 0, duration: dur, ease: 'power2.in' })
              .to(container, { alpha: 0, duration: dur * 0.5 }, 0);
          }
          break;

        case 'zoom-out':
          if (direction === 'in') {
            container.scale.set(2);
            container.alpha = 0;
            tl.to(container.scale, { x: 1, y: 1, duration: dur, ease: 'power2.out' })
              .to(container, { alpha: 1, duration: dur * 0.5 }, 0);
          } else {
            tl.to(container.scale, { x: 2, y: 2, duration: dur, ease: 'power2.in' })
              .to(container, { alpha: 0, duration: dur * 0.5 }, 0);
          }
          break;

        case 'none':
        default:
          resolve();
          return;
      }

      this.addTimeline(tl);
    });
  }

  // ═══════════════════════════════════════════════════════════
  // UI 过渡动画
  // ═══════════════════════════════════════════════════════════

  /**
   * 播放 UI 过渡动画
   *
   * @param target - 目标容器
   * @param type - 过渡类型
   * @param duration - 持续时间（毫秒）
   */
  async playUITransition(
    target: Container,
    type: 'fadeIn' | 'fadeOut' | 'slideUp' | 'slideDown' | 'scaleIn' | 'scaleOut',
    duration: number,
  ): Promise<void> {
    const dur = duration / 1000;

    return new Promise<void>((resolve) => {
      const tl = gsap.timeline({
        onComplete: () => {
          this.removeTimeline(tl);
          resolve();
        },
      });

      switch (type) {
        case 'fadeIn':
          target.alpha = 0;
          tl.to(target, { alpha: 1, duration: dur, ease: 'power1.out' });
          break;
        case 'fadeOut':
          tl.to(target, { alpha: 0, duration: dur, ease: 'power1.in' });
          break;
        case 'slideUp':
          target.y += 50;
          tl.to(target, { y: target.y - 50, duration: dur, ease: 'power2.out' });
          break;
        case 'slideDown':
          tl.to(target, { y: target.y + 50, duration: dur, ease: 'power2.in' });
          break;
        case 'scaleIn':
          target.scale.set(0);
          tl.to(target.scale, { x: 1, y: 1, duration: dur, ease: 'back.out(1.7)' });
          break;
        case 'scaleOut':
          tl.to(target.scale, { x: 0, y: 0, duration: dur, ease: 'power2.in' });
          break;
      }

      this.addTimeline(tl);
    });
  }

  // ═══════════════════════════════════════════════════════════
  // 管理
  // ═══════════════════════════════════════════════════════════

  /**
   * 停止目标上所有 GSAP 动画
   */
  killAnimations(target: Container): void {
    gsap.killTweensOf(target);
    gsap.killTweensOf(target.scale);
    gsap.killTweensOf(target.position);
  }

  /**
   * 销毁所有动画
   */
  destroy(): void {
    for (const tl of this.activeTimelines) {
      tl.kill();
    }
    this.activeTimelines = [];

    // 清理粒子池
    for (const particle of this.particlePool) {
      particle.gfx.destroy();
    }
    this.particlePool = [];

    // 清理闪光覆盖层
    if (this.flashOverlay) {
      this.flashOverlay.destroy();
      this.flashOverlay = null;
    }

    gsap.killTweensOf('*');
  }

  // ═══════════════════════════════════════════════════════════
  // 内部方法
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
}
