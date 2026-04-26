# 武将系统游戏评测报告 (R7) — UI-引擎端到端对接完成

> **评测日期**: 2026-06-19
> **评测版本**: HEAD + R7新增（useHeroEngine.ts数据桥接Hook + CSS变量全面应用 + 12组搭档羁绊确认完整）
> **评测师**: 游戏评测师
> **评测依据**: PRD v1.6 + 引擎源码验证 + 迭代日志 v1.8 + R6评测报告 + useHeroEngine.ts(662行) + 18个UI组件源码(10491行) + 引擎测试(38文件/2011用例) + UI测试(17文件/629用例，含集成测试81用例)
> **评分轨迹**: R1(6.4) → R2(6.7) → R3(7.1) → R4(7.6) → R5(8.1) → R6(8.6) → R7(**8.9**)

## 综合评分: 8.9/10（+0.3，从"可展示"到"可运行"的关键一跃）

> **评分说明**: R7评分从8.6提升至8.9（+0.3），标志着武将系统从"UI组件独立展示"正式进入"UI-引擎端到端闭环运行"阶段。
>
> **三大核心突破**：
> 1. **UI-引擎端到端对接完成**：`useHeroEngine.ts`（662行）统一数据桥接Hook，封装了12个数据转换模块（武将列表/武将简要/武将详情/技能数据/资源数量/羁绊数据/建筑数据/编队数据/战力计算/推荐生成/操作方法），4个新组件全部支持 `engineDataSource` 参数，实现了"外部Props优先 → engineDataSource回退"的双通道数据获取模式。这是R6标记的P1-R6-1问题的**彻底解决**。
> 2. **CSS变量全面应用**：4个新组件CSS中硬编码颜色值全部替换为 `var(--tk-*)` CSS变量引用（仅保留fallback色值），CSS变量引用总计96处（SkillUpgradePanel 27处、BondCollectionPanel 20处、HeroDispatchPanel 27处、FormationRecommendPanel 22处），视觉一致性从"混用"提升至"统一变量+安全回退"。
> 3. **12组搭档羁绊确认完整**：引擎 `bond-config.ts` 的 `PARTNER_BONDS` 已包含12组搭档羁绊（蜀3/魏3/吴3/群3），覆盖桃园结义/五虎上将/卧龙凤雏/五子良将/曹氏宗族/虎痴双雄/江东双璧/东吴四英/孙氏父子/三英战吕布/董卓之乱/袁绍谋士，R6标记的P1-R6-4（仅3/12组）问题已彻底关闭。
>
> **但关键挑战仍在**：老组件（GuideOverlay 14处硬编码、HeroCompareModal 7处、RecruitModal 7处）的CSS变量迁移未完成；集成测试（hero-engine-integration.test.tsx，81用例/732行）使用mock引擎验证数据流闭环，但缺少真实引擎环境的端到端验证；新手引导系统引擎-UI对接仍未实现。

---

## 评分轨迹: R1(6.4) → R2(6.7) → R3(7.1) → R4(7.6) → R5(8.1) → R6(8.6) → R7(8.9)

```
R1 ■■■■■■□□□□ 6.4  初始评测：数值不一致+经济断裂
R2 ■■■■■■■□□□ 6.7  +0.3 文档修复，引擎零改动
R3 ■■■■■■■□□□ 7.1  +0.4 经济重构+引擎首次修改+流程文档
R4 ■■■■■■■■□□ 7.6  +0.5 P0关闭+系统联动+新手引导+数值重设计
R5 ■■■■■■■■□□ 8.1  +0.5 视觉规范+UI组件蓝图+羁绊/引导引擎澄清
R6 ■■■■■■■■■□ 8.6  +0.5 P0技术债清零+4个UI组件实现+测试体系升级
R7 ■■■■■■■■■□ 8.9  +0.3 UI-引擎端到端对接+CSS变量统一+12组羁绊完整
```

### 完整评分轨迹表

| 轮次 | 日期 | 综合评分 | 变化 | 核心事件 | 引擎改动 | UI实现 |
|:----:|:----:|:-------:|:----:|---------|:-------:|:-----:|
| R1 | 06-08 | 6.4 | — | 初始评测，发现4处P0 | — | — |
| R2 | 06-10 | 6.7 | +0.3 | 文档修复6处数值不一致 | ❌ 零改动 | — |
| R3 | 06-12 | 7.1 | +0.4 | 经济模型重构+流程文档 | ✅ 招募消耗1→5 | — |
| R4 | 06-14 | 7.6 | +0.5 | P0关闭+联动设计+引导设计 | ⚠️ 被动产出同步 | — |
| R5 | 06-16 | 8.1 | +0.5 | 视觉规范+UI蓝图+羁绊引擎澄清 | ⚠️ 羁绊/引导已有 | — |
| R6 | 04-26 | 8.6 | +0.5 | P0清零+UI组件实现+测试升级 | ✅ 等级上限+装备系数+羁绊系数 | ✅ 4新组件(1315行) |
| R7 | 06-19 | **8.9** | **+0.3** | **UI-引擎对接+CSS变量统一+12组羁绊** | ✅ 确认12组羁绊完整 | ✅ useHeroEngine(662行)+engineDataSource |

