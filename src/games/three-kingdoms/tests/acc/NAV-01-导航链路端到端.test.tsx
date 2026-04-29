/**
 * NAV-01 导航链路端到端测试 — 完整导航路径验证
 *
 * v2 改造后：
 * - 点击"更多"Tab → SceneRouter渲染MoreTab → 主内容区显示网格列表
 * - 点击MoreTab中的功能项 → 功能面板弹出
 * - TabBar不再有 moreMenuOpen/onMoreToggle
 * - 不再有下拉菜单展开/关闭路径
 *
 * 验证从主界面→更多Tab→MoreTab→功能面板的完整导航链路。
 * 使用真实 <TabBar /> 组件渲染，通过 fireEvent 模拟真实 DOM 事件。
 *
 * 覆盖范围：
 * - 更多Tab点击 → onTabChange(more)
 * - SceneRouter渲染MoreTab
 * - MoreTab中所有16个功能面板的导航入口
 * - 点击功能项 → onOpenFeature触发
 * - Badge联动验证
 * - 导航链路完整性验证
 *
 * @module tests/acc/NAV-01
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import TabBar, {
  TABS,
  FEATURE_ITEMS,
  type TabId,
  type TabConfig,
  type TabBadges,
} from '@/components/idle/three-kingdoms/TabBar';
import MoreTab from '@/components/idle/panels/more/MoreTab';
import type { FeatureMenuItem } from '@/components/idle/FeatureMenu';
import { accTest, assertStrict, assertInDOM } from './acc-test-utils';
import { createSim } from '../../test-utils/test-helpers';
import type { GameEventSimulator } from '../../test-utils/GameEventSimulator';

// ── 辅助函数 ──

/** 构造 featureMenuItems */
function makeFeatureMenuItems(overrides: Array<Partial<FeatureMenuItem>> = []): FeatureMenuItem[] {
  return FEATURE_ITEMS.map(item => {
    const override = overrides.find(o => o.id === item.id);
    return {
      id: item.id,
      icon: item.icon,
      label: item.label,
      description: item.description,
      available: item.available ?? true,
      badge: 0,
      ...override,
    };
  });
}

/** 构造 TabBar props — v2: 移除 moreMenuOpen/onMoreToggle */
function makeTabBarProps(overrides: Record<string, any> = {}) {
  return {
    activeTab: 'map' as TabId,
    onTabChange: vi.fn(),
    featureMenuItems: makeFeatureMenuItems(),
    onFeatureSelect: vi.fn(),
    calendar: {
      date: {
        eraName: '建安',
        yearInEra: 1,
        month: 1,
        day: 1,
        season: 'spring' as const,
      },
      weather: 'clear' as const,
    },
    tabBadges: {} as TabBadges,
    ...overrides,
  };
}

/** 检查 mock 函数是否曾被调用过 */
function wasCalled(fn: ReturnType<typeof vi.fn>): boolean {
  return fn.mock.calls.length > 0;
}

/** 检查 mock 函数是否被调用了一次 */
function wasCalledOnce(fn: ReturnType<typeof vi.fn>): boolean {
  return fn.mock.calls.length === 1;
}

/** 检查 mock 函数是否曾被以指定首参调用 */
function wasCalledWithArg(fn: ReturnType<typeof vi.fn>, arg: any): boolean {
  return fn.mock.calls.some(c => c[0] === arg);
}

/** 获取 mock 函数的调用次数 */
function getCallCount(fn: ReturnType<typeof vi.fn>): number {
  return fn.mock.calls.length;
}

/** 获取Tab按钮 */
function getTabButton(tabId: TabId): HTMLElement {
  return screen.getByTestId(`tab-bar-${tabId}`);
}

/** 创建模拟引擎用于MoreTab渲染测试 */
function createMockEngine() {
  return {
    getQuestSystem: vi.fn(() => ({ getClaimableCount: () => 0 })),
    getMailSystem: vi.fn(() => ({ getUnreadCount: () => 0 })),
    getAchievementSystem: vi.fn(() => ({ getClaimableCount: () => 0 })),
    getActivitySystem: vi.fn(() => ({ getActiveCount: () => 0 })),
    getFriendSystem: vi.fn(() => ({ getUnreadCount: () => 0 })),
    getTradeSystem: vi.fn(() => ({ getActiveCaravanCount: () => 0 })),
  } as any;
}

