/**
 * FLOW-19 任务面板集成测试 — 日常任务/进度/奖励领取/活跃度/边界
 *
 * 使用真实 QuestSystem，
 * 通过 createSim() 创建引擎实例，不 mock 核心逻辑。
 *
 * 覆盖范围：
 * - 日常任务列表：日常刷新（20选6）、日常任务查询
 * - 任务进度显示：目标进度更新、完成判定
 * - 任务奖励领取：单任务领取、一键领取全部、活跃度奖励
 * - 任务完成条件检查：前置任务、活跃度里程碑
 * - 边界：空任务列表、序列化恢复、重置、追踪上限
 *
 * @module tests/acc/FLOW-19
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { accTest, assertStrict } from './acc-test-utils';
import { createSim } from '../../test-utils/test-helpers';
import type { GameEventSimulator } from '../../test-utils/GameEventSimulator';

// 任务系统
import { QuestSystem } from '../../engine/quest/QuestSystem';
import { MAX_TRACKED_QUESTS, MAX_ACTIVITY_POINTS } from '../../engine/quest/QuestSystem.helpers';

// 核心类型
import type {
  QuestId,
  QuestDef,
  QuestInstance,
  QuestObjective,
  QuestReward,
  QuestCategory,
} from '../../core/quest';

import {
  PREDEFINED_QUESTS,
  DAILY_QUEST_TEMPLATES,
} from '../../core/quest';

// 类型
import type { ISystemDeps } from '../../core/types';

// ── 辅助函数 ──

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

/** 创建主线任务定义 */
function makeMainQuestDef(overrides?: Partial<QuestDef>): QuestDef {
  return {
    id: 'test-main-001',
    title: '测试主线任务',
    description: '主线任务描述',
    category: 'main',
    objectives: [
      { id: 'obj-1', type: 'build_upgrade', description: '升级建筑1次', targetCount: 1, currentCount: 0 },
    ],
    rewards: { resources: { gold: 200 }, experience: 50 },
    sortOrder: 1,
    ...overrides,
  };
}

/** 创建支线任务定义 */
function makeSideQuestDef(overrides?: Partial<QuestDef>): QuestDef {
  return {
    id: 'test-side-001',
    title: '测试支线任务',
    description: '支线任务描述',
    category: 'side',
    objectives: [
      { id: 'obj-s1', type: 'npc_interact', description: '与NPC交互3次', targetCount: 3, currentCount: 0 },
    ],
    rewards: { resources: { gold: 100 }, experience: 30 },
    ...overrides,
  };
}

/** 创建日常任务定义 */
function makeDailyQuestDef(id: string, overrides?: Partial<QuestDef>): QuestDef {
  return {
    id,
    title: `日常任务-${id}`,
    description: '日常任务描述',
    category: 'daily',
    objectives: [
      { id: `obj-${id}`, type: 'battle_clear', description: '通关关卡3次', targetCount: 3, currentCount: 0 },
    ],
    rewards: { resources: { gold: 50 }, activityPoints: 10 },
    expireHours: 24,
    ...overrides,
  };
}

