# 三国霸业 v3.0 UI层开发现状全面摸底报告

> **审计日期**: 2026-05-01
> **审计范围**: `src/components/idle/` + `src/games/three-kingdoms/engine/` + `docs/`
> **审计人**: Architect Agent

---

## 一、项目架构总览

### 1.1 代码组织结构

```
src/
├── components/
│   ├── idle/                          ← ★ 三国霸业 UI 层主目录
│   │   ├── ThreeKingdomsGame.tsx      ← 主游戏容器（~400行）
│   │   ├── ThreeKingdomsGame.css
│   │   ├── three-kingdoms/            ← 核心框架组件
│   │   │   ├── SceneRouter.tsx        ← 场景路由（Tab→面板映射）
│   │   │   ├── TabBar.tsx             ← 底部7 Tab导航
│   │   │   ├── FeaturePanelOverlay.tsx← 功能面板弹窗统一渲染层
│   │   │   ├── useEngineEvents.ts     ← 引擎事件监听Hook
│   │   │   ├── CalendarDisplay.tsx    ← 日历显示
│   │   │   ├── OfflineRewardModal.tsx ← 离线收益弹窗
│   │   │   ├── WelcomeModal.tsx       ← 欢迎弹窗
│   │   │   └── GameErrorBoundary.tsx  ← 错误边界
│   │   ├── panels/                    ← ★ 功能面板（26个子目录）
│   │   │   ├── campaign/              ← 战斗/关卡（8文件，2310行）
│   │   │   ├── hero/                  ← 武将系统（40+文件，13061行）
│   │   │   ├── map/                   ← 世界地图（4文件，1283行）
│   │   │   ├── building/              ← 建筑系统
│   │   │   ├── tech/                  ← 科技系统
│   │   │   ├── equipment/             ← 装备系统
│   │   │   ├── arena/                 ← 竞技场
│   │   │   ├── expedition/            ← 远征
│   │   │   ├── army/                  ← 军队
│   │   │   ├── npc/                   ← 名士/NPC
│   │   │   ├── prestige/              ← 声望
│   │   │   ├── shop/                  ← 商店
│   │   │   ├── quest/                 ← 任务
│   │   │   ├── event/                 ← 事件
│   │   │   ├── mail/                  ← 邮件
│   │   │   ├── activity/              ← 活动
│   │   │   ├── alliance/              ← 联盟
│   │   │   ├── social/                ← 社交
│   │   │   ├── trade/                 ← 交易
│   │   │   ├── heritage/              ← 传承
│   │   │   ├── achievement/           ← 成就
│   │   │   ├── settings/              ← 设置
│   │   │   ├── resource/              ← 资源栏
│   │   │   ├── more/                  ← 更多Tab网格
│   │   │   └── pvp/                   ← PvP
│   │   ├── common/                    ← 公共组件
│   │   │   ├── Modal.tsx / Panel.tsx / Toast.tsx
│   │   │   └── constants.ts
│   │   ├── components/
│   │   │   └── SharedPanel.tsx        ← 通用面板容器
│   │   └── icons/                     ← SVG图标组件
│   └── GameContainer.tsx              ← 通用Canvas游戏容器（非三国用）
│
├── games/three-kingdoms/
│   ├── engine/                        ← ★ 游戏引擎层（纯TS，无UI依赖）
│   │   ├── ThreeKingdomsEngine.ts     ← 引擎主类（Facade模式）
│   │   ├── battle/                    ← 战斗子系统（20+文件）
│   │   ├── campaign/                  ← 关卡子系统（18+文件，4584行）
│   │   ├── hero/                      ← 武将子系统
│   │   ├── building/                  ← 建筑子系统
│   │   ├── tech/                      ← 科技子系统
│   │   ├── map/                       ← 地图子系统
│   │   └── ...（共20+子系统）
│   ├── core/                          ← 类型定义和配置
│   ├── rendering/                     ← Canvas渲染层（PixiJS）
│   │   ├── battle/                    ← 战斗特效渲染
│   │   ├── map/                       ← 地图渲染
│   │   ├── core/                      ← PixiApp/RenderLoop/Texture
│   │   └── ui-overlay/               ← 浮动文字/粒子
│   ├── shared/                        ← 共享类型
│   └── tests/                         ← 测试（含ACC/FLOW/GAP系列）
```

### 1.2 数据流架构

