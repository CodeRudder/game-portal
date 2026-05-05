# R13 Challenger Attack Report

> 生成时间: 2026-05-04 | Challenger: Claude Agent | 深度源代码审计

## 总览

| 指标 | 数值 |
|------|------|
| 有效质疑总数 | 12 |
| P0 (致命: 功能不可用/数据错误) | 4 |
| P1 (严重: 集成断裂/测试虚假) | 5 |
| P2 (中等: 边界未覆盖/设计缺陷) | 3 |

---

## P0 致命质疑

### P0-1: injuryData/troopLoss props 是死代码 — 无任何调用方传递

| 维度 | 内容 |
|------|------|
| **质疑点** | Task 4 H5/H6 injuryData + troopLoss props |
| **Builder结论** | "53测试全部通过，伤亡UI完整实现" |
| **为什么不可信** | 在 `WorldMapTab.tsx:1537-1544` 中，`SiegeResultModal` 的唯一真实调用方**没有传递 `injuryData` 和 `troopLoss` props**。搜索整个代码库，`injuryData` 和 `troopLoss` 仅出现在: (1) SiegeResultModal.tsx 的接口定义和组件代码, (2) SiegeResultModal.test.tsx 的测试代码。**零个生产代码调用方**传递这些 props。Builder声称的"H5部队损失UI"和"H6将领受伤UI"在实际运行中永远不会显示。 |
| **缺少什么证据** | 缺少: (1) WorldMapTab.tsx 或任何父组件传递 injuryData/troopLoss 的代码; (2) SettlementPipeline 或 ExpeditionSystem 的输出映射到 injuryData/troopLoss 的胶水代码; (3) 端到端验证: 从战斗结算到 UI 显示 injuryData 的完整链路。 |
| **源代码证据** | `WorldMapTab.tsx:1537-1544`: `<SiegeResultModal visible={...} result={...} onClose={...} />` — 无 injuryData，无 troopLoss |

### P0-2: InjuryLevel 枚举值不匹配 — injuryData 使用错误值域

| 维度 | 内容 |
|------|------|
| **质疑点** | Task 4 H6 injuryLevel 的枚举值 |
| **Builder结论** | "轻伤黄色(#FFC107)/中伤橙色(#FF9800)/重伤红色(#F44336)" |
| **为什么不可信** | 现有 `InjuryLevel` 类型 (`expedition-types.ts:28`) 定义为 `'none' \| 'minor' \| 'moderate' \| 'severe'`。但 `SiegeResultModal.tsx:215-220` 的 `INJURY_TAG_CONFIG` 使用了 `'light' \| 'medium' \| 'severe' \| 'none'`。这是**两套完全不同的枚举值**。`injuryData` prop 的类型定义 (`SiegeResultModal.tsx:101`) 写的是 `'light' \| 'medium' \| 'severe' \| 'none'`，与系统实际的 `InjuryLevel` 类型不兼容。即使将来有调用方传递 injuryData，需要手动将 `minor`→`light`、`moderate`→`medium` 做翻译，但没有任何翻译层存在。 |
| **缺少什么证据** | 缺少: (1) injuryLevel 值域映射层 (minor→light, moderate→medium); (2) 使用系统 InjuryLevel 类型的集成测试; (3) 类型兼容性验证 |

### P0-3: SettlementPipeline.executedPhases 记录了未实际执行的阶段

| 维度 | 内容 |
|------|------|
| **质疑点** | Task 5 executedPhases 日志准确性 |
| **Builder结论** | "Path B defeat跳过distribute, Path C cancel跳过calculate+distribute" |
| **为什么不可信** | 查看 `SettlementPipeline.ts:262-276`，`executedPhases.push('calculate')` 和 `executedPhases.push('distribute')` **是无条件执行的**，不管该阶段是否真正运行了逻辑。`PATH_PHASE_CONFIG` 控制"是否执行阶段逻辑"，但 push 是在 if 块**之外**。这意味着: (1) Cancel 路径声称 executedPhases 包含 `['validate','calculate','distribute','notify']`，但 calculate 和 distribute 实际被跳过;(2) 测试断言 `result.executedPhases` 包含全部4个阶段来验证"阶段跳过"，但这个断言本身就证明了**阶段没有被跳过记录**。executedPhases 的语义应该是"实际执行过的阶段"，但代码将其记录为"经过的阶段位置"。 |
| **缺少什么证据** | 缺少: (1) executedPhases 精确反映实际执行情况的测试（如: cancel 应该只有 `['validate','notify']`）; (2) 基于 executedPhases 做条件判断的下游消费者代码 |
| **源代码证据** | `SettlementPipeline.ts:266`: `result.executedPhases.push('calculate');` — 无论 `config.calculate` 是否为 true，都会执行 |

