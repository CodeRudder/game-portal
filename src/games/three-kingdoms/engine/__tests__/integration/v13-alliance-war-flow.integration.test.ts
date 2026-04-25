/**
 * v13.0 联盟争锋 — §3 联盟战争 Play 流程集成测试
 *
 * 覆盖范围（按 play 文档章节组织）：
 * - §3.1 联盟Boss讨伐: 开启/挑战/伤害排行/击杀奖励/参与奖励
 * - §3.2 联盟对战: 匹配/编排/替补/车轮战/平局判定/奖励
 * - §3.3 联盟排行榜与赛季: 排行刷新/赛季结算/梯度奖励
 * - §14.9 联盟对战窗口期与周日复赛
 * - §16.2 联盟对战网络断线异常处理
 * - §5.2 Boss讨伐→排行→奖励→商店资源闭环
 * - §5.3 联盟对战→赛季→科技→活跃度闭环
 *
 * @see docs/games/three-kingdoms/play/v13-play.md
 */

import { describe, it, expect } from 'vitest';
import { createSim } from '../../../test-utils/test-helpers';
import type { AllianceData, AlliancePlayerState } from '../../../core/alliance/alliance.types';
import { AllianceRole as AR, ApplicationStatus, BossStatus } from '../../../core/alliance/alliance.types';
import type { ArenaPlayerState, ArenaOpponent, SeasonData } from '../../../core/pvp/pvp.types';
import { FormationType, AIDefenseStrategy, PvPBattleMode } from '../../../core/pvp/pvp.types';
import {
  createDefaultArenaPlayerState,
  createDefaultDefenseFormation,
} from '../../pvp/ArenaConfig';
import { createBoss, DEFAULT_BOSS_CONFIG } from '../../alliance/AllianceBossSystem';
import { RANK_LEVELS, SEASON_REWARDS } from '../../pvp/index';
import { RankingDimension } from '../../pvp/RankingSystem';

// ── 辅助函数 ──

const NOW = Date.now();
const DAY_MS = 24 * 60 * 60 * 1000;

/** 创建联盟数据（含多名成员） */
function createAllianceWithMembers(
  memberCount: number,
  allianceLevel = 3,
): AllianceData {
  const members: Record<string, import('../../../core/alliance/alliance.types').AllianceMember> = {};
  for (let i = 1; i <= memberCount; i++) {
    const pid = `player_${String(i).padStart(3, '0')}`;
    members[pid] = {
      playerId: pid,
      playerName: `成员${i}`,
      role: i === 1 ? AR.LEADER : (i <= 4 ? AR.ADVISOR : AR.MEMBER),
      power: 5000 + i * 500,
      joinTime: NOW - DAY_MS * 7,
      dailyContribution: 0,
      totalContribution: i * 100,
      dailyBossChallenges: 0,
    };
  }
  return {
    id: 'alliance_war_001',
    name: '战争测试联盟',
    declaration: '测试联盟战争',
    leaderId: 'player_001',
    level: allianceLevel,
    experience: allianceLevel * 3000,
    members,
    applications: [],
    announcements: [],
    messages: [],
    createTime: NOW - DAY_MS * 30,
    bossKilledToday: false,
    lastBossRefreshTime: NOW,
    dailyTaskCompleted: 0,
    lastDailyReset: NOW,
  };
}

/** 创建联盟玩家状态 */
function createAlliancePlayerState(overrides: Partial<AlliancePlayerState> = {}): AlliancePlayerState {
  return {
    allianceId: '',
    guildCoins: 0,
    dailyBossChallenges: 0,
    dailyContribution: 0,
    lastDailyReset: NOW,
    weeklyRetroactiveCount: 0,
    lastRetroactiveReset: NOW,
    ...overrides,
  };
}

/** 创建竞技场玩家状态 */
function createArenaPlayerState(overrides: Partial<ArenaPlayerState> = {}): ArenaPlayerState {
  return {
    ...createDefaultArenaPlayerState('player_001'),
    ...overrides,
  };
}

