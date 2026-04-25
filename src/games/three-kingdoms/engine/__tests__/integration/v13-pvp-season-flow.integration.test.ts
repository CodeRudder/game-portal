/**
 * v13.0 联盟争锋 — §7 PvP赛季深化 Play 流程集成测试
 *
 * 覆盖范围（按 play 文档章节组织）：
 * - §7.1 赛季主题与专属奖励: 28天周期/段位头像框/称号/赛季战绩
 * - §7.2 段位系统与升降级: 21级段位/积分阈值/升降判定
 * - §7.3 竞技场匹配与挑战: 战力匹配/刷新机制/挑战次数
 * - §7.4 防守阵容与策略: 5阵位/5阵型/4策略/防守日志/智能建议
 * - §7.5 赛季结算与重置: 积分重置/奖励发放/段位保留
 * - §7.6 竞技商店: 竞技币兑换/周限购/物品类型
 * - §7.7 排行榜系统: 多维度排名/实时刷新/TopN查询
 * - §7.8 战斗回放: 保存/清理过期/容量限制
 *
 * @see docs/games/three-kingdoms/play/v13-play.md
 */

import { describe, it, expect } from 'vitest';
import { createSim } from '../../../test-utils/test-helpers';
import type { ArenaPlayerState, ArenaOpponent, SeasonData } from '../../../core/pvp/pvp.types';
import {
  FormationType,
  AIDefenseStrategy,
  PvPBattleMode,
  RankTier,
  RankDivision,
} from '../../../core/pvp/pvp.types';
import {
  createDefaultArenaPlayerState,
  createDefaultDefenseFormation,
} from '../../pvp/ArenaConfig';
import {
  RANK_LEVELS,
  RANK_LEVEL_MAP,
  DEFAULT_PVP_BATTLE_CONFIG,
  DEFAULT_SCORE_CONFIG,
  REPLAY_CONFIG,
} from '../../pvp/PvPBattleSystem';
import {
  SEASON_REWARDS,
  DEFAULT_SEASON_CONFIG,
} from '../../pvp/ArenaSeasonSystem';
import {
  DEFAULT_ARENA_SHOP_ITEMS,
} from '../../pvp/ArenaShopSystem';
import {
  DefenseFormationSystem,
  FORMATION_SLOT_COUNT,
  MAX_DEFENSE_LOGS,
  ALL_FORMATIONS,
  ALL_STRATEGIES,
  FORMATION_NAMES,
  STRATEGY_NAMES,
} from '../../pvp/DefenseFormationSystem';
import {
  RankingSystem,
  RankingDimension,
  DEFAULT_RANKING_CONFIG,
} from '../../pvp/RankingSystem';

// ── 辅助函数 ──

const NOW = Date.now();
const DAY_MS = 24 * 60 * 60 * 1000;

/** 创建竞技场玩家状态 */
function createArenaState(overrides: Partial<ArenaPlayerState> = {}): ArenaPlayerState {
  return {
    ...createDefaultArenaPlayerState('player_001'),
    ...overrides,
  };
}

/** 创建竞技场对手 */
function createOpponent(id: string, overrides: Partial<ArenaOpponent> = {}): ArenaOpponent {
  return {
    playerId: id,
    playerName: `对手_${id}`,
    power: 5000 + Math.floor(Math.random() * 5000),
    rankId: 'SILVER_III',
    score: 2100 + Math.floor(Math.random() * 500),
    ranking: Math.floor(Math.random() * 100) + 1,
    faction: 'shu' as const,
    defenseSnapshot: null,
    ...overrides,
  };
}

/** 创建战斗回放 */
function createReplay(timestamp: number, overrides: Record<string, unknown> = {}) {
  return {
    id: `replay_${timestamp}`,
    battleId: `battle_${timestamp}`,
    attackerName: '进攻方',
    defenderName: '防守方',
    attackerWon: true,
    timestamp,
    totalTurns: 5,
    actions: [],
    result: { winner: 'attacker' },
    keyMoments: [3],
    ...overrides,
  } as any;
}

// ═══════════════════════════════════════════════════════════════
// §7.1 赛季主题与专属奖励
// ═══════════════════════════════════════════════════════════════
describe('v13.0 PvP赛季 — §7.1 赛季主题与专属奖励', () => {

  it('should create season with 28-day cycle', () => {
    // Play §7.1: 赛季周期28天(4周)
    const sim = createSim();
    const seasonSys = sim.engine.getSeasonSystem();

    const season = seasonSys.createSeason('s_chibi', NOW);
    expect(season.seasonId).toBe('s_chibi');
    expect(season.endTime - season.startTime).toBe(28 * DAY_MS);
    expect(season.currentDay).toBe(1);
    expect(season.isSettled).toBe(false);
  });

  it('should provide season info: remaining days and current day', () => {
    const sim = createSim();
    const seasonSys = sim.engine.getSeasonSystem();
    const season = seasonSys.createSeason('s_guandu', NOW);

    // Start of season
    expect(seasonSys.getCurrentDay(season, NOW)).toBe(1);
    expect(seasonSys.getRemainingDays(season, NOW)).toBe(28);

    // Mid-season
    expect(seasonSys.getCurrentDay(season, NOW + 14 * DAY_MS)).toBe(15);
    expect(seasonSys.getRemainingDays(season, NOW + 14 * DAY_MS)).toBe(14);

    // Last day
    expect(seasonSys.getCurrentDay(season, NOW + 27 * DAY_MS)).toBe(28);
    expect(seasonSys.getRemainingDays(season, NOW + 27 * DAY_MS)).toBe(1);
  });

  it('should grant season rewards by highest rank', () => {
    // Play §7.1: 赛季专属奖励: 头像框(按段位) + 称号(王者专属)
    const sim = createSim();
    const seasonSys = sim.engine.getSeasonSystem();

    // Bronze reward
    const bronzeReward = seasonSys.getSeasonReward('BRONZE_V');
    expect(bronzeReward.copper).toBeGreaterThan(0);
    expect(bronzeReward.arenaCoin).toBeGreaterThan(0);
    expect(bronzeReward.title).toBeNull();

    // Silver reward has title
    const silverReward = seasonSys.getSeasonReward('SILVER_IV');
    expect(silverReward.title).toBeTruthy();

    // King reward is highest
    const kingReward = seasonSys.getSeasonReward('KING_I');
    expect(kingReward.copper).toBe(100000);
    expect(kingReward.title).toBeTruthy();
    expect(kingReward.gold).toBeGreaterThan(silverReward.gold);
  });

  it('should have unique titles for higher tiers', () => {
    const sim = createSim();
    const seasonSys = sim.engine.getSeasonSystem();
    const rewards = seasonSys.getAllSeasonRewards();

    // King should have a special title
    const kingReward = rewards.find(r => r.rankId === 'KING_I');
    expect(kingReward?.title).toBeTruthy();

    // Diamond should have titles
    const diamondRewards = rewards.filter(r => r.rankId.startsWith('DIAMOND'));
    expect(diamondRewards.every(r => r.title !== null)).toBe(true);

    // Bronze should have no titles
    const bronzeRewards = rewards.filter(r => r.rankId.startsWith('BRONZE'));
    expect(bronzeRewards.every(r => r.title === null)).toBe(true);
  });

});

