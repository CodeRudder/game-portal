# Quest 模块对抗式测试 — Round 1 测试分支树

> **角色**: TreeBuilder
> **模块**: quest（任务系统）
> **Round**: 1
> **日期**: 2026-05-16

---

## 一、模块概览

| 文件 | 行数 | 职责 |
|------|------|------|
| QuestSystem.ts | 454 | 主系统：任务注册/接受/进度/完成/奖励/日常/周常/追踪/序列化 |
| QuestSystem.helpers.ts | 480 | 辅助函数：日常刷新/追踪/查询/活跃度/进度批量更新/奖励领取/多样性抽取/周常刷新 |
| QuestTrackerSystem.ts | 227 | 追踪系统：事件监听/跳转映射 |
| ActivitySystem.ts | 254 | 活跃度系统：点数累积/里程碑宝箱/每日重置 |
| QuestActivityManager.ts | 110 | 活跃度管理器：点数增减/里程碑/重置 |
| QuestDailyManager.ts | 121 | 日常管理器：20选6/过期清理 |
| QuestSerialization.ts | 86 | 序列化/反序列化 |
| index.ts | 32 | 统一导出 |
| **合计** | **1764** | 8个文件 |

### 核心类型
- `QuestDef` — 任务定义模板
- `QuestInstance` — 运行时任务实例
- `QuestCategory` — main/side/daily/weekly/achievement
- `QuestStatus` — locked/available/active/completed/failed/expired
- `ActivityState` — 活跃度状态
- `ObjectiveType` — 10种目标类型

---

## 二、API 全量枚举

### 2.1 QuestSystem API（39个）

| # | API | 分类 | 优先级 |
|---|-----|------|--------|
| 1 | `init(deps)` | ISubsystem | P0 |
| 2 | `update(dt)` | ISubsystem | P2 |
| 3 | `getState()` | ISubsystem | P1 |
| 4 | `reset()` | ISubsystem | P0 |
| 5 | `setRewardCallback(cb)` | 回调注入 | P1 |
| 6 | `setActivityAddCallback(cb)` | 回调注入 | P1 |
| 7 | `getActivityState()` | 活跃度 | P1 |
| 8 | `addActivityPoints(points)` | 活跃度 | P1 |
| 9 | `claimActivityMilestone(index)` | 活跃度 | P1 |
| 10 | `resetDailyActivity()` | 活跃度 | P1 |
| 11 | `registerQuest(def)` | 注册 | P0 |
| 12 | `registerQuests(defs)` | 注册 | P1 |
| 13 | `getQuestDef(id)` | 查询 | P1 |
| 14 | `getAllQuestDefs()` | 查询 | P2 |
| 15 | `getQuestDefsByCategory(cat)` | 查询 | P1 |
| 16 | `acceptQuest(questId)` | 接受 | P0 |
| 17 | `updateObjectiveProgress(instId, objId, progress)` | 进度 | P0 |
| 18 | `updateProgressByType(type, count, params)` | 进度 | P0 |
| 19 | `completeQuest(instanceId)` | 完成 | P0 |
| 20 | `claimReward(instanceId)` | 奖励 | P0 |
| 21 | `claimAllRewards()` | 奖励 | P1 |
| 22 | `refreshDailyQuests()` | 日常 | P0 |
| 23 | `getDailyQuests()` | 日常 | P1 |
| 24 | `refreshWeeklyQuests()` | 周常 | P1 |
| 25 | `getWeeklyQuests()` | 周常 | P1 |
| 26 | `getTrackedQuests()` | 追踪 | P1 |
| 27 | `trackQuest(instanceId)` | 追踪 | P1 |
| 28 | `untrackQuest(instanceId)` | 追踪 | P1 |
| 29 | `getMaxTrackedQuests()` | 追踪 | P2 |
| 30 | `getActiveQuests()` | 查询 | P1 |
| 31 | `getActiveQuestsByCategory(cat)` | 查询 | P1 |
| 32 | `isQuestActive(questId)` | 查询 | P1 |
| 33 | `isQuestCompleted(questId)` | 查询 | P1 |
| 34 | `getQuestInstance(instanceId)` | 查询 | P1 |
| 35 | `getCompletedQuestIds()` | 查询 | P2 |
| 36 | `serialize()` | 序列化 | P0 |
| 37 | `deserialize(data)` | 序列化 | P0 |
| 38 | `initializeDefaults()` | 初始化 | P1 |
| 39 | `createInstance(def)` (private) | 内部 | P2 |

