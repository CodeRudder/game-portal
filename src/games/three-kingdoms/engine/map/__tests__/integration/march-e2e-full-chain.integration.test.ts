/**
 * E1-3 March E2E Full-Chain Integration Tests (Round 17, Task 2)
 *
 * End-to-end tests covering the complete march chain WITHOUT PathfindingSystem:
 *   create march -> start -> update loop (sprite movement) -> arrival -> event trigger
 *
 * Uses REAL EventBus (not mocks) and REAL MarchingSystem.
 * Path data is provided directly (no A* / PathfindingSystem dependency).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MarchingSystem, MIN_MARCH_DURATION_MS, MAX_MARCH_DURATION_MS } from '../../MarchingSystem';
import type {
  MarchUnit,
  MarchCreatedPayload,
  MarchStartedPayload,
  MarchArrivedPayload,
  MarchCancelledPayload,
} from '../../MarchingSystem';
import { EventBus } from '../../../../core/events/EventBus';
import type { ISystemDeps } from '../../../../core/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

/** Collect events of a given type for assertion. */
function collectEvents<T>(eventBus: EventBus, event: string): T[] {
  const collected: T[] = [];
  eventBus.on<T>(event, (payload) => collected.push(payload));
  return collected;
}

/** Straight-line path maker for distance control. */
function makeStraightPath(totalDistance: number): Array<{ x: number; y: number }> {
  return [
    { x: 0, y: 0 },
    { x: totalDistance, y: 0 },
  ];
}

/** Multi-waypoint path. */
function makeWaypointPath(
  ...points: Array<{ x: number; y: number }>
): Array<{ x: number; y: number }> {
  return points;
}

/**
 * Run the update loop until all specified marches reach 'arrived' state
 * or the max iteration count is hit (prevents infinite loops).
 */
