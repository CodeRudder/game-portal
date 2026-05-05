# Judge Ruling — Round 23 Phase 2 行军推进 (P6)

> **裁决日期**: 2026-05-05
> **裁决角色**: Judge
> **裁决对象**: Builder Manifest vs Challenger Attack Report

---

## 逐条裁决

| 质疑点 | Challenger观点 | Builder补充 | Judge裁决 | 理由 | 优先级 |
|--------|---------------|-------------|-----------|------|--------|
| CA-01 | handleCancelled 中 `marching->completed` 转换无效 | cancelMarch→march:cancelled→SiegeTask清理 链路完整 | **Challenger成立** | 代码验证: `SiegeTaskManager.ts:564` 状态转换表 `marching: ['sieging']` 确实不包含 `completed`。`WorldMapTab.tsx:772` 调用 `advanceStatus(siegeTaskId, 'completed')` 时任务状态为 `marching`，必定返回 `null`。`removeCompletedTasks()` 仅删除 `isTerminalStatus` 为 true 的任务（即仅 `completed` 状态），而任务卡在 `marching`，不会被清理。siege lock 永不释放。 | **P0** |
| CA-02 | 到达判定 `dist < 2` 浮点精度风险 | update循环检查 `pathIndex>=path.length-1` | **Challenger部分成立** | 代码验证: `MarchingSystem.ts:466` 使用 `dist < 2` 作为路径点到达阈值。`updateMarchPosition` 中 `ratio = Math.min(1, moveAmount/dist)` 确保单步不越过当前路径点，加上每次 update 都会推进 pathIndex，大 dt 只需更多 update 调用即可到达终点。`update` 循环 `line 202` 的 `pathIndex >= path.length - 1` 是最终保底检查。实际风险较低——只要 update 循环持续运行，最终必到达。但 `dist < 2` 在网格坐标(间距=1)下确实第一帧就触发，使移动表现为逐点跳跃而非平滑插值，影响视觉效果。 | P2 |
| CA-03 | 时长 clamp 仅影响 ETA 显示，不影响实际行军速度 | clamp 在 createMarch 和 generatePreview 均有实现 | **Challenger成立** | 代码验证: `MarchingSystem.ts:245` `speed = BASE_SPEED` 固定为 30，不受 estimatedTime 影响。`line 247` 的 clamp 仅作用于 `estimatedTime` 变量，该变量仅用于 `line 264` 的 `eta` 计算和 `line 276` 的事件 payload。`updateMarchPosition` (`line 475`) 使用 `march.speed * dt`，即 `30 * dt`，完全独立于 clamp 值。短路径 150px 的实际移动时间 = 150/30 = 5s，远小于 clamp 的 10s。Builder 的 "时长约束" 实际只约束了 ETA 显示，未约束实际移动速度。 | P1 |
| CA-04 | 回城路线不可达时部队凭空消失 | calculateMarchRoute 返回 null 时正确处理 | **Challenger成立** | 代码验证: `WorldMapTab.tsx:652-658` 当 `createReturnMarch` 返回 null 时，直接调用 `advanceStatus(currentTask.id, 'completed')` 和 `removeCompletedTasks()`。任务正常结束，但部队视觉上凭空消失，无任何回城精灵或通知。从功能角度任务可完成，但用户体验有缺陷。 | P2 |
| CA-05 | mock-free 测试使用 `as any` 强转 | 标记为有效 | **Challenger部分成立** | 使用空对象 `as any` 确实不是完整真实依赖，但当前 MarchingSystem 不依赖 config/registry 的具体功能，测试结果可接受。标记为有限真实性是合理的。 | P2 |
| CA-06 | calculateMarchRoute 被 vi.spyOn mock | 测试有效 | **Challenger成立** | mock A*寻路确实降低了回城行军路径计算的可信度。但 A*寻路本身在其他测试中已有独立验证。 | P2 |
| CA-07 | Canvas mock 无真实渲染验证 | Canvas API 级别测试覆盖 | **Challenger成立但影响可控** | Canvas mock 测试验证的是 API 调用正确性，不是像素输出。这是前端 Canvas 测试的常规做法，完整像素级测试成本过高。测试有效性标记为 "存疑" 合理，但不构成功能缺陷。 | P2 |
| CA-08 | marching-full-flow 是伪集成测试 | 列入集成测试 | **Challenger成立** | 3个测试仅做数据断言，无系统交互，应标记为数据/类型测试而非集成测试。但不影响功能正确性评估。 | P2 |
| CA-09 | handleArrived 中 setTimeout(0) 产生竞态 | march:arrived 事件正确推进状态 | **Challenger部分成立** | 代码验证: `WorldMapTab.tsx:510` 确实使用 `setTimeout(() => {...}, 0)`。防重复守卫 (`line 512-513`) 检查 `currentTask.result`，可在多数场景下防止重复处理。`line 747-751` 的 3秒 removeMarch 与 setTimeout(0) 回调之间: setTimeout(0) 通常在当前宏任务后立即执行（微秒级），远早于 3秒超时，实际竞态概率极低。但 `getTask` + `advanceStatus` 非原子操作这一点是事实——如果用户在 setTimeout(0) 回调执行前（几乎不可能但理论上存在）通过 UI 取消了任务，可能出现状态不一致。综合判断: 理论风险存在，但实际触发概率极低。降级为 P1。 | P1 |
| CA-10 | handleCancelled 不释放 siege lock | siege lock 释放完整 | **Challenger成立 (与 CA-01 因果关联)** | CA-01 已确认 `marching->completed` 转换无效。`advanceStatus` 返回 null 导致: (1) 任务不进入 `completed` 状态; (2) `line 173-176` 的 lock 释放代码不执行; (3) `removeCompletedTasks` 跳过非终态任务。siege lock 永远持有。后果: 取消行军后同目标城市永远无法再发起攻占（直到5分钟 lock 超时 `SiegeTaskManager.ts:397-399`）。注意: `acquireSiegeLock` 中有超时释放逻辑 (`SIEGE_LOCK_TIMEOUT_MS = 5分钟`)，所以实际是"5分钟内无法再次攻占"而非"永远"。但仍是生产级 bug。 | **P0** |
| CA-11 | createTask 后 createMarch 失败不释放 lock | 流程完整 | **Challenger部分成立** | 代码验证: `handleSiegeConfirm` 中 `calculateMarchRoute` (`line 1127`) 在 `createTask` (`line 1144`) 之前调用。如果路线为 null，`line 1128-1132` 直接返回，此时 task 尚未创建，lock 未获取，无泄漏。如果 `createMarch` 因 path 为空数组等原因失败（但 `createMarch` 无失败返回，它总是创建对象），实际风险极低。但理论上 `startMarch` 或后续步骤失败时 lock 确实无法释放。 | P2 |
| CA-12 | ETA 硬编码为10秒 | SiegeTaskPanel 常驻进度条+ETA | **Challenger成立** | 代码验证: `WorldMapTab.tsx:1194` 确实是 `const estimatedDuration = 10; // 秒（简化估算）`。`line 1195` `setEstimatedArrival(task.id, Date.now() + estimatedDuration * 1000)` 写入固定10秒后的时间戳。`SiegeTaskManager.ts:449-452` 用 `estimatedArrival - marchStartedAt` 作为进度条总时间。实际行军速度为 `BASE_SPEED=30 px/s`，150px 路径实际耗时5秒，但进度条以10秒为基准，进度条会滞后——行军已完成但进度条仅显示50%。反之，600px 路径实际耗时20秒，但进度条以10秒为基准，行军未到时进度条已100%。这是明确的 UI 显示 bug。 | **P1** |
| CA-13 | 回城行军状态为 marching 非 retreating | createReturnMarch 正确创建回城行军 | **Challenger成立** | 代码验证: `createReturnMarch` (`MarchingSystem.ts:361`) 调用 `createMarch`，创建的行军状态为 `preparing`，启动后为 `marching`。`MarchState` 类型中无 `retreating` 状态（状态仅有 preparing/marching/arrived/cancelled）。PixelWorldMap 如果为 `retreating` 设置了特殊样式，但该状态永远不会出现，回城行军精灵与出发行军精灵外观相同。 | P2 |
| CA-14 | march:arrived→sieging 非原子操作 | 过渡完整 | **Challenger部分成立** | siege lock 机制本身阻止了同一目标的并发行军创建，所以"多个行军同时到达同一目标"在正常流程中不会发生。setTimeout(0) 回调中的防重复守卫 (`line 512-513`) 进一步降低了风险。实际并发风险极低。 | P2 |
| CA-15 | deserialize 不恢复 siege lock | serialize/deserialize 支持行军数据持久化 | **Challenger成立** | 代码验证: `SiegeTaskManager.ts:541` `this.siegeLocks.clear()` 清空所有 lock。`line 542-545` 仅恢复 tasks，不重建 siegeLocks。恢复后正在 marching/sieging 状态的任务对应目标城市无 siege lock 保护，理论上可对同一城市重复创建攻占任务。这是真实的数据一致性缺陷。 | **P1** |
| CA-16 | siegeTaskId 通过外部赋值 | 数据一致 | **Challenger成立** | `WorldMapTab.tsx:1188` `march.siegeTaskId = task.id` 确实是外部赋值。当前代码是同步的，风险极低。但设计上确实脆弱，若未来代码重构可能引入问题。 | P2 |
| CA-17 | 网格坐标下 dist<2 阈值过大 | 位置一致 | **Challenger部分成立** | 路径来自 A* 网格(间距=1)，`dist < 2` 在相邻路径点间几乎第一帧就触发（dist≈1 < 2）。结果是精灵逐格跳跃而非平滑移动。但这与 CA-02 是同一问题的不同视角，实际影响是视觉平滑度而非功能正确性。`updateMarchPosition` 的 `Math.min(1, moveAmount/dist)` 限制在 dist 极小时 ratio = 1，即直接 snap 到目标点，移动表现为逐帧推进一格。功能正确但视觉不平滑。 | P2 |

