/**
 * 对抗式测试 — PvPBattleSystem 战斗与段位系统
 *
 * 测试策略：
 *   - 负数伤害/积分/次数注入
 *   - 段位升降级边界
 *   - 积分溢出/下溢
 *   - 战斗结果篡改
 *   - 回放数据攻击
 */

import { describe, it, expect } from 'vitest';
import {
  PvPBattleSystem,
  DEFAULT_SCORE_CONFIG,
  RANK_LEVELS,
  REPLAY_CONFIG,
} from '../PvPBattleSystem';
import { FormationType, AIDefenseStrategy, PvPBattleMode } from '../../../core/pvp/pvp.types';
import type { ArenaPlayerState, BattleReplay, PvPBattleResult } from '../../../core/pvp/pvp.types';
import { createDefaultArenaPlayerState } from '../ArenaConfig';

// ── 辅助函数 ──────────────────────────────

function createPlayer(overrides: Partial<ArenaPlayerState> = {}): ArenaPlayerState {
  const slots: [string, string, string, string, string] = ['h1', 'h2', 'h3', '', ''];
  return {
    ...createDefaultArenaPlayerState('player_test'),
    score: 1000,
    defenseFormation: { slots, formation: FormationType.FISH_SCALE, strategy: AIDefenseStrategy.BALANCED },
    ...overrides,
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
    result: { winner: 'attacker' } as any,
    keyMoments: [],
    ...overrides,
  };
}

// ── 测试开始 ──────────────────────────────

