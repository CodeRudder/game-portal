/**
 * TileMap 引擎通用类型定义
 *
 * 本模块定义了 Tile 地图引擎的所有核心数据结构，
 * 可被任何放置类/策略类游戏复用，不依赖具体游戏逻辑。
 *
 * @module engine/tilemap/types
 */

// ---------------------------------------------------------------------------
// 地形（Terrain）
// ---------------------------------------------------------------------------

/** 地形类型枚举 */
export enum TerrainType {
  GRASS = 'grass',
  DIRT = 'dirt',
  WATER = 'water',
  MOUNTAIN = 'mountain',
  FOREST = 'forest',
  SAND = 'sand',
  SNOW = 'snow',
  ROAD = 'road',
  BRIDGE = 'bridge',
}

/** 地形属性定义，描述一种地形的所有静态属性 */
export interface TerrainDef {
  /** 地形类型标识 */
  type: TerrainType;
  /** 可读名称 */
  name: string;
  /** PixiJS 渲染颜色（无纹理时 fallback） */
  color: string;
  /** 是否可行走 */
  walkable: boolean;
  /** 是否可建造 */
  buildable: boolean;
  /** 移动消耗（1=普通, 2=困难, Infinity=不可通行） */
  movementCost: number;
  /** 纹理 key（可选，优先于 color 使用） */
  textureKey?: string;
}

// ---------------------------------------------------------------------------
// 瓦片（Tile）
// ---------------------------------------------------------------------------

/** 地图上的单个瓦片 */
export interface Tile {
  /** 格子列坐标（X） */
  x: number;
  /** 格子行坐标（Y） */
  y: number;
  /** 地形类型 */
  terrain: TerrainType;
  /** 海拔高度（0=平地, >0 高地, <0 低洼） */
  elevation: number;
  /** 变体编号（同地形不同外观，用于视觉多样性） */
  variant: number;
  /** 装饰物 key（如 'tree_oak', 'rock_gray'） */
  decoration?: string;
  /** 占用建筑实例 ID */
  buildingId?: string;
  /** 占用 NPC ID 列表 */
  npcIds?: string[];
}

// ---------------------------------------------------------------------------
// 建筑（Building）
// ---------------------------------------------------------------------------

/** 建筑定义（模板），描述一种建筑类型的静态属性 */
export interface BuildingDef {
  /** 建筑类型唯一 ID */
  id: string;
  /** 可读名称 */
  name: string;
  /** 建筑分类（farm/barracks/market/palace/tower/wall/house/temple 等） */
  type: string;
  /** 占地格数 */
  size: { w: number; h: number };
  /** 渲染颜色 */
  color: string;
  /** 图标 emoji */
  iconEmoji: string;
  /** 纹理 key（可选） */
  textureKey?: string;
  /** 是否可点击交互 */
  clickable: boolean;
  /** 功能描述 */
  description: string;
  /** 最大等级（可选） */
  levels?: number;
}

/** 建筑实例在地图上的状态 */
export type BuildingState = 'building' | 'active' | 'damaged' | 'destroyed';

/** 地图上放置的建筑实例 */
export interface PlacedBuilding {
  /** 实例唯一 ID */
  id: string;
  /** 对应 BuildingDef.id */
  defId: string;
  /** 左上角瓦片 X 坐标 */
  x: number;
  /** 左上角瓦片 Y 坐标 */
  y: number;
  /** 当前等级 */
  level: number;
  /** 当前状态 */
  state: BuildingState;
  /** 建造进度 0~1 */
  buildProgress: number;
  /** 所属势力（可选，用于多阵营游戏） */
  ownerFaction?: string;
}

// ---------------------------------------------------------------------------
// 装饰物（Decoration）
// ---------------------------------------------------------------------------

/** 地图装饰物 */
export interface MapDecoration {
  /** 装饰物唯一 ID */
  id: string;
  /** 装饰类型（tree/rock/flower/fence/lamp/well/bush 等） */
  type: string;
  /** 瓦片 X 坐标 */
  x: number;
  /** 瓦片 Y 坐标 */
  y: number;
  /** 纹理 key（可选） */
  textureKey?: string;
  /** 渲染颜色（可选） */
  color?: string;
}

// ---------------------------------------------------------------------------
// 地图数据（TileMapData）
// ---------------------------------------------------------------------------

/** 完整的地图数据结构 */
export interface TileMapData {
  /** 地图宽度（格数） */
  width: number;
  /** 地图高度（格数） */
  height: number;
  /** 每格像素大小（如 32, 48, 64） */
  tileSize: number;
  /** 瓦片二维数组，tiles[y][x] */
  tiles: Tile[][];
  /** 地图上所有建筑实例 */
  buildings: PlacedBuilding[];
  /** 地图上所有装饰物 */
  decorations: MapDecoration[];
}

// ---------------------------------------------------------------------------
// 视口（Viewport）
// ---------------------------------------------------------------------------

/** 地图视口，定义当前可见区域 */
export interface Viewport {
  /** 视口左上角世界 X 坐标 */
  x: number;
  /** 视口左上角世界 Y 坐标 */
  y: number;
  /** 视口宽度（像素） */
  width: number;
  /** 视口高度（像素） */
  height: number;
  /** 缩放倍率（0.5 ~ 3.0） */
  zoom: number;
}

// ---------------------------------------------------------------------------
// 事件（TileMapEvent）
// ---------------------------------------------------------------------------

/** 瓦片点击事件 */
export interface TileClickEvent {
  type: 'tileClick';
  tile: Tile;
  worldX: number;
  worldY: number;
}

/** 瓦片悬停事件 */
export interface TileHoverEvent {
  type: 'tileHover';
  tile: Tile | null;
  worldX: number;
  worldY: number;
}

/** 建筑点击事件 */
export interface BuildingClickEvent {
  type: 'buildingClick';
  building: PlacedBuilding;
}

/** 建筑悬停事件 */
export interface BuildingHoverEvent {
  type: 'buildingHover';
  building: PlacedBuilding | null;
}

/** 视口变化事件 */
export interface ViewportChangeEvent {
  type: 'viewportChange';
  viewport: Viewport;
}

/** 装饰物点击事件 */
export interface DecorationClickEvent {
  type: 'decorationClick';
  decoration: MapDecoration;
}

/** 地图事件联合类型 */
export type TileMapEvent =
  | TileClickEvent
  | TileHoverEvent
  | BuildingClickEvent
  | BuildingHoverEvent
  | ViewportChangeEvent
  | DecorationClickEvent;
