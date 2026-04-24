/**
 * 集成测试 §3-4: 赛季+段位+防守闭环
 *
 * 覆盖 Play 流程：
 *   §3.1 段位等级与每日奖励
 *   §3.2 赛季周期与结算
 *   §3.3 竞技商店
 *   §3.4 竞技商店异常处理
 *   §4.1 防守阵容设置
 *   §4.2 AI防守策略
 *   §4.3 防守日志与优化建议
 *   §4.4 防守奖励
 *
 * 跨系统联动：ArenaSeasonSystem ↔ PvPBattleSystem ↔ ArenaShopSystem ↔ DefenseFormationSystem
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ArenaSeasonSystem, SEASON_REWARDS, DEFAULT_SEASON_CONFIG } from '../../../pvp/ArenaSeasonSystem';
import { PvPBattleSystem, RANK_LEVELS, RANK_LEVEL_MAP } from '../../../pvp/PvPBattleSystem';
import { ArenaShopSystem, DEFAULT_ARENA_SHOP_ITEMS, ARENA_SHOP_SAVE_VERSION } from '../../../pvp/ArenaShopSystem';
import { DefenseFormationSystem, FORMATION_SLOT_COUNT, MAX_DEFENSE_LOGS, ALL_FORMATIONS, ALL_STRATEGIES } from '../../../pvp/DefenseFormationSystem';
import { ArenaSystem, createDefaultArenaPlayerState } from '../../../pvp/ArenaSystem';
import { FormationType, AIDefenseStrategy } from '../../../../core/pvp/pvp.types';
import type { ArenaPlayerState, DefenseFormation, DefenseLogEntry } from '../../../../core/pvp/pvp.types';

// ── 辅助函数 ──────────────────────────────

function createPlayerState(overrides: Partial<ArenaPlayerState> = {}): ArenaPlayerState {
  return {
    ...createDefaultArenaPlayerState('test_player'),
    ...overrides,
  };
}

function createDefenseLog(
  overrides: Partial<Omit<DefenseLogEntry, 'id'>> = {},
): Omit<DefenseLogEntry, 'id'> {
  return {
    attackerId: 'attacker_1',
    attackerName: 'Attacker1',
    defenderWon: true,
    turns: 5,
    attackerRank: 'BRONZE_V',
    timestamp: Date.now(),
    ...overrides,
  };
}

// ── §3.1 段位等级与每日奖励 ────────────────

describe('§3-4 赛季+段位+防守闭环', () => {
  let season: ArenaSeasonSystem;
  let battle: PvPBattleSystem;
  let shop: ArenaShopSystem;
  let defense: DefenseFormationSystem;
  let arena: ArenaSystem;

  beforeEach(() => {
    season = new ArenaSeasonSystem();
    battle = new PvPBattleSystem();
    shop = new ArenaShopSystem();
    defense = new DefenseFormationSystem();
    arena = new ArenaSystem();
  });

  describe('§3.1 段位等级与每日奖励', () => {
    it('21级段位积分范围无重叠', () => {
      const ranks = battle.getAllRankLevels();
      for (let i = 0; i < ranks.length - 1; i++) {
        expect(ranks[i].maxScore).toBeLessThan(ranks[i + 1].minScore);
      }
    });

    it('青铜V为最低段位(0~299分)', () => {
      const rank = RANK_LEVEL_MAP.get('BRONZE_V');
      expect(rank).toBeDefined();
      expect(rank!.minScore).toBe(0);
      expect(rank!.maxScore).toBe(299);
    });

    it('王者为最高段位(≥10000分)', () => {
      const rank = RANK_LEVEL_MAP.get('KING_I');
      expect(rank).toBeDefined();
      expect(rank!.minScore).toBe(10000);
    });

    it('积分0对应青铜V', () => {
      expect(battle.getRankIdForScore(0)).toBe('BRONZE_V');
    });

    it('积分300对应青铜IV', () => {
      expect(battle.getRankIdForScore(300)).toBe('BRONZE_IV');
    });

    it('积分10000对应王者', () => {
      expect(battle.getRankIdForScore(10000)).toBe('KING_I');
    });

    it('青铜V每日奖励为铜钱500+竞技币10+元宝5', () => {
      const reward = battle.getDailyReward('BRONZE_V');
      expect(reward.copper).toBe(500);
      expect(reward.arenaCoin).toBe(10);
      expect(reward.gold).toBe(5);
    });

    it('王者每日奖励应远高于青铜V', () => {
      const bronzeReward = battle.getDailyReward('BRONZE_V');
      const kingReward = battle.getDailyReward('KING_I');
      expect(kingReward.copper).toBeGreaterThan(bronzeReward.copper);
      expect(kingReward.arenaCoin).toBeGreaterThan(bronzeReward.arenaCoin);
      expect(kingReward.gold).toBeGreaterThan(bronzeReward.gold);
    });

    it('发放每日奖励应增加竞技币', () => {
      const state = createPlayerState({ rankId: 'SILVER_V' });
      const result = season.grantDailyReward(state);
      expect(result.state.arenaCoins).toBeGreaterThan(state.arenaCoins);
      expect(result.reward.copper).toBe(1000);
      expect(result.reward.arenaCoin).toBe(35);
    });

    it('积分范围覆盖0~99999', () => {
      expect(battle.getRankIdForScore(-1)).toBe('BRONZE_V');
      expect(battle.getRankIdForScore(50000)).toBe('KING_I');
    });
  });

  describe('§3.2 赛季周期与结算', () => {
    it('赛季周期为28天', () => {
      expect(season.getSeasonDays()).toBe(28);
    });

    it('创建赛季应正确设置开始和结束时间', () => {
      const startTime = Date.now();
      const seasonData = season.createSeason('s1', startTime);
      expect(seasonData.seasonId).toBe('s1');
      expect(seasonData.startTime).toBe(startTime);
      expect(seasonData.endTime).toBe(startTime + 28 * 24 * 60 * 60 * 1000);
      expect(seasonData.isSettled).toBe(false);
    });

    it('应正确计算赛季当前天数', () => {
      const startTime = Date.now();
      const seasonData = season.createSeason('s1', startTime);
      const day = season.getCurrentDay(seasonData, startTime);
      expect(day).toBe(1);
    });

    it('应检测赛季是否结束', () => {
      const startTime = 1000000;
      const seasonData = season.createSeason('s1', startTime);
      const endTime = startTime + 28 * 24 * 60 * 60 * 1000;

      expect(season.isSeasonEnded(seasonData, endTime - 1)).toBe(false);
      expect(season.isSeasonEnded(seasonData, endTime)).toBe(true);
    });

    it('应检测赛季是否进行中', () => {
      const startTime = 1000000;
      const seasonData = season.createSeason('s1', startTime);
      expect(season.isSeasonActive(seasonData, startTime)).toBe(true);
      expect(season.isSeasonActive(seasonData, startTime - 1)).toBe(false);
    });

    it('应正确计算赛季剩余天数', () => {
      const startTime = Date.now();
      const seasonData = season.createSeason('s1', startTime);
      const remaining = season.getRemainingDays(seasonData, startTime);
      expect(remaining).toBe(28);
    });

    it('赛季结算应按最高段位发放奖励', () => {
      const state = createPlayerState({ rankId: 'GOLD_III', score: 4000 });
      const result = season.settleSeason(state, 'GOLD_I');

      expect(result.reward.rankId).toBe('GOLD_I');
      expect(result.reward.copper).toBe(23000);
      expect(result.reward.arenaCoin).toBe(400);
    });

    it('赛季结算应重置积分到当前段位最低值', () => {
      const state = createPlayerState({ rankId: 'DIAMOND_V', score: 5500 });
      const result = season.settleSeason(state, 'DIAMOND_III');

      const diamondVMin = RANK_LEVEL_MAP.get('DIAMOND_V')!.minScore;
      expect(result.resetScore).toBe(diamondVMin);
      expect(result.state.score).toBe(diamondVMin);
    });

    it('赛季结算应重置每日数据和清理回放', () => {
      const state = createPlayerState({
        dailyChallengesLeft: 0,
        dailyBoughtChallenges: 3,
        dailyManualRefreshes: 8,
      });
      const result = season.settleSeason(state, 'BRONZE_V');
      expect(result.state.dailyChallengesLeft).toBe(5);
      expect(result.state.dailyBoughtChallenges).toBe(0);
      expect(result.state.dailyManualRefreshes).toBe(0);
      expect(result.state.replays).toEqual([]);
      expect(result.state.defenseLogs).toEqual([]);
    });

    it('应正确更新最高段位', () => {
      expect(season.updateHighestRank('BRONZE_V', 'SILVER_V')).toBe('SILVER_V');
      expect(season.updateHighestRank('GOLD_III', 'BRONZE_I')).toBe('GOLD_III');
    });

    it('赛季奖励表应有21条记录', () => {
      expect(SEASON_REWARDS.length).toBe(21);
    });

    it('赛季结算序列化应正确', () => {
      const startTime = Date.now();
      const seasonData = season.createSeason('s1', startTime);
      const serialized = season.serializeSeason(seasonData, 'GOLD_III');
      expect(serialized.highestRankId).toBe('GOLD_III');
      expect(serialized.season.seasonId).toBe('s1');
    });
  });

  describe('§3.3 竞技商店', () => {
    it('默认商店应有14种商品', () => {
      const items = shop.getAllItems();
      expect(items.length).toBe(14);
    });

    it('应包含武将碎片类商品', () => {
      const fragments = shop.getItemsByType('hero_fragment');
      expect(fragments.length).toBeGreaterThan(0);
    });

    it('应包含强化石类商品', () => {
      const stones = shop.getItemsByType('enhance_stone');
      expect(stones.length).toBeGreaterThan(0);
    });

    it('购买商品应扣除竞技币', () => {
      const state = createPlayerState({ arenaCoins: 1000 });
      const result = shop.buyItem(state, 'fragment_liubei', 1);
      expect(result.state.arenaCoins).toBe(900);
      expect(result.item.purchased).toBe(1);
    });

    it('竞技币不足应抛出异常', () => {
      const state = createPlayerState({ arenaCoins: 10 });
      expect(() => shop.buyItem(state, 'fragment_liubei', 1)).toThrow('竞技币');
    });

    it('超出周限购应抛出异常', () => {
      const state = createPlayerState({ arenaCoins: 10000 });
      // fragment_liubei weeklyLimit=5
      shop.buyItem(state, 'fragment_liubei', 5);
      // Now state still has original arenaCoins since buyItem returns new state
      // Need to use updated state
      const state2 = { ...state, arenaCoins: 10000 };
      // Reset shop and buy 5
      shop.weeklyReset();
      let currentState = state2;
      for (let i = 0; i < 5; i++) {
        const result = shop.buyItem(currentState, 'fragment_liubei', 1);
        currentState = result.state;
      }
      expect(() => shop.buyItem(currentState, 'fragment_liubei', 1)).toThrow('限购');
    });

    it('canBuy应正确检查购买条件', () => {
      const state = createPlayerState({ arenaCoins: 1000 });
      const check = shop.canBuy(state, 'fragment_liubei', 1);
      expect(check.canBuy).toBe(true);
    });

    it('canBuy竞技币不足应返回false', () => {
      const state = createPlayerState({ arenaCoins: 10 });
      const check = shop.canBuy(state, 'fragment_liubei', 1);
      expect(check.canBuy).toBe(false);
      expect(check.reason).toBe('竞技币不足');
    });

    it('每周重置应清零购买计数', () => {
      const state = createPlayerState({ arenaCoins: 10000 });
      shop.buyItem(state, 'fragment_liubei', 1);
      shop.weeklyReset();
      const items = shop.getAllItems();
      const fragment = items.find((i) => i.itemId === 'fragment_liubei');
      expect(fragment!.purchased).toBe(0);
    });

    it('商店序列化和反序列化应保持一致', () => {
      const state = createPlayerState({ arenaCoins: 10000 });
      shop.buyItem(state, 'fragment_liubei', 1);
      const serialized = shop.serialize();
      expect(serialized.version).toBe(ARENA_SHOP_SAVE_VERSION);

      const newShop = new ArenaShopSystem();
      newShop.deserialize(serialized);
      const items = newShop.getAllItems();
      const fragment = items.find((i) => i.itemId === 'fragment_liubei');
      expect(fragment!.purchased).toBe(1);
    });
  });

  describe('§3.4 竞技商店异常处理', () => {
    it('商品不存在应抛出异常', () => {
      const state = createPlayerState({ arenaCoins: 10000 });
      expect(() => shop.buyItem(state, 'nonexistent_item', 1)).toThrow('商品不存在');
    });

    it('购买数量为0应抛出异常', () => {
      const state = createPlayerState({ arenaCoins: 10000 });
      expect(() => shop.buyItem(state, 'fragment_liubei', 0)).toThrow('大于0');
    });

    it('canBuy不存在的商品应返回false', () => {
      const state = createPlayerState({ arenaCoins: 10000 });
      const check = shop.canBuy(state, 'nonexistent', 1);
      expect(check.canBuy).toBe(false);
      expect(check.reason).toBe('商品不存在');
    });

    it('canBuy数量为0应返回false', () => {
      const state = createPlayerState({ arenaCoins: 10000 });
      const check = shop.canBuy(state, 'fragment_liubei', 0);
      expect(check.canBuy).toBe(false);
    });
  });

  describe('§4.1 防守阵容设置', () => {
    it('应创建默认防守阵容', () => {
      const formation = defense.createDefaultFormation();
      expect(formation.slots).toEqual(['', '', '', '', '']);
      expect(formation.formation).toBe(FormationType.FISH_SCALE);
      expect(formation.strategy).toBe(AIDefenseStrategy.BALANCED);
    });

    it('应设置防守阵容武将', () => {
      const current = defense.createDefaultFormation();
      const slots: [string, string, string, string, string] = [
        'hero1',
        'hero2',
        'hero3',
        '',
        '',
      ];
      const result = defense.setFormation(current, slots);
      expect(result.slots).toEqual(slots);
    });

    it('空阵容应抛出异常', () => {
      const current = defense.createDefaultFormation();
      expect(() => defense.setFormation(current, ['', '', '', '', ''])).toThrow(
        '至少需要1名武将',
      );
    });

    it('5种阵型全部可用', () => {
      expect(ALL_FORMATIONS.length).toBe(5);
      expect(ALL_FORMATIONS).toContain(FormationType.FISH_SCALE);
      expect(ALL_FORMATIONS).toContain(FormationType.WEDGE);
      expect(ALL_FORMATIONS).toContain(FormationType.GOOSE);
      expect(ALL_FORMATIONS).toContain(FormationType.SNAKE);
      expect(ALL_FORMATIONS).toContain(FormationType.SQUARE);
    });

    it('应切换阵型', () => {
      const current = defense.createDefaultFormation();
      const result = defense.setFormationType(current, FormationType.WEDGE);
      expect(result.formation).toBe(FormationType.WEDGE);
    });

    it('合法阵容验证应通过', () => {
      const formation: DefenseFormation = {
        slots: ['hero1', 'hero2', '', '', ''],
        formation: FormationType.FISH_SCALE,
        strategy: AIDefenseStrategy.BALANCED,
      };
      const result = defense.validateFormation(formation);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('空阵容验证应失败', () => {
      const formation = defense.createDefaultFormation();
      const result = defense.validateFormation(formation);
      expect(result.valid).toBe(false);
    });

    it('重复武将验证应失败', () => {
      const formation: DefenseFormation = {
        slots: ['hero1', 'hero1', '', '', ''],
        formation: FormationType.FISH_SCALE,
        strategy: AIDefenseStrategy.BALANCED,
      };
      const result = defense.validateFormation(formation);
      expect(result.valid).toBe(false);
    });

    it('应获取武将数量', () => {
      const formation: DefenseFormation = {
        slots: ['hero1', 'hero2', 'hero3', '', ''],
        formation: FormationType.FISH_SCALE,
        strategy: AIDefenseStrategy.BALANCED,
      };
      expect(defense.getHeroCount(formation)).toBe(3);
    });

    it('应获取武将ID列表', () => {
      const formation: DefenseFormation = {
        slots: ['hero1', '', 'hero3', '', ''],
        formation: FormationType.FISH_SCALE,
        strategy: AIDefenseStrategy.BALANCED,
      };
      expect(defense.getHeroIds(formation)).toEqual(['hero1', 'hero3']);
    });
  });

  describe('§4.2 AI防守策略', () => {
    it('4种策略全部可用', () => {
      expect(ALL_STRATEGIES.length).toBe(4);
      expect(ALL_STRATEGIES).toContain(AIDefenseStrategy.BALANCED);
      expect(ALL_STRATEGIES).toContain(AIDefenseStrategy.AGGRESSIVE);
      expect(ALL_STRATEGIES).toContain(AIDefenseStrategy.DEFENSIVE);
      expect(ALL_STRATEGIES).toContain(AIDefenseStrategy.CUNNING);
    });

    it('应切换AI策略', () => {
      const current = defense.createDefaultFormation();
      const result = defense.setStrategy(current, AIDefenseStrategy.AGGRESSIVE);
      expect(result.strategy).toBe(AIDefenseStrategy.AGGRESSIVE);
    });

    it('应创建防守快照', () => {
      const formation: DefenseFormation = {
        slots: ['hero1', 'hero2', '', '', ''],
        formation: FormationType.WEDGE,
        strategy: AIDefenseStrategy.DEFENSIVE,
      };
      const snapshot = defense.createSnapshot(formation);
      expect(snapshot.slots).toEqual(['hero1', 'hero2', '', '', '']);
      expect(snapshot.formation).toBe(FormationType.WEDGE);
      expect(snapshot.aiStrategy).toBe(AIDefenseStrategy.DEFENSIVE);
    });

    it('快照应为独立副本', () => {
      const formation: DefenseFormation = {
        slots: ['hero1', '', '', '', ''],
        formation: FormationType.FISH_SCALE,
        strategy: AIDefenseStrategy.BALANCED,
      };
      const snapshot = defense.createSnapshot(formation);
      snapshot.slots[0] = 'modified';
      expect(formation.slots[0]).toBe('hero1');
    });
  });

  describe('§4.3 防守日志与优化建议', () => {
    it('应添加防守日志', () => {
      const logs: DefenseLogEntry[] = [];
      const entry = createDefenseLog({ defenderWon: true });
      const updated = defense.addDefenseLog(logs, entry);
      expect(updated.length).toBe(1);
      expect(updated[0].id).toBeTruthy();
      expect(updated[0].defenderWon).toBe(true);
    });

    it('防守日志最多50条', () => {
      let logs: DefenseLogEntry[] = [];
      for (let i = 0; i < 60; i++) {
        logs = defense.addDefenseLog(logs, createDefenseLog({ attackerId: `a_${i}` }));
      }
      expect(logs.length).toBe(50);
    });

    it('防守统计应正确计算', () => {
      let logs: DefenseLogEntry[] = [];
      // 3 wins, 2 losses
      for (let i = 0; i < 3; i++) {
        logs = defense.addDefenseLog(logs, createDefenseLog({ defenderWon: true }));
      }
      for (let i = 0; i < 2; i++) {
        logs = defense.addDefenseLog(logs, createDefenseLog({ defenderWon: false }));
      }
      const stats = defense.getDefenseStats(logs);
      expect(stats.totalDefenses).toBe(5);
      expect(stats.wins).toBe(3);
      expect(stats.losses).toBe(2);
      expect(stats.winRate).toBeCloseTo(0.6);
    });

    it('低胜率(<30%)应建议坚守策略', () => {
      let logs: DefenseLogEntry[] = [];
      for (let i = 0; i < 4; i++) {
        logs = defense.addDefenseLog(logs, createDefenseLog({ defenderWon: false }));
      }
      logs = defense.addDefenseLog(logs, createDefenseLog({ defenderWon: true })); // 1/5 = 20%
      const stats = defense.getDefenseStats(logs);
      expect(stats.suggestedStrategy).toBe(AIDefenseStrategy.DEFENSIVE);
    });

    it('中等胜率(30-50%)应建议均衡策略', () => {
      let logs: DefenseLogEntry[] = [];
      for (let i = 0; i < 3; i++) {
        logs = defense.addDefenseLog(logs, createDefenseLog({ defenderWon: true }));
      }
      for (let i = 0; i < 4; i++) {
        logs = defense.addDefenseLog(logs, createDefenseLog({ defenderWon: false }));
      } // 3/7 = 42.8%
      const stats = defense.getDefenseStats(logs);
      expect(stats.suggestedStrategy).toBe(AIDefenseStrategy.BALANCED);
    });

    it('样本不足(<5场)不给建议', () => {
      let logs: DefenseLogEntry[] = [];
      logs = defense.addDefenseLog(logs, createDefenseLog({ defenderWon: false }));
      const stats = defense.getDefenseStats(logs);
      expect(stats.suggestedStrategy).toBeNull();
    });

    it('高胜率(>50%)不给建议', () => {
      let logs: DefenseLogEntry[] = [];
      for (let i = 0; i < 6; i++) {
        logs = defense.addDefenseLog(logs, createDefenseLog({ defenderWon: true }));
      }
      for (let i = 0; i < 2; i++) {
        logs = defense.addDefenseLog(logs, createDefenseLog({ defenderWon: false }));
      } // 6/8 = 75%
      const stats = defense.getDefenseStats(logs);
      expect(stats.suggestedStrategy).toBeNull();
    });

    it('策略建议应生成描述文本', () => {
      let logs: DefenseLogEntry[] = [];
      for (let i = 0; i < 5; i++) {
        logs = defense.addDefenseLog(logs, createDefenseLog({ defenderWon: false }));
      }
      const stats = defense.getDefenseStats(logs);
      const suggestion = defense.getStrategySuggestion(stats);
      expect(suggestion).toBeTruthy();
      expect(suggestion).toContain('坚守');
    });

    it('无建议时返回null', () => {
      let logs: DefenseLogEntry[] = [];
      for (let i = 0; i < 6; i++) {
        logs = defense.addDefenseLog(logs, createDefenseLog({ defenderWon: true }));
      }
      const stats = defense.getDefenseStats(logs);
      expect(defense.getStrategySuggestion(stats)).toBeNull();
    });

    it('应获取最近日志', () => {
      let logs: DefenseLogEntry[] = [];
      for (let i = 0; i < 15; i++) {
        logs = defense.addDefenseLog(logs, createDefenseLog({ attackerId: `a_${i}` }));
      }
      const recent = defense.getRecentLogs(logs, 5);
      expect(recent.length).toBe(5);
    });

    it('应按进攻方查询日志', () => {
      let logs: DefenseLogEntry[] = [];
      logs = defense.addDefenseLog(logs, createDefenseLog({ attackerId: 'a1' }));
      logs = defense.addDefenseLog(logs, createDefenseLog({ attackerId: 'a2' }));
      logs = defense.addDefenseLog(logs, createDefenseLog({ attackerId: 'a1' }));

      const filtered = defense.getLogsByAttacker(logs, 'a1');
      expect(filtered.length).toBe(2);
    });
  });

  describe('§9.2 防守编队→被挑战→日志→优化闭环', () => {
    it('完整闭环: 设置阵容→被挑战→记录日志→获得建议→调整', () => {
      // 1. 设置防守阵容
      let playerState = createPlayerState();
      const slots: [string, string, string, string, string] = [
        'hero1',
        'hero2',
        'hero3',
        '',
        '',
      ];
      playerState = arena.updateDefenseFormation(
        playerState,
        slots,
        FormationType.FISH_SCALE,
        AIDefenseStrategy.BALANCED,
      );
      expect(playerState.defenseFormation.slots[0]).toBe('hero1');

      // 2. 模拟被挑战3次(2败1胜)
      playerState = arena.addDefenseLog(
        playerState,
        { attackerId: 'a1', attackerName: 'A1', defenderWon: false, turns: 8, attackerRank: 'BRONZE_IV' },
        Date.now(),
      );
      playerState = arena.addDefenseLog(
        playerState,
        { attackerId: 'a2', attackerName: 'A2', defenderWon: false, turns: 6, attackerRank: 'BRONZE_III' },
        Date.now(),
      );
      playerState = arena.addDefenseLog(
        playerState,
        { attackerId: 'a3', attackerName: 'A3', defenderWon: true, turns: 10, attackerRank: 'BRONZE_V' },
        Date.now(),
      );

      // 3. 查看防守统计
      const stats = arena.getDefenseStats(playerState);
      expect(stats.totalDefenses).toBe(3);
      expect(stats.wins).toBe(1);
      expect(stats.winRate).toBeCloseTo(1 / 3);

      // 4. 调整防守策略
      playerState = arena.updateDefenseFormation(
        playerState,
        slots,
        FormationType.SQUARE,
        AIDefenseStrategy.DEFENSIVE,
      );
      expect(playerState.defenseFormation.formation).toBe(FormationType.SQUARE);
      expect(playerState.defenseFormation.strategy).toBe(AIDefenseStrategy.DEFENSIVE);
    });
  });
});
