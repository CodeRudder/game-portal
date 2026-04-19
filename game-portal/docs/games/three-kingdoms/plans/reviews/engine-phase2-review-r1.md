# 三国霸业 — 引擎改进阶段二（Phase 2）专业评测报告

> **评测对象**: 4层架构调整方案 + 测试子系统设计 + 引擎改进计划  
> **评测日期**: 2025-07-11  
> **评测版本**: R1（首轮评审）  
> **评测师**: Game Reviewer Agent  
> **评测范围**: 3份核心文档 + 3份交叉引用文档

---

## 基本信息

| 项目 | 内容 |
|------|------|
| **评测文档** | `refactor.md` · `test-system-design.md` · `engine-improvement.md` |
| **交叉引用** | `version-roadmap.md` · `analysis.md` · `feature-inventory.md` |
| **源码基线** | 39个TS源文件 / 22,565行 / 27个测试文件 / 8,069行测试代码 |
| **评测目标** | 验证阶段二引擎改进方案的架构合理性、可测试性、可执行性、代码质量保障、文档一致性 |

---

## 综合评分：9.2 / 10（A+ 级）

> **通过条件判定**: 总分 ≥ 9.0 ✅ 通过 | 无P0问题 ✅ 通过

---

## 各维度评分

| 维度 | 评分 | 等级 | 简评 |
|------|:----:|:----:|------|
| 1. 架构合理性 | **9.3** | A+ | 4层划分清晰，依赖方向正确；Facade+EventBus组合解耦彻底；L2领域分组与6大子系统接口定义专业 |
| 2. 可测试性 | **9.0** | A+ | 每层独立可测，Mock策略完整；UITreeExtractor创新实用；但90%覆盖率目标在渲染层偏激进 |
| 3. 可执行性 | **9.1** | A+ | 6阶段迁移计划可操作，28天工期合理；与20版本路线图基本对齐；visual子领域归属待澄清 |
| 4. 代码质量保障 | **9.3** | A+ | 500行约束可实现；技术债务清理计划分版本落实；风险矩阵+回滚策略完备 |
| 5. 文档一致性 | **9.2** | A+ | 3份文档核心概念一致；与VERSION-ROADMAP的Phase划分对齐；存在命名和分类细节差异需修正 |

---

## 1. 架构合理性评价（9.3/10）

### 1.1 亮点

**① 4层划分逻辑严密，依赖方向单向且正确**

```
L4 渲染层 ──→ L1 内核层（通过 RenderStateAdapter）
L3 UI层  ──→ L1 内核层（通过 GameEngineFacade）
L3 UI层  ──→ L2 逻辑层（通过 ISystemXxx 接口）
L2 逻辑层 ──→ L1 内核层（通过 EventBus + ConfigRegistry）
L1 内核层 ──→ 无上层依赖（完全自包含）
```

依赖方向严格单向，L1 完全不依赖任何上层，这是正确的分层原则。L3 通过接口访问 L2 而非直接引用实现类，为 Mock 测试提供了天然切入点。

**② Facade 模式运用恰当**

`GameEngineFacade` 将 2902 行的 God Object `ThreeKingdomsEngine.ts` 精简为 ~300 行的门面，统一收口 `EventBus`、`SubsystemRegistry`、`ConfigRegistry`、`SaveManager` 四大基础设施。这符合「最小知识原则」，上层只需知道 Facade 的 API，无需了解子系统内部结构。

**③ EventBus 解耦策略彻底**

子系统间通信全部通过 EventBus，禁止 `registry.get<T>(...)` 直接获取其他子系统实例（文档中明确标注 ❌ 错误示例）。配合 `EventTypes.ts` 强类型枚举，既解耦又保证编译时类型安全。这一决策在 ADR（关键决策记录）中有充分论证。

**④ L2 六大领域分组合理**

建筑、武将、战役、地图、经济、社交事件六大领域覆盖了现有 39 个源文件的完整分类，每个领域配备独立的 `config/`、`types.ts` 和接口定义（`IBuildingSystem`、`IGeneralSystem` 等），职责边界清晰。

### 1.2 问题与建议

