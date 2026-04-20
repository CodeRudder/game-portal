/**
 * 引擎层 — 动画控制器
 *
 * 统一管理全系统动画的配置和播放：
 *   - 过渡动画（面板展开/关闭、Tab切换、页面过渡、弹窗、场景切换）
 *   - 状态动画（按钮悬停/按下/释放、开关切换、卡片选中）
 *   - 反馈动画（资源飘字、升级光效、Toast滑入、战斗结算）
 *   - 装饰动画（水墨晕染过渡）
 *   - 动画总开关
 *
 * 功能覆盖：
 *   #18 过渡动画 — 面板展开300ms/关闭200ms/Tab切换200ms/页面过渡500ms/弹窗250ms
 *   #19 状态动画 — 按钮悬停150ms/按下80ms/释放120ms/开关200ms/卡片选中200ms
 *   #20 反馈动画 — 资源飘字/升级光效/Toast滑入/战斗结算等全系统反馈动画
 *
 * @module engine/unification/AnimationController
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';
import type {
  AnimationPlayRequest,
  AnimationInstance,
  AnimationControllerState,
} from '../../core/unification';
import { AnimationPlayState } from '../../core/unification';
import {
  EasingType,
  TransitionType,
  StateAnimationType,
  FeedbackAnimationType,
} from '../../core/settings';
import type { AnimationConfig, AnimationSettings } from '../../core/settings';
import {
  TRANSITION_DURATIONS,
  STATE_ANIMATION_DURATIONS,
  FEEDBACK_ANIMATION_DURATIONS,
  createDefaultAnimationSettings,
} from '../../core/settings';

// ─────────────────────────────────────────────
// 动画控制器
// ─────────────────────────────────────────────

/** 动画 ID 计数器 */
let animationIdCounter = 0;

/**
 * 动画控制器
 *
 * 统一管理过渡/状态/反馈三类动画的配置和播放。
 */
export class AnimationController implements ISubsystem {
  readonly name = 'animationController';

  private deps!: ISystemDeps;
  private settings: AnimationSettings;
  /** 当前活跃动画 */
  private activeAnimations = new Map<string, AnimationInstance>();
  /** 是否处于水墨过渡中 */
  private inkTransitionActive = false;
  private inkTransitionTimer = 0;
  private inkTransitionDuration = 600;

  constructor() {
    this.settings = createDefaultAnimationSettings();
  }

  // ─── ISubsystem 接口 ───────────────────────

  init(deps: ISystemDeps): void {
    this.deps = deps;
  }

  update(dt: number): void {
    if (!this.settings.enabled) return;

    // 更新所有活跃动画
    const dtMs = dt * 1000;
    for (const [id, anim] of this.activeAnimations) {
      if (anim.state === AnimationPlayState.Playing) {
        anim.elapsed += dtMs;
        if (anim.elapsed >= anim.totalDuration) {
          anim.state = AnimationPlayState.Completed;
          anim.request.onComplete?.();
          this.activeAnimations.delete(id);
        }
      }
    }

    // 更新水墨过渡
    if (this.inkTransitionActive) {
      this.inkTransitionTimer += dtMs;
      if (this.inkTransitionTimer >= this.inkTransitionDuration) {
        this.inkTransitionActive = false;
        this.inkTransitionTimer = 0;
      }
    }
  }

  getState(): AnimationControllerState {
    return {
      enabled: this.settings.enabled,
      activeCount: this.activeAnimations.size,
      inkTransitionActive: this.inkTransitionActive,
    };
  }

  reset(): void {
    this.settings = createDefaultAnimationSettings();
    this.activeAnimations.clear();
    this.inkTransitionActive = false;
    this.inkTransitionTimer = 0;
  }

  // ─── 设置同步 ─────────────────────────────

  /** 从 SettingsManager 同步动画设置 */
  syncAnimationSettings(settings: AnimationSettings): void {
    this.settings = {
      ...settings,
      transitions: { ...settings.transitions },
      stateAnimations: { ...settings.stateAnimations },
      feedbackAnimations: { ...settings.feedbackAnimations },
    };
  }

  // ─── 动画总开关 ──────────────────────────

  /** 设置动画总开关 */
  setEnabled(enabled: boolean): void {
    this.settings.enabled = enabled;
    if (!enabled) {
      // 关闭时清除所有活跃动画
      this.activeAnimations.clear();
    }
  }

  /** 是否启用动画 */
  isEnabled(): boolean {
    return this.settings.enabled;
  }

  // ─── 过渡动画 (#18) ──────────────────────

