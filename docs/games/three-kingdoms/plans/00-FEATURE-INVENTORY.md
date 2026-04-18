# 三国霸业 — 功能清单总览（Feature Inventory）

> **版本**: v1.0 | **日期**: 2026-04-21
> **用途**: 为 v1.0~v20.0 版本计划制定提供完整的功能模块清单和拆分依据
> **数据来源**: UI布局 25模块文件 + PRD 27文档 + 源码 38 TS文件 + v1.0~v10.0 版本计划

---

## 一、模块总览（23个功能模块 + 5个规范模块）

### 1.1 功能模块清单

| # | 代码 | 模块名 | UI布局文件 | PRD文件 | UI功能点 | PRD需求编号范围 | 复杂度 |
|---|------|--------|-----------|---------|:-------:|----------------|:------:|
| 1 | NAV | 主界面导航 | NAV-main.md | NAV-main-prd.md | 12 | NAV-1~5 | ★★ |
| 2 | MAP | 世界地图 | MAP-world.md | MAP-world-prd.md | 6 | MAP-1~3 | ★★★★ |
| 3 | CBT | 战斗系统 | CBT-combat.md | CBT-combat-prd.md | 28 | CBT-1~8 | ★★★★★ |
| 4 | HER | 武将系统 | HER-heroes.md | HER-heroes-prd.md | 28 | HER-1~6 | ★★★★★ |
| 5 | TEC | 科技系统 | TEC-tech.md | TEC-tech-prd.md | 7 | TEC-1~4 | ★★★ |
| 6 | BLD | 建筑系统 | BLD-buildings.md | BLD-buildings-prd.md | 7 | BLD-1~5 | ★★★ |
| 7 | PRS | 声望系统 | PRS-prestige.md | PRS-prestige-prd.md | 6 | PRS-1~4 | ★★★ |
| 8 | RES | 资源系统 | RES-resources.md | RES-resources-prd.md | 8 | RES-1~4 | ★★ |
| 9 | NPC | NPC系统 | NPC-npc.md | NPC-npc-prd.md | 8 | NPC-1~4 | ★★★★ |
| 10 | EVT | 事件系统 | EVT-events.md | EVT-events-prd.md | 9 | EVT-1~4 | ★★★ |
| 11 | QST | 任务系统 | QST-quests.md | QST-quests-prd.md | 7 | QST-1~4 | ★★ |
| 12 | ACT | 活动系统 | ACT-activities.md | ACT-activities-prd.md | 5 | ACT-1~4 | ★★ |
| 13 | MAL | 邮件系统 | MAL-mail.md | MAL-mail-prd.md | 6 | MAL-1~3 | ★★ |
| 14 | SHP | 商店系统 | SHP-shop.md | SHP-shop-prd.md | 7 | SHP-1~4 | ★★★ |
| 15 | EQP | 装备系统 | EQP-equipment.md | EQP-equipment-prd.md | 9 | EQP-1~5 | ★★★★ |
| 16 | EXP | 远征系统 | EXP-expedition.md | EXP-expedition-prd.md | 6 | EXP-1~4 | ★★★ |
| 17 | SOC | 社交系统 | SOC-social.md | SOC-social-prd.md | 4 | SOC-1~3 | ★★★ |
| 18 | PVP | PVP竞技 | PVP-arena.md | PVP-arena-prd.md | 5 | PVP-1~5 | ★★★★ |
| 19 | TRD | 贸易路线 | TRD-trade.md | TRD-trade-prd.md | 4 | TRD-1~3 | ★★ |
| 20 | SET | 设置系统 | SET-settings.md | SET-settings-prd.md | 8 | SET-1~4 | ★★ |
| 21 | TUT | 引导系统 | TUT-tutorial.md | TUT-tutorial-prd.md | 7 | TUT-1~3 | ★★★ |
| 22 | OFR | 离线收益 | OFR-offline.md | SPEC-offline.md | 6 | OFR-1~3 | ★★ |
| 23 | SPEC | 全局规范 | SPEC-global.md | — | 7 | — | ★★ |
| — | — | **合计** | — | — | **204** | — | — |