---

## 各维度评分对比

| 维度 | R5 | R6 | R7 | 变化 | 说明 |
|------|:--:|:--:|:--:|:----:|------|
| **核心玩法深度** | 8.3 | 8.5 | **8.7** | ↑ | useHeroEngine的`generateRecommendations`直接调用引擎`calculatePower`和`BondSystem.getActiveBonds`，编队推荐从简化估算升级为引擎真实计算。12组搭档羁绊（蜀3/魏3/吴3/群3）提供丰富的编队策略空间 |
| **成长曲线** | 8.2 | 8.7 | **8.7** | → | 等级上限50→100、突破路径50→60→70→80→100保持稳定，经验表1~100级10段配置无变化。成长系统已成熟 |
| **资源循环** | 8.0 | 8.2 | **8.5** | ↑ | useHeroEngine封装了`skillBookAmount`/`goldAmount`资源查询，`upgradeSkill`操作方法内部对齐引擎消耗表（UPGRADE_COST_TABLE），技能升级面板的资源不足禁用逻辑现在基于引擎实时数据 |
| **系统联动性** | 8.5 | 8.8 | **9.3** | ↑↑ | **最大进步维度**。useHeroEngine实现12个数据转换模块，4个新组件全部支持engineDataSource双通道，powerCalculator调用引擎`calculatePower`，羁绊检测调用引擎`getActiveBonds`，编队操作调用引擎`setFormation`。UI-引擎从"分离"到"闭环" |
| **新手引导** | 8.0 | 8.0 | **8.0** | → | 引擎引导系统（TutorialStepManager+Executor）保持稳定，useHeroEngine未包含引导相关数据桥接，引导覆盖范围未扩展 |
| **长期可玩性** | 7.5 | 8.0 | **8.5** | ↑ | 12组搭档羁绊（从3组扩展至12组，+300%）大幅增强收集驱动力。蜀/魏/吴/群各3组，覆盖2~5人组合，最低门槛2人（卧龙凤雏/虎痴双雄/江东双璧/袁绍谋士），新手也可激活 |
| **数值平衡性** | 7.8 | 8.3 | **8.5** | ↑ | 12组羁绊效果经过平衡设计（攻击+10%~18%、防御+8%~15%、暴击+10%、技能伤害+15%~20%），羁绊系数上限2.0防止战力膨胀。编队推荐使用引擎真实战力计算，消除了R6简化估算与实际结果的偏差 |
| **功能完整性** | 7.5 | 8.5 | **8.8** | ↑ | useHeroEngine(662行)补全了"UI组件→引擎系统"的最后一块拼图。18个UI组件 + 1个数据桥接Hook + engineDataSource双通道支持。PRD 12个功能模块中10个已有对应UI组件且支持引擎对接 |
| **操作体验** | 7.0 | 8.0 | **8.5** | ↑ | useHeroEngine封装的`upgradeSkill`/`dispatchHero`/`recallHero`/`applyRecommend`操作方法让用户操作直接触发引擎变更，数据通过snapshotVersion自动刷新。编队推荐一键应用调用引擎`setFormation` |
| **视觉表现** | 7.5 | 7.8 | **8.3** | ↑ | 4个新组件CSS变量引用96处（R6约30处→R7 96处，+220%），硬编码色值全部改为`var(--tk-*, fallback)`模式。但老组件（GuideOverlay 14处、HeroCompareModal 7处、RecruitModal 7处）仍待迁移 |

---

## R6问题修复验证

### ✅ 已修复

