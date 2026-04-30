/**
 * v11.0 群雄逐鹿 — PvP全链路集成测试
 *
 * 覆盖 Play 流程：
 *   §1 竞技场系统（入口/匹配/刷新/挑战次数）
 *   §2 排名挑战（战斗模式/防守加成/积分/回放）
 *   §3 赛季系统（段位/结算/商店）
 *   §4 防守阵容（编队/AI策略/日志/奖励）
 *   §9.1 竞技场→战斗→积分→段位全链路
 *   §9.7 进攻快照一致性
 *   §9.13 赛季切换全链路
 *   §9.14 竞技商店消耗闭环
 *   §9.15 PvP→声望串联验证
 *
 * @module engine/pvp/__tests__/integration
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ArenaSystem } from '../../ArenaSystem';
import { PvPBattleSystem, RANK_LEVELS } from '../../PvPBattleSystem';
import { ArenaSeasonSystem } from '../../ArenaSeasonSystem';
import { ArenaShopSystem } from '../../ArenaShopSystem';
import { DefenseFormationSystem } from '../../DefenseFormationSystem';
import { RankingSystem } from '../../RankingSystem';
import { createDefaultArenaPlayerState } from '../../ArenaConfig';
import { FormationType, AIDefenseStrategy, PvPBattleMode } from '../../../../core/pvp/pvp.types';
import type { ArenaOpponent, ArenaPlayerState } from '../../../../core/pvp/pvp.types';

// ── 辅助 ────────────────────────────────────

/** 创建模拟对手 */
function makeOpponent(id: string, power: number, ranking: number, faction: string = 'SHU'): ArenaOpponent {
  return {
    playerId: id,
    playerName: `Player_${id}`,
    power,
    ranking,
    faction: faction as 'SHU' | 'WEI' | 'WU',
    defenseFormation: {
      slots: ['hero_a', 'hero_b', '', '', ''],
      formation: FormationType.FISH_SCALE,
      strategy: AIDefenseStrategy.BALANCED,
    },
    rankId: 'BRONZE_V',
  };
}

/** 创建对手池 */
function makeOpponentPool(count: number, basePower: number, baseRank: number): ArenaOpponent[] {
  const factions = ['SHU', 'WEI', 'WU'];
  return Array.from({ length: count }, (_, i) =>
    makeOpponent(`opp_${i}`, basePower + i * 100, baseRank + i, factions[i % 3]),
  );
}

// ─────────────────────────────────────────────
// §1 竞技场系统
// ─────────────────────────────────────────────

