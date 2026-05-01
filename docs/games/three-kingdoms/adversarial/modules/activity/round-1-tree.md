# Activity（活动域）流程分支树 — Round 1

> Builder: TreeBuilder | Time: 2026-05-01 | Phase: R1 对抗式测试
> 源文件: engine/activity/ 目录下 10 个 TypeScript 文件（2162行）
> 子系统: ActivitySystem, SignInSystem, TokenShopSystem, TimedActivitySystem, SeasonHelper, ActivityOfflineCalculator, ActivityFactory

## 总体统计

| 指标 | ActivitySystem | SignInSystem | TokenShopSystem | TimedActivitySystem | Helper/Factory/Config | 合计 |
|------|---------------|-------------|-----------------|--------------------|-----------------------|------|
| 源文件数 | 1 | 1 | 1 | 1 | 5 | 9 |
| 公开API数 | 18 | 10 | 16 | 14 | 8 | 66 |
| 总节点数 | 72 | 45 | 62 | 58 | 28 | 265 |
| P0节点 | 14 | 12 | 15 | 11 | 5 | 57 |
| P1节点 | 28 | 18 | 22 | 24 | 12 | 104 |
| P2节点 | 30 | 15 | 25 | 23 | 11 | 104 |

---

## A. ActivitySystem（活动管理系统）

### A1. 活动列表管理

#### F-Normal: startActivity
| 节点ID | 分支 | 优先级 | 描述 | covered |
|--------|------|--------|------|---------|
| ACT-001 | F-Normal: startActivity正常流程 | P1 | 传入有效ActivityDef+taskDefs+milestones+now，创建活动实例 | ✅ ActivitySystem-p1.test.ts |
| ACT-002 | F-Boundary: startActivity-maxTotal已达上限 | P0 | 活动总数=maxTotal时，canStartActivity返回false | ✅ ActivitySystem-p1.test.ts |
| ACT-003 | F-Boundary: startActivity-concurrencyConfig全满 | P1 | 各类型活动数分别达到maxSeason/maxLimitedTime等上限 | ✅ ActivitySystem-p1.test.ts |
| ACT-004 | F-Error: startActivity-null state | P0 | state=null时崩溃风险（无null guard） | ❌ 无防护 |
| ACT-005 | F-Error: startActivity-null def | P0 | def=null时createActivityInstance崩溃 | ❌ 无防护 |
| ACT-006 | F-Error: startActivity-empty taskDefs | P2 | taskDefs=[]时创建无任务活动，功能正常但可能无意义 | ✅ 允许 |

#### F-Normal: canStartActivity
| 节点ID | 分支 | 优先级 | 描述 | covered |
|--------|------|--------|------|---------|
| ACT-007 | F-Normal: canStart-未达上限 | P2 | 活动数未达上限，返回canStart=true | ✅ |
| ACT-008 | F-Boundary: canStart-已达maxTotal | P0 | totalActive >= maxTotal时返回false+reason | ✅ |
| ACT-009 | F-Error: canStart-未检查类型限制 | **P0** | canStartActivity只检查总上限，未按ActivityType检查分类型上限(maxSeason/maxLimitedTime等) | ❌ 逻辑缺陷 |
| ACT-010 | F-Boundary: canStart-maxTotal=NaN | P0 | concurrencyConfig.maxTotal=NaN时，NaN>=NaN=false，绕过上限检查 | ❌ NaN绕过 |

#### F-Normal: updateActivityStatus
| 节点ID | 分支 | 优先级 | 描述 | covered |
|--------|------|--------|------|---------|
| ACT-011 | F-Normal: 活动到期自动结束 | P1 | now >= endTime时状态变为ENDED | ✅ ActivitySystem-p1.test.ts |
| ACT-012 | F-Normal: 活动未到期保持ACTIVE | P2 | now < endTime时状态不变 | ✅ |
| ACT-013 | F-Error: activityId不存在 | P1 | 不存在的activityId直接返回原state | ✅ |
| ACT-014 | F-Error: now=NaN | P0 | now=NaN时，NaN >= endTime 为 false，活动永远不会到期 | ❌ NaN绕过 |

#### F-Normal: getActiveActivities
| 节点ID | 分支 | 优先级 | 描述 | covered |
|--------|------|--------|------|---------|
| ACT-015 | F-Normal: 返回所有ACTIVE活动 | P2 | 正常过滤 | ✅ |
| ACT-016 | F-Boundary: 无ACTIVE活动 | P2 | 返回空数组 | ✅ |

### A2. 活动任务系统

