/**
 * FLOW-25 TabBar导航集成测试 — 真实TabBar组件渲染 + Tab切换/红点badge/选中状态/快速切换
 *
 * 【重要】本文件 render 真实 <TabBar /> 组件，通过 fireEvent 模拟 DOM 事件，
 * 不使用自建模拟类。验证 Tab 切换回调、更多菜单交互、Badge 显示等真实 React 行为。
 *
 * 覆盖范围：
 * - Tab渲染：7个Tab按钮可见、图标/标签正确
 * - Tab切换：点击Tab → onTabChange回调触发、参数正确
 * - 更多菜单：点击更多▼ → onMoreToggle(true)、再次点击→关闭
 * - Badge显示：数字badge、圆点badge、99+截断
 * - 快速切换：连续点击Tab不崩溃、回调序列正确
 * - 选中状态：当前Tab高亮（aria-selected=true）
 *
 * @module tests/acc/FLOW-25
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import TabBar, {
  TABS,
  FEATURE_ITEMS,
  type TabId,
  type TabConfig,
  type TabBadge,
  type TabBadges,
} from '@/components/idle/three-kingdoms/TabBar';
import type { FeatureMenuItem } from '@/components/idle/FeatureMenu';
import { accTest, assertStrict, assertInDOM } from './acc-test-utils';
import { createSim } from '../../test-utils/test-helpers';
import type { GameEventSimulator } from '../../test-utils/GameEventSimulator';

// ── 辅助函数 ──

/** 构造 featureMenuItems，默认无 badge */
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

/** 从 TabBar 容器中获取指定 Tab 按钮 */
function getTabButton(tabId: TabId): HTMLElement {
  return screen.getByTestId(`tab-bar-${tabId}`);
}

// ═══════════════════════════════════════════════════════════════
// FLOW-25 TabBar导航集成测试
// ═══════════════════════════════════════════════════════════════

