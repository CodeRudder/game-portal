# Judge Ruling -- Round 5d Adversarial Review

**Date**: 2026-05-04
**Judge**: Independent Arbitrator
**Builder Manifest**: round-5d/builder-manifest.md (7 claims, ALL PASS)
**Challenger Report**: round-5d/challenger-attack.md (7 attacks, 4 self-assessed confirmed)

---

## Ruling Summary

| Attack | Target | Challenger Severity | Ruling | Judge Severity | Reasoning |
|--------|--------|--------------------|---------|---------------|-----------|
| 1 | Payload interfaces not used as type params at emit | MEDIUM | **UPHELD** | **P2** | Interfaces are decorative at emit site; no compile-time enforcement |
| 2 | 29 tests pass but don't test type safety | LOW | **DISMISS** | -- | Tests were never claimed to test type safety; runtime behavior testing is appropriate |
| 3 | Decorative interfaces, eventBus typed as `any` | HIGH | **UPHELD** | **P2** | eventBus in WorldMapTab.tsx is `as any`; type safety is unilateral (consumer-only) |
| 4 | handleCancelled never unsubscribed (memory leak) | HIGH | **UPHELD** | **P1** | Confirmed real bug: `off('march:cancelled', handleCancelled)` missing from cleanup |
| 5 | MarchArrivedPayload missing siegeTaskId | MEDIUM | **UPHELD** | **P2** | Architectural inconsistency confirmed; secondary lookup creates fragile temporal coupling |
| 6 | `data ?? {}` reveals type distrust | LOW-MEDIUM | **DISMISS** | -- | Defensive coding is reasonable when consuming from an `any`-typed eventBus; not a defect |
| 7 | Synchronous siege computation blocks animation frame | MEDIUM-HIGH | **PARTIALLY UPHELD** | **P2** | Synchronous execution is confirmed, but Map iteration safety is guaranteed by ES spec; performance concern is theoretical |

**Final Tally**: P0: 0, P1: 1, P2: 4

---

## Detailed Analysis

### Attack 1: Payload interfaces not used as type parameters at emit site

**Ruling: UPHELD (P2 - Architecture)**

**Evidence verified:**

The `emit()` calls in `MarchingSystem.ts` (lines 199-204, 260-267, 281-285, 298-302) all pass plain object literals without referencing the Payload interfaces as generic type parameters:

```typescript
// Line 199 - march:arrived
this.deps.eventBus.emit('march:arrived', {
  marchId: id,
  cityId: march.toCityId,
  troops: march.troops,
  general: march.general,
});
```

The `IEventBus.emit<T = unknown>` signature (events.ts:88) defaults `T` to `unknown`, which means any object literal passes type checking. The Payload interfaces provide documentation value but zero compile-time enforcement at the emit site.

**Impact**: If a developer renames or removes a field from the object literal at the emit site, TypeScript will NOT flag it as a type error. The interfaces are documentation only.

**Recommendation**: Either use `emit<MarchArrivedPayload>('march:arrived', { ... })` explicitly, or create a typed wrapper function that constrains the payload type.

---

### Attack 2: 29 tests pass but don't test type safety

**Ruling: DISMISS**

**Reasoning**: The Builder never claimed that the tests verify type safety. The tests verify runtime behavior (object structure, state transitions, serialization round-trips), which is what unit tests are designed for. The Builder's Claim B explicitly states "Type safety is verified by the TypeScript compiler. Build passing proves type consistency." This is a legitimate (if debatable) position. Testing type-level constraints in TypeScript is possible but not standard practice; the absence of such tests is not a defect.

The tests themselves are honest and well-structured -- 29 tests covering initialization, creation, starting, cancellation, update, query, preview, and serialization.

---

### Attack 3: Decorative interfaces, eventBus typed as `any`

**Ruling: UPHELD (P2 - Architecture)**

**Evidence verified:**

In `WorldMapTab.tsx` (lines 346-382), the eventBus is a locally constructed plain object cast as `any`:

```typescript
const listeners = new Map<string, Set<(payload: any) => void>>();
const eventBus = {
  emit: (event: string, payload?: any) => { ... },
  on: (event: string, handler: (payload: any) => void) => { ... },
  // ...
} as any;
```

The `handler: (payload: any) => void` signature means that when `eventBus.on('march:arrived', handleArrived)` is called, the `handleArrived` function's type annotation `(data: MarchArrivedPayload)` is purely a local TypeScript hint. The eventBus binding provides no cross-component type guarantee.

**However**, this is mitigated by two factors:
1. The consumer-side type annotations DO provide IDE autocompletion and local type checking.
2. The eventBus is local to the component (not shared), so the risk of mismatch is lower than in a global eventBus.

**Impact**: The Builder's claim of "strong typing" is overstated. The type safety is unilateral (consumer-side only).

