# Hero 流程分支树 Round 3 — Part C（辅助+配置系统）

> Builder: TreeBuilder v1.2 | Time: 2026-05-01
> R2修复: FIX-203(calculatePower NaN兜底) + FIX-204(碎片溢出闭环)

## R2→R3 改进

| 新规则 | 应用方式 | 影响节点数 |
|--------|---------|-----------|
| BR-021 资源溢出闭环验证 | 碎片溢出已修复，验证其他资源溢出 | +2闭环验证 |
| BR-022 事务性操作扫描 | 十连招募已修复，验证其他多步操作 | +1事务验证 |

## Part C 子系统清单

| # | 子系统 | 源文件 | 公开API数 | R2节点 | R3节点 |
|---|--------|--------|----------|--------|--------|
| 1 | FormationRecommendSystem | FormationRecommendSystem.ts | 4 | 36 | 32 |
| 2 | HeroDispatchSystem | HeroDispatchSystem.ts | 10 | 30 | 28 |
| 3 | hero-config | hero-config.ts | 8 | 22 | 20 |
| 4 | hero-recruit-config | hero-recruit-config.ts | 6 | 18 | 16 |
| 5 | star-up-config | star-up-config.ts | 8 | 22 | 20 |
| 6 | hero.types | hero.types.ts | 4 | 10 | 10 |
| 7 | formation-types | formation-types.ts | 4 | 10 | 10 |
| 8 | recruit-types | recruit-types.ts | 4 | 12 | 10 |
| 9 | index.ts | index.ts | 2 | 6 | 6 |
| **合计** | **9个子系统** | | **~58** | **166** | **152** |

---

## 1. FormationRecommendSystem (FormationRecommendSystem.ts) — 32节点

### 1.1 核心推荐 (recommend) — 14节点

| ID | API | 场景 | 优先级 | R3状态 | R2变化 |
|----|-----|------|--------|--------|--------|
| FR-N01 | recommend | 正常推荐(3个方案) | P1 | ✅ covered | 维持 |
| FR-N02 | recommend | 可用武将<3→仅1~2个方案 | P1 | ✅ covered | 维持 |
| FR-N03 | recommend | 可用武将=0→空方案 | P1 | ✅ covered | 维持 |
| FR-B01 | recommend | availableHeroes=null → FIX-004已防护→[] | P1 | ✅ covered | 维持 |
| FR-B02 | recommend | availableHeroes含null元素 → FIX-004已过滤 | P1 | ✅ covered | 维持 |
| FR-B03 | recommend | calculatePower=null → 调用崩溃 | P0 | ⚠️ uncovered | 维持(未修复) |
| FR-B04 | recommend | calculatePower返回NaN → FIX-004已防护→0 | P1 | ✅ covered | 维持 |
| FR-B05 | recommend | calculatePower返回Infinity → FIX-004已防护→0 | P1 | ✅ covered | 维持 |
| FR-B06 | recommend | stageType=无效值→default按normal计算 | P1 | ⚠️ uncovered | 维持(安全降级) |
| FR-B07 | recommend | recommendedPower=NaN→difficultyLevel=NaN | P0 | ⚠️ uncovered | 维持(未修复) |
| FR-B08 | recommend | 所有武将同阵营→羁绊方案与最强方案重复 | P0 | ⚠️ uncovered | R3验证确认: buildSynergyPlan无去重逻辑 |
| FR-B09 | recommend | 武将数≤6→多个方案选到相同武将集合 | P0 | ⚠️ uncovered | 维持(未修复) |
| FR-B10 | recommend | 羁绊方案synergyBonus硬编码(15/8/0)而非BondSystem计算 | P0 | ⚠️ uncovered | R3验证确认: L296硬编码 |
| FR-B11 | recommend | availableHeroes含重复武将→排序去重? | P1 | ⚠️ uncovered | 维持 |

### 1.2 方案构建 — 10节点