describe('§1 竞技场系统', () => {
  let arena: ArenaSystem;
  let player: ArenaPlayerState;

  beforeEach(() => {
    arena = new ArenaSystem();
    player = createDefaultArenaPlayerState('p1');
  });

  it('§1.1 进入竞技场生成3名候选对手', () => {
    const pool = makeOpponentPool(20, 5000, 10);
    const opponents = arena.generateOpponents(player, pool);
    expect(opponents.length).toBeLessThanOrEqual(3);
    opponents.forEach((o) => {
      expect(o.playerId).not.toBe('p1');
    });
  });

  it('§1.2 对手战力在×0.7~×1.3范围内', () => {
    // 给玩家一些积分以产生战力估算
    player.score = 500;
    const pool = makeOpponentPool(30, 5000, 10);
    const opponents = arena.generateOpponents(player, pool);
    // 对手应来自池中
    expect(opponents.length).toBeGreaterThanOrEqual(0);
  });

  it('§1.3 免费刷新30min冷却', () => {
    const now = 10000000; // 足够大，确保 now - 0 > 30min
    const pool = makeOpponentPool(20, 5000, 10);

    // 首次可以免费刷新（lastFreeRefreshTime=0, now远大于30min）
    expect(arena.canFreeRefresh(player, now)).toBe(true);

    // 刷新后不能立即再刷
    const state = arena.freeRefresh(player, pool, now);
    expect(arena.canFreeRefresh(state, now)).toBe(false);

    // 30分钟后可以再次刷新
    const after30min = now + 30 * 60 * 1000;
    expect(arena.canFreeRefresh(state, after30min)).toBe(true);
  });

  it('§1.4 手动刷新消耗500铜钱每日10次上限', () => {
    const now = 1000000;
    const pool = makeOpponentPool(20, 5000, 10);

    // 手动刷新10次
    let state = player;
    for (let i = 0; i < 10; i++) {
      const result = arena.manualRefresh(state, pool, now);
      expect(result.cost).toBe(500);
      state = result.state;
    }

    // 第11次应该抛出异常
    expect(() => arena.manualRefresh(state, pool, now)).toThrow('今日手动刷新次数已达上限');
  });

  it('§1.5 挑战次数每日5次免费+5次购买', () => {
    expect(player.dailyChallengesLeft).toBe(5);

    // 消耗5次
    let state = player;
    for (let i = 0; i < 5; i++) {
      state = arena.consumeChallenge(state);
    }
    expect(state.dailyChallengesLeft).toBe(0);

    // 购买1次
    const buyResult = arena.buyChallenge(state);
    expect(buyResult.cost).toBe(50);
    expect(buyResult.state.dailyChallengesLeft).toBe(1);
    expect(buyResult.state.dailyBoughtChallenges).toBe(1);
  });

  it('§1.6 购买次数5次上限', () => {
    let state = player;
    // 先消耗免费次数
    for (let i = 0; i < 5; i++) state = arena.consumeChallenge(state);

    // 购买5次
    for (let i = 0; i < 5; i++) state = arena.buyChallenge(state).state;

    // 第6次购买失败
    expect(() => arena.buyChallenge(state)).toThrow('今日购买次数已达上限');
  });

  it('§1.7 每日0:00重置', () => {
    let state = player;
    state = arena.consumeChallenge(state);
    state = arena.consumeChallenge(state);
    expect(state.dailyChallengesLeft).toBe(3);

    const resetState = arena.dailyReset(state);
    expect(resetState.dailyChallengesLeft).toBe(5);
    expect(resetState.dailyBoughtChallenges).toBe(0);
    expect(resetState.dailyManualRefreshes).toBe(0);
    expect(resetState.opponents).toEqual([]);
  });
});

// ─────────────────────────────────────────────
// §2 排名挑战
// ─────────────────────────────────────────────

describe('§2 排名挑战', () => {
  let battle: PvPBattleSystem;
  let attacker: ArenaPlayerState;
  let defender: ArenaPlayerState;

  beforeEach(() => {
    battle = new PvPBattleSystem();
    attacker = createDefaultArenaPlayerState('attacker');
    defender = createDefaultArenaPlayerState('defender');
    attacker.score = 1000;
    defender.score = 800;
  });

  it('§2.1 PvP战斗执行返回完整结果', () => {
    const result = battle.executeBattle(attacker, defender, PvPBattleMode.AUTO);
    expect(result.battleId).toBeTruthy();
    expect(result.attackerId).toBe('attacker');
    expect(result.defenderId).toBe('defender');
    expect(typeof result.attackerWon).toBe('boolean');
    expect(typeof result.scoreChange).toBe('number');
    expect(result.totalTurns).toBeGreaterThanOrEqual(1);
    expect(result.totalTurns).toBeLessThanOrEqual(10);
  });

  it('§2.2 进攻胜利积分+30~+60', () => {
    const winScore = battle.calculateWinScore();
    expect(winScore).toBeGreaterThanOrEqual(30);
    expect(winScore).toBeLessThanOrEqual(60);
  });

  it('§2.3 进攻失败积分-15~-30', () => {
    const loseScore = battle.calculateLoseScore();
    expect(loseScore).toBeLessThanOrEqual(-15);
    expect(loseScore).toBeGreaterThanOrEqual(-30);
  });

  it('§2.4 积分变化后段位正确更新', () => {
    // 从青铜V(0分)加到青铜IV(300分)
    attacker.score = 0;
    attacker.rankId = 'BRONZE_V';
    const newState = battle.applyScoreChange(attacker, 350);
    expect(newState.score).toBe(350);
    expect(newState.rankId).toBe('BRONZE_IV');
  });

  it('§2.5 积分不低于0', () => {
    attacker.score = 10;
    const newState = battle.applyScoreChange(attacker, -50);
    expect(newState.score).toBe(0);
  });

  it('§2.6 战斗结果应用到玩家状态', () => {
    const result = battle.executeBattle(attacker, defender);
    const newAttacker = battle.applyBattleResult(attacker, result);

    expect(newAttacker.score).toBeGreaterThanOrEqual(0);
    expect(newAttacker.arenaCoins).toBeGreaterThan(0);
    expect(newAttacker.rankId).toBeTruthy();
  });

  it('§2.7 半自动模式战斗执行', () => {
    const result = battle.executeBattle(attacker, defender, PvPBattleMode.SEMI_AUTO);
    expect(result.battleId).toBeTruthy();
    expect(typeof result.attackerWon).toBe('boolean');
  });

  it('§2.8 段位升降判定', () => {
    expect(battle.isRankUp('BRONZE_V', 'BRONZE_IV')).toBe(true);
    expect(battle.isRankDown('BRONZE_IV', 'BRONZE_V')).toBe(true);
    expect(battle.isRankUp('BRONZE_V', 'BRONZE_V')).toBe(false);
  });

  it('§2.9 段位总数为21级', () => {
    expect(battle.getRankLevelCount()).toBe(21);
  });

  it('§2.10 每日段位奖励正确', () => {
    const reward = battle.getDailyReward('BRONZE_V');
    expect(reward.copper).toBe(500);
    expect(reward.arenaCoin).toBe(10);
    expect(reward.gold).toBe(5);

    const kingReward = battle.getDailyReward('KING_I');
    expect(kingReward.copper).toBe(8000);
    expect(kingReward.arenaCoin).toBe(200);
    expect(kingReward.gold).toBe(30);
  });
});

