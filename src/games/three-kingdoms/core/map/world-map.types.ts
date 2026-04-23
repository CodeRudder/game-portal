/**
 * 核心层 — 世界地图类型定义
 *
 * 定义世界地图系统的所有核心类型，供 Engine 层和 UI 层使用。
 * 零 engine/ 依赖，所有类型在本文件中定义。
 *
 * @module core/map/world-map.types
 */

// ─────────────────────────────────────────────
// 1. 地图基础参数
// ─────────────────────────────────────────────

/** 地图格子坐标 */
export interface GridPosition {
  /** 列坐标（0-indexed） */
  x: number;
  /** 行坐标（0-indexed） */
  y: number;
}

/** 地图尺寸配置 */
export interface MapSize {
  /** 列数 */
  cols: number;
  /** 行数 */
  rows: number;
}

/** 格子系统配置 */
export interface GridConfig {
  /** 单格宽度（px） */
  tileWidth: number;
  /** 单格高度（px） */
  tileHeight: number;
}

/** 视口配置 */
export interface ViewportConfig {
  /** 视口宽度（px） */
  width: number;
  /** 视口高度（px） */
  height: number;
  /** 最小缩放 */
  minZoom: number;
  /** 最大缩放 */
  maxZoom: number;
  /** 默认缩放 */
  defaultZoom: number;
}

/** 视口运行时状态 */
export interface ViewportState {
  /** 当前 X 偏移（px） */
  offsetX: number;
  /** 当前 Y 偏移（px） */
  offsetY: number;
  /** 当前缩放 */
  zoom: number;
}

// ─────────────────────────────────────────────
// 2. 区域划分
// ─────────────────────────────────────────────

/** 四大区域标识（⚠️ PRD MAP-1: 魏/蜀/吴+中立） */
export type RegionId = 'wei' | 'shu' | 'wu' | 'neutral';

/** 区域定义 */
export interface RegionDef {
  /** 区域唯一标识 */
  id: RegionId;
  /** 区域中文名 */
  label: string;
  /** 区域描述 */
  description: string;
  /** 区域颜色（十六进制） */
  color: string;
  /** 区域边界（格子坐标范围） */
  bounds: RegionBounds;
}

/** 区域边界（格子坐标范围） */
export interface RegionBounds {
  /** 起始列 */
  startX: number;
  /** 结束列（含） */
  endX: number;
  /** 起始行 */
  startY: number;
  /** 结束行（含） */
  endY: number;
}

// ─────────────────────────────────────────────
// 3. 地形类型
// ─────────────────────────────────────────────

/** 6 种地形类型 */
export type TerrainType =
  | 'plain'      // 平原
  | 'mountain'   // 山地
  | 'water'      // 水域
  | 'forest'     // 森林
  | 'desert'     // 沙漠
  | 'city';      // 城池

/** 地形定义 */
export interface TerrainDef {
  /** 地形类型 */
  type: TerrainType;
  /** 地形中文名 */
  label: string;
  /** 底纹颜色（十六进制） */
  baseColor: string;
  /** 地形图标 */
  icon: string;
  /** 移动消耗倍率 */
  moveCost: number;
  /** 防御加成 */
  defenseBonus: number;
  /** 是否可通行 */
  passable: boolean;
}

/** 单个格子的地形数据 */
export interface TileData {
  /** 格子坐标 */
  pos: GridPosition;
  /** 地形类型 */
  terrain: TerrainType;
  /** 所属区域 */
  region: RegionId;
  /** 特殊地标（可选） */
  landmark?: LandmarkData;
}

// ─────────────────────────────────────────────
// 4. 特殊地标
// ─────────────────────────────────────────────

/** 地标类型 */
export type LandmarkType = 'city' | 'pass' | 'resource' | 'capital' | 'fortress' | 'village';

/** 地标等级 */
export type LandmarkLevel = 1 | 2 | 3 | 4 | 5;

/** 地标归属状态 */
export type OwnershipStatus = 'player' | 'enemy' | 'neutral';

/** 资源点类型 */
export type ResourceNodeType = 'grain' | 'gold' | 'troops' | 'mandate';

/** 特殊地标数据 */
export interface LandmarkData {
  /** 地标唯一ID */
  id: string;
  /** 地标类型 */
  type: LandmarkType;
  /** 地标名称 */
  name: string;
  /** 地标等级 */
  level: LandmarkLevel;
  /** 归属状态 */
  ownership: OwnershipStatus;
  /** 地标图标 */
  icon: string;
  /** 资源产出（资源点专用） */
  resourceType?: ResourceNodeType;
  /** 产出倍率 */
  productionMultiplier: number;
  /** 防御值（城池/关卡专用） */
  defenseValue: number;
}

// ─────────────────────────────────────────────
// 5. 地图筛选
// ─────────────────────────────────────────────

/** 筛选条件 */
export interface MapFilterCriteria {
  /** 按区域筛选（空数组=不筛选） */
  regions?: RegionId[];
  /** 按地形筛选（空数组=不筛选） */
  terrains?: TerrainType[];
  /** 按占领状态筛选（空数组=不筛选） */
  ownerships?: OwnershipStatus[];
  /** 按地标类型筛选（空数组=不筛选） */
  landmarkTypes?: LandmarkType[];
}

/** 筛选结果 */
export interface MapFilterResult {
  /** 匹配的格子列表 */
  tiles: TileData[];
  /** 匹配的地标列表 */
  landmarks: LandmarkData[];
  /** 匹配格子总数 */
  totalTiles: number;
  /** 匹配地标总数 */
  totalLandmarks: number;
}

// ─────────────────────────────────────────────
// 6. 渲染数据
// ─────────────────────────────────────────────

/** 渲染层级 */
export type RenderLayer = 'terrain' | 'region_overlay' | 'landmark' | 'territory' | 'bubble';

/** 格子渲染数据 */
export interface TileRenderData {
  /** 格子坐标 */
  pos: GridPosition;
  /** 像素坐标 X */
  pixelX: number;
  /** 像素坐标 Y */
  pixelY: number;
  /** 地形底纹颜色 */
  terrainColor: string;
  /** 区域覆盖颜色 */
  regionColor: string;
  /** 地标图标（可选） */
  landmarkIcon?: string;
  /** 是否高亮 */
  highlighted: boolean;
  /** 渲染层级 */
  layer: RenderLayer;
}

/** 视口内的渲染数据 */
export interface ViewportRenderData {
  /** 可见格子渲染数据 */
  tiles: TileRenderData[];
  /** 可见地标列表 */
  visibleLandmarks: LandmarkData[];
  /** 视口范围（格子坐标） */
  visibleRange: {
    startX: number;
    endX: number;
    startY: number;
    endY: number;
  };
}

// ─────────────────────────────────────────────
// 7. 世界地图系统状态
// ─────────────────────────────────────────────

/** 世界地图系统状态 */
export interface WorldMapState {
  /** 地图尺寸 */
  size: MapSize;
  /** 所有格子数据 */
  tiles: TileData[];
  /** 所有地标数据 */
  landmarks: LandmarkData[];
  /** 视口状态 */
  viewport: ViewportState;
  /** 当前筛选条件 */
  filter: MapFilterCriteria;
}

/** 世界地图存档数据 */
export interface WorldMapSaveData {
  /** 地标归属状态 */
  landmarkOwnerships: Record<string, OwnershipStatus>;
  /** 地标等级 */
  landmarkLevels: Record<string, LandmarkLevel>;
  /** 视口状态 */
  viewport: ViewportState;
  /** 版本号 */
  version: number;
}
