/**
 * MarchRoute 行军路线计算测试
 *
 * 覆盖：
 *   1. calculateMarchRoute 返回有效路线(洛阳→许昌)
 *   2. 路线包含 path 和 waypoints
 *   3. 距离和预计时间合理
 *   4. 不可达城市返回 null
 *   5. 不存在的城市ID返回 null
 *   6. 路线第一点是起点，最后一点是终点
 *   7. 途径城市列表正确
 *
 * @module engine/map/__tests__/MarchRoute.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MarchingSystem, type MarchRoute } from '../MarchingSystem';
import { LANDMARK_POSITIONS } from '@/games/three-kingdoms/core/map/map-config';
import type { GridPosition } from '@/games/three-kingdoms/core/map/world-map.types';
import type { ISystemDeps } from '@/games/three-kingdoms/core/types/subsystem';

// ─────────────────────────────────────────────
// 辅助工具
// ─────────────────────────────────────────────

function createMockDeps(): ISystemDeps {
  return {
    eventBus: {
      emit: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
      once: vi.fn(),
    },
  } as unknown as ISystemDeps;
}

/**
 * 创建 100x60 网格，并在指定坐标之间铺设道路
 *
 * 道路使用水平+垂直的 L 形连接，确保两城市之间可达。
 * 同时在道路上经过的其他城市位置也会被标记为可行走。
 *
 * @param roadPairs - 需要连接的城市ID对列表
 */
function createGridWithCityRoads(roadPairs: Array<[string, string]>): boolean[][] {
  const COLS = 100;
  const ROWS = 60;
  const grid: boolean[][] = [];

  // 初始化全 false
  for (let y = 0; y < ROWS; y++) {
    const row: boolean[] = [];
    for (let x = 0; x < COLS; x++) {
      row.push(false);
    }
    grid.push(row);
  }

  // 在两个城市之间铺设 L 形道路
  for (const [fromId, toId] of roadPairs) {
    const fromPos = LANDMARK_POSITIONS[fromId];
    const toPos = LANDMARK_POSITIONS[toId];
    if (!fromPos || !toPos) continue;

    // 标记起点和终点为可行走
    grid[fromPos.y][fromPos.x] = true;
    grid[toPos.y][toPos.x] = true;

    // 水平段: fromPos.x → toPos.x (在 fromPos.y 行)
    const minX = Math.min(fromPos.x, toPos.x);
    const maxX = Math.max(fromPos.x, toPos.x);
    for (let x = minX; x <= maxX; x++) {
      grid[fromPos.y][x] = true;
    }

    // 垂直段: fromPos.y → toPos.y (在 toPos.x 列)
    const minY = Math.min(fromPos.y, toPos.y);
    const maxY = Math.max(fromPos.y, toPos.y);
    for (let y = minY; y <= maxY; y++) {
      grid[y][toPos.x] = true;
    }
  }

  // 标记所有 city-* 位置为可行走(因为它们可能是路径上的经过点)
  for (const [id, pos] of Object.entries(LANDMARK_POSITIONS)) {
    if (id.startsWith('city-')) {
      grid[pos.y][pos.x] = true;
    }
  }

  return grid;
}

// ─────────────────────────────────────────────
// 测试
// ─────────────────────────────────────────────

