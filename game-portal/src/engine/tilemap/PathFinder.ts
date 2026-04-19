/**
 * A* 寻路算法
 *
 * 基于地形移动消耗和建筑阻挡的 A* 寻路实现。
 * 支持 4 方向和 8 方向移动，可配置最大搜索距离和是否避开建筑。
 *
 * @module engine/tilemap/PathFinder
 */

import type { TileMapData, Tile, TerrainDef } from './types';

// ---------------------------------------------------------------------------
// 节点（用于优先队列）
// ---------------------------------------------------------------------------

interface PathNode {
  x: number;
  y: number;
  g: number; // 从起点到当前节点的实际代价
  h: number; // 启发式估计到终点的代价
  f: number; // g + h
  parent: PathNode | null;
}

// ---------------------------------------------------------------------------
// 简易最小堆
// ---------------------------------------------------------------------------

class MinHeap {
  private data: PathNode[] = [];

  get size(): number {
    return this.data.length;
  }

  push(node: PathNode): void {
    this.data.push(node);
    this.bubbleUp(this.data.length - 1);
  }

  pop(): PathNode | undefined {
    if (this.data.length === 0) return undefined;
    const top = this.data[0];
    const last = this.data.pop()!;
    if (this.data.length > 0) {
      this.data[0] = last;
      this.sinkDown(0);
    }
    return top;
  }

  private bubbleUp(i: number): void {
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.data[parent].f <= this.data[i].f) break;
      [this.data[parent], this.data[i]] = [this.data[i], this.data[parent]];
      i = parent;
    }
  }

  private sinkDown(i: number): void {
    const n = this.data.length;
    while (true) {
      let smallest = i;
      const left = 2 * i + 1;
      const right = 2 * i + 2;
      if (left < n && this.data[left].f < this.data[smallest].f) smallest = left;
      if (right < n && this.data[right].f < this.data[smallest].f) smallest = right;
      if (smallest === i) break;
      [this.data[smallest], this.data[i]] = [this.data[i], this.data[smallest]];
      i = smallest;
    }
  }
}

// ---------------------------------------------------------------------------
// PathFinder
// ---------------------------------------------------------------------------

/** 寻路选项 */
export interface PathFindOptions {
  /** 最大搜索距离（曼哈顿），超出则放弃 */
  maxDistance?: number;
  /** 是否避开有建筑的格子 */
  avoidBuildings?: boolean;
  /** 是否允许 8 方向移动（默认 false = 4 方向） */
  allowDiagonal?: boolean;
}

export class PathFinder {
  private mapData: TileMapData | null = null;
  private terrainDefs: Map<string, TerrainDef> = new Map();

  constructor(terrainDefs: TerrainDef[]) {
    for (const def of terrainDefs) {
      this.terrainDefs.set(def.type, def);
    }
  }

  /** 设置地图数据 */
  setMapData(data: TileMapData): void {
    this.mapData = data;
  }

  // -----------------------------------------------------------------------
  // A* 寻路
  // -----------------------------------------------------------------------

