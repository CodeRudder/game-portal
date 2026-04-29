# Round 1: event + npc 模块盲区扫描

## 扫描结果
- event模块无覆盖文件: 9个（EventTriggerConditions、OfflineEventHandler、ReturnAlertHelpers、EventTriggerSystem.helpers、EventTriggerSerialization、EventTriggerLifecycle、EventProbabilityCalculator、EventConditionEvaluator、EventUINotification）
- npc模块无覆盖文件: 6个（PatrolPathCalculator、NPCDialogHelpers、NPCSpawnSystem、NPCSpawnManager、GiftPreferenceCalculator、NPCTrainingSystem）
- 新增测试文件: 14个
- 新增测试用例: 283个

## 覆盖的源文件

### event 模块（8/9 文件覆盖）

1. **EventTriggerConditions.ts** — 41 tests
   - `evaluateCondition`（5种条件类型 + 未知类型）
   - `evaluateTurnRangeCondition`（minTurn/maxTurn/turnInterval/组合/边界值）
   - `evaluateResourceCondition`（有/无 gameState、资源不存在、minAmount）
   - `evaluateAffinityCondition`（有/无 gameState、满足/不满足）
   - `evaluateBuildingCondition`（有/无 gameState、满足/不满足）
   - `evaluateEventCompletedCondition`（无 eventId、无 checker、已完成、未完成）
   - `compareValue`（6种运算符 + 默认 + 未知 + 无 value）

2. **ReturnAlertHelpers.ts** — 16 tests
   - `createReturnAlert`（正常创建、从0计数）
   - `createOfflineAlerts`（批量创建、空列表、指定起始计数器）
   - `filterUnreadAlerts`（过滤未读、全部已读、空数组）
   - `markAlertRead`（标记成功、不存在、空数组）
   - `markAllAlertsRead`（全部标记、空数组）
   - `clearReadAlerts`（清除已读、全部已读、全部未读）

3. **EventTriggerSerialization.ts** — 7 tests
   - `serializeEventTriggerState`（空状态、有数据状态）
   - `deserializeEventTriggerState`（空数据、完整数据、undefined 字段、往返一致性）

4. **EventTriggerLifecycle.ts** — 18 tests
   - `resolveEvent`（成功解决、状态变更、完成记录、移除、冷却设置、chainEventId、各种失败路径、事件发射）
   - `expireEvents`（过期移除、未过期保留、null expireTurn、混合、事件发射、无 deps）

5. **EventProbabilityCalculator.ts** — 9 tests
   - `calculateProbability`（基础、加法修正、乘法修正、混合、非活跃忽略、clamp、triggered 布尔值、边界值）

6. **EventConditionEvaluator.ts** — 17 tests
   - `evaluate`（turn_range、resource_threshold、affinity_level、building_level、event_completed、未知类型）
   - `evaluateAll`（空数组、undefined、全部满足、部分不满足）

7. **OfflineEventHandler.ts** — 19 tests
   - `tryAutoResolve`（低优先级自动处理、高优先级保留、无默认选项）
   - `simulateOfflineEvents`（正常生成、无事件、0回合、0概率、最大堆积、字段验证）
   - `processOfflinePile`（分离自动/手动、资源汇总）
   - `resolveOfflineEvent`（手动处理、不存在、已处理、选项不存在）
   - `getPileStats`（正确统计、空堆积）
   - `convertToNotifications`（转换通知、全部自动处理）

8. **EventTriggerSystem.helpers.ts** — 31 tests
   - `getActiveEvents`、`hasActiveEvent`、`getInstance`、`getActiveEventCount`、`isEventCompleted`、`getCompletedEventIds`
   - `getConfig`、`updateConfig`
   - `serializeState`/`deserializeState`（往返一致性）
   - `loadPredefinedEvents`
   - `createEventInstance`（正常、无过期、计数器递增）
   - `checkFixedConditions`（无条件、满足、不满足、event_completed）
   - `checkChainPrerequisites`（无前置、全部满足、部分不满足）
   - `triggerEventLogic`（成功触发、不存在、重复、条件不满足、强制触发、事件发射）

### npc 模块（6/6 文件全覆盖）

