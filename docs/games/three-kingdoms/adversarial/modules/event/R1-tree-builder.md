# R1 对抗式测试 — Event 模块流程分支树

> **构建者**: TreeBuilder  
> **日期**: 2025-01-XX  
> **模块**: engine/event (19个源文件, ~3,804行代码)  
> **覆盖系统**: EventTriggerSystem, EventConditionEvaluator, EventTriggerConditions, EventProbabilityCalculator, EventTriggerLifecycle, EventTriggerSerialization, EventTriggerSystem.helpers, EventLogSystem, EventNotificationSystem, EventUINotification, ChainEventSystem, StoryEventSystem, OfflineEventHandler, OfflineEventSystem, ReturnAlertHelpers

---

## 一、系统架构与子系统清单

| # | 子系统 | 文件 | 行数 | 核心职责 |
|---|--------|------|------|----------|
| 1 | EventTriggerSystem | EventTriggerSystem.ts | 403 | 三类事件注册/触发/选择/过期/序列化 |
| 2 | EventTriggerSystem.helpers | EventTriggerSystem.helpers.ts | 295 | 查询/配置/序列化辅助+批量触发逻辑 |
| 3 | EventTriggerConditions | EventTriggerConditions.ts | 169 | 5种条件类型评估 |
| 4 | EventConditionEvaluator | EventConditionEvaluator.ts | 176 | OOP版条件评估器 |
| 5 | EventProbabilityCalculator | EventProbabilityCalculator.ts | 52 | 概率公式计算 |
| 6 | EventTriggerLifecycle | EventTriggerLifecycle.ts | 111 | 事件选择/过期生命周期 |
| 7 | EventTriggerSerialization | EventTriggerSerialization.ts | 69 | 序列化/反序列化 |
| 8 | EventLogSystem | EventLogSystem.ts | 184 | 日志记录+急报管理 |
| 9 | EventNotificationSystem | EventNotificationSystem.ts | 225 | 横幅系统+遭遇弹窗 |
| 10 | EventUINotification | EventUINotification.ts | 291 | UI通知横幅队列+遭遇弹窗数据 |
| 11 | ChainEventSystem | ChainEventSystem.ts | 326 | 连锁事件链管理 |
| 12 | StoryEventSystem | StoryEventSystem.ts | 383 | 历史剧情事件 |
| 13 | OfflineEventHandler | OfflineEventHandler.ts | 284 | 离线事件堆积处理 |
| 14 | OfflineEventSystem | OfflineEventSystem.ts | 451 | 离线事件系统(ISubsystem) |
| 15 | ReturnAlertHelpers | ReturnAlertHelpers.ts | 66 | 急报纯函数 |
| 16 | chain-event-types | chain-event-types.ts | 137 | 连锁事件类型定义 |
| 17 | event-chain.types | event-chain.types.ts | 138 | 事件链类型定义 |

---

## 二、流程分支树

### 2.1 EventTriggerSystem — 事件触发主系统

