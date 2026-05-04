# R14 Judge Ruling -- Integration Phase

> **Date**: 2026-05-04
> **Role**: Judge
> **Method**: 源码逐行审查 + 证据链验证

---

## Ruling Summary

| 严重性 | 数量 | 状态 |
|--------|------|------|
| P0 (Fatal) | 2 | **CONFIRMED** |
| P1 (Significant) | 4 | **3 CONFIRMED, 1 PARTIALLY CONFIRMED** |
| P2 (Minor) | 3 | **3 CONFIRMED** |

**Verdict: REJECT** -- R14 核心集成目标未真正完成。

---

## Methodology

Judge 直接阅读以下关键源文件，逐行验证双方论据:

1. `WorldMapTab.tsx` L501-661 (handleArrived) -- 活跃执行路径
2. `WorldMapTab.tsx` L709-811 (handleBattleCompleted) -- SettlementPipeline 路径
3. `WorldMapTab.tsx` L1640-1670 (SiegeResultModal JSX) -- UI 渲染入口
4. `WorldMapTab.tsx` L82-134 (mapInjuryLevel, mapInjuryData, mapTroopLoss) -- 纯函数映射
5. `SiegeBattleSystem.ts` -- 战斗完成事件的触发机制
6. `SiegeResultModal.tsx` L45-112 (类型定义), L510-610 (渲染) -- UI 组件

---

## P0 Rulings

### P0-01: handleBattleCompleted (SettlementPipeline 路径) 永远不显示 SiegeResultModal

| 质疑点 | Challenger观点 | Builder补充 | Judge裁决 | 理由 |
|--------|---------------|-------------|-----------|------|
| SettlementPipeline 集成路径是否可达UI | handleBattleCompleted 完成结算后不调用 setSiegeResultData/setSiegeResultVisible，用户永远看不到 | Builder声称 "All subsystems wired to WorldMapTab" | **CONFIRMED (P0)** | **源码验证结果:** (1) `handleBattleCompleted` (L709-811) 确实只调用 `setActiveSiegeTasks()` (L809)，未调用 `setSiegeResultData()` 或 `setSiegeResultVisible()`。(2) 更致命的是，经过对 SiegeBattleSystem 的时序分析，**handleBattleCompleted 实际上从未被执行过**: handleArrived 在 setTimeout 内同步执行 `createBattle()` -> `executeSiege()` -> `setResult()` -> `cancelBattle()`，cancelBattle 将战斗从 activeBattles 移除，因此 SiegeBattleSystem.update() 永远不会对此战斗触发 `battle:completed` 事件。L717 的 guard `if (task.result) return;` 是第二道防线但实际不必要，因为事件本身不会触发。(3) 唯一显示弹窗的路径是 handleArrived L635-636 的 `setSiegeResultData + setSiegeResultVisible`。 |

**Judge 补充分析 -- 时序死锁的完整证据链:**

```
handleArrived (setTimeout callback):
  L540: battleSystem.createBattle()     -- 创建战斗, duration=10~60s
  L553: siegeSystem.executeSiege()      -- 旧系统同步结算
  L577: siegeTaskManager.setResult()    -- 设置 result (guard条件满足)
  L592: battleSystem.cancelBattle()     -- 从 activeBattles 移除战斗

SiegeBattleSystem.update() (rAF loop):
  L206: for (const [taskId, session] of this.activeBattles)
  --> 战斗已被 cancelBattle 移除, 不会进入循环
  --> battle:completed 永远不会 emit
  --> handleBattleCompleted 永远不会执行
```

**结论**: SettlementPipeline 是完全的死代码。Builder 的集成链 "SettlementPipeline -> WorldMapTab -> SiegeResultModal" 在代码层面存在，但运行时完全不可达。

---

### P0-02: handleArrived 硬编码 heroInjured: false, injuryData 永远为 undefined

| 质疑点 | Challenger观点 | Builder补充 | Judge裁决 | 理由 |
|--------|---------------|-------------|-----------|------|
| injuryData 是否有运行时路径产生非undefined值 | handleArrived L571-572 硬编码 heroInjured:false + injuryLevel:'none'，导致 mapInjuryData 永远返回 undefined | Builder声称 "WorldMapTab passes injuryData to SiegeResultModal" | **CONFIRMED (P0)** | **源码验证:** (1) WorldMapTab.tsx L568-574: `const casualties: CasualtyResult = { heroInjured: false, injuryLevel: 'none' as const, ... }` -- 确认硬编码。(2) mapInjuryData (L102): `if (!casualties || !casualties.heroInjured || casualties.injuryLevel === 'none') return undefined;` -- 确认 heroInjured=false 时返回 undefined。(3) SiegeResultModal JSX (L1651-1658): `injuryData={(() => { ... return mapInjuryData(siegeResultData.casualties, generalName); })()}` -- 确认调用链完整但输入永远导致 undefined。(4) SettlementPipeline 路径(P0-01已证不可达)中的 casualties 确实包含正确的 heroInjured 值(从 settlement.casualties 获取)，但该路径永不执行。**R13/R14 的受伤显示功能在实际运行中永远不会触发。** |