### 2.2 QuestTrackerSystem API（13个）

| # | API | 分类 | 优先级 |
|---|-----|------|--------|
| 1 | `init(deps)` | ISubsystem | P0 |
| 2 | `update(dt)` | ISubsystem | P2 |
| 3 | `getState()` | ISubsystem | P2 |
| 4 | `reset()` | ISubsystem | P0 |
| 5 | `bindQuestSystem(qs)` | 绑定 | P0 |
| 6 | `startTracking()` | 追踪 | P0 |
| 7 | `unsubscribe()` | 追踪 | P1 |
| 8 | `registerJumpTarget(target)` | 跳转 | P1 |
| 9 | `getJumpTarget(type)` | 跳转 | P1 |
| 10 | `getAllJumpTargets()` | 跳转 | P2 |
| 11 | `getQuestJumpRoute(def)` | 跳转 | P1 |
| 12 | `serialize()` | 序列化 | P2 |
| 13 | `deserialize(data)` | 序列化 | P2 |

### 2.3 ActivitySystem API（14个）

| # | API | 分类 | 优先级 |
|---|-----|------|--------|
| 1 | `init(deps)` | ISubsystem | P0 |
| 2 | `update(dt)` | ISubsystem | P2 |
| 3 | `getState()` | ISubsystem | P2 |
| 4 | `reset()` | ISubsystem | P0 |
| 5 | `setRewardCallback(cb)` | 回调 | P1 |
| 6 | `addPoints(points)` | 活跃度 | P0 |
| 7 | `getActivityState()` | 查询 | P1 |
| 8 | `getCurrentPoints()` | 查询 | P2 |
| 9 | `getMaxPoints()` | 查询 | P2 |
| 10 | `claimMilestone(index)` | 里程碑 | P0 |
| 11 | `claimAllMilestones()` | 里程碑 | P1 |
| 12 | `isMilestoneClaimable(index)` | 查询 | P1 |
| 13 | `getNextClaimableIndex()` | 查询 | P1 |
| 14 | `getProgressRatio()` | 查询 | P2 |
| 15 | `resetDaily()` | 重置 | P1 |
| 16 | `checkDailyReset(date)` | 重置 | P1 |
| 17 | `serialize()` | 序列化 | P0 |
| 18 | `deserialize(data)` | 序列化 | P0 |

### 2.4 QuestSerialization 函数（2个）

| # | API | 优先级 |
|---|-----|--------|
| 1 | `serializeQuestState(data)` | P0 |
| 2 | `deserializeQuestState(saveData, activeQuests, completedQuestIds)` | P0 |

### 2.5 QuestSystem.helpers 函数（14个）

| # | API | 优先级 |
|---|-----|--------|
| 1 | `refreshDailyQuestsLogic(deps)` | P0 |
| 2 | `refreshWeeklyQuestsLogic(deps)` | P1 |
| 3 | `getTrackedQuests(ids, quests)` | P1 |
| 4 | `trackQuest(id, ids, quests)` | P1 |
| 5 | `untrackQuest(id, ids)` | P1 |
| 6 | `getDailyQuests(ids, quests)` | P1 |
| 7 | `getActiveQuestsByCategory(cat, quests, defs)` | P1 |
| 8 | `getActivityState(state)` | P1 |
| 9 | `addActivityPoints(state, points)` | P1 |
| 10 | `claimActivityMilestone(state, index)` | P1 |
| 11 | `resetDailyActivity(state)` | P1 |
| 12 | `updateProgressByTypeLogic(type, count, quests, ctx, params)` | P0 |
| 13 | `claimRewardLogic(instanceId, ctx)` | P0 |
| 14 | `claimAllRewardsLogic(quests, claimFn)` | P1 |
| 15 | `pickDailyWithDiversity(templates, pickCount)` | P0 |

