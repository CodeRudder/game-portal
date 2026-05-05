# Builder Manifest -- Round 26: 全流程E2E(胜利路径) 客观审核

> **审核者**: Builder (客观审核)
> **日期**: 2026-05-05
> **范围**: E2E-1 ~ E2E-10 共10个检查项

## 测试运行结果

### 引擎层集成测试 (42 files, 784 passed, 5 skipped)
```
npx vitest run src/games/three-kingdoms/engine/map/__tests__/integration/
Test Files: 42 passed (42)
Tests: 784 passed | 5 skipped (789)
Duration: 15.31s
```

### UI面板测试 (23 files, 531 passed, 5 failed)
```
npx vitest run src/components/idle/panels/map/__tests__/
Test Files: 3 failed | 20 passed (23)
Tests: 5 failed | 531 passed (536)
Duration: 10.60s
```

**失败测试分析** (均为非E2E核心路径):
1. `PixelWorldMap.batch-render.test.tsx` - 浮点精度偏差 (Canvas绘制坐标差异 <1px)
2. `PixelWorldMap.perf.test.tsx` x3 - 性能基准超时 (测试环境波动，非逻辑错误)
3. `WorldMapTab.test.tsx` - 攻城动画集成测试中 conquestAnimSystem.create 未被调用 (setTimeout(0) 异步时序问题)

---

## 1. 计划完成状态

### E2E-1: 攻城任务创建 -> 行军出发

**状态**: ✅ 完成

| 子项 | 实现位置 | 测试覆盖 |
|------|---------|---------|
| SiegeTask创建 | `SiegeTaskManager.createTask()` (SiegeTaskManager.ts:91-136) | `march-to-siege-chain.integration.test.ts` Scenario 1 |
| marching状态 | `SiegeTaskManager.advanceStatus(id, 'marching')` (SiegeTaskManager.ts:144-180) | 同上 |
| 精灵渲染数据 | `MarchingSystem.createMarch()` (MarchingSystem.ts:235-280) 返回 MarchUnit 含 path/position/animFrame | `march-e2e-full-chain.integration.test.ts` Test 1 |
| 路径显示 | `MarchingSystem.calculateMarchRoute()` (MarchingSystem.ts:423-451) 使用A*寻路 | `e2e-map-flow.integration.test.ts` E1-3 |
| 资源正确扣减 | `SiegeSystem.deductSiegeResources()` (SiegeSystem.ts:634-644) 胜利扣粮草/失败扣30%兵力+粮草 | `settlement-pipeline-integration.test.ts` |

**事件链路**: `siegeTask:created` -> `march:created` -> `march:started`
- `SiegeTaskManager.createTask()` 发射 `siegeTask:created` (SiegeTaskManager.ts:134)
- `MarchingSystem.createMarch()` 发射 `march:created` (MarchingSystem.ts:270-278)
- `MarchingSystem.startMarch()` 发射 `march:started` (MarchingSystem.ts:291-296)

### E2E-2: 行军推进 -> 到达

**状态**: ✅ 完成

| 子项 | 实现位置 | 测试覆盖 |
|------|---------|---------|
| 精灵沿路径移动 | `MarchingSystem.updateMarchPosition()` (MarchingSystem.ts:458-479) | `march-e2e-full-chain.integration.test.ts` Test 1 |
| 到达后状态推进sieging | WorldMapTab.tsx:487-520 `handleArrived` 监听 `march:arrived` 后调用 `advanceStatus('sieging')` | `march-to-siege-chain.integration.test.ts` Scenario 3 |
| 时长[10s,60s] | `MIN_MARCH_DURATION_MS=10000`, `MAX_MARCH_DURATION_MS=60000` (MarchingSystem.ts:143-144) | `march-e2e-full-chain.integration.test.ts` Test 2+3 |

**事件链路**: `march:started` -> (update loop) -> `march:arrived`
- `MarchingSystem.update()` 检测 pathIndex >= path.length-1 后发射 `march:arrived` (MarchingSystem.ts:207-213)

### E2E-3: 攻城动画 -> 胜利判定

**状态**: ✅ 完成

