/**
 * BattleSpeedControl — 战斗加速控件 测试
 *
 * 覆盖场景：
 * - 基础渲染：三档速度按钮
 * - 当前速度高亮
 * - 速度切换回调
 * - 禁用状态
 * - 4x速度特殊样式
 * - 速度指示器
 * - 键盘交互
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import BattleSpeedControl from '../BattleSpeedControl';
import type { BattleSpeedLevel } from '../BattleSpeedControl';

// ── Mock CSS ──
vi.mock('../BattleSpeedControl.css', () => ({}));

// ── 测试 ──

describe('BattleSpeedControl', () => {
  const onSpeedChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ═══════════════════════════════════════════
  // 1. 基础渲染
  // ═══════════════════════════════════════════

  it('应渲染速度控件容器', () => {
    render(<BattleSpeedControl currentSpeed={1} onSpeedChange={onSpeedChange} />);
    expect(screen.getByTestId('battle-speed-control')).toBeInTheDocument();
  });

  it('应渲染三档速度按钮', () => {
    render(<BattleSpeedControl currentSpeed={1} onSpeedChange={onSpeedChange} />);
    expect(screen.getByTestId('speed-btn-1x')).toBeInTheDocument();
    expect(screen.getByTestId('speed-btn-2x')).toBeInTheDocument();
    expect(screen.getByTestId('speed-btn-4x')).toBeInTheDocument();
  });

  it('应显示速度标签', () => {
    render(<BattleSpeedControl currentSpeed={1} onSpeedChange={onSpeedChange} />);
    expect(screen.getByText('1x')).toBeInTheDocument();
    expect(screen.getByText('2x')).toBeInTheDocument();
    expect(screen.getByText('4x')).toBeInTheDocument();
  });

  // ═══════════════════════════════════════════
  // 2. 当前速度高亮
  // ═══════════════════════════════════════════

  it('1x速度时1x按钮应高亮', () => {
    render(<BattleSpeedControl currentSpeed={1} onSpeedChange={onSpeedChange} />);
    expect(screen.getByTestId('speed-btn-1x')).toHaveClass('tk-speed-btn--active');
    expect(screen.getByTestId('speed-btn-2x')).not.toHaveClass('tk-speed-btn--active');
  });

  it('2x速度时2x按钮应高亮', () => {
    render(<BattleSpeedControl currentSpeed={2} onSpeedChange={onSpeedChange} />);
    expect(screen.getByTestId('speed-btn-2x')).toHaveClass('tk-speed-btn--active');
    expect(screen.getByTestId('speed-btn-1x')).not.toHaveClass('tk-speed-btn--active');
  });

  it('4x速度时4x按钮应高亮', () => {
    render(<BattleSpeedControl currentSpeed={4} onSpeedChange={onSpeedChange} />);
    expect(screen.getByTestId('speed-btn-4x')).toHaveClass('tk-speed-btn--active');
  });

  it('4x按钮应有fast特殊样式', () => {
    render(<BattleSpeedControl currentSpeed={4} onSpeedChange={onSpeedChange} />);
    expect(screen.getByTestId('speed-btn-4x')).toHaveClass('tk-speed-btn--fast');
  });

  // ═══════════════════════════════════════════
  // 3. 速度切换回调
  // ═══════════════════════════════════════════

  it('点击2x应调用onSpeedChange(2)', () => {
    render(<BattleSpeedControl currentSpeed={1} onSpeedChange={onSpeedChange} />);
    fireEvent.click(screen.getByTestId('speed-btn-2x'));
    expect(onSpeedChange).toHaveBeenCalledWith(2);
  });

  it('点击4x应调用onSpeedChange(4)', () => {
    render(<BattleSpeedControl currentSpeed={1} onSpeedChange={onSpeedChange} />);
    fireEvent.click(screen.getByTestId('speed-btn-4x'));
    expect(onSpeedChange).toHaveBeenCalledWith(4);
  });

  it('点击当前速度不应调用回调', () => {
    render(<BattleSpeedControl currentSpeed={1} onSpeedChange={onSpeedChange} />);
    fireEvent.click(screen.getByTestId('speed-btn-1x'));
    expect(onSpeedChange).not.toHaveBeenCalled();
  });

  // ═══════════════════════════════════════════
  // 4. 禁用状态
  // ═══════════════════════════════════════════

  it('禁用时所有按钮应不可点击', () => {
    render(<BattleSpeedControl currentSpeed={1} onSpeedChange={onSpeedChange} disabled />);
    expect(screen.getByTestId('speed-btn-1x')).toBeDisabled();
    expect(screen.getByTestId('speed-btn-2x')).toBeDisabled();
    expect(screen.getByTestId('speed-btn-4x')).toBeDisabled();
  });

  it('禁用时点击不应触发回调', () => {
    render(<BattleSpeedControl currentSpeed={1} onSpeedChange={onSpeedChange} disabled />);
    fireEvent.click(screen.getByTestId('speed-btn-2x'));
    expect(onSpeedChange).not.toHaveBeenCalled();
  });

  // ═══════════════════════════════════════════
  // 5. 速度指示器
  // ═══════════════════════════════════════════

  it('showIndicator=true时应显示速度指示器', () => {
    render(<BattleSpeedControl currentSpeed={2} onSpeedChange={onSpeedChange} showIndicator />);
    expect(screen.getByText('2x', { selector: '.tk-speed-indicator-value' })).toBeInTheDocument();
  });

  it('showIndicator=false时不应显示速度指示器', () => {
    render(<BattleSpeedControl currentSpeed={2} onSpeedChange={onSpeedChange} showIndicator={false} />);
    expect(screen.queryByText('⏩')).not.toBeInTheDocument();
  });

  // ═══════════════════════════════════════════
  // 6. ARIA 属性
  // ═══════════════════════════════════════════

  it('容器应有radiogroup角色', () => {
    render(<BattleSpeedControl currentSpeed={1} onSpeedChange={onSpeedChange} />);
    expect(screen.getByTestId('battle-speed-control')).toHaveAttribute('role', 'radiogroup');
  });

  it('按钮应有radio角色', () => {
    render(<BattleSpeedControl currentSpeed={1} onSpeedChange={onSpeedChange} />);
    expect(screen.getByTestId('speed-btn-1x')).toHaveAttribute('role', 'radio');
  });

  it('当前速度按钮应有aria-checked=true', () => {
    render(<BattleSpeedControl currentSpeed={2} onSpeedChange={onSpeedChange} />);
    expect(screen.getByTestId('speed-btn-2x')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('speed-btn-1x')).toHaveAttribute('aria-checked', 'false');
  });

  // ═══════════════════════════════════════════
  // 7. 键盘交互
  // ═══════════════════════════════════════════

  it('按Enter应触发速度切换', () => {
    render(<BattleSpeedControl currentSpeed={1} onSpeedChange={onSpeedChange} />);
    fireEvent.keyDown(screen.getByTestId('speed-btn-2x'), { key: 'Enter' });
    expect(onSpeedChange).toHaveBeenCalledWith(2);
  });

  it('按空格应触发速度切换', () => {
    render(<BattleSpeedControl currentSpeed={1} onSpeedChange={onSpeedChange} />);
    fireEvent.keyDown(screen.getByTestId('speed-btn-4x'), { key: ' ' });
    expect(onSpeedChange).toHaveBeenCalledWith(4);
  });
});