// ═══════════════════════════════════════════════════════════════
// §7.2 段位系统与升降级
// ═══════════════════════════════════════════════════════════════
describe('v13.0 PvP赛季 — §7.2 段位系统与升降级', () => {

  it('should have 21 rank levels across 5 tiers', () => {
    // Play §7.2: 21级段位：青铜V~王者I
    expect(RANK_LEVELS.length).toBe(21);

    const tiers = [...new Set(RANK_LEVELS.map(r => r.tier))];
    expect(tiers.length).toBe(5);
    expect(tiers).toContain('BRONZE');
    expect(tiers).toContain('SILVER');
    expect(tiers).toContain('GOLD');
    expect(tiers).toContain('DIAMOND');
    expect(tiers).toContain('KING');
  });

  it('should have score thresholds for each rank', () => {
    // Play §7.2: 积分阈值正确触发段位变化
    const sim = createSim();
    const pvpSys = sim.engine.getPvPBattleSystem();

    // Score 0 → BRONZE_V
    expect(pvpSys.getRankIdForScore(0)).toBe('BRONZE_V');

    // Score 300 → BRONZE_IV
    expect(pvpSys.getRankIdForScore(300)).toBe('BRONZE_IV');

    // Score 1500 → SILVER_V
    expect(pvpSys.getRankIdForScore(1500)).toBe('SILVER_V');

    // Score 3000 → GOLD_V
    expect(pvpSys.getRankIdForScore(3000)).toBe('GOLD_V');

    // Score 5000 → DIAMOND_V
    expect(pvpSys.getRankIdForScore(5000)).toBe('DIAMOND_V');

    // Score 10000 → KING_I
    expect(pvpSys.getRankIdForScore(10000)).toBe('KING_I');
  });

  it('should have non-overlapping score ranges', () => {
    for (let i = 0; i < RANK_LEVELS.length - 1; i++) {
      const current = RANK_LEVELS[i];
      const next = RANK_LEVELS[i + 1];
      expect(current.maxScore + 1).toBe(next.minScore);
    }
  });

  it('should detect rank up and rank down', () => {
    const sim = createSim();
    const pvpSys = sim.engine.getPvPBattleSystem();

    // Rank up
    expect(pvpSys.isRankUp('BRONZE_V', 'BRONZE_IV')).toBe(true);
    expect(pvpSys.isRankUp('BRONZE_I', 'SILVER_V')).toBe(true);
    expect(pvpSys.isRankUp('SILVER_I', 'GOLD_V')).toBe(true);

    // Same rank
    expect(pvpSys.isRankUp('BRONZE_V', 'BRONZE_V')).toBe(false);
    expect(pvpSys.isRankDown('BRONZE_V', 'BRONZE_V')).toBe(false);

    // Rank down
    expect(pvpSys.isRankDown('SILVER_V', 'BRONZE_I')).toBe(true);
    expect(pvpSys.isRankDown('GOLD_I', 'SILVER_I')).toBe(true);
  });

  it('should apply score change and update rank', () => {
    const sim = createSim();
    const pvpSys = sim.engine.getPvPBattleSystem();

    // Start at BRONZE_V (score 0)
    const player = createArenaState({ score: 0, rankId: 'BRONZE_V' });

    // Win +50 points
    const afterWin = pvpSys.applyScoreChange(player, 50);
    expect(afterWin.score).toBe(50);
    expect(afterWin.rankId).toBe('BRONZE_V'); // Still BRONZE_V

    // Win big to reach BRONZE_IV
    const afterBigWin = pvpSys.applyScoreChange(afterWin, 300);
    expect(afterBigWin.score).toBe(350);
    expect(afterBigWin.rankId).toBe('BRONZE_IV');
  });

  it('should get daily reward for current rank', () => {
    const sim = createSim();
    const pvpSys = sim.engine.getPvPBattleSystem();

    const bronzeReward = pvpSys.getDailyReward('BRONZE_V');
    expect(bronzeReward.copper).toBe(500);
    expect(bronzeReward.arenaCoin).toBe(10);

    const kingReward = pvpSys.getDailyReward('KING_I');
    expect(kingReward.copper).toBe(8000);
    expect(kingReward.arenaCoin).toBe(300);
  });

  it('should have rank level map for all 21 levels', () => {
    expect(RANK_LEVEL_MAP.size).toBe(21);
    for (const level of RANK_LEVELS) {
      expect(RANK_LEVEL_MAP.has(level.id)).toBe(true);
    }
  });

});

