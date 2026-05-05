# Round 6 Builder Manifest

Date: 2026-05-04
Status: ALL VERIFIED

---

## A. DEPRECATED Branch Removal

| Item | Detail |
|------|--------|
| File | `src/components/idle/panels/map/WorldMapTab.tsx` |
| Change | Removed DEPRECATED else-if branch from handleArrived (formerly L540-553) |
| Verification | `grep DEPRECATED WorldMapTab.tsx` returns zero matches |
| Test result | N/A (code removal, no dedicated test; handleArrived flow covered by integration) |

---

## B. SiegeBattleSystem Engine (I13)

| Item | Detail |
|------|--------|
| Implementation | `src/games/three-kingdoms/engine/map/SiegeBattleSystem.ts` |
| Lines | 433 lines; class `SiegeBattleSystem implements ISubsystem` |
| Import method | Direct import from `../SiegeBattleSystem` (not an inline copy) |
| Test file | `src/games/three-kingdoms/engine/map/__tests__/SiegeBattleSystem.test.ts` |
| Test result | **27/27 passed** |
| Duration | 395ms |

### Test Coverage Breakdown (27 tests)

| Group | Tests | Scenarios Covered |
|-------|-------|-------------------|
| Initialization | 2 | Basic init; custom config (baseDurationMs, baseDefenseValue) |
| Create Battle | 5 | Session creation + event emission; strategy-based duration; min/max clamp; defense level scaling; duplicate taskId rejection |
| Battle Update | 5 | Defense decay over time; victory on depletion; time-exceeded completion; elapsed accumulation; battle:completed event emission |
| Cancel Battle | 3 | Active battle cancel; battle:cancelled event; non-existent taskId safety |
| Query | 2 | Active battle list; taskId lookup |
| Strategy Modifiers | 4 | forceAttack (-5s); siege (+15s); nightRaid (-3s); insider (+5s) |
| Serialization | 3 | Serialize active battles; deserialize restore; round-trip consistency |
| Edge Cases | 3 | dt=0 no-op; reset clears all; default defense level = 1 |

### Core Mechanics Verified

- attackPower = maxDefense / (estimatedDurationMs / 1000) -- ensures defense depletes exactly at estimated time
- STRATEGY_DURATION_MODIFIER: forceAttack(-5000), siege(+15000), nightRaid(-3000), insider(+5000)
- Duration clamped to [10000ms, 60000ms]
- maxDefense = targetDefenseLevel * baseDefenseValue (default 100)
- Events: battle:started, battle:completed, battle:cancelled

---

## C. SiegeBattleAnimationSystem (I12)

| Item | Detail |
|------|--------|
| Implementation | `src/games/three-kingdoms/engine/map/SiegeBattleAnimationSystem.ts` |
| Lines | 481 lines; class `SiegeBattleAnimationSystem implements ISubsystem` |
| Dependencies | Imports `BattleStartedEvent`, `BattleCompletedEvent` from `./SiegeBattleSystem` |
| Test file | `src/games/three-kingdoms/engine/map/__tests__/SiegeBattleAnimationSystem.test.ts` |
| Test result | **39/39 passed** |
| Duration | 402ms |

### Test Coverage Breakdown (39 tests)

| Group | Tests | Scenarios Covered |
|-------|-------|-------------------|
| Initialization | 3 | Basic init + name check; custom config; event listener registration (battle:started, battle:completed) |
| startSiegeAnimation | 3 | Animation creation with full field verification; siegeAnim:started event; duplicate taskId replacement |
| assembly -> battle transition | 4 | 3s assembly phase; exact boundary transition at 3.0s; siegeAnim:phaseChanged event; dt=0 no-op in assembly |
| updateBattleProgress | 3 | defenseRatio update; clamp to [0,1]; non-existent taskId safety |
| updateTargetPosition | 2 | Position update; non-existent taskId safety |
| completeSiegeAnimation | 5 | Phase set to completed; victory -> defenseRatio=0; defeat -> defenseRatio preserved; siegeAnim:phaseChanged + siegeAnim:completed events; non-existent taskId safety |
| completed auto-remove | 1 | 2s linger then auto-cleanup via update() |
| cancelSiegeAnimation | 2 | Immediate removal; non-existent taskId safety |
| Query | 3 | getAnimation by taskId; getActiveAnimations list; getAnimCountByPhase per-phase counts |
| Strategy Support | 4 | forceAttack, siege, nightRaid, insider stored correctly |
| Concurrent Animations | 1 | Multiple simultaneous animations: create 3 -> advance -> complete 1 -> cancel 1 |
| Serialization | 5 | Serialize active animations; deserialize restore; round-trip consistency; completed-phase restore; invalid data safety (null, undefined, string, empty obj) |
| Edge Cases | 2 | Empty update safety; reset clears all |
| Full Lifecycle | 1 | assembly(3s) -> battle -> progress decay -> completed -> linger(2s) -> auto-remove |

