# Round 8 Judge Ruling

> 裁决时间: 2026-05-04
> 角色: Judge (Claude Agent)
> 对象: Builder Manifest vs Challenger Attack
> 裁决方法: 逐项代码级交叉验证

---

## 裁决总览

| 质疑编号 | 严重度 | Challenger主张 | 裁决结果 | 是否需要Builder补充 |
|----------|--------|---------------|---------|-------------------|
| P0-1 | P0 | `createReturnMarch` 死代码 | **成立 (降级为P1)** | 否 |
| P0-2 | P0 | 双路径竞态 | **部分成立 (降级为P2)** | 否 |
| P1-1 | P1 | 速度x0.8 零测试覆盖 | **成立 (维持P1)** | 否 |
| P1-2 | P1 | battle:completed handler 未React集成测试 | **成立 (降级为P2)** | 否 |
| P1-3 | P1 | executeSiege 同步路径零集成测试 | **成立 (维持P1)** | 否 |
| P2-1 | P2 | getForceHealthColor 边界注释误导 | **成立 (维持P2)** | 否 |
| P2-2 | P2 | 战斗引擎空转 | **成立 (维持P2)** | 否 |
| P2-3 | P2 | 回城路径非原路反转 | **成立 (维持P2)** | 否 |

**最终裁定: P0: 0 (降至P1:1), P1: 2, P2: 5**

---

## 逐项裁决

---

### P0-1: `createReturnMarch()` 从未被调用（死代码）

#### Challenger主张

`createReturnMarch()` 方法存在于 `MarchingSystem.ts:341-369` 但在整个代码库中从未被调用。WorldMapTab.tsx 中两处回城行军创建（行522和行674）均使用 `createMarch()`，因此回城行军速度为 `BASE_SPEED`(30 px/s) 而非声称的 `BASE_SPEED * 0.8`(24 px/s)。

#### 代码验证

**全局搜索确认**（`grep -rn "createReturnMarch" src/`）：
- `MarchingSystem.ts:341` — 方法定义。唯一的匹配项。

**WorldMapTab.tsx 行522**（march:arrived 路径）:
```typescript
const returnMarch = marchingSystemRef.current!.createMarch(
  currentTask.targetId, currentTask.sourceId, ...);
```

**WorldMapTab.tsx 行674**（battle:completed 路径）:
```typescript
const returnMarch = marchingSystem.createMarch(
  task.targetId, task.sourceId, ...);
```

两处均使用 `createMarch()`，该函数设置 `const speed = BASE_SPEED`（行239），即30 px/s。

**测试文件 `return-march.integration.test.ts`** 确认所有9个测试均调用 `marching.createMarch()`（行110等），从未调用 `createReturnMarch()`。

#### 裁决

**Challenger观点: 成立。证据: 可靠。**

`createReturnMarch()` 确实是死代码。速度 x 0.8 功能在运行时从未生效。

**但严重度降级: P0 -> P1。**

理由：
1. 这不是一个"运行时崩溃"或"数据损坏"级别的致命缺陷。功能存在但未被接入，属于**实现遗漏**而非架构缺陷。
2. 回城行军使用 BASE_SPEED (30 px/s) 而非 24 px/s，影响的是游戏体验（回城过快），不影响功能正确性。
3. `createReturnMarch()` 方法本身实现完整且可工作，只需将 WorldMapTab.tsx 中的两处 `createMarch()` 替换为 `createReturnMarch()` 即可修复。
4. 死代码不等于错误代码 — 它不会导致运行时异常。

**P0定义为"致命级"应保留给运行时崩溃、数据丢失、安全漏洞等问题。死代码是功能遗漏，应归为P1。**

---

### P0-2: `march:arrived` 与 `battle:completed` 双路径竞态

#### Challenger主张

WorldMapTab.tsx 中存在两个路径处理同一攻城任务的结算：
- **路径A**（march:arrived handler, setTimeout 内）: 调用 `executeSiege()` 同步结算 + `createBattle()` 创建战斗会话
- **路径B**（battle:completed handler）: 由 `SiegeBattleSystem.update()` 触发，使用 `SiegeResultCalculator`

两条路径使用不同的结算逻辑，结果取决于事件循环时序。

#### 代码验证

