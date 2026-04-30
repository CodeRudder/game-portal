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

/** 区域ID列表（⚠️ PRD MAP-1: 魏/蜀/吴+中立） */
export const REGION_IDS: readonly RegionId[] = [
  'wei',
  'shu',
  'wu',
  'neutral',
] as const;

/** 区域定义表 */
export const REGION_DEFS: Record<RegionId, RegionDef> = {
  wei: {
    id: 'wei',
    label: '魏',
    name: '魏',
    description: '北方中原，曹魏基业，城池密集',
    color: '#2E5090',
    bounds: { startX: 10, endX: 50, startY: 0, endY: 19 },
  },
  shu: {
    id: 'shu',
    label: '蜀',
    name: '蜀',
    description: '西南山地，蜀汉险要，易守难攻',
    color: '#8B2500',
    bounds: { startX: 0, endX: 29, startY: 20, endY: 39 },
  },
  wu: {
    id: 'wu',
    label: '吴',
    name: '吴',
    description: '东南水乡，东吴水路，资源丰富',
    color: '#2E6B3E',
    bounds: { startX: 30, endX: 59, startY: 20, endY: 39 },
  },
  neutral: {
    id: 'neutral',
    label: '中立',
    name: '中立',
    description: '中立区域，各方势力交界',
    color: '#808080',
    bounds: { startX: 0, endX: 9, startY: 0, endY: 39 },
  },
} as const;

/** 区域中文名映射 */
export const REGION_LABELS: Record<RegionId, string> = {
  wei: '魏',
  shu: '蜀',
  wu: '吴',
  neutral: '中立',
} as const;

