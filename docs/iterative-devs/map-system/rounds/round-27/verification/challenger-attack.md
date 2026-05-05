# Challenger 攻击报告 — Round 27 全流程E2E(失败/撤退路径)

> **审核日期**: 2026-05-05
> **审核角色**: Challenger（对抗审核者）
> **攻击对象**: Builder 客观审核报告 (12/13 完成结论)

---

## 攻击总览

Builder声称12/13项已完成，仅E2E-R4(撤退还款)部分完成。以下攻击将从数据一致性、集成断裂、边界条件和资源守恒四个方向推翻Builder的结论。

---

## 质疑点清单

### P0-1: 双重兵力扣减 — SiegeSystem 30% + SettlementPipeline 40-70% 实际被执行两次

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 | 严重度 |
|--------|-------------|-------------|-------------|--------|
| **P0-1**: 失败路径存在双重兵力扣减 | E2E-F2(失败伤亡计算)完成、E2E-F7(失败数据一致性)完成 | SiegeSystem.resolveSiege在失败时执行`deductSiegeResources({ troops: defeatTroopLoss, grain: cost.grain })`，其中`defeatTroopLoss = cost.troops * 0.3`(行605)。但WorldMapTab同时使用SettlementPipeline.calculate()得到`effectiveTroopsLost`（来自SiegeResultCalculator的40-70%伤亡率），并用它计算回城兵力`troops - effectiveTroopsLost`（行651）。**两套不同的伤亡值被同时使用**：SiegeSystem从资源系统扣30%兵力，SettlementPipeline计算40-70%伤亡用于回城。玩家实际损失取决于resourceSys.consume是否成功执行（行634-643有try-catch静默），存在两种可能：(a) 资源系统扣30% + 回城扣40-70% = 总损失70-100%，或(b) 资源系统静默失败 + 回城扣40-70% = 仅40-70%。无论哪种，SiegeSystem的30%和SiegeResultCalculator的40-70%互相矛盾且从未被统一。 | 缺少验证两套伤亡值是否一致的测试。没有测试同时检查SiegeSystem.deductSiegeResources的扣减值与SettlementPipeline.casualties.troopsLost是否相同。缺少WorldMapTab端到端测试验证最终玩家兵力变化。 | **P0** |

**关键代码路径**:

1. `SiegeSystem.resolveSiege` 失败分支 (行602-626):
   - `defeatTroopLoss = Math.floor(cost.troops * 0.3)` → 30%伤亡率
   - `this.deductSiegeResources({ troops: defeatTroopLoss, grain: cost.grain })` → 直接从resourceSys扣减

2. `WorldMapTab` 行622: `const effectiveTroopsLost = casualties.troopsLost` → 来自SettlementPipeline.calculate()，使用SiegeResultCalculator的40-70%伤亡率

3. `WorldMapTab` 行651: `troops: currentTask.expedition.troops - effectiveTroopsLost` → 回城兵力基于40-70%伤亡

4. `SiegeResultData` 行680: `defeatTroopLoss: siegeResult.defeatTroopLoss` → UI弹窗显示30%伤亡

**结论**: 玩家看到弹窗说损失30%兵力，但实际回城兵力按40-70%扣减（且可能又被SiegeSystem从资源系统额外扣30%）。三套数字互相打架。

---

### P0-2: cancelSiege回城兵力使用全量远征兵力而非扣减后兵力

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 | 严重度 |
|--------|-------------|-------------|-------------|--------|
| **P0-2**: cancelSiege创建回城行军时使用`task.expedition.troops`(全量兵力)而非扣减后兵力 | E2E-R5(撤退回城行军)完成 | SiegeTaskManager.cancelSiege行419: `troops: task.expedition.troops` 直接使用出征时的完整兵力。对于sieging和paused状态，攻城尚未执行executeSiege，因此未发生战斗伤亡，使用全量兵力是合理的。**但对于settling状态**，攻城已经执行了executeSiege(在WorldMapTab的setTimeout回调中)，SiegeSystem已经通过deductSiegeResources扣减了资源(失败时30%兵力)，但cancelSiege仍然使用全量兵力创建回城行军。这意味着settling状态cancel时， SiegeSystem已扣30%兵力 + 回城行军带100%兵力 = 玩家净赚约30%兵力(如果回城后resourceSys补充了回城行军的兵力)。 | 缺少settling状态cancel时验证回城兵力是否应扣除已结算伤亡的测试。没有测试验证cancelSiege在settling状态下的资源守恒。 | **P0** |

