/**
 * 集成测试 §8.1~8.6: PvP/社交邮件
 *
 * 覆盖：PvP挑战邮件、段位变更邮件、好友互动邮件、排名奖励邮件
 * 跨系统联动：MailSystem ↔ ArenaSeasonSystem ↔ FriendSystem
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MailSystem } from '../../../mail/MailSystem';
import { ArenaSeasonSystem, SEASON_REWARDS } from '../../../pvp/ArenaSeasonSystem';
import { PvPBattleSystem, RANK_LEVELS, RANK_LEVEL_MAP } from '../../../pvp/PvPBattleSystem';
import { FriendSystem } from '../../../social/FriendSystem';
import type { MailSendRequest } from '../../../mail/mail.types';
import { FriendStatus } from '../../../../core/social/social.types';
import type { FriendData, SocialState } from '../../../../core/social/social.types';
import { createDefaultArenaPlayerState } from '../../../pvp/ArenaSystem';
import type { ArenaPlayerState } from '../../../../core/pvp/pvp.types';
import { FormationType, AIDefenseStrategy } from '../../../../core/pvp/pvp.types';

// ── 辅助 ──────────────────────────────

function makePlayer(overrides: Partial<ArenaPlayerState> = {}): ArenaPlayerState {
  return {
    ...createDefaultArenaPlayerState('p1'),
    score: 500, ranking: 50,
    defenseFormation: {
      slots: ['h0', 'h1', '', '', ''],
      formation: FormationType.FISH_SCALE,
      strategy: AIDefenseStrategy.BALANCED,
    },
    ...overrides,
  };
}

function makeFriend(overrides: Partial<FriendData> = {}): FriendData {
  return {
    playerId: 'f1', playerName: 'Friend1', status: FriendStatus.ONLINE,
    power: 8000, lastOnlineTime: Date.now(), friendSince: Date.now() - 86400000,
    ...overrides,
  };
}

function emptySocial(): SocialState {
  return {
    friends: {}, pendingRequests: [], dailyRequestsSent: 0, lastDailyReset: 0,
    dailyInteractions: [], friendshipPoints: 0, dailyFriendshipEarned: 0,
    activeBorrows: [], dailyBorrowCount: 0, deleteCooldowns: {}, chatMessages: {},
  };
}

// ── 测试 ──────────────────────────────

describe('§8 PvP/社交邮件', () => {
  let mail: MailSystem;
  let season: ArenaSeasonSystem;
  let friend: FriendSystem;

  beforeEach(() => {
    mail = new MailSystem();
    season = new ArenaSeasonSystem();
    friend = new FriendSystem();
  });

  // ── §8.1 PvP挑战邮件 ──

  describe('§8.1 PvP挑战邮件', () => {
    it('胜利后发送含积分附件的战斗邮件', () => {
      const m = mail.sendMail({
        category: 'battle', title: '竞技场胜利',
        content: '击败Player1，积分+25', sender: '系统',
        attachments: [{ resourceType: 'arena_score', amount: 25 }],
      });
      expect(m.category).toBe('battle');
      expect(m.status).toBe('unread');
      expect(m.attachments).toHaveLength(1);
    });

    it('失败邮件无附件', () => {
      const m = mail.sendMail({
        category: 'battle', title: '竞技场失败',
        content: '被Player2击败', sender: '系统',
      });
      expect(m.attachments).toHaveLength(0);
    });

    it('批量发送多封战斗结果邮件', () => {
      const reqs: MailSendRequest[] = [1, 2, 3].map(i => ({
        category: 'battle' as const, title: `报告${i}`, content: 'c', sender: '系统',
      }));
      expect(mail.sendBatch(reqs)).toHaveLength(3);
    });
  });

  // ── §8.2 段位变更邮件 ──

  describe('§8.2 段位变更邮件', () => {
    it('段位晋升邮件含多种奖励附件', () => {
      const m = mail.sendMail({
        category: 'system', title: '段位晋升',
        content: '晋升至白银V', sender: '竞技系统',
        attachments: [
          { resourceType: 'copper', amount: 5000 },
          { resourceType: 'arena_coin', amount: 100 },
        ],
      });
      expect(m.attachments).toHaveLength(2);
    });

    it('领取段位奖励后状态→read_claimed', () => {
      const m = mail.sendMail({
        category: 'system', title: '排名奖励', content: 'c', sender: '系统',
        attachments: [{ resourceType: 'copper', amount: 1000 }],
      });
      mail.markRead(m.id);
      expect(mail.getMail(m.id)?.status).toBe('read_unclaimed');
      const claimed = mail.claimAttachments(m.id);
      expect(claimed['copper']).toBe(1000);
      expect(mail.getMail(m.id)?.status).toBe('read_claimed');
    });
  });

  // ── §8.3 好友互动邮件 ──

  describe('§8.3 好友互动邮件', () => {
    it('好友赠送兵力→社交邮件含附件', () => {
      const m = mail.sendMail({
        category: 'social', title: '好友赠送',
        content: 'Friend1赠送兵力x100', sender: 'Friend1',
        attachments: [{ resourceType: 'troops', amount: 100 }],
      });
      expect(m.category).toBe('social');
      expect(m.attachments[0].amount).toBe(100);
    });

    it('借将归还→通知邮件', () => {
      const m = mail.sendMail({
        category: 'social', title: '借将归还',
        content: '赵云已归还', sender: 'Friend2',
      });
      expect(m.content).toContain('归还');
    });

    it('社交邮件按分类筛选', () => {
      mail.sendMail({ category: 'social', title: '赠送', content: 'c', sender: 'F1' });
      mail.sendMail({ category: 'social', title: '借将', content: 'c', sender: 'F2' });
      mail.sendMail({ category: 'battle', title: '战斗', content: 'c', sender: '系统' });
      expect(mail.getMailCount({ category: 'social' })).toBe(2);
    });

    it('多个好友互动邮件批量领取汇总资源', () => {
      [100, 200].forEach((amt, i) => {
        mail.sendMail({
          category: 'social', title: `赠送${i}`, content: 'c', sender: `F${i}`,
          attachments: [{ resourceType: 'troops', amount: amt }],
        });
      });
      const r = mail.claimAllAttachments({ category: 'social' });
      expect(r.count).toBe(2);
      expect(r.claimedResources['troops']).toBe(300);
    });
  });

  // ── §8.4 排名奖励邮件 ──

  describe('§8.4 排名奖励邮件', () => {
    it('赛季结算→排名奖励邮件含3种附件', () => {
      const player = makePlayer({ rankId: 'SILVER_I' });
      const { reward } = season.settleSeason(player, 'SILVER_I');
      const m = mail.sendMail({
        category: 'reward', title: '赛季结算奖励',
        content: '最高段位SILVER_I', sender: '赛季系统',
        attachments: [
          { resourceType: 'copper', amount: reward.copper },
          { resourceType: 'arena_coin', amount: reward.arenaCoin },
          { resourceType: 'gold', amount: reward.gold },
        ],
      });
      expect(m.attachments).toHaveLength(3);
      const claimed = mail.claimAttachments(m.id);
      expect(claimed['copper']).toBe(reward.copper);
      expect(claimed['arena_coin']).toBe(reward.arenaCoin);
    });

    it('王者段位奖励邮件领取金额正确', () => {
      const kingReward = SEASON_REWARDS[SEASON_REWARDS.length - 1];
      const m = mail.sendMail({
        category: 'reward', title: '王者奖励', content: 'c', sender: '系统',
        attachments: [
          { resourceType: 'copper', amount: kingReward.copper },
          { resourceType: 'arena_coin', amount: kingReward.arenaCoin },
        ],
      });
      const claimed = mail.claimAttachments(m.id);
      expect(claimed['copper']).toBe(100000);
      expect(claimed['arena_coin']).toBe(2000);
    });
  });

  // ── §8.5 系统公告邮件 ──

  describe('§8.5 系统公告邮件', () => {
    it('公告邮件retainSeconds=null时无过期时间', () => {
      const m = mail.sendMail({
        category: 'system', title: '新赛季开启',
        content: '赛季4已开启', sender: '官方', retainSeconds: null,
      });
      expect(m.expireTime).toBeNull();
    });
  });

  // ── §8.6 邮件批量操作与过期 ──

  describe('§8.6 邮件批量操作与过期', () => {
    it('一键标记所有邮件已读', () => {
      mail.sendMail({ category: 'battle', title: 'B', content: 'c', sender: 's' });
      mail.sendMail({ category: 'social', title: 'S', content: 'c', sender: 's' });
      expect(mail.markAllRead()).toBe(2);
      expect(mail.getUnreadCount()).toBe(0);
    });

    it('批量领取所有附件汇总资源', () => {
      mail.sendMail({
        category: 'reward', title: 'R1', content: 'c', sender: 's',
        attachments: [{ resourceType: 'copper', amount: 1000 }],
      });
      mail.sendMail({
        category: 'reward', title: 'R2', content: 'c', sender: 's',
        attachments: [{ resourceType: 'gold', amount: 50 }],
      });
      const r = mail.claimAllAttachments();
      expect(r.count).toBe(2);
      expect(r.claimedResources['copper']).toBe(1000);
      expect(r.claimedResources['gold']).toBe(50);
    });

    it('已领取附件邮件可删除，未领取不可删除', () => {
      const m = mail.sendMail({
        category: 'battle', title: 'B', content: 'c', sender: 's',
        attachments: [{ resourceType: 'copper', amount: 100 }],
      });
      expect(mail.deleteMail(m.id)).toBe(false);
      mail.markRead(m.id);
      mail.claimAttachments(m.id);
      expect(mail.deleteMail(m.id)).toBe(true);
    });

    it('过期邮件状态变为expired', () => {
      const m = mail.sendMail({
        category: 'battle', title: 'B', content: 'c', sender: 's', retainSeconds: 1,
      });
      mail.getMail(m.id)!.expireTime = Date.now() - 1000;
      expect(mail.processExpired()).toBeGreaterThanOrEqual(1);
      expect(mail.getMail(m.id)?.status).toBe('expired');
    });

    it('好友赠送→邮件通知→领取→read_claimed闭环', () => {
      const m = mail.sendMail({
        category: 'social', title: '好友赠送兵力',
        content: 'Friend1赠送兵力x100', sender: 'Friend1',
        attachments: [{ resourceType: 'troops', amount: 100 }],
      });
      expect(mail.getUnreadCount('social')).toBe(1);
      mail.markRead(m.id);
      expect(mail.claimAttachments(m.id)['troops']).toBe(100);
      expect(mail.getMail(m.id)?.status).toBe('read_claimed');
    });
  });
});
