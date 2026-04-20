/**
 * ArenaPanel 组件测试
 *
 * 覆盖：渲染、段位显示、赛季信息、对手列表、挑战、刷新
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ArenaPanel } from '../ArenaPanel';
import type { ArenaPlayerState, ArenaOpponent, SeasonData } from '../../../../core/pvp/pvp.types';

// ── Fixtures ──

const mockOpponent: ArenaOpponent = {
  playerId: 'p2',
  playerName: '曹操',
  power: 8000,
  rankId: 'GOLD_III',
  score: 1500,
  ranking: 5,
  faction: 'wei',
  defenseSnapshot: null,
};

const mockPlayerState: ArenaPlayerState = {
  score: 1200,
  rankId: 'SILVER_I',
  ranking: 12,
  dailyChallengesLeft: 3,
  dailyBoughtChallenges: 1,
  dailyManualRefreshes: 0,
  lastFreeRefreshTime: 0,
  opponents: [mockOpponent],
  defenseFormation: {
    slots: ['', '', '', '', ''],
    formation: 'FISH_SCALE' as any,
    strategy: 'BALANCED' as any,
  },
  defenseLogs: [],
  replays: [],
  arenaCoins: 500,
};

const mockSeasonData: SeasonData = {
  seasonId: 'S1',
  startTime: Date.now() - 10 * 24 * 3600 * 1000,
  endTime: Date.now() + 18 * 24 * 3600 * 1000,
  currentDay: 10,
  isSettled: false,
};

describe('ArenaPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── 渲染 ──

  it('渲染竞技场面板', () => {
    render(<ArenaPanel playerState={mockPlayerState} seasonData={mockSeasonData} />);
    expect(screen.getByRole('region', { name: '竞技场' })).toBeInTheDocument();
  });

  it('playerState=null 显示加载中', () => {
    render(<ArenaPanel playerState={null} seasonData={null} />);
    expect(screen.getByText('加载中...')).toBeInTheDocument();
  });

  // ── 段位显示 ──

  it('显示当前段位', () => {
    render(<ArenaPanel playerState={mockPlayerState} seasonData={null} />);
    expect(screen.getByText(/白银/)).toBeInTheDocument();
    expect(screen.getByText(/白银 I/)).toBeInTheDocument();
  });

  it('显示积分', () => {
    render(<ArenaPanel playerState={mockPlayerState} seasonData={null} />);
    expect(screen.getByText(/积分：1200/)).toBeInTheDocument();
  });

  it('显示排名', () => {
    render(<ArenaPanel playerState={mockPlayerState} seasonData={null} />);
    expect(screen.getByText(/排名 #12/)).toBeInTheDocument();
  });

  // ── 赛季信息 ──

  it('显示赛季信息', () => {
    render(<ArenaPanel playerState={mockPlayerState} seasonData={mockSeasonData} />);
    expect(screen.getByText(/赛季 S1/)).toBeInTheDocument();
    expect(screen.getByText(/第10天/)).toBeInTheDocument();
  });

  // ── 挑战次数 ──

  it('显示剩余挑战次数', () => {
    render(<ArenaPanel playerState={mockPlayerState} seasonData={null} />);
    expect(screen.getByText(/剩余 3 次/)).toBeInTheDocument();
  });

  it('显示已购买次数', () => {
    render(<ArenaPanel playerState={mockPlayerState} seasonData={null} />);
    expect(screen.getByText(/已购买 1 次/)).toBeInTheDocument();
  });

  // ── 对手列表 ──

  it('显示对手信息', () => {
    render(<ArenaPanel playerState={mockPlayerState} seasonData={null} />);
    expect(screen.getByText('曹操')).toBeInTheDocument();
    expect(screen.getByText(/8000/)).toBeInTheDocument();
  });

  it('点击挑战按钮触发 onChallenge', () => {
    const onChallenge = vi.fn();
    render(<ArenaPanel playerState={mockPlayerState} seasonData={null} onChallenge={onChallenge} />);
    fireEvent.click(screen.getByText('挑战'));
    expect(onChallenge).toHaveBeenCalledWith('p2');
  });

  // ── 刷新 ──

  it('点击刷新按钮触发 onRefresh', () => {
    const onRefresh = vi.fn();
    render(<ArenaPanel playerState={mockPlayerState} seasonData={null} onRefresh={onRefresh} />);
    fireEvent.click(screen.getByText('🔄 刷新'));
    expect(onRefresh).toHaveBeenCalled();
  });

  // ── 空对手 ──

  it('无对手时显示提示', () => {
    const emptyState = { ...mockPlayerState, opponents: [] };
    render(<ArenaPanel playerState={emptyState} seasonData={null} />);
    expect(screen.getByText('暂无对手，请刷新')).toBeInTheDocument();
  });

  // ── 竞技币 ──

  it('显示竞技币余额', () => {
    render(<ArenaPanel playerState={mockPlayerState} seasonData={null} />);
    expect(screen.getByText(/竞技币：500/)).toBeInTheDocument();
  });
});