### 1.2 规范模块清单（PRD侧拆分）

| # | 代码 | 规范名 | PRD文件 | UI布局文件 | 需求编号 |
|---|------|--------|---------|-----------|---------|
| 24 | ITR | 交互规范 | SPEC-interaction.md | SPEC-global.md | ITR-1~5 |
| 25 | RSP | 响应式规范 | SPEC-responsive.md | SPEC-global.md | RSP-1~3 |
| 26 | ANI | 动画规范 | SPEC-animation.md | SPEC-global.md | ANI-1~4 |
| 27 | CUR | 货币规范 | SPEC-currency.md | RES-resources.md | CUR-1~4 |
| 28 | OFR | 离线收益规范 | SPEC-offline.md | OFR-offline.md | OFR-1~3 |

---

## 二、功能点详细分布

### 2.1 按复杂度分层

| 层级 | 复杂度 | 模块 | 功能点合计 | 占比 |
|------|:------:|------|:---------:|:----:|
| S级 | ★★★★★ | CBT(28) + HER(28) | 56 | 27.5% |
| A级 | ★★★★ | MAP(6) + NPC(8) + EQP(9) + PVP(5) | 28 | 13.7% |
| B级 | ★★★ | TEC(7) + BLD(7) + PRS(6) + EVT(9) + SHP(7) + EXP(6) + SOC(4) + TUT(7) | 53 | 26.0% |
| C级 | ★★ | NAV(12) + RES(8) + QST(7) + ACT(5) + MAL(6) + TRD(4) + SET(8) + OFR(6) + SPEC(7) | 63 | 30.9% |
| — | — | **总计** | **204** | **100%** |

### 2.2 按系统分类

| 系统分类 | 包含模块 | 功能点 | 占比 |
|---------|---------|:------:|:----:|
| 🔴 核心基础 | NAV + RES + BLD + SPEC | 34 | 16.7% |
| ⚔️ 战斗体系 | CBT + PVP + EXP | 39 | 19.1% |
| 🧑‍🤝‍🧑 养成体系 | HER + TEC + EQP + PRS | 50 | 24.5% |
| 🌍 世界探索 | MAP + NPC + EVT | 23 | 11.3% |
| 💰 经济体系 | SHP + TRD + OFR + CUR | 24 | 11.8% |
| 🤝 社交体系 | SOC + QST + ACT + MAL | 22 | 10.8% |
| ⚙️ 辅助系统 | SET + TUT + ITR + RSP + ANI | 22 | 10.8% |

---

## 三、现有 v1.0~v10.0 版本覆盖分析

### 3.1 版本→模块映射

| 版本 | 代号 | 主模块 | 关联模块 | PRD编号覆盖 | 计划粒度 |
|:----:|------|--------|---------|------------|:--------:|
| v1.0 | 基业初立 | RES + BLD | NAV(部分) | RES-1~4, BLD-1~5, NAV-1 | ★★★ 详细 |
| v2.0 | 招贤纳士 | HER | — | HER-1~6 | ★★★ 详细 |
| v3.0 | 攻城略地 | CBT | — | CBT-1~8 | ★★★ 详细 |
| v4.0 | 百家争鸣 | TEC | — | TEC-1~4 | ★☆☆ 简略 |
| v5.0 | 天下大势 | MAP + NPC | — | MAP-1~3, NPC-1~4 | ★★★ 详细 |
| v6.0 | 商贸繁荣 | SHP + TRD + OFR + MAL | CUR | SHP-1~4, TRD-1~3, OFR-1~3, MAL-1~3, CUR-1~4 | ★★☆ 中等 |
| v7.0 | 群雄逐鹿 | PVP + SOC + EXP | — | PVP-1~5, SOC-1~3, EXP-1~4 | ★☆☆ 简略 |
| v8.0 | 兵强马壮 | EQP | — | EQP-1~5 | ★☆☆ 简略 |
| v9.0 | 千秋万代 | PRS + EVT + QST + ACT | — | PRS-1~4, EVT-1~4, QST-1~4, ACT-1~4 | ★☆☆ 简略 |
| v10.0 | 天下一统 | TUT + SET + ANI | 全系统验收 | TUT-1~3, SET-1~4, ANI-1~4 | ★★☆ 中等 |

