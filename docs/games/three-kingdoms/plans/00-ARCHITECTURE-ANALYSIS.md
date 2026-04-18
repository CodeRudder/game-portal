# 三国霸业 — 架构调研报告

> **日期**: 2025-07-11  
> **源码目录**: `src/games/three-kingdoms/`  
> **UI 组件**: `src/components/idle/ThreeKingdomsPixiGame.tsx`  
> **目的**: 为 4 层架构拆分提供依据

---

## 1. 文件清单（按行数降序）

### 1.1 源文件（39 个，共 22,565 行）

| # | 文件名 | 行数 | 初步分类 |
|---|--------|------|----------|
| 1 | `ThreeKingdomsEngine.ts` | **2,902** | 🧠 引擎核心（God Object） |
| 2 | `CampaignSystem.ts` | **2,616** | ⚔️ 游戏逻辑 |
| 3 | `GeneralPortraitRenderer.ts` | 1,071 | 🎨 渲染层 |
| 4 | `ThreeKingdomsRenderStateAdapter.ts` | 962 | 🔌 适配层 |
| 5 | `MapGenerator.ts` | 867 | 🗺️ 游戏逻辑 |
| 6 | `constants.ts` | 813 | 📋 数据定义 |
| 7 | `AudioManager.ts` | 727 | 🎨 渲染/表现层 |
| 8 | `ThreeKingdomsNPCDefs.ts` | 689 | 📋 数据定义 |
| 9 | `NPCInteractionSystem.ts` | 635 | ⚔️ 游戏逻辑 |
| 10 | `GeneralBondSystem.ts` | 628 | ⚔️ 游戏逻辑 |
| 11 | `GeneralDialogueSystem.ts` | 605 | ⚔️ 游戏逻辑 |
| 12 | `ChineseBuildingRenderer.ts` | 579 | 🎨 渲染层 |
| 13 | `ThreeKingdomsEventSystem.ts` | 547 | ⚔️ 游戏逻辑 |
| 14 | `CampaignBattleSystem.ts` | 547 | ⚔️ 游戏逻辑 |
| 15 | `EventEnrichmentSystem.ts` | 526 | ⚔️ 游戏逻辑 |
| 16 | `GeneralData.ts` | 493 | 📋 数据定义 |
| 17 | `GameCalendarSystem.ts` | 479 | ⚔️ 游戏逻辑 |
| 18 | `NPCActivitySystem.ts` | 465 | ⚔️ 游戏逻辑 |
| 19 | `BattleChallengeSystem.ts` | 451 | ⚔️ 游戏逻辑 |
| 20 | `QCharacterRenderer.ts` | 447 | 🎨 渲染层 |
| 21 | `ParticleSystem.ts` | 439 | 🎨 渲染层 |
| 22 | `NPCPathFollower.ts` | 392 | ⚔️ 游戏逻辑 |
| 23 | `AssetConfig.ts` | 389 | 📋 数据定义 |
| 24 | `WeatherSystem.ts` | 388 | ⚔️ 游戏逻辑 |
| 25 | `NPCSystem.ts` | 371 | ⚔️ 游戏逻辑 |
| 26 | `GeneralStoryEventSystem.ts` | 364 | ⚔️ 游戏逻辑 |
| 27 | `ThreeKingdomsCampaignManager.ts` | 359 | ⚔️ 游戏逻辑 |
| 28 | `ThreeKingdomsCampaign.ts` | 341 | 📋 数据定义 |
| 29 | `BattleStrategy.ts` | 295 | ⚔️ 游戏逻辑 |
| 30 | `NPCNeedSystem.ts` | 293 | ⚔️ 游戏逻辑 |
| 31 | `BattleEnhancement.ts` | 271 | ⚔️ 游戏逻辑 |
| 32 | `DayNightWeatherSystem.ts` | 269 | ⚔️ 游戏逻辑 |
| 33 | `CityMapSystem.ts` | 251 | ⚔️ 游戏逻辑 |
| 34 | `TradeRouteSystem.ts` | 230 | ⚔️ 游戏逻辑 |
| 35 | `OfflineRewardSystem.ts` | 220 | ⚔️ 游戏逻辑 |
| 36 | `TutorialStorySystem.ts` | 212 | ⚔️ 游戏逻辑 |
| 37 | `ResourcePointSystem.ts` | 196 | ⚔️ 游戏逻辑 |
| 38 | `PortraitConfig.ts` | 136 | 📋 数据定义 |
| 39 | `index.ts` | 100 | 🔌 入口/导出 |

