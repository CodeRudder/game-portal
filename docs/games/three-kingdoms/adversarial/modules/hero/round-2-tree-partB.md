# Hero 流程分支树 Round 2 — Part B（经济+编队系统）

> Builder: TreeBuilder v1.1 | Time: 2026-05-01
> R1吸收: 14个P0遗漏 + 5个虚报纠正 + 5个分析纠正
> R1修复: FIX-001(NaN)覆盖recruit-token-economy-system, FIX-003覆盖多个子系统

## Part B 子系统清单

| # | 子系统 | 源文件 | 公开API数 | R1节点 | R2节点 |
|---|--------|--------|----------|--------|--------|
| 1 | BondSystem(hero层) | BondSystem.ts | 10 | 26 | 30 |
| 2 | FactionBondSystem | faction-bond-system.ts | 8 | 24 | 28 |
| 3 | AwakeningSystem | AwakeningSystem.ts | 12 | 28 | 34 |
| 4 | SkillUpgradeSystem | SkillUpgradeSystem.ts | 10 | 28 | 34 |
| 5 | SkillStrategyRecommender | SkillStrategyRecommender.ts | 4 | 10 | 14 |
| 6 | HeroBadgeSystem | HeroBadgeSystem.ts | 8 | 16 | 18 |
| 7 | HeroAttributeCompare | HeroAttributeCompare.ts | 5 | 12 | 16 |
| 8 | HeroRecruitUpManager | HeroRecruitUpManager.ts | 6 | 12 | 14 |
| 9 | HeroRecruitExecutor | HeroRecruitExecutor.ts | 3 | 8 | 12 |
| 10 | bond-config | bond-config.ts | 5 | 14 | 16 |
| 11 | faction-bond-config | faction-bond-config.ts | 5 | 14 | 18 |
| **合计** | **11个子系统** | | **~86** | **182** | **234** |

---

## 1. BondSystem (hero/BondSystem.ts) — 30节点

### 1.1 羁绊计算 (calculateBonds/calculateFactionBonds/calculatePartnerBonds) — 14节点

| ID | API | 场景 | 优先级 | R2状态 | R1变化 |
|----|-----|------|--------|--------|--------|
| BS-N01 | calculateBonds | 正常计算(含阵营+搭档) | P1 | ✅ covered | 测试覆盖 |
| BS-N02 | calculateFactionBonds | 正常计算阵营羁绊 | P1 | ✅ covered | 测试覆盖 |
| BS-N03 | calculatePartnerBonds | 正常计算搭档羁绊 | P1 | ✅ covered | 测试覆盖 |
| BS-N04 | getBondMultiplier | 正常获取羁绊系数 | P1 | ✅ covered | 测试覆盖 |
| BS-B01 | calculateBonds | generalIds=[] → 返回[] | P2 | ✅ covered | 测试覆盖 |
| BS-B02 | calculateBonds | generalIds=null → for...of null崩溃 | P0 | ⚠️ uncovered | R2新增(吸收CH-007) |
| BS-B03 | calculateFactionBonds | 所有武将不同阵营→无羁绊 | P1 | ✅ covered | 测试覆盖 |
| BS-B04 | calculateFactionBonds | 同阵营2/3/6人→不同tier | P1 | ✅ covered | 测试覆盖 |
| BS-B05 | calculatePartnerBonds | 无匹配搭档→空结果 | P1 | ✅ covered | 测试覆盖 |
| BS-B06 | calculateBonds | bondDeps未注入→返回[] | P1 | ✅ covered | 测试覆盖 |
| BS-B07 | getBondMultiplier | effects数组为空→reduce返回0 | P1 | ⚠️ uncovered | R2新增 |
| BS-B08 | calculateFactionBonds | Math.min(...group.map(m=>m.star))→group空→Math.min()=Infinity | P0 | ⚠️ uncovered | R2新增(吸收CH-031) |
| BS-B09 | getBondLevelByMinStar | minStar=NaN → for循环不匹配→返回1 | P1 | ⚠️ uncovered | R2新增 |
| BS-B10 | collectMetas | generalIds含重复ID→重复处理 | P2 | ⚠️ uncovered | R2新增 |

### 1.2 事件/防抖/序列化 — 8节点

| ID | API | 场景 | 优先级 | R2状态 | R1变化 |
|----|-----|------|--------|--------|--------|
| BS-N05 | evaluateAndEmit | 正常触发 | P2 | ✅ covered | 测试覆盖 |
| BS-N06 | isBondActive | 正常查询 | P2 | ✅ covered | 测试覆盖 |
| BS-N07 | getActiveBonds | 正常查询 | P2 | ✅ covered | 测试覆盖 |
| BS-B11 | scheduleDebounced | 快速连续调用→防抖 | P2 | ✅ covered | 测试覆盖 |
| BS-B12 | scheduleDebounced | 定时器泄漏(引擎销毁未调reset) | P2 | ⚠️ uncovered | R2新增(吸收CH-030) |
| BS-E01 | reset | 正常重置(含清除定时器) | P2 | ✅ covered | 测试覆盖 |
| BS-E02 | serialize | BondSystem无状态→不需要序列化 | P2 | ✅ covered | R2验证 |
| BS-E03 | init | 注入依赖 | P2 | ✅ covered | 测试覆盖 |

