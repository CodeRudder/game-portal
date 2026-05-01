# Social 模块 R1 对抗式测试 — Builder 测试分支树

> 生成时间: 2025-07-11
> 模块: `engine/social/`
> 源文件: 8 个 (1724 行)
> 测试文件: 9 个 (含 2 个集成测试)

---

## 1. API 覆盖矩阵

### 1.1 FriendSystem (353 行)

| # | API | 参数 | 返回值 | 已有测试 |
|---|-----|------|--------|---------|
| F1 | `addFriend(state, friend)` | FriendData | SocialState | ✅ |
| F2 | `removeFriend(state, playerId, now)` | string, number | SocialState | ✅ |
| F3 | `canRemoveFriend(state, playerId, now)` | string, number | boolean | ✅ |
| F4 | `canAddFriend(state)` | - | boolean | ✅ |
| F5 | `sendFriendRequest(state, from, fromName, to, now)` | 5 params | SocialState | ✅ |
| F6 | `acceptFriendRequest(state, requestId, friendData)` | 2 params | SocialState | ✅ |
| F7 | `rejectFriendRequest(state, requestId)` | string | SocialState | ✅ |
| F8 | `giftTroops(state, friendId, now)` | 2 params | {state, friendshipEarned} | ✅ |
| F9 | `visitCastle(state, friendId, now)` | 2 params | {state, copperReward} | ✅ |
| F10 | `spar(state, friendId, won, now)` | 3 params | {state, friendshipEarned} | ✅ |
| F11 | `borrowHero(state, heroId, lender, borrower, now)` | 5 params | {state, powerRatio} | ✅ |
| F12 | `returnBorrowedHero(state, borrowId)` | string | SocialState | ✅ |
| F13 | `isBorrowHeroAllowedInPvP()` | - | boolean | ✅ |
| F14 | `dailyReset(state)` | - | SocialState | ✅ |
| F15 | `getFriendList(state)` | - | FriendData[] | ✅ |
| F16 | `getOnlineFriends(state)` | - | FriendData[] | ✅ |
| F17 | `getDailyInteractionCount(state, type)` | InteractionType | number | ✅ |
| F18 | `getFriendConfig()` | - | FriendConfig | ✅ |
| F19 | `getInteractionConfig()` | - | InteractionConfig | ✅ |
| F20 | `serialize(state)` | - | SocialSaveData | ✅ |
| F21 | `deserialize(data)` | SocialSaveData | SocialState | ✅ |

### 1.2 ChatSystem (390 行)

| # | API | 参数 | 返回值 | 已有测试 |
|---|-----|------|--------|---------|
| C1 | `sendMessage(state, channel, senderId, senderName, content, now, targetId?)` | 6-7 params | {state, message} | ✅ |
| C2 | `getMessages(state, channel)` | ChatChannel | ChatMessage[] | ✅ |
| C3 | `getPrivateMessages(state, p1, p2)` | 2 strings | ChatMessage[] | ✅ |
| C4 | `getChannelConfig(channel)` | ChatChannel | ChannelConfig | ✅ |
| C5 | `mutePlayer(state, playerId, level, reason, now)` | 5 params | SocialState | ✅ |
| C6 | `isPlayerMuted(state, playerId, now)` | 2 params | boolean | ✅ |
| C7 | `getActiveMute(state, playerId, now)` | 2 params | MuteRecord \| undefined | ✅ |
| C8 | `unmutePlayer(state, playerId, now)` | 3 params | SocialState | ✅ |
| C9 | `reportMessage(state, reporterId, targetId, msgId, type, now)` | 6 params | {state, isFalseReport} | ✅ |
| C10 | `markFalseReport(state, reporterId)` | string | SocialState | ✅ |
| C11 | `cleanExpiredMessages(state, now)` | 2 params | SocialState | ✅ |
| C12 | `getAllChannelConfigs()` | - | Record | ✅ |
| C13 | `getChannelCount()` | - | number | ✅ |
| C14 | `serializeChat(state)` | - | object | ✅ |
| C15 | `deserializeChat(data)` | object | Partial<SocialState> | ✅ |