| 级别 | 编号 | 问题 | 建议 |
|:----:|:----:|------|------|
| **P1** | ARCH-1 | **`visual/` 子系统归属模糊**：架构文档在 L2 中列出了 `visual/` 子目录（FloatingTextSystem、ParticleSystem、StatisticsTracker、InputHandler、AudioManager），但 L4 渲染层也有 `ParticleRenderer`。ParticleSystem 同时出现在 L2 和 L4，职责划分不清。 | 明确规则：L2 `visual/` 负责逻辑计算（粒子数量、生命周期、碰撞检测），L4 `rendering/` 负责绘制执行（Canvas/WebGL 渲染）。建议在架构文档中增加 `visual/` 子系统的归属说明段落。 |
| **P1** | ARCH-2 | **L3↔L2 交互方式存在歧义**：文档 §1.2 层间依赖规则表中写"L3 → L2 (接口)"，但 §4.5 Mock 接口示例中 `BuildingPanel` 直接接收 `system={new MockBuildingSystem()}` 作为 props。如果 L3 始终通过接口访问 L2，那 L3 的 `useGameEngine` hook 是通过 `EngineFacade.getSystem()` 还是 Context 注入？ | 建议明确 L3 获取 L2 接口的唯一路径：`GameContext → EngineFacade.getSystem<IBuildingSystem>('building')`，并在 hooks 中封装这一调用。文档应增加"L3 访问 L2 的标准流程"示意图。 |
| **P2** | ARCH-3 | **架构文档的4层 vs 分析文档的4层编号不一致**：`analysis.md` 将数据层定义为 L4（纯数据、无依赖），而 `refactor.md` 将渲染层定义为 L4、数据层合并到 L1 的 ConfigRegistry。两份文档的层级编号体系不同，容易造成混淆。 | 建议在 `refactor.md` 开头增加"与本项目之前的分析文档层级定义差异说明"，明确本次采用 L1 内核 / L2 逻辑 / L3 UI / L4 渲染 的编号体系，数据层不再独立为层。 |

---

## 2. 可测试性评价（9.0/10）

### 2.1 亮点

**① 测试金字塔比例合理**

75% 单元测试 + 20% 集成测试 + 5% E2E 测试的比例符合业界最佳实践。对于放置类游戏引擎，子系统逻辑复杂度高（战斗公式、经济模型、NPC 行为树），大量单元测试是正确的策略。

**② Mock 策略层次分明**

三层 Mock 体系设计专业：
- **L2 测试 Mock L1**：`createMockEventBus()` 记录 emit 调用，`createMockConfig()` 返回预设配置
- **L3 测试 Mock L2**：`MockBuildingSystem implements IBuildingSystem`，完整模拟子系统行为
- **L4 测试 Mock 渲染状态**：`createMockRenderState()` 隔离 Canvas 依赖

这种分层 Mock 确保每层测试只关注自身逻辑，不受其他层变化影响。

**③ UITreeExtractor 创新且实用**

这是本评测中评价最高的设计亮点。为 AI 评测师提供结构化 UI 组件树，支持：
- `findByType()` / `findByName()` / `findByState()` 多维度查询
- `snapshot()` + `diff` 快照回归比对
- `getComponentPosition()` / `getComponentState()` 精确定位

通过 `__reactFiber$` 内部属性获取组件名、`getBoundingClientRect()` 获取坐标，技术实现可行。输出 JSON 格式清晰，评测师可直接消费。

**④ TestDataProvider 数据工厂设计完善**

`hero()` / `army()` / `city()` 支持 `overrides` 参数的部分覆盖模式，`threeKingdomsSetup()` 提供标准初始数据。这种 Builder 模式可大幅减少测试代码中的数据准备重复。

### 2.2 问题与建议

