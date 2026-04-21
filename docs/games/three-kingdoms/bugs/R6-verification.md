# R6 验证迭代审计报告

> **审计日期**: 2025-01-XX  
> **审计范围**: 三国霸业主入口 `ThreeKingdomsGame.tsx` Tab结构 + 所有面板集成质量  
> **审计人**: Game Reviewer Agent  

---

## 1. 主入口 Tab 总览

### 1.1 当前 Tab 配置

| # | TabId | Icon | Label | Available | 渲染组件 | 来源 |
|---|-------|------|-------|-----------|----------|------|
| 1 | `building` | 🏗️ | 建筑 | ✅ | `BuildingPanel` | panels/building |
| 2 | `hero` | ⚔️ | 武将 | ✅ | `HeroTab` | panels/hero |
| 3 | `tech` | 📜 | 科技 | ✅ | `TechTab` | panels/tech |
| 4 | `campaign` | 🗺️ | 关卡 | ✅ | `CampaignTab` | panels/campaign |
| 5 | `equipment` | ⚔️ | 装备 | ✅ | `EquipmentTab` | panels/equipment |
| 6 | `map` | 🗺️ | 天下 | ✅ | `WorldMapTab` | panels/map |
| 7 | `npc` | 👤 | 名士 | ✅ | `NPCTab` | panels/npc |
| 8 | `arena` | 🏟️ | 竞技 | ✅ | `ArenaTab` | panels/arena |
| 9 | `expedition` | 🗺️ | 远征 | ✅ | `ExpeditionTab` | panels/expedition |
| 10 | `army` | 🛡️ | 军队 | ✅ | `ArmyTab` | panels/army |

**共计 10 个 Tab，全部 available=true**。

### 1.2 renderSceneContent 分支覆盖

| Case | 组件 | Props模式 |
|------|------|-----------|
| `building` | `BuildingPanel` | 手动传 buildings/resources/rates/caps/engine/snapshotVersion |
| `hero` | `HeroTab` | engine + snapshotVersion |
| `tech` | `TechTab` | engine + snapshotVersion |
| `campaign` | `CampaignTab` | engine + snapshotVersion |
| `equipment` | `EquipmentTab` | engine + snapshotVersion |
| `map` | `WorldMapTab` | territories/productionSummary/snapshotVersion + callbacks |
| `npc` | `NPCTab` | npcs数组 + callbacks（**非engine模式**） |
| `arena` | `ArenaTab` | engine + snapshotVersion |
| `expedition` | `ExpeditionTab` | engine + snapshotVersion |
| `army` | `ArmyTab` | engine + snapshotVersion |
| `default` | `null` | — |

### 1.3 弹窗/覆盖层组件

| 组件 | 触发方式 | 位置 |
|------|----------|------|
| `Modal`（离线收益） | `offlineReward` state | 主渲染底部 |
| `EventBanner` | `activeBanner` state | 资源栏下方 |
| `RandomEncounterModal` | `activeEncounter` state | 主渲染底部 |
| `FeaturePanel`（worldmap） | `openFeature` state | 主渲染底部 |
| `FeaturePanel`（equipment） | `openFeature` state | 主渲染底部 |
| `FeaturePanel`（arena） | `openFeature` state | 主渲染底部 |
| `FeaturePanel`（expedition） | `openFeature` state | 主渲染底部 |
| `FeaturePanel`（events） | `openFeature` state | 主渲染底部 |
| `FeaturePanel`（npc） | `openFeature` state | 主渲染底部 |

### 1.4 import 来源汇总

**从 `panels/` 目录导入的面板（8个Tab组件）**:
- `ResourceBar`, `BuildingPanel`, `HeroTab`, `CampaignTab`, `TechTab`
- `EquipmentTab`, `ArenaTab`, `ExpeditionTab`, `ArmyTab`
- `WorldMapTab`, `NPCTab`
- `EventBanner`, `RandomEncounterModal`

**从 `ui/components/` 导入的组件（FeaturePanel弹窗内使用）**:
- `EquipmentBag`, `ArenaPanel`, `ExpeditionPanel`

**通用组件**:
- `Modal`, `Toast`, `FeatureMenu`, `FeaturePanel`

