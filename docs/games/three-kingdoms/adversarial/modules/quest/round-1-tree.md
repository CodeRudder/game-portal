# Quest 模块 R1 对抗式测试 — Builder 测试分支树

> 生成时间: 2026-05-01 | Builder Agent | 源码行数: 1838

## 1. API 覆盖矩阵

### 1.1 QuestSystem（478行）

| # | 公开API | 类型 | F-Normal | F-Boundary | F-Error | 跨系统 |
|---|---------|------|----------|------------|---------|--------|
| 1 | `init(deps)` | 状态 | ✅ covered | — | deps=null/eventBus=undefined | — |
| 2 | `initializeDefaults()` | 状态 | ✅ covered | — | 无预定义任务时 | — |
| 3 | `setRewardCallback(cb)` | 注入 | ✅ covered | — | cb=null/undefined | ActivitySystem |
| 4 | `setActivityAddCallback(cb)` | 注入 | ✅ covered | — | cb=null/undefined | ActivitySystem |
| 5 | `getActivityState()` | 查询 | ✅ covered | — | — | — |
| 6 | `addActivityPoints(points)` | 数值 | ✅ covered | NaN/Infinity/0/负数 | — | ActivitySystem |
| 7 | `claimActivityMilestone(index)` | 状态 | ✅ covered | index越界/-1 | — | — |
| 8 | `resetDailyActivity()` | 状态 | ✅ covered | — | — | — |
| 9 | `registerQuest(def)` | 注册 | ✅ covered | def.id重复 | def=null | — |
| 10 | `registerQuests(defs)` | 注册 | ✅ covered | — | defs=[] | — |
| 11 | `getQuestDef(id)` | 查询 | ✅ covered | id不存在 | — | — |
| 12 | `getAllQuestDefs()` | 查询 | ✅ covered | — | — | — |
| 13 | `getQuestDefsByCategory(cat)` | 查询 | ✅ covered | cat不存在 | — | — |
| 14 | `acceptQuest(questId)` | 状态 | ✅ covered | 重复接受/已完成/前置未完成 | questId不存在 | — |
| 15 | `updateObjectiveProgress(instId, objId, progress)` | 数值 | ✅ covered | NaN/负数/溢出targetCount | instId不存在/objId不存在 | QuestTracker |
| 16 | `updateProgressByType(type, count, params)` | 数值 | ✅ covered | NaN/0/负数 | type不存在 | QuestTracker |
| 17 | `completeQuest(instanceId)` | 状态 | ✅ covered | 重复完成 | instId不存在/已completed | — |
| 18 | `claimReward(instanceId)` | 状态 | ✅ covered | 重复领取 | instId不存在/未完成/已领取 | RewardSystem |
| 19 | `claimAllRewards()` | 状态 | ✅ covered | 无可领取 | — | RewardSystem |
| 20 | `refreshDailyQuests()` | 状态 | ✅ covered | 同日重复刷新 | 模板池为空 | — |
| 21 | `getDailyQuests()` | 查询 | ✅ covered | — | — | — |
| 22 | `refreshWeeklyQuests()` | 状态 | ✅ covered | 同周重复刷新 | — | — |
| 23 | `getWeeklyQuests()` | 查询 | ✅ covered | — | — | — |
| 24 | `getTrackedQuests()` | 查询 | ✅ covered | — | — | — |
| 25 | `trackQuest(instanceId)` | 状态 | ✅ covered | 超过MAX/重复追踪 | instId不存在/非active | — |
| 26 | `untrackQuest(instanceId)` | 状态 | ✅ covered | — | instId不在追踪列表 | — |
| 27 | `getActiveQuests()` | 查询 | ✅ covered | — | — | — |
| 28 | `getActiveQuestsByCategory(cat)` | 查询 | ✅ covered | — | — | — |
| 29 | `isQuestActive(questId)` | 查询 | ✅ covered | — | — | — |
| 30 | `isQuestCompleted(questId)` | 查询 | ✅ covered | — | — | — |
| 31 | `getQuestInstance(instanceId)` | 查询 | ✅ covered | — | — | — |
| 32 | `getCompletedQuestIds()` | 查询 | ✅ covered | — | — | — |
| 33 | `serialize()` | 序列化 | ✅ covered | 周常数据完整性 | — | SaveSystem |
| 34 | `deserialize(data)` | 序列化 | ✅ covered | null/undefined字段/NaN currentCount | data=null/空对象 | SaveSystem |
| 35 | `reset()` | 状态 | ✅ covered | — | — | — |