### P0-4: SettlementPipeline 是孤岛模块 — 零集成、零调用方

| 维度 | 内容 |
|------|------|
| **质疑点** | Task 5 SettlementPipeline 与现有系统的集成 |
| **Builder结论** | "双路径结算架构统一, 12个架构验证测试通过" |
| **为什么不可信** | 全代码库搜索 `import.*SettlementPipeline` 返回**零结果**（除自身测试文件）。SettlementPipeline: (1) 没有被 WorldMapTab.tsx 使用; (2) 没有被任何集成测试导入; (3) 没有替代现有的 SiegeResultCalculator 直接调用链; (4) 其 `distribute()` 方法使用硬编码的 baseGrain=100/baseGold=50，而不是复用现有的 SiegeRewardProgressive 或任何奖励系统; (5) 其类型系统 (`SettlementCasualties`, `SettlementRewards`) 与现有类型 (`CasualtyResult`, `SiegeReward`) 完全独立。这不是"架构统一"，而是创建了一个**并行但未连接的新系统**。 |
| **缺少什么证据** | 缺少: (1) SettlementPipeline 替换现有结算逻辑的集成点; (2) 与 SiegeRewardProgressive 的奖励计算集成; (3) 与 WorldMapTab 的 UI 更新集成; (4) 与 OfflineEventSystem/EventBus 真实事件名的对齐验证 |

---

## P1 严重质疑

### P1-1: SiegeItemSystem 是完全孤立的 — 零集成、零调用方

| 维度 | 内容 |
|------|------|
| **质疑点** | Task 3 SiegeItemSystem 与 WorldMapTab/SiegeResultModal 的集成 |
| **Builder结论** | "内应信掉落(I7)+攻城策略道具(I8), 17测试通过" |
| **为什么不可信** | 全代码库搜索 `import.*SiegeItemSystem` 和 `import.*shouldDropInsiderLetter` 返回**零结果**（除自身测试文件）。`SiegeItemSystem` 没有被任何其他模块导入或使用。攻城奖励的掉落逻辑没有被集成到 SiegeRewardProgressive、WorldMapTab、SiegeResultModal 或任何战斗结算流程中。Builder声称实现了"I7内应信掉落"和"I8道具获取"，但这些功能在系统中是不可触达的。 |
| **缺少什么证据** | 缺少: (1) 攻城结算时调用 shouldDropInsiderLetter 的代码; (2) SiegeItemSystem 实例被创建和持有的代码; (3) 道具UI显示(背包/道具栏)的组件; (4) 道具消费影响战斗结果的效果代码 |

### P1-2: SettlementArchitecture 测试使用 mock EventBus — 未验证真实事件集成

| 维度 | 内容 |
|------|------|
| **质疑点** | Task 5 SettlementArchitecture.test.ts 的事件测试 |
| **Builder结论** | "settlement:complete/cancelled事件通过EventBus验证" |
| **为什么不可信** | `SettlementArchitecture.test.ts:26-31` 使用 `createMockEventBus()` 创建了 `emit: vi.fn()` 的 mock。测试只验证了 `eventBus.emit` 被调用了正确的参数，但: (1) 使用 mock EventBus 意味着不会验证事件名与真实系统消费者是否一致; (2) 真实系统使用 `EventBus` 类 (`core/events/EventBus`)，但 SettlementPipeline 定义了独立的 `SettlementPipelineDeps` 接口，且没有人验证这两个接口的事件名/数据格式是否兼容; (3) 真实系统中搜索 `settlement:complete`、`settlement:cancelled`、`settlement:return`、`settlement:reward` 事件名——**零个消费者**监听这些事件。 |
| **缺少什么证据** | 缺少: (1) 使用真实 EventBus 实例的集成测试; (2) 验证事件名与现有系统消费者匹配的代码; (3) 任何组件监听 settlement:complete 等事件的代码 |

### P1-3: batch-render 测试的视觉回归验证不充分 — 渲染顺序改变未被检测

