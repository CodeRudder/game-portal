/**
 * 触控输入系统
 *
 * 职责：
 * - #8  移动端7种手势识别（点击/长按/拖拽/双指缩放/左滑/下拉/双击）
 * - #9  触控反馈（震动+视觉+防误触+触控区域≥44px）
 * - #10 武将编队触控（点击部署/长按移除/互换位置）
 * - #15 桌面端交互规范（点击/右键/悬停/拖拽/滚轮/长按/Shift+点击）
 * - #16 快捷键映射（T/H/K/C/Space等）
 *
 * @module engine/responsive/TouchInputSystem
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';

import {
  GestureType,
  GESTURE_THRESHOLDS,
  type TouchPoint,
  type GestureEvent,
  type OnGesture,
  TouchFeedbackType,
  type TouchFeedbackConfig,
  FormationTouchAction,
  type FormationTouchEvent,
  type OnFormationTouch,
  DesktopInteractionType,
  type DesktopInteractionEvent,
  type OnDesktopInteraction,
  type HotkeyDef,
  DEFAULT_HOTKEYS,
  type OnHotkey,
} from '../../core/responsive/responsive.types';

/** 触控状态 */
enum TouchPhase { Idle = 'idle', Started = 'started', Moved = 'moved' }

/**
 * 触控输入系统 — 7种手势识别、触控反馈、编队触控、桌面端交互、快捷键映射。
 */
export class TouchInputSystem implements ISubsystem {
  private _phase: TouchPhase = TouchPhase.Idle;
  private _startPoint: TouchPoint | null = null;
  private _currentPoint: TouchPoint | null = null;
  private _lastTapTime: number = 0;
  private _lastTapPoint: TouchPoint | null = null;
  private _longPressTimer: ReturnType<typeof setTimeout> | null = null;
  private _isLongPress: boolean = false;
  private _longPressCancelled: boolean = false;
  private _pinchStartDistance: number = 0;
  private _lastActionTime: number = 0;
  private _selectedHeroId: string | null = null;
  private _selectedSlotIndex: number | null = null;
  private _feedbackConfig: TouchFeedbackConfig = {
    type: 'light-vibration' as TouchFeedbackType,
    visualScaleValue: 0.96,
    vibrationEnabled: true,
    antiBounceInterval: GESTURE_THRESHOLDS.antiBounceInterval,
  };
  private _hotkeys: HotkeyDef[] = [...DEFAULT_HOTKEYS];

  private readonly _gestureListeners: Set<OnGesture> = new Set();
  private readonly _formationListeners: Set<OnFormationTouch> = new Set();
  private readonly _desktopListeners: Set<OnDesktopInteraction> = new Set();
  private readonly _hotkeyListeners: Set<OnHotkey> = new Set();

  get phase(): TouchPhase { return this._phase; }
  get feedbackConfig(): TouchFeedbackConfig { return { ...this._feedbackConfig }; }
  get selectedHeroId(): string | null { return this._selectedHeroId; }
  get selectedSlotIndex(): number | null { return this._selectedSlotIndex; }

  // ─────────────────────────────────────────
  // #8 手势识别 — 7种手势
  // ─────────────────────────────────────────

  /** 处理触控开始 */
  handleTouchStart(x: number, y: number): void {
    const point: TouchPoint = { x, y, timestamp: Date.now() };
    this._phase = TouchPhase.Started;
    this._startPoint = point;
    this._currentPoint = point;
    this._isLongPress = false;
    this._longPressCancelled = false;
    this._clearLongPressTimer();

    this._longPressTimer = setTimeout(() => {
      if (this._phase === TouchPhase.Started && this._startPoint) {
        const dist = this._calcDistance(this._startPoint, this._currentPoint!);
        if (dist < GESTURE_THRESHOLDS.longPressMaxDistance) {
          this._isLongPress = true;
          this._emitGesture({
            type: GestureType.LongPress,
            startPoint: this._startPoint,
            endPoint: this._currentPoint!,
            distance: dist,
            duration: Date.now() - this._startPoint.timestamp,
            scale: 1,
          });
        }
      }
    }, GESTURE_THRESHOLDS.longPressMinDuration);
  }

