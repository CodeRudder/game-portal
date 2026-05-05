# Judge Ruling — Round 24 Phase 3 (P7~P8) 攻城战斗

> **裁决日期**: 2026-05-05
> **裁决角色**: Judge
> **裁决依据**: Builder Manifest + Challenger Attack Report + 源代码验证

---

## 前置说明: PRD修订的影响

用户已确认攻城模式为**地图内即时攻城**(三国志即时战斗模式)，非全屏战斗场景。此修订对多个质疑点有直接影响:

1. **"回合制"要求需重新评估** — 即时战斗模式下，连续时间驱动(dt-based)可能比离散回合制更合理
2. **行军精灵不应在攻城中消失** — 新PRD要求行军精灵保留在地图上
3. **SiegeBattleSystem作为动画桥接而非战斗判定源** — 在即时攻城模式中，动画驱动+旧系统判定是否可接受需评估

---

## 一、逐项质疑裁决

### V-01 | P8-2 回合制名存实亡 — **PRD修订后降级为P1**

| 维度 | 裁决 |
|------|------|
| Challenger结论 | P0: 连续时间驱动非回合制，根本未实现 |
| Builder辩护 | 连续时间60s间接等价20回合 |
| **Judge裁决** | **PRD修订后可接受，但需明确设计意图** |

**理由**:
- PRD已改为"地图内即时攻城"模式。在此模式下，连续时间驱动的城防衰减(dt-based update)比离散回合制更合理——玩家看到的是城防血条平滑下降而非阶梯式跳动。
- Challenger正确指出"20回合x1s=20s"与"maxDuration=60s"不一致。但这是PRD数值设计问题，不是实现bug。
- **必须修复**: 代码注释和文档仍写"回合制引擎"(SiegeBattleSystem.ts:1)，与实际实现矛盾，需统一为"即时战斗引擎"描述。
- **需要确认**: 用户是否接受"连续时间衰减"替代"离散回合制"。若用户坚持回合制，则需重写update逻辑。

**最终定级**: **P1** (PRD修订后已可接受，但需文档对齐+用户确认)

---

### V-02 | P8-3 城防衰减公式不等价于PRD公式 — **确认，与V-01/D-01合并处理**

| 维度 | 裁决 |
|------|------|
| Challenger结论 | P0: 公式根本不同，attackPower不依赖战力 |
| Builder辩护 | 功能等价——确保恰好打完城防 |
| **Judge裁决** | **Challenger正确。公式偏差是真实缺陷，但需与架构决策一并处理** |

**源代码验证**:
- `SiegeBattleSystem.ts:318-319`: `attackPower = maxDefense / durationSeconds` — 确认troops不参与计算
- `SiegeBattleSystem.ts:301`: troops被解构但仅存入session(line 332)，不进入公式
- 公式的分子是`maxDefense`(城防值)，不是"攻方总战力"——这是一个语义和数值设计的根本偏差

**但是**: 在当前架构中，SiegeBattleSystem的实际角色是**动画桥接**（见I-01裁决），而非战斗判定源。真正决定胜负的是SiegeSystem.executeSiege()中的概率判定，该系统确实使用了兵力参数(line 406-412)。因此V-02的严重性取决于I-01的解决方向。

**最终定级**: **P1** (与I-01架构决策关联，若SiegeBattleSystem升级为唯一判定源则升为P0)

---

### V-03 | P8-8 撤退缺少5秒延迟和二次确认 — **确认，P1**

| 维度 | 裁决 |
|------|------|
| Challenger结论 | P1: 无延迟确认，sieging状态不可撤退 |
| Builder辩护 | cancelBattle API存在 |
| **Judge裁决** | **Challenger正确。双系统撤退路径均不完整** |

**源代码验证**:
- `SiegeTaskManager.ts:389`: `if (!task || task.status !== 'paused') return false;` — 只有paused状态可取消
- `WorldMapTab.tsx:1677-1678`: `onCancelSiege`直接调用`cancelSiege`，无延迟无确认
- 攻城进行中(sieging状态)的任务**无法通过cancelSiege撤退**
- `SiegeBattleSystem.cancelBattle()`仅用于停止动画(从activeBattles中移除)，不涉及UX层面的撤退

