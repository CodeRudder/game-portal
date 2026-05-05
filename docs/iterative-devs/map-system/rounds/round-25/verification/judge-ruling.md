# Judge Ruling — Round 25 Phase 4 (P9~P10) 裁决报告

> **裁决日期**: 2026-05-05
> **裁决角色**: Judge
> **裁决对象**: Builder Manifest + Challenger Attack Report — Phase 4 结算回城
> **裁决方法**: 逐条审查双方论据 + 源码交叉验证

---

## 一、逐项质疑裁决表

### P0 级质疑（4项）

| 质疑点 | Challenger观点 | Builder补充 | Judge裁决 | 理由 |
|--------|---------------|------------|-----------|------|
| P0-1: 胜利扣100%vs plan要求的10% | SiegeSystem胜利路径`deductSiegeResources(cost)`扣减全部兵力，与plan公式`victory ? *0.1 : *0.3`严重偏差，应为P0 | Builder承认偏差，标记为P1"部分完成"，提及SiegeResultCalculator有5档体系 | **质疑不成立，降为P1** | 关键发现：UI层(WorldMapTab.tsx:604-618)通过SettlementPipeline获取伤亡数据，`effectiveTroopsLost = casualties.troopsLost`来自SiegeResultCalculator而非SiegeSystem。回城行军创建时使用`troops - effectiveTroopsLost`(L647)。SiegeSystem的`deductSiegeResources`是引擎层资源扣减，SettlementPipeline是UI层结算展示，两者并行但功能不同。实际对玩家展示和回城兵力使用的是SettlementPipeline的正确数据。**但两套系统并存确实造成维护隐患， SiegeSystem的胜利路径扣100%与plan不一致，应修正为仅扣10%或完全依赖SettlementPipeline。** 定为P1。 |
| P0-2: march:arrived无监听→任务无法自动完成 | SiegeTaskManager无`eventBus.on()`监听march:arrived，注释(L9)声称监听但无实现，任务永远卡在returning | Builder声称"有效"，测试通过 | **质疑不成立** | 关键发现：WorldMapTab.tsx:763 `eventBus.on('march:arrived', handleArrived)` 在UI层订阅了此事件。L743-745处理回城到达：`siegeTaskManager.advanceStatus(associatedTask.id, 'completed')` + `removeCompletedTasks()`。事件监听在UI协调层而非引擎层实现，这是合理的架构选择（引擎层保持无状态、UI层协调业务流程）。任务不会卡住。 |
| P0-3: ConquestAnimationSystem未被生产代码调用 | grep显示ConquestAnimation仅在自身定义中出现，零导入 | Builder声称"完成" | **质疑不成立** | 关键发现：WorldMapTab.tsx:37 `import { ConquestAnimationSystem }` 和 L243 `new ConquestAnimationSystem()`。L726调用`conquestAnimSystem.create()`。Challenger的grep可能排除了`.tsx`文件或使用了不完整的搜索范围。动画系统已正确接入攻城胜利流程。 |
| P0-4: cancelSiege不可达时任务卡returning | cancelSiege无论createReturnMarch是否返回null都设returning，无else分支推进completed | Builder承认"部分降级" | **质疑部分成立，降为P1** | UI层主流程(WorldMapTab.tsx:652-658)已处理不可达降级：`if (returnMarch)` else分支直接`advanceStatus('completed')` + `removeCompletedTasks()`。但cancelSiege（中断/取消路径，SiegeTaskManager.ts:378-434）确实缺少不可达降级处理：当marchingSystem非null但createReturnMarch返回null时，任务卡在returning。cancelSiege路径需要补充else分支。 |

### P1 级质疑（6项）

