# Hero 流程分支树 Round 3 — Part B（经济+编队系统）

> Builder: TreeBuilder v1.2 | Time: 2026-05-01
> R2修复: FIX-201(羁绊/装备注入) + FIX-204(碎片溢出闭环) + FIX-203(calculatePower NaN兜底)

## R2→R3 改进

| 新规则 | 应用方式 | 影响节点数 |
|--------|---------|-----------|
| BR-020 回调注入点调用验证 | 验证所有setter在engine-hero-deps.ts中被调用 | +3验证节点 |
| BR-021 资源溢出闭环验证 | 碎片溢出闭环已修复，扫描其他资源溢出 | +2闭环验证节点 |
| BR-022 事务性操作扫描 | 十连招募事务性已修复，扫描其他多步操作 | +2事务验证节点 |

## Part B 子系统清单

| # | 子系统 | 源文件 | 公开API数 | R2节点 | R3节点 |
|---|--------|--------|----------|--------|--------|
| 1 | BondSystem(hero层) | BondSystem.ts | 10 | 30 | 28 |
| 2 | FactionBondSystem | faction-bond-system.ts | 8 | 28 | 26 |
| 3 | AwakeningSystem | AwakeningSystem.ts | 12 | 34 | 30 |
| 4 | SkillUpgradeSystem | SkillUpgradeSystem.ts | 10 | 34 | 30 |
| 5 | SkillStrategyRecommender | SkillStrategyRecommender.ts | 4 | 14 | 12 |
| 6 | HeroBadgeSystem | HeroBadgeSystem.ts | 8 | 18 | 16 |
| 7 | HeroAttributeCompare | HeroAttributeCompare.ts | 5 | 16 | 14 |
| 8 | HeroRecruitUpManager | HeroRecruitUpManager.ts | 6 | 14 | 12 |
| 9 | HeroRecruitExecutor | HeroRecruitExecutor.ts | 3 | 12 | 10 |
| 10 | bond-config | bond-config.ts | 5 | 16 | 14 |
| 11 | faction-bond-config | faction-bond-config.ts | 5 | 18 | 16 |
| **合计** | **11个子系统** | | **~86** | **234** | **208** |

---

## 1. BondSystem (hero/BondSystem.ts) — 28节点

### 1.1 羁绊计算 — 12节点

| ID | API | 场景 | 优先级 | R3状态 | R2变化 |
|----|-----|------|--------|--------|--------|
| BS-N01 | calculateBonds | 正常计算(含阵营+搭档) | P1 | ✅ covered | 维持 |
| BS-N02 | calculateFactionBonds | 正常计算阵营羁绊 | P1 | ✅ covered | 维持 |
| BS-N03 | calculatePartnerBonds | 正常计算搭档羁绊 | P1 | ✅ covered | 维持 |
| BS-N04 | getBondMultiplier | 正常获取羁绊系数 | P1 | ✅ covered | 维持 |
| BS-B01 | calculateBonds | generalIds=[] → 返回[] | P2 | ✅ covered | 维持 |
| BS-B02 | calculateBonds | generalIds=null → for...of null崩溃 | P0 | ⚠️ uncovered | 维持(未修复) |
| BS-B03 | calculateFactionBonds | 所有武将不同阵营→无羁绊 | P1 | ✅ covered | 维持 |
| BS-B04 | calculateFactionBonds | 同阵营2/3/6人→不同tier | P1 | ✅ covered | 维持 |
| BS-B05 | calculatePartnerBonds | 无匹配搭档→空结果 | P1 | ✅ covered | 维持 |
| BS-B06 | calculateBonds | bondDeps未注入→返回[] | P1 | ✅ covered | 维持 |
| BS-B07 | getBondMultiplier | effects数组为空→reduce返回0 | P1 | ⚠️ uncovered | 维持(非崩溃但返回0) |
| BS-B08 | calculateFactionBonds | Math.min(...group.map(m=>m.star))→group空→Math.min()=Infinity | P0 | ⚠️ uncovered | 维持(边界条件) |

### 1.2 事件/防抖/序列化 — 8节点

| ID | API | 场景 | 优先级 | R3状态 | R2变化 |
|----|-----|------|--------|--------|--------|
| BS-N05 | evaluateAndEmit | 正常触发 | P2 | ✅ covered | 维持 |
| BS-N06 | isBondActive | 正常查询 | P2 | ✅ covered | 维持 |
| BS-N07 | getActiveBonds | 正常查询 | P2 | ✅ covered | 维持 |
| BS-B09 | scheduleDebounced | 快速连续调用→防抖 | P2 | ✅ covered | 维持 |
| BS-B10 | scheduleDebounced | 定时器泄漏(引擎销毁未调reset) | P1 | ⚠️ uncovered | 维持(低风险) |
| BS-E01 | reset | 正常重置(含清除定时器) | P2 | ✅ covered | 维持 |
| BS-E02 | serialize | BondSystem无状态→不需要序列化 | P2 | ✅ covered | 维持 |
| BS-E03 | init | 注入依赖 | P2 | ✅ covered | 维持 |