/** 创建多目标主线任务 */
function makeMultiObjQuestDef(overrides?: Partial<QuestDef>): QuestDef {
  return {
    id: 'test-multi-001',
    title: '多目标任务',
    description: '包含多个目标的任务',
    category: 'main',
    objectives: [
      { id: 'mo-1', type: 'build_upgrade', description: '升级建筑2次', targetCount: 2, currentCount: 0 },
      { id: 'mo-2', type: 'battle_clear', description: '通关关卡5次', targetCount: 5, currentCount: 0 },
      { id: 'mo-3', type: 'recruit_hero', description: '招募武将1次', targetCount: 1, currentCount: 0 },
    ],
    rewards: { resources: { gold: 500 }, experience: 100 },
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════
// FLOW-19 任务面板集成测试
// ═══════════════════════════════════════════════════════════════

describe('FLOW-19 任务面板集成测试', () => {
  let sim: GameEventSimulator;
  let questSys: QuestSystem;

  beforeEach(() => {
    vi.clearAllMocks();
    sim = createSim();
    sim.addResources({ gold: 500000, grain: 500000, troops: 50000 });

    questSys = new QuestSystem();
    questSys.init(mockDeps());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ═══════════════════════════════════════════
  // 1. 日常任务列表（FLOW-19-01 ~ FLOW-19-06）
  // ═══════════════════════════════════════════

  it(accTest('FLOW-19-01', '初始状态下无活跃任务'), () => {
    const active = questSys.getActiveQuests();
    assertStrict(active.length === 0, 'FLOW-19-01', '初始应无活跃任务');

    const completed = questSys.getCompletedQuestIds();
    assertStrict(completed.length === 0, 'FLOW-19-01', '初始应无已完成任务');
  });

  it(accTest('FLOW-19-02', '预定义任务定义已加载'), () => {
    const defs = questSys.getAllQuestDefs();
    assertStrict(defs.length > 0, 'FLOW-19-02', `应有预定义任务，实际 ${defs.length}`);

    // 检查核心预定义任务存在
    const mainDefs = questSys.getQuestDefsByCategory('main');
    assertStrict(mainDefs.length >= 3, 'FLOW-19-02', `应至少有3个主线任务，实际 ${mainDefs.length}`);
  });

  it(accTest('FLOW-19-03', '日常任务刷新（20选6）'), () => {
    // 注册日常任务模板
    for (const tpl of DAILY_QUEST_TEMPLATES) {
      questSys.registerQuest(tpl);
    }

    const dailyQuests = questSys.refreshDailyQuests();
    assertStrict(dailyQuests.length === 6, 'FLOW-19-03', `日常任务应为6个，实际 ${dailyQuests.length}`);

    // 所有日常任务应为 active 状态
    for (const q of dailyQuests) {
      assertStrict(q.status === 'active', 'FLOW-19-03', `日常任务 ${q.questDefId} 应为 active 状态`);
    }
  });

  it(accTest('FLOW-19-04', '重复刷新日常任务不增加'), () => {
    for (const tpl of DAILY_QUEST_TEMPLATES) {
      questSys.registerQuest(tpl);
    }

    questSys.refreshDailyQuests();
    const first = questSys.getDailyQuests();

    questSys.refreshDailyQuests();
    const second = questSys.getDailyQuests();

    assertStrict(
      first.length === second.length,
      'FLOW-19-04',
      '同一天重复刷新不应增加日常任务',
    );
  });

  it(accTest('FLOW-19-05', '按类型获取活跃任务'), () => {
    questSys.registerQuest(makeMainQuestDef());
    questSys.registerQuest(makeSideQuestDef());

    questSys.acceptQuest('test-main-001');
    questSys.acceptQuest('test-side-001');

    const mainQuests = questSys.getActiveQuestsByCategory('main');
    assertStrict(mainQuests.length === 1, 'FLOW-19-05', `主线任务应为1个，实际 ${mainQuests.length}`);

    const sideQuests = questSys.getActiveQuestsByCategory('side');
    assertStrict(sideQuests.length === 1, 'FLOW-19-05', `支线任务应为1个，实际 ${sideQuests.length}`);
  });

  it(accTest('FLOW-19-06', '自定义任务注册与查询'), () => {
    const customDef = makeMainQuestDef({ id: 'custom-quest-001', title: '自定义任务' });
    questSys.registerQuest(customDef);

    const found = questSys.getQuestDef('custom-quest-001');
    assertStrict(found !== undefined, 'FLOW-19-06', '注册的自定义任务应可查询');
    assertStrict(found!.title === '自定义任务', 'FLOW-19-06', '任务标题应匹配');
  });

  // ═══════════════════════════════════════════
  // 2. 任务接受与进度（FLOW-19-07 ~ FLOW-19-13）
  // ═══════════════════════════════════════════

  it(accTest('FLOW-19-07', '接受任务成功'), () => {
    questSys.registerQuest(makeMainQuestDef());

    const instance = questSys.acceptQuest('test-main-001');
    assertStrict(instance !== null, 'FLOW-19-07', '接受任务应成功');
    assertStrict(instance!.status === 'active', 'FLOW-19-07', '任务状态应为 active');
    assertStrict(instance!.questDefId === 'test-main-001', 'FLOW-19-07', '任务定义ID应匹配');
    assertStrict(instance!.rewardClaimed === false, 'FLOW-19-07', '初始奖励未领取');
  });

  it(accTest('FLOW-19-08', '接受不存在的任务失败'), () => {
    const instance = questSys.acceptQuest('nonexistent-quest');
    assertStrict(instance === null, 'FLOW-19-08', '接受不存在的任务应返回 null');
  });

  it(accTest('FLOW-19-09', '重复接受同一任务失败'), () => {
    questSys.registerQuest(makeMainQuestDef());
    questSys.acceptQuest('test-main-001');

    const second = questSys.acceptQuest('test-main-001');
    assertStrict(second === null, 'FLOW-19-09', '重复接受同一任务应返回 null');
  });

  it(accTest('FLOW-19-10', '更新任务目标进度'), () => {
    questSys.registerQuest(makeMainQuestDef());
    const instance = questSys.acceptQuest('test-main-001')!;

    const obj = questSys.updateObjectiveProgress(instance.instanceId, 'obj-1', 1);
    assertStrict(obj !== null, 'FLOW-19-10', '更新进度应成功');
    assertStrict(obj!.currentCount === 1, 'FLOW-19-10', `当前进度应为1，实际 ${obj!.currentCount}`);
    assertStrict(obj!.targetCount === 1, 'FLOW-19-10', '目标数量应为1');
  });

  it(accTest('FLOW-19-11', '任务目标完成时自动完成任务'), () => {
    questSys.registerQuest(makeMainQuestDef());
    const instance = questSys.acceptQuest('test-main-001')!;

    // 目标 targetCount=1, currentCount=0, 加1后完成
    questSys.updateObjectiveProgress(instance.instanceId, 'obj-1', 1);

    // 任务应自动完成
    const updated = questSys.getQuestInstance(instance.instanceId);
    assertStrict(updated!.status === 'completed', 'FLOW-19-11', '目标完成后任务应自动标记为 completed');
  });

  it(accTest('FLOW-19-12', '多目标任务部分完成'), () => {
    questSys.registerQuest(makeMultiObjQuestDef());
    const instance = questSys.acceptQuest('test-multi-001')!;

    // 完成第一个目标
    questSys.updateObjectiveProgress(instance.instanceId, 'mo-1', 2);

    const updated = questSys.getQuestInstance(instance.instanceId)!;
    assertStrict(updated.status === 'active', 'FLOW-19-12', '部分完成时任务应仍为 active');

    const obj1 = updated.objectives.find(o => o.id === 'mo-1')!;
    assertStrict(obj1.currentCount === 2, 'FLOW-19-12', '第一个目标进度应为2');
  });

  it(accTest('FLOW-19-13', '多目标任务全部完成后自动完成'), () => {
    questSys.registerQuest(makeMultiObjQuestDef());
    const instance = questSys.acceptQuest('test-multi-001')!;

    questSys.updateObjectiveProgress(instance.instanceId, 'mo-1', 2);
    questSys.updateObjectiveProgress(instance.instanceId, 'mo-2', 5);
    questSys.updateObjectiveProgress(instance.instanceId, 'mo-3', 1);

    const updated = questSys.getQuestInstance(instance.instanceId)!;
    assertStrict(updated.status === 'completed', 'FLOW-19-13', '所有目标完成后任务应为 completed');
  });

  // ═══════════════════════════════════════════
  // 3. 任务奖励领取（FLOW-19-14 ~ FLOW-19-19）
  // ═══════════════════════════════════════════

  it(accTest('FLOW-19-14', '领取已完成任务的奖励'), () => {
    const rewardLog: QuestReward[] = [];
    questSys.setRewardCallback((r) => rewardLog.push(r));

    questSys.registerQuest(makeMainQuestDef());
    const instance = questSys.acceptQuest('test-main-001')!;
    questSys.updateObjectiveProgress(instance.instanceId, 'obj-1', 1);

    const reward = questSys.claimReward(instance.instanceId);
    assertStrict(reward !== null, 'FLOW-19-14', '领取奖励应成功');
    assertStrict(reward!.resources?.gold === 200, 'FLOW-19-14', `金币奖励应为200，实际 ${reward!.resources?.gold}`);

    // 奖励回调应被调用
    assertStrict(rewardLog.length === 1, 'FLOW-19-14', '奖励回调应被调用1次');
  });

  it(accTest('FLOW-19-15', '领取未完成任务的奖励失败'), () => {
    questSys.registerQuest(makeMainQuestDef());
    const instance = questSys.acceptQuest('test-main-001')!;

    const reward = questSys.claimReward(instance.instanceId);
    assertStrict(reward === null, 'FLOW-19-15', '领取未完成任务奖励应返回 null');
  });

  it(accTest('FLOW-19-16', '重复领取奖励失败'), () => {
    questSys.registerQuest(makeMainQuestDef());
    const instance = questSys.acceptQuest('test-main-001')!;
    questSys.updateObjectiveProgress(instance.instanceId, 'obj-1', 1);

    questSys.claimReward(instance.instanceId);
    const second = questSys.claimReward(instance.instanceId);
    assertStrict(second === null, 'FLOW-19-16', '重复领取应返回 null');
  });

  it(accTest('FLOW-19-17', '一键领取所有已完成任务奖励'), () => {
    questSys.registerQuest(makeMainQuestDef({ id: 'q1' }));
    questSys.registerQuest(makeMainQuestDef({ id: 'q2', title: '任务2' }));
    questSys.registerQuest(makeMainQuestDef({ id: 'q3', title: '任务3' }));

    const i1 = questSys.acceptQuest('q1')!;
    const i2 = questSys.acceptQuest('q2')!;
    const i3 = questSys.acceptQuest('q3')!;

    // 完成 q1 和 q2
    questSys.updateObjectiveProgress(i1.instanceId, 'obj-1', 1);
    questSys.updateObjectiveProgress(i2.instanceId, 'obj-1', 1);

    const rewards = questSys.claimAllRewards();
    assertStrict(rewards.length === 2, 'FLOW-19-17', `应领取2个奖励，实际 ${rewards.length}`);
  });

  it(accTest('FLOW-19-18', '日常任务奖励包含活跃度'), () => {
    const dailyDef = makeDailyQuestDef('daily-reward-test', {
      rewards: { resources: { gold: 50 }, activityPoints: 10 },
    });
    questSys.registerQuest(dailyDef);

    const instance = questSys.acceptQuest('daily-reward-test')!;
    questSys.updateObjectiveProgress(instance.instanceId, 'obj-daily-reward-test', 3);

    const reward = questSys.claimReward(instance.instanceId);
    assertStrict(reward !== null, 'FLOW-19-18', '领取日常任务奖励应成功');
    assertStrict(reward!.activityPoints === 10, 'FLOW-19-18', '活跃度奖励应为10');
  });

  it(accTest('FLOW-19-19', '领取奖励增加活跃度'), () => {
    const dailyDef = makeDailyQuestDef('daily-act-pts', {
      rewards: { resources: { gold: 50 }, activityPoints: 20 },
    });
    questSys.registerQuest(dailyDef);

    const instance = questSys.acceptQuest('daily-act-pts')!;
    questSys.updateObjectiveProgress(instance.instanceId, 'obj-daily-act-pts', 3);
    questSys.claimReward(instance.instanceId);

    const actState = questSys.getActivityState();
    assertStrict(actState.currentPoints === 20, 'FLOW-19-19', `活跃度应为20，实际 ${actState.currentPoints}`);
  });

  // ═══════════════════════════════════════════
  // 4. 活跃度系统（FLOW-19-20 ~ FLOW-19-24）
  // ═══════════════════════════════════════════

  it(accTest('FLOW-19-20', '活跃度初始状态'), () => {
    const state = questSys.getActivityState();
    assertStrict(state.currentPoints === 0, 'FLOW-19-20', '初始活跃度应为0');
    assertStrict(state.maxPoints === MAX_ACTIVITY_POINTS, 'FLOW-19-20', `最大活跃度应为 ${MAX_ACTIVITY_POINTS}`);
    assertStrict(state.milestones.length > 0, 'FLOW-19-20', '应有活跃度里程碑');
  });

  it(accTest('FLOW-19-21', '增加活跃度不超过上限'), () => {
    questSys.addActivityPoints(50);
    assertStrict(questSys.getActivityState().currentPoints === 50, 'FLOW-19-21', '活跃度应为50');

    questSys.addActivityPoints(MAX_ACTIVITY_POINTS + 100);
    assertStrict(
      questSys.getActivityState().currentPoints === MAX_ACTIVITY_POINTS,
      'FLOW-19-21',
      `活跃度不应超过上限 ${MAX_ACTIVITY_POINTS}`,
    );
  });

  it(accTest('FLOW-19-22', '领取活跃度里程碑奖励'), () => {
    // 添加足够活跃度
    questSys.addActivityPoints(100);

    const state = questSys.getActivityState();
    // 找到第一个未领取且达到条件的里程碑
    const milestoneIdx = state.milestones.findIndex(m => !m.claimed && state.currentPoints >= m.points);

    if (milestoneIdx >= 0) {
      const reward = questSys.claimActivityMilestone(milestoneIdx);
      assertStrict(reward !== null, 'FLOW-19-22', '领取里程碑奖励应成功');

      const updatedState = questSys.getActivityState();
      assertStrict(updatedState.milestones[milestoneIdx].claimed === true, 'FLOW-19-22', '里程碑应标记为已领取');
    }
  });

  it(accTest('FLOW-19-23', '活跃度不足时不可领取里程碑'), () => {
    // 活跃度为0
    const state = questSys.getActivityState();
    const milestoneIdx = state.milestones.findIndex(m => !m.claimed);

    if (milestoneIdx >= 0) {
      const reward = questSys.claimActivityMilestone(milestoneIdx);
      assertStrict(reward === null, 'FLOW-19-23', '活跃度不足时领取应返回 null');
    }
  });

  it(accTest('FLOW-19-24', '重置每日活跃度'), () => {
    questSys.addActivityPoints(80);
    assertStrict(questSys.getActivityState().currentPoints === 80, 'FLOW-19-24', '添加后活跃度应为80');

    questSys.resetDailyActivity();
    assertStrict(questSys.getActivityState().currentPoints === 0, 'FLOW-19-24', '重置后活跃度应为0');
  });

  // ═══════════════════════════════════════════
  // 5. 任务追踪（FLOW-19-25 ~ FLOW-19-28）
  // ═══════════════════════════════════════════

  it(accTest('FLOW-19-25', '接受任务时自动追踪'), () => {
    questSys.registerQuest(makeMainQuestDef());
    questSys.acceptQuest('test-main-001');

    const tracked = questSys.getTrackedQuests();
    assertStrict(tracked.length === 1, 'FLOW-19-25', '接受任务后追踪列表应有1个');
  });

  it(accTest('FLOW-19-26', '手动取消追踪'), () => {
    questSys.registerQuest(makeMainQuestDef());
    const instance = questSys.acceptQuest('test-main-001')!;

    const result = questSys.untrackQuest(instance.instanceId);
    assertStrict(result === true, 'FLOW-19-26', '取消追踪应成功');

    const tracked = questSys.getTrackedQuests();
    assertStrict(tracked.length === 0, 'FLOW-19-26', '取消后追踪列表应为空');
  });

  it(accTest('FLOW-19-27', '手动添加追踪'), () => {
    questSys.registerQuest(makeMainQuestDef());
    const instance = questSys.acceptQuest('test-main-001')!;

    // 先取消再添加
    questSys.untrackQuest(instance.instanceId);
    const result = questSys.trackQuest(instance.instanceId);
    assertStrict(result === true, 'FLOW-19-27', '添加追踪应成功');

    const tracked = questSys.getTrackedQuests();
    assertStrict(tracked.length === 1, 'FLOW-19-27', '追踪列表应有1个');
  });

  it(accTest('FLOW-19-28', '追踪上限'), () => {
    const maxTracked = questSys.getMaxTrackedQuests();

    // 注册并接受超过上限的任务
    for (let i = 0; i < maxTracked + 3; i++) {
      questSys.registerQuest(makeMainQuestDef({ id: `track-q-${i}` }));
      questSys.acceptQuest(`track-q-${i}`);
    }

    const tracked = questSys.getTrackedQuests();
    assertStrict(
      tracked.length <= maxTracked,
      'FLOW-19-28',
      `追踪数不应超过上限 ${maxTracked}，实际 ${tracked.length}`,
    );
  });

  // ═══════════════════════════════════════════
  // 6. 任务前置条件（FLOW-19-29 ~ FLOW-19-31）
  // ═══════════════════════════════════════════

  it(accTest('FLOW-19-29', '前置任务未完成时不可接受'), () => {
    questSys.registerQuest(makeMainQuestDef({ id: 'pre-q1' }));
    questSys.registerQuest(makeMainQuestDef({
      id: 'pre-q2',
      prerequisiteQuestIds: ['pre-q1'],
    }));

    const result = questSys.acceptQuest('pre-q2');
    assertStrict(result === null, 'FLOW-19-29', '前置任务未完成时应不可接受');
  });

  it(accTest('FLOW-19-30', '前置任务完成后可接受'), () => {
    questSys.registerQuest(makeMainQuestDef({ id: 'pre-q1' }));
    questSys.registerQuest(makeMainQuestDef({
      id: 'pre-q2',
      prerequisiteQuestIds: ['pre-q1'],
    }));

    // 完成前置任务
    const i1 = questSys.acceptQuest('pre-q1')!;
    questSys.updateObjectiveProgress(i1.instanceId, 'obj-1', 1);

    // 现在可以接受后续任务
    const i2 = questSys.acceptQuest('pre-q2');
    assertStrict(i2 !== null, 'FLOW-19-30', '前置任务完成后应可接受');
  });

  it(accTest('FLOW-19-31', '已完成任务不可再次接受'), () => {
    questSys.registerQuest(makeMainQuestDef());
    const instance = questSys.acceptQuest('test-main-001')!;
    questSys.updateObjectiveProgress(instance.instanceId, 'obj-1', 1);

    const second = questSys.acceptQuest('test-main-001');
    assertStrict(second === null, 'FLOW-19-31', '已完成任务不可再次接受');
  });

  // ═══════════════════════════════════════════
  // 7. 按类型批量更新进度（FLOW-19-32 ~ FLOW-19-33）
  // ═══════════════════════════════════════════

  it(accTest('FLOW-19-32', '按目标类型批量更新进度'), () => {
    // 注册多个 build_upgrade 类型的任务
    questSys.registerQuest(makeMainQuestDef({ id: 'batch-q1' }));
    questSys.registerQuest(makeMultiObjQuestDef({ id: 'batch-q2' }));

    questSys.acceptQuest('batch-q1');
    questSys.acceptQuest('batch-q2');

    // 批量更新所有 build_upgrade 类型目标
    questSys.updateProgressByType('build_upgrade', 1);

    // 检查 batch-q1 的目标
    const q1 = questSys.getActiveQuests().find(q => q.questDefId === 'batch-q1')!;
    const obj1 = q1.objectives.find(o => o.type === 'build_upgrade')!;
    assertStrict(obj1.currentCount === 1, 'FLOW-19-32', 'batch-q1 build_upgrade 进度应为1');

    // 检查 batch-q2 的 build_upgrade 目标
    const q2 = questSys.getActiveQuests().find(q => q.questDefId === 'batch-q2')!;
    const obj2 = q2.objectives.find(o => o.type === 'build_upgrade')!;
    assertStrict(obj2.currentCount === 1, 'FLOW-19-32', 'batch-q2 build_upgrade 进度应为1');
  });

  it(accTest('FLOW-19-33', '按类型更新进度触发自动完成'), () => {
    questSys.registerQuest(makeMainQuestDef({ id: 'auto-q1' }));
    const instance = questSys.acceptQuest('auto-q1')!;

    // build_upgrade 目标 targetCount=1，加1应完成
    questSys.updateProgressByType('build_upgrade', 1);

    const updated = questSys.getQuestInstance(instance.instanceId)!;
    assertStrict(updated.status === 'completed', 'FLOW-19-33', '按类型更新后任务应自动完成');
  });

  // ═══════════════════════════════════════════
  // 8. 序列化与恢复（FLOW-19-34 ~ FLOW-19-36）
  // ═══════════════════════════════════════════

  it(accTest('FLOW-19-34', '任务系统序列化'), () => {
    questSys.registerQuest(makeMainQuestDef());
    questSys.acceptQuest('test-main-001');

    const data = questSys.serialize();
    assertStrict(!!data, 'FLOW-19-34', '序列化数据不应为空');
    assertStrict(data.version > 0, 'FLOW-19-34', '版本号应大于0');
  });

  it(accTest('FLOW-19-35', '任务系统反序列化恢复'), () => {
    questSys.registerQuest(makeMainQuestDef());
    const instance = questSys.acceptQuest('test-main-001')!;
    questSys.updateObjectiveProgress(instance.instanceId, 'obj-1', 1);

    const data = questSys.serialize();

    questSys.reset();
    assertStrict(questSys.getActiveQuests().length === 0, 'FLOW-19-35', '重置后应无活跃任务');

    questSys.deserialize(data);
    const active = questSys.getActiveQuests();
    assertStrict(active.length >= 1, 'FLOW-19-35', `恢复后应有活跃任务，实际 ${active.length}`);
  });

  it(accTest('FLOW-19-36', '任务系统完整重置'), () => {
    questSys.registerQuest(makeMainQuestDef());
    questSys.acceptQuest('test-main-001');
    questSys.addActivityPoints(50);

    questSys.reset();

    assertStrict(questSys.getActiveQuests().length === 0, 'FLOW-19-36', '重置后应无活跃任务');
    assertStrict(questSys.getCompletedQuestIds().length === 0, 'FLOW-19-36', '重置后应无已完成任务');
    assertStrict(questSys.getActivityState().currentPoints === 0, 'FLOW-19-36', '重置后活跃度应为0');
  });

  // ═══════════════════════════════════════════
  // 9. 任务状态查询（FLOW-19-37 ~ FLOW-19-40）
  // ═══════════════════════════════════════════

  it(accTest('FLOW-19-37', '检查任务是否激活'), () => {
    questSys.registerQuest(makeMainQuestDef());
    assertStrict(!questSys.isQuestActive('test-main-001'), 'FLOW-19-37', '未接受时应不活跃');

    questSys.acceptQuest('test-main-001');
    assertStrict(questSys.isQuestActive('test-main-001'), 'FLOW-19-37', '接受后应活跃');
  });

  it(accTest('FLOW-19-38', '检查任务是否完成'), () => {
    questSys.registerQuest(makeMainQuestDef());
    assertStrict(!questSys.isQuestCompleted('test-main-001'), 'FLOW-19-38', '未完成时应为 false');

    const instance = questSys.acceptQuest('test-main-001')!;
    questSys.updateObjectiveProgress(instance.instanceId, 'obj-1', 1);
    assertStrict(questSys.isQuestCompleted('test-main-001'), 'FLOW-19-38', '完成后应为 true');
  });

  it(accTest('FLOW-19-39', '获取任务实例详情'), () => {
    questSys.registerQuest(makeMultiObjQuestDef());
    const instance = questSys.acceptQuest('test-multi-001')!;

    const found = questSys.getQuestInstance(instance.instanceId);
    assertStrict(found !== undefined, 'FLOW-19-39', '应能查到任务实例');
    assertStrict(found!.objectives.length === 3, 'FLOW-19-39', '目标数应为3');
    assertStrict(found!.acceptedAt > 0, 'FLOW-19-39', '接受时间应大于0');
  });

  it(accTest('FLOW-19-40', '任务进度不超过目标上限'), () => {
    questSys.registerQuest(makeMainQuestDef());
    const instance = questSys.acceptQuest('test-main-001')!;

    // 目标 targetCount=1，加5不应超过1
    questSys.updateObjectiveProgress(instance.instanceId, 'obj-1', 5);

    const updated = questSys.getQuestInstance(instance.instanceId)!;
    const obj = updated.objectives[0];
    assertStrict(obj.currentCount <= obj.targetCount, 'FLOW-19-40', `进度不应超过目标，实际 ${obj.currentCount}/${obj.targetCount}`);
  });
});
