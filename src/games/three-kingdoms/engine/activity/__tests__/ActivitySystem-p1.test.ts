/**
 * ActivitySystem 单元测试
 *
 * 覆盖：
 * 1. 活动列表管理（进行中/即将/已结束Tab）
 * 2. 5类活动类型（赛季/限时/日常/节日/联盟）
 * 3. 活动任务系统（每日/挑战/累积3类任务 + 积分 + 代币）
 * 4. 里程碑奖励（线性推进 + 手动领取）
 * 5. 离线进度
 * 6. 赛季深化（主题/结算/战绩）
 * 7. 序列化/反序列化
 */

import {
  ActivitySystem,
  createDefaultActivityState,
  createActivityInstance,
  createActivityTask,
  createMilestone,
  DEFAULT_CONCURRENCY_CONFIG,
  DEFAULT_OFFLINE_EFFICIENCY,
  ACTIVITY_SAVE_VERSION,
  DEFAULT_SEASON_THEMES,
} from '../ActivitySystem';

import type {
  ActivityDef,
  ActivityTaskDef,
  ActivityMilestone,
  ActivityState,
} from '../../../core/activity/activity.types';

import {
  ActivityType,
  ActivityStatus,
  ActivityTaskType,
  ActivityTaskStatus,
  MilestoneStatus,
} from '../../../core/activity/activity.types';

// ─── 辅助 ────────────────────────────────────

/** 创建测试用活动定义 */
function createActivityDef(
  id: string,
  type: ActivityType,
  overrides?: Partial<ActivityDef>,
): ActivityDef {
  return {
    id,
    name: `活动_${id}`,
    description: `测试活动 ${id}`,
    type,
    startTime: Date.now() - 1000,
    endTime: Date.now() + 86400000,
    icon: `icon_${id}`,
    ...overrides,
  };
}

/** 创建测试用任务定义 */
function createTaskDef(
  id: string,
  taskType: ActivityTaskType,
  overrides?: Partial<ActivityTaskDef>,
): ActivityTaskDef {
  return {
    id,
    name: `任务_${id}`,
    description: `测试任务 ${id}`,
    taskType,
    targetCount: 10,
    tokenReward: 5,
    pointReward: 20,
    resourceReward: { copper: 100 },
    ...overrides,
  };
}

/** 创建标准任务定义集（5每日 + 3挑战 + 1累积） */
function createStandardTaskDefs(): ActivityTaskDef[] {
  const daily = Array.from({ length: 5 }, (_, i) =>
    createTaskDef(`daily_${i + 1}`, ActivityTaskType.DAILY, {
      targetCount: 5 + i,
      pointReward: 10,
      tokenReward: 2,
    }),
  );
  const challenge = Array.from({ length: 3 }, (_, i) =>
    createTaskDef(`challenge_${i + 1}`, ActivityTaskType.CHALLENGE, {
      targetCount: 20 + i * 10,
      pointReward: 50,
      tokenReward: 10,
    }),
  );
  const cumulative = [
    createTaskDef('cumulative_1', ActivityTaskType.CUMULATIVE, {
      targetCount: 100,
      pointReward: 100,
      tokenReward: 30,
    }),
  ];
  return [...daily, ...challenge, ...cumulative];
}

/** 创建标准里程碑列表 */
function createStandardMilestones(): ActivityMilestone[] {
  return [
    createMilestone('ms_1', 50, { copper: 500 }),
    createMilestone('ms_2', 150, { gold: 10 }),
    createMilestone('ms_3', 300, { heroFragment: 3 }),
    createMilestone('ms_final', 500, { legendaryChest: 1 }, true),
  ];
}

/** 创建一个已启动活动的状态 */
function createStartedState(
  activityId: string,
  type: ActivityType,
  now: number,
  taskDefs?: ActivityTaskDef[],
  milestones?: ActivityMilestone[],
): ActivityState {
  const system = new ActivitySystem();
  const state = createDefaultActivityState();
  const def = createActivityDef(activityId, type);
  const tasks = taskDefs ?? createStandardTaskDefs();
  const ms = milestones ?? createStandardMilestones();
  return system.startActivity(state, def, tasks, ms, now);
}

/** 当前时间戳 */
const NOW = Date.now();

// ═══════════════════════════════════════════════
// 测试
// ═══════════════════════════════════════════════

