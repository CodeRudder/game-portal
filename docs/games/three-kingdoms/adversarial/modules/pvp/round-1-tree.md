# PvP模块流程分支树 — Round 1

> 生成时间：2025-06-20
> 模块路径：`src/games/three-kingdoms/engine/pvp/`
> 源码文件：10个 | 核心类型文件：2个

## 统计

| 维度 | 数量 |
|------|------|
| **总节点数** | **247** |
| P0 阻塞 | 108 |
| P1 严重 | 98 |
| P2 一般 | 41 |
| covered | 0 |
| missing | 247 |
| partial | 0 |

### 按系统分布

| 系统 | 公开API数 | 节点数 | covered | missing | partial |
|------|-----------|--------|---------|---------|---------|
| ArenaSystem | 15 | 42 | 0 | 42 | 0 |
| PvPBattleSystem | 14 | 38 | 0 | 38 | 0 |
| RankingSystem | 11 | 24 | 0 | 24 | 0 |
| DefenseFormationSystem | 13 | 28 | 0 | 28 | 0 |
| ArenaSeasonSystem | 12 | 26 | 0 | 26 | 0 |
| ArenaShopSystem | 8 | 20 | 0 | 20 | 0 |
| ArenaSystem.helpers | 4 | 14 | 0 | 14 | 0 |
| ArenaConfig | 3 | 8 | 0 | 8 | 0 |
| 跨系统交互 | — | 30 | 0 | 30 | 0 |
| 数据生命周期 | — | 17 | 0 | 17 | 0 |

---

## 1. ArenaSystem（竞技场系统核心）

### generateOpponents(playerState, allPlayers)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| AS-gen-001 | normal | 正常生成3个候选对手 | 玩家score=1000，对手池10人 | 返回3个对手，均在战力0.7~1.3×和排名±5~±20范围内 | missing | P0 |
| AS-gen-002 | normal | 战力范围筛选正确 | myPower=5000 | 对手power在3500~6500之间 | missing | P0 |
| AS-gen-003 | normal | 排名范围筛选正确 | myRanking=10 | 对手ranking在1~30之间 | missing | P0 |
| AS-gen-004 | boundary | 无合格对手 | 所有对手战力超出范围 | 返回空数组 | missing | P0 |
| AS-gen-005 | boundary | 合格对手不足3个 | 仅2个合格 | 返回2个对手 | missing | P1 |
| AS-gen-006 | normal | 阵营平衡选择 | 3个阵营各有多人 | 尽量覆盖不同阵营 | missing | P0 |
| AS-gen-007 | boundary | 单一阵营对手 | 所有合格对手同阵营 | 返回同阵营对手 | missing | P1 |
| AS-gen-008 | boundary | 排名为0的玩家 | ranking=0 | minRank=1, maxRank=20 | missing | P1 |
| AS-gen-009 | error | 空对手池 | allPlayers=[] | 返回空数组 | missing | P0 |

### canFreeRefresh(playerState, now)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| AS-cfr-001 | normal | 冷却已过 | elapsed >= 30min | 返回true | missing | P0 |
| AS-cfr-002 | normal | 冷却未过 | elapsed < 30min | 返回false | missing | P0 |
| AS-cfr-003 | boundary | 恰好30分钟 | elapsed = 30min | 返回true | missing | P0 |
| AS-cfr-004 | boundary | 从未刷新过 | lastFreeRefreshTime=0 | 返回true | missing | P1 |

### freeRefresh(playerState, allPlayers, now)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| AS-fr-001 | normal | 正常免费刷新 | 冷却已过 | 返回新状态，opponents更新，lastFreeRefreshTime=now | missing | P0 |
| AS-fr-002 | error | 冷却中刷新 | 冷却未过 | 抛出Error('免费刷新冷却中') | missing | P0 |
| AS-fr-003 | lifecycle | 刷新后冷却重置 | 刷新成功 | 下次canFreeRefresh需再等30min | missing | P1 |

### manualRefresh(playerState, allPlayers, now)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| AS-mr-001 | normal | 正常手动刷新 | dailyManualRefreshes < 10 | 返回{state, cost=500} | missing | P0 |
| AS-mr-002 | error | 超出每日上限 | dailyManualRefreshes >= 10 | 抛出Error('今日手动刷新次数已达上限') | missing | P0 |
| AS-mr-003 | boundary | 第10次手动刷新 | dailyManualRefreshes=9 | 成功，返回cost=500 | missing | P0 |
| AS-mr-004 | lifecycle | 计数递增 | 刷新前count=N | 刷新后count=N+1 | missing | P1 |

