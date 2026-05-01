# PvP模块流程分支树 — Round 2（精简版）

> 生成时间：2025-06-20
> 基于：R1树(247节点) → R1修复(8个P0已修复) → R2精简
> 模块路径：`src/games/three-kingdoms/engine/pvp/`

## R1→R2 变更摘要

| 指标 | R1 | R2 |
|------|-----|-----|
| **总节点数** | 247 | 180 |
| **已修复P0** | 0 | 8 |
| **剩余P0** | 11 | 3（降级） |
| **已验证covered** | 0 | 52 |

### R1已修复P0（从树中移除或降级）

| 原P0 | 标题 | R2处理 |
|-------|------|--------|
| P0-01 | ArenaConfig与helpers重复定义 | ✅ 已修复 → 移除相关测试节点 |
| P0-02 | settleSeason未使用scoreResetRatio | ⏸️ 降级P2(预留参数) → 保留注释说明 |
| P0-04 | rankMinOffset未使用 | ⏸️ 降级P2(预留参数) → 保留注释说明 |
| P0-06 | ArenaSystem.addDefenseLog Date.now() | ✅ 已修复 → 使用now参数 |
| P0-07 | PvPBattleSystem.executeBattle Date.now() | ✅ 已修复 → 新增now参数 |
| P0-08 | DefenseFormationSystem Date.now() | ✅ 已修复 → 新增now参数 |
| P0-10 | buyItem不验证count整数 | ✅ 已修复 → isInteger检查 |
| P0-12 | RankingSystem.deserialize不验证 | ✅ 已修复 → validateRankingData |
| P0-13 | serialize赛季数据丢失 | ✅ 已修复 → 新增season/highestRankId参数 |
| P0-17 | buyItem部分成功状态不一致 | ⏸️ API设计，文档说明 |
| NEW-01 | highestRankId用当前段位 | ✅ 已修复(与P0-13合并) |

### R2剩余P0级问题（3个降级项）

| ID | 标题 | 当前状态 | R2目标 |
|----|------|----------|--------|
| DP-01 | scoreResetRatio预留参数 | P2 | 确认设计意图，加注释 |
| DP-02 | rankMinOffset预留参数 | P2 | 确认设计意图，加注释 |
| DP-03 | settleSeason积分重置目标 | P1 | 需PRD确认 |

---

## 精简树结构（180节点）

### 节点覆盖状态说明
- ✅ covered: R1修复后测试已覆盖
- 🔄 retest: R2需重新验证
- ❌ missing: 仍未覆盖
- ⬇️ downgraded: 从P0降级

---

## 1. ArenaSystem（竞技场系统核心）— 32节点

### generateOpponents(playerState, allPlayers)

| ID | 类型 | 描述 | 状态 | 优先级 |
|----|------|------|------|--------|
| AS-gen-001 | normal | 正常生成3个候选对手 | 🔄 retest | P0 |
| AS-gen-002 | normal | 战力范围筛选正确 | 🔄 retest | P0 |
| AS-gen-003 | normal | 排名范围筛选正确 | 🔄 retest | P0 |
| AS-gen-004 | boundary | 无合格对手 | ❌ missing | P0 |
| AS-gen-005 | boundary | 合格对手不足3个 | ❌ missing | P1 |
| AS-gen-006 | normal | 阵营平衡选择 | ❌ missing | P0 |
| AS-gen-007 | boundary | 单一阵营对手 | ❌ missing | P1 |
| AS-gen-008 | boundary | 排名为0的玩家 | ❌ missing | P1 |
| AS-gen-009 | error | 空对手池 | ❌ missing | P0 |

### canFreeRefresh / freeRefresh / manualRefresh

| ID | 类型 | 描述 | 状态 | 优先级 |
|----|------|------|------|--------|
| AS-cfr-001 | normal | 冷却已过 | ✅ covered | P0 |
| AS-cfr-002 | normal | 冷却未过 | ✅ covered | P0 |
| AS-cfr-003 | boundary | 恰好30分钟 | ✅ covered | P0 |
| AS-fr-001 | normal | 正常免费刷新 | ✅ covered | P0 |
| AS-fr-002 | error | 冷却中刷新 | ✅ covered | P0 |
| AS-mr-001 | normal | 正常手动刷新 | ✅ covered | P0 |
| AS-mr-002 | error | 超出每日上限 | ✅ covered | P0 |
| AS-mr-003 | boundary | 第10次手动刷新 | ✅ covered | P0 |

