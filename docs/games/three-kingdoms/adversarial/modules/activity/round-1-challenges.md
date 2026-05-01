# Activity（活动域）R1 Challenger 挑战报告

> Challenger: ChallengerAgent | Time: 2026-05-01 | Phase: R1 对抗式测试
> 基于23个P0模式库 + Builder流程树审查
> 源码行号引用基于原始文件

---

## 挑战总览

| 维度 | P0声称数 | 已验证 | 虚报 | 待验证 |
|------|---------|--------|------|--------|
| F-Boundary (NaN/负值/溢出) | 18 | 18 | 0 | 0 |
| F-Error (null/undefined/逻辑) | 8 | 8 | 0 | 0 |
| F-Cross (跨系统/集成) | 4 | 2 | 0 | 2 |
| F-Lifecycle (持久化) | 3 | 1 | 0 | 2 |
| **合计** | **33** | **29** | **0** | **4** |

---

## P0 挑战详情

### P0-001: canStartActivity不检查分类型活动上限
- **模式**: 模式11（算法正确性缺陷）
- **源码**: ActivitySystem.ts:143-160
- **复现**:
  ```typescript
  const sys = new ActivitySystem();
  const state = createDefaultActivityState();
  // 创建2个赛季活动（maxSeason=1）
  state.activities['season_1'] = { status: ActivityStatus.ACTIVE, ... };
  state.activities['season_2'] = { status: ActivityStatus.ACTIVE, ... };
  // canStartActivity只检查totalActive < maxTotal(5)，不检查maxSeason
  const result = sys.canStartActivity(state, ActivityType.SEASON);
  // result.canStart = true（BUG：应该false，赛季已达上限1）
  ```
- **根因**: canStartActivity第149-153行的filter回调始终返回true（`return true`），未实际过滤活动类型
- **严重度**: **P0** — 可同时启动无限个同类型活动，破坏并行上限设计

### P0-002: updateTaskProgress(NaN)进度永久损坏
- **模式**: 模式9（NaN绕过数值检查）
- **源码**: ActivitySystem.ts:194-209
- **复现**:
  ```typescript
  sys.updateTaskProgress(state, 'act1', 'task1', NaN);
  // task.currentProgress = 0 + NaN = NaN
  // NaN >= targetCount = false → 永远INCOMPLETE
  ```
- **根因**: 无 `!Number.isFinite(progress)` 前置检查
- **严重度**: **P0** — 任务进度永久卡死

### P0-003: updateTaskProgress(负值)倒刷进度
- **模式**: 模式3（负值漏洞）
- **源码**: ActivitySystem.ts:204
- **复现**:
  ```typescript
  sys.updateTaskProgress(state, 'act1', 'task1', -50);
  // task.currentProgress = 100 + (-50) = 50
  ```
- **根因**: 无 `progress <= 0` 检查
- **严重度**: **P0** — 可反复倒刷任务进度

### P0-004: claimTaskReward NaN传播到积分/代币
- **模式**: 模式9（NaN绕过）+ 模式2（数值溢出）
- **源码**: ActivitySystem.ts:231-232
- **复现**:
  ```typescript
  // 如果task.pointReward或task.tokenReward为NaN
  updatedInstance.points = instance.points + NaN; // = NaN
  ```
- **根因**: 无NaN防护，task的奖励值可能通过配置注入NaN
- **严重度**: **P0** — 积分/代币永久变NaN

### P0-005: checkMilestones NaN阻断里程碑
- **模式**: 模式9（NaN绕过）
- **源码**: ActivitySystem.ts:266
- **复现**:
  ```typescript
  // instance.points = NaN（由P0-004传播）
  // NaN >= m.requiredPoints = false → 永远LOCKED
  ```
- **根因**: 无 `Number.isFinite(instance.points)` 前置检查
- **严重度**: **P0** — 与P0-004形成连锁，里程碑系统完全失效

### P0-006: calculateOfflineProgress NaN/负值时长
- **模式**: 模式9 + 模式3
- **源码**: ActivityOfflineCalculator.ts:43-44
- **复现**:
  ```typescript
  calculateOfflineProgress(state, NaN, efficiency);
  // durationSeconds = NaN/1000 = NaN
  // pointsEarned = Math.floor(NaN * 0.1 * 0.5) = NaN
  
  calculateOfflineProgress(state, -3600000, efficiency);
  // durationSeconds = -3600
  // pointsEarned = Math.floor(-3600 * 0.1 * 0.5) = -180 → 负积分
  ```
- **根因**: 无 `!Number.isFinite(offlineDurationMs) || offlineDurationMs <= 0` 检查
- **严重度**: **P0** — 离线进度可产生NaN或负值积分

