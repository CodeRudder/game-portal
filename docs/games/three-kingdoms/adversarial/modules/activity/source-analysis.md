# Activity 模块源码分析

> 生成时间: 2026-05-01 | 分析范围: `src/games/three-kingdoms/engine/activity/`

## 1. 模块概览

| 文件 | 行数 | 职责 |
|------|------|------|
| ActivitySystem.ts | 509 | 活动列表管理、5类活动矩阵、任务系统、里程碑、离线进度、赛季委托 |
| TimedActivitySystem.ts | 493 | 限时活动4阶段流程、排行榜、节日框架、离线进度 |
| TokenShopSystem.ts | 337 | 代币兑换商店、七阶稀有度、限购机制 |
| SignInSystem.ts | 355 | 7天循环签到、补签机制、连续加成 |
| SeasonHelper.ts | 117 | 赛季主题、结算动画、战绩更新、战绩排行 |
| ActivityOfflineCalculator.ts | 99 | 离线进度计算、应用离线进度 |
| ActivityFactory.ts | 96 | 工厂函数：默认状态、活动实例、任务实例、里程碑 |
| ActivitySystemConfig.ts | 73 | 常量配置：并行上限、离线效率、存档版本 |
| token-shop-config.ts | 131 | 商店常量：七阶稀有度、价格倍率、默认商品 |
| index.ts | 84 | 统一导出入口 |
| **合计** | **2,294** | |

## 2. 子系统架构

```
ActivitySystem (name='activityMgmt')
├── ActivityFactory          ← 纯函数工厂
├── ActivityOfflineCalculator ← 纯函数离线计算
├── ActivitySystemConfig     ← 常量 + seasonHelper 委托
└── SeasonHelper             ← 纯函数赛季辅助

TimedActivitySystem (name='timedActivity')  ← 独立子系统

TokenShopSystem (name='tokenShop')          ← 独立子系统

SignInSystem (name='signIn')                ← 独立子系统
```

### 2.1 依赖关系

```
ActivitySystem ──imports──→ ActivityFactory
               ──imports──→ ActivityOfflineCalculator
               ──imports──→ ActivitySystemConfig ──imports──→ SeasonHelper

TimedActivitySystem ──imports──→ (types only)
TokenShopSystem     ──imports──→ token-shop-config
SignInSystem        ──imports──→ (types only)
```

- **无跨子系统内部依赖**：四个 ISubsystem 实现互不引用
- **ActivitySystem 是聚合入口**：通过 index.ts 统一导出所有子系统

## 3. 公开 API 清单

### 3.1 ActivitySystem（19个公开方法）

| API | 类型 | 参数 | 返回 | 行号 |
|-----|------|------|------|------|
| `init(deps)` | ISubsystem | ISystemDeps | void | L80 |
| `update(dt)` | ISubsystem | number | void | L85 |
| `getState()` | ISubsystem | - | Record | L90 |
| `reset()` | ISubsystem | - | void | L97 |
| `canStartActivity(state, type)` | 活动管理 | ActivityState, ActivityType | {canStart, reason} | L107 |
| `startActivity(state, def, tasks, milestones, now)` | 活动管理 | ... | ActivityState | L155 |
| `updateActivityStatus(state, id, now, endTime)` | 活动管理 | ... | ActivityState | L175 |
| `getActiveActivities(state)` | 查询 | ActivityState | ActivityInstance[] | L193 |
| `updateTaskProgress(state, actId, taskDefId, progress)` | 任务 | ... | ActivityState | L205 |
| `claimTaskReward(state, actId, taskDefId)` | 任务 | ... | {state, points, tokens} | L228 |
| `resetDailyTasks(state, actId, dailyTaskDefs)` | 任务 | ... | ActivityState | L257 |
| `checkMilestones(state, actId)` | 里程碑 | ... | ActivityState | L278 |
| `claimMilestone(state, actId, milestoneId)` | 里程碑 | ... | {state, rewards} | L296 |
| `calculateOfflineProgress(state, duration)` | 离线 | ... | OfflineActivityResult[] | L319 |
| `applyOfflineProgress(state, results)` | 离线 | ... | ActivityState | L327 |
| `serialize(state)` | 序列化 | ActivityState | ActivitySaveData | L358 |
| `deserialize(data)` | 序列化 | ActivitySaveData | ActivityState | L385 |
| `getConcurrencyConfig()` | 工具 | - | ActivityConcurrencyConfig | L341 |
| `getOfflineEfficiency()` | 工具 | - | OfflineEfficiencyConfig | L345 |