### 2.6 QuestActivityManager API（10个）

| # | API | 优先级 |
|---|-----|--------|
| 1 | `getState()` | P1 |
| 2 | `getCurrentPoints()` | P2 |
| 3 | `getMaxPoints()` | P2 |
| 4 | `getMilestones()` | P1 |
| 5 | `addPoints(points)` | P0 |
| 6 | `claimMilestone(index)` | P0 |
| 7 | `resetDaily()` | P1 |
| 8 | `fullReset()` | P1 |
| 9 | `restoreState(state)` | P1 |

### 2.7 QuestDailyManager API（7个）

| # | API | 优先级 |
|---|-----|--------|
| 1 | `setDeps(deps)` | P0 |
| 2 | `getInstanceIds()` | P2 |
| 3 | `getRefreshDate()` | P2 |
| 4 | `isRefreshedToday()` | P1 |
| 5 | `refresh()` | P0 |
| 6 | `fullReset()` | P1 |
| 7 | `restoreState(date, ids)` | P1 |

**API 总计: 108个**

---

## 三、测试分支树

### 维度 F-Normal: 主线流程（42节点）

```
N-01 [P0] QuestSystem 完整生命周期: init → registerQuest → acceptQuest → updateObjectiveProgress → completeQuest → claimReward
N-02 [P0] 日常任务刷新流程: refreshDailyQuests → getDailyQuests → updateProgress → complete → claimReward
N-03 [P0] 周常任务刷新流程: refreshWeeklyQuests → getWeeklyQuests → updateProgress → complete → claimReward
N-04 [P0] 活跃度累积流程: addActivityPoints → claimActivityMilestone → 获取奖励
N-05 [P0] 任务追踪流程: trackQuest → getTrackedQuests → untrackQuest
N-06 [P0] 前置任务链: quest-A 未完成时 quest-B 不可接受 → 完成 quest-A → quest-B 可接受
N-07 [P0] 批量进度更新: updateProgressByType 同时更新多个任务的匹配目标
N-08 [P0] 序列化往返: serialize → deserialize → 状态完全恢复
N-09 [P0] initializeDefaults: 自动接受主线 + 刷新日常
N-10 [P1] QuestTrackerSystem 事件驱动: startTracking → emit game event → updateProgressByType
N-11 [P1] QuestTrackerSystem 跳转映射: getQuestJumpRoute → 返回正确路由
N-12 [P1] ActivitySystem 完整流程: addPoints → claimMilestone → resetDaily
N-13 [P1] ActivitySystem checkDailyReset: 跨日自动重置
N-14 [P1] claimAllRewards: 多个已完成任务一键领取
N-15 [P1] claimAllMilestones: ActivitySystem 一键领取所有宝箱
N-16 [P1] registerQuests 批量注册
N-17 [P1] getQuestDefsByCategory 按类型查询定义
N-18 [P1] getActiveQuestsByCategory 按类型查询活跃任务
N-19 [P1] isQuestActive / isQuestCompleted 状态查询
N-20 [P1] QuestActivityManager restoreState 状态恢复
N-21 [P1] QuestDailyManager refresh 日常管理器刷新
N-22 [P1] QuestDailyManager isRefreshedToday 日期检查
N-23 [P1] pickDailyWithDiversity 多样性保证: D01必定出现 + 至少1战斗 + 至少1养成
N-24 [P1] 日常任务自动领取未领取奖励: refreshDailyQuests 时已完成未领取的自动领取
N-25 [P1] ActivitySystem 序列化往返
N-26 [P1] QuestTrackerSystem serialize/deserialize
N-27 [P1] ActivitySystem getProgressRatio 进度百分比
N-28 [P1] ActivitySystem getNextClaimableIndex 下一个可领取
N-29 [P1] ActivitySystem isMilestoneClaimable 可领取检查
N-30 [P1] 周常任务过期清理: refreshWeeklyQuests 时旧任务标记expired
N-31 [P1] 日常任务过期清理: refreshDailyQuests 时旧任务标记expired
N-32 [P1] createInstance 实例ID自增
N-33 [P1] setRewardCallback / setActivityAddCallback 回调触发
N-34 [P2] update(dt) 空操作
N-35 [P2] getAllQuestDefs 全量查询
N-36 [P2] getCompletedQuestIds 已完成列表
N-37 [P2] getMaxTrackedQuests 上限查询
N-38 [P2] QuestActivityManager fullReset
N-39 [P2] QuestDailyManager fullReset
N-40 [P2] QuestTrackerSystem getAllJumpTargets
N-41 [P2] QuestTrackerSystem reset 清理
N-42 [P2] QuestActivityManager getMilestones 返回副本
```

