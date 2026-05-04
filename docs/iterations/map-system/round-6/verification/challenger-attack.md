# Round 6 Challenger Attack Report

**Date:** 2026-05-04
**Challenger Role:** Attack Builder's "ALL VERIFIED" conclusion
**Target:** `/docs/iterations/map-system/round-6/verification/builder-manifest.md`

---

## Executive Summary

Builder claims "ALL VERIFIED" with 66/66 tests passing and 5 files verified. While the tests do pass and the basic code structure is sound, I have identified **7 substantive defects** spanning event listener memory leaks, event data loss in automatic subscriptions, dead props with zero rendering, missing cleanup in component lifecycle, and a dormant but dangerous duplicate-animation race condition. Builder's verification was superficial -- it confirmed tests pass and imports exist but did not examine integration semantics.

---

## Attack Table

| 质疑ID | 攻击维度 | Builder的结论 | 为什么不可信 | 缺少什么证据 | 自评严重度 |
|--------|---------|-------------|------------|------------|-----------|
| C-01 | 事件订阅内存泄漏 | SiegeBattleAnimationSystem init() "正确订阅了battle:started和battle:completed" | `init()` 调用 `this.deps.eventBus.on(...)` 注册了两个匿名闭包，但类中 **没有任何 `off()` / `unsubscribe()` / `removeAllListeners()` 调用**。`reset()` 方法仅清除了 `animations` 和 `completedAtElapsedMs`，**完全没有取消事件监听**。在 WorldMapTab 的 `useEffect` cleanup 中(第646-650行)也没有取消这些订阅。每次 `init()` 被重复调用时，旧的匿名闭包仍然挂在 eventBus 上，造成监听器累积泄漏。 | 缺少证据：(1) 没有测试验证重复调用 init() 后旧监听器是否被清理；(2) 没有 test 验证 reset() 是否取消订阅；(3) 缺少对 SiegeBattleAnimationSystem 在组件卸载时清理路径的验证。 | **HIGH** |
| C-02 | 自动订阅丢失关键坐标数据 | "事件处理器是否正确解析参数" -- Builder声明ALL VERIFIED | `init()` 中 `battle:started` 事件的自动处理器(第181-191行)硬编码了 `targetX: 0, targetY: 0` 和 `faction: 'wei'`。`BattleStartedEvent` 接口(SiegeBattleSystem.ts 第101-108行)中 **不包含 targetX/targetY 字段**，因此从事件数据中获取这些值是不可能的。这意味着任何通过自动订阅创建的动画的坐标永远是 (0,0)，与实际城池位置无关。虽然 WorldMapTab 中手动调用 `startSiegeAnimation()` 时提供了正确坐标(第454-462行)，但如果 SiegeBattleSystem.emit('battle:started') 先于手动调用，`startSiegeAnimation` 中的 "duplicate taskId replacement" 逻辑会**用 (0,0) 坐标的动画覆盖掉**可能后续创建的正确坐标动画 -- 或者反过来，手动调用的正确坐标版本会覆盖自动订阅的版本。这构成了**竞态条件**。 | 缺少证据：(1) 没有测试验证自动订阅和手动调用之间的竞态交互；(2) 没有测试验证自动创建的动画坐标为(0,0)；(3) 缺少 BattleStartedEvent 扩展提案或 updateTargetPosition 调用路径。 | **HIGH** |
| C-03 | PixelWorldMap activeSiegeAnims 死prop | "E. PixelWorldMap props -- Verified (prop defined, passed, typed)" | PixelWorldMap.tsx 第42行定义了 `activeSiegeAnims?: SiegeAnimationState[]`，第252行在解构中接收了该prop，但**在整个组件的渲染逻辑中从未使用过**。搜索整个文件，`activeSiegeAnims` 仅出现在 prop 定义和解构中 -- 没有任何渲染代码读取它，没有任何 effect 依赖它，没有任何 ref 跟踪它。这意味着 WorldMapTab 第1151行传递的 `activeSiegeAnims={activeSiegeAnims}` 实际上是**完全无效的代码**，攻城战斗动画在地图上**不会有任何视觉表现**。 | 缺少证据：(1) 没有渲染验证测试证明动画在地图上可见；(2) 没有截图对比验证；(3) Builder 仅验证了 prop 存在但未验证它被使用。 | **MEDIUM** |
| C-04 | WorldMapTab 组件卸载清理不完整 | "D. WorldMapTab集成 -- Verified" | WorldMapTab.tsx 第646-650行的 cleanup 函数仅取消了 `cancelAnimationFrame`、`march:arrived` 和 `march:cancelled` 监听器。**但没有清理**：(1) SiegeBattleAnimationSystem 的 `battle:started` / `battle:completed` 事件订阅（虽然清理了 eventBus 引用本身，但如果 eventBus 是共享的，这些匿名闭包会泄漏）；(2) `siegeBattleAnimRef.current` 没有被置为 null；(3) `siegeBattleAnimSystem` 是 `useEffect` 闭包内的局部变量，cleanup 中没有引用。如果 `useEffect` 的依赖数组 `[]` 导致组件重新挂载，旧的 SiegeBattleAnimationSystem 实例及其事件监听器永远不会被回收。 | 缺少证据：(1) 没有测试验证组件卸载后旧事件监听器是否被移除；(2) 没有内存泄漏测试（如多次挂载/卸载后的监听器计数）。 | **MEDIUM** |
| C-05 | completedAtElapsedMs 反序列化依赖 totalElapsedMs 初始值 | "C. SiegeBattleAnimationSystem -- 39/39 passed, 序列化往返一致" | `deserialize()` 第474行设置 `this.completedAtElapsedMs.set(anim.taskId, this.totalElapsedMs)`。但此时 `totalElapsedMs` 刚在 `init()` 中被重置为 0（如果先调用了 init），或者在 `deserialize` 调用时可能仍然是旧值。关键问题是：反序列化后，`completed` 阶段的动画的 `completedAtElapsedMs` 被设为当前 `totalElapsedMs`（可能是 0），然后在 `update()` 中检查 `this.totalElapsedMs - completedElapsed >= completedLingerMs`。由于 `totalElapsedMs` 从反序列化时的值开始累加，而 `completedAtElapsedMs` 也从同一值开始，这意味着反序列化的 completed 动画**将在恰好 completedLingerMs(2s) 后被移除**，无论它们在存档时已经 linger 了多久。这可能不符合预期 -- 如果一个动画在存档时已经 linger 了 1.5s，反序列化后它应该只需再等 0.5s，但实际上会重新等待完整的 2s。 | 缺少证据：(1) 没有测试验证反序列化后 completed 动画在"已经 linger 部分时间"场景下的移除时机；(2) 序列化数据中没有保存 `completedAtElapsedMs` 的绝对时间点或剩余 linger 时间。 | **LOW** |
| C-06 | SiegeBattleAnimationSystem.init() 重复调用不幂等 | "C. 初始化 -- Basic init + custom config 通过" | `init()` 方法(第174-197行)每次调用都会通过 `this.deps.eventBus.on(...)` 注册**新的**匿名监听器，但不清除旧的。如果 `init()` 被调用 N 次，就会有 N 组 `battle:started` 和 `battle:completed` 监听器。每次 `battle:started` 事件会触发 N 次 `startSiegeAnimation()` 调用，虽然内部有 duplicate taskId 替换逻辑，但：(1) 每次 startSiegeAnimation 会 emit `siegeAnim:started` 事件，导致 N 次事件发射；(2) 多次 `completeSiegeAnimation` 调用中只有第一次有效（后续找不到 taskId），但仍然会产生多余的 event emit 尝试。虽然当前代码路径中 `init()` 只在 `useEffect` 初始化时调用一次，但类本身没有防护措施。 | 缺少证据：(1) 没有测试验证多次调用 init() 的行为；(2) init() 没有保存 unsubscribe 函数供后续清理。 | **LOW** |
| C-07 | SiegeBattleSystem 战斗完成后仍保留引用的语义不一致 | "B. SiegeBattleSystem -- 27/27 passed" | `update()` 方法中(第225行)，战斗完成时执行 `this.activeBattles.delete(taskId)`，这意味着 `getBattle()` 返回 null。但在 `createBattle()` 中返回的 `session` 对象仍然被外部持有引用。测试中（如第251-262行）在 `update()` 后检查 `battle` 变量，发现它已经是非 null 但带有更新后的 `victory`/`status`/`elapsedMs` 属性 -- 这是因为 session 对象在 delete 前已经被修改。然而，这种"删除 Map 条目但外部仍持有旧引用"的模式是脆弱的：如果 `update()` 在同一帧中处理多个战斗，且某个战斗的 session 被其他代码引用，那么该 session 的状态可能在 delete 后仍被读取，导致过时数据被使用。这不是bug但属于设计异味。 | 缺少证据：(1) 没有 integration test 验证多个并发战斗完成时外部引用的一致性；(2) 没有文档说明 session 引用在 delete 后的语义。 | **INFO** |

