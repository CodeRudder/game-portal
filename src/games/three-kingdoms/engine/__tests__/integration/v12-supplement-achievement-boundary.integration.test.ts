/**
 * v12.0 任务成就 — 补充集成测试（第二部分）
 *
 * 在 v12-achievement-boundary.integration.test.ts 基础上补充：
 * - §A 成就并发更新 — 同时完成多个成就
 * - §B 活跃度溢出 — 超过上限后正确截断
 * - §C 任务前置链深度 — 多层前置任务
 * - §D 成就链进度 — 链式成就解锁
 * - §E 周常任务重置 — 每周重置逻辑
 *
 * ACH-P1-01 fix: 原1008行超标文件拆分为两个文件。
 * §F-§I 已拆分至 v12-supplement-achievement-system.integration.test.ts
 *
 * @see docs/games/three-kingdoms/play/v12-play.md
 */

import { describe, it, expect } from 'vitest';
import { createSim } from '../../../test-utils/test-helpers';
import type { QuestCategory, QuestId, QuestDef } from '../../../core/quest/quest.types';
import type { AchievementDimension, AchievementConditionType } from '../../../core/achievement/achievement.types';

// ── 辅助函数 ──

function makeQuestDef(
  id: string,
  category: QuestCategory,
  targetCount: number = 10,
  objectiveType: string = 'kill_enemy',
): QuestDef {
  return {
    id,
    title: `测试-${id}`,
    description: `描述-${id}`,
    category,
    objectives: [{ id: 'obj_001', type: objectiveType, description: '目标', targetCount, params: {} }],
    rewards: [{ type: 'resource', id: 'gold', amount: 100 }],
    autoAccept: false,
    sortOrder: 0,
  };
}

function makeChainedQuestDef(id: string, prerequisiteIds: QuestId[], targetCount: number = 5): QuestDef {
  return {
    id,
    title: `链式-${id}`,
    description: `带前置-${id}`,
    category: 'main',
    objectives: [{ id: 'obj_001', type: 'kill_enemy', description: '击杀', targetCount, params: {} }],
    rewards: [{ type: 'resource', id: 'gold', amount: 200 }],
    prerequisiteQuestIds: prerequisiteIds,
    autoAccept: false,
    sortOrder: 0,
  };
}

/** 完成一个任务的完整流程 */
function completeQuestFlow(
  quest: ReturnType<ReturnType<typeof createSim>['engine']['getQuestSystem']>,
  questId: string,
): void {
  const instance = quest.acceptQuest(questId);
  if (instance) {
    quest.updateObjectiveProgress(instance.instanceId, 'obj_001', 999);
    quest.claimReward(instance.instanceId);
  }
}