### canChallenge(playerState)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| AS-cc-001 | normal | 有剩余次数 | dailyChallengesLeft > 0 | 返回true | missing | P0 |
| AS-cc-002 | normal | 次数用完 | dailyChallengesLeft = 0 | 返回false | missing | P0 |
| AS-cc-003 | boundary | 恰好1次 | dailyChallengesLeft = 1 | 返回true | missing | P1 |

### consumeChallenge(playerState)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| AS-con-001 | normal | 正常消耗 | dailyChallengesLeft=3 | 返回新状态，dailyChallengesLeft=2 | missing | P0 |
| AS-con-002 | error | 次数为0时消耗 | dailyChallengesLeft=0 | 抛出Error('今日挑战次数已用完') | missing | P0 |
| AS-con-003 | boundary | 最后一次消耗 | dailyChallengesLeft=1 | 返回dailyChallengesLeft=0 | missing | P1 |

### buyChallenge(playerState)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| AS-bc-001 | normal | 正常购买 | dailyBoughtChallenges < 5 | 返回{state, cost=50}，dailyChallengesLeft+1 | missing | P0 |
| AS-bc-002 | error | 超出购买上限 | dailyBoughtChallenges >= 5 | 抛出Error('今日购买次数已达上限') | missing | P0 |
| AS-bc-003 | boundary | 第5次购买 | dailyBoughtChallenges=4 | 成功，cost=50 | missing | P0 |

### dailyReset(playerState)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| AS-dr-001 | normal | 正常每日重置 | 有消耗记录 | dailyChallengesLeft=5, dailyBoughtChallenges=0, dailyManualRefreshes=0, opponents=[] | missing | P0 |
| AS-dr-002 | lifecycle | 重置后可再次挑战 | 重置后 | canChallenge返回true | missing | P1 |

### updateDefenseFormation(playerState, slots, formation, strategy)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| AS-udf-001 | normal | 正常更新阵容 | 3个武将 | defenseFormation更新 | missing | P0 |
| AS-udf-002 | error | 空阵容 | slots全空 | 抛出Error('防守阵容至少需要1名武将') | missing | P0 |
| AS-udf-003 | boundary | 5个武将满编 | slots全满 | 成功更新 | missing | P1 |

### addDefenseLog / getDefenseStats

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| AS-dl-001 | normal | 添加防守日志 | 正常日志 | 日志列表增长，最新在前 | missing | P0 |
| AS-dl-002 | boundary | 日志上限50条 | 已有50条 | 添加后仍为50条 | missing | P0 |
| AS-dl-003 | normal | 防守统计计算 | 5胜5负 | totalDefenses=10, winRate=0.5 | missing | P0 |
| AS-dl-004 | normal | 胜率低建议策略 | 2胜8负(≥5场) | suggestedStrategy=DEFENSIVE | missing | P1 |

### serialize / deserialize

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| AS-ser-001 | normal | 序列化完整状态 | 有数据的playerState | 返回ArenaSaveData含version/state/season/highestRankId | missing | P0 |
| AS-ser-002 | normal | 反序列化正确版本 | version=1 | playerState完全恢复 | missing | P0 |
| AS-ser-003 | error | 版本不匹配 | version=99 | 返回默认状态 | missing | P0 |
| AS-ser-004 | error | null数据反序列化 | data=null | 返回默认状态 | missing | P1 |

### ISubsystem接口

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| AS-sys-001 | normal | init注入依赖 | — | playerPool清空 | missing | P2 |
| AS-sys-002 | normal | reset重置 | — | playerPool清空，playerState恢复默认 | missing | P2 |
| AS-sys-003 | normal | getState返回快照 | — | 包含playerPoolSize/matchConfig/refreshConfig等 | missing | P2 |

---

## 2. PvPBattleSystem（PvP战斗系统）

### calculateWinScore()

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| PBS-cws-001 | normal | 胜利积分范围 | 默认配置 | 返回30~60之间的整数 | missing | P0 |
| PBS-cws-002 | boundary | 最小值30 | 多次调用 | 永远≥30 | missing | P0 |
| PBS-cws-003 | boundary | 最大值60 | 多次调用 | 永远≤60 | missing | P0 |

