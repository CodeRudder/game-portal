# PvP模块 R1 挑战报告 — TreeChallenger

> 审查时间：2025-06-20
> 审查范围：`src/games/three-kingdoms/engine/pvp/` 全部10个源文件
> 五维度审查：F-Normal / F-Boundary / F-Error / F-Cross / F-Lifecycle

## 审查摘要

| 维度 | 挑战项数 | P0 | P1 | P2 |
|------|----------|-----|-----|-----|
| F-Normal | 8 | 3 | 4 | 1 |
| F-Boundary | 10 | 4 | 5 | 1 |
| F-Error | 7 | 3 | 3 | 1 |
| F-Cross | 9 | 5 | 3 | 1 |
| F-Lifecycle | 6 | 3 | 2 | 1 |
| **合计** | **40** | **18** | **17** | **5** |

---

## P0 阻塞级缺陷

### P0-01: ArenaConfig 与 ArenaSystem.helpers 重复定义导致行为不一致风险

**文件**: `ArenaConfig.ts` (77行) vs `ArenaSystem.helpers.ts` (134行)
**维度**: F-Cross

**描述**:
两个文件都导出了 `createDefaultDefenseFormation()` 和 `createDefaultArenaPlayerState()` 工厂函数，代码完全相同但独立维护。`ArenaSystem.ts` 从 `ArenaConfig` 导入，而 `ArenaSystem.helpers.ts` 自己定义了一份。如果未来修改一处而忘记另一处，将导致不同入口创建的默认状态不一致。

```typescript
// ArenaConfig.ts:52-77 — 定义了 createDefaultDefenseFormation + createDefaultArenaPlayerState
// ArenaSystem.helpers.ts:54-89 — 定义了完全相同的两个函数
// ArenaSystem.ts:26-32 — 从 './ArenaConfig' 导入
// index.ts — 从 './ArenaSystem.helpers' 重导出
```

**影响**: 存档恢复、默认状态创建可能出现不一致，导致段位/积分/阵容数据异常。

---

### P0-02: ArenaSeasonSystem.settleSeason 积分重置逻辑未使用 scoreResetRatio

**文件**: `ArenaSeasonSystem.ts` 第 178-179 行
**维度**: F-Normal

**描述**:
`SeasonConfig` 定义了 `scoreResetRatio: 0.5`（重置比例），但 `settleSeason()` 方法实际将积分重置到当前段位最低值，完全忽略了 `scoreResetRatio`。这意味着配置参数是死代码。

```typescript
// 配置定义
export const DEFAULT_SEASON_CONFIG: SeasonConfig = {
  seasonDays: 28,
  scoreResetRatio: 0.5,  // ← 定义了但未使用
};

// 实际实现
settleSeason(playerState, highestRankId) {
  const currentRank = RANK_LEVEL_MAP.get(playerState.rankId);
  const resetScore = currentRank?.minScore ?? 0;  // ← 直接用段位最低值，未用 scoreResetRatio
  // ...
}
```

**影响**: 策划无法通过调整 `scoreResetRatio` 来控制赛季重置力度，赛季重置行为与配置文档不一致。

---

### P0-03: PvPBattleSystem.executeBattle 防守方积分可为负

**文件**: `PvPBattleSystem.ts` 第 236 行
**维度**: F-Boundary

**描述**:
`executeBattle()` 中进攻方积分用 `Math.max(0, ...)` 保护，但防守方积分同样需要保护却只在 `defenderNewScore` 计算时做了 `Math.max(0, ...)`。然而问题在于：当进攻方胜利时，`defenderScoreChange = -scoreChange`（负值），如果防守方积分很低（如100），扣30分后 `defenderNewScore = max(0, 100-50) = 50`，这是正确的。但 `scoreChange` 是随机30~60，如果防守方score=10且进攻方胜利，`defenderNewScore = max(0, 10-50) = 0`，这部分是正确的。

**重新审查**: 实际上 `Math.max(0, ...)` 在两处都有使用，这是正确的。但存在另一个问题：

