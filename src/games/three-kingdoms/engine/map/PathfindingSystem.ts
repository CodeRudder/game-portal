/**
 * A* 寻路系统
 *
 * 基于地图网格的 A* 寻路，支持：
 * - 道路/城市可行走网格构建
 * - 标准 A* 算法（4 方向、曼哈顿距离启发）
 * - 城市间寻路
 * - 路径关键转折点提取
 *
 * @module engine/map/PathfindingSystem
 */

import type { ParsedMap, ASCIITerrain } from '@/games/three-kingdoms/core/map/ASCIIMapParser';
import type { GridPosition } from '@/games/three-kingdoms/core/map/world-map.types';
import { LANDMARK_POSITIONS } from '@/games/three-kingdoms/core/map/map-config';

// 重新导出核心层类型和函数，保持向后兼容
export type { WalkabilityGrid } from '@/games/three-kingdoms/core/map/territory-config';
export { deriveAdjacency } from '@/games/three-kingdoms/core/map/territory-config';

/** A* 节点（内部使用） */
interface AStarNode {
  x: number;
  y: number;
  g: number;
  h: number;
  f: number;
  parent: AStarNode | null;
}

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

/** 网格尺寸（与 world-map.txt 一致） */
const GRID_COLS = 100;
const GRID_ROWS = 60;

/** 可行走的地形类型集合 */
const WALKABLE_TERRAINS: ReadonlySet<ASCIITerrain> = new Set<ASCIITerrain>([
  'road_h',
  'road_v',
  'road_cross',
  'road_diag',
  'path',
  'pass',
  'city',
  'resource',
  'outpost',
]);

/** 4 方向移动偏移：上、下、左、右 */
const DIRECTIONS: ReadonlyArray<readonly [number, number]> = [
  [0, -1],
  [0, 1],
  [-1, 0],
  [1, 0],
] as const;

// ─────────────────────────────────────────────
// 最小堆（用于 A* 开放列表）
// ─────────────────────────────────────────────

/**
 * 简易最小堆，按 f 值排序
 *
 * 使用数组实现二叉堆，索引 0 为根节点。
 */
class MinHeap {
  private data: AStarNode[] = [];

  get size(): number {
    return this.data.length;
  }

  push(node: AStarNode): void {
    this.data.push(node);
    this.bubbleUp(this.data.length - 1);
  }

  pop(): AStarNode | undefined {
    if (this.data.length === 0) return undefined;

    const min = this.data[0];
    const last = this.data.pop()!;

    if (this.data.length > 0) {
      this.data[0] = last;
      this.sinkDown(0);
    }

    return min;
  }

  private bubbleUp(index: number): void {
    while (index > 0) {
      const parentIndex = (index - 1) >> 1;
      if (this.data[index].f >= this.data[parentIndex].f) break;
      this.swap(index, parentIndex);
      index = parentIndex;
    }
  }

  private sinkDown(index: number): void {
    const length = this.data.length;

    while (true) {
      let smallest = index;
      const left = 2 * index + 1;
      const right = 2 * index + 2;

      if (left < length && this.data[left].f < this.data[smallest].f) {
        smallest = left;
      }
      if (right < length && this.data[right].f < this.data[smallest].f) {
        smallest = right;
      }

      if (smallest === index) break;

      this.swap(index, smallest);
      index = smallest;
    }
  }

  private swap(i: number, j: number): void {
    const temp = this.data[i];
    this.data[i] = this.data[j];
    this.data[j] = temp;
  }
}

// ─────────────────────────────────────────────
// 核心函数
// ─────────────────────────────────────────────

/**
 * 构建可行走网格
 *
 * 道路格子（road_h/road_v/road_cross/road_diag/path/pass）和城市格子 → true
 * 其他地形 → false
 *
 * @param parsedMap - ASCIIMapParser 解析后的地图数据
 * @returns WalkabilityGrid（boolean[y][x]）
 */
export function buildWalkabilityGrid(parsedMap: ParsedMap): WalkabilityGrid {
  const grid: WalkabilityGrid = [];

  for (let y = 0; y < parsedMap.height; y++) {
    const row: boolean[] = [];
    for (let x = 0; x < parsedMap.width; x++) {
      const cell = parsedMap.cells[y]?.[x];
      row.push(cell ? WALKABLE_TERRAINS.has(cell.terrain) : false);
    }
    grid.push(row);
  }

  return grid;
}

/**
 * 获取所有城市的网格坐标
 *
 * 从 LANDMARK_POSITIONS 获取城市坐标并验证可行走性。
 * 仅返回 city-* 前缀的地标（排除 pass/resource 等）。
 *
 * @param grid - 可行走网格（可选，传入时验证可行走性）
 * @returns 城市ID → GridPosition 映射
 */
export function getCityGridPositions(grid?: WalkabilityGrid): Map<string, GridPosition> {
  const positions = new Map<string, GridPosition>();

  for (const [id, pos] of Object.entries(LANDMARK_POSITIONS)) {
    // 仅处理城市类型地标
    if (!id.startsWith('city-')) continue;

    const gridPos: GridPosition = { x: pos.x, y: pos.y };

    // 验证坐标在网格范围内且可行走
    if (grid) {
      const inBounds = pos.y >= 0 && pos.y < grid.length &&
                       pos.x >= 0 && pos.x < (grid[0]?.length ?? 0);
      if (inBounds && grid[pos.y][pos.x]) {
        positions.set(id, gridPos);
      }
    } else {
      positions.set(id, gridPos);
    }
  }

  return positions;
}

