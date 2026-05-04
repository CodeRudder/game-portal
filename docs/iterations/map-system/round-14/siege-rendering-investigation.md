# R14 Investigation: Siege Rendering Flow Issues

**Date**: 2025-05-04
**Scope**: Two critical rendering issues in the siege flow
**Status**: Investigation complete, fixes identified

---

## Issue 1: Missing Animation Sequencing

### What Currently Happens

After the user clicks "Siege Confirm", the flow is:

1. `handleSiegeConfirm()` (WorldMapTab.tsx:1136-1226) creates a march unit and starts it. The siege confirm modal closes.
2. The marching system runs in the `requestAnimationFrame` loop, moving sprites along the path.
3. When the march arrives, `handleArrived` fires (WorldMapTab.tsx:501-677).
4. Inside `handleArrived`, a `setTimeout(0)` schedules the siege execution.
5. Inside that `setTimeout`, the siege is executed **synchronously**:
   - `battleSystem.createBattle()` emits `battle:started`, which triggers `SiegeBattleAnimationSystem.startSiegeAnimation()` (starts the assembly/battle animation).
   - `siegeSystem.executeSiege()` runs synchronously and returns the result immediately.
   - `battleSystem.cancelBattle()` stops the battle engine.
   - `setSiegeResultData(result)` and `setSiegeResultVisible(true)` are called **immediately** after executeSiege returns.
6. The result modal appears essentially at the same time as (or very shortly after) the battle animation starts, because React batches the state updates.

**Root cause**: The siege result is computed synchronously by `siegeSystem.executeSiege()`, and the result modal is shown immediately in the same `setTimeout(0)` callback. The animation systems (SiegeBattleAnimationSystem and ConquestAnimationSystem) are started but the result modal does not wait for them to complete. There is no sequencing mechanism that says "show result modal only after animations finish."

### What Should Happen

The expected visual sequence is:
1. User clicks Confirm -> march sprites start moving across the map (works correctly).
2. March sprites arrive at target city -> march sprites disappear, siege assembly animation starts (3s).
3. Siege battle animation plays with HP bar depleting, strategy effects, etc.
4. Result animation plays (victory flag or defeat smoke).
5. **THEN** the result modal appears.

### Where to Fix

**File**: `/Users/gongdewei/work/projects/game-portal/src/components/idle/panels/map/WorldMapTab.tsx`

**Location**: The `handleArrived` handler, specifically the `setTimeout(0)` block (lines 524-661).

**Fix approach**:
1. After `executeSiege()` completes and the result is available, **do not** immediately call `setSiegeResultVisible(true)`.
2. Instead, store the result data in a ref but defer showing the modal until the animation systems signal completion.
3. Listen for the `siegeAnim:completed` event from `SiegeBattleAnimationSystem` (already emitted at line 430 of SiegeBattleAnimationSystem.ts) or the `siegeAnim:phaseChanged` event transitioning to `completed`.
4. When the animation completion event fires, **then** call `setSiegeResultVisible(true)`.
5. Additionally, the `SiegeBattleAnimationSystem` has a `completedLingerMs` of 2000ms (line 117). The result modal should appear after the completed phase's linger time, or alternatively the linger time should be shortened and the modal should trigger at the `siegeAnim:completed` event.

**Alternative simpler fix**: Add a delay between siege execution completion and showing the result modal that matches the expected animation duration:
- Assembly: 3000ms
- Battle: variable (but `executeSiege` is synchronous, so this is instant)
- Completed linger: 2000ms
- Total: ~5000ms delay before showing the modal.

However, the event-driven approach (listening to `siegeAnim:completed`) is more robust.

### Blocking Dependencies

- The `SiegeBattleAnimationSystem` already emits `siegeAnim:completed` with `{ taskId, targetCityId, victory }`. This can be used directly.
- The `handleArrived` handler would need to register a one-time event listener for `siegeAnim:completed` matching the task ID, then show the modal.
- The event listener would need to be set up on the same `eventBus` that the animation system uses, which is the local eventBus created in the `useEffect` at line 432.

---

## Issue 2: Black Screen During Siege

### What Currently Happens

The rendering loop in `PixelWorldMap` (PixelWorldMap.tsx:1042-1113) uses a **dirty flag system** with layered rendering:

1. **Terrain layer** (`wasTerrainDirty`): Calls `renderer.render()` which calls `ctx.clearRect(0, 0, canvas.width, canvas.height)` (PixelMapRenderer.ts:288), then redraws the entire map. This wipes the canvas clean.
2. **Effects layer** (`wasEffectsDirty`): Renders conquest animations and siege battle animations on top.
3. **Sprite layer** (`wasSpritesDirty`): Renders march sprites.
4. **Route layer** (`wasRouteDirty`): Renders march route overlays.

The critical bug is at **line 1354-1359** of PixelWorldMap.tsx:

```typescript
// P2 #8 fix: Clear the sprite layer when there are no active marches
if (!marches.length) {
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);  // <-- WIPES ENTIRE CANVAS
  }
  return;
}
```

