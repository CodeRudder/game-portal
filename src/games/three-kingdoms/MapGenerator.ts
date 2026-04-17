/**
 * 三国霸业 — Tile 瓦片地图生成器
 *
 * 生成 20×15 的瓦片地图数据，包含地形、领土归属、建筑和地标。
 * 地图分为三大区域：
 *   - 魏国（左上）：平原+城市，蓝色标记
 *   - 蜀国（左下）：山地+森林，绿色标记
 *   - 吴国（右侧）：水域+平原，红色标记
 *   - 中间区域：战场/道路/关卡
 *
 * 特殊地标：洛阳（中心）、长安（左）、建业（右下）
 *
 * @module games/three-kingdoms/MapGenerator
 */

// ═══════════════════════════════════════════════════════════════
// 类型定义
// ═══════════════════════════════════════════════════════════════

/** 地形类型 */
export type TerrainType =
  | 'plain'     // 平原
  | 'mountain'  // 山地
  | 'forest'    // 森林
  | 'water'     // 水域
  | 'road'      // 道路
  | 'city'      // 城市
  | 'village'   // 村庄
  | 'fortress'  // 关卡
  | 'desert'    // 荒漠
  | 'snow';     // 雪地

/** 地图瓦片 */
export interface MapTile {
  /** 瓦片 X 坐标（列索引） */
  x: number;
  /** 瓦片 Y 坐标（行索引） */
  y: number;
  /** 地形类型 */
  terrain: TerrainType;
  /** 所属领土 ID（对应 constants.ts 中的 TERRITORIES） */
  territoryId?: string;
  /** 建筑 ID */
  buildingId?: string;
  /** NPC ID */
  npcId?: string;
  /** 海拔等级（0=低地, 1=平地, 2=丘陵, 3=山峰） */
  elevation: number;
  /** 同地形的视觉变体索引（用于选择不同贴图） */
  variant: number;
}

/** NPC 定义 */
export interface MapNPC {
  /** 唯一 ID */
  id: string;
  /** 显示名称 */
  name: string;
  /** NPC 类型 */
  type: 'farmer' | 'soldier' | 'merchant' | 'scholar' | 'scout';
  /** 当前所在瓦片 X */
  tileX: number;
  /** 当前所在瓦片 Y */
  tileY: number;
  /** 当前活动 */
  activity: 'farming' | 'patrolling' | 'trading' | 'studying' | 'scouting';
  /** 活动时间表（小时 → 目标瓦片） */
  schedule: { hour: number; targetX: number; targetY: number }[];
}

/** 地标定义 */
export interface MapLandmark {
  /** 地标 X 瓦片坐标 */
  x: number;
  /** 地标 Y 瓦片坐标 */
  y: number;
  /** 地标名称 */
  name: string;
  /** 地标类型 */
  type: 'capital' | 'city' | 'fortress' | 'bridge';
}

/** 资源点类型 */
export type ResourcePointType = 'farm' | 'mine' | 'lumber' | 'fishery' | 'stable';

/** 资源点定义 */
export interface MapResourcePoint {
  /** 资源点 X 瓦片坐标 */
  x: number;
  /** 资源点 Y 瓦片坐标 */
  y: number;
  /** 资源点类型 */
  type: ResourcePointType;
  /** 资源点名称 */
  name: string;
  /** 所属领土 ID */
  territoryId?: string;
}

/** 完整地图数据 */
export interface GameMap {
  /** 地图宽度（瓦片数） */
  width: number;
  /** 地图高度（瓦片数） */
  height: number;
  /** 单个瓦片像素尺寸 */
  tileSize: number;
  /** 二维瓦片数组 [row][col] */
  tiles: MapTile[][];
  /** NPC 列表 */
  npcs: MapNPC[];
  /** 地标列表 */
  landmarks: MapLandmark[];
  /** 资源点列表 */
  resourcePoints: MapResourcePoint[];
}

// ═══════════════════════════════════════════════════════════════
// 区域定义（用于程序化生成）
// ═══════════════════════════════════════════════════════════════

/** 区域范围 */
interface Zone {
  x1: number; y1: number;
  x2: number; y2: number;
}

