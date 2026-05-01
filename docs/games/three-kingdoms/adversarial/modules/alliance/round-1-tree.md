# Alliance R1 Builder 流程树

> 模块: engine/alliance | 文件数: 7 | 总行数: 1562
> 日期: 2026-05-01 | Builder: v1.9

## 模块概览

| 文件 | 行数 | 公开API数 | 子系统 |
|------|------|-----------|--------|
| AllianceSystem.ts | 428 | 18 | 联盟CRUD/权限/等级/序列化 |
| AllianceBossSystem.ts | 308 | 10 | Boss生成/挑战/排行/奖励 |
| AllianceShopSystem.ts | 211 | 10 | 商店查询/购买/限购/重置 |
| AllianceTaskSystem.ts | 330 | 12 | 任务生成/进度/奖励/序列化 |
| AllianceHelper.ts | 109 | 6 | 权限检查/工具/序列化 |
| alliance-constants.ts | 104 | 5 | 常量/工厂函数 |
| index.ts | 72 | — | 统一导出 |

## 1. AllianceSystem 流程树

### 1.1 联盟创建与加入

```
createAlliance(playerState, name, declaration, playerId, playerName, now)
├── F-Normal: 正常创建联盟 → 返回 { playerState, alliance }
├── B-AlreadyIn: playerState.allianceId 非空 → throw '已在联盟中'
├── B-NameTooShort: name.length < nameMinLength → throw
├── B-NameTooLong: name.length > nameMaxLength → throw
├── B-NameExact: name.length == nameMinLength/MaxLength → 正常创建
└── [covered] 测试: AllianceSystem.test.ts

createAllianceSimple(name, playerName)
├── F-Normal: 内部状态创建 → success=true
├── B-AlreadyIn: 内部 _playerState.allianceId 非空 → success=false
├── B-NoBalance: currencyBalanceCallback 返回不足 → reason='元宝不足'
├── B-SpendFail: currencySpendCallback 返回 false → reason='元宝扣除失败'
├── B-NoCallback: 无 currencyBalanceCallback → 跳过余额检查直接创建
└── [covered] 测试: AllianceSystem.test.ts

applyToJoin(alliance, playerState, playerId, playerName, power, now)
├── F-Normal: 提交申请 → applications 增加
├── B-AlreadyIn: playerState.allianceId 非空 → throw
├── B-DuplicateApp: 已有待审批申请 → throw
├── B-Full: 成员数 >= maxMembers → throw
└── [covered] 测试: AllianceSystem.test.ts

approveApplication(alliance, applicationId, operatorId, now)
├── F-Normal: 审批通过 → members增加, application状态变更
├── B-NoPermission: operatorId 非LEADER/ADVISOR → throw
├── B-AppNotFound: applicationId 不存在 → throw
├── B-AppProcessed: application.status != PENDING → throw
├── B-Full: 审批时成员已满 → throw
└── [covered] 测试: AllianceSystem.test.ts

rejectApplication(alliance, applicationId, operatorId)
├── F-Normal: 拒绝申请 → status=REJECTED
├── B-NoPermission: operatorId 权限不足 → throw
├── B-AppNotFound → throw
├── B-AppProcessed → throw
└── [covered] 测试: AllianceSystem.test.ts
```

### 1.2 成员管理

```
leaveAlliance(alliance, playerState, playerId)
├── F-Normal: 成员退出 → members减少, playerState.allianceId=''
├── F-LastMember: 最后一个成员退出 → alliance=null
├── B-NotMember: playerId 不在 members 中 → throw
├── B-LeaderLeave: playerId == leaderId → throw '盟主需先转让'
└── [covered] 测试: AllianceSystem.test.ts

kickMember(alliance, operatorId, targetId)
├── F-Normal: 踢出成员 → members减少
├── B-NoPermission: operatorId 非LEADER/ADVISOR → throw
├── B-TargetNotMember: targetId 不在 members 中 → throw
├── B-KickLeader: targetId == leaderId → throw
├── B-KickSelf: targetId == operatorId → throw
└── [covered] 测试: AllianceSystem.test.ts

transferLeadership(alliance, currentLeaderId, newLeaderId)
├── F-Normal: 转让盟主 → leaderId变更, 角色互换
├── B-NotLeader: currentLeaderId != leaderId → throw
├── B-TargetNotMember: newLeaderId 不在 members 中 → throw
├── B-TransferSelf: currentLeaderId == newLeaderId → throw
└── [covered] 测试: AllianceSystem.test.ts

setRole(alliance, operatorId, targetId, role)
├── F-Normal: 设置角色 → member.role变更
├── B-NotLeader: operatorId != leaderId → throw
├── B-TargetNotMember → throw
├── B-SetLeader: role == 'LEADER' → throw '请使用转让盟主功能'
├── B-SetSelf: targetId == operatorId → throw
└── [covered] 测试: AllianceSystem.test.ts
```