---

## 2. Panels 目录完整组件清单

### 2.1 已被主入口使用的组件

| 组件路径 | 使用方式 |
|----------|----------|
| `building/BuildingPanel.tsx` | Tab `building` |
| `building/BuildingUpgradeModal.tsx` | BuildingPanel子组件 |
| `hero/HeroTab.tsx` | Tab `hero` |
| `hero/HeroCard.tsx` | HeroTab子组件 |
| `hero/HeroDetailModal.tsx` | HeroTab子组件 |
| `hero/HeroStarUpModal.tsx` | HeroTab子组件 |
| `hero/HeroStarUpPanel.tsx` | HeroTab子组件 |
| `hero/HeroCompareModal.tsx` | HeroTab子组件 |
| `hero/RecruitModal.tsx` | HeroTab子组件 |
| `hero/FormationPanel.tsx` | HeroTab子组件 |
| `hero/GuideOverlay.tsx` | HeroTab子组件 |
| `hero/RadarChart.tsx` | HeroTab子组件 |
| `tech/TechTab.tsx` | Tab `tech` |
| `tech/TechNodeDetailModal.tsx` | TechTab子组件 |
| `tech/TechOfflinePanel.tsx` | TechTab子组件 |
| `tech/TechResearchPanel.tsx` | TechTab子组件 |
| `campaign/CampaignTab.tsx` | Tab `campaign` |
| `campaign/BattleAnimation.tsx` | CampaignTab子组件 |
| `campaign/BattleFormationModal.tsx` | CampaignTab子组件 |
| `campaign/BattleResultModal.tsx` | CampaignTab子组件 |
| `campaign/BattleScene.tsx` | CampaignTab子组件 |
| `campaign/BattleSpeedControl.tsx` | CampaignTab子组件 |
| `campaign/SweepModal.tsx` | CampaignTab子组件 |
| `campaign/SweepPanel.tsx` | CampaignTab子组件 |
| `campaign/UnitCard.tsx` | CampaignTab子组件 |
| `equipment/EquipmentTab.tsx` | Tab `equipment` |
| `map/WorldMapTab.tsx` | Tab `map` + FeaturePanel `worldmap` |
| `map/TerritoryInfoPanel.tsx` | WorldMapTab子组件 |
| `map/SiegeConfirmModal.tsx` | WorldMapTab子组件 |
| `npc/NPCTab.tsx` | Tab `npc` + FeaturePanel `npc` |
| `npc/NPCDialogModal.tsx` | NPCTab子组件 |
| `npc/NPCInfoModal.tsx` | NPCTab子组件 |
| `arena/ArenaTab.tsx` | Tab `arena` |
| `expedition/ExpeditionTab.tsx` | Tab `expedition` |
| `expedition/ExpeditionPanel.tsx` | FeaturePanel `expedition` 弹窗内使用 |
| `army/ArmyTab.tsx` | Tab `army` |
| `event/EventBanner.tsx` | 全局横幅 |
| `event/RandomEncounterModal.tsx` | 全局弹窗 |
| `resource/ResourceBar.tsx` | 顶部资源栏 |
| `pvp/ArenaPanel.tsx` | FeaturePanel `arena` 弹窗内使用 |

### 2.2 存在但未被主入口引用的面板（孤岛面板）

| 组件路径 | Props模式 | 引擎子系统 | 状态 |
|----------|-----------|------------|------|
| `achievement/AchievementPanel.tsx` | `engine: any` | AchievementSystem | ⚠️ **未集成** |
| `activity/ActivityPanel.tsx` | `engine: any` | ActivitySystem | ⚠️ **未集成** |
| `alliance/AlliancePanel.tsx` | `engine: any` | AllianceSystem | ⚠️ **未集成** |
| `heritage/HeritagePanel.tsx` | `engine: any` | HeritageSystem | ⚠️ **未集成** |
| `mail/MailPanel.tsx` | `engine: any` | MailSystem | ⚠️ **未集成** |
| `prestige/PrestigePanel.tsx` | `engine: any` | PrestigeSystem | ⚠️ **未集成** |
| `quest/QuestPanel.tsx` | `engine: any` | QuestSystem | ⚠️ **未集成** |
| `shop/ShopPanel.tsx` | `engine: any` | ShopSystem | ⚠️ **未集成** |
| `social/SocialPanel.tsx` | `engine: any` | FriendSystem/ChatSystem | ⚠️ **未集成** |
| `equipment/EquipmentPanel.tsx` | `engine: any` | EquipmentSystem | ⚠️ **重复**（与EquipmentTab功能重叠） |
| `resource/resource/ResourceBar.tsx` | 未知 | — | ⚠️ **疑似废弃**（重复路径） |

