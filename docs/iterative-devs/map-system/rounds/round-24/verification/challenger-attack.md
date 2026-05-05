# Challenger Attack Report — Round 24 Phase 3 (P7~P8)

> **攻击日期**: 2026-05-05
> **攻击角色**: Challenger
> **攻击目标**: Builder Manifest声称 Phase 3 有 12/15 已完成
> **攻击范围**: 漏洞攻击 / 幻觉攻击 / 集成断裂 / 数据一致性

---

## 一、漏洞攻击 (Vulnerability)

### V-01 | P8-2 回合制名存实亡 — 连续时间驱动非回合制

| 质疑点 | Builder结论 | 为什么不可信 | 缺少什么证据 | 优先级 |
|--------|------------|-------------|-------------|--------|
| P8-2"回合制战斗"标为"已完成" | Builder承认"城防衰减是连续时间驱动而非离散回合制"，但标为"已完成" | PRD plan.md明确要求"回合制战斗(最长20回合，每回合1s)"。实际`SiegeBattleSystem.update(dt)`是连续时间衰减，无回合计数器、无回合概念、无离散步进。这不是"部分完成"，而是**根本未实现回合制**。Builder用"连续时间60s间接等价20回合"辩解，但: (1) 20回合×1s=20s，而非60s；(2) 回合制隐含离散决策窗口(每回合可操作)，连续时间无此设计空间 | 回合制数据结构(round counter)、回合边界事件(per-round callback)、回合间操作窗口的实现证据 | **P0** |

**攻击代码引用**:
- `SiegeBattleSystem.ts:201-241` — `update(dt)` 用 `dt * 1000` 累加 `elapsedMs`，用 `attackPower * dt` 衰减城防，无任何回合边界
- `SiegeBattleSystem.ts:78-83` — `maxDurationMs: 60_000` (60秒，非20回合×1s=20秒)

**结论**: P8-2应降级为**未完成**。当前实现是连续时间衰减引擎，不满足PRD回合制要求。

---

### V-02 | P8-3 城防衰减公式不等价于PRD公式

| 质疑点 | Builder结论 | 为什么不可信 | 缺少什么证据 | 优先级 |
|--------|------------|-------------|-------------|--------|
| P8-3城防衰减公式标为"已完成"，声称"功能等价" | Builder声称实际公式`attackPower = maxDefense / durationSeconds`与PRD公式"攻方总战力×策略修正/(城防系数×20)"功能等价 | **不等价**: (1) PRD公式依赖"攻方总战力"作为分子，实际公式的分子是`maxDefense`(城防值)，即**攻方战力与衰减速度完全无关**；(2) PRD公式分母含"城防系数×20"，实际分母仅含`durationSeconds`；(3) 策略修正路径不同: PRD通过乘法修正攻击力，实际通过加减修正时长。数学验证: PRD `attackPower = troops * strategyMod / (defenseCoeff * 20)`，实际 `attackPower = maxDefense / durationSeconds`。这是两个完全不同的公式，仅在"恰好打完城防"这一结果上等价，但在**输入参数意义**上根本不同 | 攻方总战力(troops/forcePower)在城防衰减计算中发挥作用的代码证据 | **P0** |

**攻击代码引用**:
- `SiegeBattleSystem.ts:301-319` — `createBattle` 中 `attackPower = maxDefense / durationSeconds`，troops参数虽传入但**不参与attackPower计算**
- `SiegeBattleSystem.ts:301` — `const { ... troops ... } = params;` troops被解构但仅存入session，不进入公式

**结论**: P8-3公式**非PRD公式**，标为"已完成"是误导。应标为**部分完成**(衰减机制存在但公式偏差)。

---

### V-03 | P8-8 撤退缺少5秒延迟和二次确认

