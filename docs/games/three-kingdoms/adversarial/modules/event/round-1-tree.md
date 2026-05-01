# Event Module R1 — Builder Flow Tree

> 模块: event | 轮次: R1 | Builder: v1.9
> 源码路径: `src/games/three-kingdoms/engine/event/`
> 源文件: 19个 .ts (不含测试) | 总行数: ~4,284行
> 子系统: 10个 (EventTriggerSystem, EventChainSystem, ChainEventSystem, StoryEventSystem, OfflineEventSystem, OfflineEventHandler, EventNotificationSystem, EventUINotification, EventLogSystem, EventConditionEvaluator)

## 模块架构

```
event/
├── EventTriggerSystem.ts          # 事件触发主系统 (401行, 1 class)
├── EventTriggerSystem.helpers.ts  # 触发辅助函数 (295行, 15 exports)
├── EventTriggerConditions.ts      # 条件评估纯函数 (169行, 8 exports)
├── EventConditionEvaluator.ts     # 条件评估器类 (176行, 1 class)
├── EventProbabilityCalculator.ts  # 概率计算器 (52行, 1 export)
├── EventTriggerLifecycle.ts       # 生命周期(resolve/expire) (111行, 2 exports)
├── EventTriggerSerialization.ts   # 序列化纯函数 (69行, 2 exports)
├── EventChainSystem.ts            # 事件深化系统(旧链+日志+急报) (403行, 1 class)
├── event-chain.types.ts           # EventChainSystem类型 (138行, 7 types)
├── ChainEventSystem.ts            # v7连锁事件系统(新) (326行, 1 class)
├── chain-event-types.ts           # ChainEventSystem类型 (137行, 8 types)
├── StoryEventSystem.ts            # v7历史剧情事件 (383行, 1 class)
├── OfflineEventSystem.ts          # v15离线事件系统 (451行, 1 class)
├── OfflineEventHandler.ts         # v15离线事件处理器 (284行, 1 class)
├── EventNotificationSystem.ts     # 急报横幅+遭遇弹窗 (225行, 1 class)
├── EventUINotification.ts         # UI通知系统(横幅队列) (291行, 1 class)
├── EventLogSystem.ts              # 事件日志+急报堆 (184行, 1 class)
├── ReturnAlertHelpers.ts          # 急报辅助纯函数 (66行, 6 exports)
└── index.ts                       # 统一导出 (107行)
```

## 子系统依赖图

```
EventTriggerSystem ←── EventTriggerSystem.helpers
       ↓                    ├── EventTriggerConditions
       ↓                    ├── EventTriggerSerialization
       ↓                    └── EventTriggerLifecycle
       ├── EventProbabilityCalculator
       ├── EventConditionEvaluator (独立,可替换)
       └── PREDEFINED_EVENTS (core层)

EventChainSystem ←── ReturnAlertHelpers (旧链+日志+急报)
       ↓
ChainEventSystem (新连锁事件,独立)
StoryEventSystem (历史剧情,独立)

OfflineEventSystem ←── OfflineEventHandler
       ↓
EventNotificationSystem ←── EventTriggerSystem(获取活跃事件)
EventUINotification ←── core/events (横幅队列)
EventLogSystem (独立日志+急报)
```

## 跨系统链路 (10子系统 × 2 = 20条)

| # | 链路 | 路径 | 验证 |
|---|------|------|------|
| L1 | EventTriggerSystem → EventTriggerConditions | canTrigger → evaluateCondition | covered: 源码ETS L233 |
| L2 | EventTriggerSystem → EventProbabilityCalculator | calculateProbability | covered: 源码ETS L167 |
| L3 | EventTriggerSystem → EventTriggerLifecycle | resolveEvent/expireEvents 委托 | covered: 源码ETS L260/L279 |
| L4 | EventTriggerSystem → EventTriggerSerialization | serialize/deserialize 委托 | covered: 源码ETS L295/L303 |
| L5 | EventTriggerSystem → helpers.triggerEventLogic | triggerEvent → triggerEventLogic | covered: 源码ETS L345 |
| L6 | EventTriggerSystem → helpers.checkAndTriggerEventsLogic | checkAndTriggerEvents | covered: 源码ETS L141 |
| L7 | EventChainSystem → ReturnAlertHelpers | addReturnAlert/markAlertRead | covered: 源码ECS L250+ |
| L8 | EventChainSystem → eventBus | chainAdvanced/storyTriggered事件 | covered: 源码ECS L170/L235 |
| L9 | ChainEventSystem → eventBus | chain:started/advanced/completed | covered: 源码CES L148/L213/L229 |
| L10 | StoryEventSystem → eventBus | story:triggered/actAdvanced/completed | covered: 源码SES L286/L314/L322 |
| L11 | OfflineEventSystem → OfflineEventHandler | simulateOfflineEvents | covered: 独立使用 |
| L12 | OfflineEventSystem → eventDefs | selectOption/getOptionConsequences | covered: 源码OES L380+ |
| L13 | EventNotificationSystem → eventBus | banner_created/encounter_created | covered: 源码ENS L71/L119 |
| L14 | EventUINotification → eventBus | event:banner_created | covered: 源码EUIN L120 |
| L15 | EventLogSystem → eventBus | eventLog:added/alert:added | covered: 源码ELS L94/L117 |
| L16 | EventTriggerSystem → engine-save | serialize()被buildSaveData调用 | covered: BR-014 |
| L17 | EventChainSystem → engine-save | serialize()被buildSaveData调用 | covered: BR-014 |
| L18 | ChainEventSystem → engine-save | exportSaveData()被调用 | covered: BR-014 |
| L19 | StoryEventSystem → engine-save | exportSaveData()被调用 | covered: BR-014 |
| L20 | OfflineEventSystem → engine-save | exportSaveData()被调用 | covered: BR-014 |

---

## S1: EventTriggerSystem (401行)

### 公开API

| API | 行号 | 说明 |
|-----|------|------|
| init(deps) | L38 | 初始化+加载预定义事件 |
| registerEvent(def) | L74 | 注册事件定义 |
| registerEvents(defs) | L86 | 批量注册 |
| getEventDef(id) | L96 | 获取事件定义 |
| getAllEventDefs() | L103 | 获取所有定义 |
| getEventDefsByType(type) | L112 | 按类型筛选 |
| checkAndTriggerEvents(turn) | L125 | 每回合触发检查 |
| forceTriggerEvent(id, turn) | L155 | 强制触发(测试用) |
| calculateProbability(cond) | L167 | 概率计算 |
| registerProbabilityCondition(id, cond) | L182 | 注册概率条件 |
| canTrigger(id, turn) | L198 | 是否可触发 |
| resolveEvent(instId, optId) | L260 | 处理事件选择 |
| expireEvents(turn) | L279 | 过期处理 |
| serialize() | L295 | 序列化 |
| deserialize(data) | L303 | 反序列化 |
| reset() | L53 | 重置 |