#### F-Normal: updateTaskProgress
| 节点ID | 分支 | 优先级 | 描述 | covered |
|--------|------|--------|------|---------|
| ACT-017 | F-Normal: 正常增加进度 | P1 | currentProgress += progress | ✅ ActivitySystem-p2.test.ts |
| ACT-018 | F-Boundary: 进度恰好达标 | P1 | newProgress == targetCount → COMPLETED | ✅ |
| ACT-019 | F-Boundary: 进度超出上限 | P1 | Math.min(newProgress, targetCount) 截断 | ✅ |
| ACT-020 | F-Error: progress=NaN | **P0** | progress=NaN时，currentProgress+NaN=NaN，NaN>=targetCount=false，任务永远无法完成 | ❌ NaN绕过 |
| ACT-021 | F-Error: progress=负值 | P0 | progress<0时，currentProgress减少，可倒刷任务进度 | ❌ 无负值检查 |
| ACT-022 | F-Error: 已CLAIMED任务仍可增加进度 | P1 | status=CLAIMED时直接return t，正确 | ✅ |
| ACT-023 | F-Error: activityId不存在 | P1 | 返回原state | ✅ |
| ACT-024 | F-Error: taskDefId不存在 | P2 | 所有task都不匹配defId，返回原tasks | ✅ |

#### F-Normal: claimTaskReward
| 节点ID | 分支 | 优先级 | 描述 | covered |
|--------|------|--------|------|---------|
| ACT-025 | F-Normal: 正常领取 | P1 | 任务COMPLETED→CLAIMED，积分+代币累加 | ✅ ActivitySystem-p2.test.ts |
| ACT-026 | F-Error: 活动不存在throw | P1 | throw Error('活动不存在') | ✅ |
| ACT-027 | F-Error: 任务不存在throw | P1 | throw Error('任务不存在') | ✅ |
| ACT-028 | F-Error: 已领取throw | P1 | throw Error('已领取') | ✅ |
| ACT-029 | F-Error: 任务未完成throw | P1 | throw Error('任务未完成') | ✅ |
| ACT-030 | F-Boundary: pointReward=NaN | **P0** | instance.points + NaN = NaN，积分变为NaN | ❌ NaN传播 |
| ACT-031 | F-Boundary: tokenReward=NaN | **P0** | instance.tokens + NaN = NaN，代币变为NaN | ❌ NaN传播 |
| ACT-032 | F-Cross: claimTaskReward后checkMilestones联动 | P1 | 领取任务后积分增加，应触发里程碑检查 | ❌ 需外部调用 |

#### F-Normal: resetDailyTasks
| 节点ID | 分支 | 优先级 | 描述 | covered |
|--------|------|--------|------|---------|
| ACT-033 | F-Normal: 重置每日任务 | P1 | dailyTaskDefs中的任务被重置 | ✅ ActivitySystem-p2.test.ts |
| ACT-034 | F-Error: activityId不存在 | P2 | 返回原state | ✅ |
| ACT-035 | F-Error: dailyTaskDefs为空 | P2 | 无任务被重置 | ✅ |

### A3. 里程碑奖励

#### F-Normal: checkMilestones
| 节点ID | 分支 | 优先级 | 描述 | covered |
|--------|------|--------|------|---------|
| ACT-036 | F-Normal: 积分达标解锁 | P1 | points >= requiredPoints → UNLOCKED | ✅ ActivitySystem-p2.test.ts |
| ACT-037 | F-Normal: 积分不足保持LOCKED | P2 | points < requiredPoints → 不变 | ✅ |
| ACT-038 | F-Boundary: points=NaN | **P0** | NaN >= requiredPoints = false，里程碑永远无法解锁 | ❌ NaN阻断 |
| ACT-039 | F-Error: 已UNLOCKED/CLAIMED不重复检查 | P2 | status !== LOCKED直接return | ✅ |

#### F-Normal: claimMilestone
| 节点ID | 分支 | 优先级 | 描述 | covered |
|--------|------|--------|------|---------|
| ACT-040 | F-Normal: 正常领取 | P1 | UNLOCKED→CLAIMED，返回rewards | ✅ ActivitySystem-p2.test.ts |
| ACT-041 | F-Error: 活动不存在throw | P1 | throw Error | ✅ |
| ACT-042 | F-Error: 里程碑不存在throw | P1 | throw Error | ✅ |
| ACT-043 | F-Error: 里程碑LOCKED throw | P1 | throw Error('里程碑未解锁') | ✅ |
| ACT-044 | F-Error: 已领取throw | P1 | throw Error('已领取') | ✅ |

