/**
 * Integration test -- cancelBattle -> completeSiegeAnimation -> siegeAnim:completed chain
 *
 * Verifies the R15 P1 (A6) adversarial finding:
 *   When cancelBattle stops the battle engine but NOT the animation system,
 *   a subsequent manual completeSiegeAnimation() must still correctly emit
 *   siegeAnim:completed and fire any once() handlers registered on the EventBus.
 *
 * All systems use REAL instances -- no mocks:
 *   - SiegeBattleSystem   (battle engine)
 *   - SiegeBattleAnimationSystem  (animation state machine)
 *   - EventBus            (event bus)
 *
 * Chain under test:
 *   1. createBattle()         -> emits battle:started
 *   2. animSystem             -> receives battle:started, starts animation
 *   3. cancelBattle()         -> stops battle engine, animation persists
 *   4. eventBus.once()        -> register one-time handler for siegeAnim:completed
 *   5. completeSiegeAnimation -> emits siegeAnim:completed, fires once handler
 *
 * @module engine/map/__tests__/integration/siege-animation-chain
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SiegeBattleSystem } from '../../SiegeBattleSystem';
import { SiegeBattleAnimationSystem } from '../../SiegeBattleAnimationSystem';
import type { SiegeAnimCompletedEvent } from '../../SiegeBattleAnimationSystem';
import { EventBus } from '../../../../core/events/EventBus';
import type { ISystemDeps } from '../../../../core/types';
import type { ISubsystemRegistry } from '../../../../core/types/subsystem';
import type { BattleStartedEvent } from '../../SiegeBattleSystem';

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

/** Create real ISystemDeps with a real EventBus and minimal stubs. */
function createRealDeps(): ISystemDeps {
  const eventBus = new EventBus();

  const config = {
    get: () => undefined,
    set: () => {},
    has: () => false,
    delete: () => {},
    loadFromConstants: () => {},
    getAll: () => ({} as Record<string, unknown>),
  };

  const subsystems = new Map<string, unknown>();

  const registry: ISubsystemRegistry = {
    register: (name: string, subsystem: unknown) => { subsystems.set(name, subsystem); },
    get: <T>(name: string) => subsystems.get(name) as T,
    getAll: () => new Map() as Map<string, any>,
    has: (name: string) => subsystems.has(name),
    unregister: (name: string) => { subsystems.delete(name); },
  };

  return { eventBus, config: config as any, registry };
}

/** Standard battle creation parameters. */
function defaultBattleParams(taskId = 'task-chain-001') {
  return {
    taskId,
    targetId: 'city-changsha',
    troops: 8000,
    strategy: 'forceAttack' as const,
    targetDefenseLevel: 2,
    targetX: 30,
    targetY: 20,
    faction: 'shu' as const,
  };
}

// ─────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────

