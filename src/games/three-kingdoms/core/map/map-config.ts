/**
 * 核心层 — 世界地图数据配置
 *
 * 包含地图尺寸、格子系统、视口、三大区域、6种地形、特殊地标等静态配置。
 * 所有配置为只读常量，运行时不可修改。
 *
 * @module core/map/map-config
 */

import type {
  MapSize,
  GridConfig,
  ViewportConfig,
  RegionId,
  RegionDef,
  TerrainType,
  TerrainDef,
  LandmarkData,
  LandmarkLevel,
  OwnershipStatus,
  TileData,
} from './world-map.types';

// ─────────────────────────────────────────────
// 1. 地图基础参数（#9）
// ─────────────────────────────────────────────

/** 地图尺寸：60×40 格子 */
export const MAP_SIZE: MapSize = {
  cols: 60,
  rows: 40,
} as const;

/** 格子系统配置 */
export const GRID_CONFIG: GridConfig = {
  tileWidth: 32,
  tileHeight: 32,
} as const;

/** PC端视口配置：1280×696px */
export const VIEWPORT_CONFIG: ViewportConfig = {
  width: 1280,
  height: 696,
  minZoom: 0.5,
  maxZoom: 2.0,
  defaultZoom: 1.0,
} as const;

/** 地图总像素尺寸 */
export const MAP_PIXEL_SIZE = {
  width: MAP_SIZE.cols * GRID_CONFIG.tileWidth,
  height: MAP_SIZE.rows * GRID_CONFIG.tileHeight,
} as const;

// ─────────────────────────────────────────────
// 2. 三大区域划分（#10）
// ─────────────────────────────────────────────

/** 区域ID列表 */
export const REGION_IDS: readonly RegionId[] = [
  'central_plains',
  'jiangnan',
  'western_shu',
] as const;

/** 区域定义表 */
export const REGION_DEFS: Record<RegionId, RegionDef> = {
  central_plains: {
    id: 'central_plains',
    label: '中原',
    description: '中央平原，兵家必争之地，城池密集',
    color: '#D4A574',
    bounds: { startX: 15, endX: 44, startY: 0, endY: 19 },
  },
  jiangnan: {
    id: 'jiangnan',
    label: '江南',
    description: '东南水乡，资源丰富，水路纵横',
    color: '#7FB3D8',
    bounds: { startX: 30, endX: 59, startY: 20, endY: 39 },
  },
  western_shu: {
    id: 'western_shu',
    label: '西蜀',
    description: '西部山地，易守难攻，地形险要',
    color: '#8B9E6B',
    bounds: { startX: 0, endX: 29, startY: 20, endY: 39 },
  },
} as const;

/** 区域中文名映射 */
export const REGION_LABELS: Record<RegionId, string> = {
  central_plains: '中原',
  jiangnan: '江南',
  western_shu: '西蜀',
} as const;

/** 区域颜色映射 */
export const REGION_COLORS: Record<RegionId, string> = {
  central_plains: '#D4A574',
  jiangnan: '#7FB3D8',
  western_shu: '#8B9E6B',
} as const;

// ─────────────────────────────────────────────
// 3. 地形类型（#11）
// ─────────────────────────────────────────────

/** 地形类型列表 */
export const TERRAIN_TYPES: readonly TerrainType[] = [
  'plain',
  'mountain',
  'water',
  'forest',
  'desert',
  'city',
] as const;

/** 地形定义表 */
export const TERRAIN_DEFS: Record<TerrainType, TerrainDef> = {
  plain: {
    type: 'plain',
    label: '平原',
    baseColor: '#A8D5A2',
    icon: '🏔️',
    moveCost: 1.0,
    defenseBonus: 0,
    passable: true,
  },
  mountain: {
    type: 'mountain',
    label: '山地',
    baseColor: '#8B7355',
    icon: '⛰️',
    moveCost: 2.0,
    defenseBonus: 0.3,
    passable: true,
  },
  water: {
    type: 'water',
    label: '水域',
    baseColor: '#5B9BD5',
    icon: '🌊',
    moveCost: 3.0,
    defenseBonus: -0.1,
    passable: false,
  },
  forest: {
    type: 'forest',
    label: '森林',
    baseColor: '#2E7D32',
    icon: '🌲',
    moveCost: 1.5,
    defenseBonus: 0.15,
    passable: true,
  },
  desert: {
    type: 'desert',
    label: '沙漠',
    baseColor: '#DEB887',
    icon: '🏜️',
    moveCost: 1.8,
    defenseBonus: -0.05,
    passable: true,
  },
  city: {
    type: 'city',
    label: '城池',
    baseColor: '#C0392B',
    icon: '🏰',
    moveCost: 1.0,
    defenseBonus: 0.5,
    passable: true,
  },
} as const;