```
ThreeKingdomsGame.tsx
  │
  ├─ useRef<ThreeKingdomsEngine>  ← 引擎单例
  ├─ useState<TabId>              ← 当前Tab
  ├─ useState<snapshotVersion>    ← UI刷新版本号
  │
  ├─ 500ms tick → engine.tick()
  ├─ 1000ms UI refresh → setSnapshotVersion(+1)
  │
  ├─ engine.getSnapshot() → EngineSnapshot → 传递给子组件
  │
  ├─ ResourceBar (顶部)
  ├─ EventBanner (急报横幅)
  ├─ SceneRouter (中央场景区)
  │   ├─ BuildingPanel
  │   ├─ HeroTab
  │   ├─ CampaignTab ← ★ v3.0核心
  │   │   ├─ BattleFormationModal (战前布阵)
  │   │   │   └─ BattleScene (战斗场景)
  │   │   │       └─ BattleAnimation (动画Hook)
  │   │   ├─ BattleResultModal (战斗结算)
  │   │   ├─ SweepModal (扫荡弹窗)
  │   │   └─ SweepPanel (扫荡面板)
  │   ├─ TechTab
  │   ├─ WorldMapTab
  │   ├─ EquipmentTab
  │   ├─ ArenaTab
  │   ├─ ExpeditionTab
  │   ├─ ArmyTab
  │   ├─ PrestigePanel
  │   ├─ NPCTab
  │   └─ MoreTab
  ├─ TabBar (底部7Tab)
  ├─ FeaturePanelOverlay (弹窗功能面板)
  ├─ OfflineRewardModal
  ├─ WelcomeModal
  ├─ RandomEncounterModal
  └─ StoryEventModal
```

---

## 二、已有UI组件清单

### 2.1 框架层组件

| 文件 | 职责 | 行数 | 完成度 |
|------|------|:----:|:------:|
| `ThreeKingdomsGame.tsx` | 主游戏容器，引擎生命周期管理，全局状态 | ~400 | ✅ 95% |
| `SceneRouter.tsx` | Tab→面板路由分发 | ~170 | ✅ 95% |
| `TabBar.tsx` | 底部7 Tab导航 + 日历 + Badge | ~250 | ✅ 95% |
| `FeaturePanelOverlay.tsx` | 17个功能面板弹窗统一渲染 | ~130 | ✅ 90% |
| `useEngineEvents.ts` | 引擎事件→UI状态桥接Hook | ~80 | ✅ 90% |
| `CalendarDisplay.tsx` | 日历信息显示 | ~60 | ✅ 90% |
| `OfflineRewardModal.tsx` | 离线收益弹窗 | ~150 | ✅ 85% |
| `WelcomeModal.tsx` | 首次启动欢迎弹窗 | ~100 | ✅ 85% |
| `GameErrorBoundary.tsx` | React错误边界 | ~50 | ✅ 90% |

### 2.2 战斗/关卡面板（v3.0核心）

| 文件 | 职责 | 行数 | 完成度 | 备注 |
|------|------|:----:|:------:|------|
| `CampaignTab.tsx` | 关卡地图主面板（章节选择+关卡节点+进度） | 442 | ✅ 85% | 横向卷轴地图，章节切换，扫荡入口 |
| `BattleFormationModal.tsx` | 战前布阵弹窗（敌方预览+编队+战力对比） | 376 | ✅ 85% | 一键布阵，出征→BattleScene |
| `BattleScene.tsx` | 全屏战斗场景（6v6回合制） | 264 | ✅ 80% | 前排3+后排3，血条/怒气条 |
| `BattleAnimation.tsx` | 战斗动画Hook（回放循环+伤害飘字+受击） | 228 | ✅ 80% | 攻击前冲/受击闪烁/暴击震动/死亡倒下 |
| `BattleResultModal.tsx` | 战斗结算弹窗（星级+奖励+失败建议） | 319 | ✅ 85% | 首通奖励，重试按钮 |
| `BattleSpeedControl.tsx` | 战斗速度控制（1x/2x/4x） | 87 | ✅ 85% | |
| `SweepModal.tsx` | 扫荡弹窗（次数+扫荡令+预计奖励） | 267 | ✅ 85% | |
| `SweepPanel.tsx` | 扫荡面板（overlay版） | 242 | ✅ 80% | 与SweepModal功能重复 |
| `battle-scene-utils.ts` | 战斗场景工具函数 | 85 | ✅ 90% | HP等级/格式化 |

