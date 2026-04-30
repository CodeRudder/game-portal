# Hero模块挑战清单 — Round 1

> 生成时间: 2025-01-XX
> 挑战者: TreeChallenger (Architect Agent)
> 范围: `src/games/three-kingdoms/engine/hero/` 全部源码 + `__tests__/` 全部测试

---

## 统计

| 指标 | 数值 |
|------|------|
| 源码文件数（非test/config/types） | 16 |
| 测试文件数 | 39 |
| 测试用例总数 | ~1289 |
| System 公开 API 总数 | ~175 |
| 已测试 API 数（估算） | ~130 |
| 未测试 API 数（估算） | ~45 |
| API 覆盖率 | **~74%** |

### 各 System API 覆盖概览

| System | 公开 API 数 | 已测试 | 覆盖率 | 测试文件 |
|--------|------------|--------|--------|----------|
| HeroSystem | 32 | 28 | 87% | HeroSystem.test.ts, hero-system-advanced.test.ts, hero-fragment-synthesize.test.ts, power-formula-*.test.ts |
| HeroLevelSystem | 22 | 20 | 91% | HeroLevelSystem.test.ts, hero-level-enhance.test.ts, hero-level-boundary.test.ts, hero-level-cap-linkage.test.ts, batchUpgrade.test.ts |
| HeroStarSystem | 22 | 18 | 82% | HeroStarSystem.test.ts, HeroStarSystem.breakthrough.test.ts |
| HeroRecruitSystem | 24 | 22 | 92% | HeroRecruitSystem.test.ts, HeroRecruitSystem.edge.test.ts, hero-recruit-*.test.ts |
| AwakeningSystem | 16 | 14 | 88% | awakening-system.test.ts |
| BondSystem | 10 | 8 | 80% | BondSystem.test.ts |
| FactionBondSystem | 9 | 9 | 100% | faction-bond-system.test.ts |
| HeroFormation | 18 | 16 | 89% | HeroFormation.test.ts, HeroFormation.autoFormation.test.ts |
| HeroDispatchSystem | 11 | 11 | 100% | HeroDispatchSystem.test.ts, HeroDispatchSystem.attack-bonus.test.ts |
| HeroBadgeSystem | 8 | 8 | 100% | HeroBadgeSystem.test.ts |
| HeroAttributeCompare | 4 | 4 | 100% | HeroAttributeCompare.test.ts |
| SkillUpgradeSystem | 14 | 12 | 86% | SkillUpgradeSystem.upgrade.test.ts, SkillUpgradeSystem.breakthrough.test.ts |
| SkillStrategyRecommender | 4 | 3 | 75% | (通过 SkillUpgradeSystem 测试间接覆盖) |
| FormationRecommendSystem | 3 | 3 | 100% | FormationRecommendSystem.test.ts |
| HeroRecruitExecutor | 1 | 1 | 100% | HeroRecruitExecutor.edge.test.ts |
| HeroRecruitUpManager | 7 | 6 | 86% | hero-recruit-up.test.ts |
| RecruitTokenEconomySystem | 18 | 18 | 100% | recruit-token-economy-system.test.ts |
| HeroSerializer | 5 | 5 | 100% | HeroSerializer.test.ts, HeroSerializer.edge.test.ts |

---

## F-Normal 遗漏（公开API完全没有测试）

| # | System | API | 说明 |
|---|--------|-----|------|
| 1 | HeroSystem | `getExpRequired(level)` | 查表获取升级所需经验，无直接测试 |
| 2 | HeroSystem | `getGoldRequired(level)` | 查表获取升级所需铜钱，无直接测试 |
| 3 | HeroSystem | `getGeneralsByQuality(quality)` | 按品质筛选武将，无测试 |
| 4 | HeroSystem | `getGeneralsSortedByPower(descending)` | 按战力排序获取武将列表，无测试 |
| 5 | HeroSystem | `getSynthesizeProgress(generalId)` | 获取碎片合成进度，无测试 |
| 6 | HeroSystem | `getGeneralDef(generalId)` | 根据ID获取武将定义，无直接测试 |
| 7 | HeroStarSystem | `addFragmentFromActivity(heroId, source, amount)` | 活动获取碎片途径，无测试 |
| 8 | HeroStarSystem | `addFragmentFromExpedition(heroId, amount)` | 远征获取碎片途径，无测试 |
| 9 | AwakeningSystem | `getAwakeningExpRequired(level)` | 觉醒后升级经验查询，无测试 |
| 10 | AwakeningSystem | `getAwakeningGoldRequired(level)` | 觉醒后升级铜钱查询，无测试 |
| 11 | AwakeningSystem | `getAwakeningSkillPreview(heroId)` | 觉醒技能预览（不要求已觉醒），无测试 |
| 12 | AwakeningSystem | `getAwakeningStatDiff(heroId)` | 觉醒属性加成差值，无测试 |
| 13 | SkillUpgradeSystem | `getSkillLevel(generalId, skillIndex)` | 获取技能等级，无直接独立测试 |
| 14 | SkillStrategyRecommender | `getAllStrategies()` | 获取所有策略配置，无测试 |
| 15 | SkillStrategyRecommender | `getPrioritySkillTypes(enemyType)` | 获取推荐技能类型优先级，无测试 |
| 16 | SkillStrategyRecommender | `getFocusStats(enemyType)` | 获取推荐属性侧重，无测试 |
| 17 | HeroRecruitUpManager | `getUpGeneralId()` | 获取UP武将ID，无直接测试 |
| 18 | HeroRecruitUpManager | `getUpRate()` | 获取UP触发概率，无直接测试 |
| 19 | HeroRecruitUpManager | `setUpRate(rate)` | 设置UP触发概率，无直接测试 |

