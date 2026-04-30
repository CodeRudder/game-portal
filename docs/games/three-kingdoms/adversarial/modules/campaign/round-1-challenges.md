# Campaign Module R1 — Challenger Report

> 模块: campaign | 轮次: R1 | Challenger: v1.4
> 源码审查范围: 19个 .ts 源文件, ~4,300行
> 审查方法: 逐文件源码审查 + 模式搜索

## 执行摘要

| 指标 | 数值 |
|------|------|
| 新发现P0 | **4个** |
| 新发现P1 | **3个** |
| 已知P0确认 | 2个 (DEF-010, DEF-014 已修复) |
| 虚报率 | 0% (所有P0均有源码行号+复现场景) |

---

## P0-1: VIPSystem.addExp NaN绕过 `<= 0` 检查

**严重等级**: P0 (经济漏洞)
**源码位置**: `VIPSystem.ts:180`
**维度**: NaN绕过

### 源码

```typescript
addExp(amount: number): void {
    if (amount <= 0) return;  // NaN <= 0 === false → 放行!
    this.vipExp += amount;    // this.vipExp += NaN → NaN
}
```

### 复现场景

```typescript
const vip = new VIPSystem();
vip.addExp(NaN);
// vip.vipExp = NaN
// vip.getBaseLevel() → calcLevelFromExp(NaN) → NaN >= cfg.requiredExp 永远false → level=0
// 但 vipExp 本身是 NaN，后续所有数值计算都受影响
vip.addExp(100); // NaN + 100 = NaN → VIP经验永久损坏
```

### 影响

1. `vipExp` 变为 NaN 后，所有后续 `addExp` 调用无法恢复
2. `getLevelProgress()` 返回 NaN
3. `getFreeSweepRemaining()` 可能返回 NaN → SweepSystem 行为异常
4. `serialize()` 将 NaN 写入存档 → `JSON.stringify(NaN)` = `"null"` → 反序列化后 vipExp 变为 null → crash

### 修复建议

```typescript
addExp(amount: number): void {
    if (!Number.isFinite(amount) || amount <= 0) return;
    this.vipExp += amount;
}
```

---

## P0-2: SweepSystem.addTickets NaN绕过 `<= 0` 检查

**严重等级**: P0 (经济漏洞)
**源码位置**: `SweepSystem.ts:179`
**维度**: NaN绕过

### 源码

```typescript
addTickets(amount: number): void {
    if (amount <= 0) {  // NaN <= 0 === false → 放行!
        throw new Error(`[SweepSystem] 扫荡令数量必须大于0: ${amount}`);
    }
    this.ticketCount += amount;  // this.ticketCount += NaN → NaN
}
```

### 复现场景

```typescript
const sweep = new SweepSystem(dp, rewardDeps, sweepDeps);
sweep.addTickets(NaN);
// sweep.ticketCount = NaN
// sweep.hasEnoughTickets(5) → NaN >= 5 === false → 永远false
// sweep.sweep(...) → 扫荡令检查失败, 无法扫荡
// sweep.claimDailyTickets() → NaN + 3 = NaN → 扫荡令永久损坏
```

### 影响

1. 扫荡令数量变为 NaN 后无法恢复
2. `serialize()` 将 NaN 写入存档 → JSON中 NaN 变为 null → 反序列化后 ticketCount 为 null → crash
3. 所有依赖扫荡令的功能失效

### 修复建议

```typescript
addTickets(amount: number): void {
    if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error(`[SweepSystem] 扫荡令数量必须大于0: ${amount}`);
    }
    this.ticketCount += amount;
}
```

---

## P0-3: ChallengeStageSystem.completeChallenge 无需预锁即可获得奖励

**严重等级**: P0 (经济漏洞 — 可无限刷资源)
**源码位置**: `ChallengeStageSystem.ts:341-400`
**维度**: 经济漏洞

### 源码

```typescript
completeChallenge(stageId: string, victory: boolean): ChallengeResult {
    const config = this.getStageConfig(stageId);
    if (!config) {
        return { victory: false, rewards: [], firstClear: false, armyCost: 0, staminaCost: 0 };
    }

    const preLocked = this.preLockedResources[stageId];
    const armyCost = preLocked?.army ?? 0;  // 无预锁 → 0
    const staminaCost = preLocked?.stamina ?? 0; // 无预锁 → 0

    delete this.preLockedResources[stageId];

    if (victory) {
        // ⚠️ 不检查是否经过 preLockResources, 直接发奖!
        const progress = this.stageProgress[stageId];
        const firstClear = !progress.firstCleared;
        if (progress) {
            progress.firstCleared = true;
            progress.dailyAttempts++;  // 但每日次数仍然增加
        }
        const rewards = this.calculateRewards(config, firstClear);
        // 发放奖励... (不消耗任何资源!)
    }
}
```

