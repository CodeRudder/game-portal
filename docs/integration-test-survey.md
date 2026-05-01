# 三国霸业 — 集成测试方法论调研报告

> **调研日期**: 2025-07-11  
> **项目路径**: `game-portal/src/games/three-kingdoms/`  
> **核心引擎**: `ThreeKingdomsEngine.ts`  
> **源文件数**: ~340 | **子系统数**: 35+ | **测试文件数**: 757+

---

## 一、项目路径确认

```
game-portal/
├── src/games/three-kingdoms/
│   ├── engine/                          # 引擎层（业务逻辑）
│   │   ├── ThreeKingdomsEngine.ts       # 主引擎（编排层，~800行）
│   │   ├── engine-tick.ts               # tick 循环
│   │   ├── engine-save.ts               # 存档序列化
│   │   ├── engine-hero-deps.ts          # 武将域子系统
│   │   ├── engine-campaign-deps.ts      # 战役域子系统
│   │   ├── engine-tech-deps.ts          # 科技域子系统
│   │   ├── engine-map-deps.ts           # 地图域子系统
│   │   ├── engine-event-deps.ts         # 事件域子系统
│   │   ├── engine-extended-deps.ts      # R11+扩展子系统（40+）
│   │   ├── engine-offline-deps.ts       # 离线域子系统
│   │   ├── engine-guide-deps.ts         # 引导域子系统
│   │   ├── engine-getters.ts            # API方法Mixin
│   │   ├── engine-building-ops.ts       # 建筑操作封装
│   │   ├── resource/                    # 资源系统
│   │   ├── building/                    # 建筑系统
│   │   ├── calendar/                    # 日历系统
│   │   ├── hero/                        # 武将系统（22文件）
│   │   ├── battle/                      # 战斗系统（19文件）
│   │   ├── campaign/                    # 关卡系统（15文件）
│   │   ├── tech/                        # 科技系统（16文件）
│   │   ├── map/                         # 地图系统（8文件）
│   │   ├── npc/                         # NPC系统（16文件）
│   │   ├── event/                       # 事件系统（17文件）
│   │   ├── equipment/                   # 装备系统（13文件）
│   │   ├── pvp/                         # PvP系统（8文件）
│   │   ├── expedition/                  # 远征系统（7文件）
│   │   ├── alliance/                    # 联盟系统（7文件）
│   │   ├── prestige/                    # 声望系统（4文件）
│   │   ├── activity/                    # 活动系统（9文件）
│   │   ├── trade/                       # 贸易系统（5文件）
│   │   ├── shop/                        # 商店系统
│   │   ├── mail/                        # 邮件系统（6文件）
│   │   ├── currency/                    # 货币系统
│   │   ├── quest/                       # 任务系统（6文件）
│   │   ├── bond/                        # 羁绊系统（3文件）
│   │   ├── achievement/                 # 成就系统（3文件）
│   │   ├── social/                      # 社交系统（6文件）
│   │   ├── heritage/                    # 传承系统（3文件）
│   │   ├── advisor/                     # 军师系统（2文件）
│   │   ├── guide/                       # 引导系统（13文件）
│   │   ├── unification/                 # 统一系统（18文件）
│   │   ├── settings/                    # 设置系统（12文件）
│   │   ├── season/                      # 赛季系统（3文件）
│   │   ├── tutorial/                    # 教程系统（2文件）
│   │   ├── responsive/                  # 响应式系统（7文件）
│   │   └── offline/                     # 离线收益（10文件）
│   ├── core/                            # 核心基础设施层
│   │   ├── engine/                      # 引擎基础设施
│   │   │   ├── GameEngineFacade.ts      # 门面模式入口
│   │   │   ├── SubsystemRegistry.ts     # 子系统注册表
│   │   │   └── LifecycleManager.ts      # 生命周期管理
│   │   ├── events/                      # 事件总线
│   │   │   ├── EventBus.ts              # 发布/订阅
│   │   │   └── EventTypes.ts            # 事件类型定义
│   │   ├── save/                        # 存档管理
│   │   ├── config/                      # 配置注册表
│   │   └── types/                       # 类型定义
│   ├── shared/                          # 共享类型和常量
│   ├── test-utils/                      # 测试工具
│   ├── tests/                           # 测试文件
│   └── rendering/                       # 渲染层
```

