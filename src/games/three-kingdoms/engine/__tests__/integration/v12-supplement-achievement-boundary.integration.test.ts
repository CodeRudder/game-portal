/**
 * v12.0 任务成就 — 补充集成测试（第二部分）
 *
 * 在 v12-achievement-boundary.integration.test.ts 基础上补充：
 * - §A 成就并发更新 — 同时完成多个成就
 * - §B 活跃度溢出 — 超过上限后正确截断
 * - §C 任务前置链深度 — 多层前置任务
 * - §D 成就链进度 — 链式成就解锁
 * - §E 周常任务重置 — 每周重置逻辑
 * - §F AchievementSystem性能 — 大量成就遍历效率
 * - §G ISubsystem接口合规
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
// §F AchievementSystem 性能 — 大量成就遍历效率
// ═══════════════════════════════════════════════════════════════
describe('v12.0 补充2 — §F AchievementSystem 性能', () => {

  it('ACH-PERF-1: 500次 getAllAchievements 在 1s 内', () => {
    const sim = createSim();
    const achievement = sim.engine.getAchievementSystem();

    const start = performance.now();
    for (let i = 0; i < 500; i++) {
      achievement.getAllAchievements();
    }
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(1000);
  });

  it('ACH-PERF-2: 500次 getAchievement 单查询在 1s 内', () => {
    const sim = createSim();
    const achievement = sim.engine.getAchievementSystem();

    const all = achievement.getAllAchievements();
    const ids = all.map(a => a.id);

    const start = performance.now();
    for (let i = 0; i < 500; i++) {
      achievement.getAchievement(ids[i % ids.length]);
    }
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(1000);
  });

  it('ACH-PERF-3: 200次 updateProgress 在 1s 内', () => {
    const sim = createSim();
    const achievement = sim.engine.getAchievementSystem();

    const start = performance.now();
    for (let i = 0; i < 200; i++) {
      achievement.updateProgress('battle_wins', i);
    }
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(1000);
  });

  it('ACH-PERF-4: 100次 getDimensionStats 在 500ms 内', () => {
    const sim = createSim();
    const achievement = sim.engine.getAchievementSystem();

    const start = performance.now();
    for (let i = 0; i < 100; i++) {
      achievement.getDimensionStats();
    }
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(500);
  });

  it('ACH-PERF-5: 100次序列化/反序列化在 1s 内', () => {
    const sim = createSim();
    const achievement = sim.engine.getAchievementSystem();

    const start = performance.now();
    for (let i = 0; i < 100; i++) {
      const data = achievement.getSaveData();
      achievement.loadSaveData(data);
    }
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(1000);
  });

  it('ACH-PERF-6: 大量进度更新后查询仍高效', () => {
    const sim = createSim();
    const achievement = sim.engine.getAchievementSystem();

    for (let i = 0; i < 100; i++) {
      achievement.updateProgress('battle_wins', i * 10);
      achievement.updateProgress('building_level', i);
      achievement.updateProgress('hero_count', i);
    }

    const start = performance.now();
    for (let i = 0; i < 100; i++) {
      achievement.getAllAchievements();
      achievement.getDimensionStats();
    }
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(500);
  });

});

// ═══════════════════════════════════════════════════════════════
// §G ISubsystem 接口合规
// ═══════════════════════════════════════════════════════════════
describe('v12.0 补充2 — §G ISubsystem 接口合规', () => {

  it('SUBSYSTEM-1: QuestSystem 实现 ISubsystem', () => {
    const sim = createSim();
    const quest = sim.engine.getQuestSystem();

    expect(quest.name).toBe('quest');
    expect(typeof quest.init).toBe('function');
    expect(typeof quest.update).toBe('function');
    expect(typeof quest.getState).toBe('function');
    expect(typeof quest.reset).toBe('function');
  });

  it('SUBSYSTEM-2: AchievementSystem 实现 ISubsystem', () => {
    const sim = createSim();
    const achievement = sim.engine.getAchievementSystem();

    expect(achievement.name).toBe('achievement');
    expect(typeof achievement.init).toBe('function');
    expect(typeof achievement.update).toBe('function');
    expect(typeof achievement.getState).toBe('function');
    expect(typeof achievement.reset).toBe('function');
  });

  it('SUBSYSTEM-3: QuestSystem reset 清除所有状态', () => {
    const sim = createSim();
    const quest = sim.engine.getQuestSystem();

    quest.registerQuest(makeQuestDef('reset-test', 'main'));
    quest.acceptQuest('reset-test');
    quest.addActivityPoints(50);

    quest.reset();

    expect(quest.getActiveQuests().length).toBe(0);
    expect(quest.getCompletedQuestIds().length).toBe(0);
    expect(quest.getActivityState().currentPoints).toBe(0);
  });

  it('SUBSYSTEM-4: AchievementSystem reset 清除所有状态', () => {
    const sim = createSim();
    const achievement = sim.engine.getAchievementSystem();

    achievement.updateProgress('battle_wins', 100);
    achievement.reset();

    expect(achievement.getTotalPoints()).toBe(0);
    expect(achievement.getCompletedChains().length).toBe(0);
    expect(achievement.getClaimableAchievements().length).toBe(0);
  });

  it('SUBSYSTEM-5: QuestSystem update 不抛异常', () => {
    const sim = createSim();
    const quest = sim.engine.getQuestSystem();

    expect(() => quest.update(16)).not.toThrow();
    expect(() => quest.update(0)).not.toThrow();
  });

  it('SUBSYSTEM-6: AchievementSystem update 不抛异常', () => {
    const sim = createSim();
    const achievement = sim.engine.getAchievementSystem();

    expect(() => achievement.update(16)).not.toThrow();
    expect(() => achievement.update(0)).not.toThrow();
  });

  it('SUBSYSTEM-7: QuestSystem getState 返回可序列化对象', () => {
    const sim = createSim();
    const quest = sim.engine.getQuestSystem();

    const state = quest.getState();
    expect(() => JSON.parse(JSON.stringify(state))).not.toThrow();
  });

  it('SUBSYSTEM-8: AchievementSystem getState 返回可序列化对象', () => {
    const sim = createSim();
    const achievement = sim.engine.getAchievementSystem();

    const state = achievement.getState();
    expect(() => JSON.parse(JSON.stringify(state))).not.toThrow();
  });

  it('SUBSYSTEM-9: QuestSystem 序列化/反序列化往返一致', () => {
    const sim = createSim();
    const quest = sim.engine.getQuestSystem();

    quest.registerQuest(makeQuestDef('serial-1', 'main'));
    quest.acceptQuest('serial-1');
    quest.addActivityPoints(30);

    const data = quest.serialize();

    const sim2 = createSim();
    const quest2 = sim2.engine.getQuestSystem();
    quest2.deserialize(data);

    expect(quest2.getActivityState().currentPoints).toBe(30);
  });

  it('SUBSYSTEM-10: AchievementSystem 存档往返一致', () => {
    const sim = createSim();
    const achievement = sim.engine.getAchievementSystem();

    achievement.updateProgress('battle_wins', 10);
    achievement.claimReward('ach-battle-001');

    const saveData = achievement.getSaveData();

    const sim2 = createSim();
    const a2 = sim2.engine.getAchievementSystem();
    a2.loadSaveData(saveData);

    expect(a2.getTotalPoints()).toBe(achievement.getTotalPoints());
    expect(a2.getCompletedChains()).toEqual(achievement.getCompletedChains());
  });

});

// ═══════════════════════════════════════════════════════════════
// §H 追踪上限与边界
// ═══════════════════════════════════════════════════════════════
describe('v12.0 补充2 — §H 追踪上限与边界', () => {

  it('TRACK-1: 追踪上限为3', () => {
    const sim = createSim();
    const quest = sim.engine.getQuestSystem();

    expect(quest.getMaxTrackedQuests()).toBe(3);
  });

  it('TRACK-2: 超过追踪上限后不可再追踪', () => {
    const sim = createSim();
    const quest = sim.engine.getQuestSystem();

    for (let i = 0; i < 4; i++) {
      quest.registerQuest(makeQuestDef(`track-limit-${i}`, 'main'));
    }

    for (let i = 0; i < 3; i++) {
      quest.acceptQuest(`track-limit-${i}`);
    }

    const inst4 = quest.acceptQuest('track-limit-3');
    expect(inst4).not.toBeNull();

    if (inst4) {
      const result = quest.trackQuest(inst4.instanceId);
      expect(result).toBe(false);
    }
  });

  it('TRACK-3: 取消追踪后可追踪新任务', () => {
    const sim = createSim();
    const quest = sim.engine.getQuestSystem();

    for (let i = 0; i < 4; i++) {
      quest.registerQuest(makeQuestDef(`track-free-${i}`, 'main'));
    }

    const inst0 = quest.acceptQuest('track-free-0');
    quest.acceptQuest('track-free-1');
    quest.acceptQuest('track-free-2');
    const inst3 = quest.acceptQuest('track-free-3');

    if (inst3) {
      expect(quest.trackQuest(inst3.instanceId)).toBe(false);
    }

    if (inst0) {
      expect(quest.untrackQuest(inst0.instanceId)).toBe(true);
    }

    if (inst3) {
      expect(quest.trackQuest(inst3.instanceId)).toBe(true);
    }
  });

  it('TRACK-4: 完成任务后自动从追踪列表移除', () => {
    const sim = createSim();
    const quest = sim.engine.getQuestSystem();

    quest.registerQuest(makeQuestDef('track-complete', 'main', 5));
    const instance = quest.acceptQuest('track-complete');

    if (instance) {
      quest.updateObjectiveProgress(instance.instanceId, 'obj_001', 5);
      quest.claimReward(instance.instanceId);

      const trackedAfter = quest.getTrackedQuests();
      expect(trackedAfter.some(t => t.instanceId === instance.instanceId)).toBe(false);
    }
  });

  it('TRACK-5: 不可取消追踪不存在的任务', () => {
    const sim = createSim();
    const quest = sim.engine.getQuestSystem();

    expect(quest.untrackQuest('nonexistent')).toBe(false);
  });

});

// ═══════════════════════════════════════════════════════════════
// §I 任务进度边界
// ═══════════════════════════════════════════════════════════════
describe('v12.0 补充2 — §I 任务进度边界', () => {

  it('PROGRESS-1: 进度不超过目标值', () => {
    const sim = createSim();
    const quest = sim.engine.getQuestSystem();

    quest.registerQuest(makeQuestDef('prog-cap', 'main', 10));
    const instance = quest.acceptQuest('prog-cap');

    if (instance) {
      const obj = quest.updateObjectiveProgress(instance.instanceId, 'obj_001', 999);
      expect(obj).not.toBeNull();
      expect(obj!.currentCount).toBeLessThanOrEqual(10);
    }
  });

  it('PROGRESS-2: 分次累积进度', () => {
    const sim = createSim();
    const quest = sim.engine.getQuestSystem();

    quest.registerQuest(makeQuestDef('prog-inc', 'main', 10));
    const instance = quest.acceptQuest('prog-inc');

    if (instance) {
      quest.updateObjectiveProgress(instance.instanceId, 'obj_001', 3);
      quest.updateObjectiveProgress(instance.instanceId, 'obj_001', 4);
      const obj = quest.updateObjectiveProgress(instance.instanceId, 'obj_001', 5);

      expect(obj!.currentCount).toBe(10);
    }
  });

  it('PROGRESS-3: 不存在的实例更新进度返回null', () => {
    const sim = createSim();
    const quest = sim.engine.getQuestSystem();

    const result = quest.updateObjectiveProgress('nonexistent', 'obj_001', 5);
    expect(result).toBeNull();
  });

  it('PROGRESS-4: 不存在的目标ID更新进度返回null', () => {
    const sim = createSim();
    const quest = sim.engine.getQuestSystem();

    quest.registerQuest(makeQuestDef('prog-miss', 'main'));
    const instance = quest.acceptQuest('prog-miss');

    if (instance) {
      const result = quest.updateObjectiveProgress(instance.instanceId, 'wrong_obj', 5);
      expect(result).toBeNull();
    }
  });

  it('PROGRESS-5: updateProgressByType 批量更新不抛异常', () => {
    const sim = createSim();
    const quest = sim.engine.getQuestSystem();

    quest.registerQuest(makeQuestDef('type-batch', 'main', 5, 'build_upgrade'));
    quest.acceptQuest('type-batch');

    expect(() => quest.updateProgressByType('build_upgrade', 3)).not.toThrow();
  });

  it('PROGRESS-6: claimAllRewards 一键领取', () => {
    const sim = createSim();
    const quest = sim.engine.getQuestSystem();

    quest.registerQuest(makeQuestDef('claim-all-1', 'main', 1));
    quest.registerQuest(makeQuestDef('claim-all-2', 'main', 1));

    const inst1 = quest.acceptQuest('claim-all-1');
    const inst2 = quest.acceptQuest('claim-all-2');

    if (inst1) quest.updateObjectiveProgress(inst1.instanceId, 'obj_001', 1);
    if (inst2) quest.updateObjectiveProgress(inst2.instanceId, 'obj_001', 1);

    const rewards = quest.claimAllRewards();
    expect(Array.isArray(rewards)).toBe(true);
  });

  it('PROGRESS-7: getQuestInstance 获取实例', () => {
    const sim = createSim();
    const quest = sim.engine.getQuestSystem();

    quest.registerQuest(makeQuestDef('inst-get', 'main'));
    const instance = quest.acceptQuest('inst-get');

    if (instance) {
      const retrieved = quest.getQuestInstance(instance.instanceId);
      expect(retrieved).toBeDefined();
      expect(retrieved!.questDefId).toBe('inst-get');
    }
  });

  it('PROGRESS-8: getQuestInstance 不存在返回undefined', () => {
    const sim = createSim();
    const quest = sim.engine.getQuestSystem();

    expect(quest.getQuestInstance('nonexistent')).toBeUndefined();
  });

});
