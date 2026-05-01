# Quest 模块 R1 对抗式测试 — Challenger 挑战报告

> 生成时间: 2026-05-01 | Challenger Agent | 审查源码: 1838行

## 1. P0 缺陷（必须修复）

### P0-Q01: QuestSystem.deserialize(null) 崩溃
- **文件**: `QuestSystem.ts` L396
- **问题**: `deserialize(data: QuestSystemSaveData)` 无null/undefined顶层防护。若`data=null`，访问`data.activeQuests`直接抛出TypeError。
- **影响**: 存档损坏时游戏无法启动。
- **复现**: `questSystem.deserialize(null as any)`
- **严重度**: P0 — 运行时崩溃
- **修复建议**: 增加null guard，null时执行reset()

### P0-Q02: ActivitySystem.deserialize(null) 崩溃
- **文件**: `ActivitySystem.ts` L216-221
- **问题**: `deserialize(data: ActivitySaveData)` 访问`data.activityState`前未检查data是否为null。
- **复现**: `activitySystem.deserialize(null as any)`
- **严重度**: P0 — 运行时崩溃
- **修复建议**: 增加null guard

### P0-Q03: QuestActivityManager.restoreState(null) 崩溃
- **文件**: `QuestActivityManager.ts` L99-105
- **问题**: `restoreState(state: ActivityState)` 直接访问`state.currentPoints`等属性，无null防护。
- **复现**: `manager.restoreState(null as any)`
- **严重度**: P0 — 运行时崩溃
- **修复建议**: 增加null guard，null时执行fullReset()

### P0-Q04: claimAllRewardsLogic 遍历中修改Map导致跳过
- **文件**: `QuestSystem.helpers.ts` L385-395
- **问题**: `claimAllRewardsLogic`先收集completed实例列表，然后遍历调用`claimReward`。`claimRewardLogic`内部执行`ctx.activeQuests.delete(instanceId)`。虽然先收集了列表再遍历（非直接遍历Map），但`claimReward`内部会检查`instance.status !== 'completed'`——而`claimRewardLogic`在L356将status改为已领取后delete，**不会影响已收集的列表**。
- **实际分析**: 代码先用`Array.from`快照，然后遍历快照。`claimReward`内部delete不会影响快照。但`claimReward`先设`rewardClaimed=true`再delete，如果`claimAllRewards`的filter条件是`status === 'completed' && !rewardClaimed`，而`claimReward`先设`rewardClaimed=true`——这个时序是安全的，因为快照已固定。
- **修正**: 经仔细审查，这不是P0。降级为P2（代码可读性问题，建议加注释说明安全机制）。

### P0-Q05: refreshWeeklyQuestsLogic 旧任务未autoClaim奖励
- **文件**: `QuestSystem.helpers.ts` L497-502（refreshWeeklyQuestsLogic）
- **问题**: 周常任务刷新时，旧任务直接`instance.status = 'expired'`并delete，**没有像日常任务那样检查已完成未领取的奖励并autoClaim**。这导致周常任务完成但未领奖的情况下，奖励永久丢失。
- **对比**: `refreshDailyQuestsLogic`在L97-103有autoClaim逻辑，但`refreshWeeklyQuestsLogic`完全缺失。
- **严重度**: P0 — 奖励丢失
- **修复建议**: 周常刷新时增加与日常相同的autoClaim逻辑

### P0-Q06: QuestSystem.deserialize 活跃度NaN注入
- **文件**: `QuestSerialization.ts` L76-80
- **问题**: `deserializeQuestState`恢复activityState时，直接使用`saveData.activityState.currentPoints`，没有NaN防护。如果存档中`currentPoints`为NaN，后续`addActivityPoints`虽有NaN防御，但`claimActivityMilestone`的`state.currentPoints < milestone.points`比较中，NaN < number = false，**导致永远无法领取里程碑**。
- **严重度**: P0 — NaN传播导致功能锁定
- **修复建议**: deserialize时对currentPoints做`Number.isFinite`检查

### P0-Q07: ActivitySystem.deserialize 活跃度NaN注入
- **文件**: `ActivitySystem.ts` L216-221
- **问题**: 与P0-Q06对称。`deserialize`直接赋值`this.state.currentPoints = data.activityState.currentPoints`，无NaN防护。
- **严重度**: P0 — NaN传播
- **修复建议**: 同P0-Q06

