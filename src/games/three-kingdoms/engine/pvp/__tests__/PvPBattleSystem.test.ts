/**
 * PvPBattleSystem 单元测试
 *
 * 覆盖：
 *   - 积分计算（胜+30~60 / 败-15~-30）
 *   - 段位判定（21级段位）
 *   - 段位升降检测
 *   - PvP战斗执行
 *   - 10回合超时防守方胜
 *   - 战斗结果应用
 *   - 战斗回放
 *   - 每日奖励
 */

import {
  PvPBattleSystem,
  DEFAULT_PVP_BATTLE_CONFIG,
  DEFAULT_SCORE_CONFIG,
  RANK_LEVELS,
  RANK_LEVEL_MAP,
  REPLAY_CONFIG,
} from '../PvPBattleSystem';
import { FormationType, AIDefenseStrategy, RankDivision, PvPBattleMode } from '../../../core/pvp/pvp.types';
import type { ArenaPlayerState, BattleReplay } from '../../../core/pvp/pvp.types';
import { createDefaultArenaPlayerState } from '../ArenaSystem';

// ── 辅助函数 ──────────────────────────────

function createPlayerState(score: number, heroCount: number = 3): ArenaPlayerState {
  const state = createDefaultArenaPlayerState();
  const slots: [string, string, string, string, string] = ['', '', '', '', ''];
  for (let i = 0; i < Math.min(heroCount, 5); i++) {
    slots[i] = `hero_${i}`;
  }
  return {
    ...state,
    score,
    defenseFormation: { slots, formation: FormationType.FISH_SCALE, strategy: AIDefenseStrategy.BALANCED },
  };
}

function createReplay(overrides: Partial<BattleReplay> = {}): BattleReplay {
  return {
    id: 'replay_1',
    battleId: 'battle_1',
    attackerName: '进攻方',
    defenderName: '防守方',
    attackerWon: true,
    timestamp: Date.now(),
    totalTurns: 5,
    actions: [],
    result: {} as unknown as Record<string, unknown>,
    keyMoments: [3],
    ...overrides,
  };
}

// ── 积分计算 ──────────────────────────────

describe('PvPBattleSystem — 积分计算', () => {
  let system: PvPBattleSystem;

  beforeEach(() => {
    system = new PvPBattleSystem();
  });

  test('胜利积分在+30~+60范围内', () => {
    for (let i = 0; i < 100; i++) {
      const score = system.calculateWinScore();
      expect(score).toBeGreaterThanOrEqual(30);
      expect(score).toBeLessThanOrEqual(60);
    }
  });

  test('失败扣分在-15~-30范围内', () => {
    for (let i = 0; i < 100; i++) {
      const score = system.calculateLoseScore();
      expect(score).toBeLessThanOrEqual(-15);
      expect(score).toBeGreaterThanOrEqual(-30);
    }
  });

  test('默认积分配置', () => {
    const config = system.getScoreConfig();
    expect(config.winMinScore).toBe(30);
    expect(config.winMaxScore).toBe(60);
    expect(config.loseMinScore).toBe(15);
    expect(config.loseMaxScore).toBe(30);
  });

  test('应用胜利积分后分数增加', () => {
    const state = createPlayerState(100);
    const result = system.applyScoreChange(state, 40);
    expect(result.score).toBe(140);
  });

  test('应用失败扣分后分数减少', () => {
    const state = createPlayerState(100);
    const result = system.applyScoreChange(state, -20);
    expect(result.score).toBe(80);
  });

  test('积分不会低于0', () => {
    const state = createPlayerState(10);
    const result = system.applyScoreChange(state, -50);
    expect(result.score).toBe(0);
  });

  test('积分变化后段位自动更新', () => {
    const state = createPlayerState(90); // BRONZE_V (0~99)
    const result = system.applyScoreChange(state, 50); // 140 → BRONZE_IV (100~199)
    expect(result.score).toBe(140);
    expect(result.rankId).toBe('BRONZE_IV');
  });
});

// ── 段位判定 ──────────────────────────────

