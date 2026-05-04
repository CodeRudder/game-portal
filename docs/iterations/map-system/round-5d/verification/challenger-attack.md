# Round 5d Challenger Attack Report

**Date**: 2026-05-04
**Role**: Challenger
**Target**: Builder Manifest (round-5d)
**Verdict**: PARTIAL OVERTHROW -- 7 attacks, 4 confirmed issues

---

## Attack 1: Vulnerability Attack -- Payload interfaces defined but NOT used as type parameters at emit site

| Item | Detail |
|------|--------|
| Builder's Claim | Four Payload interfaces are defined and match actual emit parameters |
| Why Untrustworthy | The interfaces exist in source code (lines 91-120 of MarchingSystem.ts), but the `emit()` calls do NOT reference these interfaces as type parameters. |
| Missing Evidence | No `emit<MarchArrivedPayload>('march:arrived', ...)` or equivalent generic usage anywhere in MarchingSystem.ts |

### Analysis

In `MarchingSystem.ts`, all four emit calls pass plain object literals:

```typescript
// Line 199-204: march:arrived
this.deps.eventBus.emit('march:arrived', {
  marchId: id,
  cityId: march.toCityId,
  troops: march.troops,
  general: march.general,
});

// Line 260-267: march:created
this.deps.eventBus.emit('march:created', {
  marchId: id, fromCityId, toCityId, troops, general, estimatedTime,
});

// Line 281-285: march:started
this.deps.eventBus.emit('march:started', {
  marchId, fromCityId: march.fromCityId, toCityId: march.toCityId,
});

// Line 298-302: march:cancelled
this.deps.eventBus.emit('march:cancelled', {
  marchId, troops: march.troops, siegeTaskId: march.siegeTaskId,
});
```

None of these calls use the Payload interfaces as generic type parameters (e.g., `emit<MarchArrivedPayload>(...)`). The structural match between the interfaces and the object literals is **coincidental and enforced only by TypeScript's structural typing for `unknown`** (the default generic parameter of `IEventBus.emit<T = unknown>`). Since `T` defaults to `unknown`, any object literal passes type checking -- the Payload interfaces provide **zero compile-time enforcement** on the emit side.

**Severity**: MEDIUM. The interfaces exist as documentation but are **decorative** -- they do not constrain the emit side. If a developer removes or renames a field from the object literal, TypeScript will NOT flag it as a type error at the emit site.

---

## Attack 2: Hallucination Attack -- 29 tests do pass, but test coverage is misleading

| Item | Detail |
|------|--------|
| Builder's Claim | 29 tests pass, covering all scenarios including siegeTaskId serialization and cancellation payload |
| Why Untrustworthy | The test count is verified (29/29 pass), but the tests test the IMPLEMENTATION, not the type safety claims |
| Missing Evidence | No test verifies that the Payload interfaces are actually used as type constraints |

### Analysis

Ran the test suite:
```
Test Files  1 passed (1)
     Tests  29 passed (29)
```

The 29 tests DO pass. However:

1. **No type-level testing**: The tests verify runtime behavior (object structure) via `expect.objectContaining()`, but do not verify that the Payload interfaces are actually used as type parameters anywhere.
2. **Test for cancelMarch payload (L148-158)** only checks that `siegeTaskId` is present in the emitted object. It does NOT verify that the emitted object conforms to `MarchCancelledPayload` interface through TypeScript's type system.
3. The `createMockDeps()` function creates `eventBus` with `emit: vi.fn()` typed as `any` -- this completely bypasses the IEventBus generic type system.

**Severity**: LOW. Tests are honest but the Builder's framing implies type-safety testing which does not exist.

---

## Attack 3: No-Evidence Attack -- Decorative Interfaces (Decorative Type Pattern)

| Item | Detail |
|------|--------|
| Builder's Claim | "UI layer uses typed interfaces instead of `data: any`" |
| Why Untrustworthy | The interfaces are used as LOCAL type annotations on the consumer side only, while the eventBus itself has `any`-typed handlers at the binding point |
| Missing Evidence | End-to-end type safety proof from emit to handler |

### Analysis

The `IEventBus` interface supports generics:
```typescript
// events.ts L65
on<T = unknown>(event: string, handler: (payload: T) => void): Unsubscribe;
// events.ts L88
emit<T = unknown>(event: string, payload: T): void;
```

But in `WorldMapTab.tsx`, the eventBus is a **locally constructed plain object** (lines 346-382), typed as `as any`:
```typescript
const eventBus = {
  on: (event: string, handler: (payload: any) => void) => { ... },
  // ...
} as any;
```

The `handler: (payload: any) => void` signature means:
- When `eventBus.on('march:arrived', handleArrived)` is called, the `handleArrived` function's type annotation `data: MarchArrivedPayload` is a **local TypeScript hint only**.
- At runtime, `payload` is `any`, so the type of `data` in `handleArrived` is **not enforced by the eventBus binding**.
- If `MarchingSystem.ts` emitted `{ marchId, cityId }` without `troops` and `general`, the handler would still receive it without any compile-time or runtime error from the eventBus layer.

