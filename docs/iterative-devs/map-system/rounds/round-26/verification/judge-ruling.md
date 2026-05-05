# Judge Ruling -- Round 26: 全流程E2E(胜利路径)

> **裁决者**: Judge
> **日期**: 2026-05-05
> **裁决对象**: Builder Manifest (builder-manifest.md) 与 Challenger Attack Report (challenger-attack.md) 的争议点

---

## 裁决方法

逐条读取源代码，对 Challenger 提出的每个质疑进行独立代码核验。所有裁决基于实际源码，不依赖任何一方的声明。

---

## P0 级质疑裁决表

| 质疑ID | 质疑内容 | Challenger结论 | 代码证据 | Judge裁决 | 理由 |
|--------|---------|---------------|---------|----------|------|
| **C-15** | SiegeTaskManager 未调用 setDependencies，siegeTask:* 事件静默失败 | P0 成立 | WorldMapTab.tsx:227 创建 `new SiegeTaskManager()`，全文仅 L484 处出现 `setDependencies`，调用对象是 `settlementPipeline` 而非 `siegeTaskManager`。SiegeTaskManager.ts:134/166/174 均使用 `this.deps?.eventBus.emit(...)`，deps 为 null 时可选链跳过，事件不发射。 | **P0 确认成立** | WorldMapTab 中 SiegeTaskManager 从未注入 eventBus 依赖。createTask(行1154)、advanceStatus(行520/607/632/744/1203) 等调用不会产生任何事件。Builder 声称的 siegeTask:created/siegeTask:statusChanged/siegeTask:completed 事件链在 UI 层完全断链。 |
| **C-03** | executeSiege 调用未传 strategy 参数，策略差异化失效 | P0 成立 | WorldMapTab.tsx:539-544 调用 `siegeSystem.executeSiege(currentTask.targetId, 'player', currentTask.expedition.troops, eng.getResourceAmount?.('grain') ?? 0)` -- 仅4个参数。SiegeSystem.ts:329-335 签名为 `executeSiege(targetId, attackerOwner, availableTroops, availableGrain, strategy?)`。SiegeSystem.ts:350-352: `strategy ? this.simulateBattleWithStrategy(...) : this.simulateBattle(...)` -- 未传策略时走基础模拟。 | **P0 确认成立** | WorldMapTab Path A 中的 SiegeSystem.executeSiege 确实不传 strategy。后果：(1) 胜率计算不使用策略修正的 computeStrategyWinRate；(2) 消耗不使用 troopCostMultiplier；(3) SiegeSystem.resolveSiege 中 strategy 为 undefined，策略特殊效果(城防损坏/民心下降/城防保留)全部不触发。策略选择在 UI 层存在但在实际攻城结算中被完全忽略。 |
| **C-01** | setTimeout(0) 竞态条件导致 UI 层 E2E 验证断链 | P0 声称 | WorldMapTab.tsx:510 使用 `setTimeout(() => {...}, 0)`。防重复守卫在 L513 检查 `currentTask.status !== 'marching'`。marchingSystem.update 在 rAF 循环中运行(行797)。 | **P1 降级 -- 竞态风险存在但非必然触发** | (1) setTimeout(0) 将回调放到宏任务队列末尾，在当前 rAF 帧结束后执行。正常情况下 marchingSystem.update 在同一帧内不会再触发 march:arrived（因为行军已到达，状态已推进，不会再次 emit march:arrived）。(2) 防重复守卫 L513 检查 status !== 'marching' 能过滤绝大多数重复处理。(3) 但确实存在理论竞态：如果 rAF 循环在 setTimeout 回调前再次执行，且 marchingSystem 因某种原因再次 emit march:arrived，则可能触发重复处理。(4) WorldMapTab.test.tsx 攻城动画集成测试的失败确实与此 setTimeout(0) 时序有关，证明在测试环境中该问题可复现。综合判断：实际运行中竞态触发概率较低，但测试环境已暴露问题。降级为 P1，需修复时序问题。 |

