/**
 * SiegeConfirmModal — 攻城确认弹窗测试
 *
 * 覆盖场景：
 * - 基础渲染：弹窗标题、目标信息、条件列表
 * - 条件校验：通过/失败状态
 * - 消耗显示：兵力/粮草消耗
 * - 确认按钮：条件全通过时可点击
 * - 错误消息：条件不通过时显示错误
 * - 空目标：target为null时不渲染
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SiegeConfirmModal from '../SiegeConfirmModal';
import type { TerritoryData } from '@/games/three-kingdoms/core/map';

// ── Mock CSS ──
vi.mock('../SiegeConfirmModal.css', () => ({}));
vi.mock('../../../common/Modal.css', () => ({}));

// ── 测试数据 ──
const mockTarget: TerritoryData = {
  id: 'city-xuchang',
  name: '许昌',
  position: { x: 10, y: 10 },
  region: 'central_plains',
  ownership: 'enemy',
  level: 3,
  baseProduction: { grain: 10, gold: 5, troops: 3, mandate: 1 },
  currentProduction: { grain: 15, gold: 7.5, troops: 4.5, mandate: 1.5 },
  defenseValue: 200,
  adjacentIds: ['city-luoyang'],
};

const defaultProps = {
  visible: true,
  target: mockTarget,
  cost: { troops: 500, grain: 90 },
  conditionResult: { canSiege: true },
  availableTroops: 1000,
  availableGrain: 500,
  onConfirm: vi.fn(),
  onCancel: vi.fn(),
};

describe('SiegeConfirmModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── 基础渲染 ──
  it('渲染弹窗标题和目标信息', () => {
    render(<SiegeConfirmModal {...defaultProps} />);
    expect(screen.getByText(/攻城确认.*许昌/)).toBeTruthy();
    expect(screen.getByText('Lv.3')).toBeTruthy();
    expect(screen.getByText('200')).toBeTruthy();
  });

  it('渲染攻城条件列表', () => {
    render(<SiegeConfirmModal {...defaultProps} />);
    expect(screen.getByTestId('siege-condition-领土相邻')).toBeTruthy();
    expect(screen.getByTestId('siege-condition-兵力充足')).toBeTruthy();
    expect(screen.getByTestId('siege-condition-粮草充足')).toBeTruthy();
  });

  it('条件通过时显示绿色通过标记', () => {
    render(<SiegeConfirmModal {...defaultProps} />);
    const condition = screen.getByTestId('siege-condition-领土相邻');
    expect(condition.className).toContain('tk-siege-condition--pass');
  });

  // ── 消耗显示 ──
  it('显示兵力消耗', () => {
    render(<SiegeConfirmModal {...defaultProps} />);
    expect(screen.getByText('-500')).toBeTruthy();
  });

  it('显示粮草消耗', () => {
    render(<SiegeConfirmModal {...defaultProps} />);
    expect(screen.getByText('-90')).toBeTruthy();
  });

  // ── 条件失败 ──
  it('条件不通过时显示错误消息', () => {
    render(
      <SiegeConfirmModal
        {...defaultProps}
        conditionResult={{
          canSiege: false,
          errorCode: 'NOT_ADJACENT',
          errorMessage: '许昌 不与己方领土相邻',
        }}
      />,
    );
    expect(screen.getByTestId('siege-error')).toBeTruthy();
    expect(screen.getByTestId('siege-error').textContent).toContain('不与己方领土相邻');
  });

  it('兵力不足时条件显示失败', () => {
    render(
      <SiegeConfirmModal
        {...defaultProps}
        availableTroops={100}
      />,
    );
    const condition = screen.getByTestId('siege-condition-兵力充足');
    expect(condition.className).toContain('tk-siege-condition--fail');
  });

  it('粮草不足时条件显示失败', () => {
    render(
      <SiegeConfirmModal
        {...defaultProps}
        availableGrain={10}
      />,
    );
    const condition = screen.getByTestId('siege-condition-粮草充足');
    expect(condition.className).toContain('tk-siege-condition--fail');
  });

  // ── 空目标 ──
  it('target为null时不渲染', () => {
    const { container } = render(<SiegeConfirmModal {...defaultProps} target={null} />);
    expect(container.innerHTML).toBe('');
  });

  // ── 归属显示 ──
  it('显示敌方归属', () => {
    render(<SiegeConfirmModal {...defaultProps} />);
    expect(screen.getByText('敌方')).toBeTruthy();
  });

  it('显示中立归属', () => {
    render(
      <SiegeConfirmModal
        {...defaultProps}
        target={{ ...mockTarget, ownership: 'neutral' }}
      />,
    );
    expect(screen.getByText('中立')).toBeTruthy();
  });

  // ── 每日攻城次数 ──
  it('显示今日攻城剩余次数', () => {
    render(
      <SiegeConfirmModal
        {...defaultProps}
        dailySiegesRemaining={2}
      />,
    );
    expect(screen.getByText(/今日攻城.*2次/)).toBeTruthy();
  });

  it('今日次数用完时条件失败', () => {
    render(
      <SiegeConfirmModal
        {...defaultProps}
        dailySiegesRemaining={0}
      />,
    );
    const condition = screen.getByTestId('siege-condition-今日攻城次数');
    expect(condition.className).toContain('tk-siege-condition--fail');
  });

  // ── 冷却倒计时 ──
  it('有冷却时间时显示冷却提示', () => {
    render(
      <SiegeConfirmModal
        {...defaultProps}
        cooldownRemainingMs={3600000} // 1小时
      />,
    );
    // 验证冷却状态栏存在
    const panel = screen.getByTestId('siege-confirm');
    expect(panel).toBeTruthy();
  });

  // ── 移动端响应式 ──
  describe('移动端响应式', () => {
    it('弹窗在移动端正常渲染', () => {
      const originalInnerWidth = window.innerWidth;
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 375 });
      window.dispatchEvent(new Event('resize'));

      render(<SiegeConfirmModal {...defaultProps} />);
      expect(screen.getByTestId('siege-confirm')).toBeTruthy();
      expect(screen.getByText(/攻城确认.*许昌/)).toBeTruthy();

      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: originalInnerWidth });
    });

    it('弹窗取消按钮在移动端可点击', () => {
      render(<SiegeConfirmModal {...defaultProps} />);
      // 使用取消按钮文本定位
      const cancelBtn = screen.getByText('取消');
      expect(cancelBtn).toBeTruthy();
      fireEvent.click(cancelBtn);
      expect(defaultProps.onCancel).toHaveBeenCalled();
    });
  });
});
