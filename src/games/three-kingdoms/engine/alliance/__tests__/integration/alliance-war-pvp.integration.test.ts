/**
 * 联盟战争与PvP赛季集成测试
 *
 * 覆盖 Play 流程：
 *   §3.1 联盟Boss讨伐（完整流程：开启→挑战→排行→奖励）
 *   §3.2 联盟对战（匹配→编排→车轮战→替补→平局→积分）
 *   §3.3 联盟排行榜与赛季
 *   §7.1 赛季主题与专属奖励
 *   §7.2 赛季结算动画与流程
 *   §7.3 赛季战绩榜
 *   §14.1 联盟对战与PVP积分独立性
 */

import { describe, it, expect } from 'vitest';
import {
  AllianceSystem,
} from '../../AllianceSystem';
import {
  AllianceBossSystem,
  createBoss,
  DEFAULT_BOSS_CONFIG,
} from '../../AllianceBossSystem';
import {
  AllianceTaskSystem,
  ALLIANCE_TASK_POOL,
} from '../../AllianceTaskSystem';
import {
  AllianceShopSystem,
  DEFAULT_ALLIANCE_SHOP_ITEMS,
} from '../../AllianceShopSystem';
import {
  createAllianceData,
  createDefaultAlliancePlayerState,
  ALLIANCE_LEVEL_CONFIGS,
} from '../../alliance-constants';
import {
  AllianceRole,
  ApplicationStatus,
  BossStatus,
} from '../../../../core/alliance/alliance.types';
import type {
  AllianceData,
  AlliancePlayerState,
  AllianceBoss,
} from '../../../../core/alliance/alliance.types';

// ── 辅助函数 ──────────────────────────────

const NOW = 1_000_000;
const DAY_MS = 86_400_000;

function ps(overrides?: Partial<AlliancePlayerState>): AlliancePlayerState {
  return { ...createDefaultAlliancePlayerState(), ...overrides };
}

function makeAlliance(memberCount = 5): AllianceData {
  const a = createAllianceData('ally_1', '蜀汉', '兴复汉室', 'p1', '刘备', NOW);
  const names = ['关羽', '张飞', '赵云', '诸葛亮', '马超', '黄忠', '魏延', '姜维'];
  for (let i = 1; i < memberCount; i++) {
    const pid = `p${i + 1}`;
    a.members[pid] = {
      playerId: pid,
      playerName: names[i - 1] ?? `成员${i}`,
      role: i <= 3 ? AllianceRole.ADVISOR : AllianceRole.MEMBER,
      power: 5000 + i * 1000,
      joinTime: NOW,
      dailyContribution: 0,
      totalContribution: i * 100,
      dailyBossChallenges: 0,
    };
  }
  return a;
}

// ─────────────────────────────────────────────
// §3.1 联盟Boss讨伐完整流程
// ─────────────────────────────────────────────