### calculateLoseScore()

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| PBS-cls-001 | normal | 失败积分范围 | 默认配置 | 返回-30~-15之间的负整数 | missing | P0 |
| PBS-cls-002 | boundary | 绝对值范围 | 多次调用 | 绝对值在15~30之间 | missing | P0 |

### applyScoreChange(playerState, scoreChange)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| PBS-asc-001 | normal | 正常加分 | score=1000, change=50 | 新score=1050, rankId正确更新 | missing | P0 |
| PBS-asc-002 | normal | 正常扣分 | score=1000, change=-30 | 新score=970 | missing | P0 |
| PBS-asc-003 | boundary | 扣分到0 | score=10, change=-50 | score=0（不低于0） | missing | P0 |
| PBS-asc-004 | boundary | 段位晋升 | score=1499, change=50 | rankId从BRONZE_I变为SILVER_V | missing | P0 |
| PBS-asc-005 | boundary | 段位降级 | score=1500, change=-50 | rankId从SILVER_V变为BRONZE_I | missing | P0 |

### getRankIdForScore(score)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| PBS-grs-001 | normal | 21级段位全覆盖 | 遍历0~10000+ | 每个段位正确映射 | missing | P0 |
| PBS-grs-002 | boundary | score=0 | — | 返回'BRONZE_V' | missing | P0 |
| PBS-grs-003 | boundary | score=10000 | — | 返回'KING_I' | missing | P0 |
| PBS-grs-004 | boundary | score=299 | — | 返回'BRONZE_V' | missing | P0 |
| PBS-grs-005 | boundary | score=300 | — | 返回'BRONZE_IV' | missing | P0 |
| PBS-grs-006 | boundary | score=99999 | — | 返回'KING_I' | missing | P1 |

### isRankUp / isRankDown

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| PBS-iru-001 | normal | 升段判定 | BRONZE_V→BRONZE_IV | 返回true | missing | P0 |
| PBS-iru-002 | normal | 未升段 | BRONZE_V→BRONZE_V | 返回false | missing | P0 |
| PBS-ird-001 | normal | 降段判定 | SILVER_V→BRONZE_I | 返回true | missing | P0 |
| PBS-ird-002 | normal | 未降段 | BRONZE_V→BRONZE_V | 返回false | missing | P0 |

### executeBattle(attackerState, defenderState, mode)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| PBS-eb-001 | normal | 正常战斗执行 | 双方默认状态 | 返回PvPBattleResult，含battleId/attackerWon/scoreChange | missing | P0 |
| PBS-eb-002 | normal | 防守方5%加成 | 双方同等战力 | 防守方实际战力=原战力×1.05 | missing | P0 |
| PBS-eb-003 | normal | 积分对称变化 | 进攻方+50 | 防守方-50 | missing | P0 |
| PBS-eb-004 | boundary | 进攻方积分不为负 | attackerScore=10, attackerWon=false | attackerNewScore=0 | missing | P0 |
| PBS-eb-005 | boundary | 防守方积分不为负 | defenderScore=10, attackerWon=true | defenderNewScore=0 | missing | P0 |
| PBS-eb-006 | normal | 胜率计算合理 | 攻击力远大于防守 | winChance接近0.9 | missing | P1 |
| PBS-eb-007 | normal | 胜率下限0.1 | 攻击力远小于防守 | winChance=0.1 | missing | P1 |
| PBS-eb-008 | normal | 回合数1~10 | — | totalTurns在1~10之间 | missing | P1 |

### applyBattleResult(attackerState, result)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| PBS-abr-001 | normal | 胜利加竞技币 | attackerWon=true | arenaCoins+20 | missing | P0 |
| PBS-abr-002 | normal | 失败加少量竞技币 | attackerWon=false | arenaCoins+5 | missing | P0 |
| PBS-abr-003 | normal | 积分和段位更新 | scoreChange=50 | score和rankId正确更新 | missing | P0 |

### saveReplay / cleanExpiredReplays

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| PBS-sr-001 | normal | 保存回放 | 正常replay | replays列表增长 | missing | P0 |
| PBS-sr-002 | boundary | 回放上限50条 | 已有50条 | 添加后仍为50条 | missing | P0 |
| PBS-cer-001 | normal | 清理过期回放 | 有7天前的回放 | 过期回放被移除 | missing | P0 |
| PBS-cer-002 | boundary | 全部过期 | 所有回放>7天 | replays为空 | missing | P1 |

