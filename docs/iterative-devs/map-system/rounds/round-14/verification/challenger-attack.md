# R14 Challenger Attack Report

> **Date**: 2026-05-04
> **Role**: Challenger
> **Target**: R14 Builder Manifest (Integration Phase)

---

## Executive Summary

Builder claims "PASS -- All R14 feature points implemented and tested" with 317 tests passing. After deep source code inspection, test analysis, and execution path tracing, I find **2 P0 fatal flaws** that invalidate the core integration claim, **4 P1 significant gaps**, and **3 P2 minor issues**. The fundamental problem is that the R14 integration was wired into a **dead code path** (`handleBattleCompleted`) while the **live execution path** (`handleArrived`) still uses the old system.

---

## P0: Fatal Flaws (Must Fix)

### P0-01: `handleBattleCompleted` (SettlementPipeline path) NEVER shows SiegeResultModal

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 |
|--------|-------------|-------------|-------------|
| SiegeResultModal显示集成 | Builder claims "All subsystems wired to WorldMapTab" | `handleBattleCompleted`(L709-811) 调用 `settlementPipeline.execute()` 完成结算，但**从未调用 `setSiegeResultData()` 或 `setSiegeResultVisible()`**。R14 新集成的 SettlementPipeline + SiegeItemSystem + injuryData 这条完整路径执行完后，用户看不到任何UI反馈 | 缺少从 `handleBattleCompleted` 到 `SiegeResultModal` 显示的代码路径。Builder应证明 `battle:completed` 事件触发后，SiegeResultModal 会显示给用户 |

**Evidence:**
- `handleBattleCompleted` (L709-811): 结算→设result→推状态→创建回城行军→`setActiveSiegeTasks`。**无 `setSiegeResultData()` 调用**。
- `handleArrived` (L501-661): 在 L635-636 调用 `setSiegeResultData(siegeResultData)` + `setSiegeResultVisible(true)` —— 这是**唯一显示弹窗的路径**。
- 但 `handleArrived` 使用的是旧的 `siegeSystem.executeSiege()` 路径（L553），不是 SettlementPipeline。

**结论**: R14的核心集成目标 —— "将3个孤立子系统接入WorldMapTab" —— 在 `handleBattleCompleted` 中完成了接入，但这条路径不会触发UI显示。SettlementPipeline执行的结果（包括 itemDrops、正确的 casualties）被计算后丢弃，用户永远看不到。

---

### P0-02: `handleArrived` (实际执行路径) 硬编码 `heroInjured: false`, injuryData永远为undefined

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 |
|--------|-------------|-------------|-------------|
| injuryData/troopLoss 属性接入 | "WorldMapTab passes injuryData to SiegeResultModal" (L1651-1658) | 属性传递代码确实存在(L1651-1663)，但**上游数据源** `handleArrived` 在 L571-572 硬编码 `heroInjured: false` + `injuryLevel: 'none'`。`mapInjuryData()` 在 heroInjured=false 时直接返回 undefined。injuryData props 永远是 undefined，R13/R14的受伤显示功能在实际运行中永远不会触发 | 缺少从引擎产生非-none injuryLevel → 经过 WorldMapTab → 到达 SiegeResultModal 的完整运行时路径验证 |

**Evidence:**
```typescript
// WorldMapTab.tsx L568-574 — handleArrived 路径
const casualties: CasualtyResult = {
  troopsLost: effectiveTroopsLost,
  troopsLostPercent: deployTroops > 0 ? effectiveTroopsLost / deployTroops : 0,
  heroInjured: false,          // <-- 永远是 false
  injuryLevel: 'none' as const, // <-- 永远是 none
  battleResult: (result.victory ? 'victory' : 'defeat') as 'victory' | 'defeat' | 'rout',
};
```

而 `mapInjuryData()` 在 L102:
```typescript
if (!casualties || !casualties.heroInjured || casualties.injuryLevel === 'none') {
  return undefined;
}
```

