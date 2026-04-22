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
export { HERO_MAX_LEVEL, GENERAL_DEF_MAP, DUPLICATE_FRAGMENT_COUNT } from './hero/hero-config';
export type { RecruitType } from './hero/hero-recruit-config';
export type {
  StarUpPreview,
  FragmentProgress,
  BreakthroughPreview,
  StarUpResult,
  BreakthroughResult,
  StarData,
  FragmentSource,
  BreakthroughTier,
} from './hero/star-up.types';
export { MAX_STAR_LEVEL } from './hero/star-up-config';
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

// ──────────────────────────────────────────────
// v8.0 商贸繁荣
// ──────────────────────────────────────────────

// 货币域
export { CurrencySystem } from './currency/CurrencySystem';
export type {
  CurrencyType,
  CurrencyWallet,
  CurrencySaveData,
  CurrencyShortage,
  ExchangeRequest,
  ExchangeResult,
  ExchangeRate,
  SpendPriorityConfig,
} from '../core/currency/currency.types';
export {
  CURRENCY_TYPES,
  CURRENCY_LABELS,
  CURRENCY_COLORS,
  CURRENCY_ICONS,
  CURRENCY_IS_PAID,
} from '../core/currency/currency.types';

// 商店域
export { ShopSystem } from './shop/ShopSystem';
export type {
  ShopType,
  GoodsCategory,
  GoodsRarity,
  GoodsDef,
  GoodsItem,
  BuyRequest,
  BuyResult,
  BuyValidation,
  ConfirmLevel,
  ShopState,
  ShopSaveData,
  RestockResult,
  RestockType,
  GoodsFilter,
  DiscountConfig,
  DiscountType,
} from '../core/shop/shop.types';
export {
  SHOP_TYPES,
  SHOP_TYPE_LABELS,
  GOODS_CATEGORY_LABELS,
  GOODS_RARITY_LABELS,
} from '../core/shop/shop.types';

// 贸易域
export { TradeSystem } from './trade/TradeSystem';
export type { TradeCurrencyOps } from './trade/TradeSystem';
export { CaravanSystem } from './trade/CaravanSystem';
export type { RouteInfoProvider } from './trade/CaravanSystem';
export type {
  CityId,
  TradeRouteId,
  TradeRouteDef,
  TradeRouteState,
  TradeGoodsId,
  TradeGoodsDef,
  TradeGoodsPrice,
  TradeProfit,
  Caravan,
  CaravanAttributes,
  CaravanStatus,
  CaravanDispatchRequest,
  CaravanDispatchResult,
  GuardMutexCheck,
  GuardDispatchResult,
  TradeEventType,
  TradeEventDef,
  TradeEventInstance,
  TradeEventOption,
  ProsperityLevel,
  ProsperityTier,
  NpcMerchantType,
  NpcMerchantDef,
  NpcMerchantInstance,
  TradeSaveData,
} from '../core/trade/trade.types';
export {
  CITY_IDS,
  CITY_LABELS,
  CARAVAN_STATUS_LABELS,
  PROSPERITY_LABELS,
} from '../core/trade/trade.types';
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

// ──────────────────────────────────────────────
// v9.0 离线收益深化
// ──────────────────────────────────────────────

// 离线收益域
export { OfflineRewardSystem } from './offline/OfflineRewardSystem';
export { OfflineEstimateSystem } from './offline/OfflineEstimateSystem';
export type {
  EstimatePoint,
  EstimateResult,
} from './offline/OfflineEstimateSystem';
export type {
  DecayTier,
  OfflineSnapshot,
  TierDetail,
  DoubleSource,
  DoubleRequest,
  DoubleResult,
  ReturnPanelData,
  OfflineBoostItem,
  BoostUseResult,
  OfflineTradeEvent,
  OfflineTradeSummary,
  VipOfflineBonus,
  SystemEfficiencyModifier,
  OverflowStrategy,
  OverflowRule,
  ResourceProtection,
  WarehouseExpansion,
  ExpansionResult,
  OfflineRewardResultV9,
  OfflineSaveData,
} from './offline/offline.types';
export {
  DECAY_TIERS,
  MAX_OFFLINE_HOURS,
  MAX_OFFLINE_SECONDS,
  AD_DOUBLE_MULTIPLIER,
  ITEM_DOUBLE_MULTIPLIER,
  RETURN_BONUS_MULTIPLIER,
  RETURN_BONUS_MIN_HOURS,
  VIP_OFFLINE_BONUSES,
  SYSTEM_EFFICIENCY_MODIFIERS,
  OVERFLOW_RULES,
  RESOURCE_PROTECTIONS,
  DEFAULT_WAREHOUSE_EXPANSIONS,
  OFFLINE_TRADE_EFFICIENCY,
  MAX_OFFLINE_TRADES,
  OFFLINE_TRADE_DURATION,
} from './offline/offline-config';

// 邮件域
export { MailSystem } from './mail/MailSystem';
export { MailTemplateSystem } from './mail/MailTemplateSystem';
export type {
  MailCategory,
  MailPriority,
  MailStatus,
  MailAttachment,
  MailData,
  MailFilter,
  ClaimResult,
  BatchClaimResult,
  BatchAction,
  BatchActionResult,
  MailTemplate,
  MailTemplateVars,
  MailSaveData,
} from './mail/mail.types';
export {
  MAIL_CATEGORY_LABELS,
  MAIL_STATUS_LABELS,
  MAIL_PRIORITY_LABELS,
  MAILBOX_CAPACITY,
  DEFAULT_MAIL_EXPIRE_DAYS,
  MAIL_SAVE_VERSION,
} from './mail/mail.types';

// ──────────────────────────────────────────────
// v18.0 新手引导
// ──────────────────────────────────────────────

// 引导域
export { TutorialStateMachine } from './guide/TutorialStateMachine';
export { TutorialStepManager } from './guide/TutorialStepManager';
export type {
  TutorialGameState,
  AccelerationState,
  StepExecutionResult,
} from './guide/TutorialStepManager';
export { TutorialStepExecutor } from './guide/TutorialStepExecutor';
export type { StepExecutorStateSlice } from './guide/TutorialStepExecutor';
export { StoryEventPlayer } from './guide/StoryEventPlayer';
export type {
  StoryPlayState,
  TypewriterState,
  StoryPlayProgress,
  StoryGameState,
  SkipConfirmResult,
} from './guide/StoryEventPlayer';
export { TutorialStorage } from './guide/TutorialStorage';
export type {
  StorageResult,
  FirstLaunchResult,
} from './guide/TutorialStorage';
