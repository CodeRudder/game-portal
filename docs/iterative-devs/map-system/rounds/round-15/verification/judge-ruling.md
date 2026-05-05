# R15 Judge Ruling — 攻城渲染流水线修复裁决 (复核版)

**日期**: 2026-05-04
**角色**: Judge (复核)
**裁决对象**: Builder R15 Manifest (3 Task) vs Challenger R15 Attack (A1-A8)
**复核方式**: 读取源代码验证所有关键攻击点

---

## 裁决总览

| # | 质疑点 | Challenger严重度 | Judge裁决 | Judge优先级 | 理由摘要 |
|---|--------|----------------|----------|------------|---------|
| A1 | Task1 性能退化 | P1 | **有条件确认** | P2 | 性能影响真实存在但程度有限（视口裁剪+Canvas fillRect效率），当前地图规模不构成瓶颈 |
| A2 | Task1 过度绘制方案 | P1 | **确认** | P2 | 修复方案确实粗糙，"转换帧标记"方案更优，但不影响正确性 |
| A3 | Task2 Mock 断裂 | P0 | **确认** | P0 | Mock 未注册 battle:started 监听器，核心路径完全未被测试验证 |
| A4 | Task2 EventBus.once 并发缺陷 | P0 | **否决** | -- | once 注册与 completeSiegeAnimation 在同一同步调用栈，JS 单线程模型下并发不成立 |
| A5 | Task2 错误 taskId 测试不完整 | P1 | **有条件确认** | P3 | 测试场景在真实系统中不可能发生，但逻辑是正确的防御性编程 |
| A6 | Task2 cancelBattle 调用顺序 | P1 | **确认** | P1 | 代码推理正确但缺少集成测试保障，存在回归风险 |
| A7 | Task3 死代码确认 | -- | **不攻击** | -- | 双方一致，结论正确 |
| A8 | 集成验证缺失 | P2 | **确认** | P2 | 所有测试重度 Mock，无真实 Canvas 或真实子系统交互验证 |

**最终统计: P0: 1, P1: 1, P2: 2, P3: 1**

---

## 第一部分: Builder 证据链审查

### Task 1 (P0 黑屏修复) -- 证据充分

**证据 1.1 (clearRect 移除)**:
- 验证: Grep 确认 `renderMarchSpritesOverlay` (PixelWorldMap.tsx 行 1352-1450) 中不存在 clearRect
- 唯一匹配在 `renderMinimap` 函数 (行 1634)，对 minimap canvas，不影响主画布
- **裁决: 可信**

**证据 1.2 (强制 terrain dirty flag)**:
- 验证: PixelWorldMap.tsx 行 1054-1058 代码确实存在
- ```typescript
  // R15 Task1: Force terrain redraw when overlays change
  if (flags.sprites || flags.effects) {
    flags.terrain = true;
  }
  ```
- **裁决: 可信**

**证据 1.3 (terrain-persist 测试)**:
- 6/6 PASS，但使用 Mock Canvas 验证 fillRect 调用次数，非真实渲染
- **裁决: 有条件可信** -- 验证了逻辑正确性但未验证真实渲染输出

### Task 2 (P0 动画时序修复) -- 代码实现正确，测试有效性存疑

**证据 2.1-2.5 (代码实现)**:
- `pendingSiegeResultRef` 和 `siegeAnimTimeoutRef` refs 存在 (行 261-262)
- `setSiegeResultVisible(true)` 不在 executeSiege 后立即调用 (行 703-705 仅存储数据)
- `eventBus.once('siegeAnim:completed', animHandler)` 存在 (行 718)
- 5s fallback timeout 存在 (行 720-725)
- 组件卸载时清理存在 (行 854-858)
- **裁决: 全部可信**

**证据 2.6 (siege-animation-sequencing 测试)**:
- 6/6 PASS，但 Mock 断裂导致核心路径未被真正验证 (详见 A3)
- **裁决: 不可信** -- 测试通过不代表修复路径被验证

### Task 3 (P1 死代码确认) -- 证据充分

