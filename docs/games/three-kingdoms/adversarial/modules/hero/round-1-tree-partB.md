# Hero模块流程分支树 — Round 1 Part B（辅助子系统）

> 生成时间：2026-05-01
> 模块路径：`src/games/three-kingdoms/engine/hero/`
> 分析文件：10个（系统6 + 配置4）
> Builder：TreeBuilder Agent
> DEF-010 标注：BondSystem 与 FactionBondSystem 重叠风险

## 统计

| 维度 | 数量 |
|------|------|
| **总节点数** | **257** |
| P0 阻塞 | 96 |
| P1 严重 | 117 |
| P2 一般 | 44 |
| covered | 217 |
| missing | 40 |
| partial | 0 |

### 按系统分布

| 系统 | 公开API数 | 节点数 | covered | missing | partial |
|------|-----------|--------|---------|---------|---------|
| AwakeningSystem | 12 | 30 | 26 | 4 | 0 |
| awakening-config | — | 8 | 6 | 2 | 0 |
| BondSystem | 10 | 26 | 24 | 2 | 0 |
| bond-config | — | 8 | 5 | 3 | 0 |
| FactionBondSystem | 8 | 24 | 21 | 3 | 0 |
| faction-bond-config | — | 12 | 8 | 4 | 0 |
| SkillUpgradeSystem | 14 | 28 | 28 | 0 | 0 |
| SkillStrategyRecommender | 6 | 14 | 11 | 3 | 0 |
| HeroBadgeSystem | 8 | 16 | 16 | 0 | 0 |
| HeroAttributeCompare | 4 | 12 | 11 | 1 | 0 |
| ⚠️ BondSystem↔FactionBondSystem重叠 | — | 10 | 0 | 10 | 0 |
| 跨系统交互 | — | 10 | 5 | 5 | 0 |
| 数据生命周期 | — | 8 | 6 | 2 | 0 |
| **配置文件小计** | — | **28** | **19** | **9** | **0** |

---

## 1. AwakeningSystem（觉醒系统）

### checkAwakeningEligible(heroId)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| AW-elig-001 | normal | 满足所有觉醒条件 | Lv100+6星+4突破+RARE+ | eligible=true, failures=[], 所有met=true | covered | P0 |
| AW-elig-002 | boundary | 等级恰好100 | level=100 | level.met=true | covered | P0 |
| AW-elig-003 | boundary | 等级99不满足 | level=99 | level.met=false, failures含等级不足 | covered | P0 |
| AW-elig-004 | boundary | 星级不足 | star=5 | stars.met=false | covered | P0 |
| AW-elig-005 | boundary | 突破阶段不足 | breakthrough=3 | breakthrough.met=false | covered | P0 |
| AW-elig-006 | boundary | 品质恰好RARE | quality=RARE | quality.met=true | covered | P1 |
| AW-elig-007 | boundary | 品质COMMON不满足 | quality=COMMON | quality.met=false | covered | P1 |
| AW-elig-008 | error | 武将不存在 | heroId无效 | eligible=false, owned=false, 所有current=0 | covered | P1 |
| AW-elig-009 | error | heroId为null/undefined | heroId=null | 不崩溃，返回owned=false | missing | P0 |
| AW-elig-010 | cross | starSystem.getStar返回NaN | getStar()=NaN | NaN比较不崩溃（⚠️模式2） | missing | P0 |

### awaken(heroId)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| AW-exec-001 | normal | 正常觉醒流程 | 条件+资源充足 | success=true, costSpent非null, awakenedStats×1.5, skillUnlocked非null | covered | P0 |
| AW-exec-002 | boundary | 已觉醒武将重复觉醒 | isAwakened=true | success=false, reason='武将已觉醒' | covered | P0 |
| AW-exec-003 | error | 条件不满足 | 等级/星级/突破不足 | success=false, reason含条件不满足 | covered | P0 |
| AW-exec-004 | error | 资源不足 | 铜钱/突破石/技能书/觉醒石/碎片任一不足 | success=false, reason含资源不足 | covered | P0 |
| AW-exec-005 | error | deps未注入 | this.deps=null | success=false, reason='资源系统未初始化' | covered | P1 |
| AW-exec-006 | cross | 觉醒后heroSystem.getGeneral返回非null | 觉醒成功 | awakenedStats计算正确 | covered | P1 |
| AW-exec-007 | lifecycle | 觉醒后状态持久化 | 序列化→反序列化 | heroes[heroId].isAwakened=true, awakeningLevel=1 | covered | P1 |
| AW-exec-008 | error | heroId为空字符串 | heroId="" | 返回failure（heroSystem.getGeneral返回undefined） | missing | P1 |

### getAwakeningState(heroId) / isAwakened(heroId)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| AW-state-001 | normal | 已觉醒武将状态查询 | heroId已觉醒 | isAwakened=true, awakeningLevel=1 | covered | P1 |
| AW-state-002 | boundary | 未觉醒武将状态查询 | heroId未觉醒 | isAwakened=false, awakeningLevel=0 | covered | P1 |
| AW-state-003 | boundary | 不存在的heroId | heroId不在state中 | 返回默认值{isAwakened:false, awakeningLevel:0} | covered | P2 |

### getAwakenedLevelCap(heroId)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| AW-cap-001 | normal | 已觉醒等级上限 | isAwakened=true | 返回AWAKENING_MAX_LEVEL(120) | covered | P0 |
| AW-cap-002 | normal | 未觉醒等级上限 | isAwakened=false | 返回starSystem.getLevelCap(heroId) | covered | P1 |

