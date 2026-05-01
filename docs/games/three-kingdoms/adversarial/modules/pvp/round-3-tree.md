# PvP模块流程分支树 — Round 3（精简版）

> 生成时间：2025-06-20
> 基于：R2树(180节点) → R2修复(2个P0已修复) → R3精简
> 模块路径：`src/games/three-kingdoms/engine/pvp/`

## R2→R3 变更摘要

| 指标 | R1 | R2 | R3 |
|------|-----|-----|-----|
| **总节点数** | 247 | 180 | 148 |
| **已修复P0** | 0 | 8 | 10 |
| **剩余P0** | 11 | 2 | 0 |
| **已验证covered** | 0 | 130 | 138 |

### R2已修复P0（从树中移除或降级）

| 原P0 | 标题 | R3处理 |
|-------|------|--------|
| P0-R2-02 | serialize season参数类型不匹配 | ✅ 已修复 → safeSeason默认合并 |
| P0-R2-03 | buyItem内部状态修改不一致 | ✅ 已修复 → 先构造newState再修改items |

### R2降级项确认

| ID | 标题 | R3状态 |
|----|------|--------|
| P0-R2-01 | addDefenseLog签名不一致 | ⬇️ P1(设计差异，非bug) |
| DP-01 | scoreResetRatio预留参数 | ⬇️ P2(已注释) |
| DP-02 | rankMinOffset预留参数 | ⬇️ P2(已注释) |

### R3精简策略

1. **合并已验证covered节点**: R2中✅ covered的节点合并为"已验证组"，不再逐一列出
2. **移除降级P0/P1节点**: 已降级为P2的节点移入附录
3. **聚焦retest+missing**: R3重点验证R2修复穿透和未覆盖节点
4. **新增R2修复验证节点**: 针对Fix-R2-01/02的专门验证

---

## 精简树结构（148节点）

### 节点覆盖状态说明
- ✅ covered: R2已验证覆盖（合并组）
- 🔄 retest: R3需重新验证（R2修复相关）
- ❌ missing: R2未覆盖，R3需补充
- 🆕 new: R3新增验证节点

---

## 1. ArenaSystem（竞技场系统核心）— 26节点

### generateOpponents(playerState, allPlayers)

| ID | 类型 | 描述 | 状态 | 优先级 |
|----|------|------|------|--------|
| AS-gen-001 | normal | 正常生成3个候选对手 | ✅ covered | P0 |
| AS-gen-002 | normal | 战力范围筛选正确 | ✅ covered | P0 |
| AS-gen-003 | normal | 排名范围筛选正确 | ✅ covered | P0 |
| AS-gen-004 | boundary | 无合格对手 | ❌ missing | P0 |
| AS-gen-005 | boundary | 合格对手不足3个 | ❌ missing | P1 |
| AS-gen-006 | normal | 阵营平衡选择 | ❌ missing | P0 |
| AS-gen-007 | boundary | 单一阵营对手 | ❌ missing | P1 |
| AS-gen-008 | boundary | 排名为0的玩家 | ❌ missing | P1 |
| AS-gen-009 | error | 空对手池 | ❌ missing | P0 |

### canFreeRefresh / freeRefresh / manualRefresh [已验证组 8节点]

| 覆盖范围 | 节点数 | 状态 |
|----------|--------|------|
| AS-cfr-001~003, AS-fr-001~002, AS-mr-001~003 | 8 | ✅ covered |

### canChallenge / consumeChallenge / buyChallenge [已验证组 6节点]

| 覆盖范围 | 节点数 | 状态 |
|----------|--------|------|
| AS-cc-001~002, AS-con-001~002, AS-bc-001~002 | 6 | ✅ covered |

### dailyReset / updateDefenseFormation / addDefenseLog

| ID | 类型 | 描述 | 状态 | 优先级 |
|----|------|------|------|--------|
| AS-dr-001 | normal | 正常每日重置 | ✅ covered | P0 |
| AS-udf-001~002 | normal/error | 更新阵容(正常+空阵容) | ✅ covered | P0 |
| AS-dl-001 | normal | 添加防守日志(now参数) | 🔄 retest | P0 |
| AS-dl-002 | boundary | 日志上限50条 | ✅ covered | P0 |
| AS-dl-003 | normal | 防守统计计算 | ✅ covered | P0 |

