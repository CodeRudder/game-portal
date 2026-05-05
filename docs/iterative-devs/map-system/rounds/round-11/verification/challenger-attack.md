# R11 Challenger Attack Report

**Date**: 2026-05-04
**Role**: R11 Challenger
**Target**: Builder Manifest `docs/iterations/map-system/round-11/verification/builder-manifest.md`

---

## Executive Summary

Builder claims all 4 R11 feature points are "VERIFIED" with 119 passing tests. After reading source code and running tests, I confirm all tests do pass. However, I identified **11 valid challenges** (P0: 2, P1: 5, P2: 4) covering hallucinated claims, misleading test names, dead test parameters, meaningless benchmarks, and unverified integration paths.

---

## Challenge Matrix

| # | Severity | Category | Feature Point | Summary |
|---|----------|----------|---------------|---------|
| 1 | P0 | 幻觉攻击 | R11-4 | Test 14 name claims "仅标记sprites=true" but code marks ALL 4 layers dirty; test only checks sprites=true without asserting others are false |
| 2 | P0 | 漏洞攻击 | R11-4 | "分层脏标记" mechanism is NOT truly layered -- `markDirtyRef.current()` inside useEffects marks ALL layers dirty simultaneously, defeating the optimization purpose |
| 3 | P1 | 幻觉攻击 | R11-2 | 6 test cases pass `originalPath` to `createReturnMarch()`, but the function signature does NOT accept this parameter; it's dead test code |
| 4 | P1 | 漏洞攻击 | R11-1 | `intercepted` state has zero dedicated rendering logic in source; test R11-8 passes only because the `else` fallback branch happens to produce correct behavior |
| 5 | P1 | 幻觉攻击 | R11-3 | Benchmark #8 "1000次fillRect < 1ms" tests raw mock function call overhead, NOT actual rendering performance; meaningless metric |
| 6 | P1 | 无证据攻击 | R11-3 | All 11 performance benchmarks use mock canvas (no real rendering); claims like "单帧 < 16.67ms (60fps)" are unverifiable in production |
| 7 | P1 | 集成断裂攻击 | R11-2 | MarchingSystem tests use `createMockDeps()` -- eventBus is completely mocked; no verification that events actually propagate to real consumers |
| 8 | P2 | 无证据攻击 | R11-4 | No test verifies what happens when `activeMarches` goes from non-empty to empty -- sprites dirty flag is set but `renderMarchSpritesOverlay` returns early, so the flag gets reset without actual sprite cleanup rendering |
| 9 | P2 | 流程断裂攻击 | R11-1 | 16 smoke test assertions + 17 I11 tests all test Canvas rendering in isolation; no end-to-end test covers: data change -> React re-render -> useEffect -> dirty flag -> animate loop -> Canvas draw |
| 10 | P2 | 无证据攻击 | R11-2 | `cancelMarch` in all states (marching/arrived/preparing) all set state to 'retreating' and delete from map -- tests verify this behavior but there is NO code path that actually creates a return march with visual retreating animation after cancel; cancel just removes the march |
| 11 | P2 | 漏洞攻击 | R11-4 | `getDirtyFlagsForTest()` uses a module-level global `_testDirtyFlagsRef`; if multiple PixelWorldMap instances are created, the ref is overwritten -- no test covers this scenario |

---

## Detailed Challenges

### Challenge #1 (P0): Test 14 Name is Hallucinated -- "仅标记sprites=true" is False

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 |
|--------|--------------|-------------|-------------|
| R11-4 Test 14 | "activeMarches变化仅标记sprites=true" -- 14 tests verified | Test name claims "仅" (only), but source code at L1001-1003 calls `markDirtyRef.current()` when `activeMarches.length > 0`, which sets ALL 4 flags to true (terrain/sprites/effects/route) | Test only asserts `flags!.sprites === true` without asserting `flags!.terrain === false`, `flags!.effects === false`, `flags!.route === false`. If these assertions were added, the test would FAIL |

**Evidence**:

Source: `/Users/gongdewei/work/projects/game-portal/src/components/idle/panels/map/PixelWorldMap.tsx` L997-1004:
```typescript
useEffect(() => {
    marchesRef.current = activeMarches ?? [];
    dirtyFlagsRef.current.sprites = true;
    if (activeMarches && activeMarches.length > 0) {
      markDirtyRef.current(); // <-- THIS sets ALL 4 flags to true!
    }
  }, [activeMarches]);
```

`markDirty` function at L820-826:
```typescript
const markDirty = () => {
    dirtyFlagsRef.current.terrain = true;
    dirtyFlagsRef.current.sprites = true;
    dirtyFlagsRef.current.effects = true;
    dirtyFlagsRef.current.route = true;
};
```

Test at `/Users/gongdewei/work/projects/game-portal/src/components/idle/panels/map/__tests__/PixelWorldMap.dirty-flag.test.tsx` L530-545:
```typescript
it('getDirtyFlagsForTest — activeMarches变化仅标记sprites=true', () => {
    // ... renders with activeMarches={[]}, flushes, then rerenders with a march
    const flags = getDirtyFlagsForTest();
    expect(flags!.sprites).toBe(true); // ONLY checks sprites
    // Missing: expect(flags!.terrain).toBe(false) -- would FAIL
    // Missing: expect(flags!.effects).toBe(false) -- would FAIL
    // Missing: expect(flags!.route).toBe(false) -- would FAIL
});
```

---

### Challenge #2 (P0): "分层脏标记" is NOT Truly Layered

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 |
|--------|--------------|-------------|-------------|
| R11-4 D3-2 | "分层脏标记机制" with 4 independent layers (terrain/sprites/effects/route) | The optimization is largely illusory. When `activeMarches` has items, `markDirtyRef.current()` is called, which marks ALL layers dirty simultaneously. Same for `activeSiegeAnims`, `territories`, `marchRoute`, `selectedId`, `highlightedTaskId` -- ALL their useEffects call `markDirtyRef.current()`. The only case where truly selective marking works is when `activeMarches` changes to empty (then only `sprites` flag is set without `markDirty`). | No test verifies performance improvement with truly selective layer rendering. No test measures Canvas call counts when only one layer changes while others are already clean |

**Evidence**:

Every single data-change useEffect calls `markDirtyRef.current()`:
- territories (L982): calls `markDirtyRef.current()`
- marchRoute (L992): calls `markDirtyRef.current()`
- activeMarches with length>0 (L1002): calls `markDirtyRef.current()`
- activeSiegeAnims with length>0 (L1013): calls `markDirtyRef.current()`
- selectedId (L1574): calls `markDirtyRef.current()`
- highlightedTaskId (L1584): calls `markDirtyRef.current()`

The only scenario where selective marking works is `activeMarches` changing to empty array -- then only `sprites=true` is set. But this is a niche edge case.

---

### Challenge #3 (P1): `originalPath` Parameter is Dead Test Code

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 |
|--------|--------------|-------------|-------------|
| R11-2 createReturnMarch tests | 8 abnormal path scenarios verified | 6 out of 8 createReturnMarch tests pass `originalPath` parameter (e.g., `originalPath: [{ x: 0, y: 0 }, { x: 10, y: 10 }]`) but `createReturnMarch()` signature at L341-348 does NOT include `originalPath`. The parameter is silently ignored at runtime | No test verifies what happens when `originalPath` is actually needed. The test "路径基于 calculateMarchRoute（非 originalPath）" explicitly checks that returned path is NOT the originalPath, but `originalPath` was never used by the function in the first place -- the test is proving something that was never in question |

**Evidence**:

Function signature in `/Users/gongdewei/work/projects/game-portal/src/games/three-kingdoms/engine/map/MarchingSystem.ts` L341-348:
```typescript
createReturnMarch(params: {
    fromCityId: string;
    toCityId: string;
    troops: number;
    general: string;
    faction: MarchUnit['faction'];
    siegeTaskId?: string;
    // NOTE: NO originalPath parameter!
  }): MarchUnit | null {
```

