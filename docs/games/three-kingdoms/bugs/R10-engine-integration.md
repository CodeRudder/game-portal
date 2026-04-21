# R10 迭代报告：引擎对接验证

> **验证日期**: 2025-07-11
> **验证范围**: 全部功能面板与引擎 API 的数据对接
> **项目路径**: `src/games/three-kingdoms/` + `src/components/idle/`
> **引擎入口**: `ThreeKingdomsEngine` (`engine/ThreeKingdomsEngine.ts`)

---

## 概述

### 引擎已注册子系统 (23个)
`resource`, `building`, `calendar`, `hero`, `heroRecruit`, `heroLevel`, `heroFormation`, `heroStarSystem`, `battleEngine`, `campaignSystem`, `rewardDistributor`, `sweepSystem`, `techTree`, `techPoint`, `techResearch`, `fusionTech`, `techLink`, `techOffline`, `worldMap`, `territory`, `siege`, `garrison`, `siegeEnhancer`

### 引擎已暴露的 Getter 方法 (17个)
`getHeroSystem()`, `getRecruitSystem()`, `getLevelSystem()`, `getFormationSystem()`, `getHeroStarSystem()`, `getSweepSystem()`, `getBattleEngine()`, `getCampaignSystem()`, `getRewardDistributor()`, `getTechTreeSystem()`, `getTechPointSystem()`, `getTechResearchSystem()`, `getWorldMapSystem()`, `getTerritorySystem()`, `getSiegeSystem()`, `getGarrisonSystem()`, `getFusionTechSystem()`, `getTechLinkSystem()`, `getTechOfflineSystem()`, `getTechDetailProvider()`

### 引擎未暴露但面板调用的系统 (14个)
`getMailSystem()`, `getQuestSystem()`, `getAchievementSystem()`, `getAllianceSystem()`, `getAllianceTaskSystem()`, `getFriendSystem()`, `getPrestigeSystem()`, `getHeritageSystem()`, `getActivitySystem()`, `getEquipmentSystem()`, `getEquipmentForgeSystem()`, `getEquipmentEnhanceSystem()`, `getExpeditionSystem()`, `getArenaSystem()`, `getSeasonSystem()`, `getRankingSystem()`, `getShopSystem()`, `getCurrencySystem()`

---

## 面板验证结果

### ✅ BuildingPanel (核心Tab)
| 检查项 | 状态 | 说明 |
|--------|------|------|
| 数据获取 | ✅ | `engine.checkUpgrade(type)`, `engine.getUpgradeCost(type)`, `engine.getUpgradeProgress(type)`, `engine.getUpgradeRemainingTime(type)` |
| 操作调用 | ✅ | `engine.upgradeBuilding(type)` |
| 空数据防护 | ✅ | `if (!snapshot)` 加载中占位 |
| 错误处理 | ✅ | try/catch + `addToast('建筑升级失败', 'error')` |
| 操作后刷新 | ✅ | snapshot 通过 Context 自动更新 |
| 防抖保护 | ✅ | `useDebouncedAction(handleUpgrade, 500)` |
| **备注** | — | 两个版本：`three-kingdoms/ui/components/BuildingPanel.tsx` (GameContext) 和 `components/idle/panels/building/BuildingPanel.tsx` (props engine)。主容器用的是后者。 |

### ✅ HeroTab (核心Tab)
| 检查项 | 状态 | 说明 |
|--------|------|------|
| 数据获取 | ✅ | `engine.getGenerals()`, `engine.getHeroSystem().calculatePower()`, `engine.getHeroSystem().calculateTotalPower()` |
| 操作调用 | ✅ | `engine.getGeneral(id)` (详情刷新) |
| 空数据防护 | ✅ | 有空列表引导UI |
| 错误处理 | ⚠️ | 无 try/catch 包裹引擎调用 |
| 操作后刷新 | ✅ | `snapshotVersion` 依赖触发重渲染 |
| **备注** | — | 招募弹窗(RecruitModal)、详情弹窗(HeroDetailModal)、编队(FormationPanel) 均通过 engine 直接操作 |

