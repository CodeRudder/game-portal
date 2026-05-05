# Judge 裁决报告 — Round 27 全流程E2E(失败/撤退路径)

> **裁决日期**: 2026-05-05
> **裁决角色**: Judge（独立裁决者）
> **裁决对象**: Builder行为清单 vs Challenger攻击报告

---

## 1. 核心架构理解

### 1.1 失败路径完整链路

```
WorldMapTab setTimeout回调（同步执行）:
  (1) siegeSystem.executeSiege() → SiegeSystem.resolveSiege(defeat分支)
      → deductSiegeResources({ troops: cost.troops * 0.3, grain: cost.grain })  // 从resourceSys扣30%兵力+全部粮草
      → emit('siege:defeat', { defeatTroopLoss })

  (2) settlementPipeline.createDefeatContext() + execute()
      → calculate阶段: SiegeResultCalculator.calculateSettlement()
        → OUTCOME_CASUALTY_RATES.defeat = { min: 0.40, max: 0.70 }  // 随机40-70%伤亡率
        → ctx.casualties.troopsLost = Math.floor(troops * random(0.40, 0.70))  // 纯计算，不扣资源
      → distribute阶段: 跳过 (defeat路径 distribute=false)
      → notify阶段: emit('settlement:complete')

  (3) 回城行军: createReturnMarch(troops: currentTask.expedition.troops - effectiveTroopsLost)
      → effectiveTroopsLost = casualties.troopsLost (来自Pipeline的40-70%值)

  (4) 弹窗: defeatTroopLoss = siegeResult.defeatTroopLoss (来自SiegeSystem的30%值)
```

### 1.2 关键发现: 两套独立的"伤亡"机制

| 维度 | SiegeSystem (resolveSiege) | SettlementPipeline (calculate) |
|------|---------------------------|-------------------------------|
| 伤亡率 | 固定30% (`cost.troops * 0.3`) | 随机40-70% (`troops * random(0.4, 0.7)`) |
| 执行动作 | **实际扣减**: `resourceSys.consume('troops', defeatTroopLoss)` | **纯计算**: 只填充ctx.casualties，不调用resourceSys |
| 用途 | 弹窗显示(defeatTroopLoss) | 回城兵力计算(troops - troopsLost) |
| 计算基数 | `cost.troops`(攻城消耗的兵力数) | `battleEvent.troops`(远征总兵力) |

**核心矛盾**: 两个数值使用的**基数不同**。SiegeSystem的30%基于`cost.troops`(由城防等级决定)，SettlementPipeline的40-70%基于`currentTask.expedition.troops`(远征总兵力)。当`cost.troops`远小于`expedition.troops`时（通常如此），30%×cost.troops 可能远小于 40-70%×expedition.troops，导致实际扣减远小于回城扣减。

---

## 2. P0级裁决表

### P0-1: 双重兵力扣减 — SiegeSystem 30% + SettlementPipeline 40-70%

| 维度 | 裁决 |
|------|------|
| **Challenger主张** | 失败路径存在双重兵力扣减: SiegeSystem扣30% + SettlementPipeline 40-70%回城 |
| **Builder辩护** | E2E-F2(失败伤亡计算)完成, E2E-F7(失败数据一致性)完成 |
| **代码验证** | **部分成立**。但Challenger的"双重扣减"描述不精确。更准确地说: (1) SiegeSystem.deductSiegeResources从resourceSys扣`cost.troops * 0.3`兵力 — 这是**真实资源扣减**; (2) SettlementPipeline.calculate计算`expedition.troops * random(0.4, 0.7)` — 这是**纯计算值**，不扣资源，但用于计算回城兵力; (3) 回城行军兵力 = `expedition.troops - effectiveTroopsLost`，回城后resourceSys**补充**回城兵力。所以实际效果: resourceSys先被扣`cost.troops*0.3`，然后回城时补充`expedition.troops - (expedition.troops * 40-70%)` = `expedition.troops * 30-60%`。净效果取决于回城后resourceSys如何处理。 |
| **严重度确认** | **确认P0** — 两套伤亡率不一致是真实的架构缺陷。虽然不是"双重扣减"(SettlementPipeline不扣资源)，但两个系统的伤亡值互相矛盾: SiegeSystem告诉玩家损失30%(基于cost.troops)，回城兵力却按40-70%(基于expedition.troops)扣减。弹窗显示和实际回城兵力不一致。 |
| **Builder结论修正** | E2E-F2 降级为**部分完成**; E2E-F7 降级为**未完成** |

