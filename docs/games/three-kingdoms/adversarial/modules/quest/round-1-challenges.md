# Quest 模块对抗式测试 — Round 1 挑战书

> **角色**: TreeChallenger
> **模块**: quest（任务系统）
> **Round**: 1
> **日期**: 2026-05-16

---

## 一、总体评估

Builder 的测试分支树枚举了 114 个节点，覆盖 108 个 API，API 覆盖率 100%。但经过 5 维度系统性质疑，发现以下遗漏和不足。

---

## 二、F-Normal 维度挑战（12项）

### N-C01 [P0] 多目标任务的完成判定
**问题**: `updateObjectiveProgress` 只更新单个目标，但 `checkQuestCompletion` 检查所有目标。树中缺少"多目标任务的逐个完成 → 最终全部完成触发 completeQuest"的完整流程节点。
**建议**: 添加节点验证3目标任务的逐个完成过程。

### N-C02 [P0] claimReward 后 activeQuests 中实例被删除
**问题**: `claimRewardLogic` 中 `ctx.activeQuests.delete(instanceId)` 在标记 `rewardClaimed` 后立即删除。但 `claimAllRewardsLogic` 遍历 `activeQuests` 时调用 `claimReward`，会修改正在遍历的 Map。
**建议**: 添加节点验证 claimAllRewards 在多任务场景下不遗漏。

### N-C03 [P0] pickDailyWithDiversity 洗牌随机性
**问题**: 多样性算法先保证类别再填充，但未验证"rest 长度不足以填充到 pickCount"的退化场景。
**建议**: 添加节点验证极端模板数量下的行为。

### N-C04 [P1] refreshDailyQuests 的 refreshHour 边界
**问题**: `refreshDailyQuestsLogic` 中根据 `config.refreshHour`（默认5）调整日期。如果当前时间正好是 5:00:00，`now.getHours() < 5` 为 false，应使用当天日期。但树中未覆盖此精确边界。
**建议**: 添加节点验证 refreshHour 边界时刻的行为。

### N-C05 [P1] refreshWeeklyQuests 的周一计算
**问题**: 周常任务使用 `getDay()` 计算周一偏移。周日时 `dayOfWeek=0`，偏移为 `-6`。树中未覆盖周日场景。
**建议**: 添加节点验证周日在 refreshHour 前后的行为。

### N-C06 [P1] getTrackedQuests 过滤已过期任务
**问题**: `getTrackedQuests` helper 过滤 `status === 'active'`，但追踪列表中可能包含已完成但未移除的实例（如并发场景）。树中 E-18 提到了但未在 Normal 维度验证正常完成后的自动移除时序。
**建议**: 明确验证 completeQuest → trackedQuestIds 自动移除的时序。

### N-C07 [P1] updateProgressByType 的 params 匹配逻辑
**问题**: `updateProgressByTypeLogic` 中 `params` 匹配使用 `Object.entries(params).every(...)`，如果 `objective.params` 为 undefined 而 params 有值，`objective.params!` 会报错吗？不会，因为 TypeScript 的 `!` 只是类型断言，运行时 `undefined` 上调用 `every` 会报错。
**建议**: 验证 objective 无 params 但传入 params 时的行为。

### N-C08 [P1] ActivitySystem.claimAllMilestones 顺序依赖
**问题**: `claimAllMilestones` 按索引顺序领取。如果 milestones 的 points 不是递增排列（如 [80, 40, 60]），低 points 的可能因高 points 的先被领取而跳过。但 DEFAULT_ACTIVITY_MILESTONES 是递增的，所以实际不会发生。
**建议**: 添加防御性测试验证非递增里程碑配置下的行为。

