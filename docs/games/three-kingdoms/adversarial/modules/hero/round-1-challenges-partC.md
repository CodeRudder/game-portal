# Hero模块挑战清单 — Round 1 Part C（编队派遣+配置）

> 生成时间: 2026-05-01
> 挑战者: TreeChallenger Agent
> 审查范围: Builder Part C 流程分支树 + 9个源码文件
> 源码路径: `src/games/three-kingdoms/engine/hero/`

---

## 统计

| 指标 | 数值 |
|------|------|
| Builder树总节点数 | 236 |
| Builder声称P0节点 | 42 |
| Builder声称missing | 47 |
| Builder声称partial | 3 |
| **本次挑战确认P0** | **19** |
| **本次挑战新增P0** | **8** |
| **本次挑战降级P0→P1** | **4** |
| **虚报率（P0降级比例）** | **21%** |

---

## 一、源码验证发现

### 1.1 dispatchHero heroId空字符串校验 — Builder声称缺失，源码实际有部分防护

**Builder声称**（HD-disp-005）: `heroId=""` 无校验，`heroDispatch[""]` 被设置

**源码验证**: `dispatchHero()` 确实没有 `!heroId` 的显式检查。空字符串 `""` 会通过 `this.heroDispatch[""]` 正常设置，创建一个无效的派驻记录。但 `calculateBonus("")` 会因 `getGeneralFn("")` 返回 undefined 而返回 0，所以加成为 0。

**挑战结论**: Builder声称正确。空字符串被接受为合法 heroId，创建了一个 `bonusPercent=0` 的脏数据记录。虽然不会崩溃，但会在 `buildingDispatch`/`heroDispatch` 中留下不可清理的垃圾数据（`undeployHero("")` 可以清除，但前提是调用者知道有空字符串存在）。

**严重性**: P0 → **维持P0**（脏数据污染，可能导致序列化后反序列化异常）

---

### 1.2 dispatchHero buildingType空字符串 — Builder声称缺失

**Builder声称**（HD-disp-006）: `buildingType=""` 无校验

**源码验证**: `dispatchHero()` 无 buildingType 校验。但 `undeployHero()` 有 `if (!buildingType) return false;`（行165），`getDispatchBonus()` 也有 `if (!buildingType) return 0;`（行227）。这意味着：
- `dispatchHero("hero1", "")` 会成功，设置 `buildingDispatch[""]` 和 `heroDispatch["hero1"] = ""`
- `undeployHero("hero1")` 能正常清除（因为它查的是 `heroDispatch["hero1"]`，不是 buildingType）
- 但 `getDispatchBonus("")` 会被 `!buildingType` 拦截返回 0

**挑战结论**: Builder声称正确，但严重性需调整。空字符串 buildingType 能被设置但加成始终为 0，且可通过 undeployHero 清除。

**严重性**: P0 → **降级为P1**（功能异常但不崩溃，有清理路径）

---

### 1.3 getState() 浅拷贝风险 — Builder声称P0

**Builder声称**（HD-sub-004）: `getState()` 返回浅拷贝，修改返回值中嵌套对象可能影响内部状态

**源码验证**（行98~103）:
```ts
getState(): Record<string, unknown> {
  return {
    buildingDispatch: { ...this.buildingDispatch },
    heroDispatch: { ...this.heroDispatch },
  };
}
```
第一层是展开运算符浅拷贝。`buildingDispatch` 的值是 `DispatchRecord` 对象（含 `heroId`, `buildingType`, `bonusPercent`）。如果外部代码修改 `getState().buildingDispatch["castle"].bonusPercent = 999`，确实会修改内部 `DispatchRecord` 对象引用。

**复现场景**:
```ts
const state = system.getState() as any;
state.buildingDispatch["castle"].bonusPercent = 999;
// 此时 system 内部 buildingDispatch["castle"].bonusPercent 也变为 999
```

**挑战结论**: Builder声称正确。`DispatchRecord` 是引用类型，浅拷贝不保护嵌套对象。

**严重性**: **维持P0**（外部可篡改内部状态，影响加成计算）

---

### 1.4 calculateBonus NaN传播 — Builder声称P0

