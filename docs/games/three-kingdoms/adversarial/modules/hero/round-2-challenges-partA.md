# Hero 挑战清单 Round 2 — Part A（核心系统验证）

> Challenger: TreeChallenger v1.1 | Time: 2026-05-01
> 审查对象: FIX-001/FIX-002/FIX-003 修复验证 + 核心系统新问题扫描

## 一、R1修复验证

### FIX-001: NaN 绕过 <= 0 检查 — ✅ 已修复，但有遗漏

| 检查点 | 位置 | 修复状态 | 遗漏 |
|--------|------|---------|------|
| HeroSystem.addFragment | L243 | ✅ `!Number.isFinite(count) \|\| count <= 0` | 无 |
| HeroSystem.useFragments | L259 | ✅ `!Number.isFinite(count) \|\| count <= 0` | 无 |
| HeroLevelSystem.addExp | L224 | ✅ `!Number.isFinite(amount) \|\| amount <= 0` | 无 |
| TokenEconomy.tick | L217 | ✅ `!Number.isFinite(deltaSeconds) \|\| deltaSeconds <= 0` | 无 |
| TokenEconomy.buyFromShop | L282 | ✅ `!Number.isFinite(count) \|\| count <= 0` | 无 |
| TokenEconomy.calculateOfflineReward | L364 | ✅ `!Number.isFinite(offlineSeconds) \|\| offlineSeconds <= 0` | 无 |
| HeroStarSystem.exchangeFragmentsFromShop | L124 | ✅ `!Number.isFinite(count) \|\| count <= 0` | 无 |
| HeroStarSystem.addFragmentFromActivity | L165 | ✅ `!Number.isFinite(amount) \|\| amount <= 0` | 无 |
| HeroStarSystem.addFragmentFromExpedition | L181 | ✅ `!Number.isFinite(amount) \|\| amount <= 0` | 无 |
| HeroStarSystem.getLevelCap | L300 | ✅ `!Number.isFinite(stage) \|\| stage <= 0` | 无 |

**遗漏发现**：

| # | 位置 | 遗漏描述 | 严重程度 |
|---|------|---------|---------|
| R2-A001 | star-up-config.ts:58 `getStarMultiplier` | `star < 1` 不拦截 NaN（`NaN < 1` = false），`STAR_MULTIPLIERS[NaN]` = `undefined` → calculatePower 返回 NaN | **P0** |
| R2-A002 | HeroSystem.ts:183 `calculatePower` | `QUALITY_MULTIPLIERS[general.quality]` — 若 quality 为非法值返回 `undefined`，导致 qualityCoeff=undefined → 战力 NaN | **P0** |
| R2-A003 | HeroSystem.ts:185 `calculatePower` | `getStarMultiplier(star)` — star=NaN 时返回 undefined（见R2-A001），starCoeff=undefined → 战力 NaN | **P0**（与R2-A001同源） |

**结论**：FIX-001 修复了调用方的参数检查，但未修复底层工具函数 `getStarMultiplier` 本身的 NaN 防护。calculatePower 内部仍有3处 NaN 传播入口。

### FIX-002: useFragments 负值漏洞 — ✅ 完全修复

| 检查点 | 位置 | 修复状态 |
|--------|------|---------|
| useFragments 入口检查 | L259 | ✅ `!Number.isFinite(count) \|\| count <= 0` |
| 负值被拒绝 | — | ✅ `count=-100` → return false |
| NaN 被拒绝 | — | ✅ `count=NaN` → return false |
| Infinity 被拒绝 | — | ✅ `count=Infinity` → return false |
| 正常消耗不受影响 | — | ✅ 正常路径仍工作 |

**结论**：FIX-002 修复完整，无遗漏。

### FIX-003: deserialize(null) 系统性缺失 — ✅ 已修复，但有遗漏

| 检查点 | 位置 | 修复状态 | 遗漏 |
|--------|------|---------|------|
| HeroSystem.deserialize | L469 | ✅ `if (!data) { this.state = createEmptyState(); return; }` | 无 |
| HeroSerializer.deserializeHeroState | L75 | ✅ `if (!data \|\| !data.state) return createEmptyState();` | **见R2-A004** |
| HeroRecruitSystem.deserialize | L257 | ✅ 完整null guard + 默认值重建 | 无 |
| HeroStarSystem.deserialize | L411 | ✅ null guard + 默认状态 | 无 |
| AwakeningSystem.deserialize | L390 | ✅ `if (!data \|\| !data.state)` | 无 |
| TokenEconomy.deserialize | L453 | ✅ 完整默认字段重建 | 无 |
| HeroFormation.deserialize | L404 | ✅ `if (!data?.state)` | 无 |
| HeroDispatchSystem.deserialize | L277 | ✅ `if (!json) { this.reset(); return; }` | 无 |
| HeroRecruitUpManager.deserializeUpHero | L86 | ✅ `if (!data)` → 默认值 | 无 |

**遗漏发现**：

| # | 位置 | 遗漏描述 | 严重程度 |
|---|------|---------|---------|
| R2-A004 | HeroSerializer.ts:89 | `deserializeHeroState` 遍历 `data.state.generals` 时，如果某个值为 `null`（损坏存档），`cloneGeneral(null)` 会崩溃。缺少 `if (!g) continue;` 防护 | **P0** |
| R2-A005 | HeroSerializer.ts:32 | `cloneGeneral(g)` 无 null guard — `{ ...null }` 在 JS 中返回 `{}`，但 `g.baseStats` 访问会返回 undefined 而非崩溃（`{ ...null }.baseStats` = undefined）。但 `g.skills.map(...)` 会崩溃（`undefined.map is not a function`） | **P0** |

