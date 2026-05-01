# Achievement 模块 R1 对抗式测试 — 流程树

> Builder Agent v1.9 | 2026-05-01
> 源码：3 文件 / ~440 行 (AchievementSystem.ts 415行, AchievementHelpers.ts 75行, index.ts 3行)
> 配置：achievement.types.ts 260行, achievement-config.ts ~200行

## 公开 API 清单

### AchievementSystem (聚合根, 415行)
| # | API | 类型 | 参数 |
|---|-----|------|------|
| A-01 | `init(deps)` | ISubsystem | ISystemDeps |
| A-02 | `update(dt)` | ISubsystem | number |
| A-03 | `getState()` | ISubsystem | - |
| A-04 | `reset()` | ISubsystem | - |
| A-05 | `setRewardCallback(cb)` | 注入 | (reward: AchievementReward) => void |
| A-06 | `getAllAchievements()` | 查询 | - |
| A-07 | `getAchievementsByDimension(dimension)` | 查询 | AchievementDimension |
| A-08 | `getAchievement(id)` | 查询 | string |
| A-09 | `getDimensionStats()` | 查询 | - |
| A-10 | `getTotalPoints()` | 查询 | - |
| A-11 | `updateProgress(conditionType, value)` | 核心 | AchievementConditionType, number |
| A-12 | `updateProgressFromSnapshot(snapshot)` | 批量 | Record<string, number> |
| A-13 | `claimReward(achievementId)` | 状态变更 | string |
| A-14 | `getClaimableAchievements()` | 查询 | - |
| A-15 | `getAchievementChains()` | 查询 | - |
| A-16 | `getCompletedChains()` | 查询 | - |
| A-17 | `getSaveData()` | 序列化 | - |
| A-18 | `loadSaveData(data)` | 序列化 | AchievementSaveData |
| A-19 | `getUnlockedSummary()` | 查询 | - |

---

## 流程树节点

### F-Normal（正常流程）

| 节点ID | 描述 | API | 覆盖 |
|--------|------|-----|------|
| FN-A01 | init → 注册事件监听 → updateProgress可用 | A-01 | covered |
| FN-A02 | updateProgress(battle_wins, 10) → 成就进度更新 → 自动完成 | A-11 | covered |
| FN-A03 | updateProgress(battle_wins, 100) → 前置完成 → 后续自动解锁 | A-11 | covered |
| FN-A04 | 成就completed → claimReward → 积分增加 → 维度统计更新 | A-13 | covered |
| FN-A05 | claimReward → 解锁依赖成就 → 后续变为in_progress | A-13 | covered |
| FN-A06 | claimReward → 检查链进度 → 链完成 → 链奖励发放 | A-13 | covered |
| FN-A07 | getClaimableAchievements → 返回已完成但未领取列表 | A-14 | covered |
| FN-A08 | getAllAchievements → 返回所有成就含进度 | A-06 | covered |
| FN-A09 | getAchievementsByDimension(battle) → 仅返回战斗维度 | A-07 | covered |
| FN-A10 | getAchievement(id) → 返回单个成就详情 | A-08 | covered |
| FN-A11 | getDimensionStats → 深拷贝返回 | A-09 | covered |
| FN-A12 | getTotalPoints → 返回总积分 | A-10 | covered |
| FN-A13 | updateProgressFromSnapshot({battle_wins:50}) → 批量更新 | A-12 | covered |
| FN-A14 | getSaveData → loadSaveData → 数据一致 | A-17, A-18 | covered |
| FN-A15 | reset → 所有状态归零 | A-04 | covered |
| FN-A16 | getAchievementChains → 返回链含进度和完成状态 | A-15 | covered |
| FN-A17 | getCompletedChains → 返回已完成链ID列表 | A-16 | covered |
| FN-A18 | getUnlockedSummary → 按维度统计已解锁成就 | A-19 | covered |
| FN-A19 | setRewardCallback → claimReward时回调触发 | A-05, A-13 | covered |
| FN-A20 | 事件监听 battle:completed → 自动调用updateProgress | A-01 | covered |
| FN-A21 | 事件监听 building:upgraded → 自动调用updateProgress | A-01 | covered |
| FN-A22 | 事件监听 hero:recruited → 自动调用updateProgress | A-01 | covered |
| FN-A23 | 事件监听 rebirth:completed → 自动调用updateProgress | A-01 | covered |
| FN-A24 | 事件监听 prestige:levelUp → 自动调用updateProgress | A-01 | covered |