Similarly, `handleCancelled` at line 564 is typed as `(data: MarchCancelledPayload)`, but the eventBus `on` method accepts `(payload: any) => void`, so this type annotation is purely decorative from the perspective of the event bus contract.

**Severity**: HIGH. The Builder's claim of "strong typing" is misleading. The type safety is unilateral (consumer-side only) and provides no cross-component guarantees.

---

## Attack 4: Integration Break -- handleCancelled never unsubscribed (memory leak)

| Item | Detail |
|------|--------|
| Builder's Claim | Event listeners are properly registered and cleaned up |
| Why Untrustworthy | `handleCancelled` is registered via `eventBus.on('march:cancelled', handleCancelled)` but NEVER removed in the cleanup function |
| Missing Evidence | A line showing `eventBus.off('march:cancelled', handleCancelled)` in the cleanup |

### Analysis

In `WorldMapTab.tsx`:

**Registration (L585):**
```typescript
eventBus.on('march:cancelled', handleCancelled);
```

**Cleanup (L609-612):**
```typescript
return () => {
  cancelAnimationFrame(marchAnimRef.current);
  eventBus.off('march:arrived', handleArrived);
  // <-- MISSING: eventBus.off('march:cancelled', handleCancelled);
};
```

The `handleCancelled` listener is registered but never removed when the component unmounts. This is a **memory leak** -- every time the component mounts/unmounts, a new listener accumulates. The listener holds references to `siegeTaskManagerRef.current` and `setActiveSiegeTasks` via closure, preventing garbage collection.

**Severity**: HIGH. This is a real bug. The `handleCancelled` listener will persist after component unmount, potentially causing stale state updates on unmounted components.

---

## Attack 5: Data Coverage Attack -- handleArrived accesses data beyond MarchArrivedPayload

| Item | Detail |
|------|--------|
| Builder's Claim | MarchArrivedPayload covers all fields needed by handleArrived |
| Why Untrustworthy | handleArrived accesses `marchUnit?.siegeTaskId` from a SECOND data source (MarchingSystem), which is NOT in the Payload interface |
| Missing Evidence | A test showing that siegeTaskId propagation works end-to-end from creation through arrival |

### Analysis

`MarchArrivedPayload` (MarchingSystem.ts L108-113):
```typescript
export interface MarchArrivedPayload {
  marchId: string;
  cityId: string;
  troops: number;
  general: string;
}
```

But `handleArrived` (WorldMapTab.tsx L419-420) does:
```typescript
const marchUnit = marchingSystemRef.current?.getMarch?.(data.marchId);
const siegeTaskId = marchUnit?.siegeTaskId;
```

This means `handleArrived` retrieves `siegeTaskId` NOT from the Payload interface, but by re-querying the MarchingSystem using the marchId. The critical issue:

1. **Race condition**: In `MarchingSystem.update()` (L199), when the march arrives, it sets `march.state = 'arrived'` and then emits the event. But the march is still in `activeMarches` at this point. However, by the time the handler runs, if another operation removes the march (unlikely but possible in concurrent scenarios), `getMarch(marchId)` returns `undefined` and `siegeTaskId` is lost.

2. **Architectural inconsistency**: The `march:cancelled` event includes `siegeTaskId` in its Payload, but `march:arrived` does not. This asymmetry means the arrival handler must do a secondary lookup, while the cancellation handler gets it directly from the payload. If the Builder truly believes in typed payloads, `siegeTaskId` should also be in `MarchArrivedPayload`.

3. **The secondary lookup will FAIL**: Looking more carefully at the `update()` method (L184-206), when `march.state` becomes `'arrived'`, the march is still in `activeMarches`. So `getMarch(marchId)` WILL return it at event emission time. However, after the 3-second `setTimeout` in `handleArrived` (L554-558), `marchingSystem.removeMarch(marchId)` is called, and the march is gone. The lookup at L419 happens before this timeout, so it works for the primary use case. But this is a fragile temporal coupling.

**Severity**: MEDIUM. The Payload interface does not cover all data the handler needs. The secondary lookup creates fragile temporal coupling.

---

## Attack 6: Boundary Attack -- Defensive `data ?? {}` reveals type distrust

| Item | Detail |
|------|--------|
| Builder's Claim | Handlers use typed Payload interfaces (`data: MarchArrivedPayload`, `data: MarchCancelledPayload`) |
| Why Untrustworthy | Both handlers use `data ?? {}` defensive destructuring, which contradicts the type guarantee |
| Missing Evidence | An explanation for why the defensive pattern is needed if TypeScript types are trusted |

### Analysis

**handleArrived (L403-404):**
```typescript
const handleArrived = (data: MarchArrivedPayload) => {
  const { marchId, cityId, troops, general } = data ?? {};
```

