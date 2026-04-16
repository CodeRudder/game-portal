/**
 * 三国霸业 — 美术资源映射配置
 *
 * 地形渲染策略：使用精心设计的程序化色块 + 纹理图案替代不合适的塔防素材。
 * 每种地形有独特的颜色方案和纹理模式，variant 字段产生视觉变化。
 *
 * 建筑/NPC：保留 Kenney 资源作为可选精灵，fallback 到程序化渲染。
 *
 * @module games/three-kingdoms/AssetConfig
 */

import type { TerrainType } from './MapGenerator';

// ═══════════════════════════════════════════════════════════════
// 地形视觉配置（程序化渲染）
// ═══════════════════════════════════════════════════════════════

export type TerrainPattern = 'solid' | 'checker' | 'diagonal' | 'dots' | 'waves' | 'crosshatch' | 'grass' | 'rocks' | 'trees' | 'ripples';

export interface TerrainVisual {
  baseColor: number;
  lightColor: number;
  darkColor: number;
  pattern: TerrainPattern;
  label: string;
  /** 地形渲染优先级（高优先级地形会向低优先级地形绘制过渡边缘） */
  renderPriority: number;
  /** 过渡边缘宽度（像素） */
  transitionWidth: number;
  /** 过渡边缘颜色（用于向低优先级地形渐变） */
  transitionColor: number;
  /** 过渡边缘透明度 */
  transitionAlpha: number;
}

/**
 * 地形类型 → 程序化渲染参数
 *
 * 颜色设计遵循古风水墨画风格：
 * - 平原：青绿色系（江南水乡感）
 * - 山地：灰褐色系（秦岭蜀道感）
 * - 森林：深绿色系（南蛮密林感）
 * - 水域：靛蓝色系（长江天堑感）
 * - 道路：土黄色系（黄土古道感）
 * - 城市：金色调（繁华都市感）
 * - 村庄：浅绿色系（田园牧歌感）
 * - 关卡：灰石色系（雄关漫道感）
 */
export const TERRAIN_VISUALS: Record<TerrainType, TerrainVisual> = {
  plain: {
    baseColor: 0x5a8c4f,
    lightColor: 0x6a9c5f,
    darkColor: 0x4a7c3f,
    pattern: 'grass',
    label: '平原',
    renderPriority: 3,
    transitionWidth: 8,
    transitionColor: 0x6a9c5f,
    transitionAlpha: 0.3,
  },
  mountain: {
    baseColor: 0x7b6b5a,
    lightColor: 0x9b8b7a,
    darkColor: 0x5b4b3a,
    pattern: 'rocks',
    label: '山地',
    renderPriority: 6,
    transitionWidth: 12,
    transitionColor: 0x5b4b3a,
    transitionAlpha: 0.5,
  },
  forest: {
    baseColor: 0x2d5a1e,
    lightColor: 0x4d7a3e,
    darkColor: 0x1d4a0e,
    pattern: 'trees',
    label: '森林',
    renderPriority: 5,
    transitionWidth: 10,
    transitionColor: 0x1d4a0e,
    transitionAlpha: 0.4,
  },
  water: {
    baseColor: 0x2980b9,
    lightColor: 0x5dade2,
    darkColor: 0x1a5276,
    pattern: 'ripples',
    label: '水域',
    renderPriority: 1,
    transitionWidth: 14,
    transitionColor: 0x1a5276,
    transitionAlpha: 0.5,
  },
  road: {
    baseColor: 0x8b7355,
    lightColor: 0xa0896a,
    darkColor: 0x6b5335,
    pattern: 'solid',
    label: '道路',
    renderPriority: 4,
    transitionWidth: 4,
    transitionColor: 0x6b5335,
    transitionAlpha: 0.3,
  },
  city: {
    baseColor: 0xc9a96e,
    lightColor: 0xd4b87a,
    darkColor: 0xb89858,
    pattern: 'crosshatch',
    label: '城市',
    renderPriority: 8,
    transitionWidth: 6,
    transitionColor: 0xb89858,
    transitionAlpha: 0.3,
  },
  village: {
    baseColor: 0x8fbc8f,
    lightColor: 0x9fcc9f,
    darkColor: 0x7fac7f,
    pattern: 'checker',
    label: '村庄',
    renderPriority: 7,
    transitionWidth: 6,
    transitionColor: 0x7fac7f,
    transitionAlpha: 0.3,
  },
  fortress: {
    baseColor: 0x696969,
    lightColor: 0x808080,
    darkColor: 0x505050,
    pattern: 'crosshatch',
    label: '关卡',
    renderPriority: 9,
    transitionWidth: 8,
    transitionColor: 0x505050,
    transitionAlpha: 0.4,
  },
};

// ═══════════════════════════════════════════════════════════════
// Kenney 资源路径（保留，但仅用于建筑/NPC精灵）
// ═══════════════════════════════════════════════════════════════

const KENNEY_BASE = '/assets/kenney-tower-defense/PNG/Default size';