Tests passing unused `originalPath` at lines: 293, 307, 332, 347, 388 (in the test file).

---

### Challenge #4 (P1): `intercepted` State Has Zero Dedicated Implementation

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 |
|--------|--------------|-------------|-------------|
| R11-1 R11-8 | "intercepted状态使用阵营色渲染而非retreating灰" verified | Source code has ZERO references to `intercepted` state in the entire `PixelWorldMap.tsx` file. The test passes because `intercepted` falls through the `else` branch of `if (march.state === 'retreating')`, getting default faction color. This is accidental correctness, not intentional implementation | No test verifies intercepted-specific behavior (e.g., should it blink differently? should it have a different route style?). The test only checks that it's NOT using retreating colors, which is trivially true because it's not retreating |

**Evidence**:

Grep for `intercepted` in `PixelWorldMap.tsx`: **0 matches**

In `renderSingleMarch` L234-240:
```typescript
if (march.state === 'retreating') {
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = '#888888';
} else {
    // intercepted falls here -- no specific handling
    ctx.globalAlpha = 1.0;
    ctx.fillStyle = color; // faction color
}
```

---

### Challenge #5 (P1): Performance Benchmark #8 is Meaningless

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 |
|--------|--------------|-------------|-------------|
| R11-3 Benchmark 8 | "1000次fillRect < 1ms" verified | This test measures the time to call a mock function 1000 times in a loop. The mock `fillRect` is `(...a: any[]) => { calls.fillRect.push(a); }` -- it just pushes to an array. This benchmark measures array.push() overhead, not any actual rendering performance | No evidence that this benchmark has any correlation with real-world rendering performance |

**Evidence**:

Test at `/Users/gongdewei/work/projects/game-portal/src/components/idle/panels/map/__tests__/PixelWorldMap.perf.test.tsx` L539-548:
```typescript
it('纯Canvas API调用性能 — 1000次fillRect < 1ms', () => {
    const start = performance.now();
    for (let i = 0; i < 1000; i++) {
      mockCtx.fillRect(i, i, 10, 10); // Just calls the mock function
    }
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(1);
});
```

---

### Challenge #6 (P1): All Performance Claims Use Mock Canvas

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 |
|--------|--------------|-------------|-------------|
| R11-3 | "11 performance benchmarks" with thresholds like "单帧 < 16.67ms (60fps)" | The benchmarks explicitly state "使用mock canvas避免真实DOM渲染开销，测量的是纯逻辑+Canvas API调用的CPU时间". This means the 16.67ms threshold is testing CPU logic time on a mock, NOT actual rendering performance. Real rendering with actual Canvas API calls would be significantly slower | No benchmark with real DOM + real Canvas context. No comparison between mock and real performance |

---

### Challenge #7 (P1): MarchingSystem Tests Use Fully Mocked EventBus

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 |
|--------|--------------|-------------|-------------|
| R11-2 | "8 abnormal path scenarios for return march -- VERIFIED" | All 43 tests use `createMockDeps()` which provides `eventBus: { emit: vi.fn(), on: vi.fn(), off: vi.fn(), once: vi.fn() }`. The tests verify that `emit` was called with certain arguments, but never verify that any real listener processes these events correctly | No integration test connecting MarchingSystem's event emissions to actual consumers (e.g., a UI component that reacts to `march:cancelled`). No test verifies event payload structure matches what consumers expect |

---

### Challenge #8 (P2): No Test for activeMarches Emptying Path

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 |
|--------|--------------|-------------|-------------|
| R11-4 | 14 tests covering all layers and edge cases | No test covers the scenario where activeMarches goes from non-empty to empty and verifies that sprite cleanup actually happens. When marches are cleared, `renderMarchSpritesOverlay` at L1150 returns early (`if (!marches.length || !renderer || !canvas) return;`), so no "clearing" Canvas operations are performed -- old sprites remain on canvas until terrain layer redraws | Test verifying that old sprite pixels are actually cleared when marches are removed. Currently R11-15 in the sprite test only checks that faction colors are not present, but doesn't verify visual cleanup |

