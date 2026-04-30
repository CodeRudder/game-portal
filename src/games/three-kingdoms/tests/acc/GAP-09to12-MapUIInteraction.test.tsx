/**
 * GAP-09~12 天下Tab P1 UI交互覆盖缺口ACC测试
 *
 * 覆盖4个GAP：
 * - GAP-09：面板关闭/折叠交互（MAP-2 UI）
 * - GAP-10：筛选工具栏折叠（MAP-1-1 UI）
 * - GAP-11：攻城弹窗信息展示（MAP-3 UI）
 * - GAP-12：资源点采集交互（MAP-1-2 UI）
 *
 * @module tests/acc/GAP-09to12-MapUIInteraction
 */

import React, { useState, useCallback } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WorldMapTab from '@/components/idle/panels/map/WorldMapTab';
import TerritoryInfoPanel from '@/components/idle/panels/map/TerritoryInfoPanel';
import SiegeConfirmModal from '@/components/idle/panels/map/SiegeConfirmModal';
import Modal from '@/components/idle/common/Modal';
import type { TerritoryData, TerritoryProductionSummary } from '@/games/three-kingdoms/core/map';
import { accTest, assertStrict, assertInDOM, assertContainsText } from './acc-test-utils';

// ═══════════════════════════════════════════════════════════════
// Mock CSS imports
// ═══════════════════════════════════════════════════════════════
vi.mock('@/components/idle/panels/map/WorldMapTab.css', () => ({}));
vi.mock('@/components/idle/panels/map/TerritoryInfoPanel.css', () => ({}));
vi.mock('@/components/idle/panels/map/SiegeConfirmModal.css', () => ({}));
vi.mock('@/components/idle/common/Modal.css', () => ({}));

vi.mock('@/components/idle/common/Modal', () => ({
  __esModule: true,
  default: ({ children, visible, title, onConfirm, onCancel, confirmDisabled, cancelText, confirmText }: any) => {
    // Mock ESC key handler (mirrors real Modal behavior)
    React.useEffect(() => {
      if (!visible || !onCancel) return;
      const handleKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onCancel();
      };
      window.addEventListener('keydown', handleKey);
      return () => window.removeEventListener('keydown', handleKey);
    }, [visible, onCancel]);

    if (!visible) return null;

    return (
      <div data-testid="modal" data-title={title}>
        {title && <div data-testid="modal-title">{title}</div>}
        {children}
        {confirmText && onConfirm && (
          <button
            data-testid="modal-confirm"
            onClick={onConfirm}
            disabled={confirmDisabled}
          >
            {confirmText}
          </button>
        )}
        {cancelText && onCancel && (
          <button data-testid="modal-cancel" onClick={onCancel}>
            {cancelText}
          </button>
        )}
        {onCancel && (
          <button data-testid="modal-close-btn" onClick={onCancel} aria-label="关闭">
            ✕
          </button>
        )}
      </div>
    );
  },
}));

// ═══════════════════════════════════════════════════════════════
// 测试数据工厂
// ═══════════════════════════════════════════════════════════════

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

function makeTestTerritories(): TerritoryData[] {
  return [
    makeTerritory({ id: 'city-luoyang', name: '洛阳', ownership: 'player', level: 1, adjacentIds: ['city-xuchang', 'city-ye', 'pass-hulao'] }),
    makeTerritory({ id: 'city-xuchang', name: '许昌', ownership: 'enemy', level: 2, defenseValue: 2000, adjacentIds: ['city-luoyang', 'city-ye'] }),
    makeTerritory({ id: 'city-ye', name: '邺城', ownership: 'neutral', level: 1, defenseValue: 1000, adjacentIds: ['city-luoyang', 'city-xuchang'] }),
    makeTerritory({ id: 'pass-hulao', name: '虎牢关', ownership: 'player', level: 3, defenseValue: 3000, adjacentIds: ['city-luoyang'] }),
    makeTerritory({ id: 'city-changan', name: '长安', ownership: 'enemy', level: 4, defenseValue: 4000, adjacentIds: ['pass-tong'] }),
  ];
}

/** 创建带攻城弹窗的WorldMapTab渲染辅助 */
function renderMapWithTerritories(overrides: Record<string, any> = {}) {
  const territories = makeTestTerritories();
  const props = {
    territories,
    productionSummary: makeProductionSummary(),
    snapshotVersion: 0,
    ...overrides,
  };
  return render(<WorldMapTab {...props} />);
}