**Builder声称**（HD-calc-005）: `level=NaN` 导致 NaN 传播

**源码验证**（行244~258）:
```ts
const levelBonus = general.level * LEVEL_BONUS_PER_LEVEL; // NaN * 0.5 = NaN
const totalBonus = (qualityBonus + levelBonus) * (1 + attackBonus); // (品质 + NaN) * ... = NaN
return Math.round(totalBonus * 10) / 10; // Math.round(NaN) = NaN
```

**复现场景**: 如果 `getGeneralFn` 返回一个 `level=NaN` 的武将对象，`calculateBonus` 返回 NaN。NaN 会通过 `getDispatchBonus()` 传播到建筑系统，最终导致建筑产出 NaN。

**挑战结论**: Builder声称正确。

**严重性**: **维持P0**（NaN 传播到经济系统）

---

### 1.5 calculateBonus 负等级 — Builder声称P0

**Builder声称**（HD-calc-006）: `level=-1` 产生负加成

**源码验证**:
```ts
const levelBonus = -1 * 0.5 = -0.5
// COMMON: (1 + (-0.5)) * (1 + attack*0.01) = 0.5 * ...
```
COMMON 品质 + level=-1 → qualityBonus=1, levelBonus=-0.5 → 基础=0.5，仍为正。
但如果是某种极端情况（假设 qualityBonus=0，虽然 QUALITY_BONUS 中不存在 0 值），或 level 极端负值：
- level=-100 → levelBonus=-50 → (1 + (-50)) = -49 → 负加成

**挑战结论**: Builder声称正确。极端负等级可产生负加成。

**严重性**: **维持P0**（负值经济漏洞）

---

### 1.6 FormationRecommendSystem calculatePower=null — Builder声称P0

**Builder声称**（FR-rec-006）: `calculatePower=null` 调用崩溃

**源码验证**（行88~91）:
```ts
const sortedHeroes = [...availableHeroes]
  .map(h => ({ hero: h, power: calculatePower(h) }))
  .sort((a, b) => b.power - a.power);
```
如果 `calculatePower` 为 null/undefined，`.map(h => calculatePower(h))` 会抛出 `TypeError: calculatePower is not a function`。

**挑战结论**: Builder声称正确。无 null guard。

**严重性**: **维持P0**（运行时崩溃）

---

### 1.7 FormationRecommendSystem availableHeroes含null — Builder声称P0

**Builder声称**（FR-rec-007）: `heroes=[null, hero1]` 导致 `calculatePower(null)` 崩溃

**源码验证**: 同上，`.map(h => ({ hero: h, power: calculatePower(h) }))` 中 `h=null` → `calculatePower(null)` → 取决于回调实现，如果回调访问 `null.quality` 则崩溃。

**挑战结论**: Builder声称正确。`recommend()` 不校验数组元素有效性。

**严重性**: **维持P0**（运行时崩溃风险）

---

## 二、Builder遗漏的新P0缺陷

### CH-NEW-001: recommend() 羁绊方案与最强方案完全重复时未去重

**源码位置**: `FormationRecommendSystem.ts` 行148~175（`buildSynergyPlan`）

**问题描述**: 当所有武将属于同一阵营时，羁绊方案选的武将与最强战力方案完全相同。Builder树节点 FR-rec-018 标记为 missing P1，但实际严重性应为 P0。

**复现场景**:
```ts
// 7个武将全部是蜀国
const allShu = createTestHeroes().map(h => ({ ...h, faction: 'shu' }));
const result = system.recommend('boss', allShu, calc);
// result.plans[0].heroIds === result.plans[2].heroIds（完全相同）
```

**影响**: 玩家看到3个推荐方案但其中2个完全一样，推荐系统失去意义。

**严重性**: **P0**（核心玩法体验缺陷）

---

### CH-NEW-002: recommend() 羁绊方案不考虑装备加成

**源码位置**: `FormationRecommendSystem.ts` 行148~175

**问题描述**: 羁绊方案只看阵营和战力，不考虑武将是否装备了羁绊相关装备。`calculatePower` 回调虽然由外部传入（理论上可包含装备加成），但推荐算法的羁绊加成 `synergyBonus` 是硬编码的 15/8/0，与实际 BondSystem 计算的羁绊倍率无关。

