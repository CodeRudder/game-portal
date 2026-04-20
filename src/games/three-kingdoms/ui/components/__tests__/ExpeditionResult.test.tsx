/**
 * ExpeditionResult 组件测试
 *
 * 覆盖：渲染、评级显示、奖励列表、掉落物品、发现、继续远征
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ExpeditionResult } from '../ExpeditionResult';
import { BattleGrade } from '../../../core/expedition/expedition.types';
import type {
  ExpeditionBattleResult,
  ExpeditionReward,
  DropItem,
} from '../../../core/expedition/expedition.types';

// ── Fixtures ──

const greatVictory: ExpeditionBattleResult = {
  grade: BattleGrade.GREAT_VICTORY,
  stars: 3,
  totalTurns: 4,
  allyHpPercent: 75,
  allyDeaths: 0,
  expGained: 500,
};

const narrowDefeat: ExpeditionBattleResult = {
  grade: BattleGrade.NARROW_DEFEAT,
  stars: 0,
  totalTurns: 10,
  allyHpPercent: 5,
  allyDeaths: 2,
  expGained: 100,
};

const mockReward: ExpeditionReward = {
  grain: 2000,
  gold: 1000,
  iron: 500,
  equipFragments: 10,
  exp: 500,
  drops: [
    { type: 'equip_fragment', id: 'd1', name: '紫色碎片', count: 3 },
    { type: 'hero_fragment', id: 'd2', name: '关羽碎片', count: 1 },
  ],
};

const mockDiscoveries: DropItem[] = [
  { type: 'rare_material', id: 'disc1', name: '玄铁', count: 2 },
];

describe('ExpeditionResult', () => {
  const defaultProps = {
    isOpen: true,
    battleResult: greatVictory,
    reward: mockReward,
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── 渲染 ──

  it('isOpen=true 时渲染', () => {
    render(<ExpeditionResult {...defaultProps} />);
    expect(screen.getByRole('region', { name: '远征结果' })).toBeInTheDocument();
  });

  it('isOpen=false 时不渲染', () => {
    render(<ExpeditionResult {...defaultProps} isOpen={false} />);
    expect(screen.queryByRole('region', { name: '远征结果' })).not.toBeInTheDocument();
  });

  // ── 评级 ──

  it('显示评级标签', () => {
    render(<ExpeditionResult {...defaultProps} />);
    expect(screen.getByText('大捷')).toBeInTheDocument();
  });

  it('显示星级', () => {
    render(<ExpeditionResult {...defaultProps} />);
    // 3 stars, all should be visible
    const stars = screen.getAllByText('⭐');
    expect(stars.length).toBe(3);
  });

  it('显示回合数', () => {
    render(<ExpeditionResult {...defaultProps} />);
    expect(screen.getByText('回合数：4')).toBeInTheDocument();
  });

  it('失败时显示惜败', () => {
    render(<ExpeditionResult {...defaultProps} battleResult={narrowDefeat} />);
    expect(screen.getByText('惜败')).toBeInTheDocument();
  });

  it('有阵亡时显示阵亡数', () => {
    render(<ExpeditionResult {...defaultProps} battleResult={narrowDefeat} />);
    expect(screen.getByText('阵亡：2')).toBeInTheDocument();
  });

  // ── 奖励 ──

  it('显示奖励区域', () => {
    render(<ExpeditionResult {...defaultProps} />);
    expect(screen.getByText('🎁 远征奖励')).toBeInTheDocument();
  });

  it('显示各资源奖励', () => {
    render(<ExpeditionResult {...defaultProps} />);
    expect(screen.getByText('粮草')).toBeInTheDocument();
    expect(screen.getByText('铜钱')).toBeInTheDocument();
    expect(screen.getByText('铁矿')).toBeInTheDocument();
  });

  // ── 掉落物品 ──

  it('显示战利品区域', () => {
    render(<ExpeditionResult {...defaultProps} />);
    expect(screen.getByText('✨ 战利品')).toBeInTheDocument();
  });

  it('显示掉落物品名称', () => {
    render(<ExpeditionResult {...defaultProps} />);
    expect(screen.getByText('紫色碎片')).toBeInTheDocument();
    expect(screen.getByText('关羽碎片')).toBeInTheDocument();
  });

  it('显示掉落数量', () => {
    render(<ExpeditionResult {...defaultProps} />);
    expect(screen.getByText('×3')).toBeInTheDocument();
    expect(screen.getByText('×1')).toBeInTheDocument();
  });

  // ── 特殊发现 ──

  it('显示特殊发现区域', () => {
    render(<ExpeditionResult {...defaultProps} discoveries={mockDiscoveries} />);
    expect(screen.getByText('🔍 特殊发现')).toBeInTheDocument();
    expect(screen.getByText('玄铁')).toBeInTheDocument();
  });

  // ── 操作按钮 ──

  it('显示返回按钮', () => {
    render(<ExpeditionResult {...defaultProps} />);
    expect(screen.getByText('返回')).toBeInTheDocument();
  });

  it('胜利且有 onContinue 时显示继续按钮', () => {
    const onContinue = vi.fn();
    render(<ExpeditionResult {...defaultProps} onContinue={onContinue} />);
    expect(screen.getByText('继续远征')).toBeInTheDocument();
  });

  it('点击继续触发 onContinue 和 onClose', () => {
    const onContinue = vi.fn();
    const onClose = vi.fn();
    render(<ExpeditionResult {...defaultProps} onContinue={onContinue} onClose={onClose} />);
    fireEvent.click(screen.getByText('继续远征'));
    expect(onContinue).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('失败时不显示继续按钮', () => {
    render(<ExpeditionResult {...defaultProps} battleResult={narrowDefeat} />);
    expect(screen.queryByText('继续远征')).not.toBeInTheDocument();
  });

  it('点击返回触发 onClose', () => {
    const onClose = vi.fn();
    render(<ExpeditionResult {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByText('返回'));
    expect(onClose).toHaveBeenCalled();
  });
});
