# Challenger Attack Report — Round 25 Phase 4 (P9~P10)

> **攻击日期**: 2026-05-05
> **攻击角色**: Challenger
> **攻击目标**: Builder Manifest Round 25 — Phase 4 结算回城
> **攻击方法**: 源码验证 + 测试有效性审计 + 集成链路追踪

---

## 1. P0 级质疑（功能缺失/严重偏差）

### P0-1: 胜利路径扣减全部 cost.troops，与 plan 公式 cost.troops * 0.1 严重偏差

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 |
|--------|-------------|------------|------------|
| P9-5 伤亡计算公式 | Builder声称"部分完成"并承认偏差，但将其降级为P1 | plan.md 明确要求 `effectiveTroopsLost = victory ? cost.troops * 0.1 : cost.troops * 0.3`，实际实现胜利路径扣减 100% cost.troops（`SiegeSystem.ts:595` 调用 `deductSiegeResources(cost)`）。这意味着玩家胜利时损失出征全部兵力而非10%，是核心游戏逻辑严重错误，应为P0 | 缺少证明两套计算系统（SiegeSystem vs SiegeResultCalculator）如何统一的证据；缺少验证胜利后实际资源扣减量的集成测试 |

**代码证据**:
- `SiegeSystem.ts:595` 胜利路径: `this.deductSiegeResources(cost)` — 扣减完整 cost（含全部 troops）
- `SiegeSystem.ts:605` 失败路径: `Math.floor(cost.troops * 0.3)` — 扣减30%
- `SiegeResultCalculator.ts:48-49` 大胜(decisiveVictory)伤亡率 10-20%，但 SiegeSystem 从未调用此计算器
- 两套伤亡系统完全独立运行，SettlementPipeline 使用的 SiegeResultCalculator 结果不影响 SiegeSystem 的实际资源扣减

### P0-2: march:arrived → advanceStatus('completed') 事件监听缺失 — 回城到达无法自动完成任务

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 |
|--------|-------------|------------|------------|
| P10-3 回城到达处理 | Builder声称"有效"，测试通过 | `SiegeTaskManager.ts` 文件注释(L9)声称"监听 march:arrived 事件推进状态"，但全文件无任何 `eventBus.on()` 调用。`advanceStatus('completed')` 从未在生产代码中被任何系统自动调用。回城行军到达后，任务将永远停留在 `returning` 状态，无法自动推进到 `completed` | 缺少 march:arrived 事件订阅的代码；缺少回城到达→任务完成的自动化集成测试 |

**代码证据**:
- `SiegeTaskManager.ts:9` 注释: `* - 监听 march:arrived 事件推进状态` — 纯注释，无实现
- `grep -rn "\.on\b" SiegeTaskManager.ts` — 零结果，文件无任何事件监听注册
- `grep -rn "advanceStatus.*completed" production_code` — 零结果，只有测试文件调用
- `MarchingSystem.ts:207` 发射 `march:arrived` 事件，但无人订阅

### P0-3: ConquestAnimationSystem 从未被生产代码调用 — 征服动画是死代码

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 |
|--------|-------------|------------|------------|
| P9-7 征服动画 | Builder声称"完成"，ConquestAnimationSystem.create() 可创建动画 | `ConquestAnimationSystem` 没有被任何生产代码导入或使用。`SiegeSystem.ts` 胜利路径无动画调用，`SiegeEnhancer.ts` 也无动画调用。`grep -rn "ConquestAnimation" --exclude=test` 仅返回类定义本身。动画系统存在于代码库但从未接入攻城流程 | 缺少 ConquestAnimationSystem 被任何攻城代码调用的证据；缺少攻城胜利→动画触发→动画完成 的集成测试 |

**代码证据**:
- `grep -rn "ConquestAnimation" production_code` — 仅 `ConquestAnimation.ts` 自身（定义+导出），零导入
- `SiegeSystem.ts` resolveSiege 胜利路径（L565-601）: 无任何动画调用
- `SiegeEnhancer.ts` 胜利路径（L318-335）: 无任何动画调用

### P0-4: cancelSiege(createReturnMarch返回null时) 任务卡在 returning 状态无法推进

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 |
|--------|-------------|------------|------------|
| P10-2 回城路线不可达 | Builder声称"有效"，测试覆盖返回null | plan要求"回城失败时直接 advanceStatus → completed"，实际 `cancelSiege` 无论 createReturnMarch 是否返回null，都将任务设为 `returning`（L407）。当回城行军不可达时，任务无精灵、无路线、无人推进到 completed，永远卡住 | 缺少 cancelSiege 在 createReturnMarch 返回 null 时自动推进到 completed 的代码；缺少不可达降级路径的集成测试 |

