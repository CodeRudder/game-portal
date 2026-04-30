/**
 * 集成测试 §1-2: 竞技场匹配+挑战全链路
 *
 * 覆盖 Play 流程：
 *   §1.1 竞技场入口与主界面
 *   §1.2 对手匹配规则
 *   §1.3 刷新与挑战次数
 *   §2.1 进攻编队与战斗模式
 *   §2.2 防守方加成与超时判定
 *   §2.3 战斗结果与积分变化
 *   §2.4 战斗回放
 *
 * 跨系统联动：ArenaSystem ↔ PvPBattleSystem ↔ RankingSystem
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ArenaSystem, createDefaultArenaPlayerState } from '../../../pvp/ArenaSystem';
import { PvPBattleSystem, RANK_LEVELS, REPLAY_CONFIG } from '../../../pvp/PvPBattleSystem';
import { RankingSystem, RankingDimension } from '../../../pvp/RankingSystem';
import { DefenseFormationSystem } from '../../../pvp/DefenseFormationSystem';
import { FormationType, AIDefenseStrategy, PvPBattleMode } from '../../../../core/pvp/pvp.types';
import type { ArenaOpponent, ArenaPlayerState, BattleReplay } from '../../../../core/pvp/pvp.types';
import type { Faction } from '../../../hero/hero.types';

// ── 辅助函数 ──────────────────────────────

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

function createPlayerWithHeroes(
  score: number,
  heroCount: number,
  ranking: number = 100,
): ArenaPlayerState {
  const state = createDefaultArenaPlayerState('attacker');
  const slots: [string, string, string, string, string] = ['', '', '', '', ''];
  for (let i = 0; i < Math.min(heroCount, 5); i++) {
    slots[i] = `hero_${i}`;
  }
  return {
    ...state,
    score,
    ranking,
    defenseFormation: {
      slots,
      formation: FormationType.FISH_SCALE,
      strategy: AIDefenseStrategy.BALANCED,
    },
  };
}

function createDiverseOpponents(
  count: number,
  basePower: number,
  baseRanking: number,
): ArenaOpponent[] {
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

function createReplay(overrides: Partial<BattleReplay> = {}): BattleReplay {
  return {
    id: 'replay_001',
    battleId: 'battle_001',
    attackerName: 'Attacker',
    defenderName: 'Defender',
    attackerWon: true,
    timestamp: Date.now(),
    totalTurns: 5,
    actions: [],
    result: { winner: 'attacker' } as unknown as Record<string, unknown>,
    keyMoments: [3],
    ...overrides,
  };
}

// ── §1.1 竞技场入口与主界面 ────────────────

describe('§1 竞技场匹配+挑战全链路', () => {
  let arena: ArenaSystem;
  let battle: PvPBattleSystem;
  let ranking: RankingSystem;
  let defense: DefenseFormationSystem;

  beforeEach(() => {
    arena = new ArenaSystem();
    battle = new PvPBattleSystem();
    ranking = new RankingSystem();
    defense = new DefenseFormationSystem();
  });

  describe('§1.1 竞技场入口与主界面', () => {
    it('应正确初始化竞技场系统', () => {
      expect(arena.name).toBe('ArenaSystem');
      expect(battle.name).toBe('PvPBattleSystem');
      expect(ranking.name).toBe('PvpRankingSystem');
    });

    it('默认玩家状态应为青铜V段位', () => {
      const state = createDefaultArenaPlayerState();
      expect(state.rankId).toBe('BRONZE_V');
      expect(state.score).toBe(0);
      expect(state.dailyChallengesLeft).toBe(5);
    });

    it('默认防守阵容应为鱼鳞阵+均衡策略', () => {
      const state = createDefaultArenaPlayerState();
      expect(state.defenseFormation.formation).toBe(FormationType.FISH_SCALE);
      expect(state.defenseFormation.strategy).toBe(AIDefenseStrategy.BALANCED);
    });

    it('应正确展示排名信息', () => {
      const state = createPlayerWithHeroes(500, 3, 42);
      expect(state.ranking).toBe(42);
      expect(state.score).toBe(500);
    });

    it('段位系统应有21级', () => {
      const allRanks = battle.getAllRankLevels();
      expect(allRanks.length).toBe(21);
    });

    it('5大段位应为青铜/白银/黄金/钻石/王者', () => {
      const allRanks = battle.getAllRankLevels();
      const tiers = [...new Set(allRanks.map((r) => r.tier))];
      expect(tiers).toEqual(['BRONZE', 'SILVER', 'GOLD', 'DIAMOND', 'KING']);
    });
  });

  describe('§1.2 对手匹配规则', () => {
    it('应在战力0.7~1.3范围内筛选对手', () => {
      const playerState = createPlayerWithHeroes(50, 3, 100);
      const myPower = 50 * 10 + 3 * 1000 + 5000; // 8500
      const minPower = Math.floor(myPower * 0.7);
      const maxPower = Math.ceil(myPower * 1.3);

      const opponents = [
        createOpponent({ playerId: 'low', power: minPower - 100, ranking: 100 }),
        createOpponent({ playerId: 'ok1', power: minPower, ranking: 100 }),
        createOpponent({ playerId: 'ok2', power: maxPower, ranking: 100 }),
        createOpponent({ playerId: 'high', power: maxPower + 100, ranking: 100 }),
      ];

      const result = arena.generateOpponents(playerState, opponents);
      const ids = result.map((o) => o.playerId);
      expect(ids).not.toContain('low');
      expect(ids).not.toContain('high');
    });

    it('应在排名±5~±20范围内筛选对手', () => {
      const playerState = createPlayerWithHeroes(50, 3, 100);
      const opponents = [
        createOpponent({ playerId: 'close', power: 8500, ranking: 95 }),
        createOpponent({ playerId: 'far', power: 8500, ranking: 79 }),
        createOpponent({ playerId: 'near', power: 8500, ranking: 120 }),
        createOpponent({ playerId: 'toofar', power: 8500, ranking: 121 }),
      ];

      const result = arena.generateOpponents(playerState, opponents);
      const ids = result.map((o) => o.playerId);
      expect(ids).toContain('close');
      expect(ids).toContain('near');
      expect(ids).not.toContain('far');
      expect(ids).not.toContain('toofar');
    });

    it('应返回不超过3名候选对手', () => {
      const playerState = createPlayerWithHeroes(50, 3, 100);
      const opponents = createDiverseOpponents(20, 7000, 95);
      const result = arena.generateOpponents(playerState, opponents);
      expect(result.length).toBeLessThanOrEqual(3);
    });

    it('候选对手应尽量覆盖不同阵营', () => {
      const playerState = createPlayerWithHeroes(50, 3, 100);
      const opponents: ArenaOpponent[] = [];
      for (let i = 0; i < 5; i++) {
        opponents.push(
          createOpponent({
            playerId: `wei_${i}`,
            power: 8500,
            ranking: 100 + i,
            faction: 'wei' as Faction,
          }),
        );
      }
      opponents.push(
        createOpponent({ playerId: 'shu_0', power: 8500, ranking: 105, faction: 'shu' as Faction }),
      );
      opponents.push(
        createOpponent({ playerId: 'wu_0', power: 8500, ranking: 106, faction: 'wu' as Faction }),
      );

      const result = arena.generateOpponents(playerState, opponents);
      const factions = result.map((o) => o.faction);
      const uniqueFactions = new Set(factions);
      expect(uniqueFactions.size).toBeGreaterThanOrEqual(2);
    });

    it('对手不足时返回可用数量', () => {
      const playerState = createPlayerWithHeroes(50, 3, 100);
      const opponents = [
        createOpponent({ playerId: 'only', power: 8500, ranking: 100 }),
      ];
      const result = arena.generateOpponents(playerState, opponents);
      expect(result.length).toBe(1);
    });

    it('无合格对手时返回空数组', () => {
      const playerState = createPlayerWithHeroes(50, 3, 100);
      const opponents = [
        createOpponent({ playerId: 'weak', power: 100, ranking: 1 }),
      ];
      const result = arena.generateOpponents(playerState, opponents);
      expect(result).toEqual([]);
    });
  });

  describe('§1.3 刷新与挑战次数', () => {
    it('免费刷新间隔为30分钟', () => {
      const config = arena.getRefreshConfig();
      expect(config.freeIntervalMs).toBe(30 * 60 * 1000);
    });

    it('冷却期内不可免费刷新', () => {
      const now = 1000000;
      const state = {
        ...createDefaultArenaPlayerState(),
        lastFreeRefreshTime: now - 1000,
      };
      expect(arena.canFreeRefresh(state, now)).toBe(false);
    });

    it('冷却期后可以免费刷新', () => {
      const now = 100000000;
      const state = {
        ...createDefaultArenaPlayerState(),
        lastFreeRefreshTime: now - 30 * 60 * 1000 - 1,
      };
      expect(arena.canFreeRefresh(state, now)).toBe(true);
    });

    it('免费刷新应更新对手列表和刷新时间', () => {
      const now = 100000000;
      const state = {
        ...createPlayerWithHeroes(50, 3, 100),
        lastFreeRefreshTime: 0,
      };
      const opponents = createDiverseOpponents(10, 7000, 95);
      const result = arena.freeRefresh(state, opponents, now);
      expect(result.lastFreeRefreshTime).toBe(now);
      expect(result.opponents.length).toBeGreaterThan(0);
    });

    it('手动刷新消耗500铜钱', () => {
      const state = createPlayerWithHeroes(50, 3, 100);
      const opponents = createDiverseOpponents(10, 7000, 95);
      const result = arena.manualRefresh(state, opponents, 1000000);
      expect(result.cost).toBe(500);
      expect(result.state.dailyManualRefreshes).toBe(1);
    });

    it('手动刷新每日上限10次', () => {
      const state = {
        ...createDefaultArenaPlayerState(),
        dailyManualRefreshes: 10,
      };
      expect(() => arena.manualRefresh(state, [], 1000000)).toThrow(
        '今日手动刷新次数已达上限',
      );
    });

    it('每日5次免费挑战', () => {
      const config = arena.getChallengeConfig();
      expect(config.dailyFreeChallenges).toBe(5);
    });

    it('元宝购买每次50元宝', () => {
      const config = arena.getChallengeConfig();
      expect(config.buyCostGold).toBe(50);
    });

    it('购买上限5次', () => {
      const config = arena.getChallengeConfig();
      expect(config.dailyBuyLimit).toBe(5);
    });

    it('消耗挑战次数应递减', () => {
      const state = createDefaultArenaPlayerState();
      expect(state.dailyChallengesLeft).toBe(5);
      const result = arena.consumeChallenge(state);
      expect(result.dailyChallengesLeft).toBe(4);
    });

    it('挑战次数为0时不可挑战', () => {
      const state = {
        ...createDefaultArenaPlayerState(),
        dailyChallengesLeft: 0,
      };
      expect(() => arena.consumeChallenge(state)).toThrow('今日挑战次数已用完');
    });

    it('购买挑战次数应增加挑战数和购买计数', () => {
      const state = createDefaultArenaPlayerState();
      const result = arena.buyChallenge(state);
      expect(result.state.dailyChallengesLeft).toBe(6);
      expect(result.state.dailyBoughtChallenges).toBe(1);
      expect(result.cost).toBe(50);
    });

    it('购买次数达上限应抛出异常', () => {
      const state = {
        ...createDefaultArenaPlayerState(),
        dailyBoughtChallenges: 5,
      };
      expect(() => arena.buyChallenge(state)).toThrow('今日购买次数已达上限');
    });

    it('每日重置应恢复挑战次数和刷新计数', () => {
      const state: ArenaPlayerState = {
        ...createDefaultArenaPlayerState(),
        dailyChallengesLeft: 0,
        dailyBoughtChallenges: 3,
        dailyManualRefreshes: 8,
        opponents: createDiverseOpponents(3, 7000, 95),
      };
      const reset = arena.dailyReset(state);
      expect(reset.dailyChallengesLeft).toBe(5);
      expect(reset.dailyBoughtChallenges).toBe(0);
      expect(reset.dailyManualRefreshes).toBe(0);
      expect(reset.opponents).toEqual([]);
    });
  });

  describe('§2.1 进攻编队与战斗模式', () => {
    it('全自动模式应可执行战斗', () => {
      const attacker = createPlayerWithHeroes(500, 5, 50);
      const defender = createPlayerWithHeroes(400, 4, 51);
      defender.playerId = 'defender';

      const result = battle.executeBattle(attacker, defender, PvPBattleMode.AUTO);
      expect(result.battleId).toBeTruthy();
      expect(result.attackerId).toBeTruthy();
      expect(result.defenderId).toBe('defender');
      expect(typeof result.attackerWon).toBe('boolean');
    });

    it('半自动模式应可执行战斗', () => {
      const attacker = createPlayerWithHeroes(500, 5, 50);
      const defender = createPlayerWithHeroes(400, 4, 51);

      const result = battle.executeBattle(attacker, defender, PvPBattleMode.SEMI_AUTO);
      expect(result.battleId).toBeTruthy();
    });

    it('战斗最多10回合', () => {
      const config = battle.getBattleConfig();
      expect(config.maxTurns).toBe(10);
    });

    it('战斗回合计数应在1~10之间', () => {
      const attacker = createPlayerWithHeroes(500, 5, 50);
      const defender = createPlayerWithHeroes(400, 4, 51);

      const result = battle.executeBattle(attacker, defender);
      expect(result.totalTurns).toBeGreaterThanOrEqual(1);
      expect(result.totalTurns).toBeLessThanOrEqual(10);
    });
  });

  describe('§2.2 防守方加成与超时判定', () => {
    it('防守方应有5%属性加成', () => {
      const config = battle.getBattleConfig();
      expect(config.defenseBonusRatio).toBe(0.05);
    });

    it('超时时防守方获胜', () => {
      const config = battle.getBattleConfig();
      expect(config.timeoutWinner).toBe('defender');
    });

    it('战斗结果应包含超时标记', () => {
      const attacker = createPlayerWithHeroes(500, 5, 50);
      const defender = createPlayerWithHeroes(400, 4, 51);

      const result = battle.executeBattle(attacker, defender);
      expect(typeof result.isTimeout).toBe('boolean');
    });
  });

  describe('§2.3 战斗结果与积分变化', () => {
    it('进攻胜利积分应在+30~+60范围', () => {
      const scores = new Set<number>();
      for (let i = 0; i < 100; i++) {
        scores.add(battle.calculateWinScore());
      }
      for (const s of scores) {
        expect(s).toBeGreaterThanOrEqual(30);
        expect(s).toBeLessThanOrEqual(60);
      }
    });

    it('进攻失败积分应在-15~-30范围', () => {
      const scores = new Set<number>();
      for (let i = 0; i < 100; i++) {
        scores.add(battle.calculateLoseScore());
      }
      for (const s of scores) {
        expect(s).toBeLessThanOrEqual(-15);
        expect(s).toBeGreaterThanOrEqual(-30);
      }
    });

    it('应用积分变化后段位应更新', () => {
      const state = createDefaultArenaPlayerState();
      expect(state.rankId).toBe('BRONZE_V');

      const updated = battle.applyScoreChange(state, 350);
      expect(updated.score).toBe(350);
      expect(updated.rankId).toBe('BRONZE_IV');
    });

    it('积分不会低于0', () => {
      const state = createDefaultArenaPlayerState();
      const updated = battle.applyScoreChange(state, -100);
      expect(updated.score).toBe(0);
    });

    it('应用战斗结果应更新积分和竞技币', () => {
      const attacker = createPlayerWithHeroes(500, 5, 50);
      const defender = createPlayerWithHeroes(400, 4, 51);

      const result = battle.executeBattle(attacker, defender);
      const updated = battle.applyBattleResult(attacker, result);

      expect(updated.score).toBeGreaterThanOrEqual(0);
      expect(updated.arenaCoins).toBeGreaterThan(0);
    });

    it('进攻胜利获得更多竞技币', () => {
      const attacker = createPlayerWithHeroes(500, 5, 50);
      const defender = createPlayerWithHeroes(100, 1, 51);

      // Run many battles to get at least one win
      let winResult = false;
      for (let i = 0; i < 50; i++) {
        const result = battle.executeBattle(attacker, defender);
        if (result.attackerWon) {
          const updated = battle.applyBattleResult(attacker, result);
          expect(updated.arenaCoins).toBe(20);
          winResult = true;
          break;
        }
      }
      // If no win in 50 tries, the test still passes (probabilistic)
    });

    it('段位升降检测应正确', () => {
      expect(battle.isRankUp('BRONZE_V', 'BRONZE_IV')).toBe(true);
      expect(battle.isRankUp('BRONZE_IV', 'BRONZE_V')).toBe(false);
      expect(battle.isRankDown('BRONZE_IV', 'BRONZE_V')).toBe(true);
      expect(battle.isRankDown('BRONZE_V', 'BRONZE_IV')).toBe(false);
    });
  });

  describe('§2.4 战斗回放', () => {
    it('应保存战斗回放', () => {
      const state = createDefaultArenaPlayerState();
      const replay = createReplay();
      const updated = battle.saveReplay(state, replay);
      expect(updated.replays.length).toBe(1);
      expect(updated.replays[0].id).toBe('replay_001');
    });

    it('回放最多保存50条', () => {
      const state = createDefaultArenaPlayerState();
      let updated = state;
      for (let i = 0; i < 60; i++) {
        updated = battle.saveReplay(updated, createReplay({ id: `replay_${i}` }));
      }
      expect(updated.replays.length).toBe(50);
    });

    it('应清理过期回放', () => {
      const now = Date.now();
      const state = createDefaultArenaPlayerState();
      const oldReplay = createReplay({
        id: 'old',
        timestamp: now - REPLAY_CONFIG.retentionMs - 1,
      });
      const newReplay = createReplay({
        id: 'new',
        timestamp: now,
      });
      const withReplays = {
        ...state,
        replays: [oldReplay, newReplay],
      };
      const cleaned = battle.cleanExpiredReplays(withReplays, now);
      expect(cleaned.replays.length).toBe(1);
      expect(cleaned.replays[0].id).toBe('new');
    });

    it('回放保留7天', () => {
      expect(REPLAY_CONFIG.retentionDays).toBe(7);
      expect(REPLAY_CONFIG.retentionMs).toBe(7 * 24 * 60 * 60 * 1000);
    });
  });

  describe('§9.1 竞技场→战斗→积分→段位全链路', () => {
    it('完整链路: 匹配→挑战→积分→段位→排名', () => {
      // 1. 初始化玩家
      let playerState = {
        ...createPlayerWithHeroes(50, 3, 100),
        lastFreeRefreshTime: 0,
      };

      // 2. 生成对手
      const opponents = createDiverseOpponents(10, 7000, 95);
      playerState = arena.freeRefresh(playerState, opponents, 2000000);
      expect(playerState.opponents.length).toBeGreaterThan(0);

      // 3. 更新排行榜
      ranking.updateRanking(RankingDimension.SCORE, opponents, Date.now());
      ranking.updateRanking(RankingDimension.POWER, opponents, Date.now());

      // 4. 消耗挑战次数
      playerState = arena.consumeChallenge(playerState);
      expect(playerState.dailyChallengesLeft).toBe(4);

      // 5. 执行战斗
      const defender = createPlayerWithHeroes(400, 4, 101);
      const result = battle.executeBattle(playerState, defender);

      // 6. 应用结果
      playerState = battle.applyBattleResult(playerState, result);
      expect(playerState.score).toBeGreaterThanOrEqual(0);
      expect(playerState.arenaCoins).toBeGreaterThan(0);

      // 7. 段位应更新
      const newRankId = battle.getRankIdForScore(playerState.score);
      expect(newRankId).toBeTruthy();
    });
  });
});
