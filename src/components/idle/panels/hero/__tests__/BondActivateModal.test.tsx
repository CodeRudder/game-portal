/**
 * BondActivateModal — 羁绊激活弹窗测试
 *
 * 覆盖场景：
 * - 渲染羁绊详情
 * - 显示参与武将
 * - 激活状态显示
 * - 关闭按钮
 * - 效果描述正确
 * - 羁绊类型标签
 * - 遮罩层点击关闭
 * - 武将上阵状态
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import BondActivateModal from '../BondActivateModal';

// ── Mock CSS ──
vi.mock('../BondActivateModal.css', () => ({}));

// ── 默认 Props ──
const defaultProps = {
  bondId: 'bond-shu-3',
  bondName: '蜀汉三杰',
  bondType: 'faction' as const,
  requiredHeroes: [
    { id: 'guanyu', name: '关羽', inTeam: true },
    { id: 'zhangfei', name: '张飞', inTeam: true },
    { id: 'zhaoyun', name: '赵云', inTeam: false },
  ],
  effect: {
    attackBonus: 15,
    defenseBonus: 10,
    hpBonus: 20,
    critBonus: 5,
  },
  isActive: true,
  onClose: vi.fn(),
};

// ─────────────────────────────────────────────
// 测试
// ─────────────────────────────────────────────

describe('BondActivateModal', () => {
  // 1. 渲染羁绊详情
  it('renders bond name correctly', () => {
    render(<BondActivateModal {...defaultProps} />);
    expect(screen.getByTestId('bond-name')).toHaveTextContent('蜀汉三杰');
  });

  it('renders modal container', () => {
    render(<BondActivateModal {...defaultProps} />);
    expect(screen.getByTestId('bond-modal')).toBeInTheDocument();
  });

  // 2. 显示参与武将
  it('displays all required heroes', () => {
    render(<BondActivateModal {...defaultProps} />);
    const heroesSection = screen.getByTestId('bond-heroes');
    expect(heroesSection).toHaveTextContent('关羽');
    expect(heroesSection).toHaveTextContent('张飞');
    expect(heroesSection).toHaveTextContent('赵云');
  });

  it('shows correct active hero count (2/3)', () => {
    render(<BondActivateModal {...defaultProps} />);
    expect(screen.getByText(/参与武将/)).toHaveTextContent('2/3');
  });

  it('renders hero avatars with first character', () => {
    render(<BondActivateModal {...defaultProps} />);
    const avatars = screen.getAllByTestId('bond-hero-avatar');
    expect(avatars).toHaveLength(3);
    expect(avatars[0]).toHaveTextContent('关');
    expect(avatars[1]).toHaveTextContent('张');
    expect(avatars[2]).toHaveTextContent('赵');
  });

  // 3. 激活状态显示
  it('shows active status when isActive is true', () => {
    render(<BondActivateModal {...defaultProps} isActive={true} />);
    expect(screen.getByTestId('bond-status')).toHaveTextContent('已激活');
  });

  it('shows inactive status when isActive is false', () => {
    render(<BondActivateModal {...defaultProps} isActive={false} />);
    expect(screen.getByTestId('bond-status')).toHaveTextContent('未激活');
  });

  // 4. 关闭按钮
  it('renders close button', () => {
    render(<BondActivateModal {...defaultProps} />);
    expect(screen.getByTestId('bond-close-btn')).toHaveTextContent('关闭');
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(<BondActivateModal {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByTestId('bond-close-btn'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // 5. 效果描述正确
  it('displays all bond effects with correct values', () => {
    render(<BondActivateModal {...defaultProps} />);
    const effectsSection = screen.getByTestId('bond-effects');
    expect(effectsSection).toHaveTextContent('攻击加成');
    expect(effectsSection).toHaveTextContent('+15%');
    expect(effectsSection).toHaveTextContent('防御加成');
    expect(effectsSection).toHaveTextContent('+10%');
    expect(effectsSection).toHaveTextContent('生命加成');
    expect(effectsSection).toHaveTextContent('+20%');
    expect(effectsSection).toHaveTextContent('暴击加成');
    expect(effectsSection).toHaveTextContent('+5%');
  });

  it('hides effect rows with zero value', () => {
    render(
      <BondActivateModal
        {...defaultProps}
        effect={{ attackBonus: 10, defenseBonus: 0, hpBonus: 0, critBonus: 5 }}
      />,
    );
    const effectsSection = screen.getByTestId('bond-effects');
    expect(effectsSection).toHaveTextContent('攻击加成');
    expect(effectsSection).toHaveTextContent('暴击加成');
    const effectRows = effectsSection.querySelectorAll('[data-testid="bond-effect-row"]');
    expect(effectRows.length).toBe(2);
  });

  // 6. 羁绊类型标签
  it('displays faction type label for faction bonds', () => {
    render(<BondActivateModal {...defaultProps} bondType="faction" />);
    expect(screen.getByText('阵营羁绊')).toBeInTheDocument();
  });

  it('displays partner type label for partner bonds', () => {
    render(<BondActivateModal {...defaultProps} bondType="partner" bondName="桃园结义" />);
    expect(screen.getByText('搭档羁绊')).toBeInTheDocument();
  });

  // 7. 遮罩层点击关闭
  it('calls onClose when overlay is clicked', () => {
    const onClose = vi.fn();
    render(<BondActivateModal {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByTestId('bond-modal-overlay'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // 8. 武将上阵状态
  it('shows inTeam status for active heroes', () => {
    render(<BondActivateModal {...defaultProps} />);
    const heroesSection = screen.getByTestId('bond-heroes');
    expect(heroesSection).toHaveTextContent('已上阵');
    expect(heroesSection).toHaveTextContent('未上阵');
  });
});