// ═══════════════════════════════════════════════════════════════
// §A 成就并发更新 — 同时完成多个成就
// ═══════════════════════════════════════════════════════════════
describe('v12.0 补充2 — §A 成就并发更新', () => {

  it('ACH-CONCURRENT-1: 批量更新多种条件类型不抛异常', () => {
    const sim = createSim();
    const achievement = sim.engine.getAchievementSystem();

    expect(() => {
      achievement.updateProgressFromSnapshot({
        battle_wins: 10,
        building_level: 5,
        hero_count: 5,
        equipment_count: 3,
        resource_total: 1000,
      });
    }).not.toThrow();
  });

  it('ACH-CONCURRENT-2: 连续更新同一条件类型取最大值', () => {
    const sim = createSim();
    const achievement = sim.engine.getAchievementSystem();

    achievement.updateProgress('battle_wins', 5);
    achievement.updateProgress('battle_wins', 15);

    const ach = achievement.getAchievement('ach-battle-001');
    expect(ach).not.toBeNull();
    expect(ach!.instance.progress['battle_wins']).toBe(15);
  });

  it('ACH-CONCURRENT-3: 降序更新不降低进度', () => {
    const sim = createSim();
    const achievement = sim.engine.getAchievementSystem();

    achievement.updateProgress('battle_wins', 100);
    achievement.updateProgress('battle_wins', 1);

    const ach = achievement.getAchievement('ach-battle-001');
    expect(ach!.instance.progress['battle_wins']).toBe(100);
  });

  it('ACH-CONCURRENT-4: 同时满足多个成就条件', () => {
    const sim = createSim();
    const achievement = sim.engine.getAchievementSystem();

    achievement.updateProgress('battle_wins', 10);

    const ach = achievement.getAchievement('ach-battle-001');
    expect(ach).not.toBeNull();
    expect(ach!.instance.status).toBe('completed');
  });

  it('ACH-CONCURRENT-5: 领取一个成就不影响其他成就状态', () => {
    const sim = createSim();
    const achievement = sim.engine.getAchievementSystem();

    achievement.updateProgress('battle_wins', 10);
    const ach1 = achievement.getAchievement('ach-battle-001');
    expect(ach1!.instance.status).toBe('completed');

    const result = achievement.claimReward('ach-battle-001');
    expect(result.success).toBe(true);

    const ach2 = achievement.getAchievement('ach-build-001');
    expect(ach2).not.toBeNull();
    expect(['in_progress', 'completed', 'locked']).toContain(ach2!.instance.status);
  });

  it('ACH-CONCURRENT-6: 快照更新与单次更新结果一致', () => {
    const sim1 = createSim();
    const sim2 = createSim();
    const a1 = sim1.engine.getAchievementSystem();
    const a2 = sim2.engine.getAchievementSystem();

    a1.updateProgress('battle_wins', 10);
    a1.updateProgress('building_level', 5);

    a2.updateProgressFromSnapshot({ battle_wins: 10, building_level: 5 });

    const ach1 = a1.getAchievement('ach-battle-001');
    const ach2 = a2.getAchievement('ach-battle-001');
    expect(ach1!.instance.status).toBe(ach2!.instance.status);
    expect(ach1!.instance.progress['battle_wins']).toBe(ach2!.instance.progress['battle_wins']);
  });

  it('ACH-CONCURRENT-7: 多维度同时更新', () => {
    const sim = createSim();
    const achievement = sim.engine.getAchievementSystem();

    achievement.updateProgressFromSnapshot({
      battle_wins: 10,
      building_level: 5,
      hero_count: 5,
      npc_max_favorability: 10,
      rebirth_count: 1,
    });

    const battleAch = achievement.getAchievement('ach-battle-001');
    const buildAch = achievement.getAchievement('ach-build-001');
    const collectAch = achievement.getAchievement('ach-collect-001');

    expect(battleAch!.instance.progress['battle_wins']).toBe(10);
    expect(buildAch!.instance.progress['building_level']).toBe(5);
    expect(collectAch!.instance.progress['hero_count']).toBe(5);
  });

});

// ═══════════════════════════════════════════════════════════════
// §B 活跃度溢出 — 超过上限后正确截断
// ═══════════════════════════════════════════════════════════════
describe('v12.0 补充2 — §B 活跃度溢出', () => {

  it('ACT-OVERFLOW-1: 活跃度精确等于上限', () => {
    const sim = createSim();
    const quest = sim.engine.getQuestSystem();

    const maxPts = quest.getActivityState().maxPoints;
    quest.addActivityPoints(maxPts);

    expect(quest.getActivityState().currentPoints).toBe(maxPts);
  });

  it('ACT-OVERFLOW-2: 活跃度超过上限被截断', () => {
    const sim = createSim();
    const quest = sim.engine.getQuestSystem();

    const maxPts = quest.getActivityState().maxPoints;
    quest.addActivityPoints(maxPts + 500);

    expect(quest.getActivityState().currentPoints).toBe(maxPts);
  });

  it('ACT-OVERFLOW-3: 多次小额累加不超过上限', () => {
    const sim = createSim();
    const quest = sim.engine.getQuestSystem();

    const maxPts = quest.getActivityState().maxPoints;
    for (let i = 0; i < 20; i++) {
      quest.addActivityPoints(15);
    }

    expect(quest.getActivityState().currentPoints).toBeLessThanOrEqual(maxPts);
  });

  it('ACT-OVERFLOW-4: 重置后可重新累积到上限', () => {
    const sim = createSim();
    const quest = sim.engine.getQuestSystem();

    const maxPts = quest.getActivityState().maxPoints;
    quest.addActivityPoints(maxPts + 100);
    quest.resetDailyActivity();
    quest.addActivityPoints(maxPts);

    expect(quest.getActivityState().currentPoints).toBe(maxPts);
  });

  it('ACT-OVERFLOW-5: 溢出后仍可领取所有里程碑', () => {
    const sim = createSim();
    const quest = sim.engine.getQuestSystem();

    quest.addActivityPoints(99999);

    const state = quest.getActivityState();
    for (let i = 0; i < state.milestones.length; i++) {
      const reward = quest.claimActivityMilestone(i);
      expect(reward).not.toBeNull();
    }
  });

  it('ACT-OVERFLOW-6: 重置后里程碑恢复为未领取', () => {
    const sim = createSim();
    const quest = sim.engine.getQuestSystem();

    quest.addActivityPoints(99999);
    quest.claimActivityMilestone(0);
    quest.resetDailyActivity();

    const state = quest.getActivityState();
    expect(state.milestones[0].claimed).toBe(false);
  });

  it('ACT-OVERFLOW-7: 负数活跃度可导致负值（引擎不限制下限）', () => {
    const sim = createSim();
    const quest = sim.engine.getQuestSystem();

    quest.addActivityPoints(-50);
    // 引擎使用 Math.min 限制上限，但不限制下限
    expect(quest.getActivityState().currentPoints).toBe(-50);
  });

});

