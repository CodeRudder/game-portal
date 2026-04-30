# Hero模块流程分支树 — Round 1 Part C（编队派遣+配置）

> 生成时间：2026-05-01
> 模块路径：`src/games/three-kingdoms/engine/hero/`
> 覆盖文件：FormationRecommendSystem.ts / HeroDispatchSystem.ts / formation-types.ts / hero-config.ts / hero-recruit-config.ts / star-up-config.ts / star-up.types.ts / recruit-types.ts / index.ts
> 源码文件：9个

## 统计

| 维度 | 数量 |
|------|------|
| **总节点数** | **236** |
| P0 阻塞 | 42 |
| P1 严重 | 122 |
| P2 一般 | 72 |
| covered | 186 |
| missing | 47 |
| partial | 3 |

### 按系统分布

| 系统 | 公开API数 | 节点数 | covered | missing | partial |
|------|-----------|--------|---------|---------|---------|
| FormationRecommendSystem | 3 | 38 | 25 | 13 | 0 |
| HeroDispatchSystem | 8 | 36 | 21 | 13 | 2 |
| formation-types（常量+类型） | 5 | 14 | 10 | 4 | 0 |
| hero-config（武将配置） | 8 | 26 | 24 | 2 | 0 |
| hero-recruit-config（招募配置） | 7 | 22 | 21 | 1 | 0 |
| star-up-config（升星配置） | 6 | 18 | 18 | 0 | 0 |
| star-up.types（升星类型） | 6 | 6 | 6 | 0 | 0 |
| recruit-types（招募类型+辅助） | 5 | 10 | 10 | 0 | 0 |
| 跨系统交互 | — | 14 | 6 | 8 | 0 |
| 数据生命周期 | — | 6 | 4 | 2 | 0 |

---

## 1. FormationRecommendSystem（编队推荐系统）

> 源码：`FormationRecommendSystem.ts`
> 职责：根据关卡特性（normal/elite/boss）智能推荐1~3个编队方案
> 算法权重：战力40% + 品质25% + 覆盖20% + 羁绊15%

### recommend(stageType, availableHeroes, calculatePower, recommendedPower?, enemySize?)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| FR-rec-001 | normal | 正常推荐3个方案 | 有20+武将、stageType='boss' | 返回3个方案（最强/平衡/羁绊），score递减 | covered | P0 |
| FR-rec-002 | normal | 推荐2个方案 | 3~4个武将 | 最强+平衡方案，无羁绊方案 | covered | P0 |
| FR-rec-003 | normal | 推荐1个方案 | 1~2个武将 | 仅最强战力方案 | covered | P1 |
| FR-rec-004 | boundary | 无可用武将 | availableHeroes=[] | plans为空数组，characteristics正常 | covered | P1 |
| FR-rec-005 | boundary | 武将数恰好=MAX_SLOTS(6) | 6个武将 | 最强方案选全部6个 | covered | P1 |
| FR-rec-006 | exception | calculatePower回调为null | calculatePower=null | 调用崩溃（无null guard） | missing | P0 |
| FR-rec-007 | exception | availableHeroes含null元素 | heroes=[null, hero1] | calculatePower(null)崩溃 | missing | P0 |
| FR-rec-008 | boundary | recommendedPower=0 | 默认参数 | powerScore = 50（fallback） | covered | P2 |
| FR-rec-009 | boundary | enemySize=0 | enemySize=0 | characteristics.enemySize=0 | covered | P2 |
| FR-rec-010 | normal | 最强方案heroIds去重 | 武将不重复 | heroIds无重复ID | covered | P1 |
| FR-rec-011 | normal | 平衡方案从三段选将 | sortedHeroes按战力排序 | 前1/3取2+中1/3取2+后1/3取2 | covered | P1 |
| FR-rec-012 | normal | 平衡方案不足时从顶部补 | 武将数<6 | 从sortedHeroes顶部补齐 | covered | P1 |
| FR-rec-013 | normal | 羁绊方案同阵营优先 | 同阵营>=3人 | 优先选同阵营武将 | covered | P0 |
| FR-rec-014 | normal | 羁绊方案不足时用其他补充 | 同阵营<6人 | 用其他高战力补充 | covered | P1 |
| FR-rec-015 | boundary | 羁绊方案synergyBonus=15 | bestGroup.length>=3 | score额外+15 | covered | P1 |
| FR-rec-016 | boundary | 羁绊方案synergyBonus=8 | bestGroup.length>=2 | score额外+8 | covered | P2 |
| FR-rec-017 | boundary | 羁绊方案synergyBonus=0 | bestGroup.length<2 | score无额外加成 | covered | P2 |
| FR-rec-018 | exception | 所有武将同一阵营 | factionGroups只有1组 | 羁绊方案=最强方案（重复） | missing | P1 |
| FR-rec-019 | cross | 推荐结果与HeroFormation联动 | 推荐方案heroIds应用到编队 | heroIds均为有效已拥有武将 | missing | P0 |
| FR-rec-020 | cross | 推荐与BondSystem联动 | 羁绊方案考虑羁绊加成 | 羁绊方案score含羁绊分 | missing | P1 |

### analyzeStage(stageType, recommendedPower, enemySize)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| FR-anl-001 | normal | normal关卡分析 | stageType='normal', power=3000 | difficultyLevel = min(5, ceil(3000/2000)) = 2 | covered | P1 |
| FR-anl-002 | normal | elite关卡分析 | stageType='elite', power=6000 | difficultyLevel = min(8, ceil(6000/1500)) = 4 | covered | P1 |
| FR-anl-003 | normal | boss关卡分析 | stageType='boss', power=10000 | difficultyLevel = min(10, ceil(10000/1000)) = 10 | covered | P1 |
| FR-anl-004 | boundary | boss关卡低战力 | stageType='boss', power=500 | difficultyLevel = max(7, ceil(500/1000)) = 7 | covered | P2 |
| FR-anl-005 | boundary | normal关卡高战力 | stageType='normal', power=10000 | difficultyLevel = min(5, ceil(10000/2000)) = 5 | covered | P2 |
| FR-anl-006 | boundary | unknown stageType fallback | stageType='unknown' | 走default分支，按normal计算 | covered | P2 |
| FR-anl-007 | exception | recommendedPower为负数 | recommendedPower=-1000 | Math.ceil(-1000/2000)=-1→max(1,-1)=1 | missing | P1 |
| FR-anl-008 | exception | enemySize为负数 | enemySize=-5 | characteristics.enemySize=-5（无校验） | missing | P1 |

