/**
 * BreakthroughPanel — 突破面板测试
 *
 * 覆盖场景（15个测试）：
 * - 面板渲染与标题
 * - 突破阶段显示
 * - 突破路线可视化（4个节点+连接线）
 * - 节点状态（已完成/当前/锁定）
 * - 材料需求展示
 * - 材料充足/不足状态
 * - 突破按钮启用/禁用
 * - 属性加成预览
 * - 满突状态
 * - 突破动画触发
 * - 突破回调调用
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import BreakthroughPanel from '../BreakthroughPanel';

// ── Mock CSS ──
vi.mock('../BreakthroughPanel.css', () => ({}));

// ── 默认 Props ──
const defaultProps = {
  heroId: 'guanyu',
  currentStage: 0,
  levelCap: 30,
  materials: { fragments: 20, copper: 5000, breakthroughStones: 5 },
  onBreakthrough: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ─────────────────────────────────────────────
// 测试
// ─────────────────────────────────────────────

describe('BreakthroughPanel', () => {
  // 1. 渲染面板容器
  it('renders panel container', () => {
    render(<BreakthroughPanel {...defaultProps} />);
    expect(screen.getByTestId('breakthrough-panel')).toBeInTheDocument();
  });

  // 2. 显示标题
  it('renders title', () => {
    render(<BreakthroughPanel {...defaultProps} />);
    expect(screen.getByText('突破面板')).toBeInTheDocument();
  });

  // 3. 显示当前突破阶段
  it('renders current breakthrough stage 0/4', () => {
    render(<BreakthroughPanel {...defaultProps} />);
    expect(screen.getByTestId('bp-stage')).toHaveTextContent('0 / 4');
  });

  it('renders breakthrough stage 2/4', () => {
    render(<BreakthroughPanel {...defaultProps} currentStage={2} levelCap={50} />);
    expect(screen.getByTestId('bp-stage')).toHaveTextContent('2 / 4');
  });

  // 4. 突破路线可视化：4个节点
  it('renders 4 breakthrough nodes in roadmap', () => {
    render(<BreakthroughPanel {...defaultProps} />);
    expect(screen.getByTestId('bp-node-0')).toBeInTheDocument();
    expect(screen.getByTestId('bp-node-1')).toBeInTheDocument();
    expect(screen.getByTestId('bp-node-2')).toBeInTheDocument();
    expect(screen.getByTestId('bp-node-3')).toBeInTheDocument();
  });

  // 5. 显示等级上限路线
  it('displays level caps in roadmap (30→40→50→60)', () => {
    render(<BreakthroughPanel {...defaultProps} />);
    const roadmap = screen.getByTestId('bp-roadmap');
    expect(roadmap).toHaveTextContent('Lv.30');
    expect(roadmap).toHaveTextContent('Lv.40');
    expect(roadmap).toHaveTextContent('Lv.50');
    expect(roadmap).toHaveTextContent('Lv.60');
  });

  // 6. 显示当前等级上限
  it('shows current level cap value', () => {
    render(<BreakthroughPanel {...defaultProps} levelCap={30} />);
    expect(screen.getByTestId('bp-level-cap')).toHaveTextContent('Lv.30');
  });

  // 7. 显示下一等级上限
  it('shows next level cap hint when not maxed', () => {
    render(<BreakthroughPanel {...defaultProps} />);
    expect(screen.getByTestId('bp-next-cap')).toHaveTextContent('→ Lv.30');
  });

  // 8. 显示材料需求
  it('displays material requirements', () => {
    render(<BreakthroughPanel {...defaultProps} />);
    const materialsSection = screen.getByTestId('bp-materials');
    expect(materialsSection).toHaveTextContent('碎片');
    expect(materialsSection).toHaveTextContent('铜钱');
    expect(materialsSection).toHaveTextContent('突破石');
  });

  // 9. 材料充足时按钮可点击
  it('enables button when materials are sufficient', () => {
    render(<BreakthroughPanel {...defaultProps} />);
    const btn = screen.getByTestId('bp-btn');
    expect(btn).not.toBeDisabled();
    expect(btn).toHaveTextContent('立即突破');
  });

  // 10. 材料不足时按钮禁用
  it('disables button when fragments are insufficient', () => {
    render(
      <BreakthroughPanel
        {...defaultProps}
        materials={{ fragments: 5, copper: 5000, breakthroughStones: 5 }}
      />,
    );
    const btn = screen.getByTestId('bp-btn');
    expect(btn).toBeDisabled();
    expect(btn).toHaveTextContent('材料不足');
  });

  it('disables button when copper is insufficient', () => {
    render(
      <BreakthroughPanel
        {...defaultProps}
        materials={{ fragments: 20, copper: 1000, breakthroughStones: 5 }}
      />,
    );
    expect(screen.getByTestId('bp-btn')).toBeDisabled();
  });

  it('disables button when breakthroughStones are insufficient', () => {
    render(
      <BreakthroughPanel
        {...defaultProps}
        materials={{ fragments: 20, copper: 5000, breakthroughStones: 1 }}
      />,
    );
    expect(screen.getByTestId('bp-btn')).toBeDisabled();
  });

  // 11. 突破回调调用
  it('calls onBreakthrough with heroId when button clicked', () => {
    vi.useFakeTimers();
    const onBreakthrough = vi.fn();
    render(<BreakthroughPanel {...defaultProps} onBreakthrough={onBreakthrough} />);
    fireEvent.click(screen.getByTestId('bp-btn'));
    // 动画完成后才调用回调
    vi.advanceTimersByTime(600);
    expect(onBreakthrough).toHaveBeenCalledWith('guanyu');
    vi.useRealTimers();
  });

  // 12. 属性加成预览
  it('displays stat bonus preview when not maxed', () => {
    render(<BreakthroughPanel {...defaultProps} />);
    const bonus = screen.getByTestId('bp-bonus-preview');
    expect(bonus).toHaveTextContent('攻击 +50');
    expect(bonus).toHaveTextContent('生命 +200');
    expect(bonus).toHaveTextContent('防御 +30');
  });

  // 13. 满突状态
  it('shows max breakthrough state when currentStage is 4', () => {
    render(
      <BreakthroughPanel
        {...defaultProps}
        currentStage={4}
        levelCap={70}
      />,
    );
    expect(screen.getByTestId('bp-stage')).toHaveTextContent('已满突');
    expect(screen.getByTestId('bp-max-hint')).toBeInTheDocument();
    expect(screen.queryByTestId('bp-btn')).not.toBeInTheDocument();
  });

  it('hides materials section when maxed', () => {
    render(
      <BreakthroughPanel
        {...defaultProps}
        currentStage={4}
        levelCap={70}
      />,
    );
    expect(screen.queryByTestId('bp-materials')).not.toBeInTheDocument();
  });
});