```
EventTriggerSystem
├── init(deps)
│   ├── [N1] 正常初始化+加载预定义事件
│   └── [N2] 重复init覆盖deps
├── registerEvent(def)
│   ├── [N3] 注册新事件定义
│   ├── [N4] 注册重复ID覆盖旧定义
│   └── [N5] registerEvents批量注册
├── getEventDef(id)
│   ├── [N6] 存在返回定义
│   └── [N7] 不存在返回undefined
├── getAllEventDefs()
│   └── [N8] 返回全部定义列表
├── getEventDefsByType(type)
│   ├── [N9] random类型过滤
│   ├── [N10] fixed类型过滤
│   └── [N11] chain类型过滤
├── canTrigger(eventId, currentTurn)
│   ├── [N12] 不存在事件→false
│   ├── [N13] 已完成事件→false
│   ├── [N14] 已有活跃实例→false
│   ├── [N15] 冷却期内→false
│   ├── [N16] 活跃事件数≥maxActiveEvents→false
│   ├── [N17] fixed类型→checkFixedConditions
│   ├── [N18] chain类型→checkChainPrerequisites
│   ├── [N19] random类型→true(概率在checkAndTrigger中)
│   └── [N20] 未知triggerType→false
├── checkAndTriggerEvents(currentTurn)
│   ├── [N21] tickCooldowns清理过期冷却
│   ├── [N22] 固定事件批量触发
│   ├── [N23] 连锁事件批量触发
│   ├── [N24] 随机事件概率判定(有ProbabilityCondition)
│   ├── [N25] 随机事件概率判定(无ProbabilityCondition,用def.triggerProbability)
│   ├── [N26] 随机事件概率判定(无ProbabilityCondition,用config.randomEventProbability)
│   └── [N27] 同步instanceCounter
├── forceTriggerEvent(eventId, currentTurn)
│   ├── [N28] 强制触发成功
│   └── [N29] 事件不存在→失败
├── triggerEvent(内部)
│   ├── [N30] 事件不存在→失败
│   ├── [N31] 已有活跃实例→失败
│   ├── [N32] 不满足canTrigger→失败(force跳过)
│   ├── [N33] 创建实例+emit event:triggered
│   └── [N34] instanceCounter递增
├── resolveEvent(instanceId, optionId)
│   ├── [N35] 实例不存在→null
│   ├── [N36] 实例非active→null
│   ├── [N37] 定义不存在→null
│   ├── [N38] 选项不存在→null
│   ├── [N39] 成功解决→设置冷却+完成+emit
│   └── [N40] chainEventId传递
├── expireEvents(currentTurn)
│   ├── [N41] 过期事件处理+emit
│   └── [N42] 无过期→空数组
├── createInstance(内部)
│   ├── [N43] expireAfterTurns有值→设置expireTurn
│   └── [N44] expireAfterTurns为null→expireTurn=null
├── checkFixedConditions
│   ├── [N45] 无条件→true
│   └── [N46] 逐条件评估
├── checkChainPrerequisites
│   ├── [N47] 无前置→true
│   └── [N48] 全部前置完成→true/部分未完成→false
├── 概率系统
│   ├── [N49] registerProbabilityCondition注册
│   ├── [N50] getProbabilityCondition查询
│   └── [N51] calculateProbability计算
├── 配置
│   ├── [N52] getConfig返回副本
│   ├── [N53] setConfig部分更新
│   └── [N54] config.maxActiveEvents上限
├── 序列化
│   ├── [N55] serialize→EventSystemSaveData
│   ├── [N56] deserialize恢复active/completed/cooldowns
│   └── [N57] deserialize处理undefined字段
└── reset
    └── [N58] 清除所有运行时状态
```

### 2.2 EventTriggerConditions — 条件评估

```
EventTriggerConditions
├── evaluateCondition(cond, currentTurn, gameState, isCompleted)
│   ├── [C1] turn_range→evaluateTurnRangeCondition
│   ├── [C2] resource_threshold→evaluateResourceCondition
│   ├── [C3] affinity_level→evaluateAffinityCondition
│   ├── [C4] building_level→evaluateBuildingCondition
│   ├── [C5] event_completed→evaluateEventCompletedCondition
│   └── [C6] unknown type→true(向后兼容)
├── evaluateTurnRangeCondition(params, currentTurn)
│   ├── [C7] minTurn边界(当前<min→false)
│   ├── [C8] maxTurn边界(当前>max→false)
│   ├── [C9] turnInterval整除检查
│   ├── [C10] 仅minTurn
│   ├── [C11] 仅maxTurn
│   ├── [C12] 仅turnInterval
│   └── [C13] 无参数→true
├── evaluateResourceCondition(params, gameState)
│   ├── [C14] 无gameState→true
│   ├── [C15] gameState中无对应key→默认0
│   └── [C16] 正常比较
├── evaluateAffinityCondition(params, gameState)
│   ├── [C17] 无gameState→true
│   └── [C18] 正常比较
├── evaluateBuildingCondition(params, gameState)
│   ├── [C19] 无gameState→true
│   └── [C20] 正常比较
├── evaluateEventCompletedCondition(params, isCompleted)
│   ├── [C21] 无eventId→true
│   ├── [C22] 无isCompleted回调→true
│   └── [C23] 正常查询
└── compareValue(actual, params)
    ├── [C24] operator: >=
    ├── [C25] operator: <=
    ├── [C26] operator: ==
    ├── [C27] operator: !=
    ├── [C28] operator: >
    ├── [C29] operator: <
    ├── [C30] 默认operator→>=
    ├── [C31] value字段fallback到minAmount
    └── [C32] value和minAmount都无→默认0
```

