# 文件大小扫描报告 (R4)

> 扫描时间：2025-04-23  
> 项目路径：`/mnt/user-data/workspace/game-portal`  
> 扫描范围：`src/games/three-kingdoms/` 全部活跃代码文件  
> 行数阈值：≥400行（关注）、≥500行（必须拆分）

---

## 1. 总览

| 层级 | 文件数 | 总行数 | 平均行数/文件 |
|------|--------|--------|---------------|
| Engine 层 | 258 | 66,622 | 258 |
| Core 层 | 107 | 22,431 | 210 |
| UI 层 (components) | — | 41,783 | — |
| 测试文件 | 188 | 69,571 | 370 |

---

## 2. 🔴 超过 500 行的文件（必须拆分）

### 2.1 引擎层源码（2 个文件）

| 行数 | 文件路径 | 建议拆分方案 |
|------|----------|-------------|
| **503** | `engine/activity/ActivitySystem.ts` | 按活动类型拆分：`TimedActivityHandler`、`TokenShopHandler`、`SignInHandler` |
| **500** | `engine/building/BuildingSystem.ts` | 拆分：`BuildingUpgradeLogic`、`BuildingProductionLogic`、`BuildingQueryService` |

### 2.2 Core 层配置/类型（4 个文件）

| 行数 | 文件路径 | 建议拆分方案 |
|------|----------|-------------|
| **815** | `core/event/encounter-templates.ts` | 按章节/地区拆分：`encounter-chapter1.ts` ~ `encounter-chapterN.ts`，主文件仅做聚合导出 |
| **714** | `core/npc/npc-config.ts` | 按NPC类型拆分：`npc-hero-config.ts`、`npc-merchant-config.ts`、`npc-quest-config.ts` |
| **548** | `core/event/event-v15.types.ts` | 按事件域拆分：`event-trigger.types.ts`、`event-chain.types.ts`、`event-reward.types.ts` |
| **502** | `core/expedition/expedition.types.ts` | 按职责拆分：`expedition-state.types.ts`、`expedition-reward.types.ts`、`expedition-config.types.ts` |

### 2.3 UI 层（2 个文件）

| 行数 | 文件路径 | 建议拆分方案 |
|------|----------|-------------|
| **956** | `components/GameCard.tsx` | ⚠️ 最高优先级。拆分：`GameCard.tsx`（核心渲染）、`GameCard.hooks.ts`、`GameCard.utils.ts`、`GameCard.styles.ts` |
| **584** | `components/GameContainer.tsx` | 拆分：`GameContainer.tsx`（布局）、`GameContainer.hooks.ts`（状态管理）、`GameContainer.types.ts` |

### 2.4 测试文件（34 个文件 > 500行）

> 测试文件不在 500 行硬限制范围内，但过大的测试文件影响可维护性。

| 行数 | 文件路径 |
|------|----------|
| 934 | `engine/activity/__tests__/ActivitySystem.test.ts` |
| 897 | `engine/battle/__tests__/BattleTurnExecutor.test.ts` |
| 888 | `engine/equipment/__tests__/EquipmentSystem.test.ts` |
| 831 | `engine/shop/__tests__/ShopSystem.test.ts` |
| 755 | `engine/equipment/__tests__/equipment-v10.test.ts` |
| 680 | `engine/npc/__tests__/NPCMapPlacer.test.ts` |
| 666 | `engine/event/__tests__/EventTriggerSystem.test.ts` |
| 646 | `engine/npc/__tests__/NPCPatrolSystem.test.ts` |
| 645 | `engine/campaign/__tests__/CampaignProgressSystem.test.ts` |
| 643 | `engine/event/__tests__/EventNotificationSystem.test.ts` |
| 623 | `engine/responsive/__tests__/TouchInputSystem.test.ts` |
| 623 | `engine/npc/__tests__/NPCAffinitySystem.test.ts` |
| 612 | `engine/battle/__tests__/BattleEngine.test.ts` |
| 607 | `engine/heritage/__tests__/HeritageSystem.test.ts` |
| 605 | `engine/__tests__/ThreeKingdomsEngine.test.ts` |
| 593 | `tests/ui-extractor/__tests__/ReactDOMAdapter.test.ts` |
| 590 | `engine/quest/__tests__/QuestSystem.test.ts` |
| 582 | `engine/campaign/__tests__/RewardDistributor.test.ts` |
| 577 | `engine/event/__tests__/EventEngine.test.ts` |
| 570 | `engine/activity/__tests__/SignInSystem.test.ts` |
| 566 | `engine/npc/__tests__/NPCFavorabilitySystem.test.ts` |
| 558 | `engine/alliance/__tests__/AllianceSystem.test.ts` |
| 554 | `engine/pvp/__tests__/ArenaSystem.test.ts` |
| 549 | `engine/mail/__tests__/MailSystem.test.ts` |
| 549 | `engine/expedition/__tests__/ExpeditionSystem.test.ts` |
| 534 | `engine/event/__tests__/EventTriggerEngine.test.ts` |
| 529 | `engine/battle/__tests__/BattleEffectManager.test.ts` |
| 511 | `engine/__tests__/engine-tech-integration.test.ts` |
| 509 | `tests/ui-extractor/__tests__/UITreeDiffer.test.ts` |
| 502 | `tests/ui-review/__tests__/PrdChecker.test.ts` |

