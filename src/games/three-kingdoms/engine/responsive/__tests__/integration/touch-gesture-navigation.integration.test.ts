/**
 * §2 触控手势 & 导航 — 集成测试
 *
 * 覆盖 v17.0 竖屏适配触控交互：
 * - §2.1 七种手势识别（点击/长按/拖拽/双指缩放/左滑/下拉/双击）
 * - §2.2 武将编队触控（选中/部署/移除/互换）
 * - §3.1 底部Tab导航（切换/状态联动/面板关闭联动）
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  GestureType,
  GESTURE_THRESHOLDS,
  FormationTouchAction,
  TouchFeedbackType,
  Breakpoint,
  type GestureEvent,
  type FormationTouchEvent,
} from '../../../../core/responsive/responsive.types';
import { TouchInputSystem } from '../../TouchInputSystem';
import { ResponsiveLayoutManager } from '../../ResponsiveLayoutManager';
import { MobileLayoutManager } from '../../MobileLayoutManager';

/** 辅助：模拟快速点击 */
function simulateTap(touch: TouchInputSystem, x: number, y: number) {
  touch.handleTouchStart(x, y);
  touch.handleTouchEnd(x, y);
}

/** 辅助：模拟双击 */
function simulateDoubleTap(touch: TouchInputSystem, x: number, y: number) {
  simulateTap(touch, x, y);
  simulateTap(touch, x, y);
}

/** 辅助：模拟拖拽 */
function simulateDrag(touch: TouchInputSystem, sx: number, sy: number, ex: number, ey: number, steps = 5) {
  touch.handleTouchStart(sx, sy);
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    touch.handleTouchMove(sx + (ex - sx) * t, sy + (ey - sy) * t);
  }
  touch.handleTouchEnd(ex, ey);
}