  /** 获取过渡动画配置 */
  getTransitionConfig(type: TransitionType): AnimationConfig {
    return { ...this.settings.transitions[type] };
  }

  /** 获取过渡动画时长 */
  getTransitionDuration(type: TransitionType): number {
    return this.settings.transitions[type]?.duration ?? TRANSITION_DURATIONS.panelOpen;
  }

  /** 获取过渡动画缓动 */
  getTransitionEasing(type: TransitionType): EasingType {
    return this.settings.transitions[type]?.easing ?? EasingType.EaseOut;
  }

  /** 播放过渡动画 */
  playTransition(type: TransitionType, targetId: string): AnimationInstance | null {
    if (!this.settings.enabled) return null;

    const config = this.settings.transitions[type];
    if (!config) return null;

    return this.play({
      animationType: `transition.${type}`,
      targetId,
      duration: config.duration,
      easing: config.easing,
    });
  }

  /** 面板展开动画 (300ms, ease-out) */
  playPanelOpen(targetId: string): AnimationInstance | null {
    return this.playTransition(TransitionType.PanelOpen, targetId);
  }

  /** 面板关闭动画 (200ms, ease-in) */
  playPanelClose(targetId: string): AnimationInstance | null {
    return this.playTransition(TransitionType.PanelClose, targetId);
  }

  /** Tab切换动画 (200ms, ease-in-out) */
  playTabSwitch(targetId: string): AnimationInstance | null {
    return this.playTransition(TransitionType.TabSwitch, targetId);
  }

  /** 页面过渡动画 (500ms, ease) */
  playPageTransition(targetId: string): AnimationInstance | null {
    return this.playTransition(TransitionType.PageTransition, targetId);
  }

  /** 弹窗弹出动画 (250ms, spring) */
  playPopupAppear(targetId: string): AnimationInstance | null {
    return this.playTransition(TransitionType.PopupAppear, targetId);
  }

  /** 场景切换动画 (800ms, ease) */
  playSceneSwitch(targetId: string): AnimationInstance | null {
    return this.playTransition(TransitionType.SceneSwitch, targetId);
  }

  // ─── 状态动画 (#19) ──────────────────────

  /** 获取状态动画配置 */
  getStateAnimationConfig(type: StateAnimationType): AnimationConfig {
    return { ...this.settings.stateAnimations[type] };
  }

  /** 获取状态动画时长 */
  getStateAnimationDuration(type: StateAnimationType): number {
    return this.settings.stateAnimations[type]?.duration ?? STATE_ANIMATION_DURATIONS.hover;
  }

  /** 播放状态动画 */
  playStateAnimation(type: StateAnimationType, targetId: string): AnimationInstance | null {
    if (!this.settings.enabled) return null;

    const config = this.settings.stateAnimations[type];
    if (!config) return null;

    return this.play({
      animationType: `state.${type}`,
      targetId,
      duration: config.duration,
      easing: config.easing,
    });
  }

  /** 按钮悬停动画 (150ms) */
  playButtonHover(targetId: string): AnimationInstance | null {
    return this.playStateAnimation(StateAnimationType.ButtonHover, targetId);
  }

  /** 按钮按下动画 (80ms) */
  playButtonPress(targetId: string): AnimationInstance | null {
    return this.playStateAnimation(StateAnimationType.ButtonPress, targetId);
  }

  /** 按钮释放动画 (120ms) */
  playButtonRelease(targetId: string): AnimationInstance | null {
    return this.playStateAnimation(StateAnimationType.ButtonRelease, targetId);
  }

  /** 开关切换动画 (200ms, 虎符旋转180°) */
  playToggleSwitch(targetId: string): AnimationInstance | null {
    return this.playStateAnimation(StateAnimationType.ToggleSwitch, targetId);
  }

  /** 卡片选中动画 (200ms) */
  playCardSelect(targetId: string): AnimationInstance | null {
    return this.playStateAnimation(StateAnimationType.CardSelect, targetId);
  }

  // ─── 反馈动画 (#20) ──────────────────────

  /** 获取反馈动画配置 */
  getFeedbackAnimationConfig(type: FeedbackAnimationType): AnimationConfig {
    return { ...this.settings.feedbackAnimations[type] };
  }

  /** 获取反馈动画时长 */
  getFeedbackAnimationDuration(type: FeedbackAnimationType): number {
    return this.settings.feedbackAnimations[type]?.duration ?? FEEDBACK_ANIMATION_DURATIONS.resourceFloat;
  }

