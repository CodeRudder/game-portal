/**
 * 竞技场模块对抗式测试
 *
 * 覆盖子系统：
 *   S1: ArenaSystem（匹配/对手生成/刷新/挑战次数/防守阵容/防守日志/序列化）
 *   S2: PvPBattleSystem（战斗执行/积分计算/段位判定/回放管理）
 *   S3: ArenaSeasonSystem（赛季周期/结算/奖励/每日奖励/最高段位）
 *   S4: RankingSystem（多维度排名/排名查询/序列化）
 *
 * 5维度：F-Normal / F-Error / F-Boundary / F-Cross / F-Lifecycle
 * @module tests/adversarial/arena-adversarial
 */

import { describe, it, expect, vi } from 'vitest';
import { ArenaSystem } from '../../engine/pvp/ArenaSystem';
import { PvPBattleSystem, RANK_LEVELS, RANK_LEVEL_MAP } from '../../engine/pvp/PvPBattleSystem';
import { ArenaSeasonSystem, SEASON_REWARDS, DEFAULT_SEASON_CONFIG } from '../../engine/pvp/ArenaSeasonSystem';
import { RankingSystem, RankingDimension, RANKING_SAVE_VERSION } from '../../engine/pvp/RankingSystem';
import {
  createDefaultArenaPlayerState, createDefaultDefenseFormation, ARENA_SAVE_VERSION,
  DEFAULT_REFRESH_CONFIG, DEFAULT_CHALLENGE_CONFIG, calculatePower, selectByFactionBalance,
} from '../../engine/pvp/ArenaSystem.helpers';
import { FormationType, AIDefenseStrategy, PvPBattleMode } from '../../core/pvp/pvp.types';
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
  const season = new ArenaSeasonSystem(); season.init(deps);
  const ranking = new RankingSystem(); ranking.init(deps);
  return { deps, arena, battle, season, ranking };
};

const NOW = 1700000000000;
const DAY_MS = 86400000;

const rep = (o: Partial<BattleReplay> = {}): BattleReplay => ({
  id: 'r1', battleId: 'b1', attackerName: '攻', defenderName: '守',
  attackerWon: true, timestamp: NOW, totalTurns: 5, actions: [],
  result: { winner: 'attacker' } as any, keyMoments: [3], ...o,
});

// ═══════════════════════════════════════════════
// F-Normal: 正常流程
// ═══════════════════════════════════════════════

