# R15 Challenger Attack Report

**Date**: 2026-05-04
**Role**: Challenger
**Target**: R15 Builder Manifest -- 攻城渲染流水线修复 (黑屏/时序/死代码)

---

## Attack Summary

| Severity | Count |
|----------|-------|
| P0 (Critical -- user-facing bug or untested core path) | 3 |
| P1 (Important -- correctness/risk concern) | 4 |
| P2 (Minor -- test quality/cosmetic) | 3 |
| **Total valid challenges** | **10** |

---

## Challenge Summary Table

| # | Challenge | Severity | Builder Claim | Why Unreliable | Missing Evidence |
|---|-----------|----------|---------------|----------------|------------------|
| 1.1 | PixelMapRenderer.render() still calls clearRect(0,0,w,h) | P1 | 移除clearRect修复黑屏 | 移除的是overlay层clearRect，但renderer.render()在line 288仍调用clearRect全清canvas。this.map为null时early return，canvas可能留黑 | 需证明this.map在所有路径中非null |
| 1.2 | 性能退化 -- 每帧全量重绘terrain | P1 | 修复正确 | 只要存在active conquest/march/siegeAnim，每帧都设置sprites+effects+terrain三个dirty flag，抵消了分层渲染优化 | 需要性能基准测试和帧率对比 |
| 2.1 | completeSiegeAnimation在animation不存在时静默返回，测试mock绕过生产路径 | P0 | 6/6测试通过验证了时序修复 | Mock的SiegeBattleAnimationSystem不监听battle:started，startSiegeAnimation从未被调用，completeSiegeAnimation因animations Map为空而silent return，siegeAnim:completed从未由生产代码路径发出 | 需要端到端测试验证createBattle->battle:started->startSiegeAnimation->completeSiegeAnimation->siegeAnim:completed链路 |
| 2.2 | EventBus.once并发缺陷 -- 两个攻城互相吃掉监听器 | P0 | 时序修复完成 | EventBus.emit执行onceHandlers.delete(event)删除所有once监听器。两个并发攻城时，第一个completeSiegeAnimation发出的event会清除第二个攻城的once listener | 需要并发攻城测试 |
| 2.3 | pendingSiegeResultRef永不清除为null | P1 | ref正确管理 | pendingSiegeResultRef.current被赋值但从未被设为null。grep确认"pendingSiegeResultRef.current = null"在WorldMapTab.tsx中0 matches | 需说明lifecycle设计意图 |
| 2.4 | 卸载时eventBus.once listener未显式移除 | P1 | 卸载时清理了listeners | cleanup只清除timeout，未调用eventBus.off移除未触发的once listener。stale listener可能残留 | 需证据stale listener不影响后续行为 |
| 3.1 | 快速双攻城timeout覆盖竞态 | P0 | refs正确管理 | 第二次攻城直接覆盖siegeAnimTimeoutRef.current为新timeout，未clearTimeout旧的。旧timeout仍会fire，setSiegeResultVisible(true)使用过时的siegeResultData | 需要双攻城集成测试 |
| 4.1 | SettlementPipeline casualties映射链的defensive ??暗示潜在undefined | P2 | 映射链完整 | WorldMapTab.tsx line 632-638使用??空值合并构造CasualtyResult，暗示casualties可能为undefined | 已验证defeat路径calculate阶段执行，降级为P2 |
| 5.1 | siege-animation-sequencing测试未覆盖生产事件发出路径 | P0(重复2.1) | 6个测试覆盖关键场景 | 所有测试通过手动capturedEventBus.emit绕过completeSiegeAnimation，核心集成路径未测试 | 需端到端集成测试 |
| 5.2 | terrain-persist测试只验证mockCtx.fillRect调用次数 | P2 | 测试验证了黑屏修复 | 只检查fillRect.calls.length > 0，不验证canvas实际像素内容、坐标、颜色 | 需像素级验证或参数验证 |
| 5.3 | 断言过于宽松 -- toBeTruthy()无语义 | P2 | 测试断言充分 | getByTestId找不到元素会throw，toBeTruthy()断言冗余；不能区分modal visible和modal exists with wrong content | 需更强语义断言 |