---

## 二、完整游戏子系统清单

### 2.1 核心子系统（v1.0~v3.0）

| # | 子系统 | 目录 | 版本 | 核心类 | 职责 | 核心API |
|---|--------|------|------|--------|------|---------|
| 1 | **资源系统** | `resource/` | v1.0 | `ResourceSystem` | 7种资源的产出、消耗、上限、加成 | `addResource()`, `consumeResource()`, `setResource()`, `getAmount()`, `tick()`, `recalculateProduction()`, `updateCaps()` |
| 2 | **建筑系统** | `building/` | v1.0 | `BuildingSystem` | 8种建筑的升级、队列、产出联动 | `upgrade()`, `getLevel()`, `tick()`, `calculateTotalProduction()`, `forceCompleteUpgrades()` |
| 3 | **日历系统** | `calendar/` | v1.0 | `CalendarSystem` | 现实时间→游戏天数、季节、时代 | `update()` |
| 4 | **武将系统** | `hero/` | v2.0 | `HeroSystem` + 14个子系统 | 武将数据、等级、升星、技能、编队、招募、觉醒 | `addGeneral()`, `getAllGenerals()`, `addFragment()`, `addExp()`, `calculateTotalPower()` |
| 5 | **羁绊系统** | `bond/` | v2.0 | `BondSystem`, `FactionBondSystem` | 武将羁绊激活与属性加成 | — |
| 6 | **战斗系统** | `battle/` | v3.0 | `BattleEngine` + 11个子系统 | 回合制战斗、伤害计算、技能、终极技 | `startBattle()`, `completeBattle()` |
| 7 | **关卡系统** | `campaign/` | v3.0 | `CampaignProgressSystem`, `RewardDistributor`, `SweepSystem`, `VIPSystem`, `ChallengeStageSystem` | 关卡进度、扫荡、VIP、挑战关卡 | `startBattle()`, `completeBattle()`, `getCampaignProgress()`, `getStageList()` |

### 2.2 中期子系统（v5.0~v9.0）

| # | 子系统 | 目录 | 版本 | 核心类 | 职责 | 核心API |
|---|--------|------|------|--------|------|---------|
| 8 | **科技系统** | `tech/` | v5.0 | `TechTreeSystem`, `TechPointSystem`, `TechResearchSystem`, `FusionTechSystem`, `TechLinkSystem`, `TechOfflineSystem` | 三路线科技树、融合科技、离线研究 | `getTechBonusMultiplier()`, `getEffectValue()` |
| 9 | **地图系统** | `map/` | v5.0 | `WorldMapSystem`, `TerritorySystem`, `SiegeSystem`, `GarrisonSystem`, `SiegeEnhancer`, `MapEventSystem` | 世界地图、领土、攻城、驻防 | — |
| 10 | **NPC系统** | `npc/` | v6.0 | `NPCSystem` | NPC生成、巡逻、好感、送礼、对话 | — |
| 11 | **事件系统** | `event/` | v6.0 | `EventTriggerSystem`, `EventNotificationSystem`, `EventUINotification`, `EventChainSystem`, `EventLogSystem`, `OfflineEventSystem` | 随机事件、事件链、通知、离线事件 | `update()` |
| 12 | **任务系统** | `quest/` | v7.0 | `QuestSystem` | 日常/周常/主线任务 | — |
| 13 | **货币系统** | `currency/` | v8.0 | `CurrencySystem` | 多币种管理 | — |
| 14 | **商店系统** | `shop/` | v8.0 | `ShopSystem` | 商品上架、折扣、限购 | — |
| 15 | **贸易系统** | `trade/` | v8.0 | `TradeSystem`, `CaravanSystem`, `ResourceTradeEngine` | 商队派遣、资源交易 | — |
| 16 | **离线收益** | `offline/` | v9.0 | `OfflineRewardSystem`, `OfflineEstimateSystem`, `OfflineSnapshotSystem` | 离线计算、快照、收益 | — |
| 17 | **邮件系统** | `mail/` | v9.0 | `MailSystem`, `MailTemplateSystem` | 系统邮件、模板 | — |

### 2.3 后期子系统（v10.0+）

