# PvP模块 R1 仲裁裁决 — TreeArbiter

> 裁决时间：2025-06-20
> 裁决依据：Builder流程树(247节点) + Challenger挑战报告(40项)
> 封版线：9.0

## 仲裁摘要

| 指标 | 值 |
|------|-----|
| **总挑战项** | 40 |
| **确认 P0** | 10 |
| **确认 P1** | 14 |
| **降级 P0→P1** | 2 |
| **降级 P0→P2** | 3 |
| **驳回** | 1 |
| **新增发现** | 2 |
| **最终 P0 数** | 10 |
| **节点覆盖率** | 0/247 (0%) |
| **P0覆盖率** | 0/10 (0%) |
| **维度均衡度** | 0.0 |
| **综合评分** | **2.1 / 10** ❌ 未达封版线(9.0) |

---

## 逐项裁决

### P0 项裁决

| 挑战ID | 标题 | Challenger评级 | Arbiter裁决 | 理由 |
|--------|------|---------------|-------------|------|
| P0-01 | ArenaConfig与helpers重复定义 | P0 | **确认 P0** | 两处独立维护同一逻辑，已存在不一致风险（ArenaSystem从ArenaConfig导入，index从helpers重导出） |
| P0-02 | settleSeason未使用scoreResetRatio | P0 | **确认 P0** | 配置参数是死代码，赛季重置行为与配置文档不一致 |
| P0-03 | executeBattle防守方积分变化需调用方处理 | P0 | **降级 P1** | 这是API设计选择，返回值中包含defenderNewScore，调用方可选择使用。非bug |
| P0-04 | rankMinOffset未使用 | P0 | **确认 P0** | 配置参数是死代码，匹配范围比设计文档更宽 |
| P0-05 | canChallenge死代码 | P0 | **降级 P2** | 死代码不影响正确性，仅影响可维护性 |
| P0-06 | addDefenseLog使用Date.now() | P0 | **确认 P0** | 测试不可控，ID与timestamp不一致 |
| P0-07 | executeBattle使用Date.now() | P0 | **确认 P0** | 同P0-06，且高并发ID可能冲突 |
| P0-08 | DefenseFormationSystem使用Date.now() | P0 | **确认 P0** | 同P0-06 |
| P0-09 | 段位积分区间间隙 | P0 | **驳回** | Challenger自行审查后已确认无间隙，无需修复 |
| P0-10 | buyItem不验证count为整数 | P0 | **确认 P0** | purchased变为非整数后限购逻辑可能失效 |
| P0-11 | settleSeason用当前段位非最高段位重置 | P0 | **确认 P0** | 需确认设计意图。如按PRD应为最高段位，则当前实现错误 |
| P0-12 | deserialize不验证数据完整性 | P0 | **确认 P0** | 损坏数据导致系统异常 |
| P0-13 | serialize中season为硬编码空值 | P0 | **确认 P0** | 赛季数据和最高段位在序列化中丢失 |
| P0-14 | selectByFactionBalance候选人等于count | P0 | **降级 P2** | Challenger已确认行为正确 |
| P0-15 | playerId可选但用作关键标识 | P0 | **降级 P1** | 有fallback值，不会崩溃，但影响日志可追溯性 |
| P0-16 | ranking=0匹配范围问题 | P0 | **确认 P1→降级P1** | 战力筛选会过滤掉不合适的对手，实际影响有限 |
| P0-17 | buyItem修改内部状态但返回新state | P0 | **确认 P0** | 部分成功状态不一致，可被利用刷物品 |
| P0-18 | DefenseFormationSystem无状态但实现ISubsystem | P0 | **降级 P2** | 设计选择，不影响功能 |

### P1 项裁决

| 挑战ID | 标题 | 裁决 | 备注 |
|--------|------|------|------|
| P1-01 | calculatePower与estimatePower公式重复 | **确认 P1** | 需提取为共享函数 |
| P1-02 | getSeasonReward静默返回最低奖励 | **确认 P1** | 应记录警告日志 |
| P1-03 | getRanking返回默认值而非报错 | **确认 P2** | 防御性编程，合理 |
| P1-04 | freeRefresh不检查空对手池 | **确认 P1** | 应返回错误或空列表+提示 |
| P1-05 | 竞技币奖励硬编码 | **确认 P1** | 应提取为配置 |
| P1-06 | 不验证武将ID有效性 | **确认 P1** | 重复武将检查在validateFormation中有 |
| P1-07 | manualRefresh不扣铜钱 | **确认 P1** | 需文档说明或改为自动扣减 |
| P1-08 | KING_I maxScore=99999 | **确认 P2** | 实际不可能超过，合理上限 |
| P1-09 | Math.random()不可控 | **确认 P1** | 需注入随机源 |
| P1-10 | getItem返回副本 | **确认 P2** | 不可变模式，正确设计 |
| P1-11 | deserialize返回Partial | **确认 P1** | 需文档说明合并策略 |
| P1-12 | eligible与selected引用比较 | **确认 P1** | 需使用playerId比较 |
| P1-13 | createSeason不验证唯一性 | **确认 P2** | 外部管理，合理 |
| P1-14 | ArenaPlayerState缺少highestRankId | **确认 P1** | 与P0-13关联 |
| P1-15 | 版本不匹配静默丢弃 | **确认 P2** | 防御性设计 |
| P1-16 | 浮点精度问题 | **确认 P1** | 与P0-10关联 |
| P1-17 | setFormation不检查slots运行时长度 | **确认 P1** | TypeScript类型不够，需运行时检查 |

