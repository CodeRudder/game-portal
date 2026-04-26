/**
 * TutorialOverlay — 新手引导遮罩层测试
 *
 * 覆盖场景：
 * - 渲染测试（标题、描述、步骤指示器、按钮）
 * - 高亮区域（矩形/圆形）
 * - 交互测试（下一步、跳过、点击遮罩）
 * - 最后一步按钮文字变化
 * - 无目标区域时居中显示
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TutorialOverlay from '../TutorialOverlay';

// ── Mock CSS ──
vi.mock('../TutorialOverlay.css', () => ({}));

// ── 默认 props ──
const defaultProps = {
  currentStep: 0,
  totalSteps: 4,
  title: '欢迎来到三国',
  description: '点击招募按钮获取你的第一位武将',
  onNext: vi.fn(),
  onSkip: vi.fn(),
};

const targetRect = { x: 100, y: 200, width: 80, height: 50 };

describe('TutorialOverlay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  // ═══════════════════════════════════════════
  // 1. 基础渲染
  // ═══════════════════════════════════════════

  it('应渲染遮罩层', () => {
    render(<TutorialOverlay {...defaultProps} />);
    expect(screen.getByTestId('tutorial-overlay')).toBeInTheDocument();
  });

  it('应显示步骤标题', () => {
    render(<TutorialOverlay {...defaultProps} />);
    expect(screen.getByText('欢迎来到三国')).toBeInTheDocument();
  });

  it('应显示步骤描述', () => {
    render(<TutorialOverlay {...defaultProps} />);
    expect(screen.getByText('点击招募按钮获取你的第一位武将')).toBeInTheDocument();
  });

  it('应显示步骤指示器 1/4', () => {
    render(<TutorialOverlay {...defaultProps} />);
    expect(screen.getByTestId('tutorial-step-indicator')).toHaveTextContent('1/4');
  });

  it('应显示"下一步"按钮', () => {
    render(<TutorialOverlay {...defaultProps} />);
    expect(screen.getByTestId('tutorial-btn-next')).toHaveTextContent('下一步');
  });

  it('应显示"跳过"按钮', () => {
    render(<TutorialOverlay {...defaultProps} />);
    expect(screen.getByTestId('tutorial-btn-skip')).toHaveTextContent('跳过');
  });

  // ═══════════════════════════════════════════
  // 2. 高亮区域
  // ═══════════════════════════════════════════

  it('传入 targetRect 时应渲染高亮区域', () => {
    render(<TutorialOverlay {...defaultProps} targetRect={targetRect} />);
    expect(screen.getByTestId('tutorial-highlight')).toBeInTheDocument();
  });

  it('不传 targetRect 时不应渲染高亮区域', () => {
    render(<TutorialOverlay {...defaultProps} />);
    expect(screen.queryByTestId('tutorial-highlight')).not.toBeInTheDocument();
  });

  it('highlightShape=circle 时高亮区域应为圆形', () => {
    render(<TutorialOverlay {...defaultProps} targetRect={targetRect} highlightShape="circle" />);
    const highlight = screen.getByTestId('tutorial-highlight');
    expect(highlight.style.borderRadius).toBe('50%');
  });

  // ═══════════════════════════════════════════
  // 3. 交互测试
  // ═══════════════════════════════════════════

  it('点击"下一步"应调用 onNext', async () => {
    const onNext = vi.fn();
    const user = userEvent.setup();
    render(<TutorialOverlay {...defaultProps} onNext={onNext} />);

    await user.click(screen.getByTestId('tutorial-btn-next'));
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('点击"跳过"应调用 onSkip', async () => {
    const onSkip = vi.fn();
    const user = userEvent.setup();
    render(<TutorialOverlay {...defaultProps} onSkip={onSkip} />);

    await user.click(screen.getByTestId('tutorial-btn-skip'));
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it('点击遮罩背景应调用 onSkip', async () => {
    const onSkip = vi.fn();
    const user = userEvent.setup();
    render(<TutorialOverlay {...defaultProps} onSkip={onSkip} />);

    await user.click(screen.getByTestId('tutorial-backdrop'));
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  // ═══════════════════════════════════════════
  // 4. 最后一步
  // ═══════════════════════════════════════════

  it('最后一步按钮应显示"完成"', () => {
    render(<TutorialOverlay {...defaultProps} currentStep={3} totalSteps={4} />);
    expect(screen.getByTestId('tutorial-btn-next')).toHaveTextContent('完成');
  });

  it('步骤指示器应正确显示当前步骤', () => {
    render(<TutorialOverlay {...defaultProps} currentStep={2} totalSteps={4} />);
    expect(screen.getByTestId('tutorial-step-indicator')).toHaveTextContent('3/4');
  });

  // ═══════════════════════════════════════════
  // 5. 无目标区域居中
  // ═══════════════════════════════════════════

  it('无 targetRect 时提示框应有居中样式', () => {
    render(<TutorialOverlay {...defaultProps} />);
    const tooltip = screen.getByTestId('tutorial-tooltip');
    expect(tooltip.className).toContain('tk-tutorial-tooltip--centered');
  });

  it('有 targetRect 时提示框不应有居中样式', () => {
    render(<TutorialOverlay {...defaultProps} targetRect={targetRect} />);
    const tooltip = screen.getByTestId('tutorial-tooltip');
    expect(tooltip.className).not.toContain('tk-tutorial-tooltip--centered');
  });
});
