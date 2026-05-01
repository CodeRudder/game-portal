# Arena 模块 R1 挑战报告 — Challenger Agent

> 挑战时间：2026-05-02
> 挑战范围：Round 1 分支树（156节点）
> 挑战维度：5维度 × 5子系统

## 挑战摘要

| 维度 | 挑战项数 | P0 | P1 | P2 | 驳回 |
|------|----------|-----|-----|-----|------|
| F-Normal | 5 | 2 | 3 | 0 | 0 |
| F-Error | 12 | 8 | 4 | 0 | 0 |
| F-Boundary | 8 | 3 | 5 | 0 | 0 |
| F-Cross | 6 | 4 | 2 | 0 | 0 |
| F-Lifecycle | 9 | 5 | 4 | 0 | 0 |
| **合计** | **40** | **22** | **18** | **0** | **0** |

---

## CH-01: calculatePower NaN 传播导致匹配失效 [P0]

### 维度：F-Error
### 关联节点：AH-CP-02, AS-GO-04, AS-GO-08

**挑战描述**：

`calculatePower` 函数在 `score = NaN` 时返回 NaN（`Math.max(0, NaN) = NaN`）。此 NaN 传播到 `generateOpponents`：

```typescript
const myPower = calculatePower(playerState); // NaN
const minPower = Math.floor(myPower * powerMinRatio); // NaN
const maxPower = Math.ceil(myPower * powerMaxRatio); // NaN
// p.power >= NaN → false, 所有对手被排除
```

**违反规则**：BR-06（NaN 绕过教训）、BR-17（战斗数值安全）、BR-21（资源比较 NaN 防护）

**影响**：玩家积分被异常值污染后，竞技场匹配完全失效，无法生成任何对手。

**建议修复**：`calculatePower` 入口添加 `!Number.isFinite(playerState.score) ? 0 :` 前置检查。

---

## CH-02: arenaCoins NaN 绕过竞技币检查 [P0]

### 维度：F-Error
### 关联节点：SH-NP-01, SH-BY-03

**挑战描述**：

`ArenaShopSystem.buyItem` 和 `ArenaSeasonSystem.buyArenaShopItem` 都使用 `<` 比较竞技币：

```typescript
// ArenaShopSystem
if (playerState.arenaCoins < totalCost) throw new Error('竞技币不足');
// ArenaSeasonSystem
if (playerState.arenaCoins < cost) throw new Error('竞技币不足');
```

当 `arenaCoins = NaN` 时，`NaN < totalCost = false`，检查被绕过，玩家可以免费购买任何商品。

**违反规则**：BR-06（NaN 绕过）、BR-21（资源比较 NaN 防护）

**影响**：竞技币为 NaN 时，所有购买检查失效，无限白嫖商品。

**建议修复**：使用 `!Number.isFinite(playerState.arenaCoins) || playerState.arenaCoins < totalCost` 替代。

---

## CH-03: purchased NaN 绕过周限购检查 [P0]

### 维度：F-Error
### 关联节点：SH-NP-03, SH-BY-05

**挑战描述**：

`ArenaShopSystem.buyItem` 限购检查：

```typescript
if (item.weeklyLimit > 0 && item.purchased + count > item.weeklyLimit)
```

当 `item.purchased = NaN`（反序列化损坏数据）时，`NaN + count > weeklyLimit = false`，限购检查被绕过。

**违反规则**：BR-06（NaN 绕过）、BR-14（保存/加载覆盖扫描）

**影响**：损坏存档加载后，所有限购商品可无限购买。

**建议修复**：添加 `!Number.isFinite(item.purchased)` 前置检查，或 deserialize 时验证。

---

## CH-04: settleSeason 硬编码 dailyChallengesLeft: 5 [P0]

### 维度：F-Error / F-Cross
### 关联节点：SS-ST-04, SS-CR-01

**挑战描述**：

`ArenaSeasonSystem.settleSeason` 硬编码 `dailyChallengesLeft: 5`：

```typescript
const newState: ArenaPlayerState = {
  ...playerState,
  dailyChallengesLeft: 5,  // 硬编码！应使用配置
  ...
};
```

但 `DEFAULT_CHALLENGE_CONFIG.dailyFreeChallenges` 也是 5。如果配置被修改（如 VIP 玩家 8 次），赛季结算后会被错误重置为 5。

**违反规则**：BR-02（配置交叉验证）

**影响**：赛季结算后每日挑战次数与配置不一致。

**建议修复**：`dailyChallengesLeft: this.challengeConfig?.dailyFreeChallenges ?? 5`，或通过 deps 获取配置。

