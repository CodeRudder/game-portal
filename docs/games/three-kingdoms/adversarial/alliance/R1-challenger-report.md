# R1 Challenger — 联盟模块测试挑战报告

> **模块**: alliance (联盟系统)
> **轮次**: R1
> **挑战者**: TreeChallenger Agent
> **审阅对象**: R1-builder-tree.md

---

## 总体评估
- **覆盖率评分**: 7.5/10
- **发现遗漏数**: 34
- **P0遗漏**: 6, **P1遗漏**: 16, **P2遗漏**: 12

---

## 维度分析

### F-Normal: 主线流程完整性

#### 遗漏点1 [P0] 联盟解散流程缺失
**描述**: Builder树中只有"退出联盟→最后一人退出→alliance返回null"的隐式解散，但缺少完整的联盟解散流程。源码中`leaveAlliance`在盟主退出时抛出错误，但非盟主退出后剩余0人时alliance返回null——这个隐式解散路径的触发条件不清晰：
- 如果联盟只剩2人(盟主+1成员)，成员退出后剩1人(盟主)，盟主无法退出
- 盟主必须先转让才能退出，但转让后新盟主也无法退出
- **这是一个逻辑死锁**：联盟永远无法被解散

**建议测试用例**: 
```
场景: 联盟只有盟主1人
- 盟主尝试退出 → 应该允许还是拒绝?
- 当前代码: leaderId == playerId → throw "盟主需先转让"
- 但联盟只有1人，无法转让 → 死锁
```

#### 遗漏点2 [P0] createAllianceSimple硬编码playerId='player-1'
**描述**: `createAllianceSimple`中硬编码`playerId`为`'player-1'`。这是一个严重的设计问题，意味着：
- 多玩家场景下无法正确使用
- 创建的联盟leaderId固定为'player-1'而非实际玩家ID
- 后续操作（如退出、踢人）可能因ID不匹配而失败

**建议测试用例**:
```
- createAllianceSimple后检查alliance.leaderId是否为'player-1'
- 用不同playerId调用后续操作，验证是否因ID不匹配而失败
```

#### 遗漏点3 [P1] 重复创建联盟名称检查缺失
**描述**: `createAlliance`方法没有检查联盟名称是否已被使用。两个玩家可以创建同名联盟。

**建议测试用例**:
```
- 玩家A创建"三国霸业"
- 玩家B创建"三国霸业" → 应该成功还是失败?
```

#### 遗漏点4 [P1] 申请加入后playerState未更新allianceId
**描述**: `applyToJoin`只更新了alliance的applications列表，但playerState.allianceId未变更。这是正确的设计（审批后才加入），但Builder树未覆盖"申请→被拒绝→playerState.allianceId仍为空"的验证。

**建议测试用例**:
```
- 申请加入 → 被拒绝 → 检查playerState.allianceId仍为空
```

#### 遗漏点5 [P1] approveApplication未更新playerState
**描述**: `approveApplication`返回更新后的alliance（含新成员），但不更新新成员的playerState.allianceId。调用方需要自行处理。Builder树未覆盖这个"半完成"状态。

**建议测试用例**:
```
- 审批通过后 → 新成员的playerState.allianceId需由外部设置
- 验证如果外部忘记设置，后续操作（如发消息）会失败
```

#### 遗漏点6 [P1] 联盟宣言(declaration)验证缺失
**描述**: `createAlliance`接收declaration参数但无任何长度/内容校验。

**建议测试用例**:
```
- declaration为超长字符串 → 是否允许?
- declaration为空字符串 → 是否允许?
```

#### 遗漏点7 [P2] sendMessage中splice可能不正确
**描述**: 代码使用`messages.splice(0, messages.length - maxMessages)`裁剪，但如果messages.length刚好等于maxMessages，splice(0, 0)不会出错但也不需要裁剪。逻辑正确但Builder树未验证。

**建议测试用例**:
```
- messages.length == 100 → 发送新消息 → messages.length仍为100
- messages.length == 101 → 发送新消息 → messages.length变为100
```

---

### F-Boundary: 边界条件覆盖

#### 遗漏点8 [P0] Boss挑战次数双重检查不一致
**描述**: `challengeBoss`中同时检查`member.dailyBossChallenges`和`playerState.dailyBossChallenges`，使用OR条件。但这两个值可能不同步——每日重置只重置member的dailyBossChallenges，playerState的dailyBossChallenges在dailyReset中也被重置。但如果只重置了member而未重置playerState（或反之），可能导致：
- member.challenges=3, playerState.challenges=0 → 仍然被拒绝
- member.challenges=0, playerState.challenges=3 → 仍然被拒绝