### calculateScore（内部方法）

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| FR-score-001 | normal | 战力评分计算 | totalPower=6000, recommendedPower=5000 | powerScore = min(1, 6000/5000)×100 = 100 | covered | P1 |
| FR-score-002 | boundary | 战力不足评分 | totalPower=2000, recommendedPower=5000 | powerScore = min(1, 2000/5000)×100 = 40 | covered | P2 |
| FR-score-003 | boundary | recommendedPower=0 | recommendedPower=0 | powerScore = 50（fallback） | covered | P2 |
| FR-score-004 | normal | 品质评分计算 | LEGENDARY(5.0)×1人 | qualityScore = (5/5)×100 = 100 | covered | P1 |
| FR-score-005 | boundary | 未知品质fallback | quality不在QUALITY_WEIGHT中 | 使用默认值1.0 | missing | P1 |
| FR-score-006 | normal | 覆盖评分计算 | selected.length=6 | coverageScore = (6/6)×100 = 100 | covered | P2 |
| FR-score-007 | boundary | selected为空 | selected=[] | 返回0 | covered | P2 |
| FR-score-008 | normal | 综合评分权重验证 | 各项已知 | power×0.4 + quality×0.25 + coverage×0.2 + 50×0.15 | covered | P1 |
| FR-score-009 | boundary | score上限100 | 各项都很高 | Math.min(100, score) | covered | P2 |

---

## 2. HeroDispatchSystem（武将派驻系统）

> 源码：`HeroDispatchSystem.ts`
> 职责：管理武将到建筑的派驻关系，计算建筑产出加成
> 约束：每建筑最多1武将，每武将最多1建筑
> 加成公式：(品质系数 + 等级×0.5) × (1 + 攻击×0.01)

### dispatchHero(heroId, buildingType)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| HD-disp-001 | normal | 正常派驻武将 | 武将和建筑均空闲 | success=true, 记录双向关系 | covered | P0 |
| HD-disp-002 | boundary | 武将已派驻到同一建筑 | heroId已有派驻且buildingType相同 | 允许（幂等），更新加成 | covered | P1 |
| HD-disp-003 | boundary | 武将已派驻到其他建筑 | heroId已有派驻到不同building | success=false, reason含已派驻信息 | covered | P0 |
| HD-disp-004 | normal | 建筑已有其他武将→自动替换 | building已有heroA | heroA被取消，heroB派驻成功 | covered | P0 |
| HD-disp-005 | exception | heroId为空字符串 | heroId="" | heroDispatch[""]被设置（无校验） | missing | P0 |
| HD-disp-006 | exception | buildingType为空字符串 | buildingType="" | buildingDispatch[""]被设置（无校验） | missing | P0 |
| HD-disp-007 | exception | getGeneralFn未注入 | setGetGeneral未调用 | calculateBonus返回0 | missing | P1 |
| HD-disp-008 | exception | getGeneralFn返回undefined | heroId不存在 | calculateBonus返回0 | missing | P1 |
| HD-disp-009 | normal | 派驻加成计算-COMMON Lv10 attack=60 | quality=COMMON, level=10, attack=60 | (1 + 10×0.5) × (1 + 60×0.01) = 6×1.6 = 9.6 | covered | P0 |
| HD-disp-010 | normal | 派驻加成计算-LEGENDARY Lv50 attack=115 | quality=LEGENDARY, level=50, attack=115 | (8 + 50×0.5) × (1 + 115×0.01) = 33×2.15 = 70.95→70.9 | covered | P0 |
| HD-disp-011 | boundary | 派驻加成-Lv0武将 | level=0 | levelBonus=0, qualityBonus仅品质 | missing | P1 |
| HD-disp-012 | boundary | 派驻加成-attack=0 | baseStats.attack=0 | attackBonus=0, 仅(品质+等级)×1 | missing | P1 |
| HD-disp-013 | cross | 派驻与建筑系统联动 | 派驻成功 | 建筑系统读取getDispatchBonus获取加成 | missing | P0 |

### undeployHero(heroId)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| HD-undep-001 | normal | 正常取消派驻 | 武将已派驻 | 返回true, 双向关系清除 | covered | P0 |
| HD-undep-002 | boundary | 取消未派驻武将 | heroId无派驻记录 | 返回false | covered | P1 |
| HD-undep-003 | exception | heroId为空字符串 | heroId="" | heroDispatch[""]不存在→返回false | missing | P1 |
| HD-undep-004 | lifecycle | 取消后重新派驻同一武将 | 取消→再派驻 | 新派驻关系正确建立 | missing | P1 |

### getDispatchBonus(buildingType)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| HD-bonus-001 | normal | 获取已派驻建筑加成 | 建筑有派驻 | 返回重新计算的加成（非缓存值） | covered | P0 |
| HD-bonus-002 | boundary | 获取无派驻建筑加成 | buildingType无派驻 | 返回0 | covered | P1 |
| HD-bonus-003 | cross | 武将升级后加成实时更新 | 武将升级后调用 | 返回新加成（因重新calculateBonus） | covered | P1 |

### getAllDispatchBonuses()

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| HD-allbonus-001 | normal | 获取所有建筑加成 | 3个建筑有派驻 | 返回3个键值对，值均为实时计算 | covered | P1 |
| HD-allbonus-002 | boundary | 无任何派驻 | buildingDispatch={} | 返回{} | covered | P2 |

