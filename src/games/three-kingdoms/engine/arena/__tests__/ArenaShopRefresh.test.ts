/**
 * 竞技场 P1 缺口测试
 *
 * 覆盖：
 *   1. 竞技商店手动刷新（50币/次，3次免费/日）
 *   2. 战斗回放7天过期清理
 *   3. 赛季结算弹窗一次性弹出
 *
 * 使用真实引擎实例，不mock内部逻辑
 *
 * @module engine/arena/__tests__/ArenaShopRefresh.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ArenaShopSystem } from '../../pvp/ArenaShopSystem';
import { ArenaSystem } from '../../pvp/ArenaSystem';
import { ArenaSeasonSystem, SEASON_REWARDS } from '../../pvp/ArenaSeasonSystem';
import { PvPBattleSystem, REPLAY_CONFIG } from '../../pvp/PvPBattleSystem';
import { createDefaultArenaPlayerState } from '../../pvp/ArenaSystem.helpers';
import type { ArenaPlayerState, BattleReplay, SeasonData } from '../../../core/pvp/pvp.types';

// ─────────────────────────────────────────────
// 辅助函数
// ─────────────────────────────────────────────

/** 创建测试用玩家状态 */
function createPlayer(overrides: Partial<ArenaPlayerState> = {}): ArenaPlayerState {
  return {
    ...createDefaultArenaPlayerState('test-player'),
    arenaCoins: 500,
    score: 1000,
    rankId: 'BRONZE_II',
    ranking: 50,
    ...overrides,
  };
}

/** 创建模拟回放 */
function createReplay(id: string, timestamp: number): BattleReplay {
  return {
    id,
    battleId: `battle_${id}`,
    attackerName: '玩家A',
    defenderName: '玩家B',
    attackerWon: true,
    timestamp,
    totalTurns: 5,
    actions: [],
    result: {
      winner: 'attacker' as const,
      totalTurns: 5,
      mvp: 'hero_001',
    },
    keyMoments: [3],
  };
}

/** 创建赛季数据 */
function createSeason(overrides: Partial<SeasonData> = {}): SeasonData {
  const now = Date.now();
  return {
    seasonId: 'season-001',
    startTime: now - 27 * 24 * 60 * 60 * 1000, // 27天前
    endTime: now + 1 * 24 * 60 * 60 * 1000,     // 1天后结束
    currentDay: 27,
    isSettled: false,
    ...overrides,
  };
}

// ─────────────────────────────────────────────
// 1. 竞技商店手动刷新
// ─────────────────────────────────────────────