### 1.3 LeaderboardSystem (312 行)

| # | API | 参数 | 返回值 | 已有测试 |
|---|-----|------|--------|---------|
| L1 | `updateScore(type, playerId, playerName, score, metadata?)` | 4-5 params | Entry \| null | ✅ |
| L2 | `batchUpdateScores(type, updates[])` | 2 params | void | ✅ |
| L3 | `queryLeaderboard(query)` | LeaderboardQuery | LeaderboardPageResult | ✅ |
| L4 | `getPlayerRank(type, playerId)` | 2 params | Entry \| null | ✅ |
| L5 | `getAroundPlayer(type, playerId, range?)` | 3 params | Entry[] | ✅ |
| L6 | `getTopN(type, n?)` | 2 params | Entry[] | ✅ |
| L7 | `checkDailyRefresh(now)` | number | boolean | ✅ |
| L8 | `isSeasonEnded(now)` | number | boolean | ✅ |
| L9 | `endSeasonAndStartNew(now)` | number | reward[] | ✅ |
| L10 | `getRewardForRank(rank)` | number | reward \| null | ✅ |
| L11 | `getRewardConfigs()` | - | RewardConfig[] | ✅ |
| L12 | `getCurrentSeason()` | - | LeaderboardSeason | ✅ |
| L13 | `getSeasonHistory()` | - | LeaderboardSeason[] | ✅ |

### 1.4 BorrowHeroHelper (133 行)

| # | API | 参数 | 返回值 | 已有测试 |
|---|-----|------|--------|---------|
| B1 | `borrowHero(state, heroId, lender, borrower, now, calcFn)` | 6 params | {state, powerRatio} | ✅ |
| B2 | `returnBorrowedHero(state, borrowId)` | string | SocialState | ✅ |
| B3 | `isBorrowHeroAllowedInPvP()` | - | boolean | ✅ |
| B4 | `getConfig()` | - | InteractionConfig | ✅ |

### 1.5 FriendInteractionHelper (189 行)

| # | API | 参数 | 返回值 | 已有测试 |
|---|-----|------|--------|---------|
| I1 | `giftTroops(state, friendId, now)` | 3 params | {state, pointsEarned} | ✅ |
| I2 | `visitCastle(state, friendId, now)` | 3 params | {state, copperReward, pointsEarned} | ✅ |
| I3 | `spar(state, friendId, won, now)` | 4 params | {state, pointsEarned} | ✅ |
| I4 | `calculateFriendshipEarned(state, basePoints)` | 2 params | number | ✅ |
| I5 | `getDailyInteractionCount(state, type, now)` | 3 params | number | ✅ |
| I6 | `getConfig()` | - | InteractionConfig | ✅ |

---

## 2. 流程分支树

### 2.1 好友管理流程 (Friend CRUD)

```
FriendSystem
├── addFriend
│   ├── [正常] 添加好友成功
│   ├── [边界] 好友数 = maxFriends → throw "已达上限"
│   ├── [边界] 已是好友 → throw "已经是好友"
│   └── [边界] friend.playerId 为空字符串
│
├── removeFriend
│   ├── [正常] 删除好友成功 + 设置冷却
│   ├── [边界] 不是好友 → throw "不是好友"
│   ├── [边界] 冷却中 → throw "删除冷却中"
│   └── [边界] 冷却刚好到期 (now == cooldownEnd)
│
├── sendFriendRequest
│   ├── [正常] 发送申请成功
│   ├── [边界] dailyRequestsSent >= 20 → throw
│   ├── [边界] pendingRequests >= 30 → throw
│   ├── [边界] 已是好友 → throw
│   └── [边界] fromPlayerId == toPlayerId (自己申请自己)
│
├── acceptFriendRequest
│   ├── [正常] 接受成功 → 添加好友 + 移除申请
│   ├── [边界] requestId 不存在 → throw
│   ├── [边界] 接受后好友满 → addFriend throw
│   └── [边界] requestId 为空字符串
│
├── rejectFriendRequest
│   ├── [正常] 拒绝成功
│   └── [边界] requestId 不存在 → throw
│
└── dailyReset
    └── [正常] 重置所有每日计数
```

