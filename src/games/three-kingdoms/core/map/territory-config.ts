/**
 * 核心层 — 领土配置数据
 *
 * 包含领土相邻关系、产出配置、升级消耗等静态配置。
 * 所有配置为只读常量，运行时不可修改。
 *
 * @module core/map/territory-config
 */

import type { LandmarkLevel, OwnershipStatus, RegionId } from './world-map.types';
import type { TerritoryData, TerritoryProduction, TerritoryUpgradeCost } from './territory.types';
import { DEFAULT_LANDMARKS, LANDMARK_POSITIONS, REGION_DEFS, getRegionAtPosition } from './map-config';

// ─────────────────────────────────────────────
// 1. 领土产出系数
// ─────────────────────────────────────────────

/** 地标类型→基础产出倍率 */
const PRODUCTION_MULTIPLIERS: Record<string, TerritoryProduction> = {
  city: { grain: 5, gold: 5, troops: 3, mandate: 1 },
  pass: { grain: 1, gold: 1, troops: 2, mandate: 0 },
  resource_grain: { grain: 8, gold: 0, troops: 0, mandate: 0 },
  resource_gold: { grain: 0, gold: 8, troops: 0, mandate: 0 },
  resource_troops: { grain: 0, gold: 0, troops: 8, mandate: 0 },
  resource_mandate: { grain: 0, gold: 0, troops: 0, mandate: 5 },
};

/** 等级加成系数：level → 倍率 */
const LEVEL_MULTIPLIER: Record<LandmarkLevel, number> = {
  1: 1.0,
  2: 1.3,
  3: 1.6,
  4: 2.0,
  5: 2.5,
};

/** 升级消耗公式：base × level² */
const UPGRADE_BASE_COST: TerritoryUpgradeCost = {
  grain: 100,
  gold: 50,
};

// ─────────────────────────────────────────────
// 2. 相邻关系配置
// ─────────────────────────────────────────────

/**
 * 领土相邻关系表
 *
 * 定义哪些领土可以直接攻占（相邻关系）。
 * 基于地理距离和历史战役路线配置。
 * 注意：使用 makeSymmetric 确保双向对称。
 */
const RAW_ADJACENCY: Record<string, string[]> = {
  // ── 中原 ──
  'city-luoyang': ['city-xuchang', 'city-ye', 'city-changan', 'pass-hulao', 'pass-tong'],
  'city-xuchang': ['city-ye', 'res-grain1'],
  'city-changan': ['pass-jian', 'city-hanzhong'],
  'pass-tong': ['res-gold1'],
  'res-grain1': ['res-gold1'],
  // ── 江南 ──
  'city-jianye': ['city-changsha', 'res-grain2', 'res-troops1'],
  'city-chengdu': ['city-mianzhu', 'city-hanzhong'],
  'pass-jian': ['city-hanzhong'],
  'res-grain2': ['city-changsha'],
  'res-troops1': ['city-changsha'],
  // ── 西蜀 ──
  'city-mianzhu': ['res-mandate1'],
  'pass-yangping': ['res-mandate1'],
};

/** 将单向邻接表转为双向对称 */
function makeSymmetric(map: Record<string, string[]>): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const [id, adj] of Object.entries(map)) {
    result[id] = [...adj];
  }
  for (const [id, adj] of Object.entries(map)) {
    for (const other of adj) {
      if (!result[other]) result[other] = [];
      if (!result[other].includes(id)) {
        result[other].push(id);
      }
    }
  }
  return result;
}

const ADJACENCY_MAP: Record<string, string[]> = makeSymmetric(RAW_ADJACENCY);

// ─────────────────────────────────────────────
// 3. 辅助函数
// ─────────────────────────────────────────────

/**
 * 获取地标的基础产出
 *
 * @param type - 地标类型
 * @param resourceType - 资源点子类型（可选）
 * @returns 基础产出
 */
export function getBaseProduction(
  type: string,
  resourceType?: string,
): TerritoryProduction {
  if (type === 'resource' && resourceType) {
    return PRODUCTION_MULTIPLIERS[`resource_${resourceType}`]
      ?? PRODUCTION_MULTIPLIERS.city;
  }
  return PRODUCTION_MULTIPLIERS[type] ?? PRODUCTION_MULTIPLIERS.city;
}

/**
 * 计算等级加成后的产出
 *
 * @param base - 基础产出
 * @param level - 领土等级
 * @returns 加成后产出
 */
export function calculateProduction(
  base: TerritoryProduction,
  level: LandmarkLevel,
): TerritoryProduction {
  const multiplier = LEVEL_MULTIPLIER[level];
  return {
    grain: Math.round(base.grain * multiplier * 100) / 100,
    gold: Math.round(base.gold * multiplier * 100) / 100,
    troops: Math.round(base.troops * multiplier * 100) / 100,
    mandate: Math.round(base.mandate * multiplier * 100) / 100,
  };
}

/**
 * 计算升级消耗
 *
 * @param currentLevel - 当前等级
 * @returns 升级消耗（null 表示已满级）
 */
export function calculateUpgradeCost(
  currentLevel: LandmarkLevel,
): TerritoryUpgradeCost | null {
  if (currentLevel >= 5) return null;
  const nextLevel = (currentLevel + 1) as LandmarkLevel;
  return {
    grain: UPGRADE_BASE_COST.grain * nextLevel * nextLevel,
    gold: UPGRADE_BASE_COST.gold * nextLevel * nextLevel,
  };
}

/**
 * 获取相邻领土ID列表
 *
 * @param territoryId - 领土ID
 * @returns 相邻领土ID列表
 */
export function getAdjacentIds(territoryId: string): string[] {
  return ADJACENCY_MAP[territoryId] ?? [];
}

/**
 * 检查两个领土是否相邻
 *
 * @param id1 - 领土1 ID
 * @param id2 - 领土2 ID
 * @returns 是否相邻
 */
export function areAdjacent(id1: string, id2: string): boolean {
  return (ADJACENCY_MAP[id1] ?? []).includes(id2);
}

/**
 * 从 DEFAULT_LANDMARKS 生成初始领土数据
 *
 * @returns 所有领土数据列表
 */
export function generateTerritoryData(): TerritoryData[] {
  return DEFAULT_LANDMARKS.map((lm) => {
    const pos = LANDMARK_POSITIONS[lm.id];
    const region = pos ? getRegionAtPosition(pos.x, pos.y) : 'central_plains';
    const baseProd = getBaseProduction(lm.type, lm.resourceType);
    const currentProd = calculateProduction(baseProd, lm.level);

    return {
      id: lm.id,
      name: lm.name,
      position: pos ?? { x: 0, y: 0 },
      region: region as RegionId,
      ownership: lm.ownership as OwnershipStatus,
      level: lm.level,
      baseProduction: baseProd,
      currentProduction: currentProd,
      defenseValue: lm.defenseValue,
      adjacentIds: getAdjacentIds(lm.id),
    };
  });
}

/** 领土存档版本 */
export const TERRITORY_SAVE_VERSION = 1;
