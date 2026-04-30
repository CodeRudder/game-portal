/**
 * 集成测试 §8.5.1~8.5.4: 赛季切换+段位重置+商店刷新
 *
 * 覆盖：赛季结束→段位重置→积分保留比例→商店刷新→解锁内容
 * 跨系统联动：ArenaSeasonSystem ↔ ArenaShopSystem ↔ PvPBattleSystem ↔ MailSystem
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ArenaSeasonSystem, SEASON_REWARDS, DEFAULT_SEASON_CONFIG } from '../../../pvp/ArenaSeasonSystem';
import { ArenaShopSystem } from '../../../pvp/ArenaShopSystem';
import { PvPBattleSystem, RANK_LEVELS, RANK_LEVEL_MAP } from '../../../pvp/PvPBattleSystem';
import { MailSystem } from '../../../mail/MailSystem';
import { createDefaultArenaPlayerState } from '../../../pvp/ArenaSystem';
import type { ArenaPlayerState } from '../../../../core/pvp/pvp.types';
import { FormationType, AIDefenseStrategy } from '../../../../core/pvp/pvp.types';

// ── 辅助 ──────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000;

function makePlayer(overrides: Partial<ArenaPlayerState> = {}): ArenaPlayerState {
  return {
    ...createDefaultArenaPlayerState('p1'),
    score: 500, ranking: 50, rankId: 'SILVER_III', arenaCoins: 1000,
    defenseFormation: {
      slots: ['h0', 'h1', 'h2', '', ''],
      formation: FormationType.FISH_SCALE,
      strategy: AIDefenseStrategy.BALANCED,
    },
    ...overrides,
  };
}

// ── 测试 ──────────────────────────────

describe('§8.5 赛季切换+段位重置+商店刷新', () => {
  let season: ArenaSeasonSystem;
  let shop: ArenaShopSystem;
  let mail: MailSystem;

  beforeEach(() => {
    season = new ArenaSeasonSystem();
    shop = new ArenaShopSystem();
    mail = new MailSystem();
  });

  // ── §8.5.1 赛季切换与重置 ──

  describe('§8.5.1 赛季切换与重置', () => {
    it('创建新赛季数据正确', () => {
      const t = Date.now();
      const s = season.createSeason('S4', t);
      expect(s.seasonId).toBe('S4');
      expect(s.endTime).toBe(t + DEFAULT_SEASON_CONFIG.seasonDays * DAY_MS);
      expect(s.isSettled).toBe(false);
    });

    it('赛季当前天数计算正确', () => {
      const s = season.createSeason('S4', Date.now() - 5 * DAY_MS);
      expect(season.getCurrentDay(s, Date.now())).toBeGreaterThanOrEqual(6);
    });

    it('赛季结束判断与剩余天数', () => {
      const old = season.createSeason('S3', Date.now() - 30 * DAY_MS);
      expect(season.isSeasonEnded(old, Date.now())).toBe(true);
      expect(season.getRemainingDays(old, Date.now())).toBe(0);

      const cur = season.createSeason('S4', Date.now());
      expect(season.isSeasonActive(cur, Date.now())).toBe(true);
      expect(season.getRemainingDays(cur, Date.now())).toBe(28);
    });
  });

  // ── §8.5.2 段位重置规则 ──

  describe('§8.5.2 段位重置规则', () => {
    it('结算重置积分到当前段位最低值', () => {
      const p = makePlayer({ rankId: 'SILVER_III', score: 1500 });
      const { resetScore } = season.settleSeason(p, 'SILVER_I');
      expect(resetScore).toBe(RANK_LEVEL_MAP.get('SILVER_III')!.minScore);
    });

    it('按最高段位发放奖励', () => {
      const p = makePlayer({ rankId: 'SILVER_III' });
      const { reward } = season.settleSeason(p, 'GOLD_II');
      expect(reward.rankId).toBe('GOLD_II');
      expect(reward.copper).toBeGreaterThan(0);
      expect(reward.arenaCoin).toBeGreaterThan(0);
    });

    it('结算后竞技币增加', () => {
      const p = makePlayer({ arenaCoins: 500, rankId: 'SILVER_V' });
      const { state, reward } = season.settleSeason(p, 'SILVER_V');
      expect(state.arenaCoins).toBe(500 + reward.arenaCoin);
    });

    it('结算重置每日数据并清理回放/防守日志', () => {
      const p = makePlayer({
        dailyChallengesLeft: 0, dailyBoughtChallenges: 3, dailyManualRefreshes: 2,
        replays: [{ id: 'r1' } as unknown as Record<string, unknown>], defenseLogs: [{ id: 'd1' } as unknown as Record<string, unknown>],
      });
      const { state } = season.settleSeason(p, 'BRONZE_V');
      expect(state.dailyChallengesLeft).toBe(5);
      expect(state.dailyBoughtChallenges).toBe(0);
      expect(state.dailyManualRefreshes).toBe(0);
      expect(state.replays).toEqual([]);
      expect(state.defenseLogs).toEqual([]);
    });

    it('青铜V最低奖励', () => {
      const { reward } = season.settleSeason(makePlayer({ rankId: 'BRONZE_V' }), 'BRONZE_V');
      expect(reward.copper).toBe(2000);
      expect(reward.arenaCoin).toBe(50);
    });
  });

  // ── §8.5.3 商店刷新机制 ──

  describe('§8.5.3 商店刷新机制', () => {
    it('默认14种商品，含4种类型', () => {
      const items = shop.getAllItems();
      expect(items).toHaveLength(14);
      const types = [...new Set(items.map(i => i.itemType))];
      expect(types).toContain('hero_fragment');
      expect(types).toContain('enhance_stone');
    });

    it('周限购商品购买计数正确', () => {
      const p = makePlayer({ arenaCoins: 10000 });
      const { state, item } = shop.buyItem(p, 'fragment_liubei', 2);
      expect(item.purchased).toBe(2);
      expect(state.arenaCoins).toBe(10000 - 100 * 2);
    });

    it('超出周限购或竞技币不足均抛出错误', () => {
      expect(() => shop.buyItem(makePlayer({ arenaCoins: 999999 }), 'fragment_liubei', 6)).toThrow('限购');
      expect(() => shop.buyItem(makePlayer({ arenaCoins: 10 }), 'fragment_liubei', 1)).toThrow('竞技币不足');
    });

    it('weeklyReset后限购计数归零', () => {
      shop.buyItem(makePlayer({ arenaCoins: 999999 }), 'fragment_liubei', 3);
      shop.weeklyReset();
      expect(shop.getItem('fragment_liubei')?.purchased).toBe(0);
    });

    it('无限购商品可重复购买', () => {
      const bronze = shop.getItem('equip_box_bronze');
      expect(bronze?.weeklyLimit).toBe(0);
      const { state } = shop.buyItem(makePlayer({ arenaCoins: 999999 }), 'equip_box_bronze', 10);
      expect(state.arenaCoins).toBe(999999 - 80 * 10);
    });
  });

  // ── §8.5.4 解锁内容与奖励 ──

  describe('§8.5.4 解锁内容与奖励', () => {
    it('21个段位都有赛季奖励', () => {
      expect(SEASON_REWARDS).toHaveLength(21);
    });

    it('段位奖励递增（青铜→王者）', () => {
      const king = SEASON_REWARDS[SEASON_REWARDS.length - 1];
      const bronze = SEASON_REWARDS[0];
      expect(king.copper).toBeGreaterThan(bronze.copper);
      const bronzeR = SEASON_REWARDS.filter(r => r.rankId.startsWith('BRONZE'));
      for (let i = 1; i < bronzeR.length; i++) {
        expect(bronzeR[i].copper).toBeGreaterThan(bronzeR[i - 1].copper);
      }
    });

    it('白银以上有称号奖励', () => {
      expect(SEASON_REWARDS.filter(r => r.rankId.startsWith('SILVER')).some(r => r.title)).toBe(true);
    });

    it('5大段位21级', () => {
      expect(RANK_LEVELS).toHaveLength(21);
      expect([...new Set(RANK_LEVELS.map(r => r.tier))]).toEqual(['BRONZE', 'SILVER', 'GOLD', 'DIAMOND', 'KING']);
    });
  });

  // ── 赛季闭环 ──

  describe('赛季闭环', () => {
    it('结算→竞技币→商店购买闭环', () => {
      const p = makePlayer({ arenaCoins: 100, rankId: 'GOLD_V' });
      const { state: settled, reward } = season.settleSeason(p, 'GOLD_V');
      expect(settled.arenaCoins).toBe(100 + reward.arenaCoin);
      const { state: afterBuy } = shop.buyItem(settled, 'enhance_stone_small', 1);
      expect(afterBuy.arenaCoins).toBeLessThan(settled.arenaCoins);
    });

    it('结算→邮件奖励→领取闭环', () => {
      const { reward } = season.settleSeason(makePlayer({ rankId: 'SILVER_I' }), 'SILVER_I');
      const m = mail.sendMail({
        category: 'reward', title: '赛季结算奖励', content: 'c', sender: '赛季系统',
        attachments: [
          { resourceType: 'copper', amount: reward.copper },
          { resourceType: 'arena_coin', amount: reward.arenaCoin },
          { resourceType: 'gold', amount: reward.gold },
        ],
      });
      const claimed = mail.claimAttachments(m.id);
      expect(claimed['copper']).toBe(reward.copper);
      expect(claimed['arena_coin']).toBe(reward.arenaCoin);
    });

    it('完整赛季切换：结束→结算→重置→新赛季→商店刷新', () => {
      // 旧赛季结束
      const old = season.createSeason('S3', Date.now() - 30 * DAY_MS);
      expect(season.isSeasonEnded(old, Date.now())).toBe(true);
      // 结算
      const p = makePlayer({ rankId: 'GOLD_III', score: 2000, arenaCoins: 300, dailyChallengesLeft: 0 });
      const { state: settled } = season.settleSeason(p, 'GOLD_III');
      expect(settled.dailyChallengesLeft).toBe(5);
      expect(settled.replays).toEqual([]);
      // 商店重置
      shop.weeklyReset();
      expect(shop.getItem('fragment_liubei')?.purchased).toBe(0);
      // 新赛季
      const nw = season.createSeason('S4', Date.now());
      expect(season.isSeasonActive(nw, Date.now())).toBe(true);
      // 新赛季购买
      const { state } = shop.buyItem(settled, 'equip_box_bronze', 1);
      expect(state.arenaCoins).toBeLessThan(settled.arenaCoins);
    });
  });
});
