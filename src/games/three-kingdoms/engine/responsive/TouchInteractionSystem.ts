/**
 * 触控交互系统
 *
 * 职责：
 * - #8  7种手势识别（点击/长按/拖拽/双指缩放/左滑/下拉/双击）
 * - #9  触控反馈（震动+视觉缩放+防误触+触控区域≥44px）
 * - #10 武将编队触控（点击部署/长按移除/互换位置）
 * - #15 桌面端交互规范
 * - #16 快捷键映射
 *
 * @module engine/responsive/TouchInteractionSystem
 */

import {
  GestureType,
  GESTURE_THRESHOLDS,
  type TouchPoint,
  type GestureEvent,
  type OnGesture,
  type OnFormationTouch,
  type OnDesktopInteraction,
  type OnHotkey,
  type TouchFeedbackConfig,
  TouchFeedbackType,
  FormationTouchAction,
  type FormationTouchEvent,
  DesktopInteractionType,
  type DesktopInteractionEvent,
  type HotkeyDef,
  DEFAULT_HOTKEYS,
} from '../../core/responsive/responsive.types';

const DEFAULT_FEEDBACK: TouchFeedbackConfig = {
  type: TouchFeedbackType.LightVibration,
  visualScaleValue: 0.96,
  vibrationEnabled: true,
  antiBounceInterval: GESTURE_THRESHOLDS.antiBounceInterval,
};

/**
 * 触控交互系统 — 手势识别、触控反馈、编队触控、桌面端交互、快捷键。
 */
export class TouchInteractionSystem {
  private _touchStartTime: number = 0;
  private _touchStartPoint: TouchPoint | null = null;
  private _lastTapTime: number = 0;
  private _lastTapPoint: TouchPoint | null = null;
  private _longPressTimer: ReturnType<typeof setTimeout> | null = null;
  private _isDragging: boolean = false;
  private _isLongPressFired: boolean = false;
  private _pinchStartDistance: number = 0;
  private _pinchStartScale: number = 1;
  private _feedbackConfig: TouchFeedbackConfig;
  private _lastActionTime: number = 0;
  private _selectedHeroId: string | null = null;
  private _selectedSlotIndex: number | null = null;
  private _hotkeys: HotkeyDef[];

  private readonly _gestureListeners: Set<OnGesture> = new Set();
  private readonly _formationListeners: Set<OnFormationTouch> = new Set();
  private readonly _desktopListeners: Set<OnDesktopInteraction> = new Set();
  private readonly _hotkeyListeners: Set<OnHotkey> = new Set();

  constructor(feedbackConfig?: Partial<TouchFeedbackConfig>) {
    this._feedbackConfig = { ...DEFAULT_FEEDBACK, ...feedbackConfig };
    this._hotkeys = DEFAULT_HOTKEYS.map((h) => ({ ...h }));
  }

  get feedbackConfig(): TouchFeedbackConfig { return { ...this._feedbackConfig }; }
  get selectedHeroId(): string | null { return this._selectedHeroId; }
  get selectedSlotIndex(): number | null { return this._selectedSlotIndex; }
  get hotkeys(): HotkeyDef[] { return this._hotkeys.map((h) => ({ ...h })); }

  // ─────────────────────────────────────────
  // #8 手势识别
  // ─────────────────────────────────────────

  /** 处理 touchstart */
  handleTouchStart(x: number, y: number, timestamp?: number): boolean {
    const now = timestamp ?? Date.now();
    this._touchStartPoint = { x, y, timestamp: now };
    this._touchStartTime = now;
    this._isDragging = false;
    this._isLongPressFired = false;

    this._clearLongPressTimer();
    this._longPressTimer = setTimeout(() => {
      if (this._touchStartPoint && !this._isDragging) {
        const dist = this._getDistance(this._touchStartPoint, { x, y, timestamp: now });
        if (dist < GESTURE_THRESHOLDS.longPressMaxDistance) {
          this._isLongPressFired = true;
          this._emitGesture({
            type: GestureType.LongPress, startPoint: this._touchStartPoint,
            endPoint: { x, y, timestamp: now }, distance: dist,
            duration: now - this._touchStartTime, scale: 1,
          });
        }
      }
    }, GESTURE_THRESHOLDS.longPressMinDuration);

    return true;
  }

  /** 处理 touchmove */
  handleTouchMove(x: number, y: number, timestamp?: number): void {
    if (!this._touchStartPoint) return;
    const now = timestamp ?? Date.now();
    const dist = this._getDistance(this._touchStartPoint, { x, y, timestamp: now });
    const duration = now - this._touchStartTime;
    if (!this._isDragging && duration > GESTURE_THRESHOLDS.dragMinDuration && dist > GESTURE_THRESHOLDS.dragMinDistance) {
      this._isDragging = true;
      this._clearLongPressTimer();
    }
  }

