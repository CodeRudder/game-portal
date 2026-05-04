# Task 6: R12遗留P3改善 — 高价值选择性修复

## Summary

4 sub-tasks completed: E2E file rename, cancelled fallthrough comment, cancel chain tests, formatElapsedTime fakeTimers.

## Files Modified

### 1. P3 #2.1: E2E file rename
- **Renamed**: `src/games/three-kingdoms/engine/map/__tests__/integration/march-siege-e2e.integration.test.ts` -> `march-siege.integration.test.ts`
- **Updated**: File header description comments to reflect new name and R13 Task6 provenance

### 2. P3 #1.2: Cancelled fallthrough comment
- **Modified**: `src/components/idle/panels/map/PixelWorldMap.tsx`
  - Added explicit `cancelled` state check in `collectMarchRects()` with comment: `// cancelled: 不渲染（已从activeMarches删除，不会到达此处）`
  - Returns empty `{ rects, effects }` for cancelled state

### 3. P3 #5.1: Cancel chain integration tests
- **Modified**: `src/components/idle/panels/map/__tests__/PixelWorldMapMarchSprites.test.tsx`
  - Added 1 test for cancelled state smoke test
  - Added 2 tests for cancel chain (create -> start -> cancel -> verify sprite cleanup)

### 4. P3 #2.3: formatElapsedTime fakeTimers
- **Modified**: `src/components/idle/panels/map/__tests__/SiegeTaskPanel.test.tsx`
  - Updated existing creation time tests to use `vi.useFakeTimers()` + `vi.setSystemTime()`
  - Added 2 boundary value tests:
    - 59 seconds vs 61 seconds (second/minute boundary)
    - 3599 seconds vs 3601 seconds (minute/hour boundary)

### 5. Bug fix (pre-existing)
- **Modified**: `src/components/idle/panels/map/__tests__/PixelWorldMap.dirty-flag.test.tsx`
  - Added missing `rect: vi.fn()` to mock canvas context (required by R13 Task2 batch render)
  - Updated assertion from `fillRect` to `rect` to match batch rendering behavior

## Tests Added/Changed

| Test File | Change | Count |
|-----------|--------|-------|
| `march-siege.integration.test.ts` | Renamed file, updated comments | 22 tests (unchanged) |
| `PixelWorldMapMarchSprites.test.tsx` | Added cancelled state test + 2 cancel chain tests | +3 tests |
| `SiegeTaskPanel.test.tsx` | Updated 2 tests to use fakeTimers + 2 boundary tests | +2 tests |
| `PixelWorldMap.dirty-flag.test.tsx` | Fixed pre-existing rect mock + assertion | 0 new tests |

**Total new tests**: 5

## Test Results

### Integration tests (renamed file)
```
march-siege.integration.test.ts: 22 passed (22)
```

### Map panel tests
```
All 19 test files: 454 passed (454)
```

### Key test outputs
- `PixelWorldMapMarchSprites.test.tsx`: 56 passed (was 53)
- `SiegeTaskPanel.test.tsx`: 59 passed (was 57)
- `PixelWorldMap.dirty-flag.test.tsx`: 14 passed (was 14, fixed 2 failures)

## Verification Criteria

- [x] E2E file renamed and tests pass (22/22)
- [x] Cancelled fallthrough comment/branch added in collectMarchRects
- [x] >= 2 new cancel chain tests passing (2 cancel chain + 1 cancelled smoke = 3)
- [x] formatElapsedTime tests use fakeTimers with boundary values (59s/61s, 3599s/3601s)
- [x] All existing tests pass (no regression) — 454/454 map panel tests pass