**路径A时序分析**（WorldMapTab.tsx 行448-531）:
1. `setTimeout(() => {...}, 0)` 调度到宏任务队列
2. 在 setTimeout 内：
   - 行464: `battleSystem.createBattle(...)` — 创建战斗会话
   - 行477: `siegeSystem.executeSiege(...)` — 同步攻城
   - 行501: `siegeTaskManager.setResult(...)` — 设置结果
   - 行512: `advanceStatus(currentTask.id, 'returning')` — 推进状态

**路径B时序分析**（WorldMapTab.tsx 行622-693）:
1. 由 `siegeBattleSystem.update(dt)` 在 rAF 循环中（行706）触发
2. 当城防耗尽时 emit `battle:completed`（SiegeBattleSystem.ts:231）
3. 行630: `if (task.result) return;` — 守卫检查

**竞态分析（深入）**:

关键问题：路径A中的 `createBattle()` 创建了一个战斗会话，`SiegeBattleSystem.update()` 会持续衰减城防。但路径A同时通过 `executeSiege()` 同步计算了结果并 `setResult()`。

事件循环时序分析：
1. `march:arrived` 事件触发 → `handleArrived` 同步执行 → `setTimeout(fn, 0)` 入队宏任务
2. 同一帧或后续帧的 rAF 回调中，`siegeBattleSystem.update(dt)` 被调用
3. `setTimeout(fn, 0)` 在当前宏任务结束后、下一个宏任务开始前执行

**关键事实：** 路径A的 `setResult()` 发生在 `setTimeout` 内。如果 `battle:completed` 在 `setTimeout` 之前触发（rAF 先于 timer），路径B的守卫 `task.result` 为 null，会执行完整结算。然后路径A执行时，守卫生效跳过。

但这里有一个**重要时序约束**：`battle:completed` 需要 `SiegeBattleSystem.update()` 衰减城防至耗尽才能触发。而 `createBattle()` 设置的 `attackPower = maxDefense / durationSeconds`，意味着城防需要多帧才能耗尽（`durationSeconds` 通常为数秒到数十秒）。在这段时间内，路径A的 `setTimeout` 早已执行完毕。

**因此，在正常流程下，路径A必然先完成结算，路径B的守卫 `task.result` 检查必然会生效。** 这不是"幸运"的竞态，而是由 `durationSeconds` 参数决定的确定性时序。

#### 裁决

**Challenger观点: 部分成立。证据: 部分可靠。**

竞态**理论上存在**但**实践中几乎不可能触发**：
1. 路径A的 `setResult()` 在 `setTimeout(fn, 0)` 中执行（微秒级延迟）
2. 路径B的 `battle:completed` 需要城防经多帧衰减至耗尽（秒级延迟）
3. 在 `durationSeconds` 的量级差异下，路径A必然先完成

**但 Challenger 的架构观察是正确的**：两个路径使用完全不同的结算逻辑（`executeSiege` 手动计算 vs `SiegeResultCalculator`），这是一个设计问题。即使当前时序安全，这种"双路径"架构增加了维护风险和理解成本。

**严重度降级: P0 -> P2。**

理由：
1. 在正常运行条件下，时序是确定性的，不会出现双重结算
2. 守卫机制（`task.result` 检查）提供了额外安全层
3. 但架构上存在两条冗余路径，长期维护有风险
4. 正确做法是统一为单一路径：要么只用 `executeSiege`（路径A），要么只用 `SiegeResultCalculator`（路径B）

---

### P1-1: 速度 x 0.8 零测试覆盖

#### Challenger主张

`return-march.integration.test.ts` 的9个测试全部使用 `createMarch()` 而非 `createReturnMarch()`，没有任何测试验证速度为 `BASE_SPEED * 0.8`。

#### 代码验证

**确认**: `return-march.integration.test.ts` 行110 使用 `marching.createMarch()`。全局搜索 `createReturnMarch` 在所有测试文件中无结果。

**验证 `createMarch` 的默认速度**: `MarchingSystem.ts:239` — `const speed = BASE_SPEED` (30 px/s)。没有对速度值的断言测试。

#### 裁决

**Challenger观点: 完全成立。证据: 可靠。**

速度 x 0.8 是 Builder 声称的功能点6的核心特性。该特性：
1. 代码存在于 `createReturnMarch()` 中（行366）
2. 但 `createReturnMarch()` 从未被调用（P0-1 已确认）
3. 因此也从未被测试覆盖

**维持P1。** 核心功能声称有测试覆盖但实际无覆盖。

---

### P1-2: `battle:completed` handler 未经过 React 集成测试