### N-C09 [P1] QuestSystem.deserialize 恢复 weeklyQuestInstanceIds
**问题**: `deserialize` 中 `this.weeklyQuestInstanceIds = data.weeklyQuestInstanceIds ?? []`，但恢复后这些 ID 对应的实例已通过 `deserializeQuestState` 恢复到 `activeQuests` 中了吗？如果 saveData 中 activeQuests 不包含这些周常实例，getWeeklyQuests 会返回空。
**建议**: 添加节点验证反序列化后周常任务的完整性。

### N-C10 [P1] QuestTrackerSystem.extractParams 的具体类型匹配
**问题**: `extractParams` 对 `collect_resource` 检查 `p.resource`，对 `build_upgrade` 检查 `p.buildingType`。但未覆盖其他 objectiveType 的 default 分支和 payload 包含其他字段时的行为。
**建议**: 添加节点验证各种 objectiveType 的参数提取。

### N-C11 [P2] QuestSystem.getState 返回的 completedQuestIds 是 Set
**问题**: `getState()` 返回 `completedQuestIds: new Set(this.completedQuestIds)`，这是一个新的 Set。但序列化时 `serialize` 使用 `Array.from(data.completedQuestIds)`。如果外部修改了 getState 返回的 Set，不影响内部状态。
**建议**: 验证 getState 返回值的隔离性。

### N-C12 [P1] reset 后 initializeDefaults 的行为
**问题**: `reset()` 清空所有状态但不重新加载预定义任务（不调用 `loadPredefinedQuests`）。reset 后调用 `initializeDefaults` 会因为 questDefs 为空而无法接受 quest-main-001。
**建议**: 验证 reset → init → initializeDefaults 的完整重初始化流程。

---

## 三、F-Boundary 维度挑战（8项）

### B-C01 [P0] addActivityPoints 大数值溢出
**问题**: `addActivityPoints` 使用 `Math.min(current + safePoints, maxPoints)`。如果 points 为 `Number.MAX_SAFE_INTEGER`，`current + safePoints` 可能溢出。
**建议**: 验证极端大数值下的行为。

### B-C02 [P0] updateObjectiveProgress 精确到 targetCount
**问题**: 进度增量为 targetCount + 10 时，`currentCount` 应精确钳制到 `targetCount`。树中 B-04 提到了但未区分"恰好到 targetCount"和"超过 targetCount"两种边界。
**建议**: 分别验证 progress 恰好等于 targetCount - currentCount 和超过的情况。

### B-C03 [P0] pickDailyWithDiversity 恰好 6 个（pickCount = 6）
**问题**: 算法先保证 D01 + 3个保证类别 = 4个，再从 rest 中选 2 个。如果 rest 中剩余全是同一类（超过2个限制），可能凑不够 6 个。
**建议**: 验证极端模板分布下的行为。

### B-C04 [P1] claimActivityMilestone 第一个和最后一个里程碑
**问题**: 里程碑为 [40, 60, 80, 100]。活跃度恰好为 40/60/80/100 时的精确触发。
**建议**: 验证每个阈值点的精确触发。

### B-C05 [P1] trackQuest 恰好在 MAX_TRACKED_QUESTS 边界
**问题**: 已追踪 2 个时添加第 3 个应成功，已追踪 3 个时添加第 4 个应失败。树中 B-14 只提到"已满"场景。
**建议**: 验证边界值 2→3（成功）和 3→4（失败）。

### B-C06 [P1] refreshDailyQuests 跨日刷新时间边界
**问题**: refreshHour=5，在 4:59 和 5:00 的日期判断不同。树中 N-C04 提到但未在 Boundary 维度单独列出。
**建议**: 精确验证 4:59（用昨天日期）和 5:00（用今天日期）。

### B-C07 [P1] QuestDailyManager.refresh 同一天多次调用
**问题**: `isRefreshedToday` 使用 `new Date().toISOString().slice(0, 10)`，而 `refreshDailyQuestsLogic` 使用带 refreshHour 调整的日期。两者日期计算不一致。
**建议**: 验证 QuestDailyManager 和 QuestSystem.helpers 的日期计算差异。

