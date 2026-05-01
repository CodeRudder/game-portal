# Social 模块 R1 对抗式测试 — Challenger 挑战报告

> 生成时间: 2025-07-11 (R1 正式版)
> 审查范围: 8 个源文件, 1524 行
> 挑战策略: 22 条 Builder 规则 + 23 个 P0 模式逐项扫描
> 重点方向: NaN绕过<=0检查、deserialize null、serialize缺失、负值漏洞、engine-save接入

---

## P0 模式扫描清单

| # | P0 模式 | 是否命中 | 涉及文件 | 规则引用 |
|---|---------|---------|---------|---------|
| 1 | NaN 传播 | **YES** | FriendInteractionHelper.ts, ChatSystem.ts, LeaderboardSystem.ts | BR-01 |
| 2 | null/undefined 解引用 | **YES** | ChatSystem.ts, FriendSystem.ts | BR-10 |
| 3 | 序列化/反序列化不一致 | **YES** | FriendSystem.ts, ChatSystem.ts, LeaderboardSystem.ts | BR-14 |
| 4 | 状态机非法转换 | LOW | BorrowHeroHelper.ts | — |
| 5 | 整数溢出 | LOW | LeaderboardSystem.ts | — |
| 6 | 时间回拨 | **YES** | ChatSystem.ts, FriendInteractionHelper.ts | BR-06 |
| 7 | 引用泄漏 (可变状态) | **YES** | LeaderboardSystem.ts | BR-07 |
| 8 | 边界值 off-by-one | LOW | ChatSystem.ts | — |
| 9 | 空字符串/空对象注入 | LOW | FriendSystem.ts | — |
| 10 | 类型强制转换 | LOW | leaderboard-types.ts | — |
| 11 | 并发竞态 | LOW | generateId 函数 | — |
| 12 | 数组越界 | LOW | LeaderboardSystem.ts | — |
| 13 | 正则/字符串注入 | LOW | ChatSystem.ts | — |
| 14 | 权限绕过 | **YES** | ChatSystem.ts | — |
| 15 | 资源耗尽 (DoS) | LOW | FriendSystem.ts | — |
| 16 | 循环引用序列化 | LOW | FriendSystem.ts | — |
| 17 | 原型污染 | LOW | 无对象合并 | — |
| 18 | 比较运算符错误 | **YES** | FriendInteractionHelper.ts | BR-01 |
| 19 | 浮点精度 | LOW | BorrowHeroHelper.ts | — |
| 20 | 默认参数覆盖 | LOW | ChatSystem.ts | — |
| 21 | 枚举越界 | LOW | ChatChannel | — |
| 22 | 每日重置竞态 | **YES** | FriendInteractionHelper.ts | — |
| 23 | 存档版本降级 | **YES** | FriendSystem.ts | BR-10 |
| **24** | **engine-save 未接入** | **YES** | engine-save.ts, shared/types.ts | **BR-014, BR-024** |

---

## 确认的 P0 漏洞

### P0-01: [CRITICAL] Social 模块完全未接入 engine-save — 所有社交数据保存/加载时丢失

**严重程度**: P0-CRITICAL (数据丢失)
**规则引用**: BR-014 (保存/加载覆盖扫描), BR-024 (deserialize 覆盖验证)
**涉及文件**: `engine-save.ts`, `shared/types.ts`, `engine-extended-deps.ts`

**源码证据**:

1. `shared/types.ts:216` — GameSaveData 接口无 social/friend/chat/leaderboard 字段
2. `engine-save.ts` — buildSaveData() 未调用 FriendSystem.serialize() 或 ChatSystem.serializeChat()
3. `engine-save.ts` — applySaveData() 未调用 FriendSystem.deserialize() 或 ChatSystem.deserializeChat()
4. `engine-extended-deps.ts:87-89` — Social 子系统已注册到引擎，但 save/load 链路完全缺失

**影响**: 玩家所有社交数据（好友列表、聊天记录、排行榜排名、借将状态、友情点）在保存/加载后全部丢失。这是 BR-014 规则的直接违反（R3 教训：6 个子系统状态丢失）。

**修复方案**:
1. 在 GameSaveData 中添加 `social?: SocialSaveData` 和 `leaderboard?: LeaderboardState` 字段
2. 在 buildSaveData() 中调用 friendSystem.serialize() 和 leaderboardSystem.getState()
3. 在 applySaveData() 中调用 friendSystem.deserialize() 和恢复 leaderboardState
4. 同步更新 toIGameState / fromIGameState / engine-save-migration.ts

---

### P0-02: [CRITICAL] LeaderboardSystem.updateScore 接受 NaN/Infinity/负数导致排序崩溃