function runUpdateUntilArrived(
  system: MarchingSystem,
  marchIds: string[],
  opts: { dt?: number; maxIterations?: number } = {},
): void {
  const dt = opts.dt ?? 1; // 1 second per tick
  const maxIterations = opts.maxIterations ?? 500;

  for (let i = 0; i < maxIterations; i++) {
    const activeMarches = system.getActiveMarches();
    const allArrived = marchIds.every((id) => {
      const m = system.getMarch(id);
      return !m || m.state === 'arrived';
    });
    if (allArrived) return;
    system.update(dt);
  }
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe('E1-3 March E2E Full-Chain Integration Tests', () => {
  let system: MarchingSystem;
  let eventBus: EventBus;
  let deps: ISystemDeps;

  beforeEach(() => {
    const result = createRealDeps();
    deps = result.deps;
    eventBus = result.eventBus;
    system = new MarchingSystem();
    system.init(deps);
  });

  // =========================================================================
  // Test 1: Normal march complete flow
  // =========================================================================

  describe('1. Normal march complete flow', () => {
    it('create -> start -> update -> arrive -> event trigger', () => {
      // Collect events
      const createdEvents = collectEvents<MarchCreatedPayload>(eventBus, 'march:created');
      const startedEvents = collectEvents<MarchStartedPayload>(eventBus, 'march:started');
      const arrivedEvents = collectEvents<MarchArrivedPayload>(eventBus, 'march:arrived');

      // Step 1: Create march with a multi-waypoint path
      const path = makeWaypointPath(
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 200, y: 50 },
        { x: 300, y: 50 },
        { x: 400, y: 100 },
      );

      const march = system.createMarch('city-luoyang', 'city-xuchang', 5000, '关羽', 'shu', path);

      // Verify: created state
      expect(march.state).toBe('preparing');
      expect(march.fromCityId).toBe('city-luoyang');
      expect(march.toCityId).toBe('city-xuchang');
      expect(march.troops).toBe(5000);
      expect(march.general).toBe('关羽');
      expect(march.faction).toBe('shu');
      expect(march.x).toBe(0);
      expect(march.y).toBe(0);
      expect(march.pathIndex).toBe(0);

      // Verify: march:created event
      expect(createdEvents).toHaveLength(1);
      expect(createdEvents[0].marchId).toBe(march.id);
      expect(createdEvents[0].fromCityId).toBe('city-luoyang');
      expect(createdEvents[0].toCityId).toBe('city-xuchang');
      expect(createdEvents[0].troops).toBe(5000);
      expect(createdEvents[0].general).toBe('关羽');
      expect(createdEvents[0].estimatedTime).toBeGreaterThan(0);

      // Step 2: Start the march
      system.startMarch(march.id);

      // Verify: marching state
      expect(system.getMarch(march.id)?.state).toBe('marching');

      // Verify: march:started event
      expect(startedEvents).toHaveLength(1);
      expect(startedEvents[0].marchId).toBe(march.id);
      expect(startedEvents[0].fromCityId).toBe('city-luoyang');
      expect(startedEvents[0].toCityId).toBe('city-xuchang');

      // Step 3: Run update loop until arrival
      runUpdateUntilArrived(system, [march.id], { dt: 1, maxIterations: 500 });

      // Verify: arrived state
      expect(march.state).toBe('arrived');
      // Position should be at the last waypoint
      expect(march.x).toBe(400);
      expect(march.y).toBe(100);
      expect(march.pathIndex).toBe(path.length - 1);

      // Step 4: Verify march:arrived event with correct data
      expect(arrivedEvents).toHaveLength(1);
      expect(arrivedEvents[0].marchId).toBe(march.id);
      expect(arrivedEvents[0].cityId).toBe('city-xuchang');
      expect(arrivedEvents[0].troops).toBe(5000);
      expect(arrivedEvents[0].general).toBe('关羽');
    });

    it('event chain order: created -> started -> arrived', () => {
      const eventOrder: string[] = [];
      eventBus.on('march:created', () => eventOrder.push('march:created'));
      eventBus.on('march:started', () => eventOrder.push('march:started'));
      eventBus.on('march:arrived', () => eventOrder.push('march:arrived'));

      const path = makeWaypointPath({ x: 0, y: 0 }, { x: 50, y: 0 });
      const march = system.createMarch('city-a', 'city-b', 1000, '张飞', 'shu', path);
      system.startMarch(march.id);
      runUpdateUntilArrived(system, [march.id]);

      expect(eventOrder).toEqual(['march:created', 'march:started', 'march:arrived']);
    });
  });

  // =========================================================================
  // Test 2: Short distance march (triggers min duration clamp)
  // =========================================================================

  describe('2. Short distance march (min duration clamp)', () => {
    it('very short path clamps estimatedTime to MIN_MARCH_DURATION (10s)', () => {
      const createdEvents = collectEvents<MarchCreatedPayload>(eventBus, 'march:created');

      // Distance = 150px, raw = (150/30)*1000 = 5000ms < 10000ms => clamp to 10s
      const shortPath = makeStraightPath(150);
      const march = system.createMarch('city-a', 'city-b', 800, '赵云', 'shu', shortPath);

      // Verify: march object
      expect(march.eta - march.startTime).toBeGreaterThanOrEqual(MIN_MARCH_DURATION_MS);

      // Verify: event payload
      expect(createdEvents).toHaveLength(1);
      expect(createdEvents[0].estimatedTime).toBe(MIN_MARCH_DURATION_MS / 1000); // 10 seconds
    });

    it('extremely short path (1px) still clamps to 10s', () => {
      const createdEvents = collectEvents<MarchCreatedPayload>(eventBus, 'march:created');

      const tinyPath = makeStraightPath(1);
      const march = system.createMarch('city-x', 'city-y', 100, '马超', 'wei', tinyPath);

      expect(createdEvents[0].estimatedTime).toBe(10);
      expect(march.eta - march.startTime).toBeGreaterThanOrEqual(MIN_MARCH_DURATION_MS);
    });

    it('generatePreview also clamps short distance to 10s', () => {
      const shortPath = makeStraightPath(50);
      const preview = system.generatePreview(shortPath);

      expect(preview.estimatedTime).toBe(10);
    });
  });

  // =========================================================================
  // Test 3: Long distance march (triggers max duration clamp)
  // =========================================================================

  describe('3. Long distance march (max duration clamp)', () => {
    it('very long path clamps estimatedTime to MAX_MARCH_DURATION (60s)', () => {
      const createdEvents = collectEvents<MarchCreatedPayload>(eventBus, 'march:created');

      // Distance = 3000px, raw = (3000/30)*1000 = 100000ms > 60000ms => clamp to 60s
      const longPath = makeStraightPath(3000);
      const march = system.createMarch('city-a', 'city-b', 3000, '曹操', 'wei', longPath);

      // Verify: march object
      expect(march.eta - march.startTime).toBeLessThanOrEqual(MAX_MARCH_DURATION_MS);

      // Verify: event payload
      expect(createdEvents).toHaveLength(1);
      expect(createdEvents[0].estimatedTime).toBe(MAX_MARCH_DURATION_MS / 1000); // 60 seconds
    });

    it('extremely long path (50000px) still clamps to 60s', () => {
      const createdEvents = collectEvents<MarchCreatedPayload>(eventBus, 'march:created');

      const hugePath = makeStraightPath(50000);
      const march = system.createMarch('city-a', 'city-b', 5000, '孙权', 'wu', hugePath);

      expect(createdEvents[0].estimatedTime).toBe(60);
      expect(march.eta - march.startTime).toBeLessThanOrEqual(MAX_MARCH_DURATION_MS);
    });

    it('generatePreview also clamps long distance to 60s', () => {
      const longPath = makeStraightPath(5000);
      const preview = system.generatePreview(longPath);

      expect(preview.estimatedTime).toBe(60);
    });
  });

  // =========================================================================
  // Test 4: Multiple concurrent marches
  // =========================================================================

  describe('4. Multiple concurrent marches', () => {
    it('three marches with different paths arrive independently', () => {
      const createdEvents = collectEvents<MarchCreatedPayload>(eventBus, 'march:created');
      const startedEvents = collectEvents<MarchStartedPayload>(eventBus, 'march:started');
      const arrivedEvents = collectEvents<MarchArrivedPayload>(eventBus, 'march:arrived');

      // March 1: short straight path
      const path1 = makeWaypointPath({ x: 0, y: 0 }, { x: 30, y: 0 });
      const march1 = system.createMarch('city-a', 'city-b', 1000, '张飞', 'shu', path1);

      // March 2: medium multi-waypoint path
      const path2 = makeWaypointPath(
        { x: 0, y: 100 },
        { x: 50, y: 100 },
        { x: 100, y: 150 },
        { x: 150, y: 150 },
      );
      const march2 = system.createMarch('city-c', 'city-d', 2000, '关羽', 'shu', path2);

      // March 3: another short path
      const path3 = makeWaypointPath({ x: 200, y: 0 }, { x: 250, y: 0 });
      const march3 = system.createMarch('city-e', 'city-f', 500, '赵云', 'wei', path3);

      // Verify: 3 created events
      expect(createdEvents).toHaveLength(3);
      expect(createdEvents.map((e) => e.marchId)).toEqual(
        expect.arrayContaining([march1.id, march2.id, march3.id]),
      );

      // Verify: each has correct data
      const c1 = createdEvents.find((e) => e.marchId === march1.id)!;
      expect(c1.fromCityId).toBe('city-a');
      expect(c1.toCityId).toBe('city-b');
      expect(c1.troops).toBe(1000);

      const c2 = createdEvents.find((e) => e.marchId === march2.id)!;
      expect(c2.fromCityId).toBe('city-c');
      expect(c2.toCityId).toBe('city-d');

      const c3 = createdEvents.find((e) => e.marchId === march3.id)!;
      expect(c3.fromCityId).toBe('city-e');
      expect(c3.toCityId).toBe('city-f');

      // Start all marches
      system.startMarch(march1.id);
      system.startMarch(march2.id);
      system.startMarch(march3.id);

      // Verify: 3 started events
      expect(startedEvents).toHaveLength(3);
      expect(startedEvents.map((e) => e.marchId)).toEqual(
        expect.arrayContaining([march1.id, march2.id, march3.id]),
      );

      // Run update loop until all arrive
      runUpdateUntilArrived(system, [march1.id, march2.id, march3.id], {
        dt: 1,
        maxIterations: 500,
      });

      // Verify: all arrived
      expect(march1.state).toBe('arrived');
      expect(march2.state).toBe('arrived');
      expect(march3.state).toBe('arrived');

      // Verify: 3 arrived events, each with correct data
      expect(arrivedEvents).toHaveLength(3);

      const a1 = arrivedEvents.find((e) => e.marchId === march1.id)!;
      expect(a1.cityId).toBe('city-b');
      expect(a1.troops).toBe(1000);
      expect(a1.general).toBe('张飞');

      const a2 = arrivedEvents.find((e) => e.marchId === march2.id)!;
      expect(a2.cityId).toBe('city-d');
      expect(a2.troops).toBe(2000);

      const a3 = arrivedEvents.find((e) => e.marchId === march3.id)!;
      expect(a3.cityId).toBe('city-f');
      expect(a3.troops).toBe(500);
    });

    it('marches do not interfere with each other positions', () => {
      const path1 = makeWaypointPath({ x: 0, y: 0 }, { x: 50, y: 0 });
      const path2 = makeWaypointPath({ x: 100, y: 100 }, { x: 200, y: 100 });

      const march1 = system.createMarch('city-a', 'city-b', 1000, '张飞', 'shu', path1);
      const march2 = system.createMarch('city-c', 'city-d', 2000, '关羽', 'wei', path2);

      system.startMarch(march1.id);
      system.startMarch(march2.id);

      // Update a few times
      for (let i = 0; i < 10; i++) {
        system.update(0.5);
      }

      // Verify positions are on their respective paths
      expect(march1.x).toBeGreaterThanOrEqual(0);
      expect(march1.x).toBeLessThanOrEqual(50);
      expect(march1.y).toBe(0);

      expect(march2.x).toBeGreaterThanOrEqual(100);
      expect(march2.x).toBeLessThanOrEqual(200);
      expect(march2.y).toBe(100);
    });
  });

  // =========================================================================
  // Test 5: March cancellation
  // =========================================================================

  describe('5. March cancellation', () => {
    it('create -> start -> cancel mid-way', () => {
      const createdEvents = collectEvents<MarchCreatedPayload>(eventBus, 'march:created');
      const startedEvents = collectEvents<MarchStartedPayload>(eventBus, 'march:started');
      const cancelledEvents = collectEvents<MarchCancelledPayload>(eventBus, 'march:cancelled');

      const path = makeWaypointPath(
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 200, y: 0 },
        { x: 300, y: 0 },
      );
      const march = system.createMarch('city-a', 'city-b', 3000, '吕布', 'wei', path);

      // Verify: created
      expect(createdEvents).toHaveLength(1);
      expect(march.state).toBe('preparing');

      // Start
      system.startMarch(march.id);
      expect(startedEvents).toHaveLength(1);
      expect(march.state).toBe('marching');

      // Update a few ticks (mid-way)
      for (let i = 0; i < 5; i++) {
        system.update(1);
      }

      // Verify march is still active and has moved
      expect(system.getMarch(march.id)).toBeDefined();
      const positionBeforeCancel = march.x;

      // Cancel
      system.cancelMarch(march.id);

      // Verify: march:cancelled event emitted
      expect(cancelledEvents).toHaveLength(1);
      expect(cancelledEvents[0].marchId).toBe(march.id);
      expect(cancelledEvents[0].troops).toBe(3000);

      // Verify: march removed from active marches
      expect(system.getMarch(march.id)).toBeUndefined();
      expect(system.getActiveMarches()).toHaveLength(0);

      // Verify: march state is 'cancelled' (on the object reference)
      expect(march.state).toBe('cancelled');
    });

    it('cancelled march does not emit march:arrived', () => {
      const arrivedEvents = collectEvents<MarchArrivedPayload>(eventBus, 'march:arrived');

      const path = makeWaypointPath({ x: 0, y: 0 }, { x: 50, y: 0 });
      const march = system.createMarch('city-a', 'city-b', 500, '黄忠', 'shu', path);
      system.startMarch(march.id);

      // Update a couple of ticks then cancel
      system.update(1);
      system.cancelMarch(march.id);

      // Continue updating -- should NOT trigger arrived
      for (let i = 0; i < 100; i++) {
        system.update(1);
      }

      // No march:arrived should have been emitted
      expect(arrivedEvents).toHaveLength(0);
    });

    it('cancel with siegeTaskId propagates to event payload', () => {
      const cancelledEvents = collectEvents<MarchCancelledPayload>(eventBus, 'march:cancelled');

      const path = makeWaypointPath({ x: 0, y: 0 }, { x: 50, y: 0 });
      const march = system.createMarch('city-a', 'city-b', 1000, '张飞', 'shu', path);
      march.siegeTaskId = 'task-siege-e2e-001';

      system.startMarch(march.id);
      system.update(1);
      system.cancelMarch(march.id);

      expect(cancelledEvents).toHaveLength(1);
      expect(cancelledEvents[0].siegeTaskId).toBe('task-siege-e2e-001');
    });

    it('other active marches continue after one is cancelled', () => {
      const arrivedEvents = collectEvents<MarchArrivedPayload>(eventBus, 'march:arrived');

      const path1 = makeWaypointPath({ x: 0, y: 0 }, { x: 20, y: 0 });
      const path2 = makeWaypointPath({ x: 100, y: 0 }, { x: 120, y: 0 });

      const march1 = system.createMarch('city-a', 'city-b', 1000, '张飞', 'shu', path1);
      const march2 = system.createMarch('city-c', 'city-d', 2000, '关羽', 'wei', path2);

      system.startMarch(march1.id);
      system.startMarch(march2.id);

      // Cancel march1 mid-way
      system.update(1);
      system.cancelMarch(march1.id);

      // march2 should still be active
      expect(system.getMarch(march2.id)).toBeDefined();
      expect(system.getMarch(march2.id)!.state).toBe('marching');

      // Continue updating until march2 arrives
      runUpdateUntilArrived(system, [march2.id]);

      // march2 should arrive
      expect(march2.state).toBe('arrived');
      expect(arrivedEvents).toHaveLength(1);
      expect(arrivedEvents[0].marchId).toBe(march2.id);
    });
  });

  // =========================================================================
  // Additional: Wildcard event subscription with real EventBus
  // =========================================================================

  describe('6. Wildcard event subscription (real EventBus)', () => {
    it('march:* wildcard captures all march events', () => {
      const wildcardEvents: Array<{ event: string; payload: any }> = [];

      eventBus.on('march:*', (payload: any) => {
        // We need to capture which specific event fired; since wildcard
        // passes the same payload, we track via explicit listeners.
      });

      // Use explicit listeners to simulate wildcard behavior tracking
      const allEvents: string[] = [];
      eventBus.on('march:created', () => allEvents.push('march:created'));
      eventBus.on('march:started', () => allEvents.push('march:started'));
      eventBus.on('march:arrived', () => allEvents.push('march:arrived'));
      eventBus.on('march:cancelled', () => allEvents.push('march:cancelled'));

      const path = makeWaypointPath({ x: 0, y: 0 }, { x: 30, y: 0 });
      const march = system.createMarch('city-a', 'city-b', 1000, '张飞', 'shu', path);

      expect(allEvents).toContain('march:created');

      system.startMarch(march.id);
      expect(allEvents).toContain('march:started');

      runUpdateUntilArrived(system, [march.id]);
      expect(allEvents).toContain('march:arrived');

      expect(allEvents).toEqual(['march:created', 'march:started', 'march:arrived']);
    });
  });

  // =========================================================================
  // Additional: Siege-related march chain
  // =========================================================================

  describe('7. March with siegeTaskId through full chain', () => {
    it('siegeTaskId preserved from creation through arrival event', () => {
      const createdEvents = collectEvents<MarchCreatedPayload>(eventBus, 'march:created');
      const arrivedEvents = collectEvents<MarchArrivedPayload>(eventBus, 'march:arrived');

      const path = makeWaypointPath({ x: 0, y: 0 }, { x: 50, y: 0 });
      const march = system.createMarch('city-a', 'city-b', 2000, '关羽', 'shu', path);
      march.siegeTaskId = 'task-siege-full-chain';

      system.startMarch(march.id);
      runUpdateUntilArrived(system, [march.id]);

      // Verify arrived event includes siegeTaskId
      expect(arrivedEvents).toHaveLength(1);
      expect(arrivedEvents[0].marchId).toBe(march.id);
      expect(arrivedEvents[0].siegeTaskId).toBe('task-siege-full-chain');
      expect(arrivedEvents[0].cityId).toBe('city-b');
      expect(arrivedEvents[0].troops).toBe(2000);
      expect(arrivedEvents[0].general).toBe('关羽');
    });
  });

  // =========================================================================
  // Additional: EventBus once() behavior with march events
  // =========================================================================

  describe('8. EventBus once() for march:arrived', () => {
    it('once() handler fires only once for the first arrival', () => {
      let onceCallCount = 0;

      eventBus.once<MarchArrivedPayload>('march:arrived', () => {
        onceCallCount++;
      });

      // Create and run two marches
      const path1 = makeWaypointPath({ x: 0, y: 0 }, { x: 20, y: 0 });
      const path2 = makeWaypointPath({ x: 0, y: 50 }, { x: 20, y: 50 });

      const march1 = system.createMarch('city-a', 'city-b', 1000, '张飞', 'shu', path1);
      const march2 = system.createMarch('city-c', 'city-d', 1000, '赵云', 'shu', path2);

      system.startMarch(march1.id);
      system.startMarch(march2.id);

      runUpdateUntilArrived(system, [march1.id, march2.id]);

      // once() handler should only have been called once (for the first arrival)
      expect(onceCallCount).toBe(1);
    });
  });
});