| 维度 | 内容 |
|------|------|
| **质疑点** | Task 2 batch rendering 渲染顺序变化 |
| **Builder结论** | "视觉回归(同阵营颜色正确/不同阵营不混淆), 18测试通过" |
| **为什么不可信** | 优化前: 每个march依次渲染路线→精灵, 按march顺序有自然z-order。优化后: Phase 1先绘制**所有march的路线**，Phase 2再绘制**所有march的精灵**。这意味着: (1) 路线渲染和精灵渲染被分离到不同阶段; (2) `flushBatchedRects` 按颜色key (Map的插入顺序)分组，不同阵营的精灵渲染顺序与原来不同; (3) 当两个不同阵营的march精灵重叠时，后渲染的会覆盖先渲染的，但新代码的覆盖关系可能不同。测试只检查"正确的颜色出现了"，**没有检查精灵之间的z-order/遮挡关系**是否保持不变。 |
| **缺少什么证据** | 缺少: (1) 精灵重叠场景下的z-order验证; (2) 路线→精灵渲染阶段分离后的视觉截图回归对比; (3) 不同阵营精灵渲染顺序的断言 |

### P1-4: SiegeReward.drop.test "20%掉落"测试名与实际断言不匹配

| 维度 | 内容 |
|------|------|
| **质疑点** | Task 3 shouldDropInsiderLetter 20%掉落率验证 |
| **Builder结论** | "100个任务掉落数约20个(15~25范围)" |
| **为什么不可信** | 测试描述说"15~25范围"，但实际断言是 `toBeGreaterThanOrEqual(5)` 和 `toBeLessThanOrEqual(35)`（即5~35范围，是声称范围的3倍宽度）。这意味着: (1) 测试描述和断言不一致，降低了可信度; (2) 5~35的范围(占100的5%~35%)极其宽松，即使hash分布严重不均也能通过，无法真正验证"约20%"。此外，djb2 hash不是均匀分布的hash函数（它对某些前缀/后缀模式有偏向），`hash % 100 < 20` 的实际分布可能偏离20%很远，但测试因为太宽松而无法发现。 |
| **缺少什么证据** | 缺少: (1) 与声称范围(15~25)一致的断言; (2) 使用统计方法验证分布均匀性的测试; (3) djb2 hash % 100 的实际分布分析 |

### P1-5: SettlementPipeline.import 在文件末尾 — 模块结构缺陷

| 维度 | 内容 |
|------|------|
| **质疑点** | Task 5 SettlementPipeline.ts 代码质量 |
| **Builder结论** | "NEW (16713 bytes) — SettlementPipeline(216), createVictoryContext(464)" |
| **为什么不可信** | `SettlementPipeline.ts:557` 将 `import { OUTCOME_REWARD_MULTIPLIER } from './SiegeResultCalculator'` 放在**文件最末尾**。虽然 ES modules 的 import 会被 hoist 到模块顶部（TypeScript/bundler 会处理），这本身不导致运行时错误，但: (1) 违反了所有主流风格指南（import 应在文件顶部）; (2) 暗示代码是分块拼接而非整体设计的; (3) 在 `distribute()` 方法体中使用了 `OUTCOME_REWARD_MULTIPLIER`（380行），但 import 在557行，阅读代码时难以追踪依赖来源; (4) 如果有人去掉 module 系统的 hoisting（如改为 require），代码会直接崩溃。 |
| **缺少什么证据** | 缺少: (1) import语句移到文件顶部的重构; (2) lint规则禁止文件末尾import |

---

## P2 中等质疑

### P2-1: offline-e2e 测试声称使用真实EventBus但实际依赖可能被mock

| 维度 | 内容 |
|------|------|
| **质疑点** | Task 1 offline-e2e.integration.test.ts |
| **Builder结论** | "28测试通过, 使用真实EventBus串联各系统" |
| **为什么不可信** | 文件头注释声称"使用真实 EventBus (非 mock)"，并且确实 `import { EventBus } from '../../../../core/events/EventBus'`。但: (1) `OfflineRewardSystem` 和 `OfflineEventSystem` 是否在内部也使用了同一个 EventBus 实例? 需要验证它们是否接受外部传入的 EventBus; (2) 测试创建的 EventBus 实例是否真正被所有子系统共享? 如果各子系统内部 new 了自己的 EventBus，那么"真实事件触发"只是测试代码的单方面验证。这是间接质疑——无法确认但不验证会遗漏集成断裂。 |
| **缺少什么证据** | 缺少: (1) 验证 OfflineRewardSystem/OfflineEventSystem 使用测试传入的同一 EventBus 实例的代码审计; (2) 事件从 producer 到 consumer 的完整链路断言 |

