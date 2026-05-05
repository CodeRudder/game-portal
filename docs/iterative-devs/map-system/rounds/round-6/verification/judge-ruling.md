# Round 6 Judge Ruling

**Date:** 2026-05-04
**Judge:** Based on independent code-level evidence

---

## Key Contextual Findings

Before ruling on each attack, the Judge established the following facts by reading source code directly:

1. **WorldMapTab does NOT use SiegeBattleSystem.** A search of `WorldMapTab.tsx` for `SiegeBattleSystem`, `battle:started`, and `battle:completed` all return zero matches. The auto-subscription in `SiegeBattleAnimationSystem.init()` listens for events from `SiegeBattleSystem`, but that system is never instantiated or integrated in `WorldMapTab`. The siege execution flow uses the legacy `siegeSystem.executeSiege()` and manually calls `startSiegeAnimation()` / `completeSiegeAnimation()`.

2. **eventBus is a local closure variable.** In `WorldMapTab.tsx` lines 351-389, the `eventBus` is created inline inside a `useEffect` closure as a plain object with a `Map<string, Set<...>>` for listeners. It is not a shared global. When the component unmounts, the entire closure -- including the `listeners` Map and all registered handlers -- becomes eligible for garbage collection. No other code holds a reference to this `eventBus`.

3. **activeSiegeAnims is explicitly documented as future work.** In `PixelWorldMap.tsx` line 41, the prop comment reads: `/** 活跃攻城战斗动画列表 (I12, 用于未来的攻城动画渲染) */`. The phrase "for future siege animation rendering" is a deliberate design signal that rendering is deferred.

4. **startSiegeAnimation has duplicate-replacement semantics.** Lines 288-292 show that if an animation with the same `taskId` already exists, the old one is deleted and replaced. This means the last writer wins.

---

## Ruling Table

| 质疑ID | Challenger观点 | Builder补充 | Judge裁决 | 理由 | Judge严重度 |
|--------|--------------|------------|-----------|------|------------|
| C-01 | `init()` 注册事件监听但从不取消订阅，造成内存泄漏 | Builder未提供补充说明 | **OVERRULED -- 当前无实际风险** | (1) `eventBus` 是 `useEffect` 闭包内的局部变量(第351-389行)，不是全局共享实例。组件卸载时，闭包、`eventBus`、其内部 `listeners` Map 以及所有匿名回调函数形成孤立的引用环，无外部可达引用，将被 GC 正常回收。(2) 当前 `WorldMapTab` 中从未创建 `SiegeBattleSystem` 实例，`battle:started` / `battle:completed` 事件永远不会被 emit，因此这两个监听器注册后永远不会被触发。(3) 这是结构性缺陷（类设计缺少 `destroy()` / `dispose()` 方法），但在此使用场景下不构成实际泄漏。建议在未来迭代中为 `ISubsystem` 接口增加 `destroy()` 方法。 | **DEFERRED** (当前无影响，未来集成时需修复) |
| C-02 | 自动订阅 `battle:started` 时 `targetX/Y` 硬编码为 0，`faction` 硬编码为 `'wei'`，且 `BattleStartedEvent` 接口不含坐标字段 | Builder未提供补充说明 | **OVERRULED -- 当前为死代码** | (1) `WorldMapTab.tsx` 中搜索 `SiegeBattleSystem` 和 `battle:started` 均为零匹配，确认 `SiegeBattleSystem` 未被集成。自动订阅处理器当前永远不会被触发。(2) 当手动调用 `startSiegeAnimation()` 时(第454行)，提供了正确的坐标 `targetTerritory?.position.x ?? 0`，这些坐标是准确的。(3) Challenger提出的竞态条件（自动订阅先触发(0,0)然后手动覆盖正确坐标）在当前代码中不可能发生，因为没有 `SiegeBattleSystem` 实例 emit 事件。(4) 然而，`BattleStartedEvent` 确实缺少 `targetX`/`targetY`/`faction` 字段，这是一个接口设计缺陷。当未来集成 `SiegeBattleSystem` 时，需要扩展 `BattleStartedEvent` 或在自动处理器中调用 `updateTargetPosition()`。 | **DEFERRED** (接口缺陷已确认，但当前无运行时影响) |
| C-03 | `PixelWorldMap` 接收 `activeSiegeAnims` prop 但从未在渲染中使用 | Builder未提供补充说明 | **OVERRULED -- 这是按设计决策的占位** | (1) `PixelWorldMap.tsx` 第41行 prop 注释明确写道 "用于未来的攻城动画渲染"，这是有意为之的 forward-declaration。(2) I12 spec 的定位是"动画状态管理系统"，职责是管理动画状态机（assembly -> battle -> completed 生命周期），渲染层通过 `getActiveAnimations()` 获取数据后自行绘制。prop 的传递管道已打通（WorldMapTab 第1151行 -> PixelWorldMap 解构），是合理的迭代式开发策略。(3) 并非 bug 或遗漏，而是迭代规划的一部分。 | **NOT A DEFECT** (按设计，已标注为未来工作) |
| C-04 | `WorldMapTab` cleanup 未清理 `SiegeBattleAnimationSystem` 的事件订阅 | Builder未提供补充说明 | **OVERRULED -- GC 正常回收** | (1) `eventBus` 是 `useEffect` 闭包的局部变量(第351行)，`siegeBattleAnimSystem` 也是同一闭包的局部变量(第398行)。cleanup 函数(第646-650行)虽然没有显式移除 `battle:started`/`battle:completed` 监听器，但组件卸载后整个闭包形成孤立引用环，无外部可达路径，将被 GC 回收。(2) `siegeBattleAnimRef.current` 未被置 null 是一个轻微的代码质量问题（ref 会持有旧实例直到下次赋值或组件完全销毁），但不构成内存泄漏，因为 ref 本身也是组件实例的一部分，组件卸载时一并被回收。(3) 严格来说，显式清理是更好的实践，但在当前局部 eventBus 架构下无实际危害。 | **LOW** (代码质量改进建议，非运行时缺陷) |
| C-05 | 反序列化 `completed` 动画的 linger 时间被重置 | Builder未提供补充说明 | **SUSTAINED -- 确实存在但不严重** | (1) `deserialize()` 第474行设置 `completedAtElapsedMs` 为 `this.totalElapsedMs`。如果 `init()` 先被调用，`totalElapsedMs` 被重置为 0，反序列化的 completed 动画的 linger 倒计时从 0 开始计算，而非从序列化时已消耗的时间继续。这意味着无论动画在序列化前已经 linger 了多久，反序列化后都会重新等待完整的 `completedLingerMs`(2s)。(2) 这是一个保真度损失但不是崩溃 bug。2秒的 linger 时间差异对玩家体验影响极小。(3) 序列化数据中没有保存 `completedAtElapsedMs` 的绝对时间或已消耗的 linger 时间，这是序列化格式的一个 gap。 | **LOW** (序列化保真度缺陷，2s 延迟，影响极小) |
| C-06 | `init()` 不幂等，多次调用累积事件监听器 | Builder未提供补充说明 | **SUSTAINED -- 结构性缺陷但当前无触发条件** | (1) 确认 `init()` 每次调用都注册新的匿名监听器而无去重或清理。理论上多次调用会累积 N 组监听器。(2) 在当前 `WorldMapTab` 中，`useEffect` 的依赖数组为 `[]`，`init()` 只执行一次，不会重复调用。(3) 但作为引擎层公共 API，缺少幂等保护是设计缺陷。建议添加 `if (this.deps) return;` 守卫或存储 unsubscribe 函数。 | **LOW** (API 设计缺陷，当前调用路径安全) |
| C-07 | `SiegeBattleSystem` delete 后外部仍持有 session 引用 | Builder未提供补充说明 | **OVERRULED -- 常见且有文档的模式** | (1) `Map.delete()` 后，session 对象作为引用类型，外部变量仍然指向原对象。这是 JavaScript 的基础语义。(2) 在 `update()` 中，session 在 delete 前已完成 `victory`/`status`/`elapsedMs` 的赋值(第221-225行)，因此外部引用读取到的是最终状态，不存在"过时数据"问题。delete 只是从 Map 中移除条目，不修改对象本身。(3) 这种"返回值 + 自动清理"模式在游戏引擎中很常见。session 引用在 delete 后是 immutable snapshot，语义是清晰的。 | **NOT A DEFECT** (正常的 JavaScript 引用语义) |