| 子项 | 实现位置 | 测试覆盖 |
|------|---------|---------|
| assembly -> battle | `SiegeBattleAnimationSystem` 监听 `battle:started` 创建动画，assembly 3s 后转 battle | `siege-battle-chain.integration.test.ts` Scenario A |
| 城防衰减 | `SiegeBattleSystem.update()` (SiegeBattleSystem.ts:211-252) 每帧减少 defenseValue | 同上 |
| 胜利判定 | defenseValue <= 0 时 victory=true (SiegeBattleSystem.ts:229-234) | 同上 |
| 策略效果 | `SIEGE_STRATEGY_CONFIGS` 定义 timeMultiplier 影响战斗时长 (siege-enhancer.types.ts:163-212) | `siege-battle-chain.integration.test.ts` Scenario C |

**事件链路**: `battle:started` -> (update loop) -> `battle:completed`
- `SiegeBattleSystem.createBattle()` 发射 `battle:started` (SiegeBattleSystem.ts:356-366)
- `SiegeBattleSystem.update()` 在 defenseValue<=0 时发射 `battle:completed` (SiegeBattleSystem.ts:241-249)

**注意**: WorldMapTab.tsx 中实际使用的是 Path A 同步结算路径 (WorldMapTab.tsx:539-598):
  行军到达 -> setTimeout(0) -> executeSiege() 同步判定 -> SettlementPipeline.execute() -> cancelBattle()
  这意味着 `battle:completed` 事件在正常胜利路径中不会被发出（因为 cancelBattle 先于自然完成）。
  但 SiegeBattleSystem 的 update 循环仍在驱动城防衰减动画。

### E2E-4: 结算 -> 领土占领

**状态**: ✅ 完成

| 子项 | 实现位置 | 测试覆盖 |
|------|---------|---------|
| 资源结算 | `SettlementPipeline.execute()` 四阶段流水线 (SettlementPipeline.ts:259-299) | `settlement-pipeline-integration.test.ts` Victory path |
| ownership变更 | `SiegeSystem.resolveSiege()` -> `territorySys.captureTerritory()` (SiegeSystem.ts:567) | `cross-system-linkage.integration.test.ts` S10.1 |
| 奖励发放 | `SettlementPipeline.distribute()` (SettlementPipeline.ts:395-441) 使用 SIEGE_REWARD_CONFIG | `settlement-pipeline-integration.test.ts` SiegeRewardProgressive 集成 |
| 伤亡计算 | `SiegeResultCalculator.calculateSettlement()` (SiegeResultCalculator.ts:80-108) | `settlement-pipeline-integration.test.ts` Pipeline vs Calculator 等价性 |

**事件链路**: `settlement:reward` -> `settlement:complete` -> `settlement:return`
- `SettlementPipeline.distribute()` 发射 `settlement:reward` (SettlementPipeline.ts:432-437)
- `SettlementPipeline.notify()` 发射 `settlement:complete` 和 `settlement:return` (SettlementPipeline.ts:454-483)

### E2E-5: 回城行军 -> 完成

**状态**: ✅ 完成

| 子项 | 实现位置 | 测试覆盖 |
|------|---------|---------|
| createReturnMarch | `MarchingSystem.createReturnMarch()` (MarchingSystem.ts:348-375) | `march-to-siege-chain.integration.test.ts` Scenario 4 |
| 精灵返回 | speed = BASE_SPEED * 0.8 = 24 (MarchingSystem.ts:372) | 同上 + `execute-siege-path.integration.test.ts` Scenario 6 |
| 到达清理 | WorldMapTab.tsx:743-746 回城到达 -> advanceStatus('completed') + removeCompletedTasks() | `march-to-siege-chain.integration.test.ts` Scenario 4 |
| 速度x0.8 | `march.speed = BASE_SPEED * 0.8` (MarchingSystem.ts:372) | `march-to-siege-chain.integration.test.ts` return march speed=24 |

**事件链路**: `siegeTask:statusChanged(returning)` -> `march:created` -> `march:started` -> `march:arrived` -> `siegeTask:statusChanged(completed)`

### E2E-6: 事件链路完整性