| 级别 | 编号 | 问题 | 建议 |
|:----:|:----:|------|------|
| **P1** | TEST-1 | **>90% 覆盖率目标在渲染层偏激进**：`engine-improvement.md` §10.1 要求"引擎内核（L1+L2）测试覆盖率 >90%"，而 `test-system-design.md` §8.3 的配置中 `rendering/` 行覆盖率目标仅 70%。两处目标不一致，且 PixiJS/Canvas 渲染代码难以达到 90% 行覆盖。 | 建议统一为分层目标：`core/ >90%`、`systems/ >85%`、`ui/ >75%`、`rendering/ >70%`。在 `engine-improvement.md` 验收标准中明确"引擎内核 = core/ + systems/"，不包含 rendering/。 |
| **P1** | TEST-2 | **UITreeExtractor 依赖 React 内部 API**：`__reactFiber$` 是 React 的未文档化内部属性，React 18/19 版本间可能变化。如果 React 升级，此机制可能失效。 | 建议增加降级策略：优先使用 `data-testid` 属性定位，`__reactFiber$` 作为增强手段。在 `UITreeExtractor` 中增加版本检测和 graceful degradation。同时建议在组件中统一添加 `data-testid` 属性。 |
| **P2** | TEST-3 | **GameTestRunner 与 Vitest 关系未明确**：`test-system-design.md` 定义了自定义的 `GameTestRunner`，但测试工具栈选择的是 Vitest。两者是替代关系还是互补关系？GameTestRunner 是 Vitest 的自定义 runner 还是独立框架？ | 建议在文档中明确：GameTestRunner 是对 Vitest 的封装层，内部调用 `vitest.run()` 执行用例。或者明确 GameTestRunner 仅用于 E2E 测试，单元测试直接使用 Vitest。 |
| **P2** | TEST-4 | **180 个单元测试用例估算缺乏依据**：§1.1 规划 L1 单元 ~180 用例，但未给出按子系统的分解。六大领域子系统差异大（BattleSystem 30 个 vs DiplomacySystem 20 个），需要更细粒度的规划。 | 建议按子系统列出用例规划表，类似 §3.1 的格式但扩展到所有子系统，包括 L1 基础设施的用例分配。 |

---

## 3. 可执行性评价（9.1/10）

### 3.1 亮点

**① 6阶段迁移计划可操作性强**

每个阶段都有明确的目标、任务清单和验证标准：
- 阶段 1（3天）：基础设施 → L1 骨架
- 阶段 2（5天）：常量拆分 → 子系统注册
- 阶段 3（7天）：子系统解耦 → EventBus 迁移
- 阶段 4（5天）：渲染层拆分
- 阶段 5（5天）：UI 层拆分（6077行 TSX + 5054行 CSS）
- 阶段 6（3天）：集成测试 + 清理

阶段递进关系合理：先建骨架 → 填充内容 → 解耦 → 拆分展示层 → 验收。每阶段有独立验证点，失败可回滚到上一个 Git Tag。

**② 引擎改进计划与版本路线图对齐**

`engine-improvement.md` 的 6 个 Phase 与 `version-roadmap.md` 的 6 个 Phase 完全对应：
- Phase 1 (v1~v4) 核心框架 → 基础设施 + 核心循环
- Phase 2 (v5~v7) 世界探索 → 地图 + NPC + 领地
- Phase 3 (v8~v10) 经济体系 → 商店 + 离线 + 装备
- Phase 4 (v11~v14) 社交竞技 → PVP + 排行 + 联盟
- Phase 5 (v15~v16) 长线养成 → 羁绊 + 剧情
- Phase 6 (v17~v20) 体验优化 → 渲染 + 音效 + 引导

每个版本的新增/改进子系统清单具体，增量交付（≤5 个子系统/版）控制了回归风险。

**③ Feature Flag + Git Tag 回滚策略务实**

`USE_NEW_ARCHITECTURE = true/false` 的 Feature Flag 设计允许新旧架构并行存在，降低迁移期间的并行开发冲突风险。每个阶段设置 Git Tag 可快速回滚，这是大型重构的标准最佳实践。

### 3.2 问题与建议