### ISubsystem接口

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| PBS-sys-001 | normal | init/reset/getState | — | 配置类系统，reset无操作 | missing | P2 |
| PBS-sys-002 | normal | getAllRankLevels | — | 返回21个段位 | missing | P1 |
| PBS-sys-003 | normal | getRankLevelCount | — | 返回21 | missing | P1 |

---

## 3. RankingSystem（排行榜系统）

### updateRanking(dimension, players, now)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| RS-ur-001 | normal | 积分维度排名 | SCORE维度，10个玩家 | 按score降序排列 | missing | P0 |
| RS-ur-002 | normal | 战力维度排名 | POWER维度 | 按power降序排列 | missing | P0 |
| RS-ur-003 | normal | 赛季维度排名 | SEASON维度 | 按score降序排列 | missing | P0 |
| RS-ur-004 | boundary | 超过maxDisplayCount | 200个玩家 | 只保留前100条 | missing | P0 |
| RS-ur-005 | boundary | 空玩家列表 | players=[] | entries为空 | missing | P1 |

### getPlayerRank(dimension, playerId)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| RS-gpr-001 | normal | 已入榜玩家 | 排名第3 | 返回3（1-based） | missing | P0 |
| RS-gpr-002 | normal | 未入榜玩家 | playerId不存在 | 返回0 | missing | P0 |
| RS-gpr-003 | boundary | 排名第1 | — | 返回1 | missing | P1 |

### getNearbyPlayers(dimension, playerId, range)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| RS-gnp-001 | normal | 获取附近玩家 | 排名第5, range=3 | 返回排名2~8的玩家 | missing | P0 |
| RS-gnp-002 | boundary | 排名靠前 | 排名第1, range=5 | start=0, 返回前6名 | missing | P0 |
| RS-gnp-003 | boundary | 未入榜 | playerId不存在 | 返回空数组 | missing | P1 |

### getTopPlayers(dimension, count)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| RS-gtp-001 | normal | 获取Top10 | count=10 | 返回前10名 | missing | P0 |
| RS-gtp-002 | boundary | 排行榜不足10人 | 只有5人 | 返回5人 | missing | P1 |

### needsRefresh(dimension, now)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| RS-nr-001 | normal | 需要刷新 | 从未更新 | 返回true | missing | P0 |
| RS-nr-002 | normal | 不需要刷新 | 刚更新过 | 返回false | missing | P0 |
| RS-nr-003 | boundary | 恰好5分钟 | elapsed=5min | 返回true | missing | P0 |

### serialize / deserialize

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| RS-ser-001 | normal | 序列化三个维度 | 有数据 | 返回RankingSaveData含score/power/season | missing | P0 |
| RS-ser-002 | normal | 反序列化恢复 | version=1 | 三个维度数据恢复 | missing | P0 |
| RS-ser-003 | error | 版本不匹配 | version=99 | 不恢复，保持原状 | missing | P1 |

---

## 4. DefenseFormationSystem（防守阵容系统）

### createDefaultFormation()

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| DFS-cdf-001 | normal | 创建默认阵容 | — | slots=5个空串, formation=FISH_SCALE, strategy=BALANCED | missing | P0 |

### setFormation(current, slots, formation?, strategy?)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| DFS-sf-001 | normal | 正常设置阵容 | 3个武将 | 返回更新后的DefenseFormation | missing | P0 |
| DFS-sf-002 | error | 空阵容 | slots全空 | 抛出Error('至少需要1名武将') | missing | P0 |
| DFS-sf-003 | error | 超过5个武将 | 6个武将 | 抛出Error('最多5名武将') | missing | P0 |
| DFS-sf-004 | boundary | 仅更新slots | 不传formation/strategy | 保持原阵型和策略 | missing | P1 |

### validateFormation(formation)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| DFS-vf-001 | normal | 合法阵容验证 | 3个武将+合法阵型+合法策略 | valid=true, errors=[] | missing | P0 |
| DFS-vf-002 | error | 阵位数量不对 | slots.length≠5 | valid=false, 含错误提示 | missing | P0 |
| DFS-vf-003 | error | 重复武将 | 两个相同heroId | valid=false, '武将不能重复' | missing | P0 |
| DFS-vf-004 | error | 无效阵型 | formation='INVALID' | valid=false, '无效的阵型' | missing | P0 |
| DFS-vf-005 | error | 无效策略 | strategy='INVALID' | valid=false, '无效的AI策略' | missing | P0 |
| DFS-vf-006 | error | 空阵容 | 全空slots | valid=false, '至少需要1名武将' | missing | P0 |