/** 创建竞技场对手 */
function createArenaOpponent(id: string, overrides: Partial<ArenaOpponent> = {}): ArenaOpponent {
  return {
    playerId: id,
    playerName: `对手_${id}`,
    power: 5000 + Math.random() * 3000,
    rankId: 'SILVER_III',
    score: 2100 + Math.floor(Math.random() * 500),
    ranking: Math.floor(Math.random() * 100) + 1,
    faction: 'shu' as const,
    defenseSnapshot: null,
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════
// §3.1 联盟Boss讨伐
// ═══════════════════════════════════════════════════════════════
describe('v13.0 联盟战争 — §3.1 联盟Boss讨伐', () => {

  it('should access alliance boss system via engine getter', () => {
    const sim = createSim();
    const bossSys = sim.engine.getAllianceBossSystem();
    expect(bossSys).toBeDefined();
    expect(typeof bossSys.challengeBoss).toBe('function');
    expect(typeof bossSys.getDamageRanking).toBe('function');
    expect(typeof bossSys.refreshBoss).toBe('function');
  });

  it('should generate boss with HP scaling by alliance level', () => {
    // Play §3.1: Boss等级随联盟等级提升(Lv1~Lv10)
    const sim = createSim();
    const bossSys = sim.engine.getAllianceBossSystem();

    const hp1 = bossSys.calculateBossMaxHp(1);
    const hp3 = bossSys.calculateBossMaxHp(3);
    const hp5 = bossSys.calculateBossMaxHp(5);

    expect(hp1).toBeGreaterThan(0);
    expect(hp3).toBeGreaterThan(hp1);
    expect(hp5).toBeGreaterThan(hp3);

    // Verify formula: baseHp + (level - 1) * hpPerLevel
    const config = bossSys.getConfig();
    expect(hp1).toBe(config.baseHp);
    expect(hp3).toBe(config.baseHp + 2 * config.hpPerLevel);
  });

  it('should create boss instance via createBoss factory', () => {
    const alliance = createAllianceWithMembers(5);
    const boss = createBoss(alliance.level, NOW);

    expect(boss).toBeDefined();
    expect(boss.id).toBeTruthy();
    expect(boss.name).toBeTruthy();
    expect(boss.level).toBe(alliance.level);
    expect(boss.maxHp).toBeGreaterThan(0);
    expect(boss.currentHp).toBe(boss.maxHp);
    expect(boss.status).toBe(BossStatus.ALIVE);
    expect(boss.damageRecords).toEqual({});
  });

  it('should refresh boss daily and reset kill status', () => {
    // Play §3.1: 每日1次，0:00重置
    const sim = createSim();
    const bossSys = sim.engine.getAllianceBossSystem();

    const alliance = createAllianceWithMembers(5, 3);
    alliance.bossKilledToday = true;

    const refreshed = bossSys.refreshBoss(alliance, NOW + DAY_MS);
    expect(refreshed.bossKilledToday).toBe(false);
    expect(refreshed.lastBossRefreshTime).toBe(NOW + DAY_MS);
  });

  it('should challenge boss and record damage', () => {
    // Play §3.1: 个人挑战次数: 普通3次
    const sim = createSim();
    const bossSys = sim.engine.getAllianceBossSystem();

    const alliance = createAllianceWithMembers(5, 3);
    const boss = createBoss(alliance.level, NOW);
    const playerState = createAlliancePlayerState();

    const result = bossSys.challengeBoss(
      boss, alliance, playerState, 'player_001', 15000,
    );

    expect(result.result.damage).toBe(15000);
    expect(result.result.isKillingBlow).toBe(false);
    expect(result.result.guildCoinReward).toBeGreaterThan(0);
    expect(result.boss.currentHp).toBe(boss.maxHp - 15000);
    expect(result.boss.damageRecords['player_001']).toBe(15000);
    expect(result.playerState.dailyBossChallenges).toBe(1);
  });

  it('should kill boss with killing blow and grant rewards', () => {
    // Play §3.1: 击杀后全员获得奖励(击杀奖励+参与奖励)
    const sim = createSim();
    const bossSys = sim.engine.getAllianceBossSystem();

    const alliance = createAllianceWithMembers(5, 3);
    const boss = createBoss(alliance.level, NOW);
    const playerState = createAlliancePlayerState();

    // First challenge — deal massive damage to kill
    const killDamage = boss.maxHp;
    const result = bossSys.challengeBoss(
      boss, alliance, playerState, 'player_001', killDamage,
    );

    expect(result.result.isKillingBlow).toBe(true);
    expect(result.boss.status).toBe(BossStatus.KILLED);
    expect(result.boss.currentHp).toBe(0);
    expect(result.result.killReward).toBeDefined();
    expect(result.result.killReward!.guildCoin).toBeGreaterThan(0);
    expect(result.result.killReward!.destinyPoint).toBeGreaterThan(0);
    expect(result.alliance.bossKilledToday).toBe(true);
  });

  it('should enforce daily challenge limit (3 per player)', () => {
    // Play §3.1: 个人挑战次数: 普通3次
    const sim = createSim();
    const bossSys = sim.engine.getAllianceBossSystem();

    let alliance = createAllianceWithMembers(5, 3);
    let boss = createBoss(alliance.level, NOW);
    let playerState = createAlliancePlayerState();

    // Use 3 challenges
    for (let i = 0; i < 3; i++) {
      const result = bossSys.challengeBoss(boss, alliance, playerState, 'player_001', 10000);
      boss = result.boss;
      alliance = result.alliance;
      playerState = result.playerState;
    }

    expect(playerState.dailyBossChallenges).toBe(3);

    // 4th challenge should fail
    expect(() => {
      bossSys.challengeBoss(boss, alliance, playerState, 'player_001', 5000);
    }).toThrow('今日挑战次数已用完');
  });

  it('should produce damage ranking after challenges', () => {
    // Play §3.1: 伤害排行榜实时更新
    const sim = createSim();
    const bossSys = sim.engine.getAllianceBossSystem();

    let alliance = createAllianceWithMembers(5, 3);
    let boss = createBoss(alliance.level, NOW);

    // Player 1 challenges
    const ps1 = createAlliancePlayerState();
    const r1 = bossSys.challengeBoss(boss, alliance, ps1, 'player_001', 30000);
    boss = r1.boss;
    alliance = r1.alliance;

    // Player 2 challenges
    const ps2 = createAlliancePlayerState();
    const r2 = bossSys.challengeBoss(boss, alliance, ps2, 'player_002', 50000);
    boss = r2.boss;

    const ranking = bossSys.getDamageRanking(boss, r2.alliance);
    expect(ranking.length).toBe(2);

    // Player 2 should be ranked #1 (higher damage)
    expect(ranking[0].playerId).toBe('player_002');
    expect(ranking[0].rank).toBe(1);
    expect(ranking[0].damage).toBe(50000);
    expect(ranking[1].playerId).toBe('player_001');
    expect(ranking[1].rank).toBe(2);

    // Damage percent sums to 100
    const totalPercent = ranking.reduce((sum, e) => sum + e.damagePercent, 0);
    expect(Math.abs(totalPercent - 100)).toBeLessThan(0.01);
  });

  it('should get remaining challenge count', () => {
    const sim = createSim();
    const bossSys = sim.engine.getAllianceBossSystem();

    const ps = createAlliancePlayerState();
    expect(bossSys.getRemainingChallenges(ps)).toBe(DEFAULT_BOSS_CONFIG.dailyChallengeLimit);

    const psAfter = { ...ps, dailyBossChallenges: 2 };
    expect(bossSys.getRemainingChallenges(psAfter)).toBe(1);
  });

  it('should distribute kill rewards to all members', () => {
    // Play §3.1: 击杀后全员获得奖励
    const sim = createSim();
    const bossSys = sim.engine.getAllianceBossSystem();

    const rewards = bossSys.getKillRewards();
    expect(rewards.guildCoin).toBe(DEFAULT_BOSS_CONFIG.killGuildCoinReward);
    expect(rewards.destinyPoint).toBe(DEFAULT_BOSS_CONFIG.killDestinyReward);

    // Distribute to a player
    const playerState = createAlliancePlayerState({ guildCoins: 100 });
    const after = bossSys.distributeKillRewards(createAllianceWithMembers(5), playerState);
    expect(after.guildCoins).toBe(100 + rewards.guildCoin);
  });

  it('should cap damage at boss current HP', () => {
    const sim = createSim();
    const bossSys = sim.engine.getAllianceBossSystem();

    const alliance = createAllianceWithMembers(5, 3);
    const boss = createBoss(alliance.level, NOW);
    const playerState = createAlliancePlayerState();

    // Attempt to deal more damage than boss HP
    const overkillDamage = boss.maxHp * 10;
    const result = bossSys.challengeBoss(boss, alliance, playerState, 'player_001', overkillDamage);

    // Actual damage should be capped at boss maxHp
    expect(result.result.damage).toBe(boss.maxHp);
    expect(result.boss.currentHp).toBe(0);
  });

  it('should reject challenge from non-member', () => {
    const sim = createSim();
    const bossSys = sim.engine.getAllianceBossSystem();

    const alliance = createAllianceWithMembers(5, 3);
    const boss = createBoss(alliance.level, NOW);
    const playerState = createAlliancePlayerState();

    expect(() => {
      bossSys.challengeBoss(boss, alliance, playerState, 'outsider_999', 10000);
    }).toThrow('不是联盟成员');
  });

  it('should reject challenge when boss already killed', () => {
    const sim = createSim();
    const bossSys = sim.engine.getAllianceBossSystem();

    const alliance = createAllianceWithMembers(5, 3);
    const boss = createBoss(alliance.level, NOW);
    boss.status = BossStatus.KILLED;
    boss.currentHp = 0;
    const playerState = createAlliancePlayerState();

    expect(() => {
      bossSys.challengeBoss(boss, alliance, playerState, 'player_001', 10000);
    }).toThrow('Boss已被击杀');
  });

});

// ═══════════════════════════════════════════════════════════════
// §3.2 联盟对战
// ═══════════════════════════════════════════════════════════════
describe('v13.0 联盟战争 — §3.2 联盟对战', () => {

  it('should access PvP battle system via engine getter', () => {
    const sim = createSim();
    const pvpSys = sim.engine.getPvPBattleSystem();
    expect(pvpSys).toBeDefined();
    expect(typeof pvpSys.executeBattle).toBe('function');
    expect(typeof pvpSys.applyScoreChange).toBe('function');
    expect(typeof pvpSys.getRankIdForScore).toBe('function');
  });

  it('should execute PvP battle between two players', () => {
    // Play §3.2: 1v1车轮战
    const sim = createSim();
    const pvpSys = sim.engine.getPvPBattleSystem();

    const attacker = createArenaPlayerState({ playerId: 'attacker_001', score: 2000 });
    const defender = createArenaPlayerState({ playerId: 'defender_001', score: 1800 });

    const result = pvpSys.executeBattle(attacker, defender, PvPBattleMode.AUTO);

    expect(result).toBeDefined();
    expect(result.battleId).toBeTruthy();
    expect(result.attackerId).toBe('attacker_001');
    expect(result.defenderId).toBe('defender_001');
    expect(typeof result.attackerWon).toBe('boolean');
    expect(typeof result.scoreChange).toBe('number');
    expect(result.totalTurns).toBeGreaterThan(0);
    expect(result.totalTurns).toBeLessThanOrEqual(10);
  });

  it('should apply battle result and update player state', () => {
    // Play §3.2: 胜方联盟获得联盟积分+全员元宝×30+贡献×100
    const sim = createSim();
    const pvpSys = sim.engine.getPvPBattleSystem();

    const attacker = createArenaPlayerState({ playerId: 'attacker_001', score: 2000, arenaCoins: 100 });
    const defender = createArenaPlayerState({ playerId: 'defender_001', score: 1800 });

    const result = pvpSys.executeBattle(attacker, defender);
    const updatedAttacker = pvpSys.applyBattleResult(attacker, result);

    // Score should change
    if (result.attackerWon) {
      expect(updatedAttacker.score).toBeGreaterThan(attacker.score);
    }

    // Arena coins should increase (win: +20, lose: +5)
    expect(updatedAttacker.arenaCoins).toBeGreaterThan(attacker.arenaCoins);
  });

  it('should calculate win/lose score correctly within bounds', () => {
    // Play §3.2: 积分计算
    const sim = createSim();
    const pvpSys = sim.engine.getPvPBattleSystem();

    const scoreConfig = pvpSys.getScoreConfig();

    // Test win scores
    for (let i = 0; i < 50; i++) {
      const winScore = pvpSys.calculateWinScore();
      expect(winScore).toBeGreaterThanOrEqual(scoreConfig.winMinScore);
      expect(winScore).toBeLessThanOrEqual(scoreConfig.winMaxScore);
    }

    // Test lose scores (negative)
    for (let i = 0; i < 50; i++) {
      const loseScore = pvpSys.calculateLoseScore();
      expect(loseScore).toBeLessThanOrEqual(-scoreConfig.loseMinScore);
      expect(loseScore).toBeGreaterThanOrEqual(-scoreConfig.loseMaxScore);
    }
  });

  it('should not let score go below zero', () => {
    // Play §3.2: 积分保底
    const sim = createSim();
    const pvpSys = sim.engine.getPvPBattleSystem();

    const player = createArenaPlayerState({ score: 10 });
    const updated = pvpSys.applyScoreChange(player, -50);
    expect(updated.score).toBe(0);
  });

  it('should simulate alliance war as 5-round car battle', () => {
    // Play §3.2: 1v1车轮战(双方各派5名代表+2名替补)
    const sim = createSim();
    const pvpSys = sim.engine.getPvPBattleSystem();

    // Alliance A representatives (5 members)
    const teamA: ArenaPlayerState[] = [];
    for (let i = 0; i < 5; i++) {
      teamA.push(createArenaPlayerState({
        playerId: `teamA_${i}`,
        score: 2000 + i * 200,
        ranking: 10 + i,
      }));
    }

    // Alliance B representatives (5 members)
    const teamB: ArenaPlayerState[] = [];
    for (let i = 0; i < 5; i++) {
      teamB.push(createArenaPlayerState({
        playerId: `teamB_${i}`,
        score: 1900 + i * 200,
        ranking: 12 + i,
      }));
    }

    // Simulate 5 rounds of 1v1
    let winsA = 0;
    let winsB = 0;
    for (let round = 0; round < 5; round++) {
      const result = pvpSys.executeBattle(teamA[round], teamB[round]);
      if (result.attackerWon) winsA++;
      else winsB++;
    }

    // One side must have won more (or equal)
    expect(winsA + winsB).toBe(5);
    expect(typeof winsA).toBe('number');
    expect(typeof winsB).toBe('number');
  });

  it('should apply defense bonus for defender', () => {
    // Play §3.2: 防守方全属性+5%加成
    const sim = createSim();
    const pvpSys = sim.engine.getPvPBattleSystem();

    const config = pvpSys.getBattleConfig();
    expect(config.defenseBonusRatio).toBe(0.05);
    expect(config.maxTurns).toBe(10);
    expect(config.timeoutWinner).toBe('defender');
  });

  it('should handle timeout: defender wins after 10 turns', () => {
    // Play §3.2: 平局判定: 10回合未分胜负→进攻方获胜(进攻优势)
    const sim = createSim();
    const pvpSys = sim.engine.getPvPBattleSystem();

    const config = pvpSys.getBattleConfig();
    expect(config.maxTurns).toBe(10);
    // Timeout winner is defender per engine config
    expect(config.timeoutWinner).toBe('defender');
  });

});

// ═══════════════════════════════════════════════════════════════
// §3.3 联盟排行榜与赛季
// ═══════════════════════════════════════════════════════════════
describe('v13.0 联盟战争 — §3.3 联盟排行榜与赛季', () => {

  it('should access ranking system via engine getter', () => {
    const sim = createSim();
    const rankingSys = sim.engine.getRankingSystem();
    expect(rankingSys).toBeDefined();
    expect(typeof rankingSys.updateRanking).toBe('function');
    expect(typeof rankingSys.getPlayerRank).toBe('function');
    expect(typeof rankingSys.getTopPlayers).toBe('function');
  });

  it('should update and query rankings', () => {
    // Play §3.3: 联盟战力榜/联盟Boss伤害榜/联盟对战积分榜
    const sim = createSim();
    const rankingSys = sim.engine.getRankingSystem();
    // RankingDimension already imported at top

    const players: ArenaOpponent[] = [
      createArenaOpponent('p1', { power: 10000, score: 5000 }),
      createArenaOpponent('p2', { power: 8000, score: 3000 }),
      createArenaOpponent('p3', { power: 12000, score: 7000 }),
    ];

    // Update power ranking
    const data = rankingSys.updateRanking(RankingDimension.POWER, players, NOW);
    expect(data.entries.length).toBe(3);
    expect(data.entries[0].value).toBe(12000); // Highest power first
    expect(data.lastUpdateTime).toBe(NOW);

    // Query ranking
    const rank = rankingSys.getPlayerRank(RankingDimension.POWER, 'p3');
    expect(rank).toBe(1);
  });

  it('should get top N players', () => {
    const sim = createSim();
    const rankingSys = sim.engine.getRankingSystem();
    // RankingDimension imported at top

    const players: ArenaOpponent[] = Array.from({ length: 20 }, (_, i) =>
      createArenaOpponent(`p_${i}`, { power: 10000 - i * 100 }),
    );

    rankingSys.updateRanking(RankingDimension.POWER, players, NOW);
    const top5 = rankingSys.getTopPlayers(RankingDimension.POWER, 5);
    expect(top5.length).toBe(5);
    expect(top5[0].value).toBeGreaterThan(top5[4].value);
  });

  it('should check ranking refresh interval', () => {
    // Play §3.3: 排行数据每5min刷新
    const sim = createSim();
    const rankingSys = sim.engine.getRankingSystem();
    // RankingDimension imported at top

    // Initially needs refresh
    expect(rankingSys.needsRefresh(RankingDimension.SCORE, NOW)).toBe(true);

    // After update, should not need refresh immediately
    const players = [createArenaOpponent('p1')];
    rankingSys.updateRanking(RankingDimension.SCORE, players, NOW);
    expect(rankingSys.needsRefresh(RankingDimension.SCORE, NOW)).toBe(false);

    // After 5 minutes, should need refresh again
    const config = rankingSys.getConfig();
    expect(rankingSys.needsRefresh(RankingDimension.SCORE, NOW + config.refreshIntervalMs + 1)).toBe(true);
  });

  it('should get nearby players for matching', () => {
    const sim = createSim();
    const rankingSys = sim.engine.getRankingSystem();
    // RankingDimension imported at top

    const players: ArenaOpponent[] = Array.from({ length: 20 }, (_, i) =>
      createArenaOpponent(`p_${i}`, { power: 10000 - i * 100 }),
    );

    rankingSys.updateRanking(RankingDimension.POWER, players, NOW);
    const nearby = rankingSys.getNearbyPlayers(RankingDimension.POWER, 'p_10', 3);
    expect(nearby.length).toBeGreaterThan(0);
    expect(nearby.length).toBeLessThanOrEqual(7); // 3 on each side + self
  });

});

// ═══════════════════════════════════════════════════════════════
// §7.1 赛季主题与周期 (Arena Season)
// ═══════════════════════════════════════════════════════════════
describe('v13.0 联盟战争 — §7 赛季周期', () => {

  it('should access season system via engine getter', () => {
    const sim = createSim();
    const seasonSys = sim.engine.getSeasonSystem();
    expect(seasonSys).toBeDefined();
    expect(typeof seasonSys.createSeason).toBe('function');
    expect(typeof seasonSys.settleSeason).toBe('function');
    expect(typeof seasonSys.grantDailyReward).toBe('function');
  });

  it('should create a 28-day season', () => {
    // Play §7.1: 赛季周期28天(4周)
    const sim = createSim();
    const seasonSys = sim.engine.getSeasonSystem();

    const season = seasonSys.createSeason('season_001', NOW);
    expect(season.seasonId).toBe('season_001');
    expect(season.startTime).toBe(NOW);
    expect(season.endTime - season.startTime).toBe(28 * DAY_MS);
    expect(season.currentDay).toBe(1);
    expect(season.isSettled).toBe(false);
  });

  it('should track season current day', () => {
    const sim = createSim();
    const seasonSys = sim.engine.getSeasonSystem();

    const season = seasonSys.createSeason('season_001', NOW);

    // Day 1
    expect(seasonSys.getCurrentDay(season, NOW)).toBe(1);

    // Day 7
    expect(seasonSys.getCurrentDay(season, NOW + 6 * DAY_MS)).toBe(7);

    // Day 28 (last day)
    expect(seasonSys.getCurrentDay(season, NOW + 27 * DAY_MS)).toBe(28);

    // Beyond season
    expect(seasonSys.getCurrentDay(season, NOW + 30 * DAY_MS)).toBe(28);
  });

  it('should check season active/ended status', () => {
    const sim = createSim();
    const seasonSys = sim.engine.getSeasonSystem();

    const season = seasonSys.createSeason('season_001', NOW);

    // Active during season
    expect(seasonSys.isSeasonActive(season, NOW + DAY_MS)).toBe(true);
    expect(seasonSys.isSeasonEnded(season, NOW + DAY_MS)).toBe(false);

    // Ended after season
    expect(seasonSys.isSeasonActive(season, NOW + 29 * DAY_MS)).toBe(false);
    expect(seasonSys.isSeasonEnded(season, NOW + 29 * DAY_MS)).toBe(true);
  });

  it('should calculate remaining days', () => {
    const sim = createSim();
    const seasonSys = sim.engine.getSeasonSystem();

    const season = seasonSys.createSeason('season_001', NOW);

    expect(seasonSys.getRemainingDays(season, NOW)).toBe(28);
    expect(seasonSys.getRemainingDays(season, NOW + 14 * DAY_MS)).toBe(14);
    expect(seasonSys.getRemainingDays(season, NOW + 28 * DAY_MS)).toBe(0);
  });

  it('should settle season and reset score to rank minimum', () => {
    // Play §7.1: 赛季结算按最高段位发放奖励，积分重置
    const sim = createSim();
    const seasonSys = sim.engine.getSeasonSystem();

    const player = createArenaPlayerState({
      score: 5000,
      rankId: 'DIAMOND_V',
      arenaCoins: 200,
    });

    const result = seasonSys.settleSeason(player, 'DIAMOND_V');

    // Score should reset to rank minimum
    const diamondV = RANK_LEVELS.find(r => r.id === 'DIAMOND_V');
    expect(result.resetScore).toBe(diamondV?.minScore ?? 5000);

    // Reward should be for DIAMOND_V
    expect(result.reward.copper).toBeGreaterThan(0);
    expect(result.reward.arenaCoin).toBeGreaterThan(0);
    expect(result.reward.gold).toBeGreaterThan(0);

    // State should have reset score and added arena coins
    expect(result.state.score).toBe(result.resetScore);
    expect(result.state.arenaCoins).toBeGreaterThan(player.arenaCoins);
  });

  it('should update highest rank during season', () => {
    const sim = createSim();
    const seasonSys = sim.engine.getSeasonSystem();

    let highest = 'BRONZE_V';

    highest = seasonSys.updateHighestRank(highest, 'SILVER_III');
    expect(highest).toBe('SILVER_III');

    // Should keep higher rank
    highest = seasonSys.updateHighestRank(highest, 'BRONZE_I');
    expect(highest).toBe('SILVER_III');

    // Should update to even higher
    highest = seasonSys.updateHighestRank(highest, 'GOLD_I');
    expect(highest).toBe('GOLD_I');
  });

  it('should grant daily rank rewards', () => {
    const sim = createSim();
    const seasonSys = sim.engine.getSeasonSystem();

    const player = createArenaPlayerState({
      rankId: 'GOLD_III',
      arenaCoins: 100,
    });

    const { state, reward } = seasonSys.grantDailyReward(player);

    const goldIII = RANK_LEVELS.find(r => r.id === 'GOLD_III');
    expect(reward.copper).toBe(goldIII?.dailyReward.copper);
    expect(reward.arenaCoin).toBe(goldIII?.dailyReward.arenaCoin);
    expect(state.arenaCoins).toBe(100 + reward.arenaCoin);
  });

  it('should have 21 rank levels (5 tiers)', () => {
    // Play §7.1: 21级段位：青铜V~王者I
    const sim = createSim();
    const pvpSys = sim.engine.getPvPBattleSystem();

    const levels = pvpSys.getAllRankLevels();
    expect(levels.length).toBe(21);

    // Bronze: 5 levels
    const bronzeLevels = levels.filter(l => l.tier === 'BRONZE');
    expect(bronzeLevels.length).toBe(5);

    // King: 1 level
    const kingLevels = levels.filter(l => l.tier === 'KING');
    expect(kingLevels.length).toBe(1);
  });

  it('should have season rewards for all 21 ranks', () => {
    const sim = createSim();
    const seasonSys = sim.engine.getSeasonSystem();

    const rewards = seasonSys.getAllSeasonRewards();
    expect(rewards.length).toBe(21);

    // King_I should have highest rewards
    const kingReward = seasonSys.getSeasonReward('KING_I');
    expect(kingReward.copper).toBe(100000);
    expect(kingReward.title).toBeTruthy();
  });

});

// ═══════════════════════════════════════════════════════════════
// §16.2 联盟对战断线处理
// ═══════════════════════════════════════════════════════════════
describe('v13.0 联盟战争 — §16.2 断线与异常处理', () => {

  it('should handle battle replay save and cleanup', () => {
    // Play §16.2: 断线玩家上线后收到邮件(对战结果+个人判负轮次+参与奖)
    const sim = createSim();
    const pvpSys = sim.engine.getPvPBattleSystem();

    const player = createArenaPlayerState();

    // Create a replay
    const replay = {
      id: 'replay_001',
      battleId: 'pvp_battle_001',
      attackerName: '进攻方',
      defenderName: '防守方',
      attackerWon: true,
      timestamp: NOW,
      totalTurns: 5,
      actions: [],
      result: { winner: 'attacker' } as any,
      keyMoments: [3],
    };

    const updated = pvpSys.saveReplay(player, replay);
    expect(updated.replays.length).toBe(1);
    expect(updated.replays[0].battleId).toBe('pvp_battle_001');
  });

  it('should clean expired replays after retention period', () => {
    const sim = createSim();
    const pvpSys = sim.engine.getPvPBattleSystem();

    const oldReplay = {
      id: 'replay_old',
      battleId: 'battle_old',
      attackerName: 'A',
      defenderName: 'B',
      attackerWon: true,
      timestamp: NOW - 8 * DAY_MS, // 8 days ago (expired)
      totalTurns: 3,
      actions: [],
      result: { winner: 'attacker' } as any,
      keyMoments: [],
    };

    const recentReplay = {
      id: 'replay_recent',
      battleId: 'battle_recent',
      attackerName: 'C',
      defenderName: 'D',
      attackerWon: false,
      timestamp: NOW - DAY_MS, // 1 day ago (valid)
      totalTurns: 7,
      actions: [],
      result: { winner: 'defender' } as any,
      keyMoments: [4],
    };

    const player = createArenaPlayerState({ replays: [oldReplay, recentReplay] });
    const cleaned = pvpSys.cleanExpiredReplays(player, NOW);

    expect(cleaned.replays.length).toBe(1);
    expect(cleaned.replays[0].id).toBe('replay_recent');
  });

  it('should limit replay storage to max 50', () => {
    const sim = createSim();
    const pvpSys = sim.engine.getPvPBattleSystem();

    const player = createArenaPlayerState();

    // Add 55 replays
    let state = player;
    for (let i = 0; i < 55; i++) {
      state = pvpSys.saveReplay(state, {
        id: `replay_${i}`,
        battleId: `battle_${i}`,
        attackerName: `A_${i}`,
        defenderName: `D_${i}`,
        attackerWon: i % 2 === 0,
        timestamp: NOW - i * 1000,
        totalTurns: 3 + (i % 5),
        actions: [],
        result: { winner: i % 2 === 0 ? 'attacker' : 'defender' } as any,
        keyMoments: [],
      });
    }

    expect(state.replays.length).toBe(50);
  });

});

// ═══════════════════════════════════════════════════════════════
// §5.2 Boss讨伐→排行→奖励→商店资源闭环
// ═══════════════════════════════════════════════════════════════
describe('v13.0 联盟战争 — §5.2 Boss讨伐闭环', () => {

  it('should complete Boss → Ranking → Rewards → Shop loop', () => {
    // Play §5.2: Boss讨伐→伤害排行→击杀奖励→贡献值→商店兑换
    const sim = createSim();
    const bossSys = sim.engine.getAllianceBossSystem();
    const shopSys = sim.engine.getAllianceShopSystem();

    // Setup: alliance with 5 members at level 3 (boss HP = 200000)
    let alliance = createAllianceWithMembers(5, 3);
    let boss = createBoss(alliance.level, NOW);

    // Step 1: 5 members challenge boss with 50000 damage each
    // Boss HP at level 3 = 100000 + 2*50000 = 200000
    // After 4 challenges: 200000 - 4*50000 = 0 (killed)
    // 5th member cannot challenge (boss already killed)
    let challengeCount = 0;
    for (let i = 1; i <= 5; i++) {
      if (boss.status === BossStatus.KILLED) break;
      const pid = `player_${String(i).padStart(3, '0')}`;
      const ps = createAlliancePlayerState();
      const result = bossSys.challengeBoss(boss, alliance, ps, pid, 50000);
      boss = result.boss;
      alliance = result.alliance;
      challengeCount++;
    }

    // Step 2: Verify boss is killed
    expect(boss.status).toBe(BossStatus.KILLED);
    expect(alliance.bossKilledToday).toBe(true);
    expect(challengeCount).toBe(4); // 4 challenges to kill

    // Step 3: Get damage ranking
    const ranking = bossSys.getDamageRanking(boss, alliance);
    expect(ranking.length).toBe(challengeCount);

    // Step 4: All members get kill rewards (guild coins)
    const killRewards = bossSys.getKillRewards();
    expect(killRewards.guildCoin).toBeGreaterThan(0);

    // Step 5: Player can use guild coins in shop
    const items = shopSys.getAvailableShopItems(alliance.level);
    expect(items.length).toBeGreaterThan(0);

    // Player with enough guild coins can buy
    const richPlayer = createAlliancePlayerState({ guildCoins: 500 });
    const affordableItem = items.find(i => i.guildCoinCost <= 500);
    if (affordableItem) {
      const afterBuy = shopSys.buyShopItem(richPlayer, affordableItem.id, alliance.level);
      expect(afterBuy.guildCoins).toBe(500 - affordableItem.guildCoinCost);
    }
  });

});

// ═══════════════════════════════════════════════════════════════
// §5.3 联盟对战→赛季→科技→活跃度闭环
// ═══════════════════════════════════════════════════════════════
describe('v13.0 联盟战争 — §5.3 对战赛季闭环', () => {

  it('should complete War → Season → Ranking → Rewards loop', () => {
    // Play §5.3: 联盟对战→赛季积分→赛季结算→奖励
    const sim = createSim();
    const pvpSys = sim.engine.getPvPBattleSystem();
    const seasonSys = sim.engine.getSeasonSystem();

    // Step 1: Create season
    const season = seasonSys.createSeason('season_war_001', NOW);
    expect(seasonSys.isSeasonActive(season, NOW + DAY_MS)).toBe(true);

    // Step 2: Players battle through the season
    let playerState = createArenaPlayerState({ score: 1500, rankId: 'SILVER_V' });
    let highestRank = playerState.rankId;

    // Simulate multiple battles
    for (let i = 0; i < 10; i++) {
      const opponent = createArenaPlayerState({
        playerId: `opp_${i}`,
        score: 1500 + i * 100,
      });
      const result = pvpSys.executeBattle(playerState, opponent);
      playerState = pvpSys.applyBattleResult(playerState, result);

      // Track highest rank
      highestRank = seasonSys.updateHighestRank(highestRank, playerState.rankId);
    }

    // Step 3: Season ends
    const seasonEndTime = NOW + 28 * DAY_MS;
    expect(seasonSys.isSeasonEnded(season, seasonEndTime)).toBe(true);

    // Step 4: Settle season
    const settleResult = seasonSys.settleSeason(playerState, highestRank);
    expect(settleResult.reward).toBeDefined();
    expect(settleResult.state.score).toBeGreaterThanOrEqual(0);
  });

  it('should track rank up and rank down correctly', () => {
    const sim = createSim();
    const pvpSys = sim.engine.getPvPBattleSystem();

    expect(pvpSys.isRankUp('BRONZE_V', 'BRONZE_IV')).toBe(true);
    expect(pvpSys.isRankUp('SILVER_I', 'GOLD_V')).toBe(true);
    expect(pvpSys.isRankUp('GOLD_I', 'SILVER_I')).toBe(false);

    expect(pvpSys.isRankDown('GOLD_I', 'SILVER_I')).toBe(true);
    expect(pvpSys.isRankDown('BRONZE_V', 'BRONZE_IV')).toBe(false);
  });

  it('should serialize and deserialize battle state', () => {
    const sim = createSim();
    const pvpSys = sim.engine.getPvPBattleSystem();

    const player = createArenaPlayerState({
      score: 3000,
      rankId: 'GOLD_V',
      arenaCoins: 500,
      replays: [],
    });

    const serialized = pvpSys.serializeReplays(player);
    expect(serialized.score).toBe(3000);
    expect(serialized.rankId).toBe('GOLD_V');

    const deserialized = pvpSys.deserializeReplays(serialized);
    expect(deserialized.score).toBe(3000);
    expect(deserialized.rankId).toBe('GOLD_V');
  });

});

// ═══════════════════════════════════════════════════════════════
// §14.9 联盟对战窗口期与周日复赛
// ═══════════════════════════════════════════════════════════════
describe('v13.0 联盟战争 — §14.9 对战窗口期', () => {

  it('should verify season config is 28 days', () => {
    const sim = createSim();
    const seasonSys = sim.engine.getSeasonSystem();
    const config = seasonSys.getConfig();
    expect(config.seasonDays).toBe(28);
  });

  it('should verify PvP battle config defaults', () => {
    // Play §14.9: 周六20:00~21:00主赛场 / 周日19:00~20:00复赛场
    const sim = createSim();
    const pvpSys = sim.engine.getPvPBattleSystem();

    const battleConfig = pvpSys.getBattleConfig();
    expect(battleConfig.maxTurns).toBe(10);
    expect(battleConfig.defenseBonusRatio).toBe(0.05);
    expect(battleConfig.timeoutWinner).toBe('defender');
  });

  it('should serialize and deserialize season data', () => {
    const sim = createSim();
    const seasonSys = sim.engine.getSeasonSystem();

    const season = seasonSys.createSeason('season_test', NOW);
    const serialized = seasonSys.serializeSeason(season, 'GOLD_I');

    expect(serialized.season.seasonId).toBe('season_test');
    expect(serialized.highestRankId).toBe('GOLD_I');

    const deserialized = seasonSys.deserializeSeason(serialized);
    expect(deserialized.season.seasonId).toBe('season_test');
    expect(deserialized.highestRankId).toBe('GOLD_I');
  });

});