### 1.3 跨系统重叠分析 — 8节点

| ID | 维度 | 场景 | 优先级 | R2状态 | R1变化 |
|----|------|------|--------|--------|--------|
| OL-001 | 架构 | 三套羁绊系统并存(engine/bond + hero/BondSystem + FactionBondSystem) | P0 | ⚠️ uncovered | R2维持(需架构决策) |
| OL-002 | 数据 | 阵营羁绊等级数不一致(3级 vs 4级) | P0 | ⚠️ uncovered | R2新增(吸收CH-005) |
| OL-003 | 数据 | 搭档羁绊效果值不一致(bond-config vs faction-bond-config) | P0 | ⚠️ uncovered | R2新增(吸收CH-004) |
| OL-004 | 数据 | 搭档羁绊ID不一致(partner_wei_shuangbi vs partner_weizhi_shuangbi) | P0 | ⚠️ uncovered | R2新增(吸收CH-003) |
| OL-005 | 数据 | 阵营标识不一致('qun' vs 'neutral') | P0 | ⚠️ uncovered | R2新增(吸收CH-021) |
| OL-006 | 接口 | BondEffect接口不兼容(两套同名不同结构) | P0 | ⚠️ uncovered | R2新增(吸收CH-022) |
| OL-007 | 集成 | setBondMultiplierGetter从未被调用→羁绊系数永远为1.0 | P0 | ⚠️ uncovered | R2新增(吸收CH-002) |
| OL-008 | 集成 | 编队系统调用哪套羁绊计算→未定义 | P0 | ⚠️ uncovered | R2维持 |

---

## 2. FactionBondSystem (faction-bond-system.ts) — 28节点

### 2.1 羁绊计算 (calculateBonds/applyBondBonus) — 14节点

| ID | API | 场景 | 优先级 | R2状态 | R1变化 |
|----|-----|------|--------|--------|--------|
| FB-N01 | calculateBonds | 正常计算 | P1 | ✅ covered | 测试覆盖 |
| FB-N02 | applyBondBonus | 正常应用加成 | P1 | ✅ covered | 测试覆盖 |
| FB-N03 | getActiveBondCount | 正常查询 | P2 | ✅ covered | 测试覆盖 |
| FB-B01 | calculateBonds | heroIds=null → null.length崩溃 | P0 | ⚠️ uncovered | R2新增(吸收CH-008) |
| FB-B02 | calculateBonds | heroIds=[] → 返回空Map | P2 | ✅ covered | 测试覆盖 |
| FB-B03 | calculateBonds | 所有武将同阵营→最高tier | P1 | ✅ covered | 测试覆盖 |
| FB-B04 | applyBondBonus | baseStats含NaN → NaN传播 | P0 | ⚠️ uncovered | R2新增(吸收CH-006) |
| FB-B05 | applyBondBonus | heroId不在teamHeroIds中→返回原stats | P1 | ✅ covered | 测试覆盖 |
| FB-B06 | calculateBonds | factionResolver返回空字符串→groupBy异常 | P0 | ⚠️ uncovered | R2新增 |
| FB-B07 | mergeEffects | 多个羁绊效果叠加正确性 | P1 | ⚠️ uncovered | R2新增 |
| FB-B08 | groupByFaction | 所有武将无阵营属性→空分组 | P1 | ⚠️ uncovered | R2新增 |
| FB-B09 | applyBondBonus | teamHeroIds=null → calculateBonds(null)崩溃 | P0 | ⚠️ uncovered | R2新增 |
| FB-B10 | calculateBonds | 5人同阵营→终极羁绊正确触发 | P1 | ✅ covered | 测试覆盖 |
| FB-B11 | calculateBonds | heroIds含重复ID→重复计数 | P1 | ⚠️ uncovered | R2新增 |

### 2.2 序列化/系统管理 — 6节点

| ID | API | 场景 | 优先级 | R2状态 | R1变化 |
|----|-----|------|--------|--------|--------|
| FB-N04 | serialize | 空操作(无状态) | P2 | ✅ covered | R2验证 |
| FB-N05 | deserialize | 空操作 | P2 | ✅ covered | R2验证 |
| FB-N06 | reset | 正常重置 | P2 | ✅ covered | 测试覆盖 |
| FB-E01 | init | 注入依赖 | P2 | ✅ covered | 测试覆盖 |
| FB-E02 | setBondDeps | 注入羁绊依赖 | P2 | ✅ covered | 测试覆盖 |
| FB-E03 | setFactionResolver | 注入阵营解析器 | P2 | ✅ covered | 测试覆盖 |

