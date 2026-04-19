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