### 1.3 频道与公告

```
postAnnouncement(alliance, authorId, authorName, content, pinned, now)
├── F-Normal: 发布公告 → announcements 增加
├── F-PinnedFull: 置顶数 >= maxPinnedAnnouncements → throw
├── B-NoPermission: authorId 权限不足 → throw
├── B-EmptyContent: content.trim() 为空 → throw
└── [covered] 测试: AllianceSystem.test.ts

sendMessage(alliance, senderId, senderName, content, now)
├── F-Normal: 发送消息 → messages 增加
├── F-Overflow: messages > maxMessages → 截断旧消息
├── B-NotMember → throw
├── B-EmptyContent → throw
└── [covered] 测试: AllianceSystem.test.ts
```

### 1.4 联盟等级与福利

```
addExperience(alliance, exp)
├── F-Normal: 增加经验 → experience增加, 可能升级
├── B-NegativeExp: exp < 0 → Math.max(0, exp) 安全处理
├── B-NaNExp: exp=NaN → Math.max(0, NaN) = 0 → 安全但静默吞掉
├── B-MaxLevel: level已达上限 → 不再升级
├── B-ExpOverflow: experience + exp 超出安全整数范围
└── [covered] 测试: AllianceSystem.test.ts

getLevelConfig(level)
├── F-Normal: 返回对应等级配置
├── B-LevelZero: level=0 → Math.max(0, -1) → 返回 levelConfigs[0]
├── B-LevelNegative: level<0 → 同上
├── B-OverMax: level > max → 返回最后一项
└── [covered] 测试: AllianceSystem.test.ts

getBonuses(alliance)
├── F-Normal: 返回 { resourceBonus, expeditionBonus }
└── [covered] 测试: AllianceSystem.test.ts

getMaxMembers(level)
├── F-Normal: 返回 maxMembers
└── [covered] 测试: AllianceSystem.test.ts
```

### 1.5 每日重置

```
dailyReset(alliance, playerState)
├── F-Normal: 重置所有成员daily字段 + bossKilledToday + dailyTaskCompleted
├── E-Verify: 所有成员 dailyContribution=0, dailyBossChallenges=0
└── [covered] 测试: AllianceSystem.test.ts
```

### 1.6 序列化

```
serialize(playerState, alliance)
├── F-Normal: 返回 AllianceSaveData { version, playerState, allianceData }
├── F-NullAlliance: alliance=null → allianceData=null
└── [covered] 测试: AllianceHelper.test.ts

deserialize(data)
├── F-Normal: 返回 { playerState, alliance }
├── B-NullData: data=null → 返回默认状态
├── B-VersionMismatch: version != ALLIANCE_SAVE_VERSION → 返回默认状态
├── B-NullAllianceData: allianceData=null → alliance=null
└── [covered] 测试: AllianceHelper.test.ts
```

## 2. AllianceBossSystem 流程树

### 2.1 Boss管理

```
createBoss(allianceLevel, now) [exported function]
├── F-Normal: 生成Boss实例
├── B-LevelZero: allianceLevel=0 → bossLevel=0, maxHp=baseHp-50000=50000
├── B-LevelNegative: allianceLevel<0 → maxHp < baseHp (负值!)
└── [covered] 测试: AllianceBossSystem.test.ts

refreshBoss(alliance, now)
├── F-Normal: 刷新Boss → bossKilledToday=false
└── [covered] 测试: AllianceBossSystem.test.ts

getCurrentBoss(alliance)
├── F-Normal: 重建Boss实例
├── F-Killed: bossKilledToday=true → status=KILLED, currentHp=0
└── [covered] 测试: AllianceBossSystem.test.ts
```

### 2.2 Boss挑战