---

## F-Boundary 遗漏（缺少边界条件测试）

| # | System | API | 边界条件 | 说明 |
|---|--------|-----|----------|------|
| 1 | HeroSystem | `addFragment(generalId, count)` | count = 0, count = -1, count = 999999 | 负数和极大值的溢出行为未测试 |
| 2 | HeroSystem | `addFragment` + `FRAGMENT_CAP` | 碎片恰好到 999, 碎片从 998 加 2 | 边界值 999 的精确溢出测试缺失 |
| 3 | HeroSystem | `useFragments(generalId, count)` | count = 0, count 恰好等于持有量 | 零消耗和恰好消耗的边界未测试 |
| 4 | HeroSystem | `calculatePower(general)` | 全零属性武将 | attack/defense/intelligence/speed 全为 0 |
| 5 | HeroSystem | `calculatePower(general, star)` | star = 0, star = -1, star = 7 | 超范围星级的 fallback 行为 |
| 6 | HeroSystem | `fragmentSynthesize(generalId)` | 碎片恰好等于所需数量 | 精确边界：合成后碎片变为 0 |
| 7 | HeroLevelSystem | `addExp(generalId, amount)` | amount = Number.MAX_SAFE_INTEGER | 极大经验值一次性输入 |
| 8 | HeroLevelSystem | `quickEnhance(generalId, targetLevel)` | targetLevel = 1（低于当前等级） | 已有测试但缺少 targetLevel = 0 和负数 |
| 9 | HeroLevelSystem | `calculateMaxAffordableLevel` | 资源恰好够升1级 | 精确资源边界的升级判断 |
| 10 | HeroStarSystem | `starUp(generalId)` | 碎片恰好等于消耗数量 | 精确碎片消耗边界 |
| 11 | HeroStarSystem | `breakthrough(generalId)` | 等级恰好等于上限（level === levelCap） | 精确等级匹配边界 |
| 12 | HeroStarSystem | `exchangeFragmentsFromShop` | count 恰好等于 dailyLimit | 商店限购精确边界 |
| 13 | HeroRecruitSystem | `freeRecruitSingle` | 免费次数恰好用完 | 最后一次免费招募后的状态 |
| 14 | AwakeningSystem | `awaken(heroId)` | 资源恰好满足（不多不少） | 精确资源边界觉醒 |
| 15 | BondSystem | `getBondMultiplier(generalIds)` | 空数组 `[]` | 已有部分覆盖但缺少 NaN 输入防护测试 |
| 16 | BondSystem | `getBondMultiplier` | 羁绊系数恰好达到上限 2.0 | 精确上限触发 |
| 17 | HeroFormation | `renameFormation(id, name)` | name 超过 10 字符 | 截断行为的精确验证 |
| 18 | HeroFormation | `addToFormation` | 编队恰好有 1 个空位 | 最后一个空位的填充 |
| 19 | FormationRecommendSystem | `recommend` | availableHeroes 为空数组 | 已有覆盖但缺少单武将场景 |
| 20 | RecruitTokenEconomySystem | `tick(deltaSeconds)` | deltaSeconds = 0, 负数 | 零和负数时间增量 |
| 21 | HeroDispatchSystem | `dispatchHero` | 同一武将重复派驻到同一建筑 | 幂等性边界 |
| 22 | SkillUpgradeSystem | `upgradeSkill` | materials 中 gold=0, skillBooks=0 | 零材料输入 |

---

