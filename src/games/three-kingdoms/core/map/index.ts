/**
 * 核心层 — 世界地图模块统一导出
 *
 * @module core/map
 */

export type {
  GridPosition,
  MapSize,
  GridConfig,
  ViewportConfig,
  ViewportState,
  RegionId,
  RegionDef,
  RegionBounds,
  TerrainType,
  TerrainDef,
  TileData,
  LandmarkType,
  LandmarkLevel,
  OwnershipStatus,
  ResourceNodeType,
  LandmarkData,
  MapFilterCriteria,
  MapFilterResult,
  RenderLayer,
  TileRenderData,
  ViewportRenderData,
  WorldMapState,
  WorldMapSaveData,
} from './world-map.types';

export {
  MAP_SIZE,
  GRID_CONFIG,
  VIEWPORT_CONFIG,
  MAP_PIXEL_SIZE,
  REGION_IDS,
  REGION_DEFS,
  REGION_LABELS,
  REGION_COLORS,
  TERRAIN_TYPES,
  TERRAIN_DEFS,
  TERRAIN_LABELS,
  TERRAIN_COLORS,
  DEFAULT_LANDMARKS,
  LANDMARK_POSITIONS,
  MAP_SAVE_VERSION,
  getRegionAtPosition,
  getTerrainAtPosition,
  generateAllTiles,
} from './map-config';

// 领土系统类型与配置
export type {
  TerritoryProduction,
  TerritoryData,
  TerritoryUpgradeCost,
  TerritoryUpgradeResult,
  TerritoryProductionSummary,
  TerritoryState,
  TerritorySaveData,
} from './territory.types';

export {
  getBaseProduction,
  calculateProduction,
  calculateUpgradeCost,
  getAdjacentIds,
  areAdjacent,
  generateTerritoryData,
  TERRITORY_SAVE_VERSION,
} from './territory-config';
