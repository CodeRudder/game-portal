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
import type { ParsedMap } from './ASCIIMapParser';
import { DEFAULT_LANDMARKS, LANDMARK_POSITIONS, getRegionAtPosition } from './map-config';

// ─────────────────────────────────────────────
// 0. 可行走网格类型（核心层定义，引擎层实现构建逻辑）
// ─────────────────────────────────────────────

/** 可行走网格：boolean[y][x]，true 表示可通行 */
export type WalkabilityGrid = boolean[][];

// ─────────────────────────────────────────────
// 0.1 相邻关系推导（核心层逻辑，仅依赖核心层数据）
// ─────────────────────────────────────────────

/** 4 方向移动偏移：上、下、左、右 */
const DIRECTIONS: ReadonlyArray<readonly [number, number]> = [
  [0, -1],
  [0, 1],
  [-1, 0],
  [1, 0],
] as const;

/** 边界检查 */
function isInBounds(x: number, y: number, cols: number, rows: number): boolean {
  return x >= 0 && x < cols && y >= 0 && y < rows;
}

/**
 * 推导所有城市的相邻关系
 *
 * 从每个地标位置沿可行走网格做BFS，遇到的第一个其他地标即为相邻。
 * 结果保证双向对称：若 A 相邻 B，则 B 也相邻 A。
 *
 * 实现细节：
 * 1. 从 parsedMap.cities 获取所有地标的实际网格坐标
 * 2. 以 walkabilityGrid 为基础，叠加所有地标位置为可行走
 * 3. 对每个地标做BFS，仅收集直接可达（沿道路无其他地标阻挡）的邻居
 * 4. BFS 遇到其他地标时记录为相邻但不继续扩展（避免跨越地标寻路）
 *
 * @param parsedMap - ASCIIMapParser 解析后的地图数据
 * @param grid - 可行走网格（来自 buildWalkabilityGrid）
 * @returns 相邻关系表 Record<string, string[]>
 */