describe('竞技商店手动刷新', () => {
  let shopSystem: ArenaShopSystem;

  beforeEach(() => {
    shopSystem = new ArenaShopSystem();
  });

  describe('商店物品初始化', () => {
    it('默认加载14种商品', () => {
      const items = shopSystem.getAllItems();
      expect(items).toHaveLength(14);
    });

    it('商品包含所有4种类型', () => {
      const items = shopSystem.getAllItems();
      const types = new Set(items.map(i => i.itemType));
      expect(types.has('hero_fragment')).toBe(true);
      expect(types.has('enhance_stone')).toBe(true);
      expect(types.has('equipment_box')).toBe(true);
      expect(types.has('avatar_frame')).toBe(true);
    });

    it('每种商品有正确的竞技币价格', () => {
      const items = shopSystem.getAllItems();
      for (const item of items) {
        expect(item.arenaCoinCost).toBeGreaterThan(0);
      }
    });
  });

  describe('购买逻辑', () => {
    it('竞技币充足时可以购买商品', () => {
      const player = createPlayer({ arenaCoins: 1000 });
      const result = shopSystem.buyItem(player, 'fragment_liubei', 1);
      expect(result.state.arenaCoins).toBe(900); // 1000 - 100
      expect(result.item.purchased).toBe(1);
    });

    it('竞技币不足时拒绝购买', () => {
      const player = createPlayer({ arenaCoins: 50 });
      expect(() => shopSystem.buyItem(player, 'fragment_liubei', 1)).toThrow('竞技币不足');
    });

    it('超出周限购时拒绝购买', () => {
      const player = createPlayer({ arenaCoins: 10000 });
      shopSystem.buyItem(player, 'fragment_liubei', 5); // 周限5次
      expect(() => shopSystem.buyItem(player, 'fragment_liubei', 1)).toThrow('每周限购');
    });

    it('无限购商品可重复购买', () => {
      const player = createPlayer({ arenaCoins: 50000 });
      const item = shopSystem.getItem('equip_box_bronze');
      expect(item?.weeklyLimit).toBe(0); // 无限购
      const result = shopSystem.buyItem(player, 'equip_box_bronze', 3);
      expect(result.item.purchased).toBe(3);
    });

    it('批量购买正确计算总价', () => {
      const player = createPlayer({ arenaCoins: 5000 });
      const result = shopSystem.buyItem(player, 'enhance_stone_small', 5);
      // 50 * 5 = 250
      expect(result.state.arenaCoins).toBe(4750);
    });

    it('canBuy检查返回正确结果', () => {
      const player = createPlayer({ arenaCoins: 50 });
      const check = shopSystem.canBuy(player, 'fragment_liubei', 1);
      expect(check.canBuy).toBe(false);
      expect(check.reason).toBe('竞技币不足');
    });
  });

  describe('周重置', () => {
    it('重置后所有限购计数归零', () => {
      const player = createPlayer({ arenaCoins: 10000 });
      shopSystem.buyItem(player, 'fragment_liubei', 3);
      shopSystem.weeklyReset();
      const item = shopSystem.getItem('fragment_liubei');
      expect(item?.purchased).toBe(0);
    });

    it('重置后可再次购买', () => {
      const player = createPlayer({ arenaCoins: 10000 });
      shopSystem.buyItem(player, 'fragment_liubei', 5);
      shopSystem.weeklyReset();
      const result = shopSystem.buyItem(player, 'fragment_liubei', 1);
      expect(result.item.purchased).toBe(1);
    });
  });

  describe('序列化与反序列化', () => {
    it('序列化后反序列化数据一致', () => {
      const player = createPlayer({ arenaCoins: 10000 });
      shopSystem.buyItem(player, 'fragment_liubei', 2);
      const data = shopSystem.serialize();
      const newShop = new ArenaShopSystem();
      newShop.deserialize(data);
      const item = newShop.getItem('fragment_liubei');
      expect(item?.purchased).toBe(2);
    });
  });

  /**
   * TODO: PRD §SHP-3 规定的"竞技商店手动刷新"功能尚未在引擎中实现
   * PRD 规则：50竞技币/次，每日3次免费刷新
   * 当前 ArenaShopSystem 只有购买和周重置，缺少商店物品刷新逻辑
   * 需要补充：
   *   - shopRefresh(playerState, type: 'free' | 'paid') 方法
   *   - 每日免费刷新计数器 dailyFreeRefreshes
   *   - 付费刷新消耗竞技币（50币/次）
   *   - 每日免费上限（3次）
   */
  describe.todo('竞技商店手动刷新（50币/次，3次免费/日）', () => {
    it.todo('每日前3次刷新免费');
    it.todo('第4次起消耗50竞技币');
    it.todo('竞技币不足时拒绝刷新');
    it.todo('每日0点重置免费刷新计数');
    it.todo('刷新后商品列表随机变化');
  });
});

// ─────────────────────────────────────────────
// 2. 战斗回放7天过期清理
// ─────────────────────────────────────────────