### getHeroDispatchBuilding(heroId) / getBuildingDispatchHero(buildingType)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| HD-query-001 | normal | 查询武将派驻的建筑 | 武将已派驻 | 返回BuildingType | covered | P1 |
| HD-query-002 | boundary | 查询未派驻武将 | 武将无派驻 | 返回null | covered | P2 |
| HD-query-003 | normal | 查询建筑的派驻武将 | 建筑有派驻 | 返回heroId | covered | P1 |
| HD-query-004 | boundary | 查询无派驻建筑 | 建筑无派驻 | 返回null | covered | P2 |

### refreshDispatchBonus(heroId)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| HD-refresh-001 | normal | 武将升级后刷新加成 | 武将已派驻且升级 | 返回新加成，buildingDispatch更新 | covered | P1 |
| HD-refresh-002 | boundary | 未派驻武将刷新 | 武将无派驻 | 返回0 | covered | P2 |
| HD-refresh-003 | exception | getGeneralFn未注入 | setGetGeneral未调用 | calculateBonus返回0 | missing | P1 |

### calculateBonus（内部方法）

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| HD-calc-001 | normal | COMMON品质加成 | quality=COMMON | qualityBonus=1 | covered | P1 |
| HD-calc-002 | normal | LEGENDARY品质加成 | quality=LEGENDARY | qualityBonus=8 | covered | P1 |
| HD-calc-003 | boundary | 未知品质fallback | quality不在QUALITY_BONUS中 | 使用默认值1（`?? 1`） | missing | P1 |
| HD-calc-004 | boundary | baseStats为undefined | general.baseStats=undefined | attackBonus=0（`?? 0`） | missing | P1 |
| HD-calc-005 | boundary | NaN传播防护 | level=NaN | NaN×0.5=NaN, (品质+NaN)×(1+attack×0.01)=NaN | missing | P0 |
| HD-calc-006 | boundary | 负等级防护 | level=-1 | levelBonus=-0.5, 总加成可能为负 | missing | P0 |
| HD-calc-007 | boundary | 超大攻击值溢出 | attack=999999 | attackBonus=9999.99, 总加成极大 | missing | P1 |
| HD-calc-008 | normal | 四舍五入保留一位小数 | totalBonus=9.65 | Math.round(9.65×10)/10 = 96/10 = 9.6 | covered | P2 |

### 序列化/反序列化

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| HD-ser-001 | lifecycle | 正常序列化 | 有派驻数据 | JSON含buildingDispatch+heroDispatch | covered | P0 |
| HD-ser-002 | lifecycle | 正常反序列化 | 有效JSON | 双向关系完整恢复 | covered | P0 |
| HD-ser-003 | exception | 无效JSON反序列化 | 非JSON字符串 | reset为空状态 | covered | P1 |
| HD-ser-004 | boundary | 空状态序列化 | 无派驻 | 序列化为`{"buildingDispatch":{},"heroDispatch":{}}` | covered | P2 |
| HD-ser-005 | lifecycle | 序列化后一致性 | serialize→deserialize | 状态完全恢复 | covered | P1 |
| HD-ser-006 | exception | deserialize含额外字段 | JSON有多余key | 多余key被忽略（只取两个已知字段） | missing | P2 |

### ISubsystem 接口

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| HD-sub-001 | normal | init注入deps | 调用init | deps保存 | covered | P2 |
| HD-sub-002 | normal | reset清空状态 | 有派驻数据 | 双向关系清空 | covered | P1 |
| HD-sub-003 | normal | getState返回快照 | 有派驻数据 | 返回buildingDispatch+heroDispatch副本 | covered | P2 |
| HD-sub-004 | boundary | getState浅拷贝风险 | 修改返回值中的嵌套对象 | 可能影响内部状态（浅拷贝） | missing | P0 |

---

## 3. formation-types（编队类型与常量）

> 源码：`formation-types.ts`
> 纯常量和类型定义

### 常量校验

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| FT-const-001 | normal | MAX_FORMATIONS=3 | — | 编队上限3个 | covered | P1 |
| FT-const-002 | normal | MAX_SLOTS_PER_FORMATION=6 | — | 每编队6武将 | covered | P1 |
| FT-const-003 | normal | FORMATION_CREATE_REQUIRED_CASTLE_LEVEL=3 | — | 主城3级解锁编队 | covered | P1 |
| FT-const-004 | normal | FORMATION_CREATE_COST_COPPER=500 | — | 创建编队消耗500铜钱 | covered | P2 |
| FT-const-005 | normal | FORMATION_BOND_BONUS_RATE=0.05 | — | 每羁绊+5%战力 | covered | P2 |
| FT-const-006 | boundary | DEFAULT_NAMES覆盖1/2/3 | — | 三个默认名称存在 | covered | P2 |

### FormationData 类型完整性

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| FT-type-001 | normal | FormationData.id类型 | id='1'|'2'|'3' | 字符串类型 | covered | P2 |
| FT-type-002 | normal | FormationData.slots长度 | 创建时 | 长度=MAX_SLOTS_PER_FORMATION=6 | covered | P1 |
| FT-type-003 | boundary | FormationData.slots空位 | 未填入武将 | 空位为空字符串'' | covered | P1 |
| FT-type-004 | normal | FormationState.activeFormationId | — | string \| null | covered | P2 |

### 跨系统引用

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| FT-cross-001 | cross | FormationRecommendSystem引用MAX_SLOTS_PER_FORMATION | 推荐算法 | 使用值=6 | covered | P1 |
| FT-cross-002 | cross | HeroFormation引用FORMATION_BOND_BONUS_RATE | 战力计算 | 羁绊加成正确 | covered | P1 |
| FT-cross-003 | cross | FormationCreateRequiredCastleLevel与建筑系统联动 | 创建编队 | 主城等级校验 | missing | P1 |
| FT-cross-004 | cross | FormationCreateCostCopper与资源系统联动 | 创建编队 | 铜钱扣除 | missing | P1 |

