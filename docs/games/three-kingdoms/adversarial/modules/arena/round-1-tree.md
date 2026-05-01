# Arena 模块流程分支树 — Round 1

> 生成时间：2026-05-02
> 模块路径：`src/games/three-kingdoms/engine/pvp/`（Arena 聚焦范围）
> 源码文件：9个（2170行）| 核心类型文件：2个
> 聚焦范围：ArenaSystem + ArenaSystem.helpers + ArenaConfig + ArenaSeasonSystem + ArenaShopSystem（5个子系统）
> 排除：PvPBattleSystem、RankingSystem、DefenseFormationSystem（已由 pvp 模块 R1-R3 覆盖）

## 统计

| 维度 | 数量 |
|------|------|
| **总节点数** | **156** |
| P0 阻塞 | 68 |
| P1 严重 | 62 |
| P2 一般 | 26 |
| covered | 0 |
| missing | 156 |
| partial | 0 |

### 按系统分布

| 系统 | 公开API数 | 节点数 | covered | missing | partial |
|------|-----------|--------|---------|---------|---------|
| ArenaSystem | 15 | 48 | 0 | 48 | 0 |
| ArenaSystem.helpers | 4 | 16 | 0 | 16 | 0 |
| ArenaConfig | 1 | 4 | 0 | 4 | 0 |
| ArenaSeasonSystem | 12 | 46 | 0 | 46 | 0 |
| ArenaShopSystem | 8 | 42 | 0 | 42 | 0 |

---

## 1. ArenaSystem（48节点）

### 1.1 ISubsystem 生命周期（4节点）

| ID | 类型 | 优先级 | 节点描述 | 状态 |
|----|------|--------|----------|------|
| AS-LC-01 | F-Normal | P1 | init(deps) 正确初始化，playerPool 清空 | missing |
| AS-LC-02 | F-Normal | P1 | update(dt) 无异常（预留空实现） | missing |
| AS-LC-03 | F-Normal | P1 | getState() 返回完整状态快照 | missing |
| AS-LC-04 | F-Normal | P1 | reset() 清空 playerPool 和 playerState | missing |

### 1.2 generateOpponents 匹配（12节点）

| ID | 类型 | 优先级 | 节点描述 | 状态 |
|----|------|--------|----------|------|
| AS-GO-01 | F-Normal | P0 | 正常匹配：战力范围 [0.7x, 1.3x] + 排名范围 [±20] | missing |
| AS-GO-02 | F-Normal | P0 | 按阵营平衡选取候选对手 | missing |
| AS-GO-03 | F-Boundary | P0 | NaN ranking → 默认 9999，不崩溃 | missing |
| AS-GO-04 | F-Boundary | P0 | NaN score → calculatePower 返回 NaN → 战力范围筛选异常 | missing |
| AS-GO-05 | F-Boundary | P1 | 空对手池返回空数组 | missing |
| AS-GO-06 | F-Boundary | P1 | 所有对手不满足条件返回空数组 | missing |
| AS-GO-07 | F-Boundary | P1 | 恰好满足战力/排名边界的对手被包含 | missing |
| AS-GO-08 | F-Error | P0 | NaN power 导致 minPower/maxPower 为 NaN，所有对手被排除 | missing |
| AS-GO-09 | F-Error | P0 | Infinity score 导致 power 溢出，所有对手被排除 | missing |
| AS-GO-10 | F-Normal | P1 | 候选不足时从合格池补充 | missing |
| AS-GO-11 | F-Normal | P1 | 返回数量不超过 candidateCount (3) | missing |
| AS-GO-12 | F-Boundary | P2 | playerState.ranking = 0 时排名范围计算 | missing |

### 1.3 刷新机制（10节点）