| # | 子系统 | 目录 | 版本 | 核心类 | 职责 |
|---|--------|------|------|--------|------|
| 18 | **装备系统** | `equipment/` | v10.0 | `EquipmentSystem`, `EquipmentForgeSystem`, `EquipmentEnhanceSystem`, `EquipmentSetSystem`, `EquipmentRecommendSystem` | 装备生成、锻造、强化、套装 |
| 19 | **PvP系统** | `pvp/` | v11.0 | `ArenaSystem`, `ArenaSeasonSystem`, `RankingSystem`, `PvPBattleSystem`, `DefenseFormationSystem`, `ArenaShopSystem` | 竞技场、赛季、排名 |
| 20 | **社交系统** | `social/` | v11.0 | `FriendSystem`, `ChatSystem`, `LeaderboardSystem` | 好友、聊天、排行榜 |
| 21 | **远征系统** | `expedition/` | v12.0 | `ExpeditionSystem` | 远征队伍、自动远征 |
| 22 | **联盟系统** | `alliance/` | v13.0 | `AllianceSystem`, `AllianceTaskSystem`, `AllianceBossSystem`, `AllianceShopSystem` | 联盟管理、Boss、任务 |
| 23 | **声望系统** | `prestige/` | v14.0 | `PrestigeSystem`, `PrestigeShopSystem`, `RebirthSystem` | 声望等级、转生 |
| 24 | **活动系统** | `activity/` | v15.0 | `ActivitySystem`, `TimedActivitySystem`, `SignInSystem`, `TokenShopSystem` | 限时活动、签到 |
| 25 | **传承系统** | `heritage/` | v16.0 | `HeritageSystem` | 跨周期能力传承 |
| 26 | **响应式系统** | `responsive/` | v17.0 | `ResponsiveLayoutManager`, `MobileLayoutManager` | 移动端布局 |
| 27 | **引导系统** | `guide/` | v18.0 | `TutorialStateMachine`, `StoryEventPlayer`, `TutorialStepManager`, `TutorialMaskSystem` 等7个子系统 | 新手引导 |
| 28 | **统一系统** | `unification/` | v19.0 | `EndingSystem`, `GlobalStatisticsSystem` 等 | 结局、统计 |
| 29 | **设置系统** | `settings/` | v20.0 | `SettingsManager`, `AccountSystem` | 账号、音频、画质 |
| 30 | **军师系统** | `advisor/` | v20.0 | `AdvisorSystem`, `AdvisorTriggerDetector` | 策略推荐 |
| 31 | **成就系统** | `achievement/` | v20.0 | `AchievementSystem`, `AchievementHelpers` | 成就追踪 |
| 32 | **赛季系统** | `season/` | v21.0 | `SeasonSystem` | 赛季周期、奖励重置 |
| 33 | **教程系统** | `tutorial/` | — | `TutorialSystem` | 教程步骤 |
| 34 | **铜钱经济** | `resource/` | — | `CopperEconomySystem` | 铜钱收支平衡 |
| 35 | **材料经济** | `resource/` | — | `MaterialEconomySystem` | 材料收支平衡 |
| 36 | **招贤令经济** | `hero/` | — | `RecruitTokenEconomySystem` | 招贤令收支平衡 |

---

## 三、子系统间依赖关系图

### 3.1 核心依赖链（Tick循环内）

```
日历系统(Calendar)
    ↓ update(dtSec)
建筑系统(Building) ─────→ 资源系统(Resource)
    ↓ tick()                  ↓ tick(dt, bonuses)
    ↓ completed[]        加成计算:
    ↓ syncBuildingToResource   ├─ 主城加成(castleMultiplier)
    ↓                          ├─ 科技加成(techBonus)
    ↓                          ├─ 武将加成(hero) [预留]
    ↓                          ├─ 转生加成(rebirth) [预留]
    ↓                          └─ VIP加成(vip) [预留]
    ↓
武将系统(Hero) ←── 羁绊系统(Bond)
    ↓ update(dtSec)
关卡系统(Campaign)
    ↓ update(dtSec)
事件系统(Event) ──→ 触发器 → 通知 → UI通知 → 事件链 → 日志 → 离线事件
    ↓ update(dtSec)
攻城系统(Siege)
    ↓ update(dtSec)
变化检测 → EventBus.emit('resource:changed' | 'resource:rate-changed')
```

