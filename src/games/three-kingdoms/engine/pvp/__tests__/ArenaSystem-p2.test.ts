import {
import { FormationType, AIDefenseStrategy } from '../../../core/pvp/pvp.types';
import type { ArenaOpponent, ArenaPlayerState } from '../../../core/pvp/pvp.types';


  test('初始状态有5次挑战机会', () => {
    const state = createDefaultArenaPlayerState();
    expect(state.dailyChallengesLeft).toBe(5);
    expect(system.canChallenge(state)).toBe(true);
  });

  test('消耗挑战次数后递减', () => {
    const state = createDefaultArenaPlayerState();
    const after = system.consumeChallenge(state);
    expect(after.dailyChallengesLeft).toBe(4);
  });

  test('挑战次数用完后不可挑战', () => {
    const state: ArenaPlayerState = {
      ...createDefaultArenaPlayerState(),
      dailyChallengesLeft: 0,
    };
    expect(system.canChallenge(state)).toBe(false);
  });

  test('次数为0时消耗应抛出异常', () => {
    const state: ArenaPlayerState = {
      ...createDefaultArenaPlayerState(),
      dailyChallengesLeft: 0,
    };
    expect(() => system.consumeChallenge(state)).toThrow('今日挑战次数已用完');
  });

  test('购买挑战次数消耗50元宝', () => {
    const config = system.getChallengeConfig();
    expect(config.buyCostGold).toBe(50);
  });

  test('购买挑战次数应增加次数', () => {
    const state: ArenaPlayerState = {
      ...createDefaultArenaPlayerState(),
      dailyChallengesLeft: 0,
      dailyBoughtChallenges: 0,
    };
    const result = system.buyChallenge(state);
    expect(result.state.dailyChallengesLeft).toBe(1);
    expect(result.state.dailyBoughtChallenges).toBe(1);
    expect(result.cost).toBe(50);
  });

  test('每日购买上限5次', () => {
    const config = system.getChallengeConfig();
    expect(config.dailyBuyLimit).toBe(5);
  });

  test('超过购买上限应抛出异常', () => {
    const state: ArenaPlayerState = {
      ...createDefaultArenaPlayerState(),
      dailyBoughtChallenges: 5,
    };
    expect(() => system.buyChallenge(state)).toThrow('今日购买次数已达上限');
  });

  test('每日重置应恢复挑战次数', () => {
    const state: ArenaPlayerState = {
      ...createDefaultArenaPlayerState(),
      dailyChallengesLeft: 0,
      dailyBoughtChallenges: 3,
      dailyManualRefreshes: 5,
      opponents: [createOpponent()],
    };

    const reset = system.dailyReset(state);
    expect(reset.dailyChallengesLeft).toBe(5);
    expect(reset.dailyBoughtChallenges).toBe(0);
    expect(reset.dailyManualRefreshes).toBe(0);
    expect(reset.opponents).toEqual([]);
  });
});

// ── 防守阵容 ──────────────────────────────

describe('ArenaSystem — 防守阵容', () => {
  let system: ArenaSystem;

  beforeEach(() => {
    system = new ArenaSystem();
  });

  test('默认阵容5个空位', () => {
    const formation = createDefaultDefenseFormation();
    expect(formation.slots).toEqual(['', '', '', '', '']);
    expect(formation.formation).toBe(FormationType.FISH_SCALE);
    expect(formation.strategy).toBe(AIDefenseStrategy.BALANCED);
  });

  test('可以设置防守阵容', () => {
    const state = createDefaultArenaPlayerState();
    const slots: [string, string, string, string, string] = ['hero_a', 'hero_b', '', '', ''];

    const result = system.updateDefenseFormation(
      state, slots, FormationType.WEDGE, AIDefenseStrategy.AGGRESSIVE,
    );
    expect(result.defenseFormation.slots).toEqual(slots);
    expect(result.defenseFormation.formation).toBe(FormationType.WEDGE);
    expect(result.defenseFormation.strategy).toBe(AIDefenseStrategy.AGGRESSIVE);
  });

  test('至少需要1名武将', () => {
    const state = createDefaultArenaPlayerState();
    const emptySlots: [string, string, string, string, string] = ['', '', '', '', ''];

    expect(() => system.updateDefenseFormation(state, emptySlots, FormationType.FISH_SCALE, AIDefenseStrategy.BALANCED))
      .toThrow('防守阵容至少需要1名武将');
  });

  test('可以设置5个武将满阵容', () => {
    const state = createDefaultArenaPlayerState();
    const fullSlots: [string, string, string, string, string] = ['h1', 'h2', 'h3', 'h4', 'h5'];

    const result = system.updateDefenseFormation(state, fullSlots, FormationType.GOOSE, AIDefenseStrategy.CUNNING);
    expect(result.defenseFormation.slots).toEqual(fullSlots);
  });
});

// ── 防守日志 ──────────────────────────────