**严重程度**: P0-CRITICAL (数据完整性)
**规则引用**: BR-01 (NaN 防护), BR-17 (战斗数值安全), BR-19 (Infinity 序列化)
**文件**: `LeaderboardSystem.ts:82-130`

```typescript
// 源码: 无 score 校验
updateScore(type, playerId, playerName, score, metadata) {
  const board = this.state.boards[type];
  const existingIdx = board.findIndex(e => e.playerId === playerId);
  // score 直接使用，无 !Number.isFinite(score) || score < 0 检查
```

**攻击路径**:
```typescript
leaderboard.updateScore(LeaderboardType.POWER, 'p1', 'Player1', NaN);
// sortBoard: (a, b) => b.score - a.score → NaN - 100 = NaN → 排序结果不确定
```

**影响**: NaN 进入排行榜后，sortBoard 的比较函数返回 NaN，Array.sort 行为不确定（不同 JS 引擎结果不同），排名完全混乱。Infinity 可入榜但 JSON.stringify(Infinity) = "null"，反序列化后变为 null。

**修复方案**:
```typescript
if (!Number.isFinite(score) || score < 0) {
  throw new Error('无效分数');
}
```

---

### P0-03: [CRITICAL] LeaderboardSystem.getState() 返回可变内部引用

**严重程度**: P0-CRITICAL (数据完整性)
**规则引用**: BR-07 (引用泄漏)
**文件**: `LeaderboardSystem.ts:65-67`

```typescript
getState(): LeaderboardState {
  return this.state;  // 直接返回内部可变引用
}
```

**攻击路径**:
```typescript
const state = leaderboard.getState();
state.boards[LeaderboardType.POWER].push({ playerId: 'hacker', score: 999999, ... });
// 内部状态已被篡改，绕过 updateScore 的所有校验
```

**影响**: 外部代码可直接修改排行榜内部状态，绕过 updateScore() 的排序、容量限制、排名计算等所有校验逻辑。同样影响 getCurrentSeason() 和 getSeasonHistory()。

**修复方案**: 返回深拷贝或使用 structuredClone。

---

### P0-04: [CRITICAL] FriendInteractionHelper now=NaN 绕过所有每日限制

**严重程度**: P0-CRITICAL (游戏平衡)
**规则引用**: BR-01 (NaN 绕过 <=0 检查)
**文件**: `FriendInteractionHelper.ts:44-46`

```typescript
function getTodayInteractions(state: SocialState, now: number): InteractionRecord[] {
  const dayStart = new Date(now).setHours(0, 0, 0, 0);
  // now=NaN → new Date(NaN) → Invalid Date → setHours returns NaN
  // dayStart = NaN
  return state.dailyInteractions.filter((i) => i.timestamp >= dayStart);
  // i.timestamp >= NaN → false for all records → returns [] (空数组)
}
```

**攻击路径**:
```typescript
// 传入 now=NaN
helper.giftTroops(state, 'friend1', NaN);
// getTodayInteractions 返回 [] → 0 条记录 < 10 → 通过限制检查
// 可无限赠送兵力，无限获取友情点
```

**影响**: 三个互动 API (giftTroops, visitCastle, spar) 全部受影响，玩家可无限互动，破坏游戏经济平衡。

**修复方案**: 在 getTodayInteractions 入口校验 `if (!Number.isFinite(now)) throw new Error('无效时间')`

---

### P0-05: [HIGH] ChatSystem.sendMessage now=NaN 绕过发言间隔

**严重程度**: P0-HIGH (安全)
**规则引用**: BR-01 (NaN 防护)
**文件**: `ChatSystem.ts:120-125`

```typescript
const lastSend = state.lastSendTime[channelKey] || 0;
const interval = this.channelConfigs[channel].sendIntervalMs;
if (interval > 0 && lastSend > 0 && now - lastSend < interval) {
  throw new Error('发言间隔太短');
}
// now=NaN, lastSend=1000: NaN - 1000 = NaN, NaN < interval → false → 不抛异常
```

**影响**: 传入 NaN 作为 now 参数可绕过发言间隔限制，实现消息刷屏。同时 isPlayerMuted(state, playerId, NaN) 返回 false，可绕过禁言检查。

**修复方案**: 在 sendMessage 入口校验 `if (!Number.isFinite(now)) throw new Error('无效时间')`

---

### P0-06: [MEDIUM] FriendSystem.sendFriendRequest 允许自申请

**严重程度**: P0-MEDIUM (逻辑错误)
**文件**: `FriendSystem.ts:128-146`

```typescript
sendFriendRequest(state, fromPlayerId, fromPlayerName, toPlayerId, now) {
  // 无 fromPlayerId !== toPlayerId 检查
  if (state.friends[toPlayerId]) { throw ... } // 自己不是自己的好友 → 通过
  // 成功创建申请
```