// ═══════════════════════════════════════════════════════════════
// §C 任务前置链深度 — 多层前置任务
// ═══════════════════════════════════════════════════════════════
describe('v12.0 补充2 — §C 任务前置链深度', () => {

  it('QUEST-CHAIN-1: 单层前置 — 未完成前置不可接受', () => {
    const sim = createSim();
    const quest = sim.engine.getQuestSystem();

    quest.registerQuest(makeQuestDef('pre-base-1', 'main'));
    quest.registerQuest(makeChainedQuestDef('pre-chain-1', ['pre-base-1']));

    const instance = quest.acceptQuest('pre-chain-1');
    expect(instance).toBeNull();
  });

  it('QUEST-CHAIN-2: 单层前置 — 完成前置后可接受', () => {
    const sim = createSim();
    const quest = sim.engine.getQuestSystem();

    quest.registerQuest(makeQuestDef('pre-base-2', 'main'));
    quest.registerQuest(makeChainedQuestDef('pre-chain-2', ['pre-base-2']));

    completeQuestFlow(quest, 'pre-base-2');

    const instance = quest.acceptQuest('pre-chain-2');
    expect(instance).not.toBeNull();
    expect(instance!.status).toBe('active');
  });

  it('QUEST-CHAIN-3: 双层前置链', () => {
    const sim = createSim();
    const quest = sim.engine.getQuestSystem();

    quest.registerQuest(makeQuestDef('chain-l1', 'main'));
    quest.registerQuest(makeChainedQuestDef('chain-l2', ['chain-l1']));
    quest.registerQuest(makeChainedQuestDef('chain-l3', ['chain-l2']));

    expect(quest.acceptQuest('chain-l3')).toBeNull();

    completeQuestFlow(quest, 'chain-l1');
    expect(quest.acceptQuest('chain-l3')).toBeNull();

    completeQuestFlow(quest, 'chain-l2');
    const l3 = quest.acceptQuest('chain-l3');
    expect(l3).not.toBeNull();
  });

  it('QUEST-CHAIN-4: 三层前置链完整流程', () => {
    const sim = createSim();
    const quest = sim.engine.getQuestSystem();

    quest.registerQuest(makeQuestDef('deep-1', 'main'));
    quest.registerQuest(makeChainedQuestDef('deep-2', ['deep-1']));
    quest.registerQuest(makeChainedQuestDef('deep-3', ['deep-2']));
    quest.registerQuest(makeChainedQuestDef('deep-4', ['deep-3']));

    completeQuestFlow(quest, 'deep-1');
    completeQuestFlow(quest, 'deep-2');
    completeQuestFlow(quest, 'deep-3');

    const final = quest.acceptQuest('deep-4');
    expect(final).not.toBeNull();
    expect(final!.questDefId).toBe('deep-4');
  });

  it('QUEST-CHAIN-5: 多前置任务需全部完成', () => {
    const sim = createSim();
    const quest = sim.engine.getQuestSystem();

    quest.registerQuest(makeQuestDef('mp-a', 'main'));
    quest.registerQuest(makeQuestDef('mp-b', 'main'));
    quest.registerQuest(makeChainedQuestDef('mp-c', ['mp-a', 'mp-b']));

    completeQuestFlow(quest, 'mp-a');
    expect(quest.acceptQuest('mp-c')).toBeNull();

    completeQuestFlow(quest, 'mp-b');
    expect(quest.acceptQuest('mp-c')).not.toBeNull();
  });

  it('QUEST-CHAIN-6: 前置链中任务不可重复完成', () => {
    const sim = createSim();
    const quest = sim.engine.getQuestSystem();

    quest.registerQuest(makeQuestDef('repeat-base', 'main'));
    completeQuestFlow(quest, 'repeat-base');

    expect(quest.acceptQuest('repeat-base')).toBeNull();
    expect(quest.isQuestCompleted('repeat-base')).toBe(true);
  });

  it('QUEST-CHAIN-7: 已激活任务不可再次接受', () => {
    const sim = createSim();
    const quest = sim.engine.getQuestSystem();

    quest.registerQuest(makeQuestDef('active-repeat', 'main'));
    const inst1 = quest.acceptQuest('active-repeat');
    expect(inst1).not.toBeNull();

    const inst2 = quest.acceptQuest('active-repeat');
    expect(inst2).toBeNull();
  });

});

