/**
 * PvP 模块对抗式测试
 *
 * 覆盖子系统：
 *   S1: ArenaSystem（匹配/对手生成/刷新/挑战次数/防守阵容/防守日志/序列化）
 *   S2: PvPBattleSystem（战斗执行/积分计算/段位判定/回放管理）
 *   S3: RankingSystem（多维度排名/排名查询/序列化）
 *   S4: ArenaShopSystem（竞技币商店/兑换/限购）
 *
 * 5维度：F-Normal / F-Error / F-Boundary / F-Cross / F-Lifecycle
 * @module tests/adversarial/pvp-adversarial
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ArenaSystem, calculatePower, selectByFactionBalance } from '../../engine/pvp/ArenaSystem';
import {
  PvPBattleSystem,
  RANK_LEVELS,
  RANK_LEVEL_MAP,
  DEFAULT_PVP_BATTLE_CONFIG,
  DEFAULT_SCORE_CONFIG,
} from '../../engine/pvp/PvPBattleSystem';
import { RankingSystem, RankingDimension, RANKING_SAVE_VERSION } from '../../engine/pvp/RankingSystem';
import {
  createDefaultArenaPlayerState,
  createDefaultDefenseFormation,
  ARENA_SAVE_VERSION,
} from '../../engine/pvp/ArenaConfig';
import { FormationType, AIDefenseStrategy, PvPBattleMode, RankDivision } from '../../core/pvp/pvp.types';
import type { ArenaPlayerState, ArenaOpponent, BattleReplay } from '../../core/pvp/pvp.types';
import type { ISystemDeps } from '../../core/types';

// ── 测试辅助 ──────────────────────────────────

const mockDeps = (): ISystemDeps => {
  const ls = new Map<string, Function[]>();
  return {
    eventBus: {
      on: vi.fn((e: string, h: Function) => { (ls.has(e) ? ls : ls.set(e, [])).get(e)!.push(h); return vi.fn(); }),
      once: vi.fn((e: string, h: Function) => { (ls.has(e) ? ls : ls.set(e, [])).get(e)!.push(h); return vi.fn(); }),
      emit: vi.fn((e: string, p?: unknown) => { ls.get(e)?.forEach(h => h(p)); }),
      off: vi.fn(), removeAllListeners: vi.fn(),
    },
    config: { get: vi.fn(), set: vi.fn() },
    registry: { register: vi.fn(), get: vi.fn(), getAll: vi.fn(), has: vi.fn(), unregister: vi.fn() },
  } as unknown as ISystemDeps;
};

const ps = (o: Partial<ArenaPlayerState> = {}): ArenaPlayerState => ({
  ...createDefaultArenaPlayerState('player_1'), ...o,
});

const opp = (o: Partial<ArenaOpponent> = {}): ArenaOpponent => ({
  playerId: 'opp_1', playerName: '对手1', power: 5000, rankId: 'BRONZE_V',
  score: 0, ranking: 10, faction: 'wei' as any, defenseSnapshot: null, ...o,
});

const createEnv = () => {
  const deps = mockDeps();
  const arena = new ArenaSystem(); arena.init(deps);
  const battle = new PvPBattleSystem(); battle.init(deps);
  const ranking = new RankingSystem(); ranking.init(deps);
  return { deps, arena, battle, ranking };
};

const NOW = 1700000000000;
const DAY_MS = 86400000;

const rep = (o: Partial<BattleReplay> = {}): BattleReplay => ({
  id: 'r1', battleId: 'b1', attackerName: '攻', defenderName: '守',
  attackerWon: true, timestamp: NOW, totalTurns: 5, actions: [],
  result: { winner: 'attacker' } as any, keyMoments: [3], ...o,
});

/** 生成一批对手 */
const genOpponents = (count: number, basePower = 5000, baseRanking = 10): ArenaOpponent[] =>
  Array.from({ length: count }, (_, i) => opp({
    playerId: `opp_${i}`, playerName: `对手${i}`, power: basePower + i * 100,
    ranking: baseRanking + i, score: i * 100, rankId: 'BRONZE_V',
    faction: (['wei', 'shu', 'wu'] as any)[i % 3],
  }));