| # | R6问题 | 修复状态 | 验证详情 |
|---|--------|:-------:|---------|
| 1 | **P1-R6-1 UI组件与引擎未端到端对接** | ✅ 已修复 | `useHeroEngine.ts`（662行）统一数据桥接Hook，封装12个数据转换模块：①武将列表（`engine.getGenerals()`）②武将简要（`engine.getHeroStarSystem().getStar()`）③武将详情④技能数据（`engine.getSkillUpgradeSystem()`）⑤资源数量（`engine.resource.getAmount()`）⑥羁绊数据（`engine.getBondSystem().getActiveBonds()`）⑦羁绊图鉴（遍历`FACTION_BONDS`+`PARTNER_BONDS`）⑧建筑数据（`engine.building.getAllBuildings()`）⑨编队数据（`engine.getFormationSystem()`）⑩战力计算（`engine.getHeroSystem().calculatePower()`）⑪推荐生成（调用引擎战力+羁绊检测）⑫操作方法（upgradeSkill/dispatchHero/recallHero/applyRecommend）。4个新组件全部支持`engineDataSource`参数，实现"外部Props优先 → engineDataSource回退"双通道 |
| 2 | **P1-R6-2 FormationRecommendPanel推荐算法过于简化** | ✅ 已修复 | `generateRecommendations`方法直接调用引擎`calculatePower`计算实际战力（非简化公式），调用引擎`BondSystem.getActiveBonds`检测羁绊（包含搭档羁绊），3套方案（战力最优/羁绊最优/平衡编队）全部基于引擎真实计算。R6的简化`estimatePower`和`detectBonds`已被引擎调用替代 |
| 3 | **P1-R6-3 视觉设计规范CSS变量未全面应用** | ✅ 部分修复 | 4个新组件CSS变量引用从R6约30处增至R7 96处（+220%），硬编码色值全部改为`var(--tk-*, fallback)`安全回退模式。SkillUpgradePanel(27处var/10处fallback)、BondCollectionPanel(20/5)、HeroDispatchPanel(27/2)、FormationRecommendPanel(22/5)。**但老组件迁移未完成**（详见R7新问题） |
| 4 | **P1-R6-4 羁绊搭档配置仅实现3/12组** | ✅ 已修复 | 引擎`bond-config.ts`的`PARTNER_BONDS`已包含12组搭档羁绊：蜀3（桃园结义/五虎上将/卧龙凤雏）、魏3（五子良将/曹氏宗族/虎痴双雄）、吴3（江东双璧/东吴四英/孙氏父子）、群3（三英战吕布/董卓之乱/袁绍谋士）。每组包含完整的`generalIds`/`effects`/`minRequired`配置 |

### ⚠️ 未修复（R6遗留）

| # | R6问题 | 状态 | 说明 |
|---|--------|:----:|------|
| 1 | **P2-R6-1 SkillUpgradePanel缺少技能预览功能** | ❌ | 仍无升级前后属性对比 |
| 2 | **P2-R6-2 HeroDispatchPanel缺少推荐武将标记** | ❌ | 仍无推荐角标 |
| 3 | **P2-R6-3 BondCollectionPanel羁绊进度百分比未展示** | ❌ | 仍无进度条+百分比 |
| 4 | **P2-R6-4 FormationRecommendPanel缺少"收藏方案"功能** | ❌ | 仍无暂存方案 |
| 5 | **P2-R6-5 组件CSS中BEM命名前缀不统一** | ❌ | 前缀风格仍不一致 |
| 6 | **P2-R5-1 高品质武将占位图缺乏差异化** | ❌ | 所有品质仍使用CSS灰色剪影（连续3轮） |
| 7 | **P2-R5-2 编队阵容保存/分享功能** | ❌ | 连续3轮未实现 |
| 8 | **P2-R5-3 概率公示详情页未设计** | ❌ | 合规要求未满足（连续3轮） |
| 9 | **P2-R5-4 羁绊图标使用Emoji跨平台不一致** | ❌ | 连续3轮 |
| 10 | **HER-11扩展路线图缺优先级** | ❌ | 短期+6名武将未实现（连续5轮） |
| 11 | **经济健康度监控阈值** | ❌ | 超阈值自动调节策略未定义（连续5轮） |

---

## R7新发现的问题

### P0（阻塞核心玩法）

> **本轮无P0问题。** 连续2轮P0清零，核心玩法引擎层和UI-引擎对接层均已稳定。

### P1（影响核心体验）

#### P1-R7-1：老组件CSS变量迁移未完成

**问题**: R7完成了4个新组件的CSS变量统一，但14个老组件中仍有大量硬编码色值：

| 组件 | CSS变量引用 | 硬编码色值 | 严重度 |
|------|:---------:|:---------:|:-----:|
| GuideOverlay.css | 1 | **14** | 🔴 |
| HeroCompareModal.css | 1 | **7** | 🔴 |
| RecruitModal.css | 22 | **7** | 🟡 |
| HeroDetailModal.css | 19 | **8** | 🟡 |
| HeroUpgradePanel.css | 17 | **7** | 🟡 |
| HeroStarUpPanel.css | 43 | **10** | 🟡 |
| RecruitResultModal.css | 9 | **5** | 🟡 |
| FormationPanel.css | 23 | **3** | 🟢 |
| HeroStarUpModal.css | 82 | **5** | 🟢 |

**影响**: GuideOverlay和HeroCompareModal几乎未使用CSS变量（各仅1处），视觉一致性风险最高。尤其GuideOverlay是新手引导遮罩层，视觉不一致直接影响新手体验。

