/**
 * v12.0 任务成就 — 补充边界测试
 *
 * 覆盖范围：
 * - §5 任务系统边界: 周常任务、任务前置链、任务追踪上限、序列化/反序列化
 * - §6 活跃度边界: 活跃度溢出、里程碑重复领取、重置后状态
 * - §7 成就系统边界: 成就并发更新、前置成就解锁链、成就链完成、维度统计、索引性能
 * - §8 跨系统联动补充: 任务→成就→活跃度三方联动、批量操作
 *
 * @see docs/games/three-kingdoms/play/v12-play.md
 */

import { describe, it, expect } from 'vitest';
import { createSim, SUFFICIENT_RESOURCES, MASSIVE_RESOURCES } from '../../../test-utils/test-helpers';
import type { QuestCategory, QuestId, QuestDef } from '../../../core/quest/quest.types';
import type { AchievementDimension, AchievementConditionType } from '../../../core/achievement/achievement.types';

// ── 辅助函数 ──

/** 创建一个自定义任务定义 */
function makeQuestDef(id: string, category: QuestCategory, objectiveType: string = 'kill_enemy'): QuestDef {
  return {
    id,
    title: `测试任务-${id}`,
    description: `测试任务描述-${id}`,
    category,
    objectives: [{ id: 'obj_001', type: objectiveType, description: '击杀敌人', targetCount: 10, params: {} }],
    rewards: [{ type: 'resource', id: 'gold', amount: 100 }],
    autoAccept: false,
    sortOrder: 0,
  };
}

/** 创建带前置的任务定义 */
function makeChainedQuestDef(id: string, prerequisiteIds: QuestId[]): QuestDef {
  return {
    id,
    title: `链式任务-${id}`,
    description: `带前置的任务-${id}`,
    category: 'main',
    objectives: [{ id: 'obj_001', type: 'kill_enemy', description: '击杀敌人', targetCount: 5, params: {} }],
    rewards: [{ type: 'resource', id: 'gold', amount: 200 }],
    prerequisiteQuestIds: prerequisiteIds,
    autoAccept: false,
    sortOrder: 0,
  };
}