  /** 处理 touchend */
  handleTouchEnd(x: number, y: number, timestamp?: number): GestureType | null {
    if (!this._touchStartPoint) return null;
    const now = timestamp ?? Date.now();
    const endPoint: TouchPoint = { x, y, timestamp: now };
    const dist = this._getDistance(this._touchStartPoint, endPoint);
    const duration = now - this._touchStartTime;
    this._clearLongPressTimer();

    if (this._isLongPressFired) { this._resetTouchState(); return null; }

    // 拖拽/滑动判断（即使没有经过handleTouchMove也检查）
    if (dist > GESTURE_THRESHOLDS.dragMinDistance && duration > GESTURE_THRESHOLDS.dragMinDuration) {
      const g = this._recognizeSwipeOrDrag(this._touchStartPoint, endPoint, dist, duration);
      this._resetTouchState();
      return g;
    }

    if (duration < GESTURE_THRESHOLDS.tapMaxDuration && dist < GESTURE_THRESHOLDS.tapMaxDistance) {
      const g = this._recognizeTap(endPoint, now);
      this._resetTouchState();
      return g;
    }
    this._resetTouchState();
    return null;
  }

  /** 双指缩放开始 */
  handlePinchStart(distance: number, currentScale: number): void {
    this._pinchStartDistance = distance;
    this._pinchStartScale = currentScale;
  }

  /** 双指缩放移动 */
  handlePinchMove(distance: number): number {
    if (this._pinchStartDistance <= 0) return this._pinchStartScale;
    return this._pinchStartScale * (distance / this._pinchStartDistance);
  }

  /** 双指缩放结束 */
  handlePinchEnd(finalScale: number): void {
    this._emitGesture({
      type: GestureType.Pinch, startPoint: { x: 0, y: 0, timestamp: Date.now() },
      endPoint: { x: 0, y: 0, timestamp: Date.now() }, distance: 0, duration: 0, scale: finalScale,
    });
    this._pinchStartDistance = 0;
    this._pinchStartScale = 1;
  }

  // ─────────────────────────────────────────
  // #9 触控反馈
  // ─────────────────────────────────────────

  /** 检查是否命中触控目标（扩大至≥44px） */
  isTouchTargetHit(touchX: number, touchY: number, targetX: number, targetY: number, tw: number, th: number): boolean {
    const minSize = GESTURE_THRESHOLDS.minTouchTargetSize;
    const ew = Math.max(tw, minSize) / 2, eh = Math.max(th, minSize) / 2;
    return touchX >= targetX - ew && touchX <= targetX + ew && touchY >= targetY - eh && touchY <= targetY + eh;
  }

  /** 防误触检查 */
  shouldBounce(timestamp?: number): boolean {
    const now = timestamp ?? Date.now();
    // 首次操作不拦截
    if (this._lastActionTime === 0) {
      this._lastActionTime = now;
      return false;
    }
    if (now - this._lastActionTime < this._feedbackConfig.antiBounceInterval) return true;
    this._lastActionTime = now;
    return false;
  }

  /** 视觉反馈缩放值 */
  getVisualScale(isPressed: boolean): number {
    return isPressed ? this._feedbackConfig.visualScaleValue : 1.0;
  }

  setFeedbackConfig(config: Partial<TouchFeedbackConfig>): void {
    this._feedbackConfig = { ...this._feedbackConfig, ...config };
  }

  // ─────────────────────────────────────────
  // #10 编队触控
  // ─────────────────────────────────────────

  formationSelectHero(heroId: string): void {
    this._selectedHeroId = heroId; this._selectedSlotIndex = null;
    this._emitFormation({ action: FormationTouchAction.SelectHero, heroId });
  }

  formationDeployToSlot(slotIndex: number): void {
    if (this._selectedHeroId === null) return;
    this._emitFormation({ action: FormationTouchAction.DeployToSlot, heroId: this._selectedHeroId, slotIndex });
    this._selectedHeroId = null;
  }

  formationRemoveFromSlot(slotIndex: number): void {
    this._emitFormation({ action: FormationTouchAction.RemoveFromSlot, slotIndex });
  }

  formationSwapSlots(slotA: number, slotB: number): void {
    this._emitFormation({ action: FormationTouchAction.SwapSlots, slotIndex: slotA, secondSlotIndex: slotB });
  }

  resetFormationSelection(): void { this._selectedHeroId = null; this._selectedSlotIndex = null; }

  // ─────────────────────────────────────────
  // #15 桌面端交互
  // ─────────────────────────────────────────

  handleDesktopInteraction(event: DesktopInteractionEvent): void {
    for (const listener of this._desktopListeners) listener(event);
  }

