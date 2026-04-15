/**
 * 三国霸业 — 美术资源映射配置
 *
 * 将游戏逻辑层使用的地形/建筑/资源类型键映射到 Kenney Tower Defense
 * 瓦片资源路径。所有资源均为 64×64 PNG，CC0 协议。
 *
 * 资源目录: public/assets/kenney-tower-defense/PNG/Default size/
 * 精灵图帧名来自 spritesheet.json。
 *
 * @module games/three-kingdoms/AssetConfig
 */

import type { TerrainType } from './MapGenerator';

// ═══════════════════════════════════════════════════════════════
// 资源基础路径
// ═══════════════════════════════════════════════════════════════

/** Kenney 瓦片 PNG 基础路径 */
const KENNEY_BASE = '/assets/kenney-tower-defense/PNG/Default size';

// ═══════════════════════════════════════════════════════════════
// 地形瓦片映射
// ═══════════════════════════════════════════════════════════════

/**
 * 地形类型 → Kenney 瓦片 PNG 路径
 *
 * 映射策略：
 * - plain   → terrain_grass (tile011, 绿色草地)
 * - mountain→ enemy_knight  (tile007, 骑士→山石质感)
 * - forest  → enemy_slime   (tile010, 史莱姆→绿色植被)
 * - water   → terrain_water (tile014, 水域)
 * - road    → terrain_road_straight (tile012, 直路)
 * - city    → tower_cannon  (tile003, 炮塔→城防建筑)
 * - village → tower_archer  (tile001, 弓箭塔→小型建筑)
 * - fortress→ tower_fire    (tile005, 火塔→坚固堡垒)
 */
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

// ═══════════════════════════════════════════════════════════════
// 建筑图标映射
// ═══════════════════════════════════════════════════════════════

/**
 * 建筑类型 → Kenney 瓦片 PNG 路径
 *
 * 使用塔防塔楼图标表示不同建筑：
 * - city     → tower_cannon (tile003, 城池)
 * - village  → tower_archer (tile001, 村落)
 * - fortress → tower_fire   (tile005, 关卡)
 * - yamen    → tower_magic  (tile002, 衙门)
 * - barracks → tower_ice    (tile004, 兵营)
 * - market   → ui_coin      (tile019, 市场)
 * - shop     → ui_star      (tile020, 商铺)
 * - residence→ terrain_sand (tile015, 民居)
 */
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

// ═══════════════════════════════════════════════════════════════
// 资源点图标
// ═══════════════════════════════════════════════════════════════

/**
 * 资源点类型 → Kenney 瓦片 PNG 路径
 */
export const RESOURCE_ASSETS: Record<string, string> = {
  farm:    `${KENNEY_BASE}/towerDefense_tile011.png`,  // 草地→农田
  mine:    `${KENNEY_BASE}/towerDefense_tile007.png`,  // 山石→矿场
  lumber:  `${KENNEY_BASE}/towerDefense_tile010.png`,  // 绿色→伐木场
  fishery: `${KENNEY_BASE}/towerDefense_tile014.png`,  // 水域→渔场
  herb:    `${KENNEY_BASE}/towerDefense_tile026.png`,  // 治疗效果→药草
};

// ═══════════════════════════════════════════════════════════════
// NPC 颜色配置（无精灵时用彩色圆形）
// ═══════════════════════════════════════════════════════════════

/**
 * NPC 职业类型 → 颜色值（十六进制字符串）
 *
 * 用于在无精灵图时绘制彩色圆形 NPC。
 */
export const NPC_COLORS: Record<string, string> = {
  farmer:   '#4CAF50',
  soldier:  '#F44336',
  merchant: '#FFC107',
  scholar:  '#2196F3',
  scout:    '#9C27B0',
};

// ═══════════════════════════════════════════════════════════════
// 精灵图帧名映射（用于 spritesheet 加载方式）
// ═══════════════════════════════════════════════════════════════

/**
 * 地形类型 → spritesheet 帧名
 *
 * 当使用 AssetManager.loadKenneySpritesheet() 加载精灵图时，
 * 通过帧名从 textureCache 获取纹理。
 */
export const TERRAIN_SPRITE_NAMES: Record<TerrainType, string> = {
  plain:    'terrain_grass',
  mountain: 'enemy_knight',
  forest:   'enemy_slime',
  water:    'terrain_water',
  road:     'terrain_road_straight',
  city:     'tower_cannon',
  village:  'tower_archer',
  fortress: 'tower_fire',
};

/**
 * 建筑类型 → spritesheet 帧名
 */
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

/**
 * 获取资源 URL，带 fallback
 *
 * 根据资源类型和键查找对应资源路径。
 * 找不到时返回 null，由调用方决定 fallback 策略。
 *
 * @param type - 资源类型：terrain / building / resource
 * @param key  - 资源键名（如 'plain', 'city', 'farm'）
 * @returns 资源 URL 字符串，未找到返回 null
 */
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

/**
 * 获取精灵图帧名，带 fallback
 *
 * @param type - 资源类型：terrain / building
 * @param key  - 资源键名
 * @returns spritesheet 帧名，未找到返回 null
 */
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