**补充说明:** troopLoss 的运行时路径是可用的。handleArrived 中 `effectiveTroopsLost` 可以 > 0，`mapTroopLoss` 检查 `casualties.troopsLost <= 0`，所以 troopLoss 在有伤亡时会正确显示。Builder Task2 的 troopLoss 部分 (Feature Point 2.2) 实际上是有效的，但 injuryData (Feature Point 2.1) 确实无效。

---

## P1 Rulings

### P1-01: SettlementPipeline 成为死代码

| 质疑点 | Challenger观点 | Builder补充 | Judge裁决 | 理由 |
|--------|---------------|-------------|-----------|------|
| 旧系统 siegeSystem.executeSiege() 仍在 handleArrived 中使用 | 旧路径 siegeSystem.executeSiege() (L553) 仍在活跃路径中，SettlementPipeline 在不可达路径 | Builder声称 "Old SiegeResultCalculator calls replaced" | **CONFIRMED (P1)** | (1) WorldMapTab.tsx L553: `const result = siegeSystem.executeSiege(...)` 确认旧系统仍在活跃路径。(2) L706-707 的 SettlementPipeline 只在 handleBattleCompleted 中使用，该路径已被 P0-01 证明不可达。(3) Builder 声称的 "替换" 只是在文件结构层面 (import changed)，运行时层面未替换。 |

### P1-02: shouldDropInsiderLetter 双路径调用

| 质疑点 | Challenger观点 | Builder补充 | Judge裁决 | 理由 |
|--------|---------------|-------------|-----------|------|
| shouldDropInsiderLetter 存在两套独立调用路径 | handleArrived 直接调用 (L618) 和 SettlementPipeline.distribute() 内部调用 (L416) 互不通信 | Builder声称集成通过 | **CONFIRMED (P1)** | (1) WorldMapTab.tsx L618: `if (result.victory && shouldDropInsiderLetter(currentTask.id))` -- 确认 handleArrived 中直接调用。(2) SettlementPipeline L416 也调用同一函数。当前因为 SettlementPipeline 不可达，双路径不会同时执行，不产生双重掉落问题。但这是一个架构债务：handleArrived 绕过了 SettlementPipeline 直接调用 item 系统。**当前无运行时 bug，但架构设计存在冗余和不一致。** |

### P1-03: 集成测试未覆盖 WorldMapTab 事件处理

| 质疑点 | Challenger观点 | Builder补充 | Judge裁决 | 理由 |
|--------|---------------|-------------|-----------|------|
| 3个集成测试文件均不 import WorldMapTab | 测试只测孤立类(纯函数/独立组件/引擎类)，未验证 WorldMapTab 内事件处理→UI传递 | Builder声称 "182 passed, 0 failed" | **CONFIRMED (P1)** | Judge 搜索验证: (1) siege-item-integration.test.ts: 0 matches for "WorldMapTab"。(2) settlement-pipeline-integration.test.ts: 0 matches for "WorldMapTab"。(3) injury-integration.test.tsx: 仅 import 纯函数 `mapInjuryData`, `mapTroopLoss` from WorldMapTab，未渲染 WorldMapTab 组件。**这些测试证明了各子系统本身正确工作，但未证明它们在 WorldMapTab 中的集成正确。** 如果存在 WorldMapTab 级别的集成测试，P0-01 的死路径问题会被立即发现。 |

### P1-04: SiegeResultModal.test.tsx 未测试 R14 itemDrops 渲染

| 质疑点 | Challenger观点 | Builder补充 | Judge裁决 | 理由 |
|--------|---------------|-------------|-----------|------|
| 53个测试无一测试 itemDrops 新字段 | SiegeResultModal.test.tsx 中无 itemDrop 或 siege-item-drop 匹配 | Builder声称 "SiegeResultModal renders item drops (53/53 PASS)" | **CONFIRMED (P1)** | Judge grep 验证: `grep "itemDrop|siege-item-drop" SiegeResultModal.test.tsx` -> No matches found。(1) 渲染代码确实存在于 SiegeResultModal.tsx L517-552。(2) 但无测试用例传入 `result.itemDrops` 数据或验证 `data-testid="siege-item-drops-section"`。(3) 注意: 即使 itemDrops 的渲染代码被测试覆盖，由于 handleArrived 路径实际会调用 shouldDropInsiderLetter (L618) 并将结果通过 siegeResultData.itemDrops 传递到 UI，所以 **itemDrops 功能在 handleArrived 路径中实际是可用的** (与 injuryData 不同)。但缺乏测试意味着无法保证渲染的正确性。 |

