# Task 3: Siege Lock Mechanism

## Implementation
- Added `SIEGE_LOCK_TIMEOUT_MS` constant (5 minutes) for auto-release timeout
- Added private `siegeLocks` field: `Map<string, { taskId: string; lockedAt: number }>`
- Added `acquireSiegeLock(targetId, taskId)` - returns false if target already locked
- Added `releaseSiegeLock(targetId)` - releases the lock for a target
- Added `isSiegeLocked(targetId)` - checks if a target has an active lock
- Added `checkLockTimeout()` - iterates locks and releases any older than 5 minutes
- Integrated lock into `createTask()`: acquires lock before task creation, returns null if locked
- Integrated lock into `advanceStatus()`: releases lock when status reaches 'completed'
- Updated `removeCompletedTasks()` to release locks for removed completed tasks
- Updated `deserialize()` to clear siege locks on restore
- Changed `createTask()` return type from `SiegeTask` to `SiegeTask | null`

## Tests Added
- **lock acquisition - should acquire lock on first siege of a target**: First siege creates task and sets lock
- **lock acquisition - should acquire lock for each different target**: Multiple targets each get independent locks
- **lock contention - should reject second siege on same target while lock is held**: Second createTask on same targetId returns null
- **lock contention - should reject siege on locked target at any task stage**: Lock held through marching/sieging stages
- **lock release on completion - should release lock when task reaches completed status**: Lock cleared on completed transition
- **lock release on completion - should allow new siege on same target after completion**: Can create new task after previous completes
- **lock timeout - should auto-release lock after timeout**: Lock released exactly at 5-minute boundary via checkLockTimeout
- **lock timeout - should allow new siege after lock timeout**: New task accepted after timeout expires
- **lock timeout - should only release expired locks, not all locks**: Only older locks released, newer locks preserved
- **concurrent sieges - should allow concurrent sieges on different targets**: 5 concurrent tasks on 5 targets succeed
- **concurrent sieges - should release individual locks independently**: Completing one task only releases its lock, others remain held

## Test Results
```
 RUN  v1.6.1

 ✓ SiegeTaskManager.lock.test.ts (11 tests) 14ms

 Test Files  1 passed (1)
      Tests  11 passed (11)
   Duration  1.84s
```

Existing tests (41 tests) also pass with no regressions.

## Files Modified
- `src/games/three-kingdoms/engine/map/SiegeTaskManager.ts` - Added siege lock mechanism
- `src/games/three-kingdoms/engine/map/__tests__/SiegeTaskManager.lock.test.ts` - New test file (11 tests)