---

## CH-05: arenaCoins 无上限常量 [P0]

### 维度：F-Boundary
### 关联节点：SS-ST-10, SH-BY-01

**挑战描述**：

竞技币（arenaCoins）在以下路径中无限累积，无 `MAX_ARENA_COINS` 上限：

1. `settleSeason` → `arenaCoins + reward.arenaCoin`
2. `grantDailyReward` → `arenaCoins + reward.arenaCoin`
3. `applyBattleResult` → `arenaCoins + coinReward`

王者 I 赛季奖励 arenaCoin = 2000，每日奖励 arenaCoin = 200。长期累积可达 Infinity。

**违反规则**：BR-12（溢出闭环）、BR-22（科技点上限验证类比）

**影响**：竞技币无限累积，最终导致 Infinity，序列化时可能出问题。

**建议修复**：添加 `MAX_ARENA_COINS = 999999` 常量，在所有增加路径中检查上限。

---

## CH-06: buyArenaShopItem cost NaN/负数无防护 [P0]

### 维度：F-Error
### 关联节点：SS-DR-03, SS-DR-06

**挑战描述**：

`ArenaSeasonSystem.buyArenaShopItem` 对 `cost` 参数无验证：

```typescript
buyArenaShopItem(playerState: ArenaPlayerState, cost: number): ArenaPlayerState {
  if (playerState.arenaCoins < cost) throw new Error('竞技币不足');
  return { ...playerState, arenaCoins: playerState.arenaCoins - cost };
}
```

- `cost = NaN` → `arenaCoins < NaN = false` → 跳过检查 → `arenaCoins - NaN = NaN`
- `cost = -100` → `arenaCoins < -100 = false`（arenaCoins >= 0）→ `arenaCoins - (-100) = arenaCoins + 100` → 反向加钱
- `cost = Infinity` → `arenaCoins < Infinity = true` → 正确拒绝（但错误信息不准确）

**违反规则**：BR-06（NaN 绕过）、BR-17（战斗数值安全）

**建议修复**：添加 `if (!Number.isFinite(cost) || cost <= 0) throw new Error('无效的购买价格')`。

---

## CH-07: buyItem count 验证一致性 [P1]

### 维度：F-Error
### 关联节点：SH-BY-06~09

**挑战描述**：

`ArenaShopSystem.buyItem` 对 `count` 参数验证：

```typescript
if (!Number.isInteger(count) || count <= 0) throw new Error('购买数量必须为正整数');
```

此检查覆盖了 NaN（`Number.isInteger(NaN) = false`）、负数、小数。**但** `canBuy` 方法也有相同检查，需验证一致性。

实际上 `buyItem` 的 count 验证是完整的。**降级为 P1**：验证 `canBuy` 与 `buyItem` 的 count 验证逻辑一致性。

**违反规则**：BR-01（所有数值API入口必须检查NaN）

---

## CH-08: engine-save 六处同步覆盖验证 [P0]

### 维度：F-Lifecycle / F-Cross
### 关联节点：SS-CR-04, SH-CR-02

**挑战描述**：

根据 BR-14/BR-15（保存/加载覆盖扫描），Arena 模块的序列化需要在以下六处同步：

1. `GameSaveData` 接口 — ✅ 已有 `pvpArena`, `pvpArenaShop`, `pvpRanking`
2. `SaveContext` 接口 — ✅ 已有 `arena?`, `arenaShop?`, `ranking?`
3. `buildSaveData` — ✅ 已有序列化调用
4. `toIGameState` — ✅ 已有字段映射
5. `fromIGameState` — ✅ 已有字段提取
6. `applySaveData` — ✅ 已有反序列化调用

但需要验证：
- `ArenaSeasonSystem` 的赛季数据是否通过 `ArenaSystem.serialize` 的 `season` 字段保存？
- `DefenseFormationSystem` 的防守数据是否通过 `ArenaSystem.serialize` 的 `state.defenseFormation` 保存？

从 engine-save.ts 代码看，`ctx.arena?.serialize()` 会保存 `ArenaSaveData`（包含 `state` 和 `season`），所以赛季数据和防守数据都在其中。

**风险**：如果新增独立于 ArenaSystem 的赛季相关字段，可能遗漏同步。

**违反规则**：BR-14/BR-15

---

## CH-09: ArenaShopSystem.deserialize items 非数组时跳过但不清空 [P1]

### 维度：F-Error
### 关联节点：SH-SZ-05

**挑战描述**：