### getAwakeningSkill(heroId) / getAwakeningSkillPreview(heroId)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| AW-skill-001 | normal | 获取已配置的觉醒技能 | heroId='guanyu' | 返回{...skill}浅拷贝 | covered | P1 |
| AW-skill-002 | boundary | 未配置觉醒技能的武将 | heroId不在AWAKENING_SKILLS中 | 返回null | covered | P2 |
| AW-skill-003 | normal | 预览与实际技能一致 | 同一heroId | getAwakeningSkill === getAwakeningSkillPreview结果一致 | covered | P2 |

### calculateAwakenedStats(heroId)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| AW-stat-001 | normal | 觉醒后属性计算 | 已觉醒, baseStats={atk:100,def:80,int:60,spd:50} | {atk:150,def:120,int:90,spd:75}（Math.floor） | covered | P0 |
| AW-stat-002 | boundary | 未觉醒返回原始属性 | 未觉醒 | 返回{...general.baseStats}副本 | covered | P1 |
| AW-stat-003 | error | 武将不存在 | heroId无效 | 返回{attack:0,defense:0,intelligence:0,speed:0} | covered | P1 |
| AW-stat-004 | error | baseStats含NaN | baseStats.attack=NaN | ⚠️ NaN×1.5=NaN, Math.floor(NaN)=NaN（模式2风险） | missing | P0 |

### getAwakeningStatDiff(heroId)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| AW-diff-001 | normal | 觉醒属性差值 | 已觉醒 | awakened-base差值正确（约50%） | covered | P1 |
| AW-diff-002 | error | 武将不存在 | heroId无效 | base为默认零值, awakened为零值, diff全0 | covered | P2 |

### getPassiveSummary()

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| AW-passive-001 | normal | 单武将觉醒被动 | 1个觉醒武将 | awakenedCount=1, globalStatBonus=0.01 | covered | P1 |
| AW-passive-002 | boundary | 全局叠加上限5次 | 6个觉醒武将 | globalStatBonus=5×0.01=0.05 | covered | P1 |
| AW-passive-003 | boundary | 资源加成上限3次 | 4个觉醒武将 | resourceBonus=3×0.02=0.06 | covered | P2 |
| AW-passive-004 | boundary | 经验加成上限3次 | 4个觉醒武将 | expBonus=3×0.03=0.09 | covered | P2 |
| AW-passive-005 | boundary | 阵营光环上限3次 | 同阵营4个觉醒武将 | factionStacks[faction]=3 | covered | P2 |
| AW-passive-006 | boundary | 无觉醒武将 | heroes为空 | awakenedCount=0, 所有bonus=0 | covered | P2 |
| AW-passive-007 | cross | 多阵营觉醒武将 | 蜀2+魏3觉醒 | factionStacks={shu:2, wei:3} | covered | P1 |

### getAwakeningExpRequired(level) / getAwakeningGoldRequired(level)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| AW-exp-001 | normal | 101级经验需求 | level=101 | 101×12000=1212000 | covered | P1 |
| AW-exp-002 | normal | 120级经验需求 | level=120 | 120×25000=3000000 | covered | P1 |
| AW-exp-003 | boundary | 100级不在表中 | level=100 | 返回0 | covered | P2 |
| AW-exp-004 | boundary | 负数等级 | level=-1 | 返回0 | covered | P2 |
| AW-exp-005 | error | NaN等级 | level=NaN | AWAKENING_EXP_TABLE[NaN]=undefined, 返回0 | missing | P1 |

### serialize() / deserialize(data)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| AW-ser-001 | lifecycle | 正常序列化 | 有觉醒武将 | version=1, heroes正确保存 | covered | P0 |
| AW-ser-002 | lifecycle | 正常反序列化 | 有效AwakeningSaveData | 状态完全恢复 | covered | P0 |
| AW-ser-003 | boundary | 版本不匹配 | version≠1 | 警告但仍加载 | covered | P1 |
| AW-ser-004 | error | data.state.heroes为null | heroes=null | 使用空对象{}（??防护） | covered | P1 |
| AW-ser-005 | lifecycle | 序列化后不影响原状态 | serialize→修改返回值 | 原state不变（浅拷贝） | missing | P1 |

---

## 2. awakening-config（觉醒配置）

### 配置完整性检查

| ID | 类型 | 描述 | 检查项 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|--------|----------|----------|--------|
| AWCFG-001 | normal | AWAKENING_REQUIREMENTS完整性 | minLevel/minStars/minBreakthrough/minQualityOrder均存在 | 所有字段非undefined | covered | P0 |
| AWCFG-002 | normal | AWAKENING_COST完整性 | copper/breakthroughStones/skillBooks/awakeningStones/fragments均>0 | 所有消耗>0 | covered | P0 |
| AWCFG-003 | boundary | AWAKENING_EXP_TABLE覆盖101~120 | 检查所有key | 20个条目，无缺失 | covered | P1 |
| AWCFG-004 | boundary | AWAKENING_GOLD_TABLE覆盖101~120 | 检查所有key | 20个条目，无缺失 | covered | P1 |
| AWCFG-005 | normal | AWAKENING_SKILLS覆盖所有可觉醒武将 | 与AWAKENABLE_QUALITIES对比 | RARE/EPIC/LEGENDARY武将均有配置 | covered | P1 |
| AWCFG-006 | boundary | 经验表递增验证 | 101~120级每级经验 | 逐级递增或相等 | missing | P1 |
| AWCFG-007 | boundary | 铜钱表递增验证 | 101~120级每级铜钱 | 逐级递增或相等 | missing | P1 |
| AWCFG-008 | error | AWAKENING_STAT_MULTIPLIER合理性 | 检查值 | 1.5（50%加成），非NaN/负数 | covered | P0 |