```
challengeBoss(boss, alliance, playerState, playerId, damage)
├── F-Normal: 造成伤害 → boss.currentHp减少, damageRecords更新, 奖励发放
├── F-KillingBlow: damage >= currentHp → status=KILLED, killReward发放
├── B-BossKilled: boss.status != ALIVE → throw
├── B-NotMember: playerId 不在 members 中 → throw
├── B-NoChallenges: dailyBossChallenges >= dailyChallengeLimit → throw
├── B-NegativeDamage: damage < 0 → actualDamage = Math.max(0, ...) = 0
├── B-NaNDamage: damage=NaN → Math.max(0, Math.min(NaN, hp)) = 0 → 零伤害但消耗次数
├── B-OverDamage: damage > currentHp → actualDamage = currentHp
└── [covered] 测试: AllianceBossSystem.test.ts
```

### 2.3 伤害排行

```
getDamageRanking(boss, alliance)
├── F-Normal: 返回按伤害降序排列的排行
├── F-NoDamage: damageRecords 为空 → 空数组
├── F-UnknownPlayer: playerId 不在 members 中 → playerName='未知'
└── [covered] 测试: AllianceBossSystem.test.ts

distributeKillRewards(alliance, playerState)
├── F-Normal: guildCoins += killGuildCoinReward
└── [covered] 测试: AllianceBossSystem.test.ts

getRemainingChallenges(playerState)
├── F-Normal: 返回剩余次数
├── B-OverLimit: dailyBossChallenges > dailyChallengeLimit → Math.max(0, ...) = 0
└── [covered] 测试: AllianceBossSystem.test.ts
```

## 3. AllianceShopSystem 流程树

### 3.1 商品查询

```
getAllItems()
├── F-Normal: 返回全部商品副本
└── [covered] 测试: AllianceShopSystem.test.ts

getAvailableShopItems(allianceLevel)
├── F-Normal: 返回等级解锁的商品
├── B-LevelZero: allianceLevel=0 → 只返回 requiredAllianceLevel=0 的商品(无)
└── [covered] 测试: AllianceShopSystem.test.ts

getItem(itemId)
├── F-Normal: 返回商品
├── B-NotFound: 返回 undefined
└── [covered] 测试: AllianceShopSystem.test.ts

isItemUnlocked(itemId, allianceLevel)
├── F-Normal: 检查解锁
├── B-ItemNotFound: 返回 false
└── [covered] 测试: AllianceShopSystem.test.ts

canBuy(itemId, allianceLevel, guildCoins)
├── F-Normal: 返回 { canBuy: true }
├── B-ItemNotFound: { canBuy: false, reason: '商品不存在' }
├── B-LevelLow: { canBuy: false, reason: '需要联盟等级X' }
├── B-LimitReached: { canBuy: false, reason: '已达限购上限' }
├── B-NoCoins: { canBuy: false, reason: '公会币不足' }
└── [covered] 测试: AllianceShopSystem.test.ts
```

### 3.2 购买操作

```
buyShopItem(playerState, itemId, allianceLevel)
├── F-Normal: 扣除公会币, purchased++
├── B-ItemNotFound → throw
├── B-LevelLow → throw
├── B-LimitReached → throw
├── B-NoCoins → throw
└── [covered] 测试: AllianceShopSystem.test.ts

buyShopItemBatch(playerState, itemId, count, allianceLevel)
├── F-Normal: 批量购买, purchased+=actualCount
├── B-ItemNotFound → throw
├── B-LevelLow → throw
├── B-CountZero: actualCount <= 0 → throw '已达限购上限'
├── B-NoCoins: guildCoins < totalCost → throw
├── B-OverLimit: count > remaining → actualCount = remaining
└── [covered] 测试: AllianceShopSystem.test.ts
```

### 3.3 重置

```
resetShopWeekly()
├── F-Normal: 所有商品 purchased=0
└── [covered] 测试: AllianceShopSystem.test.ts

getRemainingPurchases(itemId)
├── F-Normal: 返回剩余次数
├── F-NoLimit: weeklyLimit=0 → Infinity
├── B-ItemNotFound → 0
└── [covered] 测试: AllianceShopSystem.test.ts

getItemsByType(allianceLevel)
├── F-Normal: 按类型分组
└── [covered] 测试: AllianceShopSystem.test.ts
```

## 4. AllianceTaskSystem 流程树

### 4.1 任务生成

```
dailyRefresh()
├── F-Normal: 从任务池随机抽取 dailyTaskCount 个任务
├── B-PoolSmallerThanCount: taskPool.length < dailyTaskCount → 只取池中全部
└── [covered] 测试: AllianceTaskSystem.test.ts
```

### 4.2 任务进度