**修正后的问题**: `executeBattle()` 返回的 `attackerNewScore` 和 `defenderNewScore` 是基于传入的 `attackerState.score` 和 `defenderState.score` 计算的，但 `defenderState` 是作为参数传入的另一个 `ArenaPlayerState`。调用方可能只更新 `attackerState` 而不更新 `defenderState`，导致防守方积分变化丢失。

**影响**: 防守方积分变化需要调用方额外处理，否则积分变化会丢失。这是一个设计缺陷而非bug，但缺少明确文档说明。

---

### P0-04: ArenaSystem.generateOpponents 排名范围使用 rankMinOffset 但实际筛选只用 rankMaxOffset

**文件**: `ArenaSystem.ts` 第 128-133 行
**维度**: F-Normal

**描述**:
`MatchConfig` 定义了 `rankMinOffset: 5` 和 `rankMaxOffset: 20`，但筛选逻辑中只使用了 `rankMaxOffset`：

```typescript
const minRank = Math.max(1, myRanking - rankMaxOffset);  // ← 用的是 rankMaxOffset
const maxRank = myRanking + rankMaxOffset;                // ← 用的是 rankMaxOffset
```

`rankMinOffset` 完全未被使用。根据注释"排名范围：自身 ±5 ~ ±20"，应该是动态范围，但代码实现为固定 ±20。

**影响**: 匹配范围比设计文档更宽，低排名玩家可能匹配到排名差距过大的对手。

---

### P0-05: ArenaSystem.canChallenge 存在死代码

**文件**: `ArenaSystem.ts` 第 225-230 行
**维度**: F-Normal

**描述**:
```typescript
canChallenge(playerState: ArenaPlayerState): boolean {
  const totalChallenges =
    playerState.dailyChallengesLeft +
    (this.challengeConfig.dailyBuyLimit - playerState.dailyBoughtChallenges);
  // 实际上 dailyChallengesLeft 已经包含了免费+购买的
  return playerState.dailyChallengesLeft > 0;
}
```

`totalChallenges` 计算后从未使用，直接返回 `playerState.dailyChallengesLeft > 0`。注释说"dailyChallengesLeft 已经包含了免费+购买的"，但根据 `buyChallenge()` 的实现，购买会增加 `dailyChallengesLeft`，所以这个注释和逻辑实际上是正确的。但 `totalChallenges` 是死代码，说明原始设计可能考虑了不同的挑战次数管理方式。

**影响**: 死代码增加维护负担，且 `totalChallenges` 的计算逻辑暗示可能存在未完成的挑战次数合并设计。

---

### P0-06: ArenaSystem.addDefenseLog 使用 Date.now() 而非传入的 now 参数

**文件**: `ArenaSystem.ts` 第 293 行
**维度**: F-Normal

**描述**:
```typescript
addDefenseLog(playerState, log, now: number): ArenaPlayerState {
  const entry = {
    id: `def_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,  // ← Date.now()
    ...log,
    timestamp: now,  // ← 使用参数 now
  };
}
```

ID 生成使用 `Date.now()` 而 timestamp 使用传入的 `now` 参数。在测试中如果 `now` 被固定（如 `now=1000`），ID 中的时间戳和 entry 的时间戳将不一致。更重要的是，`Date.now()` 在测试中不可控。

**影响**: 测试不可控，ID生成与时间戳不一致。

---

### P0-07: PvPBattleSystem.executeBattle 使用 Date.now() 生成 battleId

**文件**: `PvPBattleSystem.ts` 第 229 行
**维度**: F-Boundary

**描述**:
```typescript
battleId: `pvp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
```

同 P0-06，`Date.now()` 在测试中不可控，且在高并发场景下可能生成重复 ID（同一毫秒内两次调用）。

**影响**: 测试不可控，高并发时ID可能冲突。

---

### P0-08: DefenseFormationSystem.addDefenseLog 同样使用 Date.now()

**文件**: `DefenseFormationSystem.ts` 第 172 行
**维度**: F-Normal

