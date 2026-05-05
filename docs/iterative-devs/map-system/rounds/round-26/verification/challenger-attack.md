# Challenger Attack Report -- Round 26: 全流程E2E(胜利路径)

> **攻击者**: Challenger
> **日期**: 2026-05-05
> **攻击对象**: Builder Manifest (builder-manifest.md) 的 10 个检查项结论

---

## 总览

Builder声称 E2E-1~E2E-5 "已完成"（带绿色勾），784 个集成测试通过。经逐行代码核验和测试逻辑审查，以下是质疑点。

---

## 质疑点 1: Path A 中 marching -> sieging 状态推进使用 setTimeout(0) 存在竞态风险

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 | 严重度 |
|--------|-------------|-------------|-------------|--------|
| **C-01**: WorldMapTab Path A 中 setTimeout(0) 竞态条件 | E2E-2/E2E-3 "已完成" | WorldMapTab.tsx:510 使用 `setTimeout(() => { ... }, 0)` 延迟执行攻城逻辑。这个 setTimeout 回调内部（行 520）直接调用 `siegeTaskManager.advanceStatus(currentTask.id, 'sieging')`，从 marching 跳到 sieging。但防重复守卫（行 513）检查的是 `currentTask.status !== 'marching'`。如果在 setTimeout(0) 执行前，rAF 动画循环中的 `marchingSystem.update()` 又触发了 `march:arrived`（因为精灵尚未被移除），同一任务会被处理两次。更关键的是：WorldMapTab.test.tsx 的攻城动画集成测试已经因为此 setTimeout(0) 时序问题而失败（Builder自己承认）。测试失败意味着该路径的UI层E2E验证实际是断链的。 | 缺少 setTimeout(0) 竞态条件的安全证明；缺少 UI 层 E2E 测试覆盖；缺少 rAF 与 setTimeout(0) 之间交互的时序分析 | P0 |

**代码证据**:
- WorldMapTab.tsx:510-513: `setTimeout(() => { const currentTask = siegeTaskManager.getTask(taskId); if (!currentTask \|\| currentTask.result \|\| currentTask.status !== 'marching') return; ... }, 0)`
- WorldMapTab.tsx:797 `marchingSystem.update(dt)` 在 rAF 循环中运行
- Builder manifest 行 29-30: `WorldMapTab.test.tsx - 攻城动画集成测试中 conquestAnimSystem.create 未被调用 (setTimeout(0) 异步时序问题)`

---

## 质疑点 2: UI 层 EventBus 与引擎层 EventBus 是完全隔离的不同实例

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 | 严重度 |
|--------|-------------|-------------|-------------|--------|
| **C-02**: WorldMapTab 创建独立的局部 EventBus 实例，不与引擎共享 | E2E-6 事件链路"部分完成"，声称事件链路存在于引擎层 | WorldMapTab.tsx:415-452 在 useEffect 内创建了一个全新的局部 `eventBus` 对象（基于 Map<string, Set<...>> 的纯 JS 实现），该 EventBus 不是从引擎注入的，也不是 `EventBus` 类的实例。这意味着：(1) WorldMapTab 内的 SiegeBattleSystem、SiegeBattleAnimationSystem、SettlementPipeline、MarchingSystem 都使用这个局部 EventBus。(2) 引擎层的 SiegeSystem 发射的 `siege:victory`/`siege:defeat` 事件永远不会到达 UI 层的 EventBus。(3) Builder声称的事件链路中的 `siege:victory`（SiegeSystem.ts:597）和 `siege:defeat`（SiegeSystem.ts:623）在 WorldMapTab 路径中根本不会被 UI 收到。 | 缺少 UI EventBus 与引擎 EventBus 之间的事件桥接机制验证；缺少 SiegeSystem 发出的事件到达 UI 层的证据 | P1 |

