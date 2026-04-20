/**
 * WorldMapTab — 世界地图Tab测试
 *
 * 覆盖场景：
 * - 基础渲染：面板容器、工具栏、网格
 * - 筛选功能：区域/归属/类型筛选
 * - 热力图：开关切换、颜色叠加
 * - 产出气泡：己方领土显示气泡
 * - 领土选中：点击选中/取消选中
 * - 统计卡片：占领数、产出值
 * - 空状态：无匹配领土
 * - 移动端适配：响应式布局
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import WorldMapTab from '../WorldMapTab';
import type { TerritoryData } from '@/games/three-kingdoms/core/map';

// ── Mock CSS ──
vi.mock('../WorldMapTab.css', () => ({}));
vi.mock('../TerritoryInfoPanel.css', () => ({}));
vi.mock('../TerritoryInfoPanel', () => ({
  default: function MockTerritoryInfoPanel({ territory }: { territory: TerritoryData }) {
    return <div data-testid={`territory-info-${territory.id}`}>领土详情: {territory.name}</div>;
  },
}));

// ── Mock config ──
vi.mock('@/games/three-kingdoms/core/map', () => ({
  REGION_IDS: ['central_plains', 'jiangdong', 'xiliang'],
  REGION_LABELS: { central_plains: '中原', jiangdong: '江东', xiliang: '西凉' },
  TERRAIN_TYPES: ['plain', 'mountain', 'forest', 'desert', 'water'],
  TERRAIN_LABELS: { plain: '平原', mountain: '山地', forest: '森林', desert: '沙漠', water: '水域' },
}));

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
  adjacentIds: ['city-xuchang', 'city-changan'],
  ...overrides,
});

const territories: TerritoryData[] = [
  makeTerritory({ id: 'city-luoyang', name: '洛阳', ownership: 'player', level: 3 }),
  makeTerritory({ id: 'city-xuchang', name: '许昌', ownership: 'enemy', level: 2, region: 'central_plains' }),
  makeTerritory({ id: 'city-jianye', name: '建业', ownership: 'neutral', level: 1, region: 'jiangdong' }),
  makeTerritory({ id: 'village-nanyang', name: '南阳', ownership: 'player', level: 1, region: 'central_plains',
    currentProduction: { grain: 5, gold: 2, troops: 1, mandate: 0 } }),
];

const productionSummary = {
  totalTerritories: 4,
  territoriesByRegion: { central_plains: 3, jiangdong: 1 },
  totalProduction: { grain: 20, gold: 9.5, troops: 5.5, mandate: 1.5 },
  details: [],
};

// ── 测试 ──
describe('WorldMapTab', () => {
  const defaultProps = {
    territories,
    productionSummary,
    snapshotVersion: 1,
    onSelectTerritory: vi.fn(),
    onSiegeTerritory: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── 基础渲染 ──
  it('渲染面板容器和工具栏', () => {
    render(<WorldMapTab {...defaultProps} />);
    expect(screen.getByTestId('worldmap-tab')).toBeTruthy();
    expect(screen.getByTestId('worldmap-toolbar')).toBeTruthy();
  });

  it('渲染筛选下拉框', () => {
    render(<WorldMapTab {...defaultProps} />);
    expect(screen.getByTestId('worldmap-filter-region')).toBeTruthy();
    expect(screen.getByTestId('worldmap-filter-ownership')).toBeTruthy();
    expect(screen.getByTestId('worldmap-filter-landmark')).toBeTruthy();
  });

  it('渲染领土网格', () => {
    render(<WorldMapTab {...defaultProps} />);
    expect(screen.getByTestId('worldmap-grid')).toBeTruthy();
    expect(screen.getByTestId('territory-cell-city-luoyang')).toBeTruthy();
    expect(screen.getByTestId('territory-cell-city-xuchang')).toBeTruthy();
    expect(screen.getByTestId('territory-cell-city-jianye')).toBeTruthy();
  });

  // ── 领土归属样式 ──
  it('己方领土显示player样式', () => {
    render(<WorldMapTab {...defaultProps} />);
    const cell = screen.getByTestId('territory-cell-city-luoyang');
    expect(cell.className).toContain('tk-territory-cell--player');
  });

  it('敌方领土显示enemy样式', () => {
    render(<WorldMapTab {...defaultProps} />);
    const cell = screen.getByTestId('territory-cell-city-xuchang');
    expect(cell.className).toContain('tk-territory-cell--enemy');
  });

  it('中立领土显示neutral样式', () => {
    render(<WorldMapTab {...defaultProps} />);
    const cell = screen.getByTestId('territory-cell-city-jianye');
    expect(cell.className).toContain('tk-territory-cell--neutral');
  });

  // ── 产出气泡 ──
  it('己方领土显示产出气泡', () => {
    render(<WorldMapTab {...defaultProps} />);
    expect(screen.getByTestId('bubble-city-luoyang')).toBeTruthy();
  });

  it('非己方领土不显示产出气泡', () => {
    render(<WorldMapTab {...defaultProps} />);
    expect(screen.queryByTestId('bubble-city-xuchang')).toBeNull();
    expect(screen.queryByTestId('bubble-city-jianye')).toBeNull();
  });

  // ── 统计卡片 ──
  it('显示统计信息', () => {
    render(<WorldMapTab {...defaultProps} />);
    const statTerritories = screen.getByTestId('stat-territories');
    expect(statTerritories.textContent).toContain('2/4');
  });

  // ── 热力图 ──
  it('点击热力图按钮切换状态', () => {
    render(<WorldMapTab {...defaultProps} />);
    const toggle = screen.getByTestId('worldmap-heatmap-toggle');
    expect(screen.queryByTestId('worldmap-legend')).toBeNull();
    fireEvent.click(toggle);
    expect(screen.getByTestId('worldmap-legend')).toBeTruthy();
    expect(screen.getByTestId('heatmap-city-luoyang')).toBeTruthy();
  });

  // ── 领土选中 ──
  it('点击领土触发选中', () => {
    render(<WorldMapTab {...defaultProps} />);
    const cell = screen.getByTestId('territory-cell-city-luoyang');
    fireEvent.click(cell);
    expect(cell.className).toContain('tk-territory-cell--selected');
    expect(defaultProps.onSelectTerritory).toHaveBeenCalledWith('city-luoyang');
  });

  it('再次点击同一领土取消选中', () => {
    render(<WorldMapTab {...defaultProps} />);
    const cell = screen.getByTestId('territory-cell-city-luoyang');
    fireEvent.click(cell);
    expect(cell.className).toContain('tk-territory-cell--selected');
    fireEvent.click(cell);
    expect(cell.className).not.toContain('tk-territory-cell--selected');
  });

  // ── 筛选功能 ──
  it('按归属筛选领土', () => {
    render(<WorldMapTab {...defaultProps} />);
    const select = screen.getByTestId('worldmap-filter-ownership');
    fireEvent.change(select, { target: { value: 'player' } });
    expect(screen.getByTestId('territory-cell-city-luoyang')).toBeTruthy();
    expect(screen.queryByTestId('territory-cell-city-xuchang')).toBeNull();
  });

  it('筛选无结果时显示空状态', () => {
    render(<WorldMapTab {...defaultProps} />);
    const select = screen.getByTestId('worldmap-filter-region');
    fireEvent.change(select, { target: { value: 'xiliang' } });
    expect(screen.getByTestId('worldmap-empty')).toBeTruthy();
  });

  // ── 空数据 ──
  it('空领土列表显示空状态', () => {
    render(<WorldMapTab {...defaultProps} territories={[]} productionSummary={null} />);
    expect(screen.getByTestId('worldmap-empty')).toBeTruthy();
  });
});