---

### Challenge #9 (P2): No End-to-End Flow Test for Canvas Rendering

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 |
|--------|--------------|-------------|-------------|
| R11-1 | "16 Canvas API call-level assertion tests" verified | All 16 tests + 17 I11 tests test the rendering output of a single `flushRAF()` cycle. None test the complete flow: user interaction -> state change -> React re-render -> useEffect triggers -> dirty flag set -> requestAnimationFrame -> animate() -> dirty check -> selective layer render -> Canvas output -> dirty flag reset | Integration test that verifies the complete pipeline from data change to visual output |

---

### Challenge #10 (P2): cancelMarch Creates "retreating" State But Never Actually Creates Return Animation

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 |
|--------|--------------|-------------|-------------|
| R11-2 | "canceling in marching/arrived/preparing states -> retreating + from active移除 + march:cancelled事件" verified | The cancel operation sets `state = 'retreating'` and immediately removes the march from the active map (`this.activeMarches.delete(marchId)`). The march is gone -- no return march is ever created, no retreating animation is ever played. The `retreating` state is ephemeral (set then immediately deleted). Tests verify the state on the object reference, but in practice this march is never rendered | Test verifying that after cancel, a return march is actually created and visible on the map |

**Evidence**:

Source L295-307:
```typescript
cancelMarch(marchId: string): void {
    const march = this.activeMarches.get(marchId);
    if (march) {
      march.state = 'retreating';     // Set state
      this.activeMarches.delete(marchId); // Immediately delete -- march is gone!
      this.deps.eventBus.emit('march:cancelled', { ... });
    }
}
```

---

### Challenge #11 (P2): `getDirtyFlagsForTest()` Uses Unsafe Global Reference

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 |
|--------|--------------|-------------|-------------|
| R11-4 | "getDirtyFlagsForTest() exported for test access to dirty flag state" | The function uses a module-level global `_testDirtyFlagsRef` that is overwritten each time a PixelWorldMap component mounts. If two components exist simultaneously (or if one unmounts and another mounts), the reference becomes stale or points to the wrong instance | Test with multiple PixelWorldMap instances verifying each has independent dirty flags |

**Evidence**:

Source L1725-1735:
```typescript
let _testDirtyFlagsRef: React.MutableRefObject<DirtyFlags> | null = null;

export function _setDirtyFlagsForTest(ref: React.MutableRefObject<DirtyFlags>) {
  _testDirtyFlagsRef = ref; // Overwrites previous reference
}

export function getDirtyFlagsForTest(): DirtyFlags | null {
  return _testDirtyFlagsRef?.current ?? null; // Returns whatever was last set
}
```

---

## Verification of Builder's Basic Claims

The following claims were independently verified and confirmed TRUE:

1. **Test counts**: 51 + 43 + 11 + 14 = 119 tests -- CONFIRMED (all passing)
2. **Full suite**: 378/378 across 18 files -- CONFIRMED
3. **Implementation exists**: `dirtyFlagsRef` at L667-915, `renderMarchSpritesOverlay` at L1146, `cancelMarch` at L295 -- CONFIRMED
4. **Test durations**: 49ms, 6ms, 85ms, 22ms -- ROUGHLY CONFIRMED (within 10% of claimed)
5. **Canvas mock mechanism**: Properly captures fillStyle/strokeStyle/globalAlpha values -- CONFIRMED
6. **Faction colors**: wei=#2196F3, shu=#4CAF50, wu=#F44336, neutral=#9E9E9E -- CONFIRMED in source

---

## Severity Classification

- **P0 (Critical)**: Test claims are factually wrong; if corrected assertions were added, tests would fail
- **P1 (Major)**: Tests pass but test the wrong thing or miss critical gaps; the "verified" status is misleading
- **P2 (Minor)**: Missing coverage for edge cases or integration scenarios; not blocking but indicates incomplete verification

---

Challenger完成, 11个有效质疑(其中P0:2, P1:5, P2:4)