### 2.3 武将系统面板

| 文件 | 职责 | 行数 | 完成度 |
|------|------|:----:|:------:|
| `HeroTab.tsx` | 武将Tab主面板 | 352 | ✅ 90% |
| `HeroListPanel.tsx` | 武将网格列表 | ~200 | ✅ 85% |
| `HeroCard.tsx` | 武将卡片 | ~150 | ✅ 85% |
| `HeroDetailModal.tsx` | 武将详情弹窗 | 481 | ✅ 85% |
| `HeroDetailSections.tsx` | 详情页各区块 | 422 | ✅ 80% |
| `HeroUpgradePanel.tsx` | 武将升级面板 | ~250 | ✅ 85% |
| `HeroStarUpModal.tsx` | 升星弹窗 | 482 | ✅ 85% |
| `HeroStarUpPanel.tsx` | 升星面板 | 386 | ✅ 85% |
| `HeroStatsPanel.tsx` | 属性面板 | ~200 | ✅ 85% |
| `HeroAwakeningSection.tsx` | 觉醒区块 | 355 | ✅ 80% |
| `HeroBreakthroughPanel.tsx` | 突破面板 | ~250 | ✅ 80% |
| `HeroCompareModal.tsx` | 武将对比弹窗 | ~300 | ✅ 80% |
| `HeroComparePanel.tsx` | 对比面板 | ~250 | ✅ 80% |
| `HeroDispatchPanel.tsx` | 派遣面板 | 363 | ✅ 80% |
| `HeroRecommendTag.tsx` | 推荐标签 | ~80 | ✅ 85% |
| `FormationPanel.tsx` | 编队管理面板 | 541 | ✅ 85% |
| `FormationGrid.tsx` | 编队网格 | ~200 | ✅ 85% |
| `FormationRecommendPanel.tsx` | 编队推荐 | 458 | ✅ 80% |
| `FormationSaveSlot.tsx` | 编队存档槽 | ~150 | ✅ 85% |
| `RecruitModal.tsx` | 招募弹窗 | 534 | ✅ 85% |
| `RecruitPanel.tsx` | 招募面板 | ~200 | ✅ 85% |
| `RecruitResultModal.tsx` | 招募结果弹窗 | ~150 | ✅ 85% |
| `SkillPanel.tsx` | 技能面板 | ~250 | ✅ 85% |
| `SkillUpgradePanel.tsx` | 技能升级面板 | ~200 | ✅ 85% |
| `SkillUpgradePreview.tsx` | 技能升级预览 | ~150 | ✅ 85% |
| `BondPanel.tsx` | 羁绊面板 | 574 | ✅ 85% |
| `BondCard.tsx` | 羁绊卡片 | ~150 | ✅ 85% |
| `BondCardItem.tsx` | 羁绊条目 | ~100 | ✅ 85% |
| `BondActivateModal.tsx` | 羁绊激活弹窗 | ~200 | ✅ 85% |
| `BondCollectionPanel.tsx` | 羁绊收集面板 | 403 | ✅ 85% |
| `BondCollectionProgress.tsx` | 羁绊收集进度 | ~150 | ✅ 85% |
| `BreakthroughPanel.tsx` | 突破面板 | ~200 | ✅ 80% |
| `EconomyOverview.tsx` | 经济总览 | ~200 | ✅ 80% |
| `ProbabilityDisclosure.tsx` | 概率公示 | ~150 | ✅ 85% |
| `RadarChart.tsx` | 雷达图 | ~150 | ✅ 85% |
| `StarUpPanel.tsx` | 升星面板 | ~200 | ✅ 85% |
| `StrategyGuidePanel.tsx` | 攻略面板 | ~200 | ✅ 80% |
| `GuideOverlay.tsx` | 引导覆盖层 | 648 | ✅ 85% |
| `GuideWelcomeModal.tsx` | 引导欢迎弹窗 | ~150 | ✅ 85% |
| `GuideFreeExploreModal.tsx` | 自由探索弹窗 | ~150 | ✅ 85% |
| `GuideRewardConfirm.tsx` | 引导奖励确认 | ~100 | ✅ 85% |
| `InteractiveTutorial.tsx` | 交互式教程 | ~200 | ✅ 85% |
| `TutorialOverlay.tsx` | 教程覆盖层 | 241 | ✅ 85% |
| `guide-utils.ts` | 引导工具函数 | 376 | ✅ 85% |
| `useHeroEngine.ts` | 武将引擎Hook | 16 | ✅ 90% |
| `hero-ui.types.ts` | 武将UI类型 | 136 | ✅ 90% |
| `atoms/` (4组件) | 原子组件(AttributeBar/QualityBadge等) | ~200 | ✅ 90% |