describe('竞技场对抗测试 — F-Normal', () => {

  describe('竞技场初始化', () => {
    it('ArenaSystem 初始状态正确', () => {
      const { arena } = createEnv();
      expect(arena.name).toBe('ArenaSystem');
      expect(arena.getState().playerPoolSize).toBe(0);
    });
    it('默认玩家状态字段完整', () => {
      const s = createDefaultArenaPlayerState('p1');
      expect(s).toMatchObject({ playerId: 'p1', score: 0, rankId: 'BRONZE_V', ranking: 0, arenaCoins: 0 });
      expect(s.dailyChallengesLeft).toBe(DEFAULT_CHALLENGE_CONFIG.dailyFreeChallenges);
    });
    it('默认防守阵容为鱼鳞阵+均衡策略', () => {
      expect(createDefaultDefenseFormation()).toMatchObject({ formation: FormationType.FISH_SCALE, strategy: AIDefenseStrategy.BALANCED });
    });
  });

  describe('匹配与对手生成', () => {
    it('注册玩家后可获取', () => {
      const { arena } = createEnv();
      arena.registerPlayer(opp({ playerId: 'a' }));
      arena.registerPlayer(opp({ playerId: 'b' }));
      expect(arena.getAllPlayers()).toHaveLength(2);
    });
    it('generateOpponents 筛选战力和排名范围内的对手', () => {
      const { arena } = createEnv();
      const result = arena.generateOpponents(ps({ score: 500, ranking: 10 }), [
        opp({ playerId: 'in1', power: 8000, ranking: 15, score: 300 }),
        opp({ playerId: 'in2', power: 12000, ranking: 5, score: 600 }),
        opp({ playerId: 'out', power: 20000, ranking: 12, score: 100 }),
      ]);
      expect(result.length).toBeGreaterThan(0);
      expect(result.every(o => o.playerId !== 'out')).toBe(true);
    });
    it('空对手池返回空数组', () => {
      expect(createEnv().arena.generateOpponents(ps({ score: 500 }), [])).toEqual([]);
    });
  });

  describe('刷新机制', () => {
    it('免费刷新：冷却后可刷新', () => {
      const { arena } = createEnv();
      const u = arena.freeRefresh(
        ps({ score: 500, ranking: 10, lastFreeRefreshTime: NOW - DEFAULT_REFRESH_CONFIG.freeIntervalMs - 1 }),
        [opp({ power: 9000, ranking: 12, score: 300 })], NOW,
      );
      expect(u.lastFreeRefreshTime).toBe(NOW);
      expect(u.opponents.length).toBeGreaterThan(0);
    });
    it('手动刷新消耗铜钱并增加计数', () => {
      const { state: u, cost } = createEnv().arena.manualRefresh(ps(), [opp()], NOW);
      expect(cost).toBe(DEFAULT_REFRESH_CONFIG.manualCostCopper);
      expect(u.dailyManualRefreshes).toBe(1);
    });
  });

  describe('挑战次数', () => {
    it('consumeChallenge 减少次数', () => {
      expect(createEnv().arena.consumeChallenge(ps({ dailyChallengesLeft: 5 })).dailyChallengesLeft).toBe(4);
    });
    it('buyChallenge 增加次数并返回元宝消耗', () => {
      const { state: u, cost } = createEnv().arena.buyChallenge(ps({ dailyChallengesLeft: 0 }));
      expect(u).toMatchObject({ dailyChallengesLeft: 1, dailyBoughtChallenges: 1 });
      expect(cost).toBe(DEFAULT_CHALLENGE_CONFIG.buyCostGold);
    });
    it('dailyReset 重置每日数据', () => {
      const u = createEnv().arena.dailyReset(ps({ dailyChallengesLeft: 0, dailyBoughtChallenges: 5, dailyManualRefreshes: 8 }));
      expect(u).toMatchObject({ dailyChallengesLeft: DEFAULT_CHALLENGE_CONFIG.dailyFreeChallenges, dailyBoughtChallenges: 0, dailyManualRefreshes: 0 });
    });
  });

  describe('防守阵容与日志', () => {
    it('更新防守阵容成功', () => {
      const slots: [string, string, string, string, string] = ['h1', 'h2', '', '', ''];
      const u = createEnv().arena.updateDefenseFormation(ps(), slots, FormationType.WEDGE, AIDefenseStrategy.AGGRESSIVE);
      expect(u.defenseFormation).toMatchObject({ slots, formation: FormationType.WEDGE, strategy: AIDefenseStrategy.AGGRESSIVE });
    });
    it('添加防守日志限制50条', () => {
      const { arena } = createEnv();
      let p = ps();
      for (let i = 0; i < 55; i++) p = arena.addDefenseLog(p, { attackerId: `a${i}`, attackerName: `A${i}`, defenderWon: i % 2 === 0, turns: 5, attackerRank: 'BRONZE_V' }, NOW + i);
      expect(p.defenseLogs).toHaveLength(50);
      expect(p.defenseLogs[0].attackerId).toBe('a54');
    });
    it('getDefenseStats 统计正确', () => {
      const { arena } = createEnv();
      let p = ps();
      p = arena.addDefenseLog(p, { attackerId: 'a1', attackerName: 'A', defenderWon: true, turns: 3, attackerRank: 'BRONZE_V' }, NOW);
      p = arena.addDefenseLog(p, { attackerId: 'a2', attackerName: 'B', defenderWon: false, turns: 5, attackerRank: 'SILVER_I' }, NOW);
      expect(arena.getDefenseStats(p)).toMatchObject({ totalDefenses: 2, wins: 1, losses: 1 });
    });
  });

  describe('PvP战斗', () => {
    it('积分计算在范围内', () => {
      const { battle } = createEnv();
      for (let i = 0; i < 50; i++) {
        expect(battle.calculateWinScore()).toBeGreaterThanOrEqual(30);
        expect(battle.calculateWinScore()).toBeLessThanOrEqual(60);
        expect(battle.calculateLoseScore()).toBeLessThanOrEqual(-15);
        expect(battle.calculateLoseScore()).toBeGreaterThanOrEqual(-30);
      }
    });
    it('applyScoreChange 更新积分和段位', () => {
      expect(createEnv().battle.applyScoreChange(ps({ score: 1400 }), 200)).toMatchObject({ score: 1600, rankId: 'SILVER_V' });
    });
    it('段位判定覆盖关键节点', () => {
      const { battle } = createEnv();
      expect(battle.getRankIdForScore(0)).toBe('BRONZE_V');
      expect(battle.getRankIdForScore(1500)).toBe('SILVER_V');
      expect(battle.getRankIdForScore(3000)).toBe('GOLD_V');
      expect(battle.getRankIdForScore(5000)).toBe('DIAMOND_V');
      expect(battle.getRankIdForScore(10000)).toBe('KING_I');
    });
    it('executeBattle 返回完整结果', () => {
      const r = createEnv().battle.executeBattle(ps({ playerId: 'att', score: 1000 }), ps({ playerId: 'def', score: 800 }), PvPBattleMode.AUTO, NOW);
      expect(r).toMatchObject({ attackerId: 'att', defenderId: 'def' });
      expect(r.totalTurns).toBeGreaterThanOrEqual(1);
      expect(r.totalTurns).toBeLessThanOrEqual(10);
    });
    it('applyBattleResult 胜利增加20竞技币', () => {
      expect(createEnv().battle.applyBattleResult(ps({ score: 1000 }), { attackerWon: true, scoreChange: 30 } as any).arenaCoins).toBe(20);
    });
  });

  describe('赛季管理', () => {
    it('创建赛季28天周期', () => {
      const s = createEnv().season.createSeason('s1', NOW);
      expect(s).toMatchObject({ seasonId: 's1', isSettled: false });
      expect(s.endTime - s.startTime).toBe(28 * DAY_MS);
    });
    it('赛季进行中/结束判断', () => {
      const { season } = createEnv();
      const s = season.createSeason('s1', NOW);
      expect(season.isSeasonActive(s, NOW + DAY_MS)).toBe(true);
      expect(season.isSeasonEnded(s, NOW + 29 * DAY_MS)).toBe(true);
    });
    it('赛季结算发放奖励并重置积分', () => {
      const { state: u, reward, resetScore } = createEnv().season.settleSeason(ps({ score: 3000, rankId: 'GOLD_V', arenaCoins: 100 }), 'GOLD_V');
      expect(reward.rankId).toBe('GOLD_V');
      expect(u.arenaCoins).toBe(100 + reward.arenaCoin);
      expect(resetScore).toBe(RANK_LEVEL_MAP.get('GOLD_V')!.minScore);
    });
    it('每日段位奖励发放', () => {
      const { state: u, reward } = createEnv().season.grantDailyReward(ps({ rankId: 'GOLD_V' }));
      expect(reward.copper).toBe(1500);
      expect(u.arenaCoins).toBe(reward.arenaCoin);
    });
  });

  describe('排行榜', () => {
    it('更新排行榜并按值排序', () => {
      const data = createEnv().ranking.updateRanking(RankingDimension.POWER, [
        opp({ playerId: 'p1', power: 3000 }), opp({ playerId: 'p2', power: 8000 }), opp({ playerId: 'p3', power: 5000 }),
      ], NOW);
      expect(data.entries.map(e => e.playerId)).toEqual(['p2', 'p3', 'p1']);
    });
    it('getPlayerRank 返回1-based排名', () => {
      const { ranking } = createEnv();
      ranking.updateRanking(RankingDimension.SCORE, [opp({ playerId: 'a', score: 900 }), opp({ playerId: 'b', score: 500 })], NOW);
      expect(ranking.getPlayerRank(RankingDimension.SCORE, 'a')).toBe(1);
      expect(ranking.getPlayerRank(RankingDimension.SCORE, 'unknown')).toBe(0);
    });
    it('getTopPlayers 返回前N名', () => {
      const { ranking } = createEnv();
      ranking.updateRanking(RankingDimension.SCORE, Array.from({ length: 20 }, (_, i) => opp({ playerId: `p${i}`, score: 1000 - i * 50 })), NOW);
      const top = ranking.getTopPlayers(RankingDimension.SCORE, 3);
      expect(top).toHaveLength(3);
      expect(top[0].value).toBeGreaterThan(top[1].value);
    });
  });
});