**结论**: R14 Task2 "injuryData/troopLoss属性接入" 声称 PASS，但运行时 injuryData 永远为 undefined。21个 injury-integration 测试只测了函数和独立组件，从未验证 WorldMapTab 的实际执行路径会产生非 undefined 的 injuryData。

---

## P1: Significant Gaps

### P1-01: 双路径架构导致 SettlementPipeline 成为死代码

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 |
|--------|-------------|-------------|-------------|
| SettlementPipeline替换旧SiegeResultCalculator | "Old SiegeResultCalculator calls replaced" (Task 3.1) | WorldMapTab 确实不再 import SiegeResultCalculator，但**旧调用路径仍存在于 `handleArrived`**: `siegeSystem.executeSiege()` (L553)。这不是 SiegeResultCalculator 本身，但它是旧的攻城结算系统。SettlementPipeline 只在 `handleBattleCompleted` 中使用，而该路径因 P0-01 的原因不显示UI。SettlementPipeline 的 result（含 itemDrops、rewards、correct casualties）被计算后丢失 | 缺少证据证明 SettlementPipeline 的结算结果被实际传递到 SiegeResultModal |

**时序分析:**
1. `handleArrived` 在 `setTimeout` 内执行 (L524)
2. L540: `battleSystem.createBattle()` —— 创建 battle session
3. L553: `siegeSystem.executeSiege()` —— 旧系统结算
4. L577: `siegeTaskManager.setResult()` —— 设置 result（guard 条件）
5. L590: `battleSystem.cancelBattle()` —— 删除 battle session

由于步骤 2-5 在同一个同步 setTimeout 中执行，`battle:completed` 不会在步骤 4 之前触发。因此 `handleBattleCompleted` 的 guard `if (task.result) return;` (L717) 总是会触发，导致该路径完全不执行。

---

### P1-02: shouldDropInsiderLetter 在 handleArrived 中被调用但绕过 SettlementPipeline

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 |
|--------|-------------|-------------|-------------|
| SiegeItemSystem集成 | "shouldDropInsiderLetter called on victory" | 确实被调用了(L618)，但是**直接在 WorldMapTab.tsx 中调用**，而非通过 SettlementPipeline.distribute()。这导致两套独立的调用路径：(1) handleArrived 直接调用 (L618) (2) SettlementPipeline.distribute() 内部调用 (L416)。两条路径使用相同的 shouldDropInsiderLetter 函数但互不通信 | 缺少证据证明两条路径不会产生双重掉落或逻辑冲突 |

**代码位置对比:**
- WorldMapTab.tsx L617-620: 直接调用 `shouldDropInsiderLetter(currentTask.id)` 构建 `droppedItems`
- SettlementPipeline.ts L416: `shouldDropInsiderLetter(ctx.taskId)` 在 distribute phase 内

如果将来 P0-01 被修复（handleBattleCompleted 也显示弹窗），可能导致 itemDrops 被计算两次（WorldMapTab 中一次 + SettlementPipeline 中一次）。

---

### P1-03: 所有集成测试只测孤立子系统，未验证 WorldMapTab 内的真实集成

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 |
|--------|-------------|-------------|-------------|
| 集成测试覆盖 | "182 passed, 0 failed" | 3个集成测试文件 (siege-item-integration, injury-integration, settlement-pipeline-integration) **没有 import WorldMapTab**。它们只测试: (1) SiegeItemSystem + SettlementPipeline 类 (2) mapInjuryData/mapTroopLoss 纯函数 + 独立渲染 SiegeResultModal (3) SettlementPipeline vs SiegeResultCalculator 类。**没有任何测试验证 WorldMapTab 的事件处理函数将结果传递到 SiegeResultModal** | 缺少: (1) mock eventBus 发出 `march:arrived` → 验证 SiegeResultModal 显示的端到端测试 (2) mock eventBus 发出 `battle:completed` → 验证 SettlementPipeline 被调用 → 验证结果传递到UI的测试 |