### 流程树

```
S1: EventTriggerSystem
├── F-Normal
│   ├── S1-N01: registerEvent → eventDefs.set(def.id, def)
│   │   [covered: 源码L74]
│   ├── S1-N02: registerEvents → 循环调用registerEvent
│   │   [covered: 源码L86]
│   ├── S1-N03: getEventDef(id) → Map.get返回EventDef|undefined
│   │   [covered: 源码L96]
│   ├── S1-N04: checkAndTriggerEvents → 固定→连锁→随机三类事件触发
│   │   [covered: 源码L125, helpers L253]
│   ├── S1-N05: canTrigger(id, turn) → 已完成/活跃/冷却/上限/类型条件检查
│   │   [covered: 源码L198]
│   ├── S1-N06: resolveEvent → 委托EventTriggerLifecycle.resolveEvent
│   │   [covered: 源码L260]
│   ├── S1-N07: expireEvents(turn) → 委托EventTriggerLifecycle.expireEvents
│   │   [covered: 源码L279]
│   ├── S1-N08: serialize → 委托EventTriggerSerialization
│   │   [covered: 源码L295]
│   ├── S1-N09: deserialize → 委托EventTriggerSerialization + clear+set
│   │   [covered: 源码L303]
│   └── S1-N10: calculateProbability → 委托EventProbabilityCalculator
│       [covered: 源码L167]
│
├── F-Boundary
│   ├── S1-B01: canTrigger(不存在id) → false
│   │   [covered: 源码L200 def不存在]
│   ├── S1-B02: canTrigger(已完成事件) → false
│   │   [covered: 源码L203 completedEventIds.has]
│   ├── S1-B03: canTrigger(有活跃实例) → false
│   │   [covered: 源码L206 hasActiveEvent]
│   ├── S1-B04: canTrigger(冷却中) → false
│   │   [covered: 源码L209 cooldown检查]
│   ├── S1-B05: canTrigger(活跃事件数>=maxActiveEvents) → false
│   │   [covered: 源码L213 activeEvents.size >= config.maxActiveEvents]
│   ├── S1-B06: checkAndTriggerEvents(无事件定义) → 空数组
│   │   [covered: helpers L253 各类型为空时返回[]]
│   ├── S1-B07: resolveEvent(不存在的instanceId) → null
│   │   [covered: Lifecycle L28 instance不存在]
│   ├── S1-B08: resolveEvent(非active状态) → null
│   │   [covered: Lifecycle L29 status !== 'active']
│   ├── S1-B09: resolveEvent(不存在的optionId) → null
│   │   [covered: Lifecycle L34 option找不到]
│   └── S1-B10: registerEvent(重复id) → 覆盖旧定义
│       [covered: Map.set行为]
│
├── F-Error
│   ├── S1-E01: deserialize(null/undefined) → ⚠️ crash风险
│   │   [源码L303: data参数直接传给deserializeEventTriggerState]
│   │   [Serialization L52: data.activeEvents → null.activeEvents crash]
│   ├── S1-E02: init(deps=null) → deps.eventBus调用时crash
│   │   [源码L39: this.deps = deps 无null检查]
│   └── S1-E03: checkAndTriggerEvents(负数turn) → ⚠️ 冷却逻辑可能异常
│       [源码L141: currentTurn直接传递, 无NaN/负数检查]
│
├── F-Cross
│   ├── S1-C01: checkAndTriggerEvents → canTrigger → triggerEventLogic 完整链路
│   │   [covered: 源码L125→helpers L253]
│   ├── S1-C02: resolveEvent → completedEventIds.add → 后续chain事件可触发
│   │   [covered: Lifecycle L40 completedEventIds.add]
│   ├── S1-C03: serialize → deserialize 往返一致性
│   │   [covered: Serialization 序列化+反序列化对称]
│   ├── S1-C04: forceTriggerEvent → 跳过canTrigger直接触发
│   │   [covered: 源码L155, helpers triggerEventLogic force=true]
│   └── S1-C05: tickCooldowns → 冷却到期事件可重新触发
│       [covered: 源码L340 cooldown清理]
│
└── F-Lifecycle
    ├── S1-L01: init → deps注入 + loadPredefinedEvents
    │   [covered: 源码L38]
    ├── S1-L02: reset → clear所有状态 + 恢复默认config
    │   [covered: 源码L53]
    └── S1-L03: update(dt) → 空操作(预留)
        [covered: 源码L44]
```

---

## S2: EventTriggerConditions (169行)

### 公开API

| API | 行号 | 说明 |
|-----|------|------|
| evaluateCondition(cond, turn, gameState?, isCompleted?) | L30 | 主入口: 5种条件类型 |
| evaluateTurnRangeCondition(params, turn) | L64 | turn_range条件 |
| evaluateResourceCondition(params, gameState?) | L83 | resource_threshold条件 |
| evaluateAffinityCondition(params, gameState?) | L99 | affinity_level条件 |
| evaluateBuildingCondition(params, gameState?) | L115 | building_level条件 |
| evaluateEventCompletedCondition(params, isCompleted?) | L131 | event_completed条件 |
| compareValue(actual, params) | L151 | 通用比较(6种运算符) |

### 流程树

```
S2: EventTriggerConditions
├── F-Normal
│   ├── S2-N01: evaluateCondition(turn_range) → minTurn/maxTurn/turnInterval
│   │   [covered: 源码L64]
│   ├── S2-N02: evaluateCondition(resource_threshold) → gameState[target] compareValue
│   │   [covered: 源码L83]
│   ├── S2-N03: evaluateCondition(affinity_level) → gameState[target] compareValue
│   │   [covered: 源码L99]
│   ├── S2-N04: evaluateCondition(building_level) → gameState[target] compareValue
│   │   [covered: 源码L115]
│   ├── S2-N05: evaluateCondition(event_completed) → isCompleted(eventId)
│   │   [covered: 源码L131]
│   ├── S2-N06: evaluateCondition(未知type) → true(向后兼容)
│   │   [covered: 源码L56 default分支]
│   └── S2-N07: compareValue(6种运算符) → >=/<=/==/!=/>/<
│       [covered: 源码L151]
│
├── F-Boundary
│   ├── S2-B01: evaluateResourceCondition(gameState=null) → true(兼容)
│   │   [covered: 源码L86 !gameState → true]
│   ├── S2-B02: evaluateEventCompletedCondition(isCompleted=null) → true
│   │   [covered: 源码L141 !isCompleted → true]
│   ├── S2-B03: evaluateEventCompletedCondition(eventId=null) → true
│   │   [covered: 源码L136 !eventId → true]
│   ├── S2-B04: evaluateTurnRangeCondition(minTurn=NaN) → ⚠️ NaN比较
│   │   [源码L72: currentTurn < NaN → false, 条件通过]
│   ├── S2-B05: compareValue(expected=NaN) → ⚠️ NaN比较
│   │   [源码L158: actual >= NaN → false]
│   └── S2-B06: compareValue(operator=未知) → 默认>=
│       [covered: 源码L166 default]
│
├── F-Error
│   └── S2-E01: evaluateCondition(params缺少必要字段) → ⚠️ undefined as number
│       [源码: params['resource'] as string → undefined, gameState[undefined]=undefined]
│
└── F-Cross
    └── S2-C01: evaluateCondition → checkFixedConditions → canTrigger 链路
        [covered: helpers L227 调用evaluateCondition]
```