### B-C08 [P1] ActivitySystem.getProgressRatio maxPoints=0
**问题**: `getProgressRatio` 中 `if (maxPoints <= 0) return 0`，但构造函数硬编码 maxPoints=100。如果 deserialize 传入 maxPoints=0 呢？
**建议**: 验证异常存档数据下的行为。

---

## 四、F-Error 维度挑战（8项）

### E-C01 [P0] claimReward 并发安全
**问题**: `claimRewardLogic` 先标记 `rewardClaimed=true` 再 `activeQuests.delete`。如果 `claimAllRewards` 遍历中调用 `claimReward`，由于 `claimAllRewardsLogic` 先 filter 出 `status === 'completed' && !rewardClaimed` 的列表，然后再遍历调用，此时 `claimReward` 会 delete 实例。但遍历的是 filter 后的数组副本，所以不会遗漏。这是安全的。但树中未明确验证此安全性。
**建议**: 添加节点明确验证 claimAllRewards 的遍历安全性。

### E-C02 [P0] updateProgressByType 目标已完成时跳过
**问题**: `updateProgressByTypeLogic` 中 `if (objective.currentCount >= objective.targetCount) continue`。已完成的目标不应再更新。树中未覆盖此跳过逻辑。
**建议**: 验证已满目标不会被重复更新。

### E-C03 [P1] QuestTrackerSystem 多次 startTracking 不重复注册
**问题**: `startTracking` 先调用 `this.unsubscribe()` 再注册。多次调用应安全。但树中未覆盖。
**建议**: 验证多次 startTracking 的事件监听器不重复。

### E-C04 [P1] deserializeQuestState activityState 为 undefined
**问题**: `deserializeQuestState` 中 `saveData.activityState` 可能为 undefined，代码有 `?` 三元处理。但如果 `saveData` 本身为 null 呢？
**建议**: 验证 null/undefined saveData 的容错。

### E-C05 [P1] QuestSystem.acceptQuest 多个前置任务全部未完成
**问题**: `def.prerequisiteQuestIds?.some(...)` 使用 some，只要有一个未完成就拒绝。但树中 E-01 只提到"部分完成"，未覆盖"全部未完成"。
**建议**: 补充全部未完成的场景。

### E-C06 [P1] QuestTrackerSystem.handleGameEvent questSystem 为 null
**问题**: 如果 `bindQuestSystem` 未调用就触发了事件（`startTracking` 后 `questSystem` 仍为 null），`handleGameEvent` 中 `if (!this.questSystem) return` 会静默跳过。
**建议**: 验证未绑定时的静默处理。

### E-C07 [P1] QuestDailyManager.refresh deps 为 null
**问题**: `refresh()` 开头 `if (!this.deps) return []`。但树中 E-09 只在 Error 维度提到，未在 Normal 维度验证正常设置 deps 后的完整流程。
**建议**: 已在 N-21 覆盖，但需确保测试实际验证。

### E-C08 [P1] ActivitySystem.deserialize 异常数据
**问题**: `deserialize` 直接赋值 `this.state = { ...data.activityState }`，如果 `data.activityState.milestones` 不是数组，后续操作会 crash。
**建议**: 添加防御性测试。

---

## 五、F-Cross 维度挑战（6项）

### C-C01 [P0] 日常任务完整生命周期跨系统联动
**问题**: refreshDailyQuests → updateProgressByType → completeQuest → claimReward → addActivityPoints → claimActivityMilestone。这个完整链路未在树中作为单一节点出现。
**建议**: 添加端到端集成节点。

### C-C02 [P0] QuestTrackerSystem → QuestSystem → ActivitySystem 完整事件链
**问题**: EventBus 事件 → TrackerSystem 监听 → QuestSystem.updateProgressByType → 任务完成 → claimReward → ActivitySystem.addPoints。树中 C-04 只覆盖了 Tracker → QuestSystem 部分。
**建议**: 扩展为完整事件链。

