/**
 * 引擎层 — v12.0 远征天下 + v18.0 新手引导 + 排行榜导出
 *
 * 从 index.ts 拆分，保持 index.ts ≤500 行。
 *
 * @module engine/exports-v12
 */

// ──────────────────────────────────────────────
// v12.0 远征天下 — 远征系统 + 排行榜
// ──────────────────────────────────────────────

// 远征系统
export { ExpeditionSystem } from './expedition/ExpeditionSystem';
export type { HeroBrief, TeamValidationResult, UnlockCheckResult } from './expedition/ExpeditionSystem';
export { ExpeditionBattleSystem } from './expedition/ExpeditionBattleSystem';
export type { BattleUnitData, BattleTeamData, NodeBattleConfig, BattleTurnSnapshot } from './expedition/ExpeditionBattleSystem';
export { ExpeditionRewardSystem } from './expedition/ExpeditionRewardSystem';
export type { RewardParams, SweepRewardParams } from './expedition/ExpeditionRewardSystem';
export { AutoExpeditionSystem } from './expedition/AutoExpeditionSystem';
export type {
  AutoExpeditionStepResult,
  AutoExpeditionResult,
  OfflineExpeditionParams,
  OfflineExpeditionState,
} from './expedition/AutoExpeditionSystem';
export type {
  ExpeditionNode,
  ExpeditionRoute,
  ExpeditionRegion,
  ExpeditionTeam,
  ExpeditionState,
  ExpeditionSaveData,
  ExpeditionBattleResult,
  ExpeditionReward,
  DropItem,
  AutoExpeditionConfig,
  OfflineExpeditionResult,
  FormationEffect,
} from '../core/expedition/expedition.types';
export {
  RouteDifficulty,
  NodeType,
  NodeStatus,
  FormationType as ExpeditionFormationType,
  FORMATION_LABELS as EXPEDITION_FORMATION_LABELS,
  FORMATION_EFFECTS,
  FORMATION_COUNTERS,
  BattleGrade,
  GRADE_STARS,
  GRADE_LABELS,
  SweepType,
  SWEEP_CONFIG,
  MilestoneType,
  PauseReason,
  CASTLE_LEVEL_SLOTS,
  TROOP_COST,
  FACTION_BOND_THRESHOLD,
  FACTION_BOND_BONUS,
  MAX_HEROES_PER_TEAM,
  OFFLINE_EXPEDITION_CONFIG,
  DEFAULT_AUTO_CONFIG,
  DIFFICULTY_LABELS,
  DIFFICULTY_STARS,
} from '../core/expedition/expedition.types';
export {
  EXPEDITION_MAX_TURNS,
  FORMATION_COUNTER_BONUS,
  DROP_RATES,
  BASE_REWARDS,
  FIRST_CLEAR_REWARD,
  POWER_MULTIPLIERS,
  MARCH_DURATION,
  MILESTONE_CONFIGS,
  CONSECUTIVE_FAILURE_LIMIT,
  REST_HEAL_PERCENT,
  createDefaultRegions,
  createDefaultRoutes,
} from './expedition/expedition-config';

// 排行榜引擎
export { LeaderboardSystem as LeaderboardEngine } from './leaderboard/LeaderboardSystem';
export type {
  LeaderboardUpdateData,
  RewardDistributionResult,
} from './leaderboard/LeaderboardSystem';

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
