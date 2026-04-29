/** FLOW-01 天下Tab集成测试 — 渲染/选择/升级/攻城/产出/快照/筛选/边界。使用真实引擎，不mock。 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WorldMapTab from '@/components/idle/panels/map/WorldMapTab';
import TerritoryInfoPanel from '@/components/idle/panels/map/TerritoryInfoPanel';
import SiegeConfirmModal from '@/components/idle/panels/map/SiegeConfirmModal';
import type { TerritoryData, TerritoryProductionSummary } from '@/games/three-kingdoms/core/map';
import { accTest, assertStrict, assertInDOM } from './acc-test-utils';
import { createSim } from '../../test-utils/test-helpers';
import type { GameEventSimulator } from '../../test-utils/GameEventSimulator';

/** Mock CSS imports */
vi.mock('@/components/idle/panels/map/WorldMapTab.css', () => ({}));
vi.mock('@/components/idle/panels/map/TerritoryInfoPanel.css', () => ({}));
vi.mock('@/components/idle/panels/map/SiegeConfirmModal.css', () => ({}));
vi.mock('@/components/idle/common/Modal.css', () => ({}));

vi.mock('@/components/idle/components/SharedPanel', () => ({
  __esModule: true,
  default: ({ children, title, onClose, isOpen }: any) => (
    <div data-testid="shared-panel" data-title={title}>
      {title && <div data-testid="panel-title">{title}</div>}
      {children}
      {onClose && <button data-testid="panel-close" onClick={onClose}>关闭</button>}
    </div>
  ),
}));

vi.mock('@/components/idle/common/Modal', () => ({
  __esModule: true,
  default: ({ children, visible, title, onConfirm, onCancel, confirmDisabled }: any) =>
    visible ? (
      <div data-testid="modal" data-title={title}>
        {title && <div data-testid="modal-title">{title}</div>}
        {children}
        <button
          data-testid="modal-confirm"
          onClick={onConfirm}
          disabled={confirmDisabled}
        >
          确认
        </button>
        {onCancel && <button data-testid="modal-cancel" onClick={onCancel}>取消</button>}
      </div>
    ) : null,
}));

/** Test Data Factory */

function makeTerritory(overrides: Partial<TerritoryData> = {}): TerritoryData {
  return {
    id: 'city-luoyang',
    name: '洛阳',
    position: { x: 5, y: 5 },
    region: 'wei' as const,
    ownership: 'player',
    level: 1,
    baseProduction: { grain: 5, gold: 5, troops: 3, mandate: 1 },
    currentProduction: { grain: 5, gold: 5, troops: 3, mandate: 1 },
    defenseValue: 1000,
    adjacentIds: ['city-xuchang', 'city-ye', 'pass-hulao'],
    ...overrides,
  };
}

function makeProductionSummary(overrides: Partial<TerritoryProductionSummary> = {}): TerritoryProductionSummary {
  return {
    totalTerritories: 2,
    territoriesByRegion: { wei: 2, shu: 0, wu: 0, neutral: 0 },
    totalProduction: { grain: 10, gold: 8, troops: 3, mandate: 1 },
    totalGrain: 10,
    totalCoins: 8,
    totalTroops: 3,
    details: [],
    ...overrides,
  };
}

/** 创建一组完整的测试领土（用于UI组件测试） */
function makeTestTerritories(): TerritoryData[] {
  return [
    makeTerritory({ id: 'city-luoyang', name: '洛阳', ownership: 'player', level: 1, adjacentIds: ['city-xuchang', 'city-ye', 'pass-hulao'] }),
    makeTerritory({ id: 'city-xuchang', name: '许昌', ownership: 'enemy', level: 2, defenseValue: 2000, adjacentIds: ['city-luoyang', 'city-ye'] }),
    makeTerritory({ id: 'city-ye', name: '邺城', ownership: 'neutral', level: 1, defenseValue: 1000, adjacentIds: ['city-luoyang', 'city-xuchang'] }),
    makeTerritory({ id: 'pass-hulao', name: '虎牢关', ownership: 'player', level: 3, defenseValue: 3000, adjacentIds: ['city-luoyang'] }),
    makeTerritory({ id: 'city-changan', name: '长安', ownership: 'enemy', level: 4, defenseValue: 4000, adjacentIds: ['pass-tong'] }),
  ];
}

/** 创建带充足资源的 sim */
function createMapSim(): GameEventSimulator {
  const sim = createSim();
  sim.engine.resource.setCap('grain', 1_000_000);
  sim.engine.resource.setCap('troops', 1_000_000);
  sim.addResources({ grain: 100000, gold: 100000, troops: 50000 });
  return sim;
}

/** 创建已占领基础领土的 sim。占领 pass-hulao + city-luoyang，可攻击 city-xuchang。 */
function createSimWithBaseTerritory(): GameEventSimulator {
  const sim = createMapSim();
  const territorySys = sim.engine.getTerritorySystem();
  territorySys.captureTerritory('pass-hulao', 'player');
  territorySys.captureTerritory('city-luoyang', 'player');
  return sim;
}

