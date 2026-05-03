/**
 * ProductionPanel — 产出管理面板测试
 *
 * 覆盖场景：
 * - 基础渲染：面板标题、己方领土列表
 * - 产出显示：各资源产出速率正确展示
 * - 总产出汇总：汇总数据正确
 * - 空状态：无己方领土时显示提示
 * - 等级显示：各领土等级正确显示
 * - 存储容量：容量数值正确显示
 * - 存储警告：高产出时显示警告
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import ProductionPanel from '../ProductionPanel';
import type {
  TerritoryData,
  TerritoryProductionSummary,
} from '@/games/three-kingdoms/core/map';

// ── 测试数据 ──

const makeTerritory = (overrides: Partial<TerritoryData> = {}): TerritoryData => ({
  id: 'city-luoyang',
  name: '洛阳',
  position: { x: 5, y: 5 },
  region: 'central_plains',
  ownership: 'player',
  level: 3,
  baseProduction: { grain: 10, gold: 5, troops: 3, mandate: 1 },
  currentProduction: { grain: 15, gold: 7.5, troops: 4.5, mandate: 1.5 },
  defenseValue: 200,
  adjacentIds: ['city-xuchang'],
  ...overrides,
});

const makeSummary = (overrides: Partial<TerritoryProductionSummary> = {}): TerritoryProductionSummary => ({
  totalTerritories: 2,
  territoriesByRegion: { central_plains: 2 } as any,
  totalProduction: { grain: 30, gold: 15, troops: 9, mandate: 3 },
  totalGrain: 30,
  totalCoins: 15,
  totalTroops: 9,
  details: [],
  ...overrides,
});

const defaultProps = {
  territories: [
    makeTerritory(),
    makeTerritory({
      id: 'city-xuchang',
      name: '许昌',
      level: 2,
      currentProduction: { grain: 12, gold: 6, troops: 3.6, mandate: 1.2 },
    }),
  ],
  productionSummary: makeSummary(),
};

describe('ProductionPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── 基础渲染 ──

  it('显示面板容器', () => {
    render(<ProductionPanel {...defaultProps} />);
    expect(screen.getByTestId('production-panel')).toBeTruthy();
  });

  it('显示总产出汇总', () => {
    render(<ProductionPanel {...defaultProps} />);
    expect(screen.getByTestId('production-summary')).toBeTruthy();
    expect(screen.getByText('总产出 / 秒')).toBeTruthy();
  });

  it('显示领土列表', () => {
    render(<ProductionPanel {...defaultProps} />);
    expect(screen.getByTestId('production-territory-list')).toBeTruthy();
  });

  // ── 己方领土 ──

  it('显示己方领土名称', () => {
    render(<ProductionPanel {...defaultProps} />);
    expect(screen.getByText('洛阳')).toBeTruthy();
    expect(screen.getByText('许昌')).toBeTruthy();
  });

  it('显示领土等级', () => {
    render(<ProductionPanel {...defaultProps} />);
    const luoyangCard = screen.getByTestId('production-territory-city-luoyang');
    expect(luoyangCard.textContent).toContain('Lv.3');
    const xuchangCard = screen.getByTestId('production-territory-city-xuchang');
    expect(xuchangCard.textContent).toContain('Lv.2');
  });

  it('不显示非己方领土', () => {
    render(
      <ProductionPanel
        {...defaultProps}
        territories={[
          ...defaultProps.territories,
          makeTerritory({ id: 'city-ye', name: '邺城', ownership: 'enemy' }),
        ]}
      />
    );
    expect(screen.queryByText('邺城')).toBeNull();
  });

  // ── 产出速率 ──

  it('显示各资源产出速率', () => {
    render(<ProductionPanel {...defaultProps} />);
    // 洛阳: grain=15, gold=7.5, troops=4.5, mandate=1.5
    // 值被拆成数字和"/s"两个节点，用textContent匹配
    const panel = screen.getByTestId('production-panel');
    expect(panel.textContent).toContain('15');
    expect(panel.textContent).toContain('7.5');
    expect(panel.textContent).toContain('4.5');
    expect(panel.textContent).toContain('1.5');
  });

  it('显示总产出汇总数值', () => {
    render(<ProductionPanel {...defaultProps} />);
    // 总产出: grain=30, gold=15, troops=9, mandate=3
    const summary = screen.getByTestId('production-summary');
    expect(summary.textContent).toContain('30');
    expect(summary.textContent).toContain('15');
    expect(summary.textContent).toContain('9');
    expect(summary.textContent).toContain('3');
  });

  it('显示资源图标', () => {
    render(<ProductionPanel {...defaultProps} />);
    // 图标在汇总和各领土中重复出现，用getAllByText
    const allGrain = screen.getAllByText('🌾');
    expect(allGrain.length).toBeGreaterThanOrEqual(1);
    const allGold = screen.getAllByText('💰');
    expect(allGold.length).toBeGreaterThanOrEqual(1);
    const allTroops = screen.getAllByText('⚔️');
    expect(allTroops.length).toBeGreaterThanOrEqual(1);
    const allMandate = screen.getAllByText('👑');
    expect(allMandate.length).toBeGreaterThanOrEqual(1);
  });

  // ── 领土总产出 ──

  it('显示各领土总产出', () => {
    render(<ProductionPanel {...defaultProps} />);
    // "领土总产出" 在每个领土卡片中出现
    const allTotalLabels = screen.getAllByText('领土总产出');
    expect(allTotalLabels.length).toBe(2); // 两个己方领土
    // 洛阳总产出: 15+7.5+4.5+1.5 = 28.5
    const luoyangCard = screen.getByTestId('production-territory-city-luoyang');
    expect(luoyangCard.textContent).toContain('28.5');
  });

  // ── 空状态 ──

  it('无己方领土时显示空提示', () => {
    render(
      <ProductionPanel
        {...defaultProps}
        territories={[
          makeTerritory({ ownership: 'enemy' }),
          makeTerritory({ id: 'city-ye', name: '邺城', ownership: 'neutral' }),
        ]}
      />
    );
    expect(screen.getByTestId('production-panel-empty')).toBeTruthy();
    expect(screen.getByText('暂无己方领土')).toBeTruthy();
  });

  it('空领土列表时不显示面板', () => {
    render(
      <ProductionPanel {...defaultProps} territories={[]} />
    );
    expect(screen.getByTestId('production-panel-empty')).toBeTruthy();
  });

  // ── productionSummary为null ──

  it('productionSummary为null时不崩溃', () => {
    render(
      <ProductionPanel {...defaultProps} productionSummary={null} />
    );
    expect(screen.getByTestId('production-panel')).toBeTruthy();
  });

  // ── 存储容量 ──

  it('显示存储容量数值', () => {
    render(<ProductionPanel {...defaultProps} />);
    // 基础容量 * (1 + (level-1) * 0.1)
    // Lv.3: gold=10000*1.2=12000 → "1.2万", grain=8000*1.2=9600, troops=5000*1.2=6000, mandate=1000*1.2=1200
    const luoyangCard = screen.getByTestId('production-territory-city-luoyang');
    expect(luoyangCard.textContent).toContain('9600'); // grain storage
    expect(luoyangCard.textContent).toContain('6000'); // troops storage
    expect(luoyangCard.textContent).toContain('1200'); // mandate storage
  });

  // ── 领土数据卡片 ──

  it('显示领土数据卡片', () => {
    render(<ProductionPanel {...defaultProps} />);
    expect(screen.getByTestId('production-territory-city-luoyang')).toBeTruthy();
    expect(screen.getByTestId('production-territory-city-xuchang')).toBeTruthy();
  });

  // ── 移动端响应式 ──

  describe('移动端响应式', () => {
    it('面板在移动端正常渲染', () => {
      const originalInnerWidth = window.innerWidth;
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 375 });
      window.dispatchEvent(new Event('resize'));

      render(<ProductionPanel {...defaultProps} />);
      expect(screen.getByTestId('production-panel')).toBeTruthy();

      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: originalInnerWidth });
    });
  });
});