describe('战斗回放7天过期清理', () => {
  let battleSystem: PvPBattleSystem;

  beforeEach(() => {
    battleSystem = new PvPBattleSystem();
  });

  describe('回放配置', () => {
    it('回放保留天数应为7天', () => {
      expect(REPLAY_CONFIG.retentionDays).toBe(7);
    });

    it('回放保留毫秒数应等于7天', () => {
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
      expect(REPLAY_CONFIG.retentionMs).toBe(sevenDaysMs);
    });

    it('最大保存回放数为50条', () => {
      expect(REPLAY_CONFIG.maxReplays).toBe(50);
    });
  });

  describe('回放保存', () => {
    it('新回放插入列表头部', () => {
      const player = createPlayer();
      const now = Date.now();
      const replay1 = createReplay('r1', now - 1000);
      const replay2 = createReplay('r2', now);

      let state = battleSystem.saveReplay(player, replay1);
      state = battleSystem.saveReplay(state, replay2);

      expect(state.replays).toHaveLength(2);
      expect(state.replays[0].id).toBe('r2'); // 最新的在前
    });

    it('超过50条时自动截断旧回放', () => {
      const player = createPlayer();
      const now = Date.now();
      let state = player;

      for (let i = 0; i < 55; i++) {
        state = battleSystem.saveReplay(state, createReplay(`r${i}`, now - i * 1000));
      }

      expect(state.replays).toHaveLength(50);
      // 最后插入的在头部（r54是最后插入的）
      expect(state.replays[0].id).toBe('r54');
      // 最早的5条被截断（r0~r4），r5应存在
      expect(state.replays.find(r => r.id === 'r0')).toBeUndefined();
      expect(state.replays.find(r => r.id === 'r5')).toBeDefined();
    });
  });

  describe('过期清理', () => {
    it('7天前的回放被清理', () => {
      const now = Date.now();
      const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

      const player = createPlayer({
        replays: [
          createReplay('old', sevenDaysAgo - 1),   // 超过7天，应被清理
          createReplay('recent', now - 1000),       // 近期，应保留
        ],
      });

      const cleaned = battleSystem.cleanExpiredReplays(player, now);
      expect(cleaned.replays).toHaveLength(1);
      expect(cleaned.replays[0].id).toBe('recent');
    });

    it('刚好7天的回放被保留（边界条件）', () => {
      const now = Date.now();
      const exactlySevenDays = now - 7 * 24 * 60 * 60 * 1000;

      const player = createPlayer({
        replays: [
          createReplay('boundary', exactlySevenDays),
        ],
      });

      const cleaned = battleSystem.cleanExpiredReplays(player, now);
      expect(cleaned.replays).toHaveLength(1);
    });

    it('6天23小时59分的回放被保留', () => {
      const now = Date.now();
      const almostSevenDays = now - (7 * 24 * 60 * 60 * 1000 - 60 * 1000);

      const player = createPlayer({
        replays: [
          createReplay('almost', almostSevenDays),
        ],
      });

      const cleaned = battleSystem.cleanExpiredReplays(player, now);
      expect(cleaned.replays).toHaveLength(1);
    });

    it('8天前的回放全部被清理', () => {
      const now = Date.now();
      const eightDaysAgo = now - 8 * 24 * 60 * 60 * 1000;

      const player = createPlayer({
        replays: [
          createReplay('old1', eightDaysAgo),
          createReplay('old2', eightDaysAgo + 1000),
          createReplay('old3', eightDaysAgo + 2000),
        ],
      });

      const cleaned = battleSystem.cleanExpiredReplays(player, now);
      expect(cleaned.replays).toHaveLength(0);
    });

    it('清理后不影响其他玩家状态', () => {
      const now = Date.now();
      const player = createPlayer({
        score: 1500,
        rankId: 'BRONZE_I',
        arenaCoins: 300,
        replays: [createReplay('old', now - 8 * 24 * 60 * 60 * 1000)],
      });

      const cleaned = battleSystem.cleanExpiredReplays(player, now);
      expect(cleaned.score).toBe(1500);
      expect(cleaned.rankId).toBe('BRONZE_I');
      expect(cleaned.arenaCoins).toBe(300);
    });

    it('空回放列表清理后仍为空', () => {
      const player = createPlayer({ replays: [] });
      const cleaned = battleSystem.cleanExpiredReplays(player, Date.now());
      expect(cleaned.replays).toHaveLength(0);
    });

    it('混合过期和未过期回放只保留未过期的', () => {
      const now = Date.now();
      const player = createPlayer({
        replays: [
          createReplay('expired1', now - 10 * 24 * 60 * 60 * 1000),
          createReplay('valid1', now - 3 * 24 * 60 * 60 * 1000),
          createReplay('expired2', now - 8 * 24 * 60 * 60 * 1000),
          createReplay('valid2', now - 1 * 24 * 60 * 60 * 1000),
          createReplay('valid3', now - 1000),
        ],
      });

      const cleaned = battleSystem.cleanExpiredReplays(player, now);
      expect(cleaned.replays).toHaveLength(3);
      const ids = cleaned.replays.map(r => r.id);
      expect(ids).toContain('valid1');
      expect(ids).toContain('valid2');
      expect(ids).toContain('valid3');
    });
  });

  describe('赛季结算时回放清理', () => {
    it('赛季结算后回放列表被清空', () => {
      const now = Date.now();
      const player = createPlayer({
        replays: [
          createReplay('r1', now - 1000),
          createReplay('r2', now - 2000),
        ],
      });

      const seasonSystem = new ArenaSeasonSystem();
      const result = seasonSystem.settleSeason(player, 'BRONZE_II');
      expect(result.state.replays).toHaveLength(0);
    });
  });
});

// ─────────────────────────────────────────────
// 3. 赛季结算弹窗一次性弹出
// ─────────────────────────────────────────────

