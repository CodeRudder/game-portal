/**
 * BattleModeSelector — 战斗模式选择器 测试
 *
 * 覆盖场景：
 * - 基础渲染：三个模式按钮
 * - 当前模式高亮
 * - 模式切换回调
 * - 禁用状态
 * - 键盘交互
 * - ARIA 无障碍属性
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import BattleModeSelector from '../BattleModeSelector';
import { BattleMode } from '@/games/three-kingdoms/engine';

// ── Mock CSS ──
vi.mock('../BattleModeSelector.css', () => ({}));

// ── 测试 ──

describe('BattleModeSelector', () => {
  const onModeChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ═══════════════════════════════════════════
  // 1. 基础渲染
  // ═══════════════════════════════════════════

  it('应渲染模式选择器容器', () => {
    render(<BattleModeSelector currentMode={BattleMode.AUTO} onModeChange={onModeChange} />);
    expect(screen.getByTestId('battle-mode-selector')).toBeInTheDocument();
  });

  it('应渲染三个模式按钮', () => {
    render(<BattleModeSelector currentMode={BattleMode.AUTO} onModeChange={onModeChange} />);
    expect(screen.getByTestId('battle-mode-auto')).toBeInTheDocument();
    expect(screen.getByTestId('battle-mode-semi-auto')).toBeInTheDocument();
    expect(screen.getByTestId('battle-mode-manual')).toBeInTheDocument();
  });

  it('应显示模式标签', () => {
    render(<BattleModeSelector currentMode={BattleMode.AUTO} onModeChange={onModeChange} />);
    expect(screen.getByText('全自动')).toBeInTheDocument();
    expect(screen.getByText('半自动')).toBeInTheDocument();
    expect(screen.getByText('全手动')).toBeInTheDocument();
  });

  // ═══════════════════════════════════════════
  // 2. 当前模式高亮
  // ═══════════════════════════════════════════

  it('AUTO模式时全自动按钮应高亮', () => {
    render(<BattleModeSelector currentMode={BattleMode.AUTO} onModeChange={onModeChange} />);
    expect(screen.getByTestId('battle-mode-auto')).toHaveClass('tk-mode-btn--active');
    expect(screen.getByTestId('battle-mode-semi-auto')).not.toHaveClass('tk-mode-btn--active');
    expect(screen.getByTestId('battle-mode-manual')).not.toHaveClass('tk-mode-btn--active');
  });

  it('SEMI_AUTO模式时半自动按钮应高亮', () => {
    render(<BattleModeSelector currentMode={BattleMode.SEMI_AUTO} onModeChange={onModeChange} />);
    expect(screen.getByTestId('battle-mode-semi-auto')).toHaveClass('tk-mode-btn--active');
    expect(screen.getByTestId('battle-mode-auto')).not.toHaveClass('tk-mode-btn--active');
  });

  it('MANUAL模式时全手动按钮应高亮', () => {
    render(<BattleModeSelector currentMode={BattleMode.MANUAL} onModeChange={onModeChange} />);
    expect(screen.getByTestId('battle-mode-manual')).toHaveClass('tk-mode-btn--active');
    expect(screen.getByTestId('battle-mode-auto')).not.toHaveClass('tk-mode-btn--active');
  });

  // ═══════════════════════════════════════════
  // 3. 模式切换回调
  // ═══════════════════════════════════════════

  it('点击半自动按钮应调用onModeChange(SEMI_AUTO)', () => {
    render(<BattleModeSelector currentMode={BattleMode.AUTO} onModeChange={onModeChange} />);
    fireEvent.click(screen.getByTestId('battle-mode-semi-auto'));
    expect(onModeChange).toHaveBeenCalledWith(BattleMode.SEMI_AUTO);
  });

  it('点击全手动按钮应调用onModeChange(MANUAL)', () => {
    render(<BattleModeSelector currentMode={BattleMode.AUTO} onModeChange={onModeChange} />);
    fireEvent.click(screen.getByTestId('battle-mode-manual'));
    expect(onModeChange).toHaveBeenCalledWith(BattleMode.MANUAL);
  });

  it('点击当前模式不应调用回调', () => {
    render(<BattleModeSelector currentMode={BattleMode.AUTO} onModeChange={onModeChange} />);
    fireEvent.click(screen.getByTestId('battle-mode-auto'));
    expect(onModeChange).not.toHaveBeenCalled();
  });

  // ═══════════════════════════════════════════
  // 4. 禁用状态
  // ═══════════════════════════════════════════

  it('禁用时所有按钮应不可点击', () => {
    render(<BattleModeSelector currentMode={BattleMode.AUTO} onModeChange={onModeChange} disabled />);
    expect(screen.getByTestId('battle-mode-auto')).toBeDisabled();
    expect(screen.getByTestId('battle-mode-semi-auto')).toBeDisabled();
    expect(screen.getByTestId('battle-mode-manual')).toBeDisabled();
  });

  it('禁用时点击不应触发回调', () => {
    render(<BattleModeSelector currentMode={BattleMode.AUTO} onModeChange={onModeChange} disabled />);
    fireEvent.click(screen.getByTestId('battle-mode-semi-auto'));
    expect(onModeChange).not.toHaveBeenCalled();
  });

  // ═══════════════════════════════════════════
  // 5. ARIA 属性
  // ═══════════════════════════════════════════

  it('容器应有radiogroup角色', () => {
    render(<BattleModeSelector currentMode={BattleMode.AUTO} onModeChange={onModeChange} />);
    expect(screen.getByTestId('battle-mode-selector')).toHaveAttribute('role', 'radiogroup');
  });

  it('按钮应有radio角色', () => {
    render(<BattleModeSelector currentMode={BattleMode.AUTO} onModeChange={onModeChange} />);
    expect(screen.getByTestId('battle-mode-auto')).toHaveAttribute('role', 'radio');
  });

  it('当前模式按钮应有aria-checked=true', () => {
    render(<BattleModeSelector currentMode={BattleMode.SEMI_AUTO} onModeChange={onModeChange} />);
    expect(screen.getByTestId('battle-mode-semi-auto')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('battle-mode-auto')).toHaveAttribute('aria-checked', 'false');
  });

  // ═══════════════════════════════════════════
  // 6. 键盘交互
  // ═══════════════════════════════════════════

  it('按Enter应触发模式切换', () => {
    render(<BattleModeSelector currentMode={BattleMode.AUTO} onModeChange={onModeChange} />);
    fireEvent.keyDown(screen.getByTestId('battle-mode-semi-auto'), { key: 'Enter' });
    expect(onModeChange).toHaveBeenCalledWith(BattleMode.SEMI_AUTO);
  });

  it('按空格应触发模式切换', () => {
    render(<BattleModeSelector currentMode={BattleMode.AUTO} onModeChange={onModeChange} />);
    fireEvent.keyDown(screen.getByTestId('battle-mode-manual'), { key: ' ' });
    expect(onModeChange).toHaveBeenCalledWith(BattleMode.MANUAL);
  });

  it('禁用时按Enter不应触发回调', () => {
    render(<BattleModeSelector currentMode={BattleMode.AUTO} onModeChange={onModeChange} disabled />);
    fireEvent.keyDown(screen.getByTestId('battle-mode-semi-auto'), { key: 'Enter' });
    expect(onModeChange).not.toHaveBeenCalled();
  });
});
