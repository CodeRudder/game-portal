/**
 * HexMap — 六角网格地图
 *
 * 使用 axial 坐标系 (q, r) 的六角网格地图，
 * 提供与 BattleMap 类似的功能但基于六角网格坐标。
 *
 * 六角网格特性：
 * - 6 个邻居方向：(1,0), (-1,0), (0,1), (0,-1), (1,-1), (-1,1)
 * - 距离公式：(abs(q1-q2) + abs(q1+r1-q2-r2) + abs(r1-r2)) / 2
 * - 支持 pointy-top 六角网格
 *
 * 设计原则：
 * - 零外部依赖，纯 TypeScript 实现
 * - 不继承 BattleMap（坐标系统完全不同）
 * - 共享 TerrainType 和 TerrainProps
 *
 * @module engines/idle/modules/battle/HexMap
 */

// ============================================================
// 类型定义
// ============================================================

/** 地形类型 */
export type TerrainType = 'plain' | 'forest' | 'mountain' | 'water' | 'wall' | 'road' | 'castle' | 'bridge' | 'desert';

/** 地形属性 */
export interface TerrainProps {
  /** 移动消耗 */
  moveCost: number;
  /** 防御加成比例 */
  defenseBonus: number;
  /** 是否可通过 */
  isPassable: boolean;
}

/** 寻路结果 */
export interface PathResult {
  /** 路径坐标列表 */
  path: { x: number; y: number }[];
  /** 总消耗 */
  totalCost: number;
  /** 是否可达 */
  reachable: boolean;
}

// ============================================================
// 地形属性表
// ============================================================

const TERRAIN_TABLE: Record<string, TerrainProps> = {
  plain:    { moveCost: 1,        defenseBonus: 0,    isPassable: true },
  forest:   { moveCost: 2,        defenseBonus: 0.2,  isPassable: true },
  mountain: { moveCost: Infinity, defenseBonus: 0.2,  isPassable: false },
  water:    { moveCost: Infinity, defenseBonus: 0,    isPassable: false },
  wall:     { moveCost: Infinity, defenseBonus: 0.3,  isPassable: false },
  road:     { moveCost: 0.5,      defenseBonus: 0,    isPassable: true },
  castle:   { moveCost: 1,        defenseBonus: 0.25, isPassable: true },
  bridge:   { moveCost: 1,        defenseBonus: 0,    isPassable: true },
  desert:   { moveCost: 1.5,      defenseBonus: 0,    isPassable: true },
};

/** 六角格单元格 */
export interface HexCell {
  /** axial 坐标 q（列方向） */
  q: number;
  /** axial 坐标 r（行方向） */
  r: number;
  /** 地形类型 */
  terrain: TerrainType;
  /** 占据此格的单位 ID（null 表示空） */
  unitId: string | null;
}

/** 六角地图定义 */
export interface HexMapDef {
  /** 地图半径（中心到边缘的格子数） */
  radius: number;
  /** 所有单元格 */
  cells: HexCell[];
  /** 地图名称 */
  name?: string;
}

// ============================================================
// 常量
// ============================================================

/** 六角网格 6 个邻居方向（axial 坐标系） */
const HEX_DIRECTIONS = [
  { dq: 1, dr: 0 },   // 右
  { dq: -1, dr: 0 },  // 左
  { dq: 0, dr: 1 },   // 右下
  { dq: 0, dr: -1 },  // 左上
  { dq: 1, dr: -1 },  // 右上
  { dq: -1, dr: 1 },  // 左下
];

/** 寻路节点 */
interface HexPathNode {
  q: number;
  r: number;
  g: number;
  h: number;
  f: number;
  parent: HexPathNode | null;
}

/**
 * 创建六角寻路节点
 */
function createHexPathNode(
  q: number, r: number,
  g: number, h: number,
  parent: HexPathNode | null,
): HexPathNode {
  return { q, r, g, h, f: g + h, parent };
}

// ============================================================
// HexMap 实现
// ============================================================