**建议修复**:
1. 优先迁移GuideOverlay（14处→0处）和HeroCompareModal（7处→0处）
2. 编写CSS变量迁移脚本，自动将硬编码色值替换为对应CSS变量
3. 在CI中增加stylelint规则禁止新增硬编码色值
4. 预估工作量1~2天

#### P1-R7-2：集成测试使用mock引擎，缺少真实引擎端到端验证

**问题**: `hero-engine-integration.test.tsx`（81用例/732行）使用mock引擎对象验证UI→引擎→UI数据流闭环，测试覆盖了招募/升级/编队/派遣4个核心流程。但mock引擎与真实引擎存在以下差异：
- mock的`getHeroSystem().calculatePower()`返回固定值，未验证6乘区战力公式
- mock的`getBondSystem().getActiveBonds()`返回预设数据，未验证12组羁绊的实际激活逻辑
- mock的`getFormationSystem().setFormation()`仅记录调用，未验证编队约束（如6人上限、重复武将检测）

**影响**: 集成测试验证了"数据流闭环"但未验证"计算正确性"，真实引擎环境下可能出现战力计算/羁绊检测/编队约束的边界问题。

**建议修复**:
1. 新增`hero-engine-e2e.test.tsx`，使用真实`ThreeKingdomsEngine`实例
2. 覆盖3个关键场景：战力计算一致性、羁绊激活准确性、编队操作约束
3. 预估工作量2~3天

#### P1-R7-3：新手引导系统UI-引擎对接缺失

**问题**: 引擎已有完整的引导系统（`TutorialStepManager`+`TutorialStepExecutor`，5步引导流程），R5设计了详细的引导方案（`hero-tutorial-design.md`），R6实现了`GuideOverlay`组件。但useHeroEngine未包含引导相关数据桥接：
- 无`currentTutorialStep`数据获取
- 无`advanceTutorialStep`操作方法
- 无`isTutorialActive`状态查询
- GuideOverlay组件未接入engineDataSource

**影响**: 新手引导评分连续3轮保持8.0不变，引导系统引擎-UI对接是唯一未通过useHeroEngine桥接的子系统。

**建议修复**:
1. useHeroEngine新增引导相关数据转换模块（`tutorialStep`/`isTutorialActive`/`advanceStep`）
2. GuideOverlay支持engineDataSource参数
3. 预估工作量1~2天

### P2（锦上添花）

#### P2-R7-1：useHeroEngine错误处理策略为静默吞错

**问题**: useHeroEngine中所有引擎调用都包裹在`try { ... } catch { /* 静默处理 */ }`中，引擎操作失败时无任何用户反馈。例如`upgradeSkill`失败时，用户点击升级按钮无任何反应，无法区分"操作成功但无视觉反馈"和"操作失败被静默忽略"。

**建议修复**: 引入统一的错误处理回调（`onEngineError?: (error: Error, context: string) => void`），允许上层组件决定错误展示方式（Toast/日志/降级UI）。

#### P2-R7-2：generateRecommendations的羁绊最优方案算法可优化

**问题**: 当前羁绊最优方案采用"按阵营分组→每组取前6→检测羁绊数→选最多"的贪心策略。对于12组搭档羁绊（含跨阵营的"三英战吕布"），可能错过最优组合。例如：刘备+关羽+张飞+吕布可同时激活"桃园结义"+"蜀国羁绊"+"三英战吕布"3个羁绊，但按阵营分组时刘备关羽张飞归入蜀国组，吕布归入群雄组，无法同时检测。

**建议修复**: 在`generateRecommendations`中增加"搭档羁绊优先"策略：先从PARTNER_BONDS中找出可同时激活的羁绊组合，再补充战力最高的武将填满6人编队。

#### P2-R7-3：bondCatalog中heroNames字段始终为空数组

**问题**: useHeroEngine的`bondCatalog`生成逻辑中，`BondCatalogItem.heroNames`字段始终为空数组`[]`，导致羁绊图鉴面板无法展示搭档武将的名字列表。

**建议修复**: 从`allGenerals`中查找`generalIds`对应的武将名字，填充`heroNames`字段。

#### P2-R7-4：剩余6个UI组件仍未实现

**问题**: R6标记的6个未实现组件（FormationGridPanel拖拽版、HeroBreakthroughPanel、EquipmentSlot、RedDotBadge、BondActivateModal、HeroBadgeSystem）在R7仍未实现（连续2轮）。

**建议修复**: 按优先级实现，HeroBreakthroughPanel（突破面板）和BondActivateModal（羁绊激活动画）优先级最高。

---

## UI组件实现状态总览（18个组件 + 1个Hook）

### 组件分类与代码量