| 级别 | 编号 | 问题 | 建议 |
|:----:|:----:|------|------|
| **P1** | EXEC-1 | **迁移计划与版本计划的时间线未对齐**：架构重构的 6 阶段计划（28天/4周）是独立于 v1~v20 版本迭代的。但实际开发中，重构和功能开发需要并行。文档未说明重构在哪个版本区间执行，以及重构期间是否暂停新功能开发。 | 建议在 `engine-improvement.md` 中增加"重构时间窗"章节，明确：方案 A（重构优先，暂停新功能 4 周）；方案 B（重构与 v1.0 并行，每个版本完成后执行一个重构阶段）。推荐方案 B，风险更低。 |
| **P1** | EXEC-2 | **子系统数量不一致**：`refactor.md` 提到"38 个子系统"，`engine-improvement.md` 提到"44 个子系统"，`analysis.md` 提到"30+ 子系统"。三份数据不一致，影响迁移范围评估。 | 建议统一子系统计数口径。经核实源码，当前 39 个源文件中约有 25 个 System 类（排除数据定义、渲染器、配置文件）。建议以 `analysis.md` 的精确清单为准，在所有文档中统一引用。 |
| **P2** | EXEC-3 | **CampaignSystem 拆分风险被识别但缓解不足**：2616 行的 CampaignSystem 拆分为 4 个文件（CampaignManager 300行 + CampaignProgress 250行 + CampaignRewards 200行 + CampaignTypes 150行 = 900行），仅覆盖原文件 34% 的代码。剩余 1716 行的去向未说明。 | 建议补充 CampaignSystem 的完整拆分映射表，类似 §2.3 Engine.ts 拆分策略的格式，列出原文件的每个职责段 → 目标文件的映射关系。 |

---

## 4. 代码质量保障评价（9.3/10）

### 4.1 亮点

**① 单文件 <500 行约束可实现且合理**

文档对每个目标文件都给出了行数估算，所有文件均 ≤500 行。经验证关键拆分：
- `ThreeKingdomsEngine.ts` (2902行) → `GameEngineFacade.ts` (~300行) + 7个管理器文件 ✅
- `ThreeKingdomsPixiGame.tsx` (6077行) → 15 个组件文件 (100~300行) ✅
- `CampaignSystem.ts` (2616行) → 4 个文件 (150~300行) ⚠️ 需补充完整映射
- `constants.ts` (813行) → `ConstantsLoader.ts` (~200行) + 领域分散 ✅
- `GeneralPortraitRenderer.ts` (1071行) → 3 个文件 (200~250行) ✅

500 行的选择在 ADR 中有论证（平衡可读性与文件数量），是合理的折中。

**② 技术债务清理计划分版本落实**

`engine-improvement.md` §9.3 的技术债务清理计划按版本排期：
- v4.0：统一 constants.ts 格式，消除魔法数字
- v7.0：NPC 系列合并为统一模块
- v10.0：事件系统合并为统一层
- v14.0：战役接口统一
- v20.0：TypeScript strict 模式，消除 any

这种"边开发边还债"的策略比集中清理更务实，避免了一次性大规模重构的风险。

**③ 风险矩阵全面**

6 项风险（R1~R6）覆盖了隐式依赖、事件名拼写、性能回退、CSS 冲突、并行开发、复杂拆分等主要风险场景，每项都有具体的缓解措施。R6（CampaignSystem 复杂度高）特别标注"先写集成测试覆盖现有行为，再拆分"，这是正确的策略。

### 4.2 问题与建议

| 级别 | 编号 | 问题 | 建议 |
|:----:|:----:|------|------|
| **P1** | QUAL-1 | **Engine.ts 拆分后 7 个管理器文件未纳入目录结构**：§2.3 描述 Engine.ts 拆分为 GameEngineFacade + 7 个管理器（SubsystemRegistry、LifecycleManager、EventBus、ConfigRegistry、GameState、RenderStateAdapter、SaveManager），但 §2.1 目录结构中 `core/engine/` 只有 3 个文件（GameEngineFacade、SubsystemRegistry、LifecycleManager），其余分布在 `core/events/`、`core/config/`、`core/state/`、`core/save/`。拆分策略和目录结构的对应关系需要更清晰。 | 建议在 §2.3 增加"Engine.ts 代码行 → 目标文件"的精确映射表，标注每段代码（按行号范围）迁移到哪个文件的哪个方法。 |
| **P2** | QUAL-2 | **CSS 拆分缺少冲突检测机制**：§4.3 将 5054 行 CSS 拆为 6 个文件，采用 BEM 命名空间。但原 CSS 中可能存在全局选择器、`!important` 覆盖、z-index 层叠等隐式依赖，拆分后可能引发样式冲突。 | 建议在阶段 5 开始前，先运行 CSS 分析工具（如 PurgeCSS、CSS Stats）识别全局选择器和 `!important` 使用情况，制定清理计划后再拆分。 |
| **P2** | QUAL-3 | **TypeScript strict 模式推迟到 v20.0 风险较高**：如果前 19 个版本都在非 strict 模式下开发，累积的隐式 any 和类型不安全代码量会很大，v20.0 一次性开启 strict 可能导致大量编译错误。 | 建议从 v1.0 起就开启 `strictNullChecks` 和 `noImplicitAny`（渐进式：先在新文件中启用），v20.0 时全面 strict 的过渡成本会低很多。 |

