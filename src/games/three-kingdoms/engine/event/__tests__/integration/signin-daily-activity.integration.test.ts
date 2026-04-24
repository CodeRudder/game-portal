/**
 * 集成测试 §3.10~§3.13: 签到 + 每日活跃 + 活动排期
 *
 * 覆盖 Play §3.10~§3.13 的签到与活动管理闭环：
 *   §3.10 7天签到循环
 *     - 7天循环奖励（铜钱→加速道具→元宝→铜钱→招募令→装备箱→武将碎片）
 *     - 循环重置（第8天回到第1天）
 *     - 首次签到
 *   §3.11 补签机制
 *     - 消耗元宝50/次
 *     - 每周最多2次
 *     - 元宝不足拒绝
 *     - 新的一周补签次数重置
 *   §3.12 连续签到加成
 *     - 连续3天加成20%
 *     - 连续7天加成50%
 *     - 断签重置连续天数
 *   §3.13 每日任务重置 + 活动并行管理
 *     - 每日任务重置
 *     - 活动并行上限（最多5个）
 *     - 活动到期状态更新
 *     - 活动任务进度与领取
 *     - 里程碑解锁与领取
 *
 * @module engine/event/__tests__/integration
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import {
  SignInSystem,
  createDefaultSignInData,
  DEFAULT_SIGN_IN_REWARDS,
  DEFAULT_SIGN_IN_CONFIG,
  SIGN_IN_CYCLE_DAYS,
} from '../../../activity/SignInSystem';
import { ActivitySystem } from '../../../activity/ActivitySystem';
import {
  createDefaultActivityState,
  createActivityInstance,
  createActivityTask,
  createMilestone,
} from '../../../activity/ActivityFactory';
import type { ISystemDeps } from '../../../../core/types/subsystem';
import type {
  SignInData,
  SignInReward,
  ActivityDef,
  ActivityTaskDef,
  ActivityMilestone,
  ActivityState,
} from '../../../../core/activity/activity.types';
import {
  ActivityType,
  ActivityStatus,
  ActivityTaskStatus,
  ActivityTaskType,
  MilestoneStatus,
} from '../../../../core/activity/activity.types';

// ─────────────────────────────────────────────
// 辅助
// ─────────────────────────────────────────────

function mockDeps(): ISystemDeps {
  return {
    eventBus: {
      on: vi.fn().mockReturnValue(vi.fn()),
      once: vi.fn().mockReturnValue(vi.fn()),
      emit: vi.fn(),
      off: vi.fn(),
      removeAllListeners: vi.fn(),
    },
    config: { get: vi.fn(), set: vi.fn() },
    registry: { register: vi.fn(), get: vi.fn(), getAll: vi.fn(), has: vi.fn(), unregister: vi.fn() },
  } as unknown as ISystemDeps;
}

/** 获取指定天后的时间戳（从基准时间开始） */
function dayMs(days: number): number {
  return Date.now() + days * 24 * 60 * 60 * 1000;
}

/** 创建活动定义 */
function makeActivityDef(overrides?: Partial<ActivityDef>): ActivityDef {
  return {
    id: 'act-test-001',
    name: '测试活动',
    description: '测试活动描述',
    type: ActivityType.LIMITED_TIME,
    startTime: Date.now(),
    endTime: Date.now() + 7 * 24 * 60 * 60 * 1000,
    ...overrides,
  };
}

/** 创建任务定义 */
function makeTaskDef(overrides?: Partial<ActivityTaskDef>): ActivityTaskDef {
  return {
    id: 'task-001',
    name: '完成任务',
    description: '完成一个任务',
    taskType: ActivityTaskType.DAILY,
    targetCount: 3,
    pointReward: 10,
    tokenReward: 5,
    resourceReward: { copper: 100 },
    ...overrides,
  };
}

/** 创建里程碑 */
function makeActivityMilestone(overrides?: Partial<ActivityMilestone>): ActivityMilestone {
  return {
    id: 'milestone-001',
    requiredPoints: 50,
    status: MilestoneStatus.LOCKED,
    rewards: { gold: 20 },
    isFinal: false,
    ...overrides,
  };
}

// ─────────────────────────────────────────────
// 测试
// ─────────────────────────────────────────────

