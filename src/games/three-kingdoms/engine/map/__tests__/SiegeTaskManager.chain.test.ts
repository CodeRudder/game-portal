/**
 * SiegeTaskManager 链式集成测试
 *
 * 覆盖完整 P5→P10 状态机生命周期:
 *   preparing → marching → sieging → settling → returning → completed
 *
 * @module engine/map/__tests__/SiegeTaskManager.chain.test
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { SiegeTaskManager } from '../SiegeTaskManager';
import type { SiegeTaskStatus } from '../../../core/map/siege-task.types';

// ── 工厂函数 ──────────────────────────────────

function createDefaultTaskParams(overrides: Partial<Parameters<SiegeTaskManager['createTask']>[0]> = {}) {
  return {
    targetId: 'city-xuchang',
    targetName: '许昌',
    sourceId: 'city-changsha',
    sourceName: '长沙',
    strategy: null as SiegeTaskStatus | null,
    expedition: { forceId: 'force-1', heroId: 'hero-guanyu', heroName: '关羽', troops: 3000 },
    cost: { troops: 2000, grain: 500 },
    marchPath: [{ x: 10, y: 20 }, { x: 15, y: 25 }],
    faction: 'wei' as const,
    ...overrides,
  };
}

/** 将任务推进到终态 completed */
function advanceToCompleted(manager: SiegeTaskManager, taskId: string): void {
  const steps: SiegeTaskStatus[] = ['marching', 'sieging', 'settling', 'returning', 'completed'];
  for (const step of steps) {
    manager.advanceStatus(taskId, step);
  }
}

// ── 测试套件 ──────────────────────────────────