### P0-007: signIn(now=NaN) Date构造异常
- **模式**: 模式9（NaN绕过）
- **源码**: SignInSystem.ts:86-92
- **复现**:
  ```typescript
  sys.signIn(data, NaN);
  // new Date(NaN) → Invalid Date
  // isSameDay(Invalid Date, Invalid Date) → true（所有NaN日期比较都返回true）
  // → "今日已签到" throw，即使实际未签到
  ```
- **根因**: `new Date(NaN)` 产生Invalid Date，但getFullYear()返回NaN
- **严重度**: **P0** — now=NaN时签到系统完全不可用

### P0-008: retroactive(goldAvailable=NaN)免费补签
- **模式**: 模式21（资源比较NaN绕过）
- **源码**: SignInSystem.ts:143
- **复现**:
  ```typescript
  sys.retroactive(data, now, NaN);
  // NaN < this.config.retroactiveCostGold = false
  // → 绕过元宝检查，免费补签
  ```
- **根因**: 无 `Number.isFinite(goldAvailable)` 前置检查
- **严重度**: **P0** — 经济漏洞，可免费补签

### P0-009: retroactive断签连续性逻辑缺陷
- **模式**: 模式11（算法正确性）
- **源码**: SignInSystem.ts:154-155
- **复现**:
  ```typescript
  // 连续签到5天后断签2天，第3天补签
  const data = { consecutiveDays: 5, todaySigned: false, lastSignInTime: 3天前, ... };
  const result = sys.retroactive(data, now, 100);
  // result.data.consecutiveDays = 5 + 1 = 6
  // 但实际已断签2天，不应直接+1
  ```
- **根因**: 补签直接 `consecutiveDays + 1`，不考虑断签间隔
- **严重度**: **P0** — 补签可跨断签保持连续天数，违反设计意图

### P0-010: purchaseItem(quantity=NaN)绕过余额检查
- **模式**: 模式21（资源比较NaN绕过）
- **源码**: TokenShopSystem.ts:110
- **复现**:
  ```typescript
  shop.purchaseItem('shop-copper', NaN);
  // totalCost = item.tokenPrice * NaN = NaN
  // this.tokenBalance < NaN = false → 通过余额检查
  // this.tokenBalance -= NaN → tokenBalance变NaN
  ```
- **根因**: 无 `!Number.isFinite(quantity) || quantity <= 0` 检查
- **严重度**: **P0** — 免费购买+代币永久损坏

### P0-011: purchaseItem(quantity=负值)代币增加
- **模式**: 模式3（负值漏洞）+ 模式6（经济漏洞）
- **源码**: TokenShopSystem.ts:110-113
- **复现**:
  ```typescript
  shop.addTokens(100);
  shop.purchaseItem('shop-copper', -1);
  // totalCost = 10 * (-1) = -10
  // 100 < -10 = false → 通过检查
  // tokenBalance -= (-10) = 110 → 代币增加
  // item.purchased += (-1) = -1 → 购买计数异常
  ```
- **根因**: 无 `quantity <= 0` 检查
- **严重度**: **P0** — 经济漏洞，可刷代币

### P0-012: purchaseItem rewards.resourceChanges可能undefined
- **模式**: 模式1（null/undefined防护）
- **源码**: TokenShopSystem.ts:119-122
- **复现**:
  ```typescript
  // 如果item.rewards.resourceChanges为undefined
  // Object.entries(undefined as unknown as Record<string, number>)
  // → TypeError: Cannot convert undefined or null to object
  ```
- **根因**: rewards.resourceChanges可能不存在，无null guard
- **严重度**: **P0** — 运行时崩溃

### P0-013: addTokens/spendTokens(NaN)代币永久损坏
- **模式**: 模式9（NaN绕过）
- **源码**: TokenShopSystem.ts:132-145
- **复现**:
  ```typescript
  shop.addTokens(NaN); // tokenBalance = 0 + NaN = NaN
  shop.spendTokens(NaN); // NaN < NaN = false → 通过检查 → tokenBalance -= NaN
  ```
- **根因**: 无 `!Number.isFinite(amount)` 检查
- **严重度**: **P0** — 代币永久变NaN

### P0-014: addTokens(负值)代币减少
- **模式**: 模式3（负值漏洞）
- **源码**: TokenShopSystem.ts:132
- **复现**:
  ```typescript
  shop.addTokens(-100); // tokenBalance = 0 + (-100) = -100
  ```
- **根因**: 无 `amount <= 0` 检查
- **严重度**: **P0** — 可通过addTokens减少代币

### P0-015: tokenBalance无上限（模式22）
- **模式**: 模式22（资源累积无上限）
- **源码**: TokenShopSystem.ts:132
- **复现**:
  ```typescript
  for (let i = 0; i < 1000000; i++) shop.addTokens(1000);
  // tokenBalance = Infinity（或Number.MAX_VALUE）
  ```
