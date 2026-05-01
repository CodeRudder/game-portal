/**
 * PvP竞技场 — 统一导出入口
 *
 * @module engine/pvp
 */

// 核心类型
export type {
  RankLevel,
  RankDailyReward,
  ArenaOpponent,
  DefenseSnapshot,
  MatchConfig,
  RefreshConfig,
  ChallengeConfig,
  PvPBattleConfig,
  ScoreConfig,
  PvPBattleResult,
  DefenseFormation,
  DefenseLogEntry,
  DefenseLogStats,
  SeasonConfig,
  SeasonData,
  SeasonReward,
  BattleReplay,
  ReplayConfig,
  ArenaShopItem,
  ArenaPlayerState,
  ArenaSaveData,
} from '../../core/pvp/pvp.types';

export {
  RankTier,
  RankDivision,
  PvPBattleMode,
  FormationType,
  AIDefenseStrategy,
} from '../../core/pvp/pvp.types';

// ArenaSystem
export { ArenaSystem } from './ArenaSystem';

// ArenaConfig (extracted from ArenaSystem) + ArenaSystem.helpers
export {
  DEFAULT_MATCH_CONFIG,
  DEFAULT_REFRESH_CONFIG,
  DEFAULT_CHALLENGE_CONFIG,
  ARENA_SAVE_VERSION,
  createDefaultDefenseFormation,
  createDefaultArenaPlayerState,
  selectByFactionBalance,
  calculatePower,
  MAX_ARENA_COINS,
  addArenaCoins,
} from './ArenaSystem.helpers';

// PvPBattleSystem
export {
  PvPBattleSystem,
  DEFAULT_PVP_BATTLE_CONFIG,
  DEFAULT_SCORE_CONFIG,
  REPLAY_CONFIG,
  RANK_LEVELS,
  RANK_LEVEL_MAP,
} from './PvPBattleSystem';

// ArenaSeasonSystem
export {
  ArenaSeasonSystem,
  DEFAULT_SEASON_CONFIG,
  SEASON_REWARDS,
} from './ArenaSeasonSystem';

// DefenseFormationSystem
export {
  DefenseFormationSystem,
  FORMATION_SLOT_COUNT,
  MAX_DEFENSE_LOGS,
  ALL_FORMATIONS,
  ALL_STRATEGIES,
  FORMATION_NAMES,
  STRATEGY_NAMES,
} from './DefenseFormationSystem';

// RankingSystem
export {
  RankingSystem,
  RankingDimension,
  DEFAULT_RANKING_CONFIG,
  RANKING_SAVE_VERSION,
} from './RankingSystem';

export type {
  RankingEntry,
  RankingData,
  RankingConfig,
  RankingSaveData,
} from './RankingSystem';

// ArenaShopSystem
export {
  ArenaShopSystem,
  DEFAULT_ARENA_SHOP_ITEMS,
  ARENA_SHOP_SAVE_VERSION,
} from './ArenaShopSystem';

export type {
  ArenaShopSaveData,
} from './ArenaShopSystem';