/**
 * A* 寻路
 *
 * 在可行走网格上使用 A* 算法寻找从起点到终点的最短路径。
 * - 4 方向移动（上下左右）
 * - 启发函数：曼哈顿距离
 * - 开放列表：最小堆优先队列
 * - 关闭列表：Set<string>（key = "x,y"）
 *
 * @param start - 起点坐标
 * @param end - 终点坐标
 * @param grid - 可行走网格
 * @returns 路径坐标序列（包含起点和终点），不可达时返回空数组
 */
export function findPath(
  start: GridPosition,
  end: GridPosition,
  grid: WalkabilityGrid,
): GridPosition[] {
  const rows = grid.length;
  if (rows === 0) return [];
  const cols = grid[0].length;
  if (cols === 0) return [];

  // 边界检查
  if (!isInBounds(start.x, start.y, cols, rows) ||
      !isInBounds(end.x, end.y, cols, rows)) {
    return [];
  }

  // 起点或终点不可行走
  if (!grid[start.y][start.x] || !grid[end.y][end.x]) {
    return [];
  }

  // 起终点相同
  if (start.x === end.x && start.y === end.y) {
    return [{ x: start.x, y: start.y }];
  }

  // 初始化
  const openList = new MinHeap();
  const closedSet = new Set<string>();

  const startNode: AStarNode = {
    x: start.x,
    y: start.y,
    g: 0,
    h: manhattanDistance(start.x, start.y, end.x, end.y),
    f: 0,
    parent: null,
  };
  startNode.f = startNode.g + startNode.h;

  openList.push(startNode);

  // A* 主循环
  while (openList.size > 0) {
    const current = openList.pop()!;

    // 到达终点
    if (current.x === end.x && current.y === end.y) {
      return reconstructPath(current);
    }

    const currentKey = `${current.x},${current.y}`;
    if (closedSet.has(currentKey)) continue;
    closedSet.add(currentKey);

    // 遍历 4 方向邻居
    for (const [dx, dy] of DIRECTIONS) {
      const nx = current.x + dx;
      const ny = current.y + dy;

      // 越界检查
      if (!isInBounds(nx, ny, cols, rows)) continue;

      // 不可行走
      if (!grid[ny][nx]) continue;

      const neighborKey = `${nx},${ny}`;
      if (closedSet.has(neighborKey)) continue;

      const tentativeG = current.g + 1;
      const h = manhattanDistance(nx, ny, end.x, end.y);

      const neighborNode: AStarNode = {
        x: nx,
        y: ny,
        g: tentativeG,
        h,
        f: tentativeG + h,
        parent: current,
      };

      openList.push(neighborNode);
    }
  }

  // 不可达
  return [];
}

/**
 * 城市间寻路
 *
 * 从 LANDMARK_POSITIONS 获取两城市坐标，调用 findPath 计算路径。
 * 需先调用 buildWalkabilityGrid 构建网格并缓存。
 *
 * @param fromCityId - 起点城市 ID（如 'city-luoyang'）
 * @param toCityId - 终点城市 ID（如 'city-xuchang'）
 * @param grid - 可行走网格
 * @returns 路径坐标序列，不可达时返回空数组
 */
export function findPathBetweenCities(
  fromCityId: string,
  toCityId: string,
  grid: WalkabilityGrid,
): GridPosition[] {
  const fromPos = LANDMARK_POSITIONS[fromCityId];
  const toPos = LANDMARK_POSITIONS[toCityId];

  if (!fromPos || !toPos) return [];

  return findPath(
    { x: fromPos.x, y: fromPos.y },
    { x: toPos.x, y: toPos.y },
    grid,
  );
}

/**
 * 提取路径关键转折点
 *
 * 从完整路径中提取方向变化处的坐标，用于简化路线显示。
 * - 直线路径压缩为起点和终点
 * - 转折点（方向变化处）保留
 *
 * @param path - 完整路径坐标序列
 * @returns 简化后的转折点序列
 */
export function extractWaypoints(path: GridPosition[]): GridPosition[] {
  if (path.length <= 2) return [...path];

  const waypoints: GridPosition[] = [path[0]];

  for (let i = 1; i < path.length - 1; i++) {
    const prev = path[i - 1];
    const curr = path[i];
    const next = path[i + 1];

    const dx1 = curr.x - prev.x;
    const dy1 = curr.y - prev.y;
    const dx2 = next.x - curr.x;
    const dy2 = next.y - curr.y;

    // 方向发生变化 → 该点是转折点
    if (dx1 !== dx2 || dy1 !== dy2) {
      waypoints.push(curr);
    }
  }

  // 始终包含终点
  waypoints.push(path[path.length - 1]);

  return waypoints;
}

// ─────────────────────────────────────────────
// 辅助函数
// ─────────────────────────────────────────────

/** 曼哈顿距离 */
function manhattanDistance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.abs(x1 - x2) + Math.abs(y1 - y2);
}

/** 边界检查 */
function isInBounds(x: number, y: number, cols: number, rows: number): boolean {
  return x >= 0 && x < cols && y >= 0 && y < rows;
}

/** 从终点回溯重建路径 */
function reconstructPath(endNode: AStarNode): GridPosition[] {
  const path: GridPosition[] = [];
  let current: AStarNode | null = endNode;

  while (current !== null) {
    path.push({ x: current.x, y: current.y });
    current = current.parent;
  }

  path.reverse();
  return path;
}