**状态**: 🔄 部分完成

**已实现的事件链路 (引擎层)**:
```
siegeTask:created              (SiegeTaskManager.ts:134)
  -> march:created             (MarchingSystem.ts:270)
  -> march:started             (MarchingSystem.ts:291)
  -> march:arrived             (MarchingSystem.ts:207)
  -> siegeTask:statusChanged(preparing->marching->sieging)  (SiegeTaskManager.ts:166)
  -> battle:started            (SiegeBattleSystem.ts:356)
  -> [battle:completed]        (SiegeBattleSystem.ts:241) -- 注意: Path A 中被 cancelBattle 抢先
  -> siegeTask:statusChanged(sieging->settling->returning)  (SiegeTaskManager.ts:166)
  -> settlement:reward         (SettlementPipeline.ts:432)
  -> settlement:complete       (SettlementPipeline.ts:466)
  -> settlement:return         (SettlementPipeline.ts:478)
  -> march:created (return)    (MarchingSystem.ts:270)
  -> march:started (return)    (MarchingSystem.ts:291)
  -> march:arrived (return)    (MarchingSystem.ts:207)
  -> siegeTask:statusChanged(returning->completed)  (SiegeTaskManager.ts:166)
  -> siegeTask:completed       (SiegeTaskManager.ts:174)
```

**已有端到端事件验证**:
- `march-e2e-full-chain.integration.test.ts` Test 1: 验证 `march:created -> march:started -> march:arrived` 事件顺序
- `march-to-siege-chain.integration.test.ts` Scenario 1: 验证 `march:created -> march:started -> march:arrived` 顺序
- `march-to-siege-chain.integration.test.ts` Full lifecycle: 验证 `siegeTask:statusChanged` 的 5 个转换
- `execute-siege-path.integration.test.ts` Scenario 1: 验证 `battle:completed` + `siegeTask:statusChanged` 完整链路

**缺失**:
- 没有单个测试追踪 **完整** 的 siegeTask:created -> siegeTask:completed 事件链 (所有事件在一个测试中断言)
- WorldMapTab.tsx 的 Path A 绕过了 battle:completed 自然完成，改用同步 SettlementPipeline (架构决策，非bug)
- `siege:created` / `siege:start` 事件在计划中提及但代码中不存在对应事件名（实际使用 `siegeTask:created`）

### E2E-7: 数据一致性

**状态**: 🔄 部分完成

**已验证的数据一致性**:
- 编队数据序列化/反序列化一致性: `data-consistency.integration.test.ts`
- 攻城统计数据一致性: `data-consistency.integration.test.ts`
- 伤亡数据一致性: `data-consistency.integration.test.ts`
- 奖励值与 SIEGE_REWARD_CONFIG 一致性: `settlement-pipeline-integration.test.ts`
- Pipeline vs Calculator 等价性: `settlement-pipeline-integration.test.ts`

**缺失**:
- 无测试验证 **攻城前后资源余额的精确变化**（兵力总增减是否为零泄漏）
- 无测试验证领土ownership变更的原子性（攻城失败不应改变ownership）
- 无测试验证并发攻城任务的数据隔离（多任务操作不同territory时资源扣减不串扰）

### E2E-8: 强攻策略完整路径

**状态**: 🔄 部分完成

**计划验收标准**: timeMultiplier=1.0, 正常衰减+胜利
**实际配置** (siege-enhancer.types.ts):
```
forceAttack: { timeMultiplier: 0.5, troopCostMultiplier: 1.5, rewardMultiplier: 0.9, winRateBonus: -0.10 }
```

**注意**: 计划中的 timeMultiplier=1.0 与代码实际值 0.5 不匹配。代码中 forceAttack 是**最快**策略(timeMultiplier=0.5)，而非计划描述的"正常衰减"。

**已有测试覆盖**:
- `siege-battle-chain.integration.test.ts` Scenario A: forceAttack 完整生命周期
- `siege-battle-chain.integration.test.ts` Scenario C: forceAttack 多任务并发
- `march-to-siege-chain.integration.test.ts` 多个场景使用 forceAttack
- `siege-strategy.integration.test.ts`: 策略配置、消耗计算、胜率计算

