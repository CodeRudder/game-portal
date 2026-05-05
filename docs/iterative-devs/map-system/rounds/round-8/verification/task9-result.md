# Task 9: ExpeditionSystem Casualty Tests + Return March Integration Tests

## Result: ALL PASS (40/40 tests)

### File 1: ExpeditionSystem Casualty Tests

**Path:** `src/games/three-kingdoms/engine/map/__tests__/ExpeditionSystem.casualties.test.ts`
**Tests:** 31 passed

| # | Test Suite | Test Case | Status |
|---|-----------|-----------|--------|
| 1 | applyCasualties | normal: 500/1000 lost -> troops=500, status=returning | PASS |
| 2 | applyCasualties | hero injury: moderate -> injury recorded, power=0.7x | PASS |
| 3 | applyCasualties | hero severe injury -> injury recorded, power=0.5x | PASS |
| 4 | applyCasualties | hero minor injury -> injury recorded, power=0.9x | PASS |
| 5 | applyCasualties | zero loss -> troops unchanged | PASS |
| 6 | applyCasualties | full wipe (999 lost > 300 troops) -> troops=0 (Math.max guard) | PASS |
| 7 | applyCasualties | non-existent forceId -> returns null | PASS |
| 8 | applyCasualties | heroInjured=true but injuryLevel=none -> no injury recorded | PASS |
| 9 | calculateRemainingPower | healthy force: troops=500 -> power=500 | PASS |
| 10 | calculateRemainingPower | moderate injury: troops=400 -> power=280 | PASS |
| 11 | calculateRemainingPower | severe injury: troops=400 -> power=200 | PASS |
| 12 | calculateRemainingPower | minor injury: troops=900 -> power=810 | PASS |
| 13 | calculateRemainingPower | non-existent forceId -> returns 0 | PASS |
| 14 | calculateRemainingPower | accepts string forceId | PASS |
| 15 | getForceHealthColor | 0% loss -> healthy | PASS |
| 16 | getForceHealthColor | 0.29 loss -> healthy | PASS |
| 17 | getForceHealthColor | 0.30 loss -> healthy (boundary: strictly > 0.3) | PASS |
| 18 | getForceHealthColor | 0.31 loss -> damaged | PASS |
| 19 | getForceHealthColor | 0.59 loss -> damaged | PASS |
| 20 | getForceHealthColor | 0.60 loss -> damaged (boundary: strictly > 0.6) | PASS |
| 21 | getForceHealthColor | 0.61 loss -> critical | PASS |
| 22 | getForceHealthColor | 1.0 loss -> critical | PASS |
| 23 | getForceHealthColor | 0.50 loss -> damaged (mid-range) | PASS |
| 24 | removeForce | remove existing force -> true, force gone | PASS |
| 25 | removeForce | remove non-existent force -> false | PASS |
| 26 | removeForce | remove returning-status force -> true | PASS |
| 27 | removeForce | after removal, hero can be reused in new force | PASS |
| 28 | combined chain | 10% loss: healthy + power near full | PASS |
| 29 | combined chain | 40% loss: damaged | PASS |
| 30 | combined chain | 70% loss: critical | PASS |
| 31 | combined chain | 40% loss + moderate injury: damaged + double power reduction | PASS |

### File 2: Return March Integration Tests

**Path:** `src/games/three-kingdoms/engine/map/__tests__/integration/return-march.integration.test.ts`
**Tests:** 9 passed

| # | Test Suite | Test Case | Status |
|---|-----------|-----------|--------|
| 1 | full chain | create force -> march -> fight -> casualties applied -> verify returning | PASS |
| 2 | full chain | defeat with hero injury: severe -> troops reduced, power halved | PASS |
| 3 | health color | 10% loss -> healthy | PASS |
| 4 | health color | 40% loss -> damaged | PASS |
| 5 | health color | 70% loss -> critical with moderate injury | PASS |
| 6 | health color | progressive: healthy -> damaged -> critical across forces | PASS |
| 7 | force removal | force removed after return arrival | PASS |
| 8 | force removal | hero no longer busy after removal, can create new force | PASS |
| 9 | force removal | partial removal does not affect other forces | PASS |

### Key Findings

1. **getForceHealthColor boundary behavior**: The method uses strict `>` comparison (`> 0.3`, `> 0.6`), so exactly 30% or 60% loss stays in the lower tier. Tests at 0.30 and 0.60 confirm this is `healthy` and `damaged` respectively (not `damaged`/`critical`).

2. **applyCasualties always sets status to 'returning'**: Even with zero losses, the force status changes to 'returning'. This is by design for the post-battle flow.

3. **Math.max(0, ...) guard**: When troopsLost exceeds available troops, the floor is 0 (no negative troops).

4. **Hero injury requires injuryLevel !== 'none'**: Passing `heroInjured=true` with `injuryLevel='none'` does not record an injury, matching the `applyHeroInjury` guard.

5. **MarchingSystem.createReturnMarch** depends on `calculateMarchRoute` which requires a walkability grid and valid city positions. The integration tests use `createMarch` directly to test the coordination between ExpeditionSystem and MarchingSystem without requiring the full pathfinding setup.

### Run Commands

```bash
npx vitest run src/games/three-kingdoms/engine/map/__tests__/ExpeditionSystem.casualties.test.ts
npx vitest run src/games/three-kingdoms/engine/map/__tests__/integration/return-march.integration.test.ts
```