/** 领土→瓦片坐标映射（手动标注核心领土位置） */
interface TerritoryPlacement {
  id: string;
  x: number;
  y: number;
  terrain: TerrainType;
  isCity: boolean;
}

// ═══════════════════════════════════════════════════════════════
// 常量
// ═══════════════════════════════════════════════════════════════

const MAP_W = 20;
const MAP_H = 15;
const TILE_SIZE = 64;

/** 魏国区域（左上） */
const WEI_ZONE: Zone = { x1: 0, y1: 0, x2: 11, y2: 6 };
/** 蜀国区域（左下） */
const SHU_ZONE: Zone = { x1: 0, y1: 8, x2: 10, y2: 14 };
/** 吴国区域（右侧） */
const WU_ZONE: Zone = { x1: 13, y1: 5, x2: 19, y2: 14 };
/** 中间战场区域 */
const CENTER_ZONE: Zone = { x1: 8, y1: 5, x2: 14, y2: 9 };

/** 领土放置表：将 constants.ts 中的领土映射到瓦片坐标 */
const TERRITORY_PLACEMENTS: TerritoryPlacement[] = [
  // ── 魏国区域 ──
  { id: 'beiping',   x: 3,  y: 1,  terrain: 'mountain', isCity: true },
  { id: 'ye',        x: 5,  y: 3,  terrain: 'mountain', isCity: true },
  { id: 'xuchang',   x: 8,  y: 4,  terrain: 'plain',    isCity: true },
  // ── 中间区域 ──
  { id: 'changan',   x: 6,  y: 6,  terrain: 'plain',    isCity: true },
  { id: 'luoyang',   x: 10, y: 7,  terrain: 'city',     isCity: true },
  { id: 'jingzhou',  x: 9,  y: 9,  terrain: 'plain',    isCity: true },
  { id: 'xiangyang', x: 11, y: 6,  terrain: 'mountain', isCity: true },
  // ── 蜀国区域 ──
  { id: 'hanzhong',  x: 4,  y: 8,  terrain: 'mountain', isCity: true },
  { id: 'chengdu',   x: 3,  y: 11, terrain: 'plain',    isCity: true },
  { id: 'nanzhong',  x: 2,  y: 13, terrain: 'plain',    isCity: true },
  // ── 吴国区域 ──
  { id: 'jianye',    x: 16, y: 10, terrain: 'city',     isCity: true },
  { id: 'hefei',     x: 14, y: 7,  terrain: 'plain',    isCity: true },
  { id: 'chaisang',  x: 15, y: 8,  terrain: 'forest',   isCity: true },
  { id: 'jiangling', x: 13, y: 9,  terrain: 'plain',    isCity: true },
  { id: 'yiling',    x: 12, y: 8,  terrain: 'forest',   isCity: true },
];

/** 河流水域坐标（长江从西到东横贯南部，黄河在北方） */
const RIVER_TILES: [number, number][] = [
  // 黄河（北方，从左到右）
  [0, 4], [1, 4], [2, 4], [3, 5], [4, 5], [5, 5], [6, 5], [7, 5],
  [8, 5], [9, 5], [10, 5], [11, 5],
  // 长江（中南部，从西到东）
  [0, 10], [1, 10], [2, 10], [3, 10], [4, 9], [5, 9],
  [6, 9], [7, 9], [8, 9], [9, 10], [10, 10],
  [11, 10], [12, 10], [13, 10], [14, 9], [15, 9],
  [16, 9], [17, 10], [18, 10], [19, 10],
  // 洞庭湖/鄱阳湖区域
  [14, 8], [15, 7], [16, 7], [17, 8],
];

/** 主要道路（连接各城市） */
const ROAD_TILES: [number, number][] = [
  // 长安 → 洛阳
  [7, 6], [8, 6], [9, 7],
  // 洛阳 → 许昌
  [9, 5], [9, 4],
  // 洛阳 → 襄阳
  [10, 6], [11, 7],
  // 许昌 → 邺城
  [7, 3], [6, 3],
  // 邺城 → 北平
  [4, 2], [3, 2],
  // 汉中 → 长安
  [5, 7], [5, 6],
  // 成都 → 汉中
  [3, 10], [3, 9],
  // 荆州 → 江陵
  [10, 9], [11, 9], [12, 9],
  // 江陵 → 夷陵
  [12, 8],
  // 夷陵 → 柴桑
  [13, 8], [14, 8],
  // 柴桑 → 建业
  [15, 9], [16, 9], [16, 10],
  // 合肥 → 柴桑
  [14, 7], [14, 8],
];

