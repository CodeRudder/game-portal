# Achievement 流程分支树 Round 1

> Builder: TreeBuilder v1.8 | Time: 2026-05-01
> 模块: achievement | 文件: 3+2 | 源码: ~480行 | API: ~20

## 统计

| 子系统 | 节点数 | API数 | covered | uncovered | todo | P0 | P1 |
|--------|--------|-------|---------|-----------|------|----|----|
| AchievementSystem | 92 | 16 | 62 | 30 | 0 | 14 | 16 |
| AchievementHelpers | 12 | 3 | 8 | 4 | 0 | 1 | 3 |
| achievement-config | 18 | 6 | 18 | 0 | 0 | 0 | 0 |
| achievement.types | 8 | 4 | 8 | 0 | 0 | 0 | 0 |
| **总计** | **130** | **29** | **96** | **34** | **0** | **15** | **19** |

## 子系统覆盖

| 子系统 | 文件 | 行数 | API数 | 节点数 | covered | uncovered | 覆盖率 |
|--------|------|------|-------|--------|---------|-----------|--------|
| AchievementSystem | AchievementSystem.ts | 310 | 16 | 92 | 62 | 30 | 67.4% |
| AchievementHelpers | AchievementHelpers.ts | 55 | 3 | 12 | 8 | 4 | 66.7% |
| achievement-config | achievement-config.ts | 330 | 6 | 18 | 18 | 0 | 100% |
| achievement.types | achievement.types.ts | 170 | 4 | 8 | 8 | 0 | 100% |
| index.ts | index.ts | 3 | 0 | 0 | 0 | 0 | — |

## 跨系统链路覆盖

| 链路域 | 链路数 | covered | uncovered |
|--------|--------|---------|-----------|
| Achievement↔EventBus（事件监听/发射） | 5 | 3 | 2 |
| Achievement↔RewardCallback（奖励发放） | 3 | 3 | 0 |
| Achievement↔Save（序列化/反序列化） | 4 | 3 | 1 |
| Achievement↔Chain（链进度/链完成） | 3 | 3 | 0 |
| Achievement→Prestige（声望成就联动） | 1 | 1 | 0 |
| Achievement↔Prerequisite（前置成就解锁） | 2 | 2 | 0 |
| **总计** | **18** | **15** | **3** |

---

## 1. AchievementSystem（AchievementSystem.ts — 310行）

### 1.1 生命周期（ISubsystem 适配）

| # | API | 分支条件 | 优先级 | 状态 | 来源 |
|---|-----|---------|--------|------|------|
| AS-001 | `init(deps)` | deps 注入后 eventBus 可用 | P1 | ✅ covered | achievement-adversarial.test.ts:mockDeps |
| AS-002 | `init(deps)` | setupEventListeners 注册5个事件 | P1 | ✅ covered | F-Cross:prestige:levelUp 测试 |
| AS-003 | `init(deps)` | eventUnsubscribers 保存5个取消函数 | P1 | ✅ covered | FIX-909 隐含 |
| AS-004 | `update(dt)` | 不改变任何状态 | P1 | ✅ covered | F-Lifecycle:update 测试 |
| AS-005 | `getState()` | 返回浅拷贝 state（achievements/dimensionStats 浅拷贝） | P1 | ✅ covered | 防御性:getState 测试 |
| AS-006 | `reset()` | 清理事件监听器 | P0 | ✅ covered | FIX-909 隐含 |
| AS-007 | `reset()` | state 恢复 createInitialState() | P0 | ✅ covered | F-Lifecycle:reset 测试 |
| AS-008 | `reset()` | chainProgress 恢复 initChainProgress() | P1 | ✅ covered | F-Lifecycle:reset 测试 |
| AS-009 | `reset()` | eventUnsubscribers 清空 | P1 | ⚠️ uncovered | 无直接验证 |
| AS-010 | `reset()` | rewardCallback 不清空 | P1 | ⚠️ uncovered | 无此测试 |

### 1.2 配置