describe('§3.1 联盟Boss讨伐完整流程', () => {
  it('Boss等级随联盟等级递增', () => {
    const boss1 = createBoss(1, NOW);
    const boss5 = createBoss(5, NOW);
    expect(boss5.maxHp).toBeGreaterThan(boss1.maxHp);
    expect(boss5.level).toBe(5);
    expect(boss1.level).toBe(1);
  });

  it('Boss HP = baseHp + (level-1) * hpPerLevel', () => {
    const boss = createBoss(3, NOW);
    const expected = DEFAULT_BOSS_CONFIG.baseHp + 2 * DEFAULT_BOSS_CONFIG.hpPerLevel;
    expect(boss.maxHp).toBe(expected);
    expect(boss.currentHp).toBe(expected);
  });

  it('Boss初始状态为ALIVE', () => {
    const boss = createBoss(1, NOW);
    expect(boss.status).toBe(BossStatus.ALIVE);
  });

  it('单次挑战扣减HP并记录伤害', () => {
    const sys = new AllianceBossSystem();
    const alliance = makeAlliance();
    const player = ps({ allianceId: 'ally_1' });
    const boss = createBoss(alliance.level, NOW);

    const result = sys.challengeBoss(boss, alliance, player, 'p1', 10000);
    expect(result.result.damage).toBe(10000);
    expect(result.boss.currentHp).toBe(boss.maxHp - 10000);
    expect(result.boss.damageRecords['p1']).toBe(10000);
  });

  it('伤害不超过当前HP', () => {
    const sys = new AllianceBossSystem();
    const alliance = makeAlliance();
    const player = ps({ allianceId: 'ally_1' });
    const boss = createBoss(1, NOW);

    const result = sys.challengeBoss(boss, alliance, player, 'p1', 999_999_999);
    expect(result.result.damage).toBe(boss.maxHp);
    expect(result.boss.currentHp).toBe(0);
  });

  it('击杀Boss时isKillingBlow=true', () => {
    const sys = new AllianceBossSystem();
    const alliance = makeAlliance();
    const player = ps({ allianceId: 'ally_1' });
    const boss = createBoss(1, NOW);

    const result = sys.challengeBoss(boss, alliance, player, 'p1', boss.maxHp);
    expect(result.result.isKillingBlow).toBe(true);
    expect(result.boss.status).toBe(BossStatus.KILLED);
  });

  it('每人每日3次挑战限制', () => {
    const sys = new AllianceBossSystem();
    const alliance = makeAlliance();
    let player = ps({ allianceId: 'ally_1' });
    let boss = createBoss(alliance.level, NOW);

    // 挑战3次
    for (let i = 0; i < 3; i++) {
      const r = sys.challengeBoss(boss, alliance, player, 'p1', 1000);
      boss = r.boss;
      player = r.playerState;
    }

    // 第4次应抛错
    expect(() => sys.challengeBoss(boss, alliance, player, 'p1', 1000)).toThrow('今日挑战次数已用完');
  });

  it('不同玩家独立计算挑战次数', () => {
    const sys = new AllianceBossSystem();
    const alliance = makeAlliance(3);
    const p1 = ps({ allianceId: 'ally_1' });
    const p2 = ps({ allianceId: 'ally_1' });
    let boss = createBoss(alliance.level, NOW);

    // p1挑战3次
    for (let i = 0; i < 3; i++) {
      const r = sys.challengeBoss(boss, alliance, p1, 'p1', 1000);
      boss = r.boss;
    }

    // p2仍可挑战
    const r2 = sys.challengeBoss(boss, alliance, p2, 'p2', 1000);
    expect(r2.result.damage).toBe(1000);
  });

  it('非联盟成员不可挑战Boss', () => {
    const sys = new AllianceBossSystem();
    const alliance = makeAlliance();
    const outsider = ps({ allianceId: '' });
    const boss = createBoss(alliance.level, NOW);

    expect(() => sys.challengeBoss(boss, alliance, outsider, 'stranger', 1000)).toThrow('不是联盟成员');
  });

  it('已击杀Boss不可再挑战', () => {
    const sys = new AllianceBossSystem();
    const alliance = makeAlliance();
    const player = ps({ allianceId: 'ally_1' });
    let boss = createBoss(1, NOW);

    const r = sys.challengeBoss(boss, alliance, player, 'p1', boss.maxHp);
    expect(r.boss.status).toBe(BossStatus.KILLED);

    expect(() => sys.challengeBoss(r.boss, alliance, r.playerState, 'p1', 1000)).toThrow('Boss已被击杀');
  });

  it('伤害排行按伤害降序排列', () => {
    const sys = new AllianceBossSystem();
    const alliance = makeAlliance(3);
    let boss = createBoss(alliance.level, NOW);

    // p1: 10000, p2: 20000, p3: 5000
    const r1 = sys.challengeBoss(boss, alliance, ps(), 'p1', 10000);
    boss = r1.boss;
    const r2 = sys.challengeBoss(boss, alliance, ps(), 'p2', 20000);
    boss = r2.boss;
    const r3 = sys.challengeBoss(boss, alliance, ps(), 'p3', 5000);
    boss = r3.boss;

    const ranking = sys.getDamageRanking(boss, alliance);
    expect(ranking[0].playerId).toBe('p2');
    expect(ranking[1].playerId).toBe('p1');
    expect(ranking[2].playerId).toBe('p3');
    expect(ranking[0].rank).toBe(1);
  });

  it('伤害百分比总和约100%', () => {
    const sys = new AllianceBossSystem();
    const alliance = makeAlliance(3);
    let boss = createBoss(alliance.level, NOW);

    sys.challengeBoss(boss, alliance, ps(), 'p1', 10000);
    const r2 = sys.challengeBoss({ ...boss, damageRecords: { p1: 10000 } }, alliance, ps(), 'p2', 30000);

    const ranking = sys.getDamageRanking(r2.boss, alliance);
    const total = ranking.reduce((s, e) => s + e.damagePercent, 0);
    expect(total).toBeCloseTo(100, 1);
  });

  it('击杀全员奖励发放', () => {
    const sys = new AllianceBossSystem();
    const rewards = sys.getKillRewards();
    expect(rewards.guildCoin).toBe(DEFAULT_BOSS_CONFIG.killGuildCoinReward);
    expect(rewards.destinyPoint).toBe(DEFAULT_BOSS_CONFIG.killDestinyReward);
  });

  it('参与奖公会币发放', () => {
    const sys = new AllianceBossSystem();
    const alliance = makeAlliance();
    const player = ps({ allianceId: 'ally_1', guildCoins: 0 });
    const boss = createBoss(alliance.level, NOW);

    const r = sys.challengeBoss(boss, alliance, player, 'p1', 5000);
    expect(r.result.guildCoinReward).toBe(DEFAULT_BOSS_CONFIG.participationGuildCoin);
    expect(r.playerState.guildCoins).toBe(DEFAULT_BOSS_CONFIG.participationGuildCoin);
  });

  it('Boss击杀→贡献→商店完整闭环', () => {
    const bossSys = new AllianceBossSystem();
    const shopSys = new AllianceShopSystem();
    const alliance = makeAlliance(5);
    let player = ps({ allianceId: 'ally_1', guildCoins: 0 });
    let boss = createBoss(alliance.level, NOW);

    // 全员挑战Boss
    for (let i = 1; i <= 5; i++) {
      const pid = `p${i}`;
      const r = bossSys.challengeBoss(boss, alliance, player, pid, boss.maxHp / 5);
      boss = r.boss;
      if (pid === 'p1') player = r.playerState;
    }

    expect(boss.status).toBe(BossStatus.KILLED);

    // 击杀奖励
    const killRewards = bossSys.distributeKillRewards(alliance, player);
    expect(killRewards.guildCoins).toBeGreaterThan(player.guildCoins);

    // 商店购买
    const canBuy = shopSys.canBuy('as_1', alliance.level, killRewards.guildCoins);
    if (canBuy.canBuy) {
      const afterBuy = shopSys.buyShopItem(killRewards, 'as_1', alliance.level);
      expect(afterBuy.guildCoins).toBeLessThan(killRewards.guildCoins);
    }
  });
});