**代码证据**:
- WorldMapTab.tsx:415-452: `const listeners = new Map<string, Set<...>>(); const eventBus = { emit: ..., on: ..., off: ... }`
- WorldMapTab.tsx:454: `marchingSystem.init(mockDeps)` 使用局部 eventBus
- WorldMapTab.tsx:462: `siegeBattleAnimSystem.init(mockDeps)` 使用局部 eventBus
- WorldMapTab.tsx:467: `siegeBattleSystem.init(mockDeps)` 使用局部 eventBus
- WorldMapTab.tsx:484: `settlementPipeline.setDependencies({ eventBus })` 使用局部 eventBus
- SiegeSystem.ts:597: `this.deps?.eventBus.emit('siege:victory', ...)` 使用引擎的 eventBus

---

## 质疑点 3: Path A 中 SiegeSystem.executeSiege 不使用选择的策略

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 | 严重度 |
|--------|-------------|-------------|-------------|--------|
| **C-03**: WorldMapTab Path A 调用 executeSiege 时丢失了策略参数 | E2E-8/9/10 策略差异化 "部分完成" | WorldMapTab.tsx:539-544 调用 `siegeSystem.executeSiege(currentTask.targetId, 'player', currentTask.expedition.troops, eng.getResourceAmount?.('grain') ?? 0)` -- 没有传入 `strategy` 参数！虽然 SiegeBattleSystem.createBattle（行 526-535）确实使用了 `currentTask.strategy ?? 'forceAttack'`，但 SiegeSystem.executeSiege 用于决定胜负和消耗的关键调用完全忽略了策略。这意味着：(1) 策略修正后的胜率（computeStrategyWinRate）不会生效；(2) 策略修正后的消耗（troopCostMultiplier）不会生效；(3) 策略特殊效果（城防损坏/民心下降/城防保留）不会触发。 | 缺少策略参数传递到 executeSiege 的证据；缺少策略在 Path A 中影响胜率/消耗的 E2E 验证 | P0 |

**代码证据**:
- WorldMapTab.tsx:539: `siegeSystem.executeSiege(currentTask.targetId, 'player', currentTask.expedition.troops, eng.getResourceAmount?.('grain') ?? 0)` -- 只有 4 个参数，缺少第 5 个 strategy 参数
- SiegeSystem.ts:329-335: `executeSiege(targetId, attackerOwner, availableTroops, availableGrain, strategy?)` -- strategy 是可选参数，未传时走无策略路径
- SiegeSystem.ts:352: `strategy ? this.simulateBattleWithStrategy(...) : this.simulateBattle(...)` -- 未传策略时使用基础战斗模拟

---

## 质疑点 4: 784 个集成测试的"真实性"被高估

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 | 严重度 |
|--------|-------------|-------------|-------------|--------|
| **C-04**: 大量关键测试使用 mock EventBus 或 mock 依赖 | "784 passed" 暗示测试有效覆盖了完整链路 | 经审查：(1) `settlement-pipeline-integration.test.ts` 使用 `vi.fn()` mock EventBus（行 30-35），SettlementPipeline 的 emit 调用仅记录在 vi.fn() 上，不触发任何真实监听器。(2) `data-consistency.integration.test.ts` 使用 `vi.fn()` mock EventBus（行 27），SiegeSystem 的 siege:victory/siege:defeat 事件不产生任何实际效果。(3) `e2e-map-flow.integration.test.ts` 使用 `vi.fn()` mock EventBus 和 mock registry（行 46-69），SiegeSystem 的攻城执行完全在 mock 环境中运行，资源扣减 `vi.fn()` 不验证实际消耗。(4) `march-to-siege-chain.integration.test.ts` Scenario 4 使用 `vi.spyOn(marchingSystem, 'calculateMarchRoute').mockReturnValue(...)` mock 了 A* 寻路（行 398-404）。Builder声称 "真实 EventBus + SiegeTaskManager + MarchingSystem"，但回城行军路径计算是被 mock 的。(5) `execute-siege-path.integration.test.ts` Scenario 6 同样 mock 了 calculateMarchRoute（行 839）。 | 缺少对 mock 率的量化统计；缺少 mock 对测试有效性的影响评估 | P1 |

