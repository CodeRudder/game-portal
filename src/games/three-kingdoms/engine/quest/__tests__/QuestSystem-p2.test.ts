import { QuestSystem } from '../QuestSystem';
import type { ISystemDeps } from '../../../core/types';
import type { QuestDef, QuestReward, QuestInstance } from '../../../core/quest';
import {

      expect(allRewards[0].resources!.gold).toBe(200);
    });
  });

  // ═══════════════════════════════════════════
  // 6. 日常任务每日刷新 20选6（#17）
  // ═══════════════════════════════════════════
  describe('日常任务每日刷新', () => {
    it('refreshDailyQuests 从20个池中选6个', () => {
      expect(DAILY_QUEST_TEMPLATES).toHaveLength(20);

      const dailies = questSys.refreshDailyQuests();
      expect(dailies).toHaveLength(6);
      expect(dailies.every((d) => d.status === 'active')).toBe(true);
    });

    it('同一天不重复刷新', () => {
      const first = questSys.refreshDailyQuests();
      const second = questSys.refreshDailyQuests();
      expect(second).toHaveLength(6);
      // 同一天返回相同任务
      expect(first.map((q) => q.instanceId).sort()).toEqual(
        second.map((q) => q.instanceId).sort(),
      );
    });

    it('日常任务有过期时间', () => {
      const dailies = questSys.refreshDailyQuests();
      for (const d of dailies) {
        const def = questSys.getQuestDef(d.questDefId);
        expect(def!.expireHours).toBe(24);
      }
    });

    it('日常任务完成可获得活跃度', () => {
      const dailies = questSys.refreshDailyQuests();
      const firstDaily = dailies[0];
      const def = questSys.getQuestDef(firstDaily.questDefId);

      expect(def!.rewards.activityPoints).toBeGreaterThan(0);
    });

    it('getDailyQuests 返回当前日常任务', () => {
      questSys.refreshDailyQuests();
      const dailies = questSys.getDailyQuests();
      expect(dailies).toHaveLength(6);
    });
  });

  // ═══════════════════════════════════════════
  // 7. 活跃度系统（#18）
  // ═══════════════════════════════════════════
  describe('活跃度系统', () => {
    it('初始活跃度为0', () => {
      const state = questSys.getActivityState();
      expect(state.currentPoints).toBe(0);
    });

    it('完成日常任务增加活跃度', () => {
      questSys.setRewardCallback(() => {});
      const dailies = questSys.refreshDailyQuests();
      const first = dailies[0];
      const def = questSys.getQuestDef(first.questDefId);

      // 完成目标
      for (const obj of first.objectives) {
        questSys.updateObjectiveProgress(first.instanceId, obj.id, obj.targetCount);
      }

      // 领取奖励（触发活跃度）
      questSys.claimReward(first.instanceId);

      const state = questSys.getActivityState();
      expect(state.currentPoints).toBe(def!.rewards.activityPoints ?? 0);
    });

    it('活跃度不超过最大值', () => {
      questSys.addActivityPoints(200);
      const state = questSys.getActivityState();
      expect(state.currentPoints).toBe(state.maxPoints);
    });

    it('领取活跃度宝箱', () => {
      questSys.addActivityPoints(25);

      const reward = questSys.claimActivityMilestone(0); // 20分宝箱
      expect(reward).not.toBeNull();
      expect(reward!.resources!.gold).toBe(100);
    });

    it('活跃度不够不能领取宝箱', () => {
      questSys.addActivityPoints(10);
      const reward = questSys.claimActivityMilestone(0); // 需要20分
      expect(reward).toBeNull();
    });

    it('已领取的宝箱不能重复领取', () => {
      questSys.addActivityPoints(25);
      questSys.claimActivityMilestone(0);
      const again = questSys.claimActivityMilestone(0);
      expect(again).toBeNull();
    });

    it('resetDailyActivity 重置活跃度', () => {
      questSys.addActivityPoints(50);
      questSys.resetDailyActivity();
      const state = questSys.getActivityState();
      expect(state.currentPoints).toBe(0);
      expect(state.milestones.every((m) => !m.claimed)).toBe(true);
    });

    it('活跃度里程碑有5个等级', () => {
      const state = questSys.getActivityState();
      expect(state.milestones).toHaveLength(5);
      expect(state.milestones[0].points).toBe(20);
      expect(state.milestones[4].points).toBe(100);
    });
  });

  // ═══════════════════════════════════════════
  // 8. 任务追踪面板（#19）
  // ═══════════════════════════════════════════
  describe('任务追踪面板', () => {
    it('接受任务自动追踪（前3个）', () => {
      questSys.acceptQuest('quest-main-001');
      const tracked = questSys.getTrackedQuests();
      expect(tracked).toHaveLength(1);
    });

    it('最多追踪3个任务', () => {
      questSys.registerQuest({ ...QUEST_MAIN_CHAPTER_1, id: 'q-a' });
      questSys.registerQuest({ ...QUEST_MAIN_CHAPTER_2, id: 'q-b', prerequisiteQuestIds: undefined });
      questSys.registerQuest({ ...QUEST_MAIN_CHAPTER_3, id: 'q-c', prerequisiteQuestIds: undefined });
      questSys.registerQuest({ ...QUEST_MAIN_CHAPTER_1, id: 'q-d' });

      questSys.acceptQuest('q-a');
      questSys.acceptQuest('q-b');
      questSys.acceptQuest('q-c');
      questSys.acceptQuest('q-d');

      const tracked = questSys.getTrackedQuests();
      expect(tracked).toHaveLength(3);
    });

    it('trackQuest 手动添加追踪', () => {
      questSys.registerQuest({ ...QUEST_MAIN_CHAPTER_1, id: 'q-a' });
      questSys.registerQuest({ ...QUEST_MAIN_CHAPTER_2, id: 'q-b', prerequisiteQuestIds: undefined });
      questSys.registerQuest({ ...QUEST_MAIN_CHAPTER_3, id: 'q-c', prerequisiteQuestIds: undefined });

      const a = questSys.acceptQuest('q-a')!;
      const b = questSys.acceptQuest('q-b')!;
      const c = questSys.acceptQuest('q-c')!;

      // 手动追踪 c（已被自动追踪的可能是 a,b 中前两个）
      questSys.untrackQuest(a.instanceId);
      const result = questSys.trackQuest(c.instanceId);
      expect(result).toBe(true);
    });

    it('untrackQuest 取消追踪', () => {
      const inst = questSys.acceptQuest('quest-main-001')!;
      expect(questSys.untrackQuest(inst.instanceId)).toBe(true);
      expect(questSys.getTrackedQuests()).toHaveLength(0);
    });

    it('完成的任务从追踪列表移除', () => {
      const inst = questSys.acceptQuest('quest-main-001')!;
      expect(questSys.getTrackedQuests()).toHaveLength(1);

      questSys.updateObjectiveProgress(inst.instanceId, 'obj-001-1', 1);
      expect(questSys.getTrackedQuests()).toHaveLength(0);
    });
  });

  // ═══════════════════════════════════════════
  // 9. 查询方法
  // ═══════════════════════════════════════════
  describe('查询方法', () => {
    it('isQuestActive 检查任务是否激活', () => {
      expect(questSys.isQuestActive('quest-main-001')).toBe(false);
      questSys.acceptQuest('quest-main-001');
      expect(questSys.isQuestActive('quest-main-001')).toBe(true);
    });

    it('isQuestCompleted 检查任务是否完成', () => {
      expect(questSys.isQuestCompleted('quest-main-001')).toBe(false);
      const inst = questSys.acceptQuest('quest-main-001')!;
      questSys.updateObjectiveProgress(inst.instanceId, 'obj-001-1', 1);
      expect(questSys.isQuestCompleted('quest-main-001')).toBe(true);
    });

    it('getActiveQuestsByCategory 按类型获取活跃任务', () => {
      questSys.acceptQuest('quest-main-001');
      const mainQuests = questSys.getActiveQuestsByCategory('main');
      expect(mainQuests).toHaveLength(1);
      expect(mainQuests[0].questDefId).toBe('quest-main-001');
    });

    it('getQuestInstance 获取任务实例', () => {
      const inst = questSys.acceptQuest('quest-main-001')!;
      const found = questSys.getQuestInstance(inst.instanceId);
      expect(found).toBeDefined();
      expect(found!.questDefId).toBe('quest-main-001');
    });
  });

  // ═══════════════════════════════════════════
  // 10. 存档序列化
  // ═══════════════════════════════════════════
  describe('存档序列化', () => {
    it('serialize/deserialize 保持任务状态', () => {
      questSys.acceptQuest('quest-main-001');
      const data = questSys.serialize();

      const newSys = createQuestSystem();
      newSys.deserialize(data);

      expect(newSys.getActiveQuests()).toHaveLength(1);
      expect(newSys.isQuestActive('quest-main-001')).toBe(true);
    });

    it('serialize/deserialize 保持活跃度', () => {
      questSys.addActivityPoints(50);
      const data = questSys.serialize();

      const newSys = createQuestSystem();
      newSys.deserialize(data);

      expect(newSys.getActivityState().currentPoints).toBe(50);
    });

    it('serialize/deserialize 保持日常任务', () => {
      questSys.refreshDailyQuests();
      const data = questSys.serialize();

      const newSys = createQuestSystem();
      newSys.deserialize(data);

      expect(newSys.getDailyQuests()).toHaveLength(6);
    });

    it('serialize/deserialize 保持已完成任务', () => {
      const inst = questSys.acceptQuest('quest-main-001')!;
      questSys.updateObjectiveProgress(inst.instanceId, 'obj-001-1', 1);
      const data = questSys.serialize();

      const newSys = createQuestSystem();
      newSys.deserialize(data);

      expect(newSys.isQuestCompleted('quest-main-001')).toBe(true);
    });
  });

  // ═══════════════════════════════════════════
  // 11. 事件发射
  // ═══════════════════════════════════════════
  describe('事件发射', () => {
    it('接受任务触发 quest:accepted 事件', () => {
      const deps = mockDeps();
      const sys = new QuestSystem();
      sys.init(deps);

      sys.acceptQuest('quest-main-001');
      expect(deps.eventBus.emit).toHaveBeenCalledWith(
        'quest:accepted',
        expect.objectContaining({ questId: 'quest-main-001' }),
      );
    });

    it('任务完成触发 quest:completed 事件', () => {
      const deps = mockDeps();
      const sys = new QuestSystem();
      sys.init(deps);

      const inst = sys.acceptQuest('quest-main-001')!;
      sys.updateObjectiveProgress(inst.instanceId, 'obj-001-1', 1);
      expect(deps.eventBus.emit).toHaveBeenCalledWith(
        'quest:completed',
        expect.objectContaining({ questId: 'quest-main-001' }),
      );
    });

    it('日常刷新触发 quest:dailyRefreshed 事件', () => {
      const deps = mockDeps();
      const sys = new QuestSystem();
      sys.init(deps);

      sys.refreshDailyQuests();
      expect(deps.eventBus.emit).toHaveBeenCalledWith(
        'quest:dailyRefreshed',
        expect.objectContaining({ date: expect.any(String) }),
      );
    });
  });
});
