/**
 * StarUpPanel — 升星面板测试
 *
 * 覆盖场景：
 * - 基础渲染：面板、武将名字、星级显示
 * - 属性预览：属性名、前后对比、差异值
 * - 材料列表：碎片/铜钱充足与不足状态
 * - 升星按钮：启用/禁用状态
 * - 满星状态
 * - 升星回调
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import StarUpPanel from '../StarUpPanel';

// ── Mock CSS ──
vi.mock('../StarUpPanel.css', () => ({}));

// ── 测试数据 ──
const defaultProps = {
  heroId: 'guanyu',
  heroName: '关羽',
  currentStar: 3,
  maxStar: 6,
  stats: { attack: 400, defense: 300, intelligence: 200, speed: 150 },
  nextStats: { attack: 480, defense: 360, intelligence: 240, speed: 180 },
  fragmentCost: 80,
  fragmentOwned: 85,
  goldCost: 20000,
  goldOwned: 50000,
  onStarUp: vi.fn(),
  isMaxStar: false,
};

// ── 测试 ──

describe('StarUpPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ═══════════════════════════════════════════
  // 1. 基础渲染
  // ═══════════════════════════════════════════

  it('应渲染面板容器', () => {
    render(<StarUpPanel {...defaultProps} />);
    expect(screen.getByTestId('starup-panel')).toBeInTheDocument();
  });

  it('应渲染武将名字', () => {
    render(<StarUpPanel {...defaultProps} />);
    expect(screen.getByTestId('starup-hero-name')).toHaveTextContent('关羽');
  });

  it('应渲染6颗星（3实3空）', () => {
    render(<StarUpPanel {...defaultProps} />);
    const stars = screen.getByTestId('starup-stars');
    const filled = stars.querySelectorAll('.tk-starup-star--filled');
    const empty = stars.querySelectorAll('.tk-starup-star--empty');
    expect(filled).toHaveLength(3);
    expect(empty).toHaveLength(3);
  });

  // ═══════════════════════════════════════════
  // 2. 属性预览
  // ═══════════════════════════════════════════

  it('应显示升星预览标题', () => {
    render(<StarUpPanel {...defaultProps} />);
    expect(screen.getByTestId('starup-preview')).toHaveTextContent('3星');
    expect(screen.getByTestId('starup-preview')).toHaveTextContent('4星');
  });

  it('应显示属性名和数值', () => {
    render(<StarUpPanel {...defaultProps} />);
    expect(screen.getByText('攻击')).toBeInTheDocument();
    expect(screen.getByText('防御')).toBeInTheDocument();
    expect(screen.getByText('智力')).toBeInTheDocument();
    expect(screen.getByText('速度')).toBeInTheDocument();
  });

  it('应显示属性差异值', () => {
    render(<StarUpPanel {...defaultProps} />);
    expect(screen.getByTestId('stat-diff-attack')).toHaveTextContent('(+80)');
    expect(screen.getByTestId('stat-diff-defense')).toHaveTextContent('(+60)');
  });

  // ═══════════════════════════════════════════
  // 3. 材料列表
  // ═══════════════════════════════════════════

  it('应显示碎片和铜钱材料', () => {
    render(<StarUpPanel {...defaultProps} />);
    expect(screen.getByText('碎片')).toBeInTheDocument();
    expect(screen.getByText('铜钱')).toBeInTheDocument();
  });

  it('材料充足时应显示绿色', () => {
    render(<StarUpPanel {...defaultProps} />);
    const fragStatus = screen.getByTestId('fragment-status');
    expect(fragStatus).toHaveTextContent('85/80');
    expect(fragStatus.classList.contains('tk-starup-material-value--sufficient')).toBe(true);
  });

  it('碎片不足时应显示红色', () => {
    render(<StarUpPanel {...defaultProps} fragmentOwned={30} />);
    const fragStatus = screen.getByTestId('fragment-status');
    expect(fragStatus).toHaveTextContent('30/80');
    expect(fragStatus.classList.contains('tk-starup-material-value--insufficient')).toBe(true);
  });

  it('铜钱不足时应显示红色', () => {
    render(<StarUpPanel {...defaultProps} goldOwned={5000} />);
    const goldStatus = screen.getByTestId('gold-status');
    expect(goldStatus.classList.contains('tk-starup-material-value--insufficient')).toBe(true);
  });

  // ═══════════════════════════════════════════
  // 4. 升星按钮
  // ═══════════════════════════════════════════

  it('材料充足时升星按钮应可用', () => {
    render(<StarUpPanel {...defaultProps} />);
    const btn = screen.getByTestId('starup-btn');
    expect(btn).not.toBeDisabled();
    expect(btn).toHaveTextContent('升星');
  });

  it('材料不足时升星按钮应禁用', () => {
    render(<StarUpPanel {...defaultProps} fragmentOwned={10} goldOwned={100} />);
    const btn = screen.getByTestId('starup-btn');
    expect(btn).toBeDisabled();
  });

  it('点击升星按钮应调用onStarUp', () => {
    vi.useFakeTimers();
    const onStarUp = vi.fn();
    render(<StarUpPanel {...defaultProps} onStarUp={onStarUp} />);
    fireEvent.click(screen.getByTestId('starup-btn'));
    // Advance through animation timeouts (200ms + 400ms)
    vi.advanceTimersByTime(700);
    expect(onStarUp).toHaveBeenCalledWith('guanyu');
    vi.useRealTimers();
  });

  // ═══════════════════════════════════════════
  // 5. 满星状态
  // ═══════════════════════════════════════════

  it('满星时应显示最高星级提示', () => {
    render(<StarUpPanel {...defaultProps} currentStar={6} isMaxStar={true} />);
    expect(screen.getByTestId('starup-maxed')).toHaveTextContent('已达最高星级');
    expect(screen.queryByTestId('starup-btn')).not.toBeInTheDocument();
  });

  it('满星时不应显示材料列表', () => {
    render(<StarUpPanel {...defaultProps} currentStar={6} isMaxStar={true} />);
    expect(screen.queryByTestId('starup-materials')).not.toBeInTheDocument();
  });
});