**修复方案**: 添加 `if (fromPlayerId === toPlayerId) throw new Error('不能向自己发送申请')`

---

### P0-07: [MEDIUM] BorrowHeroHelper.borrowHero 允许自借

**严重程度**: P0-MEDIUM (逻辑错误)
**文件**: `BorrowHeroHelper.ts:51-87`

```typescript
borrowHero(state, heroId, lenderPlayerId, borrowerPlayerId, now, calcFn) {
  // 无 borrowerPlayerId !== lenderPlayerId 检查
  if (!state.friends[lenderPlayerId]) { throw ... }
  // 如果 lenderPlayerId 是好友 → 通过
```

**修复方案**: 添加 `if (borrowerPlayerId === lenderPlayerId) throw new Error('不能向自己借将')`

---

### P0-08: [MEDIUM] FriendSystem.deserialize 版本不匹配静默丢弃数据

**严重程度**: P0-MEDIUM (数据丢失)
**规则引用**: BR-10 (deserialize null safety)
**文件**: `FriendSystem.ts:347-353`

```typescript
deserialize(data: SocialSaveData): SocialState {
  if (!data || data.version !== SOCIAL_SAVE_VERSION) {
    return createDefaultSocialState();  // 静默丢弃所有好友/聊天数据
  }
  return { ...data.state };  // 浅拷贝，嵌套对象仍为引用
}
```

**影响**: 版本升级后所有社交数据被静默丢弃。浅拷贝导致嵌套对象（friends, chatMessages 等）仍为引用。

**修复方案**: 添加版本迁移链，或至少 log 警告。使用深拷贝替代浅拷贝。

---

### P0-09: [MEDIUM] LeaderboardSystem.updateScore metadata 直接引用

**严重程度**: P0-MEDIUM (数据完整性)
**规则引用**: BR-07 (引用泄漏)
**文件**: `LeaderboardSystem.ts:107`

```typescript
const entry: LeaderboardEntry = {
  playerId,
  playerName,
  score,
  achievedAt: now,
  rank: 0,
  metadata,  // 直接引用传入对象
};
```

**修复方案**: 使用 `metadata: { ...metadata }` 浅拷贝。

---

### P0-10: [MEDIUM] friendshipPoints 无上限常量

**严重程度**: P0-MEDIUM (游戏平衡)
**规则引用**: BR-22 (资源系统必须有上限常量)
**文件**: `friend-config.ts`, `FriendInteractionHelper.ts`

friendshipPoints 只有每日获取上限 (friendshipDailyCap=200)，但总余额无上限。理论上可无限累积。

**修复方案**: 添加 `MAX_FRIENDSHIP_POINTS` 常量并在所有增加路径中检查。

---

### P0-11: [MEDIUM] LeaderboardSystem 无 serialize/deserialize 方法

**严重程度**: P0-MEDIUM (数据持久化)
**规则引用**: BR-14 (保存/加载覆盖扫描)
**文件**: `LeaderboardSystem.ts`

LeaderboardSystem 没有实现 serialize/deserialize 方法，与 FriendSystem 和 ChatSystem 不一致。即使 engine-save 接入了 Social 模块，排行榜状态也无法通过标准序列化路径保存。

**修复方案**: 添加 serialize/deserialize 方法，与其他子系统保持一致。

---

## 汇总

| 等级 | 数量 | 编号 |
|------|------|------|
| P0-CRITICAL | 4 | P0-01, P0-02, P0-03, P0-04 |
| P0-HIGH | 1 | P0-05 |
| P0-MEDIUM | 6 | P0-06, P0-07, P0-08, P0-09, P0-10, P0-11 |
| **合计** | **11** | |

### 按规则分类

| 规则 | 命中漏洞 | 说明 |
|------|---------|------|
| BR-01 (NaN 防护) | P0-02, P0-04, P0-05 | 3 个 API 入口无 NaN 校验 |
| BR-07 (引用泄漏) | P0-03, P0-09 | getState + metadata |
| BR-14 (engine-save 覆盖) | P0-01, P0-11 | Social 完全未接入 |
| BR-10 (deserialize null) | P0-08 | 版本不匹配静默丢弃 |

### 建议修复优先级

1. **P0-01**: engine-save 接入 (BR-014/BR-024 六处同步)
2. **P0-02**: updateScore NaN/Infinity/负数校验
3. **P0-03**: getState() 深拷贝
4. **P0-04**: getTodayInteractions NaN 校验
5. **P0-05**: sendMessage NaN 校验
6. **P0-06**: 自申请校验
7. **P0-07**: 自借将校验
8. **P0-08**: deserialize 版本迁移 + 深拷贝
9. **P0-09**: metadata 浅拷贝
10. **P0-10**: friendshipPoints 上限
11. **P0-11**: LeaderboardSystem serialize/deserialize
