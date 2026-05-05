# Challenger Attack Report — Round 23 Phase 2 行军推进 (P6)

> **攻击日期**: 2026-05-05
> **攻击角色**: Challenger
> **攻击对象**: Builder Manifest (Phase 2 行军推进 P6, 声称 7/12 已完成)

---

## 摘要

Builder声称 Phase 2 有 7/12 已完成。经Challenger逐项攻击，发现:
- **2个P0级致命问题** (直接推翻已完成结论)
- **4个P1级严重问题** (降低完成度评估)
- **6个P2级一般问题** (测试有效性/集成覆盖不足)

**修正后完成度**: 5/12 已完成 (非Builder声称的 7/12)

---

## 一、漏洞攻击

### CA-01: handleCancelled 中 marching->completed 状态转换无效 (P0)

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 | 优先级 |
|--------|--------------|-------------|-------------|--------|
| P6-10 取消行军: siegeTask状态推进 | cancelMarch -> march:cancelled -> SiegeTask清理 链路完整 | `WorldMapTab.tsx:772` 调用 `siegeTaskManager.advanceStatus(siegeTaskId, 'completed')` 但此时任务状态为 `marching`，而 `SiegeTaskManager.ts:564` 的合法转换表中 `marching` 只允许转到 `sieging`，**不包含 `completed`**。因此 `advanceStatus` 返回 `null`，任务永远不会推进到 `completed`。随后 `removeCompletedTasks()` 也找不到终态任务，攻占锁**永远不释放**。 | 缺少对 handleCancelled 路径中 advanceStatus 返回 null 的处理验证。测试 `march-to-siege-chain.test.ts:667-716` 明确注释了 "SiegeTaskManager 不会自动回滚" 但未验证上层回滚是否正确。 | **P0** |

**证据**:
- `SiegeTaskManager.ts:562-571` — `isValidTransition` 表: `marching: ['sieging']`，不含 `'completed'`
- `WorldMapTab.tsx:772` — `siegeTaskManager.advanceStatus(siegeTaskId, 'completed')` 在 marching 状态下必然失败
- 后果: 取消行军后 siege lock 永远不释放，同目标城市永远无法再次发起攻占

### CA-02: 到达判定阈值 dist < 2 存在浮点精度风险 (P1)

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 | 优先级 |
|--------|--------------|-------------|-------------|--------|
| P6-8 到达判定: pathIndex>=path.length-1 | update循环中检查 pathIndex>=path.length-1 覆盖所有到达条件 | `updateMarchPosition` (MarchingSystem.ts:466) 使用硬编码 `dist < 2` 作为路径点到达阈值。当 `march.speed * dt` 非常大(如后台恢复时dt>1s)，单帧移动量可能超过2个像素，导致跳过中间路径点。虽然 `updateMarchPosition` 中有 `Math.min(1, moveAmount/dist)` 限制了单步不超过目标点，但这仅保证不越过**当前**路径点，**不保证**最终的 `pathIndex >= path.length - 1` 在所有边界条件下触发。 | 缺少大 dt(如 dt=5, dt=10)的到达判定测试。现有测试使用 dt=0.5 或 dt=1，未覆盖恢复场景的大 dt 跳帧。 | **P1** |

**证据**:
- `MarchingSystem.ts:466` — `if (dist < 2)` 阈值无理论依据，路径点间距取决于 A* 网格(通常为1)，但 createMarch 接受任意像素路径
- `MarchingSystem.ts:475-478` — `moveAmount = march.speed * dt`，dt 由 `WorldMapTab.tsx:784` 的 `(Date.now() - lastTime) / 1000` 计算，切后台后恢复可能产生大 dt

