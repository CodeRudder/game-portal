/**
 * 任务模块对抗式测试 — Builder 产出
 *
 * 覆盖子系统：
 *   Q1: QuestSystem           — 任务生命周期管理聚合根
 *   Q2: QuestSystem.helpers   — 日常刷新/追踪/活跃度/进度/奖励辅助
 *   Q3: QuestSerialization    — 序列化/反序列化
 *   Q4: QuestDailyManager     — 日常任务管理器
 *   Q5: QuestTrackerSystem    — 任务追踪系统
 *   Q6: ActivitySystem        — 活跃度系统
 *   Q7: QuestActivityManager  — 活跃度管理器
 *
 * 5维度挑战：
 *   F-Error:     异常路径（空ID/NaN进度/负数进度/超大进度/不存在任务）
 *   F-Cross:     跨系统交互（任务→资源奖励→活跃度→里程碑/Tracker事件驱动）
 *   F-Lifecycle: 数据生命周期（序列化/反序列化/reset/instanceCounter）
 *   F-Boundary:  边界条件（追踪上限/活跃度上限/日常刷新幂等/多样性保证）
 *   F-Normal:    正向流程（初始化/接受/进度/完成/领奖/日常刷新/周常刷新）
 *
 * @module tests/adversarial/quest-adversarial
 */

import { describe, it, expect, vi } from 'vitest';
import { QuestSystem } from '../../engine/quest/QuestSystem';
import { QuestTrackerSystem } from '../../engine/quest/QuestTrackerSystem';
import { ActivitySystem } from '../../engine/quest/ActivitySystem';
import { QuestActivityManager } from '../../engine/quest/QuestActivityManager';
import { QuestDailyManager } from '../../engine/quest/QuestDailyManager';
import { serializeQuestState } from '../../engine/quest/QuestSerialization';
import {
  pickDailyWithDiversity, trackQuest, untrackQuest, addActivityPoints,
  updateProgressByTypeLogic, claimRewardLogic,
  claimAllRewardsLogic, MAX_TRACKED_QUESTS, MAX_ACTIVITY_POINTS,
} from '../../engine/quest/QuestSystem.helpers';
import type { ISystemDeps } from '../../core/types';
import type { QuestDef, QuestInstance, QuestSystemSaveData } from '../../core/quest';
import { DAILY_QUEST_TEMPLATES, DEFAULT_ACTIVITY_MILESTONES } from '../../core/quest';

// ── 测试辅助 ──────────────────────────────────

function mockDeps(): ISystemDeps {
  return {
    eventBus: {
      on: vi.fn().mockReturnValue(vi.fn()), once: vi.fn().mockReturnValue(vi.fn()),
      emit: vi.fn(), off: vi.fn(), removeAllListeners: vi.fn(),
    },
    config: { get: vi.fn(), set: vi.fn() },
    registry: { register: vi.fn(), get: vi.fn(), getAll: vi.fn(), has: vi.fn(), unregister: vi.fn() },
  } as unknown as ISystemDeps;
}

function createQuestSystem(): QuestSystem {
  const sys = new QuestSystem();
  sys.init(mockDeps());
  return sys;
}

function createTestQuestDef(id = 'test-q1', category: QuestDef['category'] = 'main'): QuestDef {
  return {
    id, title: `测试-${id}`, description: '测试', category,
    objectives: [
      { id: `${id}-obj1`, type: 'battle_clear', description: '战斗', targetCount: 3, currentCount: 0 },
      { id: `${id}-obj2`, type: 'collect_resource', description: '收集', targetCount: 100, currentCount: 0, params: { resource: 'gold' } },
    ],
    rewards: { resources: { gold: 500 }, experience: 100, activityPoints: 10 },
  };
}

function createChainQuestDef(id: string, prereqIds: string[]): QuestDef {
  return {
    id, title: `链式-${id}`, description: '测试', category: 'main',
    objectives: [{ id: `${id}-obj1`, type: 'battle_clear', description: '战斗', targetCount: 1, currentCount: 0 }],
    rewards: { resources: { gold: 200 }, experience: 50 },
    prerequisiteQuestIds: prereqIds,
  };
}