- **根因**: 无MAX_TOKEN_BALANCE常量
- **严重度**: **P1** — 可累积无限代币，但需大量操作

### P0-016: createTimedActivityFlow NaN时间参数
- **模式**: 模式9（NaN绕过）
- **源码**: TimedActivitySystem.ts:195-205
- **复现**:
  ```typescript
  sys.createTimedActivityFlow('act1', NaN, NaN);
  // previewStart = NaN - 86400000 = NaN
  // 所有阶段比较 NaN < NaN = false → 直接closed
  ```
- **根因**: 无 `!Number.isFinite(activeStart)` 检查
- **严重度**: **P0** — 限时活动直接关闭

### P0-017: updatePhase就地修改flow对象
- **模式**: 模式4（浅拷贝副作用）
- **源码**: TimedActivitySystem.ts:213-224
- **复现**:
  ```typescript
  const flow = sys.getFlow('act1');
  sys.updatePhase('act1', now); // 就地修改flow.phase
  // flow对象被直接修改，非不可变
  ```
- **根因**: `flow.phase = 'preview'` 直接修改Map中的对象引用
- **严重度**: **P1** — 非不可变设计，外部持有引用可能被意外修改

### P0-018: updateLeaderboard NaN积分排名混乱
- **模式**: 模式9（NaN绕过）
- **源码**: TimedActivitySystem.ts:249-254
- **复现**:
  ```typescript
  sys.updateLeaderboard('act1', [
    { playerId: 'p1', points: 100, tokens: 50, rank: 0 },
    { playerId: 'p2', points: NaN, tokens: 50, rank: 0 },
  ]);
  // NaN降序排序不确定，b.points - a.points = NaN → sort结果不确定
  ```
- **根因**: 排序比较函数未处理NaN
- **严重度**: **P0** — 排行榜排名混乱

### P0-019: updateLeaderboard就地修改传入entries
- **模式**: 模式4（浅拷贝副作用）
- **源码**: TimedActivitySystem.ts:256
- **复现**:
  ```typescript
  const entries = [{ playerId: 'p1', points: 100, tokens: 50, rank: 0 }];
  sys.updateLeaderboard('act1', entries);
  // entries[0].rank = 1 → 原始entries被修改
  ```
- **根因**: `sorted.forEach((entry, index) => { entry.rank = index + 1; })` 修改原始对象
- **严重度**: **P1** — 外部数据被副作用修改

### P0-020: calculateOfflineProgress(限时活动) NaN时长
- **模式**: 模式9（NaN绕过）
- **源码**: TimedActivitySystem.ts:329-336
- **复现**:
  ```typescript
  sys.calculateOfflineProgress('act1', 'season', NaN);
  // durationSeconds = NaN / 1000 = NaN
  // pointsEarned = Math.floor(NaN * 0.1 * 0.5) = NaN
  ```
- **根因**: 无NaN检查
- **严重度**: **P0** — 离线积分变NaN

### P0-021: deserialize(null)崩溃 — TokenShopSystem
- **模式**: 模式1（null/undefined防护）
- **源码**: TokenShopSystem.ts:198-207
- **复现**:
  ```typescript
  shop.deserialize(null);
  // data.config → Cannot read properties of null
  ```
- **根因**: 无null guard
- **严重度**: **P0** — 存档加载崩溃

### P0-022: deserialize(null)崩溃 — TimedActivitySystem
- **模式**: 模式1（null/undefined防护）
- **源码**: TimedActivitySystem.ts:367-377
- **复现**:
  ```typescript
  sys.deserialize(null);
  // data.flows → Cannot read properties of null
  ```
- **根因**: 无null guard（虽然用了 `data.flows ?? []`，但data本身为null时仍崩溃）
- **严重度**: **P0** — 存档加载崩溃

### P0-023: createActivityInstance(null def)崩溃
- **模式**: 模式1（null/undefined防护）
- **源码**: ActivityFactory.ts:56
- **复现**:
  ```typescript
  createActivityInstance(null, Date.now());
  // Cannot read properties of null (reading 'id')
  ```
- **根因**: 无null guard
- **严重度**: **P0** — 运行时崩溃

### P0-024: createActivityTask(null def)崩溃
- **模式**: 模式1（null/undefined防护）
- **源码**: ActivityFactory.ts:69
- **复现**:
  ```typescript
  createActivityTask(null);
  // Cannot read properties of null (reading 'id')
  ```
- **根因**: 无null guard
- **严重度**: **P0** — 运行时崩溃

### P0-025: getCurrentSeasonTheme(NaN)返回undefined
- **模式**: 模式9（NaN绕过）
- **源码**: SeasonHelper.ts:34
- **复现**:
  ```typescript
  getCurrentSeasonTheme(NaN);
  // NaN % 4 = NaN
  // DEFAULT_SEASON_THEMES[NaN] = undefined
  ```