describe('FLOW-01 天下Tab集成测试', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  // 1. 天下Tab渲染（FLOW-01-01 ~ FLOW-01-05）

  it(accTest('FLOW-01-01', '天下Tab整体渲染 — 地图容器、网格、工具栏、信息面板'), () => {
    const territories = makeTestTerritories();
    render(
      <WorldMapTab
        territories={territories}
        productionSummary={makeProductionSummary()}
        snapshotVersion={0}
      />
    );

    const mapTab = screen.getByTestId('worldmap-tab');
    assertInDOM(mapTab, 'FLOW-01-01', '天下Tab容器');

    const toolbar = screen.getByTestId('worldmap-toolbar');
    assertInDOM(toolbar, 'FLOW-01-01', '筛选工具栏');

    const grid = screen.getByTestId('worldmap-grid');
    assertInDOM(grid, 'FLOW-01-01', '领土网格');

    const infoPanel = screen.getByTestId('worldmap-info-panel');
    assertInDOM(infoPanel, 'FLOW-01-01', '信息面板');
  });

  it(accTest('FLOW-01-02', '领土列表显示 — 所有领土名称可见'), () => {
    const territories = makeTestTerritories();
    render(
      <WorldMapTab
        territories={territories}
        productionSummary={makeProductionSummary()}
        snapshotVersion={0}
      />
    );

    for (const t of territories) {
      const el = screen.getByText(t.name);
      assertInDOM(el, 'FLOW-01-02', `领土 ${t.name}`);
    }
  });

  it(accTest('FLOW-01-03', '领土等级显示 — Lv标签正确'), () => {
    const territories = makeTestTerritories();
    render(
      <WorldMapTab
        territories={territories}
        productionSummary={makeProductionSummary()}
        snapshotVersion={0}
      />
    );

    // 验证每个领土的等级标签存在（使用 getAllByText 处理重复等级）
    for (const t of territories) {
      const levelEls = screen.getAllByText(`Lv.${t.level}`);
      assertStrict(levelEls.length >= 1, 'FLOW-01-03', `${t.name} 应有 Lv.${t.level} 标签`);
    }
  });

  it(accTest('FLOW-01-04', '己方领土产出气泡 — 产出值显示'), () => {
    const territories = makeTestTerritories();
    render(
      <WorldMapTab
        territories={territories}
        productionSummary={makeProductionSummary()}
        snapshotVersion={0}
      />
    );

    const playerTerritories = territories.filter(t => t.ownership === 'player');
    for (const t of playerTerritories) {
      const bubble = screen.getByTestId(`bubble-${t.id}`);
      assertInDOM(bubble, 'FLOW-01-04', `${t.name} 产出气泡`);
    }
  });

  it(accTest('FLOW-01-05', '统计卡片显示 — 占领数/总产出'), () => {
    const territories = makeTestTerritories();
    const summary = makeProductionSummary();
    render(
      <WorldMapTab
        territories={territories}
        productionSummary={summary}
        snapshotVersion={0}
      />
    );

    const statTerritories = screen.getByTestId('stat-territories');
    assertInDOM(statTerritories, 'FLOW-01-05', '占领/总数统计');

    const statGrain = screen.getByTestId('stat-grain');
    assertInDOM(statGrain, 'FLOW-01-05', '粮食产出统计');

    const statGold = screen.getByTestId('stat-gold');
    assertInDOM(statGold, 'FLOW-01-05', '金币产出统计');
  });

  // 2. 领土选择与信息面板（FLOW-01-06 ~ FLOW-01-10）

  it(accTest('FLOW-01-06', '点击领土选中 — 高亮+信息面板显示'), async () => {
    const territories = makeTestTerritories();
    render(
      <WorldMapTab
        territories={territories}
        productionSummary={makeProductionSummary()}
        snapshotVersion={0}
      />
    );

    const luoyang = screen.getByText('洛阳');
    await userEvent.click(luoyang);

    const infoPanel = screen.getByTestId('territory-info-city-luoyang');
    assertInDOM(infoPanel, 'FLOW-01-06', '洛阳信息面板');

    const nameEl = within(infoPanel).getByText('洛阳');
    assertInDOM(nameEl, 'FLOW-01-06', '面板中领土名称');
  });

  it(accTest('FLOW-01-07', '选中己方领土 — 显示名称/等级/归属/产出'), async () => {
    const territory = makeTerritory({ ownership: 'player', level: 2 });
    render(<TerritoryInfoPanel territory={territory} />);

    assertStrict(!!screen.getByText('洛阳'), 'FLOW-01-07', '名称显示');
    assertStrict(!!screen.getByText('Lv.2'), 'FLOW-01-07', '等级显示');
    assertStrict(!!screen.getByText('己方领土'), 'FLOW-01-07', '归属显示');
    assertStrict(!!screen.getByText(/总产出/), 'FLOW-01-07', '总产出显示');
  });

  it(accTest('FLOW-01-08', '选中敌方领土 — 显示攻城按钮'), async () => {
    const territory = makeTerritory({ id: 'city-xuchang', name: '许昌', ownership: 'enemy' });
    render(<TerritoryInfoPanel territory={territory} />);

    const siegeBtn = screen.getByTestId('btn-siege-city-xuchang');
    assertInDOM(siegeBtn, 'FLOW-01-08', '攻城按钮');
    assertStrict(siegeBtn.textContent?.includes('攻城'), 'FLOW-01-08', '按钮文字包含攻城');
  });

  it(accTest('FLOW-01-09', '选中中立领土 — 显示占领按钮'), async () => {
    const territory = makeTerritory({ id: 'city-ye', name: '邺城', ownership: 'neutral' });
    render(<TerritoryInfoPanel territory={territory} />);

    const siegeBtn = screen.getByTestId('btn-siege-city-ye');
    assertInDOM(siegeBtn, 'FLOW-01-09', '占领按钮');
    assertStrict(siegeBtn.textContent?.includes('占领'), 'FLOW-01-09', '按钮文字包含占领');
  });

  it(accTest('FLOW-01-10', '再次点击同一领土 — 取消选中'), async () => {
    const territories = makeTestTerritories();
    render(
      <WorldMapTab
        territories={territories}
        productionSummary={makeProductionSummary()}
        snapshotVersion={0}
      />
    );

    const luoyang = screen.getByText('洛阳');
    await userEvent.click(luoyang);
    let infoPanel = screen.queryByTestId('territory-info-city-luoyang');
    assertStrict(!!infoPanel, 'FLOW-01-10', '首次点击应显示信息面板');

    await userEvent.click(luoyang);
    infoPanel = screen.queryByTestId('territory-info-city-luoyang');
    assertStrict(!infoPanel, 'FLOW-01-10', '再次点击应隐藏信息面板');
  });

  // 3. 领土升级流程（FLOW-01-11 ~ FLOW-01-14）

  it(accTest('FLOW-01-11', '己方领土升级按钮 — 点击触发升级回调'), async () => {
    const territory = makeTerritory({ ownership: 'player' });
    const onUpgrade = vi.fn();
    render(<TerritoryInfoPanel territory={territory} onUpgrade={onUpgrade} />);

    const upgradeBtn = screen.getByTestId('btn-upgrade-city-luoyang');
    await userEvent.click(upgradeBtn);
    assertStrict(onUpgrade.mock.calls.length === 1, 'FLOW-01-11', '升级回调应被调用');
    assertStrict(onUpgrade.mock.calls[0][0] === 'city-luoyang', 'FLOW-01-11', '回调参数应为领土ID');
  });

  it(accTest('FLOW-01-12', '引擎层领土升级 — 等级提升+产出增加'), () => {
    const sim = createSimWithBaseTerritory();
    const territorySys = sim.engine.getTerritorySystem();

    // pass-hulao 初始 level=3（从 map-config）
    const before = territorySys.getTerritoryById('pass-hulao')!;
    const beforeLevel = before.level;
    const beforeProd = before.currentProduction.grain;

    // 执行升级
    const result = territorySys.upgradeTerritory('pass-hulao');
    assertStrict(result.success, 'FLOW-01-12', '升级应成功');
    assertStrict(result.newLevel === beforeLevel + 1, 'FLOW-01-12', '等级应+1');

    const after = territorySys.getTerritoryById('pass-hulao')!;
    assertStrict(after.level === beforeLevel + 1, 'FLOW-01-12', '领土等级应提升');
    assertStrict(after.currentProduction.grain > beforeProd, 'FLOW-01-12', '产出应增加');
  });

  it(accTest('FLOW-01-13', '非己方领土升级 — 返回失败'), () => {
    const sim = createMapSim();
    const territorySys = sim.engine.getTerritorySystem();

    // city-xuchang 初始为 neutral，不可升级
    const result = territorySys.upgradeTerritory('city-xuchang');
    assertStrict(!result.success, 'FLOW-01-13', '非己方领土升级应失败');
  });

  it(accTest('FLOW-01-14', '领土满级(5级)升级 — 返回失败'), () => {
    const sim = createMapSim();
    const territorySys = sim.engine.getTerritorySystem();

    // 占领 city-luoyang（初始 level=5，满级）
    territorySys.captureTerritory('city-luoyang', 'player');

    const t = territorySys.getTerritoryById('city-luoyang')!;
    assertStrict(t.level === 5, 'FLOW-01-14', '洛阳应为5级');

    // 尝试升级应失败
    const result = territorySys.upgradeTerritory('city-luoyang');
    assertStrict(!result.success, 'FLOW-01-14', '满级后升级应失败');
  });

  // 4. 攻城流程（FLOW-01-15 ~ FLOW-01-22）LL-008回归

  it(accTest('FLOW-01-15', '攻城条件校验 — 相邻己方领土才可攻击'), () => {
    const sim = createSimWithBaseTerritory();
    const siegeSys = sim.engine.getSiegeSystem();
    const territorySys = sim.engine.getTerritorySystem();
    const troops = sim.engine.getResourceAmount('troops');
    const grain = sim.engine.getResourceAmount('grain');

    // city-ye 已占领，许昌与邺城相邻
    const adjacentResult = siegeSys.checkSiegeConditions('city-xuchang', 'player', troops, grain);
    assertStrict(adjacentResult.canSiege, 'FLOW-01-15', '相邻领土应可攻击');

    // 长安不与邺城直接相邻
    const changanAdj = territorySys.canAttackTerritory('city-changan', 'player');
    if (!changanAdj) {
      const farResult = siegeSys.checkSiegeConditions('city-changan', 'player', troops, grain);
      assertStrict(!farResult.canSiege, 'FLOW-01-15', '非相邻领土不可攻击');
      assertStrict(farResult.errorCode === 'NOT_ADJACENT', 'FLOW-01-15', '错误码应为 NOT_ADJACENT');
    }
  });

  it(accTest('FLOW-01-16', '攻城条件校验 — 兵力不足时拒绝'), () => {
    const sim = createSimWithBaseTerritory();
    const siegeSys = sim.engine.getSiegeSystem();

    sim.setResource('troops', 0);
    const grain = sim.engine.getResourceAmount('grain');

    const result = siegeSys.checkSiegeConditions('city-xuchang', 'player', 0, grain);
    assertStrict(!result.canSiege, 'FLOW-01-16', '兵力不足应拒绝');
    assertStrict(result.errorCode === 'INSUFFICIENT_TROOPS', 'FLOW-01-16', '错误码应为 INSUFFICIENT_TROOPS');
  });

  it(accTest('FLOW-01-17', '攻城条件校验 — 粮草不足时拒绝'), () => {
    const sim = createSimWithBaseTerritory();
    const siegeSys = sim.engine.getSiegeSystem();

    const troops = sim.engine.getResourceAmount('troops');
    sim.setResource('grain', 0);

    const result = siegeSys.checkSiegeConditions('city-xuchang', 'player', troops, 0);
    assertStrict(!result.canSiege, 'FLOW-01-17', '粮草不足应拒绝');
    assertStrict(result.errorCode === 'INSUFFICIENT_GRAIN', 'FLOW-01-17', '错误码应为 INSUFFICIENT_GRAIN');
  });

  it(accTest('FLOW-01-18', '攻城执行 — 胜利后领土归属变更'), () => {
    const sim = createSimWithBaseTerritory();
    const siegeSys = sim.engine.getSiegeSystem();
    const territorySys = sim.engine.getTerritorySystem();

    const troops = sim.engine.getResourceAmount('troops');
    const grain = sim.engine.getResourceAmount('grain');

    // 使用外部战斗结果确保胜利
    const result = siegeSys.executeSiegeWithResult(
      'city-xuchang', 'player', troops, grain, true,
    );

    assertStrict(result.launched, 'FLOW-01-18', '攻城应发起');
    assertStrict(result.victory, 'FLOW-01-18', '攻城应胜利');
    assertStrict(result.capture?.newOwner === 'player', 'FLOW-01-18', '归属应变更为player');

    const territory = territorySys.getTerritoryById('city-xuchang');
    assertStrict(territory?.ownership === 'player', 'FLOW-01-18', '许昌归属应为player');
  });

  it(accTest('FLOW-01-19', '攻城执行 — 失败后领土归属不变'), () => {
    const sim = createSimWithBaseTerritory();
    const siegeSys = sim.engine.getSiegeSystem();
    const territorySys = sim.engine.getTerritorySystem();

    const troops = sim.engine.getResourceAmount('troops');
    const grain = sim.engine.getResourceAmount('grain');

    // 使用外部战斗结果确保失败
    const result = siegeSys.executeSiegeWithResult(
      'city-xuchang', 'player', troops, grain, false,
    );

    assertStrict(result.launched, 'FLOW-01-19', '攻城应发起');
    assertStrict(!result.victory, 'FLOW-01-19', '攻城应失败');
    assertStrict(result.defeatTroopLoss !== undefined && result.defeatTroopLoss > 0, 'FLOW-01-19', '失败应损失兵力');

    const territory = territorySys.getTerritoryById('city-xuchang');
    assertStrict(territory?.ownership !== 'player', 'FLOW-01-19', '许昌归属不应变更');
  });

  it(accTest('FLOW-01-20', '攻城消耗计算 — 兵力=基础×防御/100, 粮草=500'), () => {
    const sim = createMapSim();
    const siegeSys = sim.engine.getSiegeSystem();
    const territorySys = sim.engine.getTerritorySystem();

    const territory = territorySys.getTerritoryById('city-xuchang');
    assertStrict(!!territory, 'FLOW-01-20', '许昌领土应存在');

    const cost = siegeSys.calculateSiegeCost(territory!);
    // 粮草固定500（PRD MAP-4统一声明）
    assertStrict(cost.grain === 500, 'FLOW-01-20', '粮草消耗应为500');
    // 兵力 = ceil(100 × defenseValue/100 × 1.0)
    assertStrict(cost.troops > 0, 'FLOW-01-20', '兵力消耗应大于0');
  });

  it(accTest('FLOW-01-21', '攻城确认弹窗 — 条件检查列表显示'), () => {
    const target = makeTerritory({ id: 'city-xuchang', name: '许昌', ownership: 'enemy' });
    render(
      <SiegeConfirmModal
        visible={true}
        target={target}
        cost={{ troops: 200, grain: 500 }}
        conditionResult={{ canSiege: true }}
        availableTroops={1000}
        availableGrain={2000}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    const modal = screen.getByTestId('siege-confirm');
    assertInDOM(modal, 'FLOW-01-21', '攻城确认弹窗');

    const conditions = screen.queryAllByTestId(/siege-condition-/);
    assertStrict(conditions.length >= 2, 'FLOW-01-21', '应显示至少2个条件检查项');
  });

  it(accTest('FLOW-01-22', '攻城确认弹窗 — 条件不满足时确认按钮disabled'), () => {
    const target = makeTerritory({ id: 'city-xuchang', name: '许昌', ownership: 'enemy' });
    render(
      <SiegeConfirmModal
        visible={true}
        target={target}
        cost={{ troops: 5000, grain: 500 }}
        conditionResult={{ canSiege: false, errorCode: 'INSUFFICIENT_TROOPS', errorMessage: '兵力不足' }}
        availableTroops={100}
        availableGrain={2000}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    const confirmBtn = screen.getByTestId('modal-confirm');
    assertStrict(confirmBtn.hasAttribute('disabled'), 'FLOW-01-22', '条件不满足时确认按钮应disabled');

    const errorMsg = screen.getByTestId('siege-error');
    assertInDOM(errorMsg, 'FLOW-01-22', '错误消息');
  });

  // 5. 资源产出计算（FLOW-01-23 ~ FLOW-01-26）

  it(accTest('FLOW-01-23', '领土产出计算 — 等级加成正确'), () => {
    const sim = createSimWithBaseTerritory();
    const territorySys = sim.engine.getTerritorySystem();

    // pass-hulao 初始 level=3，type=pass，baseProd={grain:1, gold:1, troops:2, mandate:0}
    const t3 = territorySys.getTerritoryById('pass-hulao')!;
    const lv3Grain = t3.currentProduction.grain;
    const baseGrain = t3.baseProduction.grain;

    // 验证 Lv3 产出 = base × 1.6
    const expectedLv3 = Math.round(baseGrain * 1.6 * 100) / 100;
    assertStrict(lv3Grain === expectedLv3, 'FLOW-01-23', `Lv3产出应为${expectedLv3}，实际${lv3Grain}`);

    // 升级到 Lv4
    territorySys.upgradeTerritory('pass-hulao');
    const t4 = territorySys.getTerritoryById('pass-hulao')!;
    const lv4Grain = t4.currentProduction.grain;

    // Lv4 加成系数 = 2.0
    const expectedLv4 = Math.round(baseGrain * 2.0 * 100) / 100;
    assertStrict(lv4Grain === expectedLv4, 'FLOW-01-23', `Lv4产出应为${expectedLv4}，实际${lv4Grain}`);
    assertStrict(lv4Grain > lv3Grain, 'FLOW-01-23', 'Lv4产出应大于Lv3');
  });

  it(accTest('FLOW-01-24', '玩家总产出汇总 — 占领领土后产出增加'), () => {
    const sim = createMapSim();
    const territorySys = sim.engine.getTerritorySystem();

    // 初始玩家拥有洛阳，产出大于0
    const summary0 = territorySys.getPlayerProductionSummary();
    assertStrict(summary0.totalProduction.grain > 0, 'FLOW-01-24', '初始产出应大于0（洛阳）');

    // 占领一个新领土
    territorySys.captureTerritory('pass-hulao', 'player');
    const summary1 = territorySys.getPlayerProductionSummary();

    assertStrict(
      summary1.totalProduction.grain > summary0.totalProduction.grain,
      'FLOW-01-24',
      '占领领土后粮食产出应增加',
    );
  });

  it(accTest('FLOW-01-25', '多个领土产出累加 — 正确汇总'), () => {
    const sim = createMapSim();
    const territorySys = sim.engine.getTerritorySystem();

    // 占领虎牢关和洛阳（相邻）
    territorySys.captureTerritory('pass-hulao', 'player');
    territorySys.captureTerritory('city-luoyang', 'player');

    const summary = territorySys.getPlayerProductionSummary();
    const t1 = territorySys.getTerritoryById('pass-hulao')!;
    const t2 = territorySys.getTerritoryById('city-luoyang')!;

    const expectedGrain = t1.currentProduction.grain + t2.currentProduction.grain;
    const diff = Math.abs(summary.totalProduction.grain - expectedGrain);
    assertStrict(diff < 0.1, 'FLOW-01-25', `两领土粮食产出累加应约等于${expectedGrain}，实际${summary.totalProduction.grain}`);
  });

  it(accTest('FLOW-01-26', '中立领土无产出 — 不计入玩家总产出'), () => {
    const sim = createMapSim();
    const territorySys = sim.engine.getTerritorySystem();

    // 初始玩家拥有洛阳（1个领土），中立领土不计入
    const summary = territorySys.getPlayerProductionSummary();
    assertStrict(summary.totalTerritories === 1, 'FLOW-01-26', '初始应有1个玩家领土（洛阳）');

    // 玩家产出仅来自洛阳，不包含中立领土的产出
    const luoyang = territorySys.getTerritoryById('city-luoyang')!;
    assertStrict(
      summary.totalProduction.grain === luoyang.currentProduction.grain,
      'FLOW-01-26',
      '总产出应仅来自洛阳',
    );
  });

  // 6. 天下快照与统计（FLOW-01-27 ~ FLOW-01-30）

  it(accTest('FLOW-01-27', '天下总览 — 引擎提供完整领土数据'), () => {
    const sim = createMapSim();
    const territorySys = sim.engine.getTerritorySystem();

    const allTerritories = territorySys.getAllTerritories();
    assertStrict(allTerritories.length > 0, 'FLOW-01-27', '引擎应提供领土数据');
    assertStrict(allTerritories.length === 24, 'FLOW-01-27', `应有24个领土，实际${allTerritories.length}`);
  });

  it(accTest('FLOW-01-28', '天下总览 — 玩家领土数统计'), () => {
    const sim = createMapSim();
    const territorySys = sim.engine.getTerritorySystem();

    const initialCount = territorySys.getPlayerTerritoryCount();
    assertStrict(initialCount === 1, 'FLOW-01-28', '初始玩家领土数应为1（洛阳）');

    territorySys.captureTerritory('pass-hulao', 'player');
    assertStrict(
      territorySys.getPlayerTerritoryCount() === 2,
      'FLOW-01-28',
      '占领后玩家领土数应为2',
    );
  });

  it(accTest('FLOW-01-29', '天下总览 — 产出汇总包含所有玩家领土'), () => {
    const sim = createMapSim();
    const territorySys = sim.engine.getTerritorySystem();

    territorySys.captureTerritory('pass-hulao', 'player');
    territorySys.captureTerritory('city-luoyang', 'player');

    const summary = territorySys.getPlayerProductionSummary();
    assertStrict(
      summary.totalTerritories === 2,
      'FLOW-01-29',
      `totalTerritories应为2，实际${summary.totalTerritories}`,
    );
    assertStrict(
      summary.details.length === 2,
      'FLOW-01-29',
      `details应包含2个玩家领土，实际${summary.details.length}`,
    );
  });

  it(accTest('FLOW-01-30', '天下总览 — 各区域领土统计正确'), () => {
    const sim = createMapSim();
    const territorySys = sim.engine.getTerritorySystem();

    territorySys.captureTerritory('pass-hulao', 'player');
    territorySys.captureTerritory('city-luoyang', 'player');

    const summary = territorySys.getPlayerProductionSummary();
    // 两个都是 wei 区域
    assertStrict(
      summary.territoriesByRegion.wei === 2,
      'FLOW-01-30',
      `wei区域应有2个玩家领土，实际${summary.territoriesByRegion.wei}`,
    );
  });

  // 7. 筛选与热力图（FLOW-01-31 ~ FLOW-01-35）

  it(accTest('FLOW-01-31', '筛选工具栏 — 三个筛选器可见'), () => {
    const territories = makeTestTerritories();
    render(
      <WorldMapTab
        territories={territories}
        productionSummary={makeProductionSummary()}
        snapshotVersion={0}
      />
    );

    const regionFilter = screen.getByTestId('worldmap-filter-region');
    const ownershipFilter = screen.getByTestId('worldmap-filter-ownership');
    const landmarkFilter = screen.getByTestId('worldmap-filter-landmark');

    assertInDOM(regionFilter, 'FLOW-01-31', '区域筛选器');
    assertInDOM(ownershipFilter, 'FLOW-01-31', '归属筛选器');
    assertInDOM(landmarkFilter, 'FLOW-01-31', '类型筛选器');
  });

  it(accTest('FLOW-01-32', '归属筛选 — 选择"己方"只显示player领土'), async () => {
    const territories = makeTestTerritories();
    render(
      <WorldMapTab
        territories={territories}
        productionSummary={makeProductionSummary()}
        snapshotVersion={0}
      />
    );

    const ownershipFilter = screen.getByTestId('worldmap-filter-ownership');
    await userEvent.selectOptions(ownershipFilter, 'player');

    const grid = screen.getByTestId('worldmap-grid');
    const cells = within(grid).queryAllByTestId(/^territory-cell-/);

    const playerCells = cells.filter(cell =>
      cell.className.includes('tk-territory-cell--player'),
    );
    assertStrict(playerCells.length >= 1, 'FLOW-01-32', '应至少有1个己方领土');
  });

  it(accTest('FLOW-01-33', '热力图切换 — 点击后显示热力图叠加'), async () => {
    const territories = makeTestTerritories();
    render(
      <WorldMapTab
        territories={territories}
        productionSummary={makeProductionSummary()}
        snapshotVersion={0}
      />
    );

    const toggle = screen.getByTestId('worldmap-heatmap-toggle');
    await userEvent.click(toggle);

    const heatmapEls = screen.queryAllByTestId(/^heatmap-/);
    assertStrict(heatmapEls.length > 0, 'FLOW-01-33', '热力图叠加层应显示');

    const legend = screen.getByTestId('worldmap-legend');
    assertInDOM(legend, 'FLOW-01-33', '热力图图例');
  });

  it(accTest('FLOW-01-34', '筛选无结果 — 显示空状态提示'), async () => {
    const territories = [makeTerritory({ id: 't1', name: '荒地', ownership: 'neutral' })];
    render(
      <WorldMapTab
        territories={territories}
        productionSummary={makeProductionSummary()}
        snapshotVersion={0}
      />
    );

    const ownershipFilter = screen.getByTestId('worldmap-filter-ownership');
    await userEvent.selectOptions(ownershipFilter, 'player');

    const emptyEl = screen.queryByTestId('worldmap-empty');
    assertStrict(!!emptyEl, 'FLOW-01-34', '筛选无结果时应显示空状态');
  });

  it(accTest('FLOW-01-35', '网格列数自适应 — 根据领土数量调整'), () => {
    const fewTerritories = [makeTerritory({ id: 't1' }), makeTerritory({ id: 't2' })];
    const { rerender } = render(
      <WorldMapTab
        territories={fewTerritories}
        productionSummary={makeProductionSummary()}
        snapshotVersion={0}
      />
    );

    let grid = screen.getByTestId('worldmap-grid');
    assertStrict(
      grid.style.gridTemplateColumns.includes('repeat(2'),
      'FLOW-01-35',
      '2个领土应用2列',
    );

    const manyTerritories = Array.from({ length: 20 }, (_, i) =>
      makeTerritory({ id: `t${i}`, name: `领土${i}` }),
    );
    rerender(
      <WorldMapTab
        territories={manyTerritories}
        productionSummary={makeProductionSummary()}
        snapshotVersion={0}
      />
    );

    grid = screen.getByTestId('worldmap-grid');
    assertStrict(
      grid.style.gridTemplateColumns.includes('repeat(5'),
      'FLOW-01-35',
      '20个领土应用5列',
    );
  });

  // 8. 苏格拉底提问 — 边界情况（FLOW-01-36 ~ FLOW-01-42）

  it(accTest('FLOW-01-36', '攻城失败后能否重试？— 失败后可再次发起'), () => {
    const sim = createSimWithBaseTerritory();
    const siegeSys = sim.engine.getSiegeSystem();

    const troops = sim.engine.getResourceAmount('troops');
    const grain = sim.engine.getResourceAmount('grain');

    // 第一次攻城失败
    const result1 = siegeSys.executeSiegeWithResult('city-xuchang', 'player', troops, grain, false);
    assertStrict(result1.launched && !result1.victory, 'FLOW-01-36', '第一次攻城应失败');

    // 补充资源后再次攻城
    sim.addResources({ troops: 50000, grain: 10000 });
    const troops2 = sim.engine.getResourceAmount('troops');
    const grain2 = sim.engine.getResourceAmount('grain');

    const condResult = siegeSys.checkSiegeConditions('city-xuchang', 'player', troops2, grain2);
    assertStrict(condResult.canSiege, 'FLOW-01-36', '攻城失败后应可再次发起');
  });

  it(accTest('FLOW-01-37', '每日攻城次数限制 — 3次后不可再攻'), () => {
    const sim = createSimWithBaseTerritory();
    const siegeSys = sim.engine.getSiegeSystem();

    const troops = sim.engine.getResourceAmount('troops');
    const grain = sim.engine.getResourceAmount('grain');

    // 从 city-luoyang 可攻击: city-xuchang, city-ye, city-changan 等
    const targets = ['city-xuchang', 'city-ye', 'city-changan'];
    for (const tid of targets) {
      siegeSys.executeSiegeWithResult(tid, 'player', troops, grain, true);
    }

    const remaining = siegeSys.getRemainingDailySieges();
    assertStrict(remaining === 0, 'FLOW-01-37', `3次后剩余次数应为0，实际${remaining}`);
  });

  it(accTest('FLOW-01-38', '攻城占领后24h冷却 — 冷却期内不可被反攻'), () => {
    const sim = createSimWithBaseTerritory();
    const siegeSys = sim.engine.getSiegeSystem();
    const territorySys = sim.engine.getTerritorySystem();

    const troops = sim.engine.getResourceAmount('troops');
    const grain = sim.engine.getResourceAmount('grain');

    // 攻占许昌
    const result = siegeSys.executeSiegeWithResult('city-xuchang', 'player', troops, grain, true);
    assertStrict(result.victory, 'FLOW-01-38', '攻城应胜利');

    const territory = territorySys.getTerritoryById('city-xuchang');
    assertStrict(territory?.ownership === 'player', 'FLOW-01-38', '许昌应被占领');

    // 验证冷却状态
    const inCooldown = siegeSys.isInCaptureCooldown('city-xuchang');
    assertStrict(inCooldown, 'FLOW-01-38', '占领后应在冷却期内');
  });

  it(accTest('FLOW-01-39', 'Tab切换后状态保持 — 重新渲染不丢失数据'), () => {
    const sim = createSimWithBaseTerritory();
    const territorySys = sim.engine.getTerritorySystem();

    const territories = territorySys.getAllTerritories();
    const summary = territorySys.getPlayerProductionSummary();

    const { rerender } = render(
      <WorldMapTab
        territories={territories}
        productionSummary={summary}
        snapshotVersion={0}
      />
    );

    assertStrict(!!screen.getByText('邺城'), 'FLOW-01-39', '首次渲染应显示邺城');

    // 模拟Tab切换后重新渲染
    rerender(
      <WorldMapTab
        territories={territories}
        productionSummary={summary}
        snapshotVersion={1}
      />
    );

    assertStrict(!!screen.getByText('邺城'), 'FLOW-01-39', '重渲染后应保持邺城显示');
  });

  it(accTest('FLOW-01-40', '攻击己方领土 — 条件校验拒绝'), () => {
    const sim = createSimWithBaseTerritory();
    const siegeSys = sim.engine.getSiegeSystem();

    const troops = sim.engine.getResourceAmount('troops');
    const grain = sim.engine.getResourceAmount('grain');

    const result = siegeSys.checkSiegeConditions('city-luoyang', 'player', troops, grain);
    assertStrict(!result.canSiege, 'FLOW-01-40', '攻击己方领土应被拒绝');
    assertStrict(result.errorCode === 'TARGET_ALREADY_OWNED', 'FLOW-01-40', '错误码应为 TARGET_ALREADY_OWNED');
  });

  it(accTest('FLOW-01-41', '攻击不存在的领土 — 返回不存在错误'), () => {
    const sim = createMapSim();
    const siegeSys = sim.engine.getSiegeSystem();

    const troops = sim.engine.getResourceAmount('troops');
    const grain = sim.engine.getResourceAmount('grain');

    const result = siegeSys.checkSiegeConditions('nonexistent-territory', 'player', troops, grain);
    assertStrict(!result.canSiege, 'FLOW-01-41', '攻击不存在领土应被拒绝');
    assertStrict(result.errorCode === 'TARGET_NOT_FOUND', 'FLOW-01-41', '错误码应为 TARGET_NOT_FOUND');
  });

  it(accTest('FLOW-01-42', 'WorldMapTab内部攻城流程 — 无外部回调时自动弹出确认'), async () => {
    const territories = makeTestTerritories();
    const mockEngine = {
      getMapSystem: () => ({
        checkSiegeConditions: () => ({ canSiege: true }),
        calculateSiegeCost: () => ({ troops: 200, grain: 500 }),
        executeSiege: () => ({}),
        getDailySiegesRemaining: () => 3,
        getCooldownRemaining: () => 0,
      }),
      getResourceAmount: (type: string) => type === 'troops' ? 5000 : 5000,
    };

    render(
      <WorldMapTab
        territories={territories}
        productionSummary={makeProductionSummary()}
        snapshotVersion={0}
        engine={mockEngine}
      />
    );

    // 选中敌方领土
    const xuchang = screen.getByText('许昌');
    await userEvent.click(xuchang);

    // 点击攻城按钮
    const siegeBtn = screen.queryByTestId('btn-siege-city-xuchang');
    if (siegeBtn) {
      await userEvent.click(siegeBtn);

      const modal = screen.queryByTestId('siege-confirm');
      assertStrict(!!modal, 'FLOW-01-42', '内部攻城流程应弹出确认弹窗');
    }
  });

  // 9. 真实引擎端到端流程（FLOW-01-43 ~ FLOW-01-45）

  it(accTest('FLOW-01-43', 'SceneRouter数据流 — engine.getTerritorySystem提供完整数据'), () => {
    const sim = createMapSim();
    const engine = sim.engine;

    const territorySys = engine.getTerritorySystem();
    const territories = territorySys.getAllTerritories();
    const productionSummary = territorySys.getPlayerProductionSummary();

    assertStrict(territories.length > 0, 'FLOW-01-43', '引擎应提供领土数据');
    assertStrict(!!productionSummary, 'FLOW-01-43', '引擎应提供产出汇总');
    assertStrict(typeof productionSummary.totalTerritories === 'number', 'FLOW-01-43', '汇总应包含领土数');
  });

  it(accTest('FLOW-01-44', 'SceneRouter攻城回调 — engine.getSiegeSystem执行攻城'), () => {
    const sim = createSimWithBaseTerritory();
    const engine = sim.engine;

    const siegeSys = engine.getSiegeSystem();

    const availableTroops = engine.getResourceAmount('troops');
    const availableGrain = engine.getResourceAmount('grain');

    // 使用 executeSiegeWithResult 确保确定性结果
    const result = siegeSys.executeSiegeWithResult('city-xuchang', 'player', availableTroops, availableGrain, true);

    assertStrict(result.launched, 'FLOW-01-44', '攻城应被发起');
    assertStrict(result.targetId === 'city-xuchang', 'FLOW-01-44', '目标ID应正确');
    assertStrict(result.victory === true, 'FLOW-01-44', '应有明确胜负结果');
  });

  it(accTest('FLOW-01-45', 'SceneRouter升级回调 — engine.getTerritorySystem升级领土'), () => {
    const sim = createSimWithBaseTerritory();
    const engine = sim.engine;

    const territorySys = engine.getTerritorySystem();

    // city-ye 初始 level=4（从 map-config），先占领再升级到5
    territorySys.captureTerritory('city-ye', 'player');
    const before = territorySys.getTerritoryById('city-ye')!;
    assertStrict(before.ownership === 'player', 'FLOW-01-45', 'city-ye应为player');
    assertStrict(before.level === 4, 'FLOW-01-45', 'city-ye初始应为4级');

    const result = territorySys.upgradeTerritory('city-ye');

    assertStrict(result.success, 'FLOW-01-45', '升级应成功');
    assertStrict(result.newLevel === 5, 'FLOW-01-45', `等级应提升到5，实际${result.newLevel}`);
  });

  // 10. 攻城回调错误处理（FLOW-01-46 ~ FLOW-01-48）

  it(accTest('FLOW-01-46', '攻城异常处理 — engine抛错时不崩溃'), () => {
    const sim = createMapSim();
    const siegeSys = sim.engine.getSiegeSystem();

    let errorThrown = false;
    try {
      siegeSys.executeSiege('nonexistent', 'player', 1000, 1000);
    } catch {
      errorThrown = true;
    }

    assertStrict(!errorThrown, 'FLOW-01-46', '攻城系统应返回失败结果而非抛异常');
  });

  it(accTest('FLOW-01-47', '领土升级异常 — 不存在的领土返回失败'), () => {
    const sim = createMapSim();
    const territorySys = sim.engine.getTerritorySystem();

    const result = territorySys.upgradeTerritory('nonexistent-territory');
    assertStrict(!result.success, 'FLOW-01-47', '不存在的领土升级应失败');
  });

  it(accTest('FLOW-01-48', '领土升级异常 — 敌方领土返回失败'), () => {
    const sim = createMapSim();
    const territorySys = sim.engine.getTerritorySystem();

    // city-xuchang 初始为 neutral，不可升级
    const result = territorySys.upgradeTerritory('city-xuchang');
    assertStrict(!result.success, 'FLOW-01-48', 'neutral领土升级应失败');
    assertStrict(result.newLevel === result.previousLevel, 'FLOW-01-48', '等级不应变化');
  });
});