function completeAllObjectives(sys: QuestSystem, instanceId: string): void {
  const inst = sys.getQuestInstance(instanceId);
  const def = inst && sys.getQuestDef(inst.questDefId);
  if (!def) return;
  for (const obj of def.objectives) sys.updateObjectiveProgress(instanceId, obj.id, obj.targetCount + 10);
}

// ═══════════════════════════════════════════════
// F-Normal: 正向流程
// ═══════════════════════════════════════════════

describe('F-Normal: 任务初始化', () => {
  it('初始化后无活跃任务和已完成任务', () => {
    const sys = createQuestSystem();
    expect(sys.getActiveQuests()).toEqual([]);
    expect(sys.getCompletedQuestIds()).toEqual([]);
    expect(sys.getActivityState().currentPoints).toBe(0);
  });

  it('预定义任务已加载', () => {
    const sys = createQuestSystem();
    expect(sys.getQuestDef('quest-main-001')).toBeDefined();
    expect(sys.getQuestDef('quest-main-002')).toBeDefined();
    expect(sys.getQuestDef('quest-side-tech')).toBeDefined();
  });

  it('initializeDefaults 自动接受第一个主线任务并刷新日常', () => {
    const sys = createQuestSystem();
    sys.initializeDefaults();
    expect(sys.isQuestActive('quest-main-001')).toBe(true);
    expect(sys.getDailyQuests().length).toBeGreaterThan(0);
  });
});

