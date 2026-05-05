# R14 Task 3: Replace SiegeResultCalculator with SettlementPipeline.execute()

## Status: DONE

## Summary

Replaced all direct `SiegeResultCalculator` usage in production code with `SettlementPipeline.execute()`, while fixing three issues in the pipeline itself. All 82 test files (2170+ tests) pass.

## Changes Made

### 1. SettlementPipeline.ts Fixes

**File:** `src/games/three-kingdoms/engine/map/SettlementPipeline.ts`

- **Fix A: Import moved to top** -- `OUTCOME_REWARD_MULTIPLIER` import moved from file bottom (line 557) to the top-level import block (line 19). No more post-class imports.
- **Fix B: executedPhases semantics** -- Changed from `SettlementPhase[]` (string array) to `PhaseRecord[]` with status per phase:
  - Added `PhaseStatus` type: `'executed' | 'skipped'`
  - Added `PhaseRecord` interface: `{ phase: SettlementPhase; status: PhaseStatus }`
  - Each path now correctly marks skipped phases with `status: 'skipped'`
  - Added static helpers: `getExecutedPhaseNames()` and `isPhaseExecuted()`
- **Fix C: SiegeRewardProgressive integration** -- Replaced hardcoded reward values (`baseGrain=100, baseGold=50`) with `SIEGE_REWARD_CONFIG` imports (`baseGrain=50, baseGold=30, baseTroops=20`), matching the progressive reward system.

### 2. WorldMapTab.tsx -- SiegeResultCalculator Replaced

**File:** `src/components/idle/panels/map/WorldMapTab.tsx`

- Changed import from `SiegeResultCalculator` to `SettlementPipeline`
- Replaced `handleBattleCompleted` handler:
  - Old: `new SiegeResultCalculator().calculateSettlement(event, ctx)` -- direct call
  - New: `settlementPipeline.execute(ctx)` via `createVictoryContext` or `createDefeatContext` factory methods
  - Pipeline is instantiated once per useEffect lifecycle with `eventBus` dependency injection
  - Result extraction uses `result.context.casualties` and `result.context.rewards` from pipeline output

### 3. SettlementArchitecture.test.ts -- Updated Assertions

**File:** `src/games/three-kingdoms/engine/map/__tests__/SettlementArchitecture.test.ts`

- All `executedPhases` assertions updated from string arrays to `PhaseRecord` objects
- First-capture test updated to use `SIEGE_REWARD_CONFIG.baseGrain` instead of hardcoded `100`
- Victory path: all 4 phases `{ status: 'executed' }`
- Defeat path: `distribute` = `{ status: 'skipped' }`
- Cancel path: `calculate` + `distribute` = `{ status: 'skipped' }`

### 4. Integration Tests Created

**File:** `src/games/three-kingdoms/engine/map/__tests__/integration/settlement-pipeline-integration.test.ts`

18 tests covering:
- **Victory path equivalence** -- Pipeline produces same outcome as old calculator, all 4 phases executed
- **Defeat path** -- Casualties present, no rewards, distribute=skipped
- **Rout path** -- Very high casualties (80-90%), no rewards
- **Cancel path** -- No casualties, no rewards, calculate+distribute=skipped
- **SiegeRewardProgressive integration** -- Reward values match SIEGE_REWARD_CONFIG base values
- **First capture 1.5x bonus** -- Verified multiplier stacking
- **Different outcomes** -- narrowVictory, victory, decisiveVictory have different multipliers
- **Pipeline vs Calculator parity** -- All 5 outcome types verified for outcome consistency
- **Validation** -- Invalid inputs correctly rejected
- **PhaseRecord utilities** -- getExecutedPhaseNames and isPhaseExecuted work correctly

## Test Results

```
SettlementArchitecture.test.ts:       12 passed
settlement-pipeline-integration.test: 18 passed
All map engine tests:                 82 files, 2170 passed
```

## Verification Commands

```bash
# Run new integration tests
npx vitest run src/games/three-kingdoms/engine/map/__tests__/integration/settlement-pipeline-integration.test.ts

# Run existing pipeline tests
npx vitest run src/games/three-kingdoms/engine/map/__tests__/SettlementArchitecture.test.ts

# Verify old calculator not used in production code
grep -r "SiegeResultCalculator" src/ --include="*.ts" --include="*.tsx" | grep -v test | grep -v "\.test\."

# TypeScript check
npx tsc --noEmit 2>&1 | head -50
```

## Files Modified

| File | Change |
|------|--------|
| `src/games/three-kingdoms/engine/map/SettlementPipeline.ts` | Import fix, executedPhases -> PhaseRecord[], SIEGE_REWARD_CONFIG integration |
| `src/components/idle/panels/map/WorldMapTab.tsx` | SiegeResultCalculator -> SettlementPipeline replacement |
| `src/games/three-kingdoms/engine/map/__tests__/SettlementArchitecture.test.ts` | Updated assertions for PhaseRecord, SIEGE_REWARD_CONFIG values |

## Files Created

| File | Purpose |
|------|---------|
| `src/games/three-kingdoms/engine/map/__tests__/integration/settlement-pipeline-integration.test.ts` | 18 integration tests for pipeline replacement |