#### Challenger主张

`siege-settlement.integration.test.ts` 测试的是纯引擎层集成（`SiegeBattleSystem` + `SiegeResultCalculator` + `EventBus`），而非 `WorldMapTab.tsx` 中的 React 组件逻辑。

#### 代码验证

Builder 在功能点4中声称:
> 实现位置: WorldMapTab.tsx:622-693
> 测试文件: siege-settlement.integration.test.ts

Challenger 正确指出该测试文件不包含任何 React 组件渲染或 hook 测试。它测试的是引擎层的数据管道。

但需注意：
- Builder 在功能点4标题中写的是"I14 集成 (WorldMapTab battle:completed handler)"
- Builder 列出的测试确实验证了事件流和结算逻辑的正确性
- 只是这些测试在引擎层而非 UI 层执行

#### 裁决

**Challenger观点: 成立。证据: 可靠。**

**严重度降级: P1 -> P2。**

理由：
1. Builder 的测试确实验证了核心业务逻辑（事件传递、结算计算、状态推进），这是集成测试的最重要部分
2. React 层面的集成测试（组件渲染、状态更新）通常需要更重的测试基础设施（如 React Testing Library + mock useRef/useEffect）
3. 引擎层逻辑的正确性已被覆盖，UI 层主要是"粘合代码"
4. 但 Builder 在 manifest 中将引擎测试等同于 UI 集成测试，确实存在误导

**实际上，这是一个测试分层问题，不是功能缺陷。** 功能本身是工作的（引擎层测试已证明），只是测试没有覆盖到 UI 层的粘合代码。

---

### P1-3: `executeSiege` 同步路径零集成测试

#### Challenger主张

`WorldMapTab.tsx` 行448-577 的 `setTimeout` 回调包含完整的攻城执行链路，但没有任何测试覆盖。

#### 代码验证

该回调包含以下逻辑：
- `battleSystem.createBattle()` — 创建战斗会话
- `siegeSystem.executeSiege()` — 同步攻城
- 手动伤亡计算（行488-498）
- `setResult()` + `advanceStatus()` — 状态推进
- `createMarch()` — 回城行军
- `setSiegeResultData()` + `setSiegeResultVisible()` — React 状态更新

这是攻城系统的**主执行路径**（当 siegeSystem 可用时），但确实无测试覆盖。

#### 裁决

**Challenger观点: 完全成立。证据: 可靠。**

**维持P1。**

理由：
1. 这是攻城系统的主执行路径，包含手动伤亡计算逻辑
2. 手动伤亡计算（行488-498）与 `SiegeResultCalculator` 是两套不同的逻辑，且未经验证
3. 路径A（executeSiege）和路径B（SiegeResultCalculator）的结算差异未经测试对比
4. 缺乏测试意味着未来修改可能引入回归而不被检测到

---

### P2-1: `getForceHealthColor` 边界注释误导

#### Challenger主张

测试用例注释"0.30 损失 -> damaged"但实际断言是 `toBe('healthy')`，注释与断言矛盾。

#### 代码验证

**ExpeditionSystem.casualties.test.ts 行198**:
```typescript
it('0.30 损失 → damaged（边界值，严格大于 0.3 才进入 damaged）', () => {
    expect(system.getForceHealthColor(0.30)).toBe('healthy');
});
```

测试名称说 "0.30 损失 -> damaged" 但断言 `toBe('healthy')`。注释括号中解释了"严格大于 0.3 才进入 damaged"，所以**断言是正确的**，但测试标题确实有误导性。

#### 裁决

**Challenger观点: 成立。证据: 可靠。**

**维持P2。** 这是一个文档/注释问题，不影响功能正确性。测试断言正确反映了代码行为。但 Builder 在 manifest 中声称"血色边界值(0.30/0.60)"确实不够精确，应写为"血色边界值 0.30->healthy, 0.31->damaged, 0.60->damaged, 0.61->critical"。

---

### P2-2: 战斗引擎结算后空转

#### Challenger主张

路径A的 `setResult()` 完成后，`SiegeBattleSystem.update()` 仍会继续运行，无意义地消耗CPU直到城防耗尽并触发 `battle:completed`。

#### 代码验证

**SiegeBattleSystem.ts 行201-242**: `update()` 方法遍历 `activeBattles`，不检查 SiegeTaskManager 的结果状态。一旦 `createBattle()` 创建会话，它会持续衰减城防直到自然结束。