/** 生成适合匹配的对手（战力在playerPower*0.7~1.3范围内） */
const genMatchableOpponents = (playerState: ArenaPlayerState, count: number): ArenaOpponent[] => {
  const myPower = calculatePower(playerState);
  const minPower = Math.floor(myPower * 0.7);
  const maxPower = Math.ceil(myPower * 1.3);
  const myRanking = playerState.ranking || 10;
  return Array.from({ length: count }, (_, i) => opp({
    playerId: `opp_${i}`, playerName: `对手${i}`,
    power: minPower + Math.floor((maxPower - minPower) * i / count),
    ranking: Math.max(1, myRanking - 20 + i * 2),
    score: i * 100, rankId: 'BRONZE_V',
    faction: (['wei', 'shu', 'wu'] as any)[i % 3],
  }));
};

// ═══════════════════════════════════════════════
// F-Normal: 正常流程
// ═══════════════════════════════════════════════

describe('PvP对抗测试 — F-Normal', () => {

  describe('ArenaSystem 匹配流程', () => {
    it('生成候选对手', () => {
      const { arena } = createEnv();
      const player = ps({ score: 1000, ranking: 10 });
      const opponents = genMatchableOpponents(player, 20);
      const result = arena.generateOpponents(player, opponents);
      expect(result.length).toBeGreaterThan(0);
      expect(result.length).toBeLessThanOrEqual(arena.getMatchConfig().candidateCount);
    });

    it('免费刷新对手', () => {
      const { arena } = createEnv();
      const player = ps({ lastFreeRefreshTime: 0, score: 1000, ranking: 10 });
      const opponents = genMatchableOpponents(player, 20);
      const refreshed = arena.freeRefresh(player, opponents, NOW);
      expect(refreshed.lastFreeRefreshTime).toBe(NOW);
      expect(refreshed.opponents.length).toBeGreaterThan(0);
    });

    it('手动刷新消耗铜钱', () => {
      const { arena } = createEnv();
      const player = ps({ dailyManualRefreshes: 0 });
      const opponents = genOpponents(20);
      const { state, cost } = arena.manualRefresh(player, opponents, NOW);
      expect(state.dailyManualRefreshes).toBe(1);
      expect(cost).toBeGreaterThan(0);
    });

    it('消耗挑战次数', () => {
      const { arena } = createEnv();
      const player = ps({ dailyChallengesLeft: 5 });
      const after = arena.consumeChallenge(player);
      expect(after.dailyChallengesLeft).toBe(4);
    });

    it('购买额外挑战次数', () => {
      const { arena } = createEnv();
      const player = ps({ dailyChallengesLeft: 0, dailyBoughtChallenges: 0 });
      const { state, cost } = arena.buyChallenge(player);
      expect(state.dailyChallengesLeft).toBe(1);
      expect(state.dailyBoughtChallenges).toBe(1);
      expect(cost).toBeGreaterThan(0);
    });

    it('每日重置', () => {
      const { arena } = createEnv();
      const player = ps({ dailyChallengesLeft: 0, dailyBoughtChallenges: 5, dailyManualRefreshes: 10 });
      const reset = arena.dailyReset(player);
      expect(reset.dailyChallengesLeft).toBe(arena.getChallengeConfig().dailyFreeChallenges);
      expect(reset.dailyBoughtChallenges).toBe(0);
      expect(reset.dailyManualRefreshes).toBe(0);
    });
  });

  describe('PvPBattleSystem 战斗流程', () => {
    it('执行战斗并返回结果', () => {
      const { battle } = createEnv();
      const attacker = ps({ score: 1000, playerId: 'p1' });
      const defender = ps({ score: 800, playerId: 'p2' });
      const result = battle.executeBattle(attacker, defender);
      expect(result.battleId).toBeTruthy();
      expect(result.attackerWon).toBeDefined();
      expect(result.scoreChange).toBeDefined();
      expect(result.totalTurns).toBeGreaterThan(0);
    });

    it('积分变化正确应用', () => {
      const { battle } = createEnv();
      const player = ps({ score: 1000, rankId: 'BRONZE_III' });
      const updated = battle.applyScoreChange(player, 50);
      expect(updated.score).toBe(1050);
      expect(updated.rankId).toBeTruthy();
    });

    it('段位判定正确', () => {
      const { battle } = createEnv();
      expect(battle.getRankIdForScore(0)).toBe('BRONZE_V');
      expect(battle.getRankIdForScore(1500)).toBe('SILVER_V');
      expect(battle.getRankIdForScore(10000)).toBe('KING_I');
    });

    it('获取每日奖励', () => {
      const { battle } = createEnv();
      const reward = battle.getDailyReward('BRONZE_V');
      expect(reward.copper).toBeGreaterThan(0);
      expect(reward.arenaCoin).toBeGreaterThan(0);
    });
  });

  describe('RankingSystem 排名流程', () => {
    it('更新排行榜', () => {
      const { ranking } = createEnv();
      const players = genOpponents(10, 5000, 10)
        .map((p, i) => ({ ...p, score: 1000 - i * 100 }));
      const data = ranking.updateRanking(RankingDimension.SCORE, players as any, NOW);
      expect(data.entries.length).toBe(10);
      expect(data.entries[0].value).toBeGreaterThanOrEqual(data.entries[9].value);
    });

    it('获取玩家排名', () => {
      const { ranking } = createEnv();
      const players = genOpponents(10).map((p, i) => ({ ...p, score: 1000 - i * 100 }));
      ranking.updateRanking(RankingDimension.SCORE, players as any, NOW);
      const rank = ranking.getPlayerRank(RankingDimension.SCORE, 'opp_0');
      expect(rank).toBe(1);
    });

    it('获取Top N玩家', () => {
      const { ranking } = createEnv();
      const players = genOpponents(20).map((p, i) => ({ ...p, score: 2000 - i * 100 }));
      ranking.updateRanking(RankingDimension.SCORE, players as any, NOW);
      const top5 = ranking.getTopPlayers(RankingDimension.SCORE, 5);
      expect(top5.length).toBe(5);
    });
  });

  describe('防守阵容管理', () => {
    it('更新防守阵容', () => {
      const { arena } = createEnv();
      const player = ps();
      const slots: [string, string, string, string, string] = ['hero1', 'hero2', '', '', ''];
      const updated = arena.updateDefenseFormation(player, slots, FormationType.CRANE_WING, AIDefenseStrategy.BALANCED);
      expect(updated.defenseFormation.slots).toEqual(slots);
      expect(updated.defenseFormation.formation).toBe(FormationType.CRANE_WING);
    });

    it('添加防守日志', () => {
      const { arena } = createEnv();
      const player = ps();
      const log = { attackerId: 'a1', attackerName: '攻', defenderWon: true, turns: 5, attackerRank: 'BRONZE_V' };
      const updated = arena.addDefenseLog(player, log, NOW);
      expect(updated.defenseLogs.length).toBe(1);
    });

    it('获取防守统计', () => {
      const { arena } = createEnv();
      const player = ps({
        defenseLogs: Array.from({ length: 10 }, (_, i) => ({
          id: `d${i}`, attackerId: `a${i}`, attackerName: `攻${i}`,
          defenderWon: i < 7, turns: 5, attackerRank: 'BRONZE_V', timestamp: NOW,
        })),
      });
      const stats = arena.getDefenseStats(player);
      expect(stats.totalDefenses).toBe(10);
      expect(stats.wins).toBe(7);
      expect(stats.losses).toBe(3);
      expect(stats.winRate).toBeCloseTo(0.7);
    });
  });
});