---

## 3. 引擎子系统 UI 覆盖状态

### 3.1 引擎已注册子系统 vs UI覆盖

| 引擎子系统 | 注册名 | 有Tab/面板 | 有引擎getter | UI集成质量 |
|------------|--------|------------|--------------|------------|
| ResourceSystem | `resource` | ✅ ResourceBar | `engine.resource` (readonly) | ✅ 完整 |
| BuildingSystem | `building` | ✅ BuildingPanel | `engine.building` (readonly) | ✅ 完整 |
| CalendarSystem | `calendar` | ✅ Tab栏日历区 | `engine.calendar` (readonly) | ✅ 完整 |
| HeroSystem | `hero` | ✅ HeroTab | `getHeroSystem()` | ✅ 完整 |
| HeroRecruitSystem | `heroRecruit` | ✅ RecruitModal | `getRecruitSystem()` | ✅ 完整 |
| HeroLevelSystem | `heroLevel` | ✅ HeroTab内 | `getLevelSystem()` | ✅ 完整 |
| HeroFormation | `heroFormation` | ✅ HeroTab内 | `getFormationSystem()` | ✅ 完整 |
| HeroStarSystem | `heroStarSystem` | ✅ HeroStarUpModal | `getHeroStarSystem()` | ✅ 完整 |
| CampaignSystem | `campaignSystem` | ✅ CampaignTab | `getCampaignSystem()` | ✅ 完整 |
| BattleEngine | `battleEngine` | ✅ BattleScene | `getBattleEngine()` | ✅ 完整 |
| SweepSystem | `sweepSystem` | ✅ SweepModal | `getSweepSystem()` | ✅ 完整 |
| TechTreeSystem | `techTree` | ✅ TechTab | `getTechTreeSystem()` | ✅ 完整 |
| TechPointSystem | `techPoint` | ✅ TechTab内 | `getTechPointSystem()` | ✅ 完整 |
| TechResearchSystem | `techResearch` | ✅ TechTab内 | `getTechResearchSystem()` | ✅ 完整 |
| FusionTechSystem | `fusionTech` | ✅ TechTab内 | `getFusionTechSystem()` | ✅ 完整 |
| TechLinkSystem | `techLink` | ✅ TechTab内 | `getTechLinkSystem()` | ✅ 完整 |
| TechOfflineSystem | `techOffline` | ✅ TechTab内 | `getTechOfflineSystem()` | ✅ 完整 |
| WorldMapSystem | `worldMap` | ✅ WorldMapTab | `getWorldMapSystem()` | ✅ 完整 |
| TerritorySystem | `territory` | ✅ WorldMapTab内 | `getTerritorySystem()` | ✅ 完整 |
| SiegeSystem | `siege` | ✅ SiegeConfirmModal | `getSiegeSystem()` | ✅ 完整 |
| GarrisonSystem | `garrison` | ⚠️ 无独立UI | `getGarrisonSystem()` | 🟡 部分 |
| EquipmentSystem | — | ✅ EquipmentTab | ❌ 无getter | 🟡 通过`(engine as any)`访问 |
| EquipmentForgeSystem | — | ✅ EquipmentTab内 | ❌ 无getter | 🟡 通过`(engine as any)`访问 |
| EquipmentEnhanceSystem | — | ✅ EquipmentTab内 | ❌ 无getter | 🟡 通过`(engine as any)`访问 |
| ArenaSystem | — | ✅ ArenaTab | ❌ 无getter | 🟡 通过`(engine as any)`访问 |
| ArenaSeasonSystem | — | ✅ ArenaTab内 | ❌ 无getter | 🟡 通过`(engine as any)`访问 |
| RankingSystem | — | ✅ ArenaTab内 | ❌ 无getter | 🟡 通过`(engine as any)`访问 |
| ExpeditionSystem | — | ✅ ExpeditionTab | ❌ 无getter | 🟡 通过`(engine as any)`访问 |
| NPCSystem | — | ✅ NPCTab | ❌ 无getter | 🟡 通过`(engine as any)?.npcSystem` |