**Judge 对 itemDrops 运行时可达性的补充说明:**

与 injuryData (硬编码为无效值) 不同，itemDrops 在 handleArrived 路径中有真实的运行时路径:
- L617-620: `shouldDropInsiderLetter(currentTask.id)` 被直接调用
- L633: `itemDrops: droppedItems.length > 0 ? droppedItems : undefined`
- L635: `setSiegeResultData(siegeResultData)` -- 包含 itemDrops
- SiegeResultModal L517: `isWin && result.itemDrops && result.itemDrops.length > 0` -- 渲染条件

因此 **SiegeItemSystem 的道具掉落功能在运行时是可达的**，只是绕过了 SettlementPipeline。这是一个架构问题(P1-02)，不是运行时失效。

---

## P2 Rulings

### P2-01: 掉落概率测试精度不一致

| 质疑点 | Challenger观点 | Builder补充 | Judge裁决 | 理由 |
|--------|---------------|-------------|-----------|------|
| siege-item-integration 用 100 次 + 8~35% 宽范围 | 两个测试文件使用不同精度: SiegeItemSystem.test.ts 用 500 次 + 82~118, siege-item-integration 用 100 次 + 8~35 | Builder声称 "assertion tightened" | **CONFIRMED (P2)** | 100 次 + [8, 35] 的范围对应 p=0.2, n=100 的二项分布，sigma=sqrt(100*0.2*0.8)=4, 范围 [8,35] = mu +/- (12~15)*sigma，极其宽松。对 "20%概率" 验证力不足。但这是测试质量问题，不影响功能正确性。 |

### P2-02: z-order 排序测试只验证确定性

| 质疑点 | Challenger观点 | Builder补充 | Judge裁决 | 理由 |
|--------|---------------|-------------|-----------|------|
| 测试只验证确定性不验证语义正确性 | 相同输入->相同输出 不能证明 "先创建在底层" 的语义 | Builder声称 "same-faction sprites sorted by startTime" | **CONFIRMED (P2)** | 代码 `sort((a, b) => a.startTime - b.startTime)` 的语义是 startTime 小的排在前面。如果渲染是按数组顺序绘制（后者覆盖前者），则 startTime 小的先绘制、后被覆盖，即"在底层"。测试只验证了确定性，未验证"先创建的在底层"这一渲染语义。低风险但值得补充。 |

### P2-03: PLAN.md 完成率可能不准确

| 质疑点 | Challenger观点 | Builder补充 | Judge裁决 | 理由 |
|--------|---------------|-------------|-----------|------|
| I7/I8/H5/H6 标记 done 但运行时不可达 | 如果 P0 成立，这些项实际上不成立 | Builder声称 "52/65 = 80%" | **CONFIRMED (P2)** | 基于已确认的 P0-01 和 P0-02: (1) I7 (内应信掉落) -- handleArrived 路径中有运行时可达的 itemDrops 功能，但绕过了 SettlementPipeline。部分成立，标记为 done 有一定道理。(2) I8 (道具获取) -- 同上。(3) H5 (伤亡详情) -- troopLoss 在运行时可达 (effectiveTroopsLost 可 > 0)，但 injuryData 不可达。部分成立。(4) H6 (受伤显示) -- 完全不可达 (heroInjured 硬编码 false)。完成率需要下调。 |

---

## Revised Feature Assessment

| R14 Feature | Builder结论 | Judge修正 | 理由 |
|-------------|------------|-----------|------|
| Task1: SiegeItemSystem 集成 | PASS | **PARTIAL** | handleArrived 路径中有直接调用 + itemDrops 传递到 UI，运行时可达。但绕过 SettlementPipeline，架构不正确。 |
| Task2: injuryData/troopLoss 属性 | PASS | **PARTIAL** | troopLoss 运行时可达; injuryData 运行时不可达 (heroInjured 硬编码 false)。 |
| Task3: SettlementPipeline 替换旧系统 | PASS | **FAIL** | SettlementPipeline 在死代码路径 (handleBattleCompleted) 中，旧系统 (siegeSystem.executeSiege) 仍在活跃路径中。 |
| Task4: P1/P2 Fixes | PASS | **PASS** | z-order 排序代码正确; 掉落概率测试通过(虽然精度偏松)。 |
| Task5: PLAN.md 更新 | PASS | **PARTIAL** | I7/I8 部分成立; H5 部分成立; H6 不成立。完成率需下调。 |