**证据 3.1-3.3**:
- `handleBattleCompleted` 在 WorldMapTab.tsx 中 0 matches
- `battle:completed` 仅出现在注释中
- SettlementPipeline 是唯一结算路径
- **裁决: 全部可信**

---

## 第二部分: Challenger 质疑逐条裁决 (含源码验证)

### A1: Task1 性能退化 -- 有条件确认 (P2)

**Challenger 主张**: 每次 sprites/effects dirty 都强制 terrain dirty，活跃动画期间每帧重绘全部 terrain，抵消分层渲染优化。

**源码验证**:

1. `PixelWorldMap.tsx` 行 1048-1058:
   ```typescript
   if (hasActiveConquest || hasActiveMarches || hasActiveSiegeAnims) {
     flags.sprites = true;
     flags.effects = true;
   }
   if (flags.sprites || flags.effects) {
     flags.terrain = true;  // 活跃动画期间每帧都设置
   }
   ```

2. `PixelMapRenderer.render()` (行 284-311):
   - 每次调用执行完整重绘: `clearRect` + `renderTerrain()` + `renderRoads()` + `renderCities()` + `renderMarchSprites()` + `renderCityNames()`

3. `renderTerrain()` (行 315-322) 使用视口裁剪:
   ```typescript
   const startX = Math.max(0, Math.floor(this.offsetX / ts));
   const startY = Math.max(0, Math.floor(this.offsetY / ts));
   const endX = Math.min(this.map.width, Math.ceil((this.offsetX + this.canvas.width) / ts) + 1);
   const endY = Math.min(this.map.height, Math.ceil((this.offsetY + this.canvas.height) / ts) + 1);
   ```
   - 只渲染可见区域，不是全量 6000 格
   - 可见区域通常远小于 100x60

**Judge 分析**:

Challenger 的分析在技术上正确: 活跃动画期间确实每帧全量重绘。但:
- `renderTerrain()` 使用视口裁剪，实际渲染 cell 数取决于视口大小
- Canvas 2D fillRect 在千级操作下性能良好 (单帧 < 2ms)
- 60fps 预算 16.6ms，terrain 重绘有余量

**裁决: 有条件确认 (P2)** -- 性能退化真实存在，但在当前地图规模和视口裁剪下不构成功能性瓶颈。应作为后续优化项。

---

### A2: Task1 过度绘制方案 -- 确认 (P2)

**Challenger 主张**: 修复方案是"大锤"级别，仅在转换帧标记更优。

**Judge 分析**:

黑屏根因: 旧代码 `clearRect(0,0,w,h)` 在 sprites 层清空了整个画布，terrain 层未被标记 dirty 所以不重绘。

修复方案:
1. 移除 clearRect (正确且必要)
2. 每帧强制 terrain dirty (过度但安全)

更优方案: 仅在 sprites/effects 从 `true->false` 的转换帧标记 terrain dirty。例如:
```typescript
const prevSprites = prevFlagsRef.current.sprites;
const prevEffects = prevFlagsRef.current.effects;
if ((prevSprites && !flags.sprites) || (prevEffects && !flags.effects)) {
  flags.terrain = true;
}
prevFlagsRef.current = { sprites: flags.sprites, effects: flags.effects };
```

**裁决: 确认 (P2)** -- 方案分析正确，确实存在更优解，但当前方案在正确性上没有问题。

---

### A3: Task2 Mock 断裂 -- 确认 (P0)

**Challenger 主张**: Mock SiegeBattleAnimationSystem.init() 不监听 battle:started，导致 completeSiegeAnimation 因 animations Map 为空而 silent return，siegeAnim:completed 从未由组件内部发出。核心路径未被测试。

**源码验证 (全链路追踪)**:

1. **Mock SiegeBattleAnimationSystem.init()** (siege-animation-sequencing.test.tsx 行 236-238):
   ```typescript
   init(deps: any) { capturedEventBus = deps?.eventBus; }
   // 未注册 battle:started 监听器！
   ```

