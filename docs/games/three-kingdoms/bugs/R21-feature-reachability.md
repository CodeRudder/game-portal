# R21 迭代：v1-v20 功能可达性验证报告

> **验证日期**: 2025-07-09
> **验证范围**: v1.0 ~ v20.0 全部核心功能在 UI 层的可达性
> **验证方法**: 对照版本路线图 → 检查 UI 面板存在性 → 验证入口可达性 → 确认引擎 API 对接

---

## 一、完整可达性矩阵

| 版本 | 核心功能 | UI面板文件 | 入口可达 | 引擎对接 | 状态 |
|------|---------|-----------|---------|---------|------|
| v1.0 | 建筑升级 | `panels/building/BuildingPanel.tsx` | ✅ Tab「建筑」 | ✅ `engine` prop → BuildingSystem | 🟢 完整 |
| v1.0 | 资源生产 | `panels/resource/ResourceBar.tsx` | ✅ 顶部固定 | ✅ `resources/rates/caps` from snapshot | 🟢 完整 |
| v2.0 | 武将招募 | `panels/hero/RecruitModal.tsx` | ✅ HeroTab → 招募按钮 | ✅ `engine.getHeroSystem()` | 🟢 完整 |
| v2.0 | 武将升级 | `panels/hero/HeroDetailModal.tsx` | ✅ HeroTab → 武将卡片 | ✅ `engine.getHeroSystem()` | 🟢 完整 |
| v3.0 | 战役地图 | `panels/campaign/CampaignTab.tsx` | ✅ Tab「关卡」 | ✅ `engine.getCampaignSystem()` | 🟢 完整 |
| v4.0 | 战斗系统 | `panels/campaign/BattleScene.tsx` | ✅ CampaignTab → 战斗触发 | ✅ BattleSystem via CampaignSystem | 🟢 完整 |
| v5.0 | 科技树 | `panels/tech/TechTab.tsx` | ✅ Tab「科技」 | ✅ `engine` prop → TechSystems | 🟢 完整 |
| v6.0 | 声望系统 | `panels/prestige/PrestigePanel.tsx` | ✅ MoreTab「声望」→ FeaturePanel 弹窗 | ✅ `engine.getPrestigeSystem()` | 🟢 完整 |
| v7.0 | 装备系统 | `panels/equipment/EquipmentTab.tsx` | ✅ Tab「装备」 | ✅ `engine.getEquipmentSystem()` + Forge + Enhance | 🟢 完整 |
| v8.0 | 商店系统 | `panels/shop/ShopPanel.tsx` | ✅ MoreTab「商店」→ FeaturePanel 弹窗 | ✅ `engine.getShopSystem()` + `getCurrencySystem()` | 🟢 完整 |
| v8.0 | 贸易路线 | **❌ 无独立UI面板** | ❌ 无入口 | ⚠️ 引擎有 TradeSystem/CaravanSystem 但未挂载到主引擎 | 🔴 缺失 |
| v9.0 | 离线收益 | ThreeKingdomsGame.tsx 内联 Modal | ✅ 主入口自动弹出 | ✅ `engine.load()` → OfflineEarnings | 🟢 完整 |
| v10.0 | 军队编组 | `panels/army/ArmyTab.tsx` | ✅ Tab「军队」 | ✅ `engine.getHeroSystem()` + `getFormationSystem()` | 🟢 完整 |
| v11.0 | PvP竞技 | `panels/arena/ArenaTab.tsx` | ✅ Tab「竞技」 | ✅ `engine.getArenaSystem()` + `getSeasonSystem()` + `getRankingSystem()` | 🟢 完整 |
| v12.0 | 远征系统 | `panels/expedition/ExpeditionTab.tsx` | ✅ Tab「远征」 | ✅ `engine.getExpeditionSystem()` | 🟢 完整 |
| v13.0 | 联盟系统 | `panels/alliance/AlliancePanel.tsx` | ✅ MoreTab「联盟」→ FeaturePanel 弹窗 | ✅ `engine.getAllianceSystem()` + `getAllianceTaskSystem()` | 🟢 完整 |
| v14.0 | 传承系统 | `panels/heritage/HeritagePanel.tsx` | ✅ MoreTab「传承」→ FeaturePanel 弹窗 | ✅ `engine.getHeritageSystem()` | 🟢 完整 |
| v15.0 | 事件系统 | `panels/event/EventBanner.tsx` + `RandomEncounterModal.tsx` | ✅ 主入口自动弹出 + FeatureMenu「事件」 | ✅ engine events `event:banner_created` / `event:encounter_triggered` | 🟢 完整 |
| v16.0 | 传承深化 | `panels/heritage/HeritagePanel.tsx`（复用v14面板） | ✅ 同v14.0入口 | ✅ 同v14.0引擎 | 🟢 完整（复用） |
| v17.0 | 竖屏适配 | `ThreeKingdomsGame.css` @media 响应式 | ✅ 全局CSS | ✅ `--tk-scale` CSS变量 + safe-area | 🟢 完整 |
| v18.0 | 新手引导 | `panels/hero/GuideOverlay.tsx` | ⚠️ 仅在HeroTab内渲染 | ⚠️ 未对接引擎Guide系统，仅用localStorage | 🟡 部分 |
| v19.0 | 天下一统 | `panels/map/WorldMapTab.tsx` | ✅ Tab「天下」 | ✅ `engine.getTerritorySystem()` | 🟢 完整 |
| v20.0 | 云存档/账号 | **❌ 无UI面板** | ❌ 无入口 | ⚠️ 引擎有 SettingsManager/CloudSaveSystem/AccountSystem 但未挂载到主引擎 | 🔴 缺失 |