---

## 3. 🟡 400~499 行的文件（需要关注）

### 3.1 引擎层（57 个文件）

| 行数 | 文件路径 | 风险评估 |
|------|----------|---------|
| 499 | `engine/guide/StoryEventPlayer.ts` | 🟡 接近阈值，关注 |
| 496 | `engine/npc/NPCPatrolSystem.ts` | 🟡 接近阈值，关注 |
| 495 | `engine/quest/QuestSystem.ts` | 🟡 接近阈值，关注 |
| 489 | `engine/tech/TechLinkSystem.ts` | 🟡 接近阈值，关注 |
| 487 | `engine/tech/FusionTechSystem.ts` | 🟡 接近阈值，关注 |
| 487 | `engine/event/EventTriggerSystem.ts` | 🟡 接近阈值，关注 |
| 477 | `engine/hero/HeroLevelSystem.ts` | 🟡 接近阈值，关注 |
| 476 | `engine/battle/battle.types.ts` | 🟡 类型文件过大，建议按域拆分 |
| 474 | `engine/event/ChainEventEngine.ts` | 🟡 接近阈值，关注 |
| 471 | `engine/unification/PerformanceMonitor.ts` | 🟡 接近阈值，关注 |
| 469 | `engine/event/EventTriggerEngine.ts` | 🟡 接近阈值，关注 |
| 464 | `engine/pvp/ArenaSystem.ts` | 🟡 接近阈值，关注 |
| 459 | `engine/battle/BattleTurnExecutor.ts` | 🟡 接近阈值，关注 |
| 458 | `engine/settings/SettingsManager.ts` | 🟡 接近阈值，关注 |
| 458 | `engine/building/building-config.ts` | 🟡 配置文件，建议按建筑类型拆分 |
| 457 | `engine/tech/TechOfflineSystem.ts` | 🟡 接近阈值，关注 |
| 457 | `engine/settings/AnimationController.ts` | 🟡 接近阈值，关注 |
| 457 | `engine/settings/AccountSystem.ts` | 🟡 接近阈值，关注 |
| 455 | `engine/resource/ResourceSystem.ts` | 🟡 接近阈值，关注 |
| 453 | `engine/settings/AudioManager.ts` | 🟡 接近阈值，关注 |
| 453 | `engine/event/ChainEventSystem.ts` | 🟡 接近阈值，关注 |
| 452 | `engine/guide/FirstLaunchDetector.ts` | 🟡 接近阈值，关注 |
| 451 | `engine/event/OfflineEventSystem.ts` | 🟡 接近阈值，关注 |
| 449 | `engine/npc/NPCMapPlacer.ts` | 🟡 接近阈值，关注 |
| 449 | `engine/campaign/CampaignProgressSystem.ts` | 🟡 接近阈值，关注 |
| 444 | `engine/social/LeaderboardSystem.ts` | 🟡 接近阈值，关注 |
| 444 | `engine/hero/HeroRecruitSystem.ts` | 🟡 接近阈值，关注 |
| 444 | `engine/bond/BondSystem.ts` | 🟡 接近阈值，关注 |
| 442 | `engine/unification/BalanceValidator.ts` | 🟡 接近阈值，关注 |
| 439 | `engine/expedition/AutoExpeditionSystem.ts` | 🟡 接近阈值，关注 |
| 439 | `engine/battle/UltimateSkillSystem.ts` | 🟡 接近阈值，关注 |
| 437 | `engine/tech/TechDetailProvider.ts` | 🟡 接近阈值，关注 |
| 434 | `engine/activity/TimedActivitySystem.ts` | 🟡 接近阈值，关注 |
| 433 | `engine/battle/BattleEngine.ts` | 🟡 接近阈值，关注 |
| 432 | `engine/guide/TutorialMaskSystem.ts` | 🟡 接近阈值，关注 |
| 431 | `engine/expedition/ExpeditionSystem.ts` | 🟡 接近阈值，关注 |
| 430 | `engine/settings/SaveSlotManager.ts` | 🟡 接近阈值，关注 |
| 427 | `engine/unification/IntegrationValidator.ts` | 🟡 接近阈值，关注 |
| 425 | `engine/tech/TechEffectApplier.ts` | 🟡 接近阈值，关注 |
| 425 | `engine/offline/OfflineSnapshotSystem.ts` | 🟡 接近阈值，关注 |
| 423 | `engine/npc/NPCDialogSystem.ts` | 🟡 接近阈值，关注 |
| 422 | `engine/unification/InteractionAuditor.ts` | 🟡 接近阈值，关注 |
| 422 | `engine/calendar/CalendarSystem.ts` | 🟡 接近阈值，关注 |
| 420 | `engine/tech/TechTreeSystem.ts` | 🟡 接近阈值，关注 |
| 418 | `engine/ThreeKingdomsEngine.ts` | 🟡 接近阈值，关注 |
| 418 | `engine/social/FriendSystem.ts` | 🟡 接近阈值，关注 |
| 418 | `engine/heritage/HeritageSystem.ts` | 🟡 接近阈值，关注 |
| 417 | `engine/mail/MailSystem.ts` | 🟡 接近阈值，关注 |
| 417 | `engine/hero/HeroFormation.ts` | 🟡 接近阈值，关注 |
| 417 | `engine/achievement/AchievementSystem.ts` | 🟡 接近阈值，关注 |
| 413 | `engine/tech/TechEffectSystem.ts` | 🟡 接近阈值，关注 |
| 412 | `engine/equipment/EquipmentSystem.ts` | 🟡 接近阈值，关注 |
| 407 | `engine/guide/TutorialStateMachine.ts` | 🟡 接近阈值，关注 |
| 406 | `engine/activity/TokenShopSystem.ts` | 🟡 接近阈值，关注 |
| 403 | `engine/event/EventChainSystem.ts` | 🟡 接近阈值，关注 |