**handleCancelled (L564-565):**
```typescript
const handleCancelled = (data: MarchCancelledPayload) => {
  const { siegeTaskId } = data ?? {};
```

If `data` is typed as `MarchArrivedPayload` (a non-nullable interface), then `data ?? {}` should never trigger the fallback -- `data` cannot be `null` or `undefined` according to TypeScript. The `?? {}` suggests the developer does NOT trust the type annotation, likely because:

1. The eventBus uses `payload: any` (as shown in Attack 3)
2. The developer knows the type system provides no runtime guarantee
3. This is a tacit admission that the Payload interfaces are decorative

If the types were truly enforced, this defensive pattern would be unnecessary and should be replaced with `data.marchId`, `data.siegeTaskId`, etc.

**Severity**: LOW-MEDIUM. The defensive pattern is not harmful but reveals the developer's own distrust of the type system they claim is "strong."

---

## Attack 7: Flow Break Attack -- handleArrived executes synchronous blocking siege computation

| Item | Detail |
|------|--------|
| Builder's Claim | "handleSiegeConfirm synchronously triggers async flow" |
| Why Untrustworthy | handleArrived performs a synchronous chain of: siege execution -> casualty calculation -> result setting -> return march creation -> animation creation, all in one synchronous call stack triggered by eventBus.emit |
| Missing Evidence | Evidence that the siege computation does not block the UI animation frame |

### Analysis

The `handleArrived` handler (L403-558) is registered as an eventBus listener. When `MarchingSystem.update()` calls `eventBus.emit('march:arrived', ...)` (L199), the handler executes **synchronously** within the same call stack as `update()`.

The handler performs:
1. `siegeSystem.executeSiege(...)` -- potentially expensive battle computation (L433)
2. `siegeTaskManager.setResult(...)` -- state mutation (L457)
3. `marchingSystemRef.current!.createMarch(...)` -- creates return march (L476)
4. `marchingSystemRef.current!.startMarch(...)` -- starts return march (L486)
5. `conquestAnimSystem.create(...)` -- creates animation (L518)
6. Multiple `setActiveSiegeTasks(...)` / `setSiegeResultData(...)` React state updates

All of this happens **within the animation frame callback** (the `animate` function at L589), since `marchingSystem.update(dt)` is called inside `requestAnimationFrame`. If `executeSiege()` is computationally expensive (battle simulation with many units), it will block the rendering frame and cause jank.

Furthermore, `marchingSystemRef.current!.createMarch(...)` at L476 and `marchingSystemRef.current!.startMarch(...)` at L486 modify the same `activeMarches` Map that is being iterated in the outer `update()` loop. The `for...of` loop over `this.activeMarches` (L184) may encounter the newly created return march in the same update cycle, leading to **undefined iteration behavior**.

**Severity**: MEDIUM-HIGH. The synchronous execution pattern inside requestAnimationFrame can cause frame drops and potentially corrupt the activeMarches iteration.

---

## Summary Table

| # | Attack Type | Target | Severity | Status |
|---|-------------|--------|----------|--------|
| 1 | Vulnerability | Payload interfaces not used as type parameters at emit site | MEDIUM | CONFIRMED |
| 2 | Hallucination | 29 tests pass but don't test type safety | LOW | PARTIALLY CONFIRMED |
| 3 | No Evidence | Decorative interfaces, eventBus typed as `any` | HIGH | CONFIRMED |
| 4 | Integration Break | handleCancelled never unsubscribed (memory leak) | HIGH | CONFIRMED |
| 5 | Data Coverage | MarchArrivedPayload missing siegeTaskId, requires secondary lookup | MEDIUM | CONFIRMED |
| 6 | Boundary | `data ?? {}` reveals type distrust | LOW-MEDIUM | CONFIRMED |
| 7 | Flow Break | Synchronous siege computation blocks animation frame | MEDIUM-HIGH | CONFIRMED |

## Final Verdict

**PARTIAL OVERTHROW**: Builder's claims A (serialization) and D (cancelMarch payload) are substantiated by tests. Claims B (type safety) and C (comment correction) are significantly undermined:

- **Claim B is largely decorative**: The Payload interfaces exist but provide no compile-time enforcement at the emit site. The eventBus in WorldMapTab.tsx is `as any` typed. The type annotations on handlers are local hints only.
- **Memory leak bug**: `handleCancelled` is registered but never cleaned up on unmount.
- **Architectural inconsistency**: `march:arrived` payload lacks `siegeTaskId`, forcing a secondary lookup with fragile temporal coupling.
- **Synchronous blocking**: The entire siege execution chain runs synchronously inside requestAnimationFrame.

**Claims that survive challenge**: A (siegeTaskId serialization round-trip), D (cancelMarch siegeTaskId in payload), E (SiegeTaskPanel 27 tests), F (SiegeTaskManager 16 tests), G (ExpeditionSystem 20 tests).

**Claims that are overturned**: B (event payload type interfaces -- decorative, not enforced), and a newly discovered memory leak bug in handleCancelled cleanup.
