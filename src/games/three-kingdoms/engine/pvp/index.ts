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
export {
  ArenaSystem,
  DEFAULT_MATCH_CONFIG,
  DEFAULT_REFRESH_CONFIG,
  DEFAULT_CHALLENGE_CONFIG,
  ARENA_SAVE_VERSION,
  createDefaultDefenseFormation,
  createDefaultArenaPlayerState,
} from './ArenaSystem';

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
