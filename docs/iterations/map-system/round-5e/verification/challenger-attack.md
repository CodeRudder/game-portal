# Round 5e Phase 1 — Challenger Attack Report

**Date:** 2026-05-04
**Challenger:** Automated Adversarial Audit
**Target:** Builder Manifest (6/6 PASS)

---

## Executive Summary

Builder 声称 6/6 PASS，经逐行源码审查，发现 **3 个 PASS 结论存在实质缺陷**，**2 个 PASS 结论虽基本成立但存在隐患**。总体评估：**3 FAIL, 2 WARNING, 1 PASS**。

---

## Attack 1: P2-01 emit 泛型参数 — 签名兼容性漏洞

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 | 严重度 |
|--------|-------------|------------|------------|--------|
| emit 泛型参数编译验证 | 4处 emit 均使用显式泛型 — PASS | 测试中 eventBus.emit 被 `vi.fn()` mock，`toHaveBeenCalledWith` 只验证运行时调用参数，**完全不验证 TypeScript 泛型参数的正确性**。泛型参数在编译后被擦除，运行时测试无法覆盖。 | 缺少 `tsc --noEmit` 编译输出证据，或 `expect-type` 级别的类型断言测试 | **MEDIUM** |

### 详细分析

Builder 引用的测试代码（`MarchingSystem.test.ts` L10-17）：

```typescript
eventBus: {
  emit: vi.fn(),
  // ...
} as unknown as ISystemDeps;
```

`vi.fn()` 创建的是一个 `(event: string, payload: any) => void` 类型的 mock。测试用 `toHaveBeenCalledWith` 只检查运行时调用参数的值匹配，**完全无法验证 `emit<MarchArrivedPayload>` 泛型参数是否与 payload 实际类型一致**。泛型参数是编译时概念，运行时被擦除。

**证据来源：**
- `MarchingSystem.test.ts` L210: `expect(deps.eventBus.emit).toHaveBeenCalledWith('march:arrived', expect.objectContaining({...}))` — 纯值断言
- `MarchingSystem.test.ts` L226: 同上模式

**实际代码审查结论：** 源码 `MarchingSystem.ts` L201-207 中 emit 的 payload 对象字段确实与 `MarchArrivedPayload` 接口一致（marchId, cityId, troops, general, siegeTaskId），所以编译时应无错误。但 Builder 的测试证据不足以支撑此结论。

---

## Attack 2: P2-02 eventBus 类型化 — emit 签名不兼容 + 运行时 undefined payload

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 | 严重度 |
|--------|-------------|------------|------------|--------|
| `as IEventBus` 类型安全 | `as IEventBus` 替换完成 — PASS | `IEventBus.emit` 签名为 `emit<T = unknown>(event: string, payload: T): void`，要求 **payload 必传**。但 WorldMapTab 内联 eventBus 的 emit 签名为 `emit: (event: string, payload?: any) => void`，payload 为 **可选参数**。`as IEventBus` 强制断言掩盖了签名不匹配，运行时当 `MarchingSystem.emit('march:arrived', {...})` 传入 payload 时无问题，但如果未来有 `emit('some:event')` 不传 payload 的调用，内联实现不会报错但 `IEventBus` 接口语义要求传 payload。 | 缺少 TypeScript 严格编译检查证据（`strictNullChecks` 下 `as IEventBus` 是否有隐式 any 或签名不匹配警告） | **HIGH** |

### 详细分析

对比两个 emit 签名：

**IEventBus 接口（`events.ts` L88）：**
```typescript
emit<T = unknown>(event: string, payload: T): void;
// payload 是必传参数
```

**WorldMapTab 内联实现（`WorldMapTab.tsx` L348）：**
```typescript
emit: (event: string, payload?: any) => {
// payload 是可选参数（?）
```

这是一个 **结构性不兼容**。`IEventBus.emit` 声明 payload 必传，内联实现声明 payload 可选。`as IEventBus` 强制断言绕过了 TypeScript 的结构类型检查。

**潜在运行时影响：** 当调用方传入 payload 时（如 `march:arrived`），由于内联实现内部用 `payload?: any` 接收，handler 收到的 payload 就是传入值，无实际问题。但签名不匹配意味着 TypeScript 无法在未来防止遗漏 payload 的调用。

此外，内联 eventBus 的 `on`/`off` 方法签名使用 `(payload: any) => void`，而 `IEventBus` 使用泛型 `(payload: T) => void`。虽然通过 `as IEventBus` 强制断言可以编译，但运行时无类型安全保障。

---