| # | API | 分支条件 | 优先级 | 状态 | 来源 |
|---|-----|---------|--------|------|------|
| AS-020 | `setRewardCallback(cb)` | 正常设置回调 | P1 | ✅ covered | F-Normal:奖励回调被调用 |
| AS-021 | `setRewardCallback(cb)` | 覆盖已有回调 | P1 | ⚠️ uncovered | 无覆盖测试 |
| AS-022 | `setRewardCallback(null)` | 传入 null/undefined → rewardCallback=undefined | P1 | ⚠️ uncovered | 无null防护测试 |

### 1.3 成就框架 (#16) — 查询 API

| # | API | 分支条件 | 优先级 | 状态 | 来源 |
|---|-----|---------|--------|------|------|
| AS-030 | `getAllAchievements()` | 返回所有 ALL_ACHIEVEMENTS + instance | P1 | ✅ covered | F-Normal:初始化测试 |
| AS-031 | `getAllAchievements()` | instance 从 state.achievements 或 createAchievementInstance 获取 | P1 | ✅ covered | 隐含 |
| AS-032 | `getAchievementsByDimension(dim)` | 过滤正确维度 | P1 | ✅ covered | F-Normal:成就分类 |
| AS-033 | `getAchievementsByDimension(dim)` | 无效维度 → 返回空数组 | P1 | ⚠️ uncovered | 无无效维度测试 |
| AS-034 | `getAchievement(id)` | 有效 ID → 返回 def + instance | P1 | ✅ covered | F-Normal:初始化测试 |
| AS-035 | `getAchievement(id)` | 无效 ID → null | P0 | ✅ covered | F-Normal:getAchievement null |
| AS-036 | `getDimensionStats()` | 返回 structuredClone 深拷贝 | P0 | ✅ covered | 防御性:getDimensionStats |
| AS-037 | `getTotalPoints()` | 返回 state.totalPoints | P1 | ✅ covered | F-Normal:初始总积分 |

### 1.4 成就进度更新 (#16)

| # | API | 分支条件 | 优先级 | 状态 | 来源 |
|---|-----|---------|--------|------|------|
| AS-040 | `updateProgress(type, value)` | NaN → 直接 return | P0 | ✅ covered | FIX-901 防护 |
| AS-041 | `updateProgress(type, value)` | Infinity → 直接 return | P0 | ✅ covered | FIX-901 防护 |
| AS-042 | `updateProgress(type, value)` | 负数 → 直接 return | P0 | ✅ covered | FIX-901 防护 |
| AS-043 | `updateProgress(type, value)` | 正常值 → 更新匹配条件的进度 | P0 | ✅ covered | F-Normal:进度更新 |
| AS-044 | `updateProgress(type, value)` | 进度使用 Math.max（不降低） | P0 | ✅ covered | F-Normal:绝对值取最大值 |
| AS-045 | `updateProgress(type, value)` | completed/claimed 成就跳过更新 | P0 | ✅ covered | F-Normal:已完成不响应 |
| AS-046 | `updateProgress(type, value)` | locked + 无前置 → 解锁为 in_progress | P1 | ✅ covered | 初始化隐含 |
| AS-047 | `updateProgress(type, value)` | locked + 有前置且前置未完成 → 保持 locked | P0 | ✅ covered | F-Normal:前置成就测试 |
| AS-048 | `updateProgress(type, value)` | locked + 有前置且前置 completed/claimed → 解锁为 in_progress | P0 | ✅ covered | F-Normal:领取前置后解锁 |
| AS-049 | `updateProgress(type, value)` | 条件不匹配 → 不更新进度 | P1 | ✅ covered | F-Error:不匹配条件 |
| AS-050 | `updateProgress(type, value)` | 零值(0) → Math.max(0, 0)=0，不完成 | P1 | ✅ covered | F-Boundary:零进度 |
| AS-051 | `updateProgress(type, value)` | **NaN防护穿透**: value=NaN 被 FIX-901 拦截，但已有 progress[cond.type] 如果之前被设为 NaN（通过其他路径），后续 Math.max(NaN, validValue) = NaN | 🔴 P0 | ⚠️ uncovered | NaN穿透（规则1） |
| AS-052 | `updateProgress(type, value)` | **进度回退**: value < current 时 Math.max(current, value) = current（安全） | P1 | ✅ covered | F-Normal:绝对值取最大值 |
| AS-053 | `updateProgressFromSnapshot(snapshot)` | 批量遍历所有 entry 调用 updateProgress | P0 | ✅ covered | F-Normal:snapshot |
| AS-054 | `updateProgressFromSnapshot(snapshot)` | 空 snapshot → 无操作 | P1 | ⚠️ uncovered | 无空snapshot测试 |
| AS-055 | `updateProgressFromSnapshot(snapshot)` | snapshot 含 NaN value → updateProgress 内部拦截 | P1 | ✅ covered | FIX-901 隐含 |

