# R1 对抗式测试 — TreeChallenger 质疑报告

> **挑战者**: TreeChallenger  
> **目标**: 对TreeBuilder的流程分支树进行5维度质疑  
> **评审日期**: 2025-01-XX

---

## 质疑方法论

对TreeBuilder识别的276个节点和30个缺口，按5个维度逐一质疑完备性：

---

## F-Normal: 主线流程完整性

### 质疑 N-1: EventTriggerSystem.init() 加载预定义事件后的ID冲突
**问题**: `loadPredefinedEvents()` 加载 `PREDEFINED_EVENTS` 到 `eventDefs`。如果用户之后 `registerEvent` 同ID事件会覆盖预定义事件。现有测试未覆盖"预定义事件被覆盖后触发行为"。
**严重度**: P1  
**建议**: 添加测试：注册同ID覆盖预定义事件 → 触发新定义

### 质疑 N-2: checkAndTriggerEvents 的随机事件概率路径
**问题**: TreeBuilder识别了3条路径（有ProbabilityCondition / 用def.triggerProbability / 用config默认值），但未测试"def.triggerProbability为0且无ProbabilityCondition"与"def.triggerProbability为undefined"的区分。
**严重度**: P0  
**建议**: 明确测试 triggerProbability=0 和 triggerProbability=undefined 两条路径

### 质疑 N-3: resolveEvent 中 cooldownTurns 的计算基准
**问题**: `resolveEvent` 中冷却设置为 `instance.triggeredTurn + def.cooldownTurns`。如果事件在第5回合触发、第8回合解决，冷却基准是第5回合而非第8回合。现有测试未验证此行为。
**严重度**: P1  
**建议**: 测试触发回合与解决回合不同时的冷却基准

### 质疑 N-4: EventLogSystem.logEventResolved 的匹配逻辑
**问题**: 匹配条件是 `eventDefId && !resolvedTurn && triggeredTurn === triggeredTurn`。如果同一eventDefId在同一turn触发两次（不同实例），只会匹配第一个。
**严重度**: P1  
**建议**: 测试同eventDefId同turn多次触发的logEventResolved行为

### 质疑 N-5: ChainEventSystem.advanceChain 的节点匹配逻辑
**问题**: 匹配条件是 `parentNodeId === previousNodeId && parentOptionId === optionId`。如果有多个节点共享同一parentNodeId但不同parentOptionId，应只匹配一个。但如果两个节点的parentOptionId相同呢？
**严重度**: P2  
**建议**: 测试同一parent+同一option多节点时的行为（取第一个find结果）

### 质疑 N-6: StoryEventSystem.advanceStory 的幕索引查找
**问题**: `currentIdx = story.acts.findIndex(a => a.id === previousActId)`，如果 `previousActId` 被手动修改（通过反序列化）为不存在的ID，`findIndex` 返回 -1，`-1 < story.acts.length - 1` 为 true，`nextAct = story.acts[0]`，导致跳回第一幕。
**严重度**: P1  
**建议**: 测试反序列化后currentActId无效时的advanceStory行为

### 质疑 N-7: OfflineEventSystem.processOfflineEvents 的排序+规则匹配交互
**问题**: 先按urgency排序（高优先），然后逐个匹配规则。规则中 `urgencyThreshold` 判断是 `URGENCY_ORDER[entry.urgency] >= URGENCY_ORDER[rule.urgencyThreshold]` → 跳过（不自动处理）。这意味着高紧急度事件不会被低阈值规则处理，但排序后高紧急度的先处理，如果无规则匹配则进入pending。
**严重度**: P0  
**建议**: 测试多个规则+多个不同urgency事件的组合场景

---

## F-Boundary: 边界条件覆盖

### 质疑 B-1: EventTriggerSystem 中 maxActiveEvents=0 的行为
**问题**: 如果config.maxActiveEvents设为0，canTrigger中 `activeEvents.size >= 0` 始终true，所有事件都无法触发。现有测试只测了maxActiveEvents=2。
**严重度**: P1  
**建议**: 测试maxActiveEvents=0和maxActiveEvents=1

### 质疑 B-2: EventTriggerConditions.turnInterval=0 的行为
**问题**: `currentTurn % 0` 在JavaScript中返回NaN，NaN !== 0 为true，所以turnInterval=0时条件始终不满足。
**严重度**: P1  
**建议**: 测试turnInterval=0和turnInterval=1

### 质疑 B-3: EventProbabilityCalculator 中 multiplicativeBonus=负值
**问题**: 公式 `(base + additive) * multiplicative`，如果multiplicative为负值，最终概率为负，clamp到0。但语义上乘法修正因子不应为负。
**严重度**: P2  
**建议**: 测试multiplicativeBonus为负值的边界情况

### 质疑 B-4: EventLogSystem 中 MAX_LOG_SIZE=200 的精确边界
**问题**: `trimLog` 在 `push` 之后调用，`length > 200` 时 `slice(-200)`。第201条时裁剪到200条，但测试中push了210条只验证 `<=200`，未验证精确值。
**严重度**: P2  
**建议**: 验证裁剪后精确长度和内容（保留最新的200条）

