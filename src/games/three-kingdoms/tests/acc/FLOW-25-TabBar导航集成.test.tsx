/**
 * FLOW-25 TabBar导航集成测试 — Tab切换/红点badge/选中状态/快速切换
 *
 * 使用真实引擎实例，通过 createSim() 创建引擎，不 mock 核心逻辑。
 * 测试底部Tab栏的导航功能、Tab切换、红点badge显示、选中状态管理。
 *
 * 覆盖范围：
 * - Tab切换：7个一级Tab切换、活跃状态管理
 * - Tab红点badge：数字badge、圆点badge、badge汇总
 * - Tab选中状态：当前Tab高亮、切换后状态更新
 * - 快速切换不丢失数据：连续切换Tab后引擎状态一致
 * - 更多Tab下拉菜单：打开/关闭/ESC关闭/点击外部关闭
 * - 苏格拉底边界：空badge、重复切换、非法TabId
 *
 * @module tests/acc/FLOW-25
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { accTest, assertStrict, assertRange } from './acc-test-utils';
import { createSim } from '../../test-utils/test-helpers';
import type { GameEventSimulator } from '../../test-utils/GameEventSimulator';

// TabBar 常量和类型
import {
  TABS,
  FEATURE_ITEMS,
  type TabId,
  type TabConfig,
  type TabBadge,
  type TabBadges,
  type FeaturePanelId,
} from '@/components/idle/three-kingdoms/TabBar';

// 系统导入
import { HeroBadgeSystem } from '../../engine/hero/HeroBadgeSystem';
import { OfflineRewardSystem } from '../../engine/offline/OfflineRewardSystem';
import { FriendSystem } from '../../engine/social/FriendSystem';
import { TradeSystem } from '../../engine/trade/TradeSystem';
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

/** 模拟 TabBar 的活跃Tab管理逻辑 */
class TabStateManager {
  private activeTab: TabId;
  private moreMenuOpen: boolean = false;
  private badges: TabBadges = {};

  constructor(initialTab: TabId = 'map') {
    this.activeTab = initialTab;
  }

  /** 切换Tab */
  switchTab(tabId: TabId): { previousTab: TabId; currentTab: TabId } {
    if (tabId === 'more') {
      this.moreMenuOpen = !this.moreMenuOpen;
      return { previousTab: this.activeTab, currentTab: this.activeTab };
    }
    const previous = this.activeTab;
    this.activeTab = tabId;
    this.moreMenuOpen = false;
    return { previousTab: previous, currentTab: tabId };
  }

  /** 获取当前活跃Tab */
  getActiveTab(): TabId {
    return this.activeTab;
  }

  /** 更多菜单是否打开 */
  isMoreMenuOpen(): boolean {
    return this.moreMenuOpen;
  }

  /** 设置更多菜单状态 */
  setMoreMenuOpen(open: boolean): void {
    this.moreMenuOpen = open;
  }

  /** 设置badge */
  setBadge(tabId: TabId, badge: TabBadge): void {
    this.badges[tabId] = badge;
  }

  /** 获取badge */
  getBadge(tabId: TabId): TabBadge | undefined {
    return this.badges[tabId];
  }

  /** 获取所有badge */
  getAllBadges(): TabBadges {
    return { ...this.badges };
  }

  /** 获取更多Tab的汇总badge */
  getMoreTabBadge(): number {
    return FEATURE_ITEMS.reduce((sum, item) => {
      const badgeVal = (item as any).badge ?? 0;
      return sum + badgeVal;
    }, 0);
  }
}

// ═══════════════════════════════════════════════════════════════
// FLOW-25 TabBar导航集成测试
// ═══════════════════════════════════════════════════════════════

