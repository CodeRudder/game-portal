# Social 模块 R1 对抗式测试 — Builder 测试分支树

> 生成时间: 2025-07-11 (R1 正式版)
> 模块: `engine/social/`
> 源文件: 8 个 (1524 行)
> 测试文件: 11 个 (含 2 个集成测试, 3851 行)
> Builder 规则: v1.9 (22 条通用规则 + 5 条三国特定规则)

---

## 1. API 覆盖矩阵

### 1.1 FriendSystem (353 行) — 21 个公开 API

| # | API | 参数 | 返回值 | F-Normal | 数值校验 | Serialize |
|---|-----|------|--------|----------|---------|-----------|
| F1 | `addFriend(state, friend)` | FriendData | SocialState | ✅ | — | — |
| F2 | `removeFriend(state, playerId, now)` | string, number | SocialState | ✅ | now 未校验 | — |
| F3 | `canRemoveFriend(state, playerId, now)` | string, number | boolean | ✅ | — | — |
| F4 | `canAddFriend(state)` | - | boolean | ✅ | — | — |
| F5 | `sendFriendRequest(state, from, fromName, to, now)` | 5 params | SocialState | ✅ | now 未校验 | — |
| F6 | `acceptFriendRequest(state, requestId, friendData)` | 2 params | SocialState | ✅ | — | — |
| F7 | `rejectFriendRequest(state, requestId)` | string | SocialState | ✅ | — | — |
| F8 | `giftTroops(state, friendId, now)` | 2 params | {state, friendshipEarned} | ✅ | now 未校验 | — |
| F9 | `visitCastle(state, friendId, now)` | 2 params | {state, copperReward} | ✅ | now 未校验 | — |
| F10 | `spar(state, friendId, won, now)` | 3 params | {state, friendshipEarned} | ✅ | now 未校验 | — |
| F11 | `borrowHero(state, heroId, lender, borrower, now)` | 5 params | {state, powerRatio} | ✅ | now 未校验 | — |
| F12 | `returnBorrowedHero(state, borrowId)` | string | SocialState | ✅ | — | — |
| F13 | `isBorrowHeroAllowedInPvP()` | - | boolean | ✅ | — | — |
| F14 | `dailyReset(state)` | - | SocialState | ✅ | — | — |
| F15 | `getFriendList(state)` | - | FriendData[] | ✅ | — | — |
| F16 | `getOnlineFriends(state)` | - | FriendData[] | ✅ | — | — |
| F17 | `getDailyInteractionCount(state, type)` | InteractionType | number | ✅ | — | — |
| F18 | `getFriendConfig()` | - | FriendConfig | ✅ | — | — |
| F19 | `getInteractionConfig()` | - | InteractionConfig | ✅ | — | — |
| F20 | `serialize(state)` | SocialState | SocialSaveData | ✅ | — | ✅ |
| F21 | `deserialize(data)` | SocialSaveData | SocialState | ✅ | — | ✅ |

### 1.2 ChatSystem (390 行) — 15 个公开 API

| # | API | 参数 | 返回值 | F-Normal | 数值校验 | Serialize |
|---|-----|------|--------|----------|---------|-----------|
| C1 | `sendMessage(state, channel, senderId, senderName, content, now, targetId?)` | 6-7 params | {state, message} | ✅ | now 未校验 | — |
| C2 | `getMessages(state, channel)` | ChatChannel | ChatMessage[] | ✅ | — | — |
| C3 | `getPrivateMessages(state, p1, p2)` | 2 strings | ChatMessage[] | ✅ | — | — |
| C4 | `getChannelConfig(channel)` | ChatChannel | ChannelConfig | ✅ | — | — |
| C5 | `mutePlayer(state, playerId, level, reason, now)` | 5 params | SocialState | ✅ | now 未校验 | — |
| C6 | `isPlayerMuted(state, playerId, now)` | 2 params | boolean | ✅ | — | — |
| C7 | `getActiveMute(state, playerId, now)` | 2 params | MuteRecord \| undefined | ✅ | — | — |
| C8 | `unmutePlayer(state, playerId, now)` | 3 params | SocialState | ✅ | now 未校验 | — |
| C9 | `reportMessage(state, reporterId, targetId, msgId, type, now)` | 6 params | {state, isFalseReport} | ✅ | now 未校验 | — |
| C10 | `markFalseReport(state, reporterId)` | string | SocialState | ✅ | — | — |
| C11 | `cleanExpiredMessages(state, now)` | 2 params | SocialState | ✅ | now 未校验 | — |
| C12 | `getAllChannelConfigs()` | - | Record | ✅ | — | — |
| C13 | `getChannelCount()` | - | number | ✅ | — | — |
| C14 | `serializeChat(state)` | SocialState | object | ✅ | — | ✅ |
| C15 | `deserializeChat(data)` | object | Partial<SocialState> | ✅ | — | ✅ |