### 质疑 B-5: EventNotificationSystem 的 maxBannerCount 边界
**问题**: `trimBanners` 在while循环中移除已读banner，如果所有banner都未读，则移除最后一个。但如果maxBannerCount=0呢？
**严重度**: P1  
**建议**: 测试maxBannerCount=0和maxBannerCount=1

### 质疑 B-6: OfflineEventHandler.simulateOfflineEvents 中 triggerProbability=0 和 =1
**问题**: triggerProbability=0时 `Math.random() >= 0` 始终true（continue），无事件触发。triggerProbability=1时 `Math.random() >= 1` 几乎始终false（触发）。但Math.random()可能返回0，此时 `0 >= 1` 为false。
**严重度**: P2  
**建议**: 测试triggerProbability=0（确保无触发）和=1（确保触发）

### 质疑 B-7: OfflineEventSystem.addOfflineEvent 的ID生成
**问题**: ID格式 `offline-${++this.entryIdCounter}`。importSaveData后entryIdCounter未恢复，新添加的事件ID可能与导入的数据冲突。
**严重度**: P1  
**建议**: 测试importSaveData后addOfflineEvent的ID唯一性

### 质疑 B-8: ChainEventSystem.registerChain 中 nodes为空数组
**问题**: nodes为空时注册成功，但startChain找不到根节点(depth=0)返回null。不会throw。
**严重度**: P2  
**建议**: 测试空nodes链的注册和startChain行为

### 质疑 B-9: StoryEventSystem 剧情acts为空数组
**问题**: `triggerStory` 中 `firstAct = story.acts[0]` 为undefined，`currentActId` 设为undefined。后续advanceStory的findIndex返回-1。
**严重度**: P1  
**建议**: 测试空acts剧情的trigger+advance行为

---

## F-Error: 异常路径覆盖

### 质疑 E-1: EventTriggerSystem.deserialize 中 instanceCounter 不恢复
**问题**: 反序列化后instanceCounter仍为0，新创建的实例ID从event-inst-1开始，可能与反序列化恢复的实例ID冲突。
**严重度**: P0  
**建议**: 测试反序列化后触发新事件的实例ID唯一性

### 质疑 E-2: EventTriggerSystem 中 eventDefs 在 reset 后不清除
**问题**: `reset()` 清除activeEvents/completedEventIds/cooldowns，但不清除eventDefs。重新init时会再次loadPredefinedEvents。如果reset后不init直接registerEvent，eventDefs为空。
**严重度**: P1  
**建议**: 测试reset后直接registerEvent+forceTriggerEvent

### 质疑 E-3: EventTriggerLifecycle.resolveEvent 中 activeEvents.delete 在 emit 之前
**问题**: 先从activeEvents中删除实例，然后emit事件。如果事件监听器中查询activeEvents，已找不到该实例。
**严重度**: P1  
**建议**: 测试resolveEvent emit时activeEvents中是否还有该实例

### 质疑 E-4: OfflineEventHandler.autoChooseOption 中 options为空
**问题**: `if (options.length === 0) throw new Error(...)` — 直接throw而非返回null。调用方tryAutoResolve没有try-catch。
**严重度**: P0  
**建议**: 测试空options事件的tryAutoResolve行为（应throw）

### 质疑 E-5: OfflineEventSystem.getOptionConsequences 中 eventDef 未注册
**问题**: `manualProcessEvent` 调用 `getOptionConsequences`，如果eventDefId未注册则返回null。但addOfflineEvent时不验证eventDefId是否已注册。
**严重度**: P1  
**建议**: 测试未注册eventDef的offlineEvent的manualProcess

### 质疑 E-6: EventNotificationSystem.resolveEncounter 中 unavailable选项
**问题**: popup.options中有 `available` 字段，如果 `!option.available` 返回null。但createEncounterPopup时所有选项的available都设为true。
**严重度**: P2  
**建议**: 测试手动设置available=false后的resolve行为

### 质疑 E-7: EventUINotification.deserialize 中 pending 丢失
**问题**: deserialize只恢复expired，pending和current设为null/空。反序列化后pending中的横幅丢失。
**严重度**: P1  
**建议**: 测试序列化/反序列化后pending队列状态

---

## F-Cross: 跨系统交互覆盖

### 质疑 X-1: EventTriggerSystem + EventLogSystem 的日志联动缺失
**问题**: EventTriggerSystem的resolveEvent/expireEvents只emit事件，不直接调用EventLogSystem.logEvent。需要外部协调器连接两者。现有测试未覆盖"协调器"的完整流程。
**严重度**: P1  
**建议**: 添加集成测试模拟协调器行为

### 质疑 X-2: ChainEventSystem + EventTriggerSystem 的连锁事件触发
**问题**: ChainEventSystem的节点关联eventDefId，但advanceChain后不自动触发EventTriggerSystem中的事件。需要外部协调。
**严重度**: P1  
**建议**: 测试链推进后手动触发关联事件的完整流程

