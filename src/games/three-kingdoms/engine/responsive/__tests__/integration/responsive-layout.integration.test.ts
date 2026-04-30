/**
 * §1 竖屏布局 — 集成测试
 *
 * 覆盖：7级断点、画布缩放、手机端画布、底部Tab、面板组件适配、横竖屏切换
 *
 * @module engine/responsive/__tests__/integration/responsive-layout
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ResponsiveLayoutManager } from '../../ResponsiveLayoutManager';
import {
  Breakpoint,
  BREAKPOINT_WIDTHS,
  CANVAS_BASE_WIDTH,
  CANVAS_BASE_HEIGHT,
  SCALE_MAX,
  WhitespaceStrategy,
  MOBILE_LAYOUT,
  FontSizeLevel,
} from '../../../../core/responsive/responsive.types';

// ═══════════════════════════════════════════════
// §1.1 七级断点体系
// ═══════════════════════════════════════════════
describe('§1 竖屏布局', () => {
  let manager: ResponsiveLayoutManager;

  beforeEach(() => {
    manager = new ResponsiveLayoutManager();
  });

  describe('§1.1 七级断点体系', () => {
    it('应正确检测 DesktopL 断点 (≥1920px)', () => {
      expect(manager.detectBreakpoint(1920)).toBe(Breakpoint.DesktopL);
      expect(manager.detectBreakpoint(2560)).toBe(Breakpoint.DesktopL);
    });

    it('应正确检测 Desktop 断点 (≥1280px)', () => {
      expect(manager.detectBreakpoint(1280)).toBe(Breakpoint.Desktop);
      expect(manager.detectBreakpoint(1500)).toBe(Breakpoint.Desktop);
    });

    it('应正确检测 TabletL 断点 (≥1024px)', () => {
      expect(manager.detectBreakpoint(1024)).toBe(Breakpoint.TabletL);
      expect(manager.detectBreakpoint(1100)).toBe(Breakpoint.TabletL);
    });

    it('应正确检测 Tablet 断点 (≥768px)', () => {
      expect(manager.detectBreakpoint(768)).toBe(Breakpoint.Tablet);
      expect(manager.detectBreakpoint(900)).toBe(Breakpoint.Tablet);
    });

    it('应正确检测 MobileL 断点 (≥428px)', () => {
      expect(manager.detectBreakpoint(428)).toBe(Breakpoint.MobileL);
      expect(manager.detectBreakpoint(500)).toBe(Breakpoint.MobileL);
    });

    it('应正确检测 Mobile 断点 (≥375px)', () => {
      expect(manager.detectBreakpoint(375)).toBe(Breakpoint.Mobile);
      expect(manager.detectBreakpoint(400)).toBe(Breakpoint.Mobile);
    });

    it('应正确检测 MobileS 断点 (<375px)', () => {
      expect(manager.detectBreakpoint(320)).toBe(Breakpoint.MobileS);
      expect(manager.detectBreakpoint(374)).toBe(Breakpoint.MobileS);
      expect(manager.detectBreakpoint(0)).toBe(Breakpoint.MobileS);
    });

    it('updateViewport 应在断点变化时返回 true', () => {
      expect(manager.updateViewport(1920, 1080)).toBe(true); // Desktop → DesktopL
      expect(manager.updateViewport(375, 667)).toBe(true);   // DesktopL → Mobile
    });

    it('updateViewport 在同断点内应返回 false', () => {
      manager.updateViewport(1920, 1080);
      expect(manager.updateViewport(2000, 1200)).toBe(false); // 仍在 DesktopL
    });

    it('静态方法 isMobileBreakpoint/isTabletBreakpoint/isDesktopBreakpoint 应正确分类', () => {
      expect(ResponsiveLayoutManager.isMobileBreakpoint(Breakpoint.Mobile)).toBe(true);
      expect(ResponsiveLayoutManager.isMobileBreakpoint(Breakpoint.MobileL)).toBe(true);
      expect(ResponsiveLayoutManager.isMobileBreakpoint(Breakpoint.MobileS)).toBe(true);
      expect(ResponsiveLayoutManager.isTabletBreakpoint(Breakpoint.Tablet)).toBe(true);
      expect(ResponsiveLayoutManager.isDesktopBreakpoint(Breakpoint.Desktop)).toBe(true);
    });

    it('getAllBreakpoints 应返回7个断点，从大到小排列', () => {
      const all = ResponsiveLayoutManager.getAllBreakpoints();
      expect(all).toHaveLength(7);
      expect(all[0]).toBe(Breakpoint.DesktopL);
      expect(all[6]).toBe(Breakpoint.MobileS);
    });
  });

  // ═══════════════════════════════════════════════
  // §1.2 画布缩放算法
  // ═══════════════════════════════════════════════
  describe('§1.2 画布缩放算法', () => {
    it('桌面端应等比缩放且不超过 SCALE_MAX', () => {
      const result = manager.calculateCanvasScale(3840, 2160); // 4K
      expect(result.scale).toBeLessThanOrEqual(SCALE_MAX);
      expect(result.scale).toBe(SCALE_MAX);
    });

    it('桌面端应使用 CenterDecorated 留白策略', () => {
      const result = manager.calculateCanvasScale(1920, 1080, Breakpoint.DesktopL);
      expect(result.whitespaceStrategy).toBe(WhitespaceStrategy.CenterDecorated);
    });

    it('平板端应使用 CenterFilled 留白策略', () => {
      const result = manager.calculateCanvasScale(1024, 768, Breakpoint.TabletL);
      expect(result.whitespaceStrategy).toBe(WhitespaceStrategy.CenterFilled);
    });

    it('移动端 scale=1，画布等于视口宽度', () => {
      const result = manager.calculateCanvasScale(375, 667, Breakpoint.Mobile);
      expect(result.scale).toBe(1);
      expect(result.offsetX).toBe(0);
      expect(result.offsetY).toBe(0);
      expect(result.canvasWidth).toBe(375);
      expect(result.canvasHeight).toBe(667);
    });

    it('缩放后 offsetX/offsetY 应居中画布', () => {
      const result = manager.calculateCanvasScale(1920, 1080, Breakpoint.Desktop);
      expect(result.offsetX).toBeGreaterThanOrEqual(0);
      expect(result.offsetY).toBeGreaterThanOrEqual(0);
      // 居中：offset = (viewport - canvas) / 2
      const expectedCW = CANVAS_BASE_WIDTH * result.scale;
      expect(result.canvasWidth).toBeCloseTo(expectedCW, 1);
    });
  });

  // ═══════════════════════════════════════════════
  // §1.3 留白区域处理
  // ═══════════════════════════════════════════════
  describe('§1.3 留白区域处理', () => {
    it('calculateWhitespace 应正确计算左右留白', () => {
      const ws = manager.calculateWhitespace(1920, 1280);
      expect(ws.totalWidth).toBe(640);
      expect(ws.leftWidth).toBe(320);
      expect(ws.rightWidth).toBe(320);
    });

    it('画布等于视口时留白为0', () => {
      const ws = manager.calculateWhitespace(375, 375);
      expect(ws.totalWidth).toBe(0);
      expect(ws.leftWidth).toBe(0);
      expect(ws.rightWidth).toBe(0);
    });

    it('左手模式应镜像左右留白', () => {
      manager.setLeftHandMode(true);
      const ws = manager.applyLeftHandMirror({ leftWidth: 100, rightWidth: 200, totalWidth: 300 });
      expect(ws.leftWidth).toBe(200);
      expect(ws.rightWidth).toBe(100);
    });

    it('非左手模式不应改变留白', () => {
      const original = { leftWidth: 100, rightWidth: 200, totalWidth: 300 };
      const result = manager.applyLeftHandMirror(original);
      expect(result).toEqual(original);
    });
  });

  // ═══════════════════════════════════════════════
  // §1.4 手机端画布区域计算
  // ═══════════════════════════════════════════════
  describe('§1.4 手机端画布区域计算', () => {
    it('calculateMobileSceneHeight 应扣除资源栏+快捷图标+Tab栏', () => {
      const vh = 667;
      const expected = vh - MOBILE_LAYOUT.resourceBarHeight - MOBILE_LAYOUT.quickIconBarHeight - MOBILE_LAYOUT.tabBarHeight;
      expect(manager.calculateMobileSceneHeight(vh)).toBe(expected);
    });

    it('getMobileLayoutState 应返回完整的手机端布局状态', () => {
      const state = manager.getMobileLayoutState(812);
      expect(state.tabBar).toBeDefined();
      expect(state.fullScreenPanel).toBeDefined();
      expect(state.bottomSheet).toBeDefined();
      expect(state.quickIconBarHeight).toBe(MOBILE_LAYOUT.quickIconBarHeight);
      expect(state.resourceBarHeight).toBe(MOBILE_LAYOUT.resourceBarHeight);
      expect(state.sceneAreaHeight).toBeGreaterThan(0);
    });

    it('场景高度不应为负数', () => {
      expect(manager.calculateMobileSceneHeight(100)).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════
  // §1.5 底部Tab导航
  // ═══════════════════════════════════════════════
  describe('§1.5 底部Tab导航', () => {
    it('默认应包含5个Tab，activeTabId=home', () => {
      const tabBar = manager.tabBar;
      expect(tabBar.tabs).toHaveLength(5);
      expect(tabBar.activeTabId).toBe('home');
    });

    it('switchTab 应切换活动Tab并通知监听器', () => {
      const listener = vi.fn();
      manager.onLayoutChange(listener);
      manager.switchTab('heroes');
      expect(manager.tabBar.activeTabId).toBe('heroes');
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('switchTab 传入不存在的tabId 应返回 false', () => {
      expect(manager.switchTab('nonexistent')).toBe(false);
    });

    it('setTabs 应替换整个Tab列表', () => {
      manager.setTabs([
        { id: 'a', label: 'A', icon: 'icon-a', isActive: true },
        { id: 'b', label: 'B', icon: 'icon-b', isActive: false },
      ]);
      expect(manager.tabBar.tabs).toHaveLength(2);
      expect(manager.tabBar.activeTabId).toBe('a');
    });
  });

  // ═══════════════════════════════════════════════
  // §1.6 面板组件适配（全屏面板 + Bottom Sheet）
  // ═══════════════════════════════════════════════
  describe('§1.6 面板组件适配', () => {
    it('openFullScreenPanel 应打开面板并增加导航深度', () => {
      manager.openFullScreenPanel('hero-detail', '武将详情');
      expect(manager.fullScreenPanel.isOpen).toBe(true);
      expect(manager.fullScreenPanel.panelId).toBe('hero-detail');
      expect(manager.fullScreenPanel.title).toBe('武将详情');
      expect(manager.fullScreenPanel.swipeBackEnabled).toBe(true);
      expect(manager.navigationDepth).toBe(1);
    });

    it('closeFullScreenPanel 应关闭面板并减少导航深度', () => {
      manager.openFullScreenPanel('hero-detail', '武将详情');
      manager.closeFullScreenPanel();
      expect(manager.fullScreenPanel.isOpen).toBe(false);
      expect(manager.navigationDepth).toBe(0);
    });

    it('openBottomSheet 应设置内容高度和把手', () => {
      manager.openBottomSheet('formation-sheet', 400);
      expect(manager.bottomSheet.isOpen).toBe(true);
      expect(manager.bottomSheet.sheetId).toBe('formation-sheet');
      expect(manager.bottomSheet.contentHeight).toBe(400);
      expect(manager.bottomSheet.showHandle).toBe(true);
    });

    it('closeBottomSheet 应重置所有状态', () => {
      manager.openBottomSheet('sheet', 300, false);
      manager.closeBottomSheet();
      expect(manager.bottomSheet.isOpen).toBe(false);
      expect(manager.bottomSheet.contentHeight).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════
  // §1.7 横竖屏切换
  // ═══════════════════════════════════════════════
  describe('§1.7 横竖屏切换', () => {
    it('竖屏 (w<h) 应设置 orientation=portrait', () => {
      manager.updateViewport(375, 812);
      expect(manager.orientation).toBe('portrait');
    });

    it('横屏 (w≥h) 应设置 orientation=landscape', () => {
      manager.updateViewport(812, 375);
      expect(manager.orientation).toBe('landscape');
    });

    it('横竖屏切换应触发布局变更通知', () => {
      const listener = vi.fn();
      manager.onLayoutChange(listener);
      manager.updateViewport(375, 812); // portrait
      manager.updateViewport(812, 375); // landscape
      // 至少一次断点变化触发通知
      expect(listener.mock.calls.length).toBeGreaterThanOrEqual(1);
    });

    it('getSnapshot 应包含完整的布局快照', () => {
      manager.updateViewport(375, 812, 3);
      const snap = manager.getSnapshot();
      expect(snap.breakpoint).toBe(Breakpoint.Mobile);
      expect(snap.viewportWidth).toBe(375);
      expect(snap.viewportHeight).toBe(812);
      expect(snap.isMobile).toBe(true);
      expect(snap.devicePixelRatio).toBe(3);
      expect(snap.orientation).toBe('portrait');
      expect(snap.canvasScale).toBeDefined();
    });
  });

  // ═══════════════════════════════════════════════
  // §1.8 字体大小 & ISubsystem
  // ═══════════════════════════════════════════════
  describe('§1.8 字体大小与子系统接口', () => {
    it('setFontSize 应更新字体档位并通知监听器', () => {
      const listener = vi.fn();
      manager.onLayoutChange(listener);
      manager.setFontSize(FontSizeLevel.Large);
      expect(manager.fontSize).toBe(FontSizeLevel.Large);
      expect(listener).toHaveBeenCalled();
    });

    it('init/getState/isInitialized 应满足 ISubsystem 接口', () => {
      expect(manager.isInitialized).toBe(false);
      manager.init({} as Record<string, unknown>);
      expect(manager.isInitialized).toBe(true);
      const state = manager.getState();
      expect(state.breakpoint).toBeDefined();
    });

    it('reset 应恢复所有默认状态', () => {
      manager.updateViewport(375, 812);
      manager.setLeftHandMode(true);
      manager.setFontSize(FontSizeLevel.Large);
      manager.openFullScreenPanel('test', 'Test');
      manager.reset();
      expect(manager.currentBreakpoint).toBe(Breakpoint.Desktop);
      expect(manager.leftHandMode).toBe(false);
      expect(manager.fontSize).toBe(FontSizeLevel.Medium);
      expect(manager.fullScreenPanel.isOpen).toBe(false);
      expect(manager.navigationDepth).toBe(0);
    });
  });
});
