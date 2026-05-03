/**
 * PathfindingSystem 测试
 *
 * 覆盖：
 *   B1 道路网格构建
 *   B2 A* 寻路
 *   性能验证（100×60 网格 < 5ms）
 *
 * @module engine/map/__tests__/PathfindingSystem.test
 */

import {
  buildWalkabilityGrid,
  getCityGridPositions,
  findPath,
  findPathBetweenCities,
  extractWaypoints,
} from '../PathfindingSystem';

import type { ParsedMap, MapCell, ASCIITerrain } from '@/games/three-kingdoms/core/map/ASCIIMapParser';
import type { GridPosition } from '@/games/three-kingdoms/core/map/world-map.types';

// ─────────────────────────────────────────────
// 辅助工具
// ─────────────────────────────────────────────

/**
 * 创建简易模拟地图
 *
 * 使用字符矩阵快速构建 ParsedMap，字符含义：
 * - 'R' → road_h, 'V' → road_v, 'C' → road_cross, 'D' → road_diag
 * - 'P' → path, 'E' → pass, 'T' → city
 * - '.' → plain, '^' → mountain, '~' → water, '#' → forest
 * - 其他 → empty
 */
function createMockMap(layout: string[]): ParsedMap {
  const height = layout.length;
  const width = layout[0]?.length ?? 0;

  const CHAR_MAP: Record<string, ASCIITerrain> = {
    R: 'road_h',
    V: 'road_v',
    C: 'road_cross',
    D: 'road_diag',
    P: 'path',
    E: 'pass',
    T: 'city',
    '.': 'plain',
    '^': 'mountain',
    '~': 'water',
    '#': 'forest',
  };

  const cells: MapCell[][] = [];

  for (let y = 0; y < height; y++) {
    const row: MapCell[] = [];
    const line = layout[y] || '';

    for (let x = 0; x < width; x++) {
      const char = line[x] || ' ';
      const terrain = CHAR_MAP[char] ?? 'empty';
      row.push({ x, y, char, terrain });
    }

    cells.push(row);
  }

  return {
    name: 'test-map',
    width,
    height,
    tileSize: 8,
    cells,
    cityMap: {},
    cities: [],
    roads: [],
  };
}

/**
 * 创建全网格（指定位置为道路，其余为平原）
 */
function createGridWithRoads(
  cols: number,
  rows: number,
  roadPositions: GridPosition[],
): boolean[][] {
  const grid: boolean[][] = [];
  const roadSet = new Set(roadPositions.map(p => `${p.x},${p.y}`));

  for (let y = 0; y < rows; y++) {
    const row: boolean[] = [];
    for (let x = 0; x < cols; x++) {
      row.push(roadSet.has(`${x},${y}`));
    }
    grid.push(row);
  }

  return grid;
}

// ============================================================
// B1: 道路网格构建
// ============================================================

