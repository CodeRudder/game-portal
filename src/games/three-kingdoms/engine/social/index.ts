/**
 * 社交系统 — 统一导出入口
 *
 * @module engine/social
 */

// 核心类型
export type {
  FriendData,
  FriendRequest,
  FriendConfig,
  InteractionConfig,
  InteractionRecord,
  BorrowHeroRecord,
  BorrowConfig,
  ChatMessage,
  ChannelConfig,
  ChatConfig,
  MuteRecord,
  ReportRecord,
  ReportConfig,
  SocialState,
  SocialSaveData,
} from '../../core/social/social.types';

export {
  FriendStatus,
  InteractionType,
  ChatChannel,
  MuteLevel,
  ReportType,
} from '../../core/social/social.types';

// FriendSystem
export {
  FriendSystem,
  DEFAULT_FRIEND_CONFIG,
  DEFAULT_INTERACTION_CONFIG,
  SOCIAL_SAVE_VERSION,
  createDefaultSocialState,
} from './FriendSystem';

// ChatSystem
export {
  ChatSystem,
  DEFAULT_CHANNEL_CONFIGS,
  MUTE_DURATIONS,
} from './ChatSystem';

// LeaderboardSystem
export {
  LeaderboardSystem,
  LEADERBOARD_TYPE_LABELS,
  createDefaultLeaderboardState,
} from './LeaderboardSystem';
export type {
  LeaderboardType as LeaderboardTypeEnum,
  LeaderboardEntry,
  LeaderboardSeason,
  LeaderboardRewardConfig,
  LeaderboardQuery,
  LeaderboardPageResult,
  LeaderboardState,
} from './LeaderboardSystem';