/** 地形类型 → Kenney 瓦片路径（已弃用，保留向后兼容） */
export const TERRAIN_ASSETS: Record<TerrainType, string> = {
  plain:    `${KENNEY_BASE}/towerDefense_tile011.png`,
  mountain: `${KENNEY_BASE}/towerDefense_tile007.png`,
  forest:   `${KENNEY_BASE}/towerDefense_tile010.png`,
  water:    `${KENNEY_BASE}/towerDefense_tile014.png`,
  road:     `${KENNEY_BASE}/towerDefense_tile012.png`,
  city:     `${KENNEY_BASE}/towerDefense_tile003.png`,
  village:  `${KENNEY_BASE}/towerDefense_tile001.png`,
  fortress: `${KENNEY_BASE}/towerDefense_tile005.png`,
};

/** 建筑类型 → Kenney 瓦片路径 */
export const BUILDING_ASSETS: Record<string, string> = {
  city:      `${KENNEY_BASE}/towerDefense_tile003.png`,
  village:   `${KENNEY_BASE}/towerDefense_tile001.png`,
  fortress:  `${KENNEY_BASE}/towerDefense_tile005.png`,
  yamen:     `${KENNEY_BASE}/towerDefense_tile002.png`,
  barracks:  `${KENNEY_BASE}/towerDefense_tile004.png`,
  market:    `${KENNEY_BASE}/towerDefense_tile019.png`,
  shop:      `${KENNEY_BASE}/towerDefense_tile020.png`,
  residence: `${KENNEY_BASE}/towerDefense_tile015.png`,
};

/** 资源点类型 → Kenney 瓦片路径 */
export const RESOURCE_ASSETS: Record<string, string> = {
  farm:    `${KENNEY_BASE}/towerDefense_tile011.png`,
  mine:    `${KENNEY_BASE}/towerDefense_tile007.png`,
  lumber:  `${KENNEY_BASE}/towerDefense_tile010.png`,
  fishery: `${KENNEY_BASE}/towerDefense_tile014.png`,
  herb:    `${KENNEY_BASE}/towerDefense_tile026.png`,
};

// ═══════════════════════════════════════════════════════════════
// NPC 颜色配置
// ═══════════════════════════════════════════════════════════════

/** NPC 职业类型 → 基础颜色 */
export const NPC_COLORS: Record<string, string> = {
  farmer:   '#4CAF50',
  soldier:  '#F44336',
  merchant: '#FFC107',
  scholar:  '#2196F3',
  scout:    '#9C27B0',
};

/** NPC 职业类型 → 颜色渐变变体（同职业不同个体） */
export const NPC_COLOR_VARIANTS: Record<string, string[]> = {
  farmer:   ['#4CAF50', '#66BB6A', '#81C784', '#388E3C'],
  soldier:  ['#F44336', '#EF5350', '#E57373', '#C62828'],
  merchant: ['#FFC107', '#FFD54F', '#FFE082', '#FFA000'],
  scholar:  ['#2196F3', '#42A5F5', '#64B5F6', '#1565C0'],
  scout:    ['#9C27B0', '#AB47BC', '#BA68C8', '#6A1B9A'],
};

/**
 * 获取 NPC 变体颜色
 * @param profession - 职业类型
 * @param index - NPC 索引
 */
export function getNPCVariantColor(profession: string, index: number): string {
  const variants = NPC_COLOR_VARIANTS[profession] || ['#888888'];
  return variants[index % variants.length];
}

// ═══════════════════════════════════════════════════════════════
// 精灵图帧名映射（保留向后兼容）
// ═══════════════════════════════════════════════════════════════

export const TERRAIN_SPRITE_NAMES: Record<TerrainType, string> = {
  plain:    'terrain_grass',
  mountain: 'terrain_grass',   // 改为 grass，不再用 enemy_knight
  forest:   'terrain_grass',   // 改为 grass，不再用 enemy_slime
  water:    'terrain_water',
  road:     'terrain_road_straight',
  city:     'tower_cannon',
  village:  'tower_archer',
  fortress: 'tower_fire',
};

export const BUILDING_SPRITE_NAMES: Record<string, string> = {
  city:      'tower_cannon',
  village:   'tower_archer',
  fortress:  'tower_fire',
  yamen:     'tower_magic',
  barracks:  'tower_ice',
  market:    'ui_coin',
  shop:      'ui_star',
  residence: 'terrain_sand',
};

// ═══════════════════════════════════════════════════════════════
// 工具函数
// ═══════════════════════════════════════════════════════════════

export function getAssetUrl(
  type: 'terrain' | 'building' | 'resource',
  key: string,
): string | null {
  switch (type) {
    case 'terrain':
      return TERRAIN_ASSETS[key as TerrainType] ?? null;
    case 'building':
      return BUILDING_ASSETS[key] ?? null;
    case 'resource':
      return RESOURCE_ASSETS[key] ?? null;
    default:
      return null;
  }
}

export function getSpriteName(
  type: 'terrain' | 'building',
  key: string,
): string | null {
  switch (type) {
    case 'terrain':
      return TERRAIN_SPRITE_NAMES[key as TerrainType] ?? null;
    case 'building':
      return BUILDING_SPRITE_NAMES[key] ?? null;
    default:
      return null;
  }
}