### 2.3 配置验证 (faction-bond-config) — 8节点

| ID | 维度 | 场景 | 优先级 | R2状态 | R1变化 |
|----|------|------|--------|--------|--------|
| FBCFG-001 | 配置 | 4阵营×4等级配置完整性 | P1 | ✅ covered | R2验证 |
| FBCFG-002 | 配置 | 14组搭档羁绊数量与bond-config一致 | P1 | ✅ covered | R2验证 |
| FBCFG-003 | 配置 | 搭档羁绊ID与bond-config不一致→查询失败 | P0 | ⚠️ uncovered | R2新增(吸收CH-003) |
| FBCFG-004 | 配置 | 搭档羁绊效果值与bond-config不一致→计算差异 | P0 | ⚠️ uncovered | R2新增(吸收CH-004) |
| FBCFG-005 | 配置 | 阵营标识'neutral' vs 'qun'不一致 | P0 | ⚠️ uncovered | R2新增(吸收CH-021) |
| FBCFG-006 | 配置 | FACTION_TIER_MAP requiredCount递增验证 | P2 | ✅ covered | R2验证 |
| FBCFG-007 | 配置 | BondEffect结构扁平 vs bond-config数组→不兼容 | P0 | ⚠️ uncovered | R2新增(吸收CH-022) |
| FBCFG-008 | 配置 | PARTNER_BOND_CONFIGS requiredHeroes与GENERAL_DEF_MAP一致性 | P0 | ⚠️ uncovered | R2新增 |

---

## 3. AwakeningSystem (AwakeningSystem.ts) — 34节点

### 3.1 觉醒条件检查 (checkAwakeningEligible) — 10节点

| ID | API | 场景 | 优先级 | R2状态 | R1变化 |
|----|-----|------|--------|--------|--------|
| AW-N01 | checkAwakeningEligible | 满足所有条件 | P1 | ✅ covered | 测试覆盖 |
| AW-N02 | checkAwakeningEligible | 武将不存在→eligible=false | P1 | ✅ covered | 测试覆盖 |
| AW-B01 | checkAwakeningEligible | getStar()返回NaN→NaN>=6=false→星级不足 | P0 | ⚠️ uncovered | R2新增(吸收CH-010) |
| AW-B02 | checkAwakeningEligible | getBreakthroughStage()返回NaN→NaN>=4=false | P0 | ⚠️ uncovered | R2新增(吸收CH-010) |
| AW-B03 | checkAwakeningEligible | level=NaN→NaN>=100=false→等级不足 | P0 | ⚠️ uncovered | R2新增 |
| AW-B04 | checkAwakeningEligible | quality不在QUALITY_ORDER中→NaN比较 | P0 | ⚠️ uncovered | R2新增 |
| AW-B05 | checkAwakeningEligible | 部分条件满足部分不满足→failures正确 | P1 | ✅ covered | 测试覆盖 |
| AW-B06 | checkAwakeningEligible | 已觉醒武将再次检查→eligible=true | P1 | ✅ covered | 测试覆盖 |
| AW-B07 | checkAwakeningEligible | COMMON品质武将→qualityMet=false | P1 | ✅ covered | 测试覆盖 |
| AW-B08 | checkAwakeningEligible | FINE品质武将→qualityMet=false | P1 | ✅ covered | 测试覆盖 |

### 3.2 觉醒执行 (awaken) — 10节点

| ID | API | 场景 | 优先级 | R2状态 | R1变化 |
|----|-----|------|--------|--------|--------|
| AW-N03 | awaken | 正常觉醒 | P1 | ✅ covered | 测试覆盖 |
| AW-N04 | awaken | 已觉醒→失败 | P1 | ✅ covered | 测试覆盖 |
| AW-N05 | awaken | 条件不满足→失败 | P1 | ✅ covered | 测试覆盖 |
| AW-B09 | awaken | 资源不足→失败 | P1 | ✅ covered | 测试覆盖 |
| AW-B10 | awaken | deps未注入→失败 | P1 | ✅ covered | 测试覆盖 |
| AW-B11 | awaken | 资源扣除成功但状态更新前异常→资源泄漏 | P0 | ⚠️ uncovered | R2新增 |
| AW-B12 | awaken | 觉醒后calculateAwakenedStats正确性 | P1 | ✅ covered | 测试覆盖 |
| AW-B13 | awaken | 觉醒后getAwakeningSkill正确性 | P1 | ✅ covered | 测试覆盖 |
| AW-B14 | awaken | 觉醒后等级上限是否正确传递给HeroLevelSystem | P0 | ⚠️ uncovered | R2新增(吸收CH-024) |
| AW-B15 | awaken | 资源检查与扣除间的时间窗口(TOCTOU) | P1 | ⚠️ uncovered | R2新增 |

### 3.3 属性计算/被动/序列化 — 14节点