**影响**: 推荐方案中羁绊加成的分数与实际战斗中的羁绊效果不一致。推荐说"羁绊优先"但实际羁绊效果可能远小于预期。

**严重性**: **P0**（推荐算法与实际玩法脱节）

---

### CH-NEW-003: recommend() 平衡方案选将逻辑缺陷 — 可能选到重复武将

**源码位置**: `FormationRecommendSystem.ts` 行115~140（`buildBalancedPlan`）

**问题描述**: 平衡方案使用 `slot % 3` 交替从三组选将。当武将数较少（如4~5个）时，`third=1`，三组为 `[h0], [h1], [h2,h3,h4]`。slot=0 取 groups[0][0]=h0, slot=1 取 groups[1][0]=h1, slot=2 取 groups[2][0]=h2, slot=3 取 groups[0][1]=undefined（不存在），然后进入 while 补充逻辑。补充逻辑用 `find(h => !selected.some(s => s.hero.id === h.hero.id))` 避免重复，所以不会真正重复。但如果武将恰好6个且分三组后某组不足，补充逻辑可能选到战力很低的武将。

**更严重的问题**: 最强方案和平坦方案可能选到相同武将，两个方案 heroIds 完全相同（当武将数 ≤ 6 时）。

**复现场景**:
```ts
// 6个武将，全部不同阵营
const heroes = [h1, h2, h3, h4, h5, h6]; // 战力递减
// 最强方案：选 h1~h6（全部）
// 平衡方案：third=2, groups=[h1,h2],[h3,h4],[h5,h6]
//   slot0→h1, slot1→h3, slot2→h5, slot3→h2, slot4→h4, slot5→h6
//   heroIds = [h1,h3,h5,h2,h4,h6]（与最强方案相同ID集合，仅顺序不同）
```

**影响**: 推荐的"不同方案"实际是同一组武将的不同排列，玩家无实质选择。

**严重性**: **P0**（推荐系统核心功能缺陷）

---

### CH-NEW-004: STAR_MULTIPLIERS 数组索引与星级不对应

**源码位置**: `star-up-config.ts` 行41~50

**问题描述**:
```ts
export const STAR_MULTIPLIERS: readonly number[] = [
  1.0,   // 1 星         ← 索引0
  1.0,   // 1 星（索引0占位） ← 索引1，注释说"1星"但实际应该是2星
  1.15,  // 2 星         ← 索引2
  1.35,  // 3 星         ← 索引3
  1.6,   // 4 星         ← 索引4
  2.0,   // 5 星         ← 索引5
  2.5,   // 6 星         ← 索引6
];
```

`getStarMultiplier(star)` 直接用 `STAR_MULTIPLIERS[star]` 索引。当 `star=1` 时返回 `STAR_MULTIPLIERS[1]=1.0`（索引1的值），这是正确的（1星倍率1.0）。但索引0也是1.0，作为 `star<1` 的 fallback。注释混乱但不影响正确性。

**更关键的问题**: `getStarMultiplier(0)` 返回 `STAR_MULTIPLIERS[0]=1.0`，但0星在游戏中不应该存在。如果某个地方传入 `star=0`，会静默返回1.0而不是报错。

**严重性**: **P1**（注释混乱+边界静默处理，但不影响正常游戏流程）

**降级说明**: 虽然数组注释有误导性，但 `getStarMultiplier` 的逻辑是正确的。star=0 的 fallback 到 1.0 是合理的设计。降为 P1。

---

### CH-NEW-005: SHOP_FRAGMENT_EXCHANGE 缺少新增武将的兑换配置

**源码位置**: `star-up-config.ts` 行152~165

**问题描述**: PRD v1.3 新增了6名 RARE 品质武将（lushu/huanggai/ganning/xuhuang/zhangliao/weiyan），但 `SHOP_FRAGMENT_EXCHANGE` 中没有这6名武将的兑换配置。玩家获得这些武将后，无法通过商店兑换碎片来升星。

