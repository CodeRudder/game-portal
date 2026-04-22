/**
 * 活动系统 — 工厂函数
 *
 * 从 ActivitySystem.ts 拆分出的创建函数：
 *   - createDefaultActivityState
 *   - createActivityInstance
 *   - createActivityTask
 *   - createMilestone
 *
 * @module engine/activity/ActivityFactory
 */

import type {
  ActivityDef,
  ActivityInstance,
  ActivityTask,
  ActivityTaskDef,
  ActivityMilestone,
  ActivityState,
} from '../../core/activity/activity.types';

import {
  ActivityStatus,
  ActivityTaskStatus,
  MilestoneStatus,
} from '../../core/activity/activity.types';

/** 创建默认活动状态 */
export function createDefaultActivityState(): ActivityState {
  return {
    activities: {},
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

/** 从活动定义创建活动实例 */
export function createActivityInstance(def: ActivityDef, now: number): ActivityInstance {
  return {
    defId: def.id,
    status: ActivityStatus.ACTIVE,
    points: 0,
    tokens: 0,
    tasks: [],
    milestones: [],
    createdAt: now,
  };
}

/** 从任务定义创建任务实例 */
export function createActivityTask(def: ActivityTaskDef): ActivityTask {
  return {
    defId: def.id,
    taskType: def.taskType,
    currentProgress: 0,
    targetCount: def.targetCount,
    status: ActivityTaskStatus.INCOMPLETE,
    tokenReward: def.tokenReward,
    pointReward: def.pointReward,
    resourceReward: { ...def.resourceReward },
  };
}

/** 创建里程碑 */
export function createMilestone(
  id: string,
  requiredPoints: number,
  rewards: Record<string, number>,
  isFinal = false,
): ActivityMilestone {
  return {
    id,
    requiredPoints,
    status: MilestoneStatus.LOCKED,
    rewards: { ...rewards },
    isFinal,
  };
}
