# Activity（活动域）R1 Fixer 修复报告

> Fixer: FixerAgent | Time: 2026-05-01 | Phase: R1 对抗式测试
> 基于 Arbiter R1 裁决，修复确认的P0缺陷
> 验证: `npx tsc --noEmit` — 零错误通过

---

## 修复总览

| 修复类别 | 修复数 | 状态 |
|----------|--------|------|
| SignInSystem serialize/deserialize 缺失 | 1 | ✅ 已修复 |
| tokenBalance 上限防护 | 2 | ✅ 已修复 |
| NaN防护（已有FIX标记） | 26 | ✅ 已确认存在 |
| Null防护（已有FIX标记） | 6 | ✅ 已确认存在 |
| 逻辑缺陷（已有FIX标记） | 2 | ✅ 已确认存在 |
| **总计** | **37** | **全部确认/修复** |

---

## 新增修复详情

### FIX-ARCH-004: SignInSystem serialize/deserialize 缺失

**问题**: SignInSystem 是唯一没有 serialize/deserialize 方法的子系统。签到数据（配置、奖励列表）无法持久化，导致页面刷新后配置丢失。

**修复**:
- 文件: `src/games/three-kingdoms/engine/activity/SignInSystem.ts`
- 新增 `serialize()` 方法：导出 config 和 rewards
- 新增 `deserialize(data)` 方法：导入 config 和 rewards，含 null guard
- 签到数据本身（SignInData）由 ActivityState.signIn 管理，通过 ActivitySystem.serialize/deserialize 持久化

**代码变更**:
```typescript
serialize(): {
  config: SignInConfig;
  rewards: SignInReward[];
} {
  return {
    config: { ...this.config },
    rewards: this.rewards.map(r => ({ ...r, rewards: { ...r.rewards } })),
  };
}

deserialize(data: {
  config?: SignInConfig;
  rewards?: SignInReward[];
}): void {
  if (!data) return;
  if (data.config && typeof data.config === 'object') {
    this.config = { ...DEFAULT_SIGN_IN_CONFIG, ...data.config };
  }
  if (Array.isArray(data.rewards) && data.rewards.length > 0) {
    this.rewards = data.rewards.map(r => ({ ...r, rewards: { ...r.rewards } }));
  }
}
```

**影响范围**: SignInSystem 类 + index.ts 导出

---

### FIX-SHOP-016: tokenBalance 上限防护

**问题**: addTokens 无上限检查，理论上可无限累积代币到 Infinity。

**修复**:
- 文件: `src/games/three-kingdoms/engine/activity/TokenShopSystem.ts`
- 新增常量 `MAX_TOKEN_BALANCE = 999_999_999`
- addTokens() 增加上限 clamp: `Math.min(this.tokenBalance, MAX_TOKEN_BALANCE)`
- deserialize() 增加上限 clamp，防止从存档恢复超出上限的值

**代码变更**:
```typescript
// 常量
export const MAX_TOKEN_BALANCE = 999_999_999;

// addTokens
this.tokenBalance += amount;
this.tokenBalance = Math.min(this.tokenBalance, MAX_TOKEN_BALANCE);

// deserialize
this.tokenBalance = Number.isFinite(data.tokenBalance)
  ? Math.min(data.tokenBalance, MAX_TOKEN_BALANCE)
  : 0;
```

**影响范围**: TokenShopSystem 类 + index.ts 导出

---

## 已有FIX标记确认（无需新增修复）

以下P0在源码中已有对应的FIX标记，经审查确认修复有效：

### ActivitySystem.ts
| FIX标记 | 覆盖P0 | 修复方式 |
|---------|--------|---------|
| FIX-ACT-001 | P0-025 (maxTotal=NaN) | `!Number.isFinite(maxTotal) \|\| maxTotal <= 0` |
| FIX-ACT-001 | P0-001 (分类型上限) | typePrefixMap + typeLimitMap 分类型检查 |
| FIX-ACT-002/003 | P0-002/003 (progress NaN/负值) | `!Number.isFinite(progress) \|\| progress <= 0` |
| FIX-ACT-004 | P0-004 (claimTaskReward NaN) | safePointReward/safeTokenReward |
| FIX-ACT-005 | P0-005/020/021 (null guard + NaN) | `!def` throw + `Number.isFinite(points)` |
| FIX-ACT-024 | P0-024 (NaN序列化) | serialize 中 NaN 清洗为 0 |
| FIX-ACT-026 | P0-026 (updateActivityStatus NaN) | `!Number.isFinite(now) \|\| !Number.isFinite(endTime)` |

