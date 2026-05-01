# Quest 模块对抗式测试 — Round 1 仲裁裁决

> **角色**: Arbiter
> **模块**: quest（任务系统）
> **Round**: 1
> **日期**: 2026-05-16

---

## 一、Builder 评估

### 优点
- API 枚举完整，108 个 API 100% 覆盖
- 5 维度分支树共 114 个节点，结构清晰
- P0/P1/P2 优先级分配基本合理
- 已有 901 行对抗式测试（QuestSystem.adversarial.test.ts），覆盖 24+ 场景

### 不足
- 未发现源码中的实际 P0 bug（仅枚举了应测场景）
- 序列化完整性未深入验证（trackedQuestIds、instanceCounter 缺失）
- NaN 防护缺失未标注为 P0

**Builder 评分**: 7.0/10

---

## 二、Challenger 评估

### 优点
- 40 项挑战，覆盖 5 维度
- 发现了关键架构缺陷：trackedQuestIds 不持久化（C-C06）、instanceCounter 不持久化（L-C04）
- 准确识别了 claimAllRewards 遍历安全性问题（N-C02）
- 发现了三套活跃度管理的一致性风险（C-C05）

### 不足
- 未直接审计源码发现实际 NaN 漏洞（模式 9/21）
- 未发现 ActivitySystem.addPoints 和 QuestActivityManager.addPoints 缺少 NaN/负值防护
- 未发现 updateProgressByTypeLogic 的 count 参数无 NaN 防护
- 未发现 updateObjectiveProgress 的 `Math.max(0, progress)` 可被 NaN 绕过（NaN > 0 = false, Math.max(0, NaN) = 0 是安全的，但 Math.min(currentCount + 0, targetCount) 不会传播 NaN — 此处实际安全）

**Challenger 评分**: 7.5/10

---

## 三、Arbiter 独立审计 — 源码 P0 发现

经过逐行源码审计，基于 24 个 P0 模式库，发现以下实际 P0 缺陷：

### P0-001: addActivityPoints NaN 绕过（模式 9/21）
- **文件**: QuestSystem.helpers.ts:181-182
- **代码**: `const safePoints = Math.max(0, points); state.currentPoints = Math.min(state.currentPoints + safePoints, state.maxPoints);`
- **问题**: `points = NaN` 时，`Math.max(0, NaN) = 0`（安全），但 `state.currentPoints` 如果已经是 NaN（通过 deserialize 注入），则 `NaN + 0 = NaN`，`Math.min(NaN, 100) = NaN`
- **严重性**: P0 — NaN 活跃度可导致里程碑判断失效
- **模式**: #9 NaN 绕过 + #21 资源比较 NaN 防护

### P0-002: ActivitySystem.addPoints NaN/负值无防护
- **文件**: ActivitySystem.ts:96-97
- **代码**: `this.state.currentPoints = Math.min(this.state.currentPoints + points, this.state.maxPoints);`
- **问题**: `points = NaN` → `currentPoints + NaN = NaN` → `Math.min(NaN, 100) = NaN`；`points = -50` → `currentPoints + (-50)` 可能为负
- **严重性**: P0 — NaN 活跃度导致系统不可用
- **模式**: #9 NaN 绕过

### P0-003: QuestActivityManager.addPoints NaN/负值无防护
- **文件**: QuestActivityManager.ts:65-66
- **代码**: 同 P0-002，无任何防护
- **问题**: 完全相同的 NaN/负值漏洞
- **严重性**: P0
- **模式**: #9 NaN 绕过（对称函数遗漏 — P0-002 的对称函数）

### P0-004: updateProgressByTypeLogic count 参数无 NaN 防护
- **文件**: QuestSystem.helpers.ts:239
- **代码**: `objective.currentCount = Math.min(objective.currentCount + count, objective.targetCount);`
- **问题**: `count = NaN` → `currentCount + NaN = NaN` → `Math.min(NaN, target) = NaN`，后续 `currentCount >= targetCount` 比较永远 false，任务永远无法完成
- **严重性**: P0 — NaN 进度导致任务卡死
- **模式**: #9 NaN 绕过

