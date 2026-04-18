# 交叉引用验证报告 (R1)

> **验证日期**: 2026-04-18 | **验证范围**: ui-layout/ ↔ prd/ 全量交叉引用
> **验证方法**: 自动化脚本扫描所有 Markdown 链接、锚点、文件存在性

---

## 1. PRD引用验证结果（UI-Layout → PRD）

### 1.1 文件存在性：✅ 全部通过

共扫描 27 个唯一文件引用，**全部指向已存在的 PRD 文件**。

| UI-Layout 文件 | 引用的 PRD 文件 | 状态 |
|---|---|:---:|
| ACT-activities.md | ACT-activities-prd.md | ✅ |
| BLD-buildings.md | BLD-buildings-prd.md | ✅ |
| CBT-combat.md | CBT-combat-prd.md | ✅ |
| EQP-equipment.md | EQP-equipment-prd.md | ✅ |
| EVT-events.md | EVT-events-prd.md | ✅ |
| EXP-expedition.md | EXP-expedition-prd.md | ✅ |
| HER-heroes.md | HER-heroes-prd.md | ✅ |
| MAL-mail.md | MAL-mail-prd.md | ✅ |
| MAP-world.md | MAP-world-prd.md | ✅ |
| MAP-world.md | SPEC-responsive.md | ✅ |
| NAV-main.md | NAV-main-prd.md, RES-resources-prd.md, SPEC-interaction.md, SPEC-responsive.md | ✅ |
| NPC-npc.md | NPC-npc-prd.md | ✅ |
| OFR-offline.md | SPEC-offline.md | ✅ |
| PRS-prestige.md | PRS-prestige-prd.md | ✅ |
| PVP-arena.md | PVP-arena-prd.md | ✅ |
| QST-quests.md | QST-quests-prd.md | ✅ |
| RES-resources.md | RES-resources-prd.md, PRS-prestige-prd.md | ✅ |
| SET-settings.md | SET-settings-prd.md | ✅ |
| SHP-shop.md | SHP-shop-prd.md | ✅ |
| SOC-social.md | SOC-social-prd.md | ✅ |
| SPEC-global.md | SPEC-interaction.md | ✅ |
| TEC-tech.md | TEC-tech-prd.md | ✅ |
| TRD-trade.md | TRD-trade-prd.md | ✅ |
| TUT-tutorial.md | TUT-tutorial-prd.md | ✅ |

### 1.2 锚点引用统计

- **总引用数**: 152 条
- **带锚点引用**: 131 条
- **无锚点引用**: 21 条（模块顶部总链接）

### 1.3 锚点匹配分析

UI-Layout → PRD 方向的锚点分为两类：

**A. 数字编号锚点（匹配 ✅）**

使用 `[模块-编号]` 格式，与 PRD 文件中的标题 `[XXX-N]` 生成的 GitHub 锚点格式匹配。例如：
- `#act-1` → PRD 标题 `[ACT-1] 活动类型` → 锚点 `act-1-活动类型` ⚠️
- `#bld-1` → PRD 标题 `[BLD-1] 建筑类型` → 锚点 `bld-1-建筑类型` ⚠️

> **注意**: PRD 文件的标题格式为 `[XXX-N] 中文描述`，GitHub 生成的锚点会包含中文部分（如 `act-1-活动类型`），而 UI-Layout 引用仅使用 `#act-1`。**在标准 Markdown 渲染器中这些锚点不会精确匹配**，但 GitHub 渲染器支持前缀匹配（fragment 匹配会取第一个包含该前缀的标题）。因此标记为 ⚠️ 部分匹配。

**B. 中文标题锚点（CBT 模块特有）**

CBT-combat.md 引用了中文标题锚点，例如：
- `#一战役地图出征tab场景` → 对应 PRD 标题 `一、战役地图（出征Tab场景）`
- `#二战斗准备面板` → 对应 PRD 标题 `二、战斗准备面板`
- `#三战斗过程全屏` → 对应 PRD 标题 `三、战斗过程（全屏）`
- `#四扫荡系统-核心新增` → 对应 PRD 标题 `四、扫荡系统（核心新增）`
- `#六战斗结算面板` → 对应 PRD 标题 `六、战斗结算面板`