---

## Detailed Attacks

### Attack 1.1 (P1): PixelMapRenderer.render() still calls clearRect(0,0,w,h) -- terrain is redrawn, not preserved

**Builder Claim**: Black screen fixed by removing clearRect from renderMarchSpritesOverlay.

**Why Unreliable**:

The removed clearRect was in the overlay layer. However, `PixelMapRenderer.render()` at `/Users/gongdewei/work/projects/game-portal/src/games/three-kingdoms/engine/map/PixelMapRenderer.ts` line 284-288:

```typescript
render(): void {
    if (!this.map) return;  // <-- early return without drawing anything
    this.frameCount++;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);  // <-- full clear
    this.renderTerrain();  // then redraws
    // ...
}
```

Every time terrain dirty flag is set (which R15 forces on every frame during active animations), `renderer.render()` clears the entire canvas then redraws. If `this.map` is null during a reload or parse failure, the function returns immediately after the guard -- but the issue is whether the canvas was already cleared by a previous frame's clearRect.

The fix is architecturally correct: terrain IS redrawn when dirty. But the Builder did not address the `this.map == null` guard condition, nor did they acknowledge that the fix trades black-screen correctness for full-frame redraws every frame.

**Missing Evidence**:
- Proof that `this.map` is always non-null during the component lifecycle
- Performance impact analysis of full-frame redraws

---

### Attack 1.2 (P1): Performance Regression -- Every Frame Full Terrain Redraw

**Builder Claim**: Fix is correct.

**Why Unreliable**:

Code in `PixelWorldMap.tsx` lines 1049-1058:
```typescript
if (hasActiveConquest || hasActiveMarches || hasActiveSiegeAnims) {
  flags.sprites = true;
  flags.effects = true;
}
// R15 Task1: Force terrain redraw when overlays change
if (flags.sprites || flags.effects) {
  flags.terrain = true;
}
```

During any active animation:
1. `flags.sprites = true` and `flags.effects = true` are set every frame
2. `flags.terrain = true` is therefore set every frame
3. `renderer.render()` is called every frame (line 1069)

This means **during active animations, terrain degrades from "only redraw when changed" to "redraw every frame"**. For a 100x60 grid map, this is a significant performance regression that completely negates the layered rendering optimization.

A better fix would mark terrain dirty only on the transition frame (sprites going from true to false), not continuously.

**Missing Evidence**:
- Performance benchmarks (before vs after FPS)
- Frame time analysis
- Consideration of transition-frame-only marking

---

### Attack 2.1 (P0): completeSiegeAnimation Silently Returns -- Test Mock Bypasses Production Path

**Builder Claim**: 6/6 tests pass, animation timing fix verified.

**Why Unreliable**:

This is the most critical finding.

In `siege-animation-sequencing.test.tsx`, the Mock `SiegeBattleAnimationSystem` (lines 236-270):

```typescript
SiegeBattleAnimationSystem: class MockSiegeBattleAnimationSystem {
  private animations: Map<string, any> = new Map();
  init(deps: any) { capturedEventBus = deps?.eventBus; }
  // NOTE: init does NOT register battle:started listener!

  completeSiegeAnimation(taskId: string, victory: boolean) {
    const anim = this.animations.get(taskId);
    if (!anim) return;  // <-- animations Map is ALWAYS empty
    // ... emit siegeAnim:completed (never reached)
  }
}
```

Problem chain:
1. Mock's `init()` does NOT listen for `battle:started` (compare real implementation at `SiegeBattleAnimationSystem.ts` line 202-212 which does)
2. Mock's `SiegeBattleSystem.createBattle()` DOES emit `battle:started` (test mock line 200-212)
3. But no one listens for it in the mock animation system, so `startSiegeAnimation()` is NEVER called
4. `this.animations` Map remains empty
5. When `WorldMapTab.tsx` line 732 calls `siegeAnimSystem.completeSiegeAnimation(currentTask.id, siegeResult.victory)`, the mock hits `if (!anim) return` and returns immediately
6. `siegeAnim:completed` is NEVER emitted by the production code path