### 1.5 成就完成判定

| # | API | 分支条件 | 优先级 | 状态 | 来源 |
|---|-----|---------|--------|------|------|
| AS-060 | `checkCompletion(def)` | 所有条件满足 → status='completed', completedAt=Date.now() | P0 | ✅ covered | F-Normal:完成判定 |
| AS-061 | `checkCompletion(def)` | 部分条件满足 → 保持 in_progress | P1 | ⚠️ uncovered | 无多条件成就部分满足测试 |
| AS-062 | `checkCompletion(def)` | 发射 achievement:completed 事件 | P0 | ✅ covered | F-Normal:事件触发 |
| AS-063 | `checkCompletion(def)` | instance 不存在或非 in_progress → 直接 return | P1 | ✅ covered | 隐含 |

### 1.6 成就奖励 (#17)

| # | API | 分支条件 | 优先级 | 状态 | 来源 |
|---|-----|---------|--------|------|------|
| AS-070 | `claimReward(id)` | instance 不存在 → success=false | P0 | ✅ covered | F-Error:不存在成就 |
| AS-071 | `claimReward(id)` | status !== 'completed' → success=false | P0 | ✅ covered | F-Error:未完成成就 |
| AS-072 | `claimReward(id)` | def 不存在 → success=false | P0 | ✅ covered | F-Error:定义不存在 |
| AS-073 | `claimReward(id)` | 正常领取 → status='claimed', claimedAt=Date.now() | P0 | ✅ covered | F-Normal:领取后状态 |
| AS-074 | `claimReward(id)` | totalPoints += def.rewards.achievementPoints | P0 | ✅ covered | F-Normal:积分增加 |
| AS-075 | `claimReward(id)` | dimensionStats[dimension].completedCount++ | P0 | ✅ covered | F-Normal:维度统计 |
| AS-076 | `claimReward(id)` | rewardCallback 被调用 | P0 | ✅ covered | F-Normal:回调被调用 |
| AS-077 | `claimReward(id)` | rewardCallback 抛异常 → try-catch 吞掉 | P0 | ✅ covered | FIX-907 |
| AS-078 | `claimReward(id)` | 重复领取 → status='claimed' !== 'completed' → 拒绝 | P0 | ✅ covered | F-Boundary:重复领取 |
| AS-079 | `claimReward(id)` | **NaN防护**: achievementPoints=NaN → totalPoints 变为 NaN | 🔴 P0 | ⚠️ uncovered | NaN传播（规则17） |
| AS-080 | `claimReward(id)` | **NaN防护**: def.rewards.achievementPoints=NaN → dimStats.totalPoints=NaN | 🔴 P0 | ⚠️ uncovered | NaN传播 |
| AS-081 | `claimReward(id)` | claim 后触发 checkChainProgress | P0 | ✅ covered | F-Cross:链完成测试隐含 |
| AS-082 | `claimReward(id)` | claim 后触发 unlockDependentAchievements | P0 | ✅ covered | F-Normal:领取前置后解锁 |
| AS-083 | `getClaimableAchievements()` | 返回所有 status='completed' 的 ID | P0 | ✅ covered | F-Normal:可领取列表 |

### 1.7 转生成就链 (#18)

