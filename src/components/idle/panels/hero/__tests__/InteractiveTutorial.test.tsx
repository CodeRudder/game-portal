/**
 * InteractiveTutorial — 交互式新手教程测试
 *
 * 覆盖场景：
 * 1. 渲染遮罩
 * 2. 显示步骤标题
 * 3. 显示步骤描述
 * 4. 下一步按钮（非最后一步）
 * 5. 上一步按钮（第 2 步起）
 * 6. 上一步按钮隐藏（第 1 步）
 * 7. 跳过按钮
 * 8. 最后一步显示完成按钮
 * 9. 步骤进度指示器（圆点 + 计数）
 * 10. 点击下一步触发回调
 * 11. 点击跳过触发回调
 * 12. 点击完成触发完成动画
 * 13. 高亮目标元素定位
 * 14. 无步骤时不渲染
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import InteractiveTutorial from '../InteractiveTutorial';
import type { TutorialStep } from '../InteractiveTutorial';

// ── Mock CSS ──
vi.mock('../InteractiveTutorial.css', () => ({}));

// ── Test Data ──
const mockSteps: TutorialStep[] = [
  {
    targetSelector: '.hero-tab',
    title: '欢迎来到三国霸业',
    description: '点击武将Tab查看你的武将',
    position: 'bottom',
  },
  {
    targetSelector: '.claim-btn',
    title: '领取新手礼包',
    description: '点击领取丰厚奖励',
    position: 'top',
  },
  {
    targetSelector: '.recruit-btn',
    title: '招募你的第一位武将',
    description: '点击招募按钮获取武将',
    position: 'right',
  },
  {
    targetSelector: '.hero-card',
    title: '查看你的武将',
    description: '查看武将属性和技能',
    position: 'left',
  },
];

// ── Helper: render with default props ──
function renderTutorial(overrides: Partial<{ currentStep: number; steps: TutorialStep[] }> = {}) {
  const props = {
    steps: mockSteps,
    currentStep: 0,
    onNext: vi.fn(),
    onPrev: vi.fn(),
    onSkip: vi.fn(),
    onComplete: vi.fn(),
    ...overrides,
  };
  return render(<InteractiveTutorial {...props} />);
}

// ─────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────

describe('InteractiveTutorial', () => {
  beforeEach(() => {
    cleanup();
    // 创建模拟目标元素
    document.body.innerHTML = `
      <div class="hero-tab" style="position:absolute;top:10px;left:10px;width:80px;height:30px;"></div>
      <div class="claim-btn" style="position:absolute;top:100px;left:10px;width:100px;height:40px;"></div>
      <div class="recruit-btn" style="position:absolute;top:200px;left:10px;width:120px;height:40px;"></div>
      <div class="hero-card" style="position:absolute;top:300px;left:10px;width:150px;height:200px;"></div>
    `;
  });

  // 1. 渲染遮罩
  it('renders overlay mask', () => {
    renderTutorial();
    const overlay = screen.getByTestId('tutorial-overlay');
    expect(overlay).toBeTruthy();
    expect(overlay.className).toContain('it-overlay');
  });

  // 2. 显示步骤标题
  it('displays step title', () => {
    renderTutorial({ currentStep: 0 });
    expect(screen.getByTestId('tutorial-title').textContent).toBe('欢迎来到三国霸业');
  });

  // 3. 显示步骤描述
  it('displays step description', () => {
    renderTutorial({ currentStep: 0 });
    expect(screen.getByTestId('tutorial-description').textContent).toBe('点击武将Tab查看你的武将');
  });

  // 4. 下一步按钮（非最后一步）
  it('shows "下一步" button when not on last step', () => {
    renderTutorial({ currentStep: 0 });
    expect(screen.getByTestId('tutorial-next')).toBeTruthy();
    expect(screen.getByTestId('tutorial-next').textContent).toBe('下一步');
  });

  // 5. 上一步按钮（第 2 步起显示）
  it('shows "上一步" button from step 2 onwards', () => {
    renderTutorial({ currentStep: 1 });
    expect(screen.getByTestId('tutorial-prev')).toBeTruthy();
    expect(screen.getByTestId('tutorial-prev').textContent).toBe('上一步');
  });

  // 6. 上一步按钮隐藏（第 1 步）
  it('hides "上一步" button on first step', () => {
    renderTutorial({ currentStep: 0 });
    expect(screen.queryByTestId('tutorial-prev')).toBeNull();
  });

  // 7. 跳过按钮
  it('shows skip button', () => {
    renderTutorial({ currentStep: 0 });
    expect(screen.getByTestId('tutorial-skip')).toBeTruthy();
    expect(screen.getByTestId('tutorial-skip').textContent).toBe('跳过');
  });

  // 8. 最后一步显示完成按钮
  it('shows "完成" button on last step', () => {
    renderTutorial({ currentStep: 3 });
    expect(screen.getByTestId('tutorial-complete-btn')).toBeTruthy();
    expect(screen.getByTestId('tutorial-complete-btn').textContent).toBe('完成');
    // 不显示下一步
    expect(screen.queryByTestId('tutorial-next')).toBeNull();
  });

  // 9. 步骤进度指示器（圆点 + 计数）
  it('renders progress dots and step counter', () => {
    renderTutorial({ currentStep: 1 });
    const dots = document.querySelectorAll('.it-progress__dot');
    expect(dots.length).toBe(4);
    // 第二个圆点应该是激活状态
    expect(dots[1].classList.contains('it-progress__dot--active')).toBe(true);
    // 步骤计数
    expect(screen.getByTestId('tutorial-step-counter').textContent).toBe('2/4');
  });

  // 10. 点击下一步触发回调
  it('calls onNext when clicking next button', async () => {
    const onNext = vi.fn();
    renderTutorial({ currentStep: 0, onNext });
    await userEvent.click(screen.getByTestId('tutorial-next'));
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  // 11. 点击跳过触发回调
  it('calls onSkip when clicking skip button', async () => {
    const onSkip = vi.fn();
    renderTutorial({ currentStep: 0, onSkip });
    await userEvent.click(screen.getByTestId('tutorial-skip'));
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  // 12. 点击完成触发完成动画
  it('shows completion animation when clicking complete', async () => {
    const onComplete = vi.fn();
    renderTutorial({ currentStep: 3, onComplete });
    await userEvent.click(screen.getByTestId('tutorial-complete-btn'));
    // 完成动画应出现
    expect(screen.getByTestId('tutorial-complete')).toBeTruthy();
    expect(screen.getByTestId('tutorial-complete').textContent).toContain('教程完成');
  });

  // 13. 高亮目标元素定位
  it('renders highlight element for target', () => {
    renderTutorial({ currentStep: 0 });
    const highlight = screen.getByTestId('tutorial-highlight');
    expect(highlight).toBeTruthy();
    expect(highlight.className).toContain('it-highlight');
  });

  // 14. 无步骤时不渲染
  it('renders nothing when steps array is empty', () => {
    const { container } = renderTutorial({ steps: [] });
    expect(container.innerHTML).toBe('');
  });

  // 15. 点击上一步触发回调
  it('calls onPrev when clicking prev button', async () => {
    const onPrev = vi.fn();
    renderTutorial({ currentStep: 2, onPrev });
    await userEvent.click(screen.getByTestId('tutorial-prev'));
    expect(onPrev).toHaveBeenCalledTimes(1);
  });

  // 16. 切换步骤时标题和描述正确更新
  it('updates title and description when step changes', () => {
    const { rerender } = renderTutorial({ currentStep: 0 });
    expect(screen.getByTestId('tutorial-title').textContent).toBe('欢迎来到三国霸业');

    rerender(
      <InteractiveTutorial
        steps={mockSteps}
        currentStep={2}
        onNext={vi.fn()}
        onPrev={vi.fn()}
        onSkip={vi.fn()}
        onComplete={vi.fn()}
      />
    );
    expect(screen.getByTestId('tutorial-title').textContent).toBe('招募你的第一位武将');
    expect(screen.getByTestId('tutorial-description').textContent).toBe('点击招募按钮获取武将');
  });
});