---

## 裁决汇总

### 按优先级统计

| 优先级 | 数量 | 质疑点 |
|--------|------|--------|
| **P0** | 2 | CA-01 (marching->completed转换无效), CA-10 (siege lock永不释放) — 注: CA-01与CA-10因果关联，根源相同 |
| **P1** | 4 | CA-03 (clamp不影响实际速度), CA-09 (setTimeout竞态降级), CA-12 (ETA硬编码10秒), CA-15 (deserialize不恢复lock) |
| **P2** | 11 | CA-02, CA-04, CA-05, CA-06, CA-07, CA-08, CA-11, CA-13, CA-14, CA-16, CA-17 |

### 对Builder完成度评估的裁决

| 任务ID | Builder结论 | Challenger修正 | Judge最终裁决 | 裁决理由 |
|--------|------------|---------------|---------------|---------|
| P6-1 行军精灵生成 | 完成 | 完成 | **完成** | 代码完整，功能正常 |
| P6-2 行军时长约束 | 完成 | 部分完成 | **部分完成** | CA-03成立: clamp仅约束ETA显示，不约束实际移动速度。功能上ETA显示正确，但实际行军时间与显示不一致 |
| P6-3 A*寻路 | 完成 | 部分完成 | **完成** | CA-04是回城路线不可达的边缘情况，核心A*寻路功能完整。回城不可达处理虽不完美但不会导致系统崩溃 |
| P6-4 路线显示 | 完成 | 完成 | **完成** | Canvas mock测试是行业常规做法，核心功能完整 |
| P6-5 进度指示 | 完成 | 部分完成 | **部分完成** | CA-12成立: ETA硬编码10秒导致进度条与实际行军时间不匹配，这是明确的UI bug |
| P6-6 屏幕边缘指示器 | 未完成 | 未完成 | **未完成** | 无争议 |
| P6-7 地形修正 | 部分完成 | 部分完成 | **部分完成** | 无争议，常量已定义但未应用 |
| P6-8 到达判定 | 完成 | 完成 | **完成** | CA-02风险较低，核心链路畅通，pathIndex>=path.length-1保底有效 |
| P6-9 并行行军渲染 | 部分完成 | 部分完成 | **部分完成** | 无争议 |
| P6-10 取消行军 | 完成 | 未完成 | **部分完成** | CA-01/CA-10成立: siege lock不会"永远"持有（有5分钟超时释放），但取消行军后5分钟内同目标无法再次攻占，是生产级bug。取消→清理的基本链路存在但状态转换有缺陷，降级为"部分完成" |
| P6-11 切后台/崩溃恢复 | 完成 | 部分完成 | **部分完成** | CA-15成立: deserialize清空siegeLocks且不重建，恢复后数据一致性受损 |
| P6-12 恢复超时处理 | 未完成 | 未完成 | **未完成** | 无争议 |

