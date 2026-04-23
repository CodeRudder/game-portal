/**
 * 引擎层 — 世界地图系统
 *
 * 管理世界地图的核心业务逻辑：区域管理、地形管理、地标管理、视口控制。
 * 实现 ISubsystem 接口，可注册到引擎子系统中统一管理。
 *
 * 职责：
 *   - 地图初始化和格子数据管理
 *   - 区域查询（按坐标获取区域）
 *   - 地形查询（按坐标获取地形）
 *   - 地标管理（增删改查、归属变更）
 *   - 视口状态管理（平移、缩放）
 *   - 存档序列化/反序列化
 *
 * @module engine/map/WorldMapSystem
 */

import type { ISubsystem, ISystemDeps } from '../../core/types';
import type {
  GridPosition,
  MapSize,
  ViewportState,
  RegionId,
  RegionDef,
  TerrainType,
  TerrainDef,
  TileData,
  LandmarkData,
  LandmarkType,
  OwnershipStatus,
  LandmarkLevel,
  WorldMapState,
  WorldMapSaveData,
} from '../../core/map';
import {
  MAP_SIZE,
  VIEWPORT_CONFIG,
  REGION_IDS,
  REGION_DEFS,
  TERRAIN_DEFS,
  DEFAULT_LANDMARKS,
  LANDMARK_POSITIONS,
  MAP_SAVE_VERSION,
  generateAllTiles,
} from '../../core/map';

// ─────────────────────────────────────────────
// 世界地图系统
// ─────────────────────────────────────────────

/**
 * 世界地图系统
 *
 * 管理世界地图的完整生命周期，提供区域、地形、地标的查询和管理能力。
 *
 * @example
 * ```ts
 * const mapSystem = new WorldMapSystem();
 * mapSystem.init(deps);
 *
 * // 查询区域
 * const region = mapSystem.getRegionAt({ x: 30, y: 10 });
 *
 * // 查询地形
 * const terrain = mapSystem.getTerrainAt({ x: 30, y: 10 });
 *
 * // 获取地标
 * const landmarks = mapSystem.getLandmarksByType('city');
 * ```
 */
export class WorldMapSystem implements ISubsystem {
  readonly name = 'worldMap';

  private deps!: ISystemDeps;
  private tiles: TileData[] = [];
  private landmarkMap: Map<string, LandmarkData> = new Map();
  private viewport: ViewportState = {
    offsetX: 0,
    offsetY: 0,
    zoom: VIEWPORT_CONFIG.defaultZoom,
  };

  // ─── ISubsystem 接口 ───────────────────────

  /** 初始化世界地图系统 */
  init(deps: ISystemDeps): void {
    this.deps = deps;
    this.tiles = generateAllTiles();
    this.initLandmarks();
  }

  /** 每帧更新（预留） */
  update(_dt: number): void {
    // 预留：后续版本用于动画/产出气泡更新
  }

  /** 获取系统状态快照 */
  getState(): WorldMapState {
    return {
      size: { ...MAP_SIZE },
      tiles: this.tiles.map(t => ({ ...t, landmark: t.landmark ? { ...t.landmark } : undefined })),
      landmarks: this.getLandmarks(),
      viewport: { ...this.viewport },
      filter: {},
    };
  }

  /** 重置到初始状态 */
  reset(): void {
    this.tiles = generateAllTiles();
    this.initLandmarks();
    this.viewport = {
      offsetX: 0,
      offsetY: 0,
      zoom: VIEWPORT_CONFIG.defaultZoom,
    };
  }

  // ─── 地图基础参数（#9）──────────────────────

  /** 获取地图尺寸 */
  getSize(): MapSize {
    return { ...MAP_SIZE };
  }

  /** 获取总格子数 */
  getTotalTiles(): number {
    return MAP_SIZE.cols * MAP_SIZE.rows;
  }

  /** 判断坐标是否在地图范围内 */
  isValidPosition(pos: GridPosition): boolean {
    return pos.x >= 0 && pos.x < MAP_SIZE.cols && pos.y >= 0 && pos.y < MAP_SIZE.rows;
  }