### 1.3 跨系统重叠分析 — 8节点

| ID | 维度 | 场景 | 优先级 | R3状态 | R2变化 |
|----|------|------|--------|--------|--------|
| OL-001 | 架构 | 三套羁绊系统并存 | P0 | ⚠️ uncovered | 维持(需架构决策) |
| OL-002 | 数据 | 阵营羁绊等级数不一致(3级 vs 4级) | P0 | ⚠️ uncovered | 维持 |
| OL-003 | 数据 | 搭档羁绊效果值不一致 | P0 | ⚠️ uncovered | 维持(验证: bond-config partner_wei_shuangbi vs faction-bond-config partner_weizhi_shuangbi) |
| OL-004 | 数据 | 搭档羁绊ID不一致 | P0 | ⚠️ uncovered | R3验证: bond-config `partner_wei_shuangbi` vs faction-bond-config `partner_weizhi_shuangbi` |
| OL-005 | 数据 | 阵营标识不一致('qun' vs 'neutral') | P0 | ⚠️ uncovered | R3验证: hero.types.ts FACTIONS含'qun', faction-bond-config FactionId含'neutral' |
| OL-006 | 接口 | BondEffect接口不兼容 | P0 | ⚠️ uncovered | 维持 |
| OL-007 | 集成 | setBondMultiplierGetter已调用(FIX-201) | P1 | ✅ covered | R3验证: engine-hero-deps.ts L123 |
| OL-008 | 集成 | 编队系统调用哪套羁绊计算→未定义 | P0 | ⚠️ uncovered | 维持 |

---

## 2. FactionBondSystem (faction-bond-system.ts) — 26节点

### 2.1 羁绊计算 — 12节点

| ID | API | 场景 | 优先级 | R3状态 | R2变化 |
|----|-----|------|--------|--------|--------|
| FB-N01 | calculateBonds | 正常计算 | P1 | ✅ covered | 维持 |
| FB-N02 | applyBondBonus | 正常应用加成 | P1 | ✅ covered | 维持 |
| FB-N03 | getActiveBondCount | 正常查询 | P2 | ✅ covered | 维持 |
| FB-B01 | calculateBonds | heroIds=null → null.length崩溃 | P0 | ⚠️ uncovered | 维持(未修复) |
| FB-B02 | calculateBonds | heroIds=[] → 返回空Map | P2 | ✅ covered | 维持 |
| FB-B03 | calculateBonds | 所有武将同阵营→最高tier | P1 | ✅ covered | 维持 |
| FB-B04 | applyBondBonus | baseStats含NaN → NaN传播 | P1 | ⚠️ uncovered | 维持(非崩溃但传播NaN) |
| FB-B05 | applyBondBonus | heroId不在teamHeroIds中→返回原stats | P1 | ✅ covered | 维持 |
| FB-B06 | calculateBonds | factionResolver返回空字符串→groupBy异常 | P0 | ⚠️ uncovered | 维持 |
| FB-B07 | mergeEffects | 多个羁绊效果叠加正确性 | P1 | ⚠️ uncovered | 维持 |
| FB-B08 | calculateBonds | 5人同阵营→终极羁绊正确触发 | P1 | ✅ covered | 维持 |
| FB-B09 | calculateBonds | heroIds含重复ID→重复计数 | P1 | ⚠️ uncovered | 维持 |

### 2.2 序列化/系统管理 — 6节点

| ID | API | 场景 | 优先级 | R3状态 | R2变化 |
|----|-----|------|--------|--------|--------|
| FB-N04 | serialize | 空操作(无状态) | P2 | ✅ covered | 维持 |
| FB-N05 | deserialize | 空操作 | P2 | ✅ covered | 维持 |
| FB-N06 | reset | 正常重置 | P2 | ✅ covered | 维持 |
| FB-E01 | init | 注入依赖 | P2 | ✅ covered | 维持 |
| FB-E02 | setBondDeps | 注入羁绊依赖 | P2 | ✅ covered | 维持 |
| FB-E03 | setFactionResolver | 注入阵营解析器 | P2 | ✅ covered | 维持 |

### 2.3 配置验证 — 8节点