### 3.2 子系统域间依赖关系

```
                    ┌─────────────────────────────────────────┐
                    │         ThreeKingdomsEngine              │
                    │         (编排层/胶水代码)                │
                    └─────────────┬───────────────────────────┘
                                  │
         ┌────────────────────────┼────────────────────────┐
         │                        │                        │
    ┌────▼─────┐           ┌─────▼──────┐          ┌─────▼──────┐
    │ 资源域    │           │ 武将域      │          │ 战役域      │
    │ Resource  │◄─────────│ Hero       │─────────►│ Campaign    │
    │ Building  │  消耗资源  │ Formation  │  战斗阵容  │ Battle     │
    │ Calendar  │           │ Recruit    │          │ Reward     │
    │ Copper$   │           │ Level      │          │ Sweep      │
    │ Material$ │           │ Star       │          │ VIP        │
    │ TechPoint │           │ Skill      │          │ Challenge  │
    └────┬──────┘           │ Bond       │          └─────┬──────┘
         │                  │ Badge      │                │
         │                  │ Awakening  │                │
         │                  │ Dispatch   │                │
         │                  └─────┬──────┘                │
         │                        │                        │
    ┌────▼────────────────────────▼────────────────────────▼──┐
    │                      科技域 (Tech)                        │
    │  TechTree ← TechPoint ← TechResearch ← FusionTech       │
    │  TechLink ← TechOffline ← TechDetail                    │
    └────┬────────────────────────────────────────────────────┘
         │
    ┌────▼────────────────────────────────────────────────────┐
    │                      地图域 (Map)                        │
    │  WorldMap → Territory → Garrison → Siege → SiegeEnhancer│
    │  → MapEvent                                             │
    └────┬────────────────────────────────────────────────────┘
         │
    ┌────▼────────────────────────────────────────────────────┐
    │                    事件域 (Event)                         │
    │  EventTrigger → EventNotification → EventUINotification  │
    │  → EventChain → EventLog → OfflineEvent                 │
    └────┬────────────────────────────────────────────────────┘
         │
    ┌────▼────────────────────────────────────────────────────┐
    │                  R11+ 扩展域 (40+子系统)                   │
    │                                                          │
    │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌──────────┐   │
    │  │ Mail    │  │ Shop    │  │Currency │  │ NPC      │   │
    │  └─────────┘  └─────────┘  └─────────┘  └──────────┘   │
    │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌──────────┐   │
    │  │Equip    │  │ PvP     │  │Expedition│ │ Alliance │   │
    │  │Forge    │  │Arena    │  │         │  │ Boss     │   │
    │  │Enhance  │  │Season   │  │         │  │ Task     │   │
    │  │Set      │  │Ranking  │  │         │  │ Shop     │   │
    │  └─────────┘  └─────────┘  └─────────┘  └──────────┘   │
    │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌──────────┐   │
    │  │Prestige │  │ Quest   │  │Achieve  │  │ Social   │   │
    │  │Shop     │  │         │  │         │  │ Friend   │   │
    │  │Rebirth  │  │         │  │         │  │ Chat     │   │
    │  └─────────┘  └─────────┘  └─────────┘  └──────────┘   │
    │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌──────────┐   │
    │  │Activity │  │ Trade   │  │Heritage │  │ Advisor  │   │
    │  │SignIn   │  │ Caravan │  │         │  │          │   │
    │  │TokenShop│  │ResTrade │  │         │  │          │   │
    │  └─────────┘  └─────────┘  └─────────┘  └──────────┘   │
    │  ┌─────────┐  ┌─────────┐  ┌─────────┐                 │
    │  │Settings │  │Unific.  │  │ Season  │                 │
    │  │Account  │  │ Ending  │  │         │                 │
    │  └─────────┘  └─────────┘  └─────────┘                 │
    └──────────────────────────────────────────────────────────┘
         │
    ┌────▼────────────────────────────────────────────────────┐
    │                    离线域 (Offline)                       │
    │  OfflineReward → OfflineEstimate → OfflineSnapshot      │
    └─────────────────────────────────────────────────────────┘
         │
    ┌────▼────────────────────────────────────────────────────┐
    │                    引导域 (Guide)                         │
    │  TutorialStateMachine → StoryEventPlayer                 │
    │  → TutorialStepManager → TutorialStepExecutor            │
    │  → TutorialMaskSystem → TutorialStorage                  │
    │  → FirstLaunchDetector                                   │
    └─────────────────────────────────────────────────────────┘
```

