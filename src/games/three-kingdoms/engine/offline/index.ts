/**
 * 离线收益域 — 统一导出
 *
 * @module engine/offline
 */

export { OfflineRewardSystem } from './OfflineRewardSystem';
export { OfflineEstimateSystem } from './OfflineEstimateSystem';
export type {
  EstimatePoint,
  EstimateResult,
} from './OfflineEstimateSystem';
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
} from './offline.types';
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
} from './offline-config';