### 2.3 EventProbabilityCalculator — 概率计算

```
EventProbabilityCalculator
├── calculateProbability(probCondition)
│   ├── [P1] 空modifier列表→baseProbability
│   ├── [P2] 仅additive modifier
│   ├── [P3] 仅multiplicative modifier
│   ├── [P4] 混合additive+multiplicative
│   ├── [P5] inactive modifier不参与
│   ├── [P6] clamp上限→1
│   ├── [P7] clamp下限→0
│   ├── [P8] multiplicative=0→概率归零
│   ├── [P9] 多个additive累加
│   ├── [P10] 多个multiplicative连乘
│   └── [P11] triggered判定(Math.random < final)
```

### 2.4 EventTriggerLifecycle — 生命周期

```
EventTriggerLifecycle
├── resolveEvent(instanceId, optionId, state, deps)
│   ├── [L1] 实例不存在→null
│   ├── [L2] 实例非active→null
│   ├── [L3] 定义不存在→null
│   ├── [L4] 选项不存在→null
│   ├── [L5] 成功: status→resolved, completedEventIds.add
│   ├── [L6] cooldownTurns设置冷却
│   ├── [L7] activeEvents.delete
│   └── [L8] emit event:resolved
└── expireEvents(currentTurn, state, deps)
    ├── [L9] expireTurn!=null && currentTurn>=expireTurn→过期
    ├── [L10] status→expired
    ├── [L11] activeEvents.delete
    └── [L12] emit event:expired
```

### 2.5 EventTriggerSerialization — 序列化

```
EventTriggerSerialization
├── serializeEventTriggerState(state)
│   ├── [S1] activeEvents→Array
│   ├── [S2] completedEventIds→Array
│   ├── [S3] cooldowns→Object.fromEntries
│   └── [S4] version字段
└── deserializeEventTriggerState(data)
    ├── [S5] activeEvents从数组恢复Map
    ├── [S6] completedEventIds从数组恢复Set
    ├── [S7] cooldowns从对象恢复Map
    ├── [S8] data.activeEvents为undefined→空Map
    ├── [S9] data.completedEventIds为undefined→空Set
    └── [S10] data.cooldowns为undefined→空Map
```

### 2.6 EventLogSystem — 日志系统

```
EventLogSystem
├── logEvent(entry)
│   ├── [LG1] 生成logId, push, trimLog(>200)
│   └── [LG2] emit eventLog:added
├── logEventResolved(eventDefId, ...)
│   ├── [LG3] 找到已有日志→更新
│   └── [LG4] 未找到→创建新条目
├── getEventLog(options)
│   ├── [LG5] eventType过滤
│   ├── [LG6] fromTurn/minTurn过滤
│   ├── [LG7] toTurn/maxTurn过滤
│   └── [LG8] limit限制
├── addAlert(alert)
│   ├── [LG9] 生成alertId, 按urgency排序
│   ├── [LG10] trimAlerts(>50)
│   └── [LG11] emit alert:added
├── addOfflineAlerts(events)
│   └── [LG12] 批量创建急报
├── getAlertStack()
│   ├── [LG13] totalCount, unreadCount
│   └── [LG14] highestUrgency
├── markAlertRead / markAllAlertsRead
│   ├── [LG15] 单个标记
│   └── [LG16] 全部标记
├── clearReadAlerts
│   └── [LG17] 清除已读
├── removeAlert
│   ├── [LG18] 存在→移除成功
│   └── [LG19] 不存在→false
├── 序列化
│   ├── [LG20] exportSaveData(截断到MAX)
│   └── [LG21] importSaveData(恢复+设置counter)
└── reset
    └── [LG22] 清空所有+重置counter
```