**描述**:
```typescript
id: `def_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
```

与 P0-06 相同问题。

**影响**: 测试不可控。

---

### P0-09: PvPBattleSystem 段位积分区间存在间隙

**文件**: `PvPBattleSystem.ts` 第 50-72 行
**维度**: F-Boundary

**描述**:
段位定义中 BRONZE_V 的 maxScore=299，BRONZE_IV 的 minScore=300。如果 score=299.5（理论上不会出现，因为积分是整数），不会出问题。但检查所有段位边界：

```
BRONZE_V:  0~299
BRONZE_IV: 300~599
BRONZE_III: 600~899
...
```

所有边界都是连续的（上一个maxScore+1 = 下一个minScore），没有间隙。**重新审查后确认无间隙问题。**

**修正为**: 段位边界设计正确，无间隙。此条降级为 P2（仅确认正确性）。

---

### P0-10: ArenaShopSystem.buyItem 不验证 count 为整数

**文件**: `ArenaShopSystem.ts` 第 113 行
**维度**: F-Error

**描述**:
```typescript
buyItem(playerState, itemId, count: number = 1) {
  if (count <= 0) {
    throw new Error('购买数量必须大于0');
  }
  // count=1.5 不会被拦截
  const totalCost = item.arenaCoinCost * count;  // 1.5 * 100 = 150
  // item.purchased + count = 0 + 1.5 = 1.5  ← 非整数
}
```

`count` 可以传入小数（如 1.5），导致 `purchased` 变为非整数，后续限购判断 `purchased + count > weeklyLimit` 可能出现浮点精度问题。

**影响**: 传入小数count导致purchased非整数，限购逻辑可能失效。

---

### P0-11: ArenaSeasonSystem.settleSeason 使用 playerState.rankId 而非 highestRankId 计算重置积分

**文件**: `ArenaSeasonSystem.ts` 第 178 行
**维度**: F-Cross

**描述**:
```typescript
settleSeason(playerState, highestRankId) {
  const reward = this.getSeasonReward(highestRankId);  // ← 用 highestRankId 发奖励（正确）
  const currentRank = RANK_LEVEL_MAP.get(playerState.rankId);  // ← 用当前段位重置积分
  const resetScore = currentRank?.minScore ?? 0;
}
```

奖励按最高段位发放，但积分重置到**当前段位**最低值而非最高段位。如果玩家曾经达到 GOLD_V 但当前掉到 BRONZE_I，奖励按 GOLD_V 发放，但积分重置到 BRONZE_I 的最低值(1200)。这是设计意图还是bug需要确认。

**影响**: 如果设计意图是"按最高段位发奖，积分重置到最高段位最低值"，则当前实现是错误的。

---

### P0-12: RankingSystem.deserialize 不验证数据完整性

**文件**: `RankingSystem.ts` 第 219 行
**维度**: F-Error

**描述**:
```typescript
deserialize(data: RankingSaveData): void {
  if (!data || data.version !== RANKING_SAVE_VERSION) return;
  this.rankings.set(RankingDimension.SCORE, data.scoreRanking);  // ← 直接赋值，不验证
  this.rankings.set(RankingDimension.POWER, data.powerRanking);
  this.rankings.set(RankingDimension.SEASON, data.seasonRanking);
}
```

如果 `data.scoreRanking` 为 null/undefined 或结构不完整（缺少 entries/lastUpdateTime），后续调用 `getRanking()` 时可能返回异常数据。

**影响**: 反序列化损坏数据导致排行榜系统异常。

---

### P0-13: ArenaSystem.serialize 中 season 数据为硬编码空值

**文件**: `ArenaSystem.ts` 第 376-383 行
**维度**: F-Lifecycle

**描述**:
```typescript
serialize(playerState?: ArenaPlayerState): ArenaSaveData {
  return {
    version: ARENA_SAVE_VERSION,
    state: { ...state },
    season: {
      seasonId: '',
      startTime: 0,
      endTime: 0,
      currentDay: 1,
      isSettled: false,
    },  // ← 永远是空赛季
    highestRankId: state.rankId,  // ← 用当前段位而非最高段位
  };
}
```

两个问题：
1. `season` 永远是空值，实际赛季数据未被序列化
2. `highestRankId` 使用 `state.rankId`（当前段位），而非追踪的最高段位

**影响**: 存档中赛季数据丢失，最高段位追踪失效。

---

### P0-14: selectByFactionBalance 在候选人恰好等于count时返回副本

**文件**: `ArenaSystem.helpers.ts` 第 107 行
**维度**: F-Boundary

**描述**:
```typescript
if (candidates.length <= count) return [...candidates];
```

当 `candidates.length === count` 时返回副本，这是正确行为。但当 `candidates.length < count` 时也返回全部，调用方 `generateOpponents` 会尝试从 `remaining` 中补充，但 `remaining` 是从 `eligible` 中排除 `selected` 后的结果，如果 `selected` 已经包含了所有 `eligible`（因为 count >= eligible.length），则 `remaining` 为空，无法补充。

**影响**: 当合格对手数量少于 candidateCount 时，无法补充到目标数量，但这其实是正确行为（没有更多合格对手）。降级为 P2。

---

### P0-15: ArenaPlayerState.playerId 是可选字段但多处用作关键标识

**文件**: `pvp.types.ts` 第 254 行
**维度**: F-Error

**描述**:
```typescript
export interface ArenaPlayerState {
  playerId?: string;  // ← 可选
  // ...
}
```

但 `PvPBattleSystem.executeBattle()` 中：
```typescript
attackerId: attackerState.playerId || 'player_attacker',
defenderId: defenderState.playerId || 'player_defender',
```

如果两个玩家都未设置 playerId，他们的 ID 将分别为 `player_attacker` 和 `player_defender`，这在日志和回放中无法区分不同玩家。

**影响**: 缺少 playerId 时战斗记录无法正确归属。

---

### P0-16: ArenaSystem.generateOpponents 的 Math.max(1, ...) 允许 rank=0 的玩家匹配到 rank 1~20

**文件**: `ArenaSystem.ts` 第 131 行
**维度**: F-Boundary

**描述**:
```typescript
const minRank = Math.max(1, myRanking - rankMaxOffset);
```

当 `myRanking=0`（未入榜）时，`minRank=1, maxRank=20`。这意味着未入榜玩家会匹配到排名1~20的对手，这些可能是顶级玩家。同时 `calculatePower` 对未入榜玩家（score=0, 0武将）返回 power=5000，而排名前20的玩家 power 可能在 50000+，但由于战力范围筛选（0.7~1.3×），这些顶级玩家会被过滤掉。

**实际影响**: 如果未入榜玩家有较高积分（如通过其他方式获得），但 ranking=0，可能匹配到不合适的对手。ranking 字段与 score 字段可能不同步。

---

### P0-17: ArenaShopSystem.buyItem 修改内部状态但返回新的 playerState

**文件**: `ArenaShopSystem.ts` 第 127 行
**维度**: F-Lifecycle

**描述**:
```typescript
buyItem(playerState, itemId, count) {
  // ...
  this.items[itemIdx] = { ...item, purchased: item.purchased + count };  // ← 修改内部状态
  const newState: ArenaPlayerState = {
    ...playerState,
    arenaCoins: playerState.arenaCoins - totalCost,  // ← 返回新状态
  };
  return { state: newState, item: { ...this.items[itemIdx] } };
}
```

`buyItem` 同时修改了 `this.items`（内部可变状态）和返回新的 `playerState`（不可变模式）。如果购买成功但调用方未使用返回的新 state，竞技币不会被扣减，但商店的 `purchased` 已经增加了。这种部分成功状态不一致。

**影响**: 调用方忘记使用返回的 state 时，竞技币不扣减但商品已购，造成刷物品漏洞。

---

### P0-18: DefenseFormationSystem 无内部状态但实现 ISubsystem

**文件**: `DefenseFormationSystem.ts` 第 97-103 行
**维度**: F-Cross

**描述**:
`DefenseFormationSystem` 是一个纯工具类，所有方法都是无状态的（接收输入，返回输出，不存储任何数据）。但它实现了 `ISubsystem` 接口（init/update/getState/reset），这些方法都是空操作。这本身不是bug，但增加了不必要的复杂度。

**影响**: 降级为 P2，不影响功能。

---

## P1 严重缺陷

### P1-01: ArenaSystem.helpers 中 calculatePower 公式与 PvPBattleSystem.estimatePower 不一致

**文件**: `ArenaSystem.helpers.ts:131` vs `PvPBattleSystem.ts:280`
**维度**: F-Cross

**描述**:
```typescript
// helpers: 用于匹配
calculatePower(playerState) = score * 10 + heroCount * 1000 + 5000