// ═══════════════════════════════════════════════════════════════
// §7.3 竞技场匹配与挑战
// ═══════════════════════════════════════════════════════════════
describe('v13.0 PvP赛季 — §7.3 竞技场匹配与挑战', () => {

  it('should access arena system via engine getter', () => {
    const sim = createSim();
    const arenaSys = sim.engine.getArenaSystem();
    expect(arenaSys).toBeDefined();
    expect(typeof arenaSys.generateOpponents).toBe('function');
    expect(typeof arenaSys.canChallenge).toBe('function');
    expect(typeof arenaSys.consumeChallenge).toBe('function');
    expect(typeof arenaSys.buyChallenge).toBe('function');
  });

  it('should generate opponents within power and rank range', () => {
    // Play §7.3: 战力范围：自身 × 0.7 ~ × 1.3, 排名范围：自身 ±5 ~ ±20
    const sim = createSim();
    const arenaSys = sim.engine.getArenaSystem();

    // Player with score=2000 → power = 2000*10 + 0 + 5000 = 25000
    // Range: 17500 ~ 32500
    const player = createArenaState({ score: 2000, ranking: 50 });
    const opponents: ArenaOpponent[] = [];
    for (let i = 0; i < 30; i++) {
      opponents.push(createOpponent(`opp_${i}`, {
        power: 18000 + i * 500, // 18000 ~ 32500
        ranking: 35 + i,        // 35 ~ 64 (within ±5~±20 of 50)
        score: 1500 + i * 50,
      }));
    }

    const candidates = arenaSys.generateOpponents(player, opponents);
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates.length).toBeLessThanOrEqual(3); // candidateCount = 3
  });

  it('should check free refresh cooldown', () => {
    // Play §7.3: 免费刷新：30分钟间隔
    const sim = createSim();
    const arenaSys = sim.engine.getArenaSystem();

    const player = createArenaState({ lastFreeRefreshTime: NOW });

    // Immediately after refresh — cannot free refresh
    expect(arenaSys.canFreeRefresh(player, NOW)).toBe(false);

    // After 30 minutes — can free refresh
    expect(arenaSys.canFreeRefresh(player, NOW + 30 * 60 * 1000)).toBe(true);
  });

  it('should perform free refresh', () => {
    const sim = createSim();
    const arenaSys = sim.engine.getArenaSystem();

    const player = createArenaState({ score: 2000, ranking: 50, lastFreeRefreshTime: NOW - 60 * 60 * 1000 });
    // Player power = 2000*10 + 5000 = 25000, range: 17500~32500
    const opponents = [
      createOpponent('o1', { power: 20000, ranking: 45 }),
      createOpponent('o2', { power: 22000, ranking: 50 }),
      createOpponent('o3', { power: 25000, ranking: 55 }),
    ];

    const refreshed = arenaSys.freeRefresh(player, opponents, NOW);
    expect(refreshed.opponents.length).toBeGreaterThan(0);
    expect(refreshed.lastFreeRefreshTime).toBe(NOW);
  });

  it('should reject free refresh during cooldown', () => {
    const sim = createSim();
    const arenaSys = sim.engine.getArenaSystem();

    const player = createArenaState({ lastFreeRefreshTime: NOW });
    const opponents = [createOpponent('o1')];

    expect(() => {
      arenaSys.freeRefresh(player, opponents, NOW + 1000);
    }).toThrow('免费刷新冷却中');
  });

  it('should perform manual refresh with cost', () => {
    // Play §7.3: 手动刷新：500铜钱/次，每日10次上限
    const sim = createSim();
    const arenaSys = sim.engine.getArenaSystem();

    const player = createArenaState({ score: 2000, ranking: 50, dailyManualRefreshes: 0 });
    // Player power = 25000, range: 17500~32500
    const opponents = [
      createOpponent('o1', { power: 20000, ranking: 45 }),
      createOpponent('o2', { power: 22000, ranking: 50 }),
    ];

    const result = arenaSys.manualRefresh(player, opponents, NOW);
    expect(result.cost).toBe(500);
    expect(result.state.dailyManualRefreshes).toBe(1);
    expect(result.state.opponents.length).toBeGreaterThan(0);
  });

  it('should enforce manual refresh daily limit', () => {
    const sim = createSim();
    const arenaSys = sim.engine.getArenaSystem();

    const player = createArenaState({ dailyManualRefreshes: 10 });
    const opponents = [createOpponent('o1')];

    expect(() => {
      arenaSys.manualRefresh(player, opponents, NOW);
    }).toThrow('今日手动刷新次数已达上限');
  });

  it('should manage challenge count: 5 free + 5 bought', () => {
    // Play §7.3: 挑战次数：每日5次免费 + 5次购买（50元宝/次）
    const sim = createSim();
    const arenaSys = sim.engine.getArenaSystem();

    const player = createArenaState({ dailyChallengesLeft: 5 });

    // Can challenge
    expect(arenaSys.canChallenge(player)).toBe(true);

    // Consume challenge
    const afterConsume = arenaSys.consumeChallenge(player);
    expect(afterConsume.dailyChallengesLeft).toBe(4);

    // Buy extra challenge
    const buyResult = arenaSys.buyChallenge(afterConsume);
    expect(buyResult.cost).toBe(50);
    expect(buyResult.state.dailyChallengesLeft).toBe(5);
    expect(buyResult.state.dailyBoughtChallenges).toBe(1);
  });

  it('should reject challenge when none left', () => {
    const sim = createSim();
    const arenaSys = sim.engine.getArenaSystem();

    const player = createArenaState({ dailyChallengesLeft: 0 });
    expect(arenaSys.canChallenge(player)).toBe(false);

    expect(() => {
      arenaSys.consumeChallenge(player);
    }).toThrow('今日挑战次数已用完');
  });

  it('should reject buying over daily buy limit', () => {
    const sim = createSim();
    const arenaSys = sim.engine.getArenaSystem();

    const player = createArenaState({ dailyBoughtChallenges: 5 });
    expect(() => {
      arenaSys.buyChallenge(player);
    }).toThrow('今日购买次数已达上限');
  });

  it('should daily reset challenge and refresh counts', () => {
    const sim = createSim();
    const arenaSys = sim.engine.getArenaSystem();

    const player = createArenaState({
      dailyChallengesLeft: 0,
      dailyBoughtChallenges: 5,
      dailyManualRefreshes: 10,
      opponents: [createOpponent('o1')],
    });

    const reset = arenaSys.dailyReset(player);
    expect(reset.dailyChallengesLeft).toBe(5); // dailyFreeChallenges
    expect(reset.dailyBoughtChallenges).toBe(0);
    expect(reset.dailyManualRefreshes).toBe(0);
    expect(reset.opponents).toEqual([]);
  });

});