### 复现场景

```typescript
const challenge = new ChallengeStageSystem(deps);
// 不调用 preLockResources, 直接调用 completeChallenge
for (let i = 0; i < 3; i++) {
    challenge.completeChallenge('challenge_1', true);
    // 每次都发放奖励, 不消耗兵力和天命!
    // dailyAttempts 仍然增加, 所以每日最多免费刷3次
}
// 3次 × (500粮 + 300金 + 可能的碎片) = 免费资源
```

### 影响

1. 玩家可以跳过 `preLockResources` 直接调用 `completeChallenge(victory=true)` 获得免费奖励
2. 虽然受每日3次限制, 但完全不消耗兵力和天命
3. 首通额外奖励也被免费获得

### 修复建议

```typescript
completeChallenge(stageId: string, victory: boolean): ChallengeResult {
    const config = this.getStageConfig(stageId);
    if (!config) {
        return { victory: false, rewards: [], firstClear: false, armyCost: 0, staminaCost: 0 };
    }

    const preLocked = this.preLockedResources[stageId];
    if (!preLocked) {
        return { victory: false, rewards: [], firstClear: false, armyCost: 0, staminaCost: 0 };
    }
    // ... 后续逻辑不变
}
```

---

## P0-4: ChallengeStageSystem serialize/deserialize 浅拷贝导致数据泄漏

**严重等级**: P0 (数据完整性)
**源码位置**: `ChallengeStageSystem.ts:435, 441`
**维度**: 浅拷贝副作用

### 源码

```typescript
serialize(): ChallengeSaveData {
    return {
        version: SAVE_VERSION,
        stageProgress: { ...this.stageProgress }, // 浅拷贝!
        lastResetDate: this.lastResetDate,
    };
}

deserialize(data: ChallengeSaveData): void {
    if (!data || data.version !== SAVE_VERSION) return;
    this.stageProgress = { ...data.stageProgress }; // 浅拷贝!
    this.lastResetDate = data.lastResetDate;
    this.preLockedResources = {};
}
```

### 复现场景

```typescript
const challenge = new ChallengeStageSystem(deps);
challenge.completeChallenge('challenge_1', true); // firstCleared=true, dailyAttempts=1

const saved = challenge.serialize();
// saved.stageProgress['challenge_1'] 和内部 this.stageProgress['challenge_1'] 是同一个对象引用!

// 外部修改存档数据
saved.stageProgress['challenge_1'].dailyAttempts = 999;
// 内部状态也被修改了!
expect(challenge.getDailyAttempts('challenge_1')).toBe(999); // 泄漏!
```

### 影响

1. `serialize()` 返回的数据被外部修改会影响内部状态
2. `deserialize()` 中 `{ ...data.stageProgress }` 仍然共享内部对象引用
3. 违反 CampaignProgressSystem 的深拷贝设计模式（对比 `CampaignProgressSystem.getProgress()` 做了深拷贝）

### 修复建议

```typescript
serialize(): ChallengeSaveData {
    const stageProgress: Record<string, ChallengeStageProgress> = {};
    for (const [id, progress] of Object.entries(this.stageProgress)) {
        stageProgress[id] = { ...progress };
    }
    return {
        version: SAVE_VERSION,
        stageProgress,
        lastResetDate: this.lastResetDate,
    };
}

deserialize(data: ChallengeSaveData): void {
    if (!data || data.version !== SAVE_VERSION) return;
    const stageProgress: Record<string, ChallengeStageProgress> = {};
    for (const [id, progress] of Object.entries(data.stageProgress)) {
        stageProgress[id] = { ...progress };
    }
    this.stageProgress = stageProgress;
    this.lastResetDate = data.lastResetDate;
    this.preLockedResources = {};
}
```

---

## P1-1: RewardDistributor.calculateRewards NaN stars 穿透

**严重等级**: P1 (NaN传播)
**源码位置**: `RewardDistributor.ts:151`
**维度**: NaN绕过

### 源码

```typescript
calculateRewards(stageId: string, stars: number, isFirstClear: boolean): StageReward {
    // ...
    const clampedStars = Math.max(0, Math.min(MAX_STARS, Math.floor(stars))) as StarRating;
    // Math.floor(NaN) = NaN
    // Math.min(3, NaN) = NaN
    // Math.max(0, NaN) = NaN
    // clampedStars = NaN

    const starMultiplier = getStarMultiplier(clampedStars, ...);
    // getStarMultiplier(NaN): NaN >= 3 → false → STAR_MULTIPLIERS[NaN] = undefined → 1.0
    // starMultiplier = 1.0 (看似安全)

    const exp = Math.floor(stage.baseExp * starMultiplier);
    // exp = Math.floor(baseExp * 1.0) = baseExp (正常)
    // 但如果 stage.baseExp 是 NaN, 则 exp = NaN
}
```