  /** 获取指定坐标的格子数据 */
  getTileAt(pos: GridPosition): TileData | null {
    if (!this.isValidPosition(pos)) return null;
    const index = pos.y * MAP_SIZE.cols + pos.x;
    return this.tiles[index] ?? null;
  }

  /** 获取所有格子数据（只读副本） */
  getAllTiles(): TileData[] {
    return this.tiles.map(t => ({ ...t, landmark: t.landmark ? { ...t.landmark } : undefined }));
  }

  // ─── 三大区域划分（#10）──────────────────────

  /** 获取所有区域定义（仅魏蜀吴三大区域，不含 neutral） */
  getRegions(): RegionDef[] {
    return REGION_IDS.map(id => ({ ...REGION_DEFS[id] }));
  }

  /** 获取指定坐标的区域 */
  getRegionAt(pos: GridPosition): RegionDef | null {
    const tile = this.getTileAt(pos);
    if (!tile) return null;
    return { ...REGION_DEFS[tile.region] };
  }

  /** 获取指定区域的所有格子 */
  getTilesByRegion(regionId: RegionId): TileData[] {
    return this.tiles
      .filter(t => t.region === regionId)
      .map(t => ({ ...t, landmark: t.landmark ? { ...t.landmark } : undefined }));
  }

  /** 获取区域格子数量 */
  getRegionTileCount(regionId: RegionId): number {
    return this.tiles.filter(t => t.region === regionId).length;
  }

  // ─── 地形类型（#11）──────────────────────────

  /** 获取所有地形定义 */
  getTerrains(): TerrainDef[] {
    return Object.values(TERRAIN_DEFS).map(t => ({ ...t }));
  }

  /** 获取指定坐标的地形 */
  getTerrainAt(pos: GridPosition): TerrainDef | null {
    const tile = this.getTileAt(pos);
    if (!tile) return null;
    return { ...TERRAIN_DEFS[tile.terrain] };
  }

  /** 获取指定地形的格子列表 */
  getTilesByTerrain(terrain: TerrainType): TileData[] {
    return this.tiles
      .filter(t => t.terrain === terrain)
      .map(t => ({ ...t, landmark: t.landmark ? { ...t.landmark } : undefined }));
  }

  /** 获取地形格子数量 */
  getTerrainTileCount(terrain: TerrainType): number {
    return this.tiles.filter(t => t.terrain === terrain).length;
  }

  // ─── 特殊地标（#12）──────────────────────────

  /** 获取所有地标 */
  getLandmarks(): LandmarkData[] {
    return Array.from(this.landmarkMap.values()).map(l => ({ ...l }));
  }

  /** 按类型获取地标 */
  getLandmarksByType(type: LandmarkType): LandmarkData[] {
    return this.getLandmarks().filter(l => l.type === type);
  }

  /** 按归属获取地标 */
  getLandmarksByOwnership(ownership: OwnershipStatus): LandmarkData[] {
    return this.getLandmarks().filter(l => l.ownership === ownership);
  }

  /** 按ID获取地标 */
  getLandmarkById(id: string): LandmarkData | null {
    const landmark = this.landmarkMap.get(id);
    return landmark ? { ...landmark } : null;
  }

  /** 获取指定坐标的地标 */
  getLandmarkAt(pos: GridPosition): LandmarkData | null {
    for (const [id, landmark] of this.landmarkMap) {
      const landmarkPos = LANDMARK_POSITIONS[id];
      if (landmarkPos && landmarkPos.x === pos.x && landmarkPos.y === pos.y) {
        return { ...landmark };
      }
    }
    return null;
  }

  /** 更新地标归属 */
  setLandmarkOwnership(id: string, ownership: OwnershipStatus): boolean {
    const landmark = this.landmarkMap.get(id);
    if (!landmark) return false;
    landmark.ownership = ownership;

    // 同步到 tiles 数据
    this.syncLandmarkToTiles(id, landmark);
    return true;
  }

