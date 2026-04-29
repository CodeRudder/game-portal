/**
 * BorrowHeroHelper 单元测试
 *
 * 覆盖：
 * 1. borrowHero — 借将（次数限制、好友校验、重复借出检查）
 * 2. returnBorrowedHero — 归还
 * 3. isBorrowHeroAllowedInPvP — PvP禁用
 * 4. getConfig — 获取配置
 */

import { BorrowHeroHelper } from '../BorrowHeroHelper';

import type { SocialState, InteractionConfig } from '../../../core/social/social.types';

describe('BorrowHeroHelper', () => {
  const config: InteractionConfig = {
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

  let helper: BorrowHeroHelper;

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
    friendshipPoints: 100,
    dailyFriendshipEarned: 0,
    dailyBorrowCount: 0,
    activeBorrows: [],
    dailyInteractions: [],
  };

  beforeEach(() => {
    helper = new BorrowHeroHelper(config);
  });

  // ─── borrowHero ───────────────────────────

  describe('borrowHero', () => {
    it('应成功借将', () => {
      const { state, powerRatio } = helper.borrowHero(
        baseState, 'hero_1', 'friend_1', 'player_1', 1000,
        (s, pts) => pts,
      );
      expect(state.dailyBorrowCount).toBe(1);
      expect(state.activeBorrows.length).toBe(1);
      expect(powerRatio).toBe(0.8);
    });

    it('达到每日上限应抛错', () => {
      const state = { ...baseState, dailyBorrowCount: 3 };
      expect(() => helper.borrowHero(state, 'hero_1', 'friend_1', 'player_1', 1000, (s, pts) => pts))
        .toThrow('今日借将次数已达上限');
    });

    it('非好友应抛错', () => {
      expect(() => helper.borrowHero(baseState, 'hero_1', 'stranger', 'player_1', 1000, (s, pts) => pts))
        .toThrow('不是好友');
    });

    it('已有未归还借将应抛错', () => {
      const state: SocialState = {
        ...baseState,
        activeBorrows: [{
          id: 'borrow_1',
          heroId: 'hero_old',
          lenderPlayerId: 'friend_1',
          borrowerPlayerId: 'player_1',
          borrowTime: 0,
          returned: false,
        }],
      };
      expect(() => helper.borrowHero(state, 'hero_1', 'friend_1', 'player_1', 1000, (s, pts) => pts))
        .toThrow('未归还');
    });

    it('出借方应获得友情点', () => {
      const { state } = helper.borrowHero(
        baseState, 'hero_1', 'friend_1', 'player_1', 1000,
        (s, pts) => pts,
      );
      expect(state.friendshipPoints).toBeGreaterThan(baseState.friendshipPoints);
    });
  });

  // ─── returnBorrowedHero ───────────────────

  describe('returnBorrowedHero', () => {
    it('应成功归还', () => {
      const borrowed: SocialState = {
        ...baseState,
        activeBorrows: [{
          id: 'borrow_1',
          heroId: 'hero_1',
          lenderPlayerId: 'friend_1',
          borrowerPlayerId: 'player_1',
          borrowTime: 0,
          returned: false,
        }],
      };
      const result = helper.returnBorrowedHero(borrowed, 'borrow_1');
      expect(result.activeBorrows[0].returned).toBe(true);
    });

    it('不存在的记录应抛错', () => {
      expect(() => helper.returnBorrowedHero(baseState, 'nonexistent'))
        .toThrow('不存在');
    });

    it('已归还应抛错', () => {
      const borrowed: SocialState = {
        ...baseState,
        activeBorrows: [{
          id: 'borrow_1',
          heroId: 'hero_1',
          lenderPlayerId: 'friend_1',
          borrowerPlayerId: 'player_1',
          borrowTime: 0,
          returned: true,
        }],
      };
      expect(() => helper.returnBorrowedHero(borrowed, 'borrow_1'))
        .toThrow('已归还');
    });
  });

  // ─── isBorrowHeroAllowedInPvP ─────────────

  describe('isBorrowHeroAllowedInPvP', () => {
    it('应始终返回 false', () => {
      expect(helper.isBorrowHeroAllowedInPvP()).toBe(false);
    });
  });

  // ─── getConfig ────────────────────────────

  describe('getConfig', () => {
    it('应返回配置副本', () => {
      const c = helper.getConfig();
      expect(c.borrowDailyLimit).toBe(3);
      expect(c).not.toBe(config);
    });
  });
});