### 2.4 其他功能面板

| 目录 | 主要组件 | 行数 | 完成度 |
|------|---------|:----:|:------:|
| `building/` | BuildingPanel, BuildingUpgradeModal, BuildingIncomeModal | ~1300 | ✅ 90% |
| `tech/` | TechTab, TechResearchPanel, TechNodeDetailModal, TechOfflinePanel | ~1600 | ✅ 85% |
| `map/` | WorldMapTab, SiegeConfirmModal, SiegeResultModal, TerritoryInfoPanel | 1283 | ✅ 85% |
| `equipment/` | EquipmentTab, EquipmentPanel | ~1090 | ✅ 80% |
| `arena/` | ArenaTab | 366 | ✅ 80% |
| `expedition/` | ExpeditionTab, ExpeditionPanel | ~1050 | ✅ 80% |
| `army/` | ArmyTab | ~300 | ⚠️ 60% |
| `npc/` | NPCTab, NPCDialogModal, NPCInfoModal | ~600 | ✅ 80% |
| `prestige/` | PrestigePanel | ~300 | ✅ 80% |
| `shop/` | ShopPanel | 670 | ✅ 85% |
| `trade/` | TradePanel | 589 | ✅ 80% |
| `quest/` | QuestPanel, QuestTrackerPanel | ~400 | ✅ 80% |
| `event/` | EventBanner, EventListPanel, RandomEncounterModal, StoryEventModal | ~800 | ✅ 85% |
| `mail/` | MailPanel | ~300 | ✅ 80% |
| `activity/` | ActivityPanel | ~400 | ✅ 80% |
| `alliance/` | AlliancePanel | 435 | ✅ 80% |
| `social/` | SocialPanel | ~300 | ✅ 75% |
| `heritage/` | HeritagePanel | ~300 | ✅ 75% |
| `achievement/` | AchievementPanel | ~300 | ✅ 75% |
| `settings/` | SettingsPanel | ~300 | ✅ 80% |
| `resource/` | ResourceBar | 335 | ✅ 90% |
| `more/` | MoreTab | ~300 | ✅ 85% |
| `pvp/` | ArenaPanel | 447 | ✅ 80% |

### 2.5 公共组件

| 文件 | 职责 | 完成度 |
|------|------|:------:|
| `common/Modal.tsx` | 通用弹窗容器 | ✅ 90% |
| `common/Panel.tsx` | 通用面板容器 | ✅ 90% |
| `common/Toast.tsx` | 全局Toast提示 | ✅ 90% |
| `components/SharedPanel.tsx` | 统一面板壳（标题+关闭按钮） | ✅ 90% |
| `icons/` (5文件) | 建筑/战斗/资源/科技图标 | ✅ 85% |
| `utils/formatNumber.ts` | 数字格式化 | ✅ 90% |

---

## 三、已有引擎API清单

### 3.1 战斗子系统 (`engine/battle/`)

| 类/模块 | 核心方法 | 行数 | 状态 |
|---------|---------|:----:|:----:|
| **BattleEngine** | `initBattle()`, `executeTurn()`, `isBattleOver()`, `getBattleResult()` | ~400 | ✅ 完成 |
| **DamageCalculator** | `calculate()`, `getRestraintMultiplier()`, `rollCritical()` | ~300 | ✅ 完成 |
| **BattleTurnExecutor** | `executeTurn()`, `getAliveUnits()`, `sortBySpeed()`, `findUnit()` | ~350 | ✅ 完成 |
| **autoFormation** | `autoFormation()` → AutoFormationResult | ~150 | ✅ 完成 |
| **BattleStatistics** | `calculateBattleStats()`, `generateSummary()` | ~200 | ✅ 完成 |
| **UltimateSkillSystem** | 大招时停系统 | ~200 | ✅ 完成(v4.0) |
| **BattleSpeedController** | 速度控制(1x/2x/4x) | ~150 | ✅ 完成(v4.0) |
| **BattleEffectApplier** | 科技效果应用 | ~200 | ✅ 完成(v4.0) |
| **BattleEffectManager** | 战斗特效管理 | ~250 | ✅ 完成(v4.0) |
| **DamageNumberSystem** | 伤害数字动画 | ~200 | ✅ 完成(v4.0) |
| **BattleFragmentRewards** | `calculateFragmentRewards()` | ~80 | ✅ 完成 |