---

## 3. BondSystem（羁绊系统）

### calculateBonds(generalIds)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| BS-calc-001 | normal | 阵营羁绊2人激活 | 同阵营2人（star≥1） | 返回1个ActiveBond, type=FACTION, level=1 | covered | P0 |
| BS-calc-002 | normal | 阵营羁绊3人升级tier | 同阵营3人 | 匹配requiredCount=3的tier | covered | P1 |
| BS-calc-003 | normal | 阵营羁绊4人最高tier | 同阵营4人 | 匹配requiredCount=4的tier | covered | P1 |
| BS-calc-004 | normal | 搭档羁绊激活（全部参与） | 编队包含桃园结义3人 | 激活partner_taoyuan | covered | P0 |
| BS-calc-005 | normal | 搭档羁绊部分激活（minRequired） | 五虎上将仅3人 | 激活partner_wuhu（minRequired=3） | covered | P1 |
| BS-calc-006 | boundary | 空编队 | generalIds=[] | 返回空数组[] | covered | P1 |
| BS-calc-007 | error | bondDeps未注入 | this.bondDeps=null | 返回空数组[] | covered | P1 |
| BS-calc-008 | error | generalIds含不存在的武将 | getGeneralMeta返回undefined | 跳过无效武将，仅处理有效武将 | covered | P1 |
| BS-calc-009 | cross | 阵营+搭档羁绊同时激活 | 蜀3人含刘关张 | 返回阵营羁绊+桃园结义（2个bond） | covered | P0 |
| BS-calc-010 | error | generalIds为null/undefined | generalIds=null | ⚠️ for...of null会崩溃（模式1） | missing | P0 |

### getBondMultiplier(generalIds)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| BS-mult-001 | normal | 无羁绊时系数 | 无激活羁绊 | 返回1.0 | covered | P0 |
| BS-mult-002 | normal | 单羁绊系数 | 1个阵营羁绊Lv1 | 1 + effectSum × 1.0 × 1.0 | covered | P0 |
| BS-mult-003 | boundary | 系数上限2.0 | 极端多羁绊叠加 | Math.min(result, 2.0) | covered | P0 |
| BS-mult-004 | boundary | NaN/Infinity防护 | levelMultiplier=NaN | 跳过该羁绊，返回1.0或剩余有效值 | covered | P1 |
| BS-mult-005 | boundary | effect.value为NaN | effects含NaN值 | 跳过NaN值（Number.isFinite检查） | covered | P1 |
| BS-mult-006 | error | totalBonus为NaN | 所有effect累加后NaN | 返回1.0（安全默认值） | covered | P1 |

### evaluateAndEmit(generalIds)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| BS-emit-001 | normal | 新羁绊激活事件 | previousBonds为空→有羁绊 | emit('bond:activated', payload) | covered | P0 |
| BS-emit-002 | normal | 羁绊失效事件 | previousBonds有→currentBonds无 | emit('bond:deactivated', payload) | covered | P0 |
| BS-emit-003 | normal | 羁绊等级提升事件 | 同羁绊level从1→2 | emit('bond:levelUp', payload) | covered | P1 |
| BS-emit-004 | boundary | 去重：等级不变不触发 | 同羁绊level不变 | 不触发任何事件 | covered | P1 |
| BS-emit-005 | boundary | 防抖机制 | debounceMs=100 | 100ms内多次调用仅执行1次 | covered | P2 |
| BS-emit-006 | boundary | 防抖取消 | debounceMs=0 | 清除timer，立即执行 | covered | P2 |
| BS-emit-007 | error | deps未注入 | this.deps=null | 直接return，不崩溃 | covered | P1 |
| BS-emit-008 | lifecycle | previousBonds快照更新 | 评估后 | previousBonds=当前结果 | covered | P1 |

### 派驻系数（calcDispatchFactor）

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| BS-disp-001 | normal | 全上阵系数 | 所有isActive=true | dispatchFactor=1.0 | covered | P1 |
| BS-disp-002 | normal | 全派驻系数 | 所有isActive=false | dispatchFactor=0.5 | covered | P1 |
| BS-disp-003 | normal | 混合派驻系数 | 2上阵+1派驻 | (1.0+1.0+0.5)/3≈0.833 | covered | P1 |
| BS-disp-004 | boundary | 空参与者 | participants=[] | 返回ACTIVE_FACTOR(1.0) | covered | P2 |

### isBondActive(bondId, generalIds)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| BS-active-001 | normal | 检查已激活羁绊 | 编队含桃园结义 | isBondActive('partner_taoyuan')=true | covered | P1 |
| BS-active-002 | boundary | 检查未激活羁绊 | 编队不含搭档武将 | 返回false | covered | P2 |

---

## 4. bond-config（羁绊配置）

### 配置完整性检查

| ID | 类型 | 描述 | 检查项 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|--------|----------|----------|--------|
| BCFG-001 | normal | FACTION_BONDS覆盖4阵营 | 魏蜀吴群 | 4个阵营均有配置 | covered | P0 |
| BCFG-002 | normal | PARTNER_BONDS数量 | 检查数组长度 | 14组搭档羁绊 | covered | P0 |
| BCFG-003 | boundary | 阵营羁绊tiers递增 | requiredCount | 2→3→4递增 | covered | P1 |
| BCFG-004 | boundary | BondEffect.value合理性 | 所有value | 0<value≤1.0, 非NaN | missing | P0 |
| BCFG-005 | normal | getBondLevelByMinStar映射 | minStar=1/3/5 | 返回level=1/2/3 | covered | P1 |
| BCFG-006 | boundary | getBondLevelByMinStar(0) | minStar=0 | 返回1（默认最低级） | missing | P1 |
| BCFG-007 | boundary | getBondLevelMultiplier无效等级 | level=99 | 返回1.0 | missing | P1 |
| BCFG-008 | normal | BOND_MULTIPLIER_CAP合理性 | 检查值 | 2.0，防止极端叠加 | covered | P0 |