---

## 二、重点检查项详细分析

### 2.1 v6.0 声望系统 — PrestigePanel ✅

| 检查项 | 结果 | 说明 |
|--------|------|------|
| UI面板存在 | ✅ | `panels/prestige/PrestigePanel.tsx`（110行） |
| 入口可达 | ✅ | MoreTab「声望」按钮 → `setOpenFeature('prestige')` → FeaturePanel 弹窗渲染 |
| 引擎对接 | ✅ | `engine.getPrestigeSystem()` → `ps.getPrestigePanel()` / `getCurrentLevelInfo()` / `getLevelRewards()` / `getSourceConfigs()` / `claimLevelReward()` |
| 功能完整度 | ✅ | 声望等级卡片 + 进度条 + 产出加成 + 获取途径 + 等级奖励领取 |

**结论**: 声望系统面板完整，引擎API对接正确，通过 MoreTab 可达。

---

### 2.2 v8.0 商贸系统 — ShopPanel ✅ / 贸易路线 ❌

#### 商店系统 (ShopPanel)

| 检查项 | 结果 | 说明 |
|--------|------|------|
| UI面板存在 | ✅ | `panels/shop/ShopPanel.tsx`（263行） |
| 入口可达 | ✅ | MoreTab「商店」按钮 → FeaturePanel 弹窗 |
| 引擎对接 | ✅ | `engine.getShopSystem()` + `engine.getCurrencySystem()` |
| 功能完整度 | ✅ | 4类商店Tab（杂货铺/竞技/远征/联盟）+ 货币显示 + 商品卡片 + 折扣 + 限购 + 购买确认弹窗 |

#### 贸易路线 (TradeRoute)

| 检查项 | 结果 | 说明 |
|--------|------|------|
| UI面板存在 | ❌ | **不存在** TradePanel / TradeTab / CaravanPanel 等任何商贸路线UI组件 |
| 入口可达 | ❌ | **无入口** — MoreTab、FeatureMenu、TABS 中均无商贸路线入口 |
| 引擎对接 | ❌ | TradeSystem/CaravanSystem 存在于 `engine/trade/` 目录，但**未集成到 ThreeKingdomsEngine.ts** — 无 import、无实例化、无 getter |
| 路线图要求 | ❌ | v8.0 路线图模块B要求：贸易路线地图(8城节点)、商品系统(10种)、商队管理、商路开通、护卫武将派遣 — 全部缺失 |

**结论**: ShopPanel 商店部分完整；**贸易路线（TRD模块）完全缺失**，既无UI也无引擎集成。

---

### 2.3 v13.0 联盟系统 — AlliancePanel ✅

| 检查项 | 结果 | 说明 |
|--------|------|------|
| UI面板存在 | ✅ | `panels/alliance/AlliancePanel.tsx`（162行） |
| 入口可达 | ✅ | MoreTab「联盟」按钮 → FeaturePanel 弹窗 |
| 引擎对接 | ✅ | `engine.getAllianceSystem()` + `engine.getAllianceTaskSystem()` |
| 功能完整度 | ✅ | 创建联盟 + 联盟信息(名称/等级/宣言/经验) + 成员列表(角色/战力) + 联盟任务(进度/奖励) + 加成显示 |

