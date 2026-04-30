# Hero（武将域）流程分支树 — Round 1

> Builder: TreeBuilder | Time: 2026-05-01 | Phase: 自进化对抗
> 源文件: hero/ 目录下 29 个 TypeScript 文件
> 产出: Part A (核心) + Part B (辅助) + Part C (编队配置)

## 总体统计

| 指标 | Part A | Part B | Part C | 合计 |
|------|--------|--------|--------|------|
| 源文件数 | 10 | 10 | 9 | 29 |
| 公开API数 | 118 | ~80 | ~60 | ~258 |
| 总节点数 | 245 | 257 | 243 | 745 |
| P0节点 | 72 | ~30 | ~17 | ~119 |
| P1节点 | 98 | ~50 | ~40 | ~188 |
| P2节点 | 75 | ~40 | ~30 | ~145 |

## 详细内容

完整流程分支树分为3个Part文件：

- **Part A（核心子系统）**: round-1-tree-partA.md — HeroSystem/HeroLevel/HeroStar/Serializer/Formation/Recruit/TokenEconomy
- **Part B（辅助子系统）**: round-1-tree-partB.md — Awakening/Bond/FactionBond/SkillUpgrade/Badge/AttributeCompare
- **Part C（编队配置）**: round-1-tree-partC.md — FormationRecommend/Dispatch/configs/types

## 关键发现汇总

### P0 高危发现
1. BondSystem vs FactionBondSystem 10个重叠风险节点（DEF-010升级）
2. HeroRecruitExecutor就地修改pity参数
3. TokenEconomy tick dt负值风险
4. FormationRecommendSystem null guard缺失
5. HeroDispatchSystem NaN/负值防护缺失

### 架构风险
1. BondSystem与FactionBondSystem双系统并存未统一
2. HeroSystem与HeroLevelSystem双路径需一致性验证
3. 日重置调用链依赖外部管理

### 可玩性关注
1. 编队动态上限缩减时超限编队处理
2. 招募保底机制跨会话持久性
3. 羁绊系统重叠计算影响战力平衡

## Rule Evolution Suggestions

### Builder规则更新
1. 增加就地修改参数检查规则
2. 增加update/dt负值检查规则
3. 增加双路径一致性规则
4. 增加日重置调用链验证规则
5. 增加编队上限缩减规则
6. 增加配置交叉验证规则