### 1.3 LeaderboardSystem (312 行) — 13 个公开 API

| # | API | 参数 | 返回值 | F-Normal | 数值校验 | Serialize |
|---|-----|------|--------|----------|---------|-----------|
| L1 | `updateScore(type, playerId, playerName, score, metadata?)` | 4-5 params | Entry \| null | ✅ | **score 未校验** | — |
| L2 | `batchUpdateScores(type, updates[])` | 2 params | void | ✅ | — | — |
| L3 | `queryLeaderboard(query)` | LeaderboardQuery | LeaderboardPageResult | ✅ | — | — |
| L4 | `getPlayerRank(type, playerId)` | 2 params | Entry \| null | ✅ | — | — |
| L5 | `getAroundPlayer(type, playerId, range?)` | 3 params | Entry[] | ✅ | — | — |
| L6 | `getTopN(type, n?)` | 2 params | Entry[] | ✅ | — | — |
| L7 | `checkDailyRefresh(now)` | number | boolean | ✅ | — | — |
| L8 | `isSeasonEnded(now)` | number | boolean | ✅ | — | — |
| L9 | `endSeasonAndStartNew(now)` | number | reward[] | ✅ | — | — |
| L10 | `getRewardForRank(rank)` | number | reward \| null | ✅ | — | — |
| L11 | `getRewardConfigs()` | - | RewardConfig[] | ✅ | — | — |
| L12 | `getCurrentSeason()` | - | LeaderboardSeason | ✅ | — | — |
| L13 | `getSeasonHistory()` | - | LeaderboardSeason[] | ✅ | — | — |

### 1.4 BorrowHeroHelper (133 行) — 4 个公开 API

| # | API | 参数 | 返回值 | F-Normal | 数值校验 |
|---|-----|------|--------|----------|---------|
| B1 | `borrowHero(state, heroId, lender, borrower, now, calcFn)` | 6 params | {state, powerRatio} | ✅ | now 未校验 |
| B2 | `returnBorrowedHero(state, borrowId)` | string | SocialState | ✅ | — |
| B3 | `isBorrowHeroAllowedInPvP()` | - | boolean | ✅ | — |
| B4 | `getConfig()` | - | InteractionConfig | ✅ | — |

### 1.5 FriendInteractionHelper (189 行) — 6 个公开 API

| # | API | 参数 | 返回值 | F-Normal | 数值校验 |
|---|-----|------|--------|----------|---------|
| I1 | `giftTroops(state, friendId, now)` | 3 params | {state, pointsEarned} | ✅ | now 未校验 |
| I2 | `visitCastle(state, friendId, now)` | 3 params | {state, copperReward, pointsEarned} | ✅ | now 未校验 |
| I3 | `spar(state, friendId, won, now)` | 4 params | {state, pointsEarned} | ✅ | now 未校验 |
| I4 | `calculateFriendshipEarned(state, basePoints)` | 2 params | number | ✅ | basePoints 未校验 |
| I5 | `getDailyInteractionCount(state, type, now)` | 3 params | number | ✅ | — |
| I6 | `getConfig()` | - | InteractionConfig | ✅ | — |