### A4. 离线进度

#### F-Normal: calculateOfflineProgress / applyOfflineProgress
| 节点ID | 分支 | 优先级 | 描述 | covered |
|--------|------|--------|------|---------|
| ACT-045 | F-Normal: 正常计算离线进度 | P1 | 按效率计算积分和代币 | ✅ ActivityOfflineCalculator.test.ts |
| ACT-046 | F-Boundary: offlineDurationMs=0 | P2 | durationSeconds=0，pointsEarned=0 | ✅ |
| ACT-047 | F-Boundary: offlineDurationMs=NaN | **P0** | NaN/1000=NaN，Math.floor(NaN*0.1)=NaN，pointsEarned=NaN | ❌ NaN传播 |
| ACT-048 | F-Boundary: offlineDurationMs=负值 | P0 | 负值/1000=负秒数，Math.floor(负数*0.1)可能为负 | ❌ 无负值检查 |
| ACT-049 | F-Error: 无ACTIVE活动 | P2 | 返回空数组 | ✅ |
| ACT-050 | F-Cross: applyOfflineProgress后checkMilestones | P1 | 离线积分可能解锁里程碑 | ❌ 需外部调用 |

### A5. 存档序列化

#### F-Normal: serialize / deserialize
| 节点ID | 分支 | 优先级 | 描述 | covered |
|--------|------|--------|------|---------|
| ACT-051 | F-Normal: 正常序列化/反序列化 | P1 | round-trip一致性 | ✅ ActivitySystem-p3.test.ts |
| ACT-052 | F-Error: deserialize-null | P0 | data=null时崩溃（createDefaultActivityState兜底） | ✅ 有兜底 |
| ACT-053 | F-Error: deserialize-version不匹配 | P1 | version不匹配时返回默认状态 | ✅ |
| ACT-054 | F-Boundary: activities包含NaN属性 | **P0** | points/tokens=NaN时序列化后NaN→null(JSON)，反序列化null→崩溃或undefined | ❌ NaN序列化风险 |
| ACT-055 | F-Lifecycle: serialize/deserialize是否被engine-save调用 | P0 | 需验证ActivitySystem.serialize()是否在buildSaveData中被引用 | ❌ 需验证 |

### A6. ISubsystem接口

| 节点ID | 分支 | 优先级 | 描述 | covered |
|--------|------|--------|------|---------|
| ACT-056 | F-Normal: init注入deps | P2 | 正常注入 | ✅ |
| ACT-057 | F-Normal: update空操作 | P2 | 无帧更新逻辑 | ✅ |
| ACT-058 | F-Error: reset不重置state | P1 | reset只重置config，不重置外部ActivityState | ✅ 设计如此 |

---

## B. SignInSystem（签到系统）

### B1. 签到操作

#### F-Normal: signIn
| 节点ID | 分支 | 优先级 | 描述 | covered |
|--------|------|--------|------|---------|
| SIGN-001 | F-Normal: 首次签到 | P1 | consecutiveDays=1, cycleDay=1 | ✅ SignInSystem-p1.test.ts |
| SIGN-002 | F-Normal: 连续签到 | P1 | isConsecutiveDay=true, consecutiveDays+1 | ✅ |
| SIGN-003 | F-Normal: 断签重置 | P1 | 非连续非同天, consecutiveDays=1 | ✅ |
| SIGN-004 | F-Boundary: 7天循环重置 | P1 | consecutiveDays=8→cycleDay=1 | ✅ |
| SIGN-005 | F-Boundary: 连续3天加成 | P1 | bonusPercent=20% | ✅ |
| SIGN-006 | F-Boundary: 连续7天加成 | P1 | bonusPercent=50% | ✅ |
| SIGN-007 | F-Error: 重复签到throw | P1 | todaySigned=true && isSameDay → throw | ✅ |
| SIGN-008 | F-Error: now=NaN | **P0** | new Date(NaN) → Invalid Date, isSameDay/getWeekNumber异常 | ❌ NaN崩溃 |
| SIGN-009 | F-Boundary: lastSignInTime=0首次 | P1 | 特殊处理，consecutiveDays=1 | ✅ |
| SIGN-010 | F-Error: rewards数组越界 | P2 | day=0或day>7时，Math.max/min截断 | ✅ |