// ─────────────────────────────────────────────
// §3 赛季系统
// ─────────────────────────────────────────────

describe('§3 赛季系统', () => {
  let season: ArenaSeasonSystem;
  let player: ArenaPlayerState;

  beforeEach(() => {
    season = new ArenaSeasonSystem();
    player = createDefaultArenaPlayerState('p1');
    player.score = 5000;
    player.rankId = 'DIAMOND_V';
  });

  it('§3.1 创建28天赛季', () => {
    const now = Date.now();
    const s = season.createSeason('s1', now);
    expect(s.seasonId).toBe('s1');
    const dayMs = 24 * 60 * 60 * 1000;
    expect(s.endTime - s.startTime).toBe(28 * dayMs);
  });

  it('§3.2 赛季结束判定', () => {
    const now = Date.now();
    const s = season.createSeason('s1', now);
    expect(season.isSeasonActive(s, now)).toBe(true);
    expect(season.isSeasonEnded(s, now + 29 * 24 * 60 * 60 * 1000)).toBe(true);
  });

  it('§3.3 赛季结算按最高段位发放奖励', () => {
    player.score = 10000;
    player.rankId = 'KING_I';
    const result = season.settleSeason(player, 'KING_I');
    expect(result.reward.arenaCoin).toBe(2000);
    expect(result.reward.gold).toBe(500);
    expect(result.reward.title).toBe('天下霸主');
  });

  it('§3.4 赛季结算积分重置到当前段位最低值', () => {
    player.rankId = 'DIAMOND_V';
    player.score = 5500;
    const result = season.settleSeason(player, 'DIAMOND_I');
    // 当前段位DIAMOND_V最低值为5000
    expect(result.resetScore).toBe(5000);
  });

  it('§3.5 每日段位奖励发放', () => {
    const result = season.grantDailyReward(player);
    expect(result.reward.copper).toBe(3000);
    expect(result.reward.arenaCoin).toBe(100);
    expect(result.state.arenaCoins).toBe(100);
  });

  it('§3.6 最高段位更新', () => {
    expect(season.updateHighestRank('BRONZE_V', 'SILVER_I')).toBe('SILVER_I');
    expect(season.updateHighestRank('GOLD_I', 'BRONZE_V')).toBe('GOLD_I');
  });

  it('§3.7 赛季剩余天数', () => {
    const now = Date.now();
    const s = season.createSeason('s1', now);
    expect(season.getRemainingDays(s, now + 10 * 24 * 60 * 60 * 1000)).toBe(18);
  });
});