// ═══════════════════════════════════════════════════════════════
// §7.4 防守阵容与策略
// ═══════════════════════════════════════════════════════════════
describe('v13.0 PvP赛季 — §7.4 防守阵容与策略', () => {

  it('should create default defense formation', () => {
    // Play §7.4: 5个阵位，5种阵型，4种AI策略
    const formation = createDefaultDefenseFormation();
    expect(formation.slots.length).toBe(FORMATION_SLOT_COUNT);
    expect(formation.slots).toEqual(['', '', '', '', '']);
    expect(formation.formation).toBe(FormationType.FISH_SCALE);
    expect(formation.strategy).toBe(AIDefenseStrategy.BALANCED);
  });

  it('should list all 5 formations', () => {
    expect(ALL_FORMATIONS.length).toBe(5);
    expect(ALL_FORMATIONS).toContain(FormationType.FISH_SCALE);
    expect(ALL_FORMATIONS).toContain(FormationType.WEDGE);
    expect(ALL_FORMATIONS).toContain(FormationType.GOOSE);
    expect(ALL_FORMATIONS).toContain(FormationType.SNAKE);
    expect(ALL_FORMATIONS).toContain(FormationType.SQUARE);
  });

  it('should list all 4 strategies', () => {
    expect(ALL_STRATEGIES.length).toBe(4);
    expect(ALL_STRATEGIES).toContain(AIDefenseStrategy.BALANCED);
    expect(ALL_STRATEGIES).toContain(AIDefenseStrategy.AGGRESSIVE);
    expect(ALL_STRATEGIES).toContain(AIDefenseStrategy.DEFENSIVE);
    expect(ALL_STRATEGIES).toContain(AIDefenseStrategy.CUNNING);
  });

  it('should set formation with heroes', () => {
    const dfs = new DefenseFormationSystem();
    const default_ = dfs.createDefaultFormation();

    const updated = dfs.setFormation(
      default_,
      ['liubei', 'guanyu', 'zhangfei', '', ''],
      FormationType.WEDGE,
      AIDefenseStrategy.AGGRESSIVE,
    );

    expect(updated.slots).toEqual(['liubei', 'guanyu', 'zhangfei', '', '']);
    expect(updated.formation).toBe(FormationType.WEDGE);
    expect(updated.strategy).toBe(AIDefenseStrategy.AGGRESSIVE);
  });

  it('should reject formation with no heroes', () => {
    const dfs = new DefenseFormationSystem();
    const default_ = dfs.createDefaultFormation();

    expect(() => {
      dfs.setFormation(default_, ['', '', '', '', '']);
    }).toThrow('至少需要1名武将');
  });

  it('should validate formation correctly', () => {
    const dfs = new DefenseFormationSystem();

    // Valid formation
    const valid = dfs.validateFormation({
      slots: ['hero1', 'hero2', '', '', ''],
      formation: FormationType.FISH_SCALE,
      strategy: AIDefenseStrategy.BALANCED,
    });
    expect(valid.valid).toBe(true);
    expect(valid.errors.length).toBe(0);

    // Invalid: no heroes
    const noHeroes = dfs.validateFormation({
      slots: ['', '', '', '', ''],
      formation: FormationType.FISH_SCALE,
      strategy: AIDefenseStrategy.BALANCED,
    });
    expect(noHeroes.valid).toBe(false);
    expect(noHeroes.errors).toContain('至少需要1名武将');
  });

  it('should detect duplicate heroes in formation', () => {
    const dfs = new DefenseFormationSystem();

    const duplicate = dfs.validateFormation({
      slots: ['hero1', 'hero1', '', '', ''],
      formation: FormationType.FISH_SCALE,
      strategy: AIDefenseStrategy.BALANCED,
    });
    expect(duplicate.valid).toBe(false);
    expect(duplicate.errors).toContain('武将不能重复');
  });

  it('should change formation type independently', () => {
    const dfs = new DefenseFormationSystem();
    const formation = dfs.createDefaultFormation();

    const withWedge = dfs.setFormationType(formation, FormationType.WEDGE);
    expect(withWedge.formation).toBe(FormationType.WEDGE);

    const withSnake = dfs.setFormationType(withWedge, FormationType.SNAKE);
    expect(withSnake.formation).toBe(FormationType.SNAKE);
  });

  it('should change strategy independently', () => {
    const dfs = new DefenseFormationSystem();
    const formation = dfs.createDefaultFormation();

    const aggressive = dfs.setStrategy(formation, AIDefenseStrategy.AGGRESSIVE);
    expect(aggressive.strategy).toBe(AIDefenseStrategy.AGGRESSIVE);

    const defensive = dfs.setStrategy(aggressive, AIDefenseStrategy.DEFENSIVE);
    expect(defensive.strategy).toBe(AIDefenseStrategy.DEFENSIVE);
  });

  it('should create defense snapshot', () => {
    const dfs = new DefenseFormationSystem();
    const formation = dfs.setFormation(
      dfs.createDefaultFormation(),
      ['hero1', 'hero2', '', '', ''],
      FormationType.GOOSE,
      AIDefenseStrategy.CUNNING,
    );

    const snapshot = dfs.createSnapshot(formation);
    expect(snapshot.slots).toEqual(['hero1', 'hero2', '', '', '']);
    expect(snapshot.formation).toBe(FormationType.GOOSE);
    expect(snapshot.aiStrategy).toBe(AIDefenseStrategy.CUNNING);
  });

  it('should manage defense logs with max 50 entries', () => {
    // Play §7.4: 防守日志最多50条
    const dfs = new DefenseFormationSystem();
    let logs: import('../../../core/pvp/pvp.types').DefenseLogEntry[] = [];

    // Add 60 logs
    for (let i = 0; i < 60; i++) {
      logs = dfs.addDefenseLog(logs, {
        attackerId: `attacker_${i}`,
        attackerName: `攻击者${i}`,
        defenderWon: i % 3 === 0,
        turns: 3 + (i % 5),
        attackerRank: 'BRONZE_I',
        timestamp: NOW - i * 1000,
      });
    }

    expect(logs.length).toBe(MAX_DEFENSE_LOGS);
    expect(logs.length).toBe(50);
  });

  it('should compute defense stats and suggest strategy', () => {
    // Play §7.4: 智能建议：根据胜率推荐策略
    const dfs = new DefenseFormationSystem();

    // Create logs with low win rate
    let logs: import('../../../core/pvp/pvp.types').DefenseLogEntry[] = [];
    for (let i = 0; i < 10; i++) {
      logs = dfs.addDefenseLog(logs, {
        attackerId: `a_${i}`,
        attackerName: `A${i}`,
        defenderWon: i < 2, // 20% win rate
        turns: 5,
        attackerRank: 'SILVER_V',
        timestamp: NOW - i * 1000,
      });
    }

    const stats = dfs.getDefenseStats(logs);
    expect(stats.totalDefenses).toBe(10);
    expect(stats.wins).toBe(2);
    expect(stats.losses).toBe(8);
    expect(stats.winRate).toBeCloseTo(0.2, 1);
    expect(stats.suggestedStrategy).toBe(AIDefenseStrategy.DEFENSIVE);
  });

  it('should provide strategy suggestion text', () => {
    const dfs = new DefenseFormationSystem();

    const lowStats = { totalDefenses: 10, wins: 2, losses: 8, winRate: 0.2, suggestedStrategy: AIDefenseStrategy.DEFENSIVE as any };
    const suggestion = dfs.getStrategySuggestion(lowStats);
    expect(suggestion).toBeTruthy();
    expect(suggestion).toContain('坚守');
  });

  it('should get recent logs and filter by attacker', () => {
    const dfs = new DefenseFormationSystem();
    let logs: import('../../../core/pvp/pvp.types').DefenseLogEntry[] = [];

    for (let i = 0; i < 15; i++) {
      logs = dfs.addDefenseLog(logs, {
        attackerId: i < 5 ? 'repeated_attacker' : `a_${i}`,
        attackerName: `A${i}`,
        defenderWon: true,
        turns: 5,
        attackerRank: 'BRONZE_V',
        timestamp: NOW - i * 1000,
      });
    }

    // Get recent 5
    const recent = dfs.getRecentLogs(logs, 5);
    expect(recent.length).toBe(5);

    // Filter by attacker
    const fromRepeated = dfs.getLogsByAttacker(logs, 'repeated_attacker');
    expect(fromRepeated.length).toBe(5);
  });

  it('should have formation and strategy name mappings', () => {
    expect(FORMATION_NAMES[FormationType.FISH_SCALE]).toBe('鱼鳞阵');
    expect(FORMATION_NAMES[FormationType.WEDGE]).toBe('锋矢阵');
    expect(FORMATION_NAMES[FormationType.GOOSE]).toBe('雁行阵');
    expect(FORMATION_NAMES[FormationType.SNAKE]).toBe('长蛇阵');
    expect(FORMATION_NAMES[FormationType.SQUARE]).toBe('方圆阵');

    expect(STRATEGY_NAMES[AIDefenseStrategy.BALANCED]).toBe('均衡');
    expect(STRATEGY_NAMES[AIDefenseStrategy.AGGRESSIVE]).toBe('猛攻');
    expect(STRATEGY_NAMES[AIDefenseStrategy.DEFENSIVE]).toBe('坚守');
    expect(STRATEGY_NAMES[AIDefenseStrategy.CUNNING]).toBe('智谋');
  });

  it('should serialize and deserialize defense data', () => {
    const dfs = new DefenseFormationSystem();

    const player = createArenaState({
      defenseFormation: {
        slots: ['h1', 'h2', '', '', ''],
        formation: FormationType.WEDGE,
        strategy: AIDefenseStrategy.AGGRESSIVE,
      },
      defenseLogs: [],
    });

    const serialized = dfs.serialize(player);
    expect(serialized.defenseFormation.slots).toEqual(['h1', 'h2', '', '', '']);

    const deserialized = dfs.deserialize(serialized);
    expect(deserialized.defenseFormation?.slots).toEqual(['h1', 'h2', '', '', '']);
  });

});