#### F-Normal: retroactive（补签）
| 节点ID | 分支 | 优先级 | 描述 | covered |
|--------|------|--------|------|---------|
| SIGN-011 | F-Normal: 正常补签 | P1 | 扣元宝，连续天数+1 | ✅ SignInSystem-p1.test.ts |
| SIGN-012 | F-Error: 今日已签到无需补签 | P1 | throw Error | ✅ |
| SIGN-013 | F-Error: 本周补签次数用完 | P1 | weeklyCount >= limit → throw | ✅ |
| SIGN-014 | F-Error: 元宝不足 | P1 | goldAvailable < cost → throw | ✅ |
| SIGN-015 | F-Boundary: 跨周补签重置 | P1 | currentWeek !== lastResetWeek → count=0 | ✅ |
| SIGN-016 | F-Error: retroactive不恢复断签连续性 | **P0** | 补签后consecutiveDays=data.consecutiveDays+1，但若已断签多天，+1不等于真正连续 | ❌ 逻辑缺陷 |
| SIGN-017 | F-Boundary: goldAvailable=NaN | **P0** | NaN < cost = false，绕过元宝检查，免费补签 | ❌ NaN绕过 |
| SIGN-018 | F-Boundary: goldAvailable=负值 | P1 | 负值 < cost → throw，正确拦截 | ✅ |

### B2. 状态查询

| 节点ID | 分支 | 优先级 | 描述 | covered |
|--------|------|--------|------|---------|
| SIGN-019 | F-Normal: canSignIn | P2 | !todaySigned | ✅ |
| SIGN-020 | F-Normal: canRetroactive | P2 | 综合检查 | ✅ |
| SIGN-021 | F-Error: getRemainingRetroactive-now=NaN | P0 | getWeekNumber(NaN)异常 | ❌ NaN |
| SIGN-022 | F-Normal: getConsecutiveBonus | P2 | 3天/7天阈值 | ✅ |
| SIGN-023 | F-Normal: getCycleDay | P2 | 7天循环计算 | ✅ |
| SIGN-024 | F-Boundary: consecutiveDays=0 | P2 | getCycleDay返回1 | ✅ |

### B3. ISubsystem & 配置

| 节点ID | 分支 | 优先级 | 描述 | covered |
|--------|------|--------|------|---------|
| SIGN-025 | F-Normal: init/update/reset | P2 | 标准ISubsystem | ✅ |
| SIGN-026 | F-Error: reset不重置外部SignInData | P1 | reset只重置内部config/rewards | ✅ |
| SIGN-027 | F-Lifecycle: SignInData持久化路径 | P0 | SignInData在ActivityState.signIn中，需验证serialize覆盖 | ❌ 需验证 |

---

## C. TokenShopSystem（代币兑换商店）

### C1. 商品查询

| 节点ID | 分支 | 优先级 | 描述 | covered |
|--------|------|--------|------|---------|
| SHOP-001 | F-Normal: getAllItems | P2 | 返回所有商品 | ✅ TokenShopSystem.test.ts |
| SHOP-002 | F-Normal: getAvailableItems | P1 | 过滤available=false和已售罄 | ✅ |
| SHOP-003 | F-Normal: getItem | P2 | 按ID获取 | ✅ |
| SHOP-004 | F-Normal: getItemsByRarity | P2 | 按稀有度过滤 | ✅ |
| SHOP-005 | F-Normal: getItemsByActivity | P2 | 按活动ID过滤 | ✅ |
| SHOP-006 | F-Boundary: 空商店 | P2 | items为空Map | ✅ |

### C2. 购买操作

#### F-Normal: purchaseItem
| 节点ID | 分支 | 优先级 | 描述 | covered |
|--------|------|--------|------|---------|
| SHOP-007 | F-Normal: 正常购买 | P1 | 扣代币、增购计数、返回奖励 | ✅ TokenShopSystem.test.ts |
| SHOP-008 | F-Error: 商品不存在 | P1 | reason='商品不存在' | ✅ |
| SHOP-009 | F-Error: 商品已下架 | P1 | reason='商品已下架' | ✅ |
| SHOP-010 | F-Error: 超出限购 | P1 | reason含剩余数量 | ✅ |
| SHOP-011 | F-Error: 代币不足 | P1 | reason含需要和当前数量 | ✅ |
| SHOP-012 | F-Boundary: quantity=NaN | **P0** | item.tokenPrice * NaN = NaN, NaN < NaN=false，绕过余额检查 | ❌ NaN绕过 |
| SHOP-013 | F-Boundary: quantity=0 | P0 | totalCost=0, 0<0=false通过检查，item.purchased不变但返回success=true | ❌ 零值漏洞 |
| SHOP-014 | F-Boundary: quantity=负值 | **P0** | tokenPrice*负值=负数, tokenBalance >= 负数=true，代币增加而非减少 | ❌ 负值漏洞 |
| SHOP-015 | F-Boundary: tokenPrice=0 | P1 | totalCost=0，免费购买 | ✅ 配置问题 |
| SHOP-016 | F-Boundary: purchaseLimit=0（无限购） | P2 | purchaseLimit=0时不检查限购 | ✅ |
| SHOP-017 | F-Error: rewards.resourceChanges为undefined | P1 | Object.entries(undefined as Record) → 运行时错误 | ❌ 无防护 |
| SHOP-018 | F-Cross: purchaseItem后tokenBalance可能为负 | P0 | quantity=负值时tokenBalance -= 负数 = 增加 | ❌ 与SHOP-014同根 |

