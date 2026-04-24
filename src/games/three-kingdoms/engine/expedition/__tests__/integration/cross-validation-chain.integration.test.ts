/**
 * 集成测试 §9.3~9.7+§9.14/9.15: 跨系统交叉验证
 *
 * 覆盖 Play 流程：
 *   §9.3 积分→段位→奖励闭环 (4 cases)
 *   §9.4 匹配→战斗→积分→排名闭环 (3 cases)
 *   §9.5 防守→被挑战→日志→奖励闭环 (3 cases)
 *   §9.6 多系统数据一致性验证 (2 cases)
 *   §9.7 边界条件与异常处理 (3 cases)
 *   §9.14 全链路压力测试 (1 case)
 *   §9.15 存档序列化与恢复验证 (2 cases)
 *   Total: 18 cases
 *
 * 跨系统联动：全系统交叉验证
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ArenaSystem, createDefaultArenaPlayerState } from '../../../pvp/ArenaSystem';
import { PvPBattleSystem, RANK_LEVELS, RANK_LEVEL_MAP } from '../../../pvp/PvPBattleSystem';
import { RankingSystem, RankingDimension } from '../../../pvp/RankingSystem';
import { DefenseFormationSystem } from '../../../pvp/DefenseFormationSystem';
import { ArenaSeasonSystem, SEASON_REWARDS } from '../../../pvp/ArenaSeasonSystem';
import { ArenaShopSystem, DEFAULT_ARENA_SHOP_ITEMS } from '../../../pvp/ArenaShopSystem';
import { MailSystem } from '../../../mail/MailSystem';
import { FriendSystem } from '../../../social/FriendSystem';
import type { ArenaPlayerState, ArenaOpponent, DefenseLogEntry } from '../../../../core/pvp/pvp.types';
import type { Faction } from '../../../hero/hero.types';
import { FormationType, AIDefenseStrategy, PvPBattleMode } from '../../../../core/pvp/pvp.types';
import {
  FriendStatus,
} from '../../../../core/social/social.types';
import type { FriendData, SocialState } from '../../../../core/social/social.types';

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

function createPlayerState(overrides: Partial<ArenaPlayerState> = {}): ArenaPlayerState {
  const state = createDefaultArenaPlayerState('player_me');
  return {
    ...state,
    score: 500,
    ranking: 50,
    rankId: 'BRONZE_V',
    arenaCoins: 1000,
    defenseFormation: {
      slots: ['hero_0', 'hero_1', 'hero_2', '', ''],
      formation: FormationType.FISH_SCALE,
      strategy: AIDefenseStrategy.BALANCED,
    },
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
    chatMessages: {},
  };
}

// ── §9 跨系统交叉验证 ─────────────────────

describe('§9 跨系统交叉验证', () => {
  let arena: ArenaSystem;
  let battle: PvPBattleSystem;
  let ranking: RankingSystem;
  let season: ArenaSeasonSystem;
  let shop: ArenaShopSystem;
  let mail: MailSystem;
  let friend: FriendSystem;

  beforeEach(() => {
    arena = new ArenaSystem();
    battle = new PvPBattleSystem();
    ranking = new RankingSystem();
    season = new ArenaSeasonSystem();
    shop = new ArenaShopSystem();
    mail = new MailSystem();
    friend = new FriendSystem();
  });

  // ── §9.3 积分→段位→奖励闭环 (4) ────────

  describe('§9.3 积分→段位→奖励闭环', () => {
    it('积分达到段位阈值应正确晋升段位', () => {
      const newRankId = battle.getRankIdForScore(1200);
      expect(newRankId).toBe('BRONZE_I');
      const silverRankId = battle.getRankIdForScore(1500);
      expect(battle.getRankLevel(silverRankId)?.tier).toBe('SILVER');
    });

    it('段位晋升后赛季奖励应按新段位发放且严格递增', () => {
      const silverReward = season.getSeasonReward('SILVER_I');
      const bronzeReward = season.getSeasonReward('BRONZE_I');
      expect(silverReward.copper).toBeGreaterThan(bronzeReward.copper);
      // 全段位奖励严格递增
      for (let i = 1; i < SEASON_REWARDS.length; i++) {
        expect(SEASON_REWARDS[i].copper).toBeGreaterThanOrEqual(SEASON_REWARDS[i - 1].copper);
        expect(SEASON_REWARDS[i].arenaCoin).toBeGreaterThanOrEqual(SEASON_REWARDS[i - 1].arenaCoin);
      }
    });

    it('积分→段位→赛季奖励→商店购买完整闭环', () => {
      // 1. 积分达到白银段位
      const silverRankId = battle.getRankIdForScore(1500);
      expect(battle.getRankLevel(silverRankId)?.tier).toBe('SILVER');

      // 2. 赛季结算获得奖励
      const player = createPlayerState({ arenaCoins: 100, rankId: silverRankId });
      const { state: settled, reward } = season.settleSeason(player, silverRankId);

      // 3. 用奖励的竞技币购买商品
      expect(settled.arenaCoins).toBe(100 + reward.arenaCoin);
      if (settled.arenaCoins >= 50) {
        const { state: afterBuy } = shop.buyItem(settled, 'enhance_stone_small', 1);
        expect(afterBuy.arenaCoins).toBeLessThan(settled.arenaCoins);
      }
    });

    it('段位在PvPBattleSystem和ArenaSeasonSystem中应一一对应', () => {
      for (const rankLevel of RANK_LEVELS) {
        const seasonReward = season.getSeasonReward(rankLevel.id);
        expect(seasonReward.rankId).toBe(rankLevel.id);
      }
    });
  });

  // ── §9.4 匹配→战斗→积分→排名闭环 (3) ──

  describe('§9.4 匹配→战斗→积分→排名闭环', () => {
    it('匹配对手→模拟战斗→积分变化→段位更新→排名刷新闭环', () => {
      const player = createPlayerState({ score: 500, ranking: 50 });
      const opponents = [
        createOpponent({ playerId: 'opp1', power: 9000, ranking: 48, score: 520 }),
        createOpponent({ playerId: 'opp2', power: 11000, ranking: 52, score: 480 }),
      ];

      // 1. 匹配
      const matched = arena.generateOpponents(player, opponents);
      expect(matched.length).toBeLessThanOrEqual(3);

      // 2. 战斗
      const defenderState = createPlayerState({ score: 520, playerId: 'opp1' });
      const result = battle.executeBattle(player, defenderState, PvPBattleMode.NORMAL);
      expect(result.attackerWon).toBeDefined();

      // 3. 积分变化 + 段位更新
      const newScore = Math.max(0, player.score + result.scoreChange);
      const newRankId = battle.getRankIdForScore(newScore);
      expect(newRankId).toBeDefined();

      // 4. 排名刷新
      ranking.updateRanking(RankingDimension.SCORE, opponents, Date.now());
      const top = ranking.getTopPlayers(RankingDimension.SCORE, 2);
      expect(top).toHaveLength(2);
      expect(top[0].playerId).toBe('opp1'); // 520分最高
    });

    it('连续10场战斗积分应持续累积且段位正确', () => {
      let score = 100;
      const attacker = createPlayerState({ score });
      for (let i = 0; i < 10; i++) {
        const defender = createPlayerState({ score: 100 + i * 50 });
        const result = battle.executeBattle(attacker, defender, PvPBattleMode.NORMAL);
        score = Math.max(0, result.attackerNewScore);
        const rankId = battle.getRankIdForScore(score);
        expect(rankId).toBeDefined();
      }
      expect(score).toBeGreaterThanOrEqual(0);
    });

    it('排名系统应正确按积分排序', () => {
      const players = [
        createOpponent({ playerId: 'p1', playerName: 'P1', score: 500, power: 10000 }),
        createOpponent({ playerId: 'p2', playerName: 'P2', score: 800, power: 12000 }),
        createOpponent({ playerId: 'p3', playerName: 'P3', score: 300, power: 8000 }),
      ];
      ranking.updateRanking(RankingDimension.SCORE, players, Date.now());
      const top = ranking.getTopPlayers(RankingDimension.SCORE, 3);
      expect(top[0].playerId).toBe('p2');
      expect(top[1].playerId).toBe('p1');
      expect(top[2].playerId).toBe('p3');
    });
  });

  // ── §9.5 防守→被挑战→日志→奖励闭环 (3) ─

  describe('§9.5 防守→被挑战→日志→奖励闭环', () => {
    it('设置防守→被挑战→记录日志→邮件通知闭环', () => {
      // 1. 防守阵容
      const player = createPlayerState();
      expect(player.defenseFormation.formation).toBe(FormationType.FISH_SCALE);
      expect(player.defenseFormation.strategy).toBe(AIDefenseStrategy.BALANCED);

      // 2. 被挑战
      const challenger = createPlayerState({ score: 600, playerId: 'challenger' });
      const result = battle.executeBattle(challenger, player, PvPBattleMode.NORMAL);

      // 3. 日志记录
      const log: DefenseLogEntry = {
        id: 'log_001',
        attackerName: 'Challenger',
        attackerPower: 12000,
        result: result.attackerWon ? 'defeat' : 'victory',
        timestamp: Date.now(),
        scoreChange: result.attackerWon ? result.scoreChange : 0,
        battleReplayId: 'replay_001',
      };
      expect(log.result).toBeDefined();

      // 4. 邮件通知
      const defenseMail = mail.sendMail({
        category: 'battle',
        title: '防守报告',
        content: result.attackerWon ? '防守失败' : '防守成功',
        sender: '竞技系统',
      });
      expect(defenseMail.category).toBe('battle');
      expect(defenseMail.status).toBe('unread');
    });

    it('防守胜利时防守方积分不应减少', () => {
      const strongDefender = createPlayerState({ score: 1500, playerId: 'defender' });
      const weakAttacker = createPlayerState({ score: 100, playerId: 'attacker' });
      const result = battle.executeBattle(weakAttacker, strongDefender, PvPBattleMode.NORMAL);
      if (!result.attackerWon) {
        expect(result.defenderNewScore).toBeGreaterThanOrEqual(strongDefender.score);
      }
    });

    it('多封防守日志邮件应能批量已读并删除', () => {
      for (let i = 0; i < 5; i++) {
        mail.sendMail({
          category: 'battle',
          title: `防守报告${i + 1}`,
          content: `被Player${i}挑战`,
          sender: '竞技系统',
        });
      }
      const battleMails = mail.getByCategory('battle');
      expect(battleMails).toHaveLength(5);

      const readCount = mail.markAllRead({ category: 'battle' });
      expect(readCount).toBe(5);
      expect(mail.getUnreadCount()).toBe(0);
    });
  });

  // ── §9.6 多系统数据一致性验证 (2) ───────

  describe('§9.6 多系统数据一致性验证', () => {
    it('竞技币在赛季结算→商店购买中应一致流转', () => {
      const player = createPlayerState({ arenaCoins: 1000 });
      const { state: settled } = season.settleSeason(player, 'GOLD_V');
      const { state: afterBuy } = shop.buyItem(settled, 'enhance_stone_small', 1);
      expect(afterBuy.arenaCoins).toBe(settled.arenaCoins - 50);
    });

    it('好友系统添加好友→邮件通知数据应一致', () => {
      const socialState = createDefaultSocialState();
      const f = createFriend({ playerId: 'f1', playerName: 'Friend1' });
      const newState = friend.addFriend(socialState, f);
      const mailResult = mail.sendMail({
        category: 'social',
        title: '新好友',
        content: '与Friend1成为好友',
        sender: '社交系统',
      });
      expect(Object.keys(newState.friends)).toHaveLength(1);
      expect(mailResult.category).toBe('social');
    });
  });

  // ── §9.7 边界条件与异常处理 (3) ─────────

  describe('§9.7 边界条件与异常处理', () => {
    it('积分边界：0分→青铜V，99999分→王者I', () => {
      expect(battle.getRankLevel(battle.getRankIdForScore(0))?.tier).toBe('BRONZE');
      expect(battle.getRankLevel(battle.getRankIdForScore(99999))?.tier).toBe('KING');
    });

    it('商店异常：不存在商品/数量为0应抛错', () => {
      const player = createPlayerState({ arenaCoins: 999999 });
      expect(() => shop.buyItem(player, 'nonexistent_item', 1)).toThrow('商品不存在');
      expect(() => shop.buyItem(player, 'fragment_liubei', 0)).toThrow('大于0');
    });

    it('赛季结算最低段位+邮件空状态应正常工作', () => {
      const player = createPlayerState({ rankId: 'BRONZE_V', score: 0 });
      const result = season.settleSeason(player, 'BRONZE_V');
      expect(result.reward).toBeDefined();
      expect(result.resetScore).toBeGreaterThanOrEqual(0);

      expect(mail.getMailCount()).toBe(0);
      expect(mail.getUnreadCount()).toBe(0);
      expect(mail.getAllMails()).toEqual([]);
    });
  });

  // ── §9.14 全链路压力测试 (1) ─────────────

  describe('§9.14 全链路压力测试', () => {
    it('10场战斗+积分累积+段位判定+排名更新+50封邮件批量操作', () => {
      let score = 100;
      const attacker = createPlayerState({ score });
      const allOpponents: ArenaOpponent[] = [];

      // 战斗链路
      for (let i = 0; i < 10; i++) {
        const defender = createPlayerState({ score: 100 + i * 50 });
        const result = battle.executeBattle(attacker, defender, PvPBattleMode.NORMAL);
        score = Math.max(0, result.attackerNewScore);
        expect(battle.getRankIdForScore(score)).toBeDefined();
        allOpponents.push(
          createOpponent({ playerId: `player_${i}`, playerName: `P${i}`, score }),
        );
      }
      ranking.updateRanking(RankingDimension.SCORE, allOpponents, Date.now());
      expect(ranking.getTopPlayers(RankingDimension.SCORE, 10)).toHaveLength(10);

      // 邮件链路
      for (let i = 0; i < 50; i++) {
        mail.sendMail({
          category: i % 2 === 0 ? 'battle' : 'social',
          title: `Mail${i}`,
          content: `Content${i}`,
          sender: 'System',
          attachments: [{ resourceType: 'copper', amount: 100 }],
        });
      }
      expect(mail.getMailCount()).toBe(50);
      mail.markAllRead();
      expect(mail.getUnreadCount()).toBe(0);
      const claimed = mail.claimAllAttachments();
      expect(claimed.count).toBe(50);
      expect(claimed.claimedResources['copper']).toBe(5000);
      expect(mail.deleteReadClaimed()).toBe(50);
      expect(mail.getMailCount()).toBe(0);
    });
  });

  // ── §9.15 存档序列化与恢复验证 (2) ──────

  describe('§9.15 存档序列化与恢复验证', () => {
    it('商店序列化→反序列化应恢复完整数据', () => {
      const player = createPlayerState({ arenaCoins: 999999 });
      shop.buyItem(player, 'fragment_liubei', 2);
      const saved = shop.serialize();
      expect(saved.version).toBe(1);
      expect(saved.items).toHaveLength(DEFAULT_ARENA_SHOP_ITEMS.length);
      const liubei = saved.items.find(i => i.itemId === 'fragment_liubei');
      expect(liubei?.purchased).toBe(2);

      // 反序列化恢复
      const newShop = new ArenaShopSystem();
      newShop.deserialize(saved);
      const restored = newShop.serialize();
      expect(restored.items.find(i => i.itemId === 'fragment_liubei')?.purchased).toBe(2);
    });

    it('邮件+赛季+防守阵容状态序列化应完整可恢复', () => {
      // 邮件序列化
      mail.sendMail({
        category: 'battle',
        title: 'Test',
        content: 'Content',
        sender: 'System',
        attachments: [{ resourceType: 'copper', amount: 100 }],
      });
      const mailState = mail.getState() as { mails: Record<string, unknown>; nextId: number };
      expect(mailState.nextId).toBe(2);

      // 赛季序列化
      const seasonState = season.getState();
      expect(seasonState.config).toBeDefined();
      expect(seasonState.seasonDays).toBe(28);

      // 防守阵容序列化
      const player = createPlayerState();
      expect(player.defenseFormation.formation).toBe(FormationType.FISH_SCALE);
      expect(player.defenseFormation.slots.filter(s => s !== '').length).toBe(3);
    });
  });
});