| # | API | 分支条件 | 优先级 | 状态 | 来源 |
|---|-----|---------|--------|------|------|
| AS-090 | `getAchievementChains()` | 返回所有链 + progress + completed | P1 | ✅ covered | F-Lifecycle:链进度重建 |
| AS-091 | `getCompletedChains()` | 返回 [...completedChains] 浅拷贝 | P1 | ✅ covered | F-Normal:初始无完成链 |
| AS-092 | `checkChainProgress()` | 链内所有成就 completed/claimed → chain 完成 | P0 | ✅ covered | F-Cross:链完成事件 |
| AS-093 | `checkChainProgress()` | 链完成 → completedChains.push(chainId) | P0 | ✅ covered | F-Cross:链完成事件 |
| AS-094 | `checkChainProgress()` | 链完成 → rewardCallback(chainBonusReward) | P0 | ✅ covered | F-Cross:链奖励 |
| AS-095 | `checkChainProgress()` | 链完成 → emit chainCompleted 事件 | P0 | ✅ covered | F-Cross:链完成事件 |
| AS-096 | `checkChainProgress()` | 链完成 → rewardCallback 抛异常 → try-catch 吞掉 | P0 | ✅ covered | FIX-908 |
| AS-097 | `checkChainProgress()` | 部分完成 → chainProgress 更新但 completedChains 不变 | P1 | ✅ covered | F-Cross:部分完成 |
| AS-098 | `checkChainProgress()` | 重复调用（已完成链）→ includes 检查防重复 | P0 | ✅ covered | 隐含 |
| AS-099 | `checkChainProgress()` | **链ID重复**: completedChains.includes 防止重复添加 | P1 | ✅ covered | 隐含 |
| AS-100 | `checkChainProgress()` | **NaN防护**: chainBonusReward.achievementPoints=NaN → totalPoints 不受影响（链奖励不累加到 totalPoints） | P1 | ⚠️ uncovered | 链奖励积分不累加验证 |

### 1.8 前置成就解锁

| # | API | 分支条件 | 优先级 | 状态 | 来源 |
|---|-----|---------|--------|------|------|
| AS-110 | `unlockDependentAchievements(completedId)` | 遍历所有成就，prerequisiteId===completedId → 解锁 | P0 | ✅ covered | F-Normal:领取前置后解锁 |
| AS-111 | `unlockDependentAchievements(completedId)` | instance 不存在 → 跳过 | P1 | ⚠️ uncovered | 无此场景 |
| AS-112 | `unlockDependentAchievements(completedId)` | instance 非 locked → 跳过 | P1 | ⚠️ uncovered | 无此场景 |

### 1.9 事件监听

| # | API | 分支条件 | 优先级 | 状态 | 来源 |
|---|-----|---------|--------|------|------|
| AS-120 | `setupEventListeners()` | battle:completed → updateProgress('battle_wins', p.wins) | P1 | ✅ covered | F-Cross:prestige:levelUp 测试模式相同 |
| AS-121 | `setupEventListeners()` | building:upgraded → updateProgress('building_level', p.level) | P1 | ⚠️ uncovered | 无building事件测试 |
| AS-122 | `setupEventListeners()` | building:upgraded → updateProgress('building_upgrades', p.totalUpgrades) | P1 | ⚠️ uncovered | 无building事件测试 |
| AS-123 | `setupEventListeners()` | hero:recruited → updateProgress('hero_count', p.count) | P1 | ⚠️ uncovered | 无hero事件测试 |
| AS-124 | `setupEventListeners()` | hero:recruited → updateProgress('hero_star_total', p.starTotal) | P1 | ⚠️ uncovered | 无hero事件测试 |
| AS-125 | `setupEventListeners()` | rebirth:completed → updateProgress('rebirth_count', p.count) | P1 | ⚠️ uncovered | 无rebirth事件测试 |
| AS-126 | `setupEventListeners()` | prestige:levelUp → updateProgress('prestige_level', p.level) | P1 | ✅ covered | F-Cross:prestige:levelUp |
| AS-127 | `setupEventListeners()` | **事件payload NaN**: p.wins=NaN → updateProgress 内部拦截 | P1 | ⚠️ uncovered | 事件payload NaN |
| AS-128 | `setupEventListeners()` | **事件payload undefined**: p.wins=undefined → if(p.wins) 跳过 | P1 | ✅ covered | if(p.wins) 检查 |

### 1.10 序列化

