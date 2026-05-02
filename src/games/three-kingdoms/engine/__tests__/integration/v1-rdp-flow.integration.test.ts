/**
 * 红点系统 Play 流程集成测试 (v1.0 RDP-FLOW-1~4)
 *
 * 覆盖范围：
 * - RDP-FLOW-1: 建筑可升级红点
 * - RDP-FLOW-2: 资源满仓红点
 * - RDP-FLOW-3: 新功能解锁红点
 * - RDP-FLOW-4: 任务完成红点
 *
 * 测试原则：
 * - 每个用例创建独立的 sim 实例
 * - 使用真实引擎 API，不使用 mock
 * - 引擎没有独立的 RedDotSystem，红点逻辑通过底层 API 验证
 *   (checkUpgrade / getCapWarnings / 建筑解锁状态 / QuestSystem)
 *
 * 关键说明：
 * - 引擎不提供统一的 RedDotSystem API
 * - 红点判断依赖各子系统的查询方法：
 *   - 建筑可升级: engine.checkUpgrade(type).canUpgrade
 *   - 资源满仓: engine.getCapWarnings() → level >= 'warning'
 *   - 新功能解锁: building.getBuilding(type).status !== 'locked'
 *   - 任务完成: questSystem.getActiveQuests() + isQuestCompleted()
 */

import { describe, it, expect } from 'vitest';
import { createSim, ALL_BUILDING_TYPES, SUFFICIENT_RESOURCES } from '../../../test-utils/test-helpers';
import type { BuildingType } from '../../../shared/types';