### C-C03 [P1] serialize → reset → deserialize 状态恢复
**问题**: 先序列化当前状态，然后 reset 清空，再 deserialize 恢复。验证状态完全恢复。
**建议**: 添加节点。

### C-C04 [P1] 日常刷新时已完成任务的 rewardClaimed 标记
**问题**: refreshDailyQuestsLogic 中对已完成未领取的任务标记 `rewardClaimed=true` 并 emit `quest:autoClaimed`。但实际的奖励资源并未通过 rewardCallback 发放，只是标记了。
**建议**: 验证 autoClaimed 事件中是否包含奖励信息。

### C-C05 [P1] ActivitySystem 与 QuestSystem 活跃度的双轨管理
**问题**: QuestSystem 内部有 `activityState`，同时又有独立的 `ActivitySystem`。两者通过 `activityAddCallback` 同步。但 `QuestActivityManager` 也有独立的活跃度管理。三者的关系和同步机制未在树中明确。
**建议**: 添加节点验证三者的数据一致性。

### C-C06 [P1] QuestSystem.deserialize 恢复后的追踪列表
**问题**: `deserialize` 不恢复 `trackedQuestIds`。反序列化后追踪列表为空。
**建议**: 验证反序列化后追踪状态的处理。

---

## 六、F-Lifecycle 维度挑战（6项）

### L-C01 [P0] 任务实例从创建到删除的完整生命周期
**问题**: createInstance → active → objectives completed → completed → rewardClaimed → activeQuests.delete。这个完整生命周期中每一步的状态变化都应验证。
**建议**: 添加细粒度生命周期节点。

### L-C02 [P0] 日常任务池的周期性刷新
**问题**: Day1: refresh → 完成3个 → Day2: refresh（旧任务过期+自动领取+新任务）。这个跨日周期未完整覆盖。
**建议**: 添加跨日刷新生命周期节点。

### L-C03 [P1] 活跃度里程碑的 claimed 状态持久化
**问题**: 里程碑领取后 serialize → deserialize → claimed 状态应保持。
**建议**: 验证里程碑状态的持久化。

### L-C04 [P1] instanceCounter 的持久化
**问题**: `instanceCounter` 不参与序列化。deserialize 后 counter 不恢复，新创建的实例 ID 可能与反序列化的实例冲突。
**建议**: 验证反序列化后新建实例的 ID 唯一性。

### L-C05 [P1] QuestTrackerSystem 事件监听器的生命周期
**问题**: init → startTracking → reset → 事件监听器应被清理。重新 init → startTracking 应正常工作。
**建议**: 验证完整的监听器生命周期。

### L-C06 [P1] QuestDailyManager restoreState 后的 refresh 行为
**问题**: restoreState 恢复了旧的 dailyRefreshDate，然后 refresh 检查日期。如果恢复的是今天，refresh 应跳过。
**建议**: 验证 restoreState → refresh 的交互。

---

## 七、挑战汇总

| 维度 | 挑战数 | P0 | P1 | P2 |
|------|--------|----|----|-----|
| F-Normal | 12 | 2 | 8 | 2 |
| F-Boundary | 8 | 2 | 6 | 0 |
| F-Error | 8 | 2 | 6 | 0 |
| F-Cross | 6 | 2 | 4 | 0 |
| F-Lifecycle | 6 | 2 | 4 | 0 |
| **合计** | **40** | **10** | **28** | **2** |

---

## 八、关键风险项（Top 5）

1. **[严重] N-C02**: claimAllRewards 遍历中修改 Map — 实际安全但需验证
2. **[严重] L-C04**: instanceCounter 不持久化，反序列化后 ID 可能冲突
3. **[重要] N-C07**: objective.params 为 undefined 时传入 params 可能报错
4. **[重要] C-C05**: 三套活跃度管理的数据一致性
5. **[重要] C-C06**: deserialize 不恢复 trackedQuestIds