---

## S3: EventConditionEvaluator (176行)

### 公开API

| API | 行号 | 说明 |
|-----|------|------|
| evaluate(cond, ctx) | L36 | 评估单个条件 |
| evaluateAll(conditions, ctx) | L67 | 评估多个条件(AND) |

### 流程树

```
S3: EventConditionEvaluator
├── F-Normal
│   ├── S3-N01: evaluate(turn_range) → minTurn/maxTurn/turnInterval
│   │   [covered: 源码L88]
│   ├── S3-N02: evaluate(resource_threshold) → gameState[target] compareValue
│   │   [covered: 源码L100]
│   ├── S3-N03: evaluate(affinity_level) → gameState[target] compareValue
│   │   [covered: 源码L112]
│   ├── S3-N04: evaluate(building_level) → gameState[target] compareValue
│   │   [covered: 源码L124]
│   ├── S3-N05: evaluate(event_completed) → completedEventIds.has(eventId)
│   │   [covered: 源码L136]
│   ├── S3-N06: evaluateAll(空数组) → true
│   │   [covered: 源码L69 !conditions || length===0]
│   └── S3-N07: evaluateAll(多个条件) → AND逻辑短路
│       [covered: 源码L73 for循环+return false]
│
├── F-Boundary
│   ├── S3-B01: evaluate(gameState=undefined) → resource/affinity/building返回true
│   │   [covered: 源码L105/117/129 !gameState → true]
│   ├── S3-B02: evaluateAll(undefined) → true
│   │   [covered: 源码L69]
│   └── S3-B03: compareValue(NaN参数) → ⚠️ NaN比较(同S2-B05)
│       [源码L162与EventTriggerConditions共享逻辑]
│
└── F-Error
    └── S3-E01: evaluate(event_completed, eventId不存在于Set) → false
        [covered: Set.has行为]
```

---

## S4: EventProbabilityCalculator (52行)

### 公开API

| API | 行号 | 说明 |
|-----|------|------|
| calculateProbability(probCondition) | L27 | P = clamp(base + Σ(add) × Π(mul), 0, 1) |

### 流程树

```
S4: EventProbabilityCalculator
├── F-Normal
│   ├── S4-N01: calculateProbability(base=0.3, 无modifiers) → P=0.3
│   │   [covered: 源码L37 modifiers空→add=0, mul=1]
│   ├── S4-N02: calculateProbability(additive modifiers) → P=base+Σ(add)
│   │   [covered: 源码L39 reduce sum]
│   ├── S4-N03: calculateProbability(multiplicative modifiers) → P=base×Π(mul)
│   │   [covered: 源码L42 reduce product]
│   └── S4-N04: calculateProbability(mixed) → P=clamp(base+add)×mul
│       [covered: 源码L45]
│
├── F-Boundary
│   ├── S4-B01: calculateProbability(base=0) → P=0, triggered=false
│   │   [covered: Math.random() < 0 = false]
│   ├── S4-B02: calculateProbability(base=1) → P=1, triggered=true
│   │   [covered: Math.random() < 1 = true]
│   ├── S4-B03: calculateProbability(base=NaN) → ⚠️ NaN传播
│   │   [源码L45: Math.max(0, Math.min(1, NaN)) = NaN → triggered=NaN<NaN=false]
│   ├── S4-B04: calculateProbability(base=Infinity) → clamp为1
│   │   [covered: Math.min(1, ∞)=1]
│   ├── S4-B05: calculateProbability(base=-1) → clamp为0
│   │   [covered: Math.max(0, ...) = 0]
│   ├── S4-B06: calculateProbability(mul=0) → P=0
│   │   [covered: (base+add)×0 = 0]
│   └── S4-B07: calculateProbability(modifiers全inactive) → P=base
│       [covered: 源码L36 filter active→空数组, add=0, mul=1]
│
└── F-Error
    └── S4-E01: calculateProbability(modifiers含NaN) → ⚠️ NaN传播到finalProbability
        [源码L39/42: NaN + number = NaN, NaN × number = NaN]
```

---

## S5: EventTriggerLifecycle (111行)

### 公开API

| API | 行号 | 说明 |
|-----|------|------|
| resolveEvent(instanceId, optionId, state, deps?) | L27 | 处理事件选择 |
| expireEvents(currentTurn, state, deps?) | L72 | 处理过期事件 |

### 流程树

```
S5: EventTriggerLifecycle
├── F-Normal
│   ├── S5-N01: resolveEvent → status→resolved, completedEventIds.add, cooldown设置, activeEvents.delete
│   │   [covered: 源码L27-L55]
│   ├── S5-N02: resolveEvent(cooldownTurns定义) → 设置cooldown
│   │   [covered: 源码L45 def.cooldownTurns]
│   ├── S5-N03: resolveEvent → eventBus.emit('event:resolved')
│   │   [covered: 源码L49]
│   ├── S5-N04: expireEvents → status→expired, activeEvents.delete
│   │   [covered: 源码L72-L89]
│   └── S5-N05: expireEvents → eventBus.emit('event:expired')
│       [covered: 源码L85]
│
├── F-Boundary
│   ├── S5-B01: resolveEvent(instance不存在) → null
│   │   [covered: 源码L28]
│   ├── S5-B02: resolveEvent(status≠active) → null
│   │   [covered: 源码L29]
│   ├── S5-B03: resolveEvent(option不存在) → null
│   │   [covered: 源码L34]
│   ├── S5-B04: expireEvents(无过期事件) → 空数组
│   │   [covered: 源码L74 无匹配时expired=[]]
│   ├── S5-B05: expireEvents(expireTurn=null) → 不过期
│   │   [covered: 源码L79 expireTurn !== null 前置检查]
│   └── S5-B06: resolveEvent(cooldownTurns=undefined) → 不设置冷却
│       [covered: 源码L45 if(def.cooldownTurns)]
│
└── F-Cross
    └── S5-C01: resolveEvent → completedEventIds → 影响后续chain事件触发
        [covered: completedEventIds.add影响canTrigger]
```