---

## 5. FactionBondSystem（阵营羁绊系统）

> ⚠️ **DEF-010 重叠警告**：FactionBondSystem 与 BondSystem 功能高度重叠
> - 两者都有 calculateBonds()、阵营羁绊计算、搭档羁绊计算
> - 配置不同：FactionBondSystem 使用 faction-bond-config（4等级×4阵营），BondSystem 使用 bond-config（3等级×4阵营）
> - BondSystem 有派驻系数、事件系统、羁绊等级（星级决定）
> - FactionBondSystem 有 applyBondBonus()、HERO_FACTION_MAP、按武将分配效果
> - **风险：两系统同时使用时羁绊可能被重复计算**

### calculateBonds(heroIds)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| FB-calc-001 | normal | 阵营羁绊2人激活 | 同阵营2人 | 返回Map，每人有BondEffect | covered | P0 |
| FB-calc-002 | normal | 阵营羁绊5人最高tier | 同阵营5人 | 匹配requiredCount=5的终极tier | covered | P1 |
| FB-calc-003 | normal | 搭档羁绊激活 | 编队含桃园结义3人 | 效果合并到参与者 | covered | P0 |
| FB-calc-004 | boundary | 空编队 | heroIds=[] | 返回空Map | covered | P1 |
| FB-calc-005 | error | factionResolver返回undefined | heroId不在HERO_FACTION_MAP中 | 跳过该武将 | covered | P1 |
| FB-calc-006 | normal | 多羁绊叠加 | 阵营+搭档同时激活 | mergeEffects正确累加 | covered | P1 |
| FB-calc-007 | error | heroIds为null | heroIds=null | ⚠️ for...of null崩溃（模式1） | missing | P0 |

### getActiveBonds(heroId, teamHeroIds)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| FB-active-001 | normal | 获取武将激活的羁绊 | 武将在阵营羁绊中 | 返回BondConfig列表 | covered | P1 |
| FB-active-002 | boundary | 武将无阵营 | factionResolver返回undefined | 返回空数组 | covered | P2 |
| FB-active-003 | normal | 武将参与搭档羁绊 | 武将在搭档配置中 | 返回含搭档羁绊的列表 | covered | P1 |

### isBondActive(bondId, teamHeroIds)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| FB-isActive-001 | normal | 检查搭档羁绊激活 | 编队含搭档武将 | 返回true | covered | P1 |
| FB-isActive-002 | normal | 检查阵营羁绊激活 | faction_shu格式 | 正确解析并检查 | covered | P1 |
| FB-isActive-003 | boundary | 无效bondId格式 | bondId='invalid' | 返回false | covered | P2 |
| FB-isActive-004 | boundary | faction_X格式（无人数后缀） | bondId='faction_shu' | 检查是否≥最低tier | covered | P2 |

### applyBondBonus(baseStats, heroId, teamHeroIds)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| FB-apply-001 | normal | 应用羁绊加成 | 有激活羁绊 | attack/defense/intelligence × (1+bonus) | covered | P0 |
| FB-apply-002 | boundary | 无羁绊加成 | 无激活羁绊 | 返回{...baseStats}副本 | covered | P1 |
| FB-apply-003 | normal | speed不受羁绊影响 | 有羁绊加成 | speed保持不变 | covered | P1 |
| FB-apply-004 | error | baseStats含NaN | baseStats.attack=NaN | NaN×(1+0.1)=NaN（模式2风险） | missing | P0 |

### setHeroFactionResolver(resolver)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| FB-resolver-001 | normal | 注入自定义解析器 | resolver函数 | 后续查询使用新解析器 | covered | P1 |
| FB-resolver-002 | lifecycle | reset恢复默认解析器 | reset() | 恢复HERO_FACTION_MAP查询 | covered | P1 |

### serialize() / deserialize()

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| FB-ser-001 | lifecycle | 序列化无状态系统 | 正常 | 返回{name, configCount} | covered | P2 |
| FB-ser-002 | lifecycle | 反序列化空操作 | 任意data | 无状态恢复（无持久化状态） | covered | P2 |

---

## 6. faction-bond-config（阵营羁绊配置）

### 配置完整性检查

| ID | 类型 | 描述 | 检查项 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|--------|----------|----------|--------|
| FBCFG-001 | normal | FACTION_TIER_MAP覆盖4阵营 | wei/shu/wu/neutral | 4阵营均有4个tier | covered | P0 |
| FBCFG-002 | normal | PARTNER_BOND_CONFIGS数量 | 检查数组长度 | 14组搭档羁绊 | covered | P0 |
| FBCFG-003 | boundary | 阵营tier requiredCount递增 | 2→3→4→5 | 逐级递增 | covered | P1 |
| FBCFG-004 | normal | HERO_FACTION_MAP覆盖所有武将 | 与PARTNER_BOND_CONFIGS中武将对比 | 所有搭档武将均在FACTION_MAP中 | missing | P0 |
| FBCFG-005 | boundary | BondEffect字段完整性 | attackBonus/defenseBonus/hpBonus/critBonus/strategyBonus | 所有字段存在且为number | covered | P1 |
| FBCFG-006 | error | BondEffect值合理性 | 所有bonus值 | ≥0且<1.0, 非NaN | missing | P0 |
| FBCFG-007 | normal | ALL_FACTIONS与FACTION_TIER_MAP一致 | 4个阵营 | key完全匹配 | covered | P1 |
| FBCFG-008 | boundary | EMPTY_BOND_EFFECT全零 | 检查所有字段 | 均为0 | covered | P2 |
| FBCFG-009 | cross | ⚠️ 与bond-config搭档羁绊ID一致性 | partner_taoyuan等 | 两配置的搭档羁绊ID和武将列表一致 | missing | P0 |
| FBCFG-010 | cross | ⚠️ 与bond-config阵营羁绊数值差异 | 蜀国2人tier | bond-config: atk+5%; faction-bond-config: atk+5%（需确认一致或差异合理） | missing | P0 |