### Core Lifecycle Verified

```
startSiegeAnimation() -> assembly(3s) -> [auto] battle -> completeSiegeAnimation() -> completed(linger 2s) -> [auto] remove
```

- Default config: assemblyDurationMs=3000, completedLingerMs=2000
- Events: siegeAnim:started, siegeAnim:phaseChanged, siegeAnim:completed
- Auto-listens to battle:started / battle:completed from SiegeBattleSystem

---

## D. WorldMapTab Integration

| Item | Detail |
|------|--------|
| File | `src/components/idle/panels/map/WorldMapTab.tsx` |

### D-1. Import and Initialization

| Check | Evidence |
|-------|----------|
| Import SiegeBattleAnimationSystem | Line 38: `import { SiegeBattleAnimationSystem } from '@/games/three-kingdoms/engine/map/SiegeBattleAnimationSystem';` |
| Import SiegeAnimationState type | Line 39: `import type { SiegeAnimationState } from '@/games/three-kingdoms/engine/map/SiegeBattleAnimationSystem';` |
| Ref declaration | Line 166: `const siegeBattleAnimRef = useRef<SiegeBattleAnimationSystem \| null>(null);` |
| State declaration | Line 167: `const [activeSiegeAnims, setActiveSiegeAnims] = useState<SiegeAnimationState[]>([]);` |
| System instantiation | Line 398-400: `new SiegeBattleAnimationSystem()` + `init(mockDeps)` + assign to ref |

### D-2. Animation Frame Loop Integration

| Check | Evidence |
|-------|----------|
| update(dt) called in rAF | Line 623: `siegeBattleAnimSystem.update(dt);` |
| Sync to React state | Lines 635-640: `siegeBattleAnimSystem.getActiveAnimations()` -> `setActiveSiegeAnims(...)` with shallow comparison |

### D-3. Siege Execution Flow Integration

| Check | Evidence |
|-------|----------|
| startSiegeAnimation called | Lines 451-463: Called inside siege execution timeout with taskId, targetCityId, targetX/Y, strategy, faction, troops |
| completeSiegeAnimation called | Lines 504-506: Called after siege result with taskId and victory boolean |

### D-4. DEPRECATED Branch Removal

| Check | Evidence |
|-------|----------|
| No DEPRECATED code | `grep DEPRECATED WorldMapTab.tsx` returns zero matches |
| handleArrived logic | Clean flow: check siegeTaskId -> check associatedTask -> auto-execute siege with I12 animation hooks |

---

## E. PixelWorldMap Props Extension

| Item | Detail |
|------|--------|
| File | `src/components/idle/panels/map/PixelWorldMap.tsx` |

| Check | Evidence |
|-------|----------|
| Import type | Line 20: `import type { SiegeAnimationState } from '@/games/three-kingdoms/engine/map/SiegeBattleAnimationSystem';` |
| Prop definition | Line 42: `activeSiegeAnims?: SiegeAnimationState[];` in `PixelWorldMapProps` interface |
| Prop destructured | Line 252: `activeSiegeAnims` in destructured props |
| Passed from WorldMapTab | Line 1151: `activeSiegeAnims={activeSiegeAnims}` in PixelWorldMap JSX |
| Rendering | Placeholder only -- actual rendering deferred to future iteration per I12 spec |

---

## Summary

| Category | Files | Tests | Result |
|----------|-------|-------|--------|
| A. DEPRECATED removal | 1 | -- | Verified (0 matches) |
| B. SiegeBattleSystem (I13) | 1 source + 1 test | 27/27 | PASS |
| C. SiegeBattleAnimationSystem (I12) | 1 source + 1 test | 39/39 | PASS |
| D. WorldMapTab integration | 1 | -- | Verified (import, init, rAF, siege flow) |
| E. PixelWorldMap props | 1 | -- | Verified (prop defined, passed, typed) |
| **Total** | **5 files** | **66/66** | **ALL PASS** |