describe('SiegeTaskManager chain integration (P5→P10 lifecycle)', () => {
  let manager: SiegeTaskManager;

  beforeEach(() => {
    manager = new SiegeTaskManager();
  });

  // ─────────────────────────────────────────────
  // 1. Full happy path P5→P10
  // ─────────────────────────────────────────────
  describe('1. Full happy path P5→P10', () => {
    it('should traverse preparing→marching→sieging→settling→returning→completed with all transitions returning non-null', () => {
      const task = manager.createTask(createDefaultTaskParams());
      const taskId = task.id;

      // Verify initial state
      expect(task.status).toBe('preparing');

      // P5→P6: preparing → marching
      const marching = manager.advanceStatus(taskId, 'marching');
      expect(marching).not.toBeNull();
      expect(marching!.status).toBe('marching');
      expect(manager.getTask(taskId)!.status).toBe('marching');

      // P6→P7: marching → sieging
      const sieging = manager.advanceStatus(taskId, 'sieging');
      expect(sieging).not.toBeNull();
      expect(sieging!.status).toBe('sieging');
      expect(manager.getTask(taskId)!.status).toBe('sieging');

      // P7→P8: sieging → settling
      const settling = manager.advanceStatus(taskId, 'settling');
      expect(settling).not.toBeNull();
      expect(settling!.status).toBe('settling');
      expect(manager.getTask(taskId)!.status).toBe('settling');

      // P8→P9: settling → returning
      const returning = manager.advanceStatus(taskId, 'returning');
      expect(returning).not.toBeNull();
      expect(returning!.status).toBe('returning');
      expect(manager.getTask(taskId)!.status).toBe('returning');

      // P9→P10: returning → completed
      const completed = manager.advanceStatus(taskId, 'completed');
      expect(completed).not.toBeNull();
      expect(completed!.status).toBe('completed');
      expect(manager.getTask(taskId)!.status).toBe('completed');
    });

    it('should set correct timestamps at each transition', () => {
      const task = manager.createTask(createDefaultTaskParams());
      const taskId = task.id;

      expect(task.marchStartedAt).toBeNull();
      expect(task.arrivedAt).toBeNull();
      expect(task.siegeCompletedAt).toBeNull();
      expect(task.returnCompletedAt).toBeNull();

      manager.advanceStatus(taskId, 'marching');
      expect(manager.getTask(taskId)!.marchStartedAt).toBeGreaterThan(0);

      manager.advanceStatus(taskId, 'sieging');
      expect(manager.getTask(taskId)!.arrivedAt).toBeGreaterThan(0);

      manager.advanceStatus(taskId, 'settling');
      // settling does not set a dedicated timestamp — siegeCompletedAt is set at 'returning'
      expect(manager.getTask(taskId)!.siegeCompletedAt).toBeNull();

      manager.advanceStatus(taskId, 'returning');
      expect(manager.getTask(taskId)!.siegeCompletedAt).toBeGreaterThan(0);

      manager.advanceStatus(taskId, 'completed');
      expect(manager.getTask(taskId)!.returnCompletedAt).toBeGreaterThan(0);
    });

    it('should emit statusChanged events for every transition', () => {
      const events: Array<{ event: string; data: unknown }> = [];
      manager.setDependencies({
        eventBus: {
          emit: (event: string, data: unknown) => events.push({ event, data }),
          on: () => {},
          off: () => {},
        },
      });

      const task = manager.createTask(createDefaultTaskParams());
      // 1 event: created
      expect(events.filter((e) => e.event === 'siegeTask:created')).toHaveLength(1);

      const steps: SiegeTaskStatus[] = ['marching', 'sieging', 'settling', 'returning', 'completed'];
      for (const step of steps) {
        manager.advanceStatus(task.id, step);
      }

      const statusEvents = events.filter((e) => e.event === 'siegeTask:statusChanged');
      expect(statusEvents).toHaveLength(5);

      const expectedPairs: Array<[SiegeTaskStatus, SiegeTaskStatus]> = [
        ['preparing', 'marching'],
        ['marching', 'sieging'],
        ['sieging', 'settling'],
        ['settling', 'returning'],
        ['returning', 'completed'],
      ];
      expectedPairs.forEach(([from, to], idx) => {
        expect((statusEvents[idx].data as any).from).toBe(from);
        expect((statusEvents[idx].data as any).to).toBe(to);
      });

      // completed should also emit siegeTask:completed
      const completedEvents = events.filter((e) => e.event === 'siegeTask:completed');
      expect(completedEvents).toHaveLength(1);
    });
  });

  // ─────────────────────────────────────────────
  // 2. Invalid state transitions
  // ─────────────────────────────────────────────
  describe('2. Invalid state transitions', () => {
    it('should reject preparing→sieging (skip marching)', () => {
      const task = manager.createTask(createDefaultTaskParams());
      const result = manager.advanceStatus(task.id, 'sieging');
      expect(result).toBeNull();
      expect(manager.getTask(task.id)!.status).toBe('preparing');
    });

    it('should reject preparing→settling (skip two states)', () => {
      const task = manager.createTask(createDefaultTaskParams());
      const result = manager.advanceStatus(task.id, 'settling');
      expect(result).toBeNull();
      expect(manager.getTask(task.id)!.status).toBe('preparing');
    });

    it('should reject preparing→completed (skip all states)', () => {
      const task = manager.createTask(createDefaultTaskParams());
      const result = manager.advanceStatus(task.id, 'completed');
      expect(result).toBeNull();
      expect(manager.getTask(task.id)!.status).toBe('preparing');
    });

    it('should reject all transitions from completed (terminal state)', () => {
      const task = manager.createTask(createDefaultTaskParams());
      advanceToCompleted(manager, task.id);

      const allStatuses: SiegeTaskStatus[] = [
        'preparing', 'marching', 'sieging', 'settling', 'returning', 'completed',
      ];
      for (const status of allStatuses) {
        const result = manager.advanceStatus(task.id, status);
        expect(result).toBeNull();
      }
      expect(manager.getTask(task.id)!.status).toBe('completed');
    });

    it('should reject backwards transition sieging→marching', () => {
      const task = manager.createTask(createDefaultTaskParams());
      manager.advanceStatus(task.id, 'marching');
      manager.advanceStatus(task.id, 'sieging');

      const result = manager.advanceStatus(task.id, 'marching');
      expect(result).toBeNull();
      expect(manager.getTask(task.id)!.status).toBe('sieging');
    });

    it('should reject self-transition (marching→marching)', () => {
      const task = manager.createTask(createDefaultTaskParams());
      manager.advanceStatus(task.id, 'marching');

      const result = manager.advanceStatus(task.id, 'marching');
      expect(result).toBeNull();
      expect(manager.getTask(task.id)!.status).toBe('marching');
    });
  });

  // ─────────────────────────────────────────────
  // 3. Task lifecycle with full metadata preservation
  // ─────────────────────────────────────────────
  describe('3. Task lifecycle with full metadata preservation', () => {
    it('should preserve all metadata through the full lifecycle', () => {
      const params = createDefaultTaskParams({
        targetId: 'city-jianye',
        targetName: '建业',
        sourceId: 'city-chengdu',
        sourceName: '成都',
        strategy: 'forceAttack' as any,
        expedition: { forceId: 'force-2', heroId: 'hero-zhaoyun', heroName: '赵云', troops: 5000 },
        cost: { troops: 3000, grain: 800 },
        marchPath: [{ x: 0, y: 0 }, { x: 5, y: 5 }, { x: 10, y: 10 }],
      });

      const task = manager.createTask(params);
      const taskId = task.id;

      // Set estimated arrival
      const eta = Date.now() + 60_000;
      manager.setEstimatedArrival(taskId, eta);

      // Advance through full lifecycle
      advanceToCompleted(manager, taskId);

      // Verify all metadata preserved
      const finalTask = manager.getTask(taskId);
      expect(finalTask).not.toBeNull();
      expect(finalTask!.id).toBe(taskId);
      expect(finalTask!.targetId).toBe('city-jianye');
      expect(finalTask!.targetName).toBe('建业');
      expect(finalTask!.sourceId).toBe('city-chengdu');
      expect(finalTask!.sourceName).toBe('成都');
      expect(finalTask!.strategy).toBe('forceAttack');
      expect(finalTask!.expedition.forceId).toBe('force-2');
      expect(finalTask!.expedition.heroId).toBe('hero-zhaoyun');
      expect(finalTask!.expedition.heroName).toBe('赵云');
      expect(finalTask!.expedition.troops).toBe(5000);
      expect(finalTask!.cost.troops).toBe(3000);
      expect(finalTask!.cost.grain).toBe(800);
      expect(finalTask!.marchPath).toEqual([{ x: 0, y: 0 }, { x: 5, y: 5 }, { x: 10, y: 10 }]);
      expect(finalTask!.estimatedArrival).toBe(eta);
      expect(finalTask!.createdAt).toBeGreaterThan(0);
      expect(finalTask!.marchStartedAt).toBeGreaterThan(0);
      expect(finalTask!.arrivedAt).toBeGreaterThan(0);
      expect(finalTask!.siegeCompletedAt).toBeGreaterThan(0);
      expect(finalTask!.returnCompletedAt).toBeGreaterThan(0);
    });

    it('should set result and preserve it through to completed', () => {
      const task = manager.createTask(createDefaultTaskParams());
      const taskId = task.id;

      manager.advanceStatus(taskId, 'marching');
      manager.advanceStatus(taskId, 'sieging');
      manager.advanceStatus(taskId, 'settling');

      // Set result during settling phase
      manager.setResult(taskId, {
        victory: true,
        capture: { territoryId: 'city-xuchang', newOwner: 'player', previousOwner: 'enemy' },
        casualties: {
          troopsLost: 200,
          troopsLostPercent: 6.67,
          heroInjured: false,
          injuryLevel: 'none' as any,
          battleResult: 'victory',
        },
        actualCost: { troops: 200, grain: 500 },
        rewardMultiplier: 1.0,
        specialEffectTriggered: false,
      });

      manager.advanceStatus(taskId, 'returning');
      manager.advanceStatus(taskId, 'completed');

      const finalTask = manager.getTask(taskId);
      expect(finalTask!.result).not.toBeNull();
      expect(finalTask!.result!.victory).toBe(true);
      expect(finalTask!.result!.capture!.newOwner).toBe('player');
      expect(finalTask!.result!.casualties!.troopsLost).toBe(200);
    });
  });

  // ─────────────────────────────────────────────
  // 4. Cancel mid-lifecycle (skip-state rejection)
  // ─────────────────────────────────────────────
  describe('4. Invalid mid-lifecycle transitions (cancel scenario)', () => {
    it('should fail advancing from marching to settling without sieging', () => {
      const task = manager.createTask(createDefaultTaskParams());
      manager.advanceStatus(task.id, 'marching');

      // Try to skip sieging → go directly to settling
      const result = manager.advanceStatus(task.id, 'settling');
      expect(result).toBeNull();
      expect(manager.getTask(task.id)!.status).toBe('marching');
    });

    it('should fail advancing from sieging to returning without settling', () => {
      const task = manager.createTask(createDefaultTaskParams());
      manager.advanceStatus(task.id, 'marching');
      manager.advanceStatus(task.id, 'sieging');

      // Try to skip settling → go directly to returning
      const result = manager.advanceStatus(task.id, 'returning');
      expect(result).toBeNull();
      expect(manager.getTask(task.id)!.status).toBe('sieging');
    });

    it('should fail advancing from settling to completed without returning', () => {
      const task = manager.createTask(createDefaultTaskParams());
      manager.advanceStatus(task.id, 'marching');
      manager.advanceStatus(task.id, 'sieging');
      manager.advanceStatus(task.id, 'settling');

      // Try to skip returning → go directly to completed
      const result = manager.advanceStatus(task.id, 'completed');
      expect(result).toBeNull();
      expect(manager.getTask(task.id)!.status).toBe('settling');
    });

    it('should remain in current state after failed skip-transition and still allow correct next step', () => {
      const task = manager.createTask(createDefaultTaskParams());
      manager.advanceStatus(task.id, 'marching');

      // Failed transition
      manager.advanceStatus(task.id, 'settling');
      expect(manager.getTask(task.id)!.status).toBe('marching');

      // Correct transition still works
      const result = manager.advanceStatus(task.id, 'sieging');
      expect(result).not.toBeNull();
      expect(manager.getTask(task.id)!.status).toBe('sieging');
    });
  });

  // ─────────────────────────────────────────────
  // 5. removeCompletedTasks
  // ─────────────────────────────────────────────
  describe('5. removeCompletedTasks', () => {
    it('should remove completed tasks and keep active tasks', () => {
      const t1 = manager.createTask(createDefaultTaskParams({ targetId: 't1', targetName: 'T1' }));
      const t2 = manager.createTask(createDefaultTaskParams({ targetId: 't2', targetName: 'T2' }));
      const t3 = manager.createTask(createDefaultTaskParams({ targetId: 't3', targetName: 'T3' }));

      // Complete t1
      advanceToCompleted(manager, t1.id);
      // Advance t2 to marching only
      manager.advanceStatus(t2.id, 'marching');
      // t3 stays at preparing

      const removed = manager.removeCompletedTasks();
      expect(removed).toBe(1);
      expect(manager.getTask(t1.id)).toBeNull();
      expect(manager.getTask(t2.id)).not.toBeNull();
      expect(manager.getTask(t3.id)).not.toBeNull();
      expect(manager.getAllTasks()).toHaveLength(2);
    });

    it('should return 0 when no completed tasks exist', () => {
      manager.createTask(createDefaultTaskParams());
      const removed = manager.removeCompletedTasks();
      expect(removed).toBe(0);
      expect(manager.getAllTasks()).toHaveLength(1);
    });

    it('should remove all completed tasks when multiple exist', () => {
      const t1 = manager.createTask(createDefaultTaskParams({ targetId: 't1', targetName: 'T1' }));
      const t2 = manager.createTask(createDefaultTaskParams({ targetId: 't2', targetName: 'T2' }));
      const t3 = manager.createTask(createDefaultTaskParams({ targetId: 't3', targetName: 'T3' }));

      advanceToCompleted(manager, t1.id);
      advanceToCompleted(manager, t2.id);
      advanceToCompleted(manager, t3.id);

      const removed = manager.removeCompletedTasks();
      expect(removed).toBe(3);
      expect(manager.getAllTasks()).toHaveLength(0);
    });
  });

  // ─────────────────────────────────────────────
  // 6. getActiveTasks filtering
  // ─────────────────────────────────────────────
  describe('6. getActiveTasks filtering', () => {
    it('should only return non-completed tasks', () => {
      const t1 = manager.createTask(createDefaultTaskParams({ targetId: 't1', targetName: 'T1' }));
      const t2 = manager.createTask(createDefaultTaskParams({ targetId: 't2', targetName: 'T2' }));
      const t3 = manager.createTask(createDefaultTaskParams({ targetId: 't3', targetName: 'T3' }));
      const t4 = manager.createTask(createDefaultTaskParams({ targetId: 't4', targetName: 'T4' }));

      // t1: preparing (active)
      // t2: sieging (active)
      manager.advanceStatus(t2.id, 'marching');
      manager.advanceStatus(t2.id, 'sieging');
      // t3: returning (active)
      manager.advanceStatus(t3.id, 'marching');
      manager.advanceStatus(t3.id, 'sieging');
      manager.advanceStatus(t3.id, 'settling');
      manager.advanceStatus(t3.id, 'returning');
      // t4: completed (not active)
      advanceToCompleted(manager, t4.id);

      const active = manager.getActiveTasks();
      expect(active).toHaveLength(3);
      const activeIds = active.map((t) => t.id);
      expect(activeIds).toContain(t1.id);
      expect(activeIds).toContain(t2.id);
      expect(activeIds).toContain(t3.id);
      expect(activeIds).not.toContain(t4.id);
    });

    it('should return empty array when all tasks are completed', () => {
      const t1 = manager.createTask(createDefaultTaskParams({ targetId: 't1', targetName: 'T1' }));
      const t2 = manager.createTask(createDefaultTaskParams({ targetId: 't2', targetName: 'T2' }));

      advanceToCompleted(manager, t1.id);
      advanceToCompleted(manager, t2.id);

      expect(manager.getActiveTasks()).toHaveLength(0);
    });

    it('should reflect newly completed task after mid-lifecycle advance', () => {
      const t1 = manager.createTask(createDefaultTaskParams());
      const t2 = manager.createTask(createDefaultTaskParams({ targetId: 't2', targetName: 'T2' }));

      // Initially both active
      expect(manager.getActiveTasks()).toHaveLength(2);

      // Complete t1
      advanceToCompleted(manager, t1.id);
      expect(manager.getActiveTasks()).toHaveLength(1);
      expect(manager.getActiveTasks()[0].id).toBe(t2.id);
    });

    it('activeCount property should match getActiveTasks length', () => {
      manager.createTask(createDefaultTaskParams({ targetId: 't1', targetName: 'T1' }));
      manager.createTask(createDefaultTaskParams({ targetId: 't2', targetName: 'T2' }));
      manager.createTask(createDefaultTaskParams({ targetId: 't3', targetName: 'T3' }));

      expect(manager.activeCount).toBe(3);
      expect(manager.activeCount).toBe(manager.getActiveTasks().length);

      // Complete one
      const allTasks = manager.getAllTasks();
      advanceToCompleted(manager, allTasks[0].id);

      expect(manager.activeCount).toBe(2);
      expect(manager.activeCount).toBe(manager.getActiveTasks().length);
    });
  });

  // ─────────────────────────────────────────────
  // 7. setEstimatedArrival preserved through transitions
  // ─────────────────────────────────────────────
  describe('7. setEstimatedArrival preservation through state transitions', () => {
    it('should preserve ETA through all state transitions', () => {
      const task = manager.createTask(createDefaultTaskParams());
      const eta = Date.now() + 120_000;

      manager.setEstimatedArrival(task.id, eta);
      expect(manager.getTask(task.id)!.estimatedArrival).toBe(eta);

      manager.advanceStatus(task.id, 'marching');
      expect(manager.getTask(task.id)!.estimatedArrival).toBe(eta);

      manager.advanceStatus(task.id, 'sieging');
      expect(manager.getTask(task.id)!.estimatedArrival).toBe(eta);

      manager.advanceStatus(task.id, 'settling');
      expect(manager.getTask(task.id)!.estimatedArrival).toBe(eta);

      manager.advanceStatus(task.id, 'returning');
      expect(manager.getTask(task.id)!.estimatedArrival).toBe(eta);

      manager.advanceStatus(task.id, 'completed');
      expect(manager.getTask(task.id)!.estimatedArrival).toBe(eta);
    });

    it('should allow setting ETA at different lifecycle stages', () => {
      const task = manager.createTask(createDefaultTaskParams());

      // Set ETA while preparing
      const eta1 = Date.now() + 60_000;
      manager.setEstimatedArrival(task.id, eta1);
      expect(manager.getTask(task.id)!.estimatedArrival).toBe(eta1);

      // Update ETA while marching
      manager.advanceStatus(task.id, 'marching');
      const eta2 = Date.now() + 30_000;
      manager.setEstimatedArrival(task.id, eta2);
      expect(manager.getTask(task.id)!.estimatedArrival).toBe(eta2);
    });

    it('should not affect ETA on non-existent task (silent no-op)', () => {
      // Should not throw
      manager.setEstimatedArrival('nonexistent-id', Date.now() + 1000);
    });
  });
});
