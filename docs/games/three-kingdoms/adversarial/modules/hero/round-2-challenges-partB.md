# Hero 挑战清单 Round 2 — Part B（经济+编队系统验证）

> Challenger: TreeChallenger v1.1 | Time: 2026-05-01
> 审查对象: FIX-002/FIX-004 修复验证 + 经济/编队/推荐系统新问题扫描

## 一、R1修复验证

### FIX-002: useFragments 负值漏洞 — ✅ 完全修复

已在 Part A 验证。经济系统层面确认：
- `useFragments(generalId, -100)` → return false ✅
- `useFragments(generalId, NaN)` → return false ✅
- `useFragments(generalId, 0)` → return false ✅
- 正常消耗路径不受影响 ✅

### FIX-004: FormationRecommendSystem null guard — ✅ 完全修复

| 检查点 | 修复状态 | 验证结果 |
|--------|---------|---------|
| `availableHeroes=null` | ✅ | `(null ?? []).filter(...)` → 空数组，返回空方案 |
| `availableHeroes=[null, hero1]` | ✅ | filter 过滤 null，仅使用有效武将 |
| `calculatePower` 返回 NaN | ✅ | `Number.isFinite(power) ? power : 0` |
| `calculatePower` 返回 Infinity | ✅ | `Number.isFinite(Infinity)` = false → 0 |

---

## 二、经济系统新问题

### R2-B001: HeroStarSystem.exchangeFragmentsFromShop 缺少碎片上限溢出处理 — P0

**位置**：`HeroStarSystem.ts:131-142`

**问题**：`exchangeFragmentsFromShop` 调用 `this.heroSystem.addFragment(generalId, actualCount)` 添加碎片。`addFragment` 有上限 999 并返回溢出值，但 `exchangeFragmentsFromShop` **忽略了溢出值**。玩家花费铜钱购买碎片，超出 999 上限的部分被静默丢弃（不转化为铜钱）。

```typescript
// 当前代码：
this.heroSystem.addFragment(generalId, actualCount); // 返回的溢出值被忽略！

// 应该是：
const overflow = this.heroSystem.addFragment(generalId, actualCount);
if (overflow > 0) {
  // 溢出碎片应转化为铜钱（1碎片=100铜钱）
  this.deps.addResource?.('gold', overflow * HeroSystem.FRAGMENT_TO_GOLD_RATE);
}
```

**影响**：当碎片接近 999 上限时，商店购买的碎片会被浪费，但铜钱已扣除。经济漏洞。

### R2-B002: HeroStarSystem.addFragmentFromActivity 同样忽略溢出 — P0

**位置**：`HeroStarSystem.ts:165-175`

**问题**：`addFragmentFromActivity` 调用 `this.heroSystem.addFragment(heroId, amount)` 并计算 `actual = amount - overflow`，但**溢出碎片仅记录在日志中，未转化为铜钱**。

```typescript
const overflow = this.heroSystem.addFragment(heroId, amount);
const actual = amount - overflow;
gameLog.info(`[HeroStarSystem] activity fragment: ${heroId} +${actual} from "${source}"`);
// overflow 碎片丢失！
```

**影响**：活动奖励的碎片如果导致溢出，超出部分被静默丢弃。

### R2-B003: HeroStarSystem.addFragmentFromExpedition 同样忽略溢出 — P0

**位置**：`HeroStarSystem.ts:181-188`

**问题**：与 R2-B002 相同。远征碎片溢出被静默丢弃。

### R2-B004: TokenEconomy.buyFromShop 缺少 NaN 防护 — P1（已通过FIX-001修复）

**验证**：L282 已有 `!Number.isFinite(count) || count <= 0` 防护。✅

### R2-B005: TokenEconomy.claimOfflineReward NaN 传播到 addRecruitToken — P1

**位置**：`recruit-token-economy-system.ts`

**问题**：虽然 `calculateOfflineReward` 已添加 NaN 防护（FIX-001），但如果 `claimOfflineReward` 的参数 `offlineSeconds` 通过了检查（如为正常值），但 `PASSIVE_RATE_PER_SECOND` 或 `economyDeps.addRecruitToken` 内部产生 NaN，仍可能导致资源系统异常。

