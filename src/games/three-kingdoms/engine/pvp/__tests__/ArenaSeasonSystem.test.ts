/**
 * ArenaSeasonSystem 单元测试
 *
 * 覆盖：
 *   - 28天赛季周期
 *   - 赛季创建与天数计算
 *   - 赛季结算（积分重置+奖励发放）
 *   - 段位奖励（21级）
 *   - 最高段位追踪
 *   - 每日段位奖励
 *   - 竞技商店
 */

import {
  ArenaSeasonSystem,
  DEFAULT_SEASON_CONFIG,
  SEASON_REWARDS,
} from '../ArenaSeasonSystem';
import { FormationType, AIDefenseStrategy } from '../../../core/pvp/pvp.types';
import type { ArenaPlayerState, SeasonData } from '../../../core/pvp/pvp.types';
import { createDefaultArenaPlayerState } from '../ArenaSystem';

// ── 辅助函数 ──────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000;

function createPlayerState(score: number, rankId: string = 'BRONZE_V'): ArenaPlayerState {
  const state = createDefaultArenaPlayerState();
  return {
    ...state,
    score,
    rankId,
    arenaCoins: 100,
    defenseFormation: {
      slots: ['h1', 'h2', 'h3', '', ''],
      formation: FormationType.FISH_SCALE,
      strategy: AIDefenseStrategy.BALANCED,
    },
  };
}

// ── 赛季周期 ──────────────────────────────

describe('ArenaSeasonSystem — 赛季周期', () => {
  let system: ArenaSeasonSystem;

  beforeEach(() => {
    system = new ArenaSeasonSystem();
  });

  test('默认赛季周期28天', () => {
    expect(DEFAULT_SEASON_CONFIG.seasonDays).toBe(28);
    expect(system.getSeasonDays()).toBe(28);
  });

  test('创建赛季', () => {
    const startTime = 1000000;
    const season = system.createSeason('s1', startTime);

    expect(season.seasonId).toBe('s1');
    expect(season.startTime).toBe(startTime);
    expect(season.endTime).toBe(startTime + 28 * DAY_MS);
    expect(season.currentDay).toBe(1);
    expect(season.isSettled).toBe(false);
  });

  test('获取赛季当前天数 — 第1天', () => {
    const startTime = 1000000;
    const season = system.createSeason('s1', startTime);

    expect(system.getCurrentDay(season, startTime)).toBe(1);
  });

  test('获取赛季当前天数 — 第15天', () => {
    const startTime = 1000000;
    const season = system.createSeason('s1', startTime);
    const day15 = startTime + 14 * DAY_MS;

    expect(system.getCurrentDay(season, day15)).toBe(15);
  });

  test('获取赛季当前天数 — 最后一天', () => {
    const startTime = 1000000;
    const season = system.createSeason('s1', startTime);
    const lastDay = startTime + 27 * DAY_MS;

    expect(system.getCurrentDay(season, lastDay)).toBe(28);
  });

  test('获取赛季当前天数 — 不超过28', () => {
    const startTime = 1000000;
    const season = system.createSeason('s1', startTime);
    const afterSeason = startTime + 30 * DAY_MS;

    expect(system.getCurrentDay(season, afterSeason)).toBe(28);
  });

  test('赛季未结束 — 进行中', () => {
    const startTime = 1000000;
    const season = system.createSeason('s1', startTime);

    expect(system.isSeasonActive(season, startTime + 10 * DAY_MS)).toBe(true);
    expect(system.isSeasonEnded(season, startTime + 10 * DAY_MS)).toBe(false);
  });

  test('赛季已结束', () => {
    const startTime = 1000000;
    const season = system.createSeason('s1', startTime);

    expect(system.isSeasonEnded(season, startTime + 28 * DAY_MS)).toBe(true);
    expect(system.isSeasonActive(season, startTime + 28 * DAY_MS)).toBe(false);
  });

  test('赛季未开始', () => {
    const startTime = 1000000;
    const season = system.createSeason('s1', startTime);

    expect(system.isSeasonActive(season, startTime - 1)).toBe(false);
  });

  test('剩余天数计算', () => {
    const startTime = 1000000;
    const season = system.createSeason('s1', startTime);

    expect(system.getRemainingDays(season, startTime)).toBe(28);
    expect(system.getRemainingDays(season, startTime + 14 * DAY_MS)).toBe(14);
    expect(system.getRemainingDays(season, startTime + 28 * DAY_MS)).toBe(0);
  });
});