**导出类型**: BattleUnit, BattleTeam, BattleAction, BattleState, BattleResult, DamageResult, BuffEffect, BattleSkill, IBattleEngine, BattleOutcome, BattlePhase, StarRating, TroopType, BattleMode 等

### 3.2 关卡子系统 (`engine/campaign/`)

| 类/模块 | 核心方法 | 行数 | 状态 |
|---------|---------|:----:|:----:|
| **CampaignProgressSystem** | `getStageStatus()`, `getStageStars()`, `unlockStage()`, `clearStage()` | 455 | ✅ 完成 |
| **RewardDistributor** | `distributeRewards()`, `calculateFirstClearBonus()` | 482 | ✅ 完成 |
| **SweepSystem** | `sweep()`, `getTicketCount()`, `canSweep()` | 370 | ✅ 完成 |
| **AutoPushExecutor** | `execute()`, 离线推图逻辑 | 307 | ✅ 完成 |
| **ChallengeStageSystem** | 挑战关卡系统 | 477 | ✅ 完成 |
| **VIPSystem** | VIP等级+特权 | 343 | ✅ 完成 |
| **CampaignSerializer** | `serializeProgress()`, `deserializeProgress()` | 126 | ✅ 完成 |
| **campaign-config** (6章) | 章节数据配置（黄巾→一统天下） | ~1000 | ✅ 完成 |
| **challenge-stages** | 8个挑战关卡配置 | 118 | ✅ 完成 |

**导出类型**: StageType, StageStatus, StarRating, EnemyUnitDef, EnemyFormation, Stage, Chapter, StageState, CampaignProgress, SweepBatchResult, ChallengeStageConfig 等

### 3.3 引擎主类 ThreeKingdomsEngine 的战斗/关卡相关方法

| 方法 | 返回类型 | 说明 |
|------|---------|------|
| `getBattleEngine()` | IBattleEngine | 获取战斗引擎实例 |
| `getCampaignSystem()` | CampaignProgressSystem | 获取关卡进度系统 |
| `getSweepSystem()` | SweepSystem | 获取扫荡系统 |
| `getChapters()` | Chapter[] | 获取所有章节数据 |
| `getCampaignProgress()` | CampaignProgress | 获取关卡进度 |
| `startBattle(stageId)` | BattleResult | 开始战斗 |
| `completeBattle(stageId, stars)` | void | 完成战斗（更新进度+发奖） |
| `buildTeamsForStage(stage)` | {allyTeam, enemyTeam} | 构建战斗双方阵容 |
| `getHeroSystem()` | HeroSystem | 获取武将系统 |
| `getGenerals()` | GeneralData[] | 获取所有武将 |
| `getActiveFormation()` | Formation | 获取当前编队 |
| `setFormation(id, slotIds)` | void | 设置编队 |
| `createFormation()` | Formation | 创建新编队 |
| `getSiegeSystem()` | SiegeSystem | 获取攻城系统 |
| `getTerritorySystem()` | TerritorySystem | 获取领土系统 |

---

## 四、v3.0 PRD需求 vs 现状对照

### 4.1 CBT战斗系统PRD对照