**代码证据**:
- `SiegeTaskManager.ts:407`: `task.status = 'returning'` — 无论行军是否成功创建
- `SiegeTaskManager.ts:415-424`: `if (marchingSystem)` 仅保护行军创建，不影响状态设置
- 无 else 分支在 null 情况下调用 `advanceStatus(taskId, 'completed')`
- plan.md P10-2 验收标准: "回城失败时直接advanceStatus→completed" — 完全未实现

---

## 2. P1 级质疑（功能不完整/测试覆盖缺口）

### P1-1: SiegeResultModal 5秒自动关闭(fallback)未实现

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 |
|--------|-------------|------------|------------|
| P9-6 结果弹窗 5秒fallback | Builder承认"未发现显式实现"，但仍标为"完成" | plan.md 验收标准明确要求"5秒fallback"。`SiegeResultModal.tsx` 全文无 `setTimeout`、无 `useEffect` 自动关闭、无 autoClose prop。`grep -n "setTimeout\|autoClose" SiegeResultModal.tsx` 返回零结果。仅能手动确认关闭，无 fallback 机制 | 缺少 setTimeout/autoClose 实现代码；缺少验证弹窗5秒自动关闭的测试 |

### P1-2: removeMarch 无3秒延迟 — plan要求的"回城到达后3秒移除"完全缺失

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 |
|--------|-------------|------------|------------|
| P10-5 精灵移除 | Builder标为"完成"并注明"无3秒延迟" | plan.md 验收标准: "回城到达后3秒removeMarch"。实际 `removeMarch()` 是立即删除（`MarchingSystem.ts:333-334`），无任何延迟机制。`SiegeTaskManager.ts` 无 `setTimeout`，无调用 `removeMarch`。由于 P0-2 导致的 completed 事件缺失，removeMarch 根本不会被自动调用 | 缺少3秒延迟移除精灵的实现；缺少 removeMarch 被任何生产代码调用的证据 |

**代码证据**:
- `grep -rn "removeMarch" production_code` — 仅 MarchingSystem.ts:333 定义，零调用
- `SiegeTaskManager.ts` — 不包含任何 `removeMarch` 调用
- 无 `setTimeout` 或延迟机制存在于任何相关文件

### P1-3: removeCompletedTasks 从未被生产代码调用 — 清理功能是死代码

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 |
|--------|-------------|------------|------------|
| P10-4 任务完成清理 | Builder声称"有效"，测试通过 | `removeCompletedTasks()` 仅在 `SiegeTaskManager.ts:568` 定义和测试文件中调用。无任何生产代码调用此方法。即使任务能到达 completed 状态，也永远不会被清理，导致内存泄漏 | 缺少 removeCompletedTasks 在任何生产代码路径中被调用的证据；缺少定期清理调度机制 |

### P1-4: P9-2 资源扣算缺少 siege:resourceError 事件

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 |
|--------|-------------|------------|------------|
| P9-2 失败时emit siege:resourceError | Builder声称"完成" | plan.md 关键约束列: "失败时emit siege:resourceError"。`grep -rn "siege:resourceError" SiegeSystem.ts` 返回零结果。`deductSiegeResources` 使用 try/catch 静默处理异常（L641-643），失败时无任何错误事件发射 | 缺少 siege:resourceError 事件发射代码；缺少资源扣减失败时通知上层系统的测试 |

### P1-5: SiegeResultCalculator 与 SiegeSystem 伤亡计算体系冲突未解决

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 |
|--------|-------------|------------|------------|
| 两套伤亡系统一致性 | Builder提及两套系统但未标记为问题 | SiegeSystem 胜利扣100%兵力 + 失败扣30%兵力（简单公式），SiegeResultCalculator 按5档结果等级扣10-90%（精细公式）。SettlementPipeline 使用后者计算奖励，但 SiegeSystem 使用前者实际扣资源。玩家实际损失与结算显示的损失完全不一致 | 缺少两套系统一致性验证的集成测试；缺少说明哪个系统为权威源的文档 |

**具体矛盾**:
- SiegeSystem 胜利: 扣 100% cost.troops
- SiegeResultCalculator 大胜(decisiveVictory): 报告损失 10-20%
- SettlementPipeline distribute(): 基于 SiegeResultCalculator 的结果计算奖励
- 实际资源扣减: 基于 SiegeSystem 的硬编码公式
- 结果: 玩家看到"大捷！损失10%兵力"，实际被扣了100%

### P1-6: SiegeTaskManager.cancelSiege 从 settlling 状态无法使用

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 |
|--------|-------------|------------|------------|
| cancelSiege 状态覆盖 | Builder声称"完成" | `cancelSiege` 仅允许 `paused` 和 `sieging` 状态（L389: `task.status !== 'paused' && task.status !== 'sieging'`），但正常流程包含 `settling` 状态。处于 `settling` 状态的任务无法被取消，必须等待手动推进到 `returning` | 缺少从 settling 状态取消的测试；缺少 settling 状态下的回城降级处理 |