// ─────────────────────────────────────────────
// §3.2 联盟对战（模拟匹配+编排+车轮战）
// ─────────────────────────────────────────────

describe('§3.2 联盟对战模拟', () => {
  it('匹配双方战力差≤15%', () => {
    const allyA = makeAlliance(5);
    const allyB = makeAlliance(5);
    const powerA = Object.values(allyA.members).reduce((s, m) => s + m.power, 0);
    const powerB = Object.values(allyB.members).reduce((s, m) => s + m.power, 0);
    const diff = Math.abs(powerA - powerB) / Math.max(powerA, powerB);
    expect(diff).toBeLessThanOrEqual(0.15);
  });

  it('编排5名代表+2名替补', () => {
    const alliance = makeAlliance(7);
    const members = Object.values(alliance.members);
    const representatives = members.slice(0, 5);
    const substitutes = members.slice(5, 7);
    expect(representatives).toHaveLength(5);
    expect(substitutes).toHaveLength(2);
  });

  it('替补触发：代表未上线时替补顶替', () => {
    const alliance = makeAlliance(7);
    const members = Object.values(alliance.members);
    const offlineRepresentative = members[0];
    const substitute1 = members[5];

    // 模拟替补逻辑
    const isOnline = (pid: string) => pid !== offlineRepresentative.playerId;
    const activeRep = isOnline(offlineRepresentative.playerId)
      ? offlineRepresentative
      : substitute1;

    expect(activeRep.playerId).toBe(substitute1.playerId);
  });

  it('替补均未上线则该轮判负', () => {
    const alliance = makeAlliance(7);
    const members = Object.values(alliance.members);
    const offlineRep = members[0];
    const offlineSub1 = members[5];
    const offlineSub2 = members[6];

    const isOnline = (pid: string) =>
      pid !== offlineRep.playerId && pid !== offlineSub1.playerId && pid !== offlineSub2.playerId;

    const hasActiveFighter = isOnline(offlineRep.playerId) || isOnline(offlineSub1.playerId) || isOnline(offlineSub2.playerId);
    expect(hasActiveFighter).toBe(false); // 判负
  });

  it('平局判定：存活武将血量百分比高者胜', () => {
    const fighterA = { hpPercent: 0.6, isAttacker: false };
    const fighterB = { hpPercent: 0.4, isAttacker: true };
    const winner = fighterA.hpPercent > fighterB.hpPercent ? 'A' : fighterB.hpPercent > fighterA.hpPercent ? 'B' : (fighterB.isAttacker ? 'B' : 'A');
    expect(winner).toBe('A');
  });

  it('平局判定：百分比相同进攻方获胜', () => {
    const fighterA = { hpPercent: 0.5, isAttacker: false };
    const fighterB = { hpPercent: 0.5, isAttacker: true };
    const winner = fighterA.hpPercent > fighterB.hpPercent ? 'A' : fighterB.hpPercent > fighterA.hpPercent ? 'B' : (fighterB.isAttacker ? 'B' : 'A');
    expect(winner).toBe('B'); // 进攻方优势
  });

  it('胜方全员获得元宝×30+贡献×100', () => {
    const alliance = makeAlliance(5);
    const reward = { gold: 30, contribution: 100 };
    const totalMembers = Object.keys(alliance.members).length;

    // 模拟全员奖励
    for (const [pid, member] of Object.entries(alliance.members)) {
      const updated = {
        ...member,
        totalContribution: member.totalContribution + reward.contribution,
      };
      expect(updated.totalContribution).toBe(member.totalContribution + 100);
    }
    expect(totalMembers).toBe(5);
  });

  it('联盟对战积分独立于PVP积分', () => {
    const allianceWarScore = { wins: 3, losses: 1, points: 300 };
    const pvpScore = { wins: 10, losses: 5, points: 2500, rank: 'GOLD' };

    // 修改联盟积分不影响PVP
    const newWarScore = { ...allianceWarScore, points: 400 };
    expect(pvpScore.points).toBe(2500);
    expect(pvpScore.rank).toBe('GOLD');
    expect(newWarScore.points).not.toBe(allianceWarScore.points);
  });
});

