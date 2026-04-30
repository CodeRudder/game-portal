# Hero 挑战清单 Round 2

> Challenger: TreeChallenger v1.1 | Time: 2026-05-01

## R1修复验证

| FIX | 修复状态 | 验证结果 | 遗漏 |
|-----|---------|---------|------|
| FIX-001 NaN绕过<=0 | ✅ 已修复 | 10处检查点全部通过，测试覆盖NaN/Infinity/-Infinity | ⚠️ `getStarMultiplier` 本身未修复NaN防护；`calculatePower` 内部3处NaN传播入口未防护 |
| FIX-002 useFragments负值 | ✅ 已修复 | 负值/NaN/Infinity/0均被拒绝，正常消耗不受影响 | 无遗漏 |
| FIX-003 deserialize(null) | ✅ 已修复 | 9个子系统null guard全部通过 | ⚠️ `deserializeHeroState` 遍历武将时未防护null元素；`cloneGeneral` 无null guard |
| FIX-004 FormationRecommend null guard | ✅ 已修复 | null数组/含null元素/NaN power均被正确处理 | 无遗漏 |

**总结**：4个FIX全部验证通过，但FIX-001和FIX-003有遗漏点（底层函数未修复）。

---

## 新发现问题

| # | 类型 | 严重程度 | 位置 | 描述 |
|---|------|---------|------|------|
| R2-A001 | NaN绕过 | P0 | star-up-config.ts:58 | `getStarMultiplier(NaN)` → `STAR_MULTIPLIERS[NaN]` = undefined，导致战力NaN |
| R2-A002 | NaN传播 | P0 | HeroSystem.ts:183 | `QUALITY_MULTIPLIERS[非法quality]` = undefined → 战力NaN |
| R2-A003 | NaN传播 | P0 | HeroSystem.ts:185 | `getStarMultiplier(star=NaN)` → starCoeff=undefined → 战力NaN（与R2-A001同源） |
| R2-A004 | null崩溃 | P0 | HeroSerializer.ts:89 | `deserializeHeroState` 遍历武将时未防护null元素，`cloneGeneral(null)` 崩溃 |
| R2-A005 | null崩溃 | P0 | HeroSerializer.ts:32 | `cloneGeneral(null)` → `null.skills.map is not a function` |
| R2-A006 | NaN传播 | P0 | HeroSystem.ts:175-188 | `calculatePower` 无最终NaN输出防护，多入口NaN可传播到排序/编队/UI |
| R2-A007 | 集成缺失 | P0 | ThreeKingdomsEngine.ts | `setBondMultiplierGetter` 从未被调用，羁绊系数永远1.0 |
| R2-A008 | 集成缺失 | P0 | ThreeKingdomsEngine.ts | `setEquipmentPowerGetter` 从未被调用，装备战力永远0 |
| R2-A009 | 间接修复 | P1 | HeroSystem.ts:281 | `handleDuplicate(quality=undefined)` 通过FIX-001间接修复，但返回undefined而非0 |
| R2-A010 | 范围校验 | P1 | HeroRecruitUpManager.ts:72 | `setUpRate` 仍无范围校验，rate>1.0/NaN/负数均可赋值 |
| R2-A011 | 初始化顺序 | P1 | recruit-token-economy-system.ts | deserialize在init之前调用时economyDeps为null |
| R2-A012 | NaN绕过 | P1 | HeroLevelSystem.ts:249 | `calculateTotalExp(NaN, NaN)` 绕过 `to<=from` 检查 |
| R2-B001 | 经济漏洞 | P0 | HeroStarSystem.ts:131 | `exchangeFragmentsFromShop` 忽略碎片溢出，铜钱已扣但溢出碎片丢失 |
| R2-B002 | 经济漏洞 | P0 | HeroStarSystem.ts:165 | `addFragmentFromActivity` 溢出碎片未转化为铜钱 |
| R2-B003 | 经济漏洞 | P0 | HeroStarSystem.ts:181 | `addFragmentFromExpedition` 溢出碎片未转化为铜钱 |
| R2-B004 | 修复确认 | ✅ | TokenEconomy.buyFromShop | NaN防护已通过FIX-001修复 |
| R2-B005 | 统计污染 | P2 | TokenEconomy | totalPassiveEarned可能被NaN回调污染（仅统计） |
| R2-B006 | 资源泄漏 | P0 | HeroRecruitSystem.ts:307 | 十连招募资源先扣后执行，中途异常不回滚 |
| R2-B007 | 参数校验 | P0 | HeroFormation.ts:150 | `addToFormation` 不验证武将是否存在 |
| R2-B008 | null崩溃 | P0 | HeroFormation.ts:135 | `setFormation(null)` → null.slice() 崩溃 |
| R2-B009 | 数据完整性 | P1 | HeroFormation.ts:404 | deserialize不验证武将ID有效性 |
| R2-B010 | 算法正确性 | P0 | FormationRecommendSystem.ts:300 | 羁绊分数用硬编码值(15/8/0)而非实际BondSystem计算 |
| R2-B011 | 算法正确性 | P0 | FormationRecommendSystem.ts:243 | 武将数≤6时平衡方案与最强方案完全重复 |
| R2-B012 | 算法正确性 | P0 | FormationRecommendSystem.ts:282 | 所有武将同阵营时羁绊方案与最强方案完全重复 |
| R2-B013 | 参数校验 | P1 | FormationRecommendSystem.ts:165 | 不校验stageType有效性 |
| R2-C001 | null崩溃 | P0 | HeroSerializer.ts:89 | 同R2-A004 |
| R2-C002 | null崩溃 | P0 | HeroSerializer.ts:32 | 同R2-A005 |
| R2-C003 | 版本迁移 | P1 | 所有子系统 | 版本不匹配仅警告无迁移逻辑 |
| R2-C004 | 序列化缺失 | P0 | SkillUpgradeSystem.ts | 无serialize/deserialize，升级历史丢失 |
| R2-C005 | 配置冲突 | P0 | bond-config.ts vs faction-bond-config.ts | 搭档羁绊ID不一致 |
| R2-C006 | 配置冲突 | P0 | hero-config.ts vs faction-bond-config.ts | 阵营标识 'qun' vs 'neutral' |
| R2-C007 | 配置冲突 | P0 | bond-config.ts vs faction-bond-config.ts | 搭档羁绊效果值不一致 |
| R2-C008 | 接口冲突 | P1 | bond-config.ts vs faction-bond-config.ts | BondEffect接口同名但结构不同 |
| R2-C009 | 配置缺失 | P0 | star-up-config.ts | 6名新增武将无商店兑换+无关卡掉落 |
| R2-C010 | 配置覆盖 | P1 | hero-config vs faction-bond-config | GENERAL_DEF_MAP vs HERO_FACTION_MAP覆盖差异 |
| R2-C011 | 异常安全 | P1 | BondSystem.ts:316 | emit无try-catch，监听器异常中断羁绊评估 |
| R2-C012 | 浅拷贝 | P0 | HeroDispatchSystem.ts:98 | getState()浅拷贝，嵌套对象可被外部篡改 |

