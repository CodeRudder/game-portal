/**
 * MobileLayoutManager 单元测试
 *
 * 覆盖：
 * - #4  手机端画布（375×667px基准）
 * - #5  底部Tab导航
 * - #6  全屏面板模式
 * - #7  Bottom Sheet交互
 * - #17 手机端导航
 * - #18 导航路径优化
 */

import {
  MOBILE_CANVAS_WIDTH,
  MOBILE_CANVAS_HEIGHT,
  MOBILE_LAYOUT,
  type MobileTabItem,
} from '../../../core/responsive/responsive.types';
import { ResponsiveLayoutManager } from '../ResponsiveLayoutManager';
import { MobileLayoutManager } from '../MobileLayoutManager';

describe('MobileLayoutManager', () => {
  let responsiveManager: ResponsiveLayoutManager;
  let mobileManager: MobileLayoutManager;

  beforeEach(() => {
    responsiveManager = new ResponsiveLayoutManager();
    mobileManager = new MobileLayoutManager(responsiveManager);
  });

  afterEach(() => {
    mobileManager.clearListeners();
    responsiveManager.clearListeners();
  });

  // ═══════════════════════════════════════════
  // #4 手机端画布尺寸
  // ═══════════════════════════════════════════

  describe('手机端画布尺寸 (#4)', () => {
    it('默认375×667基准尺寸应正确', () => {
      expect(MOBILE_CANVAS_WIDTH).toBe(375);
      expect(MOBILE_CANVAS_HEIGHT).toBe(667);
    });

    it('资源栏高度应为48px', () => {
      expect(MOBILE_LAYOUT.resourceBarHeight).toBe(48);
    });

    it('快捷图标条高度应为36px', () => {
      expect(MOBILE_LAYOUT.quickIconBarHeight).toBe(36);
    });

    it('底部Tab栏高度应为76px（含安全区域）', () => {
      expect(MOBILE_LAYOUT.tabBarHeight).toBe(76);
    });

    it('场景区高度 = 667 - 48 - 36 - 76 = 507', () => {
      const layout = mobileManager.calculateMobileLayout(375, 667);

      expect(layout.resourceBarHeight).toBe(48);
      expect(layout.quickIconBarHeight).toBe(36);
      expect(layout.sceneAreaHeight).toBe(507);
    });

    it('自定义视口尺寸应正确计算场景区', () => {
      const layout = mobileManager.calculateMobileLayout(428, 800);

      expect(layout.sceneAreaHeight).toBe(800 - 48 - 36 - 76);
      expect(layout.sceneAreaHeight).toBe(640);
    });

    it('极小视口场景区不应为负数', () => {
      const layout = mobileManager.calculateMobileLayout(375, 100);

      expect(layout.sceneAreaHeight).toBe(0);
    });
  });

  // ═══════════════════════════════════════════
  // #5 底部Tab导航
  // ═══════════════════════════════════════════

  describe('底部Tab导航 (#5)', () => {
    it('默认应有5个Tab', () => {
      const tabBar = mobileManager.tabBar;
      expect(tabBar.tabs.length).toBe(5);
    });

    it('默认选中Tab为map', () => {
      expect(mobileManager.getActiveTabId()).toBe('map');
    });

    it('switchTab应切换选中Tab', () => {
      const result = mobileManager.switchTab('heroes');

      expect(result).toBe(true);
      expect(mobileManager.getActiveTabId()).toBe('heroes');

      const tabBar = mobileManager.tabBar;
      const activeTab = tabBar.tabs.find((t) => t.isActive);
      expect(activeTab?.id).toBe('heroes');
    });

    it('switchTab不存在应返回false', () => {
      const result = mobileManager.switchTab('nonexistent');
      expect(result).toBe(false);
    });

    it('切换Tab应关闭全屏面板', () => {
      mobileManager.openFullScreenPanel('test-panel', 'Test');
      expect(mobileManager.fullScreenPanel.isOpen).toBe(true);

      mobileManager.switchTab('heroes');
      expect(mobileManager.fullScreenPanel.isOpen).toBe(false);
    });

    it('切换Tab应关闭BottomSheet', () => {
      mobileManager.openBottomSheet('test-sheet', 300);
      expect(mobileManager.bottomSheet.isOpen).toBe(true);

      mobileManager.switchTab('heroes');
      expect(mobileManager.bottomSheet.isOpen).toBe(false);
    });

    it('setTabs应替换Tab列表', () => {
      const newTabs: MobileTabItem[] = [
        { id: 'a', label: 'A', icon: 'a', isActive: true },
        { id: 'b', label: 'B', icon: 'b', isActive: false },
      ];

      mobileManager.setTabs(newTabs);

      const tabBar = mobileManager.tabBar;
      expect(tabBar.tabs.length).toBe(2);
      expect(tabBar.activeTabId).toBe('a');
    });
  });

  // ═══════════════════════════════════════════
  // #6 全屏面板模式
  // ═══════════════════════════════════════════

  describe('全屏面板模式 (#6)', () => {
    it('openFullScreenPanel应打开面板', () => {
      const result = mobileManager.openFullScreenPanel('hero-detail', '武将详情');

      expect(result).toBe(true);
      expect(mobileManager.fullScreenPanel.isOpen).toBe(true);
      expect(mobileManager.fullScreenPanel.panelId).toBe('hero-detail');
      expect(mobileManager.fullScreenPanel.title).toBe('武将详情');
    });

    it('默认允许左滑返回', () => {
      mobileManager.openFullScreenPanel('test', 'Test');
      expect(mobileManager.fullScreenPanel.swipeBackEnabled).toBe(true);
    });

    it('可禁用左滑返回', () => {
      mobileManager.openFullScreenPanel('test', 'Test', false);
      expect(mobileManager.fullScreenPanel.swipeBackEnabled).toBe(false);
    });

    it('打开第二个面板应将第一个压入栈', () => {
      mobileManager.openFullScreenPanel('panel-1', '面板1');
      mobileManager.openFullScreenPanel('panel-2', '面板2');

      expect(mobileManager.fullScreenPanel.panelId).toBe('panel-2');
      expect(mobileManager.navigationPath.depth).toBe(1);
    });

    it('closeFullScreenPanel应返回上一级面板', () => {
      mobileManager.openFullScreenPanel('panel-1', '面板1');
      mobileManager.openFullScreenPanel('panel-2', '面板2');

      const result = mobileManager.closeFullScreenPanel();

      expect(result).not.toBeNull();
      expect(result!.panelId).toBe('panel-1');
    });

    it('关闭最后一个面板应返回null', () => {
      mobileManager.openFullScreenPanel('panel-1', '面板1');
      const result = mobileManager.closeFullScreenPanel();

      expect(result).toBeNull();
      expect(mobileManager.fullScreenPanel.isOpen).toBe(false);
    });

    it('面板深度不应超过最大值', () => {
      // 打开 MAX_PANEL_DEPTH 个面板
      for (let i = 0; i < 5; i++) {
        mobileManager.openFullScreenPanel(`panel-${i}`, `面板${i}`);
      }

      // 第6个应失败
      const result = mobileManager.openFullScreenPanel('panel-6', '面板6');
      expect(result).toBe(false);
    });
  });

  // ═══════════════════════════════════════════
  // #7 Bottom Sheet
  // ═══════════════════════════════════════════

  describe('Bottom Sheet (#7)', () => {
    it('openBottomSheet应打开Sheet', () => {
      mobileManager.openBottomSheet('hero-select', 400);

      expect(mobileManager.bottomSheet.isOpen).toBe(true);
      expect(mobileManager.bottomSheet.sheetId).toBe('hero-select');
      expect(mobileManager.bottomSheet.contentHeight).toBe(400);
      expect(mobileManager.bottomSheet.showHandle).toBe(true);
    });

    it('closeBottomSheet应关闭Sheet', () => {
      mobileManager.openBottomSheet('test', 300);
      mobileManager.closeBottomSheet();

      expect(mobileManager.bottomSheet.isOpen).toBe(false);
    });

    it('updateBottomSheetHeight应更新高度', () => {
      mobileManager.openBottomSheet('test', 300);
      mobileManager.updateBottomSheetHeight(500);

      expect(mobileManager.bottomSheet.contentHeight).toBe(500);
    });

    it('关闭状态下updateBottomSheetHeight不应生效', () => {
      mobileManager.updateBottomSheetHeight(500);
      // Sheet未打开，不应有副作用
      expect(mobileManager.bottomSheet.isOpen).toBe(false);
    });

    it('可隐藏拖拽把手', () => {
      mobileManager.openBottomSheet('test', 300, false);
      expect(mobileManager.bottomSheet.showHandle).toBe(false);
    });
  });

  // ═══════════════════════════════════════════
  // #17 手机端导航
  // ═══════════════════════════════════════════

  describe('手机端导航 (#17)', () => {
    it('isMobileMode应依赖ResponsiveLayoutManager', () => {
      responsiveManager.updateViewport(1280, 800);
      expect(mobileManager.isMobileMode).toBe(false);

      responsiveManager.updateViewport(375, 667);
      expect(mobileManager.isMobileMode).toBe(true);
    });

    it('底部Tab + 快捷图标 + 全屏面板应协同工作', () => {
      responsiveManager.updateViewport(375, 667);
      const layout = mobileManager.calculateMobileLayout();

      // Tab栏存在
      expect(layout.tabBar.tabs.length).toBe(5);
      // 快捷图标条高度正确
      expect(layout.quickIconBarHeight).toBe(36);
      // 可打开全屏面板
      mobileManager.openFullScreenPanel('test', 'Test');
      expect(layout.fullScreenPanel.isOpen || mobileManager.fullScreenPanel.isOpen).toBe(true);
    });
  });

  // ═══════════════════════════════════════════
  // #18 导航路径优化
  // ═══════════════════════════════════════════

  describe('导航路径优化 (#18)', () => {
    it('初始面包屑应只有首页', () => {
      const crumbs = mobileManager.getBreadcrumbs();
      expect(crumbs.length).toBe(1);
      expect(crumbs[0].path).toBe('root');
    });

    it('打开面板后面包屑应更新', () => {
      mobileManager.openFullScreenPanel('hero-detail', '武将详情');

      const crumbs = mobileManager.getBreadcrumbs();
      expect(crumbs.length).toBe(2);
      expect(crumbs[0].path).toBe('root');
      expect(crumbs[1].path).toBe('hero-detail');
      expect(crumbs[1].label).toBe('武将详情');
      expect(crumbs[1].clickable).toBe(false); // 当前面板不可点击
    });

    it('多层面板面包屑应正确', () => {
      mobileManager.openFullScreenPanel('heroes', '武将列表');
      mobileManager.openFullScreenPanel('hero-detail', '武将详情');

      const crumbs = mobileManager.getBreadcrumbs();
      expect(crumbs.length).toBe(3);
      expect(crumbs[0].path).toBe('root');
      expect(crumbs[1].path).toBe('heroes');
      expect(crumbs[1].clickable).toBe(true); // 可返回
      expect(crumbs[2].path).toBe('hero-detail');
      expect(crumbs[2].clickable).toBe(false); // 当前面板
    });

    it('navigateToBreadcrumb应跳转到指定路径', () => {
      mobileManager.openFullScreenPanel('heroes', '武将列表');
      mobileManager.openFullScreenPanel('hero-detail', '武将详情');

      const result = mobileManager.navigateToBreadcrumb('heroes');

      expect(result).toBe(true);
      const crumbs = mobileManager.getBreadcrumbs();
      expect(crumbs.length).toBe(2);
      expect(crumbs[1].path).toBe('heroes');
    });

    it('navigateToBreadcrumb不存在应返回false', () => {
      const result = mobileManager.navigateToBreadcrumb('nonexistent');
      expect(result).toBe(false);
    });

    it('goBack应返回上一级', () => {
      mobileManager.openFullScreenPanel('heroes', '武将列表');
      mobileManager.openFullScreenPanel('hero-detail', '武将详情');

      const result = mobileManager.goBack();

      expect(result).toBe(true);
      expect(mobileManager.fullScreenPanel.panelId).toBe('heroes');
    });

    it('canGoBack应正确反映状态', () => {
      expect(mobileManager.navigationPath.canGoBack).toBe(false);

      mobileManager.openFullScreenPanel('test', 'Test');
      expect(mobileManager.navigationPath.canGoBack).toBe(true);
    });

    it('导航变更应触发监听器', () => {
      const navStates: any[] = [];
      mobileManager.onNavigationChange((s) => navStates.push(s));

      mobileManager.openFullScreenPanel('test', 'Test');

      expect(navStates.length).toBe(1);
      expect(navStates[0].depth).toBe(0);
      expect(navStates[0].canGoBack).toBe(true);
    });
  });

  // ═══════════════════════════════════════════
  // 事件监听
  // ═══════════════════════════════════════════

  describe('事件监听', () => {
    it('onNavigationChange返回的取消函数应正确工作', () => {
      const states: any[] = [];
      const unsub = mobileManager.onNavigationChange((s) => states.push(s));

      mobileManager.openFullScreenPanel('test', 'Test');
      expect(states.length).toBe(1);

      unsub();
      mobileManager.openFullScreenPanel('test2', 'Test2');
      expect(states.length).toBe(1);
    });

    it('clearListeners应清除所有监听器', () => {
      const states: any[] = [];
      mobileManager.onNavigationChange((s) => states.push(s));
      mobileManager.onNavigationChange((s) => states.push(s));

      mobileManager.clearListeners();
      mobileManager.openFullScreenPanel('test', 'Test');

      expect(states.length).toBe(0);
    });
  });
});
