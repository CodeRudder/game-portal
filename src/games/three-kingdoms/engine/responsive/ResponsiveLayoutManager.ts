/**
 * 响应式布局管理器
 *
 * 职责：
 * - #1 7级断点体系检测与切换
 * - #2 画布缩放算法（PC/平板等比缩放 + 移动端流式布局 + 4K上限）
 * - #3 留白区域处理（居中+侧边装饰+背景填充+信息面板）
 * - #4 手机端画布基准 + 区域尺寸计算
 * - #5 底部Tab导航管理
 * - #6 全屏面板模式
 * - #7 Bottom Sheet交互
 * - #12 左手模式布局镜像
 * - #14 字体大小三档切换
 * - #17 手机端导航
 * - #18 面包屑导航
 *
 * @module engine/responsive/ResponsiveLayoutManager
 */

import {
  Breakpoint, BREAKPOINT_WIDTHS, CANVAS_BASE_WIDTH, CANVAS_BASE_HEIGHT,
  SCALE_MAX, WhitespaceStrategy, MOBILE_LAYOUT, FontSizeLevel, FONT_SIZE_MAP,
  type CanvasScaleResult, type ResponsiveLayoutSnapshot, type OnLayoutChange,
  type MobileTabItem, type MobileTabBarState, type FullScreenPanelState,
  type BottomSheetState, type MobileLayoutState, type BreadcrumbItem,
  type NavigationPathState, type OnNavigationChange,
} from '../../core/responsive/responsive.types';

const BREAKPOINT_ORDER: Breakpoint[] = [
  Breakpoint.DesktopL, Breakpoint.Desktop, Breakpoint.TabletL,
  Breakpoint.Tablet, Breakpoint.MobileL, Breakpoint.Mobile, Breakpoint.MobileS,
];
const MOBILE_BPS = new Set([Breakpoint.MobileL, Breakpoint.Mobile, Breakpoint.MobileS]);
const TABLET_BPS = new Set([Breakpoint.TabletL, Breakpoint.Tablet]);
const DESKTOP_BPS = new Set([Breakpoint.DesktopL, Breakpoint.Desktop]);
const MAX_NAV_DEPTH = 10;

const DEFAULT_TABS: MobileTabItem[] = [
  { id: 'home', label: '主城', icon: 'castle', isActive: true },
  { id: 'heroes', label: '武将', icon: 'sword', isActive: false },
  { id: 'map', label: '地图', icon: 'map', isActive: false },
  { id: 'campaign', label: '关卡', icon: 'flag', isActive: false },
  { id: 'more', label: '更多', icon: 'menu', isActive: false },
];

/** 响应式布局管理器 — 断点检测、画布缩放、留白处理、手机端布局、导航。 */
export class ResponsiveLayoutManager {
  private _bp: Breakpoint = Breakpoint.Desktop;
  private _vw: number = CANVAS_BASE_WIDTH;
  private _vh: number = CANVAS_BASE_HEIGHT;
  private _dpr: number = 1;
  private _orient: 'portrait' | 'landscape' = 'landscape';
  private _leftHand: boolean = false;
  private _fontSize: FontSizeLevel = FontSizeLevel.Medium;
  private _tabBar: MobileTabBarState;
  private _panel: FullScreenPanelState;
  private _sheet: BottomSheetState;
  private _breadcrumbs: BreadcrumbItem[];
  private _navDepth: number = 0;
  private readonly _layoutListeners: Set<OnLayoutChange> = new Set();
  private readonly _navListeners: Set<OnNavigationChange> = new Set();

  constructor() {
    this._tabBar = { tabs: DEFAULT_TABS.map((t) => ({ ...t })), activeTabId: 'home', safeAreaHeight: MOBILE_LAYOUT.tabBarHeight };
    this._panel = { isOpen: false, panelId: '', title: '', swipeBackEnabled: true };
    this._sheet = { isOpen: false, sheetId: '', contentHeight: 0, showHandle: true };
    this._breadcrumbs = [{ path: '/', label: '主城', clickable: false }];
  }

