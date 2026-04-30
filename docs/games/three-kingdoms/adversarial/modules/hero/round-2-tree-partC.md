# Hero 流程分支树 Round 2 — Part C（辅助+配置系统）

> Builder: TreeBuilder v1.1 | Time: 2026-05-01
> R1吸收: 13个P0遗漏 + 4个P0降级 + 8个新增P0 + 21%虚报率
> R1修复: FIX-004(FormationRecommend null guard)

## Part C 子系统清单

| # | 子系统 | 源文件 | 公开API数 | R1节点 | R2节点 |
|---|--------|--------|----------|--------|--------|
| 1 | FormationRecommendSystem | FormationRecommendSystem.ts | 4 | 28 | 36 |
| 2 | HeroDispatchSystem | HeroDispatchSystem.ts | 10 | 24 | 30 |
| 3 | hero-config | hero-config.ts | 8 | 18 | 22 |
| 4 | hero-recruit-config | hero-recruit-config.ts | 6 | 14 | 18 |
| 5 | star-up-config | star-up-config.ts | 8 | 16 | 22 |
| 6 | hero.types | hero.types.ts | 4 | 8 | 10 |
| 7 | formation-types | formation-types.ts | 4 | 8 | 10 |
| 8 | recruit-types | recruit-types.ts | 4 | 10 | 12 |
| 9 | index.ts | index.ts | 2 | 4 | 6 |
| **合计** | **9个子系统** | | **~58** | **130** | **166** |

---

## 1. FormationRecommendSystem (FormationRecommendSystem.ts) — 36节点

### 1.1 核心推荐 (recommend) — 16节点

| ID | API | 场景 | 优先级 | R2状态 | R1变化 |
|----|-----|------|--------|--------|--------|
| FR-N01 | recommend | 正常推荐(3个方案) | P1 | ✅ covered | 测试覆盖 |
| FR-N02 | recommend | 可用武将<3→仅1~2个方案 | P1 | ✅ covered | 测试覆盖 |
| FR-N03 | recommend | 可用武将=0→空方案 | P1 | ✅ covered | 测试覆盖 |
| FR-B01 | recommend | availableHeroes=null → FIX-004已防护→[] | P0 | ✅ covered | R2确认FIX-004有效 |
| FR-B02 | recommend | availableHeroes含null元素 → FIX-004已过滤 | P0 | ✅ covered | R2确认FIX-004有效 |
| FR-B03 | recommend | calculatePower=null → 调用崩溃 | P0 | ⚠️ uncovered | R2维持(吸收CH-FR-rec-006) |
| FR-B04 | recommend | calculatePower返回NaN → FIX-004已防护→0 | P0 | ✅ covered | R2确认FIX-004有效 |
| FR-B05 | recommend | calculatePower返回Infinity → FIX-004已防护→0 | P0 | ✅ covered | R2确认FIX-004有效 |
| FR-B06 | recommend | stageType=无效值→default按normal计算 | P1 | ⚠️ uncovered | R2新增(吸收Arbiter发现6) |
| FR-B07 | recommend | recommendedPower=NaN→difficultyLevel=NaN | P0 | ⚠️ uncovered | R2新增 |
| FR-B08 | recommend | enemySize=NaN→characteristics含NaN | P1 | ⚠️ uncovered | R2新增 |
| FR-B09 | recommend | 所有武将同阵营→羁绊方案与最强方案重复 | P0 | ⚠️ uncovered | R2新增(吸收CH-NEW-001) |
| FR-B10 | recommend | 武将数≤6→多个方案选到相同武将集合 | P0 | ⚠️ uncovered | R2新增(吸收CH-NEW-003) |
| FR-B11 | recommend | 羁绊方案synergyBonus硬编码(15/8/0)而非BondSystem计算 | P0 | ⚠️ uncovered | R2新增(吸收CH-NEW-002) |
| FR-B12 | recommend | 推荐结果heroIds→编队FormationData缺少适配层 | P0 | ⚠️ uncovered | R2新增(吸收XC-C02) |
| FR-B13 | recommend | availableHeroes含重复武将→排序去重? | P1 | ⚠️ uncovered | R2新增 |

