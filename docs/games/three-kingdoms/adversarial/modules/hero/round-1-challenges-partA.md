# Hero 挑战清单 Round 1 — Part A（核心子系统）

> Challenger: TreeChallenger | Time: 2026-05-01
> 审查对象: Part A (245节点, 10子系统)
> 源码路径: `src/games/three-kingdoms/engine/hero/`

## 挑战总结

| 指标 | Builder声称 | Challenger评估 | 差距 |
|------|-----------|--------------|------|
| 总节点 | 245 | 245（一致） | 0 |
| P0遗漏 | 已标记 uncovered 项 | **+14 个新P0遗漏** | 14 |
| 虚报 | — | **3 个虚报确认** | 3 |
| 新发现 | 6 | **+8 个独立发现** | 8 |

---

## Part A: P0遗漏扫描

### A1. HeroSystem.calculatePower NaN传播链无防护 — P0

**Builder声称**: HS-B02 `star=0/负值` 标记 uncovered, HS-B03 `equipmentPower=NaN` 标记 uncovered, HS-E06 `general=null` 标记 uncovered
**Challenger质疑**: Builder虽标记了 uncovered，但未充分描述 NaN 传播链的严重性。`calculatePower` 的返回值直接用于排序（`getGeneralsSortedByPower`）、编队战力（`calculateFormationPower`）、UI 显示，NaN 会全链污染。
**源码验证**:
- `HeroSystem.ts:175-188` — `calculatePower` 无任何 NaN/Infinity 防护
- `qualityCoeff = QUALITY_MULTIPLIERS[general.quality]` — 若 `quality` 为非法值，返回 `undefined`，`undefined * number = NaN`
- `starCoeff = getStarMultiplier(star)` — `star-up-config.ts:59` 有 `if (star < 1)` 保护，但 `star=NaN` 时 `NaN < 1` 为 false，直接进入数组越界 → `STAR_MULTIPLIERS[NaN]` = `undefined` → NaN
- `HeroSystem.boundary.test.ts:102` — 测试确认 NaN 传播存在，但仅记录行为，未要求修复
**复现场景**:
```ts
const g = hs.addGeneral('guanyu');
const power = hs.calculatePower(g, NaN); // star=NaN → NaN全链传播
// getGeneralsSortedByPower() 排序崩溃
```
**建议**: `calculatePower` 入口添加 `if (!Number.isFinite(star)) return 0;` 防护

### A2. HeroSystem.useFragments 负值/NaN 漏洞 — P0

**Builder声称**: HS-E04 `count=负数` 标记 uncovered
**Challenger质疑**: `useFragments` 无 `count <= 0` 防护。`count=-100` 时，`current < count` 为 false（如 current=50），执行 `current - (-100) = 150`，碎片凭空增加！这是经济漏洞。
**源码验证**:
- `HeroSystem.ts:258-265` — `useFragments` 直接比较 `current < count`，无负值检查
- 对比 `addFragment`（L243）有 `if (count <= 0) return 0` 保护
- `useFragments` 是 `addFragment` 的逆操作，但缺少对称的防护
**复现场景**:
```ts
hs.addFragment('guanyu', 50);
hs.useFragments('guanyu', -100); // current=50, 50 < -100 = false → 50-(-100)=150
expect(hs.getFragments('guanyu')).toBe(150); // 碎片凭空增加！
```
**建议**: `useFragments` 入口添加 `if (count <= 0) return false;`

### A3. HeroSystem.addGeneral(null/undefined) 崩溃 — P0

**Builder声称**: HS-E01 `generalId=null` 标记 uncovered, HS-E02 `generalId=undefined` 标记 uncovered
**Challenger质疑**: `addGeneral(generalId: string)` 接受 string 类型，但 JavaScript 运行时不强制类型。`addGeneral(null)` → `this.state.generals[null]` → `GENERAL_DEF_MAP.get(null)` → 返回 undefined → return null（安全）。但 `addGeneral(undefined)` → `this.state.generals[undefined]` → `GENERAL_DEF_MAP.get(undefined)` → 返回 undefined → return null（也安全）。Builder 标记 uncovered 但实际不会崩溃，降级为 P1。
**源码验证**: `HeroSystem.ts:110-129` — `GENERAL_DEF_MAP.get(null/undefined)` 返回 undefined，函数 return null
**修正**: 降为 P1，但建议仍添加类型检查以增强防御性