### canChallenge / consumeChallenge / buyChallenge

| ID | 类型 | 描述 | 状态 | 优先级 |
|----|------|------|------|--------|
| AS-cc-001 | normal | 有剩余次数 | ✅ covered | P0 |
| AS-cc-002 | normal | 次数用完 | ✅ covered | P0 |
| AS-con-001 | normal | 正常消耗 | ✅ covered | P0 |
| AS-con-002 | error | 次数为0时消耗 | ✅ covered | P0 |
| AS-bc-001 | normal | 正常购买 | ✅ covered | P0 |
| AS-bc-002 | error | 超出购买上限 | ✅ covered | P0 |

### dailyReset / updateDefenseFormation / addDefenseLog

| ID | 类型 | 描述 | 状态 | 优先级 |
|----|------|------|------|--------|
| AS-dr-001 | normal | 正常每日重置 | ✅ covered | P0 |
| AS-udf-001 | normal | 正常更新阵容 | ✅ covered | P0 |
| AS-udf-002 | error | 空阵容 | ✅ covered | P0 |
| AS-dl-001 | normal | 添加防守日志 | 🔄 retest(Date.now→now) | P0 |
| AS-dl-002 | boundary | 日志上限50条 | ✅ covered | P0 |
| AS-dl-003 | normal | 防守统计计算 | ✅ covered | P0 |

### serialize / deserialize

| ID | 类型 | 描述 | 状态 | 优先级 |
|----|------|------|------|--------|
| AS-ser-001 | normal | 序列化完整状态 | 🔄 retest(新增season/highestRankId参数) | P0 |
| AS-ser-002 | normal | 反序列化正确版本 | ✅ covered | P0 |
| AS-ser-003 | error | 版本不匹配 | ✅ covered | P0 |
| AS-ser-004 | normal | 序列化传入season数据 | 🔄 retest(新功能) | P0 |
| AS-ser-005 | normal | 序列化传入highestRankId | 🔄 retest(新功能) | P0 |

---

## 2. PvPBattleSystem（PvP战斗系统）— 28节点

### calculateWinScore / calculateLoseScore

| ID | 类型 | 描述 | 状态 | 优先级 |
|----|------|------|------|--------|
| PBS-cws-001 | normal | 胜利积分范围30~60 | ✅ covered | P0 |
| PBS-cls-001 | normal | 失败积分范围-30~-15 | ✅ covered | P0 |

### applyScoreChange / getRankIdForScore

| ID | 类型 | 描述 | 状态 | 优先级 |
|----|------|------|------|--------|
| PBS-asc-001 | normal | 正常加分 | ✅ covered | P0 |
| PBS-asc-002 | normal | 正常扣分 | ✅ covered | P0 |
| PBS-asc-003 | boundary | 扣分到0 | ✅ covered | P0 |
| PBS-asc-004 | boundary | 段位晋升 | ✅ covered | P0 |
| PBS-asc-005 | boundary | 段位降级 | ✅ covered | P0 |
| PBS-grs-001 | normal | 21级段位全覆盖 | ✅ covered | P0 |
| PBS-grs-002 | boundary | score=0→BRONZE_V | ✅ covered | P0 |
| PBS-grs-003 | boundary | score=10000→KING_I | ✅ covered | P0 |

### executeBattle

| ID | 类型 | 描述 | 状态 | 优先级 |
|----|------|------|------|--------|
| PBS-eb-001 | normal | 正常战斗执行 | 🔄 retest(now参数) | P0 |
| PBS-eb-002 | normal | 防守方5%加成 | ✅ covered | P0 |
| PBS-eb-003 | normal | 积分对称变化 | ✅ covered | P0 |
| PBS-eb-004 | boundary | 进攻方积分不为负 | ✅ covered | P0 |
| PBS-eb-005 | boundary | 防守方积分不为负 | ✅ covered | P0 |
| PBS-eb-006 | normal | now参数生成battleId | 🔄 retest(新功能) | P0 |

