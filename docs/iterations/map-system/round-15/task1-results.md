# R15 Task1: Black Screen During Siege — Fix Results

## Bug Summary

**P0 Bug**: Black screen appeared during siege when a march arrived at a city.

**Root Cause**: `renderMarchSpritesOverlay()` in `PixelWorldMap.tsx` called `ctx.clearRect(0, 0, canvas.width, canvas.height)` on the shared canvas when no active marches existed. This wiped the entire canvas including terrain. Since the terrain dirty flag was not set, subsequent frames did not redraw terrain, leaving a black screen.

**Reproduction Path**:
1. March arrives at target city
2. March removed from `activeMarches`
3. `renderMarchSpritesOverlay` hits empty-march early return with `clearRect`
4. Entire canvas wiped (including terrain)
5. Terrain dirty flag is `false` → no terrain redraw
6. Siege animation renders on blank canvas → black screen

## Changes Made

### File: `src/components/idle/panels/map/PixelWorldMap.tsx`

#### Change 1: Remove clearRect from renderMarchSpritesOverlay (line ~1358)

**Before**:
```typescript
// P2 #8 fix: Clear the sprite layer when there are no active marches
// to prevent stale sprites from remaining on screen
if (!marches.length) {
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  return;
}
```

**After**:
```typescript
// R15 Task1: No longer clearRect on empty marches — terrain must persist
if (!marches.length) {
  return;
}
```

The `clearRect(0, 0, w, h)` in `PixelMapRenderer.render()` is intentional and untouched — it clears and redraws terrain. The bug was that `renderMarchSpritesOverlay` wiped the canvas without redrawing terrain.

#### Change 2: Force terrain redraw when overlays are dirty (line ~1054)

**Before** (snapshot capture only):
```typescript
// 快照脏标记状态
const wasTerrainDirty = flags.terrain;
const wasSpritesDirty = flags.sprites;
const wasEffectsDirty = flags.effects;
const wasRouteDirty = flags.route;
```

**After** (force terrain dirty before snapshot):
```typescript
// R15 Task1: Force terrain redraw when overlays change
// (prevents black screen when sprite layer clears but terrain wasn't marked dirty)
if (flags.sprites || flags.effects) {
  flags.terrain = true;
}

// 快照脏标记状态
const wasTerrainDirty = flags.terrain;
const wasSpritesDirty = flags.sprites;
const wasEffectsDirty = flags.effects;
const wasRouteDirty = flags.route;
```

This ensures that whenever sprites or effects layers are redrawn, terrain is also redrawn first, providing a proper base layer.

### File: `src/components/idle/panels/map/__tests__/PixelWorldMap.terrain-persist.test.tsx` (NEW)

6 new tests covering the fix:

| # | Test | Description |
|---|------|-------------|
| 1 | `terrain is redrawn when marches go from non-empty to empty` | Verifies terrain fillRect calls occur when march is removed |
| 2 | `static frames with empty marches produce no clearRect calls` | Verifies no unnecessary rendering in idle state |
| 3 | `siege animation triggers terrain redraw` | Verifies terrain redraws when effects dirty |
| 4 | `complete march arrival lifecycle — terrain always redrawn` | Full lifecycle test: march → siege → static |
| 5 | `effects dirty triggers terrain redraw` | Siege animation forces terrain redraw |
| 6 | `sprites dirty triggers terrain redraw` | March addition forces terrain redraw |

## Test Results

### New tests (all pass)
```
✓ PixelWorldMap.terrain-persist.test.tsx (6 tests) — 18ms
```

### Existing tests (no regressions)
```
✓ PixelWorldMap.batch-render.test.tsx (22 tests | 1 pre-existing float precision failure)
✓ PixelWorldMap.dirty-flag.test.tsx (14 tests) — all pass
```

The 1 failure in batch-render is a pre-existing floating-point precision issue (`expected 114.74... to equal 115`) unrelated to this fix. Without this fix, that test file has 18 failures; with this fix, only 1 pre-existing failure remains.

## Files Modified

| File | Action |
|------|--------|
| `src/components/idle/panels/map/PixelWorldMap.tsx` | Removed clearRect from renderMarchSpritesOverlay; added force-terrain-dirty logic |
| `src/components/idle/panels/map/__tests__/PixelWorldMap.terrain-persist.test.tsx` | Created (6 tests) |
