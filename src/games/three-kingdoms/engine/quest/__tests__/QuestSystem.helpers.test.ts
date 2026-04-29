/**
 * QuestSystem.helpers 单元测试
 *
 * 覆盖：
 * 1. refreshDailyQuestsLogic — 日常任务刷新
 * 2. getTrackedQuests / trackQuest / untrackQuest — 任务追踪
 * 3. getDailyQuests / getActiveQuestsByCategory — 查询
 * 4. 活跃度辅助函数
 * 5. updateProgressByTypeLogic — 进度更新
 * 6. claimRewardLogic / claimAllRewardsLogic — 奖励领取
 */

import {
  refreshDailyQuestsLogic,
  getTrackedQuests,
  trackQuest,
  untrackQuest,
  getDailyQuests,
  getActiveQuestsByCategory,
  addActivityPoints,
  claimActivityMilestone,
  resetDailyActivity,
  updateProgressByTypeLogic,
  claimRewardLogic,
  claimAllRewardsLogic,
  MAX_TRACKED_QUESTS,
} from '../QuestSystem.helpers';

import type {
  QuestInstance,
  QuestDef,
} from '../../../core/quest';

describe('QuestSystem.helpers', () => {
  // ─── 任务追踪 ─────────────────────────────

  describe('任务追踪', () => {
    const makeInstance = (id: string, status: string = 'active'): QuestInstance => ({
      instanceId: id,
      questDefId: `def_${id}`,
      status: status as QuestInstance['status'],
      objectives: [],
      rewardClaimed: false,
    });

    describe('getTrackedQuests', () => {
      it('应返回追踪中的活跃任务', () => {
        const map = new Map<string, QuestInstance>();
        map.set('i1', makeInstance('i1'));
        map.set('i2', makeInstance('i2'));
        const result = getTrackedQuests(['i1', 'i2'], map);
        expect(result.length).toBe(2);
      });

      it('应过滤掉不存在的任务', () => {
        const map = new Map<string, QuestInstance>();
        map.set('i1', makeInstance('i1'));
        const result = getTrackedQuests(['i1', 'i_missing'], map);
        expect(result.length).toBe(1);
      });

      it('应过滤掉非活跃任务', () => {
        const map = new Map<string, QuestInstance>();
        map.set('i1', makeInstance('i1', 'completed'));
        const result = getTrackedQuests(['i1'], map);
        expect(result.length).toBe(0);
      });
    });

    describe('trackQuest', () => {
      it('应添加到追踪列表', () => {
        const map = new Map<string, QuestInstance>();
        map.set('i1', makeInstance('i1'));
        const result = trackQuest('i1', [], map);
        expect(result).toEqual(['i1']);
      });

      it('已追踪应返回 null', () => {
        const map = new Map<string, QuestInstance>();
        map.set('i1', makeInstance('i1'));
        const result = trackQuest('i1', ['i1'], map);
        expect(result).toBeNull();
      });

      it('超过最大追踪数应返回 null', () => {
        const map = new Map<string, QuestInstance>();
        map.set('i_new', makeInstance('i_new'));
        const tracked = Array.from({ length: MAX_TRACKED_QUESTS }, (_, i) => `i${i}`);
        const result = trackQuest('i_new', tracked, map);
        expect(result).toBeNull();
      });

      it('不存在的任务应返回 null', () => {
        const result = trackQuest('missing', [], new Map());
        expect(result).toBeNull();
      });
    });

    describe('untrackQuest', () => {
      it('应从追踪列表移除', () => {
        const result = untrackQuest('i1', ['i1', 'i2']);
        expect(result).toEqual(['i2']);
      });

      it('不在列表中应返回 null', () => {
        const result = untrackQuest('missing', ['i1']);
        expect(result).toBeNull();
      });
    });
  });

  // ─── 查询辅助 ─────────────────────────────

  describe('查询辅助', () => {
    describe('getDailyQuests', () => {
      it('应返回日常任务实例', () => {
        const map = new Map<string, QuestInstance>();
        map.set('d1', { instanceId: 'd1', questDefId: 'q1', status: 'active', objectives: [], rewardClaimed: false });
        const result = getDailyQuests(['d1', 'd_missing'], map);
        expect(result.length).toBe(1);
      });
    });

    describe('getActiveQuestsByCategory', () => {
      it('应按分类过滤', () => {
        const activeQuests = new Map<string, QuestInstance>();
        activeQuests.set('i1', { instanceId: 'i1', questDefId: 'q1', status: 'active', objectives: [], rewardClaimed: false });
        activeQuests.set('i2', { instanceId: 'i2', questDefId: 'q2', status: 'active', objectives: [], rewardClaimed: false });

        const questDefs = new Map<string, QuestDef>();
        questDefs.set('q1', { id: 'q1', category: 'daily', name: '', description: '', objectives: [], rewards: { gold: 10 } });
        questDefs.set('q2', { id: 'q2', category: 'main', name: '', description: '', objectives: [], rewards: { gold: 10 } });

        const result = getActiveQuestsByCategory('daily', activeQuests, questDefs);
        expect(result.length).toBe(1);
        expect(result[0].questDefId).toBe('q1');
      });
    });
  });

  // ─── 活跃度辅助 ───────────────────────────

  describe('活跃度辅助', () => {
    describe('addActivityPoints', () => {
      it('应增加活跃度', () => {
        const state = { currentPoints: 0, maxPoints: 100, milestones: [], lastResetDate: '' };
        addActivityPoints(state, 30);
        expect(state.currentPoints).toBe(30);
      });

      it('不应超过最大值', () => {
        const state = { currentPoints: 90, maxPoints: 100, milestones: [], lastResetDate: '' };
        addActivityPoints(state, 50);
        expect(state.currentPoints).toBe(100);
      });
    });

    describe('claimActivityMilestone', () => {
      it('活跃度不足应返回 null', () => {
        const state = { currentPoints: 10, maxPoints: 100, milestones: [{ points: 50, claimed: false, rewards: { gold: 100 } }], lastResetDate: '' };
        expect(claimActivityMilestone(state, 0)).toBeNull();
      });

      it('已领取应返回 null', () => {
        const state = { currentPoints: 100, maxPoints: 100, milestones: [{ points: 50, claimed: true, rewards: { gold: 100 } }], lastResetDate: '' };
        expect(claimActivityMilestone(state, 0)).toBeNull();
      });

      it('应成功领取', () => {
        const state = { currentPoints: 100, maxPoints: 100, milestones: [{ points: 50, claimed: false, rewards: { gold: 100 } }], lastResetDate: '' };
        const result = claimActivityMilestone(state, 0);
        expect(result).toEqual({ gold: 100 });
        expect(state.milestones[0].claimed).toBe(true);
      });
    });

    describe('resetDailyActivity', () => {
      it('应重置活跃度', () => {
        const state = { currentPoints: 50, maxPoints: 100, milestones: [], lastResetDate: '' };
        resetDailyActivity(state);
        expect(state.currentPoints).toBe(0);
      });
    });
  });

  // ─── 进度更新 ─────────────────────────────

  describe('updateProgressByTypeLogic', () => {
    it('应更新匹配目标类型的进度', () => {
      const instance: QuestInstance = {
        instanceId: 'i1',
        questDefId: 'q1',
        status: 'active',
        objectives: [{
          id: 'obj1', type: 'kill', currentCount: 0, targetCount: 5,
        }],
        rewardClaimed: false,
      };
      const activeQuests = new Map<string, QuestInstance>();
      activeQuests.set('i1', instance);

      const ctx = {
        emit: vi.fn(),
        completeQuest: vi.fn(),
        checkQuestCompletion: vi.fn().mockReturnValue(false),
      };

      updateProgressByTypeLogic('kill', 3, activeQuests, ctx);
      expect(instance.objectives[0].currentCount).toBe(3);
      expect(ctx.emit).toHaveBeenCalled();
    });

    it('不应更新已完成的目标', () => {
      const instance: QuestInstance = {
        instanceId: 'i1',
        questDefId: 'q1',
        status: 'active',
        objectives: [{
          id: 'obj1', type: 'kill', currentCount: 5, targetCount: 5,
        }],
        rewardClaimed: false,
      };
      const activeQuests = new Map<string, QuestInstance>();
      activeQuests.set('i1', instance);

      const ctx = {
        emit: vi.fn(),
        completeQuest: vi.fn(),
        checkQuestCompletion: vi.fn().mockReturnValue(false),
      };

      updateProgressByTypeLogic('kill', 3, activeQuests, ctx);
      expect(instance.objectives[0].currentCount).toBe(5);
    });
  });

  // ─── 奖励领取 ─────────────────────────────

  describe('claimRewardLogic', () => {
    it('未完成的任务应返回 null', () => {
      const activeQuests = new Map<string, QuestInstance>();
      activeQuests.set('i1', {
        instanceId: 'i1', questDefId: 'q1', status: 'active',
        objectives: [], rewardClaimed: false,
      });
      const ctx = {
        questDefs: new Map(),
        activeQuests,
        addActivityPoints: vi.fn(),
        emit: vi.fn(),
      };
      expect(claimRewardLogic('i1', ctx)).toBeNull();
    });

    it('已领取的任务应返回 null', () => {
      const activeQuests = new Map<string, QuestInstance>();
      activeQuests.set('i1', {
        instanceId: 'i1', questDefId: 'q1', status: 'completed',
        objectives: [], rewardClaimed: true,
      });
      const ctx = {
        questDefs: new Map(),
        activeQuests,
        addActivityPoints: vi.fn(),
        emit: vi.fn(),
      };
      expect(claimRewardLogic('i1', ctx)).toBeNull();
    });
  });

  describe('claimAllRewardsLogic', () => {
    it('应批量领取所有已完成奖励', () => {
      const activeQuests = new Map<string, QuestInstance>();
      activeQuests.set('i1', {
        instanceId: 'i1', questDefId: 'q1', status: 'completed',
        objectives: [], rewardClaimed: false,
      });

      const mockClaim = vi.fn().mockReturnValue({ gold: 10 });
      const rewards = claimAllRewardsLogic(activeQuests, mockClaim);
      expect(rewards.length).toBe(1);
      expect(mockClaim).toHaveBeenCalledWith('i1');
    });
  });
});