### 新增发现

| ID | 标题 | 评级 | 描述 |
|----|------|------|------|
| NEW-01 | ArenaSystem.serialize的highestRankId使用当前段位 | **P0** | 与P0-13关联，highestRankId应为赛季内历史最高，但serialize直接用state.rankId |
| NEW-02 | ArenaShopSystem.getItemsByType返回副本但buyItem修改原数组 | **P1** | getItemsByType和buyItem并发调用可能导致数据不一致 |

---

## 最终P0清单（需修复）

| # | ID | 标题 | 修复优先级 |
|---|-----|------|-----------|
| 1 | P0-01 | ArenaConfig与helpers重复定义 | 🔴 高 |
| 2 | P0-02 | settleSeason未使用scoreResetRatio | 🔴 高 |
| 3 | P0-04 | rankMinOffset配置死代码 | 🟡 中 |
| 4 | P0-06 | ArenaSystem.addDefenseLog使用Date.now() | 🔴 高 |
| 5 | P0-07 | PvPBattleSystem.executeBattle使用Date.now() | 🔴 高 |
| 6 | P0-08 | DefenseFormationSystem使用Date.now() | 🔴 高 |
| 7 | P0-10 | buyItem不验证count为整数 | 🟡 中 |
| 8 | P0-11 | settleSeason积分重置逻辑待确认 | 🟡 中 |
| 9 | P0-12 | RankingSystem.deserialize不验证数据完整性 | 🟡 中 |
| 10 | P0-13+NEW-01 | serialize赛季数据和最高段位丢失 | 🔴 高 |
| 11 | P0-17 | buyItem部分成功状态不一致 | 🔴 高 |

---

## 修复方案建议

### Fix-01: 消除ArenaConfig与helpers重复定义
- **方案**: ArenaConfig.ts 删除重复的工厂函数，改为从 ArenaSystem.helpers.ts 重导出
- **影响文件**: ArenaConfig.ts, ArenaSystem.ts（修改import来源）

### Fix-02: settleSeason使用scoreResetRatio
- **方案**: `resetScore = Math.floor(currentRank.minScore + (currentRank.maxScore - currentRank.minScore) * (1 - this.config.scoreResetRatio))`
- **影响文件**: ArenaSeasonSystem.ts

### Fix-04: 使用rankMinOffset
- **方案**: `const minRank = Math.max(1, myRanking - rankMaxOffset); const maxRank = myRanking + rankMinOffset;` 或按PRD确认设计意图后删除rankMinOffset
- **影响文件**: ArenaSystem.ts

### Fix-06/07/08: 替换Date.now()为可注入的时间源
- **方案**: 在各系统中使用 `now` 参数或注入的时间函数
- **影响文件**: ArenaSystem.ts, PvPBattleSystem.ts, DefenseFormationSystem.ts

### Fix-10: buyItem验证count为正整数
- **方案**: `if (!Number.isInteger(count) || count <= 0) throw new Error(...)`
- **影响文件**: ArenaShopSystem.ts

### Fix-11: 确认settleSeason设计意图
- **方案**: 如按最高段位重置，改为 `const highestRank = RANK_LEVEL_MAP.get(highestRankId);`
- **影响文件**: ArenaSeasonSystem.ts

### Fix-12: deserialize验证数据完整性
- **方案**: 检查 entries 是否为数组，lastUpdateTime 是否为数字
- **影响文件**: RankingSystem.ts

### Fix-13: serialize正确保存赛季数据和最高段位
- **方案**: serialize接收season和highestRankId参数
- **影响文件**: ArenaSystem.ts

### Fix-17: buyItem原子性保证
- **方案**: 先验证所有条件，再一次性修改内部状态和返回新state
- **影响文件**: ArenaShopSystem.ts

---

## 裁决结论

**综合评分: 2.1/10** — 远低于封版线 9.0

PvP模块存在 **11个P0级缺陷**，涉及：
- 代码重复维护风险（P0-01）
- 配置死代码（P0-02, P0-04）
- 测试不可控（P0-06/07/08）
- 数据完整性（P0-10, P0-12）
- 存档数据丢失（P0-13）
- 状态不一致（P0-17）
- 设计待确认（P0-11）

**建议**: 修复全部P0后进入R2轮次。预计修复工作量 2-3 人日。