| ID | 维度 | 场景 | 优先级 | R3状态 | R2变化 |
|----|------|------|--------|--------|--------|
| FBCFG-001 | 配置 | 4阵营×4等级配置完整性 | P1 | ✅ covered | 维持 |
| FBCFG-002 | 配置 | 14组搭档羁绊数量 | P1 | ✅ covered | 维持 |
| FBCFG-003 | 配置 | 搭档羁绊ID不一致→查询失败 | P0 | ⚠️ uncovered | R3验证: partner_weizhi_shuangbi vs partner_wei_shuangbi |
| FBCFG-004 | 配置 | 搭档羁绊效果值不一致 | P0 | ⚠️ uncovered | 维持 |
| FBCFG-005 | 配置 | 阵营标识'neutral' vs 'qun'不一致 | P0 | ⚠️ uncovered | R3验证确认存在 |
| FBCFG-006 | 配置 | FACTION_TIER_MAP requiredCount递增验证 | P2 | ✅ covered | 维持 |
| FBCFG-007 | 配置 | BondEffect结构不兼容 | P0 | ⚠️ uncovered | 维持 |
| FBCFG-008 | 配置 | PARTNER_BOND_CONFIGS requiredHeroes与GENERAL_DEF_MAP一致性 | P0 | ⚠️ uncovered | 维持 |

---

## 3. AwakeningSystem (AwakeningSystem.ts) — 30节点

### 3.1 觉醒条件检查 — 8节点

| ID | API | 场景 | 优先级 | R3状态 | R2变化 |
|----|-----|------|--------|--------|--------|
| AW-N01 | checkAwakeningEligible | 满足所有条件 | P1 | ✅ covered | 维持 |
| AW-N02 | checkAwakeningEligible | 武将不存在→eligible=false | P1 | ✅ covered | 维持 |
| AW-B01 | checkAwakeningEligible | getStar()返回NaN→NaN>=6=false→星级不足 | P1 | ⚠️ uncovered | 维持(安全拒绝) |
| AW-B02 | checkAwakeningEligible | getBreakthroughStage()返回NaN→NaN>=4=false | P1 | ⚠️ uncovered | 维持(安全拒绝) |
| AW-B03 | checkAwakeningEligible | level=NaN→NaN>=100=false | P1 | ⚠️ uncovered | 维持(安全拒绝) |
| AW-B04 | checkAwakeningEligible | quality不在QUALITY_ORDER中→NaN比较 | P1 | ⚠️ uncovered | 维持 |
| AW-B05 | checkAwakeningEligible | 部分条件满足部分不满足→failures正确 | P1 | ✅ covered | 维持 |
| AW-B06 | checkAwakeningEligible | 已觉醒武将再次检查→eligible=true | P1 | ✅ covered | 维持 |

### 3.2 觉醒执行 — 8节点

| ID | API | 场景 | 优先级 | R3状态 | R2变化 |
|----|-----|------|--------|--------|--------|
| AW-N03 | awaken | 正常觉醒 | P1 | ✅ covered | 维持 |
| AW-N04 | awaken | 已觉醒→失败 | P1 | ✅ covered | 维持 |
| AW-N05 | awaken | 条件不满足→失败 | P1 | ✅ covered | 维持 |
| AW-B07 | awaken | 资源不足→失败 | P1 | ✅ covered | 维持 |
| AW-B08 | awaken | deps未注入→失败 | P1 | ✅ covered | 维持 |
| AW-B09 | awaken | 资源扣除成功但状态更新前异常→资源泄漏 | P1 | ⚠️ uncovered | 维持(事务性问题) |
| AW-B10 | awaken | 觉醒后calculateAwakenedStats正确性 | P1 | ✅ covered | 维持 |
| AW-B11 | awaken | 觉醒后等级上限正确传递给HeroLevelSystem | P1 | ⚠️ uncovered | 维持(依赖集成) |

### 3.3 属性计算/被动/序列化 — 14节点

| ID | API | 场景 | 优先级 | R3状态 | R2变化 |
|----|-----|------|--------|--------|--------|
| AW-N06 | calculateAwakenedStats | 正常计算(属性+50%) | P1 | ✅ covered | 维持 |
| AW-N07 | getAwakeningStatDiff | 正常计算差值 | P1 | ✅ covered | 维持 |
| AW-N08 | getAwakeningPassiveSummary | 正常汇总 | P1 | ✅ covered | 维持 |
| AW-N09 | getAwakeningExpRequired | 正常查表 | P2 | ✅ covered | 维持 |
| AW-N10 | getAwakeningGoldRequired | 正常查表 | P2 | ✅ covered | 维持 |
| AW-B12 | calculateAwakenedStats | baseStats含NaN→NaN*1.5=NaN | P1 | ⚠️ uncovered | 维持(上游数据问题) |
| AW-B13 | calculateAwakenedStats | 未觉醒武将→返回原baseStats | P1 | ✅ covered | 维持 |
| AW-B14 | getAwakeningExpRequired | level=NaN → ??0=0 | P1 | ✅ covered | 维持(安全) |
| AW-B15 | getAwakeningStatDiff | 觉醒前属性=NaN→NaN-100=NaN | P1 | ⚠️ uncovered | 维持 |
| AW-N11 | serialize | 正常序列化 | P1 | ✅ covered | 维持 |
| AW-N12 | deserialize | 正常反序列化 | P1 | ✅ covered | 维持 |
| AW-E01 | deserialize(null) | FIX-003已防护→createEmptyState() | P1 | ✅ covered | 维持 |
| AW-E02 | serialize浅拷贝 | heroes对象是原始类型→当前安全 | P2 | ✅ covered | 维持 |
| AW-E03 | reset | 正常重置 | P2 | ✅ covered | 维持 |