---

## 5. 文档一致性评价（9.2/10）

### 5.1 交叉验证矩阵

| 验证项 | ARCHITECTURE-REFACTOR | TEST-SYSTEM-DESIGN | ENGINE-IMPROVEMENT | VERSION-ROADMAP | 一致性 |
|--------|:--------------------:|:------------------:|:------------------:|:---------------:|:------:|
| 4层架构定义 | L1 内核/L2 逻辑/L3 UI/L4 渲染 | 引用同一分层 | 引用同一分层 | 引用同一分层 | ✅ |
| 子系统数量 | 38 个 | 未明确总数 | 44 个 | ~87 个功能点 | ⚠️ EXEC-2 |
| 测试工具 | Jest | Vitest + ts-mockito | Jest | — | ⚠️ DOC-1 |
| 覆盖率目标 | — | >90%（总体） | >90%（L1+L2） | — | ⚠️ TEST-1 |
| 迁移工期 | 28天/6阶段 | — | — | — | ✅ |
| Phase 划分 | — | — | 6 Phase (v1~v20) | 6 Phase (v1~v20) | ✅ |
| EventBus 决策 | ✅ ADR 记录 | 引用 EventBus | 引用 EventBus | — | ✅ |
| 源码行数 | 22,565 行 | — | 22,565 行 | — | ✅ |
| 测试文件数 | 27 个 | 27 个 | — | — | ✅ |
| Engine.ts 行数 | 2,902 行 | — | — | — | ✅ 验证一致 |

### 5.2 亮点

**① 核心概念在三份文档间保持一致**

4 层架构定义（L1 内核 / L2 逻辑 / L3 UI / L4 渲染）在三份文档中完全一致。GameEngineFacade、EventBus、SubsystemRegistry、SaveManager 四大基础设施的职责描述无矛盾。

**② 源码基线数据准确**

经验证实际源码：
- `ThreeKingdomsEngine.ts` = 2902 行 ✅
- `CampaignSystem.ts` = 2616 行 ✅
- `constants.ts` = 813 行 ✅
- `MapGenerator.ts` = 867 行 ✅
- 源文件数 = 39 个 ✅（含 index.ts）
- 测试文件数 = 27 个 ✅

所有基线数据与实际代码一致，说明文档作者认真核实了源码。

**③ 版本路线图与引擎改进计划的双向对齐**

`engine-improvement.md` 的 Phase 1~6 与 `version-roadmap.md` 的 Phase 1~6 完全对应，每个版本的新增子系统清单可相互印证。

### 5.3 问题与建议