| 分类 | 组件名 | 代码行 | CSS行 | 测试数 | engineDataSource | 状态 |
|------|--------|:-----:|:-----:|:-----:|:---------------:|:----:|
| **数据桥接** | **useHeroEngine** | **662** | — | 81(集成) | — | **✅ R7新增** |
| **页面级** | HeroTab | 281 | 347 | 52 | — | ✅ R5 |
| | FormationPanel | 314 | 349 | — | — | ✅ R5 |
| **面板级** | HeroDetailModal | 445 | 388+116 | 38 | — | ✅ R5 |
| | RecruitModal | 368 | 427 | 112 | — | ✅ R5 |
| | RecruitResultModal | 193 | 334 | 83 | — | ✅ R5 |
| | HeroStarUpPanel | 386 | 170 | 35 | — | ✅ R5 |
| | HeroStarUpModal | 388 | 489 | 31 | — | ✅ R5 |
| | HeroCompareModal | 223 | 156 | — | — | ✅ R5 |
| | HeroUpgradePanel | 267 | 244 | 23 | — | ✅ R5 |
| | SkillUpgradePanel | 258 | 253 | 29 | ✅ | ✅ R6→R7对接 |
| | BondCollectionPanel | 379 | 214 | 23 | ✅ | ✅ R6→R7对接 |
| | HeroDispatchPanel | 311 | 315 | 32 | ✅ | ✅ R6→R7对接 |
| | FormationRecommendPanel | 367 | 237 | 41 | ✅ | ✅ R6→R7对接 |
| **原子级** | HeroCard | 128 | 253 | — | — | ✅ R5 |
| | StarDisplay | 78 | 53 | — | — | ✅ R5 |
| | AttributeBar | 138 | 89 | 49 | — | ✅ R5 |
| | QualityBadge | 66 | 89 | — | — | ✅ R5 |
| | ResourceCost | 123 | 109 | — | — | ✅ R5 |
| | RadarChart | 164 | — | — | — | ✅ R5 |
| | GuideOverlay | 281 | 151 | — | ❌ | ✅ R5 |
| **合计** | **18组件+1Hook** | **~5820** | **~4671** | **629** | **4/18** | — |

### useHeroEngine数据桥接质量评估

| 模块 | 引擎调用 | 数据转换 | 错误处理 | 评价 |
|------|:-------:|:-------:|:-------:|------|
| 武将列表 | `engine.getGenerals()` | ✅ 数组/对象兼容 | try-catch | 兼容性好，支持数组和Record两种返回 |
| 武将简要 | `engine.getHeroStarSystem().getStar()` | ✅ GeneralData→HeroBrief | try-catch | 星级信息从引擎获取，非硬编码 |
| 武将详情 | `engine.getHeroStarSystem().getStar()` | ✅ GeneralData→HeroInfo | try-catch | 包含阵营信息，用于编队推荐 |
| 技能数据 | `engine.getSkillUpgradeSystem()` | ✅ SkillData→SkillItem | try-catch | 突破阶段检查+解锁条件+消耗表对齐 |
| 资源数量 | `engine.resource.getAmount()` | ✅ 直接查询 | try-catch | 支持skillBook和gold两种资源 |
| 羁绊数据 | `engine.getBondSystem().getActiveBonds()` | ✅ ActiveBond[] | try-catch | 直接调用引擎羁绊检测 |
| 羁绊图鉴 | 遍历`FACTION_BONDS`+`PARTNER_BONDS` | ✅ →BondCatalogItem[] | 无需 | 12组羁绊全覆盖 |
| 建筑数据 | `engine.building.getAllBuildings()` | ✅ →BuildingBrief[] | try-catch | 含派遣状态查询 |
| 编队数据 | `engine.getFormationSystem()` | ✅ →(string\|null)[] | try-catch | 兼容对象和字符串slot格式 |
| 战力计算 | `engine.getHeroSystem().calculatePower()` | ✅ 真实引擎计算 | try-catch+回退 | 引擎失败时回退到简易估算 |
| 推荐生成 | 引擎战力+引擎羁绊检测 | ✅ 3套方案 | try-catch+回退 | 羁绊检测失败时回退到阵营计数 |
| 操作方法 | 4个引擎操作 | ✅ 直接调用 | try-catch静默 | ⚠️ 错误被静默吞掉 |

### 12组搭档羁绊完整清单