## F-Error 遗漏（缺少异常路径测试）

| # | System | API | 异常路径 | 说明 |
|---|--------|-----|----------|------|
| 1 | HeroSystem | `addGeneral(generalId)` | generalId 对应的武将定义不存在 | 已有返回 null 测试，但缺少对 GENERAL_DEF_MAP 为空 map 的防护 |
| 2 | HeroSystem | `setLevelAndExp(generalId, level, exp)` | level 为负数或 NaN | 无效等级值的防护 |
| 3 | HeroSystem | `updateSkillLevel(generalId, skillIndex, newLevel)` | newLevel 为负数 | 无效技能等级 |
| 4 | HeroSystem | `deserialize(data)` | data 为 null / undefined / 格式错误 | 反序列化异常输入 |
| 5 | HeroLevelSystem | `addExp(generalId, amount)` | spendResource 成功但 canAfford 返回不一致 | 资源系统状态不一致场景 |
| 6 | HeroLevelSystem | `quickEnhance(generalId)` | spendResource(gold) 成功但 spendResource(exp) 夅败 | 部分资源扣除成功后回滚缺失 |
| 7 | HeroStarSystem | `breakthrough(generalId)` | useFragments 成功但 spendResource 失败 | 部分消耗后不一致状态 |
| 8 | HeroStarSystem | `starUp(generalId)` | deps 未设置（setDeps 未调用） | 已有部分覆盖但缺少完整错误返回验证 |
| 9 | AwakeningSystem | `awaken(heroId)` | deps 未设置时调用 | "资源系统未初始化" 路径 |
| 10 | AwakeningSystem | `awaken(heroId)` | 部分资源充足部分不足 | 混合资源不足场景 |
| 11 | AwakeningSystem | `checkAwakeningEligible(heroId)` | heroId 不存在于 GENERAL_DEF_MAP | 未定义武将的资格检查 |
| 12 | BondSystem | `calculateBonds(generalIds)` | bondDeps 未设置（initBondDeps 未调用） | 返回空数组但不报错，需验证 |
| 13 | BondSystem | `evaluateAndEmit(generalIds)` | deps.eventBus 为 null | 事件总线未注入时的行为 |
| 14 | HeroRecruitSystem | `deserialize(data)` | data.history 不是数组 | 历史记录字段格式错误 |
| 15 | HeroRecruitSystem | `freeRecruitSingle` | recruitDeps 未设置 | 依赖未注入时的错误处理 |
| 16 | HeroFormation | `deserialize(data)` | data 为 null / data.state 为 null | 反序列化异常输入 |
| 17 | HeroDispatchSystem | `deserialize(json)` | 非法 JSON 字符串 | 已有覆盖但缺少特殊字符 JSON |
| 18 | SkillUpgradeSystem | `upgradeSkill` | spendResource('gold') 成功但 spendResource('skillBook') 失败 | 部分资源扣除的原子性问题 |
| 19 | RecruitTokenEconomySystem | `deserialize(data)` | data.version 不匹配 | 版本兼容性处理 |
| 20 | HeroSerializer | `deserializeHeroState(data)` | data.state.generals 包含非法武将数据 | 损坏的存档数据 |

---

## F-Cross 遗漏（跨系统交互没有被测试覆盖）