### 2.7 EventNotificationSystem — 通知系统

```
EventNotificationSystem
├── createBanner(instance, eventDef, turn)
│   ├── [NT1] 创建横幅+优先级排序插入
│   ├── [NT2] trimBanners(超过maxBannerCount)
│   └── [NT3] emit event:banner_created
├── createBanners(entries)
│   └── [NT4] 批量创建
├── getBanner/getActiveBanners/getUnreadBanners
│   ├── [NT5] 按ID查询
│   ├── [NT6] 按bannerOrder顺序返回
│   └── [NT7] 过滤未读
├── markBannerRead/markAllBannersRead
│   ├── [NT8] 单个标记
│   └── [NT9] 全部标记
├── removeBanner/dismissBanner
│   └── [NT10] 移除+更新order
├── expireBanners/checkBannerExpiry
│   └── [NT11] 按expireTurn过期
├── createEncounterPopup(instance, eventDef)
│   ├── [NT12] 生成选项+consequencePreview
│   └── [NT13] emit event:encounter_created
├── resolveEncounter(encounterId, optionId)
│   ├── [NT14] popup不存在→null
│   ├── [NT15] option不存在/不可用→null
│   ├── [NT16] 成功解决→resolvedEncounters+delete
│   └── [NT17] emit event:encounter_resolved
├── dismissEncounter
│   ├── [NT18] dismissible=true→成功
│   └── [NT19] dismissible=false→失败
├── trimBanners(内部)
│   ├── [NT20] 优先移除已读的
│   └── [NT21] 无已读→移除最后一个
├── insertBannerOrdered(内部)
│   └── [NT22] 按priority降序插入
└── 序列化
    ├── [NT23] exportSaveData
    └── [NT24] importSaveData
```

### 2.8 EventUINotification — UI通知

```
EventUINotification
├── createBanner(event)
│   ├── [UI1] 无current→直接设为current
│   ├── [UI2] 有current→pending队列+排序
│   ├── [UI3] pending超BANNER_MAX_QUEUE_SIZE→溢出到expired
│   └── [UI4] emit event:banner_created
├── getCurrentBanner
│   └── [UI5] 返回current或null
├── markCurrentBannerRead
│   ├── [UI6] 有current→标记+true
│   └── [UI7] 无current→false
├── dismissCurrentBanner
│   ├── [UI8] current→expired, 显示下一个
│   └── [UI9] 无下一个→null
├── createEncounterModal(event)
│   └── [UI10] 生成EncounterModalData
├── createEncounterModals(events)
│   └── [UI11] 批量生成
├── serialize/deserialize
│   ├── [UI12] 序列化expiredBanners
│   └── [UI13] 反序列化恢复expired
└── reset
    └── [UI14] 清空队列+counter
```

### 2.9 ChainEventSystem — 连锁事件

```
ChainEventSystem
├── registerChain(chain)
│   ├── [CH1] maxDepth>5→throw
│   ├── [CH2] 节点depth>maxDepth→throw
│   └── [CH3] 正常注册
├── registerChains(chains)
│   └── [CH4] 批量注册
├── startChain(chainId)
│   ├── [CH5] 链不存在→null
│   ├── [CH6] 无根节点(depth=0)→null
│   ├── [CH7] 成功开始+emit chain:started
│   └── [CH8] 创建ChainProgress
├── advanceChain(chainId, optionId)
│   ├── [CH9] 链/进度不存在→失败
│   ├── [CH10] 已完成→失败
│   ├── [CH11] 找到后续节点→推进+emit
│   ├── [CH12] 无后续节点→链完成+emit chain:completed
│   └── [CH13] previousNodeId标记完成
├── getCurrentNode
│   └── [CH14] 返回当前节点或null
├── getProgress/getProgressStats
│   ├── [CH15] 返回进度
│   └── [CH16] 统计completed/total/percentage
├── getNextNodes
│   └── [CH17] 返回子节点列表
├── 序列化
│   ├── [CH18] exportSaveData
│   └── [CH19] importSaveData
└── reset
    └── [CH20] 清空chains+progresses
```

