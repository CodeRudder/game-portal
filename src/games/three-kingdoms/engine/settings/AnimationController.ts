/**
 * 动画控制器
 *
 * v19.0 动画管理引擎，职责：
 * - 过渡动画（面板/Tab/页面/弹窗/场景切换）
 * - 状态动画（悬停/按下/释放/开关/选中）
 * - 反馈动画（飘字/光效/Toast/结算）
 * - 装饰动画（水墨过渡 0.6s）
 * - 动画总开关
 * - 统一的时长/缓动配置管理
 *
 * @module engine/settings/AnimationController
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';
import {
  EasingType,
  TransitionType,
  StateAnimationType,
  FeedbackAnimationType,
  INK_WASH_TRANSITION_DURATION,
  TRANSITION_DURATIONS,
  STATE_ANIMATION_DURATIONS,
  FEEDBACK_ANIMATION_DURATIONS,
} from '../../core/settings';
import type {
  AnimationConfig,
  AnimationSettings,
} from '../../core/settings';

// ─────────────────────────────────────────────
// 类型
// ─────────────────────────────────────────────

/** 动画播放器接口（便于测试 mock） */
export interface IAnimationPlayer {
  /** 播放过渡动画 */
  playTransition(type: TransitionType, config: AnimationConfig): void;
  /** 播放状态动画 */
  playStateAnimation(type: StateAnimationType, config: AnimationConfig): void;
  /** 播放反馈动画 */
  playFeedback(type: FeedbackAnimationType, config: AnimationConfig): void;
  /** 播放水墨过渡 */
  playInkWashTransition(durationMs: number): void;
  /** 取消所有动画 */
  cancelAll(): void;
}

/** 动画事件回调 */
export interface AnimationEventCallbacks {
  onTransitionStart?: (type: TransitionType) => void;
  onTransitionEnd?: (type: TransitionType) => void;
  onStateAnimationStart?: (type: StateAnimationType) => void;
  onFeedbackStart?: (type: FeedbackAnimationType) => void;
  onFeedbackEnd?: (type: FeedbackAnimationType) => void;
  onInkWashStart?: () => void;
  onInkWashEnd?: () => void;
}

/** 动画变更回调 */
export type AnimationChangeCallback = (
  settings: Readonly<AnimationSettings>,
) => void;

/** 动画播放请求 */
export interface AnimationPlayRequest {
  /** 动画类型分类 */
  category: 'transition' | 'state' | 'feedback' | 'decoration';
  /** 具体类型 */
  type: TransitionType | StateAnimationType | FeedbackAnimationType | 'inkWash';
  /** 开始时间 */
  startedAt: number;
  /** 配置 */
  config: AnimationConfig;
}

// ─────────────────────────────────────────────
// 动画控制器
// ─────────────────────────────────────────────

/**
 * 动画控制器
 *
 * 统一管理游戏内所有动画效果。
 *
 * @example
 * ```ts
 * const anim = new AnimationController();
 * anim.applySettings(animationSettings);
 *
 * // 播放过渡动画
 * anim.playTransition(TransitionType.PanelOpen);
 *
 * // 播放反馈动画
 * anim.playFeedback(FeedbackAnimationType.ResourceFloat);
 *
 * // 水墨过渡
 * anim.playInkWashTransition();
 * ```
 */
export class AnimationController implements ISubsystem {
  readonly name = 'animation' as const;
  private deps!: ISystemDeps;
  private settings: AnimationSettings | null = null;
  private player: IAnimationPlayer | null = null;
  private callbacks: AnimationEventCallbacks = {};
  private listeners: AnimationChangeCallback[] = [];
  private activeAnimations: AnimationPlayRequest[] = [];

  constructor() {
    // 设置在 applySettings 时初始化
  }

  // ─── ISubsystem 接口 ───────────────────────

  init(deps: ISystemDeps): void {
    this.deps = deps;
  }

  update(_dt: number): void { /* 动画系统由事件驱动，无需每帧更新 */ }

  getState(): unknown {
    return {
      settings: this.settings,
      activeAnimations: this.activeAnimations.length,
      enabled: this.isEnabled(),
    };
  }

  // ─────────────────────────────────────────
  // 初始化
  // ─────────────────────────────────────────

  /**
   * 设置动画播放器
   */
  setPlayer(player: IAnimationPlayer): void {
    this.player = player;
  }

