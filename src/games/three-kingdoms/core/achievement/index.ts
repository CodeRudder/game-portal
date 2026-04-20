/**
 * 成就域 — 统一导出
 *
 * @module core/achievement
 */

export type {
  AchievementDimension,
  AchievementRarity,
  AchievementConditionType,
  AchievementCondition,
  AchievementDef,
  AchievementReward,
  RebirthAchievementChain,
  AchievementStatus,
  AchievementInstance,
  DimensionStats,
  AchievementState,
  AchievementSaveData,
} from './achievement.types';

export {
  ACHIEVEMENT_DIMENSION_LABELS,
  ACHIEVEMENT_DIMENSION_ICONS,
  ACHIEVEMENT_RARITY_LABELS,
  ACHIEVEMENT_RARITY_WEIGHTS,
  ACHIEVEMENT_SAVE_VERSION,
} from './achievement.types';

export {
  ALL_ACHIEVEMENTS,
  ACHIEVEMENT_DEF_MAP,
  REBIRTH_ACHIEVEMENT_CHAINS,
} from './achievement-config';
