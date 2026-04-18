# 三国霸业文档体系评审报告 R1

## 评审概况
- **评审日期**: 2026-04-18
- **评审范围**: UI布局文档(23个模块) + PRD文档(26个文件)
- **评审基准**: RESTRUCTURE-PLAN.md v1.0 中定义的25个模块
- **评审类型**: 文档体系结构评审（非内容质量评审）

---

## 评审结果

### 1. 功能覆盖完整性 (7/10)

#### 1.1 RESTRUCTURE-PLAN 定义的25个模块

| # | 代码 | 模块名 | UI布局文档 | PRD文档 | 状态 |
|---|------|--------|:----------:|:-------:|:----:|
| 1 | SPEC | 全局规范 | ✅ SPEC-global.md | — (纯UI规范) | ✅ |
| 2 | NAV | 全局导航 | ✅ NAV-main.md | ✅ NAV-main-prd.md | ✅ |
| 3 | MAP | 世界地图 | ✅ MAP-world.md | ✅ MAP-world-prd.md | ✅ |
| 4 | CBT | 战斗系统 | ✅ CBT-combat.md | ✅ CBT-combat-prd.md | ✅ |
| 5 | HER | 武将系统 | ✅ HER-heroes.md | ✅ HER-heroes-prd.md | ✅ |
| 6 | TEC | 科技系统 | ✅ TEC-tech.md | ✅ TEC-tech-prd.md | ✅ |
| 7 | BLD | 建筑系统 | ✅ BLD-buildings.md | ✅ BLD-buildings-prd.md | ✅ |
| 8 | PRS | 声望系统 | ✅ PRS-prestige.md | ✅ PRS-prestige-prd.md | ✅ |
| 9 | RES | 资源系统 | ✅ RES-resources.md | ✅ RES-resources-prd.md | ✅ |
| 10 | NPC | NPC系统 | ✅ NPC-npc.md | ✅ NPC-npc-prd.md | ✅ |
| 11 | EVT | 事件系统 | ✅ EVT-events.md | ✅ EVT-events-prd.md | ✅ |
| 12 | QST | 任务系统 | ✅ QST-quests.md | ✅ QST-quests-prd.md | ✅ |
| 13 | ACT | 活动系统 | ✅ ACT-activities.md | ✅ ACT-activities-prd.md | ✅ |
| 14 | MAL | 邮件系统 | ✅ MAL-mail.md | ✅ MAL-mail-prd.md | ✅ |
| 15 | SHP | 商店系统 | ✅ SHP-shop.md | ✅ SHP-shop-prd.md | ✅ |
| 16 | EQP | 装备系统 | ✅ EQP-equipment.md | ✅ EQP-equipment-prd.md | ✅ |
| 17 | EXP | 远征系统 | ✅ EXP-expedition.md | ✅ EXP-expedition-prd.md | ✅ |
| 18 | SOC | 社交系统 | ✅ SOC-social.md | ✅ SOC-social-prd.md | ✅ |
| 19 | PVP | PVP竞技 | ✅ PVP-arena.md | ✅ PVP-arena-prd.md | ✅ |
| 20 | TRD | 贸易路线 | ✅ TRD-trade.md | ✅ TRD-trade-prd.md | ✅ |
| 21 | SET | 设置系统 | ✅ SET-settings.md | ✅ SET-settings-prd.md | ✅ |
| 22 | TUT | 引导系统 | ✅ TUT-tutorial.md | ✅ TUT-tutorial-prd.md | ✅ |
| 23 | OFR | 离线收益 | ✅ OFR-offline.md | ✅ SPEC-offline.md | ✅ |
| 24 | ITR | 交互规范 | — (合并至SPEC-global) | ✅ SPEC-interaction.md | ⚠️ |
| 25 | RSP | 响应式设计 | — (合并至SPEC-global) | ✅ SPEC-responsive.md | ⚠️ |
| 26 | ANI | 动画精灵 | — (合并至SPEC-global) | ✅ SPEC-animation.md | ⚠️ |
| 27 | — | 货币体系 | — (合并至RES) | ✅ SPEC-currency.md | ⚠️ |

**统计**: 23/23 UI布局模块文件已创建 ✅ | 26/26 PRD文件已创建 ✅

#### 1.2 问题发现