---

## Detailed Analysis

### C-01: Event Subscription Memory Leak (HIGH)

**Evidence from code:**

`/Users/gongdewei/work/projects/game-portal/src/games/three-kingdoms/engine/map/SiegeBattleAnimationSystem.ts` lines 174-197:

```typescript
init(deps: ISystemDeps): void {
    this.deps = deps;
    this.animations.clear();
    this.completedAtElapsedMs.clear();
    this.totalElapsedMs = 0;

    // These anonymous closures are NEVER unsubscribed:
    this.deps.eventBus.on<BattleStartedEvent>('battle:started', (data) => {
      this.startSiegeAnimation({...});
    });
    this.deps.eventBus.on<BattleCompletedEvent>('battle:completed', (data) => {
      this.completeSiegeAnimation(data.taskId, data.victory);
    });
}
```

Searched the entire file: zero calls to `eventBus.off()`, `removeAllListeners()`, or storing unsubscribe functions.

`reset()` (line 261-265) only clears `animations`, `completedAtElapsedMs`, and `totalElapsedMs` -- no event cleanup.

### C-02: Auto-subscription Coordinate Loss (HIGH)

**Evidence from code:**

`BattleStartedEvent` interface (SiegeBattleSystem.ts lines 101-108):
```typescript
export interface BattleStartedEvent {
  taskId: string;
  targetId: string;
  strategy: SiegeStrategyType;
  troops: number;
  maxDefense: number;
  estimatedDurationMs: number;
  // NO targetX, targetY, or faction fields
}
```

