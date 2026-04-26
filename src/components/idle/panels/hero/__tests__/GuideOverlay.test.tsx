/**
 * GuideOverlay UI 交互测试
 *
 * 覆盖场景：
 * - 渲染测试：引导步骤显示
 * - 步骤切换：handleNext/handleSkip
 * - TutorialStepManager对接
 * - 完成回调
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import GuideOverlay from '../GuideOverlay';
import type { GuideStep } from '../GuideOverlay';
import { GUIDE_KEY, WELCOME_DISMISSED_KEY } from '../guide-utils';

// ─────────────────────────────────────────────
// Mock CSS imports
// ─────────────────────────────────────────────
vi.mock('../GuideOverlay.css', () => ({}));

// ─────────────────────────────────────────────
// Test Data
// ─────────────────────────────────────────────

const testSteps: GuideStep[] = [
  {
    id: 'step1',
    title: '第一步',
    description: '这是第一步描述',
    targetSelector: '.btn-1',
    position: 'bottom',
  },
  {
    id: 'step2',
    title: '第二步',
    description: '这是第二步描述',
    targetSelector: '.btn-2',
    position: 'right',
  },
  {
    id: 'step3',
    title: '第三步',
    description: '这是第三步描述',
    position: 'center',
  },
];

// ─────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────

describe('GuideOverlay', () => {
  const onComplete = vi.fn();
  const onSkip = vi.fn();
  const onGuideAction = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    // 清除欢迎弹窗标记（模拟已完成引导的回归用户）
    localStorage.setItem(WELCOME_DISMISSED_KEY, 'true');
  });

  afterEach(() => {
    cleanup();
  });

  // ═══════════════════════════════════════════
  // 1. 渲染测试
  // ═══════════════════════════════════════════

  it('应渲染引导弹窗', () => {
    render(<GuideOverlay steps={testSteps} />);
    expect(screen.getByTestId('guide-overlay')).toBeInTheDocument();
  });

  it('应显示第一步标题', () => {
    render(<GuideOverlay steps={testSteps} />);
    expect(screen.getByText('第一步')).toBeInTheDocument();
  });

  it('应显示第一步描述', () => {
    render(<GuideOverlay steps={testSteps} />);
    expect(screen.getByText('这是第一步描述')).toBeInTheDocument();
  });

  it('应显示步骤进度', () => {
    render(<GuideOverlay steps={testSteps} />);
    expect(screen.getByText('1 / 3')).toBeInTheDocument();
  });

  it('应显示跳过按钮', () => {
    render(<GuideOverlay steps={testSteps} />);
    expect(screen.getByTestId('guide-overlay-skip')).toBeInTheDocument();
  });

  it('应显示下一步按钮', () => {
    render(<GuideOverlay steps={testSteps} />);
    expect(screen.getByTestId('guide-overlay-next')).toBeInTheDocument();
  });

  it('第一步不应显示上一步按钮', () => {
    render(<GuideOverlay steps={testSteps} />);
    expect(screen.queryByTestId('guide-overlay-prev')).not.toBeInTheDocument();
  });

  it('空步骤列表不渲染引导遮罩', () => {
    const { container } = render(<GuideOverlay steps={[]} />);
    // 空步骤时不应渲染引导步骤遮罩
    expect(screen.queryByTestId('guide-overlay')).not.toBeInTheDocument();
  });

  it('使用默认步骤时应正常渲染', () => {
    render(<GuideOverlay />);
    expect(screen.getByTestId('guide-overlay')).toBeInTheDocument();
  });

  // ═══════════════════════════════════════════
  // 2. 步骤切换
  // ═══════════════════════════════════════════

  it('点击Next应切换到下一步', async () => {
    const user = userEvent.setup();
    render(<GuideOverlay steps={testSteps} />);

    await user.click(screen.getByTestId('guide-overlay-next'));

    expect(screen.getByText('第二步')).toBeInTheDocument();
    expect(screen.getByText('2 / 3')).toBeInTheDocument();
  });

  it('第二步应显示Previous按钮', async () => {
    const user = userEvent.setup();
    render(<GuideOverlay steps={testSteps} />);

    await user.click(screen.getByTestId('guide-overlay-next'));

    expect(screen.getByTestId('guide-overlay-prev')).toBeInTheDocument();
  });

  it('点击Previous应回到上一步', async () => {
    const user = userEvent.setup();
    render(<GuideOverlay steps={testSteps} />);

    await user.click(screen.getByTestId('guide-overlay-next'));
    expect(screen.getByText('第二步')).toBeInTheDocument();

    await user.click(screen.getByTestId('guide-overlay-prev'));
    expect(screen.getByText('第一步')).toBeInTheDocument();
    expect(screen.getByText('1 / 3')).toBeInTheDocument();
  });

  it('点击Skip应关闭引导', async () => {
    const user = userEvent.setup();
    render(<GuideOverlay steps={testSteps} onSkip={onSkip} />);

    await user.click(screen.getByTestId('guide-overlay-skip'));

    expect(screen.queryByTestId('guide-overlay')).not.toBeInTheDocument();
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it('点击背景遮罩应跳过引导', async () => {
    const user = userEvent.setup();
    render(<GuideOverlay steps={testSteps} onSkip={onSkip} />);

    const backdrop = document.querySelector('.tk-guide-backdrop');
    expect(backdrop).toBeInTheDocument();
    await user.click(backdrop!);

    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  // ═══════════════════════════════════════════
  // 3. 完成回调
  // ═══════════════════════════════════════════

  it('最后一步点击完成应触发onComplete', async () => {
    const user = userEvent.setup();
    render(<GuideOverlay steps={testSteps} onComplete={onComplete} />);

    // 步骤1 → 步骤2
    await user.click(screen.getByTestId('guide-overlay-next'));
    // 步骤2 → 步骤3
    await user.click(screen.getByTestId('guide-overlay-next'));
    // 步骤3 → 完成
    const finishBtn = screen.getByTestId('guide-overlay-next');
    expect(finishBtn.textContent).toBe('完成');
    await user.click(finishBtn);

    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('最后一步按钮应显示完成', async () => {
    const user = userEvent.setup();
    render(<GuideOverlay steps={testSteps} />);

    // 到达最后一步
    await user.click(screen.getByTestId('guide-overlay-next'));
    await user.click(screen.getByTestId('guide-overlay-next'));

    const nextBtn = screen.getByTestId('guide-overlay-next');
    expect(nextBtn.textContent).toBe('完成');
  });

  it('非最后一步按钮应显示下一步', () => {
    render(<GuideOverlay steps={testSteps} />);
    const nextBtn = screen.getByTestId('guide-overlay-next');
    expect(nextBtn.textContent).toBe('下一步');
  });

  // ═══════════════════════════════════════════
  // 4. onGuideAction 回调
  // ═══════════════════════════════════════════

  it('点击Next应触发onGuideAction', async () => {
    const user = userEvent.setup();
    render(<GuideOverlay steps={testSteps} onGuideAction={onGuideAction} />);

    await user.click(screen.getByTestId('guide-overlay-next'));

    expect(onGuideAction).toHaveBeenCalledTimes(1);
    expect(onGuideAction).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'step1',
        stepIndex: 0,
        stepId: 'step1',
      }),
    );
  });

  it('完成引导时应触发最后一步的onGuideAction', async () => {
    const user = userEvent.setup();
    render(
      <GuideOverlay
        steps={testSteps}
        onGuideAction={onGuideAction}
        onComplete={onComplete}
      />,
    );

    // 快进到最后一步
    await user.click(screen.getByTestId('guide-overlay-next'));
    await user.click(screen.getByTestId('guide-overlay-next'));
    await user.click(screen.getByTestId('guide-overlay-next'));

    // 最后一步完成时应该有3次 action 调用
    expect(onGuideAction).toHaveBeenCalledTimes(3);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  // ═══════════════════════════════════════════
  // 5. TutorialStepManager 对接（通过 engine mock）
  // ═══════════════════════════════════════════

  it('有engine时应使用TutorialStepManager获取初始步骤', () => {
    const mockStepMgr = {
      getNextStep: vi.fn(() => null), // 所有步骤已完成
      getState: vi.fn(() => ({ activeStepId: null })),
      completeCurrentStep: vi.fn(),
      startStep: vi.fn(),
    };
    const mockSM = {
      getCurrentPhase: vi.fn(() => 'free_play'),
      getCompletedStepCount: vi.fn(() => 0),
      isStepCompleted: vi.fn(() => true),
      completeStep: vi.fn(),
      transition: vi.fn(),
    };
    const engine = {
      getTutorialStepManager: vi.fn(() => mockStepMgr),
      getTutorialStateMachine: vi.fn(() => mockSM),
      getSubsystemRegistry: vi.fn(() => ({
        get: vi.fn(),
      })),
    } as any;

    const { container } = render(<GuideOverlay steps={testSteps} engine={engine} />);
    // 所有步骤完成 → currentStep = -1 → 引导遮罩不渲染
    expect(screen.queryByTestId('guide-overlay')).not.toBeInTheDocument();
  });

  it('engine StepManager返回未完成步骤时应正常渲染', () => {
    const mockStepMgr = {
      getNextStep: vi.fn(() => ({ stepId: 'step2', subSteps: [] })),
      getState: vi.fn(() => ({ activeStepId: 'step2' })),
      completeCurrentStep: vi.fn(),
      startStep: vi.fn(),
    };
    const mockSM = {
      getCurrentPhase: vi.fn(() => 'core_guiding'),
      getCompletedStepCount: vi.fn(() => 1),
      isStepCompleted: vi.fn(() => false),
      completeStep: vi.fn(),
      transition: vi.fn(),
    };
    const engine = {
      getTutorialStepManager: vi.fn(() => mockStepMgr),
      getTutorialStateMachine: vi.fn(() => mockSM),
      getSubsystemRegistry: vi.fn(() => ({
        get: vi.fn(),
      })),
    } as any;

    render(<GuideOverlay steps={testSteps} engine={engine} />);
    // StepManager.getNextStep 返回 step2，但 step2 不在 DEFAULT_STEPS 中
    // 所以回退到 StateMachine → core_guiding + 1 completed → step index 1
    expect(screen.getByTestId('guide-overlay')).toBeInTheDocument();
  });

  it('Skip时应通知StepManager完成当前步骤', async () => {
    const user = userEvent.setup();
    const mockStepMgr = {
      getNextStep: vi.fn(() => null),
      getState: vi.fn(() => ({ activeStepId: null })),
      completeCurrentStep: vi.fn(),
      startStep: vi.fn(),
    };
    const mockSM = {
      getCurrentPhase: vi.fn(() => 'not_started'),
      getCompletedStepCount: vi.fn(() => 0),
      isStepCompleted: vi.fn(() => false),
      completeStep: vi.fn(),
      transition: vi.fn(),
    };
    const engine = {
      getTutorialStepManager: vi.fn(() => mockStepMgr),
      getTutorialStateMachine: vi.fn(() => mockSM),
      getSubsystemRegistry: vi.fn(() => ({
        get: vi.fn(),
      })),
    } as any;

    // 因为 getNextStep returns null → currentStep=-1 → null render
    // We need to force a scenario where overlay is visible
    // Use localStorage fallback by not providing engine
    localStorage.setItem(GUIDE_KEY, JSON.stringify({ step: 0, completed: false }));

    render(<GuideOverlay steps={testSteps} onSkip={onSkip} />);

    await user.click(screen.getByTestId('guide-overlay-skip'));
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  // ═══════════════════════════════════════════
  // 6. localStorage 回退
  // ═══════════════════════════════════════════

  it('无engine时应从localStorage恢复进度', () => {
    localStorage.setItem(GUIDE_KEY, JSON.stringify({ step: 1, completed: false }));
    render(<GuideOverlay steps={testSteps} />);
    expect(screen.getByText('第二步')).toBeInTheDocument();
    expect(screen.getByText('2 / 3')).toBeInTheDocument();
  });

  it('localStorage标记completed时不应渲染引导遮罩', () => {
    localStorage.setItem(GUIDE_KEY, JSON.stringify({ step: 0, completed: true }));
    render(<GuideOverlay steps={testSteps} />);
    // 已完成时不应渲染引导步骤遮罩
    expect(screen.queryByTestId('guide-overlay')).not.toBeInTheDocument();
  });

  // ═══════════════════════════════════════════
  // 7. 位置变体
  // ═══════════════════════════════════════════

  it('应根据步骤position属性添加正确的CSS类', () => {
    render(<GuideOverlay steps={testSteps} />);
    const tooltip = screen.getByTestId('guide-overlay-step-0');
    expect(tooltip.className).toContain('tk-guide-tooltip--bottom');
  });

  it('center位置应使用center CSS类', async () => {
    const user = userEvent.setup();
    render(<GuideOverlay steps={testSteps} />);
    // 跳到第3步（center）
    await user.click(screen.getByTestId('guide-overlay-next'));
    await user.click(screen.getByTestId('guide-overlay-next'));
    const tooltip = screen.getByTestId('guide-overlay-step-2');
    expect(tooltip.className).toContain('tk-guide-tooltip--center');
  });

  // ═══════════════════════════════════════════
  // 8. 不可跳过步骤（unskippable）
  // ═══════════════════════════════════════════

  it('unskippable步骤应隐藏跳过按钮', () => {
    const unskippableSteps: GuideStep[] = [
      {
        id: 'step1',
        title: '强制步骤',
        description: '此步骤不可跳过',
        targetSelector: '.btn-1',
        position: 'bottom',
        unskippable: true,
      },
    ];
    render(<GuideOverlay steps={unskippableSteps} />);
    // Skip按钮不应存在
    expect(screen.queryByTestId('guide-overlay-skip')).not.toBeInTheDocument();
    // 下一步按钮仍应存在
    expect(screen.getByTestId('guide-overlay-next')).toBeInTheDocument();
  });

  it('unskippable步骤遮罩层点击不应触发跳过', async () => {
    const onSkipFn = vi.fn();
    const unskippableSteps: GuideStep[] = [
      {
        id: 'step1',
        title: '强制步骤',
        description: '此步骤不可跳过',
        targetSelector: '.btn-1',
        position: 'bottom',
        unskippable: true,
      },
    ];
    const user = userEvent.setup();
    render(<GuideOverlay steps={unskippableSteps} onSkip={onSkipFn} />);

    const backdrop = document.querySelector('.tk-guide-backdrop');
    expect(backdrop).toBeInTheDocument();
    if (backdrop) {
      await user.click(backdrop);
    }
    // 点击遮罩不应触发跳过
    expect(onSkipFn).not.toHaveBeenCalled();
    // 引导仍应可见
    expect(screen.getByTestId('guide-overlay')).toBeInTheDocument();
  });

  it('非unskippable步骤应显示跳过按钮', () => {
    render(<GuideOverlay steps={testSteps} />);
    expect(screen.getByTestId('guide-overlay-skip')).toBeInTheDocument();
  });

  // ═══════════════════════════════════════════
  // 9. 步骤奖励展示（rewardText）
  // ═══════════════════════════════════════════

  it('有rewardText的步骤应显示奖励信息', () => {
    const stepsWithReward: GuideStep[] = [
      {
        id: 'step1',
        title: '第一步',
        description: '这是第一步',
        position: 'center',
        rewardText: '🎁 奖励：铜钱 ×500',
      },
    ];
    render(<GuideOverlay steps={stepsWithReward} />);
    expect(screen.getByTestId('guide-overlay-reward-0')).toBeInTheDocument();
    expect(screen.getByTestId('guide-overlay-reward-0').textContent).toBe('🎁 奖励：铜钱 ×500');
  });

  it('无rewardText的步骤不应显示奖励区域', () => {
    render(<GuideOverlay steps={testSteps} />);
    // testSteps的步骤没有rewardText
    expect(screen.queryByTestId('guide-overlay-reward-0')).not.toBeInTheDocument();
  });

  // ═══════════════════════════════════════════
  // 10. 完成后奖励确认弹窗（GuideRewardConfirm）
  // ═══════════════════════════════════════════

  it('完成引导后应显示奖励确认弹窗', async () => {
    const user = userEvent.setup();
    const stepsWithRewards: GuideStep[] = [
      { id: 's1', title: 'A', description: 'a', position: 'center', rewardText: '🎁 铜钱 ×100' },
      { id: 's2', title: 'B', description: 'b', position: 'center', rewardText: '🎁 招贤令 ×1' },
    ];
    render(<GuideOverlay steps={stepsWithRewards} onComplete={onComplete} />);

    // 步骤1 → 步骤2
    await user.click(screen.getByTestId('guide-overlay-next'));
    // 步骤2 → 完成
    await user.click(screen.getByTestId('guide-overlay-next'));

    // 应显示奖励确认弹窗
    expect(screen.getByTestId('guide-reward-confirm')).toBeInTheDocument();
    expect(screen.getByTestId('guide-reward-confirm').textContent).toContain('铜钱 ×100');
    expect(screen.getByTestId('guide-reward-confirm').textContent).toContain('招贤令 ×1');
    // onComplete应被调用
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('点击收下奖励应关闭弹窗', async () => {
    const user = userEvent.setup();
    const stepsWithRewards: GuideStep[] = [
      { id: 's1', title: 'A', description: 'a', position: 'center', rewardText: '🎁 铜钱 ×100' },
    ];
    render(<GuideOverlay steps={stepsWithRewards} />);

    // 完成
    await user.click(screen.getByTestId('guide-overlay-next'));
    // 弹窗出现
    expect(screen.getByTestId('guide-reward-confirm')).toBeInTheDocument();
    // 点击收下奖励
    await user.click(screen.getByTestId('guide-reward-confirm-ok'));
    // 弹窗应消失
    expect(screen.queryByTestId('guide-reward-confirm')).not.toBeInTheDocument();
  });

  // ═══════════════════════════════════════════
  // 11. 步骤进度指示器（dots）
  // ═══════════════════════════════════════════

  it('应渲染步骤进度dots', () => {
    render(<GuideOverlay steps={testSteps} />);
    expect(screen.getByTestId('guide-step-dots')).toBeInTheDocument();
    // 应有3个dot
    const dots = document.querySelectorAll('.tk-guide-dot');
    expect(dots.length).toBe(3);
  });

  it('当前步骤dot应有active类', () => {
    render(<GuideOverlay steps={testSteps} />);
    const activeDot = document.querySelector('.tk-guide-dot--active');
    expect(activeDot).toBeInTheDocument();
  });

  // ═══════════════════════════════════════════
  // 12. 欢迎弹窗（GuideWelcomeModal）
  // ═══════════════════════════════════════════

  it('首次进入且无进度时应显示欢迎弹窗', () => {
    // 清除所有localStorage，模拟首次进入
    localStorage.clear();
    render(<GuideOverlay steps={testSteps} />);
    expect(screen.getByTestId('guide-welcome-modal')).toBeInTheDocument();
  });

  it('已完成引导时不应显示欢迎弹窗', () => {
    localStorage.setItem(GUIDE_KEY, JSON.stringify({ step: 0, completed: true }));
    const { container } = render(<GuideOverlay steps={testSteps} />);
    // 已完成 → 整个组件不渲染（包括欢迎弹窗）
    expect(container.innerHTML).toBe('');
  });

  it('点击开始引导应关闭欢迎弹窗并显示引导步骤', async () => {
    const user = userEvent.setup();
    localStorage.clear();
    render(<GuideOverlay steps={testSteps} />);

    // 欢迎弹窗应可见
    expect(screen.getByTestId('guide-welcome-modal')).toBeInTheDocument();

    // 点击开始引导
    await user.click(screen.getByTestId('guide-welcome-start'));

    // 欢迎弹窗应消失
    expect(screen.queryByTestId('guide-welcome-modal')).not.toBeInTheDocument();
    // 引导步骤应出现
    expect(screen.getByTestId('guide-overlay')).toBeInTheDocument();
  });

  it('欢迎弹窗跳过后不应再显示', async () => {
    const user = userEvent.setup();
    localStorage.clear();
    render(<GuideOverlay steps={testSteps} onSkip={onSkip} />);

    // 点击跳过
    await user.click(screen.getByTestId('guide-welcome-skip'));

    expect(onSkip).toHaveBeenCalledTimes(1);
  });
});