| # | 严重度 | 问题描述 |
|---|--------|---------|
| 1 | 🟡 中 | **ITR/RSP/ANI 无独立UI布局文档**：RESTRUCTURE-PLAN列出ITR、RSP、ANI三个独立模块，但UI布局侧将它们合并进了SPEC-global.md，而非创建独立文件。虽在INDEX中说明，但与PLAN定义不完全一致。 |
| 2 | 🔴 高 | **PRD INDEX严重过时**：prd/INDEX.md中列出了19个"→ 待创建"模块（包括EQP、EXP、SHP、SET等），但这些文件**实际已经存在**。INDEX未更新，会给开发者造成严重误导。 |
| 3 | 🟡 中 | **PRD INDEX模块代码不一致**：INDEX中使用了RSP、SHO、TSK、ML、FRD等代码，但实际文件使用PRS、SHP、QST、MAL、SOC等代码。编号体系存在混乱。 |
| 4 | 🟡 中 | **PRD INDEX多出大量模块**：INDEX中列出了BAG(背包)、GLD(公会)、RNK(排行榜)、RPT(战报)、GDE(图鉴)、HLP(帮助)、PRE(公告)、VIP、CHK(签到)、ACH(成就)等10个模块，但这些模块在RESTRUCTURE-PLAN的25个模块中**完全不存在**，UI布局侧也无对应文件。 |

---

### 2. 交叉引用正确性 (8/10)

#### 2.1 抽查结果（5个模块）

**① BLD 建筑系统** ✅ 优秀

| 检查项 | UI→PRD | PRD→UI |
|--------|--------|--------|
| 文件头引用 | `../prd/BLD-buildings-prd.md` ✅ | `../ui-layout/BLD-buildings.md` ✅ |
| 章节引用 | BLD-1, BLD-1-1, BLD-1-2, BLD-2, BLD-3, BLD-4, BLD-5 均有PRD引用 ✅ | BLD-1~5 均有UI引用 ✅ |
| 编号一致性 | UI: BLD-1~5, PRD: BLD-1~5 ✅ | ✅ |

**② HER 武将系统** ⚠️ 有问题

| 检查项 | UI→PRD | PRD→UI |
|--------|--------|--------|
| 文件头引用 | `../prd/HER-heroes-prd.md` ✅ | `../ui-layout/HER-heroes.md` ✅ |
| 章节引用 | 多处引用正确 ✅ | 多处引用正确 ✅ |
| 编号一致性 | UI: HER-1~7, PRD: HER-1~6 ⚠️ UI多了HER-6(红点系统)和HER-7(视觉规范) | |
| **错误引用** | HER-2引用了`./tk-ui-layout-11-navigation-paths.md`（旧文档路径）❌ | |

**③ CBT 战斗系统** ✅ 良好

| 检查项 | UI→PRD | PRD→UI |
|--------|--------|--------|
| 文件头引用 | `../prd/CBT-combat-prd.md` ✅ | ✅ |
| 章节引用 | 多处引用正确，含锚点 ✅ | 多处引用正确 ✅ |
| 编号一致性 | UI: CBT-1~6, PRD: CBT-1~8 ⚠️ PRD多出CBT-7, CBT-8 | |

**④ SHP 商店系统** ✅ 优秀

| 检查项 | UI→PRD | PRD→UI |
|--------|--------|--------|
| 文件头引用 | `../prd/SHP-shop-prd.md` ✅ | `../ui-layout/SHP-shop.md` ✅ |
| 章节引用 | SHP-1~4均有引用 ✅ | SHP-1~4均有引用 ✅ |
| 编号一致性 | UI: SHP-1~4, PRD: SHP-1~4 ✅ | ✅ |

**⑤ EXP 远征系统** ✅ 优秀

| 检查项 | UI→PRD | PRD→UI |
|--------|--------|--------|
| 文件头引用 | `../prd/EXP-expedition-prd.md` ✅ | `../ui-layout/EXP-expedition.md` ✅ |
| 章节引用 | EXP-1~4均有引用 ✅ | EXP-1~4均有引用 ✅ |
| 编号一致性 | UI: EXP-1~4, PRD: EXP-1~4 ✅ | ✅ |

#### 2.2 问题发现

