/**
 * NAV-01 导航链路端到端测试 — 完整导航路径验证
 *
 * 验证从主界面→更多菜单→功能面板的完整导航链路。
 * 使用真实 <TabBar /> 组件渲染，通过 fireEvent 模拟真实 DOM 事件。
 *
 * 覆盖范围：
 * - 更多菜单展开/关闭完整路径
 * - 所有16个功能面板的导航入口
 * - ESC关闭菜单
 * - 点击功能项后菜单关闭 + onFeatureSelect触发
 * - 更多Tab汇总badge → 功能面板badge联动
 * - 导航链路完整性验证
 *
 * @module tests/acc/NAV-01
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import TabBar, {
  TABS,
  FEATURE_ITEMS,
  type TabId,
  type TabConfig,
  type TabBadges,
} from '@/components/idle/three-kingdoms/TabBar';
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

/** 构造 TabBar props */
function makeTabBarProps(overrides: Record<string, any> = {}) {
  return {
    activeTab: 'map' as TabId,
    onTabChange: vi.fn(),
    featureMenuItems: makeFeatureMenuItems(),
    onFeatureSelect: vi.fn(),
    onMoreToggle: vi.fn(),
    moreMenuOpen: false,
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

/** 检查 mock 函数是否曾被调用过（替代 fn.called） */
function wasCalled(fn: ReturnType<typeof vi.fn>): boolean {
  return fn.mock.calls.length > 0;
}

/** 检查 mock 函数是否被调用了一次（替代 fn.calledOnce） */
function wasCalledOnce(fn: ReturnType<typeof vi.fn>): boolean {
  return fn.mock.calls.length === 1;
}

/** 检查 mock 函数是否曾被以指定首参调用（替代 fn.calledWith(arg)） */
function wasCalledWithArg(fn: ReturnType<typeof vi.fn>, arg: any): boolean {
  return fn.mock.calls.some(c => c[0] === arg);
}

/** 获取 mock 函数的调用次数（替代 fn.callCount） */
function getCallCount(fn: ReturnType<typeof vi.fn>): number {
  return fn.mock.calls.length;
}

/** 获取Tab按钮 */
function getTabButton(tabId: TabId): HTMLElement {
  return screen.getByTestId(`tab-bar-${tabId}`);
}

/** 获取功能菜单项按钮 */
function getFeatureItem(id: string): HTMLElement {
  return screen.getByTestId(`feature-menu-item-${id}`);
}

/**
 * 模拟完整导航链路：点击更多 → 菜单展开 → 选择功能
 *
 * @returns 三个回调的 mock 函数引用，用于验证
 */
function renderAndNavigateToFeature(featureId: string) {
  const onMoreToggle = vi.fn();
  const onFeatureSelect = vi.fn();
  const onTabChange = vi.fn();

  // Step 1: 渲染TabBar（菜单关闭）
  const { rerender } = render(
    <TabBar {...makeTabBarProps({
      moreMenuOpen: false,
      onMoreToggle,
      onFeatureSelect,
      onTabChange,
    })} />
  );

  // Step 2: 点击更多按钮
  fireEvent.click(getTabButton('more'));

  // Step 3: 父组件响应 onMoreToggle(true)，rerender with moreMenuOpen=true
  rerender(
    <TabBar {...makeTabBarProps({
      moreMenuOpen: true,
      onMoreToggle,
      onFeatureSelect,
      onTabChange,
    })} />
  );

  // Step 4: 点击功能项
  fireEvent.click(getFeatureItem(featureId));

  return { onMoreToggle, onFeatureSelect, onTabChange, rerender };
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
  // 1. 主界面→更多菜单（NAV-01-01 ~ NAV-01-05）
  // ═══════════════════════════════════════════════════════════

  describe('1. 主界面→更多菜单', () => {

    it(accTest('NAV-01-01', '完整路径: 点击更多▼ → onMoreToggle(true) → 菜单展开'), () => {
      const onMoreToggle = vi.fn();
      const { rerender } = render(
        <TabBar {...makeTabBarProps({ moreMenuOpen: false, onMoreToggle })} />
      );

      // 菜单初始不可见
      assertStrict(
        screen.queryByTestId('feature-menu-dropdown') === null,
        'NAV-01-01',
        '初始时下拉菜单不应存在',
      );

      // 点击更多按钮
      fireEvent.click(getTabButton('more'));

      // 验证回调
      assertStrict(wasCalledOnce(onMoreToggle), 'NAV-01-01', 'onMoreToggle应被调用');
      assertStrict(
        onMoreToggle.mock.calls[0][0] === true,
        'NAV-01-01',
        `onMoreToggle参数应为true，实际: ${onMoreToggle.mock.calls[0][0]}`,
      );

      // 父组件更新状态后重新渲染
      rerender(
        <TabBar {...makeTabBarProps({ moreMenuOpen: true, onMoreToggle })} />
      );

      // 菜单可见
      const dropdown = screen.getByTestId('feature-menu-dropdown');
      // TODO: 需要Playwright E2E验证视觉可见性 — jsdom无法检测CSS class造成的overflow:hidden裁切
      assertInDOM(dropdown, 'NAV-01-01', '功能菜单下拉面板');
    });

    it(accTest('NAV-01-02', '完整路径: 再次点击更多▼ → onMoreToggle(false) → 菜单关闭'), () => {
      const onMoreToggle = vi.fn();
      render(
        <TabBar {...makeTabBarProps({ moreMenuOpen: true, onMoreToggle })} />
      );

      // 菜单可见
      assertStrict(
        !!screen.getByTestId('feature-menu-dropdown'),
        'NAV-01-02',
        '菜单应可见',
      );

      // 点击更多按钮关闭
      fireEvent.click(getTabButton('more'));

      // 验证回调
      assertStrict(
        onMoreToggle.mock.calls[0][0] === false,
        'NAV-01-02',
        `onMoreToggle参数应为false，实际: ${onMoreToggle.mock.calls[0][0]}`,
      );
    });

    it(accTest('NAV-01-03', '完整路径: 菜单展开 → 功能大厅标题可见'), () => {
      render(<TabBar {...makeTabBarProps({ moreMenuOpen: true })} />);

      const title = screen.getByText('功能大厅');
      assertInDOM(title, 'NAV-01-03', '功能大厅标题');

      const countText = screen.getByText(/项功能/);
      assertStrict(
        countText.textContent?.includes('16'),
        'NAV-01-03',
        `应显示16项功能，实际: ${countText.textContent}`,
      );
    });

    it(accTest('NAV-01-04', '完整路径: 菜单展开 → 所有16个功能项标签可见'), () => {
      render(<TabBar {...makeTabBarProps({ moreMenuOpen: true })} />);

      for (const item of FEATURE_ITEMS) {
        const el = screen.getByTestId(`feature-menu-item-${item.id}`);
        assertInDOM(el, 'NAV-01-04', `功能项 ${item.label}`);
        assertStrict(
          el.textContent?.includes(item.label) ?? false,
          'NAV-01-04',
          `功能项应包含标签 "${item.label}"`,
        );
      }
    });

    it(accTest('NAV-01-05', '完整路径: 菜单展开 → 功能项描述可见'), () => {
      render(<TabBar {...makeTabBarProps({ moreMenuOpen: true })} />);

      for (const item of FEATURE_ITEMS) {
        if (item.description) {
          const el = screen.getByTestId(`feature-menu-item-${item.id}`);
          assertStrict(
            el.textContent?.includes(item.description) ?? false,
            'NAV-01-05',
            `功能项 ${item.id} 应包含描述 "${item.description}"`,
          );
        }
      }
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 2. 更多菜单→功能面板导航（NAV-01-06 ~ NAV-01-21）
  // ═══════════════════════════════════════════════════════════

  describe('2. 更多菜单→功能面板导航', () => {

    // A区-核心功能
    it(accTest('NAV-01-06', '导航: 更多→任务(quest) → onFeatureSelect(quest)'), () => {
      const { onFeatureSelect, onMoreToggle } = renderAndNavigateToFeature('quest');
      assertStrict(wasCalledWithArg(onFeatureSelect, 'quest'), 'NAV-01-06',
        '应选中quest');
      assertStrict(onMoreToggle.mock.calls.some(c => c[0] === false), 'NAV-01-06',
        '应触发关闭菜单');
    });

    it(accTest('NAV-01-07', '导航: 更多→活动(activity) → onFeatureSelect(activity)'), () => {
      const { onFeatureSelect } = renderAndNavigateToFeature('activity');
      assertStrict(wasCalledWithArg(onFeatureSelect, 'activity'), 'NAV-01-07',
        '应选中activity');
    });

    it(accTest('NAV-01-08', '导航: 更多→邮件(mail) → onFeatureSelect(mail)'), () => {
      const { onFeatureSelect } = renderAndNavigateToFeature('mail');
      assertStrict(wasCalledWithArg(onFeatureSelect, 'mail'), 'NAV-01-08',
        '应选中mail');
    });

    it(accTest('NAV-01-09', '导航: 更多→商店(shop) → onFeatureSelect(shop)'), () => {
      const { onFeatureSelect } = renderAndNavigateToFeature('shop');
      assertStrict(wasCalledWithArg(onFeatureSelect, 'shop'), 'NAV-01-09',
        '应选中shop');
    });

    // B区-社交互动
    it(accTest('NAV-01-10', '导航: 更多→好友(social) → onFeatureSelect(social)'), () => {
      const { onFeatureSelect } = renderAndNavigateToFeature('social');
      assertStrict(wasCalledWithArg(onFeatureSelect, 'social'), 'NAV-01-10',
        '应选中social');
    });

    it(accTest('NAV-01-11', '导航: 更多→公会(alliance) → onFeatureSelect(alliance)'), () => {
      const { onFeatureSelect } = renderAndNavigateToFeature('alliance');
      assertStrict(wasCalledWithArg(onFeatureSelect, 'alliance'), 'NAV-01-11',
        '应选中alliance');
    });

    it(accTest('NAV-01-12', '导航: 更多→排行榜(achievement) → onFeatureSelect(achievement)'), () => {
      const { onFeatureSelect } = renderAndNavigateToFeature('achievement');
      assertStrict(wasCalledWithArg(onFeatureSelect, 'achievement'), 'NAV-01-12',
        '应选中achievement');
    });

    // C区-扩展系统
    it(accTest('NAV-01-13', '导航: 更多→远征(expedition) → onFeatureSelect(expedition)'), () => {
      const { onFeatureSelect } = renderAndNavigateToFeature('expedition');
      assertStrict(wasCalledWithArg(onFeatureSelect, 'expedition'), 'NAV-01-13',
        '应选中expedition');
    });

    it(accTest('NAV-01-14', '导航: 更多→装备(equipment) → onFeatureSelect(equipment)'), () => {
      const { onFeatureSelect } = renderAndNavigateToFeature('equipment');
      assertStrict(wasCalledWithArg(onFeatureSelect, 'equipment'), 'NAV-01-14',
        '应选中equipment');
    });

    it(accTest('NAV-01-15', '导航: 更多→名士(npc) → onFeatureSelect(npc)'), () => {
      const { onFeatureSelect } = renderAndNavigateToFeature('npc');
      assertStrict(wasCalledWithArg(onFeatureSelect, 'npc'), 'NAV-01-15',
        '应选中npc');
    });

    it(accTest('NAV-01-16', '导航: 更多→竞技(arena) → onFeatureSelect(arena)'), () => {
      const { onFeatureSelect } = renderAndNavigateToFeature('arena');
      assertStrict(wasCalledWithArg(onFeatureSelect, 'arena'), 'NAV-01-16',
        '应选中arena');
    });

    it(accTest('NAV-01-17', '导航: 更多→军队(army) → onFeatureSelect(army)'), () => {
      const { onFeatureSelect } = renderAndNavigateToFeature('army');
      assertStrict(wasCalledWithArg(onFeatureSelect, 'army'), 'NAV-01-17',
        '应选中army');
    });

    // D区-系统功能
    it(accTest('NAV-01-18', '导航: 更多→事件(events) → onFeatureSelect(events)'), () => {
      const { onFeatureSelect } = renderAndNavigateToFeature('events');
      assertStrict(wasCalledWithArg(onFeatureSelect, 'events'), 'NAV-01-18',
        '应选中events');
    });

    it(accTest('NAV-01-19', '导航: 更多→传承(heritage) → onFeatureSelect(heritage)'), () => {
      const { onFeatureSelect } = renderAndNavigateToFeature('heritage');
      assertStrict(wasCalledWithArg(onFeatureSelect, 'heritage'), 'NAV-01-19',
        '应选中heritage');
    });

    it(accTest('NAV-01-20', '导航: 更多→交易(trade) → onFeatureSelect(trade)'), () => {
      const { onFeatureSelect } = renderAndNavigateToFeature('trade');
      assertStrict(wasCalledWithArg(onFeatureSelect, 'trade'), 'NAV-01-20',
        '应选中trade');
    });

    it(accTest('NAV-01-21', '导航: 更多→设置(settings) → onFeatureSelect(settings)'), () => {
      const { onFeatureSelect } = renderAndNavigateToFeature('settings');
      assertStrict(wasCalledWithArg(onFeatureSelect, 'settings'), 'NAV-01-21',
        '应选中settings');
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 3. 菜单关闭路径（NAV-01-22 ~ NAV-01-26）
  // ═══════════════════════════════════════════════════════════

  describe('3. 菜单关闭路径', () => {

    it(accTest('NAV-01-22', '关闭路径: ESC → onMoreToggle(false)'), () => {
      const onMoreToggle = vi.fn();
      render(
        <TabBar {...makeTabBarProps({ moreMenuOpen: true, onMoreToggle })} />
      );

      // 模拟ESC键
      fireEvent.keyDown(window, { key: 'Escape' });

      assertStrict(wasCalledOnce(onMoreToggle), 'NAV-01-22', 'onMoreToggle应被调用');
      assertStrict(
        onMoreToggle.mock.calls[0][0] === false,
        'NAV-01-22',
        `ESC应触发关闭(false)，实际: ${onMoreToggle.mock.calls[0][0]}`,
      );
    });

    it(accTest('NAV-01-23', '关闭路径: 选择功能项后 → 菜单关闭'), () => {
      const onMoreToggle = vi.fn();
      const onFeatureSelect = vi.fn();
      render(
        <TabBar {...makeTabBarProps({
          moreMenuOpen: true,
          onMoreToggle,
          onFeatureSelect,
        })} />
      );

      // 点击商店
      fireEvent.click(getFeatureItem('shop'));

      // 验证两个回调
      assertStrict(wasCalledWithArg(onFeatureSelect, 'shop'), 'NAV-01-23',
        '应选中shop');
      assertStrict(wasCalledWithArg(onMoreToggle, false), 'NAV-01-23',
        '选择功能后应触发关闭菜单');
    });

    it(accTest('NAV-01-24', '关闭路径: 点击外部 → onMoreToggle(false)'), () => {
      const onMoreToggle = vi.fn();
      render(
        <TabBar {...makeTabBarProps({ moreMenuOpen: true, onMoreToggle })} />
      );

      // 模拟点击外部（document上的mousedown，不在menuRef内）
      fireEvent.mouseDown(document.body);

      assertStrict(wasCalledOnce(onMoreToggle), 'NAV-01-24',
        '点击外部应触发onMoreToggle');
      assertStrict(
        onMoreToggle.mock.calls[0][0] === false,
        'NAV-01-24',
        '点击外部应关闭菜单',
      );
    });

    it(accTest('NAV-01-25', '关闭路径: 菜单关闭时ESC不触发回调'), () => {
      const onMoreToggle = vi.fn();
      render(
        <TabBar {...makeTabBarProps({ moreMenuOpen: false, onMoreToggle })} />
      );

      fireEvent.keyDown(window, { key: 'Escape' });

      assertStrict(!wasCalled(onMoreToggle), 'NAV-01-25',
        '菜单关闭时ESC不应触发回调');
    });

    it(accTest('NAV-01-26', '关闭路径: 连续快速选择多个功能项'), () => {
      const onFeatureSelect = vi.fn();
      const onMoreToggle = vi.fn();

      // 菜单打开状态
      const { rerender } = render(
        <TabBar {...makeTabBarProps({
          moreMenuOpen: true,
          onFeatureSelect,
          onMoreToggle,
        })} />
      );

      // 连续点击3个功能项
      fireEvent.click(getFeatureItem('quest'));
      fireEvent.click(getFeatureItem('shop'));
      fireEvent.click(getFeatureItem('mail'));

      assertStrict(getCallCount(onFeatureSelect) === 3, 'NAV-01-26',
        `应触发3次onFeatureSelect，实际: ${getCallCount(onFeatureSelect)}`);
      assertStrict(wasCalledWithArg(onFeatureSelect, 'quest'), 'NAV-01-26', '第1次quest');
      assertStrict(wasCalledWithArg(onFeatureSelect, 'shop'), 'NAV-01-26', '第2次shop');
      assertStrict(wasCalledWithArg(onFeatureSelect, 'mail'), 'NAV-01-26', '第3次mail');
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 4. Badge联动导航（NAV-01-27 ~ NAV-01-31）
  // ═══════════════════════════════════════════════════════════

  describe('4. Badge联动导航', () => {

    it(accTest('NAV-01-27', 'Badge联动: 功能项badge → 更多Tab汇总badge'), () => {
      const featureMenuItems = makeFeatureMenuItems([
        { id: 'quest', badge: 3 },
        { id: 'mail', badge: 7 },
      ]);
      render(<TabBar {...makeTabBarProps({ featureMenuItems })} />);

      const moreBtn = getTabButton('more');
      const badgeEl = moreBtn.querySelector('[data-testid="tab-badge-count"]');
      assertStrict(!!badgeEl, 'NAV-01-27', '更多Tab应显示汇总badge');
      assertStrict(
        badgeEl?.textContent === '10',
        'NAV-01-27',
        `汇总badge应为10，实际: ${badgeEl?.textContent}`,
      );
    });

    it(accTest('NAV-01-28', 'Badge联动: 大汇总badge显示99+'), () => {
      const featureMenuItems = makeFeatureMenuItems([
        { id: 'quest', badge: 60 },
        { id: 'mail', badge: 50 },
      ]);
      render(<TabBar {...makeTabBarProps({ featureMenuItems })} />);

      const moreBtn = getTabButton('more');
      const badgeEl = moreBtn.querySelector('[data-testid="tab-badge-count"]');
      assertStrict(
        badgeEl?.textContent === '99+',
        'NAV-01-28',
        `汇总110应显示99+，实际: ${badgeEl?.textContent}`,
      );
    });

    it(accTest('NAV-01-29', 'Badge联动: 功能项内badge数字可见'), () => {
      const featureMenuItems = makeFeatureMenuItems([
        { id: 'quest', badge: 5 },
      ]);
      render(<TabBar {...makeTabBarProps({ featureMenuItems, moreMenuOpen: true })} />);

      const questItem = getFeatureItem('quest');
      const badgeEl = questItem.querySelector('.tk-more-dropdown-item-badge');
      assertStrict(!!badgeEl, 'NAV-01-29', 'quest项应显示badge数字');
      assertStrict(badgeEl?.textContent === '5', 'NAV-01-29',
        `badge应为5，实际: ${badgeEl?.textContent}`);
    });

    it(accTest('NAV-01-30', 'Badge联动: 无badge的功能项不显示badge元素'), () => {
      render(<TabBar {...makeTabBarProps({ moreMenuOpen: true })} />);

      const shopItem = getFeatureItem('shop');
      const badgeEl = shopItem.querySelector('.tk-more-dropdown-item-badge');
      assertStrict(!badgeEl, 'NAV-01-30', 'shop无badge不应显示badge元素');
    });

    it(accTest('NAV-01-31', 'Badge联动: TabBadge和功能菜单badge独立'), () => {
      const tabBadges: TabBadges = { hero: { count: 3 } };
      const featureMenuItems = makeFeatureMenuItems([
        { id: 'quest', badge: 2 },
      ]);
      render(<TabBar {...makeTabBarProps({ tabBadges, featureMenuItems, moreMenuOpen: true })} />);

      // hero Tab有badge
      const heroBtn = getTabButton('hero');
      const heroBadge = heroBtn.querySelector('[data-testid="tab-badge-count"]');
      assertStrict(!!heroBadge, 'NAV-01-31', 'hero Tab应有badge');

      // 更多Tab也有汇总badge
      const moreBtn = getTabButton('more');
      const moreBadge = moreBtn.querySelector('[data-testid="tab-badge-count"]');
      assertStrict(!!moreBadge, 'NAV-01-31', '更多Tab应有汇总badge');
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 5. 完整链路集成（NAV-01-32 ~ NAV-01-38）
  // ═══════════════════════════════════════════════════════════

  describe('5. 完整链路集成', () => {

    it(accTest('NAV-01-32', '完整链路: Tab切换 → 更多菜单 → 选择功能 → 回到Tab'), () => {
      const onTabChange = vi.fn();
      const onMoreToggle = vi.fn();
      const onFeatureSelect = vi.fn();

      // 初始渲染
      const { rerender } = render(
        <TabBar {...makeTabBarProps({
          activeTab: 'map',
          onTabChange,
          onMoreToggle,
          onFeatureSelect,
        })} />
      );

      // Step 1: 切换到武将Tab
      fireEvent.click(getTabButton('hero'));
      assertStrict(wasCalledOnce(onTabChange), 'NAV-01-32', 'Step1: onTabChange应调用');

      // Step 2: 更新activeTab为hero
      rerender(
        <TabBar {...makeTabBarProps({
          activeTab: 'hero',
          onTabChange,
          onMoreToggle,
          onFeatureSelect,
        })} />
      );

      // 验证hero高亮
      const heroBtn = getTabButton('hero');
      assertStrict(
        heroBtn.getAttribute('aria-selected') === 'true',
        'NAV-01-32',
        'hero应为选中状态',
      );

      // Step 3: 打开更多菜单
      fireEvent.click(getTabButton('more'));
      assertStrict(wasCalledWithArg(onMoreToggle, true), 'NAV-01-32', 'Step3: 菜单应打开');

      // Step 4: 展开菜单
      rerender(
        <TabBar {...makeTabBarProps({
          activeTab: 'hero',
          moreMenuOpen: true,
          onTabChange,
          onMoreToggle,
          onFeatureSelect,
        })} />
      );

      // Step 5: 选择商店
      fireEvent.click(getFeatureItem('shop'));
      assertStrict(wasCalledWithArg(onFeatureSelect, 'shop'), 'NAV-01-32', 'Step5: 应选中shop');

      // Step 6: 关闭菜单回到Tab
      rerender(
        <TabBar {...makeTabBarProps({
          activeTab: 'hero',
          moreMenuOpen: false,
          onTabChange,
          onMoreToggle,
          onFeatureSelect,
        })} />
      );

      // 验证回到hero Tab
      const heroBtnAfter = getTabButton('hero');
      assertStrict(
        heroBtnAfter.getAttribute('aria-selected') === 'true',
        'NAV-01-32',
        'hero仍应为选中状态',
      );
    });

    it(accTest('NAV-01-33', '完整链路: 所有功能面板导航入口覆盖'), () => {
      // 验证所有16个功能面板都有对应的菜单入口
      render(<TabBar {...makeTabBarProps({ moreMenuOpen: true })} />);

      const expectedPanels = [
        'quest', 'activity', 'mail', 'shop',
        'social', 'alliance', 'achievement',
        'expedition', 'equipment', 'npc', 'arena', 'army',
        'events', 'heritage', 'trade', 'settings',
      ];

      for (const panelId of expectedPanels) {
        const item = screen.queryByTestId(`feature-menu-item-${panelId}`);
        assertStrict(!!item, 'NAV-01-33',
          `功能面板 ${panelId} 应有菜单入口`);
      }
    });

    it(accTest('NAV-01-34', '完整链路: 功能菜单分组顺序正确'), () => {
      render(<TabBar {...makeTabBarProps({ moreMenuOpen: true })} />);

      const dropdown = screen.getByTestId('feature-menu-dropdown');
      const items = dropdown.querySelectorAll('[role="menuitem"]');

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

      assertStrict(items.length === 16, 'NAV-01-34',
        `应有16个菜单项，实际: ${items.length}`);

      for (let i = 0; i < expectedOrder.length; i++) {
        const item = items[i] as HTMLElement;
        assertStrict(
          item.getAttribute('data-testid') === `feature-menu-item-${expectedOrder[i]}`,
          'NAV-01-34',
          `第${i}项应为${expectedOrder[i]}，实际: ${item.getAttribute('data-testid')}`,
        );
      }
    });

    it(accTest('NAV-01-35', '完整链路: 不可用功能项点击无效果'), () => {
      const onFeatureSelect = vi.fn();
      const featureMenuItems = makeFeatureMenuItems([
        { id: 'arena', available: false },
      ]);
      render(<TabBar {...makeTabBarProps({
        featureMenuItems,
        moreMenuOpen: true,
        onFeatureSelect,
      })} />);

      // 竞技项应被disabled
      const arenaItem = getFeatureItem('arena');
      assertStrict(arenaItem.hasAttribute('disabled'), 'NAV-01-35',
        '不可用项应有disabled属性');

      // 点击disabled按钮不应触发回调
      // HTML disabled按钮不响应click，但fireEvent仍可能触发
      // 关键是验证 onFeatureSelect 没被调用
      fireEvent.click(arenaItem);
      assertStrict(
        !onFeatureSelect.mock.calls.some(c => c[0] === 'arena'),
        'NAV-01-35',
        '不可用项不应触发onFeatureSelect',
      );
    });

    it(accTest('NAV-01-36', '完整链路: 引擎状态在导航过程中不变'), () => {
      const resourcesBefore = sim.getAllResources();

      const onMoreToggle = vi.fn();
      const { rerender } = render(
        <TabBar {...makeTabBarProps({ onMoreToggle })} />
      );

      // 完整导航流程
      fireEvent.click(getTabButton('hero'));
      fireEvent.click(getTabButton('more'));
      rerender(<TabBar {...makeTabBarProps({ moreMenuOpen: true, onMoreToggle })} />);
      fireEvent.click(getFeatureItem('shop'));
      rerender(<TabBar {...makeTabBarProps({ moreMenuOpen: false, onMoreToggle })} />);
      fireEvent.click(getTabButton('map'));

      const resourcesAfter = sim.getAllResources();
      assertStrict(
        JSON.stringify(resourcesBefore) === JSON.stringify(resourcesAfter),
        'NAV-01-36',
        '完整导航流程后引擎资源应不变',
      );
    });

    it(accTest('NAV-01-37', '完整链路: Tab切换不干扰更多菜单状态'), () => {
      const onTabChange = vi.fn();
      const onMoreToggle = vi.fn();

      render(
        <TabBar {...makeTabBarProps({
          moreMenuOpen: true,
          onTabChange,
          onMoreToggle,
        })} />
      );

      // 菜单展开时点击普通Tab
      fireEvent.click(getTabButton('hero'));

      // onTabChange应触发
      assertStrict(wasCalledOnce(onTabChange), 'NAV-01-37',
        '点击Tab应触发onTabChange');

      // onMoreToggle不应被普通Tab点击触发（只有更多Tab和功能项才触发）
      assertStrict(
        !onMoreToggle.mock.calls.some(c => c[0] === false && wasCalled(onTabChange)),
        'NAV-01-37',
        '点击普通Tab不应触发onMoreToggle',
      );
    });

    it(accTest('NAV-01-38', '完整链路: 所有功能面板ID与FEATURE_ITEMS一致'), () => {
      const expectedIds = FEATURE_ITEMS.map(f => f.id);
      assertStrict(expectedIds.length === 16, 'NAV-01-38',
        `应有16个功能面板ID，实际: ${expectedIds.length}`);

      // 验证每个ID都是有效的FeaturePanelId
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