**结论**: 联盟系统面板完整，包含信息/成员/任务三个子Tab，引擎API对接正确。

---

### 2.4 v18.0 新手引导 — GuideOverlay 🟡

| 检查项 | 结果 | 说明 |
|--------|------|------|
| UI面板存在 | ✅ | `panels/hero/GuideOverlay.tsx`（154行） |
| 入口可达 | ⚠️ | **仅在 HeroTab 内部渲染**（HeroTab.tsx L236），非全局入口 |
| 引擎对接 | ❌ | **未对接引擎 Guide 系统** — 仅使用 `localStorage` 存储进度 |
| 引擎系统存在 | ✅ | `engine/guide/` 目录有完整子系统：TutorialStateMachine、StoryEventPlayer、TutorialMaskSystem、TutorialStepManager、FirstLaunchDetector 等 |
| 引擎集成 | ❌ | ThreeKingdomsEngine.ts 中**无任何 guide 相关 import/实例化/getter** |

**具体问题**:
1. **触发范围过窄**: GuideOverlay 仅在 HeroTab 渲染，v18.0 路线图要求全局引导（主城概览→建造农田→招募武将→首次出征→查看资源→科技研究 6步核心引导）
2. **未使用引擎引导状态机**: 引擎有完整的 TutorialStateMachine + StoryEventPlayer，但 UI 层完全未调用
3. **缺少剧情事件播放**: 8段剧情事件（桃园结义/黄巾之乱/三顾茅庐等）无 UI 实现
4. **缺少引导遮罩系统**: 引擎有 TutorialMaskSystem（聚焦遮罩+高亮裁切+引导手指动画），但 UI 层未集成
5. **缺少首次启动检测**: 引擎有 FirstLaunchDetector，但未在 ThreeKingdomsGame.tsx 中调用

**结论**: GuideOverlay 是一个简化版的引导实现，仅覆盖武将Tab的4步引导，与v18.0路线图要求的完整引导系统差距较大。

---

### 2.5 v20.0 云存档/账号 — 无UI 🔴

| 检查项 | 结果 | 说明 |
|--------|------|------|
| UI面板存在 | ❌ | **不存在** SettingsPanel / CloudSavePanel / AccountPanel 等任何设置UI |
| 入口可达 | ❌ | MoreTab 中**无设置/云存档/账号入口** |
| 引擎系统存在 | ✅ | `engine/settings/` 目录有完整子系统：SettingsManager、CloudSaveSystem、AccountSystem、SaveSlotManager、AudioManager、GraphicsManager、AnimationController |
| 引擎集成 | ❌ | ThreeKingdomsEngine.ts 中**无任何 settings 相关 import/实例化/getter** |
| v20.0路线图 | — | v20.0 路线图实际聚焦于全系统联调+数值平衡+性能优化+交互终审，未明确定义云存档/账号UI模块 |

**具体问题**:
1. **无设置入口**: MoreTab 9个功能项中无「设置」按钮
2. **引擎系统未挂载**: SettingsManager/CloudSaveSystem/AccountSystem/SaveSlotManager 均未集成到主引擎
3. **无法调整画质/音效/动画**: 用户无法通过UI控制游戏表现设置
4. **无云存档操作界面**: 无法手动保存/加载/切换存档槽位
5. **无账号绑定界面**: 无法进行账号登录/绑定/跨设备同步操作

**结论**: v20.0 设置/云存档/账号系统**完全缺失UI层**，引擎层有独立实现但未集成到主引擎。

---

## 三、问题汇总

### 🔴 严重问题 (P0) — 功能完全缺失

| # | 版本 | 问题 | 影响 |
|---|------|------|------|
| BUG-01 | v8.0 | **贸易路线UI完全缺失** — 无 TradePanel/TradeTab/CaravanPanel，引擎 TradeSystem/CaravanSystem 未集成到主引擎 | v8.0 路线图模块B（11个功能点）全部不可达 |
| BUG-02 | v20.0 | **设置/云存档/账号UI完全缺失** — 无 SettingsPanel，引擎 SettingsManager/CloudSaveSystem/AccountSystem 未集成到主引擎 | 用户无法调整画质/音效/动画设置，无法手动管理存档，无法账号绑定 |

### 🟡 中等问题 (P1) — 功能不完整

