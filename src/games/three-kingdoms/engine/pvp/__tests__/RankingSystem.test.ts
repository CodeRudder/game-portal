/**
 * RankingSystem 单元测试
 *
 * 覆盖：
 *   - 多维度排名（积分/战力/赛季）
 *   - 排名计算与排序
 *   - 玩家排名查询
 *   - Top N查询
 *   - 附近玩家查询
 *   - 刷新检查
 *   - 存档序列化/反序列化
 */

import {
  RankingSystem,
  RankingDimension,
  DEFAULT_RANKING_CONFIG,
  RANKING_SAVE_VERSION,
} from '../RankingSystem';
import type { ArenaOpponent } from '../../../core/pvp/pvp.types';

// ── 辅助函数 ──────────────────────────────

function createOpponent(overrides: Partial<ArenaOpponent> = {}): ArenaOpponent {
  return {
    playerId: 'p1',
    playerName: 'Player1',
    power: 10000,
    rankId: 'BRONZE_V',
    score: 100,
    ranking: 10,
    faction: 'wei',
    defenseSnapshot: null,
    ...overrides,
  };
}

function createPlayerPool(): ArenaOpponent[] {
  return [
    createOpponent({ playerId: 'p1', playerName: '张三', power: 15000, score: 500, rankId: 'SILVER_V' }),
    createOpponent({ playerId: 'p2', playerName: '李四', power: 12000, score: 800, rankId: 'SILVER_I' }),
    createOpponent({ playerId: 'p3', playerName: '王五', power: 20000, score: 200, rankId: 'BRONZE_III' }),
    createOpponent({ playerId: 'p4', playerName: '赵六', power: 8000, score: 1200, rankId: 'GOLD_III' }),
    createOpponent({ playerId: 'p5', playerName: '钱七', power: 18000, score: 600, rankId: 'SILVER_III' }),
  ];
}

let system: RankingSystem;

beforeEach(() => {
  system = new RankingSystem();
});

// ── 排名计算 ──────────────────────────────

describe('RankingSystem — 排名计算', () => {
  test('积分排名按score降序排列', () => {
    const players = createPlayerPool();
    const data = system.updateRanking(RankingDimension.SCORE, players, 1000);

    expect(data.entries[0].playerId).toBe('p4'); // score: 1200
    expect(data.entries[1].playerId).toBe('p2'); // score: 800
    expect(data.entries[2].playerId).toBe('p5'); // score: 600
    expect(data.entries[3].playerId).toBe('p1'); // score: 500
    expect(data.entries[4].playerId).toBe('p3'); // score: 200
  });

  test('战力排名按power降序排列', () => {
    const players = createPlayerPool();
    const data = system.updateRanking(RankingDimension.POWER, players, 1000);

    expect(data.entries[0].playerId).toBe('p3'); // power: 20000
    expect(data.entries[1].playerId).toBe('p5'); // power: 18000
    expect(data.entries[2].playerId).toBe('p1'); // power: 15000
    expect(data.entries[3].playerId).toBe('p2'); // power: 12000
    expect(data.entries[4].playerId).toBe('p4'); // power: 8000
  });

  test('赛季排名按score降序排列', () => {
    const players = createPlayerPool();
    const data = system.updateRanking(RankingDimension.SEASON, players, 1000);

    expect(data.entries[0].value).toBe(1200);
    expect(data.entries[4].value).toBe(200);
  });

  test('更新时间被正确记录', () => {
    const players = createPlayerPool();
    const now = 9999999;
    const data = system.updateRanking(RankingDimension.SCORE, players, now);

    expect(data.lastUpdateTime).toBe(now);
  });

  test('超过maxDisplayCount的条目被截断', () => {
    const smallSystem = new RankingSystem({ maxDisplayCount: 3 });
    const players = createPlayerPool();
    const data = smallSystem.updateRanking(RankingDimension.SCORE, players, 1000);

    expect(data.entries.length).toBe(3);
  });

  test('空玩家列表返回空排行榜', () => {
    const data = system.updateRanking(RankingDimension.SCORE, [], 1000);
    expect(data.entries).toEqual([]);
  });
});

// ── 玩家排名查询 ──────────────────────────

describe('RankingSystem — 玩家排名查询', () => {
  beforeEach(() => {
    const players = createPlayerPool();
    system.updateRanking(RankingDimension.SCORE, players, 1000);
    system.updateRanking(RankingDimension.POWER, players, 1000);
  });

  test('获取玩家积分排名（1-based）', () => {
    expect(system.getPlayerRank(RankingDimension.SCORE, 'p4')).toBe(1);
    expect(system.getPlayerRank(RankingDimension.SCORE, 'p3')).toBe(5);
  });

  test('获取玩家战力排名', () => {
    expect(system.getPlayerRank(RankingDimension.POWER, 'p3')).toBe(1);
    expect(system.getPlayerRank(RankingDimension.POWER, 'p4')).toBe(5);
  });

  test('未入榜玩家返回0', () => {
    expect(system.getPlayerRank(RankingDimension.SCORE, 'unknown')).toBe(0);
  });

  test('未初始化维度返回0', () => {
    const freshSystem = new RankingSystem();
    expect(freshSystem.getPlayerRank(RankingDimension.SCORE, 'p1')).toBe(0);
  });
});