## Attack 3: P1-01 handleCancelled 清理 — 回城行军竞态条件

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 | 严重度 |
|--------|-------------|------------|------------|--------|
| handleCancelled cleanup 完整性 | cleanup 包含 off 调用 — PASS | cleanup 正确，但 `handleArrived` 中 L556-560 的回城完成逻辑与 `handleCancelled` 存在竞态窗口。setTimeout(0) 内的 siege 执行期间，如果用户触发 `cancelMarch`，`handleCancelled` 会将任务设为 completed 并清理，但 setTimeout(0) 回调已经捕获了 `taskId`，会在下一个微任务中再次执行 siege 逻辑。虽然有 `currentTask.result` 守卫，但 `handleCancelled` 在 `setResult` 后立即调用 `advanceStatus('completed')` + `removeCompletedTasks()`，此时 setTimeout 回调中的 `getTask(taskId)` 返回 null，导致 `setActiveSiegeTasks` 和 `setSiegeResultVisible` 状态不一致。 | 缺少并发场景测试：行军到达后 setTimeout(0) 触发前用户取消行军的 e2e 测试 | **MEDIUM** |

### 详细分析

时序问题：

```
T0: march:arrived 触发 → handleArrived 同步执行
T0+: 捕获 associatedTask.id → taskId
T0+: setTimeout(cb, 0) 注册到任务队列
T1: 用户快速操作（或另一个 rAF 循环触发 cancelMarch）
T1+: handleCancelled 同步执行 → setResult → advanceStatus('completed') → removeCompletedTasks()
T2: setTimeout 回调执行 → getTask(taskId) 返回 null → return（守卫生效）
```

守卫确实防止了重复 siege 执行。但问题在于 L538 的 `setActiveSiegeTasks(siegeTaskManager.getActiveTasks())` 在 setTimeout 回调中始终执行（L538 在 if 块外部），而 `handleCancelled` 也调用了 `setActiveSiegeTasks`（L590）。这导致 React 状态被连续设置两次，但第二次（来自 setTimeout）使用的是旧快照，可能覆盖 `handleCancelled` 的正确状态。

**注意：** 仔细审查发现 L538 的 `setActiveSiegeTasks` 确实在 setTimeout 回调末尾、if 块外部，因此**无论守卫是否 return，都会执行**。当守卫 return 时，`setActiveSiegeTasks(siegeTaskManager.getActiveTasks())` 仍然会被调用，可能覆盖 `handleCancelled` 中已更新的状态。

---

## Attack 4: P2-03 siegeTaskId 传递 — setTimeout 闭包中的陈旧引用

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 | 严重度 |
|--------|-------------|------------|------------|--------|
| handleArrived 读取 siegeTaskId | payload 含 siegeTaskId，直接读取 — PASS | siegeTaskId 从 payload 正确读取，但 setTimeout(0) 闭包中引用了外层的 `targetTerritory`（L413 声明，L517 使用）。这个 `targetTerritory` 是同步阶段从 `territoriesRef.current` 查找的快照，在 setTimeout 回调执行时 territories 可能已变更（如另一场 siege 成功改变了 ownership），导致 L517 `result.victory && targetTerritory` 判断基于过时的 territory 数据触发 conquestAnimSystem。 | 缺少 territories 在 setTimeout 回调执行期间可能变更的场景测试 | **LOW** |

### 详细分析

L413: `const targetTerritory = territoriesRef.current.find(...)` — 同步阶段快照
L517: `if (result.victory && targetTerritory)` — setTimeout 回调中使用快照

由于 `targetTerritory` 是 `const` 且通过值属性（`.id`, `.position.x`, `.ownership`）访问，而 territories 数组中的对象引用在 React 重渲染前不变，所以实际风险较低。但如果其他操作修改了 territory 对象的 ownership 属性（突变而非替换），则 conquestAnimSystem 会使用过时的 ownership 计算 faction。

**结论：** siegeTaskId 传递本身正确，但关联的 `targetTerritory` 在异步上下文中存在理论上的陈旧引用风险。严重度 LOW。

---

## Attack 5: P2-04 异步 siege 执行 — siegeTaskId 为 undefined 的边界行为

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 | 严重度 |
|--------|-------------|------------|------------|--------|
| siegeTaskId undefined 安全性 | setTimeout(0) 包裹 siege — PASS | 当 siegeTaskId 为 undefined 时，L422 `const associatedTask = siegeTaskId ? ... : null` 正确返回 null，跳过 siege 执行块。但 L540-553 的 `else if` 分支会检查 `targetTerritory && targetTerritory.ownership !== 'player'`，在 siegeTaskId 为 undefined 且目标是敌方领土时，会走 DEPRECATED 的 1500ms setTimeout 旧路径。这个旧路径注释说"理论上不再可达"，但如果 MarchingSystem 外部代码直接 emit `march:arrived` 事件（不通过 SiegeTaskManager 流程），这个分支仍然可达且行为不可预测。 | 缺少 siegeTaskId 为 undefined 时的行为测试；缺少 DEPRECATED 分支是否真的不可达的证明 | **HIGH** |

### 详细分析

```typescript
// L421-422
const siegeTaskId = data.siegeTaskId;
const associatedTask = siegeTaskId ? siegeTaskManager.getTask(siegeTaskId) : null;

// L424: siegeTaskId 有值且任务存在 → 走异步 siege
if (associatedTask && !associatedTask.result) { ... }

// L540: siegeTaskId 无值 或 任务不存在 → 走旧路径
else if (targetTerritory && targetTerritory.ownership !== 'player') {
  setTimeout(() => {
    // 1500ms 后打开攻城确认弹窗
    setSiegeTarget(targetTerritory);
    setSiegeVisible(true);
    // ...
  }, 1500);
}
```