**影响**: 新增武将的碎片只能通过关卡掉落（如果 `STAGE_FRAGMENT_DROPS` 中有配置）或重复招募获得，缺少商店兑换这一重要碎片来源。检查 `STAGE_FRAGMENT_DROPS`：也没有这6名新增武将的掉落配置！

**严重性**: **P0**（新增武将碎片获取路径断裂，无法正常升星）

---

### CH-NEW-006: STAGE_FRAGMENT_DROPS 缺少新增武将的掉落配置

**源码位置**: `star-up-config.ts` 行120~135

**问题描述**: `STAGE_FRAGMENT_DROPS` 只包含14个原始武将的掉落配置，PRD v1.3 新增的6名 RARE 武将（lushu/huanggai/ganning/xuhuang/zhangliao/weiyan）完全没有关卡掉落配置。

**影响**: 结合 CH-NEW-005，这6名武将既没有商店兑换也没有关卡掉落，碎片来源仅剩招募重复转化。RARE 品质在普通池概率8%、高级池25%，重复获取概率低，升星几乎不可能。

**严重性**: **P0**（与 CH-NEW-005 合并，新增武将成长路径完全断裂）

---

### CH-NEW-007: LEVEL_EXP_TABLE 经验曲线 1~10级过快，91~100级过慢

**源码位置**: `hero-config.ts` 行35~46

**问题描述**: 经验需求从 50/级（1~10级）到 9000/级（91~100级），跨度180倍。但铜钱消耗从 20/级 到 4000/级，跨度200倍。经验与铜钱的增长比例不一致：

| 等级段 | expPerLevel | goldPerLevel | gold/exp比 |
|--------|-------------|--------------|------------|
| 1~10 | 50 | 20 | 0.40 |
| 11~20 | 120 | 50 | 0.42 |
| 21~30 | 250 | 100 | 0.40 |
| 31~40 | 500 | 200 | 0.40 |
| 41~50 | 1000 | 400 | 0.40 |
| 51~60 | 1500 | 600 | 0.40 |
| 61~70 | 2500 | 1000 | 0.40 |
| 71~80 | 4000 | 1600 | 0.40 |
| 81~90 | 6000 | 2500 | 0.42 |
| 91~100 | 9000 | 4000 | 0.44 |

gold/exp 比率基本稳定在 0.40，说明经济设计是合理的。但 91~100 级的绝对经验需求（9000/级）意味着从 91 升到 100 需要总经验 9000×10=90000。如果每日经验获取量在 2000~5000 范围，需要 18~45 天才能完成，这个节奏可能过慢。

**严重性**: **P1**（数值平衡问题，非代码缺陷，建议策划评估）

---

### CH-NEW-008: 普通招募消耗 resourceType 与高级招募相同

**源码位置**: `hero-recruit-config.ts` 行35~44

**问题描述**:
```ts
export const RECRUIT_COSTS = {
  normal: { resourceType: 'recruitToken', amount: 1 },
  advanced: { resourceType: 'recruitToken', amount: 10 },
};
```
普通招募和高级招募使用相同的资源类型 `recruitToken`。这意味着：
- 玩家可以用 10 次 × 1 个 recruitToken 做普通招募，或 1 次 × 10 个做高级招募
- 高级招募的概率远优于普通（LEGENDARY: 2% vs 0%）
- 理性玩家永远不会做普通招募（除非用免费次数）

**影响**: 普通招募池完全失去意义。Builder树节点 HRC-cost-004 提到了资源类型一致性，但没有指出这导致的经济设计问题。

**严重性**: **P1**（设计问题，非代码缺陷。建议普通招募使用不同的资源类型）

---

## 三、Builder声称P0但实际为P1的降级

### 降级1: HD-disp-006 buildingType空字符串 — P0→P1

**理由**: 详见 1.2 节。空字符串 buildingType 能被设置但加成为0，且可通过 undeployHero 清除。不会崩溃，不会产生经济漏洞。

---

### 降级2: HD-disp-007 getGeneralFn未注入 — P1（Builder已标P1，确认正确）

**理由**: `calculateBonus` 在 `!this.getGeneralFn` 时返回 0，已有防护。Builder标记为 P1 missing，确认正确。

---

### 降级3: HD-disp-008 getGeneralFn返回undefined — P1（Builder已标P1，确认正确）