---

## P1 级质疑裁决表

| 质疑ID | 质疑内容 | Challenger结论 | 代码证据 | Judge裁决 | 理由 |
|--------|---------|---------------|---------|----------|------|
| **C-02** | UI 层 EventBus 与引擎层 EventBus 完全隔离 | P1 成立 | WorldMapTab.tsx:414-452 创建局部 `listeners` Map 和 `eventBus` 对象（纯 JS 实现），作为 IEventBus 注入给 marchingSystem(行458)、siegeBattleAnimSystem(行462)、siegeBattleSystem(行467)、settlementPipeline(行484)。引擎层 SiegeSystem 通过 `this.deps?.eventBus.emit` 发射 siege:victory/siege:defeat（SiegeSystem.ts:597/623），使用的是引擎初始化时注入的 EventBus。 | **P1 确认成立** | UI 层的局部 EventBus 确实与引擎层 EventBus 完全隔离。引擎层 SiegeSystem 发射的 siege:victory/siege:defeat 事件不会到达 UI 层。但需注意：这不是 Bug 而是架构设计。WorldMapTab 的 Path A 使用同步结算流程，不依赖引擎层事件。SettlementPipeline 使用 UI 层的 EventBus，其事件链（settlement:reward/settlement:complete/settlement:return）在 UI 层内闭环。影响范围是：引擎层事件（siege:victory/siege:defeat）的监听器在 UI 层不会收到通知，如果未来有系统依赖这些事件则会出问题。 |
| **C-04** | 784 个集成测试中大量使用 mock EventBus | P1 成立 | settlement-pipeline-integration.test.ts 使用 `vi.fn()` mock EventBus；data-consistency.integration.test.ts 使用 `vi.fn()` mock EventBus；e2e-map-flow.integration.test.ts 使用 mock EventBus 和 mock registry。 | **P1 确认成立，但影响需量化** | mock EventBus 意味着 emit 调用仅被记录，不触发真实监听器。这降低了测试对事件驱动交互的验证有效性。但 mock EventBus 仍能验证 emit 调用的参数和次数（通过 vi.fn() 的 toHaveBeenCalledWith）。影响：(1) 无法验证事件发射后的级联效果；(2) 无法发现事件名拼写错误；(3) 无法验证事件消费者是否正确响应。但核心业务逻辑（状态转换、资源扣减、胜负判定）仍被有效测试。 |
| **C-05** | 无 siegeTask:created 到 siegeTask:completed 的全链路事件断言测试 | P1 成立 | Builder 自己在 manifest 行 143 承认："没有单个测试追踪完整的 siegeTask:created -> siegeTask:completed 事件链"。 | **P1 确认成立** | 事实性陈述，Builder 自认。无全链路事件测试意味着事件链路中间可能存在断裂点未被检测到。结合 C-15 的发现（SiegeTaskManager 在 UI 层未注入 deps，事件根本不发射），这一问题更加严重。 |
| **C-06** | 攻城前后资源守恒未验证 | P1 成立 | SiegeSystem.ts:595 胜利时扣粮草，SiegeSystem.ts:621 失败时扣 30% 兵力+粮草。SettlementPipeline.ts:420-427 发放奖励。无测试验证攻城前后资源余额的精确 diff。 | **P1 确认成立** | 资源守恒是 E2E 的核心验证项。Path A 中 SiegeSystem.executeSiege 内部调用 deductSiegeResources，同时 SettlementPipeline.distribute 发放奖励，但无测试验证 net effect 是否为零泄漏。虽然理论上扣减和奖励由不同阶段独立计算，但缺乏验证意味着潜在的资源增减错误无法被捕获。 |
| **C-10** | createBattle 和 executeSiege 使用不一致的策略参数 | P1 成立 | WorldMapTab.tsx:526-535 createBattle 使用 `currentTask.strategy ?? 'forceAttack'`；WorldMapTab.tsx:539 executeSiege 不传 strategy。这是 C-03 的延伸。 | **P1 确认成立，与 C-03 合并** | 战斗动画时长按策略计算（createBattle 使用 timeMultiplier），但胜负判定不按策略计算（executeSiege 走基础模拟）。用户看到 30s 的围困战斗动画，但胜负判定用的是无策略基础胜率。本质上是 C-03 的同一根因的表现。 |
| **C-12** | 没有单次连续 E2E 测试覆盖完整流程 | P1 成立 | Builder manifest 行 325-327 自认："从用户点击'攻城'到最终任务完成(COMPLETED)的单次连续E2E测试不存在"。 | **P1 确认成立** | 事实性陈述。现有测试将链路拆分为多个独立子段测试，每个子段验证有效，但子段之间的衔接点（如 march:arrived -> setTimeout -> executeSiege -> SettlementPipeline -> createReturnMarch）未在单次连续流程中被验证。 |