| # | 交互链 | 说明 |
|---|--------|------|
| 1 | HeroStarSystem.breakthrough → SkillUpgradeSystem.unlockSkillOnBreakthrough | 突破成功后技能解锁回调的端到端测试。源码中有 `skillUnlockCallback` 注入机制，但缺少完整的集成测试验证回调被正确调用且技能状态更新 |
| 2 | HeroLevelSystem ↔ AwakeningSystem 等级上限联动 | 觉醒后等级上限变为 120，HeroLevelSystem 的 getLevelCap 回调应动态反映。hero-level-cap-linkage.test.ts 有部分覆盖但缺少觉醒后升级到 101~120 级的完整流程 |
| 3 | HeroSystem.calculateFormationPower ↔ BondSystem.getBondMultiplier | 编队战力计算含羁绊系数的端到端验证。power-formula-bond-equip.test.ts 有覆盖但缺少多羁绊叠加场景 |
| 4 | HeroRecruitSystem → HeroSystem.addGeneral/handleDuplicate | 招募获得重复武将时碎片溢出→铜钱转化的完整链路。源码中有 `addResource('gold', overflow * FRAGMENT_TO_GOLD_RATE)` 但缺少此路径的测试 |
| 5 | HeroDispatchSystem → HeroSystem.getGeneral（武将升级后刷新） | 武将升级后派驻加成应自动更新。refreshDispatchBonus 有测试但缺少与 HeroLevelSystem.addExp 的联动集成测试 |
| 6 | HeroFormation + BondSystem + HeroSystem（编队→羁绊→战力） | 完整的"编队选择→羁绊激活→战力计算"链路。integration/ 下有部分覆盖但缺少羁绊变化触发事件的端到端验证 |
| 7 | AwakeningSystem → HeroStarSystem（觉醒条件检查） | 觉醒需要检查星级和突破阶段，但缺少 "突破后降星" 等反向操作的联动测试 |
| 8 | HeroRecruitSystem → RecruitTokenEconomySystem（招贤令消耗） | 招募消耗招贤令的经济闭环。两个系统独立测试但缺少联合测试 |
| 9 | HeroSystem.fragmentSynthesize → HeroSystem.addGeneral | 碎片合成武将的完整流程：碎片积累→达到阈值→合成→武将添加。hero-fragment-synthesize.test.ts 有覆盖但缺少与 HeroStarSystem 碎片消耗的冲突场景 |
| 10 | FactionBondSystem ↔ BondSystem | 两套羁绊系统的计算结果一致性。FactionBondSystem 和 BondSystem 有独立的羁绊计算逻辑，缺少交叉验证 |
| 11 | HeroLevelSystem.batchUpgrade → HeroFormation（编队中武将批量升级） | 批量升级时是否考虑编队约束（如编队中武将优先升级） |
| 12 | FormationRecommendSystem → HeroFormation（推荐→自动编队） | 推荐方案直接应用到编队的端到端流程 |

---

## F-Lifecycle 遗漏（数据生命周期阶段没有被测试）

| # | 阶段 | System | 说明 |
|---|------|--------|------|
| 1 | **创建→使用→删除** | HeroSystem | `addGeneral → removeGeneral` 完整生命周期。removeGeneral 有基本测试但缺少 "删除后碎片是否保留" 的验证 |
| 2 | **碎片积累→合成→武将获得→升级→升星→突破→觉醒** | 全链路 | 武将完整成长线的端到端生命周期测试。现有测试都是单系统切片，缺少从碎片到觉醒的完整流程 |
| 3 | **序列化→反序列化→操作→再序列化** | HeroStarSystem | 存档恢复后操作的正确性。HeroStarSystem 有 round-trip 测试但缺少 "恢复后突破→再存档" 的完整链路 |
| 4 | **免费招募→日重置→再次免费招募** | HeroRecruitSystem | 每日免费招募的跨日生命周期。checkDailyReset 在 update 中调用但缺少模拟跨日的测试 |
| 5 | **编队创建→添加武将→切换活跃→删除编队→自动切换** | HeroFormation | 编队完整生命周期。deleteFormation 有测试但缺少 "删除当前活跃编队后自动切换" 的验证（源码有此逻辑） |
| 6 | **派驻→武将升级→加成刷新→取消派驻→重新派驻** | HeroDispatchSystem | 派驻关系随武将成长的变化生命周期 |
| 7 | **觉醒→升级到120→序列化→反序列化→继续升级** | AwakeningSystem | 觉醒后的长期游戏生命周期 |
| 8 | **保底计数→序列化→反序列化→继续招募→保底触发** | HeroRecruitSystem | 保底计数器的持久化生命周期。hero-recruit-pity.test.ts 有部分覆盖 |
| 9 | **商店购买→日重置→再购买→序列化→恢复→购买** | RecruitTokenEconomySystem | 商店限购的跨日+持久化生命周期 |
| 10 | **羁绊激活→事件触发→羁绊失效→事件触发** | BondSystem | 羁绊状态变化的完整事件生命周期。evaluateAndEmit 有测试但缺少 "激活→失效→再激活" 的循环场景 |
| 11 | **UP武将设置→招募→切换UP→招募→清除UP** | HeroRecruitUpManager | UP武将配置的完整变更生命周期 |
| 12 | **技能升级→突破解锁→额外效果→继续升级** | SkillUpgradeSystem | 技能从低级到高级的完整成长路径，含突破解锁的中间阶段 |

---

## 优先级建议

### P0 — 必须立即补充（影响核心玩法正确性）

1. **HeroStarSystem.addFragmentFromActivity / addFragmentFromExpedition** — 两个碎片获取途径完全没有测试，是核心经济循环
2. **HeroLevelSystem.quickEnhance 部分资源扣除的原子性** — spendResource(gold) 成功后 spendResource(exp) 失败，可能导致资源丢失
3. **HeroStarSystem.starUp / breakthrough 部分消耗不一致** — 碎片已扣除但铜钱扣除失败的场景
4. **SkillUpgradeSystem.upgradeSkill 部分资源扣除** — gold 扣除成功但 skillBook 扣除失败
5. **HeroRecruitSystem 重复武将碎片溢出→铜钱转化** — `addResource('gold', overflow * FRAGMENT_TO_GOLD_RATE)` 路径无测试