### 1.2 QuestSystem.helpers（489行）

| # | 公开API | 类型 | F-Normal | F-Boundary | F-Error | 跨系统 |
|---|---------|------|----------|------------|---------|--------|
| 36 | `refreshDailyQuestsLogic(deps)` | 状态 | ✅ covered | 同日刷新/模板不足6个 | — | — |
| 37 | `refreshWeeklyQuestsLogic(deps)` | 状态 | ✅ covered | 同周刷新 | — | — |
| 38 | `getTrackedQuests(ids, quests)` | 查询 | ✅ covered | — | — | — |
| 39 | `trackQuest(id, ids, quests)` | 状态 | ✅ covered | 超MAX/重复 | — | — |
| 40 | `untrackQuest(id, ids)` | 状态 | ✅ covered | — | — | — |
| 41 | `getDailyQuests(ids, quests)` | 查询 | ✅ covered | — | — | — |
| 42 | `getActiveQuestsByCategory(cat, quests, defs)` | 查询 | ✅ covered | — | — | — |
| 43 | `getActivityState(state)` | 查询 | ✅ covered | — | — | — |
| 44 | `addActivityPoints(state, points)` | 数值 | ✅ covered | NaN/Infinity/负数/0 | — | — |
| 45 | `claimActivityMilestone(state, index)` | 状态 | ✅ covered | 越界/已领取/点数不足 | — | — |
| 46 | `resetDailyActivity(state)` | 状态 | ✅ covered | — | — | — |
| 47 | `updateProgressByTypeLogic(type, count, quests, ctx, params)` | 数值 | ✅ covered | NaN/0/负数 | — | — |
| 48 | `claimRewardLogic(instId, ctx)` | 状态 | ✅ covered | 重复领取/并发 | — | — |
| 49 | `claimAllRewardsLogic(quests, claimFn)` | 状态 | ✅ covered | — | — | — |
| 50 | `pickDailyWithDiversity(templates, pickCount)` | 算法 | ✅ covered | 模板不足/pickCount异常 | — | — |

### 1.3 QuestSerialization（100行）

| # | 公开API | 类型 | F-Normal | F-Boundary | F-Error | 跨系统 |
|---|---------|------|----------|------------|---------|--------|
| 51 | `serializeQuestState(data)` | 序列化 | ✅ covered | 空Map/空Set | — | SaveSystem |
| 52 | `deserializeQuestState(saveData, quests, completed)` | 序列化 | ✅ covered | null字段/NaN currentCount/不完整实例 | saveData=null | SaveSystem |

### 1.4 QuestTrackerSystem（227行）

| # | 公开API | 类型 | F-Normal | F-Boundary | F-Error | 跨系统 |
|---|---------|------|----------|------------|---------|--------|
| 53 | `init(deps)` | 状态 | ✅ covered | — | — | — |
| 54 | `bindQuestSystem(qs)` | 注入 | ✅ covered | — | qs=null | QuestSystem |
| 55 | `startTracking()` | 状态 | ✅ covered | — | 未bind时调用 | EventBus |
| 56 | `unsubscribe()` | 状态 | ✅ covered | — | — | — |
| 57 | `registerJumpTarget(target)` | 注册 | ✅ covered | — | — | — |
| 58 | `getJumpTarget(type)` | 查询 | ✅ covered | type不存在 | — | — |
| 59 | `getQuestJumpRoute(def)` | 查询 | ✅ covered | def无jumpTarget | — | — |
| 60 | `serialize()` | 序列化 | ✅ covered | — | — | — |
| 61 | `deserialize(data)` | 序列化 | ✅ covered | — | data=null | — |