**分析**：`PASSIVE_RATE_PER_SECOND` 是常量 0.002，不会产生 NaN。`addRecruitToken` 是外部回调，如果回调返回 NaN，`totalPassiveEarned` 会被 NaN 污染。但 `totalPassiveEarned` 仅用于统计，不影响实际资源。

**严重程度**：P2（仅影响统计数据）

### R2-B006: HeroRecruitSystem 十连招募资源不回滚 — P0（R1遗留）

**位置**：`HeroRecruitSystem.ts:307-340`

**源码验证**：
```typescript
// 先扣除全部资源
if (!this.recruitDeps.spendResource(cost.resourceType, cost.amount)) return null;
// 然后循环执行
for (let i = 0; i < count; i++) {
    results.push(this.executeSinglePull(type));
}
```

**问题**：如果循环中途 `executeSinglePull` 抛出异常（如 heroSystem 异常），已扣除的 10 个 recruitToken 无法追回。`executeSinglePull` 内部没有 try-catch。

**影响**：资源已扣但未获得全部 10 个招募结果。

---

## 三、编队系统新问题

### R2-B007: HeroFormation.addToFormation 不验证武将是否存在 — P0（R1遗留）

**位置**：`HeroFormation.ts:150-162`

**源码验证**：`addToFormation` 不调用 `HeroSystem.hasGeneral()` 或任何验证回调。任何字符串（包括不存在的武将ID、空字符串）都可以加入编队。

```typescript
formation.addToFormation('1', 'nonexistent_hero_99999'); // 成功！
```

**影响**：编队中可填入不存在的武将ID，后续 `calculateFormationPower` 会跳过（返回0战力），但编队UI会显示空武将。

### R2-B008: HeroFormation.setFormation(generalIds=null) 崩溃 — P0（R1遗留）

**位置**：`HeroFormation.ts:135-145`

**源码验证**：`generalIds.slice(0, MAX_SLOTS_PER_FORMATION)` — 如果 `generalIds` 为 null，`null.slice()` 会抛出 TypeError。

### R2-B009: HeroFormation.deserialize 不验证武将ID有效性 — P1

**位置**：`HeroFormation.ts:404-425`

**问题**：`deserialize` 恢复编队数据时，直接将存档中的武将ID填入 slots，不验证这些ID是否仍然存在于 HeroSystem 中。如果版本更新删除了某个武将，编队中会出现无效ID。

---

## 四、推荐算法问题

### R2-B010: FormationRecommendSystem.buildSynergyPlan 羁绊分数使用硬编码值 — P0（R1遗留）

**位置**：`FormationRecommendSystem.ts:300`

**源码验证**：
```typescript
const synergyBonus = bestGroup.length >= 3 ? 15 : bestGroup.length >= 2 ? 8 : 0;
```

**问题**：羁绊加成分数使用硬编码值（15/8/0），而非调用 BondSystem 或 FactionBondSystem 的实际羁绊计算结果。推荐算法的羁绊分数与实际战斗中的羁绊效果可能不一致。

### R2-B011: FormationRecommendSystem.buildBalancedPlan 方案可能与最强方案完全重复 — P0（R1遗留）

**位置**：`FormationRecommendSystem.ts:243-275`

**问题**：当可用武将数 ≤ 6 时，平衡方案选的武将集合与最强方案完全相同（仅排列顺序不同）。玩家看到的"不同方案"实际是同一组武将。

### R2-B012: FormationRecommendSystem.buildSynergyPlan 方案可能与最强方案完全重复 — P0（R1遗留）

**位置**：`FormationRecommendSystem.ts:282-310`

**问题**：当所有武将属于同一阵营时，羁绊方案选的武将与最强战力方案完全相同。无去重逻辑。

### R2-B013: FormationRecommendSystem 不校验 stageType 有效性 — P1

**位置**：`FormationRecommendSystem.ts:165-180`

**问题**：`stageType` 参数如果传入无效值（如 'unknown'），`analyzeStage` 的 switch 走 default 分支（按 normal 计算），不会崩溃但推荐可能不准确。

---

## 五、Part B 统计

| 类别 | 数量 |
|------|------|
| R1修复验证通过 | 2/2 |
| 新发现（P0） | 6 |
| 新发现（P1） | 4 |
| 新发现（P2） | 1 |
| R1遗留未修复 | 6 |

---

*Part B 审查完成。*