### TokenShopSystem.ts
| FIX标记 | 覆盖P0 | 修复方式 |
|---------|--------|---------|
| FIX-SHOP-010/011 | P0-010 (quantity NaN/负值) | `!Number.isFinite(quantity) \|\| quantity <= 0` |
| FIX-SHOP-010b | P0-011 (totalCost NaN) | `!Number.isFinite(totalCost) \|\| totalCost <= 0` |
| FIX-SHOP-012 | P0-012 (resourceChanges null) | null guard + `typeof resourceChanges === 'object'` |
| FIX-SHOP-013/014 | P0-013/014 (addTokens NaN/负值) | `!Number.isFinite(amount) \|\| amount <= 0` |
| FIX-SHOP-013b | P0-013 (spendTokens NaN) | `!Number.isFinite(amount) \|\| amount <= 0` |
| FIX-SHOP-015 | P0-015 (deserialize null) | `if (!data) return` |

### SignInSystem.ts
| FIX标记 | 覆盖P0 | 修复方式 |
|---------|--------|---------|
| FIX-SIGN-007 | P0-007 (signIn now=NaN) | `if (!Number.isFinite(now)) throw` |
| FIX-SIGN-007b | P0-007 (retroactive now=NaN) | `if (!Number.isFinite(now)) throw` |
| FIX-SIGN-008 | P0-008 (goldAvailable=NaN) | `if (!Number.isFinite(goldAvailable)) throw` |
| FIX-SIGN-009 | P0-009 (补签连续性) | lastSignInTime=0 时 consecutiveDays=1 |

### TimedActivitySystem.ts
| FIX标记 | 覆盖P0 | 修复方式 |
|---------|--------|---------|
| FIX-TIMED-016 | P0-016 (createFlow NaN) | `!Number.isFinite(activeStart) \|\| !Number.isFinite(activeEnd)` |
| FIX-TIMED-010 | P0-026 (updatePhase NaN) | `if (!Number.isFinite(now))` → closed |
| FIX-TIMED-017 | P0-017 (updateLeaderboard NaN) | `Number.isFinite(a.points) ? a.points : -Infinity` |
| FIX-TIMED-018 | P0-018 (calculateOffline NaN) | `!Number.isFinite(offlineDurationMs) \|\| offlineDurationMs <= 0` |
| FIX-TIMED-019 | P0-019 (deserialize null) | `if (!data) return` |

### ActivityFactory.ts
| FIX标记 | 覆盖P0 | 修复方式 |
|---------|--------|---------|
| FIX-FACT-001 | P0-020 (createInstance null) | `if (!def) throw` |
| FIX-FACT-002 | P0-021 (createTask null) | `if (!def) throw` |

### SeasonHelper.ts
| FIX标记 | 覆盖P0 | 修复方式 |
|---------|--------|---------|
| FIX-SEAS-022 | P0-022 (seasonIndex NaN) | `if (!Number.isFinite(seasonIndex) \|\| seasonIndex < 0) seasonIndex = 0` |
| FIX-SEAS-023 | P0-023 (ranking NaN) | safeRanking 防护 |

### ActivityOfflineCalculator.ts
| FIX标记 | 覆盖P0 | 修复方式 |
|---------|--------|---------|
| FIX-ACT-006 | P0-006 (offline NaN/负值) | `!Number.isFinite(offlineDurationMs) \|\| offlineDurationMs <= 0` |

---

## 验证结果

### TypeScript 编译检查
```
$ npx tsc --noEmit
(零错误通过)
```

### 变更文件清单

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| SignInSystem.ts | 新增方法 | serialize() + deserialize() |
| TokenShopSystem.ts | 新增常量+修改 | MAX_TOKEN_BALANCE + addTokens上限 + deserialize上限 |
| index.ts | 新增导出 | MAX_TOKEN_BALANCE |

---

## 未修复项（需R2跟进）

| ID | 描述 | 原因 |
|----|------|------|
| ARCH-001/002 | engine-save 未接入 Activity 模块 | 涉及 engine-save.ts 架构变更，需跨模块协调 |
| P1-001 | updatePhase 就地修改 flow | 设计决策，需团队讨论是否改为不可变 |
| P1-002 | updateLeaderboard 就地修改 entries | 浅拷贝已复制数组，但 entry.rank 仍修改原对象 |