| 级别 | 编号 | 问题 | 建议 |
|:----:|:----:|------|------|
| **P1** | DOC-1 | **测试工具栈不一致**：`refactor.md` §7.1 测试框架列写"Jest"，`test-system-design.md` §1.1 选择"Vitest 1.x"，`engine-improvement.md` §10.1 验收标准写"Jest --coverage"。三处不一致。 | 建议统一为 Vitest（与项目现代工具链更匹配），在所有文档中全局替换 Jest → Vitest。`engine-improvement.md` 验收标准改为 `vitest run --coverage`。 |
| **P1** | DOC-2 | **ENGINE-IMPROVEMENT 子系统名称与 ARCHITECTURE-REFACTOR 不匹配**：例如 ENGINE-IMPROVEMENT 使用 `HeroSystem`、`ArmySystem`、`DiplomacySystem`、`EconomySystem`，而 ARCHITECTURE-REFACTOR 使用 `BuildingSystem`、`UnitSystem`、`CampaignSystem`、`TradeRouteSystem`。测试文档中 `IGameLogic` 接口的方法名（`getHero`、`getArmy`、`formAlliance`）与架构文档的领域接口（`IGeneralSystem`、`IBuildingSystem`）也不一致。 | 建议建立统一的"子系统命名规范表"，在 `refactor.md` 附录中列出所有子系统的标准名称、别名和对应的源码文件。所有文档统一使用标准名称。 |
| **P2** | DOC-3 | **ENGINE-IMPROVEMENT Phase 4 跨度异常**：Phase 4 覆盖 v11~v14（4个版本），而其他 Phase 均为 3 个版本（Phase 1: v1~4 为 4 个版本，但 Phase 2~3/5~6 均为 3 个版本）。Phase 4 包含 PVP + 排行 + 联盟 + 竞技场 + 回放 5 个大系统，工作量明显大于其他 Phase。 | 建议将 Phase 4 拆为 Phase 4a (v11~v12) 和 Phase 4b (v13~v14)，或者将 v14 的内容（BattleChallenge 重构 + ArenaSystem）移入 Phase 5。这更符合"每版 ≤5 个子系统"的增量交付原则。 |
| **P2** | DOC-4 | **测试文档的 L2 子系统列表与架构文档不完全对应**：测试文档 §3.1 列出 MapSystem、HeroSystem、ArmySystem、DiplomacySystem、EconomySystem、BattleSystem 六大子系统，而架构文档 §3.1 列出建筑、武将、战役、地图、经济、社交事件六大领域。两者分类维度不同（功能维度 vs 领域维度），容易造成理解混淆。 | 建议测试文档直接引用架构文档的六大领域分组，在每个领域下列出对应的测试用例规划，保持分类体系统一。 |

---

## 综合问题清单（按优先级排序）

### P1 — 强烈建议修复（7项）

| # | 编号 | 维度 | 问题摘要 | 修复建议 |
|---|:----:|:----:|---------|---------|
| 1 | DOC-1 | 一致性 | 测试工具栈 Jest vs Vitest 不一致 | 统一为 Vitest，全局替换 |
| 2 | DOC-2 | 一致性 | 子系统命名不匹配（HeroSystem vs GeneralSystem 等） | 建立统一命名规范表 |
| 3 | EXEC-2 | 可执行性 | 子系统数量不一致（38 vs 44 vs 30+） | 以源码分析为准，统一计数 |
| 4 | TEST-1 | 可测试性 | 覆盖率目标 >90% 的范围界定不清 | 明确 core/>90% + systems/>85% |
| 5 | ARCH-1 | 架构 | visual/ 子系统在 L2 和 L4 间归属不清 | 增加归属说明 |
| 6 | EXEC-1 | 可执行性 | 重构时间窗与版本迭代的关系未明确 | 增加"重构时间窗"章节 |
| 7 | QUAL-1 | 代码质量 | Engine.ts 拆分映射不够精确 | 增加行号级映射表 |

### P2 — 优化提升（7项）

| # | 编号 | 维度 | 问题摘要 | 修复建议 |
|---|:----:|:----:|---------|---------|
| 8 | ARCH-2 | 架构 | L3 获取 L2 接口的标准路径未明确 | 增加标准流程示意图 |
| 9 | ARCH-3 | 架构 | 与分析文档的层级编号体系不同 | 增加差异说明 |
| 10 | TEST-2 | 可测试性 | UITreeExtractor 依赖 React 内部 API | 增加降级策略 |
| 11 | TEST-3 | 可测试性 | GameTestRunner 与 Vitest 关系未明确 | 明确封装关系 |
| 12 | EXEC-3 | 可执行性 | CampaignSystem 拆分映射不完整 | 补充完整映射表 |
| 13 | QUAL-2 | 代码质量 | CSS 拆分缺少冲突预检 | 增加 CSS 分析步骤 |
| 14 | QUAL-3 | 代码质量 | TypeScript strict 推迟到 v20.0 | 建议渐进式启用 |
| 15 | DOC-3 | 一致性 | Phase 4 跨度异常（4个版本） | 考虑拆分 |
| 16 | DOC-4 | 一致性 | 测试文档与架构文档分类维度不同 | 统一分类体系 |

---

## 核心亮点（Top 5）

