/**
 * SweepModal — 扫荡弹窗测试
 *
 * 覆盖场景：
 * - 基础渲染：标题/关卡信息/星级/扫荡令
 * - 可扫荡状态：次数控制/MAX/预计奖励/确认按钮
 * - 不可扫荡状态：锁定提示/禁用按钮
 * - 扫荡令不足：红色提示/禁用确认
 * - 扫荡结果展示：成功/失败
 * - 自动推图开关 + 结果展示
 * - 关闭按钮
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SweepModal from '../SweepModal';
import type { SweepBatchResult } from '@/games/three-kingdoms/engine/campaign/sweep.types';

// ── Mock CSS ──
vi.mock('../SweepModal.css', () => ({}));

// ── 测试数据 ──

const makeSuccessResult = (overrides: Partial<SweepBatchResult> = {}): SweepBatchResult => ({
  success: true,
  stageId: 'chapter1_stage1',
  requestedCount: 5,
  executedCount: 5,
  results: [],
  totalResources: { grain: 1500, gold: 300 },
  totalExp: 1200,
  totalFragments: { guanyu: 3 },
  ticketsUsed: 5,
  ...overrides,
});

const makeFailResult = (reason: string): SweepBatchResult => ({
  success: false,
  stageId: 'chapter1_stage1',
  requestedCount: 5,
  executedCount: 0,
  results: [],
  totalResources: {},
  totalExp: 0,
  totalFragments: {},
  ticketsUsed: 0,
  failureReason: reason,
});

// ── 测试 ──

describe('SweepModal', () => {
  const onClose = vi.fn();
  const onSweep = vi.fn();
  const onAutoPush = vi.fn();

  const defaultProps = {
    stageId: 'chapter1_stage1',
    stageName: '黄巾贼',
    chapterName: '第一章',
    stars: 3,
    ticketCount: 10,
    canSweep: true,
    onClose,
    onSweep,
    onAutoPush,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ═══════════════════════════════════════════
  // 1. 基础渲染
  // ═══════════════════════════════════════════

  it('应渲染弹窗标题', () => {
    render(<SweepModal {...defaultProps} />);
    expect(screen.getByText(/第一章.*黄巾贼.*扫荡/)).toBeInTheDocument();
  });

  it('应渲染关卡名称', () => {
    render(<SweepModal {...defaultProps} />);
    expect(screen.getByText('黄巾贼')).toBeInTheDocument();
  });

  it('应渲染3颗星', () => {
    render(<SweepModal {...defaultProps} />);
    const filledStars = screen.getAllByText('★');
    expect(filledStars).toHaveLength(3);
  });

  it('应显示可扫荡状态', () => {
    render(<SweepModal {...defaultProps} />);
    expect(screen.getByText('✓ 可扫荡')).toBeInTheDocument();
  });

  it('应显示扫荡令数量', () => {
    render(<SweepModal {...defaultProps} />);
    expect(screen.getByText('10')).toBeInTheDocument();
  });

  // ═══════════════════════════════════════════
  // 2. 次数控制
  // ═══════════════════════════════════════════

  it('初始次数应为1', () => {
    render(<SweepModal {...defaultProps} />);
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('点击+应增加次数', () => {
    render(<SweepModal {...defaultProps} />);
    const increaseBtn = screen.getByLabelText('增加次数');
    fireEvent.click(increaseBtn);
    // 应该显示 2（排除其他数字）
    const displays = screen.getAllByText('2');
    expect(displays.length).toBeGreaterThanOrEqual(1);
  });

  it('点击-应减少次数', () => {
    render(<SweepModal {...defaultProps} />);
    const increaseBtn = screen.getByLabelText('增加次数');
    fireEvent.click(increaseBtn);
    const decreaseBtn = screen.getByLabelText('减少次数');
    fireEvent.click(decreaseBtn);
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('次数为1时-按钮应禁用', () => {
    render(<SweepModal {...defaultProps} />);
    const decreaseBtn = screen.getByLabelText('减少次数');
    expect(decreaseBtn).toBeDisabled();
  });

  it('点击MAX应设置为最大可扫荡次数', () => {
    render(<SweepModal {...defaultProps} />);
    const maxBtn = screen.getByText(/MAX/);
    fireEvent.click(maxBtn);
    // ticketCount=10, costPerRun=1, 所以max=10
    expect(screen.getByText('10', { selector: '.tk-sweep-count-display' })).toBeInTheDocument();
  });

  // ═══════════════════════════════════════════
  // 3. 预计奖励
  // ═══════════════════════════════════════════

  it('应显示预计奖励', () => {
    render(
      <SweepModal
        {...defaultProps}
        previewResources={{ grain: 100, gold: 50 }}
        previewExp={200}
      />,
    );
    expect(screen.getByText('预计获得')).toBeInTheDocument();
  });

  // ═══════════════════════════════════════════
  // 4. 不可扫荡状态
  // ═══════════════════════════════════════════

  it('不可扫荡时应显示锁定状态', () => {
    render(
      <SweepModal
        {...defaultProps}
        canSweep={false}
        cannotSweepReason="需要三星通关（当前2星）"
      />,
    );
    expect(screen.getByText('🔒 未解锁')).toBeInTheDocument();
    expect(screen.getByText(/需要三星通关/)).toBeInTheDocument();
  });

  it('不可扫荡时确认按钮应禁用', () => {
    render(
      <SweepModal {...defaultProps} canSweep={false} />,
    );
    const confirmBtn = screen.getByText('确认扫荡');
    expect(confirmBtn).toBeDisabled();
  });

  // ═══════════════════════════════════════════
  // 5. 扫荡令不足
  // ═══════════════════════════════════════════

  it('扫荡令不足时确认按钮应禁用', () => {
    render(<SweepModal {...defaultProps} ticketCount={0} />);
    const confirmBtn = screen.getByText('确认扫荡');
    expect(confirmBtn).toBeDisabled();
  });

  it('扫荡令不足时应显示红色消耗', () => {
    const { container } = render(<SweepModal {...defaultProps} ticketCount={0} />);
    const insufficientEl = container.querySelector('.tk-sweep-ticket-cost--insufficient');
    expect(insufficientEl).toBeInTheDocument();
  });

  // ═══════════════════════════════════════════
  // 6. 扫荡执行
  // ═══════════════════════════════════════════

  it('点击确认应调用onSweep', () => {
    onSweep.mockReturnValue(makeSuccessResult());
    render(<SweepModal {...defaultProps} />);
    fireEvent.click(screen.getByText('确认扫荡'));
    expect(onSweep).toHaveBeenCalledWith('chapter1_stage1', 1);
  });

  it('扫荡成功应显示结果', () => {
    onSweep.mockReturnValue(makeSuccessResult());
    render(<SweepModal {...defaultProps} />);
    fireEvent.click(screen.getByText('确认扫荡'));
    expect(screen.getByText(/扫荡完成/)).toBeInTheDocument();
  });

  it('扫荡失败应显示错误信息', () => {
    onSweep.mockReturnValue(makeFailResult('扫荡令不足'));
    render(<SweepModal {...defaultProps} />);
    fireEvent.click(screen.getByText('确认扫荡'));
    expect(screen.getByText(/扫荡令不足/)).toBeInTheDocument();
  });

  // ═══════════════════════════════════════════
  // 7. 自动推图
  // ═══════════════════════════════════════════

  it('应显示自动推图开关', () => {
    render(<SweepModal {...defaultProps} />);
    expect(screen.getByText('🚀 自动推图')).toBeInTheDocument();
  });

  it('点击开关应切换状态', () => {
    render(<SweepModal {...defaultProps} />);
    const toggle = screen.getByRole('switch', { name: '自动推图开关' });
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-checked', 'true');
  });

  // ═══════════════════════════════════════════
  // 8. 关闭
  // ═══════════════════════════════════════════

  it('点击关闭按钮应调用onClose', () => {
    render(<SweepModal {...defaultProps} />);
    fireEvent.click(screen.getByLabelText('关闭'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('点击取消按钮应调用onClose', () => {
    render(<SweepModal {...defaultProps} />);
    fireEvent.click(screen.getByText('取消'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // ═══════════════════════════════════════════
  // 9. 无自动推图回调
  // ═══════════════════════════════════════════

  it('无onAutoPush时不显示自动推图开关', () => {
    render(<SweepModal {...defaultProps} onAutoPush={undefined} />);
    expect(screen.queryByText('🚀 自动推图')).not.toBeInTheDocument();
  });
});