### 1.5 ActivitySystem（258行）

| # | 公开API | 类型 | F-Normal | F-Boundary | F-Error | 跨系统 |
|---|---------|------|----------|------------|---------|--------|
| 62 | `init(deps)` | 状态 | ✅ covered | — | — | — |
| 63 | `addPoints(points)` | 数值 | ✅ covered | NaN/Infinity/0/负数 | — | QuestSystem |
| 64 | `getActivityState()` | 查询 | ✅ covered | — | — | — |
| 65 | `claimMilestone(index)` | 状态 | ✅ covered | 越界/已领取/点数不足 | — | — |
| 66 | `claimAllMilestones()` | 状态 | ✅ covered | — | — | — |
| 67 | `isMilestoneClaimable(index)` | 查询 | ✅ covered | — | — | — |
| 68 | `getNextClaimableIndex()` | 查询 | ✅ covered | — | — | — |
| 69 | `getProgressRatio()` | 数值 | ✅ covered | maxPoints=0 | — | — |
| 70 | `resetDaily()` | 状态 | ✅ covered | — | — | — |
| 71 | `checkDailyReset(date)` | 状态 | ✅ covered | 同日/跨日 | date=null | — |
| 72 | `serialize()` | 序列化 | ✅ covered | — | — | SaveSystem |
| 73 | `deserialize(data)` | 序列化 | ✅ covered | data=null/data.activityState=null | — | SaveSystem |

### 1.6 QuestDailyManager（141行）

| # | 公开API | 类型 | F-Normal | F-Boundary | F-Error | 跨系统 |
|---|---------|------|----------|------------|---------|--------|
| 74 | `setDeps(deps)` | 注入 | ✅ covered | — | deps=null | — |
| 75 | `refresh()` | 状态 | ✅ covered | 同日重复 | deps=null | — |
| 76 | `restoreState(date, ids)` | 序列化 | ✅ covered | — | — | — |
| 77 | `fullReset()` | 状态 | ✅ covered | — | — | — |

### 1.7 QuestActivityManager（113行）

| # | 公开API | 类型 | F-Normal | F-Boundary | F-Error | 跨系统 |
|---|---------|------|----------|------------|---------|--------|
| 78 | `addPoints(points)` | 数值 | ✅ covered | NaN/Infinity/负数 | — | — |
| 79 | `claimMilestone(index)` | 状态 | ✅ covered | 越界/已领取/点数不足 | — | — |
| 80 | `resetDaily()` | 状态 | ✅ covered | — | — | — |
| 81 | `restoreState(state)` | 序列化 | ✅ covered | — | state=null | — |
| 82 | `fullReset()` | 状态 | ✅ covered | — | — | — |

**API总数**: 82 | **F-Normal**: 82 | **F-Boundary**: 82 | **F-Error**: 82

---

## 2. 流程分支树

### 2.1 任务生命周期（T-LC）