/**
 * 六角网格地图
 *
 * 使用 axial 坐标系 (q, r)。
 * 地图形状为正六边形，由半径参数控制大小。
 *
 * @example
 * ```typescript
 * const hexMap = HexMap.createHexGrid(4);
 * hexMap.setCell(1, 0, 'forest');
 * hexMap.setUnitPosition('hero', 0, 0);
 * const path = hexMap.findPath({ q: 0, r: 0 }, { q: 3, r: -1 });
 * ```
 */
export class HexMap {
  /** 地图半径 */
  private radius: number;
  /** 地图名称 */
  private name: string;
  /** 单元格存储（key: `${q},${r}`） */
  private cells: Map<string, HexCell>;
  /** 单位位置索引（unitId → `${q},${r}`） */
  private unitPositions: Map<string, string>;

  // ============================================================
  // 构造函数
  // ============================================================

  /**
   * 从地图定义创建六角网格地图
   *
   * @param def - 六角地图定义
   */
  constructor(def: HexMapDef) {
    this.radius = Math.max(0, Math.floor(def.radius));
    this.name = def.name ?? '';
    this.cells = new Map();
    this.unitPositions = new Map();

    // 初始化所有单元格
    for (const cell of def.cells) {
      const key = `${cell.q},${cell.r}`;
      this.cells.set(key, {
        q: cell.q,
        r: cell.r,
        terrain: cell.terrain,
        unitId: cell.unitId ?? null,
      });
      if (cell.unitId) {
        this.unitPositions.set(cell.unitId, key);
      }
    }
  }

  // ============================================================
  // 地图属性
  // ============================================================

  /** 获取地图半径 */
  getRadius(): number {
    return this.radius;
  }

  // ============================================================
  // 单元格操作
  // ============================================================

  /**
   * 获取指定坐标的六角格
   *
   * @param q - axial 坐标 q
   * @param r - axial 坐标 r
   * @returns 六角格，不存在时返回 null
   */
  getCell(q: number, r: number): HexCell | null {
    return this.cells.get(`${q},${r}`) ?? null;
  }

  /**
   * 设置指定坐标的地形类型
   *
   * @param q - axial 坐标 q
   * @param r - axial 坐标 r
   * @param terrain - 地形类型
   */
  setCell(q: number, r: number, terrain: TerrainType): void {
    const key = `${q},${r}`;
    const existing = this.cells.get(key);
    if (!existing) return;
    this.cells.set(key, {
      q,
      r,
      terrain,
      unitId: existing.unitId ?? null,
    });
  }

  // ============================================================
  // 单位位置管理
  // ============================================================

  /**
   * 获取单位所在位置
   *
   * @param unitId - 单位 ID
   * @returns axial 坐标，单位不存在时返回 null
   */
  getUnitPosition(unitId: string): { q: number; r: number } | null {
    const key = this.unitPositions.get(unitId);
    if (!key) return null;
    const [q, r] = key.split(',').map(Number);
    return { q, r };
  }

  /**
   * 设置单位位置
   *
   * @param unitId - 单位 ID
   * @param q - 目标 axial 坐标 q
   * @param r - 目标 axial 坐标 r
   * @returns 是否设置成功
   */
  setUnitPosition(unitId: string, q: number, r: number): boolean {
    const targetKey = `${q},${r}`;
    const targetCell = this.cells.get(targetKey);
    if (!targetCell) return false;

    // 检查目标格是否被其他单位占用
    if (targetCell.unitId !== null && targetCell.unitId !== unitId) {
      return false;
    }

    // 检查地形是否可通过
    const terrainProps = HexMap.getTerrainProps(targetCell.terrain);
    if (!terrainProps.isPassable) return false;

    // 从旧位置移除
    const oldKey = this.unitPositions.get(unitId);
    if (oldKey) {
      const oldCell = this.cells.get(oldKey);
      if (oldCell) {
        oldCell.unitId = null;
      }
    }

    // 设置新位置
    targetCell.unitId = unitId;
    this.unitPositions.set(unitId, targetKey);
    return true;
  }

  /**
   * 从地图上移除单位
   *
   * @param unitId - 单位 ID
   */
  removeUnit(unitId: string): void {
    const key = this.unitPositions.get(unitId);
    if (key) {
      const cell = this.cells.get(key);
      if (cell) {
        cell.unitId = null;
      }
      this.unitPositions.delete(unitId);
    }
  }