### 3.2 TimedActivitySystem（16个公开方法）

| API | 类型 | 参数 | 返回 | 行号 |
|-----|------|------|------|------|
| `init(deps)` | ISubsystem | ISystemDeps | void | L115 |
| `update(dt)` | ISubsystem | number | void | L120 |
| `getState()` | ISubsystem | - | Record | L125 |
| `reset()` | ISubsystem | - | void | L132 |
| `createTimedActivityFlow(id, start, end)` | 流程 | string, number, number | TimedActivityFlow | L143 |
| `updatePhase(id, now)` | 流程 | string, number | TimedActivityPhase | L168 |
| `getFlow(id)` | 查询 | string | TimedActivityFlow? | L190 |
| `canParticipate(id, now)` | 查询 | string, number | boolean | L197 |
| `getRemainingTime(id, now)` | 查询 | string, number | number | L206 |
| `updateLeaderboard(id, entries)` | 排行榜 | string, RankEntry[] | RankEntry[] | L215 |
| `getLeaderboard(id)` | 排行榜 | string | RankEntry[] | L242 |
| `getPlayerRank(id, playerId)` | 排行榜 | string, string | number | L249 |
| `calculateRankRewards(rank)` | 排行榜 | number | Record | L256 |
| `getFestivalTemplate(type)` | 节日 | FestivalType | FestivalActivityDef? | L283 |
| `getAllFestivalTemplates()` | 节日 | - | FestivalActivityDef[] | L290 |
| `createFestivalActivity(type, start, days)` | 节日 | ... | {flow, template}? | L297 |
| `calculateOfflineProgress(id, type, dur)` | 离线 | ... | OfflineActivityResult | L316 |
| `calculateAllOfflineProgress(acts, dur)` | 离线 | ... | ActivityOfflineSummary | L348 |
| `serialize()` | 序列化 | - | {flows, leaderboards} | L378 |
| `deserialize(data)` | 序列化 | ... | void | L392 |

### 3.3 TokenShopSystem（17个公开方法）

| API | 类型 | 参数 | 返回 | 行号 |
|-----|------|------|------|------|
| `init(deps)` | ISubsystem | ISystemDeps | void | L39 |
| `update(dt)` | ISubsystem | number | void | L44 |
| `getState()` | ISubsystem | - | Record | L49 |
| `reset()` | ISubsystem | - | void | L56 |
| `getAllItems()` | 查询 | - | TokenShopItem[] | L66 |
| `getAvailableItems()` | 查询 | - | TokenShopItem[] | L73 |
| `getItem(id)` | 查询 | string | TokenShopItem? | L83 |
| `getItemsByRarity(rarity)` | 查询 | ShopItemRarity | TokenShopItem[] | L90 |
| `getItemsByActivity(actId)` | 查询 | string | TokenShopItem[] | L97 |
| `purchaseItem(id, qty)` | 购买 | string, number | {success, rewards, ...} | L110 |
| `getTokenBalance()` | 代币 | - | number | L168 |
| `addTokens(amount)` | 代币 | number | number | L175 |
| `spendTokens(amount)` | 代币 | number | {success, newBalance} | L183 |
| `addItem(item)` | 管理 | TokenShopItem | void | L195 |
| `removeItem(id)` | 管理 | string | boolean | L202 |
| `refreshShop()` | 管理 | - | number | L208 |
| `dailyRefresh(newItems?)` | 管理 | TokenShopItem[]? | number | L220 |
| `setItemAvailability(id, avail)` | 管理 | string, boolean | boolean | L234 |
| `serialize()` | 序列化 | - | {config, items, balance} | L258 |
| `deserialize(data)` | 序列化 | ... | void | L270 |

### 3.4 SignInSystem（10个公开方法）

| API | 类型 | 参数 | 返回 | 行号 |
|-----|------|------|------|------|
| `init(deps)` | ISubsystem | ISystemDeps | void | L73 |
| `update(dt)` | ISubsystem | number | void | L78 |
| `getState()` | ISubsystem | - | Record | L83 |
| `reset()` | ISubsystem | - | void | L90 |
| `signIn(data, now)` | 签到 | SignInData, number | {data, reward, bonusPercent} | L100 |
| `retroactive(data, now, gold)` | 补签 | SignInData, number, number | {data, goldCost} | L142 |
| `getReward(day)` | 查询 | number | SignInReward | L204 |
| `getAllRewards()` | 查询 | - | SignInReward[] | L213 |
| `getConsecutiveBonus(days)` | 查询 | number | number | L220 |
| `getCycleDay(days)` | 查询 | number | number | L227 |
| `canSignIn(data)` | 状态 | SignInData | boolean | L234 |
| `canRetroactive(data, now, gold)` | 状态 | SignInData, number, number | {canRetroactive, reason} | L240 |
| `getRemainingRetroactive(data, now)` | 状态 | SignInData, number | number | L259 |

