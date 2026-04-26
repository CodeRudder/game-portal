/**
 * FormationGrid 测试
 *
 * 覆盖场景：
 * 1. 基础渲染：面板标题、槽位数量
 * 2. 空槽位：显示 + 按钮、前排/后排标签
 * 3. 已填充槽位：头像、名字、品质色
 * 4. 点击事件：添加/移除回调
 * 5. 战力显示
 * 6. 羁绊摘要
 * 7. 边缘情况
 */

import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FormationGrid from '../FormationGrid';
import type { FormationGridProps } from '../FormationGrid';

// ─────────────────────────────────────────────
// Mock CSS imports
// ─────────────────────────────────────────────
vi.mock('../FormationGrid.css', () => ({}));

// ─────────────────────────────────────────────
// 测试数据工厂
// ─────────────────────────────────────────────
const makeSlots = (
  count: number,
): FormationGridProps['slots'] => {
  const heroes = [
    { id: 'hero-1', name: '关羽', quality: 'LEGENDARY' as const },
    { id: 'hero-2', name: '张飞', quality: 'EPIC' as const },
    { id: 'hero-3', name: '赵云', quality: 'RARE' as const },
    { id: 'hero-4', name: '马超', quality: 'UNCOMMON' as const },
    { id: 'hero-5', name: '黄忠', quality: 'COMMON' as const },
  ];
  const slots: FormationGridProps['slots'] = Array(5).fill(null);
  for (let i = 0; i < Math.min(count, 5); i++) {
    slots[i] = heroes[i];
  }
  return slots;
};

const defaultProps: FormationGridProps = {
  slots: makeSlots(3),
  totalPower: 12500,
  bonds: [
    { id: 'bond-1', name: '五虎上将', isActive: true },
    { id: 'bond-2', name: '桃园结义', isActive: false },
  ],
  onAddHero: vi.fn(),
  onRemoveHero: vi.fn(),
};

// ─────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────
describe('FormationGrid', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  // ═══════════════════════════════════════════
  // 1. 基础渲染
  // ═══════════════════════════════════════════

  it('应渲染面板标题', () => {
    render(<FormationGrid {...defaultProps} />);
    expect(screen.getByText('⚔️ 编队')).toBeInTheDocument();
  });

  it('应渲染5个槽位', () => {
    render(<FormationGrid {...defaultProps} />);
    for (let i = 0; i < 5; i++) {
      expect(screen.getByTestId(`formation-slot-${i}`)).toBeInTheDocument();
    }
  });

  it('应渲染 data-testid', () => {
    render(<FormationGrid {...defaultProps} />);
    expect(screen.getByTestId('formation-grid')).toBeInTheDocument();
  });

  // ═══════════════════════════════════════════
  // 2. 空槽位
  // ═══════════════════════════════════════════

  it('空槽位应显示 + 按钮', () => {
    render(<FormationGrid {...defaultProps} slots={makeSlots(2)} />);
    // slot 2, 3, 4 为空
    const emptySlot = screen.getByTestId('formation-slot-2');
    expect(emptySlot.textContent).toContain('+');
  });

  it('空槽位应显示前排/后排标签', () => {
    render(<FormationGrid {...defaultProps} slots={makeSlots(0)} />);
    // 前排 slot 0,1
    const frontSlot = screen.getByTestId('formation-slot-0');
    expect(frontSlot.textContent).toContain('前排');
    // 后排 slot 2
    const backSlot = screen.getByTestId('formation-slot-2');
    expect(backSlot.textContent).toContain('后排');
  });

  // ═══════════════════════════════════════════
  // 3. 已填充槽位
  // ═══════════════════════════════════════════

  it('已填充槽位应显示武将名字', () => {
    render(<FormationGrid {...defaultProps} />);
    expect(screen.getByText('关羽')).toBeInTheDocument();
    expect(screen.getByText('张飞')).toBeInTheDocument();
    expect(screen.getByText('赵云')).toBeInTheDocument();
  });

  it('已填充槽位应显示武将头像首字', () => {
    render(<FormationGrid {...defaultProps} />);
    expect(screen.getByText('关')).toBeInTheDocument();
  });

  // ═══════════════════════════════════════════
  // 4. 点击事件
  // ═══════════════════════════════════════════

  it('点击空槽位应触发 onAddHero 回调', async () => {
    const user = userEvent.setup();
    const onAddHero = vi.fn();
    render(<FormationGrid {...defaultProps} slots={makeSlots(2)} onAddHero={onAddHero} />);

    const emptySlot = screen.getByTestId('formation-slot-3');
    await user.click(emptySlot);
    expect(onAddHero).toHaveBeenCalledWith(3);
  });

  it('点击移除按钮应触发 onRemoveHero 回调', async () => {
    const user = userEvent.setup();
    const onRemoveHero = vi.fn();
    render(<FormationGrid {...defaultProps} onRemoveHero={onRemoveHero} />);

    const removeBtn = screen.getByTestId('formation-slot-remove-0');
    await user.click(removeBtn);
    expect(onRemoveHero).toHaveBeenCalledWith(0, 'hero-1');
  });

  // ═══════════════════════════════════════════
  // 5. 战力显示
  // ═══════════════════════════════════════════

  it('应显示总战力', () => {
    render(<FormationGrid {...defaultProps} totalPower={8500} />);
    // 8500 / 1000 = 8.5K
    expect(screen.getByTestId('formation-grid-power')).toHaveTextContent('8.5K');
  });

  it('应正确格式化万级战力', () => {
    render(<FormationGrid {...defaultProps} totalPower={50000} />);
    expect(screen.getByTestId('formation-grid-power')).toHaveTextContent('5.0万');
  });

  // ═══════════════════════════════════════════
  // 6. 羁绊摘要
  // ═══════════════════════════════════════════

  it('应渲染羁绊摘要', () => {
    render(<FormationGrid {...defaultProps} />);
    expect(screen.getByTestId('formation-grid-bonds')).toBeInTheDocument();
    expect(screen.getByText(/五虎上将/)).toBeInTheDocument();
    expect(screen.getByText(/桃园结义/)).toBeInTheDocument();
  });

  it('已激活羁绊应有 active 样式', () => {
    render(<FormationGrid {...defaultProps} />);
    const activeBond = screen.getByTestId('formation-bond-bond-1');
    expect(activeBond.className).toContain('active');
  });

  // ═══════════════════════════════════════════
  // 7. 边缘情况
  // ═══════════════════════════════════════════

  it('无羁绊时不渲染羁绊区域', () => {
    render(<FormationGrid {...defaultProps} bonds={[]} />);
    expect(screen.queryByTestId('formation-grid-bonds')).not.toBeInTheDocument();
  });

  it('slots 不足5个时自动补齐空槽位', () => {
    render(<FormationGrid {...defaultProps} slots={[{ id: 'h1', name: '关羽', quality: 'LEGENDARY' }]} />);
    // 应有5个槽位
    expect(screen.getByTestId('formation-slot-0')).toBeInTheDocument();
    expect(screen.getByTestId('formation-slot-4')).toBeInTheDocument();
    // 槽位4应为空
    expect(screen.getByTestId('formation-slot-4').textContent).toContain('+');
  });
});
