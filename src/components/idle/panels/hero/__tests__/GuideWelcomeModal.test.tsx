/**
 * GuideWelcomeModal — 欢迎弹窗测试
 *
 * 覆盖场景：
 * 1. visible=false 时不渲染
 * 2. visible=true 时正确渲染
 * 3. 显示步骤数量
 * 4. 显示欢迎标题和描述
 * 5. 显示步骤预览
 * 6. 点击开始引导按钮
 * 7. 点击跳过按钮
 * 8. ARIA无障碍属性
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GuideWelcomeModal } from '../GuideWelcomeModal';

// ── Mock CSS ──
vi.mock('../GuideOverlay.css', () => ({}));

describe('GuideWelcomeModal', () => {
  const onStart = vi.fn();
  const onSkip = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('visible=false 时不渲染', () => {
    const { container } = render(
      <GuideWelcomeModal visible={false} stepCount={6} onStart={onStart} onSkip={onSkip} />
    );
    expect(container.innerHTML).toBe('');
  });

  it('visible=true 时正确渲染', () => {
    render(
      <GuideWelcomeModal visible={true} stepCount={6} onStart={onStart} onSkip={onSkip} />
    );
    expect(screen.getByTestId('guide-welcome-modal')).toBeInTheDocument();
  });

  it('显示欢迎标题', () => {
    render(
      <GuideWelcomeModal visible={true} stepCount={6} onStart={onStart} onSkip={onSkip} />
    );
    expect(screen.getByTestId('guide-welcome-title').textContent).toContain('欢迎来到三国霸业');
  });

  it('显示步骤数量', () => {
    render(
      <GuideWelcomeModal visible={true} stepCount={6} onStart={onStart} onSkip={onSkip} />
    );
    expect(screen.getByTestId('guide-welcome-desc').textContent).toContain('6');
  });

  it('显示步骤预览', () => {
    render(
      <GuideWelcomeModal visible={true} stepCount={6} onStart={onStart} onSkip={onSkip} />
    );
    expect(screen.getByTestId('guide-welcome-preview')).toBeInTheDocument();
  });

  it('点击开始引导按钮触发 onStart', async () => {
    const user = userEvent.setup();
    render(
      <GuideWelcomeModal visible={true} stepCount={6} onStart={onStart} onSkip={onSkip} />
    );
    await user.click(screen.getByTestId('guide-welcome-start'));
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it('点击跳过按钮触发 onSkip', async () => {
    const user = userEvent.setup();
    render(
      <GuideWelcomeModal visible={true} stepCount={6} onStart={onStart} onSkip={onSkip} />
    );
    await user.click(screen.getByTestId('guide-welcome-skip'));
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it('具有正确的ARIA属性', () => {
    render(
      <GuideWelcomeModal visible={true} stepCount={6} onStart={onStart} onSkip={onSkip} />
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-label', '新手引导欢迎');
  });

  it('开始按钮文本为中文', () => {
    render(
      <GuideWelcomeModal visible={true} stepCount={6} onStart={onStart} onSkip={onSkip} />
    );
    expect(screen.getByTestId('guide-welcome-start').textContent).toContain('开始引导');
  });

  it('跳过按钮文本为中文', () => {
    render(
      <GuideWelcomeModal visible={true} stepCount={6} onStart={onStart} onSkip={onSkip} />
    );
    expect(screen.getByTestId('guide-welcome-skip').textContent).toContain('跳过');
  });
});