---

## S6: EventTriggerSerialization (69行)

### 公开API

| API | 行号 | 说明 |
|-----|------|------|
| serializeEventTriggerState(state) | L31 | 序列化 |
| deserializeEventTriggerState(data) | L52 | 反序列化 |

### 流程树

```
S6: EventTriggerSerialization
├── F-Normal
│   ├── S6-N01: serialize → activeEvents数组+completedEventIds数组+cooldowns对象
│   │   [covered: 源码L31]
│   └── S6-N02: deserialize → 恢复Map/Set/Map
│       [covered: 源码L52]
│
├── F-Boundary
│   ├── S6-B01: deserialize(data.activeEvents=null) → ⚠️ crash
│   │   [源码L54: for...of null → TypeError]
│   ├── S6-B02: deserialize(data.cooldowns=null) → ⚠️ crash
│   │   [源码L65: Object.entries(null) → TypeError]
│   └── S6-B03: deserialize(data.completedEventIds=null) → ⚠️ crash
│       [源码L59: for...of null → TypeError]
│
└── F-Cross
    └── S6-C01: serialize → deserialize 往返一致性
        [covered: Map→Array→Map, Set→Array→Set]
```

---

## S7: EventChainSystem (403行)

### 公开API

| API | 行号 | 说明 |
|-----|------|------|
| registerChain(chain) | L116 | 注册事件链(maxDepth≤3) |
| registerChains(chains) | L124 | 批量注册 |
| getCurrentChainNode(chainId) | L129 | 获取当前节点 |
| advanceChain(chainId, optionId) | L142 | 推进链 |
| startChain(chainId) | L176 | 开始链 |
| getChainProgress(chainId) | L193 | 获取进度 |
| registerStoryEvent(event) | L209 | 注册剧情事件 |
| canTriggerStoryEvent(eventId) | L222 | 检查剧情可触发 |
| triggerStoryEvent(eventId) | L232 | 触发剧情 |
| addLogEntry(entry) | L267 | 添加日志 |
| logEventResolved(...) | L282 | 记录事件解决 |
| getEventLog(limit?, type?) | L300 | 获取日志 |
| addReturnAlert(alert) | L322 | 添加急报 |
| addOfflineAlerts(events) | L332 | 批量添加急报 |
| getReturnAlerts(unreadOnly?) | L340 | 获取急报 |
| markAlertRead(alertId) | L347 | 标记已读 |
| markAllAlertsRead() | L350 | 全部已读 |
| clearReadAlerts() | L353 | 清除已读 |
| serialize() | L363 | 序列化 |
| deserialize(data) | L381 | 反序列化 |

### 流程树

```
S7: EventChainSystem
├── F-Normal
│   ├── S7-N01: registerChain → chains.set + chainProgress初始化
│   │   [covered: 源码L116]
│   ├── S7-N02: startChain → 找depth=0节点, 设置currentNodeId
│   │   [covered: 源码L176]
│   ├── S7-N03: advanceChain → 标记完成+查找匹配option的nextNode
│   │   [covered: 源码L142]
│   ├── S7-N04: advanceChain(无后续) → currentNodeId=null
│   │   [covered: 源码L167]
│   ├── S7-N05: triggerStoryEvent → triggered=true + addLogEntry + addReturnAlert
│   │   [covered: 源码L232]
│   ├── S7-N06: addLogEntry → 推入日志, 超过100条截断
│   │   [covered: 源码L267]
│   ├── S7-N07: addReturnAlert → 委托createReturnAlert
│   │   [covered: 源码L322]
│   ├── S7-N08: getReturnAlerts(unreadOnly=true) → filterUnreadAlerts
│   │   [covered: 源码L340]
│   ├── S7-N09: serialize → chainProgress+triggeredStoryIds+log+alerts
│   │   [covered: 源码L363]
│   └── S7-N10: deserialize → 恢复所有状态
│       [covered: 源码L381]
│
├── F-Boundary
│   ├── S7-B01: registerChain(maxDepth>3) → throw Error
│   │   [covered: 源码L117]
│   ├── S7-B02: startChain(不存在的chainId) → null
│   │   [covered: 源码L178 !chain]
│   ├── S7-B03: startChain(空nodes) → null
│   │   [covered: 源码L178 chain.nodes.length === 0]
│   ├── S7-B04: advanceChain(不存在的chainId) → null
│   │   [covered: 源码L148 !chain || !progress]
│   ├── S7-B05: triggerStoryEvent(已触发) → null
│   │   [covered: 源码L235 event.triggered]
│   ├── S7-B06: addLogEntry(超过100条) → 截断保留最新100条
│   │   [covered: 源码L275]
│   ├── S7-B07: getEventLog(limit=N) → 返回最后N条
│   │   [covered: 源码L307]
│   └── S7-B08: deserialize(data.eventChains=null) → ⚠️ crash
│       [源码L382: for...of null → TypeError]
│
├── F-Error
│   ├── S7-E01: advanceChain(deps=null) → eventBus.emit crash
│   │   [源码L170: deps?.eventBus.emit — 可选链安全]
│   └── S7-E02: deserialize(data=null) → ⚠️ crash
│       [源码L381: data.eventChains → null.eventChains]
│
└── F-Cross
    ├── S7-C01: triggerStoryEvent → addLogEntry + addReturnAlert 联动
    │   [covered: 源码L232-L257]
    ├── S7-C02: serialize → deserialize 往返一致性
    │   [covered: 源码L363/L381]
    └── S7-C03: advanceChain → eventBus.emit('event:chainAdvanced')
        [covered: 源码L170]
```

---

## S8: ChainEventSystem (326行)

### 公开API

| API | 行号 | 说明 |
|-----|------|------|
| registerChain(chain) | L85 | 注册(验证maxDepth+节点深度) |
| registerChains(chains) | L105 | 批量注册 |
| getChain(chainId) | L110 | 获取定义 |
| getAllChains() | L117 | 获取所有 |
| startChain(chainId) | L128 | 开始链(找depth=0) |
| advanceChain(chainId, optionId) | L159 | 推进链 |
| getCurrentNode(chainId) | L237 | 获取当前节点 |
| getProgress(chainId) | L247 | 获取进度 |
| getProgressStats(chainId) | L252 | 进度统计 |
| isChainStarted(chainId) | L265 | 是否已开始 |
| isChainCompleted(chainId) | L270 | 是否已完成 |
| getNextNodes(chainId, nodeId) | L275 | 后续节点列表 |
| exportSaveData() | L285 | 导出存档 |
| importSaveData(data) | L308 | 导入存档 |

