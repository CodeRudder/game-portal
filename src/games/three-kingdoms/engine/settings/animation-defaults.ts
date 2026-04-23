/**
 * 动画默认配置
 *
 * 提供过渡/状态/反馈三类动画的默认时长与缓动配置。
 * 纯函数，无副作用，可独立测试。
 *
 * @module engine/settings/animation-defaults
 */

import {
  EasingType,
  TransitionType,
  StateAnimationType,
  FeedbackAnimationType,
  TRANSITION_DURATIONS,
  STATE_ANIMATION_DURATIONS,
  FEEDBACK_ANIMATION_DURATIONS,
} from '../../core/settings';
import type { AnimationConfig } from '../../core/settings';

// ─────────────────────────────────────────────
// 默认过渡动画配置
// ─────────────────────────────────────────────

/** 过渡动画默认缓动映射 */
const TRANSITION_EASINGS: Record<TransitionType, EasingType> = {
  [TransitionType.PanelOpen]: EasingType.EaseOut,
  [TransitionType.PanelClose]: EasingType.EaseIn,
  [TransitionType.TabSwitch]: EasingType.EaseInOut,
  [TransitionType.PageTransition]: EasingType.Linear,
  [TransitionType.PopupAppear]: EasingType.Spring,
  [TransitionType.SceneSwitch]: EasingType.Linear,
};

/**
 * 获取过渡动画的默认配置
 *
 * @param type - 过渡动画类型
 * @returns 默认动画配置（时长 + 缓动）
 */
export function getDefaultTransitionConfig(type: TransitionType): AnimationConfig {
  return {
    duration: TRANSITION_DURATIONS[type as keyof typeof TRANSITION_DURATIONS],
    easing: TRANSITION_EASINGS[type],
  };
}

// ─────────────────────────────────────────────
// 默认状态动画配置
// ─────────────────────────────────────────────

/** 状态动画默认缓动映射 */
const STATE_EASINGS: Record<StateAnimationType, EasingType> = {
  [StateAnimationType.ButtonHover]: EasingType.EaseOut,
  [StateAnimationType.ButtonPress]: EasingType.EaseIn,
  [StateAnimationType.ButtonRelease]: EasingType.EaseOut,
  [StateAnimationType.ToggleSwitch]: EasingType.EaseInOut,
  [StateAnimationType.CardSelect]: EasingType.EaseOut,
};

/**
 * 获取状态动画的默认配置
 *
 * @param type - 状态动画类型
 * @returns 默认动画配置（时长 + 缓动）
 */
export function getDefaultStateAnimationConfig(type: StateAnimationType): AnimationConfig {
  return {
    duration: STATE_ANIMATION_DURATIONS[type as keyof typeof STATE_ANIMATION_DURATIONS],
    easing: STATE_EASINGS[type],
  };
}

// ─────────────────────────────────────────────
// 默认反馈动画配置
// ─────────────────────────────────────────────

/**
 * 获取反馈动画的默认配置
 *
 * 反馈动画统一使用 EaseOut 缓动。
 *
 * @param type - 反馈动画类型
 * @returns 默认动画配置（时长 + 缓动）
 */
export function getDefaultFeedbackConfig(type: FeedbackAnimationType): AnimationConfig {
  return {
    duration: FEEDBACK_ANIMATION_DURATIONS[type as keyof typeof FEEDBACK_ANIMATION_DURATIONS],
    easing: EasingType.EaseOut,
  };
}
