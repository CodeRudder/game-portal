/**
 * Friend - config and helpers
 *
 * Extracted from FriendSystem.ts.
 */

import type {
  FriendConfig,
  InteractionConfig,
  SocialState,
  FriendData,
} from '../../core/social/social.types';
import { FriendStatus, InteractionType as IT } from '../../core/social/social.types';
import { FriendInteractionHelper } from './FriendInteractionHelper';
import { BorrowHeroHelper } from './BorrowHeroHelper';
import type { ISubsystem, ISystemDeps } from '../../core/types';
// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

export const DEFAULT_FRIEND_CONFIG: FriendConfig = {
  maxFriends: 50,
  dailyRequestLimit: 20,
  pendingRequestLimit: 30,
  deleteCooldownMs: 24 * 60 * 60 * 1000,
};

/** 默认互动配置 */
export const DEFAULT_INTERACTION_CONFIG: InteractionConfig = {
  giftTroopsDailyLimit: 10,
  giftTroopsFriendshipPoints: 5,
  visitDailyLimit: 5,
  visitCopperReward: 100,
  sparDailyLimit: 3,
  sparWinPoints: 20,
  sparLosePoints: 5,
  borrowDailyLimit: 3,
  lendFriendshipPoints: 10,
  borrowPowerRatio: 0.8,
  friendshipDailyCap: 200,
};

/** 社交系统存档版本 */
export const SOCIAL_SAVE_VERSION = 1;

// ─────────────────────────────────────────────
// 工具函数
// ─────────────────────────────────────────────

/** 生成唯一ID */
export function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** 创建默认社交状态 */
export function createDefaultSocialState(): SocialState {
  return {
    friends: {},
    pendingRequests: [],
    dailyRequestsSent: 0,
    lastDailyReset: 0,
    dailyInteractions: [],
    friendshipPoints: 0,
    dailyFriendshipEarned: 0,
    activeBorrows: [],
    dailyBorrowCount: 0,
    deleteCooldowns: {},
    chatMessages: {
      WORLD: [],
      GUILD: [],
      PRIVATE: [],
      SYSTEM: [],
    },
    lastSendTime: {},
    muteRecords: [],
    reportRecords: [],
    falseReportCounts: {},
  };
}

// ─────────────────────────────────────────────
// FriendSystem 类
// ─────────────────────────────────────────────

/**
 * 好友系统
 *
 * 管理好友列表、互动、借将
 */
