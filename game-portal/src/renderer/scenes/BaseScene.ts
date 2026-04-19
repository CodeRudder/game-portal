/**
 * renderer/scenes/BaseScene.ts — 场景基类
 *
 * 所有场景的公共基类，定义场景生命周期和通用功能。
 * 子类通过 override 实现具体的 enter/exit/update/render 逻辑。
 *
 * @module renderer/scenes/BaseScene
 */

import { Container } from 'pixi.js';
import type { SceneType, IScene } from '../types';
import type { AssetManager } from '../managers/AssetManager';
import type { AnimationManager } from '../managers/AnimationManager';

// ═══════════════════════════════════════════════════════════════
// 场景事件桥接回调类型
// ═══════════════════════════════════════════════════════════════

/**
 * 场景事件桥接函数
 *
 * 场景通过此回调将用户交互事件上报到 GameRenderer 事件总线，
 * 再由 GameRenderer 转发给 React 层。
 *
 * 类型与 RendererEventMap 对应。
 */
export type SceneEventBridge = <K extends keyof import('../types').RendererEventMap>(
  event: K,
  ...args: import('../types').RendererEventMap[K]
) => void;

// ═══════════════════════════════════════════════════════════════
// BaseScene
// ═══════════════════════════════════════════════════════════════

/**
 * 场景基类
 *
 * 提供场景生命周期骨架：
 * - enter() / exit() — 进出场（含资源准备/清理）
 * - update() — 每帧更新
 * - setData() — 接收渲染数据
 * - destroy() — 销毁
 *
 * 子类必须实现：
 * - onEnter() — 自定义进场逻辑
 * - onExit() — 自定义退场逻辑
 * - onUpdate() — 自定义帧更新
 * - onSetData() — 自定义数据接收
 *
 * 子类可选 override：
 * - onCreate() — 首次创建时调用（构建 PixiJS 对象树）
 * - onDestroy() — 自定义销毁逻辑
 */
export abstract class BaseScene implements IScene {
  // ─── 元数据 ───────────────────────────────────────────────

  /** 场景类型标识 */
  abstract readonly type: SceneType;

  // ─── PixiJS ───────────────────────────────────────────────

  /** 场景根容器 */
  protected container: Container;

  // ─── 依赖 ─────────────────────────────────────────────────

  /** 资源管理器 */
  protected readonly assetManager: AssetManager;
  /** 动画管理器 */
  protected readonly animationManager: AnimationManager;
  /** 事件桥接（场景 → 渲染器 → React） */
  protected readonly bridgeEvent: SceneEventBridge;

  // ─── 状态 ─────────────────────────────────────────────────

  /** 是否已创建（首次 enter 时创建） */
  private created: boolean = false;
  /** 是否已激活 */
  private active: boolean = false;

  // ═══════════════════════════════════════════════════════════
  // 构造函数
  // ═══════════════════════════════════════════════════════════

  constructor(
    assetManager: AssetManager,
    animationManager: AnimationManager,
    bridgeEvent: SceneEventBridge,
  ) {
    this.assetManager = assetManager;
    this.animationManager = animationManager;
    this.bridgeEvent = bridgeEvent;

    // 子类在 super() 之前已设置 type，但 TS 无法推断；
    // 使用运行时 fallback 保证 label 有值
    const sceneLabel = (this as unknown as { type: string }).type ?? 'unknown';
    this.container = new Container({
      label: `scene-${sceneLabel}`,
      visible: false,
    });
  }

  // ═══════════════════════════════════════════════════════════
  // 生命周期（模板方法模式）
  // ═══════════════════════════════════════════════════════════

  /**
   * 进入场景
   *
   * 模板方法：首次进入时调用 onCreate()，然后调用 onEnter()。
   * 子类不应 override 此方法，而应 override onCreate/onEnter。
   */
  async enter(params?: Record<string, unknown>): Promise<void> {
    // 首次进入：创建场景内容
    if (!this.created) {
      await this.onCreate();
      this.created = true;
    }

    this.container.visible = true;
    this.active = true;
    await this.onEnter(params);
  }

  /**
   * 退出场景
   *
   * 模板方法：调用 onExit()，然后隐藏容器。
   */
  async exit(): Promise<void> {
    this.active = false;
    await this.onExit();
    this.container.visible = false;
  }

  /**
   * 每帧更新
   *
   * 模板方法：仅在 active 时调用 onUpdate()。
   */
  update(deltaTime: number): void {
    if (!this.active) return;
    this.onUpdate(deltaTime);
  }

  /**
   * 接收渲染数据
   *
   * 模板方法：仅在 active 时调用 onSetData()。
   */
  setData(data: unknown): void {
    if (!this.active) return;
    this.onSetData(data);
  }

  /**
   * 销毁场景
   *
   * 模板方法：调用 onDestroy()，然后销毁容器。
   */
  destroy(): void {
    this.active = false;
    this.onDestroy();
    this.container.destroy({ children: true });
  }

  // ═══════════════════════════════════════════════════════════
  // 公共访问器
  // ═══════════════════════════════════════════════════════════

  /** 获取 PixiJS 根容器 */
  getContainer(): Container {
    return this.container;
  }

  /** 场景是否已激活 */
  isActive(): boolean {
    return this.active;
  }

  // ═══════════════════════════════════════════════════════════
  // 子类实现接口
  // ═══════════════════════════════════════════════════════════

  /**
   * 首次创建时调用（构建 PixiJS 对象树）
   *
   * 在此方法中创建 Container、Graphics、Sprite 等对象，
   * 添加到 this.container 中。
   *
   * 仅调用一次。
   */
  protected async onCreate(): Promise<void> {
    // TODO: 子类实现
  }

  /**
   * 进入场景时的自定义逻辑
   *
   * 每次场景切换到前台时调用。
   * 可用于：加载场景资源、重置状态、播放进入动画。
   */
  protected async onEnter(_params?: Record<string, unknown>): Promise<void> {
    // TODO: 子类实现
  }

  /**
   * 退出场景时的自定义逻辑
   *
   * 每次场景切换到后台时调用。
   * 可用于：暂停动画、保存临时状态。
   */
  protected async onExit(): Promise<void> {
    // TODO: 子类实现
  }

  /**
   * 每帧更新
   *
   * deltaTime 为毫秒。
   */
  protected onUpdate(_deltaTime: number): void {
    // TODO: 子类实现
  }

  /**
   * 接收渲染数据
   *
   * data 类型取决于场景类型，子类自行断言。
   */
  protected onSetData(_data: unknown): void {
    // TODO: 子类实现
  }

  /**
   * 自定义销毁逻辑
   *
   * 在容器销毁前调用，用于清理定时器、事件监听等。
   */
  protected onDestroy(): void {
    // TODO: 子类实现
  }
}