**关键代码**:
- `SiegeTaskManager.cancelSiege` 行416-419: `troops: task.expedition.troops` — 不考虑settling状态下的已结算伤亡
- `SiegeTaskManager.interrupt.test.ts` 行410-428: settling状态cancel测试，断言`troops: 3000`（全量），但未考虑settling时可能已有伤亡

---

### P0-3: settling状态cancel后executeSiege已扣资源不退还，形成资源黑洞

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 | 严重度 |
|--------|-------------|-------------|-------------|--------|
| **P0-3**: settling状态cancel时资源双重损失(已扣+不退) | E2E-R3(settling状态撤退)完成 | 完整链路是：(1) WorldMapTab setTimeout回调执行executeSiege → SiegeSystem.deductSiegeResources扣减30%兵力+全部粮草；(2) 同时SettlementPipeline.calculate计算40-70%伤亡；(3) cancelSiege在settling状态被调用时，不退还任何已扣资源；(4) cancelSiege用全量兵力创建回城行军。结果：SiegeSystem扣了30%兵力（从resourceSys），回城行军带100%兵力，回城后resourceSys可能又补回100%兵力 → 玩家净增70%兵力。或者更糟：如果resourceSys不补回，则玩家损失30%兵力 + 全部粮草但没有任何战斗结算收益。无论哪种情况，资源都不守恒。 | 缺少settling状态cancel时的完整资源守恒测试。没有验证executeSiege的deductSiegeResources是否与cancelSiege的回城兵力一致。缺少settling→cancel的资源流转图。 | **P0** |

---

### P1-1: SiegeSystem.executeSiege在resolveSiege中提前扣资源，而非在SettlementPipeline中统一扣减

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 | 严重度 |
|--------|-------------|-------------|-------------|--------|
| **P1-1**: 资源扣减架构分裂 — SiegeSystem和SettlementPipeline各自扣减 | E2E-F3(失败结算流程)完成 | Builder承认"SettlementPipeline defeat路径: calculate=true, distribute=false, notify=true"，但忽略了SiegeSystem.resolveSiege已经在内部调用了deductSiegeResources。SettlementPipeline的calculate阶段通过SiegeResultCalculator再次计算伤亡（40-70%），但只用于填充context.casualties，不再执行实际扣减。这意味着：**实际资源扣减由SiegeSystem的30%决定，而UI展示和回城兵力由SettlementPipeline的40-70%决定**。两套系统各管各的，没有统一权威源。 | 缺少SiegeSystem与SettlementPipeline资源扣减一致性的架构文档和测试。没有测试验证deductSiegeResources的值与SettlementPipeline.casualties.troopsLost相同。 | **P1** |

**注意**: Builder在manifest行193承认"R26-I07: 资源守恒未验证 | 撤退路径仍无资源守恒测试 | 传递R28"，但将此标记为"传递"而非"未完成"。实际上E2E-F7(失败数据一致性)的完成结论直接与此矛盾 — 如果资源守恒未验证，E2E-F7的"完成"结论就不成立。

---