| 质疑点 | Challenger观点 | Builder补充 | Judge裁决 | 理由 |
|--------|---------------|------------|-----------|------|
| P1-1: 结果弹窗无5秒自动关闭 | SiegeResultModal无setTimeout/autoClose，仅手动确认 | Builder承认"未发现显式实现"，标为完成 | **质疑成立，P2** | plan.md关键约束确实要求"5秒fallback"。缺少自动关闭是功能偏差，但弹窗有手动确认按钮，不影响核心流程。严重度低，定为P2。 |
| P1-2: removeMarch无3秒延迟 | removeMarch立即删除，无3秒延迟 | Builder注明"无延迟" | **质疑不成立** | WorldMapTab.tsx:753-756 实现了3秒延迟：`setTimeout(() => marchingSystem.removeMarch(marchId), 3000)`。延迟逻辑在UI协调层而非引擎层，这是合理的设计（引擎提供原子操作，UI控制时序）。 |
| P1-3: removeCompletedTasks从未被生产代码调用 | 仅在测试中调用，生产代码零调用 | Builder声称"有效" | **质疑不成立** | WorldMapTab.tsx:745, L657, L783 三处调用了`removeCompletedTasks()`。分别在：回城到达处理(L745)、攻城不可达降级(L657)、行军取消处理(L783)。Challenger的grep未覆盖UI组件文件。 |
| P1-4: 缺少siege:resourceError事件 | plan要求失败时emit siege:resourceError，实际deductSiegeResources静默catch | Builder标为完成 | **质疑成立，P2** | plan.md P9-2关键约束确实要求"失败时emit siege:resourceError"。`deductSiegeResources`的try/catch(L641-643)静默处理异常，无错误事件发射。这是plan与实现的偏差，但当前实现不会导致功能中断（异常仅影响日志/监控能力）。定为P2。 |
| P1-5: 两套伤亡系统冲突 | SiegeSystem扣100% vs SiegeResultCalculator报告10-20%，玩家看到不一致 | Builder承认两套并存 | **质疑成立，P1** | 确认存在两套系统并存：SiegeSystem.ts:595胜利路径扣减全部cost.troops，而SiegeResultCalculator使用5档精细伤亡率。UI层(WorldMapTab.tsx:618)使用SettlementPipeline的计算结果作为effectiveTroopsLost。实际对玩家展示的数据来自SiegeResultCalculator（正确的），但SiegeSystem仍扣减了100%兵力。这意味着引擎层的资源扣减与UI层展示不一致。需要统一为plan要求的公式或明确哪个为权威源。 |
| P1-6: cancelSiege不支持settling状态 | cancelSiege仅允许paused/sieging状态，settling无法取消 | Builder未明确提及 | **质疑成立，P1** | SiegeTaskManager.ts:389 `task.status !== 'paused' && task.status !== 'sieging'` 排除了settling状态。settling→returning在转换表中是合法的(L625)，但cancelSiege方法不处理此路径。正常流程中settling是短暂过渡状态（由battle:completed触发后立即推进到returning），但如果在settling阶段需要中断（如网络断线恢复），当前无法处理。 |

### P2 级质疑（3项）

| 质疑点 | Challenger观点 | Builder补充 | Judge裁决 | 理由 |
|--------|---------------|------------|-----------|------|
| P2-1: 链路测试非事件驱动，验证的是手动推进 | 测试手动调用advanceStatus，未验证事件自动流转 | Builder声称"有效" | **质疑成立，维持P2** | 测试确实仅验证了手动状态转换的合法性，未验证事件驱动的自动流转。但鉴于生产代码中UI层已正确实现事件监听和状态推进（WorldMapTab.tsx:763-745），此测试覆盖缺口不影响功能正确性，属于测试质量改进项。 |
| P2-2: cancelSiege null降级测试验证了错误行为 | 测试传null验证returning状态，但实际此路径有bug | Builder声称测试通过 | **质疑成立，维持P2** | 测试确实验证了cancelSiege在null marchingSystem时返回true并设为returning，但未验证后续能否到达completed。这与P0-4(降为P1)的问题一致，测试应扩展为验证完整降级链路。 |
| P2-3: 回城速度x0.8仅单元验证 | createMarch可能覆盖speed，需确认 | Builder声称"有效" | **质疑不成立** | WorldMapTab.tsx:644 `marchingSys.createReturnMarch(...)` 直接调用MarchingSystem的方法，该方法内部设置`march.speed = BASE_SPEED * 0.8`。march-siege.integration.test.ts也验证了此值。速度传递链路完整。 |

---

## 二、必须修复项清单

### P0（阻塞发布）
无

### P1（必须修复 — 影响游戏逻辑正确性或关键路径完整性）

| ID | 问题 | 影响范围 | 修复建议 |
|----|------|---------|---------|
| P1-1 | 两套伤亡计算系统并存，SiegeSystem胜利扣100%与plan要求10%不一致 | 游戏经济平衡、资源扣减正确性 | 统一伤亡计算：方案A — SiegeSystem胜利路径改为扣10%(对齐plan)；方案B — SiegeSystem胜利路径不扣兵力(由SettlementPipeline统一计算并反馈扣减量)。需明确权威源 |
| P1-2 | cancelSiege在marchingSystem非null但createReturnMarch返回null时，任务卡在returning无法完成 | 攻城中断→回城不可达的降级路径 | cancelSiege方法增加null检查：`if (marchingSystem) { const march = createReturnMarch(...); if (!march) { advanceStatus(taskId, 'completed'); } }` |
| P1-3 | cancelSiege不支持settling状态取消 | settling阶段的异常恢复 | 扩展cancelSiege状态守卫，增加settling→returning的转换支持 |

### P2（建议修复 — 不影响核心功能）

