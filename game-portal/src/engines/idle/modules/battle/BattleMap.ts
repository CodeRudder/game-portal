/**
 * BattleMap — 战斗地图系统
 *
 * 支持方格地图（GridMap）和六角地图（HexMap）两种模式。
 * 提供地形定义、占据者管理、移动范围计算（BFS）、
 * 攻击范围计算、A* 寻路等功能。
 *
 * 六角网格使用 axial 坐标系（q, r），
 * 通过公式转换为内部二维数组存储。
 *
 * @module engines/idle/modules/battle/BattleMap
 */

// ============================================================
// 类型定义
// ============================================================

/** 地形格子类型 */
export type MapCellType = 'plain' | 'forest' | 'mountain' | 'water' | 'wall' | 'road' | 'castle' | 'bridge';

/** 地图格子 */
export interface MapCell {
  /** 列坐标（grid 模式） */
  x: number;
  /** 行坐标（grid 模式） */
  y: number;
  /** 地形类型 */
  type: MapCellType;
  /** 移动消耗（plain=1, forest=2, mountain=3, water=∞, wall=∞） */
  movementCost: number;
  /** 防御加成比例（forest=0.1, mountain=0.2, castle=0.25） */
  defenseBonus: number;
  /** 占据该格的单位 ID，null 表示空 */
  occupantId: string | null;
}

/** 地图定义（用于从配置创建地图） */
export interface MapDef {
  /** 地图宽度（列数） */
  width: number;
  /** 地图高度（行数） */
  height: number;
  /** 二维数组定义地形类型，cells[y][x] */
  cells: MapCellType[][];
}

/** 六角网格坐标（axial coordinates） */
export interface HexCoord {
  /** 列 */
  q: number;
  /** 行 */
  r: number;
}

/** 六角格子 */
export interface HexCell extends MapCell {
  /** 六角列坐标 */
  q: number;
  /** 六角行坐标 */
  r: number;
}

/** 坐标点 */
export interface Point {
  x: number;
  y: number;
}

// ============================================================
// 地形属性表
// ============================================================

/** 地形属性配置 */
export interface TerrainProps {
  /** 移动消耗（Infinity 表示不可通过） */
  movementCost: number;
  /** 防御加成比例 */
  defenseBonus: number;
  /** 每回合治疗量 */
  healPerTurn: number;
}

/** 地形属性映射表 */
const TERRAIN_TABLE: Record<MapCellType, TerrainProps> = {
  plain:    { movementCost: 1,        defenseBonus: 0,    healPerTurn: 0 },
  forest:   { movementCost: 2,        defenseBonus: 0.1,  healPerTurn: 0 },
  mountain: { movementCost: 3,        defenseBonus: 0.2,  healPerTurn: 0 },
  water:    { movementCost: Infinity, defenseBonus: 0,    healPerTurn: 0 },
  wall:     { movementCost: Infinity, defenseBonus: 0.3,  healPerTurn: 0 },
  road:     { movementCost: 0.5,      defenseBonus: 0,    healPerTurn: 0 },
  castle:   { movementCost: 1,        defenseBonus: 0.25, healPerTurn: 0 },
  bridge:   { movementCost: 1,        defenseBonus: 0,    healPerTurn: 0 },
};

// ============================================================
// 方格邻居偏移（四方向）
// ============================================================

const GRID_DIRS: [number, number][] = [
  [0, -1], // 上
  [1, 0],  // 右
  [0, 1],  // 下
  [-1, 0], // 左
];

// ============================================================
// 六角邻居偏移（axial 坐标，六方向）
// ============================================================

const HEX_DIRS: [number, number][] = [
  [1, 0], [-1, 0],
  [0, 1], [0, -1],
  [1, -1], [-1, 1],
];

// ============================================================
// BattleMap 实现
// ============================================================

/**
 * 战斗地图 — 支持方格和六角两种模式
 *
 * @example
 * ```typescript
 * const map = new BattleMap({
 *   width: 10, height: 8,
 *   cells: Array.from({ length: 8 }, () => Array(10).fill('plain')),
 * }, 'grid');
 *
 * // 获取可移动范围
 * const range = map.getMovementRange(3, 3, 5);
 * // 寻路
 * const path = map.findPath(0, 0, 7, 5);
 * ```
 */