**代码证据**:
- settlement-pipeline-integration.test.ts:30-35: `emit: vi.fn(), on: vi.fn().mockReturnValue(vi.fn()), off: vi.fn()`
- data-consistency.integration.test.ts:27: `eventBus: { emit: vi.fn() }`
- e2e-map-flow.integration.test.ts:46: `eventBus: { emit: vi.fn() }`
- march-to-siege-chain.integration.test.ts:398: `vi.spyOn(marchingSystem, 'calculateMarchRoute').mockReturnValue(...)`
- execute-siege-path.integration.test.ts:839: `vi.spyOn(MarchingSystem.prototype, 'calculateMarchRoute').mockReturnValue(...)`

---

## 质疑点 5: E2E-6 事件链路无全链路测试，Builder自己承认

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 | 严重度 |
|--------|-------------|-------------|-------------|--------|
| **C-05**: 从 siegeTask:created 到 siegeTask:completed 无单测试断言全链路 | E2E-6 "部分完成" 但 Builder 仍然将其归类为 "有实现" | Builder 自己承认（manifest 行 143）："没有单个测试追踪完整的 siegeTask:created -> siegeTask:completed 事件链 (所有事件在一个测试中断言)"。这意味着事件链路中可能存在"事件发射了但无人消费"或"事件顺序错误"的断裂点。具体缺失：(1) 没有测试验证 `settlement:return` 事件实际触发回城行军创建（WorldMapTab 中回城行军是通过同步调用 createReturnMarch 创建的，不是事件驱动）。(2) 没有测试验证 `siegeTask:completed` 事件在 returning -> completed 转换时被正确发射。(3) 没有测试验证 `siegeAnim:completed` 事件在 Path A 中被正确发射（它依赖手动调用 completeSiegeAnimation）。 | 缺少 siegeTask:created -> siegeTask:completed 全链路事件断言测试；缺少 settlement:return -> 回城行军创建的事件驱动验证 | P1 |

**代码证据**:
- Builder manifest 行 143: "没有单个测试追踪完整的 siegeTask:created -> siegeTask:completed 事件链"

---

## 质疑点 6: E2E-7 资源守恒未验证，存在真实泄漏风险

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 | 严重度 |
|--------|-------------|-------------|-------------|--------|
| **C-06**: 攻城前后资源总量守恒从未被测试 | E2E-7 "部分完成" | Builder 承认（manifest 行 159-161）三个关键缺失：(1) 无测试验证攻城前后资源余额的精确变化（兵力总增减是否为零泄漏）。(2) 无测试验证领土 ownership 变更的原子性（攻城失败不应改变 ownership）。(3) 无测试验证并发攻城任务的数据隔离。更严重的是，Path A 中存在双重资源扣减风险：SiegeSystem.executeSiege 内部调用 deductSiegeResources（SiegeSystem.ts:595/621），同时 SiegeSystem.resolveSiege 也被调用。如果 executeSiege 的胜利路径扣了粮草（行 595），而 SettlementPipeline 的 distribute 又发放了奖励（含 troops/grain/gold），则可能出现资源不守恒。 | 缺少攻城前后资源余额 diff 断言；缺少失败路径不修改 ownership 的验证；缺少并发资源隔离测试 | P1 |

**代码证据**:
- SiegeSystem.ts:595: `this.deductSiegeResources({ troops: 0, grain: cost.grain })` -- 胜利时扣粮草
- SiegeSystem.ts:621: `this.deductSiegeResources({ troops: defeatTroopLoss, grain: cost.grain })` -- 失败时扣 30% 兵力+粮草
- SettlementPipeline.ts:420-427: distribute 发放 grain/gold/troops 奖励
- Builder manifest 行 159: "无测试验证攻城前后资源余额的精确变化"

---