// ═══════════════════════════════════════════════
// F-Error: 错误路径
// ═══════════════════════════════════════════════

describe('竞技场对抗测试 — F-Error', () => {

  describe('刷新错误', () => {
    it('免费刷新冷却中抛出异常', () => {
      expect(() => createEnv().arena.freeRefresh(ps({ lastFreeRefreshTime: NOW }), [opp()], NOW)).toThrow('免费刷新冷却中');
    });
    it('手动刷新超限抛出异常', () => {
      expect(() => createEnv().arena.manualRefresh(ps({ dailyManualRefreshes: DEFAULT_REFRESH_CONFIG.dailyManualLimit }), [opp()], NOW)).toThrow('今日手动刷新次数已达上限');
    });
  });

  describe('挑战错误', () => {
    it('次数用完时抛出异常', () => {
      expect(() => createEnv().arena.consumeChallenge(ps({ dailyChallengesLeft: 0 }))).toThrow('今日挑战次数已用完');
    });
    it('购买超限抛出异常', () => {
      expect(() => createEnv().arena.buyChallenge(ps({ dailyBoughtChallenges: DEFAULT_CHALLENGE_CONFIG.dailyBuyLimit }))).toThrow('今日购买次数已达上限');
    });
    it('canChallenge 返回 false 当次数为0', () => {
      expect(new ArenaSystem().canChallenge(ps({ dailyChallengesLeft: 0 }))).toBe(false);
    });
  });

  describe('防守阵容错误', () => {
    it('空阵容抛出异常', () => {
      expect(() => createEnv().arena.updateDefenseFormation(ps(), ['', '', '', '', ''], FormationType.FISH_SCALE, AIDefenseStrategy.BALANCED)).toThrow('至少需要1名武将');
    });
  });

  describe('竞技商店错误', () => {
    it('竞技币不足抛出异常', () => {
      expect(() => createEnv().season.buyArenaShopItem(ps({ arenaCoins: 10 }), 100)).toThrow('竞技币不足');
    });
  });

  describe('段位/排名查询错误', () => {
    it('不存在的段位ID返回 undefined', () => {
      expect(createEnv().battle.getRankLevel('NONEXISTENT')).toBeUndefined();
    });
    it('不存在的段位赛季奖励回退到第一个', () => {
      expect(createEnv().season.getSeasonReward('NONEXISTENT')).toBe(SEASON_REWARDS[0]);
    });
    it('未更新的排行榜返回空数据', () => {
      expect(createEnv().ranking.getRanking(RankingDimension.SCORE).entries).toEqual([]);
    });
    it('getNearbyPlayers 未入榜返回空', () => {
      const { ranking } = createEnv();
      ranking.updateRanking(RankingDimension.SCORE, [opp({ playerId: 'p1' })], NOW);
      expect(ranking.getNearbyPlayers(RankingDimension.SCORE, 'nobody', 5)).toEqual([]);
    });
  });
});

