# Round 29 Challenger 攻击报告

> **攻击者**: Challenger
> **日期**: 2026-05-05
> **攻击对象**: Builder Round 29 客观审核报告 (builder-manifest.md)

---

## 1. 漏洞攻击

### 1.1 [P0] R24-I08 timeExceeded "Path B存在"的假设未经证实

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 |
|--------|-------------|-------------|-------------|
| timeExceeded是可达死代码 | Path B(动画驱动的自然完成)中timeExceeded可达，当defenseDepleted=false且timeExceeded=true时判定失败，该分支有防御性价值 | **代码注释和测试本身都证明timeExceeded分支在正常运行中不可能触发失败**。siege-anim-completion.integration.test.ts L471-494的注释明确写道："The only way to get defeat is timeExceeded with defense remaining, which can't happen with the formula"。attackPower = maxDefense / durationSeconds 确保城防在时间限制内必定耗尽。Builder声称的"Path B中timeExceeded可达"与代码逻辑矛盾——当timeExceeded=true时，defenseDepleted必然也为true（因为attackPower公式保证这一点）。唯一能触发victory=false的方式是手动emit battle:completed事件（测试L498-499就是这么做的），这不是正常运行路径 | 缺少一个**真实的、非手动构造的**测试用例展示timeExceeded=true且defenseDepleted=false的自然发生场景。Builder需要证明Path B中存在正常的游戏流程可以在不耗尽城防的情况下超时 |

**严重性**: P0 -- Builder将一个实际上不可达的分支归类为"设计决策(可关闭)"，可能导致未来开发者误以为该分支已被验证，而实际上它从未在任何真实场景中被触发。

### 1.2 [P1] #6 createMarch"不会失败"的结论过于绝对

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 |
|--------|-------------|-------------|-------------|
| createMarch本身不会失败 | "createMarch本身不会失败(总是创建成功)"，createReturnMarch返回null是正常的业务逻辑 | 虽然createMarch当前实现确实总是创建成功（L235-280只是构造对象并存储），但Builder的结论是**基于实现细节**而非**基于接口契约**。createMarch在以下场景可能失败：(1) 当deps未初始化时eventBus.emit会抛异常；(2) 如果未来增加参数校验（如troops<=0或空路径）；(3) 如果Map容量受限。Builder未区分"当前实现不会失败"和"设计上保证不会失败" | 缺少createMarch的失败路径单元测试（如传入空path、troops=0、未初始化deps等边界条件的测试）。也缺少接口层面的不可变保证（如方法签名中声明永远不返回null的文档） |

**严重性**: P1 -- 结论正确但论据不足，未验证边界条件。

### 1.3 [P1] #8 effectivePower与troops不一致被忽略

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 |
|--------|-------------|-------------|-------------|
| effectivePower与troops不一致是设计选择 | "troops字段存储名义兵力，effectivePower计算实际战力(含将领加成/受伤)，两者语义不同，不是不一致" | 这个分析**部分正确但遗漏了一个实际风险**。在executeSiegeWithExpedition中(L789-795)，effectivePower被用于战斗模拟，但resolveSiege中的cost计算仍然基于calculateSiegeCost（使用原始territory.defenseValue）。这意味着战斗模拟和消耗计算使用了不同的兵力基准。更关键的是：当calculateEffectivePower返回的值远小于force.troops时（例如将领重伤），战斗用effectiveTroops，但cancelSiege回城用task.expedition.troops（原始值），两者可能差距巨大 | 缺少一个测试验证：当effectivePower远小于troops时（如将领重伤减益50%），cancelSiege回城兵力是否合理。需要证明effectivePower仅影响战斗判定，不影响回城兵力计算，且这种不一致在游戏设计上是可接受的 |

**严重性**: P1 -- effectivePower的使用范围需要更清晰的边界定义。

---

## 2. 幻觉攻击

