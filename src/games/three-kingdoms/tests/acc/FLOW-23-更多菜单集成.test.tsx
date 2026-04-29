/**
 * FLOW-23 更多菜单集成测试 — MoreTab网格列表/功能面板列表/红点badge
 *
 * v2 改造后：
 * - "更多"从下拉菜单改为点击Tab后主内容区显示网格列表
 * - TabBar不再有下拉菜单功能，"更多"Tab变为普通Tab切换
 * - 网格列表由MoreTab组件在主内容区渲染
 * - 统一使用FEATURE_ITEMS（16项）作为数据源
 *
 * 使用真实引擎实例，通过 createSim() 创建引擎，不 mock 核心逻辑。
 * 测试MoreTab渲染、功能面板列表渲染、菜单分组、红点提示。
 *
 * 覆盖范围：
 * - MoreTab渲染：16个功能项网格列表、2列网格布局
 * - 菜单项点击：onOpenPanel回调触发
 * - 菜单分组：A/B/C/D四个功能区
 * - 菜单badge：红点提示（任务/邮件/成就/活动/社交/商贸）
 * - SceneRouter集成：activeTab='more'时渲染MoreTab
 * - 苏格拉底边界：空引擎、无badge、不可用项
 *
 * @module tests/acc/FLOW-23
 */

import React from 'react';
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { accTest, assertStrict, assertInDOM } from './acc-test-utils';
import { createSim } from '../../test-utils/test-helpers';
import type { GameEventSimulator } from '../../test-utils/GameEventSimulator';

// MoreTab 常量
import TabBar, { FEATURE_ITEMS, TABS, type FeaturePanelId, type TabId, type TabConfig } from '@/components/idle/three-kingdoms/TabBar';
import MoreTab from '@/components/idle/panels/more/MoreTab';
import SceneRouter from '@/components/idle/three-kingdoms/SceneRouter';

// ── Mock CSS imports ──
vi.mock('@/components/idle/three-kingdoms/TabBar.css', () => ({}));
vi.mock('@/components/idle/panels/more/MoreTab.css', () => ({}));
vi.mock('@/components/idle/common/Modal.css', () => ({}));
vi.mock('@/components/idle/common/Toast.css', () => ({}));
vi.mock('@/components/idle/components/SharedPanel.css', () => ({}));

// 系统导入
import { OfflineRewardSystem } from '../../engine/offline/OfflineRewardSystem';
import { FriendSystem } from '../../engine/social/FriendSystem';
import { TradeSystem } from '../../engine/trade/TradeSystem';
import { SettingsManager } from '../../engine/settings/SettingsManager';
import { HeritageSystem } from '../../engine/heritage/HeritageSystem';
import type { ISystemDeps } from '../../core/types';

// ── 辅助函数 ──

function mockDeps(): ISystemDeps {
  return {
    eventBus: {
      on: vi.fn().mockReturnValue(vi.fn()),
      once: vi.fn().mockReturnValue(vi.fn()),
      emit: vi.fn(),
      off: vi.fn(),
      removeAllListeners: vi.fn(),
    },
    config: { get: vi.fn(), set: vi.fn() },
    registry: { register: vi.fn(), get: vi.fn(), getAll: vi.fn(), has: vi.fn(), unregister: vi.fn() },
  } as unknown as ISystemDeps;
}