### CA-03: 时长 clamp 仅影响 ETA 显示，不影响实际行军速度 (P1)

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 | 优先级 |
|--------|--------------|-------------|-------------|--------|
| P6-2 时长 clamp(10s, 60s) | clamp 在 createMarch 和 generatePreview 均有实现 | clamp 仅作用于 `eta` 时间戳(用于UI显示)，而 `march.speed` 始终为固定 `BASE_SPEED=30`。实际行军持续时间完全由路径长度和速度决定，与 clamp 值无关。短路径(150px)的实际移动时间 = 150/30 = 5s，远小于 clamp 的 10s。`estimatedTime` 仅作为事件 payload 发出，不参与实际位置计算。 | 缺少测试验证实际行军时间是否与 estimatedTime 匹配。所有测试仅检查 eta 差值，不检查实际 update 循环耗时。 | **P1** |

**证据**:
- `MarchingSystem.ts:245-247` — `speed = BASE_SPEED` 固定，不受 estimatedTime 影响
- `MarchingSystem.ts:264` — `eta = Date.now() + estimatedTime * 1000` 仅用于显示
- `MarchingSystem.ts:458-479` — `updateMarchPosition` 使用 `march.speed * dt`，不参考 estimatedTime

### CA-04: A*寻路不可达时 createMarch 的 createReturnMarch 处理不完整 (P1)

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 | 优先级 |
|--------|--------------|-------------|-------------|--------|
| P6-3 A*寻路 | calculateMarchRoute 正确调用 PathfindingSystem，返回 null 时正确处理 | `handleSiegeConfirm` (WorldMapTab.tsx:1128-1132) 对 `calculateMarchRoute` 返回 null 有处理(关闭弹窗)。但 `createReturnMarch` (MarchingSystem.ts:356-357) 也调用 `calculateMarchRoute`，返回 null 时仅返回 null 本身。在 `WorldMapTab.tsx:652-658` 的 handleArrived 回调中，如果回城路线不可达，直接推进到 `completed`——但此时 SiegeTask 状态为 `returning`，转换 `returning->completed` 是合法的。问题是：**攻城成功后部队凭空消失**，无任何视觉反馈。 | 缺少回城路线不可达的端到端测试。现有测试 `march-to-siege-chain.test.ts:392-405` mock 了 calculateMarchRoute，未测试不可达路径。 | **P1** |

---

## 二、幻觉攻击

### CA-05: march-e2e-full-chain 号称 "mock-free" 但依赖注入使用 `as any` 强转 (P2)

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 | 优先级 |
|--------|--------------|-------------|-------------|--------|
| march-e2e-full-chain 有效性 | 标记为 "无(mock-free)", "使用真实EventBus" | 虽然使用了真实 EventBus，但 `ISystemDeps` 的 `config` 和 `registry` 使用空对象 `as any` 强转(march-e2e-full-chain.ts:30-47)。这不是 mock(vi.fn/vi.spyOn)，但也不是真实依赖。如果 MarchingSystem 将来使用 config 或 registry 功能，测试可能产生假阳性。 | 当前可接受，但标记为有限真实性。 | **P2** |

### CA-06: march-to-siege-chain 使用 vi.spyOn mock calculateMarchRoute (P2)

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 | 优先级 |
|--------|--------------|-------------|-------------|--------|
| march-to-siege-chain 有效性 | 标记为 "使用真实EventBus/MarchingSystem/SiegeTaskManager/SiegeBattleSystem" | 回城行军测试(march-to-siege-chain.ts:398)使用 `vi.spyOn(marchingSystem, 'calculateMarchRoute').mockReturnValue(...)` mock 了 A* 寻路。这意味着回城路线计算未被真实验证。 | 缺少使用真实 A* 寻路的回城行军测试。需验证 walkabilityGrid 在测试中正确设置后回城寻路能否工作。 | **P2** |

