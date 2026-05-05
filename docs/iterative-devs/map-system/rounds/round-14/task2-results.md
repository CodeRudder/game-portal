# R14 Task2 Results: Wire injuryData/troopLoss Props

## Summary

Wired `injuryData` and `troopLoss` props from `WorldMapTab` to `SiegeResultModal`, with a mapping function to bridge the InjuryLevel enum mismatch between engine (`minor/moderate/severe`) and UI (`light/medium/severe`).

## Changes

### 1. Mapping Functions (WorldMapTab.tsx)

Added three exported mapping functions at the top of `WorldMapTab.tsx`:

- **`mapInjuryLevel(engine)`** -- Single point of conversion:
  - `minor` -> `light`
  - `moderate` -> `medium`
  - `severe` -> `severe`
  - `none` -> `none`

- **`mapInjuryData(casualties, generalName)`** -- Converts engine `CasualtyResult` to UI `injuryData` prop:
  - Returns `undefined` when no injury (heroInjured=false or injuryLevel=none)
  - Maps recovery hours: light=0.5h, medium=2h, severe=6h

- **`mapTroopLoss(casualties, totalTroops)`** -- Converts engine `CasualtyResult` to UI `troopLoss` prop:
  - Returns `undefined` when troopsLost=0 or totalTroops=0

### 2. Prop Wiring (WorldMapTab.tsx)

The `SiegeResultModal` rendering now computes and passes:
- `injuryData` -- derived from `siegeResultData.casualties` via `mapInjuryData()`
- `troopLoss` -- derived from `siegeResultData.casualties` via `mapTroopLoss()`

General name is resolved from the heroes list using `heroInjured.heroId` when available.

### 3. Integration Tests (injury-integration.test.tsx)

21 new tests covering:
- `mapInjuryLevel`: 4 tests (minor/moderate/severe/none mapping)
- `mapInjuryData`: 6 tests (all injury levels, no injury edge cases, undefined)
- `mapTroopLoss`: 4 tests (losses, zero values, undefined)
- SiegeResultModal with mapped props: 7 tests (minor/moderate/severe injury display, troop loss display, no injury, no casualties, backward compatibility)

## Test Results

- **New tests**: 21/21 passing
- **Existing SiegeResultModal tests**: 53/53 passing (no regression)
- **TypeScript**: No new errors in changed files

## Files Modified

- `src/components/idle/panels/map/WorldMapTab.tsx` -- Added mapping functions + wired props

## Files Created

- `src/components/idle/panels/map/__tests__/injury-integration.test.tsx` -- 21 integration tests

## Architecture

The mapping is intentionally a one-way function (engine -> UI). The UI never needs to map back to engine values. All three functions are pure and exported for testability.