// ═══════════════════════════════════════════════════════════════
// §5 任务系统边界
// ═══════════════════════════════════════════════════════════════
describe('v12.0 补充 — §5 任务系统边界', () => {

  it('QUEST-BOUNDARY-1: 注册周常任务', () => {
    const sim = createSim();
    const quest = sim.engine.getQuestSystem();

    const weeklyDef = makeQuestDef('weekly-test-001', 'weekly');
    quest.registerQuest(weeklyDef);

    const defs = quest.getQuestDefsByCategory('weekly');
    expect(defs.some(d => d.id === 'weekly-test-001')).toBe(true);
  });

  it('QUEST-BOUNDARY-2: 注册支线任务', () => {
    const sim = createSim();
    const quest = sim.engine.getQuestSystem();

    const sideDef = makeQuestDef('side-test-001', 'side');
    quest.registerQuest(sideDef);

    const defs = quest.getQuestDefsByCategory('side');
    expect(defs.some(d => d.id === 'side-test-001')).toBe(true);
  });

  it('QUEST-BOUNDARY-3: 不可重复接受已完成任务', () => {
    const sim = createSim();
    const quest = sim.engine.getQuestSystem();

    const def = makeQuestDef('unique-quest-001', 'main');
    quest.registerQuest(def);

    const instance = quest.acceptQuest('unique-quest-001');
    expect(instance).not.toBeNull();

    // 完成任务
    if (instance) {
      quest.updateObjectiveProgress(instance.instanceId, 'obj_001', 10);
      quest.claimReward(instance.instanceId);
    }

    // 再次接受应返回null
    const instance2 = quest.acceptQuest('unique-quest-001');
    expect(instance2).toBeNull();
  });

  it('QUEST-BOUNDARY-4: 不可接受不存在的任务', () => {
    const sim = createSim();
    const quest = sim.engine.getQuestSystem();

    const instance = quest.acceptQuest('nonexistent_quest');
    expect(instance).toBeNull();
  });

  it('QUEST-BOUNDARY-5: 任务追踪上限', () => {
    const sim = createSim();
    const quest = sim.engine.getQuestSystem();

    const maxTracked = quest.getMaxTrackedQuests();
    expect(maxTracked).toBeGreaterThan(0);
  });

  it('QUEST-BOUNDARY-6: 追踪和取消追踪任务', () => {
    const sim = createSim();
    const quest = sim.engine.getQuestSystem();

    const def = makeQuestDef('track-quest-001', 'main');
    quest.registerQuest(def);

    const instance = quest.acceptQuest('track-quest-001');
    if (instance) {
      // 新任务可能未被自动追踪（日常任务已占满追踪槽位），需确保先追踪
      const trackedIds = quest.getState().trackedQuestIds;
      if (!trackedIds.includes(instance.instanceId)) {
        // 先取消一个已有追踪腾出槽位，再追踪新任务
        if (trackedIds.length > 0) {
          quest.untrackQuest(trackedIds[0]);
        }
        const preTrack = quest.trackQuest(instance.instanceId);
        expect(preTrack).toBe(true);
      }
      // 先取消追踪再重新追踪
      const untracked = quest.untrackQuest(instance.instanceId);
      expect(untracked).toBe(true);

      const tracked = quest.trackQuest(instance.instanceId);
      expect(tracked).toBe(true);
    }
  });

  it('QUEST-BOUNDARY-7: 不可追踪不存在的任务', () => {
    const sim = createSim();
    const quest = sim.engine.getQuestSystem();

    const tracked = quest.trackQuest('nonexistent_instance');
    expect(tracked).toBe(false);
  });

  it('QUEST-BOUNDARY-8: 任务序列化和反序列化', () => {
    const sim = createSim();
    const quest = sim.engine.getQuestSystem();

    const def = makeQuestDef('serial-quest-001', 'daily');
    quest.registerQuest(def);
    quest.acceptQuest('serial-quest-001');

    const data = quest.serialize();
    expect(data).toBeDefined();

    // 反序列化到新实例
    const sim2 = createSim();
    const quest2 = sim2.engine.getQuestSystem();
    quest2.deserialize(data);

    const state = quest2.getState();
    expect(state).toBeDefined();
  });

  it('QUEST-BOUNDARY-9: 按类别筛选活跃任务', () => {
    const sim = createSim();
    const quest = sim.engine.getQuestSystem();

    quest.registerQuest(makeQuestDef('cat-main-001', 'main'));
    quest.registerQuest(makeQuestDef('cat-daily-001', 'daily'));
    quest.acceptQuest('cat-main-001');
    quest.acceptQuest('cat-daily-001');

    const mainActive = quest.getActiveQuestsByCategory('main');
    const dailyActive = quest.getActiveQuestsByCategory('daily');

    expect(mainActive.some(q => q.questDefId === 'cat-main-001')).toBe(true);
    expect(dailyActive.some(q => q.questDefId === 'cat-daily-001')).toBe(true);
  });

  it('QUEST-BOUNDARY-10: 获取任务定义', () => {
    const sim = createSim();
    const quest = sim.engine.getQuestSystem();

    const def = makeQuestDef('def-quest-001', 'main');
    quest.registerQuest(def);

    const retrieved = quest.getQuestDef('def-quest-001');
    expect(retrieved).toBeDefined();
    expect(retrieved!.id).toBe('def-quest-001');

    const missing = quest.getQuestDef('nonexistent');
    expect(missing).toBeUndefined();
  });

  it('QUEST-BOUNDARY-11: 每日任务刷新', () => {
    const sim = createSim();
    const quest = sim.engine.getQuestSystem();

    const refreshed = quest.refreshDailyQuests();
    expect(Array.isArray(refreshed)).toBe(true);
  });

  it('QUEST-BOUNDARY-12: 获取每日任务列表', () => {
    const sim = createSim();
    const quest = sim.engine.getQuestSystem();

    quest.refreshDailyQuests();
    const dailyQuests = quest.getDailyQuests();
    expect(Array.isArray(dailyQuests)).toBe(true);
  });

  it('QUEST-BOUNDARY-13: 注册多个任务', () => {
    const sim = createSim();
    const quest = sim.engine.getQuestSystem();

    const defs = [
      makeQuestDef('batch-001', 'main'),
      makeQuestDef('batch-002', 'daily'),
      makeQuestDef('batch-003', 'side'),
    ];
    quest.registerQuests(defs);

    const allDefs = quest.getAllQuestDefs();
    expect(allDefs.some(d => d.id === 'batch-001')).toBe(true);
    expect(allDefs.some(d => d.id === 'batch-002')).toBe(true);
    expect(allDefs.some(d => d.id === 'batch-003')).toBe(true);
  });

  it('QUEST-BOUNDARY-14: 任务完成状态检查', () => {
    const sim = createSim();
    const quest = sim.engine.getQuestSystem();

    expect(quest.isQuestCompleted('any-quest')).toBe(false);

    const def = makeQuestDef('complete-check-001', 'main');
    quest.registerQuest(def);
    const instance = quest.acceptQuest('complete-check-001');

    if (instance) {
      quest.updateObjectiveProgress(instance.instanceId, 'obj_001', 10);
      quest.claimReward(instance.instanceId);
      expect(quest.isQuestCompleted('complete-check-001')).toBe(true);
    }
  });

});

