/**
 * v11.0 群雄逐鹿 — 竞技场完整流程集成测试
 *
 * 覆盖范围（按 PRD 章节组织）：
 * - §0 竞技场解锁与入口：解锁条件验证、系统初始化
 * - §1 对手匹配规则：战力×0.7~×1.3、排名±5~±20、阵营均衡
 * - §2 刷新与挑战次数：30min自动刷新、500铜钱手动刷新、每日5次免费+元宝购买
 * - §3 PvP战斗结果处理：胜利积分+30~+60、失败扣分-15~-30、竞技币奖励
 * - §4 段位升降级：5大段位×多级小段=21级、积分映射、升降判定
 * - §5 竞技商店兑换：竞技币购买、周限购、重置
 * - §6 防守编队设置：阵型选择、AI策略、日志统计
 *
 * 测试原则：
 * - 每个用例创建独立的系统实例
 * - 使用真实引擎 API，不使用 mock
 * - 以实际代码行为为准
 *
 * @see docs/games/three-kingdoms/play/v11-play.md (竞技场核心玩法)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ArenaSystem, createDefaultArenaPlayerState } from '../../pvp/ArenaSystem';
import { PvPBattleSystem, RANK_LEVELS } from '../../pvp/PvPBattleSystem';
import { ArenaShopSystem, DEFAULT_ARENA_SHOP_ITEMS } from '../../pvp/ArenaShopSystem';
import { DefenseFormationSystem } from '../../pvp/DefenseFormationSystem';
import { RankingSystem, RankingDimension } from '../../pvp/RankingSystem';
import {
  FormationType,
  AIDefenseStrategy,
  PvPBattleMode,
} from '../../../core/pvp/pvp.types';
import type {
  ArenaOpponent,
  ArenaPlayerState,
  ArenaShopItem,
} from '../../../core/pvp/pvp.types';
import type { Faction } from '../../hero/hero.types';

// ── 辅助函数 ──────────────────────────────

function createOpponent(overrides: Partial<ArenaOpponent> = {}): ArenaOpponent {
  return {
    playerId: 'p_default',
    playerName: 'DefaultPlayer',
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
  const factions: Faction[] = ['wei', 'shu', 'wu'];
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
        faction: factions[i % 3],
      }),
    );
  }
  return result;
}

function createPlayerWithCoins(coins: number): ArenaPlayerState {
  return {
    ...createDefaultArenaPlayerState('shopper'),
    arenaCoins: coins,
  };
}

// ═══════════════════════════════════════════════════════════════
// §0 竞技场解锁与入口
// ═══════════════════════════════════════════════════════════════
describe('v11.0 竞技场 — §0 解锁与入口', () => {

  it('should initialize ArenaSystem with correct name', () => {
    const arena = new ArenaSystem();
    expect(arena.name).toBe('ArenaSystem');
  });

  it('should provide default player state with BRONZE_V rank', () => {
    const state = createDefaultArenaPlayerState();
    expect(state.rankId).toBe('BRONZE_V');
    expect(state.score).toBe(0);
    expect(state.ranking).toBe(0);
  });

  it('should initialize with 5 daily free challenges', () => {
    const state = createDefaultArenaPlayerState();
    expect(state.dailyChallengesLeft).toBe(5);
    expect(state.dailyBoughtChallenges).toBe(0);
  });

  it('should initialize with empty opponents and zero coins', () => {
    const state = createDefaultArenaPlayerState();
    expect(state.opponents).toEqual([]);
    expect(state.arenaCoins).toBe(0);
    expect(state.dailyManualRefreshes).toBe(0);
  });

  it('should expose match/refresh/challenge config getters', () => {
    const arena = new ArenaSystem();
    const matchConfig = arena.getMatchConfig();
    const refreshConfig = arena.getRefreshConfig();
    const challengeConfig = arena.getChallengeConfig();

    expect(matchConfig).toBeDefined();
    expect(matchConfig.powerMinRatio).toBe(0.7);
    expect(matchConfig.powerMaxRatio).toBe(1.3);
    expect(refreshConfig.manualCostCopper).toBe(500);
    expect(challengeConfig.dailyFreeChallenges).toBe(5);
  });

});

// ═══════════════════════════════════════════════════════════════
// §1 对手匹配规则
// ═══════════════════════════════════════════════════════════════
describe('v11.0 竞技场 — §1 对手匹配规则', () => {
  let arena: ArenaSystem;

  beforeEach(() => {
    arena = new ArenaSystem();
  });

  it('should filter opponents within power ×0.7~×1.3 range', () => {
    const playerState = createPlayerWithHeroes(50, 3, 100);
    // power = 50*10 + 3*1000 + 5000 = 8500
    const myPower = 8500;
    const minPower = Math.floor(myPower * 0.7);
    const maxPower = Math.ceil(myPower * 1.3);

    const opponents = [
      createOpponent({ playerId: 'too_weak', power: minPower - 100, ranking: 100 }),
      createOpponent({ playerId: 'ok_low', power: minPower, ranking: 100 }),
      createOpponent({ playerId: 'ok_high', power: maxPower, ranking: 100 }),
      createOpponent({ playerId: 'too_strong', power: maxPower + 100, ranking: 100 }),
    ];

    const result = arena.generateOpponents(playerState, opponents);
    const ids = result.map((o) => o.playerId);
    expect(ids).not.toContain('too_weak');
    expect(ids).not.toContain('too_strong');
  });

  it('should filter opponents within ranking ±5~±20 range', () => {
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

  it('should return at most 3 candidate opponents', () => {
    const playerState = createPlayerWithHeroes(50, 3, 100);
    const opponents = createDiverseOpponents(20, 7000, 95);
    const result = arena.generateOpponents(playerState, opponents);
    expect(result.length).toBeLessThanOrEqual(3);
  });

  it('should return empty array when no eligible opponents', () => {
    const playerState = createPlayerWithHeroes(50, 3, 100);
    const opponents = [
      createOpponent({ playerId: 'weak', power: 100, ranking: 1 }),
    ];
    const result = arena.generateOpponents(playerState, opponents);
    expect(result).toEqual([]);
  });

  it('should return fewer than 3 when insufficient eligible opponents', () => {
    const playerState = createPlayerWithHeroes(50, 3, 100);
    const opponents = [
      createOpponent({ playerId: 'only', power: 8500, ranking: 100 }),
    ];
    const result = arena.generateOpponents(playerState, opponents);
    expect(result.length).toBe(1);
  });

  it('should prefer faction diversity in candidate selection', () => {
    const playerState = createPlayerWithHeroes(50, 3, 100);
    const opponents: ArenaOpponent[] = [];
    // 5 wei opponents
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
    // 1 shu + 1 wu
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

});

// ═══════════════════════════════════════════════════════════════
// §2 刷新与挑战次数管理
// ═══════════════════════════════════════════════════════════════
describe('v11.0 竞技场 — §2 刷新与挑战次数', () => {
  let arena: ArenaSystem;

  beforeEach(() => {
    arena = new ArenaSystem();
  });

  it('should allow free refresh after 30min cooldown', () => {
    const now = 10_000_000;
    const state = {
      ...createDefaultArenaPlayerState(),
      lastFreeRefreshTime: now - 30 * 60 * 1000 - 1,
    };
    expect(arena.canFreeRefresh(state, now)).toBe(true);
  });

  it('should block free refresh within 30min cooldown', () => {
    const now = 10_000_000;
    const state = {
      ...createDefaultArenaPlayerState(),
      lastFreeRefreshTime: now - 1000,
    };
    expect(arena.canFreeRefresh(state, now)).toBe(false);
  });

  it('should update lastFreeRefreshTime on free refresh', () => {
    const now = 10_000_000;
    const state = {
      ...createPlayerWithHeroes(50, 3, 100),
      lastFreeRefreshTime: 0,
    };
    const opponents = createDiverseOpponents(10, 7000, 95);
    const result = arena.freeRefresh(state, opponents, now);
    expect(result.lastFreeRefreshTime).toBe(now);
    expect(result.opponents.length).toBeGreaterThan(0);
  });

  it('should throw on free refresh during cooldown', () => {
    const now = 10_000_000;
    const state = {
      ...createDefaultArenaPlayerState(),
      lastFreeRefreshTime: now - 1000,
    };
    expect(() => arena.freeRefresh(state, [], now)).toThrow('免费刷新冷却中');
  });

  it('should consume 500 copper on manual refresh', () => {
    const state = createPlayerWithHeroes(50, 3, 100);
    const opponents = createDiverseOpponents(10, 7000, 95);
    const result = arena.manualRefresh(state, opponents, 1_000_000);
    expect(result.cost).toBe(500);
    expect(result.state.dailyManualRefreshes).toBe(1);
  });

  it('should limit manual refresh to 10 per day', () => {
    const state = {
      ...createDefaultArenaPlayerState(),
      dailyManualRefreshes: 10,
    };
    expect(() => arena.manualRefresh(state, [], 1_000_000)).toThrow(
      '今日手动刷新次数已达上限',
    );
  });

  it('should consume a challenge and decrement counter', () => {
    const state = createDefaultArenaPlayerState();
    expect(state.dailyChallengesLeft).toBe(5);
    const result = arena.consumeChallenge(state);
    expect(result.dailyChallengesLeft).toBe(4);
  });

  it('should throw when no challenges left', () => {
    const state = {
      ...createDefaultArenaPlayerState(),
      dailyChallengesLeft: 0,
    };
    expect(() => arena.consumeChallenge(state)).toThrow('今日挑战次数已用完');
  });

  it('should buy extra challenge for 50 gold', () => {
    const state = createDefaultArenaPlayerState();
    const result = arena.buyChallenge(state);
    expect(result.state.dailyChallengesLeft).toBe(6);
    expect(result.state.dailyBoughtChallenges).toBe(1);
    expect(result.cost).toBe(50);
  });

  it('should limit challenge purchases to 5 per day', () => {
    const state = {
      ...createDefaultArenaPlayerState(),
      dailyBoughtChallenges: 5,
    };
    expect(() => arena.buyChallenge(state)).toThrow('今日购买次数已达上限');
  });

  it('should reset all daily counters on dailyReset', () => {
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

  it('should allow canChallenge when challenges remain', () => {
    const state = createDefaultArenaPlayerState();
    expect(arena.canChallenge(state)).toBe(true);
  });

  it('should deny canChallenge when no challenges left', () => {
    const state = {
      ...createDefaultArenaPlayerState(),
      dailyChallengesLeft: 0,
    };
    expect(arena.canChallenge(state)).toBe(false);
  });

});

// ═══════════════════════════════════════════════════════════════
// §3 PvP战斗结果处理
// ═══════════════════════════════════════════════════════════════
describe('v11.0 竞技场 — §3 PvP战斗结果处理', () => {
  let battle: PvPBattleSystem;

  beforeEach(() => {
    battle = new PvPBattleSystem();
  });

  it('should execute auto mode battle and return result', () => {
    const attacker = createPlayerWithHeroes(500, 5, 50);
    const defender = createPlayerWithHeroes(400, 4, 51);
    defender.playerId = 'defender';

    const result = battle.executeBattle(attacker, defender, PvPBattleMode.AUTO);
    expect(result.battleId).toBeTruthy();
    expect(result.attackerId).toBeTruthy();
    expect(result.defenderId).toBe('defender');
    expect(typeof result.attackerWon).toBe('boolean');
  });

  it('should execute semi-auto mode battle', () => {
    const attacker = createPlayerWithHeroes(500, 5, 50);
    const defender = createPlayerWithHeroes(400, 4, 51);

    const result = battle.executeBattle(attacker, defender, PvPBattleMode.SEMI_AUTO);
    expect(result.battleId).toBeTruthy();
    expect(result.totalTurns).toBeGreaterThanOrEqual(1);
    expect(result.totalTurns).toBeLessThanOrEqual(10);
  });

  it('should give win score in +30~+60 range', () => {
    const scores = new Set<number>();
    for (let i = 0; i < 100; i++) {
      scores.add(battle.calculateWinScore());
    }
    for (const s of scores) {
      expect(s).toBeGreaterThanOrEqual(30);
      expect(s).toBeLessThanOrEqual(60);
    }
  });

  it('should give lose score in -15~-30 range', () => {
    const scores = new Set<number>();
    for (let i = 0; i < 100; i++) {
      scores.add(battle.calculateLoseScore());
    }
    for (const s of scores) {
      expect(s).toBeLessThanOrEqual(-15);
      expect(s).toBeGreaterThanOrEqual(-30);
    }
  });

  it('should apply score change and update rank', () => {
    const state = createDefaultArenaPlayerState();
    expect(state.rankId).toBe('BRONZE_V');

    const updated = battle.applyScoreChange(state, 350);
    expect(updated.score).toBe(350);
    expect(updated.rankId).toBe('BRONZE_IV');
  });

  it('should not let score drop below 0', () => {
    const state = createDefaultArenaPlayerState();
    const updated = battle.applyScoreChange(state, -100);
    expect(updated.score).toBe(0);
  });

  it('should apply battle result and award arena coins', () => {
    const attacker = createPlayerWithHeroes(500, 5, 50);
    const defender = createPlayerWithHeroes(400, 4, 51);

    const result = battle.executeBattle(attacker, defender);
    const updated = battle.applyBattleResult(attacker, result);

    expect(updated.score).toBeGreaterThanOrEqual(0);
    expect(updated.arenaCoins).toBeGreaterThan(0);
  });

  it('should give 5% defense bonus', () => {
    const config = battle.getBattleConfig();
    expect(config.defenseBonusRatio).toBe(0.05);
  });

  it('should declare defender winner on timeout', () => {
    const config = battle.getBattleConfig();
    expect(config.timeoutWinner).toBe('defender');
  });

  it('should include timeout flag in battle result', () => {
    const attacker = createPlayerWithHeroes(500, 5, 50);
    const defender = createPlayerWithHeroes(400, 4, 51);

    const result = battle.executeBattle(attacker, defender);
    expect(typeof result.isTimeout).toBe('boolean');
  });

});

// ═══════════════════════════════════════════════════════════════
// §4 段位升降级
// ═══════════════════════════════════════════════════════════════
describe('v11.0 竞技场 — §4 段位升降级', () => {
  let battle: PvPBattleSystem;

  beforeEach(() => {
    battle = new PvPBattleSystem();
  });

  it('should have 21 rank levels total', () => {
    const allRanks = battle.getAllRankLevels();
    expect(allRanks.length).toBe(21);
  });

  it('should have 5 major tiers: BRONZE/SILVER/GOLD/DIAMOND/KING', () => {
    const allRanks = battle.getAllRankLevels();
    const tiers = [...new Set(allRanks.map((r) => r.tier))];
    expect(tiers).toEqual(['BRONZE', 'SILVER', 'GOLD', 'DIAMOND', 'KING']);
  });

  it('should map score 0 to BRONZE_V', () => {
    expect(battle.getRankIdForScore(0)).toBe('BRONZE_V');
  });

  it('should map score 300 to BRONZE_IV', () => {
    expect(battle.getRankIdForScore(300)).toBe('BRONZE_IV');
  });

  it('should map score 1500 to SILVER_V', () => {
    expect(battle.getRankIdForScore(1500)).toBe('SILVER_V');
  });

  it('should map score 3000 to GOLD_V', () => {
    expect(battle.getRankIdForScore(3000)).toBe('GOLD_V');
  });

  it('should map score 5000 to DIAMOND_V', () => {
    expect(battle.getRankIdForScore(5000)).toBe('DIAMOND_V');
  });

  it('should map score 10000 to KING_I', () => {
    expect(battle.getRankIdForScore(10000)).toBe('KING_I');
  });

  it('should detect rank up correctly', () => {
    expect(battle.isRankUp('BRONZE_V', 'BRONZE_IV')).toBe(true);
    expect(battle.isRankUp('BRONZE_I', 'SILVER_V')).toBe(true);
    expect(battle.isRankUp('BRONZE_IV', 'BRONZE_V')).toBe(false);
  });

  it('should detect rank down correctly', () => {
    expect(battle.isRankDown('BRONZE_IV', 'BRONZE_V')).toBe(true);
    expect(battle.isRankDown('SILVER_V', 'BRONZE_I')).toBe(true);
    expect(battle.isRankDown('BRONZE_V', 'BRONZE_IV')).toBe(false);
  });

  it('should provide daily rewards per rank', () => {
    const reward = battle.getDailyReward('BRONZE_V');
    expect(reward.copper).toBe(500);
    expect(reward.arenaCoin).toBe(10);
    expect(reward.gold).toBe(5);
  });

  it('should give higher rewards for higher ranks', () => {
    const bronzeReward = battle.getDailyReward('BRONZE_V');
    const goldReward = battle.getDailyReward('GOLD_V');
    const kingReward = battle.getDailyReward('KING_I');

    expect(goldReward.arenaCoin).toBeGreaterThan(bronzeReward.arenaCoin);
    expect(kingReward.arenaCoin).toBeGreaterThan(goldReward.arenaCoin);
  });

});

// ═══════════════════════════════════════════════════════════════
// §5 竞技商店兑换
// ═══════════════════════════════════════════════════════════════
describe('v11.0 竞技场 — §5 竞技商店兑换', () => {
  let shop: ArenaShopSystem;

  beforeEach(() => {
    shop = new ArenaShopSystem();
  });

  it('should list all default shop items', () => {
    const items = shop.getAllItems();
    expect(items.length).toBe(DEFAULT_ARENA_SHOP_ITEMS.length);
  });

  it('should filter items by type', () => {
    const fragments = shop.getItemsByType('hero_fragment');
    const stones = shop.getItemsByType('enhance_stone');
    expect(fragments.length).toBeGreaterThan(0);
    expect(stones.length).toBeGreaterThan(0);
    for (const f of fragments) {
      expect(f.itemType).toBe('hero_fragment');
    }
  });

  it('should get a single item by id', () => {
    const item = shop.getItem('fragment_liubei');
    expect(item).toBeDefined();
    expect(item!.itemName).toBe('刘备碎片');
    expect(item!.arenaCoinCost).toBe(100);
  });

  it('should return undefined for non-existent item', () => {
    const item = shop.getItem('nonexistent_item');
    expect(item).toBeUndefined();
  });

  it('should buy item with sufficient arena coins', () => {
    const player = createPlayerWithCoins(500);
    const result = shop.buyItem(player, 'fragment_liubei', 1);
    expect(result.state.arenaCoins).toBe(400);
    expect(result.item.purchased).toBe(1);
  });

  it('should throw when arena coins insufficient', () => {
    const player = createPlayerWithCoins(50);
    expect(() => shop.buyItem(player, 'fragment_liubei', 1)).toThrow('竞技币不足');
  });

  it('should throw when item does not exist', () => {
    const player = createPlayerWithCoins(99999);
    expect(() => shop.buyItem(player, 'fake_item', 1)).toThrow('商品不存在');
  });

  it('should enforce weekly purchase limit', () => {
    const player = createPlayerWithCoins(10000);
    // fragment_zhaoyun costs 150, weeklyLimit 3
    shop.buyItem(player, 'fragment_zhaoyun', 3);
    const player2 = createPlayerWithCoins(10000);
    expect(() => shop.buyItem(player2, 'fragment_zhaoyun', 1)).toThrow(/每周限购/);
  });

  it('should allow unlimited purchase when weeklyLimit is 0', () => {
    const player = createPlayerWithCoins(5000);
    // equip_box_bronze has weeklyLimit 0
    const result = shop.buyItem(player, 'equip_box_bronze', 5);
    expect(result.state.arenaCoins).toBe(5000 - 80 * 5);
  });

  it('should check canBuy correctly', () => {
    const poor = createPlayerWithCoins(10);
    const rich = createPlayerWithCoins(10000);

    const poorCheck = shop.canBuy(poor, 'fragment_liubei', 1);
    expect(poorCheck.canBuy).toBe(false);
    expect(poorCheck.reason).toBe('竞技币不足');

    const richCheck = shop.canBuy(rich, 'fragment_liubei', 1);
    expect(richCheck.canBuy).toBe(true);
  });

  it('should reset weekly limits on weeklyReset', () => {
    const player = createPlayerWithCoins(10000);
    shop.buyItem(player, 'fragment_liubei', 1);
    shop.weeklyReset();

    const items = shop.getAllItems();
    const liubei = items.find((i) => i.itemId === 'fragment_liubei');
    expect(liubei!.purchased).toBe(0);
  });

  it('should throw when buying count <= 0', () => {
    const player = createPlayerWithCoins(10000);
    expect(() => shop.buyItem(player, 'fragment_liubei', 0)).toThrow('购买数量必须大于0');
  });

});

// ═══════════════════════════════════════════════════════════════
// §6 防守编队设置
// ═══════════════════════════════════════════════════════════════
describe('v11.0 竞技场 — §6 防守编队设置', () => {
  let defense: DefenseFormationSystem;

  beforeEach(() => {
    defense = new DefenseFormationSystem();
  });

  it('should create default defense formation with 5 empty slots', () => {
    const formation = defense.createDefaultFormation();
    expect(formation.slots).toEqual(['', '', '', '', '']);
    expect(formation.formation).toBe(FormationType.FISH_SCALE);
    expect(formation.strategy).toBe(AIDefenseStrategy.BALANCED);
  });

  it('should set formation with hero slots', () => {
    const base = defense.createDefaultFormation();
    const updated = defense.setFormation(base, ['hero1', 'hero2', 'hero3', '', '']);
    expect(updated.slots[0]).toBe('hero1');
    expect(updated.slots[1]).toBe('hero2');
    expect(updated.slots[2]).toBe('hero3');
    expect(updated.slots[3]).toBe('');
    expect(updated.slots[4]).toBe('');
  });

  it('should change formation type', () => {
    const base = defense.createDefaultFormation();
    const updated = defense.setFormationType(base, FormationType.WEDGE);
    expect(updated.formation).toBe(FormationType.WEDGE);
  });

  it('should change AI strategy', () => {
    const base = defense.createDefaultFormation();
    const updated = defense.setStrategy(base, AIDefenseStrategy.AGGRESSIVE);
    expect(updated.strategy).toBe(AIDefenseStrategy.AGGRESSIVE);
  });

  it('should validate formation with too few heroes', () => {
    const formation = defense.createDefaultFormation();
    const validation = defense.validateFormation(formation);
    expect(validation.valid).toBe(false);
    expect(validation.errors.length).toBeGreaterThan(0);
  });

  it('should validate formation with sufficient heroes', () => {
    const formation = defense.setFormation(
      defense.createDefaultFormation(),
      ['h1', 'h2', 'h3', '', ''],
    );
    const validation = defense.validateFormation(formation);
    expect(validation.valid).toBe(true);
  });

  it('should count heroes in formation', () => {
    const formation = defense.setFormation(
      defense.createDefaultFormation(),
      ['h1', 'h2', '', '', ''],
    );
    expect(defense.getHeroCount(formation)).toBe(2);
  });

  it('should get hero IDs from formation', () => {
    const formation = defense.setFormation(
      defense.createDefaultFormation(),
      ['h1', 'h2', 'h3', '', ''],
    );
    const ids = defense.getHeroIds(formation);
    expect(ids).toEqual(['h1', 'h2', 'h3']);
  });

  it('should create snapshot from formation', () => {
    const formation = defense.setFormation(
      defense.createDefaultFormation(),
      ['h1', 'h2', 'h3', 'h4', 'h5'],
    );
    const snapshot = defense.createSnapshot(formation);
    expect(snapshot.slots).toEqual(['h1', 'h2', 'h3', 'h4', 'h5']);
    expect(snapshot.formation).toBe(FormationType.FISH_SCALE);
    expect(snapshot.aiStrategy).toBe(AIDefenseStrategy.BALANCED);
  });

  it('should track defense logs and compute stats', () => {
    const state = createDefaultArenaPlayerState();
    const now = Date.now();

    const logs1 = defense.addDefenseLog(state.defenseLogs, {
      attackerId: 'atk1',
      attackerName: 'Attacker1',
      defenderWon: true,
      turns: 5,
      attackerRank: 'BRONZE_V',
    });

    const logs2 = defense.addDefenseLog(logs1, {
      attackerId: 'atk2',
      attackerName: 'Attacker2',
      defenderWon: false,
      turns: 8,
      attackerRank: 'BRONZE_IV',
    });

    const stats = defense.getDefenseStats(logs2);
    expect(stats.totalDefenses).toBe(2);
    expect(stats.wins).toBe(1);
    expect(stats.losses).toBe(1);
    expect(stats.winRate).toBe(0.5);
  });

  it('should get recent defense logs', () => {
    const state = createDefaultArenaPlayerState();
    const now = Date.now();
    let logs = state.defenseLogs;
    for (let i = 0; i < 15; i++) {
      logs = defense.addDefenseLog(logs, {
        attackerId: `atk${i}`,
        attackerName: `Attacker${i}`,
        defenderWon: i % 2 === 0,
        turns: 5,
        attackerRank: 'BRONZE_V',
      });
    }

    const recent = defense.getRecentLogs(logs, 5);
    expect(recent.length).toBe(5);
  });

});

// ═══════════════════════════════════════════════════════════════
// §7 跨系统联动：竞技场→战斗→排名→商店
// ═══════════════════════════════════════════════════════════════
describe('v11.0 竞技场 — §7 跨系统联动', () => {
  let arena: ArenaSystem;
  let battle: PvPBattleSystem;
  let ranking: RankingSystem;
  let shop: ArenaShopSystem;

  beforeEach(() => {
    arena = new ArenaSystem();
    battle = new PvPBattleSystem();
    ranking = new RankingSystem();
    shop = new ArenaShopSystem();
  });

  it('should complete full arena loop: match→challenge→battle→score→shop', () => {
    // 1. 初始化玩家
    let player = createPlayerWithHeroes(500, 5, 50);

    // 2. 注册对手池
    const opponents = createDiverseOpponents(20, 7000, 40);

    // 3. 刷新对手 (freeIntervalMs=30min, lastFreeRefreshTime defaults to 0)
    player = arena.freeRefresh(player, opponents, 2_000_000);
    expect(player.opponents.length).toBeGreaterThan(0);

    // 4. 消耗挑战次数
    player = arena.consumeChallenge(player);
    expect(player.dailyChallengesLeft).toBe(4);

    // 5. 执行战斗
    const defender = createPlayerWithHeroes(400, 4, 51);
    defender.playerId = player.opponents[0]?.playerId || 'defender';
    const result = battle.executeBattle(player, defender);

    // 6. 应用战斗结果
    player = battle.applyBattleResult(player, result);
    expect(player.score).toBeGreaterThanOrEqual(0);

    // 7. 如果有竞技币，去商店买东西
    if (player.arenaCoins >= 100) {
      const buyResult = shop.buyItem(player, 'fragment_liubei', 1);
      player = buyResult.state;
      expect(player.arenaCoins).toBeGreaterThanOrEqual(0);
    }
  });

  it('should update ranking after battle', () => {
    const players = createDiverseOpponents(10, 8000, 1);
    ranking.updateRanking(RankingDimension.POWER, players, Date.now());

    const rank = ranking.getPlayerRank(RankingDimension.POWER, 'player_0');
    expect(rank).toBeGreaterThan(0);
  });

  it('should simulate daily reset and re-engage', () => {
    let player = createPlayerWithHeroes(500, 5, 50);
    const opponents = createDiverseOpponents(10, 7000, 45);

    // 用完挑战次数
    for (let i = 0; i < 5; i++) {
      player = arena.consumeChallenge(player);
    }
    expect(player.dailyChallengesLeft).toBe(0);
    expect(arena.canChallenge(player)).toBe(false);

    // 每日重置
    player = arena.dailyReset(player);
    expect(player.dailyChallengesLeft).toBe(5);
    expect(arena.canChallenge(player)).toBe(true);

    // 重新刷新并挑战
    player = arena.freeRefresh(player, opponents, 2_000_000);
    expect(player.opponents.length).toBeGreaterThan(0);
  });

});