### P1 — 应尽快补充（影响数据一致性）

6. **HeroSystem 反序列化异常输入防护** — null/undefined/格式错误数据
7. **HeroFormation 删除活跃编队后自动切换** — 核心编队管理逻辑
8. **BondSystem.evaluateAndEmit 事件总线未注入** — 依赖缺失时的行为
9. **觉醒后 101~120 级完整升级流程** — 觉醒系统的核心价值路径
10. **突破→技能解锁回调端到端测试** — HeroStarSystem ↔ SkillUpgradeSystem 联动

### P2 — 建议补充（提升测试覆盖率）

11. 其余 F-Normal 遗漏项（查询类 API）
12. F-Boundary 中的精确边界值测试
13. F-Lifecycle 中的完整成长线测试
14. F-Cross 中的 FactionBondSystem ↔ BondSystem 一致性验证

---

## 附录：测试文件清单

| 文件 | 用例数 | 覆盖 System |
|------|--------|-------------|
| HeroSystem.test.ts | 50 | HeroSystem |
| hero-system-advanced.test.ts | 21 | HeroSystem |
| hero-fragment-synthesize.test.ts | 22 | HeroSystem |
| power-formula-bond-equip.test.ts | ~15 | HeroSystem + BondSystem |
| power-formula-boundary.test.ts | 20 | HeroSystem |
| HeroLevelSystem.test.ts | ~45 | HeroLevelSystem |
| hero-level-enhance.test.ts | ~25 | HeroLevelSystem |
| hero-level-boundary.test.ts | 22 | HeroLevelSystem |
| hero-level-cap-linkage.test.ts | 49 | HeroLevelSystem + HeroStarSystem + AwakeningSystem |
| batchUpgrade.test.ts | 8 | HeroLevelSystem |
| HeroLevelSystem.edge.test.ts | ~10 | HeroLevelSystem |
| HeroStarSystem.test.ts | ~40 | HeroStarSystem |
| HeroStarSystem.breakthrough.test.ts | 32 | HeroStarSystem |
| HeroRecruitSystem.test.ts | ~30 | HeroRecruitSystem |
| HeroRecruitSystem.edge.test.ts | ~15 | HeroRecruitSystem |
| hero-recruit-boundary.test.ts | ~25 | HeroRecruitSystem |
| hero-recruit-pity.test.ts | ~20 | HeroRecruitSystem |
| hero-recruit-up.test.ts | ~25 | HeroRecruitSystem + HeroRecruitUpManager |
| hero-recruit-history.test.ts | 14 | HeroRecruitSystem |
| HeroRecruitExecutor.edge.test.ts | ~25 | HeroRecruitExecutor |
| awakening-system.test.ts | 73 | AwakeningSystem |
| BondSystem.test.ts | 30 | BondSystem |
| faction-bond-system.test.ts | ~70 | FactionBondSystem |
| HeroFormation.test.ts | 47 | HeroFormation |
| HeroFormation.autoFormation.test.ts | 9 | HeroFormation |
| HeroDispatchSystem.test.ts | ~25 | HeroDispatchSystem |
| HeroDispatchSystem.attack-bonus.test.ts | 27 | HeroDispatchSystem |
| HeroBadgeSystem.test.ts | 30 | HeroBadgeSystem |
| HeroAttributeCompare.test.ts | ~25 | HeroAttributeCompare |
| SkillUpgradeSystem.upgrade.test.ts | ~25 | SkillUpgradeSystem |
| SkillUpgradeSystem.breakthrough.test.ts | ~25 | SkillUpgradeSystem |
| FormationRecommendSystem.test.ts | 35 | FormationRecommendSystem |
| recruit-token-economy-system.test.ts | ~60 | RecruitTokenEconomySystem |
| HeroSerializer.test.ts | ~15 | HeroSerializer |
| HeroSerializer.edge.test.ts | ~15 | HeroSerializer |
| integration/dispatch-formation-combat.integration.test.ts | - | 跨系统 |
| integration/equipment-enhance.integration.test.ts | - | 跨系统 |
| integration/equipment-smelt.integration.test.ts | ~35 | 跨系统 |
| integration/hero-batch-upgrade.integration.test.ts | - | 跨系统 |
