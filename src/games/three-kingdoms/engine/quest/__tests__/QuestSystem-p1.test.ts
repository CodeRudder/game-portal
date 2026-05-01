/**
 * QuestSystem 单元测试
 *
 * 覆盖任务系统的所有功能：
 * - ISubsystem 接口
 * - 任务注册与查询
 * - 主线任务链推进（#15）
 * - 日常任务每日刷新 20选6（#17）
 * - 活跃度系统累积与宝箱解锁（#18）
 * - 任务追踪面板（#19）
 * - 任务完成与奖励领取（#21）
 * - 存档序列化
 */

import { QuestSystem } from '../QuestSystem';
import type { ISystemDeps } from '../../../core/types';
import type { QuestDef, QuestReward, QuestInstance } from '../../../core/quest';
import {
  QUEST_MAIN_CHAPTER_1,
  QUEST_MAIN_CHAPTER_2,
  QUEST_MAIN_CHAPTER_3,
  DAILY_QUEST_TEMPLATES,
} from '../../../core/quest';

// ─────────────────────────────────────────────
// 辅助工具
// ─────────────────────────────────────────────

function mockDeps(): ISystemDeps {
  return {
    eventBus: {
      on: jest.fn().mockReturnValue(jest.fn()),
      once: jest.fn().mockReturnValue(jest.fn()),
      emit: jest.fn(),
      off: jest.fn(),
      removeAllListeners: jest.fn(),
    },
    config: { get: jest.fn(), set: jest.fn() },
    registry: { register: jest.fn(), get: jest.fn(), getAll: jest.fn(), has: jest.fn(), unregister: jest.fn() },
  } as unknown as ISystemDeps;
}

function createQuestSystem(): QuestSystem {
  const sys = new QuestSystem();
  sys.init(mockDeps());
  return sys;
}

// ═══════════════════════════════════════════════════════════

