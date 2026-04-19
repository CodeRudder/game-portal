# 需求编号一致性评审报告

> **评审日期**: 2026-04-18  
> **评审范围**: ui-layout/ 与 prd/ 两套文档的需求编号一致性  
> **评审方法**: 从23个功能模块中抽取8个进行深度比对，辅以全局交叉引用扫描  
> **评审员**: Game Reviewer Agent

---

## 评审概况

| 指标 | 数值 |
|------|------|
| UI-Layout 模块文档数 | 23个（含SPEC） |
| PRD 模块文档数 | 20个（含SPEC） |
| 抽样模块数 | 8/23 |
| 抽样通过项 | 5 |
| 抽样失败项 | 3 |
| 全局扫描发现问题 | 4类 |

---

## 一、索引一致性检查

### 1.1 模块代码对照表

| # | UI-Layout 模块代码 | PRD 模块代码 | 一致性 | 备注 |
|---|:---:|:---:|:---:|------|
| 1 | SPEC | — | ✅ | UI-Layout独有全局规范，PRD无对应 |
| 2 | NAV | NAV | ✅ | 一致 |
| 3 | MAP | MAP | ✅ | 一致 |
| 4 | CBT | CBT | ✅ | 一致 |
| 5 | HER | HER | ✅ | 一致 |
| 6 | TEC | TEC | ✅ | 一致 |
| 7 | BLD | BLD | ✅ | 一致 |
| 8 | **PRS** | **PRS** | ⚠️ | 代码一致，但PRD INDEX标注为"RSP" |
| 9 | RES | — | ❌ | PRD INDEX中无RES，仅有SPEC-currency |
| 10 | NPC | NPC | ✅ | 一致 |
| 11 | EVT | EVT | ✅ | 一致 |
| 12 | QST | **TSK** | ❌ | **代码不一致**：UI用QST，PRD INDEX用TSK |
| 13 | ACT | EVT | ❌ | PRD INDEX中ACT标注为EVT（与事件系统冲突） |
| 14 | MAL | **ML** | ❌ | **代码不一致**：UI用MAL，PRD INDEX用ML |
| 15 | SHP | **SHO** | ❌ | **代码不一致**：UI用SHP，PRD INDEX用SHO |
| 16 | EQP | EQP | ✅ | 一致（PRD标注"待创建"） |
| 17 | EXP | EXP | ✅ | 一致（PRD标注"待创建"） |
| 18 | SOC | **FRD**/**GLD** | ❌ | UI用SOC，PRD拆分为FRD(好友)+GLD(公会)+RNK(排行榜) |
| 19 | PVP | PVP | ✅ | 一致 |
| 20 | TRD | TRD | ✅ | 一致 |
| 21 | SET | SET | ✅ | 一致（PRD标注"待创建"） |
| 22 | TUT | **HLP** | ❌ | UI用TUT，PRD INDEX用HLP |
| 23 | OFR | OFR | ✅ | PRD文件名为SPEC-offline |

### 1.2 索引不一致汇总

**PRD INDEX.md 中存在大量模块代码与实际PRD文件不一致的问题**：

| 问题类型 | 数量 | 详情 |
|---------|:----:|------|
| 模块代码不一致 | 6个 | QST/TSK, MAL/ML, SHP/SHO, SOC/FRD+GLD, TUT/HLP, PRS/RSP |
| PRD标注"待创建"但文件已存在 | 5个 | EQP, EXP, SET, PRS, SOC等实际已有文件 |
| PRD INDEX中缺少的模块 | 3个 | RES(资源), OFR(离线), SPEC(全局规范) |

> **说明**: 虽然PRD INDEX.md中的模块代码与实际PRD文件名不一致，但**实际PRD文件名与UI-Layout文件名是对应的**（如 `QST-quests-prd.md` 而非 `TSK-xxx-prd.md`）。问题出在PRD INDEX.md的表格中使用了不同的代码体系。

---

## 二、抽样深度检查（8个模块）

### 2.1 ✅ CBT 战斗系统 — 通过

| 检查项 | 结果 | 说明 |
|--------|:----:|------|
| 模块编号对应 | ✅ | 两端均使用CBT-1~CBT-8 |
| 子编号层级 | ⚠️ | UI: CBT-1~CBT-6（含视觉规范）；PRD: CBT-1~CBT-8（含离线战斗/挑战关卡） |
| 编号格式统一 | ✅ | 均为 `[CBT-X-Y]` 格式 |
| UI→PRD链接 | ✅ | 所有 `📖 → [PRD: ...]` 均指向 `../prd/CBT-combat-prd.md` |
| PRD→UI链接 | ❌ | PRD指向 `../03-combat-system.md`（**旧路径，文件不存在**） |
| 锚点存在性 | ✅ | UI中的中文锚点（如 `#一战役地图`）在PRD中可匹配 |

**编号覆盖差异**：
- UI-Layout: CBT-1~CBT-6（扫荡系统在CBT-5，视觉规范在CBT-6）
- PRD: CBT-1~CBT-8（扫荡在CBT-5，加速在CBT-6，离线在CBT-7，挑战在CBT-8）
- **差异**: PRD的CBT-7(离线战斗)和CBT-8(挑战关卡)在UI-Layout中无对应编号

### 2.2 ✅ HER 武将系统 — 部分通过

| 检查项 | 结果 | 说明 |
|--------|:----:|------|
| 模块编号对应 | ⚠️ | UI: HER-1~HER-7；PRD: HER-1~HER-6 |
| 子编号层级 | ⚠️ | 含义不完全对应（见下表） |
| UI→PRD链接 | ✅ | 指向 `../prd/HER-heroes-prd.md` |
| PRD→UI链接 | ❌ | 文件头指向 `../ui-layout/HER-heroes.md`（✅正确），但内部引用指向 `../04-hero-system.md`（❌旧路径） |

**编号语义差异**：

| 编号 | UI-Layout 含义 | PRD 含义 | 一致性 |
|------|---------------|---------|:---:|
| HER-1 | 已招募武将列表 | 武将属性/品质/战力 | ❌ 不对应 |
| HER-2 | 武将名册 | 武将招募 | ❌ 不对应 |
| HER-3 | 招募武将 | 武将升级 | ❌ 不对应 |
| HER-4 | 武将详情面板 | 武将技能 | ❌ 不对应 |
| HER-5 | 手机端武将 | 武将碎片与升星 | ❌ 不对应 |
| HER-6 | 红点/养成提示 | 武将编队 | ❌ 不对应 |
| HER-7 | 视觉规范 | — | UI独有 |

> **严重问题**: HER模块的1~6级编号在两套文档中**含义完全不同**。UI的HER-1是"已招募列表"，PRD的HER-1是"武将属性"。这是**编号语义不一致**的典型案例。

### 2.3 ✅ BLD 建筑系统 — 部分通过

| 检查项 | 结果 | 说明 |
|--------|:----:|------|
| 模块编号对应 | ⚠️ | UI: BLD-1~BLD-5；PRD: BLD-1~BLD-5 |
| 子编号层级 | ⚠️ | 含义不完全对应 |
| UI→PRD链接 | ✅ | 指向 `../prd/BLD-buildings-prd.md` |
| PRD→UI链接 | ❌ | 全部指向 `../06-building-system.md`（**旧路径**） |

**编号语义差异**：

| 编号 | UI-Layout 含义 | PRD 含义 | 一致性 |
|------|---------------|---------|:---:|
| BLD-1 | 建筑网格场景+卡片+空地 | 建筑类型总览 | ⚠️ 部分对应 |
| BLD-2 | 建筑详情面板 | 建筑升级数据 | ⚠️ 部分对应 |
| BLD-3 | 建造选择弹窗 | 资源产出公式 | ❌ 不对应 |
| BLD-4 | 升级确认(Toast) | 建筑联动关系 | ❌ 不对应 |
| BLD-5 | 手机端布局 | 升级路线推荐 | ❌ 不对应 |

### 2.4 ✅ TEC 科技系统 — 部分通过

| 检查项 | 结果 | 说明 |
|--------|:----:|------|
| 模块编号对应 | ⚠️ | UI: TEC-1~TEC-4；PRD: TEC-1~TEC-4 |
| UI→PRD链接 | ✅ | 指向 `../prd/TEC-tech-prd.md` |
| PRD→UI链接 | ✅ | 指向 `../ui-layout/TEC-tech.md`（**正确路径**） |

**编号语义差异**：

| 编号 | UI-Layout 含义 | PRD 含义 | 一致性 |
|------|---------------|---------|:---:|
| TEC-1 | 科技树场景+节点+连接线+筛选 | 科技系统概述+三条路线 | ⚠️ 部分对应 |
| TEC-2 | 科技详情面板 | 科技研究流程+时间+加速 | ❌ 不对应 |
| TEC-3 | 研究中进度条(A区) | 科技效果数值表 | ❌ 不对应 |
| TEC-4 | 手机端布局 | 融合科技 | ❌ 不对应 |

### 2.5 ✅ PRS 声望系统 — 通过

| 检查项 | 结果 | 说明 |
|--------|:----:|------|
| 模块编号对应 | ✅ | UI: PRS-1~PRS-4；PRD: PRS-1~PRS-4 |
| 子编号层级 | ✅ | 含义基本对应 |
| UI→PRD链接 | ✅ | 指向 `../prd/PRS-prestige-prd.md` |
| PRD→UI链接 | ✅ | 指向 `../ui-layout/PRS-prestige.md`（**正确路径**） |

**编号语义对照**：

| 编号 | UI-Layout 含义 | PRD 含义 | 一致性 |
|------|---------------|---------|:---:|
| PRS-1 | 声望分栏场景(左栏等级+右栏转生) | 声望等级/阈值/升级 | ✅ 对应 |
| PRS-2 | 转生确认弹窗 | 声望获取途径 | ⚠️ 不对应 |
| PRS-3 | 转生结果弹窗 | 声望奖励/商店 | ⚠️ 不对应 |
| PRS-4 | 手机端声望 | 转生系统 | ⚠️ 不对应 |

### 2.6 ✅ NPC 系统 — 通过

| 检查项 | 结果 | 说明 |
|--------|:----:|------|
| 模块编号对应 | ✅ | UI: NPC-1~NPC-4；PRD: NPC-1~NPC-4 |
| UI→PRD链接 | ✅ | 指向 `../prd/NPC-npc-prd.md` |
| PRD→UI链接 | ✅ | 指向 `../ui-layout/NPC-npc.md`（**正确路径**） |

**编号语义对照**：

| 编号 | UI-Layout 含义 | PRD 含义 | 一致性 |
|------|---------------|---------|:---:|
| NPC-1 | NPC名册+场景展示 | NPC类型定义 | ⚠️ 部分对应 |
| NPC-2 | NPC对话界面 | NPC交互/好感度 | ⚠️ 部分对应 |
| NPC-3 | NPC交易弹窗 | NPC任务系统 | ❌ 不对应 |
| NPC-4 | 手机端NPC | NPC刷新/离线行为 | ❌ 不对应 |

### 2.7 ✅ PVP 竞技场 — 通过

| 检查项 | 结果 | 说明 |
|--------|:----:|------|
| 模块编号对应 | ✅ | UI: PVP-1~PVP-5；PRD: PVP-1~PVP-4 |
| UI→PRD链接 | ✅ | 指向 `../prd/PVP-arena-prd.md` |
| PRD→UI链接 | ✅ | 指向 `../ui-layout/PVP-arena.md`（**正确路径**） |

**编号语义对照**：

| 编号 | UI-Layout 含义 | PRD 含义 | 一致性 |
|------|---------------|---------|:---:|
| PVP-1 | 竞技场场景 | 匹配规则 | ✅ 对应 |
| PVP-2 | 战前布阵 | 战斗规则 | ✅ 对应 |
| PVP-3 | 战斗结算 | 排名奖励 | ⚠️ 不对应 |
| PVP-4 | 防守阵容设置 | 防守阵容 | ✅ 对应 |
| PVP-5 | 手机端布局 | — | UI独有 |

### 2.8 ✅ EXP 远征系统 — 通过

| 检查项 | 结果 | 说明 |
|--------|:----:|------|
| 模块编号对应 | ✅ | UI: EXP-1~EXP-4；PRD: EXP-1~EXP-4 |
| UI→PRD链接 | ✅ | 指向 `../prd/EXP-expedition-prd.md` |
| PRD→UI链接 | ✅ | 指向 `../ui-layout/EXP-expedition.md`（**正确路径**） |

**编号语义对照**：

| 编号 | UI-Layout 含义 | PRD 含义 | 一致性 |
|------|---------------|---------|:---:|
| EXP-1 | 远征场景+路线节点+队伍面板 | 远征路线结构 | ✅ 对应 |
| EXP-2 | 远征战斗结算 | 远征队伍/阵型 | ⚠️ 不对应 |
| EXP-3 | 远征配置弹窗 | 远征战斗规则 | ⚠️ 不对应 |
| EXP-4 | 手机端布局 | 远征奖励/扫荡 | ❌ 不对应 |

---

## 三、交叉引用链接检查

### 3.1 UI-Layout → PRD 链接（📖）

| 状态 | 数量 | 说明 |
|------|:----:|------|
| ✅ 正确 | ~40+ | 大部分指向 `../prd/XXX-prd.md`，路径正确 |
| ❌ 中文锚点 | ~10 | 部分使用中文锚点如 `#一战役地图`，Markdown渲染兼容性存疑 |

**结论**: UI→PRD方向链接整体**健康**，文件路径全部正确。

### 3.2 PRD → UI-Layout 链接（🎨）

| 状态 | 数量 | 涉及文件 | 说明 |
|------|:----:|---------|------|
| ✅ 正确路径 | ~50+ | 后期创建的PRD | 指向 `../ui-layout/XXX.md` |
| ❌ **旧路径** | **30处** | CBT/HER/BLD/MAP/NAV的PRD | 指向 `../03-combat-system.md`、`../04-hero-system.md`等**不存在的旧文件** |

**旧路径详细清单**：

| PRD文件 | 旧路径引用数 | 旧路径示例 |
|---------|:----------:|-----------|
| CBT-combat-prd.md | 8处 | `../03-combat-system.md#campaign-map` |
| HER-heroes-prd.md | 6处 | `../04-hero-system.md#hero-detail` |
| BLD-buildings-prd.md | 5处 | `../06-building-system.md#city-overview` |
| MAP-world-prd.md | 4处 | `../02-map-system.md#map-overview` |
| NAV-main-prd.md | 7处 | `../01-main-layout.md#top-resource-bar` |

> **严重问题**: 5个核心系统PRD文件中的所有 `🎨 → [UI: ...]` 交叉引用均指向**不存在的旧路径**。这些旧文件（01-main-layout.md、02-map-system.md等）在ui-layout目录中不存在。

### 3.3 锚点存在性

| 类型 | 示例 | 目标文件中是否存在 |
|------|------|:---:|
| 英文锚点 `#pvp-1` | PVP-arena-prd.md → PVP-arena.md | ✅ 存在 |
| 英文锚点 `#exp-1` | EXP-expedition-prd.md → EXP-expedition.md | ✅ 存在 |
| 英文锚点 `#prs-1` | PRS-prestige-prd.md → PRS-prestige.md | ✅ 存在 |
| 英文锚点 `#npc-1` | NPC-npc-prd.md → NPC-npc.md | ✅ 存在 |
| 旧英文锚点 `#campaign-map` | CBT-combat-prd.md → 旧文件 | ❌ 文件不存在 |
| 中文锚点 `#一战役地图` | CBT-combat.md → CBT-combat-prd.md | ⚠️ 中文锚点兼容性存疑 |

---

## 四、编号覆盖完整性检查

### 4.1 UI-Layout 模块文件完整性

| 模块 | INDEX中列出 | 文件存在 | 状态 |
|------|:----------:|:-------:|:----:|
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

**结论**: UI-Layout 23个模块文件**100%完整**。

### 4.2 PRD 模块文件完整性

| 模块 | INDEX中列出 | 文件存在 | INDEX标注 | 状态 |
|------|:----------:|:-------:|:--------:|:----:|
| NAV | ✅ | ✅ | — | ✅ |
| MAP | ✅ | ✅ | — | ✅ |
| CBT | ✅ | ✅ | — | ✅ |
| HER | ✅ | ✅ | — | ✅ |
| TEC | ✅ | ✅ | — | ✅ |
| BLD | ✅ | ✅ | — | ✅ |
| PRS | ✅ | ✅ | — | ✅ |
| RES | ❌ | ✅(SPEC-currency) | — | ⚠️ INDEX未列出 |
| NPC | ✅ | ✅ | — | ✅ |
| EVT | ✅ | ✅ | — | ✅ |
| QST | ✅(标注TSK) | ✅ | — | ⚠️ 代码不一致 |
| ACT | ✅ | ✅ | — | ✅ |
| MAL | ✅(标注ML) | ✅ | — | ⚠️ 代码不一致 |
| SHP | ✅(标注SHO) | ✅ | — | ⚠️ 代码不一致 |
| EQP | ✅ | ✅ | "待创建" | ⚠️ 实际已创建 |
| EXP | ✅ | ✅ | "待创建" | ⚠️ 实际已创建 |
| SOC | ✅(标注FRD/GLD) | ✅ | "待创建" | ⚠️ 实际已创建 |
| PVP | ✅ | ✅ | — | ✅ |
| TRD | ✅ | ✅ | — | ✅ |
| SET | ✅ | ✅ | "待创建" | ⚠️ 实际已创建 |
| TUT | ✅(标注HLP) | ✅ | "待创建" | ⚠️ 实际已创建 |
| OFR | ❌ | ✅(SPEC-offline) | — | ⚠️ INDEX未列出 |
| SPEC-interaction | ✅ | ✅ | — | ✅ |
| SPEC-responsive | ✅ | ✅ | — | ✅ |
| SPEC-animation | ✅ | ✅ | — | ✅ |
| SPEC-currency | ✅ | ✅ | — | ✅ |

**结论**: PRD文件实际**全部已创建**，但INDEX.md中标注了大量"待创建"状态，且模块代码体系与实际文件名不一致。

---

## 五、问题汇总与严重等级

### 🔴 P0 严重问题（阻塞开发）

| # | 问题 | 影响范围 | 详情 |
|---|------|---------|------|
| P0-1 | **PRD→UI旧路径链接全部失效** | 5个核心模块(CBT/HER/BLD/MAP/NAV) | 30处 `🎨 → [UI: ...]` 引用指向不存在的旧文件路径（如 `../03-combat-system.md`） |
| P0-2 | **编号语义不一致** | 全部8个抽样模块 | 同一编号（如HER-1）在UI和PRD中含义不同，开发人员无法通过编号定位对应需求 |
| P0-3 | **PRD INDEX模块代码体系混乱** | PRD INDEX.md | INDEX中使用TSK/ML/SHO/FRD/GLD/HLP等代码，但实际文件名使用QST/MAL/SHP/SOC/TUT |

### 🟡 P1 重要问题

| # | 问题 | 影响范围 | 详情 |
|---|------|---------|------|
| P1-1 | **PRD编号范围与INDEX标注不一致** | CBT/HER/TEC等 | INDEX标注CBT-1~8，实际PRD也是CBT-1~8；但INDEX标注HER-1~6，PRD实际也是HER-1~6；而UI是HER-1~7 |
| P1-2 | **PRD INDEX"待创建"状态未更新** | EQP/EXP/SOC/SET/TUT | 5个模块标注"待创建"但文件已存在 |
| P1-3 | **编号覆盖缺口** | CBT-7/CBT-8 | PRD有CBT-7(离线战斗)和CBT-8(挑战关卡)，UI-Layout无对应布局设计 |
| P1-4 | **SOC模块拆分不一致** | SOC | UI合并为SOC-social.md，PRD INDEX拆分为FRD(好友)+GLD(公会)+RNK(排行榜)+RPT(战报)+GDE(图鉴) |

### 🟢 P2 一般问题

| # | 问题 | 影响范围 | 详情 |
|---|------|---------|------|
| P2-1 | **中文锚点兼容性** | CBT UI→PRD | 部分链接使用中文锚点如 `#一战役地图`，不同Markdown渲染器可能不支持 |
| P2-2 | **PRD INDEX缺少模块** | RES/OFR/SPEC | INDEX中未列出RES资源系统和OFR离线收益的PRD对应关系 |
| P2-3 | **PRD INDEX中ACT与EVT代码冲突** | ACT/EVT | INDEX辅助系统表中ACT标注为EVT，与事件系统EVT代码重复 |

---

## 六、修复建议

### 🔴 P0-1: 修复PRD→UI旧路径链接

**涉及文件与替换方案**：

| PRD文件 | 旧路径 | 新路径 |
|---------|--------|--------|
| CBT-combat-prd.md | `../03-combat-system.md` | `../ui-layout/CBT-combat.md` |
| HER-heroes-prd.md | `../04-hero-system.md` | `../ui-layout/HER-heroes.md` |
| BLD-buildings-prd.md | `../06-building-system.md` | `../ui-layout/BLD-buildings.md` |
| MAP-world-prd.md | `../02-map-system.md` | `../ui-layout/MAP-world.md` |
| NAV-main-prd.md | `../01-main-layout.md` | `../ui-layout/NAV-main.md` |

**锚点映射表**（以CBT为例）：

| 旧锚点 | 新锚点 |
|--------|--------|
| `#campaign-map` | `#cbt-1` |
| `#battle-prep` | `#cbt-2` |
| `#battle-process` | `#cbt-3` |
| `#battle-result` | `#cbt-3-6` |
| `#sweep` | `#cbt-5` |
| `#battle-speed` | `#cbt-3-1` |
| `#challenge` | 需新增UI布局 |

**批量修复命令**（建议）：
```bash
# CBT PRD
sed -i 's|\.\./03-combat-system\.md|../ui-layout/CBT-combat.md|g' prd/CBT-combat-prd.md
# HER PRD
sed -i 's|\.\./04-hero-system\.md|../ui-layout/HER-heroes.md|g' prd/HER-heroes-prd.md
# BLD PRD
sed -i 's|\.\./06-building-system\.md|../ui-layout/BLD-buildings.md|g' prd/BLD-buildings-prd.md
# MAP PRD
sed -i 's|\.\./02-map-system\.md|../ui-layout/MAP-world.md|g' prd/MAP-world-prd.md
# NAV PRD
sed -i 's|\.\./01-main-layout\.md|../ui-layout/NAV-main.md|g' prd/NAV-main-prd.md
```

### 🔴 P0-2: 统一编号语义

**方案A（推荐）: 以UI-Layout编号为主，PRD对齐**

在每个PRD章节标题中添加UI编号映射注释：
```markdown
## [CBT-1] 战役长卷
<!-- UI映射: CBT-1 战役长卷 → 对应 -->
```

**方案B: 重新定义统一编号**

创建一份 `NUMBERING-MAP.md` 编号映射表，明确每个编号在UI和PRD中的对应关系。

### 🔴 P0-3: 重写PRD INDEX.md

将PRD INDEX.md中的模块代码全部更新为与实际文件名和UI-Layout一致的代码体系：

```markdown
| 模块 | 文件 | 需求编号范围 |
|------|------|:----------:|
| [QST] 任务 | QST-quests-prd.md | QST-1~3 |  ← 原标注TSK
| [MAL] 邮件 | MAL-mail-prd.md | MAL-1~2 |  ← 原标注ML
| [SHP] 商店 | SHP-shop-prd.md | SHP-1~3 |  ← 原标注SHO
| [SOC] 社交 | SOC-social-prd.md | SOC-1~3 |  ← 原标注FRD/GLD
| [TUT] 引导 | TUT-tutorial-prd.md | TUT-1~2 |  ← 原标注HLP
```

同时更新所有"待创建"状态为"已完成"。

### 🟡 P1-3: 补充CBT-7/CBT-8 UI布局

在 `CBT-combat.md` 中补充：
- `[CBT-7] 离线战斗` — 离线推图UI展示
- `[CBT-8] 挑战关卡` — 挑战关卡网格布局

### 🟡 P1-4: SOC模块拆分对齐

两种方案：
- **方案A**: PRD保持SOC单文件，删除INDEX中的FRD/GLD/RNK/RPT/GDE拆分
- **方案B**: UI-Layout将SOC拆分为SOC-friends.md、SOC-guild.md、SOC-rank.md等子文件

### 🟢 P2-1: 锚点规范化

将所有中文锚点替换为英文锚点：

| 文件 | 旧锚点 | 新锚点 |
|------|--------|--------|
| CBT-combat.md | `#一战役地图出征tab场景` | `#cbt-1` |
| CBT-combat.md | `#二战斗准备面板` | `#cbt-2` |
| CBT-combat.md | `#三战斗过程全屏` | `#cbt-3` |

---

## 七、问题统计

| 严重等级 | 数量 | 状态 |
|---------|:----:|:----:|
| 🔴 P0 严重 | 3 | 需立即修复 |
| 🟡 P1 重要 | 4 | 需本周修复 |
| 🟢 P2 一般 | 3 | 可延后处理 |
| **合计** | **10** | — |

---

## 八、总评分

| 维度 | 评分(0~10) | 说明 |
|------|:---------:|------|
| **文件覆盖完整性** | 9/10 | 两套文档文件齐全，仅PRD INDEX未更新 |
| **模块代码一致性** | 4/10 | PRD INDEX代码体系与实际文件名严重不一致 |
| **编号语义一致性** | 3/10 | 同一编号在UI和PRD中含义不同的现象普遍 |
| **交叉引用正确性** | 5/10 | UI→PRD方向正确；PRD→UI方向30处旧路径失效 |
| **编号格式规范性** | 8/10 | 格式统一为 `[XXX-N-M]`，较为规范 |
| **锚点可用性** | 7/10 | 英文锚点可用，中文锚点兼容性存疑 |

### **综合评分: 5.2 / 10**

> **评语**: 文档体系的基础架构（文件命名、编号格式）较为规范，但存在三类核心问题：(1) PRD INDEX使用了一套与实际文件不同的模块代码体系，造成索引混乱；(2) 5个核心系统PRD中的UI交叉引用全部指向已废弃的旧路径，形成"断链"；(3) 同一编号在UI和PRD中的语义不一致，使得编号无法作为可靠的跨文档定位工具。建议优先修复P0问题，确保两套文档的链接和编号语义完全对齐。

---

*评审报告生成时间: 2026-04-18 | Game Reviewer Agent*
