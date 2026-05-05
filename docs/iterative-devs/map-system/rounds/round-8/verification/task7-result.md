# Task 7: SiegeResultCalculator Integration into WorldMapTab

## Summary

Integrated `SiegeResultCalculator` into `WorldMapTab.tsx` as a `battle:completed` event handler, and created comprehensive integration tests (7/7 passing).

## Changes Made

### 1. WorldMapTab.tsx - Added battle:completed Handler

**File:** `src/components/idle/panels/map/WorldMapTab.tsx`

**Imports added:**
- `BattleCompletedEvent` from `SiegeBattleSystem` (type import)
- `SiegeResultCalculator` from `SiegeResultCalculator` (value import)

**Handler logic (registered in the same useEffect as march:arrived / march:cancelled):**

1. Guards: exit if `siegeTaskManager` missing, task not found, or task already has a result (prevents duplicate processing when synchronous march:arrived flow has already handled it)
2. Uses `SiegeResultCalculator.calculateSettlement()` with territory context (level, isFirstCapture)
3. Builds `CasualtyResult` from settlement output
4. Sets `SiegeTaskResult` via `siegeTaskManager.setResult()`
5. Advances status: `sieging -> settling -> returning`
6. Creates return march via `marchingSystem.calculateMarchRoute()` + `createMarch()`, or immediately completes if no route found
7. Updates UI state via `setActiveSiegeTasks()`

**Cleanup:** unsubscribes from `battle:completed` in the useEffect cleanup function.

**Coexistence:** The existing `march:arrived` synchronous siege flow (via `siegeSystem.executeSiege()`) continues to work. The `battle:completed` handler includes a `task.result` guard to skip tasks already processed by the synchronous path.

### 2. Integration Test

**File:** `src/games/three-kingdoms/engine/map/__tests__/integration/siege-settlement.integration.test.ts`

**7 test scenarios, all passing:**

| # | Scenario | What it verifies |
|---|----------|-----------------|
| 1 | decisiveVictory | Fast victory (elapsedMs < 10s, defense=0) -> low casualties (10-20%), high reward (2.25x with first capture) |
| 2 | defeat | Standard defeat (defense remaining 30%) -> high casualties (40-70%), zero reward |
| 3 | narrowVictory + hero injury | Long battle (elapsedMs > 40s) -> moderate casualties (30-40%), hero injury with deterministic RNG |
| 4 | Full chain | createTask -> advanceStatus -> createBattle -> update -> battle:completed -> calculateSettlement -> setResult -> advance to returning |
| 5 | Multiple battles | 3 simultaneous battles completing in sequence, first-capture bonus verification |
| 6 | rout | High remaining defense (>50%) -> rout outcome with 80-90% casualties |
| 7 | EventBus error isolation | Exception in one handler does not prevent other handlers or settlement calculation |

## Test Results

```
 ✓ siege-settlement.integration.test.ts (7 tests) 5ms
   Test Files  1 passed (1)
        Tests  7 passed (7)
```

## Key Design Decisions

1. **Duplicate processing guard:** The handler checks `task.result` before processing, ensuring it doesn't conflict with the existing synchronous `march:arrived` flow.
2. **Real EventBus:** Integration tests use the actual `EventBus` class (not mocks) to validate event emission, subscription, and error isolation.
3. **Deterministic RNG:** Settlement calculations use injected RNG for reproducible test assertions.
4. **No modification to existing flow:** The `march:arrived` handler's siege execution path remains untouched.