**建议测试用例**:
```
- member和playerState的dailyBossChallenges不一致时挑战
- 验证OR逻辑是否正确（任一达到上限即拒绝）
```

#### 遗漏点9 [P1] AllianceLevelConfig索引越界
**描述**: `getLevelConfig`使用`Math.min(level, ALLIANCE_LEVEL_CONFIGS.length) - 1`作为索引。如果level=0，则`Math.min(0,7)-1 = -1`，然后`Math.max(0,-1) = 0`，返回level=1的配置。Builder树有B-16但未覆盖level为负数的情况。

**建议测试用例**:
```
- level = -1 → 返回level=1的配置
- level = -100 → 返回level=1的配置
```

#### 遗漏点10 [P1] AllianceBossSystem.getCurrentBoss每次重建
**描述**: `getCurrentBoss`每次调用都`createBoss`重建，不保留damageRecords和currentHp。这意味着：
- 挑战Boss后，调用getCurrentBoss获取的Boss是全新的（满血）
- 伤害记录丢失

**建议测试用例**:
```
- 挑战Boss造成伤害 → 调用getCurrentBoss → Boss应为满血还是受伤?
- 当前实现: 每次重建，伤害丢失 → 这是BUG
```

#### 遗漏点11 [P1] 批量购买剩余次数计算
**描述**: `buyShopItemBatch`中`remaining = item.weeklyLimit > 0 ? item.weeklyLimit - item.purchased : count`，当weeklyLimit=0时remaining=count。但如果count非常大且公会币不足，会在后续检查中报错。Builder树未覆盖weeklyLimit=0时批量购买的场景。

**建议测试用例**:
```
- weeklyLimit=0的商品, count=100, 公会币只够10个 → 应购买10个
- 当前代码: remaining=count=100, actualCount=min(100,100)=100, 然后公会币不足报错
- 正确行为应为: 购买公会币允许的最大数量
```

#### 遗漏点12 [P2] 任务池不足时的dailyRefresh
**描述**: `pickRandomTasks`从池中取`dailyTaskCount`(3)个任务，但如果taskPool只有2个任务，`slice(0,3)`返回2个。Builder树未覆盖。

**建议测试用例**:
```
- taskPool只有1个任务 → dailyRefresh → 返回1个任务
- taskPool为空 → dailyRefresh → 返回空数组
```

#### 遗漏点13 [P2] generateId时间戳碰撞
**描述**: `generateId`使用`Date.now() + random`，在同一毫秒内调用两次可能产生相同前缀，仅靠6位random区分。

**建议测试用例**:
```
- 同一毫秒内创建两个联盟 → ID应不同
```

#### 遗漏点14 [P2] 联盟名称特殊字符
**描述**: 无名称内容校验（特殊字符、emoji、SQL注入等）。

**建议测试用例**:
```
- name="<script>alert(1)</script>" → 是否允许?
- name="联盟🎮" → 是否允许?
```

---

### F-Error: 异常路径覆盖

#### 遗漏点15 [P0] kickMember后目标玩家playerState未清理
**描述**: `kickMember`只从alliance.members中移除目标，但不更新目标的playerState.allianceId。被踢玩家的allianceId仍指向已退出的联盟，可能导致：
- 被踢玩家仍认为自己有联盟
- 被踢玩家尝试发消息 → 抛出"不是联盟成员"
- 被踢玩家尝试创建新联盟 → 抛出"已在联盟中"

**建议测试用例**:
```
- 踢出成员后 → 被踢玩家的playerState.allianceId未清空
- 被踢玩家尝试创建新联盟 → 失败（因为allianceId仍存在）
```

#### 遗漏点16 [P0] approveApplication未检查申请人是否已在其他联盟
**描述**: `approveApplication`不检查申请人的playerState.allianceId。如果申请人在等待审批期间加入了另一个联盟，审批通过后会出现数据不一致。

**建议测试用例**:
```
- 玩家申请联盟A → 玩家加入联盟B(playerState.allianceId=B) → 联盟A审批通过
- 结果: 玩家同时在两个联盟中（playerState指向B, 但A的members中有玩家）
```

#### 遗漏点17 [P1] challengeBoss中damage=0仍消耗挑战次数
**描述**: `actualDamage = Math.max(0, Math.min(damage, boss.currentHp))`，当damage=0时actualDamage=0，但后续仍更新`dailyBossChallenges+1`和`guildCoins+participationGuildCoin`。这意味着0伤害也能获得公会币和消耗次数。