export class BattleMap {
  /** 地图宽度 */
  private width: number;
  /** 地图高度 */
  private height: number;
  /** 地图类型 */
  private mapType: 'grid' | 'hex';
  /** 格子二维数组，cells[y][x] */
  private cells: MapCell[][];
  /** 单位位置索引 unitId → `${x},${y}` */
  private unitPositions: Map<string, string>;

  // ============================================================
  // 静态方法
  // ============================================================

  /**
   * 获取地形属性
   *
   * @param terrain - 地形类型
   * @returns 地形属性
   */
  static getTerrainProps(terrain: MapCellType): TerrainProps {
    return TERRAIN_TABLE[terrain] ?? TERRAIN_TABLE.plain;
  }

  /**
   * 创建指定大小的方格地图（所有格子默认为 plain）
   *
   * @param width - 宽度
   * @param height - 高度
   * @returns BattleMap 实例
   */
  static createGrid(width: number, height: number): BattleMap {
    const cells: MapCellType[][] = [];
    for (let y = 0; y < height; y++) {
      cells.push(Array(width).fill('plain'));
    }
    return new BattleMap({ width, height, cells }, 'grid');
  }

  // ============================================================
  // 构造
  // ============================================================

  /**
   * 从地图定义创建战斗地图
   *
   * @param def - 地图定义
   * @param type - 地图类型：'grid' 方格 | 'hex' 六角
   */
  constructor(def: MapDef, type: 'grid' | 'hex') {
    this.width = Math.max(1, def.width);
    this.height = Math.max(1, def.height);
    this.mapType = type;
    this.cells = [];
    this.unitPositions = new Map();

    for (let y = 0; y < this.height; y++) {
      const row: MapCell[] = [];
      for (let x = 0; x < this.width; x++) {
        const cellType = def.cells[y]?.[x] ?? 'plain';
        const terrain = TERRAIN_TABLE[cellType] ?? TERRAIN_TABLE.plain;
        row.push({
          x,
          y,
          type: cellType,
          movementCost: terrain.movementCost,
          defenseBonus: terrain.defenseBonus,
          occupantId: null,
        });
      }
      this.cells[y] = row;
    }
  }

  // ============================================================
  // 格子查询
  // ============================================================

  /**
   * 获取格子（grid 模式，按 x/y 坐标）
   *
   * @param x - 列坐标
   * @param y - 行坐标
   * @returns 格子数据，越界返回 null
   */
  getCell(x: number, y: number): MapCell | null {
    if (!this.inBounds(x, y)) return null;
    return this.cells[y][x];
  }

  /**
   * 获取格子（hex 模式，按 axial 坐标 q/r）
   *
   * axial 坐标与内部存储的映射：x = q + floor(r/2), y = r
   *
   * @param q - 六角列坐标
   * @param r - 六角行坐标
   * @returns 六角格子数据，越界返回 null
   */
  getHexCell(q: number, r: number): HexCell | null {
    const x = this.hexToX(q, r);
    const y = r;
    const cell = this.getCell(x, y);
    if (!cell) return null;
    return { ...cell, q, r };
  }