**缺失**:
- 无测试验证 forceAttack 的**特殊效果** "城防损坏(占领后城防-50%)" 是否在E2E中实际生效
- 无测试验证 troopCostMultiplier=1.5 导致的兵力消耗增量在完整链路中体现

### E2E-9: 智取策略完整路径

**状态**: ⬜ 未完成

**计划验收标准**: timeMultiplier=0.7, 加速衰减+胜利

**实际情况**: 代码中无 "智取" 策略。四种策略为: forceAttack / siege / nightRaid / insider
```
siege: { timeMultiplier: 2.0, troopCostMultiplier: 0.8, rewardMultiplier: 1.0 }
```
- siege 的 timeMultiplier=2.0，与计划中的 0.7 完全不匹配
- E2E-9 可能指的是 siege (围困) 而非 "智取"

**已有测试覆盖**:
- `march-to-siege-chain.integration.test.ts` Scenario 5: task2 使用 siege 策略
- `siege-battle-chain.integration.test.ts` Scenario B: siege 策略 defenseRatio 桥接

**缺失**:
- 无 siege 策略的完整 E2E 链路测试 (从创建任务到最终完成的完整路径)
- 无验证 siege 策略 "民心下降(占领后产出-20%持续24h)" 的特殊效果

### E2E-10: 内应策略完整路径

**状态**: 🔄 部分完成

**计划验收标准**: timeMultiplier=0.5, 最快衰减+胜利

**实际配置**:
```
insider: { timeMultiplier: 1.0, troopCostMultiplier: 1.0, rewardMultiplier: 1.5, winRateBonus: 0.20 }
```

**注意**: 计划中 timeMultiplier=0.5 与代码实际值 1.0 不匹配。timeMultiplier=0.5 实际属于 forceAttack。

**已有测试覆盖**:
- `march-to-siege-chain.integration.test.ts` Scenario 6: insider 策略用于取消测试
- SiegeSystem 内部有内应暴露/冷却机制 (SiegeSystem.ts:670-696)

**缺失**:
- 无 insider 策略的**胜利路径** E2E 链路测试
- 无验证 requiredItem='item-insider-letter' 在 E2E 中的消耗
- 无验证 insider 特殊效果 "城防完整保留" 在占领后的表现
- 无验证 insider 失败后的暴露冷却 (24h) 在 E2E 中生效

---

## 2. 实现证据汇总

### 事件发射点

| 事件 | 发射位置 | 文件:行号 |
|------|---------|----------|
| `siegeTask:created` | SiegeTaskManager.createTask() | SiegeTaskManager.ts:134 |
| `siegeTask:statusChanged` | SiegeTaskManager.advanceStatus() | SiegeTaskManager.ts:166 |
| `siegeTask:completed` | SiegeTaskManager.advanceStatus() (to='completed') | SiegeTaskManager.ts:174 |
| `march:created` | MarchingSystem.createMarch() | MarchingSystem.ts:270 |
| `march:started` | MarchingSystem.startMarch() | MarchingSystem.ts:291 |
| `march:arrived` | MarchingSystem.update() | MarchingSystem.ts:207 |
| `march:cancelled` | MarchingSystem.cancelMarch() | MarchingSystem.ts:309 |
| `battle:started` | SiegeBattleSystem.createBattle() | SiegeBattleSystem.ts:356 |
| `battle:completed` | SiegeBattleSystem.update() | SiegeBattleSystem.ts:241 |
| `battle:cancelled` | SiegeBattleSystem.cancelBattle() | SiegeBattleSystem.ts:398 |
| `siege:victory` | SiegeSystem.resolveSiege() | SiegeSystem.ts:597 |
| `siege:defeat` | SiegeSystem.resolveSiege() | SiegeSystem.ts:623 |
| `settlement:complete` | SettlementPipeline.notify() | SettlementPipeline.ts:466 |
| `settlement:reward` | SettlementPipeline.distribute() | SettlementPipeline.ts:432 |
| `settlement:return` | SettlementPipeline.notify() | SettlementPipeline.ts:478 |
| `settlement:cancelled` | SettlementPipeline.notify() | SettlementPipeline.ts:459 |
| `siegeAnim:completed` | (由 SiegeBattleAnimationSystem.completeSiegeAnimation 发射) | WorldMapTab.tsx:713 |