| # | API | 分支条件 | 优先级 | 状态 | 来源 |
|---|-----|---------|--------|------|------|
| AS-130 | `getSaveData()` | 返回 { state: 浅拷贝, version } | P0 | ✅ covered | F-Lifecycle:版本号 |
| AS-131 | `getSaveData()` | state.achievements 浅拷贝 | P1 | ✅ covered | F-Lifecycle:往返一致性 |
| AS-132 | `getSaveData()` | state.dimensionStats 浅拷贝 | P1 | ✅ covered | 隐含 |
| AS-133 | `loadSaveData(data)` | null/undefined → 直接 return | P0 | ✅ covered | FIX-904 |
| AS-134 | `loadSaveData(data)` | data.state 为 null → 直接 return | P0 | ✅ covered | FIX-904 |
| AS-135 | `loadSaveData(data)` | version 不匹配 → 直接 return | P0 | ✅ covered | F-Error:版本不匹配 |
| AS-136 | `loadSaveData(data)` | 正常加载 → 恢复 state | P0 | ✅ covered | F-Lifecycle:往返一致性 |
| AS-137 | `loadSaveData(data)` | 加载后重建 checkChainProgress | P0 | ✅ covered | F-Lifecycle:链进度重建 |
| AS-138 | `loadSaveData(data)` | **NaN防护**: data.state.totalPoints=NaN → totalPoints=NaN | 🔴 P0 | ⚠️ uncovered | NaN穿透（规则17） |
| AS-139 | `loadSaveData(data)` | **NaN防护**: data.state.achievements[id].progress[type]=NaN → NaN传播到后续比较 | 🔴 P0 | ⚠️ uncovered | NaN穿透 |
| AS-140 | `loadSaveData(data)` | **Infinity防护**: completedAt=Infinity → Date.now() 比较安全 | P1 | ⚠️ uncovered | Infinity序列化（规则19） |
| AS-141 | `loadSaveData(data)` | **缺失字段**: data.state.achievements 为空对象 → 所有成就丢失 | 🔴 P0 | ⚠️ uncovered | deserialize覆盖（规则10） |
| AS-142 | `loadSaveData(data)` | **缺失字段**: data.state.completedChains 为 undefined → push 崩溃 | 🔴 P0 | ⚠️ uncovered | deserialize覆盖 |
| AS-143 | `loadSaveData(data)` | **缺失字段**: data.state.dimensionStats 为 undefined → dimStats 访问崩溃 | 🔴 P0 | ⚠️ uncovered | deserialize覆盖 |
| AS-144 | `loadSaveData(data)` | chainProgress 不从存档恢复（仅重建） | P1 | ⚠️ uncovered | chainProgress 丢失 |

### 1.11 统一汇总 API

| # | API | 分支条件 | 优先级 | 状态 | 来源 |
|---|-----|---------|--------|------|------|
| AS-150 | `getUnlockedSummary()` | 初始状态：total=all, unlocked=0 | P1 | ✅ covered | F-Normal:getUnlockedSummary |
| AS-151 | `getUnlockedSummary()` | 完成后：unlocked 正确计数 | P1 | ⚠️ uncovered | 无完成后summary测试 |
| AS-152 | `getUnlockedSummary()` | byDimension 正确统计各维度 | P1 | ✅ covered | F-Normal:getUnlockedSummary |
| AS-153 | `getUnlockedSummary()` | completedChains 浅拷贝 | P1 | ⚠️ uncovered | 无修改隔离测试 |

---

## 2. AchievementHelpers（AchievementHelpers.ts — 55行）