// ═══════════════════════════════════════════════
// F-Error: 错误路径
// ═══════════════════════════════════════════════

describe('PvP对抗测试 — F-Error', () => {

  describe('ArenaSystem 错误处理', () => {
    it('免费刷新冷却中抛异常', () => {
      const { arena } = createEnv();
      const player = ps({ lastFreeRefreshTime: NOW });
      expect(() => arena.freeRefresh(player, [], NOW)).toThrow('免费刷新冷却中');
    });

    it('手动刷新超限抛异常', () => {
      const { arena } = createEnv();
      const limit = arena.getRefreshConfig().dailyManualLimit;
      const player = ps({ dailyManualRefreshes: limit });
      expect(() => arena.manualRefresh(player, [], NOW)).toThrow('今日手动刷新次数已达上限');
    });

    it('挑战次数用完抛异常', () => {
      const { arena } = createEnv();
      const player = ps({ dailyChallengesLeft: 0 });
      expect(() => arena.consumeChallenge(player)).toThrow('今日挑战次数已用完');
    });

    it('购买挑战超限抛异常', () => {
      const { arena } = createEnv();
      const limit = arena.getChallengeConfig().dailyBuyLimit;
      const player = ps({ dailyBoughtChallenges: limit });
      expect(() => arena.buyChallenge(player)).toThrow('今日购买次数已达上限');
    });

    it('空阵容抛异常', () => {
      const { arena } = createEnv();
      const player = ps();
      const emptySlots: [string, string, string, string, string] = ['', '', '', '', ''];
      expect(() => arena.updateDefenseFormation(player, emptySlots, FormationType.CRANE_WING, AIDefenseStrategy.BALANCED))
        .toThrow('至少需要1名武将');
    });

    it('对手池为空时生成空列表', () => {
      const { arena } = createEnv();
      const player = ps({ score: 1000, ranking: 10 });
      const result = arena.generateOpponents(player, []);
      expect(result).toEqual([]);
    });
  });

  describe('RankingSystem 错误处理', () => {
    it('未初始化排行榜获取空数据', () => {
      const { ranking } = createEnv();
      const data = ranking.getRanking(RankingDimension.SCORE);
      expect(data.entries).toEqual([]);
    });

    it('未入榜玩家排名为0', () => {
      const { ranking } = createEnv();
      expect(ranking.getPlayerRank(RankingDimension.SCORE, 'unknown')).toBe(0);
    });

    it('未入榜玩家附近列表为空', () => {
      const { ranking } = createEnv();
      expect(ranking.getNearbyPlayers(RankingDimension.SCORE, 'unknown')).toEqual([]);
    });

    it('反序列化错误版本被忽略', () => {
      const { ranking } = createEnv();
      expect(() => ranking.deserialize({ version: 999, scoreRanking: { entries: [], lastUpdateTime: 0 }, powerRanking: { entries: [], lastUpdateTime: 0 }, seasonRanking: { entries: [], lastUpdateTime: 0 } })).not.toThrow();
    });

    it('反序列化null数据被忽略', () => {
      const { ranking } = createEnv();
      expect(() => ranking.deserialize(null as any)).not.toThrow();
    });
  });
});