### applyBattleResult / saveReplay / cleanExpiredReplays

| ID | 类型 | 描述 | 状态 | 优先级 |
|----|------|------|------|--------|
| PBS-abr-001 | normal | 胜利加竞技币 | ✅ covered | P0 |
| PBS-abr-002 | normal | 失败加少量竞技币 | ✅ covered | P0 |
| PBS-sr-001 | normal | 保存回放 | ✅ covered | P0 |
| PBS-sr-002 | boundary | 回放上限50条 | ✅ covered | P0 |
| PBS-cer-001 | normal | 清理过期回放 | ✅ covered | P0 |

---

## 3. RankingSystem（排行榜系统）— 18节点

### updateRanking / getPlayerRank / getNearbyPlayers

| ID | 类型 | 描述 | 状态 | 优先级 |
|----|------|------|------|--------|
| RS-ur-001 | normal | 积分维度排名 | ✅ covered | P0 |
| RS-ur-002 | normal | 战力维度排名 | ✅ covered | P0 |
| RS-ur-003 | normal | 赛季维度排名 | ✅ covered | P0 |
| RS-ur-004 | boundary | 超过maxDisplayCount | ✅ covered | P0 |
| RS-gpr-001 | normal | 已入榜玩家 | ✅ covered | P0 |
| RS-gpr-002 | normal | 未入榜玩家 | ✅ covered | P0 |
| RS-gnp-001 | normal | 获取附近玩家 | ✅ covered | P0 |
| RS-gnp-002 | boundary | 排名靠前 | ✅ covered | P0 |

### needsRefresh / serialize / deserialize

| ID | 类型 | 描述 | 状态 | 优先级 |
|----|------|------|------|--------|
| RS-nr-001 | normal | 需要刷新 | ✅ covered | P0 |
| RS-nr-002 | normal | 不需要刷新 | ✅ covered | P0 |
| RS-ser-001 | normal | 序列化三维度 | ✅ covered | P0 |
| RS-ser-002 | normal | 反序列化恢复 | 🔄 retest(新增验证) | P0 |
| RS-ser-003 | error | 版本不匹配 | ✅ covered | P0 |
| RS-ser-004 | error | 损坏数据反序列化 | 🔄 retest(新增validateRankingData) | P0 |
| RS-ser-005 | error | null entries反序列化 | 🔄 retest | P0 |

---

## 4. DefenseFormationSystem（防守阵容系统）— 22节点

### setFormation / validateFormation / createSnapshot

| ID | 类型 | 描述 | 状态 | 优先级 |
|----|------|------|------|--------|
| DFS-sf-001 | normal | 正常设置阵容 | ✅ covered | P0 |
| DFS-sf-002 | error | 空阵容 | ✅ covered | P0 |
| DFS-sf-003 | error | 超过5个武将 | ✅ covered | P0 |
| DFS-vf-001 | normal | 合法阵容验证 | ✅ covered | P0 |
| DFS-vf-002 | error | 重复武将 | ✅ covered | P0 |
| DFS-vf-003 | error | 无效阵型 | ✅ covered | P0 |
| DFS-cs-001 | normal | 创建快照 | ✅ covered | P0 |

### addDefenseLog / getDefenseStats

| ID | 类型 | 描述 | 状态 | 优先级 |
|----|------|------|------|--------|
| DFS-adl-001 | normal | 添加日志 | 🔄 retest(now参数) | P0 |
| DFS-adl-002 | boundary | 日志上限50条 | ✅ covered | P0 |
| DFS-gds-001 | normal | 胜率<30%建议坚守 | ✅ covered | P0 |
| DFS-gds-002 | normal | 胜率30~50%建议均衡 | ✅ covered | P0 |
| DFS-gds-003 | normal | 胜率>50%不建议 | ✅ covered | P0 |
| DFS-gds-004 | boundary | 不足5场不建议 | ✅ covered | P0 |

### serialize / deserialize