## 质疑点 7: E2E-9 "智取"策略在代码中不存在

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 | 严重度 |
|--------|-------------|-------------|-------------|--------|
| **C-07**: 计划中的"智取"策略在代码中完全不存在 | E2E-9 "未完成" 但仅是标记而非明确阻断 | 代码中只有 4 种策略（siege-enhancer.types.ts:163-212）：forceAttack/siege/nightRaid/insider。计划中的"智取"策略不存在。虽然 Builder 正确标记为"未完成"，但这个缺失影响更广：如果 E2E 计划要求验证 3 种策略（强攻/智取/内应），而"智取"不存在，那么 E2E 计划本身就有 33% 的策略覆盖缺口。此外 siege（围困）策略的 timeMultiplier=2.0 是所有策略中最慢的（战斗时长翻倍），与计划中"智取 timeMultiplier=0.7"完全不匹配。 | 缺少策略映射文档；缺少计划与代码的对齐审查 | P1 |

**代码证据**:
- siege-enhancer.types.ts:163-212: 只有 forceAttack/siege/nightRaid/insider
- Builder manifest 行 191-195: "代码中无'智取'策略"

---

## 质疑点 8: E2E-10 insider 策略无胜利路径测试

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 | 严重度 |
|--------|-------------|-------------|-------------|--------|
| **C-08**: insider 策略仅在取消场景中测试，无完整胜利路径 E2E | E2E-10 "部分完成" | march-to-siege-chain.integration.test.ts Scenario 6（行 675-716）使用 insider 策略创建任务，但测试内容是取消行军，不是完成攻城胜利路径。Builder 自己承认（manifest 行 224-227）四个关键缺失：(1) 无 insider 策略的胜利路径 E2E 链路测试。(2) 无验证 requiredItem='item-insider-letter' 在 E2E 中的消耗。(3) 无验证 insider 特殊效果"城防完整保留"。(4) 无验证 insider 失败后的暴露冷却 (24h)。 | 缺少 insider 策略的胜利路径 E2E 测试 | P2 |

**代码证据**:
- march-to-siege-chain.integration.test.ts:675: `strategy: 'insider'` 用于取消测试
- Builder manifest 行 224-227: 无 insider 胜利路径 E2E

---

## 质疑点 9: Path A 的 battle:completed 事件被抢先后取消，但无测试验证下游系统不受影响

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 | 严重度 |
|--------|-------------|-------------|-------------|--------|
| **C-09**: battle:completed 在 Path A 中永远不会自然发出 | E2E-3 "已完成" | Builder 自己详细描述了这个问题（manifest 行 79-82）："WorldMapTab.tsx 中实际使用的是 Path A 同步结算路径。这意味着 battle:completed 事件在正常胜利路径中不会被发出（因为 cancelBattle 先于自然完成）"。这有几个影响：(1) 如果有任何系统依赖 battle:completed 事件来触发后续逻辑（比如统计系统），它在 Path A 中永远收不到。(2) SiegeBattleAnimationSystem 监听 battle:completed 来完成动画，但在 Path A 中 battle:completed 不发出，所以 WorldMapTab 必须手动调用 completeSiegeAnimation（行 713）。如果这个手动调用被遗漏，动画会永远停留在 battle 状态（虽然有 5s 超时兜底）。(3) SiegeBattleAnimationSystem 监听 battle:cancelled 但不做任何处理（siege-battle-chain.integration.test.ts Scenario D 验证了这一点），残留动画直到 destroy 才清理。 | 缺少 battle:completed 不发出时的下游系统行为测试 | P2 |

**代码证据**:
- WorldMapTab.tsx:637-639: `battleSystem.cancelBattle(currentTask.id)` 在结算后取消
- SiegeBattleAnimationSystem: 监听 battle:completed 但不监听 battle:cancelled
- WorldMapTab.tsx:712-714: 手动调用 `siegeAnimSystem.completeSiegeAnimation(currentTask.id, siegeResult.victory)`
- siege-battle-chain.integration.test.ts Scenario D: 验证了 cancelBattle 后动画残留

---

