/**
 * FriendInteractionHelper 单元测试
 *
 * 覆盖：
 * 1. giftTroops — 赠送兵力
 * 2. visitCastle — 拜访主城
 * 3. spar — 切磋
 * 4. calculateFriendshipEarned — 友情点计算
 * 5. getDailyInteractionCount — 互动次数查询
 */

import {
  FriendInteractionHelper,
  DEFAULT_INTERACTION_CONFIG,
} from '../FriendInteractionHelper';

import { InteractionType } from '../../../core/social/social.types';

import type { SocialState } from '../../../core/social/social.types';

describe('FriendInteractionHelper', () => {
  let helper: FriendInteractionHelper;

  const baseState: SocialState = {
    friends: {
      friend_1: {
        id: 'friend_1',
        name: '好友1',
        level: 10,
        friendship: 50,
        addedAt: 0,
      },
    },
    friendshipPoints: 0,
    dailyFriendshipEarned: 0,
    dailyBorrowCount: 0,
    activeBorrows: [],
    dailyInteractions: [],
  };

  beforeEach(() => {
    helper = new FriendInteractionHelper();
  });

  // ─── giftTroops ───────────────────────────

  describe('giftTroops', () => {
    it('应成功赠送兵力', () => {
      const { state, pointsEarned } = helper.giftTroops(baseState, 'friend_1', 1000);
      expect(pointsEarned).toBeGreaterThan(0);
      expect(state.dailyInteractions.length).toBe(1);
    });

    it('达到每日上限应抛错', () => {
      const state: SocialState = {
        ...baseState,
        dailyInteractions: Array.from({ length: 10 }, (_, i) => ({
          type: InteractionType.GIFT_TROOPS,
          targetFriendId: 'friend_1',
          timestamp: 1000,
        })),
      };
      expect(() => helper.giftTroops(state, 'friend_1', 1000)).toThrow('上限');
    });

    it('非好友应抛错', () => {
      expect(() => helper.giftTroops(baseState, 'stranger', 1000)).toThrow('不存在');
    });
  });

  // ─── visitCastle ──────────────────────────

  describe('visitCastle', () => {
    it('应成功拜访', () => {
      const { state, copperReward } = helper.visitCastle(baseState, 'friend_1', 1000);
      expect(copperReward).toBe(DEFAULT_INTERACTION_CONFIG.visitCopperReward);
      expect(state.dailyInteractions.length).toBe(1);
    });

    it('达到每日上限应抛错', () => {
      const state: SocialState = {
        ...baseState,
        dailyInteractions: Array.from({ length: 5 }, () => ({
          type: InteractionType.VISIT_CASTLE,
          targetFriendId: 'friend_1',
          timestamp: 1000,
        })),
      };
      expect(() => helper.visitCastle(state, 'friend_1', 1000)).toThrow('上限');
    });
  });

  // ─── spar ─────────────────────────────────

  describe('spar', () => {
    it('胜利应获得更多友情点', () => {
      const win = helper.spar(baseState, 'friend_1', true, 1000);
      const lose = helper.spar(baseState, 'friend_1', false, 1000);
      expect(win.pointsEarned).toBeGreaterThan(lose.pointsEarned);
    });

    it('达到每日上限应抛错', () => {
      const state: SocialState = {
        ...baseState,
        dailyInteractions: Array.from({ length: 3 }, () => ({
          type: InteractionType.SPAR,
          targetFriendId: 'friend_1',
          timestamp: 1000,
        })),
      };
      expect(() => helper.spar(state, 'friend_1', true, 1000)).toThrow('上限');
    });
  });

  // ─── calculateFriendshipEarned ────────────

  describe('calculateFriendshipEarned', () => {
    it('未达上限应返回全部基础点数', () => {
      const result = helper.calculateFriendshipEarned(baseState, 10);
      expect(result).toBe(10);
    });

    it('接近上限应返回剩余量', () => {
      const state: SocialState = { ...baseState, dailyFriendshipEarned: 195 };
      const result = helper.calculateFriendshipEarned(state, 10);
      expect(result).toBe(5);
    });

    it('已达上限应返回0', () => {
      const state: SocialState = { ...baseState, dailyFriendshipEarned: 200 };
      const result = helper.calculateFriendshipEarned(state, 10);
      expect(result).toBe(0);
    });
  });

  // ─── getDailyInteractionCount ─────────────

  describe('getDailyInteractionCount', () => {
    it('应返回今日指定类型的互动次数', () => {
      const state: SocialState = {
        ...baseState,
        dailyInteractions: [
          { type: InteractionType.GIFT_TROOPS, targetFriendId: 'f1', timestamp: 1000 },
          { type: InteractionType.GIFT_TROOPS, targetFriendId: 'f2', timestamp: 1000 },
          { type: InteractionType.SPAR, targetFriendId: 'f1', timestamp: 1000 },
        ],
      };
      expect(helper.getDailyInteractionCount(state, InteractionType.GIFT_TROOPS, 1000)).toBe(2);
      expect(helper.getDailyInteractionCount(state, InteractionType.SPAR, 1000)).toBe(1);
    });
  });

  // ─── getConfig ────────────────────────────

  describe('getConfig', () => {
    it('应返回配置副本', () => {
      const c = helper.getConfig();
      expect(c.borrowDailyLimit).toBe(DEFAULT_INTERACTION_CONFIG.borrowDailyLimit);
    });
  });
});