// ── Top N查询 ─────────────────────────────

describe('RankingSystem — Top N查询', () => {
  beforeEach(() => {
    const players = createPlayerPool();
    system.updateRanking(RankingDimension.SCORE, players, 1000);
  });

  test('获取Top 3', () => {
    const top3 = system.getTopPlayers(RankingDimension.SCORE, 3);
    expect(top3.length).toBe(3);
    expect(top3[0].value).toBeGreaterThanOrEqual(top3[1].value);
  });

  test('获取Top 10（不足10个返回全部）', () => {
    const top10 = system.getTopPlayers(RankingDimension.SCORE, 10);
    expect(top10.length).toBe(5);
  });

  test('空排行榜返回空数组', () => {
    const freshSystem = new RankingSystem();
    const top = freshSystem.getTopPlayers(RankingDimension.SCORE, 5);
    expect(top).toEqual([]);
  });
});

// ── 附近玩家查询 ──────────────────────────

describe('RankingSystem — 附近玩家查询', () => {
  beforeEach(() => {
    const players = createPlayerPool();
    system.updateRanking(RankingDimension.SCORE, players, 1000);
  });

  test('获取附近玩家', () => {
    const nearby = system.getNearbyPlayers(RankingDimension.SCORE, 'p1', 1);
    // p1 is rank 4, nearby should include rank 3 and 5
    expect(nearby.length).toBe(3); // self + 1 above + 1 below
    const ids = nearby.map((e) => e.playerId);
    expect(ids).toContain('p1');
  });

  test('第一名附近无上方玩家', () => {
    const nearby = system.getNearbyPlayers(RankingDimension.SCORE, 'p4', 1);
    const ids = nearby.map((e) => e.playerId);
    expect(ids).toContain('p4');
    expect(ids).toContain('p2'); // 第二名
  });

  test('未入榜返回空数组', () => {
    const nearby = system.getNearbyPlayers(RankingDimension.SCORE, 'unknown', 5);
    expect(nearby).toEqual([]);
  });
});

// ── 刷新检查 ──────────────────────────────

describe('RankingSystem — 刷新检查', () => {
  test('新系统需要刷新', () => {
    expect(system.needsRefresh(RankingDimension.SCORE, 1000)).toBe(true);
  });

  test('刚更新后不需要刷新', () => {
    const now = 1000000;
    system.updateRanking(RankingDimension.SCORE, createPlayerPool(), now);
    expect(system.needsRefresh(RankingDimension.SCORE, now)).toBe(false);
  });

  test('超过刷新间隔后需要刷新', () => {
    const now = 1000000;
    system.updateRanking(RankingDimension.SCORE, createPlayerPool(), now);
    const later = now + DEFAULT_RANKING_CONFIG.refreshIntervalMs + 1;
    expect(system.needsRefresh(RankingDimension.SCORE, later)).toBe(true);
  });

  test('获取条目数量', () => {
    expect(system.getEntryCount(RankingDimension.SCORE)).toBe(0);
    system.updateRanking(RankingDimension.SCORE, createPlayerPool(), 1000);
    expect(system.getEntryCount(RankingDimension.SCORE)).toBe(5);
  });
});

// ── 工具方法 ──────────────────────────────

describe('RankingSystem — 工具方法', () => {
  test('获取配置', () => {
    const config = system.getConfig();
    expect(config.maxDisplayCount).toBe(100);
    expect(config.refreshIntervalMs).toBe(5 * 60 * 1000);
  });

  test('自定义配置', () => {
    const customSystem = new RankingSystem({ maxDisplayCount: 50, refreshIntervalMs: 1000 });
    const config = customSystem.getConfig();
    expect(config.maxDisplayCount).toBe(50);
    expect(config.refreshIntervalMs).toBe(1000);
  });

  test('获取所有维度', () => {
    const dims = system.getDimensions();
    expect(dims).toEqual([RankingDimension.SCORE, RankingDimension.POWER, RankingDimension.SEASON]);
  });
});

// ── 存档序列化 ────────────────────────────

describe('RankingSystem — 存档序列化', () => {
  test('序列化和反序列化保持一致', () => {
    const players = createPlayerPool();
    system.updateRanking(RankingDimension.SCORE, players, 1000);
    system.updateRanking(RankingDimension.POWER, players, 2000);

    const data = system.serialize();
    expect(data.version).toBe(RANKING_SAVE_VERSION);
    expect(data.scoreRanking.entries.length).toBe(5);
    expect(data.powerRanking.entries.length).toBe(5);

    // 反序列化到新系统
    const newSystem = new RankingSystem();
    newSystem.deserialize(data);

    expect(newSystem.getEntryCount(RankingDimension.SCORE)).toBe(5);
    expect(newSystem.getEntryCount(RankingDimension.POWER)).toBe(5);
    expect(newSystem.getPlayerRank(RankingDimension.SCORE, 'p4')).toBe(1);
  });

  test('反序列化无效数据不崩溃', () => {
    const newSystem = new RankingSystem();
    expect(() => newSystem.deserialize({} as unknown as Record<string, unknown>)).not.toThrow();
    expect(() => newSystem.deserialize({ version: 999 } as unknown as Record<string, unknown>)).not.toThrow();
  });
});