When a march arrives at the target city:
1. The march is removed from `activeMarches` (WorldMapTab.tsx:506: `setActiveMarches(marchingSystem.getActiveMarches())` -- the arrived march may be removed or its state changes).
2. Later, at line 672-676, after 3 seconds, `marchingSystem.removeMarch(marchId)` is called and `setActiveMarches` is updated again.
3. Once `activeMarches` becomes empty, `renderMarchSpritesOverlay()` hits the early-return path that calls `ctx.clearRect(0, 0, canvas.width, canvas.height)`.
4. **This clears the entire canvas**, including the terrain that was just drawn by `renderer.render()`.
5. At this point, the siege animation overlay tries to render on a blank (black/transparent) canvas.

Additionally, there is a layer ordering issue in the dirty flag system:
- The terrain layer (`renderer.render()`) only redraws when `wasTerrainDirty` is true.
- The sprite layer can clear the entire canvas (line 1357) even when the terrain layer is NOT dirty.
- After the sprite layer clears the canvas, subsequent frames will NOT redraw the terrain (because `terrain` dirty flag was already set to false), resulting in a black screen.

### What Should Happen

The siege animations should be rendered as **overlays on top of the map**, not replacing it:
1. The map terrain should always be visible as the base layer.
2. Siege animations (assembly, battle, completed) should draw on top of the terrain.
3. March sprites should draw on top of the terrain.
4. Clearing the sprite layer should NOT clear the terrain beneath it.

### Where to Fix

**File**: `/Users/gongdewei/work/projects/game-portal/src/components/idle/panels/map/PixelWorldMap.tsx`

**Location 1**: Lines 1354-1359 (`renderMarchSpritesOverlay` early-return clear)

**Fix**: Remove the `ctx.clearRect(0, 0, canvas.width, canvas.height)` call. Instead, the dirty flag system should handle clearing properly:
- When sprites are dirty, the terrain should be redrawn first (set terrain dirty), then sprites drawn on top.
- OR: Use a separate canvas/layer for sprites so clearing sprites doesn't affect terrain.

**Location 2**: The rendering loop (lines 1060-1110) should enforce that when sprites or effects are dirty, terrain is always redrawn first. The current code only redraws terrain when `wasTerrainDirty` is true, but the sprite layer's `clearRect` destroys the terrain even when it wasn't dirty.

**Fix approach (recommended)**:

Option A - Single canvas with forced terrain redraw:
In the rendering loop, when sprites or effects need redrawing, always set the terrain dirty flag too:
```typescript
// Before the rendering block:
if (wasSpritesDirty || wasEffectsDirty) {
  flags.terrain = true; // Force terrain redraw when overlays change
}
```
And remove the `clearRect` from `renderMarchSpritesOverlay`.

Option B - Multi-canvas (overlay canvas):
Use two stacked canvases - one for terrain (redrawn rarely) and one for sprites/effects (redrawn often). This avoids the clearRect problem entirely but requires more structural changes.

Option A is simpler and sufficient for the current codebase.

### Blocking Dependencies

- The dirty flag system is tightly coupled. Changing it requires care to avoid performance regression (the whole point of dirty flags is to skip terrain redraws).
- The `PixelMapRenderer.render()` call is relatively expensive (redraws the full ASCII map). Forcing it every frame when animations are active is acceptable because animations already trigger frequent redraws.
- The siege animation phases have long durations (assembly 3s + battle variable + completed linger 2s), so the map will be redrawn frequently during these periods anyway.

---

## Summary of Code Locations

| File | Lines | Description |
|------|-------|-------------|
| `WorldMapTab.tsx` | 524-661 | `handleArrived` setTimeout block - siege execution + immediate result modal |
| `WorldMapTab.tsx` | 635-636 | `setSiegeResultData` + `setSiegeResultVisible(true)` - immediate modal display |
| `WorldMapTab.tsx` | 536-549 | `battleSystem.createBattle()` - starts siege animation |
| `WorldMapTab.tsx` | 591-593 | `battleSystem.cancelBattle()` - stops battle engine |
| `PixelWorldMap.tsx` | 1354-1359 | `clearRect(0,0,w,h)` when no marches - **causes black screen** |
| `PixelWorldMap.tsx` | 1062-1065 | Terrain layer only redraws when `wasTerrainDirty` - missed after sprite clear |
| `PixelWorldMap.tsx` | 1088-1102 | Sprite and effects layers drawn after terrain - can be on blank canvas |
| `PixelMapRenderer.ts` | 288 | `clearRect` in `render()` - intentional full clear for terrain redraw |
| `SiegeBattleAnimationSystem.ts` | 115-118 | Default config: assemblyDurationMs=3000, completedLingerMs=2000 |
| `SiegeBattleAnimationSystem.ts` | 423-434 | `completeSiegeAnimation` emits `siegeAnim:completed` event |

## Recommended Fix Priority

1. **Issue 2 (Black screen)** - Higher priority, simpler fix. Remove `clearRect` from `renderMarchSpritesOverlay` and force terrain redraw when overlays are active.
2. **Issue 1 (Missing sequencing)** - Requires event-driven approach to defer result modal until animations complete. More complex but straightforward.