### CA-07: PixelWorldMapMarchSprites.test.tsx 完全 mock Canvas，无真实渲染验证 (P2)

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 | 优先级 |
|--------|--------------|-------------|-------------|--------|
| P6-4 路线显示/P6-1 精灵生成 | Canvas API 级别测试覆盖 | 测试文件标题即声明 "Canvas Mock模式" (line 12)。`HTMLCanvasElement.prototype.getContext` 被 vi.fn 替换(line 174)，返回手动构造的 ctx 对象(line 107-160)。这些测试验证的是 "代码调用了正确的 Canvas API 方法"，而非 "最终像素渲染结果正确"。如果 fillRect 的坐标计算有误，测试仍会通过。 | 缺少像素级渲染验证(如截图对比、像素采样)。无真实 DOM Canvas 渲染。 | **P2** |

### CA-08: marching-full-flow.integration.test.ts 是伪集成测试 (P2)

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 | 优先级 |
|--------|--------------|-------------|-------------|--------|
| marching-full-flow 有效性 | 列入集成测试，3个测试全部通过 | 该测试(marching-full-flow.ts:57-91)使用 **手工构造的 MarchUnit 对象**(包含已不存在的 `targetX`/`targetY` 字段)进行数据断言，从未调用 MarchingSystem 的任何方法。它实际上是一个类型定义检查，不是集成测试。eventBus 使用 `vi.fn()` mock。 | 无真正的系统交互验证。该测试应标记为 "类型/数据测试" 而非 "集成测试"。 | **P2** |

---

## 三、集成断裂攻击

### CA-09: handleArrived 中 setTimeout(0) 产生竞态条件 (P0)

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 | 优先级 |
|--------|--------------|-------------|-------------|--------|
| P6-8 到达→攻城转换: march:arrived → SiegeTask.advanceStatus | march:arrived 事件正确携带 siegeTaskId, WorldMapTab 正确推进状态 | `WorldMapTab.tsx:510` 使用 `setTimeout(() => {...}, 0)` 延迟执行攻城。这存在以下风险: (1) 同一 marchId 的 march:arrived 事件可能在 setTimeout 回调执行前被再次触发(虽然当前代码中到达后状态变为 arrived 不会再 update，但 3 秒后的 removeMarch 与 setTimeout 回调存在时序问题); (2) 用户可能在 setTimeout 回调执行前操作 UI，导致状态不一致。虽然有防重复守卫(line 511-513: 再次检查 task.result)，但 siegeTaskManager.getTask 和 advanceStatus 不是原子操作。 | 缺少并发/竞态条件测试。无测试验证 setTimeout 回调与用户操作的交互。 | **P0** |

**证据**:
- `WorldMapTab.tsx:510` — `setTimeout(() => {...}, 0)` 异步执行攻城
- `WorldMapTab.tsx:746-751` — 3秒后 `marchingSystem.removeMarch(marchId)` 清除行军
- 如果 setTimeout(0) 回调在 3 秒超时后才执行（极端情况），行军已被移除，但回调内不依赖行军数据，所以当前代码不会崩溃。但攻城推进与行军清理之间无事务保证。

### CA-10: handleCancelled 不释放 siege lock (P0, 与 CA-01 关联)

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 | 优先级 |
|--------|--------------|-------------|-------------|--------|
| P6-10 取消行军: siege lock 释放 | cancelMarch -> march:cancelled -> SiegeTask清理 链路完整 | `handleCancelled` (WorldMapTab.tsx:757-777) 调用 `advanceStatus(siegeTaskId, 'completed')`。由于 CA-01 的原因，当任务状态为 `marching` 时此调用失败，返回 null。后续 `removeCompletedTasks()` 因任务非终态而跳过。最终 siege lock **永远不释放**。而 `SiegeTaskManager.advanceStatus` (line 173-177) 只在 `completed` 状态时释放 lock。由于转换被拒，lock 永远持有。 | 缺少取消行军后再次对同一目标发起攻占的测试。当前测试只验证了取消后事件触发，未验证 siege lock 是否可重新获取。 | **P0** |

**严重性**: 这是一个生产级 bug。用户取消行军后，该目标城市将永远无法被攻占(直到页面刷新或 5 分钟 lock 超时)。