### 3.2 版本覆盖矩阵

| 模块 | v1.0 | v2.0 | v3.0 | v4.0 | v5.0 | v6.0 | v7.0 | v8.0 | v9.0 | v10.0 |
|------|:----:|:----:|:----:|:----:|:----:|:----:|:----:|:----:|:----:|:-----:|
| NAV  | ◐    |      |      |      |      |      |      |      |      |       |
| MAP  |      |      |      |      | ●    |      |      |      |      |       |
| CBT  |      |      | ●    |      |      |      |      |      |      |       |
| HER  |      | ●    |      |      |      |      |      |      |      |       |
| TEC  |      |      |      | ●    |      |      |      |      |      |       |
| BLD  | ●    |      |      |      |      |      |      |      |      |       |
| PRS  |      |      |      |      |      |      |      |      | ●    |       |
| RES  | ●    |      |      |      |      |      |      |      |      |       |
| NPC  |      |      |      |      | ●    |      |      |      |      |       |
| EVT  |      |      |      |      |      |      |      |      | ●    |       |
| QST  |      |      |      |      |      |      |      |      | ●    |       |
| ACT  |      |      |      |      |      |      |      |      | ●    |       |
| MAL  |      |      |      |      |      | ●    |      |      |      |       |
| SHP  |      |      |      |      |      | ●    |      |      |      |       |
| EQP  |      |      |      |      |      |      |      | ●    |      |       |
| EXP  |      |      |      |      |      |      | ●    |      |      |       |
| SOC  |      |      |      |      |      |      | ●    |      |      |       |
| PVP  |      |      |      |      |      |      | ●    |      |      |       |
| TRD  |      |      |      |      |      | ●    |      |      |      |       |
| SET  |      |      |      |      |      |      |      |      |      | ●     |
| TUT  |      |      |      |      |      |      |      |      |      | ●     |
| OFR  |      |      |      |      |      | ●    |      |      |      |       |
| SPEC | ◐    |      |      |      |      |      |      |      |      |       |
| ITR  |      |      |      |      |      |      |      |      |      |       |
| RSP  |      |      |      |      |      |      |      |      |      |       |
| ANI  |      |      |      |      |      |      |      |      |      | ●     |
| CUR  |      |      |      |      |      | ●    |      |      |      |       |

> ● = 完整覆盖 | ◐ = 部分覆盖 | 空白 = 未覆盖

### 3.3 未被任何版本覆盖的模块

| 模块 | 说明 |
|------|------|
| NAV（完整） | v1.0仅覆盖资源栏+Tab切换，导航路径(NAV-4)、更多菜单(NAV-2)、手机端(NAV-3)未覆盖 |
| SPEC（完整） | 仅v1.0部分涉及全局配色，ITR/RSP/ANI/CUR规范未独立覆盖 |
| ITR 交互规范 | 无独立版本覆盖，需在各版本中逐步落实 |
| RSP 响应式规范 | 无独立版本覆盖，手机端布局在各模块中提及但未统一落实 |

---

## 四、源码实现状态分析

### 4.1 已有源码模块（38个TS文件）