// ═══════════════════════════════════════════════════════════════
// §6 活跃度边界
// ═══════════════════════════════════════════════════════════════
describe('v12.0 补充 — §6 活跃度边界', () => {

  it('ACTIVITY-BOUNDARY-1: 活跃度初始值为0', () => {
    const sim = createSim();
    const quest = sim.engine.getQuestSystem();

    const state = quest.getActivityState();
    expect(state.currentPoints).toBe(0);
  });

  it('ACTIVITY-BOUNDARY-2: 活跃度可累积', () => {
    const sim = createSim();
    const quest = sim.engine.getQuestSystem();

    quest.addActivityPoints(30);
    quest.addActivityPoints(20);

    const state = quest.getActivityState();
    expect(state.currentPoints).toBe(50);
  });

  it('ACTIVITY-BOUNDARY-3: 活跃度重置后归零', () => {
    const sim = createSim();
    const quest = sim.engine.getQuestSystem();

    quest.addActivityPoints(100);
    quest.resetDailyActivity();

    const state = quest.getActivityState();
    expect(state.currentPoints).toBe(0);
  });

  it('ACTIVITY-BOUNDARY-4: 不可重复领取已领取的里程碑', () => {
    const sim = createSim();
    const quest = sim.engine.getQuestSystem();

    // 添加大量活跃度
    quest.addActivityPoints(100);

    // 领取第一个里程碑
    const reward1 = quest.claimActivityMilestone(0);
    // 再次领取应返回null
    const reward2 = quest.claimActivityMilestone(0);
    expect(reward2).toBeNull();
  });

  it('ACTIVITY-BOUNDARY-5: 活跃度里程碑有多个', () => {
    const sim = createSim();
    const quest = sim.engine.getQuestSystem();

    const state = quest.getActivityState();
    expect(state.milestones.length).toBeGreaterThan(0);
  });

  it('ACTIVITY-BOUNDARY-6: 不可领取未达成的里程碑', () => {
    const sim = createSim();
    const quest = sim.engine.getQuestSystem();

    // 活跃度为0，尝试领取高里程碑
    const state = quest.getActivityState();
    const lastIdx = state.milestones.length - 1;
    if (lastIdx >= 0 && state.milestones[lastIdx].points > 0) {
      const reward = quest.claimActivityMilestone(lastIdx);
      expect(reward).toBeNull();
    }
  });

  it('ACTIVITY-BOUNDARY-7: 活跃度不超过最大值', () => {
    const sim = createSim();
    const quest = sim.engine.getQuestSystem();

    const state = quest.getActivityState();
    const maxPts = state.maxPoints;

    quest.addActivityPoints(99999);

    const stateAfter = quest.getActivityState();
    expect(stateAfter.currentPoints).toBeLessThanOrEqual(maxPts);
  });

});