| 质疑点 | Builder结论 | 为什么不可信 | 缺少什么证据 | 优先级 |
|--------|------------|-------------|-------------|--------|
| P8-8撤退标为"已完成"但缺5秒延迟和二次确认 | Builder承认"无5秒延迟+二次确认UX"但仍标"已完成" | PRD(plan.md line 35)明确要求"攻城5秒后可操作，二次确认"。实际代码中: (1) `SiegeTaskManager.cancelSiege()`(line 378-426)仅检查`task.status === 'paused'`，无5秒延迟守卫；(2) `WorldMapTab.tsx:1677-1678`中`onCancelSiege`直接调用`cancelSiege`，无延迟、无确认弹窗；(3) 更严重的是，cancelSiege只接受`paused`状态的任务，但攻城进行中(sieging状态)的任务**无法被取消** — 这意味着PRD意图的"攻城中撤退"在当前实现中根本不可能 | 5秒延迟守卫代码、二次确认弹窗组件、sieging状态下可撤退的证据 | **P1** |

**攻击代码引用**:
- `SiegeTaskManager.ts:388-389` — `if (!task || task.status !== 'paused') return false;` — 只有paused状态可取消
- `WorldMapTab.tsx:1677-1678` — `onCancelSiege` 直接调用无延迟

**结论**: P8-8应降级为**部分完成**。cancelBattle API存在但UX不符合PRD，且sieging状态不可撤退是功能缺失。

---

### V-04 | P8-7 失败条件实际上不可能触发

| 质疑点 | Builder结论 | 为什么不可信 | 缺少什么证据 | 优先级 |
|--------|------------|-------------|-------------|--------|
| P8-7失败条件标为"已完成" | Builder承认"公式设计使自然失败几乎不可能" | **死代码**: `SiegeBattleSystem.update()`中 `timeExceeded = session.elapsedMs >= session.estimatedDurationMs`，但 `attackPower = maxDefense / durationSeconds` 保证恰好打完。且在WorldMapTab中，战斗开始后立即被旧`SiegeSystem.executeSiege()`同步结算，然后`cancelBattle()`移除会话——SiegeBattleSystem永远不会通过`update()`自然完成战斗。失败条件代码存在但**不可达**。测试中也没有任何case触发"超时失败"路径 | 超时失败路径被实际触发的测试证据、非Mock环境下的失败case | **P1** |

**攻击代码引用**:
- `SiegeBattleSystem.ts:219-220` — `timeExceeded` 条件存在但被公式设计规避
- `WorldMapTab.tsx:538-555` — 结算使用旧`siegeSystem.executeSiege()`而非SiegeBattleSystem的自然完成

**结论**: P8-7代码存在但**功能无效**。实际战斗结果由SiegeSystem决定，SiegeBattleSystem仅用于动画驱动。

---

## 二、幻觉攻击 (Hallucination)

### H-01 | 232个测试"全部通过"但6个Uncaught TypeError表明测试框架异常

| 质疑点 | Builder结论 | 为什么不可信 | 缺少什么证据 | 优先级 |
|--------|------------|-------------|-------------|--------|
| Builder声称"232/232 PASS" | 测试断言通过，但有6个Uncaught TypeError | Uncaught TypeError意味着运行时异常未被catch。测试框架(Vitest)在`shouldAdvanceTime: true`模式下可能吞掉这些错误。6个错误指向mock的MarchingSystem缺少`generatePreview`方法——但siege-animation-sequencing.test.tsx的mock(line 136-149)确实没有`generatePreview`方法，而WorldMapTab在line 1194调用`marchingSystem.generatePreview(route.path)`。这意味着测试中触发了该代码路径但异常被静默忽略，**测试覆盖了崩溃路径但断言没有检测到崩溃** | 修复mock后重新运行测试的完整输出、确认6个TypeError不影响断言有效性的证据 | **P0** |

**攻击代码引用**:
- `siege-animation-sequencing.test.tsx:136-149` — MockMarchingSystem缺少`generatePreview`方法
- `WorldMapTab.tsx:1194` — `marchingSystem.generatePreview(route.path)` 会抛出TypeError
- `WorldMapTab.test.tsx:167` — 同文件的旧测试已包含`generatePreview` mock，说明Builder知道需要此mock