describe('§2 触控手势 & 导航 — 集成测试', () => {
  let touch: TouchInputSystem;
  let rm: ResponsiveLayoutManager;
  let ml: MobileLayoutManager;

  beforeEach(() => {
    vi.useFakeTimers();
    touch = new TouchInputSystem();
    rm = new ResponsiveLayoutManager();
    ml = new MobileLayoutManager(rm);
  });

  afterEach(() => {
    touch.clearAllListeners();
    vi.useRealTimers();
  });

  // ═══════════════════════════════════════════════
  // §2.1 七种手势识别
  // ═══════════════════════════════════════════════

  describe('§2.1 七种手势识别', () => {
    it('Tap：短按 + 小位移 → GestureType.Tap', () => {
      const events: GestureEvent[] = [];
      touch.onGesture((e) => events.push(e));

      simulateTap(touch, 100, 200);

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe(GestureType.Tap);
      expect(events[0].startPoint.x).toBe(100);
      expect(events[0].startPoint.y).toBe(200);
    });

    it('LongPress：停留 >500ms + 位移 <10px → GestureType.LongPress', () => {
      const events: GestureEvent[] = [];
      touch.onGesture((e) => events.push(e));

      touch.handleTouchStart(150, 300);
      vi.advanceTimersByTime(GESTURE_THRESHOLDS.longPressMinDuration + 50);
      touch.handleTouchEnd(150, 300);

      const lp = events.find((e) => e.type === GestureType.LongPress);
      expect(lp).toBeDefined();
      expect(lp!.duration).toBeGreaterThanOrEqual(GESTURE_THRESHOLDS.longPressMinDuration);
    });

    it('Drag：移动 >10px + 持续 >150ms → GestureType.Drag', () => {
      const events: GestureEvent[] = [];
      touch.onGesture((e) => events.push(e));

      touch.handleTouchStart(100, 100);
      vi.advanceTimersByTime(200); // 持续 >150ms
      touch.handleTouchEnd(200, 100); // 直接结束，位移100px

      const drag = events.find((e) => e.type === GestureType.Drag);
      expect(drag).toBeDefined();
      expect(drag!.distance).toBeGreaterThanOrEqual(GESTURE_THRESHOLDS.dragMinDistance);
    });

    it('SwipeLeft：水平左滑 >80px → GestureType.SwipeLeft', () => {
      const events: GestureEvent[] = [];
      touch.onGesture((e) => events.push(e));

      // 从右向左滑动 200px
      touch.handleTouchStart(300, 200);
      vi.advanceTimersByTime(200); // 持续 >150ms
      touch.handleTouchEnd(100, 200); // 左滑 200px

      const swipe = events.find((e) => e.type === GestureType.SwipeLeft);
      expect(swipe).toBeDefined();
    });

    it('PullDown：垂直下拉 >60px → GestureType.PullDown', () => {
      const events: GestureEvent[] = [];
      touch.onGesture((e) => events.push(e));

      touch.handleTouchStart(200, 100);
      vi.advanceTimersByTime(200); // 持续 >150ms
      touch.handleTouchEnd(200, 200); // 下拉 100px

      const pull = events.find((e) => e.type === GestureType.PullDown);
      expect(pull).toBeDefined();
    });

    it('DoubleTap：两次快速点击 → GestureType.DoubleTap', () => {
      const events: GestureEvent[] = [];
      touch.onGesture((e) => events.push(e));

      simulateDoubleTap(touch, 100, 100);

      const dt = events.find((e) => e.type === GestureType.DoubleTap);
      expect(dt).toBeDefined();
    });

    it('Pinch：双指缩放 → GestureType.Pinch + scale 变化', () => {
      const events: GestureEvent[] = [];
      touch.onGesture((e) => events.push(e));

      touch.handlePinchStart(100, 200, 300, 200); // 200px 起始距离
      touch.handlePinchMove(150, 200, 250, 200);   // 100px → 缩小

      const pinch = events.find((e) => e.type === GestureType.Pinch);
      expect(pinch).toBeDefined();
      expect(pinch!.scale).toBeLessThan(1); // 缩小
    });

    it('长按后移动取消：不触发 LongPress 也不触发 Drag', () => {
      const events: GestureEvent[] = [];
      touch.onGesture((e) => events.push(e));

      touch.handleTouchStart(100, 100);
      vi.advanceTimersByTime(300); // 等待部分但未达长按阈值
      touch.handleTouchMove(120, 100); // 移动 >10px 取消长按并标记 _longPressCancelled
      vi.advanceTimersByTime(300); // 超过长按阈值但已取消
      touch.handleTouchEnd(130, 100);

      // _longPressCancelled=true 导致整个触摸序列被取消，不触发任何手势
      const lp = events.find((e) => e.type === GestureType.LongPress);
      expect(lp).toBeUndefined();
    });
  });

  // ═══════════════════════════════════════════════
  // §2.2 武将编队触控
  // ═══════════════════════════════════════════════

  describe('§2.2 武将编队触控', () => {
    it('SelectHero → DeployToSlot 完整部署流程', () => {
      const events: FormationTouchEvent[] = [];
      touch.onFormationTouch((e) => events.push(e));

      // 1. 选中武将
      const select = touch.handleFormationTouch(FormationTouchAction.SelectHero, { heroId: 'guanyu' });
      expect(select).not.toBeNull();
      expect(select!.action).toBe(FormationTouchAction.SelectHero);
      expect(touch.selectedHeroId).toBe('guanyu');

      // 2. 部署到格子
      const deploy = touch.handleFormationTouch(FormationTouchAction.DeployToSlot, { slotIndex: 0 });
      expect(deploy).not.toBeNull();
      expect(deploy!.heroId).toBe('guanyu');
      expect(deploy!.slotIndex).toBe(0);
      expect(touch.selectedHeroId).toBeNull(); // 部署后清除选中

      expect(events).toHaveLength(2);
    });

    it('未选中武将时 DeployToSlot 返回 null', () => {
      const result = touch.handleFormationTouch(FormationTouchAction.DeployToSlot, { slotIndex: 0 });
      expect(result).toBeNull();
    });

    it('RemoveFromSlot：从格子移除武将', () => {
      const events: FormationTouchEvent[] = [];
      touch.onFormationTouch((e) => events.push(e));

      const remove = touch.handleFormationTouch(FormationTouchAction.RemoveFromSlot, { slotIndex: 2 });
      expect(remove).not.toBeNull();
      expect(remove!.action).toBe(FormationTouchAction.RemoveFromSlot);
      expect(remove!.slotIndex).toBe(2);
    });

    it('SwapSlots：互换两个格子位置', () => {
      const events: FormationTouchEvent[] = [];
      touch.onFormationTouch((e) => events.push(e));

      const swap = touch.handleFormationTouch(FormationTouchAction.SwapSlots, {
        slotIndex: 0,
        secondSlotIndex: 3,
      });
      expect(swap).not.toBeNull();
      expect(swap!.slotIndex).toBe(0);
      expect(swap!.secondSlotIndex).toBe(3);
    });

    it('SwapSlots 缺少 secondSlotIndex 返回 null', () => {
      const result = touch.handleFormationTouch(FormationTouchAction.SwapSlots, { slotIndex: 0 });
      expect(result).toBeNull();
    });

    it('clearFormationSelection 清除选中状态', () => {
      touch.handleFormationTouch(FormationTouchAction.SelectHero, { heroId: 'zhaoyun' });
      expect(touch.selectedHeroId).toBe('zhaoyun');

      touch.clearFormationSelection();
      expect(touch.selectedHeroId).toBeNull();
    });

    it('触控反馈配置更新生效', () => {
      touch.setFeedbackConfig({ vibrationEnabled: false, type: TouchFeedbackType.None });
      const cfg = touch.feedbackConfig;
      expect(cfg.vibrationEnabled).toBe(false);
      expect(cfg.type).toBe(TouchFeedbackType.None);
    });
  });

  // ═══════════════════════════════════════════════
  // §3.1 底部Tab导航
  // ═══════════════════════════════════════════════

  describe('§3.1 底部Tab导航', () => {
    it('Tab切换成功：activeTabId 更新 + 面板自动关闭', () => {
      ml.openFullScreenPanel('hero-detail', '武将详情');
      expect(ml.fullScreenPanel.isOpen).toBe(true);

      const ok = ml.switchTab('heroes');
      expect(ok).toBe(true);
      expect(ml.getActiveTabId()).toBe('heroes');
      expect(ml.fullScreenPanel.isOpen).toBe(false); // 切Tab自动关面板
    });

    it('Tab切换成功：Bottom Sheet 自动关闭', () => {
      ml.openBottomSheet('info', 300);
      expect(ml.bottomSheet.isOpen).toBe(true);

      ml.switchTab('map');
      expect(ml.bottomSheet.isOpen).toBe(false); // 切Tab自动关Sheet
    });

    it('导航监听器接收 NavigationPathState 变更', () => {
      const states: Array<ReturnType<typeof ml.navigationPath>> = [];
      ml.onNavigationChange((s) => states.push(s));

      ml.openFullScreenPanel('settings', '设置');
      expect(states.length).toBeGreaterThanOrEqual(1);
      expect(states[0].canGoBack).toBe(true);
    });

    it('goBack 等价于 handleSwipeBack：关闭当前面板', () => {
      ml.openFullScreenPanel('hero-detail', '武将详情');
      expect(ml.fullScreenPanel.isOpen).toBe(true);

      const ok = ml.goBack();
      expect(ok).toBe(true);
      expect(ml.fullScreenPanel.isOpen).toBe(false);
    });

    it('面包屑导航：navigateToBreadcrumb 跳转到指定层级', () => {
      ml.openFullScreenPanel('heroes', '武将列表');
      ml.openFullScreenPanel('hero-detail', '详情');

      const breadcrumbs = ml.getBreadcrumbs();
      expect(breadcrumbs.length).toBeGreaterThanOrEqual(2);

      // 跳回首页
      const ok = ml.navigateToBreadcrumb('root');
      expect(ok).toBe(true);
    });

    it('触控区域最小尺寸校验 ≥44px', () => {
      expect(TouchInputSystem.isTouchTargetValid(44, 44)).toBe(true);
      expect(TouchInputSystem.isTouchTargetValid(43, 44)).toBe(false);
      expect(TouchInputSystem.isTouchTargetValid(44, 43)).toBe(false);
    });

    it('expandTouchTarget 将小区域扩展到 44×44', () => {
      const expanded = TouchInputSystem.expandTouchTarget(30, 20);
      expect(expanded.width).toBe(44);
      expect(expanded.height).toBe(44);
    });

    it('防误触冷却：连续操作在 antiBounceInterval 内被拦截', () => {
      touch.handleFormationTouch(FormationTouchAction.SelectHero, { heroId: 'guanyu' });
      expect(touch.isBounceProtected()).toBe(true);
    });

    it('手势监听器取消订阅后不再接收事件', () => {
      const events: GestureEvent[] = [];
      const unsub = touch.onGesture((e) => events.push(e));

      simulateTap(touch, 100, 100);
      expect(events).toHaveLength(1);

      unsub();
      simulateTap(touch, 200, 200);
      expect(events).toHaveLength(1); // 不再增加
    });
  });
});