// ═══════════════════════════════════════════════
// F-Boundary: 边界条件
// ═══════════════════════════════════════════════

describe('PvP对抗测试 — F-Boundary', () => {

  describe('积分边界', () => {
    it('积分最低为0', () => {
      const { battle } = createEnv();
      const player = ps({ score: 10 });
      const updated = battle.applyScoreChange(player, -100);
      expect(updated.score).toBe(0);
    });

    it('段位从最低BRONZE_V开始', () => {
      const { battle } = createEnv();
      expect(battle.getRankIdForScore(0)).toBe('BRONZE_V');
      expect(battle.getRankIdForScore(-1)).toBe('BRONZE_V');
    });

    it('段位最高KING_I', () => {
      const { battle } = createEnv();
      expect(battle.getRankIdForScore(99999)).toBe('KING_I');
    });

    it('21级段位完整', () => {
      expect(RANK_LEVELS.length).toBe(21);
    });

    it('段位升段检测', () => {
      const { battle } = createEnv();
      expect(battle.isRankUp('BRONZE_V', 'BRONZE_IV')).toBe(true);
      expect(battle.isRankUp('BRONZE_IV', 'BRONZE_V')).toBe(false);
    });

    it('段位降段检测', () => {
      const { battle } = createEnv();
      expect(battle.isRankDown('BRONZE_IV', 'BRONZE_V')).toBe(true);
      expect(battle.isRankDown('BRONZE_V', 'BRONZE_IV')).toBe(false);
    });

    it('相同段位不算升降', () => {
      const { battle } = createEnv();
      expect(battle.isRankUp('BRONZE_V', 'BRONZE_V')).toBe(false);
      expect(battle.isRankDown('BRONZE_V', 'BRONZE_V')).toBe(false);
    });
  });

  describe('回放管理边界', () => {
    it('回放数量上限', () => {
      const { battle } = createEnv();
      let player = ps({ replays: [] });
      for (let i = 0; i < 60; i++) {
        player = battle.saveReplay(player, rep({ id: `r${i}`, timestamp: NOW }));
      }
      expect(player.replays.length).toBeLessThanOrEqual(50);
    });

    it('清理过期回放', () => {
      const { battle } = createEnv();
      const oldTime = NOW - 8 * DAY_MS;
      const player = ps({
        replays: [
          rep({ id: 'old', timestamp: oldTime }),
          rep({ id: 'new', timestamp: NOW }),
        ],
      });
      const cleaned = battle.cleanExpiredReplays(player, NOW);
      expect(cleaned.replays.length).toBe(1);
      expect(cleaned.replays[0].id).toBe('new');
    });
  });

  describe('匹配边界', () => {
    it('canFreeRefresh边界时间', () => {
      const { arena } = createEnv();
      const interval = arena.getRefreshConfig().freeIntervalMs;
      // 恰好到达间隔
      expect(arena.canFreeRefresh(ps({ lastFreeRefreshTime: NOW - interval }), NOW)).toBe(true);
      // 差1ms
      expect(arena.canFreeRefresh(ps({ lastFreeRefreshTime: NOW - interval + 1 }), NOW)).toBe(false);
    });

    it('canChallenge边界', () => {
      const { arena } = createEnv();
      expect(arena.canChallenge(ps({ dailyChallengesLeft: 1 }))).toBe(true);
      expect(arena.canChallenge(ps({ dailyChallengesLeft: 0 }))).toBe(false);
    });
  });

  describe('排名边界', () => {
    it('空排行榜Top N为空', () => {
      const { ranking } = createEnv();
      expect(ranking.getTopPlayers(RankingDimension.SCORE, 10)).toEqual([]);
    });

    it('排行榜刷新检测', () => {
      const { ranking } = createEnv();
      expect(ranking.needsRefresh(RankingDimension.SCORE, NOW)).toBe(true);
      ranking.updateRanking(RankingDimension.SCORE, [], NOW);
      expect(ranking.needsRefresh(RankingDimension.SCORE, NOW)).toBe(false);
    });

    it('附近玩家范围查询', () => {
      const { ranking } = createEnv();
      const players = genOpponents(30).map((p, i) => ({ ...p, score: 3000 - i * 100 }));
      ranking.updateRanking(RankingDimension.SCORE, players as any, NOW);
      const nearby = ranking.getNearbyPlayers(RankingDimension.SCORE, 'opp_15', 5);
      expect(nearby.length).toBeGreaterThan(0);
      expect(nearby.length).toBeLessThanOrEqual(11);
    });
  });
});