### 3.2 引擎子系统存在但完全无UI

| 引擎子系统 | 路径 | 面板状态 | 优先级 |
|------------|------|----------|--------|
| AchievementSystem | `engine/achievement/` | ✅ 面板已创建但未挂载 | P1 |
| ActivitySystem + TokenShopSystem | `engine/activity/` | ✅ 面板已创建但未挂载 | P1 |
| AllianceSystem | ❌ 无引擎目录 | ✅ 面板已创建但未挂载 | P2 |
| BondSystem | `engine/bond/` | ❌ 无面板 | P2 |
| CurrencySystem | `engine/currency/` | ❌ 无面板（被ShopPanel间接使用） | P2 |
| HeritageSystem | `engine/heritage/` | ✅ 面板已创建但未挂载 | P1 |
| MailSystem | `engine/mail/` | ✅ 面板已创建但未挂载 | P1 |
| PrestigeSystem | ❌ 无引擎目录 | ✅ 面板已创建但未挂载 | P2 |
| QuestSystem + QuestTrackerSystem | `engine/quest/` | ✅ 面板已创建但未挂载 | P1 |
| ShopSystem | `engine/shop/` | ✅ 面板已创建但未挂载 | P1 |
| SocialSystem (Friend/Chat/Leaderboard) | `engine/social/` | ✅ 面板已创建但未挂载 | P2 |
| TradeSystem + CaravanSystem | `engine/trade/` | ❌ 无面板 | P2 |
| AdvisorSystem | `engine/advisor/` | ❌ 无面板 | P3 |
| EventSystem (Story/Chain/Trigger) | `engine/event/` | 🟡 仅EventBanner+RandomEncounter | P1 |
| GuideSystem (Tutorial) | `engine/guide/` | ❌ 无面板 | P2 |
| Settings (Audio/Graphics/Save) | `engine/settings/` | ❌ 无面板 | P2 |
| Unification (Balance/Performance) | `engine/unification/` | ❌ 无面板（内部系统） | P3 |
| Responsive (Mobile/Layout) | `engine/responsive/` | ❌ 无面板（内部系统） | P3 |
| Offline (Reward/Estimate/Snapshot) | `engine/offline/` | 🟡 仅离线收益弹窗 | P2 |

---

## 4. 新面板代码质量检查

### 4.1 Props接口一致性

| 面板 | Props接口 | engine prop | snapshotVersion | 评级 |
|------|-----------|-------------|-----------------|------|
| `ArenaTab` | `{ engine: any; snapshotVersion?: number }` | ✅ | ⚠️ optional | 🟡 |
| `ArmyTab` | `{ engine: any; snapshotVersion?: number }` | ✅ | ⚠️ optional（**未使用**） | 🔴 |
| `EquipmentTab` | `{ engine: ThreeKingdomsEngine; snapshotVersion: number }` | ✅ typed | ✅ required | ✅ |
| `ExpeditionTab` | `{ engine: any; snapshotVersion?: number }` | ✅ | ⚠️ optional（**未使用**） | 🔴 |
| `WorldMapTab` | `{ territories; productionSummary; snapshotVersion; onSelectTerritory; onSiegeTerritory }` | ❌ 无engine | ✅ | 🟡 |
| `NPCTab` | `{ npcs: NPCData[]; onSelectNPC; onStartDialog; visible? }` | ❌ 无engine | ❌ 无 | 🟡 |
| `EventBanner` | `{ banner; onClick?; onDismiss?; autoHideDuration? }` | ❌ 不需要 | ❌ 不需要 | ✅ |
| `RandomEncounterModal` | `{ visible; event; onSelectOption; onClose }` | ❌ 不需要 | ❌ 不需要 | ✅ |

### 4.2 引擎API调用方式