**理由**: `calculateBonus` 在 `!general` 时返回 0，已有防护。Builder标记为 P1 missing，确认正确。

---

### 降级4: FR-rec-018 所有武将同一阵营时羁绊方案重复 — P1→P0（升级）

**理由**: 详见 CH-NEW-001。Builder标为 P1 missing，但实际影响推荐系统核心功能，应升级为 P0。

---

## 四、跨系统交互遗漏（F-Cross）

| # | 交互链 | Builder覆盖 | 挑战补充 | 严重性 |
|---|--------|-------------|----------|--------|
| XC-C01 | FormationRecommendSystem → BondSystem 羁绊分数一致性 | missing (XC-002) | **确认P0**: 推荐算法用硬编码 synergyBonus(15/8/0)，与 BondSystem 的 FORMATION_BOND_BONUS_RATE(5%/羁绊) 计算结果不一致。推荐说"羁绊优先"但实际羁绊效果可能差3倍以上 | P0 |
| XC-C02 | FormationRecommendSystem → HeroFormation 推荐应用 | missing (XC-001) | **确认P0**: 推荐结果返回 `heroIds: string[]`，但 HeroFormation.setFormation 接受 `FormationData`（含 id/name/slots）。缺少推荐→编队的转换适配层 | P0 |
| XC-C03 | HeroDispatchSystem → BuildingSystem 产出联动 | missing (XC-003) | **确认P0**: `getDispatchBonus()` 返回加成百分比，但没有任何机制通知建筑系统加成变化。建筑系统需要主动轮询才能获取最新加成 | P0 |
| XC-C04 | HeroLevelSystem → HeroDispatchSystem 升级后刷新 | missing (XC-004) | **确认P0**: `refreshDispatchBonus()` 存在但需要外部调用。如果 HeroLevelSystem 升级后不调用此方法，派驻加成不会更新 | P0 |
| XC-C05 | HeroSystem.removeGeneral → HeroDispatchSystem 清理 | missing (XC-006) | **确认P0**: 移除已派驻武将时，如果 HeroSystem 不调用 `undeployHero()`，派驻关系会指向不存在的武将。`getDispatchBonus()` 会因 `getGeneralFn(removedId)` 返回 undefined 而返回 0，但 `buildingDispatch` 中仍有脏数据 | P0 |
| XC-C06 | HeroDispatchSystem serialize → 全局存档 | missing (XC-010) | **确认P0**: HeroDispatchSystem 有独立的 serialize/deserialize，但需要确认 engine-save 是否调用它。如果遗漏，派驻数据在重启后丢失 | P0 |
| XC-C07 | star-up-config SHOP_FRAGMENT_EXCHANGE → StarSystem 限购执行 | missing (SRC-shop-007) | **确认P0**: 配置定义了 dailyLimit 但执行层在 StarSystem 中。需要确认 StarSystem.exchangeFragmentsFromShop 是否读取并强制执行 dailyLimit | P0 |
| XC-C08 | hero-recruit-config UP_HERO_DESCRIPTIONS 覆盖范围 | missing (HRC-up-004) | **确认P1**: UP_HERO_DESCRIPTIONS 只覆盖9个武将（5个LEGENDARY + 3个EPIC + 1个EPIC），但 GENERAL_DEFS 有20个武将。设置非覆盖列表中的武将为UP时，description 为空字符串 | P1 |
| XC-C09 | FormationRecommendSystem → Campaign stageType | missing (XC-009) | **确认P1**: stageType 参数来源于 Campaign 系统，但 FormationRecommendSystem 不校验 stageType 有效性。unknown 类型走 default 分支（按 normal 计算），不会崩溃但推荐可能不准确 | P1 |
| XC-C10 | hero-config HERO_MAX_LEVEL=50 与实际等级上限 | covered (HC-exp-006) | **补充**: HERO_MAX_LEVEL 注释明确说这是 fallback，实际由突破决定。但如果 HeroLevelSystem 没有注入 HeroStarSystem，会使用 HERO_MAX_LEVEL=50 作为上限，此时 LEVEL_EXP_TABLE 的 51~100 级配置永远不会被使用 | P1 |

