/**
 * SiegeTaskManager 攻城中断处理测试 (I4)
 *
 * 验证：
 * - 暂停攻城: sieging → paused，保存进度快照
 * - 不能暂停非 sieging 状态的任务
 * - 恢复攻城: paused → sieging，清除暂停元数据
 * - 取消攻城: paused → returning，创建回城行军
 * - 暂停快照持久化（defenseRatio, elapsedBattleTime）
 * - 发射正确的事件（paused/resumed/cancelled）
 * - 从暂停状态取消后释放攻占锁
 *
 * @module engine/map/__tests__/SiegeTaskManager.interrupt.test
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SiegeTaskManager, SIEGE_TASK_EVENTS } from '../SiegeTaskManager';
import type { SiegeTaskStatus } from '../../../core/map/siege-task.types';

// ── 工厂函数 ──────────────────────────────────

function createTaskParams(overrides: Partial<Parameters<SiegeTaskManager['createTask']>[0]> = {}) {
  return {
    targetId: 'city-xuchang',
    targetName: '许昌',
    sourceId: 'city-changsha',
    sourceName: '长沙',
    strategy: null as any,
    expedition: { forceId: 'force-1', heroId: 'hero-guanyu', heroName: '关羽', troops: 3000 },
    cost: { troops: 2000, grain: 500 },
    marchPath: [{ x: 10, y: 20 }, { x: 15, y: 25 }],
    faction: 'wei' as const,
    ...overrides,
  };
}

/** 将任务推进到 sieging 状态 */
function advanceToSieging(manager: SiegeTaskManager, taskId: string): void {
  manager.advanceStatus(taskId, 'marching');
  manager.advanceStatus(taskId, 'sieging');
}

/** 将任务推进到 settling 状态 */
function advanceToSettling(manager: SiegeTaskManager, taskId: string): void {
  manager.advanceStatus(taskId, 'marching');
  manager.advanceStatus(taskId, 'sieging');
  manager.advanceStatus(taskId, 'settling');
}

// ── Mock MarchingSystem ───────────────────────

function createMockMarchingSystem() {
  const returnMarches: Array<{
    fromCityId: string;
    toCityId: string;
    troops: number;
    general: string;
    faction: string;
    siegeTaskId?: string;
  }> = [];

  return {
    returnMarches,
    createReturnMarch(params: {
      fromCityId: string;
      toCityId: string;
      troops: number;
      general: string;
      faction: 'wei' | 'shu' | 'wu' | 'neutral';
      siegeTaskId?: string;
    }) {
      returnMarches.push(params);
      return { id: 'return-march-1' }; // non-null = success
    },
  };
}

/** Mock marching system where createReturnMarch returns null (unreachable path) */
function createUnreachableMockMarchingSystem() {
  const callCount = { value: 0 };
  return {
    callCount,
    createReturnMarch(_params: {
      fromCityId: string;
      toCityId: string;
      troops: number;
      general: string;
      faction: string;
      siegeTaskId?: string;
    }): null {
      callCount.value++;
      return null; // route unreachable
    },
  };
}

// ── 测试套件 ──────────────────────────────────

