# Hero模块挑战清单 — Round 2

> 生成时间: 2025-01-XX
> 挑战者: TreeChallenger (Architect Agent)
> 审查对象: round-2-tree.md（120个新增节点）
> 对照依据: round-1-challenges.md, round-1-verdict.md, 源码审查

---

## 总体评价

| 指标 | R1现状 | R2声称 | 挑战者评估 | 差距说明 |
|------|--------|--------|-----------|----------|
| 总节点数 | 307 | 427 | 427 ✅ | 节点数量达标 |
| 跨系统覆盖率 | 46% | 70% | **~62%** | R2新增36节点但仍有18个关键链路遗漏 |
| 生命周期覆盖率 | 38% | 74% | **~65%** | 存档迁移和版本升级场景不足 |
| 原子性节点 | 0 | 18 | 18 ✅ | 数量达标但遗漏3个关键场景 |
| 碎片获取路径 | 0 | 20 | 16 ⚠️ | 遗漏第7种途径和关键业务缺陷 |
| 溢出转化 | 0 | 12 | 8 ⚠️ | 遗漏Executor路径的溢出差异 |

**R2改进认可**：原子性缺陷的系统性枚举（A1-A4）、碎片溢出→铜钱转化的精确值验证（C1-C2）、跨日重置三系统联动（XI-053）都是高质量的补充。

**核心问题**：R2在"已知遗漏的补全"上做得好，但在"源码审查发现的新问题"上仍有盲区。以下是5个维度的详细遗漏。

---

## F-Normal 遗漏：R1 API补全与新增盲区

### N1. R1遗漏API仍未全部覆盖

R1挑战清单列出19个未测试API，R2仅补充了 `addFragmentFromActivity` 和 `addFragmentFromExpedition` 两个。以下API在R2流程树中 **完全未出现**：

| # | System | API | R1编号 | 说明 |
|---|--------|-----|--------|------|
| 1 | HeroSystem | `getExpRequired(level)` | F-Normal #1 | 查表函数，被 `HeroLevelSystem.addExp` 和 `HeroSystem.addExp` 两条路径依赖 |
| 2 | HeroSystem | `getGoldRequired(level)` | F-Normal #2 | 同上，升级铜钱查表 |
| 3 | HeroSystem | `getGeneralsByQuality(quality)` | F-Normal #3 | 按品质筛选，编队推荐系统的数据源 |
| 4 | HeroSystem | `getGeneralsSortedByPower(descending)` | F-Normal #4 | 按战力排序，UI展示核心查询 |
| 5 | HeroSystem | `getSynthesizeProgress(generalId)` | F-Normal #5 | 合成进度反馈，R1裁决建议提升至P1 |
| 6 | HeroSystem | `getGeneralDef(generalId)` | F-Normal #6 | 武将定义查询，被多个系统引用 |
| 7 | AwakeningSystem | `getAwakeningExpRequired(level)` | F-Normal #9 | 觉醒经验表查询，LC-023依赖此API |
| 8 | AwakeningSystem | `getAwakeningGoldRequired(level)` | F-Normal #10 | 觉醒铜钱表查询 |
| 9 | AwakeningSystem | `getAwakeningSkillPreview(heroId)` | F-Normal #11 | 觉醒技能预览，不要求已觉醒 |
| 10 | AwakeningSystem | `getAwakeningStatDiff(heroId)` | F-Normal #12 | 觉醒属性差值预览 |
| 11 | SkillStrategyRecommender | `getAllStrategies()` | F-Normal #14 | 策略配置全量查询 |
| 12 | SkillStrategyRecommender | `getPrioritySkillTypes(enemyType)` | F-Normal #15 | 推荐技能类型优先级 |
| 13 | SkillStrategyRecommender | `getFocusStats(enemyType)` | F-Normal #16 | 推荐属性侧重 |

