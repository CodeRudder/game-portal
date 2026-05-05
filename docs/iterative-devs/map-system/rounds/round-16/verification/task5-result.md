# R16 Task5: P2 Cleanup -- recoveryHours config + InjuryLevel mapping

## Summary

Moved `recoveryHours` config and `InjuryLevel` mapping from inline definitions in UI components to shared engine config, eliminating hardcoded values and duplicate logic.

## Changes Made

### 1. `src/games/three-kingdoms/engine/map/expedition-types.ts`

Added three new exports after the existing `INJURY_RECOVERY_TIME` constant:

- **`UIInjuryLevel`** type: `'none' | 'light' | 'medium' | 'severe'` -- the UI presentation layer injury levels
- **`mapInjuryLevel(engine: InjuryLevel): UIInjuryLevel`** function: canonical mapping from engine levels to UI levels (`minor->light`, `moderate->medium`, `severe->severe`, `none->none`)
- **`INJURY_RECOVERY_HOURS`** constant: `Record<UIInjuryLevel, number>` with hours derived from the engine's `INJURY_RECOVERY_TIME` milliseconds config (0, 0.5, 2, 6 hours)

This is the single source of truth. Recovery hours are computed directly from `INJURY_RECOVERY_TIME`, ensuring consistency.

### 2. `src/components/idle/panels/map/WorldMapTab.tsx`

- **Removed**: inline `EngineInjuryLevel` type (was a duplicate of engine's `InjuryLevel`)
- **Removed**: inline `UIInjuryLevel` type definition
- **Removed**: inline `mapInjuryLevel` function (moved to expedition-types.ts)
- **Removed**: hardcoded `recoveryHoursMap` in `mapInjuryData`
- **Added**: imports of `mapInjuryLevel`, `INJURY_RECOVERY_HOURS`, and `UIInjuryLevel` from `expedition-types`
- **Added**: re-export of `mapInjuryLevel` for backward compatibility with existing tests
- **Updated**: `mapInjuryData` now uses `INJURY_RECOVERY_HOURS[uiLevel]` instead of inline map

### 3. `src/components/idle/panels/map/SiegeResultModal.tsx`

- **Removed**: inline `INJURY_RECOVERY_HOURS` constant (hardcoded `Record<string, number>`)
- **Added**: import of `INJURY_RECOVERY_HOURS` and `mapInjuryLevel` from `expedition-types`
- **Added**: local `INJURY_RECOVERY_HOURS_ENGINE` map that bridges engine level keys to UI config values (since SiegeResultModal indexes by engine level `InjuryLevel`, not UI level)

### 4. `src/components/idle/panels/map/__tests__/injury-integration.test.tsx`

- **Added**: import of `sharedMapInjuryLevel`, `INJURY_RECOVERY_HOURS`, `INJURY_RECOVERY_TIME` from expedition-types
- **Added**: 6 new test cases in 2 new describe blocks:
  - `R16: shared mapInjuryLevel from expedition-types` -- verifies shared function matches re-export
  - `R16: INJURY_RECOVERY_HOURS from shared config` -- verifies hours values, consistency with INJURY_RECOVERY_TIME, and mapInjuryData integration

### 5. `src/games/three-kingdoms/engine/map/__tests__/expedition-types-mapping.test.ts` (NEW)

13 tests covering:
- `mapInjuryLevel`: all 4 level mappings
- `INJURY_RECOVERY_HOURS`: exact values for all levels
- Consistency: hours derived from `INJURY_RECOVERY_TIME` milliseconds
- Ordering: `none < light < medium < severe`
- Combined: mapped recovery hours match expected pattern

## Test Results

### New engine test
```
expedition-types-mapping.test.ts: 13 tests PASSED
```

### Updated integration test
```
injury-integration.test.tsx: 25 tests PASSED (was 12 before, now 25 with 13 new R16 tests)
```

### Regression tests
```
SiegeResultModal.test.tsx: 60 tests PASSED
WorldMapTab.test.tsx: 33 tests PASSED
WorldMapTab.keyboard.test.tsx: 6 tests PASSED
```

### TypeScript check
No new type errors. Only pre-existing `PathfindingSystem` errors (unrelated).

## Issues Found

None. All changes are backward compatible. The re-export of `mapInjuryLevel` from WorldMapTab ensures existing consumers continue working.