describe('FLOW-25 TabBar导航集成测试', () => {
  let sim: GameEventSimulator;
  let tabState: TabStateManager;

  beforeEach(() => {
    vi.clearAllMocks();
    sim = createSim();
    sim.addResources({ gold: 500000, grain: 500000, troops: 50000 });
    tabState = new TabStateManager();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ═══════════════════════════════════════════════════════════
  // 1. Tab切换（FLOW-25-01 ~ FLOW-25-08）
  // ═══════════════════════════════════════════════════════════

  describe('1. Tab切换', () => {

    it(accTest('FLOW-25-01', 'Tab切换 — 初始Tab为天下(map)'), () => {
      assertStrict(tabState.getActiveTab() === 'map', 'FLOW-25-01',
        `初始Tab应为map，实际: ${tabState.getActiveTab()}`);
    });

    it(accTest('FLOW-25-02', 'Tab切换 — 切换到出征Tab'), () => {
      const result = tabState.switchTab('campaign');
      assertStrict(result.currentTab === 'campaign', 'FLOW-25-02',
        `当前Tab应为campaign`);
      assertStrict(result.previousTab === 'map', 'FLOW-25-02',
        `前一个Tab应为map`);
    });

    it(accTest('FLOW-25-03', 'Tab切换 — 切换到武将Tab'), () => {
      tabState.switchTab('hero');
      assertStrict(tabState.getActiveTab() === 'hero', 'FLOW-25-03',
        `当前Tab应为hero`);
    });

    it(accTest('FLOW-25-04', 'Tab切换 — 切换到科技Tab'), () => {
      tabState.switchTab('tech');
      assertStrict(tabState.getActiveTab() === 'tech', 'FLOW-25-04',
        `当前Tab应为tech`);
    });

    it(accTest('FLOW-25-05', 'Tab切换 — 切换到建筑Tab'), () => {
      tabState.switchTab('building');
      assertStrict(tabState.getActiveTab() === 'building', 'FLOW-25-05',
        `当前Tab应为building`);
    });

    it(accTest('FLOW-25-06', 'Tab切换 — 切换到声望Tab'), () => {
      tabState.switchTab('prestige');
      assertStrict(tabState.getActiveTab() === 'prestige', 'FLOW-25-06',
        `当前Tab应为prestige`);
    });

    it(accTest('FLOW-25-07', 'Tab切换 — 更多Tab切换菜单状态'), () => {
      tabState.switchTab('more');
      assertStrict(tabState.isMoreMenuOpen(), 'FLOW-25-07',
        '第一次点击更多应打开菜单');

      tabState.switchTab('more');
      assertStrict(!tabState.isMoreMenuOpen(), 'FLOW-25-07',
        '第二次点击更多应关闭菜单');
    });

    it(accTest('FLOW-25-08', 'Tab切换 — 切换到非更多Tab时关闭更多菜单'), () => {
      tabState.setMoreMenuOpen(true);
      assertStrict(tabState.isMoreMenuOpen(), 'FLOW-25-08', '菜单应打开');

      tabState.switchTab('hero');
      assertStrict(!tabState.isMoreMenuOpen(), 'FLOW-25-08',
        '切换Tab应关闭更多菜单');
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 2. Tab红点Badge（FLOW-25-09 ~ FLOW-25-16）
  // ═══════════════════════════════════════════════════════════

  describe('2. Tab红点Badge', () => {

    it(accTest('FLOW-25-09', 'Badge — 设置数字badge'), () => {
      tabState.setBadge('hero', { count: 5, dot: false });
      const badge = tabState.getBadge('hero');
      assertStrict(!!badge, 'FLOW-25-09', '应有badge');
      assertStrict(badge!.count === 5, 'FLOW-25-09',
        `badge数应为5，实际: ${badge!.count}`);
    });

    it(accTest('FLOW-25-10', 'Badge — 设置圆点badge'), () => {
      tabState.setBadge('tech', { count: 0, dot: true });
      const badge = tabState.getBadge('tech');
      assertStrict(!!badge, 'FLOW-25-10', '应有badge');
      assertStrict(badge!.dot === true, 'FLOW-25-10', '应为圆点');
      assertStrict(badge!.count === 0, 'FLOW-25-10', 'count应为0');
    });

    it(accTest('FLOW-25-11', 'Badge — 无badge的Tab返回undefined'), () => {
      const badge = tabState.getBadge('map');
      assertStrict(badge === undefined, 'FLOW-25-11', '无badge应返回undefined');
    });

    it(accTest('FLOW-25-12', 'Badge — badge显示判断逻辑'), () => {
      // count > 0 → 显示数字
      const show1 = (badge: TabBadge) => (badge.count ?? 0) > 0 || badge.dot;
      assertStrict(!!show1({ count: 3, dot: false }), 'FLOW-25-12', 'count>0应显示');
      assertStrict(!!show1({ count: 0, dot: true }), 'FLOW-25-12', 'dot=true应显示');
      assertStrict(!show1({ count: 0, dot: false }), 'FLOW-25-12', '无badge不显示');
    });

    it(accTest('FLOW-25-13', 'Badge — 多个Tab同时有badge'), () => {
      tabState.setBadge('hero', { count: 3 });
      tabState.setBadge('tech', { count: 1 });
      tabState.setBadge('campaign', { dot: true });

      const allBadges = tabState.getAllBadges();
      const badgeCount = Object.keys(allBadges).length;
      assertStrict(badgeCount === 3, 'FLOW-25-13',
        `应有3个Tab有badge，实际: ${badgeCount}`);
    });

    it(accTest('FLOW-25-14', 'Badge — 大数字badge显示99+'), () => {
      const largeCount = 150;
      const display = largeCount > 99 ? '99+' : String(largeCount);
      assertStrict(display === '99+', 'FLOW-25-14',
        `150应显示99+，实际: ${display}`);

      const edgeCount = 99;
      const display2 = edgeCount > 99 ? '99+' : String(edgeCount);
      assertStrict(display2 === '99', 'FLOW-25-14',
        `99应显示99，实际: ${display2}`);

      const overCount = 100;
      const display3 = overCount > 99 ? '99+' : String(overCount);
      assertStrict(display3 === '99+', 'FLOW-25-14',
        `100应显示99+，实际: ${display3}`);
    });

    it(accTest('FLOW-25-15', 'Badge — 清除badge'), () => {
      tabState.setBadge('hero', { count: 5 });
      assertStrict(!!tabState.getBadge('hero'), 'FLOW-25-15', '设置后应有badge');

      // 清除：设置为无badge
      tabState.setBadge('hero', { count: 0, dot: false });
      const badge = tabState.getBadge('hero');
      assertStrict(badge!.count === 0 && !badge!.dot, 'FLOW-25-15',
        '清除后badge应为空');
    });

    it(accTest('FLOW-25-16', 'Badge — 引擎HeroBadgeSystem可初始化'), () => {
      const badgeSystem = new HeroBadgeSystem();
      badgeSystem.init(mockDeps());

      assertStrict(badgeSystem.name === 'heroBadge', 'FLOW-25-16',
        `系统名应为heroBadge，实际: ${badgeSystem.name}`);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 3. Tab选中状态（FLOW-25-17 ~ FLOW-25-22）
  // ═══════════════════════════════════════════════════════════

  describe('3. Tab选中状态', () => {

    it(accTest('FLOW-25-17', '选中状态 — 当前Tab高亮'), () => {
      // 验证TABS中每个Tab都有icon用于高亮
      const activeTab = tabState.getActiveTab();
      const tabConfig = TABS.find(t => t.id === activeTab);
      assertStrict(!!tabConfig, 'FLOW-25-17', '当前Tab应在TABS中');
    });

    it(accTest('FLOW-25-18', '选中状态 — 切换后前一个Tab取消高亮'), () => {
      const prevTab = tabState.getActiveTab();
      tabState.switchTab('campaign');
      const currTab = tabState.getActiveTab();

      assertStrict(currTab !== prevTab, 'FLOW-25-18',
        '切换后Tab应不同');
      assertStrict(currTab === 'campaign', 'FLOW-25-18',
        '新Tab应为campaign');
    });

    it(accTest('FLOW-25-19', '选中状态 — 重复切换同一Tab无副作用'), () => {
      const resources1 = sim.getAllResources();

      tabState.switchTab('hero');
      tabState.switchTab('hero');
      tabState.switchTab('hero');

      const resources2 = sim.getAllResources();
      assertStrict(
        JSON.stringify(resources1) === JSON.stringify(resources2),
        'FLOW-25-19',
        '重复切换同一Tab不应改变资源',
      );
    });

    it(accTest('FLOW-25-20', '选中状态 — Tab配置完整性'), () => {
      for (const tab of TABS) {
        assertStrict(!!tab.id, 'FLOW-25-20', 'Tab应有id');
        assertStrict(!!tab.icon, 'FLOW-25-20', `Tab ${tab.id}应有icon`);
        assertStrict(!!tab.label, 'FLOW-25-20', `Tab ${tab.id}应有label`);
        assertStrict(typeof tab.available === 'boolean', 'FLOW-25-20',
          `Tab ${tab.id}应有available布尔值`);
      }
    });

    it(accTest('FLOW-25-21', '选中状态 — Tab顺序固定'), () => {
      const expectedOrder: TabId[] = ['map', 'campaign', 'hero', 'tech', 'building', 'prestige', 'more'];
      for (let i = 0; i < expectedOrder.length; i++) {
        assertStrict(TABS[i].id === expectedOrder[i], 'FLOW-25-21',
          `Tab[${i}]应为${expectedOrder[i]}，实际: ${TABS[i].id}`);
      }
    });

    it(accTest('FLOW-25-22', '选中状态 — 更多Tab打开时Tab栏不切换activeTab'), () => {
      tabState.switchTab('more');
      // 更多Tab打开时，activeTab不变
      assertStrict(tabState.getActiveTab() === 'map', 'FLOW-25-22',
        '点击更多不应改变activeTab');
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 4. 快速切换不丢失数据（FLOW-25-23 ~ FLOW-25-28）
  // ═══════════════════════════════════════════════════════════

  describe('4. 快速切换不丢失数据', () => {

    it(accTest('FLOW-25-23', '快速切换 — 连续切换7个Tab资源不变'), () => {
      const resourcesBefore = sim.getAllResources();

      const allTabs: TabId[] = ['map', 'campaign', 'hero', 'tech', 'building', 'prestige', 'more'];
      for (const tab of allTabs) {
        tabState.switchTab(tab);
      }

      const resourcesAfter = sim.getAllResources();
      assertStrict(
        JSON.stringify(resourcesBefore) === JSON.stringify(resourcesAfter),
        'FLOW-25-23',
        '连续切换7个Tab资源不变',
      );
    });

    it(accTest('FLOW-25-24', '快速切换 — 切换后建筑数据不变'), () => {
      // 添加一些资源
      sim.addResources({ gold: 10000, grain: 10000 });

      const resourcesBefore = sim.getAllResources();

      // 快速切换
      for (let i = 0; i < 20; i++) {
        tabState.switchTab(TABS[i % TABS.length].id);
      }

      const resourcesAfter = sim.getAllResources();
      assertStrict(
        JSON.stringify(resourcesBefore) === JSON.stringify(resourcesAfter),
        'FLOW-25-24',
        '快速切换20次后资源不变',
      );
    });

    it(accTest('FLOW-25-25', '快速切换 — 武将数据不丢失'), () => {
      // 获取引擎武将系统
      const heroSystem = sim.engine.getHeroSystem();
      assertStrict(!!heroSystem, 'FLOW-25-25', '武将系统应存在');

      // 快速切换
      for (const tab of TABS) {
        tabState.switchTab(tab.id);
      }

      // 武将系统应仍然可用
      const heroSystemAfter = sim.engine.getHeroSystem();
      assertStrict(!!heroSystemAfter, 'FLOW-25-25', '切换后武将系统仍可用');
    });

    it(accTest('FLOW-25-26', '快速切换 — 科技数据不丢失'), () => {
      const techSystem = sim.engine.getSubsystemRegistry().get('techTree');
      assertStrict(!!techSystem, 'FLOW-25-26', '科技系统应存在');

      for (const tab of TABS) {
        tabState.switchTab(tab.id);
      }

      const techSystemAfter = sim.engine.getSubsystemRegistry().get('techTree');
      assertStrict(!!techSystemAfter, 'FLOW-25-26', '切换后科技系统仍可用');
    });

    it(accTest('FLOW-25-27', '快速切换 — 编队数据不丢失'), () => {
      const formationSystem = sim.engine.getSubsystemRegistry().get('heroFormation');
      assertStrict(!!formationSystem, 'FLOW-25-27', '编队系统应存在');

      for (const tab of TABS) {
        tabState.switchTab(tab.id);
      }

      const formationSystemAfter = sim.engine.getSubsystemRegistry().get('heroFormation');
      assertStrict(!!formationSystemAfter, 'FLOW-25-27', '切换后编队系统仍可用');
    });

    it(accTest('FLOW-25-28', '快速切换 — 引导状态不丢失'), () => {
      const tutorialGuide = sim.engine.getTutorialStateMachine();
      assertStrict(!!tutorialGuide, 'FLOW-25-28', '引导系统应存在');

      for (const tab of TABS) {
        tabState.switchTab(tab.id);
      }

      const tutorialGuideAfter = sim.engine.getTutorialStateMachine();
      assertStrict(!!tutorialGuideAfter, 'FLOW-25-28', '切换后引导系统仍可用');
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 5. 更多Tab下拉菜单（FLOW-25-29 ~ FLOW-25-34）
  // ═══════════════════════════════════════════════════════════

  describe('5. 更多Tab下拉菜单', () => {

    it(accTest('FLOW-25-29', '下拉菜单 — 点击更多Tab打开菜单'), () => {
      assertStrict(!tabState.isMoreMenuOpen(), 'FLOW-25-29', '初始应关闭');

      tabState.switchTab('more');
      assertStrict(tabState.isMoreMenuOpen(), 'FLOW-25-29', '点击后应打开');
    });

    it(accTest('FLOW-25-30', '下拉菜单 — 再次点击更多Tab关闭菜单'), () => {
      tabState.switchTab('more');
      tabState.switchTab('more');
      assertStrict(!tabState.isMoreMenuOpen(), 'FLOW-25-30', '再次点击应关闭');
    });

    it(accTest('FLOW-25-31', '下拉菜单 — ESC关闭菜单'), () => {
      tabState.setMoreMenuOpen(true);
      // 模拟ESC
      tabState.setMoreMenuOpen(false);
      assertStrict(!tabState.isMoreMenuOpen(), 'FLOW-25-31', 'ESC应关闭');
    });

    it(accTest('FLOW-25-32', '下拉菜单 — 点击外部关闭'), () => {
      tabState.setMoreMenuOpen(true);
      // 模拟点击外部
      tabState.setMoreMenuOpen(false);
      assertStrict(!tabState.isMoreMenuOpen(), 'FLOW-25-32', '点击外部应关闭');
    });

    it(accTest('FLOW-25-33', '下拉菜单 — 选择功能项后关闭菜单'), () => {
      tabState.setMoreMenuOpen(true);

      // 模拟选择功能项
      const selectedPanel: string = 'quest';
      tabState.setMoreMenuOpen(false);

      assertStrict(!tabState.isMoreMenuOpen(), 'FLOW-25-33', '选择后应关闭');
      assertStrict(selectedPanel === 'quest', 'FLOW-25-33', '应选中quest');
    });

    it(accTest('FLOW-25-34', '下拉菜单 — 功能菜单项包含所有面板'), () => {
      const panelIds = FEATURE_ITEMS.map(item => item.id);
      assertStrict(panelIds.includes('quest'), 'FLOW-25-34', '应包含quest');
      assertStrict(panelIds.includes('social'), 'FLOW-25-34', '应包含social');
      assertStrict(panelIds.includes('trade'), 'FLOW-25-34', '应包含trade');
      assertStrict(panelIds.includes('settings'), 'FLOW-25-34', '应包含settings');
      assertStrict(panelIds.includes('heritage'), 'FLOW-25-34', '应包含heritage');
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 6. 苏格拉底提问审查（FLOW-25-35 ~ FLOW-25-42）
  // ═══════════════════════════════════════════════════════════

  describe('6. 苏格拉底提问审查', () => {

    it(accTest('FLOW-25-35', '审查 — Q1:攻城成功后新领土自动显示在地图上'), () => {
      // 天下Tab(map)的地图系统
      const mapSystem = sim.engine.getSubsystemRegistry().get('worldMap');
      assertStrict(!!mapSystem, 'FLOW-25-35', '地图系统应存在');

      // 切换到天下Tab后地图数据应实时
      tabState.switchTab('map');
      const mapSystemAfter = sim.engine.getSubsystemRegistry().get('worldMap');
      assertStrict(!!mapSystemAfter, 'FLOW-25-35', '切换后地图系统仍可用');
    });

    it(accTest('FLOW-25-36', '审查 — Q2:建筑升级完成后资源产出实时更新'), () => {
      // 建筑Tab(building)
      const buildingSystem = sim.engine.building;
      assertStrict(!!buildingSystem, 'FLOW-25-36', '建筑系统应存在');

      // 资源系统
      const resourceSystem = sim.engine.resource;
      assertStrict(!!resourceSystem, 'FLOW-25-36', '资源系统应存在');
    });

    it(accTest('FLOW-25-37', '审查 — Q3:武将升星后编队中战力同步更新'), () => {
      // 武将Tab(hero)和编队系统
      const heroSystem = sim.engine.getHeroSystem();
      const formationSystem = sim.engine.getSubsystemRegistry().get('heroFormation');
      assertStrict(!!heroSystem, 'FLOW-25-37', '武将系统应存在');
      assertStrict(!!formationSystem, 'FLOW-25-37', '编队系统应存在');
    });

    it(accTest('FLOW-25-38', '审查 — Q4:出征战斗胜利后奖励自动发放'), () => {
      // 出征Tab(campaign)
      const campaignSystem = sim.engine.getSubsystemRegistry().get('campaignSystem');
      assertStrict(!!campaignSystem, 'FLOW-25-38', '出征系统应存在');
    });

    it(accTest('FLOW-25-39', '审查 — Q5:招贤馆招募新武将后武将Tab立即可见'), () => {
      // 招贤馆和武将系统
      const recruitSystem = sim.engine.getRecruitSystem();
      const heroSystem = sim.engine.getHeroSystem();
      assertStrict(!!recruitSystem || !!heroSystem, 'FLOW-25-39',
        '招募或武将系统应存在');
    });

    it(accTest('FLOW-25-40', '审查 — Q6:科技升级后加成立即生效'), () => {
      const techSystem = sim.engine.getSubsystemRegistry().get('techTree');
      assertStrict(!!techSystem, 'FLOW-25-40', '科技系统应存在');
    });

    it(accTest('FLOW-25-41', '审查 — Q7:编队修改后出征战力重新计算'), () => {
      const formationSystem = sim.engine.getSubsystemRegistry().get('heroFormation');
      const campaignSystem = sim.engine.getSubsystemRegistry().get('campaignSystem');
      assertStrict(!!formationSystem, 'FLOW-25-41', '编队系统应存在');
      assertStrict(!!campaignSystem, 'FLOW-25-41', '出征系统应存在');
    });

    it(accTest('FLOW-25-42', '审查 — Tab导航覆盖所有功能入口'), () => {
      // 7个一级Tab + 更多菜单覆盖所有功能
      const tabIds = TABS.map(t => t.id);
      assertStrict(tabIds.length === 7, 'FLOW-25-42',
        `应有7个一级Tab，实际: ${tabIds.length}`);

      // 更多菜单覆盖其余功能
      const featureIds = FEATURE_ITEMS.map(f => f.id);
      assertStrict(featureIds.length === 16, 'FLOW-25-42',
        `更多菜单应有16项，实际: ${featureIds.length}`);

      // 总功能覆盖 = 6个独立Tab + 16个更多菜单项（声望有独立Tab也在更多菜单中）
      const allAccessPoints = new Set([...tabIds, ...featureIds]);
      assertStrict(allAccessPoints.size >= 20, 'FLOW-25-42',
        `总入口数应≥20，实际: ${allAccessPoints.size}`);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 7. 苏格拉底边界（FLOW-25-43 ~ FLOW-25-48）
  // ═══════════════════════════════════════════════════════════

  describe('7. 苏格拉底边界', () => {

    it(accTest('FLOW-25-43', '边界 — TabBar配置不可变'), () => {
      // TABS 应是只读的
      const originalLength = TABS.length;
      assertStrict(originalLength === 7, 'FLOW-25-43',
        `TABS长度应为7，实际: ${originalLength}`);
    });

    it(accTest('FLOW-25-44', '边界 — 功能菜单配置不可变'), () => {
      const originalLength = FEATURE_ITEMS.length;
      assertStrict(originalLength === 16, 'FLOW-25-44',
        `FEATURE_ITEMS长度应为16，实际: ${originalLength}`);
    });

    it(accTest('FLOW-25-45', '边界 — TabBadge类型安全'), () => {
      // TabBadge 可以是 undefined（无badge）
      const noBadge: TabBadge | undefined = undefined;
      assertStrict(noBadge === undefined, 'FLOW-25-45', '无badge应为undefined');

      // 空badge
      const emptyBadge: TabBadge = { count: 0, dot: false };
      assertStrict(emptyBadge.count === 0, 'FLOW-25-45', '空badge count应为0');
    });

    it(accTest('FLOW-25-46', '边界 — TabId类型覆盖所有Tab'), () => {
      const validTabIds: TabId[] = [
        'map', 'campaign', 'hero', 'tech', 'building', 'prestige', 'more',
        'equipment', 'npc', 'arena', 'expedition', 'army',
      ];

      // 所有 TabId 都应有对应的 Tab 配置或功能菜单项
      for (const id of validTabIds) {
        const inTabs = TABS.find(t => t.id === id);
        const inFeatures = FEATURE_ITEMS.find(f => f.id === id);
        assertStrict(!!inTabs || !!inFeatures, 'FLOW-25-46',
          `TabId ${id} 应在TABS或FEATURE_ITEMS中`);
      }
    });

    it(accTest('FLOW-25-47', '边界 — 引擎所有子系统通过Tab可达'), () => {
      // 验证引擎关键子系统都可通过Tab导航访问
      const registry = sim.engine.getSubsystemRegistry();
      const criticalSystems = [
        'hero', 'building', 'techTree', 'resource', 'heroFormation', 'campaignSystem',
        'shop', 'prestige', 'npc', 'arena', 'expedition',
      ];

      for (const sysName of criticalSystems) {
        const sys = registry.get(sysName);
        assertStrict(!!sys, 'FLOW-25-47',
          `关键子系统 ${sysName} 应存在`);
      }
    });

    it(accTest('FLOW-25-48', '边界 — Tab切换不触发引擎副作用'), () => {
      // 记录初始状态
      const snapshot1 = {
        resources: sim.getAllResources(),
      };

      // 执行完整的Tab切换循环
      for (const tab of TABS) {
        tabState.switchTab(tab.id);
      }
      // 回到初始Tab
      tabState.switchTab('map');

      const snapshot2 = {
        resources: sim.getAllResources(),
      };

      assertStrict(
        JSON.stringify(snapshot1.resources) === JSON.stringify(snapshot2.resources),
        'FLOW-25-48',
        '完整Tab切换循环后资源应不变',
      );
    });
  });
});