  // ============================================================
  // 地形属性
  // ============================================================

  /**
   * 获取地形属性
   *
   * @param terrain - 地形类型
   * @returns 地形属性
   */
  static getTerrainProps(terrain: TerrainType): TerrainProps {
    return TERRAIN_TABLE[terrain] ?? TERRAIN_TABLE.plain;
  }

  // ============================================================
  // 邻居与距离
  // ============================================================

  /**
   * 获取相邻六角格（6 个方向）
   *
   * @param q - axial 坐标 q
   * @param r - axial 坐标 r
   * @returns 相邻坐标列表（仅返回存在的格子）
   */
  getNeighbors(q: number, r: number): { q: number; r: number }[] {
    const neighbors: { q: number; r: number }[] = [];
    for (const { dq, dr } of HEX_DIRECTIONS) {
      const nq = q + dq;
      const nr = r + dr;
      if (this.cells.has(`${nq},${nr}`)) {
        neighbors.push({ q: nq, r: nr });
      }
    }
    return neighbors;
  }

  /**
   * 计算六角网格距离
   *
   * 公式：(abs(q1-q2) + abs(q1+r1-q2-r2) + abs(r1-r2)) / 2
   *
   * @param a - 坐标 A
   * @param b - 坐标 B
   * @returns 六角距离
   */
  hexDistance(
    a: { q: number; r: number },
    b: { q: number; r: number },
  ): number {
    return (
      Math.abs(a.q - b.q) +
      Math.abs(a.q + a.r - b.q - b.r) +
      Math.abs(a.r - b.r)
    ) / 2;
  }

  // ============================================================
  // A* 寻路
  // ============================================================

  /**
   * A* 寻路算法（六角网格版）
   *
   * @param from - 起点 axial 坐标
   * @param to - 终点 axial 坐标
   * @param maxCost - 最大允许移动消耗（可选）
   * @returns 寻路结果
   */
  findPath(
    from: { q: number; r: number },
    to: { q: number; r: number },
    maxCost?: number,
  ): PathResult {
    // 检查起点和终点是否存在
    if (!this.cells.has(`${from.q},${from.r}`) || !this.cells.has(`${to.q},${to.r}`)) {
      return { path: [], totalCost: Infinity, reachable: false };
    }

    // 起点等于终点
    if (from.q === to.q && from.r === to.r) {
      return { path: [{ x: from.q, y: from.r }], totalCost: 0, reachable: true };
    }

    // 检查终点是否可通过
    const toCell = this.cells.get(`${to.q},${to.r}`);
    if (toCell) {
      const toProps = HexMap.getTerrainProps(toCell.terrain);
      if (!toProps.isPassable) {
        return { path: [], totalCost: Infinity, reachable: false };
      }
    }

    // A* 算法
    const openSet: HexPathNode[] = [];
    const closedSet = new Set<string>();

    const startNode = createHexPathNode(
      from.q, from.r,
      0,
      this.hexDistance(from, to),
      null,
    );
    openSet.push(startNode);

    while (openSet.length > 0) {
      // 找到 f 值最小的节点
      let bestIdx = 0;
      for (let i = 1; i < openSet.length; i++) {
        if (openSet[i].f < openSet[bestIdx].f) {
          bestIdx = i;
        }
      }
      const current = openSet.splice(bestIdx, 1)[0];

      // 到达终点
      if (current.q === to.q && current.r === to.r) {
        const path = this.reconstructHexPath(current);
        const totalCost = current.g;

        if (maxCost !== undefined && totalCost > maxCost) {
          return { path, totalCost, reachable: false };
        }

        return { path, totalCost, reachable: true };
      }

      const currentKey = `${current.q},${current.r}`;
      closedSet.add(currentKey);

      // 遍历邻居
      const neighbors = this.getNeighbors(current.q, current.r);
      for (const neighbor of neighbors) {
        const neighborKey = `${neighbor.q},${neighbor.r}`;
        if (closedSet.has(neighborKey)) continue;

        const cell = this.cells.get(neighborKey);
        if (!cell) continue;

        const props = HexMap.getTerrainProps(cell.terrain);
        if (!props.isPassable) continue;

        // 跳过被其他单位占据的格子（终点除外）
        if (cell.unitId !== null && !(neighbor.q === to.q && neighbor.r === to.r)) {
          continue;
        }

        const moveCost = props.moveCost;
        if (!isFinite(moveCost)) continue;

        const g = current.g + moveCost;
        const h = this.hexDistance(neighbor, to);
        const f = g + h;

        const existingIdx = openSet.findIndex(
          (n) => n.q === neighbor.q && n.r === neighbor.r,
        );

        if (existingIdx === -1) {
          openSet.push(createHexPathNode(neighbor.q, neighbor.r, g, h, current));
        } else if (g < openSet[existingIdx].g) {
          openSet[existingIdx] = createHexPathNode(neighbor.q, neighbor.r, g, h, current);
        }
      }
    }

    return { path: [], totalCost: Infinity, reachable: false };
  }