### 2.2 好友互动流程

```
FriendInteractionHelper
├── giftTroops
│   ├── [正常] 赠送成功 → +5友情点
│   ├── [边界] 达到每日上限(10次) → throw
│   ├── [边界] 好友不存在 → throw
│   ├── [边界] 友情点达到每日上限(200) → pointsEarned=0
│   └── [边界] 友情点接近上限 → 部分获得
│
├── visitCastle
│   ├── [正常] 拜访成功 → +100铜钱 +3友情点
│   ├── [边界] 达到每日上限(5次) → throw
│   ├── [边界] 好友不存在 → throw
│   └── [边界] 友情点达到每日上限 → pointsEarned=0
│
├── spar
│   ├── [正常] 胜利 → +20友情点
│   ├── [正常] 失败 → +5友情点
│   ├── [边界] 达到每日上限(3次) → throw
│   ├── [边界] 好友不存在 → throw
│   └── [边界] won=true/false 边界
│
└── calculateFriendshipEarned
    ├── [正常] 正常计算
    ├── [边界] dailyFriendshipEarned >= cap → return 0
    ├── [边界] dailyFriendshipEarned + base > cap → return 差值
    └── [边界] basePoints = 0 → return 0
```

### 2.3 借将流程

```
BorrowHeroHelper
├── borrowHero
│   ├── [正常] 借将成功 → 记录 + dailyBorrowCount+1
│   ├── [边界] dailyBorrowCount >= 3 → throw
│   ├── [边界] lenderPlayerId 不是好友 → throw
│   ├── [边界] lender 已有未归还借将 → throw
│   └── [边界] borrower == lender (自己借自己)
│
└── returnBorrowedHero
    ├── [正常] 归还成功 → returned=true
    ├── [边界] borrowId 不存在 → throw
    └── [边界] 已归还 → throw "已归还"
```

### 2.4 聊天系统流程

```
ChatSystem
├── sendMessage
│   ├── [正常] 世界频道发送成功
│   ├── [正常] 公会频道发送成功
│   ├── [正常] 私聊发送成功 (带targetId)
│   ├── [正常] 系统频道 (senderId='system')
│   ├── [边界] 系统频道 + 非system → throw
│   ├── [边界] 被禁言 → throw
│   ├── [边界] 发言间隔未到 → throw
│   ├── [边界] 私聊无targetId → throw
│   ├── [边界] 消息数达到maxMessages → 截断最旧
│   └── [边界] now = lastSendTime + interval (刚好到间隔)
│
├── mutePlayer / unmutePlayer
│   ├── [正常] 禁言3级 → 不同时长
│   ├── [正常] 解除禁言 → endTime=now
│   ├── [边界] 多次禁言叠加
│   └── [边界] 禁言已过期 → isPlayerMuted=false
│
├── reportMessage
│   ├── [正常] 举报成功
│   ├── [边界] falseReportCount >= 3 → 恶意举报 → 自动禁言
│   └── [边界] falseReportCount = 2 → 正常举报
│
├── markFalseReport
│   └── [正常] 计数+1
│
└── cleanExpiredMessages
    ├── [正常] 清理过期消息
    └── [边界] 所有消息过期 → 空数组
```

### 2.5 排行榜流程

```
LeaderboardSystem
├── updateScore
│   ├── [正常] 新增条目
│   ├── [正常] 更新已有条目(更高分)
│   ├── [边界] 同分不更新
│   ├── [边界] 更低分不更新
│   ├── [边界] 榜满 + 分数 <= 最低分 → return null
│   ├── [边界] 榜满 + 分数 > 最低分 → 替换最后一名
│   └── [边界] score = 0
│
├── queryLeaderboard
│   ├── [正常] 分页查询
│   ├── [边界] page=0 → safePage=1
│   ├── [边界] page > totalPages → safePage=totalPages
│   ├── [边界] pageSize > MAX_PAGE_SIZE → 截断
│   └── [边界] 空排行榜 → totalPages=1, entries=[]
│
├── endSeasonAndStartNew
│   ├── [正常] 结算 + 新赛季
│   ├── [边界] 空排行榜 → rewards=[]
│   └── [边界] 多类型排行榜同时结算
│
└── checkDailyRefresh / isSeasonEnded
    ├── [正常] 刷新时间到 → true
    ├── [边界] 未到刷新时间 → false
    └── [边界] now = endTime → isSeasonEnded=true
```