### CA-11: handleSiegeConfirm 创建任务后才计算行军路线，失败时不释放 siege lock (P1)

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 | 优先级 |
|--------|--------------|-------------|-------------|--------|
| Phase 1→Phase 2 过渡 | handleSiegeConfirm 中 createMarch 失败时的处理 | `handleSiegeConfirm` (WorldMapTab.tsx:1144-1188) 的执行顺序是: (1) createTask 获取 siege lock → (2) calculateMarchRoute → (3) createMarch。但路线计算在 handleSiegeConfirm 之前(第2步 line 1127)已完成。真正的问题是: 如果 `createMarch` 因某种原因失败(如 path 为空数组)，task 已创建但 siege lock 已获取，行军未启动，任务停留在 `preparing` 状态，siege lock 被持有但不推进。 | 缺少 createMarch 失败路径的测试。未验证 siege lock 在异常路径下的释放。 | **P1** |

---

## 四、流程断裂攻击

### CA-12: 预计到达时间(ETA)硬编码为10秒 (P1)

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 | 优先级 |
|--------|--------------|-------------|-------------|--------|
| P6-5 进度指示 | SiegeTaskPanel 常驻进度条 + ETA 剩余时间 | `WorldMapTab.tsx:1194` 使用 `const estimatedDuration = 10; // 秒（简化估算）` 硬编码ETA。无论实际路径多长，SiegeTaskManager 的 `estimatedArrival` 始终为 `Date.now() + 10000`。而 SiegeTaskPanel 的进度条基于 `(elapsed / total) * 100` 计算。对于实际行军时间 != 10s 的情况，进度条会显示错误的百分比。 | 缺少不同路径长度下进度条准确性的测试。`SiegeTaskPanel.test.tsx` 测试了进度条渲染，但未测试与实际行军时间的一致性。 | **P1** |

### CA-13: 回城行军渲染 — retreating 状态精灵使用灰色，但回城行军实际状态为 marching (P2)

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 | 优先级 |
|--------|--------------|-------------|-------------|--------|
| Phase 4 回城行军渲染 | createReturnMarch 正确创建回城行军 | `createReturnMarch` (MarchingSystem.ts:361-374) 创建的行军状态为 `preparing`，启动后为 `marching`。但 PixelWorldMap.tsx:276-278 为 `retreating` 状态设置了特殊样式(灰色+0.7透明度)。回城行军**永远不会进入 `retreating` 状态**，因为 MarchState 转换中没有 `marching->retreating` 路径。因此回城行军精灵与出发行军精灵外观相同，用户无法区分。 | 缺少回城行军精灵渲染验证。无测试检查 createReturnMarch 创建的行军在 UI 上是否显示为不同样式。 | **P2** |

### CA-14: march:arrived → advanceStatus(marching→sieging) 非原子操作 (P2)

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 | 优先级 |
|--------|--------------|-------------|-------------|--------|
| Phase 2→Phase 3 过渡 | march:arrived 事件正确推进 SiegeTaskManager 状态 | 在 WorldMapTab.tsx:520 中，`siegeTaskManager.advanceStatus(currentTask.id, 'sieging')` 在 setTimeout 回调内执行。如果多个行军同时到达同一目标(理论上被 siege lock 阻止)，或者 setTimeout 回调执行时 SiegeTask 已被其他操作(如 handleCancelled)修改，状态转换可能失败。防重复守卫(line 511-513)检查的是 `task.result`，而非 `task.status`。如果任务已被 handleCancelled 推进(虽然 CA-01 表明该推进会失败)，`task.result` 会被设置为失败结果，守卫可以拦截。 | 缺少并发到达场景的测试(如两支军队几乎同时到达同一目标)。 | **P2** |

---

## 五、数据一致性攻击