| PRD编号 | 需求 | 现状 | 差距 |
|---------|------|------|------|
| **CBT-1** 战役长卷 | 6章×5关=30关卡，水墨长卷 | ✅ 6章完整配置，横向卷轴地图 | ⚠️ PRD要求30关，实际每章8-12关（更多），地图路线有分支/隐藏/宝箱节点类型未完整渲染 |
| **CBT-2** 战前布阵 | 6武将上阵，一键布阵，智能推荐 | ✅ 前排3+后排3，一键布阵，战力对比 | ⚠️ 缺少智能推荐算法（匹配度评分），缺少阵营羁绊/职业均衡提示 |
| **CBT-3** 战斗机制 | 回合制8回合，怒气大招，状态效果 | ✅ 完整回合制，怒气系统，技能释放 | ⚠️ 缺少半自动/全手动模式切换，缺少兵种克制UI提示，缺少大招时停的UI交互 |
| **CBT-4** 战斗结算 | 星级评定，奖励计算，操作评分 | ✅ 星级+奖励+失败建议 | ⚠️ 缺少操作评分(S/A/B)，缺少掉落表概率展示 |
| **CBT-5** 扫荡系统 | 三星解锁，扫荡令，批量扫荡 | ✅ SweepModal+SweepPanel完整 | ⚠️ SweepModal和SweepPanel功能重复需合并 |
| **CBT-6** 战斗加速 | 1x/2x/3x/极速，高倍速信息简化 | ✅ 1x/2x/4x速度控制 | ⚠️ 缺少VIP3+3x和VIP5+极速，缺少高倍速信息简化策略 |
| **CBT-7** 离线战斗 | 离线推图，挂机收益 | ✅ AutoPushExecutor引擎已实现 | ❌ UI层缺少离线推图设置面板，缺少挂机收益显示 |
| **CBT-8** 挑战关卡 | 8个每日挑战关卡 | ✅ ChallengeStageSystem引擎已实现 | ❌ UI层缺少挑战关卡入口和面板 |

### 4.2 26-campaign-stages UI设计对照

| 设计要素 | 现状 | 差距 |
|---------|------|------|
| 水墨长卷路线图 | ✅ 横向卷轴，关卡节点 | ⚠️ 缺少墨线串联效果，缺少水墨涟漪动效 |
| 关卡节点类型（战斗/剧情/宝箱/隐藏/BOSS） | ⚠️ 仅normal/elite/boss | ❌ 缺少剧情节点、宝箱节点、隐藏节点、分支节点 |
| 关卡详情面板 | ✅ 推荐战力+敌方信息 | ⚠️ 缺少关卡特性（天气/地形）显示 |
| 章节选择界面 | ✅ 章节切换箭头 | ❌ 缺少章节网格选择面板（PRD要求的6章卡片） |
| 三星评价系统 | ✅ 存活+回合数 | ⚠️ 缺少多样化条件（仅用N武将/不用大招等） |
| 自动推图设置 | ❌ 无UI | ❌ 需要新建自动推图设置面板 |
| 扫荡管理面板 | ⚠️ SweepModal仅单关卡 | ❌ 缺少全局扫荡管理面板（多关卡批量扫荡） |
| 手机端竖向路线图 | ❌ 无 | ❌ 缺少移动端适配 |

---

## 五、v3.0需要新建的UI组件清单

### 5.1 P0 — 必须新建（核心玩法缺失）

| 组件 | 对应PRD | 说明 | 估计行数 |
|------|---------|------|:--------:|
| **BattleModeSelector** | CBT-3 | 战斗模式选择（全自动/半自动/全手动） | ~150 |
| **UltimateSkillOverlay** | CBT-3 | 大招时停UI（慢动作+大招选择面板） | ~250 |
| **TroopRestraintIndicator** | CBT-3 | 兵种克制关系指示器 | ~100 |
| **ChapterSelectPanel** | 26-campaign | 章节网格选择面板（6章卡片） | ~300 |
| **ChallengeStageTab** | CBT-8 | 挑战关卡入口+面板（8个每日关卡） | ~400 |
| **AutoPushSettingsPanel** | CBT-7 | 自动推图设置（开关+阈值+重试次数） | ~200 |
| **OfflineBattleReport** | CBT-7 | 离线推图战报（推了哪些关+奖励） | ~250 |
| **IdleRevenueDisplay** | CBT-7 | 挂机收益显示（当前章节产出/小时） | ~150 |

### 5.2 P1 — 应该新建（体验提升）

| 组件 | 对应PRD | 说明 | 估计行数 |
|------|---------|------|:--------:|
| **StageDetailPanel** | 26-campaign | 关卡详情面板（天气/地形/三星条件/奖励预览） | ~350 |
| **FormationRecommendModal** | CBT-2 | 智能推荐方案弹窗（1-3套方案+匹配度评分） | ~400 |
| **BattleOperationScore** | CBT-4 | 操作评分展示（S/A/B评级） | ~100 |
| **DropTablePreview** | CBT-4 | 掉落表概率展示 | ~150 |
| **SweepManagementPanel** | CBT-5 | 全局扫荡管理面板（多关卡批量扫荡+进度） | ~350 |
| **StageNodeTypes** | 26-campaign | 新节点类型渲染（剧情/宝箱/隐藏/分支） | ~300 |
| **CampaignMapEffects** | 26-campaign | 地图动效（水墨展开/通关金光/三星点亮） | ~200 |
| **BattleWeatherEffect** | 26-campaign | 关卡天气/地形效果UI指示 | ~150 |