### createSnapshot(formation)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| DFS-cs-001 | normal | 创建快照 | 正常阵容 | 返回DefenseSnapshot，slots为副本 | missing | P0 |
| DFS-cs-002 | lifecycle | 快照与原阵容独立 | 修改原阵容 | 快照不变 | missing | P1 |

### addDefenseLog / getDefenseStats

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| DFS-adl-001 | normal | 添加日志 | 正常entry | 列表增长，最新在前 | missing | P0 |
| DFS-adl-002 | boundary | 日志上限50条 | 已有50条 | 添加后仍为50条 | missing | P0 |
| DFS-gds-001 | normal | 胜率<30%建议坚守 | 2胜8负(≥5场) | suggestedStrategy=DEFENSIVE | missing | P0 |
| DFS-gds-002 | normal | 胜率30~50%建议均衡 | 3胜5负(≥5场) | suggestedStrategy=BALANCED | missing | P0 |
| DFS-gds-003 | normal | 胜率>50%不建议 | 6胜4负 | suggestedStrategy=null | missing | P0 |
| DFS-gds-004 | boundary | 不足5场不建议 | 2胜0负(2场) | suggestedStrategy=null | missing | P0 |
| DFS-gds-005 | boundary | 空日志 | logs=[] | totalDefenses=0, winRate=0 | missing | P1 |

### getRecentLogs / getLogsByAttacker

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| DFS-grl-001 | normal | 获取最近N条 | 20条日志, count=10 | 返回前10条 | missing | P1 |
| DFS-gla-001 | normal | 按进攻方筛选 | 同一进攻方多次 | 只返回该进攻方的记录 | missing | P1 |

### serialize / deserialize

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| DFS-ser-001 | normal | 序列化防守数据 | 有日志和阵容 | 返回{defenseFormation, defenseLogs} | missing | P0 |
| DFS-ser-002 | normal | 反序列化恢复 | 有效数据 | 数据完全恢复 | missing | P0 |
| DFS-ser-003 | error | null数据反序列化 | data.defenseFormation=null | 使用默认阵容 | missing | P1 |

---

## 5. ArenaSeasonSystem（赛季系统）

### createSeason(seasonId, startTime)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| ASS-cs-001 | normal | 创建28天赛季 | startTime=now | endTime=startTime+28天, currentDay=1, isSettled=false | missing | P0 |
| ASS-cs-002 | boundary | 赛季天数可配置 | seasonDays=14 | endTime=startTime+14天 | missing | P1 |

### getCurrentDay(season, now)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| ASS-gcd-001 | normal | 第1天 | now=startTime | 返回1 | missing | P0 |
| ASS-gcd-002 | normal | 第15天 | now=startTime+14天 | 返回15 | missing | P0 |
| ASS-gcd-003 | boundary | 超过赛季天数 | now=startTime+30天 | 返回28（上限） | missing | P0 |
| ASS-gcd-004 | boundary | 赛季开始前 | now < startTime | 返回1（下限） | missing | P1 |

### isSeasonEnded / isSeasonActive / getRemainingDays

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| ASS-ise-001 | normal | 赛季进行中 | now < endTime | isSeasonEnded=false | missing | P0 |
| ASS-ise-002 | normal | 赛季已结束 | now >= endTime | isSeasonEnded=true | missing | P0 |
| ASS-isa-001 | normal | 赛季活跃 | startTime <= now < endTime | isSeasonActive=true | missing | P0 |
| ASS-isa-002 | normal | 赛季未开始 | now < startTime | isSeasonActive=false | missing | P0 |
| ASS-grd-001 | normal | 剩余天数计算 | 还剩10天 | 返回10 | missing | P0 |
| ASS-grd-002 | boundary | 赛季已结束 | now >= endTime | 返回0 | missing | P0 |

### settleSeason(playerState, highestRankId)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| ASS-ss-001 | normal | 正常赛季结算 | rankId=SILVER_I, highestRankId=GOLD_V | score重置到当前段位最低值，奖励按最高段位发放 | missing | P0 |
| ASS-ss-002 | normal | 奖励发放 | highestRankId=KING_I | copper=100000, arenaCoin=2000, gold=500 | missing | P0 |
| ASS-ss-003 | normal | 积分重置 | rankId=SILVER_V(1500) | resetScore=1500（当前段位最低值） | missing | P0 |
| ASS-ss-004 | lifecycle | 结算后数据重置 | — | dailyChallengesLeft=5, replays=[], defenseLogs=[] | missing | P0 |
| ASS-ss-005 | boundary | 最低段位结算 | highestRankId=BRONZE_V | 按BRONZE_V奖励发放 | missing | P1 |