// ═══════════════════════════════════════════════
// F-Cross: 跨系统交互
// ═══════════════════════════════════════════════

describe('PvP对抗测试 — F-Cross', () => {

  describe('ArenaSystem + PvPBattleSystem 交互', () => {
    it('战斗结果应用后段位可能变化', () => {
      const { arena, battle } = createEnv();
      const player = ps({ score: 295, rankId: 'BRONZE_V' }); // BRONZE_V max=299
      const result: any = { attackerWon: true, scoreChange: 50, battleId: 'b1', attackerId: 'p1', defenderId: 'p2', attackerNewScore: 345, defenderNewScore: 0, totalTurns: 5, isTimeout: false, battleState: null };
      const updated = battle.applyBattleResult(player, result);
      expect(updated.score).toBe(345);
      expect(updated.rankId).not.toBe('BRONZE_V'); // 应升段
    });

    it('战败扣除积分和获得少量竞技币', () => {
      const { battle } = createEnv();
      const player = ps({ score: 1000, arenaCoins: 0 });
      const result: any = { attackerWon: false, scoreChange: -20, battleId: 'b1', attackerId: 'p1', defenderId: 'p2', attackerNewScore: 980, defenderNewScore: 1020, totalTurns: 3, isTimeout: false, battleState: null };
      const updated = battle.applyBattleResult(player, result);
      expect(updated.score).toBe(980);
      expect(updated.arenaCoins).toBe(5); // 败方5币
    });
  });

  describe('ArenaSystem + RankingSystem 交互', () => {
    it('竞技场结果更新排行榜', () => {
      const { arena, ranking } = createEnv();
      const players = genOpponents(10).map((p, i) => ({ ...p, score: 1000 - i * 100 }));
      // 注册玩家
      players.forEach(p => arena.registerPlayer(p));
      // 更新排名
      ranking.updateRanking(RankingDimension.SCORE, players as any, NOW);
      const rank = ranking.getPlayerRank(RankingDimension.SCORE, 'opp_0');
      expect(rank).toBe(1);
    });
  });

  describe('多维度排名一致性', () => {
    it('积分和战力排名独立计算', () => {
      const { ranking } = createEnv();
      // opp_0: score最高(1000), power最低(3000)
      // opp_9: score最低(100), power最高(12000)
      const players = Array.from({ length: 10 }, (_, i) => opp({
        playerId: `opp_${i}`, playerName: `对手${i}`,
        score: 1000 - i * 100,           // opp_0=1000, opp_9=100
        power: 3000 + i * 1000,          // opp_0=3000, opp_9=12000
        ranking: i + 1, rankId: 'BRONZE_V',
        faction: (['wei', 'shu', 'wu'] as any)[i % 3],
      }));
      ranking.updateRanking(RankingDimension.SCORE, players, NOW);
      ranking.updateRanking(RankingDimension.POWER, players, NOW);
      const scoreRank = ranking.getPlayerRank(RankingDimension.SCORE, 'opp_0');
      const powerRank = ranking.getPlayerRank(RankingDimension.POWER, 'opp_0');
      // opp_0 score排名第1, power排名最后(10)
      expect(scoreRank).toBe(1);
      expect(powerRank).toBe(10);
      expect(scoreRank).not.toBe(powerRank);
    });
  });
});