export function deriveAdjacency(parsedMap: ParsedMap, grid: WalkabilityGrid): Record<string, string[]> {
  const rows = grid.length;
  if (rows === 0) return {};
  const cols = grid[0].length;

  // ── 1. 构建中文名→地标ID的反向映射 ──
  const chineseNameToLandmarkId = new Map<string, string>();
  for (const [landmarkId] of Object.entries(LANDMARK_POSITIONS)) {
    const lm = DEFAULT_LANDMARKS.find(l => l.id === landmarkId);
    if (lm) {
      chineseNameToLandmarkId.set(lm.name, landmarkId);
    }
  }
  // 也从 parsedMap.cityMap 建立映射（兼容名称变体）
  for (const [, chineseName] of Object.entries(parsedMap.cityMap)) {
    if (chineseNameToLandmarkId.has(chineseName)) continue;
    for (const lm of DEFAULT_LANDMARKS) {
      if (lm.name.includes(chineseName) || chineseName.includes(lm.name)) {
        chineseNameToLandmarkId.set(chineseName, lm.id);
        break;
      }
    }
  }

  // ── 2. 从 parsedMap.cities 收集所有地标位置 ──
  const landmarkEntries: Array<[string, { x: number; y: number }]> = [];
  const seenIds = new Set<string>();

  for (const city of parsedMap.cities) {
    if (!city.id) continue;
    const landmarkId = chineseNameToLandmarkId.get(city.id);
    if (!landmarkId) continue;
    if (seenIds.has(landmarkId)) continue;
    seenIds.add(landmarkId);
    landmarkEntries.push([landmarkId, { x: city.x, y: city.y }]);
  }

  if (landmarkEntries.length === 0) return {};

  // 地标坐标→ID 映射（用于快速查找）
  const posToId = new Map<string, string>();
  for (const [id, pos] of landmarkEntries) {
    posToId.set(`${pos.x},${pos.y}`, id);
  }

  // ── 3. 构建增强网格：原始可行走 + 所有地标位置 ──
  const augmentedGrid: boolean[][] = [];
  for (let y = 0; y < rows; y++) {
    const row: boolean[] = [];
    for (let x = 0; x < cols; x++) {
      row.push(grid[y]?.[x] ?? false);
    }
    augmentedGrid.push(row);
  }
  for (const [, pos] of landmarkEntries) {
    if (pos.y >= 0 && pos.y < rows && pos.x >= 0 && pos.x < cols) {
      augmentedGrid[pos.y][pos.x] = true;
    }
  }

  // ── 4. 对每个地标做BFS，寻找直接邻居 ──
  const adjacency: Record<string, string[]> = {};

  for (const [startId, startPos] of landmarkEntries) {
    if (!adjacency[startId]) {
      adjacency[startId] = [];
    }

    const queue: Array<{ x: number; y: number }> = [{ x: startPos.x, y: startPos.y }];
    const visited = new Set<string>();
    visited.add(`${startPos.x},${startPos.y}`);

    while (queue.length > 0) {
      const current = queue.shift()!;

      for (const [dx, dy] of DIRECTIONS) {
        const nx = current.x + dx;
        const ny = current.y + dy;
        const key = `${nx},${ny}`;

        if (!isInBounds(nx, ny, cols, rows)) continue;
        if (visited.has(key)) continue;
        if (!augmentedGrid[ny][nx]) continue;

        visited.add(key);

        const neighborId = posToId.get(key);
        if (neighborId && neighborId !== startId) {
          if (!adjacency[startId].includes(neighborId)) {
            adjacency[startId].push(neighborId);
          }
          if (!adjacency[neighborId]) {
            adjacency[neighborId] = [];
          }
          if (!adjacency[neighborId].includes(startId)) {
            adjacency[neighborId].push(startId);
          }
        } else {
          queue.push({ x: nx, y: ny });
        }
      }
    }
  }

  return adjacency;
}

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
// 2. 相邻关系配置（动态推导）
// ─────────────────────────────────────────────

/**
 * 缓存的相邻关系表
 *
 * 由 initializeAdjacency() 调用 deriveAdjacency() 后填充。
 * 初始为空，调用 initializeAdjacency 后方可使用 getAdjacentIds / areAdjacent。
 */
let adjacencyCache: Record<string, string[]> = {};

/**
 * 初始化城市相邻关系
 *
 * 从地图可行走网格推导所有地标（城市/关隘/资源点）的相邻关系，
 * 结果缓存供 getAdjacentIds / areAdjacent / generateTerritoryData 使用。
 *
 * ⚠️ 必须在 generateTerritoryData() 之前调用。
 *
 * @param parsedMap - ASCIIMapParser 解析后的地图数据
 * @param grid - 可行走网格（来自 buildWalkabilityGrid）
 */
export function initializeAdjacency(parsedMap: ParsedMap, grid: WalkabilityGrid): void {
  adjacencyCache = deriveAdjacency(parsedMap, grid);
}

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
 * 从缓存的推导结果读取。需先调用 initializeAdjacency。
 *
 * @param territoryId - 领土ID
 * @returns 相邻领土ID列表
 */
export function getAdjacentIds(territoryId: string): string[] {
  return adjacencyCache[territoryId] ?? [];
}

/**
 * 检查两个领土是否相邻
 *
 * 从缓存的推导结果读取。需先调用 initializeAdjacency。
 *
 * @param id1 - 领土1 ID
 * @param id2 - 领土2 ID
 * @returns 是否相邻
 */
export function areAdjacent(id1: string, id2: string): boolean {
  return (adjacencyCache[id1] ?? []).includes(id2);
}

/**
 * 城防基础值常量
 * ⚠️ PRD MAP-4 统一声明：城防值=基础×类型系数×等级×(1+科技加成)
 */
const BASE_CITY_DEFENSE = 1000;

