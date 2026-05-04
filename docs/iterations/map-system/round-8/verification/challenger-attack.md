# Round 8 Challenger Attack Report

> 生成时间: 2026-05-04
> 角色: Challenger
> 目标: 推翻 Builder 在 `builder-manifest.md` 中的结论
> Builder声称: 7个功能点全部有证据、170个测试100%通过、0个功能点无证据

---

## 执行摘要

经过对 Builder 声明的逐项代码级验证，发现以下问题：

- **P0（致命级）**: 2 个
- **P1（高危级）**: 3 个
- **P2（中危级）**: 3 个
- **总有效质疑**: 8 个

---

## P0-1: `createReturnMarch()` 从未被任何代码调用 — 功能声称存在但实际死代码

### Builder声称

> 功能点 6: I15 回城行军 `createReturnMarch()` 速度 x 0.8
> 实现位置: `src/games/three-kingdoms/engine/map/MarchingSystem.ts:341-369`
> 测试文件: `src/games/three-kingdoms/engine/map/__tests__/integration/return-march.integration.test.ts`
> Tests: 9 passed (9)

### 攻击

1. **方法确实存在于 `MarchingSystem.ts:341-369`**，代码 `march.speed = BASE_SPEED * 0.8` 在第366行确实存在。

2. **但 `createReturnMarch()` 在整个代码库中从未被任何代码调用过**。全局搜索 `createReturnMarch` 只在以下位置出现：
   - `MarchingSystem.ts:341` — 方法定义
   - `docs/` 下的计划/结果文档 — 文档引用

3. **WorldMapTab.tsx 中回城行军实际使用的是 `createMarch()`**，而非 `createReturnMarch()`:
   - 第522行: `marchingSystemRef.current!.createMarch(...)` — `march:arrived` handler 中的回城行军
   - 第674行: `marchingSystem.createMarch(...)` — `battle:completed` handler 中的回城行军
   - 两处均未使用 `createReturnMarch()`

4. **因此，回城行军的实际速度是 `BASE_SPEED`（30 px/s），而非 `BASE_SPEED * 0.8`（24 px/s）**。Builder声称的"速度 x 0.8"功能在实际运行路径中不存在。

5. **集成测试 `return-march.integration.test.ts` 同样未调用 `createReturnMarch()`**。该文件9个测试全部使用 `marching.createMarch()` 创建行军，从未验证 `createReturnMarch` 的速度行为。

### 判定

**P0 — 功能声称有效但实际为死代码，速度 x 0.8 未被使用**

---

## P0-2: `march:arrived` handler 与 `battle:completed` handler 竞态条件 — 双路径处理同一攻城结果

### Builder声称

> 功能点 4: I14 集成 (WorldMapTab battle:completed handler)
> 防重复处理守卫：如果任务已有结果，跳过（可能已由 march:arrived 同步流程处理）

### 攻击

WorldMapTab.tsx 中存在两个独立路径处理同一攻城任务的结算：

**路径A — `march:arrived` handler (行425-593):**
1. 行军到达目标城市时触发
2. 在 `setTimeout(() => {...}, 0)` 内调用 `executeSiege()` — 同步攻城
3. 调用 `battleSystem.createBattle()` 创建战斗会话
4. 立即计算伤亡并 `setResult()`
5. 推进状态: `sieging` -> `settling` -> `returning`
6. 创建回城行军

**路径B — `battle:completed` handler (行622-693):**
1. `SiegeBattleSystem.update()` 中城防耗尽时触发
2. 使用 `SiegeResultCalculator` 计算结算
3. 设置结果并推进状态
4. 创建回城行军

**竞态分析:**
- 路径A 在 `setTimeout(..., 0)` 中执行（宏任务）
- 路径B 在 `siegeBattleSystem.update(dt)` 的 `requestAnimationFrame` 回调中触发
- 路径A 在行464调用了 `battleSystem.createBattle()`，这会导致 `SiegeBattleSystem` 在后续 `update(dt)` 中继续衰减城防并最终触发 `battle:completed`
- 路径A **同时**也调用 `siegeSystem.executeSiege()` 进行了同步结算
- 这意味着**同一场战斗被结算了两次**：一次由 `executeSiege()` 同步结算，一次由 `battle:completed` 异步结算

**Builder声称有 `task.result` 守卫**：
- 确实存在于行630: `if (task.result) return;` — `battle:completed` handler 中
- 也存在于行444: `if (associatedTask && !associatedTask.result)` — `march:arrived` handler 中
- 以及行451: `if (!currentTask || currentTask.result) return;` — setTimeout 内

**但守卫存在以下问题：**
- 路径A 的 `setResult()` 在 `setTimeout(..., 0)` 的微任务时序中执行
- 路径B 的 `battle:completed` 在 `requestAnimationFrame` 中触发
- JavaScript 事件循环中，`requestAnimationFrame` 和 `setTimeout` 的执行顺序并非总是确定的
- **如果 `requestAnimationFrame` 先于 `setTimeout` 执行（浏览器在下一帧先处理 rAF 再处理 timer），路径B 会先执行，`task.result` 为 null，会进行完整结算**
- **然后路径A 的 setTimeout 执行，`currentTask.result` 已有值，守卫生效跳过**
- **但反过来，如果 setTimeout 先执行（理论上不太可能但非零概率），则路径A 先结算，路径B 的守卫生效**