**结论**: siege-animation-sequencing.test.tsx的6个测试**有效性存疑**。mock不完整导致组件内TypeError被静默，测试覆盖的代码路径与实际运行路径不一致。应标为**无效测试**。

---

### H-02 | siege-animation-sequencing.test.tsx全Mock测试验证的是Mock而非真实系统

| 质疑点 | Builder结论 | 为什么不可信 | 缺少什么证据 | 优先级 |
|--------|------------|-------------|-------------|--------|
| Builder标此文件"6/6 PASS" | 测试确实6个断言通过 | 该测试mock了SiegeBattleSystem、SiegeBattleAnimationSystem、SettlementPipeline、SiegeTaskManager、MarchingSystem等**全部核心依赖**。断言验证的是: (1) MockSiegeResultModal是否visible — 验证的是React状态；(2) siegeAnim:completed事件后modal显示 — 但completeSiegeAnimation也是mock实现的。**没有验证任何真实引擎逻辑**。这些测试的价值仅限于"React组件对事件的响应"，不覆盖"攻城流程的正确性" | 使用真实系统(至少真实SiegeBattleAnimationSystem)的端到端测试 | **P1** |

**攻击代码引用**:
- `siege-animation-sequencing.test.tsx:178-231` — SiegeBattleSystem完全mock
- `siege-animation-sequencing.test.tsx:233-289` — SiegeBattleAnimationSystem完全mock
- `siege-animation-sequencing.test.tsx:300-352` — SettlementPipeline完全mock(硬编码victory/defeat结果)

**结论**: 6个测试**有效性极低**。它们验证的是mock之间的交互协议，不验证任何真实业务逻辑。应从"通过测试"统计中剔除或标注"仅覆盖UI交互"。

---

### H-03 | SiegeBattleSystem.test.ts未测试关键战斗计算的真实性

| 质疑点 | Builder结论 | 为什么不可信 | 缺少什么证据 | 优先级 |
|--------|------------|-------------|-------------|--------|
| SiegeBattleSystem.test.ts声称28个测试覆盖"战斗逻辑" | 测试确实覆盖了update/cancel/serialize等 | 测试mock了eventBus(合理)，但 SiegeBattleSystem 本身就是被测对象。关键问题是: **SiegeBattleSystem在真实流程中从未驱动战斗结果**。WorldMapTab用旧`SiegeSystem.executeSiege()`决定胜负，SiegeBattleSystem仅用于动画。因此这28个测试验证了一个**在实际流程中不负责战斗判定的系统**，它们的有效性前提("SiegeBattleSystem决定战斗结果")在集成中不成立 | 验证SiegeBattleSystem.update()的战斗完成事件在集成中是否被使用的证据 | **P1** |

**攻击代码引用**:
- `SiegeBattleSystem.test.ts:269-299` — 测试"城防归零=胜利"，但在真实流程中WorldMapTab的handleArrived立即调用`siegeSystem.executeSiege()`决定胜负(line 539-544)，然后`cancelBattle()`移除会话(line 637-638)，SiegeBattleSystem.update()永远没有机会自然完成战斗

**结论**: 28个测试在**单元级别有效**(SiegeBattleSystem自身逻辑正确)，但在**集成级别无效**(该系统不负责战斗判定)。Builder应区分"单元测试有效性"和"集成有效性"。

---

## 三、集成断裂 (Integration Break)

### I-01 | handleArrived中双路径战斗判定 — SiegeBattleSystem vs SiegeSystem