| # | 严重度 | 模块 | 问题描述 |
|---|--------|------|---------|
| 5 | 🔴 高 | HER | **HER-2引用旧文档路径**：`HER-heroes.md`第103行引用`./tk-ui-layout-11-navigation-paths.md#24-武将tab路径树重要重构`，应改为`../prd/HER-heroes-prd.md#her-2` |
| 6 | 🟡 中 | NAV | **NAV-main.md引用旧文档**：第98行引用`tk-ui-layout-11-navigation-paths.md`，该旧文件虽存在但应逐步迁移 |
| 7 | 🟢 低 | CBT | **编号范围不一致**：UI布局CBT-1~6，PRD为CBT-1~8。PRD多出的CBT-7、CBT-8在UI侧无对应布局描述 |
| 8 | 🟢 低 | HER | **编号范围不一致**：UI布局HER-1~7，PRD为HER-1~6。UI多出的HER-6(红点系统)、HER-7(视觉规范)在PRD侧无对应玩法描述 |

---

### 3. 内容分离正确性 (9/10)

#### 3.1 抽查结果（3个PRD文档）

**① PVP-arena-prd.md** ✅ 合规
- ✅ 无像素尺寸、布局位置描述
- ✅ 包含：匹配规则、战斗参数、段位数值表、奖励表、AI策略
- ✅ 仅通过 `🎨 →` 引用UI布局文档
- grep搜索"px"：仅出现在UI交叉引用路径中，无布局描述

**② SOC-social-prd.md** ✅ 合规
- ✅ 无像素尺寸、布局位置描述
- ✅ 包含：好友上限表、互动规则、借将系统、聊天频道规则、排行榜奖励、邮件规则
- ✅ 仅通过 `🎨 →` 引用UI布局文档

**③ TEC-tech-prd.md** ✅ 合规
- ✅ 无像素尺寸、布局位置描述
- ✅ 包含：科技路线设计、研究流程、数值表、解锁条件、融合科技、转生规则
- ✅ 仅通过 `🎨 →` 引用UI布局文档

#### 3.2 额外验证

**HER-heroes-prd.md** ⚠️ 轻微违规
- 第45-46行提到"雷达图（260×260px）"和"条形图（每条 28px 高）"
- **判定**：属于"属性展示方式"的功能描述（PRD决定用什么图表展示），而非布局定位（UI决定放在哪里、多大）。**边界情况，可接受**。

**BLD-buildings-prd.md** ✅ 完全合规
- 纯数值表+规则逻辑，无任何UI描述

#### 3.3 UI布局文档内容检查

**BLD-buildings.md** ✅ 合规
- ✅ 包含：ASCII布局图、像素尺寸、位置规格、状态样式、交互行为
- ✅ 通过 `📖 →` 引用PRD文档
- ✅ 不包含：升级数值表、产出公式、解锁条件等玩法规则

---

### 4. INDEX完整性 (5/10)

#### 4.1 UI布局INDEX (ui-layout/INDEX.md) — 8/10

**覆盖情况**：

| 模块 | INDEX中列出 | 文件存在 | 一致 |
|------|:----------:|:--------:|:----:|
| SPEC | ✅ | ✅ | ✅ |
| NAV | ✅ | ✅ | ✅ |
| MAP | ✅ | ✅ | ✅ |
| CBT | ✅ | ✅ | ✅ |
| HER | ✅ | ✅ | ✅ |
| TEC | ✅ | ✅ | ✅ |
| BLD | ✅ | ✅ | ✅ |
| PRS | ✅ | ✅ | ✅ |
| RES | ✅ | ✅ | ✅ |
| NPC | ✅ | ✅ | ✅ |
| EVT | ✅ | ✅ | ✅ |
| QST | ✅ | ✅ | ✅ |
| ACT | ✅ | ✅ | ✅ |
| MAL | ✅ | ✅ | ✅ |
| SHP | ✅ | ✅ | ✅ |
| EQP | ✅ | ✅ | ✅ |
| EXP | ✅ | ✅ | ✅ |
| SOC | ✅ | ✅ | ✅ |
| PVP | ✅ | ✅ | ✅ |
| TRD | ✅ | ✅ | ✅ |
| SET | ✅ | ✅ | ✅ |
| TUT | ✅ | ✅ | ✅ |
| OFR | ✅ | ✅ | ✅ |

