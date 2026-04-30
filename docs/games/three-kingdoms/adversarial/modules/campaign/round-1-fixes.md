# Campaign Module R1 — Fix Report

> 模块: campaign | 轮次: R1
> 修复时间: 2026-05-01
> TypeScript编译验证: ✅ 通过 (npx tsc --noEmit, 0 errors)

## 修复摘要

| FIX-ID | 对应P0 | 子系统 | 修复类型 | 状态 |
|--------|--------|--------|---------|------|
| FIX-301 | P0-1 (S5-B01) | VIPSystem | NaN防护 | ✅ 已修复 |
| FIX-302 | P0-2 (S3-B04) | SweepSystem | NaN防护 | ✅ 已修复 |
| FIX-303 | P0-3 (S6-B03) | ChallengeStageSystem | 无锁发奖防护 | ✅ 已修复 |
| FIX-304 | P0-4 (S6-E01) | ChallengeStageSystem | 深拷贝 | ✅ 已修复 |

---

## FIX-301: VIPSystem.addExp NaN防护

**问题**: `NaN <= 0 === false`，导致NaN绕过检查，vipExp永久损坏

**源码位置**: `VIPSystem.ts:179-181`

**修复内容**:
```typescript
// Before:
addExp(amount: number): void {
    if (amount <= 0) return;
    this.vipExp += amount;
}

// After:
addExp(amount: number): void {
    if (!Number.isFinite(amount) || amount <= 0) return;
    this.vipExp += amount;
}
```

**修复效果**:
- `addExp(NaN)` → 被拦截，vipExp不变
- `addExp(Infinity)` → 被拦截，vipExp不变
- `addExp(100)` → 正常添加

---

## FIX-302: SweepSystem.addTickets NaN防护

**问题**: `NaN <= 0 === false`，导致NaN绕过检查，ticketCount永久损坏

**源码位置**: `SweepSystem.ts:179-183`

**修复内容**:
```typescript
// Before:
addTickets(amount: number): void {
    if (amount <= 0) {
        throw new Error(`[SweepSystem] 扫荡令数量必须大于0: ${amount}`);
    }
    this.ticketCount += amount;
}

// After:
addTickets(amount: number): void {
    if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error(`[SweepSystem] 扫荡令数量必须大于0: ${amount}`);
    }
    this.ticketCount += amount;
}
```

**修复效果**:
- `addTickets(NaN)` → 抛出Error，ticketCount不变
- `addTickets(Infinity)` → 抛出Error，ticketCount不变
- `addTickets(5)` → 正常添加

---

## FIX-303: ChallengeStageSystem.completeChallenge 无锁发奖防护

**问题**: 未调用preLockResources直接调用completeChallenge(victory=true)可免费获得奖励

**源码位置**: `ChallengeStageSystem.ts:351-358`

**修复内容**:
```typescript
// Before:
const preLocked = this.preLockedResources[stageId];
const armyCost = preLocked?.army ?? 0;
const staminaCost = preLocked?.stamina ?? 0;

// After:
const preLocked = this.preLockedResources[stageId];
// FIX-303: 未预锁资源不允许完成挑战，防止免费刷奖励
if (!preLocked) {
    return { victory: false, rewards: [], firstClear: false, armyCost: 0, staminaCost: 0 };
}
const armyCost = preLocked.army ?? 0;
const staminaCost = preLocked.stamina ?? 0;
```

**修复效果**:
- 未调用`preLockResources`直接`completeChallenge('challenge_1', true)` → 返回空结果，不发奖
- 正常流程 `preLockResources` → `completeChallenge` → 不受影响
- 失败返还路径：`preLocked`存在但`victory=false` → 正常返还资源

---

## FIX-304: ChallengeStageSystem serialize/deserialize 深拷贝

**问题**: `{ ...this.stageProgress }` 浅拷贝导致内部对象引用泄漏

**源码位置**: `ChallengeStageSystem.ts:435-453`

**修复内容**:
```typescript
// Before (serialize):
serialize(): ChallengeSaveData {
    return {
        version: SAVE_VERSION,
        stageProgress: { ...this.stageProgress },  // 浅拷贝!
        lastResetDate: this.lastResetDate,
    };
}

// After (serialize):
serialize(): ChallengeSaveData {
    const stageProgress: Record<string, ChallengeStageProgress> = {};
    for (const [id, progress] of Object.entries(this.stageProgress)) {
        stageProgress[id] = { ...progress };  // 深拷贝每个条目
    }
    return {
        version: SAVE_VERSION,
        stageProgress,
        lastResetDate: this.lastResetDate,
    };
}

// Before (deserialize):
this.stageProgress = { ...data.stageProgress };  // 浅拷贝!

// After (deserialize):
const stageProgress: Record<string, ChallengeStageProgress> = {};
for (const [id, progress] of Object.entries(data.stageProgress)) {
    stageProgress[id] = { ...progress };  // 深拷贝每个条目
}
this.stageProgress = stageProgress;
```

**修复效果**:
- `serialize()` 返回的数据被外部修改不影响内部状态
- `deserialize()` 创建全新对象，与输入数据无引用共享
- 与CampaignProgressSystem.getProgress()的深拷贝设计模式保持一致

---

## 编译验证

```
$ npx tsc --noEmit
(无输出，0 errors)
```

✅ 所有修复通过TypeScript类型检查。
