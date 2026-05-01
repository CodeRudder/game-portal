# Social 模块 R2 对抗式测试 — Challenger 挑战报告

> 生成时间: 2025-07-11 (R2 封版轮)
> 审查范围: 8 个源文件, 1808 行 (R1 修复后)
> 挑战策略: R1 P0 回归验证 + 5 新维度深度扫描
> 重点方向: engine-save 序列化遗漏、NaN 防护缺口、纯函数状态丢失

---

## 1. R1 P0 回归验证

| P0# | R1 问题 | R2 回归结果 | 状态 |
|-----|---------|------------|------|
| P0-01 | engine-save 未接入 Social | ⚠️ 部分修复 — applySaveData 已接入，**buildSaveData 遗漏** | **FAIL** |
| P0-02 | updateScore NaN/Infinity | ✅ `!Number.isFinite(score) \|\| score < 0` 防护生效 | PASS |
| P0-03 | sendMessage 时间回拨 | ✅ `now < lastSend` throw 防护生效 | PASS |
| P0-04 | getTodayInteractions NaN | ✅ `!Number.isFinite(now)` 防护生效 | PASS |
| P0-05 | sendMessage NaN | ✅ `!Number.isFinite(now)` 防护生效 | PASS |
| P0-06 | 自申请校验 | ✅ `fromPlayerId === toPlayerId` 防护生效 | PASS |
| P0-07 | 自借将校验 | ✅ `borrowerPlayerId === lenderPlayerId` 防护生效 | PASS |
| P0-08 | deserialize 版本迁移 | ✅ 兼容恢复 + console.warn | PASS |
| P0-09 | metadata 浅拷贝 | ✅ `{ ...metadata }` 拷贝生效 | PASS |
| P0-10 | friendshipPoints 上限 | ✅ calculateFriendshipEarned cap 闭环 | PASS |
| P0-11 | LeaderboardSystem serialize | ✅ serialize/deserialize 方法已添加 | PASS |
| P0-12 | getState 可变引用 | ✅ JSON.parse(JSON.stringify) 深拷贝 | PASS |

**回归通过率: 11/12 (91.7%)** — P0-01 buildSaveData 遗漏

---

## 2. R2 新发现漏洞

### R2-P0-01: [CRITICAL] buildSaveData 未调用 Social serialize — 保存时数据丢失

**严重程度**: P0-CRITICAL (数据丢失)
**规则引用**: BR-014 (保存/加载覆盖扫描)
**涉及文件**: `engine-save.ts:159-233`

**源码证据**:

```typescript
// engine-save.ts buildSaveData() 返回对象中:
return {
  version: ENGINE_SAVE_VERSION,
  saveTime: Date.now(),
  resource: ctx.resource.serialize(),
  building: ctx.building.serialize(),
  // ... 其他 30+ 子系统 ...
  alliance: ctx.allianceSystem?.serialize(...),
  allianceTask: ctx.allianceTaskSystem?.serialize(),
  allianceShop: ctx.allianceShopSystem?.serialize(),
  // ❌ 缺少:
  // social: ctx.friendSystem?.serialize(socialState),
  // leaderboard: ctx.socialLeaderboardSystem?.serialize(),
};
```

**影响**: 虽然 applySaveData (line 816-827) 已正确接入 deserialize，但 buildSaveData 从未调用 serialize。GameSaveData 中 social/leaderboard 字段为 undefined → 保存时社交数据全部丢失 → 加载时走 else 分支初始化默认状态。

**修复方案**:
```typescript
// buildSaveData return 对象末尾添加:
social: ctx.friendSystem?.serialize(socialState),
leaderboard: ctx.socialLeaderboardSystem?.serialize(),
```

---

### R2-P0-02: [CRITICAL] applySaveData 中 socialState 反序列化后未写回

**严重程度**: P0-CRITICAL (数据丢失)
**规则引用**: BR-014 (保存/加载覆盖扫描)
**涉及文件**: `engine-save.ts:816-819`

**源码证据**:

```typescript
// engine-save.ts applySaveData():
if (data.social && ctx.friendSystem) {
  const socialState = ctx.friendSystem.deserialize(data.social);
  // ❌ socialState 被计算但从未使用！
  // FriendSystem 使用纯函数模式，state 通过参数传递
  // 反序列化的状态没有写回任何地方
  gameLog.info('[Save] 社交系统存档恢复成功');
}
```