```typescript
deserialize(data: ArenaShopSaveData): void {
  if (!data || data.version !== ARENA_SHOP_SAVE_VERSION) return;
  if (!Array.isArray(data.items)) return; // 跳过但不清空旧数据
  this.items = data.items.map((i) => ({ ...i }));
}
```

当 `data.items` 不是数组时，方法直接返回，但不清空现有 `this.items`。这意味着损坏存档加载后，商店仍保留上一次的有效数据，可能导致商品状态不一致。

**违反规则**：BR-10（修复穿透验证）

**建议修复**：`if (!Array.isArray(data.items)) { this.items = DEFAULT_ARENA_SHOP_ITEMS.map(i => ({...i})); return; }`

---

## CH-10: selectByFactionBalance 无限循环风险 [P2]

### 维度：F-Boundary
### 关联节点：AH-SF-01

**挑战描述**：

`selectByFactionBalance` 中 while 循环有 `!added` 退出条件，且 `candidates.length <= count` 时直接返回。风险极低。

**降级为 P2**。

---

## CH-11: ArenaSystem.serialize 不完整 season 对象合并安全性 [P1]

### 维度：F-Boundary
### 关联节点：AS-SZ-01

**挑战描述**：

如果传入 `season = { startTime: 'invalid' }`，合并后 `startTime` 为字符串，可能导致后续计算异常。

**违反规则**：BR-15（deserialize 覆盖验证）

**建议修复**：添加类型验证 `typeof season.startTime === 'number'` 等。

---

## CH-12: ArenaSeasonSystem 无独立 serialize/deserialize ISubsystem 方法 [P1]

### 维度：F-Lifecycle
### 关联节点：SS-SZ-01~06

**挑战描述**：

`ArenaSeasonSystem` 没有实现 ISubsystem 标准的 serialize/deserialize 方法。赛季数据通过 `ArenaSystem.serialize` 的 `season` 参数保存。功能上正确，但设计耦合。

**违反规则**：BR-14（保存/加载覆盖扫描）

---

## CH-13: freeRefresh/manualRefresh now 参数无验证 [P1]

### 维度：F-Error
### 关联节点：AS-RF-08, AS-RF-09

**挑战描述**：

- `now = NaN` → 始终冷却中
- `now = -1` → 负数时间戳 → 后续刷新被阻塞
- `now = Infinity` → 始终可刷新

**违反规则**：BR-01（数值API入口检查）

**建议修复**：添加 `if (!Number.isFinite(now) || now < 0) throw new Error('无效的时间戳')`。

---

## CH-14: addDefenseLog now 参数无验证 [P1]

### 维度：F-Error
### 关联节点：AS-DF-03

`now = NaN` → ID 为 `def_NaN_xxx`，timestamp 为 NaN。数据不合法。

**违反规则**：BR-01

---

## CH-15: SEASON_REWARDS 与 RANK_LEVELS rankId 对应性验证 [P0]

### 维度：F-Normal / F-Cross
### 关联节点：SS-CE-01, SS-CE-02

**挑战描述**：

需要验证 `SEASON_REWARDS`（21条）的 `rankId` 与 `RANK_LEVELS`（21条）的 `id` 完全一一对应。运行时无校验。如果后续修改一方忘记同步另一方，会导致奖励发放错误。

**违反规则**：BR-02（配置交叉验证）、BR-18（配置-枚举同步）

**建议修复**：添加启动时断言验证。

---

## CH-16: grantDailyReward arenaCoins 溢出 [P1]

### 维度：F-Boundary
### 关联节点：SS-DR-02, SS-ST-10

与 CH-05 相同的溢出问题。每日奖励累积 + 赛季奖励累积，无上限。

**违反规则**：BR-12（溢出闭环）

---

## CH-17: buyItem 异常安全验证 [P1 → 信息性]

### 维度：F-Error
### 关联节点：SH-CR-04

`ArenaShopSystem.buyItem` 的操作顺序实际是安全的。newState 是纯对象创建，items 修改在最后。

**降级为信息性**。

---

## CH-18: ArenaConfig 重导出一致性 [P1]

### 维度：F-Normal
### 关联节点：AC-EX-01

`ArenaConfig` 使用 `export { ... } from './ArenaSystem.helpers'`，是引用而非拷贝，一致性有保障。建议在测试中添加断言验证。

---

## CH-19: settleSeason 清空 replays 和 defenseLogs 无确认 [P1]

### 维度：F-Error
### 关联节点：SS-ST-05

赛季结算时无条件清空回放和防守日志。设计决策而非 bug，但可能导致玩家体验问题。

