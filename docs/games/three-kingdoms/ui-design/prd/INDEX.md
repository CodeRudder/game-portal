# 三国霸业 PRD 文档索引

> **版本**: v2.1 (统一版本) | **日期**: 2026-04-20
> **文档定位**: 玩法设计（PRD）— 仅包含功能描述、数值表、规则逻辑，不含 UI 布局。
> **文档体系**: UI布局 25个模块文件（SPEC合并为1个 SPEC-global.md） | PRD 26个条目（SPEC拆为 ITR/RSP/ANI/CUR/OFR 5个规范文件）

---

## 一、模块索引表

### 核心系统

| # | 模块代码 | 模块名 | PRD文件 | UI布局文件 | 需求编号范围 | 状态 |
|---|---------|--------|---------|-----------|:----------:|:----:|
| 1 | NAV | 主界面导航 | [NAV-main-prd.md](NAV-main-prd.md) | [NAV-main.md](../ui-layout/NAV-main.md) | NAV-1 ~ NAV-5 | ✅ |
| 2 | MAP | 世界地图 | [MAP-world-prd.md](MAP-world-prd.md) | [MAP-world.md](../ui-layout/MAP-world.md) | MAP-1 ~ MAP-3 | ✅ |
| 3 | RES | 资源系统 | [RES-resources-prd.md](RES-resources-prd.md) | [RES-resources.md](../ui-layout/RES-resources.md) | RES-1 ~ RES-4 | ✅ |

### 战斗系统

| # | 模块代码 | 模块名 | PRD文件 | UI布局文件 | 需求编号范围 | 状态 |
|---|---------|--------|---------|-----------|:----------:|:----:|
| 4 | CBT | 战斗系统 | [CBT-combat-prd.md](CBT-combat-prd.md) | [CBT-combat.md](../ui-layout/CBT-combat.md) | CBT-1 ~ CBT-8 | ✅ |
| 5 | PVP | PVP竞技 | [PVP-arena-prd.md](PVP-arena-prd.md) | [PVP-arena.md](../ui-layout/PVP-arena.md) | PVP-1 ~ PVP-5 | ✅ |
| 6 | EXP | 远征系统 | [EXP-expedition-prd.md](EXP-expedition-prd.md) | [EXP-expedition.md](../ui-layout/EXP-expedition.md) | EXP-1 ~ EXP-4 | ✅ |

### 养成系统

| # | 模块代码 | 模块名 | PRD文件 | UI布局文件 | 需求编号范围 | 状态 |
|---|---------|--------|---------|-----------|:----------:|:----:|
| 7 | HER | 武将系统 | [HER-heroes-prd.md](HER-heroes-prd.md) | [HER-heroes.md](../ui-layout/HER-heroes.md) | HER-1 ~ HER-6 | ✅ |
| 8 | TEC | 科技系统 | [TEC-tech-prd.md](TEC-tech-prd.md) | [TEC-tech.md](../ui-layout/TEC-tech.md) | TEC-1 ~ TEC-4 | ✅ |
| 9 | BLD | 建筑系统 | [BLD-buildings-prd.md](BLD-buildings-prd.md) | [BLD-buildings.md](../ui-layout/BLD-buildings.md) | BLD-1 ~ BLD-5 | ✅ |
| 10 | EQP | 装备系统 | [EQP-equipment-prd.md](EQP-equipment-prd.md) | [EQP-equipment.md](../ui-layout/EQP-equipment.md) | EQP-1 ~ EQP-5 | ✅ |
| 11 | PRS | 声望系统 | [PRS-prestige-prd.md](PRS-prestige-prd.md) | [PRS-prestige.md](../ui-layout/PRS-prestige.md) | PRS-1 ~ PRS-4 | ✅ |

### 社交系统

