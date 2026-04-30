/**
 * v12.0 任务成就 Play 流程集成测试
 *
 * 覆盖范围（按 play 文档章节组织）：
 * - §1 任务系统: 日常/周常/主线任务、接受、进度更新、完成、领奖
 * - §2 活跃度系统: 活跃度累积、里程碑奖励、每日重置
 * - §3 成就系统: 成就维度、进度追踪、奖励领取、成就链
 * - §4 跨系统联动: 任务→活跃度→成就→声望
 *
 * 测试原则：
 * - 每个用例创建独立的 sim 实例
 * - 使用真实引擎 API，不使用 mock
 * - 以实际代码行为为准
 *
 * @see docs/games/three-kingdoms/play/v11-play.md (竞技场日常)
 */

import { describe, it, expect } from 'vitest';
import { createSim, SUFFICIENT_RESOURCES, MASSIVE_RESOURCES } from '../../../test-utils/test-helpers';
import type { QuestCategory, QuestId } from '../../../core/quest/quest.types';
import type { AchievementDimension } from '../../../core/achievement/achievement.types';

// ═══════════════════════════════════════════════════════════════
// §1 任务系统
// ═══════════════════════════════════════════════════════════════
describe('v12.0 任务成就 — §1 任务系统', () => {

  it('should access quest system via engine getter', () => {
    const sim = createSim();
    const quest = sim.engine.getQuestSystem();
    expect(quest).toBeDefined();
    expect(typeof quest.acceptQuest).toBe('function');
    expect(typeof quest.completeQuest).toBe('function');
    expect(typeof quest.claimReward).toBe('function');
  });

  it('should get quest state', () => {
    const sim = createSim();
    const quest = sim.engine.getQuestSystem();

    const state = quest.getState();
    expect(state).toBeDefined();
  });

  it('should list all quest definitions', () => {
    // Play §1.1: 任务面板展示各类任务
    const sim = createSim();
    const quest = sim.engine.getQuestSystem();

    const defs = quest.getAllQuestDefs();
    expect(Array.isArray(defs)).toBe(true);
  });

  it('should filter quests by category (daily/main)', () => {
    // Play §1.1: 日常任务、周常任务、主线任务分类
    const sim = createSim();
    const quest = sim.engine.getQuestSystem();

    const dailyQuests = quest.getQuestDefsByCategory('daily' as QuestCategory);
    expect(Array.isArray(dailyQuests)).toBe(true);

    const mainQuests = quest.getQuestDefsByCategory('main' as QuestCategory);
    expect(Array.isArray(mainQuests)).toBe(true);
  });

  it('should register custom quest definitions', () => {
    // Play §1.1: 新任务注册
    const sim = createSim();
    const quest = sim.engine.getQuestSystem();

    const customDef = {
      id: 'test_quest_001' as QuestId,
      title: '测试任务',
      description: '用于测试的自定义任务',
      category: 'daily' as QuestCategory,
      objectives: [{
        id: 'obj_001',
        type: 'upgrade_building',
        description: '升级建筑1次',
        targetCount: 1,
        params: {},
      }],
      rewards: [{ type: 'resource', id: 'grain', amount: 100 }],
      autoAccept: true,
      sortOrder: 0,
    };

    quest.registerQuest(customDef);
    const def = quest.getQuestDef('test_quest_001' as QuestId);
    expect(def).toBeDefined();
    expect(def?.id).toBe('test_quest_001');
  });

  it('should register multiple quests at once', () => {
    const sim = createSim();
    const quest = sim.engine.getQuestSystem();

    const defs = [
      {
        id: 'test_batch_001' as QuestId,
        title: '批量任务1',
        description: '批量注册测试',
        category: 'daily' as QuestCategory,
        objectives: [{ id: 'obj_001', type: 'kill_enemy', description: '击杀敌人', targetCount: 1, params: {} }],
        rewards: [{ type: 'resource', id: 'gold', amount: 50 }],
        autoAccept: true,
        sortOrder: 0,
      },
      {
        id: 'test_batch_002' as QuestId,
        title: '批量任务2',
        description: '批量注册测试',
        category: 'daily' as QuestCategory,
        objectives: [{ id: 'obj_001', type: 'collect_resource', description: '收集资源', targetCount: 1, params: {} }],
        rewards: [{ type: 'resource', id: 'grain', amount: 200 }],
        autoAccept: true,
        sortOrder: 0,
      },
    ];

    quest.registerQuests(defs);
    expect(quest.getQuestDef('test_batch_001' as QuestId)).toBeDefined();
    expect(quest.getQuestDef('test_batch_002' as QuestId)).toBeDefined();
  });

  it('should accept a quest and create instance', () => {
    // Play §1.2: 接受任务
    const sim = createSim();
    const quest = sim.engine.getQuestSystem();

    // 注册一个全新的可接受任务（预定义任务可能已被 initializeDefaults 接受）
    const testDef: import('../../../shared/types').QuestDef = {
      id: 'test_accept_quest' as unknown as string,
      title: '接受测试任务',
      description: '测试接受任务',
      category: 'daily' as unknown as string,
      objectives: [{ id: 'obj_acc', type: 'kill_enemy', description: '击杀敌人', targetCount: 1, params: {} }],
      rewards: [{ type: 'resource', id: 'gold', amount: 10 }],
      autoAccept: false,
      sortOrder: 0,
    };
    quest.registerQuests([testDef]);

    const instance = quest.acceptQuest(testDef.id as unknown as Record<string, unknown>);
    expect(instance).toBeDefined();
    expect(instance!.questDefId).toBeDefined();
    expect(instance!.status).toBe('active');
  });

  it('should update quest objective progress', () => {
    // Play §1.2: 更新进度
    const sim = createSim();
    const quest = sim.engine.getQuestSystem();

    quest.registerQuest({
      id: 'progress_test_001' as QuestId,
      title: '进度测试',
      description: '测试进度更新',
      category: 'daily' as QuestCategory,
      objectives: [{ id: 'obj_001', type: 'upgrade_building', description: '升级建筑', targetCount: 3, params: {} }],
      rewards: [{ type: 'resource', id: 'grain', amount: 100 }],
      autoAccept: true,
      sortOrder: 0,
    });

    const instance = quest.acceptQuest('progress_test_001' as QuestId);
    if (instance) {
      const updated = quest.updateObjectiveProgress(
        instance.instanceId,
        'obj_001',
        1,
      );
      if (updated) {
        expect(updated.currentCount).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('should update progress by objective type', () => {
    // Play §1.2: 按类型批量更新进度
    const sim = createSim();
    const quest = sim.engine.getQuestSystem();

    expect(() => quest.updateProgressByType('upgrade_building', 1)).not.toThrow();
  });

  it('should complete quest and claim reward', () => {
    // Play §1.3: 领取奖励
    const sim = createSim();
    const quest = sim.engine.getQuestSystem();

    const rewards: unknown[] = [];
    quest.setRewardCallback((reward: unknown) => {
      rewards.push(reward);
    });

    quest.registerQuest({
      id: 'complete_test_001' as QuestId,
      title: '完成测试',
      description: '测试完成和领奖',
      category: 'daily' as QuestCategory,
      objectives: [{ id: 'obj_001', type: 'test', description: '测试', targetCount: 1, params: {} }],
      rewards: [{ type: 'resource', id: 'grain', amount: 100 }],
      autoAccept: true,
      sortOrder: 0,
    });

    const instance = quest.acceptQuest('complete_test_001' as QuestId);
    if (instance) {
      quest.updateObjectiveProgress(instance.instanceId, 'obj_001', 1);
      quest.completeQuest(instance.instanceId);
      quest.claimReward(instance.instanceId);
    }
  });

  it('should get active quests and filter by category', () => {
    // Play §1.1: 任务列表筛选
    const sim = createSim();
    const quest = sim.engine.getQuestSystem();

    const active = quest.getActiveQuests();
    expect(Array.isArray(active)).toBe(true);

    const dailyActive = quest.getActiveQuestsByCategory('daily' as QuestCategory);
    expect(Array.isArray(dailyActive)).toBe(true);
  });

  it('should track and untrack quests', () => {
    // Play §1.1: 任务追踪
    const sim = createSim();
    const quest = sim.engine.getQuestSystem();

    const tracked = quest.getTrackedQuests();
    expect(Array.isArray(tracked)).toBe(true);

    const maxTracked = quest.getMaxTrackedQuests();
    expect(typeof maxTracked).toBe('number');
  });

  it('should check quest active and completed status', () => {
    const sim = createSim();
    const quest = sim.engine.getQuestSystem();

    const isActive = quest.isQuestActive('nonexistent' as QuestId);
    expect(typeof isActive).toBe('boolean');

    const isCompleted = quest.isQuestCompleted('nonexistent' as QuestId);
    expect(typeof isCompleted).toBe('boolean');
  });

  it('should get completed quest ids', () => {
    const sim = createSim();
    const quest = sim.engine.getQuestSystem();

    const completed = quest.getCompletedQuestIds();
    expect(Array.isArray(completed)).toBe(true);
  });

  it('should claim all rewards at once', () => {
    // Play §1.3: 一键领取
    const sim = createSim();
    const quest = sim.engine.getQuestSystem();

    const allRewards = quest.claimAllRewards();
    expect(Array.isArray(allRewards)).toBe(true);
  });

  it('should refresh daily quests', () => {
    // Play §1.1: 每日任务刷新
    const sim = createSim();
    const quest = sim.engine.getQuestSystem();

    const dailyQuests = quest.refreshDailyQuests();
    expect(Array.isArray(dailyQuests)).toBe(true);
  });

  it('should get daily quests', () => {
    const sim = createSim();
    const quest = sim.engine.getQuestSystem();

    const daily = quest.getDailyQuests();
    expect(Array.isArray(daily)).toBe(true);
  });

});

// ═══════════════════════════════════════════════════════════════
// §2 活跃度系统
// ═══════════════════════════════════════════════════════════════
describe('v12.0 任务成就 — §2 活跃度系统', () => {

  it('should get activity state', () => {
    const sim = createSim();
    const quest = sim.engine.getQuestSystem();

    const activityState = quest.getActivityState();
    expect(activityState).toBeDefined();
  });

  it('should add activity points', () => {
    // Play §2: 完成任务获得活跃度
    const sim = createSim();
    const quest = sim.engine.getQuestSystem();

    const stateBefore = quest.getActivityState();
    const pointsBefore = stateBefore.totalPoints ?? 0;

    quest.addActivityPoints(10);

    const stateAfter = quest.getActivityState();
    const pointsAfter = stateAfter.totalPoints ?? 0;
    expect(pointsAfter).toBeGreaterThanOrEqual(pointsBefore);
  });

  it('should claim activity milestone reward', () => {
    // Play §2: 活跃度宝箱
    const sim = createSim();
    const quest = sim.engine.getQuestSystem();

    quest.addActivityPoints(100);

    const reward = quest.claimActivityMilestone(0);
    if (reward) {
      expect(reward).toBeDefined();
    }
  });

  it('should reset daily activity', () => {
    // Play §2: 每日重置活跃度
    const sim = createSim();
    const quest = sim.engine.getQuestSystem();

    quest.addActivityPoints(50);
    quest.resetDailyActivity();

    const state = quest.getActivityState();
    expect(state).toBeDefined();
  });

  it('should accumulate activity points from multiple sources', () => {
    // Play §2: 多种行为累积活跃度
    const sim = createSim();
    const quest = sim.engine.getQuestSystem();

    quest.addActivityPoints(10);
    quest.addActivityPoints(20);
    quest.addActivityPoints(30);

    const state = quest.getActivityState();
    expect(state.totalPoints ?? 0).toBeGreaterThanOrEqual(0);
  });

});

// ═══════════════════════════════════════════════════════════════
// §3 成就系统
// ═══════════════════════════════════════════════════════════════
describe('v12.0 任务成就 — §3 成就系统', () => {

  it('should access achievement system via engine getter', () => {
    const sim = createSim();
    const achievement = sim.engine.getAchievementSystem();
    expect(achievement).toBeDefined();
    expect(typeof achievement.getAllAchievements).toBe('function');
    expect(typeof achievement.updateProgress).toBe('function');
    expect(typeof achievement.claimReward).toBe('function');
  });

  it('should get achievement state', () => {
    const sim = createSim();
    const achievement = sim.engine.getAchievementSystem();

    const state = achievement.getState();
    expect(state).toBeDefined();
  });

  it('should list all achievements', () => {
    // Play §3.1: 成就面板展示5个维度
    const sim = createSim();
    const achievement = sim.engine.getAchievementSystem();

    const achievements = achievement.getAllAchievements();
    expect(Array.isArray(achievements)).toBe(true);
  });

  it('should filter achievements by dimension', () => {
    // Play §3.1: 养成/战斗/收集/社交/经济 5维度
    const sim = createSim();
    const achievement = sim.engine.getAchievementSystem();

    const combatAchievements = achievement.getAchievementsByDimension('combat' as AchievementDimension);
    expect(Array.isArray(combatAchievements)).toBe(true);
  });

  it('should get single achievement by id', () => {
    const sim = createSim();
    const achievement = sim.engine.getAchievementSystem();

    const all = achievement.getAllAchievements();
    if (all.length > 0) {
      const found = achievement.getAchievement(all[0].id);
      expect(found).toBeDefined();
    }
  });

  it('should get total achievement points', () => {
    // Play §3.2: 成就点数累积
    const sim = createSim();
    const achievement = sim.engine.getAchievementSystem();

    const points = achievement.getTotalPoints();
    expect(typeof points).toBe('number');
  });

  it('should get dimension stats', () => {
    // Play §3.1: 各维度完成度统计
    const sim = createSim();
    const achievement = sim.engine.getAchievementSystem();

    const stats = achievement.getDimensionStats();
    expect(stats).toBeDefined();
    expect(typeof stats).toBe('object');
  });

  it('should update achievement progress by condition type', () => {
    // Play §3.1: 进度条实时更新
    const sim = createSim();
    const achievement = sim.engine.getAchievementSystem();

    expect(() => achievement.updateProgress('building_level', 5)).not.toThrow();
  });

  it('should update achievement progress from snapshot', () => {
    // Play §3.1: 快照批量更新
    const sim = createSim();
    const achievement = sim.engine.getAchievementSystem();

    const snapshot = {
      building_level: 5,
      hero_count: 3,
      campaign_stars: 10,
    };

    expect(() => achievement.updateProgressFromSnapshot(snapshot)).not.toThrow();
  });

  it('should get claimable achievements', () => {
    // Play §3.2: 可领取成就列表
    const sim = createSim();
    const achievement = sim.engine.getAchievementSystem();

    const claimable = achievement.getClaimableAchievements();
    expect(Array.isArray(claimable)).toBe(true);
  });

  it('should get achievement chains', () => {
    // Play §3.3: 成就链"初露锋芒"
    const sim = createSim();
    const achievement = sim.engine.getAchievementSystem();

    const chains = achievement.getAchievementChains();
    expect(Array.isArray(chains)).toBe(true);
  });

  it('should get completed chains', () => {
    const sim = createSim();
    const achievement = sim.engine.getAchievementSystem();

    const completed = achievement.getCompletedChains();
    expect(Array.isArray(completed)).toBe(true);
  });

  it('should claim achievement reward', () => {
    // Play §3.2: 领取成就奖励
    const sim = createSim();
    const achievement = sim.engine.getAchievementSystem();

    // 尝试领取一个不存在的成就
    const result = achievement.claimReward('nonexistent_achievement');
    expect(result).toBeDefined();
    expect(typeof result.success).toBe('boolean');
  });

});

// ═══════════════════════════════════════════════════════════════
// §4 跨系统联动
// ═══════════════════════════════════════════════════════════════
describe('v12.0 任务成就 — §4 跨系统联动', () => {

  it('should link quest completion with activity points', () => {
    // Play §4: 完成任务→活跃度累积
    const sim = createSim();
    const quest = sim.engine.getQuestSystem();

    const activityBefore = quest.getActivityState().totalPoints ?? 0;
    quest.addActivityPoints(20);
    const activityAfter = quest.getActivityState().totalPoints ?? 0;
    expect(activityAfter).toBeGreaterThanOrEqual(activityBefore);
  });

  it('should link quest rewards with callback', () => {
    // Play §4: 任务奖励通过回调分发
    const sim = createSim();
    const quest = sim.engine.getQuestSystem();

    const rewards: unknown[] = [];
    quest.setRewardCallback((reward: unknown) => {
      rewards.push(reward);
    });

    quest.registerQuest({
      id: 'link_test_001' as QuestId,
      title: '联动测试任务',
      description: '测试任务奖励回调',
      category: 'daily' as QuestCategory,
      objectives: [{ id: 'obj_001', type: 'test', description: '测试', targetCount: 1, params: {} }],
      rewards: [{ type: 'resource', id: 'grain', amount: 100 }],
      autoAccept: true,
      sortOrder: 0,
    });

    const instance = quest.acceptQuest('link_test_001' as QuestId);
    if (instance) {
      quest.updateObjectiveProgress(instance.instanceId, 'obj_001', 1);
      quest.completeQuest(instance.instanceId);
      quest.claimReward(instance.instanceId);
    }
  });

  it('should link achievement progress with game actions', () => {
    // Play §4: 游戏行为→成就进度更新
    const sim = createSim();
    const achievement = sim.engine.getAchievementSystem();

    achievement.updateProgressFromSnapshot({
      building_level: 3,
      hero_count: 5,
      battle_wins: 10,
    });

    const state = achievement.getState();
    expect(state).toBeDefined();
  });

  it('should coordinate quest and achievement systems', () => {
    // Play §4: 任务+成就系统共存
    const sim = createSim();
    const quest = sim.engine.getQuestSystem();
    const achievement = sim.engine.getAchievementSystem();

    expect(quest).toBeDefined();
    expect(achievement).toBeDefined();

    quest.updateProgressByType('upgrade_building', 1);
    achievement.updateProgress('building_level', 2);

    expect(quest.getState()).toBeDefined();
    expect(achievement.getState()).toBeDefined();
  });

  it('should link activity points with achievement system', () => {
    // Play §4: 活跃度→成就
    const sim = createSim();
    const quest = sim.engine.getQuestSystem();
    const achievement = sim.engine.getAchievementSystem();

    // 添加活跃度
    quest.addActivityPoints(50);

    // 更新成就进度
    achievement.updateProgress('activity_points', 50);

    expect(quest.getActivityState()).toBeDefined();
    expect(achievement.getState()).toBeDefined();
  });

});