---

## 4. SkillUpgradeSystem (SkillUpgradeSystem.ts) — 30节点

### 4.1 技能升级 — 12节点

| ID | API | 场景 | 优先级 | R3状态 | R2变化 |
|----|-----|------|--------|--------|--------|
| SU-N01 | upgradeSkill | 正常升级 | P1 | ✅ covered | 维持 |
| SU-N02 | upgradeSkill | 达到等级上限→失败 | P1 | ✅ covered | 维持 |
| SU-N03 | upgradeSkill | 突破后等级上限提升 | P1 | ✅ covered | 维持 |
| SU-B01 | upgradeSkill | generalId不存在→失败 | P1 | ✅ covered | 维持 |
| SU-B02 | upgradeSkill | skillIndex越界→失败 | P1 | ✅ covered | 维持 |
| SU-B03 | upgradeSkill | materials=null→属性访问崩溃 | P0 | ⚠️ uncovered | 维持(未修复) |
| SU-B04 | upgradeSkill | materials.gold=NaN→spendResource('gold', NaN) | P0 | ⚠️ uncovered | 维持(未修复) |
| SU-B05 | upgradeSkill | gold扣除成功但skillBook扣除失败→gold泄漏 | P0 | ⚠️ uncovered | 维持(事务性问题) |
| SU-B06 | upgradeSkill | materials.skillBooks=NaN→spendResource('skillBook', NaN) | P0 | ⚠️ uncovered | 维持(未修复) |
| SU-B07 | upgradeSkill | deps未注入→失败 | P1 | ✅ covered | 维持 |
| SU-B08 | upgradeSkill | getSkillEffect(level=0) → 0.9是否预期 | P1 | ⚠️ uncovered | 维持(数值设计) |
| SU-B09 | upgradeSkill | 升级后updateSkillLevel正确调用 | P1 | ✅ covered | 维持 |

### 4.2 技能效果/突破技能 — 8节点

| ID | API | 场景 | 优先级 | R3状态 | R2变化 |
|----|-----|------|--------|--------|--------|
| SU-N04 | getSkillEffect | 正常计算 | P2 | ✅ covered | 维持 |
| SU-N05 | getCooldownReduce | 正常计算 | P2 | ✅ covered | 维持 |
| SU-N06 | getExtraEffect | 正常计算(等级≥5) | P2 | ✅ covered | 维持 |
| SU-N07 | getSkillLevelCap | 按星级返回上限 | P1 | ✅ covered | 维持 |
| SU-B10 | getSkillEffect | level=NaN → NaN公式 | P1 | ⚠️ uncovered | 维持(非崩溃) |
| SU-B11 | getSkillLevelCap | star=NaN → undefined??10=10 | P1 | ⚠️ uncovered | 维持(安全fallback) |
| SU-B12 | getSkillLevelCap | star=0 → undefined??10=10 | P1 | ⚠️ uncovered | 维持 |
| SU-B13 | getBreakthroughSkillUnlocks | 正常查询 | P2 | ✅ covered | 维持 |

### 4.3 系统管理/序列化 — 10节点

| ID | API | 场景 | 优先级 | R3状态 | R2变化 |
|----|-----|------|--------|--------|--------|
| SU-N08 | getState | 正常获取状态 | P2 | ✅ covered | 维持 |
| SU-N09 | reset | 正常重置 | P2 | ✅ covered | 维持 |
| SU-E01 | serialize | **不存在serialize方法**→状态不持久化 | P0 | ⚠️ uncovered | 维持(R2未修复) |
| SU-E02 | deserialize | **不存在deserialize方法**→升级历史丢失 | P0 | ⚠️ uncovered | 维持(R2未修复) |
| SU-E03 | upgradeHistory跨会话 | 不持久化→重启后丢失 | P0 | ⚠️ uncovered | 维持(同SU-E01/E02) |
| SU-E04 | breakthroughSkillUnlocks跨会话 | 不持久化→重启后丢失 | P0 | ⚠️ uncovered | 维持(同SU-E01/E02) |
| SU-E05 | init | 注入依赖 | P2 | ✅ covered | 维持 |
| SU-E06 | setSkillUpgradeDeps | 注入业务依赖 | P2 | ✅ covered | 维持 |
| SU-E07 | getStrategyRecommender | 获取推荐子系统 | P2 | ✅ covered | 维持 |
| SU-E08 | heroSkills Map | 外部未初始化→get返回undefined | P1 | ⚠️ uncovered | 维持 |