**Judge最终完成度**: 4个完成 + 5个部分完成 + 3个未完成 (非Builder声称的7/12，也非Challenger修正的4/12)

---

## 必须修复项清单

### P0 (必须修复 — 生产级 bug)

**FIX-P0-01: handleCancelled 中 marching→completed 状态转换路径无效**
- **根源**: `SiegeTaskManager.ts:564` 状态转换表 `marching: ['sieging']` 不包含 `completed`
- **触发**: 用户取消行军时 `WorldMapTab.tsx:772` 调用 `advanceStatus(siegeTaskId, 'completed')` 返回 null
- **后果**: siege lock 在5分钟超时前不释放，期间同目标城市无法再次发起攻占
- **修复方案**: 方案A — 在 `SiegeTaskManager` 新增 `cancelTask(taskId)` 方法，从任意活跃状态直接终止并释放 lock; 方案B — 在状态转换表中为 `marching` 增加 `completed` 作为合法转换; 方案C — 在 `handleCancelled` 中先将任务推进到 `sieging` 再到 `completed`（链式推进）
- **推荐**: 方案A，最干净，且可复用于其他异常终止场景
- **文件**: `src/games/three-kingdoms/engine/map/SiegeTaskManager.ts`, `src/components/idle/panels/map/WorldMapTab.tsx`