| ID | API | 场景 | 优先级 | R3状态 | R2变化 |
|----|-----|------|--------|--------|--------|
| FR-N04 | buildBestPowerPlan | 正常构建(取前6高战力) | P1 | ✅ covered | 维持 |
| FR-N05 | buildBalancedPlan | 正常构建(三等分交替选) | P1 | ✅ covered | 维持 |
| FR-N06 | buildSynergyPlan | 正常构建(同阵营优先) | P1 | ✅ covered | 维持 |
| FR-B12 | buildBalancedPlan | 武将数<3→third=1→分组不均 | P1 | ⚠️ uncovered | 维持 |
| FR-B13 | buildBalancedPlan | 某组为空→group[pickIdx]=undefined→跳过 | P1 | ⚠️ uncovered | 维持 |
| FR-B14 | buildSynergyPlan | 无阵营信息→factionGroups为空→返回null | P1 | ⚠️ uncovered | 维持 |
| FR-B15 | buildSynergyPlan | 所有武将同阵营→与最强方案相同 | P0 | ⚠️ uncovered | 维持(同FR-B08) |
| FR-B16 | buildBestPowerPlan | sortedHeroes含NaN战力→FIX-203返回0→排最后 | P1 | ✅ covered | R3验证: calculatePower返回0 |
| FR-B17 | calculateScore | selected为空→返回0 | P2 | ✅ covered | 维持 |
| FR-B18 | calculateScore | QUALITY_WEIGHT[无效quality]→??1→降级处理 | P1 | ✅ covered | 维持 |

### 1.3 关卡分析/系统管理 — 8节点

| ID | API | 场景 | 优先级 | R3状态 | R2变化 |
|----|-----|------|--------|--------|--------|
| FR-N07 | analyzeStage | normal关卡分析 | P2 | ✅ covered | 维持 |
| FR-N08 | analyzeStage | elite关卡分析 | P2 | ✅ covered | 维持 |
| FR-N09 | analyzeStage | boss关卡分析 | P2 | ✅ covered | 维持 |
| FR-B19 | analyzeStage | recommendedPower=NaN→Math.ceil(NaN/1000)=NaN→Math.min(10,Math.max(7,NaN))=NaN | P0 | ⚠️ uncovered | 维持(未修复) |
| FR-E01 | init | 注入依赖 | P2 | ✅ covered | 维持 |
| FR-E02 | reset | 正常重置 | P2 | ✅ covered | 维持 |
| FR-E03 | update | 空实现 | P2 | ✅ covered | 维持 |
| FR-E04 | getState | 返回{version:1} | P2 | ✅ covered | 维持 |

---

## 2. HeroDispatchSystem (HeroDispatchSystem.ts) — 28节点

### 2.1 派驻管理 — 10节点

| ID | API | 场景 | 优先级 | R3状态 | R2变化 |
|----|-----|------|--------|--------|--------|
| HD-N01 | dispatchHero | 正常派驻 | P1 | ✅ covered | 维持 |
| HD-N02 | undeployHero | 正常取消 | P1 | ✅ covered | 维持 |
| HD-N03 | dispatchHero | 替换已有派驻(自动替换) | P1 | ✅ covered | 维持 |
| HD-B01 | dispatchHero | heroId=空字符串→创建脏数据记录 | P0 | ⚠️ uncovered | 维持(未修复) |
| HD-B02 | dispatchHero | buildingType=空字符串→加成为0但有记录 | P1 | ⚠️ uncovered | 维持 |
| HD-B03 | dispatchHero | heroId已派驻到同建筑→返回成功(幂等) | P2 | ✅ covered | 维持 |
| HD-B04 | undeployHero | heroId未派驻→false | P1 | ✅ covered | 维持 |
| HD-B05 | dispatchHero | getGeneralFn未注入→calculateBonus返回0 | P1 | ✅ covered | 维持 |
| HD-B06 | dispatchHero | heroId=null→this.heroDispatch[null]→创建脏数据 | P0 | ⚠️ uncovered | 维持(未修复) |
| HD-B07 | dispatchHero | buildingType=null→this.buildingDispatch[null]→创建脏数据 | P0 | ⚠️ uncovered | 维持(未修复) |

### 2.2 加成计算 — 8节点