**优点**：
- ✅ 23个模块全部覆盖
- ✅ 包含需求编号范围列
- ✅ 包含功能点二级索引（NAV/MAP/CBT/HER/BLD/TEC详细展开）
- ✅ 包含旧文档对照表

**不足**：
- ⚠️ 功能点索引只详细展开了6个模块（NAV/MAP/CBT/HER/BLD/TEC），其余17个模块标注"详见各模块独立文档"，缺少完整的二级索引

#### 4.2 PRD INDEX (prd/INDEX.md) — 2/10 🔴

**严重问题**：

| # | 问题 | 影响 |
|---|------|------|
| 9 | **19个模块标注"→ 待创建"但文件已存在** | 开发者会误以为文档缺失 |
| 10 | **模块代码与实际文件不一致**：INDEX用SHO/TSK/ML/FRD，实际用SHP/QST/MAL/SOC | 代码混乱，无法快速定位 |
| 11 | **10个多余模块**：BAG/GLD/RNK/RPT/GDE/HLP/PRE/VIP/CHK/ACH不在25模块范围内 | 范围蔓延，无法区分已实现和计划中 |
| 12 | **核心系统6个模块已创建但INDEX未更新**：EQP/EXP/SHP/SET/EVT/ML均标"待创建" | INDEX完全不可信 |

**PRD INDEX现状**：

| 分类 | INDEX列出 | 实际已创建 | 状态 |
|------|:---------:|:---------:|:----:|
| 核心系统(6) | 6 | 6 | ✅ INDEX正确 |
| 辅助系统(19标待创建) | 19 | 14已创建 + 5未创建 | 🔴 INDEX严重过时 |
| 规范文档(5) | 5 | 5 | ✅ INDEX正确 |

---

### 5. 综合评分

| 维度 | 评分 | 权重 | 加权分 |
|------|:----:|:----:|:------:|
| 功能覆盖完整性 | 7/10 | 25% | 1.75 |
| 交叉引用正确性 | 8/10 | 25% | 2.00 |
| 内容分离正确性 | 9/10 | 25% | 2.25 |
| INDEX完整性 | 5/10 | 25% | 1.25 |
| **综合评分** | | | **7.3/10** |

---

## 问题清单

| # | 严重度 | 模块 | 问题描述 | 修复建议 |
|---|--------|------|---------|---------|
| 1 | 🔴 高 | PRD/INDEX | PRD INDEX中19个模块标注"→ 待创建"但文件已存在 | 重写PRD INDEX，将已创建模块指向实际文件路径 |
| 2 | 🔴 高 | PRD/INDEX | PRD INDEX模块代码与实际文件名不一致（SHO/TSK/ML vs SHP/QST/MAL） | 统一使用RESTRUCTURE-PLAN中定义的模块代码 |
| 3 | 🔴 高 | PRD/INDEX | PRD INDEX多出10个不在25模块范围内的模块（BAG/GLD等） | 将这些模块移至"未来规划"分区，与当前25模块明确区分 |
| 4 | 🔴 高 | HER/UI | HER-heroes.md第103行引用旧文档路径`./tk-ui-layout-11-navigation-paths.md` | 改为`../prd/HER-heroes-prd.md#her-2` |
| 5 | 🟡 中 | NAV/UI | NAV-main.md第98行引用旧文档`tk-ui-layout-11-navigation-paths.md` | 迁移内容到NAV-main.md后更新引用 |
| 6 | 🟡 中 | CBT | UI布局CBT-1~6，PRD为CBT-1~8，PRD多出2个编号无UI对应 | 在UI布局中补充CBT-7、CBT-8的布局描述，或在PRD中标注"UI待补充" |
| 7 | 🟡 中 | HER | UI布局HER-1~7，PRD为HER-1~6，UI多出HER-6/7无PRD对应 | HER-6(红点)内容已在PRD HER-6中覆盖但编号错位；HER-7(视觉规范)属于纯UI，无需PRD |
| 8 | 🟡 中 | UI/INDEX | UI INDEX功能点索引仅详细展开6个模块，17个模块缺少二级索引 | 补充其余17个模块的完整功能点索引 |
| 9 | 🟡 中 | SPEC | ITR/RSP/ANI在RESTRUCTURE-PLAN中为独立模块，但UI侧合并至SPEC-global.md | 在SPEC-global.md中明确标注合并来源，或在INDEX中增加映射说明 |
| 10 | 🟢 低 | HER/PRD | HER-heroes-prd.md提到"雷达图260×260px"等尺寸描述 | 可接受（属于展示方式的功能决策），建议加注释说明"尺寸为展示规格，非布局定位" |