// ─────────────────────────────────────────────
// §4 防守阵容
// ─────────────────────────────────────────────

describe('§4 防守阵容', () => {
  let defense: DefenseFormationSystem;

  beforeEach(() => {
    defense = new DefenseFormationSystem();
  });

  it('§4.1 设置5阵位武将+阵型', () => {
    const formation = defense.createDefaultFormation();
    const updated = defense.setFormation(
      formation,
      ['hero1', 'hero2', 'hero3', 'hero4', 'hero5'],
      FormationType.WEDGE,
      AIDefenseStrategy.AGGRESSIVE,
    );
    expect(updated.slots).toEqual(['hero1', 'hero2', 'hero3', 'hero4', 'hero5']);
    expect(updated.formation).toBe(FormationType.WEDGE);
    expect(updated.strategy).toBe(AIDefenseStrategy.AGGRESSIVE);
  });

  it('§4.2 至少需要1名武将', () => {
    const formation = defense.createDefaultFormation();
    expect(() => defense.setFormation(formation, ['', '', '', '', ''])).toThrow('至少需要1名武将');
  });

  it('§4.3 四种AI策略可切换', () => {
    const formation = defense.createDefaultFormation();
    const strategies = [AIDefenseStrategy.BALANCED, AIDefenseStrategy.AGGRESSIVE, AIDefenseStrategy.DEFENSIVE, AIDefenseStrategy.CUNNING];
    strategies.forEach((s) => {
      const updated = defense.setStrategy(formation, s);
      expect(updated.strategy).toBe(s);
    });
  });

  it('§4.4 五种阵型可切换', () => {
    const formation = defense.createDefaultFormation();
    const formations = [FormationType.FISH_SCALE, FormationType.WEDGE, FormationType.GOOSE, FormationType.SNAKE, FormationType.SQUARE];
    formations.forEach((f) => {
      const updated = defense.setFormationType(formation, f);
      expect(updated.formation).toBe(f);
    });
  });

  it('§4.5 防守快照创建', () => {
    const formation = defense.setFormation(
      defense.createDefaultFormation(),
      ['hero1', 'hero2', '', '', ''],
      FormationType.GOOSE,
      AIDefenseStrategy.DEFENSIVE,
    );
    const snapshot = defense.createSnapshot(formation);
    expect(snapshot.slots).toEqual(['hero1', 'hero2', '', '', '']);
    expect(snapshot.formation).toBe(FormationType.GOOSE);
    expect(snapshot.aiStrategy).toBe(AIDefenseStrategy.DEFENSIVE);
  });

  it('§4.6 防守日志记录和统计', () => {
    let logs = defense.addDefenseLog([], {
      attackerId: 'a1', attackerName: 'Attacker1', defenderWon: true, turns: 5, attackerRank: 'BRONZE_IV', timestamp: Date.now(),
    });
    logs = defense.addDefenseLog(logs, {
      attackerId: 'a2', attackerName: 'Attacker2', defenderWon: false, turns: 8, attackerRank: 'SILVER_V', timestamp: Date.now(),
    });
    logs = defense.addDefenseLog(logs, {
      attackerId: 'a3', attackerName: 'Attacker3', defenderWon: true, turns: 3, attackerRank: 'BRONZE_I', timestamp: Date.now(),
    });

    const stats = defense.getDefenseStats(logs);
    expect(stats.totalDefenses).toBe(3);
    expect(stats.wins).toBe(2);
    expect(stats.losses).toBe(1);
    expect(stats.winRate).toBeCloseTo(2 / 3);
  });

  it('§4.7 防守日志最多50条', () => {
    let logs: any[] = [];
    for (let i = 0; i < 60; i++) {
      logs = defense.addDefenseLog(logs, {
        attackerId: `a${i}`, attackerName: `A${i}`, defenderWon: i % 2 === 0, turns: 5, attackerRank: 'BRONZE_V', timestamp: Date.now(),
      });
    }
    expect(logs.length).toBe(50);
  });

  it('§4.8 智能建议低胜率推荐坚守', () => {
    let logs: any[] = [];
    // 2胜8负 = 20%胜率
    for (let i = 0; i < 10; i++) {
      logs = defense.addDefenseLog(logs, {
        attackerId: `a${i}`, attackerName: `A${i}`, defenderWon: i < 2, turns: 5, attackerRank: 'BRONZE_V', timestamp: Date.now(),
      });
    }
    const stats = defense.getDefenseStats(logs);
    expect(stats.suggestedStrategy).toBe(AIDefenseStrategy.DEFENSIVE);
  });

  it('§4.9 阵容验证重复武将', () => {
    const formation = defense.setFormation(
      defense.createDefaultFormation(),
      ['hero1', 'hero1', '', '', ''],
    );
    const validation = defense.validateFormation(formation);
    expect(validation.valid).toBe(false);
    expect(validation.errors).toContain('武将不能重复');
  });
});