| 源码文件 | 对应模块 | 子系统分类 | 实现程度 |
|---------|---------|-----------|:--------:|
| **ThreeKingdomsEngine.ts** | 全局 | 核心引擎 | ✅ 核心 |
| **constants.ts** | RES+BLD | 数据定义 | ✅ 完整 |
| **GeneralData.ts** | HER | 武将数据 | ✅ 完整 |
| **PortraitConfig.ts** | HER | 武将画像配置 | ✅ 完整 |
| **AssetConfig.ts** | SPEC | 资源配置 | ✅ 完整 |
| **CampaignSystem.ts** | CBT | 关卡系统 | ✅ 完整 |
| **CampaignBattleSystem.ts** | CBT | 战斗计算 | ✅ 完整 |
| **ThreeKingdomsCampaign.ts** | CBT | 战役逻辑 | ✅ 完整 |
| **ThreeKingdomsCampaignManager.ts** | CBT | 战役管理 | ✅ 完整 |
| **BattleChallengeSystem.ts** | CBT/PVP | 战斗挑战 | ✅ 完整 |
| **BattleEnhancement.ts** | CBT | 战斗增强 | ✅ 完整 |
| **BattleStrategy.ts** | CBT | 战斗策略 | ✅ 完整 |
| **NPCSystem.ts** | NPC | NPC核心 | ✅ 完整 |
| **NPCActivitySystem.ts** | NPC | NPC活动 | ✅ 完整 |
| **NPCInteractionSystem.ts** | NPC | NPC交互 | ✅ 完整 |
| **NPCNeedSystem.ts** | NPC | NPC需求 | ✅ 完整 |
| **NPCPathFollower.ts** | NPC | NPC巡逻 | ✅ 完整 |
| **ThreeKingdomsNPCDefs.ts** | NPC | NPC定义 | ✅ 完整 |
| **ThreeKingdomsEventSystem.ts** | EVT | 事件系统 | ✅ 完整 |
| **EventEnrichmentSystem.ts** | EVT | 事件增强 | ✅ 完整 |
| **OfflineRewardSystem.ts** | OFR | 离线收益 | ✅ 完整 |
| **TradeRouteSystem.ts** | TRD | 贸易路线 | ✅ 完整 |
| **CityMapSystem.ts** | MAP | 城市地图 | ✅ 完整 |
| **MapGenerator.ts** | MAP | 地图生成 | ✅ 完整 |
| **ResourcePointSystem.ts** | RES | 资源点 | ✅ 完整 |
| **DayNightWeatherSystem.ts** | NAV/SET | 昼夜天气 | ✅ 完整 |
| **WeatherSystem.ts** | SET | 天气系统 | ✅ 完整 |
| **GameCalendarSystem.ts** | NAV | 游戏日历 | ✅ 完整 |
| **GeneralBondSystem.ts** | HER | 武将羁绊 | ✅ 完整 |
| **GeneralDialogueSystem.ts** | HER/NPC | 武将对话 | ✅ 完整 |
| **GeneralStoryEventSystem.ts** | HER/EVT | 武将故事 | ✅ 完整 |
| **GeneralPortraitRenderer.ts** | HER | 武将画像渲染 | ✅ 完整 |
| **QCharacterRenderer.ts** | HER | Q版角色渲染 | ✅ 完整 |
| **ChineseBuildingRenderer.ts** | BLD | 建筑渲染 | ✅ 完整 |
| **ParticleSystem.ts** | SPEC | 粒子特效 | ✅ 完整 |
| **AudioManager.ts** | SET | 音频管理 | ✅ 完整 |
| **TutorialStorySystem.ts** | TUT | 教程故事 | ✅ 完整 |
| **ThreeKingdomsRenderStateAdapter.ts** | NAV | 渲染适配 | ✅ 完整 |

### 4.2 模块→源码映射状态

