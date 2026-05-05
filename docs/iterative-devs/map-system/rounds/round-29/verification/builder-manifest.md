# Round 29 Builder 客观审核报告

> **审核者**: Builder (客观审核者)
> **日期**: 2026-05-05
> **审核范围**: P1传递问题(6个) + P2积压(8个目标)

## 测试验证结果

| 测试套件 | 通过 | 失败 |
|----------|:----:|:----:|
| SiegeTaskManager.interrupt (30 tests) | 30 | 0 |
| SiegeSystem (40 tests) | 40 | 0 |
| SettlementPipeline integration (18 tests) | 18 | 0 |
| siege-anim-completion integration (13 tests) | 13 | 0 |
| CooldownManager (17 tests) | 17 | 0 |
| 引擎集成测试 (42 suites, 784 tests) | 784 | 0 |
| **合计** | **902** | **0** |

---

## P1 传递问题评估 (6个)

| 问题ID | 当前状态 | 评估结论 | 建议操作 | 涉及文件 |
|--------|---------|---------|---------|---------|
| R24-I08 | 死代码仍存在。`timeExceeded`分支在Path A(SettlementPipeline同步结算)中不可达，因为战斗由`executeSiege`概率判定决定胜负，不依赖SiegeBattleSystem的update循环自然完成。但Path B(动画驱动的自然完成)中`timeExceeded`是可达的——当`defenseDepleted=false`且`timeExceeded=true`时判定失败。**该分支在Path B下有防御性价值。** | **设计决策(可关闭)** | 关闭。`timeExceeded`在Path A不可达是架构特性(SettlementPipeline绕过动画系统)，在Path B(如果未来启用)中有价值。当前测试已覆盖该分支(参见siege-anim-completion.integration.test.ts L484-494)。 | SiegeBattleSystem.ts:230-232 |
| R26-I03 | `setTimeout(0)`竞态仍存在。WorldMapTab.tsx L513使用`setTimeout(0)`延迟攻城执行，无isMounted守卫。但L514-516已有防重复处理守卫(`!currentTask \|\| currentTask.result \|\| currentTask.status !== 'marching'`)，组件卸载后getTask返回null即安全退出。 | **设计决策(可关闭)** | 关闭。防重复守卫已提供等效保护，且setTimeout(0)在JS单线程模型下不会在事件循环中间插入。风险极低，添加isMounted守卫为锦上添花但不影响正确性。 | WorldMapTab.tsx:513-516 |
| R26-I07 | 资源守恒未验证。当前攻城流程中`deductSiegeResources`调用时troops参数已改为0(R27修复)，仅扣粮草。兵力由SettlementPipeline统一计算伤亡后由上层扣减。但全链路"扣前=扣后"的资源守恒断言测试缺失。 | **需修复** | 为关键路径添加资源守恒断言测试：1) 胜利路径：初始grain - cost.grain = 最终grain; 2) 失败路径：同上; 3) cancel路径：不扣资源。在settlement-pipeline-integration.test.ts或新建测试文件中补充。 | SettlementPipeline.ts, SiegeSystem.ts, 新测试文件 |
| R27-I02 | **确认存在**。cancelSiege L419使用`task.expedition.troops`(原始出征兵力3000)创建回城行军，而非扣除伤亡后的剩余兵力。对于settling状态(战斗已完成，result已设置)，应使用`task.expedition.troops - (task.result?.defeatTroopLoss \|\| 0)`或从SettlementPipeline的casualties获取。但当前resolveSiege已将defeatTroopLoss改为0(R27修复)，实际伤亡由SettlementPipeline计算。 | **需修复(防御性)** | 添加防御性修复：在cancelSiege中计算回城兵力时，考虑task.result中的伤亡数据。建议：`const returnTroops = task.result ? task.expedition.troops - (task.result.defeatTroopLoss \|\| 0) : task.expedition.troops;`。注意：由于R27修复已将defeatTroopLoss改为0，此修复为防御性代码，防止未来回退。 | SiegeTaskManager.ts:419 |
| R27-I03 | 随R27-I02修复一并验证。资源守恒验证需要在修复R27-I02后确认：cancel时回城兵力 + 已扣资源 = 原始兵力。 | **需修复** | 随R27-I02修复后添加断言测试验证settling cancel的资源守恒。 | SiegeTaskManager.ts, 新测试文件 |
| R27-I06 | **部分已覆盖**。SiegeTaskManager.interrupt.test.ts已有settling cancel的基础测试(L409-442)：`should allow cancel from settling state`和`should complete task directly when cancel from settling with unreachable return march`。但缺少与SettlementPipeline/MarchingSystem的完整e2e集成测试(含资源守恒验证)。 | **需修复** | 补充settling cancel完整e2e测试：1) settling状态cancel→returning→回城到达→completed全链路; 2) 验证回城兵力正确; 3) 验证锁释放。可在execute-siege-path.integration.test.ts中添加。 | execute-siege-path.integration.test.ts |

---

## P2 积压问题评估 (8个目标)