> ⚠️ CBT 模块的锚点格式与其他模块不一致。其他模块使用 `#xxx-N` 数字编号，CBT 使用中文标题锚点。虽然可能可以匹配，但格式不统一。

**C. SPEC 规范锚点（匹配 ✅）**

- `#itr-1` ~ `#itr-7` → SPEC-interaction.md 标题 `[ITR-1]` ~ `[ITR-5]`（注意：ITR 只有 1~5，但 UI 引用了 itr-6 和 itr-7）
- `#rsp-1` → SPEC-responsive.md 标题 `[RSP-1]`
- `#ofr-1` ~ `#ofr-3` → SPEC-offline.md 标题 `[OFR-1]` ~ `[OFR-3]`

---

## 2. UI布局引用验证结果（PRD → UI-Layout）

### 2.1 文件存在性：✅ 全部通过

共扫描 21 个唯一文件引用，**全部指向已存在的 UI-Layout 文件**。

| PRD 文件 | 引用的 UI-Layout 文件 | 状态 |
|---|---|:---:|
| ACT-activities-prd.md | ACT-activities.md | ✅ |
| BLD-buildings-prd.md | BLD-buildings.md | ✅ |
| CBT-combat-prd.md | CBT-combat.md | ✅ |
| EQP-equipment-prd.md | EQP-equipment.md | ✅ |
| EVT-events-prd.md | EVT-events.md | ✅ |
| EXP-expedition-prd.md | EXP-expedition.md | ✅ |
| HER-heroes-prd.md | HER-heroes.md | ✅ |
| MAL-mail-prd.md | MAL-mail.md | ✅ |
| MAP-world-prd.md | MAP-world.md | ✅ |
| NAV-main-prd.md | NAV-main.md | ✅ |
| NPC-npc-prd.md | NPC-npc.md | ✅ |
| PRS-prestige-prd.md | PRS-prestige.md | ✅ |
| PVP-arena-prd.md | PVP-arena.md | ✅ |
| QST-quests-prd.md | QST-quests.md | ✅ |
| RES-resources-prd.md | RES-resources.md | ✅ |
| SET-settings-prd.md | SET-settings.md | ✅ |
| SHP-shop-prd.md | SHP-shop.md | ✅ |
| SOC-social-prd.md | SOC-social.md | ✅ |
| TEC-tech-prd.md | TEC-tech.md | ✅ |
| TRD-trade-prd.md | TRD-trade.md | ✅ |
| TUT-tutorial-prd.md | TUT-tutorial.md | ✅ |

### 2.2 锚点引用统计

- **总引用数**: 93 条
- **带锚点引用**: 72 条
- **无锚点引用**: 21 条（模块顶部总链接）

### 2.3 锚点匹配分析

**⚠️ PRD → UI-Layout 方向锚点全部使用英文命名，但 UI-Layout 文件标题为中文**

PRD 引用的锚点格式：`#xxx-N`（如 `#bld-1`, `#soc-1`, `#pvp-1`）
UI-Layout 实际标题锚点格式：`#xxx-N-中文描述`（如 `#bld-1-建筑网格场景-c区-1280696px`）

**72 个锚点引用全部无法精确匹配**，因为：
- PRD 引用 `#bld-1`
- UI-Layout 标题 `[BLD-1] 建筑网格场景` 生成的锚点是 `bld-1-建筑网格场景-c区-1280696px`

> 在 GitHub 渲染中，`#bld-1` 不会跳转到 `#bld-1-建筑网格场景-c区-1280696px`，因为 GitHub 锚点是精确匹配的。

**详细不匹配清单（72 条）**：

