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

import { Container, Text, TextStyle } from 'pixi.js';
import gsap from 'gsap';
import type { SceneTransition, DamageNumberData } from '../types';
import type { IAnimationManager } from '../types';

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