**影响**: FriendSystem 是纯函数设计（所有方法接收 state 参数并返回新 state），但 applySaveData 中 deserialize 返回的 socialState 被丢弃。即使 buildSaveData 修复了序列化，加载后的状态也不会被任何后续操作使用。

**修复方案**: 需要将 socialState 写回引擎状态管理（如 ctx.socialState = socialState），或改为有状态模式。

---

### R2-P0-03: [HIGH] ChatSystem 多个 API 缺少 NaN 防护

**严重程度**: P0-HIGH (安全)
**规则引用**: BR-01 (NaN 防护)
**涉及文件**: `ChatSystem.ts`

**受影响 API**:

| API | now 参数 | NaN 防护 | 攻击路径 |
|-----|---------|---------|---------|
| sendMessage | now | ✅ 已防护 | — |
| mutePlayer | now | ❌ 无防护 | endTime = NaN + duration = NaN → 永久禁言/永远不生效 |
| unmutePlayer | now | ❌ 无防护 | NaN >= r.startTime && NaN < r.endTime → false → 无法解除禁言 |
| isPlayerMuted | now | ❌ 无防护 | 同上 → 始终返回 false → 绕过禁言 |
| getActiveMute | now | ❌ 无防护 | 同上 → 始终返回 undefined |
| reportMessage | now | ❌ 无防护 | timestamp = NaN |
| cleanExpiredMessages | now | ❌ 无防护 | cutoff = NaN - retentionMs = NaN → 清空所有消息 |

**影响**: 7 个 ChatSystem API 中 6 个缺少 NaN 防护。攻击者可：
1. 传入 now=NaN 绕过禁言检查（isPlayerMuted 返回 false）
2. 传入 now=NaN 清空所有聊天记录（cleanExpiredMessages）
3. 创建无效禁言记录（mutePlayer endTime=NaN）

**修复方案**: 在每个接受 now 参数的 API 入口添加 `if (!Number.isFinite(now)) throw new Error('无效时间')`

---

### R2-P0-04: [HIGH] FriendSystem removeFriend/sendFriendRequest 缺少 NaN 防护

**严重程度**: P0-HIGH (安全)
**规则引用**: BR-01 (NaN 防护)
**涉及文件**: `FriendSystem.ts`

**受影响 API**:

| API | now 参数 | NaN 防护 | 攻击路径 |
|-----|---------|---------|---------|
| removeFriend | now | ❌ 无防护 | NaN < cooldownEnd → false → 绕过冷却删除 |
| sendFriendRequest | now | ❌ 无防护 | timestamp = NaN → 申请记录时间无效 |
| canRemoveFriend | now | ❌ 无防护 | NaN >= cooldownEnd → false → 始终不可删除 |

**影响**: 
- removeFriend(now=NaN) 可绕过 24h 删除冷却
- sendFriendRequest(now=NaN) 创建无效时间戳的申请

**修复方案**: 添加 `if (!Number.isFinite(now)) throw` 防护

---

### R2-P0-05: [MEDIUM] BorrowHeroHelper borrowHero now 参数缺少 NaN 防护

**严重程度**: P0-MEDIUM (数据完整性)
**涉及文件**: `BorrowHeroHelper.ts:60`

```typescript
borrowHero(state, heroId, lenderPlayerId, borrowerPlayerId, now, calcFn) {
  // now 未校验 → borrowTime = NaN
  const record: BorrowHeroRecord = {
    borrowTime: now,  // NaN
  };
```

**影响**: 借将记录的 borrowTime 为 NaN，可能影响后续归还逻辑或显示。

---

### R2-P0-06: [MEDIUM] LeaderboardSystem updateScore 使用内部 Date.now() 而非参数

**严重程度**: P0-MEDIUM (时间不一致)
**涉及文件**: `LeaderboardSystem.ts:92`

```typescript
updateScore(type, playerId, playerName, score, metadata) {
  // ...
  const now = Date.now();  // 使用系统时间而非参数
  // achievedAt = now (系统时间)
```

**影响**: LeaderboardSystem.updateScore 没有接受 now 参数，内部使用 `Date.now()`。这导致：
1. 无法在测试中控制时间
2. 与其他 Social 子系统（接受 now 参数）的设计不一致
3. 离线场景下时间不准确

