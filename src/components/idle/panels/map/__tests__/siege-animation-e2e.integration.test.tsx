/**
 * siege-animation-e2e.integration.test.tsx
 *
 * R16 Task 3: E2E Real System Tests -- siege animation with real EventBus
 *
 * These tests use REAL EventBus, REAL SiegeBattleSystem, and REAL
 * SiegeBattleAnimationSystem (not mocks) to validate the full event chain:
 *
 *   battle:started -> SiegeBattleAnimationSystem.startSiegeAnimation()
 *   battle:completed -> SiegeBattleAnimationSystem.completeSiegeAnimation()
 *   -> siegeAnim:completed fires on the shared EventBus
 *
 * R15 P1-1 discovered the mock didn't listen for battle:started, causing
 * completeSiegeAnimation to silently return. These tests ensure the real
 * systems behave correctly end-to-end.
 *
 * Only non-essential deps (config, registry) are mocked; EventBus and
 * both siege systems are real.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventBus } from '@/games/three-kingdoms/core/events/EventBus';
import { SiegeBattleSystem } from '@/games/three-kingdoms/engine/map/SiegeBattleSystem';
import {
  SiegeBattleAnimationSystem,
  type SiegeAnimCompletedEvent,
  type SiegeAnimStartedEvent,
  type SiegeAnimPhaseChangedEvent,
} from '@/games/three-kingdoms/engine/map/SiegeBattleAnimationSystem';
import type { ISystemDeps } from '@/games/three-kingdoms/core/types/subsystem';

// ── Minimal real deps (only config and registry are mocked) ──

function makeRealEventBus(): EventBus {
  return new EventBus();
}

function makeDeps(eventBus: EventBus): ISystemDeps {
  return {
    eventBus,
    config: {
      get: vi.fn(),
      getNumber: vi.fn().mockReturnValue(0),
      getBoolean: vi.fn().mockReturnValue(false),
      getString: vi.fn().mockReturnValue(''),
    } as any,
    registry: {
      register: vi.fn(),
      get: vi.fn(),
      getAll: vi.fn().mockReturnValue(new Map()),
      has: vi.fn().mockReturnValue(false),
      unregister: vi.fn(),
    } as any,
  };
}

// ── Tests ──

describe('E2E Real System -- siege animation with real EventBus', () => {
  let eventBus: EventBus;
  let deps: ISystemDeps;

  beforeEach(() => {
    eventBus = makeRealEventBus();
    deps = makeDeps(eventBus);
  });

  afterEach(() => {
    eventBus.removeAllListeners();
  });

  // ──────────────────────────────────────────────────────────────
  // Test 1: Real EventBus + Real SiegeBattleAnimationSystem --
  //   battle:started triggers animation, then completeSiegeAnimation
  //   fires siegeAnim:completed
  // ──────────────────────────────────────────────────────────────
  it('Test 1: battle:started -> startSiegeAnimation -> completeSiegeAnimation -> siegeAnim:completed', () => {
    const animSystem = new SiegeBattleAnimationSystem();
    animSystem.init(deps);

    // Listen for siegeAnim:started to verify animation was created
    const startedHandler = vi.fn();
    eventBus.on<SiegeAnimStartedEvent>('siegeAnim:started', startedHandler);

    // Emit battle:started (simulating what SiegeBattleSystem would do)
    eventBus.emit('battle:started', {
      taskId: 'task-e2e-001',
      targetId: 'city-luoyang',
      strategy: 'forceAttack',
      troops: 5000,
      maxDefense: 100,
      estimatedDurationMs: 10000,
      targetX: 25,
      targetY: 15,
      faction: 'shu',
    });

    // Verify siegeAnim:started was fired (animation created)
    expect(startedHandler).toHaveBeenCalledTimes(1);
    expect(startedHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: 'task-e2e-001',
        targetCityId: 'city-luoyang',
        phase: 'assembly',
      }),
    );

    // Verify animation exists in the system
    const anim = animSystem.getAnimation('task-e2e-001');
    expect(anim).not.toBeNull();
    expect(anim!.phase).toBe('assembly');
    expect(anim!.targetCityId).toBe('city-luoyang');

    // Listen for siegeAnim:completed
    const completedHandler = vi.fn();
    eventBus.on<SiegeAnimCompletedEvent>('siegeAnim:completed', completedHandler);

    // Complete the animation
    animSystem.completeSiegeAnimation('task-e2e-001', true);

    // Verify siegeAnim:completed was fired with correct payload
    expect(completedHandler).toHaveBeenCalledTimes(1);
    expect(completedHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: 'task-e2e-001',
        targetCityId: 'city-luoyang',
        victory: true,
      }),
    );

    // Verify animation state is now 'completed'
    const completedAnim = animSystem.getAnimation('task-e2e-001');
    expect(completedAnim).not.toBeNull();
    expect(completedAnim!.phase).toBe('completed');
    expect(completedAnim!.victory).toBe(true);

    animSystem.destroy();
  });

  // ──────────────────────────────────────────────────────────────
  // Test 2: Real EventBus -- once handler works correctly
  //   with siegeAnim:completed
  // ──────────────────────────────────────────────────────────────
  it('Test 2: eventBus.once("siegeAnim:completed") fires exactly once', () => {
    const animSystem = new SiegeBattleAnimationSystem();
    animSystem.init(deps);

    // Register a once handler
    const onceHandler = vi.fn();
    eventBus.once<SiegeAnimCompletedEvent>('siegeAnim:completed', onceHandler);

    // Create animation via battle:started
    eventBus.emit('battle:started', {
      taskId: 'task-e2e-002',
      targetId: 'city-xuchang',
      strategy: 'siege',
      troops: 3000,
      maxDefense: 200,
      estimatedDurationMs: 30000,
      targetX: 30,
      targetY: 20,
      faction: 'wei',
    });

    // Complete animation (this emits siegeAnim:completed)
    animSystem.completeSiegeAnimation('task-e2e-002', true);

    // Verify once handler was called exactly once
    expect(onceHandler).toHaveBeenCalledTimes(1);
    expect(onceHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: 'task-e2e-002',
        targetCityId: 'city-xuchang',
        victory: true,
      }),
    );

    // Reset the mock to check it's NOT called again
    onceHandler.mockClear();

    // Complete another animation to emit siegeAnim:completed again
    eventBus.emit('battle:started', {
      taskId: 'task-e2e-002b',
      targetId: 'city-jianye',
      strategy: 'nightRaid',
      troops: 2000,
      maxDefense: 150,
      estimatedDurationMs: 12000,
      targetX: 40,
      targetY: 30,
      faction: 'wu',
    });
    animSystem.completeSiegeAnimation('task-e2e-002b', false);

    // The once handler should NOT be called again (once semantics)
    expect(onceHandler).not.toHaveBeenCalled();

    animSystem.destroy();
  });

  // ──────────────────────────────────────────────────────────────
  // Test 3: Full real system chain --
  //   SiegeBattleSystem.createBattle -> SiegeBattleAnimationSystem
  //   listens -> battle completes via update() -> siegeAnim:completed
  // ──────────────────────────────────────────────────────────────
  it('Test 3: Full chain -- createBattle -> battle:started -> battle:completed -> siegeAnim:completed', () => {
    const battleSystem = new SiegeBattleSystem({
      minDurationMs: 1_000,
      maxDurationMs: 60_000,
      baseDurationMs: 10_000,
      baseDefenseValue: 100,
    });

    const animSystem = new SiegeBattleAnimationSystem({
      assemblyDurationMs: 500, // short assembly for test
      completedLingerMs: 1_000,
    });

    // Init both systems with the SAME real EventBus
    battleSystem.init(deps);
    animSystem.init(deps);

    // Listen for all relevant events
    const completedHandler = vi.fn();
    const phaseChangedHandler = vi.fn();
    const battleCompletedHandler = vi.fn();

    eventBus.on<SiegeAnimCompletedEvent>('siegeAnim:completed', completedHandler);
    eventBus.on<SiegeAnimPhaseChangedEvent>('siegeAnim:phaseChanged', phaseChangedHandler);
    eventBus.on('battle:completed', battleCompletedHandler);

    // Create battle (this emits battle:started)
    const session = battleSystem.createBattle({
      taskId: 'task-e2e-003',
      targetId: 'city-changan',
      troops: 8000,
      strategy: 'forceAttack',
      targetDefenseLevel: 2,
      targetX: 20,
      targetY: 10,
      faction: 'shu',
    });

    // Verify battle was created with correct params
    expect(session.taskId).toBe('task-e2e-003');
    expect(session.targetId).toBe('city-changan');
    expect(session.status).toBe('active');
    expect(session.maxDefense).toBe(200); // 2 * 100
    expect(session.victory).toBeNull();

    // Verify animation was auto-created via battle:started
    const anim = animSystem.getAnimation('task-e2e-003');
    expect(anim).not.toBeNull();
    expect(anim!.phase).toBe('assembly');
    expect(anim!.targetCityId).toBe('city-changan');

    // Drive the battle forward with update() calls
    // forceAttack strategy: baseDuration (10s) - 5s = 5s = 5000ms
    // attackPower = maxDefense / durationSeconds = 200 / 5 = 40 per second
    // Drive in 1-second increments
    for (let i = 0; i < 5; i++) {
      battleSystem.update(1.0); // 1 second per tick
    }

    // Battle should have completed (defense depleted or time exceeded)
    // battle:completed is emitted by SiegeBattleSystem
    // SiegeBattleAnimationSystem listens for battle:completed and calls completeSiegeAnimation
    // which in turn emits siegeAnim:completed

    // Verify battle:completed was emitted
    expect(battleCompletedHandler).toHaveBeenCalledTimes(1);
    expect(battleCompletedHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: 'task-e2e-003',
        targetId: 'city-changan',
        victory: true, // defense depleted = victory
      }),
    );

    // Verify siegeAnim:completed was emitted via the full chain
    expect(completedHandler).toHaveBeenCalledTimes(1);
    expect(completedHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: 'task-e2e-003',
        targetCityId: 'city-changan',
        victory: true,
      }),
    );

    // Verify animation state is completed
    const completedAnim = animSystem.getAnimation('task-e2e-003');
    expect(completedAnim).not.toBeNull();
    expect(completedAnim!.phase).toBe('completed');
    expect(completedAnim!.victory).toBe(true);

    // Cleanup
    battleSystem.destroy();
    animSystem.destroy();
  });

  // ──────────────────────────────────────────────────────────────
  // Test 4: battle:completed for non-existent animation is safe
  //   (no siegeAnim:completed emitted, no crash)
  // ──────────────────────────────────────────────────────────────
  it('Test 4: battle:completed for unknown taskId does not emit siegeAnim:completed', () => {
    const animSystem = new SiegeBattleAnimationSystem();
    animSystem.init(deps);

    const completedHandler = vi.fn();
    eventBus.on<SiegeAnimCompletedEvent>('siegeAnim:completed', completedHandler);

    // Emit battle:completed for a taskId that has no animation
    eventBus.emit('battle:completed', {
      taskId: 'nonexistent-task',
      targetId: 'city-unknown',
      victory: true,
      strategy: 'forceAttack',
      troops: 1000,
      elapsedMs: 5000,
      remainingDefense: 0,
    });

    // siegeAnim:completed should NOT be emitted (no animation to complete)
    expect(completedHandler).not.toHaveBeenCalled();

    animSystem.destroy();
  });

  // ──────────────────────────────────────────────────────────────
  // Test 5: Assembly -> Battle phase transition via update()
  // ──────────────────────────────────────────────────────────────
  it('Test 5: Animation transitions from assembly to battle phase via update()', () => {
    const animSystem = new SiegeBattleAnimationSystem({
      assemblyDurationMs: 1_000,
      completedLingerMs: 2_000,
    });
    animSystem.init(deps);

    const phaseChangedHandler = vi.fn();
    eventBus.on<SiegeAnimPhaseChangedEvent>('siegeAnim:phaseChanged', phaseChangedHandler);

    // Start animation via battle:started
    eventBus.emit('battle:started', {
      taskId: 'task-e2e-005',
      targetId: 'city-test',
      strategy: 'siege',
      troops: 4000,
      maxDefense: 100,
      estimatedDurationMs: 30000,
      targetX: 10,
      targetY: 20,
      faction: 'wu',
    });

    // Should start in assembly phase
    let anim = animSystem.getAnimation('task-e2e-005');
    expect(anim!.phase).toBe('assembly');

    // Drive forward by 0.5s -- still in assembly
    animSystem.update(0.5);
    anim = animSystem.getAnimation('task-e2e-005');
    expect(anim!.phase).toBe('assembly');
    expect(anim!.assemblyElapsedMs).toBe(500);

    // Drive forward by another 0.6s (total 1.1s) -- should transition to battle
    animSystem.update(0.6);
    anim = animSystem.getAnimation('task-e2e-005');
    expect(anim!.phase).toBe('battle');

    // Verify phase change event was fired
    expect(phaseChangedHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: 'task-e2e-005',
        fromPhase: 'assembly',
        toPhase: 'battle',
      }),
    );

    animSystem.destroy();
  });

  // ──────────────────────────────────────────────────────────────
  // Test 6: Completed animation is removed after linger timeout
  // ──────────────────────────────────────────────────────────────
  it('Test 6: Completed animation removed after linger period via update()', () => {
    const animSystem = new SiegeBattleAnimationSystem({
      assemblyDurationMs: 100,
      completedLingerMs: 500,
    });
    animSystem.init(deps);

    // Start and complete animation
    eventBus.emit('battle:started', {
      taskId: 'task-e2e-006',
      targetId: 'city-linger',
      strategy: 'insider',
      troops: 2000,
      maxDefense: 100,
      estimatedDurationMs: 20000,
      targetX: 15,
      targetY: 25,
      faction: 'wei',
    });

    animSystem.completeSiegeAnimation('task-e2e-006', true);

    // Animation should exist and be completed
    let anim = animSystem.getAnimation('task-e2e-006');
    expect(anim).not.toBeNull();
    expect(anim!.phase).toBe('completed');

    // Drive forward by 0.3s -- still lingering
    animSystem.update(0.3);
    anim = animSystem.getAnimation('task-e2e-006');
    expect(anim).not.toBeNull();

    // Drive forward by 0.3s more (total 0.6s > 0.5s linger) -- should be removed
    animSystem.update(0.3);
    anim = animSystem.getAnimation('task-e2e-006');
    expect(anim).toBeNull();

    animSystem.destroy();
  });

  // ──────────────────────────────────────────────────────────────
  // Test 7: Multiple concurrent battles with real systems
  // ──────────────────────────────────────────────────────────────
  it('Test 7: Multiple concurrent battles produce independent siegeAnim:completed events', () => {
    const battleSystem = new SiegeBattleSystem({
      minDurationMs: 1_000,
      maxDurationMs: 60_000,
      baseDurationMs: 10_000,
      baseDefenseValue: 100,
    });

    const animSystem = new SiegeBattleAnimationSystem({
      assemblyDurationMs: 0, // instant assembly for easier testing
    });

    battleSystem.init(deps);
    animSystem.init(deps);

    const completedEvents: SiegeAnimCompletedEvent[] = [];
    eventBus.on<SiegeAnimCompletedEvent>('siegeAnim:completed', (e) => {
      completedEvents.push(e);
    });

    // Create two battles
    battleSystem.createBattle({
      taskId: 'task-e2e-007a',
      targetId: 'city-A',
      troops: 5000,
      strategy: 'forceAttack',
      targetDefenseLevel: 1,
      targetX: 10,
      targetY: 10,
      faction: 'shu',
    });

    battleSystem.createBattle({
      taskId: 'task-e2e-007b',
      targetId: 'city-B',
      troops: 3000,
      strategy: 'siege',
      targetDefenseLevel: 1,
      targetX: 20,
      targetY: 20,
      faction: 'wei',
    });

    // Both animations should exist
    expect(animSystem.getAnimation('task-e2e-007a')).not.toBeNull();
    expect(animSystem.getAnimation('task-e2e-007b')).not.toBeNull();

    // Drive battles forward (forceAttack: 5s, siege: 25s)
    // After 5s, forceAttack battle should complete
    battleSystem.update(5.0);

    // At this point, task-e2e-007a should be completed (forceAttack, 5s duration)
    expect(completedEvents.length).toBeGreaterThanOrEqual(1);
    expect(completedEvents).toContainEqual(
      expect.objectContaining({
        taskId: 'task-e2e-007a',
        targetCityId: 'city-A',
        victory: true,
      }),
    );

    // task-e2e-007b should NOT be completed yet (siege: 25s duration)
    const eventsForB = completedEvents.filter((e) => e.taskId === 'task-e2e-007b');
    expect(eventsForB).toHaveLength(0);

    // Drive the remaining 20s to complete the siege battle
    battleSystem.update(20.0);

    // Now both should be completed
    expect(completedEvents).toContainEqual(
      expect.objectContaining({
        taskId: 'task-e2e-007b',
        targetCityId: 'city-B',
        victory: true,
      }),
    );

    battleSystem.destroy();
    animSystem.destroy();
  });
});