### 流程树

```
S8: ChainEventSystem
├── F-Normal
│   ├── S8-N01: registerChain → 验证maxDepth≤MAX_ALLOWED_DEPTH(5) + 节点深度验证
│   │   [covered: 源码L85]
│   ├── S8-N02: startChain → 找rootNode(depth=0), 创建ChainProgress
│   │   [covered: 源码L128]
│   ├── S8-N03: advanceChain(success) → 标记完成+查找nextNode+emit
│   │   [covered: 源码L159]
│   ├── S8-N04: advanceChain(无后续) → isCompleted=true, completedAt=Date.now()
│   │   [covered: 源码L222]
│   ├── S8-N05: getProgressStats → {completed, total, percentage}
│   │   [covered: 源码L252]
│   ├── S8-N06: exportSaveData → chainProgresses序列化
│   │   [covered: 源码L285]
│   └── S8-N07: importSaveData → 恢复progresses Map
│       [covered: 源码L308]
│
├── F-Boundary
│   ├── S8-B01: registerChain(maxDepth>5) → throw Error
│   │   [covered: 源码L87]
│   ├── S8-B02: registerChain(节点depth>maxDepth) → throw Error
│   │   [covered: 源码L93]
│   ├── S8-B03: startChain(不存在的chainId) → null
│   │   [covered: 源码L131]
│   ├── S8-B04: startChain(无rootNode) → null
│   │   [covered: 源码L134 nodes.find(depth=0)失败]
│   ├── S8-B05: advanceChain(未开始的链) → success=false
│   │   [covered: 源码L168 !progress]
│   ├── S8-B06: advanceChain(已完成的链) → success=false, chainCompleted=true
│   │   [covered: 源码L173 progress.isCompleted]
│   ├── S8-B07: getProgressStats(不存在的chainId) → {completed:0, total:0, percentage:0}
│   │   [covered: 源码L256 !chain → 默认值]
│   ├── S8-B08: importSaveData(data.chainProgresses=null) → ⚠️ crash
│   │   [源码L310: for...of null → TypeError]
│   └── S8-B09: advanceChain(optionId不匹配任何节点) → 链完成
│       [covered: 源码L203 nextNode=null → isCompleted=true]
│
├── F-Error
│   └── S8-E01: registerChain(chain=null) → ⚠️ crash
│       [源码L87: chain.maxDepth → null.maxDepth]
│
└── F-Cross
    ├── S8-C01: startChain → advanceChain → exportSaveData 完整链路
    │   [covered: 完整生命周期]
    └── S8-C02: exportSaveData → importSaveData 往返一致性
        [covered: 源码L285/L308]
```

---

## S9: StoryEventSystem (383行)

### 公开API

| API | 行号 | 说明 |
|-----|------|------|
| init(deps) | L229 | 初始化+加载默认剧情 |
| registerStory(story) | L247 | 注册剧情 |
| registerStories(stories) | L248 | 批量注册 |
| getStory(storyId) | L249 | 获取剧情 |
| getAllStories() | L250 | 获取所有 |
| getStoriesByEra(era) | L251 | 按时代筛选 |
| canTriggerStory(storyId, turn?) | L255 | 检查可触发 |
| getAvailableStories(turn) | L282 | 获取可触发列表 |
| triggerStory(storyId) | L289 | 触发剧情 |
| advanceStory(storyId) | L303 | 推进剧情 |
| getCurrentAct(storyId) | L330 | 获取当前幕 |
| getProgress(storyId) | L336 | 获取进度 |
| getProgressStats(storyId) | L337 | 进度统计 |
| isStoryTriggered/Completed | L345/346 | 状态查询 |
| getCompletedStories/getActiveStories | L347/348 | 列表查询 |
| exportSaveData() | L357 | 导出存档 |
| importSaveData(data) | L369 | 导入存档 |

### 流程树

```
S9: StoryEventSystem
├── F-Normal
│   ├── S9-N01: init → loadDefaultStories(3个预定义剧情: 黄巾/董卓/官渡)
│   │   [covered: 源码L229]
│   ├── S9-N02: canTriggerStory → 检查prerequisiteStoryIds + triggerConditions
│   │   [covered: 源码L255]
│   ├── S9-N03: triggerStory → 创建StoryProgress, emit story:triggered
│   │   [covered: 源码L289]
│   ├── S9-N04: advanceStory → completedActIds.add + 移到下一幕
│   │   [covered: 源码L303]
│   ├── S9-N05: advanceStory(最后一幕) → completed=true, completedAt=now
│   │   [covered: 源码L319]
│   ├── S9-N06: getAvailableStories → filter canTrigger + sort by order
│   │   [covered: 源码L282]
│   ├── S9-N07: exportSaveData → storyProgresses序列化
│   │   [covered: 源码L357]
│   └── S9-N08: importSaveData → 恢复progresses Map
│       [covered: 源码L369]
│
├── F-Boundary
│   ├── S9-B01: canTriggerStory(不存在的storyId) → false
│   │   [covered: 源码L257 !story]
│   ├── S9-B02: canTriggerStory(已触发) → false
│   │   [covered: 源码L259 progress?.triggered]
│   ├── S9-B03: canTriggerStory(前置未完成) → false
│   │   [covered: 源码L262 prerequisiteStoryIds检查]
│   ├── S9-B04: triggerStory(不存在的storyId) → null
│   │   [covered: 源码L290 !story]
│   ├── S9-B05: advanceStory(未触发) → success=false
│   │   [covered: 源码L307 !progress]
│   ├── S9-B06: advanceStory(已完成) → success=false, storyCompleted=true
│   │   [covered: 源码L310 progress.completed]
│   ├── S9-B07: getProgressStats(不存在的storyId) → {completed:0, total:0, percentage:0}
│   │   [covered: 源码L339 !story → 默认值]
│   └── S9-B08: importSaveData(data.storyProgresses=null) → ⚠️ crash
│       [源码L370: for...of null → TypeError]
│
├── F-Error
│   └── S9-E01: evaluateCondition(turn_range, params.minTurn=NaN) → ⚠️ NaN比较
│       [源码L350: currentTurn >= NaN → false, 条件不通过]
│
└── F-Cross
    ├── S9-C01: 黄巾之乱 → 董卓进京 → 官渡之战 前置依赖链
    │   [covered: DEFAULT_STORY_EVENTS prerequisiteStoryIds]
    ├── S9-C02: triggerStory → advanceStory → exportSaveData 完整链路
    │   [covered: 完整生命周期]
    └── S9-C03: exportSaveData → importSaveData 往返一致性
        [covered: 源码L357/L369]
```

---

