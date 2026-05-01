# Social 模块 R1 对抗式测试 — Challenger 挑战报告

> 生成时间: 2025-07-11
> 审查范围: 8 个源文件, 1724 行
> 挑战策略: 23 个 P0 模式逐项扫描

---

## P0 模式扫描清单

| # | P0 模式 | 是否命中 | 涉及文件 |
|---|---------|---------|---------|
| 1 | NaN 传播 | YES | LeaderboardSystem.ts |
| 2 | null/undefined 解引用 | YES | ChatSystem.ts, FriendSystem.ts |
| 3 | 序列化/反序列化不一致 | YES | FriendSystem.ts, ChatSystem.ts |
| 4 | 状态机非法转换 | LOW | BorrowHeroHelper.ts |
| 5 | 整数溢出 | LOW | LeaderboardSystem.ts |
| 6 | 时间回拨 | YES | ChatSystem.ts, FriendInteractionHelper.ts |
| 7 | 引用泄漏 (可变状态) | YES | LeaderboardSystem.ts |
| 8 | 边界值 off-by-one | YES | ChatSystem.ts |
| 9 | 空字符串/空对象注入 | LOW | FriendSystem.ts |
| 10 | 类型强制转换 | LOW | leaderboard-types.ts |
| 11 | 并发竞态 | LOW | generateId 函数 |
| 12 | 数组越界 | LOW | LeaderboardSystem.ts |
| 13 | 正则/字符串注入 | LOW | ChatSystem.ts |
| 14 | 权限绕过 | YES | ChatSystem.ts |
| 15 | 资源耗尽 (DoS) | YES | FriendSystem.ts |
| 16 | 循环引用序列化 | LOW | FriendSystem.ts |
| 17 | 原型污染 | LOW | 无对象合并 |
| 18 | 比较运算符错误 | YES | FriendInteractionHelper.ts |
| 19 | 浮点精度 | LOW | BorrowHeroHelper.ts |
| 20 | 默认参数覆盖 | LOW | ChatSystem.ts |
| 21 | 枚举越界 | LOW | ChatChannel |
| 22 | 每日重置竞态 | YES | FriendInteractionHelper.ts |
| 23 | 存档版本降级 | YES | FriendSystem.ts |

---

## 确认的 P0 漏洞

### P0-01: LeaderboardSystem.getState() 返回可变内部引用