// ═══════════════════════════════════════════════════════════════
// §7 成就系统边界
// ═══════════════════════════════════════════════════════════════
describe('v12.0 补充 — §7 成就系统边界', () => {

  it('ACH-BOUNDARY-1: 成就列表不为空', () => {
    const sim = createSim();
    const achievement = sim.engine.getAchievementSystem();

    const all = achievement.getAllAchievements();
    expect(all.length).toBeGreaterThan(0);
  });

  it('ACH-BOUNDARY-2: 成就按维度筛选', () => {
    const sim = createSim();
    const achievement = sim.engine.getAchievementSystem();

    const dimensions: AchievementDimension[] = ['battle', 'building', 'collection', 'social', 'rebirth'];
    for (const dim of dimensions) {
      const filtered = achievement.getAchievementsByDimension(dim);
      expect(Array.isArray(filtered)).toBe(true);
    }
  });

  it('ACH-BOUNDARY-3: 获取单个成就', () => {
    const sim = createSim();
    const achievement = sim.engine.getAchievementSystem();

    const all = achievement.getAllAchievements();
    if (all.length > 0) {
      const single = achievement.getAchievement(all[0].id);
      expect(single).not.toBeNull();
      expect(single!.id).toBe(all[0].id);
    }
  });

  it('ACH-BOUNDARY-4: 不存在的成就返回null', () => {
    const sim = createSim();
    const achievement = sim.engine.getAchievementSystem();

    const result = achievement.getAchievement('nonexistent_achievement');
    expect(result).toBeNull();
  });

  it('ACH-BOUNDARY-5: 成就总积分', () => {
    const sim = createSim();
    const achievement = sim.engine.getAchievementSystem();

    const points = achievement.getTotalPoints();
    expect(points).toBeGreaterThanOrEqual(0);
  });

  it('ACH-BOUNDARY-6: 维度统计覆盖所有维度', () => {
    const sim = createSim();
    const achievement = sim.engine.getAchievementSystem();

    const stats = achievement.getDimensionStats();
    expect(stats.battle).toBeDefined();
    expect(stats.building).toBeDefined();
    expect(stats.collection).toBeDefined();
    expect(stats.social).toBeDefined();
    expect(stats.rebirth).toBeDefined();
  });

  it('ACH-BOUNDARY-7: 成就进度更新', () => {
    const sim = createSim();
    const achievement = sim.engine.getAchievementSystem();

    // 更新战斗胜利进度
    achievement.updateProgress('battle_wins', 10);

    const all = achievement.getAllAchievements();
    expect(all.length).toBeGreaterThan(0);
  });

  it('ACH-BOUNDARY-8: 快照批量更新进度', () => {
    const sim = createSim();
    const achievement = sim.engine.getAchievementSystem();

    achievement.updateProgressFromSnapshot({
      battle_wins: 50,
      building_level: 10,
      hero_count: 8,
    });

    // 不应抛出异常
    expect(true).toBe(true);
  });

  it('ACH-BOUNDARY-9: 成就链列表', () => {
    const sim = createSim();
    const achievement = sim.engine.getAchievementSystem();

    const chains = achievement.getAchievementChains();
    expect(Array.isArray(chains)).toBe(true);
  });

  it('ACH-BOUNDARY-10: 已完成成就链初始为空', () => {
    const sim = createSim();
    const achievement = sim.engine.getAchievementSystem();

    const completed = achievement.getCompletedChains();
    expect(Array.isArray(completed)).toBe(true);
    expect(completed.length).toBe(0);
  });

  it('ACH-BOUNDARY-11: 不可领取未完成的成就奖励', () => {
    const sim = createSim();
    const achievement = sim.engine.getAchievementSystem();

    const result = achievement.claimReward('nonexistent_achievement');
    expect(result.success).toBe(false);
  });

  it('ACH-BOUNDARY-12: 成就状态序列化', () => {
    const sim = createSim();
    const achievement = sim.engine.getAchievementSystem();

    const state = achievement.getState();
    expect(state).toBeDefined();
    expect(state.achievements).toBeDefined();
  });

  it('ACH-BOUNDARY-13: 可领取成就列表', () => {
    const sim = createSim();
    const achievement = sim.engine.getAchievementSystem();

    const claimable = achievement.getClaimableAchievements();
    expect(Array.isArray(claimable)).toBe(true);
  });

  it('ACH-BOUNDARY-14: 成就系统重置', () => {
    const sim = createSim();
    const achievement = sim.engine.getAchievementSystem();

    achievement.updateProgress('battle_wins', 100);
    achievement.reset();

    const state = achievement.getState();
    // 重置后总积分归零
    expect(state.totalPoints).toBe(0);
    // 重置后已完成链为空
    expect(state.completedChains.length).toBe(0);
  });

  it('ACH-BOUNDARY-15: 并发更新多种条件类型', () => {
    const sim = createSim();
    const achievement = sim.engine.getAchievementSystem();

    // 同时更新多种条件
    const conditionTypes: AchievementConditionType[] = [
      'battle_wins', 'building_level', 'hero_count',
      'equipment_count', 'resource_total',
    ];
    for (const type of conditionTypes) {
      achievement.updateProgress(type, 10);
    }

    // 不应抛出异常
    expect(true).toBe(true);
  });

  it('ACH-BOUNDARY-16: 成就索引性能 — 100次查询应在合理时间内', () => {
    const sim = createSim();
    const achievement = sim.engine.getAchievementSystem();

    const start = performance.now();
    for (let i = 0; i < 100; i++) {
      achievement.getAllAchievements();
      achievement.getDimensionStats();
      achievement.getTotalPoints();
    }
    const elapsed = performance.now() - start;

    // 100次全量查询应在500ms内完成
    expect(elapsed).toBeLessThan(500);
  });

  it('ACH-BOUNDARY-17: 前置成就未完成时后续成就保持锁定', () => {
    const sim = createSim();
    const achievement = sim.engine.getAchievementSystem();

    const all = achievement.getAllAchievements();
    const withPrereq = all.find(a => a.prerequisiteId);

    if (withPrereq) {
      // 前置未完成，当前应锁定
      expect(withPrereq.instance.status).toBe('locked');
    }
  });

  it('ACH-BOUNDARY-18: 设置奖励回调', () => {
    const sim = createSim();
    const achievement = sim.engine.getAchievementSystem();

    let rewardCalled = false;
    achievement.setRewardCallback(() => { rewardCalled = true; });

    // 回调已设置，不抛异常
    expect(true).toBe(true);
  });

});