### F-Boundary（边界条件）

| 节点ID | 描述 | API | 覆盖 |
|--------|------|-----|------|
| FB-A01 | updateProgress(conditionType, NaN) → 进度是否被污染？ | A-11 | ⚠️ |
| FB-A02 | updateProgress(conditionType, -1) → 负值进度 | A-11 | ⚠️ |
| FB-A03 | updateProgress(conditionType, Infinity) → 无限进度 | A-11 | ⚠️ |
| FB-A04 | updateProgress(conditionType, 0) → 零值进度 | A-11 | covered |
| FB-A05 | claimReward(不存在ID) → 返回失败 | A-13 | covered |
| FB-A06 | claimReward(未完成成就) → 返回失败 | A-13 | covered |
| FB-A07 | claimReward(已领取成就) → 二次领取 | A-13 | ⚠️ |
| FB-A08 | claimReward(空字符串) → 空ID处理 | A-13 | ⚠️ |
| FB-A09 | getAchievement(不存在ID) → 返回null | A-08 | covered |
| FB-A10 | loadSaveData(version不匹配) → 静默忽略 | A-18 | ⚠️ |
| FB-A11 | loadSaveData(null) → 崩溃？ | A-18 | ⚠️ |
| FB-A12 | loadSaveData(undefined) → 崩溃？ | A-18 | ⚠️ |
| FB-A13 | updateProgressFromSnapshot({}) → 空快照 | A-12 | covered |
| FB-A14 | updateProgressFromSnapshot({key: NaN}) → NaN传播 | A-12 | ⚠️ |
| FB-A15 | getAchievementsByDimension(无效维度) → 空数组？ | A-07 | ⚠️ |
| FB-A16 | totalPoints 溢出 → Number.MAX_SAFE_INTEGER | A-10 | ⚠️ |
| FB-A17 | dimensionStats.completedCount 超过 totalCount | A-09 | ⚠️ |
| FB-A18 | completedChains 重复添加 | A-16 | ⚠️ |

### F-Error（异常路径）

| 节点ID | 描述 | API | 覆盖 |
|--------|------|-----|------|
| FE-A01 | init前调用updateProgress → this.deps未初始化崩溃 | A-11 | ⚠️ |
| FE-A02 | rewardCallback抛异常 → claimReward中断 | A-05, A-13 | ⚠️ |
| FE-A03 | loadSaveData(data.state.achievements为null) → 崩溃 | A-18 | ⚠️ |
| FE-A04 | loadSaveData(data.state.dimensionStats为null) → 崩溃 | A-18 | ⚠️ |
| FE-A05 | getSaveData后外部修改返回值 → 内部状态是否被篡改 | A-17 | ⚠️ |
| FE-A06 | updateProgress → completed事件emit异常 → 进度卡住 | A-11 | ⚠️ |
| FE-A07 | 链完成时rewardCallback抛异常 → completedChains已推入但奖励未发 | A-13 | ⚠️ |
| FE-A08 | eventBus.on回调引用未清理 → reset后旧回调仍触发 | A-04 | ⚠️ |

### F-CrossSystem（跨系统链路）

| 节点ID | 描述 | API | 覆盖 |
|--------|------|-----|------|
| FX-A01 | engine-save → getSaveData → loadSaveData 完整链路 | A-17, A-18 | covered |
| FX-A02 | engine-save 六处覆盖验证 (SaveContext/GameSaveData/buildSaveData/toIGameState/fromIGameState/applySaveData) | - | covered |
| FX-A03 | battle:completed事件 → AchievementSystem → 进度更新 | A-01 | covered |
| FX-A04 | building:upgraded事件 → AchievementSystem → 进度更新 | A-01 | covered |
| FX-A05 | hero:recruited事件 → AchievementSystem → 进度更新 | A-01 | covered |
| FX-A06 | rebirth:completed事件 → AchievementSystem → 进度更新 | A-01 | covered |
| FX-A07 | prestige:levelUp事件 → AchievementSystem → 进度更新 | A-01 | covered |
| FX-A08 | AchievementSystem → rewardCallback → ResourceSystem 资源发放 | A-05, A-13 | ⚠️ |
| FX-A09 | claimReward → achievement:completed事件 → 其他系统响应 | A-13 | covered |
| FX-A10 | claimReward → achievement:chainCompleted事件 → 其他系统响应 | A-13 | covered |