// ═══════════════════════════════════════════════════════════════
// 简易伪随机数生成器（确保可重复）
// ═══════════════════════════════════════════════════════════════

/** 线性同余伪随机数生成器 */
class SeededRNG {
  private state: number;

  constructor(seed: number) {
    this.state = seed;
  }

  /** 返回 [0, 1) 区间的浮点数 */
  next(): number {
    this.state = (this.state * 1664525 + 1013904223) & 0x7fffffff;
    return this.state / 0x7fffffff;
  }

  /** 返回 [min, max] 区间的整数 */
  nextInt(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }
}

// ═══════════════════════════════════════════════════════════════
// 地图生成器
// ═══════════════════════════════════════════════════════════════

/**
 * 三国瓦片地图生成器
 *
 * 程序化生成 20×15 的瓦片地图，包含：
 * - 三大阵营区域的地形分布
 * - 河流水域系统
 * - 道路网络
 * - 城市/村庄/关卡
 * - NPC 放置
 * - 地标标注
 *
 * 使用固定种子的伪随机数，确保每次生成结果一致。
 */
export class MapGenerator {
  private rng: SeededRNG;
  private tiles: MapTile[][];
  private npcs: MapNPC[];
  private landmarks: MapLandmark[];
  private resourcePoints: MapResourcePoint[];

  /** 水域坐标集合（用于快速查找） */
  private waterSet: Set<string>;
  /** 道路坐标集合 */
  private roadSet: Set<string>;
  /** 领土坐标映射（territoryId → {x, y}） */
  private territoryMap: Map<string, { x: number; y: number }>;

  constructor(seed: number = 42) {
    this.rng = new SeededRNG(seed);
    this.tiles = [];
    this.npcs = [];
    this.landmarks = [];
    this.resourcePoints = [];
    this.waterSet = new Set(RIVER_TILES.map(([x, y]) => `${x},${y}`));
    this.roadSet = new Set(ROAD_TILES.map(([x, y]) => `${x},${y}`));
    this.territoryMap = new Map(
      TERRITORY_PLACEMENTS.map(p => [p.id, { x: p.x, y: p.y }]),
    );
  }

  // ─── 公共接口 ───────────────────────────────────────────

  /**
   * 生成完整的地图数据
   *
   * @returns 包含所有瓦片、NPC、地标的 GameMap 对象
   */
  generate(): GameMap {
    // 1. 生成基础地形
    const terrain = this.generateTerrain();

    // 2. 构建瓦片数据
    this.buildTiles(terrain);

    // 3. 放置领土归属
    this.placeTerritories();

    // 4. 放置建筑
    this.placeBuildings();

    // 5. 生成 NPC
    this.npcs = this.generateNPCs();

    // 6. 添加地标
    this.addLandmarks();

    // 7. 生成资源点
    this.resourcePoints = this.generateResourcePoints();

    return {
      width: MAP_W,
      height: MAP_H,
      tileSize: TILE_SIZE,
      tiles: this.tiles,
      npcs: this.npcs,
      landmarks: this.landmarks,
      resourcePoints: this.resourcePoints,
    };
  }

  // ─── 地形生成 ───────────────────────────────────────────