### updateHighestRank(currentHighest, newRankId)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| ASS-uhr-001 | normal | 更新最高段位 | BRONZE_V→SILVER_V | 返回SILVER_V | missing | P0 |
| ASS-uhr-002 | normal | 未超过最高 | BRONZE_I, new=BRONZE_III | 保持BRONZE_I | missing | P0 |
| ASS-uhr-003 | boundary | 相同段位 | BRONZE_V, new=BRONZE_V | 保持BRONZE_V | missing | P1 |

### grantDailyReward(playerState)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| ASS-gdr-001 | normal | 发放每日奖励 | rankId=SILVER_I | arenaCoins增加40 | missing | P0 |
| ASS-gdr-002 | boundary | 未知段位 | rankId='UNKNOWN' | 使用默认奖励{copper:500, arenaCoin:10, gold:5} | missing | P1 |

### buyArenaShopItem(playerState, cost)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| ASS-basi-001 | normal | 正常购买 | arenaCoins=500, cost=100 | 新arenaCoins=400 | missing | P0 |
| ASS-basi-002 | error | 竞技币不足 | arenaCoins=50, cost=100 | 抛出Error('竞技币不足') | missing | P0 |
| ASS-basi-003 | boundary | 恰好够 | arenaCoins=100, cost=100 | arenaCoins=0 | missing | P1 |

---

## 6. ArenaShopSystem（竞技商店系统）

### buyItem(playerState, itemId, count)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| ASShop-bi-001 | normal | 正常购买 | arenaCoins=500, itemId='fragment_liubei', count=1 | state.arenaCoins=400, item.purchased=1 | missing | P0 |
| ASShop-bi-002 | normal | 批量购买 | count=3 | totalCost=cost×3, purchased+3 | missing | P0 |
| ASShop-bi-003 | error | 商品不存在 | itemId='nonexistent' | 抛出Error('商品不存在') | missing | P0 |
| ASShop-bi-004 | error | 竞技币不足 | arenaCoins=10, cost=100 | 抛出Error('竞技币不足') | missing | P0 |
| ASShop-bi-005 | error | 超出周限购 | weeklyLimit=5, purchased=4, count=2 | 抛出Error('每周限购...') | missing | P0 |
| ASShop-bi-006 | error | 购买数量≤0 | count=0 | 抛出Error('购买数量必须大于0') | missing | P0 |
| ASShop-bi-007 | boundary | 无限购商品 | weeklyLimit=0 | 不限购数量 | missing | P0 |
| ASShop-bi-008 | boundary | 恰好限购上限 | weeklyLimit=5, purchased=4, count=1 | 成功购买 | missing | P1 |

### canBuy(playerState, itemId, count)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| ASShop-cb-001 | normal | 可以购买 | 条件满足 | canBuy=true | missing | P0 |
| ASShop-cb-002 | normal | 不满足条件 | 各种不满足 | canBuy=false, reason非空 | missing | P0 |

### weeklyReset()

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| ASShop-wr-001 | normal | 周重置 | 有已购记录 | 所有item.purchased=0 | missing | P0 |
| ASShop-wr-002 | lifecycle | 重置后可再次购买 | 重置后 | canBuy返回true | missing | P1 |

### serialize / deserialize

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| ASShop-ser-001 | normal | 序列化商店数据 | 有购买记录 | 返回ArenaShopSaveData含items | missing | P0 |
| ASShop-ser-002 | normal | 反序列化恢复 | version=1 | items数据恢复 | missing | P0 |
| ASShop-ser-003 | error | 版本不匹配 | version=99 | 不恢复 | missing | P1 |

---

## 7. ArenaSystem.helpers（辅助函数）

### selectByFactionBalance(candidates, count)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| ASH-sfb-001 | normal | 三阵营平衡选择 | 魏3蜀3吴3, count=3 | 每阵营各选1个 | missing | P0 |
| ASH-sfb-002 | normal | 两阵营选择 | 魏5蜀3, count=3 | 尽量交替选 | missing | P0 |
| ASH-sfb-003 | boundary | 候选人不足 | candidates=2, count=3 | 返回2个 | missing | P0 |
| ASH-sfb-004 | boundary | 候选人等于count | candidates=3, count=3 | 返回全部 | missing | P1 |