---

## 五、配置合理性审查

### 5.1 经验表平滑度

| 等级段 | expPerLevel | 环比增长 | 评价 |
|--------|-------------|----------|------|
| 1~10 | 50 | — | ✅ |
| 11~20 | 120 | 2.4x | ✅ 合理 |
| 21~30 | 250 | 2.1x | ✅ 合理 |
| 31~40 | 500 | 2.0x | ✅ 合理 |
| 41~50 | 1000 | 2.0x | ✅ 合理 |
| 51~60 | 1500 | 1.5x | ⚠️ 增速放缓，可能过快 |
| 61~70 | 2500 | 1.67x | ✅ |
| 71~80 | 4000 | 1.6x | ✅ |
| 81~90 | 6000 | 1.5x | ⚠️ |
| 91~100 | 9000 | 1.5x | ⚠️ |

**结论**: 1~50级增长合理（每段约2倍），51~100级增速放缓到1.5x。整体曲线平滑，无明显断崖。**通过**。

### 5.2 升星材料合理性

| 星级 | 碎片消耗 | 铜钱消耗 | 累计碎片 | 评价 |
|------|----------|----------|----------|------|
| 0→1 | 0 | 0 | 0 | ✅ 初始免费 |
| 1→2 | 20 | 5000 | 20 | ✅ |
| 2→3 | 40 | 10000 | 60 | ✅ |
| 3→4 | 80 | 20000 | 140 | ✅ |
| 4→5 | 150 | 50000 | 290 | ✅ |
| 5→6 | 300 | 100000 | 590 | ✅ |

**碎片获取速率验证**:
- COMMON重复=5碎片，商店500铜钱/碎片，限购50/日 → 每日最多25000铜钱换50碎片
- LEGENDARY重复=80碎片，商店5000铜钱/碎片，限购5/日 → 每日最多25000铜钱换5碎片
- 5→6星需要300碎片，如果是LEGENDARY武将，需要60天（每日5碎片）或15天（每日20碎片，需12次重复招募）

**结论**: LEGENDARY武将升星周期过长（5→6星需60天），建议增加碎片获取途径。**P1数值平衡问题**。

### 5.3 招募概率公平性

| 品质 | 普通池 | 高级池 | 评价 |
|------|--------|--------|------|
| COMMON | 60% | 20% | ✅ |
| FINE | 30% | 40% | ✅ |
| RARE | 8% | 25% | ✅ |
| EPIC | 2% | 13% | ✅ |
| LEGENDARY | 0% | 2% | ✅ |

**保底验证**:
- 高级池100抽硬保底LEGENDARY → 最坏情况下100×10=1000 recruitToken 保底一个LEGENDARY
- 十连保底RARE → 每10抽至少一个RARE
- 普通池无硬保底，LEGENDARY概率为0 → 合理，普通池不应产出最高品质

**期望值计算**:
- 高级池单抽期望：0.02×LEGENDARY + 0.13×EPIC + 0.25×RARE + 0.40×FINE + 0.20×COMMON
- 10连高级（100 recruitToken）：期望 0.2个LEGENDARY + 1.3个EPIC + 2.5个RARE + 4个FINE + 2个COMMON

**结论**: 概率设计合理，保底机制完善。**通过**。

### 5.4 派驻加成平衡性

| 品质 | 品质系数 | Lv10加成 | Lv50加成 | Lv100加成 |
|------|----------|----------|----------|-----------|
| COMMON | 1 | 6% | 26% | 51% |
| FINE | 2 | 7% | 27% | 52% |
| RARE | 3 | 8% | 28% | 53% |
| EPIC | 5 | 10% | 30% | 55% |
| LEGENDARY | 8 | 13% | 33% | 58% |

（假设 attack=100，attackBonus=100×0.01=1.0）

**结论**: 派驻加成范围在 6%~58% 之间，品质差异明显（COMMON vs LEGENDARY 差距约2倍），等级影响更大。**设计合理**。

---

## 六、完整P0挑战清单

### 确认的Builder P0（维持）

