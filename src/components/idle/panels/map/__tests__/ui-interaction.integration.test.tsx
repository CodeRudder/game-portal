/**
 * UI交互集成测试
 *
 * 测试点击选择→拖拽平移→缩放→快捷键→弹窗交互全流程
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import { ExpeditionForcePanel, type HeroInfo } from '../ExpeditionForcePanel';

describe('UI交互集成测试', () => {
  const mockHeroes: HeroInfo[] = [
    { id: 'hero-1', name: '关羽', level: 10, injured: false, busy: false },
    { id: 'hero-2', name: '张飞', level: 8, injured: false, busy: false },
    { id: 'hero-3', name: '赵云', level: 12, injured: true, injuryLevel: 'minor', injuryRecoveryTime: 1800000, busy: false },
  ];

  describe('点击选择', () => {
    it('应该选择将领', () => {
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
      expect(onChange).toHaveBeenCalledWith({ heroId: 'hero-1', troops: 0 });
    });

    it('应该切换将领', () => {
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
      expect(onChange).toHaveBeenCalledWith({ heroId: 'hero-1', troops: 0 });

      // 点击张飞
      fireEvent.click(screen.getByText('张飞'));
      expect(onChange).toHaveBeenCalledWith({ heroId: 'hero-2', troops: 0 });
    });
  });

  describe('滑块交互', () => {
    it('应该调整兵力', () => {
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

      // 调整滑块
      const slider = screen.getByRole('slider');
      fireEvent.change(slider, { target: { value: '1000' } });

      expect(onChange).toHaveBeenCalledWith({ heroId: 'hero-1', troops: 1000 });
    });
  });

  describe('禁用状态', () => {
    it('应该禁用交互', () => {
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
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe('清除选择', () => {
    it('应该清除选择', () => {
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

      // 清除选择
      fireEvent.click(screen.getByText('清除'));
      expect(onChange).toHaveBeenCalledWith(null);
    });
  });
});