// ═══════════════════════════════════════════════════════════════
// §7.5 赛季结算与重置
// ═══════════════════════════════════════════════════════════════
describe('v13.0 PvP赛季 — §7.5 赛季结算与重置', () => {

  it('should settle season and reset score to rank minimum', () => {
    // Play §7.5: 积分重置到当前段位最低值
    const sim = createSim();
    const seasonSys = sim.engine.getSeasonSystem();

    const player = createArenaState({
      score: 6500,
      rankId: 'DIAMOND_IV',
      arenaCoins: 300,
    });

    const result = seasonSys.settleSeason(player, 'DIAMOND_IV');

    // Score resets to DIAMOND_IV minimum
    const diamondIV = RANK_LEVELS.find(r => r.id === 'DIAMOND_IV');
    expect(result.resetScore).toBe(diamondIV?.minScore);
    expect(result.state.score).toBe(result.resetScore);

    // Arena coins increase by reward
    const reward = seasonSys.getSeasonReward('DIAMOND_IV');
    expect(result.state.arenaCoins).toBe(300 + reward.arenaCoin);

    // Daily data reset
    expect(result.state.dailyChallengesLeft).toBe(5);
    expect(result.state.dailyBoughtChallenges).toBe(0);
    expect(result.state.replays).toEqual([]);
    expect(result.state.defenseLogs).toEqual([]);
  });

  it('should track highest rank throughout season', () => {
    const sim = createSim();
    const seasonSys = sim.engine.getSeasonSystem();

    let highest = 'BRONZE_V';

    highest = seasonSys.updateHighestRank(highest, 'SILVER_I');
    expect(highest).toBe('SILVER_I');

    // Lower rank doesn't change highest
    highest = seasonSys.updateHighestRank(highest, 'BRONZE_I');
    expect(highest).toBe('SILVER_I');

    // Higher rank updates
    highest = seasonSys.updateHighestRank(highest, 'GOLD_III');
    expect(highest).toBe('GOLD_III');

    highest = seasonSys.updateHighestRank(highest, 'KING_I');
    expect(highest).toBe('KING_I');
  });

  it('should grant daily reward by current rank', () => {
    const sim = createSim();
    const seasonSys = sim.engine.getSeasonSystem();

    const player = createArenaState({
      rankId: 'DIAMOND_I',
      arenaCoins: 100,
    });

    const { state, reward } = seasonSys.grantDailyReward(player);
    const diamondI = RANK_LEVELS.find(r => r.id === 'DIAMOND_I');

    expect(reward.copper).toBe(diamondI?.dailyReward.copper);
    expect(reward.arenaCoin).toBe(diamondI?.dailyReward.arenaCoin);
    expect(state.arenaCoins).toBe(100 + reward.arenaCoin);
  });

  it('should handle full season lifecycle', () => {
    // End-to-end: create → battle → settle → new season
    const sim = createSim();
    const seasonSys = sim.engine.getSeasonSystem();
    const pvpSys = sim.engine.getPvPBattleSystem();

    // Create season
    const season = seasonSys.createSeason('lifecycle_001', NOW);

    // Player starts at BRONZE_V
    let player = createArenaState({ score: 0, rankId: 'BRONZE_V' });
    let highestRank = 'BRONZE_V';

    // Simulate battles throughout season
    for (let day = 0; day < 28; day++) {
      for (let battle = 0; battle < 3; battle++) {
        const opponent = createArenaState({
          playerId: `opp_d${day}_b${battle}`,
          score: player.score + Math.floor(Math.random() * 500 - 250),
        });
        const result = pvpSys.executeBattle(player, opponent);
        player = pvpSys.applyBattleResult(player, result);
        highestRank = seasonSys.updateHighestRank(highestRank, player.rankId);
      }
    }

    // Season ends
    expect(seasonSys.isSeasonEnded(season, NOW + 28 * DAY_MS)).toBe(true);

    // Settle
    const settleResult = seasonSys.settleSeason(player, highestRank);
    expect(settleResult.reward).toBeDefined();
    expect(settleResult.state.score).toBeGreaterThanOrEqual(0);

    // New season
    const newSeason = seasonSys.createSeason('lifecycle_002', NOW + 29 * DAY_MS);
    expect(newSeason.seasonId).toBe('lifecycle_002');
    expect(seasonSys.isSeasonActive(newSeason, NOW + 30 * DAY_MS)).toBe(true);
  });

});