---

## P2 级质疑裁决表

| 质疑ID | 质疑内容 | Challenger结论 | 代码证据 | Judge裁决 | 理由 |
|--------|---------|---------------|---------|----------|------|
| **C-07** | "智取"策略在代码中不存在 | P1 声称 | siege-enhancer.types.ts 中只有 forceAttack/siege/nightRaid/insider 四种策略，无"智取"。Builder 已标记 E2E-9 为"未完成"。 | **P2 降级 -- 计划与代码对齐问题** | Builder 已正确标记 E2E-9 为"未完成"且承认"智取"不存在。这是计划文档与代码实现的对齐问题，非功能缺陷。实际策略 siege(围困) 存在且可工作，仅命名和配置值与计划不匹配。降级为文档对齐问题。 |
| **C-08** | insider 策略无胜利路径测试 | P2 成立 | march-to-siege-chain.integration.test.ts Scenario 6 使用 insider 但测试的是取消，非胜利路径。Builder manifest 行 224-227 自认。 | **P2 确认成立** | 测试覆盖不足，但非阻断性问题。insider 策略的代码逻辑（SiegeSystem.resolveSiege 中 strategy === 'insider' 分支）存在且正确，只是未被 E2E 测试验证。 |
| **C-09** | battle:completed 在 Path A 中被抢先后取消 | P2 成立 | WorldMapTab.tsx:637-639 cancelBattle 在结算后取消，SiegeBattleSystem.cancelBattle 不触发 battle:completed。SiegeBattleAnimationSystem 监听 battle:completed 但不监听 battle:cancelled。WorldMapTab.tsx:712-714 手动调用 completeSiegeAnimation 作为补偿。 | **P2 确认成立 -- 已有补偿机制** | Path A 设计上就不依赖 battle:completed，而是通过手动 completeSiegeAnimation 触发 siegeAnim:completed。5s 超时兜底（行702-706）确保即使动画事件不触发也能显示结果。问题本质是架构设计，非 Bug，但增加了维护复杂度。 |
| **C-11** | useEffect 清理后 setTimeout 回调仍在队列中 | P2 成立 | WorldMapTab.tsx:847-848 destroy + ref 置 null。setTimeout(0) 回调(行510)可能引用已清理的 siegeBattleSystemRef。 | **P2 确认成立 -- 实际影响有限** | siegeBattleSystemRef.current 被置 null 后，行524 `if (battleSystem)` 判断为 false，跳过战斗创建。siegeTaskManagerRef 不会被清理，理论上仍可操作，但由于 battleSystem 为 null，整个攻城流程会提前 return（行525-535 被跳过，但 executeSiege 调用不受 battleSystem 影响）。实际风险是组件卸载后仍可能执行攻城逻辑并修改引擎状态。建议在 setTimeout 回调中增加组件挂载状态检查。 |
| **C-13** | nightRaid/insider 的 requiredItem 在测试中被绕过 | P2 成立 | SiegeSystem.ts:656 `return true; // 资源系统不可用时默认有道具(测试环境)`。所有集成测试中 registry.get('resource') 返回 null 或 mock。 | **P2 确认成立** | 测试环境中的 fallback 机制导致 requiredItem 检查被完全绕过。这意味着夜袭令/内应信的消耗逻辑在生产环境中可能存在未被发现的问题。 |
| **C-14** | Builder 引用的行号不准确 | P2 声称 | WorldMapTab.tsx 中 handleArrived 从 L487 开始到 L762 结束（包含整个 setTimeout 回调），Builder 声称结束于 L520。 | **P2 确认成立 -- 不影响功能判断** | 行号引用不准确是文档问题，不影响对代码功能的判断。Builder 对核心功能的描述仍然正确。 |
| **C-16** | cross-system-linkage 测试中 territorySys 为 mock | P2 声称 | 集成测试中 registry.get('territory') 返回 mock，captureTerritory 为 vi.fn()。 | **P2 确认成立** | mock captureTerritory 仅验证调用次数，不验证领土数据的实际变更传播。但这在集成测试中是常见做法，跨系统的数据传播验证更适合 E2E 测试或手动测试。 |