### ✅ TechTab (核心Tab)
| 检查项 | 状态 | 说明 |
|--------|------|------|
| 数据获取 | ✅ | `engine.getTechTreeSystem()`, `engine.getTechResearchSystem()`, `engine.getTechPointSystem()` |
| 操作调用 | ✅ | `treeSystem.getAllNodeStates()`, `researchSystem.getQueue()`, `pointSystem.getTechPointState()` 等 |
| 空数据防护 | ✅ | 所有 `useMemo` 有默认值 |
| 错误处理 | ⚠️ | 无 try/catch 包裹引擎调用 |
| 操作后刷新 | ✅ | `snapshotVersion` + 1秒 `tick` 计时器驱动研究进度更新 |
| **备注** | — | TechTreeView 组件使用 GameContext 模式，TechTab 使用 props 模式 |

### ✅ CampaignTab (核心Tab)
| 检查项 | 状态 | 说明 |
|--------|------|------|
| 数据获取 | ✅ | `engine.getChapters()`, `engine.getCampaignSystem()`, `engine.getCampaignProgress()` |
| 操作调用 | ✅ | `engine.startBattle(stageId)`, `engine.completeBattle(stageId, stars)` |
| 空数据防护 | ✅ | `if (!ch)` 返回空数据 |
| 错误处理 | ⚠️ | `startBattle` 内部可能 throw，UI 层无 try/catch |
| 操作后刷新 | ✅ | `snapshotVersion` 驱动 |
| **备注** | — | `startBattle` 引擎内部会 throw `关卡不存在` / `关卡未解锁`，但 CampaignTab 未捕获 |

### ⚠️ WorldMapTab (功能菜单)
| 检查项 | 状态 | 说明 |
|--------|------|------|
| 数据获取 | ✅ | 通过 `ThreeKingdomsGame` 中间层：`engine.getTerritorySystem().getAllTerritories()`, `getTerritorySystem().getPlayerProductionSummary()` |
| 操作调用 | ⚠️ | `onSelectTerritory` / `onSiegeTerritory` 仅 Toast 提示，未实际调用引擎 |
| 空数据防护 | ✅ | props 传入，组件内部有默认值 |
| 错误处理 | ✅ | 无引擎直接调用，无报错风险 |
| 操作后刷新 | ✅ | `snapshotVersion` 驱动 |
| **备注** | — | 攻城功能未对接引擎，仅占位 |

### ⚠️ EquipmentTab (功能菜单)
| 检查项 | 状态 | 说明 |
|--------|------|------|
| 数据获取 | ❌ | `(engine as any)?.equipment ?? (engine as any)?.getEquipmentSystem?.()` — **引擎无此属性/方法** |
| 操作调用 | ❌ | `forgeSys.basicForge()`, `enhanceSys` — **引擎未暴露装备子系统** |
| 空数据防护 | ✅ | 可选链 `??` 降级为空数组 |
| 错误处理 | ✅ | 操作前检查 `if (!forgeSys)` |
| 操作后刷新 | ⚠️ | 依赖 `snapshotVersion` 但子系统不存在，永远为空 |
| **备注** | — | **P0**: `core/equipment/` 有类型定义但引擎未集成装备系统 |

### ⚠️ ArenaTab (功能菜单)
| 检查项 | 状态 | 说明 |
|--------|------|------|
| 数据获取 | ❌ | `engine?.getArenaSystem?.() ?? engine?.arena` — **引擎无此属性/方法** |
| 操作调用 | ❌ | `arenaSys?.executeBattle?.()` — **引擎无竞技场系统** |
| 空数据防护 | ✅ | 可选链降级为 null |
| 错误处理 | ⚠️ | `executeBattle` 降级为 `Math.random()` 模拟结果 |
| 操作后刷新 | ⚠️ | 无真实数据 |
| **备注** | — | **P0**: `core/pvp/pvp.types.ts` 有类型定义但引擎未集成 PvP 系统 |