| # | 版本 | 问题 | 影响 |
|---|------|------|------|
| BUG-03 | v18.0 | **新手引导未对接引擎** — GuideOverlay 仅用 localStorage，未调用引擎 TutorialStateMachine/TutorialMaskSystem/StoryEventPlayer | 引导无法跨设备同步，无法播放剧情事件，无聚焦遮罩高亮 |
| BUG-04 | v18.0 | **引导触发范围过窄** — GuideOverlay 仅在 HeroTab 内渲染，非全局引导 | 用户从其他Tab进入时不会触发引导，不符合v18.0「首次启动自动触发核心引导」要求 |
| BUG-05 | v18.0 | **缺少剧情事件UI** — 8段剧情事件（桃园结义/黄巾之乱等）无 UI 组件 | v18.0 路线图模块B（4个功能点）不可达 |
| BUG-06 | v18.0 | **缺少首次启动检测** — FirstLaunchDetector 未在 ThreeKingdomsGame.tsx 中调用 | v18.0 路线图模块F（首次启动流程+新手保护）不可达 |

### 🟢 已确认正常

| 版本 | 功能 | 入口路径 |
|------|------|---------|
| v1.0 | 建筑升级 | Tab「建筑」→ BuildingPanel |
| v1.0 | 资源生产 | 顶部 ResourceBar |
| v2.0 | 武将招募/升级 | Tab「武将」→ HeroTab → RecruitModal / HeroDetailModal |
| v3.0 | 战役地图 | Tab「关卡」→ CampaignTab |
| v4.0 | 战斗系统 | CampaignTab → BattleScene |
| v5.0 | 科技树 | Tab「科技」→ TechTab |
| v6.0 | 声望系统 | Tab「更多」→ MoreTab「声望」→ FeaturePanel → PrestigePanel |
| v7.0 | 装备系统 | Tab「装备」→ EquipmentTab |
| v8.0 | 商店系统 | Tab「更多」→ MoreTab「商店」→ FeaturePanel → ShopPanel |
| v9.0 | 离线收益 | 主入口自动弹出 Modal |
| v10.0 | 军队编组 | Tab「军队」→ ArmyTab |
| v11.0 | PvP竞技 | Tab「竞技」→ ArenaTab |
| v12.0 | 远征系统 | Tab「远征」→ ExpeditionTab |
| v13.0 | 联盟系统 | Tab「更多」→ MoreTab「联盟」→ FeaturePanel → AlliancePanel |
| v14.0 | 传承系统 | Tab「更多」→ MoreTab「传承」→ FeaturePanel → HeritagePanel |
| v15.0 | 事件系统 | 主入口 EventBanner + FeatureMenu「事件」+ RandomEncounterModal |
| v16.0 | 传承深化 | 复用 v14.0 HeritagePanel |
| v17.0 | 竖屏适配 | 全局 CSS @media 响应式 + --tk-scale 变量 |
| v19.0 | 天下一统 | Tab「天下」→ WorldMapTab |

---

## 四、统计数据

| 指标 | 数值 |
|------|------|
| 总版本数 | 20 |
| 总核心功能点 | 23 |
| ✅ 完整可达 | 19 (82.6%) |
| 🟡 部分可达 | 2 (8.7%) — v18.0引导(简化版存在) / v8.0商贸(仅商店) |
| 🔴 完全不可达 | 2 (8.7%) — v8.0贸易路线 / v20.0设置面板 |
| P0 严重问题 | 2 |
| P1 中等问题 | 4 |

---

## 五、修复建议

### BUG-01: v8.0 贸易路线 UI 缺失

**优先级**: P0
**工作量**: 约3-4天

1. **引擎集成**: 在 ThreeKingdomsEngine.ts 中 import 并实例化 TradeSystem + CaravanSystem
2. **创建 TradePanel**: 新建 `panels/trade/TradeTab.tsx`，包含：
   - 贸易路线地图（8城节点 + 商路连线）
   - 商品价格波动面板
   - 商队管理面板（载重/速度/护卫/议价）
   - 护卫武将派遣选择
3. **添加入口**: 在 MoreTab 中添加「商贸」按钮，或作为独立 Tab 加入 TABS 配置
4. **FeatureMenu**: 在 FEATURE_ITEMS 中添加商贸入口

### BUG-02: v20.0 设置/云存档/账号 UI 缺失

**优先级**: P0
**工作量**: 约2-3天