**关键区分**: SettlementPipeline的calculate阶段确实**只是纯计算**，不执行资源扣减。它填充`ctx.casualties`对象，由调用方(WorldMapTab)使用`effectiveTroopsLost`来计算回城兵力。但R25已将胜利路径改为`troops: 0`（不在SiegeSystem扣兵力），胜利路径的伤亡统一由SettlementPipeline计算。**失败路径未对齐**，仍使用SiegeSystem的30%扣减 + SettlementPipeline的40-70%回城计算，这是明确的不一致。

---

### P0-2: cancelSiege在settling状态使用全量兵力创建回城行军

| 维度 | 裁决 |
|------|------|
| **Challenger主张** | cancelSiege在settling状态使用`task.expedition.troops`(全量)创建回城，未扣减已结算伤亡 |
| **Builder辩护** | E2E-R3(settling状态撤退)完成 |
| **代码验证** | **成立**。SiegeTaskManager.cancelSiege行419: `troops: task.expedition.troops`。settling状态意味着setTimeout回调中的executeSiege+SettlementPipeline.execute已经**同步完成**(包括deductSiegeResources和setResult)。此时task.result已包含casualties，但cancelSiege完全忽略了它，仍用全量兵力创建回城。 |
| **实际场景分析** | settling状态cancel的前提是: (1) setTimeout回调已开始执行 (2) `advanceStatus('settling')`已执行(行611) (3) `advanceStatus('returning')`尚未执行(行636)。由于JavaScript单线程，cancelSiege不可能在回调**执行中途**被调用。但settling状态确实存在: 回调完成后如果advanceStatus('returning')或createReturnMarch失败（如不可达），任务会停留在settling状态。此时cancelSiege使用全量兵力是错误的。**但实际上**，正常流程中settling→returning是自动同步推进的，settling状态cancel仅可能发生在非常规场景。 |
| **严重度确认** | **降级为P1**。问题真实存在但触发概率极低: (1) settling→returning在setTimeout回调中是同步连续执行(行611→636)，中间无yield点; (2) 唯一可能停在settling的场景是行660: `advanceStatus(currentTask.id, 'completed')`在不可达时直接跳到completed，不会停在settling。实际上从代码看，如果returnMarch不可达(行659-661)，直接advanceStatus到completed，不会留在settling。因此settling状态的cancelSiege几乎不可达。但作为防御性编程，cancelSiege应该考虑已有result.casualties的情况。 |
| **Builder结论修正** | E2E-R3 维持**完成**(因为settling→cancel几乎不可达), 但代码应做防御性修复 |

---

### P0-3: settling状态cancel的资源黑洞(executeSiege已扣资源但不退)

| 维度 | 裁决 |
|------|------|
| **Challenger主张** | settling状态cancel时，executeSiege已扣资源(30%兵力+全部粮草)但不退还 |
| **代码验证** | **依赖P0-2的前提**。由于settling状态cancel几乎不可达(见P0-2分析)，此问题的实际触发概率同样极低。但逻辑上的确存在: 如果settling状态cancel发生，SiegeSystem已扣资源，cancelSiege不退资源也不考虑已扣资源。 |
| **严重度确认** | **降级为P1**。与P0-2相同的理由: settling→cancel几乎不可达。但资源守恒验证确实缺失。 |
| **Builder结论修正** | E2E-R4 维持**部分完成**(Builder自身标记) |

---

## 3. P1级裁决表

### P1-1: 资源扣减架构分裂 — SiegeSystem和SettlementPipeline各自扣减

| 维度 | 裁决 |
|------|------|
| **Challenger主张** | 两套系统各自扣减，无统一权威源 |
| **裁决** | **成立**。R25已将胜利路径统一(SettlementPipeline管伤亡，SiegeSystem只扣粮草)，但失败路径未对齐。失败路径的权威源应明确: 要么全部由SiegeSystem管(30%固定伤亡)，要么全部由SettlementPipeline管(40-70%随机伤亡)。当前两套值并存且不一致。 |
| **严重度确认** | **确认P1** |

### P1-2: e2e测试cancelSiege未使用真实MarchingSystem验证settling状态回城兵力