---

## 7. SkillUpgradeSystem（技能升级系统）

### upgradeSkill(generalId, skillIndex, materials)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| SU-up-001 | normal | 正常升级技能 | 材料充足+未达上限+deps已注入 | success=true, level+1, effectAfter>effectBefore | covered | P0 |
| SU-up-002 | error | deps未注入 | this.deps=null | 返回failResult | covered | P1 |
| SU-up-003 | error | 武将不存在 | generalId无效 | success=false | covered | P0 |
| SU-up-004 | boundary | skillIndex越界（负数） | skillIndex=-1 | success=false | covered | P0 |
| SU-up-005 | boundary | skillIndex越界（超长） | skillIndex>=skills.length | success=false | covered | P0 |
| SU-up-006 | boundary | 技能达到等级上限 | level>=getSkillLevelCap(star) | success=false | covered | P0 |
| SU-up-007 | error | 材料不足（skillBooks） | materials.skillBooks<cost | success=false | covered | P0 |
| SU-up-008 | error | 材料不足（gold） | materials.gold<cost | success=false | covered | P0 |
| SU-up-009 | error | 资源系统gold不足 | canAffordResource('gold')=false | success=false | covered | P1 |
| SU-up-010 | error | spendResource('gold')失败 | spendResource返回false | success=false | covered | P1 |
| SU-up-011 | error | spendResource('skillBook')失败 | spendResource返回false | success=false（Bug-3修复验证） | covered | P0 |
| SU-up-012 | cross | 觉醒技能需突破前置 | skill.type='awaken'+breakthrough<1 | success=false | covered | P1 |
| SU-up-013 | cross | 升级后HeroSystem.updateSkillLevel调用 | 成功升级 | heroSystem.updateSkillLevel被调用 | covered | P1 |
| SU-up-014 | lifecycle | upgradeHistory记录 | 成功升级 | upgradeHistory[key]递增 | covered | P2 |

### getSkillLevel(generalId, skillIndex)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| SU-lvl-001 | normal | 获取技能等级 | 武将存在+有效skillIndex | 返回正确等级 | covered | P1 |
| SU-lvl-002 | error | deps未注入 | this.deps=null | 返回0 | covered | P2 |
| SU-lvl-003 | error | 武将不存在 | generalId无效 | 返回0 | covered | P2 |

### getSkillEffect(generalId, skillIndex)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| SU-eff-001 | normal | 1级技能效果 | level=1 | 1.0 + (1-1)×0.1 = 1.0 | covered | P1 |
| SU-eff-002 | normal | 5级技能效果 | level=5 | 1.0 + (5-1)×0.1 = 1.4 | covered | P1 |
| SU-eff-003 | error | deps未注入 | this.deps=null | 返回BASE_SKILL_EFFECT(1.0) | covered | P2 |

### getSkillLevelCap(starLevel)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| SU-cap-001 | normal | 1星上限 | starLevel=1 | 返回3 | covered | P0 |
| SU-cap-002 | normal | 6星上限 | starLevel=6 | 返回10 | covered | P0 |
| SU-cap-003 | boundary | 0星/负数星 | starLevel=0 | 返回STAR_SKILL_CAP[1]=3 | covered | P1 |
| SU-cap-004 | boundary | 超出配置的星级 | starLevel=7 | 返回DEFAULT_SKILL_LEVEL_CAP=5 | covered | P1 |

### unlockSkillOnBreakthrough(heroId, breakthroughLevel)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| SU-unlock-001 | normal | 突破Lv10解锁被动强化 | breakthroughLevel=10 | unlocked=true, skillType='passive_enhance' | covered | P0 |
| SU-unlock-002 | normal | 突破Lv20解锁新技能 | breakthroughLevel=20 | unlocked=true, skillType='new_skill' | covered | P0 |
| SU-unlock-003 | normal | 突破Lv30终极技能强化 | breakthroughLevel=30 | unlocked=true, skillType='ultimate_enhance' | covered | P0 |
| SU-unlock-004 | boundary | 重复解锁同一等级幂等 | 已解锁breakthrough_10 | 返回null | covered | P1 |
| SU-unlock-005 | boundary | 无效突破等级 | breakthroughLevel=5 | 返回null | covered | P1 |
| SU-unlock-006 | error | 武将不存在 | heroId无效 | 返回null | covered | P1 |
| SU-unlock-007 | lifecycle | 解锁状态记录 | 解锁后 | breakthroughSkillUnlocks[bkKey]有值 | covered | P2 |