---

## 3. 新维度探索

### 3.1 并发安全维度

| 场景 | 风险 | 状态 |
|------|------|------|
| 同帧多次 giftTroops | dailyInteractions 累加正确 (纯函数不可变) | ✅ 安全 |
| acceptFriendRequest + addFriend 事务 | addFriend 失败时申请已被 filter 移除 | ⚠️ 事务性不完整 |
| endSeasonAndStartNew 异常 | boards 已清空但 season 未更新 | ⚠️ 非原子操作 |

### 3.2 大数据量维度

| 场景 | 风险 | 状态 |
|------|------|------|
| 1000 排行榜 + batchUpdate | sortBoard O(n log n) × n = O(n² log n) | ⚠️ 性能风险 |
| 50 好友 × 全互动 | dailyInteractions 最多 50×18=900 条 | ✅ 可控 |
| 100 消息 × 连续发送 | slice(-maxMessages) 截断 | ✅ 安全 |

### 3.3 序列化完整性维度

| 场景 | 风险 | 状态 |
|------|------|------|
| buildSaveData 缺 social | **保存时数据丢失** | ❌ CRITICAL |
| applySaveData socialState 未写回 | **加载时数据丢失** | ❌ CRITICAL |
| LeaderboardSystem.serialize | 深拷贝 + 重新排序 | ✅ 安全 |
| FriendSystem.serialize | 浅拷贝嵌套对象 | ⚠️ 引用风险 |

### 3.4 边界值精确维度

| 场景 | 风险 | 状态 |
|------|------|------|
| friendshipPoints = 200 → 下次 earned=0 | calculateFriendshipEarned 正确处理 | ✅ 安全 |
| 发言间隔 = interval + 1ms | now - lastSend >= interval → 成功 | ✅ 安全 |
| 排行榜 999 → 1000 满员 | board.pop() + push | ✅ 安全 |

### 3.5 状态一致性维度

| 场景 | 风险 | 状态 |
|------|------|------|
| FriendSystem 纯函数 vs LeaderboardSystem 有状态 | 设计不一致 | ⚠️ 架构风险 |
| ChatSystem serializeChat vs FriendSystem serialize | 序列化路径重叠 | ⚠️ 冗余风险 |
| dailyReset 不重置 activeBorrows | 跨日借将累积 | ✅ 设计意图 |

---

## 4. R2 漏洞汇总

| 等级 | 编号 | 问题 | 修复类型 |
|------|------|------|---------|
| **CRITICAL** | R2-P0-01 | buildSaveData 未调用 Social serialize | 架构修复 (2 行) |
| **CRITICAL** | R2-P0-02 | applySaveData socialState 未写回 | 架构修复 (状态管理) |
| **HIGH** | R2-P0-03 | ChatSystem 6 个 API 缺 NaN 防护 | 入口校验 (6 处) |
| **HIGH** | R2-P0-04 | FriendSystem 3 个 API 缺 NaN 防护 | 入口校验 (3 处) |
| **MEDIUM** | R2-P0-05 | BorrowHeroHelper now 缺 NaN 防护 | 入口校验 (1 处) |
| **MEDIUM** | R2-P0-06 | LeaderboardSystem updateScore 用 Date.now() | 设计改进 |

**R2 新发现: 6 个漏洞** (2 CRITICAL + 2 HIGH + 2 MEDIUM)

### 修复优先级

1. **R2-P0-01** + **R2-P0-02**: engine-save 完整链路修复（buildSaveData 添加 serialize + applySaveData 状态写回）
2. **R2-P0-03**: ChatSystem 全面 NaN 防护
3. **R2-P0-04**: FriendSystem 全面 NaN 防护
4. **R2-P0-05**: BorrowHeroHelper NaN 防护
5. **R2-P0-06**: LeaderboardSystem 时间参数化（可选，不阻塞封版）

### 修复后预期评分

如果修复 R2-P0-01 ~ R2-P0-05：
- Normal Flow: 10/10 (不变)
- Boundary Conditions: 10/10 (+1, NaN 全面覆盖)
- Error Paths: 10/10 (+1, NaN 全面防护)
- Cross-System: 10/10 (+1, engine-save 完整)
- Data Lifecycle: 10/10 (+1, 序列化完整)
- **预期总分: 10/10** → 可封版