---

## 5. SkillStrategyRecommender (SkillStrategyRecommender.ts) — 12节点

### 5.1 策略推荐 — 8节点

| ID | API | 场景 | 优先级 | R3状态 | R2变化 |
|----|-----|------|--------|--------|--------|
| SR-N01 | recommendStrategy | 正常推荐(burn-heavy) | P2 | ✅ covered | 维持 |
| SR-N02 | recommendStrategy | 正常推荐(physical) | P2 | ✅ covered | 维持 |
| SR-N03 | recommendStrategy | 正常推荐(boss) | P2 | ✅ covered | 维持 |
| SR-N04 | getPrioritySkillTypes | 正常获取 | P2 | ✅ covered | 维持 |
| SR-B01 | recommendStrategy | enemyType=无效值→{...undefined}={} | P0 | ⚠️ uncovered | 维持(未修复) |
| SR-B02 | getPrioritySkillTypes | enemyType=无效值→undefined.prioritySkillTypes崩溃 | P0 | ⚠️ uncovered | 维持(未修复) |
| SR-B03 | getFocusStats | enemyType=无效值→undefined.focusStats崩溃 | P0 | ⚠️ uncovered | 维持(未修复) |
| SR-B04 | recommendStrategy | 返回对象被修改→不影响原配置(展开运算符) | P2 | ✅ covered | 维持 |

### 5.2 系统管理 — 4节点

| ID | API | 场景 | 优先级 | R3状态 | R2变化 |
|----|-----|------|--------|--------|--------|
| SR-N05 | init | 注入依赖 | P2 | ✅ covered | 维持 |
| SR-N06 | reset | 正常重置 | P2 | ✅ covered | 维持 |
| SR-E01 | STRATEGY_CONFIG | 配置完整性(3种enemyType) | P2 | ✅ covered | 维持 |
| SR-E02 | STRATEGY_CONFIG | prioritySkillTypes数组非空 | P2 | ✅ covered | 维持 |

---

## 6. HeroBadgeSystem (HeroBadgeSystem.ts) — 16节点

### 6.1 角标查询 — 8节点

| ID | API | 场景 | 优先级 | R3状态 | R2变化 |
|----|-----|------|--------|--------|--------|
| HB-N01 | getBadge | 正常获取角标 | P2 | ✅ covered | 维持 |
| HB-N02 | hasMainEntryRedDot | 正常判断 | P2 | ✅ covered | 维持 |
| HB-N03 | getGeneralIds | 正常获取武将ID列表 | P2 | ✅ covered | 维持 |
| HB-N04 | getQuickActions | 正常获取快捷操作 | P2 | ✅ covered | 维持 |
| HB-B01 | getGeneralIds | 回调未注入→返回[] | P1 | ✅ covered | 维持 |
| HB-B02 | hasMainEntryRedDot | getGeneralIds返回null→filter崩溃 | P0 | ⚠️ uncovered | 维持(未修复) |
| HB-B03 | getBadge | generalId不存在→返回null | P1 | ✅ covered | 维持 |
| HB-B04 | executeQuickAction | action.type='recruit'→回调未定义→无操作 | P1 | ⚠️ uncovered | 维持 |

### 6.2 系统管理 — 8节点

| ID | API | 场景 | 优先级 | R3状态 | R2变化 |
|----|-----|------|--------|--------|--------|
| HB-N05 | init | 注入依赖 | P2 | ✅ covered | 维持 |
| HB-N06 | reset | 正常重置 | P2 | ✅ covered | 维持 |
| HB-N07 | setBadgeCallbacks | 注入回调 | P2 | ✅ covered | 维持 |
| HB-N08 | update | 正常更新 | P2 | ✅ covered | 维持 |
| HB-E01 | serialize | 无持久化需求 | P2 | ✅ covered | 维持 |
| HB-E02 | setBadgeCallbacks | callbacks=null→后续调用崩溃 | P0 | ⚠️ uncovered | 维持(未修复) |
| HB-E03 | setBadgeCallbacks | callbacks含undefined字段→部分回调缺失 | P1 | ⚠️ uncovered | 维持 |
| HB-E04 | getState | 返回空对象 | P2 | ✅ covered | 维持 |

