/**
 * 活动系统 — 离线进度计算
 *
 * 职责：计算离线期间的积分/代币收益，应用离线进度到活动状态
 * 从 ActivitySystem.ts 拆分以控制文件行数
 *
 * @module engine/activity/ActivityOfflineCalculator
 */

import type {
  ActivityState,
  OfflineEfficiencyConfig,
  OfflineActivityResult,
} from '../../core/activity/activity.types';
import { ActivityStatus } from '../../core/activity/activity.types';
import { BASE_POINTS_PER_SECOND } from './ActivitySystemConfig';

/**
 * 计算离线进度
 *
 * 遍历所有活跃活动，根据活动类型和离线效率计算获得的积分和代币
 *
 * @param state - 活动状态
 * @param offlineDurationMs - 离线时长（毫秒）
 * @param offlineEfficiency - 离线效率配置
 * @returns 离线进度结果数组
 */
export function calculateOfflineProgress(
  state: ActivityState,
  offlineDurationMs: number,
  offlineEfficiency: OfflineEfficiencyConfig,
): OfflineActivityResult[] {
  const results: OfflineActivityResult[] = [];
  const durationSeconds = offlineDurationMs / 1000;

  for (const [activityId, instance] of Object.entries(state.activities)) {
    if (instance.status !== ActivityStatus.ACTIVE) continue;

    // 根据活动类型获取效率（通过 defId 前缀判断）
    let efficiency = 0.5;
    if (activityId.startsWith('season_')) efficiency = offlineEfficiency.season;
    else if (activityId.startsWith('limited_')) efficiency = offlineEfficiency.limitedTime;
    else if (activityId.startsWith('daily_')) efficiency = offlineEfficiency.daily;
    else if (activityId.startsWith('festival_')) efficiency = offlineEfficiency.festival;
    else if (activityId.startsWith('alliance_')) efficiency = offlineEfficiency.alliance;

    const pointsEarned = Math.floor(durationSeconds * BASE_POINTS_PER_SECOND * efficiency);
    const tokensEarned = Math.floor(pointsEarned * 0.1);

    if (pointsEarned > 0) {
      results.push({
        activityId,
        pointsEarned,
        tokensEarned,
        offlineDuration: offlineDurationMs,
      });
    }
  }

  return results;
}

/**
 * 应用离线进度
 *
 * 将离线进度结果应用到活动状态，更新积分和代币
 *
 * @param state - 活动状态
 * @param results - 离线进度结果数组
 * @returns 更新后的活动状态
 */
export function applyOfflineProgress(
  state: ActivityState,
  results: OfflineActivityResult[],
): ActivityState {
  let newState = { ...state };

  for (const result of results) {
    const instance = newState.activities[result.activityId];
    if (!instance) continue;

    newState = {
      ...newState,
      activities: {
        ...newState.activities,
        [result.activityId]: {
          ...instance,
          points: instance.points + result.pointsEarned,
          tokens: instance.tokens + result.tokensEarned,
        },
      },
    };
  }

  return newState;
}