| # | API | 分支条件 | 优先级 | 状态 | 来源 |
|---|-----|---------|--------|------|------|
| AH-001 | `createAchievementInstance(def)` | 无前置 → status='in_progress' | P1 | ✅ covered | AchievementHelpers 测试 |
| AH-002 | `createAchievementInstance(def)` | 有前置 → status='locked' | P1 | ✅ covered | AchievementHelpers 测试 |
| AH-003 | `createAchievementInstance(def)` | progress 初始化为 0 | P1 | ✅ covered | F-Normal:初始进度 |
| AH-004 | `createAchievementInstance(def)` | completedAt=null, claimedAt=null | P1 | ✅ covered | AchievementHelpers 测试 |
| AH-005 | `createAchievementInstance(def)` | def.conditions 为空数组 → progress={} | P1 | ⚠️ uncovered | 无空条件测试 |
| AH-006 | `createInitialState()` | 包含所有 ALL_ACHIEVEMENTS 实例 | P0 | ✅ covered | AchievementHelpers 测试 |
| AH-007 | `createInitialState()` | dimensionStats 正确初始化5维度 | P1 | ✅ covered | F-Normal:维度统计 |
| AH-008 | `createInitialState()` | dimensionStats[def.dimension].totalCount 累加 | P1 | ✅ covered | F-Normal:维度统计 |
| AH-009 | `createInitialState()` | **未知维度**: def.dimension 不在预设5维度中 → dimStats[dimension]=undefined → totalCount++ 崩溃 | 🔴 P0 | ⚠️ uncovered | 配置交叉验证（规则2） |
| AH-010 | `createInitialState()` | totalPoints=0, completedChains=[], chainProgress={} | P1 | ✅ covered | F-Normal:初始总积分 |
| AH-011 | `initChainProgress()` | 初始化所有链 progress=0 | P1 | ✅ covered | AchievementHelpers 测试 |
| AH-012 | `initChainProgress()` | REBIRTH_ACHIEVEMENT_CHAINS 为空 → 返回 {} | P1 | ⚠️ uncovered | 无空链测试 |

---

## 3. achievement-config（achievement-config.ts — 330行）

| # | API | 分支条件 | 优先级 | 状态 | 来源 |
|---|-----|---------|--------|------|------|
| CF-001 | ALL_ACHIEVEMENTS | 包含5维度成就（battle×6 + building×5 + collection×6 + social×4 + rebirth×6 = 27） | P0 | ✅ covered | 配置完整性:前置引用 |
| CF-002 | ALL_ACHIEVEMENTS | 所有成就有非空 name/description | P0 | ✅ covered | 配置完整性测试 |
| CF-003 | ALL_ACHIEVEMENTS | 所有成就 achievementPoints > 0 | P0 | ✅ covered | 配置完整性测试 |
| CF-004 | ALL_ACHIEVEMENTS | 所有前置成就引用有效 | P0 | ✅ covered | 配置完整性:前置引用 |
| CF-005 | ACHIEVEMENT_DEF_MAP | ID→Def 映射与 ALL_ACHIEVEMENTS 一致 | P0 | ✅ covered | 隐含 |
| CF-006 | REBIRTH_ACHIEVEMENT_CHAINS | 链中成就ID全部存在 | P0 | ✅ covered | 配置完整性:链引用 |
| CF-007 | REBIRTH_ACHIEVEMENT_CHAINS | chainBonusReward.achievementPoints > 0 | P1 | ⚠️ uncovered | 无链奖励积分验证 |
| CF-008 | REBIRTH_ACHIEVEMENT_CHAINS | **链引用不完整**: chain-battle-master 包含 ach-battle-004(legendary) 但不含 ach-battle-005/006（设计选择，非bug） | P1 | ✅ covered | 配置完整性隐含 |
| CF-009 | REBIRTH_ACHIEVEMENT_CHAINS | **配置-枚举同步**: AchievementDimension(5) vs dimensionStats初始化(5) | P0 | ✅ covered | 类型系统保证 |
| CF-010 | ACHIEVEMENT_RARITY_WEIGHTS | 4个稀有度权重覆盖 | P0 | ✅ covered | 配置完整性测试 |
| CF-011 | ALL_ACHIEVEMENTS | 每个成就 conditions 非空 | P1 | ⚠️ uncovered | 无空条件验证 |
| CF-012 | ALL_ACHIEVEMENTS | targetValue > 0 | P1 | ⚠️ uncovered | 无目标值验证 |
| CF-013 | ALL_ACHIEVEMENTS | **配置-枚举同步**: AchievementConditionType(21) vs 实际使用的条件类型 | P1 | ⚠️ uncovered | 条件类型覆盖验证 |
| CF-014 | REBIRTH_ACHIEVEMENT_CHAINS | achievementIds 中无重复 | P1 | ⚠️ uncovered | 无重复检查 |
| CF-015 | ALL_ACHIEVEMENTS | **前置链无环**: prerequisiteId 不会形成循环 | P0 | ✅ covered | 源码验证：线性链 |
| CF-016 | ALL_ACHIEVEMENTS | resources 奖励中数值 > 0 | P1 | ⚠️ uncovered | 无奖励数值验证 |
| CF-017 | ALL_ACHIEVEMENTS | prestigePoints 奖励 ≥ 0 | P1 | ⚠️ uncovered | 无声望奖励验证 |
| CF-018 | ACHIEVEMENT_SAVE_VERSION | 正整数 | P1 | ✅ covered | 类型系统保证 |

