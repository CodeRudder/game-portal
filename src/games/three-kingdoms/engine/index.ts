/**
 * 引擎层 — 统一导出入口
 *
 * 按DDD业务域组织导出，每个域通过各自的 index.ts 导出。
 * 本文件只做重导出，不包含具体类型/常量定义。
 *
 * @module engine
 */

// ── 引擎主类 ──
export { ThreeKingdomsEngine } from './ThreeKingdomsEngine';

// ── 资源域 (v1.0) ──
export * from './resource';

// ── 建筑域 (v1.0) ──
export * from './building';

// ── 日历域 (v1.0) ──
export * from './calendar';

// ── 武将域 (v2.0) ──
export * from './hero';

// ── 羁绊域 (v2.0) ──
export { BondSystem } from './bond/BondSystem';

// ── 战斗域 (v3.0) ──
export * from './battle';

// ── 关卡域 (v3.0) ──
export * from './campaign';

// ── 科技域 (v5.0) ──
export * from './tech';

// ── 世界地图域 (v6.0) ──
export { WorldMapSystem } from './map/WorldMapSystem';
export { MapDataRenderer } from './map/MapDataRenderer';
export { MapFilterSystem } from './map/MapFilterSystem';
export type {
  GridPosition, MapSize, GridConfig, ViewportConfig, ViewportState,
  RegionId, RegionDef, RegionBounds, TerrainType, TerrainDef, TileData,
  LandmarkType, LandmarkLevel, OwnershipStatus, ResourceNodeType, LandmarkData,
  MapFilterCriteria, MapFilterResult, RenderLayer, TileRenderData, ViewportRenderData,
  WorldMapState, WorldMapSaveData,
} from '../core/map';
export {
  MAP_SIZE, GRID_CONFIG, VIEWPORT_CONFIG, MAP_PIXEL_SIZE,
  REGION_IDS, REGION_DEFS, REGION_LABELS, REGION_COLORS,
  TERRAIN_TYPES, TERRAIN_DEFS, TERRAIN_LABELS, TERRAIN_COLORS,
  DEFAULT_LANDMARKS, LANDMARK_POSITIONS, MAP_SAVE_VERSION,
  getRegionAtPosition, getTerrainAtPosition, generateAllTiles,
} from '../core/map';

// ── NPC域 (v6.0) ──
export * from './npc';

// ── 事件域 (v6.0) ──
export * from './event';

// ── 任务域 (v7.0) ──
export * from './quest';

// ── 货币域 (v8.0) ──
export * from './currency';

// ── 商店域 (v8.0) ──
export * from './shop';

// ── 贸易域 (v8.0) ──
export * from './trade';

// ── 离线收益域 (v9.0) ──
export * from './offline';

// ── 邮件域 (v9.0) ──
export * from './mail';

// ── 装备域 (v10.0) ──
export * from './equipment';

// ── PvP竞技场域 (v11.0) ──
export * from './pvp';

// ── 社交域 (v11.0) ──
export * from './social';

// ── 远征域 (v12.0) ──
export * from './expedition';

// ── 排行榜引擎 (v12.0) ──
export { LeaderboardSystem } from './leaderboard/LeaderboardSystem';
export type { LeaderboardUpdateData, RewardDistributionResult } from './leaderboard/LeaderboardSystem';

// ── 联盟域 (v13.0) ──
export * from './alliance';

// ── 声望域 (v14.0) ──
export * from './prestige';

// ── 传承域 (v16.0) ──
export * from './heritage';

// ── 活动域 (v15.0) ──
export * from './activity';

// ── 引导域 (v18.0) ──
export * from './guide';

// ── 响应式域 (v17.0) ──
export * from './responsive';

// ── 设置域 (v20.0) ──
export * from './settings';

// ── 统一域 (v19.0) — 仅导出独有的，与settings重复的已通过settings域导出 ──
export { BalanceValidator } from './unification/BalanceValidator';
// AudioScene already exported via `export * from './settings'`
export { GraphicsQualityManager } from './unification/GraphicsQualityManager';
export {
  inRange, calcDeviation, makeEntry, calcPower, calcRebirthMultiplier,
  generateResourceCurve,
} from './unification/BalanceUtils';
export {
  DEFAULT_RESOURCE_CONFIGS, HERO_BASE_STATS, DEFAULT_BATTLE_CONFIG,
  DEFAULT_ECONOMY_CONFIGS, DEFAULT_REBIRTH_CONFIG,
} from './unification/BalanceCalculator';
export {
  validateSingleResource, validateSingleHero, calculateStagePoints,
  validateEconomy, validateRebirth, calculateRebirthPoints,
} from './unification/BalanceReport';

// ── 军师域 (v20.0) ──
export * from './advisor';

// ── 成就域 (v20.0) ──
export * from './achievement';
