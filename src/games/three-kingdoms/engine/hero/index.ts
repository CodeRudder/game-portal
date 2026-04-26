/**
 * 武将域 — 统一导出入口
 *
 * @module engine/hero
 */

// 核心系统
export { HeroSystem } from './HeroSystem';
export { HeroRecruitSystem } from './HeroRecruitSystem';
export { HeroRecruitUpManager } from './HeroRecruitUpManager';
export { HeroLevelSystem } from './HeroLevelSystem';
export { HeroStarSystem } from './HeroStarSystem';
export { SkillUpgradeSystem } from './SkillUpgradeSystem';
export { SkillStrategyRecommender } from './SkillStrategyRecommender';
export { HeroFormation, MAX_FORMATIONS, MAX_SLOTS_PER_FORMATION } from './HeroFormation';
export { HeroBadgeSystem } from './HeroBadgeSystem';
export { HeroAttributeCompare } from './HeroAttributeCompare';
export { BondSystem } from './BondSystem';
export { FactionBondSystem } from './faction-bond-system';

// 类型
export type {
  GeneralStats, GeneralData, HeroState, HeroSaveData, SkillData, Faction,
} from './hero.types';
export {
  Quality, QUALITY_ORDER, QUALITY_TIERS, QUALITY_LABELS,
  QUALITY_BORDER_COLORS, FACTION_LABELS, FACTIONS,
} from './hero.types';
export type {
  StarUpPreview, FragmentProgress, BreakthroughPreview,
  StarUpResult, BreakthroughResult, StarData, FragmentSource, BreakthroughTier,
} from './star-up.types';
export type {
  RecruitResult, RecruitOutput, PityState, RecruitSaveData,
  ResourceSpendFn, ResourceCheckFn, RecruitDeps, RecruitHistoryEntry,
} from './HeroRecruitSystem';
export type {
  EnhancePreview, LevelUpResult, BatchEnhanceResult, LevelSaveData,
} from './HeroLevelSystem';
export type {
  FormationData, FormationState, FormationSaveData,
} from './HeroFormation';
export type {
  SkillUpgradeResult, SkillUpgradeMaterials, SkillUpgradeDeps,
  SkillUpgradeState, EnemyType, StrategyRecommendation,
} from './SkillUpgradeSystem';
export type {
  SkillUnlockState, ExtraEffect,
} from './SkillUpgradeSystem';
export type {
  EnemyType as SkillEnemyType,
  StrategyRecommendation as SkillStrategyRecommendation,
} from './SkillStrategyRecommender';
export type {
  TodayTodoItem, QuickActionResult, BadgeSystemState, BadgeSystemDeps,
} from './HeroBadgeSystem';
export type {
  AttributeComparison, AttributeContribution, AttributeBreakdown,
  AttributeCompareState, AttributeCompareDeps,
} from './HeroAttributeCompare';

// 配置
export { HERO_MAX_LEVEL, GENERAL_DEF_MAP, DUPLICATE_FRAGMENT_COUNT } from './hero-config';
export type { RecruitType } from './hero-recruit-config';
export { RECRUIT_RATES, DAILY_FREE_CONFIG, RECRUIT_PITY, RECRUIT_COSTS, TEN_PULL_DISCOUNT } from './hero-recruit-config';
export { MAX_STAR_LEVEL } from './star-up-config';
export {
  BondType,
  BOND_MULTIPLIER_CAP,
  DISPATCH_FACTOR,
  ACTIVE_FACTOR,
  BOND_STAR_LEVEL_MAP,
  FACTION_BONDS,
  PARTNER_BONDS,
  getBondLevelByMinStar,
  getBondLevelMultiplier,
} from './bond-config';
export type {
  BondEffect,
  BondTier,
  FactionBondDefinition,
  PartnerBondDefinition,
  BondDefinition,
} from './bond-config';
export type {
  ActiveBond,
  GeneralMeta,
  BondSystemDeps,
  BondActivatedPayload,
  BondDeactivatedPayload,
  BondLevelUpPayload,
} from './BondSystem';

// 阵营羁绊系统
export {
  EMPTY_BOND_EFFECT,
  SHU_TIERS,
  WEI_TIERS,
  WU_TIERS,
  NEUTRAL_TIERS,
  FACTION_TIER_MAP,
  PARTNER_BOND_CONFIGS,
  HERO_FACTION_MAP,
  ALL_FACTIONS,
  FACTION_NAMES,
} from './faction-bond-config';
export type {
  BondEffect as FactionBondEffect,
  BondConfig as FactionBondConfig,
  FactionId,
  FactionTierDef,
  BondType as FactionBondType,
} from './faction-bond-config';
export type {
  ActiveFactionBond,
  HeroFactionResolver,
} from './faction-bond-system';
