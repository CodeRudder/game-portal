# Arena 模块 R1 修复报告 — Builder Agent

> 修复时间：2026-05-02
> 修复范围：8个P0缺陷
> 测试结果：556 passed, 0 failed, 9 todo

## 修复摘要

| Fix ID | 标题 | 文件 | 状态 |
|--------|------|------|------|
| FIX-R1-01 | calculatePower NaN 防护 | ArenaSystem.helpers.ts | ✅ 已修复 |
| FIX-R1-02 | arenaCoins NaN 防护 | ArenaShopSystem.ts + ArenaSeasonSystem.ts | ✅ 已修复 |
| FIX-R1-03 | purchased NaN 防护 | ArenaShopSystem.ts | ✅ 已修复 |
| FIX-R1-04 | settleSeason 消除硬编码 | ArenaSeasonSystem.ts | ✅ 已修复 |
| FIX-R1-05 | 添加 MAX_ARENA_COINS + addArenaCoins | ArenaSystem.helpers.ts | ✅ 已修复 |
| FIX-R1-06 | SEASON_REWARDS vs RANK_LEVELS 运行时校验 | ArenaSeasonSystem.ts | ✅ 已修复 |
| FIX-R1-07 | arenaCoinCost NaN 防护 | ArenaShopSystem.ts | ✅ 已修复 |
| FIX-R1-08 | buyArenaShopItem cost 参数验证 | ArenaSeasonSystem.ts | ✅ 已修复 |

---

## 修复详情

### FIX-R1-01: calculatePower NaN 防护

**文件**：`src/games/three-kingdoms/engine/pvp/ArenaSystem.helpers.ts`

**修改**：
```typescript
// 修复前
export function calculatePower(playerState: ArenaPlayerState): number {
  const heroCount = playerState.defenseFormation.slots.filter((s) => s !== '').length;
  return Math.max(0, playerState.score * 10 + heroCount * 1000 + 5000);
}

// 修复后
export function calculatePower(playerState: ArenaPlayerState): number {
  const score = Number.isFinite(playerState.score) ? playerState.score : 0;
  const heroCount = playerState.defenseFormation.slots.filter((s) => s !== '').length;
  return Math.max(0, score * 10 + heroCount * 1000 + 5000);
}
```

**穿透验证**：`generateOpponents` 中 `myPower = calculatePower(playerState)` → NaN→0，后续 minPower/maxPower 计算安全。

---

### FIX-R1-02: arenaCoins NaN 防护

**文件**：`ArenaShopSystem.ts` buyItem + canBuy, `ArenaSeasonSystem.ts` buyArenaShopItem

**ArenaShopSystem.buyItem 修改**：
```typescript
// 修复前
if (playerState.arenaCoins < totalCost) throw new Error('竞技币不足');

// 修复后
if (!Number.isFinite(playerState.arenaCoins) || playerState.arenaCoins < totalCost) {
  throw new Error('竞技币不足');
}
```

**ArenaSeasonSystem.buyArenaShopItem 修改**：
```typescript
// 修复后
if (!Number.isFinite(cost) || cost <= 0) {
  throw new Error('无效的购买价格');
}
if (!Number.isFinite(playerState.arenaCoins) || playerState.arenaCoins < cost) {
  throw new Error('竞技币不足');
}
```

**穿透验证**：canBuy 方法同步修复，保持一致性。

---

### FIX-R1-03: purchased NaN 防护

**文件**：`ArenaShopSystem.ts` buyItem + canBuy

**修改**：
```typescript
// 修复前
if (item.weeklyLimit > 0 && item.purchased + count > item.weeklyLimit) {

// 修复后
if (item.weeklyLimit > 0) {
  const purchased = Number.isFinite(item.purchased) ? item.purchased : 0;
  if (purchased + count > item.weeklyLimit) {
```

**穿透验证**：buyItem 中 items 赋值也同步使用 `Number.isFinite(item.purchased) ? item.purchased : 0`。

---

### FIX-R1-04: settleSeason 消除硬编码

**文件**：`ArenaSeasonSystem.ts`

**修改**：
```typescript
// 修复前
dailyChallengesLeft: 5,

// 修复后
dailyChallengesLeft: DEFAULT_CHALLENGE_CONFIG.dailyFreeChallenges,
```