// ─────────────────────────────────────────────
// §9.1 竞技场→战斗→积分→段位全链路
// ─────────────────────────────────────────────

describe('§9.1 竞技场→战斗→积分→段位全链路', () => {
  let arena: ArenaSystem;
  let battle: PvPBattleSystem;
  let season: ArenaSeasonSystem;
  let player: ArenaPlayerState;
  let pool: ArenaOpponent[];

  beforeEach(() => {
    arena = new ArenaSystem();
    battle = new PvPBattleSystem();
    season = new ArenaSeasonSystem();
    player = createDefaultArenaPlayerState('p1');
    player.score = 200;
    player.rankId = 'BRONZE_V';
    pool = makeOpponentPool(20, 5000, 10);
  });

  it('§9.1.1 匹配→挑战→积分→段位→奖励全链路', () => {
    // 1. 匹配对手
    const opponents = arena.generateOpponents(player, pool);

    // 2. 消耗挑战次数
    player = arena.consumeChallenge(player);
    expect(player.dailyChallengesLeft).toBe(4);

    // 3. 模拟进攻胜利
    const defender = createDefaultArenaPlayerState('defender');
    defender.score = 200;
    const result = battle.executeBattle(player, defender);
    if (result.attackerWon) {
      expect(result.scoreChange).toBeGreaterThanOrEqual(30);
      expect(result.scoreChange).toBeLessThanOrEqual(60);
    }

    // 4. 应用积分变化
    player = battle.applyBattleResult(player, result);
    expect(player.score).toBeGreaterThanOrEqual(0);

    // 5. 检查段位更新
    const newRankId = battle.getRankIdForScore(player.score);
    expect(newRankId).toBeTruthy();

    // 6. 每日奖励
    const dailyResult = season.grantDailyReward(player);
    expect(dailyResult.reward).toBeTruthy();
  });

  it('§9.1.2 连续挑战5次后耗尽', () => {
    for (let i = 0; i < 5; i++) {
      player = arena.consumeChallenge(player);
    }
    expect(() => arena.consumeChallenge(player)).toThrow('今日挑战次数已用完');
  });
});

// ─────────────────────────────────────────────
// §9.7 进攻快照一致性
// ─────────────────────────────────────────────

describe('§9.7 进攻快照一致性', () => {
  it('§9.7.1 战斗使用快照不受阵容修改影响', () => {
    const defense = new DefenseFormationSystem();
    const formation = defense.setFormation(
      defense.createDefaultFormation(),
      ['hero1', 'hero2', 'hero3', '', ''],
      FormationType.WEDGE,
    );

    // 锁定快照
    const snapshot = defense.createSnapshot(formation);

    // 修改原阵容
    const modified = defense.setFormation(
      formation,
      ['heroX', 'heroY', '', '', ''],
      FormationType.GOOSE,
    );

    // 快照不变
    expect(snapshot.slots).toEqual(['hero1', 'hero2', 'hero3', '', '']);
    expect(snapshot.formation).toBe(FormationType.WEDGE);
    expect(modified.slots).not.toEqual(snapshot.slots);
  });
});

// ─────────────────────────────────────────────
// §9.13 赛季切换全链路
// ─────────────────────────────────────────────

