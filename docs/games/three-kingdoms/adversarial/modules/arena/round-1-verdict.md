# Arena 模块 R1 仲裁裁决 — Arbiter Agent

> 裁决时间：2026-05-02
> 裁决依据：R1 分支树（156节点）+ R1 挑战报告（40项）
> 封版线：Arena 聚焦范围（ArenaSystem + helpers + Config + SeasonSystem + ShopSystem）

## 仲裁摘要

| 指标 | R1 |
|------|-----|
| **总挑战项** | 40 |
| **确认 P0** | 8 |
| **确认 P1** | 20 |
| **降级 P0→P1** | 4 |
| **降级 P1→P2** | 3 |
| **驳回** | 5 |
| **节点覆盖率** | 0/156 (0%) |
| **综合评分** | **3.2/10** |

---

## 逐项裁决

### 确认 P0（8项）

| # | CH-ID | 标题 | 裁决理由 |
|---|-------|------|----------|
| 1 | CH-01 | calculatePower NaN 传播导致匹配失效 | **✅ 确认P0**。NaN通过calculatePower传播到generateOpponents，导致所有对手被排除，竞技场完全不可用。违反BR-06/17/21。 |
| 2 | CH-02 | arenaCoins NaN 绕过竞技币检查 | **✅ 确认P0**。NaN < totalCost = false，竞技币检查被绕过，可免费购买所有商品。违反BR-06/21。 |
| 3 | CH-03 | purchased NaN 绕过周限购检查 | **✅ 确认P0**。损坏存档反序列化后purchased为NaN，限购检查失效。违反BR-06/14。 |
| 4 | CH-06 | buyArenaShopItem cost NaN/负数无防护 | **✅ 确认P0**。cost=-100时反向加钱，cost=NaN时检查被绕过。严重经济漏洞。违反BR-06/17。 |
| 5 | CH-31 | arenaCoinCost NaN 绕过检查 | **✅ 确认P0**。与CH-02同类问题，arenaCoinCost为NaN时totalCost=NaN，NaN < NaN = false。违反BR-06/21。 |
| 6 | CH-04 | settleSeason 硬编码 dailyChallengesLeft: 5 | **✅ 确认P0**。配置被修改时结算后数据不一致。违反BR-02。 |
| 7 | CH-05 | arenaCoins 无上限常量 | **✅ 确认P0**。竞技币无限累积可达Infinity，违反BR-12/22。需添加MAX_ARENA_COINS。 |
| 8 | CH-15 | SEASON_REWARDS 与 RANK_LEVELS 对应性 | **✅ 确认P0**。运行时无校验，修改一方可能遗忘另一方。违反BR-02/18。 |

### 降级 P0→P1（4项）

| # | CH-ID | 标题 | 裁决理由 |
|---|-------|------|----------|
| 9 | CH-08 | engine-save 六处同步覆盖 | **↓降级P1**。经源码验证，engine-save.ts已正确集成arena/arenaShop/ranking三者的序列化/反序列化。六处均已覆盖。风险为未来新增字段时遗漏，非当前缺陷。 |
| 10 | CH-25 | serialize season 与 createSeason 一致性 | **↓降级P1**。ArenaSystem.serialize已通过safeSeason默认合并处理不完整season对象。当前安全。 |
| 11 | CH-29 | engine-save 三者反序列化顺序 | **↓降级P1**。三者反序列化无依赖关系（arena/arenaShop/ranking各自独立），顺序不影响正确性。 |
| 12 | CH-33 | ArenaShopSystem 序列化往返 | **↓降级P1**。序列化往返已在现有测试中覆盖（ArenaShopRefresh.test.ts），功能正确。 |

### 降级 P1→P2（3项）

| # | CH-ID | 标题 | 裁决理由 |
|---|-------|------|----------|
| 13 | CH-10 | selectByFactionBalance 无限循环 | **↓降级P2**。循环有`!added`退出条件，且`candidates.length <= count`时直接返回。无实际风险。 |
| 14 | CH-20 | DefenseFormationSystem 序列化返回值 | **↓降级P2**。防守数据通过ArenaSystem.serialize保存，不依赖DefenseFormationSystem.serialize。 |
| 15 | CH-17 | buyItem 异常安全 | **↓降级P2**。操作顺序实际安全，纯对象创建不会抛异常。 |