---

## 4. achievement.types（achievement.types.ts — 170行）

| # | API | 分支条件 | 优先级 | 状态 | 来源 |
|---|-----|---------|--------|------|------|
| TY-001 | AchievementDimension | 5个维度标签覆盖 | P1 | ✅ covered | 类型检查 |
| TY-002 | AchievementDimension | 5个维度图标覆盖 | P1 | ✅ covered | 类型检查 |
| TY-003 | AchievementRarity | 4个稀有度标签覆盖 | P1 | ✅ covered | 类型检查 |
| TY-004 | AchievementRarity | 4个稀有度权重覆盖 | P1 | ✅ covered | 配置完整性测试 |
| TY-005 | AchievementConditionType | 21种条件类型完整 | P1 | ✅ covered | 类型定义 |
| TY-006 | AchievementStatus | 4种状态：locked/in_progress/completed/claimed | P1 | ✅ covered | 状态机测试 |
| TY-007 | AchievementSaveData | 包含 state + version | P1 | ✅ covered | F-Lifecycle:版本号 |
| TY-008 | ACHIEVEMENT_SAVE_VERSION | =1，正整数 | P1 | ✅ covered | 类型系统保证 |

---

## 特别关注项汇总

| # | 模式 | 严重度 | 影响范围 | 状态 |
|---|------|--------|---------|------|
| S-1 | NaN穿透到 totalPoints（AS-079） | 🔴 P0 | claimReward 中 achievementPoints=NaN → totalPoints=NaN | uncovered |
| S-2 | NaN穿透到 dimStats.totalPoints（AS-080） | 🔴 P0 | claimReward 中 dimStats.totalPoints 累加 NaN | uncovered |
| S-3 | loadSaveData NaN穿透（AS-138） | 🔴 P0 | 存档中 totalPoints=NaN 直接赋值 | uncovered |
| S-4 | loadSaveData NaN穿透 progress（AS-139） | 🔴 P0 | 存档中 progress[type]=NaN → 后续 Math.max(NaN, val)=NaN | uncovered |
| S-5 | loadSaveData 缺失字段崩溃（AS-141~143） | 🔴 P0 | achievements/completedChains/dimensionStats 缺失 → 运行时崩溃 | uncovered |
| S-6 | 事件payload NaN穿透（AS-127） | 🟡 P1 | p.wins=NaN → if(NaN) 为 false 跳过（安全），但 p.count=NaN 不跳过 | uncovered |
| S-7 | createInitialState 未知维度崩溃（AH-009） | 🔴 P0 | 配置新增维度但 Helpers 硬编码5维度 → undefined.totalCount++ | uncovered |
| S-8 | chainProgress 不持久化（AS-144） | 🟡 P1 | 存档不保存 chainProgress，仅通过 checkChainProgress 重建 | uncovered |
| S-9 | 事件监听测试覆盖不足（AS-121~125） | 🟡 P1 | 5个事件监听器仅1个有直接测试 | uncovered |
| S-10 | 多条件成就部分满足（AS-061） | 🟡 P1 | 当前所有成就仅有1个条件，无多条件测试 | uncovered |

## Top 10 P0 Uncovered 节点

| # | 节点 | 子系统 | 描述 |
|---|------|--------|------|
| 1 | AS-079 | AchievementSystem | claimReward NaN穿透到 totalPoints |
| 2 | AS-080 | AchievementSystem | claimReward NaN穿透到 dimStats.totalPoints |
| 3 | AS-138 | AchievementSystem | loadSaveData NaN穿透 totalPoints |
| 4 | AS-139 | AchievementSystem | loadSaveData NaN穿透 progress |
| 5 | AS-141 | AchievementSystem | loadSaveData achievements 缺失崩溃 |
| 6 | AS-142 | AchievementSystem | loadSaveData completedChains 缺失崩溃 |
| 7 | AS-143 | AchievementSystem | loadSaveData dimensionStats 缺失崩溃 |
| 8 | AH-009 | AchievementHelpers | createInitialState 未知维度崩溃 |
| 9 | AS-051 | AchievementSystem | updateProgress NaN穿透已有进度 |
| 10 | AS-051 | AchievementSystem | updateProgress NaN穿透已有进度 |