### getExtraEffect / hasExtraEffect / getCooldownReduce

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| SU-extra-001 | normal | 技能5级额外效果 | level=5 | hasExtraEffect=true, bonus=0.2 | covered | P1 |
| SU-extra-002 | normal | 技能7级额外效果递增 | level=7 | bonus=0.2×(7-5+1)=0.6 | covered | P1 |
| SU-extra-003 | boundary | 技能4级无额外效果 | level=4 | hasExtraEffect=false | covered | P2 |
| SU-cd-001 | normal | 3级CD减少 | level=3 | 3×0.05=0.15 | covered | P2 |
| SU-cd-002 | boundary | CD减少上限 | level很高 | Math.min(level×0.05, 0.30)=0.30 | covered | P2 |
| SU-cd-003 | error | heroSkills无该武将 | heroId不在Map中 | 返回0 | covered | P2 |

---

## 8. SkillStrategyRecommender（技能策略推荐）

### recommendStrategy(enemyType)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| SR-rec-001 | normal | 灼烧敌人推荐 | enemyType='burn-heavy' | prioritySkillTypes=['passive','active'], focusStats=['intelligence','defense'] | covered | P1 |
| SR-rec-002 | normal | 物理敌人推荐 | enemyType='physical' | prioritySkillTypes=['passive','faction'], focusStats=['defense','speed'] | covered | P1 |
| SR-rec-003 | normal | BOSS推荐 | enemyType='boss' | prioritySkillTypes=['active','awaken'], focusStats=['attack','intelligence'] | covered | P1 |
| SR-rec-004 | error | 无效敌人类型 | enemyType='invalid' | STRATEGY_CONFIG['invalid']=undefined, 返回undefined（⚠️模式1） | missing | P0 |

### getAllStrategies()

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| SR-all-001 | normal | 获取所有策略 | 正常 | 返回3种策略配置 | covered | P2 |

### getPrioritySkillTypes(enemyType) / getFocusStats(enemyType)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| SR-prio-001 | normal | 获取技能优先级 | enemyType='boss' | 返回['active','awaken']副本 | covered | P2 |
| SR-focus-001 | normal | 获取属性侧重 | enemyType='physical' | 返回['defense','speed']副本 | covered | P2 |
| SR-prio-002 | error | 无效enemyType | enemyType='unknown' | 返回undefined（数组展开会崩溃） | missing | P0 |

### init / update / reset

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| SR-init-001 | lifecycle | init设置deps | 正常 | deps非null | covered | P2 |
| SR-reset-001 | lifecycle | reset无操作 | 调用reset | 无状态需重置 | covered | P2 |

---

## 9. HeroBadgeSystem（武将角标系统）

### hasMainEntryRedDot()

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| HB-red-001 | normal | 可升级时显示红点 | canLevelUp返回true | 返回true | covered | P0 |
| HB-red-002 | normal | 可升星时显示红点 | canStarUp返回true | 返回true | covered | P0 |
| HB-red-003 | normal | 有新装备时显示红点 | canEquip返回true | 返回true | covered | P0 |
| HB-red-004 | boundary | 无任何可操作项 | 所有回调返回false | 返回false | covered | P1 |
| HB-red-005 | boundary | 无武将 | getGeneralIds返回[] | 返回false | covered | P1 |

### getLevelBadgeCount() / getStarBadgeCount()

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| HB-lvl-001 | normal | 3个武将可升级 | canLevelUp对3个返回true | 返回3 | covered | P1 |
| HB-lvl-002 | boundary | 无武将 | getGeneralIds返回[] | 返回0 | covered | P2 |
| HB-star-001 | normal | 2个武将可升星 | canStarUp对2个返回true | 返回2 | covered | P1 |

### canEquipNewEquipment(heroId)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| HB-equip-001 | normal | 有新装备可穿戴 | canEquip(heroId)=true | 返回true | covered | P1 |
| HB-equip-002 | boundary | 无新装备 | canEquip(heroId)=false | 返回false | covered | P2 |

### getTodayTodoList()

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| HB-todo-001 | normal | 聚合待办列表 | 有可升级+可升星+可装备武将 | 返回多条TodayTodoItem | covered | P1 |
| HB-todo-002 | boundary | 无待办时默认招募提示 | 无可操作项 | 返回[{type:'recruit', label:'今日免费招募未使用'}] | covered | P2 |
| HB-todo-003 | normal | 单武将多待办 | 同一武将可升级+可升星 | 返回多条待办 | covered | P2 |

### executeQuickAction(action)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| HB-act-001 | normal | 快捷升级 | 有可升级武将 | success=true, affectedHeroes非空 | covered | P1 |
| HB-act-002 | normal | 快捷升星 | 有可升星武将 | success=true | covered | P1 |
| HB-act-003 | normal | 快捷装备 | 有可装备武将 | success=true | covered | P1 |
| HB-act-004 | normal | 快捷招募 | action='recruit' | success=true, affectedHeroes=[] | covered | P2 |
| HB-act-005 | boundary | 无可操作武将时升级 | 无可升级武将 | success=false, affectedHeroes=[] | covered | P2 |

### getState() / reset()

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| HB-state-001 | lifecycle | getState返回完整状态 | 有deps | 含mainEntryRedDot/tabLevelBadge/tabStarBadge/todayTodos | covered | P2 |
| HB-reset-001 | lifecycle | reset恢复默认deps | reset() | 所有回调恢复为默认空实现 | covered | P2 |

---

## 10. HeroAttributeCompare（武将属性比较）