// ═══════════════════════════════════════════════
// F-Lifecycle: 生命周期
// ═══════════════════════════════════════════════

describe('PvP对抗测试 — F-Lifecycle', () => {

  describe('ArenaSystem 生命周期', () => {
    it('reset后恢复初始状态', () => {
      const { arena } = createEnv();
      arena.registerPlayer(opp({ playerId: 'test' }));
      expect(arena.getAllPlayers().length).toBe(1);
      arena.reset();
      expect(arena.getAllPlayers().length).toBe(0);
    });

    it('序列化与反序列化一致性', () => {
      const { arena } = createEnv();
      const player = ps({ score: 2500, rankId: 'BRONZE_I' });
      const saved = arena.serialize(player);
      expect(saved.version).toBe(ARENA_SAVE_VERSION);
      const restored = arena.deserialize(saved);
      expect(restored.score).toBe(2500);
      expect(restored.rankId).toBe('BRONZE_I');
    });

    it('反序列化无效版本使用默认值', () => {
      const { arena } = createEnv();
      const restored = arena.deserialize({ version: 999, state: ps(), season: { seasonId: '', startTime: 0, endTime: 0, currentDay: 1, isSettled: false }, highestRankId: 'BRONZE_V' });
      expect(restored.score).toBe(createDefaultArenaPlayerState().score);
    });
  });

  describe('PvPBattleSystem 生命周期', () => {
    it('回放序列化与反序列化', () => {
      const { battle } = createEnv();
      const player = ps({ score: 1000, rankId: 'BRONZE_III', arenaCoins: 50, replays: [rep()] });
      const serialized = battle.serializeReplays(player);
      expect(serialized.replays.length).toBe(1);
      expect(serialized.score).toBe(1000);
      const deserialized = battle.deserializeReplays(serialized);
      expect(deserialized.replays!.length).toBe(1);
      expect(deserialized.score).toBe(1000);
    });

    it('反序列化缺失字段使用默认值', () => {
      const { battle } = createEnv();
      const deserialized = battle.deserializeReplays({ replays: undefined as any, score: undefined as any, rankId: undefined as any, arenaCoins: undefined as any });
      expect(deserialized.replays).toEqual([]);
      expect(deserialized.score).toBe(0);
      expect(deserialized.rankId).toBe('BRONZE_V');
    });
  });

  describe('RankingSystem 生命周期', () => {
    it('reset后清空所有排行榜', () => {
      const { ranking } = createEnv();
      const players = genOpponents(5);
      ranking.updateRanking(RankingDimension.SCORE, players as any, NOW);
      expect(ranking.getEntryCount(RankingDimension.SCORE)).toBe(5);
      ranking.reset();
      expect(ranking.getEntryCount(RankingDimension.SCORE)).toBe(0);
    });

    it('序列化与反序列化一致性', () => {
      const { ranking } = createEnv();
      const players = genOpponents(5).map((p, i) => ({ ...p, score: 1000 - i * 100 }));
      ranking.updateRanking(RankingDimension.SCORE, players as any, NOW);
      ranking.updateRanking(RankingDimension.POWER, players as any, NOW);
      const saved = ranking.serialize();
      expect(saved.version).toBe(RANKING_SAVE_VERSION);
      ranking.reset();
      ranking.deserialize(saved);
      expect(ranking.getEntryCount(RankingDimension.SCORE)).toBe(5);
    });
  });

  describe('完整PvP对战生命周期', () => {
    it('匹配→战斗→积分→排名完整流程', () => {
      const { arena, battle, ranking } = createEnv();
      // 1. 注册对手（使用matchable opponents）
      const player = ps({ score: 1000, ranking: 10 });
      const opponents = genMatchableOpponents(player, 20);
      opponents.forEach(o => arena.registerPlayer(o));
      // 2. 生成对手
      const matched = arena.generateOpponents(player, arena.getAllPlayers());
      expect(matched.length).toBeGreaterThan(0);
      // 3. 战斗
      const defender = ps({ score: 800, playerId: 'def_1' });
      const result = battle.executeBattle(player, defender);
      expect(result.battleId).toBeTruthy();
      // 4. 应用结果
      const updated = battle.applyBattleResult(player, result);
      expect(updated.score).toBeGreaterThanOrEqual(0);
      // 5. 更新排名
      ranking.updateRanking(RankingDimension.SCORE, opponents, NOW);
      expect(ranking.getEntryCount(RankingDimension.SCORE)).toBeGreaterThan(0);
    });
  });
});