## 质疑点 10: SiegeBattleSystem.createBattle 和 SiegeSystem.executeSiege 使用不同的策略逻辑

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 | 严重度 |
|--------|-------------|-------------|-------------|--------|
| **C-10**: Path A 中战斗时长和胜负判定使用了不一致的策略参数 | E2E-3/E2E-8 "已完成" | WorldMapTab.tsx:526-535 调用 `battleSystem.createBattle({ strategy: currentTask.strategy ?? 'forceAttack' })`，使用策略的 timeMultiplier 来计算战斗时长。然后 WorldMapTab.tsx:539 调用 `siegeSystem.executeSiege(...)` **不传策略**，所以胜负判定不使用策略。这意味着：(1) 攻城动画（SiegeBattleSystem）按策略修正后的时长播放（例如 siege 策略战斗时长翻倍到 30s）。(2) 但胜负判定（SiegeSystem）使用无策略的基础胜率。(3) 用户选择了 siege 策略（低消耗+高胜率+长时长），但实际胜率可能反而低于预期（因为胜率修正未生效）。(4) 用户的 forceAttack 策略（高消耗+快时长）的额外兵力消耗（troopCostMultiplier=1.5）不会在 executeSiege 中生效。 | 缺少策略参数在 Path A 全流程中一致传递的证据 | P1 |

**代码证据**:
- WorldMapTab.tsx:526: `strategy: currentTask.strategy ?? 'forceAttack'` -- 传给 SiegeBattleSystem
- WorldMapTab.tsx:539: `siegeSystem.executeSiege(currentTask.targetId, 'player', ...)` -- 不传 strategy
- SiegeSystem.ts:350-352: `strategy ? this.simulateBattleWithStrategy(...) : this.simulateBattle(...)` -- 不传策略时用基础模拟

---

## 质疑点 11: WorldMapTab useEffect 清理函数中 siegeBattleSystem.destroy 后未清理 ref

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 | 严重度 |
|--------|-------------|-------------|-------------|--------|
| **C-11**: useEffect 清理中 destroy 后 ref 置 null，但 setTimeout 回调可能仍在队列中 | E2E-5 "已完成" | WorldMapTab.tsx:840-853 的清理函数中：`siegeBattleSystem.destroy()` 然后设置 `siegeBattleSystemRef.current = null`。但在此之前，handleArrived（行 487）注册的 setTimeout(0) 回调可能仍在宏任务队列中。当 setTimeout 回调执行时，它会通过 `siegeBattleSystemRef.current` 访问已经被 destroy 的 battleSystem（ref 已被置 null，所以 battleSystem 为 null，跳过战斗创建）。但 `siegeTaskManagerRef.current` 不会被清理，回调仍然可以推进任务状态。这可能导致任务卡在中间状态（sieging 而非 returning），因为没有战斗结果来推进后续流程。 | 缺少组件卸载时 setTimeout 回调的安全取消验证 | P2 |

**代码证据**:
- WorldMapTab.tsx:847-848: `siegeBattleSystem.destroy(); siegeBattleSystemRef.current = null;`
- WorldMapTab.tsx:510: `setTimeout(() => { ... siegeBattleSystemRef.current ... }, 0)` -- 回调可能引用已清理的 ref

---

## 质疑点 12: 测试将链路拆分为子段测试，Builder声称的 "E2E" 实际是 "sub-E2E"

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 | 严重度 |
|--------|-------------|-------------|-------------|--------|
| **C-12**: 没有任何测试覆盖从用户点击到任务完成的单次连续流程 | E2E-1~E2E-5 标记为 "已完成" | Builder 自己承认（manifest 行 325-327）："从用户点击'攻城'到最终任务完成(COMPLETED)的单次连续E2E测试不存在。现有测试将链路拆分为多个独立测试，各自验证子段。WorldMapTab.tsx 中的事件协调逻辑(handleArrived/handleCancelled)没有真正的E2E集成测试。" 这意味着：(1) march-e2e-full-chain 只测试了 MarchingSystem 自身的 create->start->arrive。(2) march-to-siege-chain 测试了 MarchingSystem + SiegeTaskManager 的联动，但战斗判定是手动设置的（不是通过 SiegeSystem）。(3) execute-siege-path 测试了 SiegeBattleSystem + SiegeTaskManager 的联动，但回城行军的路径计算是 mock 的。(4) 没有任何测试将所有系统（MarchingSystem + SiegeTaskManager + SiegeBattleSystem + SiegeSystem + SettlementPipeline）串联在一起。 | 缺少完整的系统串联 E2E 测试 | P1 |