// ═══════════════════════════════════════════════════════════════
// §7.6 竞技商店
// ═══════════════════════════════════════════════════════════════
describe('v13.0 PvP赛季 — §7.6 竞技商店', () => {

  it('should access arena shop system via engine getter', () => {
    const sim = createSim();
    const shopSys = sim.engine.getArenaShopSystem();
    expect(shopSys).toBeDefined();
    expect(typeof shopSys.buyItem).toBe('function');
    expect(typeof shopSys.getAllItems).toBe('function');
    expect(typeof shopSys.weeklyReset).toBe('function');
  });

  it('should have default shop items with various types', () => {
    // Play §7.6: 武将碎片/强化石/装备箱/头像框
    const sim = createSim();
    const shopSys = sim.engine.getArenaShopSystem();

    const items = shopSys.getAllItems();
    expect(items.length).toBeGreaterThan(0);

    const types = new Set(items.map(i => i.itemType));
    expect(types.has('hero_fragment')).toBe(true);
    expect(types.has('enhance_stone')).toBe(true);
    expect(types.has('equipment_box')).toBe(true);
    expect(types.has('avatar_frame')).toBe(true);
  });

  it('should buy item with arena coins', () => {
    const sim = createSim();
    const shopSys = sim.engine.getArenaShopSystem();

    const player = createArenaState({ arenaCoins: 1000 });
    const items = shopSys.getAllItems();
    const affordable = items.find(i => i.arenaCoinCost <= 1000 && i.weeklyLimit > 0);

    if (affordable) {
      const result = shopSys.buyItem(player, affordable.itemId, 1);
      expect(result.state.arenaCoins).toBe(1000 - affordable.arenaCoinCost);
      expect(result.item.itemId).toBe(affordable.itemId);
    }
  });

  it('should enforce weekly purchase limit', () => {
    const sim = createSim();
    const shopSys = sim.engine.getArenaShopSystem();

    const player = createArenaState({ arenaCoins: 100000 });
    const items = shopSys.getAllItems();
    const limited = items.find(i => i.weeklyLimit > 0 && i.weeklyLimit <= 3);

    if (limited) {
      // Buy up to limit
      const result1 = shopSys.buyItem(player, limited.itemId, limited.weeklyLimit);
      expect(result1.item.purchased).toBe(limited.weeklyLimit);

      // Try to buy one more — should fail
      const canBuy = shopSys.canBuy(result1.state, limited.itemId, 1);
      expect(canBuy.canBuy).toBe(false);
      expect(canBuy.reason).toContain('限购');
    }
  });

  it('should reject purchase with insufficient arena coins', () => {
    const sim = createSim();
    const shopSys = sim.engine.getArenaShopSystem();

    const player = createArenaState({ arenaCoins: 10 });
    const items = shopSys.getAllItems();
    const expensive = items.find(i => i.arenaCoinCost > 10);

    if (expensive) {
      const canBuy = shopSys.canBuy(player, expensive.itemId, 1);
      expect(canBuy.canBuy).toBe(false);
      expect(canBuy.reason).toContain('竞技币不足');
    }
  });

  it('should weekly reset purchased counts', () => {
    const sim = createSim();
    const shopSys = sim.engine.getArenaShopSystem();

    const player = createArenaState({ arenaCoins: 100000 });
    const items = shopSys.getAllItems();
    const limited = items.find(i => i.weeklyLimit > 0);

    if (limited) {
      shopSys.buyItem(player, limited.itemId, 1);

      // Reset
      shopSys.weeklyReset();

      // Should be able to buy again
      const afterReset = shopSys.getItem(limited.itemId);
      expect(afterReset?.purchased).toBe(0);
    }
  });

  it('should get items by type', () => {
    const sim = createSim();
    const shopSys = sim.engine.getArenaShopSystem();

    const fragments = shopSys.getItemsByType('hero_fragment');
    expect(fragments.length).toBeGreaterThan(0);
    expect(fragments.every(i => i.itemType === 'hero_fragment')).toBe(true);

    const stones = shopSys.getItemsByType('enhance_stone');
    expect(stones.length).toBeGreaterThan(0);
  });

  it('should serialize and deserialize shop data', () => {
    const sim = createSim();
    const shopSys = sim.engine.getArenaShopSystem();

    const serialized = shopSys.serialize();
    expect(serialized.version).toBe(1);
    expect(serialized.items.length).toBeGreaterThan(0);

    // Modify and deserialize
    const modified = { ...serialized, items: serialized.items.slice(0, 3) };
    shopSys.deserialize(modified);
    expect(shopSys.getAllItems().length).toBe(3);
  });

});

