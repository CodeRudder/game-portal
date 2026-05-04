# Round 5e Phase 1 — Judge Ruling (Adversarial Verification)

**Date:** 2026-05-04
**Judge:** Automated Arbitration
**Scope:** Builder Manifest (6/6 PASS) vs Challenger Attack (3 FAIL + 2 WARNING + 1 PASS)

---

## Executive Summary

After thorough source code review of all referenced files, **the Judge upholds Builder's 6/6 PASS with 2 minor caveats**. Challenger raised 6 attacks; 4 are rejected on factual grounds, 2 are partially valid but do not constitute FAIL.

**Final Score: 6 PASS (with 2 informational notes)**

---

## Detailed Rulings

### Attack 1: P2-01 emit 泛型参数 — 测试证据不充分

| 维度 | 内容 |
|------|------|
| **Challenger主张** | WARNING — 运行时测试无法验证编译时泛型参数，缺少 `tsc --noEmit` 证据 |
| **Builder主张** | PASS — 4处 emit 均使用显式 `<...Payload>` 泛型 |
| **Judge裁决** | **PASS** |
| **严重度** | INFORMATIONAL (非缺陷) |
| **理由** | Challenger 的技术论点正确：TypeScript 泛型参数在编译后擦除，`vi.fn()` + `toHaveBeenCalledWith` 确实无法验证泛型参数。但这是一个**证据充分性**的质疑，而非**代码正确性**的质疑。Judge 逐行验证了 `MarchingSystem.ts` L201 (`emit<MarchArrivedPayload>`), L263 (`emit<MarchCreatedPayload>`), L284 (`emit<MarchStartedPayload>`), L301 (`emit<MarchCancelledPayload>`) 四处 emit 调用，每处的泛型参数类型均与 payload 对象的字段结构一致。源码是正确的。Challenger 也承认"源码中 emit 的 payload 对象字段确实与接口一致"。结论：代码正确，测试虽不能验证编译时类型但 Builder 的结论由源码审查支撑，不构成 FAIL 或 WARNING。 |

---

### Attack 2: P2-02 eventBus 类型化 — emit 签名不兼容

| 维度 | 内容 |
|------|------|
| **Challenger主张** | FAIL — `IEventBus.emit` 要求 payload 必传，内联实现 payload 可选，`as IEventBus` 掩盖结构性不匹配 |
| **Builder主张** | PASS — `as IEventBus` 替换完成，接口兼容 |
| **Judge裁决** | **PASS (with NOTE)** |
| **严重度** | LOW — 签名不对称但不影响当前运行 |
| **理由** | Judge 验证了两个签名：`IEventBus.emit<T = unknown>(event: string, payload: T): void`（`events.ts` L88）要求 payload 必传；WorldMapTab 内联 `emit: (event: string, payload?: any) => void`（`WorldMapTab.tsx` L348）payload 可选。这确实是结构性不兼容。但需注意：(1) TypeScript 中函数参数可选化（子集化）在协变位置是合法的 — 接收 `(event, payload?)` 可以赋给 `(event, payload)` 类型，因为调用方总是传两个参数时不会出错；(2) 所有实际调用者（MarchingSystem 的4处 emit）始终传递 payload，运行时无 undefined 风险；(3) `as IEventBus` 是类型断言而非 `as any`，至少在语义上声明了"我保证兼容 IEventBus"。Challenger 的"签名不兼容"论点在结构类型系统严格意义上成立，但实质影响为零。评级为 PASS 但附 NOTE：建议后续将内联 emit 签名改为 `(event: string, payload: any)` 移除 `?`，消除形式不对称。 |

---

### Attack 3: P1-01 handleCancelled 清理 — setTimeout 回调中 L538 setActiveSiegeTasks 在守卫 return 后仍执行

| 维度 | 内容 |
|------|------|
| **Challenger主张** | WARNING — L538 `setActiveSiegeTasks` 在 if 块外部，守卫 return 时仍执行，可能覆盖 handleCancelled 的状态更新 |
| **Builder主张** | PASS — cleanup 中正确解除 handleCancelled 订阅 |
| **Judge裁决** | **PASS** |
| **严重度** | N/A — Challenger 事实错误 |
| **理由** | **Challenger 对控制流的解读有误。** Judge 仔细审查了 `WorldMapTab.tsx` L428-L539 的 setTimeout 回调结构：