**API 覆盖率: 59/59 = 100%**

---

## 2. 流程分支树

### 2.1 好友管理流程 (Friend CRUD)

```
FriendSystem
├── addFriend
│   ├── [F-Normal] 添加好友成功 → friends[playerId] = friend
│   ├── [F-Boundary] 好友数 = maxFriends(50) → throw "已达上限"
│   ├── [F-Boundary] friends[playerId] 已存在 → throw "已经是好友"
│   ├── [F-Error] friend = null → state.friends[null] 不报错但污染状态
│   └── [F-Error] friend.playerId = "" → 空字符串作为key
│
├── removeFriend
│   ├── [F-Normal] 删除好友成功 + 设置冷却
│   ├── [F-Boundary] 不是好友 → throw "不是好友"
│   ├── [F-Boundary] 冷却中 (now < cooldownEnd) → throw "删除冷却中"
│   ├── [F-Boundary] 冷却恰好到期 (now == cooldownEnd) → 成功
│   └── [F-Error] now = NaN → NaN < cooldownEnd 为 false → 可删除
│
├── canRemoveFriend
│   ├── [F-Normal] 可删除 → true
│   ├── [F-Normal] 不是好友 → false
│   └── [F-Boundary] 冷却恰好到期 → true
│
├── sendFriendRequest
│   ├── [F-Normal] 发送申请成功
│   ├── [F-Boundary] dailyRequestsSent >= 20 → throw
│   ├── [F-Boundary] pendingRequests.length >= 30 → throw
│   ├── [F-Boundary] friends[toPlayerId] 已存在 → throw
│   ├── [F-Error] fromPlayerId === toPlayerId → 允许自申请 (BUG)
│   └── [F-Error] now = NaN → timestamp=NaN
│
├── acceptFriendRequest
│   ├── [F-Normal] 接受成功 → 添加好友 + 移除申请
│   ├── [F-Boundary] requestId 不存在 → throw
│   ├── [F-Boundary] 接受后好友满 → addFriend throw (事务性：申请已移除但好友未添加)
│   └── [F-Error] requestId = "" → find 返回 undefined → throw
│
├── rejectFriendRequest
│   ├── [F-Normal] 拒绝成功
│   └── [F-Boundary] requestId 不存在 → throw
│
└── dailyReset
    └── [F-Normal] 重置所有每日计数 → dailyRequestsSent=0, dailyInteractions=[], dailyFriendshipEarned=0, dailyBorrowCount=0
```

### 2.2 好友互动流程

```
FriendInteractionHelper
├── giftTroops
│   ├── [F-Normal] 赠送成功 → +5友情点, dailyInteractions +1
│   ├── [F-Boundary] 今日赠送次数 = 10 → throw
│   ├── [F-Boundary] 好友不存在 → throw
│   ├── [F-Boundary] dailyFriendshipEarned >= 200 → pointsEarned=0
│   ├── [F-Boundary] dailyFriendshipEarned=198, basePoints=5 → pointsEarned=2
│   └── [F-Error] now = NaN → new Date(NaN).setHours() = NaN → 所有记录都 >= NaN 为 false → 0条记录 → 可无限赠送
│
├── visitCastle
│   ├── [F-Normal] 拜访成功 → +100铜钱 +3友情点
│   ├── [F-Boundary] 今日拜访次数 = 5 → throw
│   ├── [F-Boundary] 好友不存在 → throw
│   └── [F-Error] now = NaN → 同 giftTroops NaN 绕过
│
├── spar
│   ├── [F-Normal] 胜利 → +20友情点
│   ├── [F-Normal] 失败 → +5友情点
│   ├── [F-Boundary] 今日切磋次数 = 3 → throw
│   ├── [F-Boundary] 好友不存在 → throw
│   └── [F-Error] now = NaN → 同上 NaN 绕过
│
└── calculateFriendshipEarned
    ├── [F-Normal] 正常计算 → max(0, min(basePoints, remaining))
    ├── [F-Boundary] dailyFriendshipEarned >= cap → return 0
    ├── [F-Boundary] dailyFriendshipEarned + base > cap → return 差值
    ├── [F-Error] basePoints = NaN → Math.max(0, min(NaN, remaining)) = Math.max(0, NaN) = 0
    └── [F-Error] basePoints = -1 → Math.max(0, min(-1, remaining)) = 0 (安全)
```