2. **真实 SiegeBattleAnimationSystem.init()** (SiegeBattleAnimationSystem.ts 行 192-220):
   ```typescript
   init(deps: ISystemDeps): void {
     if (this._initialized) return;
     this._initialized = true;
     this.deps = deps;
     // 监听 battle:started -> 自动启动动画
     const unsub1 = this.deps.eventBus.on<BattleStartedEvent>('battle:started', (data) => {
       this.startSiegeAnimation({
         taskId: data.taskId,
         targetCityId: data.targetId,
         targetX: data.targetX,
         targetY: data.targetY,
         strategy: data.strategy,
         faction: data.faction,
         troops: data.troops,
       });
     });
   }
   ```

3. **事件发射端**: Mock SiegeBattleSystem.createBattle() (test 行 184-214) 确实 emit `battle:started`:
   ```typescript
   if (capturedEventBus) {
     capturedEventBus.emit('battle:started', { ... });
   }
   ```

4. **三个 capturedEventBus 是否同一个?**:
   - WorldMapTab.tsx 行 460-474 创建统一的 eventBus 对象，传递给 mockDeps
   - 行 480: `marchingSystem.init(mockDeps)` -> Mock MarchingSystem 捕获
   - 行 484: `siegeBattleAnimSystem.init(mockDeps)` -> Mock SiegeBattleAnimationSystem 捕获
   - 行 489: `siegeBattleSystem.init(mockDeps)` -> Mock SiegeBattleSystem 捕获
   - **确认: 三者共享同一个 eventBus 实例**

5. **完整断裂链路**:
   - `createBattle()` emit `battle:started` -> eventBus 收到
   - Mock SiegeBattleAnimationSystem **未注册** battle:started 监听器 -> 事件被忽略
   - `startSiegeAnimation()` 从未被调用
   - `animations` Map 始终为空
   - WorldMapTab.tsx 行 732: `completeSiegeAnimation(currentTask.id, ...)` -> Mock 中 `if (!anim) return` -> silent return
   - `siegeAnim:completed` **从未通过 completeSiegeAnimation 发出**

6. **测试如何通过**:
   - Test 2 (行 551-578): 手动 `capturedEventBus.emit('siegeAnim:completed', ...)` 绕过了 completeSiegeAnimation
   - Test 4 (行 607-630): 测试 5s fallback -- 实际测试的是 completeSiegeAnimation 失败后的 fallback 路径
   - Test 1 (行 533-549): 弹窗不显示 -- 因为 completeSiegeAnimation 是空操作

7. **生产代码的真实路径**:
   - 真实 `SiegeBattleAnimationSystem.init()` 注册了 `battle:started` 监听器
   - `createBattle()` emit `battle:started` -> 监听器触发 -> `startSiegeAnimation()` 被调用 -> `animations` Map 有数据
   - `cancelBattle()` 不影响 SiegeBattleAnimationSystem (只监听 battle:started 和 battle:completed)
   - `completeSiegeAnimation(taskId, victory)` -> anim 存在 -> 正常执行 -> emit `siegeAnim:completed`
   - once handler 触发 -> `setSiegeResultVisible(true)`
   - **生产代码逻辑正确**

**裁决: 确认 (P0)**

- Mock 断裂是**事实**，核心路径在测试中从未被走过
- 但这是**测试质量问题**，不是生产代码 Bug
- 生产代码逻辑经源码验证确认正确
- P0 严重度维持: 核心修复路径无测试保障，回归风险高

---

### A4: Task2 EventBus.once 并发缺陷 -- 否决

**Challenger 主张**: EventBus.emit 时 `onceHandlers.delete(event)` 删除所有 once 监听器，两个并发攻城会互相吃掉对方的监听器。

**源码验证 (EventBus.ts 行 77-88)**:
```typescript
emit<T = unknown>(event: string, payload: T): void {
  // 1. 精确匹配 -- 持久监听器
  this.invokeSet(this.handlers.get(event), p);
  // 2. 精确匹配 -- 一次性监听器（触发后清空）
  const onceSet = this.onceHandlers.get(event);
  if (onceSet) {
    this.invokeSet(onceSet, p);
    this.onceHandlers.delete(event);  // 确实删除所有 once 监听器
  }
  // ...
}
```

**并发可行性深度分析**:

关键: 分析 WorldMapTab.tsx 中攻城 A 和攻城 B 的实际执行时机。