  /**
   * 注册事件回调
   */
  setCallbacks(callbacks: AnimationEventCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  /**
   * 应用动画设置
   */
  applySettings(settings: AnimationSettings): void {
    this.settings = { ...settings };
    this.notifyListeners();
  }

  /** 获取当前动画设置 */
  getSettings(): Readonly<AnimationSettings> | null {
    return this.settings;
  }

  // ─────────────────────────────────────────
  // 过渡动画
  // ─────────────────────────────────────────

  /**
   * 播放过渡动画
   *
   * 根据设置中的配置播放指定类型的过渡动画。
   * 如果动画总开关关闭，则不播放。
   *
   * @param type - 过渡动画类型
   */
  playTransition(type: TransitionType): void {
    if (!this.isEnabled()) return;

    const config = this.getTransitionConfig(type);
    const request: AnimationPlayRequest = {
      category: 'transition',
      type,
      startedAt: Date.now(),
      config,
    };
    this.activeAnimations.push(request);
    this.player?.playTransition(type, config);
    this.callbacks.onTransitionStart?.(type);

    // 自动移除
    setTimeout(() => {
      this.removeAnimation(request);
      this.callbacks.onTransitionEnd?.(type);
    }, config.duration);
  }

  /**
   * 获取过渡动画配置
   */
  getTransitionConfig(type: TransitionType): AnimationConfig {
    if (this.settings?.transitions[type]) {
      return this.settings.transitions[type];
    }
    // 回退到默认配置
    return this.getDefaultTransitionConfig(type);
  }

  // ─────────────────────────────────────────
  // 状态动画
  // ─────────────────────────────────────────

  /**
   * 播放状态动画
   *
   * @param type - 状态动画类型
   */
  playStateAnimation(type: StateAnimationType): void {
    if (!this.isEnabled()) return;

    const config = this.getStateAnimationConfig(type);
    const request: AnimationPlayRequest = {
      category: 'state',
      type,
      startedAt: Date.now(),
      config,
    };
    this.activeAnimations.push(request);
    this.player?.playStateAnimation(type, config);
    this.callbacks.onStateAnimationStart?.(type);

    setTimeout(() => {
      this.removeAnimation(request);
    }, config.duration);
  }

  /**
   * 获取状态动画配置
   */
  getStateAnimationConfig(type: StateAnimationType): AnimationConfig {
    if (this.settings?.stateAnimations[type]) {
      return this.settings.stateAnimations[type];
    }
    return this.getDefaultStateAnimationConfig(type);
  }

  // ─────────────────────────────────────────
  // 反馈动画
  // ─────────────────────────────────────────

  /**
   * 播放反馈动画
   *
   * @param type - 反馈动画类型
   */
  playFeedback(type: FeedbackAnimationType): void {
    if (!this.isEnabled()) return;

    const config = this.getFeedbackConfig(type);
    const request: AnimationPlayRequest = {
      category: 'feedback',
      type,
      startedAt: Date.now(),
      config,
    };
    this.activeAnimations.push(request);
    this.player?.playFeedback(type, config);
    this.callbacks.onFeedbackStart?.(type);

    setTimeout(() => {
      this.removeAnimation(request);
      this.callbacks.onFeedbackEnd?.(type);
    }, config.duration);
  }

  /**
   * 获取反馈动画配置
   */
  getFeedbackConfig(type: FeedbackAnimationType): AnimationConfig {
    if (this.settings?.feedbackAnimations[type]) {
      return this.settings.feedbackAnimations[type];
    }
    return this.getDefaultFeedbackConfig(type);
  }

  // ─────────────────────────────────────────
  // 装饰动画
  // ─────────────────────────────────────────

  /**
   * 播放水墨过渡
   *
   * 画质切换时使用，时长 0.6s。
   */
  playInkWashTransition(): void {
    if (!this.isEnabled()) return;

    const config: AnimationConfig = {
      duration: INK_WASH_TRANSITION_DURATION,
      easing: EasingType.EaseInOut,
    };
    const request: AnimationPlayRequest = {
      category: 'decoration',
      type: 'inkWash',
      startedAt: Date.now(),
      config,
    };
    this.activeAnimations.push(request);
    this.player?.playInkWashTransition(INK_WASH_TRANSITION_DURATION);
    this.callbacks.onInkWashStart?.();

    setTimeout(() => {
      this.removeAnimation(request);
      this.callbacks.onInkWashEnd?.();
    }, INK_WASH_TRANSITION_DURATION);
  }

  /**
   * 获取水墨过渡时长
   */
  getInkWashDuration(): number {
    return INK_WASH_TRANSITION_DURATION;
  }

  // ─────────────────────────────────────────
  // 动画管理
  // ─────────────────────────────────────────

  /**
   * 是否启用动画
   */
  isEnabled(): boolean {
    return this.settings?.enabled ?? true;
  }

  /**
   * 获取当前活跃的动画列表
   */
  getActiveAnimations(): Readonly<AnimationPlayRequest>[] {
    return [...this.activeAnimations];
  }

  /**
   * 取消所有活跃动画
   */
  cancelAllAnimations(): void {
    this.activeAnimations = [];
    this.player?.cancelAll();
  }

  /**
   * 获取指定时长的过渡动画
   *
   * 便捷方法，返回动画时长（ms）。
   */
  getTransitionDuration(type: TransitionType): number {
    return this.getTransitionConfig(type).duration;
  }

  /**
   * 获取指定时长的状态动画
   */
  getStateAnimationDuration(type: StateAnimationType): number {
    return this.getStateAnimationConfig(type).duration;
  }

  /**
   * 获取指定时长的反馈动画
   */
  getFeedbackDuration(type: FeedbackAnimationType): number {
    return this.getFeedbackConfig(type).duration;
  }

  // ─────────────────────────────────────────
  // 事件监听
  // ─────────────────────────────────────────

  /**
   * 注册设置变更回调
   * @returns 取消注册函数
   */
  onChange(callback: AnimationChangeCallback): () => void {
    this.listeners.push(callback);
    return () => {
      const idx = this.listeners.indexOf(callback);
      if (idx >= 0) this.listeners.splice(idx, 1);
    };
  }

  /** 移除所有监听器 */
  removeAllListeners(): void {
    this.listeners = [];
  }

  // ─────────────────────────────────────────
  // 重置
  // ─────────────────────────────────────────

  /** 重置到初始状态 */
  reset(): void {
    this.cancelAllAnimations();
    this.settings = null;
    this.callbacks = {};
  }

  // ─────────────────────────────────────────
  // 内部方法
  // ─────────────────────────────────────────

  /** 移除动画请求 */
  private removeAnimation(request: AnimationPlayRequest): void {
    const idx = this.activeAnimations.indexOf(request);
    if (idx >= 0) {
      this.activeAnimations.splice(idx, 1);
    }
  }

  /** 通知设置变更 */
  private notifyListeners(): void {
    if (!this.settings) return;
    for (const cb of this.listeners) {
      try {
        cb(this.settings!);
      } catch {
        // 不阻断
      }
    }
  }

  /** 默认过渡动画配置 */
  private getDefaultTransitionConfig(type: TransitionType): AnimationConfig {
    const durations: Record<TransitionType, number> = {
      [TransitionType.PanelOpen]: TRANSITION_DURATIONS.panelOpen,
      [TransitionType.PanelClose]: TRANSITION_DURATIONS.panelClose,
      [TransitionType.TabSwitch]: TRANSITION_DURATIONS.tabSwitch,
      [TransitionType.PageTransition]: TRANSITION_DURATIONS.pageTransition,
      [TransitionType.PopupAppear]: TRANSITION_DURATIONS.popupAppear,
      [TransitionType.SceneSwitch]: TRANSITION_DURATIONS.sceneSwitch,
    };
    const easings: Record<TransitionType, EasingType> = {
      [TransitionType.PanelOpen]: EasingType.EaseOut,
      [TransitionType.PanelClose]: EasingType.EaseIn,
      [TransitionType.TabSwitch]: EasingType.EaseInOut,
      [TransitionType.PageTransition]: EasingType.Linear,
      [TransitionType.PopupAppear]: EasingType.Spring,
      [TransitionType.SceneSwitch]: EasingType.Linear,
    };
    return { duration: durations[type], easing: easings[type] };
  }

  /** 默认状态动画配置 */
  private getDefaultStateAnimationConfig(type: StateAnimationType): AnimationConfig {
    const durations: Record<StateAnimationType, number> = {
      [StateAnimationType.ButtonHover]: STATE_ANIMATION_DURATIONS.hover,
      [StateAnimationType.ButtonPress]: STATE_ANIMATION_DURATIONS.press,
      [StateAnimationType.ButtonRelease]: STATE_ANIMATION_DURATIONS.release,
      [StateAnimationType.ToggleSwitch]: STATE_ANIMATION_DURATIONS.toggleSwitch,
      [StateAnimationType.CardSelect]: STATE_ANIMATION_DURATIONS.select,
    };
    const easings: Record<StateAnimationType, EasingType> = {
      [StateAnimationType.ButtonHover]: EasingType.EaseOut,
      [StateAnimationType.ButtonPress]: EasingType.EaseIn,
      [StateAnimationType.ButtonRelease]: EasingType.EaseOut,
      [StateAnimationType.ToggleSwitch]: EasingType.EaseInOut,
      [StateAnimationType.CardSelect]: EasingType.EaseOut,
    };
    return { duration: durations[type], easing: easings[type] };
  }

  /** 默认反馈动画配置 */
  private getDefaultFeedbackConfig(type: FeedbackAnimationType): AnimationConfig {
    const durations: Record<FeedbackAnimationType, number> = {
      [FeedbackAnimationType.ResourceFloat]: FEEDBACK_ANIMATION_DURATIONS.resourceFloat,
      [FeedbackAnimationType.LevelUpGlow]: FEEDBACK_ANIMATION_DURATIONS.levelUpGlow,
      [FeedbackAnimationType.ToastSlideIn]: FEEDBACK_ANIMATION_DURATIONS.toastSlideIn,
      [FeedbackAnimationType.BattleResult]: FEEDBACK_ANIMATION_DURATIONS.battleResult,
    };
    return { duration: durations[type], easing: EasingType.EaseOut };
  }
}
