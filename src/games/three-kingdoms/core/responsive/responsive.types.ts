/**
 * 响应式布局 & 触控系统 — 核心类型定义
 *
 * 涵盖：7级断点、画布缩放、留白策略、手机端布局、
 * 7种手势、触控反馈、编队触控、省电模式、屏幕常亮、
 * 字体大小、左手模式、快捷键映射、导航路径等。
 *
 * 规则：零 engine/ 依赖，纯类型与常量定义。
 *
 * @module core/responsive/responsive.types
 */

// ═══════════════════════════════════════════════
// 模块A: 响应式断点体系 (RSP)
// ═══════════════════════════════════════════════

/** 7级断点枚举 — 从大到小 */
export enum Breakpoint {
  /** ≥1920px  4K / 大桌面 */
  DesktopL = 'desktop-l',
  /** ≥1280px  标准桌面 */
  Desktop = 'desktop',
  /** ≥1024px  大平板横屏 */
  TabletL = 'tablet-l',
  /** ≥768px   平板 */
  Tablet = 'tablet',
  /** ≥428px   大手机 / 小平板竖屏 */
  MobileL = 'mobile-l',
  /** ≥375px   标准手机 */
  Mobile = 'mobile',
  /** <375px   小屏手机 */
  MobileS = 'mobile-s',
}

/** 断点宽度阈值（px） */
export const BREAKPOINT_WIDTHS: Record<Breakpoint, number> = {
  [Breakpoint.DesktopL]: 1920,
  [Breakpoint.Desktop]: 1280,
  [Breakpoint.TabletL]: 1024,
  [Breakpoint.Tablet]: 768,
  [Breakpoint.MobileL]: 428,
  [Breakpoint.Mobile]: 375,
  [Breakpoint.MobileS]: 0,
};

/** PC端画布基准尺寸 */
export const CANVAS_BASE_WIDTH = 1280;
export const CANVAS_BASE_HEIGHT = 800;

/** 4K 缩放上限 */
export const SCALE_MAX = 2.0;

/** 留白处理策略 */
export enum WhitespaceStrategy {
  /** 居中 + 侧边装饰纹理 */
  CenterDecorated = 'center-decorated',
  /** 居中 + 背景填充 */
  CenterFilled = 'center-filled',
  /** 居中 + 侧边信息面板 */
  CenterInfoPanel = 'center-info-panel',
}

/** 画布缩放计算结果 */
export interface CanvasScaleResult {
  /** 缩放比例 */
  scale: number;
  /** 水平偏移（居中用） */
  offsetX: number;
  /** 垂直偏移（居中用） */
  offsetY: number;
  /** 留白策略 */
  whitespaceStrategy: WhitespaceStrategy;
  /** 实际画布宽度 */
  canvasWidth: number;
  /** 实际画布高度 */
  canvasHeight: number;
}

/** 响应式布局快照 */
export interface ResponsiveLayoutSnapshot {
  /** 当前断点 */
  breakpoint: Breakpoint;
  /** 视口宽度 */
  viewportWidth: number;
  /** 视口高度 */
  viewportHeight: number;
  /** 是否移动端 */
  isMobile: boolean;
  /** 是否平板 */
  isTablet: boolean;
  /** 是否桌面端 */
  isDesktop: boolean;
  /** 画布缩放结果 */
  canvasScale: CanvasScaleResult;
  /** 设备像素比 */
  devicePixelRatio: number;
  /** 屏幕方向 */
  orientation: 'portrait' | 'landscape';
}

// ═══════════════════════════════════════════════
// 模块B: 手机端布局 (RSP)
// ═══════════════════════════════════════════════

/** 手机端画布基准尺寸 */
export const MOBILE_CANVAS_WIDTH = 375;
export const MOBILE_CANVAS_HEIGHT = 667;

/** 手机端各区域高度 */
export const MOBILE_LAYOUT = {
  /** 资源栏高度 */
  resourceBarHeight: 48,
  /** 快捷图标条高度 */
  quickIconBarHeight: 36,
  /** 底部Tab栏高度（含安全区域） */
  tabBarHeight: 76,
  /** iPhone 安全区域底部 */
  safeAreaBottom: 34,
  /** 状态栏高度 */
  statusBarHeight: 44,
} as const;