| 模块 | 引擎源码 | UI组件 | 数据定义 | 测试覆盖 | 整体状态 |
|------|:--------:|:------:|:--------:|:--------:|:--------:|
| NAV | ✅ Engine+Adapter+Calendar | ✅ 已有 | ✅ constants | ✅ | 🟢 已实现 |
| MAP | ✅ CityMap+MapGenerator | ⚠️ 静态 | ✅ constants | ✅ | 🟡 引擎有/UI弱 |
| CBT | ✅ Campaign*4+Battle*3 | ⚠️ 基础 | ✅ constants | ✅ | 🟡 引擎有/UI弱 |
| HER | ✅ General*5+Portrait*2 | ✅ 已有 | ✅ GeneralData | ✅ | 🟢 已实现 |
| TEC | ⚠️ 引擎内置 | ⚠️ 基础 | ✅ constants | ❌ | 🟡 引擎弱/无测试 |
| BLD | ⚠️ 引擎内置 | ✅ 已有 | ✅ constants | ❌ | 🟡 引擎弱/无测试 |
| PRS | ❌ 无 | ❌ 无 | ❌ 无 | ❌ | 🔴 未实现 |
| RES | ✅ ResourcePoint | ✅ 已有 | ✅ constants | ✅ | 🟢 已实现 |
| NPC | ✅ NPC*5+NPCDefs | ⚠️ 基础 | ✅ NPCDefs | ✅ | 🟢 引擎完整 |
| EVT | ✅ Event*2 | ⚠️ 基础 | ✅ 内置 | ✅ | 🟡 引擎有/UI弱 |
| QST | ❌ 无 | ❌ 无 | ❌ 无 | ❌ | 🔴 未实现 |
| ACT | ❌ 无 | ❌ 无 | ❌ 无 | ❌ | 🔴 未实现 |
| MAL | ❌ 无 | ❌ 无 | ❌ 无 | ❌ | 🔴 未实现 |
| SHP | ❌ 无 | ❌ 无 | ❌ 无 | ❌ | 🔴 未实现 |
| EQP | ❌ 无 | ❌ 无 | ❌ 无 | ❌ | 🔴 未实现 |
| EXP | ❌ 无 | ❌ 无 | ❌ 无 | ❌ | 🔴 未实现 |
| SOC | ❌ 无 | ❌ 无 | ❌ 无 | ❌ | 🔴 未实现 |
| PVP | ⚠️ BattleChallenge复用 | ❌ 无 | ❌ 无 | ✅ | 🔴 未实现 |
| TRD | ✅ TradeRouteSystem | ❌ 无 | ✅ 内置 | ❌ | 🟡 引擎有/UI无 |
| SET | ✅ AudioManager+Weather | ⚠️ 基础 | ✅ 内置 | ✅ | 🟡 引擎有/UI弱 |
| TUT | ✅ TutorialStorySystem | ❌ 无 | ✅ 内置 | ✅ | 🟡 引擎有/UI无 |
| OFR | ✅ OfflineRewardSystem | ❌ 无 | ✅ 内置 | ✅ | 🟡 引擎有/UI无 |
| SPEC | ✅ Particle+Asset | ✅ 已有 | ✅ AssetConfig | ✅ | 🟢 已实现 |

### 4.3 实现状态汇总

| 状态 | 模块数量 | 模块列表 |
|:----:|:-------:|---------|
| 🟢 已实现（引擎+UI） | 3 | NAV, HER, RES |
| 🟡 引擎有/UI弱 | 8 | MAP, CBT, TEC, BLD, NPC, EVT, SET, TRD |
| 🟡 引擎有/UI无 | 3 | TUT, OFR, PVP(部分) |
| 🔴 未实现 | 9 | PRS, QST, ACT, MAL, SHP, EQP, EXP, SOC, PVP(完整) |

---

## 五、20版本拆分建议

### 5.1 拆分原则

1. **MVP优先**: 每个版本交付可独立运行的核心循环
2. **依赖前置**: 被依赖的模块必须先实现
3. **价值驱动**: 高玩家价值模块优先
4. **粒度均衡**: 每个版本 3~5 个迭代轮，功能点 15~30 个
5. **合并同类**: 低复杂度模块可合并到一个版本
6. **拆分巨型**: S级模块(HER/CBT)需拆分到多个版本

### 5.2 模块依赖关系

```
SPEC/NAV/RES/BLD (基础框架)
    ↓
HER (武将养成) ← RES依赖
    ↓
CBT (战斗系统) ← HER依赖
    ↓
TEC (科技树) ← RES依赖
    ↓
MAP + NPC (世界探索) ← CBT依赖(征服战斗)
    ↓
SHP + TRD + OFR + MAL (经济体系) ← RES依赖
    ↓
PVP + SOC + EXP (社交竞技) ← CBT+HER依赖
    ↓
EQP (装备系统) ← HER依赖
    ↓
PRS + EVT + QST + ACT (转生成就) ← 全系统依赖
    ↓
TUT + SET + 全局规范 (终极打磨) ← 全系统依赖
```

### 5.3 建议的 20 版本拆分方案

#### Phase 1: 核心框架（v1.0 ~ v4.0）