### 2.3 借将流程

```
BorrowHeroHelper
├── borrowHero
│   ├── [F-Normal] 借将成功 → 记录 + dailyBorrowCount+1 + 友情点
│   ├── [F-Boundary] dailyBorrowCount >= 3 → throw
│   ├── [F-Boundary] lenderPlayerId 不是好友 → throw
│   ├── [F-Boundary] lender 已有未归还借将 → throw
│   ├── [F-Error] borrowerPlayerId === lenderPlayerId → 允许自借 (BUG)
│   └── [F-Error] heroId = "" → 允许空武将ID
│
└── returnBorrowedHero
    ├── [F-Normal] 归还成功 → returned=true
    ├── [F-Boundary] borrowId 不存在 → throw
    └── [F-Boundary] 已归还 → throw "已归还"
```

### 2.4 聊天系统流程

```
ChatSystem
├── sendMessage
│   ├── [F-Normal] 世界频道发送成功
│   ├── [F-Normal] 公会频道发送成功
│   ├── [F-Normal] 私聊发送成功 (带targetId)
│   ├── [F-Normal] 系统频道 (senderId='system')
│   ├── [F-Boundary] 系统频道 + senderId !== 'system' → throw
│   ├── [F-Boundary] 被禁言 → throw
│   ├── [F-Boundary] 发言间隔未到 (now - lastSend < interval) → throw
│   ├── [F-Boundary] now = lastSendTime + interval → 刚好到间隔 → 成功
│   ├── [F-Boundary] 私聊无 targetId → throw
│   ├── [F-Boundary] 消息数 = maxMessages → 截断最旧
│   ├── [F-Error] now = NaN → NaN - lastSend = NaN, NaN < interval 为 false → 发言间隔检查被绕过
│   └── [F-Error] content = "" → 允许空消息
│
├── mutePlayer
│   ├── [F-Normal] 禁言成功 → muteRecords +1
│   ├── [F-Boundary] 同一玩家多次禁言 → 叠加 (some() 检查任一生效)
│   └── [F-Error] now = NaN → endTime = NaN + duration = NaN
│
├── unmutePlayer
│   ├── [F-Normal] 解除禁言 → endTime=now
│   ├── [F-Boundary] 无禁言记录 → 无操作
│   └── [F-Error] now = NaN → NaN >= startTime && NaN < NaN → false → 无匹配
│
├── isPlayerMuted
│   ├── [F-Normal] 被禁言 → true
│   ├── [F-Normal] 未被禁言 → false
│   ├── [F-Boundary] 禁言恰好到期 (now == endTime) → false
│   └── [F-Error] now = NaN → NaN >= r.startTime && NaN < r.endTime → false → 未被禁言
│
├── reportMessage
│   ├── [F-Normal] 举报成功 → reportRecords +1
│   ├── [F-Boundary] falseReportCounts >= 3 → 恶意举报 → 自动禁言举报者
│   ├── [F-Boundary] falseReportCounts = 2 → 正常举报
│   └── [F-Error] reporterId === targetId → 允许自举报
│
├── markFalseReport
│   └── [F-Normal] falseReportCounts[reporterId] +1
│
└── cleanExpiredMessages
    ├── [F-Normal] 清理过期消息
    ├── [F-Boundary] 所有消息过期 → 空数组
    └── [F-Error] now = NaN → cutoff = NaN - retentionMs = NaN → NaN >= NaN 为 false → 清空所有消息
```

### 2.5 排行榜流程