| ID | 类型 | 优先级 | 节点描述 | 状态 |
|----|------|--------|----------|------|
| AS-RF-01 | F-Normal | P0 | canFreeRefresh：冷却期后返回 true | missing |
| AS-RF-02 | F-Normal | P0 | freeRefresh：更新 lastFreeRefreshTime + opponents | missing |
| AS-RF-03 | F-Error | P0 | freeRefresh 冷却中抛出异常 | missing |
| AS-RF-04 | F-Normal | P0 | manualRefresh：消耗铜钱 + 增加计数 | missing |
| AS-RF-05 | F-Error | P0 | manualRefresh 超限抛出异常 | missing |
| AS-RF-06 | F-Boundary | P1 | canFreeRefresh：恰好冷却完成（elapsed == freeIntervalMs）| missing |
| AS-RF-07 | F-Boundary | P1 | manualRefresh：dailyManualLimit 恰好达到上限 | missing |
| AS-RF-08 | F-Error | P1 | freeRefresh now 为 NaN/负数时行为 | missing |
| AS-RF-09 | F-Error | P1 | manualRefresh now 为 NaN/负数时行为 | missing |
| AS-RF-10 | F-Normal | P2 | manualRefresh 返回正确的 cost 值 | missing |

### 1.4 挑战次数（8节点）

| ID | 类型 | 优先级 | 节点描述 | 状态 |
|----|------|--------|----------|------|
| AS-CH-01 | F-Normal | P0 | canChallenge：次数 > 0 返回 true | missing |
| AS-CH-02 | F-Normal | P0 | consumeChallenge：减少 dailyChallengesLeft | missing |
| AS-CH-03 | F-Error | P0 | consumeChallenge 次数为0抛出异常 | missing |
| AS-CH-04 | F-Normal | P0 | buyChallenge：增加次数 + 返回元宝消耗 | missing |
| AS-CH-05 | F-Error | P0 | buyChallenge 超限抛出异常 | missing |
| AS-CH-06 | F-Normal | P0 | dailyReset 重置所有每日数据 | missing |
| AS-CH-07 | F-Boundary | P1 | dailyChallengesLeft = NaN 时 canChallenge 行为 | missing |
| AS-CH-08 | F-Boundary | P2 | dailyReset 后 opponents 被清空 | missing |

### 1.5 防守阵容与日志（8节点）

| ID | 类型 | 优先级 | 节点描述 | 状态 |
|----|------|--------|----------|------|
| AS-DF-01 | F-Normal | P0 | updateDefenseFormation：成功更新阵容 | missing |
| AS-DF-02 | F-Error | P0 | 空阵容（全空字符串）抛出异常 | missing |
| AS-DF-03 | F-Normal | P1 | addDefenseLog：正确添加日志条目 | missing |
| AS-DF-04 | F-Boundary | P1 | 日志上限50条，超出截断 | missing |
| AS-DF-05 | F-Normal | P1 | getDefenseStats：统计正确 | missing |
| AS-DF-06 | F-Boundary | P1 | 0条日志时统计全为0 | missing |
| AS-DF-07 | F-Boundary | P2 | 低胜率（≥5场）建议策略 | missing |
| AS-DF-08 | F-Boundary | P2 | 中等胜率建议均衡策略 | missing |

### 1.6 玩家池管理（2节点）

| ID | 类型 | 优先级 | 节点描述 | 状态 |
|----|------|--------|----------|------|
| AS-PP-01 | F-Normal | P1 | registerPlayer 注册到匹配池 | missing |
| AS-PP-02 | F-Normal | P1 | getAllPlayers 返回所有注册玩家 | missing |

### 1.7 序列化（4节点）

| ID | 类型 | 优先级 | 节点描述 | 状态 |
|----|------|--------|----------|------|
| AS-SZ-01 | F-Normal | P0 | serialize 返回完整存档结构（version/state/season/highestRankId）| missing |
| AS-SZ-02 | F-Normal | P0 | deserialize 版本匹配恢复状态 | missing |
| AS-SZ-03 | F-Error | P0 | deserialize 版本不匹配返回默认状态 | missing |
| AS-SZ-04 | F-Error | P0 | deserialize null/undefined 返回默认状态 | missing |

---

## 2. ArenaSystem.helpers（16节点）

### 2.1 calculatePower（6节点）

| ID | 类型 | 优先级 | 节点描述 | 状态 |
|----|------|--------|----------|------|
| AH-CP-01 | F-Normal | P0 | 正常计算：score*10 + heroCount*1000 + 5000 | missing |
| AH-CP-02 | F-Boundary | P0 | NaN score → 返回 NaN（Math.max(0, NaN) = NaN）| missing |
| AH-CP-03 | F-Boundary | P0 | Infinity score → 返回 Infinity | missing |
| AH-CP-04 | F-Boundary | P1 | 负数 score → Math.max(0, ...) 保护 | missing |
| AH-CP-05 | F-Normal | P1 | 0个武将时 heroCount = 0 | missing |
| AH-CP-06 | F-Boundary | P1 | 5个武将（满阵容）时 heroCount = 5 | missing |