### 分析

- `clampedStars` 为 NaN，但 `getStarMultiplier(NaN)` 走 fallback 返回 1.0
- 实际上 `exp` 计算在 `starMultiplier=1.0` 时是安全的
- 但 `STAR_MULTIPLIERS[NaN]` 返回 `undefined`，`?? 1.0` 兜底
- **降低为P1**: 实际影响有限，但违反了"所有数值API必须检查NaN"的规则

### 修复建议

```typescript
const clampedStars = Number.isNaN(stars) ? 0 : Math.max(0, Math.min(MAX_STARS, Math.floor(stars))) as StarRating;
```

---

## P1-2: RewardDistributor.getFinalStageBonus NaN stars

**严重等级**: P1 (NaN传播)
**源码位置**: `RewardDistributor.ts:461`
**维度**: NaN绕过

### 源码

```typescript
getFinalStageBonus(stars: number = 3): { ... } {
    const starMultiplier = Math.max(1, stars);
    // Math.max(1, NaN) = NaN
    return {
        bonusGold: 5000 * NaN,   // NaN
        bonusGrain: 8000 * NaN,  // NaN
        bonusMandate: 100 * NaN, // NaN
        starMultiplier: NaN,
    };
}
```

### 分析

- `getFinalStageBonus(NaN)` 返回全部 NaN 的奖励
- 此函数是 v20.0 新增的统一奖励 API，可能被 UI 层调用
- NaN 奖励如果传入 distribute，会被 `amount > 0` 检查过滤（NaN > 0 === false）
- **降低为P1**: distribute 有防御，但返回 NaN 值违反 API 契约

### 修复建议

```typescript
getFinalStageBonus(stars: number = 3): { ... } {
    const safeStars = Number.isFinite(stars) ? stars : 3;
    const starMultiplier = Math.max(1, safeStars);
    // ...
}
```

---

## P1-3: SweepSystem.sweep VIP免费扫荡不可回滚

**严重等级**: P1 (竞态条件)
**源码位置**: `SweepSystem.ts:258-267`
**维度**: 竞态条件

### 源码

```typescript
// DEF-012: 优先使用VIP免费扫荡次数
let freeSweepUsed = 0;
if (this.vipSystem) {
    const remaining = this.vipSystem.getFreeSweepRemaining();
    freeSweepUsed = Math.min(remaining, count);
    for (let i = 0; i < freeSweepUsed; i++) {
        this.vipSystem.useFreeSweep(); // 已消耗!
    }
}

const remainingCount = count - freeSweepUsed;
const required = this.getRequiredTickets(remainingCount);
if (this.ticketCount < required) {
    // 注释承认: "免费次数的消耗是'尝试'的一部分"
    // 但实际上免费次数已被消耗, 无法回滚!
    return this.failResult(...);
}
```

### 分析

- 如果扫荡令不足，VIP免费扫荡次数已被消耗但无法回滚
- 源码注释已承认此问题但选择不修复
- 实际影响：玩家同时使用免费次数+扫荡令时，如果扫荡令不足，免费次数白白浪费
- **降低为P1**: 边界场景，但影响玩家体验

### 修复建议

先检查扫荡令是否足够，再消耗免费次数：

```typescript
const remainingCount = count - Math.min(this.vipSystem?.getFreeSweepRemaining() ?? 0, count);
const required = this.getRequiredTickets(remainingCount);
if (this.ticketCount < required) {
    return this.failResult(...); // 未消耗任何资源
}
// 确认可以执行后再消耗免费次数
```

---

## 已知缺陷确认

### DEF-010: CampaignProgressSystem.completeStage NaN 防护 ✅ 已修复

**源码位置**: `CampaignProgressSystem.ts:285`
**状态**: 已修复

```typescript
if (Number.isNaN(stars)) {
    stars = 0;
}
```

确认防护有效。但注意只保护了 `CampaignProgressSystem`，`RewardDistributor.calculateRewards` 没有同样的防护（P1-1）。

### DEF-014: RewardDistributor.distribute null fragments 防护 ✅ 已修复

**源码位置**: `RewardDistributor.ts:220`
**状态**: 已修复

```typescript
if (!reward.fragments) {
    reward.fragments = {};
}
```