### 2.1 [P1] 902个测试通过的覆盖率幻觉

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 |
|--------|-------------|-------------|-------------|
| 902测试全通过验证了修复 | 902/902 = 100%通过率，暗示全面验证 | **测试覆盖率数字可能产生误导**。分析实际测试内容：(1) settlement-pipeline-integration.test.ts只测试了SettlementPipeline的单元级逻辑，不涉及与真实SiegeSystem/MarchingSystem的交互；(2) execute-siege-path.integration.test.ts虽然有完整链路测试，但cancel降级路径测试使用了mockMarchingSystem而非真实MarchingSystem；(3) SiegeTaskManager.interrupt.test.ts的settling cancel测试(L409-442)创建的是"bare"状态推进（直接advanceStatus到settling，跳过了实际的战斗和结算流程），并未设置task.result。这意味着902个测试中的绝大多数测试的是**单元级正确性**而非**端到端集成正确性** | 缺少一个覆盖"settling状态cancel → 回城兵力扣减伤亡 → 真实MarchingSystem回城 → 到达 → completed"的完整E2E测试。现有settling cancel测试中，task没有result（advanceToSettling不设置result），因此cancelSiege走的是troops=3000（原始值）的路径，与实际战斗后的场景不符 |

**严重性**: P1 -- 测试数量掩盖了覆盖深度不足的问题。

### 2.2 [P1] R26-I03 防重复守卫"等效保护"声明有误

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 |
|--------|-------------|-------------|-------------|
| 防重复守卫提供等效保护 | "防重复守卫已提供等效保护，且setTimeout(0)在JS单线程模型下不会在事件循环中间插入" | **防重复守卫的检查条件有缺陷**。WorldMapTab.tsx L516检查`currentTask.status !== 'marching'`，但setTimeout回调执行时任务可能已经从'marching'推进到'sieging'（由march:arrived事件处理推进），此时status确实不是'marching'，守卫会return。但如果两个march:arrived事件快速连续触发（如两个不同行军同时到达），第二个setTimeout回调在第一个回调执行完毕后才会运行——此时currentTask已经被推进到sieging甚至settling，守卫会拒绝执行，这是正确的行为。**但问题在于：如果组件在setTimeout回调执行前卸载再重新挂载**，siegeTaskManagerRef.current可能指向新实例，getTask可能返回null或不同的task，守卫的判断基础就失效了 | 缺少一个测试验证：组件卸载→重新挂载→setTimeout回调执行时的行为。也缺少对setTimeout回调中siegeTaskManagerRef.current可能为null的防护验证 |

**严重性**: P1 -- 等效保护的声明在组件卸载/重挂载场景下可能不成立。

---

## 3. 无证据攻击

### 3.1 [P1] R27-I02 cancelSiege回城兵力问题——Builder确认了bug却未实际验证

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 |
|--------|-------------|-------------|-------------|
| cancelSiege回城兵力使用原始值 | "**确认存在**。cancelSiege L419使用task.expedition.troops(原始出征兵力3000)创建回城行军" | Builder虽然确认了问题存在，但其验证仅基于代码阅读，**未运行任何实际测试来验证当前行为**。从SiegeTaskManager.interrupt.test.ts L410-427来看，settling cancel测试期望`troops: 3000`——这意味着当前测试**验证的是bug行为**，而非正确行为。Builder建议的防御性修复`task.expedition.troops - (task.result?.defeatTroopLoss \|\| 0)`中，由于R27修复已将defeatTroopLoss改为0，此修复实际不会改变任何运行时行为——它是一个纸面修复 | 缺少：(1) 一个验证当前settling cancel回城兵力是否确实错误的测试（需要task有result的场景）；(2) 一个验证修复后回城兵力正确的测试。当前测试中advanceToSettling不设置result，因此cancelSiege回城始终使用原始troops，这不是真实场景 |

**严重性**: P1 -- 确认了问题但修复方案在当前架构下无效。

