/**
 * 引擎层 — 统一导出入口
 */

export { ThreeKingdomsEngine } from './ThreeKingdomsEngine';

// 资源域
export { ResourceSystem } from './resource/ResourceSystem';
export type {
  BonusType,
  Bonus,
  ResourceType,
  Resources,
  ProductionRate,
  ResourceCap,
  ResourceCost,
  CostCheckResult,
  CapWarning,
  CapWarningLevel,
  Bonuses,
  OfflineEarnings,
  OfflineTierBreakdown,
  ResourceSaveData,
} from './resource/resource.types';
export {
  RESOURCE_TYPES,
  RESOURCE_LABELS,
  RESOURCE_COLORS,
} from './resource/resource.types';

// 建筑域
export { BuildingSystem } from './building/BuildingSystem';
export type {
  BuildingType,
  BuildingState,
  BuildingDef,
  UpgradeCost,
  UpgradeCheckResult,
  QueueSlot,
  BuildingSaveData,
} from './building/building.types';
export {
  BUILDING_TYPES,
  BUILDING_LABELS,
  BUILDING_ICONS,
  BUILDING_ZONES,
} from './building/building.types';

// 日历域
export { CalendarSystem } from './calendar/CalendarSystem';
export type {
  Season,
  WeatherType,
  EraEntry,
  GameDate,
  SeasonBonus,
  CalendarState,
  CalendarSaveData,
} from './calendar/calendar.types';
export {
  SEASONS,
  SEASON_LABELS,
  WEATHERS,
  WEATHER_LABELS,
} from './calendar/calendar.types';

// 武将域
export { HeroSystem } from './hero/HeroSystem';
export { HeroRecruitSystem } from './hero/HeroRecruitSystem';
export type {
  GeneralStats,
  GeneralData,
  HeroState,
  HeroSaveData,
  SkillData,
  Faction,
} from './hero/hero.types';
export {
  Quality,
  QUALITY_ORDER,
  QUALITY_TIERS,
  QUALITY_LABELS,
  QUALITY_BORDER_COLORS,
  FACTION_LABELS,
  FACTIONS,
} from './hero/hero.types';
export { HERO_MAX_LEVEL, GENERAL_DEF_MAP } from './hero/hero-config';
export type { RecruitType } from './hero/hero-recruit-config';
export { HeroFormation, MAX_FORMATIONS, MAX_SLOTS_PER_FORMATION } from './hero/HeroFormation';
export type {
  FormationData,
  FormationState,
  FormationSaveData,
} from './hero/HeroFormation';
export type {
  EnhancePreview,
  LevelUpResult,
  BatchEnhanceResult,
  LevelSaveData,
} from './hero/HeroLevelSystem';
export type {
  RecruitResult,
  RecruitOutput,
  PityState,
  RecruitSaveData,
  ResourceSpendFn,
  ResourceCheckFn,
  RecruitDeps,
  RecruitHistoryEntry,
} from './hero/HeroRecruitSystem';

// 战斗域
export { BattleEngine } from './battle/BattleEngine';
export { DamageCalculator } from './battle/DamageCalculator';
export type {
  BattleUnit,
  BattleTeam,
  BattleAction,
  BattleState,
  BattleResult,
  DamageResult,
  BuffEffect,
  BattleSkill,
  CreateUnitParams,
  Position,
  BattleSide,
  IDamageCalculator,
  IBattleEngine,
} from './battle/battle.types';
export {
  TroopType,
  TROOP_TYPE_LABELS,
  BuffType,
  SkillTargetType,
  BattlePhase,
  BattleOutcome,
  StarRating,
} from './battle/battle.types';
export { BATTLE_CONFIG } from './battle/battle-config';

// 战斗域 v4.0
export { BattleEffectApplier } from './battle/BattleEffectApplier';
export type {
  SkillEffectConfig,
  EnhancedBattleStats,
  EnhancedDamageResult,
} from './battle/BattleEffectApplier';
export {
  DamageNumberSystem,
  DamageNumberType,
  TrajectoryType,
} from './battle/DamageNumberSystem';
export type {
  TrajectoryConfig,
  DamageNumber,
  DamageNumberConfig,
} from './battle/DamageNumberSystem';

// 关卡域
export { CampaignProgressSystem } from './campaign/CampaignProgressSystem';
export { RewardDistributor } from './campaign/RewardDistributor';
export {
  campaignDataProvider,
  getChapters as getCampaignChapters,
  getStage as getCampaignStage,
} from './campaign/campaign-config';
export type {
  StageType,
  StageStatus,
  EnemyUnitDef,
  EnemyFormation,
  StageReward,
  Stage,
  Chapter,
  StageState,
  CampaignProgress,
  CampaignSaveData,
  RewardDistributorDeps,
  ICampaignDataProvider,
} from './campaign/campaign.types';
export { MAX_STARS } from './campaign/campaign.types';

// 科技域
export { TechTreeSystem } from './tech/TechTreeSystem';
export { TechResearchSystem } from './tech/TechResearchSystem';
export { TechPointSystem } from './tech/TechPointSystem';
export { TechEffectSystem } from './tech/TechEffectSystem';
export type {
  TechPath,
  TechNodeStatus,
  TechNodeDef,
  TechEffect,
  TechEffectType,
  TechEdge,
  TechNodeState,
  ResearchSlot,
  TechPointState,
  SpeedUpMethod,
  SpeedUpResult,
  StartResearchResult,
  TechState,
  TechSaveData,
} from './tech/tech.types';
export {
  TECH_PATHS,
  TECH_PATH_LABELS,
  TECH_PATH_COLORS,
  TECH_PATH_ICONS,
} from './tech/tech.types';
export {
  TECH_NODE_DEFS,
  TECH_NODE_MAP,
  TECH_EDGES,
  TECH_SAVE_VERSION,
  getNodesByPath,
  getNodesByTier,
  getMutexGroups,
  getQueueSizeForAcademyLevel,
  getTechPointProduction,
} from './tech/tech-config';

// 世界地图域
export { WorldMapSystem } from './map/WorldMapSystem';
export { MapDataRenderer } from './map/MapDataRenderer';
export { MapFilterSystem } from './map/MapFilterSystem';
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
} from '../core/map';
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
} from '../core/map';
