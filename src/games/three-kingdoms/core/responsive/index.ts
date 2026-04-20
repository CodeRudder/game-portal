/**
 * 响应式布局 & 触控系统 — 核心层导出
 *
 * @module core/responsive
 */

export {
  // ── 断点体系 ──
  Breakpoint,
  BREAKPOINT_WIDTHS,
  CANVAS_BASE_WIDTH,
  CANVAS_BASE_HEIGHT,
  SCALE_MAX,
  WhitespaceStrategy,

  // ── 手机端布局常量 ──
  MOBILE_CANVAS_WIDTH,
  MOBILE_CANVAS_HEIGHT,
  MOBILE_LAYOUT,

  // ── 手势常量 ──
  GestureType,
  GESTURE_THRESHOLDS,

  // ── 反馈枚举 ──
  TouchFeedbackType,

  // ── 编队触控枚举 ──
  FormationTouchAction,

  // ── 桌面端交互枚举 ──
  DesktopInteractionType,

  // ── 省电模式枚举 ──
  PowerSaveLevel,

  // ── 字体大小 ──
  FontSizeLevel,
  FONT_SIZE_MAP,

  // ── 快捷键 ──
  DEFAULT_HOTKEYS,
} from './responsive.types';

export type {
  // ── 画布缩放 ──
  CanvasScaleResult,
  ResponsiveLayoutSnapshot,

  // ── 手机端布局 ──
  MobileTabItem,
  MobileTabBarState,
  FullScreenPanelState,
  BottomSheetState,
  MobileLayoutState,

  // ── 触控 ──
  TouchPoint,
  GestureEvent,
  TouchFeedbackConfig,
  FormationTouchEvent,
  DesktopInteractionEvent,

  // ── 省电 ──
  PowerSaveConfig,
  PowerSaveState,
  MobileSettingsState,

  // ── 快捷键 ──
  HotkeyDef,

  // ── 导航 ──
  BreadcrumbItem,
  NavigationPathState,

  // ── 回调类型 ──
  OnLayoutChange,
  OnGesture,
  OnFormationTouch,
  OnDesktopInteraction,
  OnHotkey,
  OnPowerSaveChange,
  OnNavigationChange,
} from './responsive.types';