### 2.10 StoryEventSystem — 剧情系统

```
StoryEventSystem
├── init(deps)
│   └── [ST1] 加载默认剧情
├── registerStory/registerStories
│   └── [ST2] 注册自定义剧情
├── canTriggerStory(storyId, currentTurn)
│   ├── [ST3] 不存在→false
│   ├── [ST4] 已触发→false
│   ├── [ST5] 前置剧情未完成→false
│   ├── [ST6] 触发条件不满足→false
│   └── [ST7] 全部满足→true
├── getAvailableStories(currentTurn)
│   └── [ST8] 过滤+按order排序
├── triggerStory(storyId)
│   ├── [ST9] 不存在→null
│   ├── [ST10] 已触发→null
│   ├── [ST11] 成功触发+emit story:triggered
│   └── [ST12] 设置currentActId为第一幕
├── advanceStory(storyId)
│   ├── [ST13] 不存在/未触发→失败
│   ├── [ST14] 已完成→失败
│   ├── [ST15] 有下一幕→推进+emit
│   ├── [ST16] 无下一幕→完成+emit
│   └── [ST17] completedActIds记录
├── evaluateCondition(内部)
│   ├── [ST18] turn_range条件
│   └── [ST19] event_completed条件
├── getProgressStats
│   └── [ST20] 统计
└── 序列化
    ├── [ST21] exportSaveData
    └── [ST22] importSaveData
```

### 2.11 OfflineEventHandler — 离线事件处理

```
OfflineEventHandler
├── simulateOfflineEvents(offlineTurns, availableEvents, triggerProbability)
│   ├── [OH1] 每回合概率触发
│   ├── [OH2] 达到MAX_PILE_SIZE(10)停止
│   └── [OH3] 随机选择事件+autoResolve判定
├── tryAutoResolve(eventDef)
│   ├── [OH4] 高优先级→null(保留)
│   └── [OH5] 低优先级→autoChooseOption
├── autoChooseOption(内部)
│   ├── [OH6] 有默认选项→选默认
│   ├── [OH7] 无默认→选第一个
│   └── [OH8] 无选项→throw
├── processOfflinePile(pile)
│   ├── [OH9] 分类pending/autoResolved
│   ├── [OH10] 汇总autoResourceChanges
│   └── [OH11] 标记pile.processed=true
├── resolveOfflineEvent(pile, eventId, optionId)
│   ├── [OH12] 事件不存在→失败
│   ├── [OH13] 已自动处理→失败
│   ├── [OH14] 选项不存在→失败
│   └── [OH15] 成功处理
├── getPileStats(pile)
│   └── [OH16] total/pending/autoResolved
└── convertToNotifications(pile)
    └── [OH17] 跳过已自动处理的→生成通知列表
```

### 2.12 OfflineEventSystem — 离线事件系统

```
OfflineEventSystem
├── addOfflineEvent(event)
│   ├── [OS1] 生成id, autoProcessed=false
│   └── [OS2] 超过50→裁剪
├── addOfflineEvents(events)
│   └── [OS3] 批量添加
├── processOfflineEvents()
│   ├── [OS4] 按urgency排序
│   ├── [OS5] findMatchingRule匹配规则
│   ├── [OS6] selectOption按策略选择
│   │   ├── [OS6a] default_option策略
│   │   ├── [OS6b] best_outcome策略
│   │   ├── [OS6c] safest策略
│   │   ├── [OS6d] weighted_random策略
│   │   └── [OS6e] skip策略→空字符串
│   ├── [OS7] 资源变化汇总
│   └── [OS8] 生成retrospectiveData
├── manualProcessEvent(entryId, optionId)
│   ├── [OS9] entry不存在→null
│   ├── [OS10] option不存在→null
│   └── [OS11] 成功处理+从队列移除
├── findMatchingRule(内部)
│   ├── [OS12] urgencyThreshold比较
│   ├── [OS13] applicableCategories匹配
│   ├── [OS14] applicableEventIds匹配
│   └── [OS15] 规则enabled检查
├── generateRetrospective()
│   └── [OS16] 生成回溯数据
└── 序列化
    ├── [OS17] exportSaveData
    └── [OS18] importSaveData
```

