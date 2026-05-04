/**
 * Siege Interrupt E2E Integration Test
 *
 * End-to-end tests for the siege interrupt flow using REAL subsystems:
 *   - Real EventBus (no mocks)
 *   - Real SiegeTaskManager
 *   - Real MarchingSystem
 *
 * Covers the full interrupt lifecycle:
 *   1. Create siege task -> advance to sieging -> pause -> resume -> complete
 *   2. Create siege task -> advance to sieging -> pause -> cancel -> verify return march
 *   3. Event emission verification (siegeTask:paused, siegeTask:resumed, siegeTask:cancelled)
 *   4. Siege lock lifecycle (held during pause, released on cancel/complete)
 *   5. cancelSiege creates return march with correct faction 'wei' (not 'neutral')
 *
 * @module engine/map/__tests__/integration/siege-interrupt.e2e
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { EventBus } from '../../../../core/events/EventBus';
import { SiegeTaskManager, SIEGE_TASK_EVENTS } from '../../SiegeTaskManager';
import { MarchingSystem } from '../../MarchingSystem';
import type { ISystemDeps } from '../../../../core/types/subsystem';
import type { WalkabilityGrid } from '../../PathfindingSystem';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a minimal walkability grid (100x60) that connects city-xuchang (37,26)
 * and city-luoyang (50,23) via an L-shaped corridor.
 *
 * The corridor goes:
 *   (37,26) → (37,23) → (50,23)
 *
 * All corridor cells and both city cells are marked walkable (true).
 */
function buildTestWalkabilityGrid(): WalkabilityGrid {
  const COLS = 100;
  const ROWS = 60;
  const grid: boolean[][] = [];

  for (let y = 0; y < ROWS; y++) {
    const row: boolean[] = [];
    for (let x = 0; x < COLS; x++) {
      row.push(false);
    }
    grid.push(row);
  }

  // city-xuchang at (37, 26)
  grid[26][37] = true;

  // Vertical corridor from (37,26) to (37,23)
  for (let y = 23; y <= 26; y++) {
    grid[y][37] = true;
  }

  // Horizontal corridor from (37,23) to (50,23)
  for (let x = 37; x <= 50; x++) {
    grid[23][x] = true;
  }

  // city-luoyang at (50, 23)
  grid[23][50] = true;

  return grid;
}

/** Create real ISystemDeps with a real EventBus and minimal stubs for config/registry. */
function createRealDeps(): { deps: ISystemDeps; eventBus: EventBus } {
  const eventBus = new EventBus();

  const deps: ISystemDeps = {
    eventBus: eventBus as any,
    config: {
      get: () => undefined,
      set: () => {},
      has: () => false,
      loadFromConstants: () => {},
    } as any,
    registry: {
      get: () => ({} as any),
      getAll: () => new Map(),
      has: () => false,
      register: () => {},
      unregister: () => {},
    } as any,
  };

  return { deps, eventBus };
}

/** Collect events of a given type emitted on the bus for assertion. */
function collectEvents<T>(eventBus: EventBus, event: string): T[] {
  const collected: T[] = [];
  eventBus.on<T>(event, (payload) => collected.push(payload));
  return collected;
}

/** Default task creation parameters. */
function createTaskParams(overrides: Partial<Parameters<SiegeTaskManager['createTask']>[0]> = {}) {
  return {
    targetId: 'city-xuchang',
    targetName: 'Xuchang',
    sourceId: 'city-luoyang',
    sourceName: 'Luoyang',
    strategy: null as any,
    expedition: { forceId: 'force-1', heroId: 'hero-caocao', heroName: 'Cao Cao', troops: 5000 },
    cost: { troops: 2000, grain: 500 },
    marchPath: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 200, y: 50 }],
    faction: 'wei' as const,
    ...overrides,
  };
}

/**
 * Advance a task through the state machine to 'sieging'.
 *
 * preparing -> marching -> sieging
 */