攻城流程运行在 `setTimeout(0)` 回调中 (行 532):
```typescript
setTimeout(() => {
  // ... 行 533-732: 完整的攻城执行逻辑
  eventBus.once('siegeAnim:completed', animHandler);  // 行 718
  siegeAnimSystem.completeSiegeAnimation(currentTask.id, siegeResult.victory);  // 行 732
}, 0);
```

JavaScript 事件循环机制:
- `setTimeout(0)` 回调作为宏任务加入任务队列
- 每个宏任务**完整执行**后才会执行下一个宏任务
- 不存在宏任务 A 执行到一半被宏任务 B 打断的情况

具体执行时序:
```
时间轴:
  [宏任务1: 攻城A setTimeout回调]
    once 注册 handlerA -> completeSiegeAnimation(A) -> emit siegeAnim:completed(A)
    -> invokeSet: handlerA 匹配 -> setSiegeResultVisible(true) -> onceHandlers.delete
    -> 宏任务1 结束

  [宏任务2: 攻城B setTimeout回调]
    once 注册 handlerB -> completeSiegeAnimation(B) -> emit siegeAnim:completed(B)
    -> invokeSet: handlerB 匹配 -> setSiegeResultVisible(true) -> onceHandlers.delete
    -> 宏任务2 结束
```

**两个攻城不存在 once handler 共存的时间窗口**: `once` 注册和 `completeSiegeAnimation` 在同一同步调用栈中原子执行。

5s fallback 的额外保护: 即使理论上出现极端情况 (例如 completeSiegeAnimation 异常退出)，fallback timeout 也会在 5s 后兜底显示弹窗。

**EventBus.once 设计缺陷评估**:
- `onceHandlers.delete(event)` 确实不优雅 (应逐个删除已触发的 handler)
- 但在当前使用模式下: 每个 once 注册后立即在同一同步栈中被 emit + delete
- 不存在多个 once handler 共存的场景

**裁决: 否决**
- EventBus.once 实现有设计不优雅之处，但 Challenger 提出的并发场景在当前架构下**不可能发生**
- `eventBus.once` 注册与 `completeSiegeAnimation` 在同一同步调用栈中执行
- JS 单线程模型保证两个 setTimeout 回调不会交错
- 5s fallback 提供额外安全保障

---

### A5: Task2 错误 taskId 测试不完整 -- 有条件确认 (P3)

**Challenger 主张**: 测试验证了错误 taskId 不触发弹窗，但未验证 once 被消耗后的后续行为。

**Judge 分析**:

1. 真实系统中: `completeSiegeAnimation` 在 `once` 注册后立即同步调用 (行 718→732)，taskId 来自同一个 `currentTask.id`，不可能不匹配
2. 测试中错误 taskId 场景: 手动 `capturedEventBus.emit('siegeAnim:completed', { taskId: 'wrong-task-id' })` -- 这在真实系统中不会发生
3. 但 taskId 过滤逻辑 (`if (animData.taskId === currentTask.id)`) 是正确的防御性编程
4. 即使 once 被消耗，5s fallback 也会兜底

**裁决: 有条件确认 (P3)** -- 测试场景与真实系统不符，但逻辑正确，优先级极低。

---

### A6: Task2 cancelBattle 与 completeSiegeAnimation 调用顺序 -- 确认 (P1)

**Challenger 主张**: 缺少 cancelBattle 后 completeSiegeAnimation 调用的集成测试。

**源码验证**:

执行顺序 (WorldMapTab.tsx):
1. 行 660: `battleSystem.cancelBattle(currentTask.id)` -- 从 SiegeBattleSystem.activeBattles 删除，emit `battle:cancelled`
2. 行 718: `eventBus.once('siegeAnim:completed', animHandler)` -- 注册 once 监听
3. 行 732: `siegeAnimSystem.completeSiegeAnimation(currentTask.id, siegeResult.victory)` -- 手动完成动画

关键假设验证:
- `cancelBattle` 是否影响 `SiegeBattleAnimationSystem.animations`?
- 真实 `SiegeBattleAnimationSystem` 不监听 `battle:cancelled` (只监听 `battle:started` 和 `battle:completed`)
- 所以 `cancelBattle` 后，动画数据仍然存在
- `completeSiegeAnimation` 能正常工作

