/**
 * QuestSerialization 单元测试
 *
 * 覆盖：
 * 1. serializeQuestState — 序列化
 * 2. deserializeQuestState — 反序列化
 */

import {
  serializeQuestState,
  deserializeQuestState,
} from '../QuestSerialization';

import type { QuestInstance, QuestSystemSaveData } from '../../../core/quest';

describe('QuestSerialization', () => {
  // ─── serializeQuestState ──────────────────

  describe('serializeQuestState', () => {
    it('应正确序列化活跃任务', () => {
      const activeQuests = new Map<string, QuestInstance>();
      activeQuests.set('inst_1', {
        instanceId: 'inst_1',
        questDefId: 'q1',
        status: 'active',
        objectives: [],
        rewardClaimed: false,
      });

      const result = serializeQuestState({
        activeQuests,
        completedQuestIds: new Set(['q_old']),
        activityState: {
          currentPoints: 50,
          maxPoints: 100,
          milestones: [],
          lastResetDate: '2024-01-01',
        },
        dailyRefreshDate: '2024-01-01',
        dailyQuestInstanceIds: ['inst_1'],
      });

      expect(result.activeQuests.length).toBe(1);
      expect(result.completedQuestIds).toEqual(['q_old']);
      expect(result.activityState.currentPoints).toBe(50);
    });

    it('空状态应序列化为空数组', () => {
      const result = serializeQuestState({
        activeQuests: new Map(),
        completedQuestIds: new Set(),
        activityState: {
          currentPoints: 0,
          maxPoints: 100,
          milestones: [],
          lastResetDate: '',
        },
        dailyRefreshDate: '',
        dailyQuestInstanceIds: [],
      });

      expect(result.activeQuests).toEqual([]);
      expect(result.completedQuestIds).toEqual([]);
    });
  });

  // ─── deserializeQuestState ────────────────

  describe('deserializeQuestState', () => {
    it('应正确恢复活跃任务到 Map', () => {
      const saveData: QuestSystemSaveData = {
        activeQuests: [{
          instanceId: 'inst_1',
          questDefId: 'q1',
          status: 'active',
          objectives: [],
          rewardClaimed: false,
        }],
        completedQuestIds: ['q_old'],
        activityState: {
          currentPoints: 30,
          maxPoints: 100,
          milestones: [],
          lastResetDate: '2024-01-01',
        },
        dailyRefreshDate: '2024-01-01',
        dailyQuestInstanceIds: ['inst_1'],
        version: 1,
      };

      const activeQuests = new Map<string, QuestInstance>();
      const completedQuestIds = new Set<string>();

      const result = deserializeQuestState(saveData, activeQuests, completedQuestIds);

      expect(activeQuests.size).toBe(1);
      expect(activeQuests.get('inst_1')).toBeDefined();
      expect(completedQuestIds.has('q_old')).toBe(true);
      expect(result.dailyRefreshDate).toBe('2024-01-01');
    });

    it('缺少 activityState 应使用默认值', () => {
      const saveData: QuestSystemSaveData = {
        activeQuests: [],
        completedQuestIds: [],
        activityState: undefined as unknown as QuestSystemSaveData['activityState'],
        dailyRefreshDate: '',
        dailyQuestInstanceIds: [],
        version: 1,
      };

      const result = deserializeQuestState(
        saveData,
        new Map(),
        new Set(),
      );

      expect(result.activityState.currentPoints).toBe(0);
      expect(result.activityState.maxPoints).toBe(100);
    });

    it('空存档应正确处理', () => {
      const saveData: QuestSystemSaveData = {
        activeQuests: [],
        completedQuestIds: [],
        activityState: {
          currentPoints: 0,
          maxPoints: 100,
          milestones: [],
          lastResetDate: '',
        },
        dailyRefreshDate: '',
        dailyQuestInstanceIds: [],
        version: 1,
      };

      const result = deserializeQuestState(
        saveData,
        new Map(),
        new Set(),
      );

      expect(result.dailyRefreshDate).toBe('');
      expect(result.dailyQuestInstanceIds).toEqual([]);
    });
  });
});