**搜索证据:**
```
# siege-item-integration.test.ts 不包含 WorldMapTab:
$ grep -c "WorldMapTab" siege-item-integration.test.ts → 0

# injury-integration.test.ts 只 import 纯函数:
$ grep "WorldMapTab" injury-integration.test.ts → "from '../WorldMapTab'" (仅import纯函数)

# settlement-pipeline-integration.test.ts 不包含 WorldMapTab:
$ grep -c "WorldMapTab" settlement-pipeline-integration.test.ts → 0
```

---

### P1-04: SiegeResultModal.test.tsx 不测试 R14 itemDrops 渲染

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 |
|--------|-------------|-------------|-------------|
| SiegeResultModal渲染itemDrops | "SiegeResultModal renders item drops (53/53 PASS)" | SiegeResultModal.test.tsx 的 53 个测试**全部测试 siegeReward.items (旧字段)**，没有任何测试用例传入 `result.itemDrops`（R14新字段）或验证 `data-testid="siege-item-drops-section"` | 缺少: (1) 传入 `result.itemDrops` → 验证 siege-item-drops-section 出现的测试 (2) 不传入 itemDrops → 验证 siege-item-drops-section 不出现的测试 |

**搜索证据:**
```
$ grep -c "itemDrop\|siege-item-drop" SiegeResultModal.test.tsx → 0
```

Builder声称 "SiegeResultModal renders item drops (L517-552)" —— 代码确实存在，但**从未被测试验证**。渲染代码存在不等于功能正确。

---

## P2: Minor Issues

### P2-01: 掉落概率测试使用较宽的置信区间

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 |
|--------|-------------|-------------|-------------|
| 断言精度收紧 | "Drop probability assertion tightened (500 times, 82~118)" | 82~118 的范围确实对应 ±2σ，但 siege-item-integration.test.ts 中使用的是 100 次模拟，允许范围 8~35 (即 8%~35%)，这是一个极宽的范围，无法精确验证 20% 概率。Builder声称 Task4.2 "assertion tightened" 但两个测试文件使用了不同精度 | siege-item-integration.test.ts 应与 SiegeItemSystem.test.ts 使用一致的 500 次模拟 + ±2σ 范围 |

---

### P2-02: z-order 排序测试只验证确定性，不验证语义正确性

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 |
|--------|-------------|-------------|-------------|
| z-order: same-faction sprites sorted by creation time | "same-faction sprites sorted by startTime" | 测试只验证了"相同输入→相同输出"(确定性)，但**没有验证"先创建的在底层(先渲染)"这个语义**。rect调用的坐标对所有重叠精灵是相同的(x=15,y=10)，无法从调用顺序判断谁在底层 | 缺少: 验证先创建精灵的rect在fill调用序列中排在后面(后绘制=在上层)的断言。当前测试只比较了两次渲染结果相等 |

---

### P2-03: PLAN.md 完成率统计可能不准确

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 |
|--------|-------------|-------------|-------------|
| 完成率80% | "52/65 = 80%" | 如果 P0-01/P0-02 成立，则 R14 的 I7(内应信掉落)、I8(道具获取)、H5(伤亡详情)、H6(受伤显示) 的 "已接入UI" 状态实际上不成立——代码存在但运行时不可达。PLAN.md 中这些项标记为 done 但实际上是半成品 | 缺少运行时验证截图或E2E测试证明这些功能在真实用户操作中可见 |

---

## Test Execution Verification

实际运行了Builder引用的4个测试文件:

| 测试文件 | Builder声称 | 实际结果 | 验证 |
|---------|-----------|---------|-----|
| siege-item-integration.test.ts | 21/21 PASS | 21/21 PASS | 测试确实通过，但只测孤立类 |
| injury-integration.test.tsx | 21/21 PASS | 21/21 PASS | 测试确实通过，但只测纯函数+独立组件 |
| settlement-pipeline-integration.test.ts | 18/18 PASS | 18/18 PASS | 测试确实通过，但只测Pipeline类 |
| PixelWorldMap.batch-render.test.tsx | 22/22 PASS | 22/22 PASS | 测试确实通过，z-order排序代码存在 |

