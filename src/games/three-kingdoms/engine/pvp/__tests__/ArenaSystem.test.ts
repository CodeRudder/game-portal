/**
 * ArenaSystem 单元测试
 *
 * 覆盖：
 *   - 对手选择规则（战力0.7~1.3范围）
 *   - 刷新机制（免费30min / 手动500铜钱 / 每日10次）
 *   - 挑战次数（每日5次 / 元宝购买 / 重置）
 *   - 防守阵容设置（5阵位）
 *   - 防守日志与统计
 *   - 每日重置
 */

import {
  ArenaSystem,
  DEFAULT_MATCH_CONFIG,
  DEFAULT_REFRESH_CONFIG,
  DEFAULT_CHALLENGE_CONFIG,
  createDefaultDefenseFormation,
  createDefaultArenaPlayerState,
} from '../ArenaSystem';
import { FormationType, AIDefenseStrategy } from '../../../core/pvp/pvp.types';
import type { ArenaOpponent, ArenaPlayerState } from '../../../core/pvp/pvp.types';

// ── 辅助函数 ──────────────────────────────

/** 创建测试用对手 */
function createOpponent(overrides: Partial<ArenaOpponent> = {}): ArenaOpponent {
  return {
    playerId: 'p1',
    playerName: 'Player1',
    power: 10000,
    rankId: 'BRONZE_V',
    score: 100,
    ranking: 10,
    faction: 'wei' as any,
    defenseSnapshot: null,
    ...overrides,
  };
}

/** 创建一组不同阵营的对手 */
function createDiverseOpponents(count: number, basePower: number, baseRanking: number): ArenaOpponent[] {
  const factions = ['wei', 'shu', 'wu'] as const;
  const result: ArenaOpponent[] = [];
  for (let i = 0; i < count; i++) {
    result.push(
      createOpponent({
        playerId: `player_${i}`,
        playerName: `Player${i}`,
        power: basePower + i * 500,
        ranking: baseRanking + i,
        score: 100 + i * 50,
        rankId: 'BRONZE_V',
        faction: factions[i % 3] as any,
      }),
    );
  }
  return result;
}

/** 创建有阵容的玩家状态（影响战力计算） */
function createPlayerWithHeroes(score: number, heroCount: number, ranking: number = 100): ArenaPlayerState {
  const state = createDefaultArenaPlayerState();
  const slots: [string, string, string, string, string] = ['', '', '', '', ''];
  for (let i = 0; i < Math.min(heroCount, 5); i++) {
    slots[i] = `hero_${i}`;
  }
  return {
    ...state,
    score,
    ranking,
    defenseFormation: { slots, formation: FormationType.FISH_SCALE, strategy: AIDefenseStrategy.BALANCED },
  };
}

// ── 对手选择规则 ──────────────────────────

describe('ArenaSystem — 对手选择规则', () => {
  let system: ArenaSystem;

  beforeEach(() => {
    system = new ArenaSystem();
  });

  test('应在战力0.7~1.3范围内筛选对手', () => {
    // 玩家战力 ≈ score*10 + heroCount*1000 + 5000 = 500 + 3000 + 5000 = 8500
    const playerState = createPlayerWithHeroes(50, 3, 100);
    const myPower = 50 * 10 + 3 * 1000 + 5000; // 8500
    const minPower = Math.floor(myPower * 0.7); // 5950
    const maxPower = Math.ceil(myPower * 1.3); // 11050

    const opponents = [
      createOpponent({ playerId: 'low', power: minPower - 100, ranking: 100 }),    // 太弱
      createOpponent({ playerId: 'ok1', power: minPower, ranking: 100 }),           // 刚好下限
      createOpponent({ playerId: 'ok2', power: maxPower, ranking: 100 }),           // 刚好上限
      createOpponent({ playerId: 'high', power: maxPower + 100, ranking: 100 }),    // 太强
    ];

    const result = system.generateOpponents(playerState, opponents);
    const ids = result.map((o) => o.playerId);
    expect(ids).not.toContain('low');
    expect(ids).not.toContain('high');
    // ok1 和 ok2 应该被选中
    expect(ids).toContain('ok1');
    expect(ids).toContain('ok2');
  });

  test('应在排名±5~±20范围内筛选对手', () => {
    const playerState = createPlayerWithHeroes(50, 3, 100);

    const opponents = [
      createOpponent({ playerId: 'close', power: 8500, ranking: 95 }),    // 偏移5，OK
      createOpponent({ playerId: 'far', power: 8500, ranking: 79 }),      // 偏移21，超出
      createOpponent({ playerId: 'near', power: 8500, ranking: 120 }),    // 偏移20，OK
      createOpponent({ playerId: 'toofar', power: 8500, ranking: 121 }),  // 偏移21，超出
    ];

    const result = system.generateOpponents(playerState, opponents);
    const ids = result.map((o) => o.playerId);
    expect(ids).toContain('close');
    expect(ids).toContain('near');
    expect(ids).not.toContain('far');
    expect(ids).not.toContain('toofar');
  });

  test('应返回不超过candidateCount个对手', () => {
    const playerState = createPlayerWithHeroes(50, 3, 100);
    const opponents = createDiverseOpponents(20, 7000, 95);

    const result = system.generateOpponents(playerState, opponents);
    expect(result.length).toBeLessThanOrEqual(DEFAULT_MATCH_CONFIG.candidateCount);
  });

  test('对手不足时返回可用数量', () => {
    const playerState = createPlayerWithHeroes(50, 3, 100);
    const opponents = [
      createOpponent({ playerId: 'only', power: 8500, ranking: 100 }),
    ];

    const result = system.generateOpponents(playerState, opponents);
    expect(result.length).toBe(1);
    expect(result[0].playerId).toBe('only');
  });

  test('无合格对手时返回空数组', () => {
    const playerState = createPlayerWithHeroes(50, 3, 100);
    const opponents = [
      createOpponent({ playerId: 'weak', power: 100, ranking: 1 }),
    ];

    const result = system.generateOpponents(playerState, opponents);
    expect(result).toEqual([]);
  });

  test('应按阵营平衡选择对手', () => {
    const playerState = createPlayerWithHeroes(50, 3, 100);
    // 5个魏国对手，1个蜀国，1个吴国
    const opponents: ArenaOpponent[] = [];
    for (let i = 0; i < 5; i++) {
      opponents.push(createOpponent({
        playerId: `wei_${i}`, power: 8500, ranking: 100 + i, faction: 'wei' as any,
      }));
    }
    opponents.push(createOpponent({ playerId: 'shu_0', power: 8500, ranking: 105, faction: 'shu' as any }));
    opponents.push(createOpponent({ playerId: 'wu_0', power: 8500, ranking: 106, faction: 'wu' as any }));

    const result = system.generateOpponents(playerState, opponents);
    const factions = result.map((o) => o.faction);
    // 应该从不同阵营各选至少一个
    const uniqueFactions = new Set(factions);
    expect(uniqueFactions.size).toBeGreaterThanOrEqual(2);
  });
});