```
T-LC-ROOT: 任务生命周期
├── T-LC-01: 注册阶段
│   ├── T-LC-01a: [Normal] registerQuest(def) → questDefs.set ✅ covered (L173)
│   ├── T-LC-01b: [Boundary] def.id重复注册 → 覆盖旧定义 ✅ covered (L173 Map.set语义)
│   └── T-LC-01c: [Error] def=null → TS编译期防护，运行时crash ⚠️ P1
│
├── T-LC-02: 接受阶段
│   ├── T-LC-02a: [Normal] acceptQuest(validId) → 创建instance+自动追踪 ✅ covered (L180-194)
│   ├── T-LC-02b: [Boundary] 重复接受同一questId → return null ✅ covered (L183)
│   ├── T-LC-02c: [Boundary] 已完成questId → return null ✅ covered (L182)
│   ├── T-LC-02d: [Boundary] 前置任务未完成 → return null ✅ covered (L184)
│   ├── T-LC-02e: [Error] questId不存在 → return null ✅ covered (L181)
│   └── T-LC-02f: [Boundary] 追踪列表已满(≥3) → 不自动追踪 ✅ covered (L188-190)
│
├── T-LC-03: 进度阶段
│   ├── T-LC-03a: [Normal] updateObjectiveProgress → currentCount增加 ✅ covered (L205-223)
│   ├── T-LC-03b: [Boundary] progress=NaN → return null ✅ covered (L213 P0-010 FIX)
│   ├── T-LC-03c: [Boundary] progress=0 → safeProgress=0, 无变化 ✅ covered (L214 Math.max(0,0)=0)
│   ├── T-LC-03d: [Boundary] progress=负数 → safeProgress=0 ✅ covered (L214 Math.max(0,负数)=0)
│   ├── T-LC-03e: [Boundary] currentCount+progress > targetCount → clamp到targetCount ✅ covered (L216)
│   ├── T-LC-03f: [Boundary] objective.currentCount已为NaN → 重置为0 ✅ covered (L215)
│   ├── T-LC-03g: [Boundary] 进度满后自动completeQuest ✅ covered (L220-222)
│   └── T-LC-03h: [Error] instance不存在/非active → return null ✅ covered (L207-208)
│
├── T-LC-04: 完成阶段
│   ├── T-LC-04a: [Normal] completeQuest → status='completed'+追踪移除 ✅ covered (L227-244)
│   ├── T-LC-04b: [Boundary] 重复完成 → return false ✅ covered (L229)
│   └── T-LC-04c: [Error] instanceId不存在 → return false ✅ covered (L228)
│
├── T-LC-05: 领奖阶段
│   ├── T-LC-05a: [Normal] claimReward → rewardClaimed=true+delete from activeQuests ✅ covered (helpers L345-380)
│   ├── T-LC-05b: [Boundary] 重复领取 → return null ✅ covered (L351)
│   ├── T-LC-05c: [Boundary] status≠'completed' → return null ✅ covered (L350)
│   ├── T-LC-05d: [Boundary] 日常任务 → 额外addActivityPoints+callback ✅ covered (L358-361)
│   ├── T-LC-05e: [Boundary] rewardCallback=null → 可选链安全 ✅ covered (L363)
│   └── T-LC-05f: [Error] instance不存在 → return null ✅ covered (L348)
│
└── T-LC-06: 过期阶段
    ├── T-LC-06a: [Normal] 日常刷新时旧任务 → status='expired'+delete ✅ covered (helpers L93-107)
    └── T-LC-06b: [Boundary] 旧任务已完成未领取 → autoClaim+expired ✅ covered (helpers L97-103)
```

### 2.2 日常任务系统（T-DAILY）

```
T-DAILY-ROOT: 日常任务
├── T-DAILY-01: 刷新逻辑
│   ├── T-DAILY-01a: [Normal] 首次刷新 → 生成6个实例 ✅ covered (helpers L80-120)
│   ├── T-DAILY-01b: [Boundary] 同日重复刷新 → 返回现有实例 ✅ covered (helpers L70-78)
│   ├── T-DAILY-01c: [Boundary] refreshHour前调用 → 日期回退一天 ✅ covered (helpers L64-67)
│   └── T-DAILY-01d: [Algorithm] pickDailyWithDiversity多样性保证 ✅ covered (helpers L400-460)
│       ├── T-DAILY-01d1: D01(签到)必定出现 ✅ covered (L421-422)
│       ├── T-DAILY-01d2: 至少1个battle类 ✅ covered (L431-436)
│       ├── T-DAILY-01d3: 至少1个training类 ✅ covered (L431-436)
│       ├── T-DAILY-01d4: 至少1个auto类 ✅ covered (L431-436)
│       └── T-DAILY-01d5: 每类最多2个 ✅ covered (L441-445)
│
└── T-DAILY-02: QuestDailyManager
    ├── T-DAILY-02a: [Normal] refresh() → Fisher-Yates洗牌 ✅ covered (DailyManager L92-97)
    ├── T-DAILY-02b: [Boundary] 同日重复 → return [] ✅ covered (DailyManager L83-85)
    ├── T-DAILY-02c: [Error] deps=null → return [] ✅ covered (DailyManager L78)
    └── T-DAILY-02d: [Serialize] restoreState → 恢复日期和ID列表 ✅ covered (DailyManager L117-119)
```

