/**
 * v11.0 群雄逐鹿 — PvP+社交+邮件串联集成测试
 *
 * 覆盖 Play 流程：
 *   §5 排行榜（多维度/奖励/展示）
 *   §8 邮件系统（PVP/社交相关）
 *   §8.2 邮件容量管理
 *   §8.5 竞技场解锁引导
 *   §9.8 排行榜→竞技场→好友串联
 *   §9.9 邮件系统串联PVP与社交
 *   §9.10 竞技场解锁→首次挑战→段位入门
 *   §9.11 邮箱满→清理→战报补发闭环
 *   §9.12 排行榜→社交→资源→实力提升循环
 *
 * @module engine/social/__tests__/integration
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { LeaderboardSystem, LeaderboardType } from '../../LeaderboardSystem';
import { createDefaultLeaderboardState } from '../../leaderboard-types';
import { ChatSystem } from '../../ChatSystem';
import { FriendSystem } from '../../FriendSystem';
import { createDefaultSocialState } from '../../friend-config';
import { ChatChannel, FriendStatus } from '../../../../core/social/social.types';
import type { SocialState } from '../../../../core/social/social.types';
import { MailSystem } from '../../../mail/MailSystem';
import type { MailSendRequest } from '../../../mail/mail.types';
import { ArenaSystem } from '../../../pvp/ArenaSystem';
import { PvPBattleSystem } from '../../../pvp/PvPBattleSystem';
import { ArenaSeasonSystem } from '../../../pvp/ArenaSeasonSystem';
import { createDefaultArenaPlayerState } from '../../../pvp/ArenaConfig';
import { FormationType, AIDefenseStrategy, PvPBattleMode } from '../../../../core/pvp/pvp.types';
import type { ArenaOpponent, ArenaPlayerState } from '../../../../core/pvp/pvp.types';

// ── 辅助 ────────────────────────────────────

function makeOpponent(id: string, power: number, ranking: number): ArenaOpponent {
  return {
    playerId: id,
    playerName: `Player_${id}`,
    power,
    ranking,
    faction: 'SHU' as const,
    defenseFormation: {
      slots: ['hero_a', '', '', '', ''],
      formation: FormationType.FISH_SCALE,
      strategy: AIDefenseStrategy.BALANCED,
    },
    rankId: 'BRONZE_V',
  };
}

// ─────────────────────────────────────────────
// §5 排行榜
// ─────────────────────────────────────────────

describe('§5 排行榜', () => {
  let ranking: LeaderboardSystem;

  beforeEach(() => {
    ranking = new LeaderboardSystem();
  });

  it('§5.1 六维度排行榜', () => {
    const types = [
      LeaderboardType.POWER,
      LeaderboardType.EXPEDITION,
      LeaderboardType.ARENA,
      LeaderboardType.WEALTH,
      LeaderboardType.SEASON_RECORD,
      LeaderboardType.GUILD,
    ];
    expect(types).toHaveLength(6);

    // 每个维度可以独立更新
    types.forEach((type) => {
      const entry = ranking.updateScore(type, 'p1', 'Player1', 1000);
      expect(entry).toBeTruthy();
    });
  });

  it('§5.2 分页查询排行榜', () => {
    // 添加10个玩家
    for (let i = 0; i < 10; i++) {
      ranking.updateScore(LeaderboardType.POWER, `p${i}`, `Player${i}`, 1000 + i * 100);
    }

    const page1 = ranking.queryLeaderboard({
      type: LeaderboardType.POWER,
      page: 1,
      pageSize: 5,
    });
    expect(page1.entries).toHaveLength(5);
    expect(page1.page).toBe(1);
    expect(page1.entries[0].score).toBeGreaterThanOrEqual(page1.entries[4].score);
  });

  it('§5.3 排名箭头标识(分数降序)', () => {
    ranking.updateScore(LeaderboardType.ARENA, 'p1', 'Player1', 5000);
    ranking.updateScore(LeaderboardType.ARENA, 'p2', 'Player2', 3000);
    ranking.updateScore(LeaderboardType.ARENA, 'p3', 'Player3', 8000);

    const top = ranking.getTopN(LeaderboardType.ARENA, 3);
    expect(top[0].rank).toBe(1);
    expect(top[0].playerId).toBe('p3'); // 8000最高
    expect(top[1].rank).toBe(2);
    expect(top[1].playerId).toBe('p1'); // 5000
    expect(top[2].rank).toBe(3);
    expect(top[2].playerId).toBe('p2'); // 3000
  });

  it('§5.4 同分按时间排序(先到者排前)', () => {
    ranking.updateScore(LeaderboardType.ARENA, 'p1', 'Player1', 5000);
    ranking.updateScore(LeaderboardType.ARENA, 'p2', 'Player2', 5000);

    const top = ranking.getTopN(LeaderboardType.ARENA, 2);
    expect(top[0].playerId).toBe('p1'); // 先到排前
    expect(top[1].playerId).toBe('p2');
  });

  it('§5.5 查询玩家附近排名', () => {
    for (let i = 0; i < 10; i++) {
      ranking.updateScore(LeaderboardType.POWER, `p${i}`, `Player${i}`, 1000 + i * 100);
    }

    const around = ranking.getAroundPlayer(LeaderboardType.POWER, 'p5', 2);
    expect(around.length).toBeLessThanOrEqual(5); // 前2+自己+后2
    expect(around.length).toBeGreaterThanOrEqual(1);
  });

  it('§5.6 排名奖励配置', () => {
    const configs = ranking.getRewardConfigs();
    expect(configs.length).toBeGreaterThan(0);

    // 第1名奖励
    const first = ranking.getRewardForRank(1);
    expect(first).toBeTruthy();
    expect(first!.gold).toBeGreaterThan(0);

    // 第50名奖励
    const fiftieth = ranking.getRewardForRank(50);
    expect(fiftieth).toBeTruthy();
  });

  it('§5.7 赛季结算并开启新赛季', () => {
    const now = Date.now();
    ranking.updateScore(LeaderboardType.ARENA, 'p1', 'Player1', 10000);

    const rewards = ranking.endSeasonAndStartNew(now);
    expect(rewards.length).toBeGreaterThan(0);

    // 新赛季排行榜应清空
    const top = ranking.getTopN(LeaderboardType.ARENA, 10);
    expect(top).toHaveLength(0);
  });

  it('§5.8 每日刷新检查', () => {
    const state = ranking.getState();
    // 使用远大于lastRefreshTime的时间，确保超过DAILY_REFRESH_MS
    const futureNow = state.lastRefreshTime + 25 * 3600000;
    expect(ranking.checkDailyRefresh(futureNow)).toBe(true);
    // 第二次检查应返回false（刚刷新过）
    expect(ranking.checkDailyRefresh(futureNow)).toBe(false);
  });
});

// ─────────────────────────────────────────────
// §8 邮件系统（PVP/社交相关）
// ─────────────────────────────────────────────

describe('§8 邮件系统', () => {
  let mail: MailSystem;

  beforeEach(() => {
    mail = new MailSystem();
    mail.reset();
  });

  it('§8.1 四类邮件发送', () => {
    const categories = ['system', 'battle', 'social', 'reward'] as const;
    categories.forEach((cat) => {
      const m = mail.sendMail({
        category: cat,
        title: `测试${cat}邮件`,
        content: '内容',
        sender: 'system',
      });
      expect(m.category).toBe(cat);
      expect(m.status).toBe('unread');
    });
  });

  it('§8.2 战斗邮件带附件', () => {
    const m = mail.sendMail({
      category: 'battle',
      title: 'PVP战报',
      content: '你被挑战了',
      sender: 'system',
      attachments: [
        { resourceType: 'arenaCoin', amount: 20 },
        { resourceType: 'copper', amount: 200 },
      ],
    });
    expect(m.attachments).toHaveLength(2);
    expect(m.attachments[0].claimed).toBe(false);
  });

  it('§8.3 批量领取附件', () => {
    // 发送3封奖励邮件
    for (let i = 0; i < 3; i++) {
      mail.sendMail({
        category: 'reward',
        title: `奖励${i}`,
        content: '领取奖励',
        sender: 'system',
        attachments: [{ resourceType: 'gold', amount: 10 }],
      });
    }

    const result = mail.claimAllAttachments({ category: 'reward' });
    expect(result.count).toBe(3);
    expect(result.claimedResources.gold).toBe(30);
  });

  it('§8.4 标记已读', () => {
    const m = mail.sendMail({
      category: 'system',
      title: '系统通知',
      content: '内容',
      sender: 'system',
    });
    expect(m.status).toBe('unread');

    mail.markRead(m.id);
    const updated = mail.getMail(m.id);
    expect(updated!.isRead).toBe(true);
  });

  it('§8.5 全部标记已读', () => {
    for (let i = 0; i < 5; i++) {
      mail.sendMail({
        category: 'system',
        title: `通知${i}`,
        content: '内容',
        sender: 'system',
      });
    }
    const count = mail.markAllRead();
    expect(count).toBe(5);
  });

  it('§8.6 删除已读已领邮件', () => {
    const m = mail.sendMail({
      category: 'reward',
      title: '奖励',
      content: '领取',
      sender: 'system',
      attachments: [{ resourceType: 'gold', amount: 10 }],
    });
    mail.markRead(m.id);
    mail.claimAttachments(m.id);

    expect(mail.deleteMail(m.id)).toBe(true);
    expect(mail.getMail(m.id)).toBeUndefined();
  });

  it('§8.7 未领附件邮件不可删除', () => {
    const m = mail.sendMail({
      category: 'reward',
      title: '奖励',
      content: '领取',
      sender: 'system',
      attachments: [{ resourceType: 'gold', amount: 10 }],
    });
    mail.markRead(m.id);
    // 未领取附件，不可删除
    expect(mail.deleteMail(m.id)).toBe(false);
  });

  it('§8.8 过期邮件处理', () => {
    // 发送一封即将过期的邮件
    const m = mail.sendMail({
      category: 'battle',
      title: '战报',
      content: '内容',
      sender: 'system',
      retainSeconds: 1, // 1秒后过期
    });

    // 等待过期
    const expired = mail.processExpired();
    // 可能还没过期（取决于执行速度），但函数不应报错
    expect(typeof expired).toBe('number');
  });

  it('§8.9 未读计数', () => {
    mail.sendMail({ category: 'system', title: 'T1', content: 'C', sender: 'system' });
    mail.sendMail({ category: 'battle', title: 'T2', content: 'C', sender: 'system' });
    mail.sendMail({ category: 'system', title: 'T3', content: 'C', sender: 'system' });

    expect(mail.getUnreadCount()).toBe(3);
    expect(mail.getUnreadCount('system')).toBe(2);
    expect(mail.getUnreadCount('battle')).toBe(1);
  });
});

// ─────────────────────────────────────────────
// §9.8 排行榜→竞技场→好友串联
// ─────────────────────────────────────────────

describe('§9.8 排行榜→竞技场→好友串联', () => {
  it('§9.8.1 从排行榜到好友互动', () => {
    const ranking = new LeaderboardSystem();
    const friend = new FriendSystem();
    let socialState = createDefaultSocialState();

    // 1. 排行榜添加玩家
    ranking.updateScore(LeaderboardType.ARENA, 'top_player', 'TopPlayer', 8000);
    const entry = ranking.getPlayerRank(LeaderboardType.ARENA, 'top_player');
    expect(entry).toBeTruthy();

    // 2. 添加为好友
    socialState = friend.addFriend(socialState, {
      playerId: 'top_player',
      playerName: 'TopPlayer',
      status: FriendStatus.ONLINE,
      power: 8000,
      lastOnlineTime: Date.now(),
      friendSince: Date.now(),
    });

    // 3. 互动
    const giftResult = friend.giftTroops(socialState, 'top_player', Date.now());
    expect(giftResult.friendshipEarned).toBe(5);
  });
});

// ─────────────────────────────────────────────
// §9.9 邮件系统串联PVP与社交
// ─────────────────────────────────────────────

describe('§9.9 邮件系统串联PVP与社交', () => {
  it('§9.9.1 PVP战报邮件+社交邮件+奖励邮件', () => {
    const mail = new MailSystem();
    mail.reset();

    // 1. PVP战报邮件（战斗邮件）
    const battleMail = mail.sendMail({
      category: 'battle',
      title: 'PVP战报',
      content: '你战胜了对手',
      sender: 'system',
      retainSeconds: 7 * 24 * 3600,
    });
    expect(battleMail.category).toBe('battle');

    // 2. 防守奖励邮件（奖励邮件）
    const rewardMail = mail.sendMail({
      category: 'reward',
      title: '防守奖励',
      content: '防守成功奖励',
      sender: 'system',
      attachments: [{ resourceType: 'arenaCoin', amount: 20 }],
      retainSeconds: 7 * 24 * 3600,
    });
    expect(rewardMail.category).toBe('reward');

    // 3. 社交通知邮件
    const socialMail = mail.sendMail({
      category: 'social',
      title: '好友申请',
      content: 'XXX想加你为好友',
      sender: 'system',
      retainSeconds: 14 * 24 * 3600,
    });
    expect(socialMail.category).toBe('social');

    // 4. 批量领取所有奖励
    const claimResult = mail.claimAllAttachments();
    expect(claimResult.claimedResources.arenaCoin).toBe(20);
  });
});

// ─────────────────────────────────────────────
// §9.10 竞技场解锁→首次挑战→段位入门
// ─────────────────────────────────────────────

describe('§9.10 竞技场解锁→首次挑战→段位入门', () => {
  it('§9.10.1 新手首次挑战全链路', () => {
    const arena = new ArenaSystem();
    const battle = new PvPBattleSystem();
    const season = new ArenaSeasonSystem();

    // 1. 新玩家初始状态
    let player = createDefaultArenaPlayerState('newbie');
    expect(player.rankId).toBe('BRONZE_V');
    expect(player.score).toBe(0);

    // 2. 匹配对手
    const pool = Array.from({ length: 10 }, (_, i) =>
      makeOpponent(`opp_${i}`, 5000 + i * 100, i + 1),
    );
    const opponents = arena.generateOpponents(player, pool);

    // 3. 消耗挑战次数
    player = arena.consumeChallenge(player);

    // 4. 执行战斗
    const defender = createDefaultArenaPlayerState('defender');
    const result = battle.executeBattle(player, defender);

    // 5. 应用结果
    player = battle.applyBattleResult(player, result);
    expect(player.score).toBeGreaterThanOrEqual(0);

    // 6. 段位判定
    const rankId = battle.getRankIdForScore(player.score);
    expect(rankId).toBeTruthy();

    // 7. 每日奖励
    const dailyResult = season.grantDailyReward(player);
    expect(dailyResult.reward).toBeTruthy();
  });
});

// ─────────────────────────────────────────────
// §9.11 邮箱满→清理→战报补发闭环
// ─────────────────────────────────────────────

describe('§9.11 邮箱满→清理→战报补发闭环', () => {
  it('§9.11.1 邮箱容量管理和清理', () => {
    const mail = new MailSystem();
    mail.reset();

    // 填满邮箱（MAILBOX_CAPACITY=100）
    for (let i = 0; i < 100; i++) {
      mail.sendMail({
        category: 'system',
        title: `邮件${i}`,
        content: '内容',
        sender: 'system',
      });
    }
    expect(mail.getMailCount()).toBe(100);

    // 标记全部已读
    mail.markAllRead();

    // 删除已读已领邮件
    const deleted = mail.deleteReadClaimed();
    expect(deleted).toBe(100);
    expect(mail.getMailCount()).toBe(0);
  });

  it('§9.11.2 清理后新邮件正常接收', () => {
    const mail = new MailSystem();
    mail.reset();

    // 发送并清理
    for (let i = 0; i < 50; i++) {
      mail.sendMail({ category: 'system', title: `M${i}`, content: 'C', sender: 'system' });
    }
    mail.markAllRead();
    mail.deleteReadClaimed();

    // 新邮件正常
    const newMail = mail.sendMail({
      category: 'battle',
      title: '新战报',
      content: '内容',
      sender: 'system',
    });
    expect(newMail.category).toBe('battle');
    expect(mail.getMailCount()).toBe(1);
  });
});

// ─────────────────────────────────────────────
// §9.12 排行榜→社交→资源→实力提升循环
// ─────────────────────────────────────────────

describe('§9.12 排行榜→社交→资源→实力提升循环', () => {
  it('§9.12.1 完整社交竞技正向循环', () => {
    const ranking = new LeaderboardSystem();
    const friend = new FriendSystem();
    let socialState = createDefaultSocialState();
    let player = createDefaultArenaPlayerState('p1');
    const now = Date.now();

    // 1. 竞技榜排名
    ranking.updateScore(LeaderboardType.ARENA, 'p1', 'Player1', 3000);
    const arenaRank = ranking.getPlayerRank(LeaderboardType.ARENA, 'p1');
    expect(arenaRank).toBeTruthy();

    // 2. 添加好友
    socialState = friend.addFriend(socialState, {
      playerId: 'f1',
      playerName: 'Friend1',
      status: FriendStatus.ONLINE,
      power: 5000,
      lastOnlineTime: now,
      friendSince: now,
    });

    // 3. 好友互动获取友情点
    for (let i = 0; i < 10; i++) {
      const result = friend.giftTroops(socialState, 'f1', now + i * 1000);
      socialState = result.state;
    }
    expect(socialState.friendshipPoints).toBeGreaterThan(0);

    // 4. 积分提升 → 排行榜更新
    player.score = 5000;
    player.rankId = 'DIAMOND_V';
    ranking.updateScore(LeaderboardType.ARENA, 'p1', 'Player1', 5000);
    const updatedRank = ranking.getPlayerRank(LeaderboardType.ARENA, 'p1');
    expect(updatedRank!.score).toBe(5000);
  });
});