---

## 3. P2 级质疑（测试有效性问题）

### P2-1: SiegeTaskManager.chain.test.ts 链路测试未验证事件驱动的自动推进

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 |
|--------|-------------|------------|------------|
| 状态链测试有效性 | Builder声称"有效" | 测试手动调用 `advanceStatus()` 推进每个状态，这验证了状态机的合法转换，但未验证生产环境中由事件驱动自动推进的链路。由于 P0-2 的问题（无事件监听），实际系统中无法自动从 returning → completed | 缺少事件驱动（march:arrived → completed）的集成测试；缺少验证生产环境中状态自动推进的端到端测试 |

### P2-2: cancelSiege 测试传递 null 作为 marchingSystem，未验证降级行为

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 |
|--------|-------------|------------|------------|
| cancelSiege null 降级测试 | Builder声称测试通过 | 测试 `SiegeTaskManager.test.ts:525` 传递 `null` 作为 marchingSystem，验证返回 true 和状态变为 returning。但这正是问题: 传 null 时任务变为 returning 但无行军精灵，无任何机制推进到 completed。测试验证了错误行为的"正确性" | 缺少验证 null marchingSystem 场景下任务最终到达 completed 的测试 |

### P2-3: 回城行军速度 x0.8 仅在单元测试中验证，集成链路未确认速度传递

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 |
|--------|-------------|------------|------------|
| P10-1 速度x0.8 | Builder声称"有效" | `MarchingSystem.ts:372` 设置 `march.speed = BASE_SPEED * 0.8`，但 `createReturnMarch` 创建的 march 通过 `createMarch()` 构造后覆盖 speed。需确认 `createMarch()` 不会重置 speed。`march-siege.integration.test.ts:554` 验证了此值，但仅通过 spy 检查 | 缺少验证回城行军实际按 x0.8 速度移动（通过 update loop 到达终点）的集成测试 |

---

## 4. 集成断裂攻击（系统间未连接）

### 断裂-1: 攻城结果 → 回城行军 → 任务完成 完整链路未集成

用户线性链（plan.md定义）: `战斗结果 → 资源扣算 → 领土占领变更 → 奖励发放 → 道具掉落 → 回城行军创建 → 回城精灵到达 → 任务完成`

**实际断裂点**:
1. `SiegeSystem.resolveSiege()` 发射 `siege:victory`/`siege:defeat` 事件，但无任何代码监听这些事件触发 SettlementPipeline
2. `SettlementPipeline.distribute()` 计算奖励和道具掉落，但无代码将 SettlementPipeline 接入攻城流程
3. `MarchingSystem.update()` 发射 `march:arrived` 事件，但无代码监听此事件调用 `advanceStatus('completed')`
4. 无代码在任务完成后调用 `removeCompletedTasks()`
5. 无代码在回城到达后调用 `removeMarch()`

Builder的测试验证了每个独立组件的正确性，但整个链路的关键连接点（事件订阅→状态推进）全部缺失。685个测试中没有任何一个验证完整的 `攻城胜利→结算→回城→到达→完成→清理` 端到端链路。

### 断裂-2: SiegeResultModal 与引擎数据未连接

`SiegeResultModal.test.tsx` (60 tests) 使用硬编码的 mock 数据渲染组件，验证 UI 元素存在性。但无任何测试验证:
- SiegeSystem/SiegeResultCalculator 的计算结果如何传递到 SiegeResultModal
- 道具掉落（shouldDropInsiderLetter）的结果如何显示在 UI 上
- 奖励倍率是否与 SettlementPipeline 计算的一致

---

## 5. 总结

| 级别 | 数量 | 质疑编号 |
|------|:----:|---------|
| P0 | 4 | P0-1(胜利扣100%vs10%), P0-2(march:arrived无监听), P0-3(动画未接入), P0-4(不可达卡死) |
| P1 | 6 | P1-1(无5秒自动关闭), P1-2(无3秒延迟移除), P1-3(清理死代码), P1-4(缺resourceError事件), P1-5(两套伤亡冲突), P1-6(cancelSiege状态缺口) |
| P2 | 3 | P2-1(链路测试非事件驱动), P2-2(null降级测试验证错误行为), P2-3(速度仅单元验证) |
| **合计** | **13** | |

**核心结论**: Builder 的 685 个测试验证了各独立组件的内部正确性，但 Phase 4 的核心价值——"攻城结果→结算→回城→完成"的端到端链路——在生产代码层面完全未连接。事件发射了但无人监听，状态可以手动推进但无法自动流转。Builder 将"组件存在且有测试"等同于"流程已集成"，这是本轮最大的幻觉。

---
*Challenger Attack Report | Round 25 | Phase 4 (P9~P10) | 2026-05-05*