| 阵营 | 羁绊名 | 武将组合 | 最低人数 | 效果 |
|------|--------|---------|:-------:|------|
| 蜀 | 桃园结义 | 刘备+关羽+张飞 | 3 | 攻击+15% |
| 蜀 | 五虎上将 | 关羽/张飞/赵云/马超/黄忠(任意3) | 3 | 暴击率+10% |
| 蜀 | 卧龙凤雏 | 诸葛亮+庞统 | 2 | 技能伤害+20% |
| 魏 | 五子良将 | 张辽/徐晃/于禁/张郃/乐进(任意3) | 3 | 防御+12% |
| 魏 | 曹氏宗族 | 曹仁/曹洪/夏侯惇/夏侯渊(任意2) | 2 | 生命+15% |
| 魏 | 虎痴双雄 | 许褚+典韦 | 2 | 攻击+12%/防御+8% |
| 吴 | 江东双璧 | 孙策+周瑜 | 2 | 速度+15%/技能伤害+10% |
| 吴 | 东吴四英 | 鲁肃/吕蒙/陆逊(任意2) | 2 | 智力+15% |
| 吴 | 孙氏父子 | 孙坚+孙策+孙权 | 3 | 攻击+10%/速度+10% |
| 群 | 三英战吕布 | 刘备+关羽+张飞+吕布 | 4 | 攻击+18% |
| 群 | 董卓之乱 | 董卓+吕布+貂蝉 | 3 | 暴击伤害+15% |
| 群 | 袁绍谋士 | 田丰+沮授 | 2 | 智力+12%/技能范围+1 |

**收集驱动力分析**：
- **新手可激活**（2人组合）：卧龙凤雏/虎痴双雄/江东双璧/东吴四英/曹氏宗族/袁绍谋士 = 6组
- **中期可激活**（3人组合）：桃园结义/五虎上将/五子良将/孙氏父子/董卓之乱 = 5组
- **长期追求**（4~5人组合）：三英战吕布(4人) = 1组
- **跨阵营羁绊**：三英战吕布（蜀+群），鼓励跨阵营收集

---

## 引擎改动验证

### 战力公式（R7确认，无变化）

```
战力 = floor(statsPower × levelCoeff × qualityCoeff × starCoeff × equipmentCoeff × bondCoeff)
```

| 乘区 | 系数 | 来源 | 默认值 | R7状态 |
|------|------|------|--------|:-----:|
| 基础属性 | ATK×2 + DEF×1.5 + INT×2 + SPD×1 | hero-config | — | ✅ |
| 等级系数 | 1 + level × 0.05 | hero-config | 1.05 | ✅ |
| 品质系数 | QUALITY_MULTIPLIERS[quality] | hero-config | 1.0~1.8 | ✅ |
| 星级系数 | getStarMultiplier(star) | star-up-config | 1.0~2.5 | ✅ |
| 装备系数 | 1 + equipPower / 1000 | EquipmentSystem注入 | 1.0 | ✅ |
| 羁绊系数 | BondSystem注入 | BondSystem注入 | 1.0 | ✅ |

### 羁绊配置验证（R7确认完整）

| 类型 | 数量 | 配置来源 | useHeroEngine引用 |
|------|:----:|---------|------------------|
| 阵营羁绊 | 4组 | `FACTION_BONDS` | ✅ 遍历生成bondCatalog |
| 搭档羁绊 | 12组 | `PARTNER_BONDS` | ✅ 遍历生成bondCatalog |
| 羁绊类型 | BondType.FACTION/PARTNER | `bond-config.ts` | ✅ 直接导入 |
| 羁绊效果 | stat+value | 各羁绊定义 | ✅ adaptEffects转换 |

### 测试验证结果

| 测试类别 | 文件数 | 用例数 | 说明 |
|---------|:-----:|:-----:|------|
| 引擎测试 | 38 | ~2011 | 全量通过，零回归 |
| UI组件测试 | 13 | ~548 | 13个组件独立测试 |
| UI集成测试 | 1 | 81 | hero-engine-integration（R7新增） |
| **UI测试合计** | **17** | **~629** | — |
| **总计** | **55** | **~2640** | — |

---

## 设计-实现差距评估（R7更新）

### 子系统差距矩阵

| 子系统 | R6状态 | R7状态 | 变化 | 说明 |
|--------|:-----:|:-----:|:----:|------|
| 武将属性/战力 | 🟢 | 🟢 | → | 稳定，6乘区完整 |
| 武将招募 | 🟢 | 🟢 | → | 稳定 |
| 武将升级 | 🟢 | 🟢 | → | 稳定 |
| 武将升星 | 🟡 | 🟡 | → | UI已有，useHeroEngine未包含升星操作 |
| 武将突破 | 🟢 | 🟢 | → | 稳定 |
| 等级上限联动 | 🟢 | 🟢 | → | 稳定 |
| 招贤令经济 | 🟢 | 🟢 | → | 稳定 |
| 铜钱经济 | 🟡 | 🟡 | → | 引擎已有，useHeroEngine通过resource.getAmount获取 |
| 突破石经济 | 🔴 | 🔴 | → | 零实现（关卡掉落逻辑未改） |
| 技能书经济 | 🔴 | 🔴 | → | 零实现 |
| 羁绊系统 | 🟢 | 🟢 | → | 12组搭档羁绊完整，useHeroEngine已桥接 |
| 新手引导 | 🟡 | 🟡 | → | 引擎已有，useHeroEngine未桥接引导系统 |
| 装备系统 | 🟢 | 🟢 | → | 稳定 |
| 派驻系统 | 🟡 | 🟢 | ↑ | useHeroEngine已桥接dispatchHero/recallHero |
| 视觉设计 | 🟡 | 🟡 | → | 4个新组件CSS变量统一，老组件未迁移 |
| **UI组件** | 🟡 | 🟢 | ↑ | 18组件+1Hook，4个新组件支持engineDataSource |
| **UI-引擎对接** | 🔴 | 🟢 | ↑↑ | **从"未对接"到"useHeroEngine统一桥接"** |

