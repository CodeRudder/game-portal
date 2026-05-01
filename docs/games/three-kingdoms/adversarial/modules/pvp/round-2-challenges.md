# PvP模块 R2 挑战报告 — TreeChallenger

> 审查时间：2025-06-20
> 审查范围：R1修复穿透验证 + R2精简树(180节点)遗漏发现
> 五维度审查：F-Normal / F-Boundary / F-Error / F-Cross / F-Lifecycle

## 审查摘要

| 维度 | 挑战项数 | P0 | P1 | P2 |
|------|----------|-----|-----|-----|
| F-Normal | 3 | 0 | 2 | 1 |
| F-Boundary | 4 | 1 | 2 | 1 |
| F-Error | 3 | 1 | 1 | 1 |
| F-Cross | 3 | 1 | 1 | 1 |
| F-Lifecycle | 2 | 0 | 1 | 1 |
| **合计** | **15** | **3** | **7** | **5** |

---

## R1修复穿透验证

### ✅ Fix-01: ArenaConfig重导出 — 穿透完整
ArenaConfig.ts 已改为从 ArenaSystem.helpers.ts 重导出，无重复定义。ArenaSystem.ts 的 import 路径不变。

### ✅ Fix-05: canChallenge死代码 — 穿透完整
`totalChallenges` 已删除，直接返回 `dailyChallengesLeft > 0`。

### ✅ Fix-06: ArenaSystem.addDefenseLog Date.now() — 穿透完整
ID 生成改为 `def_${now}_...`，timestamp 使用参数 `now`。

### ✅ Fix-07: PvPBattleSystem.executeBattle Date.now() — 穿透完整
新增 `now` 参数（默认 `Date.now()`），battleId 使用 `pvp_${now}_...`。

### ✅ Fix-08: DefenseFormationSystem.addDefenseLog Date.now() — 穿透完整
新增 `now` 参数（默认 `Date.now()`），ID 使用 `def_${now}_...`。

### ✅ Fix-10: buyItem isInteger验证 — 穿透完整
`buyItem` 和 `canBuy` 都添加了 `Number.isInteger(count)` 检查。

### ✅ Fix-12: RankingSystem.deserialize验证 — 穿透完整
`validateRankingData` 验证 entries 为数组和 lastUpdateTime 为数字。

### ✅ Fix-13: serialize赛季数据和highestRankId — 穿透完整
新增 `season` 和 `highestRankId` 可选参数，有合理默认值。

### ✅ Fix-ref: generateOpponents playerId比较 — 穿透完整
使用 `Set<playerId>` 代替引用比较。

---

## R2 新发现

### P0-R2-01: DefenseFormationSystem.addDefenseLog 签名与 ArenaSystem.addDefenseLog 不一致

**文件**: `DefenseFormationSystem.ts:233` vs `ArenaSystem.ts:293`
**维度**: F-Cross

**描述**:
R1 修复后两个系统的 `addDefenseLog` 方法签名不一致：

```typescript
// ArenaSystem.addDefenseLog — 接收 playerState + log，返回新 playerState
addDefenseLog(playerState, log, now): ArenaPlayerState

// DefenseFormationSystem.addDefenseLog — 接收 logs 数组 + entry，返回新数组
addDefenseLog(logs: DefenseLogEntry[], entry: Omit<DefenseLogEntry, 'id'>, now): DefenseLogEntry[]
```

- ArenaSystem 版本：操作 `ArenaPlayerState`，日志嵌入 state
- DefenseFormationSystem 版本：操作纯 `DefenseLogEntry[]`，无 state

两者 ID 生成格式相同（`def_${now}_...`），但调用方式和返回类型完全不同。调用方需要知道使用哪个版本。

**影响**: API不一致增加使用错误风险。如果上层代码同时持有两个系统实例，可能调用错误版本。

**严重性**: P0 — API不一致可能导致运行时错误（传错参数类型）

---

### P0-R2-02: ArenaSystem.serialize 的 season 参数类型与内部 SeasonData 不匹配风险

**文件**: `ArenaSystem.ts:376`
**维度**: F-Boundary