### 5.3 P2 — 可以新建（锦上添花）

| 组件 | 对应PRD | 说明 | 估计行数 |
|------|---------|------|:--------:|
| **MobileCampaignLayout** | 26-campaign | 手机端竖向关卡路线图 | ~300 |
| **BattleReplayPanel** | — | 战斗回放查看 | ~200 |
| **CampaignStoryDialog** | 26-campaign | 关卡剧情演出弹窗 | ~250 |
| **BranchPathSelector** | 26-campaign | 分支路线选择器（蜀/魏/吴线） | ~200 |

---

## 六、v3.0需要改进的现有组件清单

| 组件 | 当前问题 | 改进方案 | 优先级 |
|------|---------|---------|:------:|
| **CampaignTab.tsx** | 缺少章节网格选择、缺少关卡详情面板、节点类型单一 | 增加ChapterSelectPanel入口、StageDetailPanel、新节点渲染 | P0 |
| **BattleFormationModal.tsx** | 缺少智能推荐算法UI、缺少阵营羁绊提示 | 增加FormationRecommendModal入口、羁绊加成显示 | P1 |
| **BattleScene.tsx** | 缺少战斗模式切换、缺少大招时停UI、缺少兵种克制提示 | 增加BattleModeSelector、UltimateSkillOverlay、TroopRestraintIndicator | P0 |
| **BattleAnimation.tsx** | 速度仅1x/2x/4x，缺少VIP倍速 | 增加VIP3+3x和VIP5+极速，高倍速信息简化 | P1 |
| **BattleResultModal.tsx** | 缺少操作评分、缺少掉落概率展示 | 增加BattleOperationScore、DropTablePreview | P1 |
| **SweepModal.tsx + SweepPanel.tsx** | 功能重复（两个扫荡UI） | 合并为一个组件，SweepPanel作为SweepModal的变体 | P1 |
| **CampaignTab.css** | 缺少水墨风格动效、缺少节点连线效果 | 增加CSS动画（水墨展开/金光/涟漪） | P2 |
| **BattleScene.css** | 缺少天气/地形视觉效果 | 增加天气overlay CSS | P2 |

---

## 七、关键缺口和风险点

### 7.1 🔴 P0 关键缺口

| # | 缺口 | 影响 | 风险等级 |
|---|------|------|:--------:|
| 1 | **战斗模式选择缺失** | PRD要求全自动/半自动/全手动三种模式，当前仅全自动 | 🔴 高 |
| 2 | **大招时停UI缺失** | 引擎已实现UltimateSkillSystem，但UI层无交互入口 | 🔴 高 |
| 3 | **挑战关卡UI完全缺失** | 引擎ChallengeStageSystem已完成，但无UI入口 | 🔴 高 |
| 4 | **离线推图UI缺失** | AutoPushExecutor引擎已完成，但无设置面板和战报展示 | 🟡 中 |
| 5 | **章节选择面板缺失** | 当前仅箭头切换，PRD要求6章卡片网格 | 🟡 中 |

### 7.2 🟡 P1 风险点

| # | 风险 | 说明 |
|---|------|------|
| 1 | **SweepModal/SweepPanel重复** | 两个组件功能高度重叠（~500行重复代码），增加维护成本 |
| 2 | **关卡节点类型不完整** | PRD定义了8种节点类型，当前仅渲染3种（normal/elite/boss） |
| 3 | **智能推荐算法UI未实现** | PRD要求匹配度评分+多方案推荐，当前仅一键布阵 |
| 4 | **VIP系统UI未对接** | 引擎VIPSystem已完成（VIP等级影响扫荡/加速），但UI层无VIP展示 |
| 5 | **挂机收益无UI展示** | 章节挂机收益引擎已计算，但关卡面板未展示 |

### 7.3 🟢 架构风险