### calculatePower(playerState)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| ASH-cp-001 | normal | 正常战力计算 | score=1000, 3个武将 | power=1000×10+3×1000+5000=18000 | missing | P0 |
| ASH-cp-002 | boundary | 0积分0武将 | score=0, 0个武将 | power=5000 | missing | P0 |
| ASH-cp-003 | boundary | 5个武将满编 | score=5000, 5个武将 | power=5000×10+5×1000+5000=60000 | missing | P1 |

---

## 8. ArenaConfig（配置与工厂）

### createDefaultArenaPlayerState(playerId)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| AC-cdaps-001 | normal | 默认状态创建 | playerId='test' | score=0, rankId='BRONZE_V', dailyChallengesLeft=5 | missing | P0 |
| AC-cdaps-002 | boundary | 空playerId | playerId='' | 正常创建 | missing | P1 |
| AC-cdaps-003 | boundary | 不传playerId | 无参数 | playerId='' | missing | P1 |

### createDefaultDefenseFormation()

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| AC-cddf-001 | normal | 创建默认阵容 | — | slots=5空串, formation=FISH_SCALE, strategy=BALANCED | missing | P0 |

---

## 9. 跨系统交互

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| XI-001 | cross | ArenaSystem→PvPBattleSystem战斗链路 | 匹配→战斗→积分更新 | 全链路正确执行 | missing | P0 |
| XI-002 | cross | PvPBattleSystem→RankingSystem排名更新 | 战斗后积分变化 | 排行榜正确更新 | missing | P0 |
| XI-003 | cross | ArenaSystem→DefenseFormationSystem阵容同步 | 设置防守阵容 | ArenaSystem和DefenseFormation数据一致 | missing | P0 |
| XI-004 | cross | PvPBattleSystem→ArenaSeasonSystem段位联动 | 积分变化→段位变化→赛季结算 | 段位正确映射，赛季奖励正确 | missing | P0 |
| XI-005 | cross | ArenaShopSystem→ArenaPlayerState竞技币扣减 | 购买商品 | 竞技币正确扣减 | missing | P0 |
| XI-006 | cross | ArenaSeasonSystem.settleSeason→ArenaPlayerState重置 | 赛季结算 | 积分重置+每日数据重置+日志清理 | missing | P0 |
| XI-007 | cross | ArenaSystem.dailyReset→挑战次数恢复 | 每日重置 | 可再次挑战和购买 | missing | P0 |
| XI-008 | cross | ArenaShopSystem.weeklyReset→限购恢复 | 周重置 | 可再次购买限购商品 | missing | P0 |
| XI-009 | cross | 战斗胜利→积分增加→段位晋升→最高段位更新 | 连续胜利 | highestRankId正确追踪 | missing | P0 |
| XI-010 | cross | 战斗失败→积分减少→段位降级→排名变化 | 连续失败 | 段位和排名正确降级 | missing | P0 |
| XI-011 | cross | ArenaSystem.generateOpponents→calculatePower→战力匹配 | 匹配时 | 对手战力在0.7~1.3×范围内 | missing | P0 |
| XI-012 | cross | DefenseFormationSystem.validateFormation→ArenaSystem.updateDefenseFormation | 设置阵容 | 验证失败时ArenaSystem不更新 | missing | P0 |
| XI-013 | cross | PvPBattleSystem.executeBattle→saveReplay→cleanExpiredReplays | 战斗后 | 回放正确保存和清理 | missing | P1 |
| XI-014 | cross | RankingSystem.updateRanking→getNearbyPlayers→ArenaSystem匹配 | 排名→匹配 | 匹配使用正确的排名范围 | missing | P1 |
| XI-015 | cross | ArenaSeasonSystem.grantDailyReward→ArenaShopSystem购买 | 每日奖励→消费 | 奖励竞技币可用于购买 | missing | P1 |
| XI-016 | cross | ArenaSystem.serialize→deserialize→状态恢复 | 存档→读档 | 所有PvP状态完全恢复 | missing | P0 |
| XI-017 | cross | 多次战斗连续执行 | 连续executeBattle | 每次独立，积分累积正确 | missing | P0 |
| XI-018 | cross | 赛季结算→新赛季→战斗→积分重置后段位正确 | 赛季切换 | 新赛季从重置后段位开始 | missing | P0 |
| XI-019 | cross | 防守日志→策略建议→阵容调整→防守胜率变化 | 完整防守循环 | 策略建议合理 | missing | P1 |
| XI-020 | cross | ArenaSystem.registerPlayer→RankingSystem.updateRanking | 注册→排行 | 排行榜包含注册玩家 | missing | P1 |
| XI-021 | cross | buyChallenge→consumeChallenge→executeBattle完整链路 | 购买→消耗→战斗 | 全链路正确 | missing | P0 |
| XI-022 | cross | freeRefresh→generateOpponents→挑战→战斗 | 刷新→战斗 | 刷新后对手正确用于战斗 | missing | P0 |
| XI-023 | cross | ArenaConfig重复定义问题 | ArenaConfig与helpers同函数 | 两处createDefaultDefenseFormation行为一致 | missing | P0 |
| XI-024 | cross | PvPBattleSystem积分计算→ArenaSeasonSystem赛季结算积分重置 | 战斗→结算 | 结算重置到正确段位最低值 | missing | P0 |
| XI-025 | cross | ArenaShopSystem购买→ArenaSeasonSystem.buyArenaShopItem双重扣币 | 两系统都可扣币 | 两处扣币逻辑一致 | missing | P1 |
| XI-026 | cross | RankingSystem三维度数据独立 | 更新SCORE不影响POWER | 各维度数据隔离 | missing | P0 |
| XI-027 | cross | DefenseFormationSystem.addDefenseLog与ArenaSystem.addDefenseLog | 两处添加日志 | 两处逻辑一致 | missing | P1 |
| XI-028 | cross | ArenaSystem.deserialize→PvPBattleSystem.deserializeReplays | 存档恢复 | 回放数据正确恢复 | missing | P1 |
| XI-029 | cross | ArenaShopSystem.reset→weeklyReset | 系统重置 | 限购计数清零 | missing | P1 |
| XI-030 | cross | 赛季期间段位升降→highestRankId只升不降 | 多次战斗 | highestRankId始终为历史最高 | missing | P0 |

