/**
 * ArmyPanel 组件测试
 *
 * 覆盖：渲染、总战力、编队列表、武将显示、兵力信息
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ArmyPanel } from '../ArmyPanel';

// ── Mock GameContext ──

const mockFormations = [
  { id: 'f1', slots: ['h1', 'h2', '', '', '', ''], name: '编队1', isActive: true },
  { id: 'f2', slots: ['h3', '', '', '', '', ''], name: '编队2', isActive: false },
];

const mockGetFormations = vi.fn(() => [
  { id: 'f1', slots: ['h1', 'h2', '', '', '', ''], name: '编队1' },
  { id: 'f2', slots: ['h3', '', '', '', '', ''], name: '编队2' },
]);

const mockGetActiveFormation = vi.fn(() => ({ id: 'f1', slots: ['h1', 'h2', '', '', '', ''], name: '编队1' }));

vi.mock('../../context/GameContext', () => ({
  useGameContext: () => ({
    engine: {
      getFormations: mockGetFormations,
      getActiveFormation: mockGetActiveFormation,
    },
    snapshot: {
      resources: { grain: 1000, gold: 500, troops: 2000, mandate: 50 },
      productionRates: { grain: 10, gold: 5, troops: 2, mandate: 0.5 },
      caps: { grain: 10000, gold: null, troops: 5000, mandate: null },
      buildings: {},
      onlineSeconds: 100,
      calendar: {},
      heroes: [
        { id: 'h1', name: '关羽', faction: 'shu', power: 5000, baseStats: { attack: 2000, defense: 1500, intelligence: 1000, speed: 500 } },
        { id: 'h2', name: '张飞', faction: 'shu', power: 4000, baseStats: { attack: 1800, defense: 1200, intelligence: 600, speed: 400 } },
        { id: 'h3', name: '赵云', faction: 'shu', power: 4500, baseStats: { attack: 1900, defense: 1300, intelligence: 800, speed: 500 } },
      ],
      heroFragments: {},
      totalPower: 13500,
      formations: [],
      activeFormationId: 'f1',
      campaignProgress: {},
      techState: {},
    },
  }),
}));

describe('ArmyPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── 渲染 ──

  it('渲染军队面板', () => {
    render(<ArmyPanel />);
    expect(screen.getByRole('region', { name: '军队面板' })).toBeInTheDocument();
  });

  // ── 总战力 ──

  it('显示全军战力', () => {
    render(<ArmyPanel />);
    expect(screen.getByText('全军战力')).toBeInTheDocument();
    expect(screen.getByText(/1.4万/)).toBeInTheDocument(); // 13500
  });

  // ── 编队列表 ──

  it('显示编队管理标题', () => {
    render(<ArmyPanel />);
    expect(screen.getByText('编队管理')).toBeInTheDocument();
  });

  it('显示编队卡片', () => {
    render(<ArmyPanel />);
    // Should have formation cards
    expect(screen.getByText('当前编队')).toBeInTheDocument();
  });

  // ── 武将显示 ──

  it('显示武将名称', () => {
    render(<ArmyPanel />);
    expect(screen.getByText('关羽')).toBeInTheDocument();
    expect(screen.getByText('张飞')).toBeInTheDocument();
    expect(screen.getByText('赵云')).toBeInTheDocument();
  });

  // ── 兵力信息 ──

  it('显示兵力信息', () => {
    render(<ArmyPanel />);
    expect(screen.getByText(/兵力/)).toBeInTheDocument();
  });

  // ── 回调 ──

  it('点击编队触发 onFormationSelect', () => {
    const onSelect = vi.fn();
    render(<ArmyPanel onFormationSelect={onSelect} />);
    const cards = screen.getAllByRole('button');
    fireEvent.click(cards[0]);
    expect(onSelect).toHaveBeenCalled();
  });

  // ── 无障碍 ──

  it('具有 aria-label', () => {
    render(<ArmyPanel />);
    expect(screen.getByRole('region', { name: '军队面板' })).toBeInTheDocument();
  });
});