确认防护有效。

### DEF-009: AutoPushExecutor try-finally ✅ 已修复

**源码位置**: `AutoPushExecutor.ts:139-170`
**状态**: 已修复，有专门的测试文件 `AutoPushExecutor-def009.test.ts`

### DEF-012: SweepSystem VIP免费扫荡 ✅ 已实现

**源码位置**: `SweepSystem.ts:258-267`
**状态**: 已实现，但有P1-3的回滚问题

---

## 保存/加载完整性验证

### engine-save 六处同步检查

| 子系统 | GameSaveData类型 | SaveContext | buildSaveData | toIGameState | fromIGameState | applySaveData | 状态 |
|--------|---------|------|------|------|------|------|------|
| CampaignProgress | ✅ | ✅ ctx.campaign | ✅ L174 | ✅ | ✅ | ✅ L463 | 完整 |
| SweepSystem | ✅ sweep? | ✅ ctx.sweep? | ✅ L223 | ✅ | ✅ | ✅ L570 | 完整 |
| VIPSystem | ✅ vip? | ✅ ctx.vip? | ✅ L225 | ✅ | ✅ | ✅ L574 | 完整 |
| ChallengeStageSystem | ✅ challenge? | ✅ ctx.challenge? | ✅ L227 | ✅ | ✅ | ✅ L578 | 完整 |

所有4个子系统在 engine-save 中都有完整的 serialize/deserialize 覆盖。✅

### deserialize(null) 安全性

| 子系统 | deserialize(null) | 安全? |
|--------|-------------------|-------|
| CampaignProgress | 直接访问 data.version | ❌ 会crash |
| SweepSystem | 直接访问 data.version | ❌ 会crash |
| VIPSystem | `if (!data \|\| ...)` 先检查 | ✅ 安全 |
| ChallengeStageSystem | `if (!data \|\| ...)` 先检查 | ✅ 安全 |

注意：`CampaignProgressSystem.deserialize` 和 `SweepSystem.deserialize` 在 `null` 输入时会 crash，但 engine-save 的 `applySaveData` 有 `if (data.campaign)` 保护，所以实际运行时不会触发。降低为 P2。

---

## 配置交叉验证结果

### 章节配置一致性 ✅

- 6个章节文件 ID 与 campaign-config.ts 引用一致
- prerequisiteChapterId 形成完整链: null → chapter1 → chapter2 → ... → chapter5
- 关卡 order 连续（测试覆盖）

### VIP等级表与特权枚举同步 ✅

- VIP_LEVEL_TABLE 7个等级配置完整
- VIPPrivilege 类型与配置表中的 privileges 数组一致
- 免费扫荡上限 FREE_SWEEP_DAILY_LIMIT=3 与 PRD 一致

### 挑战关卡配置 ✅

- 8个挑战关卡配置完整 (challenge_1 ~ challenge_8)
- armyCost 递增: 200 → 1000
- staminaCost 范围: 12 → 20

---

## 虚报率评估

| ID | 级别 | 是否虚报 | 理由 |
|----|------|---------|------|
| P0-1 | P0 | ❌ 不虚报 | NaN绕过可复现, vipExp永久损坏 |
| P0-2 | P0 | ❌ 不虚报 | NaN绕过可复现, ticketCount永久损坏 |
| P0-3 | P0 | ❌ 不虚报 | 无预锁直接发奖可复现 |
| P0-4 | P0 | ❌ 不虚报 | 浅拷贝数据泄漏可复现 |
| P1-1 | P1 | ❌ 不虚报 | NaN穿透存在但影响有限 |
| P1-2 | P1 | ❌ 不虚报 | getFinalStageBonus返回NaN |
| P1-3 | P1 | ❌ 不虚报 | 源码注释已承认此问题 |

**虚报率: 0/7 = 0%** (目标 < 2%)

---

## 修复优先级建议

| 优先级 | ID | 修复工作量 | 说明 |
|--------|-----|-----------|------|
| 🔴 紧急 | P0-3 | 1行 | 添加 preLocked 检查 |
| 🔴 紧急 | P0-4 | 10行 | 深拷贝 stageProgress |
| 🟡 高 | P0-1 | 1行 | `!Number.isFinite(amount) \|\| amount <= 0` |
| 🟡 高 | P0-2 | 1行 | `!Number.isFinite(amount) \|\| amount <= 0` |
| 🟢 中 | P1-1 | 1行 | 添加 NaN 检查 |
| 🟢 中 | P1-2 | 1行 | 添加 NaN 检查 |
| 🟢 低 | P1-3 | 5行 | 调整检查顺序 |