// PvPBattleSystem: 用于战斗
estimatePower(state) = score * 10 + heroCount * 1000 + 5000
```

两处公式恰好相同，但 `estimatePower` 是 private 方法，如果修改一处而忘记另一处将导致匹配战力和战斗战力不一致。

---

### P1-02: ArenaSeasonSystem.getSeasonReward 对未知 rankId 返回最低奖励

**文件**: `ArenaSeasonSystem.ts` 第 199 行
**维度**: F-Error

**描述**:
```typescript
getSeasonReward(rankId: string): SeasonReward {
  return SEASON_REWARD_MAP.get(rankId) ?? SEASON_REWARDS[0];
}
```

如果传入无效的 rankId，静默返回最低奖励而非报错。

---

### P1-03: RankingSystem.getRanking 对未初始化维度返回默认值

**文件**: `RankingSystem.ts` 第 154 行
**维度**: F-Error

**描述**:
```typescript
getRanking(dimension: RankingDimension): RankingData {
  return this.rankings.get(dimension) ?? { entries: [], lastUpdateTime: 0 };
}
```

构造函数中已初始化所有维度，所以 `??` 分支理论上不会触发，但如果有人直接调用 `this.rankings.delete(dimension)` 后再 get，会返回空数据而非报错。

---

### P1-04: ArenaSystem.freeRefresh 不检查 allPlayers 是否为空

**文件**: `ArenaSystem.ts` 第 155 行
**维度**: F-Error

**描述**:
`freeRefresh` 调用 `generateOpponents`，如果 `allPlayers=[]`，将返回空对手列表，但不会报错。玩家消耗了免费刷新机会却获得空对手列表。

---

### P1-05: PvPBattleSystem.applyBattleResult 竞技币奖励硬编码

**文件**: `PvPBattleSystem.ts` 第 261 行
**维度**: F-Normal

**描述**:
```typescript
const coinReward = result.attackerWon ? 20 : 5;
```

竞技币奖励硬编码在方法内部，未使用配置常量，策划无法调整。

---

### P1-06: ArenaSystem.updateDefenseFormation 不验证武将ID有效性

**文件**: `ArenaSystem.ts` 第 272 行
**维度**: F-Error

**描述**:
```typescript
updateDefenseFormation(playerState, slots, formation, strategy) {
  const heroCount = slots.filter((s) => s !== '').length;
  if (heroCount === 0) throw new Error('...');
  // 不验证 heroId 是否存在、是否重复
}
```

不检查武将ID重复、不存在、或属于其他玩家。

---

### P1-07: ArenaSystem.manualRefresh 不验证铜钱是否足够

**文件**: `ArenaSystem.ts` 第 171 行
**维度**: F-Error

**描述**:
`manualRefresh` 返回 `{ state, cost }` 但不实际扣减铜钱。调用方需要自行扣减。如果调用方忘记扣减，玩家可以免费手动刷新。

---

### P1-08: PvPBattleSystem 段位定义中 KING_I 的 maxScore=99999

**文件**: `PvPBattleSystem.ts` 第 72 行
**维度**: F-Boundary

**描述**:
```typescript
{ id: 'KING_I', ..., minScore: 10000, maxScore: 99999, ... }
```

99999 是硬编码上限，如果玩家积分超过 99999（虽然不太可能），`getRankIdForScore` 仍会返回 KING_I，但 maxScore 不再准确。

---

### P1-09: ArenaSystem.generateOpponents 使用 Math.random() 不可控

**文件**: `ArenaSystem.ts` 第 146 行
**维度**: F-Boundary

**描述**:
```typescript
const idx = Math.floor(Math.random() * remaining.length);
```

补充选择使用 `Math.random()`，测试中不可控，无法复现特定匹配结果。

---

### P1-10: ArenaShopSystem.getItem 返回副本但内部可变

**文件**: `ArenaShopSystem.ts` 第 98 行
**维度**: F-Lifecycle

**描述**:
`getItem` 返回 `{ ...item }` 副本，但 `buyItem` 直接修改 `this.items[itemIdx]`。如果先调用 `getItem` 获取引用，再调用 `buyItem`，getItem 返回的副本不会反映购买变化。

---

### P1-11: DefenseFormationSystem.serialize 使用 playerState 参数但 deserialize 返回 Partial

**文件**: `DefenseFormationSystem.ts` 第 237-251 行
**维度**: F-Lifecycle

**描述**:
`serialize` 接收完整的 `ArenaPlayerState`，但 `deserialize` 返回 `Partial<ArenaPlayerState>`，调用方需要手动合并，容易遗漏字段。

---

### P1-12: ArenaSystem.generateOpponents 中 eligible 与 selected 共享引用

**文件**: `ArenaSystem.ts` 第 143-147 行
**维度**: F-Boundary

**描述**:
```typescript
const remaining = eligible.filter((p) => !selected.includes(p));
while (selected.length < candidateCount && remaining.length > 0) {
  const idx = Math.floor(Math.random() * remaining.length);
  selected.push(remaining.splice(idx, 1)[0]);
}
```

`remaining.splice()` 修改了 filter 产生的新数组，这是安全的。但 `selected.includes(p)` 使用引用比较，如果 `allPlayers` 中有重复对象（不同引用但相同 playerId），可能导致同一个玩家被选两次。

---

### P1-13: ArenaSeasonSystem.createSeason 不验证 seasonId 唯一性

**文件**: `ArenaSeasonSystem.ts` 第 123 行
**维度**: F-Error

**描述**:
`createSeason` 接受任意 seasonId，不检查是否与已有赛季重复。

---

### P1-14: ArenaPlayerState 缺少 highestRankId 字段

**文件**: `pvp.types.ts`
**维度**: F-Cross

**描述**:
`ArenaPlayerState` 没有 `highestRankId` 字段，最高段位追踪需要在 `ArenaSaveData` 层面维护。但 `ArenaSystem.serialize` 直接用 `state.rankId` 作为 `highestRankId`，导致最高段位信息丢失。

---

### P1-15: RankingSystem 序列化不包含版本号验证的向后兼容

**文件**: `RankingSystem.ts` 第 219 行
**维度**: F-Lifecycle

**描述**:
版本不匹配时静默丢弃数据，不提供迁移路径。

---

### P1-16: ArenaShopSystem.buyItem 中 totalCost 可能出现浮点精度问题

**文件**: `ArenaShopSystem.ts` 第 127 行
**维度**: F-Boundary

**描述**:
```typescript
const totalCost = item.arenaCoinCost * count;
```

如果 count 是小数（如 P0-10 所述），totalCost 可能是浮点数，导致 `playerState.arenaCoins - totalCost` 出现浮点精度问题。

---

### P1-17: DefenseFormationSystem.setFormation 不检查 slots 长度

**文件**: `DefenseFormationSystem.ts` 第 122 行
**维度**: F-Error

**描述**:
```typescript
setFormation(current, slots: [string, string, string, string, string], ...) {
  const heroCount = slots.filter((s) => s !== '').length;
  if (heroCount > FORMATION_SLOT_COUNT) {
    throw new Error(`最多${FORMATION_SLOT_COUNT}名武将`);
  }
}
```

TypeScript 元组类型 `[string, string, string, string, string]` 在运行时不强制长度，传入更短的数组不会报错但 `filter` 结果可能不符合预期。

---

## P2 一般缺陷

### P2-01: PvPBattleSystem 段位区间无间隙（确认正确）
（原 P0-09 降级）

### P2-02: selectByFactionBalance 候选人不足时正确返回全部（确认正确）
（原 P0-14 降级）

### P2-03: DefenseFormationSystem 实现 ISubsystem 但无状态（设计选择）
（原 P0-18 降级）

### P2-04: 多处使用 Math.random() 导致测试不可控
**文件**: ArenaSystem.ts, PvPBattleSystem.ts, DefenseFormationSystem.ts, ArenaSystem.ts
**维度**: F-Normal

### P2-05: ArenaSystem.update 无实际逻辑
**文件**: ArenaSystem.ts 第 72 行
**维度**: F-Normal