### 1.2 方案构建 (buildBestPowerPlan/buildBalancedPlan/buildSynergyPlan) — 12节点

| ID | API | 场景 | 优先级 | R2状态 | R1变化 |
|----|-----|------|--------|--------|--------|
| FR-N04 | buildBestPowerPlan | 正常构建(取前6高战力) | P1 | ✅ covered | 测试覆盖 |
| FR-N05 | buildBalancedPlan | 正常构建(三等分交替选) | P1 | ✅ covered | 测试覆盖 |
| FR-N06 | buildSynergyPlan | 正常构建(同阵营优先) | P1 | ✅ covered | 测试覆盖 |
| FR-B14 | buildBalancedPlan | 武将数<3→third=1→分组不均 | P1 | ⚠️ uncovered | R2新增 |
| FR-B15 | buildBalancedPlan | 某组为空→group[pickIdx]=undefined→跳过 | P1 | ⚠️ uncovered | R2新增 |
| FR-B16 | buildBalancedPlan | 补充逻辑find→可能选到战力很低武将 | P1 | ⚠️ uncovered | R2新增 |
| FR-B17 | buildSynergyPlan | 无阵营信息→factionGroups为空→返回null | P1 | ⚠️ uncovered | R2新增 |
| FR-B18 | buildSynergyPlan | 所有武将同阵营→bestGroup=全部→与最强方案相同 | P0 | ⚠️ uncovered | R2维持(同FR-B09) |
| FR-B19 | buildBestPowerPlan | sortedHeroes含NaN战力→排序异常 | P0 | ⚠️ uncovered | R2新增 |
| FR-B20 | calculateScore | selected为空→返回0 | P2 | ✅ covered | R2验证 |
| FR-B21 | calculateScore | QUALITY_WEIGHT[无效quality]→??1→降级处理 | P1 | ✅ covered | R2验证 |
| FR-B22 | calculateScore | recommendedPower=0→powerScore=50(默认) | P1 | ✅ covered | R2验证 |

### 1.3 关卡分析/系统管理 — 8节点

| ID | API | 场景 | 优先级 | R2状态 | R1变化 |
|----|-----|------|--------|--------|--------|
| FR-N07 | analyzeStage | normal关卡分析 | P2 | ✅ covered | 测试覆盖 |
| FR-N08 | analyzeStage | elite关卡分析 | P2 | ✅ covered | 测试覆盖 |
| FR-N09 | analyzeStage | boss关卡分析 | P2 | ✅ covered | 测试覆盖 |
| FR-B23 | analyzeStage | recommendedPower=NaN→Math.ceil(NaN/1000)=NaN→Math.min(10,Math.max(7,NaN))=NaN | P0 | ⚠️ uncovered | R2新增 |
| FR-E01 | init | 注入依赖 | P2 | ✅ covered | 测试覆盖 |
| FR-E02 | reset | 正常重置 | P2 | ✅ covered | 测试覆盖 |
| FR-E03 | update | 空实现 | P2 | ✅ covered | R2验证 |
| FR-E04 | getState | 返回{version:1} | P2 | ✅ covered | R2验证 |

---

## 2. HeroDispatchSystem (HeroDispatchSystem.ts) — 30节点

### 2.1 派驻管理 (dispatchHero/undeployHero) — 12节点