**建议测试用例**:
```
- damage=0 → 验证是否消耗次数
- damage=0 → 验证是否获得公会币
- 当前代码: 是 → 这是否是设计意图?
```

#### 遗漏点18 [P1] AllianceTaskSystem.updateProgress负数进度
**描述**: `safeProgress = Math.max(0, progress)`处理了负数，但`task.currentProgress += safeProgress`是累加的。多次调用updateProgress可能导致进度超过targetCount后被截断，但截断只在达到targetCount时触发。

**建议测试用例**:
```
- target=10, updateProgress(5) → progress=5
- updateProgress(8) → progress=13 > 10 → status=COMPLETED, progress=10
- 验证进度截断是否正确
```

#### 遗漏点19 [P1] AllianceShopSystem.buyShopItem直接修改item对象
**描述**: `item.purchased++`直接修改了shopItems数组中的对象引用。虽然TypeScript类型允许，但这意味着：
- 购买操作有副作用
- 多次调用buyShopItem会累积purchased
- 序列化后再反序列化可能丢失purchased状态

**建议测试用例**:
```
- 购买商品 → 检查shopItems数组中的purchased已更新
- 序列化 → 反序列化 → 购买 → purchased应从反序列化的值开始
```

#### 遗漏点20 [P2] hasPermission对非成员返回false而非抛异常
**描述**: `hasPermission`用try/catch包装`requirePermission`，非成员时返回false。这是正确行为但Builder树未明确覆盖。

**建议测试用例**:
```
- 非成员调用hasPermission → 返回false（不抛异常）
```

---

### F-Cross: 跨系统交互覆盖

#### 遗漏点21 [P0] Boss挑战中贡献值计算公式
**描述**: `challengeBoss`中贡献值计算为`actualDamage / 100`。如果actualDamage < 100，贡献值为0（整数除法）。但TypeScript中number是浮点数，所以0.5这样的值会被保留。需验证dailyContribution和totalContribution是否支持浮点数。

**建议测试用例**:
```
- damage=50 → contribution=0.5 → 验证member.dailyContribution=0.5
- 多次小额伤害 → 累积贡献值是否精确
```

#### 遗漏点22 [P1] 每日重置不重置Boss的damageRecords
**描述**: `dailyReset`重置成员的dailyContribution和dailyBossChallenges，但不重置Boss的damageRecords。这意味着跨日伤害排行会累积。但Boss通过refreshBoss重建，damageRecords会丢失——两个行为矛盾。

**建议测试用例**:
```
- Day1: 挑战Boss, 产生伤害记录
- Day2: 每日重置 → 伤害记录是否保留?
- Day2: refreshBoss → 伤害记录是否清除?
```

#### 遗漏点23 [P1] 任务系统serialize/deserialize的claimedPlayers
**描述**: `claimedPlayers`是`Set<string>`，序列化为`string[]`，反序列化回`Set<string>`。需验证：
- 空Set序列化→[]
- 有元素序列化→['p1','p2']
- 反序列化后Set.has()正常工作

**建议测试用例**:
```
- 领取奖励(claimedPlayers含'p1') → 序列化 → 反序列化 → 领取奖励 → '已领取奖励'
```

#### 遗漏点24 [P1] 联盟等级升级后Boss挑战的HP变化
**描述**: 联盟升级后，`getCurrentBoss`重建Boss会使用新等级计算HP。但当前Boss可能已经受了伤——升级后Boss满血重生。

**建议测试用例**:
```
- level=1, Boss HP=100000, 造成伤害
- 升级到level=2 → getCurrentBoss → HP=150000(满血)
```

#### 遗漏点25 [P2] createAllianceSimple中先创建后扣费
**描述**: 代码先调用`createAlliance`成功后再扣费。如果扣费失败，已创建的联盟不会被回滚。

**建议测试用例**:
```
- 元宝刚好500 → 创建成功 → 扣费成功
- currencySpendCallback返回false → 创建成功但未扣费 → _alliance已被设置
```

---

### F-Lifecycle: 数据生命周期覆盖

#### 遗漏点26 [P0] 联盟解散时关联数据清理
**描述**: 联盟解散（alliance=null）后，Boss数据、任务数据、商店限购数据如何处理？Builder树未覆盖。