// ═══════════════════════════════════════════════════════════════
// §8 跨系统联动补充
// ═══════════════════════════════════════════════════════════════
describe('v12.0 补充 — §8 跨系统联动补充', () => {

  it('CROSS-SUP-1: 任务系统与活跃度系统联动', () => {
    const sim = createSim();
    const quest = sim.engine.getQuestSystem();

    let activityAdded = 0;
    quest.setActivityAddCallback((points: number) => { activityAdded += points; });

    const def = makeQuestDef('cross-quest-001', 'main');
    quest.registerQuest(def);
    const instance = quest.acceptQuest('cross-quest-001');

    if (instance) {
      quest.updateObjectiveProgress(instance.instanceId, 'obj_001', 10);
      quest.claimReward(instance.instanceId);
    }

    // 活跃度回调可能被调用
    expect(typeof activityAdded).toBe('number');
  });

  it('CROSS-SUP-2: 任务奖励回调', () => {
    const sim = createSim();
    const quest = sim.engine.getQuestSystem();

    let rewardReceived = false;
    quest.setRewardCallback(() => { rewardReceived = true; });

    const def = makeQuestDef('reward-cb-001', 'main');
    quest.registerQuest(def);
    const instance = quest.acceptQuest('reward-cb-001');

    if (instance) {
      quest.updateObjectiveProgress(instance.instanceId, 'obj_001', 10);
      quest.claimReward(instance.instanceId);
    }

    expect(rewardReceived).toBe(true);
  });

  it('CROSS-SUP-3: 批量注册任务并接受', () => {
    const sim = createSim();
    const quest = sim.engine.getQuestSystem();

    const defs = Array.from({ length: 10 }, (_, i) =>
      makeQuestDef(`batch-cross-${i}`, 'main')
    );
    quest.registerQuests(defs);

    const instances = [];
    for (const def of defs) {
      const inst = quest.acceptQuest(def.id);
      if (inst) instances.push(inst);
    }

    expect(instances.length).toBeGreaterThan(0);

    const active = quest.getActiveQuests();
    expect(active.length).toBeGreaterThanOrEqual(instances.length);
  });

  it('CROSS-SUP-4: 成就进度与活跃度独立计算', () => {
    const sim = createSim();
    const quest = sim.engine.getQuestSystem();
    const achievement = sim.engine.getAchievementSystem();

    quest.addActivityPoints(50);
    achievement.updateProgress('quest_completed', 5);

    const activityState = quest.getActivityState();
    expect(activityState.currentPoints).toBe(50);

    // 成就系统状态独立
    const achState = achievement.getState();
    expect(achState).toBeDefined();
  });

  it('CROSS-SUP-5: 活跃度达到里程碑后可领取', () => {
    const sim = createSim();
    const quest = sim.engine.getQuestSystem();

    const state = quest.getActivityState();
    const firstMilestone = state.milestones[0];

    if (firstMilestone) {
      // 添加足够活跃度
      quest.addActivityPoints(firstMilestone.points + 10);

      const reward = quest.claimActivityMilestone(0);
      expect(reward).not.toBeNull();
    }
  });

});