**描述**:
```typescript
serialize(
  playerState?: ArenaPlayerState,
  season?: import('../../core/pvp/pvp.types').SeasonData,
  highestRankId?: string,
): ArenaSaveData {
  // ...
  season: season ?? {
    seasonId: '',
    startTime: 0,
    endTime: 0,
    currentDay: 1,
    isSettled: false,
  },
```

`season` 参数使用动态 `import()` 类型，如果调用方传入的对象缺少 `SeasonData` 的某些字段（如 `currentDay`），序列化结果将包含 `undefined` 值。deserialize 时不会验证这些字段。

**实际验证**: 查看 `SeasonData` 类型定义，`currentDay` 是必需字段。如果传入 `{ seasonId: 's1', startTime: 1000, endTime: 1000 }`（缺少 `currentDay` 和 `isSettled`），TypeScript 编译时可能不报错（如果使用 any 中转），但序列化结果中 `currentDay` 为 `undefined`。

**影响**: 序列化数据不完整，反序列化后状态异常。

**严重性**: P0 — 数据完整性风险

---

### P0-R2-03: buyItem 内部状态修改在异常路径下不一致

**文件**: `ArenaShopSystem.ts:127-155`
**维度**: F-Lifecycle

**描述**:
R1 Fix-17 标记为"API设计"，但实际仍有问题：

```typescript
buyItem(playerState, itemId, count) {
  // ...验证通过...
  this.items[itemIdx] = { ...item, purchased: item.purchased + count }; // ← 先修改内部状态
  const newState = { ...playerState, arenaCoins: playerState.arenaCoins - totalCost };
  return { state: newState, item: { ...this.items[itemIdx] } };
}
```

如果 `newState` 构造过程中发生异常（理论上不会，但运行时可能），`this.items` 已被修改但 playerState 未更新。

更重要的是：**如果调用方忽略返回的 state**（只取 item），竞技币不会扣减但 purchased 已增加。这不是"API设计"问题，而是**状态一致性漏洞**。

```typescript
// 漏洞利用场景
const { item } = shop.buyItem(state, 'fragment_liubei', 1);
// state.arenaCoins 未变，但 shop.items 中 purchased 已+1
// 下次 canBuy 检查限购时 purchased 已增加，但玩家实际未扣币
```

**影响**: 可被利用无限购买限购商品（竞技币不扣但购买计数增加，达到限购上限后停止，但实际未花费竞技币）。

**严重性**: P0 — 状态一致性漏洞（可被利用）

---

### P1-R2-01: settleSeason 积分重置到当前段位最低值 — 设计确认

**文件**: `ArenaSeasonSystem.ts:178`
**维度**: F-Normal

**描述**:
R1 已添加注释说明 `scoreResetRatio` 为预留参数。但核心问题未解决：

```typescript
const currentRank = RANK_LEVEL_MAP.get(playerState.rankId);
const resetScore = currentRank?.minScore ?? 0;
```

如果 `playerState.rankId` 无效（不在 RANK_LEVEL_MAP 中），`resetScore` 将为 0，玩家从 BRONZE_V 最低值(0)开始，这恰好是正确的默认行为。但 `currentRank` 为 `undefined` 时没有任何警告。

**影响**: 无效段位ID静默重置到0，可能隐藏上游数据错误。

---

### P1-R2-02: executeBattle now参数默认值仍为 Date.now()

**文件**: `PvPBattleSystem.ts:235`
**维度**: F-Boundary

**描述**:
```typescript
executeBattle(attackerState, defenderState, mode, now: number = Date.now())
```

默认值 `Date.now()` 意味着不传 `now` 时行为与修复前相同。测试中必须显式传入 `now` 才能可控。这是正确的向后兼容设计，但需要确保所有调用方在测试中都传入了 `now`。

**影响**: 测试中遗漏传 `now` 将导致不可控的 battleId。

---

### P1-R2-03: generateOpponents 中 Math.random() 仍不可控

**文件**: `ArenaSystem.ts:150`
**维度**: F-Boundary

**描述**:
R1 修复了 playerId 比较问题，但补充选择仍使用 `Math.random()`：
```typescript
const idx = Math.floor(Math.random() * remaining.length);
```

PvPBattleSystem 的战斗结果也使用 `Math.random()`（胜率判定）。这些随机源不可注入，测试中不可控。

**影响**: 匹配和战斗结果测试不可完全复现。

---

### P1-R2-04: RankingSystem.deserialize 验证不够严格