// ═══════════════════════════════════════════════════════════════
// §7.7 排行榜系统
// ═══════════════════════════════════════════════════════════════
describe('v13.0 PvP赛季 — §7.7 排行榜系统', () => {

  it('should update ranking and sort by value descending', () => {
    const sim = createSim();
    const rankingSys = sim.engine.getRankingSystem();

    const players: ArenaOpponent[] = [
      createOpponent('p1', { power: 5000, score: 2000 }),
      createOpponent('p2', { power: 8000, score: 4000 }),
      createOpponent('p3', { power: 6000, score: 3000 }),
    ];

    const data = rankingSys.updateRanking(RankingDimension.SCORE, players, NOW);
    expect(data.entries[0].value).toBe(4000);
    expect(data.entries[1].value).toBe(3000);
    expect(data.entries[2].value).toBe(2000);
  });

  it('should get player rank (1-based)', () => {
    const sim = createSim();
    const rankingSys = sim.engine.getRankingSystem();

    const players: ArenaOpponent[] = [
      createOpponent('p1', { power: 5000, score: 2000 }),
      createOpponent('p2', { power: 8000, score: 4000 }),
      createOpponent('p3', { power: 6000, score: 3000 }),
    ];

    rankingSys.updateRanking(RankingDimension.SCORE, players, NOW);

    expect(rankingSys.getPlayerRank(RankingDimension.SCORE, 'p2')).toBe(1);
    expect(rankingSys.getPlayerRank(RankingDimension.SCORE, 'p3')).toBe(2);
    expect(rankingSys.getPlayerRank(RankingDimension.SCORE, 'p1')).toBe(3);
    expect(rankingSys.getPlayerRank(RankingDimension.SCORE, 'unknown')).toBe(0);
  });

  it('should limit display count', () => {
    const sim = createSim();
    const rankingSys = sim.engine.getRankingSystem();

    const players = Array.from({ length: 200 }, (_, i) =>
      createOpponent(`p_${i}`, { power: 10000 - i * 10 }),
    );

    const data = rankingSys.updateRanking(RankingDimension.POWER, players, NOW);
    expect(data.entries.length).toBeLessThanOrEqual(DEFAULT_RANKING_CONFIG.maxDisplayCount);
  });

  it('should support multiple ranking dimensions', () => {
    const sim = createSim();
    const rankingSys = sim.engine.getRankingSystem();

    const dimensions = rankingSys.getDimensions();
    expect(dimensions).toContain(RankingDimension.SCORE);
    expect(dimensions).toContain(RankingDimension.POWER);
    expect(dimensions).toContain(RankingDimension.SEASON);
  });

  it('should serialize and deserialize rankings', () => {
    const sim = createSim();
    const rankingSys = sim.engine.getRankingSystem();

    const players = [createOpponent('p1', { power: 9000 }), createOpponent('p2', { power: 7000 })];
    rankingSys.updateRanking(RankingDimension.POWER, players, NOW);

    const serialized = rankingSys.serialize();
    expect(serialized.version).toBe(1);
    expect(serialized.powerRanking.entries.length).toBe(2);

    // Reset and restore
    rankingSys.reset();
    expect(rankingSys.getEntryCount(RankingDimension.POWER)).toBe(0);

    rankingSys.deserialize(serialized);
    expect(rankingSys.getEntryCount(RankingDimension.POWER)).toBe(2);
  });

});