### 2.2 selectByFactionBalance（6节点）

| ID | 类型 | 优先级 | 节点描述 | 状态 |
|----|------|--------|----------|------|
| AH-SF-01 | F-Normal | P0 | 多阵营轮流选取，保证多样性 | missing |
| AH-SF-02 | F-Boundary | P1 | 候选不足 count 时全部返回 | missing |
| AH-SF-03 | F-Boundary | P1 | 空候选返回空数组 | missing |
| AH-SF-04 | F-Boundary | P1 | 单阵营全部选取 | missing |
| AH-SF-05 | F-Normal | P1 | 返回副本不引用原数组 | missing |
| AH-SF-06 | F-Boundary | P2 | count=0 返回空数组 | missing |

### 2.3 工厂函数（4节点）

| ID | 类型 | 优先级 | 节点描述 | 状态 |
|----|------|--------|----------|------|
| AH-FT-01 | F-Normal | P0 | createDefaultArenaPlayerState 字段完整 | missing |
| AH-FT-02 | F-Normal | P0 | createDefaultDefenseFormation 字段完整 | missing |
| AH-FT-03 | F-Boundary | P1 | createDefaultArenaPlayerState 无参数时 playerId = '' | missing |
| AH-FT-04 | F-Boundary | P1 | createDefaultArenaPlayerState 每日次数与配置一致 | missing |

---

## 3. ArenaConfig（4节点）

### 3.1 重导出一致性（4节点）

| ID | 类型 | 优先级 | 节点描述 | 状态 |
|----|------|--------|----------|------|
| AC-EX-01 | F-Normal | P0 | ArenaConfig 重导出与 ArenaSystem.helpers 原始值一致 | missing |
| AC-EX-02 | F-Normal | P1 | ARENA_SAVE_VERSION = 1 | missing |
| AC-EX-03 | F-Normal | P1 | DEFAULT_MATCH_CONFIG 字段完整 | missing |
| AC-EX-04 | F-Normal | P1 | DEFAULT_CHALLENGE_CONFIG 字段完整 | missing |

---

## 4. ArenaSeasonSystem（46节点）

### 4.1 ISubsystem 生命周期（4节点）

| ID | 类型 | 优先级 | 节点描述 | 状态 |
|----|------|--------|----------|------|
| SS-LC-01 | F-Normal | P1 | init(deps) 正确初始化 | missing |
| SS-LC-02 | F-Normal | P1 | update(dt) 无异常 | missing |
| SS-LC-03 | F-Normal | P1 | getState() 返回配置信息 | missing |
| SS-LC-04 | F-Normal | P2 | reset() 无内部状态需重置 | missing |

### 4.2 赛季周期管理（10节点）

| ID | 类型 | 优先级 | 节点描述 | 状态 |
|----|------|--------|----------|------|
| SS-SC-01 | F-Normal | P0 | createSeason 创建28天赛季 | missing |
| SS-SC-02 | F-Normal | P0 | getCurrentDay 正确计算天数 | missing |
| SS-SC-03 | F-Normal | P0 | isSeasonEnded 正确判断赛季结束 | missing |
| SS-SC-04 | F-Normal | P0 | isSeasonActive 正确判断赛季进行中 | missing |
| SS-SC-05 | F-Normal | P1 | getRemainingDays 计算剩余天数 | missing |
| SS-SC-06 | F-Boundary | P1 | 赛季第1天 getCurrentDay = 1 | missing |
| SS-SC-07 | F-Boundary | P1 | 赛季最后一天 getCurrentDay = 28 | missing |
| SS-SC-08 | F-Boundary | P1 | 超过赛季天数 getCurrentDay 上限为 seasonDays | missing |
| SS-SC-09 | F-Boundary | P1 | 赛季结束后 getRemainingDays = 0 | missing |
| SS-SC-10 | F-Error | P0 | createSeason seasonId 为空字符串时的行为 | missing |

### 4.3 赛季结算（10节点）