| ID | API | 场景 | 优先级 | R2状态 | R1变化 |
|----|-----|------|--------|--------|--------|
| HD-N01 | dispatchHero | 正常派驻 | P1 | ✅ covered | 测试覆盖 |
| HD-N02 | undeployHero | 正常取消 | P1 | ✅ covered | 测试覆盖 |
| HD-N03 | dispatchHero | 替换已有派驻(自动替换) | P1 | ✅ covered | 测试覆盖 |
| HD-B01 | dispatchHero | heroId=空字符串→创建脏数据记录 | P0 | ⚠️ uncovered | R2维持(吸收HD-disp-005) |
| HD-B02 | dispatchHero | buildingType=空字符串→加成为0但有记录 | P1 | ⚠️ uncovered | R2降级(吸收1.2节: P0→P1) |
| HD-B03 | dispatchHero | heroId已派驻到同建筑→返回成功(幂等) | P2 | ✅ covered | R2验证 |
| HD-B04 | undeployHero | heroId未派驻→false | P1 | ✅ covered | 测试覆盖 |
| HD-B05 | dispatchHero | getGeneralFn未注入→calculateBonus返回0→bonusPercent=0 | P1 | ✅ covered | 测试覆盖 |
| HD-B06 | dispatchHero | getGeneralFn返回undefined→calculateBonus返回0 | P1 | ✅ covered | 测试覆盖 |
| HD-B07 | dispatchHero | heroId=null→this.heroDispatch[null]→创建脏数据 | P0 | ⚠️ uncovered | R2新增 |
| HD-B08 | dispatchHero | buildingType=null→this.buildingDispatch[null]→创建脏数据 | P0 | ⚠️ uncovered | R2新增 |

### 2.2 加成计算 (calculateBonus/getDispatchBonus) — 10节点

| ID | API | 场景 | 优先级 | R2状态 | R1变化 |
|----|-----|------|--------|--------|--------|
| HD-N04 | getDispatchBonus | 正常获取加成 | P1 | ✅ covered | 测试覆盖 |
| HD-N05 | getAllDispatchBonuses | 正常获取所有加成 | P2 | ✅ covered | 测试覆盖 |
| HD-N06 | refreshDispatchBonus | 正常刷新(武将升级后) | P1 | ✅ covered | 测试覆盖 |
| HD-B09 | calculateBonus | level=NaN→NaN*0.5=NaN→NaN传播到建筑产出 | P0 | ⚠️ uncovered | R2维持(吸收HD-calc-005) |
| HD-B10 | calculateBonus | level=负数→负加成(极端负值) | P0 | ⚠️ uncovered | R2维持(吸收HD-calc-006) |
| HD-B11 | calculateBonus | quality不在QUALITY_BONUS中→??1→降级 | P1 | ✅ covered | R2验证 |
| HD-B12 | calculateBonus | baseStats=null→baseStats?.attack=undefined→0 | P1 | ✅ covered | R2验证 |
| HD-B13 | getDispatchBonus | buildingType不存在→返回0 | P1 | ✅ covered | 测试覆盖 |
| HD-B14 | refreshDispatchBonus | heroId未派驻→返回0 | P1 | ✅ covered | 测试覆盖 |
| HD-B15 | calculateBonus | attack=NaN→NaN*0.01=NaN→totalBonus=NaN | P0 | ⚠️ uncovered | R2新增 |

### 2.3 序列化/状态管理 — 8节点

| ID | API | 场景 | 优先级 | R2状态 | R1变化 |
|----|-----|------|--------|--------|--------|
| HD-N07 | serialize | 正常序列化(JSON) | P1 | ✅ covered | 测试覆盖 |
| HD-N08 | deserialize | 正常反序列化 | P1 | ✅ covered | 测试覆盖 |
| HD-B16 | getState | 浅拷贝→嵌套DispatchRecord可被外部篡改 | P0 | ⚠️ uncovered | R2维持(吸收HD-sub-004) |
| HD-E01 | deserialize(null) | FIX-003已防护→reset() | P0 | ✅ covered | R2确认FIX-003有效 |
| HD-E02 | deserialize(损坏JSON) | try-catch→reset() | P1 | ✅ covered | R2验证 |
| HD-E03 | serialize→deserialize | 往返一致性 | P1 | ✅ covered | 测试覆盖 |
| HD-E04 | reset | 正常重置 | P2 | ✅ covered | 测试覆盖 |
| HD-E05 | init | 注入依赖 | P2 | ✅ covered | 测试覆盖 |

---

## 3. hero-config (hero-config.ts) — 22节点

