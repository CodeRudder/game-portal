/**
 * 伤害数字渲染器
 *
 * 负责渲染战斗中的伤害/治疗数字，支持飘字动画和颜色区分。
 * 后续版本将实现完整的伤害数字动画系统。
 *
 * 职责：
 *   - 渲染伤害/治疗/暴击数字
 *   - 飘字上升动画（带缓动）
 *   - 颜色区分（伤害红色、治疗绿色、暴击金色等）
 *   - 数字池管理，避免频繁创建/销毁
 *
 * @module rendering/battle/DamageNumberRenderer
 */

import { Container } from 'pixi.js';
import type { IRenderer } from '../adapters/RenderStateBridge';

// ─────────────────────────────────────────────
// 类型定义
// ─────────────────────────────────────────────

/** 伤害数字类型 */
export enum DamageNumberType {
  /** 普通伤害 */
  Damage = 'damage',
  /** 暴击伤害 */
  CriticalDamage = 'critical_damage',
  /** 治疗 */
  Heal = 'heal',
  /** 护盾吸收 */
  Shield = 'shield',
  /** 闪避 */
  Miss = 'miss',
}

/** 伤害数字参数 */
export interface IDamageNumberParams {
  /** 数字类型 */
  type: DamageNumberType;
  /** 显示数值 */
  value: number;
  /** 起始 X 坐标 */
  x: number;
  /** 起始 Y 坐标 */
  y: number;
  /** 飘字持续时间（秒），默认 1.0 */
  duration?: number;
  /** 上升距离（像素），默认 60 */
  riseDistance?: number;
}

/** 伤害数字实例（内部状态） */
interface DamageNumberInstance {
  id: number;
  params: IDamageNumberParams;
  elapsed: number;
  done: boolean;
}

// ─────────────────────────────────────────────
// DamageNumberRenderer 类
// ─────────────────────────────────────────────

/**
 * 伤害数字渲染器
 *
 * 管理伤害数字的创建、动画和销毁。
 * 后续版本将实现基于 PIXI.Text 或 BitmapText 的飘字效果。
 *
 * @example
 * ```ts
 * const dmgRenderer = new DamageNumberRenderer();
 * dmgRenderer.init(stage);
 * dmgRenderer.show({
 *   type: DamageNumberType.CriticalDamage,
 *   value: 9999,
 *   x: 200, y: 300,
 * });
 * ```
 */
export class DamageNumberRenderer implements IRenderer {
  private readonly root = new Container();
  private _visible = true;
  private _initialized = false;

  private readonly activeNumbers: DamageNumberInstance[] = [];
  private nextId = 0;

  // ─── IRenderer 接口实现 ─────────────────────

  /**
   * 初始化伤害数字渲染器
   *
   * @param container - 父级 PIXI.Container
   */
  init(container: Container): void {
    if (this._initialized) return;

    container.addChild(this.root);
    this._initialized = true;

    // stub: 初始化文字样式和对象池
  }

  /**
   * 每帧更新
   *
   * 更新所有飘字的位置和透明度。
   *
   * @param dt - 帧间隔时间（秒）
   */
  update(dt: number): void {
    if (!this._initialized) return;

    for (let i = this.activeNumbers.length - 1; i >= 0; i--) {
      const num = this.activeNumbers[i];
      num.elapsed += dt;

      const duration = num.params.duration ?? 1.0;
      const progress = Math.min(num.elapsed / duration, 1);

      if (progress >= 1) {
        num.done = true;
        this.activeNumbers.splice(i, 1);
        // stub: 回收文字对象
      } else {
        // stub: 更新位置（上升）和透明度（淡出）
      }
    }
  }

  /**
   * 销毁伤害数字渲染器
   */
  destroy(): void {
    this.activeNumbers.length = 0;
    this.root.destroy({ children: true });
    this._initialized = false;
  }

  // ─── 公共方法 ───────────────────────────────

  /**
   * 显示一个伤害数字
   *
   * @param params - 伤害数字参数
   */
  show(params: IDamageNumberParams): void {
    const instance: DamageNumberInstance = {
      id: this.nextId++,
      params,
      elapsed: 0,
      done: false,
    };
    this.activeNumbers.push(instance);

    // stub: 创建文字对象并设置初始状态
  }

  /**
   * 清除所有飘字
   */
  clearAll(): void {
    this.activeNumbers.length = 0;
    // stub: 回收所有文字对象
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