  /** 处理触控移动 */
  handleTouchMove(x: number, y: number): void {
    if (this._phase !== TouchPhase.Started && this._phase !== TouchPhase.Moved) return;
    this._currentPoint = { x, y, timestamp: Date.now() };
    // 移动距离>10px时取消长按检测，并标记整个触摸序列取消
    if (this._startPoint && this._calcDistance(this._startPoint, this._currentPoint) > GESTURE_THRESHOLDS.longPressMaxDistance) {
      this._clearLongPressTimer();
      this._isLongPress = false;
      this._longPressCancelled = true;
    }
    this._phase = TouchPhase.Moved;
  }

  /** 处理触控结束 */
  handleTouchEnd(x: number, y: number): void {
    if (this._phase !== TouchPhase.Started && this._phase !== TouchPhase.Moved) return;
    this._clearLongPressTimer();

    const endPoint: TouchPoint = { x, y, timestamp: Date.now() };
    this._currentPoint = endPoint;
    const duration = endPoint.timestamp - (this._startPoint?.timestamp ?? endPoint.timestamp);
    const distance = this._calcDistance(this._startPoint!, endPoint);

    if (this._isLongPress) { this._resetState(); return; }

    // 长按被移动取消时，不再识别其他手势（整个触摸序列取消）
    if (this._longPressCancelled) { this._resetState(); return; }

    // 拖拽类手势判定
    if (distance > GESTURE_THRESHOLDS.dragMinDistance && duration > GESTURE_THRESHOLDS.dragMinDuration) {
      this._recognizeDragOrSwipe(this._startPoint!, endPoint, distance, duration);
    }
    // 点击类手势判定
    else if (distance < GESTURE_THRESHOLDS.tapMaxDistance && duration < GESTURE_THRESHOLDS.tapMaxDuration) {
      this._recognizeTapOrDoubleTap(this._startPoint!, endPoint, duration);
    }

    this._resetState();
  }

  /** 双指缩放开始 */
  handlePinchStart(x1: number, y1: number, x2: number, y2: number): void {
    this._pinchStartDistance = this._calcTwoPointDistance(x1, y1, x2, y2);
  }

  /** 双指缩放移动 */
  handlePinchMove(x1: number, y1: number, x2: number, y2: number): void {
    const currentDist = this._calcTwoPointDistance(x1, y1, x2, y2);
    if (this._pinchStartDistance > 0) {
      this._emitGesture({
        type: GestureType.Pinch,
        startPoint: { x: (x1 + x2) / 2, y: (y1 + y2) / 2, timestamp: Date.now() },
        endPoint: { x: (x1 + x2) / 2, y: (y1 + y2) / 2, timestamp: Date.now() },
        distance: Math.abs(currentDist - this._pinchStartDistance),
        duration: 0,
        scale: currentDist / this._pinchStartDistance,
      });
    }
  }

  // ─────────────────────────────────────────
  // #9 触控反馈
  // ─────────────────────────────────────────

  /** 检查触控区域是否满足最小尺寸（≥44px） */
  static isTouchTargetValid(width: number, height: number): boolean {
    return width >= GESTURE_THRESHOLDS.minTouchTargetSize && height >= GESTURE_THRESHOLDS.minTouchTargetSize;
  }

  /** 计算扩大后的触控区域（至少44×44） */
  static expandTouchTarget(width: number, height: number): { width: number; height: number } {
    const min = GESTURE_THRESHOLDS.minTouchTargetSize;
    return { width: Math.max(width, min), height: Math.max(height, min) };
  }

  /** 防误触冷却检查 */
  isBounceProtected(): boolean {
    return Date.now() - this._lastActionTime < this._feedbackConfig.antiBounceInterval;
  }

