/**
 * 手机端布局管理器
 *
 * 职责：
 * - #4  手机端画布（375×667px基准 + 资源栏48px + 快捷图标36px + 底部Tab76px）
 * - #5  底部Tab导航（固定底部 + 安全区域76px）
 * - #6  全屏面板模式（全屏展示 + 左滑返回 + 顶部关闭按钮）
 * - #7  Bottom Sheet交互（底部弹出Sheet）
 * - #17 手机端导航（底部Tab + 快捷图标 + 全屏面板切换）
 * - #18 导航路径优化（面包屑 + 返回按钮 + 深层页面可达性）
 *
 * @module engine/responsive/MobileLayoutManager
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';

import {
  Breakpoint, MOBILE_CANVAS_WIDTH, MOBILE_CANVAS_HEIGHT, MOBILE_LAYOUT,
  type MobileTabItem, type MobileTabBarState, type FullScreenPanelState,
  type BottomSheetState, type MobileLayoutState, type BreadcrumbItem,
  type NavigationPathState, type OnNavigationChange,
} from '../../core/responsive/responsive.types';
import type { ResponsiveLayoutManager } from './ResponsiveLayoutManager';

const DEFAULT_TABS: MobileTabItem[] = [
  { id: 'map', label: '地图', icon: 'map', isActive: true },
  { id: 'heroes', label: '武将', icon: 'hero', isActive: false },
  { id: 'buildings', label: '建筑', icon: 'building', isActive: false },
  { id: 'campaign', label: '关卡', icon: 'sword', isActive: false },
  { id: 'more', label: '更多', icon: 'menu', isActive: false },
];
const MAX_PANEL_DEPTH = 5;

/**
 * 手机端布局管理器 — 底部Tab、全屏面板、Bottom Sheet、导航路径。
 */
export class MobileLayoutManager implements ISubsystem {
  private readonly _rm: ResponsiveLayoutManager;
  private _tabBar: MobileTabBarState;
  private _panel: FullScreenPanelState;
  private _sheet: BottomSheetState;
  private _panelStack: Array<{ panelId: string; title: string }> = [];
  private _breadcrumbs: BreadcrumbItem[] = [{ path: 'root', label: '首页', clickable: false }];
  private readonly _navListeners: Set<OnNavigationChange> = new Set();

  constructor(responsiveManager: ResponsiveLayoutManager) {
    this._rm = responsiveManager;
    this._tabBar = { tabs: DEFAULT_TABS.map((t) => ({ ...t })), activeTabId: 'map', safeAreaHeight: MOBILE_LAYOUT.tabBarHeight };
    this._panel = { isOpen: false, panelId: '', title: '', swipeBackEnabled: true };
    this._sheet = { isOpen: false, sheetId: '', contentHeight: 0, showHandle: true };
  }

  get isMobileMode(): boolean { return this._rm.isMobile; }
  get tabBar(): MobileTabBarState { return { ...this._tabBar, tabs: this._tabBar.tabs.map((t) => ({ ...t })) }; }
  get fullScreenPanel(): FullScreenPanelState { return { ...this._panel }; }
  get bottomSheet(): BottomSheetState { return { ...this._sheet }; }
  get navigationPath(): NavigationPathState {
    const depth = this._panelStack.length;
    return { breadcrumbs: this._breadcrumbs.map((b) => ({ ...b })), depth, maxDepth: MAX_PANEL_DEPTH, canGoBack: this._panelStack.length > 0 || this._panel.isOpen };
  }

  // ── #4 手机端画布尺寸 ──

  calculateMobileLayout(vw = MOBILE_CANVAS_WIDTH, vh = MOBILE_CANVAS_HEIGHT): MobileLayoutState {
    const sceneAreaHeight = Math.max(0, vh - MOBILE_LAYOUT.resourceBarHeight - MOBILE_LAYOUT.quickIconBarHeight - MOBILE_LAYOUT.tabBarHeight);
    return {
      tabBar: this._tabBar, fullScreenPanel: this._panel, bottomSheet: this._sheet,
      quickIconBarHeight: MOBILE_LAYOUT.quickIconBarHeight, resourceBarHeight: MOBILE_LAYOUT.resourceBarHeight, sceneAreaHeight,
    };
  }

  // ── #5 底部Tab导航 ──

  switchTab(tabId: string): boolean {
    if (!this._tabBar.tabs.find((t) => t.id === tabId)) return false;
    this._tabBar.tabs = this._tabBar.tabs.map((t) => ({ ...t, isActive: t.id === tabId }));
    this._tabBar.activeTabId = tabId;
    this._closePanel(); this._closeSheet();
    return true;
  }

  getActiveTabId(): string { return this._tabBar.activeTabId; }

  setTabs(tabs: MobileTabItem[]): void {
    this._tabBar.tabs = tabs.map((t) => ({ ...t }));
    this._tabBar.activeTabId = tabs.find((t) => t.isActive)?.id ?? tabs[0]?.id ?? '';
  }

  // ── #6 全屏面板模式 ──