**严重程度**: P0-CRITICAL (数据完整性)
**文件**: `LeaderboardSystem.ts:65-67`
**模式**: 引用泄漏 (#7)

```typescript
getState(): LeaderboardState {
  return this.state;  // 直接返回内部可变引用
}
```

**攻击路径**:
```typescript
const state = leaderboard.getState();
state.boards[LeaderboardType.POWER].push({ /* 恶意数据 */ });
// leaderboard 内部状态已被篡改，绕过 updateScore 的所有校验
```

**影响**: 外部代码可直接修改排行榜内部状态，绕过 updateScore() 的排序、容量限制、排名计算等所有校验逻辑。

**修复方案**: 返回深拷贝。

---

### P0-02: LeaderboardSystem.updateScore 接受 NaN/Infinity 导致排序崩溃

**严重程度**: P0-CRITICAL (数据完整性)
**文件**: `LeaderboardSystem.ts:82-130`
**模式**: NaN 传播 (#1)

```typescript
updateScore(type, playerId, playerName, score, metadata) {
  // score 无校验，NaN/Infinity 可直接进入
  const entry = { ..., score, ... };
  board.push(entry);
  this.sortBoard(type);  // NaN 比较导致排序混乱
}
```

**攻击路径**:
```typescript
leaderboard.updateScore(LeaderboardType.POWER, 'p1', 'Player1', NaN);
leaderboard.updateScore(LeaderboardType.POWER, 'p2', 'Player2', 100);
// sortBoard: b.score - a.score = NaN - 100 = NaN, 排序结果不确定
```

**影响**: NaN 进入排行榜后，sortBoard 的比较函数返回 NaN，导致 Array.sort 行为不确定（不同引擎结果不同），排名完全混乱。

**修复方案**: 在 updateScore 入口校验 score，拒绝 NaN/Infinity/负数。

---

### P0-03: ChatSystem.sendMessage 时间回拨导致 lastSendTime 被覆盖

**严重程度**: P0-CRITICAL (安全/逻辑)
**文件**: `ChatSystem.ts:120-125`
**模式**: 时间回拨 (#6)

```typescript
const lastSend = state.lastSendTime[channelKey] || 0;
const interval = this.channelConfigs[channel].sendIntervalMs;
if (interval > 0 && lastSend > 0 && now - lastSend < interval) {
  throw new Error('发言间隔太短');
}
```

**攻击路径**: 客户端传入 now=500 但上次 lastSend=1000，now-lastSend=-500 < interval 为 true 所以被阻止，但 lastSendTime 被覆盖为 500，影响后续 cleanExpiredMessages 正确性。

**修复方案**: 校验 now >= lastSend，拒绝时间回拨。

---

### P0-04: FriendInteractionHelper.getTodayInteractions 使用 new Date(now) 跨时区问题

**严重程度**: P0-MEDIUM (逻辑错误)
**文件**: `FriendInteractionHelper.ts:44-46`
**模式**: 时间处理 (#6)

```typescript
function getTodayInteractions(state: SocialState, now: number): InteractionRecord[] {
  const dayStart = new Date(now).setHours(0, 0, 0, 0);
  return state.dailyInteractions.filter((i) => i.timestamp >= dayStart);
}
```

**问题**: new Date(timestamp).setHours(0,0,0,0) 依赖本地时区，服务端/客户端不同时区时"今日"定义不一致。

**修复方案**: 使用 UTC 计算 dayStart。

---

### P0-05: FriendSystem.deserialize 版本不匹配时静默丢弃数据

**严重程度**: P0-MEDIUM (数据丢失)
**文件**: `FriendSystem.ts:248-253`
**模式**: 存档版本降级 (#23)

```typescript
deserialize(data: SocialSaveData): SocialState {
  if (!data || data.version !== SOCIAL_SAVE_VERSION) {
    return createDefaultSocialState();  // 静默丢弃所有数据
  }
  return { ...data.state };
}
```

**修复方案**: 添加版本迁移链，或至少在版本不匹配时抛出异常。

---

### P0-06: ChatSystem.deserializeChat 缺少输入校验

**严重程度**: P0-MEDIUM (安全)
**文件**: `ChatSystem.ts:323-332`
**模式**: null/undefined 解引用 (#2)

data 本身可能为 null/undefined，直接访问 data.chatMessages 会 throw。

**修复方案**: 添加完整的输入校验和防御性默认值。

---

### P0-07: LeaderboardSystem.updateScore 新增条目时直接引用传入的 metadata

**严重程度**: P0-MEDIUM (数据完整性)
**文件**: `LeaderboardSystem.ts:107`
**模式**: 引用泄漏 (#7)

```typescript
const entry = { ..., metadata };  // 直接引用传入对象
```

**修复方案**: 新增条目时使用 `{ ...metadata }` 浅拷贝。

---

### P0-09: LeaderboardSystem.endSeasonAndStartNew 奖励无显式上限过滤

**严重程度**: P0-MEDIUM (游戏平衡)
**文件**: `LeaderboardSystem.ts:199-211`

依赖 getRewardForRank 返回 null 过滤，而非显式 rank <= 100 检查。如果 REWARD_CONFIGS 被错误修改，可能导致所有玩家获得奖励。

**修复方案**: 添加显式 rank <= 100 前置检查。

---

### P0-10: FriendSystem.sendFriendRequest 允许对自己发送好友申请

**严重程度**: P0-MEDIUM (逻辑错误)
**文件**: `FriendSystem.ts:128-146`

无 fromPlayerId !== toPlayerId 检查，玩家可对自己发送申请并接受。

**修复方案**: 添加 fromPlayerId !== toPlayerId 校验。

---

### P0-11: BorrowHeroHelper.borrowHero 允许自借

**严重程度**: P0-MEDIUM (逻辑错误)
**文件**: `BorrowHeroHelper.ts:51-87`

无 borrowerPlayerId !== lenderPlayerId 检查。

**修复方案**: 添加 borrowerPlayerId !== lenderPlayerId 校验。

---

### P0-12: LeaderboardSystem sortBoard/assignRanks 直接修改内部数组

**严重程度**: P0-CRITICAL (数据完整性)
**文件**: `LeaderboardSystem.ts:233-243`
**模式**: 引用泄漏 (#7)

updateScore 中直接修改 existing 对象，然后调用 sortBoard 和 assignRanks。由于 getState() 返回可变引用（P0-01），外部持有的 LeaderboardEntry 引用也会被修改。

**修复方案**: 与 P0-01 一起修复，getState() 返回深拷贝。

---

## 汇总

| 等级 | 数量 | 编号 |
|------|------|------|
| P0-CRITICAL | 4 | P0-01, P0-02, P0-03, P0-12 |
| P0-MEDIUM | 7 | P0-04, P0-05, P0-06, P0-07, P0-09, P0-10, P0-11 |
| **合计** | **11** | |

### 建议修复优先级

1. P0-01 + P0-12: LeaderboardSystem 状态可变性, 深拷贝 getState
2. P0-02: NaN/Infinity 校验, updateScore 入口校验
3. P0-03: 时间回拨校验, sendMessage 入口校验
4. P0-06: deserializeChat null safety
5. P0-07: metadata 引用浅拷贝
6. P0-10: 自申请好友校验
7. P0-11: 自借将校验
8. P0-05: 版本迁移或警告
9. P0-04: 时区问题使用 UTC
10. P0-09: 奖励上限显式检查