describe('PathfindingSystem — B1 道路网格构建', () => {
  describe('buildWalkabilityGrid', () => {
    it('道路格子为 true，非道路为 false', () => {
      // 5×5 地图：中央一行道路，上下为平原/山地/水域
      const map = createMockMap([
        '.^.~.',
        '.....',
        'RRRRR',
        '.....',
        '.^.~.',
      ]);

      const grid = buildWalkabilityGrid(map);

      // 道路行全部为 true
      expect(grid[2][0]).toBe(true);
      expect(grid[2][1]).toBe(true);
      expect(grid[2][2]).toBe(true);
      expect(grid[2][3]).toBe(true);
      expect(grid[2][4]).toBe(true);

      // 非道路格子为 false
      expect(grid[0][0]).toBe(false); // 平原
      expect(grid[0][1]).toBe(false); // 山地
      expect(grid[0][2]).toBe(false); // 平原
      expect(grid[0][3]).toBe(false); // 水域
      expect(grid[1][0]).toBe(false); // 平原
    });

    it('支持所有道路地形类型', () => {
      const map = createMockMap([
        'RVCDE',
      ]);

      const grid = buildWalkabilityGrid(map);

      expect(grid[0][0]).toBe(true);  // road_h
      expect(grid[0][1]).toBe(true);  // road_v
      expect(grid[0][2]).toBe(true);  // road_cross
      expect(grid[0][3]).toBe(true);  // road_diag
      expect(grid[0][4]).toBe(true);  // pass
    });

    it('城市位置为 true', () => {
      const map = createMockMap([
        '.T.',
        'T.T',
        '.T.',
      ]);

      const grid = buildWalkabilityGrid(map);

      // 城市格子为 true
      expect(grid[0][1]).toBe(true);
      expect(grid[1][0]).toBe(true);
      expect(grid[1][2]).toBe(true);
      expect(grid[2][1]).toBe(true);

      // 非城市格子为 false
      expect(grid[0][0]).toBe(false);
      expect(grid[1][1]).toBe(false);
    });

    it('混合地形正确标记', () => {
      const map = createMockMap([
        'R.^T',
        '~##P',
      ]);

      const grid = buildWalkabilityGrid(map);

      // R=道路(true), .=平原(false), ^=山地(false), T=城市(true)
      expect(grid[0]).toEqual([true, false, false, true]);
      // ~=水域(false), #=森林(false), #=森林(false), P=小路(true)
      expect(grid[1]).toEqual([false, false, false, true]);
    });
  });

  describe('getCityGridPositions', () => {
    it('返回所有 city-* 前缀的地标坐标', () => {
      const positions = getCityGridPositions();

      expect(positions.size).toBeGreaterThan(0);

      // 洛阳
      const luoyang = positions.get('city-luoyang');
      expect(luoyang).toBeDefined();
      expect(luoyang!.x).toBe(50);
      expect(luoyang!.y).toBe(23);

      // 许昌
      const xuchang = positions.get('city-xuchang');
      expect(xuchang).toBeDefined();
      expect(xuchang!.x).toBe(37);
      expect(xuchang!.y).toBe(26);

      // 不包含 pass/resource 类型
      expect(positions.has('pass-hulao')).toBe(false);
      expect(positions.has('res-grain1')).toBe(false);
    });

    it('传入 grid 时验证可行走性', () => {
      // 创建一个只有洛阳位置可行走的网格
      const grid: boolean[][] = [];
      for (let y = 0; y < 60; y++) {
        const row: boolean[] = [];
        for (let x = 0; x < 100; x++) {
          row.push(false);
        }
        grid.push(row);
      }
      // 洛阳 (50, 23) 标记为可行走
      grid[23][50] = true;

      const positions = getCityGridPositions(grid);

      // 只有洛阳通过验证
      expect(positions.has('city-luoyang')).toBe(true);
      // 其他城市不可行走，被过滤
      expect(positions.has('city-xuchang')).toBe(false);
    });
  });
});

// ============================================================
// B2: A* 寻路
// ============================================================