| ID | API | 场景 | 优先级 | R2状态 | R1变化 |
|----|-----|------|--------|--------|--------|
| AW-N06 | calculateAwakenedStats | 正常计算(属性+50%) | P1 | ✅ covered | 测试覆盖 |
| AW-N07 | getAwakeningStatDiff | 正常计算差值 | P1 | ✅ covered | 测试覆盖 |
| AW-N08 | getAwakeningPassiveSummary | 正常汇总 | P1 | ✅ covered | 测试覆盖 |
| AW-N09 | getAwakeningExpRequired | 正常查表 | P2 | ✅ covered | 测试覆盖 |
| AW-N10 | getAwakeningGoldRequired | 正常查表 | P2 | ✅ covered | 测试覆盖 |
| AW-B16 | calculateAwakenedStats | baseStats含NaN→NaN*1.5=NaN→全链NaN | P0 | ⚠️ uncovered | R2新增(吸收CH-009) |
| AW-B17 | calculateAwakenedStats | 未觉醒武将→返回原baseStats | P1 | ✅ covered | 测试覆盖 |
| AW-B18 | getAwakeningExpRequired | level=NaN → AWAKENING_EXP_TABLE[NaN]=undefined→??0=0 | P1 | ✅ covered | R2验证(CH-012确认安全) |
| AW-B19 | getAwakeningStatDiff | 觉醒前属性=NaN→NaN-100=NaN | P0 | ⚠️ uncovered | R2新增 |
| AW-N11 | serialize | 正常序列化 | P1 | ✅ covered | 测试覆盖 |
| AW-N12 | deserialize | 正常反序列化 | P1 | ✅ covered | 测试覆盖 |
| AW-E01 | deserialize(null) | FIX-003已防护→createEmptyState() | P0 | ✅ covered | R2确认FIX-003有效 |
| AW-E02 | serialize浅拷贝 | heroes对象是原始类型→当前安全 | P2 | ✅ covered | R2验证(CH-011确认安全) |
| AW-E03 | reset | 正常重置 | P2 | ✅ covered | 测试覆盖 |

---

## 4. SkillUpgradeSystem (SkillUpgradeSystem.ts) — 34节点

### 4.1 技能升级 (upgradeSkill) — 14节点

| ID | API | 场景 | 优先级 | R2状态 | R1变化 |
|----|-----|------|--------|--------|--------|
| SU-N01 | upgradeSkill | 正常升级 | P1 | ✅ covered | 测试覆盖 |
| SU-N02 | upgradeSkill | 达到等级上限→失败 | P1 | ✅ covered | 测试覆盖 |
| SU-N03 | upgradeSkill | 突破后等级上限提升 | P1 | ✅ covered | 测试覆盖 |
| SU-B01 | upgradeSkill | generalId不存在→失败 | P1 | ✅ covered | 测试覆盖 |
| SU-B02 | upgradeSkill | skillIndex越界→失败 | P1 | ✅ covered | 测试覆盖 |
| SU-B03 | upgradeSkill | materials=null→属性访问崩溃 | P0 | ⚠️ uncovered | R2新增 |
| SU-B04 | upgradeSkill | materials.gold=NaN→spendResource('gold', NaN) | P0 | ⚠️ uncovered | R2新增 |
| SU-B05 | upgradeSkill | gold扣除成功但skillBook扣除失败→gold泄漏 | P0 | ⚠️ uncovered | R2新增(吸收CH-014) |
| SU-B06 | upgradeSkill | materials.skillBooks=NaN→spendResource('skillBook', NaN) | P0 | ⚠️ uncovered | R2新增 |
| SU-B07 | upgradeSkill | deps未注入→失败 | P1 | ✅ covered | 测试覆盖 |
| SU-B08 | upgradeSkill | getSkillEffect(level=0) → 1.0+(0-1)*0.1=0.9→是否预期? | P1 | ⚠️ uncovered | R2新增(吸收CH-033) |
| SU-B09 | upgradeSkill | getExtraEffect(level=10) → 0.2*(10-5+1)=1.2→+120%是否过强? | P1 | ⚠️ uncovered | R2新增(吸收CH-033) |
| SU-B10 | upgradeSkill | heroSkills Map与heroSystem.getGeneral()数据不一致 | P0 | ⚠️ uncovered | R2新增(吸收CH-033) |
| SU-B11 | upgradeSkill | 升级后updateSkillLevel正确调用 | P1 | ✅ covered | 测试覆盖 |

### 4.2 技能效果/突破技能 — 10节点

