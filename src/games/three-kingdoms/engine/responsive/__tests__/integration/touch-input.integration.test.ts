/**
 * §2 触控交互 — 集成测试
 *
 * 覆盖：7种手势识别、触控反馈、武将编队触控、按钮卡片五态
 *
 * @module engine/responsive/__tests__/integration/touch-input
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { TouchInputSystem } from '../../TouchInputSystem';
import { TouchInteractionSystem } from '../../TouchInteractionSystem';
import {
  GestureType,
  GESTURE_THRESHOLDS,
  TouchFeedbackType,
  FormationTouchAction,
  DesktopInteractionType,
} from '../../../../core/responsive/responsive.types';

// ═══════════════════════════════════════════════
// 辅助函数
// ═══════════════════════════════════════════════

/** 模拟快速点击 */
function simulateTap(sys: TouchInputSystem, x: number, y: number, duration = 50): void {
  sys.handleTouchStart(x, y);
  // 短暂等待（不触发长按500ms阈值）
  sys.handleTouchEnd(x, y);
}

/** 模拟长按（使用 vi.useFakeTimers） */
function simulateLongPress(sys: TouchInputSystem, x: number, y: number): void {
  sys.handleTouchStart(x, y);
  vi.advanceTimersByTime(GESTURE_THRESHOLDS.longPressMinDuration + 50);
  sys.handleTouchEnd(x, y);
}

/** 模拟拖拽 — 直接从起点到终点，不经过 handleTouchMove（避免触发 _longPressCancelled） */
function simulateDrag(sys: TouchInputSystem, sx: number, sy: number, ex: number, ey: number): void {
  sys.handleTouchStart(sx, sy);
  vi.advanceTimersByTime(200); // 超过 dragMinDuration(150ms)
  // 不调用 handleTouchMove，直接 handleTouchEnd
  // handleTouchEnd 内部会自行计算距离和持续时间
  sys.handleTouchEnd(ex, ey);
}

/** 模拟左滑 — 直接从起点滑到终点 */
function simulateSwipeLeft(sys: TouchInputSystem, startY: number): void {
  sys.handleTouchStart(200, startY);
  vi.advanceTimersByTime(200); // 超过 dragMinDuration
  sys.handleTouchEnd(50, startY); // 左滑 150px > swipeLeftMinDistance(80px)
}

/** 模拟下拉 — 直接从起点下拉到终点 */
function simulatePullDown(sys: TouchInputSystem, startX: number): void {
  sys.handleTouchStart(startX, 100);
  vi.advanceTimersByTime(200); // 超过 dragMinDuration
  sys.handleTouchEnd(startX, 200); // 下拉 100px > pullDownMinDistance(60px)
}

