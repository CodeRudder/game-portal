/**
 * OfflineRewardModal — 离线奖励弹窗测试
 *
 * 覆盖场景：
 * - 弹窗渲染：标题、离线时长显示
 * - 资源奖励汇总：金币/粮草/兵力分别显示
 * - 事件列表：离线事件正确展示
 * - 领取按钮：点击触发onClaim回调
 * - 关闭按钮：点击触发onClose回调
 * - 24小时上限：超时时显示上限提示
 * - 短离线：无事件时显示空提示
 * - 事件统计：各类型事件计数
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import OfflineRewardModal from '../OfflineRewardModal';
import type { OfflineEvent } from '@/games/three-kingdoms/engine/map/OfflineEventSystem';

// ── Mock CSS ──
vi.mock('../../../../components/SharedPanel.css', () => ({}));

// ── 测试数据 ──

const makeResourceEvent = (overrides: Partial<OfflineEvent> = {}): OfflineEvent => ({
  id: 'evt-resource-1',
  type: 'resource_accumulate',
  cityId: 'city-luoyang',
  timestamp: Date.now(),
  description: 'gold +500',
  data: { resource: 'gold', amount: 500, duration: 3600 },
  processed: false,
  ...overrides,
});

const makeBanditEvent = (overrides: Partial<OfflineEvent> = {}): OfflineEvent => ({
  id: 'evt-bandit-1',
  type: 'bandit_raid',
  cityId: 'city-luoyang',
  timestamp: Date.now(),
  description: '山贼袭击! 损失80兵力, 150金币',
  data: { troopsLost: 80, goldLost: 150 },
  processed: false,
  ...overrides,
});

const makeCaravanEvent = (overrides: Partial<OfflineEvent> = {}): OfflineEvent => ({
  id: 'evt-caravan-1',
  type: 'caravan_visit',
  cityId: 'city-luoyang',
  timestamp: Date.now(),
  description: '商队经过, 获得350金币',
  data: { goldGained: 350 },
  processed: false,
  ...overrides,
});

const makeRefugeeEvent = (overrides: Partial<OfflineEvent> = {}): OfflineEvent => ({
  id: 'evt-refugee-1',
  type: 'refugee_arrival',
  cityId: 'city-luoyang',
  timestamp: Date.now(),
  description: '流民涌入, 获得40兵力, 消耗80粮草',
  data: { troopsGained: 40, grainCost: 80 },
  processed: false,
  ...overrides,
});

const defaultProps = {
  visible: true,
  offlineDuration: 3600000, // 1小时
  events: [
    makeResourceEvent(),
    makeResourceEvent({ id: 'evt-resource-2', description: 'grain +300', data: { resource: 'grain', amount: 300, duration: 3600 } }),
    makeCaravanEvent(),
  ],
  onClaim: vi.fn(),
  onClose: vi.fn(),
};

describe('OfflineRewardModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── 基础渲染 ──

  it('visible=false时不渲染', () => {
    const { container } = render(
      <OfflineRewardModal {...defaultProps} visible={false} />
    );
    expect(container.innerHTML).toBe('');
  });

  it('显示弹窗标题', () => {
    render(<OfflineRewardModal {...defaultProps} />);
    expect(screen.getByText('离线奖励')).toBeTruthy();
  });

  it('显示离线时长(小时+分钟)', () => {
    // 1小时30分
    render(
      <OfflineRewardModal {...defaultProps} offlineDuration={5400000} />
    );
    expect(screen.getByTestId('offline-duration')).toBeTruthy();
    expect(screen.getByText(/1小时30分/)).toBeTruthy();
  });

  it('只有分钟时显示分钟', () => {
    render(
      <OfflineRewardModal {...defaultProps} offlineDuration={300000} />
    );
    expect(screen.getByText(/5分/)).toBeTruthy();
  });

  it('只有小时时显示小时', () => {
    render(
      <OfflineRewardModal {...defaultProps} offlineDuration={7200000} />
    );
    expect(screen.getByText(/2小时/)).toBeTruthy();
  });

  // ── 资源奖励汇总 ──

  it('显示资源奖励区域', () => {
    render(<OfflineRewardModal {...defaultProps} />);
    expect(screen.getByTestId('offline-rewards-summary')).toBeTruthy();
  });

  it('显示金币奖励', () => {
    render(<OfflineRewardModal {...defaultProps} />);
    expect(screen.getByText('金币')).toBeTruthy();
    // gold: 500 (resource_accumulate) + 350 (caravan) = 850
    expect(screen.getByText('+850')).toBeTruthy();
  });

  it('显示粮草奖励', () => {
    render(<OfflineRewardModal {...defaultProps} />);
    expect(screen.getByText('粮草')).toBeTruthy();
    expect(screen.getByText('+300')).toBeTruthy();
  });

  it('无净奖励时显示空提示', () => {
    render(
      <OfflineRewardModal
        {...defaultProps}
        events={[makeBanditEvent()]}
      />
    );
    expect(screen.getByText('离线期间无资源奖励')).toBeTruthy();
  });

  // ── 事件列表 ──

  it('显示事件列表', () => {
    render(<OfflineRewardModal {...defaultProps} />);
    expect(screen.getByTestId('offline-events-list')).toBeTruthy();
  });

  it('显示事件数量', () => {
    render(<OfflineRewardModal {...defaultProps} />);
    expect(screen.getByText(/离线事件 \(3\)/)).toBeTruthy();
  });

  it('显示事件描述', () => {
    render(<OfflineRewardModal {...defaultProps} />);
    expect(screen.getByText('gold +500')).toBeTruthy();
    expect(screen.getByText('商队经过, 获得350金币')).toBeTruthy();
  });

  it('无事件时不显示事件列表', () => {
    render(
      <OfflineRewardModal {...defaultProps} events={[]} />
    );
    expect(screen.queryByTestId('offline-events-list')).toBeNull();
  });

  // ── 事件统计 ──

  it('显示事件统计', () => {
    render(<OfflineRewardModal {...defaultProps} />);
    expect(screen.getByTestId('offline-event-stats')).toBeTruthy();
  });

  it('显示事件类型计数', () => {
    render(<OfflineRewardModal {...defaultProps} />);
    // 2个resource_accumulate, 1个caravan_visit
    expect(screen.getByText('x2')).toBeTruthy();
  });

  // ── 领取按钮 ──

  it('显示领取按钮', () => {
    render(<OfflineRewardModal {...defaultProps} />);
    expect(screen.getByTestId('offline-reward-claim')).toBeTruthy();
    expect(screen.getByText('领取奖励')).toBeTruthy();
  });

  it('点击领取按钮触发onClaim', () => {
    render(<OfflineRewardModal {...defaultProps} />);
    fireEvent.click(screen.getByTestId('offline-reward-claim'));
    expect(defaultProps.onClaim).toHaveBeenCalledTimes(1);
  });

  // ── 关闭按钮 ──

  it('点击关闭触发onClose', () => {
    render(<OfflineRewardModal {...defaultProps} />);
    const closeBtn = screen.getByLabelText('关闭面板');
    fireEvent.click(closeBtn);
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  // ── 24小时上限 ──

  it('超过24小时显示上限提示', () => {
    const twentyFiveHours = 25 * 60 * 60 * 1000;
    render(
      <OfflineRewardModal {...defaultProps} offlineDuration={twentyFiveHours} />
    );
    expect(screen.getByText(/已按24小时上限计算/)).toBeTruthy();
    // 24小时出现在标题和提示两处
    const allMatches = screen.getAllByText(/24小时/);
    expect(allMatches.length).toBeGreaterThanOrEqual(1);
  });

  // ── 各类事件渲染 ──

  it('显示山贼袭击事件', () => {
    render(
      <OfflineRewardModal
        {...defaultProps}
        events={[makeBanditEvent()]}
      />
    );
    // 山贼袭击出现在事件类型标签和事件统计中
    const allBandit = screen.getAllByText('山贼袭击');
    expect(allBandit.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('山贼袭击! 损失80兵力, 150金币')).toBeTruthy();
  });

  it('显示流民涌入事件', () => {
    render(
      <OfflineRewardModal
        {...defaultProps}
        events={[makeRefugeeEvent()]}
      />
    );
    // 流民涌入出现在事件类型标签和事件统计中
    const allRefugee = screen.getAllByText('流民涌入');
    expect(allRefugee.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('流民涌入, 获得40兵力, 消耗80粮草')).toBeTruthy();
  });

  // ── 移动端响应式 ──

  describe('移动端响应式', () => {
    it('弹窗在移动端正常渲染', () => {
      const originalInnerWidth = window.innerWidth;
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 375 });
      window.dispatchEvent(new Event('resize'));

      render(<OfflineRewardModal {...defaultProps} />);
      expect(screen.getByTestId('offline-reward-modal')).toBeTruthy();

      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: originalInnerWidth });
    });
  });
});