| PRD 文件 | 引用锚点 | UI 实际锚点前缀 | 状态 |
|---|---|---|:---:|
| ACT-activities-prd.md | #act-1 ~ #act-4 | act-1-活动类型 等 | ❌ |
| BLD-buildings-prd.md | #bld-1 ~ #bld-5 | bld-1-建筑类型 等 | ❌ |
| CBT-combat-prd.md | #cbt-1 ~ #cbt-8 | cbt-1-战役长卷 等 | ❌ |
| EQP-equipment-prd.md | #eqp-1 ~ #eqp-5 | eqp-1-装备类型 等 | ❌ |
| EVT-events-prd.md | #evt-1 ~ #evt-4 | evt-1-事件类型 等 | ❌ |
| EXP-expedition-prd.md | #exp-1 ~ #exp-4 | exp-1-远征路线 等 | ❌ |
| HER-heroes-prd.md | #hero-list, #hero-detail, #recruit 等 | her-1-武将属性 等 | ❌ |
| MAL-mail-prd.md | #mal-1 ~ #mal-3 | mal-1-邮件类型 等 | ❌ |
| MAP-world-prd.md | #map-overview, #filter-bar 等 | map-1-地图规则 等 | ❌ |
| NAV-main-prd.md | #top-resource-bar, #nav-tab-bar 等 | nav-1-主界面功能定位 等 | ❌ |
| NPC-npc-prd.md | #npc-1 ~ #npc-4 | npc-1-npc类型 等 | ❌ |
| PRS-prestige-prd.md | #prs-1 ~ #prs-4 | prs-1-声望等级 等 | ❌ |
| PVP-arena-prd.md | #pvp-1 ~ #pvp-4 | pvp-1-匹配规则 等 | ❌ |
| QST-quests-prd.md | #qst-1 ~ #qst-4 | qst-1-任务类型 等 | ❌ |
| RES-resources-prd.md | #res-1 ~ #res-4 | res-1-资源类型 等 | ❌ |
| SET-settings-prd.md | #set-1 ~ #set-4 | set-1-基础设置 等 | ❌ |
| SHP-shop-prd.md | #shp-1, #shp-4 | shp-1-商品分类 等 | ❌ |
| SOC-social-prd.md | #soc-1 ~ #soc-3 | soc-1-好友系统 等 | ❌ |
| TEC-tech-prd.md | #tec-1 ~ #tec-4 | tec-1-科技系统概述 等 | ❌ |
| TRD-trade-prd.md | #trd-1 ~ #trd-3 | trd-1-贸易路线 等 | ❌ |
| TUT-tutorial-prd.md | #tut-1 ~ #tut-4 | tut-1-引导流程 等 | ❌ |
| SPEC-animation.md | #ani-1 ~ #ani-5 | ani-1-动画类型 等 | ❌ |
| SPEC-currency.md | #cur-1 ~ #cur-4 | cur-1-货币类型 等 | ❌ |
| SPEC-interaction.md | #itr-1 ~ #itr-5 | itr-1-通用交互 等 | ❌ |
| SPEC-offline.md | #ofr-1 ~ #ofr-4 | ofr-1-离线计算 等 | ❌ |
| SPEC-responsive.md | #rsp-1 ~ #rsp-4 | rsp-1-断点定义 等 | ❌ |

---

## 3. 需求编号对比

### 3.1 UI INDEX 需求编号（98 个）

UI-Layout INDEX.md 定义了 98 个需求编号，涵盖 23 个模块（SPEC 无编号）。

### 3.2 PRD INDEX 需求编号（25 个）

PRD INDEX.md 仅列出了 25 个顶层模块编号（每个模块仅列 `-1`），且使用了不同的模块代码。

### 3.3 差异分析

**仅 UI INDEX 有的编号（87 个）**：
这些主要是二级和三级子编号（如 `NAV-1-1`, `CBT-2-1`, `HER-4-2` 等），UI INDEX 详细列出了层级结构，PRD INDEX 仅列出顶层。

**仅 PRD INDEX 有的编号（14 个）**：
PRD INDEX 列出了尚未创建对应文档的模块：
- `ACH-1` (成就)、`BAG-1` (背包)、`CHK-1` (签到)、`FRD-1` (好友)
- `GDE-1` (图鉴)、`GLD-1` (公会)、`HLP-1` (帮助)、`PRE-1` (公告)
- `RNK-1` (排行榜)、`RPT-1` (战报)、`RSP-1` (声望/转生)
- `SHO-1` (商店)、`TSK-1` (任务)、`VIP-1` (VIP)