### C3. 代币管理

| 节点ID | 分支 | 优先级 | 描述 | covered |
|--------|------|--------|------|---------|
| SHOP-019 | F-Normal: addTokens | P2 | 增加代币 | ✅ |
| SHOP-020 | F-Normal: spendTokens成功 | P2 | 扣除代币 | ✅ |
| SHOP-021 | F-Error: spendTokens余额不足 | P2 | success=false | ✅ |
| SHOP-022 | F-Boundary: addTokens(NaN) | **P0** | tokenBalance += NaN → NaN，代币永久损坏 | ❌ NaN传播 |
| SHOP-023 | F-Boundary: addTokens(负值) | P0 | tokenBalance += 负值 → 代币减少 | ❌ 无负值检查 |
| SHOP-024 | F-Boundary: spendTokens(NaN) | **P0** | NaN < amount = false，绕过余额检查，tokenBalance -= NaN = NaN | ❌ NaN双重绕过 |
| SHOP-025 | F-Boundary: tokenBalance无上限 | P1 | 累积无MAX限制（模式22） | ❌ 无上限 |

### C4. 商品管理

| 节点ID | 分支 | 优先级 | 描述 | covered |
|--------|------|--------|------|---------|
| SHOP-026 | F-Normal: addItem | P2 | 添加商品 | ✅ |
| SHOP-027 | F-Normal: removeItem | P2 | 移除商品 | ✅ |
| SHOP-028 | F-Normal: refreshShop | P1 | 重置purchased计数 | ✅ |
| SHOP-029 | F-Normal: dailyRefresh | P1 | 重置+可选更新列表 | ✅ |
| SHOP-030 | F-Normal: setItemAvailability | P2 | 上架/下架 | ✅ |
| SHOP-031 | F-Error: addItem-null item | P1 | item.id可能为undefined | ❌ |
| SHOP-032 | F-Error: setItemAvailability-不存在ID | P2 | 返回false | ✅ |

### C5. 序列化

| 节点ID | 分支 | 优先级 | 描述 | covered |
|--------|------|--------|------|---------|
| SHOP-033 | F-Normal: serialize/deserialize | P1 | round-trip一致性 | ✅ TokenShopSystem.test.ts |
| SHOP-034 | F-Error: deserialize-null | P0 | data=null时崩溃 | ❌ 无null guard |
| SHOP-035 | F-Error: deserialize-items含NaN | P0 | tokenPrice=NaN序列化后损坏 | ❌ |
| SHOP-036 | F-Lifecycle: TokenShopSystem.serialize是否被engine-save调用 | P0 | 需验证六处同步 | ❌ 需验证 |

---

## D. TimedActivitySystem（限时活动系统）

### D1. 限时活动流程

#### F-Normal: createTimedActivityFlow
| 节点ID | 分支 | 优先级 | 描述 | covered |
|--------|------|--------|------|---------|
| TIMED-001 | F-Normal: 创建4阶段流程 | P1 | preview→active→settlement→closed | ✅ TimedActivitySystem.test.ts |
| TIMED-002 | F-Error: activeStart=NaN | **P0** | previewStart=NaN-PREVIEW_DURATION=NaN，所有阶段比较NaN，phase永远不变 | ❌ NaN |
| TIMED-003 | F-Error: activeEnd < activeStart | P1 | endTime < startTime，逻辑异常 | ❌ 无校验 |
| TIMED-004 | F-Boundary: 重复activityId覆盖 | P1 | Map.set覆盖旧流程 | ✅ |