  static createDesktopEvent(type: DesktopInteractionType, x: number, y: number, data?: Record<string, unknown>): DesktopInteractionEvent {
    return { type, x, y, data };
  }

  // ─────────────────────────────────────────
  // #16 快捷键映射
  // ─────────────────────────────────────────

  handleKeyPress(key: string, ctrl = false, shift = false, alt = false): string | null {
    const normalizedKey = key.toLowerCase();
    const matched = this._hotkeys.find((h) => h.key === normalizedKey && !!h.ctrl === ctrl && !!h.shift === shift && !!h.alt === alt);
    if (matched) {
      for (const listener of this._hotkeyListeners) listener(matched.action);
      return matched.action;
    }
    return null;
  }

  setHotkeys(hotkeys: HotkeyDef[]): void { this._hotkeys = hotkeys.map((h) => ({ ...h })); }
  findHotkeyByAction(action: string): HotkeyDef | undefined { return this._hotkeys.find((h) => h.action === action); }

  // ─────────────────────────────────────────
  // 事件监听
  // ─────────────────────────────────────────

  onGesture(listener: OnGesture): () => void { this._gestureListeners.add(listener); return () => this._gestureListeners.delete(listener); }
  onFormationTouch(listener: OnFormationTouch): () => void { this._formationListeners.add(listener); return () => this._formationListeners.delete(listener); }
  onDesktopInteraction(listener: OnDesktopInteraction): () => void { this._desktopListeners.add(listener); return () => this._desktopListeners.delete(listener); }
  onHotkey(listener: OnHotkey): () => void { this._hotkeyListeners.add(listener); return () => this._hotkeyListeners.delete(listener); }
  clearAllListeners(): void { this._gestureListeners.clear(); this._formationListeners.clear(); this._desktopListeners.clear(); this._hotkeyListeners.clear(); }

  // ─────────────────────────────────────────
  // 私有方法
  // ─────────────────────────────────────────

  private _getDistance(a: TouchPoint, b: TouchPoint): number {
    const dx = b.x - a.x, dy = b.y - a.y; return Math.sqrt(dx * dx + dy * dy);
  }

  private _clearLongPressTimer(): void {
    if (this._longPressTimer !== null) { clearTimeout(this._longPressTimer); this._longPressTimer = null; }
  }

  private _resetTouchState(): void {
    this._touchStartPoint = null; this._touchStartTime = 0; this._isDragging = false; this._isLongPressFired = false;
  }

  private _recognizeSwipeOrDrag(start: TouchPoint, end: TouchPoint, distance: number, duration: number): GestureType {
    const dx = end.x - start.x, dy = end.y - start.y;
    if (dx < 0 && Math.abs(dx) > GESTURE_THRESHOLDS.swipeLeftMinDistance && Math.abs(dx) > Math.abs(dy)) {
      this._emitGesture({ type: GestureType.SwipeLeft, startPoint: start, endPoint: end, distance, duration, scale: 1 });
      return GestureType.SwipeLeft;
    }
    if (dy > 0 && dy > GESTURE_THRESHOLDS.pullDownMinDistance && Math.abs(dy) > Math.abs(dx)) {
      this._emitGesture({ type: GestureType.PullDown, startPoint: start, endPoint: end, distance, duration, scale: 1 });
      return GestureType.PullDown;
    }
    this._emitGesture({ type: GestureType.Drag, startPoint: start, endPoint: end, distance, duration, scale: 1 });
    return GestureType.Drag;
  }

  private _recognizeTap(endPoint: TouchPoint, now: number): GestureType {
    // 先检查双击（双击不受防误触限制）
    if (this._lastTapTime > 0 && now - this._lastTapTime < GESTURE_THRESHOLDS.doubleTapMaxInterval && this._lastTapPoint) {
      if (this._getDistance(this._lastTapPoint, endPoint) < GESTURE_THRESHOLDS.tapMaxDistance) {
        this._lastTapTime = 0; this._lastTapPoint = null;
        this._emitGesture({ type: GestureType.DoubleTap, startPoint: endPoint, endPoint, distance: 0, duration: 0, scale: 1 });
        return GestureType.DoubleTap;
      }
    }
    // 普通点击检查防误触
    if (this.shouldBounce(now)) return null as unknown as GestureType;
    this._lastTapTime = now; this._lastTapPoint = endPoint;
    this._emitGesture({ type: GestureType.Tap, startPoint: endPoint, endPoint, distance: 0, duration: now - this._touchStartTime, scale: 1 });
    return GestureType.Tap;
  }

  private _emitGesture(event: GestureEvent): void {
    for (const listener of this._gestureListeners) listener(event);
  }

  private _emitFormation(event: FormationTouchEvent): void {
    for (const listener of this._formationListeners) listener(event);
  }
}