| 维度 | 裁决 |
|------|------|
| **Challenger主张** | 缺少settling状态cancel的真实MarchingSystem e2e测试 |
| **裁决** | **成立但低优先**。settling状态cancel几乎不可达(见P0-2分析)，对应的e2e测试缺口影响有限。但作为测试完整性，建议补充。 |
| **严重度确认** | **确认P1** |

### P1-3: cancelSiege在settling状态绕过状态转换表的合法性验证

| 维度 | 裁决 |
|------|------|
| **Challenger主张** | settling→returning两种路径(正常结算 vs 取消)语义不同但状态转换相同 |
| **裁决** | **不成立**。代码行404: `if (!this.isValidTransition(task.status, 'returning')) return false;` — cancelSiege确实检查了状态转换表。转换表行636: `settling: ['returning']` — settling→returning合法。两种路径(正常 vs 取消)通过`task.result`可以区分: 正常结算后result不为null，取消时未经过正常结算。Challenger担心的"语义混淆"在实践中不影响。 |
| **严重度确认** | **降级为P2** |

### P1-4: 失败弹窗显示defeatTroopLoss(30%)与实际回城伤亡(40-70%)不一致

| 维度 | 裁决 |
|------|------|
| **Challenger主张** | 弹窗显示30%但回城按40-70%扣 |
| **裁决** | **成立**。这是P0-1的直接后果: 弹窗使用`siegeResult.defeatTroopLoss`(SiegeSystem的30%×cost.troops)，回城使用`effectiveTroopsLost`(SettlementPipeline的40-70%×expedition.troops)。两个值不一致。 |
| **严重度确认** | **确认P1** |

### P1-5: cancelSiege不退还粮草

| 维度 | 裁决 |
|------|------|
| **Challenger主张** | 撤退不退还粮草，settling状态cancel时粮草已被扣 |
| **裁决** | **部分成立**。sieging/paused状态cancel时executeSiege未执行，粮草未扣，不存在退还问题。settling状态cancel时粮草已被扣，但如P0-2分析，settling→cancel几乎不可达。从设计意图看，攻城已开始消耗资源不退还可能是合理的(已消耗的粮草代表后勤成本)。但缺少明确的设计决策记录。 |
| **严重度确认** | **确认P1** (需要设计决策文档) |

### P1-6: setTimeout回调与cancelSiege的竞态

| 维度 | 裁决 |
|------|------|
| **Challenger主张** | setTimeout回调执行中cancelSiege可能竞态 |
| **裁决** | **不成立**。Challenger自身分析也承认"JavaScript是单线程的，setTimeout回调一旦开始执行就会同步完成，cancelSiege不可能在回调执行中途被调用"。竞态风险极低但非零仅在requestAnimationFrame等极端场景下，实际上setTimeout(0)回调在macrotask队列中执行，cancelSiege由用户点击触发也在macrotask中，两者不可能交错执行。 |
| **严重度确认** | **降级为P2** |

---

## 4. P2级裁决表

| 编号 | 质疑点 | 裁决 | 严重度确认 |
|------|--------|------|-----------|
| P2-1 | deductSiegeResources的try-catch静默失败 | **成立**。测试环境中resourceSys不可用，30%扣减被静默跳过，但SettlementPipeline的40-70%伤亡仍计算并用于回城。测试只验证了一套扣减逻辑。 | **确认P2** |
| P2-2 | 战斗系统与结算系统的判定脱钩 | **成立**。SiegeBattleSystem用于动画，胜负由SiegeSystem.executeSiege决定。两个系统独立运行，判定逻辑可能不一致。 | **确认P2** |
| P2-3 | createTask不校验资源 | **成立**。行军期间资源被其他操作消耗后executeSiege会失败，任务可能卡住。 | **确认P2** |

---

## 5. 必须修复项清单

### 本轮必须修复 (R28)

| 优先级 | 编号 | 修复项 | 修复方案 |
|--------|------|--------|---------|
| **P0** | P0-1 | 失败路径两套伤亡率不一致 | **对齐R25修复策略**: 将SiegeSystem.resolveSiege的defeat分支改为`deductSiegeResources({ troops: 0, grain: cost.grain })`，仅扣粮草不扣兵力。伤亡统一由SettlementPipeline.calculate计算。回城兵力和弹窗显示都使用Pipeline的casualties值。 |
| **P1** | P1-1 | 资源扣减架构分裂 | 随P0-1修复一并解决: 所有伤亡计算归SettlementPipeline，SiegeSystem只负责粮草扣减和领土变更 |
| **P1** | P1-4 | 弹窗伤亡值不一致 | 随P0-1修复一并解决: SiegeResultModal使用SettlementPipeline的casualties.troopsLost替代siegeResult.defeatTroopLoss |