### 3.3 关键跨域依赖（集成测试重点）

| 依赖路径 | 源域 | 目标域 | 依赖类型 | 说明 |
|----------|------|--------|----------|------|
| 建筑升级 → 资源扣减 | Building | Resource | 数据依赖 | 升级消耗grain/gold/troops |
| 建筑完成 → 产出更新 | Building | Resource | 事件依赖 | `building:upgraded` → `recalculateProduction()` |
| 建筑完成 → 上限更新 | Building | Resource | 数据依赖 | farmland→grain上限, barracks→troops上限 |
| 主城等级 → 加成系数 | Building | Resource | 数据依赖 | castleMultiplier影响所有产出 |
| 书院等级 → 科技点产出 | Building | TechPoint | 数据依赖 | `syncAcademyLevel()` |
| 科技研究 → 产出加成 | Tech | Resource | 数据依赖 | `getTechBonusMultiplier()` |
| 武将招募 → 消耗招贤令 | HeroRecruit | Resource | 数据依赖 | 消耗recruitToken |
| 武将升级 → 消耗铜钱 | HeroLevel | Resource | 数据依赖 | 消耗gold |
| 武将升星 → 消耗铜钱 | HeroStar | Resource | 数据依赖 | 消耗gold |
| 武将觉醒 → 消耗天命 | Awakening | Resource | 数据依赖 | 消耗mandate |
| 战斗阵容 → 武将数据 | Battle | Hero | 数据依赖 | `buildAllyTeam()` |
| 关卡奖励 → 资源增加 | Campaign | Resource | 回调依赖 | `addResource()`, `addFragment()` |
| 关卡奖励 → 经验分配 | Campaign | Hero | 回调依赖 | `addExp()` |
| 攻城战 → 消耗兵力 | Siege | Resource | 数据依赖 | 消耗troops |
| 攻城战 → 领土变更 | Siege | Territory | 状态依赖 | 占领/失去领土 |
| NPC好感 → 解锁对话 | NPC | Event | 状态依赖 | 好感度阈值触发 |
| 事件链 → 跨系统效果 | Event | Multi | 事件依赖 | 资源/武将/建筑联动 |
| 装备锻造 → 消耗铜钱 | Equipment | Resource | 数据依赖 | 消耗gold |
| PvP → 消耗兵力 | PvP | Resource | 数据依赖 | 消耗troops |
| 远征 → 消耗兵力 | Expedition | Resource | 数据依赖 | 消耗troops |
| 联盟捐献 → 消耗资源 | Alliance | Resource | 数据依赖 | 消耗grain/gold |
| 声望商店 → 消耗天命 | Prestige | Resource | 数据依赖 | 消耗mandate |
| 贸易 → 资源交换 | Trade | Resource | 数据依赖 | grain↔gold |
| 离线收益 → 资源增加 | Offline | Resource | 数据依赖 | 计算离线产出 |
| 存档 → 全系统序列化 | Save | All | 数据依赖 | 所有子系统状态 |
| 引导 → 触发操作 | Guide | Multi | 事件依赖 | 指引玩家操作 |
| 赛季 → 重置部分系统 | Season | Multi | 状态依赖 | PvP/活动/任务重置 |

---

## 四、关键数据实体和资源类型

### 4.1 七种核心资源

| 资源 | ID | 初始值 | 产出/秒 | 上限 | 产出建筑 |
|------|-----|--------|---------|------|----------|
| 粮草 | `grain` | 500 | 0.8 | 有(农田等级) | 农田 |
| 铜钱 | `gold` | 300 | 0 | 无 | 市集 |
| 兵力 | `troops` | 50 | 0 | 有(兵营等级) | 兵营 |
| 天命 | `mandate` | 0 | 0 | 无 | 关卡/成就 |
| 科技点 | `techPoint` | 0 | 0 | 无 | 书院 |
| 招贤令 | `recruitToken` | 30 | 0.01 | 无 | 被动积累 |
| 技能书 | `skillBook` | 0 | 0 | 无 | 关卡掉落 |