/** 地形中文名映射 */
export const TERRAIN_LABELS: Record<TerrainType, string> = {
  plain: '平原',
  mountain: '山地',
  water: '水域',
  forest: '森林',
  desert: '沙漠',
  city: '城池',
} as const;

/** 地形颜色映射 */
export const TERRAIN_COLORS: Record<TerrainType, string> = {
  plain: '#A8D5A2',
  mountain: '#8B7355',
  water: '#5B9BD5',
  forest: '#2E7D32',
  desert: '#DEB887',
  city: '#C0392B',
} as const;

// ─────────────────────────────────────────────
// 4. 特殊地标配置（#12）
// ─────────────────────────────────────────────

/** 默认地标列表 */
export const DEFAULT_LANDMARKS: readonly LandmarkData[] = [
  // ── 中原城池 ──
  { id: 'city-luoyang', type: 'city', name: '洛阳', level: 5, ownership: 'neutral', icon: '🏰', productionMultiplier: 2.0, defenseValue: 100 },
  { id: 'city-xuchang', type: 'city', name: '许昌', level: 4, ownership: 'neutral', icon: '🏰', productionMultiplier: 1.8, defenseValue: 80 },
  { id: 'city-ye', type: 'city', name: '邺城', level: 4, ownership: 'neutral', icon: '🏰', productionMultiplier: 1.8, defenseValue: 80 },
  { id: 'city-changan', type: 'city', name: '长安', level: 5, ownership: 'neutral', icon: '🏰', productionMultiplier: 2.0, defenseValue: 100 },
  // ── 中原关卡 ──
  { id: 'pass-hulao', type: 'pass', name: '虎牢关', level: 3, ownership: 'neutral', icon: '🚩', productionMultiplier: 1.0, defenseValue: 120 },
  { id: 'pass-tong', type: 'pass', name: '潼关', level: 3, ownership: 'neutral', icon: '🚩', productionMultiplier: 1.0, defenseValue: 120 },
  // ── 中原资源点 ──
  { id: 'res-grain1', type: 'resource', name: '许田', level: 2, ownership: 'neutral', icon: '🌾', resourceType: 'grain', productionMultiplier: 1.5, defenseValue: 20 },
  { id: 'res-gold1', type: 'resource', name: '金矿场', level: 2, ownership: 'neutral', icon: '💰', resourceType: 'gold', productionMultiplier: 1.5, defenseValue: 20 },
  // ── 江南城池 ──
  { id: 'city-jianye', type: 'city', name: '建业', level: 5, ownership: 'neutral', icon: '🏰', productionMultiplier: 2.0, defenseValue: 100 },
  { id: 'city-changsha', type: 'city', name: '长沙', level: 3, ownership: 'neutral', icon: '🏰', productionMultiplier: 1.5, defenseValue: 60 },
  { id: 'city-chengdu', type: 'city', name: '成都', level: 4, ownership: 'neutral', icon: '🏰', productionMultiplier: 1.8, defenseValue: 80 },
  // ── 江南关卡 ──
  { id: 'pass-jian', type: 'pass', name: '剑阁', level: 4, ownership: 'neutral', icon: '🚩', productionMultiplier: 1.0, defenseValue: 150 },
  // ── 江南资源点 ──
  { id: 'res-grain2', type: 'resource', name: '稻田', level: 3, ownership: 'neutral', icon: '🌾', resourceType: 'grain', productionMultiplier: 2.0, defenseValue: 30 },
  { id: 'res-troops1', type: 'resource', name: '兵营', level: 2, ownership: 'neutral', icon: '⚔️', resourceType: 'troops', productionMultiplier: 1.5, defenseValue: 25 },
  // ── 西蜀城池 ──
  { id: 'city-hanzhong', type: 'city', name: '汉中', level: 3, ownership: 'neutral', icon: '🏰', productionMultiplier: 1.5, defenseValue: 60 },
  { id: 'city-mianzhu', type: 'city', name: '绵竹', level: 2, ownership: 'neutral', icon: '🏰', productionMultiplier: 1.2, defenseValue: 40 },
  // ── 西蜀关卡 ──
  { id: 'pass-yangping', type: 'pass', name: '阳平关', level: 3, ownership: 'neutral', icon: '🚩', productionMultiplier: 1.0, defenseValue: 130 },
  // ── 西蜀资源点 ──
  { id: 'res-mandate1', type: 'resource', name: '天命台', level: 2, ownership: 'neutral', icon: '🌟', resourceType: 'mandate', productionMultiplier: 1.5, defenseValue: 20 },
] as const;