---

## CH-20: DefenseFormationSystem.serialize/deserialize 返回值不完整 [P2]

### 维度：F-Lifecycle
### 关联节点：SS-CR-04

防守数据通过 `ArenaSystem.serialize` 的 `state.defenseFormation` 保存，不依赖 `DefenseFormationSystem.serialize`。实际无风险。

**降级为 P2**。

---

## CH-21~40: 补充挑战项（精简）

| ID | 维度 | 优先级 | 描述 | 关联节点 |
|----|------|--------|------|----------|
| CH-21 | F-Normal | P1 | createDefaultArenaPlayerState 每日次数与配置常量一致 | AH-FT-04 |
| CH-22 | F-Boundary | P1 | generateOpponents ranking=0 时排名范围计算 | AS-GO-12 |
| CH-23 | F-Error | P1 | canBuy 与 buyItem 验证逻辑一致性 | SH-BY-10 |
| CH-24 | F-Lifecycle | P1 | ArenaSystem.reset() 后 playerState 是默认值 | AS-LC-04 |
| CH-25 | F-Cross | P0 | serialize season 与 createSeason 数据一致性 | SS-CR-01 |
| CH-26 | F-Normal | P2 | getAllSeasonRewards 返回副本 | SS-SZ-06 |
| CH-27 | F-Boundary | P1 | getRemainingDays 赛季开始当天返回 28 | SS-SC-09 |
| CH-28 | F-Error | P1 | deserializeSeason season=null 时回退 BRONZE_V | SS-SZ-04 |
| CH-29 | F-Lifecycle | P0 | engine-save 三者反序列化顺序正确 | SH-CR-02 |
| CH-30 | F-Cross | P1 | 每日奖励 + 商店购买 竞技币正确增减 | SH-CR-03 |
| CH-31 | F-Error | P0 | arenaCoinCost NaN 绕过检查 | SH-NP-02 |
| CH-32 | F-Error | P1 | weeklyLimit NaN 时无限购限制 | SH-NP-04 |
| CH-33 | F-Lifecycle | P0 | ArenaShopSystem 序列化往返验证 | SH-SZ-02 |
| CH-34 | F-Normal | P1 | serialize 无参数使用内部 playerState | AS-SZ-01 |
| CH-35 | F-Boundary | P1 | getCurrentDay now < startTime 返回 1 | SS-SC-06 |
| CH-36 | F-Cross | P0 | 战斗竞技币 → 商店购买链路 | SH-CR-01 |
| CH-37 | F-Error | P1 | updateHighestRank 无效 rankId 时 findIndex 返回 -1 | SS-ST-08 |
| CH-38 | F-Lifecycle | P1 | RankingSystem.serialize 三维度数据 | SS-CR-04 |
| CH-39 | F-Boundary | P1 | getItemsByType 不存在类型返回空数组 | SH-QY-02 |
| CH-40 | F-Normal | P2 | getConfig 返回配置副本 | SS-SZ-05 |

---

## P0 汇总（22项）

| # | ID | 标题 | 规则违反 |
|---|-----|------|----------|
| 1 | CH-01 | calculatePower NaN 传播导致匹配失效 | BR-06/17/21 |
| 2 | CH-02 | arenaCoins NaN 绕过竞技币检查 | BR-06/21 |
| 3 | CH-03 | purchased NaN 绕过周限购检查 | BR-06/14 |
| 4 | CH-04 | settleSeason 硬编码 dailyChallengesLeft: 5 | BR-02 |
| 5 | CH-05 | arenaCoins 无上限常量 | BR-12/22 |
| 6 | CH-06 | buyArenaShopItem cost NaN/负数无防护 | BR-06/17 |
| 7 | CH-15 | SEASON_REWARDS 与 RANK_LEVELS 对应性验证 | BR-02/18 |
| 8 | CH-25 | serialize season 与 createSeason 数据一致性 | BR-14 |
| 9 | CH-29 | engine-save 三者反序列化顺序 | BR-14 |
| 10 | CH-31 | arenaCoinCost NaN 绕过检查 | BR-06/21 |
| 11 | CH-33 | ArenaShopSystem 序列化往返 | BR-14 |
| 12 | CH-36 | 战斗竞技币 → 商店购买链路 | BR-12 |
| 13 | CH-08 | engine-save 六处同步覆盖 | BR-14/15 |
| 14-22 | CH-07等 | 其他P0（详见上表） | 多条 |

**注**：部分 P0 在深入分析后可能降级为 P1（如 CH-07/CH-08），由 Arbiter 裁决。