新增 import：`import { DEFAULT_CHALLENGE_CONFIG, MAX_ARENA_COINS, addArenaCoins } from './ArenaSystem.helpers';`

**穿透验证**：`dailyReset` 方法使用 `this.challengeConfig.dailyFreeChallenges`（构造函数中从默认配置合并），正确。

---

### FIX-R1-05: 添加 MAX_ARENA_COINS + addArenaCoins

**文件**：`ArenaSystem.helpers.ts`

**新增**：
```typescript
export const MAX_ARENA_COINS = 999999;

export function addArenaCoins(current: number, amount: number): number {
  if (!Number.isFinite(current)) return 0;
  if (!Number.isFinite(amount) || amount <= 0) return current;
  return Math.min(MAX_ARENA_COINS, Math.max(0, current + amount));
}
```

**使用处**：
- `ArenaSeasonSystem.settleSeason`: `addArenaCoins(playerState.arenaCoins, reward.arenaCoin)`
- `ArenaSeasonSystem.grantDailyReward`: `addArenaCoins(playerState.arenaCoins, reward.arenaCoin)`
- `PvPBattleSystem.applyBattleResult`: `addArenaCoins(newState.arenaCoins, coinReward)`

**重导出**：ArenaConfig.ts, ArenaSystem.ts, index.ts 均已更新。

---

### FIX-R1-06: SEASON_REWARDS vs RANK_LEVELS 运行时校验

**文件**：`ArenaSeasonSystem.ts`

**新增**（模块加载时执行）：
```typescript
if (SEASON_REWARDS.length !== RANK_LEVELS.length) {
  throw new Error('[ArenaSeasonSystem] SEASON_REWARDS 与 RANK_LEVELS 数量不匹配');
}
for (const reward of SEASON_REWARDS) {
  if (!RANK_LEVEL_MAP.has(reward.rankId)) {
    throw new Error(`[ArenaSeasonSystem] SEASON_REWARDS 包含无效 rankId: ${reward.rankId}`);
  }
}
```

---

### FIX-R1-07: arenaCoinCost NaN 防护

**文件**：`ArenaShopSystem.ts` buyItem + canBuy

**修改**：
```typescript
const totalCost = item.arenaCoinCost * count;
if (!Number.isFinite(totalCost) || totalCost <= 0) {
  throw new Error('商品价格异常');
}
```

---

### FIX-R1-08: buyArenaShopItem cost 参数验证

**文件**：`ArenaSeasonSystem.ts`

已在 FIX-R1-02 中合并修复。

---

## 测试更新

### 更新的测试文件

1. **`adversarial-ArenaShopSystem.test.ts`**（3处更新）：
   - A-001/A-002: 错误消息 `购买数量必须大于0` → `购买数量必须为正整数`
   - A-003: `expect(...).not.toThrow()` → `expect(...).toThrow('购买数量必须为正整数')`（NaN 现在被正确拒绝）
   - F-002: 负数价格不再导致负数扣款，改为抛出 `商品价格异常`
   - F-003: 价格为0不再免费获得，改为抛出 `商品价格异常`

2. **`arena-adversarial.test.ts`**（1处更新）：
   - calculatePower NaN 测试：`expect(...).toBeNaN()` → `expect(...).toBe(5000)`（NaN→0→安全默认值）

### 测试结果

```
Test Files  17 passed (17)
Tests       556 passed | 9 todo (565)
Duration    6.68s
```

---

## 修改文件清单

| 文件 | 修改类型 | 行数变化 |
|------|----------|----------|
| ArenaSystem.helpers.ts | 新增 MAX_ARENA_COINS, addArenaCoins, 修复 calculatePower | +18 |
| ArenaConfig.ts | 新增重导出 | +2 |
| ArenaSystem.ts | 新增重导出 | +2 |
| ArenaSeasonSystem.ts | 新增 import, 修复 settleSeason/grantDailyReward/buyArenaShopItem, 新增运行时校验 | +15 |
| ArenaShopSystem.ts | 新增 import, 修复 buyItem/canBuy | +15 |
| PvPBattleSystem.ts | 新增 import, 修复 applyBattleResult | +4 |
| index.ts | 新增重导出 | +2 |
| adversarial-ArenaShopSystem.test.ts | 更新测试预期 | ~8 |
| arena-adversarial.test.ts | 更新测试预期 | ~1 |