**结论**：FIX-003 修复了顶层的 null guard，但 `deserializeHeroState` 内部遍历武将数据时未防护 null 元素。

### FIX-004: FormationRecommendSystem null guard — ✅ 完全修复

| 检查点 | 位置 | 修复状态 |
|--------|------|---------|
| availableHeroes null 防护 | L119 | ✅ `(availableHeroes ?? []).filter(h => h != null)` |
| calculatePower 返回值 NaN 防护 | L122 | ✅ `Number.isFinite(power) ? power : 0` |
| null 数组不崩溃 | — | ✅ |
| 含 null 元素数组不崩溃 | — | ✅ |

**结论**：FIX-004 修复完整，无遗漏。

---

## 二、新发现问题

### R2-A006: calculatePower 无 NaN 输出防护 — P0

**位置**：`HeroSystem.ts:175-188`

**问题**：`calculatePower` 函数内部有多处 NaN 传播入口（见R2-A001/A002/A003），但函数返回值没有最终的 NaN 防护。如果任何中间计算产生 NaN，整个战力计算返回 NaN。

**传播链**：
1. `qualityCoeff = QUALITY_MULTIPLIERS[general.quality]` → undefined（非法 quality）
2. `starCoeff = getStarMultiplier(star)` → undefined（NaN star）
3. `equipPower = this._getEquipmentPower?.(general.id)` → NaN（回调返回NaN）
4. `Math.floor(statsPower * levelCoeff * qualityCoeff * starCoeff * equipmentCoeff * bondCoeff)` → NaN

**影响范围**：
- `getGeneralsSortedByPower()` 排序崩溃（NaN 比较无意义）
- `calculateFormationPower()` 编队战力为 NaN
- UI 显示 NaN
- 推荐算法使用 NaN 战力排序

**建议**：在 `calculatePower` 末尾添加 `return Number.isFinite(result) ? result : 0;`

### R2-A007: setBondMultiplierGetter 从未被调用 — P0（R1遗留）

**位置**：`ThreeKingdomsEngine.ts` + `engine-hero-deps.ts`

**源码验证**：
- `HeroSystem.ts:74` 定义了 `setBondMultiplierGetter(fn)` 接口
- `engine-hero-deps.ts` 的 `initHeroSystems` 中**没有调用** `setBondMultiplierGetter`
- `ThreeKingdomsEngine.ts` 中**没有调用** `setBondMultiplierGetter`
- 全代码库搜索：仅在测试文件中调用

**影响**：羁绊系数始终为默认值 1.0，编队战力计算中羁绊乘区形同虚设。

### R2-A008: setEquipmentPowerGetter 从未被调用 — P0（新发现）

**位置**：`ThreeKingdomsEngine.ts` + `engine-hero-deps.ts`

**源码验证**：
- `HeroSystem.ts:52` 定义了 `_getEquipmentPower` 私有字段
- `HeroSystem.ts:70` 定义了 `setEquipmentPowerGetter(fn)` 接口
- `engine-hero-deps.ts` 的 `initHeroSystems` 中**没有调用** `setEquipmentPowerGetter`
- `ThreeKingdomsEngine.ts` 中**没有调用** `setEquipmentPowerGetter`

**影响**：装备战力始终为 0（fallback），战力公式中装备系数永远为 `1 + 0/1000 = 1.0`。装备对战力的影响完全失效。

### R2-A009: handleDuplicate quality=undefined 间接修复确认 — P1（已通过FIX-001间接修复）

**位置**：`HeroSystem.ts:281`

**分析**：
- `DUPLICATE_FRAGMENT_COUNT[undefined]` = `undefined`
- `this.addFragment(generalId, undefined)` → FIX-001修复后，`!Number.isFinite(undefined)` = true → return 0
- 返回 `fragments = undefined`

**残留风险**：`handleDuplicate` 返回 `undefined` 而非 `0`，调用方如果依赖返回值做计算可能出问题。

### R2-A010: setUpRate 仍无范围校验 — P1（R1遗留）

**位置**：`HeroRecruitUpManager.ts:72`

**源码验证**：`this.upHero.upRate = rate;` — 仍然直接赋值，无任何范围校验。

**影响**：
- `rate > 1.0` → UP 必定触发
- `rate < 0` → UP 永不触发
- `rate = NaN` → UP 永不触发（`rng() < NaN` = false）

### R2-A011: TokenEconomy.deserialize 缺少 addRecruitToken 回调验证 — P1

**位置**：`recruit-token-economy-system.ts`

**问题**：`deserialize` 恢复了 `newbiePackClaimed`、`dailyTaskClaimed` 等状态，但没有验证 `economyDeps.addRecruitToken` 回调是否仍然有效。如果反序列化在 `init(deps)` 之前被调用，`economyDeps` 为 null，后续 tick 会静默失败。

### R2-A012: HeroLevelSystem.calculateTotalExp NaN 绕过 — P1（R1遗留）

**位置**：`HeroLevelSystem.ts:249-252`

**源码验证**：`to <= from` 对 NaN 为 false（`NaN <= NaN` = false），跳过安全检查。虽然实际返回0（循环不执行），但语义不正确。

---

## 三、Part A 统计

| 类别 | 数量 |
|------|------|
| R1修复验证通过 | 4/4 |
| 修复遗漏（P0） | 5 |
| 新发现（P0） | 3 |
| 新发现（P1） | 4 |
| R1遗留未修复 | 3 |

---

*Part A 审查完成。*