```
updateProgress(taskDefId, progress)
├── F-Normal: 进度增加, 可能完成
├── F-Complete: currentProgress >= targetCount → status=COMPLETED
├── B-TaskNotFound: 返回 null
├── B-TaskCompleted: status != ACTIVE → 返回当前task
├── B-NegativeProgress: Math.max(0, progress) → 安全
├── B-NaNProgress: Math.max(0, NaN) = 0 → 静默吞掉
└── [covered] 测试: AllianceTaskSystem.test.ts

recordContribution(alliance, playerState, playerId, contribution)
├── F-Normal: 更新成员贡献 + 玩家公会币
├── B-NotMember → throw
├── B-NegativeContribution: Math.max(0, contribution) → 安全
├── B-NaNContribution: Math.max(0, NaN) = 0 → 静默吞掉
└── [covered] 测试: AllianceTaskSystem.test.ts
```

### 4.3 任务奖励

```
claimTaskReward(taskDefId, alliance, playerState, playerId)
├── F-Normal: 发放联盟经验 + 个人公会币
├── B-TaskNotFound → throw
├── B-TaskNotCompleted → throw
├── B-AlreadyClaimed: claimedPlayers.has(playerId) → throw
├── B-DefNotFound → throw
└── [covered] 测试: AllianceTaskSystem.test.ts
```

### 4.4 序列化

```
serializeTasks()
├── F-Normal: claimedPlayers Set → string[]
└── [covered] 测试: AllianceTaskSystem.test.ts

deserializeTasks(data)
├── F-Normal: string[] → Set<string>
├── B-EmptyData: [] → activeTasks=[]
└── [covered] 测试: AllianceTaskSystem.test.ts
```

## 5. AllianceHelper 流程树

```
requirePermission(alliance, playerId, action)
├── F-Normal: LEADER/ADVISOR 通过 approve/announce/kick
├── F-Manage: 仅 LEADER 通过 manage
├── B-NotMember → throw
├── B-InsufficientRole: MEMBER → throw
└── [covered] 测试: AllianceHelper.test.ts

hasPermission(alliance, playerId, action)
├── F-Normal: try requirePermission → true
├── B-Fail → false
└── [covered] 测试: AllianceHelper.test.ts

getMemberList(alliance)
├── F-Normal: Object.values(members)
└── [covered] 测试: AllianceHelper.test.ts

getPendingApplications(alliance)
├── F-Normal: filter PENDING
└── [covered] 测试: AllianceHelper.test.ts

getPinnedAnnouncements(alliance)
├── F-Normal: filter pinned
└── [covered] 测试: AllianceHelper.test.ts

searchAlliance(alliances, keyword)
├── F-Normal: 按名称模糊搜索
├── B-EmptyKeyword: keyword='' → 返回全部
└── [covered] 测试: AllianceHelper.test.ts
```

## 6. alliance-constants 流程树

```
generateId(prefix)
├── F-Normal: prefix_timestamp_random
└── [covered] 测试: alliance-constants.test.ts

createDefaultAlliancePlayerState()
├── F-Normal: 返回默认状态
└── [covered] 测试: alliance-constants.test.ts

createAllianceData(id, name, declaration, leaderId, leaderName, now)
├── F-Normal: 创建联盟数据
└── [covered] 测试: alliance-constants.test.ts
```

## 7. 跨系统链路

```
L-001: AllianceSystem.createAlliance → AllianceHelper.serializeAlliance
L-002: AllianceSystem.challengeBoss → AllianceTaskSystem.updateProgress (Boss伤害任务)
L-003: AllianceBossSystem.challengeBoss → AllianceSystem.addExperience (Boss击杀经验)
L-004: AllianceTaskSystem.claimTaskReward → AllianceSystem.addExperience (任务经验)
L-005: AllianceShopSystem.buyShopItem → AlliancePlayerState.guildCoins (公会币消费)
L-006: AllianceBossSystem.distributeKillRewards → AlliancePlayerState.guildCoins (公会币发放)
L-007: AllianceTaskSystem.recordContribution → AlliancePlayerState.guildCoins (贡献奖励)
L-008: AllianceSystem.dailyReset → AllianceBossSystem (bossKilledToday重置)
L-009: AllianceSystem.serialize/deserialize → engine-save (⚠️ P0: 未接入!)
```

## 统计

| 维度 | 数量 |
|------|------|
| 公开API总数 | 61 |
| F-Normal节点 | 45 |
| B-Boundary节点 | 68 |
| E-Error节点 | 3 |
| 跨系统链路 | 9 |
| P0发现 | 1 (engine-save未接入) |