> ⚠️ PRD INDEX 中部分模块代码与 UI INDEX 不一致：
> - PRD: `SHO` vs UI: `SHP`（商店）
> - PRD: `TSK` vs UI: `QST`（任务）
> - PRD: `EVT` (PRD INDEX) vs UI INDEX `ACT`（活动）
> - PRD: `RSP` (声望/转生) vs UI: `PRS`

---

## 4. 功能覆盖矩阵

### 4.1 主模块覆盖（22 个 UI 模块 vs 21 个 PRD 模块）

| # | 模块代码 | 模块名 | UI-Layout | PRD | 双向引用 | 状态 |
|---|:---:|---|:---:|:---:|:---:|:---:|
| 1 | ACT | 活动系统 | ✅ ACT-activities.md | ✅ ACT-activities-prd.md | ✅ 双向 | ✅ |
| 2 | BLD | 建筑系统 | ✅ BLD-buildings.md | ✅ BLD-buildings-prd.md | ✅ 双向 | ✅ |
| 3 | CBT | 战斗系统 | ✅ CBT-combat.md | ✅ CBT-combat-prd.md | ✅ 双向 | ✅ |
| 4 | EQP | 装备系统 | ✅ EQP-equipment.md | ✅ EQP-equipment-prd.md | ✅ 双向 | ✅ |
| 5 | EVT | 事件系统 | ✅ EVT-events.md | ✅ EVT-events-prd.md | ✅ 双向 | ✅ |
| 6 | EXP | 远征系统 | ✅ EXP-expedition.md | ✅ EXP-expedition-prd.md | ✅ 双向 | ✅ |
| 7 | HER | 武将系统 | ✅ HER-heroes.md | ✅ HER-heroes-prd.md | ✅ 双向 | ✅ |
| 8 | MAL | 邮件系统 | ✅ MAL-mail.md | ✅ MAL-mail-prd.md | ✅ 双向 | ✅ |
| 9 | MAP | 世界地图 | ✅ MAP-world.md | ✅ MAP-world-prd.md | ✅ 双向 | ✅ |
| 10 | NAV | 全局导航 | ✅ NAV-main.md | ✅ NAV-main-prd.md | ✅ 双向 | ✅ |
| 11 | NPC | NPC系统 | ✅ NPC-npc.md | ✅ NPC-npc-prd.md | ✅ 双向 | ✅ |
| 12 | OFR | 离线收益 | ✅ OFR-offline.md | ⚠️ SPEC-offline.md | ✅ 单向引用 | ⚠️ |
| 13 | PRS | 声望系统 | ✅ PRS-prestige.md | ✅ PRS-prestige-prd.md | ✅ 双向 | ✅ |
| 14 | PVP | PVP竞技 | ✅ PVP-arena.md | ✅ PVP-arena-prd.md | ✅ 双向 | ✅ |
| 15 | QST | 任务系统 | ✅ QST-quests.md | ✅ QST-quests-prd.md | ✅ 双向 | ✅ |
| 16 | RES | 资源系统 | ✅ RES-resources.md | ✅ RES-resources-prd.md | ✅ 双向 | ✅ |
| 17 | SET | 设置系统 | ✅ SET-settings.md | ✅ SET-settings-prd.md | ✅ 双向 | ✅ |
| 18 | SHP | 商店系统 | ✅ SHP-shop.md | ✅ SHP-shop-prd.md | ✅ 双向 | ✅ |
| 19 | SOC | 社交系统 | ✅ SOC-social.md | ✅ SOC-social-prd.md | ✅ 双向 | ✅ |
| 20 | TEC | 科技系统 | ✅ TEC-tech.md | ✅ TEC-tech-prd.md | ✅ 双向 | ✅ |
| 21 | TRD | 贸易路线 | ✅ TRD-trade.md | ✅ TRD-trade-prd.md | ✅ 双向 | ✅ |
| 22 | TUT | 引导系统 | ✅ TUT-tutorial.md | ✅ TUT-tutorial-prd.md | ✅ 双向 | ✅ |
| - | SPEC | 全局规范 | ✅ SPEC-global.md | ✅ 5个SPEC文件 | ⚠️ 部分 | ⚠️ |

### 4.2 SPEC 规范覆盖

