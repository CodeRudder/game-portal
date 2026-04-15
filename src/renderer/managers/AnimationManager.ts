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

    // TODO: 根据 effectType 添加不同特效
    // 'slash' → 剑气
    // 'fire' → 火焰
    // 'ice' → 冰霜
    // 等

    this.addTimeline(tl);
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