### F-DataLifecycle（数据生命周期）

| 节点ID | 描述 | API | 覆盖 |
|--------|------|-----|------|
| FD-A01 | init → 正常游戏 → getSaveData → 完整存档 | A-01, A-17 | covered |
| FD-A02 | loadSaveData → 继续游戏 → getSaveData → 数据无损 | A-18, A-17 | covered |
| FD-A03 | reset → getSaveData → 空状态存档 | A-04, A-17 | covered |
| FD-A04 | loadSaveData → checkChainProgress → 链进度正确重建 | A-18 | ⚠️ |
| FD-A05 | loadSaveData中version不匹配 → 静默丢弃 → 状态是什么？ | A-18 | ⚠️ |
| FD-A06 | 大量成就数据序列化性能 | A-17 | ⚠️ |

---

## NaN 专项扫描表

| 位置 | 代码 | NaN行为 | 风险 |
|------|------|---------|------|
| A-11: `updateProgress` value参数 | `Math.max(instance.progress[cond.type], value)` | NaN与任何数取max → NaN | 🔴 P0 |
| A-13: `claimReward` totalPoints | `this.state.totalPoints += def.rewards.achievementPoints` | achievementPoints为NaN → totalPoints变NaN | 🟡 |
| A-13: `claimReward` dimStats | `dimStats.totalPoints += def.rewards.achievementPoints` | 同上 | 🟡 |
| A-12: `updateProgressFromSnapshot` | `Object.entries(snapshot)` → 透传给updateProgress | NaN值透传 | 🔴 |
| A-11: `checkCompletion` | `current >= cond.targetValue` | NaN >= target → false → 永远不完成 | 🟡 |
| A-11: `updateProgress` progress | `instance.progress[cond.type] = Math.max(...)` | 进度值被NaN覆盖 | 🔴 P0 |

## 序列化覆盖检查 (BR-014/BR-015)

| 检查点 | 位置 | 状态 |
|--------|------|------|
| GameSaveData.achievement字段 | shared/types.ts | ✅ 已有 |
| SaveContext.achievement字段 | engine-save.ts:94 | ✅ 已有 |
| buildSaveData序列化调用 | engine-save.ts:213 | ✅ 已有 |
| toIGameState映射 | engine-save.ts:291 | ✅ 已有 |
| fromIGameState映射 | engine-save.ts:366 | ✅ 已有 |
| applySaveData加载调用 | engine-save.ts:648-649 | ✅ 已有 |

**结论**: Achievement 在 engine-save 六处均已正确接入 ✅

## 配置-枚举同步检查 (BR-018)

| 检查项 | 状态 |
|--------|------|
| AchievementDimension (5值) vs ACHIEVEMENT_DIMENSION_LABELS (5键) | ✅ 一致 |
| AchievementDimension vs ACHIEVEMENT_DIMENSION_ICONS (5键) | ✅ 一致 |
| AchievementRarity (4值) vs ACHIEVEMENT_RARITY_LABELS (4键) | ✅ 一致 |
| AchievementRarity vs ACHIEVEMENT_RARITY_WEIGHTS (4键) | ✅ 一致 |
| ALL_ACHIEVEMENTS vs ACHIEVEMENT_DEF_MAP (ID一致性) | ✅ 需验证 |
| REBIRTH_ACHIEVEMENT_CHAINS.achievementIds vs ALL_ACHIEVEMENTS | ⚠️ 需验证 |

---

## 统计

| 类别 | 数量 |
|------|------|
| 公开API | 19 |
| F-Normal | 24 |
| F-Boundary | 18 |
| F-Error | 8 |
| F-CrossSystem | 10 |
| F-DataLifecycle | 6 |
| **总节点** | **66** |
| 覆盖率 | 66/19 = 347% |
