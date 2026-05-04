# Task 2 Results: P0 Bug Fix — Siege Result Modal Appears Immediately Instead of Waiting for Animation

## Problem

In `WorldMapTab.tsx`, the `handleArrived` handler (inside `setTimeout(0)`) called `setSiegeResultVisible(true)` immediately after `executeSiege()` returned, causing the result modal to appear at the same time as the battle animation started. The expected behavior was: assembly animation (3s) -> battle animation -> result animation (2s) -> THEN show result modal.

## Root Cause

The siege execution flow in `handleArrived` was:
1. `battleSystem.createBattle()` -> emits `battle:started` -> SiegeBattleAnimationSystem starts animation
2. `siegeSystem.executeSiege()` -> returns result synchronously
3. `battleSystem.cancelBattle()` -> stops battle engine
4. `setSiegeResultData(result)` + `setSiegeResultVisible(true)` -> modal appears immediately

The modal display was not gated on animation completion.

## Changes Made

### File: `src/components/idle/panels/map/WorldMapTab.tsx`

#### 1. Added refs for animation sequencing (line 259-261)

```typescript
// ── 攻城动画→结果弹窗时序控制 ──
const pendingSiegeResultRef = useRef<any>(null);
const siegeAnimTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
```

#### 2. Removed immediate `cancelBattle()` call (replaced with comment at line 644-646)

The `cancelBattle()` call was removed so the battle engine continues running naturally. When the battle engine's `update(dt)` reduces defense to 0, it emits `battle:completed`, which triggers:
- `handleBattleCompleted` (which has a duplicate guard: `if (task.result) return;`)
- `SiegeBattleAnimationSystem.completeSiegeAnimation()` -> emits `siegeAnim:completed`

This allows the animation to play to completion naturally.

#### 3. Deferred modal display until `siegeAnim:completed` fires (lines 688-710)

Instead of calling `setSiegeResultVisible(true)` immediately:

```typescript
// Store result but don't show modal yet — wait for animation to complete
pendingSiegeResultRef.current = siegeResultData;
setSiegeResultData(siegeResultData);

// Listen for animation completion before showing modal
const animHandler = (animData: { taskId: string; targetCityId: string; victory: boolean }) => {
  if (animData.taskId === currentTask.id) {
    if (siegeAnimTimeoutRef.current) {
      clearTimeout(siegeAnimTimeoutRef.current);
      siegeAnimTimeoutRef.current = null;
    }
    setSiegeResultVisible(true);
  }
};

eventBus.once('siegeAnim:completed', animHandler);

// Safety fallback: show modal after 5s even if animation event never fires
siegeAnimTimeoutRef.current = setTimeout(() => {
  eventBus.off('siegeAnim:completed', animHandler);
  siegeAnimTimeoutRef.current = null;
  setSiegeResultVisible(true);
}, 5000);
```

#### 4. Added cleanup in useEffect return (lines 946-949)

```typescript
// Cleanup pending siege animation listeners
if (siegeAnimTimeoutRef.current) {
  clearTimeout(siegeAnimTimeoutRef.current);
  siegeAnimTimeoutRef.current = null;
}
```

### File: `src/components/idle/panels/map/__tests__/siege-animation-sequencing.test.tsx` (NEW)

Created comprehensive test file with 6 tests covering all scenarios:

1. **Modal not visible before animation completes** — After siege execution, `siegeResultVisible` is false
2. **Modal visible after siegeAnim:completed** — Firing event with correct taskId makes modal visible
3. **Result data correct after deferred display** — Victory status and target name preserved correctly
4. **Fallback timeout works** — If `siegeAnim:completed` never fires, modal shows after 5s
5. **Wrong taskId ignored** — Event with different taskId does not trigger modal
6. **Cleanup on unmount** — Timeout is properly cleaned up when component unmounts

## Test Results

All tests pass:
- Existing WorldMapTab tests: 33/33 passed
- New siege-animation-sequencing tests: 6/6 passed

## Flow After Fix

1. March arrives -> `handleArrived` fires
2. `createBattle()` -> `battle:started` -> animation starts (assembly phase)
3. `executeSiege()` -> result computed, `setSiegeResultData(result)` called
4. `eventBus.once('siegeAnim:completed')` registered
5. Battle engine continues running via `requestAnimationFrame` animate loop
6. Battle defense reaches 0 -> `battle:completed` emitted
7. `SiegeBattleAnimationSystem` catches `battle:completed` -> `completeSiegeAnimation()` -> emits `siegeAnim:completed`
8. Our `animHandler` catches `siegeAnim:completed` -> `setSiegeResultVisible(true)` -> modal appears
9. Safety fallback: if step 6-8 never happens, modal shows after 5 seconds

## Key Design Decisions

- **Removed `cancelBattle()`**: Letting the battle engine run naturally ensures the animation completes properly. The `handleBattleCompleted` handler has a duplicate guard (`if (task.result) return;`) to prevent double processing.
- **5-second fallback timeout**: Ensures the modal always appears eventually, even if the animation system has issues.
- **Task ID matching**: The `animHandler` only responds to `siegeAnim:completed` events matching the current task's ID, preventing cross-task interference.
- **Proper cleanup**: Timeout is cleared both when the animation completes normally and when the component unmounts.
