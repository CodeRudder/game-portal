/**
 * 好友系统 — 引擎层
 *
 * 职责：好友CRUD、好友互动（赠送/拜访/切磋）、借将系统、友情点
 * 规则：
 *   - 最大好友数：50
 *   - 每日申请上限：20
 *   - 删除好友后24h冷却
 *   - 互动：赠送10次/天、拜访5次/天、切磋3次/天、借将3次/天
 */
import type { ISubsystem, ISystemDeps } from '../../core/types';
import type {
  FriendConfig,
  InteractionConfig,
  SocialState,
  FriendData,
  FriendRequest,
} from '../../core/social/social.types';
import { FriendStatus, InteractionType } from '../../core/social/social.types';
import {
  DEFAULT_FRIEND_CONFIG,
  DEFAULT_INTERACTION_CONFIG,
  SOCIAL_SAVE_VERSION,
  createDefaultSocialState,
  generateId,
} from './friend-config';
import { FriendInteractionHelper } from './FriendInteractionHelper';
import { BorrowHeroHelper } from './BorrowHeroHelper';

export class FriendSystem implements ISubsystem {
  readonly name = 'friend' as const;
  private deps!: ISystemDeps;
  private friendConfig: FriendConfig;
  private interactionConfig: InteractionConfig;
  private readonly interactionHelper: FriendInteractionHelper;
  private readonly borrowHelper: BorrowHeroHelper;

  constructor(
    friendConfig?: Partial<FriendConfig>,
    interactionConfig?: Partial<InteractionConfig>,
  ) {
    this.friendConfig = { ...DEFAULT_FRIEND_CONFIG, ...friendConfig };
    this.interactionConfig = { ...DEFAULT_INTERACTION_CONFIG, ...interactionConfig };
    this.interactionHelper = new FriendInteractionHelper(this.interactionConfig);
    this.borrowHelper = new BorrowHeroHelper(this.interactionConfig);
  }

  // ─── ISubsystem 接口 ───────────────────────

  init(deps: ISystemDeps): void { this.deps = deps; }
  update(_dt: number): void { /* 预留 */ }
  getState(): SocialState { return createDefaultSocialState(); }
  reset(): void { this.friendConfig = { ...DEFAULT_FRIEND_CONFIG }; this.interactionConfig = { ...DEFAULT_INTERACTION_CONFIG }; }

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
    // P0-10 fix: 禁止对自己发送好友申请
    if (fromPlayerId === toPlayerId) {
      throw new Error('不能对自己发送好友申请');
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
   * 赠送兵力（委托 FriendInteractionHelper）
   */
  giftTroops(state: SocialState, friendId: string, now: number): {
    state: SocialState;
    friendshipEarned: number;
  } {
    const result = this.interactionHelper.giftTroops(state, friendId, now);
    return { state: result.state, friendshipEarned: result.pointsEarned };
  }

  /**
   * 拜访主城（委托 FriendInteractionHelper）
   */
  visitCastle(state: SocialState, friendId: string, now: number): {
    state: SocialState;
    copperReward: number;
  } {
    const result = this.interactionHelper.visitCastle(state, friendId, now);
    return { state: result.state, copperReward: result.copperReward };
  }

  /**
   * 切磋（委托 FriendInteractionHelper）
   */
  spar(state: SocialState, friendId: string, won: boolean, now: number): {
    state: SocialState;
    friendshipEarned: number;
  } {
    const result = this.interactionHelper.spar(state, friendId, won, now);
    return { state: result.state, friendshipEarned: result.pointsEarned };
  }

  // ── 借将系统（委托 BorrowHeroHelper） ──

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
    return this.borrowHelper.borrowHero(
      state, heroId, lenderPlayerId, borrowerPlayerId, now,
      (s: SocialState, pts: number) => this.calculateFriendshipEarned(s, pts),
    );
  }

  /**
   * 归还借将
   */
  returnBorrowedHero(state: SocialState, borrowId: string): SocialState {
    return this.borrowHelper.returnBorrowedHero(state, borrowId);
  }

  /**
   * 检查借将是否可用于PvP
   */
  isBorrowHeroAllowedInPvP(): boolean {
    return this.borrowHelper.isBorrowHeroAllowedInPvP();
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
    if (!data) {
      return createDefaultSocialState();
    }
    // P0-05 fix: 版本不匹配时记录警告而非静默丢弃
    if (data.version !== SOCIAL_SAVE_VERSION) {
      console.warn(
        `[SocialSystem] 存档版本不匹配: 期望=${SOCIAL_SAVE_VERSION}, 实际=${data.version}。` +
        `将尝试兼容恢复。`
      );
      // 尝试兼容恢复：如果 state 存在且结构合理，尽量使用
      if (data.state && typeof data.state === 'object') {
        const defaultState = createDefaultSocialState();
        return { ...defaultState, ...data.state };
      }
      return createDefaultSocialState();
    }
    return { ...data.state };
  }
}