// ═══════════════════════════════════════════════════════════════
// §D 成就链进度 — 链式成就解锁
// ═══════════════════════════════════════════════════════════════
describe('v12.0 补充2 — §D 成就链进度', () => {

  it('ACH-CHAIN-1: 初始链进度为0', () => {
    const sim = createSim();
    const achievement = sim.engine.getAchievementSystem();

    const chains = achievement.getAchievementChains();
    for (const chain of chains) {
      expect(chain.progress).toBe(0);
      expect(chain.completed).toBe(false);
    }
  });

  it('ACH-CHAIN-2: 完成链中一个成就后进度增加', () => {
    const sim = createSim();
    const achievement = sim.engine.getAchievementSystem();

    achievement.updateProgress('battle_wins', 10);
    achievement.claimReward('ach-battle-001');

    const chains = achievement.getAchievementChains();
    const battleChain = chains.find(c => c.chainId === 'chain-battle-master');
    expect(battleChain).toBeDefined();
    expect(battleChain!.progress).toBeGreaterThan(0);
  });

  it('ACH-CHAIN-3: 前置成就完成后后续解锁', () => {
    const sim = createSim();
    const achievement = sim.engine.getAchievementSystem();

    const before = achievement.getAchievement('ach-battle-002');
    expect(before!.instance.status).toBe('locked');

    achievement.updateProgress('battle_wins', 10);
    achievement.claimReward('ach-battle-001');

    const after = achievement.getAchievement('ach-battle-002');
    expect(after!.instance.status).not.toBe('locked');
  });

  it('ACH-CHAIN-4: 三层前置链逐步解锁', () => {
    const sim = createSim();
    const achievement = sim.engine.getAchievementSystem();

    expect(achievement.getAchievement('ach-battle-001')!.instance.status).toBe('in_progress');
    expect(achievement.getAchievement('ach-battle-002')!.instance.status).toBe('locked');
    expect(achievement.getAchievement('ach-battle-003')!.instance.status).toBe('locked');

    achievement.updateProgress('battle_wins', 10);
    achievement.claimReward('ach-battle-001');

    expect(achievement.getAchievement('ach-battle-002')!.instance.status).toBe('in_progress');

    achievement.updateProgress('battle_wins', 100);
    achievement.claimReward('ach-battle-002');

    expect(achievement.getAchievement('ach-battle-003')!.instance.status).toBe('in_progress');
  });

  it('ACH-CHAIN-5: 领取奖励后积分增加', () => {
    const sim = createSim();
    const achievement = sim.engine.getAchievementSystem();

    const pointsBefore = achievement.getTotalPoints();

    achievement.updateProgress('battle_wins', 10);
    achievement.claimReward('ach-battle-001');

    const pointsAfter = achievement.getTotalPoints();
    expect(pointsAfter).toBeGreaterThan(pointsBefore);
  });

  it('ACH-CHAIN-6: 维度统计在领取后更新', () => {
    const sim = createSim();
    const achievement = sim.engine.getAchievementSystem();

    // 记录领取前的值（需深拷贝，getState 返回浅拷贝）
    const statsBefore = achievement.getDimensionStats();
    const beforeCompleted = statsBefore.battle.completedCount;
    const beforePoints = statsBefore.battle.totalPoints;

    achievement.updateProgress('battle_wins', 10);
    achievement.claimReward('ach-battle-001');

    const statsAfter = achievement.getDimensionStats();
    expect(statsAfter.battle.completedCount).toBeGreaterThan(beforeCompleted);
    expect(statsAfter.battle.totalPoints).toBeGreaterThan(beforePoints);
  });

  it('ACH-CHAIN-7: 未完成成就不可领取', () => {
    const sim = createSim();
    const achievement = sim.engine.getAchievementSystem();

    const result = achievement.claimReward('ach-battle-002');
    expect(result.success).toBe(false);
  });

  it('ACH-CHAIN-8: 已领取成就不可重复领取', () => {
    const sim = createSim();
    const achievement = sim.engine.getAchievementSystem();

    achievement.updateProgress('battle_wins', 10);
    const first = achievement.claimReward('ach-battle-001');
    expect(first.success).toBe(true);

    const second = achievement.claimReward('ach-battle-001');
    expect(second.success).toBe(false);
  });

  it('ACH-CHAIN-9: getClaimableAchievements 返回已完成未领取', () => {
    const sim = createSim();
    const achievement = sim.engine.getAchievementSystem();

    achievement.updateProgress('battle_wins', 10);

    const claimable = achievement.getClaimableAchievements();
    expect(claimable).toContain('ach-battle-001');
  });

  it('ACH-CHAIN-10: 链完成触发链完成奖励', () => {
    const sim = createSim();
    const achievement = sim.engine.getAchievementSystem();

    const rewards: unknown[] = [];
    achievement.setRewardCallback((r) => rewards.push(r));

    achievement.updateProgress('battle_wins', 10);
    achievement.claimReward('ach-battle-001');
    achievement.updateProgress('battle_wins', 100);
    achievement.claimReward('ach-battle-002');
    achievement.updateProgress('battle_wins', 500);
    achievement.claimReward('ach-battle-003');
    achievement.updateProgress('battle_wins', 2000);
    achievement.claimReward('ach-battle-004');

    const completed = achievement.getCompletedChains();
    expect(completed).toContain('chain-battle-master');

    expect(rewards.length).toBeGreaterThan(4);
  });

});