**最终定级**: **P1** — UX缺失(5秒延迟+二次确认) + 功能缺失(sieging状态不可撤退)

---

### V-04 | P8-7 失败条件实际上不可能触发 — **确认，但与I-02关联**

| 维度 | 裁决 |
|------|------|
| Challenger结论 | P1: 死代码，自然流程不可达 |
| Builder辩护 | 代码存在 |
| **Judge裁决** | **Challenger正确。在当前同步阻塞架构下，SiegeBattleSystem的失败条件确实是死代码** |

**源代码验证**:
- `WorldMapTab.tsx:538-544`: `siegeSystem.executeSiege()`同步决定胜负
- `WorldMapTab.tsx:637-638`: `battleSystem.cancelBattle()`立即移除战斗会话
- `SiegeBattleSystem.ts:219-220`: `timeExceeded`条件存在，但由于cancelBattle先于update执行，永远不会被评估
- 这不是SiegeBattleSystem的bug，而是**集成架构问题**——SiegeBattleSystem在当前流程中根本没有机会通过update()自然完成战斗

**最终定级**: **P1** (I-02架构问题的衍生症状，随I-02解决)

---

### H-01 | 6个TypeError — **确认，P1**

| 维度 | 裁决 |
|------|------|
| Challenger结论 | P0: mock缺少generatePreview方法导致TypeError |
| **Judge裁决** | **缺陷真实存在，但严重性低于Challenger声称** |

**理由**:
- Mock确实缺少`generatePreview`方法。6个Uncaught TypeError表明测试执行路径与真实组件路径不完全一致。
- 但测试断言验证的是攻城动画序列的行为，`generatePreview`调用属于行军路径规划功能，与攻城动画序列的核心逻辑无直接关系。
- **测试有效性降低**(非完全无效)，断言本身验证的行为是正确的，但mock不完整意味着有未覆盖的崩溃路径。

**最终定级**: **P1** — 需修复mock但不是P0级测试欺诈

---

### H-02 | 全mock测试验证的是Mock而非真实系统 — **确认，P2**

| 维度 | 裁决 |
|------|------|
| Challenger结论 | P1: 测试有效性极低 |
| **Judge裁决** | **Challenger正确，但这是UI层测试的常见模式** |

**理由**:
- siege-animation-sequencing.test.tsx确实是全mock测试，验证的是"React组件对事件协议的响应"而非引擎逻辑。
- 这类测试的价值是**UI集成契约测试**——确保组件正确订阅/响应事件。它不验证引擎逻辑，但验证了UI-事件桥接。
- Builder应在测试文件中明确标注"UI Integration Contract Test"而非混入"引擎逻辑测试"。

**最终定级**: **P2** — 测试分类错误，但测试本身有合理价值

---

### H-03 | SiegeBattleSystem.test.ts测试的引擎在集成中不负责战斗判定 — **确认，P1**

| 维度 | 裁决 |
|------|------|
| Challenger结论 | P1: 单元有效但集成无效 |
| **Judge裁决** | **Challenger完全正确** |

**理由**:
- SiegeBattleSystem.test.ts的28个测试在单元级别完全有效——验证了类自身的update/cancel/序列化逻辑。
- 但在集成中(WorldMapTab.tsx)，SiegeBattleSystem.update()的城防衰减仅用于驱动动画桥接(line 792-803的battle progress同步)，战斗结果由SiegeSystem.executeSiege()决定。
- 测试统计应区分"引擎单元测试"(113个)和"集成有效性"(需额外验证)。

**最终定级**: **P1** — 需在测试报告中明确标注单元有效/集成无效

---

### I-01 | 双路径战斗判定 — SiegeBattleSystem vs SiegeSystem — **P0确认**

| 维度 | 裁决 |
|------|------|
| Challenger结论 | P0: 两套独立系统，架构断裂 |
| Builder辩护 | R15-Task3已注释说明单路径设计 |
| **Judge裁决** | **P0架构风险。但当前代码已有明确的设计意图注释** |

**源代码验证**:
- `WorldMapTab.tsx:546-557`: Builder已添加详细注释解释"SettlementPipeline的唯一调用路径"和"SiegeBattleSystem永远不会发出battle:completed"的设计决策
- `WorldMapTab.tsx:789-791`: 注释明确说明"此update()仅用于驱动城防衰减动画"
- 两套系统的策略机制确实独立: `STRATEGY_DURATION_MODIFIER`(时长修正) vs `computeStrategyWinRate`(胜率修正)