### 维度 F-Boundary: 边界条件（28节点）

```
B-01 [P0] acceptQuest: 重复接受同一任务 → 返回null
B-02 [P0] acceptQuest: 已完成的任务不可再接受 → 返回null
B-03 [P0] acceptQuest: 不存在的questId → 返回null
B-04 [P0] updateObjectiveProgress: progress超过targetCount → 钳制到targetCount
B-05 [P0] updateObjectiveProgress: progress为0 → 不变化
B-06 [P0] updateObjectiveProgress: progress为负数 → 钳制为0
B-07 [P0] completeQuest: 非active状态不可完成 → 返回false
B-08 [P0] claimReward: 非completed状态不可领取 → 返回null
B-09 [P0] claimReward: 已领取过不可再领 → 返回null
B-10 [P0] addActivityPoints: 超过maxPoints → 钳制到maxPoints
B-11 [P0] claimActivityMilestone: 活跃度不足 → 返回null
B-12 [P0] claimActivityMilestone: 已领取 → 返回null
B-13 [P0] claimActivityMilestone: 索引越界 → 返回null
B-14 [P0] trackQuest: 追踪列表已满(MAX_TRACKED_QUESTS=3) → 返回false
B-15 [P0] trackQuest: 重复追踪 → 返回false
B-16 [P0] trackQuest: 非active任务不可追踪 → 返回false
B-17 [P0] refreshDailyQuests: 当天已刷新 → 返回已有实例不重复刷新
B-18 [P0] pickDailyWithDiversity: 每类最多2个
B-19 [P0] pickDailyWithDiversity: 恰好6个
B-20 [P1] updateObjectiveProgress: 完成最后一个目标自动触发completeQuest
B-21 [P1] untrackQuest: 不存在的ID → 返回false
B-22 [P1] addActivityPoints: points为0 → 不变化
B-23 [P1] addActivityPoints: points为负数 → 钳制为0
B-24 [P1] ActivitySystem.claimMilestone: index为负数 → 返回null
B-25 [P1] ActivitySystem.addPoints: 超过maxPoints → 钳制
B-26 [P1] deserialize: 空数据/缺省字段 → 默认值
B-27 [P1] refreshWeeklyQuests: 当周已刷新 → 返回已有实例
B-28 [P1] updateProgressByType: params不匹配 → 跳过该目标
```

### 维度 F-Error: 异常路径（18节点）