| 面板 | 获取子系统方式 | 问题 |
|------|----------------|------|
| `ArenaTab` | `engine?.getArenaSystem?.() ?? engine?.arena` | ⚠️ 双路径fallback，引擎无此getter |
| `ArmyTab` | `engine?.getHeroSystem?.()` + `engine?.getFormationSystem?.()` | ✅ 使用已有getter |
| `EquipmentTab` | `(engine as any)?.equipment ?? (engine as any)?.getEquipmentSystem?.()` | 🔴 强制any转换 |
| `ExpeditionTab` | `engine?.getExpeditionSystem?.() ?? engine?.expedition` | ⚠️ 引擎无此getter |
| `WorldMapTab` | 不直接访问引擎 | ✅ 通过props传入数据 |
| `NPCTab` | 不直接访问引擎 | ✅ 通过props传入数据 |

### 4.3 代码质量评分

| 面板 | TypeScript类型 | 样式方案 | 测试覆盖 | 代码规范 | 总评 |
|------|---------------|----------|----------|----------|------|
| `ArenaTab` | 🟡 `any`泛滥 | 内联样式对象 | ❌ 无测试 | ✅ 良好 | 🟡 |
| `ArmyTab` | 🟡 `any`泛滥 | 内联样式对象 | ❌ 无测试 | ✅ 良好 | 🟡 |
| `EquipmentTab` | ✅ 类型导入 | 内联样式对象 | ❌ 无测试 | ✅ 良好 | ✅ |
| `ExpeditionTab` | 🟡 `any`泛滥 | 内联样式对象 | ❌ 无测试 | ✅ 良好 | 🟡 |
| `WorldMapTab` | ✅ 类型导入 | CSS文件 | ✅ 有测试 | ✅ 优秀 | ✅ |
| `NPCTab` | ✅ 类型导入 | CSS文件 | ✅ 有测试 | ✅ 优秀 | ✅ |
| `EventBanner` | ✅ 类型导入 | CSS文件 | ✅ 有测试 | ✅ 优秀 | ✅ |
| `RandomEncounterModal` | ✅ 类型导入 | CSS文件 | ✅ 有测试 | ✅ 优秀 | ✅ |

---

## 5. 发现的问题清单

### P0 — 阻断性问题

| # | 问题 | 影响 | 位置 |
|---|------|------|------|
| P0-01 | **Tab图标重复**: `hero`和`equipment`都使用⚔️，`campaign`和`map`和`expedition`都使用🗺️ | 用户无法通过图标区分Tab | TABS配置 |
| P0-02 | **FeaturePanel与Tab重复**: `worldmap`/`equipment`/`arena`/`expedition`/`npc`既有Tab又有FeaturePanel弹窗，同一组件被渲染两次 | 用户体验混乱，内存浪费 | 主渲染底部FeaturePanel区域 |

### P1 — 重要问题

| # | 问题 | 影响 | 位置 |
|---|------|------|------|
| P1-01 | **9个已创建面板未挂载**: AchievementPanel, ActivityPanel, AlliancePanel, HeritagePanel, MailPanel, PrestigePanel, QuestPanel, ShopPanel, SocialPanel | 功能不可达，用户无法使用 | 主入口 |
| P1-02 | **ArmyTab未使用snapshotVersion**: Props声明了但组件内未作为useMemo依赖，导致数据不刷新 | 编队数据可能过时 | ArmyTab.tsx |
| P1-03 | **ExpeditionTab未使用snapshotVersion**: 同P1-02 | 远征数据可能过时 | ExpeditionTab.tsx |
| P1-04 | **NPCTab通过`(engine as any).npcSystem`获取数据**: 引擎未暴露NPC getter，使用不安全的any访问 | 运行时可能返回空数组，NPC功能形同虚设 | ThreeKingdomsGame.tsx L npcData |
| P1-05 | **EquipmentTab通过`(engine as any)`访问子系统**: EquipmentSystem/ForgeSystem/EnhanceSystem均无引擎getter | 类型不安全，重构易碎 | EquipmentTab.tsx |
| P1-06 | **ArenaTab通过`(engine as any)`访问子系统**: ArenaSystem/SeasonSystem/RankingSystem均无引擎getter | 同P1-05 | ArenaTab.tsx |
| P1-07 | **ExpeditionTab通过`(engine as any)`访问子系统**: ExpeditionSystem无引擎getter | 同P1-05 | ExpeditionTab.tsx |
| P1-08 | **EquipmentPanel与EquipmentTab功能重叠**: 两个组件都是装备背包UI，分别位于panels/equipment/和panels/，造成维护混乱 | 代码冗余 | panels/equipment/ |
| P1-09 | **pvp/ArenaPanel与arena/ArenaTab功能重叠**: 两个竞技场面板，一个用Panel/Modal封装，一个直接渲染 | 代码冗余 | panels/pvp/ vs panels/arena/ |
| P1-10 | **expedition/ExpeditionPanel与ExpeditionTab功能重叠**: 同上 | 代码冗余 | panels/expedition/ |
| P1-11 | **事件系统FeaturePanel仅显示占位文字**: `openFeature === 'events'` 时只渲染"暂无活跃事件"硬编码，未读取引擎事件数据 | 事件面板无实际功能 | ThreeKingdomsGame.tsx L FeaturePanel events |