  /**
   * 生成基础地形网格
   *
   * 根据区域定义分配地形类型：
   * - 魏国：平原为主，少量山地
   * - 蜀国：山地+森林为主
   * - 吴国：水域+平原混合
   * - 中间：混合地形+关卡
   */
  private generateTerrain(): TerrainType[][] {
    const grid: TerrainType[][] = [];

    for (let y = 0; y < MAP_H; y++) {
      grid[y] = [];
      for (let x = 0; x < MAP_W; x++) {
        grid[y][x] = this.pickTerrain(x, y);
      }
    }

    // 覆盖水域
    for (const [x, y] of RIVER_TILES) {
      if (y >= 0 && y < MAP_H && x >= 0 && x < MAP_W) {
        grid[y][x] = 'water';
      }
    }

    // 覆盖道路（仅覆盖非水域瓦片）
    for (const [x, y] of ROAD_TILES) {
      if (y >= 0 && y < MAP_H && x >= 0 && x < MAP_W && grid[y][x] !== 'water') {
        grid[y][x] = 'road';
      }
    }

    // 覆盖领土核心位置为城市/山地
    for (const tp of TERRITORY_PLACEMENTS) {
      if (tp.y >= 0 && tp.y < MAP_H && tp.x >= 0 && tp.x < MAP_W) {
        grid[tp.y][tp.x] = tp.isCity ? 'city' : tp.terrain;
      }
    }

    return grid;
  }

  /**
   * 根据坐标选择地形类型
   *
   * 使用区域判定 + 伪随机变体来分配地形。
   */
  private pickTerrain(x: number, y: number): TerrainType {
    const r = this.rng.next();

    // 地图边缘（顶行和底行）→ 雪地（北方/南方天然屏障）
    if (y === 0) {
      if (r < 0.50) return 'snow';
      if (r < 0.80) return 'mountain';
      return 'plain';
    }
    if (y === MAP_H - 1) {
      if (r < 0.40) return 'snow';
      if (r < 0.70) return 'mountain';
      return 'plain';
    }
    // 左右边缘 → 山地 + 荒漠天然屏障
    if (x === 0 || x === MAP_W - 1) {
      if (r < 0.35) return 'mountain';
      if (r < 0.55) return 'desert';
      if (r < 0.80) return 'forest';
      return 'plain';
    }
    // 第二行/倒数第二行 → 少量雪地/山地过渡
    if (y === 1 || y === MAP_H - 2) {
      if (r < 0.15) return 'snow';
      if (r < 0.35) return 'mountain';
    }

    // 魏国区域：平原为主
    if (this.inZone(x, y, WEI_ZONE)) {
      if (r < 0.50) return 'plain';
      if (r < 0.70) return 'forest';
      if (r < 0.88) return 'mountain';
      if (r < 0.95) return 'village';
      return 'desert';
    }

    // 蜀国区域：山地+森林
    if (this.inZone(x, y, SHU_ZONE)) {
      if (r < 0.25) return 'plain';
      if (r < 0.50) return 'forest';
      if (r < 0.78) return 'mountain';
      if (r < 0.90) return 'village';
      return 'desert';
    }

    // 吴国区域：水域+平原
    if (this.inZone(x, y, WU_ZONE)) {
      if (r < 0.35) return 'plain';
      if (r < 0.55) return 'water';
      if (r < 0.75) return 'forest';
      if (r < 0.90) return 'village';
      return 'desert';
    }

    // 中间战场区域
    if (this.inZone(x, y, CENTER_ZONE)) {
      if (r < 0.20) return 'plain';
      if (r < 0.40) return 'road';
      if (r < 0.60) return 'mountain';
      if (r < 0.78) return 'forest';
      if (r < 0.90) return 'fortress';
      return 'desert';
    }

    // 默认（边界过渡区域）
    if (r < 0.40) return 'plain';
    if (r < 0.65) return 'forest';
    if (r < 0.85) return 'mountain';
    return 'desert';
  }

  // ─── 瓦片构建 ───────────────────────────────────────────

  /**
   * 将地形网格转换为瓦片数据
   *
   * 根据地形类型计算海拔和变体。
   */
  private buildTiles(terrain: TerrainType[][]): void {
    this.tiles = [];

    for (let y = 0; y < MAP_H; y++) {
      this.tiles[y] = [];
      for (let x = 0; x < MAP_W; x++) {
        const t = terrain[y][x];
        this.tiles[y][x] = {
          x,
          y,
          terrain: t,
          elevation: this.calcElevation(t),
          variant: this.rng.nextInt(0, 3),
        };
      }
    }
  }

  /**
   * 根据地形类型计算海拔
   */
  private calcElevation(terrain: TerrainType): number {
    switch (terrain) {
      case 'water':   return 0;
      case 'plain':   return 1;
      case 'road':    return 1;
      case 'village': return 1;
      case 'forest':  return 2;
      case 'city':    return 1;
      case 'fortress':return 2;
      case 'mountain':return 3;
      case 'desert':  return 1;
      case 'snow':    return 2;
      default:        return 1;
    }
  }

