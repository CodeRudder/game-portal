/**
 * ExpeditionPanel 组件测试
 *
 * 覆盖：渲染、路线列表、区域分组、队伍选择、节点进度、出发按钮
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ExpeditionPanel } from '../ExpeditionPanel';
import { NodeStatus, NodeType, RouteDifficulty } from '../../../core/expedition/expedition.types';
import type {
  ExpeditionRoute,
  ExpeditionRegion,
  ExpeditionTeam,
} from '../../../core/expedition/expedition.types';

// ── Fixtures ──

const mockNodes: Record<string, any> = {
  n1: { id: 'n1', type: NodeType.BANDIT, name: '山贼营地', status: NodeStatus.CLEARED, nextNodeIds: ['n2'], recommendedPower: 1000 },
  n2: { id: 'n2', type: NodeType.BOSS, name: 'Boss关卡', status: NodeStatus.LOCKED, nextNodeIds: [], recommendedPower: 2000 },
};

const mockRoute: ExpeditionRoute = {
  id: 'r1',
  name: '官渡之战',
  regionId: 'reg1',
  difficulty: RouteDifficulty.NORMAL,
  startNodeId: 'n1',
  endNodeId: 'n2',
  nodes: mockNodes,
  powerMultiplier: 1.5,
  marchDurationSeconds: 600,
  unlocked: true,
};

const lockedRoute: ExpeditionRoute = {
  ...mockRoute,
  id: 'r2',
  name: '赤壁之战',
  unlocked: false,
};

const mockRegion: ExpeditionRegion = {
  id: 'reg1',
  name: '中原',
  order: 1,
  routeIds: ['r1', 'r2'],
};

const mockTeam: ExpeditionTeam = {
  id: 't1',
  name: '先锋队',
  heroIds: ['h1', 'h2'],
  formation: 'FISH_SCALE' as any,
  troopCount: 100,
  maxTroops: 200,
  totalPower: 5000,
  currentRouteId: null,
  currentNodeId: null,
  isExpeditioning: false,
};

describe('ExpeditionPanel', () => {
  const defaultProps = {
    routes: [mockRoute, lockedRoute],
    regions: [mockRegion],
    teams: [mockTeam],
    unlockedSlots: 1,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── 渲染 ──

  it('渲染远征面板', () => {
    render(<ExpeditionPanel {...defaultProps} />);
    expect(screen.getByRole('region', { name: '远征面板' })).toBeInTheDocument();
  });

  it('显示标题', () => {
    render(<ExpeditionPanel {...defaultProps} />);
    expect(screen.getByText('🗺️ 远征天下')).toBeInTheDocument();
  });

  // ── 区域分组 ──

  it('显示区域名称', () => {
    render(<ExpeditionPanel {...defaultProps} />);
    expect(screen.getByText('中原')).toBeInTheDocument();
  });

  // ── 路线卡片 ──

  it('显示路线名称', () => {
    render(<ExpeditionPanel {...defaultProps} />);
    expect(screen.getByText('官渡之战')).toBeInTheDocument();
    expect(screen.getByText('赤壁之战')).toBeInTheDocument();
  });

  it('显示难度标签', () => {
    render(<ExpeditionPanel {...defaultProps} />);
    expect(screen.getAllByText('普通').length).toBeGreaterThanOrEqual(1);
  });

  it('未解锁路线显示标记', () => {
    render(<ExpeditionPanel {...defaultProps} />);
    expect(screen.getByText('🔒 未解锁')).toBeInTheDocument();
  });

  // ── 路线选择 ──

  it('点击路线触发 onRouteSelect', () => {
    const onRouteSelect = vi.fn();
    render(<ExpeditionPanel {...defaultProps} onRouteSelect={onRouteSelect} />);
    fireEvent.click(screen.getByText('官渡之战'));
    expect(onRouteSelect).toHaveBeenCalledWith('r1');
  });

  it('选择路线后显示节点详情', () => {
    render(<ExpeditionPanel {...defaultProps} />);
    fireEvent.click(screen.getByText('官渡之战'));
    expect(screen.getByText('山贼营地')).toBeInTheDocument();
    expect(screen.getByText('Boss关卡')).toBeInTheDocument();
  });

  // ── 队伍选择 ──

  it('显示队伍信息', () => {
    render(<ExpeditionPanel {...defaultProps} />);
    expect(screen.getByText('先锋队')).toBeInTheDocument();
  });

  // ── 出发按钮 ──

  it('渲染出发按钮', () => {
    render(<ExpeditionPanel {...defaultProps} />);
    expect(screen.getByText('🚀 出发远征')).toBeInTheDocument();
  });

  it('选择路线和队伍后点击出发触发回调', () => {
    const onStart = vi.fn();
    render(<ExpeditionPanel {...defaultProps} onStartExpedition={onStart} />);
    // Select route
    fireEvent.click(screen.getByText('官渡之战'));
    // Select team
    fireEvent.click(screen.getByText('先锋队'));
    // Click start
    fireEvent.click(screen.getByText('🚀 出发远征'));
    expect(onStart).toHaveBeenCalledWith('r1', 't1');
  });

  // ── 无障碍 ──

  it('路线卡片具有 aria-label', () => {
    render(<ExpeditionPanel {...defaultProps} />);
    expect(screen.getByLabelText(/官渡之战/)).toBeInTheDocument();
  });
});