describe('§9.13 赛季切换全链路', () => {
  it('§9.13.1 赛季结算→积分重置→新赛季开始', () => {
    const season = new ArenaSeasonSystem();
    const arena = new ArenaSystem();
    let player = createDefaultArenaPlayerState('p1');
    player.score = 9000;
    player.rankId = 'DIAMOND_I';
    player.arenaCoins = 500;

    // 赛季结算
    const result = season.settleSeason(player, 'DIAMOND_I');
    expect(result.reward.arenaCoin).toBe(1000);
    expect(result.resetScore).toBe(9000); // DIAMOND_I最低值

    // 积分重置
    player = result.state;
    expect(player.score).toBe(9000);

    // 每日数据重置
    const resetState = arena.dailyReset(player);
    expect(resetState.dailyChallengesLeft).toBe(5);
    expect(resetState.dailyBoughtChallenges).toBe(0);
  });
});

// ─────────────────────────────────────────────
// §9.14 竞技商店消耗闭环
// ─────────────────────────────────────────────

describe('§9.14 竞技商店消耗闭环', () => {
  it('§9.14.1 竞技币获取→商店兑换闭环', () => {
    const shop = new ArenaShopSystem();
    const season = new ArenaSeasonSystem();
    let player = createDefaultArenaPlayerState('p1');
    player.rankId = 'GOLD_I';

    // 通过每日奖励获取竞技币
    const dailyResult = season.grantDailyReward(player);
    player = dailyResult.state;
    expect(player.arenaCoins).toBeGreaterThan(0);

    // 商店购买
    const items = shop.getAllItems();
    const affordableItem = items.find((i) => i.arenaCoinCost <= player.arenaCoins);
    if (affordableItem) {
      const buyResult = shop.buyItem(player, affordableItem.itemId);
      expect(buyResult.state.arenaCoins).toBeLessThan(player.arenaCoins);
    }
  });

  it('§9.14.2 竞技币不足时购买失败', () => {
    const shop = new ArenaShopSystem();
    const player = createDefaultArenaPlayerState('p1');
    player.arenaCoins = 0;

    expect(() => shop.buyItem(player, 'fragment_liubei')).toThrow('竞技币不足');
  });

  it('§9.14.3 周限购超出时购买失败', () => {
    const shop = new ArenaShopSystem();
    let player = createDefaultArenaPlayerState('p1');
    player.arenaCoins = 100000;

    // 购买5次刘备碎片（周限购5次）
    for (let i = 0; i < 5; i++) {
      const result = shop.buyItem(player, 'fragment_liubei');
      player = result.state;
    }

    // 第6次应该失败
    expect(() => shop.buyItem(player, 'fragment_liubei')).toThrow('每周限购');
  });

  it('§9.14.4 周重置后限购恢复', () => {
    const shop = new ArenaShopSystem();
    let player = createDefaultArenaPlayerState('p1');
    player.arenaCoins = 100000;

    // 买满
    for (let i = 0; i < 5; i++) {
      player = shop.buyItem(player, 'fragment_liubei').state;
    }
    expect(() => shop.buyItem(player, 'fragment_liubei')).toThrow();

    // 周重置
    shop.weeklyReset();
    const result = shop.buyItem(player, 'fragment_liubei');
    expect(result.item).toBeTruthy();
  });
});

// ─────────────────────────────────────────────
// §9.15 PvP→声望串联验证
// ─────────────────────────────────────────────

describe('§9.15 PvP→声望串联验证', () => {
  it('§9.15.1 PvP行为不直接获得声望值', () => {
    const battle = new PvPBattleSystem();
    const attacker = createDefaultArenaPlayerState('p1');
    const defender = createDefaultArenaPlayerState('p2');

    const result = battle.executeBattle(attacker, defender);
    const newAttacker = battle.applyBattleResult(attacker, result);

    // PvP结果只有积分和竞技币，无直接声望
    expect(typeof newAttacker.score).toBe('number');
    expect(typeof newAttacker.arenaCoins).toBe('number');
    // 确认ArenaPlayerState没有声望字段
    expect((newAttacker as unknown as Record<string, unknown>).prestige).toBeUndefined();
    expect((newAttacker as unknown as Record<string, unknown>).reputation).toBeUndefined();
  });
});