/** 地标坐标映射（landmark id → 格子坐标） */
export const LANDMARK_POSITIONS: Record<string, { x: number; y: number }> = {
  // 中原
  'city-luoyang': { x: 30, y: 8 },
  'city-xuchang': { x: 35, y: 10 },
  'city-ye': { x: 38, y: 5 },
  'city-changan': { x: 20, y: 12 },
  'pass-hulao': { x: 33, y: 6 },
  'pass-tong': { x: 22, y: 10 },
  'res-grain1': { x: 36, y: 14 },
  'res-gold1': { x: 25, y: 16 },
  // 江南
  'city-jianye': { x: 45, y: 28 },
  'city-changsha': { x: 40, y: 32 },
  'city-chengdu': { x: 12, y: 28 },
  'pass-jian': { x: 16, y: 24 },
  'res-grain2': { x: 50, y: 30 },
  'res-troops1': { x: 42, y: 36 },
  // 西蜀
  'city-hanzhong': { x: 10, y: 22 },
  'city-mianzhu': { x: 8, y: 30 },
  'pass-yangping': { x: 5, y: 25 },
  'res-mandate1': { x: 15, y: 35 },
} as const;

// ─────────────────────────────────────────────
// 5. 辅助函数
// ─────────────────────────────────────────────

/**
 * 根据坐标获取所属区域
 *
 * @param x - 列坐标
 * @param y - 行坐标
 * @returns 区域ID
 */
export function getRegionAtPosition(x: number, y: number): RegionId {
  for (const regionId of REGION_IDS) {
    const def = REGION_DEFS[regionId];
    const { startX, endX, startY, endY } = def.bounds;
    if (x >= startX && x <= endX && y >= startY && y <= endY) {
      return regionId;
    }
  }
  // 默认归属中原（覆盖边界外区域）
  return 'central_plains';
}

/**
 * 根据坐标获取地形类型（程序化生成规则）
 *
 * 基于区域特征和坐标位置确定地形类型：
 * - 中原：以平原为主，少量森林
 * - 江南：水域较多，平原和森林混合
 * - 西蜀：山地为主，少量平原
 *
 * @param x - 列坐标
 * @param y - 行坐标
 * @returns 地形类型
 */
export function getTerrainAtPosition(x: number, y: number): TerrainType {
  // 检查是否为城池/关卡/资源点位置
  for (const [id, pos] of Object.entries(LANDMARK_POSITIONS)) {
    if (pos.x === x && pos.y === y) {
      const landmark = DEFAULT_LANDMARKS.find(l => l.id === id);
      if (landmark?.type === 'city' || landmark?.type === 'pass') {
        return 'city';
      }
    }
  }

  const region = getRegionAtPosition(x, y);

  // 使用简单哈希实现确定性伪随机地形分布
  const hash = ((x * 7 + y * 13 + x * y * 3) % 100);

  switch (region) {
    case 'central_plains':
      if (hash < 65) return 'plain';
      if (hash < 80) return 'forest';
      if (hash < 90) return 'mountain';
      return 'desert';

    case 'jiangnan':
      if (hash < 40) return 'plain';
      if (hash < 65) return 'water';
      if (hash < 85) return 'forest';
      return 'mountain';

    case 'western_shu':
      if (hash < 35) return 'mountain';
      if (hash < 55) return 'plain';
      if (hash < 75) return 'forest';
      if (hash < 90) return 'mountain';
      return 'desert';

    default:
      return 'plain';
  }
}

/**
 * 生成全地图格子数据
 *
 * @returns 所有格子的 TileData 数组
 */
export function generateAllTiles(): TileData[] {
  const tiles: TileData[] = [];
  const landmarkMap = new Map<string, LandmarkData>();

  // 建立坐标→地标映射
  for (const landmark of DEFAULT_LANDMARKS) {
    const pos = LANDMARK_POSITIONS[landmark.id];
    if (pos) {
      landmarkMap.set(`${pos.x},${pos.y}`, { ...landmark });
    }
  }

  for (let y = 0; y < MAP_SIZE.rows; y++) {
    for (let x = 0; x < MAP_SIZE.cols; x++) {
      const key = `${x},${y}`;
      const terrain = getTerrainAtPosition(x, y);
      const region = getRegionAtPosition(x, y);
      const landmark = landmarkMap.get(key);

      tiles.push({
        pos: { x, y },
        terrain,
        region,
        landmark: landmark ? { ...landmark } : undefined,
      });
    }
  }

  return tiles;
}

/** 世界地图存档版本 */
export const MAP_SAVE_VERSION = 1;