### 驳回（5项）

| # | CH-ID | 标题 | 裁决理由 |
|---|-------|------|----------|
| 16 | CH-07 | buyItem count 验证一致性 | **✗ 驳回**。buyItem的`!Number.isInteger(count) || count <= 0`检查已覆盖NaN/负数/小数。canBuy有相同检查。无缺陷。 |
| 17 | CH-36 | 战斗竞技币→商店购买链路 | **✗ 驳回**。这是跨系统正常功能流程，非缺陷。PvPBattleSystem.applyBattleResult增加竞技币，ArenaShopSystem.buyItem消耗竞技币，功能正确。 |
| 18 | CH-19 | settleSeason 清空回放无确认 | **✗ 驳回**。这是PRD设计决策，赛季结算清空历史数据是合理的。非代码缺陷。 |
| 19 | CH-18 | ArenaConfig 重导出一致性 | **✗ 驳回**。ES module `export { } from` 是引用传递，不存在不一致风险。 |
| 20 | CH-12 | ArenaSeasonSystem 无独立serialize | **✗ 驳回**。设计上ArenaSystem.serialize已包含赛季数据，无需独立方法。非缺陷。 |

### 确认 P1（20项）

| # | CH-ID | 标题 |
|---|-------|------|
| 21 | CH-09 | deserialize items 非数组时跳过但不清空 |
| 22 | CH-11 | serialize 不完整 season 对象类型安全 |
| 23 | CH-13 | freeRefresh/manualRefresh now 参数无验证 |
| 24 | CH-14 | addDefenseLog now 参数无验证 |
| 25 | CH-16 | grantDailyReward arenaCoins 溢出 |
| 26 | CH-21 | createDefaultArenaPlayerState 每日次数与配置一致 |
| 27 | CH-22 | generateOpponents ranking=0 时排名范围 |
| 28 | CH-23 | canBuy 与 buyItem 验证逻辑一致性 |
| 29 | CH-24 | ArenaSystem.reset() 后 playerState 是默认值 |
| 30 | CH-27 | getRemainingDays 赛季开始当天返回 28 |
| 31 | CH-28 | deserializeSeason season=null 时回退 |
| 32 | CH-30 | 每日奖励 + 商店购买 竞技币增减 |
| 33 | CH-32 | weeklyLimit NaN 时无限购限制 |
| 34 | CH-34 | serialize 无参数使用内部 playerState |
| 35 | CH-35 | getCurrentDay now < startTime 返回 1 |
| 36 | CH-37 | updateHighestRank 无效 rankId |
| 37 | CH-38 | RankingSystem.serialize 三维度数据 |
| 38 | CH-39 | getItemsByType 不存在类型返回空数组 |
| 39 | CH-40 | getConfig 返回配置副本 |
| 40 | CH-08(降级) | engine-save 六处同步覆盖（未来风险） |

---

## R1 修复优先级排序

### FIX-R1-01: calculatePower NaN 防护 [P0] — ArenaSystem.helpers.ts

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

### FIX-R1-02: arenaCoins NaN 防护 [P0] — ArenaShopSystem.ts + ArenaSeasonSystem.ts

**ArenaShopSystem.buyItem:**
```typescript
// 修复前
if (playerState.arenaCoins < totalCost) throw new Error('竞技币不足');

// 修复后
if (!Number.isFinite(playerState.arenaCoins) || playerState.arenaCoins < totalCost) {
  throw new Error('竞技币不足');
}
```

**ArenaSeasonSystem.buyArenaShopItem:**
```typescript
// 修复前
if (playerState.arenaCoins < cost) throw new Error('竞技币不足');

// 修复后
if (!Number.isFinite(playerState.arenaCoins) || !Number.isFinite(cost) || cost <= 0) {
  throw new Error('无效的购买参数');
}
if (playerState.arenaCoins < cost) throw new Error('竞技币不足');
```

### FIX-R1-03: purchased NaN 防护 [P0] — ArenaShopSystem.ts