---

## 改进建议

### P0 — 必须立即修复

1. **重写PRD INDEX**（问题#1~#3）
   - 将已创建的14个辅助系统模块从"→ 待创建"改为实际文件链接
   - 统一模块代码为RESTRUCTURE-PLAN定义的代码（SHP/QST/MAL/SOC等）
   - 将BAG/GLD/RNK等10个规划中模块移至独立"未来规划"分区
   - 更新需求编号范围与实际文档一致

2. **修复HER-heroes.md旧文档引用**（问题#4）
   - 将`./tk-ui-layout-11-navigation-paths.md#24-武将tab路径树重要重构`
   - 改为`../prd/HER-heroes-prd.md#her-2`

### P1 — 本迭代内修复

3. **统一编号范围**（问题#6~#7）
   - CBT：确认PRD中CBT-7、CBT-8的内容，在UI布局中补充对应描述
   - HER：将PRD的HER-6(编队/红点)与UI的HER-6(红点)对齐编号

4. **补充UI INDEX二级索引**（问题#8）
   - 为PRS/RES/NPC/EVT/QST/ACT/MAL/SHP/EQP/EXP/SOC/PVP/TRD/SET/TUT/OFR共15个模块补充完整的功能点索引表

5. **清理旧文档引用**（问题#5）
   - 检查所有新文档中对`tk-ui-layout-*`的引用，逐步替换为新文档路径

### P2 — 后续优化

6. **建立编号一致性校验机制**
   - 建议在CI/CD中增加脚本，自动检查：
     - UI文档和PRD文档的1级编号是否一一对应
     - 交叉引用路径是否有效（无404）
     - INDEX中列出的文件是否都存在

7. **规范SPEC类文档归属**
   - 明确ITR/RSP/ANI是合并进SPEC-global还是保持独立
   - 在RESTRUCTURE-PLAN中更新最终决定

8. **PRD INDEX增加版本追踪**
   - 增加"最后更新"列
   - 增加"状态"列（已创建/待创建/规划中）

---

## 附录：文档统计

### 文件清单

**UI布局文档 (23个模块文件 + 1个INDEX)**：
```
SPEC-global.md  NAV-main.md    MAP-world.md   CBT-combat.md
HER-heroes.md   TEC-tech.md    BLD-buildings.md  PRS-prestige.md
RES-resources.md  NPC-npc.md    EVT-events.md  QST-quests.md
ACT-activities.md  MAL-mail.md  SHP-shop.md    EQP-equipment.md
EXP-expedition.md  SOC-social.md  PVP-arena.md   TRD-trade.md
SET-settings.md  TUT-tutorial.md  OFR-offline.md
```

**PRD文档 (21个模块PRD + 5个SPEC + 1个INDEX)**：
```
NAV-main-prd.md    MAP-world-prd.md   CBT-combat-prd.md
HER-heroes-prd.md  TEC-tech-prd.md    BLD-buildings-prd.md
PRS-prestige-prd.md  RES-resources-prd.md  NPC-npc-prd.md
EVT-events-prd.md  QST-quests-prd.md  ACT-activities-prd.md
MAL-mail-prd.md    SHP-shop-prd.md    EQP-equipment-prd.md
EXP-expedition-prd.md  SOC-social-prd.md  PVP-arena-prd.md
TRD-trade-prd.md   SET-settings-prd.md  TUT-tutorial-prd.md
SPEC-interaction.md  SPEC-responsive.md  SPEC-offline.md
SPEC-animation.md   SPEC-currency.md
```

**旧文档 (仍保留，未删除)**：
```
tk-ui-layout-01~13系列 (13个文件)
tk-ui-modules.md
tk-ui-review-r1~r5系列
tk-ui-gap-analysis.md
```

---

*三国霸业文档体系评审 R1 | 2026-04-18 | 评审人: Game Reviewer Agent*