describe('PvPBattleSystem — 段位判定', () => {
  let system: PvPBattleSystem;

  beforeEach(() => {
    system = new PvPBattleSystem();
  });

  test('共21级段位', () => {
    expect(RANK_LEVELS.length).toBe(21);
    expect(system.getRankLevelCount()).toBe(21);
  });

  test('段位从低到高：青铜→白银→黄金→铂金→钻石→大师→王者', () => {
    const tiers = [...new Set(RANK_LEVELS.map((r) => r.tier))];
    expect(tiers).toEqual(['BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND', 'MASTER', 'KING']);
  });

  test('积分0对应青铜V', () => {
    expect(system.getRankIdForScore(0)).toBe('BRONZE_V');
  });

  test('积分100对应青铜IV', () => {
    expect(system.getRankIdForScore(100)).toBe('BRONZE_IV');
  });

  test('积分500对应白银V', () => {
    expect(system.getRankIdForScore(500)).toBe('SILVER_V');
  });

  test('积分1000对应黄金IV', () => {
    expect(system.getRankIdForScore(1000)).toBe('GOLD_IV');
  });

  test('积分4000对应王者I', () => {
    expect(system.getRankIdForScore(4000)).toBe('KING_I');
  });

  test('积分9999对应王者I', () => {
    expect(system.getRankIdForScore(9999)).toBe('KING_I');
  });

  test('getRankLevel返回正确段位定义', () => {
    const bronzeV = system.getRankLevel('BRONZE_V');
    expect(bronzeV).toBeDefined();
    expect(bronzeV!.minScore).toBe(0);
    expect(bronzeV!.maxScore).toBe(99);
  });

  test('不存在的段位ID返回undefined', () => {
    expect(system.getRankLevel('INVALID')).toBeUndefined();
  });

  test('段位积分范围连续无间隙', () => {
    for (let i = 0; i < RANK_LEVELS.length - 1; i++) {
      expect(RANK_LEVELS[i].maxScore + 1).toBe(RANK_LEVELS[i + 1].minScore);
    }
  });
});

// ── 段位升降检测 ──────────────────────────

describe('PvPBattleSystem — 段位升降', () => {
  let system: PvPBattleSystem;

  beforeEach(() => {
    system = new PvPBattleSystem();
  });

  test('检测升段', () => {
    expect(system.isRankUp('BRONZE_V', 'BRONZE_IV')).toBe(true);
    expect(system.isRankUp('BRONZE_I', 'SILVER_V')).toBe(true);
    expect(system.isRankUp('SILVER_I', 'GOLD_IV')).toBe(true);
  });

  test('检测降段', () => {
    expect(system.isRankDown('BRONZE_IV', 'BRONZE_V')).toBe(true);
    expect(system.isRankDown('SILVER_V', 'BRONZE_I')).toBe(true);
  });

  test('同段位不算升降', () => {
    expect(system.isRankUp('BRONZE_V', 'BRONZE_V')).toBe(false);
    expect(system.isRankDown('BRONZE_V', 'BRONZE_V')).toBe(false);
  });
});

// ── PvP战斗执行 ───────────────────────────

describe('PvPBattleSystem — PvP战斗执行', () => {
  let system: PvPBattleSystem;

  beforeEach(() => {
    system = new PvPBattleSystem();
  });

  test('战斗应返回完整结果', () => {
    const attacker = createPlayerState(500, 3);
    const defender = createPlayerState(400, 3);

    const result = system.executeBattle(attacker, defender);

    expect(result.battleId).toBeTruthy();
    expect(result.attackerWon).toBeDefined();
    expect(result.scoreChange).toBeDefined();
    expect(result.attackerNewScore).toBeGreaterThanOrEqual(0);
    expect(result.defenderNewScore).toBeGreaterThanOrEqual(0);
    expect(result.totalTurns).toBeGreaterThanOrEqual(1);
    expect(result.totalTurns).toBeLessThanOrEqual(10);
  });

  test('战斗配置 — 最大10回合', () => {
    const config = system.getBattleConfig();
    expect(config.maxTurns).toBe(10);
  });

  test('战斗配置 — 防守方+5%属性加成', () => {
    const config = system.getBattleConfig();
    expect(config.defenseBonusRatio).toBe(0.05);
  });

  test('战斗配置 — 超时防守方胜', () => {
    const config = system.getBattleConfig();
    expect(config.timeoutWinner).toBe('defender');
  });

  test('胜利时积分变化为正', () => {
    // 多次执行确保至少有一次胜利
    let result;
    for (let i = 0; i < 50; i++) {
      const attacker = createPlayerState(5000, 5); // 极高战力
      const defender = createPlayerState(0, 0);
      result = system.executeBattle(attacker, defender);
      if (result.attackerWon) break;
    }
    if (result!.attackerWon) {
      expect(result!.scoreChange).toBeGreaterThan(0);
    }
  });

  test('失败时积分变化为负', () => {
    let result;
    for (let i = 0; i < 50; i++) {
      const attacker = createPlayerState(0, 0); // 极低战力
      const defender = createPlayerState(5000, 5);
      result = system.executeBattle(attacker, defender);
      if (!result.attackerWon) break;
    }
    if (!result!.attackerWon) {
      expect(result!.scoreChange).toBeLessThan(0);
    }
  });
});

// ── 战斗结果应用 ──────────────────────────

