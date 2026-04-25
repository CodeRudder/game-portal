/**
 * 离线收益域 — 统一导出
 *
 * @module engine/offline
 */

export { OfflineRewardSystem } from './OfflineRewardSystem';
export { OfflineEstimateSystem } from './OfflineEstimateSystem';
export type { EstimatePoint, EstimateResult } from './OfflineEstimateSystem';

// 纯计算函数（OfflineRewardEngine）
export {
  calculateTierDetails,
  calculateOverallEfficiency,
  calculateBonusCoefficient,
  calculateOfflineSnapshot,
  applyDouble,
  applyOverflowRules,
  getSystemModifier,
  applySystemModifier,
  estimateOfflineReward,
  formatOfflineDuration,
  generateReturnPanelData,
  calculateFullOfflineReward,
  shouldShowOfflinePopup,
} from './OfflineRewardEngine';
export type { OfflineRewardContext } from './OfflineRewardEngine';

export type {
  DecayTier, OfflineSnapshot, TierDetail,
  DoubleSource, DoubleRequest, DoubleResult,
  BonusSources,
  ReturnPanelData, OfflineBoostItem, BoostUseResult,
  OfflineTradeEvent, OfflineTradeSummary,
  VipOfflineBonus, SystemEfficiencyModifier,
  OverflowStrategy, OverflowRule, ResourceProtection,
  WarehouseExpansion, ExpansionResult,
  OfflineRewardResultV9, OfflineSaveData,
  StagedMail, StagingOverflowResult,
  OfflineExpResult,
  ActivityPointsResult, ActivityPointsConfig,
  DegradationNotice,
  SiegeResult,
  TechProductionUpdate,
} from './offline.types';

export {
  DECAY_TIERS, MAX_OFFLINE_HOURS, MAX_OFFLINE_SECONDS,
  AD_DOUBLE_MULTIPLIER, ITEM_DOUBLE_MULTIPLIER,
  RETURN_BONUS_MULTIPLIER, RETURN_BONUS_MIN_HOURS,
  VIP_OFFLINE_BONUSES, SYSTEM_EFFICIENCY_MODIFIERS,
  OVERFLOW_RULES, RESOURCE_PROTECTIONS,
  DEFAULT_WAREHOUSE_EXPANSIONS,
  OFFLINE_TRADE_EFFICIENCY, MAX_OFFLINE_TRADES,
  OFFLINE_TRADE_DURATION,
  STAGING_QUEUE_CAPACITY,
  BASE_EXP_PER_HOUR, EXP_LEVEL_TABLE,
  SEASON_ACTIVITY_OFFLINE_EFFICIENCY, TIMED_ACTIVITY_OFFLINE_EFFICIENCY,
  SIEGE_FAILURE_TROOP_LOSS_RATIO,
  EXPIRED_MAIL_COMPENSATION_RATIO,
} from './offline-config';
