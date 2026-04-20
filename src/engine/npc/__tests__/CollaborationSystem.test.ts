/**
 * CollaborationSystem 单元测试
 *
 * 覆盖：创建协作任务、NPC 加入/离开、自动匹配、任务进度更新。
 *
 * @module engine/npc/__tests__/CollaborationSystem.test
 */

import { NPCEventBus } from '../NPCEventBus';
import { CollaborationSystem } from '../CollaborationSystem';
import type { INPCManagerForCollaboration } from '../CollaborationSystem';
import { NPCProfession, NPCState } from '../types';

// ---------------------------------------------------------------------------
// 测试辅助：创建 Mock NPC 管理器
// ---------------------------------------------------------------------------

function createMockNPCManager(
  npcs: { id: string; profession: NPCProfession; state: string }[] = [],
): INPCManagerForCollaboration {
  return {
    getAllNPCs: () => npcs,
  };
}

const defaultNPCs = [
  { id: 'farmer1', profession: NPCProfession.FARMER, state: 'idle' },
  { id: 'farmer2', profession: NPCProfession.FARMER, state: 'idle' },
  { id: 'farmer3', profession: NPCProfession.FARMER, state: 'idle' },
  { id: 'merchant1', profession: NPCProfession.MERCHANT, state: 'idle' },
  { id: 'soldier1', profession: NPCProfession.SOLDIER, state: 'idle' },
  { id: 'soldier2', profession: NPCProfession.SOLDIER, state: 'idle' },
  { id: 'general1', profession: NPCProfession.GENERAL, state: 'idle' },
  { id: 'villager1', profession: NPCProfession.VILLAGER, state: 'idle' },
  { id: 'craftsman1', profession: NPCProfession.CRAFTSMAN, state: 'working' },
];

// ---------------------------------------------------------------------------
// 测试
// ---------------------------------------------------------------------------