  /**
   * 获取所有格子
   */
  getAllCells(): MapCell[] {
    const result: MapCell[] = [];
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        result.push(this.cells[y][x]);
      }
    }
    return result;
  }

  // ============================================================
  // 占据者管理
  // ============================================================

  /**
   * 设置格子占据者
   *
   * @param x - 列坐标
   * @param y - 行坐标
   * @param unitId - 单位 ID，null 表示清除
   * @returns 是否设置成功
   */
  setOccupant(x: number, y: number, unitId: string | null): boolean {
    if (!this.inBounds(x, y)) return false;
    this.cells[y][x].occupantId = unitId;
    return true;
  }

  /**
   * 获取格子占据者
   *
   * @param x - 列坐标
   * @param y - 行坐标
   * @returns 单位 ID，空或越界返回 null
   */
  getOccupant(x: number, y: number): string | null {
    const cell = this.getCell(x, y);
    return cell?.occupantId ?? null;
  }

  /**
   * 通过六角坐标设置占据者
   */
  setHexOccupant(q: number, r: number, unitId: string | null): boolean {
    const x = this.hexToX(q, r);
    return this.setOccupant(x, r, unitId);
  }

  /**
   * 通过六角坐标获取占据者
   */
  getHexOccupant(q: number, r: number): string | null {
    const x = this.hexToX(q, r);
    return this.getOccupant(x, r);
  }

  // ============================================================
  // 单位位置管理
  // ============================================================

  /**
   * 设置单位位置
   *
   * @param unitId - 单位 ID
   * @param x - 列坐标
   * @param y - 行坐标
   * @returns 是否设置成功
   */
  setUnitPosition(unitId: string, x: number, y: number): boolean {
    if (!this.inBounds(x, y)) return false;
    const cell = this.cells[y][x];
    // 不可通过的地形不能放置单位
    if (!isFinite(cell.movementCost)) return false;
    // 被其他单位占据的格子不能放置
    if (cell.occupantId !== null && cell.occupantId !== unitId) return false;

    // 清除旧位置
    const oldKey = this.unitPositions.get(unitId);
    if (oldKey) {
      const [ox, oy] = oldKey.split(',').map(Number);
      const oldCell = this.getCell(ox, oy);
      if (oldCell) oldCell.occupantId = null;
    }

    // 设置新位置
    cell.occupantId = unitId;
    this.unitPositions.set(unitId, `${x},${y}`);
    return true;
  }

  /**
   * 获取单位位置
   *
   * @param unitId - 单位 ID
   * @returns 坐标，不存在返回 null
   */
  getUnitPosition(unitId: string): Point | null {
    const key = this.unitPositions.get(unitId);
    if (!key) return null;
    const [x, y] = key.split(',').map(Number);
    return { x, y };
  }

  /**
   * 移除单位
   *
   * @param unitId - 单位 ID
   */
  removeUnit(unitId: string): void {
    const key = this.unitPositions.get(unitId);
    if (key) {
      const [x, y] = key.split(',').map(Number);
      const cell = this.getCell(x, y);
      if (cell) cell.occupantId = null;
      this.unitPositions.delete(unitId);
    }
  }

  // ============================================================
  // 移动范围（BFS）
  // ============================================================

  /**
   * 计算可移动范围
   *
   * 使用 BFS 遍历，考虑每个格子的 movementCost，
   * 不可通过的格子（water, wall）会被跳过。
   * 被其他单位占据的格子不可移入。
   *
   * @param startX - 起点列坐标
   * @param startY - 起点行坐标
   * @param maxMoves - 最大移动步数（按 movementCost 累加）
   * @returns 可到达的格子坐标列表（不含起点）
   */
  getMovementRange(startX: number, startY: number, maxMoves: number): Point[] {
    if (!this.inBounds(startX, startY)) return [];
    if (maxMoves <= 0) return [];

    const startCell = this.cells[startY][startX];
    if (!isFinite(startCell.movementCost)) return [];

    const key = (x: number, y: number) => (x << 16) | (y & 0xFFFF);
    const visited = new Map<number, number>(); // key -> 最小消耗
    visited.set(key(startX, startY), 0);

    // BFS 队列
    const queue: [number, number, number][] = [[startX, startY, 0]];
    let head = 0;

    while (head < queue.length) {
      const [cx, cy, cost] = queue[head++];
      const neighbors = this.getNeighbors(cx, cy);

      for (const [nx, ny] of neighbors) {
        if (!this.inBounds(nx, ny)) continue;

        const nextCell = this.cells[ny][nx];
        // 不可通过的地形
        if (!isFinite(nextCell.movementCost)) continue;

        const newCost = cost + nextCell.movementCost;
        // 超出移动力
        if (newCost > maxMoves) continue;

        const nk = key(nx, ny);
        const prevCost = visited.get(nk);
        // 已有更优路径
        if (prevCost !== undefined && prevCost <= newCost) continue;

        visited.set(nk, newCost);
        queue.push([nx, ny, newCost]);
      }
    }

    // 转换为坐标列表（排除起点，排除被占据的格子）
    const result: Point[] = [];
    for (const [k] of visited) {
      const x = k >> 16;
      const y = (k << 16) >> 16;
      if (x === startX && y === startY) continue;
      // 被占据的格子不可移入
      if (this.cells[y][x].occupantId === null) {
        result.push({ x, y });
      }
    }
    return result;
  }

  // ============================================================
  // 攻击范围
  // ============================================================

  /**
   * 计算攻击范围
   *
   * 返回距离起点在 range 以内的所有格子（不包含起点）。
   * 不考虑地形和占据者。
   *
   * @param startX - 起点列坐标
   * @param startY - 起点行坐标
   * @param range - 攻击范围（格数）
   * @returns 攻击范围内的格子坐标列表
   */
  getAttackRange(startX: number, startY: number, range: number): Point[] {
    if (!this.inBounds(startX, startY)) return [];
    if (range <= 0) return [];

    const result: Point[] = [];

    // 遍历地图所有格子，用距离公式筛选
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (x === startX && y === startY) continue;
        const dist = this.getDistance(startX, startY, x, y);
        if (dist <= range) {
          result.push({ x, y });
        }
      }
    }

    return result;
  }

  // ============================================================
  // 寻路（A*）
  // ============================================================

  /**
   * A* 寻路
   *
   * 寻找从 (fromX, fromY) 到 (toX, toY) 的最短路径。
   * 不可通过的格子（water, wall）会被跳过。
   * 考虑每个格子的 movementCost 作为路径权重。
   *
   * @param fromX - 起点列
   * @param fromY - 起点行
   * @param toX - 终点列
   * @param toY - 终点行
   * @returns 路径坐标数组（含起点和终点），不可达返回 null
   */
  findPath(fromX: number, fromY: number, toX: number, toY: number): Point[] | null {
    // 边界检查
    if (!this.inBounds(fromX, fromY) || !this.inBounds(toX, toY)) return null;

    // 起点终点相同
    if (fromX === toX && fromY === toY) return [{ x: fromX, y: fromY }];

    // 终点不可通过
    const targetCell = this.cells[toY][toX];
    if (!isFinite(targetCell.movementCost)) return null;

    const key = (x: number, y: number) => `${x},${y}`;

    // cameFrom[key] = parentKey
    const cameFrom = new Map<string, string>();
    // gScore[key] = 从起点到该格的最优代价
    const gScore = new Map<string, number>();
    // openSet 用数组 + 线性搜索（简单实现）
    const openKeys = new Set<string>();

    const startKey = key(fromX, fromY);
    gScore.set(startKey, 0);
    openKeys.add(startKey);

    while (openKeys.size > 0) {
      // 找 f = g + h 最小的节点
      let bestKey = '';
      let bestF = Infinity;
      for (const k of openKeys) {
        const g = gScore.get(k) ?? Infinity;
        const parts = k.split(',');
        const nx = parseInt(parts[0], 10);
        const ny = parseInt(parts[1], 10);
        const f = g + this.heuristic(nx, ny, toX, toY);
        if (f < bestF) {
          bestF = f;
          bestKey = k;
        }
      }

      openKeys.delete(bestKey);
      const parts = bestKey.split(',');
      const cx = parseInt(parts[0], 10);
      const cy = parseInt(parts[1], 10);

      // 到达终点
      if (cx === toX && cy === toY) {
        // 回溯路径
        const path: Point[] = [];
        let currentKey: string | undefined = bestKey;
        while (currentKey !== undefined) {
          const p = currentKey.split(',');
          path.unshift({ x: parseInt(p[0], 10), y: parseInt(p[1], 10) });
          currentKey = cameFrom.get(currentKey);
        }
        return path;
      }

      const currentG = gScore.get(bestKey) ?? Infinity;
      const neighbors = this.getNeighbors(cx, cy);

      for (const [nx, ny] of neighbors) {
        if (!this.inBounds(nx, ny)) continue;
        const nextCell = this.cells[ny][nx];
        // 不可通过（终点除外）
        if (!isFinite(nextCell.movementCost) && !(nx === toX && ny === toY)) continue;

        const nk = key(nx, ny);
        const tentativeG = currentG + nextCell.movementCost;
        const prevG = gScore.get(nk);

        if (prevG === undefined || tentativeG < prevG) {
          cameFrom.set(nk, bestKey);
          gScore.set(nk, tentativeG);
          openKeys.add(nk);
        }
      }
    }

    return null; // 不可达
  }

  // ============================================================
  // 距离计算
  // ============================================================

  /**
   * 计算两点之间的距离
   *
   * - grid 模式：曼哈顿距离 |x1-x2| + |y1-y2|
   * - hex 模式：六角距离 max(|q1-q2|, |r1-r2|, |(q1+r1)-(q2+r2)|)
   *
   * @param x1 - 起点列
   * @param y1 - 起点行
   * @param x2 - 终点列
   * @param y2 - 终点行
   * @returns 距离值
   */
  getDistance(x1: number, y1: number, x2: number, y2: number): number {
    if (this.mapType === 'hex') {
      // 六角距离（axial）
      return Math.max(
        Math.abs(x1 - x2),
        Math.abs(y1 - y2),
        Math.abs((x1 + y1) - (x2 + y2)),
      );
    }
    // 曼哈顿距离
    return Math.abs(x1 - x2) + Math.abs(y1 - y2);
  }

  // ============================================================
  // 访问器
  // ============================================================

  /** 获取地图宽度 */
  getWidth(): number {
    return this.width;
  }

  /** 获取地图高度 */
  getHeight(): number {
    return this.height;
  }

  /** 获取地图类型 */
  getType(): 'grid' | 'hex' {
    return this.mapType;
  }

  /**
   * 获取指定位置的防御加成
   *
   * @param x - 列坐标
   * @param y - 行坐标
   * @returns 防御加成比例，越界返回 0
   */
  getDefenseBonus(x: number, y: number): number {
    const cell = this.getCell(x, y);
    return cell?.defenseBonus ?? 0;
  }

  /**
   * 获取指定位置的移动消耗
   *
   * @param x - 列坐标
   * @param y - 行坐标
   * @returns 移动消耗，越界返回 Infinity
   */
  getMovementCost(x: number, y: number): number {
    const cell = this.getCell(x, y);
    return cell?.movementCost ?? Infinity;
  }

  // ============================================================
  // 重置
  // ============================================================

  /**
   * 清除所有占据者
   */
  reset(): void {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        this.cells[y][x].occupantId = null;
      }
    }
    this.unitPositions.clear();
  }

  // ============================================================
  // 私有方法
  // ============================================================

  /**
   * 检查坐标是否在地图范围内
   */
  private inBounds(x: number, y: number): boolean {
    return x >= 0 && x < this.width && y >= 0 && y < this.height;
  }

  /**
   * 获取邻居坐标列表
   *
   * grid 模式：四方向（上下左右）
   * hex 模式：六方向（axial 坐标）
   */
  private getNeighbors(x: number, y: number): [number, number][] {
    if (this.mapType === 'hex') {
      return HEX_DIRS.map(([dq, dr]) => {
        const nq = x + dq;
        const nr = y + dr;
        return [this.hexToX(nq, nr), nr] as [number, number];
      });
    }
    return GRID_DIRS.map(([dx, dy]) => [x + dx, y + dy] as [number, number]);
  }

  /**
   * 六角 axial 坐标转内部存储 x 坐标
   *
   * 使用 odd-r offset 布局：x = q + floor(r / 2)
   */
  private hexToX(q: number, r: number): number {
    return q + Math.floor(r / 2);
  }

  /**
   * A* 启发函数
   */
  private heuristic(x1: number, y1: number, x2: number, y2: number): number {
    return this.getDistance(x1, y1, x2, y2);
  }
}