关键问题：如果 siegeTaskId 有值但 `siegeTaskManager.getTask(siegeTaskId)` 返回 null（任务已被 removeCompletedTasks 清理），代码也会落入 `else if` 旧路径。这意味着一个本应被 SiegeTaskManager 管理的行军到达时，如果任务已因某种原因被清理，会走完全不同的 1500ms 延迟弹窗路径，用户体验不一致。

Builder 声称此分支"DEPRECATED 且理论上不再可达"，但：
1. 没有测试证明此分支确实不可达
2. 没有移除此分支（"未来可安全删除"意味着现在还存在）
3. SiegeTaskManager 的 `removeCompletedTasks` 可能在行军途中被其他逻辑触发

---

## Attack 6: 整体测试 — mock 遮蔽真实集成问题

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 | 严重度 |
|--------|-------------|------------|------------|--------|
| 3 文件 71 用例全部通过 | 测试 PASS — PASS | 3 个测试文件中没有任何一个测试 WorldMapTab 中的 eventBus 集成、handleArrived/handleCancelled 的完整行为、或 setTimeout(0) 异步逻辑。所有测试只覆盖 MarchingSystem 和 SiegeTaskManager 的孤立单元。WorldMapTab 作为 5 个 fix 的主要实现文件（P2-02, P1-01, P2-04），**完全没有被测试覆盖**。 | 缺少 WorldMapTab 的组件测试；缺少 handleArrived 的单元测试；缺少 setTimeout(0) 异步行为的测试 | **CRITICAL** |

### 详细分析

Builder 运行的 3 个测试文件：
1. `MarchingSystem.test.ts` — 测试 MarchingSystem 类的孤立行为，mock eventBus 为 `vi.fn()`
2. `SiegeTaskManager.test.ts` — 测试 SiegeTaskManager 类的孤立行为
3. `SiegeTaskManager.chain.test.ts` — 测试状态机转换链

**没有任何测试验证：**
- WorldMapTab 中 `as IEventBus` 断言的 eventBus 是否真正兼容
- `handleArrived` 函数在收到 MarchArrivedPayload 时的完整行为
- `handleCancelled` 在 cleanup 中被正确 off 的效果
- setTimeout(0) 异步 siege 执行的时序正确性
- siegeTaskId 为 undefined 时的 else if 分支行为
- 回城行军到达时 L556-560 的 completed 推进逻辑

Builder 的测试结论 "71 用例全部通过" 与 5 个 fix 的验证范围严重不匹配。71 个用例中 **0 个** 直接测试了 WorldMapTab 中的修改代码。

---

## 汇总表

| # | 验证项 | Builder | Challenger | 理由 |
|---|--------|---------|-----------|------|
| A | P2-01 emit 泛型参数 | PASS | **WARNING** | 源码正确但测试证据不充分，泛型参数无法通过运行时测试验证 |
| B | P2-02 eventBus 类型化 | PASS | **FAIL** | emit 签名不兼容（必传 vs 可选），`as IEventBus` 掩盖结构性不匹配 |
| C | P1-01 handleCancelled 清理 | PASS | **WARNING** | cleanup 正确，但 setTimeout 回调中 L538 的 setActiveSiegeTasks 在守卫 return 后仍执行，可能覆盖 handleCancelled 的状态更新 |
| D | P2-03 siegeTaskId 传递 | PASS | PASS | siegeTaskId 传递逻辑正确，仅存在低风险的 targetTerritory 闭包陈旧引用 |
| E | P2-04 异步 siege 执行 | PASS | **FAIL** | siegeTaskId 有值但任务已被清理时落入 DEPRECATED 旧路径；旧路径未被移除且无测试证明不可达 |
| F | 整体测试 | PASS | **FAIL** | 0/71 用例覆盖 WorldMapTab 修改代码；测试与修复范围严重不匹配 |

---

## 最终裁定

**Builder 结论被推翻。** 6/6 PASS 应修正为 **3 FAIL + 2 WARNING + 1 PASS**。

核心问题：
1. **测试覆盖盲区**：5 个 fix 中有 4 个（P2-02, P1-01, P2-03, P2-04）的实现代码在 WorldMapTab.tsx 中，但 71 个测试用例中没有任何一个测试 WorldMapTab。Builder 的测试证据与修复声明之间存在根本性脱节。
2. **类型安全虚假保障**：`as IEventBus` 强制断言掩盖了 emit 签名不兼容（必传 vs 可选），Builder 声称的"类型化"实际上只是编译期绕过。
3. **异步竞态窗口**：setTimeout(0) 回调中 L538 的 `setActiveSiegeTasks` 在守卫 return 后仍执行，可能在并发取消场景下覆盖正确状态。