### 2.13 ReturnAlertHelpers — 急报纯函数

```
ReturnAlertHelpers
├── createReturnAlert(alert, idCounter)
│   └── [RA1] 生成alert+递增counter
├── createOfflineAlerts(events, startCounter)
│   └── [RA2] 批量创建+counter递增
├── filterUnreadAlerts(alerts)
│   └── [RA3] 过滤unread
├── markAlertRead(alerts, alertId)
│   ├── [RA4] 存在→标记+true
│   └── [RA5] 不存在→false
├── markAllAlertsRead(alerts)
│   └── [RA6] 全部标记
└── clearReadAlerts(alerts)
    └── [RA7] 过滤掉已读
```

### 2.14 EventConditionEvaluator — OOP条件评估器

```
EventConditionEvaluator
├── evaluate(cond, ctx)
│   └── [CE1-CE6] 同EventTriggerConditions的C1-C6
├── evaluateAll(conditions, ctx)
│   ├── [CE7] 空条件→true
│   └── [CE8] AND逻辑短路
└── compareValue(内部)
    └── [CE9] 同C24-C32
```

---

## 三、节点统计

| 子系统 | 节点数 | P0节点 | P1节点 | P2节点 |
|--------|--------|--------|--------|--------|
| EventTriggerSystem | 58 | 28 | 20 | 10 |
| EventTriggerConditions | 32 | 15 | 12 | 5 |
| EventProbabilityCalculator | 11 | 6 | 3 | 2 |
| EventTriggerLifecycle | 12 | 8 | 3 | 1 |
| EventTriggerSerialization | 10 | 5 | 3 | 2 |
| EventLogSystem | 22 | 12 | 7 | 3 |
| EventNotificationSystem | 24 | 14 | 7 | 3 |
| EventUINotification | 14 | 8 | 4 | 2 |
| ChainEventSystem | 20 | 12 | 5 | 3 |
| StoryEventSystem | 22 | 13 | 6 | 3 |
| OfflineEventHandler | 17 | 10 | 5 | 2 |
| OfflineEventSystem | 18 | 11 | 5 | 2 |
| ReturnAlertHelpers | 7 | 4 | 2 | 1 |
| EventConditionEvaluator | 9 | 5 | 3 | 1 |
| **合计** | **276** | **151** | **85** | **40** |

---

## 四、现有测试覆盖分析

### 已有测试文件(23个)
- adversarial-event.test.ts: 57 tests (EventTriggerSystem核心+条件+概率+序列化)
- EventAdversarial.test.ts: 115 tests (6个子系统+跨系统)
- EventTriggerSystem.test.ts, p1, p2, p3
- EventTriggerConditions.test.ts
- EventTriggerSystem.helpers.test.ts
- EventConditionEvaluator.test.ts
- EventProbabilityCalculator.test.ts
- EventTriggerSerialization.test.ts
- EventTriggerLifecycle.test.ts
- EventLogSystem.test.ts
- EventNotificationSystem-p1, p2
- EventUINotification.test.ts
- EventChainSystem.test.ts
- ChainEventSystem.test.ts
- event-chain-coverage.test.ts
- StoryEventSystem.test.ts
- OfflineEventHandler.test.ts
- OfflineEventSystem.test.ts
- ReturnAlertHelpers.test.ts

### 覆盖缺口（R1需要补充的测试节点）