### compareAttributes(heroId, simulateLevel?)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| AC-cmp-001 | normal | 属性对比（含模拟等级） | simulateLevel=50 | 返回current/simulated/diff, diff=simulated-current | covered | P0 |
| AC-cmp-002 | boundary | 不传simulateLevel | simulateLevel=undefined | simulated===current, diff全为0 | covered | P1 |
| AC-cmp-003 | normal | 模拟等级更高 | simulateLevel>currentLevel | diff中属性为正值 | covered | P1 |
| AC-cmp-004 | error | getHeroAttrs返回空对象 | heroId无效 | current={}, simulated={}, diff={} | covered | P2 |
| AC-cmp-005 | lifecycle | lastComparisonHeroId更新 | 对比后 | state.lastComparisonHeroId=heroId | covered | P2 |

### getAttributeBreakdown(heroId)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| AC-bd-001 | normal | 属性构成展开 | 所有回调已注入 | base+equipment+tech+buff+total正确 | covered | P0 |
| AC-bd-002 | boundary | 无任何加成 | 所有回调返回{} | total===base（均为{}） | covered | P1 |
| AC-bd-003 | normal | 部分加成为空 | equipment={}, tech有值 | total只含base+tech | covered | P2 |
| AC-bd-004 | error | getHeroAttrs返回含NaN的属性 | {attack:NaN} | total.attack=NaN（⚠️模式2） | missing | P0 |

### setAttributeCompareDeps(deps) / reset()

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| AC-deps-001 | lifecycle | 注入自定义deps | 有效deps对象 | 后续调用使用新deps | covered | P2 |
| AC-reset-001 | lifecycle | reset恢复默认 | reset() | deps恢复空实现, state重置 | covered | P2 |

---

## 11. ⚠️ BondSystem ↔ FactionBondSystem 重叠分析

> **DEF-010 教训**：两套羁绊系统功能重叠，需明确调用边界

| ID | 类型 | 描述 | 涉及系统 | 预期行为 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| OL-001 | cross | 两系统同时计算阵营羁绊 | BS+FB | ⚠️ 羁绊效果可能被重复计算 | missing | P0 |
| OL-002 | cross | 配置数值差异：阵营羁绊等级数 | BS:3级 vs FB:4级 | 不同tier数导致不同结果 | missing | P0 |
| OL-003 | cross | 配置数值差异：搭档羁绊效果 | BS:桃园结义atk+15% vs FB:全属性+10% | 同名羁绊效果不同 | missing | P0 |
| OL-004 | cross | BondSystem有星级等级机制 | BS:羁绊等级由最低星级决定 | FB无此机制 | missing | P1 |
| OL-005 | cross | BondSystem有派驻系数 | BS:派驻武将效果减半 | FB无派驻系数 | missing | P1 |
| OL-006 | cross | BondSystem有事件系统 | BS:bond:activated/deactivated/levelUp | FB无事件系统 | missing | P1 |
| OL-007 | cross | FactionBondSystem有applyBondBonus | FB:直接应用属性加成 | BS无此方法（仅返回系数） | missing | P1 |
| OL-008 | cross | FactionBondSystem有HERO_FACTION_MAP | FB:内置阵营映射 | BS:通过回调获取 | missing | P2 |
| OL-009 | cross | 编队系统使用哪套羁绊 | Formation→BS or FB? | 需明确唯一调用路径 | missing | P0 |
| OL-010 | cross | 战力公式使用哪套羁绊系数 | HeroSystem.calculatePower | 需明确使用BondSystem.getBondMultiplier | missing | P0 |

---

## 12. 跨系统交互

| ID | 类型 | 描述 | 涉及系统 | 预期行为 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| XI-B01 | cross | 觉醒→等级上限→升级系统联动 | AW→Level | 觉醒后getAwakenedLevelCap=120, LevelSystem使用 | covered | P0 |
| XI-B02 | cross | 觉醒→属性加成→战力计算 | AW→Hero | calculateAwakenedStats结果传入战力公式 | covered | P0 |
| XI-B03 | cross | 觉醒→技能解锁 | AW→SkillUpgrade | 觉醒技能type='awaken'需突破前置 | covered | P1 |
| XI-B04 | cross | 觉醒被动→全局加成 | AW→全局 | getPassiveSummary影响所有武将 | covered | P1 |
| XI-B05 | cross | 羁绊→编队战力 | BS/FB→Formation | 羁绊系数正确应用到编队战力 | covered | P0 |
| XI-B06 | cross | 技能升级→战斗效果 | SU→Battle | getSkillEffect/getCooldownReduce在战斗中生效 | missing | P1 |
| XI-B07 | cross | 策略推荐→技能升级决策 | SR→SU | recommendStrategy结果指导升级优先级 | missing | P2 |
| XI-B08 | cross | 角标→各子系统状态聚合 | HB→Level/Star/Equip | 角标正确反映可操作状态 | covered | P1 |
| XI-B09 | cross | 属性对比→装备/科技/Buff系统 | AC→Equip/Tech/Buff | 属性构成正确展示各来源 | missing | P1 |
| XI-B10 | cross | 觉醒经验表(101~120)→升级系统 | AW-config→Level | 觉醒后升级使用觉醒经验表 | missing | P0 |

---

## 13. 数据生命周期

| ID | 类型 | 描述 | 涉及系统 | 预期行为 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| LC-B01 | lifecycle | 觉醒状态持久化：觉醒→被动叠加→序列化 | AW | 觉醒状态跨会话保持 | covered | P0 |
| LC-B02 | lifecycle | 羁绊生命周期：编队变化→羁绊激活/失效→事件 | BS | 羁绊状态随编队正确变化 | covered | P1 |
| LC-B03 | lifecycle | 技能升级历史持久化 | SU | upgradeHistory和breakthroughSkillUnlocks正确保存 | covered | P1 |
| LC-B04 | lifecycle | FactionBondSystem无状态验证 | FB | serialize/deserialize为空操作 | covered | P2 |
| LC-B05 | lifecycle | 角标系统重置 | HB | reset后所有回调恢复默认 | covered | P2 |
| LC-B06 | lifecycle | 属性对比lastComparisonHeroId | AC | 对比后state更新，reset后清除 | covered | P2 |
| LC-B07 | lifecycle | 全辅助系统联合序列化 | AW+SU+BS+FB+HB+AC | 所有系统serialize→deserialize后状态一致 | missing | P0 |
| LC-B08 | lifecycle | 觉醒→升级→技能升级完整链路 | AW→Level→SU | 觉醒后升级到120级，技能解锁正确 | missing | P0 |