| 质疑点 | Builder结论 | 为什么不可信 | 缺少什么证据 | 优先级 |
|--------|------------|-------------|-------------|--------|
| Builder声称"Phase 2→Phase 3过渡完整" | handleArrived确实有完整链路 | 存在**严重的架构断裂**: handleArrived中同时存在两套战斗判定系统: (1) `battleSystem.createBattle()`(line 526-535) — 创建SiegeBattleSystem战斗会话；(2) `siegeSystem.executeSiege()`(line 539-544) — 用旧SiegeSystem判定胜负。最终结果由SiegeSystem决定，SiegeBattleSystem的会话被`cancelBattle()`立即销毁。这意味着SiegeBattleSystem的`update()`循环(line 792)中的城防衰减**仅用于动画显示**，不影响战斗结果。两套系统的策略修正机制完全独立: SiegeBattleSystem用`STRATEGY_DURATION_MODIFIER`(时长修正)，SiegeSystem用`SIEGE_STRATEGY_CONFIGS`(胜率修正)。**策略的效果取决于使用哪个系统** | 明确"哪个系统是战斗判定的唯一权威源"的架构决策文档 | **P0** |

**攻击代码引用**:
- `WorldMapTab.tsx:526-535` — battleSystem.createBattle (仅创建动画)
- `WorldMapTab.tsx:539-544` — siegeSystem.executeSiege (真正决定胜负)
- `WorldMapTab.tsx:637-638` — battleSystem.cancelBattle (战斗会话被销毁)
- `SiegeBattleSystem.ts:86-91` — STRATEGY_DURATION_MODIFIER (时长修正)
- `SiegeSystem.ts:209-214` — computeStrategyWinRate + winRateBonus (胜率修正)

**结论**: 双路径战斗判定是**P0级架构风险**。SiegeBattleSystem被Builder视为核心战斗引擎，但在集成中仅作为动画驱动器使用。

---

### I-02 | 战斗结束→SettlementPipeline→Phase 4 转换为同步阻塞

| 质疑点 | Builder结论 | 为什么不可信 | 缺少什么证据 | 优先级 |
|--------|------------|-------------|-------------|--------|
| Builder声称"战斗结束→结算→Phase 4链路完整" | 代码确实有完整链路 | handleArrived中整个结算流程在`setTimeout(0)`回调中**同步阻塞执行**: createBattle→executeSiege→SettlementPipeline.execute→setResult→cancelBattle→createReturnMarch→completeSiegeAnimation — 全部在同一宏任务中完成。这意味着: (1) SiegeBattleSystem.createBattle创建的战斗会话在同一帧内被cancelBattle销毁，update()永远看不到它；(2) 动画系统的assembly→battle→completed阶段转换完全跳过，completeSiegeAnimation直接设为completed；(3) 城防血条的实时变化(被测试验证的绿→黄→红过渡)在集成中**永远不会发生**，因为战斗在1帧内完成 | 异步战斗流程(多帧城防衰减)的集成测试证据 | **P0** |

**攻击代码引用**:
- `WorldMapTab.tsx:510` — `setTimeout(() => { ... 所有结算同步执行 ... }, 0)`
- `WorldMapTab.tsx:710` — `siegeAnimSystem.completeSiegeAnimation(currentTask.id, siegeResult.victory)` — 跳过assembly/battle阶段

**结论**: Phase 3的"攻城战斗过程"(P8-2~P8-7)在集成中**被完全跳过**。战斗判定、城防衰减、策略修正全部在setTimeout(0)的同步回调中瞬间完成。Builder测试验证的SiegeBattleSystem.update()城防衰减在真实流程中仅作为**动画桥接**使用。

---

### I-03 | 撤退→cancelSiege→中断结算链路不完整

| 质疑点 | Builder结论 | 为什么不可信 | 缺少什么证据 | 优先级 |
|--------|------------|-------------|-------------|--------|
| Builder声称"撤退功能cancelBattle已实现" | cancelBattle API确实存在 | 但实际撤退路径断裂: (1) `SiegeTaskManager.cancelSiege()`(line 388)只接受`paused`状态，攻城进行中(sieging)的任务不可取消；(2) `WorldMapTab.onCancelSiege`直接调用`cancelSiege`，没有先调用`battleSystem.cancelBattle()`停止战斗引擎；(3) 没有触发SettlementPipeline的cancel路径——cancelSiege直接创建回城行军，跳过结算。这意味着撤退时的资源退还、冷却触发等结算逻辑完全缺失 | 撤退时触发SettlementPipeline cancel路径的代码、sieging状态下可取消的代码 | **P1** |

