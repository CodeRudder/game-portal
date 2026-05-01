# Social 模块 R1 对抗式测试 — Fixer 修复报告

> 生成时间: 2025-07-11
> 修复范围: 11 个确认 P0 漏洞
> 修改文件: 5 个

---

## 修复清单

### P0-01 + P0-12: LeaderboardSystem.getState() 可变引用 [CRITICAL]

**文件**: `LeaderboardSystem.ts`
**修复**: getState() 改为返回 JSON.parse(JSON.stringify(this.state)) 深拷贝
**附带修复**: getCurrentSeason() 和 getSeasonHistory() 也返回拷贝

```typescript
// Before
getState(): LeaderboardState {
  return this.state;
}

// After
getState(): LeaderboardState {
  return JSON.parse(JSON.stringify(this.state));
}
```

---

### P0-02: updateScore NaN/Infinity 校验 [CRITICAL]

**文件**: `LeaderboardSystem.ts`
**修复**: updateScore 入口添加 score 合法性校验

```typescript
// Added at top of updateScore:
if (!Number.isFinite(score) || score < 0) {
  throw new Error(`无效分数: ${score}，必须为非负有限数`);
}
```

---

### P0-03: sendMessage 时间回拨校验 [CRITICAL]

**文件**: `ChatSystem.ts`
**修复**: sendMessage 添加时间单调递增校验

```typescript
// Added before interval check:
if (lastSend > 0 && now < lastSend) {
  throw new Error('发送时间不能早于上次发言时间');
}
```

---

### P0-04: getTodayInteractions 时区修复 [MEDIUM]

**文件**: `FriendInteractionHelper.ts`
**修复**: 使用 UTC 计算当日零点

```typescript
// Before
const dayStart = new Date(now).setHours(0, 0, 0, 0);

// After
const d = new Date(now);
const dayStart = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0);
```

---

### P0-05: deserialize 版本迁移 [MEDIUM]

**文件**: `FriendSystem.ts`
**修复**: 版本不匹配时尝试兼容恢复 + console.warn

```typescript
// Before: 静默返回默认状态
// After: 尝试 { ...defaultState, ...data.state } 兼容恢复
```

---

### P0-06: deserializeChat null safety [MEDIUM]

**文件**: `ChatSystem.ts`
**修复**: 添加 data 为 null/undefined 的防御性检查

```typescript
if (!data) {
  return { chatMessages: {...}, lastSendTime: {}, muteRecords: [] };
}
```

---

### P0-07: metadata 引用泄漏 [MEDIUM]

**文件**: `LeaderboardSystem.ts`
**修复**: 新增条目时 metadata 使用 `{ ...metadata }` 浅拷贝

```typescript
// Before
metadata,

// After
metadata: { ...metadata },
```

---

### P0-09: endSeasonAndStartNew 奖励上限 [LOW]

**文件**: `LeaderboardSystem.ts`
**修复**: 添加 `if (entry.rank > REWARD_MAX_RANK) continue;` 显式过滤

---

### P0-10: sendFriendRequest 自申请 [MEDIUM]

**文件**: `FriendSystem.ts`
**修复**: 添加 `fromPlayerId === toPlayerId` 校验

```typescript
if (fromPlayerId === toPlayerId) {
  throw new Error('不能对自己发送好友申请');
}
```

---

### P0-11: borrowHero 自借 [MEDIUM]

**文件**: `BorrowHeroHelper.ts`
**修复**: 添加 `borrowerPlayerId === lenderPlayerId` 校验

```typescript
if (borrowerPlayerId === lenderPlayerId) {
  throw new Error('不能向自己借将');
}
```

---

## 修改文件汇总

| 文件 | 修改类型 | 影响行数 |
|------|---------|---------|
| LeaderboardSystem.ts | getState深拷贝 + score校验 + metadata拷贝 + 奖励上限 | ~15 行 |
| ChatSystem.ts | 时间回拨校验 + deserializeChat null safety | ~10 行 |
| FriendSystem.ts | 自申请校验 + 版本迁移 | ~15 行 |
| BorrowHeroHelper.ts | 自借校验 | +4 行 |
| FriendInteractionHelper.ts | UTC时区修复 | ~3 行 |

---

## 测试影响评估

| 修复 | 是否破坏现有测试 | 需要新增测试 |
|------|----------------|-------------|
| P0-01 getState深拷贝 | 可能: 直接比较引用的测试需更新 | 是: 验证不可变性 |
| P0-02 score校验 | 可能: 传入NaN的测试需更新 | 是: NaN/Infinity/负数 |
| P0-03 时间回拨 | 可能: 时间回拨场景需更新 | 是: 时间回拨拒绝 |
| P0-04 UTC | 可能: 依赖本地时区的测试 | 是: UTC一致性 |
| P0-05 版本迁移 | 低风险 | 是: 版本不匹配恢复 |
| P0-06 null safety | 低风险 | 是: null输入 |
| P0-07 metadata拷贝 | 低风险 | 是: 引用隔离 |
| P0-09 奖励上限 | 低风险 | 是: rank>100 |
| P0-10 自申请 | 低风险 | 是: 自申请拒绝 |
| P0-11 自借 | 低风险 | 是: 自借拒绝 |