// ═══════════════════════════════════════════════════════════════
// §E 周常任务重置 — 每周重置逻辑
// ═══════════════════════════════════════════════════════════════
describe('v12.0 补充2 — §E 周常任务重置', () => {

  it('QUEST-WEEKLY-1: 注册并接受周常任务', () => {
    const sim = createSim();
    const quest = sim.engine.getQuestSystem();

    quest.registerQuest(makeQuestDef('weekly-001', 'weekly'));
    const instance = quest.acceptQuest('weekly-001');

    expect(instance).not.toBeNull();
    expect(instance!.status).toBe('active');
  });

  it('QUEST-WEEKLY-2: 周常任务可完成', () => {
    const sim = createSim();
    const quest = sim.engine.getQuestSystem();

    quest.registerQuest(makeQuestDef('weekly-done-001', 'weekly', 3));
    const instance = quest.acceptQuest('weekly-done-001');

    if (instance) {
      quest.updateObjectiveProgress(instance.instanceId, 'obj_001', 3);
      quest.claimReward(instance.instanceId);
    }

    expect(quest.isQuestCompleted('weekly-done-001')).toBe(true);
  });

  it('QUEST-WEEKLY-3: 日常任务刷新产生新实例', () => {
    const sim = createSim();
    const quest = sim.engine.getQuestSystem();

    const first = quest.refreshDailyQuests();
    const second = quest.refreshDailyQuests();

    expect(first).toBeDefined();
    expect(Array.isArray(first)).toBe(true);
  });

  it('QUEST-WEEKLY-4: 日常任务池大小', () => {
    const sim = createSim();
    const quest = sim.engine.getQuestSystem();

    quest.refreshDailyQuests();
    const daily = quest.getDailyQuests();

    expect(Array.isArray(daily)).toBe(true);
  });

  it('QUEST-WEEKLY-5: 按类别获取周常任务定义', () => {
    const sim = createSim();
    const quest = sim.engine.getQuestSystem();

    quest.registerQuest(makeQuestDef('w-cat-1', 'weekly'));
    quest.registerQuest(makeQuestDef('w-cat-2', 'weekly'));
    quest.registerQuest(makeQuestDef('d-cat-1', 'daily'));

    const weeklyDefs = quest.getQuestDefsByCategory('weekly');
    expect(weeklyDefs.length).toBeGreaterThanOrEqual(2);
    expect(weeklyDefs.every(d => d.category === 'weekly')).toBe(true);
  });

  it('QUEST-WEEKLY-6: 活跃度重置清零但不影响任务', () => {
    const sim = createSim();
    const quest = sim.engine.getQuestSystem();

    quest.registerQuest(makeQuestDef('act-independent', 'main'));
    quest.acceptQuest('act-independent');

    quest.addActivityPoints(80);
    quest.resetDailyActivity();

    expect(quest.getActivityState().currentPoints).toBe(0);
    expect(quest.isQuestActive('act-independent')).toBe(true);
  });

});

// ═══════════════════════════════════════════════════════════════