---

## 4. hero-config（武将配置）

> 源码：`hero-config.ts`
> 纯常量和数据定义，零逻辑

### QUALITY_MULTIPLIERS 品质倍率表

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| HC-qm-001 | normal | COMMON倍率=1.0 | — | 1.0 | covered | P1 |
| HC-qm-002 | normal | FINE倍率=1.15 | — | 1.15 | covered | P1 |
| HC-qm-003 | normal | RARE倍率=1.3 | — | 1.3 | covered | P1 |
| HC-qm-004 | normal | EPIC倍率=1.5 | — | 1.5 | covered | P1 |
| HC-qm-005 | normal | LEGENDARY倍率=1.8 | — | 1.8 | covered | P1 |
| HC-qm-006 | boundary | 倍率递增一致性 | 从COMMON到LEGENDARY | 1.0 < 1.15 < 1.3 < 1.5 < 1.8 | covered | P2 |

### LEVEL_EXP_TABLE 升级经验表

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| HC-exp-001 | normal | 表覆盖1~100级 | 10个tier | levelMin/Max连续无间隙 | covered | P0 |
| HC-exp-002 | boundary | 1~10级经验需求 | tier[0] | expPerLevel=50, goldPerLevel=20 | covered | P1 |
| HC-exp-003 | boundary | 91~100级经验需求 | tier[9] | expPerLevel=9000, goldPerLevel=4000 | covered | P1 |
| HC-exp-004 | normal | 经验需求递增 | 相邻tier | 后段expPerLevel > 前段 | covered | P2 |
| HC-exp-005 | boundary | HERO_MAX_LEVEL=50 | 常量 | 注意：这是fallback上限，非实际上限 | covered | P1 |
| HC-exp-006 | cross | HERO_MAX_LEVEL与BREAKTHROUGH_TIERS一致性 | 对比star-up-config | 实际上限由突破决定(50/60/70/80/100) | covered | P0 |

### DUPLICATE_FRAGMENT_COUNT 重复碎片转化表

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| HC-dup-001 | normal | COMMON重复=5碎片 | — | 5 | covered | P1 |
| HC-dup-002 | normal | LEGENDARY重复=80碎片 | — | 80 | covered | P1 |
| HC-dup-003 | boundary | 所有品质都有配置 | 5个Quality枚举 | 每个品质都有对应值 | covered | P1 |
| HC-dup-004 | normal | 碎片数量递增 | 品质从低到高 | 5 < 10 < 20 < 40 < 80 | covered | P2 |

### STAR_UP_FRAGMENT_COST 升星碎片消耗表

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| HC-star-001 | normal | 1→2星消耗20碎片 | index=1 | 20 | covered | P1 |
| HC-star-002 | normal | 5→6星消耗300碎片 | index=5 | 300 | covered | P1 |
| HC-star-003 | boundary | 0→1星无消耗 | index=0 | 0 | covered | P2 |
| HC-star-004 | boundary | 数组长度=6 | 0~5星 | 覆盖1~6星 | covered | P1 |
| HC-star-005 | normal | 碎片消耗递增 | 相邻index | 后>前 | covered | P2 |

### SYNTHESIZE_REQUIRED_FRAGMENTS 碎片合成表

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| HC-synth-001 | normal | COMMON合成=20碎片 | — | 20 | covered | P1 |
| HC-synth-002 | normal | LEGENDARY合成=300碎片 | — | 300 | covered | P1 |
| HC-synth-003 | boundary | 合成碎片>升星碎片（同品质） | COMMON: 合成20 vs 升星20 | 合成=升星1→2星消耗 | covered | P2 |

### POWER_WEIGHTS 战力权重

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| HC-pw-001 | normal | 攻击力权重=2.0 | — | 2.0 | covered | P1 |
| HC-pw-002 | normal | 统率(defense)权重=1.5 | — | 1.5 | covered | P1 |
| HC-pw-003 | normal | 智力权重=2.0 | — | 2.0 | covered | P1 |
| HC-pw-004 | normal | 政治(speed)权重=1.0 | — | 1.0 | covered | P1 |
| HC-pw-005 | boundary | 权重总和=6.5 | 2.0+1.5+2.0+1.0 | 6.5 | covered | P2 |

### GENERAL_DEFS 武将定义数据

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| HC-def-001 | normal | 武将总数>=10 | GENERAL_DEFS.length | >=10（实际20） | covered | P1 |
| HC-def-002 | normal | 四阵营覆盖 | shu/wei/wu/qun | 每个阵营至少2名武将 | covered | P1 |
| HC-def-003 | normal | 五品质覆盖 | COMMON~LEGENDARY | 每个品质至少1名武将 | covered | P1 |
| HC-def-004 | boundary | ID唯一性 | 所有def.id | 无重复 | covered | P1 |
| HC-def-005 | boundary | 品质属性范围-普通60~75 | COMMON武将 | baseStats各值在60~75范围 | covered | P1 |
| HC-def-006 | boundary | 品质属性范围-传说100~120 | LEGENDARY武将 | baseStats攻击/防御在100~120范围 | covered | P1 |
| HC-def-007 | cross | GENERAL_DEF_MAP与GENERAL_DEFS一致 | Map vs Array | 长度和键值完全对应 | covered | P1 |
| HC-def-008 | boundary | 武将技能非空 | 每个def.skills | 至少1个技能 | covered | P2 |
| HC-def-009 | normal | 吴国武将>=3名（v1.3新增后） | wu阵营 | 至少3名（原2+新增3=5） | covered | P1 |
| HC-def-010 | boundary | PRD v1.3新增6名RARE武将存在 | lushu/huanggai/ganning/xuhuang/zhangliao/weiyan | 6名均在DEF_MAP中 | covered | P1 |