**FIX-P0-02: siege lock 释放与 handleCancelled 关联**
- 与 FIX-P0-01 同根源，修复 FIX-P0-01 后自动解决

### P1 (严重 — 功能缺陷)

**FIX-P1-01: handleSiegeConfirm 中 ETA 硬编码为10秒**
- **根源**: `WorldMapTab.tsx:1194` `const estimatedDuration = 10`
- **后果**: 进度条与实际行军时间不匹配，短路径进度条滞后，长路径进度条超前
- **修复方案**: 使用 `MarchingSystem.generatePreview()` 或 `calculateMarchRoute()` 返回的 `estimatedTime`（已 clamp 到 [10s, 60s]）替代硬编码值
- **文件**: `src/components/idle/panels/map/WorldMapTab.tsx`

**FIX-P1-02: SiegeTaskManager.deserialize 不恢复 siege lock**
- **根源**: `SiegeTaskManager.ts:541` `this.siegeLocks.clear()` 后不重建
- **后果**: 恢复后活跃任务对应目标城市无 siege lock 保护，可能重复创建攻占任务
- **修复方案**: 在 `deserialize` 中遍历恢复的 tasks，为非终态任务重建 siege lock: `if (!isTerminalStatus(task.status)) this.siegeLocks.set(task.targetId, { taskId: task.id, lockedAt: task.createdAt })`
- **文件**: `src/games/three-kingdoms/engine/map/SiegeTaskManager.ts`

**FIX-P1-03: handleArrived 中 setTimeout(0) 竞态防护不足**
- **根源**: `WorldMapTab.tsx:510` `setTimeout(() => {...}, 0)` 异步执行攻城
- **后果**: 理论上 setTimeout 回调执行前任务状态可能被其他操作修改
- **修复方案**: (1) 在防重复守卫中增加 `task.status` 检查（除 `result` 外也检查 `status === 'marching'`）; (2) 或将攻城逻辑改为同步执行（性能允许的情况下）
- **文件**: `src/components/idle/panels/map/WorldMapTab.tsx`

**FIX-P1-04: clamp 不影响实际行军速度**
- **根源**: `MarchingSystem.ts:245` `speed = BASE_SPEED` 固定，不受 estimatedTime 影响
- **后果**: 短路径行军实际耗时可能远小于 clamp 的 10s，但 ETA 显示为 10s，进度条与实际不同步
- **修复方案**: 使 speed 根据路径长度和 desired duration 动态计算: `speed = distance / (estimatedTime)` 其中 `estimatedTime` 为 clamp 后的值。或者接受当前行为（speed 固定），但移除 clamp 对 ETA 的欺骗性影响
- **文件**: `src/games/three-kingdoms/engine/map/MarchingSystem.ts`

### P2 (一般 — 可延后修复)

| ID | 问题 | 建议 |
|----|------|------|
| FIX-P2-01 | 回城路线不可达时部队凭空消失 (CA-04) | 添加视觉通知（如 "回城路线中断，部队已返回"） |
| FIX-P2-02 | dist<2 在网格坐标下导致跳跃式移动 (CA-02/CA-17) | 使用更小的阈值（如 0.5）或引入亚格插值 |
| FIX-P2-03 | 回城行军状态为 marching 非 retreating (CA-13) | 新增 retreating 状态或在 MarchUnit 中增加 isReturnMarch 标志 |
| FIX-P2-04 | siegeTaskId 通过外部赋值设计脆弱 (CA-16) | 将 siegeTaskId 加入 createMarch 参数 |
| FIX-P2-05 | 地形修正常量已定义但未应用 (P6-7) | 在 updateMarchPosition 中根据路径点地形应用速度修正 |
| FIX-P2-06 | 测试有效性问题 (CA-05/06/07/08) | 标记测试有效性级别，补充真实依赖的集成测试 |
| FIX-P2-07 | createMarch 失败路径 lock 泄漏 (CA-11) | 添加 try-catch 或在 createMarch 失败时释放 lock |

---

## Judge 结论

1. **CA-01/CA-10 是本轮最严重的发现**: handleCancelled 的 `marching->completed` 状态转换无效导致 siege lock 泄漏（5分钟超时释放），是生产级 bug，必须立即修复
2. **CA-12 ETA 硬编码10秒** 是明确的 UI 显示 bug，修复简单（使用 generatePreview 返回的 estimatedTime）
3. **CA-15 deserialize 不恢复 siege lock** 是数据一致性缺陷，恢复后可能出现重复攻占
4. **CA-03 clamp 不影响实际速度** 是设计层面的问题，需决策是否让 clamp 真正约束移动速度
5. **CA-09 setTimeout 竞态** 理论风险存在但实际触发概率极低，增强防护即可

*Judge Ruling | Round 23 | 2026-05-05*