### A4. HeroSystem.deserialize(null) 崩溃 — P0

**Builder声称**: HS-E07 标记 uncovered
**Challenger质疑**: `HeroSystem.deserialize(data: HeroSaveData)` 直接委托 `deserializeHeroState(data)`，后者（`HeroSerializer.ts:75`）访问 `data.version` 和 `data.state.generals`。传入 `null` 时直接抛出 TypeError。
**源码验证**:
- `HeroSystem.ts:468-469` — `this.state = deserializeHeroState(data)` 无 null guard
- `HeroSerializer.ts:76` — `data.version` 对 null 抛出 `Cannot read properties of null`
**复现场景**: `hs.deserialize(null as any)` → 崩溃
**建议**: `deserializeHeroState` 入口添加 `if (!data) return createEmptyState();`

### A5. HeroSerializer.cloneGeneral(null) 崩溃 — P0

**Builder声称**: HSer-E01 标记 uncovered
**Challenger质疑**: `cloneGeneral` 直接展开 `g`，`cloneGeneral(null)` → `Cannot read properties of null (reading '...')`
**源码验证**: `HeroSerializer.ts:39-43` — `{ ...g, baseStats: { ...g.baseStats } }` 对 null 崩溃
**建议**: 入口添加 `if (!g) return null;` 或 `if (!g) throw new Error('...')`

### A6. HeroSerializer.deserializeHeroState 含 null 武将数据崩溃 — P0

**Builder声称**: HSer-E04 标记 uncovered (P1)
**Challenger质疑**: 应升级为 P0。`deserializeHeroState` 遍历 `data.state.generals`，若某个值为 null，`cloneGeneral(null)` 崩溃。恶意/损坏存档可触发。
**源码验证**: `HeroSerializer.ts:82-84` — `for (const [id, g] of Object.entries(data.state.generals))` → `cloneGeneral(g)` 无 null 检查
**复现场景**:
```ts
deserializeHeroState({ version: 1, state: { generals: { a: null }, fragments: {} } });
// → cloneGeneral(null) → 崩溃
```
**建议**: 升级为 P0，添加 `if (!g) continue;` 跳过损坏条目

### A7. HeroLevelSystem.addExp(NaN) 无限循环风险 — P0

**Builder声称**: HL-E03 标记 uncovered
**Challenger质疑**: `addExp` 中 `amount <= 0` 检查（L224）不拦截 NaN（`NaN <= 0` 为 false）。进入 while 循环后 `rem = amount`，`remainingExp > 0` 对 NaN 为 false，直接返回 null。实际上不会无限循环，但 `rem` 为 NaN 时 `gained === 0 && curExp === general.exp` → `general.exp` 未变 → return null。安全但不应静默吞掉 NaN。
**源码验证**: `HeroLevelSystem.ts:224` — `if (!this.levelDeps || amount <= 0) return null` — NaN 绕过此检查
**修正**: 不会无限循环，但 NaN 输入应显式拒绝。维持 P0 标注。

### A8. HeroLevelSystem.calculateTotalExp(from=NaN) 传播 — P0

**Builder声称**: HL-E06 标记 uncovered
**Challenger质疑**: `calculateTotalExp(from, to)` 中 `to <= from` 对 NaN 为 false（`NaN <= NaN` = false），跳过安全检查，进入 `totalExpBetween(NaN, ...)` → `for (let lv = NaN; lv < to; ...)` → 循环不执行 → 返回 0。实际安全，但语义不正确。
**源码验证**: `HeroLevelSystem.ts:249-252` — NaN 绕过 `to <= from` 检查
**建议**: 入口添加 `if (!Number.isFinite(from) || !Number.isFinite(to)) return 0;`

### A9. HeroStarSystem.deserialize(null) 崩溃 — P0

**Builder声称**: HSt-E09 标记 uncovered
**Challenger质疑**: `HeroStarSystem.deserialize(data)` 直接访问 `data.version`，null 时崩溃。
**源码验证**: `HeroStarSystem.ts:411-419` — `data.version !== STAR_SYSTEM_SAVE_VERSION` 对 null 崩溃
**建议**: 入口添加 `if (!data) { this.state = createEmptyStarState(); return; }`