**代码证据**:
- Builder manifest 行 325-327: "从用户点击'攻城'到最终任务完成(COMPLETED)的单次连续E2E测试不存在"

---

## 质疑点 13: nightRaid 策略的 requiredItem 在 E2E 中从未被验证

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 | 严重度 |
|--------|-------------|-------------|-------------|--------|
| **C-13**: nightRaid 和 insider 的 requiredItem 在集成测试中被绕过 | E2E-8/10 "部分完成" | 在集成测试中，SiegeSystem 的 hasItem 方法（SiegeSystem.ts:649-657）在资源系统不可用时默认返回 true（行 656：`return true; // 资源系统不可用时默认有道具(测试环境)`）。所有集成测试的 registry.get('resource') 返回 null 或 mock 对象，因此 hasItem 永远返回 true，requiredItem 检查被完全绕过。这意味着：nightRaid 的 requiredItem='item-night-raid-token' 和 insider 的 requiredItem='item-insider-letter' 在测试中永远不会被真正消耗或验证。 | 缺少 requiredItem 真实消耗的 E2E 测试 | P2 |

**代码证据**:
- SiegeSystem.ts:656: `return true; // 资源系统不可用时默认有道具(测试环境)`
- 所有集成测试中 `registry.get('resource')` 返回 null 或不含 getItemCount 的 mock

---

## 质疑点 14: Builder声称的行号引用中存在不准确

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 | 严重度 |
|--------|-------------|-------------|-------------|--------|
| **C-14**: Builder引用的部分行号与实际代码不匹配 | E2E-2 声称 WorldMapTab.tsx:487-520 是 handleArrived | 核查：(1) Builder 声称 E2E-2 中 `handleArrived` 在 WorldMapTab.tsx:487-520，实际代码中 handleArrived 定义在 487 行开始，但其结束大括号在 762 行（包含了整个 setTimeout 回调和所有攻城逻辑），远超 Builder 声称的 520 行。(2) Builder 声称 E2E-3 中 Path A 同步结算路径在 WorldMapTab.tsx:539-598，实际代码中该路径从 539 行延伸到 739 行（setTimeout 回调的完整逻辑），远超 598 行。(3) Builder 声称 E2E-5 中回城到达处理在 WorldMapTab.tsx:743-746，实际代码确实在 743-746 行，这4行代码正确。虽然核心功能描述正确，但行号范围的不准确表明 Builder 可能未逐行核验代码。 | 缺少对 Builder 行号引用的逐条验证 | P2 |

---

## 质疑点 15: WorldMapTab 中 siegeTaskManager 未设置依赖，siegeTask:created 事件不发射

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 | 严重度 |
|--------|-------------|-------------|-------------|--------|
| **C-15**: siegeTaskManagerRef 创建时未调用 setDependencies | E2E-1 "已完成" | WorldMapTab.tsx:227: `const siegeTaskManagerRef = useRef<SiegeTaskManager>(new SiegeTaskManager())` 直接创建 SiegeTaskManager 实例但**从未调用 setDependencies**。SiegeTaskManager.ts:134 的 `this.deps?.eventBus.emit(SIEGE_TASK_EVENTS.CREATED, ...)` 使用可选链 `this.deps?.`，当 deps 为 null 时事件不发射。这意味着：(1) siegeTask:created 事件在 WorldMapTab 中永远不会被发射。(2) siegeTask:statusChanged 事件在 WorldMapTab 中永远不会被发射。(3) siegeTask:completed 事件在 WorldMapTab 中永远不会被发射。Builder声称的事件链路（E2E-6 行 118-133）在 UI 层全部断链。事件链路只存在于引擎层测试中（测试中调用了 setDependencies），在 UI 集成中完全不存在。 | 缺少 siegeTaskManager.setDependencies 调用；缺少 UI 层事件发射验证 | P0 |