// ── 赛季结算 ──────────────────────────────

describe('ArenaSeasonSystem — 赛季结算', () => {
  let system: ArenaSeasonSystem;

  beforeEach(() => {
    system = new ArenaSeasonSystem();
  });

  test('结算时积分重置到当前段位最低值', () => {
    // GOLD_IV: minScore = 1000
    const player = createPlayerState(1500, 'GOLD_IV');
    const result = system.settleSeason(player, 'GOLD_IV');

    expect(result.resetScore).toBe(1000);
    expect(result.state.score).toBe(1000);
  });

  test('结算时按最高段位发放奖励', () => {
    const player = createPlayerState(500, 'SILVER_V');
    const result = system.settleSeason(player, 'GOLD_IV');

    // 应按 GOLD_IV 发放奖励，不是 SILVER_V
    const goldIvReward = system.getSeasonReward('GOLD_IV');
    expect(result.reward.arenaCoin).toBe(goldIvReward.arenaCoin);
  });

  test('结算后清理回放和日志', () => {
    const player = createPlayerState(500, 'SILVER_V');
    player.replays = [{} as any];
    player.defenseLogs = [{} as any];

    const result = system.settleSeason(player, 'SILVER_V');
    expect(result.state.replays).toEqual([]);
    expect(result.state.defenseLogs).toEqual([]);
  });

  test('结算后重置每日数据', () => {
    const player: ArenaPlayerState = {
      ...createPlayerState(500, 'SILVER_V'),
      dailyChallengesLeft: 0,
      dailyBoughtChallenges: 5,
      dailyManualRefreshes: 10,
      opponents: [{} as any],
    };

    const result = system.settleSeason(player, 'SILVER_V');
    expect(result.state.dailyChallengesLeft).toBe(5);
    expect(result.state.dailyBoughtChallenges).toBe(0);
    expect(result.state.dailyManualRefreshes).toBe(0);
    expect(result.state.opponents).toEqual([]);
  });

  test('结算奖励包含竞技币', () => {
    const player = createPlayerState(100, 'BRONZE_IV');
    const result = system.settleSeason(player, 'BRONZE_IV');

    expect(result.state.arenaCoins).toBeGreaterThan(player.arenaCoins);
  });
});

// ── 段位奖励 ──────────────────────────────

describe('ArenaSeasonSystem — 段位奖励', () => {
  let system: ArenaSeasonSystem;

  beforeEach(() => {
    system = new ArenaSeasonSystem();
  });

  test('共21个段位奖励', () => {
    expect(SEASON_REWARDS.length).toBe(21);
    expect(system.getAllSeasonRewards().length).toBe(21);
  });

  test('青铜V奖励最低', () => {
    const reward = system.getSeasonReward('BRONZE_V');
    expect(reward.copper).toBe(2000);
    expect(reward.arenaCoin).toBe(50);
    expect(reward.gold).toBe(20);
    expect(reward.title).toBeNull();
  });

  test('王者I奖励最高', () => {
    const reward = system.getSeasonReward('KING_I');
    expect(reward.copper).toBe(100000);
    expect(reward.arenaCoin).toBe(2000);
    expect(reward.gold).toBe(500);
    expect(reward.title).toBe('天下霸主');
  });

  test('高段位有称号奖励', () => {
    const silverIv = system.getSeasonReward('SILVER_IV');
    expect(silverIv.title).toBeTruthy();
  });

  test('低段位无称号', () => {
    const bronzeV = system.getSeasonReward('BRONZE_V');
    expect(bronzeV.title).toBeNull();
  });

  test('不存在的段位返回最低奖励', () => {
    const reward = system.getSeasonReward('INVALID');
    expect(reward).toEqual(SEASON_REWARDS[0]);
  });

  test('奖励随段位递增', () => {
    for (let i = 1; i < SEASON_REWARDS.length; i++) {
      expect(SEASON_REWARDS[i].copper).toBeGreaterThanOrEqual(SEASON_REWARDS[i - 1].copper);
    }
  });
});