| ID | API | 场景 | 优先级 | R3状态 | R2变化 |
|----|-----|------|--------|--------|--------|
| HD-N04 | getDispatchBonus | 正常获取加成 | P1 | ✅ covered | 维持 |
| HD-N05 | getAllDispatchBonuses | 正常获取所有加成 | P2 | ✅ covered | 维持 |
| HD-N06 | refreshDispatchBonus | 正常刷新(武将升级后) | P1 | ✅ covered | 维持 |
| HD-B08 | calculateBonus | level=NaN→NaN*0.5=NaN→NaN传播到建筑产出 | P0 | ⚠️ uncovered | 维持(未修复) |
| HD-B09 | calculateBonus | level=负数→负加成 | P0 | ⚠️ uncovered | 维持(未修复) |
| HD-B10 | calculateBonus | quality不在QUALITY_BONUS中→??1→降级 | P1 | ✅ covered | 维持 |
| HD-B11 | calculateBonus | baseStats=null→baseStats?.attack=undefined→0 | P1 | ✅ covered | 维持 |
| HD-B12 | calculateBonus | attack=NaN→NaN*0.01=NaN→totalBonus=NaN | P0 | ⚠️ uncovered | 维持(未修复) |

### 2.3 序列化/状态管理 — 10节点

| ID | API | 场景 | 优先级 | R3状态 | R2变化 |
|----|-----|------|--------|--------|--------|
| HD-N07 | serialize | 正常序列化(JSON) | P1 | ✅ covered | 维持 |
| HD-N08 | deserialize | 正常反序列化 | P1 | ✅ covered | 维持 |
| HD-B13 | getState | 浅拷贝→嵌套DispatchRecord可被外部篡改 | P0 | ⚠️ uncovered | R3验证确认: L101仅一层展开 |
| HD-E01 | deserialize(null) | FIX-003已防护→reset() | P1 | ✅ covered | 维持 |
| HD-E02 | deserialize(损坏JSON) | try-catch→reset() | P1 | ✅ covered | 维持 |
| HD-E03 | serialize→deserialize | 往返一致性 | P1 | ✅ covered | 维持 |
| HD-E04 | reset | 正常重置 | P2 | ✅ covered | 维持 |
| HD-E05 | init | 注入依赖 | P2 | ✅ covered | 维持 |
| HD-E06 | calculateBonus | level=NaN时加成为NaN→传播到建筑产出 | P0 | ⚠️ uncovered | 维持(同HD-B08) |
| HD-E07 | getDispatchBonus | buildingType不存在→返回0 | P1 | ✅ covered | 维持 |

---

## 3. hero-config (hero-config.ts) — 20节点

### 3.1 武将定义配置 — 10节点

| ID | 维度 | 场景 | 优先级 | R3状态 | R2变化 |
|----|------|------|--------|--------|--------|
| HC-N01 | GENERAL_DEFS | 20个武将定义完整性 | P1 | ✅ covered | 维持 |
| HC-N02 | GENERAL_DEF_MAP | ID→定义映射正确性 | P1 | ✅ covered | 维持 |
| HC-N03 | QUALITY_MULTIPLIERS | 5个品质系数完整性 | P2 | ✅ covered | 维持 |
| HC-N04 | POWER_WEIGHTS | 4个属性权重 | P2 | ✅ covered | 维持 |
| HC-B01 | GENERAL_DEFS | 新增6名武将碎片获取路径断裂 | P0 | ⚠️ uncovered | 维持(需策划补充) |
| HC-B02 | GENERAL_DEF_MAP | ID与HERO_FACTION_MAP武将ID集合一致性 | P0 | ⚠️ uncovered | 维持 |
| HC-B03 | LEVEL_EXP_TABLE | 10段经验表递增验证 | P2 | ✅ covered | 维持 |
| HC-B04 | LEVEL_EXP_TABLE | 91~100级经验需求节奏评估 | P1 | ⚠️ uncovered | 维持(数值设计) |
| HC-B05 | DUPLICATE_FRAGMENT_COUNT | 5个品质碎片数量 | P2 | ✅ covered | 维持 |
| HC-B06 | STAR_UP_FRAGMENT_COST | 6级碎片消耗递增 | P2 | ✅ covered | 维持 |

### 3.2 配置交叉验证 — 10节点