// ═══════════════════════════════════════════════
// §2 测试主体
// ═══════════════════════════════════════════════
describe('§2 触控交互', () => {
  let sys: TouchInputSystem;

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));
    sys = new TouchInputSystem();
  });

  afterEach(() => {
    sys.reset();
    vi.useRealTimers();
  });

  // ═══════════════════════════════════════════════
  // §2.1 七种手势识别
  // ═══════════════════════════════════════════════
  describe('§2.1 七种手势识别', () => {
    it('Tap — 快速点击应识别为 Tap', () => {
      const listener = vi.fn();
      sys.onGesture(listener);
      simulateTap(sys, 100, 200);
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ type: GestureType.Tap }),
      );
    });

    it('LongPress — 持续按压 >500ms 应识别为 LongPress', () => {
      const listener = vi.fn();
      sys.onGesture(listener);
      simulateLongPress(sys, 100, 200);
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ type: GestureType.LongPress }),
      );
    });

    it('Drag — 超过阈值距离的移动应识别为 Drag', () => {
      const listener = vi.fn();
      sys.onGesture(listener);
      simulateDrag(sys, 100, 100, 150, 150); // 移动 > 10px
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ type: GestureType.Drag }),
      );
    });

    it('SwipeLeft — 向左滑动 >80px 应识别为 SwipeLeft', () => {
      const listener = vi.fn();
      sys.onGesture(listener);
      simulateSwipeLeft(sys, 200);
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ type: GestureType.SwipeLeft }),
      );
    });

    it('PullDown — 向下拉 >60px 应识别为 PullDown', () => {
      const listener = vi.fn();
      sys.onGesture(listener);
      simulatePullDown(sys, 200);
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ type: GestureType.PullDown }),
      );
    });

    it('Pinch — 双指缩放应识别为 Pinch', () => {
      const listener = vi.fn();
      sys.onGesture(listener);
      sys.handlePinchStart(100, 100, 200, 200);
      sys.handlePinchMove(80, 100, 220, 200);
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ type: GestureType.Pinch, scale: expect.any(Number) }),
      );
    });

    it('DoubleTap — 两次快速点击应识别为 DoubleTap', () => {
      const listener = vi.fn();
      sys.onGesture(listener);
      simulateTap(sys, 100, 200);
      vi.advanceTimersByTime(50);
      simulateTap(sys, 100, 200);
      const types = listener.mock.calls.map((c: any[]) => c[0].type);
      expect(types).toContain(GestureType.DoubleTap);
    });

    it('长按后移动应取消手势（不触发任何手势）', () => {
      const listener = vi.fn();
      sys.onGesture(listener);
      sys.handleTouchStart(100, 100);
      vi.advanceTimersByTime(200);
      sys.handleTouchMove(200, 200); // 移动超过阈值，取消长按
      sys.handleTouchEnd(200, 200);
      // 长按被取消后整个触摸序列作废
      const types = listener.mock.calls.map((c: any[]) => c[0].type);
      expect(types).not.toContain(GestureType.LongPress);
    });
  });

  // ═══════════════════════════════════════════════
  // §2.2 触控反馈
  // ═══════════════════════════════════════════════
  describe('§2.2 触控反馈', () => {
    it('isTouchTargetValid — 触控区域 ≥44px 应通过验证', () => {
      expect(TouchInputSystem.isTouchTargetValid(44, 44)).toBe(true);
      expect(TouchInputSystem.isTouchTargetValid(50, 60)).toBe(true);
    });

    it('isTouchTargetValid — 触控区域 <44px 应不通过', () => {
      expect(TouchInputSystem.isTouchTargetValid(30, 44)).toBe(false);
      expect(TouchInputSystem.isTouchTargetValid(44, 30)).toBe(false);
    });

    it('expandTouchTarget — 应将不足44px的区域扩展到44px', () => {
      const expanded = TouchInputSystem.expandTouchTarget(30, 20);
      expect(expanded.width).toBe(44);
      expect(expanded.height).toBe(44);
    });

    it('防误触冷却期应阻止连续快速点击', () => {
      // 第一次点击不拦截
      expect(sys.isBounceProtected()).toBe(false);
      simulateTap(sys, 100, 200);
      // 冷却期内应拦截
      expect(sys.isBounceProtected()).toBe(true);
    });

    it('setFeedbackConfig 应更新反馈配置', () => {
      sys.setFeedbackConfig({ vibrationEnabled: false, visualScaleValue: 0.9 });
      const config = sys.feedbackConfig;
      expect(config.vibrationEnabled).toBe(false);
      expect(config.visualScaleValue).toBe(0.9);
    });
  });

  // ═══════════════════════════════════════════════
  // §2.3 武将编队触控
  // ═══════════════════════════════════════════════
  describe('§2.3 武将编队触控', () => {
    it('SelectHero — 应选中指定武将', () => {
      const evt = sys.handleFormationTouch(FormationTouchAction.SelectHero, { heroId: 'guanyu' });
      expect(evt).not.toBeNull();
      expect(evt!.action).toBe(FormationTouchAction.SelectHero);
      expect(evt!.heroId).toBe('guanyu');
      expect(sys.selectedHeroId).toBe('guanyu');
    });

    it('DeployToSlot — 应将选中武将部署到指定槽位', () => {
      sys.handleFormationTouch(FormationTouchAction.SelectHero, { heroId: 'guanyu' });
      const evt = sys.handleFormationTouch(FormationTouchAction.DeployToSlot, { slotIndex: 0 });
      expect(evt).not.toBeNull();
      expect(evt!.heroId).toBe('guanyu');
      expect(evt!.slotIndex).toBe(0);
      expect(sys.selectedHeroId).toBeNull(); // 部署后清除选中
    });

    it('DeployToSlot 未选中武将时应返回 null', () => {
      const evt = sys.handleFormationTouch(FormationTouchAction.DeployToSlot, { slotIndex: 0 });
      expect(evt).toBeNull();
    });

    it('RemoveFromSlot — 应触发移除事件', () => {
      const listener = vi.fn();
      sys.onFormationTouch(listener);
      const evt = sys.handleFormationTouch(FormationTouchAction.RemoveFromSlot, { slotIndex: 2 });
      expect(evt).not.toBeNull();
      expect(evt!.action).toBe(FormationTouchAction.RemoveFromSlot);
      expect(evt!.slotIndex).toBe(2);
      expect(listener).toHaveBeenCalled();
    });

    it('SwapSlots — 应交换两个槽位', () => {
      const listener = vi.fn();
      sys.onFormationTouch(listener);
      const evt = sys.handleFormationTouch(FormationTouchAction.SwapSlots, {
        slotIndex: 0,
        secondSlotIndex: 3,
      });
      expect(evt).not.toBeNull();
      expect(evt!.slotIndex).toBe(0);
      expect(evt!.secondSlotIndex).toBe(3);
    });

    it('SwapSlots 缺少参数应返回 null', () => {
      expect(sys.handleFormationTouch(FormationTouchAction.SwapSlots, { slotIndex: 0 })).toBeNull();
    });

    it('clearFormationSelection 应清除选中状态', () => {
      sys.handleFormationTouch(FormationTouchAction.SelectHero, { heroId: 'guanyu' });
      expect(sys.selectedHeroId).toBe('guanyu');
      sys.clearFormationSelection();
      expect(sys.selectedHeroId).toBeNull();
    });
  });

  // ═══════════════════════════════════════════════
  // §2.4 按钮卡片五态（通过触控反馈模拟）
  // ═══════════════════════════════════════════════
  describe('§2.4 按钮卡片交互五态', () => {
    it('默认态 — 初始 phase 应为 idle', () => {
      const state = sys.getState();
      expect(state.phase).toBe('idle');
    });

    it('按下态 — handleTouchStart 应切换到 started', () => {
      sys.handleTouchStart(100, 200);
      const state = sys.getState();
      expect(state.phase).toBe('started');
    });

    it('移动态 — handleTouchMove 应切换到 moved', () => {
      sys.handleTouchStart(100, 200);
      sys.handleTouchMove(150, 250);
      const state = sys.getState();
      expect(state.phase).toBe('moved');
    });

    it('松开态 — handleTouchEnd 应回到 idle', () => {
      sys.handleTouchStart(100, 200);
      sys.handleTouchEnd(100, 200);
      const state = sys.getState();
      expect(state.phase).toBe('idle');
    });

    it('禁用态 — TouchFeedbackType.None 应表示无反馈', () => {
      sys.setFeedbackConfig({ type: TouchFeedbackType.None });
      expect(sys.feedbackConfig.type).toBe(TouchFeedbackType.None);
    });
  });

  // ═══════════════════════════════════════════════
  // §2.5 桌面端交互 & 快捷键
  // ═══════════════════════════════════════════════
  describe('§2.5 桌面端交互与快捷键', () => {
    it('handleDesktopInteraction 应分发桌面端事件', () => {
      const listener = vi.fn();
      sys.onDesktopInteraction(listener);
      sys.handleDesktopInteraction(DesktopInteractionType.Click, 100, 200);
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ type: DesktopInteractionType.Click, x: 100, y: 200 }),
      );
    });

    it('handleKeyDown 应匹配已注册的快捷键', () => {
      const listener = vi.fn();
      sys.onHotkey(listener);
      const action = sys.handleKeyDown('t');
      expect(action).not.toBeNull();
      expect(listener).toHaveBeenCalledWith(action);
    });

    it('handleKeyDown 未匹配应返回 null', () => {
      expect(sys.handleKeyDown('z')).toBeNull();
    });

    it('事件取消订阅应生效', () => {
      const listener = vi.fn();
      const unsub = sys.onGesture(listener);
      unsub();
      simulateTap(sys, 100, 200);
      expect(listener).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════
  // §2.6 TouchInteractionSystem 交叉验证
  // ═══════════════════════════════════════════════
  describe('§2.6 TouchInteractionSystem 交叉验证', () => {
    let interaction: TouchInteractionSystem;

    beforeEach(() => {
      interaction = new TouchInteractionSystem();
    });

    afterEach(() => {
      interaction.reset();
    });

    it('isTouchTargetHit 应正确判定触控命中（扩展至44px）', () => {
      // 目标 30x30，但触控区域扩展至 44x44
      expect(interaction.isTouchTargetHit(50, 50, 50, 50, 30, 30)).toBe(true);
      expect(interaction.isTouchTargetHit(100, 100, 50, 50, 30, 30)).toBe(false);
    });

    it('formationSelectHero + formationDeployToSlot 完整编队流程', () => {
      const listener = vi.fn();
      interaction.onFormationTouch(listener);
      interaction.formationSelectHero('zhaoyun');
      interaction.formationDeployToSlot(1);
      expect(listener).toHaveBeenCalledTimes(2);
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ action: FormationTouchAction.DeployToSlot, heroId: 'zhaoyun', slotIndex: 1 }),
      );
    });

    it('handleKeyPress 应处理快捷键', () => {
      const listener = vi.fn();
      interaction.onHotkey(listener);
      const result = interaction.handleKeyPress('t');
      expect(result).not.toBeNull();
      expect(listener).toHaveBeenCalled();
    });

    it('getVisualScale 按下时应返回缩放值', () => {
      expect(interaction.getVisualScale(true)).toBe(0.96);
      expect(interaction.getVisualScale(false)).toBe(1.0);
    });
  });

  // ═══════════════════════════════════════════════
  // §2.7 ISubsystem 接口 & 重置
  // ═══════════════════════════════════════════════
  describe('§2.7 子系统接口与重置', () => {
    it('init/getState/isInitialized 应满足 ISubsystem 接口', () => {
      expect(sys.isInitialized).toBe(false);
      sys.init({} as Record<string, unknown>);
      expect(sys.isInitialized).toBe(true);
    });

    it('reset 应清除所有状态和监听器', () => {
      const listener = vi.fn();
      sys.onGesture(listener);
      sys.handleFormationTouch(FormationTouchAction.SelectHero, { heroId: 'test' });
      sys.reset();
      expect(sys.selectedHeroId).toBeNull();
      simulateTap(sys, 100, 200);
      expect(listener).not.toHaveBeenCalled();
    });
  });
});
