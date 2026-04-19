/**
 * 武将立绘渲染器
 *
 * 负责渲染武将立绘（肖像），支持表情切换和动画效果。
 * 后续版本将实现完整的武将立绘渲染逻辑。
 *
 * 职责：
 *   - 加载和渲染武将立绘纹理
 *   - 支持表情状态切换（默认、攻击、受伤、死亡等）
 *   - 立绘入场/退场动画
 *   - 立绘资源管理和释放
 *
 * @module rendering/general/GeneralPortraitRenderer
 */

import { Container } from 'pixi.js';
import type { IRenderer } from '../adapters/RenderStateBridge';
import type { TextureManager } from '../core/TextureManager';

// ─────────────────────────────────────────────
// 类型定义
// ─────────────────────────────────────────────

/** 武将表情状态 */
export enum PortraitExpression {
  /** 默认（待机） */
  Default = 'default',
  /** 攻击 */
  Attack = 'attack',
  /** 受伤 */
  Hurt = 'hurt',
  /** 死亡 */
  Death = 'death',
  /** 胜利 */
  Victory = 'victory',
}

/** 武将立绘渲染数据 */
export interface IGeneralPortraitData {
  /** 武将 ID */
  generalId: string;
  /** 武将名称 */
  name: string;
  /** 当前表情 */
  expression: PortraitExpression;
  /** 立绘位置 X（像素） */
  x: number;
  /** 立绘位置 Y（像素） */
  y: number;
  /** 立绘缩放 */
  scale?: number;
}

/** 立绘动画配置 */
export interface IPortraitAnimationConfig {
  /** 入场动画时长（秒） */
  enterDuration: number;
  /** 退场动画时长（秒） */
  exitDuration: number;
  /** 是否启用呼吸动画 */
  breathing: boolean;
}

// ─────────────────────────────────────────────
// GeneralPortraitRenderer 类
// ─────────────────────────────────────────────

/**
 * 武将立绘渲染器
 *
 * 管理武将立绘的加载、显示和动画。
 * 后续版本将实现基于 gsap 的动画效果。
 *
 * @example
 * ```ts
 * const portraitRenderer = new GeneralPortraitRenderer(textureManager);
 * portraitRenderer.init(stage);
 * portraitRenderer.showPortrait({
 *   generalId: 'guanyu',
 *   name: '关羽',
 *   expression: PortraitExpression.Default,
 *   x: 100, y: 200,
 * });
 * ```
 */
export class GeneralPortraitRenderer implements IRenderer {
  private readonly root = new Container();
  private readonly textureManager: TextureManager;
  private _visible = true;
  private _initialized = false;

  // TODO: 当前显示的立绘 Sprite 和动画状态
  // private activePortraits = new Map<string, Sprite>();
  // private animationConfig: IPortraitAnimationConfig;

  constructor(textureManager: TextureManager) {
    this.textureManager = textureManager;
  }

  // ─── IRenderer 接口实现 ─────────────────────

  /**
   * 初始化武将立绘渲染器
   *
   * @param container - 父级 PIXI.Container
   */
  init(container: Container): void {
    if (this._initialized) return;

    container.addChild(this.root);
    this._initialized = true;

    // TODO: 初始化动画配置
  }

  /**
   * 每帧更新
   *
   * @param dt - 帧间隔时间（秒）
   */
  update(dt: number): void {
    if (!this._initialized) return;

    // TODO: 更新立绘动画（呼吸效果、表情过渡等）
    void dt;
  }

  /**
   * 销毁武将立绘渲染器
   */
  destroy(): void {
    // TODO: 清理所有立绘 Sprite
    this.root.destroy({ children: true });
    this._initialized = false;
  }

  // ─── 公共方法 ───────────────────────────────

  /**
   * 显示武将立绘
   *
   * 加载对应武将和表情的立绘纹理并显示。
   *
   * @param _data - 武将立绘数据
   */
  showPortrait(_data: IGeneralPortraitData): void {
    // TODO: 加载纹理、创建 Sprite、播放入场动画
  }

  /**
   * 隐藏武将立绘
   *
   * @param _generalId - 武将 ID
   */
  hidePortrait(_generalId: string): void {
    // TODO: 播放退场动画并移除 Sprite
  }

  /**
   * 切换武将表情
   *
   * @param _generalId - 武将 ID
   * @param _expression - 新的表情状态
   */
  setExpression(_generalId: string, _expression: PortraitExpression): void {
    // TODO: 切换立绘纹理
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