**核心问题**: 这不是"意外断裂"，而是**有意的双系统设计**——SiegeBattleSystem负责动画+城防衰减显示，SiegeSystem负责战斗判定。问题是:
1. SiegeBattleSystem的attackPower不依赖troops(D-01)，使其城防衰减速度与兵力无关，动画与实际战力脱节
2. 两套策略修正机制不一致，策略选择在动画和判定中产生不同效果
3. SiegeBattleSystem被命名为"回合制引擎"但实际仅是动画桥接

**必须修复**:
- 在SiegeBattleSystem的attackPower计算中引入troops参数，使城防衰减动画反映真实兵力差异
- 统一两套系统的策略修正机制，或明确文档化"动画系统策略效果与判定系统独立"

**最终定级**: **P0** — 架构设计需明确统一

---

### I-02 | 同步阻塞结算 — **PRD修订后可接受，降级为P1**

| 维度 | 裁决 |
|------|------|
| Challenger结论 | P0: 战斗过程被跳过，城防衰减动画在集成中永远不发生 |
| Builder辩护 | 单路径设计避免竞态 |
| **Judge裁决** | **Challenger对当前实现的分析完全正确。但PRD修订后需要重新评估** |

**源代码验证**:
- `WorldMapTab.tsx:510`: 整个结算流程在`setTimeout(0)`中同步执行
- `WorldMapTab.tsx:710`: `completeSiegeAnimation()`直接跳到completed阶段，跳过assembly→battle阶段
- 城防血条的绿→黄→红过渡在当前集成中确实不会发生——因为战斗在1帧内完成
- 但**这是当前架构的已知设计**，Builder已在line 546-557注释中明确说明

**PRD修订后的重新评估**:
- 在"地图内即时攻城"模式下，如果战斗确实是即时判定的(像三国志那样瞬间出结果)，同步阻塞可接受
- 但如果用户期望看到城防血条实时下降的动画效果，则需要将结算改为异步流程: createBattle → 多帧update(城防衰减) → 自然完成battle:completed → SettlementPipeline
- 当前的折中方案(同步判定+5秒安全fallback显示结果弹窗)在UX上是可用的

**最终定级**: **P1** — 需用户确认是"即时判定出结果"还是"有动画过程的实时战斗"

---

### I-03 | 撤退链路断裂 — **确认，P1**

| 维度 | 裁决 |
|------|------|
| Challenger结论 | P1: sieging状态不可取消，撤退链路断裂 |
| **Judge裁决** | **Challenger正确** |

**源代码验证**:
- `SiegeTaskManager.cancelSiege()` line 389: 只接受paused状态
- `WorldMapTab.onCancelSiege` line 1677-1678: 直接调用cancelSiege，未先停止battleSystem
- 没有调用SettlementPipeline的cancel路径

**最终定级**: **P1** — 与V-03合并，需要完整的撤退UX实现

---

### D-01 | attackPower不依赖troops — **P0确认**

| 维度 | 裁决 |
|------|------|
| Challenger结论 | P0: 兵力不影响战斗 |
| **Judge裁决** | **P0确认。这是真实的游戏逻辑bug** |

**源代码验证**:
- `SiegeBattleSystem.ts:318-319`: `attackPower = maxDefense / durationSeconds` — troops参数完全不参与
- 无论派100兵还是10000兵，城防衰减速度完全相同
- 在动画层面，这意味着100兵和10000兵的攻城动画(城防血条下降速度)完全一样——视觉效果与游戏直觉矛盾

**必须修复**: attackPower应引入troops因子，例如:
```
attackPower = (troops / baseTroops) * (maxDefense / durationSeconds)
```
或按PRD公式: `attackPower = troops * strategyMod / (defenseCoeff * 20)`

**最终定级**: **P0** — 无论PRD如何修订，兵力影响战斗速度是基本游戏逻辑

---

### D-02 | 未使用FL-MAP-16战力公式 — **P2**