describe('ActivitySystem', () => {
  let system: ActivitySystem;
  beforeEach(() => {
    system = new ActivitySystem();
  });

  // ═══════════════════════════════════════════
  // 1. 默认状态与工具函数
  // ═══════════════════════════════════════════
  describe('默认状态与工具函数', () => {
    it('createDefaultActivityState 返回空活动列表', () => {
      const state = createDefaultActivityState();
      expect(state.activities).toEqual({});
      expect(state.signIn).toBeDefined();
      expect(state.seasonRecord).toBeDefined();
    });

    it('createActivityInstance 创建正确实例', () => {
      const def = createActivityDef('test', ActivityType.SEASON);
      const instance = createActivityInstance(def, NOW);
      expect(instance.defId).toBe('test');
      expect(instance.status).toBe(ActivityStatus.ACTIVE);
      expect(instance.points).toBe(0);
      expect(instance.tokens).toBe(0);
      expect(instance.tasks).toEqual([]);
      expect(instance.milestones).toEqual([]);
    });

    it('createActivityTask 创建正确任务', () => {
      const def = createTaskDef('t1', ActivityTaskType.DAILY);
      const task = createActivityTask(def);
      expect(task.defId).toBe('t1');
      expect(task.taskType).toBe(ActivityTaskType.DAILY);
      expect(task.currentProgress).toBe(0);
      expect(task.targetCount).toBe(10);
      expect(task.status).toBe(ActivityTaskStatus.INCOMPLETE);
      expect(task.tokenReward).toBe(5);
      expect(task.pointReward).toBe(20);
    });

    it('createMilestone 创建正确里程碑', () => {
      const ms = createMilestone('ms1', 100, { copper: 500 });
      expect(ms.id).toBe('ms1');
      expect(ms.requiredPoints).toBe(100);
      expect(ms.status).toBe(MilestoneStatus.LOCKED);
      expect(ms.rewards).toEqual({ copper: 500 });
      expect(ms.isFinal).toBe(false);
    });

    it('createMilestone isFinal 默认 false', () => {
      const ms = createMilestone('ms1', 100, {});
      expect(ms.isFinal).toBe(false);
    });

    it('createMilestone isFinal 可设为 true', () => {
      const ms = createMilestone('ms1', 100, {}, true);
      expect(ms.isFinal).toBe(true);
    });
  });

  // ═══════════════════════════════════════════
  // 2. 活动列表管理（Tab 切换）
  // ═══════════════════════════════════════════
  describe('活动列表管理', () => {
    it('启动活动后出现在 activities 中', () => {
      const state = createStartedState('season_1', ActivityType.SEASON, NOW);
      expect(state.activities['season_1']).toBeDefined();
      expect(state.activities['season_1'].status).toBe(ActivityStatus.ACTIVE);
    });

    it('getActiveActivities 返回所有进行中活动', () => {
      let state = createDefaultActivityState();
      state = system.startActivity(
        state,
        createActivityDef('season_1', ActivityType.SEASON),
        createStandardTaskDefs(),
        createStandardMilestones(),
        NOW,
      );
      state = system.startActivity(
        state,
        createActivityDef('limited_1', ActivityType.LIMITED_TIME),
        createStandardTaskDefs(),
        createStandardMilestones(),
        NOW,
      );

      const active = system.getActiveActivities(state);
      expect(active).toHaveLength(2);
      expect(active.every(a => a.status === ActivityStatus.ACTIVE)).toBe(true);
    });

    it('updateActivityStatus 活动到期后标记为 ENDED', () => {
      const state = createStartedState('season_1', ActivityType.SEASON, NOW);
      const endTime = NOW + 1000;
      // 当前时间已超过结束时间
      const updated = system.updateActivityStatus(state, 'season_1', NOW + 2000, endTime);
      expect(updated.activities['season_1'].status).toBe(ActivityStatus.ENDED);
    });

    it('updateActivityStatus 活动未到期保持 ACTIVE', () => {
      const state = createStartedState('season_1', ActivityType.SEASON, NOW);
      const endTime = NOW + 100000;
      const updated = system.updateActivityStatus(state, 'season_1', NOW + 500, endTime);
      expect(updated.activities['season_1'].status).toBe(ActivityStatus.ACTIVE);
    });

    it('updateActivityStatus 不存在的活动返回原状态', () => {
      const state = createDefaultActivityState();
      const updated = system.updateActivityStatus(state, 'nonexistent', NOW, NOW + 1000);
      expect(updated).toBe(state);
    });

    it('已结束活动不出现在 getActiveActivities 中', () => {
      const state = createStartedState('season_1', ActivityType.SEASON, NOW);
      const updated = system.updateActivityStatus(state, 'season_1', NOW + 2000, NOW + 1000);
      const active = system.getActiveActivities(updated);
      expect(active).toHaveLength(0);
    });

    it('canStartActivity 未达上限时可以启动', () => {
      const state = createDefaultActivityState();
      const result = system.canStartActivity(state, ActivityType.SEASON);
      expect(result.canStart).toBe(true);
    });

    it('canStartActivity 达到总上限时不能启动', () => {
      let state = createDefaultActivityState();
      // 启动5个活动达到上限
      for (let i = 0; i < 5; i++) {
        state = system.startActivity(
          state,
          createActivityDef(`act_${i}`, ActivityType.SEASON),
          [],
          [],
          NOW,
        );
      }
      const result = system.canStartActivity(state, ActivityType.SEASON);
      expect(result.canStart).toBe(false);
      expect(result.reason).toContain('上限');
    });
  });

  // ═══════════════════════════════════════════
  // 3. 5类活动类型
  // ═══════════════════════════════════════════
  describe('5类活动类型', () => {
    const activityTypes: ActivityType[] = [
      ActivityType.SEASON,
      ActivityType.LIMITED_TIME,
      ActivityType.DAILY,
      ActivityType.FESTIVAL,
      ActivityType.ALLIANCE,
    ];

    it.each(activityTypes)('可以启动 %s 类型活动', (type) => {
      const state = createStartedState(`act_${type}`, type, NOW);
      expect(state.activities[`act_${type}`]).toBeDefined();
      expect(state.activities[`act_${type}`].status).toBe(ActivityStatus.ACTIVE);
    });

    it('可以同时启动不同类型的活动', () => {
      let state = createDefaultActivityState();
      for (const type of activityTypes) {
        state = system.startActivity(
          state,
          createActivityDef(`act_${type}`, type),
          createStandardTaskDefs(),
          createStandardMilestones(),
          NOW,
        );
      }
      expect(Object.keys(state.activities)).toHaveLength(5);
      expect(system.getActiveActivities(state)).toHaveLength(5);
    });

    it('ActivityType 枚举值正确', () => {
      expect(ActivityType.SEASON).toBe('SEASON');
      expect(ActivityType.LIMITED_TIME).toBe('LIMITED_TIME');
      expect(ActivityType.DAILY).toBe('DAILY');
      expect(ActivityType.FESTIVAL).toBe('FESTIVAL');
      expect(ActivityType.ALLIANCE).toBe('ALLIANCE');
    });

    it('ActivityStatus 枚举值正确', () => {
      expect(ActivityStatus.UPCOMING).toBe('UPCOMING');
      expect(ActivityStatus.ACTIVE).toBe('ACTIVE');
      expect(ActivityStatus.ENDED).toBe('ENDED');
    });
  });

  // ═══════════════════════════════════════════
  // 4. 活动任务系统
  // ═══════════════════════════════════════════
  describe('活动任务系统', () => {
    let state: ActivityState;

    beforeEach(() => {
      state = createStartedState('season_1', ActivityType.SEASON, NOW, createStandardTaskDefs(), createStandardMilestones());
    });

    // ── 任务创建 ──────────────────────────
    it('启动活动后包含所有任务（5每日 + 3挑战 + 1累积 = 9个）', () => {
      const tasks = state.activities['season_1'].tasks;
      expect(tasks).toHaveLength(9);
      expect(tasks.filter(t => t.taskType === ActivityTaskType.DAILY)).toHaveLength(5);
      expect(tasks.filter(t => t.taskType === ActivityTaskType.CHALLENGE)).toHaveLength(3);
      expect(tasks.filter(t => t.taskType === ActivityTaskType.CUMULATIVE)).toHaveLength(1);
    });

    it('所有任务初始状态为 INCOMPLETE', () => {
      const tasks = state.activities['season_1'].tasks;
      for (const task of tasks) {
        expect(task.status).toBe(ActivityTaskStatus.INCOMPLETE);
        expect(task.currentProgress).toBe(0);
      }
    });

    // ── 进度更新 ──────────────────────────
    it('updateTaskProgress 增加进度', () => {
      const updated = system.updateTaskProgress(state, 'season_1', 'daily_1', 3);
      const task = updated.activities['season_1'].tasks.find(t => t.defId === 'daily_1');
      expect(task!.currentProgress).toBe(3);
      expect(task!.status).toBe(ActivityTaskStatus.INCOMPLETE);
    });

    it('updateTaskProgress 达到目标后标记为 COMPLETED', () => {
      const updated = system.updateTaskProgress(state, 'season_1', 'daily_1', 5);
      const task = updated.activities['season_1'].tasks.find(t => t.defId === 'daily_1');
      expect(task!.currentProgress).toBe(5);
      expect(task!.status).toBe(ActivityTaskStatus.COMPLETED);
    });

    it('updateTaskProgress 进度不超过 targetCount', () => {
      const updated = system.updateTaskProgress(state, 'season_1', 'daily_1', 100);
      const task = updated.activities['season_1'].tasks.find(t => t.defId === 'daily_1');
      expect(task!.currentProgress).toBe(5); // targetCount = 5
    });

    it('updateTaskProgress 已领取的任务不再更新', () => {
      // 先完成并领取
      let s = system.updateTaskProgress(state, 'season_1', 'daily_1', 5);
      const claimResult = system.claimTaskReward(s, 'season_1', 'daily_1');
      s = claimResult.state;

      // 再次更新进度，应该不变
      const updated = system.updateTaskProgress(s, 'season_1', 'daily_1', 3);
      const task = updated.activities['season_1'].tasks.find(t => t.defId === 'daily_1');
      expect(task!.status).toBe(ActivityTaskStatus.CLAIMED);
      expect(task!.currentProgress).toBe(5);
    });

    it('updateTaskProgress 不存在的活动返回原状态', () => {
      const updated = system.updateTaskProgress(state, 'nonexistent', 'daily_1', 1);
      expect(updated).toBe(state);
    });

    it('updateTaskProgress 不影响其他任务', () => {
      const updated = system.updateTaskProgress(state, 'season_1', 'daily_1', 3);
      const otherTask = updated.activities['season_1'].tasks.find(t => t.defId === 'daily_2');
      expect(otherTask!.currentProgress).toBe(0);
      expect(otherTask!.status).toBe(ActivityTaskStatus.INCOMPLETE);
    });

    // ── 奖励领取 ──────────────────────────
    it('claimTaskReward 领取已完成任务奖励', () => {
      let s = system.updateTaskProgress(state, 'season_1', 'daily_1', 5);
      const result = system.claimTaskReward(s, 'season_1', 'daily_1');

      expect(result.points).toBe(10); // pointReward = 10
      expect(result.tokens).toBe(2);  // tokenReward = 2

      const task = result.state.activities['season_1'].tasks.find(t => t.defId === 'daily_1');
      expect(task!.status).toBe(ActivityTaskStatus.CLAIMED);
    });

    it('claimTaskReward 积分和代币累加到活动实例', () => {
      let s = system.updateTaskProgress(state, 'season_1', 'daily_1', 5);
      const result = system.claimTaskReward(s, 'season_1', 'daily_1');
      expect(result.state.activities['season_1'].points).toBe(10);
      expect(result.state.activities['season_1'].tokens).toBe(2);
    });

    it('claimTaskReward 多次领取累积积分代币', () => {
      let s = system.updateTaskProgress(state, 'season_1', 'daily_1', 5);
      s = system.updateTaskProgress(s, 'season_1', 'daily_2', 6);
      const r1 = system.claimTaskReward(s, 'season_1', 'daily_1');
      const r2 = system.claimTaskReward(r1.state, 'season_1', 'daily_2');

      expect(r2.state.activities['season_1'].points).toBe(20);
      expect(r2.state.activities['season_1'].tokens).toBe(4);
    });

    it('claimTaskReward 未完成任务抛异常', () => {
      expect(() => {
        system.claimTaskReward(state, 'season_1', 'daily_1');
      }).toThrow('任务未完成');
    });

    it('claimTaskReward 已领取任务抛异常', () => {
      let s = system.updateTaskProgress(state, 'season_1', 'daily_1', 5);
      s = system.claimTaskReward(s, 'season_1', 'daily_1').state;
      expect(() => {
        system.claimTaskReward(s, 'season_1', 'daily_1');
      }).toThrow('已领取');
    });

    it('claimTaskReward 活动不存在抛异常', () => {
      expect(() => {
        system.claimTaskReward(state, 'nonexistent', 'daily_1');
      }).toThrow('活动不存在');
    });

    it('claimTaskReward 任务不存在抛异常', () => {
      expect(() => {
        system.claimTaskReward(state, 'season_1', 'nonexistent');
      }).toThrow('任务不存在');
    });

    // ── 每日任务重置 ──────────────────────
    it('resetDailyTasks 重置每日任务进度', () => {
      let s = system.updateTaskProgress(state, 'season_1', 'daily_1', 5);
      s = system.updateTaskProgress(s, 'season_1', 'challenge_1', 10);

      const dailyDefs = createStandardTaskDefs().filter(d => d.taskType === ActivityTaskType.DAILY);
      const resetState = system.resetDailyTasks(s, 'season_1', dailyDefs);

      // 每日任务被重置