**攻击代码引用**:
- `SiegeTaskManager.ts:388-389` — `if (!task || task.status !== 'paused') return false;`
- `SiegeTaskManager.ts:402-411` — cancelSiege直接创建回城行军，无结算
- `WorldMapTab.tsx:1677-1678` — onCancelSiege直接调用cancelSiege

**结论**: 撤退链路从sieging状态**不可达**。cancelBattle存在于错误的系统层级(用于停止动画而非用户撤退)。

---

## 四、数据一致性 (Data Consistency)

### D-01 | attackPower不依赖troops参数 — 战斗结果与兵力无关

| 质疑点 | Builder结论 | 为什么不可信 | 缺少什么证据 | 优先级 |
|--------|------------|-------------|-------------|--------|
| Builder承认"attackPower不依赖troops参数"但仍标P8-3"已完成" | Builder在"架构风险"中列出此问题 | 这是**根本性的游戏逻辑错误**: 在SiegeBattleSystem中，无论派出100兵还是10000兵，城防衰减速度完全相同(`attackPower = maxDefense / durationSeconds`)。troops参数存入session但不参与任何计算。PRD公式"攻方总战力×策略修正/(城防系数×20)"中，攻方总战力应是兵力×战力系数。实际实现中兵力对战斗过程零影响。(注: 旧SiegeSystem.executeSiege中兵力确实影响胜率，但那是另一套独立系统) | troops参数在SiegeBattleSystem中参与任何计算(除存入session外)的代码证据 | **P0** |

**攻击代码引用**:
- `SiegeBattleSystem.ts:301` — `const { taskId, targetId, troops, strategy, ... } = params;`
- `SiegeBattleSystem.ts:318-319` — `attackPower = maxDefense / durationSeconds` — troops不在公式中
- `SiegeBattleSystem.ts:332` — `troops` 仅存入 session 对象

**结论**: **P0级数据一致性缺陷**。在SiegeBattleSystem层面，兵力不影响战斗。

---

### D-02 | 城防衰减未使用FL-MAP-16完整战力公式

| 质疑点 | Builder结论 | 为什么不可信 | 缺少什么证据 | 优先级 |
|--------|------------|-------------|-------------|--------|
| Builder未提及FL-MAP-16战力公式与SiegeBattleSystem的关系 | plan.md明确要求"城防衰减公式中攻方总战力是否使用FL-MAP-16完整公式(R4-ISS-001)" | FL-MAP-16战力公式应为`basePower * heroMultiplier`(见round-10 builder-manifest line 120)。SiegeBattleSystem的attackPower = maxDefense/durationSeconds完全不使用任何战力公式。虽然旧SiegeSystem中兵力参与胜率计算，但SiegeBattleSystem作为Builder声称的核心战斗引擎，未使用任何战力公式 | FL-MAP-16公式在SiegeBattleSystem中使用的证据 | **P1** |

**结论**: SiegeBattleSystem未集成FL-MAP-16战力公式。plan.md的对抗性评测重点"城防衰减公式中攻方总战力是否使用FL-MAP-16完整公式"的回答应是**否**。

---

### D-03 | 4种策略的差异化仅影响动画时长，不影响战斗计算

| 质疑点 | Builder结论 | 为什么不可信 | 缺少什么证据 | 优先级 |
|--------|------------|-------------|-------------|--------|
| P8-1策略差异化标为"已完成" | 4种策略确实有不同的Canvas动画效果和时长 | 在SiegeBattleSystem中，策略仅通过`STRATEGY_DURATION_MODIFIER`影响`estimatedDurationMs`(进而影响attackPower)，**不影响战斗结果**(因为战斗结果由旧SiegeSystem的`simulateBattleWithStrategy`决定)。两套系统的策略效果不一致: SiegeBattleSystem中forceAttack=-5s(更快)，SiegeSystem中forceAttack有winRateBonus(更高胜率)。**策略的选择在两套系统中产生不同效果**，但由于最终结果由SiegeSystem决定，SiegeBattleSystem中的策略差异仅体现为动画时长不同 | 策略选择在SiegeBattleSystem中影响战斗判定(而非仅影响动画)的证据 | **P1** |

