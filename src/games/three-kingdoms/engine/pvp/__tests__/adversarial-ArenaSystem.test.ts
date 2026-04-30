/**
 * 对抗式测试 — ArenaSystem 竞技场匹配系统
 *
 * 测试策略：通过恶意/边界/异常输入尝试击穿系统防御
 * 覆盖维度：
 *   - 负数/零值/极大值注入
 *   - 状态机非法转换
 *   - 并发/竞态条件模拟
 *   - 跨系统交互边界
 *   - 溢出与精度攻击
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ArenaSystem } from '../ArenaSystem';
import { createDefaultArenaPlayerState } from '../ArenaConfig';
import { FormationType, AIDefenseStrategy } from '../../../core/pvp/pvp.types';
import type { ArenaPlayerState, ArenaOpponent } from '../../../core/pvp/pvp.types';

// ── 辅助函数 ──────────────────────────────

function createPlayer(overrides: Partial<ArenaPlayerState> = {}): ArenaPlayerState {
  return { ...createDefaultArenaPlayerState('player_1'), ...overrides };
}

function createOpponent(overrides: Partial<ArenaOpponent> = {}): ArenaOpponent {
  return {
    playerId: 'opp_1',
    playerName: '对手1',
    power: 5000,
    rankId: 'BRONZE_V',
    score: 0,
    ranking: 100,
    faction: 'shu',
    defenseSnapshot: null,
    ...overrides,
  };
}

function createOpponents(count: number, basePower = 5000): ArenaOpponent[] {
  return Array.from({ length: count }, (_, i) =>
    createOpponent({
      playerId: `opp_${i}`,
      playerName: `对手${i}`,
      power: basePower + i * 100,
      ranking: 100 + i,
      score: i * 100,
      faction: ['shu', 'wei', 'wu'][i % 3],
    }),
  );
}

// ── 测试开始 ──────────────────────────────

describe('ArenaSystem 对抗式测试', () => {
  let system: ArenaSystem;

  beforeEach(() => {
    system = new ArenaSystem();
  });

  // ═══════════════════════════════════════
  // 1. 匹配与对手选择 — 对抗测试
  // ═══════════════════════════════════════

  describe('generateOpponents — 恶意输入', () => {
    it('A-001: 空对手池应返回空数组', () => {
      const player = createPlayer({ score: 500, ranking: 100 });
      const result = system.generateOpponents(player, []);
      expect(result).toEqual([]);
    });

    it('A-002: 玩家积分为负数时不应崩溃', () => {
      const player = createPlayer({ score: -999, ranking: 100 });
      const opponents = createOpponents(10);
      // 不应抛异常
      const result = system.generateOpponents(player, opponents);
      expect(Array.isArray(result)).toBe(true);
    });

    it('A-003: 玩家排名为0时应正常匹配', () => {
      const player = createPlayer({ score: 500, ranking: 0 });
      const opponents = createOpponents(20, 5000);
      const result = system.generateOpponents(player, opponents);
      expect(result.length).toBeLessThanOrEqual(3);
    });

    it('A-004: 玩家排名为极大值时应正常匹配', () => {
      const player = createPlayer({ score: 500, ranking: Number.MAX_SAFE_INTEGER });
      const opponents = createOpponents(20, 5000);
      const result = system.generateOpponents(player, opponents);
      expect(Array.isArray(result)).toBe(true);
    });

    it('A-005: 对手战力为负数/0时应被过滤', () => {
      const player = createPlayer({ score: 500, ranking: 100 });
      const badOpponents = [
        createOpponent({ power: -1000, ranking: 100 }),
        createOpponent({ power: 0, ranking: 100 }),
        createOpponent({ power: NaN, ranking: 100 }),
      ];
      const result = system.generateOpponents(player, badOpponents);
      // NaN/负数应被战力范围过滤掉
      expect(result.length).toBeLessThanOrEqual(3);
    });

    it('A-006: 对手排名为负数/NaN时应被过滤', () => {
      const player = createPlayer({ score: 500, ranking: 100 });
      const badOpponents = [
        createOpponent({ power: 5000, ranking: -100 }),
        createOpponent({ power: 5000, ranking: NaN }),
      ];
      const result = system.generateOpponents(player, badOpponents);
      expect(result.length).toBe(0);
    });

    it('A-007: candidateCount为0时配置应返回空', () => {
      const sys = new ArenaSystem({ candidateCount: 0 });
      const player = createPlayer({ score: 500, ranking: 100 });
      const opponents = createOpponents(20);
      const result = sys.generateOpponents(player, opponents);
      expect(result.length).toBe(0);
    });

    it('A-008: 候选数量大于可用对手数时不应越界', () => {
      const player = createPlayer({ score: 500, ranking: 100 });
      const opponents = [createOpponent({ power: 5000, ranking: 100 })];
      const result = system.generateOpponents(player, opponents);
      expect(result.length).toBeLessThanOrEqual(1);
    });

    it('A-009: 所有对手战力远超范围时应返回空', () => {
      const player = createPlayer({ score: 0, ranking: 100 }); // power ~ 5000
      const strongOpponents = createOpponents(20, 99999);
      const result = system.generateOpponents(player, strongOpponents);
      expect(result.length).toBe(0);
    });
  });

  // ═══════════════════════════════════════
  // 2. 免费刷新 — 对抗测试
  // ═══════════════════════════════════════

  describe('freeRefresh — 冷却与时间攻击', () => {
    it('B-001: 冷却中刷新应抛出异常', () => {
      const now = 1000000;
      const player = createPlayer({ lastFreeRefreshTime: now });
      const opponents = createOpponents(10);

      expect(() => system.freeRefresh(player, opponents, now)).toThrow('免费刷新冷却中');
    });

    it('B-002: now为负数时，如果elapsed >= interval应允许刷新', () => {
      // 需要elapsed >= 30*60*1000 = 1800000
      // lastFreeRefreshTime = -2000000, now = -100
      // elapsed = -100 - (-2000000) = 1999900 > 1800000 → 应允许
      const player = createPlayer({ lastFreeRefreshTime: -2000000 });
      const opponents = createOpponents(10);
      const result = system.freeRefresh(player, opponents, -100);
      expect(result.lastFreeRefreshTime).toBe(-100);
    });

    it('B-002b: now为负数且lastFreeRefreshTime=0时应阻止刷新', () => {
      // elapsed = -100 - 0 = -100 < 30min → 冷却中
      const player = createPlayer({ lastFreeRefreshTime: 0 });
      const opponents = createOpponents(10);
      expect(() => system.freeRefresh(player, opponents, -100)).toThrow('免费刷新冷却中');
    });

    it('B-003: lastFreeRefreshTime为未来时间时应阻止刷新', () => {
      const now = 1000;
      const player = createPlayer({ lastFreeRefreshTime: 999999999 });
      const opponents = createOpponents(10);
      expect(() => system.freeRefresh(player, opponents, now)).toThrow();
    });

    it('B-004: 刚好到达冷却时间应允许刷新', () => {
      const interval = 30 * 60 * 1000;
      const baseTime = 1000000;
      const player = createPlayer({ lastFreeRefreshTime: baseTime });
      const opponents = createOpponents(10);

      const result = system.freeRefresh(player, opponents, baseTime + interval);
      expect(result.lastFreeRefreshTime).toBe(baseTime + interval);
    });

    it('B-005: canFreeRefresh在恰好冷却完成时应返回true', () => {
      const interval = 30 * 60 * 1000;
      const baseTime = 1000000;
      const player = createPlayer({ lastFreeRefreshTime: baseTime });
      expect(system.canFreeRefresh(player, baseTime + interval)).toBe(true);
    });
  });

  // ═══════════════════════════════════════
  // 3. 手动刷新 — 对抗测试
  // ═══════════════════════════════════════

  describe('manualRefresh — 次数限制攻击', () => {
    it('C-001: 超过每日上限应抛异常', () => {
      const player = createPlayer({ dailyManualRefreshes: 10 });
      const opponents = createOpponents(10);
      expect(() => system.manualRefresh(player, opponents, Date.now())).toThrow('今日手动刷新次数已达上限');
    });

    it('C-002: dailyManualRefreshes为负数时应允许刷新', () => {
      const player = createPlayer({ dailyManualRefreshes: -1 });
      const opponents = createOpponents(10);
      // 负数 < 10，不应抛异常
      const result = system.manualRefresh(player, opponents, Date.now());
      expect(result.state.dailyManualRefreshes).toBe(0);
    });

    it('C-003: 连续刷新10次后应被阻止', () => {
      let player = createPlayer();
      const opponents = createOpponents(10);
      const now = Date.now();

      for (let i = 0; i < 10; i++) {
        const result = system.manualRefresh(player, opponents, now);
        player = result.state;
      }

      expect(() => system.manualRefresh(player, opponents, now)).toThrow();
    });

    it('C-004: 返回的cost应为正数', () => {
      const player = createPlayer();
      const opponents = createOpponents(10);
      const result = system.manualRefresh(player, opponents, Date.now());
      expect(result.cost).toBeGreaterThan(0);
    });
  });

  // ═══════════════════════════════════════
  // 4. 挑战次数 — 对抗测试
  // ═══════════════════════════════════════

  describe('挑战次数 — 负数/溢出攻击', () => {
    it('D-001: 挑战次数为0时不能挑战', () => {
      const player = createPlayer({ dailyChallengesLeft: 0 });
      expect(system.canChallenge(player)).toBe(false);
    });

    it('D-002: 挑战次数为负数时不能挑战', () => {
      const player = createPlayer({ dailyChallengesLeft: -5 });
      expect(system.canChallenge(player)).toBe(false);
    });

    it('D-003: 消耗挑战次数为0时应抛异常', () => {
      const player = createPlayer({ dailyChallengesLeft: 0 });
      expect(() => system.consumeChallenge(player)).toThrow('今日挑战次数已用完');
    });

    it('D-004: 消耗挑战次数为负数时应抛异常', () => {
      const player = createPlayer({ dailyChallengesLeft: -1 });
      expect(() => system.consumeChallenge(player)).toThrow();
    });

    it('D-005: 正常消耗后次数应减1', () => {
      const player = createPlayer({ dailyChallengesLeft: 5 });
      const result = system.consumeChallenge(player);
      expect(result.dailyChallengesLeft).toBe(4);
    });

    it('D-006: 购买次数达到上限后应抛异常', () => {
      const player = createPlayer({ dailyBoughtChallenges: 5 });
      expect(() => system.buyChallenge(player)).toThrow('今日购买次数已达上限');
    });

    it('D-007: dailyBoughtChallenges为负数时应允许购买', () => {
      const player = createPlayer({ dailyBoughtChallenges: -1 });
      const result = system.buyChallenge(player);
      expect(result.state.dailyBoughtChallenges).toBe(0);
      expect(result.state.dailyChallengesLeft).toBe(6); // 5 + 1
    });

    it('D-008: 连续购买5次后应被阻止', () => {
      let player = createPlayer({ dailyChallengesLeft: 0 });
      for (let i = 0; i < 5; i++) {
        const result = system.buyChallenge(player);
        player = result.state;
      }
      expect(() => system.buyChallenge(player)).toThrow();
    });

    it('D-009: 购买后挑战次数应增加', () => {
      const player = createPlayer({ dailyChallengesLeft: 0, dailyBoughtChallenges: 0 });
      const result = system.buyChallenge(player);
      expect(result.state.dailyChallengesLeft).toBe(1);
      expect(result.state.dailyBoughtChallenges).toBe(1);
      expect(result.cost).toBe(50);
    });

    it('D-010: 购买挑战的cost应为正数', () => {
      const player = createPlayer();
      const result = system.buyChallenge(player);
      expect(result.cost).toBeGreaterThan(0);
    });
  });

  // ═══════════════════════════════════════
  // 5. 每日重置 — 对抗测试
  // ═══════════════════════════════════════

  describe('dailyReset — 状态清理', () => {
    it('E-001: 重置后挑战次数应恢复为默认值', () => {
      const player = createPlayer({ dailyChallengesLeft: 0, dailyBoughtChallenges: 5, dailyManualRefreshes: 10 });
      const result = system.dailyReset(player);
      expect(result.dailyChallengesLeft).toBe(5);
      expect(result.dailyBoughtChallenges).toBe(0);
      expect(result.dailyManualRefreshes).toBe(0);
    });

    it('E-002: 重置后对手列表应清空', () => {
      const opponents = createOpponents(3);
      const player = createPlayer({ opponents });
      const result = system.dailyReset(player);
      expect(result.opponents).toEqual([]);
    });

    it('E-003: 重置不应影响积分和段位', () => {
      const player = createPlayer({ score: 5000, rankId: 'GOLD_V' });
      const result = system.dailyReset(player);
      expect(result.score).toBe(5000);
      expect(result.rankId).toBe('GOLD_V');
    });
  });

  // ═══════════════════════════════════════
  // 6. 防守阵容 — 对抗测试
  // ═══════════════════════════════════════

  describe('updateDefenseFormation — 阵容注入攻击', () => {
    it('F-001: 空阵容（全部空字符串）应抛异常', () => {
      const player = createPlayer();
      expect(() =>
        system.updateDefenseFormation(player, ['', '', '', '', ''], FormationType.FISH_SCALE, AIDefenseStrategy.BALANCED),
      ).toThrow('至少需要1名武将');
    });

    it('F-002: 重复武将ID应被接受（当前无去重校验）', () => {
      const player = createPlayer();
      // 当前实现不过滤重复武将，记录行为
      const result = system.updateDefenseFormation(
        player,
        ['hero_1', 'hero_1', 'hero_1', '', ''],
        FormationType.FISH_SCALE,
        AIDefenseStrategy.BALANCED,
      );
      expect(result.defenseFormation.slots).toEqual(['hero_1', 'hero_1', 'hero_1', '', '']);
    });

    it('F-003: 正常1名武将应成功', () => {
      const player = createPlayer();
      const result = system.updateDefenseFormation(
        player,
        ['hero_1', '', '', '', ''],
        FormationType.WEDGE,
        AIDefenseStrategy.AGGRESSIVE,
      );
      expect(result.defenseFormation.formation).toBe(FormationType.WEDGE);
      expect(result.defenseFormation.strategy).toBe(AIDefenseStrategy.AGGRESSIVE);
    });

    it('F-004: 满5名武将应成功', () => {
      const player = createPlayer();
      const result = system.updateDefenseFormation(
        player,
        ['h1', 'h2', 'h3', 'h4', 'h5'],
        FormationType.SQUARE,
        AIDefenseStrategy.CUNNING,
      );
      expect(result.defenseFormation.slots.filter(s => s !== '').length).toBe(5);
    });
  });

  // ═══════════════════════════════════════
  // 7. 防守日志 — 对抗测试
  // ═══════════════════════════════════════

  describe('addDefenseLog / getDefenseStats — 日志溢出', () => {
    it('G-001: 日志超过50条时应截断', () => {
      let player = createPlayer();
      const now = Date.now();
      for (let i = 0; i < 60; i++) {
        player = system.addDefenseLog(player, {
          attackerId: `att_${i}`,
          attackerName: `攻击者${i}`,
          defenderWon: i % 2 === 0,
          turns: 5,
          attackerRank: 'BRONZE_V',
        }, now);
      }
      expect(player.defenseLogs.length).toBe(50);
    });

    it('G-002: 空日志统计应返回全0', () => {
      const player = createPlayer();
      const stats = system.getDefenseStats(player);
      expect(stats.totalDefenses).toBe(0);
      expect(stats.wins).toBe(0);
      expect(stats.losses).toBe(0);
      expect(stats.winRate).toBe(0);
      expect(stats.suggestedStrategy).toBeNull();
    });

    it('G-003: 胜率低于30%且>=5场应建议坚守策略', () => {
      let player = createPlayer();
      const now = Date.now();
      // 1胜4负 = 20%胜率
      for (let i = 0; i < 5; i++) {
        player = system.addDefenseLog(player, {
          attackerId: `att_${i}`,
          attackerName: `攻击者${i}`,
          defenderWon: i === 0,
          turns: 5,
          attackerRank: 'BRONZE_V',
        }, now);
      }
      const stats = system.getDefenseStats(player);
      expect(stats.winRate).toBeLessThan(0.3);
      expect(stats.suggestedStrategy).toBe(AIDefenseStrategy.DEFENSIVE);
    });

    it('G-004: 胜率30%~50%且>=5场应建议均衡策略', () => {
      let player = createPlayer();
      const now = Date.now();
      // 2胜3负 = 40%胜率
      for (let i = 0; i < 5; i++) {
        player = system.addDefenseLog(player, {
          attackerId: `att_${i}`,
          attackerName: `攻击者${i}`,
          defenderWon: i < 2,
          turns: 5,
          attackerRank: 'BRONZE_V',
        }, now);
      }
      const stats = system.getDefenseStats(player);
      expect(stats.winRate).toBeGreaterThanOrEqual(0.3);
      expect(stats.winRate).toBeLessThan(0.5);
      expect(stats.suggestedStrategy).toBe(AIDefenseStrategy.BALANCED);
    });
  });

  // ═══════════════════════════════════════
  // 8. 序列化/反序列化 — 对抗测试
  // ═══════════════════════════════════════

  describe('serialize / deserialize — 存档篡改攻击', () => {
    it('H-001: 版本不匹配应返回默认状态', () => {
      const result = system.deserialize({ version: 999, state: createPlayer({ score: 99999 }), season: { seasonId: '', startTime: 0, endTime: 0, currentDay: 1, isSettled: false }, highestRankId: 'KING_I' });
      expect(result.score).toBe(0);
      expect(result.rankId).toBe('BRONZE_V');
    });

    it('H-002: null数据应返回默认状态', () => {
      const result = system.deserialize(null as any);
      expect(result.score).toBe(0);
    });

    it('H-003: undefined数据应返回默认状态', () => {
      const result = system.deserialize(undefined as any);
      expect(result.score).toBe(0);
    });

    it('H-004: 序列化后反序列化应保持一致', () => {
      const player = createPlayer({ score: 3000, rankId: 'SILVER_V' });
      const serialized = system.serialize(player);
      const deserialized = system.deserialize(serialized);
      expect(deserialized.score).toBe(3000);
      expect(deserialized.rankId).toBe('SILVER_V');
    });
  });

  // ═══════════════════════════════════════
  // 9. 玩家池管理 — 对抗测试
  // ═══════════════════════════════════════

  describe('registerPlayer / getAllPlayers — 池污染攻击', () => {
    it('I-001: 注册大量玩家不应崩溃', () => {
      for (let i = 0; i < 10000; i++) {
        system.registerPlayer(createOpponent({ playerId: `opp_${i}` }));
      }
      expect(system.getAllPlayers().length).toBe(10000);
    });

    it('I-002: 相同playerId重复注册应覆盖', () => {
      system.registerPlayer(createOpponent({ playerId: 'dup', power: 1000 }));
      system.registerPlayer(createOpponent({ playerId: 'dup', power: 2000 }));
      const players = system.getAllPlayers();
      expect(players.length).toBe(1);
      expect(players[0].power).toBe(2000);
    });

    it('I-003: reset后玩家池应清空', () => {
      system.registerPlayer(createOpponent());
      system.reset();
      expect(system.getAllPlayers().length).toBe(0);
    });
  });

  // ═══════════════════════════════════════
  // 10. 自定义配置注入 — 对抗测试
  // ═══════════════════════════════════════

  describe('自定义配置 — 极端配置注入', () => {
    it('J-001: powerMinRatio > powerMaxRatio时应返回空', () => {
      const sys = new ArenaSystem({ powerMinRatio: 2.0, powerMaxRatio: 0.5 });
      const player = createPlayer({ score: 500, ranking: 100 });
      const opponents = createOpponents(20);
      const result = sys.generateOpponents(player, opponents);
      expect(result.length).toBe(0);
    });

    it('J-002: candidateCount为极大值时不应崩溃', () => {
      const sys = new ArenaSystem({ candidateCount: 999999 });
      const player = createPlayer({ score: 500, ranking: 100 });
      const opponents = createOpponents(20);
      const result = sys.generateOpponents(player, opponents);
      expect(result.length).toBeLessThanOrEqual(20);
    });

    it('J-003: 刷新间隔为0时应始终允许免费刷新', () => {
      const sys = new ArenaSystem({}, { freeIntervalMs: 0 });
      const player = createPlayer({ lastFreeRefreshTime: Date.now() });
      expect(sys.canFreeRefresh(player, Date.now())).toBe(true);
    });

    it('J-004: 手动刷新上限为0时应立即阻止', () => {
      const sys = new ArenaSystem({}, { dailyManualLimit: 0 });
      const player = createPlayer();
      const opponents = createOpponents(10);
      expect(() => sys.manualRefresh(player, opponents, Date.now())).toThrow();
    });

    it('J-005: 购买上限为0时应立即阻止购买', () => {
      const sys = new ArenaSystem({}, {}, { dailyBuyLimit: 0 });
      const player = createPlayer();
      expect(() => sys.buyChallenge(player)).toThrow();
    });
  });
});
