/**
 * ExpeditionForcePanel 组件测试
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ExpeditionForcePanel, type HeroInfo } from '../ExpeditionForcePanel';

// 模拟将领数据
const mockHeroes: HeroInfo[] = [
  { id: 'hero-1', name: '关羽', level: 10, injured: false, busy: false },
  { id: 'hero-2', name: '张飞', level: 8, injured: false, busy: false },
  { id: 'hero-3', name: '赵云', level: 12, injured: true, injuryLevel: 'minor', injuryRecoveryTime: 1800000, busy: false },
  { id: 'hero-4', name: '吕布', level: 15, injured: false, busy: true },
];

describe('ExpeditionForcePanel', () => {
  it('应该渲染可用将领列表', () => {
    render(
      <ExpeditionForcePanel
        heroes={mockHeroes}
        maxTroops={5000}
        onChange={() => {}}
      />
    );

    // 可用将领应该显示
    expect(screen.getByText('关羽')).toBeDefined();
    expect(screen.getByText('张飞')).toBeDefined();
  });

  it('应该显示受伤将领', () => {
    render(
      <ExpeditionForcePanel
        heroes={mockHeroes}
        maxTroops={5000}
        onChange={() => {}}
      />
    );

    // 受伤将领应该显示
    expect(screen.getByText('赵云')).toBeDefined();
    expect(screen.getByText(/轻伤/)).toBeDefined();
  });

  it('应该显示繁忙将领', () => {
    render(
      <ExpeditionForcePanel
        heroes={mockHeroes}
        maxTroops={5000}
        onChange={() => {}}
      />
    );

    // 繁忙将领应该显示
    expect(screen.getByText(/吕布/)).toBeDefined();
    expect(screen.getByText(/出征中/)).toBeDefined();
  });

  it('应该允许选择将领', () => {
    const onChange = vi.fn();
    render(
      <ExpeditionForcePanel
        heroes={mockHeroes}
        maxTroops={5000}
        onChange={onChange}
      />
    );

    // 点击关羽
    fireEvent.click(screen.getByText('关羽'));

    // 应该触发onChange
    expect(onChange).toHaveBeenCalledWith({ heroId: 'hero-1', troops: 0 });
  });

  it('应该允许调整兵力', () => {
    const onChange = vi.fn();
    render(
      <ExpeditionForcePanel
        heroes={mockHeroes}
        maxTroops={5000}
        onChange={onChange}
      />
    );

    // 选择将领
    fireEvent.click(screen.getByText('关羽'));

    // 调整兵力滑块
    const slider = screen.getByRole('slider');
    fireEvent.change(slider, { target: { value: '1000' } });

    // 应该触发onChange
    expect(onChange).toHaveBeenCalledWith({ heroId: 'hero-1', troops: 1000 });
  });

  it('应该禁用状态', () => {
    const onChange = vi.fn();
    render(
      <ExpeditionForcePanel
        heroes={mockHeroes}
        maxTroops={5000}
        onChange={onChange}
        disabled={true}
      />
    );

    // 点击关羽
    fireEvent.click(screen.getByText('关羽'));

    // 不应该触发onChange
    expect(onChange).not.toHaveBeenCalled();
  });

  it('应该显示最大兵力', () => {
    render(
      <ExpeditionForcePanel
        heroes={mockHeroes}
        maxTroops={5000}
        onChange={() => {}}
      />
    );

    // 应该显示可用兵力
    expect(screen.getByText(/可用: 5,000/)).toBeDefined();
  });

  it('应该显示无可用将领提示', () => {
    render(
      <ExpeditionForcePanel
        heroes={[
          { id: 'hero-1', name: '关羽', level: 10, injured: true, injuryLevel: 'severe', busy: false },
          { id: 'hero-2', name: '张飞', level: 8, injured: false, busy: true },
        ]}
        maxTroops={5000}
        onChange={() => {}}
      />
    );

    // 应该显示无可用将领
    expect(screen.getByText('没有可用的将领')).toBeDefined();
  });

  it('应该允许清除选择', () => {
    const onChange = vi.fn();
    render(
      <ExpeditionForcePanel
        heroes={mockHeroes}
        maxTroops={5000}
        onChange={onChange}
      />
    );

    // 选择将领
    fireEvent.click(screen.getByText('关羽'));

    // 点击清除按钮
    fireEvent.click(screen.getByText('清除'));

    // 应该触发onChange(null)
    expect(onChange).toHaveBeenCalledWith(null);
  });
});
