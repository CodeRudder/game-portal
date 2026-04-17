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

export type TerrainPattern = 'solid' | 'checker' | 'diagonal' | 'dots' | 'waves' | 'crosshatch' | 'grass' | 'rocks' | 'trees' | 'ripples' | 'dunes' | 'snowflakes';

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
  // ── 三国古风色彩体系 ──────────────────────────────────────
  // 色彩灵感来自水墨画与古典配色：
  // 墨绿（草地）、深褐（山地）、靛蓝（水域）、暗金（城池）
  plain: {
    baseColor: 0x4a6b3a,       // 墨绿 — 江南水乡
    lightColor: 0x5a7b4a,
    darkColor: 0x3a5b2a,
    pattern: 'grass',
    label: '平原',
    renderPriority: 3,
    transitionWidth: 8,
    transitionColor: 0x5a7b4a,
    transitionAlpha: 0.3,
  },
  mountain: {
    baseColor: 0x6b5a4a,       // 深褐 — 秦岭蜀道
    lightColor: 0x8b7a6a,
    darkColor: 0x4b3a2a,
    pattern: 'rocks',
    label: '山地',
    renderPriority: 6,
    transitionWidth: 12,
    transitionColor: 0x4b3a2a,
    transitionAlpha: 0.5,
  },
  forest: {
    baseColor: 0x2a4a1e,       // 浓墨绿 — 南蛮密林
    lightColor: 0x3a6a2e,
    darkColor: 0x1a3a0e,
    pattern: 'trees',
    label: '森林',
    renderPriority: 5,
    transitionWidth: 10,
    transitionColor: 0x1a3a0e,
    transitionAlpha: 0.4,
  },
  water: {
    baseColor: 0x2a5070,       // 深靛蓝 — 长江天堑
    lightColor: 0x4a7090,
    darkColor: 0x1a3050,
    pattern: 'ripples',
    label: '水域',
    renderPriority: 1,
    transitionWidth: 14,
    transitionColor: 0x1a3050,
    transitionAlpha: 0.5,
  },
  road: {
    baseColor: 0x7a6345,       // 土黄 — 黄土古道
    lightColor: 0x8a7355,
    darkColor: 0x5a4325,
    pattern: 'solid',
    label: '道路',
    renderPriority: 4,
    transitionWidth: 4,
    transitionColor: 0x5a4325,
    transitionAlpha: 0.3,
  },
  city: {
    baseColor: 0xb8952e,       // 暗金 — 繁华都城
    lightColor: 0xc8a53e,
    darkColor: 0x8b7020,
    pattern: 'crosshatch',
    label: '城市',
    renderPriority: 8,
    transitionWidth: 6,
    transitionColor: 0x8b7020,
    transitionAlpha: 0.3,
  },
  village: {
    baseColor: 0x5a7a4a,       // 浅墨绿 — 田园牧歌
    lightColor: 0x6a8a5a,
    darkColor: 0x4a6a3a,
    pattern: 'checker',
    label: '村庄',
    renderPriority: 7,
    transitionWidth: 6,
    transitionColor: 0x4a6a3a,
    transitionAlpha: 0.3,
  },
  fortress: {
    baseColor: 0x5a4a3a,       // 灰石褐 — 雄关漫道
    lightColor: 0x6a5a4a,
    darkColor: 0x3a2a1a,
    pattern: 'crosshatch',
    label: '关卡',
    renderPriority: 9,
    transitionWidth: 8,
    transitionColor: 0x3a2a1a,
    transitionAlpha: 0.4,
  },
  desert: {
    baseColor: 0xc4a35a,       // 沙黄 — 大漠孤烟
    lightColor: 0xd4b36a,
    darkColor: 0xa4833a,
    pattern: 'dunes',
    label: '荒漠',
    renderPriority: 2,
    transitionWidth: 8,
    transitionColor: 0xa4833a,
    transitionAlpha: 0.3,
  },
  snow: {
    baseColor: 0xd8dce6,       // 冷灰白 — 北国冰原
    lightColor: 0xe8ecf6,
    darkColor: 0xb8bcc6,
    pattern: 'snowflakes',
    label: '雪地',
    renderPriority: 7,
    transitionWidth: 8,
    transitionColor: 0xb8bcc6,
    transitionAlpha: 0.3,
  },
};

// ═══════════════════════════════════════════════════════════════
// 势力城市颜色配置（城池/关卡按势力区分外观）
// ═══════════════════════════════════════════════════════════════

/** 势力城市颜色 */
export interface FactionCityColors {
  /** 旗帜颜色 */
  flagColor: number;
  /** 城墙装饰颜色 */
  wallAccent: number;
  /** 城墙主体颜色 */
  wallColor: number;
  /** 屋顶颜色 */
  roofColor: number;
}

/** 势力 → 城市颜色映射 */
export const FACTION_CITY_COLORS: Record<string, FactionCityColors> = {
  wei: {
    flagColor: 0x4a6fa5,      // 魏蓝 — 沉稳靛蓝
    wallAccent: 0x3a5f95,
    wallColor: 0x7a8a9a,
    roofColor: 0x5a7a9a,
  },
  shu: {
    flagColor: 0xc62828,      // 蜀红 — 赤焰朱红
    wallAccent: 0xb62020,
    wallColor: 0x9a7a6a,
    roofColor: 0xa04040,
  },
  wu: {
    flagColor: 0x2e7d32,      // 吴绿 — 翠墨深绿
    wallAccent: 0x1e6d22,
    wallColor: 0x7a9a7a,
    roofColor: 0x4a7a4a,
  },
  qun: {
    flagColor: 0xb8860b,      // 群黄 — 暗金铜色
    wallAccent: 0xa87600,
    wallColor: 0x8a8a7a,
    roofColor: 0x9a8a5a,
  },
};

/** 中立城市颜色（无势力领土） */
export const NEUTRAL_CITY_COLORS: FactionCityColors = {
  flagColor: 0x8a8a7a,       // 中立灰
  wallAccent: 0x6a6a6a,
  wallColor: 0x7a7a7a,
  roofColor: 0x6a6a6a,
};

/**
 * 根据领土 ID 获取势力城市颜色
 * @param territoryId - 领土 ID（如 'shu_chengdu'、'wei_xuchang'）
 * @returns 势力城市颜色配置
 */
export function getFactionCityColors(territoryId: string | undefined): FactionCityColors {
  if (!territoryId) return NEUTRAL_CITY_COLORS;
  const factionKey = territoryId.split('_')[0];
  return FACTION_CITY_COLORS[factionKey] ?? NEUTRAL_CITY_COLORS;
}

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
  desert:   `${KENNEY_BASE}/towerDefense_tile011.png`,
  snow:     `${KENNEY_BASE}/towerDefense_tile011.png`,
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
  desert:   'terrain_sand',
  snow:     'terrain_grass',
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