### P1-2: e2e测试cancelSiege未使用真实MarchingSystem验证回城兵力一致性

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 | 严重度 |
|--------|-------------|-------------|-------------|--------|
| **P1-2**: siege-interrupt.e2e.test.ts中cancel测试的回城兵力断言与失败路径使用不同的伤亡来源 | siege-interrupt.e2e.test.ts使用真实MarchingSystem | e2e测试(Test 2, 行233-292)验证cancel后returnMarch.troops = 5000（全量出征兵力）。这是正确的，因为cancel时未发生战斗。但问题是：**没有e2e测试覆盖settling状态cancel**。SiegeTaskManager.interrupt.test.ts行410-428测试了settling cancel，但使用mock MarchingSystem，且断言troops=3000(全量)，未考虑settling时可能已执行executeSiege扣减。 | 缺少settling状态cancel的真实MarchingSystem e2e测试。缺少settling状态cancel时回城兵力=远征兵力-已结算伤亡的验证。 | **P1** |

---

### P1-3: cancelSiege在settling状态绕过状态转换表的合法性验证

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 | 严重度 |
|--------|-------------|-------------|-------------|--------|
| **P1-3**: cancelSiege在settling状态通过`task.status = 'returning'`直接赋值绕过状态转换表 | E2E-R3(settling状态撤退)完成 | Builder在manifest行171声称"settling→returning在转换表中(行636: `settling: ['returning']`)，所以settling→returning是合法的"。但检查代码发现cancelSiege行404: `if (!this.isValidTransition(task.status, 'returning')) return false;` — 这里task.status在sieging状态下已经被改为paused(行393)，所以对sieging→returning路径，实际走的是paused→returning（合法）。但对于settling状态，行389允许settling进入，行404检查isValidTransition('settling', 'returning')。转换表行639: `settling: ['returning']` — 这确实是合法的。**但问题在于**：settling→returning的正常流程是经由WorldMapTab回调中的advanceStatus完成的，而cancelSiege直接执行settling→returning跳过了正常结算。两种settling→returning路径（正常结算 vs 取消）在语义上不同但状态转换相同，可能导致下游逻辑无法区分。 | 缺少settling→returning两种路径（正常结算 vs 取消）的区分机制。没有cancelResult字段标记取消原因。 | **P1** |

---

### P1-4: 失败弹窗显示defeatTroopLoss(30%)与实际回城伤亡(40-70%)不一致

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 | 严重度 |
|--------|-------------|-------------|-------------|--------|
| **P1-4**: SiegeResultModal显示的伤亡数字与实际兵力扣减不一致 | E2E-F5(失败结果弹窗)完成 | WorldMapTab行680: `defeatTroopLoss: siegeResult.defeatTroopLoss` — 这是SiegeSystem的30%值。但行622: `const effectiveTroopsLost = casualties.troopsLost` — 这是SettlementPipeline的40-70%值。弹窗使用defeatTroopLoss显示（30%），但回城兵力使用effectiveTroopsLost计算（40-70%）。玩家看到"损失300兵力"，但实际回城少了550兵力。 | 缺少验证弹窗显示伤亡与实际回城兵力扣减一致的测试。没有UI层的E2E测试。 | **P1** |

---

### P1-5: cancelSiege不退还粮草 — 攻城开始时是否已扣粮草存疑

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 | 严重度 |
|--------|-------------|-------------|-------------|--------|
| **P1-5**: 撤退不退还粮草 | E2E-R4(撤退还款)部分完成 | Builder承认cancelSiege不退还资源。但关键问题是：**粮草何时被扣减？** SiegeSystem.deductSiegeResources在resolveSiege中调用（行595/621），即executeSiege时才扣减。createTask（行91-136）不扣资源。所以：sieging/paused状态cancel时，executeSiege尚未执行，粮草未扣，不存在"退还"问题。但settling状态cancel时，executeSiege已执行，粮草已被扣（全部500），cancel不退还 → 玩家在settling状态cancel损失全部粮草但未获得任何战斗结算。这可能是设计意图（攻城已开始，资源已消耗），但缺乏文档确认。 | 缺少粮草扣减时机的设计文档。缺少settling状态cancel时粮草守恒的测试。缺少退回粮草的明确设计决策记录。 | **P1** |

---