**差距总结**: 17个子系统中9个已连接(🟢)、5个部分连接(🟡)、2个设计-实现断裂(🔴)、1个新增已连接(🟢)。相比R6（6🟢+8🟡+2🔴），R7将3个🟡提升至🟢（派驻/UI组件/UI-引擎对接），设计-实现差距从约25%缩窄至约15%。

### 设计-实现差距趋势

```
R1: ████████████████░░░░  设计领先实现约40%
R2: █████████████████░░░  设计领先实现约50%（纯文档迭代）
R3: ████████████████░░░░  设计领先实现约40%（引擎首次修改）
R4: ██████████████████░░  设计领先实现约55%（大量新设计）
R5: ████████████████░░░░  设计领先实现约40%（羁绊/引导引擎澄清）
R6: █████████████░░░░░░░  设计领先实现约25%（P0清零+UI组件实现）
R7: ██████████░░░░░░░░░░  设计领先实现约15%（UI-引擎端到端对接）
```

---

## 改进建议（按优先级）

### P0 — 无（连续2轮P0清零 🎉）

### P1 — 影响核心体验（R8优先完成）

| # | 任务 | 工作量 | 说明 |
|---|------|:------:|------|
| 1 | **老组件CSS变量迁移** | 1~2天 | 优先GuideOverlay(14处)和HeroCompareModal(7处)，编写迁移脚本+stylelint规则 |
| 2 | **真实引擎端到端测试** | 2~3天 | 新增hero-engine-e2e.test.tsx，使用真实ThreeKingdomsEngine验证战力/羁绊/编队 |
| 3 | **新手引导UI-引擎对接** | 1~2天 | useHeroEngine新增引导数据桥接，GuideOverlay支持engineDataSource |
| 4 | **剩余6个UI组件实现** | 8~10天 | HeroBreakthroughPanel/BondActivateModal优先 |

### P2 — 提升体验（后续迭代）

| # | 任务 | 工作量 | 说明 |
|---|------|:------:|------|
| 5 | useHeroEngine统一错误处理 | 0.5天 | onEngineError回调，替代静默吞错 |
| 6 | generateRecommendations羁绊算法优化 | 1天 | 增加"搭档羁绊优先"策略 |
| 7 | bondCatalog.heroNames填充 | 0.5天 | 从allGenerals查找武将名字 |
| 8 | SkillUpgradePanel技能升级预览 | 0.5天 | 展示升级前后属性对比 |
| 9 | BondCollectionPanel收集进度百分比 | 0.5天 | 进度条+百分比展示 |
| 10 | 概率公示详情页设计+实现 | 1天 | 合规要求（连续3轮） |
| 11 | 短期武将扩展(+6名) | 2天 | HER-11路线图（连续5轮） |
| 12 | 经济健康度监控阈值 | 0.5天 | 自动化经济调节（连续5轮） |

---

## 关键发现总结

### 发现1：useHeroEngine是"从展示到运行"的关键基础设施

R6的4个新UI组件虽然功能完整，但都是"数据由外部传入"的纯展示组件，需要上层容器负责引擎调用。R7的`useHeroEngine.ts`（662行）填补了这一空白：
- **12个数据转换模块**将引擎层数据（GeneralData/ActiveBond/SkillData等）转换为UI Props格式（HeroBrief/HeroInfo/SkillItem/BondCatalogItem等）
- **4个操作方法**（upgradeSkill/dispatchHero/recallHero/applyRecommend）封装引擎操作，UI组件只需调用回调
- **engineDataSource双通道**让组件既可独立使用（外部Props），也可通过Hook自动获取引擎数据
- **snapshotVersion机制**确保引擎状态变更时UI自动刷新

这使得武将系统从"需要手动粘合UI和引擎"变为"Hook自动桥接，组件即插即用"。

### 发现2：12组搭档羁绊从"设计"到"引擎"到"UI"三层对齐

