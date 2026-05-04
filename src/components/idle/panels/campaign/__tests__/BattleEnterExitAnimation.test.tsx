/**
 * BattleEnterExitAnimation — 进入/退出动画组件测试
 *
 * 覆盖场景：
 * - idle/active/done 阶段不渲染
 * - 进入动画渲染和回调
 * - 退出动画渲染（胜利/失败/平局）
 * - 动画完成后触发回调
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach, vi as vitestVi } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import BattleEnterExitAnimation from '../BattleEnterExitAnimation';

// Mock CSS
vi.mock('../BattleEnterExitAnimation.css', () => ({}));

describe('BattleEnterExitAnimation', () => {
  const onAnimationComplete = vi.fn();

  const defaultProps = {
    phase: 'idle' as const,
    exitResult: 'victory' as const,
    turnNumber: 1,
    allyNames: ['关羽', '张飞', '赵云'],
    enemyNames: ['吕布', '张辽', '典韦'],
    onAnimationComplete,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  // ═══════════════════════════════════════════
  // 1. idle/active/done 阶段不渲染
  // ═══════════════════════════════════════════

  it('idle 阶段不渲染任何内容', () => {
    const { container } = render(<BattleEnterExitAnimation {...defaultProps} phase="idle" />);
    expect(container.innerHTML).toBe('');
  });

  it('active 阶段不渲染任何内容', () => {
    const { container } = render(<BattleEnterExitAnimation {...defaultProps} phase="active" />);
    expect(container.innerHTML).toBe('');
  });

  it('done 阶段不渲染任何内容', () => {
    const { container } = render(<BattleEnterExitAnimation {...defaultProps} phase="done" />);
    expect(container.innerHTML).toBe('');
  });

  // ═══════════════════════════════════════════
  // 2. 进入动画
  // ═══════════════════════════════════════════

  it('entering 阶段应渲染进入动画', () => {
    render(<BattleEnterExitAnimation {...defaultProps} phase="entering" />);
    expect(screen.getByTestId('battle-anim-enter')).toBeInTheDocument();
  });

  it('进入动画应显示回合文字', () => {
    render(<BattleEnterExitAnimation {...defaultProps} phase="entering" turnNumber={3} />);
    expect(screen.getByText('第 3 回合')).toBeInTheDocument();
  });

  it('进入动画应显示我方武将名称', () => {
    render(<BattleEnterExitAnimation {...defaultProps} phase="entering" />);
    expect(screen.getByText('关羽')).toBeInTheDocument();
    expect(screen.getByText('张飞')).toBeInTheDocument();
    expect(screen.getByText('赵云')).toBeInTheDocument();
  });

  it('进入动画应显示敌方武将名称', () => {
    render(<BattleEnterExitAnimation {...defaultProps} phase="entering" />);
    expect(screen.getByText('吕布')).toBeInTheDocument();
    expect(screen.getByText('张辽')).toBeInTheDocument();
    expect(screen.getByText('典韦')).toBeInTheDocument();
  });

  it('进入动画应显示 VS 分隔', () => {
    render(<BattleEnterExitAnimation {...defaultProps} phase="entering" />);
    expect(screen.getByText('VS')).toBeInTheDocument();
  });

  it('进入动画 1.8s 后应调用 onAnimationComplete', () => {
    render(<BattleEnterExitAnimation {...defaultProps} phase="entering" />);
    expect(onAnimationComplete).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1800);
    });

    expect(onAnimationComplete).toHaveBeenCalledTimes(1);
  });

  // ═══════════════════════════════════════════
  // 3. 退出动画
  // ═══════════════════════════════════════════

  it('exiting 阶段应渲染退出动画', () => {
    render(<BattleEnterExitAnimation {...defaultProps} phase="exiting" />);
    expect(screen.getByTestId('battle-anim-exit')).toBeInTheDocument();
  });

  it('胜利退出应显示"大获全胜"', () => {
    render(<BattleEnterExitAnimation {...defaultProps} phase="exiting" exitResult="victory" />);
    expect(screen.getByText('大获全胜')).toBeInTheDocument();
  });

  it('失败退出应显示"战败"', () => {
    render(<BattleEnterExitAnimation {...defaultProps} phase="exiting" exitResult="defeat" />);
    // testing-library normalizes whitespace, so "战  败" becomes "战 败"
    expect(screen.getByText('战 败')).toBeInTheDocument();
  });

  it('平局退出应显示"势均力敌"', () => {
    render(<BattleEnterExitAnimation {...defaultProps} phase="exiting" exitResult="draw" />);
    expect(screen.getByText('势均力敌')).toBeInTheDocument();
  });

  it('退出动画 2s 后应调用 onAnimationComplete', () => {
    render(<BattleEnterExitAnimation {...defaultProps} phase="exiting" />);
    expect(onAnimationComplete).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(onAnimationComplete).toHaveBeenCalledTimes(1);
  });

  // ═══════════════════════════════════════════
  // 4. 空武将列表
  // ═══════════════════════════════════════════

  it('空武将列表时仍正常渲染进入动画', () => {
    render(
      <BattleEnterExitAnimation
        {...defaultProps}
        phase="entering"
        allyNames={[]}
        enemyNames={[]}
      />
    );
    expect(screen.getByTestId('battle-anim-enter')).toBeInTheDocument();
    expect(screen.getByText('第 1 回合')).toBeInTheDocument();
  });

  // ═══════════════════════════════════════════
  // 5. 最多显示3个武将
  // ═══════════════════════════════════════════

  it('超过3个武将时只显示前3个', () => {
    render(
      <BattleEnterExitAnimation
        {...defaultProps}
        phase="entering"
        allyNames={['关羽', '张飞', '赵云', '马超']}
        enemyNames={['吕布']}
      />
    );
    // 马超不应显示（超过3个限制）
    expect(screen.queryByText('马超')).not.toBeInTheDocument();
    // 前3个应显示
    expect(screen.getByText('关羽')).toBeInTheDocument();
  });
});