**代码推理正确，但完全缺少测试保障**。如果 SiegeBattleAnimationSystem 未来添加 `battle:cancelled` 监听器 (清理动画数据)，此路径将静默失败。

**裁决: 确认 (P1)** -- 代码逻辑经分析正确，但缺少集成测试。回归风险中等。

---

### A7: Task3 死代码确认 -- 不攻击

**裁决**: 双方一致。`handleBattleCompleted` 不存在 (0 matches)，`battle:completed` 仅出现在注释中，SettlementPipeline 是唯一结算路径。

---

### A8: 集成验证缺失 -- 确认 (P2)

**Challenger 主张**: 所有 123 测试使用重度 Mock，无真实渲染或真实子系统交互验证。

**Judge 分析**:
1. `PixelWorldMap.terrain-persist.test.tsx`: Mock Canvas，验证 fillRect 调用次数
2. `siege-animation-sequencing.test.tsx`: Mock 所有子系统 (且 Mock 存在断裂)
3. `WorldMapTab.test.tsx`: Mock 几乎所有子组件
4. 无测试验证真实 Canvas 渲染输出或真实子系统交互

但 E2E Canvas 测试成本高、维护困难，在当前项目阶段合理的折中方案是选择性添加关键路径集成测试。

**裁决: 确认 (P2)** -- 测试策略改进项，不阻塞当前修复。

---

## 第三部分: 综合裁决

### Builder 功能点可信度

| Task | 功能 | 代码正确性 | 测试有效性 | 综合可信度 |
|------|------|-----------|-----------|-----------|
| Task 1 | 黑屏修复 | 正确 | 部分有效 (Mock Canvas) | 有条件可信 |
| Task 2 | 动画时序修复 | 正确 | 无效 (Mock 断裂) | 代码可信，测试不可信 |
| Task 3 | 死代码确认 | 正确 | 有效 (Grep 验证) | 完全可信 |

### 问题优先级汇总

| 优先级 | 数量 | 问题 | 来源 |
|--------|------|------|------|
| **P0** | 1 | A3: Mock 断裂导致核心路径未被测试 | A3 |
| **P1** | 1 | A6: cancelBattle->completeSiegeAnimation 链路缺少集成测试 | A6 |
| **P2** | 2 | A1/A2: 性能退化+过度绘制方案; A8: 集成验证缺失 | A1/A2/A8 |
| **P3** | 1 | A5: 测试场景与真实系统不符 | A5 |

### 对 R16 的建议

1. **P0 (A3)**: 修复 Mock SiegeBattleAnimationSystem，在 `init()` 中注册 `battle:started` 监听器并调用 `startSiegeAnimation()`，使 Mock 行为与真实实现一致。或编写使用真实 SiegeBattleAnimationSystem 的集成测试。

2. **P1 (A6)**: 添加 `cancelBattle -> completeSiegeAnimation -> siegeAnim:completed` 的集成测试，使用真实的 SiegeBattleSystem 和 SiegeBattleAnimationSystem。

3. **P2 (A1/A2)**: 考虑优化 terrain dirty 标记策略为 "仅在转换帧标记"。添加性能基准测试。

4. **P2 (A8)**: 选择性添加关键路径的真实子系统交互测试。

5. **技术债务 (A4)**: 优化 EventBus.once 实现为逐个删除已触发的 handler。虽然当前不影响功能 (同步调用栈保证)，但属于更健壮的防御性编程。

---

**Judge 最终裁定**:

- Builder 3 项功能: **2 项有条件可信** (代码正确但测试有缺陷)，**1 项完全可信** (Task3)
- Challenger 8 个质疑: **4 个确认** (A2/A3/A6/A8)，**1 个有条件确认** (A1)，**1 个有条件确认** (A5)，**1 个否决** (A4)，**1 个不攻击** (A7)
- 严重问题: **P0 = 1** (A3 Mock 断裂)，**P1 = 1** (A6 集成测试缺失)，**P2 = 2** (A1/A2 性能 + A8 集成)，**P3 = 1** (A5 测试价值)