| ID | 类型 | 优先级 | 节点描述 | 状态 |
|----|------|--------|----------|------|
| SS-ST-01 | F-Normal | P0 | settleSeason 按最高段位发放奖励 | missing |
| SS-ST-02 | F-Normal | P0 | settleSeason 积分重置到当前段位最低值 | missing |
| SS-ST-03 | F-Normal | P0 | settleSeason 增加竞技币 | missing |
| SS-ST-04 | F-Normal | P1 | settleSeason 重置每日数据 | missing |
| SS-ST-05 | F-Normal | P1 | settleSeason 清空回放和日志 | missing |
| SS-ST-06 | F-Error | P0 | settleSeason highestRankId 无效时回退到 SEASON_REWARDS[0] | missing |
| SS-ST-07 | F-Normal | P1 | getSeasonReward 返回正确奖励 | missing |
| SS-ST-08 | F-Normal | P1 | updateHighestRank 只升不降 | missing |
| SS-ST-09 | F-Boundary | P1 | updateHighestRank 相同段位不变 | missing |
| SS-ST-10 | F-Boundary | P2 | settleSeason arenaCoins 溢出（竞技币无上限）| missing |

### 4.4 每日奖励与商店（6节点）

| ID | 类型 | 优先级 | 节点描述 | 状态 |
|----|------|--------|----------|------|
| SS-DR-01 | F-Normal | P0 | grantDailyReward 按段位发放奖励 | missing |
| SS-DR-02 | F-Normal | P1 | grantDailyReward 增加竞技币 | missing |
| SS-DR-03 | F-Error | P0 | buyArenaShopItem 竞技币不足抛出异常 | missing |
| SS-DR-04 | F-Normal | P1 | buyArenaShopItem 扣除竞技币 | missing |
| SS-DR-05 | F-Boundary | P1 | grantDailyReward 无效 rankId 回退默认奖励 | missing |
| SS-DR-06 | F-Error | P1 | buyArenaShopItem cost 为 NaN 时行为 | missing |

### 4.5 序列化（6节点）

| ID | 类型 | 优先级 | 节点描述 | 状态 |
|----|------|--------|----------|------|
| SS-SZ-01 | F-Normal | P0 | serializeSeason → deserializeSeason 往返一致 | missing |
| SS-SZ-02 | F-Error | P0 | deserializeSeason 空数据回退默认 | missing |
| SS-SZ-03 | F-Error | P1 | deserializeSeason season 为 null 时回退默认 | missing |
| SS-SZ-04 | F-Error | P1 | deserializeSeason highestRankId 为空时回退 BRONZE_V | missing |
| SS-SZ-05 | F-Normal | P1 | getConfig 返回配置副本 | missing |
| SS-SZ-06 | F-Normal | P1 | getAllSeasonRewards 返回21个段位奖励 | missing |

### 4.6 配置-枚举同步（6节点）

| ID | 类型 | 优先级 | 节点描述 | 状态 |
|----|------|--------|----------|------|
| SS-CE-01 | F-Normal | P0 | SEASON_REWARDS 数量 = RANK_LEVELS 数量（21个）| missing |
| SS-CE-02 | F-Normal | P0 | SEASON_REWARDS rankId 与 RANK_LEVELS id 完全对应 | missing |
| SS-CE-03 | F-Normal | P1 | 奖励随段位递增（arenaCoin 单调不减）| missing |
| SS-CE-04 | F-Boundary | P1 | BRONZE_V 奖励最少 | missing |
| SS-CE-05 | F-Boundary | P1 | KING_I 奖励最多 | missing |
| SS-CE-06 | F-Normal | P2 | 白银以上段位有称号 | missing |

### 4.7 跨系统链路（4节点）

| ID | 类型 | 优先级 | 节点描述 | 状态 |
|----|------|--------|----------|------|
| SS-CR-01 | F-Cross | P0 | 赛季结算 → ArenaSystem.dailyReset 链路 | missing |
| SS-CR-02 | F-Cross | P0 | 赛季结算 → ArenaShopSystem 竞技币增加 → 可购买 | missing |
| SS-CR-03 | F-Cross | P1 | 每日奖励 → ArenaSeasonSystem.grantDailyReward → 竞技币增加 | missing |
| SS-CR-04 | F-Cross | P1 | engine-save 集成：arena/arenaShop/ranking 序列化覆盖 | missing |

---

## 5. ArenaShopSystem（42节点）

### 5.1 ISubsystem 生命周期（4节点）