describe('PathfindingSystem — B2 A* 寻路', () => {
  describe('findPath', () => {
    it('相邻点直接路径', () => {
      const grid = createGridWithRoads(5, 5, [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ]);

      const path = findPath({ x: 0, y: 0 }, { x: 1, y: 0 }, grid);

      expect(path).toEqual([
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ]);
    });

    it('直线路径', () => {
      const grid = createGridWithRoads(5, 1, [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 2, y: 0 },
        { x: 3, y: 0 },
        { x: 4, y: 0 },
      ]);

      const path = findPath({ x: 0, y: 0 }, { x: 4, y: 0 }, grid);

      expect(path.length).toBe(5);
      expect(path[0]).toEqual({ x: 0, y: 0 });
      expect(path[4]).toEqual({ x: 4, y: 0 });
    });

    it('绕过障碍物的路径', () => {
      // 5×5 网格：
      // S . . . .
      // . # # # .
      // . # . # .
      // . # # # .
      // . . . . E
      // S=start(0,0), E=end(4,4), #=障碍
      const obstaclePositions: GridPosition[] = [];
      for (let y = 1; y <= 3; y++) {
        for (let x = 1; x <= 3; x++) {
          // 中心 (2,2) 留空作为通道
          if (x === 2 && y === 2) continue;
          obstaclePositions.push({ x, y });
        }
      }

      // 所有位置都可行走，但障碍不可行走
      const allPositions: GridPosition[] = [];
      for (let y = 0; y < 5; y++) {
        for (let x = 0; x < 5; x++) {
          if (!obstaclePositions.find(o => o.x === x && o.y === y)) {
            allPositions.push({ x, y });
          }
        }
      }

      const grid = createGridWithRoads(5, 5, allPositions);

      const path = findPath({ x: 0, y: 0 }, { x: 4, y: 4 }, grid);

      expect(path.length).toBeGreaterThan(0);
      // 路径应包含起点和终点
      expect(path[0]).toEqual({ x: 0, y: 0 });
      expect(path[path.length - 1]).toEqual({ x: 4, y: 4 });

      // 路径不应穿过障碍物
      for (const pos of path) {
        const isObstacle = obstaclePositions.find(o => o.x === pos.x && o.y === pos.y);
        expect(isObstacle).toBeUndefined();
      }
    });

    it('不可达返回空数组', () => {
      // 两个孤立区域
      const grid = createGridWithRoads(5, 1, [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
      ]);

      const path = findPath({ x: 0, y: 0 }, { x: 4, y: 0 }, grid);

      expect(path).toEqual([]);
    });

    it('起点不可行走返回空数组', () => {
      const grid = createGridWithRoads(3, 3, [
        { x: 2, y: 2 },
      ]);

      // 起点 (0,0) 不可行走
      const path = findPath({ x: 0, y: 0 }, { x: 2, y: 2 }, grid);

      expect(path).toEqual([]);
    });

    it('终点不可行走返回空数组', () => {
      const grid = createGridWithRoads(3, 3, [
        { x: 0, y: 0 },
      ]);

      // 终点 (2,2) 不可行走
      const path = findPath({ x: 0, y: 0 }, { x: 2, y: 2 }, grid);

      expect(path).toEqual([]);
    });

    it('起终点相同返回单点路径', () => {
      const grid = createGridWithRoads(3, 3, [
        { x: 1, y: 1 },
      ]);

      const path = findPath({ x: 1, y: 1 }, { x: 1, y: 1 }, grid);

      expect(path).toEqual([{ x: 1, y: 1 }]);
    });

    it('越界坐标返回空数组', () => {
      const grid = createGridWithRoads(3, 3, [
        { x: 0, y: 0 },
      ]);

      const path = findPath({ x: -1, y: 0 }, { x: 2, y: 2 }, grid);

      expect(path).toEqual([]);
    });
  });

  describe('findPathBetweenCities', () => {
    // 创建一个模拟网格，包含道路连接城市
    function createTestGrid(): boolean[][] {
      const rows = 60;
      const cols = 100;
      const grid: boolean[][] = [];

      for (let y = 0; y < rows; y++) {
        const row: boolean[] = [];
        for (let x = 0; x < cols; x++) {
          row.push(false);
        }
        grid.push(row);
      }

      // 洛阳 (50, 23) 和 许昌 (37, 26) 标记为可行走
      grid[23][50] = true;  // 洛阳
      grid[26][37] = true; // 许昌

      // 在洛阳和许昌之间铺设道路
      // 洛阳 → 向左水平道路 (50→37, y=23)
      for (let x = 37; x <= 50; x++) {
        grid[23][x] = true;
      }
      // 向下到许昌 (y=23→26, x=37)
      for (let y = 23; y <= 26; y++) {
        grid[y][37] = true;
      }

      return grid;
    }

    it('洛阳→许昌的路径应沿道路', () => {
      const grid = createTestGrid();

      const path = findPathBetweenCities('city-luoyang', 'city-xuchang', grid);

      expect(path.length).toBeGreaterThan(0);
      expect(path[0]).toEqual({ x: 50, y: 23 });   // 洛阳
      expect(path[path.length - 1]).toEqual({ x: 37, y: 26 }); // 许昌

      // 路径上所有点都应可行走
      for (const pos of path) {
        expect(grid[pos.y][pos.x]).toBe(true);
      }
    });

    it('被水域/山地隔开的城市返回空数组', () => {
      const rows = 60;
      const cols = 100;
      const grid: boolean[][] = [];

      for (let y = 0; y < rows; y++) {
        const row: boolean[] = [];
        for (let x = 0; x < cols; x++) {
          row.push(false);
        }
        grid.push(row);
      }

      // 只标记城市位置为可行走，中间没有道路
      grid[23][50] = true;  // 洛阳
      grid[49][12] = true; // 成都 (city-chengdu)

      const path = findPathBetweenCities('city-luoyang', 'city-chengdu', grid);

      expect(path).toEqual([]);
    });

    it('不存在的城市 ID 返回空数组', () => {
      const grid: boolean[][] = [[true]];

      const path = findPathBetweenCities('city-nonexistent', 'city-luoyang', grid);

      expect(path).toEqual([]);
    });
  });

  describe('extractWaypoints', () => {
    it('直线路径压缩为起点终点', () => {
      const path: GridPosition[] = [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 2, y: 0 },
        { x: 3, y: 0 },
        { x: 4, y: 0 },
      ];

      const waypoints = extractWaypoints(path);

      expect(waypoints).toEqual([
        { x: 0, y: 0 },
        { x: 4, y: 0 },
      ]);
    });

    it('L 形路径保留转折点', () => {
      const path: GridPosition[] = [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 2, y: 0 }, // 转折点：从水平变为垂直
        { x: 2, y: 1 },
        { x: 2, y: 2 },
      ];

      const waypoints = extractWaypoints(path);

      expect(waypoints).toEqual([
        { x: 0, y: 0 },
        { x: 2, y: 0 }, // 保留转折点
        { x: 2, y: 2 },
      ]);
    });

    it('Z 形路径保留两个转折点', () => {
      const path: GridPosition[] = [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 2, y: 0 }, // 转折 1：水平→垂直
        { x: 2, y: 1 },
        { x: 3, y: 1 }, // 转折 2：垂直→水平
        { x: 4, y: 1 },
      ];

      const waypoints = extractWaypoints(path);

      // 转折点在 (2,0) 和 (2,1)：
      // (2,0) 方向从 (1,0) 变为 (0,1)
      // (2,1) 方向从 (0,1) 变为 (1,0)
      expect(waypoints).toEqual([
        { x: 0, y: 0 },
        { x: 2, y: 0 }, // 转折 1
        { x: 2, y: 1 }, // 转折 2
        { x: 4, y: 1 },
      ]);
    });

    it('两元素路径原样返回', () => {
      const path: GridPosition[] = [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ];

      const waypoints = extractWaypoints(path);

      expect(waypoints).toEqual(path);
    });

    it('单元素路径原样返回', () => {
      const path: GridPosition[] = [{ x: 5, y: 5 }];

      const waypoints = extractWaypoints(path);

      expect(waypoints).toEqual([{ x: 5, y: 5 }]);
    });

    it('空路径返回空数组', () => {
      const waypoints = extractWaypoints([]);

      expect(waypoints).toEqual([]);
    });
  });
});