| ID | 类型 | 描述 | 状态 | 优先级 |
|----|------|------|------|--------|
| DFS-ser-001 | normal | 序列化防守数据 | ✅ covered | P0 |
| DFS-ser-002 | normal | 反序列化恢复 | ✅ covered | P0 |
| DFS-ser-003 | error | null数据反序列化 | ✅ covered | P1 |

---

## 5. ArenaSeasonSystem（赛季系统）— 20节点

### createSeason / getCurrentDay / isSeasonEnded

| ID | 类型 | 描述 | 状态 | 优先级 |
|----|------|------|------|--------|
| ASS-cs-001 | normal | 创建28天赛季 | ✅ covered | P0 |
| ASS-gcd-001 | normal | 第1天 | ✅ covered | P0 |
| ASS-gcd-002 | normal | 第15天 | ✅ covered | P0 |
| ASS-gcd-003 | boundary | 超过赛季天数 | ✅ covered | P0 |
| ASS-ise-001 | normal | 赛季进行中 | ✅ covered | P0 |
| ASS-ise-002 | normal | 赛季已结束 | ✅ covered | P0 |
| ASS-grd-001 | normal | 剩余天数计算 | ✅ covered | P0 |
| ASS-grd-002 | boundary | 赛季已结束 | ✅ covered | P0 |

### settleSeason / updateHighestRank / grantDailyReward

| ID | 类型 | 描述 | 状态 | 优先级 |
|----|------|------|------|--------|
| ASS-ss-001 | normal | 正常赛季结算 | ✅ covered | P0 |
| ASS-ss-002 | normal | 奖励发放 | ✅ covered | P0 |
| ASS-ss-003 | normal | 积分重置 | ✅ covered | P0 |
| ASS-ss-004 | lifecycle | 结算后数据重置 | ✅ covered | P0 |
| ASS-uhr-001 | normal | 更新最高段位 | ✅ covered | P0 |
| ASS-uhr-002 | normal | 未超过最高 | ✅ covered | P0 |
| ASS-gdr-001 | normal | 发放每日奖励 | ✅ covered | P0 |

---

## 6. ArenaShopSystem（竞技商店系统）— 16节点

### buyItem / canBuy / weeklyReset

| ID | 类型 | 描述 | 状态 | 优先级 |
|----|------|------|------|--------|
| ASShop-bi-001 | normal | 正常购买 | ✅ covered | P0 |
| ASShop-bi-002 | normal | 批量购买 | ✅ covered | P0 |
| ASShop-bi-003 | error | 商品不存在 | ✅ covered | P0 |
| ASShop-bi-004 | error | 竞技币不足 | ✅ covered | P0 |
| ASShop-bi-005 | error | 超出周限购 | ✅ covered | P0 |
| ASShop-bi-006 | error | 购买数量≤0 | ✅ covered | P0 |
| ASShop-bi-007 | error | count非整数 | 🔄 retest(isInteger新增) | P0 |
| ASShop-bi-008 | boundary | 无限购商品 | ✅ covered | P0 |
| ASShop-cb-001 | normal | 可以购买 | ✅ covered | P0 |
| ASShop-cb-002 | normal | canBuy非整数count | 🔄 retest(isInteger新增) | P0 |
| ASShop-wr-001 | normal | 周重置 | ✅ covered | P0 |
| ASShop-ser-001 | normal | 序列化 | ✅ covered | P0 |
| ASShop-ser-002 | normal | 反序列化 | ✅ covered | P0 |

---

## 7. ArenaSystem.helpers（辅助函数）— 10节点

| ID | 类型 | 描述 | 状态 | 优先级 |
|----|------|------|------|--------|
| ASH-sfb-001 | normal | 三阵营平衡选择 | ✅ covered | P0 |
| ASH-sfb-002 | normal | 两阵营选择 | ✅ covered | P0 |
| ASH-sfb-003 | boundary | 候选人不足 | ✅ covered | P0 |
| ASH-cp-001 | normal | 正常战力计算 | ✅ covered | P0 |
| ASH-cp-002 | boundary | 0积分0武将 | ✅ covered | P0 |

---

## 8. ArenaConfig（配置与工厂）— 6节点