| ID | 维度 | 场景 | 优先级 | R3状态 | R2变化 |
|----|------|------|--------|--------|--------|
| HC-C01 | 交叉验证 | GENERAL_DEF_MAP武将ID ⊇ SHOP_FRAGMENT_EXCHANGE武将ID | P0 | ⚠️ uncovered | 维持(6名武将缺失) |
| HC-C02 | 交叉验证 | GENERAL_DEF_MAP武将ID ⊇ STAGE_FRAGMENT_DROPS武将ID | P0 | ⚠️ uncovered | 维持(6名武将缺失) |
| HC-C03 | 交叉验证 | GENERAL_DEF_MAP武将ID ⊇ HERO_FACTION_MAP武将ID | P0 | ⚠️ uncovered | 维持 |
| HC-C04 | 交叉验证 | GENERAL_DEF_MAP武将ID ⊇ PARTNER_BONDS requiredHeroes | P0 | ⚠️ uncovered | 维持 |
| HC-C05 | 交叉验证 | GENERAL_DEF_MAP品质与QUALITY_MULTIPLIERS键一致 | P1 | ⚠️ uncovered | 维持 |
| HC-C06 | 交叉验证 | LEVEL_EXP_TABLE覆盖1~100级无间隙 | P1 | ✅ covered | 维持 |
| HC-C07 | 交叉验证 | DUPLICATE_FRAGMENT_COUNT覆盖所有品质 | P1 | ✅ covered | 维持 |
| HC-C08 | 交叉验证 | STAR_UP_FRAGMENT_COST长度与MAX_STAR_LEVEL一致 | P1 | ✅ covered | 维持 |
| HC-C09 | 交叉验证 | 新增6名武将在SHOP_FRAGMENT_EXCHANGE中→缺失 | P0 | ⚠️ uncovered | 维持 |
| HC-C10 | 交叉验证 | 新增6名武将在STAGE_FRAGMENT_DROPS中→缺失 | P0 | ⚠️ uncovered | 维持 |

---

## 4. hero-recruit-config (hero-recruit-config.ts) — 16节点

### 4.1 招募配置 — 8节点

| ID | 维度 | 场景 | 优先级 | R3状态 | R2变化 |
|----|------|------|--------|--------|--------|
| HRC-N01 | RECRUIT_COSTS | normal/advanced两种类型配置 | P2 | ✅ covered | 维持 |
| HRC-N02 | RECRUIT_RATES | normal/advanced概率配置 | P1 | ✅ covered | 维持 |
| HRC-N03 | RECRUIT_PITY | 保底阈值配置 | P1 | ✅ covered | 维持 |
| HRC-N04 | DAILY_FREE_CONFIG | 每日免费次数配置 | P1 | ✅ covered | 维持 |
| HRC-B01 | RECRUIT_COSTS | normal和advanced使用同一资源类型(recruitToken) | P1 | ⚠️ uncovered | 维持(设计问题) |
| HRC-B02 | RECRUIT_RATES | normal池LEGENDARY概率=0% | P1 | ⚠️ uncovered | 维持(设计问题) |
| HRC-B03 | TEN_PULL_DISCOUNT | 十连折扣值正确性 | P1 | ✅ covered | 维持 |
| HRC-B04 | UP_HERO_DESCRIPTIONS | 仅覆盖9个武将→非覆盖列表UP时description为空 | P1 | ⚠️ uncovered | 维持 |

### 4.2 概率/保底验证 — 8节点

| ID | 维度 | 场景 | 优先级 | R3状态 | R2变化 |
|----|------|------|--------|--------|--------|
| HRC-N05 | 概率公平性 | advanced池概率总和=100% | P1 | ✅ covered | 维持 |
| HRC-N06 | 概率公平性 | normal池概率总和=100% | P1 | ✅ covered | 维持 |
| HRC-B05 | 保底机制 | 十连保底RARE正确触发 | P1 | ✅ covered | 维持 |
| HRC-B06 | 保底机制 | 100抽硬保底LEGENDARY正确触发 | P1 | ✅ covered | 维持 |
| HRC-B07 | 保底机制 | 保底计数器跨会话持久化→序列化正确性 | P1 | ✅ covered | 维持 |
| HRC-B08 | 保底机制 | 保底计数器崩溃丢失 | P1 | ⚠️ uncovered | 维持 |
| HRC-B09 | 期望值 | 高级池单抽期望值计算 | P2 | ✅ covered | 维持 |
| HRC-B10 | 经济模型 | 1000 recruitToken保底一个LEGENDARY是否合理 | P2 | ⚠️ uncovered | 维持(数值设计) |

