/**
 * OfflinePushSettings — 离线推图设置子组件 测试
 *
 * 覆盖：
 * - 开关渲染（on/off 状态 + aria-checked）
 * - 战力阈值输入
 * - 自动推图进度显示
 * - 回调触发
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import OfflinePushSettings from '../OfflinePushSettings';
import type { AutoPushProgress } from '@/games/three-kingdoms/engine/campaign/sweep.types';

// ── Mock CSS ──
vi.mock('../OfflinePushPanel.css', () => ({}));

// ── 测试数据 ──

const defaultProps = {
  autoPushEnabled: false,
  powerThreshold: 10000,
  autoPushProgress: null as AutoPushProgress | null,
  onToggleAutoPush: vi.fn(),
  onThresholdChange: vi.fn(),
};

const makeAutoPushProgress = (overrides: Partial<AutoPushProgress> = {}): AutoPushProgress => ({
  isRunning: true,
  currentStageId: 'chapter1_stage5',
  victories: 3,
  defeats: 1,
  attempts: 4,
  ...overrides,
});

// ─────────────────────────────────────────────
// 测试
// ─────────────────────────────────────────────

describe('OfflinePushSettings', () => {
  it('渲染设置标题', () => {
    render(<OfflinePushSettings {...defaultProps} />);
    expect(screen.getByText('⚙️ 推图设置')).toBeTruthy();
  });

  it('开关默认关闭 aria-checked=false', () => {
    render(<OfflinePushSettings {...defaultProps} />);
    const toggle = screen.getByTestId('offline-push-toggle');
    expect(toggle.getAttribute('aria-checked')).toBe('false');
  });

  it('开关开启状态 aria-checked=true', () => {
    render(<OfflinePushSettings {...defaultProps} autoPushEnabled />);
    const toggle = screen.getByTestId('offline-push-toggle');
    expect(toggle.getAttribute('aria-checked')).toBe('true');
  });

  it('点击开关触发 onToggleAutoPush', () => {
    const onToggle = vi.fn();
    render(<OfflinePushSettings {...defaultProps} onToggleAutoPush={onToggle} />);
    fireEvent.click(screen.getByTestId('offline-push-toggle'));
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it('显示当前战力阈值', () => {
    render(<OfflinePushSettings {...defaultProps} powerThreshold={5000} />);
    const input = screen.getByTestId('offline-push-threshold') as HTMLInputElement;
    expect(input.value).toBe('5000');
  });

  it('输入战力阈值触发 onThresholdChange', () => {
    const onChange = vi.fn();
    render(<OfflinePushSettings {...defaultProps} onThresholdChange={onChange} />);
    const input = screen.getByTestId('offline-push-threshold');
    fireEvent.change(input, { target: { value: '20000' } });
    expect(onChange).toHaveBeenCalledWith(20000);
  });

  it('无效输入不触发回调', () => {
    const onChange = vi.fn();
    render(<OfflinePushSettings {...defaultProps} onThresholdChange={onChange} />);
    const input = screen.getByTestId('offline-push-threshold');
    fireEvent.change(input, { target: { value: 'abc' } });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('不显示自动推图进度（isRunning=false）', () => {
    const progress = makeAutoPushProgress({ isRunning: false });
    render(<OfflinePushSettings {...defaultProps} autoPushProgress={progress} />);
    expect(screen.queryByText(/推图中/)).toBeNull();
  });

  it('显示自动推图进度', () => {
    const progress = makeAutoPushProgress({ victories: 5, defeats: 2, attempts: 7 });
    render(<OfflinePushSettings {...defaultProps} autoPushProgress={progress} />);
    expect(screen.getByText(/5胜2负/)).toBeTruthy();
    expect(screen.getByText(/共7次/)).toBeTruthy();
  });

  it('autoPushProgress 为 null 时不显示进度', () => {
    render(<OfflinePushSettings {...defaultProps} autoPushProgress={null} />);
    expect(screen.queryByText(/推图中/)).toBeNull();
  });
});