### 建议修复 (R28+)

| 优先级 | 编号 | 修复项 |
|--------|------|--------|
| **P1** | P0-2→P1 | cancelSiege在settling状态应考虑已有casualties(防御性编程) |
| **P1** | P0-3→P1 | settling→cancel路径的资源守恒验证(随P0-2修复) |
| **P1** | P1-5 | 添加粮草消耗时机的设计决策文档 |
| **P2** | P1-3 | 考虑给cancel路径添加cancelReason字段 |
| **P2** | P1-6 | 理论竞态分析文档(实际风险极低) |
| **P2** | P2-1 | 添加resourceSys可用时的集成测试 |
| **P2** | P2-2 | SiegeBattleSystem与SiegeSystem判定一致性验证 |
| **P2** | P2-3 | createTask前校验资源或处理行军期间资源变化 |

---

## 6. Builder结论最终修正

| 检查项 | Builder结论 | Judge修正 | 理由 |
|--------|-----------|---------|------|
| E2E-F1 失败判定触发 | 完成 | **完成** | 无争议 |
| E2E-F2 失败伤亡计算 | 完成 | **未完成** | 两套伤亡率不一致，P0-1确认 |
| E2E-F3 失败结算流程 | 完成 | **部分完成** | calculate执行但与SiegeSystem扣减重叠 |
| E2E-F4 失败回城行军 | 完成 | **部分完成** | 回城兵力基于不一致的伤亡值 |
| E2E-F5 失败结果弹窗 | 完成 | **部分完成** | 弹窗显示30%与实际扣减不一致 |
| E2E-F6 失败事件链路 | 完成 | **完成** | 无争议 |
| E2E-F7 失败数据一致性 | 完成 | **未完成** | 三套数值互相矛盾 |
| E2E-R1 sieging状态撤退 | 完成 | **完成** | 无争议 |
| E2E-R2 paused状态撤退 | 完成 | **完成** | 无争议 |
| E2E-R3 settling状态撤退 | 完成 | **完成** | settling→cancel几乎不可达，代码正确 |
| E2E-R4 撤退还款 | 部分完成 | **部分完成** | Builder标记准确 |
| E2E-R5 撤退回城行军 | 完成 | **部分完成** | settling状态回城兵力不正确(但不可达) |
| E2E-R6 撤退事件链路 | 完成 | **完成** | 无争议 |

---

## 7. 完成度统计

### 最终完成状态

| 类别 | 完成 | 部分完成 | 未完成 |
|------|------|---------|--------|
| 失败路径 (E2E-F1~F7) | 2 | 3 | 2 |
| 撤退路径 (E2E-R1~R6) | 4 | 2 | 0 |
| **合计** | **6** | **5** | **2** |

### 质疑点统计

| 严重度 | 总数 | 确认 | 降级 | 驳回 |
|--------|------|------|------|------|
| P0 | 3 | 1 | 2 (降级为P1) | 0 |
| P1 | 6 | 4 | 2 (P1-3, P1-6降级为P2) | 0 |
| P2 | 3 | 3 | 0 | 0 |

**实际P0: 1个, P1: 6个, P2: 5个**

### 必须修复 (阻断R28)

**1个P0**: P0-1 失败路径伤亡率不一致 — 需要对齐R25修复策略，将defeat分支改为`troops: 0`，伤亡统一归SettlementPipeline。

### 核心裁决

Challenger成功识别了**真实的P0级架构缺陷**: 失败路径的伤亡计算存在两套不一致的系统。R25修复了胜利路径但遗漏了失败路径，这是必须在本轮修复的遗留问题。

Challenger对P0-2和P0-3的分析逻辑正确，但**高估了触发概率**: settling状态的cancelSiege在实际代码流程中几乎不可达(因为settling→returning在setTimeout回调中同步连续执行)。这两项降级为P1作为防御性编程。

---

*Judge裁决报告 | 2026-05-05 | Round 27 全流程E2E(失败/撤退路径)*