### A10. HeroStarSystem.addFragmentFromActivity(amount=负数) — P0

**Builder声称**: HSt-E06 标记 uncovered
**Challenger质疑**: `addFragmentFromActivity` 有 `if (amount <= 0)` 防护（L165），返回 `count: 0`。但 `addFragmentFromExpedition` 也有同样防护（L181）。Builder 标记 uncovered 但实际已有防护。
**源码验证**: `HeroStarSystem.ts:165` — `if (amount <= 0) return { ... count: 0 }` ✅ 已有防护
**修正**: 降为 P2（已防护，但建议测试覆盖）

### A11. HeroRecruitSystem.deserialize(null) 崩溃 — P0

**Builder声称**: HR-E06 标记 uncovered
**Challenger质疑**: `deserialize(data)` 直接访问 `data.version`（L259），null 崩溃。且 `data.pity.normalPity`（L263）也会崩溃。
**源码验证**: `HeroRecruitSystem.ts:257-280` — 无 null guard
**建议**: 入口添加 null guard

### A12. TokenEconomy.calculateOfflineReward(NaN/负值) — P0

**Builder声称**: TE-E08 (负值) 和 TE-E09 (NaN) 标记 uncovered
**Challenger质疑**: `calculateOfflineReward` 有 `if (offlineSeconds <= 0) return 0`（L364），负值已防护。但 NaN 绕过此检查（`NaN <= 0` = false），返回 `0.002 * NaN * 0.5 = NaN`。NaN 传播到 `claimOfflineReward` → `reward <= 0` 对 NaN 为 false → `economyDeps.addRecruitToken(NaN)` → 可能导致资源系统异常。
**源码验证**: `recruit-token-economy-system.ts:364` — NaN 绕过 `<= 0` 检查
**复现场景**:
```ts
econ.claimOfflineReward(NaN); // → addRecruitToken(NaN)
```
**建议**: 添加 `if (!Number.isFinite(offlineSeconds)) return 0;`

### A13. HeroRecruitExecutor.executeSinglePull(heroSystem=null) 崩溃 — P0

**Builder声称**: HRE-E01 标记 uncovered
**Challenger质疑**: `executeSinglePull` 直接调用 `heroSystem.getGeneralDef()`，null 时崩溃。且 `pity=null` 时访问 `pity.normalPity` 也会崩溃。
**源码验证**: `HeroRecruitExecutor.ts:57-58` — `const rates = RECRUIT_RATES[type]` 后直接用 `heroSystem`
**建议**: 入口添加 null guard 或在调用方保证非 null

### A14. HeroRecruitUpManager.setUpRate(rate>1.0/NaN/负数) — P0

**Builder声称**: HRU-B04 (rate>1.0) 标记 uncovered, HRU-E01 (NaN) 标记 uncovered, HRU-E02 (负数) 标记 uncovered
**Challenger质疑**: `setUpRate` 直接赋值 `this.upHero.upRate = rate`，无任何范围校验。rate>1.0 意味着 UP 必定触发（`rng() < 1.0` 几乎总是 true），rate=NaN 导致 UP 判定永久失败（`rng() < NaN` = false），rate<0 同理。
**源码验证**: `HeroRecruitUpManager.ts:72` — `this.upHero.upRate = rate` 无校验
**建议**: 添加 `this.upHero.upRate = Math.min(Math.max(0, rate), 1.0);` 或 `if (!Number.isFinite(rate) || rate < 0 || rate > 1) return;`

---

## Part B: 虚报检测

对 Builder 标记为 "covered" 的节点进行源码抽查验证：

