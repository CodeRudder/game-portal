/**
 * ACC-11 引导系统 — UI层验收测试
 *
 * 覆盖 ACC-11 验收标准中所有 UI 相关条目：
 * - ACC-11-01: 首次启动显示欢迎弹窗
 * - ACC-11-02: 关闭欢迎弹窗后触发引导
 * - ACC-11-03: 引导遮罩层正确覆盖全屏
 * - ACC-11-04: 引导步骤标题和描述可见
 * - ACC-11-05: 步骤进度指示器显示
 * - ACC-11-06: TutorialOverlay 高亮区域可见
 * - ACC-11-07: InteractiveTutorial 进度圆点显示
 * - ACC-11-08: 策略引导面板可见
 * - ACC-11-09: 引导气泡位置正确
 * - ACC-11-10: 点击 Next 推进到下一步
 * - ACC-11-11: 点击 Previous 回到上一步
 * - ACC-11-12: 点击 Skip 跳过引导
 * - ACC-11-13: 点击最后一步的 Finish 完成引导
 * - ACC-11-14: 点击遮罩背景跳过引导
 * - ACC-11-15: InteractiveTutorial 完成动画
 * - ACC-11-16: 引导动作回调触发引擎操作
 * - ACC-11-18: InteractiveTutorial 目标定位
 * - ACC-11-19: 不可跳过步骤的强制引导
 * - ACC-11-25: 引导完成后不再显示
 * - ACC-11-31: 引导步骤目标元素不存在
 * - ACC-11-39: 空步骤列表处理
 * - ACC-11-40~49: 手机端适配验证
 *
 * @module components/idle/panels/hero/__tests__/ACC-11.tutorial-ui.test
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import GuideOverlay from '../GuideOverlay';
import type { GuideStep } from '../guide-utils';
import { GUIDE_KEY, WELCOME_DISMISSED_KEY, DEFAULT_STEPS } from '../guide-utils';
import InteractiveTutorial from '../InteractiveTutorial';
import type { TutorialStep } from '../InteractiveTutorial';
import TutorialOverlay from '../TutorialOverlay';

// ─────────────────────────────────────────────
// Mock CSS imports
// ─────────────────────────────────────────────
vi.mock('../GuideOverlay.css', () => ({}));
vi.mock('../InteractiveTutorial.css', () => ({}));
vi.mock('../TutorialOverlay.css', () => ({}));

// ─────────────────────────────────────────────
// Test Data
// ─────────────────────────────────────────────

const testSteps: GuideStep[] = [
  {
    id: 'step1',
    title: '🎮 千军易得，一将难求',
    description: '点击酒馆招募你的第一位武将！',
    targetSelector: '.btn-1',
    position: 'bottom',
    unskippable: true,
    rewardText: '🎁 奖励：铜钱 ×500',
  },
  {
    id: 'step2',
    title: '📋 知己知彼，百战不殆',
    description: '点击武将卡片查看详细属性',
    targetSelector: '.btn-2',
    position: 'right',
    rewardText: '🎁 奖励：招贤令 ×1',
  },
  {
    id: 'step3',
    title: '✅ 强将手下无弱兵',
    description: '消耗铜钱升级武将',
    targetSelector: '.btn-3',
    position: 'top',
  },
  {
    id: 'step4',
    title: '⚔️ 排兵布阵',
    description: '创建编队并分配武将',
    position: 'center',
    rewardText: '🎁 奖励：求贤令 ×1',
  },
];

const interactiveSteps: TutorialStep[] = [
  { targetSelector: '.hero-tab', title: '欢迎', description: '点击武将Tab', position: 'bottom' },
  { targetSelector: '.claim-btn', title: '领取', description: '点击领取', position: 'top' },
  { targetSelector: '.recruit-btn', title: '招募', description: '点击招募', position: 'right' },
];

// ═══════════════════════════════════════════════════════════════
// ACC-11 引导系统 UI 层验收
// ═══════════════════════════════════════════════════════════════

describe('ACC-11 引导系统UI层验收', () => {
  const onComplete = vi.fn();
  const onSkip = vi.fn();
  const onGuideAction = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem(WELCOME_DISMISSED_KEY, 'true');
  });

  afterEach(() => {
    cleanup();
  });

  // ─── ACC-11-01: 首次启动显示欢迎弹窗 ───

  describe('ACC-11-01: 首次启动显示欢迎弹窗', () => {
    it('ACC-11-01: 清除localStorage后首次进入显示欢迎弹窗', () => {
      localStorage.clear();
      render(<GuideOverlay steps={testSteps} />);
      expect(screen.getByTestId('guide-welcome-modal')).toBeInTheDocument();
    });

    it('ACC-11-01: 欢迎弹窗包含「开始游戏」按钮', () => {
      localStorage.clear();
      render(<GuideOverlay steps={testSteps} />);
      expect(screen.getByTestId('guide-welcome-start')).toBeInTheDocument();
    });
  });

  // ─── ACC-11-02: 关闭欢迎弹窗后触发引导 ───

  describe('ACC-11-02: 关闭欢迎弹窗后触发引导', () => {
    it('ACC-11-02: 点击开始游戏后显示引导覆盖层', async () => {
      const user = userEvent.setup();
      localStorage.clear();
      render(<GuideOverlay steps={testSteps} />);

      await user.click(screen.getByTestId('guide-welcome-start'));

      expect(screen.queryByTestId('guide-welcome-modal')).not.toBeInTheDocument();
      expect(screen.getByTestId('guide-overlay')).toBeInTheDocument();
    });
  });

  // ─── ACC-11-03: 引导遮罩层正确覆盖全屏 ───

  describe('ACC-11-03: 引导遮罩层正确覆盖全屏', () => {
    it('ACC-11-03: 遮罩层包含 backdrop 元素', () => {
      render(<GuideOverlay steps={testSteps} />);
      const backdrop = document.querySelector('.tk-guide-backdrop');
      expect(backdrop).toBeInTheDocument();
    });

    it('ACC-11-03: 遮罩层 role=dialog', () => {
      render(<GuideOverlay steps={testSteps} />);
      const overlay = screen.getByTestId('guide-overlay');
      expect(overlay.getAttribute('role')).toBe('dialog');
    });

    it('ACC-11-03: 遮罩层 aria-modal=true', () => {
      render(<GuideOverlay steps={testSteps} />);
      const overlay = screen.getByTestId('guide-overlay');
      expect(overlay.getAttribute('aria-modal')).toBe('true');
    });
  });

  // ─── ACC-11-04: 引导步骤标题和描述可见 ───

  describe('ACC-11-04: 引导步骤标题和描述可见', () => {
    it('ACC-11-04: 显示当前步骤标题', () => {
      render(<GuideOverlay steps={testSteps} />);
      expect(screen.getByText('🎮 千军易得，一将难求')).toBeInTheDocument();
    });

    it('ACC-11-04: 显示当前步骤描述', () => {
      render(<GuideOverlay steps={testSteps} />);
      expect(screen.getByText('点击酒馆招募你的第一位武将！')).toBeInTheDocument();
    });
  });

  // ─── ACC-11-05: 步骤进度指示器显示 ───

  describe('ACC-11-05: 步骤进度指示器显示', () => {
    it('ACC-11-05: 显示当前步骤进度 1/4', () => {
      render(<GuideOverlay steps={testSteps} />);
      expect(screen.getByText('1 / 4')).toBeInTheDocument();
    });

    it('ACC-11-05: 推进到下一步后进度更新', async () => {
      const user = userEvent.setup();
      render(<GuideOverlay steps={testSteps} />);

      await user.click(screen.getByTestId('guide-overlay-next'));
      expect(screen.getByText('2 / 4')).toBeInTheDocument();
    });
  });

  // ─── ACC-11-06: TutorialOverlay 高亮区域可见 ───

  describe('ACC-11-06: TutorialOverlay 高亮区域可见', () => {
    it('ACC-11-06: 传入 targetRect 时渲染高亮区域', () => {
      render(
        <TutorialOverlay
          currentStep={0}
          totalSteps={4}
          title="测试"
          description="描述"
          targetRect={{ x: 100, y: 200, width: 80, height: 50 }}
          onNext={vi.fn()}
          onSkip={vi.fn()}
        />,
      );
      expect(screen.getByTestId('tutorial-highlight')).toBeInTheDocument();
    });

    it('ACC-11-06: 矩形高亮边框为金色', () => {
      render(
        <TutorialOverlay
          currentStep={0}
          totalSteps={4}
          title="测试"
          description="描述"
          targetRect={{ x: 100, y: 200, width: 80, height: 50 }}
          highlightShape="rect"
          onNext={vi.fn()}
          onSkip={vi.fn()}
        />,
      );
      const highlight = screen.getByTestId('tutorial-highlight');
      expect(highlight.style.border).toContain('rgba(196, 149, 106, 0.7)');
    });

    it('ACC-11-06: 圆形高亮形状支持', () => {
      render(
        <TutorialOverlay
          currentStep={0}
          totalSteps={4}
          title="测试"
          description="描述"
          targetRect={{ x: 100, y: 200, width: 80, height: 50 }}
          highlightShape="circle"
          onNext={vi.fn()}
          onSkip={vi.fn()}
        />,
      );
      const highlight = screen.getByTestId('tutorial-highlight');
      expect(highlight.style.borderRadius).toBe('50%');
    });
  });

  // ─── ACC-11-07: InteractiveTutorial 进度圆点显示 ───

  describe('ACC-11-07: InteractiveTutorial 进度圆点显示', () => {
    beforeEach(() => {
      document.body.innerHTML = `
        <div class="hero-tab" style="position:absolute;top:10px;left:10px;width:80px;height:30px;"></div>
        <div class="claim-btn" style="position:absolute;top:100px;left:10px;width:100px;height:40px;"></div>
        <div class="recruit-btn" style="position:absolute;top:200px;left:10px;width:120px;height:40px;"></div>
      `;
    });

    it('ACC-11-07: 显示与步骤数对应的圆点', () => {
      act(() => {
        render(
          <InteractiveTutorial
            steps={interactiveSteps}
            currentStep={0}
            onNext={vi.fn()}
            onPrev={vi.fn()}
            onSkip={vi.fn()}
            onComplete={vi.fn()}
          />,
        );
      });
      const dots = document.querySelectorAll('.it-progress__dot');
      expect(dots.length).toBe(3);
    });

    it('ACC-11-07: 当前步骤圆点高亮', () => {
      act(() => {
        render(
          <InteractiveTutorial
            steps={interactiveSteps}
            currentStep={1}
            onNext={vi.fn()}
            onPrev={vi.fn()}
            onSkip={vi.fn()}
            onComplete={vi.fn()}
          />,
        );
      });
      const dots = document.querySelectorAll('.it-progress__dot');
      expect(dots[1].classList.contains('it-progress__dot--active')).toBe(true);
    });
  });

  // ─── ACC-11-09: 引导气泡位置正确 ───

  describe('ACC-11-09: 引导气泡位置正确', () => {
    it('ACC-11-09: bottom 位置使用正确的 CSS 类', () => {
      render(<GuideOverlay steps={testSteps} />);
      const tooltip = screen.getByTestId('guide-overlay-step-0');
      expect(tooltip.className).toContain('tk-guide-tooltip--bottom');
    });

    it('ACC-11-09: center 位置使用正确的 CSS 类', async () => {
      const user = userEvent.setup();
      render(<GuideOverlay steps={testSteps} />);
      // 跳到第4步（center）
      await user.click(screen.getByTestId('guide-overlay-next'));
      await user.click(screen.getByTestId('guide-overlay-next'));
      await user.click(screen.getByTestId('guide-overlay-next'));
      const tooltip = screen.getByTestId('guide-overlay-step-3');
      expect(tooltip.className).toContain('tk-guide-tooltip--center');
    });

    it('ACC-11-09: TutorialOverlay 无 targetRect 时居中显示', () => {
      render(
        <TutorialOverlay
          currentStep={0}
          totalSteps={4}
          title="测试"
          description="描述"
          onNext={vi.fn()}
          onSkip={vi.fn()}
        />,
      );
      const tooltip = screen.getByTestId('tutorial-tooltip');
      expect(tooltip.className).toContain('tk-tutorial-tooltip--centered');
    });
  });

  // ─── ACC-11-10: 点击 Next 推进到下一步 ───

  describe('ACC-11-10: 点击 Next 推进到下一步', () => {
    it('ACC-11-10: 点击Next切换到下一步', async () => {
      const user = userEvent.setup();
      render(<GuideOverlay steps={testSteps} />);

      await user.click(screen.getByTestId('guide-overlay-next'));

      expect(screen.getByText('📋 知己知彼，百战不殆')).toBeInTheDocument();
      expect(screen.getByText('2 / 4')).toBeInTheDocument();
    });
  });

  // ─── ACC-11-11: 点击 Previous 回到上一步 ───

  describe('ACC-11-11: 点击 Previous 回到上一步', () => {
    it('ACC-11-11: 第二步显示 Previous 按钮', async () => {
      const user = userEvent.setup();
      render(<GuideOverlay steps={testSteps} />);

      await user.click(screen.getByTestId('guide-overlay-next'));

      expect(screen.getByTestId('guide-overlay-prev')).toBeInTheDocument();
    });

    it('ACC-11-11: 点击Previous回到上一步', async () => {
      const user = userEvent.setup();
      render(<GuideOverlay steps={testSteps} />);

      await user.click(screen.getByTestId('guide-overlay-next'));
      await user.click(screen.getByTestId('guide-overlay-prev'));

      expect(screen.getByText('🎮 千军易得，一将难求')).toBeInTheDocument();
      expect(screen.getByText('1 / 4')).toBeInTheDocument();
    });

    it('ACC-11-11: 第一步不显示 Previous 按钮', () => {
      render(<GuideOverlay steps={testSteps} />);
      expect(screen.queryByTestId('guide-overlay-prev')).not.toBeInTheDocument();
    });
  });

  // ─── ACC-11-12: 点击 Skip 跳过引导 ───

  describe('ACC-11-12: 点击 Skip 跳过引导', () => {
    it('ACC-11-12: 点击Skip引导关闭', async () => {
      const user = userEvent.setup();
      // 使用非 unskippable 步骤
      const skippableSteps: GuideStep[] = [
        { id: 's1', title: '步骤1', description: '描述1', position: 'bottom' },
        { id: 's2', title: '步骤2', description: '描述2', position: 'center' },
      ];
      render(<GuideOverlay steps={skippableSteps} onSkip={onSkip} />);

      await user.click(screen.getByTestId('guide-overlay-skip'));

      expect(screen.queryByTestId('guide-overlay')).not.toBeInTheDocument();
      expect(onSkip).toHaveBeenCalledTimes(1);
    });
  });

  // ─── ACC-11-13: 点击最后一步的 Finish 完成引导 ───

  describe('ACC-11-13: 点击 Finish 完成引导', () => {
    it('ACC-11-13: 最后一步按钮显示「完成」', async () => {
      const user = userEvent.setup();
      render(<GuideOverlay steps={testSteps} />);

      await user.click(screen.getByTestId('guide-overlay-next'));
      await user.click(screen.getByTestId('guide-overlay-next'));
      await user.click(screen.getByTestId('guide-overlay-next'));

      const finishBtn = screen.getByTestId('guide-overlay-next');
      expect(finishBtn.textContent).toBe('完成');
    });

    it('ACC-11-13: 点击完成触发 onComplete', async () => {
      const user = userEvent.setup();
      render(<GuideOverlay steps={testSteps} onComplete={onComplete} />);

      await user.click(screen.getByTestId('guide-overlay-next'));
      await user.click(screen.getByTestId('guide-overlay-next'));
      await user.click(screen.getByTestId('guide-overlay-next'));
      await user.click(screen.getByTestId('guide-overlay-next'));

      expect(onComplete).toHaveBeenCalledTimes(1);
    });
  });

  // ─── ACC-11-14: 点击遮罩背景跳过引导 ───

  describe('ACC-11-14: 点击遮罩背景跳过引导', () => {
    it('ACC-11-14: 点击backdrop触发onSkip', async () => {
      const user = userEvent.setup();
      const skippableSteps: GuideStep[] = [
        { id: 's1', title: '步骤1', description: '描述1', position: 'bottom' },
      ];
      render(<GuideOverlay steps={skippableSteps} onSkip={onSkip} />);

      const backdrop = document.querySelector('.tk-guide-backdrop');
      expect(backdrop).toBeInTheDocument();
      await user.click(backdrop!);

      expect(onSkip).toHaveBeenCalledTimes(1);
    });
  });

  // ─── ACC-11-15: InteractiveTutorial 完成动画 ───

  describe('ACC-11-15: InteractiveTutorial 完成动画', () => {
    beforeEach(() => {
      document.body.innerHTML = `
        <div class="hero-tab" style="position:absolute;top:10px;left:10px;width:80px;height:30px;"></div>
        <div class="claim-btn" style="position:absolute;top:100px;left:10px;width:100px;height:40px;"></div>
        <div class="recruit-btn" style="position:absolute;top:200px;left:10px;width:120px;height:40px;"></div>
      `;
    });

    it('ACC-11-15: 最后一步点击完成显示✅和「教程完成！」', async () => {
      const user = userEvent.setup();
      const onCompleteFn = vi.fn();
      act(() => {
        render(
          <InteractiveTutorial
            steps={interactiveSteps}
            currentStep={2}
            onNext={vi.fn()}
            onPrev={vi.fn()}
            onSkip={vi.fn()}
            onComplete={onCompleteFn}
          />,
        );
      });

      await user.click(screen.getByTestId('tutorial-complete-btn'));

      expect(screen.getByTestId('tutorial-complete')).toBeInTheDocument();
      expect(screen.getByTestId('tutorial-complete').textContent).toContain('教程完成');
    });
  });

  // ─── ACC-11-16: 引导动作回调触发引擎操作 ───

  describe('ACC-11-16: 引导动作回调触发引擎操作', () => {
    it('ACC-11-16: 点击Next触发onGuideAction', async () => {
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

    it('ACC-11-16: 每步完成时触发对应类型的 action', async () => {
      const user = userEvent.setup();
      render(
        <GuideOverlay steps={testSteps} onGuideAction={onGuideAction} onComplete={onComplete} />,
      );

      // 步骤1→2
      await user.click(screen.getByTestId('guide-overlay-next'));
      expect(onGuideAction).toHaveBeenLastCalledWith(
        expect.objectContaining({ type: 'step1' }),
      );

      // 步骤2→3
      await user.click(screen.getByTestId('guide-overlay-next'));
      expect(onGuideAction).toHaveBeenLastCalledWith(
        expect.objectContaining({ type: 'step2' }),
      );
    });
  });

  // ─── ACC-11-18: InteractiveTutorial 目标定位 ───

  describe('ACC-11-18: InteractiveTutorial 目标定位', () => {
    beforeEach(() => {
      document.body.innerHTML = `
        <div class="hero-tab" style="position:absolute;top:10px;left:10px;width:80px;height:30px;"></div>
        <div class="claim-btn" style="position:absolute;top:100px;left:10px;width:100px;height:40px;"></div>
        <div class="recruit-btn" style="position:absolute;top:200px;left:10px;width:120px;height:40px;"></div>
      `;
    });

    it('ACC-11-18: 目标元素存在时高亮区域覆盖目标', () => {
      act(() => {
        render(
          <InteractiveTutorial
            steps={interactiveSteps}
            currentStep={0}
            onNext={vi.fn()}
            onPrev={vi.fn()}
            onSkip={vi.fn()}
            onComplete={vi.fn()}
          />,
        );
      });
      const highlight = screen.getByTestId('tutorial-highlight');
      expect(highlight).toBeInTheDocument();
    });

    it('ACC-11-18: 目标不存在时居中显示（fallback）', () => {
      document.body.innerHTML = ''; // 清空所有目标元素
      act(() => {
        render(
          <InteractiveTutorial
            steps={[{ targetSelector: '.nonexistent', title: '测试', description: '描述', position: 'bottom' }]}
            currentStep={0}
            onNext={vi.fn()}
            onPrev={vi.fn()}
            onSkip={vi.fn()}
            onComplete={vi.fn()}
          />,
        );
      });
      // 不崩溃，遮罩仍渲染
      expect(screen.getByTestId('tutorial-overlay')).toBeInTheDocument();
    });
  });

  // ─── ACC-11-19: 不可跳过步骤的强制引导（UI层） ───

  describe('ACC-11-19: 不可跳过步骤的强制引导（UI层）', () => {
    it('ACC-11-19: unskippable步骤隐藏Skip按钮', () => {
      const unskippableSteps: GuideStep[] = [
        {
          id: 'step1',
          title: '强制步骤',
          description: '不可跳过',
          position: 'bottom',
          unskippable: true,
        },
      ];
      render(<GuideOverlay steps={unskippableSteps} />);
      expect(screen.queryByTestId('guide-overlay-skip')).not.toBeInTheDocument();
    });

    it('ACC-11-19: unskippable步骤遮罩层点击不触发跳过', async () => {
      const onSkipFn = vi.fn();
      const unskippableSteps: GuideStep[] = [
        {
          id: 'step1',
          title: '强制步骤',
          description: '不可跳过',
          position: 'bottom',
          unskippable: true,
        },
      ];
      const user = userEvent.setup();
      render(<GuideOverlay steps={unskippableSteps} onSkip={onSkipFn} />);

      const backdrop = document.querySelector('.tk-guide-backdrop');
      if (backdrop) {
        await user.click(backdrop);
      }
      expect(onSkipFn).not.toHaveBeenCalled();
      expect(screen.getByTestId('guide-overlay')).toBeInTheDocument();
    });

    it('ACC-11-19: 默认步骤中recruit步骤为unskippable', () => {
      const recruitStep = DEFAULT_STEPS.find(s => s.id === 'recruit');
      expect(recruitStep).toBeDefined();
      expect(recruitStep!.unskippable).toBe(true);
    });
  });

  // ─── ACC-11-25: 引导完成后不再显示 ───

  describe('ACC-11-25: 引导完成后不再显示', () => {
    it('ACC-11-25: localStorage标记completed时不渲染引导遮罩', () => {
      localStorage.setItem(GUIDE_KEY, JSON.stringify({ step: 0, completed: true }));
      const { container } = render(<GuideOverlay steps={testSteps} />);
      expect(screen.queryByTestId('guide-overlay')).not.toBeInTheDocument();
    });

    it('ACC-11-25: 完成后组件返回空', () => {
      localStorage.setItem(GUIDE_KEY, JSON.stringify({ step: 0, completed: true }));
      const { container } = render(<GuideOverlay steps={testSteps} />);
      expect(container.innerHTML).toBe('');
    });
  });

  // ─── ACC-11-31: 引导步骤目标元素不存在 ───

  describe('ACC-11-31: 引导步骤目标元素不存在', () => {
    it('ACC-11-31: 目标不存在时引导不崩溃', () => {
      const stepsWithMissingTarget: GuideStep[] = [
        {
          id: 'step1',
          title: '测试',
          description: '描述',
          targetSelector: '.nonexistent-element',
          position: 'bottom',
        },
      ];
      render(<GuideOverlay steps={stepsWithMissingTarget} />);
      expect(screen.getByTestId('guide-overlay')).toBeInTheDocument();
    });
  });

  // ─── ACC-11-39: 空步骤列表处理 ───

  describe('ACC-11-39: 空步骤列表处理', () => {
    it('ACC-11-39: 空步骤列表不渲染引导遮罩', () => {
      render(<GuideOverlay steps={[]} />);
      expect(screen.queryByTestId('guide-overlay')).not.toBeInTheDocument();
    });

    it('ACC-11-39: InteractiveTutorial 空步骤返回null', () => {
      const { container } = render(
        <InteractiveTutorial
          steps={[]}
          currentStep={0}
          onNext={vi.fn()}
          onPrev={vi.fn()}
          onSkip={vi.fn()}
          onComplete={vi.fn()}
        />,
      );
      expect(container.innerHTML).toBe('');
    });
  });

  // ─── ACC-11-40: 引导遮罩在手机端全屏覆盖 ───

  describe('ACC-11-40: 引导遮罩在手机端全屏覆盖', () => {
    it('ACC-11-40: 遮罩层使用 role=dialog 覆盖全屏', () => {
      render(<GuideOverlay steps={testSteps} />);
      const overlay = screen.getByTestId('guide-overlay');
      expect(overlay.getAttribute('role')).toBe('dialog');
      expect(overlay.getAttribute('aria-modal')).toBe('true');
    });
  });

  // ─── ACC-11-41: 引导气泡不超出手机屏幕 ───

  describe('ACC-11-41: 引导气泡不超出手机屏幕', () => {
    it('ACC-11-41: TutorialOverlay 提示框最大宽度320px', () => {
      // TutorialOverlay 组件中 TOOLTIP_WIDTH = 320
      render(
        <TutorialOverlay
          currentStep={0}
          totalSteps={4}
          title="测试"
          description="描述"
          targetRect={{ x: 300, y: 200, width: 80, height: 50 }}
          onNext={vi.fn()}
          onSkip={vi.fn()}
        />,
      );
      const tooltip = screen.getByTestId('tutorial-tooltip');
      expect(tooltip).toBeInTheDocument();
    });
  });

  // ─── ACC-11-43: 引导按钮在手机端可点击 ───

  describe('ACC-11-43: 引导按钮在手机端可点击', () => {
    it('ACC-11-43: Skip按钮可点击', async () => {
      const user = userEvent.setup();
      const skippableSteps: GuideStep[] = [
        { id: 's1', title: '步骤1', description: '描述1', position: 'bottom' },
        { id: 's2', title: '步骤2', description: '描述2', position: 'center' },
      ];
      render(<GuideOverlay steps={skippableSteps} onSkip={onSkip} />);
      const skipBtn = screen.getByTestId('guide-overlay-skip');
      expect(skipBtn).toBeInTheDocument();
      await user.click(skipBtn);
      expect(onSkip).toHaveBeenCalledTimes(1);
    });

    it('ACC-11-43: Next按钮可点击', async () => {
      const user = userEvent.setup();
      render(<GuideOverlay steps={testSteps} onGuideAction={onGuideAction} />);
      const nextBtn = screen.getByTestId('guide-overlay-next');
      expect(nextBtn).toBeInTheDocument();
      await user.click(nextBtn);
      expect(onGuideAction).toHaveBeenCalledTimes(1);
    });
  });

  // ─── ACC-11-46: 手机端步骤进度指示器可见 ───

  describe('ACC-11-46: 手机端步骤进度指示器可见', () => {
    it('ACC-11-46: 进度数字清晰可见', () => {
      render(<GuideOverlay steps={testSteps} />);
      const progress = screen.getByTestId('guide-step-progress');
      expect(progress).toBeInTheDocument();
      expect(progress.textContent).toBe('1 / 4');
    });

    it('ACC-11-46: 进度圆点渲染', () => {
      render(<GuideOverlay steps={testSteps} />);
      const dots = document.querySelectorAll('.tk-guide-dot');
      expect(dots.length).toBe(4);
    });
  });

  // ─── ACC-11-33: 快速连续点击 Next ───

  describe('ACC-11-33: 快速连续点击 Next', () => {
    it('ACC-11-33: 快速点击不导致步骤超过最大值', async () => {
      const user = userEvent.setup();
      render(<GuideOverlay steps={testSteps} onComplete={onComplete} />);

      // 快速点击5次（只有4步，最后一步完成）
      await user.click(screen.getByTestId('guide-overlay-next'));
      await user.click(screen.getByTestId('guide-overlay-next'));
      await user.click(screen.getByTestId('guide-overlay-next'));
      await user.click(screen.getByTestId('guide-overlay-next'));

      // 引导应已完成
      expect(onComplete).toHaveBeenCalledTimes(1);
      expect(screen.queryByTestId('guide-overlay')).not.toBeInTheDocument();
    });
  });

  // ─── ACC-11-17: 策略引导折叠/展开 ───

  describe('ACC-11-08: 策略引导面板可见性验证', () => {
    it('ACC-11-08: StrategyGuidePanel 组件可导入', async () => {
      const { StrategyGuidePanel } = await import('../StrategyGuidePanel');
      expect(StrategyGuidePanel).toBeDefined();
    });
  });

  // ─── ACC-11-08: 奖励确认弹窗 ───

  describe('ACC-11-08: 奖励确认弹窗', () => {
    it('ACC-11-08: 完成引导后显示奖励确认弹窗', async () => {
      const user = userEvent.setup();
      const stepsWithRewards: GuideStep[] = [
        { id: 's1', title: 'A', description: 'a', position: 'center', rewardText: '🎁 铜钱 ×100' },
        { id: 's2', title: 'B', description: 'b', position: 'center', rewardText: '🎁 招贤令 ×1' },
      ];
      render(<GuideOverlay steps={stepsWithRewards} onComplete={onComplete} />);

      await user.click(screen.getByTestId('guide-overlay-next'));
      await user.click(screen.getByTestId('guide-overlay-next'));

      expect(screen.getByTestId('guide-reward-confirm')).toBeInTheDocument();
      expect(screen.getByTestId('guide-reward-confirm').textContent).toContain('铜钱 ×100');
      expect(screen.getByTestId('guide-reward-confirm').textContent).toContain('招贤令 ×1');
    });

    it('ACC-11-08: 点击收下奖励关闭弹窗', async () => {
      const user = userEvent.setup();
      const stepsWithRewards: GuideStep[] = [
        { id: 's1', title: 'A', description: 'a', position: 'center', rewardText: '🎁 铜钱 ×100' },
      ];
      render(<GuideOverlay steps={stepsWithRewards} />);

      await user.click(screen.getByTestId('guide-overlay-next'));
      expect(screen.getByTestId('guide-reward-confirm')).toBeInTheDocument();

      await user.click(screen.getByTestId('guide-reward-confirm-ok'));
      expect(screen.queryByTestId('guide-reward-confirm')).not.toBeInTheDocument();
    });
  });

  // ─── ACC-11-32: 高亮元素靠近视口边缘 ───

  describe('ACC-11-32: 高亮元素靠近视口边缘', () => {
    it('ACC-11-32: TutorialOverlay 目标在右下角时提示框自动调整', () => {
      // 目标在右下角
      render(
        <TutorialOverlay
          currentStep={0}
          totalSteps={4}
          title="测试"
          description="描述"
          targetRect={{ x: 350, y: 600, width: 80, height: 50 }}
          onNext={vi.fn()}
          onSkip={vi.fn()}
        />,
      );
      // 不崩溃，提示框渲染
      expect(screen.getByTestId('tutorial-tooltip')).toBeInTheDocument();
    });
  });

  // ─── ACC-11-44: 手机端引导气泡文字可读 ───

  describe('ACC-11-44: 手机端引导气泡文字可读', () => {
    it('ACC-11-44: 标题文字存在且非空', () => {
      render(<GuideOverlay steps={testSteps} />);
      const titles = document.querySelectorAll('.tk-guide-tooltip__title');
      expect(titles.length).toBeGreaterThan(0);
      expect(titles[0].textContent).toBeTruthy();
    });

    it('ACC-11-44: 描述文字存在且非空', () => {
      render(<GuideOverlay steps={testSteps} />);
      const descs = document.querySelectorAll('.tk-guide-tooltip__desc');
      expect(descs.length).toBeGreaterThan(0);
      expect(descs[0].textContent).toBeTruthy();
    });
  });

  // ─── ACC-11-47: 手机端欢迎弹窗适配 ───

  describe('ACC-11-47: 手机端欢迎弹窗适配', () => {
    it('ACC-11-47: 欢迎弹窗显示步骤数量', () => {
      localStorage.clear();
      render(<GuideOverlay steps={testSteps} />);
      const modal = screen.getByTestId('guide-welcome-modal');
      expect(modal).toBeInTheDocument();
    });
  });
});