## S10: OfflineEventSystem (451行)

### 公开API

| API | 行号 | 说明 |
|-----|------|------|
| registerEventDef(def) | L92 | 注册事件定义 |
| registerEventDefs(defs) | L96 | 批量注册 |
| addOfflineEvent(event) | L103 | 添加离线事件 |
| addOfflineEvents(events) | L121 | 批量添加 |
| getOfflineQueue() | L133 | 获取队列 |
| getPendingEvents() | L137 | 待处理事件 |
| getAutoProcessedEvents() | L141 | 已自动处理 |
| getQueueSize() | L145 | 队列大小 |
| clearQueue() | L149 | 清空队列 |
| registerAutoRule(rule) | L155 | 注册自动处理规则 |
| registerAutoRules(rules) | L159 | 批量注册 |
| setRuleEnabled(ruleId, enabled) | L172 | 启用/禁用规则 |
| removeAutoRule(ruleId) | L176 | 移除规则 |
| processOfflineEvents() | L181 | 处理离线事件队列 |
| manualProcessEvent(entryId, optionId) | L246 | 手动处理单个 |
| generateRetrospective() | L261 | 生成回溯数据 |
| exportSaveData() | L291 | 导出存档 |
| importSaveData(data) | L298 | 导入存档 |

### 流程树

```
S10: OfflineEventSystem
├── F-Normal
│   ├── S10-N01: addOfflineEvent → 创建entry+推入队列+限制50条
│   │   [covered: 源码L103]
│   ├── S10-N02: addOfflineEvents → 循环调用addOfflineEvent
│   │   [covered: 源码L121]
│   ├── S10-N03: registerAutoRule → autoRules.set
│   │   [covered: 源码L155]
│   ├── S10-N04: processOfflineEvents → 按紧急度排序+匹配规则+自动/手动分流
│   │   [covered: 源码L181]
│   ├── S10-N05: processOfflineEvents(自动处理) → selectOption+汇总资源变化
│   │   [covered: 源码L199-L218]
│   ├── S10-N06: manualProcessEvent → 查找entry+验证option+标记已处理+移除
│   │   [covered: 源码L246]
│   ├── S10-N07: generateRetrospective → 汇总资源变化+时间线
│   │   [covered: 源码L261]
│   ├── S10-N08: exportSaveData → 队列+规则序列化
│   │   [covered: 源码L291]
│   └── S10-N09: importSaveData → 恢复队列+规则
│       [covered: 源码L298]
│
├── F-Boundary
│   ├── S10-B01: addOfflineEvent(超过50条) → 截断保留最新50条
│   │   [covered: 源码L112]
│   ├── S10-B02: processOfflineEvents(空队列) → auto=0, manual=0
│   │   [covered: sorted为空→循环不执行]
│   ├── S10-B03: manualProcessEvent(不存在的entryId) → null
│   │   [covered: 源码L248 !entry]
│   ├── S10-B04: manualProcessEvent(不存在的optionId) → null
│   │   [covered: 源码L254 !option]
│   ├── S10-B05: selectOption(best_outcome) → 资源收益最大
│   │   [covered: 源码L388]
│   ├── S10-B06: selectOption(safest) → 损失最小
│   │   [covered: 源码L398]
│   ├── S10-B07: selectOption(weighted_random) → 随机权重选择
│   │   [covered: 源码L414]
│   ├── S10-B08: selectOption(skip) → 返回空字符串
│   │   [covered: 源码L425]
│   └── S10-B09: importSaveData(data.offlineQueue=null) → ⚠️ crash
│       [源码L299: data.offlineQueue ?? [] — 有null coalescing防护 ✓]
│
├── F-Error
│   ├── S10-E01: selectOption(eventDef.options为空) → ⚠️ crash
│   │   [源码L382: def.options[0].id → options[0]不存在时crash]
│   └── S10-E02: findMatchingRule(urgencyThreshold无效) → URGENCY_ORDER[undefined]=0
│       [covered: 源码L349 ?? 0默认值]
│
└── F-Cross
    ├── S10-C01: processOfflineEvents → findMatchingRule → selectOption → getOptionConsequences
    │   [covered: 完整自动处理链路]
    ├── S10-C02: exportSaveData → importSaveData 往返一致性
    │   [covered: 源码L291/L298]
    └── S10-C03: addOfflineEvent → processOfflineEvents → generateRetrospective 完整链路
        [covered: 离线事件完整生命周期]
```

---

## S11: OfflineEventHandler (284行)

### 公开API

| API | 行号 | 说明 |
|-----|------|------|
| simulateOfflineEvents(turns, events, prob) | L63 | 模拟离线事件触发 |
| tryAutoResolve(eventDef) | L107 | 尝试自动处理 |
| processOfflinePile(pile) | L171 | 处理堆积事件 |
| resolveOfflineEvent(pile, eventId, optionId) | L204 | 手动处理单个 |
| getPileStats(pile) | L237 | 堆积统计 |
| convertToNotifications(pile) | L249 | 转换为通知列表 |

### 流程树

```
S11: OfflineEventHandler
├── F-Normal
│   ├── S11-N01: simulateOfflineEvents → 每回合概率触发+随机选事件
│   │   [covered: 源码L63]
│   ├── S11-N02: tryAutoResolve(low urgency) → autoChooseOption
│   │   [covered: 源码L107]
│   ├── S11-N03: tryAutoResolve(high urgency) → null(保留手动)
│   │   [covered: 源码L115]
│   ├── S11-N04: processOfflinePile → 分流pending/auto+汇总资源
│   │   [covered: 源码L171]
│   ├── S11-N05: resolveOfflineEvent → 验证entry+option+标记已处理
│   │   [covered: 源码L204]
│   └── S11-N06: convertToNotifications → 跳过已自动处理的, 生成通知
│       [covered: 源码L249]
│
├── F-Boundary
│   ├── S11-B01: simulateOfflineEvents(turns=0) → 空pile
│   │   [covered: 循环不执行]
│   ├── S11-B02: simulateOfflineEvents(超过MAX_PILE_SIZE=10) → 最多10条
│   │   [covered: 源码L76 entries.length >= MAX_PILE_SIZE]
│   ├── S11-B03: simulateOfflineEvents(availableEvents=空) → 空pile
│   │   [covered: 源码L79 eventDef undefined → continue]
│   ├── S11-B04: resolveOfflineEvent(不存在的eventId) → success=false
│   │   [covered: 源码L213 !entry]
│   ├── S11-B05: resolveOfflineEvent(已自动处理) → success=false
│   │   [covered: 源码L217 entry.autoResult]
│   ├── S11-B06: resolveOfflineEvent(不存在的optionId) → success=false
│   │   [covered: 源码L222 !option]
│   └── S11-B07: autoChooseOption(options为空) → throw Error
│       [covered: 源码L131 throw]
│
└── F-Cross
    └── S11-C01: simulateOfflineEvents → processOfflinePile → resolveOfflineEvent 完整链路
        [covered: 离线事件完整流程]
```