### P1-6: WorldMapTab的setTimeout(0)回调中executeSiege失败路径未覆盖settling→cancel场景

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 | 严重度 |
|--------|-------------|-------------|-------------|--------|
| **P1-6**: setTimeout回调与cancelSiege的竞态 | E2E-F6(失败事件链路)完成 | WorldMapTab的setTimeout(0)回调（行513）有防重复守卫`if (!currentTask || currentTask.result || currentTask.status !== 'marching') return;`。这个守卫检查status === 'marching'。但如果攻城已推进到sieging→settling（回调已开始执行），此时用户点击cancel：回调正在同步执行中（advanceStatus('settling')行611已执行，但advanceStatus('returning')行636尚未执行），cancelSiege将任务状态设为returning。然后回调继续执行advanceStatus('returning')，发现状态已经是returning（cancelSiege设置的），isValidTransition('returning', 'returning')返回false → advanceStatus返回null → 后续回城行军创建可能被跳过。但实际上JavaScript是单线程的，setTimeout回调一旦开始执行就会同步完成，cancelSiege不可能在回调执行中途被调用（cancelSiege在另一个事件循环中）。**所以竞态风险极低但非零**（例如requestAnimationFrame中cancelSiege被调度）。 | 缺少setTimeout回调与cancelSiege竞态条件的理论分析和压力测试。缺少settling状态下cancelSiege与setTimeout回调交互的时序图。 | **P1** |

---

### P2-1: SiegeSystem.deductSiegeResources的try-catch静默失败导致扣减不可追踪

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 | 严重度 |
|--------|-------------|-------------|-------------|--------|
| **P2-1**: deductSiegeResources静默失败导致测试与生产行为不一致 | E2E-F7(失败数据一致性)完成 | SiegeSystem行634-643: `try { ... } catch { /* 资源系统不可用时静默处理（测试环境） */ }`。这意味着在测试环境中（无resourceSys），deductSiegeResources静默跳过。但SettlementPipeline的calculate阶段仍然计算40-70%伤亡并反映在casualties.troopsLost中。测试中看到的是40-70%伤亡用于回城兵力，但SiegeSystem的30%扣减被静默跳过。**生产环境中两套扣减都会执行**（30%从resourceSys扣 + 40-70%从回城兵力体现），但测试只验证了一套。 | 缺少resourceSys可用时（非静默跳过）的集成测试。缺少验证deductSiegeResources实际被调用的断言。 | **P2** |

---

### P2-2: SiegeBattleSystem在WorldMapTab中被cancelBattle后，攻城结果仍基于旧executeSiege判定

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 | 严重度 |
|--------|-------------|-------------|-------------|--------|
| **P2-2**: 战斗系统与结算系统的判定脱钩 | E2E-F1(失败判定触发)完成 | WorldMapTab行541-548: `const siegeResult = siegeSystem.executeSiege(...)` — 使用SiegeSystem的simulateBattle决定胜负。行528-538: `battleSystem.createBattle(...)` — SiegeBattleSystem创建战斗会话用于动画。行641: `battleSystem.cancelBattle(...)` — 结算完成后立即取消战斗。这意味着SiegeBattleSystem的战斗模拟（基于attackPower消耗defenseValue）从未真正完成，攻城胜负完全由SiegeSystem.executeSiege的随机判定决定。两个战斗系统的判定逻辑可能不一致。 | 缺少SiegeBattleSystem与SiegeSystem胜负判定一致性的验证。没有测试对比两个系统的战斗结果。 | **P2** |

---

### P2-3: 攻城开始时未检查粮草是否足够就创建任务

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 | 严重度 |
|--------|-------------|-------------|-------------|--------|
| **P2-3**: createTask不校验资源，executeSiege才校验 | E2E-R4(撤退还款)部分完成 | SiegeTaskManager.createTask（行91-136）不检查资源是否充足。WorldMapTab行1151获取currentGrain，行1156获取costEstimate，但未在createTask前验证grain >= cost。验证推迟到executeSiege的checkSiegeConditions（行231-292）。在marching期间如果粮草被其他操作消耗，executeSiege时checkSiegeConditions返回false → siegeResult.launched = false → 整个结算链路被跳过（但任务已创建且在行军中）。这意味着行军已经出发但攻城无法执行，任务卡在sieging状态。 | 缺少行军期间资源变化导致executeSiege失败的处理路径。没有测试覆盖"行军中粮草被消耗"的场景。 | **P2** |