/** 底部Tab项定义 */
export interface MobileTabItem {
  /** 唯一标识 */
  id: string;
  /** 显示标签 */
  label: string;
  /** 图标标识 */
  icon: string;
  /** 是否选中 */
  isActive: boolean;
}

/** 底部Tab栏状态 */
export interface MobileTabBarState {
  /** Tab项列表 */
  tabs: MobileTabItem[];
  /** 当前选中Tab的id */
  activeTabId: string;
  /** 安全区域高度 */
  safeAreaHeight: number;
}

/** 全屏面板状态 */
export interface FullScreenPanelState {
  /** 是否打开 */
  isOpen: boolean;
  /** 面板标识 */
  panelId: string;
  /** 面板标题 */
  title: string;
  /** 是否可左滑返回 */
  swipeBackEnabled: boolean;
}

/** Bottom Sheet状态 */
export interface BottomSheetState {
  /** 是否打开 */
  isOpen: boolean;
  /** Sheet标识 */
  sheetId: string;
  /** 内容高度（px） */
  contentHeight: number;
  /** 是否显示拖拽把手 */
  showHandle: boolean;
}

/** 手机端布局状态 */
export interface MobileLayoutState {
  /** 底部Tab栏 */
  tabBar: MobileTabBarState;
  /** 全屏面板 */
  fullScreenPanel: FullScreenPanelState;
  /** Bottom Sheet */
  bottomSheet: BottomSheetState;
  /** 快捷图标条高度 */
  quickIconBarHeight: number;
  /** 资源栏高度 */
  resourceBarHeight: number;
  /** 场景区可用高度 */
  sceneAreaHeight: number;
}

// ═══════════════════════════════════════════════
// 模块C: 触控交互 (ITR)
// ═══════════════════════════════════════════════

/** 手势类型枚举（7种） */
export enum GestureType {
  /** 点击：touchstart+touchend < 300ms, 移动 < 10px */
  Tap = 'tap',
  /** 长按：touchstart > 500ms, 移动 < 10px */
  LongPress = 'long-press',
  /** 拖拽：touchstart > 150ms, 移动 > 10px */
  Drag = 'drag',
  /** 双指缩放：pinch手势 */
  Pinch = 'pinch',
  /** 左滑：水平滑动 > 80px, 左方向 */
  SwipeLeft = 'swipe-left',
  /** 下拉：垂直下拉 > 60px */
  PullDown = 'pull-down',
  /** 双击：两次点击间隔 < 300ms */
  DoubleTap = 'double-tap',
}

/** 手势识别阈值常量 */
export const GESTURE_THRESHOLDS = {
  /** 点击最大持续时间 (ms) */
  tapMaxDuration: 300,
  /** 点击最大移动距离 (px) */
  tapMaxDistance: 10,
  /** 长按最小持续时间 (ms) */
  longPressMinDuration: 500,
  /** 长按最大移动距离 (px) */
  longPressMaxDistance: 10,
  /** 拖拽最小持续时间 (ms) */
  dragMinDuration: 150,
  /** 拖拽最小移动距离 (px) */
  dragMinDistance: 10,
  /** 左滑最小距离 (px) */
  swipeLeftMinDistance: 80,
  /** 下拉最小距离 (px) */
  pullDownMinDistance: 60,
  /** 双击最大间隔 (ms) */
  doubleTapMaxInterval: 300,
  /** 触控区域最小尺寸 (px) */
  minTouchTargetSize: 44,
  /** 防误触间隔 (ms) */
  antiBounceInterval: 300,
} as const;

/** 触控点信息 */
export interface TouchPoint {
  /** X坐标 */
  x: number;
  /** Y坐标 */
  y: number;
  /** 时间戳 (ms) */
  timestamp: number;
}

/** 手势事件数据 */
export interface GestureEvent {
  /** 手势类型 */
  type: GestureType;
  /** 起始触控点 */
  startPoint: TouchPoint;
  /** 当前/结束触控点 */
  endPoint: TouchPoint;
  /** 移动距离 */
  distance: number;
  /** 持续时间 (ms) */
  duration: number;
  /** 缩放比例（仅Pinch） */
  scale: number;
  /** 附加数据 */
  data?: Record<string, unknown>;
}