| PRD SPEC 文件 | UI 引用 PRD | PRD 引用 UI | 状态 |
|---|:---:|:---:|:---:|
| SPEC-interaction.md | ✅ | ✅ | ✅ |
| SPEC-animation.md | ❌ | ✅ | ⚠️ |
| SPEC-currency.md | ❌ | ❌ | ❌ |
| SPEC-offline.md | ❌ | ❌ | ❌ |
| SPEC-responsive.md | ❌ | ❌ | ❌ |

> SPEC-global.md 仅引用了 SPEC-interaction.md，但 PRD 有 5 个 SPEC 文件。SPEC-currency、SPEC-offline、SPEC-responsive 未被 SPEC-global.md 引用（它们被各自的关联模块引用，如 OFR-offline.md → SPEC-offline.md）。

### 4.3 PRD INDEX 中规划但未创建的模块

PRD INDEX 列出了以下模块标记为"→ 待创建"，无对应文档：

| PRD 规划模块 | 代码 | 对应 UI 是否存在 |
|---|:---:|:---:|
| 声望/转生 | RSP | ✅ (PRS-prestige.md) |
| 装备 | EQP | ✅ |
| 远征 | EXP | ✅ |
| 商店 | SHO | ✅ (SHP-shop.md) |
| 任务 | TSK | ✅ (QST-quests.md) |
| 活动 | EVT | ✅ (ACT-activities.md) |
| 邮件 | ML | ✅ (MAL-mail.md) |
| 背包 | BAG | ❌ |
| 好友 | FRD | ❌ (部分在 SOC) |
| 公会 | GLD | ❌ |
| 排行榜 | RNK | ❌ (部分在 SOC) |
| 战报 | RPT | ❌ |
| 图鉴 | GDE | ❌ |
| 帮助 | HLP | ❌ (部分在 TUT) |
| 设置 | SET | ✅ |
| 公告 | PRE | ❌ |
| VIP | VIP | ❌ |
| 签到 | CHK | ❌ (部分在 ACT) |
| 成就 | ACH | ❌ |

---

## 5. 问题汇总

### P0 - 链接断裂

> 无。所有 152 + 93 = 245 条文件引用均指向已存在的文件。

### P1 - 锚点不匹配

| # | 问题 | 影响范围 | 严重程度 |
|---|---|---|:---:|
| P1-1 | **PRD→UI 锚点全部不匹配**：PRD 使用 `#xxx-N` 简短锚点，但 UI 文件标题含中文后缀，GitHub 生成的锚点为 `#xxx-N-中文描述`，72 条锚点引用无法精确跳转 | 全部 26 个 PRD 文件 | 🔴 P1 |
| P1-2 | **UI→PRD 锚点部分不匹配**：UI 使用 `#xxx-N` 引用 PRD，PRD 标题也含中文后缀，131 条锚点引用中大部分无法精确跳转 | 全部 22 个 UI 模块 | 🔴 P1 |
| P1-3 | **CBT 模块锚点格式不一致**：CBT-combat.md 使用中文标题锚点（如 `#一战役地图出征tab场景`），与其他模块的 `#xxx-N` 格式不统一 | CBT-combat.md | 🟡 P1 |
| P1-4 | **HER-heroes-prd.md 使用英文锚点**：如 `#hero-list`, `#hero-detail`, `#recruit` 等，与 UI 文件的中文标题完全不匹配 | HER-heroes-prd.md | 🟡 P1 |
| P1-5 | **MAP-world-prd.md 使用英文锚点**：如 `#map-overview`, `#filter-bar` 等 | MAP-world-prd.md | 🟡 P1 |
| P1-6 | **NAV-main-prd.md 使用英文锚点**：如 `#top-resource-bar`, `#nav-tab-bar` 等 | NAV-main-prd.md | 🟡 P1 |

### P2 - 覆盖缺失

