# Social 模块 R2 对抗式测试 — Builder 精简测试树

> 生成时间: 2025-07-11 (R2 封版轮)
> 模块: `engine/social/` (1808 行, 8 文件)
> R1 评分: 5.8/10 → R1 Fixer 修复 11 个 P0 → R2 精简验证

---

## 1. R1 FIX 穿透验证

### 1.1 P0 修复状态确认

| P0# | 问题 | 修复位置 | 穿透验证 |
|-----|------|---------|---------|
| P0-01 | engine-save 未接入 Social | engine-save.ts:304-305,816-827; engine-save-migration.ts:57-58,104-105 | ✅ social/leaderboard 字段已加入 |
| P0-02 | updateScore NaN/Infinity | LeaderboardSystem.ts:77 `!Number.isFinite(score) \|\| score < 0` | ✅ |
| P0-03 | sendMessage 时间回拨 | ChatSystem.ts:135 `now < lastSend` throw | ✅ |
| P0-04 | getTodayInteractions NaN 绕过 | FriendInteractionHelper.ts:47 `!Number.isFinite(now)` | ✅ |
| P0-05 | sendMessage NaN 绕过 | ChatSystem.ts:116 `!Number.isFinite(now)` | ✅ |
| P0-06 | 自申请校验 | FriendSystem.ts:137-138 `fromPlayerId === toPlayerId` | ✅ |
| P0-07 | 自借将校验 | BorrowHeroHelper.ts:65-66 `borrowerPlayerId === lenderPlayerId` | ✅ |
| P0-08 | deserialize 版本迁移 | FriendSystem.ts:352 兼容恢复 | ✅ |
| P0-09 | metadata 浅拷贝 | LeaderboardSystem.ts 新增 `{ ...metadata }` | ✅ |
| P0-10 | friendshipPoints 上限 | calculateFriendshipEarned cap=200 闭环 | ✅ |
| P0-11 | LeaderboardSystem serialize | LeaderboardSystem.ts:292-316 serialize/deserialize | ✅ |
| P0-12 | getState 可变引用 | LeaderboardSystem.ts:50 `JSON.parse(JSON.stringify(...))` | ✅ |

**穿透率: 12/12 = 100%**

---

## 2. R2 精简分支树

> 策略：移除 R1 已修复的 BUG 分支（标 ❌），保留回归验证节点（标 🔄），聚焦新维度探索

### 2.1 好友管理 (FriendSystem — 21 API)

```
FriendSystem
├── addFriend
│   ├── [F-Normal] 添加好友成功 → ✅ (回归)
│   ├── [F-Boundary] 好友数 = 50 → throw → ✅ (回归)
│   └── [F-Boundary] 重复添加 → throw → ✅ (回归)
│
├── removeFriend
│   ├── [F-Normal] 删除成功 + 冷却 → ✅ (回归)
│   ├── [F-Boundary] 冷却中 → throw → ✅ (回归)
│   └── [F-Error] now=NaN → ❌ (R1 BUG 已修复: NaN 防护)
│       → 🔄 [回归] now=NaN → throw (验证防护生效)
│
├── sendFriendRequest
│   ├── [F-Normal] 发送成功 → ✅ (回归)
│   ├── [F-Boundary] dailyRequestsSent >= 20 → throw → ✅ (回归)
│   ├── [F-Boundary] pendingRequests >= 30 → throw → ✅ (回归)
│   ├── [F-Error] fromPlayerId === toPlayerId → ❌ (R1 BUG 已修复)
│       → 🔄 [回归] 自申请 → throw "不能对自己发送好友申请"
│   └── [F-Error] now=NaN → ❌ (R1 BUG 已修复)
│
├── acceptFriendRequest
│   ├── [F-Normal] 接受成功 → ✅ (回归)
│   └── [F-Boundary] requestId 不存在 → throw → ✅ (回归)
│
├── serialize / deserialize
│   ├── [F-Normal] 序列化→反序列化 往返一致 → ✅ (回归)
│   ├── [F-Error] data=null → 返回默认状态 → ✅ (回归)
│   └── [F-Error] 版本不匹配 → ❌ (R1 已修复: 兼容恢复)
│       → 🔄 [回归] 版本不匹配 → 兼容恢复 + console.warn
```