describe('ArenaSystem — 防守日志', () => {
  let system: ArenaSystem;

  beforeEach(() => {
    system = new ArenaSystem();
  });

  test('添加防守日志', () => {
    const state = createDefaultArenaPlayerState();
    const now = 1000000;
    const result = system.addDefenseLog(state, {
      attackerId: 'attacker1',
      attackerName: '进攻者',
      defenderWon: true,
      turns: 5,
      attackerRank: 'BRONZE_IV',
    }, now);

    expect(result.defenseLogs.length).toBe(1);
    expect(result.defenseLogs[0].attackerId).toBe('attacker1');
    expect(result.defenseLogs[0].defenderWon).toBe(true);
    expect(result.defenseLogs[0].timestamp).toBe(now);
  });

  test('防守日志最多保留50条', () => {
    let state = createDefaultArenaPlayerState();
    const now = 1000000;

    for (let i = 0; i < 60; i++) {
      state = system.addDefenseLog(state, {
        attackerId: `attacker_${i}`,
        attackerName: `进攻者${i}`,
        defenderWon: i % 2 === 0,
        turns: 5,
        attackerRank: 'BRONZE_V',
      }, now + i);
    }

    expect(state.defenseLogs.length).toBe(50);
  });

  test('防守统计 — 全胜', () => {
    let state = createDefaultArenaPlayerState();
    const now = 1000000;

    for (let i = 0; i < 5; i++) {
      state = system.addDefenseLog(state, {
        attackerId: `a${i}`, attackerName: `A${i}`,
        defenderWon: true, turns: 3, attackerRank: 'BRONZE_V',
      }, now + i);
    }

    const stats = system.getDefenseStats(state);
    expect(stats.totalDefenses).toBe(5);
    expect(stats.wins).toBe(5);
    expect(stats.losses).toBe(0);
    expect(stats.winRate).toBe(1);
  });

  test('防守统计 — 低胜率建议策略', () => {
    let state = createDefaultArenaPlayerState();
    const now = 1000000;

    // 2胜3负 = 40% 胜率
    for (let i = 0; i < 5; i++) {
      state = system.addDefenseLog(state, {
        attackerId: `a${i}`, attackerName: `A${i}`,
        defenderWon: i < 2, turns: 3, attackerRank: 'BRONZE_V',
      }, now + i);
    }

    const stats = system.getDefenseStats(state);
    expect(stats.winRate).toBe(0.4);
    expect(stats.suggestedStrategy).toBe(AIDefenseStrategy.BALANCED);
  });

  test('防守统计 — 极低胜率建议防守策略', () => {
    let state = createDefaultArenaPlayerState();
    const now = 1000000;

    // 1胜4负 = 20% 胜率
    for (let i = 0; i < 5; i++) {
      state = system.addDefenseLog(state, {
        attackerId: `a${i}`, attackerName: `A${i}`,
        defenderWon: i === 0, turns: 3, attackerRank: 'BRONZE_V',
      }, now + i);
    }

    const stats = system.getDefenseStats(state);
    expect(stats.winRate).toBeLessThan(0.3);
    expect(stats.suggestedStrategy).toBe(AIDefenseStrategy.DEFENSIVE);
  });

  test('防守统计 — 样本不足不给出建议', () => {
    let state = createDefaultArenaPlayerState();
    state = system.addDefenseLog(state, {
      attackerId: 'a1', attackerName: 'A1',
      defenderWon: false, turns: 3, attackerRank: 'BRONZE_V',
    }, 1000);

    const stats = system.getDefenseStats(state);
    expect(stats.totalDefenses).toBe(1);
    expect(stats.suggestedStrategy).toBeNull();
  });
});

// ── 玩家池管理 ────────────────────────────

describe('ArenaSystem — 玩家池管理', () => {
  test('注册玩家并获取', () => {
    const system = new ArenaSystem();
    const opp = createOpponent({ playerId: 'p1' });
    system.registerPlayer(opp);

    const all = system.getAllPlayers();
    expect(all.length).toBe(1);
    expect(all[0].playerId).toBe('p1');
  });
});

// ── 默认配置验证 ──────────────────────────

describe('ArenaSystem — 默认配置', () => {
  test('匹配配置默认值', () => {
    expect(DEFAULT_MATCH_CONFIG.powerMinRatio).toBe(0.7);
    expect(DEFAULT_MATCH_CONFIG.powerMaxRatio).toBe(1.3);
    expect(DEFAULT_MATCH_CONFIG.candidateCount).toBe(3);
  });

  test('刷新配置默认值', () => {
    expect(DEFAULT_REFRESH_CONFIG.freeIntervalMs).toBe(30 * 60 * 1000);
    expect(DEFAULT_REFRESH_CONFIG.manualCostCopper).toBe(500);
    expect(DEFAULT_REFRESH_CONFIG.dailyManualLimit).toBe(10);
  });

  test('挑战配置默认值', () => {
    expect(DEFAULT_CHALLENGE_CONFIG.dailyFreeChallenges).toBe(5);
    expect(DEFAULT_CHALLENGE_CONFIG.buyCostGold).toBe(50);
    expect(DEFAULT_CHALLENGE_CONFIG.dailyBuyLimit).toBe(5);
  });

  test('自定义配置可以覆盖默认值', () => {
    const system = new ArenaSystem(
      { candidateCount: 5 },
      { manualCostCopper: 1000 },
      { dailyFreeChallenges: 10 },
    );

    expect(system.getMatchConfig().candidateCount).toBe(5);
    expect(system.getRefreshConfig().manualCostCopper).toBe(1000);
    expect(system.getChallengeConfig().dailyFreeChallenges).toBe(10);
  });
});