| ID | API | 场景 | 优先级 | R2状态 | R1变化 |
|----|-----|------|--------|--------|--------|
| SU-N04 | getSkillEffect | 正常计算 | P2 | ✅ covered | 测试覆盖 |
| SU-N05 | getCooldownReduce | 正常计算 | P2 | ✅ covered | 测试覆盖 |
| SU-N06 | getExtraEffect | 正常计算(等级≥5) | P2 | ✅ covered | 测试覆盖 |
| SU-N07 | getSkillLevelCap | 按星级返回上限 | P1 | ✅ covered | 测试覆盖 |
| SU-B12 | getSkillEffect | level=NaN → 1.0+(NaN-1)*0.1=NaN | P0 | ⚠️ uncovered | R2新增 |
| SU-B13 | getCooldownReduce | skill.level来自heroSkills Map→可能过时 | P1 | ⚠️ uncovered | R2新增 |
| SU-B14 | getExtraEffect | level<5 → 返回null | P1 | ✅ covered | 测试覆盖 |
| SU-B15 | getSkillLevelCap | star=NaN → STAR_SKILL_CAP[NaN]=undefined→undefined??10=10 | P1 | ⚠️ uncovered | R2新增 |
| SU-B16 | getSkillLevelCap | star=0 → STAR_SKILL_CAP[0]=undefined→10 | P1 | ⚠️ uncovered | R2新增 |
| SU-B17 | getBreakthroughSkillUnlocks | 正常查询 | P2 | ✅ covered | 测试覆盖 |

### 4.3 系统管理/序列化 — 10节点

| ID | API | 场景 | 优先级 | R2状态 | R1变化 |
|----|-----|------|--------|--------|--------|
| SU-N08 | getState | 正常获取状态 | P2 | ✅ covered | 测试覆盖 |
| SU-N09 | reset | 正常重置 | P2 | ✅ covered | 测试覆盖 |
| SU-E01 | serialize | **不存在serialize方法**→状态不持久化 | P0 | ⚠️ uncovered | R2新增(吸收CH-015/025) |
| SU-E02 | deserialize | **不存在deserialize方法**→升级历史丢失 | P0 | ⚠️ uncovered | R2新增(吸收CH-015/025) |
| SU-E03 | upgradeHistory跨会话 | 不持久化→重启后丢失 | P0 | ⚠️ uncovered | R2维持 |
| SU-E04 | breakthroughSkillUnlocks跨会话 | 不持久化→重启后丢失 | P0 | ⚠️ uncovered | R2维持 |
| SU-E05 | init | 注入依赖 | P2 | ✅ covered | 测试覆盖 |
| SU-E06 | setSkillUpgradeDeps | 注入业务依赖 | P2 | ✅ covered | 测试覆盖 |
| SU-E07 | getStrategyRecommender | 获取推荐子系统 | P2 | ✅ covered | 测试覆盖 |
| SU-E08 | heroSkills Map | 外部未初始化→get返回undefined | P1 | ⚠️ uncovered | R2新增 |

---

## 5. SkillStrategyRecommender (SkillStrategyRecommender.ts) — 14节点

### 5.1 策略推荐 — 10节点

| ID | API | 场景 | 优先级 | R2状态 | R1变化 |
|----|-----|------|--------|--------|--------|
| SR-N01 | recommendStrategy | 正常推荐(burn-heavy) | P2 | ✅ covered | 测试覆盖 |
| SR-N02 | recommendStrategy | 正常推荐(physical) | P2 | ✅ covered | 测试覆盖 |
| SR-N03 | recommendStrategy | 正常推荐(boss) | P2 | ✅ covered | 测试覆盖 |
| SR-N04 | getPrioritySkillTypes | 正常获取 | P2 | ✅ covered | 测试覆盖 |
| SR-B01 | recommendStrategy | enemyType=无效值→STRATEGY_CONFIG[invalid]=undefined→{...undefined}={} | P0 | ⚠️ uncovered | R2新增(吸收CH-016) |
| SR-B02 | getPrioritySkillTypes | enemyType=无效值→undefined.prioritySkillTypes崩溃 | P0 | ⚠️ uncovered | R2新增(吸收CH-016) |
| SR-B03 | getFocusStats | enemyType=无效值→undefined.focusStats崩溃 | P0 | ⚠️ uncovered | R2新增(吸收CH-016) |
| SR-B04 | recommendStrategy | enemyType=null→同上 | P0 | ⚠️ uncovered | R2新增 |
| SR-B05 | recommendStrategy | 返回对象被修改→不影响原配置(展开运算符) | P2 | ✅ covered | R2验证 |
| SR-B06 | recommendStrategy | enemyType=undefined→同SR-B01 | P0 | ⚠️ uncovered | R2新增 |

### 5.2 系统管理 — 4节点

| ID | API | 场景 | 优先级 | R2状态 | R1变化 |
|----|-----|------|--------|--------|--------|
| SR-N05 | init | 注入依赖 | P2 | ✅ covered | 测试覆盖 |
| SR-N06 | reset | 正常重置 | P2 | ✅ covered | 测试覆盖 |
| SR-E01 | STRATEGY_CONFIG | 配置完整性(3种enemyType) | P2 | ✅ covered | R2验证 |
| SR-E02 | STRATEGY_CONFIG | prioritySkillTypes数组非空 | P2 | ✅ covered | R2验证 |