### P2 — 一般问题

| # | 问题 | 影响 | 位置 |
|---|------|------|------|
| P2-01 | **resource/resource/ResourceBar.tsx 疑似废弃文件**: 与resource/ResourceBar.tsx路径重复 | 可能导致import混乱 | panels/resource/resource/ |
| P2-02 | **大量面板使用内联样式对象**: ArenaTab/ArmyTab/ExpeditionTab等使用`const S: Record<string, React.CSSProperties>`，不符合项目CSS规范（WorldMapTab/NPCTab使用CSS文件） | 维护性差，无法做主题切换 | 多个面板 |
| P2-03 | **AlliancePanel使用`prompt()`创建联盟**: 使用浏览器原生prompt，不符合游戏UI规范 | 用户体验差 | AlliancePanel.tsx |
| P2-04 | **多个面板的`engine` prop类型为`any`**: ArenaTab/ArmyTab/ExpeditionTab及所有未挂载面板 | 类型安全性差 | 多个面板 |
| P2-05 | **GarrisonSystem无独立UI**: 引擎有getter但无面板 | 驻军管理功能不可用 | — |
| P2-06 | **BondSystem无UI**: 羁绊系统引擎已实现但无面板 | 羁绊功能不可用 | — |
| P2-07 | **TradeSystem/CaravanSystem无UI**: 贸易系统引擎已实现但无面板 | 贸易功能不可用 | — |
| P2-08 | **GuideSystem无UI**: 教程系统引擎已实现但无面板 | 新手引导不可用 | — |
| P2-09 | **SocialPanel聊天/排行榜Tab为占位**: 显示"功能开发中" | 社交功能不完整 | SocialPanel.tsx |
| P2-10 | **HeritagePanel传承操作为占位**: 武将/装备/经验传承Tab显示"请在武将/装备面板中选择传承对象" | 传承功能不可用 | HeritagePanel.tsx |

---

## 6. 架构问题分析

### 6.1 双轨UI架构混乱

当前存在两套并行的UI架构：

1. **Tab模式**: 10个Tab直接渲染在场景区，组件接收`engine + snapshotVersion`
2. **FeaturePanel弹窗模式**: 6个FeaturePanel弹窗，部分复用Tab组件（WorldMapTab/NPCTab），部分使用`ui/components/`下的独立组件（EquipmentBag/ArenaPanel/ExpeditionPanel）

**问题**: 同一功能（如世界地图、竞技场）在Tab和FeaturePanel中渲染两次，用户可能困惑于两种入口。

### 6.2 引擎API暴露不一致

- **有正式getter的**: HeroSystem, CampaignSystem, TechTreeSystem, TerritorySystem 等（17个）
- **通过`(engine as any)`访问的**: EquipmentSystem, ArenaSystem, ExpeditionSystem, NPCSystem 等
- **完全无引擎集成的**: AllianceSystem, PrestigeSystem（面板代码中假设有getter但引擎无对应实现）

### 6.3 Props模式不统一