| ID | 类型 | 优先级 | 节点描述 | 状态 |
|----|------|--------|----------|------|
| SH-LC-01 | F-Normal | P1 | init(deps) 正确初始化 | missing |
| SH-LC-02 | F-Normal | P1 | getState() 返回序列化数据 | missing |
| SH-LC-03 | F-Normal | P1 | reset() 调用 weeklyReset | missing |
| SH-LC-04 | F-Normal | P2 | update(dt) 无异常 | missing |

### 5.2 商品查询（6节点）

| ID | 类型 | 优先级 | 节点描述 | 状态 |
|----|------|--------|----------|------|
| SH-QY-01 | F-Normal | P0 | getAllItems 返回所有14种商品 | missing |
| SH-QY-02 | F-Normal | P1 | getItemsByType 按类型筛选 | missing |
| SH-QY-03 | F-Normal | P1 | getItem 返回指定商品 | missing |
| SH-QY-04 | F-Error | P1 | getItem 不存在的 itemId 返回 undefined | missing |
| SH-QY-05 | F-Normal | P2 | getAllItems 返回副本不引用内部数组 | missing |
| SH-QY-06 | F-Normal | P2 | 商品包含4种类型（hero_fragment/enhance_stone/equipment_box/avatar_frame）| missing |

### 5.3 购买逻辑（14节点）

| ID | 类型 | 优先级 | 节点描述 | 状态 |
|----|------|--------|----------|------|
| SH-BY-01 | F-Normal | P0 | buyItem 正常购买扣竞技币 + 更新 purchased | missing |
| SH-BY-02 | F-Normal | P0 | buyItem 批量购买正确计算总价 | missing |
| SH-BY-03 | F-Error | P0 | buyItem 竞技币不足抛出异常 | missing |
| SH-BY-04 | F-Error | P0 | buyItem 商品不存在抛出异常 | missing |
| SH-BY-05 | F-Error | P0 | buyItem 超出周限购抛出异常 | missing |
| SH-BY-06 | F-Error | P0 | buyItem count 为 0 抛出异常 | missing |
| SH-BY-07 | F-Error | P0 | buyItem count 为负数抛出异常 | missing |
| SH-BY-08 | F-Error | P0 | buyItem count 为 NaN 抛出异常 | missing |
| SH-BY-09 | F-Error | P0 | buyItem count 为小数抛出异常 | missing |
| SH-BY-10 | F-Normal | P1 | canBuy 返回正确检查结果 | missing |
| SH-BY-11 | F-Normal | P1 | 无限购商品（weeklyLimit=0）可重复购买 | missing |
| SH-BY-12 | F-Boundary | P1 | 恰好买满限购数量 | missing |
| SH-BY-13 | F-Boundary | P1 | 竞技币恰好等于总价 | missing |
| SH-BY-14 | F-Error | P1 | buyItem 竞技币为 NaN 时行为（NaN < totalCost = false）| missing |

### 5.4 周重置（4节点）

| ID | 类型 | 优先级 | 节点描述 | 状态 |
|----|------|--------|----------|------|
| SH-WR-01 | F-Normal | P0 | weeklyReset 所有限购计数归零 | missing |
| SH-WR-02 | F-Normal | P1 | weeklyReset 后可再次购买 | missing |
| SH-WR-03 | F-Boundary | P1 | 无限购商品 weeklyReset 无影响 | missing |
| SH-WR-04 | F-Normal | P2 | reset() 等价于 weeklyReset() | missing |

### 5.5 序列化（6节点）

| ID | 类型 | 优先级 | 节点描述 | 状态 |
|----|------|--------|----------|------|
| SH-SZ-01 | F-Normal | P0 | serialize → deserialize 往返一致 | missing |
| SH-SZ-02 | F-Normal | P0 | deserialize 恢复 purchased 计数 | missing |
| SH-SZ-03 | F-Error | P0 | deserialize 版本不匹配不恢复 | missing |
| SH-SZ-04 | F-Error | P0 | deserialize null/undefined 不崩溃 | missing |
| SH-SZ-05 | F-Error | P1 | deserialize items 非 Array 时安全跳过 | missing |
| SH-SZ-06 | F-Normal | P1 | serialize 包含 version 和 items | missing |

### 5.6 跨系统链路（4节点）

