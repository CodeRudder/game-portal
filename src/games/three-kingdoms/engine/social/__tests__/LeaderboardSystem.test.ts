/**
 * LeaderboardSystem 单元测试
 *
 * 覆盖：
 *   - 状态初始化
 *   - 分数更新（新增/更新/同分/未入榜）
 *   - 排名计算（降序+同分时间优先）
 *   - 分页查询
 *   - 玩家排名查询
 *   - 附近排名查询
 *   - 前N名查询
 *   - 赛季管理（每日刷新/赛季结算/新赛季）
 *   - 奖励配置
 *   - 批量更新
 */

import {
  LeaderboardSystem,
  createDefaultLeaderboardState,
  LEADERBOARD_TYPE_LABELS,
} from '../LeaderboardSystem';
import {
  LeaderboardType,
} from '../LeaderboardSystem';
import type {
  LeaderboardEntry,
  LeaderboardState,
  LeaderboardQuery,
} from '../LeaderboardSystem';

// ── 辅助函数 ──────────────────────────────

/** 创建排行榜条目 */
function createEntry(
  playerId: string,
  score: number,
  achievedAt: number = Date.now(),
): Partial<LeaderboardEntry> & { playerId: string; score: number } {
  return {
    playerId,
    playerName: `玩家${playerId}`,
    score,
    achievedAt,
    rank: 0,
    metadata: {},
  };
}

// ── 全局实例 ──────────────────────────────

let system: LeaderboardSystem;

beforeEach(() => {
  system = new LeaderboardSystem();
});

// ═══════════════════════════════════════════
// 1. 状态初始化
// ═══════════════════════════════════════════

describe('LeaderboardSystem — 状态初始化', () => {
  test('默认状态包含4种排行榜', () => {
    const state = system.getState();
    expect(Object.keys(state.boards).length).toBe(4);
    expect(state.boards[LeaderboardType.POWER]).toEqual([]);
    expect(state.boards[LeaderboardType.EXPEDITION]).toEqual([]);
    expect(state.boards[LeaderboardType.ARENA]).toEqual([]);
    expect(state.boards[LeaderboardType.WEALTH]).toEqual([]);
  });

  test('默认赛季信息', () => {
    const season = system.getCurrentSeason();
    expect(season.isCurrent).toBe(true);
    expect(season.endTime).toBeGreaterThan(season.startTime);
  });

  test('排行榜类型标签', () => {
    expect(LEADERBOARD_TYPE_LABELS[LeaderboardType.POWER]).toBe('战力榜');
    expect(LEADERBOARD_TYPE_LABELS[LeaderboardType.EXPEDITION]).toBe('远征榜');
    expect(LEADERBOARD_TYPE_LABELS[LeaderboardType.ARENA]).toBe('竞技榜');
    expect(LEADERBOARD_TYPE_LABELS[LeaderboardType.WEALTH]).toBe('财富榜');
  });
});

// ═══════════════════════════════════════════
// 2. 分数更新
// ═══════════════════════════════════════════

describe('LeaderboardSystem — 分数更新', () => {
  test('新增玩家入榜', () => {
    const entry = system.updateScore(LeaderboardType.POWER, 'p1', '玩家1', 5000);
    expect(entry).not.toBeNull();
    expect(entry!.score).toBe(5000);
    expect(entry!.rank).toBe(1);
  });

  test('多个玩家按分数降序排列', () => {
    system.updateScore(LeaderboardType.POWER, 'p1', '玩家1', 3000);
    system.updateScore(LeaderboardType.POWER, 'p2', '玩家2', 5000);
    system.updateScore(LeaderboardType.POWER, 'p3', '玩家3', 4000);

    const top = system.getTopN(LeaderboardType.POWER, 3);
    expect(top[0].playerId).toBe('p2');
    expect(top[1].playerId).toBe('p3');
    expect(top[2].playerId).toBe('p1');
  });

  test('同分按时间先后排序', () => {
    const now = Date.now();
    system.updateScore(LeaderboardType.POWER, 'p1', '玩家1', 5000);
    // p2 同分但稍后更新
    const entry2 = system.updateScore(LeaderboardType.POWER, 'p2', '玩家2', 5000);

    const top = system.getTopN(LeaderboardType.POWER, 2);
    // 先达成的排前面
    expect(top[0].playerId).toBe('p1');
    expect(top[1].playerId).toBe('p2');
  });

  test('更高分数更新已有条目', () => {
    system.updateScore(LeaderboardType.POWER, 'p1', '玩家1', 3000);
    system.updateScore(LeaderboardType.POWER, 'p1', '玩家1', 6000);

    const entry = system.getPlayerRank(LeaderboardType.POWER, 'p1');
    expect(entry!.score).toBe(6000);
  });

  test('更低分数不更新已有条目', () => {
    system.updateScore(LeaderboardType.POWER, 'p1', '玩家1', 5000);
    system.updateScore(LeaderboardType.POWER, 'p1', '玩家1', 3000);

    const entry = system.getPlayerRank(LeaderboardType.POWER, 'p1');
    expect(entry!.score).toBe(5000);
  });

  test('同分不更新', () => {
    system.updateScore(LeaderboardType.POWER, 'p1', '玩家1', 5000);
    const result = system.updateScore(LeaderboardType.POWER, 'p1', '玩家1', 5000);
    expect(result!.score).toBe(5000);
  });

  test('排名正确分配', () => {
    system.updateScore(LeaderboardType.POWER, 'p1', '玩家1', 3000);
    system.updateScore(LeaderboardType.POWER, 'p2', '玩家2', 5000);
    system.updateScore(LeaderboardType.POWER, 'p3', '玩家3', 4000);

    const top = system.getTopN(LeaderboardType.POWER, 3);
    expect(top[0].rank).toBe(1);
    expect(top[1].rank).toBe(2);
    expect(top[2].rank).toBe(3);
  });
});

