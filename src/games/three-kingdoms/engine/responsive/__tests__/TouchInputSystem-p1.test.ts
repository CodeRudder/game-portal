/**
 * TouchInputSystem 单元测试
 *
 * 覆盖：
 * - #8  7种手势识别（点击/长按/拖拽/双指缩放/左滑/下拉/双击）
 * - #9  触控反馈（防误触+触控区域扩大≥44px）
 * - #10 武将编队触控（点击部署/长按移除/互换位置）
 * - #15 桌面端交互规范
 * - #16 快捷键映射
 */

import {
  GestureType,
  GESTURE_THRESHOLDS,
  FormationTouchAction,
  DesktopInteractionType,
  TouchFeedbackType,
} from '../../../core/responsive/responsive.types';
import { TouchInputSystem } from '../TouchInputSystem';

// ── 辅助：模拟时间流逝 ──
function advanceTime(ms: number): void {
  jest.advanceTimersByTime(ms);
}

describe('TouchInputSystem', () => {
  let system: TouchInputSystem;

  beforeEach(() => {
    jest.useFakeTimers();
    system = new TouchInputSystem();
  });

  afterEach(() => {
    system.clearAllListeners();
    jest.useRealTimers();
  });

  // ═══════════════════════════════════════════
  // #8 7种手势识别
  // ═══════════════════════════════════════════

  describe('7种手势识别 (#8)', () => {
    // ── 点击 (Tap) ──
    describe('点击 (Tap)', () => {
      it('短按+不移动应识别为Tap', () => {
        const gestures: any[] = [];
        system.onGesture((e) => gestures.push(e));

        system.handleTouchStart(100, 100);
        advanceTime(100); // <300ms
        system.handleTouchEnd(100, 100); // 不移动

        expect(gestures.length).toBe(1);
        expect(gestures[0].type).toBe(GestureType.Tap);
        expect(gestures[0].startPoint.x).toBe(100);
        expect(gestures[0].endPoint.x).toBe(100);
      });

      it('移动<10px仍为Tap', () => {
        const gestures: any[] = [];
        system.onGesture((e) => gestures.push(e));

        system.handleTouchStart(100, 100);
        advanceTime(100);
        system.handleTouchEnd(105, 105); // 移动~7px

        expect(gestures.length).toBe(1);
        expect(gestures[0].type).toBe(GestureType.Tap);
      });
    });

    // ── 长按 (LongPress) ──
    describe('长按 (LongPress)', () => {
      it('按住>500ms+不移动应识别为LongPress', () => {
        const gestures: any[] = [];
        system.onGesture((e) => gestures.push(e));

        system.handleTouchStart(100, 100);
        advanceTime(600); // >500ms
        system.handleTouchEnd(100, 100);

        expect(gestures.length).toBe(1);
        expect(gestures[0].type).toBe(GestureType.LongPress);
      });

      it('长按后touchEnd不再触发Tap', () => {
        const gestures: any[] = [];
        system.onGesture((e) => gestures.push(e));

        system.handleTouchStart(100, 100);
        advanceTime(600); // 触发长按
        system.handleTouchEnd(100, 100);

        // 只应该有一个长按事件
        expect(gestures.length).toBe(1);
        expect(gestures[0].type).toBe(GestureType.LongPress);
      });

      it('长按期间移动>10px不应触发LongPress', () => {
        const gestures: any[] = [];
        system.onGesture((e) => gestures.push(e));

        system.handleTouchStart(100, 100);
        advanceTime(300);
        system.handleTouchMove(120, 120); // 移动>10px
        advanceTime(300); // 总共>500ms
        system.handleTouchEnd(120, 120);

        expect(gestures.length).toBe(0); // 不应触发长按
      });
    });

    // ── 拖拽 (Drag) ──
    describe('拖拽 (Drag)', () => {
      it('移动>10px+持续>150ms应识别为Drag', () => {
        const gestures: any[] = [];
        system.onGesture((e) => gestures.push(e));

        system.handleTouchStart(100, 100);
        advanceTime(200); // >150ms
        system.handleTouchEnd(150, 150); // 移动~70px

        expect(gestures.length).toBe(1);
        expect(gestures[0].type).toBe(GestureType.Drag);
      });
    });

    // ── 双指缩放 (Pinch) ──
    describe('双指缩放 (Pinch)', () => {
      it('handlePinchMove应发出Pinch手势', () => {
        const gestures: any[] = [];
        system.onGesture((e) => gestures.push(e));

        system.handlePinchStart(100, 100, 200, 100); // 距离100
        system.handlePinchMove(80, 100, 220, 100); // 距离140

        expect(gestures.length).toBe(1);
        expect(gestures[0].type).toBe(GestureType.Pinch);
        expect(gestures[0].scale).toBeCloseTo(1.4, 2); // 140/100
      });

      it('缩小应返回scale<1', () => {
        const gestures: any[] = [];
        system.onGesture((e) => gestures.push(e));

        system.handlePinchStart(100, 100, 200, 100); // 距离100
        system.handlePinchMove(120, 100, 180, 100); // 距离60

        expect(gestures.length).toBe(1);
        expect(gestures[0].scale).toBeCloseTo(0.6, 2); // 60/100
      });
    });

    // ── 左滑 (SwipeLeft) ──
    describe('左滑 (SwipeLeft)', () => {
      it('水平左滑>80px应识别为SwipeLeft', () => {
        const gestures: any[] = [];
        system.onGesture((e) => gestures.push(e));

        system.handleTouchStart(200, 100);
        advanceTime(200);
        system.handleTouchEnd(100, 100); // 左滑100px

        expect(gestures.length).toBe(1);
        expect(gestures[0].type).toBe(GestureType.SwipeLeft);
      });

      it('左滑<80px应为普通Drag', () => {
        const gestures: any[] = [];
        system.onGesture((e) => gestures.push(e));

        system.handleTouchStart(200, 100);
        advanceTime(200);
        system.handleTouchEnd(140, 100); // 左滑60px

        expect(gestures.length).toBe(1);
        expect(gestures[0].type).toBe(GestureType.Drag);
      });
    });

    // ── 下拉 (PullDown) ──
    describe('下拉 (PullDown)', () => {
      it('垂直下拉>60px应识别为PullDown', () => {
        const gestures: any[] = [];
        system.onGesture((e) => gestures.push(e));

        system.handleTouchStart(100, 100);
        advanceTime(200);
        system.handleTouchEnd(100, 200); // 下拉100px

        expect(gestures.length).toBe(1);
        expect(gestures[0].type).toBe(GestureType.PullDown);
      });

      it('下拉<60px应为普通Drag', () => {
        const gestures: any[] = [];
        system.onGesture((e) => gestures.push(e));

        system.handleTouchStart(100, 100);
        advanceTime(200);
        system.handleTouchEnd(100, 140); // 下拉40px

        expect(gestures.length).toBe(1);
        expect(gestures[0].type).toBe(GestureType.Drag);
      });
    });

    // ── 双击 (DoubleTap) ──
    describe('双击 (DoubleTap)', () => {
      it('两次快速点击应识别为DoubleTap', () => {
        const gestures: any[] = [];
        system.onGesture((e) => gestures.push(e));

        // 第一次点击
        system.handleTouchStart(100, 100);
        advanceTime(100);
        system.handleTouchEnd(100, 100);

        // 第二次点击（<300ms间隔）
        advanceTime(100);
        system.handleTouchStart(100, 100);
        advanceTime(100);
        system.handleTouchEnd(100, 100);

        // 应该有Tap + DoubleTap
        expect(gestures.length).toBe(2);
        expect(gestures[0].type).toBe(GestureType.Tap);
        expect(gestures[1].type).toBe(GestureType.DoubleTap);
      });

      it('间隔>300ms应为两次Tap', () => {
        const gestures: any[] = [];
        system.onGesture((e) => gestures.push(e));

        // 第一次点击
        system.handleTouchStart(100, 100);
        advanceTime(100);
        system.handleTouchEnd(100, 100);

        // 第二次点击（>300ms间隔）
        advanceTime(400);
        system.handleTouchStart(100, 100);
        advanceTime(100);
        system.handleTouchEnd(100, 100);

        expect(gestures.length).toBe(2);
        expect(gestures[0].type).toBe(GestureType.Tap);
        expect(gestures[1].type).toBe(GestureType.Tap);
      });
    });
  });

  // ═══════════════════════════════════════════
  // #9 触控反馈
  // ═══════════════════════════════════════════

  describe('触控反馈 (#9)', () => {
    describe('触控区域扩大≥44px', () => {
      it('isTouchTargetValid: 小于44px应不合法', () => {
        expect(TouchInputSystem.isTouchTargetValid(30, 30)).toBe(false);
        expect(TouchInputSystem.isTouchTargetValid(44, 30)).toBe(false);
        expect(TouchInputSystem.isTouchTargetValid(30, 44)).toBe(false);
      });

      it('isTouchTargetValid: ≥44×44应合法', () => {
        expect(TouchInputSystem.isTouchTargetValid(44, 44)).toBe(true);
        expect(TouchInputSystem.isTouchTargetValid(50, 50)).toBe(true);
      });

      it('expandTouchTarget应扩大到至少44px', () => {
        const result = TouchInputSystem.expandTouchTarget(30, 20);
        expect(result.width).toBe(44);
        expect(result.height).toBe(44);
      });

      it('expandTouchTarget不缩小已满足的区域', () => {
        const result = TouchInputSystem.expandTouchTarget(60, 50);
        expect(result.width).toBe(60);
        expect(result.height).toBe(50);
      });
    });

    describe('防误触', () => {
      it('快速连续点击三次，第三次被防误触抑制', () => {
        const gestures: any[] = [];
        system.onGesture((e) => gestures.push(e));

        // 第一次点击
        system.handleTouchStart(100, 100);
        advanceTime(100);
        system.handleTouchEnd(100, 100);

        // 第二次快速点击 → 构成DoubleTap
        advanceTime(100);
        system.handleTouchStart(100, 100);
        advanceTime(100);
        system.handleTouchEnd(100, 100);

        // 第三次快速点击（在防误触间隔内，不应产生手势）
        advanceTime(50); // <300ms
        system.handleTouchStart(100, 100);
        advanceTime(100);
        system.handleTouchEnd(100, 100);

        // 应该有Tap + DoubleTap，第三次点击被防误触抑制
        expect(gestures.length).toBe(2);
        expect(gestures[0].type).toBe(GestureType.Tap);
        expect(gestures[1].type).toBe(GestureType.DoubleTap);
      });
});
});
});