### 3.2 Core 层（5 个文件）

| 行数 | 文件路径 | 风险评估 |
|------|----------|---------|
| 491 | `core/responsive/responsive.types.ts` | 🟡 类型文件偏大 |
| 476 | `core/guide/guide.types.ts` | 🟡 类型文件偏大 |
| 440 | `core/equipment/equipment-config.ts` | 🟡 配置文件，建议按装备类型拆分 |
| 433 | `core/prestige/prestige.types.ts` | 🟡 类型文件偏大 |
| 416 | `core/pvp/pvp.types.ts` | 🟡 类型文件偏大 |

### 3.3 UI 层（14 个文件）

| 行数 | 文件路径 | 风险评估 |
|------|----------|---------|
| 582 | `components/idle/panels/trade/TradePanel.tsx` | 🟠 >550，建议拆分 hooks |
| 563 | `components/idle/CivGamePixiComponent.tsx` | 🟠 >550，建议拆分渲染逻辑 |
| 495 | `components/idle/StrategyGamePixiComponent.tsx` | 🟡 接近阈值 |
| 495 | `components/idle/panels/tech/TechTab.css` | 🟡 CSS文件偏大，可按子组件拆分 |
| 490 | `components/idle/panels/campaign/BattleFormationModal.css` | 🟡 CSS文件偏大 |
| 489 | `components/idle/panels/hero/HeroStarUpModal.css` | 🟡 CSS文件偏大 |
| 484 | `components/idle/ThreeKingdomsGame.css` | 🟡 CSS文件偏大 |
| 458 | `components/idle/icons/BuildingIcons.tsx` | 🟡 图标集合，按类别拆分 |
| 456 | `components/idle/panels/tech/TechNodeDetailModal.css` | 🟡 CSS文件偏大 |
| 451 | `components/idle/panels/campaign/BattleScene.css` | 🟡 CSS文件偏大 |
| 451 | `components/idle/panels/campaign/BattleResultModal.css` | 🟡 CSS文件偏大 |
| 450 | `components/idle/ThreeKingdomsGame.tsx` | 🟡 接近阈值 |
| 444 | `components/idle/panels/hero/HeroDetailModal.tsx` | 🟡 接近阈值 |
| 427 | `components/idle/panels/hero/RecruitModal.css` | 🟡 CSS文件偏大 |
| 425 | `components/idle/panels/resource/ResourceBar.css` | 🟡 CSS文件偏大 |
| 413 | `components/idle/panels/tech/TechNodeDetailModal.tsx` | 🟡 接近阈值 |
| 410 | `components/idle/panels/building/BuildingPanel.css` | 🟡 CSS文件偏大 |
| 404 | `components/idle/panels/tech/TechTab.tsx` | 🟡 接近阈值 |