| ID | 问题 | 影响范围 | 修复建议 |
|----|------|---------|---------|
| P2-1 | SiegeResultModal缺少5秒自动关闭fallback | UX体验 | 添加`useEffect(() => { const t = setTimeout(onClose, 5000); return () => clearTimeout(t); }, [])` |
| P2-2 | deductSiegeResources缺少siege:resourceError事件 | 监控/日志能力 | 在catch块中添加`this.deps?.eventBus.emit('siege:resourceError', { ... })` |
| P2-3 | cancelSiege降级路径缺少集成测试 | 测试覆盖 | 添加cancelSiege + createReturnMarch返回null的端到端测试 |
| P2-4 | SiegeTaskManager.ts:9注释声称"监听march:arrived"但实际无实现 | 代码误导 | 更新注释为"UI层(WorldMapTab)负责监听march:arrived并调用advanceStatus" |

---

## 三、完成度统计

### 按功能点统计

| 检查项 | 计划状态 | 实际状态 | 备注 |
|--------|:-------:|:-------:|------|
| P9-1 战斗结果判定 | 完成 | 完成 | SiegeSystem.executeSiege()返回完整结果 |
| P9-2 资源扣算 | 完成 | 基本完成 | 缺siege:resourceError事件(P2-2) |
| P9-3 领土占领变更 | 完成 | 完成 | captureTerritory+事件完整 |
| P9-4 奖励发放 | 完成 | 完成 | SettlementPipeline.distribute()已通过UI层接入 |
| P9-5 伤亡计算 | 部分完成 | 偏差 | SiegeSystem胜利扣100% vs plan要求10%，UI层使用正确值(P1-1) |
| P9-6 结果弹窗 | 完成 | 基本完成 | 缺5秒自动关闭(P2-1) |
| P9-7 征服动画 | 完成 | 完成 | WorldMapTab.tsx已接入ConquestAnimationSystem |
| P10-1 回城行军创建 | 完成 | 完成 | createReturnMarch + 速度x0.8 |
| P10-2 回城路线不可达 | 完成 | 部分完成 | 主流程降级OK，cancelSiege路径降级缺失(P1-2) |
| P10-3 回城到达处理 | 完成 | 完成 | UI层march:arrived监听→advanceStatus('completed') |
| P10-4 任务完成清理 | 完成 | 完成 | UI层调用removeCompletedTasks |
| P10-5 精灵移除 | 完成 | 完成 | UI层3秒延迟removeMarch已实现 |

### 整体完成度

| 指标 | 值 |
|------|-----|
| 功能点总数 | 12 |
| 完全完成 | 8 (P9-1, P9-3, P9-4, P9-7, P10-1, P10-3, P10-4, P10-5) |
| 基本完成（含P2偏差） | 2 (P9-2, P9-6) |
| 存在P1偏差 | 2 (P9-5, P10-2) |
| 完成率 | 67% 完全完成 / 83% 基本完成 / 100% 核心功能可用 |
| 测试总数 | 685 |
| 测试通过率 | 100% |
| P0问题 | 0 |
| P1问题 | 3 |
| P2问题 | 4 |

---

## 四、关键架构决策建议

### 1. 事件监听架构已确认

Challenger的核心质疑——"事件发射了但无人监听，链路未集成"——被源码验证为**不成立**。实际架构是：

- **引擎层**（SiegeSystem, MarchingSystem, SiegeTaskManager）：发射事件、提供原子操作
- **UI协调层**（WorldMapTab.tsx）：订阅事件、编排业务流程、调用引擎方法

这是**合理的分层设计**。引擎层保持无副作用（不直接监听其他系统事件），UI层作为Mediator协调各子系统。Challenger的grep搜索范围不够全面（未覆盖`.tsx` UI组件文件），导致了错误的"断裂"结论。

### 2. 两套伤亡系统需统一（P1-1，最重要）

当前存在两套并行伤亡计算：
- `SiegeSystem.deductSiegeResources()`: 简单公式，胜利扣100% / 失败扣30%
- `SiegeResultCalculator → SettlementPipeline`: 5档精细伤亡率

建议：**SiegeSystem胜利路径的资源扣减应与SettlementPipeline的伤亡计算统一**。Plan明确要求`victory ? *0.1 : *0.3`，SiegeResultCalculator的大胜档10-20%已接近此目标。修复方案：
- SiegeSystem胜利路径改为扣减SettlementPipeline计算后的实际伤亡量
- 或SiegeSystem胜利路径直接扣10%（对齐plan公式）

### 3. SiegeTaskManager.cancelSiege降级路径需补充（P1-2）

主流程（WorldMapTab.tsx L644-658）已正确处理回城不可达降级。但cancelSiege（用户主动取消/中断路径）缺少对等处理。建议在SiegeTaskManager.cancelSiege中增加`createReturnMarch`返回null的else分支。

### 4. 引擎层注释应与实际架构一致（P2-4）

SiegeTaskManager.ts:9声称"监听 march:arrived 事件推进状态"但实际无实现，容易误导后续开发者。应更新注释反映UI层协调的架构。

---

*Judge Ruling | Round 25 | Phase 4 (P9~P10) | 2026-05-05*