describe('SiegeTaskManager siege interrupt handling (I4)', () => {
  let manager: SiegeTaskManager;

  beforeEach(() => {
    manager = new SiegeTaskManager();
  });

  // ─────────────────────────────────────────────
  // 1. Pause active siege task (sieging → paused)
  // ─────────────────────────────────────────────
  describe('pauseSiege', () => {
    it('should pause an active sieging task (sieging → paused)', () => {
      const task = manager.createTask(createTaskParams());
      advanceToSieging(manager, task!.id);

      const result = manager.pauseSiege(task!.id);

      expect(result).toBe(true);
      expect(task!.status).toBe('paused');
      expect(task!.pausedAt).toBeGreaterThan(0);
    });

    it('should emit statusChanged and paused events', () => {
      const events: Array<{ event: string; data: unknown }> = [];
      manager.setDependencies({
        eventBus: {
          emit: (event: string, data: unknown) => events.push({ event, data }),
          on: () => {},
          off: () => {},
        },
      });

      const task = manager.createTask(createTaskParams());
      advanceToSieging(manager, task!.id);
      events.length = 0; // clear events from advanceStatus

      manager.pauseSiege(task!.id);

      const statusEvent = events.find(e => e.event === SIEGE_TASK_EVENTS.STATUS_CHANGED);
      expect(statusEvent).toBeDefined();
      expect((statusEvent as any).data).toMatchObject({
        taskId: task!.id,
        from: 'sieging',
        to: 'paused',
      });

      const pausedEvent = events.find(e => e.event === SIEGE_TASK_EVENTS.PAUSED);
      expect(pausedEvent).toBeDefined();
      expect((pausedEvent as any).data).toHaveProperty('taskId', task!.id);
    });
  });

  // ─────────────────────────────────────────────
  // 2. Cannot pause non-sieging task
  // ─────────────────────────────────────────────
  describe('pauseSiege rejection', () => {
    it('should reject pause for preparing task', () => {
      const task = manager.createTask(createTaskParams());

      const result = manager.pauseSiege(task!.id);

      expect(result).toBe(false);
      expect(task!.status).toBe('preparing');
    });

    it('should reject pause for marching task', () => {
      const task = manager.createTask(createTaskParams());
      manager.advanceStatus(task!.id, 'marching');

      const result = manager.pauseSiege(task!.id);

      expect(result).toBe(false);
      expect(task!.status).toBe('marching');
    });

    it('should reject pause for already paused task', () => {
      const task = manager.createTask(createTaskParams());
      advanceToSieging(manager, task!.id);
      manager.pauseSiege(task!.id);

      const result = manager.pauseSiege(task!.id);

      expect(result).toBe(false);
      expect(task!.status).toBe('paused');
    });

    it('should reject pause for non-existent task', () => {
      const result = manager.pauseSiege('nonexistent');

      expect(result).toBe(false);
    });

    it('should reject pause for settling/returning/completed tasks', () => {
      const task = manager.createTask(createTaskParams());
      const statuses: SiegeTaskStatus[] = ['marching', 'sieging', 'settling'];
      for (const s of statuses) {
        manager.advanceStatus(task!.id, s);
      }

      // Now in 'settling'
      expect(manager.pauseSiege(task!.id)).toBe(false);

      manager.advanceStatus(task!.id, 'returning');
      expect(manager.pauseSiege(task!.id)).toBe(false);

      manager.advanceStatus(task!.id, 'completed');
      expect(manager.pauseSiege(task!.id)).toBe(false);
    });
  });

  // ─────────────────────────────────────────────
  // 3. Resume paused siege (paused → sieging)
  // ─────────────────────────────────────────────
  describe('resumeSiege', () => {
    it('should resume a paused siege (paused → sieging)', () => {
      const task = manager.createTask(createTaskParams());
      advanceToSieging(manager, task!.id);
      manager.pauseSiege(task!.id);

      const result = manager.resumeSiege(task!.id);

      expect(result).toBe(true);
      expect(task!.status).toBe('sieging');
      expect(task!.pausedAt).toBeNull();
      expect(task!.pauseSnapshot).toBeNull();
    });

    it('should emit statusChanged and resumed events with saved snapshot', () => {
      const events: Array<{ event: string; data: unknown }> = [];
      manager.setDependencies({
        eventBus: {
          emit: (event: string, data: unknown) => events.push({ event, data }),
          on: () => {},
          off: () => {},
        },
      });

      const task = manager.createTask(createTaskParams());
      advanceToSieging(manager, task!.id);
      manager.pauseSiege(task!.id, { defenseRatio: 0.65, elapsedBattleTime: 12000 });
      events.length = 0;

      manager.resumeSiege(task!.id);

      const statusEvent = events.find(e => e.event === SIEGE_TASK_EVENTS.STATUS_CHANGED);
      expect(statusEvent).toBeDefined();
      expect((statusEvent as any).data).toMatchObject({
        taskId: task!.id,
        from: 'paused',
        to: 'sieging',
      });

      const resumedEvent = events.find(e => e.event === SIEGE_TASK_EVENTS.RESUMED);
      expect(resumedEvent).toBeDefined();
      expect((resumedEvent as any).data.savedSnapshot).toEqual({
        defenseRatio: 0.65,
        elapsedBattleTime: 12000,
      });
    });

    it('should reject resume for non-paused task', () => {
      const task = manager.createTask(createTaskParams());
      advanceToSieging(manager, task!.id);

      expect(manager.resumeSiege(task!.id)).toBe(false);
      expect(task!.status).toBe('sieging');
    });

    it('should reject resume for non-existent task', () => {
      expect(manager.resumeSiege('nonexistent')).toBe(false);
    });
  });

  // ─────────────────────────────────────────────
  // 4. Cancel paused siege creates return march
  // ─────────────────────────────────────────────
  describe('cancelSiege', () => {
    it('should cancel paused siege and create return march', () => {
      const task = manager.createTask(createTaskParams());
      advanceToSieging(manager, task!.id);
      manager.pauseSiege(task!.id);

      const mockMarching = createMockMarchingSystem();
      const result = manager.cancelSiege(task!.id, mockMarching);

      expect(result).toBe(true);
      expect(task!.status).toBe('returning');
      expect(task!.pausedAt).toBeNull();
      expect(task!.pauseSnapshot).toBeNull();
      expect(task!.siegeCompletedAt).toBeGreaterThan(0);

      // Verify return march was created
      expect(mockMarching.returnMarches).toHaveLength(1);
      expect(mockMarching.returnMarches[0]).toMatchObject({
        fromCityId: 'city-xuchang',
        toCityId: 'city-changsha',
        troops: 3000,
        general: '关羽',
        siegeTaskId: task!.id,
      });
    });

    it('should cancel without marching system (null)', () => {
      const task = manager.createTask(createTaskParams());
      advanceToSieging(manager, task!.id);
      manager.pauseSiege(task!.id);

      const result = manager.cancelSiege(task!.id, null);

      expect(result).toBe(true);
      expect(task!.status).toBe('returning');
    });

    it('should emit statusChanged and cancelled events', () => {
      const events: Array<{ event: string; data: unknown }> = [];
      manager.setDependencies({
        eventBus: {
          emit: (event: string, data: unknown) => events.push({ event, data }),
          on: () => {},
          off: () => {},
        },
      });

      const task = manager.createTask(createTaskParams());
      advanceToSieging(manager, task!.id);
      manager.pauseSiege(task!.id);
      events.length = 0;

      const mockMarching = createMockMarchingSystem();
      manager.cancelSiege(task!.id, mockMarching);

      const statusEvent = events.find(e => e.event === SIEGE_TASK_EVENTS.STATUS_CHANGED);
      expect(statusEvent).toBeDefined();
      expect((statusEvent as any).data).toMatchObject({
        taskId: task!.id,
        from: 'paused',
        to: 'returning',
      });

      const cancelledEvent = events.find(e => e.event === SIEGE_TASK_EVENTS.CANCELLED);
      expect(cancelledEvent).toBeDefined();
      expect((cancelledEvent as any).data).toMatchObject({
        taskId: task!.id,
        targetId: 'city-xuchang',
      });
    });

    it('should allow cancel from sieging state (auto-pause then retreat)', () => {
      const task = manager.createTask(createTaskParams());
      advanceToSieging(manager, task!.id);

      const mockMarching = createMockMarchingSystem();
      expect(manager.cancelSiege(task!.id, mockMarching)).toBe(true);
      expect(task!.status).toBe('returning');
      expect(mockMarching.returnMarches).toHaveLength(1);
    });

    it('should reject cancel for non-existent task', () => {
      const mockMarching = createMockMarchingSystem();
      expect(manager.cancelSiege('nonexistent', mockMarching)).toBe(false);
    });

    // P1-2: cancelSiege不可达降级 — createReturnMarch返回null时直接completed
    it('should complete task directly when createReturnMarch returns null (unreachable path)', () => {
      const task = manager.createTask(createTaskParams());
      advanceToSieging(manager, task!.id);
      manager.pauseSiege(task!.id);

      const unreachableMarching = createUnreachableMockMarchingSystem();
      const result = manager.cancelSiege(task!.id, unreachableMarching);

      expect(result).toBe(true);
      expect(task!.status).toBe('completed');
      expect(task!.returnCompletedAt).toBeGreaterThan(0);
      expect(manager.isSiegeLocked('city-xuchang')).toBe(false);
      expect(unreachableMarching.callCount.value).toBe(1);
    });

    // P1-2: 不可达降级应发射 completed 和 cancelled 事件
    it('should emit completed and cancelled events when return march is unreachable', () => {
      const events: Array<{ event: string; data: unknown }> = [];
      manager.setDependencies({
        eventBus: {
          emit: (event: string, data: unknown) => events.push({ event, data }),
          on: () => {},
          off: () => {},
        },
      });

      const task = manager.createTask(createTaskParams());
      advanceToSieging(manager, task!.id);
      manager.pauseSiege(task!.id);
      events.length = 0;

      const unreachableMarching = createUnreachableMockMarchingSystem();
      manager.cancelSiege(task!.id, unreachableMarching);

      const eventTypes = events.map(e => e.event);
      expect(eventTypes).toContain('siegeTask:completed');
      expect(eventTypes).toContain('siegeTask:cancelled');

      const completedEvt = events.find(e => e.event === 'siegeTask:completed');
      expect((completedEvt as any).data.task.status).toBe('completed');

      const cancelledEvt = events.find(e => e.event === 'siegeTask:cancelled');
      expect((cancelledEvt as any).data).toMatchObject({
        taskId: task!.id,
        targetId: 'city-xuchang',
      });
    });

    // P1-3: cancelSiege支持settling状态
    it('should allow cancel from settling state', () => {
      const task = manager.createTask(createTaskParams());
      advanceToSettling(manager, task!.id);

      const mockMarching = createMockMarchingSystem();
      const result = manager.cancelSiege(task!.id, mockMarching);

      expect(result).toBe(true);
      expect(task!.status).toBe('returning');
      expect(task!.siegeCompletedAt).toBeGreaterThan(0);
      expect(mockMarching.returnMarches).toHaveLength(1);
      expect(mockMarching.returnMarches[0]).toMatchObject({
        fromCityId: 'city-xuchang',
        toCityId: 'city-changsha',
        troops: 3000,
        general: '关羽',
        siegeTaskId: task!.id,
      });
    });

    // P1-3: settling状态cancelSiege不可达降级
    it('should complete task directly when cancel from settling with unreachable return march', () => {
      const task = manager.createTask(createTaskParams());
      advanceToSettling(manager, task!.id);

      const unreachableMarching = createUnreachableMockMarchingSystem();
      const result = manager.cancelSiege(task!.id, unreachableMarching);

      expect(result).toBe(true);
      expect(task!.status).toBe('completed');
      expect(task!.returnCompletedAt).toBeGreaterThan(0);
      expect(manager.isSiegeLocked('city-xuchang')).toBe(false);
    });
  });

  // ─────────────────────────────────────────────
  // 5. Pause saves progress snapshot
  // ─────────────────────────────────────────────
  describe('pause snapshot persistence', () => {
    it('should save progress snapshot with provided defenseRatio and elapsedBattleTime', () => {
      const task = manager.createTask(createTaskParams());
      advanceToSieging(manager, task!.id);

      manager.pauseSiege(task!.id, { defenseRatio: 0.42, elapsedBattleTime: 35000 });

      expect(task!.pauseSnapshot).not.toBeNull();
      expect(task!.pauseSnapshot!.defenseRatio).toBe(0.42);
      expect(task!.pauseSnapshot!.elapsedBattleTime).toBe(35000);
      expect(task!.pausedAt).toBeGreaterThan(0);
    });

    it('should save default snapshot when no params provided', () => {
      const task = manager.createTask(createTaskParams());
      advanceToSieging(manager, task!.id);

      manager.pauseSiege(task!.id);

      expect(task!.pauseSnapshot).not.toBeNull();
      expect(task!.pauseSnapshot!.defenseRatio).toBe(1);
      expect(task!.pauseSnapshot!.elapsedBattleTime).toBe(0);
    });

    it('should clear snapshot on resume', () => {
      const task = manager.createTask(createTaskParams());
      advanceToSieging(manager, task!.id);

      manager.pauseSiege(task!.id, { defenseRatio: 0.5, elapsedBattleTime: 10000 });
      expect(task!.pauseSnapshot).not.toBeNull();

      manager.resumeSiege(task!.id);
      expect(task!.pauseSnapshot).toBeNull();
      expect(task!.pausedAt).toBeNull();
    });

    it('should clear snapshot on cancel', () => {
      const task = manager.createTask(createTaskParams());
      advanceToSieging(manager, task!.id);

      manager.pauseSiege(task!.id, { defenseRatio: 0.7, elapsedBattleTime: 20000 });
      expect(task!.pauseSnapshot).not.toBeNull();

      const mockMarching = createMockMarchingSystem();
      manager.cancelSiege(task!.id, mockMarching);
      expect(task!.pauseSnapshot).toBeNull();
      expect(task!.pausedAt).toBeNull();
    });

    it('should survive serialization round-trip', () => {
      const task = manager.createTask(createTaskParams());
      advanceToSieging(manager, task!.id);
      manager.pauseSiege(task!.id, { defenseRatio: 0.33, elapsedBattleTime: 45000 });

      const data = manager.serialize();

      const manager2 = new SiegeTaskManager();
      manager2.deserialize(data);

      const restored = manager2.getTask(task!.id);
      expect(restored).not.toBeNull();
      expect(restored!.status).toBe('paused');
      expect(restored!.pauseSnapshot).not.toBeNull();
      expect(restored!.pauseSnapshot!.defenseRatio).toBe(0.33);
      expect(restored!.pauseSnapshot!.elapsedBattleTime).toBe(45000);
      expect(restored!.pausedAt).toBeGreaterThan(0);
    });
  });

  // ─────────────────────────────────────────────
  // 6. Paused task is considered active (not terminal)
  // ─────────────────────────────────────────────
  describe('paused task in queries', () => {
    it('should appear in active tasks', () => {
      const task = manager.createTask(createTaskParams());
      advanceToSieging(manager, task!.id);
      manager.pauseSiege(task!.id);

      const active = manager.getActiveTasks();
      expect(active).toHaveLength(1);
      expect(active[0].id).toBe(task!.id);
      expect(active[0].status).toBe('paused');
    });

    it('should appear in getTasksByStatus', () => {
      const task = manager.createTask(createTaskParams());
      advanceToSieging(manager, task!.id);
      manager.pauseSiege(task!.id);

      const paused = manager.getTasksByStatus('paused');
      expect(paused).toHaveLength(1);
    });

    it('should appear in getTaskByTarget', () => {
      const task = manager.createTask(createTaskParams());
      advanceToSieging(manager, task!.id);
      manager.pauseSiege(task!.id);

      const found = manager.getTaskByTarget('city-xuchang');
      expect(found).not.toBeNull();
      expect(found!.status).toBe('paused');
    });

    it('should still hold siege lock while paused', () => {
      const task = manager.createTask(createTaskParams());
      advanceToSieging(manager, task!.id);
      manager.pauseSiege(task!.id);

      expect(manager.isSiegeLocked('city-xuchang')).toBe(true);

      // Should not be able to create new task on same target
      const blocked = manager.createTask(createTaskParams());
      expect(blocked).toBeNull();
    });
  });

  // ─────────────────────────────────────────────
  // 7. Full interrupt flow: pause → resume → pause → cancel
  // ─────────────────────────────────────────────
  describe('interrupt flow integration', () => {
    it('should support pause → resume → pause → cancel cycle', () => {
      const task = manager.createTask(createTaskParams());
      advanceToSieging(manager, task!.id);

      // First pause
      manager.pauseSiege(task!.id, { defenseRatio: 0.8, elapsedBattleTime: 5000 });
      expect(task!.status).toBe('paused');

      // Resume
      manager.resumeSiege(task!.id);
      expect(task!.status).toBe('sieging');
      expect(task!.pauseSnapshot).toBeNull();

      // Second pause with updated progress
      manager.pauseSiege(task!.id, { defenseRatio: 0.4, elapsedBattleTime: 15000 });
      expect(task!.status).toBe('paused');
      expect(task!.pauseSnapshot!.defenseRatio).toBe(0.4);

      // Cancel
      const mockMarching = createMockMarchingSystem();
      manager.cancelSiege(task!.id, mockMarching);
      expect(task!.status).toBe('returning');
      expect(task!.pauseSnapshot).toBeNull();
      expect(mockMarching.returnMarches).toHaveLength(1);
    });
  });
});