### 质疑 X-3: StoryEventSystem + EventTriggerSystem 的剧情事件完成检查
**问题**: StoryEventSystem.evaluateCondition中event_completed检查的是 `this.progresses.get(eventId)?.completed`，这里的eventId是StoryProgress的storyId，不是EventTriggerSystem的completedEventIds。两个系统的完成状态是独立的。
**严重度**: P0  
**建议**: 测试StoryEventSystem的event_completed条件使用自己的进度而非EventTriggerSystem

### 质疑 X-4: OfflineEventHandler + OfflineEventSystem 数据格式差异
**问题**: OfflineEventHandler使用OfflineEventPile（有id/processed字段），OfflineEventSystem使用OfflineEventEntry[]。两者数据结构不完全兼容。
**严重度**: P1  
**建议**: 测试两个系统间数据转换的正确性

### 质疑 X-5: EventNotificationSystem + EventUINotification 双横幅系统
**问题**: 两个系统都管理横幅，但数据结构不同（EventBanner vs EventBanner）。需要确认是否为同一系统的不同版本。
**严重度**: P2  
**建议**: 确认两个系统的关系，测试各自的独立行为

### 质疑 X-6: 全系统序列化顺序依赖
**问题**: 多系统序列化/反序列化是否有顺序依赖？例如OfflineEventSystem依赖eventDefs注册，如果先反序列化OfflineEvent再注册eventDefs，processOfflineEvents会找不到选项。
**严重度**: P1  
**建议**: 测试不同反序列化顺序的系统行为

---

## F-Lifecycle: 数据生命周期覆盖

### 质疑 L-1: EventTriggerSystem 反序列化后冷却状态恢复
**问题**: deserialize恢复cooldowns Map，但tickCooldowns在checkAndTriggerEvents开始时执行。如果反序列化后直接调用checkAndTriggerEvents，冷却可能立即被清理。
**严重度**: P1  
**建议**: 测试反序列化后冷却的正确清理时机

### 质疑 L-2: EventLogSystem 的 logIdCounter/alertIdCounter 恢复
**问题**: importSaveData设置 `this.logIdCounter = this.eventLog.length`，但如果原始counter大于日志数量（因为trimLog裁剪），新ID可能与旧ID冲突。
**严重度**: P1  
**建议**: 测试裁剪后importSaveData的ID唯一性

### 质疑 L-3: ChainEventSystem 反序列化后继续推进
**问题**: importSaveData恢复progresses，但chains需要重新注册。如果反序列化后未注册chain就调用advanceChain，会返回失败。
**严重度**: P1  
**建议**: 测试反序列化后未注册chain的advance行为

### 质疑 L-4: StoryEventSystem 反序列化 + 默认剧情加载
**问题**: init时加载默认剧情到storyDefs，importSaveData只恢复progresses。如果自定义剧情在序列化时未单独保存storyDefs，反序列化后progresses引用的storyId在storyDefs中不存在。
**严重度**: P1  
**建议**: 测试自定义剧情序列化/反序列化后的完整性

### 质疑 L-5: OfflineEventSystem 的 entryIdCounter 恢复
**问题**: exportSaveData不包含entryIdCounter，importSaveData后counter为0。新添加的事件ID从offline-1开始，可能与导入数据冲突。
**严重度**: P1  
**建议**: 测试importSaveData后addOfflineEvent的ID唯一性

### 质疑 L-6: EventNotificationSystem 序列化不包含activeEncounters
**问题**: exportSaveData只保存banners和resolvedEncounters，activeEncounters（未解决的遭遇弹窗）在序列化时丢失。
**严重度**: P0  
**建议**: 测试有未解决遭遇时的序列化/反序列化

---

## 质疑总结

| 维度 | 质疑数 | P0 | P1 | P2 |
|------|--------|----|----|-----|
| F-Normal | 7 | 2 | 4 | 1 |
| F-Boundary | 9 | 0 | 6 | 3 |
| F-Error | 7 | 2 | 3 | 2 |
| F-Cross | 6 | 1 | 4 | 1 |
| F-Lifecycle | 6 | 1 | 5 | 0 |
| **合计** | **35** | **6** | **22** | **7** |

### 关键发现

1. **P0-1**: instanceCounter反序列化不恢复 → 实例ID冲突风险
2. **P0-2**: OfflineEventHandler空options直接throw → 调用方无保护
3. **P0-3**: Story与EventTrigger的完成状态独立 → 条件检查可能错误
4. **P0-4**: 随机事件概率路径区分不足
5. **P0-5**: OfflineEventSystem规则匹配的urgencyThreshold逻辑
6. **P0-6**: EventNotificationSystem序列化丢失activeEncounters

### TreeBuilder遗漏的节点

TreeBuilder的30个缺口基本准确，但Challenger补充了以下遗漏：

| 补充ID | 描述 | 维度 |
|--------|------|------|
| G31 | maxActiveEvents=0的极端边界 | F-Boundary |
| G32 | turnInterval=0导致NaN | F-Boundary |
| G33 | StoryEventSystem反序列化后currentActId无效 | F-Error |
| G34 | resolveEvent emit时activeEvents已删除 | F-Cross |
| G35 | EventNotificationSystem序列化丢失activeEncounters | F-Lifecycle |