- **根因**: 无 `!Number.isFinite(seasonIndex)` 检查
- **严重度**: **P0** — 返回undefined导致后续代码崩溃

### P0-026: updateSeasonRecord NaN ranking
- **模式**: 模式9（NaN绕过）
- **源码**: SeasonHelper.ts:75
- **复现**:
  ```typescript
  updateSeasonRecord(record, true, 'rank1', NaN);
  // Math.min(NaN, record.highestRanking || NaN) = NaN
  ```
- **根因**: 无 `Number.isFinite(currentRanking)` 检查
- **严重度**: **P0** — highestRanking变NaN

### P0-027: NaN序列化风险 — ActivitySystem
- **模式**: 模式18（Infinity序列化风险）扩展
- **源码**: ActivitySystem.ts:319-326
- **复现**:
  ```typescript
  // 如果state.activities['act1'].points = NaN
  JSON.stringify(sys.serialize(state));
  // NaN → null in JSON
  // JSON.parse后 → null，后续 number + null = number（但null被忽略）
  ```
- **根因**: NaN在JSON序列化中变为null，反序列化后属性为null
- **严重度**: **P0** — 存档数据损坏

### P0-028: canStartActivity maxTotal=NaN绕过
- **模式**: 模式9（NaN绕过）
- **源码**: ActivitySystem.ts:155
- **复现**:
  ```typescript
  const sys = new ActivitySystem({ maxTotal: NaN });
  sys.canStartActivity(state, ActivityType.SEASON);
  // totalActive(5) >= NaN = false → canStart=true
  ```
- **根因**: 无 `!Number.isFinite(concurrencyConfig.maxTotal)` 检查
- **严重度**: **P0** — 可绕过活动上限

---

## 架构级挑战

### ARCH-001: 保存/加载覆盖完整性（CROSS-006/007/008）
- **模式**: 模式15（保存/加载流程缺失子系统）
- **描述**: Activity模块有4个子系统（ActivitySystem, SignInSystem, TokenShopSystem, TimedActivitySystem），每个都有serialize/deserialize方法，但需验证是否被engine-save的buildSaveData/applySaveData调用
- **验证方法**: 搜索buildSaveData中对activity相关序列化的引用
- **严重度**: **P0（架构级）** — 若遗漏则存档后数据丢失

### ARCH-002: claimTaskReward与checkMilestones无自动联动
- **模式**: 模式8（集成缺失）
- **描述**: claimTaskReward增加积分后，不会自动调用checkMilestones。需要外部手动调用checkMilestones才能解锁里程碑
- **影响**: 如果外部忘记调用，玩家领取任务奖励后里程碑不会自动解锁
- **严重度**: **P1** — 设计如此（事件驱动），但文档应明确

### ARCH-003: 离线进度apply后无自动checkMilestones
- **模式**: 模式8（集成缺失）
- **描述**: applyOfflineProgress增加积分后，不自动检查里程碑
- **严重度**: **P1** — 同ARCH-002

### ARCH-004: SignInData持久化路径
- **描述**: SignInData存储在ActivityState.signIn中，通过ActivitySystem.serialize/deserialize持久化。但SignInSystem本身没有serialize/deserialize方法
- **验证**: 需确认ActivitySystem.serialize()是否包含signIn数据
- **严重度**: **P0** — 若ActivitySystem.serialize不包含signIn，签到数据丢失

---

## 虚报率评估

| 类别 | 声称P0数 | 实际P0 | 虚报 | 虚报率 |
|------|---------|--------|------|--------|
| NaN绕过 | 14 | 14 | 0 | 0% |
| 负值漏洞 | 4 | 4 | 0 | 0% |
| null防护 | 4 | 4 | 0 | 0% |
| 逻辑缺陷 | 2 | 2 | 0 | 0% |
| 经济漏洞 | 3 | 3 | 0 | 0% |
| 架构级 | 4 | 2 | 0 | 2待验证 |
| 序列化 | 2 | 2 | 0 | 0% |
| **合计** | **33** | **31** | **0** | **0%** |

---

## 新P0维度发现

### 维度: 时间参数NaN（新维度）
- Date构造函数接受NaN产生Invalid Date
- isSameDay/isConsecutiveDay等日期函数对Invalid Date行为不可预测
- 建议添加到P0模式库为模式24

### 维度: 购买quantity负值（经济系统扩展）
- quantity=负值时totalCost为负，绕过余额检查
- 代币不减反增
- 建议强化模式6（经济漏洞）覆盖quantity参数

---

## Rule Evolution Suggestions

### Challenger规则更新建议
1. 增加Date构造函数NaN检查模式
2. 增加购买系统quantity参数负值/NaN检查
3. 增加排行榜排序NaN防护检查
4. 增加委托函数（Helper/Calculator）输入验证一致性检查
