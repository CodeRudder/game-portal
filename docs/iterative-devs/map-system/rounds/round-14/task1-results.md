# R14 Task 1: Wire SiegeItemSystem into Siege Settlement Flow

## Summary
Integrated SiegeItemSystem's `shouldDropInsiderLetter` into both the SettlementPipeline (engine layer) and WorldMapTab (UI layer) so item drops are detected on siege victory and rendered in SiegeResultModal.

## Changes Made

### 1. SettlementPipeline.ts (engine layer integration)
**File:** `src/games/three-kingdoms/engine/map/SettlementPipeline.ts`
- Imported `shouldDropInsiderLetter` from `SiegeItemSystem`
- In `distribute()` method (victory path only), added item drop detection:
  - Calls `shouldDropInsiderLetter(ctx.taskId)` to check for insider letter drop
  - If drop detected, adds `{ type: 'insiderLetter', count: 1 }` to `rewards.items`
- Items array in `SettlementRewards` is now populated (was previously always empty)

### 2. WorldMapTab.tsx (UI integration)
**File:** `src/components/idle/panels/map/WorldMapTab.tsx`
- Imported `shouldDropInsiderLetter`, `SIEGE_ITEM_NAMES`, and `SiegeItemType` from SiegeItemSystem
- In `handleArrived` callback (siege result construction), added:
  - Item drop detection after siege victory: `shouldDropInsiderLetter(currentTask.id)`
  - `itemDrops` field in `SiegeResultData` passed to `SiegeResultModal`
- Only checks for drops on victory (`result.victory`), not on defeat

### 3. SiegeResultModal.tsx (rendering)
**File:** `src/components/idle/panels/map/SiegeResultModal.tsx`
- Imported `SIEGE_ITEM_NAMES` and `SiegeItemType` from SiegeItemSystem
- Added `itemDrops` field to `SiegeResultData` interface:
  ```ts
  itemDrops?: Array<{ type: SiegeItemType; count: number }>;
  ```
- Added "战利品" (Spoils of War) rendering section after the rewards section:
  - Purple-themed card with scroll icon for each dropped item
  - Shows item name via `SIEGE_ITEM_NAMES` and quantity
  - Only renders when `isWin && result.itemDrops && result.itemDrops.length > 0`
  - Uses `data-testid="siege-item-drops-section"` for testing
  - Individual items have `data-testid="siege-item-drop-{type}"` for targeted tests

### 4. Integration Tests
**File:** `src/games/three-kingdoms/engine/map/__tests__/integration/siege-item-integration.test.ts`

21 tests covering:
- `shouldDropInsiderLetter` determinism and ~20% probability
- `hashCode` consistency and non-negative integer output
- `SiegeItemSystem` class: acquire, consume, max stack, serialize/deserialize, reset
- `SIEGE_ITEM_NAMES` mapping completeness
- SettlementPipeline + SiegeItemSystem integration:
  - Victory path with drop: items array contains insiderLetter
  - Victory path without drop: items array does not contain insiderLetter
  - Victory path always has resource rewards
  - Defeat path: no distribute phase, rewards null
  - Cancel path: no rewards, no casualties
  - Drop probability validation through pipeline (~20%)

## Test Results

### New Integration Tests
```
21 tests passed (21/21)
- siege-item-integration.test.ts: 5ms
```

### Regression Tests
```
All integration tests: 719 passed + 5 skipped (724 total)
SiegeResultModal tests: 53 passed
WorldMapTab tests: 33 passed
```

### TypeScript Check
```
No new errors introduced.
5 pre-existing errors in PathfindingSystem.ts (WalkabilityGrid type)
```

## Architecture Notes

1. **Two-layer integration**: The item drop logic is wired at both the engine layer (SettlementPipeline.distribute) and the UI layer (WorldMapTab). This ensures:
   - SettlementPipeline produces items in its rewards output (for any pipeline consumer)
   - WorldMapTab also independently checks drops for the direct `handleArrived` flow

2. **Deterministic randomness**: `shouldDropInsiderLetter` uses a hash-based approach (`hashCode(taskId) % 100 < 20`) ensuring:
   - Same taskId always produces the same drop result
   - Fully testable without mocking Math.random
   - ~20% drop rate statistically

3. **UI rendering**: Item drops appear as a dedicated "战利品" section with purple theme, distinct from the regular "获得奖励" section, making drops visually prominent.