**Impact on tests**:
- Test 1 (line 533): Modal not visible -- passes because completeSiegeAnimation is a no-op, event never fires
- Test 2 (line 551): **Manually emits** `siegeAnim:completed` via `capturedEventBus.emit(...)` -- bypasses production completeSiegeAnimation entirely
- Test 3 (line 580): Same manual emit
- Test 4 (line 607): Tests 5s fallback -- actually tests the failure path of completeSiegeAnimation
- Test 5 (line 632): Manual emit with wrong taskId -- tests a scenario that cannot occur in production
- Test 6 (line 658): Tests cleanup -- valid

**The critical production path is completely untested**: `createBattle -> battle:started -> startSiegeAnimation -> completeSiegeAnimation -> siegeAnim:completed -> setSiegeResultVisible(true)`.

**Missing Evidence**:
- Any test that verifies `completeSiegeAnimation` produces `siegeAnim:completed` when the animation was properly created via `startSiegeAnimation`
- Integration test with real `SiegeBattleAnimationSystem`

---

### Attack 2.2 (P0): EventBus.once Concurrent Defect -- Two Sieges Eat Each Other's Listeners

**Builder Claim**: Timing fix complete.

**Why Unreliable**:

`EventBus.ts` emit implementation (lines 84-88):
```typescript
const onceSet = this.onceHandlers.get(event);
if (onceSet) {
  this.invokeSet(onceSet, p);      // invokes ALL handlers for this event
  this.onceHandlers.delete(event); // deletes ALL once handlers for this event
}
```

When `siegeAnim:completed` is emitted, `this.onceHandlers.delete(event)` removes ALL registered once handlers for that event name.