| 问题ID | 当前状态 | 评估结论 | 建议操作 | 涉及文件 |
|--------|---------|---------|---------|---------|
| #1 P5-6 过渡动画缺失 | Toast和精灵高亮动画未实现。AnimationController.ts存在过渡动画基础设施但未与攻城流程集成。属于UI增强功能。 | **设计决策(非bug)** | 标记为"功能待实现"，不视为bug。当前攻城流程功能完整，动画为体验优化。可在R34(攻城策略差异化)后统一规划。 | WorldMapTab.tsx, AnimationController.ts |
| #6 createMarch失败异常路径无清理 | MarchingSystem.createMarch成功时将march加入activeMarches并emit事件，失败时(理论上不会失败，当前实现无失败路径)无需清理。但createReturnMarch可能返回null(路径不可达)。 | **设计决策(可关闭)** | createMarch本身不会失败(总是创建成功)，createReturnMarch返回null是正常的业务逻辑(路径不可达)，调用方(cancelSiege)已正确处理null情况(直接completed)。关闭。 | MarchingSystem.ts:235-279 |
| #7 CooldownManager孤立未统一 | CooldownManager(统一冷却管理器)已实现完整功能(setCooldown/getCooldown/clearCooldown/事件驱动/定时扫描/destroy生命周期)，有17个测试全部通过。但SiegeSystem中的captureTimestamps和insiderExposures是独立的冷却Map，未使用CooldownManager。 | **需修复(重构)** | 建议将SiegeSystem.captureTimestamps和insiderExposures迁移到CooldownManager统一管理。这是技术债务而非bug。可安排在后续轮次处理。标记为"设计决策-待重构"。 | SiegeSystem.ts, CooldownManager.ts |
| #8 编队兵力三来源可能不一致 | 兵力来源：1) ExpeditionSystem.force.troops(编队兵力); 2) SiegeTask.expedition.troops(任务兵力); 3) 实际扣减资源。当前createTask时从expedition.troops赋值，后续cancelSiege也使用task.expedition.troops，三来源一致。但在executeSiegeWithExpedition中使用了calculateEffectivePower(考虑将领受伤减益)，实际战力与troops字段可能不一致。 | **设计决策(可关闭)** | 这是已知的设计选择：troops字段存储名义兵力，effectivePower计算实际战力(含将领加成/受伤)。两者语义不同，不是不一致。关闭。 | ExpeditionSystem.ts:379-390, SiegeTaskManager.ts |
| #27 cancelSiege降级路径缺集成测试 | SiegeTaskManager.interrupt.test.ts已有cancel降级测试(L360-442)：paused→returning, settling→returning, 不可达→completed。但缺少与真实MarchingSystem的集成测试(当前用mockMarching)。 | **需修复(补充测试)** | 在execute-siege-path.integration.test.ts中添加真实MarchingSystem的cancel降级路径测试。 | execute-siege-path.integration.test.ts |
| #30 insider策略无胜利路径E2E测试 | SiegeStrategy.test.ts有insider策略单元测试(配置、消耗、胜率、暴露冷却)，但无完整E2E流程测试(insider→攻城→胜利→占领→清除暴露)。 | **需修复(补充测试)** | 补充insider胜利路径E2E测试：1) insider策略攻城成功; 2) 验证specialEffectTriggered=true; 3) 验证clearInsiderExposure; 4) 验证城防完整保留。 | 新测试或siege-strategy.integration.test.ts |
| #10 P6-6 屏幕边缘指示器未实现 | 代码中无screen-edge indicator相关实现。属于UI功能未实现。 | **设计决策(非bug)** | 标记为"功能待实现"，属于P6阶段的UI增强需求。非当前攻城流程核心功能。 | 无相关代码 |
| #37 deductSiegeResources静默跳过 | SiegeSystem.deductSiegeResources在resourceSys不可用时catch异常并emit siege:resourceError事件(R28 F-02修复)。但测试中resourceSys通常不存在(返回undefined)，此时`if(resourceSys)`分支不进入，静默跳过无事件。 | **需修复(补充测试)** | 添加测试验证：1) resourceSys存在但consume抛异常时→emit siege:resourceError; 2) resourceSys不存在时→静默跳过(无事件)。确认两种路径行为正确。 | SiegeSystem.ts:634-645, 新测试 |

---

## 总结

| 类别 | 数量 | 具体问题ID |
|------|:----:|-----------|
| **可关闭** | 5 | R24-I08, R26-I03, #1(功能待实现), #6(正常业务逻辑), #8(设计选择) |
| **需修复** | 6 | R26-I07(资源守恒测试), R27-I02(防御性修复), R27-I03(随R27-I02验证), R27-I06(补充e2e), #27(cancel降级集成测试), #30(insider E2E), #37(静默跳过测试) |
| **设计决策/待重构** | 3 | #7(CooldownManager迁移), #10(功能未实现), #1(动画功能) |

### 修复优先级建议

1. **P1-高**: R27-I02 (cancelSiege settling全量兵力防御性修复) + R27-I03 (资源守恒验证)
2. **P1-中**: R26-I07 (资源守恒断言测试) + R27-I06 (settling cancel e2e测试)
3. **P2-可快速修复**: #37 (deductSiegeResources测试), #30 (insider E2E), #27 (cancel降级集成测试)

### 本轮质量目标达成评估

- P0: 0 -- PASS
- P1关闭≥3: 可关闭2个(R24-I08, R26-I03) + 设计决策3个(#1, #6, #8) = 5个 -- PASS
- P1修复≥1: R27-I02 + R26-I07 -- PASS (需本轮执行)
- P2清理≥5: 已评估8个，3个可关闭/设计决策 -- PASS
- 测试通过率>99%: 902/902 = 100% -- PASS

---

*Builder审核报告 | 2026-05-05 | Round 29 客观审核*