/** 区域颜色映射 */
export const REGION_COLORS: Record<RegionId, string> = {
  wei: '#2E5090',
  shu: '#8B2500',
  wu: '#2E6B3E',
  neutral: '#808080',
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
  'pass',
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
  pass: {
    type: 'pass',
    label: '关隘',
    baseColor: '#8B6914',
    icon: '🚩',
    moveCost: 2.5,
    defenseBonus: 0.4,
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
  pass: '关隘',
  city: '城池',
} as const;

/** 地形颜色映射 */
export const TERRAIN_COLORS: Record<TerrainType, string> = {
  plain: '#A8D5A2',
  mountain: '#8B7355',
  water: '#5B9BD5',
  forest: '#2E7D32',
  pass: '#8B6914',
  city: '#C0392B',
} as const;

// ─────────────────────────────────────────────
// 4. 特殊地标配置（#12）
// ─────────────────────────────────────────────

/** 默认地标列表（⚠️ PRD MAP-1: 魏/蜀/吴+中立 13块领土+2中立） */
export const DEFAULT_LANDMARKS: readonly LandmarkData[] = [
  // ── 魏国领土 ──
  { id: 'city-ye', type: 'city', name: '邺城', level: 4, ownership: 'neutral', icon: '🏰', productionMultiplier: 1.8, defenseValue: 80 },
  { id: 'city-xuchang', type: 'city', name: '许昌', level: 4, ownership: 'neutral', icon: '🏰', productionMultiplier: 1.8, defenseValue: 80 },
  { id: 'city-puyang', type: 'city', name: '濮阳', level: 3, ownership: 'neutral', icon: '🏰', productionMultiplier: 1.5, defenseValue: 60 },
  { id: 'city-beihai', type: 'city', name: '北海', level: 3, ownership: 'neutral', icon: '🏰', productionMultiplier: 1.5, defenseValue: 60 },
  // ── 蜀国领土 ──
  { id: 'city-chengdu', type: 'city', name: '成都', level: 5, ownership: 'neutral', icon: '🏰', productionMultiplier: 2.0, defenseValue: 100 },
  { id: 'city-hanzhong', type: 'city', name: '汉中', level: 3, ownership: 'neutral', icon: '🏰', productionMultiplier: 1.5, defenseValue: 60 },
  { id: 'city-yongan', type: 'city', name: '永安', level: 3, ownership: 'neutral', icon: '🏰', productionMultiplier: 1.5, defenseValue: 60 },
  { id: 'city-nanzhong', type: 'city', name: '南中', level: 2, ownership: 'neutral', icon: '🏰', productionMultiplier: 1.2, defenseValue: 40 },
  // ── 吴国领土 ──
  { id: 'city-jianye', type: 'city', name: '建业', level: 5, ownership: 'neutral', icon: '🏰', productionMultiplier: 2.0, defenseValue: 100 },
  { id: 'city-kuaiji', type: 'city', name: '会稽', level: 3, ownership: 'neutral', icon: '🏰', productionMultiplier: 1.5, defenseValue: 60 },
  { id: 'city-chaisang', type: 'city', name: '柴桑', level: 3, ownership: 'neutral', icon: '🏰', productionMultiplier: 1.5, defenseValue: 60 },
  { id: 'city-lujiang', type: 'city', name: '庐江', level: 3, ownership: 'neutral', icon: '🏰', productionMultiplier: 1.5, defenseValue: 60 },
  // ── 中立领土 ──
  { id: 'city-luoyang', type: 'city', name: '洛阳', level: 5, ownership: 'player', icon: '🏰', productionMultiplier: 2.0, defenseValue: 100 },
  { id: 'city-changan', type: 'city', name: '长安', level: 5, ownership: 'neutral', icon: '🏰', productionMultiplier: 2.0, defenseValue: 100 },
  { id: 'city-xiangyang', type: 'city', name: '襄阳', level: 4, ownership: 'neutral', icon: '🏰', productionMultiplier: 1.8, defenseValue: 80 },
  // ── 关卡 ──
  { id: 'pass-hulao', type: 'pass', name: '虎牢关', level: 3, ownership: 'neutral', icon: '🚩', productionMultiplier: 1.0, defenseValue: 120 },
  { id: 'pass-tong', type: 'pass', name: '潼关', level: 3, ownership: 'neutral', icon: '🚩', productionMultiplier: 1.0, defenseValue: 120 },
  { id: 'pass-jian', type: 'pass', name: '剑阁', level: 4, ownership: 'neutral', icon: '🚩', productionMultiplier: 1.0, defenseValue: 150 },
  { id: 'pass-yangping', type: 'pass', name: '阳平关', level: 3, ownership: 'neutral', icon: '🚩', productionMultiplier: 1.0, defenseValue: 130 },
  // ── 资源点 ──
  { id: 'res-grain1', type: 'resource', name: '许田', level: 2, ownership: 'neutral', icon: '🌾', resourceType: 'grain', productionMultiplier: 1.5, defenseValue: 20 },
  { id: 'res-gold1', type: 'resource', name: '金矿场', level: 2, ownership: 'neutral', icon: '💰', resourceType: 'gold', productionMultiplier: 1.5, defenseValue: 20 },
  { id: 'res-grain2', type: 'resource', name: '稻田', level: 3, ownership: 'neutral', icon: '🌾', resourceType: 'grain', productionMultiplier: 2.0, defenseValue: 30 },
  { id: 'res-troops1', type: 'resource', name: '兵营', level: 2, ownership: 'neutral', icon: '⚔️', resourceType: 'troops', productionMultiplier: 1.5, defenseValue: 25 },
  { id: 'res-mandate1', type: 'resource', name: '天命台', level: 2, ownership: 'neutral', icon: '🌟', resourceType: 'mandate', productionMultiplier: 1.5, defenseValue: 20 },
] as const;

/** 地标坐标映射（⚠️ PRD MAP-1: 魏/蜀/吴+中立） */
export const LANDMARK_POSITIONS: Record<string, { x: number; y: number }> = {
  // 魏国（左上 x<30, y<20）
  'city-ye': { x: 20, y: 5 },
  'city-xuchang': { x: 25, y: 10 },
  'city-puyang': { x: 15, y: 8 },
  'city-beihai': { x: 10, y: 15 },
  // 蜀国（左下 x<30, y≥20）
  'city-chengdu': { x: 12, y: 28 },
  'city-hanzhong': { x: 10, y: 22 },
  'city-yongan': { x: 18, y: 32 },
  'city-nanzhong': { x: 8, y: 36 },
  // 吴国（右下 x≥30, y≥20）
  'city-jianye': { x: 45, y: 28 },
  'city-kuaiji': { x: 50, y: 32 },
  'city-chaisang': { x: 38, y: 25 },
  'city-lujiang': { x: 42, y: 22 },
  // 中立（右上 x≥30, y<20）→ 现在属于魏国中原区域
  'city-luoyang': { x: 30, y: 8 },
  'city-changan': { x: 32, y: 12 },
  'city-xiangyang': { x: 40, y: 15 },
  // 关卡
  'pass-hulao': { x: 33, y: 6 },
  'pass-tong': { x: 31, y: 10 },
  'pass-jian': { x: 16, y: 24 },
  'pass-yangping': { x: 5, y: 25 },
  // 资源点
  'res-grain1': { x: 36, y: 14 },
  'res-gold1': { x: 38, y: 16 },
  'res-grain2': { x: 48, y: 30 },
  'res-troops1': { x: 42, y: 36 },
  'res-mandate1': { x: 15, y: 35 },
} as const;

// ─────────────────────────────────────────────
// 5. 辅助函数
// ─────────────────────────────────────────────

/**
 * 根据坐标获取所属区域（⚠️ PRD MAP-1: 魏/蜀/吴）
 *
 * @param x - 列坐标
 * @param y - 行坐标
 * @returns 区域ID
 */
export function getRegionAtPosition(x: number, y: number): RegionId {
  // 中立（左侧 x<10）
  if (x < 10) return 'neutral';
  // 魏国（中原：x>=10, y<20）
  if (y < 20) return 'wei';
  // 蜀国（左下：x<30, y>=20）
  if (x < 30) return 'shu';
  // 吴国（右下：x>=30, y>=20）
  return 'wu';
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
      if (landmark?.type === 'city' || landmark?.type === 'pass' || landmark?.type === 'capital') {
        return 'city';
      }
    }
  }

  const region = getRegionAtPosition(x, y);

  // 使用简单哈希实现确定性伪随机地形分布
  const hash = ((x * 7 + y * 13 + x * y * 3) % 100);

  switch (region) {
    case 'wei':
      // 魏国：北方平原为主，少量森林和山地
      if (hash < 65) return 'plain';
      if (hash < 80) return 'forest';
      if (hash < 90) return 'mountain';
      return 'pass';

    case 'shu':
      // 蜀国：西南山地为主，少量平原和森林
      if (hash < 35) return 'mountain';
      if (hash < 55) return 'plain';
      if (hash < 75) return 'forest';
      if (hash < 90) return 'pass';
      return 'mountain';

    case 'wu':
      // 吴国：东南水乡，水域较多
      if (hash < 40) return 'plain';
      if (hash < 65) return 'water';
      if (hash < 85) return 'forest';
      return 'pass';

    case 'neutral':
      // 中立：混合地形
      if (hash < 40) return 'plain';
      if (hash < 60) return 'mountain';
      if (hash < 80) return 'forest';
      return 'pass';

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
        x,
        y,
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