**评估**：R1裁决要求API覆盖率达到≥90%（从74%），R2新增覆盖2/19个遗漏API，API覆盖率约 **76%**，距封版门槛90%仍有14个API缺口。

### N2. R2未识别的新API遗漏

| # | System | API | 说明 |
|---|--------|-----|------|
| 14 | HeroSystem | `addExp(generalId, exp)` | **关键遗漏**：HeroSystem自身有一个 `addExp` 方法（行400-420），与 HeroLevelSystem.addExp **完全不同**——不扣铜钱、直接修改等级。此方法被 `engine-campaign-deps.ts` 的 `buildRewardDeps` 和 `ThreeKingdomsEngine` 的经验分配逻辑调用，是跨引擎经验奖励的核心入口。R2流程树完全没有枚举此API。 |
| 15 | HeroLevelSystem | `levelUp(generalId)` | 单级升级方法（行270-295），与 `quickEnhance` 不同——只升1级，使用经验条中的经验。有独立的资源扣除路径（先检查canAfford再spendResource），R2只关注了quickEnhance的原子性，遗漏了levelUp。 |
| 16 | SkillUpgradeSystem | `getCooldownReduce(heroId, skillIndex)` | 冷却缩减查询，行339 |
| 17 | SkillUpgradeSystem | `hasExtraEffect(heroId, skillIndex)` | 额外效果判断，行347 |
| 18 | SkillUpgradeSystem | `getExtraEffect(heroId, skillIndex)` | 额外效果详情，行354 |

### N3. HeroSystem.addExp 与 HeroLevelSystem.addExp 的双路径盲区

源码中存在 **两条完全独立的经验/升级路径**：

```
路径A（跨引擎奖励）: engine-campaign-deps → HeroSystem.addExp() → 直接修改level/exp，不扣铜钱
路径B（玩家主动升级）: HeroLevelSystem.addExp() → spendResource(GOLD) → 逐级升级扣铜钱
```

R2流程树 **只覆盖了路径B**（ATOM-QE-001~005），完全没有枚举路径A的测试节点。路径A的关键问题：
- `HeroSystem.addExp` 不检查铜钱，是否与 `HeroLevelSystem.addExp` 产生状态不一致？
- 跨引擎奖励通过 `buildRewardDeps.addExp` 调用的是 `HeroSystem.addExp`，升级后 `HeroLevelSystem` 的状态是否同步？
- 路径A升级后的武将，`HeroLevelSystem.canLevelUp()` 返回什么？

**建议新增节点**：`DUAL-EXP-001~005`（见下文F-Cross部分）。

---

## F-Boundary 遗漏：原子性场景的盲区

### B1. levelUp 单级升级的原子性（HeroLevelSystem）

R2的ATOM-QE系列只覆盖了 `quickEnhance`，但 `levelUp` 方法（行270-295）有独立的资源扣除：

```typescript
// HeroLevelSystem.levelUp (行283-284)
this.levelDeps.spendResource(GOLD_TYPE, goldReq);  // 单次扣除，无回滚保护
```

虽然只有单步扣除，但存在一个R2未覆盖的边界：

| # | ID | 描述 | 前置条件 | 预期结果 | 优先级 |
|---|-----|------|----------|----------|--------|
| 1 | BND-LU-001 | levelUp中spendResource成功但syncToHeroSystem前异常 | gold已扣，heroSystem.getGeneral返回undefined | gold已扣除但等级未变，资源丢失 | P1 |

### B2. addExp逐级循环中的部分升级边界（HeroLevelSystem.addExp）

`addExp` 方法（行223-268）使用 while 循环逐级升级，每级独立扣除铜钱：

```typescript
while (rem > 0 && curLv < maxLevel) {
  if (!this.levelDeps.spendResource(GOLD_TYPE, goldReq)) {
    curExp = acc; rem = 0; break;  // 铜钱耗尽，停止升级
  }
  goldSpent += goldReq;
  rem = acc - expReq;
  curLv += 1; curExp = 0; gained += 1;
}
```

