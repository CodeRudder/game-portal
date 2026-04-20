/**
 * TouchInteractionSystem 单元测试
 *
 * 覆盖：
 * - #8  7种手势识别
 * - #9  触控反馈（触控区域扩大+防误触+视觉反馈）
 * - #10 武将编队触控
 * - #15 桌面端交互规范
 * - #16 快捷键映射
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  GestureType,
  GESTURE_THRESHOLDS,
  TouchFeedbackType,
  FormationTouchAction,
  DesktopInteractionType,
} from '../../../core/responsive/responsive.types';
import { TouchInteractionSystem } from '../TouchInteractionSystem';

// ── 辅助函数 ──

/** 创建触控点 */
const pt = (x: number, y: number, ts: number): { x: number; y: number; timestamp: number } => ({
  x, y, timestamp: ts,
});

describe('TouchInteractionSystem', () => {
  let system: TouchInteractionSystem;

  beforeEach(() => {
    system = new TouchInteractionSystem();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ═══════════════════════════════════════════
  // #8 手势识别
  // ═══════════════════════════════════════════

  describe('Tap gesture', () => {
    it('短按+小移动 → Tap', () => {
      const listener = vi.fn();
      system.onGesture(listener);

      system.handleTouchStart(100, 100, 0);
      const result = system.handleTouchEnd(105, 105, 200); // <300ms, <10px

      expect(result).toBe(GestureType.Tap);
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ type: GestureType.Tap }),
      );
    });

    it('超时长按不算Tap', () => {
      system.handleTouchStart(100, 100, 0);
      const result = system.handleTouchEnd(105, 105, 500); // >300ms
      expect(result).toBeNull();
    });

    it('移动过大不算Tap', () => {
      system.handleTouchStart(100, 100, 0);
      const result = system.handleTouchEnd(120, 120, 200); // >10px
      expect(result).toBeNull();
    });
  });

  describe('LongPress gesture', () => {
    it('长按>500ms+小移动 → LongPress', () => {
      const listener = vi.fn();
      system.onGesture(listener);

      system.handleTouchStart(100, 100, 0);
      vi.advanceTimersByTime(600); // >500ms

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ type: GestureType.LongPress }),
      );
    });

    it('长按中移动过大不触发', () => {
      const listener = vi.fn();
      system.onGesture(listener);

      system.handleTouchStart(100, 100, 0);
      system.handleTouchMove(150, 150, 300); // 移动过大
      vi.advanceTimersByTime(600);

      // 移动触发了拖拽，长按不会触发
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('Drag gesture', () => {
    it('移动>10px+持续>150ms → Drag', () => {
      const listener = vi.fn();
      system.onGesture(listener);

      system.handleTouchStart(100, 100, 0);
      system.handleTouchMove(130, 130, 200); // >10px移动
      const result = system.handleTouchEnd(150, 150, 300); // >150ms

      expect(result).toBe(GestureType.Drag);
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ type: GestureType.Drag }),
      );
    });
  });

  describe('SwipeLeft gesture', () => {
    it('水平左移>80px → SwipeLeft', () => {
      const listener = vi.fn();
      system.onGesture(listener);

      system.handleTouchStart(200, 100, 0);
      system.handleTouchMove(100, 100, 100);
      const result = system.handleTouchEnd(100, 100, 200);

      expect(result).toBe(GestureType.SwipeLeft);
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ type: GestureType.SwipeLeft }),
      );
    });
  });

  describe('PullDown gesture', () => {
    it('垂直下拉>60px → PullDown', () => {
      const listener = vi.fn();
      system.onGesture(listener);

      system.handleTouchStart(100, 100, 0);
      system.handleTouchMove(100, 180, 100);
      const result = system.handleTouchEnd(100, 200, 200);

      expect(result).toBe(GestureType.PullDown);
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ type: GestureType.PullDown }),
      );
    });
  });

  describe('DoubleTap gesture', () => {
    it('两次快速点击 → DoubleTap', () => {
      const listener = vi.fn();
      system.onGesture(listener);

      // 第一次点击
      system.handleTouchStart(100, 100, 0);
      system.handleTouchEnd(100, 100, 100);

      // 第二次快速点击 (<300ms)
      system.handleTouchStart(100, 100, 150);
      const result = system.handleTouchEnd(100, 100, 200);

      expect(result).toBe(GestureType.DoubleTap);
    });

    it('两次慢速点击不算DoubleTap', () => {
      // 第一次点击
      system.handleTouchStart(100, 100, 0);
      system.handleTouchEnd(100, 100, 100);

      // 第二次慢速点击 (>300ms)
      system.handleTouchStart(100, 100, 500);
      const result = system.handleTouchEnd(100, 100, 600);

      expect(result).toBe(GestureType.Tap);
    });
  });

  describe('Pinch gesture', () => {
    it('双指缩放', () => {
      const listener = vi.fn();
      system.onGesture(listener);

      system.handlePinchStart(200, 1);
      const newScale = system.handlePinchMove(300);
      expect(newScale).toBeCloseTo(1.5, 4);

      system.handlePinchEnd(1.5);
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ type: GestureType.Pinch, scale: 1.5 }),
      );
    });

    it('缩小手势', () => {
      system.handlePinchStart(200, 1);
      const newScale = system.handlePinchMove(100);
      expect(newScale).toBeCloseTo(0.5, 4);
    });
  });

  // ═══════════════════════════════════════════
  // #9 触控反馈
  // ═══════════════════════════════════════════

  describe('touch target hit', () => {
    it('命中触控目标', () => {
      expect(system.isTouchTargetHit(100, 100, 100, 100, 40, 40)).toBe(true);
    });

    it('未命中触控目标', () => {
      expect(system.isTouchTargetHit(200, 200, 100, 100, 40, 40)).toBe(false);
    });

    it('小目标自动扩大至44px', () => {
      // 目标只有20x20，但触控区域扩大到44x44
      // 目标中心(100,100)，扩大后半宽22，范围78-122
      expect(system.isTouchTargetHit(120, 100, 100, 100, 20, 20)).toBe(true);
    });
  });

  describe('anti-bounce', () => {
    it('快速连续操作被防误触拦截', () => {
      expect(system.shouldBounce(1000)).toBe(false); // 第一次不拦截
      expect(system.shouldBounce(1100)).toBe(true);  // 间隔100ms < 300ms，拦截
    });

    it('间隔足够不拦截', () => {
      system.shouldBounce(1000);
      expect(system.shouldBounce(1400)).toBe(false); // 间隔400ms > 300ms
    });
  });

  describe('visual feedback', () => {
    it('按下时缩放0.96', () => {
      expect(system.getVisualScale(true)).toBe(0.96);
    });

    it('释放时缩放1.0', () => {
      expect(system.getVisualScale(false)).toBe(1.0);
    });
  });

  describe('setFeedbackConfig', () => {
    it('更新反馈配置', () => {
      system.setFeedbackConfig({ visualScaleValue: 0.9 });
      expect(system.feedbackConfig.visualScaleValue).toBe(0.9);
    });
  });

  // ═══════════════════════════════════════════
  // #10 编队触控
  // ═══════════════════════════════════════════

  describe('formation touch', () => {
    it('选中武将', () => {
      const listener = vi.fn();
      system.onFormationTouch(listener);

      system.formationSelectHero('hero-1');
      expect(system.selectedHeroId).toBe('hero-1');
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          action: FormationTouchAction.SelectHero,
          heroId: 'hero-1',
        }),
      );
    });

    it('部署武将到格子', () => {
      const listener = vi.fn();
      system.onFormationTouch(listener);

      system.formationSelectHero('hero-1');
      system.formationDeployToSlot(0);

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          action: FormationTouchAction.DeployToSlot,
          heroId: 'hero-1',
          slotIndex: 0,
        }),
      );
      expect(system.selectedHeroId).toBeNull();
    });

    it('未选中武将时部署无效', () => {
      const listener = vi.fn();
      system.onFormationTouch(listener);

      system.formationDeployToSlot(0);
      expect(listener).not.toHaveBeenCalled();
    });

    it('长按移除武将', () => {
      const listener = vi.fn();
      system.onFormationTouch(listener);

      system.formationRemoveFromSlot(2);
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          action: FormationTouchAction.RemoveFromSlot,
          slotIndex: 2,
        }),
      );
    });

    it('互换格子', () => {
      const listener = vi.fn();
      system.onFormationTouch(listener);

      system.formationSwapSlots(0, 3);
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          action: FormationTouchAction.SwapSlots,
          slotIndex: 0,
          secondSlotIndex: 3,
        }),
      );
    });

    it('重置编队选择', () => {
      system.formationSelectHero('hero-1');
      system.resetFormationSelection();
      expect(system.selectedHeroId).toBeNull();
      expect(system.selectedSlotIndex).toBeNull();
    });
  });

  // ═══════════════════════════════════════════
  // #15 桌面端交互
  // ═══════════════════════════════════════════

  describe('desktop interaction', () => {
    it('处理桌面端事件', () => {
      const listener = vi.fn();
      system.onDesktopInteraction(listener);

      const event = TouchInteractionSystem.createDesktopEvent(
        DesktopInteractionType.Click, 100, 200,
      );
      system.handleDesktopInteraction(event);

      expect(listener).toHaveBeenCalledWith(event);
    });

    it('createDesktopEvent 创建正确事件', () => {
      const event = TouchInteractionSystem.createDesktopEvent(
        DesktopInteractionType.RightClick, 50, 60, { target: 'hero' },
      );
      expect(event.type).toBe(DesktopInteractionType.RightClick);
      expect(event.x).toBe(50);
      expect(event.y).toBe(60);
      expect(event.data).toEqual({ target: 'hero' });
    });
  });

  // ═══════════════════════════════════════════
  // #16 快捷键映射
  // ═══════════════════════════════════════════

  describe('hotkey mapping', () => {
    it('T → 打开地图', () => {
      expect(system.handleKeyPress('t')).toBe('open-map');
    });

    it('H → 打开武将', () => {
      expect(system.handleKeyPress('h')).toBe('open-heroes');
    });

    it('Ctrl+S → 保存游戏', () => {
      expect(system.handleKeyPress('s', true)).toBe('save-game');
    });

    it('Space → 暂停/继续', () => {
      expect(system.handleKeyPress(' ')).toBe('toggle-pause');
    });

    it('Escape → 关闭面板', () => {
      expect(system.handleKeyPress('escape')).toBe('close-panel');
    });

    it('未匹配的键返回null', () => {
      expect(system.handleKeyPress('z')).toBeNull();
    });

    it('大小写不敏感', () => {
      expect(system.handleKeyPress('T')).toBe('open-map');
    });

    it('触发快捷键回调', () => {
      const listener = vi.fn();
      system.onHotkey(listener);
      system.handleKeyPress('t');
      expect(listener).toHaveBeenCalledWith('open-map');
    });

    it('自定义快捷键', () => {
      system.setHotkeys([
        { key: 'x', description: '自定义', action: 'custom-action' },
      ]);
      expect(system.handleKeyPress('x')).toBe('custom-action');
    });

    it('findHotkeyByAction', () => {
      const hotkey = system.findHotkeyByAction('open-map');
      expect(hotkey?.key).toBe('t');
    });
  });

  // ═══════════════════════════════════════════
  // 事件监听管理
  // ═══════════════════════════════════════════

  describe('listener management', () => {
    it('取消手势监听', () => {
      const listener = vi.fn();
      const unsub = system.onGesture(listener);
      unsub();
      system.handleTouchStart(100, 100, 0);
      system.handleTouchEnd(100, 100, 100);
      expect(listener).not.toHaveBeenCalled();
    });

    it('取消编队监听', () => {
      const listener = vi.fn();
      const unsub = system.onFormationTouch(listener);
      unsub();
      system.formationSelectHero('h1');
      expect(listener).not.toHaveBeenCalled();
    });

    it('取消快捷键监听', () => {
      const listener = vi.fn();
      const unsub = system.onHotkey(listener);
      unsub();
      system.handleKeyPress('t');
      expect(listener).not.toHaveBeenCalled();
    });

    it('clearAllListeners', () => {
      const g = vi.fn();
      const f = vi.fn();
      const d = vi.fn();
      const h = vi.fn();
      system.onGesture(g);
      system.onFormationTouch(f);
      system.onDesktopInteraction(d);
      system.onHotkey(h);
      system.clearAllListeners();

      system.handleTouchStart(100, 100, 0);
      system.handleTouchEnd(100, 100, 100);
      system.formationSelectHero('h1');
      system.handleKeyPress('t');

      expect(g).not.toHaveBeenCalled();
      expect(f).not.toHaveBeenCalled();
      expect(h).not.toHaveBeenCalled();
    });
  });
});
