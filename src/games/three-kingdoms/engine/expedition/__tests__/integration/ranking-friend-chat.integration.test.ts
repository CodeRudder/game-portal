/**
 * 集成测试 §5-6: 排行榜+好友系统串联
 *
 * 覆盖 Play 流程：
 *   §5.1 多维度排名
 *   §5.2 排名奖励与展示
 *   §6.1 好友面板与添加
 *   §6.2 好友互动
 *   §6.3 借将系统
 *   §6.4 友情点与友情商店
 *   §6.5 好友删除规则
 *
 * 跨系统联动：RankingSystem ↔ FriendSystem ↔ ChatSystem ↔ ArenaSystem
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { RankingSystem, RankingDimension, DEFAULT_RANKING_CONFIG } from '../../../pvp/RankingSystem';
import { FriendSystem } from '../../../social/FriendSystem';
import { ChatSystem, DEFAULT_CHANNEL_CONFIGS, MUTE_DURATIONS } from '../../../social/ChatSystem';
import { PvPBattleSystem } from '../../../pvp/PvPBattleSystem';
import { ArenaSystem, createDefaultArenaPlayerState } from '../../../pvp/ArenaSystem';
import {
  FriendStatus,
  InteractionType,
  ChatChannel,
  MuteLevel,
  ReportType,
} from '../../../../core/social/social.types';
import type {
  FriendData,
  FriendRequest,
  SocialState,
  ChatMessage,
} from '../../../../core/social/social.types';
import type { ArenaOpponent, ArenaPlayerState } from '../../../../core/pvp/pvp.types';
import type { Faction } from '../../../hero/hero.types';
import { FormationType, AIDefenseStrategy } from '../../../../core/pvp/pvp.types';

// ── 辅助函数 ──────────────────────────────

function createOpponent(overrides: Partial<ArenaOpponent> = {}): ArenaOpponent {
  return {
    playerId: 'p1',
    playerName: 'Player1',
    power: 10000,
    rankId: 'BRONZE_V',
    score: 100,
    ranking: 10,
    faction: 'wei' as Faction,
    defenseSnapshot: null,
    ...overrides,
  };
}

function createFriend(overrides: Partial<FriendData> = {}): FriendData {
  return {
    playerId: 'friend_1',
    playerName: 'Friend1',
    status: FriendStatus.ONLINE,
    power: 8000,
    lastOnlineTime: Date.now(),
    friendSince: Date.now() - 86400000,
    ...overrides,
  };
}

function createDefaultSocialState(): SocialState {
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
      [ChatChannel.WORLD]: [],
      [ChatChannel.GUILD]: [],
      [ChatChannel.PRIVATE]: [],
      [ChatChannel.SYSTEM]: [],
    },
    lastSendTime: {},
    muteRecords: [],
    reportRecords: [],
    falseReportCounts: {},
  };
}

function createPlayerWithHeroes(
  score: number,
  heroCount: number,
  ranking: number = 100,
): ArenaPlayerState {
  const state = createDefaultArenaPlayerState('test_player');
  const slots: [string, string, string, string, string] = ['', '', '', '', ''];
  for (let i = 0; i < Math.min(heroCount, 5); i++) {
    slots[i] = `hero_${i}`;
  }
  return {
    ...state,
    score,
    ranking,
    defenseFormation: {
      slots,
      formation: FormationType.FISH_SCALE,
      strategy: AIDefenseStrategy.BALANCED,
    },
  };
}

// ── §5.1 多维度排名 ────────────────────────

describe('§5-6 排行榜+好友系统串联', () => {
  let ranking: RankingSystem;
  let friend: FriendSystem;
  let chat: ChatSystem;
  let arena: ArenaSystem;
  let battle: PvPBattleSystem;

  beforeEach(() => {
    ranking = new RankingSystem();
    friend = new FriendSystem();
    chat = new ChatSystem();
    arena = new ArenaSystem();
    battle = new PvPBattleSystem();
  });

  describe('§5.1 多维度排名', () => {
    it('应支持积分/战力/赛季三个维度', () => {
      const dims = ranking.getDimensions();
      expect(dims).toContain(RankingDimension.SCORE);
      expect(dims).toContain(RankingDimension.POWER);
      expect(dims).toContain(RankingDimension.SEASON);
    });

    it('应按积分降序排列', () => {
      const players = [
        createOpponent({ playerId: 'p1', score: 100, power: 5000 }),
        createOpponent({ playerId: 'p2', score: 500, power: 8000 }),
        createOpponent({ playerId: 'p3', score: 300, power: 6000 }),
      ];

      const data = ranking.updateRanking(RankingDimension.SCORE, players, Date.now());
      expect(data.entries[0].playerId).toBe('p2');
      expect(data.entries[1].playerId).toBe('p3');
      expect(data.entries[2].playerId).toBe('p1');
    });

    it('应按战力降序排列', () => {
      const players = [
        createOpponent({ playerId: 'p1', score: 100, power: 5000 }),
        createOpponent({ playerId: 'p2', score: 500, power: 8000 }),
        createOpponent({ playerId: 'p3', score: 300, power: 6000 }),
      ];

      const data = ranking.updateRanking(RankingDimension.POWER, players, Date.now());
      expect(data.entries[0].playerId).toBe('p2');
      expect(data.entries[1].playerId).toBe('p3');
      expect(data.entries[2].playerId).toBe('p1');
    });

    it('应获取玩家排名(1-based)', () => {
      const players = [
        createOpponent({ playerId: 'p1', score: 100 }),
        createOpponent({ playerId: 'p2', score: 500 }),
      ];
      ranking.updateRanking(RankingDimension.SCORE, players, Date.now());
      expect(ranking.getPlayerRank(RankingDimension.SCORE, 'p2')).toBe(1);
      expect(ranking.getPlayerRank(RankingDimension.SCORE, 'p1')).toBe(2);
    });

    it('未入榜玩家排名为0', () => {
      ranking.updateRanking(RankingDimension.SCORE, [], Date.now());
      expect(ranking.getPlayerRank(RankingDimension.SCORE, 'unknown')).toBe(0);
    });

    it('应获取Top N玩家', () => {
      const players = Array.from({ length: 20 }, (_, i) =>
        createOpponent({ playerId: `p${i}`, score: 100 - i, power: 1000 - i }),
      );
      ranking.updateRanking(RankingDimension.SCORE, players, Date.now());
      const top5 = ranking.getTopPlayers(RankingDimension.SCORE, 5);
      expect(top5.length).toBe(5);
      expect(top5[0].value).toBeGreaterThan(top5[4].value);
    });

    it('应获取附近玩家', () => {
      const players = Array.from({ length: 20 }, (_, i) =>
        createOpponent({ playerId: `p${i}`, score: 100 - i, power: 1000 - i }),
      );
      ranking.updateRanking(RankingDimension.SCORE, players, Date.now());
      const nearby = ranking.getNearbyPlayers(RankingDimension.SCORE, 'p10', 3);
      expect(nearby.length).toBeLessThanOrEqual(7); // 3 before + self + 3 after
    });

    it('排行榜最大显示100条', () => {
      expect(DEFAULT_RANKING_CONFIG.maxDisplayCount).toBe(100);
    });

    it('应检查是否需要刷新', () => {
      expect(ranking.needsRefresh(RankingDimension.SCORE, Date.now())).toBe(true);
      ranking.updateRanking(RankingDimension.SCORE, [], Date.now());
      expect(ranking.needsRefresh(RankingDimension.SCORE, Date.now())).toBe(false);
    });

    it('应获取条目数量', () => {
      const players = [
        createOpponent({ playerId: 'p1', score: 100 }),
        createOpponent({ playerId: 'p2', score: 200 }),
      ];
      ranking.updateRanking(RankingDimension.SCORE, players, Date.now());
      expect(ranking.getEntryCount(RankingDimension.SCORE)).toBe(2);
    });
  });

  describe('§5.2 排名奖励与展示', () => {
    it('段位每日奖励应通过grantDailyReward发放', () => {
      const state = createPlayerWithHeroes(3000, 3, 50);
      const reward = battle.getDailyReward(state.rankId);
      expect(reward.copper).toBeGreaterThan(0);
      expect(reward.arenaCoin).toBeGreaterThan(0);
      expect(reward.gold).toBeGreaterThan(0);
    });

    it('高段位每日奖励应高于低段位', () => {
      const bronzeReward = battle.getDailyReward('BRONZE_V');
      const goldReward = battle.getDailyReward('GOLD_I');
      expect(goldReward.copper).toBeGreaterThan(bronzeReward.copper);
    });

    it('排行榜序列化应保持数据一致', () => {
      const players = [
        createOpponent({ playerId: 'p1', score: 100 }),
      ];
      ranking.updateRanking(RankingDimension.SCORE, players, Date.now());
      const serialized = ranking.serialize();
      expect(serialized.version).toBe(1);
      expect(serialized.scoreRanking.entries.length).toBe(1);
    });
  });

  describe('§6.1 好友面板与添加', () => {
    it('应添加好友', () => {
      let state = createDefaultSocialState();
      state = friend.addFriend(state, createFriend({ playerId: 'f1' }));
      expect(Object.keys(state.friends).length).toBe(1);
      expect(state.friends['f1']).toBeDefined();
    });

    it('好友数量达上限应抛出异常', () => {
      let state = createDefaultSocialState();
      // Fill up to 50 friends
      for (let i = 0; i < 50; i++) {
        state = friend.addFriend(state, createFriend({ playerId: `f${i}` }));
      }
      expect(() => friend.addFriend(state, createFriend({ playerId: 'f50' }))).toThrow('上限');
    });

    it('重复添加好友应抛出异常', () => {
      let state = createDefaultSocialState();
      state = friend.addFriend(state, createFriend({ playerId: 'f1' }));
      expect(() => friend.addFriend(state, createFriend({ playerId: 'f1' }))).toThrow('已经是好友');
    });

    it('应发送好友申请', () => {
      let state = createDefaultSocialState();
      state = friend.sendFriendRequest(state, 'me', 'Me', 'target', Date.now());
      expect(state.pendingRequests.length).toBe(1);
      expect(state.dailyRequestsSent).toBe(1);
    });

    it('每日申请上限20次', () => {
      let state = createDefaultSocialState();
      state.dailyRequestsSent = 20;
      expect(() => friend.sendFriendRequest(state, 'me', 'Me', 'target', Date.now())).toThrow('上限');
    });

    it('应接受好友申请', () => {
      let state = createDefaultSocialState();
      state = friend.sendFriendRequest(state, 'sender', 'Sender', 'me', Date.now());
      const requestId = state.pendingRequests[0].id;
      state = friend.acceptFriendRequest(state, requestId, createFriend({ playerId: 'sender' }));
      expect(state.friends['sender']).toBeDefined();
      expect(state.pendingRequests.length).toBe(0);
    });

    it('应拒绝好友申请', () => {
      let state = createDefaultSocialState();
      state = friend.sendFriendRequest(state, 'sender', 'Sender', 'me', Date.now());
      const requestId = state.pendingRequests[0].id;
      state = friend.rejectFriendRequest(state, requestId);
      expect(state.pendingRequests.length).toBe(0);
      expect(state.friends['sender']).toBeUndefined();
    });

    it('应获取好友列表', () => {
      let state = createDefaultSocialState();
      state = friend.addFriend(state, createFriend({ playerId: 'f1' }));
      state = friend.addFriend(state, createFriend({ playerId: 'f2' }));
      const list = friend.getFriendList(state);
      expect(list.length).toBe(2);
    });

    it('应获取在线好友', () => {
      let state = createDefaultSocialState();
      state = friend.addFriend(state, createFriend({ playerId: 'f1', status: FriendStatus.ONLINE }));
      state = friend.addFriend(state, createFriend({ playerId: 'f2', status: FriendStatus.OFFLINE }));
      const online = friend.getOnlineFriends(state);
      expect(online.length).toBe(1);
      expect(online[0].playerId).toBe('f1');
    });

    it('canAddFriend应正确判断', () => {
      const state = createDefaultSocialState();
      expect(friend.canAddFriend(state)).toBe(true);
    });
  });

  describe('§6.2 好友互动', () => {
    it('应赠送兵力并获得友情点', () => {
      let state = createDefaultSocialState();
      state = friend.addFriend(state, createFriend({ playerId: 'f1' }));
      const result = friend.giftTroops(state, 'f1', Date.now());
      expect(result.friendshipEarned).toBeGreaterThan(0);
    });

    it('应拜访主城并获得铜钱', () => {
      let state = createDefaultSocialState();
      state = friend.addFriend(state, createFriend({ playerId: 'f1' }));
      const result = friend.visitCastle(state, 'f1', Date.now());
      expect(result.copperReward).toBeGreaterThan(0);
    });

    it('切磋胜利应获得更多友情点', () => {
      let state = createDefaultSocialState();
      state = friend.addFriend(state, createFriend({ playerId: 'f1' }));
      const winResult = friend.spar(state, 'f1', true, Date.now());
      const loseResult = friend.spar(state, 'f1', false, Date.now());
      expect(winResult.friendshipEarned).toBeGreaterThanOrEqual(loseResult.friendshipEarned);
    });

    it('应获取今日互动次数', () => {
      let state = createDefaultSocialState();
      state = friend.addFriend(state, createFriend({ playerId: 'f1' }));
      state = friend.giftTroops(state, 'f1', Date.now()).state;
      const count = friend.getDailyInteractionCount(state, InteractionType.GIFT_TROOPS);
      expect(count).toBe(1);
    });

    it('每日重置应清零互动和申请计数', () => {
      let state = createDefaultSocialState();
      state.dailyRequestsSent = 10;
      state.dailyFriendshipEarned = 100;
      state.dailyBorrowCount = 3;
      state = friend.dailyReset(state);
      expect(state.dailyRequestsSent).toBe(0);
      expect(state.dailyInteractions).toEqual([]);
      expect(state.dailyFriendshipEarned).toBe(0);
      expect(state.dailyBorrowCount).toBe(0);
    });
  });

  describe('§6.3 借将系统', () => {
    it('应借将并记录', () => {
      let state = createDefaultSocialState();
      state = friend.addFriend(state, createFriend({ playerId: 'lender' }));
      const result = friend.borrowHero(state, 'hero_001', 'lender', 'borrower', Date.now());
      expect(result.powerRatio).toBe(0.8);
      expect(result.state.activeBorrows.length).toBe(1);
    });

    it('应归还借将', () => {
      let state = createDefaultSocialState();
      state = friend.addFriend(state, createFriend({ playerId: 'lender' }));
      const borrowResult = friend.borrowHero(state, 'hero_001', 'lender', 'borrower', Date.now());
      const borrowId = borrowResult.state.activeBorrows[0].id;
      const returnState = friend.returnBorrowedHero(borrowResult.state, borrowId);
      expect(returnState.activeBorrows[0].returned).toBe(true);
    });

    it('借将不可用于PvP', () => {
      expect(friend.isBorrowHeroAllowedInPvP()).toBe(false);
    });
  });

  describe('§6.4 友情点与友情商店', () => {
    it('友情点每日获取上限200', () => {
      const config = friend.getInteractionConfig();
      expect(config.friendshipDailyCap).toBe(200);
    });

    it('赠送兵力每次5友情点', () => {
      const config = friend.getInteractionConfig();
      expect(config.giftTroopsFriendshipPoints).toBe(5);
    });

    it('拜访每次100铜钱', () => {
      const config = friend.getInteractionConfig();
      expect(config.visitCopperReward).toBe(100);
    });

    it('切磋胜利20友情点', () => {
      const config = friend.getInteractionConfig();
      expect(config.sparWinPoints).toBe(20);
    });

    it('切磋失败5友情点', () => {
      const config = friend.getInteractionConfig();
      expect(config.sparLosePoints).toBe(5);
    });

    it('借将战力80%折算', () => {
      const config = friend.getInteractionConfig();
      expect(config.borrowPowerRatio).toBe(0.8);
    });
  });

  describe('§6.5 好友删除规则', () => {
    it('应删除好友', () => {
      let state = createDefaultSocialState();
      state = friend.addFriend(state, createFriend({ playerId: 'f1' }));
      state = friend.removeFriend(state, 'f1', Date.now());
      expect(state.friends['f1']).toBeUndefined();
    });

    it('删除非好友应抛出异常', () => {
      const state = createDefaultSocialState();
      expect(() => friend.removeFriend(state, 'nonexistent', Date.now())).toThrow('不是好友');
    });

    it('删除后应设置24h冷却', () => {
      const now = Date.now();
      let state = createDefaultSocialState();
      state = friend.addFriend(state, createFriend({ playerId: 'f1' }));
      state = friend.removeFriend(state, 'f1', now);
      expect(state.deleteCooldowns['f1']).toBe(now + 24 * 60 * 60 * 1000);
    });

    it('冷却期内不可删除同一好友', () => {
      const now = Date.now();
      let state = createDefaultSocialState();
      state = friend.addFriend(state, createFriend({ playerId: 'f1' }));
      state = friend.removeFriend(state, 'f1', now);
      // Re-add and try to delete again during cooldown
      state = friend.addFriend(state, createFriend({ playerId: 'f1' }));
      expect(() => friend.removeFriend(state, 'f1', now + 1000)).toThrow('冷却中');
    });

    it('canRemoveFriend应正确判断', () => {
      const now = Date.now();
      let state = createDefaultSocialState();
      state = friend.addFriend(state, createFriend({ playerId: 'f1' }));
      expect(friend.canRemoveFriend(state, 'f1', now)).toBe(true);
      expect(friend.canRemoveFriend(state, 'nonexistent', now)).toBe(false);
    });
  });

  describe('§7 聊天系统', () => {
    it('4个频道配置应正确', () => {
      expect(chat.getChannelCount()).toBe(4);
    });

    it('世界频道100条48h保留10s间隔', () => {
      const config = chat.getChannelConfig(ChatChannel.WORLD);
      expect(config.maxMessages).toBe(100);
      expect(config.retentionMs).toBe(48 * 60 * 60 * 1000);
      expect(config.sendIntervalMs).toBe(10 * 1000);
    });

    it('公会频道100条48h保留5s间隔', () => {
      const config = chat.getChannelConfig(ChatChannel.GUILD);
      expect(config.maxMessages).toBe(100);
      expect(config.sendIntervalMs).toBe(5 * 1000);
    });

    it('私聊50条7天保留3s间隔', () => {
      const config = chat.getChannelConfig(ChatChannel.PRIVATE);
      expect(config.maxMessages).toBe(50);
      expect(config.retentionMs).toBe(7 * 24 * 60 * 60 * 1000);
      expect(config.sendIntervalMs).toBe(3 * 1000);
    });

    it('系统频道30天保留', () => {
      const config = chat.getChannelConfig(ChatChannel.SYSTEM);
      expect(config.retentionMs).toBe(30 * 24 * 60 * 60 * 1000);
    });

    it('应发送世界频道消息', () => {
      const now = Date.now();
      let state = createDefaultSocialState();
      const result = chat.sendMessage(state, ChatChannel.WORLD, 'user1', 'User1', 'Hello', now);
      expect(result.message.content).toBe('Hello');
      expect(result.state.chatMessages[ChatChannel.WORLD].length).toBe(1);
    });

    it('发言间隔太短应抛出异常', () => {
      const now = Date.now();
      let state = createDefaultSocialState();
      state = chat.sendMessage(state, ChatChannel.WORLD, 'user1', 'User1', 'Msg1', now).state;
      expect(() =>
        chat.sendMessage(state, ChatChannel.WORLD, 'user1', 'User1', 'Msg2', now + 1000),
      ).toThrow('发言间隔');
    });

    it('系统频道仅官方可发', () => {
      const now = Date.now();
      const state = createDefaultSocialState();
      expect(() =>
        chat.sendMessage(state, ChatChannel.SYSTEM, 'user1', 'User1', 'Hack', now),
      ).toThrow('仅限官方');
    });

    it('私聊需要指定目标', () => {
      const now = Date.now();
      const state = createDefaultSocialState();
      expect(() =>
        chat.sendMessage(state, ChatChannel.PRIVATE, 'user1', 'User1', 'Hi', now),
      ).toThrow('指定目标');
    });

    it('禁言期间不可发言', () => {
      const now = Date.now();
      let state = createDefaultSocialState();
      state = chat.mutePlayer(state, 'user1', MuteLevel.LEVEL_1, 'test', now);
      expect(() =>
        chat.sendMessage(state, ChatChannel.WORLD, 'user1', 'User1', 'Hello', now + 100),
      ).toThrow('禁言');
    });

    it('一级禁言1小时', () => {
      expect(MUTE_DURATIONS[MuteLevel.LEVEL_1]).toBe(60 * 60 * 1000);
    });

    it('二级禁言24小时', () => {
      expect(MUTE_DURATIONS[MuteLevel.LEVEL_2]).toBe(24 * 60 * 60 * 1000);
    });

    it('三级禁言7天', () => {
      expect(MUTE_DURATIONS[MuteLevel.LEVEL_3]).toBe(7 * 24 * 60 * 60 * 1000);
    });

    it('应解除禁言', () => {
      const now = Date.now();
      let state = createDefaultSocialState();
      state = chat.mutePlayer(state, 'user1', MuteLevel.LEVEL_2, 'test', now);
      expect(chat.isPlayerMuted(state, 'user1', now + 100)).toBe(true);
      state = chat.unmutePlayer(state, 'user1', now + 100);
      expect(chat.isPlayerMuted(state, 'user1', now + 100)).toBe(false);
    });

    it('应举报消息', () => {
      const now = Date.now();
      let state = createDefaultSocialState();
      const result = chat.reportMessage(
        state,
        'reporter',
        'target',
        'msg_1',
        ReportType.CHEATING,
        now,
      );
      expect(result.isFalseReport).toBe(false);
      expect(result.state.reportRecords.length).toBe(1);
    });

    it('恶意举报3次后自动禁言', () => {
      const now = Date.now();
      let state = createDefaultSocialState();
      state.falseReportCounts['reporter'] = 3;
      const result = chat.reportMessage(
        state,
        'reporter',
        'target',
        'msg_1',
        ReportType.OTHER,
        now,
      );
      expect(result.isFalseReport).toBe(true);
    });

    it('应清理过期消息', () => {
      const now = Date.now();
      let state = createDefaultSocialState();
      state = chat.sendMessage(state, ChatChannel.WORLD, 'user1', 'User1', 'Old', now - 49 * 60 * 60 * 1000).state;
      state = chat.sendMessage(state, ChatChannel.WORLD, 'user1', 'User1', 'New', now).state;
      const cleaned = chat.cleanExpiredMessages(state, now);
      const worldMsgs = cleaned.chatMessages[ChatChannel.WORLD];
      expect(worldMsgs.length).toBe(1);
      expect(worldMsgs[0].content).toBe('New');
    });

    it('应获取私聊消息', () => {
      const now = Date.now();
      let state = createDefaultSocialState();
      state = chat.sendMessage(state, ChatChannel.PRIVATE, 'user1', 'User1', 'Hi', now, 'user2').state;
      state = chat.sendMessage(state, ChatChannel.PRIVATE, 'user2', 'User2', 'Hello', now + 5000, 'user1').state;
      const privateMsgs = chat.getPrivateMessages(state, 'user1', 'user2');
      expect(privateMsgs.length).toBe(2);
    });
  });

  describe('§9.8 排行榜→竞技场→好友社交串联', () => {
    it('完整串联: 排行→查看→添加好友→互动', () => {
      // 1. 创建排行榜
      const players = [
        createOpponent({ playerId: 'top1', playerName: 'TopPlayer', score: 5000, power: 20000 }),
        createOpponent({ playerId: 'top2', playerName: 'SecondPlayer', score: 4000, power: 18000 }),
      ];
      ranking.updateRanking(RankingDimension.SCORE, players, Date.now());

      // 2. 查看排行榜
      const topPlayers = ranking.getTopPlayers(RankingDimension.SCORE, 10);
      expect(topPlayers.length).toBe(2);
      expect(topPlayers[0].playerId).toBe('top1');

      // 3. 添加好友
      let socialState = createDefaultSocialState();
      socialState = friend.addFriend(socialState, createFriend({
        playerId: 'top1',
        playerName: 'TopPlayer',
        power: 20000,
      }));
      expect(socialState.friends['top1']).toBeDefined();

      // 4. 赠送兵力
      const giftResult = friend.giftTroops(socialState, 'top1', Date.now());
      expect(giftResult.friendshipEarned).toBeGreaterThan(0);
    });
  });

  describe('§9.12 排行榜→好友→友情商店→实力提升→排名上升', () => {
    it('完整社交竞技正向循环', () => {
      // 1. 排行榜初始状态
      const players = [
        createOpponent({ playerId: 'me', score: 100, power: 5000 }),
        createOpponent({ playerId: 'other', score: 200, power: 6000 }),
      ];
      ranking.updateRanking(RankingDimension.SCORE, players, Date.now());
      const myRank = ranking.getPlayerRank(RankingDimension.SCORE, 'me');
      expect(myRank).toBe(2); // lower score

      // 2. 添加好友并互动
      let socialState = createDefaultSocialState();
      socialState = friend.addFriend(socialState, createFriend({ playerId: 'other' }));
      const sparResult = friend.spar(socialState, 'other', true, Date.now());
      expect(sparResult.friendshipEarned).toBeGreaterThan(0);

      // 3. 战斗提升积分
      const playerState = createPlayerWithHeroes(100, 3, 2);
      const updatedState = battle.applyScoreChange(playerState, 300);
      expect(updatedState.score).toBe(400);
      expect(updatedState.rankId).not.toBe('BRONZE_V');
    });
  });
});