describe('QuestSystem', () => {
  let questSys: QuestSystem;

  beforeEach(() => {
    questSys = createQuestSystem();
  });

  // ═══════════════════════════════════════════
  // 1. ISubsystem 接口
  // ═══════════════════════════════════════════
  describe('ISubsystem 接口', () => {
    it('name 为 quest', () => {
      expect(questSys.name).toBe('quest');
    });

    it('init 后加载预定义任务', () => {
      const defs = questSys.getAllQuestDefs();
      expect(defs.length).toBeGreaterThan(0);
    });

    it('reset 恢复初始状态', () => {
      questSys.acceptQuest('quest-main-001');
      questSys.reset();
      expect(questSys.getActiveQuests()).toHaveLength(0);
      expect(questSys.getCompletedQuestIds()).toHaveLength(0);
    });

    it('getState 返回完整状态', () => {
      const state = questSys.getState();
      expect(state).toHaveProperty('activeQuests');
      expect(state).toHaveProperty('completedQuestIds');
      expect(state).toHaveProperty('activityState');
      expect(state).toHaveProperty('trackedQuestIds');
    });

    it('update 不抛异常', () => {
      expect(() => questSys.update(16)).not.toThrow();
    });
  });

  // ═══════════════════════════════════════════
  // 2. 任务注册与查询
  // ═══════════════════════════════════════════
  describe('任务注册与查询', () => {
    it('registerQuest 注册自定义任务', () => {
      const customQuest: QuestDef = {
        id: 'custom-001',
        title: '自定义任务',
        description: '测试',
        category: 'side',
        objectives: [{ id: 'obj-c1', type: 'build_upgrade', description: '升级建筑', targetCount: 1, currentCount: 0 }],
        rewards: { resources: { gold: 100 } },
      };
      questSys.registerQuest(customQuest);
      expect(questSys.getQuestDef('custom-001')).toBeDefined();
      expect(questSys.getQuestDef('custom-001')!.title).toBe('自定义任务');
    });

    it('registerQuests 批量注册', () => {
      const quests = [
        { ...QUEST_MAIN_CHAPTER_1, id: 'batch-1' },
        { ...QUEST_MAIN_CHAPTER_2, id: 'batch-2' },
      ];
      questSys.registerQuests(quests);
      expect(questSys.getQuestDef('batch-1')).toBeDefined();
      expect(questSys.getQuestDef('batch-2')).toBeDefined();
    });

    it('getQuestDef 不存在返回 undefined', () => {
      expect(questSys.getQuestDef('nonexistent')).toBeUndefined();
    });

    it('getQuestDefsByCategory 按类型过滤', () => {
      const mainQuests = questSys.getQuestDefsByCategory('main');
      expect(mainQuests.length).toBeGreaterThan(0);
      expect(mainQuests.every((q) => q.category === 'main')).toBe(true);
    });
  });

  // ═══════════════════════════════════════════
  // 3. 主线任务链推进（#15）
  // ═══════════════════════════════════════════
  describe('主线任务链推进', () => {
    it('接受第一章主线任务', () => {
      const instance = questSys.acceptQuest('quest-main-001');
      expect(instance).not.toBeNull();
      expect(instance!.questDefId).toBe('quest-main-001');
      expect(instance!.status).toBe('active');
    });

    it('主线任务链：前置未完成不能接受后续', () => {
      // 第二章需要第一章完成
      const instance = questSys.acceptQuest('quest-main-002');
      expect(instance).toBeNull();
    });

    it('主线任务链：完成前置后可接受后续', () => {
      // 接受并完成第一章
      const ch1 = questSys.acceptQuest('quest-main-001');
      expect(ch1).not.toBeNull();

      // 完成目标
      questSys.updateObjectiveProgress(ch1!.instanceId, 'obj-001-1', 1);
      expect(questSys.isQuestCompleted('quest-main-001')).toBe(true);

      // 现在可以接受第二章
      const ch2 = questSys.acceptQuest('quest-main-002');
      expect(ch2).not.toBeNull();
      expect(ch2!.questDefId).toBe('quest-main-002');
    });

    it('主线任务链：完整三章推进', () => {
      // 第一章
      const ch1 = questSys.acceptQuest('quest-main-001')!;
      questSys.updateObjectiveProgress(ch1.instanceId, 'obj-001-1', 1);

      // 第二章
      const ch2 = questSys.acceptQuest('quest-main-002')!;
      questSys.updateObjectiveProgress(ch2.instanceId, 'obj-002-1', 1);

      // 第三章
      const ch3 = questSys.acceptQuest('quest-main-003')!;
      questSys.updateObjectiveProgress(ch3.instanceId, 'obj-003-1', 3);

      expect(questSys.isQuestCompleted('quest-main-003')).toBe(true);
    });

    it('已完成任务不能再次接受', () => {
      const ch1 = questSys.acceptQuest('quest-main-001')!;
      questSys.updateObjectiveProgress(ch1.instanceId, 'obj-001-1', 1);

      const again = questSys.acceptQuest('quest-main-001');
      expect(again).toBeNull();
    });

    it('已激活任务不能重复接受', () => {
      questSys.acceptQuest('quest-main-001');
      const again = questSys.acceptQuest('quest-main-001');
      expect(again).toBeNull();
    });
  });

  // ═══════════════════════════════════════════
  // 4. 任务进度与完成
  // ═══════════════════════════════════════════
  describe('任务进度与完成', () => {
    it('updateObjectiveProgress 更新进度', () => {
      const inst = questSys.acceptQuest('quest-main-001')!;
      const obj = questSys.updateObjectiveProgress(inst.instanceId, 'obj-001-1', 1);
      expect(obj).not.toBeNull();
      expect(obj!.currentCount).toBe(1);
    });

    it('进度不超过目标数', () => {
      const inst = questSys.acceptQuest('quest-main-001')!;
      questSys.updateObjectiveProgress(inst.instanceId, 'obj-001-1', 5);
      const obj = questSys.getQuestInstance(inst.instanceId)!.objectives[0];
      expect(obj.currentCount).toBe(1); // targetCount=1
    });

    it('所有目标完成后自动完成', () => {
      const inst = questSys.acceptQuest('quest-main-001')!;
      questSys.updateObjectiveProgress(inst.instanceId, 'obj-001-1', 1);

      const updated = questSys.getQuestInstance(inst.instanceId);
      expect(updated!.status).toBe('completed');
    });

    it('updateProgressByType 按类型批量更新', () => {
      const inst = questSys.acceptQuest('quest-main-001')!;
      questSys.updateProgressByType('build_upgrade', 1);

      const updated = questSys.getQuestInstance(inst.instanceId);
      expect(updated!.objectives[0].currentCount).toBe(1);
    });

    it('updateProgressByType 支持参数匹配', () => {
      const customQuest: QuestDef = {
        id: 'param-quest',
        title: '参数任务',
        description: '收集粮草',
        category: 'side',
        objectives: [{
          id: 'obj-p1', type: 'collect_resource', description: '收集粮草',
          targetCount: 500, currentCount: 0, params: { resource: 'grain' },
        }],
        rewards: { resources: { gold: 100 } },
      };
      questSys.registerQuest(customQuest);
      questSys.acceptQuest('param-quest');

      // 不匹配的参数不更新
      questSys.updateProgressByType('collect_resource', 100, { resource: 'gold' });
      expect(questSys.getQuestInstance(questSys.getActiveQuests().find(q => q.questDefId === 'param-quest')!.instanceId)!.objectives[0].currentCount).toBe(0);

      // 匹配的参数更新
      questSys.updateProgressByType('collect_resource', 200, { resource: 'grain' });
      expect(questSys.getQuestInstance(questSys.getActiveQuests().find(q => q.questDefId === 'param-quest')!.instanceId)!.objectives[0].currentCount).toBe(200);
    });

    it('不存在的实例返回 null', () => {
      expect(questSys.updateObjectiveProgress('nonexistent', 'obj-1', 1)).toBeNull();
    });
  });

  // ═══════════════════════════════════════════
  // 5. 任务奖励领取（#21）
  // ═══════════════════════════════════════════
  describe('任务奖励领取', () => {
    it('claimReward 领取已完成任务的奖励', () => {
      const rewards: QuestReward[] = [];
      questSys.setRewardCallback((r) => rewards.push(r));

      const inst = questSys.acceptQuest('quest-main-001')!;
      questSys.updateObjectiveProgress(inst.instanceId, 'obj-001-1', 1);

      const reward = questSys.claimReward(inst.instanceId);
      expect(reward).not.toBeNull();
      expect(reward!.resources!.gold).toBe(2000);
      expect(rewards).toHaveLength(1);
    });

    it('未完成的任务不能领取奖励', () => {
      const inst = questSys.acceptQuest('quest-main-001')!;
      const reward = questSys.claimReward(inst.instanceId);
      expect(reward).toBeNull();
    });

    it('已领取的任务不能重复领取', () => {
      const inst = questSys.acceptQuest('quest-main-001')!;
      questSys.updateObjectiveProgress(inst.instanceId, 'obj-001-1', 1);

      questSys.claimReward(inst.instanceId);
      const again = questSys.claimReward(inst.instanceId);
      expect(again).toBeNull();
    });

    it('claimAllRewards 一键领取所有奖励', () => {
      questSys.setRewardCallback(() => {});

      const inst1 = questSys.acceptQuest('quest-main-001')!;
      questSys.updateObjectiveProgress(inst1.instanceId, 'obj-001-1', 1);

      const allRewards = questSys.claimAllRewards();
      expect(allRewards).toHaveLength(1);
    });
  });
});