// ============================================================
// 性能测试
// ============================================================

describe('PathfindingSystem — 性能', () => {
  it('100×60 网格寻路 < 5ms', () => {
    // 创建一个全可行走的 100×60 网格（最坏情况）
    const grid: boolean[][] = [];
    for (let y = 0; y < 60; y++) {
      const row: boolean[] = [];
      for (let x = 0; x < 100; x++) {
        row.push(true);
      }
      grid.push(row);
    }

    const start: GridPosition = { x: 0, y: 0 };
    const end: GridPosition = { x: 99, y: 59 };

    // 预热
    findPath(start, end, grid);

    // 计时
    const iterations = 10;
    const startTime = performance.now();

    for (let i = 0; i < iterations; i++) {
      findPath(start, end, grid);
    }

    const endTime = performance.now();
    const avgMs = (endTime - startTime) / iterations;

    // 单次寻路应 < 5ms
    expect(avgMs).toBeLessThan(5);

    // 输出性能信息（调试用）
    console.log(`A* 寻路 100×60 全可行走网格: 平均 ${avgMs.toFixed(2)}ms/次`);
  });

  it('带障碍物的 100×60 网格寻路 < 5ms', () => {
    // 创建带随机障碍物的网格（~30% 障碍）
    const grid: boolean[][] = [];
    for (let y = 0; y < 60; y++) {
      const row: boolean[] = [];
      for (let x = 0; x < 100; x++) {
        // 使用简单哈希实现确定性障碍分布
        const hash = (x * 7 + y * 13 + x * y * 3) % 10;
        row.push(hash >= 3); // 70% 可行走
      }
      grid.push(row);
    }

    // 确保起点和终点可行走
    grid[0][0] = true;
    grid[59][99] = true;

    const start: GridPosition = { x: 0, y: 0 };
    const end: GridPosition = { x: 99, y: 59 };

    const startTime = performance.now();
    const path = findPath(start, end, grid);
    const elapsed = performance.now() - startTime;

    expect(elapsed).toBeLessThan(5);
    expect(path.length).toBeGreaterThan(0);

    console.log(`A* 寻路 100×60 带障碍物网格: ${elapsed.toFixed(2)}ms, 路径长度 ${path.length}`);
  });
});