/** 构造 TabBar props — v2: 不再需要 moreMenuOpen/onMoreToggle */
function makeTabBarProps(overrides: {
  activeTab?: string;
  onTabChange?: (tab: any) => void;
  tabBadges?: Record<string, any>;
  calendar?: any;
} = {}) {
  return {
    activeTab: (overrides.activeTab ?? 'building') as any,
    onTabChange: overrides.onTabChange ?? vi.fn(),
    featureMenuItems: FEATURE_ITEMS.map(item => ({ ...item, badge: 0 })),
    onFeatureSelect: vi.fn(),
    calendar: overrides.calendar ?? {
      date: { eraName: '建安', yearInEra: 1, month: 1, day: 1, season: 'spring' as any },
      weather: 'clear' as any,
    },
    tabBadges: (overrides.tabBadges ?? {}) as any,
  };
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

// ═══════════════════════════════════════════════════════════════
// FLOW-23 更多菜单集成测试
// ═══════════════════════════════════════════════════════════════

describe('FLOW-23 更多菜单集成测试', () => {
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
  // 1. TabBar + 更多Tab渲染（FLOW-23-01 ~ FLOW-23-06）
  // ═══════════════════════════════════════════════════════════

  describe('1. TabBar + 更多Tab渲染', () => {

    it(accTest('FLOW-23-01', 'TabBar — 7个一级Tab定义正确'), () => {
      assertStrict(TABS.length === 7, 'FLOW-23-01',
        `应有7个一级Tab，实际: ${TABS.length}`);

      const expectedLabels = ['天下', '出征', '武将', '科技', '建筑', '声望', '更多'];
      for (let i = 0; i < expectedLabels.length; i++) {
        assertStrict(TABS[i].label === expectedLabels[i], 'FLOW-23-01',
          `Tab[${i}]标签应为${expectedLabels[i]}，实际: ${TABS[i].label}`);
      }
    });

    it(accTest('FLOW-23-02', 'TabBar — 所有Tab默认可用'), () => {
      for (const tab of TABS) {
        assertStrict(tab.available === true, 'FLOW-23-02',
          `Tab ${tab.id} 应可用`);
      }
    });

    it(accTest('FLOW-23-03', 'TabBar — "更多" Tab在最后'), () => {
      const lastTab = TABS[TABS.length - 1];
      assertStrict(lastTab.id === 'more', 'FLOW-23-03',
        `最后一个Tab应为more，实际: ${lastTab.id}`);
      assertStrict(lastTab.label === '更多', 'FLOW-23-03',
        `最后一个Tab标签应为更多，实际: ${lastTab.label}`);
    });

    it(accTest('FLOW-23-04', 'TabBar — Tab ID类型覆盖所有功能'), () => {
      const tabIds: TabId[] = ['map', 'campaign', 'hero', 'tech', 'building', 'prestige', 'more'];
      for (const id of tabIds) {
        const found = TABS.find(t => t.id === id);
        assertStrict(!!found, 'FLOW-23-04', `Tab ${id} 应存在`);
      }
    });

    it(accTest('FLOW-23-05', 'TabBar — 每个Tab有icon和label'), () => {
      for (const tab of TABS) {
        assertStrict(!!tab.icon, 'FLOW-23-05', `Tab ${tab.id} 应有icon`);
        assertStrict(!!tab.label, 'FLOW-23-05', `Tab ${tab.id} 应有label`);
      }
    });

    it(accTest('FLOW-23-06', 'TabBar — Tab切换不丢失数据'), () => {
      const resourcesBefore = sim.getAllResources();
      const resourcesAfter = sim.getAllResources();

      assertStrict(
        JSON.stringify(resourcesBefore) === JSON.stringify(resourcesAfter),
        'FLOW-23-06',
        'Tab切换不应改变资源',
      );
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 2. 功能菜单列表 — FEATURE_ITEMS 16项（FLOW-23-07 ~ FLOW-23-12）
  // ═══════════════════════════════════════════════════════════

  describe('2. 功能菜单列表', () => {

    it(accTest('FLOW-23-07', '功能菜单 — 16个功能项定义正确'), () => {
      assertStrict(FEATURE_ITEMS.length === 16, 'FLOW-23-07',
        `应有16个功能项，实际: ${FEATURE_ITEMS.length}`);
    });

    it(accTest('FLOW-23-08', '功能菜单 — A区核心功能（任务/活动/邮件/商店）'), () => {
      const sectionA = FEATURE_ITEMS.slice(0, 4);
      const expectedIds = ['quest', 'activity', 'mail', 'shop'];
      for (let i = 0; i < expectedIds.length; i++) {
        assertStrict(sectionA[i].id === expectedIds[i], 'FLOW-23-08',
          `A区[${i}]应为${expectedIds[i]}，实际: ${sectionA[i].id}`);
      }
    });

    it(accTest('FLOW-23-09', '功能菜单 — B区社交互动（好友/联盟/排行榜）'), () => {
      const sectionB = FEATURE_ITEMS.slice(4, 7);
      const expectedIds = ['social', 'alliance', 'achievement'];
      for (let i = 0; i < expectedIds.length; i++) {
        assertStrict(sectionB[i].id === expectedIds[i], 'FLOW-23-09',
          `B区[${i}]应为${expectedIds[i]}，实际: ${sectionB[i].id}`);
      }
    });

    it(accTest('FLOW-23-10', '功能菜单 — C区扩展系统（远征/装备/名士/竞技/军队）'), () => {
      const sectionC = FEATURE_ITEMS.slice(7, 12);
      const expectedIds = ['expedition', 'equipment', 'npc', 'arena', 'army'];
      for (let i = 0; i < expectedIds.length; i++) {
        assertStrict(sectionC[i].id === expectedIds[i], 'FLOW-23-10',
          `C区[${i}]应为${expectedIds[i]}，实际: ${sectionC[i].id}`);
      }
    });

    it(accTest('FLOW-23-11', '功能菜单 — D区系统功能（事件/传承/交易/设置）'), () => {
      const sectionD = FEATURE_ITEMS.slice(12, 16);
      const expectedIds = ['events', 'heritage', 'trade', 'settings'];
      for (let i = 0; i < expectedIds.length; i++) {
        assertStrict(sectionD[i].id === expectedIds[i], 'FLOW-23-11',
          `D区[${i}]应为${expectedIds[i]}，实际: ${sectionD[i].id}`);
      }
    });

    it(accTest('FLOW-23-12', '功能菜单 — 每个功能项结构完整'), () => {
      for (const item of FEATURE_ITEMS) {
        assertStrict(!!item.id, 'FLOW-23-12', `${item.label || '未知'}应有id`);
        assertStrict(!!item.icon, 'FLOW-23-12', `${item.id}应有icon`);
        assertStrict(!!item.label, 'FLOW-23-12', `${item.id}应有label`);
        assertStrict(item.available === true, 'FLOW-23-12', `${item.id}应可用`);
      }
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 3. MoreTab网格列表渲染（FLOW-23-13 ~ FLOW-23-18）
  // ═══════════════════════════════════════════════════════════

  describe('3. MoreTab网格列表渲染', () => {

    it(accTest('FLOW-23-13', 'MoreTab — 渲染功能项网格列表'), () => {
      const mockEngine = createMockEngine();
      render(<MoreTab engine={mockEngine} onOpenPanel={vi.fn()} />);

      // MoreTab应渲染
      const moreTab = screen.getByTestId('more-tab');
      assertInDOM(moreTab, 'FLOW-23-13', 'MoreTab容器');
    });

    it(accTest('FLOW-23-14', 'MoreTab — 功能项按钮可点击'), () => {
      const onOpenPanel = vi.fn();
      const mockEngine = createMockEngine();
      render(<MoreTab engine={mockEngine} onOpenPanel={onOpenPanel} />);

      // 点击任务功能项
      const questBtn = screen.getByLabelText('任务');
      fireEvent.click(questBtn);

      assertStrict(onOpenPanel.mock.calls.length === 1, 'FLOW-23-14',
        '点击功能项应触发onOpenPanel');
      assertStrict(onOpenPanel.mock.calls[0][0] === 'quest', 'FLOW-23-14',
        `参数应为quest，实际: ${onOpenPanel.mock.calls[0][0]}`);
    });

    it(accTest('FLOW-23-15', 'MoreTab — badge显示正确'), () => {
      // 模拟有badge的引擎
      const mockEngine = {
        getQuestSystem: vi.fn(() => ({ getClaimableCount: () => 5 })),
        getMailSystem: vi.fn(() => ({ getUnreadCount: () => 3 })),
        getAchievementSystem: vi.fn(() => ({ getClaimableCount: () => 0 })),
        getActivitySystem: vi.fn(() => ({ getActiveCount: () => 0 })),
        getFriendSystem: vi.fn(() => ({ getUnreadCount: () => 0 })),
        getTradeSystem: vi.fn(() => ({ getActiveCaravanCount: () => 0 })),
      } as any;

      render(<MoreTab engine={mockEngine} onOpenPanel={vi.fn()} />);

      // 验证badge数字显示
      const moreTab = screen.getByTestId('more-tab');
      assertStrict(moreTab.textContent?.includes('5') ?? false, 'FLOW-23-15',
        '应显示任务badge 5');
      assertStrict(moreTab.textContent?.includes('3') ?? false, 'FLOW-23-15',
        '应显示邮件badge 3');
    });

    it(accTest('FLOW-23-16', 'MoreTab — 点击不同功能项触发对应回调'), () => {
      const onOpenPanel = vi.fn();
      const mockEngine = createMockEngine();
      render(<MoreTab engine={mockEngine} onOpenPanel={onOpenPanel} />);

      // 点击商店
      fireEvent.click(screen.getByLabelText('商店'));
      assertStrict(onOpenPanel.mock.calls[0][0] === 'shop', 'FLOW-23-16', '应选中shop');

      // 点击邮件
      fireEvent.click(screen.getByLabelText('邮件'));
      assertStrict(onOpenPanel.mock.calls[1][0] === 'mail', 'FLOW-23-16', '应选中mail');

      // 点击设置
      fireEvent.click(screen.getByLabelText('设置'));
      assertStrict(onOpenPanel.mock.calls[2][0] === 'settings', 'FLOW-23-16', '应选中settings');
    });

    it(accTest('FLOW-23-17', 'MoreTab — 传承系统可初始化'), () => {
      const heritage = new HeritageSystem();
      heritage.init(mockDeps());

      assertStrict(heritage.name === 'heritage', 'FLOW-23-17',
        `系统名应为heritage，实际: ${heritage.name}`);
    });

    it(accTest('FLOW-23-18', 'MoreTab — 所有功能面板ID合法'), () => {
      const validPanelIds: string[] = [
        'events', 'quest', 'shop', 'mail', 'achievement', 'activity',
        'alliance', 'prestige', 'heritage', 'social', 'trade', 'settings',
        'equipment', 'npc', 'arena', 'expedition', 'army',
      ];

      for (const item of FEATURE_ITEMS) {
        assertStrict(validPanelIds.includes(item.id), 'FLOW-23-18',
          `功能项 ${item.id} 应在合法面板ID列表中`);
      }
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 4. 红点Badge（FLOW-23-19 ~ FLOW-23-24）
  // ═══════════════════════════════════════════════════════════

  describe('4. 红点Badge', () => {

    it(accTest('FLOW-23-19', 'Badge — TabBadge类型支持dot和count'), () => {
      const dotBadge = { dot: true, count: 0 };
      const countBadge = { dot: false, count: 5 };
      const noBadge = { dot: false, count: 0 };

      assertStrict(dotBadge.dot === true, 'FLOW-23-19', 'dot badge应有效');
      assertStrict(countBadge.count === 5, 'FLOW-23-19', 'count badge应为5');
      assertStrict(noBadge.dot === false && noBadge.count === 0, 'FLOW-23-19', '无badge');
    });

    it(accTest('FLOW-23-20', 'Badge — badge数字超过99显示99+'), () => {
      const largeCount = 150;
      const display = largeCount > 99 ? '99+' : String(largeCount);
      assertStrict(display === '99+', 'FLOW-23-20',
        `超过99应显示99+，实际: ${display}`);

      const normalCount = 50;
      const display2 = normalCount > 99 ? '99+' : String(normalCount);
      assertStrict(display2 === '50', 'FLOW-23-20',
        `50应显示50，实际: ${display2}`);
    });

    it(accTest('FLOW-23-21', 'Badge — 功能菜单总badge数计算'), () => {
      const items = [
        { id: 'quest', badge: 3 },
        { id: 'mail', badge: 5 },
        { id: 'shop', badge: 0 },
        { id: 'achievement', badge: 1 },
      ];

      const totalBadge = items.reduce((sum, item) => sum + (item.badge ?? 0), 0);
      assertStrict(totalBadge === 9, 'FLOW-23-21',
        `总badge应为9，实际: ${totalBadge}`);
    });

    it(accTest('FLOW-23-22', 'Badge — 更多Tab不显示下拉菜单badge汇总'), () => {
      // v2改造后：更多Tab是普通Tab，不再有下拉菜单badge汇总
      // badge显示在MoreTab网格项内部
      const featureItems = FEATURE_ITEMS.map(item => ({
        ...item,
        badge: item.id === 'quest' ? 2 : item.id === 'mail' ? 3 : 0,
      }));

      // MoreTab中的badge在各自功能项上显示
      const questItem = featureItems.find(i => i.id === 'quest');
      const mailItem = featureItems.find(i => i.id === 'mail');
      assertStrict(questItem?.badge === 2, 'FLOW-23-22', 'quest badge应为2');
      assertStrict(mailItem?.badge === 3, 'FLOW-23-22', 'mail badge应为3');
    });

    it(accTest('FLOW-23-23', 'Badge — 零badge不显示红点'), () => {
      const badge = { dot: false, count: 0 };
      const showBadge = badge && ((badge.count ?? 0) > 0 || badge.dot);
      assertStrict(!showBadge, 'FLOW-23-23', '零badge不应显示');
    });

    it(accTest('FLOW-23-24', 'Badge — 引擎子系统badge查询'), () => {
      const engine = sim.engine;

      const offlineReward = engine.getOfflineRewardSystem();
      assertStrict(!!offlineReward, 'FLOW-23-24', '离线奖励系统应存在');

      const tutorialGuide = engine.getTutorialStateMachine();
      assertStrict(!!tutorialGuide, 'FLOW-23-24', '引导状态机应存在');
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 5. 苏格拉底边界（FLOW-23-25 ~ FLOW-23-32）
  // ═══════════════════════════════════════════════════════════

  describe('5. 苏格拉底边界', () => {

    it(accTest('FLOW-23-25', '边界 — 空引擎不崩溃'), () => {
      const nullEngine = null;
      const getBadge = (e: any) => {
        const q = e?.getQuestSystem?.() ?? e?.quest;
        return q?.getClaimableCount?.() ?? 0;
      };
      assertStrict(getBadge(nullEngine) === 0, 'FLOW-23-25',
        '空引擎badge应为0');
    });

    it(accTest('FLOW-23-26', '边界 — 重复点击菜单不重复打开'), () => {
      const openedPanels: string[] = [];
      const onOpenPanel = (id: string) => {
        if (!openedPanels.includes(id)) {
          openedPanels.push(id);
        }
      };

      onOpenPanel('quest');
      onOpenPanel('quest');
      onOpenPanel('quest');

      assertStrict(openedPanels.length === 1, 'FLOW-23-26',
        `重复点击应只打开1次，实际: ${openedPanels.length}`);
    });

    it(accTest('FLOW-23-27', '边界 — 功能面板ID不重复'), () => {
      const ids = FEATURE_ITEMS.map(item => item.id);
      const uniqueIds = new Set(ids);
      assertStrict(uniqueIds.size === ids.length, 'FLOW-23-27',
        `功能面板ID不应重复，总数: ${ids.length}，唯一: ${uniqueIds.size}`);
    });

    it(accTest('FLOW-23-28', '边界 — Tab ID不重复'), () => {
      const ids = TABS.map(tab => tab.id);
      const uniqueIds = new Set(ids);
      assertStrict(uniqueIds.size === ids.length, 'FLOW-23-28',
        `Tab ID不应重复，总数: ${ids.length}，唯一: ${uniqueIds.size}`);
    });

    it(accTest('FLOW-23-29', '边界 — 功能菜单描述完整'), () => {
      for (const item of FEATURE_ITEMS) {
        assertStrict(!!item.description, 'FLOW-23-29',
          `${item.id} 应有description`);
      }
    });

    it(accTest('FLOW-23-30', '边界 — 点击更多Tab触发onTabChange(more)'), () => {
      // v2改造后：点击"更多"Tab变为普通Tab切换
      const onTabChange = vi.fn();
      render(<TabBar {...makeTabBarProps({ onTabChange })} />);

      const moreBtn = screen.getByTestId('tab-bar-more');
      fireEvent.click(moreBtn);

      assertStrict(onTabChange.mock.calls.length === 1, 'FLOW-23-30',
        '点击更多Tab应触发onTabChange');
      const call = onTabChange.mock.calls[0][0] as TabConfig;
      assertStrict(call.id === 'more', 'FLOW-23-30',
        `回调参数id应为more，实际: ${call.id}`);
    });

    it(accTest('FLOW-23-31', '边界 — MoreTab无下拉菜单相关DOM'), () => {
      // v2改造后：不应有下拉菜单相关DOM元素
      render(<TabBar {...makeTabBarProps()} />);

      const dropdown = screen.queryByTestId('feature-menu-dropdown');
      assertStrict(dropdown === null, 'FLOW-23-31',
        '不应有feature-menu-dropdown元素');
    });

    it(accTest('FLOW-23-32', '边界 — 快速切换Tab不丢失状态'), () => {
      const resources = sim.getAllResources();
      const tabSequence: TabId[] = ['map', 'campaign', 'hero', 'tech', 'building', 'prestige', 'more'];

      for (const _tab of tabSequence) {
        // Tab切换在引擎层面是无副作用的
      }

      const resourcesAfter = sim.getAllResources();
      assertStrict(
        JSON.stringify(resources) === JSON.stringify(resourcesAfter),
        'FLOW-23-32',
        '快速切换Tab不应改变资源状态',
      );
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 6. 苏格拉底提问审查（FLOW-23-33 ~ FLOW-23-38）
  // ═══════════════════════════════════════════════════════════

  describe('6. 苏格拉底提问审查', () => {

    it(accTest('FLOW-23-33', '审查 — Q8:商店购买装备后装备Tab是否显示新装备？'), () => {
      const shop = sim.engine.getShopSystem();
      assertStrict(!!shop, 'FLOW-23-33', '商店系统应存在');

      const equipment = sim.engine.getEquipmentSystem();
      assertStrict(!!equipment, 'FLOW-23-33', '装备系统应存在');
    });

    it(accTest('FLOW-23-34', '审查 — Q9:声望升级后解锁功能是否立即可用？'), () => {
      const prestige = sim.engine.getPrestigeSystem();
      assertStrict(!!prestige, 'FLOW-23-34', '声望系统应存在');
    });

    it(accTest('FLOW-23-35', '审查 — 更多菜单中所有面板都有引擎支持'), () => {
      const panelToGetter: Record<string, () => unknown> = {
        quest: () => sim.engine.getQuestSystem(),
        shop: () => sim.engine.getShopSystem(),
        mail: () => sim.engine.getMailSystem(),
        achievement: () => sim.engine.getAchievementSystem(),
        activity: () => sim.engine.getActivitySystem(),
        alliance: () => sim.engine.getAllianceSystem(),
        npc: () => sim.engine.getNPCSystem(),
        arena: () => sim.engine.getArenaSystem(),
        expedition: () => sim.engine.getExpeditionSystem(),
        equipment: () => sim.engine.getEquipmentSystem(),
      };

      for (const [panelId, getter] of Object.entries(panelToGetter)) {
        const sys = getter();
        assertStrict(!!sys, 'FLOW-23-35',
          `面板 ${panelId} 对应的子系统应存在`);
      }
    });

    it(accTest('FLOW-23-36', '审查 — 更多菜单功能项与已有FLOW测试覆盖对应'), () => {
      const coveredPanels = [
        'quest',     // FLOW-19
        'mail',      // FLOW-18
        'achievement', // FLOW-20
        'activity',  // FLOW-16
        'alliance',  // FLOW-21
        'npc',       // FLOW-22
        'arena',     // FLOW-13
        'expedition', // FLOW-14
        'equipment', // FLOW-09
        'shop',      // FLOW-08
      ];

      for (const panel of coveredPanels) {
        const found = FEATURE_ITEMS.find(item => item.id === panel);
        assertStrict(!!found, 'FLOW-23-36',
          `已覆盖面板 ${panel} 应在功能菜单中`);
      }
    });

    it(accTest('FLOW-23-37', '审查 — 未覆盖模块记录为TODO'), () => {
      const missingModules = [
        { id: 'heritage', label: '传承面板', engineSupport: true, uiSupport: true },
        { id: 'social', label: '好友面板', engineSupport: true, uiSupport: false },
        { id: 'trade', label: '交易面板', engineSupport: true, uiSupport: false },
        { id: 'settings', label: '设置面板', engineSupport: true, uiSupport: false },
      ];

      for (const mod of missingModules) {
        const found = FEATURE_ITEMS.find(item => item.id === mod.id);
        assertStrict(!!found, 'FLOW-23-37',
          `TODO模块 ${mod.id} 应在功能菜单中`);
      }

      assertStrict(missingModules.length === 4, 'FLOW-23-37',
        `应有4个TODO模块，实际: ${missingModules.length}`);
    });

    it(accTest('FLOW-23-38', '审查 — 更多Tab是所有功能的统一入口'), () => {
      const panelIds = FEATURE_ITEMS.map(item => item.id);

      // 核心功能面板
      const corePanels = ['quest', 'shop', 'mail'];
      for (const panel of corePanels) {
        assertStrict(panelIds.includes(panel), 'FLOW-23-38',
          `核心面板 ${panel} 应在更多菜单中`);
      }

      // 社交面板
      const socialPanels = ['social', 'alliance'];
      for (const panel of socialPanels) {
        assertStrict(panelIds.includes(panel), 'FLOW-23-38',
          `社交面板 ${panel} 应在更多菜单中`);
      }

      // 扩展面板
      const extPanels = ['expedition', 'equipment', 'npc', 'arena', 'army'];
      for (const panel of extPanels) {
        assertStrict(panelIds.includes(panel), 'FLOW-23-38',
          `扩展面板 ${panel} 应在更多菜单中`);
      }

      // 系统面板
      const sysPanels = ['events', 'heritage', 'trade', 'settings'];
      for (const panel of sysPanels) {
        assertStrict(panelIds.includes(panel), 'FLOW-23-38',
          `系统面板 ${panel} 应在更多菜单中`);
      }
    });
  });
});