### P2-2: SettlementPipeline.distribute 使用硬编码奖励值 — 与现有奖励系统脱节

| 维度 | 内容 |
|------|------|
| **质疑点** | Task 5 奖励计算逻辑 |
| **Builder结论** | "Victory首次攻占1.5x奖励" |
| **为什么不可信** | `SettlementPipeline.distribute()` 使用 `baseGrain=100, baseGold=50` 硬编码值计算奖励 (`SettlementPipeline.ts:389-390`)。现有系统 (SiegeRewardProgressive) 可能使用完全不同的基础值和计算方式。这意味着 SettlementPipeline 的奖励计算结果与现有系统的奖励计算结果不同。虽然目前 SettlementPipeline 未被集成（P0-4），但一旦尝试集成，奖励数值将不一致。 |
| **缺少什么证据** | 缺少: (1) 与 SiegeRewardProgressive 输出的数值对比测试; (2) 奖励计算参数的配置化而非硬编码; (3) 与现有奖励系统的接口对接方案 |

### P2-3: PixelWorldMap batch-render renderSingleMarch 向后兼容实际上是退化

| 维度 | 内容 |
|------|------|
| **质疑点** | Task 2 renderSingleMarch 向后兼容声明 |
| **Builder结论** | "renderSingleMarch向后兼容, 56测试全部通过" |
| **为什么不可信** | `renderSingleMarch` (PixelWorldMap.tsx:437-448) 现在内部调用 `collectMarchRects` + `flushBatchedRects` + `renderMarchEffects`。但对于单次调用（如旧代码路径），这实际上将一次精灵的渲染变成了: 收集1个精灵的rects → 创建Map分组 → 遍历分组绘制。对于单个精灵这比直接 fillRect 更慢（多了 Map 创建和遍历开销）。更重要的是，如果此函数在其他地方被调用（如独立渲染），批量优化的意义不存在但性能反而下降。不过实际上在当前代码中，主渲染循环已经改用批量模式 (1424-1442行)，renderSingleMarch 可能已无调用方。 |
| **缺少什么证据** | 缺少: (1) renderSingleMarch 当前是否仍被调用方使用的确认; (2) 单精灵渲染路径的性能对比基准 |

---

## 汇总评估

| Task | Builder声称 | Challenger判定 | 关键问题 |
|------|-----------|---------------|---------|
| Task 1 | E2E离线28测试通过 | **部分可信** | EventBus真实性需进一步验证，但整体框架合理 |
| Task 2 | batch render优化18测试通过 | **基本可信，有风险** | 渲染顺序变化未被测试覆盖 (P1-3) |
| Task 3 | 道具系统17测试通过 | **不可信** | 零集成、零调用方 (P1-1)，死代码 |
| Task 4 | 伤亡UI 53测试通过 | **不可信** | 零调用方传递props (P0-1)，枚举值不匹配 (P0-2) |
| Task 5 | 结算架构12测试通过 | **不可信** | 零集成 (P0-4)，executedPhases语义错误 (P0-3)，硬编码奖励 (P2-2) |
| Task 6 | P3修复测试通过 | **基本可信** | 小型修复，风险较低 |

## 核心结论

**R13的6个Task中，Task 3/4/5存在严重的"测试通过但功能不可达"问题。** Builder构建了3个完整的子系统（SiegeItemSystem、injuryData/troopLoss UI、SettlementPipeline），每个都有完整的测试套件且测试通过，但这些子系统是**完全孤立的**:

1. **SiegeItemSystem** (Task 3): 零导入、零实例化、零使用
2. **injuryData/troopLoss** (Task 4): 零传递、枚举不兼容
3. **SettlementPipeline** (Task 5): 零导入、零替代现有逻辑、硬编码奖励

这些不是"集成待完善"，而是**功能性死代码**——在当前系统中不可能被触达。257个测试中的46个(Task 3: 17 + Task 5: 12 + Task 4新增部分: ~17)测试的是永远不会被执行的代码路径。
