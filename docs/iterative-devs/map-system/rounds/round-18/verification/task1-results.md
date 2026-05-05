# Task 1 Results: I4 Siege Interrupt Handling (攻城中断处理)

## Status: PASS

## Test Results

```
 ✓ SiegeTaskManager.interrupt.test.ts (26 tests) 24ms
 ✓ SiegeTaskManager.lock.test.ts      (13 tests) 16ms
 ✓ SiegeTaskManager.test.ts           (16 tests) 17ms
 ✓ SiegeTaskManager.chain.test.ts     (25 tests) 20ms

 Test Files  4 passed (4)
      Tests  90 passed (90)
```

## Changes

### 1. siege-task.types.ts
- Added `'paused'` to `SiegeTaskStatus` union type
- Added `pausedAt: number | null` field to `SiegeTask`
- Added `pauseSnapshot: SiegePauseSnapshot | null` field to `SiegeTask`
- Added `SiegePauseSnapshot` interface with `defenseRatio` and `elapsedBattleTime`

### 2. SiegeTaskManager.ts
- Added `SIEGE_TASK_EVENTS.PAUSED`, `RESUMED`, `CANCELLED` event names
- Added `pauseSiege(taskId, snapshot?)`: sieging → paused, saves progress snapshot
- Added `resumeSiege(taskId)`: paused → sieging, clears pause metadata
- Added `cancelSiege(taskId, marchingSystem)`: paused → returning, creates return march via MarchingSystem
- Updated state transition table: sieging → paused, paused → sieging, paused → returning
- Updated `getTaskSummary` to handle paused status for siege progress display
- Initialized `pausedAt` and `pauseSnapshot` in `createTask`

### 3. SiegeTaskManager.interrupt.test.ts (new, 26 tests)
- Pause active siege task (sieging → paused)
- Pause emits statusChanged + paused events
- Cannot pause non-sieging tasks (preparing, marching, paused, settling, returning, completed)
- Cannot pause non-existent task
- Resume paused siege (paused → sieging), clears metadata
- Resume emits events with saved snapshot
- Cannot resume non-paused or non-existent tasks
- Cancel paused siege creates return march with correct params
- Cancel works without marching system (null)
- Cancel emits statusChanged + cancelled events
- Cannot cancel non-paused or non-existent tasks
- Pause saves progress snapshot (defenseRatio, elapsedBattleTime)
- Default snapshot values when no params
- Snapshot cleared on resume and cancel
- Snapshot survives serialization round-trip
- Paused task appears in active tasks, getTasksByStatus, getTaskByTarget
- Paused task still holds siege lock (blocks new tasks on same target)
- Full flow: pause → resume → pause → cancel cycle

## Verification
- All 90 tests pass (26 new + 64 existing, zero regressions)
- State transition table enforces: sieging↔paused, paused→returning
- Siege lock held during pause, released on completion