| ID | 类型 | 优先级 | 节点描述 | 状态 |
|----|------|--------|----------|------|
| SH-CR-01 | F-Cross | P0 | 赛季结算奖励竞技币 → 商店购买链路 | missing |
| SH-CR-02 | F-Cross | P0 | engine-save 集成：arenaShop 序列化/反序列化 | missing |
| SH-CR-03 | F-Cross | P1 | 每日奖励 + 商店购买 → 竞技币正确增减 | missing |
| SH-CR-04 | F-Cross | P1 | buyItem 异常安全：竞技币不扣但 purchased 不增 | missing |

### 5.7 NaN 防护（4节点）

| ID | 类型 | 优先级 | 节点描述 | 状态 |
|----|------|--------|----------|------|
| SH-NP-01 | F-Error | P0 | arenaCoins 为 NaN 时 buyItem 行为（NaN < totalCost = false → 跳过检查）| missing |
| SH-NP-02 | F-Error | P0 | arenaCoinCost 为 NaN 时 totalCost 计算异常 | missing |
| SH-NP-03 | F-Error | P1 | purchased 为 NaN 时限购检查异常 | missing |
| SH-NP-04 | F-Error | P1 | weeklyLimit 为 NaN 时限购检查异常 | missing |

---

## 跨系统链路汇总（N = 5子系统 × 2 = 10条）

| 链路ID | 起点 | 终点 | 描述 | 优先级 |
|--------|------|------|------|--------|
| LINK-01 | ArenaSystem.generateOpponents | ArenaSystem.helpers.calculatePower | 匹配依赖战力计算 | P0 |
| LINK-02 | ArenaSystem.generateOpponents | ArenaSystem.helpers.selectByFactionBalance | 匹配依赖阵营平衡选取 | P0 |
| LINK-03 | ArenaSeasonSystem.settleSeason | ArenaSystem.dailyReset | 赛季结算触发每日重置 | P0 |
| LINK-04 | ArenaSeasonSystem.settleSeason | ArenaShopSystem | 赛季奖励竞技币可购买 | P0 |
| LINK-05 | ArenaSeasonSystem.grantDailyReward | ArenaPlayerState.arenaCoins | 每日奖励增加竞技币 | P1 |
| LINK-06 | engine-save.buildSaveData | ArenaSystem.serialize | 存档保存 | P0 |
| LINK-07 | engine-save.buildSaveData | ArenaShopSystem.serialize | 商店存档保存 | P0 |
| LINK-08 | engine-save.applySaveData | ArenaSystem.deserialize | 存档加载 | P0 |
| LINK-09 | engine-save.applySaveData | ArenaShopSystem.deserialize | 商店存档加载 | P0 |
| LINK-10 | ArenaConfig | ArenaSystem.helpers | 重导出一致性 | P1 |

---

## 关键风险点

### NaN 传播链（BR-06/BR-17/BR-21 适用）

1. **calculatePower NaN 传播**：`score = NaN` → `power = NaN` → `minPower = NaN` → `p.power >= NaN = false` → 所有对手被排除
2. **arenaCoins NaN 绕过**：`arenaCoins = NaN` → `NaN < totalCost = false` → 跳过竞技币检查 → 免费购买
3. **purchased NaN 限购绕过**：`purchased = NaN` → `NaN + count > weeklyLimit` = false → 无限购买

### 资源溢出（BR-12 适用）

4. **arenaCoins 无上限**：settleSeason + grantDailyReward 无限累积，无 MAX_ARENA_COINS 常量
5. **score 无上限**：虽然 KING_I maxScore = 99999，但 applyScoreChange 不设上限

### 序列化完整性（BR-14/BR-15 适用）

6. **ArenaSeasonSystem 无独立 serialize/deserialize**：赛季数据通过 ArenaSystem.serialize 保存，但 ArenaSeasonSystem 自身只有 serializeSeason/deserializeSeason
7. **DefenseFormationSystem 无 serialize/deserialize**：防守数据通过 ArenaSystem.serialize 保存

### 配置同步（BR-02/BR-18 适用）

8. **SEASON_REWARDS vs RANK_LEVELS**：必须完全对应21个段位
9. **DEFAULT_CHALLENGE_CONFIG.dailyFreeChallenges** vs settleSeason 硬编码 `dailyChallengesLeft: 5`