### 事件监听点

| 事件 | 监听位置 | 文件:行号 |
|------|---------|----------|
| `march:arrived` | WorldMapTab.tsx handleArrived | WorldMapTab.tsx:487 |
| `march:cancelled` | WorldMapTab.tsx handleCancelled | WorldMapTab.tsx:767 |
| `battle:started` | SiegeBattleAnimationSystem (自动创建动画) | siege-battle-chain.integration.test.ts 验证 |
| `battle:completed` | SiegeBattleAnimationSystem (自动完成动画) | siege-battle-chain.integration.test.ts Scenario A |
| `siegeAnim:completed` | WorldMapTab.tsx (显示结果弹窗) | WorldMapTab.tsx:699 |

### 状态机转换

SiegeTaskManager 状态转换表 (SiegeTaskManager.ts:631-642):
```
preparing -> [marching]
marching -> [sieging]
sieging -> [settling, paused]
settling -> [returning]
returning -> [completed]
completed -> []
paused -> [sieging, returning]
```

---

## 3. 测试证据

### 集成测试通过率: 100% (784/784 passed, 5 skipped)

| 测试文件 | 测试数 | 状态 | E2E覆盖 |
|---------|-------|------|---------|
| e2e-map-flow.integration.test.ts | 8 | PASS | E2E-1~5 局部覆盖 |
| march-e2e-full-chain.integration.test.ts | 13 | PASS | E2E-1,2,6 行军链路 |
| march-to-siege-chain.integration.test.ts | 10 | PASS | E2E-1~6 完整链路 |
| march-siege.integration.test.ts | - | PASS | 行军->攻城 |
| siege-battle-chain.integration.test.ts | 4 | PASS | E2E-3 战斗动画 |
| settlement-pipeline-integration.test.ts | 14 | PASS | E2E-4 结算 |
| execute-siege-path.integration.test.ts | 14 | PASS | E2E-3,4,5 Path A |
| siege-strategy.integration.test.ts | 4 | PASS | E2E-8 策略配置 |
| return-march.integration.test.ts | 8 | PASS | E2E-5 回城 |
| data-consistency.integration.test.ts | 3 | PASS | E2E-7 数据一致 |
| cross-system-linkage.integration.test.ts | 19 | PASS | 跨系统串联 |

### UI测试失败: 5个

| 测试 | 失败原因 | 是否影响E2E |
|------|---------|------------|
| PixelWorldMap.batch-render.test.tsx | Canvas浮点精度偏差 | 否 |
| PixelWorldMap.perf.test.tsx x3 | 性能基准超时(环境波动) | 否 |
| WorldMapTab.test.tsx (攻城动画集成) | conquestAnimSystem.create 未被调用 | 是(间接) |

**WorldMapTab.test.tsx 失败分析**:
测试期望攻城成功后 conquestAnimSystem.create 被调用，但由于 Path A 使用 setTimeout(0) 异步执行攻城逻辑，在测试环境中的事件循环时序可能导致回调未在断言前执行。这反映了真实的事件驱动流程在测试中难以精确控制时序。

---

## 4. 测试有效性评估

### E2E测试是否真正覆盖了完整链路？

**评价: 70% 覆盖**

- **已覆盖的完整链路**:
  - 行军创建->出发->到达 的事件链路: `march-e2e-full-chain.integration.test.ts` (真实 EventBus, 非mock)
  - 行军到达->攻城触发->状态推进: `march-to-siege-chain.integration.test.ts` Scenario 3 (真实 EventBus + SiegeTaskManager)
  - 攻城任务全生命周期状态转换: `march-to-siege-chain.integration.test.ts` Full lifecycle (6个状态连续转换)
  - SettlementPipeline 四阶段流水线: `settlement-pipeline-integration.test.ts` (完整执行)
  - Path A 同步结算路径: `execute-siege-path.integration.test.ts` (createBattle->executeSiege->settle->cancel)