### 1.2 UI 组件（外部，共 7,645 行）

| # | 文件名 | 行数 | 说明 |
|---|--------|------|------|
| 1 | `ThreeKingdomsPixiGame.tsx` | **6,077** | 主渲染组件（巨型单文件） |
| 2 | `ThreeKingdomsSVGIcons.tsx` | 1,568 | SVG 图标组件 |

### 1.3 测试文件（27 个，共 8,069 行）

详见第 5 节。

---

## 2. 当前层次分析

### 2.1 现状：扁平结构，无分层

当前所有 39 个源文件全部平铺在 `src/games/three-kingdoms/` 目录下，**没有任何子目录**。文件命名以功能模块为单位，但层次边界模糊。

### 2.2 按职责的模糊分类

```
┌──────────────────────────────────────────────────────────────┐
│                    当前扁平结构                                │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  🧠 引擎核心层（Engine Core）                                 │
│  ├── ThreeKingdomsEngine.ts    (2902行 — God Object)         │
│  └── index.ts                  (100行 — 导出入口)             │
│                                                              │
│  ⚔️ 游戏逻辑层（Game Logic）— 20+ 个 System 文件              │
│  ├── CampaignSystem.ts         (2616行 — 过大)               │
│  ├── CampaignBattleSystem.ts   (547行)                       │
│  ├── ThreeKingdomsCampaignManager.ts (359行)                 │
│  ├── NPCInteractionSystem.ts   (635行)                       │
│  ├── NPCActivitySystem.ts      (465行)                       │
│  ├── NPCSystem.ts              (371行)                       │
│  ├── NPCNeedSystem.ts          (293行)                       │
│  ├── NPCPathFollower.ts        (392行)                       │
│  ├── GeneralBondSystem.ts      (628行)                       │
│  ├── GeneralDialogueSystem.ts  (605行)                       │
│  ├── GeneralStoryEventSystem.ts(364行)                       │
│  ├── ThreeKingdomsEventSystem.ts(547行)                      │
│  ├── EventEnrichmentSystem.ts  (526行)                       │
│  ├── BattleChallengeSystem.ts  (451行)                       │
│  ├── BattleStrategy.ts         (295行)                       │
│  ├── BattleEnhancement.ts      (271行)                       │
│  ├── GameCalendarSystem.ts     (479行)                       │
│  ├── WeatherSystem.ts          (388行)                       │
│  ├── DayNightWeatherSystem.ts  (269行)                       │
│  ├── CityMapSystem.ts          (251行)                       │
│  ├── TradeRouteSystem.ts       (230行)                       │
│  ├── OfflineRewardSystem.ts    (220行)                       │
│  ├── TutorialStorySystem.ts    (212行)                       │
│  ├── ResourcePointSystem.ts    (196行)                       │
│  └── MapGenerator.ts           (867行)                       │
│                                                              │
│  🎨 渲染/表现层（Rendering）                                   │
│  ├── GeneralPortraitRenderer.ts(1071行)                      │
│  ├── ChineseBuildingRenderer.ts(579行)                       │
│  ├── QCharacterRenderer.ts     (447行)                       │
│  ├── ParticleSystem.ts         (439行)                       │
│  └── AudioManager.ts           (727行)                       │
│                                                              │
│  🔌 适配层（Adapter）                                         │
│  └── ThreeKingdomsRenderStateAdapter.ts (962行)              │
│                                                              │
│  📋 数据/配置层（Data & Config）                               │
│  ├── constants.ts              (813行)                       │
│  ├── GeneralData.ts            (493行)                       │
│  ├── ThreeKingdomsNPCDefs.ts   (689行)                       │
│  ├── ThreeKingdomsCampaign.ts  (341行)                       │
│  ├── AssetConfig.ts            (389行)                       │
│  └── PortraitConfig.ts         (136行)                       │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 2.3 关键问题

| 问题 | 详情 |
|------|------|
| **God Object** | `ThreeKingdomsEngine.ts`（2902行）持有 30+ 子系统引用，承担初始化、更新循环、序列化、NPC管理、对话触发、地图事件、关卡战斗、武将派遣等全部职责 |
| **巨型 UI 组件** | `ThreeKingdomsPixiGame.tsx`（6077行）包含 10+ 子组件/函数、大量内联样式、NPC 数据表、成就定义、场景插画等 |
| **无目录分层** | 39 个文件全部平铺，无 `core/`、`systems/`、`rendering/`、`data/` 等子目录 |
| **引擎↔逻辑耦合** | Engine 直接 import 25+ 个本地模块，所有 System 的生命周期由 Engine `onInit()/onUpdate()` 管理 |
| **UI 直接依赖引擎** | PixiGame.tsx 直接 import Engine、CampaignSystem、BattleStrategy 等底层模块 |

---

## 3. 依赖关系图

### 3.1 核心依赖链

```
┌─────────────────────────────────────────────────────────────────────┐
│                          UI 层 (React/PixiJS)                       │
│  ThreeKingdomsPixiGame.tsx ──→ ThreeKingdomsSVGIcons.tsx            │
│         │                                                           │
│         ├──→ ThreeKingdomsEngine (直接实例化)                        │
│         ├──→ ThreeKingdomsRenderStateAdapter                        │
│         ├──→ ThreeKingdomsEventSystem                               │
│         ├──→ CampaignSystem / ThreeKingdomsCampaign                 │
│         ├──→ BattleStrategy                                         │
│         ├──→ MapGenerator                                           │
│         ├──→ GeneralPortraitRenderer                                │
│         ├──→ GeneralData                                            │
│         ├──→ ParticleSystem                                         │
│         ├──→ AudioManager (from idle-subsystems)                    │
│         └──→ constants                                              │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     引擎层 (ThreeKingdomsEngine)                     │
│                                                                     │
│  继承: IdleGameEngine (@/engines/idle/IdleGameEngine)               │
│                                                                     │
│  外部引擎模块依赖 (13个):                                             │
│  ├── BuildingSystem      ├── PrestigeSystem                         │
│  ├── UnitSystem          ├── StageSystem                            │
│  ├── BattleSystem        ├── TechTreeSystem                         │
│  ├── TerritorySystem     ├── FloatingTextSystem                     │
│  ├── ParticleSystem      ├── StatisticsTracker                      │
│  ├── UnlockChecker       ├── InputHandler                           │
│  ├── QuestSystem         ├── EventSystem                            │
│  └── RewardSystem        └── NPCManager (from engine/npc)           │
│                                                                     │
│  本地模块依赖 (25个):                                                 │
│  ├── BattleChallengeSystem    ├── TutorialStorySystem               │
│  ├── MapGenerator            ├── NPCSystem                          │
│  ├── ThreeKingdomsNPCDefs    ├── DayNightWeatherSystem              │
│  ├── WeatherSystem           ├── NPCActivitySystem                  │
│  ├── GameCalendarSystem      ├── CityMapSystem                      │
│  ├── ResourcePointSystem     ├── OfflineRewardSystem                │
│  ├── TradeRouteSystem        ├── EventEnrichmentSystem              │
│  ├── CampaignSystem          ├── CampaignBattleSystem               │
│  ├── AudioManager            ├── GeneralDialogueSystem              │
│  ├── GeneralBondSystem       ├── GeneralStoryEventSystem            │
│  └── constants (BUILDINGS, GENERALS, TERRITORIES, TECHS, ...)      │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    独立子系统（无或少量本地依赖）                       │
│                                                                     │
│  无本地依赖（纯数据/纯逻辑）:                                         │
│  ├── constants.ts             ├── GeneralData.ts                    │
│  ├── ThreeKingdomsNPCDefs.ts  ├── PortraitConfig.ts                 │
│  ├── GeneralBondSystem.ts     ├── GeneralDialogueSystem.ts          │
│  ├── GeneralStoryEventSystem.ts                                    │
│  ├── BattleStrategy.ts        ├── BattleEnhancement.ts              │
│  ├── WeatherSystem.ts         ├── DayNightWeatherSystem.ts          │
│  ├── OfflineRewardSystem.ts   ├── TutorialStorySystem.ts            │
│  ├── TradeRouteSystem.ts      ├── ResourcePointSystem.ts            │
│  ├── NPCNeedSystem.ts         └── ThreeKingdomsCampaign.ts          │
│                                                                     │
│  有本地依赖:                                                         │
│  ├── CampaignBattleSystem → CampaignSystem                          │
│  ├── NPCSystem → MapGenerator                                       │
│  ├── NPCPathFollower → engine/tilemap/*                             │
│  ├── ThreeKingdomsCampaignManager → ThreeKingdomsCampaign           │
│  ├── AssetConfig → MapGenerator                                     │
│  └── ChineseBuildingRenderer → pixi.js                              │
│      QCharacterRenderer → pixi.js                                   │
│      GeneralPortraitRenderer → (纯 Canvas 2D)                       │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.2 适配器依赖

```
ThreeKingdomsRenderStateAdapter.ts
  ├── → ThreeKingdomsEngine (type only)
  ├── → @/renderer/types (渲染类型定义)
  ├── → constants
  ├── → MapGenerator (type)
  ├── → CampaignSystem (types + data)
  └── → CampaignBattleSystem (type)
```

---

## 4. 大文件识别（> 500 行）

| 文件 | 行数 | 风险等级 | 拆分建议 |
|------|------|----------|----------|
| `ThreeKingdomsPixiGame.tsx` | **6,077** | 🔴 极高 | 拆为 15+ 子组件，NPC数据/成就/常量外提 |
| `ThreeKingdomsEngine.ts` | **2,902** | 🔴 极高 | 拆出 Facade 层，将管理逻辑委托给子系统 |
| `CampaignSystem.ts` | **2,616** | 🔴 极高 | 拆分类型定义、关卡数据、战斗逻辑 |
| `GeneralPortraitRenderer.ts` | 1,071 | 🟡 中 | 可按武将拆分绘制函数 |
| `ThreeKingdomsRenderStateAdapter.ts` | 962 | 🟡 中 | 按场景拆分适配逻辑 |
| `MapGenerator.ts` | 867 | 🟡 中 | 地形生成与地图数据可分离 |
| `constants.ts` | 813 | 🟡 中 | 按领域拆分（建筑/武将/领土/科技） |
| `AudioManager.ts` | 727 | 🟡 中 | 音效定义与播放逻辑可分离 |
| `ThreeKingdomsNPCDefs.ts` | 689 | 🟢 低 | 纯数据，可保持 |
| `NPCInteractionSystem.ts` | 635 | 🟢 低 | 功能内聚 |
| `GeneralBondSystem.ts` | 628 | 🟢 低 | 功能内聚 |
| `GeneralDialogueSystem.ts` | 605 | 🟢 低 | 功能内聚 |
| `ChineseBuildingRenderer.ts` | 579 | 🟢 低 | 功能内聚 |
| `ThreeKingdomsEventSystem.ts` | 547 | 🟢 低 | 功能内聚 |
| `CampaignBattleSystem.ts` | 547 | 🟢 低 | 功能内聚 |
| `EventEnrichmentSystem.ts` | 526 | 🟢 低 | 功能内聚 |

**总代码量**: 源文件 22,565 行 + UI 7,645 行 + 测试 8,069 行 = **38,279 行**

---

## 5. 测试覆盖分析

### 5.1 测试文件清单（27 个，8,069 行）

| 测试文件 | 行数 | 覆盖目标 |
|----------|------|----------|
| `CampaignSystem.test.ts` | 951 | CampaignSystem |
| `ThreeKingdomsEngine.test.ts` | 873 | ThreeKingdomsEngine |
| `NPCInteraction.test.ts` | 546 | NPCInteractionSystem |
| `ThreeKingdomsCampaign.test.ts` | 538 | ThreeKingdomsCampaign |
| `NPCPatrolMovement.test.ts` | 481 | NPCPathFollower + NPCManager |
| `GeneralPortraitRenderer.test.ts` | 472 | GeneralPortraitRenderer |
| `AudioManager.test.ts` | 380 | AudioManager |
| `CampaignUI.test.ts` | 315 | Campaign UI 交互 |
| `CityMapAndResource.test.ts` | 274 | CityMapSystem + ResourcePointSystem |
| `NPCActivitySystem.test.ts` | 272 | NPCActivitySystem |
| `ThreeKingdomsNPC.test.ts` | 253 | NPCSystem + NPCDefs |
| `BattleChallengeSystem.test.ts` | 242 | BattleChallengeSystem |
| `TradeAndEvent.test.ts` | 234 | TradeRouteSystem + EventEnrichmentSystem |
| `BattleEnhancement.test.ts` | 233 | BattleEnhancement |
| `GameCalendarSystem.test.ts` | 222 | GameCalendarSystem |
| `ParticleSystem.test.ts` | 213 | ParticleSystem |
| `GeneralData.test.ts` | 211 | GeneralData |
| `WeatherSystem.test.ts` | 176 | WeatherSystem |
| `AssetConfig.test.ts` | 164 | AssetConfig |
| `NPCPathFollower.test.ts` | 157 | NPCPathFollower |
| `MapEventSystem.test.ts` | 153 | MapGenerator 事件 |
| `NPCNeedSystem.test.ts` | 143 | NPCNeedSystem |
| `ThreeKingdomsIntegration.test.ts` | 129 | 集成测试 |
| `ThreeKingdomsEventSystem.test.ts` | 126 | ThreeKingdomsEventSystem |
| `DayNightWeatherSystem.test.ts` | 125 | DayNightWeatherSystem |
| `TutorialStorySystem.test.ts` | 111 | TutorialStorySystem |
| `OfflineRewardSystem.test.ts` | 75 | OfflineRewardSystem |

### 5.2 无直接测试覆盖的模块

以下源文件**没有对应的独立测试文件**：

| 模块 | 行数 | 原因分析 |
|------|------|----------|
| `ThreeKingdomsRenderStateAdapter.ts` | 962 | 可能被集成测试间接覆盖 |
| `GeneralBondSystem.ts` | 628 | ⚠️ 完全无测试 |
| `GeneralDialogueSystem.ts` | 605 | ⚠️ 完全无测试 |
| `GeneralStoryEventSystem.ts` | 364 | ⚠️ 完全无测试 |
| `ThreeKingdomsCampaignManager.ts` | 359 | ⚠️ 完全无测试 |
| `BattleStrategy.ts` | 295 | ⚠️ 完全无测试 |
| `NPCSystem.ts` | 371 | 部分 ThreeKingdomsNPC.test.ts 覆盖 |
| `ChineseBuildingRenderer.ts` | 579 | ⚠️ 完全无测试 |
| `QCharacterRenderer.ts` | 447 | ⚠️ 完全无测试 |
| `PortraitConfig.ts` | 136 | 纯配置，低风险 |
| `constants.ts` | 813 | 纯数据，低风险 |
| `index.ts` | 100 | 纯导出 |

### 5.3 覆盖率评估

- **有直接测试的模块**: 27/39 (69%)
- **完全无测试的模块**: 12/39 (31%)
- **高风险无测试**: GeneralBondSystem、GeneralDialogueSystem、GeneralStoryEventSystem（武将互动三件套）、BattleStrategy（战斗策略）
- **测试/代码比**: 8,069 / 22,565 = **35.8%**（偏低）

---

## 6. 四层拆分建议方向

### 6.1 目标架构

```
src/games/three-kingdoms/
├── core/                          ← 第 1 层：引擎内核
│   ├── ThreeKingdomsEngine.ts     （精简为 ~500 行 Facade）
│   ├── EngineFacade.ts            （对外统一 API）
│   ├── types.ts                   （引擎级类型定义）
│   └── index.ts
│
├── systems/                       ← 第 2 层：游戏逻辑
│   ├── campaign/                  （征战系统族）
│   │   ├── CampaignSystem.ts
│   │   ├── CampaignBattleSystem.ts
│   │   ├── CampaignManager.ts
│   │   ├── BattleStrategy.ts
│   │   └── types.ts
│   ├── general/                   （武将系统族）
│   │   ├── GeneralBondSystem.ts
│   │   ├── GeneralDialogueSystem.ts
│   │   ├── GeneralStoryEventSystem.ts
│   │   └── types.ts
│   ├── npc/                       （NPC 系统族）
│   │   ├── NPCSystem.ts
│   │   ├── NPCInteractionSystem.ts
│   │   ├── NPCActivitySystem.ts
│   │   ├── NPCNeedSystem.ts
│   │   ├── NPCPathFollower.ts
│   │   └── types.ts
│   ├── world/                     （世界系统族）
│   │   ├── MapGenerator.ts
│   │   ├── CityMapSystem.ts
│   │   ├── ResourcePointSystem.ts
│   │   ├── WeatherSystem.ts
│   │   ├── DayNightWeatherSystem.ts
│   │   ├── GameCalendarSystem.ts
│   │   └── types.ts
│   ├── event/                     （事件系统族）
│   │   ├── ThreeKingdomsEventSystem.ts
│   │   ├── EventEnrichmentSystem.ts
│   │   ├── TradeRouteSystem.ts
│   │   └── types.ts
│   ├── battle/                    （战斗系统族）
│   │   ├── BattleChallengeSystem.ts
│   │   ├── BattleEnhancement.ts
│   │   └── types.ts
│   └── meta/                      （元系统）
│       ├── OfflineRewardSystem.ts
│       ├── TutorialStorySystem.ts
│       └── types.ts
│
├── rendering/                     ← 第 3 层：渲染/表现
│   ├── adapter/
│   │   └── ThreeKingdomsRenderStateAdapter.ts
│   ├── portrait/
│   │   ├── GeneralPortraitRenderer.ts
│   │   ├── QCharacterRenderer.ts
│   │   └── PortraitConfig.ts
│   ├── building/
│   │   └── ChineseBuildingRenderer.ts
│   ├── effects/
│   │   ├── ParticleSystem.ts
│   │   └── AudioManager.ts
│   └── index.ts
│
├── data/                          ← 第 4 层：数据/配置
│   ├── constants.ts               （或进一步拆分）
│   ├── GeneralData.ts
│   ├── ThreeKingdomsNPCDefs.ts
│   ├── ThreeKingdomsCampaign.ts
│   ├── AssetConfig.ts
│   └── index.ts
│
└── index.ts                       （统一导出）
```

### 6.2 各层职责定义

| 层级 | 目录 | 职责 | 依赖方向 | 关键原则 |
|------|------|------|----------|----------|
| **L1 内核** | `core/` | 引擎生命周期管理、子系统注册/协调、序列化、对外 Facade | → L2, L4 | 不含业务逻辑，仅协调 |
| **L2 逻辑** | `systems/` | 所有游戏玩法系统（战斗、NPC、武将、世界、事件） | → L4 | 系统间通过事件/接口通信，不直接互引 |
| **L3 渲染** | `rendering/` | 渲染适配、立绘绘制、建筑绘制、粒子/音效 | → L1 (type only), L4 | 不直接依赖 L2 实现类 |
| **L4 数据** | `data/` | 常量、配置、类型定义、NPC定义、关卡定义 | 无依赖 | 纯数据，被所有层引用 |

### 6.3 Engine 拆分策略（最关键）

当前 `ThreeKingdomsEngine.ts`（2902行）需要拆分为：

```
core/
├── ThreeKingdomsEngine.ts      (~500行)  — 生命周期 onInit/onUpdate/onRender/serialize
├── EngineSubsystemRegistry.ts  (~200行)  — 子系统注册表 + getter 统一管理
├── EngineUpdateLoop.ts         (~300行)  — onUpdate 中的各子系统更新调度
├── EngineSerialization.ts      (~150行)  — serialize/deserialize 逻辑
├── EngineNPCManager.ts         (~200行)  — NPC 相关的 updateNPCPositions/getNPCInfo 等
├── EngineBattleFacade.ts       (~400行)  — startCampaignBattle/simulateLevelBattle 等
├── EngineQuestEventHandler.ts  (~300行)  — registerThreeKingdomsQuests/Events
├── EngineDialogueTrigger.ts    (~200行)  — updateDialogueTriggers/triggerRandomIdleChat 等
└── types.ts                    (~100行)  — SaveState/MapEvent/DialogueEvent 等类型
```

### 6.4 UI 组件拆分策略

`ThreeKingdomsPixiGame.tsx`（6077行）需要拆分为：

```
src/components/idle/three-kingdoms/
├── ThreeKingdomsPixiGame.tsx        (~300行)  — 主容器 + 状态管理
├── data/
│   ├── NPCInfoData.ts               (~120行)  — NPC 信息表
│   ├── Achievements.ts              (~50行)   — 成就定义
│   └── StageConfig.ts               (~100行)  — 关卡 UI 配置
├── panels/
│   ├── CampaignPanel.tsx            (~500行)  — 征战面板
│   ├── LevelDetailModal.tsx         (~300行)  — 关卡详情弹窗
│   ├── CampaignBattleReport.tsx     (~250行)  — 战报面板
│   ├── BondPanel.tsx                (~200行)  — 羁绊面板
│   ├── EventPanel.tsx               (~200行)  — 事件面板
│   ├── QuestPanel.tsx               (~150行)  — 任务面板
│   └── SaveLoadPanel.tsx            (~200行)  — 存档面板
├── components/
│   ├── GeneralCard.tsx              (~250行)  — 武将卡片
│   ├── GeneralPortrait.tsx          (~100行)  — 武将头像
│   ├── GeneralCanvasPortrait.tsx    (~100行)  — Canvas 武将头像
│   ├── StatBar.tsx                  (~30行)   — 属性条
│   ├── ResourceBar.tsx              (~100行)  — 资源栏
│   ├── BuildingPanel.tsx            (~300行)  — 建筑面板
│   ├── TechTreePanel.tsx            (~300行)  — 科技树面板
│   ├── HeroDetailPanel.tsx          (~400行)  — 武将详情
│   ├── StageSceneIllustration.tsx   (~200行)  — 场景插画
│   └── NPCDialogueOverlay.tsx       (~200行)  — NPC 对话浮层
├── hooks/
│   ├── useEngine.ts                 (~100行)  — 引擎初始化 hook
│   ├── useRenderState.ts            (~80行)   — 渲染状态 hook
│   └── useToasts.ts                 (~50行)   — Toast 管理
└── ThreeKingdomsSVGIcons.tsx        (保持不变)
```

### 6.5 拆分优先级

| 优先级 | 任务 | 影响 | 风险 |
|--------|------|------|------|
| **P0** | 拆分 `ThreeKingdomsEngine.ts` | 解除 God Object | 高 — 需保证所有测试通过 |
| **P0** | 拆分 `ThreeKingdomsPixiGame.tsx` | UI 可维护性 | 中 — 纯 UI 重构 |
| **P1** | 建立目录结构（4 层） | 架构清晰度 | 低 — 纯文件移动 |
| **P1** | 拆分 `CampaignSystem.ts` | 降低单文件复杂度 | 中 — 需调整 import |
| **P2** | 补充缺失测试（武将三件套） | 测试覆盖率 | 低 |
| **P2** | 拆分 `constants.ts` | 数据层清晰度 | 低 |
| **P3** | 引入系统间事件总线 | 解耦系统间通信 | 高 — 架构变更 |

### 6.6 迁移策略建议

采用 **渐进式迁移**，避免大爆炸重写：

1. **Phase 1 — 建立目录骨架**: 创建 4 层目录，移动纯数据文件（L4）和纯渲染文件（L3）
2. **Phase 2 — 拆分 Engine**: 将 Engine 拆为 Facade + 子管理器，保持外部 API 不变
3. **Phase 3 — 拆分 UI**: 将 PixiGame.tsx 拆为子组件，保持功能不变
4. **Phase 4 — 系统分组**: 将 systems/ 下的文件按领域分组到子目录
5. **Phase 5 — 补充测试**: 为无覆盖模块补充单元测试

每阶段完成后运行全量测试，确保 `npm test` 通过。

---

## 附录：数据统计摘要

| 指标 | 数值 |
|------|------|
| 源文件数 | 39 |
| 源文件总行数 | 22,565 |
| UI 组件行数 | 7,645 |
| 测试文件数 | 27 |
| 测试总行数 | 8,069 |
| 项目总代码量 | 38,279 |
| 最大文件 | ThreeKingdomsPixiGame.tsx (6,077行) |
| Engine import 数 | 38 个（13 外部 + 25 本地） |
| Engine 子系统数 | 30+ |
| 无测试模块数 | 12 (31%) |
| >500 行文件数 | 16 |
| >1000 行文件数 | 4 |