Concurrent scenario:
1. Siege A arrives -> `eventBus.once('siegeAnim:completed', handlerA)` registered
2. Siege B arrives -> `eventBus.once('siegeAnim:completed', handlerB)` registered
3. Siege A's `completeSiegeAnimation` emits `siegeAnim:completed` (taskId=A)
4. EventBus invokes handlerA (taskId=A matches) -> modal A shows
5. EventBus invokes handlerB (taskId=A doesn't match) -> handlerB does nothing, BUT:
6. `this.onceHandlers.delete('siegeAnim:completed')` removes BOTH handlerA and handlerB
7. Siege B's `completeSiegeAnimation` emits `siegeAnim:completed` (taskId=B)
8. handlerB was already deleted -> **modal B never shows** (only 5s fallback)

Even in the reverse order (B completes first), the same problem occurs: the first `siegeAnim:completed` event destroys both handlers.

**Missing Evidence**:
- Concurrent/double siege test
- Consideration of using `eventBus.on` + manual `off` instead of `once`

---

### Attack 2.3 (P1): pendingSiegeResultRef.current Never Reset to null

**Builder Claim**: Refs correctly managed.

**Why Unreliable**:

`pendingSiegeResultRef.current` is set at line 704 but **never set to null** anywhere in WorldMapTab.tsx. Grep confirms: `pendingSiegeResultRef.current = null` has **0 matches** in the entire file.

This means the ref permanently holds the last siege result data, even after the modal is closed. If any code depends on `pendingSiegeResultRef.current === null` to determine "no pending result", it will produce logic errors.

**Missing Evidence**:
- Explanation of lifecycle design intent
- Audit of all consumers of pendingSiegeResultRef

---

### Attack 2.4 (P1): Unmount Does Not Remove Stale eventBus.once Listener

**Builder Claim**: Cleanup removes pending siege animation listeners on unmount.

**Why Unreliable**:

Cleanup code (lines 852-858):
```typescript
return () => {
  cancelAnimationFrame(marchAnimRef.current);
  if (siegeAnimTimeoutRef.current) {
    clearTimeout(siegeAnimTimeoutRef.current);
    siegeAnimTimeoutRef.current = null;
  }
  // NOTE: no eventBus.off('siegeAnim:completed', animHandler) !
  siegeBattleSystem.destroy();
  siegeBattleAnimSystem.destroy();
  // ...
};
```

The cleanup clears the timeout but does NOT call `eventBus.off('siegeAnim:completed', animHandler)`. The `animHandler` is a closure-scoped variable that the cleanup function cannot access.

If the component unmounts after `eventBus.once('siegeAnim:completed', animHandler)` was registered (line 718) but before the event fires:
1. Timeout is cleared -> OK
2. The once listener remains on the shared eventBus
3. Later, another siege triggers `siegeAnim:completed` -> stale handler fires `setSiegeResultVisible(true)` on an unmounted component

React 18 no longer warns about this, but it is still a resource leak.

**Missing Evidence**:
- Evidence that stale once listeners don't cause issues in subsequent component mounts
- Refactor to use a ref for the handler so cleanup can call eventBus.off

---

### Attack 3.1 (P0): Rapid Double-Siege Timeout Overwrite Race Condition

**Builder Claim**: Refs correctly managed.

**Why Unreliable**:

When two sieges arrive in rapid succession (within the same setTimeout(0) batch or two consecutive rAF frames), the second siege execution at line 704-725 overwrites `siegeAnimTimeoutRef.current` with a new timeout **without clearing the old one first**.

```typescript
// Siege 1 execution:
pendingSiegeResultRef.current = siegeResultData_1;  // set data 1
siegeAnimTimeoutRef.current = setTimeout(fallback_1, 5000);  // timeout 1

// Siege 2 execution (before siege 1's event fires):
pendingSiegeResultRef.current = siegeResultData_2;  // overwrite with data 2
siegeAnimTimeoutRef.current = setTimeout(fallback_2, 5000);  // overwrite timeout ref
// timeout_1 is still scheduled! its ref is lost!
```

Problem:
1. `siegeAnimTimeoutRef.current` is overwritten, losing the reference to timeout_1
2. timeout_1 still fires after 5s, calling `setSiegeResultVisible(true)`
3. At this point, `siegeResultData` state has been overwritten with siege 2's data
4. The modal shows siege 2's data prematurely (before siege 2's animation completes)

Combined with Attack 2.2 (once listener deletion), this means:
- Siege 1's modal may show with wrong data (if timeout_1 fires)
- Siege 2's modal may never show (once listener deleted by siege 1's event)

**Missing Evidence**:
- Double-siege integration test
- Guard to clearTimeout before overwriting siegeAnimTimeoutRef.current

---

### Attack 4.1 (P2): Casualties Mapping Chain -- Defensive ?? Operators

**Builder Claim**: Mapping chain complete.

**Why Unreliable**:

`WorldMapTab.tsx` lines 632-638:
```typescript
const casualties: CasualtyResult = {
  troopsLost: settlement.casualties?.troopsLost ?? 0,
  troopsLostPercent: settlement.casualties?.troopsLostPercent ?? 0,
  heroInjured: settlement.casualties?.heroInjured ?? false,
  injuryLevel: settlement.casualties?.injuryLevel ?? 'none',
  battleResult: siegeResult.victory ? 'victory' : 'defeat',
};
```

The defensive `??` operators suggest the Builder was aware that `settlement.casualties` could be undefined. In `SettlementPipeline.execute()`, the `calculate` phase fills casualties for both victory and defeat paths. However, if the pipeline's validate phase fails and returns early, `settlement.casualties` would be undefined.

Verified: `PATH_PHASE_CONFIG['defeat'].calculate = true`, so defeat path does calculate casualties. The `??` fallbacks are safe. Downgraded to P2.

---

### Attack 5.1 (P0 -- same as 2.1): Tests Bypass Production completeSiegeAnimation Path

**Builder Claim**: 6 tests cover key scenarios.