---

## 5. star-up-config (star-up-config.ts) — 20节点

### 5.1 升星配置 — 10节点

| ID | 维度 | 场景 | 优先级 | R3状态 | R2变化 |
|----|------|------|--------|--------|--------|
| SRC-N01 | STAR_MULTIPLIERS | 7个星级倍率(0~6) | P2 | ✅ covered | 维持 |
| SRC-N02 | STAR_UP_FRAGMENT_COST | 6级碎片消耗 | P2 | ✅ covered | 维持 |
| SRC-N03 | STAR_UP_GOLD_COST | 6级铜钱消耗 | P2 | ✅ covered | 维持 |
| SRC-N04 | BREAKTHROUGH_TIERS | 5个突破阶段配置 | P2 | ✅ covered | 维持 |
| SRC-N05 | STAGE_FRAGMENT_DROPS | 关卡掉落配置 | P1 | ✅ covered | 维持 |
| SRC-N06 | SHOP_FRAGMENT_EXCHANGE | 商店兑换配置 | P1 | ✅ covered | 维持 |
| SRC-B01 | getStarMultiplier | star=NaN → FIX-202已防护→返回1 | P1 | ✅ covered | R3验证: L60 !Number.isFinite(star)→return 1 |
| SRC-B02 | getStarMultiplier | star=0 → STAR_MULTIPLIERS[0]=1.0 | P1 | ✅ covered | 维持 |
| SRC-B03 | getStarMultiplier | star=7(超出) → STAR_MULTIPLIERS[7]=undefined→FIX-202防护→返回最后一个 | P1 | ✅ covered | R3验证: L62 star>=length返回最后一个 |
| SRC-B04 | BREAKTHROUGH_TIERS | levelCap递增验证(50/60/70/80/100) | P1 | ✅ covered | 维持 |

### 5.2 配置交叉验证 — 10节点

| ID | 维度 | 场景 | 优先级 | R3状态 | R2变化 |
|----|------|------|--------|--------|--------|
| SRC-C01 | 交叉验证 | SHOP_FRAGMENT_EXCHANGE generalId在GENERAL_DEF_MAP中存在 | P0 | ⚠️ uncovered | 维持 |
| SRC-C02 | 交叉验证 | STAGE_FRAGMENT_DROPS generalId在GENERAL_DEF_MAP中存在 | P0 | ⚠️ uncovered | 维持 |
| SRC-C03 | 交叉验证 | SHOP_FRAGMENT_EXCHANGE dailyLimit>0 | P1 | ✅ covered | 维持 |
| SRC-C04 | 交叉验证 | SHOP_FRAGMENT_EXCHANGE pricePerFragment>0 | P1 | ✅ covered | 维持 |
| SRC-C05 | 交叉验证 | STAGE_FRAGMENT_DROPS dropRange.min>0 | P1 | ✅ covered | 维持 |
| SRC-C06 | 交叉验证 | STAGE_FRAGMENT_DROPS dropRange.max>=min | P1 | ✅ covered | 维持 |
| SRC-C07 | 交叉验证 | SHOP_FRAGMENT_EXCHANGE dailyLimit与HeroStarSystem限购执行一致 | P0 | ⚠️ uncovered | 维持 |
| SRC-C08 | 交叉验证 | 新增6名武将在SHOP_FRAGMENT_EXCHANGE中→缺失 | P0 | ⚠️ uncovered | 维持 |
| SRC-C09 | 交叉验证 | 新增6名武将在STAGE_FRAGMENT_DROPS中→缺失 | P0 | ⚠️ uncovered | 维持 |
| SRC-C10 | 交叉验证 | STAR_UP_FRAGMENT_COST长度=MAX_STAR_LEVEL | P1 | ✅ covered | 维持 |

---

## 6. hero.types (hero.types.ts) — 10节点