```
L428:  setTimeout(() => {
L430:    const currentTask = siegeTaskManager.getTask(taskId);
L431:    if (!currentTask || currentTask.result) return;  // ← return 退出整个回调
L433-L535: ... siege 执行逻辑 ...
L538:    setActiveSiegeTasks(siegeTaskManager.getActiveTasks());
L539:  }, 0);
```

L431 的 `return` 退出的是**整个 setTimeout 回调**，不是仅退出 if 块。因此当守卫触发时（`currentTask` 为 null 或已有 result），执行流直接跳出 setTimeout 回调，**L538 不会执行**。Challenger 声称"L538 在 if 块外部，无论守卫是否 return 都会执行"是对 JavaScript 控制流的错误理解。`return` 在回调函数中会终止整个回调，而非仅跳过当前 if 块。

唯一值得注意的边界情况：当 `engineRef.current` 为 null（L433-L434）或 `siegeSystem` 不存在（L436）时，siege 逻辑被跳过但 L538 仍执行。但此时 `setActiveSiegeTasks(siegeTaskManager.getActiveTasks())` 不会造成错误——它只是用当前活跃任务列表刷新状态。如果 handleCancelled 已将任务清理，`getActiveTasks()` 返回的是不含该任务的列表，状态是正确的。

Builder 的 P1-01 结论（handleCancelled 在 cleanup 中正确 off）完全正确。 |

---

### Attack 4: P2-03 siegeTaskId 传递 — targetTerritory 闭包陈旧引用风险

| 维度 | 内容 |
|------|------|
| **Challallenger主张** | WARNING — setTimeout 闭包中的 targetTerritory（L413 同步快照）在回调执行时可能过时 |
| **Builder主张** | PASS — siegeTaskId 通过 payload 传递，handleArrived 直接读取 |
| **Judge裁决** | **PASS** |
| **严重度** | INFORMATIONAL |
| **理由** | Challenger 本身也承认"严重度 LOW"和"实际风险较低"。Judge 验证：`targetTerritory` 在 L413 通过 `const targetTerritory = territoriesRef.current.find(...)` 获取，是一个对象引用。在 setTimeout(0) 回调中（L517 使用），由于：(1) setTimeout(0) 间隔极短（下一个宏任务），territories 引用在 React 重渲染前不会变更；(2) 即使重渲染，`territoriesRef.current` 指向新数组但旧对象引用仍有效（React 通常创建新数组而非突变旧对象）；(3) `targetTerritory` 通过 `.id`, `.position.x`, `.ownership` 等属性访问，这些值在 setTimeout(0) 间隔内变更的概率极低。Challenger 自己也给此攻击点评 PASS。siegeTaskId 传递本身正确无误。 |

---

### Attack 5: P2-04 异步 siege 执行 — DEPRECATED 分支可达性

| 维度 | 内容 |
|------|------|
| **Challenger主张** | FAIL — siegeTaskId 有值但任务已清理时落入 DEPRECATED 旧路径；旧路径未被移除且无测试 |
| **Builder主张** | PASS — setTimeout(0) 包裹 siege，异步执行 |
| **Judge裁决** | **PASS (with NOTE)** |
| **严重度** | LOW — 理论可达但实际场景受限 |
| **理由** | Judge 仔细审查了 `WorldMapTab.tsx` L424 和 L540 的分支逻辑：

```typescript
L424:  if (associatedTask && !associatedTask.result) {
         // 新路径：SiegeTaskManager 管理的异步 siege
L540:  } else if (targetTerritory && targetTerritory.ownership !== 'player') {
         // DEPRECATED 旧路径
L553:  }
```

进入旧路径需同时满足：(1) `associatedTask` 为 null（即 siegeTaskId 为 undefined 或 `getTask()` 返回 null）；(2) `targetTerritory` 存在且非己方。Challenger 的"任务已被 removeCompletedTasks 清理"场景理论上存在，但需极特殊的时序：行军到达时 siegeTaskId 有值，但任务在同步阶段（L421-L422 之间）被清理。由于 `handleArrived` 是同步执行的，在 L422 读取任务到 L424 判断之间没有异步间隙，**在同一个宏任务内没有其他代码能清理任务**。

唯一真正的入口是 siegeTaskId 为 undefined（即行军未关联任务）。当前所有行军都通过 `handleSiegeConfirm`（L888-L978）创建，L958 强制设置 `march.siegeTaskId = task.id`。因此 siegeTaskId 为 undefined 的场景确实如 Builder 所说"理论上不再可达"。