  // ============================================================
  // 可达范围
  // ============================================================

  /**
   * 获取从指定位置出发、给定移动力内可达的所有六角格
   *
   * @param from - 起点 axial 坐标
   * @param maxMoveCost - 最大移动消耗（移动力）
   * @returns 可达六角格列表（含消耗）
   */
  getReachableHexes(
    from: { q: number; r: number },
    maxMoveCost: number,
  ): { q: number; r: number; cost: number }[] {
    if (!this.cells.has(`${from.q},${from.r}`)) return [];

    const result: { q: number; r: number; cost: number }[] = [];
    const visited = new Map<string, number>();
    const queue: { q: number; r: number; cost: number }[] = [];

    const startKey = `${from.q},${from.r}`;
    visited.set(startKey, 0);
    queue.push({ q: from.q, r: from.r, cost: 0 });

    while (queue.length > 0) {
      let bestIdx = 0;
      for (let i = 1; i < queue.length; i++) {
        if (queue[i].cost < queue[bestIdx].cost) {
          bestIdx = i;
        }
      }
      const current = queue.splice(bestIdx, 1)[0];

      result.push({ q: current.q, r: current.r, cost: current.cost });

      const neighbors = this.getNeighbors(current.q, current.r);
      for (const neighbor of neighbors) {
        const neighborKey = `${neighbor.q},${neighbor.r}`;
        const cell = this.cells.get(neighborKey);
        if (!cell) continue;

        const props = HexMap.getTerrainProps(cell.terrain);
        if (!props.isPassable) continue;

        // 被其他单位占据的格子不可通过
        if (cell.unitId !== null) continue;

        const moveCost = props.moveCost;
        if (!isFinite(moveCost)) continue;

        const newCost = current.cost + moveCost;
        if (newCost > maxMoveCost) continue;

        const prevCost = visited.get(neighborKey);
        if (prevCost === undefined || newCost < prevCost) {
          visited.set(neighborKey, newCost);
          queue.push({ q: neighbor.q, r: neighbor.r, cost: newCost });
        }
      }
    }

    return result;
  }

  // ============================================================
  // 攻击范围
  // ============================================================

  /**
   * 获取攻击范围内的所有六角格
   *
   * @param center - 中心 axial 坐标
   * @param minRange - 最小攻击范围
   * @param maxRange - 最大攻击范围
   * @returns 范围内的 axial 坐标列表
   */
  getAttackRange(
    center: { q: number; r: number },
    minRange: number,
    maxRange: number,
  ): { q: number; r: number }[] {
    const result: { q: number; r: number }[] = [];

    for (const cell of this.cells.values()) {
      const dist = this.hexDistance(center, { q: cell.q, r: cell.r });
      if (dist >= minRange && dist <= maxRange) {
        result.push({ q: cell.q, r: cell.r });
      }
    }

    return result;
  }

  // ============================================================
  // 坐标转换
  // ============================================================