// ═══════════════════════════════════════════════
// F-Boundary: 边界条件
// ═══════════════════════════════════════════════

describe('竞技场对抗测试 — F-Boundary', () => {

  describe('NaN 与无效排名', () => {
    it('NaN 排名时 generateOpponents 使用 9999 默认值', () => {
      const { arena } = createEnv();
      const pool = Array.from({ length: 30 }, (_, i) => opp({ playerId: `p${i}`, power: 9000, ranking: 9990 + i, score: 100 }));
      expect(Array.isArray(arena.generateOpponents(ps({ score: 500, ranking: NaN }), pool))).toBe(true);
    });
    it('NaN 积分的战力计算返回安全默认值（已修复：NaN→0）', () => {
      expect(calculatePower(ps({ score: NaN }))).toBe(5000); // 0*10 + 0*1000 + 5000
    });
    it('负积分段位为 BRONZE_V', () => {
      expect(createEnv().battle.getRankIdForScore(-100)).toBe('BRONZE_V');
    });
  });

  describe('空对手与边界值', () => {
    it('对手池全部不满足条件返回空', () => {
      expect(createEnv().arena.generateOpponents(ps({ score: 50000, ranking: 1 }), [opp({ power: 100, ranking: 9999 })])).toEqual([]);
    });
    it('恰好满足战力边界的对手被包含', () => {
      const ids = createEnv().arena.generateOpponents(ps({ score: 500, ranking: 10 }), [
        opp({ playerId: 'min', power: 7000, ranking: 10 }),
        opp({ playerId: 'max', power: 13000, ranking: 10 }),
      ]).map(o => o.playerId);
      expect(ids).toContain('min');
      expect(ids).toContain('max');
    });
    it('积分0减分不会变负', () => {
      expect(createEnv().battle.applyScoreChange(ps({ score: 0 }), -50).score).toBe(0);
    });
  });

  describe('边界数值', () => {
    it('积分极高段位为 KING_I', () => {
      expect(new PvPBattleSystem().getRankIdForScore(99999)).toBe('KING_I');
    });
    it('21级段位完整', () => { expect(RANK_LEVELS).toHaveLength(21); });
    it('赛季奖励覆盖21个段位', () => { expect(SEASON_REWARDS).toHaveLength(21); });
    it('排行榜 maxDisplayCount 限制生效', () => {
      const r = new RankingSystem({ maxDisplayCount: 5 }); r.init(mockDeps());
      expect(r.updateRanking(RankingDimension.SCORE, Array.from({ length: 20 }, (_, i) => opp({ playerId: `p${i}`, score: 1000 - i })), NOW).entries).toHaveLength(5);
    });
  });

  describe('防守日志边界', () => {
    it('0条日志时统计全为0', () => {
      expect(createEnv().arena.getDefenseStats(ps())).toMatchObject({ totalDefenses: 0, wins: 0, losses: 0, winRate: 0, suggestedStrategy: null });
    });
    it('低胜率建议防守策略（≥5场）', () => {
      const { arena } = createEnv();
      let p = ps();
      for (let i = 0; i < 6; i++) p = arena.addDefenseLog(p, { attackerId: `a${i}`, attackerName: `A${i}`, defenderWon: i === 0, turns: 3, attackerRank: 'BRONZE_V' }, NOW + i);
      expect(arena.getDefenseStats(p).suggestedStrategy).toBe(AIDefenseStrategy.DEFENSIVE);
    });
    it('中等胜率建议均衡策略', () => {
      const { arena } = createEnv();
      let p = ps();
      for (let i = 0; i < 5; i++) p = arena.addDefenseLog(p, { attackerId: `a${i}`, attackerName: `A${i}`, defenderWon: i < 2, turns: 3, attackerRank: 'BRONZE_V' }, NOW + i);
      expect(arena.getDefenseStats(p).suggestedStrategy).toBe(AIDefenseStrategy.BALANCED);
    });
  });

  describe('selectByFactionBalance 边界', () => {
    it('候选不足时全部返回', () => { expect(selectByFactionBalance([opp()], 5)).toHaveLength(1); });
    it('空候选返回空', () => { expect(selectByFactionBalance([], 3)).toEqual([]); });
    it('单阵营正常选取', () => {
      expect(selectByFactionBalance(Array.from({ length: 5 }, (_, i) => opp({ playerId: `p${i}`, faction: 'wei' as any })), 3)).toHaveLength(3);
    });
  });
});

