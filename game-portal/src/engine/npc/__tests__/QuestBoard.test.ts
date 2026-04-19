/**
 * QuestBoard 单元测试
 *
 * 覆盖：任务创建、接取、进度更新、完成/失败、超时、
 * 查询筛选、序列化/反序列化。
 *
 * @module engine/npc/__tests__/QuestBoard.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NPCEventBus } from '../NPCEventBus';
import {
  QuestBoard,
  QuestType,
  QuestDifficulty,
  QuestStatus,
} from '../QuestBoard';
import type { Quest } from '../QuestBoard';

// ---------------------------------------------------------------------------
// 辅助函数
// ---------------------------------------------------------------------------

function createTestQuest(overrides?: Partial<Quest>): Quest {
  return {
    id: '',
    title: '测试任务',
    description: '这是一个测试任务',
    publisherNpcId: 'npc_1',
    type: QuestType.COLLECT,
    difficulty: QuestDifficulty.NORMAL,
    status: QuestStatus.AVAILABLE,
    objectives: [
      {
        description: '收集 5 个木材',
        type: QuestType.COLLECT,
        targetId: 'wood',
        requiredAmount: 5,
        currentAmount: 0,
      },
    ],
    rewards: { gold: 100, exp: 50 },
    timeLimit: 0,
    acceptedAt: null,
    completedAt: null,
    minRelationshipLevel: '',
    minPlayerLevel: 1,
    ...overrides,
  } as Quest;
}

// ---------------------------------------------------------------------------
// 测试
// ---------------------------------------------------------------------------

describe('QuestBoard', () => {
  let eventBus: NPCEventBus;
  let board: QuestBoard;

  beforeEach(() => {
    eventBus = new NPCEventBus();
    board = new QuestBoard(eventBus);
  });

  // -----------------------------------------------------------------------
  // 任务创建
  // -----------------------------------------------------------------------

  describe('createQuest', () => {
    it('应能创建任务', () => {
      const quest = board.createQuest({
        title: '收集木材',
        description: '帮农夫收集 5 个木材',
        publisherNpcId: 'npc_1',
        type: QuestType.COLLECT,
        difficulty: QuestDifficulty.EASY,
        objectives: [
          {
            description: '收集木材',
            type: QuestType.COLLECT,
            targetId: 'wood',
            requiredAmount: 5,
            currentAmount: 0,
          },
        ],
        rewards: { gold: 50, exp: 20 },
        timeLimit: 300,
        minRelationshipLevel: '',
        minPlayerLevel: 1,
      });

      expect(quest.id).toBeDefined();
      expect(quest.status).toBe(QuestStatus.AVAILABLE);
      expect(quest.title).toBe('收集木材');
      expect(quest.objectives).toHaveLength(1);
    });

    it('创建任务应触发 questCreated 事件', () => {
      const listener = vi.fn();
      eventBus.on('questCreated', listener);

      board.createQuest({
        title: '测试',
        description: '测试',
        publisherNpcId: 'npc_1',
        type: QuestType.COLLECT,
        difficulty: QuestDifficulty.NORMAL,
        objectives: [],
        rewards: {},
        timeLimit: 0,
        minRelationshipLevel: '',
        minPlayerLevel: 1,
      });

      expect(listener).toHaveBeenCalled();
    });

    it('应能批量创建任务', () => {
      const quests = board.createQuests([
        {
          title: '任务1',
          description: '描述1',
          publisherNpcId: 'npc_1',
          type: QuestType.COLLECT,
          difficulty: QuestDifficulty.EASY,
          objectives: [],
          rewards: {},
          timeLimit: 0,
          minRelationshipLevel: '',
          minPlayerLevel: 1,
        },
        {
          title: '任务2',
          description: '描述2',
          publisherNpcId: 'npc_2',
          type: QuestType.DEFEAT,
          difficulty: QuestDifficulty.HARD,
          objectives: [],
          rewards: { gold: 200 },
          timeLimit: 600,
          minRelationshipLevel: '',
          minPlayerLevel: 5,
        },
      ]);

      expect(quests).toHaveLength(2);
      expect(quests[0].id).not.toBe(quests[1].id);
    });
  });

  // -----------------------------------------------------------------------
  // 任务接取
  // -----------------------------------------------------------------------

  describe('acceptQuest', () => {
    it('应能接取可用任务', () => {
      const quest = board.createQuest({
        title: '测试',
        description: '测试',
        publisherNpcId: 'npc_1',
        type: QuestType.COLLECT,
        difficulty: QuestDifficulty.NORMAL,
        objectives: [],
        rewards: {},
        timeLimit: 0,
        minRelationshipLevel: '',
        minPlayerLevel: 1,
      });

      expect(board.acceptQuest(quest.id)).toBe(true);
      expect(quest.status).toBe(QuestStatus.ACTIVE);
      expect(quest.acceptedAt).not.toBeNull();
    });

    it('接取应触发 questAccepted 事件', () => {
      const listener = vi.fn();
      eventBus.on('questAccepted', listener);

      const quest = board.createQuest({
        title: '测试',
        description: '测试',
        publisherNpcId: 'npc_1',
        type: QuestType.COLLECT,
        difficulty: QuestDifficulty.NORMAL,
        objectives: [],
        rewards: {},
        timeLimit: 0,
        minRelationshipLevel: '',
        minPlayerLevel: 1,
      });

      board.acceptQuest(quest.id);
      expect(listener).toHaveBeenCalled();
    });

    it('不能接取不存在的任务', () => {
      expect(board.acceptQuest('nonexistent')).toBe(false);
    });

    it('不能重复接取已接取的任务', () => {
      const quest = board.createQuest({
        title: '测试',
        description: '测试',
        publisherNpcId: 'npc_1',
        type: QuestType.COLLECT,
        difficulty: QuestDifficulty.NORMAL,
        objectives: [],
        rewards: {},
        timeLimit: 0,
        minRelationshipLevel: '',
        minPlayerLevel: 1,
      });

      board.acceptQuest(quest.id);
      expect(board.acceptQuest(quest.id)).toBe(false);
    });

    it('等级不足不能接取', () => {
      const quest = board.createQuest({
        title: '高级任务',
        description: '需要等级 5',
        publisherNpcId: 'npc_1',
        type: QuestType.DEFEAT,
        difficulty: QuestDifficulty.HARD,
        objectives: [],
        rewards: {},
        timeLimit: 0,
        minRelationshipLevel: '',
        minPlayerLevel: 5,
      });

      expect(board.acceptQuest(quest.id, 3)).toBe(false);
    });

    it('好感度不足不能接取', () => {
      const quest = board.createQuest({
        title: '友好任务',
        description: '需要朋友等级',
        publisherNpcId: 'npc_1',
        type: QuestType.COLLECT,
        difficulty: QuestDifficulty.NORMAL,
        objectives: [],
        rewards: {},
        timeLimit: 0,
        minRelationshipLevel: 'friend',
        minPlayerLevel: 1,
      });

      expect(board.acceptQuest(quest.id, 1, 'stranger')).toBe(false);
      expect(board.acceptQuest(quest.id, 1, 'acquaintance')).toBe(false);
      expect(board.acceptQuest(quest.id, 1, 'friend')).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // 进度更新
  // -----------------------------------------------------------------------

  describe('updateObjective', () => {
    it('应能更新目标进度', () => {
      const quest = board.createQuest({
        title: '收集木材',
        description: '收集木材',
        publisherNpcId: 'npc_1',
        type: QuestType.COLLECT,
        difficulty: QuestDifficulty.NORMAL,
        objectives: [
          { description: '收集木材', type: QuestType.COLLECT, targetId: 'wood', requiredAmount: 5, currentAmount: 0 },
        ],
        rewards: { gold: 100 },
        timeLimit: 0,
        minRelationshipLevel: '',
        minPlayerLevel: 1,
      });

      board.acceptQuest(quest.id);
      const obj = board.updateObjective(quest.id, 0, 3);

      expect(obj).not.toBeNull();
      expect(obj!.currentAmount).toBe(3);
    });

    it('进度不应超过所需数量', () => {
      const quest = board.createQuest({
        title: '收集木材',
        description: '收集木材',
        publisherNpcId: 'npc_1',
        type: QuestType.COLLECT,
        difficulty: QuestDifficulty.NORMAL,
        objectives: [
          { description: '收集木材', type: QuestType.COLLECT, targetId: 'wood', requiredAmount: 5, currentAmount: 0 },
        ],
        rewards: {},
        timeLimit: 0,
        minRelationshipLevel: '',
        minPlayerLevel: 1,
      });

      board.acceptQuest(quest.id);
      board.updateObjective(quest.id, 0, 100);
      expect(quest.objectives[0].currentAmount).toBe(5);
    });

    it('所有目标完成应自动完成任务', () => {
      const listener = vi.fn();
      eventBus.on('questCompleted', listener);

      const quest = board.createQuest({
        title: '收集木材',
        description: '收集木材',
        publisherNpcId: 'npc_1',
        type: QuestType.COLLECT,
        difficulty: QuestDifficulty.NORMAL,
        objectives: [
          { description: '收集木材', type: QuestType.COLLECT, targetId: 'wood', requiredAmount: 5, currentAmount: 0 },
        ],
        rewards: {},
        timeLimit: 0,
        minRelationshipLevel: '',
        minPlayerLevel: 1,
      });

      board.acceptQuest(quest.id);
      board.updateObjective(quest.id, 0, 5);

      expect(quest.status).toBe(QuestStatus.COMPLETED);
      expect(listener).toHaveBeenCalled();
    });

    it('非活跃任务不能更新进度', () => {
      const quest = board.createQuest({
        title: '测试',
        description: '测试',
        publisherNpcId: 'npc_1',
        type: QuestType.COLLECT,
        difficulty: QuestDifficulty.NORMAL,
        objectives: [
          { description: '收集', type: QuestType.COLLECT, targetId: 'wood', requiredAmount: 5, currentAmount: 0 },
        ],
        rewards: {},
        timeLimit: 0,
        minRelationshipLevel: '',
        minPlayerLevel: 1,
      });

      // 未接取
      expect(board.updateObjective(quest.id, 0, 1)).toBeNull();
    });

    it('无效目标索引应返回 null', () => {
      const quest = board.createQuest({
        title: '测试',
        description: '测试',
        publisherNpcId: 'npc_1',
        type: QuestType.COLLECT,
        difficulty: QuestDifficulty.NORMAL,
        objectives: [
          { description: '收集', type: QuestType.COLLECT, targetId: 'wood', requiredAmount: 5, currentAmount: 0 },
        ],
        rewards: {},
        timeLimit: 0,
        minRelationshipLevel: '',
        minPlayerLevel: 1,
      });

      board.acceptQuest(quest.id);
      expect(board.updateObjective(quest.id, -1, 1)).toBeNull();
      expect(board.updateObjective(quest.id, 99, 1)).toBeNull();
    });
  });

  describe('progressByType', () => {
    it('应能按类型自动匹配并更新', () => {
      const q1 = board.createQuest({
        title: '收集木材',
        description: '',
        publisherNpcId: 'npc_1',
        type: QuestType.COLLECT,
        difficulty: QuestDifficulty.NORMAL,
        objectives: [
          { description: '木材', type: QuestType.COLLECT, targetId: 'wood', requiredAmount: 10, currentAmount: 0 },
        ],
        rewards: {},
        timeLimit: 0,
        minRelationshipLevel: '',
        minPlayerLevel: 1,
      });

      const q2 = board.createQuest({
        title: '收集更多木材',
        description: '',
        publisherNpcId: 'npc_2',
        type: QuestType.COLLECT,
        difficulty: QuestDifficulty.NORMAL,
        objectives: [
          { description: '木材', type: QuestType.COLLECT, targetId: 'wood', requiredAmount: 20, currentAmount: 0 },
        ],
        rewards: {},
        timeLimit: 0,
        minRelationshipLevel: '',
        minPlayerLevel: 1,
      });

      board.acceptQuest(q1.id);
      board.acceptQuest(q2.id);

      const affected = board.progressByType(QuestType.COLLECT, 'wood', 5);
      expect(affected).toHaveLength(2);
      expect(q1.objectives[0].currentAmount).toBe(5);
      expect(q2.objectives[0].currentAmount).toBe(5);
    });
  });

  // -----------------------------------------------------------------------
  // 任务完成 / 失败
  // -----------------------------------------------------------------------

  describe('completeQuest', () => {
    it('应能完成任务', () => {
      const quest = board.createQuest({
        title: '测试',
        description: '测试',
        publisherNpcId: 'npc_1',
        type: QuestType.COLLECT,
        difficulty: QuestDifficulty.NORMAL,
        objectives: [
          { description: '收集', type: QuestType.COLLECT, targetId: 'wood', requiredAmount: 5, currentAmount: 5 },
        ],
        rewards: { gold: 100 },
        timeLimit: 0,
        minRelationshipLevel: '',
        minPlayerLevel: 1,
      });

      board.acceptQuest(quest.id);
      expect(board.completeQuest(quest.id)).toBe(true);
      expect(quest.status).toBe(QuestStatus.COMPLETED);
      expect(quest.completedAt).not.toBeNull();
    });

    it('未完成目标不能完成', () => {
      const quest = board.createQuest({
        title: '测试',
        description: '测试',
        publisherNpcId: 'npc_1',
        type: QuestType.COLLECT,
        difficulty: QuestDifficulty.NORMAL,
        objectives: [
          { description: '收集', type: QuestType.COLLECT, targetId: 'wood', requiredAmount: 5, currentAmount: 3 },
        ],
        rewards: {},
        timeLimit: 0,
        minRelationshipLevel: '',
        minPlayerLevel: 1,
      });

      board.acceptQuest(quest.id);
      expect(board.completeQuest(quest.id)).toBe(false);
    });
  });

  describe('failQuest', () => {
    it('应能标记任务失败', () => {
      const quest = board.createQuest({
        title: '测试',
        description: '测试',
        publisherNpcId: 'npc_1',
        type: QuestType.COLLECT,
        difficulty: QuestDifficulty.NORMAL,
        objectives: [],
        rewards: {},
        timeLimit: 0,
        minRelationshipLevel: '',
        minPlayerLevel: 1,
      });

      board.acceptQuest(quest.id);
      expect(board.failQuest(quest.id)).toBe(true);
      expect(quest.status).toBe(QuestStatus.FAILED);
    });

    it('非活跃任务不能失败', () => {
      const quest = board.createQuest({
        title: '测试',
        description: '测试',
        publisherNpcId: 'npc_1',
        type: QuestType.COLLECT,
        difficulty: QuestDifficulty.NORMAL,
        objectives: [],
        rewards: {},
        timeLimit: 0,
        minRelationshipLevel: '',
        minPlayerLevel: 1,
      });

      expect(board.failQuest(quest.id)).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // 超时
  // -----------------------------------------------------------------------

  describe('checkExpired', () => {
    it('超时任务应被标记为过期', () => {
      const quest = board.createQuest({
        title: '限时任务',
        description: '限时任务',
        publisherNpcId: 'npc_1',
        type: QuestType.COLLECT,
        difficulty: QuestDifficulty.NORMAL,
        objectives: [],
        rewards: {},
        timeLimit: 60, // 60 秒
        minRelationshipLevel: '',
        minPlayerLevel: 1,
      });

      board.acceptQuest(quest.id);

      // 模拟时间流逝
      const expired = board.checkExpired(Date.now() + 120000); // 2 分钟后
      expect(expired).toHaveLength(1);
      expect(quest.status).toBe(QuestStatus.EXPIRED);
    });

    it('未超时任务不应过期', () => {
      const quest = board.createQuest({
        title: '限时任务',
        description: '限时任务',
        publisherNpcId: 'npc_1',
        type: QuestType.COLLECT,
        difficulty: QuestDifficulty.NORMAL,
        objectives: [],
        rewards: {},
        timeLimit: 600,
        minRelationshipLevel: '',
        minPlayerLevel: 1,
      });

      board.acceptQuest(quest.id);
      const expired = board.checkExpired(Date.now() + 100); // 0.1 秒后
      expect(expired).toHaveLength(0);
      expect(quest.status).toBe(QuestStatus.ACTIVE);
    });

    it('无限时任务不应过期', () => {
      const quest = board.createQuest({
        title: '无限任务',
        description: '无限任务',
        publisherNpcId: 'npc_1',
        type: QuestType.COLLECT,
        difficulty: QuestDifficulty.NORMAL,
        objectives: [],
        rewards: {},
        timeLimit: 0,
        minRelationshipLevel: '',
        minPlayerLevel: 1,
      });

      board.acceptQuest(quest.id);
      const expired = board.checkExpired(Date.now() + 999999);
      expect(expired).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // 查询
  // -----------------------------------------------------------------------

  describe('查询', () => {
    it('应能按发布者查询任务', () => {
      board.createQuest({
        title: '任务1',
        description: '',
        publisherNpcId: 'npc_1',
        type: QuestType.COLLECT,
        difficulty: QuestDifficulty.NORMAL,
        objectives: [],
        rewards: {},
        timeLimit: 0,
        minRelationshipLevel: '',
        minPlayerLevel: 1,
      });
      board.createQuest({
        title: '任务2',
        description: '',
        publisherNpcId: 'npc_1',
        type: QuestType.DEFEAT,
        difficulty: QuestDifficulty.HARD,
        objectives: [],
        rewards: {},
        timeLimit: 0,
        minRelationshipLevel: '',
        minPlayerLevel: 1,
      });
      board.createQuest({
        title: '任务3',
        description: '',
        publisherNpcId: 'npc_2',
        type: QuestType.EXPLORE,
        difficulty: QuestDifficulty.EASY,
        objectives: [],
        rewards: {},
        timeLimit: 0,
        minRelationshipLevel: '',
        minPlayerLevel: 1,
      });

      expect(board.getQuestsByPublisher('npc_1')).toHaveLength(2);
      expect(board.getQuestsByPublisher('npc_2')).toHaveLength(1);
    });

    it('应能按状态查询任务', () => {
      const q1 = board.createQuest({
        title: '任务1',
        description: '',
        publisherNpcId: 'npc_1',
        type: QuestType.COLLECT,
        difficulty: QuestDifficulty.NORMAL,
        objectives: [],
        rewards: {},
        timeLimit: 0,
        minRelationshipLevel: '',
        minPlayerLevel: 1,
      });

      expect(board.getQuestsByStatus(QuestStatus.AVAILABLE)).toHaveLength(1);

      board.acceptQuest(q1.id);
      expect(board.getQuestsByStatus(QuestStatus.AVAILABLE)).toHaveLength(0);
      expect(board.getQuestsByStatus(QuestStatus.ACTIVE)).toHaveLength(1);
    });

    it('应能获取可接取任务（筛选等级和好感度）', () => {
      board.createQuest({
        title: '简单任务',
        description: '',
        publisherNpcId: 'npc_1',
        type: QuestType.COLLECT,
        difficulty: QuestDifficulty.EASY,
        objectives: [],
        rewards: {},
        timeLimit: 0,
        minRelationshipLevel: '',
        minPlayerLevel: 1,
      });
      board.createQuest({
        title: '高级任务',
        description: '',
        publisherNpcId: 'npc_1',
        type: QuestType.DEFEAT,
        difficulty: QuestDifficulty.HARD,
        objectives: [],
        rewards: {},
        timeLimit: 0,
        minRelationshipLevel: '',
        minPlayerLevel: 5,
      });

      const available = board.getAvailableQuests(3);
      expect(available).toHaveLength(1);
      expect(available[0].title).toBe('简单任务');
    });

    it('应能获取活跃任务', () => {
      const q = board.createQuest({
        title: '测试',
        description: '',
        publisherNpcId: 'npc_1',
        type: QuestType.COLLECT,
        difficulty: QuestDifficulty.NORMAL,
        objectives: [],
        rewards: {},
        timeLimit: 0,
        minRelationshipLevel: '',
        minPlayerLevel: 1,
      });

      board.acceptQuest(q.id);
      expect(board.getActiveQuests()).toHaveLength(1);
    });

    it('应能获取任务进度', () => {
      const quest = board.createQuest({
        title: '收集',
        description: '',
        publisherNpcId: 'npc_1',
        type: QuestType.COLLECT,
        difficulty: QuestDifficulty.NORMAL,
        objectives: [
          { description: '木材', type: QuestType.COLLECT, targetId: 'wood', requiredAmount: 10, currentAmount: 5 },
        ],
        rewards: {},
        timeLimit: 0,
        minRelationshipLevel: '',
        minPlayerLevel: 1,
      });

      expect(board.getProgress(quest.id)).toBe(0.5);
    });

    it('应能获取所有任务', () => {
      board.createQuest({
        title: '任务1',
        description: '',
        publisherNpcId: 'npc_1',
        type: QuestType.COLLECT,
        difficulty: QuestDifficulty.NORMAL,
        objectives: [],
        rewards: {},
        timeLimit: 0,
        minRelationshipLevel: '',
        minPlayerLevel: 1,
      });
      board.createQuest({
        title: '任务2',
        description: '',
        publisherNpcId: 'npc_2',
        type: QuestType.DEFEAT,
        difficulty: QuestDifficulty.HARD,
        objectives: [],
        rewards: {},
        timeLimit: 0,
        minRelationshipLevel: '',
        minPlayerLevel: 1,
      });

      expect(board.getAllQuests()).toHaveLength(2);
    });

    it('应能移除任务', () => {
      const quest = board.createQuest({
        title: '测试',
        description: '',
        publisherNpcId: 'npc_1',
        type: QuestType.COLLECT,
        difficulty: QuestDifficulty.NORMAL,
        objectives: [],
        rewards: {},
        timeLimit: 0,
        minRelationshipLevel: '',
        minPlayerLevel: 1,
      });

      expect(board.removeQuest(quest.id)).toBe(true);
      expect(board.getQuest(quest.id)).toBeUndefined();
    });
  });

  // -----------------------------------------------------------------------
  // 多目标
  // -----------------------------------------------------------------------

  describe('多目标任务', () => {
    it('应能处理多目标任务', () => {
      const quest = board.createQuest({
        title: '复合任务',
        description: '收集和击败',
        publisherNpcId: 'npc_1',
        type: QuestType.COLLECT,
        difficulty: QuestDifficulty.HARD,
        objectives: [
          { description: '收集木材', type: QuestType.COLLECT, targetId: 'wood', requiredAmount: 5, currentAmount: 0 },
          { description: '击败哥布林', type: QuestType.DEFEAT, targetId: 'goblin', requiredAmount: 3, currentAmount: 0 },
        ],
        rewards: { gold: 200, exp: 100 },
        timeLimit: 0,
        minRelationshipLevel: '',
        minPlayerLevel: 1,
      });

      board.acceptQuest(quest.id);

      // 完成第一个目标
      board.updateObjective(quest.id, 0, 5);
      expect(quest.status).toBe(QuestStatus.ACTIVE); // 还有未完成目标

      // 完成第二个目标
      board.updateObjective(quest.id, 1, 3);
      expect(quest.status).toBe(QuestStatus.COMPLETED);
    });

    it('进度应反映所有目标', () => {
      const quest = board.createQuest({
        title: '复合任务',
        description: '',
        publisherNpcId: 'npc_1',
        type: QuestType.COLLECT,
        difficulty: QuestDifficulty.NORMAL,
        objectives: [
          { description: '木材', type: QuestType.COLLECT, targetId: 'wood', requiredAmount: 10, currentAmount: 5 },
          { description: '石头', type: QuestType.COLLECT, targetId: 'stone', requiredAmount: 10, currentAmount: 0 },
        ],
        rewards: {},
        timeLimit: 0,
        minRelationshipLevel: '',
        minPlayerLevel: 1,
      });

      expect(board.getProgress(quest.id)).toBe(0.25); // 5 / 20
    });
  });

  // -----------------------------------------------------------------------
  // 序列化
  // -----------------------------------------------------------------------

  describe('serialize / deserialize', () => {
    it('应能序列化和反序列化任务数据', () => {
      const quest = board.createQuest({
        title: '测试任务',
        description: '描述',
        publisherNpcId: 'npc_1',
        type: QuestType.COLLECT,
        difficulty: QuestDifficulty.NORMAL,
        objectives: [
          { description: '收集', type: QuestType.COLLECT, targetId: 'wood', requiredAmount: 5, currentAmount: 3 },
        ],
        rewards: { gold: 100 },
        timeLimit: 0,
        minRelationshipLevel: '',
        minPlayerLevel: 1,
      });

      board.acceptQuest(quest.id);

      const data = board.serialize();
      const newBoard = new QuestBoard(eventBus);
      newBoard.deserialize(data as Record<string, unknown>);

      const restored = newBoard.getQuest(quest.id);
      expect(restored).toBeDefined();
      expect(restored!.title).toBe('测试任务');
      expect(restored!.status).toBe(QuestStatus.ACTIVE);
      expect(restored!.objectives[0].currentAmount).toBe(3);
    });
  });
});