```
LeaderboardSystem
├── updateScore
│   ├── [F-Normal] 新增条目 → 排序 → 分配排名
│   ├── [F-Normal] 更新已有条目(更高分) → 更新 score + achievedAt
│   ├── [F-Boundary] 同分 → 不更新
│   ├── [F-Boundary] 更低分 → 不更新
│   ├── [F-Boundary] 榜满 + 分数 <= 最低分 → return null
│   ├── [F-Boundary] 榜满 + 分数 > 最低分 → 替换最后一名
│   ├── [F-Error] score = NaN → sortBoard 比较返回 NaN → 排序崩溃
│   ├── [F-Error] score = Infinity → 可入榜但 Infinity 不能序列化
│   ├── [F-Error] score = -1 → 负数可入榜
│   └── [F-Error] playerName = "" → 允许空名称
│
├── queryLeaderboard
│   ├── [F-Normal] 分页查询
│   ├── [F-Boundary] page=0 → safePage=1
│   ├── [F-Boundary] page > totalPages → safePage=totalPages
│   ├── [F-Boundary] pageSize > MAX_PAGE_SIZE(20) → 截断为20
│   ├── [F-Boundary] 空排行榜 → totalPages=1, entries=[]
│   └── [F-Error] page=-1 → safePage = min(max(1,-1), totalPages) = 1 (安全)
│
├── endSeasonAndStartNew
│   ├── [F-Normal] 结算 → 保存历史 → 清空 → 新赛季
│   ├── [F-Boundary] 空排行榜 → rewards=[]
│   ├── [F-Boundary] 多类型排行榜同时结算
│   └── [F-Error] now = NaN → endTime = NaN → isSeasonEnded(NaN) = false (安全)
│
├── checkDailyRefresh
│   ├── [F-Normal] 刷新时间到 → true
│   ├── [F-Boundary] 未到刷新时间 → false
│   └── [F-Error] now = NaN → NaN - lastRefreshTime = NaN >= DAILY_REFRESH_MS → false (安全)
│
└── getTopN / getAroundPlayer / getPlayerRank
    ├── [F-Normal] 查询成功
    └── [F-Boundary] 玩家不在榜 → null/[]
```

---

## 3. 跨系统链路

### 3.1 engine-save 接入检查 (BR-014/BR-024)

```
Social 模块注册链路:
  engine-extended-deps.ts:87-89 → friendSystem, chatSystem, socialLeaderboardSystem
  engine-extended-deps.ts:141-143 → new FriendSystem/ChatSystem/LeaderboardSystem
  engine-extended-deps.ts:196 → registry.register('socialLeaderboard', ...)

engine-save 接入检查:
  GameSaveData (shared/types.ts:216) → ❌ 无 social/friend/chat/leaderboard 字段
  buildSaveData (engine-save.ts:152) → ❌ 未调用 FriendSystem.serialize() 或 ChatSystem.serializeChat()
  applySaveData → ❌ 未调用 FriendSystem.deserialize() 或 ChatSystem.deserializeChat()

结论: Social 模块完全未接入 engine-save，所有社交数据（好友、聊天、排行榜）在保存/加载时丢失！
```

### 3.2 Friend → Chat 共享 SocialState

```
FriendSystem.serialize() → 包含 chatMessages/muteRecords/reportRecords
ChatSystem.serializeChat() → 序列化聊天状态
两者共享同一个 SocialState 对象，但序列化路径不一致：
  FriendSystem.serialize() 序列化整个 SocialState
  ChatSystem.serializeChat() 只序列化聊天部分
  如果两者都被调用 → 重复序列化
  如果只有 FriendSystem 被调用 → ChatSystem 的 deserializeChat 永远不被调用
```

### 3.3 Friend → BorrowHero → Interaction 链路

```
FriendSystem.borrowHero()
  → BorrowHeroHelper.borrowHero()
    → 检查 friends[lenderPlayerId] (好友验证)
    → calculateFriendshipEarned() (友情点计算回调)
  → 返回 {state, powerRatio}
```

