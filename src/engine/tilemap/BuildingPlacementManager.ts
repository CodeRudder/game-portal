/**
 * 建筑放置管理器
 *
 * 管理建筑在地图上的放置、校验、升级和移除。
 * 支持多尺寸建筑（1x1, 2x2, 3x3）、地形兼容性校验、
 * 建筑等级可视化和空间占用管理。
 *
 * @module engine/tilemap/BuildingPlacementManager
 */

import { BiomeType, BIOME_CONFIGS, isBiomeBuildable } from './BiomeConfig';
import type { TileMapData, PlacedBuilding, BuildingDef, Tile } from './types';

// ---------------------------------------------------------------------------
// 放置校验结果
// ---------------------------------------------------------------------------

/** 放置校验结果 */
export interface PlacementResult {
  /** 是否可以放置 */
  canPlace: boolean;
  /** 失败原因（canPlace=false 时有值） */
  reason?: string;
}

// ---------------------------------------------------------------------------
// 建筑等级可视化配置
// ---------------------------------------------------------------------------

/** 等级视觉配置 */
export interface LevelVisualConfig {
  /** 等级 */
  level: number;
  /** 颜色 */
  color: string;
  /** 边框颜色 */
  borderColor: string;
  /** 大小缩放（0~1，相对建筑尺寸） */
  scale: number;
  /** 装饰标记（如星号数量） */
  stars: number;
}

/** 默认等级视觉配置表 */
export const LEVEL_VISUALS: LevelVisualConfig[] = [
  { level: 1, color: '#8B8682', borderColor: '#555555', scale: 0.7, stars: 0 },
  { level: 2, color: '#4CAF50', borderColor: '#2E7D32', scale: 0.8, stars: 1 },
  { level: 3, color: '#2196F3', borderColor: '#1565C0', scale: 0.9, stars: 2 },
  { level: 4, color: '#9C27B0', borderColor: '#6A1B9A', scale: 0.95, stars: 3 },
  { level: 5, color: '#FFD700', borderColor: '#FF8F00', scale: 1.0, stars: 4 },
];

/** 获取指定等级的视觉配置 */
export function getLevelVisual(level: number): LevelVisualConfig {
  const idx = Math.min(level, LEVEL_VISUALS.length) - 1;
  return LEVEL_VISUALS[Math.max(0, idx)];
}

// ---------------------------------------------------------------------------
// 建筑兼容性表
// ---------------------------------------------------------------------------

/** 建筑-Biome 兼容性映射（哪些地形可以放哪些建筑） */
const BUILDING_BIOME_COMPATIBILITY: Record<string, BiomeType[]> = {
  // 通用建筑：可在平原和沙漠建造
  house: [BiomeType.PLAINS, BiomeType.DESERT],
  farm: [BiomeType.PLAINS],
  market: [BiomeType.PLAINS, BiomeType.DESERT],
  barracks: [BiomeType.PLAINS, BiomeType.DESERT, BiomeType.SNOW],
  tower: [BiomeType.PLAINS, BiomeType.DESERT, BiomeType.MOUNTAIN],
  wall: [BiomeType.PLAINS, BiomeType.DESERT, BiomeType.SNOW],
  temple: [BiomeType.PLAINS, BiomeType.DESERT, BiomeType.FOREST],
  palace: [BiomeType.PLAINS, BiomeType.DESERT],
  // 特殊建筑
  pyramid: [BiomeType.DESERT],
  pagoda: [BiomeType.PLAINS, BiomeType.FOREST],
  ziggurat: [BiomeType.DESERT],
  shrine: [BiomeType.FOREST, BiomeType.SNOW, BiomeType.VOLCANIC],
};

// ---------------------------------------------------------------------------
// BuildingPlacementManager
// ---------------------------------------------------------------------------

export class BuildingPlacementManager {
  private mapData: TileMapData | null = null;
  /** 已注册的建筑定义 */
  private buildingDefs: Map<string, BuildingDef> = new Map();
  /** 已占用的格子集合（"x,y" 格式） */
  private occupiedCells: Set<string> = new Set();
  /** 建筑 Biome 兼容性覆盖（可选） */
  private biomeMap: Map<string, BiomeType> = new Map();

  constructor() {}

  // -----------------------------------------------------------------------
  // 初始化
  // -----------------------------------------------------------------------

