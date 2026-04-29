/**
 * ActivityOfflineCalculator 单元测试
 *
 * 覆盖：
 * 1. calculateOfflineProgress — 离线进度计算
 * 2. applyOfflineProgress — 应用离线进度到状态
 */

import {
  calculateOfflineProgress,
  applyOfflineProgress,
} from '../ActivityOfflineCalculator';

import { ActivityStatus } from '../../../core/activity/activity.types';

import type {
  ActivityState,
  OfflineEfficiencyConfig,
  OfflineActivityResult,
} from '../../../core/activity/activity.types';

describe('ActivityOfflineCalculator', () => {
  const defaultEfficiency: OfflineEfficiencyConfig = {
    season: 0.5,
    limitedTime: 0.3,
    daily: 1.0,
    festival: 0.5,
    alliance: 0.5,
  };

  function makeState(activities: Record<string, { status: ActivityStatus; points: number; tokens: number }>): ActivityState {
    const instances: ActivityState['activities'] = {};
    for (const [id, val] of Object.entries(activities)) {
      instances[id] = {
        defId: id,
        status: val.status,
        points: val.points,
        tokens: val.tokens,
        tasks: [],
        milestones: [],
        createdAt: 0,
      };
    }
    return {
      activities: instances,
      signIn: {
        consecutiveDays: 0,
        todaySigned: false,
        lastSignInTime: 0,
        weeklyRetroactiveCount: 0,
        lastRetroactiveResetWeek: 0,
      },
      seasonRecord: {
        seasonId: '',
        wins: 0,
        losses: 0,
        total: 0,
        winRate: 0,
        highestRank: '',
        highestRanking: 0,
      },
    };
  }

  // ─── calculateOfflineProgress ─────────────

  describe('calculateOfflineProgress', () => {
    it('应对活跃活动计算离线进度', () => {
      const state = makeState({
        daily_001: { status: ActivityStatus.ACTIVE, points: 0, tokens: 0 },
      });
      const results = calculateOfflineProgress(state, 3600000, defaultEfficiency);
      expect(results.length).toBe(1);
      expect(results[0].activityId).toBe('daily_001');
      expect(results[0].pointsEarned).toBeGreaterThan(0);
    });

    it('应跳过非活跃活动', () => {
      const state = makeState({
        daily_001: { status: ActivityStatus.COMPLETED, points: 0, tokens: 0 },
      });
      const results = calculateOfflineProgress(state, 3600000, defaultEfficiency);
      expect(results.length).toBe(0);
    });

    it('应根据活动类型前缀选择效率', () => {
      const state = makeState({
        season_001: { status: ActivityStatus.ACTIVE, points: 0, tokens: 0 },
        limited_001: { status: ActivityStatus.ACTIVE, points: 0, tokens: 0 },
        daily_001: { status: ActivityStatus.ACTIVE, points: 0, tokens: 0 },
      });
      const results = calculateOfflineProgress(state, 3600000, defaultEfficiency);
      // daily效率=1.0, season效率=0.5, limited效率=0.3
      const daily = results.find(r => r.activityId === 'daily_001')!;
      const season = results.find(r => r.activityId === 'season_001')!;
      const limited = results.find(r => r.activityId === 'limited_001')!;
      expect(daily.pointsEarned).toBeGreaterThan(season.pointsEarned);
      expect(season.pointsEarned).toBeGreaterThan(limited.pointsEarned);
    });

    it('应跳过积分为0的结果', () => {
      const state = makeState({
        daily_001: { status: ActivityStatus.ACTIVE, points: 0, tokens: 0 },
      });
      // 离线0毫秒
      const results = calculateOfflineProgress(state, 0, defaultEfficiency);
      expect(results.length).toBe(0);
    });

    it('应计算代币为积分的10%', () => {
      const state = makeState({
        daily_001: { status: ActivityStatus.ACTIVE, points: 0, tokens: 0 },
      });
      const results = calculateOfflineProgress(state, 3600000, defaultEfficiency);
      const result = results[0];
      expect(result.tokensEarned).toBe(Math.floor(result.pointsEarned * 0.1));
    });
  });

  // ─── applyOfflineProgress ─────────────────

  describe('applyOfflineProgress', () => {
    it('应将离线进度应用到活动状态', () => {
      const state = makeState({
        daily_001: { status: ActivityStatus.ACTIVE, points: 10, tokens: 5 },
      });
      const results: OfflineActivityResult[] = [{
        activityId: 'daily_001',
        pointsEarned: 100,
        tokensEarned: 10,
        offlineDuration: 3600000,
      }];
      const newState = applyOfflineProgress(state, results);
      expect(newState.activities['daily_001'].points).toBe(110);
      expect(newState.activities['daily_001'].tokens).toBe(15);
    });

    it('应跳过不存在的活动ID', () => {
      const state = makeState({
        daily_001: { status: ActivityStatus.ACTIVE, points: 10, tokens: 5 },
      });
      const results: OfflineActivityResult[] = [{
        activityId: 'nonexistent',
        pointsEarned: 100,
        tokensEarned: 10,
        offlineDuration: 3600000,
      }];
      const newState = applyOfflineProgress(state, results);
      // 原状态不变
      expect(newState.activities['daily_001'].points).toBe(10);
    });

    it('空结果应返回相同状态', () => {
      const state = makeState({
        daily_001: { status: ActivityStatus.ACTIVE, points: 10, tokens: 5 },
      });
      const newState = applyOfflineProgress(state, []);
      expect(newState.activities['daily_001'].points).toBe(10);
    });

    it('不应修改原始状态', () => {
      const state = makeState({
        daily_001: { status: ActivityStatus.ACTIVE, points: 10, tokens: 5 },
      });
      const results: OfflineActivityResult[] = [{
        activityId: 'daily_001',
        pointsEarned: 100,
        tokensEarned: 10,
        offlineDuration: 3600000,
      }];
      applyOfflineProgress(state, results);
      expect(state.activities['daily_001'].points).toBe(10);
    });
  });
});