  /**
   * 像素坐标转六角坐标（pointy-top）
   *
   * @param x - 像素 X 坐标
   * @param y - 像素 Y 坐标
   * @param hexSize - 六角格大小（中心到顶点距离）
   * @returns axial 坐标（四舍五入）
   */
  static pixelToHex(
    x: number,
    y: number,
    hexSize: number,
  ): { q: number; r: number } {
    const size = Math.max(1, hexSize);
    // pointy-top 六角网格转换公式
    const q = (Math.sqrt(3) / 3 * x - 1 / 3 * y) / size;
    const r = (2 / 3 * y) / size;
    return HexMap.axialRound(q, r);
  }

  /**
   * 六角坐标转像素坐标（pointy-top）
   *
   * @param q - axial 坐标 q
   * @param r - axial 坐标 r
   * @param hexSize - 六角格大小（中心到顶点距离）
   * @returns 像素坐标
   */
  static hexToPixel(
    q: number,
    r: number,
    hexSize: number,
  ): { x: number; y: number } {
    const size = Math.max(1, hexSize);
    // pointy-top 六角网格转换公式
    const x = size * (Math.sqrt(3) * q + (Math.sqrt(3) / 2) * r);
    const y = size * ((3 / 2) * r);
    return { x, y };
  }

  // ============================================================
  // 工厂方法
  // ============================================================

  /**
   * 创建正六边形网格地图（所有格子默认为平地）
   *
   * 生成以 (0,0) 为中心、指定半径的正六边形地图。
   * 总格子数 = 3 * radius * (radius + 1) + 1
   *
   * @param radius - 地图半径
   * @param defaultTerrain - 默认地形类型
   * @returns HexMap 实例
   */
  static createHexGrid(
    radius: number,
    defaultTerrain: TerrainType = 'plain',
  ): HexMap {
    const r = Math.max(0, Math.floor(radius));
    const cells: HexCell[] = [];

    for (let q = -r; q <= r; q++) {
      const r1 = Math.max(-r, -q - r);
      const r2 = Math.min(r, -q + r);
      for (let ri = r1; ri <= r2; ri++) {
        cells.push({ q, r: ri, terrain: defaultTerrain, unitId: null });
      }
    }

    return new HexMap({ radius: r, cells });
  }

  // ============================================================
  // 序列化
  // ============================================================

  /**
   * 获取地图定义（用于存档）
   *
   * @returns 六角地图定义
   */
  getState(): HexMapDef {
    const cells: HexCell[] = [];
    for (const cell of this.cells.values()) {
      cells.push({ ...cell });
    }
    return {
      radius: this.radius,
      cells,
      name: this.name,
    };
  }

  /**
   * 重置地图（清除所有单位位置）
   */
  reset(): void {
    for (const cell of this.cells.values()) {
      cell.unitId = null;
    }
    this.unitPositions.clear();
  }

  // ============================================================
  // 私有方法
  // ============================================================

  /**
   * 从终点回溯重建路径
   */
  private reconstructHexPath(endNode: HexPathNode): { x: number; y: number }[] {
    const path: { x: number; y: number }[] = [];
    let node: HexPathNode | null = endNode;
    while (node !== null) {
      path.unshift({ x: node.q, y: node.r });
      node = node.parent;
    }
    return path;
  }

  /**
   * axial 坐标四舍五入（cube round 转换）
   *
   * 将浮点 axial 坐标转换为最近的整数 axial 坐标。
   */
  private static axialRound(q: number, r: number): { q: number; r: number } {
    // 转换为 cube 坐标
    const cx = q;
    const cz = r;
    const cy = -q - r;

    // 四舍五入
    let rx = Math.round(cx);
    let ry = Math.round(cy);
    let rz = Math.round(cz);

    // 修正误差（确保 x + y + z = 0）
    const xDiff = Math.abs(rx - cx);
    const yDiff = Math.abs(ry - cy);
    const zDiff = Math.abs(rz - cz);

    if (xDiff > yDiff && xDiff > zDiff) {
      rx = -ry - rz;
    } else if (yDiff > zDiff) {
      ry = -rx - rz;
    } else {
      rz = -rx - ry;
    }

    return { q: rx, r: rz };
  }
}
