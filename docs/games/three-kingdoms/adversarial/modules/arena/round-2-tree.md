# Arena 模块 R2 分支树 — Builder Agent

> 构建时间：2026-05-02
> 基线：R1 修复后（8 P0 已修复，556 测试通过）
> 范围：ArenaSystem + helpers + Config + SeasonSystem + ShopSystem + RankingSystem + DefenseFormation

## R2 分支树概览

| DAG 类型 | 节点数 | 边数 | 新增覆盖 |
|----------|--------|------|----------|
| Navigation | 24 | 32 | +8 vs R1 |
| Flow | 28 | 40 | +10 vs R1 |
| Resource | 18 | 22 | +6 vs R1 |
| Event | 16 | 20 | +4 vs R1 |
| State | 20 | 26 | +6 vs R1 |
| **合计** | **106** | **140** | **+34 vs R1** |

---

## 1. Navigation DAG（24 节点）

### 1.1 ArenaSystem 核心导航

```
N-01: ArenaSystem.constructor(config?)
  ├─→ N-02: this.playerState = createDefaultArenaPlayerState()
  ├─→ N-03: this.seasonSystem = new ArenaSeasonSystem(...)
  ├─→ N-04: this.shopSystem = new ArenaShopSystem(...)
  └─→ N-05: this.rankingSystem = new RankingSystem(...)
```

### 1.2 Arena 入口导航

```
N-06: ArenaSystem.startBattle(opponentIdx)
  ├─→ N-07: validateOpponentIndex(opponentIdx) → throw | continue
  ├─→ N-08: generateOpponents(playerState) → opponents[]
  ├─→ N-09: calculatePower(playerState) → myPower
  ├─→ N-10: selectByFactionBalance(candidates, count) → selected[]
  └─→ N-11: PvPBattleSystem.createBattle(attacker, defender) → battle
```

### 1.3 商店导航

```
N-12: ArenaShopSystem.buyItem(itemIdx, count)
  ├─→ N-13: validateItemIndex(itemIdx) → throw | continue
  ├─→ N-14: canBuy(itemIdx, count) → boolean
  │    ├─→ N-15: check weeklyLimit + purchased (NaN-safe)
  │    ├─→ N-16: check totalCost (NaN-safe)
  │    └─→ N-17: check arenaCoins (NaN-safe)
  └─→ N-18: executePurchase → deduct coins, increment purchased
```

### 1.4 赛季导航

```
N-19: ArenaSeasonSystem.settleSeason(now)
  ├─→ N-20: getRemainingDays(now) → days
  ├─→ N-21: getCurrentRank(playerState) → rank
  ├─→ N-22: grantSeasonReward(rank) → addArenaCoins
  └─→ N-23: resetSeason → createDefaultArenaPlayerState + DEFAULT_CHALLENGE_CONFIG
```

### 1.5 排名导航

```
N-24: RankingSystem.getRankingList(type, data?)
  ├─→ N-25: if (!data) return defaultValue
  └─→ N-26: parseAndSort(data) → ranking[]
```

---

## 2. Flow DAG（28 节点）

### 2.1 战斗流程

```
F-01: player.startBattle(0)
  ├─→ F-02: validateOpponentIndex(0) → OK
  ├─→ F-03: calculatePower(playerState) → NaN-safe → power
  ├─→ F-04: generateOpponents → selectByFactionBalance → 3 opponents
  ├─→ F-05: PvPBattleSystem.createBattle → battleId
  ├─→ F-06: applyBattleResult(won) → update score/arenaCoins
  └─→ F-07: updateHighestRank(newRankId)
```

### 2.2 商店购买流程（R2 增强）