Auto-subscription handler (SiegeBattleAnimationSystem.ts lines 181-191):
```typescript
this.deps.eventBus.on<BattleStartedEvent>('battle:started', (data) => {
    this.startSiegeAnimation({
        taskId: data.taskId,
        targetCityId: data.targetId,
        targetX: 0,    // HARDCODED - no way to get from event
        targetY: 0,    // HARDCODED - no way to get from event
        strategy: data.strategy,
        faction: 'wei', // HARDCODED
        troops: data.troops,
    });
});
```

Meanwhile, in WorldMapTab.tsx lines 451-462, the manual call provides correct coordinates:
```typescript
animSystem.startSiegeAnimation({
    taskId: currentTask.id,
    targetCityId: currentTask.targetId,
    targetX: targetTerritory?.position.x ?? 0,
    targetY: targetTerritory?.position.y ?? 0,
    strategy: currentTask.strategy ?? 'forceAttack',
    faction: 'wei',
    troops: currentTask.expedition.troops,
});
```

Since `startSiegeAnimation` replaces duplicates (lines 289-292), the order of execution determines whether the final animation has correct or (0,0) coordinates. In WorldMapTab, the manual call happens inside `setTimeout(... , 0)` (line 438), while the auto-subscription triggers synchronously when `SiegeBattleSystem.createBattle()` emits `battle:started`. If a SiegeBattleSystem were used in WorldMapTab, the auto-subscription would fire first with (0,0), then the manual call would replace it with correct coords. But the current WorldMapTab does NOT use SiegeBattleSystem at all -- the auto-subscription is essentially dead code waiting to cause bugs when integrated.