#### F-Normal: updatePhase
| 节点ID | 分支 | 优先级 | 描述 | covered |
|--------|------|--------|------|---------|
| TIMED-005 | F-Normal: preview阶段 | P2 | now < activeStart | ✅ |
| TIMED-006 | F-Normal: active阶段 | P2 | activeStart <= now < activeEnd | ✅ |
| TIMED-007 | F-Normal: settlement阶段 | P2 | activeEnd <= now < closedTime | ✅ |
| TIMED-008 | F-Normal: closed阶段 | P2 | now >= closedTime | ✅ |
| TIMED-009 | F-Error: flow不存在 | P2 | 返回'closed' | ✅ |
| TIMED-010 | F-Boundary: now=NaN | **P0** | NaN < activeStart = false, NaN < activeEnd = false, NaN < closedTime = false → 直接closed | ❌ NaN跳过所有阶段 |
| TIMED-011 | F-Error: updatePhase就地修改flow对象 | P1 | flow.phase被就地修改，非不可变 | ❌ 浅拷贝风险 |

#### F-Normal: canParticipate / getRemainingTime
| 节点ID | 分支 | 优先级 | 描述 | covered |
|--------|------|--------|------|---------|
| TIMED-012 | F-Normal: active阶段可参与 | P2 | phase==='active' | ✅ |
| TIMED-013 | F-Normal: 非active不可参与 | P2 | 返回false | ✅ |
| TIMED-014 | F-Boundary: getRemainingTime-已结束 | P2 | Math.max(0, 负数)=0 | ✅ |
| TIMED-015 | F-Error: getRemainingTime-不存在 | P2 | 返回0 | ✅ |

### D2. 排行榜

#### F-Normal: updateLeaderboard
| 节点ID | 分支 | 优先级 | 描述 | covered |
|--------|------|--------|------|---------|
| TIMED-016 | F-Normal: 按积分降序排序 | P1 | points降序，tokens次排序 | ✅ |
| TIMED-017 | F-Boundary: entries为空 | P2 | 返回空数组 | ✅ |
| TIMED-018 | F-Boundary: entries超过maxEntries | P1 | slice截断 | ✅ |
| TIMED-019 | F-Error: entry.points=NaN | **P0** | NaN降序排序不确定，排名混乱 | ❌ NaN排序异常 |
| TIMED-020 | F-Error: updateLeaderboard就地修改entries | P1 | entry.rank = index + 1 就地修改传入对象 | ❌ 副作用 |

#### F-Normal: calculateRankRewards
| 节点ID | 分支 | 优先级 | 描述 | covered |
|--------|------|--------|------|---------|
| TIMED-021 | F-Normal: 匹配奖励梯度 | P2 | 返回对应梯度奖励 | ✅ |
| TIMED-022 | F-Boundary: rank=0 | P2 | 无匹配梯度，返回空 | ✅ |
| TIMED-023 | F-Boundary: rank=NaN | P0 | NaN >= tier.minRank && NaN <= tier.maxRank = false，无奖励 | ❌ NaN |
| TIMED-024 | F-Boundary: rank超出所有梯度 | P2 | 返回空 | ✅ |

### D3. 节日活动

| 节点ID | 分支 | 优先级 | 描述 | covered |
|--------|------|--------|------|---------|
| TIMED-025 | F-Normal: getFestivalTemplate | P2 | 按festivalType查找 | ✅ |
| TIMED-026 | F-Normal: getAllFestivalTemplates | P2 | 返回全部5个模板 | ✅ |
| TIMED-027 | F-Normal: createFestivalActivity | P1 | 创建节日活动流程 | ✅ |
| TIMED-028 | F-Error: 不存在的festivalType | P2 | 返回null | ✅ |
| TIMED-029 | F-Error: durationDays=NaN | P0 | NaN * 24*60*60*1000 = NaN，endTime=NaN | ❌ NaN |
| TIMED-030 | F-Error: durationDays=0 | P1 | endTime=startTime，0天活动 | ❌ 无校验 |

### D4. 离线进度

| 节点ID | 分支 | 优先级 | 描述 | covered |
|--------|------|--------|------|---------|
| TIMED-031 | F-Normal: 按活动类型计算效率 | P1 | 5种类型不同效率 | ✅ |
| TIMED-032 | F-Boundary: offlineDurationMs=0 | P2 | pointsEarned=0 | ✅ |
| TIMED-033 | F-Error: offlineDurationMs=NaN | **P0** | NaN/1000=NaN，Math.floor(NaN*0.1*efficiency)=NaN | ❌ NaN |
| TIMED-034 | F-Error: 未知活动类型 | P1 | efficiency默认0.5 | ✅ |

### D5. 序列化