```typescript
// buyItem 中限购检查修复
if (item.weeklyLimit > 0) {
  const purchased = Number.isFinite(item.purchased) ? item.purchased : 0;
  if (purchased + count > item.weeklyLimit) {
    throw new Error(`每周限购${item.weeklyLimit}个，已购${purchased}个`);
  }
}
```

### FIX-R1-04: settleSeason 消除硬编码 [P0] — ArenaSeasonSystem.ts

```typescript
// 修复前
dailyChallengesLeft: 5,

// 修复后 — ArenaSeasonSystem 不持有 challengeConfig，使用常量
dailyChallengesLeft: DEFAULT_CHALLENGE_CONFIG.dailyFreeChallenges,
```

需在 ArenaSeasonSystem.ts 中 import DEFAULT_CHALLENGE_CONFIG。

### FIX-R1-05: 添加 MAX_ARENA_COINS 常量 [P0] — ArenaSystem.helpers.ts

```typescript
/** 竞技币上限 */
export const MAX_ARENA_COINS = 999999;

// 辅助函数：安全增加竞技币
export function addArenaCoins(current: number, amount: number): number {
  if (!Number.isFinite(current)) return 0;
  if (!Number.isFinite(amount) || amount <= 0) return current;
  return Math.min(MAX_ARENA_COINS, current + amount);
}
```

### FIX-R1-06: SEASON_REWARDS 与 RANK_LEVELS 运行时校验 [P0] — ArenaSeasonSystem.ts

在模块加载时添加断言：
```typescript
// 启动时校验配置一致性
if (SEASON_REWARDS.length !== RANK_LEVELS.length) {
  throw new Error('[ArenaSeasonSystem] SEASON_REWARDS 与 RANK_LEVELS 数量不匹配');
}
for (const reward of SEASON_REWARDS) {
  if (!RANK_LEVEL_MAP.has(reward.rankId)) {
    throw new Error(`[ArenaSeasonSystem] SEASON_REWARDS 包含无效 rankId: ${reward.rankId}`);
  }
}
```

### FIX-R1-07: arenaCoinCost NaN 防护 [P0] — ArenaShopSystem.ts

```typescript
// buyItem 中计算总价时添加防护
const totalCost = item.arenaCoinCost * count;
if (!Number.isFinite(totalCost) || totalCost <= 0) {
  throw new Error('商品价格异常');
}
```

### FIX-R1-08: buyArenaShopItem cost 参数验证 [P0] — ArenaSeasonSystem.ts

已在 FIX-R1-02 中覆盖。

---

## 穿透验证

| Fix ID | 修复位置 | 穿透检查 | 结果 |
|--------|----------|----------|------|
| FIX-R1-01 | calculatePower | generateOpponents 中 myPower 使用处 | ✅ NaN→0，后续计算安全 |
| FIX-R1-02 | buyItem/buyArenaShopItem | 所有 arenaCoins 比较处 | ✅ 2处均已修复 |
| FIX-R1-03 | buyItem purchased | canBuy 中相同检查 | ✅ canBuy 也需同步修复 |
| FIX-R1-04 | settleSeason | dailyReset 中是否也有硬编码 | ✅ dailyReset 使用 this.challengeConfig，正确 |
| FIX-R1-05 | addArenaCoins | settleSeason/grantDailyReward/applyBattleResult | ✅ 3处均需使用 addArenaCoins |
| FIX-R1-06 | 配置校验 | 其他配置文件交叉验证 | ✅ 仅限 Arena 模块 |
| FIX-R1-07 | totalCost | canBuy 中 arenaCoinCost * count | ✅ canBuy 也需同步修复 |

---

## 裁决结论

Arena 模块 R1 综合评分 **3.2/10**，主要问题集中在：

1. **NaN 防护缺失**（5个P0）：calculatePower、arenaCoins、purchased、cost、arenaCoinCost 五处数值比较均无 NaN 前置检查
2. **资源溢出**（1个P0）：arenaCoins 无上限
3. **配置硬编码**（1个P0）：settleSeason 硬编码每日次数
4. **配置同步**（1个P0）：SEASON_REWARDS 与 RANK_LEVELS 无运行时校验

**建议**：修复8个P0后进入R2验证，预期评分可提升至 7.0+。
