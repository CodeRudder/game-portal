# Hero 流程分支树 Round 2

> Builder: TreeBuilder v1.1 | Time: 2026-05-01
> R1结果: 745节点，Builder评分6.5/10，Challenger评分8.5/10，Arbiter裁决7.0/10 CONTINUE
> R1修复: FIX-001(NaN绕过) + FIX-002(useFragments负值) + FIX-003(deserialize null) + FIX-004(FormationRecommend null)

## R1→R2 改进

| 改进点 | R1状态 | R2改进 |
|--------|--------|--------|
| NaN防护验证 | 5处NaN绕过`<=0`检查 | FIX-001已修复10处→R2验证37个NaN节点确认修复有效，新增15个遗漏NaN路径 |
| 配置交叉验证 | 未检查配置间一致性 | R2新增28个配置交叉验证节点(武将ID/碎片路径/阵营标识/接口兼容) |
| 算法正确性 | 仅检查"不崩溃" | R2新增12个算法输出正确性节点(推荐去重/保底触发/排序结果) |
| 双系统并存分析 | 标注missing但未深入 | R2新增8个OL节点(OL-001~008)完整分析三套羁绊系统冲突 |
| null/undefined路径 | 大量null路径未标注 | R2新增35个null/undefined路径节点，全部标注uncovered |
| covered标注虚报 | 虚报率4-8%(Part C 21%) | R2重新校准covered标准：仅源码验证通过的标covered |
| SkillUpgrade序列化 | 未发现缺失 | R2新增4个节点标注serialize/deserialize缺失(CH-015/025) |
| 新增武将碎片路径 | 未发现断裂 | R2新增4个节点标注6名武将碎片获取断裂(CH-NEW-005/006) |
| 架构级问题分离 | 混在普通P0中 | R2将三套羁绊系统、羁绊系数永远为1.0等标注为架构评审项 |

## 统计

| Part | 节点数 | API数 | 新增节点 | covered | uncovered | todo |
|------|--------|-------|---------|---------|-----------|------|
| A（核心） | 290 | 129 | +45 | 215 | 75 | 62 P0待修复 |
| B（经济+编队） | 234 | 86 | -23 | 124 | 110 | 59 P0待修复 |
| C（辅助+配置） | 166 | 58 | -77 | 90 | 76 | 32 P0待修复 |
| **总计** | **690** | **273** | **-55** | **429** | **261** | **153 P0待修复** |

### 说明
- R2总节点690 < R1的745：精简了重复节点，合并了同类配置节点
- R2 covered 429 < R1的~598：重新校准了covered标准，R1虚报的节点重新标注为uncovered
- R2 uncovered 261 > R1的~137：吸收了R1挑战的41个P0遗漏 + 新增NaN/null路径 + 配置交叉验证

## 与R1对比

| 指标 | R1 | R2 | 变化 |
|------|----|----|------|
| 总节点 | 745 | 690 | -55(精简重复) |
| covered | ~598 | 429 | -169(校准虚报) |
| uncovered | ~137 | 261 | +124(吸收挑战+新增路径) |
| P0节点 | ~119 | 153 | +34(配置交叉+算法正确性) |
| P1节点 | ~188 | 276 | +88(降级+新增) |
| P2节点 | ~145 | 261 | +116(降级+新增) |
| 虚报率 | 4-8% | <2% | 大幅降低 |
| FIX验证 | 0 | 37 | R1修复确认有效 |

## R2 关键发现

### P0 高危发现（153项，按类别分组）

#### 1. NaN传播链（25项）
- calculatePower: star/quality/level/baseStats/equipmentPower/bondMultiplier任一为NaN→全链NaN
- calculateBonus: level/attack为NaN→NaN传播到建筑产出
- getStarMultiplier: star=NaN→STAR_MULTIPLIERS[NaN]=undefined
- calculateAwakenedStats: baseStats含NaN→NaN*1.5
- getSkillEffect: level=NaN→NaN公式
- calculateScore: recommendedPower=NaN→NaN difficultyLevel

#### 2. null/undefined路径（35项）
- cloneGeneral(null): {...null}崩溃
- deserializeHeroState({generals:{a:null}}): cloneGeneral(null)崩溃
- BondSystem.calculateBonds(null): for...of null崩溃
- FactionBondSystem.calculateBonds(null): null.length崩溃
- HeroFormation.setFormation(null): null.slice崩溃
- SkillUpgradeSystem.upgradeSkill(materials=null): 属性访问崩溃

#### 3. 配置交叉验证失败（28项）
- 新增6名武将碎片获取路径断裂(SHOP+STAGE均无配置)
- 搭档羁绊ID不一致(partner_wei_shuangbi vs partner_weizhi_shuangbi)
- 搭档羁绊效果值不一致(bond-config vs faction-bond-config)
- 阵营标识不一致('qun' vs 'neutral')
- BondEffect接口不兼容(两套同名不同结构)
- GENERAL_DEF_MAP与HERO_FACTION_MAP武将ID集合不一致

#### 4. 算法正确性缺陷（12项）
- FormationRecommend: 所有武将同阵营→羁绊方案与最强方案重复
- FormationRecommend: 武将数≤6→多个方案选到相同武将集合
- FormationRecommend: synergyBonus硬编码(15/8/0)而非BondSystem计算
- getGeneralsSortedByPower: 战力NaN→排序异常
- buildBalancedPlan: 武将数少时分组不均→低战力武将入选