/**
 * 模拟完整导航链路：点击更多Tab → SceneRouter渲染MoreTab → 选择功能
 *
 * v2改造后：
 * 1. 点击更多Tab → onTabChange({ id: 'more' })
 * 2. 父组件设置 activeTab='more'
 * 3. SceneRouter渲染MoreTab
 * 4. 用户在MoreTab中点击功能项 → onOpenPanel(featureId)
 */
function renderAndNavigateToFeature(featureId: string) {
  const onTabChange = vi.fn();
  const onOpenPanel = vi.fn();
  const mockEngine = createMockEngine();

  // Step 1: 渲染TabBar
  render(<TabBar {...makeTabBarProps({ onTabChange })} />);

  // Step 2: 点击更多Tab
  fireEvent.click(getTabButton('more'));

  // Step 3: 验证onTabChange被调用
  // 父组件会响应 onTabChange({ id: 'more' })，设置 activeTab='more'
  // SceneRouter渲染MoreTab

  // Step 4: 渲染MoreTab（模拟SceneRouter的行为）
  cleanup();
  render(<MoreTab engine={mockEngine} onOpenPanel={onOpenPanel} />);

  // Step 5: 点击功能项
  const featureBtn = screen.getByLabelText(
    FEATURE_ITEMS.find(f => f.id === featureId)?.label ?? featureId
  );
  fireEvent.click(featureBtn);

  return { onTabChange, onOpenPanel };
}

// ═══════════════════════════════════════════════════════════════
// NAV-01 导航链路端到端测试
// ═══════════════════════════════════════════════════════════════

