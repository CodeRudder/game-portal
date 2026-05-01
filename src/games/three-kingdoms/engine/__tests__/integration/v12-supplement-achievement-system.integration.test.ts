/**
 * v12.0 任务成就 — 补充集成测试（第三部分：系统与性能）
 *
 * ACH-P1-01 fix: 从 v12-supplement-achievement-boundary.integration.test.ts 拆分而来。
 * 原1008行超标文件拆分为两个文件，本文件包含：
 * - §F AchievementSystem 性能 — 大量成就遍历效率
 * - §G ISubsystem 接口合规
 * - §H 追踪上限与边界
 * - §I 任务进度边界
 *
 * @see docs/games/three-kingdoms/play/v12-play.md
 */

import { describe, it, expect } from 'vitest';
import { createSim } from '../../../test-utils/test-helpers';
import type { QuestCategory, QuestDef } from '../../../core/quest/quest.types';

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

    // 引擎初始化时已有日常任务占据追踪槽位，需先清空
    const existingTracked = quest.getState().trackedQuestIds;
    for (const tid of existingTracked) {
      quest.untrackQuest(tid);
    }

    // 手动追踪前3个任务填满槽位
    if (inst0) {
      expect(quest.trackQuest(inst0.instanceId)).toBe(true);
    }
    quest.trackQuest(quest.getActiveQuests().find(q => q.questDefId === 'track-free-1')?.instanceId ?? '');
    quest.trackQuest(quest.getActiveQuests().find(q => q.questDefId === 'track-free-2')?.instanceId ?? '');

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