---

## Summary Verdict

| Challenger严重度 | 质疑ID | Judge裁决 | Judge严重度 |
|-----------------|--------|-----------|------------|
| HIGH | C-01 | OVERRULED | DEFERRED (未来需修复类设计) |
| HIGH | C-02 | OVERRULED | DEFERRED (接口缺陷，当前为死代码) |
| MEDIUM | C-03 | OVERRULED | NOT A DEFECT (按设计的占位) |
| MEDIUM | C-04 | OVERRULED | LOW (GC 安全，建议显式清理) |
| LOW | C-05 | SUSTAINED | LOW (序列化保真度损失) |
| LOW | C-06 | SUSTAINED | LOW (API 设计缺陷) |
| INFO | C-07 | OVERRULED | NOT A DEFECT |

### Overall Assessment

**Builder 的 "ALL VERIFIED" 结论基本成立。** 66/66 测试通过，5个文件的导入/集成/类型验证均正确。Challenger 提出的 7 个攻击中：

- **2 个 HIGH 被降级为 DEFERRED**：C-01 和 C-02 指出的类设计问题确实存在（缺少 `destroy()` 方法、`BattleStartedEvent` 缺少坐标字段），但由于 `WorldMapTab` 中 `eventBus` 是局部变量且 `SiegeBattleSystem` 未被集成，当前无运行时影响。这些是**技术债务**，应在 `SiegeBattleSystem` 正式集成到 `WorldMapTab` 之前修复。
- **2 个 MEDIUM 被降级**：C-03 是按设计的 forward declaration；C-04 在局部 eventBus 架构下 GC 安全。
- **2 个 LOW 维持**：C-05 序列化保真度损失和 C-06 幂等性缺失是真实的代码质量缺陷，但不影响当前功能。
- **1 个 INFO 被驳回**：C-07 是正常的 JS 引用语义，不是缺陷。

### Action Items for Future Iterations

1. **为 `ISubsystem` 增加 `destroy()` 方法**：清理事件监听、释放资源。在 `SiegeBattleAnimationSystem.destroy()` 中调用 `eventBus.off()` 取消注册。
2. **扩展 `BattleStartedEvent`**：添加 `targetX`, `targetY`, `faction` 字段，或在自动处理器中使用 `updateTargetPosition()` 从 `targetId` 查找坐标。
3. **为 `init()` 添加幂等守卫**：防止重复调用累积监听器。
4. **序列化格式优化**：保存 `completedAtElapsedMs` 的绝对值或剩余 linger 时间，避免反序列化后 linger 重置。

---

**Ruling: BUILD PASS (with 2 LOW defects and 2 DEFERRED technical debt items)**