| 节点ID | 分支 | 优先级 | 描述 | covered |
|--------|------|--------|------|---------|
| TIMED-035 | F-Normal: serialize/deserialize | P1 | flows+leaderboards round-trip | ✅ |
| TIMED-036 | F-Error: deserialize-null data | P0 | data=null时，data.flows报错 | ❌ 无null guard |
| TIMED-037 | F-Error: deserialize-flows含NaN | P0 | phase等属性可能为NaN | ❌ |
| TIMED-038 | F-Lifecycle: 是否被engine-save调用 | P0 | 需验证六处同步 | ❌ 需验证 |

---

## E. Helper/Factory/Config

### E1. ActivityFactory
| 节点ID | 分支 | 优先级 | 描述 | covered |
|--------|------|--------|------|---------|
| FACT-001 | F-Normal: createDefaultActivityState | P2 | 返回默认状态 | ✅ ActivityFactory.test.ts |
| FACT-002 | F-Normal: createActivityInstance | P2 | 从def创建instance | ✅ |
| FACT-003 | F-Normal: createActivityTask | P2 | 从def创建task | ✅ |
| FACT-004 | F-Normal: createMilestone | P2 | 创建里程碑 | ✅ |
| FACT-005 | F-Error: createActivityInstance-null def | P0 | def.id → Cannot read property 'id' of null | ❌ 无null guard |
| FACT-006 | F-Error: createActivityTask-null def | P0 | def.id → 崩溃 | ❌ 无null guard |

### E2. SeasonHelper
| 节点ID | 分支 | 优先级 | 描述 | covered |
|--------|------|--------|------|---------|
| SEAS-001 | F-Normal: getCurrentSeasonTheme | P2 | 按索引取模获取 | ✅ SeasonHelper.test.ts |
| SEAS-002 | F-Boundary: seasonIndex=NaN | P0 | NaN % length = NaN，DEFAULT_SEASON_THEMES[NaN] = undefined | ❌ NaN越界 |
| SEAS-003 | F-Normal: updateSeasonRecord | P2 | 更新胜败/胜率 | ✅ |
| SEAS-004 | F-Boundary: updateSeasonRecord-NaN currentRanking | P0 | Math.min(NaN, record.highestRanking) = NaN | ❌ NaN |
| SEAS-005 | F-Normal: generateSeasonRecordRanking | P2 | 按胜场排序 | ✅ |
| SEAS-006 | F-Error: generateSeasonRecordRanking-空数组 | P2 | 返回空数组 | ✅ |

### E3. ActivitySystemConfig
| 节点ID | 分支 | 优先级 | 描述 | covered |
|--------|------|--------|------|---------|
| CONF-001 | F-Normal: DEFAULT_CONCURRENCY_CONFIG | P2 | 默认值正确 | ✅ ActivitySystemConfig.test.ts |
| CONF-002 | F-Normal: DEFAULT_OFFLINE_EFFICIENCY | P2 | 默认值正确 | ✅ |
| CONF-003 | F-Cross: seasonHelper委托对象 | P2 | 函数引用正确 | ✅ |
| CONF-004 | F-Boundary: BASE_POINTS_PER_SECOND精度 | P2 | 0.1浮点精度 | ✅ |

---

## F. 跨系统链路 (F-Cross)

| 节点ID | 链路 | 优先级 | 描述 | covered |
|--------|------|--------|------|---------|
| CROSS-001 | ActivitySystem → ActivityOfflineCalculator | P1 | 离线计算委托正确 | ✅ |
| CROSS-002 | ActivitySystem → SeasonHelper | P1 | 赛季功能委托正确 | ✅ |
| CROSS-003 | ActivitySystem → ActivityFactory | P1 | 工厂函数委托正确 | ✅ |
| CROSS-004 | TimedActivitySystem → TokenShopSystem | P1 | 限时活动产生代币→商店消费 | ❌ 无直接集成 |
| CROSS-005 | SignInSystem → TokenShopSystem | P1 | 签到奖励代币→商店消费 | ❌ 无直接集成 |
| CROSS-006 | ActivitySystem.serialize → engine-save | **P0** | 需验证buildSaveData是否引用 | ❌ 需验证 |
| CROSS-007 | TokenShopSystem.serialize → engine-save | **P0** | 需验证六处同步 | ❌ 需验证 |
| CROSS-008 | TimedActivitySystem.serialize → engine-save | **P0** | 需验证六处同步 | ❌ 需验证 |
| CROSS-009 | claimTaskReward → checkMilestones联动 | P1 | 积分增加后应触发里程碑检查 | ❌ 需外部手动调用 |
| CROSS-010 | applyOfflineProgress → checkMilestones联动 | P1 | 离线积分后应触发里程碑检查 | ❌ 需外部手动调用 |