---

## Architecture Analysis

### 核心问题: 双路径架构

```
活跃路径 (handleArrived, L501-661):
  siegeSystem.executeSiege()          [旧攻城系统]
  heroInjured: false (硬编码)         [无受伤]
  shouldDropInsiderLetter() (直接调用) [绕过Pipeline]
  setSiegeResultData()                [显示弹窗] ✓

死路径 (handleBattleCompleted, L709-811):
  SettlementPipeline.execute()        [新结算系统]
  settlement.casualties.heroInjured   [正确值]
  SettlementPipeline.distribute()     [包含itemDrops]
  (无 setSiegeResultData 调用)         [不显示弹窗] ✗
  (battle:completed 永远不触发)        [永不执行] ✗
```

**根本原因:** R14 的集成工作集中在 handleBattleCompleted 路径，但该路径在当前架构下永不执行。handleArrived 在 setTimeout 中同步完成整个攻城流程，包括取消战斗 (cancelBattle)，导致 SiegeBattleSystem 的 tick loop 永远不会为此战斗触发 battle:completed。

---

## Summary

| 质疑点 | Challenger观点 | Builder补充 | Judge裁决 | 理由 |
|--------|---------------|-------------|-----------|------|
| P0-01 | handleBattleCompleted 不显示 UI | 所有子系统已接入 | **CONFIRMED** | handleBattleCompleted 无 setSiegeResultData 调用; 且该函数因 cancelBattle 提前移除战斗而永不执行 |
| P0-02 | heroInjured 硬编码 false | injuryData 属性已接入 | **CONFIRMED** | L571-572 硬编码; mapInjuryData 在 heroInjured=false 时返回 undefined; 运行时 injuryData 永远为 undefined |
| P1-01 | SettlementPipeline 是死代码 | 已替换旧系统 | **CONFIRMED** | executeSiege (旧系统) 在活跃路径; SettlementPipeline 在死路径 |
| P1-02 | shouldDropInsiderLetter 双路径 | 集成通过 | **CONFIRMED** | L618 直接调用 + Pipeline L416 内部调用; 当前无运行时 bug 但架构冗余 |
| P1-03 | 集成测试不覆盖 WorldMapTab | 182 tests PASS | **CONFIRMED** | 3个集成文件均不 import WorldMapTab 组件; 未验证事件处理链 |
| P1-04 | 53 个测试无一测试 itemDrops | 渲染代码存在 | **CONFIRMED** | grep 确认无 itemDrop 测试; 渲染代码存在但未验证; 注意 itemDrops 运行时可达 (通过 handleArrived) |
| P2-01 | 掉落概率测试精度不一致 | 已收紧 | **CONFIRMED** | 100次+8~35% 范围过于宽松 |
| P2-02 | z-order 只验证确定性 | sorted by startTime | **CONFIRMED** | 未验证"先创建在底层"渲染语义 |
| P2-03 | 完成率可能不准确 | 52/65=80% | **CONFIRMED** | H6 运行时不可达; H5 部分不可达; 完成率需下调 |

---

## Verdict

**REJECT** -- R14 核心集成目标 "将3个孤立子系统接入 WorldMapTab" 未真正完成。

R14 的工作成果可以概括为:
- **代码已写入但运行时不可达**: SettlementPipeline 集成 (Task3)
- **属性传递代码存在但输入被硬编码为无效值**: injuryData (Task2 部分)
- **绕过 Pipeline 直接调用,运行时可达但架构不正确**: itemDrops (Task1 部分)
- **正确完成**: troopLoss (Task2 部分), z-order fix (Task4)

### Required Fixes for R15

1. **合并两条路径**: 要么让 handleArrived 使用 SettlementPipeline 替代 siegeSystem.executeSiege，要么让 handleBattleCompleted 显示 UI。前者更合理 (因为 handleArrived 是实际活跃路径)。
2. **移除 heroInjured 硬编码**: 从引擎获取真实的 heroInjured 和 injuryLevel 值。
3. **补充 WorldMapTab 级别的集成测试**: mock eventBus 事件 → 验证 SiegeResultModal 显示内容。

---

*Judge Ruling | R14 | 2026-05-04 | REJECT | P0:2, P1:4, P2:3*