describe('MarchingSystem — calculateMarchRoute', () => {
  let system: MarchingSystem;

  // 洛阳→许昌→邺城 道路网络:
  // 洛阳(50,23) → 许昌(37,26) 水平+垂直道路
  // 许昌(37,26) → 邺城(32,9) 水平+垂直道路
  // 这样洛阳→许昌路径会经过许昌，洛阳→邺城路径会经过许昌
  const ROAD_PAIRS: Array<[string, string]> = [
    ['city-luoyang', 'city-xuchang'],
    ['city-xuchang', 'city-ye'],
  ];

  beforeEach(() => {
    system = new MarchingSystem();
    system.init(createMockDeps());
  });

  // ── 基础功能 ───────────────────────────────

  describe('有效路线计算', () => {
    it('洛阳→许昌返回有效路线', () => {
      const grid = createGridWithCityRoads(ROAD_PAIRS);
      system.setWalkabilityGrid(grid);

      const route = system.calculateMarchRoute('city-luoyang', 'city-xuchang');

      expect(route).not.toBeNull();
      expect(route!.path.length).toBeGreaterThan(0);
      expect(route!.distance).toBeGreaterThan(0);
      expect(route!.estimatedTime).toBeGreaterThan(0);
    });

    it('路线包含 path 和 waypoints', () => {
      const grid = createGridWithCityRoads(ROAD_PAIRS);
      system.setWalkabilityGrid(grid);

      const route = system.calculateMarchRoute('city-luoyang', 'city-xuchang');

      expect(route).not.toBeNull();
      expect(Array.isArray(route!.path)).toBe(true);
      expect(Array.isArray(route!.waypoints)).toBe(true);
      expect(route!.path.length).toBeGreaterThan(0);
      // waypoints 是 path 的子集，至少包含起点和终点
      expect(route!.waypoints.length).toBeGreaterThanOrEqual(2);
      expect(route!.waypoints.length).toBeLessThanOrEqual(route!.path.length);
    });

    it('距离和预计时间合理', () => {
      const grid = createGridWithCityRoads(ROAD_PAIRS);
      system.setWalkabilityGrid(grid);

      const route = system.calculateMarchRoute('city-luoyang', 'city-xuchang');

      expect(route).not.toBeNull();
      // 距离 = path.length - 1 (每步1格)
      expect(route!.distance).toBe(route!.path.length - 1);
      expect(route!.distance).toBeGreaterThan(0);
      // 预计时间 = 距离 / 速度(1格/秒)
      expect(route!.estimatedTime).toBe(route!.distance);
      expect(route!.estimatedTime).toBeGreaterThan(0);
    });
  });

  // ── 起终点验证 ─────────────────────────────

  describe('起终点验证', () => {
    it('路线第一点是起点，最后一点是终点', () => {
      const grid = createGridWithCityRoads(ROAD_PAIRS);
      system.setWalkabilityGrid(grid);

      const fromPos = LANDMARK_POSITIONS['city-luoyang'];
      const toPos = LANDMARK_POSITIONS['city-xuchang'];
      const route = system.calculateMarchRoute('city-luoyang', 'city-xuchang');

      expect(route).not.toBeNull();
      expect(route!.path[0]).toEqual({ x: fromPos.x, y: fromPos.y });
      expect(route!.path[route!.path.length - 1]).toEqual({ x: toPos.x, y: toPos.y });
    });

    it('waypoints 第一点是起点，最后一点是终点', () => {
      const grid = createGridWithCityRoads(ROAD_PAIRS);
      system.setWalkabilityGrid(grid);

      const fromPos = LANDMARK_POSITIONS['city-luoyang'];
      const toPos = LANDMARK_POSITIONS['city-xuchang'];
      const route = system.calculateMarchRoute('city-luoyang', 'city-xuchang');

      expect(route).not.toBeNull();
      expect(route!.waypoints[0]).toEqual({ x: fromPos.x, y: fromPos.y });
      expect(route!.waypoints[route!.waypoints.length - 1]).toEqual({ x: toPos.x, y: toPos.y });
    });
  });

  // ── 不可达和错误输入 ───────────────────────

  describe('不可达和错误输入', () => {
    it('不可达城市返回 null', () => {
      // 创建一个空网格(没有道路)
      const emptyGrid: boolean[][] = [];
      for (let y = 0; y < 60; y++) {
        const row: boolean[] = [];
        for (let x = 0; x < 100; x++) {
          row.push(false);
        }
        emptyGrid.push(row);
      }
      // 只标记两个城市位置为可行走，但没有道路连接
      emptyGrid[23][50] = true;  // 洛阳
      emptyGrid[49][12] = true; // 成都

      system.setWalkabilityGrid(emptyGrid);

      const route = system.calculateMarchRoute('city-luoyang', 'city-chengdu');
      expect(route).toBeNull();
    });

    it('不存在的城市ID返回 null', () => {
      const grid = createGridWithCityRoads(ROAD_PAIRS);
      system.setWalkabilityGrid(grid);

      const route = system.calculateMarchRoute('city-nonexistent', 'city-luoyang');
      expect(route).toBeNull();
    });

    it('两个都不存在的城市ID返回 null', () => {
      const grid = createGridWithCityRoads(ROAD_PAIRS);
      system.setWalkabilityGrid(grid);

      const route = system.calculateMarchRoute('city-fake-a', 'city-fake-b');
      expect(route).toBeNull();
    });

    it('未设置网格时返回 null', () => {
      // 不调用 setWalkabilityGrid
      const route = system.calculateMarchRoute('city-luoyang', 'city-xuchang');
      expect(route).toBeNull();
    });

    it('起点不存在返回 null', () => {
      const grid = createGridWithCityRoads(ROAD_PAIRS);
      system.setWalkabilityGrid(grid);

      const route = system.calculateMarchRoute('city-ghost', 'city-xuchang');
      expect(route).toBeNull();
    });

    it('终点不存在返回 null', () => {
      const grid = createGridWithCityRoads(ROAD_PAIRS);
      system.setWalkabilityGrid(grid);

      const route = system.calculateMarchRoute('city-luoyang', 'city-ghost');
      expect(route).toBeNull();
    });
  });

  // ── 途径城市 ───────────────────────────────

  describe('途径城市列表', () => {
    it('途径城市列表为数组类型', () => {
      const grid = createGridWithCityRoads(ROAD_PAIRS);
      system.setWalkabilityGrid(grid);

      const route = system.calculateMarchRoute('city-luoyang', 'city-xuchang');

      expect(route).not.toBeNull();
      expect(Array.isArray(route!.waypointCities)).toBe(true);
    });

    it('途径城市不包含起点和终点', () => {
      const grid = createGridWithCityRoads(ROAD_PAIRS);
      system.setWalkabilityGrid(grid);

      const route = system.calculateMarchRoute('city-luoyang', 'city-xuchang');

      expect(route).not.toBeNull();
      expect(route!.waypointCities).not.toContain('city-luoyang');
      expect(route!.waypointCities).not.toContain('city-xuchang');
    });

    it('途径城市列表中的城市ID在 LANDMARK_POSITIONS 中存在', () => {
      const grid = createGridWithCityRoads(ROAD_PAIRS);
      system.setWalkabilityGrid(grid);

      const route = system.calculateMarchRoute('city-luoyang', 'city-xuchang');

      expect(route).not.toBeNull();
      for (const cityId of route!.waypointCities) {
        expect(LANDMARK_POSITIONS[cityId]).toBeDefined();
        expect(cityId.startsWith('city-')).toBe(true);
      }
    });

    it('同一城市不会重复出现在途径列表中', () => {
      const grid = createGridWithCityRoads(ROAD_PAIRS);
      system.setWalkabilityGrid(grid);

      const route = system.calculateMarchRoute('city-luoyang', 'city-xuchang');

      expect(route).not.toBeNull();
      const uniqueCities = new Set(route!.waypointCities);
      expect(uniqueCities.size).toBe(route!.waypointCities.length);
    });

    it('经过中间城市的路线包含该城市在途径列表中', () => {
      // 构建: 洛阳(50,23) → 许昌(37,26) → 邺城(32,9) 道路
      // 洛阳→邺城 路线应经过许昌
      const grid = createGridWithCityRoads([
        ['city-luoyang', 'city-xuchang'],
        ['city-xuchang', 'city-ye'],
      ]);
      system.setWalkabilityGrid(grid);

      const route = system.calculateMarchRoute('city-luoyang', 'city-ye');

      expect(route).not.toBeNull();
      // 路线经过许昌(37,26)
      expect(route!.waypointCities).toContain('city-xuchang');
    });
  });

  // ── 路径连续性 ─────────────────────────────

  describe('路径连续性', () => {
    it('路径相邻点距离为1(上下左右)', () => {
      const grid = createGridWithCityRoads(ROAD_PAIRS);
      system.setWalkabilityGrid(grid);

      const route = system.calculateMarchRoute('city-luoyang', 'city-xuchang');

      expect(route).not.toBeNull();
      for (let i = 1; i < route!.path.length; i++) {
        const dx = Math.abs(route!.path[i].x - route!.path[i - 1].x);
        const dy = Math.abs(route!.path[i].y - route!.path[i - 1].y);
        // 曼哈顿距离必须为1(单步移动)
        expect(dx + dy).toBe(1);
      }
    });

    it('路径上所有点在网格范围内', () => {
      const grid = createGridWithCityRoads(ROAD_PAIRS);
      system.setWalkabilityGrid(grid);

      const route = system.calculateMarchRoute('city-luoyang', 'city-xuchang');

      expect(route).not.toBeNull();
      for (const pos of route!.path) {
        expect(pos.x).toBeGreaterThanOrEqual(0);
        expect(pos.x).toBeLessThan(100);
        expect(pos.y).toBeGreaterThanOrEqual(0);
        expect(pos.y).toBeLessThan(60);
      }
    });

    it('路径上所有点在可行走网格中为 true', () => {
      const grid = createGridWithCityRoads(ROAD_PAIRS);
      system.setWalkabilityGrid(grid);

      const route = system.calculateMarchRoute('city-luoyang', 'city-xuchang');

      expect(route).not.toBeNull();
      for (const pos of route!.path) {
        expect(grid[pos.y][pos.x]).toBe(true);
      }
    });
  });

  // ── 多条路线 ───────────────────────────────

  describe('多条路线', () => {
    it('洛阳→邺城经过许昌', () => {
      const grid = createGridWithCityRoads([
        ['city-luoyang', 'city-xuchang'],
        ['city-xuchang', 'city-ye'],
      ]);
      system.setWalkabilityGrid(grid);

      const route = system.calculateMarchRoute('city-luoyang', 'city-ye');

      expect(route).not.toBeNull();
      const fromPos = LANDMARK_POSITIONS['city-luoyang'];
      const toPos = LANDMARK_POSITIONS['city-ye'];
      expect(route!.path[0]).toEqual({ x: fromPos.x, y: fromPos.y });
      expect(route!.path[route!.path.length - 1]).toEqual({ x: toPos.x, y: toPos.y });
      // 路线经过许昌
      expect(route!.waypointCities).toContain('city-xuchang');
    });

    it('洛阳→洛阳(同城市)返回单点路线', () => {
      const grid = createGridWithCityRoads(ROAD_PAIRS);
      system.setWalkabilityGrid(grid);

      const route = system.calculateMarchRoute('city-luoyang', 'city-luoyang');

      expect(route).not.toBeNull();
      expect(route!.path.length).toBe(1);
      expect(route!.distance).toBe(0);
      expect(route!.estimatedTime).toBe(0);
      expect(route!.waypointCities).toEqual([]);
    });

    it('不同路线有不同距离', () => {
      const grid = createGridWithCityRoads([
        ['city-luoyang', 'city-xuchang'],
        ['city-xuchang', 'city-ye'],
      ]);
      system.setWalkabilityGrid(grid);

      const route1 = system.calculateMarchRoute('city-luoyang', 'city-xuchang');
      const route2 = system.calculateMarchRoute('city-luoyang', 'city-ye');

      expect(route1).not.toBeNull();
      expect(route2).not.toBeNull();
      // 洛阳→邺城比洛阳→许昌更远
      expect(route2!.distance).toBeGreaterThan(route1!.distance);
    });
  });
});