### ⚠️ ExpeditionTab (功能菜单)
| 检查项 | 状态 | 说明 |
|--------|------|------|
| 数据获取 | ❌ | `engine?.getExpeditionSystem?.() ?? engine?.expedition` — **引擎无此属性/方法** |
| 操作调用 | ❌ | `expeditionSystem?.getAllRoutes?.()` 等 — **引擎未暴露远征系统** |
| 空数据防护 | ✅ | 可选链降级为空数组 |
| 错误处理 | ✅ | 无引擎调用，无报错风险 |
| 操作后刷新 | ⚠️ | 无真实数据 |
| **备注** | — | **P0**: `core/expedition/expedition.types.ts` 有类型定义但引擎未集成远征系统 |

### ⚠️ NPCTab (功能菜单)
| 检查项 | 状态 | 说明 |
|--------|------|------|
| 数据获取 | ⚠️ | `ThreeKingdomsGame` 中 `(engine as any).npcSystem` — 引擎无此属性 |
| 操作调用 | ⚠️ | `onSelectNPC` / `onStartDialog` 仅 Toast 提示 |
| 空数据防护 | ✅ | 降级返回空数组 |
| 错误处理 | ✅ | 无引擎调用 |
| 操作后刷新 | ⚠️ | NPC列表永远为空 |
| **备注** | — | **P1**: `core/npc/` 有完整类型定义和NPC管理器，但引擎未集成到主类 |

### ⚠️ MailPanel (功能菜单)
| 检查项 | 状态 | 说明 |
|--------|------|------|
| 数据获取 | ❌ | `engine?.getMailSystem?.() ?? engine?.mail` — **引擎无此属性/方法** |
| 操作调用 | ❌ | `mailSystem.getMails()`, `claimAttachments()`, `markRead()` 等 — 全部静默失败 |
| 空数据防护 | ✅ | `mailSystem` 为 undefined 时降级为空数组 |
| 错误处理 | ✅ | 可选链避免崩溃 |
| 操作后刷新 | ⚠️ | 无真实数据，永远显示空列表 |
| **备注** | — | **P0**: `engine/mail/MailSystem.ts` 已实现，但 ThreeKingdomsEngine 未集成 |

### ⚠️ QuestPanel (功能菜单)
| 检查项 | 状态 | 说明 |
|--------|------|------|
| 数据获取 | ❌ | `engine?.getQuestSystem?.() ?? engine?.quest` — **引擎无此属性/方法** |
| 操作调用 | ❌ | `qs.claimReward()`, `qs.claimAllRewards()`, `qs.claimActivityMilestone()` — 全部静默失败 |
| 空数据防护 | ✅ | 可选链降级 |
| 错误处理 | ✅ | `flash()` 提示"领取失败" |
| 操作后刷新 | ⚠️ | 无真实数据 |
| **备注** | — | **P0**: `core/quest/` 有类型定义但引擎未集成任务系统 |

### ⚠️ AchievementPanel (功能菜单)
| 检查项 | 状态 | 说明 |
|--------|------|------|
| 数据获取 | ❌ | `engine?.getAchievementSystem?.() ?? engine?.achievement` — **引擎无此属性/方法** |
| 操作调用 | ❌ | `ach.claimReward()` — 静默失败 |
| 空数据防护 | ✅ | 可选链降级 |
| 错误处理 | ✅ | `flash()` 提示 |
| 操作后刷新 | ⚠️ | 无真实数据 |
| **备注** | — | **P0**: `core/achievement/` 有类型定义但引擎未集成成就系统 |

### ⚠️ AlliancePanel (功能菜单)
| 检查项 | 状态 | 说明 |
|--------|------|------|
| 数据获取 | ❌ | `engine?.getAllianceSystem?.() ?? engine?.alliance` — **引擎无此属性/方法** |
| 操作调用 | ❌ | 创建联盟使用 `prompt()` + `flash()`，未调用引擎 |
| 空数据防护 | ✅ | 可选链降级 |
| 错误处理 | ✅ | 无引擎调用 |
| 操作后刷新 | ⚠️ | 无真实数据 |
| **备注** | — | **P0**: `core/alliance/` 有类型定义但引擎未集成联盟系统 |