describe('CollaborationSystem', () => {
  let eventBus: NPCEventBus;
  let system: CollaborationSystem;

  beforeEach(() => {
    eventBus = new NPCEventBus();
    system = new CollaborationSystem(createMockNPCManager(defaultNPCs), eventBus);
  });

  describe('createTask', () => {
    it('should create a collaboration task', () => {
      const task = system.createTask({
        type: 'transport',
        requiredProfessions: [NPCProfession.FARMER, NPCProfession.MERCHANT, NPCProfession.SOLDIER],
        minParticipants: 3,
        maxParticipants: 5,
        location: { x: 10, y: 20 },
        duration: 60,
        rewards: { gold: 100 },
      });

      expect(task.id).toBeDefined();
      expect(task.type).toBe('transport');
      expect(task.progress).toBe(0);
      expect(task.participants).toEqual([]);
    });

    it('should emit collaborationTaskCreated event', () => {
      const events: any[] = [];
      eventBus.on('collaborationTaskCreated', (task: any) => events.push(task));

      system.createTask({
        type: 'harvest',
        requiredProfessions: [NPCProfession.FARMER],
        minParticipants: 2,
        maxParticipants: 4,
        location: { x: 5, y: 5 },
        duration: 30,
        rewards: { food: 50 },
      });

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('harvest');
    });
  });

  describe('joinTask', () => {
    it('should allow NPC to join a task', () => {
      const task = system.createTask({
        type: 'transport',
        requiredProfessions: [NPCProfession.FARMER, NPCProfession.MERCHANT, NPCProfession.SOLDIER],
        minParticipants: 2,
        maxParticipants: 5,
        location: { x: 10, y: 20 },
        duration: 60,
        rewards: { gold: 100 },
      });

      expect(system.joinTask(task.id, 'farmer1')).toBe(true);
      expect(task.participants).toContain('farmer1');
    });

    it('should reject NPC with wrong profession', () => {
      const task = system.createTask({
        type: 'patrol',
        requiredProfessions: [NPCProfession.SOLDIER],
        minParticipants: 2,
        maxParticipants: 3,
        location: { x: 0, y: 0 },
        duration: 45,
        rewards: { exp: 20 },
      });

      expect(system.joinTask(task.id, 'farmer1')).toBe(false);
      expect(task.participants).toHaveLength(0);
    });

    it('should reject when task is full', () => {
      const task = system.createTask({
        type: 'trade_caravan',
        requiredProfessions: [NPCProfession.MERCHANT],
        minParticipants: 1,
        maxParticipants: 1,
        location: { x: 0, y: 0 },
        duration: 30,
        rewards: { gold: 50 },
      });

      system.joinTask(task.id, 'merchant1');
      expect(system.joinTask(task.id, 'farmer1')).toBe(false);
    });

    it('should reject duplicate join', () => {
      const task = system.createTask({
        type: 'harvest',
        requiredProfessions: [NPCProfession.FARMER],
        minParticipants: 1,
        maxParticipants: 3,
        location: { x: 0, y: 0 },
        duration: 30,
        rewards: {},
      });

      system.joinTask(task.id, 'farmer1');
      expect(system.joinTask(task.id, 'farmer1')).toBe(false);
    });
  });

  describe('leaveTask', () => {
    it('should allow NPC to leave a task', () => {
      const task = system.createTask({
        type: 'harvest',
        requiredProfessions: [NPCProfession.FARMER],
        minParticipants: 1,
        maxParticipants: 3,
        location: { x: 0, y: 0 },
        duration: 30,
        rewards: {},
      });

      system.joinTask(task.id, 'farmer1');
      expect(system.leaveTask(task.id, 'farmer1')).toBe(true);
      expect(task.participants).toHaveLength(0);
    });

    it('should return false for non-participant', () => {
      const task = system.createTask({
        type: 'harvest',
        requiredProfessions: [NPCProfession.FARMER],
        minParticipants: 1,
        maxParticipants: 3,
        location: { x: 0, y: 0 },
        duration: 30,
        rewards: {},
      });

      expect(system.leaveTask(task.id, 'farmer1')).toBe(false);
    });
  });

  describe('autoMatch', () => {
    it('should find matching NPCs for a task', () => {
      const task = system.createTask({
        type: 'transport',
        requiredProfessions: [NPCProfession.FARMER, NPCProfession.MERCHANT, NPCProfession.SOLDIER],
        minParticipants: 3,
        maxParticipants: 5,
        location: { x: 10, y: 20 },
        duration: 60,
        rewards: { gold: 100 },
      });

      const matched = system.autoMatch(task.id);

      // Should find at least one of each required profession
      expect(matched.length).toBeGreaterThanOrEqual(3);
      expect(matched).toContain('farmer1');
      expect(matched).toContain('merchant1');
      expect(matched).toContain('soldier1');
    });

    it('should not include busy NPCs', () => {
      const task = system.createTask({
        type: 'build',
        requiredProfessions: [NPCProfession.CRAFTSMAN],
        minParticipants: 1,
        maxParticipants: 2,
        location: { x: 0, y: 0 },
        duration: 30,
        rewards: {},
      });

      // craftsman1 is in 'working' state
      const matched = system.autoMatch(task.id);
      expect(matched).not.toContain('craftsman1');
    });

    it('should return empty for non-existent task', () => {
      expect(system.autoMatch('missing_task')).toEqual([]);
    });
  });

  describe('update', () => {
    it('should advance task progress', () => {
      const task = system.createTask({
        type: 'harvest',
        requiredProfessions: [NPCProfession.FARMER],
        minParticipants: 1,
        maxParticipants: 3,
        location: { x: 0, y: 0 },
        duration: 10, // 10 seconds
        rewards: { food: 50 },
      });

      system.joinTask(task.id, 'farmer1');

      // Advance 5 seconds (50% of duration)
      system.update(5);
      expect(task.progress).toBeCloseTo(0.5, 1);
    });

    it('should not advance when below min participants', () => {
      const task = system.createTask({
        type: 'patrol',
        requiredProfessions: [NPCProfession.SOLDIER],
        minParticipants: 2,
        maxParticipants: 3,
        location: { x: 0, y: 0 },
        duration: 10,
        rewards: {},
      });

      system.joinTask(task.id, 'soldier1');
      // Only 1 participant, min is 2
      system.update(5);
      expect(task.progress).toBe(0);
    });

    it('should complete and remove task when progress reaches 1', () => {
      const task = system.createTask({
        type: 'harvest',
        requiredProfessions: [NPCProfession.FARMER],
        minParticipants: 1,
        maxParticipants: 3,
        location: { x: 0, y: 0 },
        duration: 10,
        rewards: { food: 50 },
      });

      system.joinTask(task.id, 'farmer1');

      const completed: any[] = [];
      eventBus.on('collaborationTaskCompleted', (t: any) => completed.push(t));

      // Advance past completion
      system.update(15);
      expect(task.progress).toBe(1);
      expect(completed).toHaveLength(1);

      // Task should be removed
      expect(system.getTask(task.id)).toBeUndefined();
    });
  });

  describe('getActiveTasks / getNPCTask', () => {
    it('should list all active tasks', () => {
      system.createTask({
        type: 'harvest',
        requiredProfessions: [NPCProfession.FARMER],
        minParticipants: 1,
        maxParticipants: 3,
        location: { x: 0, y: 0 },
        duration: 30,
        rewards: {},
      });
      system.createTask({
        type: 'patrol',
        requiredProfessions: [NPCProfession.SOLDIER],
        minParticipants: 2,
        maxParticipants: 3,
        location: { x: 0, y: 0 },
        duration: 45,
        rewards: {},
      });

      expect(system.getActiveTasks()).toHaveLength(2);
    });

    it('should find task by NPC ID', () => {
      const task = system.createTask({
        type: 'harvest',
        requiredProfessions: [NPCProfession.FARMER],
        minParticipants: 1,
        maxParticipants: 3,
        location: { x: 0, y: 0 },
        duration: 30,
        rewards: {},
      });

      system.joinTask(task.id, 'farmer1');
      const found = system.getNPCTask('farmer1');
      expect(found).not.toBeNull();
      expect(found!.id).toBe(task.id);
    });

    it('should return null when NPC has no task', () => {
      expect(system.getNPCTask('farmer1')).toBeNull();
    });
  });
});