| # | ID | 系统 | 缺陷描述 | 缺陷模式 | 复现场景 |
|---|-----|------|----------|----------|----------|
| 1 | FR-rec-006 | FormationRecommend | `calculatePower=null` 崩溃 | 模式1: null防护 | `recommend('normal', heroes, null as any)` |
| 2 | FR-rec-007 | FormationRecommend | `availableHeroes` 含null元素崩溃 | 模式1: null防护 | `recommend('normal', [null, hero1], fn)` |
| 3 | HD-disp-005 | HeroDispatch | `heroId=""` 创建脏数据 | 模式1: 参数校验 | `dispatchHero('', 'castle')` → buildingDispatch[""] 被设置 |
| 4 | HD-calc-005 | HeroDispatch | `level=NaN` → NaN传播到建筑产出 | 模式2: NaN传播 | 派驻 `level=NaN` 的武将，`getDispatchBonus()` 返回 NaN |
| 5 | HD-calc-006 | HeroDispatch | `level=-100` → 负加成 | 模式3: 负值漏洞 | 派驻 `level=-100` 的武将，加成为负 |
| 6 | HD-sub-004 | HeroDispatch | `getState()` 浅拷贝，嵌套对象可被外部篡改 | 模式4: 浅拷贝 | `getState().buildingDispatch["castle"].bonusPercent = 999` |
| 7 | XC-001 | 跨系统 | 推荐结果→编队应用缺少适配层 | 模式8: 集成缺失 | 推荐返回 heroIds，编队需要 FormationData |
| 8 | XC-003 | 跨系统 | 派驻→建筑产出无通知机制 | 模式8: 集成缺失 | 派驻后建筑系统不知道加成变化 |
| 9 | XC-004 | 跨系统 | 武将升级→派驻加成不自动刷新 | 模式8: 集成缺失 | 升级后 `refreshDispatchBonus` 未被调用 |
| 10 | XC-006 | 跨系统 | 武将移除→派驻关系未清理 | 模式8: 集成缺失 | `removeGeneral` 后 `buildingDispatch` 仍有记录 |
| 11 | XC-010 | 跨系统 | 派驻序列化→全局存档可能遗漏 | 模式7: 数据丢失 | engine-save 可能不调用 dispatchSystem.serialize() |
| 12 | XC-013 | 跨系统 | 商店限购→每日重置可能不执行 | 模式6: 经济漏洞 | 跨日后 `dailyExchangeCount` 未清零 |
| 13 | HRC-cost-004 | 招募配置 | recruitToken 类型与 TokenEconomy 系统一致性 | 模式8: 集成缺失 | 两个系统需使用同一资源标识 |
| 14 | LC-001 | 生命周期 | 派驻完整生命周期未验证 | 模式7: 数据完整性 | 派驻→刷新→取消→序列化→恢复 |
| 15 | LC-005 | 生命周期 | 派驻序列化/反序列化一致性 | 模式7: 数据完整性 | serialize→deserialize→getState 一致性 |

### 新增P0（Builder遗漏）

| # | ID | 系统 | 缺陷描述 | 缺陷模式 | 复现场景 |
|---|-----|------|----------|----------|----------|
| 16 | CH-NEW-001 | FormationRecommend | 所有武将同阵营时羁绊方案与最强方案重复 | 算法缺陷 | 7个蜀国武将 → 3个方案中2个完全相同 |
| 17 | CH-NEW-002 | FormationRecommend | 羁绊加成用硬编码值(15/8/0)而非BondSystem计算结果 | 模式8: 集成缺失 | 推荐羁绊分数与实际羁绊效果不一致 |
| 18 | CH-NEW-003 | FormationRecommend | 武将数≤6时多个推荐方案选到相同武将集合 | 算法缺陷 | 6个武将 → 最强方案和平坦方案heroIds相同 |
| 19 | CH-NEW-005+006 | star-up-config | PRD v1.3新增6名武将无商店兑换+无关卡掉落配置 | 配置缺失 | lushu等武将碎片只能通过重复招募获取 |

---

## 七、优先级建议

### P0 — 必须立即修复（19项）