  openFullScreenPanel(panelId: string, title: string, swipeBackEnabled = true): boolean {
    // 总深度 = 栈深度 + 当前面板（如果打开）
    const totalDepth = this._panelStack.length + (this._panel.isOpen ? 1 : 0);
    if (totalDepth >= MAX_PANEL_DEPTH) return false;
    if (this._panel.isOpen) this._panelStack.push({ panelId: this._panel.panelId, title: this._panel.title });
    this._panel = { isOpen: true, panelId, title, swipeBackEnabled };
    this._updateBreadcrumbs();
    return true;
  }

  closeFullScreenPanel(): FullScreenPanelState | null {
    if (this._panelStack.length > 0) {
      const prev = this._panelStack.pop()!;
      this._panel = { isOpen: true, panelId: prev.panelId, title: prev.title, swipeBackEnabled: true };
      this._updateBreadcrumbs();
      return { ...this._panel };
    }
    this._closePanel(); this._updateBreadcrumbs();
    return null;
  }

  handleSwipeBack(): boolean {
    if (!this._panel.isOpen || !this._panel.swipeBackEnabled) return false;
    return this.closeFullScreenPanel() !== null || !this._panel.isOpen;
  }

  // ── #7 Bottom Sheet ──

  openBottomSheet(sheetId: string, contentHeight: number, showHandle = true): void {
    this._sheet = { isOpen: true, sheetId, contentHeight, showHandle };
  }

  closeBottomSheet(): void { this._closeSheet(); }

  updateBottomSheetHeight(contentHeight: number): void {
    if (this._sheet.isOpen) this._sheet.contentHeight = contentHeight;
  }

  // ── #18 导航路径 ──

  getBreadcrumbs(): BreadcrumbItem[] { return this._breadcrumbs.map((b) => ({ ...b })); }

  navigateToBreadcrumb(targetPath: string): boolean {
    const idx = this._breadcrumbs.findIndex((b) => b.path === targetPath);
    if (idx < 0) return false;
    // root(idx=0) → 关闭所有; stack项(idx>=1) → 弹出到idx-1, 设为当前面板
    if (idx === 0) {
      this._panelStack = [];
      this._closePanel();
    } else {
      // 目标在stack中(idx-1位置), 弹出到idx位置(不含目标), 目标变为当前面板
      const targetStackIdx = idx - 1;
      const targetPanel = this._panelStack[targetStackIdx];
      this._panelStack = this._panelStack.slice(0, targetStackIdx);
      this._panel = { isOpen: true, panelId: targetPanel.panelId, title: targetPanel.title, swipeBackEnabled: true };
    }
    this._updateBreadcrumbs();
    return true;
  }

  goBack(): boolean { return this.handleSwipeBack(); }

  // ── 事件监听 ──

  onNavigationChange(listener: OnNavigationChange): () => void { this._navListeners.add(listener); return () => this._navListeners.delete(listener); }
  clearListeners(): void { this._navListeners.clear(); }

  // ── ISubsystem 接口 ──

  readonly name = 'mobile-layout';
  private _initialized = false;

  init(_deps: ISystemDeps): void { this._initialized = true; }
  update(_dt: number): void { /* 手机端布局由事件驱动，无需帧更新 */ }
  getState(): NavigationPathState { return this.navigationPath; }
  get isInitialized(): boolean { return this._initialized; }

  /** 重置为默认状态 */
  reset(): void {
    this._tabBar = { tabs: DEFAULT_TABS.map((t) => ({ ...t })), activeTabId: 'map', safeAreaHeight: MOBILE_LAYOUT.tabBarHeight };
    this._panel = { isOpen: false, panelId: '', title: '', swipeBackEnabled: true };
    this._sheet = { isOpen: false, sheetId: '', contentHeight: 0, showHandle: true };
    this._panelStack = [];
    this._breadcrumbs = [{ path: 'root', label: '首页', clickable: false }];
    this._initialized = false;
    this.clearListeners();
  }

  // ── 私有方法 ──

  private _closePanel(): void { this._panel = { isOpen: false, panelId: '', title: '', swipeBackEnabled: true }; }
  private _closeSheet(): void { this._sheet = { isOpen: false, sheetId: '', contentHeight: 0, showHandle: true }; }

  private _updateBreadcrumbs(): void {
    const crumbs: BreadcrumbItem[] = [{ path: 'root', label: '首页', clickable: true }];
    for (let i = 0; i < this._panelStack.length; i++) {
      crumbs.push({ path: this._panelStack[i].panelId, label: this._panelStack[i].title, clickable: true });
    }
    if (this._panel.isOpen) crumbs.push({ path: this._panel.panelId, label: this._panel.title, clickable: false });
    this._breadcrumbs = crumbs;
    const navState: NavigationPathState = {
      breadcrumbs: this._breadcrumbs.map((b) => ({ ...b })), depth: this._panelStack.length,
      maxDepth: MAX_PANEL_DEPTH, canGoBack: this._panelStack.length > 0 || this._panel.isOpen,
    };
    for (const listener of this._navListeners) listener(navState);
  }
}