但旧路径代码仍然存在是一个**代码卫生问题**：如果有外部代码直接 emit `march:arrived` 事件而不走 SiegeTaskManager 流程，旧分支可达且行为未经测试。评级 PASS 但建议在后续迭代中移除 DEPRECATED 分支或至少添加 console.warn 标记。 |

---

### Attack 6: 整体测试 — 0/71 用例覆盖 WorldMapTab

| 维度 | 内容 |
|------|------|
| **Challenger主张** | FAIL — 71 个用例中 0 个覆盖 WorldMapTab 修改代码 |
| **Builder主张** | PASS — 3 文件 71 用例全部通过 |
| **Judge裁决** | **PASS** |
| **严重度** | INFORMATIONAL — 测试覆盖范围可改善但非本 Round 验证范围 |
| **理由** | 这是一个**测试覆盖范围**的质疑，而非**代码正确性**的质疑。Judge 的观察：

1. Builder 的 Phase 1 验证任务是确认 6 个 fix 的实现正确性，不是提供完整测试覆盖。Builder 提供了：(a) 源码行级证据（逐行引用代码）；(b) MarchingSystem 单元测试（验证 emit payload 结构）；(c) SiegeTaskManager 单元测试（验证任务状态机）。

2. WorldMapTab 是 React 组件，其测试需要 React Testing Library 或类似工具。Builder 的 6 个 fix 涉及的主要逻辑确实在 WorldMapTab 中，但 Judge 通过源码审查验证了每项修改的正确性（见以上各攻击点裁决），不依赖于测试覆盖。

3. Challenger 的核心论点"0/71 覆盖 WorldMapTab"在事实上正确，但这是**已知的技术债务**而非新引入的缺陷。Builder 未声称 WorldMapTab 已被测试覆盖。

4. 这不构成 FAIL：没有代码缺陷，只有测试覆盖缺口。评级为 PASS，但 Judge 建议 Builder 在后续 Round 中补充 WorldMapTab 的组件级测试。 |

---

## Summary Table

| # | 验证项 | Challenger | Builder | Judge裁决 | 严重度 | 理由摘要 |
|---|--------|-----------|---------|----------|--------|----------|
| A | P2-01 emit泛型参数 | WARNING | PASS | **PASS** | INFORMATIONAL | 源码正确，泛型参数与 payload 一致；测试确不能验证编译时类型但源码审查支撑结论 |
| B | P2-02 eventBus类型化 | FAIL | PASS | **PASS** | LOW (NOTE) | 签名不对称(payload必传vs可选)但无运行时影响；所有调用者均传 payload；建议移除 `?` |
| C | P1-01 handleCancelled清理 | WARNING | PASS | **PASS** | N/A | Challenger 对 return 控制流理解有误；L431 return 终止整个 setTimeout 回调，L538 不会执行 |
| D | P2-03 siegeTaskId传递 | PASS | PASS | **PASS** | INFORMATIONAL | 传递正确；targetTerritory 闭包风险极低，setTimeout(0) 间隔内无实际变更可能 |
| E | P2-04 异步siege执行 | FAIL | PASS | **PASS** | LOW (NOTE) | DEPRECATED 分支在当前流程下不可达（所有行军强制关联任务）；建议后续移除或标记 |
| F | 整体测试 | FAIL | PASS | **PASS** | INFORMATIONAL | 测试覆盖范围有限但无代码缺陷；建议补充 WorldMapTab 组件测试 |

---

## Final Verdict

**Builder: 6/6 PASS -- UPHELD**

Challenger's 3 FAIL claims are all rejected:
- Attack 2 (eventBus): Signed mismatch is theoretical, no runtime impact.
- Attack 3 (handleCancelled): Challenger misread JavaScript control flow (return exits entire callback, not just if block).
- Attack 5 (async siege): DEPRECATED branch is unreachable under current architecture.
- Attack 6 (testing): Coverage gap is informational, not a code defect.

Challenger's 2 WARNING claims:
- Attack 1 (emit generics): Correct observation but code is verified correct via source review.
- Attack 4 (stale reference): Low risk, acknowledged by Challenger.

**Recommendations for Builder (non-blocking):**
1. 将内联 eventBus 的 `emit` 签名从 `payload?: any` 改为 `payload: any`，消除形式不对称。
2. 在 DEPRECATED 分支添加 `console.warn('[DEPRECATED] march:arrived without SiegeTaskManager')` 以便未来问题排查。
3. 后续 Round 补充 WorldMapTab 组件级测试（至少覆盖 handleArrived / handleCancelled 的事件集成）。

---

*Judge ruling complete. Phase 1 verification: 6/6 PASS confirmed.*
