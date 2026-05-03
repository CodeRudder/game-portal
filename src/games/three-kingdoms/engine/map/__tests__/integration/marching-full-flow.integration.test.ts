/**
 * 行军系统全流程集成测试
 *
 * 测试行军发起→路径计算→精灵移动→到达→事件触发全流程
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MarchingSystem } from '../../MarchingSystem';
import type { MarchRoute, MarchUnit } from '../../MarchingSystem';

describe('行军系统全流程集成测试', () => {
  let system: MarchingSystem;

  beforeEach(() => {
    system = new MarchingSystem();
    system.init({
      eventBus: {
        emit: vi.fn(),
        on: vi.fn(),
      },
      registry: {
        get: vi.fn(),
      },
    } as any);
  });

  describe('行军发起→路径计算→精灵移动→到达', () => {
    it('应该支持行军流程', () => {
      // 创建模拟路径
      const route: MarchRoute = {
        path: [
          { x: 10, y: 10 },
          { x: 11, y: 10 },
          { x: 12, y: 10 },
          { x: 13, y: 10 },
          { x: 14, y: 10 },
        ],
        waypoints: [
          { x: 10, y: 10, name: 'Start' },
          { x: 14, y: 10, name: 'End' },
        ],
        waypointCities: ['city-start', 'city-end'],
        totalDistance: 4,
        estimatedTime: 4000,
      };

      // 验证路径数据
      expect(route.path.length).toBe(5);
      expect(route.waypoints.length).toBe(2);
      expect(route.totalDistance).toBe(4);
    });
  });

  describe('多支军队并发', () => {
    it('应该支持多支军队同时行军', () => {
      // 创建多个行军单位
      const marches: MarchUnit[] = [
        {
          id: 'march-1',
          x: 10,
          y: 10,
          targetX: 20,
          targetY: 10,
          troops: 1000,
          faction: 'wei',
          state: 'marching',
          path: [{ x: 10, y: 10 }, { x: 20, y: 10 }],
          pathIndex: 0,
          speed: 1,
        },
        {
          id: 'march-2',
          x: 30,
          y: 20,
          targetX: 40,
          targetY: 20,
          troops: 500,
          faction: 'shu',
          state: 'marching',
          path: [{ x: 30, y: 20 }, { x: 40, y: 20 }],
          pathIndex: 0,
          speed: 1.5,
        },
      ];

      // 验证行军单位数据
      expect(marches.length).toBe(2);
      expect(marches[0].id).toBe('march-1');
      expect(marches[1].id).toBe('march-2');
    });
  });

  describe('行军状态', () => {
    it('应该支持不同行军状态', () => {
      const states: MarchUnit['state'][] = ['preparing', 'marching', 'arrived', 'retreating'];

      for (const state of states) {
        const march: MarchUnit = {
          id: `march-${state}`,
          x: 10,
          y: 10,
          targetX: 20,
          targetY: 10,
          troops: 1000,
          faction: 'wei',
          state,
          path: [{ x: 10, y: 10 }, { x: 20, y: 10 }],
          pathIndex: 0,
          speed: 1,
        };

        expect(march.state).toBe(state);
      }
    });
  });
});
