# R16 Task1: Terrain Performance Optimization -- transition-frame dirty

## Summary

Replaced R15 Task1's unconditional terrain dirty linkage (which forced terrain redraw every frame during active animations) with transition-frame detection that only marks terrain dirty when sprites/effects dirty state changes (false->true or true->false). This eliminates the performance regression while preserving the black-screen fix.

## Files Changed

### 1. `src/components/idle/panels/map/PixelWorldMap.tsx`

**Change A: Added `prevFlagsRef` (line ~879)**

Added a new ref to track the previous frame's dirty flag state for transition detection:

```typescript
// R16 Task1: Track previous frame's dirty state for transition detection
const prevFlagsRef = useRef({ sprites: false, effects: false });
```

**Change B: Replaced unconditional terrain dirty linkage with transition detection (line ~1057)**

Before (R15 Task1 -- forced terrain dirty every frame when overlays were active):
```typescript
// R15 Task1: Force terrain redraw when overlays change
if (flags.sprites || flags.effects) {
  flags.terrain = true;
}
```

After (R16 Task1 -- only on transition frames):
```typescript
// R16 Task1: Only mark terrain dirty on transition frames (sprites/effects dirty state changes)
// R15 Task1 originally forced terrain dirty every frame when overlays were active,
// but this caused performance regression. Now we only force terrain dirty when
// the sprites/effects dirty state transitions (false->true or true->false).
const spritesTransition = prevFlagsRef.current.sprites !== flags.sprites;
const effectsTransition = prevFlagsRef.current.effects !== flags.effects;
if (spritesTransition || effectsTransition) {
  flags.terrain = true;
}
```

**Change C: Save prevFlagsRef after rendering (line ~1125)**

After the rendering block completes and flags are cleared, save the current state for next frame comparison:

```typescript
// R16 Task1: Save current flags state for next frame's transition detection.
// Must be AFTER flags are cleared by rendering, so we capture the final state.
prevFlagsRef.current = { sprites: flags.sprites, effects: flags.effects };
```

Key design decision: `prevFlagsRef` is saved AFTER the rendering block (not before) so it captures the post-clear state of the flags. This prevents false transitions on consecutive frames when animation sources continuously set flags to true.

### 2. `src/components/idle/panels/map/__tests__/PixelWorldMap.terrain-persist.test.tsx`

Updated file header to document both R15 and R16 changes.

Added new test describe block with 4 tests:

1. **"terrain only redraws on transition frames during animation"** -- Verifies that terrain redraws on the first frame (initial transition) and when marches are removed (transition), but not on intermediate frames with no state change.

2. **"static frames (no animation) do not trigger terrain redraw"** -- Verifies that multiple consecutive frames with no animations and no data changes produce zero rendering calls.

3. **"terrain redraws when march sprites appear and disappear"** -- Simulates march start (sprites dirty false->true) and march end (sprites dirty true->false), verifying terrain redraws on both transitions.

4. **"multiple transitions trigger proportional terrain redraws"** -- Simulates 3 transitions (sprites appear, effects appear, sprites disappear) and verifies terrain redraws on each.

## Test Results

### Target tests (10/10 passed)
```
PixelWorldMap.terrain-persist.test.tsx
  R15 Task1: Terrain persistence -- black screen fix (6 tests) -- ALL PASSED
  R16 Task1: Terrain only redraws on transition frames (4 tests) -- ALL PASSED
```

### Regression tests (505/509 passed)
All 23 test files in `src/components/idle/panels/map/__tests__/` were run:
- 22 passed, 1 failed (pre-existing `injury-integration.test.tsx` with 4 failures due to `mapInjuryLevel is not a function` -- R14 pre-existing issue, unrelated)
- 505 tests passed, 4 failed (all pre-existing)

### TypeScript check
No new type errors introduced. Pre-existing `PathfindingSystem` errors (filtered) are unrelated.

## Issues Found

None. The transition-frame detection correctly:
- Preserves the R15 black-screen fix (terrain redraws on both false->true and true->false transitions)
- Eliminates the performance regression (terrain no longer redraws every frame during continuous animations)
- Handles the edge case of initial frame correctly (prevFlagsRef starts as {false, false} which triggers transition on first frame with dirty flags)