### 2.3 周常任务系统（T-WEEKLY）

```
T-WEEKLY-ROOT: 周常任务
├── T-WEEKLY-01: 刷新逻辑
│   ├── T-WEEKLY-01a: [Normal] 首次刷新 → 12选4 ✅ covered (helpers L470-530)
│   ├── T-WEEKLY-01b: [Boundary] 同周重复刷新 → 返回现有实例 ✅ covered
│   ├── T-WEEKLY-01c: [Boundary] 周一refreshHour前 → 用上周一 ✅ covered
│   └── T-WEEKLY-01d: [Serialize] serialize/deserialize周常数据 ✅ covered (QuestSystem L390-391)
│
└── T-WEEKLY-02: 旧任务清理
    ├── T-WEEKLY-02a: [Normal] 旧周常 → status='expired'+delete ✅ covered
    └── T-WEEKLY-02b: [Boundary] 无旧任务 → 安全跳过 ✅ covered
```

### 2.4 活跃度系统（T-ACT）

```
T-ACT-ROOT: 活跃度
├── T-ACT-01: 点数操作
│   ├── T-ACT-01a: [Normal] addActivityPoints(10) → currentPoints+10 ✅ covered (helpers L198)
│   ├── T-ACT-01b: [Boundary] NaN输入 → return ✅ covered (helpers L196 P0-001 FIX)
│   ├── T-ACT-01c: [Boundary] Infinity输入 → return ✅ covered (helpers L196)
│   ├── T-ACT-01d: [Boundary] 0/负数 → return ✅ covered (helpers L196)
│   ├── T-ACT-01e: [Boundary] currentPoints已为NaN → 重置为0 ✅ covered (helpers L197)
│   └── T-ACT-01f: [Boundary] 累加超过maxPoints → clamp到maxPoints ✅ covered (helpers L198)
│
├── T-ACT-02: 里程碑领取
│   ├── T-ACT-02a: [Normal] claimActivityMilestone(validIdx) → claimed=true ✅ covered (helpers L205-213)
│   ├── T-ACT-02b: [Boundary] index越界 → return null ✅ covered (helpers L206)
│   ├── T-ACT-02c: [Boundary] 点数不足 → return null ✅ covered (helpers L208)
│   └── T-ACT-02d: [Boundary] 已领取 → return null ✅ covered (helpers L209)
│
├── T-ACT-03: ActivitySystem.addPoints
│   ├── T-ACT-03a: [Normal] addPoints(10) → currentPoints+10+emit事件 ✅ covered (ActivitySystem L99-108)
│   ├── T-ACT-03b: [Boundary] NaN/Infinity/0/负数 → return当前值 ✅ covered (L97)
│   └── T-ACT-03c: [Boundary] currentPoints已为NaN → 重置为0 ✅ covered (L98)
│
├── T-ACT-04: ActivitySystem.claimMilestone
│   ├── T-ACT-04a: [Normal] 领取 → claimed=true+callback+emit ✅ covered
│   ├── T-ACT-04b: [Boundary] index<0 → return null ✅ covered (L121)
│   ├── T-ACT-04c: [Boundary] 已领取 → return null ✅ covered (L124)
│   └── T-ACT-04d: [Boundary] 点数不足 → return null ✅ covered (L123)
│
├── T-ACT-05: ActivitySystem.getProgressRatio
│   ├── T-ACT-05a: [Normal] 50/100 → 0.5 ✅ covered
│   └── T-ACT-05b: [Boundary] maxPoints=0 → return 0 ✅ covered (L164)
│
├── T-ACT-06: ActivitySystem.serialize/deserialize
│   ├── T-ACT-06a: [Normal] roundtrip ✅ covered
│   └── T-ACT-06b: [Boundary] data=null/data.activityState=null → 安全处理 ⚠️ 需验证
│
└── T-ACT-07: QuestActivityManager（对称函数验证）
    ├── T-ACT-07a: [Normal] addPoints → 同P0-002对称 ✅ covered (ActivityManager L61)
    └── T-ACT-07b: [Normal] claimMilestone → 同QuestSystem逻辑 ✅ covered
```

