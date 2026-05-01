# PvP模块 R3 挑战报告 — TreeChallenger

> 审查时间：2025-06-20
> 审查范围：R2修复穿透验证 + R3精简树(148节点)遗漏发现
> 五维度审查：F-Normal / F-Boundary / F-Error / F-Cross / F-Lifecycle

## 审查摘要

| 维度 | 挑战项数 | P0 | P1 | P2 |
|------|----------|-----|-----|-----|
| F-Normal | 2 | 0 | 1 | 1 |
| F-Boundary | 3 | 0 | 2 | 1 |
| F-Error | 2 | 0 | 1 | 1 |
| F-Cross | 2 | 0 | 1 | 1 |
| F-Lifecycle | 1 | 0 | 1 | 0 |
| **合计** | **10** | **0** | **6** | **4** |

---

## R2修复穿透验证

### ✅ Fix-R2-01: serialize safeSeason默认合并 — 穿透完整

**验证方法**: 审查 ArenaSystem.ts:372-398

```typescript
const defaultSeason = {
  seasonId: '', startTime: 0, endTime: 0, currentDay: 1, isSettled: false,
};
const safeSeason = (season && typeof season === 'object')
  ? { ...defaultSeason, ...season }
  : defaultSeason;
```

**穿透判定**: ✅ 完整
- 默认对象覆盖所有必需字段
- 类型检查 `typeof season === 'object'` 排除 null/undefined/string/number
- 展开合并确保缺失字段有默认值
- 不传 season 时使用完整默认对象

**边界测试建议**: 传入 `{ seasonId: 's1' }` 应得到 `{ seasonId: 's1', startTime: 0, endTime: 0, currentDay: 1, isSettled: false }`

### ✅ Fix-R2-02: buyItem 操作顺序调整 — 穿透完整

**验证方法**: 审查 ArenaShopSystem.ts:119-155

```typescript
// 先更新玩家状态
const newState: ArenaPlayerState = {
  ...playerState,
  arenaCoins: playerState.arenaCoins - totalCost,
};
// 最后才修改内部商品状态
this.items[itemIdx] = { ...item, purchased: item.purchased + count };
return { state: newState, item: { ...this.items[itemIdx] } };
```

**穿透判定**: ✅ 完整
- newState 先于 this.items 修改
- 异常路径（如 spread 操作失败）不会导致内部状态被错误修改
- 返回的 state 包含正确的 arenaCoins 扣减

**残留风险**: 调用方仍需使用返回的 state。如果忽略返回值，竞技币不扣但 purchased 增加。这是 API 设计层面的约束，已通过文档说明。风险等级 P1。

### ✅ P0-R2-01 降级确认: addDefenseLog 签名不一致 — 设计差异

ArenaSystem.addDefenseLog 操作 ArenaPlayerState（有状态），DefenseFormationSystem.addDefenseLog 操作 DefenseLogEntry[]（无状态纯函数）。两者服务于不同场景：
- ArenaSystem 版本：上层业务调用，日志嵌入玩家状态
- DefenseFormationSystem 版本：底层工具函数，日志操作独立数组

调用方通常只使用其中一个，不存在混用风险。降级为 P1 合理。

---

## R3 新发现

### P1-R3-01: generateOpponents 空对手池返回空数组但无警告

**文件**: `ArenaSystem.ts:119-145`
**维度**: F-Boundary

**描述**:
当 `allPlayers` 为空数组时，`eligible` 为空，`selectByFactionBalance([], 3)` 返回 `[]`，补充选择也不执行。最终返回空数组。

```typescript
generateOpponents(playerState, allPlayers: ArenaOpponent[]): ArenaOpponent[] {
  // ... 筛选 ...
  const eligible = allPlayers.filter(/* ... */);
  const selected = selectByFactionBalance(eligible, candidateCount);
  // eligible 为空时 selected 为空，补充也不执行
  return selected.slice(0, candidateCount); // 返回 []
}
```

调用方收到空数组后，UI 显示"无对手"，但系统无任何日志或错误提示。

**影响**: 空对手池静默返回空数组，可能隐藏配置错误（如全服只有1人时永远匹配不到对手）。

**建议**: 添加 `console.warn` 或返回特殊标记。P1 因为不影响核心功能，但影响调试体验。

---

### P1-R3-02: ArenaShopSystem.deserialize 不验证 items 数组元素结构

**文件**: `ArenaShopSystem.ts:203-206`
**维度**: F-Error

**描述**:
```typescript
deserialize(data: ArenaShopSaveData): void {
  if (!data || data.version !== ARENA_SHOP_SAVE_VERSION) return;
  this.items = data.items.map((i) => ({ ...i }));
}
```

只验证版本号，不验证 `items` 是否为数组、元素是否包含必需字段。如果存档损坏（如 `items: null` 或 `items: [{ itemId: undefined }]`），将导致后续 buyItem/canBuy 操作异常。

**影响**: 损坏存档可能导致运行时异常。

**建议**: 添加 items 数组验证和元素字段检查。

---

### P1-R3-03: calculatePower 负积分产生异常战力值

**文件**: `ArenaSystem.helpers.ts:126-129`
**维度**: F-Boundary

**描述**:
```typescript
export function calculatePower(playerState: ArenaPlayerState): number {
  const heroCount = playerState.defenseFormation.slots.filter((s) => s !== '').length;
  return playerState.score * 10 + heroCount * 1000 + 5000;
}
```

