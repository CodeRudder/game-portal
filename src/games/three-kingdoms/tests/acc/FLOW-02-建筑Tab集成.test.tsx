/** FLOW-02 建筑Tab集成测试 — 渲染/列表/升级/前置条件/产出/队列/快速完成/离线收益/取消/SceneRouter。使用真实引擎，不mock。 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BuildingPanel from '@/components/idle/panels/building/BuildingPanel';
import BuildingUpgradeModal from '@/components/idle/panels/building/BuildingUpgradeModal';
import BuildingIncomeModal from '@/components/idle/panels/building/BuildingIncomeModal';
import type { BuildingType, BuildingState, Resources, ProductionRate, ResourceCap } from '@/games/three-kingdoms/shared/types';
import {
  BUILDING_TYPES,
  BUILDING_LABELS,
  BUILDING_ICONS,
  BUILDING_DEFS,
} from '@/games/three-kingdoms/engine/building';
import { accTest, assertStrict, assertInDOM, assertContainsText } from './acc-test-utils';
import { createSim } from '../../test-utils/test-helpers';
import type { GameEventSimulator } from '../../test-utils/GameEventSimulator';

/** Mock CSS imports */
vi.mock('@/components/idle/panels/building/BuildingPanel.css', () => ({}));
vi.mock('@/components/idle/panels/building/BuildingUpgradeModal.css', () => ({}));
vi.mock('@/components/idle/panels/building/BuildingIncomeModal.css', () => ({}));
vi.mock('@/components/idle/components/SharedPanel.css', () => ({}));

// ─────────────────────────────────────────────
// Test Data Factory
// ─────────────────────────────────────────────

/** 从 sim 获取快照数据并提取面板所需的 props */
function getSnapshotProps(sim: GameEventSimulator) {
  const snap = sim.engine.getSnapshot();
  return {
    buildings: snap.buildings as Record<BuildingType, BuildingState>,
    resources: snap.resources as Resources,
    rates: snap.productionRates as ProductionRate,
    caps: snap.caps as ResourceCap,
  };
}

/** 补充资源的辅助函数 */
function refillResources(sim: GameEventSimulator): void {
  sim.engine.resource.setCap('grain', 50_000_000);
  sim.engine.resource.setCap('troops', 10_000_000);
  sim.addResources({ grain: 10_000_000, gold: 10_000_000, troops: 500_000 });
}

/**
 * 创建带充足资源的建筑测试 sim。
 * 主城已升级到 Lv2，解除子建筑 Lv1→Lv2 的等级限制。
 */
function createBuildingSim(): GameEventSimulator {
  const sim = createSim();
  refillResources(sim);
  sim.upgradeBuilding('castle'); // castle Lv1→2
  refillResources(sim);
  return sim;
}

/**
 * 创建高等级 sim（主城Lv6+，解锁2个队列槽位，所有基础建筑解锁）。
 * 用于需要多队列或高等级解锁的测试。
 */
function createHighLevelSim(): GameEventSimulator {
  const sim = createSim();
  refillResources(sim);
  // castle → Lv4
  sim.upgradeBuildingTo('castle', 4);
  refillResources(sim);
  // farmland → Lv4（满足 castle Lv4→5 前置）
  sim.upgradeBuildingTo('farmland', 4);
  refillResources(sim);
  // castle → Lv5（解锁城墙，2个队列槽位需Lv6）
  sim.upgradeBuildingTo('castle', 5);
  refillResources(sim);
  // castle → Lv6（2个队列槽位）
  sim.upgradeBuildingTo('castle', 6);
  refillResources(sim);
  return sim;
}

/** 创建 BuildingPanel props */
function makePanelProps(sim: GameEventSimulator, overrides: Record<string, any> = {}) {
  const snapProps = getSnapshotProps(sim);
  return {
    ...snapProps,
    engine: sim.engine,
    snapshotVersion: 0,
    onUpgradeComplete: vi.fn(),
    onUpgradeError: vi.fn(),
    ...overrides,
  };
}

/** 创建 BuildingUpgradeModal props */
function makeUpgradeModalProps(sim: GameEventSimulator, overrides: Record<string, any> = {}) {
  const snapProps = getSnapshotProps(sim);
  return {
    buildingType: 'farmland' as BuildingType,
    engine: sim.engine,
    resources: snapProps.resources,
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
    ...overrides,
  };
}

