/**
 * ActivityFactory 单元测试
 *
 * 覆盖：
 * 1. createDefaultActivityState — 默认状态结构
 * 2. createActivityInstance — 从定义创建实例
 * 3. createActivityTask — 从任务定义创建任务实例
 * 4. createMilestone — 里程碑创建
 */

import {
  createDefaultActivityState,
  createActivityInstance,
  createActivityTask,
  createMilestone,
} from '../ActivityFactory';

import {
  ActivityStatus,
  ActivityTaskStatus,
  MilestoneStatus,
} from '../../../core/activity/activity.types';

import type {
  ActivityDef,
  ActivityTaskDef,
} from '../../../core/activity/activity.types';

describe('ActivityFactory', () => {
  // ─── createDefaultActivityState ───────────

  describe('createDefaultActivityState', () => {
    it('应返回包含空 activities 的默认状态', () => {
      const state = createDefaultActivityState();
      expect(state.activities).toEqual({});
    });

    it('应包含默认签到状态', () => {
      const state = createDefaultActivityState();
      expect(state.signIn.consecutiveDays).toBe(0);
      expect(state.signIn.todaySigned).toBe(false);
      expect(state.signIn.lastSignInTime).toBe(0);
    });

    it('应包含默认赛季记录', () => {
      const state = createDefaultActivityState();
      expect(state.seasonRecord.seasonId).toBe('');
      expect(state.seasonRecord.wins).toBe(0);
      expect(state.seasonRecord.losses).toBe(0);
      expect(state.seasonRecord.winRate).toBe(0);
      expect(state.seasonRecord.highestRanking).toBe(0);
    });

    it('每次调用应返回独立的对象', () => {
      const s1 = createDefaultActivityState();
      const s2 = createDefaultActivityState();
      expect(s1).not.toBe(s2);
      expect(s1).toEqual(s2);
    });
  });

  // ─── createActivityInstance ───────────────

  describe('createActivityInstance', () => {
    const mockDef: ActivityDef = {
      id: 'act_001',
      type: 'daily',
      name: '日常活动',
      description: '每日刷新',
      startTime: 0,
      endTime: 0,
    };

    it('应从定义创建活动实例', () => {
      const instance = createActivityInstance(mockDef, 1000);
      expect(instance.defId).toBe('act_001');
      expect(instance.status).toBe(ActivityStatus.ACTIVE);
      expect(instance.points).toBe(0);
      expect(instance.tokens).toBe(0);
    });

    it('应使用传入的 now 作为 createdAt', () => {
      const instance = createActivityInstance(mockDef, 99999);
      expect(instance.createdAt).toBe(99999);
    });

    it('应初始化空的任务和里程碑列表', () => {
      const instance = createActivityInstance(mockDef, 0);
      expect(instance.tasks).toEqual([]);
      expect(instance.milestones).toEqual([]);
    });

    it('不同定义应创建不同 defId 的实例', () => {
      const def2: ActivityDef = { ...mockDef, id: 'act_002' };
      const i1 = createActivityInstance(mockDef, 0);
      const i2 = createActivityInstance(def2, 0);
      expect(i1.defId).toBe('act_001');
      expect(i2.defId).toBe('act_002');
    });
  });

  // ─── createActivityTask ───────────────────

  describe('createActivityTask', () => {
    const mockTaskDef: ActivityTaskDef = {
      id: 'task_001',
      taskType: 'daily',
      targetCount: 5,
      tokenReward: 10,
      pointReward: 20,
      resourceReward: { gold: 100 },
    };

    it('应从定义创建任务实例', () => {
      const task = createActivityTask(mockTaskDef);
      expect(task.defId).toBe('task_001');
      expect(task.taskType).toBe('daily');
      expect(task.currentProgress).toBe(0);
      expect(task.targetCount).toBe(5);
    });

    it('初始状态应为 INCOMPLETE', () => {
      const task = createActivityTask(mockTaskDef);
      expect(task.status).toBe(ActivityTaskStatus.INCOMPLETE);
    });

    it('应正确复制奖励信息', () => {
      const task = createActivityTask(mockTaskDef);
      expect(task.tokenReward).toBe(10);
      expect(task.pointReward).toBe(20);
      expect(task.resourceReward).toEqual({ gold: 100 });
    });

    it('resourceReward 应为深拷贝，修改不影响原定义', () => {
      const task = createActivityTask(mockTaskDef);
      task.resourceReward.gold = 999;
      expect(mockTaskDef.resourceReward.gold).toBe(100);
    });
  });

  // ─── createMilestone ──────────────────────

  describe('createMilestone', () => {
    it('应创建指定参数的里程碑', () => {
      const rewards = { gold: 500, grain: 200 };
      const m = createMilestone('ms_001', 100, rewards);
      expect(m.id).toBe('ms_001');
      expect(m.requiredPoints).toBe(100);
      expect(m.rewards).toEqual({ gold: 500, grain: 200 });
    });

    it('默认 isFinal 为 false', () => {
      const m = createMilestone('ms_001', 100, {});
      expect(m.isFinal).toBe(false);
    });

    it('isFinal 可显式设置为 true', () => {
      const m = createMilestone('ms_final', 999, {}, true);
      expect(m.isFinal).toBe(true);
    });

    it('初始状态应为 LOCKED', () => {
      const m = createMilestone('ms_001', 100, {});
      expect(m.status).toBe(MilestoneStatus.LOCKED);
    });

    it('rewards 应为深拷贝', () => {
      const rewards = { gold: 100 };
      const m = createMilestone('ms_001', 50, rewards);
      m.rewards.gold = 999;
      expect(rewards.gold).toBe(100);
    });
  });
});