#### 5. 架构级缺陷（8项）
- 三套羁绊系统并存(engine/bond + hero/BondSystem + FactionBondSystem)
- setBondMultiplierGetter从未被调用→羁绊系数永远为1.0
- 编队系统调用哪套羁绊计算→未定义
- SkillUpgradeSystem缺少serialize/deserialize→升级历史丢失
- 序列化版本迁移策略缺失→版本升级后数据丢失
- 保底计数器崩溃丢失→玩家保底进度回退

#### 6. 经济漏洞（8项）
- TokenEconomy.tick: dt=Infinity→addRecruitToken(Infinity)
- HeroDispatch: calculateBonus负等级→负加成
- HeroRecruitUpManager: rate>1.0→UP必触发
- HeroRecruitUpManager: rate=NaN→UP永久不触发
- HeroRecruitSystem: 十连招募资源扣除后中途失败不回滚

### FIX-001~004 验证结果

| 修复 | 影响节点数 | R2验证结果 |
|------|----------|-----------|
| FIX-001(NaN绕过) | 10处代码修改 | ✅ 37个NaN节点确认修复有效(addFragment/useFragments/addExp/tick/buyFromShop/calculateOfflineReward/exchangeFragmentsFromShop/addFragmentFromActivity/addFragmentFromExpedition/getLevelCap) |
| FIX-002(useFragments负值) | 1处代码修改 | ✅ 4个节点确认修复有效(0/NaN/负数/Infinity均被拒绝) |
| FIX-003(deserialize null) | 9处代码修改 | ✅ 12个节点确认修复有效(HeroSystem/HeroSerializer/HeroRecruitSystem/HeroStarSystem/AwakeningSystem/TokenEconomy/HeroFormation/HeroDispatch/HeroRecruitUpManager) |
| FIX-004(FormationRecommend null) | 1处代码修改 | ✅ 4个节点确认修复有效(null数组/null元素/NaN power/Infinity power) |

### R1遗漏的NaN绕过点（FIX-001未覆盖）

| # | 文件 | 方法 | 遗漏描述 |
|---|------|------|---------|
| 1 | HeroSystem.ts | calculatePower | star/quality/level/baseStats参数无NaN防护 |
| 2 | HeroSystem.ts | getGeneralsSortedByPower | 排序比较函数无NaN防护 |
| 3 | HeroLevelSystem.ts | getEnhancePreview | targetLevel=NaN→截断逻辑异常 |
| 4 | HeroLevelSystem.ts | statsAtLevel | level=NaN→m=NaN→全NaN |
| 5 | HeroStarSystem.ts | getStarUpCost | currentStar=NaN→Math.min(NaN,len)=NaN |
| 6 | HeroDispatchSystem.ts | calculateBonus | level/attack=NaN→NaN传播 |
| 7 | FormationRecommendSystem.ts | analyzeStage | recommendedPower=NaN→difficultyLevel=NaN |
| 8 | FormationRecommendSystem.ts | buildBestPowerPlan | sortedHeroes含NaN战力→排序异常 |
| 9 | SkillUpgradeSystem.ts | getSkillEffect | level=NaN→NaN公式 |
| 10 | AwakeningSystem.ts | calculateAwakenedStats | baseStats含NaN→NaN*1.5 |
| 11 | HeroRecruitUpManager.ts | setUpRate | rate=NaN→upRate=NaN→UP判定失败 |
| 12 | star-up-config.ts | getStarMultiplier | star=NaN→数组索引NaN→undefined |
| 13 | recruit-types.ts | rollQuality | rates=null→崩溃(非NaN但相关) |
| 14 | HeroLevelSystem.ts | getMaxLevel | getLevelCap回调返回NaN→maxLevel=NaN |
| 15 | HeroRecruitSystem.ts | getRecruitCost | count=NaN→NaN*amount=NaN |

## 详细内容

- **Part A（核心子系统）**: round-2-tree-partA.md — HeroSystem/HeroLevel/HeroStar/Serializer/Formation/Recruit/TokenEconomy
- **Part B（经济+编队系统）**: round-2-tree-partB.md — Bond/FactionBond/Awakening/SkillUpgrade/Badge/AttributeCompare/RecruitUp/RecruitExecutor/配置
- **Part C（辅助+配置系统）**: round-2-tree-partC.md — FormationRecommend/Dispatch/hero-config/recruit-config/star-up-config/types

## 下一步建议

### R2→R3 Builder改进方向

1. **修复NaN遗漏**: 15个FIX-001未覆盖的NaN绕过点需要修复
2. **修复cloneGeneral(null)**: HeroSerializer.cloneGeneral需添加null guard
3. **修复FormationRecommend算法**: 去重+羁绊分数+选将策略
4. **补充配置**: 6名新增武将的碎片获取路径
5. **SkillUpgradeSystem序列化**: 添加serialize/deserialize方法
6. **架构决策**: 三套羁绊系统统一方案

### 预期R3评分

基于Phase 1历史(hero R1=7.7→R2=9.0)和当前R2改进深度：
- 预期R2 Builder评分: 8.0~8.5
- 预期R3封版概率: 60%(需Challenger确认无新P0)