R6时搭档羁绊仅3组（桃园结义/五虎上将/卧龙凤雏），R7确认引擎已实现完整12组（蜀3/魏3/吴3/群3），且useHeroEngine的bondCatalog生成逻辑遍历`FACTION_BONDS`+`PARTNER_BONDS`全部12组。这意味着：
- **设计层**：hero-bond-system.md定义12组 → ✅
- **引擎层**：bond-config.ts实现12组 → ✅
- **桥接层**：useHeroEngine遍历12组 → ✅
- **展示层**：BondCollectionPanel展示12组 → ✅

这是武将系统中首个实现"设计-引擎-桥接-展示"四层完全对齐的功能模块。

### 发现3：CSS变量统一从"新组件"开始，老组件迁移是下一步

R7的CSS变量工作采用了"新组件先行"策略：4个R6新增组件的CSS变量引用从约30处增至96处（+220%），硬编码色值全部改为`var(--tk-*, fallback)`安全回退模式。这确保了新代码的质量基线，但老组件（尤其是GuideOverlay 14处硬编码、HeroCompareModal 7处）仍需迁移。

CSS变量统一进度：
- ✅ 4个新组件：96处var / 22处fallback（fallback为安全回退，可接受）
- ⚠️ 14个老组件：约240处var / 约74处硬编码（需迁移）
- 📊 总体进度：约336处var / 约96处硬编码 ≈ 78%变量化

### 发现4：测试体系从"组件级"扩展到"集成级"

R7新增的`hero-engine-integration.test.tsx`（81用例/732行）是首个UI-引擎集成测试文件，覆盖：
- **招募流程**：招募成功→列表更新、招募失败→列表不变、连续招募→累积
- **升级流程**：升级成功→属性变化、资源不足→禁用
- **编队流程**：应用编队→引擎更新、羁绊检测→UI展示
- **派遣流程**：派遣武将→建筑更新、召回武将→状态重置

虽然使用mock引擎（P1-R7-2标记需补充真实引擎测试），但验证了UI组件→engineDataSource→操作回调的完整数据流闭环。测试总量从R6的1486个提升至R7的约2640个（+78%）。

---

## 开发阶段进度评估

### R6规划的4阶段进度

| 阶段 | R6规划 | R7实际 | 完成度 | 说明 |
|------|--------|--------|:-----:|------|
| 第一阶段：技术债清理 | 2.5天 | ✅ 完成 | 100% | P0清零+羁绊补充+CSS变量（新组件） |
| 第二阶段：P0核心UI | 23天 | ✅ 基本完成 | ~90% | 18组件+1Hook，engineDataSource双通道 |
| 第三阶段：P1深度玩法 | 14.5天 | ⚠️ 进行中 | ~60% | useHeroEngine完成桥接，引导对接+老组件迁移未完成 |
| 第四阶段：P2完善体验 | 13.5天 | ❌ 部分开始 | ~10% | 集成测试完成，P2功能未开始 |

### 剩余工作量估算

| 任务 | 工作量 | 优先级 |
|------|:-----:|:-----:|
| 老组件CSS变量迁移 | 1~2天 | P1 |
| 真实引擎端到端测试 | 2~3天 | P1 |
| 新手引导UI-引擎对接 | 1~2天 | P1 |
| 剩余6个UI组件 | 8~10天 | P1 |
| P2体验优化 | 5~7天 | P2 |
| **合计** | **17~24天** | — |

---

## R8预期评分展望

| 维度 | R7评分 | R8预期 | 改善条件 |
|------|:-----:|:-----:|---------|
| 系统联动性 | 9.3 | 9.5+ | 新手引导UI-引擎对接完成 |
| 视觉表现 | 8.3 | 8.8+ | 老组件CSS变量迁移完成 |
| 功能完整性 | 8.8 | 9.0+ | 剩余6个UI组件实现 |
| 新手引导 | 8.0 | 8.5+ | 引导系统UI-引擎对接 |
| **综合预期** | **8.9** | **9.1~9.2** | P1任务完成可冲击9.0+ |

---

*评测完成 | 评测基于: PRD v1.6、引擎源码验证(bond-config.ts/HeroSystem.ts/BondSystem.ts)、UI组件源码(18组件+1Hook/10491行)、useHeroEngine.ts(662行/12模块)、引擎测试(38文件/~2011用例)、UI测试(17文件/~629用例含集成测试81用例)、R6评测报告、迭代日志v1.8 | 综合评分: 8.9/10 (R1:6.4→R2:6.7→R3:7.1→R4:7.6→R5:8.1→R6:8.6→R7:8.9, +0.3) | **R7核心成就：useHeroEngine统一数据桥接，UI-引擎端到端对接完成，12组搭档羁绊确认完整，CSS变量新组件全面应用** *