R2的ATOM-QE-005（"多级升级中途gold耗尽"）覆盖了此场景，但遗漏了一个关键边界：

| # | ID | 描述 | 前置条件 | 预期结果 | 优先级 |
|---|-----|------|----------|----------|--------|
| 2 | BND-AE-001 | addExp升级5级中第3级spendResource返回false | 资源只够升2级 | curLv=+2, goldSpent=2级铜钱, curExp保留剩余经验 | P1 |
| 3 | BND-AE-002 | addExp传入amount=0 | amount=0 | 返回null（已有防护行223） | P2 |
| 4 | BND-AE-003 | addExp传入amount=负数 | amount=-100 | 返回null | P2 |

### B3. exchangeFragmentsFromShop 日限购形同虚设（P0级业务缺陷）

**源码证据**（HeroStarSystem.ts 行123-137）：

```typescript
exchangeFragmentsFromShop(generalId: string, count: number): ShopExchangeResult {
  const actualCount = Math.min(count, config.dailyLimit);  // 仅截断到dailyLimit
  // ❌ 没有跟踪已兑换次数！每次调用都能买到 dailyLimit 数量
  const totalGold = actualCount * config.pricePerFragment;
  this.deps.spendResource(RESOURCE_TYPE_GOLD, totalGold);
  this.heroSystem.addFragment(generalId, actualCount);
}
```

R2的 FRAG-SHOP-002 测试"兑换数量超过日限购"时预期 `actualCount = Math.min(count, dailyLimit)`，这验证了截断行为但 **未发现真正的业务缺陷**：玩家可以每天调用N次，每次都获得 dailyLimit 数量的碎片。

| # | ID | 描述 | 前置条件 | 预期结果 | 优先级 |
|---|-----|------|----------|----------|--------|
| 5 | BND-SHOP-001 | 连续两次调用exchangeFragmentsFromShop | count=10, dailyLimit=10, 铜钱充足 | **BUG**: 两次都成功，共获得20碎片（超过日限购） | **P0** |
| 6 | BND-SHOP-002 | 日限购边界：已兑换9次再兑换 | dailyLimit=10, 每次count=1 | **BUG**: 每次都成功，无累计限制 | **P0** |

### B4. 碎片溢出计算的精确边界

| # | ID | 描述 | 前置条件 | 预期结果 | 优先级 |
|---|-----|------|----------|----------|--------|
| 7 | BND-FRAG-001 | addFragment恰好到999再addFragment | 碎片=999, count=1 | 返回1（溢出），碎片保持999 | P1 |
| 8 | BND-FRAG-002 | useFragments后碎片恰好为0 | 碎片=5, useFragments(5) | key被delete，getFragments返回0 | P1 |

---

## F-Error 遗漏：异常路径的系统性盲区

### E1. HeroRecruitExecutor路径的碎片溢出丢失（P0级）

**源码证据**：

```typescript
// HeroRecruitExecutor.executeSinglePull (行91-93)
if (isDuplicate) {
  fragmentCount = heroSystem.handleDuplicate(generalId, resolvedQuality);
  // ❌ 没有溢出转铜钱逻辑！
}

// 对比 HeroRecruitSystem._executeRecruit (行376-380)
if (isDuplicate) {
  fragmentCount = heroSystem.handleDuplicate(generalId, resolvedQuality);
  const overflow = expectedFragments - actualGain;
  if (overflow > 0 && this.recruitDeps!.addResource) {
    this.recruitDeps!.addResource('gold', overflow * HeroSystemClass.FRAGMENT_TO_GOLD_RATE);
  }
}
```

R2的 GOLD-OVF-001~006 只覆盖了 `HeroRecruitSystem._executeRecruit` 路径的溢出转铜钱，**完全遗漏了 `HeroRecruitExecutor.executeSinglePull` 路径**。通过 Executor 招募时，碎片溢出部分 **直接丢失**，无铜钱补偿。