// ═══════════════════════════════════════════════
// F-Cross: 跨系统联动
// ═══════════════════════════════════════════════

describe('竞技场对抗测试 — F-Cross', () => {

  describe('完整竞技流程', () => {
    it('匹配→挑战→战斗→积分→排名', () => {
      const { arena, battle, ranking } = createEnv();
      const pool = Array.from({ length: 30 }, (_, i) => opp({
        playerId: `p${i}`, power: 7000 + i * 200,
        ranking: 5 + i, score: i * 100, rankId: i < 10 ? 'BRONZE_V' : 'SILVER_V',
        faction: (['wei', 'shu', 'wu'] as any[])[i % 3],
      }));
      let p = ps({ score: 500, ranking: 10 });
      const opponents = arena.generateOpponents(p, pool);
      expect(opponents.length).toBeGreaterThan(0);
      p = arena.consumeChallenge(p);
      expect(p.dailyChallengesLeft).toBe(4);
      const result = battle.executeBattle(p, ps({ playerId: opponents[0].playerId, score: opponents[0].score }), PvPBattleMode.AUTO, NOW);
      p = battle.applyBattleResult(p, result);
      expect(p.score).not.toBe(500);
      ranking.updateRanking(RankingDimension.SCORE, pool, NOW);
      expect(ranking.getEntryCount(RankingDimension.SCORE)).toBeGreaterThan(0);
    });
  });

  describe('赛季结算联动', () => {
    it('战斗→升段→更新最高段位→赛季结算', () => {
      const { battle, season } = createEnv();
      let p = ps({ score: 0, rankId: 'BRONZE_V' });
      let highest = 'BRONZE_V';
      for (let i = 0; i < 10; i++) {
        p = battle.applyScoreChange(p, 300);
        highest = season.updateHighestRank(highest, p.rankId);
      }
      expect(p).toMatchObject({ score: 3000, rankId: 'GOLD_V' });
      const { state: settled, reward } = season.settleSeason(p, highest);
      expect(reward.rankId).toBe('GOLD_V');
      expect(settled.score).toBe(RANK_LEVEL_MAP.get('GOLD_V')!.minScore);
    });
  });

  describe('竞技商店与赛季联动', () => {
    it('赛季奖励增加竞技币→可购买商店物品', () => {
      const { season } = createEnv();
      const { state: settled } = season.settleSeason(ps({ score: 5000, rankId: 'DIAMOND_V', arenaCoins: 0 }), 'DIAMOND_V');
      expect(settled.arenaCoins).toBeGreaterThan(0);
      expect(season.buyArenaShopItem(settled, 100).arenaCoins).toBe(settled.arenaCoins - 100);
    });
  });

  describe('防守阵容+日志+策略建议联动', () => {
    it('更新阵容→记录日志→获取策略建议', () => {
      const { arena } = createEnv();
      let p = arena.updateDefenseFormation(ps(), ['h1', 'h2', 'h3', '', ''], FormationType.GOOSE, AIDefenseStrategy.DEFENSIVE);
      for (let i = 0; i < 6; i++) p = arena.addDefenseLog(p, { attackerId: `a${i}`, attackerName: `A${i}`, defenderWon: false, turns: 3, attackerRank: 'SILVER_I' }, NOW + i);
      expect(arena.getDefenseStats(p).suggestedStrategy).toBe(AIDefenseStrategy.DEFENSIVE);
    });
  });

  describe('排行榜多维度联动', () => {
    it('同时维护积分/战力/赛季三维度排名', () => {
      const { ranking } = createEnv();
      const players = [opp({ playerId: 'p1', power: 9000, score: 2000 }), opp({ playerId: 'p2', power: 7000, score: 3000 }), opp({ playerId: 'p3', power: 8000, score: 1000 })];
      ranking.updateRanking(RankingDimension.POWER, players, NOW);
      ranking.updateRanking(RankingDimension.SCORE, players, NOW);
      expect(ranking.getPlayerRank(RankingDimension.POWER, 'p1')).toBe(1);
      expect(ranking.getPlayerRank(RankingDimension.SCORE, 'p2')).toBe(1);
    });
    it('needsRefresh 判断正确', () => {
      const { ranking } = createEnv();
      expect(ranking.needsRefresh(RankingDimension.SCORE, NOW)).toBe(true);
      ranking.updateRanking(RankingDimension.SCORE, [opp()], NOW);
      expect(ranking.needsRefresh(RankingDimension.SCORE, NOW)).toBe(false);
      expect(ranking.needsRefresh(RankingDimension.SCORE, NOW + 6 * 60 * 1000)).toBe(true);
    });
  });

  describe('战斗回放管理', () => {
    it('保存回放→清理过期回放', () => {
      const { battle } = createEnv();
      let p = battle.saveReplay(ps(), rep({ id: 'old', timestamp: NOW - 8 * DAY_MS }));
      p = battle.saveReplay(p, rep({ id: 'new', timestamp: NOW }));
      expect(p.replays).toHaveLength(2);
      expect(battle.cleanExpiredReplays(p, NOW).replays).toHaveLength(1);
    });
    it('回放上限50条', () => {
      const { battle } = createEnv();
      let p = ps();
      for (let i = 0; i < 55; i++) p = battle.saveReplay(p, rep({ id: `r${i}`, timestamp: NOW + i }));
      expect(p.replays).toHaveLength(50);
    });
  });
});

