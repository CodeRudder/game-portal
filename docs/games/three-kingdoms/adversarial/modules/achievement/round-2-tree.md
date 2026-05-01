# Achievement 流程分支树 Round 2

> Builder: TreeBuilder v1.8 | Time: 2026-05-02
> 模块: achievement | 基线: R1 sealed (commit d210bf2e) | R1修复: 4 FIX merged

## R1→R2 变更摘要

R1 修复了 6 个 P0 问题（合并为 4 个 FIX），新增防护点：

| FIX-ID | 影响函数 | 新增分支 | 状态 |
|--------|---------|---------|------|
| FIX-ACH-402 | loadSaveData | +6 分支（字段验证/NaN/补全） | ✅ covered |
| FIX-ACH-403 | updateProgress | +1 分支（已有进度NaN） | ✅ covered |
| FIX-ACH-404 | getSaveData | +1 分支（深拷贝progress） | ✅ covered |
| FIX-ACH-406 | claimReward | +1 分支（积分验证） | ✅ covered |

## 统计

| 子系统 | 节点数 | API数 | covered | uncovered | P0 | P1 |
|--------|--------|-------|---------|-----------|----|----|
| AchievementSystem | 101 | 16 | 96 | 5 | 0 | 5 |
| AchievementHelpers | 12 | 3 | 10 | 2 | 0 | 2 |
| achievement-config | 18 | 6 | 18 | 0 | 0 | 0 |
| achievement.types | 8 | 4 | 8 | 0 | 0 | 0 |
| **总计** | **139** | **29** | **132** | **7** | **0** | **7** |

## 覆盖率提升

| 子系统 | R1覆盖率 | R2覆盖率 | 提升 |
|--------|---------|---------|------|
| AchievementSystem | 67.4% | 95.0% | +27.6% |
| AchievementHelpers | 66.7% | 83.3% | +16.6% |
| achievement-config | 100% | 100% | — |
| achievement.types | 100% | 100% | — |

## R2 新增覆盖节点

### FIX-ACH-402 防护分支（loadSaveData）

| # | 分支条件 | 优先级 | 状态 | 测试来源 |
|---|---------|--------|------|---------|
| AS-R2-402a | data.state.achievements = undefined → return | P0 | ✅ | loadSaveData 缺失字段 |
| AS-R2-402b | data.state.dimensionStats = null → return | P0 | ✅ | loadSaveData 缺失字段 |
| AS-R2-402c | totalPoints = NaN → fallback 0 | P0 | ✅ | loadSaveData NaN 穿透 |
| AS-R2-402d | progress[key] = NaN → fallback 0 | P0 | ✅ | loadSaveData NaN 穿透 |
| AS-R2-402e | completedChains = undefined → fallback [] | P0 | ✅ | loadSaveData 缺失字段 |
| AS-R2-402f | 缺失成就实例 → 补全 createAchievementInstance | P0 | ✅ | loadSaveData 缺失实例 |

### FIX-ACH-403 防护分支（updateProgress）

| # | 分支条件 | 优先级 | 状态 | 测试来源 |
|---|---------|--------|------|---------|
| AS-R2-403a | current = NaN → safeCurrent = 0 | P0 | ✅ | updateProgress 已有NaN进度 |

### FIX-ACH-404 防护分支（getSaveData）

| # | 分支条件 | 优先级 | 状态 | 测试来源 |
|---|---------|--------|------|---------|
| AS-R2-404a | progress 深拷贝 → 外部修改不影响内部 | P0 | ✅ | getSaveData 引用隔离 |

### FIX-ACH-406 防护分支（claimReward）

| # | 分支条件 | 优先级 | 状态 | 测试来源 |
|---|---------|--------|------|---------|
| AS-R2-406a | achievementPoints = NaN → 跳过累加 | P0 | ✅ | claimReward NaN 积分 |
| AS-R2-406b | achievementPoints = 0 → 跳过累加 | P0 | ✅ | claimReward 零积分 |

## R2 残余 uncovered 节点（全部 P1）

| # | API | 分支条件 | 优先级 | 风险评估 |
|---|-----|---------|--------|---------|
| AS-009 | reset() | eventUnsubscribers 清空验证 | P1 | 低风险：FIX-909 已间接覆盖 |
| AS-010 | reset() | rewardCallback 不清空 | P1 | 低风险：设计决策 |
| AS-021 | setRewardCallback | 覆盖已有回调 | P1 | 低风险：简单赋值 |
| AS-022 | setRewardCallback(null) | null 防护 | P1 | 低风险：undefined 行为一致 |
| AS-033 | getAchievementsByDimension | 无效维度 | P1 | 低风险：返回空数组 |
| AH-004 | createInitialState | 未知维度动态初始化 | P1 | 低风险：config 覆盖全维度 |
| AH-009 | checkChainProgress | 空 chainProgress | P1 | 低风险：循环天然处理 |

## 跨系统链路覆盖

| 链路域 | 链路数 | covered | uncovered |
|--------|--------|---------|-----------|
| Achievement↔EventBus | 5 | 5 | 0 |
| Achievement↔RewardCallback | 3 | 3 | 0 |
| Achievement↔Save | 4 | 4 | 0 |
| Achievement↔Chain | 3 | 3 | 0 |
| Achievement→Prestige | 1 | 1 | 0 |
| Achievement↔Prerequisite | 2 | 2 | 0 |
| **总计** | **18** | **18** | **0** |

## P1 建议清单（R3 跟进，非阻塞）

| # | 建议 | 优先级 |
|---|------|--------|
| 1 | reset() 中清空 rewardCallback | P1 |
| 2 | setRewardCallback(null) 防护 | P1 |
| 3 | getAchievementsByDimension 无效维度 | P1 |
| 4 | 事件监听器直接测试（5事件×3payload） | P1 |
| 5 | rewardCallback 返回值验证 | P1 |