| 模式 | 组件 | 优劣 |
|------|------|------|
| A: `engine + snapshotVersion` | HeroTab, TechTab, CampaignTab, EquipmentTab, ArenaTab, ArmyTab, ExpeditionTab | ✅ 统一，组件自行获取数据 |
| B: 手动传业务数据 | BuildingPanel, WorldMapTab, NPCTab | 🟡 灵活但主入口代码膨胀 |
| C: `engine` only（无snapshotVersion） | AchievementPanel, ActivityPanel等未挂载面板 | 🔴 无法响应数据变化 |

---

## 7. 下一步修复计划

### Phase 1: 紧急修复（P0）

1. **修复Tab图标重复**
   - `hero`: ⚔️ → 🦸
   - `equipment`: ⚔️ → 🛡️
   - `campaign`: 🗺️ → ⚔️（或🏯）
   - `expedition`: 🗺️ → 🚀

2. **消除Tab与FeaturePanel重复**
   - 方案A: 移除FeaturePanel中的worldmap/equipment/arena/expedition/npc，仅保留Tab入口
   - 方案B: 将FeatureMenu仅用于无Tab的功能（events/新增功能）
   - 推荐: **方案A**，Tab已覆盖这些功能

### Phase 2: 核心集成（P1）

3. **为引擎添加缺失的getter方法**
   ```typescript
   // ThreeKingdomsEngine.ts 需添加:
   getEquipmentSystem() { return this.equipmentSystem; }
   getEquipmentForgeSystem() { return this.equipmentForgeSystem; }
   getEquipmentEnhanceSystem() { return this.equipmentEnhanceSystem; }
   getArenaSystem() { return this.arenaSystem; }
   getExpeditionSystem() { return this.expeditionSystem; }
   getNPCSystem() { return this.npcSystem; }
   // ... 等
   ```

4. **挂载9个孤岛面板**
   - 添加新Tab或通过FeatureMenu集成
   - 优先级: QuestPanel > ShopPanel > MailPanel > AchievementPanel > ActivityPanel > HeritagePanel > SocialPanel > AlliancePanel > PrestigePanel

5. **修复snapshotVersion未使用问题**
   - ArmyTab: 将snapshotVersion添加到useMemo依赖数组
   - ExpeditionTab: 同上

6. **消除重复面板**
   - 删除 `panels/equipment/EquipmentPanel.tsx`（保留EquipmentTab）
   - 删除 `panels/pvp/ArenaPanel.tsx`（保留arena/ArenaTab）
   - 删除 `panels/expedition/ExpeditionPanel.tsx`（保留ExpeditionTab）
   - 更新FeaturePanel中的引用

7. **修复事件面板占位**
   - 实现真实的事件列表UI，读取引擎EventSystem数据

### Phase 3: 质量提升（P2）

8. **统一Props接口**
   - 所有Tab组件统一为 `{ engine: ThreeKingdomsEngine; snapshotVersion: number }`
   - WorldMapTab/NPCTab重构为engine模式

9. **统一样式方案**
   - 将内联样式面板迁移到CSS文件
   - 建立统一的CSS变量体系

10. **清理废弃文件**
    - 删除 `panels/resource/resource/ResourceBar.tsx`
    - 清理 `ui/components/` 下被panels替代的组件

11. **添加缺失面板**
    - GarrisonPanel（驻军管理）
    - BondPanel（羁绊系统）
    - TradePanel（贸易系统）
    - TutorialOverlay（新手引导）

---

## 8. 统计摘要

| 指标 | 数值 |
|------|------|
| Tab总数 | 10 |
| 已集成Tab | 10 (100%) |
| renderSceneContent分支 | 10/10 (完整覆盖) |
| Panels目录组件总数 | ~45个（含子组件和测试） |
| 已被主入口引用的面板 | ~30个 |
| 未被引用的孤岛面板 | 11个 |
| 引擎子系统总数 | ~35+ |
| 有完整UI的子系统 | 21 |
| 有面板但未挂载的 | 9 |
| 完全无UI的 | 5+ |
| P0问题 | 2 |
| P1问题 | 11 |
| P2问题 | 10 |

---

*报告结束。建议优先处理P0-01（图标重复）和P0-02（Tab/FeaturePanel重复），然后按Phase 2计划逐步集成孤岛面板。*
