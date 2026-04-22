/**
 * 好友系统 — 引擎层
 *
 * 职责：好友CRUD、好友互动（赠送/拜访/切磋）、借将系统、友情点
 * 规则：
 *   - 最大好友数：50
 *   - 每日申请上限：20
 *   - 删除好友后24h冷却
 *   - 互动：赠送10次/天、拜访5次/天、切磋3次/天、借将3次/天
 *   - 借将：战力80%折算、PvP禁用、自动归还
 *   - 友情点每日上限：200
 *
 * @module engine/social/FriendSystem
 */

import type {
  FriendData,
  FriendRequest,
  FriendConfig,
  InteractionConfig,
  InteractionRecord,
  InteractionType,
  BorrowHeroRecord,
  SocialState,
} from '../../core/social/social.types';
import { FriendStatus, InteractionType as IT } from '../../core/social/social.types';

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

/** 默认好友配置 */
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
function generateId(prefix: string): string {
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
export class FriendSystem {
  private friendConfig: FriendConfig;
  private interactionConfig: InteractionConfig;

  constructor(
    friendConfig?: Partial<FriendConfig>,
    interactionConfig?: Partial<InteractionConfig>,
  ) {
    this.friendConfig = { ...DEFAULT_FRIEND_CONFIG, ...friendConfig };
    this.interactionConfig = { ...DEFAULT_INTERACTION_CONFIG, ...interactionConfig };
    // 延迟导入避免循环依赖
    const { BorrowHeroSubsystem } = require('./BorrowHeroSubsystem');
    this.borrowSubsystem = new BorrowHeroSubsystem(this.interactionConfig);
  }

  // ── 好友管理 ──────────────────────────────

  /**
   * 添加好友
   */
  addFriend(state: SocialState, friend: FriendData): SocialState {
    if (Object.keys(state.friends).length >= this.friendConfig.maxFriends) {
      throw new Error('好友数量已达上限');
    }
    if (state.friends[friend.playerId]) {
      throw new Error('已经是好友了');
    }

    return {
      ...state,
      friends: { ...state.friends, [friend.playerId]: friend },
    };
  }

  /**
   * 删除好友
   */
  removeFriend(state: SocialState, playerId: string, now: number): SocialState {
    if (!state.friends[playerId]) {
      throw new Error('不是好友');
    }

    // 检查冷却
    const cooldownEnd = state.deleteCooldowns[playerId];
    if (cooldownEnd && now < cooldownEnd) {
      throw new Error('删除冷却中');
    }

    const { [playerId]: _, ...remainingFriends } = state.friends;
    return {
      ...state,
      friends: remainingFriends,
      deleteCooldowns: {
        ...state.deleteCooldowns,
        [playerId]: now + this.friendConfig.deleteCooldownMs,
      },
    };
  }

  /**
   * 检查是否可以删除好友
   */
  canRemoveFriend(state: SocialState, playerId: string, now: number): boolean {
    if (!state.friends[playerId]) return false;
    const cooldownEnd = state.deleteCooldowns[playerId];
    return !cooldownEnd || now >= cooldownEnd;
  }

  /**
   * 检查是否可以添加好友
   */
  canAddFriend(state: SocialState): boolean {
    return Object.keys(state.friends).length < this.friendConfig.maxFriends;
  }

  // ── 好友申请 ──────────────────────────────

  /**
   * 发送好友申请
   */
  sendFriendRequest(
    state: SocialState,
    fromPlayerId: string,
    fromPlayerName: string,
    toPlayerId: string,
    now: number,
  ): SocialState {
    if (state.dailyRequestsSent >= this.friendConfig.dailyRequestLimit) {
      throw new Error('今日申请次数已达上限');
    }
    if (state.pendingRequests.length >= this.friendConfig.pendingRequestLimit) {
      throw new Error('待处理申请已达上限');
    }
    if (state.friends[toPlayerId]) {
      throw new Error('已经是好友了');
    }

    const request: FriendRequest = {
      id: generateId('freq'),
      fromPlayerId,
      fromPlayerName,
      toPlayerId,
      timestamp: now,
    };

    return {
      ...state,
      pendingRequests: [...state.pendingRequests, request],
      dailyRequestsSent: state.dailyRequestsSent + 1,
    };
  }

  /**
   * 接受好友申请
   */
  acceptFriendRequest(
    state: SocialState,
    requestId: string,
    friendData: FriendData,
  ): SocialState {
    const request = state.pendingRequests.find((r) => r.id === requestId);
    if (!request) {
      throw new Error('申请不存在');
    }

    const newState = this.addFriend(state, friendData);
    return {
      ...newState,
      pendingRequests: newState.pendingRequests.filter((r) => r.id !== requestId),
    };
  }

  /**
   * 拒绝好友申请
   */
  rejectFriendRequest(state: SocialState, requestId: string): SocialState {
    const request = state.pendingRequests.find((r) => r.id === requestId);
    if (!request) {
      throw new Error('申请不存在');
    }

    return {
      ...state,
      pendingRequests: state.pendingRequests.filter((r) => r.id !== requestId),
    };
  }

  // ── 好友互动 ──────────────────────────────

  /**
   * 赠送兵力
   */
  giftTroops(state: SocialState, friendId: string, now: number): {
    state: SocialState;
    friendshipEarned: number;
  } {
    const todayInteractions = state.dailyInteractions.filter(
      (i) => i.type === IT.GIFT_TROOPS,
    );
    if (todayInteractions.length >= this.interactionConfig.giftTroopsDailyLimit) {
      throw new Error('今日赠送次数已达上限');
    }
    if (!state.friends[friendId]) {
      throw new Error('不是好友');
    }

    const points = this.interactionConfig.giftTroopsFriendshipPoints;
    const earned = this.calculateFriendshipEarned(state, points);

    return {
      state: {
        ...state,
        friendshipPoints: state.friendshipPoints + earned,
        dailyFriendshipEarned: state.dailyFriendshipEarned + earned,
        dailyInteractions: [
          ...state.dailyInteractions,
          { type: IT.GIFT_TROOPS, targetFriendId: friendId, timestamp: now },
        ],
      },
      friendshipEarned: earned,
    };
  }

  /**
   * 拜访主城
   */
  visitCastle(state: SocialState, friendId: string, now: number): {
    state: SocialState;
    copperReward: number;
  } {
    const todayVisits = state.dailyInteractions.filter(
      (i) => i.type === IT.VISIT_CASTLE,
    );
    if (todayVisits.length >= this.interactionConfig.visitDailyLimit) {
      throw new Error('今日拜访次数已达上限');
    }
    if (!state.friends[friendId]) {
      throw new Error('不是好友');
    }

    return {
      state: {
        ...state,
        dailyInteractions: [
          ...state.dailyInteractions,
          { type: IT.VISIT_CASTLE, targetFriendId: friendId, timestamp: now },
        ],
      },
      copperReward: this.interactionConfig.visitCopperReward,
    };
  }

  /**
   * 切磋
   */
  spar(state: SocialState, friendId: string, won: boolean, now: number): {
    state: SocialState;
    friendshipEarned: number;
  } {
    const todaySpars = state.dailyInteractions.filter(
      (i) => i.type === IT.SPAR,
    );
    if (todaySpars.length >= this.interactionConfig.sparDailyLimit) {
      throw new Error('今日切磋次数已达上限');
    }
    if (!state.friends[friendId]) {
      throw new Error('不是好友');
    }

    const basePoints = won
      ? this.interactionConfig.sparWinPoints
      : this.interactionConfig.sparLosePoints;
    const earned = this.calculateFriendshipEarned(state, basePoints);

    return {
      state: {
        ...state,
        friendshipPoints: state.friendshipPoints + earned,
        dailyFriendshipEarned: state.dailyFriendshipEarned + earned,
        dailyInteractions: [
          ...state.dailyInteractions,
          { type: IT.SPAR, targetFriendId: friendId, timestamp: now },
        ],
      },
      friendshipEarned: earned,
    };
  }

  // ── 借将系统（委托 BorrowHeroSubsystem） ──

  private borrowSubsystem: import('./BorrowHeroSubsystem').BorrowHeroSubsystem;

  /**
   * 借将
   */
  borrowHero(
    state: SocialState,
    heroId: string,
    lenderPlayerId: string,
    borrowerPlayerId: string,
    now: number,
  ): { state: SocialState; powerRatio: number } {
    return this.borrowSubsystem.borrowHero(
      state, heroId, lenderPlayerId, borrowerPlayerId, now,
      (s, pts) => this.calculateFriendshipEarned(s, pts),
    );
  }

  /**
   * 归还借将
   */
  returnBorrowedHero(state: SocialState, borrowId: string): SocialState {
    return this.borrowSubsystem.returnBorrowedHero(state, borrowId);
  }

  /**
   * 检查借将是否可用于PvP
   */
  isBorrowHeroAllowedInPvP(): boolean {
    return this.borrowSubsystem.isBorrowHeroAllowedInPvP();
  }

  // ── 每日重置 ──────────────────────────────

  /**
   * 每日重置
   */
  dailyReset(state: SocialState): SocialState {
    return {
      ...state,
      dailyRequestsSent: 0,
      dailyInteractions: [],
      dailyFriendshipEarned: 0,
      dailyBorrowCount: 0,
    };
  }

  // ── 工具方法 ──────────────────────────────

  /**
   * 计算实际获得的友情点（考虑每日上限）
   */
  private calculateFriendshipEarned(state: SocialState, basePoints: number): number {
    const remaining = this.interactionConfig.friendshipDailyCap - state.dailyFriendshipEarned;
    return Math.max(0, Math.min(basePoints, remaining));
  }

  /**
   * 获取好友列表
   */
  getFriendList(state: SocialState): FriendData[] {
    return Object.values(state.friends);
  }

  /**
   * 获取在线好友
   */
  getOnlineFriends(state: SocialState): FriendData[] {
    return Object.values(state.friends).filter(
      (f) => f.status === FriendStatus.ONLINE,
    );
  }

  /**
   * 获取今日互动次数（按类型）
   */
  getDailyInteractionCount(state: SocialState, type: InteractionType): number {
    return state.dailyInteractions.filter((i) => i.type === type).length;
  }

  /**
   * 获取好友配置
   */
  getFriendConfig(): FriendConfig {
    return { ...this.friendConfig };
  }

  /**
   * 获取互动配置
   */
  getInteractionConfig(): InteractionConfig {
    return { ...this.interactionConfig };
  }

  // ── 存档序列化 ──────────────────────────

  /**
   * 序列化社交状态
   */
  serialize(state: SocialState): import('../../core/social/social.types').SocialSaveData {
    return {
      version: SOCIAL_SAVE_VERSION,
      state: {
        friends: { ...state.friends },
        pendingRequests: [...state.pendingRequests],
        dailyRequestsSent: state.dailyRequestsSent,
        lastDailyReset: state.lastDailyReset,
        dailyInteractions: [...state.dailyInteractions],
        friendshipPoints: state.friendshipPoints,
        dailyFriendshipEarned: state.dailyFriendshipEarned,
        activeBorrows: [...state.activeBorrows],
        dailyBorrowCount: state.dailyBorrowCount,
        deleteCooldowns: { ...state.deleteCooldowns },
        chatMessages: { ...state.chatMessages },
        lastSendTime: { ...state.lastSendTime },
        muteRecords: [...state.muteRecords],
        reportRecords: [...state.reportRecords],
        falseReportCounts: { ...state.falseReportCounts },
      },
    };
  }

  /**
   * 反序列化恢复社交状态
   */
  deserialize(data: import('../../core/social/social.types').SocialSaveData): SocialState {
    if (!data || data.version !== SOCIAL_SAVE_VERSION) {
      return createDefaultSocialState();
    }
    return { ...data.state };
  }
}