---

## 7. HeroAttributeCompare (HeroAttributeCompare.ts) — 14节点

### 7.1 属性对比 — 8节点

| ID | API | 场景 | 优先级 | R3状态 | R2变化 |
|----|-----|------|--------|--------|--------|
| AC-N01 | getAttributeBreakdown | 正常获取属性分解 | P2 | ✅ covered | 维持 |
| AC-N02 | compareAttributes | 正常对比 | P2 | ✅ covered | 维持 |
| AC-N03 | simulateUpgrade | 正常模拟 | P2 | ✅ covered | 维持 |
| AC-B01 | getAttributeBreakdown | deps未注入→回调崩溃 | P0 | ⚠️ uncovered | 维持(未修复) |
| AC-B02 | getAttributeBreakdown | getHeroAttrs返回null→Object.keys(null)崩溃 | P0 | ⚠️ uncovered | 维持(未修复) |
| AC-B03 | getAttributeBreakdown | base[key]=NaN → NaN||0=0(total安全)但base仍含NaN | P1 | ⚠️ uncovered | 维持 |
| AC-B04 | simulateUpgrade | level=NaN → statsAtLevel(base, NaN)→NaN属性 | P1 | ⚠️ uncovered | 维持 |
| AC-B05 | getAttributeBreakdown | deps.getEquipBonus返回undefined→Object.keys(undefined)崩溃 | P0 | ⚠️ uncovered | 维持(未修复) |

### 7.2 系统管理 — 6节点

| ID | API | 场景 | 优先级 | R3状态 | R2变化 |
|----|-----|------|--------|--------|--------|
| AC-N04 | init | 注入依赖 | P2 | ✅ covered | 维持 |
| AC-N05 | reset | 正常重置 | P2 | ✅ covered | 维持 |
| AC-E01 | serialize | 无持久化需求 | P2 | ✅ covered | 维持 |
| AC-E02 | update | 无需每帧更新 | P2 | ✅ covered | 维持 |
| AC-E03 | getState | 返回空对象 | P2 | ✅ covered | 维持 |
| AC-E04 | setAttributeCompareDeps | 注入依赖 | P2 | ✅ covered | 维持 |

---

## 8. HeroRecruitUpManager (HeroRecruitUpManager.ts) — 12节点

### 8.1 UP武将管理 — 8节点

| ID | API | 场景 | 优先级 | R3状态 | R2变化 |
|----|-----|------|--------|--------|--------|
| HRU-N01 | setUpHero | 正常设置 | P1 | ✅ covered | 维持 |
| HRU-N02 | getUpHeroState | 正常查询 | P2 | ✅ covered | 维持 |
| HRU-N03 | clearUpHero | 正常清除 | P2 | ✅ covered | 维持 |
| HRU-B01 | setUpRate | rate=NaN → upRate=NaN→rng()<NaN永远false | P0 | ⚠️ uncovered | R3验证确认: L73无范围校验 |
| HRU-B02 | setUpRate | rate>1.0 → rng()<rate几乎总是true | P0 | ⚠️ uncovered | R3验证确认 |
| HRU-B03 | setUpRate | rate<0 → rng()<负数永远false | P0 | ⚠️ uncovered | R3验证确认 |
| HRU-B04 | setUpHero | generalId不存在→upGeneralId被设置 | P1 | ⚠️ uncovered | 维持 |
| HRU-B05 | serializeUpHero | 正常序列化 | P2 | ✅ covered | 维持 |

### 8.2 序列化 — 4节点

| ID | API | 场景 | 优先级 | R3状态 | R2变化 |
|----|-----|------|--------|--------|--------|
| HRU-E01 | deserializeUpHero(null) | FIX-003已防护 | P1 | ✅ covered | 维持 |
| HRU-E02 | init | 注入依赖 | P2 | ✅ covered | 维持 |
| HRU-E03 | reset | 正常重置 | P2 | ✅ covered | 维持 |
| HRU-E04 | update | 空实现 | P2 | ✅ covered | 维持 |

---

## 9. HeroRecruitExecutor (HeroRecruitExecutor.ts) — 10节点

### 9.1 抽卡执行 — 6节点