### 3.5 辅助模块（纯函数）

**ActivityFactory**（4个导出函数）:
- `createDefaultActivityState()` → ActivityState
- `createActivityInstance(def, now)` → ActivityInstance
- `createActivityTask(def)` → ActivityTask
- `createMilestone(id, pts, rewards, isFinal?)` → ActivityMilestone

**ActivityOfflineCalculator**（2个导出函数）:
- `calculateOfflineProgress(state, dur, eff)` → OfflineActivityResult[]
- `applyOfflineProgress(state, results)` → ActivityState

**SeasonHelper**（5个导出函数）:
- `getCurrentSeasonTheme(idx)` → SeasonTheme
- `createSettlementAnimation(...)` → SeasonSettlementAnimation
- `updateSeasonRecord(record, won, rank, ranking)` → SeasonRecord
- `generateSeasonRecordRanking(records)` → SeasonRecordEntry[]
- `getSeasonThemes()` → SeasonTheme[]

## 4. 已有测试覆盖

| 测试文件 | 测试数 | 覆盖子系统 |
|----------|--------|-----------|
| ActivityFactory.test.ts | 13 | ActivityFactory |
| ActivityOfflineCalculator.test.ts | 9 | ActivityOfflineCalculator |
| ActivitySystemConfig.test.ts | 9 | ActivitySystemConfig |
| ActivitySystem-p1.test.ts | 22 | ActivitySystem（活动管理+任务） |
| ActivitySystem-p2.test.ts | 16 | ActivitySystem（里程碑+离线+赛季） |
| ActivitySystem-p3.test.ts | 7 | ActivitySystem（配置+序列化） |
| SeasonHelper.test.ts | 13 | SeasonHelper |
| SignInSystem-p1.test.ts | 17 | SignInSystem（签到+循环+加成+补签） |
| SignInSystem-p2.test.ts | 15 | SignInSystem（奖励查询+流程+边界） |
| TimedActivitySystem.test.ts | 18 | TimedActivitySystem |
| token-shop-config.test.ts | 9 | token-shop-config |
| TokenShopSystem.test.ts | 13 | TokenShopSystem |
| **合计** | **161** | |

## 5. 关键设计特征

### 5.1 NaN防护体系
源码中已有大量NaN防护（FIX-ACT-001~026, FIX-TIMED-010~019, FIX-SHOP-010~015, FIX-SIGN-007~009, FIX-SEAS-022~023, FIX-FACT-001~002），使用 `!Number.isFinite(x) || x <= 0` 模式。

### 5.2 不可变状态模式
ActivitySystem 的所有状态变更方法返回新的 ActivityState，采用 spread operator 浅拷贝。

### 5.3 序列化策略
- ActivitySystem: serialize/deserialize 为纯函数，接受/返回数据
- TimedActivitySystem/TokenShopSystem: serialize/deserialize 为实例方法，操作内部 Map

### 5.4 经济闭环
- 代币获取：claimTaskReward → tokens累加 → addTokens
- 代币消费：purchaseItem → spendTokens → tokenBalance扣减
- 限购：purchaseLimit + purchased 计数

## 6. 跨系统链路

| 链路 | 调用方 | 被调用方 | 接口 |
|------|--------|----------|------|
| L1 | ActivitySystem | ActivityOfflineCalculator | calculateOfflineProgress / applyOfflineProgress |
| L2 | ActivitySystem | ActivityFactory | createActivityInstance / createActivityTask |
| L3 | ActivitySystem | SeasonHelper | getCurrentSeasonTheme / updateSeasonRecord |
| L4 | TokenShopSystem | token-shop-config | DEFAULT_SHOP_ITEMS / RARITY_ORDER |
| L5 | TimedActivitySystem | (self-contained) | 内部 flows/leaderboards Map |
| L6 | SignInSystem | (self-contained) | 内部 config/rewards |
| L7 | engine-save | ActivitySystem.serialize | 存档覆盖 |
| L8 | engine-save | TimedActivitySystem.serialize | 存档覆盖 |
| L9 | engine-save | TokenShopSystem.serialize | 存档覆盖 |
| L10 | engine-save | SignInSystem.serialize | ⚠️ **SignInSystem 无 serialize/deserialize** |