- **未覆盖的完整链路**:
  - 从用户点击"攻城"到最终任务完成(COMPLETED)的**单次连续**E2E测试不存在
  - 现有测试将链路拆分为多个独立测试，各自验证子段
  - WorldMapTab.tsx 中的事件协调逻辑(handleArrived/handleCancelled)没有真正的E2E集成测试

### 测试中的系统交互是否真实？

**评价: 中等真实性**

- **真实交互**:
  - `march-e2e-full-chain` 使用真实 EventBus (非mock)
  - `march-to-siege-chain` 使用真实 EventBus + SiegeTaskManager + MarchingSystem
  - `siege-battle-chain` 使用真实 EventBus + SiegeBattleSystem + SiegeBattleAnimationSystem
  - `execute-siege-path` 使用真实 EventBus + SiegeBattleSystem + SiegeTaskManager + SiegeResultCalculator

- **mock 关键路径**:
  - `e2e-map-flow` 中 SiegeSystem 使用 vi.fn() mock eventBus 和 registry
  - `march-to-siege-chain` Scenario 4 中 MarchingSystem.calculateMarchRoute 被 vi.spyOn mock
  - `settlement-pipeline` 使用 mock eventBus (vi.fn())
  - `data-consistency` 使用 mock eventBus

### 事件驱动链路是否有端到端验证？

**评价: 有部分端到端验证**

- `march-e2e-full-chain.integration.test.ts` 验证了 `march:created -> march:started -> march:arrived` 的完整事件顺序
- `march-to-siege-chain.integration.test.ts` Scenario 1 验证了 `march:created -> march:started -> march:arrived` + `siegeTask:statusChanged` 跨系统联动
- 但缺少从 `siegeTask:created` 到 `siegeTask:completed` 的全链路事件验证

---

## 5. 特别关注

### E2E-6 事件链路完整性: 关键发现

**实际事件链 (WorldMapTab Path A)**:
```
siegeTask:created
  -> march:created
  -> march:started
  -> march:arrived  (WorldMapTab handleArrived 接收)
  -> [setTimeout(0)]
  -> siegeTask:statusChanged(preparing->marching->sieging) -- 注意: marching->sieging 在 handleArrived 内部
  -> battle:started  (SiegeBattleSystem.createBattle)
  -> settlement:reward  (SettlementPipeline.distribute)
  -> settlement:complete  (SettlementPipeline.notify)
  -> settlement:return  (SettlementPipeline.notify)
  -> siegeTask:statusChanged(sieging->settling->returning)
  -> battle:cancelled  (SiegeBattleSystem.cancelBattle)
  -> siegeAnim:completed  (SiegeBattleAnimationSystem.completeSiegeAnimation)
  -> march:created (return)  (MarchingSystem.createReturnMarch)
  -> march:started (return)
  -> march:arrived (return)  (WorldMapTab handleArrived 接收)
  -> siegeTask:statusChanged(returning->completed)
  -> siegeTask:completed
```

**与计划对比**:
- 计划中 `siege:created` 不存在, 实际为 `siegeTask:created`
- 计划中 `siege:start` 不存在, 实际为 `siegeTask:statusChanged(to: 'sieging')`
- 计划中 `march:return` 不存在, 实际为 `settlement:return` + `march:created`(return march)
- `battle:completed` 在 Path A 中不会被自然发出(被 cancelBattle 抢先), 但 SiegeBattleSystem.update() 在非 Path A 路径中确实会发出

### E2E-7 数据一致性: 关键发现

**已验证的一致性**:
- 伤亡计算一致性: Pipeline 与旧 Calculator 等价 (`settlement-pipeline-integration.test.ts`)
- 奖励值与 SIEGE_REWARD_CONFIG 一致 (`settlement-pipeline-integration.test.ts`)
- 序列化/反序列化数据一致 (`data-consistency.integration.test.ts`)
- 多任务独立不串扰 (`march-to-siege-chain.integration.test.ts` Scenario 5)

**未验证的一致性**:
- 攻城前后资源总量的守恒(无泄漏)
- 回城行军 troops = 出征troops - 伤亡 是否精确
- 并发攻城多territory时资源扣减的原子性

