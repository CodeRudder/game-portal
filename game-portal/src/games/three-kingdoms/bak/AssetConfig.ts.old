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

export type TerrainPattern = 'solid' | 'checker' | 'diagonal' | 'dots' | 'waves' | 'crosshatch' | 'grass' | 'rocks' | 'trees' | 'ripples' | 'dunes' | 'snowflakes' | 'wall' | 'bubbles';

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
  // ── 三国古风色彩体系（增强版 — 提高地形间色相/明度/饱和度区分度） ──
  // 色彩设计确保12种地形在视觉上有明显区分：
  // 翠绿（平原）、暖赭（山地）、墨绿（森林）、深蓝（水域）
  // 土黄（道路）、灰金（城池）、黄绿（村庄）、朱红（关卡）
  // 沙黄（荒漠）、冷白（雪地）、深棕（关隘）、暗绿（沼泽）
  plain: {
    baseColor: 0x5ec43e,       // 鲜翠绿 — 江南春色（高饱和度，与森林/村庄拉开差距）
    lightColor: 0x8aee58,
    darkColor: 0x3a8a1a,
    pattern: 'grass',
    label: '平原',
    renderPriority: 3,
    transitionWidth: 8,
    transitionColor: 0x3a8a1a,
    transitionAlpha: 0.35,
  },
  mountain: {
    baseColor: 0xa07850,       // 温暖赭石 — 秦岭蜀道（更暖更亮，与道路/关隘色相区分）
    lightColor: 0xcaa070,
    darkColor: 0x6a4a28,
    pattern: 'rocks',
    label: '山地',
    renderPriority: 6,
    transitionWidth: 12,
    transitionColor: 0x6a4a28,
    transitionAlpha: 0.55,
  },
  forest: {
    baseColor: 0x1e7a38,       // 翠墨绿 — 南蛮密林（更饱和蓝绿，与平原/村庄色相明显不同）
    lightColor: 0x38a855,
    darkColor: 0x0c4a15,
    pattern: 'trees',
    label: '森林',
    renderPriority: 5,
    transitionWidth: 10,
    transitionColor: 0x0c4a15,
    transitionAlpha: 0.45,
  },
  water: {
    baseColor: 0x2a72b8,       // 明靛蓝 — 长江天堑（更亮更鲜明，与所有陆地地形形成鲜明对比）
    lightColor: 0x50a0e8,
    darkColor: 0x144a80,
    pattern: 'ripples',
    label: '水域',
    renderPriority: 1,
    transitionWidth: 14,
    transitionColor: 0x144a80,
    transitionAlpha: 0.55,
  },
  road: {
    baseColor: 0xd8a840,       // 亮土黄 — 黄土古道（偏暖橙黄，与城池金色区分）
    lightColor: 0xf0c858,
    darkColor: 0xa88028,
    pattern: 'solid',
    label: '道路',
    renderPriority: 4,
    transitionWidth: 4,
    transitionColor: 0xa88028,
    transitionAlpha: 0.35,
  },
  city: {
    baseColor: 0xc8a050,       // 金石色 — 繁华都城（改为暖金调，彰显王者气象）
    lightColor: 0xe8c878,
    darkColor: 0x8a7030,
    pattern: 'crosshatch',
    label: '城市',
    renderPriority: 8,
    transitionWidth: 6,
    transitionColor: 0x8a7030,
    transitionAlpha: 0.35,
  },
  village: {
    baseColor: 0x98d84a,       // 嫩翠绿 — 田园牧歌（更鲜嫩黄绿，与平原纯绿和森林深绿明显区分）
    lightColor: 0xb8f068,
    darkColor: 0x68a028,
    pattern: 'checker',
    label: '村庄',
    renderPriority: 7,
    transitionWidth: 6,
    transitionColor: 0x68a028,
    transitionAlpha: 0.35,
  },
  fortress: {
    baseColor: 0xc83838,       // 鲜朱红 — 雄关漫道（更高饱和度朱红，三国战旗色）
    lightColor: 0xe85858,
    darkColor: 0x881818,
    pattern: 'crosshatch',
    label: '关卡',
    renderPriority: 9,
    transitionWidth: 8,
    transitionColor: 0x881818,
    transitionAlpha: 0.45,
  },
  desert: {
    baseColor: 0xe8c040,       // 明琥珀金 — 大漠孤烟（更金黄，与道路暖黄区分）
    lightColor: 0xf8dc68,
    darkColor: 0xb89020,
    pattern: 'dunes',
    label: '荒漠',
    renderPriority: 2,
    transitionWidth: 8,
    transitionColor: 0xb89020,
    transitionAlpha: 0.35,
  },
  snow: {
    baseColor: 0xe0ecf8,       // 冰蓝白 — 北国冰原（保持冷调，与所有暖色地形对比）
    lightColor: 0xf0f8ff,
    darkColor: 0xb0c8e0,
    pattern: 'snowflakes',
    label: '雪地',
    renderPriority: 7,
    transitionWidth: 8,
    transitionColor: 0xb0c8e0,
    transitionAlpha: 0.35,
  },
  pass: {
    baseColor: 0x6a3518,       // 铁棕红 — 关隘城墙（更深沉铁棕，与关卡朱红和山地赭石区分）
    lightColor: 0x8a5528,
    darkColor: 0x442008,
    pattern: 'wall',
    label: '关隘',
    renderPriority: 10,
    transitionWidth: 10,
    transitionColor: 0x442008,
    transitionAlpha: 0.55,
  },
  swamp: {
    baseColor: 0x387058,       // 暗翠青绿 — 沼泽湿地（更饱和青绿，与森林纯绿区分）
    lightColor: 0x509870,
    darkColor: 0x1c3a28,
    pattern: 'bubbles',
    label: '沼泽',
    renderPriority: 2,
    transitionWidth: 10,
    transitionColor: 0x1c3a28,
    transitionAlpha: 0.45,
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
  pass:     `${KENNEY_BASE}/towerDefense_tile005.png`,
  swamp:    `${KENNEY_BASE}/towerDefense_tile014.png`,
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
  mountain: 'terrain_grass',
  forest:   'terrain_grass',
  water:    'terrain_water',
  road:     'terrain_road_straight',
  city:     'tower_cannon',
  village:  'tower_archer',
  fortress: 'tower_fire',
  desert:   'terrain_sand',
  snow:     'terrain_grass',
  pass:     'tower_fire',
  swamp:    'terrain_water',
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