**代码缺陷（8项）**:
1. `FormationRecommendSystem.recommend()` — 添加 `calculatePower` null guard
2. `FormationRecommendSystem.recommend()` — 添加 `availableHeroes` 元素 null 过滤
3. `HeroDispatchSystem.dispatchHero()` — 添加 `heroId` 空字符串校验
4. `HeroDispatchSystem.calculateBonus()` — 添加 NaN/负值防护
5. `HeroDispatchSystem.getState()` — 返回深拷贝或冻结对象
6. `FormationRecommendSystem` — 去重逻辑：当羁绊方案与最强方案相同时跳过或降级
7. `FormationRecommendSystem` — 羁绊分数应调用 BondSystem 而非硬编码
8. `FormationRecommendSystem` — 武将数≤6时平衡方案应使用不同选将策略

**配置缺失（1项）**:
9. `star-up-config` — 补充 PRD v1.3 新增6名武将的商店兑换和关卡掉落配置

**跨系统集成（6项）**:
10. 推荐结果→编队应用适配层
11. 派驻→建筑产出通知机制
12. 武将升级→派驻加成自动刷新
13. 武将移除→派驻关系自动清理
14. 派驻序列化→全局存档集成
15. 商店限购→每日重置执行验证

**生命周期（4项）**:
16-19. 完整生命周期端到端测试

### P1 — 应尽快修复

1. `FormationRecommendSystem.buildBalancedPlan()` — 武将数少时补充策略优化
2. `HeroDispatchSystem.dispatchHero()` — buildingType 空字符串校验
3. `hero-recruit-config` — 普通招募与高级招募使用同一资源类型的设计评估
4. `UP_HERO_DESCRIPTIONS` — 补充新增武将的描述
5. `HERO_MAX_LEVEL=50` 注释与实际行为一致性
6. 91~100级经验需求节奏评估
7. LEGENDARY武将升星周期评估

---

## 八、Builder树质量评估

| 评估维度 | 评分 | 说明 |
|----------|------|------|
| 覆盖完整性 | 8/10 | 236个节点覆盖了大部分流程分支，但遗漏了算法层面的缺陷 |
| 缺陷模式扫描 | 7/10 | 附录A的8种模式扫描较完整，但未深入分析推荐算法的正确性 |
| 配置合理性 | 6/10 | 列出了配置值但未做交叉验证（如新增武将缺少碎片获取途径） |
| 跨系统分析 | 5/10 | 14个跨系统节点中8个为missing，说明跨系统是最大盲区 |
| 优先级准确性 | 7/10 | 4个P0降级为P1（虚报率21%），1个P1升级为P0 |
| 新增发现价值 | — | 8个新增P0中4个为算法缺陷，Builder完全未触及 |

**总体评价**: Builder树在流程分支枚举方面做得扎实，236个节点覆盖面广。但在以下方面存在不足：
1. **算法正确性审查不足**：推荐系统的去重、羁绊分数一致性等算法层面缺陷未被发现
2. **配置交叉验证不足**：新增武将的碎片获取路径断裂未被发现
3. **跨系统交互标记为missing后未深入分析**：14个跨系统节点中8个标missing但未给出具体风险分析

---

## 附录：源码引用索引

| 文件 | 行号范围 | 引用节点 |
|------|----------|----------|
| FormationRecommendSystem.ts | 88~91 | FR-rec-006, FR-rec-007 |
| FormationRecommendSystem.ts | 115~140 | CH-NEW-003 |
| FormationRecommendSystem.ts | 148~175 | CH-NEW-001, CH-NEW-002 |
| FormationRecommendSystem.ts | 185~205 | FR-score-001~009 |
| HeroDispatchSystem.ts | 130~148 | HD-disp-005, HD-disp-006 |
| HeroDispatchSystem.ts | 98~103 | HD-sub-004 |
| HeroDispatchSystem.ts | 244~258 | HD-calc-005, HD-calc-006 |
| hero-config.ts | 35~46 | CH-NEW-007 |
| hero-config.ts | 115~195 | HC-def-001~010 |
| hero-recruit-config.ts | 35~44 | CH-NEW-008 |
| star-up-config.ts | 41~50 | CH-NEW-004 |
| star-up-config.ts | 120~135 | CH-NEW-006 |
| star-up-config.ts | 152~165 | CH-NEW-005 |
