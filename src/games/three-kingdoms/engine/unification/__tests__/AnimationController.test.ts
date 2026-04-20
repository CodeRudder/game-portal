/**
 * AnimationController 测试
 *
 * 覆盖：
 *   - ISubsystem 接口
 *   - 动画总开关
 *   - 过渡动画 (#18)
 *   - 状态动画 (#19)
 *   - 反馈动画 (#20)
 *   - 水墨过渡
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AnimationController } from '../AnimationController';
import { AnimationPlayState } from '../../../core/unification';
import { EasingType, TransitionType, StateAnimationType, FeedbackAnimationType } from '../../../core/settings';

function createMockDeps() {
  return {
    eventBus: { on: () => {}, emit: () => {}, off: () => {} },
    config: { get: () => null },
    registry: { get: () => null, getAll: () => new Map(), has: () => false, register: () => {}, unregister: () => {} },
  };
}

describe('AnimationController', () => {
  let ctrl: AnimationController;

  beforeEach(() => {
    ctrl = new AnimationController();
    ctrl.init(createMockDeps() as any);
  });

  describe('ISubsystem 接口', () => {
    it('应有正确的 name', () => {
      expect(ctrl.name).toBe('animationController');
    });

    it('init 不应抛错', () => {
      expect(() => ctrl.init(createMockDeps() as any)).not.toThrow();
    });

    it('reset 应清除所有动画', () => {
      ctrl.play({ animationType: 'test', targetId: 'a', duration: 300, easing: EasingType.EaseOut });
      ctrl.reset();
      expect(ctrl.getActiveCount()).toBe(0);
    });

    it('getState 应返回正确状态', () => {
      const state = ctrl.getState();
      expect(state).toHaveProperty('enabled');
      expect(state).toHaveProperty('activeCount');
      expect(state).toHaveProperty('inkTransitionActive');
    });
  });

  describe('动画总开关', () => {
    it('默认应启用', () => {
      expect(ctrl.isEnabled()).toBe(true);
    });

    it('关闭后不应播放动画', () => {
      ctrl.setEnabled(false);
      const result = ctrl.playPanelOpen('panel1');
      expect(result).toBeNull();
      expect(ctrl.isEnabled()).toBe(false);
    });

    it('关闭应清除活跃动画', () => {
      ctrl.playPanelOpen('panel1');
      ctrl.setEnabled(false);
      expect(ctrl.getActiveCount()).toBe(0);
    });
  });

  describe('#18 过渡动画', () => {
    it('面板展开应有配置', () => {
      const config = ctrl.getTransitionConfig(TransitionType.PanelOpen);
      expect(config.duration).toBeGreaterThan(0);
    });

    it('面板展开应返回动画实例', () => {
      const inst = ctrl.playPanelOpen('panel1');
      expect(inst).not.toBeNull();
      expect(inst!.state).toBe(AnimationPlayState.Playing);
    });

    it('面板关闭应返回动画实例', () => {
      const inst = ctrl.playPanelClose('panel1');
      expect(inst).not.toBeNull();
    });

    it('Tab 切换应返回动画实例', () => {
      const inst = ctrl.playTabSwitch('tab1');
      expect(inst).not.toBeNull();
    });

    it('页面过渡应返回动画实例', () => {
      const inst = ctrl.playPageTransition('page1');
      expect(inst).not.toBeNull();
    });

    it('弹窗弹出应返回动画实例', () => {
      const inst = ctrl.playPopupAppear('popup1');
      expect(inst).not.toBeNull();
    });

    it('场景切换应返回动画实例', () => {
      const inst = ctrl.playSceneSwitch('scene1');
      expect(inst).not.toBeNull();
    });

    it('应可获取过渡时长', () => {
      const duration = ctrl.getTransitionDuration(TransitionType.PanelOpen);
      expect(duration).toBeGreaterThan(0);
    });

    it('应可获取过渡缓动', () => {
      const easing = ctrl.getTransitionEasing(TransitionType.PanelOpen);
      expect(easing).toBeTruthy();
    });
  });

  describe('#19 状态动画', () => {
    it('按钮悬停应返回动画实例', () => {
      const inst = ctrl.playButtonHover('btn1');
      expect(inst).not.toBeNull();
    });

    it('按钮按下应返回动画实例', () => {
      const inst = ctrl.playButtonPress('btn1');
      expect(inst).not.toBeNull();
    });

    it('按钮释放应返回动画实例', () => {
      const inst = ctrl.playButtonRelease('btn1');
      expect(inst).not.toBeNull();
    });

    it('开关切换应返回动画实例', () => {
      const inst = ctrl.playToggleSwitch('toggle1');
      expect(inst).not.toBeNull();
    });

    it('卡片选中应返回动画实例', () => {
      const inst = ctrl.playCardSelect('card1');
      expect(inst).not.toBeNull();
    });

    it('应可获取状态动画时长', () => {
      const duration = ctrl.getStateAnimationDuration(StateAnimationType.ButtonHover);
      expect(duration).toBeGreaterThan(0);
    });
  });

  describe('#20 反馈动画', () => {
    it('资源飘字应返回动画实例', () => {
      const inst = ctrl.playResourceFloat('res1');
      expect(inst).not.toBeNull();
    });

    it('升级光效应返回动画实例', () => {
      const inst = ctrl.playLevelUpGlow('hero1');
      expect(inst).not.toBeNull();
    });

    it('Toast 滑入应返回动画实例', () => {
      const inst = ctrl.playToastSlideIn('toast1');
      expect(inst).not.toBeNull();
    });

    it('战斗结算应返回动画实例', () => {
      const inst = ctrl.playBattleResult('battle1');
      expect(inst).not.toBeNull();
    });
  });

  describe('水墨过渡', () => {
    it('开始水墨过渡应激活', () => {
      ctrl.startInkTransition();
      expect(ctrl.isInkTransitionActive()).toBe(true);
      expect(ctrl.getInkTransitionProgress()).toBe(0);
    });

    it('水墨过渡完成后应停止', () => {
      ctrl.startInkTransition(100);
      ctrl.update(0.05); // 50ms
      expect(ctrl.isInkTransitionActive()).toBe(true);
      ctrl.update(0.06); // 60ms more → total 110ms > 100ms
      expect(ctrl.isInkTransitionActive()).toBe(false);
    });

    it('水墨过渡进度应在 0~1 之间', () => {
      ctrl.startInkTransition(1000);
      ctrl.update(0.5); // 500ms
      const progress = ctrl.getInkTransitionProgress();
      expect(progress).toBeGreaterThan(0);
      expect(progress).toBeLessThanOrEqual(1);
    });
  });

  describe('动画管理', () => {
    it('cancel 应取消动画', () => {
      const inst = ctrl.play({ animationType: 'test', targetId: 'a', duration: 300, easing: EasingType.EaseOut });
      expect(ctrl.cancel(inst.id)).toBe(true);
      expect(ctrl.getActiveCount()).toBe(0);
    });

    it('cancelByTarget 应取消目标的所有动画', () => {
      ctrl.play({ animationType: 'a', targetId: 'target1', duration: 300, easing: EasingType.EaseOut });
      ctrl.play({ animationType: 'b', targetId: 'target1', duration: 300, easing: EasingType.EaseOut });
      ctrl.play({ animationType: 'c', targetId: 'target2', duration: 300, easing: EasingType.EaseOut });
      expect(ctrl.cancelByTarget('target1')).toBe(2);
      expect(ctrl.getActiveCount()).toBe(1);
    });

    it('动画到期应自动完成', () => {
      ctrl.play({ animationType: 'test', targetId: 'a', duration: 100, easing: EasingType.EaseOut });
      ctrl.update(0.2); // 200ms > 100ms
      expect(ctrl.getActiveCount()).toBe(0);
    });

    it('getActiveAnimations 应返回动画列表', () => {
      ctrl.playPanelOpen('p1');
      ctrl.playPanelClose('p2');
      const anims = ctrl.getActiveAnimations();
      expect(anims).toHaveLength(2);
    });
  });

  describe('配置修改', () => {
    it('setTransitionConfig 应更新配置', () => {
      ctrl.setTransitionConfig(TransitionType.PanelOpen, { duration: 500 });
      const config = ctrl.getTransitionConfig(TransitionType.PanelOpen);
      expect(config.duration).toBe(500);
    });

    it('getAnimationSettings 应返回完整设置', () => {
      const settings = ctrl.getAnimationSettings();
      expect(settings.enabled).toBe(true);
      expect(settings.transitions).toBeDefined();
      expect(settings.stateAnimations).toBeDefined();
      expect(settings.feedbackAnimations).toBeDefined();
    });
  });
});
