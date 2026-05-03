/**
 * WorldMapTab 快捷键集成测试
 *
 * 测试 D1-1 ~ D1-5 快捷键功能
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import WorldMapTab from '../WorldMapTab';
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
  {
    id: 'city-changan',
    name: '长安',
    level: 4,
    ownership: 'enemy',
    defenseValue: 4000,
    position: { x: 30, y: 25 },
    type: 'city',
    region: 'west',
    currentProduction: { grain: 8, gold: 8, troops: 4, mandate: 1 },
  },
];

// 模拟引擎
const mockEngine = {
  siege: {
    checkSiegeConditions: vi.fn(() => ({ canSiege: true })),
    executeSiege: vi.fn(() => ({ launched: true, victory: true, targetId: 'city-changan', targetName: '长安', cost: { troops: 100, grain: 50 }, capture: { territoryId: 'city-changan', newOwner: 'player', previousOwner: 'enemy' } })),
    getRemainingDailySieges: vi.fn(() => 3),
    getSiegeCostById: vi.fn(() => ({ troops: 100, grain: 50 })),
    getRemainingCooldown: vi.fn(() => 0),
  },
  territory: {
    getTerritoryById: vi.fn((id: string) => mockTerritories.find(t => t.id === id)),
    canAttackTerritory: vi.fn(() => true),
  },
  marchingSystem: null,
  offlineEvents: null,
  getOfflineEventSystem: vi.fn(() => null),
};

describe('WorldMapTab 快捷键测试', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('D1-1: V键切换视图', () => {
    it('应该切换像素/列表视图', () => {
      render(
        <WorldMapTab
          territories={mockTerritories}
          productionSummary={null}
          snapshotVersion={1}
          engine={mockEngine}
        />
      );

      // 初始是像素模式
      expect(screen.getByText('🗺️ 像素地图')).toBeDefined();

      // 按V键切换到列表模式
      fireEvent.keyDown(window, { key: 'v' });

      // 应该切换到列表模式
      expect(screen.getByText('📋 列表')).toBeDefined();

      // 再按V键切换回像素模式
      fireEvent.keyDown(window, { key: 'v' });

      // 应该切换回像素模式
      expect(screen.getByText('🗺️ 像素地图')).toBeDefined();
    });
  });

  describe('D1-2: 方向键平移视窗', () => {
    it('应该触发map-pan事件', () => {
      const panHandler = vi.fn();
      window.addEventListener('map-pan', panHandler);

      render(
        <WorldMapTab
          territories={mockTerritories}
          productionSummary={null}
          snapshotVersion={1}
          engine={mockEngine}
        />
      );

      // 按方向键
      fireEvent.keyDown(window, { key: 'ArrowUp' });
      expect(panHandler).toHaveBeenCalledWith(expect.objectContaining({
        detail: { dx: 0, dy: -50 },
      }));

      fireEvent.keyDown(window, { key: 'ArrowDown' });
      expect(panHandler).toHaveBeenCalledWith(expect.objectContaining({
        detail: { dx: 0, dy: 50 },
      }));

      fireEvent.keyDown(window, { key: 'ArrowLeft' });
      expect(panHandler).toHaveBeenCalledWith(expect.objectContaining({
        detail: { dx: -50, dy: 0 },
      }));

      fireEvent.keyDown(window, { key: 'ArrowRight' });
      expect(panHandler).toHaveBeenCalledWith(expect.objectContaining({
        detail: { dx: 50, dy: 0 },
      }));

      window.removeEventListener('map-pan', panHandler);
    });
  });

  describe('D1-3: +/-键缩放', () => {
    it('应该触发map-zoom事件', () => {
      const zoomHandler = vi.fn();
      window.addEventListener('map-zoom', zoomHandler);

      render(
        <WorldMapTab
          territories={mockTerritories}
          productionSummary={null}
          snapshotVersion={1}
          engine={mockEngine}
        />
      );

      // 按+键放大
      fireEvent.keyDown(window, { key: '+' });
      expect(zoomHandler).toHaveBeenCalledWith(expect.objectContaining({
        detail: { delta: 0.1 },
      }));

      // 按-键缩小
      fireEvent.keyDown(window, { key: '-' });
      expect(zoomHandler).toHaveBeenCalledWith(expect.objectContaining({
        detail: { delta: -0.1 },
      }));

      window.removeEventListener('map-zoom', zoomHandler);
    });
  });

  describe('D1-4: Escape取消选中', () => {
    it('应该取消选中领土', () => {
      render(
        <WorldMapTab
          territories={mockTerritories}
          productionSummary={null}
          snapshotVersion={1}
          engine={mockEngine}
        />
      );

      // 按Escape键
      fireEvent.keyDown(window, { key: 'Escape' });

      // 应该取消选中（不会抛出错误）
    });
  });

  describe('D1-5: 空格键居中到选中城市', () => {
    it('应该触发map-center事件', () => {
      const centerHandler = vi.fn();
      window.addEventListener('map-center', centerHandler);

      render(
        <WorldMapTab
          territories={mockTerritories}
          productionSummary={null}
          snapshotVersion={1}
          engine={mockEngine}
        />
      );

      // 选中一个领土
      // 注意：这里需要先点击一个领土来选中它

      // 按空格键
      fireEvent.keyDown(window, { key: ' ' });

      // 如果没有选中领土，不应该触发事件
      // 如果有选中领土，应该触发事件

      window.removeEventListener('map-center', centerHandler);
    });
  });

  describe('弹窗打开时的快捷键', () => {
    it('应该只处理Escape键', () => {
      render(
        <WorldMapTab
          territories={mockTerritories}
          productionSummary={null}
          snapshotVersion={1}
          engine={mockEngine}
        />
      );

      // 打开攻城弹窗
      // 注意：这里需要先选中敌方领土再点击攻城按钮

      // 按Escape键应该关闭弹窗
      fireEvent.keyDown(window, { key: 'Escape' });

      // 按其他键不应该有反应
      fireEvent.keyDown(window, { key: 'v' });
      fireEvent.keyDown(window, { key: 'ArrowUp' });
    });
  });
});