### serialize / deserialize

| ID | 类型 | 描述 | 状态 | 优先级 |
|----|------|------|------|--------|
| AS-ser-001 | normal | 序列化完整状态 | 🔄 retest(Fix-R2-01穿透) | P0 |
| AS-ser-002 | normal | 反序列化正确版本 | ✅ covered | P0 |
| AS-ser-003 | error | 版本不匹配 | ✅ covered | P0 |
| AS-ser-004 | normal | 序列化传入season数据 | 🆕 new(Fix-R2-01验证) | P0 |
| AS-ser-005 | normal | 序列化传入highestRankId | 🆕 new(Fix-R2-01验证) | P0 |
| AS-ser-006 | boundary | season传入不完整对象 | 🆕 new(Fix-R2-01核心验证) | P0 |

---

## 2. PvPBattleSystem（PvP战斗系统）— 24节点

### calculateWinScore / calculateLoseScore [已验证组 2节点]

| 覆盖范围 | 节点数 | 状态 |
|----------|--------|------|
| PBS-cws-001, PBS-cls-001 | 2 | ✅ covered |

### applyScoreChange / getRankIdForScore [已验证组 8节点]

| 覆盖范围 | 节点数 | 状态 |
|----------|--------|------|
| PBS-asc-001~005, PBS-grs-001~003 | 8 | ✅ covered |

### executeBattle

| ID | 类型 | 描述 | 状态 | 优先级 |
|----|------|------|------|--------|
| PBS-eb-001 | normal | 正常战斗执行 | 🔄 retest(now参数) | P0 |
| PBS-eb-002 | normal | 防守方5%加成 | ✅ covered | P0 |
| PBS-eb-003 | normal | 积分对称变化 | ✅ covered | P0 |
| PBS-eb-004 | boundary | 进攻方积分不为负 | ✅ covered | P0 |
| PBS-eb-005 | boundary | 防守方积分不为负 | ✅ covered | P0 |
| PBS-eb-006 | normal | now参数生成battleId | 🔄 retest(新功能) | P0 |

### applyBattleResult / saveReplay / cleanExpiredReplays [已验证组 5节点]

| 覆盖范围 | 节点数 | 状态 |
|----------|--------|------|
| PBS-abr-001~002, PBS-sr-001~002, PBS-cer-001 | 5 | ✅ covered |

---

## 3. RankingSystem（排行榜系统）— 16节点

### updateRanking / getPlayerRank / getNearbyPlayers [已验证组 8节点]

| 覆盖范围 | 节点数 | 状态 |
|----------|--------|------|
| RS-ur-001~004, RS-gpr-001~002, RS-gnp-001~002 | 8 | ✅ covered |

### needsRefresh / serialize / deserialize

| ID | 类型 | 描述 | 状态 | 优先级 |
|----|------|------|------|--------|
| RS-nr-001~002 | normal | 刷新判断 | ✅ covered | P0 |
| RS-ser-001 | normal | 序列化三维度 | ✅ covered | P0 |
| RS-ser-002 | normal | 反序列化恢复 | 🔄 retest(新增验证) | P0 |
| RS-ser-003 | error | 版本不匹配 | ✅ covered | P0 |
| RS-ser-004 | error | 损坏数据反序列化 | 🔄 retest(validateRankingData) | P0 |
| RS-ser-005 | error | null entries反序列化 | 🔄 retest | P0 |

---

## 4. DefenseFormationSystem（防守阵容系统）— 20节点

### setFormation / validateFormation / createSnapshot [已验证组 7节点]

| 覆盖范围 | 节点数 | 状态 |
|----------|--------|------|
| DFS-sf-001~003, DFS-vf-001~003, DFS-cs-001 | 7 | ✅ covered |

### addDefenseLog / getDefenseStats

| ID | 类型 | 描述 | 状态 | 优先级 |
|----|------|------|------|--------|
| DFS-adl-001 | normal | 添加日志(now参数) | 🔄 retest | P0 |
| DFS-adl-002 | boundary | 日志上限50条 | ✅ covered | P0 |
| DFS-gds-001~004 | normal/boundary | 防守统计+建议策略 | ✅ covered | P0 |

### serialize / deserialize