1. **GameEngineFacade 门面模式**：将 2902 行 God Object 精简为 ~300 行门面 + 7 个专职管理器，解耦彻底且职责清晰
2. **UITreeExtractor 组件树提取**：为 AI 评测师提供结构化 UI 检查能力，创新性强、实用价值高
3. **EventBus + ISystemXxx 双重解耦**：子系统间通过事件通信、UI 通过接口访问逻辑，两层隔离确保可测试性
4. **6 阶段渐进式迁移**：每阶段有独立验证点和回滚策略，风险可控
5. **技术债务分版本清理**：边开发边还债，避免债务雪球效应

---

## 改进建议（按优先级排序）

### 立即行动（本次评审后）

1. **统一命名体系**：创建 `naming-convention.md`，定义所有子系统的标准名称、接口名、Mock 类名
2. **统一工具栈**：全局确认 Vitest 为测试框架，更新所有文档中的 Jest 引用
3. **补充 Engine.ts 行号级拆分映射表**：标注 2902 行中每段代码的迁移目标

### 重构启动前

4. **明确重构时间窗**：决定与 v1.0 并行还是独立执行
5. **CSS 分析预检**：运行 PurgeCSS 识别全局选择器和 `!important`
6. **UITreeExtractor 降级方案设计**：`data-testid` 优先 + `__reactFiber$` 增强

### 重构过程中

7. **渐进式 TypeScript strict**：从 v1.0 起新文件启用 `strictNullChecks`
8. **CampaignSystem 完整拆分方案**：补充 2616 行的完整行号映射

---

## 与 VERSION-ROADMAP 对齐验证

### Phase 对齐检查

| Phase | VERSION-ROADMAP | ENGINE-IMPROVEMENT | 对齐状态 |
|:-----:|----------------|--------------------|:--------:|
| Phase 1 | v1~v4 核心框架 | v1~v4 核心循环 | ✅ 完全对齐 |
| Phase 2 | v5~v7 世界探索 | v5~v7 世界地图+NPC | ✅ 完全对齐 |
| Phase 3 | v8~v10 经济体系 | v8~v10 经济循环 | ✅ 完全对齐 |
| Phase 4 | v11~v13 社交竞技 | v11~v14 社交竞技 | ⚠️ ENGINE-IMPROVEMENT 多含 v14 |
| Phase 5 | v14~v16 长线养成 | v15~v16 长线养成 | ⚠️ ENGINE-IMPROVEMENT 少含 v14 |
| Phase 6 | v17~v20 体验优化 | v17~v20 体验优化 | ✅ 完全对齐 |

> **说明**: ENGINE-IMPROVEMENT 将 v14（千秋万代）归入 Phase 4 社交竞技，而 VERSION-ROADMAP 将 v14 归入 Phase 5 长线养成。建议以 VERSION-ROADMAP 为准，v14 属于 Phase 5。

### 模块覆盖验证

ENGINE-IMPROVEMENT 的子系统清单覆盖了 VERSION-ROADMAP 20 版本中涉及的所有核心模块（NAV、MAP、CBT、HER、TEC、BLD、PRS、RES、NPC、EVT、QST、ACT、MAL、SHP、EQP、EXP、SOC、PVP、TRD、SET、TUT、OFR），无遗漏。✅

---

## 总结

三国霸业引擎改进阶段二的 3 份核心文档整体质量优秀（**9.2/10**），展现了专业的软件工程思维：

- **架构设计**：4 层分离 + Facade + EventBus 的组合是解决 God Object 问题的经典方案，依赖方向正确、职责划分清晰
- **测试设计**：分层 Mock + UITreeExtractor 的设计超越了常见游戏项目的测试水平，特别适合 AI 辅助评测的场景
- **执行计划**：6 阶段渐进式迁移 + Feature Flag + Git Tag 回滚的策略务实可行
- **文档体系**：3 份文档 + 3 份支撑文档形成了完整的"架构→测试→改进→路线图"文档链

主要改进空间在于**命名一致性**（子系统名称在文档间不统一）和**细节精确性**（拆分映射表、时间窗对齐）。这些都是文档层面的修正，不影响架构设计的正确性。

**评审结论：✅ 通过（9.2/10，无 P0 问题）**

建议修复 7 项 P1 问题后进入实施阶段。

---

*三国霸业 引擎改进阶段二 评测报告 R1 | 2025-07-11 | 评测师: Game Reviewer Agent*
