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
export { MAX_STAR_LEVEL } from './star-up-config';
