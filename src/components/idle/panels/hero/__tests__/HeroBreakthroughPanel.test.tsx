/**
 * HeroBreakthroughPanel — 武将突破面板测试
 *
 * 覆盖场景：
 * - 渲染突破阶段
 * - 显示材料需求
 * - 突破按钮可点击
 * - 材料不足时按钮禁用
 * - 突破路线可视化
 * - 满突状态
 * - 等级上限变化提示
 * - 突破回调调用
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import HeroBreakthroughPanel from '../HeroBreakthroughPanel';

// ── Mock CSS ──
vi.mock('../HeroBreakthroughPanel.css', () => ({}));

// ── 默认 Props ──
const defaultProps = {
  heroId: 'guanyu',
  currentBreakthrough: 0,
  levelCap: 30,
  materials: { fragments: 20, copper: 5000, breakthroughStones: 5 },
  onBreakthrough: vi.fn(),
};

// ─────────────────────────────────────────────
// 测试
// ─────────────────────────────────────────────

describe('HeroBreakthroughPanel', () => {
  // 1. 渲染突破阶段
  it('renders current breakthrough stage correctly', () => {
    render(<HeroBreakthroughPanel {...defaultProps} />);
    expect(screen.getByTestId('breakthrough-stage')).toHaveTextContent('0 / 4');
  });

  it('renders breakthrough stage 2/4', () => {
    render(<HeroBreakthroughPanel {...defaultProps} currentBreakthrough={2} levelCap={50} />);
    expect(screen.getByTestId('breakthrough-stage')).toHaveTextContent('2 / 4');
  });

  // 2. 显示材料需求
  it('displays material requirements for current stage', () => {
    render(<HeroBreakthroughPanel {...defaultProps} />);
    const materialsSection = screen.getByTestId('breakthrough-materials');
    expect(materialsSection).toBeInTheDocument();
    expect(materialsSection).toHaveTextContent('碎片');
    expect(materialsSection).toHaveTextContent('铜钱');
    expect(materialsSection).toHaveTextContent('突破石');
  });

  it('shows correct required amounts for stage 0', () => {
    render(<HeroBreakthroughPanel {...defaultProps} />);
    const materialsSection = screen.getByTestId('breakthrough-materials');
    expect(materialsSection).toHaveTextContent('20');
  });

  // 3. 突破按钮可点击
  it('enables breakthrough button when materials are sufficient', () => {
    render(<HeroBreakthroughPanel {...defaultProps} />);
    const btn = screen.getByTestId('breakthrough-btn');
    expect(btn).not.toBeDisabled();
    expect(btn).toHaveTextContent('立即突破');
  });

  it('calls onBreakthrough with heroId when button clicked', () => {
    const onBreakthrough = vi.fn();
    render(<HeroBreakthroughPanel {...defaultProps} onBreakthrough={onBreakthrough} />);
    const btn = screen.getByTestId('breakthrough-btn');
    fireEvent.click(btn);
    expect(onBreakthrough).toHaveBeenCalledWith('guanyu');
  });

  // 4. 材料不足时按钮禁用
  it('disables button when fragments are insufficient', () => {
    render(
      <HeroBreakthroughPanel
        {...defaultProps}
        materials={{ fragments: 5, copper: 5000, breakthroughStones: 5 }}
      />,
    );
    const btn = screen.getByTestId('breakthrough-btn');
    expect(btn).toBeDisabled();
    expect(btn).toHaveTextContent('材料不足');
  });

  it('disables button when copper is insufficient', () => {
    render(
      <HeroBreakthroughPanel
        {...defaultProps}
        materials={{ fragments: 20, copper: 1000, breakthroughStones: 5 }}
      />,
    );
    const btn = screen.getByTestId('breakthrough-btn');
    expect(btn).toBeDisabled();
  });

  it('disables button when breakthroughStones are insufficient', () => {
    render(
      <HeroBreakthroughPanel
        {...defaultProps}
        materials={{ fragments: 20, copper: 5000, breakthroughStones: 1 }}
      />,
    );
    const btn = screen.getByTestId('breakthrough-btn');
    expect(btn).toBeDisabled();
  });

  // 5. 突破路线可视化
  it('renders 4 breakthrough nodes in the roadmap', () => {
    render(<HeroBreakthroughPanel {...defaultProps} />);
    const roadmap = screen.getByTestId('breakthrough-roadmap');
    expect(roadmap).toHaveTextContent('一阶');
    expect(roadmap).toHaveTextContent('二阶');
    expect(roadmap).toHaveTextContent('三阶');
    expect(roadmap).toHaveTextContent('四阶');
  });

  it('displays level caps in roadmap nodes (30→40→50→60→70)', () => {
    render(<HeroBreakthroughPanel {...defaultProps} />);
    const roadmap = screen.getByTestId('breakthrough-roadmap');
    expect(roadmap).toHaveTextContent('Lv.30');
    expect(roadmap).toHaveTextContent('Lv.40');
    expect(roadmap).toHaveTextContent('Lv.50');
    expect(roadmap).toHaveTextContent('Lv.60');
    expect(roadmap).toHaveTextContent('Lv.70');
  });

  // 6. 等级上限变化提示
  it('shows next level cap hint when not maxed', () => {
    render(<HeroBreakthroughPanel {...defaultProps} />);
    expect(screen.getByTestId('breakthrough-next-cap')).toHaveTextContent('→ Lv.40');
  });

  it('shows current level cap value', () => {
    render(<HeroBreakthroughPanel {...defaultProps} levelCap={30} />);
    expect(screen.getByTestId('breakthrough-level-cap')).toHaveTextContent('Lv.30');
  });

  // 7. 满突状态
  it('shows max breakthrough state when currentBreakthrough is 4', () => {
    render(
      <HeroBreakthroughPanel
        {...defaultProps}
        currentBreakthrough={4}
        levelCap={70}
      />,
    );
    expect(screen.getByTestId('breakthrough-stage')).toHaveTextContent('已满突');
    expect(screen.getByTestId('breakthrough-max-hint')).toBeInTheDocument();
    expect(screen.queryByTestId('breakthrough-btn')).not.toBeInTheDocument();
  });

  it('hides materials section when maxed', () => {
    render(
      <HeroBreakthroughPanel
        {...defaultProps}
        currentBreakthrough={4}
        levelCap={70}
      />,
    );
    expect(screen.queryByTestId('breakthrough-materials')).not.toBeInTheDocument();
  });

  // 8. 面板容器存在
  it('renders panel container', () => {
    render(<HeroBreakthroughPanel {...defaultProps} />);
    expect(screen.getByTestId('breakthrough-panel')).toBeInTheDocument();
  });
});