| 维度 | 裁决 |
|------|------|
| Challenger结论 | P1: SiegeBattleSystem未集成FL-MAP-16 |
| **Judge裁决** | **P2 — 因为SiegeBattleSystem不是战斗判定源** |

**理由**:
- SiegeBattleSystem在当前架构中仅是动画桥接。真正决定胜负的SiegeSystem.executeSiege()中，兵力通过`computeWinRate(effectiveTroops, defenderPower)`参与胜率计算(line 396-398)。
- FL-MAP-16公式(`basePower * heroMultiplier`)应集成到战斗判定源(SiegeSystem)，而非动画桥接(SiegeBattleSystem)。
- 但D-01(troops不影响动画)修复后，SiegeBattleSystem也应考虑引入战力公式以使动画反映真实战力。

**最终定级**: **P2** — 随I-01/D-01修复一并处理

---

### D-03 | 策略仅影响动画时长 — **确认，P1**

| 维度 | 裁决 |
|------|------|
| Challenger结论 | P1: 策略仅视觉差异化 |
| **Judge裁决** | **Challenger正确。但在当前双系统架构下是设计必然** |

**源代码验证**:
- `SiegeBattleSystem.ts:86-91`: `STRATEGY_DURATION_MODIFIER`仅修改时长
- `SiegeSystem.ts:209-214`: `computeStrategyWinRate`修改胜率
- 两套系统策略效果完全独立——SiegeBattleSystem中forceAttack更快(-5s)，SiegeSystem中forceAttack有胜率加成

**必须修复**: 统一策略效果，或明确文档化"动画系统策略仅影响时长，判定系统策略影响胜率"

**最终定级**: **P1** — 策略效果不一致会导致玩家困惑

---

## 二、行军精灵3秒后removeMarch (L748) — 新增P0

**问题**: `WorldMapTab.tsx:747-751`中，行军到达后3秒自动移除行军精灵。根据新PRD"地图内即时攻城"要求，行军精灵应保留在地图上（攻城动画叠加在地图Canvas上）。

**源代码验证**:
- L747-751: `setTimeout(() => { marchingSystem.removeMarch(marchId); ... }, 3000)` — 对所有到达事件生效
- 对于攻城任务，行军精灵在3秒后被移除，而攻城动画刚进入assembly阶段(也是3秒)
- 这意味着攻城动画刚启动，行军精灵就消失了——视觉断裂

**必须修复**: 对有关联攻城任务的行军，延迟removeMarch直到攻城动画完成(或从攻城结果弹出后)

**最终定级**: **P0** — 违反新PRD要求，视觉体验直接受损

---

## 三、必须修复项清单

### P0 (必须在本轮修复)

| 编号 | 问题 | 影响 | 修复方向 |
|------|------|------|---------|
| P0-1 | **D-01**: attackPower不依赖troops | 动画中兵力不影响城防衰减速度 | attackPower引入troops因子 |
| P0-2 | **I-01**: 双路径战斗判定架构不清晰 | 策略效果不一致，维护困难 | 明确单一权威源+统一策略机制 |
| P0-3 | **L748**: 行军精灵3秒后消失 | 违反新PRD，攻城动画与行军视觉断裂 | 攻城任务行军保留至动画完成 |

### P1 (应在后续轮次修复)

| 编号 | 问题 | 影响 | 修复方向 |
|------|------|------|---------|
| P1-1 | **V-01/I-02**: 连续时间vs回合制+同步阻塞 | 需用户确认设计方向 | 明确PRD后对齐 |
| P1-2 | **V-03/I-03**: 撤退UX缺失+链路断裂 | sieging状态不可撤退 | 添加5秒延迟+确认+sieging可撤 |
| P1-3 | **V-04**: 失败条件死代码 | SiegeBattleSystem.timeExceeded不可达 | 随架构修复解决 |
| P1-4 | **H-01**: mock缺少generatePreview | 6个TypeError | 补全mock |
| P1-5 | **H-03/D-02**: 测试报告分类+战力公式 | 测试有效性误判 | 标注单元有效/集成无效 |
| P1-6 | **D-03**: 策略效果双系统不一致 | 玩家困惑 | 统一策略修正机制 |
| P1-7 | **V-02**: 城防衰减公式偏差 | 与PRD公式不同 | 随I-01/D-01修复 |

### P2 (可延后)