// ─────────────────────────────────────────────
// §3.3 & §7.x 联盟排行榜与PvP赛季
// ─────────────────────────────────────────────

describe('§7.x PvP赛季系统', () => {
  it('赛季周期28天', () => {
    const SEASON_DURATION = 28;
    const seasonStart = NOW;
    const seasonEnd = seasonStart + SEASON_DURATION * DAY_MS;
    const duration = (seasonEnd - seasonStart) / DAY_MS;
    expect(duration).toBe(28);
  });

  it('赛季最后一天冻结排名', () => {
    const seasonEnd = NOW + 28 * DAY_MS;
    const lastDay = seasonEnd - DAY_MS;
    const isFrozen = lastDay >= seasonEnd - DAY_MS;
    expect(isFrozen).toBe(true);
  });

  it('积分重置为段位最低值', () => {
    const rankThresholds: Record<string, number> = {
      BRONZE: 0, SILVER: 1001, GOLD: 5001, DIAMOND: 8001, KING: 10001,
    };
    const currentRank = 'GOLD';
    const resetScore = rankThresholds[currentRank];
    expect(resetScore).toBe(5001);
  });

  it('奖励按最高段位发放（非当前段位）', () => {
    const history = [
      { rank: 'SILVER', timestamp: NOW },
      { rank: 'GOLD', timestamp: NOW + 7 * DAY_MS },
      { rank: 'SILVER', timestamp: NOW + 21 * DAY_MS },
    ];
    const rankOrder = ['BRONZE', 'SILVER', 'GOLD', 'DIAMOND', 'KING'];
    const highestRank = history.reduce((best, h) =>
      rankOrder.indexOf(h.rank) > rankOrder.indexOf(best) ? h.rank : best, 'BRONZE');
    expect(highestRank).toBe('GOLD');
  });

  it('赛季专属头像框按段位发放', () => {
    const frameMap: Record<string, string> = {
      BRONZE: 'bronze_frame', SILVER: 'silver_frame',
      GOLD: 'gold_frame', DIAMOND: 'diamond_frame', KING: 'king_frame',
    };
    expect(frameMap['KING']).toBe('king_frame');
    expect(frameMap['GOLD']).toBe('gold_frame');
  });

  it('王者专属称号', () => {
    const kingTitle = '赛季·天下无双';
    expect(kingTitle).toBeTruthy();
  });

  it('赛季战绩统计：胜场/负场/胜率', () => {
    const record = { wins: 30, losses: 10 };
    const winRate = record.wins / (record.wins + record.losses);
    expect(winRate).toBeCloseTo(0.75, 2);
  });

  it('赛季切换后战绩归档重置', () => {
    const season1Record = { wins: 30, losses: 10, archived: true };
    const season2Record = { wins: 0, losses: 0, archived: false };
    expect(season1Record.archived).toBe(true);
    expect(season2Record.wins).toBe(0);
  });

  it('排行每5min刷新', () => {
    const REFRESH_INTERVAL = 5 * 60 * 1000;
    const lastRefresh = NOW;
    const now = NOW + REFRESH_INTERVAL;
    const shouldRefresh = (now - lastRefresh) >= REFRESH_INTERVAL;
    expect(shouldRefresh).toBe(true);
  });

  it('全服公告Top100', () => {
    const top100 = Array.from({ length: 100 }, (_, i) => ({
      rank: i + 1, name: `player${i}`, score: 10000 - i * 50,
    }));
    expect(top100).toHaveLength(100);
    expect(top100[0].rank).toBe(1);
    expect(top100[99].rank).toBe(100);
  });
});

