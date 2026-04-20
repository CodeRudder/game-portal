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
      const dailyTask = resetState.activities['season_1'].tasks.find(t => t.defId === 'daily_1');
      expect(dailyTask!.currentProgress).toBe(0);
      expect(dailyTask!.status).toBe(ActivityTaskStatus.INCOMPLETE);

      // 挑战任务不受影响
      const challengeTask = resetState.activities['season_1'].tasks.find(t => t.defId === 'challenge_1');
      expect(challengeTask!.currentProgress).toBe(10);
    });

    it('resetDailyTasks 不存在的活动返回原状态', () => {
      const dailyDefs = createStandardTaskDefs().filter(d => d.taskType === ActivityTaskType.DAILY);
      const result = system.resetDailyTasks(state, 'nonexistent', dailyDefs);
      expect(result).toBe(state);
    });

    // ── 3类任务类型 ──────────────────────
    it('每日任务(DAILY)可完成和领取', () => {
      let s = system.updateTaskProgress(state, 'season_1', 'daily_1', 5);
      const result = system.claimTaskReward(s, 'season_1', 'daily_1');
      expect(result.points).toBeGreaterThan(0);
    });

    it('挑战任务(CHALLENGE)可完成和领取', () => {
      let s = system.updateTaskProgress(state, 'season_1', 'challenge_1', 20);
      const result = system.claimTaskReward(s, 'season_1', 'challenge_1');
      expect(result.points).toBe(50);
      expect(result.tokens).toBe(10);
    });

    it('累积任务(CUMULATIVE)可完成和领取', () => {
      let s = system.updateTaskProgress(state, 'season_1', 'cumulative_1', 100);
      const result = system.claimTaskReward(s, 'season_1', 'cumulative_1');
      expect(result.points).toBe(100);
      expect(result.tokens).toBe(30);
    });

    it('ActivityTaskType 枚举值正确', () => {
      expect(ActivityTaskType.DAILY).toBe('DAILY');
      expect(ActivityTaskType.CHALLENGE).toBe('CHALLENGE');
      expect(ActivityTaskType.CUMULATIVE).toBe('CUMULATIVE');
    });

    it('ActivityTaskStatus 枚举值正确', () => {
      expect(ActivityTaskStatus.INCOMPLETE).toBe('INCOMPLETE');
      expect(ActivityTaskStatus.COMPLETED).toBe('COMPLETED');
      expect(ActivityTaskStatus.CLAIMED).toBe('CLAIMED');
    });
  });

  // ═══════════════════════════════════════════
  // 5. 里程碑奖励
  // ═══════════════════════════════════════════
  describe('里程碑奖励', () => {
    let state: ActivityState;

    beforeEach(() => {
      state = createStartedState('season_1', ActivityType.SEASON, NOW, createStandardTaskDefs(), createStandardMilestones());
    });

    it('初始里程碑全部 LOCKED', () => {
      const milestones = state.activities['season_1'].milestones;
      for (const ms of milestones) {
        expect(ms.status).toBe(MilestoneStatus.LOCKED);
      }
    });

    it('checkMilestones 积分足够时解锁里程碑', () => {
      // 先累积积分到 50（ms_1 需要 50）
      let s = state;
      for (let i = 0; i < 5; i++) {
        s = system.updateTaskProgress(s, 'season_1', `daily_${i + 1}`, 5 + i);
        s = system.claimTaskReward(s, 'season_1', `daily_${i + 1}`).state;
      }

      const checked = system.checkMilestones(s, 'season_1');
      const ms1 = checked.activities['season_1'].milestones.find(m => m.id === 'ms_1');
      expect(ms1!.status).toBe(MilestoneStatus.UNLOCKED);
    });

    it('checkMilestones 积分不足时保持 LOCKED', () => {
      // 只累积少量积分
      let s = system.updateTaskProgress(state, 'season_1', 'daily_1', 5);
      s = system.claimTaskReward(s, 'season_1', 'daily_1').state;
      // points = 10, 不足以解锁 ms_1(50)

      const checked = system.checkMilestones(s, 'season_1');
      const ms1 = checked.activities['season_1'].milestones.find(m => m.id === 'ms_1');
      expect(ms1!.status).toBe(MilestoneStatus.LOCKED);
    });

    it('checkMilestones 线性推进：低分先解锁', () => {
      // 积分到 150（解锁 ms_1 和 ms_2）
      let s = state;
      const tasks = createStandardTaskDefs();
      // 只完成每日任务(5×10=50)和2个挑战任务(2×50=100)，总分150
      const partialTasks = tasks.filter(t =>
        t.taskType === ActivityTaskType.DAILY
        || t.id === 'challenge_1'
        || t.id === 'challenge_2',
      );
      for (const t of partialTasks) {
        s = system.updateTaskProgress(s, 'season_1', t.id, t.targetCount);
        s = system.claimTaskReward(s, 'season_1', t.id).state;
      }

      const checked = system.checkMilestones(s, 'season_1');
      const milestones = checked.activities['season_1'].milestones;

      // ms_1 (50) 和 ms_2 (150) 应该解锁
      expect(milestones.find(m => m.id === 'ms_1')!.status).toBe(MilestoneStatus.UNLOCKED);
      expect(milestones.find(m => m.id === 'ms_2')!.status).toBe(MilestoneStatus.UNLOCKED);
      // ms_3 (300) 和 ms_final (500) 还未解锁
      expect(milestones.find(m => m.id === 'ms_3')!.status).toBe(MilestoneStatus.LOCKED);
      expect(milestones.find(m => m.id === 'ms_final')!.status).toBe(MilestoneStatus.LOCKED);
    });

    it('checkMilestones 已 CLAIMED 的里程碑不变', () => {
      // 先解锁并领取 ms_1
      let s = state;
      for (let i = 0; i < 5; i++) {
        s = system.updateTaskProgress(s, 'season_1', `daily_${i + 1}`, 5 + i);
        s = system.claimTaskReward(s, 'season_1', `daily_${i + 1}`).state;
      }
      s = system.checkMilestones(s, 'season_1');
      s = system.claimMilestone(s, 'season_1', 'ms_1').state;

      // 再次检查，已领取的不变
      const checked = system.checkMilestones(s, 'season_1');
      const ms1 = checked.activities['season_1'].milestones.find(m => m.id === 'ms_1');
      expect(ms1!.status).toBe(MilestoneStatus.CLAIMED);
    });

    it('checkMilestones 不存在的活动返回原状态', () => {
      const checked = system.checkMilestones(state, 'nonexistent');
      expect(checked).toBe(state);
    });

    it('claimMilestone 手动领取已解锁里程碑', () => {
      // 累积积分并解锁
      let s = state;
      for (let i = 0; i < 5; i++) {
        s = system.updateTaskProgress(s, 'season_1', `daily_${i + 1}`, 5 + i);
        s = system.claimTaskReward(s, 'season_1', `daily_${i + 1}`).state;
      }
      s = system.checkMilestones(s, 'season_1');

      const result = system.claimMilestone(s, 'season_1', 'ms_1');
      expect(result.rewards).toEqual({ copper: 500 });
      expect(result.state.activities['season_1'].milestones.find(m => m.id === 'ms_1')!.status).toBe(MilestoneStatus.CLAIMED);
    });

    it('claimMilestone 未解锁里程碑抛异常', () => {
      expect(() => {
        system.claimMilestone(state, 'season_1', 'ms_1');
      }).toThrow('里程碑未解锁');
    });

    it('claimMilestone 已领取里程碑抛异常', () => {
      // 先解锁并领取
      let s = state;
      for (let i = 0; i < 5; i++) {
        s = system.updateTaskProgress(s, 'season_1', `daily_${i + 1}`, 5 + i);
        s = system.claimTaskReward(s, 'season_1', `daily_${i + 1}`).state;
      }
      s = system.checkMilestones(s, 'season_1');
      s = system.claimMilestone(s, 'season_1', 'ms_1').state;

      // 再次领取
      expect(() => {
        system.claimMilestone(s, 'season_1', 'ms_1');
      }).toThrow('已领取');
    });

    it('claimMilestone 活动不存在抛异常', () => {
      expect(() => {
        system.claimMilestone(state, 'nonexistent', 'ms_1');
      }).toThrow('活动不存在');
    });

    it('claimMilestone 里程碑不存在抛异常', () => {
      expect(() => {
        system.claimMilestone(state, 'season_1', 'nonexistent');
      }).toThrow('里程碑不存在');
    });

    it('MilestoneStatus 枚举值正确', () => {
      expect(MilestoneStatus.LOCKED).toBe('LOCKED');
      expect(MilestoneStatus.UNLOCKED).toBe('UNLOCKED');
      expect(MilestoneStatus.CLAIMED).toBe('CLAIMED');
    });

    it('里程碑 isFinal 标记正确', () => {
      const milestones = state.activities['season_1'].milestones;
      expect(milestones.find(m => m.id === 'ms_final')!.isFinal).toBe(true);
      expect(milestones.filter(m => !m.isFinal)).toHaveLength(3);
    });
  });

  // ═══════════════════════════════════════════
  // 6. 离线进度
  // ═══════════════════════════════════════════
  describe('离线进度', () => {
    it('calculateOfflineProgress 为活跃活动计算离线积分', () => {
      const state = createStartedState('season_1', ActivityType.SEASON, NOW);
      const results = system.calculateOfflineProgress(state, 3600000); // 1小时
      expect(results).toHaveLength(1);
      expect(results[0].activityId).toBe('season_1');
      expect(results[0].pointsEarned).toBeGreaterThan(0);
    });

    it('calculateOfflineProgress 已结束活动不产生进度', () => {
      let state = createStartedState('season_1', ActivityType.SEASON, NOW);
      state = system.updateActivityStatus(state, 'season_1', NOW + 2000, NOW + 1000);
      const results = system.calculateOfflineProgress(state, 3600000);
      expect(results).toHaveLength(0);
    });

    it('calculateOfflineProgress 不同活动类型效率不同', () => {
      let state = createDefaultActivityState();
      state = system.startActivity(state, createActivityDef('season_1', ActivityType.SEASON), [], [], NOW);
      state = system.startActivity(state, createActivityDef('limited_1', ActivityType.LIMITED_TIME), [], [], NOW);
      state = system.startActivity(state, createActivityDef('daily_1', ActivityType.DAILY), [], [], NOW);

      const results = system.calculateOfflineProgress(state, 3600000);
      expect(results).toHaveLength(3);

      // daily 效率 1.0 > season 0.5 > limited 0.3
      const dailyResult = results.find(r => r.activityId === 'daily_1')!;
      const seasonResult = results.find(r => r.activityId === 'season_1')!;
      const limitedResult = results.find(r => r.activityId === 'limited_1')!;

      expect(dailyResult.pointsEarned).toBeGreaterThan(seasonResult.pointsEarned);
      expect(seasonResult.pointsEarned).toBeGreaterThan(limitedResult.pointsEarned);
    });

    it('applyOfflineProgress 应用离线进度到状态', () => {
      const state = createStartedState('season_1', ActivityType.SEASON, NOW);
      const results = system.calculateOfflineProgress(state, 3600000);
      const updated = system.applyOfflineProgress(state, results);

      expect(updated.activities['season_1'].points).toBeGreaterThan(0);
      expect(updated.activities['season_1'].tokens).toBeGreaterThanOrEqual(0);
    });

    it('applyOfflineProgress 空结果不改变状态', () => {
      const state = createDefaultActivityState();
      const updated = system.applyOfflineProgress(state, []);
      expect(updated).toEqual(state);
    });

    it('applyOfflineProgress 不存在的活动跳过', () => {
      const state = createDefaultActivityState();
      const results = [{ activityId: 'nonexistent', pointsEarned: 100, tokensEarned: 10, offlineDuration: 3600000 }];
      const updated = system.applyOfflineProgress(state, results);
      expect(updated).toEqual(state);
    });
  });

  // ═══════════════════════════════════════════
  // 7. 赛季深化
  // ═══════════════════════════════════════════
  describe('赛季深化', () => {
    it('getCurrentSeasonTheme 返回正确主题', () => {
      const theme = system.getCurrentSeasonTheme(0);
      expect(theme.id).toBe('theme_s1');
      expect(theme.name).toBe('黄巾之乱');
    });

    it('getCurrentSeasonTheme 循环返回主题', () => {
      const theme = system.getCurrentSeasonTheme(4); // 超出长度，应循环
      expect(theme.id).toBe('theme_s1');
    });

    it('getSeasonThemes 返回全部主题', () => {
      const themes = system.getSeasonThemes();
      expect(themes).toHaveLength(4);
    });

    it('createSettlementAnimation 创建结算动画数据', () => {
      const rewards = { copper: 1000, arenaCoin: 500, gold: 50, title: '测试称号' };
      const animation = system.createSettlementAnimation(
        's1', 'rank_gold', 'rank_platinum', 100, 50, rewards, true,
      );
      expect(animation.seasonId).toBe('s1');
      expect(animation.oldRankId).toBe('rank_gold');
      expect(animation.newRankId).toBe('rank_platinum');
      expect(animation.oldRanking).toBe(100);
      expect(animation.newRanking).toBe(50);
      expect(animation.isServerAnnouncement).toBe(true);
    });

    it('updateSeasonRecord 胜场更新', () => {
      const record = {
        seasonId: 's1',
        wins: 0,
        losses: 0,
        total: 0,
        winRate: 0,
        highestRank: '',
        highestRanking: 0,
      };
      const updated = system.updateSeasonRecord(record, true, 'rank_gold', 50);
      expect(updated.wins).toBe(1);
      expect(updated.losses).toBe(0);
      expect(updated.total).toBe(1);
      expect(updated.winRate).toBe(100);
    });

    it('updateSeasonRecord 败场更新', () => {
      const record = {
        seasonId: 's1',
        wins: 5,
        losses: 3,
        total: 8,
        winRate: 63,
        highestRank: 'rank_gold',
        highestRanking: 50,
      };
      const updated = system.updateSeasonRecord(record, false, 'rank_gold', 60);
      expect(updated.wins).toBe(5);
      expect(updated.losses).toBe(4);
      expect(updated.total).toBe(9);
      expect(updated.winRate).toBe(56); // Math.round(5/9 * 100)
    });

    it('updateSeasonRecord 更新最高排名', () => {
      const record = {
        seasonId: 's1',
        wins: 5,
        losses: 3,
        total: 8,
        winRate: 63,
        highestRank: 'rank_gold',
        highestRanking: 100,
      };
      const updated = system.updateSeasonRecord(record, true, 'rank_gold', 30);
      expect(updated.highestRanking).toBe(30);
    });

    it('generateSeasonRecordRanking 按胜场排序', () => {
      const records = [
        { playerId: 'p1', playerName: '玩家1', record: { seasonId: 's1', wins: 10, losses: 5, total: 15, winRate: 67, highestRank: 'rank_gold', highestRanking: 50 } },
        { playerId: 'p2', playerName: '玩家2', record: { seasonId: 's1', wins: 15, losses: 3, total: 18, winRate: 83, highestRank: 'rank_platinum', highestRanking: 20 } },
        { playerId: 'p3', playerName: '玩家3', record: { seasonId: 's1', wins: 10, losses: 8, total: 18, winRate: 56, highestRank: 'rank_silver', highestRanking: 100 } },
      ];
      const ranking = system.generateSeasonRecordRanking(records);
      expect(ranking[0].playerId).toBe('p2');
      expect(ranking[0].rank).toBe(1);
      // p1 和 p3 同胜场，按胜率排序
      expect(ranking[1].playerId).toBe('p1');
      expect(ranking[1].rank).toBe(2);
      expect(ranking[2].playerId).toBe('p3');
      expect(ranking[2].rank).toBe(3);
    });
  });

  // ═══════════════════════════════════════════
  // 8. 配置
  // ═══════════════════════════════════════════
  describe('配置', () => {
    it('getConcurrencyConfig 返回默认配置', () => {
      const config = system.getConcurrencyConfig();
      expect(config.maxSeason).toBe(1);
      expect(config.maxLimitedTime).toBe(2);
      expect(config.maxDaily).toBe(1);
      expect(config.maxFestival).toBe(1);
      expect(config.maxAlliance).toBe(1);
      expect(config.maxTotal).toBe(5);
    });

    it('自定义并发配置生效', () => {
      const custom = new ActivitySystem({ maxTotal: 10 });
      expect(custom.getConcurrencyConfig().maxTotal).toBe(10);
    });

    it('getOfflineEfficiency 返回默认配置', () => {
      const eff = system.getOfflineEfficiency();
      expect(eff.season).toBe(0.5);
      expect(eff.limitedTime).toBe(0.3);
      expect(eff.daily).toBe(1.0);
      expect(eff.festival).toBe(0.5);
      expect(eff.alliance).toBe(0.5);
    });

    it('自定义离线效率配置生效', () => {
      const custom = new ActivitySystem(undefined, { season: 0.8 });
      expect(custom.getOfflineEfficiency().season).toBe(0.8);
    });
  });

  // ═══════════════════════════════════════════
  // 9. 序列化/反序列化
  // ═══════════════════════════════════════════
  describe('序列化/反序列化', () => {
    it('serialize 返回正确结构', () => {
      const state = createDefaultActivityState();
      const data = system.serialize(state);
      expect(data.version).toBe(ACTIVITY_SAVE_VERSION);
      expect(data.state).toBeDefined();
      expect(data.state.activities).toEqual({});
    });

    it('serialize/deserialize 往返一致（空状态）', () => {
      const state = createDefaultActivityState();
      const data = system.serialize(state);
      const restored = system.deserialize(data);
      expect(restored.activities).toEqual({});
    });

    it('serialize/deserialize 往返一致（有活动）', () => {
      let state = createStartedState('season_1', ActivityType.SEASON, NOW, createStandardTaskDefs(), createStandardMilestones());
      // 更新一些进度
      state = system.updateTaskProgress(state, 'season_1', 'daily_1', 5);

      const data = system.serialize(state);
      const restored = system.deserialize(data);

      expect(Object.keys(restored.activities)).toHaveLength(1);
      expect(restored.activities['season_1'].tasks.find(t => t.defId === 'daily_1')!.currentProgress).toBe(5);
    });

    it('deserialize 版本不匹配返回默认状态', () => {
      const restored = system.deserialize({ version: 999, state: createDefaultActivityState() });
      expect(restored.activities).toEqual({});
    });

    it('deserialize null/undefined 返回默认状态', () => {
      const restored = system.deserialize(null as any);
      expect(restored.activities).toEqual({});
    });

    it('serialize 保留积分和代币', () => {
      let state = createStartedState('season_1', ActivityType.SEASON, NOW);
      state = {
        ...state,
        activities: {
          ...state.activities,
          season_1: { ...state.activities['season_1'], points: 500, tokens: 50 },
        },
      };

      const data = system.serialize(state);
      const restored = system.deserialize(data);
      expect(restored.activities['season_1'].points).toBe(500);
      expect(restored.activities['season_1'].tokens).toBe(50);
    });

    it('serialize 保留里程碑状态', () => {
      let state = createStartedState('season_1', ActivityType.SEASON, NOW);
      // 手动修改里程碑状态
      const milestones = state.activities['season_1'].milestones.map((m, i) =>
        i === 0 ? { ...m, status: MilestoneStatus.CLAIMED } : m,
      );
      state = {
        ...state,
        activities: {
          ...state.activities,
          season_1: { ...state.activities['season_1'], milestones },
        },
      };

      const data = system.serialize(state);
      const restored = system.deserialize(data);
      expect(restored.activities['season_1'].milestones[0].status).toBe(MilestoneStatus.CLAIMED);
    });
  });
});