| # | 风险 | 说明 |
|---|------|------|
| 1 | **引擎-UI耦合度** | CampaignTab直接调用engine.getXxxSystem()，未通过适配层，引擎重构会波及UI |
| 2 | **状态管理原始** | 使用snapshotVersion+useMemo手动刷新，无响应式状态管理（如Zustand），随组件增多可能性能下降 |
| 3 | **CSS文件碎片化** | 80+个独立CSS文件，无CSS Modules或CSS-in-JS，命名冲突风险 |
| 4 | **无移动端适配** | CampaignTab/BattleScene均为PC端1280×800设计，无响应式布局 |
| 5 | **rendering层未集成** | PixiJS渲染层（battle/map/core）已存在但未与React UI层集成 |

---

## 八、代码规模统计

### 8.1 UI层代码量

| 模块 | TSX/TS文件数 | 总行数 | CSS文件数 |
|------|:----------:|:------:|:--------:|
| 框架层 (three-kingdoms/) | 8 | ~1,400 | 4 |
| 战斗/关卡 (campaign/) | 8 | 2,310 | 9 |
| 武将系统 (hero/) | 40+ | 13,061 | 30+ |
| 世界地图 (map/) | 4 | 1,283 | 4 |
| 建筑系统 (building/) | 3+ | ~1,300 | 3 |
| 科技系统 (tech/) | 4+ | ~1,600 | 4 |
| 其他面板 (16个) | 20+ | ~6,000 | 16 |
| 公共组件 | 8 | ~600 | 4 |
| **UI层合计** | **~95** | **~27,500** | **~80** |

### 8.2 引擎层代码量

| 子系统 | 文件数 | 总行数 |
|--------|:-----:|:------:|
| battle/ | 20+ | ~4,000 |
| campaign/ | 18 | 4,584 |
| hero/ | 10+ | ~3,000 |
| 其他子系统 | 100+ | ~20,000 |
| **引擎层合计** | **150+** | **~31,500** |

### 8.3 测试代码量

| 类型 | 文件数 | 说明 |
|------|:-----:|------|
| ACC系列 (验收测试) | 25+ | ACC-01~13 + FLOW-01~25 + GAP系列 |
| 对抗性测试 | 20+ | battle/campaign/map/hero等 |
| 引擎单元测试 | 50+ | battle/campaign各模块 |
| 集成测试 | 10+ | 场景路由/商店等 |

---

## 九、总结与建议

### 9.1 完成度评估

```
整体UI层完成度: ████████░░░░░░░░  ~75%

按模块:
  框架层:       ████████████████  ~95%  ✅
  武将系统:     ██████████████░░  ~85%  ✅
  建筑系统:     ███████████████░  ~90%  ✅
  科技系统:     ██████████████░░  ~85%  ✅
  世界地图:     ██████████████░░  ~85%  ✅
  资源栏:       ███████████████░  ~90%  ✅
  战斗/关卡:    ████████████░░░░  ~75%  ⚠️ v3.0核心，需补齐
  其他面板:     ████████████░░░░  ~80%  ✅
```

### 9.2 v3.0开发优先级建议

1. **Phase 1 — P0核心补齐**（估计 2-3 周）
   - BattleModeSelector + UltimateSkillOverlay（战斗模式+大招时停）
   - ChallengeStageTab（挑战关卡入口+面板）
   - ChapterSelectPanel（章节选择面板）
   - AutoPushSettingsPanel + OfflineBattleReport（离线推图）

2. **Phase 2 — P1体验提升**（估计 2 周）
   - StageDetailPanel（关卡详情面板）
   - FormationRecommendModal（智能推荐方案）
   - SweepModal/SweepPanel合并 + SweepManagementPanel
   - BattleOperationScore + DropTablePreview

3. **Phase 3 — P2锦上添花**（估计 1-2 周）
   - CampaignMapEffects（水墨动效）
   - MobileCampaignLayout（移动端适配）
   - StageNodeTypes（新节点类型渲染）
   - CampaignStoryDialog（剧情演出）

### 9.3 架构改进建议

1. **引入状态管理**：考虑使用Zustand管理全局游戏状态，替代snapshotVersion手动刷新
2. **UI-Engine适配层**：在components/idle/下增加engine-adapter.ts，封装引擎调用，降低耦合
3. **CSS Modules迁移**：逐步迁移到CSS Modules，避免命名冲突
4. **组件库统一**：SharedPanel作为统一面板壳，所有弹窗/面板统一使用

---

*报告结束 | 2026-05-01*