| # | 问题 | 详情 | 严重程度 |
|---|---|---|:---:|
| P2-1 | **OFR 模块无独立 PRD 文件** | OFR-offline.md 引用 SPEC-offline.md 而非 OFR-offline-prd.md，模块命名不一致 | 🟡 P2 |
| P2-2 | **SPEC-global.md 未覆盖全部 SPEC PRD** | SPEC-animation、SPEC-currency、SPEC-offline、SPEC-responsive 未被 SPEC-global.md 引用 | 🟡 P2 |
| P2-3 | **PRD INDEX 模块代码不一致** | SHO/SHP、TSK/QST、RSP/PRS 等模块代码在两个 INDEX 中不统一 | 🟡 P2 |
| P2-4 | **PRD INDEX 列出 19 个未创建模块** | BAG、GLD、VIP 等模块在 PRD INDEX 中标记为"→ 待创建" | 🟢 P2 |
| P2-5 | **UI INDEX 中 SPEC 模块无需求编号范围** | SPEC 列为 `SPEC-1 ~ SPEC-8` 但实际无编号定义 | 🟢 P2 |
| P2-6 | **SPEC-interaction.md 被 UI 引用了 itr-6 和 itr-7** | 但实际只有 ITR-1 ~ ITR-5 五个章节 | 🟡 P2 |

---

## 6. 修复建议

### 6.1 锚点修复（P1-1, P1-2）— 优先级最高

**方案 A（推荐）**：在所有文件中使用 `{#anchor}` 显式锚点

在 PRD 和 UI-Layout 文件的标题后添加自定义锚点：
```markdown
## [BLD-1] 建筑类型 {#bld-1}
## [BLD-2] 升级数据 {#bld-2}
```

这样 `#bld-1` 就能精确匹配，不受中文标题影响。

**方案 B**：修改所有引用链接，使用完整的 GitHub 生成锚点

将 `#bld-1` 改为 `#bld-1-建筑类型`，但这种方式可读性差且脆弱。

### 6.2 格式统一（P1-3, P1-4, P1-5, P1-6）

- CBT-combat.md 的锚点统一为 `#cbt-N` 格式
- HER-heroes-prd.md 的锚点统一为 `#her-N` 格式
- MAP-world-prd.md 的锚点统一为 `#map-N` 格式
- NAV-main-prd.md 的锚点统一为 `#nav-N` 格式

### 6.3 覆盖补全（P2）

- SPEC-global.md 添加对 SPEC-animation、SPEC-currency、SPEC-offline、SPEC-responsive 的引用
- 统一 PRD INDEX 和 UI INDEX 的模块代码命名
- OFR-offline.md 考虑是否需要独立 PRD 文件

---

## 7. 验证统计总览

| 指标 | 数值 | 状态 |
|---|:---:|:---:|
| UI→PRD 文件引用 | 27 个唯一路径 | ✅ 全部存在 |
| PRD→UI 文件引用 | 21 个唯一路径 | ✅ 全部存在 |
| UI→PRD 总链接数 | 152 条 | ✅ |
| PRD→UI 总链接数 | 93 条 | ✅ |
| UI→PRD 锚点匹配 | 131 条带锚点 | ⚠️ 前缀匹配 |
| PRD→UI 锚点匹配 | 72 条带锚点 | ❌ 全部不匹配 |
| 模块覆盖 | 22/22 UI ↔ 21+5 PRD | ⚠️ OFR 特殊 |
| 双向引用完整性 | 21/22 完整 | ⚠️ OFR 单向 |
| 文件断裂链接 | 0 条 | ✅ |

---

## 总评: 6.5/10

**评分理由**：
- ✅ **文件引用完整性优秀**（+3分）：245 条文件引用零断裂，所有模块双向覆盖
- ✅ **文档结构规范**（+2分）：统一的命名规则、INDEX 索引、引用格式
- ✅ **引用密度高**（+1.5分）：平均每个模块 6-7 条交叉引用，覆盖充分
- ❌ **锚点系统严重缺陷**（-2.5分）：72 条 PRD→UI 锚点全部无法精确跳转，131 条 UI→PRD 锚点依赖前缀匹配，严重影响文档间导航的可用性
- ⚠️ **命名不一致**（-0.5分）：PRD INDEX 与 UI INDEX 模块代码不统一（SHO/SHP 等）

> **核心问题**：两套文档的锚点引用机制完全失效。虽然文件级别的引用正确无误，但章节级别的精确跳转无法工作。建议优先采用 `{#anchor}` 显式锚点方案修复。
