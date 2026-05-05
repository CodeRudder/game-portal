# Task 4: Siege Task Panel

## Implementation

### SiegeTaskManager Enhancement
- Added `getTaskSummary(taskId)` method that returns a `SiegeTaskSummary` object containing:
  - taskId, targetName, status, strategy
  - marchProgress (percentage when marching, based on marchStartedAt/estimatedArrival)
  - siegeProgress (percentage when sieging, default placeholder 50%)
  - result ('victory' | 'defeat' | null, derived from task.result)
  - rewards (rewardMultiplier + territoryCaptured, for victorious completed tasks)
  - rewardClaimed (boolean tracking claimed state)
- Added `claimReward(taskId)` method to mark a task's rewards as claimed (idempotent, returns boolean)
- Added internal `claimedRewards: Set<string>` tracking state
- Added `SiegeTaskSummary` type to siege-task.types.ts

### SiegeTaskPanel Enhancement
- Added `onClaimReward` prop (callback: `(taskId: string) => void`)
- Added `claimedRewardTaskIds` prop (Set of task IDs whose rewards are already claimed)
- Completed victorious tasks show a "领取奖励" (Claim Reward) button when:
  - `onClaimReward` callback is provided
  - Task has `result.victory === true`
  - Task ID is not in `claimedRewardTaskIds`
- Claimed tasks show "奖励已领取" (Reward Claimed) label instead of the button
- Defeated tasks show no claim button at all
- Claim button uses `stopPropagation` to avoid triggering the parent task click

## Tests Added

All tests are under the `R17-I10` prefix in the existing test file:

1. **Panel renders with active tasks showing real-time status** - Verifies marching/sieging tasks render with correct status badges and progress bars
2. **Status badge shows correct state for each phase** - Validates marching, sieging, and completed status labels display correctly
3. **Task status flow updates correctly through phases** - Uses `rerender` to simulate marching -> sieging -> completed(victory) progression
4. **Reward claim button triggers onClaimReward callback** - Clicks the claim button and verifies the callback fires with the correct taskId
5. **No claim button for defeated tasks** - Ensures defeated tasks have no claim button
6. **Claimed reward tasks show claimed label instead of button** - Verifies the "已领取" label appears and no claim button when task is in claimedRewardTaskIds
7. **No claim button when onClaimReward prop is not passed** - Ensures backward compatibility
8. **Attack result displays victory or defeat correctly** - Validates victory/defeat result badges

## Test Results

```
 ✓ src/components/idle/panels/map/__tests__/SiegeTaskPanel.test.tsx  (67 tests) 684ms

 Test Files  1 passed (1)
      Tests  67 passed (67)
   Start at  13:12:12
   Duration  2.46s (transform 262ms, setup 247ms, collect 228ms, tests 684ms, environment 478ms, prepare 112ms)
```

## Files Modified/Created

- `src/games/three-kingdoms/core/map/siege-task.types.ts` - Added `SiegeTaskSummary` interface
- `src/games/three-kingdoms/engine/map/SiegeTaskManager.ts` - Added `getTaskSummary()`, `claimReward()`, `claimedRewards` set
- `src/components/idle/panels/map/SiegeTaskPanel.tsx` - Added `onClaimReward`, `claimedRewardTaskIds` props and reward claim UI
- `src/components/idle/panels/map/__tests__/SiegeTaskPanel.test.tsx` - Added 8 new R17-I10 tests