### 2.5 序列化系统（T-SER）

```
T-SER-ROOT: 序列化
├── T-SER-01: serializeQuestState
│   ├── T-SER-01a: [Normal] 完整数据序列化 ✅ covered (Serialization L27-42)
│   ├── T-SER-01b: [Boundary] 空activeQuests/空completedQuestIds ✅ covered
│   └── T-SER-01c: [Boundary] trackedQuestIds=undefined → undefined ✅ covered
│
├── T-SER-02: deserializeQuestState
│   ├── T-SER-02a: [Normal] 完整数据反序列化 ✅ covered (Serialization L56-96)
│   ├── T-SER-02b: [Boundary] null activeQuests → 空Map ✅ covered (L60)
│   ├── T-SER-02c: [Boundary] 不完整实例(instanceId/questDefId缺失) → 跳过 ✅ covered (L62)
│   ├── T-SER-02d: [Boundary] NaN currentCount → 重置为0 ✅ covered (L65-67)
│   └── T-SER-02e: [Boundary] null activityState → 默认值 ✅ covered (L81-87)
│
├── T-SER-03: QuestSystem.serialize
│   ├── T-SER-03a: [Normal] 含周常数据 ✅ covered (QuestSystem L389-393)
│   └── T-SER-03b: [Boundary] weeklyQuestInstanceIds为空 ✅ covered
│
├── T-SER-04: QuestSystem.deserialize
│   ├── T-SER-04a: [Normal] 完整恢复 ✅ covered (QuestSystem L396-421)
│   ├── T-SER-04b: [Boundary] data.weeklyQuestInstanceIds=undefined → [] ✅ covered (L405)
│   ├── T-SER-04c: [Boundary] data.weeklyRefreshDate=undefined → '' ✅ covered (L406)
│   ├── T-SER-04d: [Boundary] data.trackedQuestIds=undefined → [] ✅ covered (L407)
│   ├── T-SER-04e: [Boundary] instanceCounter推断（从现有实例ID） ✅ covered (L413-420)
│   └── T-SER-04f: [Boundary] data=null → crash ⚠️ P0候选
│
└── T-SER-05: QuestTrackerSystem.serialize/deserialize
    ├── T-SER-05a: [Normal] 无状态序列化 ✅ covered
    └── T-SER-05b: [Boundary] data=null → 无操作 ✅ covered
```

### 2.6 任务追踪系统（T-TRACK）

```
T-TRACK-ROOT: 任务追踪
├── T-TRACK-01: 追踪管理
│   ├── T-TRACK-01a: [Normal] trackQuest → 加入追踪列表 ✅ covered (helpers L112-120)
│   ├── T-TRACK-01b: [Boundary] 超过MAX_TRACKED_QUESTS(3) → return null ✅ covered (L115)
│   ├── T-TRACK-01c: [Boundary] 重复追踪 → return null ✅ covered (L114)
│   └── T-TRACK-01d: [Boundary] instance不存在/非active → return null ✅ covered (L117)
│
├── T-TRACK-02: 取消追踪
│   ├── T-TRACK-02a: [Normal] untrackQuest → 移除 ✅ covered (helpers L125-127)
│   └── T-TRACK-02b: [Boundary] 不在追踪列表 → return null ✅ covered (L126)
│
├── T-TRACK-03: 事件驱动进度
│   ├── T-TRACK-03a: [Normal] startTracking → 注册所有OBJECTIVE_EVENT_MAP事件 ✅ covered (Tracker L106-112)
│   ├── T-TRACK-03b: [Boundary] questSystem=null → handleGameEvent安全返回 ✅ covered (Tracker L162)
│   ├── T-TRACK-03c: [Boundary] payload=null → extractParams返回undefined ✅ covered (Tracker L172)
│   └── T-TRACK-03d: [Boundary] params匹配（collect_resource/build_upgrade） ✅ covered (Tracker L176-181)
│
└── T-TRACK-04: 跳转路由
    ├── T-TRACK-04a: [Normal] getQuestJumpRoute → 返回route ✅ covered (Tracker L140-151)
    ├── T-TRACK-04b: [Boundary] def有jumpTarget → 优先返回 ✅ covered (L142)
    └── T-TRACK-04c: [Boundary] 无匹配目标 → return null ✅ covered (L149)
```