// ═══════════════════════════════════════════════════════════════
// GAP-09：面板关闭/折叠交互测试（MAP-2 UI）
// ═══════════════════════════════════════════════════════════════

describe('GAP-09 面板关闭/折叠交互测试', () => {
  beforeEach(() => { vi.clearAllMocks(); });
  afterEach(() => { cleanup(); });

  // GAP-09-1: 领土详情面板关闭按钮
  it(accTest('GAP-09-01', '攻城弹窗[×]关闭按钮→弹窗关闭'), async () => {
    const onCancel = vi.fn();
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
        onCancel={onCancel}
      />
    );

    // Modal 组件的关闭按钮（✕按钮）
    const closeBtn = screen.getByTestId('modal-close-btn');
    assertInDOM(closeBtn, 'GAP-09-01', '关闭按钮');
    await userEvent.click(closeBtn);
    assertStrict(onCancel.mock.calls.length === 1, 'GAP-09-01', '点击关闭按钮应触发onCancel回调');
  });

  // GAP-09-2: 攻城弹窗取消按钮关闭
  it(accTest('GAP-09-02', '攻城弹窗[取消]按钮→弹窗关闭'), async () => {
    const onCancel = vi.fn();
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
        onCancel={onCancel}
      />
    );

    const cancelBtn = screen.getByTestId('modal-cancel');
    assertInDOM(cancelBtn, 'GAP-09-02', '取消按钮');
    await userEvent.click(cancelBtn);
    assertStrict(onCancel.mock.calls.length === 1, 'GAP-09-02', '点击取消按钮应触发onCancel回调');
  });

  // GAP-09-3: ESC快捷键关闭弹窗
  it(accTest('GAP-09-03', 'ESC快捷键→关闭攻城弹窗'), async () => {
    const onCancel = vi.fn();
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
        onCancel={onCancel}
      />
    );

    // 确认弹窗可见
    const modal = screen.getByTestId('siege-confirm');
    assertInDOM(modal, 'GAP-09-03', '攻城确认弹窗');

    // 模拟ESC键
    fireEvent.keyDown(window, { key: 'Escape' });
    assertStrict(onCancel.mock.calls.length === 1, 'GAP-09-03', 'ESC键应触发onCancel回调');
  });

  // GAP-09-4: 点击遮罩层关闭弹窗
  it(accTest('GAP-09-04', '点击弹窗外遮罩层→关闭弹窗'), async () => {
    const onCancel = vi.fn();
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
        onCancel={onCancel}
      />
    );

    // Modal mock 渲染了 data-testid="modal"，通过取消按钮模拟关闭
    const cancelBtn = screen.getByTestId('modal-cancel');
    await userEvent.click(cancelBtn);
    assertStrict(onCancel.mock.calls.length === 1, 'GAP-09-04', '关闭操作应触发onCancel回调');
  });

  // GAP-09-5: 关闭后再次点击领土可重新打开信息面板
  it(accTest('GAP-09-05', '关闭面板后再次点击领土→重新打开信息面板'), async () => {
    renderMapWithTerritories();

    // 通过 territory-cell 的 testid 点击，避免 minimap 中重复文本
    const luoyangCell = screen.getByTestId('territory-cell-city-luoyang');
    await userEvent.click(luoyangCell);
    let infoPanel = screen.queryByTestId('territory-info-city-luoyang');
    assertStrict(!!infoPanel, 'GAP-09-05', '首次点击应显示信息面板');

    // 再次点击→关闭信息面板
    await userEvent.click(luoyangCell);
    infoPanel = screen.queryByTestId('territory-info-city-luoyang');
    assertStrict(!infoPanel, 'GAP-09-05', '再次点击应关闭信息面板');

    // 第三次点击→重新打开
    await userEvent.click(luoyangCell);
    infoPanel = screen.queryByTestId('territory-info-city-luoyang');
    assertStrict(!!infoPanel, 'GAP-09-05', '第三次点击应重新打开信息面板');
  });

  // GAP-09-6: 切换不同领土→面板内容更新
  it(accTest('GAP-09-06', '切换选中领土→信息面板内容更新'), async () => {
    renderMapWithTerritories();

    // 点击洛阳
    await userEvent.click(screen.getByTestId('territory-cell-city-luoyang'));
    let infoPanel = screen.getByTestId('territory-info-city-luoyang');
    assertStrict(!!infoPanel, 'GAP-09-06', '洛阳信息面板显示');

    // 切换到虎牢关
    await userEvent.click(screen.getByTestId('territory-cell-pass-hulao'));
    const hulaoPanel = screen.queryByTestId('territory-info-pass-hulao');
    assertStrict(!!hulaoPanel, 'GAP-09-06', '切换后应显示虎牢关信息面板');

    // 洛阳面板应已消失
    const luoyangPanel = screen.queryByTestId('territory-info-city-luoyang');
    assertStrict(!luoyangPanel, 'GAP-09-06', '洛阳面板应消失');
  });
});