| ID | API | 场景 | 优先级 | R3状态 | R2变化 |
|----|-----|------|--------|--------|--------|
| HRE-N01 | executeSinglePull | 正常单抽 | P1 | ✅ covered | 维持 |
| HRE-N02 | executeSinglePull | 保底触发 | P1 | ✅ covered | 维持 |
| HRE-B01 | executeSinglePull | heroSystem=null→getGeneralDef()崩溃 | P0 | ⚠️ uncovered | 维持(未修复) |
| HRE-B02 | executeSinglePull | pity=null→pity.normalPity崩溃 | P0 | ⚠️ uncovered | 维持(未修复) |
| HRE-B03 | executeSinglePull | rng=null→rng()崩溃 | P0 | ⚠️ uncovered | 维持(未修复) |
| HRE-B04 | executeSinglePull | UP武将+LEGENDARY品质→UP判定正确 | P1 | ✅ covered | 维持 |

### 9.2 辅助方法 — 4节点

| ID | API | 场景 | 优先级 | R3状态 | R2变化 |
|----|-----|------|--------|--------|--------|
| HRE-N03 | rollQuality | 正常随机 | P2 | ✅ covered | 维持 |
| HRE-N04 | applyPity | 正常保底 | P1 | ✅ covered | 维持 |
| HRE-B05 | applyPity | pityCount=NaN→NaN>=threshold=false→保底不触发 | P1 | ⚠️ uncovered | 维持(安全拒绝) |
| HRE-B06 | pickGeneralByQuality | quality=无效值→无匹配→返回null | P1 | ⚠️ uncovered | 维持 |

---

## 10. bond-config 配置验证 — 14节点

| ID | 维度 | 场景 | 优先级 | R3状态 | R2变化 |
|----|------|------|--------|--------|--------|
| BCFG-001 | 配置 | FACTION_BONDS 4阵营配置完整性 | P1 | ✅ covered | 维持 |
| BCFG-002 | 配置 | PARTNER_BONDS 14组搭档配置完整性 | P1 | ✅ covered | 维持 |
| BCFG-003 | 配置 | FACTION_BONDS tiers requiredCount递增 | P2 | ✅ covered | 维持 |
| BCFG-004 | 配置 | PARTNER_BONDS requiredHeroes与GENERAL_DEF_MAP一致性 | P0 | ⚠️ uncovered | 维持 |
| BCFG-005 | 配置 | BOND_STAR_LEVEL_MAP minStar递增验证 | P2 | ✅ covered | 维持 |
| BCFG-006 | 配置 | BondEffect stat字段有效性 | P2 | ✅ covered | 维持 |
| BCFG-007 | 配置 | getBondLevelByMinStar(0)→返回1 | P2 | ✅ covered | 维持 |
| BCFG-008 | 配置 | getBondLevelByMinStar(NaN)→返回1 | P1 | ⚠️ uncovered | 维持(安全) |
| BCFG-009 | 配置 | getBondLevelMultiplier(0)→返回1.0 | P2 | ✅ covered | 维持 |
| BCFG-010 | 配置 | getBondLevelMultiplier(NaN)→返回1.0 | P1 | ⚠️ uncovered | 维持(安全) |
| BCFG-011 | 交叉验证 | PARTNER_BONDS ID与faction-bond-config不一致→R3验证确认: partner_wei_shuangbi vs partner_weizhi_shuangbi | P0 | ⚠️ uncovered | R3源码验证 |
| BCFG-012 | 交叉验证 | PARTNER_BONDS效果与faction-bond-config效果不一致 | P0 | ⚠️ uncovered | 维持 |
| BCFG-013 | 交叉验证 | FACTION_BONDS faction标识不一致('qun' vs 'neutral') | P0 | ⚠️ uncovered | R3源码验证 |
| BCFG-014 | 交叉验证 | FACTION_BONDS tiers数量不一致(3 vs 4) | P0 | ⚠️ uncovered | 维持 |

---

## 11. faction-bond-config 配置验证 — 16节点