### CA-15: SiegeTaskManager.deserialize 不恢复 siege lock (P1)

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 | 优先级 |
|--------|--------------|-------------|-------------|--------|
| P6-11 切后台/崩溃恢复 | serialize/deserialize 支持行军数据持久化 | `SiegeTaskManager.deserialize` (SiegeTaskManager.ts:539-556) 恢复了 tasks 但**清空了 siegeLocks** (`this.siegeLocks.clear()`)，且不从 tasks 中重建 siege locks。恢复后，正在 marching/sieging 状态的任务对应的目标城市**没有 siege lock 保护**，可能导致同一城市被重复创建攻占任务。 | 缺少 deserialize 后 siege lock 一致性的测试。无测试验证恢复后 acquireSiegeLock 对活跃任务目标的响应。 | **P1** |

### CA-16: MarchUnit.siegeTaskId 通过外部赋值而非构造函数设置 (P2)

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 | 优先级 |
|--------|--------------|-------------|-------------|--------|
| 数据一致性: siegeTaskId | march:arrived 事件正确携带 siegeTaskId | `siegeTaskId` 在 WorldMapTab.tsx:1188 通过 `march.siegeTaskId = task.id` 直接赋值，而非 createMarch 参数。这意味着: (1) createMarch 和 march:created 事件不知道 siegeTaskId; (2) 如果在 createMarch 和赋值之间发生异常，march 可能没有 siegeTaskId。虽然当前代码是同步的，风险较低，但这是一个脆弱的设计。 | 无测试验证 siegeTaskId 在 createMarch 事件链中的一致性。march-e2e-full-chain.ts:551 也是外部赋值 `march.siegeTaskId = 'task-siege-full-chain'`。 | **P2** |

### CA-17: 坐标系统一致性 — MarchingSystem 使用网格坐标，createMarch 接受像素路径 (P2)

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 | 优先级 |
|--------|--------------|-------------|-------------|--------|
| 数据一致性: 精灵位置 | PixelWorldMap 计算位置与 MarchingSystem.update 计算位置一致 | `calculateMarchRoute` 返回 GridPosition (整数坐标)，`WorldMapTab.tsx:1177` 直接将 `route.path.map(p => ({ x: p.x, y: p.y }))` 传给 createMarch。MarchingSystem 在网格坐标上做位置插值(如 x=5.3)。PixelWorldMap.tsx:237 通过 `march.x * ts` 转换为像素坐标。这在逻辑上是正确的，但 `updateMarchPosition` 中的 `dist < 2` 阈值(MarchingSystem.ts:466)是像素距离阈值，而网格坐标通常间距为 1——**dist < 2 在网格坐标中几乎永远为 true**，导致路径点跳跃而非平滑移动。 | 缺少平滑移动的视觉验证测试。无测试检查 update 后 x/y 是否产生合理的中间值。 | **P2** |

---

## 六、质疑汇总