### P0-005: serialize 不保存 trackedQuestIds
- **文件**: QuestSystem.ts:413-420, QuestSerialization.ts:26-39
- **问题**: `serialize()` 不包含 `trackedQuestIds`，`deserialize()` 不恢复。玩家追踪的任务列表在存档/读档后丢失
- **严重性**: P0 — 数据丢失（模式 #7/#15）
- **模式**: #7 数据丢失 + #15 保存/加载流程缺失

### P0-006: serialize 不保存 instanceCounter
- **文件**: QuestSystem.ts:447-453
- **问题**: `instanceCounter` 不参与序列化。反序列化后 counter=0，新创建的实例 ID `quest-inst-1` 可能与已反序列化的实例冲突
- **严重性**: P0 — ID 冲突导致 Map 覆盖
- **模式**: #7 数据丢失

### P0-007: serialize 不保存 weeklyQuestInstanceIds/weeklyRefreshDate 完整性
- **文件**: QuestSerialization.ts:26-39
- **问题**: `serializeQuestState` 不包含 `weeklyQuestInstanceIds` 和 `weeklyRefreshDate`。虽然 `QuestSystem.serialize()` 通过 `QuestSystemSaveData` 类型有这些字段（optional），但 `serializeQuestState` 函数不写入它们
- **严重性**: P0 — 周常任务数据丢失
- **模式**: #7 数据丢失

### P0-008: QuestDailyManager.refresh 使用不安全洗牌
- **文件**: QuestDailyManager.ts:88
- **代码**: `const shuffled = [...DAILY_QUEST_TEMPLATES].sort(() => Math.random() - 0.5);`
- **问题**: `sort + Math.random()` 不是均匀分布的洗牌算法（V8 的 TimSort 有 O(n) 不变式破坏风险），且不保证多样性
- **严重性**: P1 — 功能性问题但影响日常任务分布公平性
- **模式**: #11 算法正确性

### P0-009: deserializeQuestState 不验证 activeQuests 中的实例完整性
- **文件**: QuestSerialization.ts:51-53
- **代码**: `for (const inst of saveData.activeQuests ?? []) { activeQuests.set(inst.instanceId, inst); }`
- **问题**: 恶意/损坏存档可注入 `status: undefined`、`objectives: null` 等异常数据，后续操作 crash
- **严重性**: P1 — 防御性不足
- **模式**: #1 null/undefined 防护缺失

### P0-010: updateObjectiveProgress 中 safeProgress 的 Math.max(0, NaN) = 0 是安全的，但 currentCount 本身可能是 NaN
- **文件**: QuestSystem.ts:206
- **问题**: 如果通过 deserialize 注入了 `currentCount: NaN` 的目标，`NaN + 0 = NaN`，`Math.min(NaN, target) = NaN`
- **严重性**: P1 — 需要 deserialize 验证配合
- **模式**: #9 NaN 绕过（依赖注入路径）

---

## 四、裁决结果

### 挑战裁定