  // ── 公共属性 ──
  get currentBreakpoint(): Breakpoint { return this._bp; }
  get viewportWidth(): number { return this._vw; }
  get viewportHeight(): number { return this._vh; }
  get isMobile(): boolean { return MOBILE_BPS.has(this._bp); }
  get isTablet(): boolean { return TABLET_BPS.has(this._bp); }
  get isDesktop(): boolean { return DESKTOP_BPS.has(this._bp); }
  get leftHandMode(): boolean { return this._leftHand; }
  get fontSize(): FontSizeLevel { return this._fontSize; }
  get fontSizePx(): number { return FONT_SIZE_MAP[this._fontSize]; }
  get orientation(): 'portrait' | 'landscape' { return this._orient; }
  get tabBar(): MobileTabBarState { return this._tabBar; }
  get fullScreenPanel(): FullScreenPanelState { return this._panel; }
  get bottomSheet(): BottomSheetState { return this._sheet; }
  get breadcrumbs(): BreadcrumbItem[] { return [...this._breadcrumbs]; }
  get navigationDepth(): number { return this._navDepth; }

  // ── #1 断点检测 ──

  detectBreakpoint(width: number): Breakpoint {
    for (const bp of BREAKPOINT_ORDER) { if (width >= BREAKPOINT_WIDTHS[bp]) return bp; }
    return Breakpoint.MobileS;
  }

  updateViewport(width: number, height: number, devicePixelRatio = 1): boolean {
    const prev = this._bp;
    this._vw = width; this._vh = height; this._dpr = devicePixelRatio;
    this._orient = width >= height ? 'landscape' : 'portrait';
    this._bp = this.detectBreakpoint(width);
    const changed = prev !== this._bp;
    if (changed) this._notifyLayout();
    return changed;
  }

  // ── #2 画布缩放算法 ──

  calculateCanvasScale(vw: number, vh: number, breakpoint?: Breakpoint): CanvasScaleResult {
    const bp = breakpoint ?? this.detectBreakpoint(vw);
    if (MOBILE_BPS.has(bp)) {
      return { scale: 1, offsetX: 0, offsetY: 0, whitespaceStrategy: WhitespaceStrategy.CenterFilled, canvasWidth: vw, canvasHeight: vh };
    }
    const rawScale = Math.min(vw / CANVAS_BASE_WIDTH, vh / CANVAS_BASE_HEIGHT);
    const scale = Math.min(rawScale, SCALE_MAX);
    const cw = CANVAS_BASE_WIDTH * scale, ch = CANVAS_BASE_HEIGHT * scale;
    return {
      scale, offsetX: Math.max(0, (vw - cw) / 2), offsetY: Math.max(0, (vh - ch) / 2),
      whitespaceStrategy: DESKTOP_BPS.has(bp) ? WhitespaceStrategy.CenterDecorated : WhitespaceStrategy.CenterFilled,
      canvasWidth: cw, canvasHeight: ch,
    };
  }

  // ── #3 留白区域处理 ──

  calculateWhitespace(viewportWidth: number, canvasWidth: number): { leftWidth: number; rightWidth: number; totalWidth: number } {
    const totalWidth = Math.max(0, viewportWidth - canvasWidth);
    return { leftWidth: totalWidth / 2, rightWidth: totalWidth - totalWidth / 2, totalWidth };
  }

  applyLeftHandMirror(ws: { leftWidth: number; rightWidth: number; totalWidth: number }): typeof ws {
    if (!this._leftHand) return ws;
    return { leftWidth: ws.rightWidth, rightWidth: ws.leftWidth, totalWidth: ws.totalWidth };
  }

  // ── #4 手机端画布区域计算 ──

  calculateMobileSceneHeight(viewportHeight?: number): number {
    const h = viewportHeight ?? 667;
    return Math.max(0, h - MOBILE_LAYOUT.resourceBarHeight - MOBILE_LAYOUT.quickIconBarHeight - MOBILE_LAYOUT.tabBarHeight);
  }

  getMobileLayoutState(viewportHeight?: number): MobileLayoutState {
    return {
      tabBar: { ...this._tabBar }, fullScreenPanel: { ...this._panel }, bottomSheet: { ...this._sheet },
      quickIconBarHeight: MOBILE_LAYOUT.quickIconBarHeight, resourceBarHeight: MOBILE_LAYOUT.resourceBarHeight,
      sceneAreaHeight: this.calculateMobileSceneHeight(viewportHeight),
    };
  }

  // ── #5 底部Tab导航 ──

  switchTab(tabId: string): boolean {
    if (!this._tabBar.tabs.find((t) => t.id === tabId)) return false;
    this._tabBar.tabs = this._tabBar.tabs.map((t) => ({ ...t, isActive: t.id === tabId }));
    this._tabBar.activeTabId = tabId;
    this._notifyLayout();
    return true;
  }