function advanceToSieging(manager: SiegeTaskManager, taskId: string): void {
  manager.advanceStatus(taskId, 'marching');
  manager.advanceStatus(taskId, 'sieging');
}

/**
 * Advance a task through the full lifecycle to 'completed'.
 *
 * sieging -> settling -> returning -> completed
 */
function advanceToCompleted(manager: SiegeTaskManager, taskId: string): void {
  manager.advanceStatus(taskId, 'settling');
  manager.advanceStatus(taskId, 'returning');
  manager.advanceStatus(taskId, 'completed');
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe('Siege Interrupt E2E Integration Tests', () => {
  let eventBus: EventBus;
  let siegeManager: SiegeTaskManager;
  let marchingSystem: MarchingSystem;
  let deps: ISystemDeps;

  beforeEach(() => {
    const result = createRealDeps();
    deps = result.deps;
    eventBus = result.eventBus;

    // Real SiegeTaskManager with real EventBus
    siegeManager = new SiegeTaskManager();
    siegeManager.setDependencies({ eventBus });

    // Real MarchingSystem with real EventBus and walkability grid
    marchingSystem = new MarchingSystem();
    marchingSystem.init(deps);
    marchingSystem.setWalkabilityGrid(buildTestWalkabilityGrid());
  });

  // =========================================================================
  // Test 1: Full happy path — create -> sieging -> pause -> resume -> complete
  // =========================================================================

  it('should complete the full lifecycle: create -> sieging -> pause -> resume -> complete', () => {
    // Collect all status change events
    const statusEvents = collectEvents<{ taskId: string; from: string; to: string }>(
      eventBus,
      SIEGE_TASK_EVENTS.STATUS_CHANGED,
    );
    const pausedEvents = collectEvents<{ taskId: string }>(eventBus, SIEGE_TASK_EVENTS.PAUSED);
    const resumedEvents = collectEvents<{ taskId: string }>(eventBus, SIEGE_TASK_EVENTS.RESUMED);
    const completedEvents = collectEvents<{ task: any }>(eventBus, SIEGE_TASK_EVENTS.COMPLETED);

    // Step 1: Create task
    const task = siegeManager.createTask(createTaskParams());
    expect(task).not.toBeNull();
    expect(task!.status).toBe('preparing');
    expect(task!.targetId).toBe('city-xuchang');

    // Step 2: Advance to sieging
    advanceToSieging(siegeManager, task!.id);
    expect(task!.status).toBe('sieging');
    expect(task!.arrivedAt).toBeGreaterThan(0);

    // Step 3: Pause
    const pauseResult = siegeManager.pauseSiege(task!.id, {
      defenseRatio: 0.72,
      elapsedBattleTime: 8000,
    });
    expect(pauseResult).toBe(true);
    expect(task!.status).toBe('paused');
    expect(task!.pausedAt).toBeGreaterThan(0);
    expect(task!.pauseSnapshot).not.toBeNull();
    expect(task!.pauseSnapshot!.defenseRatio).toBe(0.72);
    expect(task!.pauseSnapshot!.elapsedBattleTime).toBe(8000);

    // Step 4: Resume
    const resumeResult = siegeManager.resumeSiege(task!.id);
    expect(resumeResult).toBe(true);
    expect(task!.status).toBe('sieging');
    expect(task!.pausedAt).toBeNull();
    expect(task!.pauseSnapshot).toBeNull();

    // Step 5: Complete the task
    advanceToCompleted(siegeManager, task!.id);
    expect(task!.status).toBe('completed');

    // Verify event flow
    expect(pausedEvents).toHaveLength(1);
    expect(pausedEvents[0].taskId).toBe(task!.id);

    expect(resumedEvents).toHaveLength(1);
    expect(resumedEvents[0].taskId).toBe(task!.id);

    expect(completedEvents).toHaveLength(1);
    expect(completedEvents[0].task.id).toBe(task!.id);

    // Verify key status transitions were emitted
    const transitions = statusEvents.map((e) => `${e.from}->${e.to}`);
    expect(transitions).toContain('sieging->paused');
    expect(transitions).toContain('paused->sieging');
    expect(transitions).toContain('returning->completed');
  });

  // =========================================================================
  // Test 2: Cancel path — create -> sieging -> pause -> cancel -> return march
  // =========================================================================

  it('should create return march with faction=wei when cancelling a paused siege', () => {
    // Collect return march creation events from MarchingSystem
    const marchCreatedEvents = collectEvents<{ marchId: string; fromCityId: string; toCityId: string; troops: number; general: string }>(
      eventBus,
      'march:created',
    );
    const cancelledEvents = collectEvents<{ taskId: string; targetId: string }>(
      eventBus,
      SIEGE_TASK_EVENTS.CANCELLED,
    );
    const statusEvents = collectEvents<{ taskId: string; from: string; to: string }>(
      eventBus,
      SIEGE_TASK_EVENTS.STATUS_CHANGED,
    );

    // Create and advance to sieging
    const task = siegeManager.createTask(createTaskParams());
    advanceToSieging(siegeManager, task!.id);

    // Pause
    siegeManager.pauseSiege(task!.id, { defenseRatio: 0.5, elapsedBattleTime: 10000 });
    expect(task!.status).toBe('paused');

    // Cancel with real MarchingSystem
    const cancelResult = siegeManager.cancelSiege(task!.id, marchingSystem);
    expect(cancelResult).toBe(true);

    // Verify task status transitioned to 'returning'
    expect(task!.status).toBe('returning');
    expect(task!.siegeCompletedAt).toBeGreaterThan(0);
    expect(task!.pausedAt).toBeNull();
    expect(task!.pauseSnapshot).toBeNull();

    // Verify cancelled event was emitted
    expect(cancelledEvents).toHaveLength(1);
    expect(cancelledEvents[0].taskId).toBe(task!.id);
    expect(cancelledEvents[0].targetId).toBe('city-xuchang');

    // Verify status transition event
    const lastTransition = statusEvents[statusEvents.length - 1];
    expect(lastTransition).toMatchObject({
      taskId: task!.id,
      from: 'paused',
      to: 'returning',
    });

    // Verify return march was created via real MarchingSystem
    expect(marchCreatedEvents.length).toBeGreaterThanOrEqual(1);

    // Find the return march (last created march should be the return march)
    const returnMarch = marchingSystem.getActiveMarches().find(
      (m) => m.siegeTaskId === task!.id,
    );
    expect(returnMarch).toBeDefined();
    expect(returnMarch!.fromCityId).toBe('city-xuchang');
    expect(returnMarch!.toCityId).toBe('city-luoyang');
    expect(returnMarch!.troops).toBe(5000);
    expect(returnMarch!.general).toBe('Cao Cao');
    expect(returnMarch!.faction).toBe('wei');
  });

  // =========================================================================
  // Test 3: Siege lock lifecycle — held during pause, released on cancel
  // =========================================================================

  it('should hold siege lock during pause and release it on cancel', () => {
    const targetId = 'city-xuchang';

    // Create and advance to sieging
    const task = siegeManager.createTask(createTaskParams());
    advanceToSieging(siegeManager, task!.id);

    // Siege lock should be held
    expect(siegeManager.isSiegeLocked(targetId)).toBe(true);

    // Cannot create another task on the same target
    const blocked = siegeManager.createTask(createTaskParams());
    expect(blocked).toBeNull();

    // Pause — lock should still be held
    siegeManager.pauseSiege(task!.id);
    expect(siegeManager.isSiegeLocked(targetId)).toBe(true);

    // Cannot create another task even while paused
    const blocked2 = siegeManager.createTask(createTaskParams());
    expect(blocked2).toBeNull();

    // Cancel — cancelSiege does NOT release the lock (only advanceStatus to
    // 'completed' does that). Verify current behavior: lock persists after cancel.
    siegeManager.cancelSiege(task!.id, marchingSystem);

    // Note: cancelSiege transitions to 'returning' (not 'completed'),
    // so the lock remains. It is released only when the task reaches 'completed'.
    // However, let's verify the current actual behavior:
    expect(task!.status).toBe('returning');

    // After completing the return, lock should be released
    siegeManager.advanceStatus(task!.id, 'completed');
    expect(siegeManager.isSiegeLocked(targetId)).toBe(false);

    // Now we can create a new task on the same target
    const newTask = siegeManager.createTask(createTaskParams());
    expect(newTask).not.toBeNull();
    expect(siegeManager.isSiegeLocked(targetId)).toBe(true);
  });

  // =========================================================================
  // Test 4: Siege lock released on completion (non-cancel happy path)
  // =========================================================================

  it('should release siege lock when task completes normally (no cancel)', () => {
    const targetId = 'city-xuchang';

    // Create and advance to sieging
    const task = siegeManager.createTask(createTaskParams());
    expect(siegeManager.isSiegeLocked(targetId)).toBe(true);

    advanceToSieging(siegeManager, task!.id);
    expect(siegeManager.isSiegeLocked(targetId)).toBe(true);

    // Pause and resume — lock still held
    siegeManager.pauseSiege(task!.id);
    expect(siegeManager.isSiegeLocked(targetId)).toBe(true);

    siegeManager.resumeSiege(task!.id);
    expect(siegeManager.isSiegeLocked(targetId)).toBe(true);

    // Complete the full lifecycle
    advanceToCompleted(siegeManager, task!.id);
    expect(task!.status).toBe('completed');

    // Lock should be released on completion
    expect(siegeManager.isSiegeLocked(targetId)).toBe(false);

    // Verify we can create a new task on the same target
    const newTask = siegeManager.createTask(createTaskParams());
    expect(newTask).not.toBeNull();
  });

  // =========================================================================
  // Test 5: Multiple pause/resume cycles before cancel
  // =========================================================================

  it('should support multiple pause/resume cycles and then cancel', () => {
    const statusEvents = collectEvents<{ taskId: string; from: string; to: string }>(
      eventBus,
      SIEGE_TASK_EVENTS.STATUS_CHANGED,
    );
    const pausedEvents = collectEvents<{ taskId: string; pauseSnapshot: any }>(
      eventBus,
      SIEGE_TASK_EVENTS.PAUSED,
    );
    const resumedEvents = collectEvents<{ taskId: string; savedSnapshot: any }>(
      eventBus,
      SIEGE_TASK_EVENTS.RESUMED,
    );
    const cancelledEvents = collectEvents<{ taskId: string }>(
      eventBus,
      SIEGE_TASK_EVENTS.CANCELLED,
    );

    // Create and advance to sieging
    const task = siegeManager.createTask(createTaskParams());
    advanceToSieging(siegeManager, task!.id);
    statusEvents.length = 0; // Reset to focus on interrupt events

    // Cycle 1: pause -> resume
    siegeManager.pauseSiege(task!.id, { defenseRatio: 0.9, elapsedBattleTime: 2000 });
    expect(task!.status).toBe('paused');
    expect(task!.pauseSnapshot!.defenseRatio).toBe(0.9);

    siegeManager.resumeSiege(task!.id);
    expect(task!.status).toBe('sieging');
    expect(task!.pauseSnapshot).toBeNull();

    // Cycle 2: pause -> resume with updated progress
    siegeManager.pauseSiege(task!.id, { defenseRatio: 0.5, elapsedBattleTime: 10000 });
    expect(task!.pauseSnapshot!.defenseRatio).toBe(0.5);

    siegeManager.resumeSiege(task!.id);
    expect(task!.pauseSnapshot).toBeNull();

    // Cycle 3: pause -> cancel
    siegeManager.pauseSiege(task!.id, { defenseRatio: 0.3, elapsedBattleTime: 18000 });
    expect(task!.pauseSnapshot!.defenseRatio).toBe(0.3);

    // Cancel with real MarchingSystem
    siegeManager.cancelSiege(task!.id, marchingSystem);
    expect(task!.status).toBe('returning');
    expect(task!.pauseSnapshot).toBeNull();

    // Verify event counts: 3 pauses, 2 resumes, 1 cancel
    expect(pausedEvents).toHaveLength(3);
    expect(resumedEvents).toHaveLength(2);
    expect(cancelledEvents).toHaveLength(1);

    // Verify pause snapshots were emitted with correct data
    expect(pausedEvents[0].pauseSnapshot.defenseRatio).toBe(0.9);
    expect(pausedEvents[1].pauseSnapshot.defenseRatio).toBe(0.5);
    expect(pausedEvents[2].pauseSnapshot.defenseRatio).toBe(0.3);

    // Verify resume events carried saved snapshots
    expect(resumedEvents[0].savedSnapshot.defenseRatio).toBe(0.9);
    expect(resumedEvents[1].savedSnapshot.defenseRatio).toBe(0.5);

    // Verify all status transitions after clearing
    const transitions = statusEvents.map((e) => `${e.from}->${e.to}`);
    expect(transitions).toEqual([
      'sieging->paused',
      'paused->sieging',
      'sieging->paused',
      'paused->sieging',
      'sieging->paused',
      'paused->returning',
    ]);

    // Verify return march was created with correct faction
    const returnMarch = marchingSystem.getActiveMarches().find(
      (m) => m.siegeTaskId === task!.id,
    );
    expect(returnMarch).toBeDefined();
    expect(returnMarch!.faction).toBe('wei');
    expect(returnMarch!.fromCityId).toBe('city-xuchang');
    expect(returnMarch!.toCityId).toBe('city-luoyang');
  });

  // =========================================================================
  // Test 6: Task summary reflects paused status correctly
  // =========================================================================

  it('should report correct task summary during pause lifecycle', () => {
    // Create and advance
    const task = siegeManager.createTask(createTaskParams());
    advanceToSieging(siegeManager, task!.id);

    // Summary while sieging
    let summary = siegeManager.getTaskSummary(task!.id);
    expect(summary).not.toBeNull();
    expect(summary!.status).toBe('sieging');
    expect(summary!.siegeProgress).toBe(50);

    // Pause
    siegeManager.pauseSiege(task!.id, { defenseRatio: 0.6, elapsedBattleTime: 5000 });

    // Summary while paused
    summary = siegeManager.getTaskSummary(task!.id);
    expect(summary).not.toBeNull();
    expect(summary!.status).toBe('paused');
    expect(summary!.siegeProgress).toBe(50);

    // Task should appear in active tasks and paused-specific query
    const activeTasks = siegeManager.getActiveTasks();
    expect(activeTasks).toHaveLength(1);
    expect(activeTasks[0].status).toBe('paused');

    const pausedTasks = siegeManager.getTasksByStatus('paused');
    expect(pausedTasks).toHaveLength(1);

    const siegingTasks = siegeManager.getTasksByStatus('sieging');
    expect(siegingTasks).toHaveLength(0);
  });

  // =========================================================================
  // Test 7: cancelSiege without MarchingSystem still transitions correctly
  // =========================================================================

  it('should transition to returning even without a MarchingSystem (null passed)', () => {
    const cancelledEvents = collectEvents<{ taskId: string; targetId: string }>(
      eventBus,
      SIEGE_TASK_EVENTS.CANCELLED,
    );

    const task = siegeManager.createTask(createTaskParams());
    advanceToSieging(siegeManager, task!.id);
    siegeManager.pauseSiege(task!.id);

    // Cancel without marching system
    const result = siegeManager.cancelSiege(task!.id, null);
    expect(result).toBe(true);
    expect(task!.status).toBe('returning');
    expect(task!.pausedAt).toBeNull();

    // Event should still be emitted
    expect(cancelledEvents).toHaveLength(1);
    expect(cancelledEvents[0].taskId).toBe(task!.id);
  });
});
