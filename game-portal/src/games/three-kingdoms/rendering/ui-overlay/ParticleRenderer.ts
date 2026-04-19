/**
 * 粒子渲染器
 *
 * 负责渲染游戏场景中的粒子效果，如烟雾、火焰、尘埃、天气等。
 * 后续版本将实现完整的粒子系统。
 *
 * 职责：
 *   - 管理粒子发射器和粒子池
 *   - 粒子生命周期管理（生成→更新→死亡）
 *   - 粒子属性更新（位置、速度、大小、颜色、透明度）
 *   - 支持多种粒子预设（烟雾、火焰、雪花等）
 *
 * @module rendering/ui-overlay/ParticleRenderer
 */

import { Container } from 'pixi.js';
import type { IRenderer } from '../adapters/RenderStateBridge';

// ─────────────────────────────────────────────
// 类型定义
// ─────────────────────────────────────────────

/** 粒子预设类型 */
export enum ParticlePreset {
  /** 烟雾 */
  Smoke = 'smoke',
  /** 火焰 */
  Fire = 'fire',
  /** 尘埃 */
  Dust = 'dust',
  /** 雪花 */
  Snow = 'snow',
  /** 雨滴 */
  Rain = 'rain',
  /** 闪光 */
  Sparkle = 'sparkle',
}

/** 粒子发射器配置 */
export interface IParticleEmitterConfig {
  /** 粒子预设 */
  preset: ParticlePreset;
  /** 发射器 X 坐标 */
  x: number;
  /** 发射器 Y 坐标 */
  y: number;
  /** 发射速率（个/秒） */
  rate: number;
  /** 粒子生命周期（秒） */
  lifetime: number;
  /** 初始速度范围 */
  speed?: { min: number; max: number };
  /** 初始大小范围 */
  size?: { min: number; max: number };
  /** 发射角度范围（弧度） */
  angle?: { min: number; max: number };
}

/** 粒子发射器实例（内部状态） */
interface EmitterInstance {
  id: number;
  config: IParticleEmitterConfig;
  elapsed: number;
  active: boolean;
}

// ─────────────────────────────────────────────
// ParticleRenderer 类
// ─────────────────────────────────────────────

/**
 * 粒子渲染器
 *
 * 管理粒子发射器和粒子的生命周期。
 * 后续版本将实现基于 PIXI.ParticleContainer 或自定义粒子系统。
 *
 * @example
 * ```ts
 * const particleRenderer = new ParticleRenderer();
 * particleRenderer.init(stage);
 * particleRenderer.emit({
 *   preset: ParticlePreset.Fire,
 *   x: 100, y: 200,
 *   rate: 30,
 *   lifetime: 2,
 * });
 * ```
 */
export class ParticleRenderer implements IRenderer {
  private readonly root = new Container();
  private _visible = true;
  private _initialized = false;

  private readonly emitters: EmitterInstance[] = [];
  private nextId = 0;

  // TODO: 粒子池和粒子数据数组
  // private particles: Particle[] = [];
  // private particleContainer: ParticleContainer;

  // ─── IRenderer 接口实现 ─────────────────────

  /**
   * 初始化粒子渲染器
   *
   * @param container - 父级 PIXI.Container
   */
  init(container: Container): void {
    if (this._initialized) return;

    container.addChild(this.root);
    this._initialized = true;

    // TODO: 初始化 ParticleContainer 和粒子池
  }

  /**
   * 每帧更新
   *
   * 更新所有发射器和活跃粒子的状态。
   *
   * @param dt - 帧间隔时间（秒）
   */
  update(dt: number): void {
    if (!this._initialized) return;

    for (const emitter of this.emitters) {
      if (!emitter.active) continue;

      emitter.elapsed += dt;

      // TODO: 根据发射速率生成新粒子
      // TODO: 更新所有活跃粒子的位置、速度、大小、颜色
      // TODO: 移除死亡粒子回收到粒子池
    }

    void dt; // 占位
  }

  /**
   * 销毁粒子渲染器
   */
  destroy(): void {
    this.emitters.length = 0;
    // TODO: 清理粒子池
    this.root.destroy({ children: true });
    this._initialized = false;
  }

  // ─── 公共方法 ───────────────────────────────

  /**
   * 创建粒子发射器
   *
   * @param config - 发射器配置
   * @returns 发射器 ID
   */
  emit(config: IParticleEmitterConfig): number {
    const id = this.nextId++;
    this.emitters.push({
      id,
      config,
      elapsed: 0,
      active: true,
    });
    return id;
  }

  /**
   * 停止指定发射器
   *
   * @param id - 发射器 ID
   */
  stopEmitter(id: number): void {
    const emitter = this.emitters.find((e) => e.id === id);
    if (emitter) {
      emitter.active = false;
    }
  }

  /**
   * 停止所有发射器
   */
  stopAll(): void {
    for (const emitter of this.emitters) {
      emitter.active = false;
    }
  }

  // ─── 访问器 ─────────────────────────────────

  get visible(): boolean {
    return this._visible;
  }

  set visible(value: boolean) {
    this._visible = value;
    this.root.visible = value;
  }
}