### 3.1 武将定义配置 — 12节点

| ID | 维度 | 场景 | 优先级 | R2状态 | R1变化 |
|----|------|------|--------|--------|--------|
| HC-N01 | GENERAL_DEFS | 20个武将定义完整性 | P1 | ✅ covered | R2验证 |
| HC-N02 | GENERAL_DEF_MAP | ID→定义映射正确性 | P1 | ✅ covered | R2验证 |
| HC-N03 | QUALITY_MULTIPLIERS | 5个品质系数完整性 | P2 | ✅ covered | R2验证 |
| HC-N04 | POWER_WEIGHTS | 4个属性权重 | P2 | ✅ covered | R2验证 |
| HC-B01 | GENERAL_DEFS | 新增6名武将(lushu等)碎片获取路径断裂 | P0 | ⚠️ uncovered | R2维持(吸收CH-NEW-005/006) |
| HC-B02 | GENERAL_DEF_MAP | ID与HERO_FACTION_MAP武将ID集合一致性 | P0 | ⚠️ uncovered | R2新增(吸收Arbiter发现3) |
| HC-B03 | LEVEL_EXP_TABLE | 10段经验表递增验证 | P2 | ✅ covered | R2验证 |
| HC-B04 | LEVEL_EXP_TABLE | 91~100级经验需求节奏评估 | P1 | ⚠️ uncovered | R2新增(吸收CH-NEW-007) |
| HC-B05 | DUPLICATE_FRAGMENT_COUNT | 5个品质碎片数量 | P2 | ✅ covered | R2验证 |
| HC-B06 | STAR_UP_FRAGMENT_COST | 6级碎片消耗递增 | P2 | ✅ covered | R2验证 |
| HC-B07 | SYNTHESIZE_REQUIRED_FRAGMENTS | 5个品质合成碎片数 | P2 | ✅ covered | R2验证 |
| HC-B08 | HERO_MAX_LEVEL=50 | 注释说fallback但实际由突破决定 | P1 | ⚠️ uncovered | R2新增(吸收XC-C10) |

### 3.2 配置交叉验证 — 10节点

| ID | 维度 | 场景 | 优先级 | R2状态 | R1变化 |
|----|------|------|--------|--------|--------|
| HC-C01 | 交叉验证 | GENERAL_DEF_MAP武将ID ⊇ SHOP_FRAGMENT_EXCHANGE武将ID | P0 | ⚠️ uncovered | R2新增(吸收CH-NEW-005) |
| HC-C02 | 交叉验证 | GENERAL_DEF_MAP武将ID ⊇ STAGE_FRAGMENT_DROPS武将ID | P0 | ⚠️ uncovered | R2新增(吸收CH-NEW-006) |
| HC-C03 | 交叉验证 | GENERAL_DEF_MAP武将ID ⊇ HERO_FACTION_MAP武将ID | P0 | ⚠️ uncovered | R2新增(吸收Arbiter发现3) |
| HC-C04 | 交叉验证 | GENERAL_DEF_MAP武将ID ⊇ PARTNER_BONDS requiredHeroes | P0 | ⚠️ uncovered | R2新增 |
| HC-C05 | 交叉验证 | GENERAL_DEF_MAP品质与QUALITY_MULTIPLIERS键一致 | P1 | ⚠️ uncovered | R2新增 |
| HC-C06 | 交叉验证 | LEVEL_EXP_TABLE覆盖1~100级无间隙 | P1 | ✅ covered | R2验证 |
| HC-C07 | 交叉验证 | DUPLICATE_FRAGMENT_COUNT覆盖所有品质 | P1 | ✅ covered | R2验证 |
| HC-C08 | 交叉验证 | STAR_UP_FRAGMENT_COST长度与MAX_STAR_LEVEL一致 | P1 | ✅ covered | R2验证 |
| HC-C09 | 交叉验证 | 新增6名武将(lushu/huanggai/ganning/xuhuang/zhangliao/weiyan)在SHOP_FRAGMENT_EXCHANGE中 | P0 | ⚠️ uncovered | R2新增(吸收CH-NEW-005) |
| HC-C10 | 交叉验证 | 新增6名武将在STAGE_FRAGMENT_DROPS中 | P0 | ⚠️ uncovered | R2新增(吸收CH-NEW-006) |

