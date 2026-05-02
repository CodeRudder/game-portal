/**
 * BattleSpeedControl — 战斗加速控件 测试
 *
 * 覆盖场景：
 * - 基础渲染：四档速度按钮（1x / 2x / 3x / 极速）
 * - 当前速度高亮
 * - 速度切换回调
 * - 禁用状态
 * - 高速特殊样式
 * - 速度指示器
 * - 键盘交互
 * - v3.0 P1：VIP锁图标 + 等级提示
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import BattleSpeedControl from '../BattleSpeedControl';
import type { BattleSpeedLevel } from '../BattleSpeedControl';
import { buildSpeedTiers } from '../BattleSpeedControl';

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

  it('应渲染四档速度按钮', () => {
    render(<BattleSpeedControl currentSpeed={1} onSpeedChange={onSpeedChange} />);
    expect(screen.getByTestId('speed-btn-1x')).toBeInTheDocument();
    expect(screen.getByTestId('speed-btn-2x')).toBeInTheDocument();
    expect(screen.getByTestId('speed-btn-3x')).toBeInTheDocument();
    expect(screen.getByTestId('speed-btn-极速')).toBeInTheDocument();
  });

  it('应显示速度标签', () => {
    render(<BattleSpeedControl currentSpeed={1} onSpeedChange={onSpeedChange} />);
    expect(screen.getByText('1x')).toBeInTheDocument();
    expect(screen.getByText('2x')).toBeInTheDocument();
    expect(screen.getByText('3x')).toBeInTheDocument();
    expect(screen.getByText('极速')).toBeInTheDocument();
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

  it('3x速度时3x按钮应高亮', () => {
    render(<BattleSpeedControl currentSpeed={3} onSpeedChange={onSpeedChange} />);
    expect(screen.getByTestId('speed-btn-3x')).toHaveClass('tk-speed-btn--active');
  });

  it('极速时极速按钮应高亮', () => {
    render(<BattleSpeedControl currentSpeed={8} onSpeedChange={onSpeedChange} />);
    expect(screen.getByTestId('speed-btn-极速')).toHaveClass('tk-speed-btn--active');
  });

  it('3x和极速按钮应有fast特殊样式', () => {
    render(<BattleSpeedControl currentSpeed={1} onSpeedChange={onSpeedChange} />);
    expect(screen.getByTestId('speed-btn-3x')).toHaveClass('tk-speed-btn--fast');
    expect(screen.getByTestId('speed-btn-极速')).toHaveClass('tk-speed-btn--fast');
  });

  // ═══════════════════════════════════════════
  // 3. 速度切换回调
  // ═══════════════════════════════════════════

  it('点击2x应调用onSpeedChange(2)', () => {
    render(<BattleSpeedControl currentSpeed={1} onSpeedChange={onSpeedChange} />);
    fireEvent.click(screen.getByTestId('speed-btn-2x'));
    expect(onSpeedChange).toHaveBeenCalledWith(2);
  });

  it('点击当前速度不应调用回调', () => {
    render(<BattleSpeedControl currentSpeed={1} onSpeedChange={onSpeedChange} />);
    fireEvent.click(screen.getByTestId('speed-btn-1x'));
    expect(onSpeedChange).not.toHaveBeenCalled();
  });

  // ═══════════════════════════════════════════
  // 4. 禁用状态
  // ═══════════════════════════════════════════

  it('禁用时免费按钮应不可点击', () => {
    render(<BattleSpeedControl currentSpeed={1} onSpeedChange={onSpeedChange} disabled />);
    expect(screen.getByTestId('speed-btn-1x')).toBeDisabled();
    expect(screen.getByTestId('speed-btn-2x')).toBeDisabled();
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

  it('极速模式指示器显示极速文本', () => {
    render(<BattleSpeedControl currentSpeed={8} onSpeedChange={onSpeedChange} showIndicator />);
    expect(screen.getByText('极速', { selector: '.tk-speed-indicator-value' })).toBeInTheDocument();
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
    fireEvent.keyDown(screen.getByTestId('speed-btn-2x'), { key: ' ' });
    expect(onSpeedChange).toHaveBeenCalledWith(2);
  });

  // ═══════════════════════════════════════════
  // 8. v3.0 P1：VIP锁图标
  // ═══════════════════════════════════════════

  describe('VIP锁图标', () => {
    it('VIP0时3x和极速应显示锁图标', () => {
      render(<BattleSpeedControl currentSpeed={1} onSpeedChange={onSpeedChange} vipLevel={0} />);
      expect(screen.getByTestId('speed-lock-3x')).toBeInTheDocument();
      expect(screen.getByTestId('speed-lock-极速')).toBeInTheDocument();
    });

    it('VIP0时3x和极速应显示VIP等级提示', () => {
      render(<BattleSpeedControl currentSpeed={1} onSpeedChange={onSpeedChange} vipLevel={0} />);
      expect(screen.getByTestId('speed-vip-hint-3x')).toHaveTextContent('VIP3');
      expect(screen.getByTestId('speed-vip-hint-极速')).toHaveTextContent('VIP5');
    });

    it('VIP0时3x和极速应被禁用', () => {
      render(<BattleSpeedControl currentSpeed={1} onSpeedChange={onSpeedChange} vipLevel={0} />);
      expect(screen.getByTestId('speed-btn-3x')).toBeDisabled();
      expect(screen.getByTestId('speed-btn-极速')).toBeDisabled();
    });

    it('VIP0时点击锁定的3x不应触发回调', () => {
      render(<BattleSpeedControl currentSpeed={1} onSpeedChange={onSpeedChange} vipLevel={0} />);
      fireEvent.click(screen.getByTestId('speed-btn-3x'));
      expect(onSpeedChange).not.toHaveBeenCalled();
    });

    it('VIP2时3x仍锁定但极速也锁定', () => {
      render(<BattleSpeedControl currentSpeed={1} onSpeedChange={onSpeedChange} vipLevel={2} />);
      expect(screen.getByTestId('speed-lock-3x')).toBeInTheDocument();
      expect(screen.getByTestId('speed-lock-极速')).toBeInTheDocument();
    });

    it('VIP3时3x解锁，极速仍锁定', () => {
      render(<BattleSpeedControl currentSpeed={1} onSpeedChange={onSpeedChange} vipLevel={3} />);
      expect(screen.queryByTestId('speed-lock-3x')).not.toBeInTheDocument();
      expect(screen.getByTestId('speed-lock-极速')).toBeInTheDocument();
      expect(screen.getByTestId('speed-btn-3x')).not.toBeDisabled();
      expect(screen.getByTestId('speed-btn-极速')).toBeDisabled();
    });

    it('VIP3时可以切换到3x', () => {
      render(<BattleSpeedControl currentSpeed={1} onSpeedChange={onSpeedChange} vipLevel={3} />);
      fireEvent.click(screen.getByTestId('speed-btn-3x'));
      expect(onSpeedChange).toHaveBeenCalledWith(3);
    });

    it('VIP5时所有速度档位解锁', () => {
      render(<BattleSpeedControl currentSpeed={1} onSpeedChange={onSpeedChange} vipLevel={5} />);
      expect(screen.queryByTestId('speed-lock-3x')).not.toBeInTheDocument();
      expect(screen.queryByTestId('speed-lock-极速')).not.toBeInTheDocument();
      expect(screen.getByTestId('speed-btn-3x')).not.toBeDisabled();
      expect(screen.getByTestId('speed-btn-极速')).not.toBeDisabled();
    });

    it('VIP5时可以切换到极速', () => {
      render(<BattleSpeedControl currentSpeed={1} onSpeedChange={onSpeedChange} vipLevel={5} />);
      fireEvent.click(screen.getByTestId('speed-btn-极速'));
      expect(onSpeedChange).toHaveBeenCalledWith(8);
    });

    it('1x和2x不应有锁图标', () => {
      render(<BattleSpeedControl currentSpeed={1} onSpeedChange={onSpeedChange} vipLevel={0} />);
      expect(screen.queryByTestId('speed-lock-1x')).not.toBeInTheDocument();
      expect(screen.queryByTestId('speed-lock-2x')).not.toBeInTheDocument();
    });
  });

  // ═══════════════════════════════════════════
  // 9. buildSpeedTiers 工具函数
  // ═══════════════════════════════════════════

  describe('buildSpeedTiers', () => {
    it('应返回4个速度档位', () => {
      const tiers = buildSpeedTiers(0);
      expect(tiers).toHaveLength(4);
    });

    it('VIP0时3x和极速应被锁定', () => {
      const tiers = buildSpeedTiers(0);
      expect(tiers[2].vipLock?.isUnlocked).toBe(false);
      expect(tiers[3].vipLock?.isUnlocked).toBe(false);
    });

    it('VIP3时3x应解锁', () => {
      const tiers = buildSpeedTiers(3);
      expect(tiers[2].vipLock?.isUnlocked).toBe(true);
      expect(tiers[3].vipLock?.isUnlocked).toBe(false);
    });

    it('VIP5时所有档位应解锁', () => {
      const tiers = buildSpeedTiers(5);
      expect(tiers[2].vipLock?.isUnlocked).toBe(true);
      expect(tiers[3].vipLock?.isUnlocked).toBe(true);
    });
  });
});