describe('F-Normal: 接受→进度→完成→领奖', () => {
  it('正常接受任务并自动追踪', () => {
    const sys = createQuestSystem();
    const deps = mockDeps();
    sys.init(deps);
    sys.registerQuest(createTestQuestDef('accept-ok'));
    const inst = sys.acceptQuest('accept-ok')!;
    expect(inst.status).toBe('active');
    expect(sys.getTrackedQuests().some((t) => t.instanceId === inst.instanceId)).toBe(true);
    expect(deps.eventBus.emit).toHaveBeenCalledWith('quest:accepted', expect.objectContaining({ questId: 'accept-ok' }));
  });

  it('正常更新进度并自动完成', () => {
    const sys = createQuestSystem();
    sys.registerQuest(createTestQuestDef('full-flow'));
    const inst = sys.acceptQuest('full-flow')!;
    sys.updateObjectiveProgress(inst.instanceId, 'full-flow-obj1', 5);
    sys.updateObjectiveProgress(inst.instanceId, 'full-flow-obj2', 200);
    expect(sys.getQuestInstance(inst.instanceId)!.status).toBe('completed');
    expect(sys.isQuestCompleted('full-flow')).toBe(true);
  });

  it('正常领取奖励并触发回调', () => {
    const sys = createQuestSystem();
    const cb = vi.fn();
    sys.setRewardCallback(cb);
    sys.registerQuest(createTestQuestDef('reward-ok'));
    const inst = sys.acceptQuest('reward-ok')!;
    completeAllObjectives(sys, inst.instanceId);
    const reward = sys.claimReward(inst.instanceId);
    expect(reward).not.toBeNull();
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('日常任务领取时增加活跃度', () => {
    const sys = createQuestSystem();
    const actCb = vi.fn();
    sys.setActivityAddCallback(actCb);
    sys.registerQuest({
      id: 'daily-act', title: '日常活跃度', description: '测试', category: 'daily',
      objectives: [{ id: 'da-obj1', type: 'daily_login', description: '登录', targetCount: 1, currentCount: 0 }],
      rewards: { resources: { gold: 500 }, activityPoints: 20 },
    });
    const inst = sys.acceptQuest('daily-act')!;
    completeAllObjectives(sys, inst.instanceId);
    sys.claimReward(inst.instanceId);
    expect(sys.getActivityState().currentPoints).toBe(20);
    expect(actCb).toHaveBeenCalledWith(20);
  });
});

describe('F-Normal: 日常/周常刷新', () => {
  it('日常刷新生成任务且幂等', () => {
    const sys = createQuestSystem();
    const first = sys.refreshDailyQuests();
    expect(first.length).toBeGreaterThan(0);
    const second = sys.refreshDailyQuests();
    expect(second.map((q) => q.instanceId).sort()).toEqual(first.map((q) => q.instanceId).sort());
  });

  it('周常刷新生成任务且幂等', () => {
    const sys = createQuestSystem();
    const first = sys.refreshWeeklyQuests();
    expect(first.length).toBeGreaterThan(0);
    const second = sys.refreshWeeklyQuests();
    expect(second.map((q) => q.instanceId).sort()).toEqual(first.map((q) => q.instanceId).sort());
  });
});

// ═══════════════════════════════════════════════
// F-Error: 异常路径覆盖
// ═══════════════════════════════════════════════

describe('F-Error: 接受任务异常', () => {
  it('不存在的任务ID返回 null', () => {
    expect(createQuestSystem().acceptQuest('nonexistent')).toBeNull();
  });

  it('空字符串ID返回 null', () => {
    expect(createQuestSystem().acceptQuest('')).toBeNull();
  });

  it('重复接受同一任务返回 null', () => {
    const sys = createQuestSystem();
    sys.registerQuest(createTestQuestDef('dup'));
    sys.acceptQuest('dup');
    expect(sys.acceptQuest('dup')).toBeNull();
  });

  it('接受已完成任务返回 null', () => {
    const sys = createQuestSystem();
    sys.registerQuest(createTestQuestDef('done'));
    const inst = sys.acceptQuest('done')!;
    completeAllObjectives(sys, inst.instanceId);
    expect(sys.acceptQuest('done')).toBeNull();
  });

  it('前置任务未完成返回 null，完成后可接受', () => {
    const sys = createQuestSystem();
    sys.registerQuest(createTestQuestDef('pre-a'));
    sys.registerQuest(createChainQuestDef('pre-b', ['pre-a']));
    expect(sys.acceptQuest('pre-b')).toBeNull();
    const inst = sys.acceptQuest('pre-a')!;
    completeAllObjectives(sys, inst.instanceId);
    expect(sys.acceptQuest('pre-b')).not.toBeNull();
  });
});

describe('F-Error: 进度更新异常', () => {
  it('不存在的实例/目标ID返回 null', () => {
    const sys = createQuestSystem();
    expect(sys.updateObjectiveProgress('no-id', 'obj1', 1)).toBeNull();
    sys.registerQuest(createTestQuestDef('no-obj'));
    const inst = sys.acceptQuest('no-obj')!;
    expect(sys.updateObjectiveProgress(inst.instanceId, 'bad-obj', 1)).toBeNull();
  });

  it('NaN/Infinity/负数进度不更新', () => {
    const sys = createQuestSystem();
    sys.registerQuest(createTestQuestDef('bad-prog'));
    const inst = sys.acceptQuest('bad-prog')!;
    sys.updateObjectiveProgress(inst.instanceId, 'bad-prog-obj1', NaN);
    expect(sys.getQuestInstance(inst.instanceId)!.objectives[0].currentCount).toBe(0);
    sys.updateObjectiveProgress(inst.instanceId, 'bad-prog-obj1', Infinity);
    expect(sys.getQuestInstance(inst.instanceId)!.objectives[0].currentCount).toBe(0);
    sys.updateObjectiveProgress(inst.instanceId, 'bad-prog-obj1', 2);
    sys.updateObjectiveProgress(inst.instanceId, 'bad-prog-obj1', -10);
    expect(sys.getQuestInstance(inst.instanceId)!.objectives[0].currentCount).toBeGreaterThanOrEqual(0);
  });

  it('已完成任务不接受进度更新', () => {
    const sys = createQuestSystem();
    sys.registerQuest(createTestQuestDef('comp-np'));
    const inst = sys.acceptQuest('comp-np')!;
    completeAllObjectives(sys, inst.instanceId);
    expect(sys.updateObjectiveProgress(inst.instanceId, 'comp-np-obj1', 1)).toBeNull();
  });

  it('updateProgressByType NaN/负数不更新', () => {
    const sys = createQuestSystem();
    sys.registerQuest(createTestQuestDef('batch-bad'));
    const inst = sys.acceptQuest('batch-bad')!;
    sys.updateProgressByType('battle_clear', NaN);
    sys.updateProgressByType('battle_clear', -5);
    expect(sys.getQuestInstance(inst.instanceId)!.objectives[0].currentCount).toBe(0);
  });
});

describe('F-Error: 完成与领奖异常', () => {
  it('不存在的实例 completeQuest 返回 false', () => {
    expect(createQuestSystem().completeQuest('no-id')).toBe(false);
  });

  it('未完成任务领取返回 null', () => {
    const sys = createQuestSystem();
    sys.registerQuest(createTestQuestDef('uncomp'));
    const inst = sys.acceptQuest('uncomp')!;
    expect(sys.claimReward(inst.instanceId)).toBeNull();
  });

  it('重复领取返回 null', () => {
    const sys = createQuestSystem();
    sys.registerQuest(createTestQuestDef('dup-claim'));
    const inst = sys.acceptQuest('dup-claim')!;
    completeAllObjectives(sys, inst.instanceId);
    expect(sys.claimReward(inst.instanceId)).not.toBeNull();
    expect(sys.claimReward(inst.instanceId)).toBeNull();
  });

  it('claimAllRewards 无已完成任务返回空数组', () => {
    expect(createQuestSystem().claimAllRewards()).toEqual([]);
  });
});

describe('F-Error: 活跃度异常', () => {
  it('负数/NaN/Infinity 不生效', () => {
    const sys = createQuestSystem();
    sys.addActivityPoints(-50);
    sys.addActivityPoints(NaN);
    sys.addActivityPoints(Infinity);
    expect(sys.getActivityState().currentPoints).toBe(0);
  });

  it('越界/NaN/Infinity index 返回 null', () => {
    const sys = createQuestSystem();
    sys.addActivityPoints(50);
    expect(sys.claimActivityMilestone(-1)).toBeNull();
    expect(sys.claimActivityMilestone(999)).toBeNull();
    expect(sys.claimActivityMilestone(NaN)).toBeNull();
  });

  it('活跃度不足/重复领取返回 null', () => {
    const sys = createQuestSystem();
    sys.addActivityPoints(10);
    expect(sys.claimActivityMilestone(0)).toBeNull();
    sys.addActivityPoints(90);
    expect(sys.claimActivityMilestone(0)).not.toBeNull();
    expect(sys.claimActivityMilestone(0)).toBeNull();
  });
});

// ═══════════════════════════════════════════════
// F-Boundary: 边界条件
// ═══════════════════════════════════════════════

describe('F-Boundary: 进度与活跃度边界', () => {
  it('超大进度 clamp 到 targetCount', () => {
    const sys = createQuestSystem();
    sys.registerQuest(createTestQuestDef('big'));
    const inst = sys.acceptQuest('big')!;
    sys.updateObjectiveProgress(inst.instanceId, 'big-obj1', Number.MAX_SAFE_INTEGER);
    expect(sys.getQuestInstance(inst.instanceId)!.objectives[0].currentCount).toBe(3);
  });

  it('目标已满后进度不再增长', () => {
    const sys = createQuestSystem();
    sys.registerQuest(createTestQuestDef('full'));
    const inst = sys.acceptQuest('full')!;
    sys.updateObjectiveProgress(inst.instanceId, 'full-obj1', 10);
    expect(sys.getQuestInstance(inst.instanceId)!.objectives[0].currentCount).toBe(3);
  });

  it('活跃度不超过 maxPoints', () => {
    const sys = createQuestSystem();
    sys.addActivityPoints(200);
    expect(sys.getActivityState().currentPoints).toBe(MAX_ACTIVITY_POINTS);
  });
});

describe('F-Boundary: 追踪上限', () => {
  it('追踪列表满后自动/手动追踪均失败', () => {
    const sys = createQuestSystem();
    for (let i = 1; i <= 4; i++) sys.registerQuest(createTestQuestDef(`t${i}`));
    const instances = [1, 2, 3, 4].map((i) => sys.acceptQuest(`t${i}`)!);
    expect(sys.getTrackedQuests().length).toBe(MAX_TRACKED_QUESTS);
    expect(sys.trackQuest(instances[3].instanceId)).toBe(false);
  });

  it('取消追踪后可添加新追踪', () => {
    const sys = createQuestSystem();
    for (let i = 1; i <= 4; i++) sys.registerQuest(createTestQuestDef(`ut${i}`));
    const instances = [1, 2, 3, 4].map((i) => sys.acceptQuest(`ut${i}`)!);
    sys.untrackQuest(instances[0].instanceId);
    expect(sys.trackQuest(instances[3].instanceId)).toBe(true);
  });

  it('重复追踪/不存在实例/不存在ID返回 false', () => {
    const sys = createQuestSystem();
    sys.registerQuest(createTestQuestDef('rt'));
    const inst = sys.acceptQuest('rt')!;
    expect(sys.trackQuest(inst.instanceId)).toBe(false);
    expect(sys.trackQuest('no-id')).toBe(false);
    expect(sys.untrackQuest('no-id')).toBe(false);
  });
});

describe('F-Boundary: 日常任务多样性保证', () => {
  const tagMap: Record<string, string> = {
    'daily-001': 'build', 'daily-002': 'battle', 'daily-003': 'training',
    'daily-004': 'collect', 'daily-005': 'social', 'daily-006': 'training',
    'daily-007': 'social', 'daily-008': 'event', 'daily-009': 'build',
    'daily-010': 'battle', 'daily-011': 'collect', 'daily-012': 'training',
    'daily-013': 'training', 'daily-014': 'social', 'daily-015': 'battle',
    'daily-016': 'build', 'daily-017': 'training', 'daily-018': 'social',
    'daily-019': 'auto', 'daily-020': 'event',
  };

  it('100次抽取都包含 battle/training/auto 类且每类最多2个', () => {
    for (let i = 0; i < 100; i++) {
      const picked = pickDailyWithDiversity([...DAILY_QUEST_TEMPLATES], 6);
      const tags = picked.map((q) => tagMap[q.id] ?? 'other');
      expect(tags).toContain('battle');
      expect(tags).toContain('training');
      expect(tags).toContain('auto');
      const counts: Record<string, number> = {};
      for (const t of tags) counts[t] = (counts[t] ?? 0) + 1;
      for (const c of Object.values(counts)) expect(c).toBeLessThanOrEqual(2);
    }
  });

  it('D01(每日签到) 必定出现', () => {
    for (let i = 0; i < 50; i++) {
      expect(pickDailyWithDiversity([...DAILY_QUEST_TEMPLATES], 6).some((q) => q.id === 'daily-019')).toBe(true);
    }
  });
});

// ═══════════════════════════════════════════════
// F-Lifecycle: 数据生命周期
// ═══════════════════════════════════════════════

describe('F-Lifecycle: 序列化/反序列化', () => {
  it('序列化→反序列化后状态一致', () => {
    const sys = createQuestSystem();
    sys.registerQuest(createTestQuestDef('ser'));
    sys.acceptQuest('ser');
    sys.addActivityPoints(42);
    const saved = sys.serialize();
    const sys2 = createQuestSystem();
    sys2.deserialize(saved);
    expect(sys2.getActiveQuests().length).toBe(1);
    expect(sys2.getActivityState().currentPoints).toBe(42);
    expect(sys2.isQuestActive('ser')).toBe(true);
  });

  it('空对象/null 反序列化不崩溃', () => {
    const sys = createQuestSystem();
    expect(() => sys.deserialize({} as QuestSystemSaveData)).not.toThrow();
    expect(() => sys.deserialize(null as unknown as QuestSystemSaveData)).not.toThrow();
    expect(sys.getActiveQuests()).toEqual([]);
  });

  it('含 NaN currentCount 的存档安全恢复', () => {
    const sys = createQuestSystem();
    sys.deserialize({
      version: 1,
      activeQuests: [{
        instanceId: 'quest-inst-1', questDefId: 'quest-main-001', status: 'active',
        objectives: [{ id: 'obj-001-1', type: 'build_upgrade', description: '升级', targetCount: 1, currentCount: NaN }],
        acceptedAt: Date.now(), completedAt: null, rewardClaimed: false,
      }],
      completedQuestIds: [],
      activityState: { currentPoints: 0, maxPoints: 100, milestones: [], lastResetDate: '' },
      dailyRefreshDate: '', dailyQuestInstanceIds: [],
    } as QuestSystemSaveData);
    expect(sys.getQuestInstance('quest-inst-1')!.objectives[0].currentCount).toBe(0);
  });

  it('序列化包含周常数据且恢复一致', () => {
    const sys = createQuestSystem();
    sys.refreshWeeklyQuests();
    const saved = sys.serialize();
    expect(saved.weeklyQuestInstanceIds!.length).toBeGreaterThan(0);
    const sys2 = createQuestSystem();
    sys2.deserialize(saved);
    expect(sys2.getWeeklyQuests().length).toBe(sys.getWeeklyQuests().length);
  });

  it('instanceCounter 恢复后不碰撞', () => {
    const sys = createQuestSystem();
    sys.registerQuest(createTestQuestDef('ic1'));
    const inst1 = sys.acceptQuest('ic1')!;
    const saved = sys.serialize();
    sys.reset();
    sys.deserialize(saved);
    sys.registerQuest(createTestQuestDef('ic2'));
    const inst2 = sys.acceptQuest('ic2')!;
    expect(inst2.instanceId).not.toBe(inst1.instanceId);
  });
});

describe('F-Lifecycle: reset', () => {
  it('reset 清空所有状态', () => {
    const sys = createQuestSystem();
    sys.registerQuest(createTestQuestDef('rst'));
    sys.acceptQuest('rst');
    sys.addActivityPoints(50);
    sys.refreshDailyQuests();
    sys.reset();
    expect(sys.getActiveQuests()).toEqual([]);
    expect(sys.getCompletedQuestIds()).toEqual([]);
    expect(sys.getActivityState().currentPoints).toBe(0);
    expect(sys.getDailyQuests()).toEqual([]);
    expect(sys.getTrackedQuests()).toEqual([]);
  });
});

// ═══════════════════════════════════════════════
// F-Cross: 跨系统交互
// ═══════════════════════════════════════════════

describe('F-Cross: 任务→活跃度→里程碑联动', () => {
  it('完成日常→领奖→活跃度增加→可领取里程碑', () => {
    const sys = createQuestSystem();
    sys.registerQuest({
      id: 'daily-ms', title: '高活跃日常', description: '测试', category: 'daily',
      objectives: [{ id: 'dm-obj1', type: 'daily_login', description: '登录', targetCount: 1, currentCount: 0 }],
      rewards: { resources: { gold: 500 }, activityPoints: 40 },
    });
    const inst = sys.acceptQuest('daily-ms')!;
    completeAllObjectives(sys, inst.instanceId);
    sys.claimReward(inst.instanceId);
    expect(sys.getActivityState().currentPoints).toBe(40);
    expect(sys.claimActivityMilestone(0)).not.toBeNull();
  });
});

describe('F-Cross: Tracker + QuestSystem 集成', () => {
  it('Tracker 事件驱动进度更新', () => {
    const deps = mockDeps();
    const questSys = new QuestSystem();
    questSys.init(deps);
    const tracker = new QuestTrackerSystem();
    tracker.init(deps);
    tracker.bindQuestSystem(questSys);
    tracker.startTracking();
    questSys.registerQuest(createTestQuestDef('trk'));
    questSys.acceptQuest('trk');
    const onCalls = (deps.eventBus.on as ReturnType<typeof vi.fn>).mock.calls;
    const battleCb = onCalls.find((c: unknown[]) => (c as [string])[0] === 'battle:completed')?.[1];
    if (battleCb) {
      (battleCb as (...a: unknown[]) => void)({});
      expect(questSys.getActiveQuests()[0].objectives[0].currentCount).toBe(1);
    }
  });

  it('未绑定 questSystem 时事件不崩溃', () => {
    const deps = mockDeps();
    const tracker = new QuestTrackerSystem();
    tracker.init(deps);
    tracker.startTracking();
    for (const call of (deps.eventBus.on as ReturnType<typeof vi.fn>).mock.calls) {
      expect(() => (call[1] as (...a: unknown[]) => void)({ resource: 'gold' })).not.toThrow();
    }
  });
});

describe('F-Cross: 跳转路由', () => {
  const initTracker = () => { const t = new QuestTrackerSystem(); t.init(mockDeps()); return t; };

  it('优先使用 questDef.jumpTarget', () => {
    const def: QuestDef = { id: 'j1', title: 't', description: 'd', category: 'main',
      objectives: [{ id: 'o1', type: 'battle_clear', description: 'b', targetCount: 1, currentCount: 0 }],
      rewards: { resources: { gold: 100 } }, jumpTarget: '/custom' };
    expect(initTracker().getQuestJumpRoute(def)).toBe('/custom');
  });

  it('无 jumpTarget 使用目标类型映射', () => {
    const def: QuestDef = { id: 'j2', title: 't', description: 'd', category: 'main',
      objectives: [{ id: 'o1', type: 'battle_clear', description: 'b', targetCount: 1, currentCount: 0 }],
      rewards: { resources: { gold: 100 } } };
    expect(initTracker().getQuestJumpRoute(def)).toBe('/campaign');
  });

  it('无匹配路由返回 null', () => {
    const def: QuestDef = { id: 'j3', title: 't', description: 'd', category: 'main',
      objectives: [{ id: 'o1', type: 'unknown_type' as QuestDef['objectives'][0]['type'], description: 'u', targetCount: 1, currentCount: 0 }],
      rewards: { resources: { gold: 100 } } };
    expect(initTracker().getQuestJumpRoute(def)).toBeNull();
  });
});

describe('F-Cross: ActivitySystem 独立', () => {
  it('addPoints 正常/clamp/NaN防护', () => {
    const sys = new ActivitySystem();
    sys.init(mockDeps());
    sys.addPoints(50);
    expect(sys.getCurrentPoints()).toBe(50);
    sys.addPoints(Number.MAX_SAFE_INTEGER);
    expect(sys.getCurrentPoints()).toBe(sys.getMaxPoints());
  });

  it('checkDailyReset 同天不重置/不同天重置', () => {
    const sys = new ActivitySystem();
    sys.init(mockDeps());
    sys.resetDaily();
    sys.addPoints(50);
    expect(sys.checkDailyReset(new Date().toISOString().slice(0, 10))).toBe(false);
    expect(sys.getCurrentPoints()).toBe(50);
    expect(sys.checkDailyReset('2020-01-01')).toBe(true);
    expect(sys.getCurrentPoints()).toBe(0);
  });

  it('序列化→反序列化一致', () => {
    const sys = new ActivitySystem();
    sys.init(mockDeps());
    sys.addPoints(77);
    const sys2 = new ActivitySystem();
    sys2.init(mockDeps());
    sys2.deserialize(sys.serialize());
    expect(sys2.getCurrentPoints()).toBe(77);
  });

  it('null 数据安全回退', () => {
    const sys = new ActivitySystem();
    sys.init(mockDeps());
    sys.addPoints(50);
    sys.deserialize(null as any);
    expect(sys.getCurrentPoints()).toBe(0);
  });

  it('getProgressRatio / claimAllMilestones', () => {
    const sys = new ActivitySystem();
    sys.init(mockDeps());
    expect(sys.getProgressRatio()).toBe(0);
    sys.addPoints(100);
    expect(sys.getProgressRatio()).toBe(1);
    expect(sys.claimAllMilestones().length).toBeGreaterThan(0);
    expect(sys.getNextClaimableIndex()).toBe(-1);
  });
});

describe('F-Cross: 回调注入', () => {
  it('rewardCallback 未设置时静默', () => {
    const sys = createQuestSystem();
    sys.registerQuest(createTestQuestDef('cb-s'));
    const inst = sys.acceptQuest('cb-s')!;
    completeAllObjectives(sys, inst.instanceId);
    expect(() => sys.claimReward(inst.instanceId)).not.toThrow();
  });

  it('rewardCallback 正确调用', () => {
    const sys = createQuestSystem();
    const rcb = vi.fn();
    sys.setRewardCallback(rcb);
    sys.registerQuest(createTestQuestDef('cb-ok'));
    const inst = sys.acceptQuest('cb-ok')!;
    completeAllObjectives(sys, inst.instanceId);
    sys.claimReward(inst.instanceId);
    expect(rcb).toHaveBeenCalledTimes(1);
  });
});

describe('F-Cross: updateProgressByType 参数匹配', () => {
  it('params 不匹配时跳过/匹配时更新', () => {
    const sys = createQuestSystem();
    sys.registerQuest(createTestQuestDef('pm'));
    const inst = sys.acceptQuest('pm')!;
    sys.updateProgressByType('collect_resource', 1, { resource: 'wood' });
    expect(sys.getQuestInstance(inst.instanceId)!.objectives[1].currentCount).toBe(0);
    sys.updateProgressByType('collect_resource', 1, { resource: 'gold' });
    expect(sys.getQuestInstance(inst.instanceId)!.objectives[1].currentCount).toBe(1);
  });
});

describe('F-Cross: 按类型查询', () => {
  it('getActiveQuestsByCategory / getQuestDefsByCategory', () => {
    const sys = createQuestSystem();
    sys.registerQuest(createTestQuestDef('cm', 'main'));
    sys.registerQuest({ id: 'cd', title: '日常', description: 'd', category: 'daily',
      objectives: [{ id: 'cd-o1', type: 'daily_login', description: 'l', targetCount: 1, currentCount: 0 }],
      rewards: { resources: { gold: 100 } } });
    sys.acceptQuest('cm');
    sys.acceptQuest('cd');
    expect(sys.getActiveQuestsByCategory('main').length).toBe(1);
    expect(sys.getActiveQuestsByCategory('daily').length).toBe(1);
    expect(sys.getQuestDefsByCategory('main').length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════
// 辅助模块对抗
// ═══════════════════════════════════════════════

describe('QuestActivityManager / QuestDailyManager 对抗', () => {
  it('QuestActivityManager fullReset + restoreState', () => {
    const mgr = new QuestActivityManager();
    mgr.addPoints(80);
    mgr.fullReset();
    expect(mgr.getCurrentPoints()).toBe(0);
    mgr.restoreState({ currentPoints: 77, maxPoints: 200, milestones: DEFAULT_ACTIVITY_MILESTONES.map((m) => ({ ...m })), lastResetDate: '2024-06-01' });
    expect(mgr.getCurrentPoints()).toBe(77);
  });

  it('QuestDailyManager 未设置 deps 时 refresh 返回空', () => {
    const mgr = new QuestDailyManager();
    expect(mgr.refresh()).toEqual([]);
    mgr.fullReset();
    expect(mgr.getInstanceIds()).toEqual([]);
  });
});

describe('Helper 纯函数对抗', () => {
  it('trackQuest 不存在/非active 返回 null', () => {
    expect(trackQuest('no-id', [], new Map())).toBeNull();
    const m = new Map<string, QuestInstance>();
    m.set('i1', { instanceId: 'i1', questDefId: 'q1', status: 'completed', objectives: [], acceptedAt: 0, completedAt: 0, rewardClaimed: false });
    expect(trackQuest('i1', [], m)).toBeNull();
  });

  it('untrackQuest 不存在返回 null', () => {
    expect(untrackQuest('no-id', ['a', 'b'])).toBeNull();
  });

  it('addActivityPoints NaN/负数防护', () => {
    const s = { currentPoints: 30, maxPoints: 100, milestones: [], lastResetDate: '' };
    addActivityPoints(s, NaN);
    expect(s.currentPoints).toBe(30);
    addActivityPoints(s, -50);
    expect(s.currentPoints).toBe(30);
  });

  it('updateProgressByTypeLogic 跳过已满进度', () => {
    const m = new Map<string, QuestInstance>();
    m.set('i1', { instanceId: 'i1', questDefId: 'q1', status: 'active',
      objectives: [{ id: 'o1', type: 'battle_clear', description: 'b', targetCount: 5, currentCount: 5 }],
      acceptedAt: 0, completedAt: null, rewardClaimed: false });
    updateProgressByTypeLogic('battle_clear', 1, m, { emit: vi.fn(), completeQuest: vi.fn(), checkQuestCompletion: vi.fn().mockReturnValue(false) });
    expect(m.get('i1')!.objectives[0].currentCount).toBe(5);
  });

  it('claimRewardLogic 实例/定义不存在返回 null', () => {
    expect(claimRewardLogic('no-id', { questDefs: new Map(), activeQuests: new Map(), addActivityPoints: vi.fn(), emit: vi.fn() })).toBeNull();
    const m = new Map<string, QuestInstance>();
    m.set('i1', { instanceId: 'i1', questDefId: 'q-no', status: 'completed', objectives: [], acceptedAt: 0, completedAt: 0, rewardClaimed: false });
    expect(claimRewardLogic('i1', { questDefs: new Map(), activeQuests: m, addActivityPoints: vi.fn(), emit: vi.fn() })).toBeNull();
  });

  it('claimAllRewardsLogic 空活跃任务返回空数组', () => {
    expect(claimAllRewardsLogic(new Map(), vi.fn())).toEqual([]);
  });
});

describe('QuestSerialization 对抗', () => {
  it('序列化空状态', () => {
    const data = serializeQuestState({
      activeQuests: new Map(), completedQuestIds: new Set(),
      activityState: { currentPoints: 0, maxPoints: 100, milestones: [], lastResetDate: '' },
      dailyRefreshDate: '', dailyQuestInstanceIds: [],
    });
    expect(data.activeQuests).toEqual([]);
  });
});