### ⚠️ PrestigePanel (功能菜单)
| 检查项 | 状态 | 说明 |
|--------|------|------|
| 数据获取 | ❌ | `engine?.getPrestigeSystem?.() ?? engine?.prestige` — **引擎无此属性/方法** |
| 操作调用 | ❌ | `ps?.claimLevelReward?.()` — 静默失败 |
| 空数据防护 | ✅ | 可选链降级，默认值完整 |
| 错误处理 | ✅ | `flash()` 提示 |
| 操作后刷新 | ⚠️ | 无真实数据 |
| **备注** | — | **P0**: `core/prestige/` 有类型定义但引擎未集成声望系统 |

### ⚠️ SocialPanel (功能菜单)
| 检查项 | 状态 | 说明 |
|--------|------|------|
| 数据获取 | ❌ | `engine?.getFriendSystem?.() ?? engine?.social?.friendSystem` — **引擎无此属性/方法** |
| 操作调用 | ❌ | `friendSystem?.giftTroops?.()`, `friendSystem?.visitCastle?.()` — 静默失败 |
| 空数据防护 | ✅ | 可选链降级 |
| 错误处理 | ✅ | try/catch 包裹操作，catch 显示错误信息 |
| 操作后刷新 | ⚠️ | 无真实数据 |
| **备注** | — | **P0**: `core/social/` 有类型定义但引擎未集成社交系统 |

### ⚠️ HeritagePanel (功能菜单)
| 检查项 | 状态 | 说明 |
|--------|------|------|
| 数据获取 | ❌ | `engine?.getHeritageSystem?.() ?? engine?.heritage` — **引擎无此属性/方法** |
| 操作调用 | ❌ | `heritageSystem?.claimInitialGift?.()`, `executeRebuild?.()` — 静默失败 |
| 空数据防护 | ✅ | 可选链降级 |
| 错误处理 | ✅ | `flash()` 提示 |
| 操作后刷新 | ⚠️ | 无真实数据 |
| **备注** | — | **P0**: `core/heritage/` 有类型定义但引擎未集成传承系统 |

### ⚠️ ActivityPanel (功能菜单)
| 检查项 | 状态 | 说明 |
|--------|------|------|
| 数据获取 | ❌ | `engine?.getActivitySystem?.() ?? engine?.activity` — **引擎无此属性/方法** |
| 操作调用 | ❌ | `activitySystem?.claimTaskReward?.()`, `claimMilestone?.()` — 静默失败 |
| 空数据防护 | ✅ | 可选链降级 |
| 错误处理 | ✅ | try/catch 包裹操作 |
| 操作后刷新 | ⚠️ | 无真实数据 |
| **备注** | — | **P0**: `core/activity/` 有类型定义但引擎未集成活动系统 |

### ✅ EventBanner (全局组件)
| 检查项 | 状态 | 说明 |
|--------|------|------|
| 数据获取 | ✅ | 通过 `ThreeKingdomsGame` 事件监听 `event:banner_created` |
| 操作调用 | ✅ | `onDismiss` 回调清理状态 |
| 空数据防护 | ✅ | `banner === null` 不渲染 |
| 错误处理 | ✅ | 无引擎直接调用 |
| 操作后刷新 | ✅ | 事件驱动 |
| **备注** | — | 事件数据通过 `engine.on()` 监听获取，类型为 `any` |

### ⚠️ ShopPanel (功能菜单)
| 检查项 | 状态 | 说明 |
|--------|------|------|
| 数据获取 | ❌ | `engine?.getShopSystem?.() ?? engine?.shop` — **引擎无此属性/方法** |
| 操作调用 | ❌ | 购买操作静默失败 |
| 空数据防护 | ✅ | try/catch + 可选链 |
| 错误处理 | ✅ | try/catch 包裹 |
| 操作后刷新 | ⚠️ | 无真实数据 |
| **备注** | — | **P0**: `engine/shop/ShopSystem.ts` 已实现，但未集成到主引擎 |