**Recommendation**: Remove the `as any` cast and type the local eventBus properly using `IEventBus` interface.

---

### Attack 4: handleCancelled never unsubscribed (memory leak)

**Ruling: UPHELD (P1 - Functional Defect)**

**Evidence verified:**

This is a confirmed bug. In `WorldMapTab.tsx`:

**Registration (line 585):**
```typescript
eventBus.on('march:cancelled', handleCancelled);
```

**Cleanup (lines 609-612):**
```typescript
return () => {
  cancelAnimationFrame(marchAnimRef.current);
  eventBus.off('march:arrived', handleArrived);
  // MISSING: eventBus.off('march:cancelled', handleCancelled);
};
```

The `handleArrived` listener IS properly cleaned up via `eventBus.off('march:arrived', handleArrived)`, but `handleCancelled` is registered at line 585 and never removed.

**However**, the severity needs contextualization:
- The eventBus is a local variable scoped to the `useEffect` closure (line 341-613). When the component unmounts and the cleanup runs, the entire `listeners` Map becomes eligible for garbage collection because:
  - The `eventBus` object is local to the effect closure
  - The `listeners` Map is local to the effect closure
  - No external references hold onto this eventBus
- Therefore, the memory leak is **self-contained** -- the listeners Map will be GC'd along with the closure. The leaked listener will not accumulate across mount/unmount cycles because each mount creates a fresh eventBus and listeners Map.

**Revised assessment**: The leak is real in principle (the `handleCancelled` closure holds references to React state setters and refs via `siegeTaskManagerRef.current` and `setActiveSiegeTasks`), but the practical impact is minimal because the local eventBus itself is ephemeral. The real risk would be if `handleCancelled` were called after unmount (stale state update on unmounted component), but since the eventBus is local, no events will be emitted to it after cleanup.

**Final severity**: Downgraded from P0 to **P1** because the leak is self-contained and does not accumulate across component lifecycles. However, it IS a code defect that should be fixed for correctness.

**Recommendation**: Add `eventBus.off('march:cancelled', handleCancelled);` to the cleanup function.

---

### Attack 5: MarchArrivedPayload missing siegeTaskId field

**Ruling: UPHELD (P2 - Architecture)**

**Evidence verified:**

`MarchArrivedPayload` (MarchingSystem.ts lines 108-113):
```typescript
export interface MarchArrivedPayload {
  marchId: string;
  cityId: string;
  troops: number;
  general: string;
}
```

`handleArrived` (WorldMapTab.tsx lines 419-420) does a secondary lookup:
```typescript
const marchUnit = marchingSystemRef.current?.getMarch?.(data.marchId);
const siegeTaskId = marchUnit?.siegeTaskId;
```

This is an architectural inconsistency:
- `march:cancelled` includes `siegeTaskId` in its payload
- `march:arrived` does NOT include `siegeTaskId` in its payload

The secondary lookup works because when `march:arrived` is emitted (MarchingSystem.ts line 199), the march is still in `activeMarches` (state changed to `'arrived'` but not removed). However, this creates fragile temporal coupling: the handler assumes the march is still accessible via `getMarch()`.

**Impact**: Not a runtime bug in the current implementation, but the architectural inconsistency makes the code fragile and harder to maintain.

**Recommendation**: Add `siegeTaskId?: string` to `MarchArrivedPayload` and include it in the emit call at MarchingSystem.ts line 199.

---

### Attack 6: `data ?? {}` reveals type distrust

**Ruling: DISMISS**

**Reasoning**: The `data ?? {}` pattern is reasonable defensive coding, especially when consuming events from an `any`-typed eventBus. Since the eventBus uses `payload?: any` (optional parameter with `any` type), the handler COULD receive `undefined` in edge cases. The defensive pattern is a pragmatic response to the type system gap identified in Attack 3.

While it does reveal distrust of the type system, this is not a defect -- it is a reasonable safety measure. The alternative (trusting the type annotation and accessing `data.marchId` directly) would cause runtime errors if the eventBus ever emitted without a payload.

---

### Attack 7: Synchronous siege computation blocks animation frame

**Ruling: PARTIALLY UPHELD (P2 - UX)**

**Evidence verified:**

The execution chain IS synchronous within the event handler:
1. `marchingSystem.update(dt)` is called inside `requestAnimationFrame` (line 594)
2. When a march arrives, `update()` calls `this.deps.eventBus.emit('march:arrived', ...)` (line 199)
3. This triggers `handleArrived` synchronously (lines 403-558)
4. `handleArrived` calls `executeSiege()`, `createMarch()`, `startMarch()`, state updates, etc.

**Claim: "Map iteration corruption"** -- DISMISSED.