---

## 10. 数据生命周期

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| LC-001 | lifecycle | ArenaPlayerState完整生命周期 | 创建→战斗→结算→重置 | 每阶段状态正确 | missing | P0 |
| LC-002 | lifecycle | 每日重置周期 | 挑战消耗→重置→恢复 | dailyChallengesLeft恢复为5 | missing | P0 |
| LC-003 | lifecycle | 每周限购周期 | 购买→限购→周重置→可再购买 | purchased清零 | missing | P0 |
| LC-004 | lifecycle | 赛季完整周期 | 创建→进行→结算→新赛季 | 28天周期正确 | missing | P0 |
| LC-005 | lifecycle | 防守日志生命周期 | 添加→累积→上限截断→赛季结算清理 | 日志正确管理 | missing | P0 |
| LC-006 | lifecycle | 战斗回放生命周期 | 保存→累积→上限截断→过期清理 | 回放正确管理 | missing | P0 |
| LC-007 | lifecycle | 积分不可为负 | 连续失败 | score始终≥0 | missing | P0 |
| LC-008 | lifecycle | 段位与积分同步 | 积分变化 | rankId始终与score对应 | missing | P0 |
| LC-009 | lifecycle | 序列化→反序列化完整性 | 全状态序列化 | 反序列化后所有字段恢复 | missing | P0 |
| LC-010 | lifecycle | ArenaSystem.reset→所有子系统重置 | reset | playerPool清空，playerState默认 | missing | P0 |
| LC-011 | lifecycle | 多赛季连续执行 | 赛季1结算→赛季2开始 | 新赛季数据正确 | missing | P0 |
| LC-012 | lifecycle | 战斗结果→积分→段位→排名→奖励完整链路 | 一场战斗 | 端到端数据一致 | missing | P0 |
| LC-013 | lifecycle | 商店购买→竞技币减少→无法重复扣币 | 购买后 | 竞技币余额正确 | missing | P0 |
| LC-014 | lifecycle | 防守阵容快照→战斗使用→不受后续修改影响 | 快照后修改阵容 | 战斗使用快照数据 | missing | P1 |
| LC-015 | lifecycle | 排行榜缓存→过期→刷新→数据更新 | 缓存过期 | 刷新后数据正确 | missing | P1 |
| LC-016 | lifecycle | 玩家注册→匹配→战斗→排名更新完整链路 | 注册新玩家 | 全链路正确 | missing | P0 |
| LC-017 | lifecycle | 赛季结算→奖励发放→竞技币增加→商店可消费 | 赛季结算 | 端到端链路完整 | missing | P0 |