```
E-01 [P0] acceptQuest: 前置任务部分完成（多个前置只完成部分）→ 返回null
E-02 [P0] updateObjectiveProgress: 不存在的instanceId → 返回null
E-03 [P0] updateObjectiveProgress: 不存在的objectiveId → 返回null
E-04 [P0] updateObjectiveProgress: 已completed的任务 → 返回null
E-05 [P0] claimReward: 不存在的instanceId → 返回null
E-06 [P0] completeQuest: 不存在的instanceId → 返回false
E-07 [P1] init时deps为null: 后续操作不crash
E-08 [P1] QuestTrackerSystem: 未bindQuestSystem时startTracking → 事件到达不crash
E-09 [P1] QuestDailyManager: 未setDeps时refresh → 返回空数组
E-10 [P1] deserialize: version不匹配 → 容错处理
E-11 [P1] deserialize: activeQuests为null → 容错
E-12 [P1] deserialize: completedQuestIds为null → 容错
E-13 [P1] QuestTrackerSystem.handleGameEvent: payload为null → 不crash
E-14 [P1] QuestTrackerSystem.extractParams: 非object payload → 返回undefined
E-15 [P1] claimAllRewards: 无已完成任务 → 返回空数组
E-16 [P1] ActivitySystem.checkDailyReset: 同一天不重置
E-17 [P1] QuestActivityManager.claimMilestone: 不存在的索引 → 返回null
E-18 [P1] getTrackedQuests: 追踪列表中包含已过期任务 → 过滤掉
```

### 维度 F-Cross: 跨系统交互（14节点）

```
C-01 [P0] 日常任务完成 → 活跃度增加 → 里程碑可领取
C-02 [P0] claimReward → rewardCallback触发 → activeQuests中删除
C-03 [P0] 日常刷新 → 旧日常自动领取未领取奖励 → emit autoClaimed
C-04 [P0] QuestTrackerSystem事件 → QuestSystem.updateProgressByType → 目标进度更新
C-05 [P1] QuestSystem.reset → 所有状态清空
C-06 [P1] serialize → deserialize → 日常/周常/活跃度完整恢复
C-07 [P1] claimReward → activityAddCallback触发
C-08 [P1] ActivitySystem.addPoints → emit activityChanged
C-09 [P1] ActivitySystem.claimMilestone → rewardCallback触发
C-10 [P1] ActivitySystem.resetDaily → emit activityReset
C-11 [P1] QuestTrackerSystem.startTracking → unsubscribe → 重新startTracking
C-12 [P1] 日常任务完成 → 从追踪列表移除 → getTrackedQuests不再包含
C-13 [P1] initializeDefaults → 自动追踪首个任务
C-14 [P1] 周常任务 → refreshWeeklyQuests → getWeeklyQuests联动
```

### 维度 F-Lifecycle: 数据生命周期（12节点）

```
L-01 [P0] 任务实例: 创建 → active → completed → rewardClaimed → 从activeQuests删除
L-02 [P0] 日常任务: 注册 → 接受 → 完成 → 刷新时过期删除 → 新一批
L-03 [P0] 活跃度: 每日重置 → 累积 → 领取宝箱 → 下次重置
L-04 [P0] 序列化: 内存状态 → serialize → deserialize → 内存状态一致
L-05 [P1] 追踪列表: 自动添加 → 手动添加 → 手动移除 → 任务完成自动移除
L-06 [P1] 周常任务: 刷新 → 完成 → 过期 → 新一批
L-07 [P1] QuestActivityManager: restoreState → 操作 → fullReset → 初始状态
L-08 [P1] QuestDailyManager: restoreState → refresh → fullReset
L-09 [P1] ActivitySystem: serialize → deserialize → 状态恢复
L-10 [P1] instanceCounter: reset后归零 → 新实例从1开始
L-11 [P1] completedQuestIds: 持久化 → 重置后清空
L-12 [P1] dailyRefreshDate: 刷新后记录 → 同一天跳过
```

---

## 四、统计概览

| 维度 | 节点数 | P0 | P1 | P2 |
|------|--------|----|----|-----|
| F-Normal | 42 | 9 | 24 | 9 |
| F-Boundary | 28 | 18 | 10 | 0 |
| F-Error | 18 | 6 | 12 | 0 |
| F-Cross | 14 | 4 | 10 | 0 |
| F-Lifecycle | 12 | 4 | 8 | 0 |
| **合计** | **114** | **41** | **64** | **9** |

| 指标 | 值 |
|------|-----|
| API总数 | 108 |
| 已枚举API | 108 |
| API覆盖率 | 100% |
| P0节点数 | 41 |
| 总节点数 | 114 |
| 维度数 | 5 |
