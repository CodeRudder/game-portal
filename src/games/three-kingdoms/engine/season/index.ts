/**
 * 引擎层 — 赛季系统导出
 *
 * @module engine/season
 */

export { SeasonSystem } from './SeasonSystem';
export type { SeasonInfo, SeasonRanking, SeasonSaveData } from './SeasonSystem';
export {
  DEFAULT_SEASON_DURATION_DAYS,
  SEASON_SAVE_VERSION,
  DEFAULT_LEADERBOARD_LIMIT,
  SEASON_REWARD_TIERS,
  getRewardsForRank,
} from './season-config';
export type { SeasonRewardItem, RewardTier } from './season-config';