  /** 升级地标等级 */
  upgradeLandmark(id: string): boolean {
    const landmark = this.landmarkMap.get(id);
    if (!landmark || landmark.level >= 5) return false;
    landmark.level = (landmark.level + 1) as LandmarkLevel;
    landmark.productionMultiplier += 0.2;

    this.syncLandmarkToTiles(id, landmark);
    return true;
  }

  /** 获取玩家占领的地标数量 */
  getPlayerLandmarkCount(): number {
    return this.getLandmarksByOwnership('player').length;
  }

  /** 获取地标总数 */
  getTotalLandmarkCount(): number {
    return this.landmarkMap.size;
  }

  // ─── 视口控制（#13）──────────────────────────

  /** 获取视口状态 */
  getViewport(): ViewportState {
    return { ...this.viewport };
  }

  /** 设置视口偏移 */
  setViewportOffset(x: number, y: number): void {
    this.viewport.offsetX = x;
    this.viewport.offsetY = y;
  }

  /** 平移视口 */
  panViewport(dx: number, dy: number): void {
    this.viewport.offsetX += dx;
    this.viewport.offsetY += dy;
  }

  /** 设置缩放 */
  setZoom(zoom: number): void {
    const clamped = Math.max(VIEWPORT_CONFIG.minZoom, Math.min(VIEWPORT_CONFIG.maxZoom, zoom));
    this.viewport.zoom = clamped;
  }

  /** 缩放视口 */
  zoomViewport(delta: number): void {
    this.setZoom(this.viewport.zoom + delta);
  }

  /** 重置视口 */
  resetViewport(): void {
    this.viewport = {
      offsetX: 0,
      offsetY: 0,
      zoom: VIEWPORT_CONFIG.defaultZoom,
    };
  }

  // ─── 存档 ────────────────────────────────────

  /** 序列化为存档数据 */
  serialize(): WorldMapSaveData {
    const landmarkOwnerships: Record<string, OwnershipStatus> = {};
    const landmarkLevels: Record<string, LandmarkLevel> = {};

    for (const [id, landmark] of this.landmarkMap) {
      landmarkOwnerships[id] = landmark.ownership;
      landmarkLevels[id] = landmark.level;
    }

    return {
      landmarkOwnerships,
      landmarkLevels,
      viewport: { ...this.viewport },
      version: MAP_SAVE_VERSION,
    };
  }

  /** 从存档数据恢复 */
  deserialize(data: WorldMapSaveData): void {
    // 恢复地标状态
    for (const [id, ownership] of Object.entries(data.landmarkOwnerships)) {
      const landmark = this.landmarkMap.get(id);
      if (landmark) {
        landmark.ownership = ownership;
      }
    }
    for (const [id, level] of Object.entries(data.landmarkLevels)) {
      const landmark = this.landmarkMap.get(id);
      if (landmark) {
        landmark.level = level;
        // 重新计算产出倍率
        const original = DEFAULT_LANDMARKS.find(l => l.id === id);
        if (original) {
          landmark.productionMultiplier = original.productionMultiplier + (level - original.level) * 0.2;
        }
      }
    }

    // 恢复视口
    if (data.viewport) {
      this.viewport = { ...data.viewport };
    }

    // 同步到 tiles
    this.syncAllLandmarksToTiles();
  }

  // ─── 内部方法 ────────────────────────────────

  /** 初始化地标映射 */
  private initLandmarks(): void {
    this.landmarkMap.clear();
    for (const landmark of DEFAULT_LANDMARKS) {
      this.landmarkMap.set(landmark.id, { ...landmark });
    }
  }

  /** 同步单个地标到 tiles 数据 */
  private syncLandmarkToTiles(id: string, landmark: LandmarkData): void {
    const pos = LANDMARK_POSITIONS[id];
    if (!pos) return;
    const index = pos.y * MAP_SIZE.cols + pos.x;
    if (index >= 0 && index < this.tiles.length) {
      this.tiles[index].landmark = { ...landmark };
    }
  }

  /** 同步所有地标到 tiles 数据 */
  private syncAllLandmarksToTiles(): void {
    for (const [id, landmark] of this.landmarkMap) {
      this.syncLandmarkToTiles(id, landmark);
    }
  }
}