### 2.2 好友互动 (FriendInteractionHelper — 6 API)

```
FriendInteractionHelper
├── giftTroops
│   ├── [F-Normal] 赠送成功 → +5pts → ✅ (回归)
│   ├── [F-Boundary] 今日次数 = 10 → throw → ✅ (回归)
│   ├── [F-Boundary] dailyFriendshipEarned >= 200 → earned=0 → ✅ (回归)
│   └── [F-Error] now=NaN → ❌ (R1 BUG 已修复: NaN 防护)
│       → 🔄 [回归] now=NaN → throw
│
├── visitCastle
│   ├── [F-Normal] 拜访成功 → +100铜钱 +3pts → ✅ (回归)
│   └── [F-Boundary] 今日次数 = 5 → throw → ✅ (回归)
│
├── spar
│   ├── [F-Normal] 胜利 +20pts / 失败 +5pts → ✅ (回归)
│   └── [F-Boundary] 今日次数 = 3 → throw → ✅ (回归)
│
└── calculateFriendshipEarned
    ├── [F-Normal] 正常计算 → ✅ (回归)
    └── [F-Boundary] dailyFriendshipEarned + base > cap → 返回差值 → ✅ (回归)
```

### 2.3 借将 (BorrowHeroHelper — 4 API)

```
BorrowHeroHelper
├── borrowHero
│   ├── [F-Normal] 借将成功 → ✅ (回归)
│   ├── [F-Boundary] dailyBorrowCount >= 3 → throw → ✅ (回归)
│   ├── [F-Error] borrower === lender → ❌ (R1 已修复)
│       → 🔄 [回归] 自借 → throw "不能向自己借将"
│   └── [F-Boundary] lender 有未归还借将 → throw → ✅ (回归)
│
└── returnBorrowedHero
    ├── [F-Normal] 归还成功 → ✅ (回归)
    └── [F-Boundary] 已归还 → throw → ✅ (回归)
```

### 2.4 聊天 (ChatSystem — 15 API)

```
ChatSystem
├── sendMessage
│   ├── [F-Normal] 世界/公会/私聊/系统频道 → ✅ (回归)
│   ├── [F-Boundary] 系统频道权限 → throw → ✅ (回归)
│   ├── [F-Boundary] 被禁言 → throw → ✅ (回归)
│   ├── [F-Boundary] 发言间隔未到 → throw → ✅ (回归)
│   ├── [F-Error] now=NaN → ❌ (R1 已修复: NaN 防护)
│       → 🔄 [回归] now=NaN → throw
│   └── [F-Error] 时间回拨 → ❌ (R1 已修复)
│       → 🔄 [回归] now < lastSend → throw "发送时间不能早于上次发言时间"
│
├── mutePlayer / unmutePlayer
│   ├── [F-Normal] 禁言/解除 → ✅ (回归)
│   └── [F-Boundary] 禁言恰好到期 → false → ✅ (回归)
│
├── reportMessage
│   ├── [F-Normal] 举报成功 → ✅ (回归)
│   └── [F-Boundary] falseReportCounts >= 3 → 自动禁言 → ✅ (回归)
│
├── serializeChat / deserializeChat
│   ├── [F-Normal] 往返一致 → ✅ (回归)
│   └── [F-Error] data=null → 返回默认 → ✅ (回归)
│
└── cleanExpiredMessages
    ├── [F-Normal] 清理过期 → ✅ (回归)
    └── [F-Boundary] 全部过期 → 空数组 → ✅ (回归)
```

### 2.5 排行榜 (LeaderboardSystem — 15 API, 含 serialize/deserialize)