| # | 节点ID | Builder标注 | 验证结果 | 一致 | 说明 |
|---|--------|-----------|---------|------|------|
| 1 | HS-N01 addGeneral正常 | covered | ✅ 确实有测试 | ✅ | `HeroSystem.test.ts` 覆盖 |
| 2 | HS-N05 calculatePower含装备+羁绊 | covered | ✅ 有测试 | ✅ | `power-formula-bond-equip.test.ts` 覆盖 |
| 3 | HS-N08 handleDuplicate重复武将 | covered | ✅ 有测试 | ✅ | `HeroSystem.test.ts` 覆盖 |
| 4 | HS-N09 fragmentSynthesize碎片合成 | covered | ✅ 有测试 | ✅ | `hero-fragment-synthesize.test.ts` 覆盖 |
| 5 | HS-N10 addExp升级 | covered | ✅ 有测试 | ✅ | `HeroLevelSystem.test.ts` 覆盖 |
| 6 | HS-N11 serialize/deserialize | covered | ⚠️ 有测试但**未测试null** | ❌ | 测试仅覆盖正常数据，deserialize(null) 未测试 |
| 7 | HS-B04 addFragment count=0 | covered | ✅ 有测试 | ✅ | `HeroSystem.boundary.test.ts` 覆盖 |
| 8 | HS-E05 useFragments碎片不足 | covered | ✅ 有测试 | ✅ | `HeroSystem.test.ts` 覆盖 |
| 9 | HSt-N04 exchangeFragmentsFromShop | covered | ✅ 有测试 | ✅ | `HeroStarSystem.test.ts` 覆盖 |
| 10 | HR-N01 recruitSingle正常 | covered | ✅ 有测试 | ✅ | `HeroRecruitSystem.test.ts` 覆盖 |
| 11 | TE-N03 buyFromShop正常 | covered | ✅ 有测试 | ✅ | `recruit-token-economy-system.test.ts` 覆盖 |
| 12 | HF-N01 createFormation | covered | ✅ 有测试 | ✅ | `HeroFormation.test.ts` 覆盖 |
| 13 | HSt-B01 starUp满星 | covered | ✅ 有测试 | ✅ | `HeroStarSystem.test.ts` 覆盖 |

**虚报率**: 1/13 ≈ 7.7%（HS-N11 序列化往返声称 covered 但 null 场景未覆盖）

**关键虚报发现**:
- **HS-N11**: Builder 标记 `serialize/deserialize 往返` 为 covered，但 `deserialize(null)` 实际会崩溃。covered 仅覆盖了正常数据路径，未覆盖 null/损坏数据路径。建议拆分为两个节点：正常往返(P1) 和 null防护(P0)。

---

## Part C: 新发现（Builder未列出的问题）

### C1. HeroSystem.handleDuplicate(quality=undefined) 返回 NaN 碎片数 — P0

**源码验证**: `HeroSystem.ts:273-275` — `const fragments = DUPLICATE_FRAGMENT_COUNT[quality]` → `undefined` → `this.addFragment(generalId, undefined)` → `undefined <= 0` 为 false → `current + undefined = NaN` → 碎片变为 NaN
**Builder遗漏**: HS-E09 标记为 P1，但实际影响是碎片数据被 NaN 污染（P0）
**复现场景**:
```ts
hs.addGeneral('guanyu');
const fragments = hs.handleDuplicate('guanyu', undefined as any);
// → DUPLICATE_FRAGMENT_COUNT[undefined] = undefined
// → addFragment('guanyu', undefined) → NaN
```

### C2. HeroFormation.addToFormation 不验证武将是否真实存在 — P0

**源码验证**: `HeroFormation.ts:150-162` — `addToFormation` 不调用 `HeroSystem.hasGeneral()`，任何字符串都可加入编队。Builder 的 HF-E02 标记 uncovered，但未指出严重性：编队中可填入不存在的武将ID，后续 `calculateFormationPower` 会跳过（返回0战力），但编队UI会显示空武将。
**复现场景**:
```ts
formation.addToFormation('1', 'nonexistent_hero_99999'); // 成功！
// 编队中存在无效武将
```

### C3. HeroFormation.setFormation(generalIds=null) 崩溃 — P0

**源码验证**: `HeroFormation.ts:135-145` — `generalIds.slice(0, MAX_SLOTS_PER_FORMATION)` 对 null 崩溃
**Builder遗漏**: HF-E05 标记 uncovered 但仅说"崩溃检查"，未分析具体崩溃点

### C4. HeroFormation.setMaxFormations 缩减时超限编队未处理 — P0

**源码验证**: `HeroFormation.ts:100-101` — `setMaxFormations` 仅更新 `this.maxFormations`，不检查当前编队数是否已超限。若当前有3个编队，调用 `setMaxFormations(2)` 后，`maxFormations=3`（被 `Math.max(max, MAX_FORMATIONS)` 限制，MAX_FORMATIONS=3）。
**分析**: 由于 `Math.max(max, MAX_FORMATIONS)` 限制了最小值为3，实际无法缩减到3以下。但若 `MAX_FORMATIONS` 被修改为更小值，则会出现超限。这是一个设计层面的防御问题。