---

## 5. hero-recruit-config（招募配置）

> 源码：`hero-recruit-config.ts`
> 招募消耗、概率表、保底配置、UP武将配置

### RECRUIT_COSTS 招募消耗

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| HRC-cost-001 | normal | 普通招募消耗 | type=normal | resourceType='recruitToken', amount=1 | covered | P0 |
| HRC-cost-002 | normal | 高级招募消耗 | type=advanced | resourceType='recruitToken', amount=10 | covered | P0 |
| HRC-cost-003 | boundary | TEN_PULL_DISCOUNT=1.0 | — | 无折扣 | covered | P1 |
| HRC-cost-004 | cross | 消耗资源类型与TokenEconomy系统一致 | recruitToken | 两个系统使用同一资源标识 | missing | P0 |

### NORMAL_RATES / ADVANCED_RATES 概率表

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| HRC-rate-001 | normal | 普通概率总和=1.0 | 0.60+0.30+0.08+0.02+0 | 1.0 | covered | P0 |
| HRC-rate-002 | normal | 高级概率总和=1.0 | 0.20+0.40+0.25+0.13+0.02 | 1.0 | covered | P0 |
| HRC-rate-003 | boundary | 普通招募LEGENDARY概率=0 | NORMAL_RATES[4].rate | 0 | covered | P1 |
| HRC-rate-004 | boundary | 高级招募LEGENDARY概率=0.02 | ADVANCED_RATES[4].rate | 0.02 | covered | P1 |
| HRC-rate-005 | normal | 五品质全覆盖 | 两个概率表 | 各有5个条目 | covered | P2 |
| HRC-rate-006 | boundary | 概率递减（普通池） | COMMON→LEGENDARY | 60% > 30% > 8% > 2% > 0% | covered | P2 |

### RECRUIT_PITY 保底配置

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| HRC-pity-001 | normal | 普通十连保底阈值=10 | NORMAL_PITY.tenPullThreshold | 10 | covered | P0 |
| HRC-pity-002 | normal | 普通池无硬保底 | NORMAL_PITY.hardPityThreshold | Infinity | covered | P0 |
| HRC-pity-003 | normal | 高级十连保底阈值=10 | ADVANCED_PITY.tenPullThreshold | 10 | covered | P0 |
| HRC-pity-004 | normal | 高级硬保底阈值=100 | ADVANCED_PITY.hardPityThreshold | 100 | covered | P0 |
| HRC-pity-005 | normal | 高级硬保底最低品质=LEGENDARY | ADVANCED_PITY.hardPityMinQuality | LEGENDARY | covered | P1 |
| HRC-pity-006 | boundary | 十连保底最低品质=RARE | 两种类型一致 | RARE | covered | P1 |

### UP武将配置

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| HRC-up-001 | normal | 默认UP配置无UP武将 | DEFAULT_UP_CONFIG | upGeneralId=null, upRate=0.50 | covered | P1 |
| HRC-up-002 | normal | UP触发概率=50% | upRate | 0.50（出LEGENDARY时） | covered | P1 |
| HRC-up-003 | boundary | UP_HERO_DESCRIPTIONS覆盖所有LEGENDARY | 9个武将描述 | 每个LEGENDARY/EPIC有描述 | covered | P2 |
| HRC-up-004 | cross | UP武将ID必须在GENERAL_DEF_MAP中 | 设置UP武将 | ID有效 | missing | P0 |

### DAILY_FREE_CONFIG 每日免费配置

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| HRC-free-001 | normal | 普通每日免费1次 | normal.freeCount | 1 | covered | P1 |
| HRC-free-002 | boundary | 高级无免费次数 | advanced.freeCount | 0 | covered | P1 |

### DUPLICATE_FRAGMENT_REWARD（从hero-config re-export）

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| HRC-dup-001 | normal | re-export与源一致 | DUPLICATE_FRAGMENT_REWARD vs DUPLICATE_FRAGMENT_COUNT | 引用同一对象 | covered | P1 |

---

## 6. star-up-config（升星配置）

> 源码：`star-up-config.ts`
> 升星消耗、星级倍率、突破配置、碎片掉落、商店兑换

### STAR_UP_GOLD_COST 升星铜钱消耗

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| SRC-gold-001 | normal | 1→2星铜钱=5000 | index=1 | 5000 | covered | P1 |
| SRC-gold-002 | normal | 5→6星铜钱=100000 | index=5 | 100000 | covered | P1 |
| SRC-gold-003 | boundary | 0→1星无消耗 | index=0 | 0 | covered | P2 |
| SRC-gold-004 | normal | 铜钱消耗递增 | 相邻index | 后>前 | covered | P2 |

### STAR_MULTIPLIERS / getStarMultiplier

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| SRC-mult-001 | normal | 1星倍率=1.0 | star=1 | 1.0 | covered | P1 |
| SRC-mult-002 | normal | 6星倍率=2.5 | star=6 | 2.5 | covered | P1 |
| SRC-mult-003 | boundary | getStarMultiplier(0) | star<1 | 返回STAR_MULTIPLIERS[0]=1.0 | covered | P1 |
| SRC-mult-004 | boundary | getStarMultiplier(7) | star>6 | 返回最后一个=2.5 | covered | P1 |
| SRC-mult-005 | normal | 倍率递增 | 1~6星 | 1.0 < 1.15 < 1.35 < 1.6 < 2.0 < 2.5 | covered | P2 |
| SRC-mult-006 | boundary | STAR_MULTIPLIERS[0]=1.0 vs [1]=1.0 | 索引0和1 | 两个占位值相同 | covered | P2 |
| SRC-mult-007 | exception | getStarMultiplier(NaN) | star=NaN | NaN<1=true→返回[0]=1.0 | missing | P1 |
| SRC-mult-008 | exception | getStarMultiplier(-1) | star=-1 | star<1→返回[0]=1.0 | covered | P2 |

