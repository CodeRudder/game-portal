/**
 * season/season-config.ts 单元测试
 *
 * 覆盖导出函数：
 * - getRewardsForRank
 *
 * 验证常量：
 * - SEASON_REWARD_TIERS
 * - DEFAULT_SEASON_DURATION_DAYS
 * - SEASON_SAVE_VERSION
 * - DEFAULT_LEADERBOARD_LIMIT
 */

import { describe, it, expect } from 'vitest';
import {
  DEFAULT_SEASON_DURATION_DAYS,
  SEASON_SAVE_VERSION,
  DEFAULT_LEADERBOARD_LIMIT,
  SEASON_REWARD_TIERS,
  getRewardsForRank,
} from '../season-config';

// ═══════════════════════════════════════════
// getRewardsForRank
// ═══════════════════════════════════════════
describe('getRewardsForRank', () => {
  it('第1名返回顶级奖励', () => {
    const rewards = getRewardsForRank(1);
    expect(rewards.length).toBeGreaterThan(0);
    const copper = rewards.find((r) => r.resource === 'copper');
    expect(copper).toBeDefined();
    expect(copper!.amount).toBe(5000);
  });

  it('第2名返回第二档奖励', () => {
    const rewards = getRewardsForRank(2);
    const copper = rewards.find((r) => r.resource === 'copper');
    expect(copper!.amount).toBe(3000);
  });

  it('第3名返回第二档奖励', () => {
    const rewards = getRewardsForRank(3);
    const copper = rewards.find((r) => r.resource === 'copper');
    expect(copper!.amount).toBe(3000);
  });

  it('第4名返回第三档奖励', () => {
    const rewards = getRewardsForRank(4);
    const copper = rewards.find((r) => r.resource === 'copper');
    expect(copper!.amount).toBe(2000);
  });

  it('第10名返回第三档奖励', () => {
    const rewards = getRewardsForRank(10);
    const copper = rewards.find((r) => r.resource === 'copper');
    expect(copper!.amount).toBe(2000);
  });

  it('第11名返回第四档奖励', () => {
    const rewards = getRewardsForRank(11);
    const copper = rewards.find((r) => r.resource === 'copper');
    expect(copper!.amount).toBe(1000);
  });

  it('第50名返回第四档奖励', () => {
    const rewards = getRewardsForRank(50);
    const copper = rewards.find((r) => r.resource === 'copper');
    expect(copper!.amount).toBe(1000);
  });

  it('第51名返回参与奖', () => {
    const rewards = getRewardsForRank(51);
    const copper = rewards.find((r) => r.resource === 'copper');
    expect(copper!.amount).toBe(500);
  });

  it('第100名返回参与奖', () => {
    const rewards = getRewardsForRank(100);
    const copper = rewards.find((r) => r.resource === 'copper');
    expect(copper!.amount).toBe(500);
  });

  it('第1000名返回参与奖', () => {
    const rewards = getRewardsForRank(1000);
    const copper = rewards.find((r) => r.resource === 'copper');
    expect(copper!.amount).toBe(500);
  });

  it('返回的是奖励副本（不影响原配置）', () => {
    const r1 = getRewardsForRank(1);
    const r2 = getRewardsForRank(1);
    expect(r1).not.toBe(r2);
    expect(r1).toEqual(r2);
  });

  it('所有奖励条目有有效 resource 和 amount', () => {
    for (let rank = 1; rank <= 100; rank++) {
      const rewards = getRewardsForRank(rank);
      for (const r of rewards) {
        expect(r.resource).toBeTruthy();
        expect(r.amount).toBeGreaterThan(0);
      }
    }
  });

  it('排名越前奖励铜钱越多（单调递减）', () => {
    let prevCopper = Infinity;
    for (let rank = 1; rank <= 100; rank++) {
      const rewards = getRewardsForRank(rank);
      const copper = rewards.find((r) => r.resource === 'copper')!.amount;
      expect(copper).toBeLessThanOrEqual(prevCopper);
      prevCopper = copper;
    }
  });

  it('边界：rank=0 返回参与奖（fallback）', () => {
    const rewards = getRewardsForRank(0);
    // fallback to last tier (participation)
    expect(rewards.length).toBeGreaterThan(0);
  });

  it('边界：rank 为负数返回参与奖', () => {
    const rewards = getRewardsForRank(-1);
    expect(rewards.length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════
// 常量验证
// ═══════════════════════════════════════════
describe('常量', () => {
  it('DEFAULT_SEASON_DURATION_DAYS 为 30', () => {
    expect(DEFAULT_SEASON_DURATION_DAYS).toBe(30);
  });

  it('SEASON_SAVE_VERSION 为正整数', () => {
    expect(SEASON_SAVE_VERSION).toBeGreaterThan(0);
    expect(Number.isInteger(SEASON_SAVE_VERSION)).toBe(true);
  });

  it('DEFAULT_LEADERBOARD_LIMIT > 0', () => {
    expect(DEFAULT_LEADERBOARD_LIMIT).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════
// SEASON_REWARD_TIERS 结构验证
// ═══════════════════════════════════════════
describe('SEASON_REWARD_TIERS', () => {
  it('非空', () => {
    expect(SEASON_REWARD_TIERS.length).toBeGreaterThan(0);
  });

  it('minRank <= maxRank（或 maxRank=-1 表示无上限）', () => {
    for (const tier of SEASON_REWARD_TIERS) {
      if (tier.maxRank !== -1) {
        expect(tier.minRank).toBeLessThanOrEqual(tier.maxRank);
      }
    }
  });

  it('每档有至少1项奖励', () => {
    for (const tier of SEASON_REWARD_TIERS) {
      expect(tier.rewards.length).toBeGreaterThan(0);
    }
  });

  it('最后一档 maxRank 为 -1（参与奖无上限）', () => {
    const lastTier = SEASON_REWARD_TIERS[SEASON_REWARD_TIERS.length - 1];
    expect(lastTier.maxRank).toBe(-1);
  });

  it('排名区间不重叠', () => {
    for (let i = 1; i < SEASON_REWARD_TIERS.length; i++) {
      const prev = SEASON_REWARD_TIERS[i - 1];
      const curr = SEASON_REWARD_TIERS[i];
      if (prev.maxRank !== -1) {
        expect(curr.minRank).toBeGreaterThan(prev.maxRank);
      }
    }
  });
});