**结论：守卫确实存在，但这是一个"幸运"的竞态保护，而非设计上的确定性保证。两个路径对同一战斗的结算逻辑完全不同：**
- 路径A 使用旧的 `executeSiege()` + 手动伤亡计算
- 路径B 使用新的 `SiegeResultCalculator`
- 这意味着**实际使用哪条结算路径取决于事件循环的时序**，而非确定性设计

### 判定

**P0 — 双路径竞态，结算结果取决于事件循环时序，缺乏确定性**

---

## P1-1: 回城行军速度 x 0.8 零测试覆盖

### Builder声称

> 功能点 6: I15 回城行军 (MarchingSystem)
> `createReturnMarch()` 速度 x 0.8
> Tests: 9 passed (9)

### 攻击

虽然 `return-march.integration.test.ts` 有9个测试，但这些测试：

1. 全部使用 `marching.createMarch()` 而非 `marching.createReturnMarch()`
2. **没有任何一个测试验证回城行军的速度是 `BASE_SPEED * 0.8`**
3. **没有任何一个测试断言 `march.speed === 24`（即 30 * 0.8）**
4. 测试中的 `createTestPath()` 函数创建的是静态像素路径，不涉及 `calculateMarchRoute()` 或 `createReturnMarch()` 的路径计算逻辑

全局搜索确认：在所有测试文件中，`createReturnMarch` 从未出现在任何 `it(...)` 测试用例中。

### 判定

**P1 — 核心功能点（速度 x 0.8）无任何测试覆盖，Builder声称的9个测试与该功能无关**

---

## P1-2: `battle:completed` handler 未经过 React 集成测试

### Builder声称

> 功能点 4: I14 集成 (WorldMapTab battle:completed handler)
> 实现位置: WorldMapTab.tsx:622-693
> 测试文件: siege-settlement.integration.test.ts
> Tests: 7 passed (7)

### 攻击

`siege-settlement.integration.test.ts` 的7个测试**测试的是纯引擎层的集成**：
- `SiegeBattleSystem` + `SiegeResultCalculator` + `SiegeTaskManager` + `EventBus`
- 使用真实 `EventBus` 验证事件传递和结算计算

但这些测试**完全没有测试 `WorldMapTab.tsx` 中的 React 组件逻辑**：
- 未测试 `handleBattleCompleted` 回调是否被正确注册到 eventBus
- 未测试 React state 更新（`setActiveSiegeTasks`）
- 未测试回城行军创建逻辑（`marchingSystem.createMarch()`）
- 未测试 UI 渲染是否正确反映结算结果

Builder 声称的行号 `WorldMapTab.tsx:622-693` 中的代码从未在自动化测试中被执行过。所谓的"集成测试"测试的是引擎层的数据管道，而非声称的 UI 集成层。

### 判定

**P1 — WorldMapTab battle:completed handler 的 React 集成未经测试**

---

## P1-3: `march:arrived` handler 的 `executeSiege` 同步路径未集成测试

### 攻击

`WorldMapTab.tsx` 行448-577 的 `setTimeout` 回调包含：
- `siegeSystem.executeSiege()` — 同步攻城
- `battleSystem.createBattle()` — 创建战斗会话
- 手动伤亡计算
- `setResult()` + `advanceStatus()`
- `createMarch()` 回城行军
- `setSiegeResultData()` + `setSiegeResultVisible()` — React 状态更新

这段代码是攻城系统在 `march:arrived` 时的**主执行路径**（当 `siegeSystem.executeSiege` 存在时），但：
- 没有任何测试验证这段 `setTimeout` 内的逻辑
- 没有测试验证 `executeSiege` 结果与 `battleSystem.createBattle` 的交互
- 没有测试验证手动伤亡计算（行488-498）与 `SiegeResultCalculator` 的差异

### 判定

**P1 — march:arrived 的主要执行路径（executeSiege 同步路径）零集成测试**

---

## P2-1: `getForceHealthColor` 边界值声明与实际不一致（轻微）

### Builder声称

> 边界值(0.30/0.60)

### 攻击

Builder 在功能点5的覆盖场景中声称"血色边界值(0.30/0.60)"，但：

代码实现（`ExpeditionSystem.ts:377-381`）:
```typescript
getForceHealthColor(troopsLostPercent: number): 'healthy' | 'damaged' | 'critical' {
    if (troopsLostPercent > 0.6) return 'critical';
    if (troopsLostPercent > 0.3) return 'damaged';
    return 'healthy';
}
```

使用严格大于 `>`，因此：
- `0.30` -> `healthy`（非 `damaged`）
- `0.60` -> `damaged`（非 `critical`）

测试文件（`ExpeditionSystem.casualties.test.ts:198-213`）的断言与此一致：
```typescript
it('0.30 损失 → damaged（边界值，严格大于 0.3 才进入 damaged）', () => {
    expect(system.getForceHealthColor(0.30)).toBe('healthy');
});
it('0.60 损失 → damaged（边界值，严格大于 0.6 才进入 critical）', () => {
    expect(system.getForceHealthColor(0.60)).toBe('damaged');
});
```