**Why Unreliable**:

All 6 tests use a Mock `SiegeBattleAnimationSystem` that never creates animations (because it doesn't listen for `battle:started`). The tests then manually emit `siegeAnim:completed` via `capturedEventBus.emit(...)`. This means:

- The production code path `WorldMapTab.tsx line 732 -> completeSiegeAnimation -> eventBus.emit('siegeAnim:completed')` is **never exercised**
- The tests verify only the listener side (eventBus.once handler -> setSiegeResultVisible), not the emitter side
- If the real `completeSiegeAnimation` had a bug that prevented event emission, these tests would not catch it

**Missing Evidence**:
- Integration test with real `SiegeBattleAnimationSystem` and real `SiegeBattleSystem`
- Test that verifies the full chain from `createBattle` to `siegeAnim:completed` to modal display

---

### Attack 5.2 (P2): Terrain Persist Tests Only Verify Mock Call Counts

**Builder Claim**: 6/6 terrain persist tests pass, verifying black screen fix.

**Why Unreliable**:

All terrain persist tests use assertions like:
```typescript
expect(mockCtx.fillRect.mock.calls.length).toBeGreaterThan(0);
```

This only checks that `fillRect` was called at least once. It does NOT verify:
- What coordinates were drawn to (are they the correct terrain tiles?)
- What colors were used (are they the correct terrain colors?)
- Whether the terrain tiles cover the entire visible canvas area
- Whether a `clearRect` was called before the `fillRect` in the same frame (which would mean the canvas is first cleared then redrawn, which is what `PixelMapRenderer.render()` does)

The tests verify that *something* is drawn, not that the *correct thing* is drawn.

**Missing Evidence**:
- Pixel-level canvas verification using `getImageData`
- Verification of fillRect call parameters (coordinates, colors)
- Snapshot or visual regression test

---

### Attack 5.3 (P2): Weak Assertions -- toBeTruthy() Has No Semantic Value

**Builder Claim**: Test assertions are sufficient.

**Why Unreliable**:

Multiple tests use:
```typescript
expect(screen.getByTestId('mock-siege-result-modal')).toBeTruthy();
```

`getByTestId` throws if the element is not found, so `toBeTruthy()` is redundant -- if execution reaches this line, the element exists. This assertion cannot distinguish between "modal is visible with correct content" and "modal exists but has wrong content".

**Missing Evidence**:
- Assertions that check modal content (victory/defeat text, target name)
- Assertions that check visibility state rather than DOM existence

---

## Final Verdict

| Task | Builder Claim | Challenger Verdict | Reason |
|------|---------------|-------------------|--------|
| Task 1 (P0 Black Screen) | Fix complete | **Conditionally valid** | Code implementation correct, but performance regression risk unassessed. Fix is a "sledgehammer" approach. |
| Task 2 (P0 Animation Timing) | Fix complete | **NOT trustworthy** | Mock断裂导致核心路径未被测试 (Attack 2.1/5.1), 并发缺陷存在真实P0 Bug (Attack 2.2), timeout覆盖竞态 (Attack 3.1) |
| Task 3 (P1 Dead Code) | Confirmed | **Valid** | Grep verification sufficient, conclusion correct. |

**Critical Findings Count**:
- P0: 3 (Attack 2.1/5.1 Mock断裂, Attack 2.2 并发once listener删除, Attack 3.1 双攻城timeout竞态)
- P1: 4 (Attack 1.1 clearRect仍存在, Attack 1.2 性能退化, Attack 2.3 ref不清除, Attack 2.4 卸载泄漏)
- P2: 3 (Attack 4.1 映射链, Attack 5.2 mock调用验证, Attack 5.3 弱断言)

**Builder Final Score: Of 3 tasks, only 1 is fully trustworthy (Task 3), 1 is conditionally valid (Task 1), and 1 is NOT trustworthy (Task 2) due to both an untested core path and a real concurrent P0 bug.**

Challenger完成, 10个有效质疑(其中P0:3, P1:4)