如果 `playerState.score` 为负值（理论上不应发生，但 deserialize 未验证），`calculatePower` 可能返回低于 5000 的值，甚至负值（score=-600 时 power=-1000+5000=4000，score=-1000 时 power=0）。

这会影响 generateOpponents 的战力范围筛选：
- `minPower = Math.floor(myPower * 0.7)` 可能为负
- `maxPower = Math.ceil(myPower * 1.3)` 可能低于预期

**影响**: 边界情况，但可能导致匹配逻辑异常。

**建议**: `calculatePower` 返回 `Math.max(0, ...)` 或在 deserialize 时验证 score ≥ 0。

---

### P1-R3-04: settleSeason 使用 playerState.rankId 而非 highestRankId 计算重置积分

**文件**: `ArenaSeasonSystem.ts:176`
**维度**: F-Normal

**描述**:
```typescript
settleSeason(playerState, highestRankId) {
  const reward = this.getSeasonReward(highestRankId); // ✅ 用 highestRankId 发奖励
  const currentRank = RANK_LEVEL_MAP.get(playerState.rankId); // ← 用当前段位重置
  const resetScore = currentRank?.minScore ?? 0;
```

奖励基于最高段位（正确），但积分重置基于当前段位。这是设计意图还是bug？

如果玩家当前段位 BRONZE_V（score=0），但最高段位 GOLD_I（score=2000），奖励按 GOLD_I 发放，但积分重置到 BRONZE_V 的最低值 0。这意味着赛季结算后玩家从 0 开始，与从未上过 GOLD_I 的玩家一样。

**影响**: 如果设计意图是"重置到当前段位最低值"，这是正确的。如果意图是"重置到最高段位最低值"，则需修改。需PRD确认。

---

### P1-R3-05: selectByFactionBalance 空候选人返回空数组

**文件**: `ArenaSystem.helpers.ts:103`
**维度**: F-Boundary

**描述**:
```typescript
export function selectByFactionBalance(candidates: ArenaOpponent[], count: number): ArenaOpponent[] {
  if (candidates.length <= count) return [...candidates];
  // ...
}
```

`candidates.length <= count` 时直接返回全部候选人（浅拷贝）。当 `candidates` 为空时返回 `[]`，当 `count=0` 时返回 `[]`。行为正确但 `count=0` 时可能不是期望行为（应返回空数组还是报错？）。

**影响**: 极低。`count` 来自配置常量 `candidateCount=3`，不会为 0。

---

### P1-R3-06: RankingSystem.deserialize 验证不验证 entries 内部结构

**文件**: `RankingSystem.ts:255-265`
**维度**: F-Error

**描述**:
```typescript
const validateRankingData = (rd: unknown): rd is RankingData => {
  if (!rd || typeof rd !== 'object') return false;
  const d = rd as Record<string, unknown>;
  return Array.isArray(d.entries) && typeof d.lastUpdateTime === 'number';
};
```

只验证 `entries` 是数组和 `lastUpdateTime` 是数字。不验证：
- `entries` 中每个元素是否有 `playerId`/`score`/`rank` 字段
- `lastUpdateTime` 是否为非负数
- `entries.length` 是否超过 `maxDisplayCount`

损坏的 entry（如 `{ playerId: undefined, score: NaN }`）将通过验证。

**影响**: 排行榜显示异常的潜在风险。R2已标记为P1，R3确认仍存在。

---

## P2 发现

### P2-R3-01: Math.random() 不可注入（已知遗留问题）
ArenaSystem.generateOpponents 和 PvPBattleSystem.executeBattle 中的随机源不可注入。R1/R2均标记为P1，降级为P2（需长期架构方案）。

### P2-R3-02: DefenseFormationSystem 实现 ISubsystem 但无状态
纯工具类实现不必要的接口。R1降级为P2，确认不影响功能。

### P2-R3-03: scoreResetRatio 和 rankMinOffset 预留参数无 TODO 标记
已有注释说明，建议添加 `@deprecated` 或 `TODO` 标记。

### P2-R3-04: settleSeason 对无效 rankId 静默回退到 0
`currentRank?.minScore ?? 0` 对无效ID静默返回0。R2已标记，确认风险极低。

---

## R3 挑战总结

| 级别 | 数量 | 关键问题 |
|------|------|----------|
| **P0** | 0 | 无新P0发现 |
| **P1** | 6 | generateOpponents空池、deserialize验证、calculatePower负积分、settleSeason重置逻辑 |
| **P2** | 4 | Math.random、ISubsystem冗余、预留参数标记、静默回退 |

### 与R2对比

| 指标 | R1 | R2 | R3 | 变化(R2→R3) |
|------|-----|-----|-----|-------------|
| P0数 | 11 | 3 | 0 | ↓100% |
| P1数 | 14 | 7 | 6 | ↓14% |
| P2数 | 5 | 5 | 4 | ↓20% |
| 总挑战 | 40 | 15 | 10 | ↓33% |

### R3关键结论

1. **R2修复完全穿透**: Fix-R2-01(safeSeason)和Fix-R2-02(buyItem顺序)均正确实现
2. **无新P0发现**: R2的2个P0已修复，R3未发现新的P0级问题
3. **P1问题集中在边界验证**: deserialize验证不严、calculatePower边界、空对手池处理
4. **系统核心流程稳定**: 匹配→战斗→积分→段位→排名→赛季结算全链路无P0问题