### 4.2 八种建筑

| 建筑 | ID | 解锁条件 | 产出 | 特殊 |
|------|-----|----------|------|------|
| 主城 | `castle` | 初始 | 全资源加成% | 其他建筑等级≤主城 |
| 农田 | `farmland` | 初始 | 粮草 | 决定粮草上限 |
| 市集 | `market` | 主城Lv2 | 铜钱 | — |
| 兵营 | `barracks` | 主城Lv2 | 兵力 | 决定兵力上限 |
| 铁匠铺 | `smithy` | 主城Lv3 | — | 装备锻造 |
| 书院 | `academy` | 主城Lv3 | 科技点 | 科技研究速度 |
| 医馆 | `clinic` | 主城Lv4 | — | 恢复加速 |
| 城墙 | `wall` | 主城Lv5 | — | 防御加成 |

### 4.3 武将数据实体

```
GeneralData {
  id: string              # 武将ID (liubei, guanyu, ...)
  name: string            # 名称
  faction: Faction        # 阵营 (shu/wei/wu/qun)
  rarity: number          # 稀有度 (1-5星)
  level: number           # 等级
  star: number            # 星级
  stats: GeneralStats     # 四维属性 (attack/defense/intelligence/speed)
  skills: Skill[]         # 技能列表
  fragments: number       # 碎片数量
  equipped: Equipment[]   # 装备
  bond: Bond[]            # 羁绊
}
```

### 4.4 战斗数据实体

```
BattleTeam → BattleUnit[] {
  id, name, hp, maxHp
  attack, defense, intelligence, speed
  skills: BattleSkill[]
  ultimate: UltimateSkill
}
BattleResult {
  victory: boolean
  stars: number (1-3)
  rewards: Resources
  drops: ItemDrop[]
}
```

---

## 五、已知流程断裂点

### 5.1 方法论文档标记的断裂（METHODOLOGY.md）

| 断裂编号 | 断裂描述 | 涉及系统 | 严重程度 |
|----------|----------|----------|----------|
| **INT-1** | 建筑升级消耗资源 → 资源系统扣减 → 事件通知 → 任务进度更新，链路断裂 | Building→Resource→Event→Quest | 🔴 P0 |
| **INT-2** | NPC好感度变化 → 解锁对话 → 触发任务 → 奖励发放，跨4模块流程 | NPC→Event→Quest→Resource | 🔴 P0 |
| **INT-3** | 科技研究完成 → 效果应用 → 战力计算 → 排行榜更新，异步时序问题 | Tech→Hero→Social | 🔴 P0 |

### 5.2 F03系列修复（UI层断裂）

| 断裂编号 | 描述 | 测试文件 | 状态 |
|----------|------|----------|------|
| **F03-P1-1** | 招募成功后无"前往编队"引导 | `F03-recruit-formation-guide.test.tsx` | 已修复 |
| **F03-P1-1b** | HeroTab未监听`tk:navigate-to-formation`事件 | `F03-hero-tab-formation-event.test.tsx` | 已修复 |
| **F03-P1-2** | 概率0%项未显示"无法获得"标注 | `F03-probability-zero-label.test.tsx` | 已修复 |
| **F03-P1-3** | 战斗失败时无"重新挑战"按钮 | `F03-battle-retry-button.test.tsx` | 已修复 |
| **F03-P1-3b** | BattleFormationModal未传递onRetry给BattleResultModal | `F03-battle-retry-integration.test.tsx` | 已修复 |

### 5.3 对抗测试发现的缺口

| 维度 | 初始覆盖率 | 遗漏严重度 | 典型断裂 |
|------|-----------|-----------|----------|
| F-Normal（正常流程） | ~85% | 🟢 低 | 主线基本覆盖 |
| F-Boundary（边界条件） | ~35% | 🔴 极高 | 极值/溢出/并发/时序边界 |
| F-Error（异常路径） | ~40% | 🔴 极高 | 错误输入/资源不足/状态冲突 |
| F-Cross（跨系统交互） | ~46% | 🔴 极高 | 系统间依赖/事件传播/状态同步 |
| F-Lifecycle（数据生命周期） | ~30% | 🔴 极高 | 创建→读取→更新→删除→持久化→恢复 |