| # | ID | 描述 | 前置条件 | 预期结果 | 优先级 |
|---|-----|------|----------|----------|--------|
| 1 | ERR-EXEC-001 | Executor路径招募重复武将碎片溢出 | 碎片990, LEGENDARY重复→80碎片 | **BUG**: 溢出71碎片丢失，无铜钱补偿 | **P0** |
| 2 | ERR-EXEC-002 | Executor路径vs RecruitSystem路径的溢出行为差异 | 相同条件 | 两条路径结果不一致，Executor少获得铜钱 | **P0** |

### E2. HeroSerializer.deserialize 无异常防护

**源码证据**（HeroSerializer.ts 行82-96）：

```typescript
export function deserializeHeroState(data: HeroSaveData): HeroState {
  if (data.version !== HERO_SAVE_VERSION) {
    gameLog.warn(...);  // 仅警告，不拒绝
  }
  const generals: Record<string, GeneralData> = {};
  for (const [id, g] of Object.entries(data.state.generals)) {
    generals[id] = cloneGeneral(g);  // ❌ data.state为null时崩溃
  }
  return { generals, fragments: { ...data.state.fragments } };
}
```

R2的 ERR-DI-001~005 覆盖了依赖注入异常，但 **遗漏了反序列化的异常输入**：

| # | ID | 描述 | 前置条件 | 预期结果 | 优先级 |
|---|-----|------|----------|----------|--------|
| 3 | ERR-SER-001 | deserialize传入null | data=null | 应返回空状态而非崩溃 | P1 |
| 4 | ERR-SER-002 | deserialize传入data.state=null | data.state=null | 应返回空状态而非崩溃 | P1 |
| 5 | ERR-SER-003 | deserialize传入data.state.generals包含非法数据 | generals[id].baseStats=undefined | cloneGeneral应处理缺失字段 | P1 |
| 6 | ERR-SER-004 | 版本号不匹配时是否仍能正确加载 | version=999 | 当前仅warn继续加载，需验证兼容性 | P2 |

### E3. removeGeneral 无级联清理

**源码证据**（HeroSystem.ts 行132-138）：

```typescript
removeGeneral(generalId: string): GeneralData | null {
  const general = this.state.generals[generalId];
  if (!general) return null;
  const removed = cloneGeneral(general);
  delete this.state.generals[generalId];
  return removed;
  // ❌ 不清理碎片、不通知编队、不通知派驻、不通知觉醒
}
```

R2的 XI-056~060 覆盖了"移除武将后的级联影响"，但标记为 missing 且未列入 P0。这是一个 **数据一致性风险**：

| # | ID | 描述 | 前置条件 | 预期结果 | 优先级 |
|---|-----|------|----------|----------|--------|
| 7 | ERR-REM-001 | 移除在编队中的武将 | 编队含该武将 | 编队slots中该位置仍为generalId（悬空引用） | P1 |
| 8 | ERR-REM-002 | 移除已觉醒武将 | 武将已觉醒 | 觉醒被动仍叠加（state.heroes[heroId]未被清理） | P1 |
| 9 | ERR-REM-003 | 移除武将后碎片保留 | 武将有碎片 | 碎片仍存在（这是否符合设计？需确认） | P2 |

### E4. AwakeningSystem.spendResources 无失败检查

**源码证据**（AwakeningSystem.ts 行424-430）：

```typescript
private spendResources(heroId: string): void {
  if (!this.deps) return;
  this.deps.spendResource('gold', AWAKENING_COST.copper);           // 返回值被忽略
  this.deps.spendResource('breakthroughStone', AWAKENING_COST.breakthroughStones); // 返回值被忽略
  this.deps.spendResource('skillBook', AWAKENING_COST.skillBooks);   // 返回值被忽略
  this.deps.spendResource('awakeningStone', AWAKENING_COST.awakeningStones);       // 返回值被忽略
  this.heroSystem.useFragments(heroId, AWAKENING_COST.fragments);    // 返回值被忽略
}
```