// ═══════════════════════════════════════════
// 3. 分页查询
// ═══════════════════════════════════════════

describe('LeaderboardSystem — 分页查询', () => {
  beforeEach(() => {
    for (let i = 1; i <= 25; i++) {
      system.updateScore(LeaderboardType.POWER, `p${i}`, `玩家${i}`, i * 100);
    }
  });

  test('第1页返回前10条', () => {
    const result = system.queryLeaderboard({
      type: LeaderboardType.POWER,
      page: 1,
      pageSize: 10,
    });
    expect(result.entries.length).toBe(10);
    expect(result.page).toBe(1);
    expect(result.totalEntries).toBe(25);
    expect(result.totalPages).toBe(3);
  });

  test('最后一页可能不满', () => {
    const result = system.queryLeaderboard({
      type: LeaderboardType.POWER,
      page: 3,
      pageSize: 10,
    });
    expect(result.entries.length).toBe(5);
  });

  test('超出页码返回最后一页', () => {
    const result = system.queryLeaderboard({
      type: LeaderboardType.POWER,
      page: 99,
      pageSize: 10,
    });
    expect(result.page).toBe(3);
  });

  test('空排行榜返回空结果', () => {
    const result = system.queryLeaderboard({
      type: LeaderboardType.ARENA,
      page: 1,
      pageSize: 10,
    });
    expect(result.entries.length).toBe(0);
    expect(result.totalPages).toBe(1);
  });

  test('pageSize不超过20', () => {
    const result = system.queryLeaderboard({
      type: LeaderboardType.POWER,
      page: 1,
      pageSize: 100,
    });
    expect(result.entries.length).toBeLessThanOrEqual(20);
  });
});

// ═══════════════════════════════════════════
// 4. 玩家排名查询
// ═══════════════════════════════════════════

describe('LeaderboardSystem — 玩家排名查询', () => {
  beforeEach(() => {
    system.updateScore(LeaderboardType.POWER, 'p1', '玩家1', 5000);
    system.updateScore(LeaderboardType.POWER, 'p2', '玩家2', 3000);
    system.updateScore(LeaderboardType.POWER, 'p3', '玩家3', 4000);
  });

  test('查询存在玩家的排名', () => {
    const entry = system.getPlayerRank(LeaderboardType.POWER, 'p1');
    expect(entry).not.toBeNull();
    expect(entry!.rank).toBe(1);
  });

  test('查询不存在玩家返回null', () => {
    const entry = system.getPlayerRank(LeaderboardType.POWER, 'nonexistent');
    expect(entry).toBeNull();
  });

  test('附近排名查询', () => {
    // 添加更多玩家
    for (let i = 4; i <= 10; i++) {
      system.updateScore(LeaderboardType.POWER, `p${i}`, `玩家${i}`, 6000 - i * 100);
    }

    const around = system.getAroundPlayer(LeaderboardType.POWER, 'p3', 2);
    expect(around.length).toBeGreaterThan(0);
    // p3 应在结果中
    expect(around.some(e => e.playerId === 'p3')).toBe(true);
  });

  test('附近排名查询不存在玩家返回空', () => {
    const around = system.getAroundPlayer(LeaderboardType.POWER, 'nonexistent');
    expect(around).toEqual([]);
  });
});

// ═══════════════════════════════════════════
// 5. 前N名查询
// ═══════════════════════════════════════════