---

## 4. hero-recruit-config (hero-recruit-config.ts) — 18节点

### 4.1 招募配置 — 10节点

| ID | 维度 | 场景 | 优先级 | R2状态 | R1变化 |
|----|------|------|--------|--------|--------|
| HRC-N01 | RECRUIT_COSTS | normal/advanced两种类型配置 | P2 | ✅ covered | R2验证 |
| HRC-N02 | RECRUIT_RATES | normal/advanced概率配置 | P1 | ✅ covered | R2验证 |
| HRC-N03 | RECRUIT_PITY | 保底阈值配置 | P1 | ✅ covered | R2验证 |
| HRC-N04 | DAILY_FREE_CONFIG | 每日免费次数配置 | P1 | ✅ covered | R2验证 |
| HRC-B01 | RECRUIT_COSTS | normal和advanced使用同一资源类型(recruitToken)→普通池无意义 | P1 | ⚠️ uncovered | R2新增(吸收CH-NEW-008) |
| HRC-B02 | RECRUIT_RATES | normal池LEGENDARY概率=0%→设计合理性 | P1 | ⚠️ uncovered | R2新增 |
| HRC-B03 | TEN_PULL_DISCOUNT | 十连折扣值正确性 | P1 | ✅ covered | R2验证 |
| HRC-B04 | UP_HERO_DESCRIPTIONS | 仅覆盖9个武将→非覆盖列表UP时description为空 | P1 | ⚠️ uncovered | R2新增(吸收XC-C08) |
| HRC-B05 | RECRUIT_PITY | tenPullThreshold和hardPityThreshold值合理性 | P1 | ✅ covered | R2验证 |
| HRC-B06 | RECRUIT_SAVE_VERSION | 版本号与实际序列化一致 | P2 | ✅ covered | R2验证 |

### 4.2 概率/保底验证 — 8节点

| ID | 维度 | 场景 | 优先级 | R2状态 | R1变化 |
|----|------|------|--------|--------|--------|
| HRC-N05 | 概率公平性 | advanced池概率总和=100% | P1 | ✅ covered | R2验证(CH Part C确认) |
| HRC-N06 | 概率公平性 | normal池概率总和=100% | P1 | ✅ covered | R2验证 |
| HRC-B07 | 保底机制 | 十连保底RARE正确触发 | P1 | ✅ covered | 测试覆盖 |
| HRC-B08 | 保底机制 | 100抽硬保底LEGENDARY正确触发 | P1 | ✅ covered | 测试覆盖 |
| HRC-B09 | 保底机制 | 保底计数器跨会话持久化→序列化正确性 | P1 | ✅ covered | 测试覆盖 |
| HRC-B10 | 保底机制 | 保底计数器崩溃丢失→Arbiter发现5 | P1 | ⚠️ uncovered | R2新增(吸收Arbiter发现5) |
| HRC-B11 | 期望值 | 高级池单抽期望值计算 | P2 | ✅ covered | R2验证 |
| HRC-B12 | 经济模型 | 1000 recruitToken保底一个LEGENDARY是否合理 | P2 | ⚠️ uncovered | R2新增 |

---

## 5. star-up-config (star-up-config.ts) — 22节点

### 5.1 升星配置 — 12节点