---

## 问题汇总

### P0 — 引擎未集成子系统（面板完全无数据）

| 编号 | 面板 | 缺失系统 | core/ 层状态 | engine/ 层状态 |
|------|------|----------|-------------|---------------|
| P0-01 | MailPanel | `getMailSystem()` | ✅ 类型已定义 | ✅ `engine/mail/MailSystem.ts` 已实现，未接入主引擎 |
| P0-02 | QuestPanel | `getQuestSystem()` | ✅ 类型已定义 | ❌ 无实现 |
| P0-03 | AchievementPanel | `getAchievementSystem()` | ✅ 类型已定义 | ❌ 无实现 |
| P0-04 | AlliancePanel | `getAllianceSystem()` | ✅ 类型已定义 | ❌ 无实现 |
| P0-05 | PrestigePanel | `getPrestigeSystem()` | ✅ 类型已定义 | ❌ 无实现 |
| P0-06 | SocialPanel | `getFriendSystem()` | ✅ 类型已定义 | ❌ 无实现 |
| P0-07 | HeritagePanel | `getHeritageSystem()` | ✅ 类型已定义 | ❌ 无实现 |
| P0-08 | ActivityPanel | `getActivitySystem()` | ✅ 类型已定义 | ❌ 无实现 |
| P0-09 | EquipmentTab | `getEquipmentSystem()` | ✅ 类型已定义 | ❌ 无实现 |
| P0-10 | ArenaTab | `getArenaSystem()` | ✅ 类型已定义 (`core/pvp/`) | ❌ 无实现 |
| P0-11 | ExpeditionTab | `getExpeditionSystem()` | ✅ 类型已定义 (`core/expedition/`) | ❌ 无实现 |
| P0-12 | ShopPanel | `getShopSystem()` | ✅ 类型已定义 | ✅ `engine/shop/ShopSystem.ts` 已实现，未接入主引擎 |
| P0-13 | NPCTab | NPC系统集成 | ✅ 类型+实现完整 (`core/npc/`) | ⚠️ 引擎有 `engine/npc/` 但主类未暴露 |

### P1 — 数据对接问题（面板有数据但存在隐患）

| 编号 | 面板 | 问题描述 |
|------|------|---------|
| P1-01 | CampaignTab | `engine.startBattle()` 可能 throw（关卡不存在/未解锁），但 UI 层无 try/catch，会导致未捕获异常 |
| P1-02 | HeroTab | 引擎调用无 try/catch 保护，若引擎内部异常会导致 React 渲染崩溃 |
| P1-03 | TechTab | 同上，引擎调用无错误边界保护 |
| P1-04 | WorldMapTab | 攻城操作 `onSiegeTerritory` 仅 Toast 占位，未调用 `engine.getSiegeSystem()` |
| P1-05 | ThreeKingdomsGame | NPC 数据通过 `(engine as any).npcSystem` 获取，类型不安全且引擎无此属性 |
| P1-06 | ThreeKingdomsGame | 邮件 badge 通过 `(engine as any).mail ?? (engine as any).getMailSystem?.()` 获取，类型不安全 |
| P1-07 | EventBanner | 事件数据类型为 `any`，缺少 `EventBannerData` 的类型校验 |
| P1-08 | ArenaTab | `executeBattle` 降级为 `Math.random()` 模拟，用户可能误以为真实对战 |
| P1-09 | EquipmentTab | 锻造/强化系统引用 `(engine as any)` 强制转型，类型不安全 |
| P1-10 | 多个面板 | 功能菜单面板使用 `engine: any` 类型，丧失 TypeScript 类型检查保护 |

### P2 — 代码质量问题