### 3.2 [P2] #7 CooldownManager评估未充分验证

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 |
|--------|-------------|-------------|-------------|
| CooldownManager孤立未统一是技术债务 | "SiegeSystem中的captureTimestamps和insiderExposures是独立的冷却Map，未使用CooldownManager统一管理。建议迁移" | Builder确实读取了CooldownManager.ts和SiegeSystem.ts的代码，评估基本准确。但**迁移可行性分析缺失**：(1) CooldownManager使用`type`字段区分冷却类型，但SiegeSystem的captureTimestamps和insiderExposures有额外的业务逻辑（如序列化格式不同、冷却检测触发事件不同）；(2) insiderExposures的clearInsiderExposure在insider策略胜利时调用，而CooldownManager.clearCooldown会emit stateChanged事件——这两者的副作用是否兼容未被验证 | 缺少迁移可行性的具体分析：副作用兼容性验证、序列化格式迁移方案 |

**严重性**: P2 -- 评估方向正确但缺乏深度分析。

---

## 4. 集成断裂攻击

### 4.1 [P1] R26-I07 资源守恒测试在settlement-pipeline中无法验证全链路

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 |
|--------|-------------|-------------|-------------|
| 在settlement-pipeline测试中添加资源守恒测试 | "在settlement-pipeline-integration.test.ts或新建测试文件中补充资源守恒断言测试" | **settlement-pipeline-integration.test.ts使用mock eventBus和独立的SettlementPipeline实例**，不涉及真实的资源系统（ResourceSystem）。在mock环境中验证"初始grain - cost.grain = 最终grain"只是验证了数学公式的正确性，不能验证实际的资源扣减链路。真正的资源守恒验证需要：(1) 真实的ResourceSystem实例；(2) 真实的SiegeSystem.executeSiege调用（触发deductSiegeResources）；(3) 验证resourceSys.consume的调用参数与预期一致。当前settlement-pipeline测试中resourceSys根本不存在 | 缺少一个使用真实ResourceSystem + SiegeSystem + SettlementPipeline联合的资源守恒集成测试。单纯在mock环境中加断言测试不了真实资源扣减 |

**严重性**: P1 -- 测试位置选择错误，mock环境中的资源守恒断言无法验证真实链路。

---

## 5. 流程断裂攻击

### 5.1 [P1] #30 insider策略E2E测试未覆盖完整链路

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 |
|--------|-------------|-------------|-------------|
| insider胜利路径E2E测试 | execute-siege-path.integration.test.ts中已有"Scenario 7: Insider strategy victory path E2E" | **现有的"insider E2E"测试不是真正的E2E测试**。分析测试代码(L1025-1065)：
1. 使用`createTaskToSieging`手动推进状态（跳过了真实的行军和到达流程）
2. 使用`buildTaskResult`手动构造结果（跳过了真实的executeSiege/resolveSiege流程）
3. 没有调用`SiegeSystem.executeSiegeWithExpedition`，因此`clearInsiderExposure`从未被真实调用
4. 没有验证`insiderExposures` Map确实被清空（只验证了task状态）
5. 没有验证`specialEffectTriggered`的真实值（buildTaskResult硬编码为false）
6. 没有涉及TerritorySystem验证城防保留

真正的insider E2E应该是：SiegeSystem.executeSiege(strategy='insider') → 胜利 → clearInsiderExposure → insiderExposures Map为空 → 城防未受损 | 缺少使用真实SiegeSystem + TerritorySystem的insider策略完整E2E测试：攻城→胜利→验证clearInsiderExposure被调用→验证isInsiderExposed返回false→验证territory.defenseValue未改变 |

**严重性**: P1 -- 现有测试名为E2E但实际是单元级状态推进测试，未覆盖insider策略的核心业务逻辑。

---

## 总结

| 严重性 | 数量 | 具体质疑点 |
|--------|:----:|-----------|
| **P0** | 1 | 1.1 R24-I08 timeExceeded Path B存在性假设未经证实 |
| **P1** | 7 | 1.2 createMarch不会失败论据不足, 1.3 effectivePower边界不清, 2.1 测试覆盖率幻觉, 2.2 防重复守卫在卸载场景失效, 3.1 R27-I02修复方案无效, 4.1 资源守恒测试位置错误, 5.1 insider E2E不是真正E2E |
| **P2** | 1 | 3.2 CooldownManager迁移可行性分析不足 |

**有效质疑**: 9个 (P0:1, P1:7, P2:1)

---

*Challenger攻击报告 | 2026-05-05 | Round 29 对抗审核*