| ID | 维度 | 场景 | 优先级 | R2状态 | R1变化 |
|----|------|------|--------|--------|--------|
| SRC-N01 | STAR_MULTIPLIERS | 7个星级倍率(0~6) | P2 | ✅ covered | R2验证 |
| SRC-N02 | STAR_UP_FRAGMENT_COST | 6级碎片消耗 | P2 | ✅ covered | R2验证 |
| SRC-N03 | STAR_UP_GOLD_COST | 6级铜钱消耗 | P2 | ✅ covered | R2验证 |
| SRC-N04 | BREAKTHROUGH_TIERS | 5个突破阶段配置 | P2 | ✅ covered | R2验证 |
| SRC-N05 | STAGE_FRAGMENT_DROPS | 关卡掉落配置 | P1 | ✅ covered | R2验证 |
| SRC-N06 | SHOP_FRAGMENT_EXCHANGE | 商店兑换配置 | P1 | ✅ covered | R2验证 |
| SRC-B01 | STAR_MULTIPLIERS | 索引0和1都是1.0→注释混乱但不影响正确性 | P1 | ⚠️ uncovered | R2新增(吸收CH-NEW-004) |
| SRC-B02 | getStarMultiplier | star=0→返回STAR_MULTIPLIERS[0]=1.0→0星不应有倍率 | P1 | ⚠️ uncovered | R2新增(吸收CH-NEW-004) |
| SRC-B03 | getStarMultiplier | star=NaN→STAR_MULTIPLIERS[NaN]=undefined→NaN传播 | P0 | ⚠️ uncovered | R2新增 |
| SRC-B04 | getStarMultiplier | star=7(超出)→STAR_MULTIPLIERS[7]=undefined→NaN | P0 | ⚠️ uncovered | R2新增 |
| SRC-B05 | BREAKTHROUGH_TIERS | levelCap递增验证(50/60/70/80/100) | P1 | ✅ covered | R2验证 |
| SRC-B06 | MAX_BREAKTHROUGH_STAGE | 与BREAKTHROUGH_TIERS长度一致 | P2 | ✅ covered | R2验证 |

### 5.2 配置交叉验证 — 10节点

| ID | 维度 | 场景 | 优先级 | R2状态 | R1变化 |
|----|------|------|--------|--------|--------|
| SRC-C01 | 交叉验证 | SHOP_FRAGMENT_EXCHANGE generalId在GENERAL_DEF_MAP中存在 | P0 | ⚠️ uncovered | R2新增 |
| SRC-C02 | 交叉验证 | STAGE_FRAGMENT_DROPS generalId在GENERAL_DEF_MAP中存在 | P0 | ⚠️ uncovered | R2新增 |
| SRC-C03 | 交叉验证 | SHOP_FRAGMENT_EXCHANGE dailyLimit>0 | P1 | ✅ covered | R2验证 |
| SRC-C04 | 交叉验证 | SHOP_FRAGMENT_EXCHANGE pricePerFragment>0 | P1 | ✅ covered | R2验证 |
| SRC-C05 | 交叉验证 | STAGE_FRAGMENT_DROPS dropRange.min>0 | P1 | ✅ covered | R2验证 |
| SRC-C06 | 交叉验证 | STAGE_FRAGMENT_DROPS dropRange.max>=min | P1 | ✅ covered | R2验证 |
| SRC-C07 | 交叉验证 | SHOP_FRAGMENT_EXCHANGE dailyLimit与HeroStarSystem.exchangeFragmentsFromShop限购执行一致 | P0 | ⚠️ uncovered | R2新增(吸收XC-C07) |
| SRC-C08 | 交叉验证 | 新增6名武将(lushu等)在SHOP_FRAGMENT_EXCHANGE中→**缺失** | P0 | ⚠️ uncovered | R2维持(吸收CH-NEW-005) |
| SRC-C09 | 交叉验证 | 新增6名武将在STAGE_FRAGMENT_DROPS中→**缺失** | P0 | ⚠️ uncovered | R2维持(吸收CH-NEW-006) |
| SRC-C10 | 交叉验证 | STAR_UP_FRAGMENT_COST长度=MAX_STAR_LEVEL | P1 | ✅ covered | R2验证 |

---

## 6. hero.types (hero.types.ts) — 10节点