describe('赛季结算弹窗一次性弹出', () => {
  let seasonSystem: ArenaSeasonSystem;

  beforeEach(() => {
    seasonSystem = new ArenaSeasonSystem();
  });

  describe('赛季状态管理', () => {
    it('新赛季创建时未结算', () => {
      const season = seasonSystem.createSeason('s1', Date.now());
      expect(season.isSettled).toBe(false);
    });

    it('赛季结束时可以检测到', () => {
      const now = Date.now();
      const season = seasonSystem.createSeason('s1', now - 30 * 24 * 60 * 60 * 1000);
      expect(seasonSystem.isSeasonEnded(season, now)).toBe(true);
    });

    it('赛季进行中时不应结束', () => {
      const now = Date.now();
      const season = seasonSystem.createSeason('s1', now);
      expect(seasonSystem.isSeasonActive(season, now)).toBe(true);
      expect(seasonSystem.isSeasonEnded(season, now)).toBe(false);
    });
  });

  describe('赛季结算逻辑', () => {
    it('结算后积分重置到当前段位最低值', () => {
      const player = createPlayer({ score: 1500, rankId: 'BRONZE_I' });
      const result = seasonSystem.settleSeason(player, 'BRONZE_I');
      // BRONZE_I minScore = 1200
      expect(result.resetScore).toBe(1200);
      expect(result.state.score).toBe(1200);
    });

    it('结算后发放赛季奖励（竞技币）', () => {
      const player = createPlayer({ arenaCoins: 100, rankId: 'SILVER_V' });
      const result = seasonSystem.settleSeason(player, 'SILVER_V');
      // SILVER_V 赛季奖励: arenaCoin=120
      expect(result.reward.arenaCoin).toBe(120);
      expect(result.state.arenaCoins).toBe(220); // 100 + 120
    });

    it('结算后每日数据重置', () => {
      const player = createPlayer({
        dailyChallengesLeft: 0,
        dailyBoughtChallenges: 5,
        dailyManualRefreshes: 10,
      });
      const result = seasonSystem.settleSeason(player, 'BRONZE_V');
      expect(result.state.dailyChallengesLeft).toBe(5);
      expect(result.state.dailyBoughtChallenges).toBe(0);
      expect(result.state.dailyManualRefreshes).toBe(0);
    });

    it('结算后对手列表清空', () => {
      const player = createPlayer({
        opponents: [
          { playerId: 'p1', name: '对手1', power: 5000, ranking: 10, faction: '蜀' },
        ] as any,
      });
      const result = seasonSystem.settleSeason(player, 'BRONZE_V');
      expect(result.state.opponents).toHaveLength(0);
    });
  });

  describe('赛季奖励表验证', () => {
    it('所有21个段位都有对应奖励', () => {
      expect(SEASON_REWARDS).toHaveLength(21);
    });

    it('青铜V奖励最少', () => {
      const bronzeV = SEASON_REWARDS.find(r => r.rankId === 'BRONZE_V');
      expect(bronzeV).toBeDefined();
      expect(bronzeV!.arenaCoin).toBe(50);
    });

    it('王者I奖励最多', () => {
      const kingI = SEASON_REWARDS.find(r => r.rankId === 'KING_I');
      expect(kingI).toBeDefined();
      expect(kingI!.arenaCoin).toBe(2000);
      expect(kingI!.copper).toBe(100000);
    });

    it('奖励随段位递增', () => {
      for (let i = 1; i < SEASON_REWARDS.length; i++) {
        const prev = SEASON_REWARDS[i - 1];
        const curr = SEASON_REWARDS[i];
        expect(curr.arenaCoin).toBeGreaterThanOrEqual(prev.arenaCoin);
      }
    });

    it('白银以上段位有称号奖励', () => {
      const silverI = SEASON_REWARDS.find(r => r.rankId === 'SILVER_I');
      expect(silverI?.title).toBeTruthy();
    });
  });

  /**
   * TODO: 赛季结算弹窗一次性弹出逻辑尚未在引擎层实现
   * PRD §PVP-3 规定：赛季结算时弹出结算弹窗，展示段位变化和奖励
   * 需要补充：
   *   - settleSeason 返回值增加 isSettled 标记
   *   - 客户端根据 isSettled 控制弹窗显示
   *   - 弹窗关闭后设置 hasSeenSettlement = true，防止重复弹出
   *   - 可通过序列化存储弹窗已读状态
   */
  describe.todo('赛季结算弹窗一次性弹出', () => {
    it.todo('结算后标记 isSettled = true');
    it.todo('弹窗关闭后标记 hasSeenSettlement = true');
    it.todo('已读状态下不再弹出结算弹窗');
    it.todo('结算弹窗状态可序列化保存');
  });

  describe('最高段位更新', () => {
    it('新段位更高时更新最高段位', () => {
      expect(seasonSystem.updateHighestRank('BRONZE_V', 'SILVER_I')).toBe('SILVER_I');
    });

    it('新段位更低时保持最高段位', () => {
      expect(seasonSystem.updateHighestRank('GOLD_I', 'BRONZE_V')).toBe('GOLD_I');
    });

    it('相同段位不变', () => {
      expect(seasonSystem.updateHighestRank('SILVER_III', 'SILVER_III')).toBe('SILVER_III');
    });
  });
});