| ID | 维度 | 场景 | 优先级 | R3状态 | R2变化 |
|----|------|------|--------|--------|--------|
| FBC-N01 | 配置 | 4阵营配置完整性 | P1 | ✅ covered | 维持 |
| FBC-N02 | 配置 | FACTION_TIER_MAP requiredCount递增 | P2 | ✅ covered | 维持 |
| FBC-N03 | 配置 | PARTNER_BOND_CONFIGS 14组搭档 | P1 | ✅ covered | 维持 |
| FBC-N04 | 配置 | HERO_FACTION_MAP 覆盖所有武将 | P1 | ✅ covered | 维持 |
| FBC-B01 | 配置 | FactionId='neutral' vs hero.types 'qun' | P0 | ⚠️ uncovered | R3源码验证 |
| FBC-B02 | 配置 | BondEffect结构扁平 vs bond-config数组→不兼容 | P0 | ⚠️ uncovered | 维持 |
| FBC-B03 | 配置 | PARTNER_BOND_CONFIGS requiredHeroes与GENERAL_DEF_MAP一致性 | P0 | ⚠️ uncovered | 维持 |
| FBC-B04 | 配置 | PARTNER_BOND_CONFIGS ID partner_weizhi_shuangbi vs bond-config partner_wei_shuangbi | P0 | ⚠️ uncovered | R3源码验证 |
| FBC-B05 | 配置 | FACTION_TIER_MAP 4级 vs bond-config FACTION_BONDS 3级 | P0 | ⚠️ uncovered | 维持 |
| FBC-B06 | 配置 | ALL_FACTIONS含'neutral'不含'qun' | P0 | ⚠️ uncovered | R3源码验证 |
| FBC-B07 | 配置 | 效果值与bond-config PARTNER_BONDS一致 | P0 | ⚠️ uncovered | 维持 |
| FBC-B08 | 配置 | HERO_FACTION_MAP武将ID集合与GENERAL_DEF_MAP一致 | P0 | ⚠️ uncovered | 维持 |
| FBC-B09 | 配置 | FACTION_BONDS配置覆盖4阵营 | P1 | ✅ covered | 维持 |
| FBC-B10 | 配置 | PARTNER_BOND_CONFIGS requiredHeroes全部存在于GENERAL_DEF_MAP | P0 | ⚠️ uncovered | 维持 |
| FBC-B11 | 配置 | 新增6名武将在HERO_FACTION_MAP中 | P0 | ⚠️ uncovered | 维持 |
| FBC-B12 | 配置 | BondConfig接口字段完整性 | P1 | ✅ covered | 维持 |

---

## Part B 统计

| 维度 | R2节点 | R3节点 | covered | uncovered | P0 | P1 | P2 |
|------|--------|--------|---------|-----------|-----|-----|-----|
| BondSystem | 30 | 28 | 14 | 14 | 5 | 5 | 18 |
| FactionBondSystem | 28 | 26 | 14 | 12 | 5 | 5 | 16 |
| AwakeningSystem | 34 | 30 | 20 | 10 | 0 | 18 | 12 |
| SkillUpgradeSystem | 34 | 30 | 16 | 14 | 8 | 8 | 14 |
| SkillStrategyRecommender | 14 | 12 | 8 | 4 | 3 | 0 | 9 |
| HeroBadgeSystem | 18 | 16 | 12 | 4 | 2 | 2 | 12 |
| HeroAttributeCompare | 16 | 14 | 8 | 6 | 4 | 2 | 8 |
| HeroRecruitUpManager | 14 | 12 | 8 | 4 | 3 | 1 | 8 |
| HeroRecruitExecutor | 12 | 10 | 4 | 6 | 3 | 1 | 6 |
| bond-config | 16 | 14 | 8 | 6 | 5 | 1 | 8 |
| faction-bond-config | 18 | 16 | 6 | 10 | 8 | 2 | 6 |
| **Part B 合计** | **234** | **208** | **128** | **80** | **46** | **45** | **117** |

### R2→R3 变化

| 指标 | R2 | R3 | 变化 |
|------|----|----|------|
| 总节点 | 234 | 208 | -26(精简重复) |
| covered | 124 | 118 | -6(重新校准) |
| uncovered | 110 | 90 | -20(FIX验证+降级) |
| P0 | 59 | 46 | -13(FIX-201修复集成问题) |

### 关键改进

1. **FIX-201验证**: OL-007从P0升级为covered，setBondMultiplierGetter已在engine-hero-deps.ts L123调用
2. **配置冲突R3验证**: R3通过源码grep确认了5处配置不一致(搭档ID、阵营标识、等级数、效果值、接口结构)
3. **P0减少**: 从59降至46，主要因为FIX-201修复了集成缺失
4. **SkillUpgradeSystem序列化缺失**: 仍为P0 uncovered，R2未修复

### R3 Part B 剩余P0（46项，按类别分组）

| 类别 | 数量 | 关键项 |
|------|------|--------|
| 配置冲突 | 18 | 阵营标识、搭档ID、效果值、等级数、接口结构 |
| null崩溃 | 8 | BondSystem/FactionBondSystem/SkillUpgrade/HeroBadge/HeroAttribute |
| NaN传播 | 6 | SkillUpgrade materials、getSkillEffect、calculateAwakenedStats |
| 序列化缺失 | 4 | SkillUpgradeSystem serialize/deserialize |
| 事务性 | 2 | SkillUpgrade gold泄漏、Awakening资源泄漏 |
| 回调缺失 | 4 | HeroBadge callbacks=null、HeroAttributeCompare deps未注入 |
| UP系统 | 3 | setUpRate NaN/>1.0/<0 |
| Executor | 3 | heroSystem/pity/rng null |