### C-03: Dead Prop Rendering (MEDIUM)

**Evidence from code:**

PixelWorldMap.tsx:
- Line 42: `activeSiegeAnims?: SiegeAnimationState[];` -- prop defined
- Line 252: `activeSiegeAnims,` -- prop destructured
- After line 252: **zero references** to `activeSiegeAnims` in any rendering logic, effect, or callback

The entire rendering pipeline of PixelWorldMap consists of:
1. Base terrain rendering (`renderer.render()`)
2. Conquest animation overlay (`conquestAnimationSystem.render(...)`)
3. March route overlay (`renderMarchRouteOverlay()`)
4. March sprites overlay (`renderMarchSpritesOverlay()`)
5. Selection highlight (`renderSelectionHighlight()`)

None of these read `activeSiegeAnims`. The prop is accepted and silently discarded.

### C-04: Cleanup Incomplete (MEDIUM)

**Evidence from code:**

WorldMapTab.tsx cleanup (lines 646-650):
```typescript
return () => {
    cancelAnimationFrame(marchAnimRef.current);
    eventBus.off('march:arrived', handleArrived);
    eventBus.off('march:cancelled', handleCancelled);
    // Missing: siegeBattleAnimSystem event cleanup
    // Missing: siegeBattleAnimRef.current = null
};
```

Note that `siegeBattleAnimSystem` is a local variable inside the useEffect closure. The cleanup function does not reference it at all, meaning:
1. The SiegeBattleAnimationSystem instance's `battle:started` and `battle:completed` listeners remain on the `eventBus`
2. If the `eventBus` is a shared instance (it's created inline as a local `const eventBus` in this useEffect), it will be garbage-collected along with the closure -- BUT only if nothing else references it
3. The `siegeBattleAnimRef.current` is never set to null on cleanup, so the ref keeps a strong reference to the old system

### C-05: Deserialization Linger Time Reset (LOW)

The `completedAtElapsedMs` is set to `this.totalElapsedMs` at deserialization time. Since `totalElapsedMs` starts at 0 (or continues from the old system's value), a deserialized completed animation gets a "fresh" 2-second linger timer regardless of how long it had already been lingering before serialization. This is a minor fidelity loss but not a crash bug.

### C-06: Non-idempotent init() (LOW)

No guard against multiple `init()` calls accumulating event listeners. Currently safe because `init()` is called once, but the class design is not defensive.

### C-07: Session Reference After Delete (INFO)

Stale reference design pattern. Not a bug in current usage but a code smell.

---

## Verdict

| Category | Count |
|----------|-------|
| HIGH severity | 2 (C-01, C-02) |
| MEDIUM severity | 2 (C-03, C-04) |
| LOW severity | 2 (C-05, C-06) |
| INFO | 1 (C-07) |

**Builder's "ALL VERIFIED" conclusion is REJECTED.** The test suite (66/66 passing) only validates isolated unit behavior. It does not cover:
1. Event listener lifecycle (registration + cleanup)
2. Auto-subscription vs manual-call interaction
3. Prop rendering effectiveness in PixelWorldMap
4. Component unmount cleanup completeness
5. Serialization fidelity for partially-lingered animations

The code is **functionally correct in the happy path** but has structural defects that will manifest as bugs when the systems are more deeply integrated (e.g., when SiegeBattleSystem is actually used in the siege execution flow and emits events that trigger the auto-subscription with wrong coordinates).