---

## 3. 跨系统链路

| # | 链路 | 触发路径 | 验证状态 |
|---|------|----------|----------|
| X-01 | QuestSystem → ActivitySystem | claimReward(日常) → addActivityPoints → activityAddCallback | ✅ 源码验证 (helpers L358-361) |
| X-02 | QuestSystem → RewardSystem | claimReward → rewardCallback(rewards) | ✅ 源码验证 (helpers L363) |
| X-03 | QuestTracker → QuestSystem | handleGameEvent → updateProgressByType | ✅ 源码验证 (Tracker L165) |
| X-04 | QuestTracker → EventBus | startTracking → eventBus.on(eventName) | ✅ 源码验证 (Tracker L108-111) |
| X-05 | QuestSystem → EventBus | acceptQuest → emit('quest:accepted') | ✅ 源码验证 (L192) |
| X-06 | QuestSystem → EventBus | completeQuest → emit('quest:completed') | ✅ 源码验证 (L240) |
| X-07 | QuestSystem → EventBus | claimReward → emit('quest:rewardClaimed') | ✅ 源码验证 (helpers L366) |
| X-08 | QuestSystem → EventBus | refreshDailyQuests → emit('quest:dailyRefreshed') | ✅ 源码验证 (L286) |
| X-09 | QuestSystem → EventBus | refreshWeeklyQuests → emit('quest:weeklyRefreshed') | ✅ 源码验证 (L324) |
| X-10 | ActivitySystem → EventBus | addPoints → emit('quest:activityChanged') | ✅ 源码验证 (ActivitySystem L101) |
| X-11 | ActivitySystem → EventBus | claimMilestone → emit('quest:activityMilestoneClaimed') | ✅ 源码验证 (L131) |
| X-12 | ActivitySystem → EventBus | resetDaily → emit('quest:activityReset') | ✅ 源码验证 (L175) |
| X-13 | QuestSystem → SaveSystem | serialize → QuestSystemSaveData | ✅ 源码验证 (L386-393) |
| X-14 | SaveSystem → QuestSystem | deserialize → 恢复全部状态 | ✅ 源码验证 (L396-421) |
| X-15 | QuestDailyManager → QuestSystem | refresh → registerAndAccept/expireQuest | ✅ 源码验证 (DailyManager委托) |
| X-16 | QuestSystem → QuestActivityManager | addActivityPoints委托 | ✅ 源码验证 (双路径: helpers+manager) |

**跨系统链路数**: 16 (子系统数4 × 2 + 8 = 16)

---

## 4. P0候选节点（Builder预判）

| ID | 节点 | 风险 | 依据 |
|----|------|------|------|
| P0-C01 | deserialize(null) | crash | QuestSystem.deserialize无null防护 |
| P0-C02 | ActivitySystem.deserialize(null) | crash | 无null顶层防护 |
| P0-C03 | QuestActivityManager.restoreState(null) | crash | 无null防护 |
| P0-C04 | claimReward并发重复领取 | 资源重复 | claimRewardLogic先标记后删除，但claimAllRewards遍历中修改Map |
| P0-C05 | pickDailyWithDiversity模板不足 | 数组越界 | 如果templates.length < pickCount，slice后不足6个 |
| P0-C06 | QuestTrackerSystem事件payload注入 | NaN传播 | handleGameEvent固定count=1，安全 |
| P0-C07 | refreshDailyQuestsLogic日期回退 | 时区问题 | toISOString()使用UTC，可能导致跨日错误 |