describe('PvPBattleSystem — 战斗结果应用', () => {
  let system: PvPBattleSystem;

  beforeEach(() => {
    system = new PvPBattleSystem();
  });

  test('应用胜利结果增加竞技币', () => {
    const state = createPlayerState(100);
    const result = {
      battleId: 'b1',
      attackerId: 'p1',
      defenderId: 'p2',
      attackerWon: true,
      scoreChange: 40,
      attackerNewScore: 140,
      defenderNewScore: 60,
      totalTurns: 5,
      isTimeout: false,
      battleState: null,
    };

    const newState = system.applyBattleResult(state, result);
    expect(newState.score).toBe(140);
    expect(newState.arenaCoins).toBe(20); // 胜利+20
  });

  test('应用失败结果增加少量竞技币', () => {
    const state = createPlayerState(100);
    const result = {
      battleId: 'b1',
      attackerId: 'p1',
      defenderId: 'p2',
      attackerWon: false,
      scoreChange: -20,
      attackerNewScore: 80,
      defenderNewScore: 120,
      totalTurns: 8,
      isTimeout: false,
      battleState: null,
    };

    const newState = system.applyBattleResult(state, result);
    expect(newState.score).toBe(80);
    expect(newState.arenaCoins).toBe(5); // 失败+5
  });
});

// ── 战斗回放 ──────────────────────────────

describe('PvPBattleSystem — 战斗回放', () => {
  let system: PvPBattleSystem;

  beforeEach(() => {
    system = new PvPBattleSystem();
  });

  test('保存战斗回放', () => {
    const state = createPlayerState(100);
    const replay = createReplay();

    const result = system.saveReplay(state, replay);
    expect(result.replays.length).toBe(1);
    expect(result.replays[0].id).toBe('replay_1');
  });

  test('回放最多保存50条', () => {
    let state = createPlayerState(100);

    for (let i = 0; i < 60; i++) {
      const replay = createReplay({ id: `replay_${i}`, battleId: `battle_${i}` });
      state = system.saveReplay(state, replay);
    }

    expect(state.replays.length).toBe(50);
  });

  test('清理过期回放', () => {
    const now = 100000000;
    const oldTime = now - REPLAY_CONFIG.retentionMs - 1;
    const recentTime = now - 1000;

    let state = createPlayerState(100);
    state = system.saveReplay(state, createReplay({ id: 'old', timestamp: oldTime }));
    state = system.saveReplay(state, createReplay({ id: 'recent', timestamp: recentTime }));

    const cleaned = system.cleanExpiredReplays(state, now);
    expect(cleaned.replays.length).toBe(1);
    expect(cleaned.replays[0].id).toBe('recent');
  });

  test('回放配置', () => {
    expect(REPLAY_CONFIG.maxReplays).toBe(50);
    expect(REPLAY_CONFIG.retentionDays).toBe(7);
  });
});

// ── 每日奖励 ──────────────────────────────

describe('PvPBattleSystem — 每日奖励', () => {
  let system: PvPBattleSystem;

  beforeEach(() => {
    system = new PvPBattleSystem();
  });

  test('青铜V每日奖励', () => {
    const reward = system.getDailyReward('BRONZE_V');
    expect(reward.copper).toBe(500);
    expect(reward.arenaCoin).toBe(10);
    expect(reward.gold).toBe(5);
  });

  test('王者I每日奖励最丰厚', () => {
    const kingReward = system.getDailyReward('KING_I');
    const bronzeReward = system.getDailyReward('BRONZE_V');
    expect(kingReward.copper).toBeGreaterThan(bronzeReward.copper);
    expect(kingReward.arenaCoin).toBeGreaterThan(bronzeReward.arenaCoin);
    expect(kingReward.gold).toBeGreaterThan(bronzeReward.gold);
  });

  test('不存在的段位返回默认奖励', () => {
    const reward = system.getDailyReward('INVALID');
    expect(reward).toEqual({ copper: 500, arenaCoin: 10, gold: 5 });
  });
});

// ── 默认配置验证 ──────────────────────────

describe('PvPBattleSystem — 默认配置', () => {
  test('战斗配置默认值', () => {
    expect(DEFAULT_PVP_BATTLE_CONFIG.maxTurns).toBe(10);
    expect(DEFAULT_PVP_BATTLE_CONFIG.defenseBonusRatio).toBe(0.05);
    expect(DEFAULT_PVP_BATTLE_CONFIG.timeoutWinner).toBe('defender');
  });

  test('积分配置默认值', () => {
    expect(DEFAULT_SCORE_CONFIG.winMinScore).toBe(30);
    expect(DEFAULT_SCORE_CONFIG.winMaxScore).toBe(60);
    expect(DEFAULT_SCORE_CONFIG.loseMinScore).toBe(15);
    expect(DEFAULT_SCORE_CONFIG.loseMaxScore).toBe(30);
  });

  test('自定义配置覆盖', () => {
    const system = new PvPBattleSystem(
      { maxTurns: 15 },
      { winMinScore: 50, winMaxScore: 80 },
    );
    expect(system.getBattleConfig().maxTurns).toBe(15);
    expect(system.getScoreConfig().winMinScore).toBe(50);
    expect(system.getScoreConfig().winMaxScore).toBe(80);
  });
});
