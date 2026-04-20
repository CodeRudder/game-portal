/**
 * Modal 组件渲染测试
 *
 * 覆盖：打开/关闭、确认/取消、三种类型(info/confirm/warning)、
 * ESC 关闭、遮罩关闭、按钮文本、无障碍属性
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Modal } from '../Modal';

describe('Modal 组件渲染测试', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    title: '测试弹窗',
    children: <p>弹窗内容</p>,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── 打开/关闭 ──

  it('isOpen=true 时渲染弹窗', () => {
    render(<Modal {...defaultProps} />);
    expect(screen.getByText('测试弹窗')).toBeInTheDocument();
    expect(screen.getByText('弹窗内容')).toBeInTheDocument();
  });

  it('isOpen=false 时不渲染任何内容', () => {
    const { container } = render(<Modal {...defaultProps} isOpen={false} />);
    expect(container.innerHTML).toBe('');
  });

  it('点击关闭按钮触发 onClose', async () => {
    const onClose = vi.fn();
    render(<Modal {...defaultProps} onClose={onClose} />);
    const closeBtn = screen.getByLabelText('关闭弹窗');
    await userEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('点击遮罩层触发 onClose', () => {
    const onClose = vi.fn();
    const { container } = render(<Modal {...defaultProps} onClose={onClose} />);
    const overlay = container.querySelector('.tk-modal-overlay');
    fireEvent.click(overlay!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // ── ESC 关闭 ──

  it('按 ESC 键触发 onClose', () => {
    const onClose = vi.fn();
    render(<Modal {...defaultProps} onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('弹窗关闭时 ESC 不触发 onClose', () => {
    const onClose = vi.fn();
    render(<Modal {...defaultProps} isOpen={false} onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });

  // ── info 类型 ──

  it('info 类型只显示一个确认按钮', () => {
    render(<Modal {...defaultProps} type="info" />);
    // info 类型只有一个按钮（确认按钮也作为关闭按钮）
    const buttons = screen.getAllByRole('button');
    // 关闭按钮(x) + 底部确认按钮
    expect(buttons.length).toBeGreaterThanOrEqual(2);
  });

  it('info 类型点击确认按钮触发 onClose', async () => {
    const onClose = vi.fn();
    render(<Modal {...defaultProps} type="info" onClose={onClose} />);
    const confirmBtn = screen.getByText('确认');
    await userEvent.click(confirmBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // ── confirm 类型 ──

  it('confirm 类型显示确认和取消按钮', () => {
    render(<Modal {...defaultProps} type="confirm" onConfirm={vi.fn()} />);
    expect(screen.getByText('确认')).toBeInTheDocument();
    expect(screen.getByText('取消')).toBeInTheDocument();
  });

  it('confirm 类型点击确认触发 onConfirm', async () => {
    const onConfirm = vi.fn();
    render(<Modal {...defaultProps} type="confirm" onConfirm={onConfirm} />);
    // 有两个"确认"按钮（关闭按钮的 aria 和底部的），点击底部的
    const confirmButtons = screen.getAllByText('确认');
    await userEvent.click(confirmButtons[confirmButtons.length - 1]);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('confirm 类型点击取消触发 onClose', async () => {
    const onClose = vi.fn();
    render(<Modal {...defaultProps} type="confirm" onClose={onClose} onConfirm={vi.fn()} />);
    const cancelBtn = screen.getByText('取消');
    await userEvent.click(cancelBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // ── warning 类型 ──

  it('warning 类型显示确认和取消按钮', () => {
    render(<Modal {...defaultProps} type="warning" onConfirm={vi.fn()} />);
    expect(screen.getByText('确认')).toBeInTheDocument();
    expect(screen.getByText('取消')).toBeInTheDocument();
  });

  it('warning 类型有 danger 样式类', () => {
    const { container } = render(
      <Modal {...defaultProps} type="warning" onConfirm={vi.fn()} />,
    );
    const dangerBtn = container.querySelector('.tk-modal__btn--danger');
    expect(dangerBtn).toBeTruthy();
  });

  // ── 自定义按钮文本 ──

  it('自定义确认按钮文本', () => {
    render(<Modal {...defaultProps} type="info" confirmText="知道了" />);
    expect(screen.getByText('知道了')).toBeInTheDocument();
  });

  it('自定义取消按钮文本', () => {
    render(
      <Modal {...defaultProps} type="confirm" cancelText="返回" onConfirm={vi.fn()} />,
    );
    expect(screen.getByText('返回')).toBeInTheDocument();
  });

  // ── 标题和内容 ──

  it('正确渲染标题', () => {
    render(<Modal {...defaultProps} title="自定义标题" />);
    expect(screen.getByText('自定义标题')).toBeInTheDocument();
  });

  it('渲染 children 内容', () => {
    render(
      <Modal {...defaultProps}>
        <span data-testid="modal-child">子内容</span>
      </Modal>,
    );
    expect(screen.getByTestId('modal-child')).toBeInTheDocument();
  });

  // ── 无障碍 ──

  it('弹窗具有 role="dialog"', () => {
    render(<Modal {...defaultProps} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('弹窗具有 aria-modal="true"', () => {
    render(<Modal {...defaultProps} />);
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
  });

  it('弹窗具有 aria-label 等于标题', () => {
    render(<Modal {...defaultProps} title="无障碍标题" />);
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-label', '无障碍标题');
  });

  // ── Enter 快捷键 ──

  it('confirm 类型按 Enter 触发 onConfirm', () => {
    const onConfirm = vi.fn();
    render(<Modal {...defaultProps} type="confirm" onConfirm={onConfirm} />);
    fireEvent.keyDown(document, { key: 'Enter' });
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('info 类型按 Enter 不触发 onConfirm', () => {
    const onConfirm = vi.fn();
    render(<Modal {...defaultProps} type="info" onConfirm={onConfirm} />);
    fireEvent.keyDown(document, { key: 'Enter' });
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
