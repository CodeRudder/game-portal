/**
 * ResponsiveLayoutManager 单元测试
 *
 * 覆盖：
 * - #1  7级断点检测
 * - #2  画布缩放算法
 * - #3  留白区域处理
 * - #4  手机端画布区域计算
 * - #5  底部Tab导航
 * - #6  全屏面板模式
 * - #7  Bottom Sheet交互
 * - #12 左手模式
 * - #14 字体大小
 * - #17 手机端导航
 * - #18 面包屑导航
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  Breakpoint,
  BREAKPOINT_WIDTHS,
  FontSizeLevel,
  WhitespaceStrategy,
} from '../../../core/responsive/responsive.types';
import { ResponsiveLayoutManager } from '../ResponsiveLayoutManager';

describe('ResponsiveLayoutManager', () => {
  let manager: ResponsiveLayoutManager;

  beforeEach(() => {
    manager = new ResponsiveLayoutManager();
  });

  // ═══════════════════════════════════════════
  // #1 断点检测
  // ═══════════════════════════════════════════

  describe('detectBreakpoint', () => {
    it('DesktopL: ≥1920px', () => {
      expect(manager.detectBreakpoint(1920)).toBe(Breakpoint.DesktopL);
      expect(manager.detectBreakpoint(2560)).toBe(Breakpoint.DesktopL);
    });

    it('Desktop: 1280~1919px', () => {
      expect(manager.detectBreakpoint(1280)).toBe(Breakpoint.Desktop);
      expect(manager.detectBreakpoint(1500)).toBe(Breakpoint.Desktop);
    });

    it('TabletL: 1024~1279px', () => {
      expect(manager.detectBreakpoint(1024)).toBe(Breakpoint.TabletL);
      expect(manager.detectBreakpoint(1100)).toBe(Breakpoint.TabletL);
    });

    it('Tablet: 768~1023px', () => {
      expect(manager.detectBreakpoint(768)).toBe(Breakpoint.Tablet);
      expect(manager.detectBreakpoint(900)).toBe(Breakpoint.Tablet);
    });

    it('MobileL: 428~767px', () => {
      expect(manager.detectBreakpoint(428)).toBe(Breakpoint.MobileL);
      expect(manager.detectBreakpoint(500)).toBe(Breakpoint.MobileL);
    });

    it('Mobile: 375~427px', () => {
      expect(manager.detectBreakpoint(375)).toBe(Breakpoint.Mobile);
      expect(manager.detectBreakpoint(400)).toBe(Breakpoint.Mobile);
    });

    it('MobileS: <375px', () => {
      expect(manager.detectBreakpoint(320)).toBe(Breakpoint.MobileS);
      expect(manager.detectBreakpoint(0)).toBe(Breakpoint.MobileS);
    });
  });

  describe('updateViewport', () => {
    it('返回true当断点变化', () => {
      const changed = manager.updateViewport(375, 667);
      expect(changed).toBe(true);
      expect(manager.currentBreakpoint).toBe(Breakpoint.Mobile);
    });

    it('返回false当断点不变', () => {
      manager.updateViewport(1280, 800);
      const changed = manager.updateViewport(1300, 800);
      expect(changed).toBe(false);
    });

    it('正确检测横屏', () => {
      manager.updateViewport(1280, 800);
      expect(manager.orientation).toBe('landscape');
    });

    it('正确检测竖屏', () => {
      manager.updateViewport(375, 812);
      expect(manager.orientation).toBe('portrait');
    });

    it('触发布局监听器', () => {
      const listener = vi.fn();
      manager.onLayoutChange(listener);
      manager.updateViewport(375, 667);
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('不触发监听器当断点不变', () => {
      const listener = vi.fn();
      manager.updateViewport(1280, 800);
      manager.onLayoutChange(listener);
      manager.updateViewport(1300, 800);
      expect(listener).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════
  // #2 画布缩放
  // ═══════════════════════════════════════════

  describe('calculateCanvasScale', () => {
    it('移动端：流式布局 scale=1', () => {
      const result = manager.calculateCanvasScale(375, 667, Breakpoint.Mobile);
      expect(result.scale).toBe(1);
      expect(result.offsetX).toBe(0);
      expect(result.offsetY).toBe(0);
      expect(result.canvasWidth).toBe(375);
      expect(result.canvasHeight).toBe(667);
    });

    it('桌面端：等比缩放', () => {
      const result = manager.calculateCanvasScale(1920, 1080, Breakpoint.DesktopL);
      expect(result.scale).toBeCloseTo(1080 / 800, 4);
      expect(result.offsetX).toBeGreaterThan(0);
    });

    it('4K上限：scale≤2.0', () => {
      const result = manager.calculateCanvasScale(3840, 2160, Breakpoint.DesktopL);
      expect(result.scale).toBe(2.0);
    });

    it('平板端：等比缩放', () => {
      const result = manager.calculateCanvasScale(1024, 768, Breakpoint.TabletL);
      // scale = min(1024/1280, 768/800) = min(0.8, 0.96) = 0.8
      expect(result.scale).toBeCloseTo(0.8, 4);
    });

    it('自动检测断点', () => {
      const result = manager.calculateCanvasScale(375, 667);
      expect(result.scale).toBe(1); // Mobile → 流式
    });
  });

  // ═══════════════════════════════════════════
  // #3 留白区域
  // ═══════════════════════════════════════════

  describe('calculateWhitespace', () => {
    it('计算左右留白', () => {
      const ws = manager.calculateWhitespace(1920, 1280);
      expect(ws.totalWidth).toBe(640);
      expect(ws.leftWidth).toBe(320);
      expect(ws.rightWidth).toBe(320);
    });

    it('无留白时返回0', () => {
      const ws = manager.calculateWhitespace(1280, 1280);
      expect(ws.totalWidth).toBe(0);
    });
  });

  describe('applyLeftHandMirror', () => {
    it('左手模式：左右互换', () => {
      manager.setLeftHandMode(true);
      const ws = manager.applyLeftHandMirror({
        leftWidth: 100,
        rightWidth: 200,
        totalWidth: 300,
      });
      expect(ws.leftWidth).toBe(200);
      expect(ws.rightWidth).toBe(100);
    });

    it('非左手模式：不变', () => {
      const ws = manager.applyLeftHandMirror({
        leftWidth: 100,
        rightWidth: 200,
        totalWidth: 300,
      });
      expect(ws.leftWidth).toBe(100);
      expect(ws.rightWidth).toBe(200);
    });
  });

  // ═══════════════════════════════════════════
  // #4 手机端画布区域
  // ═══════════════════════════════════════════

  describe('calculateMobileSceneHeight', () => {
    it('默认高度667时场景区=667-48-36-76=507', () => {
      expect(manager.calculateMobileSceneHeight()).toBe(507);
    });

    it('自定义视口高度', () => {
      // 812 - 48 - 36 - 76 = 652
      expect(manager.calculateMobileSceneHeight(812)).toBe(652);
    });

    it('极小高度不返回负数', () => {
      expect(manager.calculateMobileSceneHeight(100)).toBe(0);
    });
  });

  describe('getMobileLayoutState', () => {
    it('包含正确的区域高度', () => {
      const state = manager.getMobileLayoutState(812);
      expect(state.resourceBarHeight).toBe(48);
      expect(state.quickIconBarHeight).toBe(36);
      expect(state.sceneAreaHeight).toBe(652);
      expect(state.tabBar.safeAreaHeight).toBe(76);
    });
  });

  // ═══════════════════════════════════════════
  // #5 底部Tab导航
  // ═══════════════════════════════════════════

  describe('switchTab', () => {
    it('成功切换Tab', () => {
      const result = manager.switchTab('heroes');
      expect(result).toBe(true);
      expect(manager.tabBar.activeTabId).toBe('heroes');
    });

    it('不存在的Tab返回false', () => {
      const result = manager.switchTab('nonexistent');
      expect(result).toBe(false);
    });

    it('切换后只有一个Tab被选中', () => {
      manager.switchTab('map');
      const activeCount = manager.tabBar.tabs.filter((t) => t.isActive).length;
      expect(activeCount).toBe(1);
    });
  });

  describe('setTabs', () => {
    it('设置自定义Tab项', () => {
      manager.setTabs([
        { id: 'a', label: 'A', icon: 'a-icon', isActive: true },
        { id: 'b', label: 'B', icon: 'b-icon', isActive: false },
      ]);
      expect(manager.tabBar.tabs).toHaveLength(2);
      expect(manager.tabBar.activeTabId).toBe('a');
    });
  });

  // ═══════════════════════════════════════════
  // #6 全屏面板
  // ═══════════════════════════════════════════

  describe('fullScreenPanel', () => {
    it('打开全屏面板', () => {
      manager.openFullScreenPanel('hero-detail', '武将详情');
      expect(manager.fullScreenPanel.isOpen).toBe(true);
      expect(manager.fullScreenPanel.panelId).toBe('hero-detail');
      expect(manager.fullScreenPanel.title).toBe('武将详情');
      expect(manager.fullScreenPanel.swipeBackEnabled).toBe(true);
    });

    it('关闭全屏面板', () => {
      manager.openFullScreenPanel('test', 'Test');
      manager.closeFullScreenPanel();
      expect(manager.fullScreenPanel.isOpen).toBe(false);
    });

    it('打开面板增加导航深度', () => {
      const before = manager.navigationDepth;
      manager.openFullScreenPanel('test', 'Test');
      expect(manager.navigationDepth).toBe(before + 1);
    });
  });

  // ═══════════════════════════════════════════
  // #7 Bottom Sheet
  // ═══════════════════════════════════════════

  describe('bottomSheet', () => {
    it('打开Bottom Sheet', () => {
      manager.openBottomSheet('hero-select', 400);
      expect(manager.bottomSheet.isOpen).toBe(true);
      expect(manager.bottomSheet.sheetId).toBe('hero-select');
      expect(manager.bottomSheet.contentHeight).toBe(400);
      expect(manager.bottomSheet.showHandle).toBe(true);
    });

    it('关闭Bottom Sheet', () => {
      manager.openBottomSheet('test', 300);
      manager.closeBottomSheet();
      expect(manager.bottomSheet.isOpen).toBe(false);
    });
  });

  // ═══════════════════════════════════════════
  // #12 左手模式
  // ═══════════════════════════════════════════

  describe('leftHandMode', () => {
    it('设置左手模式', () => {
      manager.setLeftHandMode(true);
      expect(manager.leftHandMode).toBe(true);
    });

    it('触发布局监听', () => {
      const listener = vi.fn();
      manager.onLayoutChange(listener);
      manager.setLeftHandMode(true);
      expect(listener).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════
  // #14 字体大小
  // ═══════════════════════════════════════════

  describe('fontSize', () => {
    it('默认中号', () => {
      expect(manager.fontSize).toBe(FontSizeLevel.Medium);
      expect(manager.fontSizePx).toBe(14);
    });

    it('切换字体大小', () => {
      manager.setFontSize(FontSizeLevel.Large);
      expect(manager.fontSize).toBe(FontSizeLevel.Large);
      expect(manager.fontSizePx).toBe(16);
    });
  });

  // ═══════════════════════════════════════════
  // #18 面包屑导航
  // ═══════════════════════════════════════════

  describe('breadcrumbs', () => {
    it('初始有根路径', () => {
      expect(manager.breadcrumbs).toHaveLength(1);
      expect(manager.breadcrumbs[0].path).toBe('/');
    });

    it('推入面包屑', () => {
      manager.pushBreadcrumb('/heroes', '武将');
      expect(manager.breadcrumbs).toHaveLength(2);
      expect(manager.breadcrumbs[1].label).toBe('武将');
    });

    it('推入时前一个变为可点击', () => {
      manager.pushBreadcrumb('/heroes', '武将');
      expect(manager.breadcrumbs[0].clickable).toBe(true);
      expect(manager.breadcrumbs[1].clickable).toBe(false);
    });

    it('返回到指定层级', () => {
      manager.pushBreadcrumb('/heroes', '武将');
      manager.pushBreadcrumb('/heroes/1', '详情');
      manager.popToBreadcrumb(0);
      expect(manager.breadcrumbs).toHaveLength(1);
    });

    it('导航返回', () => {
      manager.pushBreadcrumb('/heroes', '武将');
      const result = manager.navigateBack();
      expect(result).toBe(true);
    });

    it('根路径不可返回', () => {
      const result = manager.navigateBack();
      expect(result).toBe(false);
    });

    it('最大深度限制', () => {
      for (let i = 0; i < 15; i++) {
        manager.pushBreadcrumb(`/level-${i}`, `Level ${i}`);
      }
      const state = manager.getNavigationState();
      expect(state.depth).toBeLessThanOrEqual(state.maxDepth);
    });
  });

  describe('getNavigationState', () => {
    it('返回正确的导航状态', () => {
      const state = manager.getNavigationState();
      expect(state.canGoBack).toBe(false);
      expect(state.depth).toBe(0);
      expect(state.maxDepth).toBe(10);
    });
  });

  // ═══════════════════════════════════════════
  // 快照
  // ═══════════════════════════════════════════

  describe('getSnapshot', () => {
    it('返回完整快照', () => {
      manager.updateViewport(375, 812);
      const snap = manager.getSnapshot();
      expect(snap.breakpoint).toBe(Breakpoint.Mobile);
      expect(snap.viewportWidth).toBe(375);
      expect(snap.isMobile).toBe(true);
      expect(snap.orientation).toBe('portrait');
      expect(snap.canvasScale).toBeDefined();
    });
  });

  // ═══════════════════════════════════════════
  // 事件监听
  // ═══════════════════════════════════════════

  describe('listeners', () => {
    it('取消注册布局监听', () => {
      const listener = vi.fn();
      const unsub = manager.onLayoutChange(listener);
      unsub();
      manager.updateViewport(375, 667);
      expect(listener).not.toHaveBeenCalled();
    });

    it('导航变更监听', () => {
      const listener = vi.fn();
      manager.onNavigationChange(listener);
      manager.pushBreadcrumb('/test', 'Test');
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('清除所有监听', () => {
      const l1 = vi.fn();
      const l2 = vi.fn();
      manager.onLayoutChange(l1);
      manager.onNavigationChange(l2);
      manager.clearListeners();
      manager.updateViewport(375, 667);
      manager.pushBreadcrumb('/test', 'Test');
      expect(l1).not.toHaveBeenCalled();
      expect(l2).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════
  // 静态方法
  // ═══════════════════════════════════════════

  describe('static methods', () => {
    it('isMobileBreakpoint', () => {
      expect(ResponsiveLayoutManager.isMobileBreakpoint(Breakpoint.Mobile)).toBe(true);
      expect(ResponsiveLayoutManager.isMobileBreakpoint(Breakpoint.Desktop)).toBe(false);
    });

    it('isTabletBreakpoint', () => {
      expect(ResponsiveLayoutManager.isTabletBreakpoint(Breakpoint.Tablet)).toBe(true);
      expect(ResponsiveLayoutManager.isTabletBreakpoint(Breakpoint.Mobile)).toBe(false);
    });

    it('isDesktopBreakpoint', () => {
      expect(ResponsiveLayoutManager.isDesktopBreakpoint(Breakpoint.Desktop)).toBe(true);
      expect(ResponsiveLayoutManager.isDesktopBreakpoint(Breakpoint.Tablet)).toBe(false);
    });

    it('getAllBreakpoints 返回7个', () => {
      const all = ResponsiveLayoutManager.getAllBreakpoints();
      expect(all).toHaveLength(7);
      expect(all[0]).toBe(Breakpoint.DesktopL);
      expect(all[6]).toBe(Breakpoint.MobileS);
    });
  });

  // ═══════════════════════════════════════════
  // isMobile / isTablet / isDesktop
  // ═══════════════════════════════════════════

  describe('device category detection', () => {
    it('移动端', () => {
      manager.updateViewport(375, 667);
      expect(manager.isMobile).toBe(true);
      expect(manager.isTablet).toBe(false);
      expect(manager.isDesktop).toBe(false);
    });

    it('平板端', () => {
      manager.updateViewport(768, 1024);
      expect(manager.isMobile).toBe(false);
      expect(manager.isTablet).toBe(true);
      expect(manager.isDesktop).toBe(false);
    });

    it('桌面端', () => {
      manager.updateViewport(1920, 1080);
      expect(manager.isMobile).toBe(false);
      expect(manager.isTablet).toBe(false);
      expect(manager.isDesktop).toBe(true);
    });
  });
});
