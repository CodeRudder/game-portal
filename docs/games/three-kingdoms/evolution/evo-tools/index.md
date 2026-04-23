# 评测工具索引

> **用途**: 评测流程中可复用的工具库索引。
> **入口**: [进化规则](../../process/evolution-rules.md) | [导航索引](../INDEX.md)

---

## E2E 浏览器测试

**目录**: `e2e/`

| 工具 | 说明 |
|------|------|
| [game-actions.cjs](../../../../e2e/utils/game-actions.cjs) | Playwright可复用浏览器操作库，封装initBrowser/enterGame/switchTab/openBuildingModal/closeAllModals/takeScreenshot等13个函数，支持环境变量配置URL、视口尺寸，各版本UI测试脚本共享复用 |
| [whitescreen-guard.spec.ts](../../../../e2e/whitescreen-guard.spec.ts) | Playwright白屏守护测试，检测页面加载后root非空、无console error、无未捕获异常，作为CI门禁 |

---

## 游戏事件模拟器

**目录**: `src/games/three-kingdoms/test-utils/`

| 工具 | 说明 |
|------|------|
| [GameEventSimulator.ts](../../../../src/games/three-kingdoms/test-utils/GameEventSimulator.ts) | 封装ThreeKingdomsEngine的高层测试API，提供initBeginnerState/addResources/upgradeBuilding等便捷方法模拟游戏事件链，所有方法直接调用真实引擎API确保测试与生产行为一致。支持快照断言(SimulatorSnapshot)和事件日志(EventLogEntry) |

---

## UITreeExtractor

**目录**: `src/games/three-kingdoms/tests/ui-extractor/`

从React DOM和PixiJS双渲染树中提取统一的UITreeNode结构，支持快照对比差异检测，用于UI回归测试。

| 工具 | 说明 |
|------|------|
| ReactDOMAdapter | 从React渲染的DOM结构中提取UITreeNode树，过滤非可视元素(SCRIPT/STYLE等)，提取节点状态(visible/enabled/active/alpha)和边界信息 |
| PixiJSAdapter | 从PixiJS v8 Container层级中提取UITreeNode树，通过轻量级PixiDisplayObjectLike接口避免直接依赖@pixi/node |
| UITreeDiffer | 对比两个UI树快照，检测新增/删除/变更/移动的节点，比较状态属性(visible/enabled/text等)和边界属性(x/y/width/height) |
| CompositeExtractor | 将React DOM树和PixiJS显示对象树合并为统一的UI树，支持按配置选择提取源，提供统计信息(UITreeStats) |

---

## UI审查器

**目录**: `src/games/three-kingdoms/tests/ui-review/`

版本评测流水线：解析PLAN/PRD文档 → 检查源码覆盖 → 自动评分，替代人工逐项检查。

| 工具 | 说明 |
|------|------|
| PlanValidator | 解析PLAN版本文档，提取功能点清单(id/模块/优先级/PRD引用)，在源码中自动验证每个功能点是否有对应实现 |
| PrdChecker | 解析PRD文档，提取需求清单和验收标准(id/章节/优先级)，在源码中自动检查每个需求是否有对应实现 |
| UIReviewScorer | 综合PlanValidator和PrdChecker结果，按5维度10分制评分：功能完整性(30%)、代码质量(20%)、测试覆盖(20%)、UI/UX体验(15%)、架构设计(15%) |
| UIReviewOrchestrator | 评测流水线编排器，串联PlanValidator→PrdChecker→UIReviewScorer，根据版本号自动定位PLAN/PRD文档和源码，执行全流程评测并生成报告 |

---

## 测试工具库

**目录**: `src/games/three-kingdoms/tests/utils/`

单元测试/集成测试的基础设施，提供Mock、运行器和数据工厂。

| 工具 | 说明 |
|------|------|
| [MockGameLogic](../../../../src/games/three-kingdoms/tests/utils/MockGameLogic.ts) | IGameLogic接口的完整Mock实现，自动记录调用日志(callLog)，支持构造函数overrides自定义行为，通过TestDataProvider生成合理默认返回值 |
| [GameTestRunner](../../../../src/games/three-kingdoms/tests/utils/GameTestRunner.ts) | 结构化测试运行器，支持registerCase注册用例、category/tags过滤、setup/teardown生命周期、超时控制、批量执行和报告生成 |
| [TestDataProvider](../../../../src/games/three-kingdoms/tests/utils/TestDataProvider.ts) | 测试数据工厂，提供createHero/createArmy/createCity等标准化数据生成方法，所有方法支持overrides覆盖默认值，内置计数器确保批量生成ID唯一 |

---

*文档版本: v2.0 | 更新日期: 2026-04-23*
