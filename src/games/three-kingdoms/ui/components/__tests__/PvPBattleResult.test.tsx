/**
 * PvPBattleResult 组件测试
 *
 * 覆盖：渲染、胜利/失败状态、积分变化、超时、再来一次
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PvPBattleResult } from '../PvPBattleResult';
import type { PvPBattleResult as PvPBattleResultType } from '../../../../core/pvp/pvp.types';

// ── Fixtures ──

const victoryResult: PvPBattleResultType = {
  battleId: 'b1',
  attackerId: 'p1',
  defenderId: 'p2',
  attackerWon: true,
  scoreChange: 45,
  attackerNewScore: 1245,
  defenderNewScore: 1155,
  totalTurns: 6,
  isTimeout: false,
  battleState: null,
};

const defeatResult: PvPBattleResultType = {
  ...victoryResult,
  attackerWon: false,
  scoreChange: -20,
  attackerNewScore: 1180,
  defenderNewScore: 1220,
};

const timeoutResult: PvPBattleResultType = {
  ...victoryResult,
  isTimeout: true,
};

describe('PvPBattleResult', () => {
  const defaultProps = {
    isOpen: true,
    result: victoryResult,
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── 渲染 ──

  it('isOpen=true 时渲染', () => {
    render(<PvPBattleResult {...defaultProps} />);
    expect(screen.getByRole('region', { name: 'PvP战斗结果' })).toBeInTheDocument();
  });

  it('isOpen=false 时不渲染', () => {
    render(<PvPBattleResult {...defaultProps} isOpen={false} />);
    expect(screen.queryByRole('region', { name: 'PvP战斗结果' })).not.toBeInTheDocument();
  });

  it('result=null 时不渲染', () => {
    render(<PvPBattleResult {...defaultProps} result={null} />);
    expect(screen.queryByRole('region', { name: 'PvP战斗结果' })).not.toBeInTheDocument();
  });

  // ── 胜利 ──

  it('胜利时显示胜利标题', () => {
    render(<PvPBattleResult {...defaultProps} />);
    expect(screen.getByText('🎉 胜利')).toBeInTheDocument();
  });

  it('胜利时显示"大获全胜"', () => {
    render(<PvPBattleResult {...defaultProps} />);
    expect(screen.getByText('大获全胜')).toBeInTheDocument();
  });

  it('胜利时显示正积分变化', () => {
    render(<PvPBattleResult {...defaultProps} />);
    expect(screen.getByText('+45')).toBeInTheDocument();
  });

  // ── 失败 ──

  it('失败时显示失败标题', () => {
    render(<PvPBattleResult {...defaultProps} result={defeatResult} />);
    expect(screen.getByText('💀 失败')).toBeInTheDocument();
  });

  it('失败时显示"惜败而归"', () => {
    render(<PvPBattleResult {...defaultProps} result={defeatResult} />);
    expect(screen.getByText('惜败而归')).toBeInTheDocument();
  });

  it('失败时显示负积分变化', () => {
    render(<PvPBattleResult {...defaultProps} result={defeatResult} />);
    expect(screen.getByText('-20')).toBeInTheDocument();
  });

  // ── 战斗详情 ──

  it('显示战斗回合数', () => {
    render(<PvPBattleResult {...defaultProps} />);
    expect(screen.getByText('6 回合')).toBeInTheDocument();
  });

  it('显示当前积分', () => {
    render(<PvPBattleResult {...defaultProps} />);
    expect(screen.getByText('1245')).toBeInTheDocument();
  });

  it('显示对手积分', () => {
    render(<PvPBattleResult {...defaultProps} />);
    expect(screen.getByText('1155')).toBeInTheDocument();
  });

  // ── 超时 ──

  it('超时时显示超时标签', () => {
    render(<PvPBattleResult {...defaultProps} result={timeoutResult} />);
    expect(screen.getByText('超时')).toBeInTheDocument();
  });

  // ── 操作按钮 ──

  it('点击返回触发 onClose', () => {
    const onClose = vi.fn();
    render(<PvPBattleResult {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByText('返回'));
    expect(onClose).toHaveBeenCalled();
  });

  it('有 onRetry 时显示"再来一次"按钮', () => {
    const onRetry = vi.fn();
    render(<PvPBattleResult {...defaultProps} onRetry={onRetry} />);
    expect(screen.getByText('再来一次')).toBeInTheDocument();
  });

  it('点击"再来一次"触发 onRetry 和 onClose', () => {
    const onRetry = vi.fn();
    const onClose = vi.fn();
    render(<PvPBattleResult {...defaultProps} onRetry={onRetry} onClose={onClose} />);
    fireEvent.click(screen.getByText('再来一次'));
    expect(onRetry).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});