---

## 4. 📊 各模块行数排行（Engine 层）

| 排名 | 模块 | 文件数 | 总行数 | 平均行/文件 |
|------|------|--------|--------|------------|
| 1 | event | 15 | 4,837 | 322 |
| 2 | battle | 16 | 4,497 | 281 |
| 3 | tech | 13 | 4,429 | 341 |
| 4 | unification | 17 | 4,404 | 259 |
| 5 | npc | 13 | 3,991 | 307 |
| 6 | campaign | 16 | 3,937 | 246 |
| 7 | hero | 12 | 3,342 | 279 |
| 8 | settings | 11 | 3,291 | 299 |
| 9 | guide | 8 | 2,733 | 342 |
| 10 | map | 8 | 2,400 | 300 |
| 11 | equipment | 11 | 2,370 | 215 |
| 12 | offline | 10 | 2,213 | 221 |
| 13 | expedition | 7 | 2,039 | 291 |
| 14 | pvp | 7 | 1,920 | 274 |
| 15 | responsive | 7 | 1,853 | 265 |
| 16 | activity | 7 | 1,919 | 274 |
| 17 | social | 6 | 1,631 | 272 |
| 18 | alliance | 7 | 1,396 | 199 |
| 19 | building | 5 | 1,344 | 269 |
| 20 | mail | 5 | 1,131 | 226 |
| 21 | prestige | 5 | 1,094 | 219 |
| 22 | quest | 5 | 1,092 | 218 |
| 23 | resource | 6 | 1,078 | 180 |
| 24 | trade | 4 | 974 | 244 |
| 25 | calendar | 4 | 679 | 170 |
| 26 | heritage | 3 | 674 | 225 |
| 27 | advisor | 3 | 536 | 179 |
| 28 | shop | 2 | 410 | 205 |
| 29 | currency | 2 | 406 | 203 |
| 30 | achievement | 2 | 424 | 212 |
| 31 | bond | 2 | 451 | 226 |
| 32 | leaderboard | 2 | 339 | 170 |

---

## 5. 📊 各模块行数排行（Core 层）

| 排名 | 模块 | 文件数 | 总行数 | 平均行/文件 |
|------|------|--------|--------|------------|
| 1 | event | 7 | 2,573 | 368 |
| 2 | npc | 6 | 1,726 | 288 |
| 3 | events | 5 | 1,157 | 231 |
| 4 | equipment | 4 | 1,132 | 283 |
| 5 | map | 7 | 1,344 | 192 |
| 6 | save | 4 | 868 | 217 |
| 7 | guide | 3 | 869 | 290 |
| 8 | prestige | 3 | 808 | 269 |
| 9 | settings | 4 | 807 | 202 |
| 10 | types | 7 | 801 | 114 |
| 11 | state | 4 | 794 | 199 |
| 12 | shop | 4 | 732 | 183 |
| 13 | trade | 3 | 644 | 215 |
| 14 | heritage | 5 | 608 | 122 |
| 15 | responsive | 2 | 575 | 288 |
| 16 | engine | 4 | 589 | 147 |
| 17 | achievement | 3 | 544 | 181 |
| 18 | expedition | 1 | 502 | 502 ⚠️ |
| 19 | quest | 3 | 500 | 167 |
| 20 | config | 3 | 453 | 151 |
| 21 | pvp | 1 | 416 | 416 ⚠️ |
| 22 | alliance | 1 | 386 | 386 |
| 23 | activity | 1 | 347 | 347 |
| 24 | social | 1 | 304 | 304 |
| 25 | offline | 2 | 293 | 147 |
| 26 | currency | 3 | 258 | 86 |
| 27 | mail | 2 | 222 | 111 |
| 28 | bond | 2 | 181 | 91 |
| 29 | advisor | 2 | 144 | 72 |
| 30 | leaderboard | 1 | 160 | 160 |
| 31 | tech | 2 | 154 | 77 |