```
LeaderboardSystem
├── updateScore
│   ├── [F-Normal] 新增/更新条目 → ✅ (回归)
│   ├── [F-Boundary] 同分 → 不更新 → ✅ (回归)
│   ├── [F-Boundary] 榜满 + 分数 <= 最低分 → null → ✅ (回归)
│   ├── [F-Error] score=NaN → ❌ (R1 已修复)
│       → 🔄 [回归] score=NaN → throw "无效分数"
│   ├── [F-Error] score=Infinity → ❌ (R1 已修复)
│       → 🔄 [回归] score=Infinity → throw
│   └── [F-Error] score=-1 → ❌ (R1 已修复)
│       → 🔄 [回归] score=-1 → throw
│
├── queryLeaderboard
│   ├── [F-Normal] 分页查询 → ✅ (回归)
│   ├── [F-Boundary] page=0 → safePage=1 → ✅ (回归)
│   └── [F-Boundary] pageSize > 20 → 截断 → ✅ (回归)
│
├── endSeasonAndStartNew
│   ├── [F-Normal] 结算 → 奖励 → 新赛季 → ✅ (回归)
│   └── [F-Boundary] 空排行榜 → rewards=[] → ✅ (回归)
│
├── serialize / deserialize (R1 新增)
│   ├── [F-Normal] serialize → deserialize 往返一致 → ✅ (回归)
│   ├── [F-Error] data=null → 返回默认 → ✅ (回归)
│   └── [F-Error] data 缺少 boards/currentSeason → 返回默认 → ✅ (回归)
│
└── getState / getCurrentSeason / getSeasonHistory
    ├── [F-Normal] 返回深拷贝 → ✅ (回归)
    └── [F-Error] 外部修改不影响内部 → ✅ (回归)
```

### 2.6 跨系统链路 (engine-save 接入)

```
engine-save 完整链路 (R1 修复后):
├── buildSaveData
│   ├── social = friendSystem.serialize(state) → ✅ (已接入)
│   └── leaderboard = socialLeaderboardSystem.serialize() → ✅ (已接入)
│
├── applySaveData
│   ├── friendSystem.deserialize(data.social) → ✅ (已接入)
│   └── socialLeaderboardSystem.deserialize(data.leaderboard) → ✅ (已接入)
│
├── engine-save-migration
│   ├── toIGameState → social/leaderboard 字段传递 → ✅ (已接入)
│   └── fromIGameState → social/leaderboard 字段还原 → ✅ (已接入)
│
└── 🔄 [回归] 完整 save → load 往返 → 社交数据不丢失
```

---

## 3. R2 新维度探索

### 3.1 并发安全 (新增)

```
并发场景:
├── 同帧多次 giftTroops → dailyInteractions 累加是否正确
├── 同帧 sendFriendRequest + acceptFriendRequest → 事务一致性
└── endSeasonAndStartNew 中途异常 → 排行榜是否半损
```

### 3.2 大数据量压力 (新增)

```
压力场景:
├── 好友满 50 × 每日全互动 → dailyInteractions 长度
├── 排行榜满 1000 × batchUpdateScores(1000) → 性能
└── 聊天消息满 100 × 连续发送 → 截断正确性
```

### 3.3 边界值精确验证 (新增)

```
精确边界:
├── friendshipPoints 恰好 = 200 → 下次 earned = 0
├── 发言间隔 = interval + 1ms → 成功
├── 冷却时间 = cooldownEnd + 1ms → 可删除
└── 排行榜 999/1000 → 再加一条触发满员
```

---

## 4. R2 节点统计

| 类别 | R1 节点 | R2 移除(已修复BUG) | R2 回归验证 | R2 新增 | R2 总计 |
|------|---------|-------------------|------------|---------|---------|
| FriendSystem | 28 | 3 | 25 | 0 | 25 |
| FriendInteraction | 18 | 3 | 15 | 0 | 15 |
| BorrowHero | 8 | 1 | 7 | 0 | 7 |
| ChatSystem | 24 | 2 | 22 | 0 | 22 |
| LeaderboardSystem | 22 | 3 | 19 | 0 | 19 |
| 跨系统链路 | 6 | 0 | 6 | 3 | 9 |
| 新维度探索 | 0 | 0 | 0 | 10 | 10 |
| **合计** | **106** | **12** | **94** | **13** | **107** |

**R2 策略**: 12 个 BUG 节点转为回归验证 + 13 个新维度节点 → 总计 107 节点