// ── 刷新机制 ──────────────────────────────

describe('ArenaSystem — 刷新机制', () => {
  let system: ArenaSystem;

  beforeEach(() => {
    system = new ArenaSystem();
  });

  test('免费刷新间隔为30分钟', () => {
    const config = system.getRefreshConfig();
    expect(config.freeIntervalMs).toBe(30 * 60 * 1000);
  });

  test('冷却期内不可免费刷新', () => {
    const now = 1000000;
    const playerState: ArenaPlayerState = {
      ...createDefaultArenaPlayerState(),
      lastFreeRefreshTime: now - 1000, // 1秒前刷新过
    };

    expect(system.canFreeRefresh(playerState, now)).toBe(false);
  });

  test('冷却期后可以免费刷新', () => {
    const now = 100000000;
    const playerState: ArenaPlayerState = {
      ...createDefaultArenaPlayerState(),
      lastFreeRefreshTime: now - 30 * 60 * 1000 - 1, // 超过30分钟
    };

    expect(system.canFreeRefresh(playerState, now)).toBe(true);
  });

  test('免费刷新应更新对手列表和刷新时间', () => {
    const now = 100000000;
    // 使用有武将的玩家状态，使战力与对手范围匹配（8500）
    const playerState: ArenaPlayerState = {
      ...createPlayerWithHeroes(50, 3, 100),
      lastFreeRefreshTime: 0, // 从未刷新过
    };
    const opponents = createDiverseOpponents(10, 7000, 95);

    const result = system.freeRefresh(playerState, opponents, now);
    expect(result.lastFreeRefreshTime).toBe(now);
    expect(result.opponents.length).toBeGreaterThan(0);
  });

  test('冷却期内免费刷新应抛出异常', () => {
    const now = 1000000;
    const playerState: ArenaPlayerState = {
      ...createDefaultArenaPlayerState(),
      lastFreeRefreshTime: now - 1000,
    };

    expect(() => system.freeRefresh(playerState, [], now)).toThrow('免费刷新冷却中');
  });

  test('手动刷新消耗500铜钱', () => {
    const config = system.getRefreshConfig();
    expect(config.manualCostCopper).toBe(500);
  });

  test('手动刷新应返回消耗和新状态', () => {
    const now = 1000000;
    // 使用有武将的玩家状态，使战力与对手范围匹配（8500）
    const playerState = createPlayerWithHeroes(50, 3, 100);
    const opponents = createDiverseOpponents(10, 7000, 95);

    const result = system.manualRefresh(playerState, opponents, now);
    expect(result.cost).toBe(500);
    expect(result.state.dailyManualRefreshes).toBe(1);
    expect(result.state.opponents.length).toBeGreaterThan(0);
  });

  test('每日手动刷新上限10次', () => {
    const config = system.getRefreshConfig();
    expect(config.dailyManualLimit).toBe(10);
  });

  test('超过每日手动刷新上限应抛出异常', () => {
    const now = 1000000;
    const playerState: ArenaPlayerState = {
      ...createDefaultArenaPlayerState(),
      dailyManualRefreshes: 10,
    };

    expect(() => system.manualRefresh(playerState, [], now)).toThrow('今日手动刷新次数已达上限');
  });
});

// ── 挑战次数 ──────────────────────────────

describe('ArenaSystem — 挑战次数', () => {
  let system: ArenaSystem;

  beforeEach(() => {
    system = new ArenaSystem();
  });

  test('默认每日5次免费挑战', () => {
    const config = system.getChallengeConfig();
    expect(config.dailyFreeChallenges).toBe(5);
  });

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