// ═══════════════════════════════════════════════════════════════
// §7.8 战斗回放
// ═══════════════════════════════════════════════════════════════
describe('v13.0 PvP赛季 — §7.8 战斗回放', () => {

  it('should save and retrieve replays', () => {
    const sim = createSim();
    const pvpSys = sim.engine.getPvPBattleSystem();

    const player = createArenaState();
    const replay = createReplay(NOW);

    const updated = pvpSys.saveReplay(player, replay);
    expect(updated.replays.length).toBe(1);
    expect(updated.replays[0].id).toBe(`replay_${NOW}`);
  });

  it('should limit replays to max 50', () => {
    expect(REPLAY_CONFIG.maxReplays).toBe(50);

    const sim = createSim();
    const pvpSys = sim.engine.getPvPBattleSystem();

    let player = createArenaState();
    for (let i = 0; i < 60; i++) {
      player = pvpSys.saveReplay(player, createReplay(NOW - i * 1000));
    }

    expect(player.replays.length).toBe(50);
    // Most recent saved is first (saveReplay prepends)
    // The last iteration (i=59) creates timestamp NOW - 59000 and is prepended last
    // The first iteration (i=0) creates timestamp NOW and was prepended first but shifted down
    // After 60 iterations, the array has the last 50 saves with the most recently saved first
    // Most recently saved = i=59 (timestamp NOW - 59000) at index 0
    expect(player.replays[0].timestamp).toBe(NOW - 59000);
  });

  it('should clean expired replays (7 day retention)', () => {
    expect(REPLAY_CONFIG.retentionDays).toBe(7);

    const sim = createSim();
    const pvpSys = sim.engine.getPvPBattleSystem();

    const player = createArenaState({
      replays: [
        createReplay(NOW - 8 * DAY_MS), // Expired
        createReplay(NOW - 6 * DAY_MS), // Valid
        createReplay(NOW - 3 * DAY_MS), // Valid
        createReplay(NOW),               // Valid
      ],
    });

    const cleaned = pvpSys.cleanExpiredReplays(player, NOW);
    expect(cleaned.replays.length).toBe(3);
  });

  it('should serialize and deserialize replay data', () => {
    const sim = createSim();
    const pvpSys = sim.engine.getPvPBattleSystem();

    const player = createArenaState({
      score: 5000,
      rankId: 'DIAMOND_V',
      arenaCoins: 300,
      replays: [createReplay(NOW)],
    });

    const serialized = pvpSys.serializeReplays(player);
    expect(serialized.score).toBe(5000);
    expect(serialized.rankId).toBe('DIAMOND_V');
    expect(serialized.arenaCoins).toBe(300);
    expect(serialized.replays.length).toBe(1);

    const deserialized = pvpSys.deserializeReplays(serialized);
    expect(deserialized.score).toBe(5000);
    expect(deserialized.rankId).toBe('DIAMOND_V');
  });

});

// ═══════════════════════════════════════════════════════════════
// §7.9 跨系统联动验证
// ═══════════════════════════════════════════════════════════════
describe('v13.0 PvP赛季 — §7.9 跨系统联动', () => {

  it('should link PvP battle with season and ranking', () => {
    // Full loop: battle → score change → rank update → ranking update → season settle
    const sim = createSim();
    const pvpSys = sim.engine.getPvPBattleSystem();
    const seasonSys = sim.engine.getSeasonSystem();
    const rankingSys = sim.engine.getRankingSystem();

    // Setup player
    let player = createArenaState({ score: 0, rankId: 'BRONZE_V' });
    let highestRank = 'BRONZE_V';

    // Create season
    const season = seasonSys.createSeason('cross_sys_001', NOW);

    // Battle loop
    const allOpponents: ArenaOpponent[] = [];
    for (let i = 0; i < 5; i++) {
      const opponent = createArenaState({
        playerId: `opp_${i}`,
        score: 1000 + i * 200,
      });
      allOpponents.push(createOpponent(`opp_${i}`, { score: opponent.score }));

      const result = pvpSys.executeBattle(player, opponent);
      player = pvpSys.applyBattleResult(player, result);
      highestRank = seasonSys.updateHighestRank(highestRank, player.rankId);
    }

    // Update ranking
    rankingSys.updateRanking(RankingDimension.SCORE, allOpponents, NOW);
    expect(rankingSys.getEntryCount(RankingDimension.SCORE)).toBeGreaterThan(0);

    // Season settle
    const settle = seasonSys.settleSeason(player, highestRank);
    expect(settle.reward).toBeDefined();
    expect(settle.state.score).toBeGreaterThanOrEqual(0);
  });

  it('should link arena shop with battle rewards', () => {
    // Battle → earn arena coins → spend in shop
    const sim = createSim();
    const pvpSys = sim.engine.getPvPBattleSystem();
    const shopSys = sim.engine.getArenaShopSystem();

    let player = createArenaState({ arenaCoins: 0 });

    // Win battles to earn coins
    for (let i = 0; i < 5; i++) {
      const opponent = createArenaState({ playerId: `opp_${i}`, score: 1000 });
      const result = pvpSys.executeBattle(player, opponent);
      player = pvpSys.applyBattleResult(player, result);
    }

    // Should have earned some arena coins
    expect(player.arenaCoins).toBeGreaterThan(0);

    // Try to buy something
    const items = shopSys.getAllItems();
    const affordable = items.find(i => i.arenaCoinCost <= player.arenaCoins);
    if (affordable) {
      const canBuy = shopSys.canBuy(player, affordable.itemId, 1);
      if (canBuy.canBuy) {
        const buyResult = shopSys.buyItem(player, affordable.itemId, 1);
        expect(buyResult.state.arenaCoins).toBeLessThan(player.arenaCoins);
      }
    }
  });

  it('should link defense formation with arena system', () => {
    // Set defense formation → update arena state
    const sim = createSim();
    const arenaSys = sim.engine.getArenaSystem();

    const player = createArenaState();
    const updated = arenaSys.updateDefenseFormation(
      player,
      ['hero1', 'hero2', 'hero3', '', ''],
      FormationType.SNAKE,
      AIDefenseStrategy.CUNNING,
    );

    expect(updated.defenseFormation.slots).toEqual(['hero1', 'hero2', 'hero3', '', '']);
    expect(updated.defenseFormation.formation).toBe(FormationType.SNAKE);
    expect(updated.defenseFormation.strategy).toBe(AIDefenseStrategy.CUNNING);
  });

  it('should serialize and deserialize full arena state', () => {
    const sim = createSim();
    const arenaSys = sim.engine.getArenaSystem();

    const player = createArenaState({
      score: 3000,
      rankId: 'GOLD_V',
      arenaCoins: 500,
      defenseFormation: {
        slots: ['h1', 'h2', '', '', ''],
        formation: FormationType.WEDGE,
        strategy: AIDefenseStrategy.AGGRESSIVE,
      },
    });

    const serialized = arenaSys.serialize(player);
    expect(serialized.version).toBe(1);
    expect(serialized.state.score).toBe(3000);

    const deserialized = arenaSys.deserialize(serialized);
    expect(deserialized.score).toBe(3000);
    expect(deserialized.rankId).toBe('GOLD_V');
  });

});