---

## 裁决总结

### P0 确认项（2项）

| ID | 问题 | 修复方向 |
|----|------|---------|
| **C-15** | SiegeTaskManager 在 WorldMapTab 中未调用 setDependencies，所有 siegeTask:* 事件在 UI 层静默失败 | 在 useEffect 初始化中调用 `siegeTaskManager.setDependencies({ eventBus })`，或重构为通过 eventBus 注入 |
| **C-03** | executeSiege 调用未传 strategy 参数，策略差异化在 Path A 中完全失效 | 将 `currentTask.strategy` 作为第5个参数传入 `siegeSystem.executeSiege(...)` |

### P1 确认项（5项，含 C-01 从 P0 降级）

| ID | 问题 | 修复方向 |
|----|------|---------|
| **C-01** | setTimeout(0) 竞态风险（降级自 P0） | 使用 vi.useFakeTimers 修复测试时序；考虑使用 Promise.resolve().then() 替代 setTimeout(0) |
| **C-02** | UI EventBus 与引擎 EventBus 隔离 | 评估是否需要事件桥接机制；当前架构可接受但需文档化 |
| **C-04** | 测试 mock 率高 | 为关键路径补充真实 EventBus 集成测试 |
| **C-05** | 无全链路事件断言测试 | 新增 siegeTask:created -> siegeTask:completed 单测试全事件链断言 |
| **C-06** | 资源守恒未验证 | 补充攻城前后资源余额 diff 断言测试 |
| **C-10** | 策略参数不一致（与 C-03 合并） | 修复 C-03 后此问题自然解决 |
| **C-12** | 无单次连续 E2E 测试 | 新增完整系统串联 E2E 测试 |

### P2 确认项（6项）

| ID | 问题 |
|----|------|
| **C-07** | "智取"策略不存在，计划与代码命名不对齐 |
| **C-08** | insider 策略无胜利路径 E2E 测试 |
| **C-09** | battle:completed 在 Path A 中不自然发出（已有补偿机制） |
| **C-11** | useEffect 清理后 setTimeout 回调可能仍在队列中 |
| **C-13** | requiredItem 在测试中被绕过 |
| **C-14** | Builder 行号引用不准确 |
| **C-16** | 领土变更传播为 mock 验证 |

---

## 必须修复项清单（按优先级）

### 本轮必须修复（阻塞下一轮）

1. **[C-15] SiegeTaskManager 依赖注入缺失**
   - 文件: `src/components/idle/panels/map/WorldMapTab.tsx`
   - 修复: 在 useEffect(行410-854) 中 siegeTaskManagerRef 创建后，调用 `siegeTaskManager.setDependencies({ eventBus })`（约在行485之后）
   - 影响: 修复后 siegeTask:created/statusChanged/completed 事件将在 UI 层正常发射