  // ─── 领土放置 ───────────────────────────────────────────

  /**
   * 为瓦片分配领土归属
   *
   * 每个城市瓦片标记为核心领土，周围瓦片根据距离分配归属。
   */
  private placeTerritories(): void {
    for (const tp of TERRITORY_PLACEMENTS) {
      // 核心瓦片
      if (this.isValid(tp.x, tp.y)) {
        this.tiles[tp.y][tp.x].territoryId = tp.id;
      }

      // 周围瓦片（曼哈顿距离 ≤ 2）归属同一领土
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          if (Math.abs(dx) + Math.abs(dy) > 2) continue;
          const nx = tp.x + dx;
          const ny = tp.y + dy;
          if (!this.isValid(nx, ny)) continue;
          const tile = this.tiles[ny][nx];
          // 不覆盖水域和已有归属的城市
          if (tile.terrain !== 'water' && tile.terrain !== 'city' && !tile.territoryId) {
            tile.territoryId = tp.id;
          }
        }
      }
    }
  }

  // ─── 建筑放置 ───────────────────────────────────────────

  /**
   * 在城市和村庄瓦片上放置建筑
   *
   * 城市瓦片放置主要建筑（兵营、市集等），村庄放置农田。
   */
  private placeBuildings(): void {
    const cityBuildings = ['barracks', 'market', 'academy', 'smithy'];
    const villageBuildings = ['farm', 'clinic'];

    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        const tile = this.tiles[y][x];
        if (tile.terrain === 'city' && tile.territoryId) {
          // 城市放置主要建筑（轮流分配）
          const idx = this.rng.nextInt(0, cityBuildings.length - 1);
          tile.buildingId = cityBuildings[idx];
        } else if (tile.terrain === 'village') {
          // 村庄放置农田或医馆
          const idx = this.rng.nextInt(0, villageBuildings.length - 1);
          tile.buildingId = villageBuildings[idx];
        } else if (tile.terrain === 'fortress') {
          // 关卡放置城墙
          tile.buildingId = 'wall';
        }
      }
    }
  }

  // ─── NPC 生成 ───────────────────────────────────────────

  /**
   * 生成地图上的 NPC
   *
   * 根据地形和领土类型放置不同类型的 NPC：
   * - 农民：在村庄/平原附近耕作
   * - 士兵：在城池/关卡附近巡逻
   * - 商人：在城镇间移动
   * - 学者：在书院/城市附近活动
   * - 斥候：在边境探索
   */
  private generateNPCs(): MapNPC[] {
    const npcs: MapNPC[] = [];
    let npcCounter = 0;

    // 收集各类型瓦片坐标
    const cities: [number, number][] = [];
    const villages: [number, number][] = [];
    const fortresses: [number, number][] = [];
    const plains: [number, number][] = [];

    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        const t = this.tiles[y][x].terrain;
        if (t === 'city') cities.push([x, y]);
        else if (t === 'village') villages.push([x, y]);
        else if (t === 'fortress') fortresses.push([x, y]);
        else if (t === 'plain') plains.push([x, y]);
      }
    }

    // 农民：在村庄附近
    for (let i = 0; i < Math.min(4, villages.length); i++) {
      const [vx, vy] = villages[i % villages.length];
      const nearby = this.findNearbyWalkable(vx, vy, 2);
      npcs.push({
        id: `npc_farmer_${++npcCounter}`,
        name: `农夫${npcCounter}`,
        type: 'farmer',
        tileX: nearby.x,
        tileY: nearby.y,
        activity: 'farming',
        schedule: [
          { hour: 6, targetX: vx, targetY: vy },
          { hour: 12, targetX: nearby.x, targetY: nearby.y },
          { hour: 18, targetX: vx, targetY: vy },
        ],
      });
    }

    // 士兵：在城池和关卡附近巡逻
    const patrolPoints = [...cities, ...fortresses];
    for (let i = 0; i < Math.min(6, patrolPoints.length); i++) {
      const [px, py] = patrolPoints[i % patrolPoints.length];
      const p1 = this.findNearbyWalkable(px, py, 1);
      const p2 = this.findNearbyWalkable(px, py, 3);
      npcs.push({
        id: `npc_soldier_${++npcCounter}`,
        name: `守卫${npcCounter}`,
        type: 'soldier',
        tileX: p1.x,
        tileY: p1.y,
        activity: 'patrolling',
        schedule: [
          { hour: 0, targetX: p1.x, targetY: p1.y },
          { hour: 6, targetX: p2.x, targetY: p2.y },
          { hour: 12, targetX: px, targetY: py },
          { hour: 18, targetX: p2.x, targetY: p2.y },
        ],
      });
    }

    // 商人：在城镇间移动
    if (cities.length >= 2) {
      for (let i = 0; i < 3; i++) {
        const from = cities[i % cities.length];
        const to = cities[(i + 1) % cities.length];
        npcs.push({
          id: `npc_merchant_${++npcCounter}`,
          name: `商人${npcCounter}`,
          type: 'merchant',
          tileX: from[0],
          tileY: from[1],
          activity: 'trading',
          schedule: [
            { hour: 8, targetX: from[0], targetY: from[1] },
            { hour: 12, targetX: to[0], targetY: to[1] },
            { hour: 18, targetX: from[0], targetY: from[1] },
          ],
        });
      }
    }

    // 学者：在城市附近活动
    for (let i = 0; i < Math.min(2, cities.length); i++) {
      const [cx, cy] = cities[i];
      const nearby = this.findNearbyWalkable(cx, cy, 1);
      npcs.push({
        id: `npc_scholar_${++npcCounter}`,
        name: `书生${npcCounter}`,
        type: 'scholar',
        tileX: nearby.x,
        tileY: nearby.y,
        activity: 'studying',
        schedule: [
          { hour: 8, targetX: cx, targetY: cy },
          { hour: 14, targetX: nearby.x, targetY: nearby.y },
          { hour: 20, targetX: cx, targetY: cy },
        ],
      });
    }

    // 斥候：在边境（领土交界处）探索
    const borderTiles = this.findBorderTiles();
    for (let i = 0; i < Math.min(3, borderTiles.length); i++) {
      const [bx, by] = borderTiles[i];
      const nearby = this.findNearbyWalkable(bx, by, 2);
      npcs.push({
        id: `npc_scout_${++npcCounter}`,
        name: `斥候${npcCounter}`,
        type: 'scout',
        tileX: bx,
        tileY: by,
        activity: 'scouting',
        schedule: [
          { hour: 6, targetX: bx, targetY: by },
          { hour: 10, targetX: nearby.x, targetY: nearby.y },
          { hour: 14, targetX: bx, targetY: by },
          { hour: 20, targetX: nearby.x, targetY: nearby.y },
        ],
      });
    }

    return npcs;
  }

  // ─── 地标 ───────────────────────────────────────────────

  /**
   * 添加特殊地标
   *
   * 洛阳（中心）、长安（左）、建业（右下）等主要城市作为地标高亮。
   */
  private addLandmarks(): void {
    this.landmarks = [
      { x: 10, y: 7,  name: '洛阳', type: 'capital' },
      { x: 6,  y: 6,  name: '长安', type: 'city' },
      { x: 16, y: 10, name: '建业', type: 'city' },
      { x: 5,  y: 3,  name: '邺城', type: 'city' },
      { x: 3,  y: 11, name: '成都', type: 'city' },
      { x: 8,  y: 4,  name: '许昌', type: 'city' },
      { x: 11, y: 6,  name: '襄阳', type: 'fortress' },
      { x: 4,  y: 8,  name: '汉中', type: 'fortress' },
    ];
  }

  // ─── 资源点生成 ────────────────────────────────────────

  /**
   * 在地图上生成资源点
   *
   * 根据地形类型放置不同资源：
   * - 农田(farm)：平原区域，绿色方块
   * - 矿场(mine)：山地附近，棕色三角
   * - 伐木场(lumber)：森林区域，深绿菱形
   * - 渔场(fishery)：水域附近，蓝色波浪
   * - 牧场(stable)：平原开阔区域，橙色圆形
   */
  private generateResourcePoints(): MapResourcePoint[] {
    const points: MapResourcePoint[] = [];

    // 手动放置关键资源点（确保位置合理且不重叠）
    const manualPoints: Array<{ x: number; y: number; type: ResourcePointType; name: string; territoryId: string }> = [
      // 魏国区域 — 农田、牧场
      { x: 2, y: 2, type: 'farm', name: '许田', territoryId: 'beiping' },
      { x: 4, y: 1, type: 'stable', name: '幽州牧场', territoryId: 'beiping' },
      { x: 7, y: 3, type: 'farm', name: '邺郊农庄', territoryId: 'ye' },
      { x: 9, y: 3, type: 'mine', name: '许昌铁矿', territoryId: 'xuchang' },
      // 中间区域 — 伐木、矿场
      { x: 7, y: 7, type: 'lumber', name: '终南山林场', territoryId: 'changan' },
      { x: 11, y: 7, type: 'mine', name: '襄阳铜矿', territoryId: 'xiangyang' },
      // 蜀国区域 — 伐木、农田
      { x: 1, y: 9, type: 'lumber', name: '剑阁林场', territoryId: 'hanzhong' },
      { x: 4, y: 10, type: 'farm', name: '成都平原', territoryId: 'chengdu' },
      { x: 1, y: 12, type: 'mine', name: '南中银矿', territoryId: 'nanzhong' },
      // 吴国区域 — 渔场、农田
      { x: 17, y: 9, type: 'fishery', name: '建业渔港', territoryId: 'jianye' },
      { x: 15, y: 10, type: 'farm', name: '柴桑稻田', territoryId: 'chaisang' },
      { x: 14, y: 6, type: 'stable', name: '合肥马场', territoryId: 'hefei' },
    ];

    for (const mp of manualPoints) {
      // 确保坐标有效且不在水域上
      if (this.isValid(mp.x, mp.y) && !this.waterSet.has(`${mp.x},${mp.y}`)) {
        points.push({
          x: mp.x,
          y: mp.y,
          type: mp.type,
          name: mp.name,
          territoryId: mp.territoryId,
        });
      }
    }

    return points;
  }

  // ─── 工具方法 ───────────────────────────────────────────

  /** 检查坐标是否在区域内 */
  private inZone(x: number, y: number, z: Zone): boolean {
    return x >= z.x1 && x <= z.x2 && y >= z.y1 && y <= z.y2;
  }

  /** 检查坐标是否有效 */
  private isValid(x: number, y: number): boolean {
    return x >= 0 && x < MAP_W && y >= 0 && y < MAP_H;
  }

  /**
   * 在指定位置附近寻找可通行的瓦片
   *
   * @param cx - 中心 X
   * @param cy - 中心 Y
   * @param radius - 搜索半径
   * @returns 可通行瓦片坐标
   */
  private findNearbyWalkable(cx: number, cy: number, radius: number): { x: number; y: number } {
    for (let d = 1; d <= radius; d++) {
      for (let dy = -d; dy <= d; dy++) {
        for (let dx = -d; dx <= d; dx++) {
          if (Math.abs(dx) + Math.abs(dy) > d) continue;
          const nx = cx + dx;
          const ny = cy + dy;
          if (this.isValid(nx, ny) && this.tiles[ny]?.[nx]?.terrain !== 'water') {
            return { x: nx, y: ny };
          }
        }
      }
    }
    return { x: cx, y: cy };
  }

  /**
   * 查找边境瓦片（不同领土交界的可通行瓦片）
   *
   * @returns 边境瓦片坐标数组
   */
  private findBorderTiles(): [number, number][] {
    const borders: [number, number][] = [];
    const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];

    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        const tile = this.tiles[y][x];
        if (tile.terrain === 'water' || !tile.territoryId) continue;

        for (const [ddx, ddy] of dirs) {
          const nx = x + ddx;
          const ny = y + ddy;
          if (!this.isValid(nx, ny)) continue;
          const neighbor = this.tiles[ny][nx];
          if (neighbor.territoryId && neighbor.territoryId !== tile.territoryId) {
            borders.push([x, y]);
            break;
          }
        }
      }
    }

    return borders;
  }
}