  /** 设置触控反馈配置 */
  setFeedbackConfig(config: Partial<TouchFeedbackConfig>): void {
    this._feedbackConfig = { ...this._feedbackConfig, ...config };
  }

  // ─────────────────────────────────────────
  // #10 武将编队触控
  // ─────────────────────────────────────────

  /** 处理编队触控操作 */
  handleFormationTouch(
    action: FormationTouchAction,
    params: { heroId?: string; slotIndex?: number; secondSlotIndex?: number } = {},
  ): FormationTouchEvent | null {
    const event: FormationTouchEvent = { action, ...params };

    switch (action) {
      case FormationTouchAction.SelectHero:
        this._selectedHeroId = params.heroId ?? null;
        break;
      case FormationTouchAction.DeployToSlot:
        if (!this._selectedHeroId || params.slotIndex === undefined) return null;
        event.heroId = this._selectedHeroId;
        this._selectedHeroId = null;
        break;
      case FormationTouchAction.RemoveFromSlot:
        if (params.slotIndex === undefined) return null;
        break;
      case FormationTouchAction.SwapSlots:
        if (params.slotIndex === undefined || params.secondSlotIndex === undefined) return null;
        break;
      default: return null;
    }

    this._lastActionTime = Date.now();
    for (const listener of this._formationListeners) listener(event);
    return event;
  }

  /** 清除编队选中状态 */
  clearFormationSelection(): void {
    this._selectedHeroId = null;
    this._selectedSlotIndex = null;
  }

  // ─────────────────────────────────────────
  // #15 桌面端交互
  // ─────────────────────────────────────────

  /** 处理桌面端交互事件 */
  handleDesktopInteraction(type: DesktopInteractionType, x: number, y: number, data?: Record<string, unknown>): void {
    const event: DesktopInteractionEvent = { type, x, y, data };
    for (const listener of this._desktopListeners) listener(event);
  }

  // ─────────────────────────────────────────
  // #16 快捷键映射
  // ─────────────────────────────────────────

  /** 处理按键事件 */
  handleKeyDown(key: string, ctrl = false, shift = false, alt = false): string | null {
    const match = this._hotkeys.find(
      (h) => h.key === key && !!h.ctrl === ctrl && !!h.shift === shift && !!h.alt === alt,
    );
    if (match) {
      for (const listener of this._hotkeyListeners) listener(match.action);
      return match.action;
    }
    return null;
  }

  getHotkeys(): HotkeyDef[] { return [...this._hotkeys]; }
  setHotkeys(hotkeys: HotkeyDef[]): void { this._hotkeys = [...hotkeys]; }

  // ── ISubsystem 接口 ──

  readonly name = 'touch-input';
  private _initialized = false;

  init(_deps: ISystemDeps): void { this._initialized = true; }
  update(_dt: number): void { /* 触控输入由事件驱动，无需帧更新 */ }
  getState(): { phase: string; feedbackConfig: TouchFeedbackConfig; selectedHeroId: string | null } {
    return { phase: this._phase, feedbackConfig: this._feedbackConfig, selectedHeroId: this._selectedHeroId };
  }
  get isInitialized(): boolean { return this._initialized; }

  // ─────────────────────────────────────────
  // 事件监听
  // ─────────────────────────────────────────

  onGesture(listener: OnGesture): () => void {
    this._gestureListeners.add(listener);
    return () => this._gestureListeners.delete(listener);
  }
  onFormationTouch(listener: OnFormationTouch): () => void {
    this._formationListeners.add(listener);
    return () => this._formationListeners.delete(listener);
  }
  onDesktopInteraction(listener: OnDesktopInteraction): () => void {
    this._desktopListeners.add(listener);
    return () => this._desktopListeners.delete(listener);
  }
  onHotkey(listener: OnHotkey): () => void {
    this._hotkeyListeners.add(listener);
    return () => this._hotkeyListeners.delete(listener);
  }
  clearAllListeners(): void {
    this._gestureListeners.clear();
    this._formationListeners.clear();
    this._desktopListeners.clear();
    this._hotkeyListeners.clear();
  }