describe('LeaderboardSystem — 前N名', () => {
  test('获取前3名', () => {
    for (let i = 1; i <= 10; i++) {
      system.updateScore(LeaderboardType.POWER, `p${i}`, `玩家${i}`, i * 100);
    }
    const top3 = system.getTopN(LeaderboardType.POWER, 3);
    expect(top3.length).toBe(3);
    expect(top3[0].rank).toBe(1);
    expect(top3[0].score).toBe(1000);
  });

  test('请求数量超过实际数量', () => {
    system.updateScore(LeaderboardType.POWER, 'p1', '玩家1', 5000);
    const top = system.getTopN(LeaderboardType.POWER, 10);
    expect(top.length).toBe(1);
  });
});

// ═══════════════════════════════════════════
// 6. 赛季管理
// ═══════════════════════════════════════════

describe('LeaderboardSystem — 赛季管理', () => {
  test('每日刷新检查', () => {
    const state = system.getState();
    const justNow = state.lastRefreshTime;
    expect(system.checkDailyRefresh(justNow)).toBe(false);
  });

  test('超过24小时触发刷新', () => {
    const state = system.getState();
    const laterTime = state.lastRefreshTime + 25 * 60 * 60 * 1000;
    expect(system.checkDailyRefresh(laterTime)).toBe(true);
  });

  test('赛季未结束', () => {
    const now = Date.now();
    expect(system.isSeasonEnded(now)).toBe(false);
  });

  test('赛季结束后结算', () => {
    // 添加玩家数据
    system.updateScore(LeaderboardType.POWER, 'p1', '玩家1', 5000);
    system.updateScore(LeaderboardType.POWER, 'p2', '玩家2', 3000);

    const season = system.getCurrentSeason();
    const endTime = season.endTime + 1000; // 赛季结束后

    const rewards = system.endSeasonAndStartNew(endTime);

    // 应有奖励
    expect(rewards.length).toBeGreaterThan(0);
    // 排行榜应清空
    expect(system.getTopN(LeaderboardType.POWER).length).toBe(0);
  });

  test('结算后开启新赛季', () => {
    const season = system.getCurrentSeason();
    const endTime = season.endTime + 1000;

    system.endSeasonAndStartNew(endTime);

    const newSeason = system.getCurrentSeason();
    expect(newSeason.isCurrent).toBe(true);
    expect(newSeason.id).not.toBe(season.id);
  });

  test('结算后旧赛季存入历史', () => {
    const season = system.getCurrentSeason();
    const endTime = season.endTime + 1000;

    system.endSeasonAndStartNew(endTime);

    const history = system.getSeasonHistory();
    expect(history.length).toBe(1);
    expect(history[0].id).toBe(season.id);
    expect(history[0].isCurrent).toBe(false);
  });
});

// ═══════════════════════════════════════════
// 7. 奖励配置
// ═══════════════════════════════════════════

describe('LeaderboardSystem — 奖励', () => {
  test('第1名有称号', () => {
    const reward = system.getRewardForRank(1);
    expect(reward).not.toBeNull();
    expect(reward!.gold).toBe(100000);
    expect(reward!.gems).toBe(500);
    expect(reward!.title).toBe('天下第一');
  });

  test('第2-3名有奖励', () => {
    const r2 = system.getRewardForRank(2);
    const r3 = system.getRewardForRank(3);
    expect(r2).not.toBeNull();
    expect(r3).not.toBeNull();
    expect(r2!.gold).toBe(50000);
  });

  test('第100名有奖励', () => {
    const reward = system.getRewardForRank(100);
    expect(reward).not.toBeNull();
  });

  test('第101名无奖励', () => {
    const reward = system.getRewardForRank(101);
    expect(reward).toBeNull();
  });

  test('奖励配置列表完整', () => {
    const configs = system.getRewardConfigs();
    expect(configs.length).toBe(5);
  });
});

// ═══════════════════════════════════════════
// 8. 批量更新
// ═══════════════════════════════════════════

describe('LeaderboardSystem — 批量更新', () => {
  test('批量添加多个玩家', () => {
    system.batchUpdateScores(LeaderboardType.POWER, [
      { playerId: 'p1', playerName: '玩家1', score: 3000 },
      { playerId: 'p2', playerName: '玩家2', score: 5000 },
      { playerId: 'p3', playerName: '玩家3', score: 4000 },
    ]);

    const top = system.getTopN(LeaderboardType.POWER, 3);
    expect(top.length).toBe(3);
    expect(top[0].playerId).toBe('p2');
  });
});

// ═══════════════════════════════════════════
// 9. createDefaultLeaderboardState 工厂函数
// ═══════════════════════════════════════════

describe('createDefaultLeaderboardState', () => {
  test('创建默认状态', () => {
    const state = createDefaultLeaderboardState();
    expect(Object.keys(state.boards).length).toBe(4);
    expect(state.currentSeason.isCurrent).toBe(true);
    expect(state.seasonHistory).toEqual([]);
  });
});