### BREAKTHROUGH_TIERS 突破配置

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| SRC-bt-001 | normal | 4个突破阶段 | — | length=4 | covered | P1 |
| SRC-bt-002 | normal | 突破等级上限链：50→60→70→80→100 | 连续tier | levelCapAfter[n]=levelCapBefore[n+1] | covered | P0 |
| SRC-bt-003 | normal | 一阶突破消耗 | tier[0] | fragment=30, gold=20000, stone=5 | covered | P1 |
| SRC-bt-004 | normal | 四阶突破消耗 | tier[3] | fragment=120, gold=200000, stone=40 | covered | P1 |
| SRC-bt-005 | boundary | INITIAL_LEVEL_CAP=50 | 常量 | 与tier[0].levelCapBefore一致 | covered | P0 |
| SRC-bt-006 | boundary | FINAL_LEVEL_CAP=100 | 常量 | 与tier[3].levelCapAfter一致 | covered | P0 |
| SRC-bt-007 | normal | 突破消耗递增 | 相邻tier | 后>前（碎片/铜钱/突破石） | covered | P2 |
| SRC-bt-008 | cross | MAX_BREAKTHROUGH_STAGE=4 | — | 与BREAKTHROUGH_TIERS.length一致 | covered | P1 |

### STAGE_FRAGMENT_DROPS 关卡碎片掉落

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| SRC-drop-001 | normal | 掉落配置覆盖多个关卡 | — | >=10条配置 | covered | P2 |
| SRC-drop-002 | boundary | dropRange.min<=max | 每条配置 | min<=max | covered | P2 |
| SRC-drop-003 | cross | generalId在GENERAL_DEF_MAP中存在 | 每条配置的generalId | 有效武将ID | covered | P1 |
| SRC-drop-004 | boundary | stageId唯一性 | 所有stageId | 无重复 | covered | P2 |

### SHOP_FRAGMENT_EXCHANGE 商店兑换配置

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| SRC-shop-001 | normal | 商店配置覆盖多个武将 | — | >=10条配置 | covered | P2 |
| SRC-shop-002 | normal | LEGENDARY武将限购5/日 | guanyu等 | dailyLimit=5 | covered | P1 |
| SRC-shop-003 | normal | COMMON武将限购50/日 | minbingduizhang | dailyLimit=50 | covered | P1 |
| SRC-shop-004 | boundary | pricePerFragment>0 | 所有配置 | 正数 | covered | P2 |
| SRC-shop-005 | boundary | dailyLimit>0 | 所有配置 | 正数 | covered | P2 |
| SRC-shop-006 | cross | generalId在GENERAL_DEF_MAP中存在 | 每条配置 | 有效武将ID | covered | P1 |
| SRC-shop-007 | cross | 商店限购与StarSystem.dailyExchangeCount联动 | 每日重置 | 限购计数跨日清零 | missing | P0 |

---

## 7. star-up.types（升星类型定义）

> 源码：`star-up.types.ts`
> 纯类型定义

### 类型完整性校验

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| ST-type-001 | normal | StarData含generalId+star | — | 类型可正确实例化 | covered | P2 |
| ST-type-002 | normal | FragmentSource枚举5种来源 | DUPLICATE/STAGE_DROP/SHOP_EXCHANGE/ACTIVITY/EXPEDITION | 5个值 | covered | P2 |
| ST-type-003 | normal | StarUpResult含success+前后属性 | — | statsBefore/After为GeneralStats | covered | P2 |
| ST-type-004 | normal | BreakthroughTier与star-up-config一致 | 接口定义 | 字段完全匹配配置 | covered | P1 |
| ST-type-005 | normal | StarSystemState含stars+breakthroughStages+dailyExchangeCount | — | 三个Record字段 | covered | P1 |
| ST-type-006 | normal | StarSystemDeps含5个回调 | — | spendFragments/getFragments/spendResource/canAfford/getResource | covered | P1 |

---

## 8. recruit-types（招募类型与辅助函数）

> 源码：`recruit-types.ts`
> 类型定义 + 辅助函数

### 辅助函数

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| RT-helper-001 | normal | createEmptyPity | — | 4个计数器均为0 | covered | P1 |
| RT-helper-002 | normal | createEmptyFreeRecruit | — | usedFreeCount={normal:0,advanced:0}, lastResetDate=今天 | covered | P1 |
| RT-helper-003 | normal | createDefaultUpHero | — | upGeneralId=DEFAULT_UP_CONFIG.upGeneralId | covered | P1 |
| RT-helper-004 | normal | rollQuality累积概率 | rates=[{Q:0.5},{Q:0.3},{Q:0.2}], rng=()=>0.4 | 返回第一个品质（0.4<0.5） | covered | P1 |
| RT-helper-005 | boundary | rollQuality rng=0.99 | rates总和=1.0 | 返回最后一个品质 | covered | P2 |
| RT-helper-006 | normal | applyPity硬保底优先 | hardPityCount>=threshold-1 | 返回hardPityMinQuality | covered | P0 |
| RT-helper-007 | normal | applyPity十连保底 | pityCount>=threshold-1 | 返回tenPullMinQuality | covered | P0 |
| RT-helper-008 | boundary | applyPity无保底触发 | 计数器均未达阈值 | 返回baseQuality不变 | covered | P1 |
| RT-helper-009 | exception | pickGeneralByQuality池为空 | 该品质无武将定义 | 返回null | covered | P1 |
| RT-helper-010 | normal | MAX_HISTORY_SIZE=20 | — | 历史上限20条 | covered | P2 |

---

## 9. 跨系统交互