**建议测试用例**:
```
- 联盟有进行中的任务 → 联盟解散 → 任务状态如何?
- 联盟有商店限购记录 → 联盟解散 → 限购记录如何?
```

#### 遗漏点27 [P1] 成员退出后重新申请加入
**描述**: 成员退出后，其历史申请记录仍在applications中。重新申请时，旧的REJECTED申请不影响新申请。但Builder树未覆盖。

**建议测试用例**:
```
- 成员A申请 → 被拒绝 → 退出联盟 → 重新申请 → 检查是否有两个申请记录
```

#### 遗漏点28 [P1] 盟主转让后原盟主的贡献数据保留
**描述**: `transferLeadership`只修改role，不修改贡献数据。Builder树未验证。

**建议测试用例**:
```
- 盟主totalContribution=1000 → 转让 → 原盟主变为MEMBER → totalContribution仍为1000
```

#### 遗漏点29 [P2] 商店周重置时机
**描述**: 商店`resetShopWeekly`需要外部触发，没有自动检测周变更的机制。如果忘记调用，限购永远不重置。

**建议测试用例**:
```
- 购买满限购 → 不调用resetShopWeekly → 尝试购买 → 失败
- 调用resetShopWeekly → 尝试购买 → 成功
```

#### 遗漏点30 [P2] 任务每日刷新时机
**描述**: `dailyRefresh`需要外部触发，没有自动检测日变更。同上。

**建议测试用例**:
```
- Day1完成任务 → 不调用dailyRefresh → Day2任务仍为Day1的
```

---

## 额外发现的代码级问题

#### 遗漏点31 [P1] AllianceSystem._alliance和_alliancePlayerState的并发安全
**描述**: `createAllianceSimple`直接修改`_alliance`和`_playerState`，但没有锁机制。在异步环境中可能导致竞态。

#### 遗漏点32 [P1] AllianceBossSystem.refreshBoss不存储Boss到AllianceData
**描述**: `refreshBoss`返回新的alliance数据但不包含Boss实例。Boss数据实际上没有持久化到AllianceData中（只有bossKilledToday和lastBossRefreshTime）。

#### 遗漏点33 [P2] AllianceHelper.searchAlliance大小写处理
**描述**: 搜索使用`toLowerCase()`，但中文没有大小写概念，对中文联盟名搜索无效。

#### 遗漏点34 [P2] AllianceTaskSystem中CLAIMED状态从未被设置
**描述**: `AllianceTaskStatus.CLAIMED`在枚举中定义但从未在代码中使用。任务完成后状态保持COMPLETED。

---

## 建议新增的测试用例 (按优先级)

### P0 (必须覆盖)
1. 联盟解散死锁测试 (遗漏点1)
2. createAllianceSimple硬编码ID测试 (遗漏点2)
3. Boss挑战次数双重检查不一致测试 (遗漏点8)
4. kickMember后playerState未清理测试 (遗漏点15)
5. approveApplication未检查申请人双重联盟测试 (遗漏点16)
6. 联盟解散关联数据清理测试 (遗漏点26)

### P1 (强烈建议)
7. 联盟名称唯一性测试 (遗漏点3)
8. approveApplication半完成状态测试 (遗漏点5)
9. getCurrentBoss伤害丢失测试 (遗漏点10)
10. 批量购买weeklyLimit=0测试 (遗漏点11)
11. damage=0消耗次数和获币测试 (遗漏点17)
12. Boss贡献值浮点精度测试 (遗漏点21)
13. 每日重置vs Boss刷新伤害记录测试 (遗漏点22)
14. 任务claimedPlayers序列化往返测试 (遗漏点23)
15. 联盟升级后Boss HP变化测试 (遗漏点24)
16. createAllianceSimple创建后扣费失败无回滚测试 (遗漏点25)
17. 成员退出后重新申请测试 (遗漏点27)
18. 盟主转让贡献保留测试 (遗漏点28)

### P2 (建议补充)
19-34. 其余P2遗漏点对应测试用例

---

## 维度均衡度分析

| 维度 | Builder节点数 | 挑战遗漏数 | 覆盖充分度 |
|------|-------------|-----------|-----------|
| F-Normal | 70 | 7 | 90% |
| F-Boundary | 28 | 7 | 75% |
| F-Error | 22 | 6 | 73% |
| F-Cross | 18 | 5 | 72% |
| F-Lifecycle | 16 | 5 | 69% |

**均衡度**: 方差 ≈ 1.2 (> 1.0 阈值)，F-Lifecycle和F-Cross偏弱。