2. **[C-03] executeSiege 缺少 strategy 参数**
   - 文件: `src/components/idle/panels/map/WorldMapTab.tsx`
   - 修复: 行539 改为 `siegeSystem.executeSiege(currentTask.targetId, 'player', currentTask.expedition.troops, eng.getResourceAmount?.('grain') ?? 0, currentTask.strategy ?? undefined)`
   - 影响: 修复后策略修正的胜率、消耗和特殊效果将在 Path A 中生效

### 建议本轮修复

3. **[C-01] setTimeout(0) 时序问题**
   - 修复测试中的时序控制（vi.useFakeTimers 或 act() 包裹）

4. **[C-05] 补充全链路事件断言测试**

---

## 完成度统计

| 维度 | Builder 声称 | Judge 评估 | 说明 |
|------|-------------|-----------|------|
| E2E-1~E2E-5 核心路径 | "已完成" | **60%** | C-15(事件断链) 和 C-03(策略失效) 使核心路径存在功能缺陷 |
| E2E-6 事件链路 | "部分完成" | **40%** | UI 层事件完全断链(C-15)，引擎层事件链路代码存在但未被 E2E 验证 |
| E2E-7 数据一致性 | "部分完成" | **50%** | 核心一致性已验证，但资源守恒和并发隔离未验证 |
| E2E-8 强攻策略 | "部分完成" | **30%** | 策略参数未传入 executeSiege，策略差异化在 Path A 中失效 |
| E2E-9 智取/围困策略 | "未完成" | **20%** | 策略存在但命名不对齐，无完整 E2E |
| E2E-10 内应策略 | "部分完成" | **25%** | 无胜利路径 E2E 测试，特殊效果未验证 |
| **总体** | **70%** | **约 40%** | 两个 P0 缺陷(C-15, C-03) 直接影响 5 个 E2E 检查项的有效性 |

---

## 二次辩论说明

### P0 降级说明

**C-01 从 P0 降级为 P1**: setTimeout(0) 确实存在理论竞态，但防重复守卫(行513 `currentTask.status !== 'marching'`)在大多数场景下有效。marchingSystem.update 在行军到达后将行军从活跃列表移除，不会再次 emit march:arrived。竞态只在极端时序下（如浏览器标签页切换回来时 rAF 批量补偿）才可能触发。测试环境中的失败主要由于 vitest 对 setTimeout 的处理与浏览器不同，不代表生产环境必然出问题。但该问题确实导致 UI 层测试失败，需要修复。

### P0 确认说明

**C-15 确认**: 这是代码中的明确遗漏。SiegeTaskManager 构造函数不接收 deps，setDependencies 从未被调用。所有事件发射使用可选链 `this.deps?.eventBus.emit(...)`，deps 为 null 时静默跳过。这不是设计决策，而是遗漏。修复成本极低（一行代码），影响极大（所有 siegeTask:* 事件）。

**C-03 确认**: SiegeSystem.executeSiege 的 strategy 参数是可选的（`strategy?: SiegeStrategyType`），不传时走基础模拟路径。WorldMapTab.tsx:539 调用时只传了 4 个参数。同时 createBattle(行526) 使用了 `currentTask.strategy ?? 'forceAttack'`，说明开发者意图是使用策略，但在 executeSiege 调用点遗漏了。这是明确的参数遗漏。

### 架构观察

C-02（EventBus 隔离）是一个架构问题而非 Bug。WorldMapTab 使用独立的局部 EventBus 驱动 UI 层的子系统（MarchingSystem、SiegeBattleSystem、SettlementPipeline），而引擎层 SiegeSystem 使用引擎注入的 EventBus。两个 EventBus 实例不共享事件。当前架构下这不会导致功能问题，因为 Path A 不依赖跨 EventBus 的事件传递。但如果未来需要 UI 层监听引擎层事件（如 siege:victory 触发 UI 更新），则需要引入事件桥接机制。

---

*Judge Ruling | 2026-05-05 | Round 26 全流程E2E(胜利路径) 裁决*