| # | 模块代码 | 模块名 | PRD文件 | UI布局文件 | 需求编号范围 | 状态 |
|---|---------|--------|---------|-----------|:----------:|:----:|
| 12 | SOC | 社交系统 | [SOC-social-prd.md](SOC-social-prd.md) | [SOC-social.md](../ui-layout/SOC-social.md) | SOC-1 ~ SOC-3 | ✅ |
| 13 | TRD | 贸易路线 | [TRD-trade-prd.md](TRD-trade-prd.md) | [TRD-trade.md](../ui-layout/TRD-trade.md) | TRD-1 ~ TRD-3 | ✅ |
| 14 | NPC | NPC系统 | [NPC-npc-prd.md](NPC-npc-prd.md) | [NPC-npc.md](../ui-layout/NPC-npc.md) | NPC-1 ~ NPC-4 | ✅ |

### 辅助系统

| # | 模块代码 | 模块名 | PRD文件 | UI布局文件 | 需求编号范围 | 状态 |
|---|---------|--------|---------|-----------|:----------:|:----:|
| 15 | QST | 任务系统 | [QST-quests-prd.md](QST-quests-prd.md) | [QST-quests.md](../ui-layout/QST-quests.md) | QST-1 ~ QST-4 | ✅ |
| 16 | ACT | 活动系统 | [ACT-activities-prd.md](ACT-activities-prd.md) | [ACT-activities.md](../ui-layout/ACT-activities.md) | ACT-1 ~ ACT-4 | ✅ |
| 17 | EVT | 事件系统 | [EVT-events-prd.md](EVT-events-prd.md) | [EVT-events.md](../ui-layout/EVT-events.md) | EVT-1 ~ EVT-4 | ✅ |
| 18 | MAL | 邮件系统 | [MAL-mail-prd.md](MAL-mail-prd.md) | [MAL-mail.md](../ui-layout/MAL-mail.md) | MAL-1 ~ MAL-3 | ✅ |
| 19 | SHP | 商店系统 | [SHP-shop-prd.md](SHP-shop-prd.md) | [SHP-shop.md](../ui-layout/SHP-shop.md) | SHP-1 ~ SHP-4 | ✅ |
| 20 | SET | 设置系统 | [SET-settings-prd.md](SET-settings-prd.md) | [SET-settings.md](../ui-layout/SET-settings.md) | SET-1 ~ SET-4 | ✅ |
| 21 | TUT | 引导系统 | [TUT-tutorial-prd.md](TUT-tutorial-prd.md) | [TUT-tutorial.md](../ui-layout/TUT-tutorial.md) | TUT-1 ~ TUT-3 | ✅ |

### 全局规范

| # | 模块代码 | 规范名 | PRD/SPEC文件 | UI布局文件 | 需求编号范围 | 状态 |
|---|---------|--------|-------------|-----------|:----------:|:----:|
| 22 | ITR | 交互规范 | [SPEC-interaction.md](SPEC-interaction.md) | [SPEC-global.md](../ui-layout/SPEC-global.md) | ITR-1 ~ ITR-5 | ✅ |
| 23 | RSP | 响应式规范 | [SPEC-responsive.md](SPEC-responsive.md) | [SPEC-global.md](../ui-layout/SPEC-global.md) | RSP-1 ~ RSP-3 | ✅ |
| 24 | ANI | 动画规范 | [SPEC-animation.md](SPEC-animation.md) | [SPEC-global.md](../ui-layout/SPEC-global.md) | ANI-1 ~ ANI-4 | ✅ |
| 25 | CUR | 货币规范 | [SPEC-currency.md](SPEC-currency.md) | [RES-resources.md](../ui-layout/RES-resources.md) | CUR-1 ~ CUR-4 | ✅ |
| 26 | OFR | 离线收益规范 | [SPEC-offline.md](SPEC-offline.md) | [OFR-offline.md](../ui-layout/OFR-offline.md) | OFR-1 ~ OFR-3 | ✅ |

---

## 二、UI布局交叉引用表