  /**
   * A* 寻路
   *
   * @returns 路径点列表（包含起点和终点），不可达时返回空数组
   */
  findPath(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    options: PathFindOptions = {},
  ): { x: number; y: number }[] {
    if (!this.mapData) return [];

    const { maxDistance, avoidBuildings = false, allowDiagonal = false } = options;
    const { width, height } = this.mapData;

    // 边界检查
    if (!this.inBounds(startX, startY) || !this.inBounds(endX, endY)) return [];
    // 起终点必须可通行
    if (!this.isWalkable(startX, startY) || !this.isWalkable(endX, endY)) return [];

    // 最大距离检查
    if (maxDistance !== undefined) {
      const dist = Math.abs(endX - startX) + Math.abs(endY - startY);
      if (dist > maxDistance) return [];
    }

    // 构建建筑占用集合
    const buildingOccupied = new Set<string>();
    if (avoidBuildings && this.mapData.buildings) {
      for (const bld of this.mapData.buildings) {
        buildingOccupied.add(`${bld.x},${bld.y}`);
      }
    }

    const openSet = new MinHeap();
    const closedSet = new Set<string>();

    const startNode: PathNode = {
      x: startX,
      y: startY,
      g: 0,
      h: this.heuristic(startX, startY, endX, endY),
      f: 0,
      parent: null,
    };
    startNode.f = startNode.g + startNode.h;
    openSet.push(startNode);

    const key = (x: number, y: number) => `${x},${y}`;

    while (openSet.size > 0) {
      const current = openSet.pop()!;

      // 到达终点
      if (current.x === endX && current.y === endY) {
        return this.reconstructPath(current);
      }

      const ck = key(current.x, current.y);
      if (closedSet.has(ck)) continue;
      closedSet.add(ck);

      // 遍历邻居
      const neighbors = this.getNeighbors(current.x, current.y, allowDiagonal);
      for (const neighbor of neighbors) {
        const nk = key(neighbor.x, neighbor.y);
        if (closedSet.has(nk)) continue;

        // 检查可通行性
        if (!this.isWalkable(neighbor.x, neighbor.y)) continue;

        // 检查建筑占用
        if (avoidBuildings && buildingOccupied.has(nk)) continue;

        const g = current.g + neighbor.cost;
        const h = this.heuristic(neighbor.x, neighbor.y, endX, endY);
        const node: PathNode = {
          x: neighbor.x,
          y: neighbor.y,
          g,
          h,
          f: g + h,
          parent: current,
        };
        openSet.push(node);
      }
    }

    // 不可达
    return [];
  }

  // -----------------------------------------------------------------------
  // 辅助方法
  // -----------------------------------------------------------------------

  /** 获取邻居格子 */
  private getNeighbors(
    x: number,
    y: number,
    allowDiagonal: boolean,
  ): { x: number; y: number; cost: number }[] {
    // 4 方向
    const dirs = [
      { dx: 0, dy: -1 },
      { dx: 0, dy: 1 },
      { dx: -1, dy: 0 },
      { dx: 1, dy: 0 },
    ];

    // 8 方向
    if (allowDiagonal) {
      dirs.push(
        { dx: -1, dy: -1 },
        { dx: 1, dy: -1 },
        { dx: -1, dy: 1 },
        { dx: 1, dy: 1 },
      );
    }

    const result: { x: number; y: number; cost: number }[] = [];

    for (const { dx, dy } of dirs) {
      const nx = x + dx;
      const ny = y + dy;
      if (!this.inBounds(nx, ny)) continue;

      const tile = this.mapData!.tiles[ny][nx];
      const terrainDef = this.terrainDefs.get(tile.terrain);
      const moveCost = terrainDef?.movementCost ?? 1;

      if (moveCost === Infinity) continue;

      // 对角线移动代价 × √2
      const distFactor = dx !== 0 && dy !== 0 ? Math.SQRT2 : 1;
      result.push({ x: nx, y: ny, cost: moveCost * distFactor });
    }

    return result;
  }

  /** 启发函数：曼哈顿距离 */
  private heuristic(x1: number, y1: number, x2: number, y2: number): number {
    return Math.abs(x2 - x1) + Math.abs(y2 - y1);
  }

  /** 检查坐标是否在地图范围内 */
  private inBounds(x: number, y: number): boolean {
    if (!this.mapData) return false;
    return x >= 0 && x < this.mapData.width && y >= 0 && y < this.mapData.height;
  }

  /** 检查格子是否可通行 */
  isWalkable(x: number, y: number): boolean {
    if (!this.mapData) return false;
    if (!this.inBounds(x, y)) return false;

    const tile = this.mapData.tiles[y][x];
    const terrainDef = this.terrainDefs.get(tile.terrain);
    return terrainDef?.walkable ?? false;
  }

  /** 从终点回溯构建路径 */
  private reconstructPath(endNode: PathNode): { x: number; y: number }[] {
    const path: { x: number; y: number }[] = [];
    let node: PathNode | null = endNode;
    while (node) {
      path.unshift({ x: node.x, y: node.y });
      node = node.parent;
    }
    return path;
  }
}