---

## Integration Chain Analysis

### Builder声称的集成链:
```
SiegeItemSystem.shouldDropInsiderLetter()
  → SettlementPipeline.distribute() calls it (L416)
  → WorldMapTab calls SettlementPipeline (L706-707, L748)
  → WorldMapTab creates itemDrops for SiegeResultData (L617-633)
  → SiegeResultModal renders itemDrops (L517-552)
```

### 实际运行时集成链:
```
用户发起攻城 → march:arrived → handleArrived (setTimeout)
  → siegeSystem.executeSiege() [旧系统]
  → casualties = { heroInjured: false, injuryLevel: 'none' } [硬编码]
  → shouldDropInsiderLetter(currentTask.id) [直接调用，绕过Pipeline]
  → setSiegeResultData(siegeResultData) [显示弹窗]
  → siegeResultData.itemDrops = droppedItems [有itemDrops但injuryData=undefined]

battle:completed → handleBattleCompleted
  → if (task.result) return; [总是命中guard，因为handleArrived已设result]
  → SettlementPipeline.execute() [永远不会执行]
  → setSiegeResultData() [永远不会被调用]
```

**结论**: Builder声称的集成链在代码层面存在但**运行时不可达**。唯一可达的UI显示路径(`handleArrived`)绕过了SettlementPipeline，硬编码了`heroInjured: false`。

---

## Summary Table

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 | 严重性 |
|--------|-------------|-------------|-------------|--------|
| P0-01 | 所有子系统接入WorldMapTab | `handleBattleCompleted`不显示SiegeResultModal，新集成路径运行时不可达 | 缺少 `handleBattleCompleted` → `setSiegeResultData()` 的代码路径 | **P0** |
| P0-02 | injuryData属性接入 | `handleArrived`硬编码 `heroInjured:false`, injuryData永远是undefined | 缺少引擎产生非-none injuryLevel → UI显示的运行时验证 | **P0** |
| P1-01 | SettlementPipeline替换旧计算器 | 旧路径 `siegeSystem.executeSiege()` 仍在handleArrived中使用 | 缺少证明 SettlementPipeline result 被传递到UI的证据 | **P1** |
| P1-02 | shouldDropInsiderLetter集成 | 双路径调用(WorldMapTab直接+Pipeline内部)，逻辑重复 | 缺少证明两条路径不产生双重掉落的证据 | **P1** |
| P1-03 | 集成测试覆盖 | 3个集成测试文件不import WorldMapTab，未验证事件处理 | 缺少 WorldMapTab 级别的端到端集成测试 | **P1** |
| P1-04 | SiegeResultModal渲染itemDrops | 53个测试无一测试R14新字段itemDrops | 缺少 `result.itemDrops` → `siege-item-drops-section` 的测试 | **P1** |
| P2-01 | 断言精度收紧 | siege-item-integration用100次+8~35%宽范围，不一致 | 缺少一致的精度标准 | **P2** |
| P2-02 | z-order语义正确 | 只验证确定性，不验证"先创建在底层"语义 | 缺少渲染顺序语义断言 | **P2** |
| P2-03 | 完成率80% | I7/I8/H5/H6标记done但运行时不可达 | 缺少运行时截图或E2E证明 | **P2** |

---

## Verdict

**REJECT** -- R14 核心集成声称 "PASS" 不可信。

2个P0致命缺陷导致R14的核心目标(将3个孤立子系统接入WorldMapTab)未真正完成:
1. 新集成路径(`handleBattleCompleted`)不显示UI
2. 旧执行路径(`handleArrived`)硬编码无伤害数据

9个有效质疑 (P0: 2, P1: 4, P2: 3)

---

*Challenger Attack Report | R14 | 2026-05-04 | REJECT*