| 编号 | 面板 | 问题描述 |
|------|------|---------|
| P2-01 | ThreeKingdomsGame | 存在两套 BuildingPanel：`three-kingdoms/ui/components/BuildingPanel.tsx` (GameContext) 和 `components/idle/panels/building/BuildingPanel.tsx` (props)，后者为主 |
| P2-02 | ThreeKingdomsGame | 存在两套引擎 tick：`useGameEngine` hook (100ms) 和 `ThreeKingdomsGame` 自建 (500ms)，使用后者 |
| P2-03 | ThreeKingdomsGame | `EquipmentBag` 和 `ArenaPanel` 从 `three-kingdoms/ui/components` 导入但未实际使用（被 Tab 组件替代） |
| P2-04 | EquipmentBag | `import { useGameContext }` 但实际通过 props 接收数据，Context 导入多余 |
| P2-05 | 多个面板 | `message` 状态通过 `setTimeout` 手动清除，若快速操作可能产生竞态 |

---

## 统计

| 类别 | 数量 |
|------|------|
| 验证面板总数 | 18 |
| ✅ 完全对接 | 5 (BuildingPanel, HeroTab, TechTab, CampaignTab, EventBanner) |
| ⚠️ 部分对接 | 13 (WorldMapTab, EquipmentTab, ArenaTab, ExpeditionTab, NPCTab, MailPanel, QuestPanel, AchievementPanel, AlliancePanel, PrestigePanel, SocialPanel, HeritagePanel, ActivityPanel, ShopPanel) |
| ❌ 完全无数据 | 13 |
| P0 问题 | 13 |
| P1 问题 | 10 |
| P2 问题 | 5 |

---

## 修复建议

### P0 修复优先级排序

1. **P0-01 MailPanel + P0-12 ShopPanel** — 引擎层已有实现(`engine/mail/MailSystem.ts`, `engine/shop/ShopSystem.ts`)，只需在 `ThreeKingdomsEngine` 中实例化并暴露 getter，工作量最小
2. **P0-13 NPCTab** — `engine/npc/` 下有完整实现，只需在主引擎类中暴露 `getNPCSystem()`
3. **P0-09 EquipmentTab** — `core/equipment/` 有完整类型定义，需要新建 `engine/equipment/EquipmentSystem.ts` 并集成
4. **P0-10 ArenaTab** — `core/pvp/` 有类型定义，需要新建 PvP 引擎子系统
5. **P0-11 ExpeditionTab** — `core/expedition/` 有类型定义，需要新建远征引擎子系统
6. **P0-02~P0-08** — 需要逐一实现 QuestSystem, AchievementSystem, AllianceSystem, PrestigeSystem, FriendSystem, HeritageSystem, ActivitySystem

### P1 修复建议

- **P1-01~03**: 在 CampaignTab/HeroTab/TechTab 的引擎调用处添加 try/catch + Toast 错误提示
- **P1-04**: WorldMapTab 的攻城操作对接 `engine.getSiegeSystem()`
- **P1-05~06**: 移除 `(engine as any)` 强制转型，使用类型安全的 getter
- **P1-07**: EventBanner 数据添加类型守卫
- **P1-08**: ArenaTab 移除 `Math.random()` 模拟，改为显示"系统开发中"提示
- **P1-09**: EquipmentTab 移除 `(engine as any)`，等引擎集成后使用类型安全方式
- **P1-10**: 所有功能菜单面板的 `engine: any` 改为 `engine: ThreeKingdomsEngine`

### 统一接入模式建议

```typescript
// ThreeKingdomsEngine 中添加子系统接入的标准模式：
// 1. 私有字段
private readonly mailSystem: MailSystem;
// 2. 构造函数实例化
this.mailSystem = new MailSystem();
// 3. 注册到 SubsystemRegistry
r.register('mail', this.mailSystem);
// 4. 暴露 getter
getMailSystem(): MailSystem { return this.mailSystem; }
// 5. init() 中初始化
this.mailSystem.init(deps);
// 6. reset() 中重置
this.mailSystem.reset();
// 7. getSnapshot() 中加入快照
mailState: this.mailSystem.getState(),
// 8. buildSaveCtx() 中加入存档
mail: this.mailSystem,
```
