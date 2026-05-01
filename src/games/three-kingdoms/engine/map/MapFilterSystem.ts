/**
 * 引擎层 — 地图筛选系统
 *
 * 提供按区域/地形/占领状态/地标类型的筛选功能。
 * 纯函数式设计，无副作用，方便组合和测试。
 *
 * 职责：
 *   - 按区域筛选格子
 *   - 按地形筛选格子
 *   - 按占领状态筛选地标
 *   - 组合筛选（多条件叠加）
 *   - 筛选结果统计
 *
 * @module engine/map/MapFilterSystem
 */

import type {
  TileData,
  LandmarkData,
  LandmarkType,
  MapFilterCriteria,
  MapFilterResult,
  OwnershipStatus,
  RegionId,
  TerrainType,
} from '../../core/map';
import type { ISubsystem, ISystemDeps } from '../../core/types';

// ─────────────────────────────────────────────
// 地图筛选系统
// ─────────────────────────────────────────────

/**
 * 地图筛选系统
 *
 * 提供静态筛选方法，无需实例化。
 * 所有方法为纯函数，不修改输入数据。
 *
 * @example
 * ```ts
 * const result = MapFilterSystem.filter(allTiles, allLandmarks, {
 *   regions: ['wei'],
 *   terrains: ['plain'],
 *   ownerships: ['player'],
 * });
 * ```
 */
export class MapFilterSystem implements ISubsystem {
  readonly name = 'mapFilter' as const;
  private deps!: ISystemDeps;

  // ─── ISubsystem 接口 ───────────────────────

  init(deps: ISystemDeps): void { this.deps = deps; }
  update(_dt: number): void { /* 纯筛选系统，无帧更新逻辑 */ }
  getState(): unknown { return { name: this.name }; }
  reset(): void { /* 无状态，无需重置 */ }

  /**
   * 综合筛选
   *
   * 根据筛选条件过滤格子和地标，支持多条件叠加。
   * 空数组或 undefined 表示不筛选该维度。
   *
   * @param tiles - 全部格子数据
   * @param landmarks - 全部地标数据
   * @param criteria - 筛选条件
   * @returns 筛选结果
   */
  static filter(
    tiles: TileData[],
    landmarks: LandmarkData[],
    criteria: MapFilterCriteria,
  ): MapFilterResult {
    // FIX-709: null防护
    tiles = tiles ?? [];
    landmarks = landmarks ?? [];
    criteria = criteria ?? {};
    let filteredTiles = tiles;
    let filteredLandmarks = landmarks;

    // 按区域筛选
    if (criteria.regions && criteria.regions.length > 0) {
      const regionSet = new Set(criteria.regions);
      filteredTiles = filteredTiles.filter(t => regionSet.has(t.region));
    }

    // 按地形筛选
    if (criteria.terrains && criteria.terrains.length > 0) {
      const terrainSet = new Set(criteria.terrains);
      filteredTiles = filteredTiles.filter(t => terrainSet.has(t.terrain));
    }

    // 按占领状态筛选（基于地标）
    if (criteria.ownerships && criteria.ownerships.length > 0) {
      const ownershipSet = new Set(criteria.ownerships);
      filteredLandmarks = filteredLandmarks.filter(l => ownershipSet.has(l.ownership));
    }

    // 按地标类型筛选
    if (criteria.landmarkTypes && criteria.landmarkTypes.length > 0) {
      const typeSet = new Set(criteria.landmarkTypes);
      filteredLandmarks = filteredLandmarks.filter(l => typeSet.has(l.type));
    }

    return {
      tiles: filteredTiles,
      landmarks: filteredLandmarks,
      totalTiles: filteredTiles.length,
      totalLandmarks: filteredLandmarks.length,
    };
  }

  /**
   * 按区域筛选格子
   *
   * @param tiles - 全部格子数据
   * @param regions - 区域ID列表
   * @returns 匹配的格子
   */
  static filterByRegion(tiles: TileData[], regions: RegionId[]): TileData[] {
    if (regions.length === 0) return tiles;
    const regionSet = new Set(regions);
    return tiles.filter(t => regionSet.has(t.region));
  }

  /**
   * 按地形筛选格子
   *
   * @param tiles - 全部格子数据
   * @param terrains - 地形类型列表
   * @returns 匹配的格子
   */
  static filterByTerrain(tiles: TileData[], terrains: TerrainType[]): TileData[] {
    if (terrains.length === 0) return tiles;
    const terrainSet = new Set(terrains);
    return tiles.filter(t => terrainSet.has(t.terrain));
  }

  /**
   * 按占领状态筛选地标
   *
   * @param landmarks - 全部地标数据
   * @param ownerships - 占领状态列表
   * @returns 匹配的地标
   */
  static filterByOwnership(
    landmarks: LandmarkData[],
    ownerships: OwnershipStatus[],
  ): LandmarkData[] {
    if (ownerships.length === 0) return landmarks;
    const ownershipSet = new Set(ownerships);
    return landmarks.filter(l => ownershipSet.has(l.ownership));
  }

  /**
   * 按地标类型筛选
   *
   * @param landmarks - 全部地标数据
   * @param types - 地标类型列表
   * @returns 匹配的地标
   */
  static filterByLandmarkType(
    landmarks: LandmarkData[],
    types: LandmarkType[],
  ): LandmarkData[] {
    if (types.length === 0) return landmarks;
    const typeSet = new Set(types);
    return landmarks.filter(l => typeSet.has(l.type));
  }

  /**
   * 获取含地标的格子
   *
   * @param tiles - 全部格子数据
   * @returns 含地标的格子
   */
  static getTilesWithLandmarks(tiles: TileData[]): TileData[] {
    return tiles.filter(t => t.landmark !== undefined);
  }

  /**
   * 获取不含地标的格子
   *
   * @param tiles - 全部格子数据
   * @returns 不含地标的格子
   */
  static getTilesWithoutLandmarks(tiles: TileData[]): TileData[] {
    return tiles.filter(t => t.landmark === undefined);
  }

  /**
   * 统计各区域格子数量
   *
   * @param tiles - 全部格子数据
   * @returns 区域→数量映射
   */
  static countByRegion(tiles: TileData[]): Record<RegionId, number> {
    const counts: Record<RegionId, number> = {
      wei: 0,
      wu: 0,
      shu: 0,
      neutral: 0,
    };
    for (const tile of tiles) {
      counts[tile.region]++;
    }
    return counts;
  }

  /**
   * 统计各地形格子数量
   *
   * @param tiles - 全部格子数据
   * @returns 地形→数量映射
   */
  static countByTerrain(tiles: TileData[]): Record<TerrainType, number> {
    const counts: Record<TerrainType, number> = {
      plain: 0,
      mountain: 0,
      water: 0,
      forest: 0,
      pass: 0,
      city: 0,
    };
    for (const tile of tiles) {
      counts[tile.terrain]++;
    }
    return counts;
  }

  /**
   * 统计各占领状态地标数量
   *
   * @param landmarks - 全部地标数据
   * @returns 状态→数量映射
   */
  static countByOwnership(landmarks: LandmarkData[]): Record<OwnershipStatus, number> {
    const counts: Record<OwnershipStatus, number> = {
      player: 0,
      enemy: 0,
      neutral: 0,
    };
    for (const landmark of landmarks) {
      counts[landmark.ownership]++;
    }
    return counts;
  }
}