**攻击代码引用**:
- `SiegeBattleSystem.ts:86-91` — STRATEGY_DURATION_MODIFIER: 仅时间修正
- `SiegeSystem.ts:209-214` — computeStrategyWinRate: 胜率修正(不同的策略机制)

**结论**: 4种策略在SiegeBattleSystem中**仅影响动画速度**，不影响战斗结果。策略差异化是**视觉效果**而非**游戏机制**。

---

## 五、统计摘要

| 质疑编号 | 质疑点 | Builder结论 | Challenger结论 | 优先级 |
|----------|--------|------------|---------------|--------|
| V-01 | P8-2回合制 | 已完成 | **未完成**(连续时间驱动，非回合制) | P0 |
| V-02 | P8-3城防公式 | 已完成 | **部分完成**(公式偏差，不依赖战力) | P0 |
| V-03 | P8-8撤退 | 已完成 | **部分完成**(无延迟确认，sieging不可撤退) | P1 |
| V-04 | P8-7失败条件 | 已完成 | **未完成**(死代码，不可达路径) | P1 |
| H-01 | 6个TypeError | 测试通过 | **测试有效性存疑**(mock缺失导致TypeError) | P0 |
| H-02 | 全mock测试 | 测试通过 | **测试有效性极低**(验证mock非真实系统) | P1 |
| H-03 | 战斗逻辑测试 | 测试覆盖战斗逻辑 | **单元有效但集成无效**(系统不负责战斗判定) | P1 |
| I-01 | 双路径战斗判定 | 链路完整 | **P0架构断裂**(两套独立系统) | P0 |
| I-02 | 同步阻塞结算 | 链路完整 | **P0级问题**(战斗过程被跳过) | P0 |
| I-03 | 撤退链路 | 功能存在 | **链路断裂**(sieging不可取消) | P1 |
| D-01 | attackPower不依赖troops | 已知风险 | **P0数据缺陷**(兵力不影响战斗) | P0 |
| D-02 | 未使用FL-MAP-16 | 未提及 | **未集成**(plan明确要求但未实现) | P1 |
| D-03 | 策略仅影响动画 | 差异化已实现 | **仅视觉差异化**(不影响战斗机制) | P1 |

---

## 六、修正后的完成状态

| 原判定 | 修正后判定 | 说明 |
|--------|-----------|------|
| P7-1 行军精灵淡出: 已完成 | **部分完成** | 无淡出动画，直接移除 |
| P7-5 全屏通知: 部分完成 | **部分完成** (维持) | 缺攻城专用通知 |
| P8-2 回合制战斗: 已完成 | **未完成** | 连续时间驱动，非回合制 |
| P8-3 城防衰减公式: 已完成 | **部分完成** | 公式偏差，不依赖战力 |
| P8-7 失败条件: 已完成 | **未完成** | 死代码，自然流程不可达 |
| P8-8 撤退功能: 已完成 | **部分完成** | 无延迟确认，sieging不可撤 |
| P8-10 交互权限: 部分完成 | **部分完成** (维持) | 缺显式权限控制 |

**修正后统计**: 已完成 7/15 | 部分完成 6/15 | 未完成 3/15 (P8-2, P8-7, P8-9)

---

## 七、有效质疑统计

| 优先级 | 数量 | 编号 |
|--------|------|------|
| P0 | 6 | V-01, V-02, H-01, I-01, I-02, D-01 |
| P1 | 7 | V-03, V-04, H-02, H-03, I-03, D-02, D-03 |
| P2 | 0 | — |
| **合计** | **13** | |

---

*Challenger Attack Report — Round 24 Phase 3 (P7~P8) | 2026-05-05*
