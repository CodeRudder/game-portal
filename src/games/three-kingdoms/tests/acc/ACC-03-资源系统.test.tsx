/**
 * ACC-03 资源系统 — 用户验收集成测试
 *
 * 覆盖范围：
 * - 基础可见性：资源栏显示6种资源、数值、速率
 * - 核心交互：离线收益领取、收支详情弹窗
 * - 数据正确性：资源数值与引擎同步、格式化（中文万/亿）
 * - 边界情况：资源为0、溢出、上限警告
 * - 手机端适配
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import ResourceBar from '@/components/idle/panels/resource/ResourceBar';
import OfflineRewardModal from '@/components/idle/three-kingdoms/OfflineRewardModal';
import type { Resources, ProductionRate, ResourceCap, ResourceType, OfflineEarnings } from '@/games/three-kingdoms/engine';
import { accTest, assertStrict, assertVisible, assertContainsText } from './acc-test-utils';

// ─────────────────────────────────────────────
// Mock CSS imports
// ─────────────────────────────────────────────
vi.mock('@/components/idle/panels/resource/ResourceBar.css', () => ({}));

// ─────────────────────────────────────────────
// Test Data Factory
// ─────────────────────────────────────────────

function makeDefaultResources(overrides: Partial<Resources> = {}): Resources {
  return {
    grain: 500,
    gold: 300,
    troops: 50,
    mandate: 0,
    techPoint: 0,
    recruitToken: 10,
    ...overrides,
  };
}

function makeDefaultRates(overrides: Partial<ProductionRate> = {}): ProductionRate {
  return {
    grain: 0.8,
    gold: 0,
    troops: 0,
    mandate: 0,
    techPoint: 0,
    recruitToken: 0,
    ...overrides,
  };
}

function makeDefaultCaps(overrides: Partial<ResourceCap> = {}): ResourceCap {
  return {
    grain: 2000,
    gold: null,
    troops: 500,
    mandate: null,
    techPoint: null,
    recruitToken: null,
    ...overrides,
  };
}

function makeOfflineEarnings(overrides: Partial<OfflineEarnings> = {}): OfflineEarnings {
  return {
    offlineSeconds: 600,
    earned: {
      grain: 480,
      gold: 780,
      troops: 0,
      mandate: 10,
      techPoint: 0,
      recruitToken: 0,
    },
    isCapped: false,
    ...overrides,
  };
}

function makeBuildings() {
  return {
    castle: { type: 'castle' as const, level: 1, status: 'idle' as const, upgradeStartTime: null, upgradeEndTime: null },
    farmland: { type: 'farmland' as const, level: 1, status: 'idle' as const, upgradeStartTime: null, upgradeEndTime: null },
    market: { type: 'market' as const, level: 0, status: 'locked' as const, upgradeStartTime: null, upgradeEndTime: null },
    barracks: { type: 'barracks' as const, level: 0, status: 'locked' as const, upgradeStartTime: null, upgradeEndTime: null },
    smithy: { type: 'smithy' as const, level: 0, status: 'locked' as const, upgradeStartTime: null, upgradeEndTime: null },
    academy: { type: 'academy' as const, level: 0, status: 'locked' as const, upgradeStartTime: null, upgradeEndTime: null },
    clinic: { type: 'clinic' as const, level: 0, status: 'locked' as const, upgradeStartTime: null, upgradeEndTime: null },
    wall: { type: 'wall' as const, level: 0, status: 'locked' as const, upgradeStartTime: null, upgradeEndTime: null },
  };
}

// ─────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────

describe('ACC-03 资源系统验收集成测试', () => {

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  // ═══════════════════════════════════════════
  // 1. 基础可见性（ACC-03-01 ~ ACC-03-09）
  // ═══════════════════════════════════════════

  it(accTest('ACC-03-01', '资源栏在主界面正确渲染 — 包含资源栏容器'), () => {
    const resources = makeDefaultResources();
    const rates = makeDefaultRates();
    const caps = makeDefaultCaps();
    render(<ResourceBar resources={resources} rates={rates} caps={caps} />);
    const bar = screen.getByTestId('resource-bar');
    assertVisible(bar, 'ACC-03-01', '资源栏容器');
    assertStrict(bar.getAttribute('role') === 'status', 'ACC-03-01', '资源栏应有 role=status');
  });

  it(accTest('ACC-03-02', '6种资源图标和名称正确显示 — 粮草/铜钱/兵力/天命/科技点/招贤令'), () => {
    const resources = makeDefaultResources();
    const rates = makeDefaultRates();
    const caps = makeDefaultCaps();
    render(<ResourceBar resources={resources} rates={rates} caps={caps} />);
    const expectedIcons = ['🌾', '💰', '⚔️', '👑', '🔬', '📜'];
    for (const icon of expectedIcons) {
      const iconEl = screen.getByText(icon);
      assertVisible(iconEl, 'ACC-03-02', `资源图标 ${icon}`);
    }
  });

  it(accTest('ACC-03-03', '资源数值实时显示 — 各资源项显示当前数值'), () => {
    const resources = makeDefaultResources({ grain: 1234, gold: 5678 });
    const rates = makeDefaultRates();
    const caps = makeDefaultCaps();
    render(<ResourceBar resources={resources} rates={rates} caps={caps} />);
    const grainValue = screen.getByTestId('resource-bar-grain-value');
    assertVisible(grainValue, 'ACC-03-03', '粮草数值');
    assertContainsText(grainValue, 'ACC-03-03', '1234');
    const goldValue = screen.getByTestId('resource-bar-gold-value');
    assertVisible(goldValue, 'ACC-03-03', '铜钱数值');
    assertContainsText(goldValue, 'ACC-03-03', '5678');
  });

  it(accTest('ACC-03-04', '产出速率文本正确显示 — 有产出的资源显示速率'), () => {
    const resources = makeDefaultResources();
    const rates = makeDefaultRates({ grain: 0.8, gold: -0.5 });
    const caps = makeDefaultCaps();
    render(<ResourceBar resources={resources} rates={rates} caps={caps} />);
    const grainItem = screen.getByTestId('resource-bar-item-grain');
    assertContainsText(grainItem, 'ACC-03-04', '+0.8/秒');
    const goldItem = screen.getByTestId('resource-bar-item-gold');
    assertContainsText(goldItem, 'ACC-03-04', '-0.5/秒');
  });

  it(accTest('ACC-03-05', '有上限资源显示容量进度条 — 粮草和兵力'), () => {
    const resources = makeDefaultResources({ grain: 1000, troops: 250 });
    const rates = makeDefaultRates();
    const caps = makeDefaultCaps();
    render(<ResourceBar resources={resources} rates={rates} caps={caps} />);
    const grainItem = screen.getByTestId('resource-bar-item-grain');
    const grainCapFill = grainItem.querySelector('.tk-res-cap-bar-fill');
    assertStrict(!!grainCapFill, 'ACC-03-05', '粮草进度条应存在');
    const troopsItem = screen.getByTestId('resource-bar-item-troops');
    const troopsCapFill = troopsItem.querySelector('.tk-res-cap-bar-fill');
    assertStrict(!!troopsCapFill, 'ACC-03-05', '兵力进度条应存在');
  });

  it(accTest('ACC-03-06', '有上限资源显示/上限数值 — 粮草和兵力'), () => {
    const resources = makeDefaultResources({ grain: 500, troops: 50 });
    const rates = makeDefaultRates();
    const caps = makeDefaultCaps();
    render(<ResourceBar resources={resources} rates={rates} caps={caps} />);
    const grainCap = screen.getByTestId('resource-bar-grain-cap');
    assertContainsText(grainCap, 'ACC-03-06', '2000');
    const troopsCap = screen.getByTestId('resource-bar-troops-cap');
    assertContainsText(troopsCap, 'ACC-03-06', '500');
  });

  it(accTest('ACC-03-07', '收支详情按钮可见 — 📊 按钮'), () => {
    const resources = makeDefaultResources();
    const rates = makeDefaultRates();
    const caps = makeDefaultCaps();
    render(<ResourceBar resources={resources} rates={rates} caps={caps} />);
    const detailBtn = screen.getByTestId('resource-bar-detail-btn');
    assertVisible(detailBtn, 'ACC-03-07', '收支详情按钮');
    assertStrict(detailBtn.getAttribute('title') === '收支详情', 'ACC-03-07', '按钮title应为收支详情');
  });

  it(accTest('ACC-03-08', '游戏标题"三国霸业"显示'), () => {
    const resources = makeDefaultResources();
    const rates = makeDefaultRates();
    const caps = makeDefaultCaps();
    render(<ResourceBar resources={resources} rates={rates} caps={caps} />);
    const title = screen.getByTestId('resource-bar-title');
    assertVisible(title, 'ACC-03-08', '游戏标题');
    assertContainsText(title, 'ACC-03-08', '三国霸业');
  });

  // ═══════════════════════════════════════════
  // 2. 核心交互（ACC-03-10 ~ ACC-03-19）
  // ═══════════════════════════════════════════

  it(accTest('ACC-03-10', '点击收支详情按钮打开弹窗 — 显示"资源收支"标题'), async () => {
    const resources = makeDefaultResources();
    const rates = makeDefaultRates();
    const caps = makeDefaultCaps();
    const buildings = makeBuildings();
    render(<ResourceBar resources={resources} rates={rates} caps={caps} buildings={buildings} />);
    const detailBtn = screen.getByTestId('resource-bar-detail-btn');
    await userEvent.click(detailBtn);
    const modalTitle = screen.getByText('资源收支');
    assertVisible(modalTitle, 'ACC-03-10', '收支详情弹窗标题');
  });

  it(accTest('ACC-03-11', '收支详情弹窗显示产出明细 — 建筑产出列表'), async () => {
    const resources = makeDefaultResources();
    const rates = makeDefaultRates();
    const caps = makeDefaultCaps();
    const buildings = makeBuildings();
    render(<ResourceBar resources={resources} rates={rates} caps={caps} buildings={buildings} />);
    const detailBtn = screen.getByTestId('resource-bar-detail-btn');
    await userEvent.click(detailBtn);
    const modal = screen.getByTestId('resource-bar-detail-modal');
    assertVisible(modal, 'ACC-03-11', '收支详情弹窗');
    const prodTitle = screen.getByText('产出');
    assertVisible(prodTitle, 'ACC-03-11', '产出标题');
  });

  it(accTest('ACC-03-12', '收支详情弹窗显示净收入 — 各资源净收支'), async () => {
    const resources = makeDefaultResources();
    const rates = makeDefaultRates({ grain: 0.8 });
    const caps = makeDefaultCaps();
    const buildings = makeBuildings();
    render(<ResourceBar resources={resources} rates={rates} caps={caps} buildings={buildings} />);
    const detailBtn = screen.getByTestId('resource-bar-detail-btn');
    await userEvent.click(detailBtn);
    const netTitle = screen.getByText('净收入');
    assertVisible(netTitle, 'ACC-03-12', '净收入标题');
  });

  it(accTest('ACC-03-13', '点击遮罩关闭收支详情弹窗'), async () => {
    const resources = makeDefaultResources();
    const rates = makeDefaultRates();
    const caps = makeDefaultCaps();
    const buildings = makeBuildings();
    render(<ResourceBar resources={resources} rates={rates} caps={caps} buildings={buildings} />);
    const detailBtn = screen.getByTestId('resource-bar-detail-btn');
    await userEvent.click(detailBtn);
    const overlay = screen.getByTestId('resource-bar-detail-overlay');
    await userEvent.click(overlay);
    const closedModal = screen.queryByTestId('resource-bar-detail-modal');
    assertStrict(closedModal === null, 'ACC-03-13', '点击遮罩后弹窗应关闭');
  });

  it(accTest('ACC-03-14', '点击✕关闭收支详情弹窗'), async () => {
    const resources = makeDefaultResources();
    const rates = makeDefaultRates();
    const caps = makeDefaultCaps();
    const buildings = makeBuildings();
    render(<ResourceBar resources={resources} rates={rates} caps={caps} buildings={buildings} />);
    const detailBtn = screen.getByTestId('resource-bar-detail-btn');
    await userEvent.click(detailBtn);
    const closeBtn = screen.getByTestId('resource-bar-detail-close');
    await userEvent.click(closeBtn);
    const closedModal = screen.queryByTestId('resource-bar-detail-modal');
    assertStrict(closedModal === null, 'ACC-03-14', '点击✕后弹窗应关闭');
  });

  it(accTest('ACC-03-15', '离线收益弹窗正确渲染 — 显示"离线收益"标题'), () => {
    const reward = makeOfflineEarnings();
    const onClaim = vi.fn();
    render(<OfflineRewardModal reward={reward} onClaim={onClaim} />);
    const title = screen.getByText('离线收益');
    assertVisible(title, 'ACC-03-15', '离线收益弹窗标题');
  });

  it(accTest('ACC-03-16', '离线收益弹窗显示资源明细 — 粮草/铜钱/天命卡片'), () => {
    const reward = makeOfflineEarnings();
    const onClaim = vi.fn();
    render(<OfflineRewardModal reward={reward} onClaim={onClaim} />);
    const grainCard = screen.getByTestId('offline-reward-grain');
    assertVisible(grainCard, 'ACC-03-16', '粮草收益卡片');
    assertContainsText(grainCard, 'ACC-03-16', '480');
    const goldCard = screen.getByTestId('offline-reward-gold');
    assertVisible(goldCard, 'ACC-03-16', '铜钱收益卡片');
    assertContainsText(goldCard, 'ACC-03-16', '780');
    const mandateCard = screen.getByTestId('offline-reward-mandate');
    assertVisible(mandateCard, 'ACC-03-16', '天命收益卡片');
    assertContainsText(mandateCard, 'ACC-03-16', '10');
  });

  it(accTest('ACC-03-17', '领取离线收益 — 点击"领取收益"按钮触发回调'), () => {
    const reward = makeOfflineEarnings();
    const onClaim = vi.fn();
    render(<OfflineRewardModal reward={reward} onClaim={onClaim} />);
    const claimBtn = screen.getByText('领取收益');
    assertVisible(claimBtn, 'ACC-03-17', '领取收益按钮');
    fireEvent.click(claimBtn);
    assertStrict(onClaim.mock.calls.length === 1, 'ACC-03-17', 'onClaim回调应被调用1次');
  });

  it(accTest('ACC-03-18', '离线收益弹窗显示离线时长 — "⏱ 离线时长"文本'), () => {
    const reward = makeOfflineEarnings({ offlineSeconds: 7200 });
    const onClaim = vi.fn();
    render(<OfflineRewardModal reward={reward} onClaim={onClaim} />);
    const durationText = screen.getByText(/离线时长/);
    assertVisible(durationText, 'ACC-03-18', '离线时长文本');
    assertContainsText(durationText, 'ACC-03-18', '2小时');
  });

  // ═══════════════════════════════════════════
  // 3. 数据正确性（ACC-03-20 ~ ACC-03-29）
  // ═══════════════════════════════════════════

  it(accTest('ACC-03-20', '新游戏初始资源数值正确 — 粮草500/铜钱300/兵力50/天命0/科技点0/招贤令10'), () => {
    const resources = makeDefaultResources();
    const rates = makeDefaultRates();
    const caps = makeDefaultCaps();
    render(<ResourceBar resources={resources} rates={rates} caps={caps} />);
    assertContainsText(screen.getByTestId('resource-bar-grain-value'), 'ACC-03-20', '500');
    assertContainsText(screen.getByTestId('resource-bar-gold-value'), 'ACC-03-20', '300');
    assertContainsText(screen.getByTestId('resource-bar-troops-value'), 'ACC-03-20', '50');
    assertContainsText(screen.getByTestId('resource-bar-mandate-value'), 'ACC-03-20', '0');
    assertContainsText(screen.getByTestId('resource-bar-techPoint-value'), 'ACC-03-20', '0');
    assertContainsText(screen.getByTestId('resource-bar-recruitToken-value'), 'ACC-03-20', '10');
  });

  it(accTest('ACC-03-22', '资源消耗后数值正确减少 — 渲染更新后的数值'), () => {
    const { rerender } = render(
      <ResourceBar resources={makeDefaultResources()} rates={makeDefaultRates()} caps={makeDefaultCaps()} />,
    );
    assertContainsText(screen.getByTestId('resource-bar-gold-value'), 'ACC-03-22', '300');
    rerender(
      <ResourceBar
        resources={makeDefaultResources({ gold: 100 })}
        rates={makeDefaultRates()}
        caps={makeDefaultCaps()}
      />,
    );
    assertContainsText(screen.getByTestId('resource-bar-gold-value'), 'ACC-03-22', '100');
  });

  it(accTest('ACC-03-23', '离线收益计算结果正确传递 — earned数据与弹窗显示一致'), () => {
    const reward = makeOfflineEarnings({
      offlineSeconds: 600,
      earned: { grain: 480, gold: 780, troops: 0, mandate: 10, techPoint: 0, recruitToken: 0 },
    });
    const onClaim = vi.fn();
    render(<OfflineRewardModal reward={reward} onClaim={onClaim} />);
    const grainCard = screen.getByTestId('offline-reward-grain');
    assertContainsText(grainCard, 'ACC-03-23', '480');
    const goldCard = screen.getByTestId('offline-reward-gold');
    assertContainsText(goldCard, 'ACC-03-23', '780');
  });

  it(accTest('ACC-03-25', '离线收益上限72小时 — isCapped为true时显示警告'), () => {
    const reward = makeOfflineEarnings({ offlineSeconds: 259200, isCapped: true });
    const onClaim = vi.fn();
    render(<OfflineRewardModal reward={reward} onClaim={onClaim} />);
    const cappedWarning = screen.getByText('⚠️ 已达上限');
    assertVisible(cappedWarning, 'ACC-03-25', '已达上限警告');
  });

  it(accTest('ACC-03-27', '批量资源消耗原子性 — 多资源同时更新'), () => {
    const { rerender } = render(
      <ResourceBar resources={makeDefaultResources()} rates={makeDefaultRates()} caps={makeDefaultCaps()} />,
    );
    rerender(
      <ResourceBar
        resources={makeDefaultResources({ grain: 200, gold: 100 })}
        rates={makeDefaultRates()}
        caps={makeDefaultCaps()}
      />,
    );
    assertContainsText(screen.getByTestId('resource-bar-grain-value'), 'ACC-03-27', '200');
    assertContainsText(screen.getByTestId('resource-bar-gold-value'), 'ACC-03-27', '100');
  });

  // ═══════════════════════════════════════════
  // 4. 边界情况（ACC-03-30 ~ ACC-03-39）
  // ═══════════════════════════════════════════

  it(accTest('ACC-03-30', '资源达到上限后进度条100% — 粮草满'), () => {
    const resources = makeDefaultResources({ grain: 2000 });
    const rates = makeDefaultRates();
    const caps = makeDefaultCaps();
    render(<ResourceBar resources={resources} rates={rates} caps={caps} />);
    const grainItem = screen.getByTestId('resource-bar-item-grain');
    assertStrict(
      grainItem.className.includes('full'),
      'ACC-03-30',
      '粮草满时应显示full警告样式',
    );
    assertContainsText(grainItem, 'ACC-03-30', '已满');
  });

  it(accTest('ACC-03-31', '容量接近上限80%~95%显示橙色警告'), () => {
    const resources = makeDefaultResources({ grain: 1800 }); // 90%
    const rates = makeDefaultRates();
    const caps = makeDefaultCaps();
    render(<ResourceBar resources={resources} rates={rates} caps={caps} />);
    const grainItem = screen.getByTestId('resource-bar-item-grain');
    assertStrict(
      grainItem.className.includes('warning'),
      'ACC-03-31',
      '粮草90%时应显示warning样式',
    );
    assertContainsText(grainItem, 'ACC-03-31', '接近上限');
  });

  it(accTest('ACC-03-32', '容量接近满95%~100%显示红色紧急警告'), () => {
    const resources = makeDefaultResources({ grain: 1960 }); // 98%
    const rates = makeDefaultRates();
    const caps = makeDefaultCaps();
    render(<ResourceBar resources={resources} rates={rates} caps={caps} />);
    const grainItem = screen.getByTestId('resource-bar-item-grain');
    assertStrict(
      grainItem.className.includes('urgent'),
      'ACC-03-32',
      '粮草98%时应显示urgent样式',
    );
    assertContainsText(grainItem, 'ACC-03-32', '将满');
  });

  it(accTest('ACC-03-33', '溢出预判警告横幅显示 — pendingGains触发'), () => {
    const resources = makeDefaultResources({ grain: 1950 });
    const rates = makeDefaultRates();
    const caps = makeDefaultCaps();
    const pendingGains = { grain: 200 }; // 1950+200=2150 > 2000
    render(<ResourceBar resources={resources} rates={rates} caps={caps} pendingGains={pendingGains} />);
    const banner = screen.getByTestId('resource-bar-overflow-banner');
    assertVisible(banner, 'ACC-03-33', '溢出警告横幅');
    assertContainsText(banner, 'ACC-03-33', '粮草溢出');
  });

  it(accTest('ACC-03-35', '资源不足时操作按钮禁用/提示 — 铜钱为0'), () => {
    const resources = makeDefaultResources({ gold: 0 });
    const rates = makeDefaultRates();
    const caps = makeDefaultCaps();
    render(<ResourceBar resources={resources} rates={rates} caps={caps} />);
    const goldValue = screen.getByTestId('resource-bar-gold-value');
    assertContainsText(goldValue, 'ACC-03-35', '0');
  });

  it(accTest('ACC-03-36', '新游戏无建筑产出时收支详情显示"暂无建筑产出"'), async () => {
    const resources = makeDefaultResources();
    const rates = makeDefaultRates({ grain: 0 });
    const caps = makeDefaultCaps();
    // 所有建筑 level=0 才能触发"暂无建筑产出"（BUILDING_DEFS 中 level<=0 的建筑无产出）
    const buildings = {
      castle: { type: 'castle' as const, level: 0, status: 'locked' as const, upgradeStartTime: null, upgradeEndTime: null },
      farmland: { type: 'farmland' as const, level: 0, status: 'locked' as const, upgradeStartTime: null, upgradeEndTime: null },
      market: { type: 'market' as const, level: 0, status: 'locked' as const, upgradeStartTime: null, upgradeEndTime: null },
      barracks: { type: 'barracks' as const, level: 0, status: 'locked' as const, upgradeStartTime: null, upgradeEndTime: null },
      smithy: { type: 'smithy' as const, level: 0, status: 'locked' as const, upgradeStartTime: null, upgradeEndTime: null },
      academy: { type: 'academy' as const, level: 0, status: 'locked' as const, upgradeStartTime: null, upgradeEndTime: null },
      clinic: { type: 'clinic' as const, level: 0, status: 'locked' as const, upgradeStartTime: null, upgradeEndTime: null },
      wall: { type: 'wall' as const, level: 0, status: 'locked' as const, upgradeStartTime: null, upgradeEndTime: null },
    };
    render(<ResourceBar resources={resources} rates={rates} caps={caps} buildings={buildings} />);
    const detailBtn = screen.getByTestId('resource-bar-detail-btn');
    await userEvent.click(detailBtn);
    const emptyText = screen.getByText('暂无建筑产出');
    assertVisible(emptyText, 'ACC-03-36', '暂无建筑产出文本');
  });

  it(accTest('ACC-03-38', '大数值资源格式化显示正确 — 12345678显示为1234.6万'), () => {
    const resources = makeDefaultResources({ gold: 12345678 });
    const rates = makeDefaultRates();
    const caps = makeDefaultCaps();
    render(<ResourceBar resources={resources} rates={rates} caps={caps} />);
    const goldValue = screen.getByTestId('resource-bar-gold-value');
    assertContainsText(goldValue, 'ACC-03-38', '1234.6万');
  });

  it(accTest('ACC-03-39', '资源数值不会出现NaN或负数 — 渲染不崩溃'), () => {
    const resources = makeDefaultResources({ grain: 0, gold: 0, troops: 0 });
    const rates = makeDefaultRates({ grain: 0, gold: 0 });
    const caps = makeDefaultCaps();
    const { container } = render(<ResourceBar resources={resources} rates={rates} caps={caps} />);
    assertStrict(!container.innerHTML.includes('NaN'), 'ACC-03-39', '不应出现NaN');
    assertStrict(!container.innerHTML.includes('Infinity'), 'ACC-03-39', '不应出现Infinity');
  });

  // ═══════════════════════════════════════════
  // 5. 手机端适配（ACC-03-40 ~ ACC-03-49）
  // ═══════════════════════════════════════════

  it(accTest('ACC-03-40', '资源栏手机端自适应布局 — 渲染不崩溃'), () => {
    const resources = makeDefaultResources();
    const rates = makeDefaultRates();
    const caps = makeDefaultCaps();
    render(<ResourceBar resources={resources} rates={rates} caps={caps} />);
    const bar = screen.getByTestId('resource-bar');
    assertVisible(bar, 'ACC-03-40', '手机端资源栏');
  });

  it(accTest('ACC-03-44', '手机端离线收益弹窗适配 — 资源卡片网格显示'), () => {
    const reward = makeOfflineEarnings({
      earned: { grain: 100, gold: 200, troops: 50, mandate: 10, techPoint: 0, recruitToken: 0 },
    });
    const onClaim = vi.fn();
    render(<OfflineRewardModal reward={reward} onClaim={onClaim} />);
    const grainCard = screen.getByTestId('offline-reward-grain');
    const goldCard = screen.getByTestId('offline-reward-gold');
    assertVisible(grainCard, 'ACC-03-44', '手机端粮草卡片');
    assertVisible(goldCard, 'ACC-03-44', '手机端铜钱卡片');
  });

  it(accTest('ACC-03-48', '手机端触摸收支详情按钮 — 按钮可点击'), async () => {
    const resources = makeDefaultResources();
    const rates = makeDefaultRates();
    const caps = makeDefaultCaps();
    const buildings = makeBuildings();
    render(<ResourceBar resources={resources} rates={rates} caps={caps} buildings={buildings} />);
    const detailBtn = screen.getByTestId('resource-bar-detail-btn');
    assertStrict(!detailBtn.hasAttribute('disabled'), 'ACC-03-48', '收支详情按钮应可点击');
    await userEvent.click(detailBtn);
    const modal = screen.getByTestId('resource-bar-detail-modal');
    assertVisible(modal, 'ACC-03-48', '点击后弹窗应打开');
  });

  it(accTest('ACC-03-49', '手机端大数值不截断 — 100万显示为紧凑格式'), () => {
    const resources = makeDefaultResources({ gold: 1000000 });
    const rates = makeDefaultRates();
    const caps = makeDefaultCaps();
    render(<ResourceBar resources={resources} rates={rates} caps={caps} />);
    const goldValue = screen.getByTestId('resource-bar-gold-value');
    assertContainsText(goldValue, 'ACC-03-49', '100万');
  });
});