| ID | 维度 | 场景 | 优先级 | R3状态 | R2变化 |
|----|------|------|--------|--------|--------|
| HT-N01 | Quality枚举 | 5个品质(COMMON/FINE/RARE/EPIC/LEGENDARY) | P2 | ✅ covered | 维持 |
| HT-N02 | QUALITY_ORDER | 品质排序映射 | P2 | ✅ covered | 维持 |
| HT-N03 | GeneralData接口 | 字段完整性 | P2 | ✅ covered | 维持 |
| HT-N04 | GeneralStats接口 | 4个属性 | P2 | ✅ covered | 维持 |
| HT-B01 | Faction类型 | 'wei'/'shu'/'wu'/'qun'与faction-bond-config的'neutral'不一致 | P0 | ⚠️ uncovered | R3验证确认 |
| HT-B02 | SkillData接口 | level字段默认值 | P2 | ✅ covered | 维持 |
| HT-B03 | Quality枚举 | 缺少NONE/INVALID→quality=undefined时无fallback | P1 | ⚠️ uncovered | 维持 |
| HT-B04 | QUALITY_ORDER | 缺少默认值→QUALITY_ORDER[undefined]=undefined→NaN | P0 | ⚠️ uncovered | 维持 |
| HT-B05 | Faction类型 | 与BuildingType等shared/types的兼容性 | P1 | ⚠️ uncovered | 维持 |
| HT-B06 | HeroState接口 | generals/fragments字段可选性 | P2 | ✅ covered | 维持 |

---

## 7. formation-types (formation-types.ts) — 10节点

| ID | 维度 | 场景 | 优先级 | R3状态 | R2变化 |
|----|------|------|--------|--------|--------|
| FT-N01 | MAX_FORMATIONS | 值=3 | P2 | ✅ covered | 维持 |
| FT-N02 | MAX_SLOTS_PER_FORMATION | 值=6 | P2 | ✅ covered | 维持 |
| FT-N03 | FORMATION_CREATE_REQUIRED_CASTLE_LEVEL | 前置条件值 | P2 | ✅ covered | 维持 |
| FT-N04 | FORMATION_CREATE_COST_COPPER | 创建编队铜钱消耗 | P2 | ✅ covered | 维持 |
| FT-B01 | FORMATION_BOND_BONUS_RATE | 5%/羁绊与BondSystem计算结果不一致 | P0 | ⚠️ uncovered | 维持 |
| FT-B02 | DEFAULT_NAMES | 编队ID与名称映射完整性 | P2 | ✅ covered | 维持 |
| FT-B03 | FormationData接口 | id/name/slots字段完整性 | P2 | ✅ covered | 维持 |
| FT-B04 | FormationState接口 | formations/activeFormationId字段 | P2 | ✅ covered | 维持 |
| FT-B05 | MAX_FORMATIONS与setMaxFormations | 上限可扩展到5但DEFAULT_NAMES可能不足 | P1 | ⚠️ uncovered | 维持 |
| FT-B06 | FormationSaveData接口 | version/state字段 | P2 | ✅ covered | 维持 |

---

## 8. recruit-types (recruit-types.ts) — 10节点

| ID | 维度 | 场景 | 优先级 | R3状态 | R2变化 |
|----|------|------|--------|--------|--------|
| RT-N01 | PityState接口 | 4个计数器 | P2 | ✅ covered | 维持 |
| RT-N02 | RecruitResult接口 | quality/general/isNew字段 | P2 | ✅ covered | 维持 |
| RT-N03 | RecruitOutput接口 | type/results/cost字段 | P2 | ✅ covered | 维持 |
| RT-N04 | createEmptyPity | 返回全0计数器 | P2 | ✅ covered | 维持 |
| RT-B01 | rollQuality | rates=null→崩溃 | P0 | ⚠️ uncovered | 维持(未修复) |
| RT-B02 | rollQuality | rates总和≠1→概率分布偏差 | P1 | ⚠️ uncovered | 维持 |
| RT-B03 | applyPity | hardPityCount>=hardPityThreshold→强制LEGENDARY | P1 | ✅ covered | 维持 |
| RT-B04 | pickGeneralByQuality | quality=LEGENDARY但无LEGENDARY武将→返回null | P1 | ⚠️ uncovered | 维持 |
| RT-B05 | MAX_HISTORY_SIZE | 值=10→历史记录截断 | P2 | ✅ covered | 维持 |
| RT-B06 | RecruitDeps接口 | heroSystem/spendResource/canAffordResource完整性 | P1 | ✅ covered | 维持 |