  /** 播放反馈动画 */
  playFeedbackAnimation(type: FeedbackAnimationType, targetId: string): AnimationInstance | null {
    if (!this.settings.enabled) return null;

    const config = this.settings.feedbackAnimations[type];
    if (!config) return null;

    return this.play({
      animationType: `feedback.${type}`,
      targetId,
      duration: config.duration,
      easing: config.easing,
    });
  }

  /** 资源飘字动画 (800ms, +N绿色上飘 / -N红色下飘) */
  playResourceFloat(targetId: string): AnimationInstance | null {
    return this.playFeedbackAnimation(FeedbackAnimationType.ResourceFloat, targetId);
  }

  /** 升级光效动画 (1000ms, 金色粒子爆发) */
  playLevelUpGlow(targetId: string): AnimationInstance | null {
    return this.playFeedbackAnimation(FeedbackAnimationType.LevelUpGlow, targetId);
  }

  /** Toast滑入动画 (300ms, 从顶部滑入) */
  playToastSlideIn(targetId: string): AnimationInstance | null {
    return this.playFeedbackAnimation(FeedbackAnimationType.ToastSlideIn, targetId);
  }

  /** 战斗结算动画 (每颗间隔300ms) */
  playBattleResult(targetId: string): AnimationInstance | null {
    return this.playFeedbackAnimation(FeedbackAnimationType.BattleResult, targetId);
  }

  // ─── 水墨过渡 ────────────────────────────

  /** 开始水墨过渡 */
  startInkTransition(duration: number = 600): void {
    this.inkTransitionActive = true;
    this.inkTransitionTimer = 0;
    this.inkTransitionDuration = duration;
  }

  /** 是否正在水墨过渡中 */
  isInkTransitionActive(): boolean {
    return this.inkTransitionActive;
  }

  /** 获取水墨过渡进度 (0~1) */
  getInkTransitionProgress(): number {
    if (!this.inkTransitionActive) return 1;
    return Math.min(1, this.inkTransitionTimer / this.inkTransitionDuration);
  }

  // ─── 通用播放 ────────────────────────────

  /** 播放自定义动画 */
  play(request: AnimationPlayRequest): AnimationInstance {
    const id = `anim_${++animationIdCounter}_${Date.now()}`;
    const instance: AnimationInstance = {
      id,
      request,
      state: AnimationPlayState.Playing,
      elapsed: 0,
      totalDuration: request.duration ?? 300,
    };

    this.activeAnimations.set(id, instance);
    return instance;
  }

  /** 取消动画 */
  cancel(animationId: string): boolean {
    return this.activeAnimations.delete(animationId);
  }

  /** 取消目标元素的所有动画 */
  cancelByTarget(targetId: string): number {
    let count = 0;
    for (const [id, anim] of this.activeAnimations) {
      if (anim.request.targetId === targetId) {
        this.activeAnimations.delete(id);
        count++;
      }
    }
    return count;
  }

  /** 获取活跃动画数 */
  getActiveCount(): number {
    return this.activeAnimations.size;
  }

  /** 获取活跃动画列表 */
  getActiveAnimations(): AnimationInstance[] {
    return Array.from(this.activeAnimations.values());
  }

  // ─── 配置修改 ────────────────────────────

  /** 更新过渡动画配置 */
  setTransitionConfig(type: TransitionType, config: Partial<AnimationConfig>): void {
    if (this.settings.transitions[type]) {
      this.settings.transitions[type] = {
        ...this.settings.transitions[type],
        ...config,
      };
    }
  }

  /** 更新状态动画配置 */
  setStateAnimationConfig(type: StateAnimationType, config: Partial<AnimationConfig>): void {
    if (this.settings.stateAnimations[type]) {
      this.settings.stateAnimations[type] = {
        ...this.settings.stateAnimations[type],
        ...config,
      };
    }
  }

  /** 更新反馈动画配置 */
  setFeedbackAnimationConfig(type: FeedbackAnimationType, config: Partial<AnimationConfig>): void {
    if (this.settings.feedbackAnimations[type]) {
      this.settings.feedbackAnimations[type] = {
        ...this.settings.feedbackAnimations[type],
        ...config,
      };
    }
  }

  /** 获取完整动画设置 */
  getAnimationSettings(): AnimationSettings {
    return {
      ...this.settings,
      transitions: { ...this.settings.transitions },
      stateAnimations: { ...this.settings.stateAnimations },
      feedbackAnimations: { ...this.settings.feedbackAnimations },
    };
  }
}