**代码证据**:
- WorldMapTab.tsx:227: `const siegeTaskManagerRef = useRef<SiegeTaskManager>(new SiegeTaskManager())`
- 在整个 WorldMapTab.tsx 中搜索 `setDependencies` 只出现一次（行 484: `settlementPipeline.setDependencies({ eventBus })`），SiegeTaskManager 的 setDependencies **从未被调用**。
- SiegeTaskManager.ts:134: `this.deps?.eventBus.emit(SIEGE_TASK_EVENTS.CREATED, { task })` -- deps 为 null 时不执行
- SiegeTaskManager.ts:166-167: `this.deps?.eventBus.emit(SIEGE_TASK_EVENTS.STATUS_CHANGED, ...)` -- deps 为 null 时不执行

---

## 质疑点 16: cross-system-linkage 测试的 siege 任务仅测试状态转换，不测试与 SiegeSystem 的集成

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 | 严重度 |
|--------|-------------|-------------|-------------|--------|
| **C-16**: cross-system-linkage 测试覆盖的 S10.1 可能不涉及真正的领土变更 | E2E-4 "已完成" | Builder 声称 ownership 变更由 cross-system-linkage.integration.test.ts S10.1 验证。但 SiegeSystem.resolveSiege 中调用的 `this.territorySys?.captureTerritory(targetId, attackerOwner)`（SiegeSystem.ts:567）使用可选链，且 territorySys 是通过 `this.deps?.registry?.get<TerritorySystem>('territory')` 获取的。在集成测试中，registry.get('territory') 返回的 mock 对象的 captureTerritory 通常是 `vi.fn()`，仅验证调用次数但不验证领土数据的实际变更传播。 | 缺少领土变更数据传播到 UI 的完整验证 | P2 |

---

## 严重度汇总

| 严重度 | 数量 | 质疑点 |
|--------|------|--------|
| P0 | 3 | C-01 (setTimeout竞态), C-03 (策略参数丢失), C-15 (SiegeTaskManager无依赖注入) |
| P1 | 5 | C-02 (EventBus隔离), C-04 (mock高估), C-05 (无全链路测试), C-06 (资源守恒未验), C-10 (策略不一致), C-12 (子段非E2E) |
| P2 | 5 | C-08 (insider无胜利路径), C-09 (battle:completed被抢先), C-11 (ref清理竞态), C-13 (requiredItem绕过), C-14 (行号不准确), C-16 (领土变更传播) |

---

## 最终结论

Builder 对 E2E-1~E2E-5 标记为 "已完成" 的结论存在以下核心问题：

1. **P0 阻断**: SiegeTaskManager 在 WorldMapTab 中未注入依赖，所有 siegeTask:* 事件在 UI 层静默失败（C-15）。Path A 中策略参数未传递到 executeSiege，策略差异化功能在胜利路径中名存实亡（C-03）。

2. **架构断裂**: UI 层使用独立的局部 EventBus（C-02），引擎层事件和 UI 层事件完全隔离，Builder声称的事件链路在 UI 集成中实际不存在。

3. **测试幻觉**: 784 个测试中大量使用 mock EventBus/mock registry/mock 路径计算（C-04），且没有单次测试覆盖从 siegeTask:created 到 siegeTask:completed 的完整链路（C-05/C-12）。Builder 自己承认的覆盖率为 70%，但标记的完成度暗示更高。

**Challenger判定**: Builder声称的5个"已完成"结论中，E2E-1到E2E-5的实际完成度不超过 50%，E2E-6到E2E-10的评估基本准确但降级合理。

---

*Challenger Attack Report | 2026-05-05 | Round 26 全流程E2E(胜利路径) 对抗性审核*