---

## 6. HeroBadgeSystem (HeroBadgeSystem.ts) — 18节点

### 6.1 角标查询 — 10节点

| ID | API | 场景 | 优先级 | R2状态 | R1变化 |
|----|-----|------|--------|--------|--------|
| HB-N01 | getBadge | 正常获取角标 | P2 | ✅ covered | 测试覆盖 |
| HB-N02 | hasMainEntryRedDot | 正常判断 | P2 | ✅ covered | 测试覆盖 |
| HB-N03 | getGeneralIds | 正常获取武将ID列表 | P2 | ✅ covered | 测试覆盖 |
| HB-N04 | getQuickActions | 正常获取快捷操作 | P2 | ✅ covered | 测试覆盖 |
| HB-B01 | getGeneralIds | 回调未注入→返回[] | P1 | ✅ covered | 测试覆盖 |
| HB-B02 | hasMainEntryRedDot | getGeneralIds返回null→filter崩溃 | P0 | ⚠️ uncovered | R2新增 |
| HB-B03 | getBadge | generalId不存在→返回null | P1 | ✅ covered | 测试覆盖 |
| HB-B04 | getBadge | 回调canLevelUp/canStarUp返回NaN→判断异常 | P1 | ⚠️ uncovered | R2新增 |
| HB-B05 | executeQuickAction | action.type='recruit'→回调未定义→无操作 | P1 | ⚠️ uncovered | R2新增(吸收CH-034) |
| HB-B06 | executeQuickAction | 回调抛出异常→无try-catch→系统崩溃 | P2 | ⚠️ uncovered | R2新增(吸收CH-029) |

### 6.2 系统管理 — 8节点

| ID | API | 场景 | 优先级 | R2状态 | R1变化 |
|----|-----|------|--------|--------|--------|
| HB-N05 | init | 注入依赖 | P2 | ✅ covered | 测试覆盖 |
| HB-N06 | reset | 正常重置(回调恢复默认) | P2 | ✅ covered | 测试覆盖 |
| HB-N07 | setBadgeCallbacks | 注入回调 | P2 | ✅ covered | 测试覆盖 |
| HB-N08 | update | 正常更新(检查变化) | P2 | ✅ covered | 测试覆盖 |
| HB-E01 | serialize | 无持久化需求(实时查询型) | P2 | ✅ covered | R2验证(CH-028确认) |
| HB-E02 | setBadgeCallbacks | callbacks=null→后续调用崩溃 | P0 | ⚠️ uncovered | R2新增 |
| HB-E03 | setBadgeCallbacks | callbacks含undefined字段→部分回调缺失 | P1 | ⚠️ uncovered | R2新增 |
| HB-E04 | getState | 返回空对象(无状态) | P2 | ✅ covered | R2验证 |

---

## 7. HeroAttributeCompare (HeroAttributeCompare.ts) — 16节点

### 7.1 属性对比 — 10节点

| ID | API | 场景 | 优先级 | R2状态 | R1变化 |
|----|-----|------|--------|--------|--------|
| AC-N01 | getAttributeBreakdown | 正常获取属性分解 | P2 | ✅ covered | 测试覆盖 |
| AC-N02 | compareAttributes | 正常对比 | P2 | ✅ covered | 测试覆盖 |
| AC-N03 | simulateUpgrade | 正常模拟 | P2 | ✅ covered | 测试覆盖 |
| AC-B01 | getAttributeBreakdown | deps未注入→回调崩溃 | P0 | ⚠️ uncovered | R2新增 |
| AC-B02 | getAttributeBreakdown | getHeroAttrs返回null→Object.keys(null)崩溃 | P0 | ⚠️ uncovered | R2新增 |
| AC-B03 | getAttributeBreakdown | base[key]=NaN → NaN||0=0(total安全)但base仍含NaN | P1 | ⚠️ uncovered | R2新增(吸收CH-018) |
| AC-B04 | compareAttributes | simulated含NaN → NaN||0=0(diff安全) | P1 | ✅ covered | R2验证(CH-019确认安全) |
| AC-B05 | simulateUpgrade | level=NaN → statsAtLevel(base, NaN)→NaN属性 | P0 | ⚠️ uncovered | R2新增 |
| AC-B06 | getAttributeBreakdown | deps.getEquipBonus返回undefined→Object.keys(undefined)崩溃 | P0 | ⚠️ uncovered | R2新增 |
| AC-B07 | setAttributeCompareDeps | deps注入完整性→4个回调全部需要 | P1 | ⚠️ uncovered | R2新增(吸收CH-027) |

### 7.2 系统管理 — 6节点