describe('§3.10~§3.13 签到 + 每日活跃 + 活动排期集成', () => {
  let signIn: SignInSystem;
  let activity: ActivitySystem;
  let deps: ISystemDeps;

  beforeEach(() => {
    signIn = new SignInSystem();
    activity = new ActivitySystem();
    deps = mockDeps();
    signIn.init(deps);
    activity.init(deps);
  });

  // ─── §3.10 7天签到循环 ───────────────────

  describe('§3.10 7天签到循环', () => {
    it('第1天签到应获得铜钱×1000', () => {
      const data = createDefaultSignInData();
      const now = Date.now();

      const result = signIn.signIn(data, now);
      expect(result.reward.day).toBe(1);
      expect(result.reward.rewards.copper).toBe(1000);
      expect(result.data.consecutiveDays).toBe(1);
      expect(result.data.todaySigned).toBe(true);
    });

    it('连续7天签到应获得完整循环奖励', () => {
      let data = createDefaultSignInData();
      const rewards: SignInReward[] = [];

      for (let day = 1; day <= 7; day++) {
        const now = dayMs(day - 1);
        const result = signIn.signIn(data, now);
        rewards.push(result.reward);
        data = result.data;
      }

      expect(rewards).toHaveLength(7);
      expect(rewards[0].rewards.copper).toBe(1000); // 第1天
      expect(rewards[2].rewards.gold).toBe(20);     // 第3天
      expect(rewards[6].rewards.heroFragment).toBe(5); // 第7天
      expect(data.consecutiveDays).toBe(7);
    });

    it('第8天签到应回到循环第1天', () => {
      let data = createDefaultSignInData();

      for (let day = 1; day <= 8; day++) {
        const now = dayMs(day - 1);
        const result = signIn.signIn(data, now);
        data = result.data;
      }

      // 第8天 = (8-1) % 7 + 1 = 1
      const cycleDay = signIn.getCycleDay(data.consecutiveDays);
      expect(cycleDay).toBe(1);
    });

    it('第14天签到应回到循环第7天', () => {
      const cycleDay = signIn.getCycleDay(14);
      // (14-1) % 7 + 1 = 7
      expect(cycleDay).toBe(7);
    });

    it('首次签到（lastSignInTime=0）应从第1天开始', () => {
      const data = createDefaultSignInData();
      expect(data.lastSignInTime).toBe(0);

      const result = signIn.signIn(data, Date.now());
      expect(result.data.consecutiveDays).toBe(1);
    });

    it('同一天重复签到应抛出错误', () => {
      const data = createDefaultSignInData();
      const now = Date.now();

      signIn.signIn(data, now);
      expect(() => signIn.signIn({ ...data, todaySigned: true, lastSignInTime: now }, now))
        .toThrow('今日已签到');
    });

    it('getAllRewards 应返回7天奖励列表', () => {
      const rewards = signIn.getAllRewards();
      expect(rewards).toHaveLength(7);
      rewards.forEach((r, i) => {
        expect(r.day).toBe(i + 1);
      });
    });

    it('getCycleDays 应返回7', () => {
      expect(signIn.getCycleDays()).toBe(7);
    });
  });

  // ─── §3.11 补签机制 ─────────────────────

  describe('§3.11 补签机制', () => {
    it('补签成功应消耗50元宝', () => {
      const data: SignInData = {
        ...createDefaultSignInData(),
        consecutiveDays: 3,
        lastSignInTime: dayMs(-2), // 2天前签过
      };

      const result = signIn.retroactive(data, Date.now(), 100);
      expect(result.goldCost).toBe(50);
      expect(result.data.weeklyRetroactiveCount).toBe(1);
      expect(result.data.todaySigned).toBe(true);
    });

    it('补签后连续天数应+1', () => {
      const data: SignInData = {
        ...createDefaultSignInData(),
        consecutiveDays: 3,
        lastSignInTime: dayMs(-2),
      };

      const result = signIn.retroactive(data, Date.now(), 100);
      expect(result.data.consecutiveDays).toBe(4);
    });

    it('元宝不足应拒绝补签', () => {
      const data: SignInData = {
        ...createDefaultSignInData(),
        consecutiveDays: 3,
        lastSignInTime: dayMs(-2),
      };

      expect(() => signIn.retroactive(data, Date.now(), 30))
        .toThrow('元宝不足');
    });

    it('每周最多补签2次', () => {
      const now = Date.now();

      // 第1次补签（todaySigned=false）
      const data1: SignInData = {
        ...createDefaultSignInData(),
        consecutiveDays: 3,
        lastSignInTime: dayMs(-2),
        weeklyRetroactiveCount: 0,
        lastRetroactiveResetWeek: 0,
      };
      const r1 = signIn.retroactive(data1, now, 200);
      expect(r1.data.weeklyRetroactiveCount).toBe(1);

      // 第2次补签（模拟新的一天，todaySigned=false，但补签次数=1）
      const data2: SignInData = {
        ...createDefaultSignInData(),
        consecutiveDays: 4,
        lastSignInTime: dayMs(-1),
        todaySigned: false,
        weeklyRetroactiveCount: 1,
        lastRetroactiveResetWeek: r1.data.lastRetroactiveResetWeek,
      };
      const r2 = signIn.retroactive(data2, now, 200);
      expect(r2.data.weeklyRetroactiveCount).toBe(2);

      // 第3次应失败（补签次数=2）
      const data3: SignInData = {
        ...createDefaultSignInData(),
        consecutiveDays: 5,
        lastSignInTime: dayMs(-1),
        todaySigned: false,
        weeklyRetroactiveCount: 2,
        lastRetroactiveResetWeek: r2.data.lastRetroactiveResetWeek,
      };
      expect(() => signIn.retroactive(data3, now, 200))
        .toThrow('本周补签次数已用完');
    });

    it('新的一周补签次数应重置', () => {
      const data: SignInData = {
        ...createDefaultSignInData(),
        consecutiveDays: 3,
        lastSignInTime: dayMs(-10),
        weeklyRetroactiveCount: 2,
        lastRetroactiveResetWeek: 0, // 旧的一周
      };

      const now = Date.now();
      const result = signIn.retroactive(data, now, 200);
      // 新的一周，次数重置为0后再+1
      expect(result.data.weeklyRetroactiveCount).toBe(1);
    });

    it('今日已签到时补签应拒绝', () => {
      const data: SignInData = {
        ...createDefaultSignInData(),
        consecutiveDays: 3,
        todaySigned: true,
        lastSignInTime: Date.now(),
      };

      expect(() => signIn.retroactive(data, Date.now(), 200))
        .toThrow('今日已签到');
    });

    it('canRetroactive 应正确判断是否可补签', () => {
      const data: SignInData = {
        ...createDefaultSignInData(),
        consecutiveDays: 3,
        todaySigned: false,
        lastSignInTime: dayMs(-2),
        weeklyRetroactiveCount: 0,
        lastRetroactiveResetWeek: 0,
      };

      const result = signIn.canRetroactive(data, Date.now(), 100);
      expect(result.canRetroactive).toBe(true);
    });

    it('canRetroactive 元宝不足时应返回 false', () => {
      const data: SignInData = {
        ...createDefaultSignInData(),
        consecutiveDays: 3,
        todaySigned: false,
        lastSignInTime: dayMs(-2),
        weeklyRetroactiveCount: 0,
        lastRetroactiveResetWeek: 0,
      };

      const result = signIn.canRetroactive(data, Date.now(), 10);
      expect(result.canRetroactive).toBe(false);
      expect(result.reason).toBe('元宝不足');
    });

    it('getRemainingRetroactive 应返回剩余补签次数', () => {
      const data: SignInData = {
        ...createDefaultSignInData(),
        weeklyRetroactiveCount: 1,
        lastRetroactiveResetWeek: 0,
      };

      const remaining = signIn.getRemainingRetroactive(data, Date.now());
      // 新的一周，次数重置
      expect(remaining).toBe(2);
    });
  });

  // ─── §3.12 连续签到加成 ─────────────────

  describe('§3.12 连续签到加成', () => {
    it('连续1~2天无加成（0%）', () => {
      expect(signIn.getConsecutiveBonus(1)).toBe(0);
      expect(signIn.getConsecutiveBonus(2)).toBe(0);
    });

    it('连续3天加成20%', () => {
      expect(signIn.getConsecutiveBonus(3)).toBe(20);
    });

    it('连续4~6天仍为20%加成', () => {
      expect(signIn.getConsecutiveBonus(4)).toBe(20);
      expect(signIn.getConsecutiveBonus(5)).toBe(20);
      expect(signIn.getConsecutiveBonus(6)).toBe(20);
    });

    it('连续7天加成50%', () => {
      expect(signIn.getConsecutiveBonus(7)).toBe(50);
    });

    it('连续超过7天仍为50%加成', () => {
      expect(signIn.getConsecutiveBonus(10)).toBe(50);
      expect(signIn.getConsecutiveBonus(14)).toBe(50);
    });

    it('断签后连续天数应重置为1', () => {
      let data = createDefaultSignInData();

      // 连续签到3天
      for (let day = 1; day <= 3; day++) {
        const result = signIn.signIn(data, dayMs(day - 1));
        data = result.data;
      }
      expect(data.consecutiveDays).toBe(3);

      // 断签1天（跳过1天），然后签到
      const breakNow = dayMs(5); // 第6天（跳过了第4、5天）
      const result = signIn.signIn(data, breakNow);
      expect(result.data.consecutiveDays).toBe(1);
    });

    it('签到时加成应正确应用到奖励', () => {
      let data = createDefaultSignInData();

      // 连续签到3天
      for (let day = 1; day <= 3; day++) {
        const result = signIn.signIn(data, dayMs(day - 1));
        data = result.data;
      }

      // 第3天签到时加成应为20%
      const day3Result = signIn.signIn(
        { ...createDefaultSignInData(), consecutiveDays: 2, lastSignInTime: dayMs(1) },
        dayMs(2),
      );
      expect(day3Result.bonusPercent).toBe(20);
    });

    it('自定义加成配置应生效', () => {
      const customSignIn = new SignInSystem({
        consecutive3Bonus: 30,
        consecutive7Bonus: 80,
      });

      expect(customSignIn.getConsecutiveBonus(3)).toBe(30);
      expect(customSignIn.getConsecutiveBonus(7)).toBe(80);
    });
  });

  // ─── §3.13 每日任务重置 + 活动并行管理 ───

  describe('§3.13 每日任务重置 + 活动并行管理', () => {
    it('每日任务重置应恢复进度为0', () => {
      const state = createDefaultActivityState();
      const def = makeActivityDef();
      const taskDef = makeTaskDef({ taskType: ActivityTaskType.DAILY });
      const milestone = makeActivityMilestone();

      let currentState = activity.startActivity(state, def, [taskDef], [milestone], Date.now());

      // 完成部分进度
      currentState = activity.updateTaskProgress(currentState, def.id, taskDef.id, 2);
      const task = currentState.activities[def.id].tasks[0];
      expect(task.currentProgress).toBe(2);

      // 重置每日任务
      currentState = activity.resetDailyTasks(currentState, def.id, [taskDef]);
      const resetTask = currentState.activities[def.id].tasks[0];
      expect(resetTask.currentProgress).toBe(0);
      expect(resetTask.status).toBe(ActivityTaskStatus.INCOMPLETE);
    });

    it('任务进度达到目标应标记为完成', () => {
      const state = createDefaultActivityState();
      const def = makeActivityDef();
      const taskDef = makeTaskDef({ targetCount: 3 });
      const milestone = makeActivityMilestone();

      let currentState = activity.startActivity(state, def, [taskDef], [milestone], Date.now());

      currentState = activity.updateTaskProgress(currentState, def.id, taskDef.id, 3);
      const task = currentState.activities[def.id].tasks[0];
      expect(task.status).toBe(ActivityTaskStatus.COMPLETED);
    });

    it('任务进度不应超过目标值', () => {
      const state = createDefaultActivityState();
      const def = makeActivityDef();
      const taskDef = makeTaskDef({ targetCount: 3 });
      const milestone = makeActivityMilestone();

      let currentState = activity.startActivity(state, def, [taskDef], [milestone], Date.now());

      currentState = activity.updateTaskProgress(currentState, def.id, taskDef.id, 10);
      const task = currentState.activities[def.id].tasks[0];
      expect(task.currentProgress).toBe(3);
    });

    it('领取任务奖励应增加积分和代币', () => {
      const state = createDefaultActivityState();
      const def = makeActivityDef();
      const taskDef = makeTaskDef({ pointReward: 10, tokenReward: 5 });
      const milestone = makeActivityMilestone();

      let currentState = activity.startActivity(state, def, [taskDef], [milestone], Date.now());
      currentState = activity.updateTaskProgress(currentState, def.id, taskDef.id, 3);

      const result = activity.claimTaskReward(currentState, def.id, taskDef.id);
      expect(result.points).toBe(10);
      expect(result.tokens).toBe(5);
      expect(result.state.activities[def.id].points).toBe(10);
      expect(result.state.activities[def.id].tokens).toBe(5);
    });

    it('重复领取任务奖励应抛出错误', () => {
      const state = createDefaultActivityState();
      const def = makeActivityDef();
      const taskDef = makeTaskDef();
      const milestone = makeActivityMilestone();

      let currentState = activity.startActivity(state, def, [taskDef], [milestone], Date.now());
      currentState = activity.updateTaskProgress(currentState, def.id, taskDef.id, 3);

      const result = activity.claimTaskReward(currentState, def.id, taskDef.id);
      expect(() => activity.claimTaskReward(result.state, def.id, taskDef.id))
        .toThrow('已领取');
    });

    it('未完成任务不能领取奖励', () => {
      const state = createDefaultActivityState();
      const def = makeActivityDef();
      const taskDef = makeTaskDef({ targetCount: 5 });
      const milestone = makeActivityMilestone();

      const currentState = activity.startActivity(state, def, [taskDef], [milestone], Date.now());

      expect(() => activity.claimTaskReward(currentState, def.id, taskDef.id))
        .toThrow('任务未完成');
    });

    it('活动并行上限检查', () => {
      const state = createDefaultActivityState();
      const check = activity.canStartActivity(state, ActivityType.LIMITED_TIME);
      expect(check.canStart).toBe(true);
    });

    it('活动到期后状态应更新为 ENDED', () => {
      const state = createDefaultActivityState();
      const def = makeActivityDef();
      const taskDef = makeTaskDef();
      const milestone = makeActivityMilestone();

      const now = Date.now();
      let currentState = activity.startActivity(state, def, [taskDef], [milestone], now);

      const endTime = now + 7 * 24 * 60 * 60 * 1000;
      currentState = activity.updateActivityStatus(currentState, def.id, endTime + 1, endTime);

      expect(currentState.activities[def.id].status).toBe(ActivityStatus.ENDED);
    });

    it('活动未到期状态不变', () => {
      const state = createDefaultActivityState();
      const def = makeActivityDef();
      const taskDef = makeTaskDef();
      const milestone = makeActivityMilestone();

      const now = Date.now();
      let currentState = activity.startActivity(state, def, [taskDef], [milestone], now);

      const endTime = now + 7 * 24 * 60 * 60 * 1000;
      currentState = activity.updateActivityStatus(currentState, def.id, now + 1000, endTime);

      expect(currentState.activities[def.id].status).toBe(ActivityStatus.ACTIVE);
    });

    it('里程碑积分足够时应自动解锁', () => {
      const state = createDefaultActivityState();
      const def = makeActivityDef();
      const taskDef = makeTaskDef({ pointReward: 100, targetCount: 1 });
      const milestone = makeActivityMilestone({ requiredPoints: 50 });

      let currentState = activity.startActivity(state, def, [taskDef], [milestone], Date.now());
      currentState = activity.updateTaskProgress(currentState, def.id, taskDef.id, 1);

      const claimResult = activity.claimTaskReward(currentState, def.id, taskDef.id);
      currentState = activity.checkMilestones(claimResult.state, def.id);

      expect(currentState.activities[def.id].milestones[0].status).toBe(MilestoneStatus.UNLOCKED);
    });

    it('里程碑积分不足时应保持锁定', () => {
      const state = createDefaultActivityState();
      const def = makeActivityDef();
      const taskDef = makeTaskDef({ pointReward: 10, targetCount: 1 });
      const milestone = makeActivityMilestone({ requiredPoints: 100 });

      let currentState = activity.startActivity(state, def, [taskDef], [milestone], Date.now());
      currentState = activity.updateTaskProgress(currentState, def.id, taskDef.id, 1);

      const claimResult = activity.claimTaskReward(currentState, def.id, taskDef.id);
      currentState = activity.checkMilestones(claimResult.state, def.id);

      expect(currentState.activities[def.id].milestones[0].status).toBe(MilestoneStatus.LOCKED);
    });

    it('领取里程碑奖励应返回奖励内容', () => {
      const state = createDefaultActivityState();
      const def = makeActivityDef();
      const taskDef = makeTaskDef({ pointReward: 100, targetCount: 1 });
      const milestone = makeActivityMilestone({ requiredPoints: 50, rewards: { gold: 20 } });

      let currentState = activity.startActivity(state, def, [taskDef], [milestone], Date.now());
      currentState = activity.updateTaskProgress(currentState, def.id, taskDef.id, 1);

      const claimResult = activity.claimTaskReward(currentState, def.id, taskDef.id);
      currentState = activity.checkMilestones(claimResult.state, def.id);

      const milestoneResult = activity.claimMilestone(currentState, def.id, milestone.id);
      expect(milestoneResult.rewards.gold).toBe(20);
    });

    it('重复领取里程碑奖励应抛出错误', () => {
      const state = createDefaultActivityState();
      const def = makeActivityDef();
      const taskDef = makeTaskDef({ pointReward: 100, targetCount: 1 });
      const milestone = makeActivityMilestone({ requiredPoints: 50 });

      let currentState = activity.startActivity(state, def, [taskDef], [milestone], Date.now());
      currentState = activity.updateTaskProgress(currentState, def.id, taskDef.id, 1);

      const claimResult = activity.claimTaskReward(currentState, def.id, taskDef.id);
      currentState = activity.checkMilestones(claimResult.state, def.id);

      activity.claimMilestone(currentState, def.id, milestone.id);
      // 领取后状态变为 CLAIMED
      const claimedState = {
        ...currentState,
        activities: {
          ...currentState.activities,
          [def.id]: {
            ...currentState.activities[def.id],
            milestones: [{ ...milestone, status: MilestoneStatus.CLAIMED }],
          },
        },
      };

      expect(() => activity.claimMilestone(claimedState, def.id, milestone.id))
        .toThrow('已领取');
    });

    it('getActiveActivities 应返回所有活跃活动', () => {
      const state = createDefaultActivityState();
      const def1 = makeActivityDef({ id: 'act-1' });
      const def2 = makeActivityDef({ id: 'act-2', type: ActivityType.DAILY });

      let currentState = activity.startActivity(state, def1, [makeTaskDef()], [makeActivityMilestone()], Date.now());
      currentState = activity.startActivity(currentState, def2, [makeTaskDef()], [makeActivityMilestone()], Date.now());

      const active = activity.getActiveActivities(currentState);
      expect(active).toHaveLength(2);
    });

    it('活动序列化与反序列化应保持数据一致', () => {
      const state = createDefaultActivityState();
      const def = makeActivityDef();
      const taskDef = makeTaskDef();
      const milestone = makeActivityMilestone();

      const currentState = activity.startActivity(state, def, [taskDef], [milestone], Date.now());

      const saved = activity.serialize(currentState);
      expect(saved.version).toBeDefined();

      const restored = activity.deserialize(saved);
      expect(Object.keys(restored.activities)).toHaveLength(1);
      expect(restored.activities[def.id]).toBeDefined();
    });

    it('无效版本的存档应返回默认状态', () => {
      const restored = activity.deserialize({ version: 999, state: createDefaultActivityState() });
      expect(restored.activities).toEqual({});
    });

    it('签到系统 reset 应恢复默认配置', () => {
      const customSignIn = new SignInSystem({ retroactiveCostGold: 100 });
      customSignIn.reset();
      expect(customSignIn.getConfig().retroactiveCostGold).toBe(50);
    });

    it('活动系统 reset 应恢复默认配置', () => {
      const customActivity = new ActivitySystem({ maxTotal: 10 });
      customActivity.reset();
      expect(customActivity.getConcurrencyConfig().maxTotal).toBe(5);
    });
  });
});