The Challenger claims that `handleArrived` calls `marchingSystemRef.current!.createMarch(...)` at line 476, which adds a new entry to `activeMarches` while `update()` is iterating it. However:
- The `createMarch()` is called on `marchingSystemRef.current`, which is the same `marchingSystem` instance being iterated
- ES6 `Map.prototype[Symbol.iterator]` is well-specified: entries added during iteration WILL appear if they are inserted at positions not yet visited, and WILL NOT appear if inserted at already-visited positions
- In practice, the new march has a unique ID generated from `Date.now()` + random, so it will be added at a new position in the Map's internal ordering
- The new march is created in `'preparing'` state, and the iteration at line 185 skips any march with `state !== 'marching'`
- Therefore, even if the new march IS encountered during the current iteration, it will be safely skipped

This is NOT a data corruption risk.

**Claim: "Blocks animation frame"** -- UPHELD in principle.

The synchronous chain of siege execution -> casualty calculation -> result setting -> return march creation -> animation creation does block the current animation frame. However:
- `executeSiege()` is a game logic calculation (not a network call or heavy computation)
- In a typical game scenario, the siege calculation involves simple arithmetic (troop comparison, randomness), not expensive algorithms
- The actual performance impact depends on the complexity of `executeSiege()`, which was not demonstrated to be slow

**Impact**: The synchronous pattern is suboptimal but unlikely to cause noticeable jank in practice. It is a code smell that should be addressed in future refactoring.

**Recommendation**: Consider deferring the siege execution to a `setTimeout(0)` or `queueMicrotask()` to break the synchronous chain, if frame timing becomes an issue.

---

## Builder Claim Assessment

| Builder Claim | Status | Notes |
|--------------|--------|-------|
| A: siegeTaskId serialization round-trip | **PASS** | 2 tests confirm; serialization preserves optional field correctly |
| B: Event payload type interfaces | **CONDITIONAL PASS** | Interfaces exist and are used as local type annotations, but provide no cross-component type enforcement (see Attacks 1, 3) |
| C: handleSiegeConfirm comment correction | **PASS** | Static review confirms comment matches semantics |
| D: cancelMarch siegeTaskId payload | **PASS** | Test confirms `siegeTaskId` is in emitted payload. Note: Builder's claim "reads before delete" is slightly inaccurate -- the local reference is captured before delete, but delete happens before emit |
| E: SiegeTaskPanel tests (27) | **PASS** | Not challenged by Challenger |
| F: SiegeTaskManager tests (16) | **PASS** | Not challenged by Challenger |
| G: ExpeditionSystem tests (20) | **PASS** | Not challenged by Challenger |

---

## Confirmed Issues

### P1-01: handleCancelled listener not cleaned up in useEffect
- **File**: `src/components/three-kingdoms/engine/map/WorldMapTab.tsx` line 609-612
- **Fix**: Add `eventBus.off('march:cancelled', handleCancelled);` to the cleanup return function
- **Impact**: Minimal practical impact due to local eventBus scoping, but is a correctness defect

### P2-01: Payload interfaces are decorative at emit site
- **File**: `src/games/three-kingdoms/engine/map/MarchingSystem.ts` lines 199, 260, 281, 298
- **Fix**: Use generic type parameters at emit: `emit<MarchArrivedPayload>('march:arrived', {...})`
- **Impact**: No runtime impact; reduces type safety documentation value

### P2-02: Local eventBus typed as `any`
- **File**: `src/components/three-kingdoms/panels/map/WorldMapTab.tsx` lines 346-382
- **Fix**: Remove `as any` cast and properly type the eventBus against `IEventBus` interface
- **Impact**: Weakens cross-component type guarantees

### P2-03: MarchArrivedPayload missing siegeTaskId field
- **File**: `src/games/three-kingdoms/engine/map/MarchingSystem.ts` lines 108-113
- **Fix**: Add `siegeTaskId?: string` to interface; include in emit at line 199
- **Impact**: Architectural inconsistency; fragile temporal coupling via secondary lookup

### P2-04: Synchronous siege execution in animation frame callback
- **File**: `src/components/three-kingdoms/panels/map/WorldMapTab.tsx` lines 428-526
- **Fix**: Consider deferring siege execution via `setTimeout(0)` or `queueMicrotask()`
- **Impact**: Theoretical performance concern; no evidence of actual jank

---

## Verdict

**PASS WITH ISSUES**: The Builder's core claims (A, C, D, E, F, G) are substantiated by working tests and correct implementations. Claim B (type safety) is conditionally passed -- the interfaces exist and provide local type hints, but the type enforcement is weaker than claimed.

The one functional defect (P1-01: missing cleanup for `handleCancelled`) should be fixed before production but has minimal practical impact due to the local eventBus scoping.

The four P2 issues are architectural improvements that should be addressed in a future iteration.