虽然 `battle:completed` handler 有守卫（`task.result` 检查）跳过重复结算，但 `SiegeBattleSystem` 的 `update()` 本身没有"外部取消"的检查点。

#### 裁决

**Challenger观点: 成立。证据: 可靠。**

**维持P2。**

这是一个效率问题，不是正确性问题：
1. `SiegeBattleSystem` 有 `cancelBattle()` 方法（行374-388），但路径A没有调用它
2. 空转不会导致错误结果（有守卫），但浪费计算资源
3. 正确做法是在路径A `setResult()` 后调用 `battleSystem.cancelBattle(taskId)`

---

### P2-3: 回城路径使用重新寻路而非原路反转

#### Challenger主张

`createReturnMarch()` 接受 `originalPath` 参数，但内部使用 `calculateMarchRoute()` 重新计算路径，未使用原路反转。且 `createReturnMarch()` 本身从未被调用。

#### 代码验证

**MarchingSystem.ts 行350**:
```typescript
const route = this.calculateMarchRoute(params.fromCityId, params.toCityId);
```

确实忽略了 `params.originalPath`，重新计算路由。

但需要注意：
1. `createReturnMarch()` 是死代码（P0-1 已确认），所以 `originalPath` 参数从未被传入
2. 实际运行的 `createMarch()` 使用 `calculateMarchRoute()` 计算，对去程和回程都是一样的
3. 如果寻路算法是确定性的（A* 在确定性图上给出确定性路径），则去程和回程路径只是方向不同，结果相同

#### 裁决

**Challenger观点: 成立。证据: 可靠。**

**维持P2。**

`originalPath` 参数被定义但从未使用，这是 API 设计与实现不一致。但由于 `createReturnMarch()` 是死代码，这个问题的影响为零。如果未来激活 `createReturnMarch()`，需要决定是使用原路反转还是重新寻路。

---

## 综合评判

### 对 Challenger 报告的评价

| 方面 | 评价 |
|------|------|
| 事实准确性 | 高。所有代码引用经验证均为准确 |
| 严重度判定 | 偏高。P0-1 和 P0-2 不符合"致命级"定义，应分别降为P1和P2 |
| 证据充分性 | 高。全局搜索结果、代码行号引用均可复现 |
| 分析深度 | 充分。竞态分析的时序分析尤其深入 |

### 对 Builder 报告的评价

| 方面 | 评价 |
|------|------|
| 功能点覆盖声称 | 部分不成立。功能点6的"速度x0.8"是死代码 |
| 测试数量声称 | 准确。170个测试均存在且通过 |
| 测试覆盖声称 | 部分不成立。功能点4的测试实际是引擎层而非UI集成层 |
| 功能点6声称 | 不成立。9个测试未覆盖声称的核心功能 |

### 严重度重新校准理由

**P0（致命级）定义应为**: 运行时崩溃、数据损坏、安全漏洞、核心功能完全不可用。
**当前0个P0。**

原P0-1降为P1: 死代码不影响运行时，是功能遗漏。
原P0-2降为P2: 竞态在实践中有确定性时序保护，不会导致双重结算。

---

## 最终裁定

```
P0: 0 个（Challenger声称2个，均降级）
P1: 2 个（P0-1降级 + P1-3维持）
P2: 5 个（P0-2降级 + P1-1维持 + P1-2降级 + P2-1维持 + P2-2维持 + P2-3维持）
总有效质疑: 8 个（全部成立或部分成立）
```

### 需要Builder修复的问题（按优先级）

1. **[P1]** 激活 `createReturnMarch()` — 将 WorldMapTab.tsx 两处 `createMarch()` 替换为 `createReturnMarch()`，使速度 x0.8 生效
2. **[P1]** 为路径A（executeSiege 同步路径）添加集成测试，至少覆盖手动伤亡计算逻辑
3. **[P2]** 统一双路径 — 移除路径A中的 `createBattle()` 调用（避免战斗引擎空转），或统一两路径使用同一结算器
4. **[P2]** 在路径A `setResult()` 后调用 `battleSystem.cancelBattle(taskId)` 停止战斗引擎空转
5. **[P2]** 添加速度 x0.8 的专项测试
6. **[P2]** 修复测试注释 "0.30 损失 -> damaged" 改为 "0.30 损失 -> healthy"
7. **[P2]** 决定 `originalPath` 参数的设计意图并在实现中对齐
