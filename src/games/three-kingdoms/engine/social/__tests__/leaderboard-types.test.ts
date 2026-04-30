/**
 * social/leaderboard-types.ts 单元测试
 *
 * 覆盖导出函数：
 * - generateSeasonId
 * - createDefaultLeaderboardState
 *
 * 验证常量：
 * - SEASON_DAYS, DAILY_REFRESH_MS, MAX_PAGE_SIZE, MAX_ENTRIES
 * - REWARD_CONFIGS
 * - LEADERBOARD_TYPE_LABELS
 * - LeaderboardType 枚举
 */

import { describe, it, expect } from 'vitest';
import {
  LeaderboardType,
  SEASON_DAYS,
  DAILY_REFRESH_MS,
  MAX_PAGE_SIZE,
  MAX_ENTRIES,
  REWARD_CONFIGS,
  LEADERBOARD_TYPE_LABELS,
  generateSeasonId,
  createDefaultLeaderboardState,
} from '../../social/leaderboard-types';

// ═══════════════════════════════════════════
// LeaderboardType 枚举
// ═══════════════════════════════════════════
describe('LeaderboardType', () => {
  it('包含6种排行榜类型', () => {
    const types = Object.values(LeaderboardType);
    expect(types).toHaveLength(6);
  });

  it('包含 POWER, EXPEDITION, ARENA, WEALTH, SEASON_RECORD, GUILD', () => {
    expect(LeaderboardType.POWER).toBe('POWER');
    expect(LeaderboardType.EXPEDITION).toBe('EXPEDITION');
    expect(LeaderboardType.ARENA).toBe('ARENA');
    expect(LeaderboardType.WEALTH).toBe('WEALTH');
    expect(LeaderboardType.SEASON_RECORD).toBe('SEASON_RECORD');
    expect(LeaderboardType.GUILD).toBe('GUILD');
  });
});

// ═══════════════════════════════════════════
// 常量验证
// ═══════════════════════════════════════════
describe('常量', () => {
  it('SEASON_DAYS 为 30', () => {
    expect(SEASON_DAYS).toBe(30);
  });

  it('DAILY_REFRESH_MS 为一天的毫秒数', () => {
    expect(DAILY_REFRESH_MS).toBe(24 * 60 * 60 * 1000);
  });

  it('MAX_PAGE_SIZE > 0', () => {
    expect(MAX_PAGE_SIZE).toBeGreaterThan(0);
  });

  it('MAX_ENTRIES > MAX_PAGE_SIZE', () => {
    expect(MAX_ENTRIES).toBeGreaterThan(MAX_PAGE_SIZE);
  });

  it('REWARD_CONFIGS 非空且按排名排列', () => {
    expect(REWARD_CONFIGS.length).toBeGreaterThan(0);
    for (let i = 1; i < REWARD_CONFIGS.length; i++) {
      expect(REWARD_CONFIGS[i].minRank).toBeGreaterThan(REWARD_CONFIGS[i - 1].maxRank);
    }
  });

  it('LEADERBOARD_TYPE_LABELS 覆盖所有类型', () => {
    for (const type of Object.values(LeaderboardType)) {
      expect(LEADERBOARD_TYPE_LABELS[type]).toBeTruthy();
    }
  });
});

// ═══════════════════════════════════════════
// generateSeasonId
// ═══════════════════════════════════════════
describe('generateSeasonId', () => {
  it('返回 season_ 前缀字符串', () => {
    const id = generateSeasonId();
    expect(id).toMatch(/^season_\d+_\d+$/);
  });

  it('每次调用生成不同 ID', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 10; i++) {
      ids.add(generateSeasonId());
    }
    expect(ids.size).toBe(10);
  });

  it('包含时间戳', () => {
    const before = Date.now();
    const id = generateSeasonId();
    const after = Date.now();
    const timestamp = parseInt(id.split('_')[1], 10);
    expect(timestamp).toBeGreaterThanOrEqual(before);
    expect(timestamp).toBeLessThanOrEqual(after);
  });
});

// ═══════════════════════════════════════════
// createDefaultLeaderboardState
// ═══════════════════════════════════════════
describe('createDefaultLeaderboardState', () => {
  it('返回有效的默认状态', () => {
    const state = createDefaultLeaderboardState();
    expect(state.boards).toBeDefined();
    expect(state.currentSeason).toBeDefined();
    expect(state.seasonHistory).toEqual([]);
  });

  it('boards 包含所有排行榜类型', () => {
    const state = createDefaultLeaderboardState();
    for (const type of Object.values(LeaderboardType)) {
      expect(Array.isArray(state.boards[type])).toBe(true);
    }
  });

  it('所有排行榜初始为空', () => {
    const state = createDefaultLeaderboardState();
    for (const type of Object.values(LeaderboardType)) {
      expect(state.boards[type]).toHaveLength(0);
    }
  });

  it('currentSeason 有有效 ID', () => {
    const state = createDefaultLeaderboardState();
    expect(state.currentSeason.id).toBeTruthy();
    expect(state.currentSeason.isCurrent).toBe(true);
  });

  it('currentSeason 结束时间 > 开始时间', () => {
    const state = createDefaultLeaderboardState();
    expect(state.currentSeason.endTime).toBeGreaterThan(state.currentSeason.startTime);
  });

  it('赛季持续天数 = SEASON_DAYS', () => {
    const state = createDefaultLeaderboardState();
    const duration = state.currentSeason.endTime - state.currentSeason.startTime;
    expect(duration).toBe(SEASON_DAYS * DAILY_REFRESH_MS);
  });

  it('lastRefreshTime 为当前时间附近', () => {
    const before = Date.now();
    const state = createDefaultLeaderboardState();
    const after = Date.now();
    expect(state.lastRefreshTime).toBeGreaterThanOrEqual(before);
    expect(state.lastRefreshTime).toBeLessThanOrEqual(after);
  });

  it('每次调用返回新对象', () => {
    const a = createDefaultLeaderboardState();
    const b = createDefaultLeaderboardState();
    expect(a).not.toBe(b);
    expect(a.boards).not.toBe(b.boards);
  });
});

// ═══════════════════════════════════════════
// REWARD_CONFIGS 详细验证
// ═══════════════════════════════════════════
describe('REWARD_CONFIGS', () => {
  it('第一名有特殊称号', () => {
    const first = REWARD_CONFIGS.find((c) => c.minRank === 1 && c.maxRank === 1);
    expect(first).toBeDefined();
    expect(first!.reward.title).toBeTruthy();
  });

  it('所有奖励有正数 gold 和 gems', () => {
    for (const config of REWARD_CONFIGS) {
      expect(config.reward.gold).toBeGreaterThan(0);
      expect(config.reward.gems).toBeGreaterThan(0);
    }
  });

  it('排名越前奖励越好（gold 递减）', () => {
    for (let i = 1; i < REWARD_CONFIGS.length; i++) {
      expect(REWARD_CONFIGS[i].reward.gold).toBeLessThan(REWARD_CONFIGS[i - 1].reward.gold);
    }
  });
});