/** 地标类型→城防系数 */
const DEFENSE_TYPE_FACTOR: Record<string, number> = {
  city: 0.5,       // 城市: 500/级
  pass: 1.0,       // 关隘: 1000/级
  resource: 0.3,   // 资源点: 300/级
};

/**
 * 计算城防基础值（不含科技加成，科技加成由引擎层动态计算）
 *
 * @param level - 城市等级
 * @param type - 地标类型(city/pass/resource)
 * @returns 城防基础值 = 基础 × 类型系数 × 等级
 */
function calculateBaseDefenseValue(level: number, type: string = 'city'): number {
  const factor = DEFENSE_TYPE_FACTOR[type] ?? 0.5;
  return Math.round(BASE_CITY_DEFENSE * factor * level);
}

/**
 * 从 DEFAULT_LANDMARKS 生成初始领土数据
 *
 * 城防值按 PRD 统一声明公式生成：基础(1000) × 类型系数 × 等级
 * 科技加成由 SiegeEnhancer 在运行时动态叠加
 *
 * @returns 所有领土数据列表
 */
export function generateTerritoryData(): TerritoryData[] {
  const landmarks = DEFAULT_LANDMARKS.map((lm) => {
    const pos = LANDMARK_POSITIONS[lm.id];
    const region = pos ? getRegionAtPosition(pos.x, pos.y) : 'wei';
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
      defenseValue: calculateBaseDefenseValue(lm.level, lm.type),
      adjacentIds: getAdjacentIds(lm.id),
    };
  });

  // 在主城(洛阳)周围随机生成1级资源点
  const spawnedResources = spawnResourcesAroundMainCity();
  return [...landmarks, ...spawnedResources];
}

/**
 * 在主城周围随机生成1级资源点
 *
 * 在洛阳(50,23)周围5格范围内随机放置4个资源点：
 * - 粮田(grain)、金矿(gold)、兵营(troops)、天命台(mandate)
 * - 避开水域和已有地标位置
 */
function spawnResourcesAroundMainCity(): TerritoryData[] {
  const mainCity = LANDMARK_POSITIONS['city-luoyang'];
  if (!mainCity) return [];

  const resourceTypes: Array<{ type: string; name: string; icon: string }> = [
    { type: 'grain', name: '洛阳粮田', icon: '🌾' },
    { type: 'gold', name: '洛阳金矿', icon: '💰' },
    { type: 'troops', name: '洛阳兵营', icon: '⚔️' },
    { type: 'mandate', name: '洛阳祭坛', icon: '🌟' },
  ];

  // 已占用的位置
  const occupied = new Set<string>();
  for (const pos of Object.values(LANDMARK_POSITIONS)) {
    occupied.add(`${pos.x},${pos.y}`);
  }

  const results: TerritoryData[] = [];
  const offsets = [
    { dx: -3, dy: -2 }, { dx: 3, dy: -1 },
    { dx: -2, dy: 3 },  { dx: 2, dy: 2 },
  ];

  for (let i = 0; i < resourceTypes.length; i++) {
    const rt = resourceTypes[i];
    const offset = offsets[i];
    const x = mainCity.x + offset.dx;
    const y = mainCity.y + offset.dy;
    const key = `${x},${y}`;

    // 跳过已占用位置
    if (occupied.has(key)) continue;
    occupied.add(key);

    const baseProd = getBaseProduction('resource', rt.type);
    const currentProd = calculateProduction(baseProd, 1);

    results.push({
      id: `res-spawn-${rt.type}`,
      name: rt.name,
      position: { x, y },
      region: getRegionAtPosition(x, y) as RegionId,
      ownership: 'player' as OwnershipStatus,
      level: 1,
      baseProduction: baseProd,
      currentProduction: currentProd,
      defenseValue: calculateBaseDefenseValue(1, 'resource'),
      adjacentIds: [],
    });
  }

  return results;
}

/** 领土存档版本 */
export const TERRITORY_SAVE_VERSION = 1;