| 挑战ID | 裁定 | 理由 |
|--------|------|------|
| N-C01 | ✅ 接受 | 多目标完成流程确实缺失，补充为 P1 节点 |
| N-C02 | ✅ 已安全 | claimAllRewardsLogic 先 filter 再遍历，安全。但需测试验证 |
| N-C03 | ✅ 接受 | 退化场景需覆盖，P1 |
| N-C04 | ✅ 接受 | refreshHour 边界需精确测试 |
| N-C05 | ✅ 接受 | 周日场景需覆盖 |
| N-C06 | ✅ 接受 | 追踪移除时序需验证 |
| N-C07 | ✅ 接受 → P0 | `objective.params` 为 undefined 时传入 params，`params && objective.params` 短路求值，实际安全（undefined 为 falsy）。但代码可读性差，应加注释 |
| N-C08 | ⚠️ 降级 P2 | DEFAULT_ACTIVITY_MILESTONES 是硬编码递增的，非运行时风险 |
| N-C09 | ✅ 接受 → P0 | 与 P0-007 相关，周常反序列化完整性 |
| N-C10 | ✅ 接受 P1 | 参数提取覆盖 |
| N-C11 | ✅ 接受 P2 | 隔离性验证 |
| N-C12 | ✅ 接受 → P0 | reset 不重新加载 questDefs，需要 init 才能恢复。与 P0-005/006 一起修复 |
| B-C01 | ✅ 接受 → P0 | 与 P0-002 相关 |
| B-C02 | ✅ 接受 P1 | 精确边界 |
| B-C03 | ✅ 接受 P1 | 退化场景 |
| B-C04 | ✅ 接受 P1 | 阈值精确触发 |
| B-C05 | ✅ 接受 P1 | 边界值 |
| B-C06 | ✅ 接受 P1 | 时间边界 |
| B-C07 | ✅ 接受 → P0 | 日期计算不一致是架构问题 |
| B-C08 | ✅ 接受 P1 | 异常数据 |
| E-C01 | ✅ 已安全 | claimAllRewards 遍历安全（数组副本），但需测试 |
| E-C02 | ✅ 接受 P1 | 已满目标跳过 |
| E-C03 | ✅ 接受 P1 | 多次 startTracking |
| E-C04 | ✅ 接受 → P0 | null saveData 崩溃风险 |
| E-C05 | ✅ 接受 P1 | 全部未完成 |
| E-C06 | ✅ 接受 P1 | 未绑定静默 |
| E-C07 | ⚠️ 已在 N-21 | 重复 |
| E-C08 | ✅ 接受 → P0 | 异常 milestones 数据 |
| C-C01 | ✅ 接受 P0 | 端到端链路 |
| C-C02 | ✅ 接受 P1 | 完整事件链 |
| C-C03 | ✅ 接受 P1 | 序列化恢复 |
| C-C04 | ✅ 接受 P1 | autoClaimed 事件 |
| C-C05 | ✅ 接受 → P0 | 三套活跃度一致性 |
| C-C06 | ✅ 接受 → P0 | 与 P0-005 相同 |
| L-C01 | ✅ 接受 P0 | 完整生命周期 |
| L-C02 | ✅ 接受 P0 | 跨日周期 |
| L-C03 | ✅ 接受 P1 | claimed 持久化 |
| L-C04 | ✅ 接受 → P0 | 与 P0-006 相同 |
| L-C05 | ✅ 接受 P1 | 监听器生命周期 |
| L-C06 | ✅ 接受 P1 | restoreState → refresh |

### P0 汇总

| P0 ID | 描述 | 来源 | 模式 |
|-------|------|------|------|
| P0-001 | addActivityPoints helper NaN 绕过 | Arbiter 独立 | #9 |
| P0-002 | ActivitySystem.addPoints NaN/负值 | Arbiter 独立 | #9 |
| P0-003 | QuestActivityManager.addPoints NaN/负值（P0-002 对称） | Arbiter 独立 | #9/#19 |
| P0-004 | updateProgressByTypeLogic count NaN | Arbiter 独立 | #9 |
| P0-005 | serialize 不保存 trackedQuestIds | Challenger C-C06 | #7/#15 |
| P0-006 | serialize 不保存 instanceCounter | Challenger L-C04 | #7 |
| P0-007 | serialize 不保存 weeklyQuest 数据 | Arbiter 独立 | #7/#15 |
| P0-008 | QuestDailyManager 不安全洗牌 | Arbiter 独立 | #11 |
| P0-009 | deserialize 不验证实例完整性 | Challenger E-C04/E-C08 | #1 |
| P0-010 | currentCount NaN 通过 deserialize 注入 | Arbiter 独立 | #9 |

**P0 总数: 10**

---

## 五、R1 评分

| 维度 | 分数 | 说明 |
|------|------|------|
| 完备性 | 7.5 | API 100% 覆盖，但未发现实际 P0 bug |
| 准确性 | 7.0 | covered 标注需源码验证，NaN 防护遗漏 |
| 优先级 | 8.0 | P0/P1/P2 分配基本合理 |
| 可测试性 | 8.5 | 节点可转化为测试 |
| 挑战应对 | 7.5 | Challenger 发现了关键问题但未深入源码 |

**R1 综合评分: 7.5/10**

**判定: CONTINUE** — 存在 10 个 P0 缺陷，需要修复后进入 R2。

---

## 六、R2 进入条件

1. 修复全部 10 个 P0
2. 补充缺失的序列化字段（trackedQuestIds、instanceCounter、weeklyQuest 数据）
3. 所有数值入口添加 NaN/负值防护
4. 验证 FIX 穿透率 < 10%
5. 更新对抗式测试覆盖所有 P0 修复