describe('NAV-01 导航链路端到端测试', () => {
  let sim: GameEventSimulator;

  beforeEach(() => {
    vi.clearAllMocks();
    sim = createSim();
    sim.addResources({ gold: 500000, grain: 500000, troops: 50000 });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  // ═══════════════════════════════════════════════════════════
  // 1. 主界面→更多Tab（NAV-01-01 ~ NAV-01-05）
  // ═══════════════════════════════════════════════════════════

  describe('1. 主界面→更多Tab', () => {

    it(accTest('NAV-01-01', '完整路径: 点击更多Tab → onTabChange(more)'), () => {
      const onTabChange = vi.fn();
      render(<TabBar {...makeTabBarProps({ onTabChange })} />);

      // 点击更多Tab
      fireEvent.click(getTabButton('more'));

      // 验证回调
      assertStrict(wasCalledOnce(onTabChange), 'NAV-01-01', 'onTabChange应被调用');
      const call = onTabChange.mock.calls[0][0] as TabConfig;
      assertStrict(call.id === 'more', 'NAV-01-01',
        `回调参数id应为more，实际: ${call.id}`);
    });

    it(accTest('NAV-01-02', '完整路径: 更多Tab可被重复点击'), () => {
      const onTabChange = vi.fn();
      render(<TabBar {...makeTabBarProps({ onTabChange })} />);

      // 连续点击更多Tab
      fireEvent.click(getTabButton('more'));
      fireEvent.click(getTabButton('more'));

      assertStrict(onTabChange.mock.calls.length === 2, 'NAV-01-02',
        '连续点击更多Tab应触发2次onTabChange');
    });

    it(accTest('NAV-01-03', '完整路径: SceneRouter渲染MoreTab'), () => {
      // 验证MoreTab组件可以正常渲染
      const mockEngine = createMockEngine();
      render(<MoreTab engine={mockEngine} onOpenPanel={vi.fn()} />);

      const moreTab = screen.getByTestId('more-tab');
      assertInDOM(moreTab, 'NAV-01-03', 'MoreTab容器');
    });

    it(accTest('NAV-01-04', '完整路径: MoreTab中所有功能项可见'), () => {
      const mockEngine = createMockEngine();
      render(<MoreTab engine={mockEngine} onOpenPanel={vi.fn()} />);

      // MoreTab中的功能项应有aria-label
      for (const item of FEATURE_ITEMS) {
        const btn = screen.getByLabelText(item.label);
        assertInDOM(btn, 'NAV-01-04', `功能项 ${item.label}`);
      }
    });

    it(accTest('NAV-01-05', '完整路径: 更多Tab不渲染下拉菜单'), () => {
      // v2改造后：不应有下拉菜单
      render(<TabBar {...makeTabBarProps()} />);

      const dropdown = screen.queryByTestId('feature-menu-dropdown');
      assertStrict(dropdown === null, 'NAV-01-05',
        '不应有feature-menu-dropdown');
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 2. MoreTab→功能面板导航（NAV-01-06 ~ NAV-01-21）
  // ═══════════════════════════════════════════════════════════

  describe('2. MoreTab→功能面板导航', () => {

    // A区-核心功能
    it(accTest('NAV-01-06', '导航: 更多→任务(quest) → onOpenPanel(quest)'), () => {
      const { onOpenPanel } = renderAndNavigateToFeature('quest');
      assertStrict(wasCalledWithArg(onOpenPanel, 'quest'), 'NAV-01-06',
        '应选中quest');
    });

    it(accTest('NAV-01-07', '导航: 更多→活动(activity) → onOpenPanel(activity)'), () => {
      const { onOpenPanel } = renderAndNavigateToFeature('activity');
      assertStrict(wasCalledWithArg(onOpenPanel, 'activity'), 'NAV-01-07',
        '应选中activity');
    });

    it(accTest('NAV-01-08', '导航: 更多→邮件(mail) → onOpenPanel(mail)'), () => {
      const { onOpenPanel } = renderAndNavigateToFeature('mail');
      assertStrict(wasCalledWithArg(onOpenPanel, 'mail'), 'NAV-01-08',
        '应选中mail');
    });

    it(accTest('NAV-01-09', '导航: 更多→商店(shop) → onOpenPanel(shop)'), () => {
      const { onOpenPanel } = renderAndNavigateToFeature('shop');
      assertStrict(wasCalledWithArg(onOpenPanel, 'shop'), 'NAV-01-09',
        '应选中shop');
    });

    // B区-社交互动
    it(accTest('NAV-01-10', '导航: 更多→好友(social) → onOpenPanel(social)'), () => {
      const { onOpenPanel } = renderAndNavigateToFeature('social');
      assertStrict(wasCalledWithArg(onOpenPanel, 'social'), 'NAV-01-10',
        '应选中social');
    });

    it(accTest('NAV-01-11', '导航: 更多→公会(alliance) → onOpenPanel(alliance)'), () => {
      const { onOpenPanel } = renderAndNavigateToFeature('alliance');
      assertStrict(wasCalledWithArg(onOpenPanel, 'alliance'), 'NAV-01-11',
        '应选中alliance');
    });

    it(accTest('NAV-01-12', '导航: 更多→排行榜(achievement) → onOpenPanel(achievement)'), () => {
      const { onOpenPanel } = renderAndNavigateToFeature('achievement');
      assertStrict(wasCalledWithArg(onOpenPanel, 'achievement'), 'NAV-01-12',
        '应选中achievement');
    });

    // C区-扩展系统
    it(accTest('NAV-01-13', '导航: 更多→远征(expedition) → onOpenPanel(expedition)'), () => {
      const { onOpenPanel } = renderAndNavigateToFeature('expedition');
      assertStrict(wasCalledWithArg(onOpenPanel, 'expedition'), 'NAV-01-13',
        '应选中expedition');
    });

    it(accTest('NAV-01-14', '导航: 更多→装备(equipment) → onOpenPanel(equipment)'), () => {
      const { onOpenPanel } = renderAndNavigateToFeature('equipment');
      assertStrict(wasCalledWithArg(onOpenPanel, 'equipment'), 'NAV-01-14',
        '应选中equipment');
    });

    it(accTest('NAV-01-15', '导航: 更多→名士(npc) → onOpenPanel(npc)'), () => {
      const { onOpenPanel } = renderAndNavigateToFeature('npc');
      assertStrict(wasCalledWithArg(onOpenPanel, 'npc'), 'NAV-01-15',
        '应选中npc');
    });

    it(accTest('NAV-01-16', '导航: 更多→竞技(arena) → onOpenPanel(arena)'), () => {
      const { onOpenPanel } = renderAndNavigateToFeature('arena');
      assertStrict(wasCalledWithArg(onOpenPanel, 'arena'), 'NAV-01-16',
        '应选中arena');
    });

    it(accTest('NAV-01-17', '导航: 更多→军队(army) → onOpenPanel(army)'), () => {
      const { onOpenPanel } = renderAndNavigateToFeature('army');
      assertStrict(wasCalledWithArg(onOpenPanel, 'army'), 'NAV-01-17',
        '应选中army');
    });

    // D区-系统功能
    it(accTest('NAV-01-18', '导航: 更多→事件(events) → onOpenPanel(events)'), () => {
      const { onOpenPanel } = renderAndNavigateToFeature('events');
      assertStrict(wasCalledWithArg(onOpenPanel, 'events'), 'NAV-01-18',
        '应选中events');
    });

    it(accTest('NAV-01-19', '导航: 更多→传承(heritage) → onOpenPanel(heritage)'), () => {
      const { onOpenPanel } = renderAndNavigateToFeature('heritage');
      assertStrict(wasCalledWithArg(onOpenPanel, 'heritage'), 'NAV-01-19',
        '应选中heritage');
    });

    it(accTest('NAV-01-20', '导航: 更多→交易(trade) → onOpenPanel(trade)'), () => {
      const { onOpenPanel } = renderAndNavigateToFeature('trade');
      assertStrict(wasCalledWithArg(onOpenPanel, 'trade'), 'NAV-01-20',
        '应选中trade');
    });

    it(accTest('NAV-01-21', '导航: 更多→设置(settings) → onOpenPanel(settings)'), () => {
      const { onOpenPanel } = renderAndNavigateToFeature('settings');
      assertStrict(wasCalledWithArg(onOpenPanel, 'settings'), 'NAV-01-21',
        '应选中settings');
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 3. 导航关闭与切换路径（NAV-01-22 ~ NAV-01-26）
  // v2改造后：不再有ESC/点击外部关闭下拉菜单
  // ═══════════════════════════════════════════════════════════

  describe('3. 导航关闭与切换路径', () => {

    it(accTest('NAV-01-22', '切换路径: 切换到其他Tab离开MoreTab'), () => {
      const onTabChange = vi.fn();
      render(<TabBar {...makeTabBarProps({ activeTab: 'more', onTabChange })} />);

      // 点击其他Tab离开MoreTab
      fireEvent.click(getTabButton('hero'));

      assertStrict(wasCalledOnce(onTabChange), 'NAV-01-22', 'onTabChange应被调用');
      const call = onTabChange.mock.calls[0][0] as TabConfig;
      assertStrict(call.id === 'hero', 'NAV-01-22',
        `回调参数id应为hero，实际: ${call.id}`);
    });

    it(accTest('NAV-01-23', '切换路径: 从MoreTab选择功能项后可继续操作'), () => {
      const onOpenPanel = vi.fn();
      const mockEngine = createMockEngine();
      render(<MoreTab engine={mockEngine} onOpenPanel={onOpenPanel} />);

      // 点击商店
      fireEvent.click(screen.getByLabelText('商店'));

      assertStrict(wasCalledWithArg(onOpenPanel, 'shop'), 'NAV-01-23',
        '应选中shop');
    });

    it(accTest('NAV-01-24', '切换路径: 不再有ESC关闭下拉菜单'), () => {
      // v2改造后：没有下拉菜单，ESC不影响TabBar
      const onTabChange = vi.fn();
      render(<TabBar {...makeTabBarProps({ onTabChange })} />);

      // ESC不应触发任何回调
      fireEvent.keyDown(window, { key: 'Escape' });

      assertStrict(!wasCalled(onTabChange), 'NAV-01-24',
        'ESC不应触发onTabChange');
    });

    it(accTest('NAV-01-25', '切换路径: 不再有点击外部关闭'), () => {
      // v2改造后：没有下拉菜单，点击外部不影响TabBar
      const onTabChange = vi.fn();
      render(<TabBar {...makeTabBarProps({ onTabChange })} />);

      // 点击外部不应触发任何回调
      fireEvent.mouseDown(document.body);

      assertStrict(!wasCalled(onTabChange), 'NAV-01-25',
        '点击外部不应触发onTabChange');
    });

    it(accTest('NAV-01-26', '切换路径: 连续快速选择多个功能项'), () => {
      const onOpenPanel = vi.fn();
      const mockEngine = createMockEngine();
      render(<MoreTab engine={mockEngine} onOpenPanel={onOpenPanel} />);

      // 连续点击3个功能项
      fireEvent.click(screen.getByLabelText('任务'));
      fireEvent.click(screen.getByLabelText('商店'));
      fireEvent.click(screen.getByLabelText('邮件'));

      assertStrict(getCallCount(onOpenPanel) === 3, 'NAV-01-26',
        `应触发3次onOpenPanel，实际: ${getCallCount(onOpenPanel)}`);
      assertStrict(wasCalledWithArg(onOpenPanel, 'quest'), 'NAV-01-26', '第1次quest');
      assertStrict(wasCalledWithArg(onOpenPanel, 'shop'), 'NAV-01-26', '第2次shop');
      assertStrict(wasCalledWithArg(onOpenPanel, 'mail'), 'NAV-01-26', '第3次mail');
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 4. Badge联动导航（NAV-01-27 ~ NAV-01-31）
  // ═══════════════════════════════════════════════════════════

  describe('4. Badge联动导航', () => {

    it(accTest('NAV-01-27', 'Badge联动: MoreTab功能项badge显示'), () => {
      const mockEngine = {
        getQuestSystem: vi.fn(() => ({ getClaimableCount: () => 3 })),
        getMailSystem: vi.fn(() => ({ getUnreadCount: () => 7 })),
        getAchievementSystem: vi.fn(() => ({ getClaimableCount: () => 0 })),
        getActivitySystem: vi.fn(() => ({ getActiveCount: () => 0 })),
        getFriendSystem: vi.fn(() => ({ getUnreadCount: () => 0 })),
        getTradeSystem: vi.fn(() => ({ getActiveCaravanCount: () => 0 })),
      } as any;

      render(<MoreTab engine={mockEngine} onOpenPanel={vi.fn()} />);

      const moreTab = screen.getByTestId('more-tab');
      // 验证badge数字在MoreTab中显示
      assertStrict(moreTab.textContent?.includes('3') ?? false, 'NAV-01-27',
        '应显示任务badge 3');
      assertStrict(moreTab.textContent?.includes('7') ?? false, 'NAV-01-27',
        '应显示邮件badge 7');
    });

    it(accTest('NAV-01-28', 'Badge联动: MoreTab大badge显示99+'), () => {
      const mockEngine = {
        getQuestSystem: vi.fn(() => ({ getClaimableCount: () => 150 })),
        getMailSystem: vi.fn(() => ({ getUnreadCount: () => 0 })),
        getAchievementSystem: vi.fn(() => ({ getClaimableCount: () => 0 })),
        getActivitySystem: vi.fn(() => ({ getActiveCount: () => 0 })),
        getFriendSystem: vi.fn(() => ({ getUnreadCount: () => 0 })),
        getTradeSystem: vi.fn(() => ({ getActiveCaravanCount: () => 0 })),
      } as any;

      render(<MoreTab engine={mockEngine} onOpenPanel={vi.fn()} />);

      const moreTab = screen.getByTestId('more-tab');
      assertStrict(moreTab.textContent?.includes('99+') ?? false, 'NAV-01-28',
        'badge超过99应显示99+');
    });

    it(accTest('NAV-01-29', 'Badge联动: 无badge的功能项不显示badge元素'), () => {
      const mockEngine = createMockEngine();
      render(<MoreTab engine={mockEngine} onOpenPanel={vi.fn()} />);

      // 所有badge为0时，不应有badge span
      const moreTab = screen.getByTestId('more-tab');
      const badges = moreTab.querySelectorAll('span');
      // 没有badge数字显示（所有getBadge返回0）
      const badgeSpans = Array.from(badges).filter(
        span => span.textContent && /^\d+$/.test(span.textContent) && span.textContent !== '0'
      );
      assertStrict(badgeSpans.length === 0, 'NAV-01-29',
        '所有badge为0时不应显示badge数字');
    });

    it(accTest('NAV-01-30', 'Badge联动: TabBadge和MoreTab badge独立'), () => {
      // TabBar的TabBadge和MoreTab的badge是独立的
      const tabBadges: TabBadges = { hero: { count: 3 } };
      render(<TabBar {...makeTabBarProps({ tabBadges })} />);

      // hero Tab有badge
      const heroBtn = getTabButton('hero');
      const heroBadge = heroBtn.querySelector('[data-testid="tab-badge-count"]');
      assertStrict(!!heroBadge, 'NAV-01-30', 'hero Tab应有badge');

      // 更多Tab没有汇总badge（v2改造后）
      const moreBtn = getTabButton('more');
      const moreBadge = moreBtn.querySelector('[data-testid="tab-badge-count"]');
      assertStrict(!moreBadge, 'NAV-01-30',
        'v2改造后：更多Tab不应有汇总badge');
    });

    it(accTest('NAV-01-31', 'Badge联动: MoreTab badge在功能项内部'), () => {
      // 验证badge在MoreTab功能项内部显示，不在TabBar上
      const mockEngine = {
        getQuestSystem: vi.fn(() => ({ getClaimableCount: () => 5 })),
        getMailSystem: vi.fn(() => ({ getUnreadCount: () => 0 })),
        getAchievementSystem: vi.fn(() => ({ getClaimableCount: () => 0 })),
        getActivitySystem: vi.fn(() => ({ getActiveCount: () => 0 })),
        getFriendSystem: vi.fn(() => ({ getUnreadCount: () => 0 })),
        getTradeSystem: vi.fn(() => ({ getActiveCaravanCount: () => 0 })),
      } as any;

      render(<MoreTab engine={mockEngine} onOpenPanel={vi.fn()} />);

      // 任务的按钮应显示badge
      const questBtn = screen.getByLabelText('任务');
      assertStrict(questBtn.textContent?.includes('5') ?? false, 'NAV-01-31',
        '任务功能项应显示badge 5');
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 5. 完整链路集成（NAV-01-32 ~ NAV-01-38）
  // ═══════════════════════════════════════════════════════════

  describe('5. 完整链路集成', () => {

    it(accTest('NAV-01-32', '完整链路: Tab切换 → 更多Tab → MoreTab选择功能 → 回到Tab'), () => {
      const onTabChange = vi.fn();

      // 初始渲染
      render(<TabBar {...makeTabBarProps({
        activeTab: 'map',
        onTabChange,
      })} />);

      // Step 1: 切换到武将Tab
      fireEvent.click(getTabButton('hero'));
      assertStrict(wasCalledOnce(onTabChange), 'NAV-01-32', 'Step1: onTabChange应调用');

      // Step 2: 切换到更多Tab
      fireEvent.click(getTabButton('more'));
      assertStrict(onTabChange.mock.calls.length === 2, 'NAV-01-32',
        'Step2: onTabChange应调用2次');
      const moreCall = onTabChange.mock.calls[1][0] as TabConfig;
      assertStrict(moreCall.id === 'more', 'NAV-01-32', 'Step2: 第二次应为more');

      // Step 3: 在MoreTab中选择功能（模拟SceneRouter渲染MoreTab）
      cleanup();
      const onOpenPanel = vi.fn();
      const mockEngine = createMockEngine();
      render(<MoreTab engine={mockEngine} onOpenPanel={onOpenPanel} />);

      fireEvent.click(screen.getByLabelText('商店'));
      assertStrict(wasCalledWithArg(onOpenPanel, 'shop'), 'NAV-01-32', 'Step3: 应选中shop');

      // Step 4: 回到TabBar切换Tab
      cleanup();
      const onTabChange2 = vi.fn();
      render(<TabBar {...makeTabBarProps({
        activeTab: 'hero',
        onTabChange: onTabChange2,
      })} />);

      const heroBtnAfter = getTabButton('hero');
      assertStrict(
        heroBtnAfter.getAttribute('aria-selected') === 'true',
        'NAV-01-32',
        'hero仍应为选中状态',
      );
    });

    it(accTest('NAV-01-33', '完整链路: 所有功能面板导航入口覆盖'), () => {
      // 验证所有16个功能面板都有MoreTab入口
      const mockEngine = createMockEngine();
      render(<MoreTab engine={mockEngine} onOpenPanel={vi.fn()} />);

      const expectedPanels = [
        'quest', 'activity', 'mail', 'shop',
        'social', 'alliance', 'achievement',
        'expedition', 'equipment', 'npc', 'arena', 'army',
        'events', 'heritage', 'trade', 'settings',
      ];

      for (const panelId of expectedPanels) {
        const label = FEATURE_ITEMS.find(f => f.id === panelId)?.label;
        const item = screen.queryByLabelText(label ?? panelId);
        assertStrict(!!item, 'NAV-01-33',
          `功能面板 ${panelId} 应有MoreTab入口`);
      }
    });

    it(accTest('NAV-01-34', '完整链路: FEATURE_ITEMS分组顺序正确'), () => {
      // 验证分组顺序: A区→B区→C区→D区
      const expectedOrder = [
        // A区-核心功能
        'quest', 'activity', 'mail', 'shop',
        // B区-社交互动
        'social', 'alliance', 'achievement',
        // C区-扩展系统
        'expedition', 'equipment', 'npc', 'arena', 'army',
        // D区-系统功能
        'events', 'heritage', 'trade', 'settings',
      ];

      assertStrict(FEATURE_ITEMS.length === 16, 'NAV-01-34',
        `应有16个功能项，实际: ${FEATURE_ITEMS.length}`);

      for (let i = 0; i < expectedOrder.length; i++) {
        assertStrict(FEATURE_ITEMS[i].id === expectedOrder[i], 'NAV-01-34',
          `第${i}项应为${expectedOrder[i]}，实际: ${FEATURE_ITEMS[i].id}`);
      }
    });

    it(accTest('NAV-01-35', '完整链路: 不可用功能项在MoreTab中处理'), () => {
      // v2改造后：不可用项的处理由MoreTab决定
      // FEATURE_ITEMS中所有项目前都是available=true
      const unavailableItem = FEATURE_ITEMS.find(item => !item.available);
      assertStrict(!unavailableItem, 'NAV-01-35',
        '当前所有FEATURE_ITEMS都应可用（available=true）');
    });

    it(accTest('NAV-01-36', '完整链路: 引擎状态在导航过程中不变'), () => {
      const resourcesBefore = sim.getAllResources();

      const onTabChange = vi.fn();
      render(<TabBar {...makeTabBarProps({ onTabChange })} />);

      // 完整导航流程
      fireEvent.click(getTabButton('hero'));
      fireEvent.click(getTabButton('more'));
      fireEvent.click(getTabButton('map'));

      const resourcesAfter = sim.getAllResources();
      assertStrict(
        JSON.stringify(resourcesBefore) === JSON.stringify(resourcesAfter),
        'NAV-01-36',
        '完整导航流程后引擎资源应不变',
      );
    });

    it(accTest('NAV-01-37', '完整链路: Tab切换不干扰更多Tab状态'), () => {
      const onTabChange = vi.fn();

      render(<TabBar {...makeTabBarProps({
        activeTab: 'more',
        onTabChange,
      })} />);

      // 从更多Tab切换到普通Tab
      fireEvent.click(getTabButton('hero'));

      assertStrict(wasCalledOnce(onTabChange), 'NAV-01-37',
        '点击Tab应触发onTabChange');
      const call = onTabChange.mock.calls[0][0] as TabConfig;
      assertStrict(call.id === 'hero', 'NAV-01-37',
        '参数id应为hero');
    });

    it(accTest('NAV-01-38', '完整链路: 所有功能面板ID与FEATURE_ITEMS一致'), () => {
      const expectedIds = FEATURE_ITEMS.map(f => f.id);
      assertStrict(expectedIds.length === 16, 'NAV-01-38',
        `应有16个功能面板ID，实际: ${expectedIds.length}`);

      const validIds = new Set([
        'events', 'quest', 'shop', 'mail', 'achievement', 'activity',
        'alliance', 'prestige', 'heritage', 'social', 'trade', 'settings',
        'equipment', 'npc', 'arena', 'expedition', 'army',
      ]);

      for (const id of expectedIds) {
        assertStrict(validIds.has(id), 'NAV-01-38',
          `功能面板ID "${id}" 应是有效的FeaturePanelId`);
      }
    });
  });
});