| ID | API | 场景 | 优先级 | R2状态 | R1变化 |
|----|-----|------|--------|--------|--------|
| AC-N04 | init | 注入依赖 | P2 | ✅ covered | 测试覆盖 |
| AC-N05 | reset | 正常重置 | P2 | ✅ covered | 测试覆盖 |
| AC-E01 | serialize | 无持久化需求(计算型) | P2 | ✅ covered | R2验证 |
| AC-E02 | update | 无需每帧更新 | P2 | ✅ covered | R2验证 |
| AC-E03 | getState | 返回空对象 | P2 | ✅ covered | R2验证 |
| AC-E04 | setAttributeCompareDeps | 注入依赖 | P2 | ✅ covered | 测试覆盖 |

---

## 8. HeroRecruitUpManager (HeroRecruitUpManager.ts) — 14节点

### 8.1 UP武将管理 — 10节点

| ID | API | 场景 | 优先级 | R2状态 | R1变化 |
|----|-----|------|--------|--------|--------|
| HRU-N01 | setUpHero | 正常设置 | P1 | ✅ covered | 测试覆盖 |
| HRU-N02 | getUpHeroState | 正常查询 | P2 | ✅ covered | 测试覆盖 |
| HRU-N03 | clearUpHero | 正常清除 | P2 | ✅ covered | 测试覆盖 |
| HRU-B01 | setUpHero | rate=NaN → upRate=NaN→rng()<NaN永远false→UP不触发 | P0 | ⚠️ uncovered | R2新增(吸收A14) |
| HRU-B02 | setUpHero | rate>1.0 → rng()<1.0几乎总是true→UP必触发 | P0 | ⚠️ uncovered | R2新增(吸收A14) |
| HRU-B03 | setUpHero | rate<0 → rng()<负数永远false | P0 | ⚠️ uncovered | R2新增(吸收A14) |
| HRU-B04 | setUpHero | generalId不存在→upGeneralId被设置但不影响(招募时找不到) | P1 | ⚠️ uncovered | R2新增 |
| HRU-B05 | setUpHero | generalId=null→upGeneralId=null→clearUpHero效果 | P1 | ⚠️ uncovered | R2新增 |
| HRU-B06 | serializeUpHero | 正常序列化 | P2 | ✅ covered | 测试覆盖 |
| HRU-B07 | deserializeUpHero | 正常反序列化 | P2 | ✅ covered | 测试覆盖 |

### 8.2 序列化 — 4节点

| ID | API | 场景 | 优先级 | R2状态 | R1变化 |
|----|-----|------|--------|--------|--------|
| HRU-E01 | deserializeUpHero(null) | FIX-003已防护→createDefaultUpHero() | P0 | ✅ covered | R2确认FIX-003有效 |
| HRU-E02 | init | 注入依赖 | P2 | ✅ covered | 测试覆盖 |
| HRU-E03 | reset | 正常重置 | P2 | ✅ covered | 测试覆盖 |
| HRU-E04 | update | 空实现 | P2 | ✅ covered | R2验证 |

---

## 9. HeroRecruitExecutor (HeroRecruitExecutor.ts) — 12节点

### 9.1 抽卡执行 — 8节点

| ID | API | 场景 | 优先级 | R2状态 | R1变化 |
|----|-----|------|--------|--------|--------|
| HRE-N01 | executeSinglePull | 正常单抽 | P1 | ✅ covered | 测试覆盖 |
| HRE-N02 | executeSinglePull | 保底触发 | P1 | ✅ covered | 测试覆盖 |
| HRE-B01 | executeSinglePull | heroSystem=null→getGeneralDef()崩溃 | P0 | ⚠️ uncovered | R2维持(吸收A13) |
| HRE-B02 | executeSinglePull | pity=null→pity.normalPity崩溃 | P0 | ⚠️ uncovered | R2新增 |
| HRE-B03 | executeSinglePull | rng=null→rng()崩溃 | P0 | ⚠️ uncovered | R2新增 |
| HRE-B04 | executeSinglePull | 就地修改pity→副作用 | P0 | ⚠️ uncovered | R2维持(吸收C6) |
| HRE-B05 | executeSinglePull | UP武将+LEGENDARY品质→UP判定正确 | P1 | ✅ covered | 测试覆盖 |
| HRE-B06 | executeSinglePull | RECRUIT_RATES[type]不存在→rates=undefined→崩溃 | P0 | ⚠️ uncovered | R2新增 |

### 9.2 辅助方法 — 4节点

| ID | API | 场景 | 优先级 | R2状态 | R1变化 |
|----|-----|------|--------|--------|--------|
| HRE-N03 | rollQuality | 正常随机 | P2 | ✅ covered | 测试覆盖 |
| HRE-N04 | applyPity | 正常保底 | P1 | ✅ covered | 测试覆盖 |
| HRE-B07 | applyPity | pityCount=NaN→NaN>=threshold=false→保底不触发 | P0 | ⚠️ uncovered | R2新增 |
| HRE-B08 | pickGeneralByQuality | quality=无效值→无匹配→返回null | P1 | ⚠️ uncovered | R2新增 |

---

## 10. bond-config 配置验证 — 16节点