---

## 3. 跨系统链路

### 3.1 Friend → Chat 链路

```
FriendSystem.serialize() → 包含 chatMessages/muteRecords
ChatSystem.serializeChat() → 序列化聊天状态
共享 SocialState 对象
```

### 3.2 Friend → BorrowHero → Interaction 链路

```
FriendSystem.borrowHero()
  → BorrowHeroHelper.borrowHero()
    → 检查 friends[lenderPlayerId] (好友验证)
    → calculateFriendshipEarned() (友情点计算)
  → 返回 {state, powerRatio}
```

### 3.3 Leaderboard 独立链路

```
LeaderboardSystem 持有独立 LeaderboardState
不直接依赖 SocialState
通过 init(deps) 接入系统依赖
```

### 3.4 序列化/反序列化链路

```
FriendSystem.serialize(state) → SocialSaveData
FriendSystem.deserialize(data) → SocialState
ChatSystem.serializeChat(state) → chatData
ChatSystem.deserializeChat(data) → Partial<SocialState>
```

---

## 4. 关键数据流

### 4.1 友情点流转

```
giftTroops → +5pts → friendshipPoints += earned
visitCastle → +3pts → friendshipPoints += earned
spar(win) → +20pts → friendshipPoints += earned
spar(lose) → +5pts → friendshipPoints += earned
borrowHero → lender +10pts → friendshipPoints += earned

所有路径经过 calculateFriendshipEarned():
  remaining = cap(200) - dailyFriendshipEarned
  earned = max(0, min(basePoints, remaining))
```

### 4.2 每日重置影响

```
dailyReset() 重置:
  dailyRequestsSent → 0
  dailyInteractions → []
  dailyFriendshipEarned → 0
  dailyBorrowCount → 0
```

### 4.3 排行榜分数流转

```
updateScore → sortBoard → assignRanks
batchUpdateScores → N × updateScore
endSeasonAndStartNew → 计算奖励 → 清空boards → 新赛季
```

---

## 5. 测试盲区识别

| 编号 | 盲区 | 风险等级 | 说明 |
|------|------|---------|------|
| GAP-1 | `removeFriend` 冷却恰好到期 | 低 | `now < cooldownEnd` 用的是严格小于 |
| GAP-2 | `sendMessage` now=lastSendTime+interval | 低 | 边界值 `now - lastSend < interval` |
| GAP-3 | `deserialize` version 不匹配 | 中 | 返回默认状态，数据丢失 |
| GAP-4 | `serialize/deserialize` 循环一致性 | 中 | 序列化后反序列化应还原 |
| GAP-5 | `updateScore` score=NaN/Infinity | 高 | sortBoard 比较会异常 |
| GAP-6 | `queryLeaderboard` page=-1 | 中 | safePage 计算可能异常 |
| GAP-7 | `endSeasonAndStartNew` 连续调用 | 中 | seasonHistory 累积 |
| GAP-8 | `calculateFriendshipEarned` basePoints 为负 | 中 | Math.max(0, min(负数, remaining)) |
| GAP-9 | `generateId`/`generateMessageId` 并发碰撞 | 低 | Date.now + random 概率极低 |
| GAP-10 | `mutePlayer` 同一玩家多次禁言叠加 | 中 | some() 检查任意一条生效即可 |
| GAP-11 | `cleanExpiredMessages` 跨频道一致性 | 低 | 各频道独立清理 |
| GAP-12 | `reportMessage` 自举报 (reporterId==targetId) | 低 | 无此检查 |
| GAP-13 | `borrowHero` borrowerId == lenderPlayerId | 低 | 无自借检查 |
| GAP-14 | `sendFriendRequest` fromPlayerId == toPlayerId | 低 | 无自申请检查 |
| GAP-15 | `LeaderboardSystem` 状态可变性 | 高 | getState() 返回可变引用 |