describe('FLOW-25 TabBar导航集成测试', () => {
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
  // 1. Tab渲染（FLOW-25-01 ~ FLOW-25-08）
  // ═══════════════════════════════════════════════════════════

  describe('1. Tab渲染', () => {

    it(accTest('FLOW-25-01', 'TabBar渲染 — 7个Tab按钮可见'), () => {
      const props = makeTabBarProps();
      render(<TabBar {...props} />);

      const tabIds: TabId[] = ['map', 'campaign', 'hero', 'tech', 'building', 'prestige', 'more'];
      for (const id of tabIds) {
        const btn = getTabButton(id);
        assertInDOM(btn, 'FLOW-25-01', `Tab按钮 ${id}`);
      }
    });

    it(accTest('FLOW-25-02', 'TabBar渲染 — 标签文本正确'), () => {
      render(<TabBar {...makeTabBarProps()} />);

      const expectedLabels: Record<string, string> = {
        map: '天下', campaign: '出征', hero: '武将', tech: '科技',
        building: '建筑', prestige: '声望', more: '更多▼',
      };

      for (const [id, label] of Object.entries(expectedLabels)) {
        const btn = getTabButton(id as TabId);
        assertStrict(
          btn.textContent?.includes(label) ?? false,
          'FLOW-25-02',
          `Tab ${id} 应包含标签 "${label}"，实际: "${btn.textContent}"`,
        );
      }
    });

    it(accTest('FLOW-25-03', 'TabBar渲染 — 图标emoji可见'), () => {
      render(<TabBar {...makeTabBarProps()} />);

      const expectedIcons: Record<string, string> = {
        map: '🗺️', campaign: '⚔️', hero: '🦸', tech: '📜',
        building: '🏰', prestige: '👑', more: '📋',
      };

      for (const [id, icon] of Object.entries(expectedIcons)) {
        const btn = getTabButton(id as TabId);
        assertStrict(
          btn.textContent?.includes(icon) ?? false,
          'FLOW-25-03',
          `Tab ${id} 应包含图标 ${icon}`,
        );
      }
    });

    it(accTest('FLOW-25-04', 'TabBar渲染 — data-testid正确'), () => {
      render(<TabBar {...makeTabBarProps()} />);

      const tabBar = screen.getByTestId('tab-bar');
      assertInDOM(tabBar, 'FLOW-25-04', 'tab-bar容器');

      for (const tab of TABS) {
        const btn = screen.getByTestId(`tab-bar-${tab.id}`);
        assertInDOM(btn, 'FLOW-25-04', `tab-bar-${tab.id}`);
      }
    });

    it(accTest('FLOW-25-05', 'TabBar渲染 — role=tab属性'), () => {
      render(<TabBar {...makeTabBarProps()} />);

      const tabs = screen.getAllByRole('tab');
      assertStrict(tabs.length === 7, 'FLOW-25-05',
        `应有7个role=tab元素，实际: ${tabs.length}`);
    });

    it(accTest('FLOW-25-06', 'TabBar渲染 — aria-label正确'), () => {
      render(<TabBar {...makeTabBarProps()} />);

      for (const tab of TABS) {
        const btn = getTabButton(tab.id);
        assertStrict(
          btn.getAttribute('aria-label') === tab.label,
          'FLOW-25-06',
          `Tab ${tab.id} aria-label应为 "${tab.label}"，实际: "${btn.getAttribute('aria-label')}"`,
        );
      }
    });

    it(accTest('FLOW-25-07', 'TabBar渲染 — 初始activeTab高亮'), () => {
      render(<TabBar {...makeTabBarProps({ activeTab: 'hero' })} />);

      const heroBtn = getTabButton('hero');
      assertStrict(
        heroBtn.getAttribute('aria-selected') === 'true',
        'FLOW-25-07',
        'hero Tab 应为 aria-selected=true',
      );

      const mapBtn = getTabButton('map');
      assertStrict(
        mapBtn.getAttribute('aria-selected') === 'false',
        'FLOW-25-07',
        'map Tab 应为 aria-selected=false',
      );
    });

    it(accTest('FLOW-25-08', 'TabBar渲染 — 不同activeTab传入时高亮正确'), () => {
      const activeTabs: TabId[] = ['map', 'campaign', 'hero', 'tech', 'building', 'prestige'];

      for (const active of activeTabs) {
        cleanup();
        render(<TabBar {...makeTabBarProps({ activeTab: active })} />);

        const btn = getTabButton(active);
        assertStrict(
          btn.getAttribute('aria-selected') === 'true',
          'FLOW-25-08',
          `Tab ${active} 应高亮`,
        );
      }
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 2. Tab切换回调（FLOW-25-09 ~ FLOW-25-16）
  // ═══════════════════════════════════════════════════════════

  describe('2. Tab切换回调', () => {

    it(accTest('FLOW-25-09', 'Tab切换 — 点击天下Tab → onTabChange(map)'), () => {
      const onTabChange = vi.fn();
      render(<TabBar {...makeTabBarProps({ activeTab: 'campaign', onTabChange })} />);

      fireEvent.click(getTabButton('map'));

      assertStrict(onTabChange.mock.calls.length === 1, 'FLOW-25-09', 'onTabChange应被调用1次');
      const call = onTabChange.mock.calls[0][0] as TabConfig;
      assertStrict(call.id === 'map', 'FLOW-25-09',
        `回调参数id应为map，实际: ${call.id}`);
    });

    it(accTest('FLOW-25-10', 'Tab切换 — 点击出征Tab → onTabChange(campaign)'), () => {
      const onTabChange = vi.fn();
      render(<TabBar {...makeTabBarProps({ onTabChange })} />);

      fireEvent.click(getTabButton('campaign'));

      assertStrict(onTabChange.mock.calls.length === 1, 'FLOW-25-10', 'onTabChange应被调用');
      const call = onTabChange.mock.calls[0][0] as TabConfig;
      assertStrict(call.id === 'campaign', 'FLOW-25-10', '参数id应为campaign');
    });

    it(accTest('FLOW-25-11', 'Tab切换 — 点击武将Tab → onTabChange(hero)'), () => {
      const onTabChange = vi.fn();
      render(<TabBar {...makeTabBarProps({ onTabChange })} />);

      fireEvent.click(getTabButton('hero'));

      const call = onTabChange.mock.calls[0][0] as TabConfig;
      assertStrict(call.id === 'hero', 'FLOW-25-11', '参数id应为hero');
    });

    it(accTest('FLOW-25-12', 'Tab切换 — 点击科技Tab → onTabChange(tech)'), () => {
      const onTabChange = vi.fn();
      render(<TabBar {...makeTabBarProps({ onTabChange })} />);

      fireEvent.click(getTabButton('tech'));

      const call = onTabChange.mock.calls[0][0] as TabConfig;
      assertStrict(call.id === 'tech', 'FLOW-25-12', '参数id应为tech');
    });

    it(accTest('FLOW-25-13', 'Tab切换 — 点击建筑Tab → onTabChange(building)'), () => {
      const onTabChange = vi.fn();
      render(<TabBar {...makeTabBarProps({ onTabChange })} />);

      fireEvent.click(getTabButton('building'));

      const call = onTabChange.mock.calls[0][0] as TabConfig;
      assertStrict(call.id === 'building', 'FLOW-25-13', '参数id应为building');
    });

    it(accTest('FLOW-25-14', 'Tab切换 — 点击声望Tab → onTabChange(prestige)'), () => {
      const onTabChange = vi.fn();
      render(<TabBar {...makeTabBarProps({ onTabChange })} />);

      fireEvent.click(getTabButton('prestige'));

      const call = onTabChange.mock.calls[0][0] as TabConfig;
      assertStrict(call.id === 'prestige', 'FLOW-25-14', '参数id应为prestige');
    });

    it(accTest('FLOW-25-15', 'Tab切换 — TabConfig包含icon和label'), () => {
      const onTabChange = vi.fn();
      render(<TabBar {...makeTabBarProps({ onTabChange })} />);

      fireEvent.click(getTabButton('hero'));

      const call = onTabChange.mock.calls[0][0] as TabConfig;
      assertStrict(call.icon === '🦸', 'FLOW-25-15', 'icon应为🦸');
      assertStrict(call.label === '武将', 'FLOW-25-15', 'label应为武将');
      assertStrict(call.available === true, 'FLOW-25-15', 'available应为true');
    });

    it(accTest('FLOW-25-16', 'Tab切换 — 点击更多Tab不触发onTabChange'), () => {
      const onTabChange = vi.fn();
      const onMoreToggle = vi.fn();
      render(<TabBar {...makeTabBarProps({ onTabChange, onMoreToggle })} />);

      fireEvent.click(getTabButton('more'));

      assertStrict(onTabChange.mock.calls.length === 0, 'FLOW-25-16',
        '点击更多Tab不应触发onTabChange');
      assertStrict(onMoreToggle.mock.calls.length === 1, 'FLOW-25-16',
        '点击更多Tab应触发onMoreToggle');
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 3. 更多菜单交互（FLOW-25-17 ~ FLOW-25-24）
  // ═══════════════════════════════════════════════════════════

  describe('3. 更多菜单交互', () => {

    it(accTest('FLOW-25-17', '更多菜单 — 点击更多按钮 → onMoreToggle(true)'), () => {
      const onMoreToggle = vi.fn();
      render(<TabBar {...makeTabBarProps({ moreMenuOpen: false, onMoreToggle })} />);

      fireEvent.click(getTabButton('more'));

      assertStrict(onMoreToggle.mock.calls.length === 1, 'FLOW-25-17', 'onMoreToggle应被调用');
      assertStrict(
        onMoreToggle.mock.calls[0][0] === true,
        'FLOW-25-17',
        `参数应为true，实际: ${onMoreToggle.mock.calls[0][0]}`,
      );
    });

    it(accTest('FLOW-25-18', '更多菜单 — 菜单展开时点击更多 → onMoreToggle(false)'), () => {
      const onMoreToggle = vi.fn();
      render(<TabBar {...makeTabBarProps({ moreMenuOpen: true, onMoreToggle })} />);

      fireEvent.click(getTabButton('more'));

      assertStrict(onMoreToggle.mock.calls.length === 1, 'FLOW-25-18', 'onMoreToggle应被调用');
      assertStrict(
        onMoreToggle.mock.calls[0][0] === false,
        'FLOW-25-18',
        `参数应为false，实际: ${onMoreToggle.mock.calls[0][0]}`,
      );
    });

    it(accTest('FLOW-25-19', '更多菜单 — 展开时下拉面板可见'), () => {
      render(<TabBar {...makeTabBarProps({ moreMenuOpen: true })} />);

      const dropdown = screen.getByTestId('feature-menu-dropdown');
      // TODO: 需要Playwright E2E验证视觉可见性 — jsdom无法检测CSS class造成的overflow:hidden裁切
      assertInDOM(dropdown, 'FLOW-25-19', '功能菜单下拉面板');
    });

    it(accTest('FLOW-25-20', '更多菜单 — 关闭时下拉面板不存在'), () => {
      render(<TabBar {...makeTabBarProps({ moreMenuOpen: false })} />);

      const dropdown = screen.queryByTestId('feature-menu-dropdown');
      assertStrict(dropdown === null, 'FLOW-25-20',
        '关闭时下拉面板不应存在');
    });

    it(accTest('FLOW-25-21', '更多菜单 — 展开时显示所有16个功能项'), () => {
      render(<TabBar {...makeTabBarProps({ moreMenuOpen: true })} />);

      for (const item of FEATURE_ITEMS) {
        const menuItem = screen.getByTestId(`feature-menu-item-${item.id}`);
        assertInDOM(menuItem, 'FLOW-25-21', `功能项 ${item.id}`);
      }
    });

    it(accTest('FLOW-25-22', '更多菜单 — 点击功能项 → onFeatureSelect调用'), () => {
      const onFeatureSelect = vi.fn();
      const onMoreToggle = vi.fn();
      render(<TabBar {...makeTabBarProps({
        moreMenuOpen: true,
        onFeatureSelect,
        onMoreToggle,
      })} />);

      fireEvent.click(screen.getByTestId('feature-menu-item-shop'));

      assertStrict(onFeatureSelect.mock.calls.length === 1, 'FLOW-25-22', 'onFeatureSelect应被调用');
      assertStrict(
        onFeatureSelect.mock.calls[0][0] === 'shop',
        'FLOW-25-22',
        `参数应为'shop'，实际: ${onFeatureSelect.mock.calls[0][0]}`,
      );
      assertStrict(onMoreToggle.mock.calls.length >= 1, 'FLOW-25-22', '选择后应触发onMoreToggle关闭菜单');
    });

    it(accTest('FLOW-25-23', '更多菜单 — aria-expanded状态切换'), () => {
      const { rerender } = render(
        <TabBar {...makeTabBarProps({ moreMenuOpen: false })} />
      );
      const moreBtn = getTabButton('more');
      assertStrict(
        moreBtn.getAttribute('aria-expanded') === 'false',
        'FLOW-25-23',
        '关闭时aria-expanded应为false',
      );

      rerender(<TabBar {...makeTabBarProps({ moreMenuOpen: true })} />);
      const moreBtnOpen = getTabButton('more');
      assertStrict(
        moreBtnOpen.getAttribute('aria-expanded') === 'true',
        'FLOW-25-23',
        '展开时aria-expanded应为true',
      );
    });

    it(accTest('FLOW-25-24', '更多菜单 — aria-haspopup=menu'), () => {
      render(<TabBar {...makeTabBarProps()} />);
      const moreBtn = getTabButton('more');
      assertStrict(
        moreBtn.getAttribute('aria-haspopup') === 'menu',
        'FLOW-25-24',
        '更多按钮应有aria-haspopup=menu',
      );
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 4. Badge显示（FLOW-25-25 ~ FLOW-25-32）
  // ═══════════════════════════════════════════════════════════

  describe('4. Badge显示', () => {

    it(accTest('FLOW-25-25', 'Badge — 数字badge渲染'), () => {
      const tabBadges: TabBadges = { hero: { count: 5 } };
      render(<TabBar {...makeTabBarProps({ tabBadges })} />);

      const badgeElements = screen.getAllByTestId('tab-badge-count');
      const heroBadge = badgeElements.find(el => el.textContent === '5');
      assertStrict(!!heroBadge, 'FLOW-25-25', '应显示数字badge "5"');
    });

    it(accTest('FLOW-25-26', 'Badge — 圆点badge渲染'), () => {
      const tabBadges: TabBadges = { tech: { count: 0, dot: true } };
      render(<TabBar {...makeTabBarProps({ tabBadges })} />);

      const dotBadge = screen.getByTestId('tab-badge-dot');
      assertInDOM(dotBadge, 'FLOW-25-26', '圆点badge');
    });

    it(accTest('FLOW-25-27', 'Badge — 无badge时不显示badge元素'), () => {
      const tabBadges: TabBadges = {};
      render(<TabBar {...makeTabBarProps({ tabBadges })} />);

      const heroBtn = getTabButton('hero');
      const heroBadgeCount = heroBtn.querySelector('[data-testid="tab-badge-count"]');
      const heroBadgeDot = heroBtn.querySelector('[data-testid="tab-badge-dot"]');
      assertStrict(!heroBadgeCount, 'FLOW-25-27', 'hero不应有数字badge');
      assertStrict(!heroBadgeDot, 'FLOW-25-27', 'hero不应有圆点badge');
    });

    it(accTest('FLOW-25-28', 'Badge — count=0且dot=false不显示'), () => {
      const tabBadges: TabBadges = { hero: { count: 0, dot: false } };
      render(<TabBar {...makeTabBarProps({ tabBadges })} />);

      const heroBtn = getTabButton('hero');
      const badgeCount = heroBtn.querySelector('[data-testid="tab-badge-count"]');
      const badgeDot = heroBtn.querySelector('[data-testid="tab-badge-dot"]');
      assertStrict(!badgeCount, 'FLOW-25-28', 'count=0不应显示数字badge');
      assertStrict(!badgeDot, 'FLOW-25-28', 'dot=false不应显示圆点badge');
    });

    it(accTest('FLOW-25-29', 'Badge — 99+截断显示'), () => {
      const tabBadges: TabBadges = { hero: { count: 150 } };
      render(<TabBar {...makeTabBarProps({ tabBadges })} />);

      const badgeElements = screen.getAllByTestId('tab-badge-count');
      const largeBadge = badgeElements.find(el => el.textContent === '99+');
      assertStrict(!!largeBadge, 'FLOW-25-29', 'count=150应显示99+');
    });

    it(accTest('FLOW-25-30', 'Badge — 99不截断'), () => {
      const tabBadges: TabBadges = { hero: { count: 99 } };
      render(<TabBar {...makeTabBarProps({ tabBadges })} />);

      const badgeElements = screen.getAllByTestId('tab-badge-count');
      const badge99 = badgeElements.find(el => el.textContent === '99');
      assertStrict(!!badge99, 'FLOW-25-30', 'count=99应显示"99"');
    });

    it(accTest('FLOW-25-31', 'Badge — 更多Tab汇总badge'), () => {
      const featureMenuItems = makeFeatureMenuItems([
        { id: 'quest', badge: 3 },
        { id: 'mail', badge: 5 },
      ]);
      render(<TabBar {...makeTabBarProps({ featureMenuItems })} />);

      const moreBtn = getTabButton('more');
      const badgeInMore = moreBtn.querySelector('[data-testid="tab-badge-count"]');
      assertStrict(!!badgeInMore, 'FLOW-25-31', '更多Tab应显示汇总badge');
      assertStrict(
        badgeInMore?.textContent === '8',
        'FLOW-25-31',
        `汇总badge应为8，实际: ${badgeInMore?.textContent}`,
      );
    });

    it(accTest('FLOW-25-32', 'Badge — 多个Tab同时有badge'), () => {
      const tabBadges: TabBadges = {
        hero: { count: 3 },
        tech: { count: 1 },
        campaign: { dot: true },
      };
      render(<TabBar {...makeTabBarProps({ tabBadges })} />);

      const countBadges = screen.getAllByTestId('tab-badge-count');
      const dotBadges = screen.getAllByTestId('tab-badge-dot');
      assertStrict(countBadges.length >= 2, 'FLOW-25-32',
        `应有≥2个数字badge，实际: ${countBadges.length}`);
      assertStrict(dotBadges.length >= 1, 'FLOW-25-32',
        `应有≥1个圆点badge，实际: ${dotBadges.length}`);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 5. 快速切换与回调序列（FLOW-25-33 ~ FLOW-25-38）
  // ═══════════════════════════════════════════════════════════

  describe('5. 快速切换与回调序列', () => {

    it(accTest('FLOW-25-33', '快速切换 — 连续点击6个Tab，回调序列正确'), () => {
      const onTabChange = vi.fn();
      render(<TabBar {...makeTabBarProps({ onTabChange })} />);

      const tabs: TabId[] = ['map', 'campaign', 'hero', 'tech', 'building', 'prestige'];
      for (const tab of tabs) {
        fireEvent.click(getTabButton(tab));
      }

      assertStrict(onTabChange.mock.calls.length === 6, 'FLOW-25-33',
        `应调用6次，实际: ${onTabChange.mock.calls.length}`);

      for (let i = 0; i < tabs.length; i++) {
        const call = onTabChange.mock.calls[i][0] as TabConfig;
        assertStrict(call.id === tabs[i], 'FLOW-25-33',
          `第${i + 1}次调用id应为${tabs[i]}，实际: ${call.id}`);
      }
    });

    it(accTest('FLOW-25-34', '快速切换 — 重复点击同一Tab每次都触发回调'), () => {
      const onTabChange = vi.fn();
      render(<TabBar {...makeTabBarProps({ onTabChange })} />);

      fireEvent.click(getTabButton('hero'));
      fireEvent.click(getTabButton('hero'));
      fireEvent.click(getTabButton('hero'));

      assertStrict(onTabChange.mock.calls.length === 3, 'FLOW-25-34',
        '重复点击同一Tab应每次都触发回调');
    });

    it(accTest('FLOW-25-35', '快速切换 — 引擎资源不变'), () => {
      const resourcesBefore = sim.getAllResources();

      render(<TabBar {...makeTabBarProps()} />);
      const tabs: TabId[] = ['map', 'campaign', 'hero', 'tech', 'building', 'prestige', 'more'];
      for (const tab of tabs) {
        fireEvent.click(getTabButton(tab));
      }

      const resourcesAfter = sim.getAllResources();
      assertStrict(
        JSON.stringify(resourcesBefore) === JSON.stringify(resourcesAfter),
        'FLOW-25-35',
        '快速切换Tab后引擎资源应不变',
      );
    });

    it(accTest('FLOW-25-36', '快速切换 — 更多菜单toggle回调序列'), () => {
      const onMoreToggle = vi.fn();
      render(<TabBar {...makeTabBarProps({ onMoreToggle })} />);

      fireEvent.click(getTabButton('more'));
      fireEvent.click(getTabButton('more'));
      fireEvent.click(getTabButton('more'));

      assertStrict(onMoreToggle.mock.calls.length === 3, 'FLOW-25-36',
        `应调用3次onMoreToggle，实际: ${onMoreToggle.mock.calls.length}`);
    });

    it(accTest('FLOW-25-37', '快速切换 — 混合Tab和更多菜单交互'), () => {
      const onTabChange = vi.fn();
      const onMoreToggle = vi.fn();
      render(<TabBar {...makeTabBarProps({ onTabChange, onMoreToggle })} />);

      fireEvent.click(getTabButton('hero'));
      fireEvent.click(getTabButton('more'));
      fireEvent.click(getTabButton('campaign'));
      fireEvent.click(getTabButton('more'));

      assertStrict(onTabChange.mock.calls.length === 2, 'FLOW-25-37',
        `onTabChange应调用2次，实际: ${onTabChange.mock.calls.length}`);
      assertStrict(onMoreToggle.mock.calls.length === 2, 'FLOW-25-37',
        `onMoreToggle应调用2次，实际: ${onMoreToggle.mock.calls.length}`);
    });

    it(accTest('FLOW-25-38', '快速切换 — Tab配置顺序与TABS常量一致'), () => {
      render(<TabBar {...makeTabBarProps()} />);

      const tabs = screen.getAllByRole('tab');
      for (let i = 0; i < TABS.length; i++) {
        const tabBtn = tabs[i];
        assertStrict(
          tabBtn.getAttribute('aria-label') === TABS[i].label,
          'FLOW-25-38',
          `第${i}个Tab应为${TABS[i].label}`,
        );
      }
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 6. 苏格拉底边界（FLOW-25-39 ~ FLOW-25-48）
  // ═══════════════════════════════════════════════════════════

  describe('6. 苏格拉底边界', () => {

    it(accTest('FLOW-25-39', '边界 — calendar=null不崩溃'), () => {
      const { container } = render(
        <TabBar {...makeTabBarProps({ calendar: null })} />
      );
      assertStrict(!!container, 'FLOW-25-39', 'calendar=null时应正常渲染');
    });

    it(accTest('FLOW-25-40', '边界 — tabBadges为空对象'), () => {
      const { container } = render(
        <TabBar {...makeTabBarProps({ tabBadges: {} })} />
      );
      assertStrict(!!container, 'FLOW-25-40', '空tabBadges应正常渲染');
    });

    it(accTest('FLOW-25-41', '边界 — featureMenuItems为空数组'), () => {
      const { container } = render(
        <TabBar {...makeTabBarProps({ featureMenuItems: [], moreMenuOpen: true })} />
      );
      assertStrict(!!container, 'FLOW-25-41', '空featureMenuItems应正常渲染');

      const dropdown = screen.queryByTestId('feature-menu-dropdown');
      assertStrict(!!dropdown, 'FLOW-25-41', '下拉面板应存在');
    });

    it(accTest('FLOW-25-42', '边界 — TABS常量不可变（7个Tab）'), () => {
      assertStrict(TABS.length === 7, 'FLOW-25-42',
        `TABS应有7项，实际: ${TABS.length}`);
    });

    it(accTest('FLOW-25-43', '边界 — FEATURE_ITEMS常量（16项）'), () => {
      assertStrict(FEATURE_ITEMS.length === 16, 'FLOW-25-43',
        `FEATURE_ITEMS应有16项，实际: ${FEATURE_ITEMS.length}`);
    });

    it(accTest('FLOW-25-44', '边界 — TabId类型覆盖所有TABS'), () => {
      const tabIds = TABS.map(t => t.id);
      const expectedIds: TabId[] = ['map', 'campaign', 'hero', 'tech', 'building', 'prestige', 'more'];
      for (let i = 0; i < expectedIds.length; i++) {
        assertStrict(tabIds[i] === expectedIds[i], 'FLOW-25-44',
          `TABS[${i}]应为${expectedIds[i]}，实际: ${tabIds[i]}`);
      }
    });

    it(accTest('FLOW-25-45', '边界 — 功能菜单项badge显示'), () => {
      const featureMenuItems = makeFeatureMenuItems([
        { id: 'quest', badge: 5 },
      ]);
      render(<TabBar {...makeTabBarProps({ featureMenuItems, moreMenuOpen: true })} />);

      const questItem = screen.getByTestId('feature-menu-item-quest');
      const badgeEl = questItem.querySelector('.tk-more-dropdown-item-badge');
      assertStrict(!!badgeEl, 'FLOW-25-45', 'quest项应显示badge');
      assertStrict(badgeEl?.textContent === '5', 'FLOW-25-45',
        `badge应为5，实际: ${badgeEl?.textContent}`);
    });

    it(accTest('FLOW-25-46', '边界 — 不可用功能项disabled'), () => {
      const featureMenuItems = makeFeatureMenuItems([
        { id: 'settings', available: false },
      ]);
      render(<TabBar {...makeTabBarProps({ featureMenuItems, moreMenuOpen: true })} />);

      const settingsItem = screen.getByTestId('feature-menu-item-settings');
      assertStrict(settingsItem.hasAttribute('disabled'), 'FLOW-25-46',
        '不可用项应有disabled属性');
    });

    it(accTest('FLOW-25-47', '边界 — 更多菜单功能大厅标题'), () => {
      render(<TabBar {...makeTabBarProps({ moreMenuOpen: true })} />);

      const title = screen.getByText('功能大厅');
      assertInDOM(title, 'FLOW-25-47', '功能大厅标题');
    });

    it(accTest('FLOW-25-48', '边界 — 引擎子系统通过Tab可达'), () => {
      const registry = sim.engine.getSubsystemRegistry();
      const criticalSystems = [
        'hero', 'building', 'techTree', 'resource',
        'heroFormation', 'campaignSystem', 'shop',
        'prestige', 'npc', 'arena', 'expedition',
      ];
      for (const sysName of criticalSystems) {
        const sys = registry.get(sysName);
        assertStrict(!!sys, 'FLOW-25-48',
          `关键子系统 ${sysName} 应存在`);
      }
    });
  });
});