1. **PatrolPathCalculator.ts** — 11 tests
   - `updateSinglePatrol`（正常移动、到达路径点、端点折返暂停、反向折返、暂停倒计时恢复、暂停不移动、回调可选、一帧多路径点）
   - `updateAllPatrols`（多 NPC 更新、路径不存在跳过、空状态）

2. **NPCDialogHelpers.ts** — 4 tests
   - `NPCDialogDeps` 接口实现验证
   - `DialogSelectResult` 成功/失败结构验证（含全部5种失败原因类型）

3. **NPCSpawnSystem.ts** — 27 tests
   - 规则管理（注册、批量注册、移除、启用/禁用）
   - 刷新逻辑（禁用规则、达到上限、forceSpawn 成功/失败、无回调、回调返回 null、巡逻路径分配、间隔计时器）
   - 查询（活跃计数、NPC 计数、NPC 列表、规则 ID 查找）
   - update（游戏时间、倒计时、despawnAfter 超时消失）
   - 条件评估（turn 条件、event 条件）
   - 序列化（serialize/deserialize 往返、reset）

4. **NPCSpawnManager.ts** — 20 tests
   - 配置管理（默认配置、局部更新）
   - 模板管理（注册、批量注册、不存在、返回副本）
   - 刷新逻辑（依赖未设置、无模板、全局上限、区域上限、创建失败、成功刷新、记录、forceSpawn）
   - updateTimer（自动刷新计时、禁用不计时、间隔为0）
   - 序列化（export/import、空数据）
   - fullReset

5. **GiftPreferenceCalculator.ts** — 27 tests
   - `isPreferredItem`（偏好物品列表、偏好分类、非偏好、无配置、物品不存在）
   - `isDislikedItem`（不喜欢分类、非不喜欢、无配置）
   - `calculateAffinityDelta`（基础计算、稀有度倍率、偏好物品倍率、偏好分类倍率、不喜欢衰减、数量加成、连续赠送不同物品不衰减、连续赠送同一物品衰减、单次上限、非负）
   - `getRepeatGiftCount`（无历史、连续计数、中间中断）
   - `getReactionText`（低好感、偏好、不喜欢、普通）
   - `getRecommendedItems`（推荐排序、无配置）

6. **NPCTrainingSystem.ts** — 36 tests
   - 切磋系统（有效结果、冷却中禁止、冷却倒计时、无冷却、获取记录、全部记录、统计）
   - 结盟系统（成功结盟、好感度不足、重复结盟、获取数据、所有结盟、加成汇总、解除、不存在解除、结盟事件、解除事件）
   - 离线行为（计算离线、空 NPC、0 时长、获取摘要、清除摘要、资源回调）
   - 对话历史（记录、全部历史、限制数量、最近对话、计数、清除、自动裁剪）
   - 序列化（往返一致、空数据、reset）

## 发现的问题

### P3 轻微
1. **GiftPreferenceCalculator — 偏好分类判断**: `food` 是 `merchant` 的偏好分类之一（`preferredCategories: ['jewelry', 'food']`），这在直觉上可能不太合理（商人偏好食物），但属于游戏设计决策，非代码 bug。
2. **NPCTrainingSystem — 对话历史裁剪时机**: 裁剪只在单次 push 后检查 `> MAX_DIALOGUE_HISTORY`，如果批量添加不会触发中间裁剪，但当前代码只有逐条添加接口，所以无实际问题。
3. **OfflineEventHandler — 随机性**: `simulateOfflineEvents` 使用 `Math.random()`，测试中通过概率=1或=0来控制，但中间概率的测试结果不确定，已用条件断言处理。

## 评估指标

| 模块 | 未覆盖文件(前) | 新增测试文件 | 新增用例 | 覆盖文件(后) |
|------|---------------|-------------|---------|-------------|
| event | 9/16 (56%) | 8 | 158 | 1/16 未覆盖 (EventUINotification) |
| npc | 6/14 (43%) | 6 | 125 | 0/14 未覆盖 |

- event 模块 BSI: 44% → 94%（8/9 未覆盖文件已测试，仅 EventUINotification 未覆盖）
- npc 模块 BSI: 57% → 100%（全部 6 个未覆盖文件已测试）