**文件**: `RankingSystem.ts:257`
**维度**: F-Error

**描述**:
`validateRankingData` 只验证 `entries` 是数组和 `lastUpdateTime` 是数字，但不验证：
- `entries` 中每个元素的 `playerId`/`score`/`rank` 字段
- `lastUpdateTime` 是否为非负数
- `entries.length` 是否超过 `maxDisplayCount`

损坏的 entry（如 `{ playerId: undefined, score: NaN }`）将通过验证。

**影响**: 部分损坏数据可能通过验证但导致排行榜显示异常。

---

### P1-R2-05: ArenaConfig 重导出可能引入循环依赖

**文件**: `ArenaConfig.ts`
**维度**: F-Cross

**描述**:
```typescript
// ArenaConfig.ts
export { ... } from './ArenaSystem.helpers';
// ArenaSystem.ts
import { ... } from './ArenaConfig';
// ArenaSystem.helpers.ts — 不依赖 ArenaConfig
```

当前依赖链：ArenaConfig → ArenaSystem.helpers（单向），ArenaSystem → ArenaConfig。无循环依赖。但如果未来 ArenaSystem.helpers 需要从 ArenaConfig 导入任何内容，将产生循环。

**影响**: 当前无问题，但架构脆弱。

---

### P1-R2-06: serialize 新增参数缺少调用方文档

**文件**: `ArenaSystem.ts:376`
**维度**: F-Normal

**描述**:
`serialize` 新增了 `season` 和 `highestRankId` 参数，但没有文档说明调用方应如何获取这些数据。`season` 来自 `ArenaSeasonSystem`，`highestRankId` 需要在战斗过程中通过 `updateHighestRank` 维护。调用方（存档系统）需要知道这些数据来源。

**影响**: 集成时可能遗漏传参，导致存档数据不完整。

---

### P1-R2-07: DefenseFormationSystem.addDefenseLog 的 now 默认值与签名风格不一致

**文件**: `DefenseFormationSystem.ts:233`
**维度**: F-Normal

**描述**:
```typescript
addDefenseLog(logs, entry, now: number = Date.now()): DefenseLogEntry[]
```

此方法是无状态纯函数（接收 logs 数组，返回新数组），但 `now` 默认值是 `Date.now()`，引入了隐式副作用。纯函数不应依赖外部状态。

**影响**: 降低了函数的可测试性和纯度。

---

## P2 发现

### P2-R2-01: scoreResetRatio 和 rankMinOffset 预留参数无 TODO 标记
预留参数只有注释说明，缺少 TODO 或 FEATURE_FLAG 标记，未来可能被误删。

### P2-R2-02: 多处 Math.random() 不可控（已知问题，R1 P1-09）
ArenaSystem.generateOpponents 和 PvPBattleSystem.executeBattle 中的随机源不可注入。

### P2-R2-03: DefenseFormationSystem 实现 ISubsystem 但无状态（已知问题，R1 P0-18 降级）
纯工具类实现不必要的接口。

### P2-R2-04: settleSeason 的 resetScore 计算对无效段位ID静默回退
`currentRank?.minScore ?? 0` 对无效ID静默返回0。

### P2-R2-05: ArenaShopSystem.serialize/deserialize 不验证 items 数组完整性
反序列化时直接赋值，不验证 items 结构。

---

## R2 挑战总结

| 级别 | 数量 | 关键问题 |
|------|------|----------|
| **P0** | 3 | addDefenseLog签名不一致、serialize类型安全、buyItem状态漏洞 |
| **P1** | 7 | settleSeason静默回退、Math.random不可控、deserialize验证不严等 |
| **P2** | 5 | 预留参数标记、随机源注入、接口冗余等 |

### 与R1对比

| 指标 | R1 | R2 | 变化 |
|------|-----|-----|------|
| P0数 | 11 | 3 | ↓73% |
| P1数 | 14 | 7 | ↓50% |
| P2数 | 5 | 5 | → |
| 总挑战 | 40 | 15 | ↓63% |

R1修复有效消除了大部分P0，R2新发现的3个P0主要集中在：
1. R1修复引入的API不一致（P0-R2-01）
2. 新增参数的类型安全（P0-R2-02）
3. R1未彻底修复的状态一致性问题（P0-R2-03）