| 缺口ID | 维度 | 子系统 | 缺口描述 | 优先级 |
|--------|------|--------|----------|--------|
| G1 | F-Boundary | EventTriggerSystem | checkAndTriggerEvents中random事件无triggerProbability也无ProbabilityCondition时用config默认值 | P0 |
| G2 | F-Boundary | EventTriggerSystem | createInstance中instanceCounter与helpers中的counterRef同步问题 | P1 |
| G3 | F-Error | EventTriggerSystem | deserialize后instanceCounter未恢复，新创建的实例ID可能冲突 | P1 |
| G4 | F-Cross | EventTriggerSystem+EventLogSystem | 事件解决后未自动写日志（需手动调用logEventResolved） | P1 |
| G5 | F-Boundary | EventNotificationSystem | trimBanners在有已读banner时优先移除已读的，无已读时移除最后一个 | P1 |
| G6 | F-Normal | EventNotificationSystem | generatePreviewText中affinityChanges/unlockIds/triggerEventId预览 | P2 |
| G7 | F-Boundary | EventUINotification | pending队列超过BANNER_MAX_QUEUE_SIZE时溢出到expired | P1 |
| G8 | F-Normal | EventUINotification | dismissCurrentBanner后自动显示下一个pending | P1 |
| G9 | F-Cross | EventUINotification | createEncounterModal正确映射options和consequences | P1 |
| G10 | F-Error | ChainEventSystem | registerChain空nodes数组（无根节点） | P2 |
| G11 | F-Boundary | ChainEventSystem | advanceChain中depth>maxDepth的节点不匹配 | P1 |
| G12 | F-Cross | ChainEventSystem+EventTriggerSystem | 链节点触发后联动EventTriggerSystem | P1 |
| G13 | F-Boundary | StoryEventSystem | 剧情只有一幕时trigger后直接完成 | P1 |
| G14 | F-Boundary | StoryEventSystem | 剧情无幕(acts为空)时trigger行为 | P2 |
| G15 | F-Cross | StoryEventSystem | evaluateCondition中event_completed引用其他子系统进度 | P1 |
| G16 | F-Error | OfflineEventHandler | simulateOfflineEvents中availableEvents为空数组 | P1 |
| G17 | F-Boundary | OfflineEventHandler | simulateOfflineEvents中offlineTurns=0 | P1 |
| G18 | F-Error | OfflineEventHandler | autoChooseOption中options为空→throw | P0 |
| G19 | F-Cross | OfflineEventHandler+OfflineEventSystem | 两个系统间数据格式转换 | P1 |
| G20 | F-Boundary | OfflineEventSystem | weighted_random策略的权重分配 | P2 |
| G21 | F-Boundary | OfflineEventSystem | skip策略返回空字符串 | P1 |
| G22 | F-Cross | OfflineEventSystem | findMatchingRule的urgencyThreshold逻辑(>=不处理) | P0 |
| G23 | F-Lifecycle | OfflineEventSystem | processOfflineEvents后retrospectiveData完整性 | P1 |
| G24 | F-Normal | ReturnAlertHelpers | createReturnAlert的counter递增正确性 | P1 |
| G25 | F-Normal | EventConditionEvaluator | evaluateAll空数组→true | P1 |
| G26 | F-Cross | 全系统 | 多系统联合序列化/反序列化后功能完整性 | P1 |
| G27 | F-Boundary | EventLogSystem | getEventLog中fromTurn和minTurn别名兼容 | P2 |
| G28 | F-Lifecycle | EventLogSystem | importSaveData后counter设置正确性 | P1 |
| G29 | F-Error | EventTriggerSystem.helpers | checkAndTriggerEventsLogic中tickCooldowns在触发前执行 | P1 |
| G30 | F-Boundary | EventTriggerSystem | checkAndTriggerEvents中固定→连锁→随机执行顺序保证 | P1 |

---

## 五、度量目标

| 指标 | 目标 | 当前估计 |
|------|------|----------|
| 节点覆盖率 | ≥95% | ~82% |
| P0覆盖率 | 100% | ~90% |
| 维度均衡度 | ≥0.7 | ~0.65 |
| 总测试节点 | 276 | ~226已覆盖 |

**需要补充**: ~50个测试节点（集中在上述30个缺口）