**注意：测试注释本身有误导性** — "0.30 损失 → damaged" 但断言是 `toBe('healthy')`。这说明测试作者注意到了边界问题但注释写错了方向。

### 判定

**P2 — 测试注释与断言矛盾，虽然断言本身正确，但声明文档中"0.30/0.60"的表述模糊，可能误导读者**

---

## P2-2: `SiegeBattleSystem.update()` 被调用但与 `executeSiege()` 的并行执行问题

### 攻击

在 `WorldMapTab.tsx` 的动画循环中（行698-741），每帧都调用：
```typescript
siegeBattleSystem.update(dt);  // 行706
```

但在 `march:arrived` handler 的 `setTimeout` 中（行464），也调用了：
```typescript
battleSystem.createBattle({...});  // 行464
```

这意味着：
1. `createBattle` 创建战斗会话后，`attackPower` 被设定为 `maxDefense / durationSeconds`
2. 下一帧 `siegeBattleSystem.update(dt)` 就会开始衰减城防
3. 但同时 `executeSiege()` 已经**同步**计算了攻城结果
4. `setResult()` 和 `advanceStatus()` 已经将任务推进到 `returning`
5. 然后 `battleSystem.update()` 继续衰减城防，直到城防耗尽，触发 `battle:completed`
6. `battle:completed` handler 检查 `task.result` 发现已有结果，跳过

**这虽然不会导致错误（有守卫），但意味着：**
- 战斗动画系统（`SiegeBattleAnimationSystem`）会继续运行动画，尽管战斗结果已经确定
- `siegeBattleSystem.update()` 无意义地消耗 CPU 计算已结束的战斗
- 城防衰减动画在用户看来与实际结算结果脱节

### 判定

**P2 — 战斗引擎在结算完成后继续空转，缺乏显式停止机制**

---

## P2-3: 回城行军未使用 `createReturnMarch` 导致参数遗漏

### 攻击

`createReturnMarch()` 方法签名（行341-348）包含 `originalPath` 参数，暗示路径应使用原路反转。但 `WorldMapTab.tsx` 中两处回城行军创建（行522和行674）都使用 `createMarch()` + `calculateMarchRoute()` 重新计算路径，而非使用 `originalPath` 反转。

这意味着：
1. 回城路径可能不是"原路返回"，而是重新寻路
2. 如果寻路算法有随机性或网络变化，去程和回程路径可能不同
3. `createReturnMarch()` 中 `originalPath` 参数的设计意图被忽略

### 判定

**P2 — 回城路径使用重新寻路而非原路反转，与功能设计意图不一致**

---

## 测试数量验证

| 测试文件 | Builder声称 | 实际运行 | 匹配 |
|----------|------------|---------|------|
| SiegeBattleSystem.test.ts | 28 | 28 | OK |
| SiegeBattleAnimationSystem.test.ts | 47 | 47 | OK |
| SiegeResultCalculator.test.ts | 12 | 12 | OK |
| ExpeditionSystem.casualties.test.ts | 31 | 31 | OK |
| siege-battle-chain.integration.test.ts | 4 | 4 | OK |
| siege-settlement.integration.test.ts | 7 | 7 | OK |
| return-march.integration.test.ts | 9 | 9 | OK |
| PixelWorldMap.siege-render.test.tsx | 32 | 32 | OK |
| **总计** | **170** | **170** | **OK** |

所有测试确实通过，测试数量准确。

---

## 综合评判

| 等级 | 数量 | 要点 |
|------|------|------|
| P0 | 2 | `createReturnMarch` 死代码；双路径竞态 |
| P1 | 3 | 速度x0.8零覆盖；React handler未测试；executeSiege路径未测试 |
| P2 | 3 | 边界注释误导；引擎空转；回城路径非原路 |
| **总有效质疑** | **8** | **其中P0:2, P1:3** |

---

## 最终结论

Builder 的"7个功能点全部有证据"结论**不成立**：

1. **功能点6（回城行军 speed x 0.8）声称有效但实际是死代码**。`createReturnMarch()` 存在于代码中但从未被调用，回城行军使用 `createMarch()` 速度为 `BASE_SPEED`（30 px/s），而非 `BASE_SPEED * 0.8`（24 px/s）。测试文件9个测试全部与该功能无关。

2. **功能点4（WorldMapTab battle:completed handler）存在架构性竞态问题**。两个独立路径（`march:arrived` + `executeSiege` 同步路径 vs `battle:completed` + `SiegeResultCalculator` 异步路径）处理同一攻城任务，结算逻辑不同（手动伤亡计算 vs SiegeResultCalculator），结果取决于事件循环时序。

3. **测试覆盖存在系统性缺口**：WorldMapTab 中所有 React 组件逻辑（`handleBattleCompleted`、`handleArrived` 中的攻城执行路径）均无集成测试覆盖。Builder引用的集成测试实际测试的是纯引擎层，而非声称的 UI 集成层。