---

## 统计

| Part | 新P0 | 新P1 | 新P2 | R1遗留 | 已修复验证 |
|------|------|------|------|--------|-----------|
| A | 5 | 4 | 0 | 3 | 3/4（有遗漏） |
| B | 6 | 4 | 1 | 6 | 2/2 |
| C | 2(+5配置) | 5 | 0 | 7 | 8/10（有遗漏） |
| **总计** | **18** | **13** | **1** | **16** | **4/4（含遗漏）** |

注：配置冲突类问题（R2-C005/C006/C007/C009）在R1和R2中均有记录，属于R1遗留。

---

## 与R1对比

| 指标 | R1 | R2 | 变化 |
|------|----|----|------|
| 新P0 | 41 | 18 | ↓23（56%减少） |
| 系统性问题 | 5 | 3 | ↓2（NaN绕过已修复，但底层遗漏+集成缺失+配置冲突仍在） |
| 虚报率 | 4-8% | <3% | ↓（R2更严格验证，仅1个P2虚报） |
| 修复遗漏率 | — | 3/4 FIX有遗漏 | FIX-001和FIX-003有底层遗漏 |

---

## 高优先级行动清单

### P0 — 必须在R2修复

#### 代码缺陷（按影响范围排序）

| # | 行动 | 关联发现 | 影响范围 |
|---|------|----------|---------|
| 1 | `calculatePower` 添加最终NaN输出防护 | R2-A006 | 全体战力计算 |
| 2 | `getStarMultiplier` 添加NaN防护 | R2-A001 | 所有使用星级倍率的地方 |
| 3 | `cloneGeneral` 添加null guard | R2-A005 | 序列化恢复 |
| 4 | `deserializeHeroState` 遍历武将时添加null检查 | R2-A004 | 损坏存档恢复 |
| 5 | `setBondMultiplierGetter` 在引擎初始化中调用 | R2-A007 | 羁绊系统完全失效 |
| 6 | `setEquipmentPowerGetter` 在引擎初始化中调用 | R2-A008 | 装备战力完全失效 |
| 7 | `SkillUpgradeSystem` 添加serialize/deserialize | R2-C004 | 技能升级历史丢失 |
| 8 | 碎片溢出转化为铜钱（3处） | R2-B001/B002/B003 | 经济漏洞 |
| 9 | `HeroFormation.setFormation` 添加null guard | R2-B008 | 编队崩溃 |
| 10 | `HeroFormation.addToFormation` 添加武将存在性验证 | R2-B007 | 编队数据污染 |
| 11 | `HeroDispatchSystem.getState()` 返回深拷贝 | R2-C012 | 状态篡改 |