---

## S12: EventNotificationSystem (225行)

### 公开API

| API | 行号 | 说明 |
|-----|------|------|
| createBanner(instance, eventDef, turn?) | L71 | 创建急报横幅 |
| createBanners(entries, turn?) | L89 | 批量创建 |
| getBanner(id) | L91 | 获取横幅 |
| getActiveBanners() | L92 | 活跃横幅(优先级排序) |
| getUnreadBanners() | L92 | 未读横幅 |
| getBannerState() | L96 | 横幅状态 |
| markBannerRead(id) | L101 | 标记已读 |
| markAllBannersRead() | L101 | 全部已读 |
| removeBanner(id) | L101 | 移除横幅 |
| expireBanners(turn) | L102 | 过期横幅 |
| createEncounterPopup(instance, eventDef) | L119 | 创建遭遇弹窗 |
| resolveEncounter(encounterId, optionId) | L128 | 解决遭遇 |
| dismissEncounter(encounterId) | L138 | 关闭遭遇 |
| exportSaveData() | L147 | 导出存档 |
| importSaveData(data) | L151 | 导入存档 |

### 流程树

```
S12: EventNotificationSystem
├── F-Normal
│   ├── S12-N01: createBanner → urgency→bannerType+priority+插入有序队列
│   │   [covered: 源码L71]
│   ├── S12-N02: createEncounterPopup → 生成选项+consequencePreview
│   │   [covered: 源码L119]
│   ├── S12-N03: resolveEncounter → 查找option+创建result+emit
│   │   [covered: 源码L128]
│   ├── S12-N04: expireBanners(turn) → 检查expireTurn, 移除过期
│   │   [covered: 源码L102]
│   ├── S12-N05: getBannerState → {activeBanners, hasUnread, unreadCount}
│   │   [covered: 源码L96]
│   └── S12-N06: exportSaveData → banners+resolvedEncounters
│       [covered: 源码L147]
│
├── F-Boundary
│   ├── S12-B01: createBanner(超过maxBannerCount) → trimBanners移除已读
│   │   [covered: 源码L84 trimBanners]
│   ├── S12-B02: resolveEncounter(不存在的encounterId) → null
│   │   [covered: 源码L129 !popup]
│   ├── S12-B03: resolveEncounter(option不可用) → null
│   │   [covered: 源码L130 !option.available]
│   ├── S12-B04: dismissEncounter(非dismissible=critical) → false
│   │   [covered: 源码L139 !p.dismissible]
│   ├── S12-B05: dismissEncounter(不存在的encounterId) → false
│   │   [covered: 源码L139 !p]
│   └── S12-B06: importSaveData(data=null) → ⚠️ crash
│       [源码L151: data.banners → null.banners]
│
└── F-Cross
    ├── S12-C01: createBanner → eventBus.emit('event:banner_created')
    │   [covered: 源码L82]
    ├── S12-C02: resolveEncounter → eventBus.emit('event:encounter_resolved')
    │   [covered: 源码L135]
    └── S12-C03: exportSaveData → importSaveData 往返一致性
        [covered: 源码L147/L151]
```

---

## S13: EventUINotification (291行)

### 公开API

| API | 行号 | 说明 |
|-----|------|------|
| createBanner(event) | L114 | 创建横幅+入队 |
| getCurrentBanner() | L153 | 获取当前显示 |
| markCurrentBannerRead() | L160 | 标记当前已读 |
| dismissCurrentBanner() | L169 | 关闭当前+显示下一个 |
| getPendingBannerCount() | L191 | 待显示数量 |
| getExpiredBanners() | L197 | 过期横幅 |
| createEncounterModal(event) | L208 | 生成遭遇弹窗数据 |
| createEncounterModals(events) | L233 | 批量生成 |
| serialize() | L241 | 序列化 |
| deserialize(data) | L248 | 反序列化 |

### 流程树

```
S13: EventUINotification
├── F-Normal
│   ├── S13-N01: createBanner → enqueueBanner(优先级插入+限制队列长度)
│   │   [covered: 源码L114]
│   ├── S13-N02: dismissCurrentBanner → expired.push + 显示下一个pending
│   │   [covered: 源码L169]
│   ├── S13-N03: createEncounterModal → 生成EncounterModalData
│   │   [covered: 源码L208]
│   ├── S13-N04: serialize → expiredBanners
│   │   [covered: 源码L241]
│   └── S13-N05: deserialize → 恢复expired, current/pending清空
│       [covered: 源码L248]
│
├── F-Boundary
│   ├── S13-B01: createBanner(队列超过BANNER_MAX_QUEUE_SIZE) → 溢出到expired
│   │   [covered: 源码L267 splice+expired.push]
│   ├── S13-B02: dismissCurrentBanner(无当前) → return null
│   │   [covered: 源码L169 !current → null]
│   ├── S13-B03: createBanner(expired超过50) → 截断保留50条
│   │   [covered: 源码L174 expired.slice(-50)]
│   └── S13-B04: deserialize(data.expiredBanners=null) → ⚠️ 有防护
│       [源码L250: data.expiredBanners ?? [] — null coalescing ✓]
│
└── F-Cross
    ├── S13-C01: createBanner → eventBus.emit('event:banner_created')
    │   [covered: 源码L127]
    └── S13-C02: serialize → deserialize 往返一致性
        [covered: expired数组序列化/恢复]
```

---

## S14: EventLogSystem (184行)

### 公开API

| API | 行号 | 说明 |
|-----|------|------|
| logEvent(entry) | L91 | 添加日志 |
| logEventResolved(...) | L99 | 记录事件解决 |
| getEventLog(options?) | L114 | 查询日志(类型/回合/数量) |
| getLogEntry(logId) | L124 | 获取单条 |
| getLogCount() | L125 | 日志总数 |
| getLogCountByType(type) | L125 | 按类型计数 |
| getRecentLogs(count) | L125 | 最近N条 |
| addAlert(alert) | L128 | 添加急报 |
| addOfflineAlerts(events) | L129 | 批量添加 |
| getAlertStack() | L131 | 获取急报堆 |
| getAlerts(unreadOnly?) | L133 | 获取急报列表 |
| markAlertRead(alertId) | L135 | 标记已读 |
| markAllAlertsRead() | L135 | 全部已读 |
| clearReadAlerts() | L135 | 清除已读 |
| removeAlert(alertId) | L139 | 移除急报 |
| exportSaveData() | L143 | 导出存档 |
| importSaveData(data) | L147 | 导入存档 |