| 模块代码 | 模块名 | PRD文件 | UI布局文件 |
|---------|--------|---------|-----------|
| NAV | 主界面导航 | NAV-main-prd.md | [NAV-main.md](../ui-layout/NAV-main.md) |
| MAP | 世界地图 | MAP-world-prd.md | [MAP-world.md](../ui-layout/MAP-world.md) |
| RES | 资源系统 | RES-resources-prd.md | [RES-resources.md](../ui-layout/RES-resources.md) |
| CBT | 战斗系统 | CBT-combat-prd.md | [CBT-combat.md](../ui-layout/CBT-combat.md) |
| PVP | PVP竞技 | PVP-arena-prd.md | [PVP-arena.md](../ui-layout/PVP-arena.md) |
| EXP | 远征系统 | EXP-expedition-prd.md | [EXP-expedition.md](../ui-layout/EXP-expedition.md) |
| HER | 武将系统 | HER-heroes-prd.md | [HER-heroes.md](../ui-layout/HER-heroes.md) |
| TEC | 科技系统 | TEC-tech-prd.md | [TEC-tech.md](../ui-layout/TEC-tech.md) |
| BLD | 建筑系统 | BLD-buildings-prd.md | [BLD-buildings.md](../ui-layout/BLD-buildings.md) |
| EQP | 装备系统 | EQP-equipment-prd.md | [EQP-equipment.md](../ui-layout/EQP-equipment.md) |
| PRS | 声望系统 | PRS-prestige-prd.md | [PRS-prestige.md](../ui-layout/PRS-prestige.md) |
| SOC | 社交系统 | SOC-social-prd.md | [SOC-social.md](../ui-layout/SOC-social.md) |
| TRD | 贸易路线 | TRD-trade-prd.md | [TRD-trade.md](../ui-layout/TRD-trade.md) |
| NPC | NPC系统 | NPC-npc-prd.md | [NPC-npc.md](../ui-layout/NPC-npc.md) |
| QST | 任务系统 | QST-quests-prd.md | [QST-quests.md](../ui-layout/QST-quests.md) |
| ACT | 活动系统 | ACT-activities-prd.md | [ACT-activities.md](../ui-layout/ACT-activities.md) |
| EVT | 事件系统 | EVT-events-prd.md | [EVT-events.md](../ui-layout/EVT-events.md) |
| MAL | 邮件系统 | MAL-mail-prd.md | [MAL-mail.md](../ui-layout/MAL-mail.md) |
| SHP | 商店系统 | SHP-shop-prd.md | [SHP-shop.md](../ui-layout/SHP-shop.md) |
| SET | 设置系统 | SET-settings-prd.md | [SET-settings.md](../ui-layout/SET-settings.md) |
| TUT | 引导系统 | TUT-tutorial-prd.md | [TUT-tutorial.md](../ui-layout/TUT-tutorial.md) |
| OFR | 离线收益 | SPEC-offline.md | [OFR-offline.md](../ui-layout/OFR-offline.md) |
| ITR | 交互规范 | SPEC-interaction.md | [SPEC-global.md](../ui-layout/SPEC-global.md) |
| RSP | 响应式规范 | SPEC-responsive.md | [SPEC-global.md](../ui-layout/SPEC-global.md) |
| ANI | 动画规范 | SPEC-animation.md | [SPEC-global.md](../ui-layout/SPEC-global.md) |
| CUR | 货币规范 | SPEC-currency.md | [RES-resources.md](../ui-layout/RES-resources.md) |
| SPEC | 全局规范 | — | [SPEC-global.md](../ui-layout/SPEC-global.md) |

---

## 三、文档约定

### 需求编号格式
```
[模块代码]-[序号]  例：NAV-1、CBT-3
```

### 跨文档引用
```
> 🎨 → [UI: 主界面导航](../ui-layout/NAV-main.md#nav-1) — UI 布局文档（示例）
> 📖 → [PRD: 关联需求](./NAV-main-prd.md#nav-1)      — PRD 交叉引用（示例）
> 📏 → [SPEC: 规范](./SPEC-xxx.md)                   — 规范文档
```

### 优先级标记
| 标记 | 含义 |
|:----:|------|
| 🔴 P0 | 必须实现，阻塞上线 |
| 🟡 P1 | 重要功能，首版应有 |
| 🟢 P2 | 锦上添花，可延后 |

---

*三国霸业 PRD 索引 v2.1 | 2026-04-20 | 26 模块全覆盖*
