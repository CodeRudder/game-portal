# v15.0 事件风云 — Play 文档 (Round 2)

> 版本: v15.0 事件风云 | 引擎域: engine/event/(12个系统)
> 日期: 2025-07-19 | 轮次: Round 2

---

## P1: 随机遭遇 → 概率判定 → 选项选择 → 后果结算

```
1. EventTriggerSystem.checkAndTriggerEvents(turn)
   → 遍历随机事件池 → 冷却检查 → 概率判定: Math.random() < triggerProbability
2. 触发成功: triggerEvent(eventId, turn) → createInstance → 设置冷却
3. 急报横幅: EventNotificationSystem.addNotification(event)
   → 6级优先级排队: URGENT>CRITICAL>HIGH>MEDIUM>LOW>INFO
4. 玩家选择: resolveEvent(instanceId, optionIndex)
   → EventTriggerEngine: P = clamp(base + Σ(additive) * Π(multiplicative), 0, 1)
   → 资源变动 + 声望变化 + 好感度变化
```
**验证**: `evaluateProbability(0.03, [{type:'additive',value:0.02}]) === 0.05`

## P2: 连锁事件链 → 分支选择 → 路径追踪 → 链完成奖励

```
1. ChainEventSystem.registerChain(chainDef) → 最大深度5
2. startChain(chainId) → chainProgress: {currentNodeId, history, status:'active'}
3. advanceChain(chainId, optionId) → 验证分支条件 → history.push
4. v15: ChainEventEngine.getSnapshot() → 完整链状态快照
   → abandonBranch回退 + getCurrentOptions
5. 链完成: currentNodeId==='end' → 发放奖励 → exportSaveData持久化
```
**验证**: `ChainEventEngine.getSnapshot('chain-001').path.length === 3`

## P3: 限时机遇 → 时段触发 → 窗口倒计时 → 错过处理

```
1. EventTriggerEngine.registerConditionGroup({eventId, timeCondition:{turnInterval:10}})
2. evaluateTriggerConditions(eventId, turn, gameState) → 时间+冷却检查
3. EventEngine.setTimedEvent(eventId, {window:30}) → isTimedEventActive检查窗口
4. 窗口到期: expireEvents(turn) → 限时事件错过消失
5. 离线: OfflineEventHandler → 限时事件不计入堆积
```
**验证**: `EventEngine.isTimedEventActive('timed-001') === false` (过期后)

## P4: 离线事件堆积 → 自动处理 → 上线批量查看

```
1. OfflineEventHandler.simulateOfflineEvents(turns, events, 0.3)
   → 每回合30%概率触发 → 最多堆积10个
2. 自动处理: MEDIUM及以下→autoResolve→选默认→50%奖励
   → HIGH及以上→保留等待手动处理
3. OfflineEventSystem.processOfflineEvents(offlineData)
   → 正面:保守50% | 负面:防御减免 | 剧情:等待上线
```
**验证**: `OfflineEventHandler.autoResolve(entry).rewardMultiplier === 0.5`

## P5: 事件日志 → 回归急报 → 历史回看

```
1. EventLogSystem.logEventResolved(eventId, choice, consequences)
   → 保留最近100条日志
2. 回归急报: addReturnAlert(alert) → 按优先级排序
   → markAlertRead / markAllAlertsRead
3. 故事事件: StoryEventSystem.triggerStoryEvent(eventId)
   → canTriggerStoryEvent条件检查
```
**验证**: `EventLogSystem.getLogCount() <= 100`

---

## 交叉验证矩阵

| 流程 | TriggerSys | TriggerEng | ChainSys | ChainEng | NotifSys | LogSys | OfflineSys | Handler | StorySys | EventEng | UI | ChainUISys |
|------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| P1   | ✅ | ✅ | — | — | ✅ | — | — | — | — | ✅ | ✅ | — |
| P2   | — | — | ✅ | ✅ | — | — | — | — | — | — | — | ✅ |
| P3   | ✅ | ✅ | — | — | ✅ | — | — | — | — | ✅ | ✅ | — |
| P4   | — | — | — | — | — | — | ✅ | ✅ | — | — | — | — |
| P5   | — | — | — | — | ✅ | ✅ | — | — | ✅ | — | — | ✅ |
