/**
 * SiegeTaskManager 攻占锁机制测试
 *
 * 验证：
 * - 同一城市同一时刻只允许一个攻占任务
 * - 攻占锁在任务完成时自动释放
 * - 攻占锁超时自动释放
 * - 不同城市可以并发攻占
 *
 * @module engine/map/__tests__/SiegeTaskManager.lock.test
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { SiegeTaskManager } from '../SiegeTaskManager';
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

/** 将任务推进到终态 completed */
function advanceToCompleted(manager: SiegeTaskManager, taskId: string): void {
  const steps: SiegeTaskStatus[] = ['marching', 'sieging', 'settling', 'returning', 'completed'];
  for (const step of steps) {
    manager.advanceStatus(taskId, step);
  }
}

// ── 测试套件 ──────────────────────────────────

describe('SiegeTaskManager siege lock mechanism', () => {
  let manager: SiegeTaskManager;

  beforeEach(() => {
    manager = new SiegeTaskManager();
  });

  // ─────────────────────────────────────────────
  // 1. First siege on target succeeds
  // ─────────────────────────────────────────────
  describe('lock acquisition', () => {
    it('should acquire lock on first siege of a target', () => {
      const task = manager.createTask(createTaskParams({ targetId: 'city-a' }));

      expect(task).not.toBeNull();
      expect(task!.id).toMatch(/^siege-task-\d+$/);
      expect(task!.status).toBe('preparing');
      expect(manager.isSiegeLocked('city-a')).toBe(true);
    });

    it('should acquire lock for each different target', () => {
      const t1 = manager.createTask(createTaskParams({ targetId: 'city-a' }));
      const t2 = manager.createTask(createTaskParams({ targetId: 'city-b' }));

      expect(t1).not.toBeNull();
      expect(t2).not.toBeNull();
      expect(manager.isSiegeLocked('city-a')).toBe(true);
      expect(manager.isSiegeLocked('city-b')).toBe(true);
    });
  });

  // ─────────────────────────────────────────────
  // 2. Second siege on same target rejected
  // ─────────────────────────────────────────────
  describe('lock contention', () => {
    it('should reject second siege on same target while lock is held', () => {
      const first = manager.createTask(createTaskParams({ targetId: 'city-xuchang' }));
      expect(first).not.toBeNull();

      // Second attempt on the same target should be rejected
      const second = manager.createTask(createTaskParams({ targetId: 'city-xuchang' }));
      expect(second).toBeNull();
    });

    it('should reject siege on locked target at any task stage', () => {
      const task = manager.createTask(createTaskParams({ targetId: 'city-xuchang' }));
      expect(task).not.toBeNull();

      // Advance to marching
      manager.advanceStatus(task!.id, 'marching');

      // Second attempt should still be rejected
      const second = manager.createTask(createTaskParams({ targetId: 'city-xuchang' }));
      expect(second).toBeNull();

      // Advance to sieging
      manager.advanceStatus(task!.id, 'sieging');

      const third = manager.createTask(createTaskParams({ targetId: 'city-xuchang' }));
      expect(third).toBeNull();
    });
  });

  // ─────────────────────────────────────────────
  // 3. Lock released on siege completion
  // ─────────────────────────────────────────────
  describe('lock release on completion', () => {
    it('should release lock when task reaches completed status', () => {
      const task = manager.createTask(createTaskParams({ targetId: 'city-xuchang' }));
      expect(manager.isSiegeLocked('city-xuchang')).toBe(true);

      advanceToCompleted(manager, task!.id);

      expect(manager.isSiegeLocked('city-xuchang')).toBe(false);
    });

    it('should allow new siege on same target after completion', () => {
      const first = manager.createTask(createTaskParams({ targetId: 'city-xuchang' }));
      advanceToCompleted(manager, first!.id);

      // After completion, should be able to create a new task
      const second = manager.createTask(createTaskParams({ targetId: 'city-xuchang' }));
      expect(second).not.toBeNull();
      expect(manager.isSiegeLocked('city-xuchang')).toBe(true);
    });
  });

  // ─────────────────────────────────────────────
  // 4. Lock auto-released on timeout
  // ─────────────────────────────────────────────
  describe('lock timeout', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should auto-release lock after timeout', () => {
      const task = manager.createTask(createTaskParams({ targetId: 'city-xuchang' }));
      expect(manager.isSiegeLocked('city-xuchang')).toBe(true);

      // Advance time by just under 5 minutes
      vi.advanceTimersByTime(5 * 60 * 1000 - 1);
      manager.checkLockTimeout();
      expect(manager.isSiegeLocked('city-xuchang')).toBe(true);

      // Advance past 5 minutes
      vi.advanceTimersByTime(1);
      manager.checkLockTimeout();
      expect(manager.isSiegeLocked('city-xuchang')).toBe(false);
    });

    it('should allow new siege after lock timeout', () => {
      const first = manager.createTask(createTaskParams({ targetId: 'city-xuchang' }));

      // Advance past timeout
      vi.advanceTimersByTime(5 * 60 * 1000 + 1);
      manager.checkLockTimeout();

      expect(manager.isSiegeLocked('city-xuchang')).toBe(false);

      // Should be able to create a new task now
      const second = manager.createTask(createTaskParams({ targetId: 'city-xuchang' }));
      expect(second).not.toBeNull();
      expect(manager.isSiegeLocked('city-xuchang')).toBe(true);
    });

    it('should only release expired locks, not all locks', () => {
      manager.createTask(createTaskParams({ targetId: 'city-a' }));

      // 1 minute later, create second task on different target
      vi.advanceTimersByTime(60 * 1000);
      manager.createTask(createTaskParams({ targetId: 'city-b' }));

      // Advance 4.5 minutes (city-a lock is 5.5 min old, city-b lock is 4.5 min old)
      vi.advanceTimersByTime(4.5 * 60 * 1000);
      manager.checkLockTimeout();

      // city-a should be released (5.5 min > 5 min), city-b still held (4.5 min < 5 min)
      expect(manager.isSiegeLocked('city-a')).toBe(false);
      expect(manager.isSiegeLocked('city-b')).toBe(true);
    });
  });

  // ─────────────────────────────────────────────
  // 5. Deserialize clears all locks
  // ─────────────────────────────────────────────
  describe('deserialize restores locks for active tasks', () => {
    it('should restore locks for non-terminal tasks after deserialize', () => {
      // Create tasks with locks on multiple targets (all in 'preparing' status)
      manager.createTask(createTaskParams({ targetId: 'city-a' }));
      manager.createTask(createTaskParams({ targetId: 'city-b' }));
      manager.createTask(createTaskParams({ targetId: 'city-c' }));

      expect(manager.isSiegeLocked('city-a')).toBe(true);
      expect(manager.isSiegeLocked('city-b')).toBe(true);
      expect(manager.isSiegeLocked('city-c')).toBe(true);

      // Serialize, then deserialize onto a fresh manager
      const data = manager.serialize();
      const freshManager = new SiegeTaskManager();
      freshManager.deserialize(data);

      // Deserialize rebuilds siegeLocks for non-terminal tasks
      expect(freshManager.isSiegeLocked('city-a')).toBe(true);
      expect(freshManager.isSiegeLocked('city-b')).toBe(true);
      expect(freshManager.isSiegeLocked('city-c')).toBe(true);
    });

    it('should not restore locks for terminal tasks after deserialize', () => {
      const task = manager.createTask(createTaskParams({ targetId: 'city-xuchang' }));
      expect(task).not.toBeNull();

      // Advance to completed (terminal)
      manager.advanceStatus(task!.id, 'marching');
      manager.advanceStatus(task!.id, 'sieging');
      manager.advanceStatus(task!.id, 'settling');
      manager.advanceStatus(task!.id, 'returning');
      manager.advanceStatus(task!.id, 'completed');

      expect(manager.isSiegeLocked('city-xuchang')).toBe(false);

      // Serialize, then deserialize onto a fresh manager
      const data = manager.serialize();
      const freshManager = new SiegeTaskManager();
      freshManager.deserialize(data);

      // Lock not restored for completed task
      expect(freshManager.isSiegeLocked('city-xuchang')).toBe(false);

      // New task on same target should succeed
      const newTask = freshManager.createTask(createTaskParams({ targetId: 'city-xuchang' }));
      expect(newTask).not.toBeNull();
      expect(freshManager.isSiegeLocked('city-xuchang')).toBe(true);
    });
  });

  // ─────────────────────────────────────────────
  // 6. Different targets can be sieged concurrently
  // ─────────────────────────────────────────────
  describe('concurrent sieges on different targets', () => {
    it('should allow concurrent sieges on different targets', () => {
      const targets = ['city-a', 'city-b', 'city-c', 'city-d', 'city-e'];
      const tasks = targets.map((targetId) =>
        manager.createTask(createTaskParams({ targetId, targetName: targetId }))
      );

      // All tasks should be created successfully
      for (const task of tasks) {
        expect(task).not.toBeNull();
      }

      // All targets should be locked
      for (const targetId of targets) {
        expect(manager.isSiegeLocked(targetId)).toBe(true);
      }

      expect(manager.activeCount).toBe(5);
    });

    it('should release individual locks independently', () => {
      const t1 = manager.createTask(createTaskParams({ targetId: 'city-a' }));
      const t2 = manager.createTask(createTaskParams({ targetId: 'city-b' }));
      const t3 = manager.createTask(createTaskParams({ targetId: 'city-c' }));

      // Complete only t2
      advanceToCompleted(manager, t2!.id);

      // city-b lock released, others still held
      expect(manager.isSiegeLocked('city-a')).toBe(true);
      expect(manager.isSiegeLocked('city-b')).toBe(false);
      expect(manager.isSiegeLocked('city-c')).toBe(true);

      // Can now siege city-b again
      const t2b = manager.createTask(createTaskParams({ targetId: 'city-b' }));
      expect(t2b).not.toBeNull();
      expect(manager.isSiegeLocked('city-b')).toBe(true);

      // city-a and city-c still blocked
      const blocked1 = manager.createTask(createTaskParams({ targetId: 'city-a' }));
      expect(blocked1).toBeNull();
      const blocked2 = manager.createTask(createTaskParams({ targetId: 'city-c' }));
      expect(blocked2).toBeNull();
    });
  });
});
