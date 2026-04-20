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

// SignInSystem
export {
  SignInSystem,
  DEFAULT_SIGN_IN_CONFIG,
  DEFAULT_SIGN_IN_REWARDS,
  SIGN_IN_CYCLE_DAYS,
  createDefaultSignInData,
} from './SignInSystem';