---

## 6. 🎯 建议拆分优先级

### P0 — 立即拆分（>500行源码）

| 优先级 | 文件 | 当前行数 | 目标 |
|--------|------|---------|------|
| **P0-1** | `components/GameCard.tsx` | 956 | 拆为 3~4 个文件，每个 <300行 |
| **P0-2** | `core/event/encounter-templates.ts` | 815 | 按章节拆为 4~5 个文件 |
| **P0-3** | `core/npc/npc-config.ts` | 714 | 按NPC类型拆为 3~4 个文件 |
| **P0-4** | `components/GameContainer.tsx` | 584 | 拆为 2~3 个文件 |
| **P0-5** | `core/event/event-v15.types.ts` | 548 | 按事件域拆为 3 个文件 |
| **P0-6** | `core/expedition/expedition.types.ts` | 502 | 按职责拆为 3 个文件 |
| **P0-7** | `engine/activity/ActivitySystem.ts` | 503 | 按活动类型拆为 3 个文件 |
| **P0-8** | `engine/building/BuildingSystem.ts` | 500 | 按功能拆为 3 个文件 |

### P1 — 计划拆分（480~499行，即将突破）

| 文件 | 行数 | 趋势 |
|------|------|------|
| `engine/guide/StoryEventPlayer.ts` | 499 | ↗️ 即将超限 |
| `engine/npc/NPCPatrolSystem.ts` | 496 | ↗️ 即将超限 |
| `engine/quest/QuestSystem.ts` | 495 | ↗️ 即将超限 |
| `engine/tech/TechLinkSystem.ts` | 489 | ↗️ 即将超限 |
| `engine/tech/FusionTechSystem.ts` | 487 | ↗️ 即将超限 |
| `engine/event/EventTriggerSystem.ts` | 487 | ↗️ 即将超限 |
| `engine/hero/HeroLevelSystem.ts` | 477 | ↗️ 接近阈值 |
| `engine/battle/battle.types.ts` | 476 | ↗️ 类型膨胀 |

### P2 — 持续观察（400~479行）

57 个引擎层文件 + 5 个 Core 层文件 + 14 个 UI 层文件。  
建议在下次迭代时逐一评估增长趋势，对增长较快的文件提前拆分。

---

## 7. 📈 数据趋势分析

### 问题热区

1. **event 模块**（Engine 4,837 行 + Core 2,573 行 = 7,410 行）— 全项目最大模块，15+7=22 个文件
2. **battle 模块**（Engine 4,497 行）— 16 个文件，多个文件在 430~476 行区间
3. **npc 模块**（Engine 3,991 行 + Core 1,726 行 = 5,717 行）— 配置文件 714 行过大
4. **tech 模块**（Engine 4,429 行）— 13 个文件，平均 341 行/文件，密度最高

### 类型文件膨胀

以下 `.types.ts` 文件超过 400 行，说明类型定义过于集中：

| 文件 | 行数 |
|------|------|
| `core/event/event-v15.types.ts` | 548 |
| `core/expedition/expedition.types.ts` | 502 |
| `core/responsive/responsive.types.ts` | 491 |
| `core/guide/guide.types.ts` | 476 |
| `engine/battle/battle.types.ts` | 476 |
| `core/prestige/prestige.types.ts` | 433 |
| `core/pvp/pvp.types.ts` | 416 |

**建议**：类型文件也应遵循 500 行限制，按子域拆分类型定义。

---

## 8. 总结

| 分类 | 数量 | 说明 |
|------|------|------|
| 🔴 >500行源码 | **8 个** | 必须拆分（P0） |
| 🟠 480~499行源码 | **8 个** | 即将超限（P1） |
| 🟡 400~479行源码 | **68 个** | 需要关注（P2） |
| 🔴 >500行测试 | **30 个** | 建议按场景拆分 describe 块 |

**核心行动项**：
1. `GameCard.tsx`（956行）是全项目最大源码文件，需立即拆分
2. `encounter-templates.ts`（815行）和 `npc-config.ts`（714行）是 Core 层最大文件，按数据域拆分
3. event 模块是全项目最大模块，建议制定专项瘦身计划
4. 类型文件膨胀需引起重视，建议制定类型文件拆分规范
