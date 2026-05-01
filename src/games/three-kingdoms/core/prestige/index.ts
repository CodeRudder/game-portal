/**
 * 声望域 — 统一导出
 *
 * @module core/prestige
 */

export type {
  PrestigeLevel,
  PrestigeLevelInfo,
  PrestigePanel,
  PrestigeSourceType,
  PrestigeSourceConfig,
  PrestigeGainRecord,
  PrestigeShopGoods,
  PrestigeShopItem,
  LevelUnlockReward,
  RebirthCondition,
  RebirthMultiplier,
  RebirthKeepRule,
  RebirthResetRule,
  RebirthAcceleration,
  RebirthUnlockContent,
  RebirthRecord,
  SimulationParams,
  SimulationResult,
  PrestigeObjectiveType,
  PrestigeQuestDef,
  RebirthQuestDef,
  PrestigeState,
  RebirthState,
  PrestigeSaveData,
  // v16.0 传承系统深化
  RebirthInitialGift,
  RebirthInstantBuild,
  RebirthUnlockContentV16,
  RebirthSimulationComparison,
  SimulationResultV16,
} from './prestige.types';

export { PRESTIGE_SAVE_VERSION } from './prestige.types';

export {
  MAX_PRESTIGE_LEVEL,
  PRESTIGE_BASE,
  PRESTIGE_EXPONENT,
  PRESTIGE_LEVEL_TITLES,
  PRODUCTION_BONUS_PER_LEVEL,
  PRESTIGE_SOURCE_CONFIGS,
  PRESTIGE_SHOP_GOODS,
  LEVEL_UNLOCK_REWARDS,
  REBIRTH_CONDITIONS,
  REBIRTH_MULTIPLIER,
  REBIRTH_KEEP_RULES,
  REBIRTH_RESET_RULES,
  REBIRTH_ACCELERATION,
  REBIRTH_UNLOCK_CONTENTS,
  PRESTIGE_QUESTS,
  REBIRTH_QUESTS,
  // v16.0 传承系统深化
  REBIRTH_INITIAL_GIFT,
  REBIRTH_INSTANT_BUILD,
  REBIRTH_UNLOCK_CONTENTS_V16,
  SIMULATION_DIMINISHING_RETURNS_HOUR,
  // PRS-P1-01 fix: 转生倍率计算内聚到声望域
  calcRebirthMultiplierFromConfig,
} from './prestige-config';

export type {
  // PRS-P1-01 fix: 转生倍率计算相关类型
  RebirthCurveType,
  PrestigeRebirthConfig,
} from './prestige-config';