// ── 最高段位追踪 ──────────────────────────

describe('ArenaSeasonSystem — 最高段位追踪', () => {
  let system: ArenaSeasonSystem;

  beforeEach(() => {
    system = new ArenaSeasonSystem();
  });

  test('更新最高段位 — 新段位更高', () => {
    expect(system.updateHighestRank('BRONZE_V', 'BRONZE_IV')).toBe('BRONZE_IV');
  });

  test('更新最高段位 — 新段位更低不更新', () => {
    expect(system.updateHighestRank('SILVER_V', 'BRONZE_I')).toBe('SILVER_V');
  });

  test('更新最高段位 — 相同段位不变', () => {
    expect(system.updateHighestRank('BRONZE_V', 'BRONZE_V')).toBe('BRONZE_V');
  });

  test('跨大段位更新', () => {
    expect(system.updateHighestRank('BRONZE_I', 'GOLD_IV')).toBe('GOLD_IV');
  });
});

// ── 每日段位奖励 ──────────────────────────

describe('ArenaSeasonSystem — 每日段位奖励', () => {
  let system: ArenaSeasonSystem;

  beforeEach(() => {
    system = new ArenaSeasonSystem();
  });

  test('发放每日奖励增加竞技币', () => {
    const player = createPlayerState(500, 'SILVER_V');
    const result = system.grantDailyReward(player);

    expect(result.reward.arenaCoin).toBe(35); // SILVER_V dailyReward
    expect(result.state.arenaCoins).toBe(player.arenaCoins + 35);
  });

  test('高段位每日奖励更好', () => {
    const bronze = system.grantDailyReward(createPlayerState(0, 'BRONZE_V'));
    const king = system.grantDailyReward(createPlayerState(4000, 'KING_I'));

    expect(king.reward.copper).toBeGreaterThan(bronze.reward.copper);
    expect(king.reward.arenaCoin).toBeGreaterThan(bronze.reward.arenaCoin);
  });
});

// ── 竞技商店 ──────────────────────────────

describe('ArenaSeasonSystem — 竞技商店', () => {
  let system: ArenaSeasonSystem;

  beforeEach(() => {
    system = new ArenaSeasonSystem();
  });

  test('购买物品扣除竞技币', () => {
    const player = createPlayerState(100, 'BRONZE_V');
    player.arenaCoins = 500;

    const result = system.buyArenaShopItem(player, 200);
    expect(result.arenaCoins).toBe(300);
  });

  test('竞技币不足时抛出异常', () => {
    const player = createPlayerState(100, 'BRONZE_V');
    player.arenaCoins = 50;

    expect(() => system.buyArenaShopItem(player, 200)).toThrow('竞技币不足');
  });
});

// ── 自定义配置 ────────────────────────────

describe('ArenaSeasonSystem — 自定义配置', () => {
  test('可以自定义赛季天数', () => {
    const system = new ArenaSeasonSystem({ seasonDays: 14 });
    expect(system.getSeasonDays()).toBe(14);
  });

  test('可以自定义积分重置比例', () => {
    const system = new ArenaSeasonSystem({ scoreResetRatio: 0.3 });
    expect(system.getConfig().scoreResetRatio).toBe(0.3);
  });
});