```
F-08: shop.buyItem(itemIdx, count)
  ├─→ F-09: itemIdx < 0 → throw '商品不存在'
  ├─→ F-10: itemIdx >= items.length → throw '商品不存在'
  ├─→ F-11: count = NaN → throw '购买数量必须为正整数'
  ├─→ F-12: count = 0 → throw '购买数量必须为正整数'
  ├─→ F-13: count = -1 → throw '购买数量必须为正整数'
  ├─→ F-14: weeklyLimit > 0 && purchased + count > weeklyLimit → throw
  ├─→ F-15: purchased = NaN → fallback to 0, then check limit
  ├─→ F-16: arenaCoinCost = NaN → totalCost = NaN → throw '商品价格异常'
  ├─→ F-17: arenaCoinCost = -100 → totalCost = -200 → throw '商品价格异常'
  ├─→ F-18: arenaCoins = NaN → throw '竞技币不足'
  ├─→ F-19: arenaCoins < totalCost → throw '竞技币不足'
  └─→ F-20: all checks pass → deduct + grant + update purchased
```

### 2.3 赛季结算流程（R2 增强）

```
F-21: season.settleSeason(now)
  ├─→ F-22: getRemainingDays(now) → 0 (season ended)
  ├─→ F-23: getCurrentRank → rankId
  ├─→ F-24: SEASON_REWARDS[rankId] → reward
  ├─→ F-25: addArenaCoins(arenaCoins, reward.arenaCoin) → capped at MAX_ARENA_COINS
  ├─→ F-26: resetPlayerState → dailyChallengesLeft = DEFAULT_CHALLENGE_CONFIG.dailyFreeChallenges
  └─→ F-27: return settlement result
```

### 2.4 每日奖励流程

```
F-28: season.grantDailyReward(now)
  ├─→ F-29: getCurrentDay(now) → day
  ├─→ F-30: getDailyReward(day) → reward
  └─→ F-31: addArenaCoins(arenaCoins, reward.arenaCoin) → capped
```

---

## 3. Resource DAG（18 节点）

### 3.1 竞技币生命周期

```
R-01: arenaCoins 初始化 = 0 (createDefaultArenaPlayerState)
  ├─→ R-02: +arenaCoins via addArenaCoins (battle reward)
  ├─→ R-03: +arenaCoins via addArenaCoins (daily reward)
  ├─→ R-04: +arenaCoins via addArenaCoins (season reward)
  ├─→ R-05: -arenaCoins via shop.buyItem
  ├─→ R-06: arenaCoins capped at MAX_ARENA_COINS = 999999
  ├─→ R-07: arenaCoins = NaN → addArenaCoins returns 0
  └─→ R-08: arenaCoins = Infinity → addArenaCoins returns MAX_ARENA_COINS
```

### 3.2 购买次数资源

```
R-09: dailyChallengesLeft 初始化 = DEFAULT_CHALLENGE_CONFIG.dailyFreeChallenges
  ├─→ R-10: dailyReset → reset to config value
  └─→ R-11: settleSeason → reset to config value (no hardcoded 5)
```

### 3.3 限购资源

```
R-12: purchased 初始化 = 0
  ├─→ R-13: purchased += count (buyItem success)
  ├─→ R-14: purchased = NaN → fallback 0 (buyItem/canBuy)
  └─→ R-15: weeklyReset → purchased = 0 for all items
```

### 3.4 积分资源

```
R-16: score 初始化 = 0
  ├─→ R-17: score += delta (applyBattleResult)
  └─→ R-18: score = NaN → calculatePower returns 5000 (safe default)
```

---

## 4. Event DAG（16 节点）

### 4.1 战斗事件

```
E-01: onBattleStart(opponentIdx)
  ├─→ E-02: validate → generateOpponents → createBattle
  └─→ E-03: onBattleEnd(battleId, result)
       ├─→ E-04: result = win → score +, arenaCoins +
       └─→ E-05: result = lose → score -, no coins
```

### 4.2 赛季事件

```
E-06: onSeasonStart()
  ├─→ E-07: createSeason(startTime, config)
  └─→ E-08: onSeasonEnd(now)
       ├─→ E-09: settleSeason(now)
       └─→ E-10: startNewSeason(now)
```

