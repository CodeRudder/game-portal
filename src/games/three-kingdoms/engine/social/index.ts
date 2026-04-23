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
} from './FriendSystem';
export {
  DEFAULT_FRIEND_CONFIG,
  DEFAULT_INTERACTION_CONFIG,
  SOCIAL_SAVE_VERSION,
  createDefaultSocialState,
} from './friend-config';

// BorrowHeroHelper（从FriendSystem拆分）
export { BorrowHeroHelper } from './BorrowHeroHelper';

// ChatSystem
export {
  ChatSystem,
  DEFAULT_CHANNEL_CONFIGS,
  MUTE_DURATIONS,
} from './ChatSystem';

// LeaderboardSystem
export {
  LeaderboardSystem,
} from './LeaderboardSystem';
export {
  LEADERBOARD_TYPE_LABELS,
  createDefaultLeaderboardState,
} from './leaderboard-types';
export type {
  LeaderboardType as LeaderboardTypeEnum,
  LeaderboardEntry,
  LeaderboardSeason,
  LeaderboardRewardConfig,
  LeaderboardQuery,
  LeaderboardPageResult,
  LeaderboardState,
} from './leaderboard-types';