R2的 ATOM-AW-001~004 覆盖了"中间步骤失败"的场景，但遗漏了一个关键点：**spendResources 方法的返回类型是 void**，它不返回任何值，即使内部扣除失败也不通知调用方。这意味着 `checkResources` 和 `spendResources` 之间存在 TOCTOU（Time-of-Check-Time-of-Use）竞态窗口。

| # | ID | 描述 | 前置条件 | 预期结果 | 优先级 |
|---|-----|------|----------|----------|--------|
| 10 | ERR-AW-001 | spendResources中spendResource返回false但被忽略 | 并发消耗导致check通过但spend失败 | 觉醒成功但资源未完全扣除 | P1 |

---

## F-Cross 遗漏：跨系统交互的覆盖评估

### 覆盖率评估

| 指标 | R1 | R2声称 | 挑战者评估 |
|------|-----|--------|-----------|
| F-Cross节点数 | 39 | 60 | 60 |
| 已覆盖 | 18 | 42(声称) | **~37** |
| 覆盖率 | 46% | 70% | **~62%** |

R2新增36个跨系统节点，但其中5个XI节点的预期行为描述不够精确（缺少具体断言），且有18个关键链路未覆盖。

### C1. HeroSystem.addExp 双路径一致性（新增关键链路）

| # | ID | 描述 | 涉及系统 | 预期行为 | 优先级 |
|---|-----|------|----------|----------|--------|
| 1 | DUAL-EXP-001 | campaign奖励→HeroSystem.addExp→升级→HeroLevelSystem状态同步 | Campaign↔Hero↔Level | HeroSystem.addExp升级后，HeroLevelSystem.getLevel()应反映新等级 | **P0** |
| 2 | DUAL-EXP-002 | HeroSystem.addExp升级后HeroLevelSystem.canLevelUp判断 | Hero↔Level | 路径A升级后路径B的canLevelUp应正确计算 | P1 |
| 3 | DUAL-EXP-003 | 两条路径交替使用：先LevelSystem.addExp升5级→再campaign奖励HeroSystem.addExp升2级 | Level↔Hero | 7级后数据一致，无状态漂移 | P1 |

### C2. buildRewardDeps.addExp 的经验分配逻辑

**源码证据**（engine-campaign-deps.ts 行73-80）：

```typescript
addExp: (exp: number) => {
  const generals = hero.getAllGenerals();
  if (generals.length === 0) return;
  const perHero = Math.floor(exp / generals.length);  // ⚠️ 整数除法截断
  if (perHero <= 0) return;
  for (const g of generals) {
    hero.addExp(g.id, perHero);
  }
}
```

| # | ID | 描述 | 涉及系统 | 预期行为 | 优先级 |
|---|-----|------|----------|----------|--------|
| 4 | REWARD-001 | 经验不能被武将数整除时的截断 | Campaign↔Hero | 3个武将分10经验，每人3点，1点丢失 | P1 |
| 5 | REWARD-002 | 战斗胜利时武将数为0 | Campaign↔Hero | exp直接丢弃，不崩溃 | P2 |
| 6 | REWARD-003 | 战斗胜利后新招募武将→下次奖励分配包含新武将 | Campaign↔Recruit↔Hero | 新武将参与分配 | P2 |

### C3. hero→battle→campaign 完整链路遗漏

R2的 XI-036~040 覆盖了 hero→battle→campaign 的基本链路，但遗漏了以下关键交互：

| # | ID | 描述 | 涉及系统 | 预期行为 | 优先级 |
|---|-----|------|----------|----------|--------|
| 7 | XI-MISS-001 | buildAllyTeam从编队构建战斗单位 | Formation↔Hero↔Battle | 编队武将属性正确映射为BattleUnit | P1 |
| 8 | XI-MISS-002 | 战斗中武将死亡→战后经验分配是否排除 | Battle↔Hero | 死亡武将是否仍获得经验（取决于设计） | P2 |
| 9 | XI-MISS-003 | 编队为空时战斗初始化 | Formation↔Battle | 应返回错误而非崩溃 | P1 |

