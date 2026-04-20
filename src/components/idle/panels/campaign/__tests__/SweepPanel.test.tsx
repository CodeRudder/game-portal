/**
 * SweepPanel — 扫荡面板 测试
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
import SweepPanel from '../SweepPanel';
import type { SweepBatchResult } from '@/games/three-kingdoms/engine/campaign/sweep.types';

// ── Mock CSS ──
vi.mock('../SweepPanel.css', () => ({}));

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

describe('SweepPanel', () => {
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

  it('应渲染扫荡面板overlay', () => {
    render(<SweepPanel {...defaultProps} />);
    expect(screen.getByTestId('sweep-panel-overlay')).toBeInTheDocument();
  });

  it('应渲染弹窗标题', () => {
    render(<SweepPanel {...defaultProps} />);
    expect(screen.getByText(/第一章.*黄巾贼.*扫荡/)).toBeInTheDocument();
  });

  it('应渲染关卡名称', () => {
    render(<SweepPanel {...defaultProps} />);
    expect(screen.getByText('黄巾贼')).toBeInTheDocument();
  });

  it('应显示可扫荡状态', () => {
    render(<SweepPanel {...defaultProps} />);
    expect(screen.getByText('✓ 可扫荡')).toBeInTheDocument();
  });

  // ═══════════════════════════════════════════
  // 2. 次数控制
  // ═══════════════════════════════════════════

  it('初始次数应为1', () => {
    render(<SweepPanel {...defaultProps} />);
    const display = screen.getByText('1', { selector: '.tk-sweep-count-display' });
    expect(display).toBeInTheDocument();
  });

  it('点击+应增加次数', () => {
    render(<SweepPanel {...defaultProps} />);
    fireEvent.click(screen.getByLabelText('增加次数'));
    const displays = screen.getAllByText('2');
    expect(displays.length).toBeGreaterThanOrEqual(1);
  });

  it('点击-应减少次数', () => {
    render(<SweepPanel {...defaultProps} />);
    fireEvent.click(screen.getByLabelText('增加次数'));
    fireEvent.click(screen.getByLabelText('减少次数'));
    expect(screen.getByText('1', { selector: '.tk-sweep-count-display' })).toBeInTheDocument();
  });

  it('次数为1时-按钮应禁用', () => {
    render(<SweepPanel {...defaultProps} />);
    expect(screen.getByLabelText('减少次数')).toBeDisabled();
  });

  it('点击MAX应设置为最大可扫荡次数', () => {
    render(<SweepPanel {...defaultProps} />);
    fireEvent.click(screen.getByText(/MAX/));
    expect(screen.getByText('10', { selector: '.tk-sweep-count-display' })).toBeInTheDocument();
  });

  // ═══════════════════════════════════════════
  // 3. 不可扫荡状态
  // ═══════════════════════════════════════════

  it('不可扫荡时应显示锁定状态', () => {
    render(
      <SweepPanel
        {...defaultProps}
        canSweep={false}
        cannotSweepReason="需要三星通关（当前2星）"
      />,
    );
    expect(screen.getByText('🔒 未解锁')).toBeInTheDocument();
    expect(screen.getByText(/需要三星通关/)).toBeInTheDocument();
  });

  it('不可扫荡时确认按钮应禁用', () => {
    render(<SweepPanel {...defaultProps} canSweep={false} />);
    expect(screen.getByText('确认扫荡')).toBeDisabled();
  });

  // ═══════════════════════════════════════════
  // 4. 扫荡令不足
  // ═══════════════════════════════════════════

  it('扫荡令不足时确认按钮应禁用', () => {
    render(<SweepPanel {...defaultProps} ticketCount={0} />);
    expect(screen.getByText('确认扫荡')).toBeDisabled();
  });

  it('扫荡令不足时应显示红色消耗', () => {
    const { container } = render(<SweepPanel {...defaultProps} ticketCount={0} />);
    expect(container.querySelector('.tk-sweep-ticket-cost--insufficient')).toBeInTheDocument();
  });

  // ═══════════════════════════════════════════
  // 5. 扫荡执行
  // ═══════════════════════════════════════════

  it('点击确认应调用onSweep', () => {
    onSweep.mockReturnValue(makeSuccessResult());
    render(<SweepPanel {...defaultProps} />);
    fireEvent.click(screen.getByText('确认扫荡'));
    expect(onSweep).toHaveBeenCalledWith('chapter1_stage1', 1);
  });

  it('扫荡成功应显示结果', () => {
    onSweep.mockReturnValue(makeSuccessResult());
    render(<SweepPanel {...defaultProps} />);
    fireEvent.click(screen.getByText('确认扫荡'));
    expect(screen.getByTestId('sweep-panel-result')).toBeInTheDocument();
    expect(screen.getByText(/扫荡完成/)).toBeInTheDocument();
  });

  it('扫荡失败应显示错误信息', () => {
    onSweep.mockReturnValue(makeFailResult('扫荡令不足'));
    render(<SweepPanel {...defaultProps} />);
    fireEvent.click(screen.getByText('确认扫荡'));
    expect(screen.getByText(/扫荡令不足/)).toBeInTheDocument();
  });

  // ═══════════════════════════════════════════
  // 6. 自动推图
  // ═══════════════════════════════════════════

  it('应显示自动推图开关', () => {
    render(<SweepPanel {...defaultProps} />);
    expect(screen.getByText('🚀 自动推图')).toBeInTheDocument();
  });

  it('点击开关应切换状态', () => {
    render(<SweepPanel {...defaultProps} />);
    const toggle = screen.getByRole('switch', { name: '自动推图开关' });
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-checked', 'true');
  });

  // ═══════════════════════════════════════════
  // 7. 关闭
  // ═══════════════════════════════════════════

  it('点击关闭按钮应调用onClose', () => {
    render(<SweepPanel {...defaultProps} />);
    fireEvent.click(screen.getByLabelText('关闭'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('点击取消按钮应调用onClose', () => {
    render(<SweepPanel {...defaultProps} />);
    fireEvent.click(screen.getByText('取消'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // ═══════════════════════════════════════════
  // 8. 无自动推图回调
  // ═══════════════════════════════════════════

  it('无onAutoPush时不显示自动推图开关', () => {
    render(<SweepPanel {...defaultProps} onAutoPush={undefined} />);
    expect(screen.queryByText('🚀 自动推图')).not.toBeInTheDocument();
  });

  // ═══════════════════════════════════════════
  // 9. 预计奖励
  // ═══════════════════════════════════════════

  it('应显示预计奖励', () => {
    render(
      <SweepPanel
        {...defaultProps}
        previewResources={{ grain: 100, gold: 50 }}
        previewExp={200}
      />,
    );
    expect(screen.getByText('预计获得')).toBeInTheDocument();
  });
});
