# Task 2: E1-3 March E2E Full-Chain Tests — Results

**Date:** 2026-05-04
**Status:** PASS
**Tests:** 17/17 passed

## Test File

`src/games/three-kingdoms/engine/map/__tests__/integration/march-e2e-full-chain.integration.test.ts`

## Test Cases

### 1. Normal march complete flow (2 tests)
- **create -> start -> update -> arrive -> event trigger**: Full chain from creation through arrival verified, including correct event payloads and state transitions.
- **Event chain order**: Confirmed `march:created` -> `march:started` -> `march:arrived` ordering.

### 2. Short distance march — min duration clamp (3 tests)
- **Very short path (150px)**: `estimatedTime` clamped to 10s (MIN_MARCH_DURATION_MS / 1000). Verified in both `createMarch` return value and `march:created` event payload.
- **Extremely short path (1px)**: Still clamps to 10s.
- **generatePreview short path**: Also clamps to 10s.

### 3. Long distance march — max duration clamp (3 tests)
- **Very long path (3000px)**: `estimatedTime` clamped to 60s (MAX_MARCH_DURATION_MS / 1000).
- **Extremely long path (50000px)**: Still clamps to 60s.
- **generatePreview long path**: Also clamps to 60s.

### 4. Multiple concurrent marches (2 tests)
- **Three marches with different paths**: All created, started, and arrived independently. Each emitted its own `march:arrived` with correct data.
- **Positions do not interfere**: Verified that concurrent marches maintain independent positions on their own paths.

### 5. March cancellation (4 tests)
- **create -> start -> cancel mid-way**: `march:cancelled` emitted, march removed from active list, state set to 'cancelled'.
- **Cancelled march does not emit march:arrived**: After cancellation, further updates do not trigger arrival events.
- **siegeTaskId propagated to cancelled event**: Verified `siegeTaskId` in `march:cancelled` payload.
- **Other marches continue after cancellation**: Cancelling one march does not affect others; remaining march arrives normally.

### 6. Wildcard event subscription (1 test)
- **march:* wildcard captures all march events**: Verified using real EventBus with explicit listeners tracking event order.

### 7. March with siegeTaskId through full chain (1 test)
- **siegeTaskId preserved from creation through arrival**: Confirmed `march:arrived` event includes `siegeTaskId`.

### 8. EventBus once() behavior (1 test)
- **once() fires only once for first arrival**: Two marches arrive, but once-subscribed handler fires exactly once.

## Key Design Decisions

- **Real EventBus**: Uses the actual `EventBus` class (not mocks) to verify real pub/sub behavior including wildcard and once patterns.
- **Real MarchingSystem**: No mocking of the system under test; all internal state transitions and position updates are real.
- **Deterministic updates**: Uses `runUpdateUntilArrived()` helper with bounded iterations to drive marches to completion without relying on real time.
