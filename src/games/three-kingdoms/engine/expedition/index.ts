/**
 * 远征系统 — 统一导出入口
 *
 * @module engine/expedition
 */

// 类型
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
} from '../../core/expedition/expedition.types';

export {
  RouteDifficulty,
  NodeType,
  NodeStatus,
  FormationType,
  FORMATION_LABELS,
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
} from '../../core/expedition/expedition.types';

// 配置
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
} from './expedition-config';

// 系统
export { ExpeditionSystem } from './ExpeditionSystem';
export type { HeroBrief, TeamValidationResult, UnlockCheckResult } from './ExpeditionSystem';
export { ExpeditionBattleSystem } from './ExpeditionBattleSystem';
export type { BattleUnitData, BattleTeamData, NodeBattleConfig, BattleTurnSnapshot } from './ExpeditionBattleSystem';
export { ExpeditionRewardSystem } from './ExpeditionRewardSystem';
export type { RewardParams, SweepRewardParams } from './ExpeditionRewardSystem';
export { AutoExpeditionSystem } from './AutoExpeditionSystem';
export type {
  AutoExpeditionStepResult,
  AutoExpeditionResult,
  OfflineExpeditionParams,
  OfflineExpeditionState,
} from './AutoExpeditionSystem';