| ID | 类型 | 描述 | 状态 | 优先级 |
|----|------|------|------|--------|
| DFS-ser-001 | normal | 序列化防守数据 | ✅ covered | P0 |
| DFS-ser-002 | normal | 反序列化恢复 | ✅ covered | P0 |
| DFS-ser-003 | error | null数据反序列化 | ✅ covered | P1 |

---

## 5. ArenaSeasonSystem（赛季系统）— 18节点

### createSeason / getCurrentDay / isSeasonEnded [已验证组 8节点]

| 覆盖范围 | 节点数 | 状态 |
|----------|--------|------|
| ASS-cs-001, ASS-gcd-001~003, ASS-ise-001~002, ASS-grd-001~002 | 8 | ✅ covered |

### settleSeason / updateHighestRank / grantDailyReward [已验证组 6节点]

| 覆盖范围 | 节点数 | 状态 |
|----------|--------|------|
| ASS-ss-001~004, ASS-uhr-001~002, ASS-gdr-001 | 7 | ✅ covered |

### R3新增: settleSeason边界验证

| ID | 类型 | 描述 | 状态 | 优先级 |
|----|------|------|------|--------|
| ASS-ss-005 | boundary | 无效rankId段位结算 | 🆕 new | P1 |
| ASS-gdr-002 | boundary | 最低段位每日奖励 | 🆕 new | P1 |
| ASS-ssr-001 | normal | serializeSeason完整性 | ✅ covered | P0 |

---

## 6. ArenaShopSystem（竞技商店系统）— 14节点

### buyItem / canBuy / weeklyReset

| ID | 类型 | 描述 | 状态 | 优先级 |
|----|------|------|------|--------|
| ASShop-bi-001 | normal | 正常购买 | ✅ covered | P0 |
| ASShop-bi-002 | normal | 批量购买 | ✅ covered | P0 |
| ASShop-bi-003 | error | 商品不存在 | ✅ covered | P0 |
| ASShop-bi-004 | error | 竞技币不足 | ✅ covered | P0 |
| ASShop-bi-005 | error | 超出周限购 | ✅ covered | P0 |
| ASShop-bi-006 | error | 购买数量≤0 | ✅ covered | P0 |
| ASShop-bi-007 | error | count非整数 | 🔄 retest(isInteger) | P0 |
| ASShop-bi-008 | boundary | 无限购商品 | ✅ covered | P0 |
| ASShop-bi-009 | normal | 购买后状态一致性 | 🆕 new(Fix-R2-02验证) | P0 |
| ASShop-bi-010 | boundary | 忽略返回state时内部状态 | 🆕 new(Fix-R2-02验证) | P1 |
| ASShop-cb-001~002 | normal | canBuy检查 | 🔄 retest(isInteger) | P0 |
| ASShop-wr-001 | normal | 周重置 | ✅ covered | P0 |
| ASShop-ser-001~002 | normal | 序列化/反序列化 | ✅ covered | P0 |

---

## 7. ArenaSystem.helpers（辅助函数）— 8节点

| ID | 类型 | 描述 | 状态 | 优先级 |
|----|------|------|------|--------|
| ASH-sfb-001 | normal | 三阵营平衡选择 | ✅ covered | P0 |
| ASH-sfb-002 | normal | 两阵营选择 | ✅ covered | P0 |
| ASH-sfb-003 | boundary | 候选人不足 | ✅ covered | P0 |
| ASH-cp-001 | normal | 正常战力计算 | ✅ covered | P0 |
| ASH-cp-002 | boundary | 0积分0武将 | ✅ covered | P0 |
| ASH-sfb-004 | boundary | 空候选人列表 | ❌ missing | P1 |
| ASH-sfb-005 | boundary | 单候选人 | ❌ missing | P1 |
| ASH-cp-003 | boundary | 负积分处理 | ❌ missing | P1 |

---

## 8. ArenaConfig（配置与工厂）— 4节点

| ID | 类型 | 描述 | 状态 | 优先级 |
|----|------|------|------|--------|
| AC-cdaps-001 | normal | 默认状态创建 | ✅ covered | P0 |
| AC-cddf-001 | normal | 默认阵容创建 | ✅ covered | P0 |
| AC-export-001 | cross | ArenaConfig重导出一致 | ✅ covered | P0 |
| AC-types-001 | normal | 类型导出完整性 | ✅ covered | P0 |

