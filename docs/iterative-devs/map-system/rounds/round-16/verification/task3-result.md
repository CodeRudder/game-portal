# R16 Task 3 Result: E2E Real System Tests -- Siege Animation with Real EventBus

## What Was Created

**File**: `src/components/idle/panels/map/__tests__/siege-animation-e2e.integration.test.tsx` (NEW)

A comprehensive integration test suite using **real** EventBus, **real** SiegeBattleSystem, and **real** SiegeBattleAnimationSystem (no mocks for these three). Only non-essential deps (config, registry) are mocked with `vi.fn()`.

### Tests Implemented (7 total)

| # | Test Name | What It Validates |
|---|-----------|-------------------|
| 1 | `battle:started -> startSiegeAnimation -> completeSiegeAnimation -> siegeAnim:completed` | Manual emission of battle:started triggers animation creation; completeSiegeAnimation emits siegeAnim:completed with correct payload |
| 2 | `eventBus.once("siegeAnim:completed") fires exactly once` | EventBus once() semantics work correctly -- handler fires once then never again on subsequent emissions |
| 3 | `Full chain -- createBattle -> battle:started -> battle:completed -> siegeAnim:completed` | End-to-end: SiegeBattleSystem.createBattle emits battle:started, animation system auto-creates animation, update() loop drives battle to completion, battle:completed triggers completeSiegeAnimation, siegeAnim:completed fires |
| 4 | `battle:completed for unknown taskId does not emit siegeAnim:completed` | Safety check: completing a non-existent animation does not crash or emit spurious events |
| 5 | `Animation transitions from assembly to battle phase via update()` | Phase transition: assembly -> battle triggered by update() after assemblyDurationMs elapsed |
| 6 | `Completed animation removed after linger period via update()` | Lifecycle: completed animation stays for completedLingerMs then is cleaned up by update() |
| 7 | `Multiple concurrent battles produce independent siegeAnim:completed events` | Concurrency: two battles with different strategies (forceAttack vs siege) complete independently at different times |

## Test Results

### New Tests
```
 ✓ siege-animation-e2e.integration.test.tsx (7 tests) 4ms
   Test Files  1 passed (1)
        Tests  7 passed (7)
```

### Regression Tests (existing siege animation sequencing)
```
 ✓ siege-animation-sequencing.test.tsx (6 tests) 159ms
   Test Files  1 passed (1)
        Tests  6 passed (6)
```

### TypeScript Check
No new type errors introduced. Pre-existing PathfindingSystem errors remain unchanged.

## Key Findings

1. **Real systems work correctly end-to-end**: The R15 P1-1 bug (mock not listening for battle:started) is confirmed as a mock-only issue. The real SiegeBattleAnimationSystem properly registers battle:started and battle:completed listeners in init().

2. **EventBus once() semantics are correct**: The once handler fires exactly once and is properly removed, preventing duplicate modal show events.

3. **Full battle lifecycle works**: SiegeBattleSystem.createBattle -> battle:started -> SiegeBattleAnimationSystem auto-starts animation -> SiegeBattleSystem.update() depletes defense -> battle:completed -> SiegeBattleAnimationSystem.completeSiegeAnimation -> siegeAnim:completed. All synchronous and correct.

4. **Phase transitions are driven by update()**: The assembly->battle transition and completed animation cleanup both work via the update(dt) loop, not via timers or callbacks.

5. **Concurrent battles are independent**: Multiple battles on the same EventBus do not interfere with each other, each producing their own siegeAnim:completed event at the correct time.
