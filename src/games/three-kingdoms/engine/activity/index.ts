/**
 * 活动系统 — 统一导出入口
 *
 * @module engine/activity
 */

// 核心类型
export type {
  ActivityDef,
  ActivityInstance,
  ActivityConcurrencyConfig,
  ActivityTask,
  ActivityTaskDef,
  ActivityMilestone,
  ActivityState,
  ActivitySaveData,
  SignInData,
  SignInConfig,
  SignInReward,
  OfflineEfficiencyConfig,
  OfflineActivityResult,
  SeasonTheme,
  SeasonSettlementAnimation,
  SeasonRecord,
  SeasonRecordEntry,
} from '../../core/activity/activity.types';

export {
  ActivityType,
  ActivityStatus,
  ActivityTaskType,
  ActivityTaskStatus,
  MilestoneStatus,
} from '../../core/activity/activity.types';

// ActivitySystem
export {
  ActivitySystem,
  DEFAULT_CONCURRENCY_CONFIG,
  DEFAULT_OFFLINE_EFFICIENCY,
  ACTIVITY_SAVE_VERSION,
  createDefaultActivityState,
  createActivityInstance,
} from './ActivitySystem';

// ActivitySystemConfig（常量与配置，拆分模块）
export {
  DEFAULT_SEASON_THEMES,
} from './ActivitySystemConfig';

// ActivityOfflineCalculator（离线进度计算，拆分模块）
export {
  calculateOfflineProgress,
  applyOfflineProgress,
} from './ActivityOfflineCalculator';

// SignInSystem
export {
  SignInSystem,
  DEFAULT_SIGN_IN_CONFIG,
  DEFAULT_SIGN_IN_REWARDS,
  SIGN_IN_CYCLE_DAYS,
  createDefaultSignInData,
} from './SignInSystem';

// v15.0 — 代币兑换商店
export {
  TokenShopSystem,
} from './TokenShopSystem';

export {
  DEFAULT_TOKEN_SHOP_CONFIG,
  RARITY_ORDER,
  RARITY_PRICE_MULTIPLIER,
  DEFAULT_SHOP_ITEMS,
} from './token-shop-config';

// v15.0 — 限时活动系统（排行榜+限时流程+节日框架+离线进度）
export {
  TimedActivitySystem,
  DEFAULT_LEADERBOARD_CONFIG,
  DEFAULT_TIMED_OFFLINE_EFFICIENCY,
  FESTIVAL_TEMPLATES,
} from './TimedActivitySystem';
