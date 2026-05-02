/**
 * StrategyGuidePanel — 策略引导面板测试
 *
 * 覆盖场景：
 * 1. 渲染面板头部
 * 2. 折叠/展开切换
 * 3. 阶段列表显示
 * 4. 解锁状态判断
 * 5. 完成状态判断
 * 6. 重玩按钮
 * 7. 进度条显示
 * 8. ARIA无障碍
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrategyGuidePanel, GuideReplayButton } from '../StrategyGuidePanel';
import type { StrategyGuidePanelProps, ReplayButtonProps } from '../StrategyGuidePanel';

// ── Mock CSS ──
vi.mock('../GuideOverlay.css', () => ({}));

// ── Helper: 创建mock引擎 ──
function createMockEngine(phase: string = 'free_play', completedCount: number = 12) {
  return {
    getTutorialStateMachine: vi.fn(() => ({
      getCurrentPhase: vi.fn(() => phase),
      getCompletedStepCount: vi.fn(() => completedCount),
    })),
    getTutorialStepManager: vi.fn(() => ({
      startReplay: vi.fn(),
      getNextStep: vi.fn(() => null),
      getState: vi.fn(() => ({ activeStepId: null })),
    })),
    getSubsystemRegistry: vi.fn(() => ({
      get: vi.fn(),
    })),
  } as any;
}

// ── Helper: render ──
function renderPanel(overrides: Partial<StrategyGuidePanelProps> = {}) {
  const props: StrategyGuidePanelProps = {
    engine: null,
    onReplayTutorial: vi.fn(),
    ...overrides,
  };
  return render(<StrategyGuidePanel {...props} />);
}

describe('StrategyGuidePanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  // 1. 渲染面板头部
  it('应渲染策略引导面板', () => {
    renderPanel();
    expect(screen.getByTestId('strategy-guide-panel')).toBeInTheDocument();
  });

  it('应显示策略引导标题', () => {
    renderPanel();
    expect(screen.getByText('策略引导')).toBeInTheDocument();
  });

  it('应显示图标', () => {
    renderPanel();
    const header = screen.getByTestId('strategy-guide-toggle');
    expect(header.textContent).toContain('📋');
  });

  // 2. 折叠/展开切换
  it('默认应折叠', () => {
    renderPanel();
    expect(screen.queryByTestId('strategy-guide-content')).not.toBeInTheDocument();
  });

  it('点击头部应展开面板', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByTestId('strategy-guide-toggle'));
    expect(screen.getByTestId('strategy-guide-content')).toBeInTheDocument();
  });

  it('再次点击应折叠面板', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByTestId('strategy-guide-toggle'));
    expect(screen.getByTestId('strategy-guide-content')).toBeInTheDocument();

    await user.click(screen.getByTestId('strategy-guide-toggle'));
    expect(screen.queryByTestId('strategy-guide-content')).not.toBeInTheDocument();
  });

  // 3. 阶段列表显示（展开后）
  it('展开后应显示3个引导阶段', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByTestId('strategy-guide-toggle'));
    expect(screen.getByTestId('strategy-guide-phase-core')).toBeInTheDocument();
    expect(screen.getByTestId('strategy-guide-phase-extended')).toBeInTheDocument();
    expect(screen.getByTestId('strategy-guide-phase-strategy')).toBeInTheDocument();
  });

  it('应显示阶段标题', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByTestId('strategy-guide-toggle'));
    expect(screen.getByText('核心引导')).toBeInTheDocument();
    expect(screen.getByText('进阶引导')).toBeInTheDocument();
    expect(screen.getByText('策略精通')).toBeInTheDocument();
  });

  // 4. 解锁状态判断 — 无引擎时
  it('无引擎时核心引导应解锁', async () => {
    const user = userEvent.setup();
    renderPanel({ engine: null });

    await user.click(screen.getByTestId('strategy-guide-toggle'));
    const corePhase = screen.getByTestId('strategy-guide-phase-core');
    expect(corePhase.textContent).toContain('🎓');
  });

  it('无引擎时进阶引导应锁定', async () => {
    const user = userEvent.setup();
    renderPanel({ engine: null });

    await user.click(screen.getByTestId('strategy-guide-toggle'));
    const extendedPhase = screen.getByTestId('strategy-guide-phase-extended');
    expect(extendedPhase.textContent).toContain('🔒');
    expect(extendedPhase.textContent).toContain('未解锁');
  });

  // 5. 完成状态判断 — 有引擎且全部完成
  it('全部完成时核心引导应显示完成标记', async () => {
    const user = userEvent.setup();
    const engine = createMockEngine('free_play', 12);
    renderPanel({ engine });

    await user.click(screen.getByTestId('strategy-guide-toggle'));
    const corePhase = screen.getByTestId('strategy-guide-phase-core');
    expect(corePhase.textContent).toContain('✓');
    expect(corePhase.className).toContain('tk-strategy-guide__phase--completed');
  });

  it('全部完成时进阶引导应显示完成标记', async () => {
    const user = userEvent.setup();
    const engine = createMockEngine('free_play', 12);
    renderPanel({ engine });

    await user.click(screen.getByTestId('strategy-guide-toggle'));
    const extendedPhase = screen.getByTestId('strategy-guide-phase-extended');
    expect(extendedPhase.textContent).toContain('✓');
  });

  // 6. 重玩按钮
  it('展开后应显示重玩按钮', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByTestId('strategy-guide-toggle'));
    expect(screen.getByTestId('guide-replay-btn')).toBeInTheDocument();
    expect(screen.getByTestId('guide-replay-btn').textContent).toContain('重玩新手引导');
  });

  // 7. 进度条
  it('展开后应显示进度条', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByTestId('strategy-guide-toggle'));
    const progressbar = screen.getByRole('progressbar');
    expect(progressbar).toBeInTheDocument();
  });

  // 8. ARIA无障碍
  it('头部按钮应有aria-expanded属性', async () => {
    const user = userEvent.setup();
    renderPanel();

    const toggle = screen.getByTestId('strategy-guide-toggle');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');

    await user.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
  });

  it('内容区域应有正确的aria-hidden', async () => {
    const user = userEvent.setup();
    renderPanel();

    const region = document.getElementById('strategy-guide-content-region');
    expect(region).toBeInTheDocument();
    expect(region?.getAttribute('aria-hidden')).toBe('true');

    await user.click(screen.getByTestId('strategy-guide-toggle'));
    expect(region?.getAttribute('aria-hidden')).toBe('false');
  });
});

// ─────────────────────────────────────────────
// GuideReplayButton 独立测试
// ─────────────────────────────────────────────

describe('GuideReplayButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it('应渲染重玩按钮', () => {
    render(<GuideReplayButton />);
    expect(screen.getByTestId('guide-replay-btn')).toBeInTheDocument();
  });

  it('点击应触发onReplayTutorial', async () => {
    const onReplay = vi.fn();
    const user = userEvent.setup();
    render(<GuideReplayButton onReplayTutorial={onReplay} />);

    await user.click(screen.getByTestId('guide-replay-btn'));
    expect(onReplay).toHaveBeenCalledTimes(1);
  });

  it('点击应清除localStorage完成标记', async () => {
    localStorage.setItem('tk-tutorial-progress', JSON.stringify({ step: 5, completed: true }));
    const user = userEvent.setup();
    render(<GuideReplayButton onReplayTutorial={vi.fn()} />);

    await user.click(screen.getByTestId('guide-replay-btn'));
    const raw = localStorage.getItem('tk-tutorial-progress');
    expect(raw).toBeTruthy();
    const data = JSON.parse(raw!);
    expect(data.completed).toBe(false);
    expect(data.step).toBe(0);
  });

  it('有引擎时应调用startReplay', async () => {
    const mockStartReplay = vi.fn();
    const engine = {
      getTutorialStepManager: vi.fn(() => ({
        startReplay: mockStartReplay,
        getNextStep: vi.fn(() => null),
        getStepDefinition: vi.fn(() => null),
        getState: vi.fn(() => ({ activeStepId: null })),
      })),
      getTutorialStateMachine: vi.fn(() => ({
        getCurrentPhase: vi.fn(() => 'free_play'),
        getCompletedStepCount: vi.fn(() => 12),
      })),
      getSubsystemRegistry: vi.fn(() => ({
        get: vi.fn(),
      })),
    } as any;

    const user = userEvent.setup();
    render(<GuideReplayButton engine={engine} onReplayTutorial={vi.fn()} />);

    await user.click(screen.getByTestId('guide-replay-btn'));
    expect(mockStartReplay).toHaveBeenCalledWith('interactive');
  });
});