| 版本 | 代号 | 核心模块 | 关键交付 | 功能点 | 复杂度 |
|:----:|------|---------|---------|:------:|:------:|
| v1.0 | 基业初立 | RES + BLD + NAV(核心) + SPEC(基础) | 4资源产出+8建筑升级+主界面框架 | ~25 | ★★ |
| v2.0 | 招贤纳士 | HER(招募+列表+详情) | 武将招募/查看/升级/派遣 | ~18 | ★★★ |
| v3.0 | 攻城略地 | CBT(关卡+自动战斗) | 关卡地图+自动战斗+战利品 | ~20 | ★★★★ |
| v4.0 | 百家争鸣 | TEC + HER(突破升星) | 科技树3路线+武将突破 | ~14 | ★★★ |

#### Phase 2: 世界探索（v5.0 ~ v7.0）

| 版本 | 代号 | 核心模块 | 关键交付 | 功能点 | 复杂度 |
|:----:|------|---------|---------|:------:|:------:|
| v5.0 | 天下大势 | MAP + NPC(基础) | 世界地图+领土征服+NPC展示 | ~20 | ★★★★ |
| v6.0 | 群英荟萃 | NPC(交互深化) + EVT(基础) | NPC对话/任务/交易+随机事件 | ~18 | ★★★ |
| v7.0 | 攻防之道 | CBT(深化) + MAP(深化) | 战前布阵+战斗动画+领土驻防 | ~16 | ★★★★ |

#### Phase 3: 经济体系（v8.0 ~ v10.0）

| 版本 | 代号 | 核心模块 | 关键交付 | 功能点 | 复杂度 |
|:----:|------|---------|---------|:------:|:------:|
| v8.0 | 商贸繁荣 | SHP + TRD + CUR | 商店+贸易路线+货币体系 | ~15 | ★★★ |
| v9.0 | 离线经营 | OFR + MAL + SET(基础) | 离线收益+邮件+基础设置 | ~18 | ★★ |
| v10.0 | 兵强马壮 | EQP + HER(装备联动) | 装备系统+武将装备栏+铁匠铺 | ~16 | ★★★★ |

#### Phase 4: 社交竞技（v11.0 ~ v13.0）

| 版本 | 代号 | 核心模块 | 关键交付 | 功能点 | 复杂度 |
|:----:|------|---------|---------|:------:|:------:|
| v11.0 | 群雄逐鹿 | PVP(竞技场) + SOC(好友+聊天) | PvP竞技+好友系统+聊天 | ~14 | ★★★★ |
| v12.0 | 征途万里 | EXP + SOC(排行榜+联盟) | 远征系统+排行榜+联盟 | ~14 | ★★★ |
| v13.0 | 赛季争锋 | PVP(赛季) + ACT(基础) | 赛季竞技+限时活动 | ~12 | ★★★ |

#### Phase 5: 长线养成（v14.0 ~ v16.0）

| 版本 | 代号 | 核心模块 | 关键交付 | 功能点 | 复杂度 |
|:----:|------|---------|---------|:------:|:------:|
| v14.0 | 千秋万代 | PRS + QST | 声望转生+任务系统 | ~14 | ★★★ |
| v15.0 | 天命所归 | EVT(深化) + ACT(深化) | 剧情事件+活动系统+签到 | ~14 | ★★★ |
| v16.0 | 传承之道 | PRS(深化) + EQP(套装+强化) | 转生加成+装备强化+套装 | ~14 | ★★★ |

#### Phase 6: 体验优化（v17.0 ~ v20.0）

| 版本 | 代号 | 核心模块 | 关键交付 | 功能点 | 复杂度 |
|:----:|------|---------|---------|:------:|:------:|
| v17.0 | 新手引路 | TUT + NAV(手机端) | 完整新手引导+手机端适配 | ~16 | ★★★ |
| v18.0 | 精雕细琢 | SPEC(深化) + ITR + RSP + ANI | 全局规范落实+响应式+动画 | ~18 | ★★ |
| v19.0 | 天下一统 | SET(完整) + 全系统平衡性 | 设置完善+数值平衡+全系统联动 | ~14 | ★★ |
| v20.0 | 终极验收 | 全模块 | 全功能验收+性能优化+Bug修复 | ~10 | ★★ |