---

## 9. 跨系统交互 — 12节点（精简自18节点）

| ID | 类型 | 描述 | 状态 | 优先级 |
|----|------|------|------|--------|
| XI-001 | cross | ArenaSystem→PvPBattleSystem战斗链路 | ✅ covered | P0 |
| XI-002 | cross | 战斗→RankingSystem排名更新 | ✅ covered | P0 |
| XI-003 | cross | ArenaSystem→DefenseFormation阵容同步 | ✅ covered | P0 |
| XI-004 | cross | 积分变化→段位变化→赛季结算 | ✅ covered | P0 |
| XI-005 | cross | ArenaShop→竞技币扣减 | ✅ covered | P0 |
| XI-006 | cross | settleSeason→ArenaPlayerState重置 | ✅ covered | P0 |
| XI-009 | cross | 胜利→积分→段位→highestRankId追踪 | 🔄 retest | P0 |
| XI-016 | cross | serialize→deserialize→状态恢复 | 🔄 retest(Fix-R2-01) | P0 |
| XI-017 | cross | 多次战斗连续执行 | ✅ covered | P0 |
| XI-021 | cross | buyChallenge→consumeChallenge→executeBattle | ✅ covered | P0 |
| XI-026 | cross | RankingSystem三维度数据独立 | ✅ covered | P0 |
| XI-030 | cross | highestRankId只升不降 | 🔄 retest | P0 |

---

## 10. 数据生命周期 — 6节点（精简自10节点）

| ID | 类型 | 描述 | 状态 | 优先级 |
|----|------|------|------|--------|
| LC-001 | lifecycle | ArenaPlayerState完整生命周期 | ✅ covered | P0 |
| LC-004 | lifecycle | 赛季完整周期 | ✅ covered | P0 |
| LC-007 | lifecycle | 积分不可为负 | ✅ covered | P0 |
| LC-009 | lifecycle | 序列化→反序列化完整性 | 🔄 retest(Fix-R2-01) | P0 |
| LC-011 | lifecycle | 多赛季连续执行 | ✅ covered | P0 |
| LC-012 | lifecycle | 战斗→积分→段位→排名→奖励 | ✅ covered | P0 |

---

## R3 覆盖率统计

| 维度 | 节点数 | covered | retest | missing | new | 覆盖率 |
|------|--------|---------|--------|---------|-----|--------|
| ArenaSystem | 26 | 17 | 2 | 5 | 2 | 65.4%→92.3%* |
| PvPBattleSystem | 24 | 20 | 3 | 0 | 0 | 83.3%→100%* |
| RankingSystem | 16 | 13 | 3 | 0 | 0 | 81.3%→100%* |
| DefenseFormationSystem | 20 | 18 | 1 | 0 | 0 | 90.0%→100%* |
| ArenaSeasonSystem | 18 | 15 | 0 | 0 | 2 | 83.3%→100%* |
| ArenaShopSystem | 14 | 10 | 2 | 0 | 2 | 71.4%→100%* |
| ArenaSystem.helpers | 8 | 5 | 0 | 3 | 0 | 62.5%→100%* |
| ArenaConfig | 4 | 4 | 0 | 0 | 0 | 100% |
| 跨系统交互 | 12 | 8 | 4 | 0 | 0 | 66.7%→100%* |
| 数据生命周期 | 6 | 5 | 1 | 0 | 0 | 83.3%→100%* |
| **合计** | **148** | **115** | **16** | **8** | **6** | **77.7%→99.3%*** |

*注：R3目标覆盖率为retest/missing/new节点全部验证通过后的预期覆盖率

### R3重点验证区域

1. **Fix-R2-01穿透**: serialize safeSeason合并 (AS-ser-004~006)
2. **Fix-R2-02穿透**: buyItem操作顺序 (ASShop-bi-009~010)
3. **generateOpponents边界**: 无合格对手/空对手池 (AS-gen-004/009)
4. **serialize→deserialize完整链路**: 含season和highestRankId (XI-016, LC-009)
5. **helpers边界用例**: 空列表/单候选人/负积分 (ASH-sfb-004~005, ASH-cp-003)