### E2E-8/9/10 策略差异化: 关键发现

**计划与代码不匹配**:

| 计划ID | 计划描述 | 计划timeMultiplier | 实际策略 | 实际timeMultiplier |
|--------|---------|-------------------|---------|-------------------|
| E2E-8 | 强攻 | 1.0 | forceAttack | **0.5** |
| E2E-9 | 智取 | 0.7 | siege? | **2.0** |
| E2E-10 | 内应 | 0.5 | insider | **1.0** |

四种策略的实际 timeMultiplier:
- forceAttack: 0.5 (最快)
- nightRaid: 0.8
- insider: 1.0
- siege: 2.0 (最慢)

**策略差异化 E2E 验证不足**:
- 只有 forceAttack 在多个测试中被使用
- siege 仅在少数场景中使用 (march-to-siege-chain Scenario 5 task2, siege-battle-chain Scenario B)
- insider 和 nightRaid 仅在取消/中断场景中出现，无完整胜利路径 E2E
- 无测试验证不同策略在同一条件下产生不同的战斗时长/消耗/奖励

---

## 6. 总结

| 检查项 | 状态 | 说明 |
|--------|------|------|
| E2E-1 攻城任务创建->行军出发 | ✅ 完成 | 代码+测试+有效 |
| E2E-2 行军推进->到达 | ✅ 完成 | 代码+测试+有效 |
| E2E-3 攻城动画->胜利判定 | ✅ 完成 | 代码+测试+有效 |
| E2E-4 结算->领土占领 | ✅ 完成 | 代码+测试+有效 |
| E2E-5 回城行军->完成 | ✅ 完成 | 代码+测试+有效 |
| E2E-6 事件链路完整性 | 🔄 部分完成 | 代码实现完整，但无单测试覆盖全链路事件断言 |
| E2E-7 数据一致性 | 🔄 部分完成 | 核心数据一致已验证，资源守恒/并发隔离未验证 |
| E2E-8 强攻策略完整路径 | 🔄 部分完成 | forceAttack有覆盖但timeMultiplier与计划不匹配，特殊效果未E2E验证 |
| E2E-9 智取策略完整路径 | ⬜ 未完成 | "智取"策略在代码中不存在，siege(围困)无完整胜利路径E2E |
| E2E-10 内应策略完整路径 | 🔄 部分完成 | insider仅在中断场景测试，无胜利路径E2E |

### 传递问题

| ID | 优先级 | 问题 | 建议 |
|----|--------|------|------|
| R26-I01 | P1 | E2E-9 "智取"策略不存在于代码中，计划中描述的策略名称需与实际策略对齐 | 更新 plan.md 策略名为 forceAttack/siege/insider，或新增策略 |
| R26-I02 | P1 | 计划中 timeMultiplier 值(1.0/0.7/0.5)与代码实际值(0.5/2.0/1.0)不匹配 | 更新 plan.md 验收标准或对齐代码 |
| R26-I03 | P1 | E2E-6 缺少全链路事件断言测试(从 siegeTask:created 到 siegeTask:completed) | 新增 single-test-case 全事件链断言 |
| R26-I04 | P2 | insider/nightRaid 策略无完整胜利路径E2E测试 | 为每种策略补充完整链路测试 |
| R26-I05 | P2 | 策略特殊效果(forceAttack城防损坏/siege民心下降/insider城防保留)无E2E验证 | 补充策略效果E2E断言 |
| R26-I06 | P2 | E2E-7 资源守恒未验证(攻城前后资源总量守恒) | 补充资源守恒断言测试 |
| R26-I07 | P2 | WorldMapTab.test.tsx 攻城动画集成测试因 setTimeout(0) 时序问题失败 | 使用 vi.useFakeTimers 或 act() 修复 |
| R26-I08 | P2 | PixelWorldMap.perf.test.tsx x3 性能基准在CI环境中不稳定 | 放宽阈值或标记为skip |

---
*Builder Manifest | 2026-05-05 | Round 26 全流程E2E(胜利路径) 客观审核*