### 5.4 与现有10版本计划的对比

| 维度 | v1.0~v10.0 (现有) | v1.0~v20.0 (建议) |
|------|:-----------------:|:-----------------:|
| 版本数量 | 10 | 20 |
| 每版本功能点 | 15~56 | 10~25 |
| 每版本迭代轮 | 5~8轮 | 3~5轮 |
| 总迭代轮数 | 50~80轮 | 60~100轮 |
| 最大单版本复杂度 | ★★★★★(CBT+HER) | ★★★★(拆分后) |
| 模块覆盖完整性 | 4个模块未覆盖 | 全覆盖 |
| 手机端适配 | 分散在各模块 | v17集中+各模块渐进 |
| 规范落实 | 仅v10.0部分 | v18专门版本 |

### 5.5 关键拆分决策说明

#### 拆分决策：HER 武将系统（28功能点 → 3个版本）

| 版本 | 覆盖范围 | 功能点 |
|------|---------|:------:|
| v2.0 招贤纳士 | HER-1~4（招募+列表+详情+升级） | 18 |
| v4.0 百家争鸣 | HER-5（突破升星）+ TEC | 14 |
| v10.0 兵强马壮 | HER-4-3（装备槽）+ EQP | 16 |

> **理由**: 武将系统是最大模块之一，招募和养成是不同阶段的核心体验，拆开后每版本聚焦更清晰。

#### 拆分决策：CBT 战斗系统（28功能点 → 3个版本）

| 版本 | 覆盖范围 | 功能点 |
|------|---------|:------:|
| v3.0 攻城略地 | CBT-1~3（战役长卷+战前布阵基础+自动战斗） | 20 |
| v7.0 攻防之道 | CBT-2(深化)+CBT-3(战斗动画)+CBT-5(扫荡) | 16 |
| v20.0 终极验收 | CBT-6(视觉规范)+CBT-4(手机端) | 10 |

> **理由**: 战斗是核心玩法但实现复杂，先做自动战斗满足核心循环，后续迭代深化战斗表现。

#### 合并决策：经济体系4模块 → 2个版本

| 版本 | 合并模块 | 功能点 |
|------|---------|:------:|
| v8.0 商贸繁荣 | SHP(7) + TRD(4) + CUR(4) | 15 |
| v9.0 离线经营 | OFR(6) + MAL(6) + SET-基础(4) | 16 |

> **理由**: 商店/贸易/货币紧密关联，离线/邮件/设置都是辅助系统，合并减少版本碎片化。

#### 合并决策：转生成就4模块 → 2个版本

| 版本 | 合并模块 | 功能点 |
|------|---------|:------:|
| v14.0 千秋万代 | PRS(6) + QST(7) | 13 |
| v15.0 天命所归 | EVT(9) + ACT(5) | 14 |

> **理由**: 声望转生需要任务系统支撑，事件和活动都是长线内容，分两个版本递进实现。

---

## 六、风险与建议

### 6.1 高风险项

| 风险 | 等级 | 影响版本 | 应对方案 |
|------|:----:|:--------:|---------|
| CBT战斗系统过于复杂 | 🔴 | v3.0, v7.0 | 先实现自动战斗，动画表现延后 |
| MAP地图渲染性能 | 🔴 | v5.0 | 使用离屏Canvas预渲染 |
| HER+EQP联动复杂度 | 🟡 | v10.0 | 武将装备槽预留接口，v2.0提前设计 |
| PRS转生数据重置 | 🟡 | v14.0 | 转生前完整备份，分步重置 |
| 手机端适配工作量 | 🟡 | v17.0 | 各版本预留手机端接口，v17集中适配 |

### 6.2 建议的优先级策略

1. **v1.0~v4.0（Phase 1）**: 必须完成，这是核心游戏循环的基石
2. **v5.0~v7.0（Phase 2）**: 高优先级，扩展游戏深度和广度
3. **v8.0~v10.0（Phase 3）**: 中高优先级，完善经济和养成
4. **v11.0~v13.0（Phase 4）**: 中优先级，社交功能增加留存
5. **v14.0~v16.0（Phase 5）**: 中低优先级，长线内容
6. **v17.0~v20.0（Phase 6）**: 必须完成，体验打磨决定最终品质

