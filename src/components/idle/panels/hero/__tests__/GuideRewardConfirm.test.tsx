/**
 * GuideRewardConfirm — 奖励确认弹窗测试
 *
 * 覆盖场景：
 * 1. visible=false时不渲染
 * 2. visible=true时渲染弹窗
 * 3. 奖励文本多行展示
 * 4. 收下奖励按钮触发onConfirm
 * 5. ARIA无障碍属性
 * 6. displayName
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GuideRewardConfirm } from '../GuideRewardConfirm';
import type { GuideRewardConfirmProps } from '../GuideRewardConfirm';

// ── Helper ──
function renderConfirm(overrides: Partial<GuideRewardConfirmProps> = {}) {
  const props: GuideRewardConfirmProps = {
    visible: true,
    rewardText: '🎁 铜钱 ×500\n🎁 招贤令 ×1',
    onConfirm: vi.fn(),
    ...overrides,
  };
  return render(<GuideRewardConfirm {...props} />);
}

describe('GuideRewardConfirm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  // 1. visible=false时不渲染
  it('visible为false时应返回null', () => {
    const { container } = renderConfirm({ visible: false });
    expect(container.innerHTML).toBe('');
  });

  // 2. visible=true时渲染弹窗
  it('visible为true时应渲染弹窗', () => {
    renderConfirm();
    expect(screen.getByTestId('guide-reward-confirm')).toBeInTheDocument();
  });

  // 3. 奖励文本多行展示
  it('应将多行奖励文本逐行渲染', () => {
    renderConfirm({ rewardText: '🎁 铜钱 ×500\n🎁 招贤令 ×1\n🎁 科技点 ×100' });
    const confirm = screen.getByTestId('guide-reward-confirm');
    expect(confirm.textContent).toContain('铜钱 ×500');
    expect(confirm.textContent).toContain('招贤令 ×1');
    expect(confirm.textContent).toContain('科技点 ×100');
  });

  // 4. 单行奖励文本
  it('应正确渲染单行奖励文本', () => {
    renderConfirm({ rewardText: '🎓 新手引导已完成！' });
    const confirm = screen.getByTestId('guide-reward-confirm');
    expect(confirm.textContent).toContain('新手引导已完成');
  });

  // 5. 收下奖励按钮触发onConfirm
  it('点击收下奖励应触发onConfirm', async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    renderConfirm({ onConfirm });

    await user.click(screen.getByTestId('guide-reward-confirm-ok'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  // 6. ARIA无障碍属性
  it('应有正确的ARIA属性', () => {
    renderConfirm();
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-label')).toBe('奖励确认');
  });

  // 7. 显示庆祝图标
  it('应显示庆祝图标', () => {
    renderConfirm();
    const confirm = screen.getByTestId('guide-reward-confirm');
    expect(confirm.textContent).toContain('🎉');
  });

  // 8. 显示标题文本
  it('应显示完成标题', () => {
    renderConfirm();
    const confirm = screen.getByTestId('guide-reward-confirm');
    expect(confirm.textContent).toContain('引导完成');
    expect(confirm.textContent).toContain('奖励已发放');
  });

  // 9. 收下奖励按钮文本
  it('按钮文本应为收下奖励', () => {
    renderConfirm();
    const btn = screen.getByTestId('guide-reward-confirm-ok');
    expect(btn.textContent).toBe('收下奖励');
  });

  // 10. displayName
  it('应有正确的displayName', () => {
    expect(GuideRewardConfirm.displayName).toBe('GuideRewardConfirm');
  });
});