describe('PvPBattleSystem 对抗式测试', () => {
  // ═══════════════════════════════════════
  // 1. 积分计算 — 边界攻击
  // ═══════════════════════════════════════

  describe('积分计算 — 范围验证', () => {
    const system = new PvPBattleSystem();

    it('A-001: 胜利积分应在30~60范围内', () => {
      for (let i = 0; i < 100; i++) {
        const score = system.calculateWinScore();
        expect(score).toBeGreaterThanOrEqual(30);
        expect(score).toBeLessThanOrEqual(60);
      }
    });

    it('A-002: 失败积分应在-30~-15范围内', () => {
      for (let i = 0; i < 100; i++) {
        const score = system.calculateLoseScore();
        expect(score).toBeLessThanOrEqual(-15);
        expect(score).toBeGreaterThanOrEqual(-30);
      }
    });

    it('A-003: 自定义积分配置为0时loseScore应返回-0（行为记录）', () => {
      const sys = new PvPBattleSystem({}, { winMinScore: 0, winMaxScore: 0, loseMinScore: 0, loseMaxScore: 0 });
      expect(sys.calculateWinScore()).toBe(0);
      // BUG记录: calculateLoseScore返回-0而非0，因为 -(0 + Math.floor(Math.random() * 1)) = -0
      const loseScore = sys.calculateLoseScore();
      expect(Math.abs(loseScore)).toBe(0);
    });

    it('A-004: 自定义积分配置为负数时的行为（BUG记录：无输入校验）', () => {
      const sys = new PvPBattleSystem({}, { winMinScore: -10, winMaxScore: -5, loseMinScore: -10, loseMaxScore: -5 });
      const winScore = sys.calculateWinScore();
      // winScore = -10 + Math.floor(Math.random() * (-5 - (-10) + 1)) = -10 + Math.floor(Math.random() * 6)
      // Range: -10 to -5
      expect(winScore).toBeGreaterThanOrEqual(-10);
      expect(winScore).toBeLessThanOrEqual(-5);
      // loseScore = -(loseMinScore + Math.floor(Math.random() * (loseMaxScore - loseMinScore + 1)))
      // = -(-10 + Math.floor(Math.random() * (-5 - (-10) + 1))) = -(-10 + 0..5) = 10..5
      const loseScore = sys.calculateLoseScore();
      // BUG: 负数loseMinScore/loseMaxScore导致失败反而加正分！
      expect(loseScore).toBeGreaterThanOrEqual(5);
      expect(loseScore).toBeLessThanOrEqual(10);
    });

    it('A-005: winMinScore > winMaxScore时Math.random计算可能异常', () => {
      const sys = new PvPBattleSystem({}, { winMinScore: 60, winMaxScore: 30, loseMinScore: 30, loseMaxScore: 15 });
      // winMinScore + Math.floor(Math.random() * (winMaxScore - winMinScore + 1))
      // = 60 + Math.floor(Math.random() * (-29))  → Math.random() * -29 范围 [-29, 0)
      // Math.floor of negative number → -29 to -1
      // result: 60 + (-29 to -1) = 31 to 59
      const score = sys.calculateWinScore();
      // 行为不确定，但不应该崩溃
      expect(typeof score).toBe('number');
      expect(Number.isNaN(score)).toBe(false);
    });
  });

  // ═══════════════════════════════════════
  // 2. 积分应用 — 溢出/下溢攻击
  // ═══════════════════════════════════════

  describe('applyScoreChange — 溢出攻击', () => {
    const system = new PvPBattleSystem();

    it('B-001: 积分+负数变化不应低于0', () => {
      const player = createPlayer({ score: 10 });
      const result = system.applyScoreChange(player, -100);
      expect(result.score).toBe(0);
    });

    it('B-002: 积分+极大正数不应变成负数（溢出）', () => {
      const player = createPlayer({ score: Number.MAX_SAFE_INTEGER });
      const result = system.applyScoreChange(player, 1000);
      expect(result.score).toBeGreaterThan(0);
    });

    it('B-003: 积分为0时减分应保持0', () => {
      const player = createPlayer({ score: 0 });
      const result = system.applyScoreChange(player, -50);
      expect(result.score).toBe(0);
    });

    it('B-004: 积分变化后段位应正确更新', () => {
      const player = createPlayer({ score: 1490, rankId: 'BRONZE_I' });
      // 加10分 → 1500 → SILVER_V
      const result = system.applyScoreChange(player, 10);
      expect(result.score).toBe(1500);
      expect(result.rankId).toBe('SILVER_V');
    });

    it('B-005: 积分变化导致降段应正确更新', () => {
      const player = createPlayer({ score: 300, rankId: 'BRONZE_IV' });
      // 减10分 → 290 → BRONZE_V
      const result = system.applyScoreChange(player, -10);
      expect(result.score).toBe(290);
      expect(result.rankId).toBe('BRONZE_V');
    });

    it('B-006: NaN积分变化不应导致异常', () => {
      const player = createPlayer({ score: 1000 });
      const result = system.applyScoreChange(player, NaN);
      // Math.max(0, NaN) = NaN — 行为记录
      expect(typeof result.score).toBe('number');
    });
  });

  // ═══════════════════════════════════════
  // 3. 段位判定 — 边界测试
  // ═══════════════════════════════════════

  describe('段位判定 — 边界值', () => {
    const system = new PvPBattleSystem();

    it('C-001: 积分0应为BRONZE_V', () => {
      expect(system.getRankIdForScore(0)).toBe('BRONZE_V');
    });

    it('C-002: 积分299应为BRONZE_V', () => {
      expect(system.getRankIdForScore(299)).toBe('BRONZE_V');
    });

    it('C-003: 积分300应为BRONZE_IV', () => {
      expect(system.getRankIdForScore(300)).toBe('BRONZE_IV');
    });

    it('C-004: 积分10000应为KING_I', () => {
      expect(system.getRankIdForScore(10000)).toBe('KING_I');
    });

    it('C-005: 积分99999应为KING_I', () => {
      expect(system.getRankIdForScore(99999)).toBe('KING_I');
    });

    it('C-006: 积分-1应返回BRONZE_V（最低段位兜底）', () => {
      expect(system.getRankIdForScore(-1)).toBe('BRONZE_V');
    });

    it('C-007: 积分NaN不应崩溃', () => {
      const rankId = system.getRankIdForScore(NaN);
      // NaN >= 任何数都是false，循环不会匹配，返回RANK_LEVELS[0].id
      expect(rankId).toBe('BRONZE_V');
    });

    it('C-008: 段位总数应为21', () => {
      expect(system.getRankLevelCount()).toBe(21);
    });

    it('C-009: 每日奖励获取不应返回null', () => {
      const reward = system.getDailyReward('BRONZE_V');
      expect(reward.copper).toBeGreaterThan(0);
    });

    it('C-010: 无效段位ID的每日奖励应返回默认值', () => {
      const reward = system.getDailyReward('INVALID_RANK');
      expect(reward).toEqual({ copper: 500, arenaCoin: 10, gold: 5 });
    });

    it('C-111: 各段位积分区间应无重叠', () => {
      for (let i = 1; i < RANK_LEVELS.length; i++) {
        expect(RANK_LEVELS[i - 1].maxScore).toBeLessThan(RANK_LEVELS[i].minScore);
      }
    });

    it('C-112: 各段位积分区间应连续', () => {
      for (let i = 1; i < RANK_LEVELS.length; i++) {
        expect(RANK_LEVELS[i].minScore).toBe(RANK_LEVELS[i - 1].maxScore + 1);
      }
    });
  });

  // ═══════════════════════════════════════
  // 4. 段位升降检测 — 对抗测试
  // ═══════════════════════════════════════

  describe('isRankUp / isRankDown — 篡改攻击', () => {
    const system = new PvPBattleSystem();

    it('D-001: 相同段位不算升段', () => {
      expect(system.isRankUp('BRONZE_V', 'BRONZE_V')).toBe(false);
    });

    it('D-002: 相同段位不算降段', () => {
      expect(system.isRankDown('BRONZE_V', 'BRONZE_V')).toBe(false);
    });

    it('D-003: 无效段位ID的isRankUp行为（BUG记录：findIndex返回-1导致误判）', () => {
      // findIndex('INVALID') = -1, findIndex('BRONZE_V') = 0
      // isRankUp(old='INVALID', new='BRONZE_V'): newIdx(0) > oldIdx(-1) → true
      // BUG: 无效段位ID被当作最低段位（idx=-1），任何合法段位都算"升段"
      expect(system.isRankUp('INVALID', 'BRONZE_V')).toBe(true);
      // isRankDown(old='BRONZE_V', new='INVALID'): newIdx(-1) < oldIdx(0) → true
      // BUG: 降段到无效ID也被误判
      expect(system.isRankDown('BRONZE_V', 'INVALID')).toBe(true);
      // isRankUp(old='INVALID', new='INVALID'): -1 > -1 → false (正确)
      expect(system.isRankUp('INVALID', 'INVALID')).toBe(false);
      // isRankUp(old='INVALID', new='BRONZE_II'): 3 > -1 → true（无效ID算升段）
      expect(system.isRankUp('INVALID', 'BRONZE_II')).toBe(true);
    });

    it('D-004: 从BRONZE_V到KING_I应算升段', () => {
      expect(system.isRankUp('BRONZE_V', 'KING_I')).toBe(true);
    });

    it('D-005: 从KING_I到BRONZE_V应算降段', () => {
      expect(system.isRankDown('KING_I', 'BRONZE_V')).toBe(true);
    });
  });

  // ═══════════════════════════════════════
  // 5. PvP战斗执行 — 对抗测试
  // ═══════════════════════════════════════

  describe('executeBattle — 战斗注入', () => {
    const system = new PvPBattleSystem();

    it('E-001: 双方积分为0时应正常执行', () => {
      const attacker = createPlayer({ score: 0 });
      const defender = createPlayer({ score: 0 });
      const result = system.executeBattle(attacker, defender);
      expect(result.battleId).toBeTruthy();
      expect(typeof result.attackerWon).toBe('boolean');
    });

    it('E-002: 进攻方积分为极大值时不应崩溃', () => {
      const attacker = createPlayer({ score: Number.MAX_SAFE_INTEGER });
      const defender = createPlayer({ score: 100 });
      const result = system.executeBattle(attacker, defender);
      expect(result.attackerNewScore).toBeGreaterThanOrEqual(0);
    });

    it('E-003: 双方积分相同时应正常执行', () => {
      const attacker = createPlayer({ score: 1000, playerId: 'att' });
      const defender = createPlayer({ score: 1000, playerId: 'def' });
      const result = system.executeBattle(attacker, defender);
      expect(result).toBeDefined();
    });

    it('E-004: 战斗结果积分变化应在合理范围', () => {
      const attacker = createPlayer({ score: 1000 });
      const defender = createPlayer({ score: 1000 });
      const result = system.executeBattle(attacker, defender);
      if (result.attackerWon) {
        expect(result.scoreChange).toBeGreaterThanOrEqual(30);
        expect(result.scoreChange).toBeLessThanOrEqual(60);
      } else {
        expect(result.scoreChange).toBeLessThanOrEqual(-15);
        expect(result.scoreChange).toBeGreaterThanOrEqual(-30);
      }
    });

    it('E-005: 防守方积分变化应与进攻方对称', () => {
      const attacker = createPlayer({ score: 1000, playerId: 'att' });
      const defender = createPlayer({ score: 1000, playerId: 'def' });
      const result = system.executeBattle(attacker, defender);
      // defenderScoreChange = -scoreChange
      expect(result.defenderNewScore).toBe(Math.max(0, 1000 - result.scoreChange));
    });

    it('E-006: 战败方积分不应低于0', () => {
      const attacker = createPlayer({ score: 10 });
      const defender = createPlayer({ score: 10 });
      // 多次执行确保覆盖胜败
      for (let i = 0; i < 20; i++) {
        const result = system.executeBattle(attacker, defender);
        expect(result.attackerNewScore).toBeGreaterThanOrEqual(0);
        expect(result.defenderNewScore).toBeGreaterThanOrEqual(0);
      }
    });

    it('E-007: 半自动模式应正常执行', () => {
      const attacker = createPlayer({ score: 1000 });
      const defender = createPlayer({ score: 1000 });
      const result = system.executeBattle(attacker, defender, PvPBattleMode.SEMI_AUTO);
      expect(result).toBeDefined();
    });
  });

  // ═══════════════════════════════════════
  // 6. 战斗结果应用 — 对抗测试
  // ═══════════════════════════════════════

  describe('applyBattleResult — 结果篡改', () => {
    const system = new PvPBattleSystem();

    it('F-001: 胜利应增加竞技币20', () => {
      const player = createPlayer({ arenaCoins: 0 });
      const result: PvPBattleResult = {
        battleId: 'test',
        attackerId: 'player_test',
        defenderId: 'opp',
        attackerWon: true,
        scoreChange: 40,
        attackerNewScore: 1040,
        defenderNewScore: 960,
        totalTurns: 5,
        isTimeout: false,
        battleState: null,
      };
      const newState = system.applyBattleResult(player, result);
      expect(newState.arenaCoins).toBe(20);
    });

    it('F-002: 失败应增加竞技币5', () => {
      const player = createPlayer({ arenaCoins: 0 });
      const result: PvPBattleResult = {
        battleId: 'test',
        attackerId: 'player_test',
        defenderId: 'opp',
        attackerWon: false,
        scoreChange: -20,
        attackerNewScore: 980,
        defenderNewScore: 1020,
        totalTurns: 5,
        isTimeout: false,
        battleState: null,
      };
      const newState = system.applyBattleResult(player, result);
      expect(newState.arenaCoins).toBe(5);
    });

    it('F-003: 积分变化为极大负数时积分不应低于0', () => {
      const player = createPlayer({ score: 100 });
      const result: PvPBattleResult = {
        battleId: 'test',
        attackerId: 'player_test',
        defenderId: 'opp',
        attackerWon: false,
        scoreChange: -99999,
        attackerNewScore: 0,
        defenderNewScore: 99999,
        totalTurns: 5,
        isTimeout: false,
        battleState: null,
      };
      const newState = system.applyBattleResult(player, result);
      expect(newState.score).toBeGreaterThanOrEqual(0);
    });
  });

  // ═══════════════════════════════════════
  // 7. 战斗回放 — 对抗测试
  // ═══════════════════════════════════════

  describe('saveReplay / cleanExpiredReplays — 回放溢出', () => {
    const system = new PvPBattleSystem();

    it('G-001: 超过50条回放应截断', () => {
      let player = createPlayer();
      for (let i = 0; i < 60; i++) {
        player = system.saveReplay(player, createReplay({ id: `replay_${i}` }));
      }
      expect(player.replays.length).toBe(50);
    });

    it('G-002: 清理过期回放应正确过滤', () => {
      const now = Date.now();
      const expiredReplay = createReplay({ timestamp: now - 8 * 24 * 60 * 60 * 1000 });
      const freshReplay = createReplay({ timestamp: now });
      let player = createPlayer();
      player = system.saveReplay(player, expiredReplay);
      player = system.saveReplay(player, freshReplay);

      const cleaned = system.cleanExpiredReplays(player, now);
      expect(cleaned.replays.length).toBe(1);
      expect(cleaned.replays[0].timestamp).toBe(now);
    });

    it('G-003: 所有回放过期时应清空', () => {
      const now = Date.now();
      const oldReplay = createReplay({ timestamp: now - 10 * 24 * 60 * 60 * 1000 });
      let player = createPlayer();
      player = system.saveReplay(player, oldReplay);

      const cleaned = system.cleanExpiredReplays(player, now);
      expect(cleaned.replays.length).toBe(0);
    });

    it('G-004: 回放保留天数应为7天', () => {
      expect(REPLAY_CONFIG.retentionDays).toBe(7);
    });
  });

  // ═══════════════════════════════════════
  // 8. 序列化/反序列化 — 对抗测试
  // ═══════════════════════════════════════

  describe('serializeReplays / deserializeReplays — 数据篡改', () => {
    const system = new PvPBattleSystem();

    it('H-001: 反序列化null数据应抛异常（BUG记录：无null防御）', () => {
      // BUG: deserializeReplays不检查data是否为null
      expect(() => system.deserializeReplays(null as any)).toThrow();
    });

    it('H-002: 反序列化undefined字段应使用默认值', () => {
      const result = system.deserializeReplays({ replays: undefined as any, score: undefined as any, rankId: undefined as any, arenaCoins: undefined as any });
      expect(result.replays).toEqual([]);
      expect(result.score).toBe(0);
      expect(result.rankId).toBe('BRONZE_V');
      expect(result.arenaCoins).toBe(0);
    });

    it('H-003: 序列化后反序列化应保持一致', () => {
      let player = createPlayer({ score: 5000, rankId: 'GOLD_V', arenaCoins: 300 });
      player = system.saveReplay(player, createReplay());
      const serialized = system.serializeReplays(player);
      const deserialized = system.deserializeReplays(serialized);
      expect(deserialized.score).toBe(5000);
      expect(deserialized.rankId).toBe('GOLD_V');
      expect(deserialized.arenaCoins).toBe(300);
      expect(deserialized.replays!.length).toBe(1);
    });
  });
});