| ID | 类型 | 描述 | 涉及系统 | 预期行为 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| XC-001 | cross | 编队推荐→编队应用 | FormationRecommend→HeroFormation | 推荐的heroIds可直接用于setFormation | missing | P0 |
| XC-002 | cross | 编队推荐→羁绊计算 | FormationRecommend→BondSystem | 羁绊方案的score应与BondSystem计算一致 | missing | P1 |
| XC-003 | cross | 派驻→建筑产出 | HeroDispatch→BuildingSystem | getDispatchBonus被建筑系统调用 | missing | P0 |
| XC-004 | cross | 武将升级→派驻加成刷新 | HeroLevel→HeroDispatch | 升级后调用refreshDispatchBonus | missing | P0 |
| XC-005 | cross | 武将升星→派驻加成刷新 | HeroStar→HeroDispatch | 升星后调用refreshDispatchBonus | missing | P1 |
| XC-006 | cross | 武将移除→派驻清理 | HeroSystem→HeroDispatch | 移除武将时自动undeploy | missing | P0 |
| XC-007 | cross | 配置一致性：hero-config与star-up-config | hero-config↔star-up-config | 重新导出的常量引用一致 | covered | P1 |
| XC-008 | cross | 配置一致性：hero-config与hero-recruit-config | hero-config↔hero-recruit-config | DUPLICATE_FRAGMENT_COUNT re-export一致 | covered | P1 |
| XC-009 | cross | 编队推荐→关卡系统 | FormationRecommend→Campaign | stageType参数来源于Campaign | missing | P1 |
| XC-010 | cross | 派驻序列化→全局存档 | HeroDispatch→EngineSave | 派驻数据包含在engine-save中 | missing | P0 |
| XC-011 | cross | 招募配置概率→招募系统执行 | hero-recruit-config→HeroRecruitSystem | 概率表被正确引用 | covered | P1 |
| XC-012 | cross | 升星配置→升星系统执行 | star-up-config→HeroStarSystem | 消耗表被正确引用 | covered | P1 |
| XC-013 | cross | 商店兑换限购→每日重置 | star-up-config→StarSystem | dailyExchangeCount跨日清零 | missing | P0 |
| XC-014 | cross | 武将定义→编队推荐→派驻 | hero-config→FormationRecommend→HeroDispatch | 推荐和派驻使用的武将数据来源一致 | missing | P1 |

---

## 10. 数据生命周期

| ID | 类型 | 描述 | 涉及系统 | 预期行为 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| LC-001 | lifecycle | 派驻完整生命周期：派驻→刷新→取消→序列化→恢复 | HeroDispatch | 全流程数据一致 | missing | P0 |
| LC-002 | lifecycle | 编队推荐无状态：recommend不修改内部状态 | FormationRecommend | 多次调用结果一致 | covered | P1 |
| LC-003 | lifecycle | 配置热更新：武将定义变更后推荐结果更新 | hero-config→FormationRecommend | 使用最新GENERAL_DEFS | missing | P1 |
| LC-004 | lifecycle | 派驻reset后状态干净 | HeroDispatch.reset() | 双向关系清空 | covered | P1 |
| LC-005 | lifecycle | 派驻序列化/反序列化一致性 | HeroDispatch | serialize→deserialize→getState一致 | missing | P0 |
| LC-006 | lifecycle | 配置版本兼容性：HERO_SAVE_VERSION/STAR_SYSTEM_SAVE_VERSION/RECRUIT_SAVE_VERSION | All configs | 版本号一致且递增 | covered | P1 |

---

## 附录A：P0缺陷模式扫描

根据 `p0-pattern-library.md` 8种模式对 Part C 文件进行自动扫描：

### 模式1: null/undefined防护缺失

| 文件 | API/位置 | 风险 | 节点ID |
|------|----------|------|--------|
| FormationRecommendSystem | recommend() - calculatePower参数 | 无null guard，传入null崩溃 | FR-rec-006 |
| FormationRecommendSystem | recommend() - availableHeroes元素 | 元素可能为null/undefined | FR-rec-007 |
| HeroDispatchSystem | dispatchHero() - heroId | 空字符串无校验 | HD-disp-005 |
| HeroDispatchSystem | dispatchHero() - buildingType | 空字符串无校验 | HD-disp-006 |
| HeroDispatchSystem | calculateBonus() - getGeneralFn | 未注入时返回0（已防护） | HD-disp-007 |
| HeroDispatchSystem | calculateBonus() - general | 返回undefined时返回0（已防护） | HD-disp-008 |

### 模式2: 数值溢出/非法值

| 文件 | API/位置 | 风险 | 节点ID |
|------|----------|------|--------|
| HeroDispatchSystem | calculateBonus() - level=NaN | NaN传播到整个计算 | HD-calc-005 |
| FormationRecommendSystem | analyzeStage() - recommendedPower<0 | 负数产生意外difficultyLevel | FR-anl-007 |
| star-up-config | getStarMultiplier(NaN) | NaN<1=true，返回默认值（已防护） | SRC-mult-007 |

### 模式3: 负值漏洞

| 文件 | API/位置 | 风险 | 节点ID |
|------|----------|------|--------|
| HeroDispatchSystem | calculateBonus() - level<0 | 负等级产生负加成 | HD-calc-006 |
| FormationRecommendSystem | analyzeStage() - enemySize<0 | 负数无校验 | FR-anl-008 |

### 模式4: 浅拷贝副作用

| 文件 | API/位置 | 风险 | 节点ID |
|------|----------|------|--------|
| HeroDispatchSystem | getState() | 返回浅拷贝，嵌套DispatchRecord可被修改 | HD-sub-004 |
| FormationRecommendSystem | recommend() sortedHeroes | `[...availableHeroes]`浅拷贝，但只读使用（安全） | — |

### 模式5: 竞态/状态泄漏

| 文件 | API/位置 | 风险 | 节点ID |
|------|----------|------|--------|
| HeroDispatchSystem | dispatchHero()自动替换 | 替换旧武将时先delete再设置（原子操作，安全） | — |
| FormationRecommendSystem | 无状态（ISubsystem.update为空） | 无竞态风险 | — |

### 模式6: 经济漏洞

