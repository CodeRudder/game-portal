/**
 * §1 响应式布局断点 — 集成测试
 *
 * 覆盖 v17.0 竖屏适配核心路径：
 * - §1.1 七级断点体系检测与切换
 * - §1.2 画布缩放算法（PC/平板等比 + 移动端流式 + 4K上限）
 * - §1.3 面板适配（留白策略 + 全屏面板 + Bottom Sheet + 手机端布局）
 * - §1.4 横竖屏切换（方向检测 + 布局联动 + 面包屑导航）
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  Breakpoint,
  BREAKPOINT_WIDTHS,
  CANVAS_BASE_WIDTH,
  CANVAS_BASE_HEIGHT,
  SCALE_MAX,
  WhitespaceStrategy,
  FontSizeLevel,
  FONT_SIZE_MAP,
  MOBILE_LAYOUT,
  type ResponsiveLayoutSnapshot,
} from '../../../../core/responsive/responsive.types';
import { ResponsiveLayoutManager } from '../../ResponsiveLayoutManager';
import { MobileLayoutManager } from '../../MobileLayoutManager';

describe('§1 响应式布局断点 — 集成测试', () => {
  let rm: ResponsiveLayoutManager;
  let ml: MobileLayoutManager;

  beforeEach(() => {
    vi.useFakeTimers();
    rm = new ResponsiveLayoutManager();
    ml = new MobileLayoutManager(rm);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ═══════════════════════════════════════════════
  // §1.1 七级断点体系检测与切换
  // ═══════════════════════════════════════════════

  describe('§1.1 七级断点体系检测与切换', () => {
    it('应正确识别全部7级断点边界值', () => {
      expect(rm.detectBreakpoint(1920)).toBe(Breakpoint.DesktopL);
      expect(rm.detectBreakpoint(1280)).toBe(Breakpoint.Desktop);
      expect(rm.detectBreakpoint(1024)).toBe(Breakpoint.TabletL);
      expect(rm.detectBreakpoint(768)).toBe(Breakpoint.Tablet);
      expect(rm.detectBreakpoint(428)).toBe(Breakpoint.MobileL);
      expect(rm.detectBreakpoint(375)).toBe(Breakpoint.Mobile);
      expect(rm.detectBreakpoint(320)).toBe(Breakpoint.MobileS);
    });

    it('断点切换时触发布局变更回调', () => {
      const snapshots: ResponsiveLayoutSnapshot[] = [];
      rm.onLayoutChange((s) => snapshots.push(s));

      rm.updateViewport(1920, 1080); // DesktopL
      rm.updateViewport(375, 667);   // → Mobile：断点变化

      expect(snapshots.length).toBeGreaterThanOrEqual(1);
      const last = snapshots[snapshots.length - 1];
      expect(last.breakpoint).toBe(Breakpoint.Mobile);
      expect(last.isMobile).toBe(true);
    });

    it('同断点内尺寸变化不触发回调', () => {
      const snapshots: ResponsiveLayoutSnapshot[] = [];
      rm.updateViewport(1920, 1080);
      rm.onLayoutChange((s) => snapshots.push(s));

      const changed = rm.updateViewport(2000, 1200); // 仍是 DesktopL
      expect(changed).toBe(false);
      expect(snapshots).toHaveLength(0);
    });

    it('isMobile/isTablet/isDesktop 分类断言正确', () => {
      rm.updateViewport(375, 667);
      expect(rm.isMobile).toBe(true);
      expect(rm.isTablet).toBe(false);
      expect(rm.isDesktop).toBe(false);

      rm.updateViewport(900, 600);
      expect(rm.isMobile).toBe(false);
      expect(rm.isTablet).toBe(true);
      expect(rm.isDesktop).toBe(false);

      rm.updateViewport(1920, 1080);
      expect(rm.isMobile).toBe(false);
      expect(rm.isTablet).toBe(false);
      expect(rm.isDesktop).toBe(true);
    });

    it('MobileLayoutManager.isMobileMode 随 ResponsiveLayoutManager 联动', () => {
      rm.updateViewport(1920, 1080);
      expect(ml.isMobileMode).toBe(false);

      rm.updateViewport(375, 667);
      expect(ml.isMobileMode).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════
  // §1.2 画布缩放算法
  // ═══════════════════════════════════════════════

  describe('§1.2 画布缩放算法', () => {
    it('桌面端：等比缩放 + 居中 + CenterDecorated 留白', () => {
      const result = rm.calculateCanvasScale(1600, 900);
      expect(result.scale).toBeGreaterThan(0);
      expect(result.scale).toBeLessThanOrEqual(SCALE_MAX);
      expect(result.whitespaceStrategy).toBe(WhitespaceStrategy.CenterDecorated);
      expect(result.offsetX).toBeGreaterThanOrEqual(0);
      expect(result.offsetY).toBeGreaterThanOrEqual(0);
    });

    it('平板端：等比缩放 + CenterFilled 留白策略', () => {
      const result = rm.calculateCanvasScale(900, 600, Breakpoint.Tablet);
      expect(result.scale).toBeGreaterThan(0);
      expect(result.whitespaceStrategy).toBe(WhitespaceStrategy.CenterFilled);
    });

    it('移动端：scale=1 流式布局，无偏移', () => {
      const result = rm.calculateCanvasScale(375, 667, Breakpoint.Mobile);
      expect(result.scale).toBe(1);
      expect(result.offsetX).toBe(0);
      expect(result.offsetY).toBe(0);
      expect(result.whitespaceStrategy).toBe(WhitespaceStrategy.CenterFilled);
    });

    it('4K分辨率缩放不超过 SCALE_MAX 上限', () => {
      const result = rm.calculateCanvasScale(3840, 2160, Breakpoint.DesktopL);
      expect(result.scale).toBeLessThanOrEqual(SCALE_MAX);
      expect(result.canvasWidth).toBeLessThanOrEqual(CANVAS_BASE_WIDTH * SCALE_MAX);
    });

    it('画布尺寸 = 基准 × scale，居中偏移 = (视口 - 画布) / 2', () => {
      const result = rm.calculateCanvasScale(1600, 900, Breakpoint.Desktop);
      const expectedScale = Math.min(1600 / CANVAS_BASE_WIDTH, 900 / CANVAS_BASE_HEIGHT, SCALE_MAX);
      expect(result.scale).toBeCloseTo(expectedScale, 4);
      expect(result.canvasWidth).toBeCloseTo(CANVAS_BASE_WIDTH * expectedScale, 2);
      expect(result.offsetX).toBeCloseTo(Math.max(0, (1600 - result.canvasWidth) / 2), 2);
    });
  });

  // ═══════════════════════════════════════════════
  // §1.3 面板适配
  // ═══════════════════════════════════════════════

  describe('§1.3 面板适配', () => {
    it('留白计算：左右留白对称分布', () => {
      const ws = rm.calculateWhitespace(1600, 1000);
      expect(ws.totalWidth).toBe(600);
      expect(ws.leftWidth + ws.rightWidth).toBe(ws.totalWidth);
    });

    it('左手模式镜像留白区域', () => {
      rm.setLeftHandMode(true);
      const base = rm.calculateWhitespace(1600, 1000);
      const mirrored = rm.applyLeftHandMirror(base);
      expect(mirrored.leftWidth).toBe(base.rightWidth);
      expect(mirrored.rightWidth).toBe(base.leftWidth);
      expect(mirrored.totalWidth).toBe(base.totalWidth);
    });

    it('全屏面板打开/关闭联动 navigationDepth', () => {
      rm.updateViewport(375, 667);
      expect(rm.fullScreenPanel.isOpen).toBe(false);

      rm.openFullScreenPanel('hero-detail', '武将详情');
      expect(rm.fullScreenPanel.isOpen).toBe(true);
      expect(rm.fullScreenPanel.panelId).toBe('hero-detail');
      expect(rm.navigationDepth).toBe(1);

      rm.closeFullScreenPanel();
      expect(rm.fullScreenPanel.isOpen).toBe(false);
      expect(rm.navigationDepth).toBe(0);
    });

    it('Bottom Sheet 打开/关闭生命周期', () => {
      rm.openBottomSheet('hero-list', 400);
      expect(rm.bottomSheet.isOpen).toBe(true);
      expect(rm.bottomSheet.contentHeight).toBe(400);
      expect(rm.bottomSheet.showHandle).toBe(true);

      rm.closeBottomSheet();
      expect(rm.bottomSheet.isOpen).toBe(false);
    });

    it('手机端场景区高度 = vh - 资源栏 - 快捷图标 - Tab栏', () => {
      const vh = 667;
      const scene = rm.calculateMobileSceneHeight(vh);
      const expected = vh - MOBILE_LAYOUT.resourceBarHeight - MOBILE_LAYOUT.quickIconBarHeight - MOBILE_LAYOUT.tabBarHeight;
      expect(scene).toBe(expected);
      expect(scene).toBeGreaterThan(0);
    });

    it('MobileLayoutManager.calculateMobileLayout 返回完整布局状态', () => {
      const layout = ml.calculateMobileLayout(375, 667);
      expect(layout.sceneAreaHeight).toBeGreaterThan(0);
      expect(layout.resourceBarHeight).toBe(MOBILE_LAYOUT.resourceBarHeight);
      expect(layout.quickIconBarHeight).toBe(MOBILE_LAYOUT.quickIconBarHeight);
      expect(layout.tabBar.tabs.length).toBeGreaterThan(0);
    });
  });

  // ═══════════════════════════════════════════════
  // §1.4 横竖屏切换
  // ═══════════════════════════════════════════════

  describe('§1.4 横竖屏切换', () => {
    it('宽≥高 → landscape，高>宽 → portrait', () => {
      rm.updateViewport(800, 400);
      expect(rm.orientation).toBe('landscape');

      rm.updateViewport(375, 667);
      expect(rm.orientation).toBe('portrait');
    });

    it('竖屏→横屏→竖屏：断点与方向同步变化', () => {
      const history: Array<{ bp: Breakpoint; orient: string }> = [];

      rm.updateViewport(375, 667);
      history.push({ bp: rm.currentBreakpoint, orient: rm.orientation });

      rm.updateViewport(1024, 600);
      history.push({ bp: rm.currentBreakpoint, orient: rm.orientation });

      rm.updateViewport(375, 812);
      history.push({ bp: rm.currentBreakpoint, orient: rm.orientation });

      expect(history[0].orient).toBe('portrait');
      expect(history[1].orient).toBe('landscape');
      expect(history[2].orient).toBe('portrait');
      expect(history[0].bp).not.toBe(history[1].bp);
    });

    it('横竖屏切换时画布缩放结果自适应', () => {
      rm.updateViewport(1024, 600); // 横屏平板
      const landscape = rm.calculateCanvasScale(1024, 600);

      rm.updateViewport(600, 1024); // 竖屏平板
      const portrait = rm.calculateCanvasScale(600, 1024);

      // 竖屏缩放比通常不同（因宽高比变化）
      expect(landscape.scale).not.toBe(portrait.scale);
      // 画布尺寸都应合理
      expect(landscape.canvasWidth).toBeGreaterThan(0);
      expect(portrait.canvasWidth).toBeGreaterThan(0);
    });

    it('面包屑导航：push → pop → navigateBack 完整路径', () => {
      rm.pushBreadcrumb('/heroes', '武将列表');
      rm.pushBreadcrumb('/heroes/detail', '武将详情');

      const state = rm.getNavigationState();
      expect(state.breadcrumbs).toHaveLength(3); // root + 2
      expect(state.canGoBack).toBe(true);

      const ok = rm.navigateBack();
      expect(ok).toBe(true);
      expect(rm.getNavigationState().breadcrumbs).toHaveLength(2);
    });

    it('字体大小三档切换反映到 fontSizePx', () => {
      const levels = [FontSizeLevel.Small, FontSizeLevel.Medium, FontSizeLevel.Large];
      const pxValues = levels.map((l) => {
        rm.setFontSize(l);
        return rm.fontSizePx;
      });
      expect(pxValues[0]).toBeLessThan(pxValues[1]);
      expect(pxValues[1]).toBeLessThan(pxValues[2]);
    });

    it('底部Tab切换联动 MobileLayoutManager', () => {
      const ok = ml.switchTab('heroes');
      expect(ok).toBe(true);
      expect(ml.getActiveTabId()).toBe('heroes');

      // 无效Tab切换应返回 false
      const fail = ml.switchTab('nonexistent');
      expect(fail).toBe(false);
    });

    it('MobileLayoutManager 全屏面板深度限制 MAX_PANEL_DEPTH=5', () => {
      // 连续打开5层面板
      for (let i = 0; i < 5; i++) {
        ml.openFullScreenPanel(`panel-${i}`, `面板${i}`);
      }
      const nav = ml.navigationPath;
      expect(nav.depth).toBeLessThanOrEqual(5);
    });
  });
});