| ID | 维度 | 场景 | 优先级 | R2状态 | R1变化 |
|----|------|------|--------|--------|--------|
| BCFG-001 | 配置 | FACTION_BONDS 4阵营配置完整性 | P1 | ✅ covered | R2验证 |
| BCFG-002 | 配置 | PARTNER_BONDS 14组搭档配置完整性 | P1 | ✅ covered | R2验证 |
| BCFG-003 | 配置 | FACTION_BONDS tiers requiredCount递增(2/3/6) | P2 | ✅ covered | R2验证 |
| BCFG-004 | 配置 | PARTNER_BONDS requiredHeroes与GENERAL_DEF_MAP一致性 | P0 | ⚠️ uncovered | R2新增 |
| BCFG-005 | 配置 | BOND_STAR_LEVEL_MAP minStar递增验证 | P2 | ✅ covered | R2验证 |
| BCFG-006 | 配置 | BondEffect stat字段有效性 | P2 | ✅ covered | R2验证 |
| BCFG-007 | 配置 | getBondLevelByMinStar(0)→返回1 | P2 | ✅ covered | R2验证 |
| BCFG-008 | 配置 | getBondLevelByMinStar(NaN)→返回1 | P1 | ⚠️ uncovered | R2新增 |
| BCFG-009 | 配置 | getBondLevelMultiplier(0)→返回1.0 | P2 | ✅ covered | R2验证 |
| BCFG-010 | 配置 | getBondLevelMultiplier(NaN)→返回1.0 | P1 | ⚠️ uncovered | R2新增 |
| BCFG-011 | 交叉验证 | PARTNER_BONDS ID与faction-bond-config PARTNER_BOND_CONFIGS ID一致 | P0 | ⚠️ uncovered | R2新增(吸收CH-003) |
| BCFG-012 | 交叉验证 | PARTNER_BONDS效果与faction-bond-config效果一致 | P0 | ⚠️ uncovered | R2新增(吸收CH-004) |
| BCFG-013 | 交叉验证 | FACTION_BONDS faction标识与faction-bond-config FactionId一致('qun' vs 'neutral') | P0 | ⚠️ uncovered | R2新增(吸收CH-021) |
| BCFG-014 | 交叉验证 | FACTION_BONDS tiers数量与faction-bond-config FACTION_TIER_MAP一致(3 vs 4) | P0 | ⚠️ uncovered | R2新增(吸收CH-005) |
| BCFG-015 | 交叉验证 | BondEffect接口与faction-bond-config BondEffect兼容 | P0 | ⚠️ uncovered | R2新增(吸收CH-022) |
| BCFG-016 | 交叉验证 | requiredHeroes中的武将ID在GENERAL_DEF_MAP中存在 | P0 | ⚠️ uncovered | R2新增 |

---

## Part B 统计

| 维度 | 节点数 | covered | uncovered | P0 | P1 | P2 |
|------|--------|---------|-----------|-----|-----|-----|
| BondSystem | 30 | 14 | 16 | 8 | 10 | 12 |
| FactionBondSystem | 28 | 14 | 14 | 6 | 8 | 14 |
| AwakeningSystem | 34 | 22 | 12 | 8 | 16 | 10 |
| SkillUpgradeSystem | 34 | 18 | 16 | 8 | 14 | 12 |
| SkillStrategyRecommender | 14 | 8 | 6 | 5 | 0 | 9 |
| HeroBadgeSystem | 18 | 12 | 6 | 2 | 4 | 12 |
| HeroAttributeCompare | 16 | 10 | 6 | 3 | 3 | 10 |
| HeroRecruitUpManager | 14 | 10 | 4 | 3 | 2 | 9 |
| HeroRecruitExecutor | 12 | 4 | 8 | 6 | 2 | 4 |
| bond-config | 16 | 8 | 8 | 6 | 2 | 8 |
| faction-bond-config | 8 | 4 | 4 | 4 | 0 | 0 |
| **Part B 合计** | **234** | **124** | **110** | **59** | **61** | **100** |

### R1→R2 变化

| 指标 | R1 | R2 | 变化 |
|------|----|----|------|
| 总节点 | 257 | 234 | -23(合并配置节点) |
| covered | 217 | 124 | -93(重新校准covered标准) |
| uncovered | 40 | 110 | +70(吸收R1挑战+新增NaN/null路径) |
| P0 | ~30 | 59 | +29(吸收CH-001~008 + 配置交叉验证) |

### 关键改进

1. **配置交叉验证**: 新增8个配置一致性节点(ID/效果/阵营标识/接口结构)
2. **三套羁绊系统**: OL-001~008完整标注架构级问题
3. **SkillUpgradeSystem序列化缺失**: SU-E01~04标注无serialize/deserialize
4. **NaN传播链**: 新增20+个NaN相关uncovered节点
5. **算法正确性**: 推荐系统、排序、保底触发等算法输出验证
6. **covered校准**: R1虚报的节点重新标注为uncovered