/** 触控反馈类型 */
export enum TouchFeedbackType {
  /** 轻震动 */
  LightVibration = 'light-vibration',
  /** 中震动 */
  MediumVibration = 'medium-vibration',
  /** 重震动 */
  HeavyVibration = 'heavy-vibration',
  /** 视觉缩放反馈 */
  VisualScale = 'visual-scale',
  /** 无反馈 */
  None = 'none',
}

/** 触控反馈配置 */
export interface TouchFeedbackConfig {
  /** 反馈类型 */
  type: TouchFeedbackType;
  /** 视觉缩放比例 */
  visualScaleValue: number;
  /** 是否启用震动 */
  vibrationEnabled: boolean;
  /** 防误触间隔 (ms) */
  antiBounceInterval: number;
}

/** 编队触控操作类型 */
export enum FormationTouchAction {
  /** 点击武将（选中） */
  SelectHero = 'select-hero',
  /** 点击空格（部署选中武将） */
  DeployToSlot = 'deploy-to-slot',
  /** 长按阵型格（移除武将） */
  RemoveFromSlot = 'remove-from-slot',
  /** 点击两个格子（互换位置） */
  SwapSlots = 'swap-slots',
}

/** 编队触控事件 */
export interface FormationTouchEvent {
  /** 操作类型 */
  action: FormationTouchAction;
  /** 武将ID（SelectHero/DeployToSlot时使用） */
  heroId?: string;
  /** 格子索引 */
  slotIndex?: number;
  /** 第二个格子索引（SwapSlots时使用） */
  secondSlotIndex?: number;
}

/** 桌面端交互类型 */
export enum DesktopInteractionType {
  /** 左键点击 */
  Click = 'click',
  /** 右键点击 */
  RightClick = 'right-click',
  /** 鼠标悬停 */
  Hover = 'hover',
  /** 拖拽 */
  Drag = 'drag',
  /** 滚轮 */
  Scroll = 'scroll',
  /** 长按 */
  LongPress = 'long-press',
  /** Shift+点击 */
  ShiftClick = 'shift-click',
}

/** 桌面端交互事件 */
export interface DesktopInteractionEvent {
  /** 交互类型 */
  type: DesktopInteractionType;
  /** 鼠标X坐标 */
  x: number;
  /** 鼠标Y坐标 */
  y: number;
  /** 附加数据 */
  data?: Record<string, unknown>;
}

// ═══════════════════════════════════════════════
// 模块D 已提取至 responsive-navigation.types
// ═══════════════════════════════════════════════
export type {
  PowerSaveConfig,
  MobileSettingsState,
} from './responsive-navigation.types';
export {
  PowerSaveLevel,
  FontSizeLevel,
  FONT_SIZE_MAP,
} from './responsive-navigation.types';
export type { PowerSaveState } from './responsive-navigation.types';
import type { PowerSaveState } from './responsive-navigation.types';

// ═══════════════════════════════════════════════
// 模块E & F 已提取至 responsive-navigation.types
// ═══════════════════════════════════════════════
export type {
  HotkeyDef,
  BreadcrumbItem,
  NavigationPathState,
} from './responsive-navigation.types';
export { DEFAULT_HOTKEYS } from './responsive-navigation.types';

import type { NavigationPathState } from './responsive-navigation.types';

// ═══════════════════════════════════════════════
// 通用：事件回调类型
// ═══════════════════════════════════════════════

/** 响应式布局变更回调 */
export type OnLayoutChange = (snapshot: ResponsiveLayoutSnapshot) => void;

/** 手势识别回调 */
export type OnGesture = (event: GestureEvent) => void;

/** 编队触控回调 */
export type OnFormationTouch = (event: FormationTouchEvent) => void;

/** 桌面端交互回调 */
export type OnDesktopInteraction = (event: DesktopInteractionEvent) => void;

/** 快捷键回调 */
export type OnHotkey = (action: string) => void;

/** 省电模式变更回调 */
export type OnPowerSaveChange = (state: PowerSaveState) => void;

/** 导航变更回调 */
export type OnNavigationChange = (state: NavigationPathState) => void;
