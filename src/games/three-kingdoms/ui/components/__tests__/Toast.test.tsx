/**
 * Toast 组件渲染测试
 *
 * 覆盖：显示/隐藏、自动消失时长、四种类型(success/error/warning/info)、
 * 手动关闭、堆叠显示、位置容器、无障碍属性
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { Toast, type ToastItem } from '../Toast';

describe('Toast 组件渲染测试', () => {
  const defaultToasts: ToastItem[] = [];
  const defaultOnRemove = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── 显示/隐藏 ──

  it('空 toasts 列表不渲染任何 Toast 条目', () => {
    const { container } = render(<Toast toasts={[]} onRemove={defaultOnRemove} />);
    const entries = container.querySelectorAll('.tk-toast');
    expect(entries).toHaveLength(0);
  });

  it('渲染单条 Toast', () => {
    const toasts: ToastItem[] = [
      { id: '1', message: '操作成功', type: 'success' },
    ];
    render(<Toast toasts={toasts} onRemove={defaultOnRemove} />);
    expect(screen.getByText('操作成功')).toBeInTheDocument();
  });

  it('渲染多条 Toast 堆叠', () => {
    const toasts: ToastItem[] = [
      { id: '1', message: '消息1', type: 'info' },
      { id: '2', message: '消息2', type: 'success' },
      { id: '3', message: '消息3', type: 'error' },
    ];
    render(<Toast toasts={toasts} onRemove={defaultOnRemove} />);
    expect(screen.getByText('消息1')).toBeInTheDocument();
    expect(screen.getByText('消息2')).toBeInTheDocument();
    expect(screen.getByText('消息3')).toBeInTheDocument();
  });

  // ── 类型 ──

  it('success 类型显示 ✓ 图标', () => {
    const toasts: ToastItem[] = [
      { id: '1', message: '成功', type: 'success' },
    ];
    render(<Toast toasts={toasts} onRemove={defaultOnRemove} />);
    expect(screen.getByText('✓')).toBeInTheDocument();
  });

  it('error 类型显示 ✕ 图标', () => {
    const toasts: ToastItem[] = [
      { id: '1', message: '错误', type: 'error' },
    ];
    const { container } = render(<Toast toasts={toasts} onRemove={defaultOnRemove} />);
    // error 类型的图标在 tk-toast__icon span 中
    const icon = container.querySelector('.tk-toast__icon');
    expect(icon?.textContent).toContain('✕');
  });

  it('warning 类型显示 ⚠ 图标', () => {
    const toasts: ToastItem[] = [
      { id: '1', message: '警告', type: 'warning' },
    ];
    render(<Toast toasts={toasts} onRemove={defaultOnRemove} />);
    expect(screen.getByText('⚠')).toBeInTheDocument();
  });

  it('info 类型显示 ℹ 图标', () => {
    const toasts: ToastItem[] = [
      { id: '1', message: '信息', type: 'info' },
    ];
    render(<Toast toasts={toasts} onRemove={defaultOnRemove} />);
    expect(screen.getByText('ℹ')).toBeInTheDocument();
  });

  it('不同类型有对应的 CSS 类名', () => {
    const toasts: ToastItem[] = [
      { id: '1', message: '成功', type: 'success' },
      { id: '2', message: '错误', type: 'error' },
    ];
    const { container } = render(<Toast toasts={toasts} onRemove={defaultOnRemove} />);
    expect(container.querySelector('.tk-toast-success')).toBeTruthy();
    expect(container.querySelector('.tk-toast-error')).toBeTruthy();
  });

  // ── 自动消失 ──

  it('默认 3000ms 后触发 onRemove', () => {
    const onRemove = vi.fn();
    const toasts: ToastItem[] = [
      { id: 't1', message: '自动消失', type: 'info' },
    ];
    render(<Toast toasts={toasts} onRemove={onRemove} />);

    // 200ms 退出动画
    act(() => { vi.advanceTimersByTime(3200); });
    expect(onRemove).toHaveBeenCalledWith('t1');
  });

  it('自定义 duration 后触发 onRemove', () => {
    const onRemove = vi.fn();
    const toasts: ToastItem[] = [
      { id: 't2', message: '自定义时长', type: 'info', duration: 1000 },
    ];
    render(<Toast toasts={toasts} onRemove={onRemove} />);

    act(() => { vi.advanceTimersByTime(1200); });
    expect(onRemove).toHaveBeenCalledWith('t2');
  });

  it('duration=0 时不自动消失', () => {
    const onRemove = vi.fn();
    const toasts: ToastItem[] = [
      { id: 't3', message: '不自动消失', type: 'info', duration: 0 },
    ];
    render(<Toast toasts={toasts} onRemove={onRemove} />);

    act(() => { vi.advanceTimersByTime(10000); });
    expect(onRemove).not.toHaveBeenCalled();
  });

  // ── 手动关闭 ──

  it('点击关闭按钮触发退出动画后调用 onRemove', () => {
    const onRemove = vi.fn();
    const toasts: ToastItem[] = [
      { id: 't4', message: '手动关闭', type: 'info' },
    ];
    render(<Toast toasts={toasts} onRemove={onRemove} />);

    const closeBtn = screen.getByLabelText('关闭提示');
    fireEvent.click(closeBtn);

    // 200ms 退出动画
    act(() => { vi.advanceTimersByTime(200); });
    expect(onRemove).toHaveBeenCalledWith('t4');
  });

  // ── 位置容器 ──

  it('Toast 渲染在容器中', () => {
    const toasts: ToastItem[] = [
      { id: '1', message: '容器测试', type: 'info' },
    ];
    const { container } = render(<Toast toasts={toasts} onRemove={defaultOnRemove} />);
    const toastContainer = container.querySelector('.tk-toast-container');
    expect(toastContainer).toBeTruthy();
    expect(toastContainer?.children.length).toBe(1);
  });

  // ── 无障碍 ──

  it('容器有 aria-label', () => {
    const { container } = render(<Toast toasts={[]} onRemove={defaultOnRemove} />);
    const toastContainer = container.querySelector('.tk-toast-container');
    expect(toastContainer).toHaveAttribute('aria-label', '消息提示');
  });

  it('每条 Toast 有 role="alert"', () => {
    const toasts: ToastItem[] = [
      { id: '1', message: '告警', type: 'warning' },
    ];
    render(<Toast toasts={toasts} onRemove={defaultOnRemove} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('每条 Toast 有 aria-live="polite"', () => {
    const toasts: ToastItem[] = [
      { id: '1', message: '信息', type: 'info' },
    ];
    render(<Toast toasts={toasts} onRemove={defaultOnRemove} />);
    expect(screen.getByRole('alert')).toHaveAttribute('aria-live', 'polite');
  });

  // ── 消息文本 ──

  it('正确显示消息文本', () => {
    const toasts: ToastItem[] = [
      { id: '1', message: '这是一条测试消息', type: 'info' },
    ];
    render(<Toast toasts={toasts} onRemove={defaultOnRemove} />);
    expect(screen.getByText('这是一条测试消息')).toBeInTheDocument();
  });
});
