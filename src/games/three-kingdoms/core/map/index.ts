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
  initializeAdjacency,
  generateTerritoryData,
  deriveAdjacency,
  TERRITORY_SAVE_VERSION,
} from './territory-config';

export type {
  WalkabilityGrid,
} from './territory-config';

// 驻防系统类型与配置
export type {
  GarrisonAssignment,
  GarrisonBonus,
  GarrisonErrorCode,
  GarrisonResult,
  UngarrisonResult,
  GarrisonState,
  GarrisonSaveData,
} from './garrison.types';

export {
  QUALITY_PRODUCTION_BONUS,
  DEFENSE_BONUS_FACTOR,
  GARRISON_SAVE_VERSION,
} from './garrison.types';

// 攻城增强类型与配置
export type {
  WinRateEstimate,
  BattleRating,
  SiegeReward,
  SiegeRewardItem,
  ConquestPhase,
  ConquestResult,
  SiegeEnhancerSaveData,
} from './siege-enhancer.types';

export {
  BATTLE_RATING_THRESHOLDS,
  SIEGE_REWARD_CONFIG,
  SIEGE_ENHANCER_SAVE_VERSION,
} from './siege-enhancer.types';