  /**
   * 设置地图数据
   *
   * @param data 地图数据
   * @param biomeMap 可选的 Biome 类型映射（tile key → BiomeType）
   */
  setMapData(data: TileMapData, biomeMap?: Map<string, BiomeType>): void {
    this.mapData = data;
    this.biomeMap = biomeMap ?? new Map();
    this.rebuildOccupiedCells();
  }

  /** 注册建筑定义 */
  registerBuildingDefs(defs: BuildingDef[]): void {
    for (const def of defs) {
      this.buildingDefs.set(def.id, def);
    }
  }

  /** 重建占用格子集合 */
  private rebuildOccupiedCells(): void {
    this.occupiedCells.clear();
    if (!this.mapData) return;

    for (const bld of this.mapData.buildings) {
      const def = this.buildingDefs.get(bld.defId);
      const w = def?.size.w ?? 1;
      const h = def?.size.h ?? 1;

      for (let dy = 0; dy < h; dy++) {
        for (let dx = 0; dx < w; dx++) {
          this.occupiedCells.add(`${bld.x + dx},${bld.y + dy}`);
        }
      }
    }
  }

  // -----------------------------------------------------------------------
  // 放置校验
  // -----------------------------------------------------------------------

  /**
   * 检查建筑是否可以放置在指定位置
   *
   * @param defId 建筑 Def ID
   * @param x 左上角 X
   * @param y 左上角 Y
   * @returns 校验结果
   */
  canPlace(defId: string, x: number, y: number): PlacementResult {
    if (!this.mapData) {
      return { canPlace: false, reason: '地图数据未设置' };
    }

    const def = this.buildingDefs.get(defId);
    if (!def) {
      return { canPlace: false, reason: `建筑定义 ${defId} 不存在` };
    }

    const { w, h } = def.size;

    // 边界检查
    if (x < 0 || y < 0 || x + w > this.mapData.width || y + h > this.mapData.height) {
      return { canPlace: false, reason: '超出地图边界' };
    }

    // 逐格检查
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        const tx = x + dx;
        const ty = y + dy;
        const tile = this.mapData.tiles[ty]?.[tx];

        if (!tile) {
          return { canPlace: false, reason: `瓦片 (${tx},${ty}) 不存在` };
        }

        // 地形兼容性检查
        const biomeKey = `${tx},${ty}`;
        const biome = this.biomeMap.get(biomeKey);
        if (biome) {
          if (!isBiomeBuildable(biome)) {
            return {
              canPlace: false,
              reason: `地形 ${BIOME_CONFIGS[biome].name} 不可建造`,
            };
          }

          // 建筑类型兼容性
          const compatBiomes = BUILDING_BIOME_COMPATIBILITY[defId];
          if (compatBiomes && !compatBiomes.includes(biome)) {
            return {
              canPlace: false,
              reason: `${def.name} 不能建造在 ${BIOME_CONFIGS[biome].name} 上`,
            };
          }
        } else {
          // 无 Biome 信息时，使用 tile 原始 terrain 检查
          if (!this.isTerrainBuildable(tile)) {
            return {
              canPlace: false,
              reason: `地形 ${tile.terrain} 不可建造`,
            };
          }
        }

        // 空间占用检查
        if (this.occupiedCells.has(`${tx},${ty}`)) {
          return {
            canPlace: false,
            reason: `瓦片 (${tx},${ty}) 已被占用`,
          };
        }
      }
    }

    return { canPlace: true };
  }

  /** 检查瓦片地形是否可建造（无 Biome 信息时的 fallback） */
  private isTerrainBuildable(tile: Tile): boolean {
    const nonBuildableTerrains = ['water', 'mountain', 'road', 'bridge'];
    return !nonBuildableTerrains.includes(tile.terrain);
  }

  // -----------------------------------------------------------------------
  // 放置操作
  // -----------------------------------------------------------------------

  /**
   * 放置建筑
   *
   * @param defId 建筑 Def ID
   * @param x 左上角 X
   * @param y 左上角 Y
   * @param level 初始等级（默认 1）
   * @returns 放置的建筑实例，或 null（放置失败）
   */
  place(defId: string, x: number, y: number, level: number = 1): PlacedBuilding | null {
    const result = this.canPlace(defId, x, y);
    if (!result.canPlace) return null;

    if (!this.mapData) return null;

    const def = this.buildingDefs.get(defId);
    if (!def) return null;

    const id = `bld_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const building: PlacedBuilding = {
      id,
      defId,
      x,
      y,
      level,
      state: 'building',
      buildProgress: 0,
    };

    // 标记占用
    const { w, h } = def.size;
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        const key = `${x + dx},${y + dy}`;
        this.occupiedCells.add(key);
        // 在 tile 上标记建筑 ID
        const tile = this.mapData.tiles[y + dy]?.[x + dx];
        if (tile) {
          tile.buildingId = id;
        }
      }
    }

    this.mapData.buildings.push(building);
    return building;
  }

  /**
   * 移除建筑
   *
   * @param buildingId 建筑 ID
   * @returns 是否成功移除
   */
  remove(buildingId: string): boolean {
    if (!this.mapData) return false;

    const idx = this.mapData.buildings.findIndex((b) => b.id === buildingId);
    if (idx < 0) return false;

    const bld = this.mapData.buildings[idx];
    const def = this.buildingDefs.get(bld.defId);
    const w = def?.size.w ?? 1;
    const h = def?.size.h ?? 1;

    // 释放占用格子
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        const key = `${bld.x + dx},${bld.y + dy}`;
        this.occupiedCells.delete(key);
        const tile = this.mapData.tiles[bld.y + dy]?.[bld.x + dx];
        if (tile) {
          tile.buildingId = undefined;
        }
      }
    }

    this.mapData.buildings.splice(idx, 1);
    return true;
  }

  // -----------------------------------------------------------------------
  // 建筑升级
  // -----------------------------------------------------------------------

  /**
   * 升级建筑等级
   *
   * @param buildingId 建筑 ID
   * @param maxLevel 最大等级限制
   * @returns 升级后的等级，或 -1（升级失败）
   */
  upgrade(buildingId: string, maxLevel: number = 5): number {
    if (!this.mapData) return -1;

    const bld = this.mapData.buildings.find((b) => b.id === buildingId);
    if (!bld) return -1;

    if (bld.level >= maxLevel) return -1;

    bld.level++;
    return bld.level;
  }

  // -----------------------------------------------------------------------
  // 查询
  // -----------------------------------------------------------------------

  /**
   * 获取指定位置的建筑物
   *
   * @param x 瓦片 X
   * @param y 瓦片 Y
   * @returns 建筑实例或 undefined
   */
  getBuildingAt(x: number, y: number): PlacedBuilding | undefined {
    if (!this.mapData) return undefined;

    for (const bld of this.mapData.buildings) {
      const def = this.buildingDefs.get(bld.defId);
      const w = def?.size.w ?? 1;
      const h = def?.size.h ?? 1;

      if (x >= bld.x && x < bld.x + w && y >= bld.y && y < bld.y + h) {
        return bld;
      }
    }

    return undefined;
  }

  /**
   * 获取所有已放置的建筑
   */
  getAllBuildings(): PlacedBuilding[] {
    return this.mapData?.buildings ?? [];
  }

  /**
   * 检查指定格子是否被占用
   */
  isOccupied(x: number, y: number): boolean {
    return this.occupiedCells.has(`${x},${y}`);
  }

  /**
   * 获取指定建筑的等级视觉配置
   */
  getBuildingVisual(buildingId: string): LevelVisualConfig | null {
    if (!this.mapData) return null;

    const bld = this.mapData.buildings.find((b) => b.id === buildingId);
    if (!bld) return null;

    return getLevelVisual(bld.level);
  }

  /**
   * 更新建筑状态
   */
  setBuildingState(buildingId: string, state: PlacedBuilding['state']): boolean {
    if (!this.mapData) return false;

    const bld = this.mapData.buildings.find((b) => b.id === buildingId);
    if (!bld) return false;

    bld.state = state;
    return true;
  }

  /**
   * 更新建造进度
   */
  setBuildProgress(buildingId: string, progress: number): boolean {
    if (!this.mapData) return false;

    const bld = this.mapData.buildings.find((b) => b.id === buildingId);
    if (!bld) return false;

    bld.buildProgress = Math.max(0, Math.min(1, progress));
    if (bld.buildProgress >= 1) {
      bld.state = 'active';
    }
    return true;
  }
}