### P0-Q08: QuestActivityManager.restoreState NaN注入
- **文件**: `QuestActivityManager.ts` L99-105
- **问题**: `restoreState`直接赋值`state.currentPoints`，无NaN防护。与P0-Q06/Q07对称（BR规则20：对称函数修复验证）。
- **严重度**: P0 — NaN传播
- **修复建议**: restoreState时对currentPoints做NaN检查

---

## 2. P1 缺陷（建议修复）

### P1-Q01: registerQuest(null) 运行时崩溃
- **文件**: `QuestSystem.ts` L173
- **问题**: `registerQuest(def: QuestDef)` 无null防护。`def.id`在null时crash。
- **严重度**: P1 — 调用方应保证参数，但防御性编程建议加guard

### P1-Q02: registerQuests 中 defs 元素可能为null
- **文件**: `QuestSystem.ts` L176
- **问题**: `registerQuests(defs)` 遍历调用registerQuest，如果defs中含null元素会crash。
- **严重度**: P1

### P1-Q03: getProgressRatio NaN风险
- **文件**: `ActivitySystem.ts` L164-166
- **问题**: `getProgressRatio()` 中 `if (this.state.maxPoints <= 0) return 0` 能防护maxPoints=0，但如果currentPoints为NaN（通过deserialize注入），返回NaN。
- **严重度**: P1 — 需配合P0-Q07修复

### P1-Q04: QuestDailyManager.computeTodayString 时区问题
- **文件**: `QuestDailyManager.ts` L127-133
- **问题**: `toISOString().slice(0, 10)` 返回UTC日期。如果用户在UTC+8的凌晨4点（本地日期为1月2日），但UTC时间为1月1日20:00，则日期计算使用UTC的1月1日。refreshHour=5在本地时间判断（getHours()返回本地时间），但最终日期用UTC格式化，可能导致跨日不一致。
- **对比**: `refreshDailyQuestsLogic`在helpers L64-67使用同样的模式，存在相同问题。
- **严重度**: P1 — 边界条件下日期不一致

### P1-Q05: pickDailyWithDiversity 模板不足时行为
- **文件**: `QuestSystem.helpers.ts` L413-445
- **问题**: 如果`templates.length < pickCount`（如模板池被修改），函数返回不足6个任务，但不会报错。这是静默降级。
- **严重度**: P1 — 配置错误时静默失败

---

## 3. Builder 覆盖率挑战

### CH-01: claimReward 并发安全性覆盖不足
- Builder标注T-LC-05a为covered，但未验证`claimAllRewards`遍历中`claimReward`修改Map的安全性。
- **结论**: 经审查，代码安全（先快照再遍历），但建议增加测试用例验证。

### CH-02: 周常任务serialize/deserialize覆盖
- Builder标注T-SER-03a为covered，但P0-Q05发现周常刷新缺少autoClaim，说明周常路径测试不够深入。
- **结论**: 同意P0-Q05。

### CH-03: 活跃度三系统一致性
- QuestSystem.addActivityPoints、ActivitySystem.addPoints、QuestActivityManager.addPoints三个入口。
- Builder标注全部covered，但P0-Q06/Q07/Q08发现deserialize路径的NaN防护缺失。
- **结论**: 三个系统都需要修复deserialize/restoreState路径。

### CH-04: 跨系统链路 X-01 验证深度
- Builder标注X-01为covered，但未验证当activityAddCallback抛异常时，claimReward是否继续执行（会中断）。
- **严重度**: P2 — 异常传播问题

---

## 4. 挑战总结

| 等级 | 数量 | ID列表 |
|------|------|--------|
| P0 | 7 | Q01, Q02, Q03, Q05, Q06, Q07, Q08 |
| P1 | 5 | P1-Q01~Q05 |
| P2 | 2 | P0-Q04(降级), CH-04 |

**关键发现**: 
1. deserialize/restoreState路径的null防护和NaN防护是系统性问题，影响4个类
2. 周常任务刷新缺少autoClaim是功能缺陷（对比日常有，周常无）
3. 对称函数验证规则（BR-20）在活跃度三系统中暴露了遗漏