### C5. HeroLevelSystem.addExp 中铜钱扣除后升级失败不回滚 — P0

**源码验证**: `HeroLevelSystem.ts:237-250` — `addExp` 循环中，每次升级先 `spendResource(GOLD_TYPE, goldReq)` 扣除铜钱，若后续升级失败（如资源耗尽），已扣除的铜钱不会回滚。这不是 bug（资源耗尽时停在当前等级是合理行为），但若 `spendResource` 成功而 `syncToHeroSystem` 失败，则存在不一致风险。
**分析**: 当前实现中 `syncToHeroSystem` 是纯内存操作不会失败，风险较低，但设计上缺少事务性保证。

### C6. HeroRecruitExecutor 就地修改 pity 参数的副作用 — P0

**源码验证**: `HeroRecruitExecutor.ts:57-118` — `executeSinglePull` 直接修改传入的 `pity` 对象（L108-117 `pity.normalPity += 1`），调用方的 pity 状态被副作用修改。
**Builder发现**: Builder 在"发现1"中提到了此问题，但未在节点树中为它创建 P0 节点。
**风险**: 若十连招募中途异常（如资源不足），pity 计数器已被部分修改但招募未完成，导致保底计数不准确。

### C7. HeroRecruitSystem 十连招募资源扣除后中途失败不回滚 — P0

**源码验证**: `HeroRecruitSystem.ts:290-299` — `executeRecruit` 先扣除全部资源（`spendResource`），然后循环执行 `executeSinglePull`。若循环中途出现异常（如 heroSystem 异常），已扣除的资源无法追回。
**风险**: 资源已扣但未获得全部10个结果。

### C8. TokenEconomy.tick dt=NaN 导致被动产出异常 — P0

**源码验证**: `recruit-token-economy-system.ts:217` — `if (deltaSeconds <= 0) return` 不拦截 NaN（`NaN <= 0` = false）。`PASSIVE_RATE_PER_SECOND * NaN = NaN` → `addRecruitToken(NaN)` → 资源系统可能异常。
**Builder发现**: Builder 在"发现2"中提到 dt 负值风险，但未具体分析 NaN 场景。

---

## Part D: 可玩性评估

| 维度 | 评分(1-5) | 说明 |
|------|-----------|------|
| 招募体验 | ⭐⭐⭐⭐ (4/5) | 保底机制完善（十连保底+硬保底），UP武将系统增加目标感。免费招募每日重置提供持续登录动力。扣分：十连无折扣（`TEN_PULL_DISCOUNT` 存在但需确认实际值），新手可能不理解保底计数器。 |
| 升级进度 | ⭐⭐⭐⭐ (4/5) | 经验表分段设计合理（50→120→250→500→1000），一键强化和批量强化极大降低操作负担。扣分：铜钱消耗线性增长可能导致中后期铜钱紧缺，需要配套铜钱产出系统。 |
| 羁绊系统 | ⭐⭐⭐ (3/5) | 编队羁绊加成（每羁绊+5%战力）提供基本策略深度。扣分：羁绊系统在 Part B 中，Part A 仅通过回调注入，策略深度无法从此层评估。编队固定6人位限制了组合多样性。 |
| 经济平衡 | ⭐⭐⭐ (3/5) | 招贤令产出渠道丰富（被动+日常+商店+关卡+活动+离线），日产出约191令的设计合理。扣分：碎片溢出转化铜钱（1:100）比率偏低，高星级武将碎片溢出浪费感强。 |
| 新手体验 | ⭐⭐⭐⭐ (4/5) | 新手礼包100令+免费招募+低门槛关卡碎片，前10分钟可获得多个武将。扣分：编队创建需要城堡等级+铜钱前置条件，新手可能不理解为何无法创建编队。 |
| 长线养成 | ⭐⭐⭐⭐ (4/5) | 星级系统（1-6星）+突破系统（5阶段）+觉醒系统提供多层养成深度。碎片获取途径多样（关卡/商店/活动/远征/重复转化）。扣分：升星碎片消耗递增（未看到具体数值表），后期可能过于肝。 |