| ID | 维度 | 场景 | 优先级 | R2状态 | R1变化 |
|----|------|------|--------|--------|--------|
| HT-N01 | Quality枚举 | 5个品质(COMMON/FINE/RARE/EPIC/LEGENDARY) | P2 | ✅ covered | R2验证 |
| HT-N02 | QUALITY_ORDER | 品质排序映射 | P2 | ✅ covered | R2验证 |
| HT-N03 | GeneralData接口 | 字段完整性(id/name/quality/baseStats/level/exp/faction/skills) | P2 | ✅ covered | R2验证 |
| HT-N04 | GeneralStats接口 | 4个属性(attack/defense/intelligence/speed) | P2 | ✅ covered | R2验证 |
| HT-B01 | Faction类型 | 'wei'/'shu'/'wu'/'qun'与faction-bond-config的'neutral'不一致 | P0 | ⚠️ uncovered | R2新增(吸收CH-021) |
| HT-B02 | SkillData接口 | level字段默认值 | P2 | ✅ covered | R2验证 |
| HT-B03 | Quality枚举 | 缺少NONE/INVALID→quality=undefined时无fallback | P1 | ⚠️ uncovered | R2新增 |
| HT-B04 | QUALITY_ORDER | 缺少默认值→QUALITY_ORDER[undefined]=undefined→NaN | P0 | ⚠️ uncovered | R2新增 |
| HT-B05 | Faction类型 | 与BuildingType等shared/types的兼容性 | P1 | ⚠️ uncovered | R2新增 |
| HT-B06 | HeroState接口 | generals/fragments字段可选性 | P2 | ✅ covered | R2验证 |

---

## 7. formation-types (formation-types.ts) — 10节点

| ID | 维度 | 场景 | 优先级 | R2状态 | R1变化 |
|----|------|------|--------|--------|--------|
| FT-N01 | MAX_FORMATIONS | 值=3 | P2 | ✅ covered | R2验证 |
| FT-N02 | MAX_SLOTS_PER_FORMATION | 值=6 | P2 | ✅ covered | R2验证 |
| FT-N03 | FORMATION_CREATE_REQUIRED_CASTLE_LEVEL | 前置条件值 | P2 | ✅ covered | R2验证 |
| FT-N04 | FORMATION_CREATE_COST_COPPER | 创建编队铜钱消耗 | P2 | ✅ covered | R2验证 |
| FT-B01 | FORMATION_BOND_BONUS_RATE | 5%/羁绊与BondSystem计算结果不一致 | P0 | ⚠️ uncovered | R2新增(吸收XC-C01) |
| FT-B02 | DEFAULT_NAMES | 编队ID与名称映射完整性 | P2 | ✅ covered | R2验证 |
| FT-B03 | FormationData接口 | id/name/slots字段完整性 | P2 | ✅ covered | R2验证 |
| FT-B04 | FormationState接口 | formations/activeFormationId字段 | P2 | ✅ covered | R2验证 |
| FT-B05 | MAX_FORMATIONS与setMaxFormations | 上限可扩展到5但DEFAULT_NAMES可能不足 | P1 | ⚠️ uncovered | R2新增 |
| FT-B06 | FormationSaveData接口 | version/state字段 | P2 | ✅ covered | R2验证 |

---

## 8. recruit-types (recruit-types.ts) — 12节点