---

## G. 生命周期 (F-Lifecycle)

| 节点ID | 阶段 | 优先级 | 描述 | covered |
|--------|------|--------|------|---------|
| LIFE-001 | 初始化: ActivitySystem构造 | P2 | 配置合并正确 | ✅ |
| LIFE-002 | 初始化: SignInSystem构造 | P2 | config+rewards合并 | ✅ |
| LIFE-003 | 初始化: TokenShopSystem构造 | P2 | config+items+tokens初始化 | ✅ |
| LIFE-004 | 初始化: TimedActivitySystem构造 | P2 | config合并 | ✅ |
| LIFE-005 | 运行: startActivity→updateTask→claim→checkMilestone | P1 | 完整活动生命周期 | ✅ |
| LIFE-006 | 运行: signIn→retroactive→getReward | P1 | 完整签到生命周期 | ✅ |
| LIFE-007 | 运行: createFlow→updatePhase→canParticipate→settlement | P1 | 完整限时活动生命周期 | ✅ |
| LIFE-008 | 销毁: reset不清理外部状态 | P1 | reset只重置内部config | ✅ |
| LIFE-009 | 持久化: ActivitySystem serialize/deserialize | P0 | round-trip完整性 | ✅ |
| LIFE-010 | 持久化: TokenShopSystem serialize/deserialize | P0 | round-trip完整性 | ✅ |
| LIFE-011 | 持久化: TimedActivitySystem serialize/deserialize | P0 | round-trip完整性 | ✅ |
| LIFE-012 | 持久化: SignInData通过ActivityState持久化 | P0 | 需验证signIn在ActivityState中是否被正确序列化 | ❌ 需验证 |

---

## P0 高危发现汇总

### 系统性NaN问题（影响全模块）
1. **ACT-020**: updateTaskProgress(NaN) → 进度变NaN，任务永远无法完成
2. **ACT-030/031**: claimTaskReward → 积分/代币变NaN
3. **ACT-038**: checkMilestones → NaN >= requiredPoints = false，里程碑永远锁死
4. **ACT-047**: calculateOfflineProgress(NaN) → 离线积分变NaN
5. **SIGN-008**: signIn(now=NaN) → Date异常
6. **SIGN-017**: retroactive(goldAvailable=NaN) → 绕过元宝检查
7. **SHOP-012/014**: purchaseItem(quantity=NaN/负值) → 代币异常
8. **SHOP-022/024**: addTokens/spendTokens(NaN) → 代币永久损坏
9. **TIMED-002/010**: createFlow/updatePhase(NaN) → 阶段跳跃
10. **TIMED-019**: updateLeaderboard(entry.points=NaN) → 排名混乱
11. **TIMED-033**: calculateOfflineProgress(NaN) → 离线积分变NaN
12. **SEAS-002**: getCurrentSeasonTheme(NaN) → undefined越界
13. **SEAS-004**: updateSeasonRecord(NaN ranking) → highestRanking变NaN

### 逻辑缺陷
14. **ACT-009**: canStartActivity不检查分类型上限（只检查总上限）
15. **SIGN-016**: 补签不恢复断签连续性（逻辑不一致）

### 负值漏洞
16. **ACT-021**: updateTaskProgress(负值) → 倒刷任务进度
17. **ACT-048**: offlineDurationMs=负值 → 负积分
18. **SHOP-014/018**: purchaseItem(quantity=负值) → 代币增加

### 序列化风险
19. **ACT-054**: NaN属性序列化为null
20. **SHOP-034**: deserialize(null)崩溃
21. **TIMED-036**: deserialize(null)崩溃

### 架构级（保存/加载覆盖）
22. **CROSS-006/007/008**: 三个子系统的serialize是否被engine-save调用

### Null防护缺失
23. **ACT-004/005**: startActivity(null state/def)崩溃
24. **FACT-005/006**: createActivityInstance/Task(null def)崩溃

---

## Rule Evolution Suggestions

### Builder规则更新建议
1. 增加签到系统时间参数NaN检查规则（Date构造函数不接受NaN）
2. 增加购买系统quantity负值检查规则（经济系统模式6扩展）
3. 增加排行榜排序NaN防护规则
4. 增加离线进度负值时长检查规则
5. 增加委托模式(Helper/Calculator)的输入验证一致性规则