### C4. R2 XI节点描述精度不足

以下R2节点虽然存在，但描述缺少可测试的精确断言：

| R2 ID | 问题 | 建议补充 |
|-------|------|----------|
| XI-033 | "觉醒后编队战力正确更新"缺少具体值 | 应指定：觉醒前战力X，觉醒后战力=X×1.5×羁绊系数 |
| XI-035 | "觉醒被动正确应用到全局"未定义"全局" | 应明确：被动影响哪些武将、叠加规则 |
| XI-047 | "派驻武将羁绊系数减半"未指定来源 | 源码中未找到此逻辑，可能是假设的行为，需确认 |
| XI-048 | "取消派驻后战力恢复"依赖XI-047 | 同上，需确认派驻是否影响羁绊 |

---

## F-Lifecycle 遗漏：数据生命周期的覆盖评估

### 覆盖率评估

| 指标 | R1 | R2声称 | 挑战者评估 |
|------|-----|--------|-----------|
| F-Lifecycle节点数 | 37 | 34(注:R2缩减了基数) | 34 |
| 已覆盖 | 14 | 25(声称) | **~22** |
| 覆盖率 | 38% | 74% | **~65%** |

> 注：R2将lifecycle节点从37缩减到34，同时声称覆盖率从38%提升到74%。但R1裁决要求的门槛是≥65%（基于原始基数），R2通过缩减基数来提升比例的做法值得商榷。

### L1. 存档版本迁移（R2 LC-018 不足）

LC-018 提到"版本升级后旧存档兼容"，但缺少具体场景：

| # | ID | 描述 | 涉及系统 | 预期行为 | 优先级 |
|---|-----|------|----------|----------|--------|
| 1 | LC-MIG-001 | v1存档（无觉醒数据）→v2引擎（含觉醒系统）加载 | All | 觉醒系统应初始化为空状态，不崩溃 | P1 |
| 2 | LC-MIG-002 | v1存档（无突破阶段数据）→v2引擎加载 | Star↔Level | getLevelCap应返回默认值100 | P1 |
| 3 | LC-MIG-003 | 存档中包含已删除武将定义的generalId | Hero | deserialize应跳过或标记无效武将 | P2 |

### L2. HeroLevelSystem 序列化为空实现

**源码证据**（HeroLevelSystem.ts 行508-509）：

```typescript
serialize(): LevelSaveData { return { version: LEVEL_SAVE_VERSION }; }
deserialize(_data: LevelSaveData): void { /* 预留 */ }
```

HeroLevelSystem 的序列化/反序列化是 **空实现**——不保存任何运行时状态。这意味着所有升级相关的中间状态（如当前等级上限回调结果）在存档恢复后需要重新计算。R2的 LC-029（"突破阶段持久化→等级上限恢复"）覆盖了通过 HeroStarSystem 恢复突破阶段的场景，但遗漏了：

| # | ID | 描述 | 涉及系统 | 预期行为 | 优先级 |
|---|-----|------|----------|----------|--------|
| 4 | LC-LEVEL-001 | HeroLevelSystem.deserialize空实现→getMaxLevel依赖实时回调 | Level↔Star↔Awakening | 反序列化后getMaxLevel通过回调动态获取，不依赖持久化 | P1 |
| 5 | LC-LEVEL-002 | 存档恢复时levelDeps未注入→getMaxLevel返回默认值 | Level | 反序列化后立即调用getMaxLevel应返回100（默认上限） | P2 |

### L3. 多系统联合序列化的顺序依赖

R2的 LC-017 要求"全系统serialize→deserialize→状态完全一致"，但未考虑反序列化的 **顺序依赖**：