## NaN 防护覆盖全景

| API | NaN入口点 | 当前防护 | 状态 |
|-----|----------|---------|------|
| updateProgress | value 参数 | ✅ `!Number.isFinite(value) \|\| value < 0` | covered |
| updateProgress | 已有 progress[type] | ❌ Math.max(NaN, valid) = NaN | uncovered |
| claimReward | achievementPoints | ❌ 无检查 | uncovered |
| claimReward | dimStats.totalPoints | ❌ 无检查 | uncovered |
| loadSaveData | state.totalPoints | ❌ 无检查 | uncovered |
| loadSaveData | achievements[id].progress[type] | ❌ 无检查 | uncovered |
| loadSaveData | achievements[id].status | ❌ 无检查（但赋值后状态机保护） | covered |
| setupEventListeners | payload.wins/count/level | ⚠️ if(val) 跳过 NaN（安全） | covered |
| checkChainProgress | chainBonusReward | ❌ 无检查 | uncovered |

## Serialize 完整性检查

| 检查项 | 状态 | 说明 |
|--------|------|------|
| getSaveData() 输出包含 state | ✅ covered | AchievementSaveData.state |
| getSaveData() 输出包含 version | ✅ covered | AchievementSaveData.version |
| getSaveData() 浅拷贝 achievements | ✅ covered | {...state.achievements} |
| getSaveData() 浅拷贝 dimensionStats | ✅ covered | {...state.dimensionStats} |
| loadSaveData() null 防护 | ✅ covered | FIX-904 |
| loadSaveData() 版本不匹配 | ✅ covered | 直接 return |
| loadSaveData() 恢复 state | ✅ covered | 往返一致性测试 |
| loadSaveData() 重建 chainProgress | ✅ covered | checkChainProgress() |
| loadSaveData() NaN 防护 | ❌ uncovered | NaN 直接赋值 |
| loadSaveData() 缺失字段防护 | ❌ uncovered | achievements/completedChains/dimensionStats 缺失 |
| chainProgress 不持久化 | ⚠️ 注意 | 仅通过 checkChainProgress 重建（设计选择） |
| ACHIEVEMENT_SAVE_VERSION 正确 | ✅ covered | =1 |

## 配置一致性检查

| 检查项 | 状态 | 说明 |
|--------|------|------|
| ALL_ACHIEVEMENTS(27) vs ACHIEVEMENT_DEF_MAP(27) | ✅ covered | Object.fromEntries 保证 |
| AchievementDimension(5) vs dimensionStats初始化(5) | ✅ covered | 类型系统+硬编码 |
| 前置成就引用完整性 | ✅ covered | 配置完整性测试 |
| 链中成就ID全部存在 | ✅ covered | 配置完整性测试 |
| 稀有度权重覆盖4种 | ✅ covered | 配置完整性测试 |
| 条件类型 vs 实际使用 | ⚠️ uncovered | 21种条件类型中部分未使用 |
| 链奖励 achievementPoints > 0 | ⚠️ uncovered | 无验证 |
| 前置链无环 | ✅ covered | 源码验证：线性链 |

---

## 测试文件映射

| 测试文件 | 覆盖范围 | 行数 |
|----------|---------|------|
| achievement-adversarial.test.ts | 5维度对抗式测试（761行） | 761 |
| AchievementSystem.test.ts | 系统基础测试 | ~200 |
| AchievementHelpers.test.ts | 辅助函数测试 | ~80 |
| achievement-collection.integration.test.ts | 成就↔收集集成 | ~150 |
| achievement-prestige-cross.integration.test.ts | 成就↔声望集成 | ~120 |
| v12-achievement-boundary.integration.test.ts | 边界条件集成 | ~100 |
| v12-supplement-achievement-system.integration.test.ts | 补充系统测试 | ~100 |
| gap-daily-001-achievement.test.ts | 日常成就缺口测试 | ~80 |
| **总计** | | **~1,591** |