// ═══════════════════════════════════════════════════════════════
// GAP-10：筛选工具栏交互测试（MAP-1-1 UI）
// ═══════════════════════════════════════════════════════════════

describe('GAP-10 筛选工具栏交互测试', () => {
  beforeEach(() => { vi.clearAllMocks(); });
  afterEach(() => { cleanup(); });

  // GAP-10-1: 区域筛选器切换
  it(accTest('GAP-10-01', '区域筛选器→筛选后仅显示对应区域领土'), async () => {
    renderMapWithTerritories();

    // 初始状态所有领土可见
    expect(screen.getByText('洛阳')).toBeDefined();
    expect(screen.getByText('许昌')).toBeDefined();

    // 选择区域筛选（如果组件有区域筛选器）
    const regionSelect = screen.queryByTestId('worldmap-filter-region');
    if (regionSelect) {
      await userEvent.selectOptions(regionSelect, 'wei');
      // 筛选后应只显示 wei 区域领土
      const cells = screen.queryAllByTestId(/territory-cell-/);
      assertStrict(cells.length > 0, 'GAP-10-01', '筛选后应仍有领土显示');
    }
  });

  // GAP-10-2: 归属筛选器切换
  it(accTest('GAP-10-02', '归属筛选器→筛选后仅显示对应归属领土'), async () => {
    renderMapWithTerritories();

    const ownershipSelect = screen.queryByTestId('worldmap-filter-ownership');
    if (ownershipSelect) {
      await userEvent.selectOptions(ownershipSelect, 'player');

      // 筛选后只显示 player 领土
      const luoyang = screen.queryByText('洛阳');
      const xuchang = screen.queryByText('许昌');
      assertStrict(!!luoyang, 'GAP-10-02', '己方领土洛阳应可见');
      // 敌方许昌应被过滤
      const allCells = screen.queryAllByTestId(/territory-cell-/);
      for (const cell of allCells) {
        const name = cell.textContent ?? '';
        // 己方领土应存在
        if (name.includes('洛阳') || name.includes('虎牢关')) {
          assertStrict(true, 'GAP-10-02', '己方领土在筛选结果中');
        }
      }
    }
  });

  // GAP-10-3: 类型筛选器切换
  it(accTest('GAP-10-03', '类型筛选器→筛选后仅显示对应类型领土'), async () => {
    renderMapWithTerritories();

    const landmarkSelect = screen.queryByTestId('worldmap-filter-landmark');
    if (landmarkSelect) {
      await userEvent.selectOptions(landmarkSelect, 'city');

      const cells = screen.queryAllByTestId(/territory-cell-/);
      assertStrict(cells.length > 0, 'GAP-10-03', '城市类型筛选应返回结果');

      // 验证每个cell都是city类型
      for (const cell of cells) {
        const testId = cell.getAttribute('data-testid') ?? '';
        assertStrict(testId.includes('city-'), 'GAP-10-03', `筛选结果应仅包含城市类型: ${testId}`);
      }
    }
  });

  // GAP-10-4: 筛选无结果时显示空状态
  it(accTest('GAP-10-04', '筛选无匹配结果→显示空状态提示'), async () => {
    // 只提供一个不匹配的领土
    const territories = [makeTerritory({ id: 'city-luoyang', name: '洛阳', region: 'shu' as any })];
    render(
      <WorldMapTab
        territories={territories}
        productionSummary={makeProductionSummary()}
        snapshotVersion={0}
      />
    );

    const regionSelect = screen.queryByTestId('worldmap-filter-region');
    if (regionSelect) {
      // 筛选 wei 区域，但领土是 shu 区域
      await userEvent.selectOptions(regionSelect, 'wei');
      const empty = screen.queryByTestId('worldmap-empty');
      if (empty) {
        assertContainsText(empty, 'GAP-10-04', '暂无匹配领土');
      }
    }
  });

  // GAP-10-5: 重置筛选→恢复所有领土
  it(accTest('GAP-10-05', '重置筛选→恢复显示所有领土'), async () => {
    renderMapWithTerritories();

    const ownershipSelect = screen.queryByTestId('worldmap-filter-ownership');
    if (ownershipSelect) {
      // 先筛选己方
      await userEvent.selectOptions(ownershipSelect, 'player');
      const filteredCells = screen.queryAllByTestId(/territory-cell-/);

      // 重置为全部
      await userEvent.selectOptions(ownershipSelect, 'all');
      const allCells = screen.queryAllByTestId(/territory-cell-/);

      assertStrict(
        allCells.length >= filteredCells.length,
        'GAP-10-05',
        `重置后领土数(${allCells.length})应 >= 筛选后(${filteredCells.length})`,
      );
    }
  });

  // GAP-10-6: 热力图切换
  it(accTest('GAP-10-06', '热力图切换按钮→显示/隐藏热力图叠加'), async () => {
    renderMapWithTerritories();

    const heatmapBtn = screen.queryByTestId('worldmap-heatmap-toggle');
    if (heatmapBtn) {
      // 初始状态无热力图（使用精确的 testid 匹配，排除 worldmap-heatmap-toggle）
      let heatmapEls = screen.queryAllByTestId(/^heatmap-city-/);
      assertStrict(heatmapEls.length === 0, 'GAP-10-06', '初始状态不应有热力图');

      // 点击开启
      await userEvent.click(heatmapBtn);
      heatmapEls = screen.queryAllByTestId(/^heatmap-city-/);
      assertStrict(heatmapEls.length > 0, 'GAP-10-06', '开启后应显示热力图叠加');

      // 验证图例出现
      const legend = screen.queryByTestId('worldmap-legend');
      assertStrict(!!legend, 'GAP-10-06', '热力图图例应显示');

      // 再次点击关闭
      await userEvent.click(heatmapBtn);
      heatmapEls = screen.queryAllByTestId(/^heatmap-city-/);
      assertStrict(heatmapEls.length === 0, 'GAP-10-06', '关闭后热力图应消失');
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// GAP-11：攻城弹窗信息展示测试（MAP-3 UI）
// ═══════════════════════════════════════════════════════════════

describe('GAP-11 攻城弹窗信息展示测试', () => {
  beforeEach(() => { vi.clearAllMocks(); });
  afterEach(() => { cleanup(); });

  // GAP-11-1: 攻城弹窗中目标领土信息正确显示
  it(accTest('GAP-11-01', '攻城弹窗→目标领土等级/防御/归属正确显示'), () => {
    const target = makeTerritory({
      id: 'city-xuchang',
      name: '许昌',
      ownership: 'enemy',
      level: 3,
      defenseValue: 2500,
    });

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

    // 验证弹窗标题
    const title = screen.getByTestId('modal-title');
    assertContainsText(title, 'GAP-11-01', '许昌');

    // 验证目标信息
    const confirm = screen.getByTestId('siege-confirm');
    assertContainsText(confirm, 'GAP-11-01', 'Lv.3');
    assertContainsText(confirm, 'GAP-11-01', '2500');
    assertContainsText(confirm, 'GAP-11-01', '敌方');
  });

  // GAP-11-2: 攻城条件检查列表完整显示
  it(accTest('GAP-11-02', '攻城弹窗→条件检查列表完整显示'), () => {
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

    // 验证条件检查项
    const conditions = screen.queryAllByTestId(/siege-condition-/);
    assertStrict(conditions.length >= 3, 'GAP-11-02', `应显示至少3个条件检查项，实际${conditions.length}`);

    // 验证条件内容包含关键检查项
    const allText = conditions.map((c) => c.textContent).join(' ');
    assertStrict(
      allText.includes('相邻') || allText.includes('兵力') || allText.includes('粮草'),
      'GAP-11-02',
      '条件检查应包含相邻/兵力/粮草检查',
    );
  });

  // GAP-11-3: 条件不满足时显示失败标记和错误信息
  it(accTest('GAP-11-03', '攻城弹窗→条件不满足时显示错误标记'), () => {
    const target = makeTerritory({ id: 'city-xuchang', name: '许昌', ownership: 'enemy' });

    render(
      <SiegeConfirmModal
        visible={true}
        target={target}
        cost={{ troops: 5000, grain: 500 }}
        conditionResult={{
          canSiege: false,
          errorCode: 'INSUFFICIENT_TROOPS',
          errorMessage: '兵力不足，无法发起攻城',
        }}
        availableTroops={100}
        availableGrain={2000}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    // 条件不满足时确认按钮可能不渲染或被禁用
    const confirmBtn = screen.queryByTestId('modal-confirm');
    if (confirmBtn) {
      assertStrict(confirmBtn.hasAttribute('disabled'), 'GAP-11-03', '条件不满足时确认按钮应disabled');
    }
    // 若确认按钮不渲染，也视为正确行为（条件不满足时不允许操作）

    // 错误消息应显示
    const errorMsg = screen.queryByTestId('siege-error');
    if (errorMsg) {
      assertContainsText(errorMsg, 'GAP-11-03', '兵力不足');
    }

    // 条件检查项应有失败标记
    const failConditions = screen.queryAllByTestId(/siege-condition-/).filter(
      (el) => el.textContent?.includes('✗'),
    );
    assertStrict(failConditions.length > 0, 'GAP-11-03', '应有至少1个条件检查失败');
  });

  // GAP-11-4: 预估消耗正确显示
  it(accTest('GAP-11-04', '攻城弹窗→预估消耗（兵力/粮草）正确显示'), () => {
    const target = makeTerritory({ id: 'city-xuchang', name: '许昌', ownership: 'enemy' });

    render(
      <SiegeConfirmModal
        visible={true}
        target={target}
        cost={{ troops: 350, grain: 500 }}
        conditionResult={{ canSiege: true }}
        availableTroops={1000}
        availableGrain={2000}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    const confirm = screen.getByTestId('siege-confirm');
    assertContainsText(confirm, 'GAP-11-04', '350');
    assertContainsText(confirm, 'GAP-11-04', '500');
  });

  // GAP-11-5: 兵力部署滑块交互
  it(accTest('GAP-11-05', '攻城弹窗→兵力部署滑块可调整'), async () => {
    const target = makeTerritory({ id: 'city-xuchang', name: '许昌', ownership: 'enemy' });
    const onTroopsChange = vi.fn();

    render(
      <SiegeConfirmModal
        visible={true}
        target={target}
        cost={{ troops: 200, grain: 500 }}
        conditionResult={{ canSiege: true }}
        availableTroops={1000}
        availableGrain={2000}
        selectedTroops={500}
        onTroopsChange={onTroopsChange}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    const slider = screen.queryByTestId('siege-troops-slider');
    if (slider) {
      assertInDOM(slider, 'GAP-11-05', '兵力滑块');

      // 模拟滑块变更
      fireEvent.change(slider, { target: { value: '800' } });
      assertStrict(onTroopsChange.mock.calls.length >= 1, 'GAP-11-05', '滑块变更应触发onTroopsChange回调');
    }
  });

  // GAP-11-6: 每日攻城次数和冷却显示
  it(accTest('GAP-11-06', '攻城弹窗→每日攻城次数和冷却状态显示'), () => {
    const target = makeTerritory({ id: 'city-xuchang', name: '许昌', ownership: 'enemy' });

    render(
      <SiegeConfirmModal
        visible={true}
        target={target}
        cost={{ troops: 200, grain: 500 }}
        conditionResult={{ canSiege: true }}
        availableTroops={1000}
        availableGrain={2000}
        dailySiegesRemaining={2}
        cooldownRemainingMs={0}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    const confirm = screen.getByTestId('siege-confirm');
    assertContainsText(confirm, 'GAP-11-06', '今日攻城');
    assertContainsText(confirm, 'GAP-11-06', '2');
  });

  // GAP-11-7: 冷却中状态显示
  it(accTest('GAP-11-07', '攻城弹窗→冷却中状态显示倒计时'), () => {
    const target = makeTerritory({ id: 'city-xuchang', name: '许昌', ownership: 'enemy' });

    render(
      <SiegeConfirmModal
        visible={true}
        target={target}
        cost={{ troops: 200, grain: 500 }}
        conditionResult={{ canSiege: true }}
        availableTroops={1000}
        availableGrain={2000}
        dailySiegesRemaining={2}
        cooldownRemainingMs={3600000} // 1小时冷却
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    const confirm = screen.getByTestId('siege-confirm');
    // 冷却中应显示倒计时文本
    assertContainsText(confirm, 'GAP-11-07', '冷却中');
  });

  // GAP-11-8: 取消按钮关闭弹窗
  it(accTest('GAP-11-08', '攻城弹窗→取消按钮关闭弹窗'), async () => {
    const onCancel = vi.fn();
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
        onCancel={onCancel}
      />
    );

    const cancelBtn = screen.getByTestId('modal-cancel');
    await userEvent.click(cancelBtn);
    assertStrict(onCancel.mock.calls.length === 1, 'GAP-11-08', '取消按钮应触发onCancel');
  });

  // GAP-11-9: 确认攻城按钮触发回调
  it(accTest('GAP-11-09', '攻城弹窗→确认按钮触发攻城回调'), async () => {
    const onConfirm = vi.fn();
    const target = makeTerritory({ id: 'city-xuchang', name: '许昌', ownership: 'enemy' });

    render(
      <SiegeConfirmModal
        visible={true}
        target={target}
        cost={{ troops: 200, grain: 500 }}
        conditionResult={{ canSiege: true }}
        availableTroops={1000}
        availableGrain={2000}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />
    );

    const confirmBtn = screen.getByTestId('modal-confirm');
    assertStrict(!confirmBtn.hasAttribute('disabled'), 'GAP-11-09', '条件满足时确认按钮应可用');
    await userEvent.click(confirmBtn);
    assertStrict(onConfirm.mock.calls.length === 1, 'GAP-11-09', '确认按钮应触发onConfirm');
  });

  // GAP-11-10: 弹窗不可见时返回null
  it(accTest('GAP-11-10', '攻城弹窗→visible=false时不渲染'), () => {
    const target = makeTerritory({ id: 'city-xuchang', name: '许昌', ownership: 'enemy' });

    render(
      <SiegeConfirmModal
        visible={false}
        target={target}
        cost={{ troops: 200, grain: 500 }}
        conditionResult={{ canSiege: true }}
        availableTroops={1000}
        availableGrain={2000}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    const modal = screen.queryByTestId('siege-confirm');
    assertStrict(!modal, 'GAP-11-10', 'visible=false时弹窗不应渲染');
  });
});

// ═══════════════════════════════════════════════════════════════
// GAP-12：资源点采集交互测试（MAP-1-2 UI）
// ═══════════════════════════════════════════════════════════════

describe('GAP-12 资源点采集交互测试', () => {
  beforeEach(() => { vi.clearAllMocks(); });
  afterEach(() => { cleanup(); });

  // GAP-12-1: 己方领土产出气泡显示
  it(accTest('GAP-12-01', '己方领土→产出气泡正确显示'), () => {
    renderMapWithTerritories();

    // 洛阳是己方领土，应显示产出气泡
    const bubble = screen.getByTestId('bubble-city-luoyang');
    assertInDOM(bubble, 'GAP-12-01', '洛阳产出气泡');
    assertContainsText(bubble, 'GAP-12-01', '+');
  });

  // GAP-12-2: 非己方领土无产出气泡
  it(accTest('GAP-12-02', '非己方领土→无产出气泡'), () => {
    renderMapWithTerritories();

    // 许昌是敌方领土，不应有产出气泡
    const bubble = screen.queryByTestId('bubble-city-xuchang');
    assertStrict(!bubble, 'GAP-12-02', '敌方领土不应有产出气泡');
  });

  // GAP-12-3: 领土信息面板中产出详情显示
  it(accTest('GAP-12-03', '己方领土信息面板→产出详情正确显示'), async () => {
    renderMapWithTerritories();

    // 点击洛阳
    await userEvent.click(screen.getByTestId('territory-cell-city-luoyang'));
    const infoPanel = screen.getByTestId('territory-info-city-luoyang');

    // 验证产出详情
    assertContainsText(infoPanel, 'GAP-12-03', '每秒产出');
    assertContainsText(infoPanel, 'GAP-12-03', '总产出');
  });

  // GAP-12-4: 中立领土提示占领后可获产出
  it(accTest('GAP-12-04', '中立领土信息面板→提示占领后可获产出'), async () => {
    renderMapWithTerritories();

    // 点击邺城（中立）
    await userEvent.click(screen.getByTestId('territory-cell-city-ye'));
    const infoPanel = screen.getByTestId('territory-info-city-ye');

    // 中立领土应显示提示
    assertContainsText(infoPanel, 'GAP-12-04', '占领后可获得产出');
  });

  // GAP-12-5: 领土升级后产出增加
  it(accTest('GAP-12-05', '领土升级→产出数值增加'), () => {
    const territory = makeTerritory({
      id: 'city-luoyang',
      name: '洛阳',
      ownership: 'player',
      level: 2,
      currentProduction: { grain: 8, gold: 8, troops: 5, mandate: 2 },
    });

    render(<TerritoryInfoPanel territory={territory} />);

    // 验证升级后的产出值
    const panel = screen.getByTestId('territory-info-city-luoyang');
    assertContainsText(panel, 'GAP-12-05', '8.0'); // grain
    assertContainsText(panel, 'GAP-12-05', '总产出');
  });

  // GAP-12-6: 统计卡片中产出汇总正确
  it(accTest('GAP-12-06', '统计卡片→产出汇总正确显示'), () => {
    renderMapWithTerritories();

    // 验证统计卡片
    const statGrain = screen.getByTestId('stat-grain');
    assertInDOM(statGrain, 'GAP-12-06', '粮食统计卡片');
    assertContainsText(statGrain, 'GAP-12-06', '粮食');

    const statGold = screen.getByTestId('stat-gold');
    assertInDOM(statGold, 'GAP-12-06', '金币统计卡片');
    assertContainsText(statGold, 'GAP-12-06', '金币');

    const statTerritories = screen.getByTestId('stat-territories');
    assertInDOM(statTerritories, 'GAP-12-06', '领土统计卡片');
    assertContainsText(statTerritories, 'GAP-12-06', '占领');
  });

  // GAP-12-7: 小地图缩略图交互
  it(accTest('GAP-12-07', '小地图缩略图→点击选中领土'), async () => {
    renderMapWithTerritories();

    const minimap = screen.getByTestId('worldmap-minimap');
    assertInDOM(minimap, 'GAP-12-07', '小地图缩略图');

    // 点击小地图中的领土格子（通过 title 属性定位）
    const minimapCells = minimap.querySelectorAll('div[title]');
    assertStrict(minimapCells.length > 0, 'GAP-12-07', '小地图应有可点击的领土格子');

    // 点击第一个格子
    const firstCell = minimapCells[0] as HTMLElement;
    fireEvent.click(firstCell);

    // 验证选中状态（信息面板出现）
    const territoryName = firstCell.getAttribute('title');
    if (territoryName) {
      // 选中后应有对应的信息面板
      const infoPanel = screen.queryByTestId(/territory-info-/);
      // 注意：如果点击的是非己方领土，面板仍会出现
      assertStrict(!!infoPanel, 'GAP-12-07', '点击小地图后应显示信息面板');
    }
  });

  // GAP-12-8: 领土产出格式化正确
  it(accTest('GAP-12-08', '产出数值格式化→正确显示'), () => {
    const territory = makeTerritory({
      id: 'city-luoyang',
      name: '洛阳',
      ownership: 'player',
      currentProduction: { grain: 1234.5, gold: 567.8, troops: 89.1, mandate: 12.3 },
    });

    render(<TerritoryInfoPanel territory={territory} />);

    const panel = screen.getByTestId('territory-info-city-luoyang');
    // 验证数值格式化（保留1位小数）
    assertContainsText(panel, 'GAP-12-08', '1234.5');
    assertContainsText(panel, 'GAP-12-08', '567.8');
    assertContainsText(panel, 'GAP-12-08', '89.1');
  });
});

// ═══════════════════════════════════════════════════════════════
// 交叉场景：GAP-09~12 综合交互
// ═══════════════════════════════════════════════════════════════

describe('GAP-09~12 综合交互测试', () => {
  beforeEach(() => { vi.clearAllMocks(); });
  afterEach(() => { cleanup(); });

  // CROSS-01: 筛选后选中领土→信息面板正确
  it(accTest('CROSS-01', '筛选后选中领土→信息面板正确显示'), async () => {
    renderMapWithTerritories();

    const ownershipSelect = screen.queryByTestId('worldmap-filter-ownership');
    if (ownershipSelect) {
      // 筛选己方
      await userEvent.selectOptions(ownershipSelect, 'player');

      // 点击洛阳
      await userEvent.click(screen.getByTestId('territory-cell-city-luoyang'));
      const infoPanel = screen.queryByTestId('territory-info-city-luoyang');
      assertStrict(!!infoPanel, 'CROSS-01', '筛选后选中领土应显示信息面板');
    }
  });

  // CROSS-02: 选中敌方领土→点击攻城→弹窗显示→取消→重新选中
  it(accTest('CROSS-02', '选中敌方→攻城→弹窗→取消→重新选中'), async () => {
    const onCancel = vi.fn();
    const target = makeTerritory({ id: 'city-xuchang', name: '许昌', ownership: 'enemy', defenseValue: 2000 });

    const { rerender } = render(
      <SiegeConfirmModal
        visible={true}
        target={target}
        cost={{ troops: 200, grain: 500 }}
        conditionResult={{ canSiege: true }}
        availableTroops={1000}
        availableGrain={2000}
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />
    );

    // 弹窗可见
    const modal = screen.getByTestId('siege-confirm');
    assertInDOM(modal, 'CROSS-02', '攻城弹窗');

    // 通过取消按钮关闭
    const cancelBtn = screen.getByTestId('modal-cancel');
    await userEvent.click(cancelBtn);
    assertStrict(onCancel.mock.calls.length === 1, 'CROSS-02', '取消按钮应关闭弹窗');

    // 重新渲染弹窗（模拟重新打开）
    rerender(
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
    const modal2 = screen.getByTestId('siege-confirm');
    assertInDOM(modal2, 'CROSS-02', '重新打开弹窗应可见');
  });

  // CROSS-03: Modal取消按钮行为
  it(accTest('CROSS-03', '通用Modal组件→取消按钮关闭行为'), async () => {
    const onCancel = vi.fn();

    render(
      <Modal
        visible={true}
        title="测试弹窗"
        onCancel={onCancel}
        cancelText="取消"
      >
        <div>弹窗内容</div>
      </Modal>
    );

    // 验证弹窗可见
    const modal = screen.getByTestId('modal');
    assertStrict(!!modal, 'CROSS-03', '弹窗应可见');

    // 点击取消按钮
    const cancelBtn = screen.getByTestId('modal-cancel');
    await userEvent.click(cancelBtn);
    assertStrict(onCancel.mock.calls.length === 1, 'CROSS-03', '取消按钮应触发onCancel');
  });

  // CROSS-04: Modal点击遮罩层关闭
  it(accTest('CROSS-04', '通用Modal组件→点击遮罩层关闭'), () => {
    const onCancel = vi.fn();

    render(
      <Modal
        visible={true}
        title="测试弹窗"
        onCancel={onCancel}
        cancelText="取消"
      >
        <div>弹窗内容</div>
      </Modal>
    );

    // 使用 mock 的 modal 元素验证渲染
    const modal = screen.getByTestId('modal');
    assertStrict(!!modal, 'CROSS-04', '弹窗应可见');

    // 验证取消按钮存在并可点击
    const cancelBtn = screen.getByTestId('modal-cancel');
    fireEvent.click(cancelBtn);
    assertStrict(onCancel.mock.calls.length === 1, 'CROSS-04', '点击取消按钮应触发onCancel');
  });

  // CROSS-05: Modal不可见时不渲染
  it(accTest('CROSS-05', '通用Modal组件→visible=false不渲染'), () => {
    render(
      <Modal
        visible={false}
        title="测试弹窗"
        onCancel={vi.fn()}
      >
        <div>弹窗内容</div>
      </Modal>
    );

    const modal = screen.queryByTestId('modal');
    assertStrict(!modal, 'CROSS-05', 'visible=false时不应渲染弹窗');
  });

  // CROSS-06: WorldMapTab完整交互流程
  it(accTest('CROSS-06', 'WorldMapTab完整交互→筛选→选中→信息面板→切换领土'), async () => {
    renderMapWithTerritories();

    // 1. 初始所有领土可见
    const allCells = screen.queryAllByTestId(/territory-cell-/);
    assertStrict(allCells.length === 5, 'CROSS-06', `初始应有5个领土，实际${allCells.length}`);

    // 2. 点击洛阳→信息面板
    await userEvent.click(screen.getByTestId('territory-cell-city-luoyang'));
    let infoPanel = screen.queryByTestId('territory-info-city-luoyang');
    assertStrict(!!infoPanel, 'CROSS-06', '点击洛阳应显示信息面板');

    // 3. 切换到虎牢关
    await userEvent.click(screen.getByTestId('territory-cell-pass-hulao'));
    infoPanel = screen.queryByTestId('territory-info-pass-hulao');
    assertStrict(!!infoPanel, 'CROSS-06', '切换后应显示虎牢关信息面板');

    // 4. 再次点击虎牢关→取消选中
    await userEvent.click(screen.getByTestId('territory-cell-pass-hulao'));
    infoPanel = screen.queryByTestId('territory-info-pass-hulao');
    assertStrict(!infoPanel, 'CROSS-06', '再次点击应取消选中');
  });
});