| # | ID | 描述 | 涉及系统 | 预期行为 | 优先级 |
|---|-----|------|----------|----------|--------|
| 6 | LC-ORD-001 | HeroStarSystem先于HeroSystem反序列化 | Star↔Hero | StarSystem引用heroSystem.getFragments，若HeroSystem未恢复则返回0 | P1 |
| 7 | LC-ORD-002 | AwakeningSystem先于HeroStarSystem反序列化 | Awakening↔Star | 觉醒条件检查依赖星级和突破阶段 | P1 |

### L4. R2遗漏的生命周期场景

| # | ID | 描述 | 涉及系统 | 预期行为 | 优先级 |
|---|-----|------|----------|----------|--------|
| 8 | LC-ADD-001 | 武将删除后重新招募→等级/星级是否保留 | Hero↔Recruit | 重新招募应从1级1星开始（碎片保留） | P1 |
| 9 | LC-ADD-002 | 保底计数器在存档迁移后保持 | Recruit | 保底计数器通过RecruitSaveData持久化，迁移后应正确恢复 | P1 |
| 10 | LC-ADD-003 | 编队存档引用的武将被删除→反序列化后编队状态 | Formation↔Hero | 编队中该位置为空字符串或被跳过 | P2 |

---

## 优先级汇总

### P0 — 必须立即补充（影响核心经济和数据正确性）

| # | ID | 维度 | 描述 | 发现来源 |
|---|-----|------|------|----------|
| 1 | ERR-EXEC-001 | F-Error | HeroRecruitExecutor路径碎片溢出丢失无铜钱补偿 | **源码审查新发现** |
| 2 | ERR-EXEC-002 | F-Error | Executor与RecruitSystem溢出行为不一致 | **源码审查新发现** |
| 3 | BND-SHOP-001 | F-Boundary | exchangeFragmentsFromShop无限购累计，可无限兑换 | **源码审查新发现** |
| 4 | BND-SHOP-002 | F-Boundary | 商店限购形同虚设的业务缺陷 | **源码审查新发现** |
| 5 | DUAL-EXP-001 | F-Cross | HeroSystem.addExp与HeroLevelSystem.addExp双路径状态同步 | **源码审查新发现** |

### P1 — 应尽快补充（影响数据一致性和测试完备性）

| # | ID | 维度 | 描述 |
|---|-----|------|------|
| 6 | DUAL-EXP-002 | F-Cross | 双路径升级后canLevelUp判断 |
| 7 | DUAL-EXP-003 | F-Cross | 两条路径交替使用的一致性 |
| 8 | ERR-SER-001~004 | F-Error | HeroSerializer反序列化异常输入 |
| 9 | ERR-REM-001~002 | F-Error | removeGeneral无级联清理 |
| 10 | ERR-AW-001 | F-Error | spendResources返回值被忽略 |
| 11 | LC-MIG-001~002 | F-Lifecycle | 存档版本迁移场景 |
| 12 | LC-ORD-001~002 | F-Lifecycle | 多系统反序列化顺序依赖 |
| 13 | LC-ADD-001 | F-Lifecycle | 武将删除后重新招募 |
| 14 | REWARD-001 | F-Cross | 经验分配整数截断 |
| 15 | BND-LU-001 | F-Boundary | levelUp单级升级原子性 |
| 16 | BND-AE-001 | F-Boundary | addExp逐级循环部分升级 |

### P2 — 建议补充

- 其余F-Normal遗漏的13个查询API
- F-Boundary中的精确边界值（BND-FRAG-001/002, BND-AE-002/003）
- F-Cross中的XI-MISS-001~003
- F-Lifecycle中的LC-ADD-002/003

---

## R1裁决要求的回应评估

