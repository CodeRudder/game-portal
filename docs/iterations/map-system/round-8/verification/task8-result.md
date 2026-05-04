# Task 8 Result: Formation Casualty Methods & Return March Flow

## Summary

Added four new public methods to `ExpeditionSystem` and one new public method to `MarchingSystem` to support the formation casualty and return march flow.

## Changes

### 1. ExpeditionSystem (`src/games/three-kingdoms/engine/map/ExpeditionSystem.ts`)

Added four new public methods between the existing `getHeroPowerMultiplier()` and the private `applyHeroInjury()`:

#### `applyCasualties(forceId, troopsLost, heroInjured, injuryLevel)`
- Deducts lost troops from the force (`Math.max(0, troops - troopsLost)`)
- Applies hero injury if `heroInjured` is true and `injuryLevel !== 'none'`
- Sets force status to `'returning'`
- Returns a shallow copy of the updated force, or `null` if force not found

#### `calculateRemainingPower(forceId)`
- Accepts `number | string` for forceId
- Computes remaining power as `troops * heroPowerMultiplier`
- Returns `0` if force not found

#### `getForceHealthColor(troopsLostPercent)`
- Returns `'critical'` if losses > 60%
- Returns `'damaged'` if losses > 30%
- Returns `'healthy'` otherwise

#### `removeForce(forceId)`
- Unconditionally deletes the force from the map
- Returns boolean indicating success
- Used for cleanup after return march completes

### 2. MarchingSystem (`src/games/three-kingdoms/engine/map/MarchingSystem.ts`)

Added one new public method in a new section `// -- 回城行军 --` between `removeMarch()` and the route preview section:

#### `createReturnMarch(params)`
- Parameters: `fromCityId`, `toCityId`, `troops`, `general`, `faction`, `originalPath`, optional `siegeTaskId`
- Uses `calculateMarchRoute()` to compute the route from target back to origin
- Creates a march via `createMarch()` with the computed path
- Sets `siegeTaskId` on the march for siege linkage
- Overrides march speed to `BASE_SPEED * 0.8` (= 24 pixels/sec)
- Returns `null` if route is unreachable

## Files Modified

| File | Lines Added | Type |
|------|-------------|------|
| `src/games/three-kingdoms/engine/map/ExpeditionSystem.ts` | ~90 | New methods |
| `src/games/three-kingdoms/engine/map/MarchingSystem.ts` | ~40 | New method |
