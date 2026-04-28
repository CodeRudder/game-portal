/**
 * FLOW-13 竞技场集成测试 — 竞技场面板数据/对手列表/挑战流程/排名变化/奖励系统/苏格拉底边界
 *
 * 使用真实 ThreeKingdomsEngine（通过 createSim()），不 mock engine。
 * 仅 mock CSS 等外部依赖。
 *
 * 覆盖范围：
 * - 竞技场面板数据：段位/积分/排名/竞技币/配置
 * - 对手列表：匹配/候选/注册/阵营覆盖
 * - 挑战流程：消耗次数/购买次数/用完拒绝
 * - 排名变化：积分变化/段位升降/每日重置
 * - 奖励系统：赛季奖励/每日奖励/商店购买
 * - 苏格拉底边界：极端值/空状态/溢出/序列化
 *
 * @module tests/acc/FLOW-13
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { accTest, assertStrict } from './acc-test-utils';
import { createSim } from '../../test-utils/test-helpers';
import type { GameEventSimulator } from '../../test-utils/GameEventSimulator';
import type { ThreeKingdomsEngine } from '@/games/three-kingdoms/engine/ThreeKingdomsEngine';
import type {
  ArenaOpponent,
  ArenaPlayerState,
} from '@/games/three-kingdoms/core/pvp/pvp.types';
import { FormationType, AIDefenseStrategy } from '@/games/three-kingdoms/core/pvp/pvp.types';
import {
  DEFAULT_MATCH_CONFIG,
  DEFAULT_REFRESH_CONFIG,
  DEFAULT_CHALLENGE_CONFIG,
  ARENA_SAVE_VERSION,
  createDefaultArenaPlayerState,
  createDefaultDefenseFormation,
} from '@/games/three-kingdoms/engine/pvp/ArenaConfig';
import { ArenaSeasonSystem, SEASON_REWARDS, DEFAULT_SEASON_CONFIG } from '@/games/three-kingdoms/engine/pvp/ArenaSeasonSystem';
import { ArenaShopSystem, DEFAULT_ARENA_SHOP_ITEMS } from '@/games/three-kingdoms/engine/pvp/ArenaShopSystem';

// ═══════════════════════════════════════════════════════════════
// 辅助函数
// ═══════════════════════════════════════════════════════════════

function createArenaSim(): GameEventSimulator {
  const sim = createSim();
  sim.addResources({ gold: 100000, grain: 100000 });
  return sim;
}

function makeOpponent(overrides: Partial<ArenaOpponent> = {}): ArenaOpponent {
  return {
    playerId: 'player_1',
    playerName: '测试对手1',
    power: 10000,
    rankId: 'BRONZE_III',
    score: 500,
    ranking: 10,
    faction: 'shu' as const,
    defenseSnapshot: null,
    ...overrides,
  };
}

function makeOpponents(count: number, baseRanking = 10, basePower = 10000): ArenaOpponent[] {
  return Array.from({ length: count }, (_, i) => makeOpponent({
    playerId: `player_${i + 1}`,
    playerName: `测试对手${i + 1}`,
    power: basePower + i * 500,
    ranking: baseRanking + i,
    score: 500 + i * 50,
    faction: (['shu', 'wei', 'wu', 'qun'] as const)[i % 4],
  }));
}

function makePlayerState(overrides: Partial<ArenaPlayerState> = {}): ArenaPlayerState {
  return {
    ...createDefaultArenaPlayerState('test_player'),
    ranking: 15,
    score: 600,
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════
// FLOW-13 竞技场集成测试
// ═══════════════════════════════════════════════════════════════

describe('FLOW-13 竞技场集成测试', () => {
  let sim: GameEventSimulator;
  let engine: ThreeKingdomsEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    sim = createArenaSim();
    engine = sim.engine;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── 1. 竞技场面板数据（FLOW-13-01 ~ FLOW-13-05） ──

  it(accTest('FLOW-13-01', '面板数据 — 默认段位BRONZE_V，积分0，排名0'), () => {
    const arena = engine.getArenaSystem();
    assertStrict(arena.name === 'ArenaSystem', 'FLOW-13-01', '子系统名应为 ArenaSystem');

    const state = createDefaultArenaPlayerState('test');
    assertStrict(state.rankId === 'BRONZE_V', 'FLOW-13-01', '初始段位应为 BRONZE_V');
    assertStrict(state.score === 0, 'FLOW-13-01', '初始积分应为0');
    assertStrict(state.ranking === 0, 'FLOW-13-01', '初始排名应为0（未入榜）');
    assertStrict(state.arenaCoins === 0, 'FLOW-13-01', '初始竞技币应为0');
  });

  it(accTest('FLOW-13-02', '面板数据 — 匹配配置正确（战力0.7~1.3，排名±5~20，候选3人）'), () => {
    const arena = engine.getArenaSystem();
    const mc = arena.getMatchConfig();
    assertStrict(mc.powerMinRatio === 0.7, 'FLOW-13-02', `战力最低倍率应为0.7，实际 ${mc.powerMinRatio}`);
    assertStrict(mc.powerMaxRatio === 1.3, 'FLOW-13-02', `战力最高倍率应为1.3，实际 ${mc.powerMaxRatio}`);
    assertStrict(mc.rankMinOffset === 5, 'FLOW-13-02', '排名最小偏移应为5');
    assertStrict(mc.rankMaxOffset === 20, 'FLOW-13-02', '排名最大偏移应为20');
    assertStrict(mc.candidateCount === 3, 'FLOW-13-02', `候选对手数应为3，实际 ${mc.candidateCount}`);
  });

  it(accTest('FLOW-13-03', '面板数据 — 刷新配置（30分钟冷却，500铜钱手动，每日10次）'), () => {
    const arena = engine.getArenaSystem();
    const rc = arena.getRefreshConfig();
    assertStrict(rc.freeIntervalMs === 30 * 60 * 1000, 'FLOW-13-03', '免费刷新间隔应为30分钟');
    assertStrict(rc.manualCostCopper === 500, 'FLOW-13-03', '手动刷新消耗应为500铜钱');
    assertStrict(rc.dailyManualLimit === 10, 'FLOW-13-03', '每日手动刷新上限应为10');
  });

  it(accTest('FLOW-13-04', '面板数据 — 挑战配置（5次免费，50元宝购买，每日5次购买）'), () => {
    const arena = engine.getArenaSystem();
    const cc = arena.getChallengeConfig();
    assertStrict(cc.dailyFreeChallenges === 5, 'FLOW-13-04', '每日免费挑战应为5');
    assertStrict(cc.buyCostGold === 50, 'FLOW-13-04', '购买单价应为50元宝');
    assertStrict(cc.dailyBuyLimit === 5, 'FLOW-13-04', '每日购买上限应为5');
  });

  it(accTest('FLOW-13-05', '面板数据 — 默认防守阵容为空（鱼鳞阵+均衡策略）'), () => {
    const df = createDefaultDefenseFormation();
    assertStrict(df.slots.every(s => s === ''), 'FLOW-13-05', '默认阵容应为空');
    assertStrict(df.slots.length === 5, 'FLOW-13-05', '应有5个阵位');
    assertStrict(df.formation === FormationType.FISH_SCALE, 'FLOW-13-05', '默认阵型应为鱼鳞阵');
    assertStrict(df.strategy === AIDefenseStrategy.BALANCED, 'FLOW-13-05', '默认策略应为均衡');
  });

  // ── 2. 对手列表（FLOW-13-06 ~ FLOW-13-10） ──

  it(accTest('FLOW-13-06', '对手列表 — 生成候选对手基于战力和排名范围'), () => {
    const arena = engine.getArenaSystem();
    const ps = makePlayerState({ ranking: 15, score: 600 });
    const opponents = makeOpponents(10, 10, 8000);
    for (const opp of opponents) arena.registerPlayer(opp);

    const candidates = arena.generateOpponents(ps, opponents);
    assertStrict(candidates.length > 0, 'FLOW-13-06', '应有候选对手');
    assertStrict(candidates.length <= DEFAULT_MATCH_CONFIG.candidateCount, 'FLOW-13-06', `候选数不应超过 ${DEFAULT_MATCH_CONFIG.candidateCount}`);
  });

  it(accTest('FLOW-13-07', '对手列表 — 空对手列表返回空'), () => {
    const arena = engine.getArenaSystem();
    const ps = makePlayerState();
    const candidates = arena.generateOpponents(ps, []);
    assertStrict(candidates.length === 0, 'FLOW-13-07', '空对手列表应返回空');
  });

  it(accTest('FLOW-13-08', '对手列表 — 注册对手到玩家池'), () => {
    const arena = engine.getArenaSystem();
    arena.registerPlayer(makeOpponent({ playerId: 'p1' }));
    arena.registerPlayer(makeOpponent({ playerId: 'p2' }));
    assertStrict(arena.getAllPlayers().length === 2, 'FLOW-13-08', '应注册2人');

    // 重复注册覆盖
    arena.registerPlayer(makeOpponent({ playerId: 'p1', power: 9999 }));
    const dup = arena.getAllPlayers().find(p => p.playerId === 'p1');
    assertStrict(dup!.power === 9999, 'FLOW-13-08', '重复注册应覆盖');
  });

  it(accTest('FLOW-13-09', '对手列表 — 多阵营覆盖保证多样性'), () => {
    const arena = engine.getArenaSystem();
    const opponents = makeOpponents(8);
    for (const opp of opponents) arena.registerPlayer(opp);

    const allPlayers = arena.getAllPlayers();
    const factions = new Set(allPlayers.map(p => p.faction));
    assertStrict(factions.size >= 2, 'FLOW-13-09', `应覆盖至少2个阵营，实际 ${factions.size}`);
  });

  it(accTest('FLOW-13-10', '对手列表 — 免费刷新和手动刷新对手'), () => {
    const arena = engine.getArenaSystem();
    const opponents = makeOpponents(10);
    const now = Date.now();

    // 免费刷新
    const ps = makePlayerState({ lastFreeRefreshTime: 0 });
    assertStrict(arena.canFreeRefresh(ps, now), 'FLOW-13-10', '冷却结束应可免费刷新');
    const refreshed = arena.freeRefresh(ps, opponents, now);
    assertStrict(refreshed.opponents.length > 0, 'FLOW-13-10', '刷新后应有对手');

    // 冷却中
    assertStrict(!arena.canFreeRefresh(refreshed, now), 'FLOW-13-10', '冷却中不可刷新');
    expect(() => arena.freeRefresh(refreshed, [], now)).toThrow('免费刷新冷却中');

    // 手动刷新
    const ps2 = makePlayerState();
    const manual = arena.manualRefresh(ps2, opponents, now);
    assertStrict(manual.state.opponents.length > 0, 'FLOW-13-10', '手动刷新后应有对手');
    assertStrict(manual.cost === 500, 'FLOW-13-10', '手动刷新消耗500铜钱');
  });

  // ── 3. 挑战流程（FLOW-13-11 ~ FLOW-13-15） ──

  it(accTest('FLOW-13-11', '挑战流程 — 初始5次免费挑战'), () => {
    const arena = engine.getArenaSystem();
    const ps = makePlayerState();
    assertStrict(arena.canChallenge(ps), 'FLOW-13-11', '初始应有挑战次数');
    assertStrict(ps.dailyChallengesLeft === 5, 'FLOW-13-11', '初始次数应为5');
  });

  it(accTest('FLOW-13-12', '挑战流程 — 消耗挑战次数递减'), () => {
    const arena = engine.getArenaSystem();
    let ps = makePlayerState();

    ps = arena.consumeChallenge(ps);
    assertStrict(ps.dailyChallengesLeft === 4, 'FLOW-13-12', '消耗后应剩4次');

    for (let i = 0; i < 4; i++) ps = arena.consumeChallenge(ps);
    assertStrict(ps.dailyChallengesLeft === 0, 'FLOW-13-12', '5次后应剩0');
    assertStrict(!arena.canChallenge(ps), 'FLOW-13-12', '用完后不可挑战');
  });

  it(accTest('FLOW-13-13', '挑战流程 — 次数用完抛出错误'), () => {
    const arena = engine.getArenaSystem();
    const ps = makePlayerState({ dailyChallengesLeft: 0 });
    expect(() => arena.consumeChallenge(ps)).toThrow('今日挑战次数已用完');
  });

  it(accTest('FLOW-13-14', '挑战流程 — 购买额外挑战次数'), () => {
    const arena = engine.getArenaSystem();
    const ps = makePlayerState({ dailyChallengesLeft: 0 });

    const result = arena.buyChallenge(ps);
    assertStrict(result.state.dailyChallengesLeft === 1, 'FLOW-13-14', '购买后应有1次');
    assertStrict(result.state.dailyBoughtChallenges === 1, 'FLOW-13-14', '已购买次数应为1');
    assertStrict(result.cost === 50, 'FLOW-13-14', '花费应为50元宝');
  });

  it(accTest('FLOW-13-15', '挑战流程 — 购买次数达到上限后拒绝'), () => {
    const arena = engine.getArenaSystem();
    const ps = makePlayerState({ dailyChallengesLeft: 0, dailyBoughtChallenges: 5 });
    expect(() => arena.buyChallenge(ps)).toThrow('今日购买次数已达上限');
  });

  // ── 4. 排名变化（FLOW-13-16 ~ FLOW-13-20） ──

  it(accTest('FLOW-13-16', '排名变化 — 更新防守阵容'), () => {
    const arena = engine.getArenaSystem();
    const ps = makePlayerState();
    const updated = arena.updateDefenseFormation(
      ps,
      ['guanyu', 'zhangfei', 'zhaoyun', '', ''],
      FormationType.WEDGE,
      AIDefenseStrategy.AGGRESSIVE,
    );
    assertStrict(updated.defenseFormation.slots[0] === 'guanyu', 'FLOW-13-16', '第一位应为关羽');
    assertStrict(updated.defenseFormation.formation === FormationType.WEDGE, 'FLOW-13-16', '阵型应为锋矢阵');
    assertStrict(updated.defenseFormation.strategy === AIDefenseStrategy.AGGRESSIVE, 'FLOW-13-16', '策略应为猛攻');
  });

  it(accTest('FLOW-13-17', '排名变化 — 防守日志添加与统计'), () => {
    const arena = engine.getArenaSystem();
    let ps = makePlayerState();
    const now = Date.now();

    // 添加3胜2负
    for (let i = 0; i < 3; i++) {
      ps = arena.addDefenseLog(ps, {
        attackerId: `att_${i}`, attackerName: `攻击者${i}`,
        defenderWon: true, turns: 5, attackerRank: 'BRONZE_III',
      }, now + i * 1000);
    }
    for (let i = 0; i < 2; i++) {
      ps = arena.addDefenseLog(ps, {
        attackerId: `att_l${i}`, attackerName: `攻击者L${i}`,
        defenderWon: false, turns: 3, attackerRank: 'BRONZE_II',
      }, now + (i + 3) * 1000);
    }

    const stats = arena.getDefenseStats(ps);
    assertStrict(stats.totalDefenses === 5, 'FLOW-13-17', '总防守应为5');
    assertStrict(stats.wins === 3, 'FLOW-13-17', '胜利应为3');
    assertStrict(stats.losses === 2, 'FLOW-13-17', '失败应为2');
    assertStrict(Math.abs(stats.winRate - 0.6) < 0.01, 'FLOW-13-17', `胜率应为0.6，实际 ${stats.winRate}`);
  });

  it(accTest('FLOW-13-18', '排名变化 — 胜率低时建议策略'), () => {
    const arena = engine.getArenaSystem();
    let ps = makePlayerState();
    const now = Date.now();

    // 添加6负（胜率=0）
    for (let i = 0; i < 6; i++) {
      ps = arena.addDefenseLog(ps, {
        attackerId: `att_${i}`, attackerName: `攻击者${i}`,
        defenderWon: false, turns: 3, attackerRank: 'BRONZE_III',
      }, now + i * 1000);
    }

    const stats = arena.getDefenseStats(ps);
    assertStrict(stats.suggestedStrategy === AIDefenseStrategy.DEFENSIVE, 'FLOW-13-18', '应建议坚守策略');
  });

  it(accTest('FLOW-13-19', '排名变化 — 每日重置恢复次数不影响积分'), () => {
    const arena = engine.getArenaSystem();
    const ps = makePlayerState({ score: 1200, ranking: 5, rankId: 'SILVER_II', dailyChallengesLeft: 0, dailyBoughtChallenges: 3 });

    const reset = arena.dailyReset(ps);
    assertStrict(reset.dailyChallengesLeft === 5, 'FLOW-13-19', '重置后挑战次数应为5');
    assertStrict(reset.dailyBoughtChallenges === 0, 'FLOW-13-19', '重置后购买次数应为0');
    assertStrict(reset.score === 1200, 'FLOW-13-19', '积分应保持不变');
    assertStrict(reset.ranking === 5, 'FLOW-13-19', '排名应保持不变');
    assertStrict(reset.opponents.length === 0, 'FLOW-13-19', '对手列表应清空');
  });

  it(accTest('FLOW-13-20', '排名变化 — 防守日志最多50条且按时间倒序'), () => {
    const arena = engine.getArenaSystem();
    let ps = makePlayerState();
    const now = Date.now();

    for (let i = 0; i < 60; i++) {
      ps = arena.addDefenseLog(ps, {
        attackerId: `att_${i}`, attackerName: `攻击者${i}`,
        defenderWon: i % 2 === 0, turns: 5, attackerRank: 'BRONZE_III',
      }, now + i * 1000);
    }

    assertStrict(ps.defenseLogs.length <= 50, 'FLOW-13-20', '日志数不应超过50');
    assertStrict(ps.defenseLogs[0].attackerId === 'att_59', 'FLOW-13-20', '最新日志应在最前');
  });

  // ── 5. 奖励系统（FLOW-13-21 ~ FLOW-13-25） ──

  it(accTest('FLOW-13-21', '奖励系统 — 赛季结算按段位发放奖励'), () => {
    const season = new ArenaSeasonSystem();
    const ps = makePlayerState({ rankId: 'GOLD_III', score: 4000, arenaCoins: 100 });

    const { state, reward } = season.settleSeason(ps, 'GOLD_III');
    assertStrict(reward.arenaCoin > 0, 'FLOW-13-21', '赛季奖励应包含竞技币');
    assertStrict(reward.copper > 0, 'FLOW-13-21', '赛季奖励应包含铜钱');
    assertStrict(state.arenaCoins === 100 + reward.arenaCoin, 'FLOW-13-21', '竞技币应累加');
  });

  it(accTest('FLOW-13-22', '奖励系统 — 每日段位奖励'), () => {
    const season = new ArenaSeasonSystem();
    const ps = makePlayerState({ rankId: 'GOLD_V', arenaCoins: 0 });

    const { state, reward } = season.grantDailyReward(ps);
    assertStrict(reward.arenaCoin > 0, 'FLOW-13-22', '每日奖励应包含竞技币');
    assertStrict(reward.copper > 0, 'FLOW-13-22', '每日奖励应包含铜钱');
    assertStrict(state.arenaCoins === reward.arenaCoin, 'FLOW-13-22', '竞技币应增加');
  });

  it(accTest('FLOW-13-23', '奖励系统 — 商店购买消耗竞技币'), () => {
    const shop = new ArenaShopSystem();
    const ps = makePlayerState({ arenaCoins: 1000 });

    const { state, item } = shop.buyItem(ps, 'fragment_liubei', 1);
    assertStrict(state.arenaCoins === 1000 - 100, 'FLOW-13-23', `应扣除100竞技币，实际 ${state.arenaCoins}`);
    assertStrict(item.purchased === 1, 'FLOW-13-23', '已购数量应为1');
  });

  it(accTest('FLOW-13-24', '奖励系统 — 商店限购和竞技币不足'), () => {
    const shop = new ArenaShopSystem();

    // 竞技币不足
    const poor = makePlayerState({ arenaCoins: 10 });
    expect(() => shop.buyItem(poor, 'fragment_liubei', 1)).toThrow('竞技币不足');

    // 超出限购
    const rich = makePlayerState({ arenaCoins: 999999 });
    expect(() => shop.buyItem(rich, 'fragment_liubei', 6)).toThrow('限购');
  });

  it(accTest('FLOW-13-25', '奖励系统 — 商店周重置限购计数'), () => {
    const shop = new ArenaShopSystem();
    const rich = makePlayerState({ arenaCoins: 999999 });

    shop.buyItem(rich, 'fragment_liubei', 3);
    const itemBefore = shop.getItem('fragment_liubei');
    assertStrict(itemBefore!.purchased === 3, 'FLOW-13-25', '已购应为3');

    shop.weeklyReset();
    const itemAfter = shop.getItem('fragment_liubei');
    assertStrict(itemAfter!.purchased === 0, 'FLOW-13-25', '周重置后已购应为0');
  });

  // ── 6. 苏格拉底边界（FLOW-13-26 ~ FLOW-13-30） ──

  it(accTest('FLOW-13-26', '边界 — 空防守阵容拒绝更新'), () => {
    const arena = engine.getArenaSystem();
    const ps = makePlayerState();
    expect(() => arena.updateDefenseFormation(ps, ['', '', '', '', ''], FormationType.FISH_SCALE, AIDefenseStrategy.BALANCED))
      .toThrow('至少需要1名武将');
  });

  it(accTest('FLOW-13-27', '边界 — 手动刷新达到每日上限后拒绝'), () => {
    const arena = engine.getArenaSystem();
    const ps = makePlayerState({ dailyManualRefreshes: 10 });
    expect(() => arena.manualRefresh(ps, [], Date.now())).toThrow('今日手动刷新次数已达上限');
  });

  it(accTest('FLOW-13-28', '边界 — 序列化/反序列化保持数据一致'), () => {
    const arena = engine.getArenaSystem();
    const ps = makePlayerState({ score: 1500, ranking: 3, arenaCoins: 800 });

    const data = arena.serialize(ps);
    assertStrict(data.version === ARENA_SAVE_VERSION, 'FLOW-13-28', `版本应为 ${ARENA_SAVE_VERSION}`);
    assertStrict(data.state.score === 1500, 'FLOW-13-28', '积分应为1500');

    arena.reset();
    const restored = arena.deserialize(data);
    assertStrict(restored.score === 1500, 'FLOW-13-28', '恢复后积分应为1500');
    assertStrict(restored.ranking === 3, 'FLOW-13-28', '恢复后排名应为3');
  });

  it(accTest('FLOW-13-29', '边界 — 版本不匹配反序列化返回默认'), () => {
    const arena = engine.getArenaSystem();
    const badData = {
      version: 999,
      state: createDefaultArenaPlayerState(),
      season: { seasonId: '', startTime: 0, endTime: 0, currentDay: 1, isSettled: false },
      highestRankId: 'BRONZE_V',
    };
    const result = arena.deserialize(badData as any);
    assertStrict(result.score === 0, 'FLOW-13-29', '版本不匹配应返回默认状态');
  });

  it(accTest('FLOW-13-30', '边界 — 系统重置清空玩家池和状态'), () => {
    const arena = engine.getArenaSystem();
    arena.registerPlayer(makeOpponent({ playerId: 'p1' }));
    arena.registerPlayer(makeOpponent({ playerId: 'p2' }));
    assertStrict(arena.getAllPlayers().length === 2, 'FLOW-13-30', '注册后应有2人');

    arena.reset();
    assertStrict(arena.getAllPlayers().length === 0, 'FLOW-13-30', '重置后应为0');

    const es = arena.getState();
    const ps = es.playerState as ArenaPlayerState;
    assertStrict(ps.score === 0, 'FLOW-13-30', '重置后积分应为0');
    assertStrict(ps.dailyChallengesLeft === DEFAULT_CHALLENGE_CONFIG.dailyFreeChallenges, 'FLOW-13-30', '挑战次数应恢复');
  });
});