| R2要求 | 状态 | 说明 |
|--------|------|------|
| R2-01: 资源扣除原子性测试节点 | **部分完成** | 新增18节点覆盖quickEnhance/starUp/upgradeSkill/awaken，但遗漏levelUp单级升级和addExp逐级循环的原子性 |
| R2-02: 碎片获取途径完整枚举 | **部分完成** | 新增20节点覆盖activity/expedition/stage/shop，但遗漏第7种途径（HeroSystem.addExp间接获取——campaign奖励升级后间接影响碎片需求） |
| R2-03: 完整养成链路端到端 | **基本完成** | XI-029~035覆盖了碎片→升星→突破→觉醒链路，但遗漏双路径经验系统的一致性 |
| R2-04: 招贤令经济闭环 | **基本完成** | XI-041~045覆盖了被动产出→招募消耗闭环 |
| R2-05: 全系统联合序列化 | **部分完成** | LC-017~020覆盖了基本场景，但遗漏反序列化顺序依赖和版本迁移 |
| R2-06: 碎片溢出→铜钱转化 | **部分完成** | GOLD-OVF-001~006覆盖了RecruitSystem路径，但 **遗漏Executor路径** |

### R1修正要求评估

| R2-FIX | 状态 | 说明 |
|--------|------|------|
| R2-FIX-01: 修正ST-frag-005/006状态 | **未验证** | R2新增FRAG-ACT/EXP节点，但未明确说明是否修正了R1中的虚报 |
| R2-FIX-02: 修正HS-frag-008状态 | **部分完成** | 新增GOLD-OVF系列节点，但未明确标注原节点状态变更 |
| R2-FIX-03: 修正XI-005状态 | **未验证** | R2未提及此修正 |
| R2-FIX-04: 提升ST-frag-005/006优先级 | **已完成** | FRAG-ACT-001/FRAG-EXP-001已标为P0 |
| R2-FIX-05: 提升XI-024优先级 | **未验证** | R2中XI-024未出现在新增节点中 |

---

## 统计汇总

| 维度 | R2新增节点 | 挑战者发现遗漏 | 遗漏占比 |
|------|-----------|---------------|----------|
| F-Normal | 0（针对R1遗漏） | 18（13个R1遗留 + 5个新发现） | — |
| F-Boundary | 10 | 8 | 80% |
| F-Error | 10 | 10 | 100% |
| F-Cross | 36 | 10 | 28% |
| F-Lifecycle | 14 | 10 | 71% |
| **合计** | **120** | **56** | — |

> 注：F-Error遗漏占比100%是因为R2新增的10个节点（ERR-DI和ERR-CONC系列）虽然有价值，但完全未覆盖本审查发现的Executor路径缺陷、反序列化异常、removeGeneral级联等问题。R2的异常路径补充集中在"依赖注入"和"并发竞态"，遗漏了"数据损坏"和"路径差异"两类异常。

---

## 封版建议

**封版: NO**

理由：
1. **P0级业务缺陷未发现**：exchangeFragmentsFromShop无限购累计（BND-SHOP-001/002）和HeroRecruitExecutor溢出丢失（ERR-EXEC-001/002）是R2流程树应该发现但未发现的源码级缺陷
2. **API覆盖率76%**，距封版门槛90%仍有14个API缺口
3. **F-Cross覆盖率~62%**，距封版门槛70%仍差8个百分点，主要因为双路径经验系统未覆盖
4. **F-Lifecycle覆盖率~65%**，勉强达到门槛但存档迁移和反序列化顺序依赖场景不足

**建议Round 3重点**：
1. 修复并测试exchangeFragmentsFromShop的日限购累计逻辑
2. 统一HeroRecruitExecutor和HeroRecruitSystem的溢出处理行为
3. 补充HeroSystem.addExp双路径一致性测试
4. 补充13个R1遗留的查询API测试
5. 补充反序列化异常输入防护测试

---

*Round 2 挑战清单完成。共发现56个遗漏项，其中P0级5个（均为源码审查新发现），P1级16个，P2级10个。R2在已知遗漏的系统性补全上做得扎实，但在源码深度审查和跨路径一致性验证上仍有明显盲区。*
