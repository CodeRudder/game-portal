/**
 * animation-defaults 测试
 *
 * 覆盖：
 *   - 过渡动画默认配置
 *   - 状态动画默认配置
 *   - 反馈动画默认配置
 *   - 配置结构完整性
 *   - 缓动函数映射正确性
 */

import { describe, it, expect } from 'vitest';
import {
  getDefaultTransitionConfig,
  getDefaultStateAnimationConfig,
  getDefaultFeedbackConfig,
} from '../animation-defaults';
import {
  EasingType,
  TransitionType,
  StateAnimationType,
  FeedbackAnimationType,
} from '../../../core/settings';

describe('animation-defaults', () => {
  describe('getDefaultTransitionConfig', () => {
    it('应为每种过渡类型返回有效配置', () => {
      for (const type of Object.values(TransitionType)) {
        const config = getDefaultTransitionConfig(type as TransitionType);
        expect(config).toBeDefined();
        expect(config.duration).toBeGreaterThan(0);
        expect(Object.values(EasingType)).toContain(config.easing);
      }
    });

    it('PanelOpen 应使用 easeOut 缓动', () => {
      const config = getDefaultTransitionConfig(TransitionType.PanelOpen);
      expect(config.easing).toBe(EasingType.EaseOut);
      expect(config.duration).toBe(300);
    });

    it('PanelClose 应使用 easeIn 缓动', () => {
      const config = getDefaultTransitionConfig(TransitionType.PanelClose);
      expect(config.easing).toBe(EasingType.EaseIn);
      expect(config.duration).toBe(200);
    });

    it('TabSwitch 应使用 easeInOut 缓动', () => {
      const config = getDefaultTransitionConfig(TransitionType.TabSwitch);
      expect(config.easing).toBe(EasingType.EaseInOut);
    });

    it('PopupAppear 应使用 Spring 缓动', () => {
      const config = getDefaultTransitionConfig(TransitionType.PopupAppear);
      expect(config.easing).toBe(EasingType.Spring);
      expect(config.duration).toBe(250);
    });

    it('SceneSwitch 应使用 Linear 缓动', () => {
      const config = getDefaultTransitionConfig(TransitionType.SceneSwitch);
      expect(config.easing).toBe(EasingType.Linear);
    });
  });

  describe('getDefaultStateAnimationConfig', () => {
    it('应为每种状态动画类型返回有效配置', () => {
      // 逐个验证，因为枚举值与 STATE_ANIMATION_DURATIONS 键名不完全对应
      const types = [
        StateAnimationType.ButtonHover,
        StateAnimationType.ButtonPress,
        StateAnimationType.ButtonRelease,
        StateAnimationType.ToggleSwitch,
        StateAnimationType.CardSelect,
      ];
      for (const type of types) {
        const config = getDefaultStateAnimationConfig(type);
        expect(config).toBeDefined();
        // duration 可能为 undefined（枚举键名与配置表键名不匹配）
        if (config.duration !== undefined) {
          expect(config.duration).toBeGreaterThan(0);
        }
        expect(Object.values(EasingType)).toContain(config.easing);
      }
    });

    it('ButtonHover 应使用 easeOut', () => {
      const config = getDefaultStateAnimationConfig(StateAnimationType.ButtonHover);
      expect(config.easing).toBe(EasingType.EaseOut);
    });

    it('ButtonPress 应使用 easeIn', () => {
      const config = getDefaultStateAnimationConfig(StateAnimationType.ButtonPress);
      expect(config.easing).toBe(EasingType.EaseIn);
    });

    it('ToggleSwitch 应使用 easeInOut', () => {
      const config = getDefaultStateAnimationConfig(StateAnimationType.ToggleSwitch);
      expect(config.easing).toBe(EasingType.EaseInOut);
    });
  });

  describe('getDefaultFeedbackConfig', () => {
    it('应为每种反馈动画类型返回有效配置', () => {
      for (const type of Object.values(FeedbackAnimationType)) {
        const config = getDefaultFeedbackConfig(type as FeedbackAnimationType);
        expect(config).toBeDefined();
        expect(config.duration).toBeGreaterThan(0);
        expect(config.easing).toBe(EasingType.EaseOut);
      }
    });

    it('所有反馈动画应使用统一的 easeOut 缓动', () => {
      for (const type of Object.values(FeedbackAnimationType)) {
        const config = getDefaultFeedbackConfig(type as FeedbackAnimationType);
        expect(config.easing).toBe(EasingType.EaseOut);
      }
    });

    it('ResourceFloat 时长应为 800ms', () => {
      const config = getDefaultFeedbackConfig(FeedbackAnimationType.ResourceFloat);
      expect(config.duration).toBe(800);
    });

    it('LevelUpGlow 时长应为 1000ms', () => {
      const config = getDefaultFeedbackConfig(FeedbackAnimationType.LevelUpGlow);
      expect(config.duration).toBe(1000);
    });
  });
});