| ID | 维度 | 场景 | 优先级 | R2状态 | R1变化 |
|----|------|------|--------|--------|--------|
| RT-N01 | PityState接口 | 4个计数器(normalPity/advancedPity/normalHardPity/advancedHardPity) | P2 | ✅ covered | R2验证 |
| RT-N02 | RecruitResult接口 | quality/general/isNew字段 | P2 | ✅ covered | R2验证 |
| RT-N03 | RecruitOutput接口 | type/results/cost字段 | P2 | ✅ covered | R2验证 |
| RT-N04 | createEmptyPity | 返回全0计数器 | P2 | ✅ covered | R2验证 |
| RT-B01 | rollQuality | rates=null→崩溃 | P0 | ⚠️ uncovered | R2新增 |
| RT-B02 | rollQuality | rates总和≠1→概率分布偏差 | P1 | ⚠️ uncovered | R2新增 |
| RT-B03 | applyPity | quality=LEGENDARY但pityCount未达阈值→不触发保底 | P1 | ✅ covered | 测试覆盖 |
| RT-B04 | applyPity | hardPityCount>=hardPityThreshold→强制LEGENDARY | P1 | ✅ covered | 测试覆盖 |
| RT-B05 | pickGeneralByQuality | quality=LEGENDARY但无LEGENDARY武将→返回null | P1 | ⚠️ uncovered | R2新增 |
| RT-B06 | MAX_HISTORY_SIZE | 值=10→历史记录截断 | P2 | ✅ covered | R2验证 |
| RT-B07 | todayDateString | 返回格式YYYY-MM-DD | P2 | ✅ covered | R2验证 |
| RT-B08 | RecruitDeps接口 | heroSystem/spendResource/canAffordResource完整性 | P1 | ✅ covered | R2验证 |

---

## 9. index.ts (index.ts) — 6节点

| ID | 维度 | 场景 | 优先级 | R2状态 | R1变化 |
|----|------|------|--------|--------|--------|
| IX-N01 | 导出 | 所有子系统正确导出 | P2 | ✅ covered | R2验证 |
| IX-N02 | 导出 | 所有类型正确导出 | P2 | ✅ covered | R2验证 |
| IX-B01 | 导出 | BondSystem(hero层)和BondSystem(engine层)命名冲突 | P0 | ⚠️ uncovered | R2新增 |
| IX-B02 | 导出 | BondEffect(bond-config)和BondEffect(faction-bond-config)命名冲突 | P0 | ⚠️ uncovered | R2新增 |
| IX-B03 | 导出 | 缺少SkillUpgradeSystem的serialize/deserialize导出 | P1 | ⚠️ uncovered | R2新增 |
| IX-B04 | 导出 | 新增6名武将的配置导出完整性 | P0 | ⚠️ uncovered | R2新增 |

---

## Part C 统计

| 维度 | 节点数 | covered | uncovered | P0 | P1 | P2 |
|------|--------|---------|-----------|-----|-----|-----|
| FormationRecommendSystem | 36 | 16 | 20 | 10 | 12 | 14 |
| HeroDispatchSystem | 30 | 18 | 12 | 6 | 14 | 10 |
| hero-config | 22 | 10 | 12 | 6 | 6 | 10 |
| hero-recruit-config | 18 | 12 | 6 | 0 | 10 | 8 |
| star-up-config | 22 | 12 | 10 | 4 | 8 | 10 |
| hero.types | 10 | 5 | 5 | 2 | 2 | 6 |
| formation-types | 10 | 7 | 3 | 1 | 1 | 8 |
| recruit-types | 12 | 8 | 4 | 1 | 3 | 8 |
| index.ts | 6 | 2 | 4 | 2 | 1 | 2 |
| **Part C 合计** | **166** | **90** | **76** | **32** | **57** | **76** |

### R1→R2 变化

| 指标 | R1 | R2 | 变化 |
|------|----|----|------|
| 总节点 | 243 | 166 | -77(精简重复+合并配置节点) |
| covered | ~186 | 90 | -96(重新校准covered标准) |
| uncovered | ~47 | 76 | +29(吸收R1挑战+新增路径) |
| P0 | ~42 | 32 | -10(4个P0降级为P1+合并同类) |

### 关键改进

1. **FormationRecommend算法缺陷**: FR-B09/B10/B11标注3个算法正确性问题(吸收CH-NEW-001/002/003)
2. **配置交叉验证**: HC-C01~C10, SRC-C01~C10新增20个配置一致性节点
3. **新增武将碎片路径**: HC-C09/C10, SRC-C08/C09标注6名武将碎片获取断裂
4. **FIX-004验证**: FR-B01/B02/B04确认FormationRecommend null guard有效
5. **covered校准**: R1虚报率21%→R2严格区分covered/uncovered
6. **HeroDispatch降级**: HD-B02从P0降为P1(空字符串buildingType有清理路径)