  setTabs(tabs: MobileTabItem[]): void {
    this._tabBar = {
      tabs: tabs.map((t) => ({ ...t })),
      activeTabId: tabs.find((t) => t.isActive)?.id ?? tabs[0]?.id ?? '',
      safeAreaHeight: MOBILE_LAYOUT.tabBarHeight,
    };
    this._notifyLayout();
  }

  // ── #6 全屏面板模式 ──

  openFullScreenPanel(panelId: string, title: string, swipeBack = true): void {
    this._panel = { isOpen: true, panelId, title, swipeBackEnabled: swipeBack };
    this._navDepth++;
    this._notifyLayout();
  }

  closeFullScreenPanel(): void {
    this._panel = { isOpen: false, panelId: '', title: '', swipeBackEnabled: true };
    this._navDepth = Math.max(0, this._navDepth - 1);
    this._notifyLayout();
  }

  // ── #7 Bottom Sheet ──

  openBottomSheet(sheetId: string, contentHeight: number, showHandle = true): void {
    this._sheet = { isOpen: true, sheetId, contentHeight, showHandle };
    this._notifyLayout();
  }

  closeBottomSheet(): void {
    this._sheet = { isOpen: false, sheetId: '', contentHeight: 0, showHandle: true };
    this._notifyLayout();
  }

  // ── #12 左手模式 ──

  setLeftHandMode(enabled: boolean): void { this._leftHand = enabled; this._notifyLayout(); }

  // ── #14 字体大小 ──

  setFontSize(level: FontSizeLevel): void { this._fontSize = level; this._notifyLayout(); }

  // ── #18 面包屑导航 ──

  pushBreadcrumb(path: string, label: string): void {
    if (this._navDepth >= MAX_NAV_DEPTH) return;
    if (this._breadcrumbs.length > 0) {
      this._breadcrumbs[this._breadcrumbs.length - 1] = { ...this._breadcrumbs[this._breadcrumbs.length - 1], clickable: true };
    }
    this._breadcrumbs.push({ path, label, clickable: false });
    this._navDepth++;
    this._notifyNav();
  }

  popToBreadcrumb(index: number): void {
    if (index < 0 || index >= this._breadcrumbs.length) return;
    this._breadcrumbs = this._breadcrumbs.slice(0, index + 1);
    this._breadcrumbs[this._breadcrumbs.length - 1].clickable = false;
    this._navDepth = this._breadcrumbs.length - 1;
    this._notifyNav();
  }

  getNavigationState(): NavigationPathState {
    return { breadcrumbs: [...this._breadcrumbs], depth: this._navDepth, maxDepth: MAX_NAV_DEPTH, canGoBack: this._navDepth > 0 };
  }

  navigateBack(): boolean {
    if (this._navDepth <= 0) return false;
    if (this._breadcrumbs.length < 2) return false;
    if (this._panel.isOpen) { this.closeFullScreenPanel(); return true; }
    this.popToBreadcrumb(this._breadcrumbs.length - 2);
    return true;
  }

  // ── 快照 ──

  getSnapshot(): ResponsiveLayoutSnapshot {
    return {
      breakpoint: this._bp, viewportWidth: this._vw, viewportHeight: this._vh,
      isMobile: this.isMobile, isTablet: this.isTablet, isDesktop: this.isDesktop,
      canvasScale: this.calculateCanvasScale(this._vw, this._vh, this._bp),
      devicePixelRatio: this._dpr, orientation: this._orient,
    };
  }

  // ── 事件监听 ──

  onLayoutChange(listener: OnLayoutChange): () => void { this._layoutListeners.add(listener); return () => this._layoutListeners.delete(listener); }
  onNavigationChange(listener: OnNavigationChange): () => void { this._navListeners.add(listener); return () => this._navListeners.delete(listener); }
  clearListeners(): void { this._layoutListeners.clear(); this._navListeners.clear(); }

  // ── 静态工具 ──

  static isMobileBreakpoint(bp: Breakpoint): boolean { return MOBILE_BPS.has(bp); }
  static isTabletBreakpoint(bp: Breakpoint): boolean { return TABLET_BPS.has(bp); }
  static isDesktopBreakpoint(bp: Breakpoint): boolean { return DESKTOP_BPS.has(bp); }
  static getAllBreakpoints(): Breakpoint[] { return [...BREAKPOINT_ORDER]; }

  // ── 私有方法 ──

  private _notifyLayout(): void { const s = this.getSnapshot(); for (const l of this._layoutListeners) l(s); }
  private _notifyNav(): void { const s = this.getNavigationState(); for (const l of this._navListeners) l(s); }
}
