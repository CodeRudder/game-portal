import { vi } from 'vitest';
/**
 * AnimationController 单元测试
 *
 * 覆盖：
 * 1. 过渡动画（面板300ms/关闭200ms/Tab200ms/页面500ms/弹窗250ms）
 * 2. 状态动画（悬停150ms/按下80ms/释放120ms/开关200ms/选中200ms）
 * 3. 反馈动画（飘字/光效/Toast/结算）
 * 4. 水墨过渡（0.6s）
 * 5. 动画总开关
 * 6. 事件回调
 * 7. 设置应用
 */

import { AnimationController } from '../AnimationController';
import type { IAnimationPlayer, AnimationEventCallbacks } from '../AnimationController';
import {
  EasingType,
  TransitionType,
  StateAnimationType,
  FeedbackAnimationType,
  INK_WASH_TRANSITION_DURATION,
} from '../../../core/settings';
import type { AnimationSettings } from '../../../core/settings';
import { createDefaultAnimationSettings } from '../../../core/settings';

// ─────────────────────────────────────────────
// Mock 播放器
// ─────────────────────────────────────────────

function createMockPlayer(): IAnimationPlayer {
  return {
    playTransition: vi.fn(),
    playStateAnimation: vi.fn(),
    playFeedback: vi.fn(),
    playInkWashTransition: vi.fn(),
    cancelAll: vi.fn(),
  };
}

/** 创建 AnimationController */
function createController(): AnimationController {
  const ctrl = new AnimationController();
  ctrl.setPlayer(createMockPlayer());
  ctrl.applySettings(createDefaultAnimationSettings());
  return ctrl;
}

// ─────────────────────────────────────────────
// 测试
// ─────────────────────────────────────────────