---

## 严重度统计

| 严重度 | 数量 | 质疑点 |
|--------|------|--------|
| **P0** | 3 | P0-1(双重兵力扣减), P0-2(cancelSiege回城全量兵力), P0-3(settling cancel资源黑洞) |
| **P1** | 6 | P1-1(架构分裂), P1-2(e2e测试缺口), P1-3(状态语义混淆), P1-4(弹窗数值不一致), P1-5(粮草退还设计缺失), P1-6(竞态风险) |
| **P2** | 3 | P2-1(静默扣减), P2-2(战斗判定脱钩), P2-3(延迟校验) |

---

## 对Builder结论的总体推翻

### Builder声称E2E-F2(失败伤亡计算)完成 — 不可信
- SiegeSystem使用30%伤亡率，SettlementPipeline使用40-70%伤亡率，两套值不同且无统一机制
- WorldMapTab同时使用两套值：30%用于弹窗显示，40-70%用于回城兵力

### Builder声称E2E-F4(失败回城行军)完成 — 不可信
- 回城兵力基于SettlementPipeline的40-70%伤亡，但SiegeSystem已从资源系统扣减30%
- 两套扣减系统同时生效，导致实际兵力损失不可预测

### Builder声称E2E-F7(失败数据一致性)完成 — 不可信
- 三套伤亡值(30%/40-70%/弹窗显示值)互相矛盾
- 无资源守恒测试验证

### Builder声称E2E-R3(settling状态撤退)完成 — 不可信
- cancelSiege使用全量兵力创建回城，未考虑settling时已执行的deductSiegeResources扣减
- settling→cancel路径的资源流转无人验证

### Builder声称E2E-R5(撤退回城行军)完成 — 部分可信
- sieging/paused状态cancel的回城行军正确（未发生战斗，全量兵力合理）
- settling状态cancel的回城行军兵力不正确

### E2E-R4(撤退还款)的部分完成标记是准确的
- cancelSiege确实不退还资源，且无资源守恒测试

---

## 修正后的完成状态

| 类别 | Builder结论 | Challenger修正 |
|------|-----------|---------------|
| E2E-F1 失败判定触发 | 完成 | 完成(无争议) |
| E2E-F2 失败伤亡计算 | 完成 | **未完成** — 双套伤亡率无统一 |
| E2E-F3 失败结算流程 | 完成 | **部分完成** — calculate执行但与SiegeSystem扣减重叠 |
| E2E-F4 失败回城行军 | 完成 | **未完成** — 回城兵力基于不一致的伤亡值 |
| E2E-F5 失败结果弹窗 | 完成 | **部分完成** — 弹窗显示30%但实际扣40-70% |
| E2E-F6 失败事件链路 | 完成 | 完成(无争议) |
| E2E-F7 失败数据一致性 | 完成 | **未完成** — 三套数值互相矛盾 |
| E2E-R1 sieging状态撤退 | 完成 | 完成(无争议) |
| E2E-R2 paused状态撤退 | 完成 | 完成(无争议) |
| E2E-R3 settling状态撤退 | 完成 | **部分完成** — 回城兵力未扣减已结算伤亡 |
| E2E-R4 撤退还款 | 部分完成 | 部分完成(Builder结论准确) |
| E2E-R5 撤退回城行军 | 完成 | **部分完成** — settling状态回城兵力不正确 |
| E2E-R6 撤退事件链路 | 完成 | 完成(无争议) |

**修正后**: 4/13 完成 / 5/13 部分完成 / 4/13 未完成

---

*Challenger攻击报告 | 2026-05-05 | Round 27 全流程E2E(失败/撤退路径)*