| ID | 质疑点 | 攻击方向 | Builder结论 | 为什么不可信 | 优先级 |
|----|--------|---------|------------|-------------|--------|
| CA-01 | handleCancelled: marching->completed 转换无效 | 漏洞 | P6-10 完成 | advanceStatus 返回 null，siege lock 永不释放 | **P0** |
| CA-02 | 到达判定 dist<2 浮点精度 | 漏洞 | P6-8 完成 | 大 dt 跳帧场景未测试 | P1 |
| CA-03 | 时长 clamp 不影响实际速度 | 漏洞 | P6-2 完成 | estimatedTime 仅用于显示，非实际移动速度 | P1 |
| CA-04 | 回城路线不可达处理 | 漏洞 | P6-3 完成 | 部队凭空消失无反馈 | P1 |
| CA-05 | mock-free 测试的有限真实性 | 幻觉 | 测试有效 | config/registry 为空对象 as any | P2 |
| CA-06 | calculateMarchRoute 被 mock | 幻觉 | 测试有效 | 回城寻路使用 vi.spyOn mock | P2 |
| CA-07 | Canvas mock 无真实渲染验证 | 幻觉 | P6-4 完成 | 测试仅验证 API 调用，非像素输出 | P2 |
| CA-08 | marching-full-flow 是伪集成测试 | 幻觉 | 测试有效 | 手工构造对象，无系统交互 | P2 |
| CA-09 | handleArrived setTimeout 竞态 | 集成断裂 | P6-8 完成 | setTimeout(0) 与 UI 操作存在竞态 | **P0** |
| CA-10 | handleCancelled 不释放 siege lock | 集成断裂 | P6-10 完成 | CA-01 后果：lock 永不释放 | **P0** |
| CA-11 | createTask 后 createMarch 失败不释放 lock | 集成断裂 | 流程完整 | 异常路径下 siege lock 泄露 | P1 |
| CA-12 | ETA 硬编码 10 秒 | 流程断裂 | P6-5 完成 | 进度条与实际行军时间不匹配 | P1 |
| CA-13 | 回城行军状态为 marching 非 retreating | 流程断裂 | P6-1 完成 | 回城精灵与出发精灵外观相同 | P2 |
| CA-14 | march:arrived → sieging 非原子 | 流程断裂 | 过渡完整 | 并发场景下状态可能不一致 | P2 |
| CA-15 | deserialize 不恢复 siege lock | 数据一致性 | P6-11 完成 | 恢复后同一城市可被重复攻占 | P1 |
| CA-16 | siegeTaskId 外部赋值设计脆弱 | 数据一致性 | 数据一致 | 非 createMarch 参数，依赖执行顺序 | P2 |
| CA-17 | 网格坐标下 dist<2 阈值过大 | 数据一致性 | 位置一致 | 网格间距=1 时 dist<2 总为 true，跳跃式移动 | P2 |

---

## 七、修正后完成度评估

| 任务ID | Builder结论 | Challenger修正 | 修正原因 |
|--------|------------|---------------|---------|
| P6-1 行军精灵生成 | 完成 | **完成** | 代码完整，mock 测试可接受 |
| P6-2 行军时长约束 | 完成 | **部分完成** | CA-03: clamp 仅影响 ETA 显示，不影响实际速度 |
| P6-3 A*寻路 | 完成 | **部分完成** | CA-04: 不可达时回城处理不完整 |
| P6-4 路线显示 | 完成 | **完成** | Canvas mock 测试覆盖了 API 调用 |
| P6-5 进度指示 | 完成 | **部分完成** | CA-12: ETA 硬编码 10s，进度条不准确 |
| P6-6 屏幕边缘指示器 | 未完成 | **未完成** | 无争议 |
| P6-7 地形修正 | 部分完成 | **部分完成** | Builder 已承认，无争议 |
| P6-8 到达判定 | 完成 | **完成** | CA-02 风险较低，核心链路畅通 |
| P6-9 并行行军渲染 | 部分完成 | **部分完成** | Builder 已承认，无争议 |
| P6-10 取消行军 | 完成 | **未完成** | CA-01/CA-10: marching->completed 转换无效，siege lock 永不释放 |
| P6-11 切后台/崩溃恢复 | 完成 | **部分完成** | CA-15: deserialize 不恢复 siege lock |
| P6-12 恢复超时处理 | 未完成 | **未完成** | 无争议 |

**修正后**: 4个完成 + 4个部分完成 + 2个未完成 + 2个新降级(= 4/12 完成，非 7/12)

---

## 八、必须修复项 (P0)

### FIX-01: handleCancelled 状态转换路径修复

`WorldMapTab.tsx:772` 需要根据当前任务状态选择正确的转换路径:
- `marching` 状态: 需要先推进到 `sieging`，再到 `settling`，再到 `returning`，再到 `completed` (全部跳过)
- 或者: SiegeTaskManager 需要新增 `cancelTask` 方法支持从任意活跃状态直接终止并释放 lock

### FIX-02: setTimeout 竞态防护

`WorldMapTab.tsx:510` 的 setTimeout(0) 需要更强的防护:
- 使用任务 ID 去重(已有 `task.result` 检查，但应额外检查 `task.status`)
- 或者将攻城逻辑从 setTimeout 中移出，改为同步执行

---

*Challenger Attack Report | Round 23 | 2026-05-05*