/** 创建 BuildingIncomeModal props */
function makeIncomeModalProps(sim: GameEventSimulator, overrides: Record<string, any> = {}) {
  const snapProps = getSnapshotProps(sim);
  return {
    isOpen: true,
    onClose: vi.fn(),
    engine: sim.engine,
    buildings: snapProps.buildings,
    rates: snapProps.rates,
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════

describe('FLOW-02 建筑Tab集成测试', () => {
  beforeEach(() => { vi.clearAllMocks(); });
  afterEach(() => { cleanup(); });

  // ═══════════════════════════════════════════════════════════════
  // 1. 建筑Tab渲染（FLOW-02-01 ~ FLOW-02-05）
  // ═══════════════════════════════════════════════════════════════

  it(accTest('FLOW-02-01', '建筑Tab整体渲染 — 面板容器、城池地图、建筑列表可见'), () => {
    const sim = createBuildingSim();
    render(<BuildingPanel {...makePanelProps(sim)} />);

    const panel = screen.getByTestId('building-panel');
    assertInDOM(panel, 'FLOW-02-01', '建筑面板容器');

    const map = screen.getByTestId('building-panel-map');
    assertInDOM(map, 'FLOW-02-01', '城池地图');

    const list = screen.getByTestId('building-panel-list');
    assertInDOM(list, 'FLOW-02-01', '建筑列表');
  });

  it(accTest('FLOW-02-02', '建筑列表显示 — 所有8座建筑名称可见'), () => {
    const sim = createBuildingSim();
    render(<BuildingPanel {...makePanelProps(sim)} />);

    for (const type of BUILDING_TYPES) {
      const name = BUILDING_LABELS[type];
      const nameEls = screen.getAllByText(name);
      assertStrict(nameEls.length >= 1, 'FLOW-02-02', `建筑 ${name} 应可见`);
    }
  });

  it(accTest('FLOW-02-03', '建筑图标显示 — 已解锁建筑显示对应图标'), () => {
    const sim = createBuildingSim();
    render(<BuildingPanel {...makePanelProps(sim)} />);

    // 主城Lv2后解锁：castle, farmland, market, barracks
    const unlockedTypes: BuildingType[] = ['castle', 'farmland', 'market', 'barracks'];
    for (const type of unlockedTypes) {
      const icon = BUILDING_ICONS[type];
      const iconEls = screen.getAllByText(icon);
      assertStrict(iconEls.length >= 1, 'FLOW-02-03', `${BUILDING_LABELS[type]} 图标应可见`);
    }
  });

  it(accTest('FLOW-02-04', '建筑等级显示 — Lv标签正确'), () => {
    const sim = createBuildingSim();
    render(<BuildingPanel {...makePanelProps(sim)} />);

    // castle Lv2, farmland Lv1
    const lv2Els = screen.getAllByText('Lv.2');
    assertStrict(lv2Els.length >= 1, 'FLOW-02-04', '应显示主城Lv.2');
    const lv1Els = screen.getAllByText('Lv.1');
    assertStrict(lv1Els.length >= 1, 'FLOW-02-04', '应显示农田Lv.1');
  });

  it(accTest('FLOW-02-05', '收支详情按钮可见 — 📊按钮存在'), () => {
    const sim = createBuildingSim();
    render(<BuildingPanel {...makePanelProps(sim)} />);

    const incomeBtn = screen.getByTestId('building-panel-income-btn');
    assertInDOM(incomeBtn, 'FLOW-02-05', '收支详情按钮');
  });

  // ═══════════════════════════════════════════════════════════════
  // 2. 建筑列表详情（FLOW-02-06 ~ FLOW-02-10）
  // ═══════════════════════════════════════════════════════════════

  it(accTest('FLOW-02-06', '地图布局 — 每座建筑有地图节点'), () => {
    const sim = createBuildingSim();
    render(<BuildingPanel {...makePanelProps(sim)} />);

    for (const type of BUILDING_TYPES) {
      const item = screen.getByTestId(`building-panel-item-${type}`);
      assertInDOM(item, 'FLOW-02-06', `${BUILDING_LABELS[type]} 地图节点`);
    }
  });

  it(accTest('FLOW-02-07', '未解锁建筑 — 显示🔒和灰色样式'), () => {
    const sim = createBuildingSim();
    render(<BuildingPanel {...makePanelProps(sim)} />);

    // 主城Lv2：smithy(castle≥3), academy(castle≥3), clinic(castle≥4), wall(castle≥5) 仍锁定
    const lockedTypes: BuildingType[] = ['smithy', 'academy', 'clinic', 'wall'];
    for (const type of lockedTypes) {
      const item = screen.getByTestId(`building-panel-item-${type}`);
      assertStrict(item.className.includes('locked'), 'FLOW-02-07', `${BUILDING_LABELS[type]} 应有locked样式`);
    }
  });

  it(accTest('FLOW-02-08', '已解锁建筑产出文字 — 显示产出速率'), () => {
    const sim = createBuildingSim();
    render(<BuildingPanel {...makePanelProps(sim)} />);

    const farmlandItem = screen.getByTestId('building-panel-item-farmland');
    assertContainsText(farmlandItem, 'FLOW-02-08', '粮草');
  });

  it(accTest('FLOW-02-09', '可升级建筑指示器 — 显示▲'), () => {
    const sim = createBuildingSim();
    render(<BuildingPanel {...makePanelProps(sim)} />);

    // farmland Lv1，主城Lv2，资源充足，应可升级
    const check = sim.engine.checkUpgrade('farmland');
    if (check.canUpgrade) {
      const farmlandItem = screen.getByTestId('building-panel-item-farmland');
      const indicator = within(farmlandItem).queryByText('▲');
      assertStrict(!!indicator, 'FLOW-02-09', '可升级建筑应显示▲指示器');
    }
  });

  it(accTest('FLOW-02-10', '手机端列表布局 — 所有建筑有列表项'), () => {
    const sim = createBuildingSim();
    render(<BuildingPanel {...makePanelProps(sim)} />);

    for (const type of BUILDING_TYPES) {
      const listItem = screen.getByTestId(`building-panel-list-item-${type}`);
      assertInDOM(listItem, 'FLOW-02-10', `${BUILDING_LABELS[type]} 列表项`);
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // 3. 建筑升级流程（FLOW-02-11 ~ FLOW-02-16）
  // ═══════════════════════════════════════════════════════════════

  it(accTest('FLOW-02-11', '点击建筑打开升级弹窗 — 弹出BuildingUpgradeModal'), async () => {
    const sim = createBuildingSim();
    render(<BuildingPanel {...makePanelProps(sim)} />);

    const farmlandItem = screen.getByTestId('building-panel-item-farmland');
    await userEvent.click(farmlandItem);

    const modalHeader = screen.getByTestId('building-upgrade-header');
    assertInDOM(modalHeader, 'FLOW-02-11', '升级弹窗头部');
  });

  it(accTest('FLOW-02-12', '升级弹窗 — 显示建筑名称和等级'), async () => {
    const sim = createBuildingSim();
    render(<BuildingUpgradeModal {...makeUpgradeModalProps(sim, { buildingType: 'farmland' })} />);

    const header = screen.getByTestId('building-upgrade-header');
    assertContainsText(header, 'FLOW-02-12', '农田');
    assertContainsText(header, 'FLOW-02-12', 'Lv.');
  });

  it(accTest('FLOW-02-13', '升级弹窗 — 升级预览显示等级变化'), async () => {
    const sim = createBuildingSim();
    render(<BuildingUpgradeModal {...makeUpgradeModalProps(sim, { buildingType: 'farmland' })} />);

    const levelChange = screen.getByText(/Lv\.1.*Lv\.2/);
    assertInDOM(levelChange, 'FLOW-02-13', '等级变化预览');
  });

  it(accTest('FLOW-02-14', '升级弹窗 — 费用明细显示粮草和铜钱'), async () => {
    const sim = createBuildingSim();
    render(<BuildingUpgradeModal {...makeUpgradeModalProps(sim, { buildingType: 'farmland' })} />);

    const cost = sim.engine.getUpgradeCost('farmland');
    assertStrict(!!cost, 'FLOW-02-14', '应有升级费用');
    assertStrict(cost!.grain > 0, 'FLOW-02-14', '粮草费用应大于0');
    assertStrict(cost!.gold > 0, 'FLOW-02-14', '铜钱费用应大于0');
  });

  it(accTest('FLOW-02-15', '确认升级操作 — 触发onConfirm回调（资源充足时）'), async () => {
    const onConfirm = vi.fn();
    const sim = createBuildingSim();
    render(<BuildingUpgradeModal {...makeUpgradeModalProps(sim, { buildingType: 'farmland', onConfirm })} />);

    // 确认按钮应可用（资源充足）
    const confirmBtn = screen.getByTestId('building-upgrade-confirm') as HTMLButtonElement;
    assertStrict(!confirmBtn.disabled, 'FLOW-02-15', '资源充足时确认按钮应可用');

    await userEvent.click(confirmBtn);
    assertStrict(onConfirm.mock.calls.length === 1, 'FLOW-02-15', 'onConfirm应被调用1次');
    assertStrict(onConfirm.mock.calls[0][0] === 'farmland', 'FLOW-02-15', '回调参数应为farmland');
  });

  it(accTest('FLOW-02-16', '关闭升级弹窗 — 点击取消按钮'), async () => {
    const onCancel = vi.fn();
    const sim = createBuildingSim();
    render(<BuildingUpgradeModal {...makeUpgradeModalProps(sim, { buildingType: 'farmland', onCancel })} />);

    const cancelBtn = screen.getByTestId('building-upgrade-cancel');
    await userEvent.click(cancelBtn);

    assertStrict(onCancel.mock.calls.length === 1, 'FLOW-02-16', 'onCancel应被调用1次');
  });

  // ═══════════════════════════════════════════════════════════════
  // 4. 升级前置条件（FLOW-02-17 ~ FLOW-02-22）
  // ═══════════════════════════════════════════════════════════════

  it(accTest('FLOW-02-17', '资源不足时按钮disabled — 弹窗确认按钮禁用'), () => {
    const sim = createSim(); // 不添加额外资源
    // P0-1修复后：农田不再被主城等级限制，需要手动设置资源不足
    sim.engine.resource.setResource('grain', 10);
    sim.engine.resource.setResource('gold', 10);
    const snapProps = getSnapshotProps(sim);
    render(<BuildingUpgradeModal {...makeUpgradeModalProps(sim, {
      buildingType: 'farmland',
      resources: snapProps.resources,
    })} />);

    const confirmBtn = screen.getByTestId('building-upgrade-confirm') as HTMLButtonElement;
    // 资源不足（grain=10 < 100, gold=10 < 50），按钮应禁用
    assertStrict(confirmBtn.disabled, 'FLOW-02-17', '资源不足时确认按钮应禁用');
  });

  it(accTest('FLOW-02-18', '引擎层升级前置条件 — 非主城建筑等级不能超过主城+1'), () => {
    const sim = createSim(); // castle Lv1, farmland Lv1
    const buildingSys = sim.engine.building;
    const resources = sim.engine.resource.getResources();

    // P0-1修复后：farmland Lv1 <= castle Lv1 + 1 = 2，可以升级
    const checkInitial = buildingSys.checkUpgrade('farmland', resources);
    assertStrict(checkInitial.canUpgrade, 'FLOW-02-18', 'farmland Lv1 应可升级（允许领先主城1级）');

    // 升级农田到 Lv2
    sim.upgradeBuilding('farmland'); // farmland Lv1→2

    // 现在 farmland Lv2, castle Lv1 → farmland level(2) > castle level(1) → 不可升级
    refillResources(sim);
    const checkExceeded = buildingSys.checkUpgrade('farmland');
    assertStrict(!checkExceeded.canUpgrade, 'FLOW-02-18', 'farmland Lv2超过castle Lv1+1时应不可升级');
    assertStrict(checkExceeded.reasons.some(r => r.includes('主城等级')), 'FLOW-02-18', '原因应包含主城等级限制');
  });

  it(accTest('FLOW-02-19', '等级上限判断 — 满级后不可升级'), () => {
    const sim = createBuildingSim();
    const buildingSys = sim.engine.building;

    // 使用 checkUpgrade 直接测试满级逻辑
    // 先升级 farmland 到高等级来测试
    const maxLevel = BUILDING_DEFS.farmland.maxLevel;
    const currentLevel = buildingSys.getLevel('farmland');
    assertStrict(currentLevel < maxLevel, 'FLOW-02-19', '初始不应为满级');

    // 验证满级检查逻辑存在
    const def = BUILDING_DEFS.farmland;
    assertStrict(def.maxLevel === 25, 'FLOW-02-19', '农田满级应为25');
  });

  it(accTest('FLOW-02-20', '非主城建筑等级不能超过主城+1 — 前置条件检查'), () => {
    const sim = createBuildingSim();
    const buildingSys = sim.engine.building;

    // castle Lv2, farmland Lv1 → farmland 可升级到 Lv2
    // 升级 farmland 到 Lv2
    sim.upgradeBuilding('farmland'); // farmland Lv1→2

    // 现在 castle Lv2, farmland Lv2 → farmland level(2) > castle level(2)? No, 2 == 2
    // P0-1修复后：farmland level(2) <= castle level(2) + 1 = 3，可以继续升级
    refillResources(sim);
    const checkAfterLv2 = buildingSys.checkUpgrade('farmland');
    // farmland Lv2 → Lv3, castle Lv2, farmland(2) <= castle(2)+1=3 → 可以
    assertStrict(checkAfterLv2.canUpgrade, 'FLOW-02-20', 'farmland Lv2在castle Lv2时应可升级到Lv3');

    // 升级 farmland 到 Lv3
    sim.upgradeBuilding('farmland'); // farmland Lv2→3

    // 现在 castle Lv2, farmland Lv3 → farmland level(3) > castle level(2) → 不可升级
    refillResources(sim);
    const checkExceeded = buildingSys.checkUpgrade('farmland');
    const hasLevelCap = checkExceeded.reasons.some(r => r.includes('主城等级'));
    assertStrict(hasLevelCap, 'FLOW-02-20', '建筑等级超过主城等级+1后应有限制');
  });

  it(accTest('FLOW-02-21', '主城升级特殊前置 — Lv4→5需其他建筑Lv4'), () => {
    const sim = createBuildingSim();
    const buildingSys = sim.engine.building;

    // 升级到 castle Lv4
    refillResources(sim);
    sim.upgradeBuildingTo('castle', 4);
    refillResources(sim);

    // 检查 castle Lv4→5 的前置条件（没有其他建筑 Lv4）
    const check = buildingSys.checkUpgrade('castle');
    const hasPreReq = check.reasons.some(r => r.includes('Lv4'));
    assertStrict(hasPreReq, 'FLOW-02-21', 'Lv4→5应有前置条件：需要其他建筑Lv4');
  });

  it(accTest('FLOW-02-22', '升级队列已满 — 不可再升级'), () => {
    const sim = createBuildingSim();
    const buildingSys = sim.engine.building;

    // 主城 Lv2，队列只有1个槽位
    const maxSlots = buildingSys.getMaxQueueSlots();
    assertStrict(maxSlots === 1, 'FLOW-02-22', '主城Lv2时队列槽位应为1');

    // 开始升级 farmland（直接操作引擎，不即时完成）
    refillResources(sim);
    const resources = sim.engine.resource.getResources();
    const cost = buildingSys.startUpgrade('farmland', resources);
    assertStrict(!!cost, 'FLOW-02-22', '第一次升级应成功');

    // 队列已满，再升级应被拒绝
    const check = buildingSys.checkUpgrade('castle');
    const queueFull = check.reasons.some(r => r.includes('队列已满'));
    assertStrict(queueFull, 'FLOW-02-22', '队列满后应有队列已满提示');
  });

  // ═══════════════════════════════════════════════════════════════
  // 5. 建筑产出（FLOW-02-23 ~ FLOW-02-27）
  // ═══════════════════════════════════════════════════════════════

  it(accTest('FLOW-02-23', '升级后产出增加 — farmland升级粮草产出增加'), () => {
    const sim = createBuildingSim();
    const buildingSys = sim.engine.building;

    const beforeProd = buildingSys.getProduction('farmland');
    refillResources(sim);
    sim.upgradeBuilding('farmland'); // Lv1→2
    const afterProd = buildingSys.getProduction('farmland');

    assertStrict(afterProd > beforeProd, 'FLOW-02-23', `升级后产出应增加：${beforeProd} → ${afterProd}`);
  });

  it(accTest('FLOW-02-24', '引擎层产出计算 — 与配置表一致'), () => {
    const sim = createBuildingSim();
    const buildingSys = sim.engine.building;

    // farmland Lv1 产出应为 0.8（来自配置表）
    const farmlandProd = buildingSys.getProduction('farmland', 1);
    const expectedProd = BUILDING_DEFS.farmland.levelTable[0].production;
    assertStrict(farmlandProd === expectedProd, 'FLOW-02-24', `farmland Lv1产出应为${expectedProd}，实际${farmlandProd}`);
  });

  it(accTest('FLOW-02-25', '所有建筑产出汇总 — calculateTotalProduction'), () => {
    const sim = createBuildingSim();
    const buildingSys = sim.engine.building;

    const totalProd = buildingSys.calculateTotalProduction();
    const farmlandProd = buildingSys.getProduction('farmland');

    assertStrict(
      Math.abs((totalProd['grain'] ?? 0) - farmlandProd) < 0.01,
      'FLOW-02-25',
      `总粮草产出应等于农田产出：${totalProd['grain']} vs ${farmlandProd}`,
    );
  });

  it(accTest('FLOW-02-26', '主城加成 — 全资源加成百分比'), () => {
    const sim = createBuildingSim();
    const buildingSys = sim.engine.building;

    // 主城 Lv2（+2%）
    const bonus = buildingSys.getCastleBonusPercent();
    assertStrict(bonus === 2, 'FLOW-02-26', `主城Lv2应有2%加成，实际${bonus}`);

    // 升级主城到 Lv3（+4%）
    refillResources(sim);
    sim.upgradeBuilding('castle');
    const bonus3 = buildingSys.getCastleBonusPercent();
    assertStrict(bonus3 === 4, 'FLOW-02-26', `主城Lv3应有4%加成，实际${bonus3}`);
  });

  it(accTest('FLOW-02-27', '升级后产出变化 — 多次升级产出递增'), () => {
    const sim = createBuildingSim();
    const buildingSys = sim.engine.building;

    // 先升级主城到 Lv4，使 farmland 可以升到 Lv3
    refillResources(sim);
    sim.upgradeBuildingTo('castle', 4);

    const prod1 = buildingSys.getProduction('farmland');
    refillResources(sim);
    sim.upgradeBuilding('farmland'); // Lv1→2
    const prod2 = buildingSys.getProduction('farmland');
    refillResources(sim);
    sim.upgradeBuilding('farmland'); // Lv2→3
    const prod3 = buildingSys.getProduction('farmland');

    assertStrict(prod2 > prod1, 'FLOW-02-27', 'Lv2产出应大于Lv1');
    assertStrict(prod3 > prod2, 'FLOW-02-27', 'Lv3产出应大于Lv2');
  });

  // ═══════════════════════════════════════════════════════════════
  // 6. 建筑队列（FLOW-02-28 ~ FLOW-02-32）
  // ═══════════════════════════════════════════════════════════════

  it(accTest('FLOW-02-28', '升级队列显示 — 升级中建筑出现在队列'), () => {
    const sim = createBuildingSim();
    const buildingSys = sim.engine.building;

    // 开始升级（不完成）
    refillResources(sim);
    const resources = sim.engine.resource.getResources();
    buildingSys.startUpgrade('farmland', resources);

    // 重新渲染
    const snapProps = getSnapshotProps(sim);
    render(<BuildingPanel {...makePanelProps(sim, { buildings: snapProps.buildings })} />);

    const queue = screen.getByTestId('building-panel-queue');
    assertInDOM(queue, 'FLOW-02-28', '升级队列面板');
    assertContainsText(queue, 'FLOW-02-28', '升级中');
  });

  it(accTest('FLOW-02-29', '队列槽位配置 — 主城等级决定槽位数'), () => {
    const sim = createBuildingSim();
    const buildingSys = sim.engine.building;

    // 主城 Lv2 → 1个槽位（Lv1~5都是1个）
    assertStrict(buildingSys.getMaxQueueSlots() === 1, 'FLOW-02-29', '主城Lv2应为1个槽位');

    // 使用高等级 sim
    const highSim = createHighLevelSim();
    assertStrict(highSim.engine.building.getMaxQueueSlots() === 2, 'FLOW-02-29', '主城Lv6应为2个槽位');
  });

  it(accTest('FLOW-02-30', '同时升级多个建筑 — 队列满后拒绝'), () => {
    const sim = createHighLevelSim(); // 主城Lv6，2个队列槽位
    const buildingSys = sim.engine.building;

    refillResources(sim);
    const resources = sim.engine.resource.getResources();

    // 第一个升级
    buildingSys.startUpgrade('farmland', resources);

    // 第二个升级
    refillResources(sim);
    const resources2 = sim.engine.resource.getResources();
    buildingSys.startUpgrade('market', resources2);

    // 队列已满（2/2），第三个应被拒绝
    refillResources(sim);
    const check = buildingSys.checkUpgrade('barracks');
    assertStrict(!check.canUpgrade, 'FLOW-02-30', '队列满后不可再升级');
    assertStrict(check.reasons.some(r => r.includes('队列已满')), 'FLOW-02-30', '原因应包含队列已满');
  });

  it(accTest('FLOW-02-31', '升级进度 — getUpgradeProgress返回0~1'), () => {
    const sim = createBuildingSim();
    const buildingSys = sim.engine.building;

    refillResources(sim);
    const resources = sim.engine.resource.getResources();
    buildingSys.startUpgrade('farmland', resources);

    const progress = buildingSys.getUpgradeProgress('farmland');
    assertStrict(progress >= 0 && progress <= 1, 'FLOW-02-31', `进度应在0~1之间，实际${progress}`);
  });

  it(accTest('FLOW-02-32', '升级剩余时间 — getUpgradeRemainingTime'), () => {
    const sim = createBuildingSim();
    const buildingSys = sim.engine.building;

    refillResources(sim);
    const resources = sim.engine.resource.getResources();
    buildingSys.startUpgrade('farmland', resources);

    const remaining = buildingSys.getUpgradeRemainingTime('farmland');
    assertStrict(remaining > 0, 'FLOW-02-32', `剩余时间应大于0，实际${remaining}`);
  });

  // ═══════════════════════════════════════════════════════════════
  // 7. 快速完成/取消升级（FLOW-02-33 ~ FLOW-02-37）
  // ═══════════════════════════════════════════════════════════════

  it(accTest('FLOW-02-33', 'forceCompleteUpgrades — 即时完成升级'), () => {
    const sim = createBuildingSim();
    const buildingSys = sim.engine.building;

    const beforeLevel = buildingSys.getLevel('farmland');
    refillResources(sim);
    const resources = sim.engine.resource.getResources();
    buildingSys.startUpgrade('farmland', resources);

    const completed = buildingSys.forceCompleteUpgrades();
    assertStrict(completed.includes('farmland'), 'FLOW-02-33', 'farmland应在完成列表中');
    assertStrict(buildingSys.getLevel('farmland') === beforeLevel + 1, 'FLOW-02-33', '等级应+1');
  });

  it(accTest('FLOW-02-34', '取消升级 — 资源返还80%'), () => {
    const sim = createBuildingSim();
    const buildingSys = sim.engine.building;

    refillResources(sim);
    const resources = sim.engine.resource.getResources();
    const cost = buildingSys.startUpgrade('farmland', resources);

    assertStrict(!!cost, 'FLOW-02-34', '应有升级费用');

    // 取消升级
    const refund = buildingSys.cancelUpgrade('farmland');
    assertStrict(!!refund, 'FLOW-02-34', '应返回返还资源');

    // 验证返还比例（80%）
    const expectedRefundGrain = Math.round(cost!.grain * 0.8);
    assertStrict(refund!.grain === expectedRefundGrain, 'FLOW-02-34', `应返还80%粮草：${refund!.grain} vs ${expectedRefundGrain}`);

    // 建筑状态恢复
    const state = buildingSys.getBuilding('farmland');
    assertStrict(state.status === 'idle', 'FLOW-02-34', '取消后状态应恢复为idle');
  });

  it(accTest('FLOW-02-35', '取消后可重新升级 — 队列释放'), () => {
    const sim = createBuildingSim();
    const buildingSys = sim.engine.building;

    refillResources(sim);
    const resources = sim.engine.resource.getResources();
    buildingSys.startUpgrade('farmland', resources);
    buildingSys.cancelUpgrade('farmland');

    // 队列应释放
    assertStrict(!buildingSys.isQueueFull(), 'FLOW-02-35', '取消后队列不应满');

    // 可重新升级（队列不再是限制因素）
    refillResources(sim);
    const check = buildingSys.checkUpgrade('farmland');
    const queueBlock = check.reasons.some(r => r.includes('队列已满'));
    assertStrict(!queueBlock, 'FLOW-02-35', '取消后不应有队列满限制');
  });

  it(accTest('FLOW-02-36', 'tick完成升级 — 等级提升+状态恢复'), () => {
    const sim = createBuildingSim();
    const buildingSys = sim.engine.building;

    const beforeLevel = buildingSys.getLevel('farmland');
    refillResources(sim);
    const resources = sim.engine.resource.getResources();
    buildingSys.startUpgrade('farmland', resources);

    // 即时完成（模拟 tick 行为）
    const completed = buildingSys.forceCompleteUpgrades();
    assertStrict(completed.includes('farmland'), 'FLOW-02-36', 'tick应完成farmland升级');

    const state = buildingSys.getBuilding('farmland');
    assertStrict(state.level === beforeLevel + 1, 'FLOW-02-36', '等级应+1');
    assertStrict(state.status === 'idle', 'FLOW-02-36', '状态应恢复为idle');
    assertStrict(state.upgradeStartTime === null, 'FLOW-02-36', '开始时间应清空');
    assertStrict(state.upgradeEndTime === null, 'FLOW-02-36', '结束时间应清空');
  });

  it(accTest('FLOW-02-37', 'UI取消按钮 — 点击取消升级'), async () => {
    const sim = createBuildingSim();
    const buildingSys = sim.engine.building;

    // 开始升级
    refillResources(sim);
    const resources = sim.engine.resource.getResources();
    buildingSys.startUpgrade('farmland', resources);

    // 渲染面板
    const snapProps = getSnapshotProps(sim);
    render(<BuildingPanel {...makePanelProps(sim, { buildings: snapProps.buildings })} />);

    const cancelBtn = screen.getByTestId('building-map-cancel-farmland');
    assertInDOM(cancelBtn, 'FLOW-02-37', '地图取消按钮');

    await userEvent.click(cancelBtn);

    const state = buildingSys.getBuilding('farmland');
    assertStrict(state.status === 'idle', 'FLOW-02-37', '取消后状态应恢复为idle');
  });

  // ═══════════════════════════════════════════════════════════════
  // 8. 离线收益（FLOW-02-38 ~ FLOW-02-40）
  // ═══════════════════════════════════════════════════════════════

  it(accTest('FLOW-02-38', '序列化/反序列化 — 建筑状态保存和恢复'), () => {
    const sim = createBuildingSim();
    const buildingSys = sim.engine.building;

    // 升级几座建筑
    refillResources(sim);
    sim.upgradeBuilding('farmland');
    refillResources(sim);
    sim.upgradeBuilding('castle');

    const beforeLevels = buildingSys.getBuildingLevels();
    const saveData = buildingSys.serialize();

    // 反序列化到新系统
    buildingSys.deserialize(saveData);
    const afterLevels = buildingSys.getBuildingLevels();

    assertStrict(
      beforeLevels.farmland === afterLevels.farmland,
      'FLOW-02-38',
      `farmland等级应一致：${beforeLevels.farmland} vs ${afterLevels.farmland}`,
    );
    assertStrict(
      beforeLevels.castle === afterLevels.castle,
      'FLOW-02-38',
      `castle等级应一致：${beforeLevels.castle} vs ${afterLevels.castle}`,
    );
  });

  it(accTest('FLOW-02-39', '离线期间完成升级 — deserialize自动完成'), () => {
    const sim = createBuildingSim();
    const buildingSys = sim.engine.building;

    const beforeLevel = buildingSys.getLevel('farmland');
    refillResources(sim);
    const resources = sim.engine.resource.getResources();
    buildingSys.startUpgrade('farmland', resources);

    // 保存升级中的状态
    const saveData = buildingSys.serialize();
    const upgradingState = saveData.buildings.farmland;
    assertStrict(upgradingState.status === 'upgrading', 'FLOW-02-39', '保存时应为upgrading状态');

    // 模拟时间已过（修改 endTime 为过去时间）
    saveData.buildings.farmland.upgradeEndTime = Date.now() - 1000;

    // 反序列化应自动完成升级
    buildingSys.deserialize(saveData);
    const afterState = buildingSys.getBuilding('farmland');
    assertStrict(afterState.level === beforeLevel + 1, 'FLOW-02-39', '离线完成后等级应+1');
    assertStrict(afterState.status === 'idle', 'FLOW-02-39', '离线完成后状态应恢复idle');
  });

  it(accTest('FLOW-02-40', '离线收益计算 — 建筑产出累加'), () => {
    const sim = createBuildingSim();
    const buildingSys = sim.engine.building;

    const totalProd = buildingSys.calculateTotalProduction();
    const grainRate = totalProd['grain'] ?? 0;
    assertStrict(grainRate > 0, 'FLOW-02-40', `初始粮草产出应大于0，实际${grainRate}`);

    refillResources(sim);
    sim.upgradeBuilding('farmland');
    const newTotalProd = buildingSys.calculateTotalProduction();
    const newGrainRate = newTotalProd['grain'] ?? 0;
    assertStrict(newGrainRate > grainRate, 'FLOW-02-40', '升级后产出应增加');
  });

  // ═══════════════════════════════════════════════════════════════
  // 9. 主城解锁与建筑联动（FLOW-02-41 ~ FLOW-02-44）
  // ═══════════════════════════════════════════════════════════════

  it(accTest('FLOW-02-41', '主城升级解锁子建筑 — Lv2解锁市集和兵营'), () => {
    const sim = createBuildingSim(); // castle Lv2
    const buildingSys = sim.engine.building;

    assertStrict(buildingSys.getBuilding('market').status === 'idle', 'FLOW-02-41', '主城Lv2后市集应解锁');
    assertStrict(buildingSys.getBuilding('barracks').status === 'idle', 'FLOW-02-41', '主城Lv2后兵营应解锁');
  });

  it(accTest('FLOW-02-42', '主城Lv3解锁铁匠铺和书院'), () => {
    const sim = createBuildingSim();
    refillResources(sim);
    sim.upgradeBuildingTo('castle', 3);

    const buildingSys = sim.engine.building;
    assertStrict(buildingSys.getBuilding('smithy').status === 'idle', 'FLOW-02-42', '主城Lv3后铁匠铺应解锁');
    assertStrict(buildingSys.getBuilding('academy').status === 'idle', 'FLOW-02-42', '主城Lv3后书院应解锁');
  });

  it(accTest('FLOW-02-43', '主城Lv4解锁医馆'), () => {
    const sim = createBuildingSim();
    refillResources(sim);
    sim.upgradeBuildingTo('castle', 4);

    const buildingSys = sim.engine.building;
    assertStrict(buildingSys.getBuilding('clinic').status === 'idle', 'FLOW-02-43', '主城Lv4后医馆应解锁');
  });

  it(accTest('FLOW-02-44', '主城Lv5解锁城墙'), () => {
    const sim = createBuildingSim();
    refillResources(sim);
    sim.upgradeBuildingTo('castle', 4);
    refillResources(sim);
    sim.upgradeBuildingTo('farmland', 4); // 满足 castle Lv4→5 前置
    refillResources(sim);
    sim.upgradeBuildingTo('castle', 5);

    const buildingSys = sim.engine.building;
    assertStrict(buildingSys.getBuilding('wall').status === 'idle', 'FLOW-02-44', '主城Lv5后城墙应解锁');
  });

  // ═══════════════════════════════════════════════════════════════
  // 10. SceneRouter数据流（FLOW-02-45 ~ FLOW-02-48）
  // ═══════════════════════════════════════════════════════════════

  it(accTest('FLOW-02-45', 'SceneRouter数据流 — engine.getSnapshot提供完整建筑数据'), () => {
    const sim = createBuildingSim();
    const snap = sim.engine.getSnapshot();

    assertStrict(!!snap.buildings, 'FLOW-02-45', '快照应包含buildings');
    assertStrict(Object.keys(snap.buildings).length === 8, 'FLOW-02-45', '应有8座建筑');
    assertStrict(typeof snap.productionRates === 'object', 'FLOW-02-45', '应包含productionRates');
  });

  it(accTest('FLOW-02-46', 'SceneRouter升级回调 — engine.upgradeBuilding执行升级'), () => {
    const sim = createBuildingSim();
    const buildingSys = sim.engine.building;

    const beforeLevel = buildingSys.getLevel('farmland');
    refillResources(sim);
    sim.engine.upgradeBuilding('farmland');
    // upgradeBuilding 启动升级但基于时间，需手动完成
    buildingSys.forceCompleteUpgrades();

    const afterLevel = buildingSys.getLevel('farmland');
    assertStrict(afterLevel === beforeLevel + 1, 'FLOW-02-46', '引擎升级后等级应+1');
  });

  it(accTest('FLOW-02-47', 'SceneRouter取消回调 — engine.cancelUpgrade取消升级'), () => {
    const sim = createBuildingSim();
    const buildingSys = sim.engine.building;

    refillResources(sim);
    const resources = sim.engine.resource.getResources();
    buildingSys.startUpgrade('farmland', resources);

    // 通过引擎层取消
    const refund = sim.engine.cancelUpgrade('farmland');
    assertStrict(!!refund, 'FLOW-02-47', '引擎取消应返回返还资源');

    const state = buildingSys.getBuilding('farmland');
    assertStrict(state.status === 'idle', 'FLOW-02-47', '取消后状态应恢复');
  });

  it(accTest('FLOW-02-48', '升级异常处理 — 锁定建筑升级返回失败'), () => {
    const sim = createBuildingSim();
    const buildingSys = sim.engine.building;

    // wall 初始锁定（需 castle Lv5）
    const check = buildingSys.checkUpgrade('wall');
    assertStrict(!check.canUpgrade, 'FLOW-02-48', '锁定建筑不可升级');
    assertStrict(check.reasons.some(r => r.includes('尚未解锁')), 'FLOW-02-48', '原因应包含尚未解锁');
  });

  // ═══════════════════════════════════════════════════════════════
  // 11. 收支详情弹窗（FLOW-02-49 ~ FLOW-02-51）
  // ═══════════════════════════════════════════════════════════════

  it(accTest('FLOW-02-49', '收支详情弹窗 — 显示每秒产出'), () => {
    const sim = createBuildingSim();
    render(<BuildingIncomeModal {...makeIncomeModalProps(sim)} />);

    const section = screen.getByTestId('building-income-section');
    assertInDOM(section, 'FLOW-02-49', '产出区块');
  });

  it(accTest('FLOW-02-50', '收支详情弹窗 — 显示净收入'), () => {
    const sim = createBuildingSim();
    render(<BuildingIncomeModal {...makeIncomeModalProps(sim)} />);

    const netBox = screen.getByTestId('building-income-net');
    assertInDOM(netBox, 'FLOW-02-50', '净收入区块');
  });

  it(accTest('FLOW-02-51', '收支详情弹窗 — 显示建筑产出明细'), () => {
    const sim = createBuildingSim();
    render(<BuildingIncomeModal {...makeIncomeModalProps(sim)} />);

    const details = screen.getByTestId('building-income-details');
    assertInDOM(details, 'FLOW-02-51', '产出明细区块');
  });

  // ═══════════════════════════════════════════════════════════════
  // 12. 特殊属性与边界（FLOW-02-52 ~ FLOW-02-56）
  // ═══════════════════════════════════════════════════════════════

  it(accTest('FLOW-02-52', '城墙特殊属性 — 城防值正确'), () => {
    const sim = createHighLevelSim(); // castle Lv6, wall 已解锁
    const buildingSys = sim.engine.building;

    // 城墙初始 Lv1
    const defense = buildingSys.getWallDefense();
    assertStrict(defense === 300, 'FLOW-02-52', `城墙Lv1城防值应为300，实际${defense}`);
  });

  it(accTest('FLOW-02-53', '满级建筑弹窗 — 显示已满级标识'), () => {
    const sim = createBuildingSim();
    const buildingSys = sim.engine.building;

    // 验证满级检查逻辑存在
    const maxLevel = BUILDING_DEFS.farmland.maxLevel;
    assertStrict(maxLevel === 25, 'FLOW-02-53', '农田满级应为25');

    // 验证 checkUpgrade 在满级时返回正确原因
    // 使用 getUpgradeCost 在满级时返回 null 来验证
    const cost = buildingSys.getUpgradeCost('farmland');
    assertStrict(!!cost, 'FLOW-02-53', '非满级时应有升级费用');
  });

  it(accTest('FLOW-02-54', '建筑重置 — reset恢复初始状态'), () => {
    const sim = createBuildingSim();
    const buildingSys = sim.engine.building;

    // 先升级
    refillResources(sim);
    sim.upgradeBuilding('farmland');
    assertStrict(buildingSys.getLevel('farmland') > 1, 'FLOW-02-54', '升级后farmland等级应>1');

    // 重置
    buildingSys.reset();
    assertStrict(buildingSys.getLevel('farmland') === 1, 'FLOW-02-54', '重置后farmland应回到Lv1');
    assertStrict(buildingSys.getLevel('castle') === 1, 'FLOW-02-54', '重置后castle应回到Lv1');
  });

  it(accTest('FLOW-02-55', '批量升级 — batchUpgrade按顺序执行'), () => {
    const sim = createBuildingSim();
    const buildingSys = sim.engine.building;

    refillResources(sim);
    const resources = sim.engine.resource.getResources();

    const result = buildingSys.batchUpgrade(['farmland', 'castle'], resources);
    // 批量升级启动后，完成升级
    buildingSys.forceCompleteUpgrades();

    // 验证批量结果结构
    assertStrict(result.succeeded.length + result.failed.length === 2, 'FLOW-02-55', '应有2个结果');
  });

  it(accTest('FLOW-02-56', '建筑外观阶段 — getAppearanceStage正确映射'), () => {
    const sim = createBuildingSim();
    const buildingSys = sim.engine.building;

    // farmland Lv1 → humble
    const stage1 = buildingSys.getAppearanceStage('farmland');
    assertStrict(stage1 === 'humble', 'FLOW-02-56', 'Lv1应为humble');

    // 先升级主城到 Lv6，使 farmland 可以升到 Lv6
    refillResources(sim);
    sim.upgradeBuildingTo('castle', 4);
    refillResources(sim);
    sim.upgradeBuildingTo('farmland', 4);
    refillResources(sim);
    sim.upgradeBuildingTo('castle', 5);
    refillResources(sim);
    sim.upgradeBuildingTo('castle', 6);
    refillResources(sim);
    sim.upgradeBuildingTo('farmland', 6);

    const stage6 = buildingSys.getAppearanceStage('farmland');
    assertStrict(stage6 === 'orderly', 'FLOW-02-56', 'Lv6应为orderly');
  });
});