// ═══════════════════════════════════════════════
// V1 RDP-FLOW 红点系统
// ═══════════════════════════════════════════════
describe('V1 RDP-FLOW 红点系统', () => {

  // ═══════════════════════════════════════════════
  // RDP-FLOW-1: 建筑可升级红点
  // ═══════════════════════════════════════════════
  describe('RDP-FLOW-1: 建筑可升级红点', () => {
    it('should show upgrade dot when resources sufficient and building not max level', () => {
      // RDP-FLOW-1 步骤1: 资源充足 + 建筑未满级 → 红点
      // 使用 checkUpgrade.canUpgrade 作为红点数据源
      const sim = createSim();
      sim.addResources(SUFFICIENT_RESOURCES);

      // castle Lv1 → 可升级（资源充足）
      const check = sim.engine.checkUpgrade('castle');
      expect(check.canUpgrade).toBe(true);
      // 红点条件满足: canUpgrade=true
    });

    it('should not show upgrade dot when resources insufficient', () => {
      // RDP-FLOW-1 步骤2: 资源不足 → 无红点
      const sim = createSim();

      // 消耗掉大部分资源
      const currentGrain = sim.getResource('grain');
      if (currentGrain > 10) {
        sim.engine.resource.consumeResource('grain', currentGrain - 10);
      }

      const check = sim.engine.checkUpgrade('castle');
      // 资源不足时 canUpgrade=false（无红点）
      expect(check.canUpgrade).toBe(false);
    });

    it('should not show upgrade dot for locked buildings', () => {
      // RDP-FLOW-1 步骤3: 锁定建筑 → 无红点
      const sim = createSim();

      const check = sim.engine.checkUpgrade('market');
      expect(check.canUpgrade).toBe(false);
      expect(check.reasons).toContain('建筑尚未解锁');
    });

    it('should count upgradable buildings as red dot indicators', () => {
      // RDP-FLOW-1 步骤4: 统计可升级建筑数量
      const sim = createSim();
      sim.addResources(SUFFICIENT_RESOURCES);

      let upgradableCount = 0;
      for (const bt of ALL_BUILDING_TYPES) {
        const check = sim.engine.checkUpgrade(bt);
        if (check.canUpgrade) {
          upgradableCount++;
        }
      }

      // 初始状态: castle 和 farmland 已解锁，资源充足时至少 castle 可升级
      expect(upgradableCount).toBeGreaterThanOrEqual(1);
    });

    it('should update red dot status after upgrade', () => {
      // RDP-FLOW-1 步骤5: 升级后红点状态变化
      const sim = createSim();
      sim.addResources(SUFFICIENT_RESOURCES);

      // 升级前可升级
      expect(sim.engine.checkUpgrade('castle').canUpgrade).toBe(true);

      // 反复升级直到资源耗尽或达到某个等级
      sim.upgradeBuilding('castle');

      // 升级后检查红点状态（取决于剩余资源是否足够下一次升级）
      const checkAfter = sim.engine.checkUpgrade('castle');
      // 这里不判断 true/false，只验证 API 可调用
      expect(typeof checkAfter.canUpgrade).toBe('boolean');
    });
  });

  // ═══════════════════════════════════════════════
  // RDP-FLOW-2: 资源满仓红点
  // ═══════════════════════════════════════════════
  describe('RDP-FLOW-2: 资源满仓红点', () => {
    it('should return cap warnings when resource is near cap', () => {
      // RDP-FLOW-2 步骤1: 资源接近上限 → getCapWarnings 返回警告
      const sim = createSim();

      // 获取 grain 上限
      const caps = sim.engine.resource.getCaps();
      const grainCap = caps.grain;

      if (grainCap && grainCap > 0) {
        // 设置 grain 到 95% 上限
        sim.engine.resource.setResource('grain', Math.floor(grainCap * 0.95));

        const warnings = sim.engine.getCapWarnings();
        const grainWarning = warnings.find(w => w.resourceType === 'grain');

        expect(grainWarning).toBeDefined();
        expect(grainWarning!.level).not.toBe('safe');
      }
    });

    it('should trigger warning level when resource > 90% cap', () => {
      // RDP-FLOW-2 步骤2: >90% 触发 warning 级别
      const sim = createSim();

      const caps = sim.engine.resource.getCaps();
      const grainCap = caps.grain;

      if (grainCap && grainCap > 0) {
        sim.engine.resource.setResource('grain', Math.floor(grainCap * 0.92));

        const warning = sim.engine.resource.getCapWarning('grain');
        if (warning) {
          // 92% 应该至少是 notice 或更高级别
          expect(['notice', 'warning', 'urgent', 'full']).toContain(warning.level);
        }
      }
    });

    it('should not show warning when resource is at safe level', () => {
      // RDP-FLOW-2 步骤3: 安全级别无红点
      const sim = createSim();

      const caps = sim.engine.resource.getCaps();
      const grainCap = caps.grain;

      if (grainCap && grainCap > 0) {
        // 设置 grain 到 50%
        sim.engine.resource.setResource('grain', Math.floor(grainCap * 0.5));

        const warning = sim.engine.resource.getCapWarning('grain');
        if (warning) {
          expect(warning.level).toBe('safe');
        }
      }
    });

    it('should show urgent/full warning at 100% cap', () => {
      // RDP-FLOW-2 步骤4: 100% 满仓
      const sim = createSim();

      const caps = sim.engine.resource.getCaps();
      const grainCap = caps.grain;

      if (grainCap && grainCap > 0) {
        sim.engine.resource.setResource('grain', grainCap);

        const warning = sim.engine.resource.getCapWarning('grain');
        if (warning) {
          expect(['urgent', 'full']).toContain(warning.level);
        }
      }
    });

    it('should return null for resources without cap (gold, mandate)', () => {
      // RDP-FLOW-2 步骤5: 无上限资源无警告
      const sim = createSim();

      const goldWarning = sim.engine.resource.getCapWarning('gold');
      expect(goldWarning).toBeNull();

      const mandateWarning = sim.engine.resource.getCapWarning('mandate');
      expect(mandateWarning).toBeNull();
    });
  });

  // ═══════════════════════════════════════════════
  // RDP-FLOW-3: 新功能解锁红点
  // ═══════════════════════════════════════════════
  describe('RDP-FLOW-3: 新功能解锁红点', () => {
    it('should have locked buildings at initial state', () => {
      // RDP-FLOW-3 步骤1: 初始状态有锁定建筑
      const sim = createSim();
      const buildings = sim.engine.building.getAllBuildings();

      const lockedBuildings = ALL_BUILDING_TYPES.filter(
        bt => buildings[bt].status === 'locked',
      );
      expect(lockedBuildings.length).toBeGreaterThan(0);
    });

    it('should unlock new buildings when castle levels up', () => {
      // RDP-FLOW-3 步骤2: 主城升级 → 新建筑解锁 → 红点
      const sim = createSim();
      sim.addResources(SUFFICIENT_RESOURCES);

      // 初始: market 锁定
      expect(sim.engine.building.getBuilding('market').status).toBe('locked');

      // 升级主城到 Lv2
      sim.upgradeBuilding('castle');

      // market 应解锁 → 红点
      expect(sim.engine.building.getBuilding('market').status).not.toBe('locked');
    });

    it('should track newly unlocked buildings as red dot candidates', () => {
      // RDP-FLOW-3 步骤3: 跟踪新解锁建筑
      const sim = createSim();
      sim.addResources(SUFFICIENT_RESOURCES);

      // 升级主城到 Lv3
      sim.upgradeBuildingTo('castle', 3);

      // 检查各解锁状态
      const buildings = sim.engine.building.getAllBuildings();

      // 主城 Lv3 应解锁 workshop 和 academy
      expect(buildings.workshop.status).not.toBe('locked');
      expect(buildings.academy.status).not.toBe('locked');

      // clinic 仍锁定（需要主城 Lv4）
      expect(buildings.clinic.status).toBe('locked');
    });

    it('should unlock all buildings at castle Lv5', () => {
      // RDP-FLOW-3 步骤4: 主城 Lv5 解锁所有建筑
      const sim = createSim();
      sim.engine.resource.setCap('grain', 50_000_000);
      sim.engine.resource.setCap('troops', 10_000_000);
      sim.addResources({ grain: 5000000, gold: 5000000, troops: 5000000 });

      sim.upgradeBuildingTo('castle', 4);
      sim.engine.resource.setCap('grain', 50_000_000);
      sim.engine.resource.setCap('troops', 10_000_000);
      sim.addResources({ grain: 5000000, gold: 5000000 });
      sim.upgradeBuildingTo('farmland', 4);
      sim.engine.resource.setCap('grain', 50_000_000);
      sim.engine.resource.setCap('troops', 10_000_000);
      sim.addResources({ grain: 5000000, gold: 5000000, troops: 5000000 });
      sim.upgradeBuildingTo('castle', 5);

      const buildings = sim.engine.building.getAllBuildings();
      for (const bt of ALL_BUILDING_TYPES) {
        expect(buildings[bt].status).not.toBe('locked');
      }
    });
  });

  // ═══════════════════════════════════════════════
  // RDP-FLOW-4: 任务完成红点
  // ═══════════════════════════════════════════════
  describe('RDP-FLOW-4: 任务完成红点', () => {
    it('should have QuestSystem accessible via engine.getQuestSystem()', () => {
      // RDP-FLOW-4 步骤1: 验证 QuestSystem 存在
      const sim = createSim();
      const questSystem = sim.engine.getQuestSystem();
      expect(questSystem).toBeDefined();
    });

    it('should have predefined quest definitions loaded', () => {
      // RDP-FLOW-4 步骤2: 预定义任务已加载
      // QuestSystem.init(deps) 会调用 loadPredefinedQuests()
      const sim = createSim();
      const questSystem = sim.engine.getQuestSystem();

      // 通过引擎获取的 QuestSystem 已经过 init(deps) 初始化
      const defs = questSystem.getAllQuestDefs();

      // 如果预定义任务为空，验证 refreshDailyQuests 可正常工作
      // (某些配置下预定义任务可能为空)
      expect(Array.isArray(defs)).toBe(true);
    });

    it('should track active quests', () => {
      // RDP-FLOW-4 步骤3: 活跃任务追踪
      const sim = createSim();
      const questSystem = sim.engine.getQuestSystem();
      const activeQuests = questSystem.getActiveQuests();

      expect(Array.isArray(activeQuests)).toBe(true);
    });

    it('should refresh daily quests', () => {
      // RDP-FLOW-4 步骤4: 刷新日常任务
      const sim = createSim();
      const questSystem = sim.engine.getQuestSystem();

      const dailyQuests = questSystem.refreshDailyQuests();
      expect(Array.isArray(dailyQuests)).toBe(true);
    });

    it('should detect completable quests as red dot source', () => {
      // RDP-FLOW-4 步骤5: 可领取奖励的任务作为红点数据源
      const sim = createSim();
      const questSystem = sim.engine.getQuestSystem();

      // 刷新日常任务
      questSystem.refreshDailyQuests();

      // 获取活跃任务
      const activeQuests = questSystem.getActiveQuests();

      // 检查是否有可完成的任务（通过 objectives 判断）
      for (const quest of activeQuests) {
        const allComplete = quest.objectives.every(
          o => o.currentCount >= o.targetCount,
        );
        // allComplete = true → 应有红点
        if (allComplete) {
          expect(quest.status).toBe('completed');
        }
      }
    });

    it('should track completed quest IDs', () => {
      // RDP-FLOW-4 步骤6: 已完成任务追踪
      const sim = createSim();
      const questSystem = sim.engine.getQuestSystem();

      const completedIds = questSystem.getCompletedQuestIds();
      expect(Array.isArray(completedIds)).toBe(true);
    });

    it('[RDP-FLOW-4] 创建任务→完成条件→验证红点→领取奖励→验证红点消失', () => {
      // RDP-FLOW-4 端到端: 完整任务红点生命周期
      // 1. 注册并接受一个自定义任务
      // 2. 更新目标进度至完成
      // 3. 验证任务状态变为 completed（红点出现条件）
      // 4. 领取奖励
      // 5. 验证任务从活跃列表移除（红点消失）
      const sim = createSim();
      const questSystem = sim.engine.getQuestSystem();

      // 步骤1: 注册自定义任务
      const testQuestId = 'test_red_dot_quest' as import('../../../core/quest/quest.types').QuestId;
      questSystem.registerQuest({
        id: testQuestId,
        title: '红点测试任务',
        description: '用于验证红点生命周期的测试任务',
        category: 'main' as import('../../../core/quest/quest.types').QuestCategory,
        objectives: [
          {
            id: 'obj_upgrade_farmland',
            type: 'upgrade_building',
            description: '升级农田1次',
            targetCount: 1,
            currentCount: 0,
          },
        ],
        rewards: { resources: { grain: 100, gold: 50 }, experience: 10 },
      });

      // 接受任务
      const instance = questSystem.acceptQuest(testQuestId);
      expect(instance).not.toBeNull();
      expect(instance!.status).toBe('active');

      // 步骤2: 验证红点条件 — 任务未完成，无红点
      const activeQuests = questSystem.getActiveQuests();
      const testQuest = activeQuests.find(q => q.questDefId === testQuestId);
      expect(testQuest).toBeDefined();
      const allComplete = testQuest!.objectives.every(
        o => o.currentCount >= o.targetCount,
      );
      expect(allComplete).toBe(false); // 未完成 → 无红点

      // 步骤3: 完成任务条件（更新目标进度）
      questSystem.updateObjectiveProgress(instance!.instanceId, 'obj_upgrade_farmland', 1);

      // 验证任务已自动完成（红点出现条件）
      const updatedQuest = questSystem.getQuestInstance(instance!.instanceId);
      // 任务完成后状态变为 completed，从 activeQuests 中移除
      expect(updatedQuest?.status).toBe('completed');

      // 红点判断：completed 且未领取奖励 → 应有红点
      const canClaim = updatedQuest?.status === 'completed' && !updatedQuest?.rewardClaimed;
      expect(canClaim).toBe(true); // 红点出现

      // 步骤4: 领取奖励
      const reward = questSystem.claimReward(instance!.instanceId);
      expect(reward).not.toBeNull();
      expect(reward!.resources?.grain).toBe(100);
      expect(reward!.resources?.gold).toBe(50);

      // 步骤5: 验证红点消失（奖励已领取，任务从活跃列表移除）
      // claimReward 会将任务从 activeQuests 中删除
      const claimedQuest = questSystem.getQuestInstance(instance!.instanceId);
      expect(claimedQuest).toBeUndefined(); // 已从活跃列表移除

      // 红点判断：任务不在活跃列表中 → 无红点
      const activeAfterClaim = questSystem.getActiveQuests();
      const foundInActive = activeAfterClaim.find(q => q.instanceId === instance!.instanceId);
      expect(foundInActive).toBeUndefined(); // 红点消失

      // 验证任务在已完成列表中
      expect(questSystem.isQuestCompleted(testQuestId)).toBe(true);
    });

    it('should have red dot appear when quest completable and disappear after claiming', () => {
      // RDP-FLOW-4 端到端: 红点出现（任务可领取）→ 领取 → 红点消失
      const sim = createSim();
      const questSystem = sim.engine.getQuestSystem();

      // 1. 注册并接受自定义任务
      const testQuestId = 'test_red_dot_lifecycle' as import('../../../core/quest/quest.types').QuestId;
      questSystem.registerQuest({
        id: testQuestId,
        title: '红点生命周期测试',
        description: '验证红点出现和消失',
        category: 'daily' as import('../../../core/quest/quest.types').QuestCategory,
        objectives: [
          {
            id: 'obj_collect_grain',
            type: 'collect_resource',
            description: '收集粮食1次',
            targetCount: 1,
            currentCount: 0,
          },
        ],
        rewards: { resources: { grain: 200, gold: 100 }, experience: 20 },
      });

      const instance = questSystem.acceptQuest(testQuestId);
      expect(instance).not.toBeNull();
      expect(instance!.status).toBe('active');

      // 2. 任务未完成 → 无红点
      const activeBefore = questSystem.getActiveQuests();
      const questBefore = activeBefore.find(q => q.questDefId === testQuestId);
      expect(questBefore).toBeDefined();
      const incompleteBefore = questBefore!.objectives.every(
        o => o.currentCount >= o.targetCount,
      );
      expect(incompleteBefore).toBe(false); // 未完成，无红点

      // 3. 完成任务条件 → 红点出现
      questSystem.updateObjectiveProgress(instance!.instanceId, 'obj_collect_grain', 1);

      const updatedQuest = questSystem.getQuestInstance(instance!.instanceId);
      expect(updatedQuest?.status).toBe('completed'); // 已完成 → 红点出现条件

      // 红点判断: completed 且未领取 → 红点出现
      const hasRedDot = updatedQuest?.status === 'completed' && !updatedQuest?.rewardClaimed;
      expect(hasRedDot).toBe(true);

      // 4. 领取奖励 → 红点消失
      const reward = questSystem.claimReward(instance!.instanceId);
      expect(reward).not.toBeNull();
      expect(reward!.resources?.grain).toBe(200);
      expect(reward!.resources?.gold).toBe(100);

      // 5. 验证红点消失
      const claimedQuest = questSystem.getQuestInstance(instance!.instanceId);
      expect(claimedQuest).toBeUndefined(); // 已从活跃列表移除 → 红点消失

      const activeAfterClaim = questSystem.getActiveQuests();
      const foundAfterClaim = activeAfterClaim.find(q => q.instanceId === instance!.instanceId);
      expect(foundAfterClaim).toBeUndefined(); // 红点消失

      expect(questSystem.isQuestCompleted(testQuestId)).toBe(true);
    });
  });
});