  /** 重置为默认状态 */
  reset(): void {
    this._resetState();
    this._selectedHeroId = null;
    this._selectedSlotIndex = null;
    this._lastTapTime = 0;
    this._lastTapPoint = null;
    this._lastActionTime = 0;
    this._hotkeys = [...DEFAULT_HOTKEYS];
    this._feedbackConfig = {
      type: 'light-vibration' as TouchFeedbackType,
      visualScaleValue: 0.96,
      vibrationEnabled: true,
      antiBounceInterval: GESTURE_THRESHOLDS.antiBounceInterval,
    };
    this._initialized = false;
    this.clearAllListeners();
  }

  // ─────────────────────────────────────────
  // 私有方法
  // ─────────────────────────────────────────

  private _calcDistance(a: TouchPoint, b: TouchPoint): number {
    const dx = a.x - b.x, dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  private _calcTwoPointDistance(x1: number, y1: number, x2: number, y2: number): number {
    const dx = x2 - x1, dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
  }

  private _recognizeDragOrSwipe(start: TouchPoint, end: TouchPoint, distance: number, duration: number): void {
    const dx = end.x - start.x, dy = end.y - start.y;

    if (dx < 0 && Math.abs(dx) > GESTURE_THRESHOLDS.swipeLeftMinDistance && Math.abs(dx) > Math.abs(dy)) {
      this._emitGesture({ type: GestureType.SwipeLeft, startPoint: start, endPoint: end, distance, duration, scale: 1 });
    } else if (end.y > start.y && (end.y - start.y) > GESTURE_THRESHOLDS.pullDownMinDistance && Math.abs(dy) > Math.abs(dx)) {
      this._emitGesture({ type: GestureType.PullDown, startPoint: start, endPoint: end, distance, duration, scale: 1 });
    } else {
      this._emitGesture({ type: GestureType.Drag, startPoint: start, endPoint: end, distance, duration, scale: 1 });
    }
  }

  private _recognizeTapOrDoubleTap(start: TouchPoint, end: TouchPoint, duration: number): void {
    const now = Date.now();

    // 优先检测双击（双击检测不受防误触影响）
    if (
      this._lastTapPoint && this._lastTapTime > 0 &&
      now - this._lastTapTime < GESTURE_THRESHOLDS.doubleTapMaxInterval &&
      this._calcDistance(this._lastTapPoint, end) < GESTURE_THRESHOLDS.tapMaxDistance
    ) {
      this._emitGesture({ type: GestureType.DoubleTap, startPoint: start, endPoint: end, distance: 0, duration, scale: 1 }, true);
      this._lastTapTime = 0;
      this._lastTapPoint = null;
      return;
    }

    // 防误触期间：静默忽略（不发出Tap手势，但记录本次点击以备后续双击检测）
    if (this.isBounceProtected()) {
      this._lastTapTime = now;
      this._lastTapPoint = end;
      return;
    }

    // 普通单击
    this._emitGesture({ type: GestureType.Tap, startPoint: start, endPoint: end, distance: 0, duration, scale: 1 });
    this._lastTapTime = now;
    this._lastTapPoint = end;
  }

  private _emitGesture(event: GestureEvent, skipBounce = false): void {
    if (!skipBounce && (event.type === GestureType.Tap || event.type === GestureType.DoubleTap) && this.isBounceProtected()) return;
    this._lastActionTime = Date.now();
    for (const listener of this._gestureListeners) listener(event);
  }

  private _clearLongPressTimer(): void {
    if (this._longPressTimer !== null) { clearTimeout(this._longPressTimer); this._longPressTimer = null; }
  }

  private _resetState(): void {
    this._phase = TouchPhase.Idle;
    this._startPoint = null;
    this._currentPoint = null;
    this._isLongPress = false;
    this._longPressCancelled = false;
    this._clearLongPressTimer();
  }
}