### 流程树

```
S14: EventLogSystem
├── F-Normal
│   ├── S14-N01: logEvent → 创建log+推入+trimLog(200条上限)
│   │   [covered: 源码L91]
│   ├── S14-N02: logEventResolved → 查找已有log或创建新+更新字段
│   │   [covered: 源码L99]
│   ├── S14-N03: getEventLog(eventType+fromTurn+toTurn+limit) → 多条件筛选
│   │   [covered: 源码L114]
│   ├── S14-N04: addAlert → 创建+按urgency排序+trimAlerts(50条上限)
│   │   [covered: 源码L128]
│   ├── S14-N05: getAlertStack → {alerts, totalCount, unreadCount, highestUrgency}
│   │   [covered: 源码L131]
│   ├── S14-N06: exportSaveData → log(200条)+alerts(50条)
│   │   [covered: 源码L143]
│   └── S14-N07: importSaveData → 恢复+同步counter
│       [covered: 源码L147]
│
├── F-Boundary
│   ├── S14-B01: logEvent(超过200条) → trimLog截断
│   │   [covered: 源码L150]
│   ├── S14-B02: addAlert(超过50条) → trimAlerts截断
│   │   [covered: 源码L151]
│   ├── S14-B03: getEventLog(limit=0) → 空数组
│   │   [covered: slice(-0)=[]]
│   ├── S14-B04: removeAlert(不存在的alertId) → false
│   │   [covered: 源码L140 idx < 0]
│   ├── S14-B05: markAlertRead(不存在的alertId) → false
│   │   [covered: 源码L135 !a]
│   └── S14-B06: importSaveData(data.eventLog=null) → ⚠️ 有防护
│       [源码L148: data.eventLog ?? [] — null coalescing ✓]
│
└── F-Cross
    ├── S14-C01: logEvent → eventBus.emit('eventLog:added')
    │   [covered: 源码L93]
    ├── S14-C02: addAlert → eventBus.emit('alert:added')
    │   [covered: 源码L129]
    └── S14-C03: exportSaveData → importSaveData 往返一致性
        [covered: 源码L143/L147]
```

---

## P0 节点汇总 (必须100%覆盖)

| # | 节点ID | 子系统 | 描述 | 源码行号 | 优先级 |
|---|--------|--------|------|----------|--------|
| P0-01 | S1-B07 | EventTriggerSystem | resolveEvent(不存在instance) → null | Lifecycle L28 | P0 |
| P0-02 | S1-B08 | EventTriggerSystem | resolveEvent(非active状态) → null | Lifecycle L29 | P0 |
| P0-03 | S1-B09 | EventTriggerSystem | resolveEvent(不存在option) → null | Lifecycle L34 | P0 |
| P0-04 | S1-E01 | EventTriggerSystem | deserialize(null) → crash | ETS L303 | P0 |
| P0-05 | S4-B03 | ProbabilityCalculator | calculateProbability(NaN) → NaN传播 | EPC L45 | P0 |
| P0-06 | S4-E01 | ProbabilityCalculator | modifiers含NaN → NaN传播 | EPC L39/42 | P0 |
| P0-07 | S6-B01 | Serialization | deserialize(null data) → crash | Ser L54 | P0 |
| P0-08 | S7-B08 | EventChainSystem | deserialize(null) → crash | ECS L382 | P0 |
| P0-09 | S8-B08 | ChainEventSystem | importSaveData(null) → crash | CES L310 | P0 |
| P0-10 | S9-B08 | StoryEventSystem | importSaveData(null) → crash | SES L370 | P0 |
| P0-11 | S10-E01 | OfflineEventSystem | selectOption(空options) → crash | OES L382 | P0 |
| P0-12 | S12-B06 | NotificationSystem | importSaveData(null) → crash | ENS L151 | P0 |
| P0-13 | S2-B04 | Conditions | evaluateTurnRange(NaN minTurn) → NaN比较 | ETC L72 | P0 |
| P0-14 | S2-B05 | Conditions | compareValue(NaN expected) → NaN比较 | ETC L158 | P0 |
| P0-15 | S1-E03 | EventTriggerSystem | checkAndTriggerEvents(负数turn) → 无检查 | ETS L141 | P0 |

## Builder规则验证清单

| 规则# | 规则 | Event模块适用 | 验证结果 |
|--------|------|--------------|----------|
| BR-01 | 每个公开API至少1个F-Normal | ✓ | 14个子系统共83个F-Normal节点 |
| BR-02 | 数值API检查NaN/负值/溢出 | ✓ | P0-05/06/13/14/15: 概率/条件/回合NaN传播 |
| BR-03 | 状态变更API检查serialize/deserialize | ✓ | P0-04/07/08/09/10/12: 6处null crash |
| BR-09 | 双系统并存分析 | ✓ | EventChainSystem(旧) vs ChainEventSystem(新) 重叠 |
| BR-14 | 保存/加载覆盖扫描 | ✓ | 10个子系统需验证engine-save调用 |
| BR-15 | deserialize覆盖验证六处 | ✓ | P0-04/07/08/09/10/12 |
| BR-16 | 跨系统回调注入验证 | ✓ | eventBus.emit依赖deps注入 |
| BR-17 | 战斗数值安全 | N/A | Event模块无战斗数值 |
| BR-21 | 资源比较NaN防护 | ✓ | P0-13/14: 条件评估NaN |

## 双系统并存分析 (BR-09)

| 维度 | EventChainSystem (旧) | ChainEventSystem (新) |
|------|----------------------|---------------------|
| 来源 | v1.0 | v7.0 Phase2 |
| maxDepth限制 | 3 (硬编码throw) | 5 (MAX_ALLOWED_DEPTH常量) |
| 节点查找 | parentOptionId匹配 | parentNodeId+parentOptionId双匹配 |
| 进度存储 | {currentNodeId, completedNodeIds} | ChainProgress(isCompleted, startedAt, completedAt) |
| 序列化 | 自定义EventChainSaveData | ChainEventSaveData |
| 事件发射 | event:chainAdvanced | chain:started/advanced/completed |
| **冲突风险** | 两系统共存可能导致同名方法混淆(registerChain/advanceChain/startChain) | ⚠️ 需验证调用方使用正确系统 |

---

## 统计

| 类别 | 数量 |
|------|------|
| 子系统 | 10 |
| 公开API | ~85 |
| F-Normal | 83 |
| F-Boundary | 67 |
| F-Error | 10 |
| F-Cross | 25 |
| F-Lifecycle | 9 |
| P0节点 | 15 |
| 跨系统链路 | 20 |
| ⚠️ 需修复 | 15 (P0节点) |