| 编号 | 问题 | 修复方向 |
|------|------|---------|
| P2-1 | **H-02**: 全mock测试分类错误 | 标注为"UI Integration Contract Test" |
| P2-2 | **D-02**: FL-MAP-16未集成到动画系统 | 随P0-1修复 |

---

## 四、更新后完成度

### 逐项判定 (考虑PRD修订)

| 检查项 | Builder判定 | Judge修正判定 | 说明 |
|--------|:-----------:|:-------------:|------|
| P7-1 行军精灵淡出 | 已完成 | **部分完成** | 3秒后直接移除(非淡出)，且攻城任务行军不应移除 |
| P7-2 攻城场景淡入 | 已完成 | **已完成** | assembly阶段自然衔接，符合新PRD |
| P7-3 SiegeTask状态推进 | 已完成 | **已完成** | marching->sieging转换正确 |
| P7-4 集结动画 | 已完成 | **已完成** | 3秒assembly+Canvas渲染验证 |
| P7-5 全屏通知 | 部分完成 | **部分完成** | 缺攻城专用通知/震动/视口跳转 |
| P8-1 策略差异化动画 | 已完成 | **部分完成** | 动画差异化存在，但策略效果与判定不一致 |
| P8-2 回合制战斗 | 已完成 | **部分完成** | PRD修订后连续时间可接受，但需确认+文档对齐 |
| P8-3 城防衰减公式 | 已完成 | **部分完成** | 公式偏差(troops不参与)，动画与战力脱节 |
| P8-4 城防血条 | 已完成 | **已完成** | RGB平滑过渡+百分比，代码质量高 |
| P8-5 战斗时长约束 | 已完成 | **已完成** | [10s,60s] clamp正确 |
| P8-6 胜利条件 | 已完成 | **已完成** | 城防归零=胜利 |
| P8-7 失败条件 | 已完成 | **部分完成** | 代码存在但集成中不可达(同步阻塞) |
| P8-8 撤退功能 | 已完成 | **部分完成** | API存在但UX缺失+sieging不可撤 |
| P8-9 动态事件提示 | 未完成 | **未完成** | 完全未实现 |
| P8-10 交互权限 | 部分完成 | **部分完成** | 缺显式权限控制 |

### 统计

| 指标 | Builder | Judge修正 |
|------|:-------:|:---------:|
| 已完成 | 12 | **5** (P7-2, P7-3, P7-4, P8-4, P8-5, P8-6) |
| 部分完成 | 2 | **8** (P7-1, P7-5, P8-1, P8-2, P8-3, P8-7, P8-8, P8-10) |
| 未完成 | 1 | **2** (P8-9, 无) |
| 完成率 | 80% (12/15) | **33%** (5/15) |

### 测试统计修正

| 类别 | 原统计 | Judge修正 |
|------|:------:|:---------:|
| 引擎单元测试 | 113 PASS | 113 PASS (单元有效，集成有效性受限) |
| 集成测试 | 29 PASS | 29 PASS (有效性最高) |
| UI测试 | 90 PASS | 84 PASS有效 + 6 PASS但有效性低(mock不完整) |
| **有效测试** | **232** | **~220** (6个全mock测试有效性降低) |

---

## 五、关键架构决策建议

### 1. SiegeBattleSystem角色定位

当前: 动画桥接(城防衰减仅用于显示)
建议: **保持动画桥接角色，但修复attackPower引入troops因子**

理由: 在即时攻城模式下，SiegeSystem的概率判定+SiegeBattleSystem的动画桥接是合理的分工。问题不在于分工本身，而在于动画桥接没有反映真实战力。

### 2. 战斗流程: 同步 vs 异步

当前: setTimeout(0)内同步完成判定+结算
建议: **短期保持同步(可接受)，中期改为异步以支持实时城防衰减动画**

理由: 新PRD"地图内即时攻城"如果意味着玩家能看到城防血条实时下降，则需要异步流程。如果仅是"瞬间出结果+动画过渡"，同步可接受。

### 3. 策略系统统一

当前: 双系统独立策略修正
建议: **SiegeBattleSystem的策略修正应与SiegeSystem对齐，或明确解耦**

---

*Judge Ruling — Round 24 Phase 3 (P7~P8) | 2026-05-05*
