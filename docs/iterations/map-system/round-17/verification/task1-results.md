# Task 1: March Duration Clamp Tests

## Tests Added
- short distance march: calculated duration < 10s -> clamped to 10s (createMarch)
- short distance: generatePreview also clamps to 10s
- long distance march: calculated duration > 60s -> clamped to 60s (createMarch)
- long distance: generatePreview also clamps to 60s
- normal range march: 10s <= duration <= 60s -> no change (createMarch)
- normal range: generatePreview returns unclamped duration
- boundary: exactly 10s -> no change (createMarch)
- boundary: exactly 60s -> no change (createMarch)
- boundary: generatePreview at exactly 10s and 60s -> no change
- multi-segment path with total distance below clamp -> clamped to 10s

## Test Results
```
 RUN  v1.6.1 /home/gongdewei/work/projects/shared/game-portal

 ✓ src/games/three-kingdoms/engine/map/__tests__/MarchingSystem.test.ts  (53 tests) 36ms

 Test Files  1 passed (1)
      Tests  53 passed (53)
   Start at  13:08:07
   Duration  2.86s (transform 165ms, setup 522ms, collect 165ms, tests 36ms, environment 927ms, prepare 187ms)
```

## Files Modified
- src/games/three-kingdoms/engine/map/__tests__/MarchingSystem.test.ts (added 10 tests in "March duration clamp constraints" describe block)