---

## 六、已有测试工具

### 6.1 GameEventSimulator（核心测试工具）

**路径**: `test-utils/GameEventSimulator.ts`

**能力清单**:

| 类别 | API | 说明 |
|------|-----|------|
| **生命周期** | `init()`, `reset()` | 引擎初始化/重置 |
| **资源操作** | `addResources()`, `consumeResources()`, `setResource()`, `getResource()`, `getAllResources()` | 资源CRUD |
| **建筑操作** | `upgradeBuilding()`, `upgradeBuildingTo()`, `getBuildingLevel()`, `getAllBuildingLevels()` | 建筑升级 |
| **武将操作** | `recruitHero()`, `addHeroDirectly()`, `getGenerals()`, `getGeneralCount()`, `getTotalPower()`, `addHeroFragments()` | 武将管理 |
| **战斗关卡** | `winBattle()`, `getCampaignProgress()`, `getStageList()` | 战斗模拟 |
| **时间快进** | `fastForward()`, `fastForwardSeconds()`, `fastForwardMinutes()`, `fastForwardHours()` | 时间加速 |
| **状态初始化** | `initBeginnerState()`, `initMidGameState()` | 快捷状态设置 |
| **快照** | `takeSnapshot()` | 获取完整游戏状态快照 |
| **事件日志** | `getEventLog()`, `clearEventLog()` | 事件追踪 |

### 6.2 TimeAccelerator（时间加速器）

**路径**: `test-utils/TimeAccelerator.ts`

**能力**: 基于里程碑的时间加速，递归推进前置依赖
- `advanceTo(GameMilestone)` — 推进到指定里程碑
- `fastForward(seconds)` — 快进指定时间

### 6.3 GameMilestone（里程碑枚举）

**路径**: `test-utils/GameMilestone.ts`

**定义**: 30+ 游戏里程碑节点，含依赖关系图
- v1.0 基业初立: GAME_STARTED → TUTORIAL_COMPLETED → MAIN_CITY_LV3/LV5/LV10
- v2.0 招贤纳士: RECRUIT_HALL_UNLOCKED → FIRST_HERO_RECRUITED → HERO_COUNT_5/10
- v3.0 攻城略地: FIRST_STAGE_CLEARED → CHAPTER_1_COMPLETED
- v4.0 兵强马壮: BARRACKS_LV10 → ARMY_SIZE_1000/10000
- v5.0 资源富足: FARMLAND_LV10 → GOLD_100K → GRAIN_100K

### 6.4 其他测试辅助

| 工具 | 路径 | 能力 |
|------|------|------|
| `createMockDeps()` | `test-utils/createMockDeps.ts` | 创建mock ISystemDeps |
| `createSim()` | `test-utils/test-helpers.ts` | 快捷创建已初始化的Simulator |
| `createRealDeps()` | `test-utils/test-helpers.ts` | 创建真实ISystemDeps |
| `createSimWithResources()` | `test-utils/test-helpers.ts` | 带资源的Simulator |
| `SUFFICIENT_RESOURCES` | `test-utils/test-helpers.ts` | 充足资源常量 |
| `MASSIVE_RESOURCES` | `test-utils/test-helpers.ts` | 大量资源常量 |
| `ALL_BUILDING_TYPES` | `test-utils/test-helpers.ts` | 8种建筑类型常量 |
| `test-constants.ts` | `test-utils/test-constants.ts` | 测试专用常量 |

### 6.5 已有集成测试

| 文件 | 覆盖范围 |
|------|----------|
| `cross-building-resource.test.ts` | 建筑↔资源交叉验证（10用例） |
| `cross-hero-battle.test.ts` | 武将↔战斗交叉验证（10用例） |
| `cross-save-all.test.ts` | 存档↔全系统交叉验证（10用例） |
| `engine-tick-siege.integration.test.ts` | Tick循环+攻城集成 |
| `engine-campaign-integration.test.ts` | 战役集成 |
| `engine-tech-integration-p1/p2.test.ts` | 科技集成 |
| `e2e-beginner-flow.test.ts` | 新手E2E流程 |
| `e2e-veteran-flow.test.ts` | 老玩家E2E流程 |
| `integration/scene-router.test.tsx` | 场景路由集成 |
| `integration/shop-integration.test.tsx` | 商店集成 |
| `tests/acc/FLOW-*.test.tsx` | 验收测试（12+流程） |
| `long-run-stability.test.ts` | 长时间运行稳定性 |
| `state-consistency.test.ts` | 状态一致性 |
| `deadlock-prevention.test.ts` | 死锁预防 |
| `race-condition.test.ts` | 竞态条件 |