### 6.3 与现有计划的兼容性

- **v1.0~v3.0**: 保持不变，已有详细计划
- **v4.0**: 建议补充HER突破升星功能（原计划仅有TEC）
- **v5.0**: 建议拆分NPC深化到v6.0（原计划NPC全量在v5.0）
- **v6.0~v10.0**: 重新排序和拆分，原计划粒度不够
- **v11.0~v20.0**: 全新规划

---

## 七、文档交叉引用

### 7.1 模块→文档完整映射

| 模块代码 | UI布局 | PRD | 版本计划 | 源码文件 |
|---------|--------|-----|---------|---------|
| NAV | NAV-main.md | NAV-main-prd.md | v1.0, v17.0 | ThreeKingdomsEngine, RenderStateAdapter, GameCalendarSystem |
| MAP | MAP-world.md | MAP-world-prd.md | v5.0, v7.0 | CityMapSystem, MapGenerator |
| CBT | CBT-combat.md | CBT-combat-prd.md | v3.0, v7.0 | CampaignSystem, CampaignBattleSystem, Battle*, ThreeKingdomsCampaign* |
| HER | HER-heroes.md | HER-heroes-prd.md | v2.0, v4.0, v10.0 | GeneralData, GeneralBond, GeneralDialogue, GeneralStory, GeneralPortrait, QCharacter |
| TEC | TEC-tech.md | TEC-tech-prd.md | v4.0 | (引擎内置) |
| BLD | BLD-buildings.md | BLD-buildings-prd.md | v1.0 | ChineseBuildingRenderer |
| PRS | PRS-prestige.md | PRS-prestige-prd.md | v14.0, v16.0 | (未实现) |
| RES | RES-resources.md | RES-resources-prd.md | v1.0 | ResourcePointSystem, constants |
| NPC | NPC-npc.md | NPC-npc-prd.md | v5.0, v6.0 | NPCSystem, NPCActivity, NPCInteraction, NPCNeed, NPCPath, NPCDefs |
| EVT | EVT-events.md | EVT-events-prd.md | v6.0, v15.0 | ThreeKingdomsEventSystem, EventEnrichment |
| QST | QST-quests.md | QST-quests-prd.md | v14.0 | (未实现) |
| ACT | ACT-activities.md | ACT-activities-prd.md | v13.0, v15.0 | (未实现) |
| MAL | MAL-mail.md | MAL-mail-prd.md | v9.0 | (未实现) |
| SHP | SHP-shop.md | SHP-shop-prd.md | v8.0 | (未实现) |
| EQP | EQP-equipment.md | EQP-equipment-prd.md | v10.0, v16.0 | (未实现) |
| EXP | EXP-expedition.md | EXP-expedition-prd.md | v12.0 | (未实现) |
| SOC | SOC-social.md | SOC-social-prd.md | v11.0, v12.0 | (未实现) |
| PVP | PVP-arena.md | PVP-arena-prd.md | v11.0, v13.0 | BattleChallengeSystem(可复用) |
| TRD | TRD-trade.md | TRD-trade-prd.md | v8.0 | TradeRouteSystem |
| SET | SET-settings.md | SET-settings-prd.md | v9.0, v19.0 | AudioManager, WeatherSystem |
| TUT | TUT-tutorial.md | TUT-tutorial-prd.md | v17.0 | TutorialStorySystem |
| OFR | OFR-offline.md | SPEC-offline.md | v9.0 | OfflineRewardSystem |
| SPEC | SPEC-global.md | — | v1.0, v18.0 | ParticleSystem, AssetConfig |
| ITR | — | SPEC-interaction.md | v18.0 | — |
| RSP | — | SPEC-responsive.md | v17.0, v18.0 | — |
| ANI | — | SPEC-animation.md | v18.0 | — |
| CUR | — | SPEC-currency.md | v8.0 | constants(部分) |

---

*三国霸业 功能清单总览 v1.0 | 2026-04-21 | 为 v1.0~v20.0 版本计划提供依据*