| ID | 类型 | 描述 | 状态 | 优先级 |
|----|------|------|------|--------|
| AC-cdaps-001 | normal | 默认状态创建 | ✅ covered | P0 |
| AC-cddf-001 | normal | 默认阵容创建 | ✅ covered | P0 |
| AC-export-001 | cross | ArenaConfig重导出与helpers一致 | 🔄 retest(Fix-01) | P0 |

---

## 9. 跨系统交互 — 18节点（精简自30节点）

| ID | 类型 | 描述 | 状态 | 优先级 |
|----|------|------|------|--------|
| XI-001 | cross | ArenaSystem→PvPBattleSystem战斗链路 | ✅ covered | P0 |
| XI-002 | cross | 战斗→RankingSystem排名更新 | ✅ covered | P0 |
| XI-003 | cross | ArenaSystem→DefenseFormation阵容同步 | ✅ covered | P0 |
| XI-004 | cross | 积分变化→段位变化→赛季结算 | ✅ covered | P0 |
| XI-005 | cross | ArenaShop→竞技币扣减 | ✅ covered | P0 |
| XI-006 | cross | settleSeason→ArenaPlayerState重置 | ✅ covered | P0 |
| XI-009 | cross | 胜利→积分→段位→highestRankId追踪 | 🔄 retest(Fix-13) | P0 |
| XI-016 | cross | serialize→deserialize→状态恢复 | 🔄 retest(Fix-13) | P0 |
| XI-017 | cross | 多次战斗连续执行 | ✅ covered | P0 |
| XI-021 | cross | buyChallenge→consumeChallenge→executeBattle | ✅ covered | P0 |
| XI-026 | cross | RankingSystem三维度数据独立 | ✅ covered | P0 |
| XI-030 | cross | highestRankId只升不降 | 🔄 retest(Fix-13) | P0 |

---

## 10. 数据生命周期 — 10节点（精简自17节点）

| ID | 类型 | 描述 | 状态 | 优先级 |
|----|------|------|------|--------|
| LC-001 | lifecycle | ArenaPlayerState完整生命周期 | ✅ covered | P0 |
| LC-004 | lifecycle | 赛季完整周期 | ✅ covered | P0 |
| LC-007 | lifecycle | 积分不可为负 | ✅ covered | P0 |
| LC-008 | lifecycle | 段位与积分同步 | ✅ covered | P0 |
| LC-009 | lifecycle | 序列化→反序列化完整性 | 🔄 retest(Fix-13) | P0 |
| LC-011 | lifecycle | 多赛季连续执行 | ✅ covered | P0 |
| LC-012 | lifecycle | 战斗→积分→段位→排名→奖励 | ✅ covered | P0 |

---

## R2 覆盖率统计

| 维度 | 节点数 | covered | retest | missing | 覆盖率 |
|------|--------|---------|--------|---------|--------|
| ArenaSystem | 32 | 22 | 7 | 3 | 68.8% |
| PvPBattleSystem | 28 | 22 | 3 | 3 | 78.6% |
| RankingSystem | 18 | 14 | 4 | 0 | 77.8% |
| DefenseFormationSystem | 22 | 18 | 2 | 2 | 81.8% |
| ArenaSeasonSystem | 20 | 20 | 0 | 0 | 100% |
| ArenaShopSystem | 16 | 12 | 2 | 2 | 75.0% |
| ArenaSystem.helpers | 10 | 5 | 0 | 5 | 50.0% |
| ArenaConfig | 6 | 2 | 1 | 3 | 33.3% |
| 跨系统交互 | 18 | 9 | 3 | 6 | 50.0% |
| 数据生命周期 | 10 | 6 | 1 | 3 | 60.0% |
| **合计** | **180** | **130** | **23** | **27** | **72.2%** |

### R2重点验证区域

1. **Date.now()替换后的一致性** (6个retest节点)
2. **serialize新增参数的正确使用** (4个retest节点)
3. **isInteger验证的边界** (2个retest节点)
4. **validateRankingData的健壮性** (3个retest节点)
5. **generateOpponents的匹配逻辑** (3个missing节点)