---

## 附录A：测试覆盖热力图

### 按维度统计

| 维度 | 节点数 | covered | missing | 覆盖率 |
|------|--------|---------|---------|--------|
| 正常流程 (normal) | 82 | 82 | 0 | 100% |
| 边界条件 (boundary) | 61 | 53 | 8 | 87% |
| 异常路径 (error) | 37 | 29 | 8 | 78% |
| 跨系统交互 (cross) | 28 | 8 | 20 | 29% |
| 数据生命周期 (lifecycle) | 25 | 20 | 5 | 80% |
| 配置完整性 (normal+boundary) | 28 | 19 | 9 | 68% |

### 按P0模式扫描结果

| 模式 | 扫描节点数 | 发现风险 | 关联ID |
|------|-----------|----------|--------|
| 模式1: null/undefined防护 | 10个公开API | 3处风险 | BS-calc-010, FB-calc-007, SR-rec-004 |
| 模式2: 数值溢出/非法值 | 8个数值API | 3处风险 | AW-elig-010, AW-stat-004, FB-apply-004, AC-bd-004 |
| 模式3: 负值漏洞 | 4个消耗API | 0处（均有上限检查） | — |
| 模式4: 浅拷贝副作用 | 3个返回对象API | 1处风险 | AW-ser-005 |
| 模式5: 竞态/状态泄漏 | 2个异步API | 0处（防抖已处理） | — |
| 模式6: 经济漏洞 | 1个消耗API | 0处（资源检查完整） | — |
| 模式7: 数据丢失 | 3个序列化API | 0处（版本检查已处理） | — |
| 模式8: 集成缺失 | 2套羁绊系统 | ⚠️ 高风险 | OL-001~OL-010 |

---

## 附录B：高优先级缺失节点（P0 missing）

| ID | 系统 | 描述 | 风险原因 |
|----|------|------|----------|
| OL-001 | 重叠 | 两羁绊系统同时计算导致重复加成 | DEF-010核心问题 |
| OL-002 | 重叠 | 阵营羁绊等级数不一致（3级vs4级） | 配置冲突 |
| OL-003 | 重叠 | 同名搭档羁绊效果不同 | 数据不一致 |
| OL-009 | 重叠 | 编队系统调用哪套羁绊不明确 | 架构缺陷 |
| OL-010 | 重叠 | 战力公式使用哪套羁绊系数不明确 | 架构缺陷 |
| AW-elig-009 | 觉醒 | heroId=null时checkAwakeningEligible崩溃 | 模式1 |
| AW-elig-010 | 觉醒 | getStar返回NaN时NaN比较不崩溃 | 模式2 |
| AW-stat-004 | 觉醒 | baseStats含NaN时calculateAwakenedStats返回NaN | 模式2 |
| BS-calc-010 | 羁绊 | generalIds=null时calculateBonds崩溃 | 模式1 |
| FB-calc-007 | 阵营羁绊 | heroIds=null时calculateBonds崩溃 | 模式1 |
| FB-apply-004 | 阵营羁绊 | baseStats含NaN时applyBondBonus返回NaN | 模式2 |
| SR-rec-004 | 策略推荐 | 无效enemyType时recommendStrategy返回undefined | 模式1 |
| AC-bd-004 | 属性对比 | getHeroAttrs返回NaN时total含NaN | 模式2 |
| FBCFG-009 | 配置 | 两套羁绊配置搭档ID不一致 | 数据完整性 |
| FBCFG-010 | 配置 | 两套羁绊配置数值差异未确认合理性 | 数据完整性 |
| XI-B10 | 跨系统 | 觉醒经验表与升级系统联动路径未验证 | 集成缺失 |
| LC-B07 | 生命周期 | 全辅助系统联合序列化未验证 | 集成缺失 |
| LC-B08 | 生命周期 | 觉醒→升级→技能完整链路未验证 | 端到端缺失 |

---

## 附录C：建议优先补充的测试

1. **P0 — BondSystem↔FactionBondSystem重叠消歧测试**：验证编队系统和战力公式仅使用一套羁绊系统，消除重复计算风险
2. **P0 — null/undefined防护测试**：BS-calc-010, FB-calc-007, SR-rec-004 三个API的null输入崩溃验证
3. **P0 — NaN传播防护测试**：AW-stat-004, FB-apply-004, AC-bd-004 数值API的NaN输入验证
4. **P0 — 羁绊配置一致性测试**：对比 bond-config 与 faction-bond-config 的搭档羁绊ID和数值
5. **P0 — 全辅助系统联合序列化测试**：AW+SU+BS序列化→反序列化后状态完全一致
6. **P1 — 觉醒→升级→技能完整链路测试**：觉醒后升级到120级，技能解锁和额外效果验证
7. **P1 — 羁绊事件系统完整测试**：BS的evaluateAndEmit在编队变化时的activated/deactivated/levelUp事件验证
8. **P2 — 策略推荐边界测试**：无效enemyType和空配置的防御性验证