describe('AnimationController', () => {
  let ctrl: AnimationController;
  let player: IAnimationPlayer;

  beforeEach(() => {
    vi.useFakeTimers();
    ctrl = new AnimationController();
    player = createMockPlayer();
    ctrl.setPlayer(player);
    ctrl.applySettings(createDefaultAnimationSettings());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── 过渡动画 ────────────────────────────

  describe('过渡动画', () => {
    test('面板打开 300ms EaseOut', () => {
      ctrl.playTransition(TransitionType.PanelOpen);
      expect(player.playTransition).toHaveBeenCalledWith(
        TransitionType.PanelOpen,
        expect.objectContaining({ duration: 300, easing: EasingType.EaseOut }),
      );
    });

    test('面板关闭 200ms EaseIn', () => {
      ctrl.playTransition(TransitionType.PanelClose);
      expect(player.playTransition).toHaveBeenCalledWith(
        TransitionType.PanelClose,
        expect.objectContaining({ duration: 200, easing: EasingType.EaseIn }),
      );
    });

    test('Tab 切换 200ms EaseInOut', () => {
      ctrl.playTransition(TransitionType.TabSwitch);
      expect(player.playTransition).toHaveBeenCalledWith(
        TransitionType.TabSwitch,
        expect.objectContaining({ duration: 200, easing: EasingType.EaseInOut }),
      );
    });

    test('页面切换 500ms Linear', () => {
      ctrl.playTransition(TransitionType.PageTransition);
      expect(player.playTransition).toHaveBeenCalledWith(
        TransitionType.PageTransition,
        expect.objectContaining({ duration: 500, easing: EasingType.Linear }),
      );
    });

    test('弹窗出现 250ms Spring', () => {
      ctrl.playTransition(TransitionType.PopupAppear);
      expect(player.playTransition).toHaveBeenCalledWith(
        TransitionType.PopupAppear,
        expect.objectContaining({ duration: 250, easing: EasingType.Spring }),
      );
    });

    test('过渡动画触发 onTransitionStart 回调', () => {
      const callbacks: AnimationEventCallbacks = {
        onTransitionStart: vi.fn(),
      };
      ctrl.setCallbacks(callbacks);
      ctrl.playTransition(TransitionType.PanelOpen);
      expect(callbacks.onTransitionStart).toHaveBeenCalledWith(TransitionType.PanelOpen);
    });

    test('过渡动画结束后触发 onTransitionEnd 回调', () => {
      const callbacks: AnimationEventCallbacks = {
        onTransitionEnd: vi.fn(),
      };
      ctrl.setCallbacks(callbacks);
      ctrl.playTransition(TransitionType.PanelOpen);

      // 还没结束
      expect(callbacks.onTransitionEnd).not.toHaveBeenCalled();

      // 快进 300ms
      vi.advanceTimersByTime(300);
      expect(callbacks.onTransitionEnd).toHaveBeenCalledWith(TransitionType.PanelOpen);
    });

    test('getTransitionDuration 返回正确时长', () => {
      expect(ctrl.getTransitionDuration(TransitionType.PanelOpen)).toBe(300);
      expect(ctrl.getTransitionDuration(TransitionType.PanelClose)).toBe(200);
      expect(ctrl.getTransitionDuration(TransitionType.TabSwitch)).toBe(200);
      expect(ctrl.getTransitionDuration(TransitionType.PageTransition)).toBe(500);
      expect(ctrl.getTransitionDuration(TransitionType.PopupAppear)).toBe(250);
    });
  });

  // ── 状态动画 ────────────────────────────

  describe('状态动画', () => {
    test('悬停 150ms EaseOut', () => {
      ctrl.playStateAnimation(StateAnimationType.ButtonHover);
      expect(player.playStateAnimation).toHaveBeenCalledWith(
        StateAnimationType.ButtonHover,
        expect.objectContaining({ duration: 150, easing: EasingType.EaseOut }),
      );
    });

    test('按下 80ms EaseIn', () => {
      ctrl.playStateAnimation(StateAnimationType.ButtonPress);
      expect(player.playStateAnimation).toHaveBeenCalledWith(
        StateAnimationType.ButtonPress,
        expect.objectContaining({ duration: 80, easing: EasingType.EaseIn }),
      );
    });

    test('释放 120ms EaseOut', () => {
      ctrl.playStateAnimation(StateAnimationType.ButtonRelease);
      expect(player.playStateAnimation).toHaveBeenCalledWith(
        StateAnimationType.ButtonRelease,
        expect.objectContaining({ duration: 120, easing: EasingType.EaseOut }),
      );
    });

    test('开关 200ms EaseInOut', () => {
      ctrl.playStateAnimation(StateAnimationType.ToggleSwitch);
      expect(player.playStateAnimation).toHaveBeenCalledWith(
        StateAnimationType.ToggleSwitch,
        expect.objectContaining({ duration: 200, easing: EasingType.EaseInOut }),
      );
    });

    test('选中 200ms EaseOut', () => {
      ctrl.playStateAnimation(StateAnimationType.CardSelect);
      expect(player.playStateAnimation).toHaveBeenCalledWith(
        StateAnimationType.CardSelect,
        expect.objectContaining({ duration: 200, easing: EasingType.EaseOut }),
      );
    });

    test('状态动画触发 onStateAnimationStart 回调', () => {
      const callbacks: AnimationEventCallbacks = {
        onStateAnimationStart: vi.fn(),
      };
      ctrl.setCallbacks(callbacks);
      ctrl.playStateAnimation(StateAnimationType.ButtonHover);
      expect(callbacks.onStateAnimationStart).toHaveBeenCalledWith(StateAnimationType.ButtonHover);
    });

    test('getStateAnimationDuration 返回正确时长', () => {
      expect(ctrl.getStateAnimationDuration(StateAnimationType.ButtonHover)).toBe(150);
      expect(ctrl.getStateAnimationDuration(StateAnimationType.ButtonPress)).toBe(80);
      expect(ctrl.getStateAnimationDuration(StateAnimationType.ButtonRelease)).toBe(120);
      expect(ctrl.getStateAnimationDuration(StateAnimationType.ToggleSwitch)).toBe(200);
      expect(ctrl.getStateAnimationDuration(StateAnimationType.CardSelect)).toBe(200);
    });
  });

  // ── 反馈动画 ────────────────────────────

  describe('反馈动画', () => {
    test('飘字动画播放', () => {
      ctrl.playFeedback(FeedbackAnimationType.ResourceFloat);
      expect(player.playFeedback).toHaveBeenCalledWith(
        FeedbackAnimationType.ResourceFloat,
        expect.objectContaining({ duration: 800 }),
      );
    });

    test('光效动画播放', () => {
      ctrl.playFeedback(FeedbackAnimationType.LevelUpGlow);
      expect(player.playFeedback).toHaveBeenCalledWith(
        FeedbackAnimationType.LevelUpGlow,
        expect.objectContaining({ duration: 1000 }),
      );
    });

    test('Toast 动画播放', () => {
      ctrl.playFeedback(FeedbackAnimationType.ToastSlideIn);
      expect(player.playFeedback).toHaveBeenCalledWith(
        FeedbackAnimationType.ToastSlideIn,
        expect.objectContaining({ duration: 300 }),
      );
    });

    test('结算动画播放', () => {
      ctrl.playFeedback(FeedbackAnimationType.BattleResult);
      expect(player.playFeedback).toHaveBeenCalledWith(
        FeedbackAnimationType.BattleResult,
        expect.objectContaining({ duration: 300 }),
      );
    });

    test('反馈动画触发 onFeedbackStart 回调', () => {
      const callbacks: AnimationEventCallbacks = {
        onFeedbackStart: vi.fn(),
      };
      ctrl.setCallbacks(callbacks);
      ctrl.playFeedback(FeedbackAnimationType.ResourceFloat);
      expect(callbacks.onFeedbackStart).toHaveBeenCalledWith(FeedbackAnimationType.ResourceFloat);
    });

    test('反馈动画结束后触发 onFeedbackEnd 回调', () => {
      const callbacks: AnimationEventCallbacks = {
        onFeedbackEnd: vi.fn(),
      };
      ctrl.setCallbacks(callbacks);
      ctrl.playFeedback(FeedbackAnimationType.ToastSlideIn);

      vi.advanceTimersByTime(300);
      expect(callbacks.onFeedbackEnd).toHaveBeenCalledWith(FeedbackAnimationType.ToastSlideIn);
    });

    test('getFeedbackDuration 返回正确时长', () => {
      expect(ctrl.getFeedbackDuration(FeedbackAnimationType.ResourceFloat)).toBe(800);
      expect(ctrl.getFeedbackDuration(FeedbackAnimationType.LevelUpGlow)).toBe(1000);
      expect(ctrl.getFeedbackDuration(FeedbackAnimationType.ToastSlideIn)).toBe(300);
      expect(ctrl.getFeedbackDuration(FeedbackAnimationType.BattleResult)).toBe(300);
    });
  });

  // ── 水墨过渡 ────────────────────────────

  describe('水墨过渡', () => {
    test('水墨过渡时长 600ms', () => {
      expect(INK_WASH_TRANSITION_DURATION).toBe(600);
    });

    test('playInkWashTransition 播放水墨过渡', () => {
      ctrl.playInkWashTransition();
      expect(player.playInkWashTransition).toHaveBeenCalledWith(600);
    });

    test('水墨过渡触发回调', () => {
      const callbacks: AnimationEventCallbacks = {
        onInkWashStart: vi.fn(),
        onInkWashEnd: vi.fn(),
      };
      ctrl.setCallbacks(callbacks);
      ctrl.playInkWashTransition();

      expect(callbacks.onInkWashStart).toHaveBeenCalled();
      expect(callbacks.onInkWashEnd).not.toHaveBeenCalled();

      vi.advanceTimersByTime(600);
      expect(callbacks.onInkWashEnd).toHaveBeenCalled();
    });

    test('getInkWashDuration 返回 600', () => {
      expect(ctrl.getInkWashDuration()).toBe(600);
    });
  });

  // ── 动画总开关 ──────────────────────────

  describe('动画总开关', () => {
    test('关闭后过渡动画不播放', () => {
      const settings = createDefaultAnimationSettings();
      settings.enabled = false;
      ctrl.applySettings(settings);

      ctrl.playTransition(TransitionType.PanelOpen);
      expect(player.playTransition).not.toHaveBeenCalled();
    });

    test('关闭后状态动画不播放', () => {
      const settings = createDefaultAnimationSettings();
      settings.enabled = false;
      ctrl.applySettings(settings);

      ctrl.playStateAnimation(StateAnimationType.ButtonHover);
      expect(player.playStateAnimation).not.toHaveBeenCalled();
    });

    test('关闭后反馈动画不播放', () => {
      const settings = createDefaultAnimationSettings();
      settings.enabled = false;
      ctrl.applySettings(settings);

      ctrl.playFeedback(FeedbackAnimationType.ResourceFloat);
      expect(player.playFeedback).not.toHaveBeenCalled();
    });

    test('关闭后水墨过渡不播放', () => {
      const settings = createDefaultAnimationSettings();
      settings.enabled = false;
      ctrl.applySettings(settings);

      ctrl.playInkWashTransition();
      expect(player.playInkWashTransition).not.toHaveBeenCalled();
    });

    test('isEnabled 返回正确状态', () => {
      expect(ctrl.isEnabled()).toBe(true);

      const settings = createDefaultAnimationSettings();
      settings.enabled = false;
      ctrl.applySettings(settings);
      expect(ctrl.isEnabled()).toBe(false);
    });
  });

  // ── 活跃动画管理 ────────────────────────

  describe('活跃动画管理', () => {
    test('播放动画后加入活跃列表', () => {
      ctrl.playTransition(TransitionType.PanelOpen);
      const active = ctrl.getActiveAnimations();
      expect(active).toHaveLength(1);
      expect(active[0].category).toBe('transition');
      expect(active[0].type).toBe(TransitionType.PanelOpen);
    });

    test('动画结束后从活跃列表移除', () => {
      ctrl.playTransition(TransitionType.PanelOpen);
      expect(ctrl.getActiveAnimations()).toHaveLength(1);

      vi.advanceTimersByTime(300);
      expect(ctrl.getActiveAnimations()).toHaveLength(0);
    });

    test('cancelAllAnimations 清除所有动画', () => {
      ctrl.playTransition(TransitionType.PanelOpen);
      ctrl.playStateAnimation(StateAnimationType.ButtonHover);
      expect(ctrl.getActiveAnimations()).toHaveLength(2);

      ctrl.cancelAllAnimations();
      expect(ctrl.getActiveAnimations()).toHaveLength(0);
      expect(player.cancelAll).toHaveBeenCalled();
    });
  });

  // ── 设置应用 ────────────────────────────

  describe('设置应用', () => {
    test('applySettings 更新设置', () => {
      const settings = createDefaultAnimationSettings();
      settings.transitions[TransitionType.PanelOpen] = {
        duration: 500,
        easing: EasingType.Linear,
      };
      ctrl.applySettings(settings);

      const config = ctrl.getTransitionConfig(TransitionType.PanelOpen);
      expect(config.duration).toBe(500);
      expect(config.easing).toBe(EasingType.Linear);
    });

    test('getSettings 返回当前设置', () => {
      const settings = ctrl.getSettings();
      expect(settings).not.toBeNull();
      expect(settings?.enabled).toBe(true);
    });

    test('applySettings 触发 onChange 回调', () => {
      const cb = vi.fn();
      ctrl.onChange(cb);

      const settings = createDefaultAnimationSettings();
      ctrl.applySettings(settings);
      expect(cb).toHaveBeenCalledTimes(1);
    });
  });

  // ── 事件监听 ────────────────────────────

  describe('事件监听', () => {
    test('取消注册后不再触发', () => {
      const cb = vi.fn();
      const unsub = ctrl.onChange(cb);
      unsub();

      ctrl.applySettings(createDefaultAnimationSettings());
      expect(cb).not.toHaveBeenCalled();
    });

    test('removeAllListeners 清除所有回调', () => {
      const cb1 = vi.fn();
      const cb2 = vi.fn();
      ctrl.onChange(cb1);
      ctrl.onChange(cb2);
      ctrl.removeAllListeners();

      ctrl.applySettings(createDefaultAnimationSettings());
      expect(cb1).not.toHaveBeenCalled();
      expect(cb2).not.toHaveBeenCalled();
    });
  });

  // ── 重置 ────────────────────────────────

  describe('重置', () => {
    test('reset 恢复到初始状态', () => {
      ctrl.playTransition(TransitionType.PanelOpen);
      ctrl.reset();

      expect(ctrl.getSettings()).toBeNull();
      expect(ctrl.getActiveAnimations()).toHaveLength(0);
    });
  });
});
