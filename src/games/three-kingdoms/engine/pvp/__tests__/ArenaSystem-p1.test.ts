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
import type { Faction } from '../../hero/hero.types';

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
    faction: 'wei' as Faction,
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
        faction: factions[i % 3] as Faction,
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