1. **引擎集成**: 在 ThreeKingdomsEngine.ts 中 import 并实例化 SettingsManager + CloudSaveSystem + AccountSystem + SaveSlotManager
2. **创建 SettingsPanel**: 新建 `panels/settings/SettingsPanel.tsx`，包含：
   - 画质设置（GraphicsManager）
   - 音效设置（AudioManager）
   - 动画设置（AnimationController）
   - 云存档管理（CloudSaveSystem — 手动保存/加载/存档槽位）
   - 账号管理（AccountSystem — 登录/绑定/跨设备同步）
3. **添加入口**: 在 MoreTab 中添加「设置」按钮（齿轮图标 ⚙️）

### BUG-03~06: v18.0 新手引导完善

**优先级**: P1
**工作量**: 约3-5天

1. **引擎集成**: 在 ThreeKingdomsEngine.ts 中 import 并实例化 TutorialStateMachine + TutorialMaskSystem + StoryEventPlayer + FirstLaunchDetector
2. **提升 GuideOverlay 为全局组件**: 从 HeroTab 中提取到 ThreeKingdomsGame.tsx 根层级渲染
3. **对接引擎引导状态机**: 替换 localStorage 为引擎 TutorialStateMachine 状态管理
4. **添加剧情事件 UI**: 创建 StoryEventPlayerModal 组件
5. **首次启动检测**: 在 ThreeKingdomsGame.tsx 初始化流程中调用 FirstLaunchDetector
6. **引导遮罩集成**: 使用引擎 TutorialMaskSystem 替换当前简单遮罩

---

## 六、附录：入口路由图

```
ThreeKingdomsGame.tsx (主容器)
├── ResourceBar (顶部固定)                    ← v1.0 资源生产
├── EventBanner (顶部横幅)                    ← v15.0 事件系统
├── TABS[11个Tab按钮]
│   ├── building → BuildingPanel             ← v1.0 建筑升级
│   ├── hero → HeroTab                       ← v2.0 武将系统
│   │   ├── RecruitModal                     ← v2.0 武将招募
│   │   ├── HeroDetailModal                  ← v2.0 武将升级
│   │   ├── GuideOverlay                     ← v18.0 新手引导(仅此处)
│   │   └── FormationPanel                   ← v10.0 阵型
│   ├── tech → TechTab                       ← v5.0 科技树
│   ├── campaign → CampaignTab               ← v3.0/v4.0 战役/战斗
│   │   ├── BattleScene                      ← v4.0 战斗系统
│   │   └── SweepPanel                       ← 扫荡
│   ├── equipment → EquipmentTab             ← v7.0 装备系统
│   ├── map → WorldMapTab                    ← v19.0 天下一统
│   ├── npc → NPCTab                         ← NPC系统
│   ├── arena → ArenaTab                     ← v11.0 PvP竞技
│   ├── expedition → ExpeditionTab           ← v12.0 远征系统
│   ├── army → ArmyTab                       ← v10.0 军队编组
│   └── more → MoreTab                       ← 更多功能入口
│       ├── quest → FeaturePanel → QuestPanel
│       ├── shop → FeaturePanel → ShopPanel          ← v8.0 商店 ✅
│       ├── mail → FeaturePanel → MailPanel
│       ├── achievement → FeaturePanel → AchievementPanel
│       ├── activity → FeaturePanel → ActivityPanel
│       ├── alliance → FeaturePanel → AlliancePanel  ← v13.0 联盟 ✅
│       ├── prestige → FeaturePanel → PrestigePanel  ← v6.0 声望 ✅
│       ├── heritage → FeaturePanel → HeritagePanel  ← v14.0/v16.0 传承 ✅
│       └── social → FeaturePanel → SocialPanel
├── FeatureMenu (Tab栏右侧功能菜单)
│   ├── worldmap → 切换到 map Tab
│   ├── equipment → 切换到 equipment Tab
│   ├── arena → 切换到 arena Tab
│   ├── expedition → 切换到 expedition Tab
│   ├── events → FeaturePanel → 事件面板
│   ├── npc → 切换到 npc Tab
│   ├── mail/social/heritage/activity → FeaturePanel 弹窗
│   └── ❌ 缺少: 贸易路线 / 设置
├── Modal (离线收益)                          ← v9.0 离线收益
└── RandomEncounterModal                     ← v15.0 随机遭遇

❌ 缺失入口:
  - 贸易路线 (TradePanel) — 无UI无入口
  - 设置面板 (SettingsPanel) — 无UI无入口
  - 引导系统全局触发 — 仅在HeroTab内
```

---

*报告结束。建议优先修复 BUG-01（贸易路线）和 BUG-02（设置面板），然后完善 BUG-03~06（新手引导）。*