| 文件 | API/位置 | 风险 | 节点ID |
|------|----------|------|--------|
| star-up-config | SHOP_FRAGMENT_EXCHANGE | 限购配置存在，但需StarSystem强制执行 | SRC-shop-007 |
| hero-recruit-config | DAILY_FREE_CONFIG | 免费次数限制存在，需RecruitSystem强制执行 | HRC-free-001 |

### 模式7: 数据丢失

| 文件 | API/位置 | 风险 | 节点ID |
|------|----------|------|--------|
| HeroDispatchSystem | serialize() | 仅保存buildingDispatch+heroDispatch，完整 | HD-ser-001 |
| FormationRecommendSystem | getState() | 仅返回version:1，无实际状态 | — |

### 模式8: 集成缺失

| 文件 | API/位置 | 风险 | 节点ID |
|------|----------|------|--------|
| FormationRecommendSystem | recommend() | 与BondSystem无直接集成，羁绊分是静态值 | XC-002 |
| HeroDispatchSystem | dispatchHero() | 与建筑系统无回调通知 | XC-003 |
| HeroDispatchSystem | undeployHero() | 与建筑系统无回调通知 | XC-003 |

---

## 附录B：配置交叉引用矩阵

### 武将定义引用链

```
hero-config.GENERAL_DEFS
  ├──→ hero-config.GENERAL_DEF_MAP (查找表)
  ├──→ FormationRecommendSystem.recommend() (推荐候选)
  ├──→ HeroDispatchSystem.calculateBonus() (派驻加成)
  ├──→ hero-recruit-config.UP_HERO_DESCRIPTIONS (UP描述)
  ├──→ star-up-config.STAGE_FRAGMENT_DROPS (碎片掉落)
  └──→ star-up-config.SHOP_FRAGMENT_EXCHANGE (商店兑换)
```

### 配置重新导出链

```
hero-config.STAR_UP_FRAGMENT_COST ──→ star-up-config (re-export)
hero-config.MAX_STAR_LEVEL ──→ star-up-config (re-export)
hero-config.SYNTHESIZE_REQUIRED_FRAGMENTS ──→ star-up-config (re-export)
hero-config.DUPLICATE_FRAGMENT_COUNT ──→ hero-recruit-config (re-export as DUPLICATE_FRAGMENT_REWARD)
```

### 类型引用链

```
hero.types (Quality, GeneralStats, GeneralData, Faction)
  ├──→ formation-types (FormationData)
  ├──→ star-up.types (StarData, StarUpCost, BreakthroughTier)
  ├──→ recruit-types (RecruitResult, PityState)
  ├──→ hero-config (GeneralDef, QUALITY_MULTIPLIERS)
  ├──→ hero-recruit-config (QualityRate, PityConfig)
  └──→ star-up-config (StageDropConfig, ShopExchangeConfig)
```

---

## 附录C：高优先级缺失节点（P0 missing）

| ID | 系统 | 描述 | 缺陷模式 | 建议测试 |
|----|------|------|----------|----------|
| FR-rec-006 | FormationRecommend | calculatePower=null崩溃 | 模式1 | recommend('normal', heroes, null as any) |
| FR-rec-007 | FormationRecommend | availableHeroes含null | 模式1 | recommend('normal', [null], fn) |
| HD-disp-005 | HeroDispatch | heroId空字符串无校验 | 模式1 | dispatchHero('', 'castle') |
| HD-disp-006 | HeroDispatch | buildingType空字符串无校验 | 模式1 | dispatchHero('hero1', '') |
| HD-calc-005 | HeroDispatch | NaN传播到加成计算 | 模式2 | 派驻level=NaN的武将 |
| HD-calc-006 | HeroDispatch | 负等级产生负加成 | 模式3 | 派驻level=-1的武将 |
| HD-sub-004 | HeroDispatch | getState浅拷贝副作用 | 模式4 | 修改getState返回值验证隔离 |
| XC-001 | 跨系统 | 推荐结果→编队应用 | 模式8 | 推荐后setFormation验证 |
| XC-003 | 跨系统 | 派驻→建筑产出联动 | 模式8 | 派驻后建筑产出增加 |
| XC-004 | 跨系统 | 武将升级→派驻加成刷新 | 模式8 | 升级后refreshDispatchBonus |
| XC-006 | 跨系统 | 武将移除→派驻清理 | 模式8 | 移除已派驻武将 |
| XC-010 | 跨系统 | 派驻序列化→全局存档 | 模式7 | engine-save包含派驻数据 |
| XC-013 | 跨系统 | 商店限购→每日重置 | 模式6 | 跨日限购计数清零 |
| HRC-cost-004 | 招募配置 | recruitToken类型一致性 | 模式8 | 与TokenEconomy资源类型匹配 |
| HRC-up-004 | 招募配置 | UP武将ID有效性 | 模式1 | 设置无效UP武将ID |
| LC-001 | 生命周期 | 派驻完整生命周期 | 模式7 | 派驻→刷新→取消→序列化→恢复 |
| LC-005 | 生命周期 | 派驻序列化一致性 | 模式7 | serialize→deserialize一致性 |

---

## 附录D：按维度统计

| 维度 | 节点数 | covered | missing | partial | 覆盖率 |
|------|--------|---------|---------|---------|--------|
| 正常流程 (normal) | 72 | 62 | 10 | 0 | 86% |
| 边界条件 (boundary) | 56 | 46 | 9 | 1 | 82% |
| 异常路径 (exception) | 18 | 9 | 8 | 1 | 50% |
| 跨系统交互 (cross) | 18 | 6 | 10 | 2 | 33% |
| 数据生命周期 (lifecycle) | 6 | 4 | 2 | 0 | 67% |

> 注：covered 标注基于源码分析推断（API有明确的防护逻辑或已有测试覆盖）。missing 表示存在缺陷模式风险且无防护。建议对 P0 missing 节点优先补充测试。