describe('cancelBattle -> completeSiegeAnimation -> siegeAnim:completed chain', () => {
  let battleSystem: SiegeBattleSystem;
  let animSystem: SiegeBattleAnimationSystem;
  let deps: ISystemDeps;

  beforeEach(() => {
    battleSystem = new SiegeBattleSystem({
      baseDurationMs: 5_000,
      baseDefenseValue: 200,
      minDurationMs: 1_000,
      maxDurationMs: 60_000,
    });

    animSystem = new SiegeBattleAnimationSystem({
      assemblyDurationMs: 500,     // short assembly for faster tests
      completedLingerMs: 1_000,
    });

    deps = createRealDeps();

    // Both systems share the same real EventBus
    battleSystem.init(deps);
    animSystem.init(deps);
  });

  // ─────────────────────────────────────────────
  // Step 1: createBattle -> battle:started
  // ─────────────────────────────────────────────

  it('step 1: createBattle emits battle:started event', () => {
    const startedEvents: BattleStartedEvent[] = [];
    deps.eventBus.on<BattleStartedEvent>('battle:started', (e) => startedEvents.push(e));

    battleSystem.createBattle(defaultBattleParams());

    expect(startedEvents).toHaveLength(1);
    expect(startedEvents[0].taskId).toBe('task-chain-001');
    expect(startedEvents[0].targetId).toBe('city-changsha');
    expect(startedEvents[0].strategy).toBe('forceAttack');
    expect(startedEvents[0].faction).toBe('shu');
    expect(startedEvents[0].troops).toBe(8000);
    expect(startedEvents[0].maxDefense).toBe(400); // targetDefenseLevel(2) * baseDefenseValue(200)
  });

  // ─────────────────────────────────────────────
  // Step 2: animSystem receives battle:started and starts animation
  // ─────────────────────────────────────────────

  it('step 2: SiegeBattleAnimationSystem receives battle:started and creates animation', () => {
    battleSystem.createBattle(defaultBattleParams());

    const anim = animSystem.getAnimation('task-chain-001');
    expect(anim).not.toBeNull();
    expect(anim!.taskId).toBe('task-chain-001');
    expect(anim!.targetCityId).toBe('city-changsha');
    expect(anim!.phase).toBe('assembly');
    expect(anim!.defenseRatio).toBe(1.0);
    expect(anim!.strategy).toBe('forceAttack');
    expect(anim!.faction).toBe('shu');
    expect(anim!.troops).toBe(8000);
    expect(anim!.victory).toBeNull();
  });

  // ─────────────────────────────────────────────
  // Step 3: cancelBattle does NOT remove animation from SiegeBattleAnimationSystem
  // ─────────────────────────────────────────────

  it('step 3: cancelBattle stops battle engine but animation persists in animSystem', () => {
    const cancelledEvents: Array<{ taskId: string }> = [];
    deps.eventBus.on('battle:cancelled', (e: any) => cancelledEvents.push(e));

    battleSystem.createBattle(defaultBattleParams('task-cancel-chain'));

    // Confirm animation exists
    expect(animSystem.getAnimation('task-cancel-chain')).not.toBeNull();

    // Cancel the battle
    battleSystem.cancelBattle('task-cancel-chain');

    // Battle cancelled event was emitted
    expect(cancelledEvents).toHaveLength(1);
    expect(cancelledEvents[0].taskId).toBe('task-cancel-chain');

    // Battle removed from battleSystem
    expect(battleSystem.getBattle('task-cancel-chain')).toBeNull();

    // Animation STILL persists -- SiegeBattleAnimationSystem does NOT listen to battle:cancelled
    const anim = animSystem.getAnimation('task-cancel-chain');
    expect(anim).not.toBeNull();
    expect(anim!.phase).toBe('assembly');
    expect(anim!.victory).toBeNull();
  });

  // ─────────────────────────────────────────────
  // Step 4+5: completeSiegeAnimation emits siegeAnim:completed
  // ─────────────────────────────────────────────

  it('step 4-5: completeSiegeAnimation emits siegeAnim:completed event', () => {
    battleSystem.createBattle(defaultBattleParams('task-complete-chain'));

    // Cancel the battle (simulate the UI flow: cancelBattle after settlement)
    battleSystem.cancelBattle('task-complete-chain');

    // Register listener for siegeAnim:completed (this is what WorldMapTab does with once)
    const completedEvents: SiegeAnimCompletedEvent[] = [];
    deps.eventBus.on<SiegeAnimCompletedEvent>('siegeAnim:completed', (e) => completedEvents.push(e));

    // Also listen for phaseChanged to verify full chain
    const phaseChangedEvents: Array<{ taskId: string; fromPhase: string; toPhase: string }> = [];
    deps.eventBus.on('siegeAnim:phaseChanged', (e: any) => phaseChangedEvents.push(e));

    // Manually complete the animation (as WorldMapTab does)
    animSystem.completeSiegeAnimation('task-complete-chain', true);

    // siegeAnim:completed was emitted
    expect(completedEvents).toHaveLength(1);
    expect(completedEvents[0].taskId).toBe('task-complete-chain');
    expect(completedEvents[0].targetCityId).toBe('city-changsha');
    expect(completedEvents[0].victory).toBe(true);

    // Animation phase changed to completed
    expect(phaseChangedEvents.length).toBeGreaterThanOrEqual(1);
    const lastPhaseChange = phaseChangedEvents[phaseChangedEvents.length - 1];
    expect(lastPhaseChange.toPhase).toBe('completed');

    // Animation is in completed state
    const anim = animSystem.getAnimation('task-complete-chain');
    expect(anim).not.toBeNull();
    expect(anim!.phase).toBe('completed');
    expect(anim!.victory).toBe(true);
    expect(anim!.defenseRatio).toBe(0); // victory -> defenseRatio set to 0
  });

  // ─────────────────────────────────────────────
  // Full chain: once handler receives correct data
  // ─────────────────────────────────────────────

  it('full chain: once handler registered before completeSiegeAnimation fires with correct data', () => {
    const taskId = 'task-once-chain';

    // 1. Create battle -> battle:started -> animation starts
    battleSystem.createBattle(defaultBattleParams(taskId));

    // Verify animation was created
    expect(animSystem.getAnimation(taskId)).not.toBeNull();

    // 2. Cancel battle (stops engine, animation persists)
    battleSystem.cancelBattle(taskId);
    expect(battleSystem.getBattle(taskId)).toBeNull();
    expect(animSystem.getAnimation(taskId)).not.toBeNull();

    // 3. Register a once() handler BEFORE completeSiegeAnimation
    //    This mirrors WorldMapTab: eventBus.once('siegeAnim:completed', handler)
    let onceFired = false;
    let onceData: SiegeAnimCompletedEvent | null = null;
    deps.eventBus.once<SiegeAnimCompletedEvent>('siegeAnim:completed', (data) => {
      onceFired = true;
      onceData = data;
    });

    // 4. Manually complete the animation
    animSystem.completeSiegeAnimation(taskId, true);

    // 5. Verify the once handler fired exactly once with correct data
    expect(onceFired).toBe(true);
    expect(onceData).not.toBeNull();
    expect(onceData!.taskId).toBe(taskId);
    expect(onceData!.targetCityId).toBe('city-changsha');
    expect(onceData!.victory).toBe(true);

    // 6. Verify once handler was consumed (won't fire again)
    let secondFire = false;
    deps.eventBus.once<SiegeAnimCompletedEvent>('siegeAnim:completed', () => {
      secondFire = true;
    });

    // Emit a new siegeAnim:completed manually to verify the first handler is gone
    // (The first once handler should NOT fire again)
    onceFired = false;
    deps.eventBus.emit<SiegeAnimCompletedEvent>('siegeAnim:completed', {
      taskId: 'other-task',
      targetCityId: 'other-city',
      victory: false,
    });

    // The first once handler's flag should remain false (it was consumed)
    expect(onceFired).toBe(false);
    // The second once handler should have fired
    expect(secondFire).toBe(true);
  });

  // ─────────────────────────────────────────────
  // Chain with defeat (victory=false)
  // ─────────────────────────────────────────────

  it('chain works with defeat (victory=false)', () => {
    const taskId = 'task-defeat-chain';

    battleSystem.createBattle(defaultBattleParams(taskId));
    battleSystem.cancelBattle(taskId);

    let onceData: SiegeAnimCompletedEvent | null = null;
    deps.eventBus.once<SiegeAnimCompletedEvent>('siegeAnim:completed', (data) => {
      onceData = data;
    });

    animSystem.completeSiegeAnimation(taskId, false);

    expect(onceData).not.toBeNull();
    expect(onceData!.taskId).toBe(taskId);
    expect(onceData!.victory).toBe(false);

    const anim = animSystem.getAnimation(taskId);
    expect(anim!.victory).toBe(false);
    // On defeat, defenseRatio stays at current value (not forced to 0)
    expect(anim!.defenseRatio).toBe(1.0);
  });

  // ─────────────────────────────────────────────
  // completeSiegeAnimation on non-existent taskId is a no-op
  // ─────────────────────────────────────────────

  it('completeSiegeAnimation on non-existent taskId does not emit', () => {
    let fired = false;
    deps.eventBus.once<SiegeAnimCompletedEvent>('siegeAnim:completed', () => {
      fired = true;
    });

    // No animation exists for this taskId
    animSystem.completeSiegeAnimation('nonexistent-task', true);

    expect(fired).toBe(false);
  });

  // ─────────────────────────────────────────────
  // Post-cancellation animation can advance through assembly -> battle -> completed
  // ─────────────────────────────────────────────

  it('post-cancellation animation can advance through phases via update() before completion', () => {
    const taskId = 'task-phase-chain';

    battleSystem.createBattle(defaultBattleParams(taskId));
    battleSystem.cancelBattle(taskId);

    // Animation should still be in assembly
    const anim = animSystem.getAnimation(taskId);
    expect(anim!.phase).toBe('assembly');

    // Advance past assembly duration (500ms)
    animSystem.update(0.6);

    // Should have transitioned to battle phase
    expect(anim!.phase).toBe('battle');

    // Now manually complete
    let onceData: SiegeAnimCompletedEvent | null = null;
    deps.eventBus.once<SiegeAnimCompletedEvent>('siegeAnim:completed', (data) => {
      onceData = data;
    });

    animSystem.completeSiegeAnimation(taskId, true);

    expect(onceData).not.toBeNull();
    expect(onceData!.taskId).toBe(taskId);
    expect(onceData!.victory).toBe(true);
    expect(anim!.phase).toBe('completed');
  });
});