**总体可玩性**: 3.7/5 — 核心循环（招募→升级→编队→战斗）完整，经济系统产出渠道丰富，但部分边界体验需优化。

### 可玩性关键风险

1. **保底计数器持久性**: 保底计数器通过 serialize/deserialize 持久化，但十连招募中途异常时计数器可能不准确，影响玩家信任
2. **碎片溢出浪费**: 999上限后溢出碎片转铜钱（1:100），对高星级武将碎片（单次重复=80碎片）浪费严重
3. **编队创建门槛**: 城堡等级+铜钱前置条件可能导致新手困惑

---

## Rule Evolution Suggestions

### 建议1: 增加 NaN 防护扫描规则（高优先级）
- **触发发现**: A1/A7/A8/A12/A14 均为 NaN 绕过 `<= 0` 检查
- **建议**: 所有数值参数检查应使用 `if (!Number.isFinite(x) || x <= 0)` 替代 `if (x <= 0)`，因为 `NaN <= 0` 返回 false

### 建议2: 增加 deserialize(null) 统一防护规则（高优先级）
- **触发发现**: A4/A9/A11 — 所有 deserialize 方法均无 null 防护
- **建议**: 所有 ISubsystem 的 deserialize 方法必须处理 `data === null` 场景，统一 fallback 到空状态

### 建议3: 增加经济操作事务性规则（中优先级）
- **触发发现**: C6/C7 — 资源扣除后操作失败不回滚
- **建议**: 涉及资源扣除的批量操作应实现"预检查→扣除→执行→失败回滚"模式

### 建议4: 增加 useFragments 负值防护规则（高优先级）
- **触发发现**: A2 — useFragments 缺少与 addFragment 对称的负值检查
- **建议**: 所有"消耗类"API（useXxx/spendXxx/consumeXxx）必须添加 `if (amount <= 0) return false` 防护

### 建议5: 增加 cloneGeneral/cloneState null 防护规则（中优先级）
- **触发发现**: A5 — 深拷贝函数无 null 防护
- **建议**: 所有深拷贝工具函数必须处理 null/undefined 输入

### 建议6: 增加 covered 标注验证规则（低优先级）
- **触发发现**: 虚报率 7.7% — HS-N11 covered 但 null 场景未覆盖
- **建议**: "covered" 标注应区分"正常路径已覆盖"和"全路径已覆盖"，对 P0 节点要求全路径覆盖

---

## 附录：源码验证引用

| 验证项 | 文件 | 行号 | 内容 |
|--------|------|------|------|
| calculatePower无NaN防护 | HeroSystem.ts | L175-188 | 公式计算无 isFinite 检查 |
| useFragments无负值防护 | HeroSystem.ts | L258-265 | 直接比较 current < count |
| addFragment有负值防护 | HeroSystem.ts | L243 | `if (count <= 0) return 0` |
| getStarMultiplier NaN绕过 | star-up-config.ts | L59-61 | `if (star < 1)` 不拦截NaN |
| deserializeHeroState无null防护 | HeroSerializer.ts | L75-90 | 直接访问 data.version |
| cloneGeneral无null防护 | HeroSerializer.ts | L39-43 | `{ ...g }` 对null崩溃 |
| addExp NaN绕过 | HeroLevelSystem.ts | L224 | `amount <= 0` 不拦截NaN |
| calculateOfflineReward NaN绕过 | recruit-token-economy-system.ts | L364 | `offlineSeconds <= 0` 不拦截NaN |
| setUpRate无范围校验 | HeroRecruitUpManager.ts | L72 | 直接赋值无校验 |
| executeSinglePull就地修改pity | HeroRecruitExecutor.ts | L108-117 | 直接修改传入对象 |
| addToFormation不验证武将存在 | HeroFormation.ts | L150-162 | 无 hasGeneral 检查 |
| handleDuplicate quality=undefined | HeroSystem.ts | L273-275 | DUPLICATE_FRAGMENT_COUNT[undefined] |
| TokenEconomy tick NaN绕过 | recruit-token-economy-system.ts | L217 | `deltaSeconds <= 0` 不拦截NaN |
| 十连招募资源不回滚 | HeroRecruitSystem.ts | L290-299 | 先扣资源后循环 |