// ═══════════════════════════════════════════════
// F-Lifecycle: 生命周期 / 序列化
// ═══════════════════════════════════════════════

describe('竞技场对抗测试 — F-Lifecycle', () => {

  describe('系统重置', () => {
    it('ArenaSystem.reset 清空玩家池', () => {
      const { arena } = createEnv();
      arena.registerPlayer(opp()); arena.reset();
      expect(arena.getAllPlayers()).toHaveLength(0);
    });
    it('RankingSystem.reset 清空所有维度', () => {
      const { ranking } = createEnv();
      ranking.updateRanking(RankingDimension.SCORE, [opp()], NOW); ranking.reset();
      expect(ranking.getEntryCount(RankingDimension.SCORE)).toBe(0);
    });
  });

  describe('ArenaSystem 序列化', () => {
    it('serialize 返回完整存档结构', () => {
      const d = createEnv().arena.serialize(
        ps({ score: 1500, rankId: 'SILVER_V' }),
        { seasonId: 's1', startTime: NOW, endTime: NOW + 28 * DAY_MS, currentDay: 1, isSettled: false },
        'SILVER_V',
      );
      expect(d).toMatchObject({ version: ARENA_SAVE_VERSION, highestRankId: 'SILVER_V' });
      expect(d.state.score).toBe(1500);
    });
    it('serialize 无参数使用内部状态', () => {
      expect(createEnv().arena.serialize().version).toBe(ARENA_SAVE_VERSION);
    });
    it('serialize 处理不完整 season 对象', () => {
      expect(createEnv().arena.serialize(ps(), { seasonId: 's1' } as any).season).toMatchObject({ seasonId: 's1', startTime: 0 });
    });
    it('deserialize 版本匹配恢复状态', () => {
      const u = createEnv().arena.deserialize(createEnv().arena.serialize(ps({ score: 3000, rankId: 'GOLD_V', arenaCoins: 500 })));
      expect(u).toMatchObject({ score: 3000, rankId: 'GOLD_V', arenaCoins: 500 });
    });
    it('deserialize 版本不匹配返回默认状态', () => {
      expect(createEnv().arena.deserialize({ version: 999, state: {} as any, season: {} as any, highestRankId: '' })).toMatchObject({ score: 0, rankId: 'BRONZE_V' });
    });
    it('deserialize null 返回默认状态', () => {
      expect(createEnv().arena.deserialize(null as any).score).toBe(0);
    });
    it('序列化→反序列化 往返一致', () => {
      const { arena } = createEnv();
      const orig = ps({ score: 2500, rankId: 'SILVER_III', ranking: 15, arenaCoins: 200,
        defenseFormation: { slots: ['h1', 'h2', '', '', ''], formation: FormationType.WEDGE, strategy: AIDefenseStrategy.AGGRESSIVE } });
      const restored = arena.deserialize(arena.serialize(orig));
      expect(restored).toMatchObject({ score: 2500, rankId: 'SILVER_III', arenaCoins: 200 });
      expect(restored.defenseFormation.formation).toBe(FormationType.WEDGE);
    });
  });

  describe('RankingSystem 序列化', () => {
    it('serialize 包含三维度数据', () => {
      const { ranking } = createEnv();
      ranking.updateRanking(RankingDimension.SCORE, [opp()], NOW);
      expect(ranking.serialize()).toMatchObject({ version: RANKING_SAVE_VERSION });
      expect(ranking.serialize().scoreRanking.entries).toHaveLength(1);
    });
    it('deserialize 恢复排行榜', () => {
      const { ranking } = createEnv();
      ranking.updateRanking(RankingDimension.SCORE, [opp({ playerId: 'p1', score: 1000 }), opp({ playerId: 'p2', score: 500 })], NOW);
      const r2 = new RankingSystem(); r2.init(mockDeps());
      r2.deserialize(ranking.serialize());
      expect(r2.getPlayerRank(RankingDimension.SCORE, 'p1')).toBe(1);
    });
    it('deserialize 版本不匹配不恢复', () => {
      expect(() => new RankingSystem().deserialize({ version: 999 } as any)).not.toThrow();
    });
    it('deserialize 无效数据不崩溃', () => {
      const { ranking } = createEnv();
      expect(() => ranking.deserialize(null as any)).not.toThrow();
      expect(() => ranking.deserialize({} as any)).not.toThrow();
    });
  });

  describe('ArenaSeasonSystem 序列化', () => {
    it('serializeSeason → deserializeSeason 往返一致', () => {
      const { season: restored, highestRankId } = createEnv().season.deserializeSeason(
        createEnv().season.serializeSeason(createEnv().season.createSeason('s1', NOW), 'GOLD_V'),
      );
      expect(restored.seasonId).toBe('s1');
      expect(highestRankId).toBe('GOLD_V');
    });
    it('deserializeSeason 处理空数据', () => {
      const { season: r, highestRankId } = createEnv().season.deserializeSeason({} as any);
      expect(r.seasonId).toBe('');
      expect(highestRankId).toBe('BRONZE_V');
    });
  });

  describe('PvPBattleSystem 序列化', () => {
    it('serializeReplays → deserializeReplays 往返一致', () => {
      const { battle } = createEnv();
      const restored = battle.deserializeReplays(battle.serializeReplays(ps({ score: 2000, rankId: 'SILVER_III', arenaCoins: 100, replays: [rep()] })));
      expect(restored).toMatchObject({ score: 2000, rankId: 'SILVER_III' });
      expect(restored.replays).toHaveLength(1);
    });
    it('deserializeReplays 处理空数据', () => {
      expect(new PvPBattleSystem().deserializeReplays({} as any)).toMatchObject({ replays: [], score: 0, rankId: 'BRONZE_V' });
    });
  });

  describe('段位升降与赛季周期', () => {
    it('isRankUp / isRankDown 正确判断', () => {
      const { battle } = createEnv();
      expect(battle.isRankUp('BRONZE_V', 'BRONZE_IV')).toBe(true);
      expect(battle.isRankUp('GOLD_V', 'BRONZE_I')).toBe(false);
      expect(battle.isRankDown('GOLD_V', 'SILVER_I')).toBe(true);
    });
    it('updateHighestRank 只升不降', () => {
      const { season } = createEnv();
      expect(season.updateHighestRank('GOLD_V', 'SILVER_I')).toBe('GOLD_V');
      expect(season.updateHighestRank('GOLD_V', 'GOLD_I')).toBe('GOLD_I');
    });
    it('赛季天数边界', () => {
      const { season } = createEnv();
      const s = season.createSeason('s1', NOW);
      expect(season.getCurrentDay(s, NOW)).toBe(1);
      expect(season.getCurrentDay(s, NOW + 27 * DAY_MS)).toBe(28);
      expect(season.getCurrentDay(s, NOW + 30 * DAY_MS)).toBe(DEFAULT_SEASON_CONFIG.seasonDays);
      expect(season.getRemainingDays(s, NOW)).toBe(28);
      expect(season.getRemainingDays(s, NOW + 28 * DAY_MS)).toBe(0);
    });
  });
});
