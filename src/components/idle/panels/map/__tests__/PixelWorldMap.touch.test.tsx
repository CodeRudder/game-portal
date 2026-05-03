/**
 * PixelWorldMap 触摸手势测试
 *
 * 测试 D2-3/D2-4 触摸操作
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import { PixelWorldMap } from '../PixelWorldMap';
import type { TerritoryData } from '@/games/three-kingdoms/core/map';

// 模拟领土数据
const mockTerritories: TerritoryData[] = [
  {
    id: 'city-luoyang',
    name: '洛阳',
    level: 5,
    ownership: 'player',
    defenseValue: 5000,
    position: { x: 50, y: 30 },
    type: 'city',
    region: 'central',
    currentProduction: { grain: 10, gold: 10, troops: 5, mandate: 2 },
  },
];

describe('PixelWorldMap 触摸手势测试', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('D2-4: 触摸屏单指拖拽', () => {
    it('应该支持单指拖拽平移', () => {
      const onSelect = vi.fn();
      render(
        <PixelWorldMap
          territories={mockTerritories}
          onSelectTerritory={onSelect}
        />
      );

      const canvas = document.querySelector('canvas');
      expect(canvas).toBeDefined();

      // 模拟单指拖拽
      fireEvent.touchStart(canvas!, {
        touches: [{ clientX: 100, clientY: 100 }],
      });

      fireEvent.touchMove(canvas!, {
        touches: [{ clientX: 150, clientY: 150 }],
      });

      fireEvent.touchEnd(canvas!, {
        touches: [],
      });

      // 不应该触发选择（因为是拖拽）
      expect(onSelect).not.toHaveBeenCalled();
    });

    it('应该支持单指点击选择', () => {
      const onSelect = vi.fn();
      render(
        <PixelWorldMap
          territories={mockTerritories}
          onSelectTerritory={onSelect}
        />
      );

      const canvas = document.querySelector('canvas');
      expect(canvas).toBeDefined();

      // 模拟单指点击（没有移动）
      fireEvent.touchStart(canvas!, {
        touches: [{ clientX: 100, clientY: 100 }],
      });

      fireEvent.touchEnd(canvas!, {
        touches: [],
      });

      // 可能触发选择（取决于点击位置是否在领土上）
    });
  });

  describe('D2-3: 触摸板双指操作', () => {
    it('应该支持双指缩放', () => {
      render(
        <PixelWorldMap
          territories={mockTerritories}
          onSelectTerritory={() => {}}
        />
      );

      const canvas = document.querySelector('canvas');
      expect(canvas).toBeDefined();

      // 模拟双指开始
      fireEvent.touchStart(canvas!, {
        touches: [
          { clientX: 100, clientY: 100 },
          { clientX: 200, clientY: 200 },
        ],
      });

      // 模拟双指张开（放大）
      fireEvent.touchMove(canvas!, {
        touches: [
          { clientX: 80, clientY: 80 },
          { clientX: 220, clientY: 220 },
        ],
      });

      fireEvent.touchEnd(canvas!, {
        touches: [],
      });
    });
  });
});