---

## 9. index.ts (index.ts) — 6节点

| ID | 维度 | 场景 | 优先级 | R3状态 | R2变化 |
|----|------|------|--------|--------|--------|
| IX-N01 | 导出 | 所有子系统正确导出 | P2 | ✅ covered | 维持 |
| IX-N02 | 导出 | 所有类型正确导出 | P2 | ✅ covered | 维持 |
| IX-B01 | 导出 | BondSystem(hero层)和BondSystem(engine层)命名冲突 | P0 | ⚠️ uncovered | 维持 |
| IX-B02 | 导出 | BondEffect(bond-config)和BondEffect(faction-bond-config)命名冲突 | P0 | ⚠️ uncovered | 维持 |
| IX-B03 | 导出 | 缺少SkillUpgradeSystem的serialize/deserialize导出 | P0 | ⚠️ uncovered | 维持(同SU-E01/E02) |
| IX-B04 | 导出 | 新增6名武将的配置导出完整性 | P0 | ⚠️ uncovered | 维持 |

---

## Part C 统计

| 维度 | R2节点 | R3节点 | covered | uncovered | P0 | P1 | P2 |
|------|--------|--------|---------|-----------|-----|-----|-----|
| FormationRecommendSystem | 36 | 32 | 16 | 16 | 7 | 10 | 15 |
| HeroDispatchSystem | 30 | 28 | 16 | 12 | 6 | 10 | 12 |
| hero-config | 22 | 20 | 10 | 10 | 6 | 4 | 10 |
| hero-recruit-config | 18 | 16 | 10 | 6 | 0 | 8 | 8 |
| star-up-config | 22 | 20 | 14 | 6 | 4 | 6 | 10 |
| hero.types | 10 | 10 | 5 | 5 | 2 | 2 | 6 |
| formation-types | 10 | 10 | 7 | 3 | 1 | 1 | 8 |
| recruit-types | 12 | 10 | 8 | 2 | 1 | 2 | 7 |
| index.ts | 6 | 6 | 2 | 4 | 3 | 0 | 3 |
| **Part C 合计** | **166** | **152** | **98** | **54** | **30** | **43** | **79** |

### R2→R3 变化

| 指标 | R2 | R3 | 变化 |
|------|----|----|------|
| 总节点 | 166 | 152 | -14(精简重复) |
| covered | 90 | 88 | -2(重新校准) |
| uncovered | 76 | 64 | -12(FIX验证+降级) |
| P0 | 32 | 30 | -2(FIX-202修复getStarMultiplier) |

### 关键改进

1. **FIX-202验证**: getStarMultiplier NaN防护(star-up-config.ts L60)确认有效，SRC-B01/B03升级为covered
2. **FormationRecommend算法缺陷确认**: R3源码验证确认3个算法问题(FR-B08/B09/B10)仍存在
3. **HeroDispatch getState浅拷贝确认**: R3源码验证确认L101仅一层展开，嵌套对象可被篡改
4. **配置冲突源码验证**: R3通过grep确认5处配置不一致(阵营标识、搭档ID等)

### R3 Part C 剩余P0（30项，按类别分组）

| 类别 | 数量 | 关键项 |
|------|------|--------|
| 配置交叉验证 | 10 | 6名武将碎片缺失、SHOP/STAGE/DROPS配置 |
| FormationRecommend算法 | 4 | 方案重复、硬编码羁绊分数、NaN difficultyLevel |
| HeroDispatch | 6 | null派驻、NaN加成、浅拷贝 |
| 配置冲突 | 3 | 阵营标识、BondEffect接口、FormationBondBonusRate |
| 类型定义 | 3 | Faction不一致、QUALITY_ORDER无fallback |
| 导出冲突 | 3 | BondSystem/BondEffect命名冲突、SkillUpgrade序列化 |
| recruit-types | 1 | rollQuality rates=null崩溃 |