---

## 七、集成测试设计建议

### 7.1 高优先级跨域链路（需覆盖）

| 优先级 | 链路 | 涉及系统数 | 测试场景 |
|--------|------|-----------|----------|
| P0 | 建筑→资源→事件→任务 完整链路 | 4 | 升级建筑→扣资源→发事件→更新任务进度 |
| P0 | 招募→编队→战斗→奖励 完整链路 | 4 | 消耗招贤令→获得武将→编队→战斗→获得奖励 |
| P0 | 科技研究→加成应用→产出变化 | 3 | 研究科技→加成生效→资源产出增加 |
| P0 | 存档→全系统序列化→加载→状态恢复 | All | 保存→重置→加载→验证所有子系统状态 |
| P1 | NPC→好感→对话→任务→奖励 | 4 | 送礼→好感提升→解锁对话→触发任务→获得奖励 |
| P1 | 攻城→兵力消耗→领土变更→驻防 | 4 | 消耗兵力→攻城→占领→配置驻防 |
| P1 | 装备→锻造→强化→套装→战力 | 3 | 消耗铜钱→锻造→强化→套装激活→战力提升 |
| P1 | PvP→积分→段位→赛季→商店 | 5 | 挑战→积分变动→段位升降→赛季重置→商店购买 |
| P2 | 离线→快照→计算→收益→邮件 | 3 | 下线→快照→计算收益→上线→领取 |
| P2 | 联盟→Boss→任务→商店→捐献 | 4 | 创建联盟→打Boss→完成任务→商店兑换→捐献 |
| P2 | 活动→签到→代币→商店 | 3 | 签到→获得代币→商店兑换 |
| P2 | 引导→教程→操作→奖励 | 3 | 触发引导→完成步骤→获得奖励 |
| P3 | 赛季→重置→保留→奖励 | Multi | 赛季结束→部分重置→部分保留→发放奖励 |
| P3 | 传承→转生→永久加成 | 3 | 转生→传承能力→永久加成生效 |

### 7.2 边界条件测试重点

| 边界类型 | 场景 |
|----------|------|
| 资源为零 | 所有消耗操作在资源为0时的行为 |
| 资源溢出 | 超上限截断、overflow事件 |
| 等级边界 | 主城等级限制其他建筑升级 |
| 时间极值 | 离线1分钟/24小时/72小时/365天 |
| 并发操作 | 同一帧内多次tick、快速连续升级 |
| 存档损坏 | 空存档、跨版本存档、损坏字段 |
| 空集合 | 无武将时编队、无领土时攻城 |

---

## 八、总结

### 项目规模
- **35+ 子系统**，按版本迭代从v1.0到v21.0逐步扩展
- **340+ 源文件**，757+ 测试文件
- **编排层**采用依赖注入模式（`engine-*-deps.ts`），子系统通过 `SubsystemRegistry` 注册和查找

### 集成测试现状
- 已有 `cross-*.test.ts` 系列交叉验证测试
- 已有 `e2e-*-flow.test.ts` 端到端流程测试
- 已有 `engine-*-integration.test.ts` 模块集成测试
- **缺口**: F-Cross(~46%) 和 F-Lifecycle(~30%) 覆盖率仍低

### 测试工具成熟度
- `GameEventSimulator` 提供完整的链式API
- `TimeAccelerator` 支持基于里程碑的时间加速
- `GameMilestone` 定义了30+里程碑和依赖关系
- `test-helpers.ts` 提供工厂函数和常量

### 关键风险点
1. **建筑→资源→事件→任务** 四系统链路断裂（P0）
2. **跨4模块流程**（NPC→Event→Quest→Resource）覆盖不足（P0）
3. **异步时序问题**（科技→战力→排行榜）（P0）
4. **边界条件**覆盖率仅35%（P0）
5. **数据生命周期**覆盖率仅30%（P0）