### 3.4 Leaderboard 独立链路

```
LeaderboardSystem 持有独立 LeaderboardState (this.state)
不直接依赖 SocialState
通过 init(deps) 接入系统依赖
但 engine-save 未保存 LeaderboardState → 排行榜数据丢失
```

### 3.5 序列化/反序列化链路

```
FriendSystem:
  serialize(state) → SocialSaveData { version, state }
  deserialize(data) → SocialState (版本不匹配 → 返回默认状态，数据丢失)

ChatSystem:
  serializeChat(state) → { chatMessages, lastSendTime, muteRecords }
  deserializeChat(data) → Partial<SocialState> (data 为 null → 使用默认值)

LeaderboardSystem:
  无 serialize/deserialize 方法！
  getState() 返回可变内部引用 → 外部可直接修改
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

溢出闭环: friendshipPoints 无上限常量 (BR-22 违规)
```

### 4.2 每日重置影响

```
dailyReset() 重置:
  dailyRequestsSent → 0
  dailyInteractions → []
  dailyFriendshipEarned → 0
  dailyBorrowCount → 0

注意: 不重置 friendshipPoints (余额跨日保留)
      不重置 deleteCooldowns (冷却跨日保留)
      不重置 activeBorrows (借将跨日保留)
```

### 4.3 排行榜分数流转

```
updateScore → sortBoard → assignRanks
batchUpdateScores → N × updateScore
endSeasonAndStartNew → 计算奖励 → 清空boards → 新赛季
```

---

## 5. 测试盲区识别

| 编号 | 盲区 | 风险等级 | 规则引用 | 说明 |
|------|------|---------|---------|------|
| GAP-01 | **engine-save 未接入 Social** | **CRITICAL** | BR-014, BR-024 | GameSaveData 无 social 字段，buildSaveData 未调用 serialize |
| GAP-02 | `updateScore` score=NaN/Infinity | **CRITICAL** | BR-01, BR-17 | sortBoard 比较返回 NaN，排序崩溃 |
| GAP-03 | `LeaderboardSystem.getState()` 返回可变引用 | **CRITICAL** | BR-07 | 外部可直接修改内部状态 |
| GAP-04 | `getTodayInteractions` now=NaN 绕过每日限制 | **CRITICAL** | BR-01 | NaN >= NaN 为 false → 0条记录 → 无限互动 |
| GAP-05 | `sendMessage` now=NaN 绕过发言间隔 | **HIGH** | BR-01 | NaN - lastSend = NaN < interval 为 false → 无限发言 |
| GAP-06 | `sendFriendRequest` fromPlayerId === toPlayerId | **MEDIUM** | — | 允许自申请 |
| GAP-07 | `borrowHero` borrower === lender | **MEDIUM** | — | 允许自借 |
| GAP-08 | `deserialize` 版本不匹配静默丢弃 | **MEDIUM** | BR-10 | 返回默认状态，数据丢失 |
| GAP-09 | `deserializeChat` data=null 安全 | **MEDIUM** | BR-10 | 已有 ?? 默认值保护 |
| GAP-10 | `updateScore` metadata 直接引用 | **MEDIUM** | BR-07 | 新增条目时 metadata 未拷贝 |
| GAP-11 | `getTodayInteractions` 时区依赖 | **MEDIUM** | — | new Date(now).setHours 依赖本地时区 |
| GAP-12 | `endSeasonAndStartNew` 奖励无显式上限 | **LOW** | — | 依赖 getRewardForRank 返回 null |
| GAP-13 | `friendshipPoints` 无上限常量 | **MEDIUM** | BR-22 | 累积型系统无上限 |
| GAP-14 | `LeaderboardSystem` 无 serialize/deserialize | **HIGH** | BR-14 | 排行榜状态无法持久化 |
| GAP-15 | `sendMessage` content="" 允许空消息 | **LOW** | — | 无内容校验 |