### 4.3 商店事件

```
E-11: onShopRefresh(type)
  ├─→ E-12: freeRefresh → no cost, increment used count
  └─→ E-13: manualRefresh → cost arenaCoins
```

### 4.4 每日事件

```
E-14: onDailyReset(now)
  ├─→ E-15: resetDailyChallenges
  └─→ E-16: grantDailyReward
```

---

## 5. State DAG（20 节点）

### 5.1 PlayerState 状态机

```
S-01: IDLE (初始状态)
  ├─→ S-02: IN_BATTLE (startBattle)
  │    └─→ S-03: RESULT_PENDING (battle executing)
  │         ├─→ S-04: WIN → applyBattleResult(won=true) → S-01
  │         └─→ S-05: LOSE → applyBattleResult(won=false) → S-01
  ├─→ S-06: SHOPPING (buyItem)
  │    ├─→ S-07: BUY_SUCCESS → deduct coins → S-01
  │    └─→ S-08: BUY_FAIL → throw → S-01
  └─→ S-09: SEASON_SETTLEMENT (settleSeason)
       └─→ S-10: SETTLED → reset → S-01
```

### 5.2 序列化状态

```
S-11: serialize() → JSON
  ├─→ S-12: arena → { score, opponents, defenseFormation }
  ├─→ S-13: arenaShop → { items, freeRefreshUsed, manualRefreshUsed }
  ├─→ S-14: ranking → { powerRanking, scoreRanking, winRateRanking }
  └─→ S-15: season → { seasonId, startTime, endTime, ... }
```

### 5.3 反序列化状态

```
S-16: deserialize(data) → PlayerState
  ├─→ S-17: data = null → return default
  ├─→ S-18: data = {} → return default
  ├─→ S-19: data = corrupted → NaN fields → NaN-safe handlers
  └─→ S-20: data = valid → restore full state
```

---

## R1→R2 差异分析

### R2 新增节点（34个）

| 节点ID | 类型 | 描述 | R1 缺陷关联 |
|--------|------|------|-------------|
| F-15 | Flow | purchased=NaN→fallback 0 | FIX-R1-03 |
| F-16 | Flow | arenaCoinCost=NaN→throw | FIX-R1-07 |
| F-17 | Flow | arenaCoinCost<0→throw | FIX-R1-07 |
| F-18 | Flow | arenaCoins=NaN→throw | FIX-R1-02 |
| F-25 | Flow | addArenaCoins capped | FIX-R1-05 |
| F-26 | Flow | settleSeason uses config | FIX-R1-04 |
| F-31 | Flow | dailyReward addArenaCoins | FIX-R1-05 |
| R-06 | Resource | MAX_ARENA_COINS cap | FIX-R1-05 |
| R-07 | Resource | NaN→addArenaCoins returns 0 | FIX-R1-05 |
| R-08 | Resource | Infinity→capped | FIX-R1-05 |
| R-10 | Resource | dailyReset uses config | FIX-R1-04 |
| R-11 | Resource | settleSeason uses config | FIX-R1-04 |
| R-14 | Resource | purchased NaN fallback | FIX-R1-03 |
| R-18 | Resource | score NaN→safe power | FIX-R1-01 |
| S-19 | State | corrupted data→NaN-safe | FIX-R1-02/03/07 |
| +19 more | mixed | expanded edge coverage | P1 mitigation |

### R2 重点验证维度

1. **NaN 防护穿透**：所有 8 个 P0 修复的端到端验证
2. **资源上限**：MAX_ARENA_COINS 在所有增加竞技币路径的穿透
3. **配置一致性**：settleSeason/dailyReset 均使用 DEFAULT_CHALLENGE_CONFIG
4. **运行时校验**：SEASON_REWARDS vs RANK_LEVELS 启动检查
5. **序列化往返**：含 NaN 字段的 corrupted data 反序列化安全