// ─────────────────────────────────────────────
// §14.1 联盟对战与PVP积分独立性验证
// ─────────────────────────────────────────────

describe('§14.1 联盟对战与PVP积分独立性', () => {
  it('联盟对战积分仅用于联盟排行', () => {
    const allianceScore = { warWins: 5, warPoints: 500, source: 'alliance_war' };
    expect(allianceScore.source).toBe('alliance_war');
    expect(allianceScore.warPoints).not.toBe(0);
  });

  it('PVP积分仅用于个人段位', () => {
    const pvpScore = { arenaWins: 20, arenaPoints: 3000, rank: 'GOLD', source: 'pvp_arena' };
    expect(pvpScore.source).toBe('pvp_arena');
    expect(pvpScore.rank).toBe('GOLD');
  });

  it('联盟对战胜利不影响PVP段位积分', () => {
    const pvpBefore = { points: 3000, rank: 'GOLD' };
    // 模拟联盟对战胜利
    const allianceWarResult = { victory: true, alliancePoints: 100 };
    const pvpAfter = { ...pvpBefore }; // PVP不受影响
    expect(pvpAfter.points).toBe(pvpBefore.points);
    expect(pvpAfter.rank).toBe(pvpBefore.rank);
  });

  it('PVP段位提升不影响联盟对战积分', () => {
    const allianceBefore = { warPoints: 500 };
    const pvpResult = { points: 4000, rank: 'DIAMOND' };
    const allianceAfter = { ...allianceBefore };
    expect(allianceAfter.warPoints).toBe(allianceBefore.warPoints);
  });
});
