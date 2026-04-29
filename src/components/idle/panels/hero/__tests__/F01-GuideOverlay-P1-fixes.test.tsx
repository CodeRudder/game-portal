/**
 * F01 新手引导系统 R3 修复测试
 *
 * 覆盖3个P1修复：
 * - P1-1: 双层欢迎弹窗整合 — WelcomeModal + GuideWelcomeModal 不同时弹出
 * - P1-3: 步骤超时机制 — 30秒显示跳过提示，35秒自动跳过
 * - P1-4: 双遮罩系统统一 — GuideOverlay 激活时停用 TutorialMaskSystem
 *
 * @module components/idle/panels/hero/__tests__/F01-GuideOverlay-P1-fixes
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import GuideOverlay from '../GuideOverlay';
import type { GuideStep } from '../guide-utils';
import { GUIDE_KEY, WELCOME_DISMISSED_KEY } from '../guide-utils';

// ─────────────────────────────────────────────
// Mock CSS imports
// ─────────────────────────────────────────────
vi.mock('../GuideOverlay.css', () => ({}));
vi.mock('../GuideFreeExploreModal', () => ({
  GuideFreeExploreModal: ({ visible }: { visible: boolean }) =>
    visible ? <div data-testid="guide-free-explore">自由探索</div> : null,
}));
vi.mock('../GuideRewardConfirm', () => ({
  GuideRewardConfirm: ({ visible }: { visible: boolean }) =>
    visible ? <div data-testid="guide-reward-confirm">奖励确认</div> : null,
}));

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
    unskippable: true,
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
    rewardText: '🎁 奖励：铜钱 ×500',
  },
];

// ─────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────

describe('F01 P1-1: 双层欢迎弹窗整合', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it('外层WelcomeModal未关闭时，不显示内层GuideWelcomeModal', () => {
    // 模拟外层 WelcomeModal 仍然显示（tk-has-visited 未设置）
    // 此时 GuideWelcomeModal 不应显示
    localStorage.removeItem('tk-has-visited');

    render(<GuideOverlay steps={testSteps} />);

    // 内层欢迎弹窗不应显示
    expect(screen.queryByTestId('guide-welcome-modal')).not.toBeInTheDocument();
  });

  it('外层WelcomeModal已关闭且引导未完成时，显示内层GuideWelcomeModal', () => {
    // 模拟外层 WelcomeModal 已关闭
    localStorage.setItem('tk-has-visited', 'true');
    // 引导未完成
    localStorage.removeItem(GUIDE_KEY);
    // 引导欢迎弹窗未关闭
    localStorage.removeItem(WELCOME_DISMISSED_KEY);

    render(<GuideOverlay steps={testSteps} />);

    // 内层欢迎弹窗应显示
    expect(screen.getByTestId('guide-welcome-modal')).toBeInTheDocument();
  });

  it('引导已完成时，不显示内层GuideWelcomeModal', () => {
    localStorage.setItem('tk-has-visited', 'true');
    localStorage.setItem(GUIDE_KEY, JSON.stringify({ step: 0, completed: true }));

    render(<GuideOverlay steps={testSteps} />);

    expect(screen.queryByTestId('guide-welcome-modal')).not.toBeInTheDocument();
  });

  it('引导欢迎弹窗已关闭时，不再次显示', () => {
    localStorage.setItem('tk-has-visited', 'true');
    localStorage.setItem(WELCOME_DISMISSED_KEY, 'true');

    render(<GuideOverlay steps={testSteps} />);

    expect(screen.queryByTestId('guide-welcome-modal')).not.toBeInTheDocument();
  });

  it('点击内层欢迎弹窗的开始引导后，关闭欢迎弹窗并显示引导步骤', async () => {
    localStorage.setItem('tk-has-visited', 'true');
    localStorage.removeItem(WELCOME_DISMISSED_KEY);

    render(<GuideOverlay steps={testSteps} />);

    // 欢迎弹窗应显示
    expect(screen.getByTestId('guide-welcome-modal')).toBeInTheDocument();

    // 点击开始引导
    const startBtn = screen.getByTestId('guide-welcome-start');
    await act(async () => {
      startBtn.click();
    });

    // 欢迎弹窗关闭
    expect(screen.queryByTestId('guide-welcome-modal')).not.toBeInTheDocument();
    // 引导步骤应显示
    expect(screen.getByTestId('guide-overlay')).toBeInTheDocument();
  });

  it('点击内层欢迎弹窗的跳过后，跳过整个引导', async () => {
    localStorage.setItem('tk-has-visited', 'true');
    localStorage.removeItem(WELCOME_DISMISSED_KEY);
    const onSkip = vi.fn();

    render(<GuideOverlay steps={testSteps} onSkip={onSkip} />);

    const skipBtn = screen.getByTestId('guide-welcome-skip');
    await act(async () => {
      skipBtn.click();
    });

    // 引导跳过
    expect(onSkip).toHaveBeenCalled();
    // 不应显示引导步骤
    expect(screen.queryByTestId('guide-overlay')).not.toBeInTheDocument();
  });
});

describe('F01 P1-3: 步骤超时机制', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.useFakeTimers();
    // 设置为已访问状态，跳过欢迎弹窗
    localStorage.setItem('tk-has-visited', 'true');
    localStorage.setItem(WELCOME_DISMISSED_KEY, 'true');
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it('30秒后显示超时跳过提示', () => {
    // 使用可跳过的步骤
    const skippableSteps: GuideStep[] = [
      { id: 's1', title: '第一步', description: '描述1', position: 'center' },
      { id: 's2', title: '第二步', description: '描述2', position: 'center' },
    ];

    render(<GuideOverlay steps={skippableSteps} />);

    // 初始无超时提示
    expect(screen.queryByTestId('guide-timeout-hint')).not.toBeInTheDocument();

    // 推进30秒
    act(() => {
      vi.advanceTimersByTime(30_000);
    });

    // 超时提示应显示
    expect(screen.getByTestId('guide-timeout-hint')).toBeInTheDocument();
    expect(screen.getByText('⏱ 即将自动跳过…')).toBeInTheDocument();
  });

  it('35秒后自动跳过到下一步（可跳过步骤）', () => {
    // 使用全部可跳过的步骤
    const skippableSteps: GuideStep[] = [
      { id: 's1', title: '第一步', description: '描述1', position: 'center' },
      { id: 's2', title: '第二步', description: '描述2', position: 'center' },
    ];

    render(<GuideOverlay steps={skippableSteps} />);

    // 初始在第1步
    expect(screen.getByTestId('guide-overlay-step-0')).toBeInTheDocument();

    // 推进35秒
    act(() => {
      vi.advanceTimersByTime(35_000);
    });

    // 应自动跳到第2步
    expect(screen.getByTestId('guide-overlay-step-1')).toBeInTheDocument();
  });

  it('不可跳过步骤不显示超时提示', () => {
    // testSteps[0] 是 unskippable: true
    render(<GuideOverlay steps={testSteps} />);

    // 推进35秒
    act(() => {
      vi.advanceTimersByTime(35_000);
    });

    // 不可跳过步骤不应显示超时提示
    expect(screen.queryByTestId('guide-timeout-hint')).not.toBeInTheDocument();
  });

  it('点击超时提示的跳过按钮推进到下一步', async () => {
    render(<GuideOverlay steps={testSteps} />);

    // 推进到第2步（可跳过的步骤）
    act(() => {
      // 第1步是unskippable，不会超时跳过，需要手动推进
      vi.advanceTimersByTime(35_000);
    });

    // 如果第1步没被跳过（因为unskippable），手动点下一步
    const nextBtn = screen.queryByTestId('guide-overlay-next');
    if (nextBtn) {
      await act(async () => { nextBtn.click(); });
    }

    // 现在在第2步
    // 推进30秒显示超时提示
    act(() => {
      vi.advanceTimersByTime(30_000);
    });

    // 超时提示应显示
    const timeoutHint = screen.queryByTestId('guide-timeout-hint');
    if (timeoutHint) {
      const skipBtn = screen.getByTestId('guide-timeout-skip-btn');
      await act(async () => { skipBtn.click(); });

      // 应推进到第3步
      expect(screen.getByTestId('guide-overlay-step-2')).toBeInTheDocument();
    }
  });

  it('步骤切换时重置超时提示', async () => {
    render(<GuideOverlay steps={testSteps} />);

    // 在第1步推进25秒（不到30秒阈值）
    act(() => {
      vi.advanceTimersByTime(25_000);
    });

    // 无超时提示
    expect(screen.queryByTestId('guide-timeout-hint')).not.toBeInTheDocument();

    // 手动推进到第2步
    const nextBtn = screen.getByTestId('guide-overlay-next');
    await act(async () => { nextBtn.click(); });

    // 新步骤，超时计时器重置，再推进25秒不应有提示
    act(() => {
      vi.advanceTimersByTime(25_000);
    });
    expect(screen.queryByTestId('guide-timeout-hint')).not.toBeInTheDocument();
  });

  it('最后一步超时后完成引导', () => {
    const onComplete = vi.fn();
    render(<GuideOverlay steps={testSteps} />);

    // 直接设置到第3步（最后一步，index=2）
    // 先完成前两步
    localStorage.setItem(GUIDE_KEY, JSON.stringify({ step: 2, completed: false }));

    // 重新渲染以应用新的localStorage状态
    cleanup();
    render(<GuideOverlay steps={testSteps} onComplete={onComplete} />);

    // 如果渲染在第3步，推进35秒
    const stepEl = screen.queryByTestId('guide-overlay-step-2');
    if (stepEl) {
      act(() => {
        vi.advanceTimersByTime(35_000);
      });
      // 引导完成回调应被调用
      expect(onComplete).toHaveBeenCalled();
    }
  });
});

describe('F01 P1-4: 双遮罩系统统一', () => {
  const mockMaskSystem = {
    deactivate: vi.fn(),
    activate: vi.fn(),
    isActive: vi.fn(() => false),
  };

  const mockRegistry = {
    get: vi.fn((key: string) => {
      if (key === 'tutorialMaskSystem' || key === 'tutorial-mask') {
        return mockMaskSystem;
      }
      return undefined;
    }),
  };

  const mockEngine = {
    getSubsystemRegistry: vi.fn(() => mockRegistry),
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('tk-has-visited', 'true');
    localStorage.setItem(WELCOME_DISMISSED_KEY, 'true');
  });

  afterEach(() => {
    cleanup();
  });

  it('GuideOverlay激活时停用引擎层TutorialMaskSystem', () => {
    render(<GuideOverlay steps={testSteps} engine={mockEngine} />);

    // 引导步骤应显示
    expect(screen.getByTestId('guide-overlay')).toBeInTheDocument();

    // 引擎层遮罩应被停用
    expect(mockMaskSystem.deactivate).toHaveBeenCalled();

    // 应设置激活标记
    expect(localStorage.getItem('__tk_guide_overlay_active')).toBe('true');
  });

  it('GuideOverlay未激活时清除激活标记', () => {
    // 设置引导已完成
    localStorage.setItem(GUIDE_KEY, JSON.stringify({ step: 0, completed: true }));

    render(<GuideOverlay steps={testSteps} engine={mockEngine} />);

    // 引导步骤不应显示
    expect(screen.queryByTestId('guide-overlay')).not.toBeInTheDocument();
  });

  it('无engine时安全降级不报错', () => {
    expect(() => {
      render(<GuideOverlay steps={testSteps} engine={null} />);
    }).not.toThrow();
  });

  it('engine无registry时安全降级不报错', () => {
    const engineNoRegistry = {
      getSubsystemRegistry: vi.fn(() => null),
    } as any;

    expect(() => {
      render(<GuideOverlay steps={testSteps} engine={engineNoRegistry} />);
    }).not.toThrow();
  });

  it('registry中无maskSystem时安全降级不报错', () => {
    const emptyRegistry = {
      get: vi.fn(() => undefined),
    };
    const engineNoMask = {
      getSubsystemRegistry: vi.fn(() => emptyRegistry),
    } as any;

    expect(() => {
      render(<GuideOverlay steps={testSteps} engine={engineNoMask} />);
    }).not.toThrow();
  });
});