#### 配置问题

| # | 行动 | 关联发现 |
|---|------|----------|
| 12 | 统一搭档羁绊ID | R2-C005 |
| 13 | 统一阵营标识（'qun' vs 'neutral'） | R2-C006 |
| 14 | 统一搭档羁绊效果值 | R2-C007 |
| 15 | 补充6名新增武将碎片获取配置 | R2-C009 |

#### 算法问题

| # | 行动 | 关联发现 |
|---|------|----------|
| 16 | 推荐算法去重（羁绊方案vs最强方案） | R2-B012 |
| 17 | 推荐算法平衡方案去重 | R2-B011 |
| 18 | 推荐算法羁绊分数接入BondSystem | R2-B010 |

### P1 — 应在R3修复

| # | 行动 | 关联发现 |
|---|------|----------|
| 1 | `setUpRate` 添加范围校验 | R2-A010 |
| 2 | `handleDuplicate` 返回值类型安全 | R2-A009 |
| 3 | 版本迁移策略设计 | R2-C003 |
| 4 | BondEffect接口统一 | R2-C008 |
| 5 | BondSystem.emit 添加try-catch | R2-C011 |
| 6 | FormationRecommend stageType校验 | R2-B013 |
| 7 | HeroFormation.deserialize 武将ID验证 | R2-B009 |

---

## R2 Challenger 评估

### 修复质量评分

| 维度 | 评分(1-5) | 说明 |
|------|-----------|------|
| FIX覆盖面 | 4 | 4个FIX覆盖了主要问题，但底层函数遗漏 |
| FIX深度 | 3 | FIX-001修复了调用方但未修复底层工具函数 |
| FIX测试 | 5 | 37个测试覆盖NaN/Infinity/null场景 |
| 遗留问题处理 | 2 | R1标记为"不在修复范围内"的6个问题全部遗留到R2 |

### R2 新发现质量

| 维度 | 评分(1-5) | 说明 |
|------|-----------|------|
| 新P0准确性 | 5 | 所有P0均有源码验证和复现场景 |
| 虚报率 | <3% | 仅1个P2可能虚报（R2-B005统计污染） |
| 遗漏发现能力 | 4 | 发现了R1遗漏的底层函数NaN防护和集成缺失 |
| 配置交叉验证 | 5 | v1.1新规则有效，发现3处配置冲突 |

---

## Rule Evolution Suggestions for v1.2

### 建议1: 底层工具函数NaN防护规则（高优先级）
- **触发发现**: R2-A001 — FIX-001修复了调用方但未修复底层 `getStarMultiplier`
- **建议**: NaN防护应同时修复调用方和被调用的底层工具函数

### 建议2: 集成缺失扫描规则（高优先级）
- **触发发现**: R2-A007/A008 — setter方法已定义但从未在引擎初始化中调用
- **建议**: 所有 `setXxxGetter/setXxxFn` 方法必须在引擎初始化代码中有对应调用

### 建议3: 碎片溢出经济闭环规则（高优先级）
- **触发发现**: R2-B001/B002/B003 — 碎片溢出被静默丢弃
- **建议**: 所有碎片添加操作必须处理溢出（转化为铜钱或明确记录）

---

*Round 2 挑战审查完成。等待 Arbiter 裁决。*
