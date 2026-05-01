# Heritage R1 Challenger Report

> Challenger: v1.8 | 模块: heritage | 时间: 2026-05-01
> 源码: 4 文件 / ~713 行 | API: 22 | 入口点: 14

## 总览

| 指标 | 数值 |
|------|------|
| 总质疑数 | 22 |
| P0 确认 | 16 |
| P0 虚报 | 0 |
| P1 提升 | 6 |
| 虚报率 | 0% |
| 系统性缺陷 | NaN传播链（影响14个API入口）+ loadSaveData null崩溃 |

---

## F-Normal: 正常路径质疑

### CH-001 | executeHeroHeritage NaN传播到目标武将exp

- **严重度**: 🔴 P0
- **源码**: `HeritageSystem.ts:155-162`
- **质疑**: `transferredExp = Math.floor(source.exp * efficiency * request.options.expEfficiency)`。当 `source.exp=NaN` 时，`transferredExp=NaN`，`newTargetExp = target.exp + NaN = NaN`。随后 `updateHeroCallback?.(target.id, { exp: NaN })` 将NaN写入目标武将经验值，永久破坏该武将数据。
- **复现场景**:
  1. 通过 deserialize 注入 `source.exp = NaN`
  2. 调用 `executeHeroHeritage({ sourceHeroId, targetHeroId, options: { expEfficiency: 0.8, ... } })`
  3. 目标武将 exp 变为 NaN
  4. 后续所有依赖 exp 的计算（升级、战斗）全部NaN
- **影响**: 武将数据永久损坏
- **修复建议**: 在计算前检查 `!Number.isFinite(source.exp)` 或 `!Number.isFinite(request.options.expEfficiency)` → 返回失败

### CH-002 | executeEquipmentHeritage NaN传播到目标装备enhanceLevel

- **严重度**: 🔴 P0
- **源码**: `HeritageSystem.ts:193-201`
- **质疑**: `rawLevel = source.enhanceLevel`（当 transferEnhanceLevel=true），`transferredLevel = Math.max(0, rawLevel - EQUIPMENT_HERITAGE_RULE.levelLoss)`。当 `source.enhanceLevel=NaN` 时，`rawLevel=NaN`，`Math.max(0, NaN) = NaN`（Math.max对NaN返回NaN），`finalLevel = Math.floor(NaN * efficiency) = NaN`。`updateEquipCallback?.(target.uid, { enhanceLevel: NaN })` 损坏目标装备。
- **复现场景**:
  1. deserialize 注入 `source.enhanceLevel = NaN`
  2. 调用 `executeEquipmentHeritage({ sourceUid, targetUid, options: { transferEnhanceLevel: true, ... } })`
  3. 目标装备 enhanceLevel 变为 NaN
- **影响**: 装备数据永久损坏
- **修复建议**: 检查 `!Number.isFinite(source.enhanceLevel)` → 返回失败

### CH-003 | executeExperienceHeritage NaN传播到源和目标武将exp

- **严重度**: 🔴 P0
- **源码**: `HeritageSystem.ts:237-248`
- **质疑**: `rawExp = source.exp * ratio`，当 `source.exp=NaN` 或 `request.expRatio=NaN` 时，`rawExp=NaN`，`transferredExp=NaN`。`newSourceExp = source.exp - Math.floor(NaN) = NaN`，`newTargetExp = target.exp + NaN = NaN`。**同时损坏源和目标两个武将**。
- **复现场景**:
  1. `request.expRatio = NaN`
  2. `rawExp = source.exp * NaN = NaN`
  3. 源武将 exp 和目标武将 exp 同时变为 NaN
- **影响**: 双武将数据同时损坏
- **修复建议**: 检查 `!Number.isFinite(source.exp) || !Number.isFinite(request.expRatio)` → 返回失败

### CH-004 | copperCost NaN传播到资源系统

- **严重度**: 🔴 P0
- **源码**: `HeritageSystem.ts:163, 207, 245`
- **质疑**: 三个传承API均有 `this.addResourcesCallback?.({ copper: -copperCost })`。当 `source.level=NaN`（武将传承/经验传承）或 `rawLevel=NaN`（装备传承）时，`copperCost=NaN`，`addResources({ copper: NaN })` 将NaN注入资源系统。
- **复现场景**:
  1. `source.level = NaN`（通过deserialize注入）
  2. 任意传承API被调用
  3. `copperCost = NaN * 500 = NaN`（武将传承）
  4. `addResources({ copper: NaN })` → 资源系统copper变为NaN
- **影响**: 经济系统全面崩溃
- **修复建议**: 在 addResources 调用前检查 `!Number.isFinite(copperCost)` → 返回失败

### CH-005 | loadSaveData null崩溃

- **严重度**: 🔴 P0
- **源码**: `HeritageSystem.ts:267`
- **质疑**: `loadSaveData(data: HeritageSaveData)` 直接执行 `this.state = { ...data.state }`。当 `data=null` 或 `data=undefined` 时，`data.state` 抛出 `TypeError: Cannot read properties of null (reading 'state')`。当 `data.state=null` 时，展开运算符 `{ ...null }` 返回 `{}`，导致所有state字段丢失。
- **复现场景**:
  1. `system.loadSaveData(null as any)` → TypeError 崩溃
  2. `system.loadSaveData({ version: 1, state: null as any })` → state 变为空对象，所有计数器丢失
- **影响**: 游戏加载崩溃或数据丢失
- **修复建议**: 添加 null guard: `if (!data?.state) { this.reset(); return; }`

### CH-006 | loadSaveData NaN注入state

- **严重度**: 🔴 P0
- **源码**: `HeritageSystem.ts:267-269`
- **质疑**: `this.state = { ...data.state }` 直接展开，不验证字段值。如果 `data.state.dailyHeritageCount = NaN` 或 `data.state.heroHeritageCount = NaN`，NaN直接注入state。后续 `dailyHeritageCount >= DAILY_HERITAGE_LIMIT` → `NaN >= 10` → false，**绕过每日限制检查**（规则21教训）。
- **复现场景**:
  1. 存档文件被篡改：`{ state: { dailyHeritageCount: NaN, ... } }`
  2. `loadSaveData` 加载后 state.dailyHeritageCount = NaN
  3. `NaN >= 10` → false → 每日限制被绕过
  4. 玩家可无限传承
- **影响**: 每日限制完全失效
- **修复建议**: loadSaveData 中验证所有数值字段 `Number.isFinite`

### CH-007 | simulateEarnings NaN传播到收益预测

- **严重度**: 🔴 P0
- **源码**: `HeritageSimulation.ts:158-180`
- **质疑**: `calcEarnings` 中 `dailyHours / 4`，当 `dailyOnlineHours=NaN` 时，所有收益计算为NaN。`confidence = Math.min(1, NaN/8) = NaN`。整个模拟结果不可用。
- **复现场景**:
  1. `simulateEarnings({ dailyOnlineHours: NaN, ... })`
  2. 所有 earnings 字段为 NaN
  3. confidence 为 NaN
- **影响**: 模拟器输出完全不可用（不崩溃但数据无意义）
- **修复建议**: 入口检查 `!Number.isFinite(params.dailyOnlineHours)` → 返回安全默认值

### CH-008 | simulateEarnings calcRebirthMultiplier(NaN)跨系统传播

- **严重度**: 🔴 P0
- **源码**: `HeritageSimulation.ts:159`
- **质疑**: `calcRebirthMultiplier(params.currentRebirthCount + 1)`，当 `currentRebirthCount=NaN` 时，`NaN + 1 = NaN`，调用 `calcRebirthMultiplierFromConfig(NaN)`。该函数可能返回NaN或异常值，导致 `immediateMultiplier=NaN`，所有收益计算为NaN。
- **复现场景**:
  1. `simulateEarnings({ currentRebirthCount: NaN, ... })`
  2. multiplier = NaN → 所有 earnings = NaN
- **影响**: 跨系统NaN传播（Heritage→Prestige）
- **修复建议**: 入口检查 `!Number.isFinite(params.currentRebirthCount)`

### CH-009 | getSaveData 序列化NaN

- **严重度**: 🔴 P0
- **源码**: `HeritageSystem.ts:273`
- **质疑**: `getSaveData()` 直接返回 `{ ...this.state }` 和 `{ ...this.accelState }`。如果 state 中任何数值为 NaN（通过上述CH-006注入或CH-001/003传播），`JSON.stringify({ value: NaN })` → `"{"value":null}"`。反序列化后 NaN 变为 null，后续 `null + 100 = 100`（看似安全但逻辑错误）。
- **复现场景**:
  1. state.dailyHeritageCount = NaN（通过CH-006注入）
  2. `getSaveData()` → `{ state: { dailyHeritageCount: NaN } }`
  3. `JSON.stringify()` → `{ "dailyHeritageCount": null }`
  4. 加载后 `null`，后续 `null >= 10` → false → 限制绕过
- **影响**: NaN→null转换导致逻辑错误
- **修复建议**: getSaveData 中验证数值字段，NaN替换为安全默认值

---

## F-Boundary: 边界条件质疑

### CH-010 | executeExperienceHeritage expRatio负数

- **严重度**: 🟡 P1
- **源码**: `HeritageSystem.ts:234`
- **质疑**: `const ratio = Math.min(request.expRatio, EXPERIENCE_HERITAGE_RULE.maxExpRatio)`。当 `expRatio = -1` 时，`ratio = Math.min(-1, 0.8) = -1`。`rawExp = source.exp * (-1) = -source.exp`。`transferredExp = Math.floor(-source.exp * 0.7) = 负数`。`newTargetExp = target.exp + 负数` → 目标经验减少！`newSourceExp = source.exp - Math.floor(-source.exp) = source.exp + source.exp = 2*source.exp` → 源经验翻倍！
- **复现场景**:
  1. `request.expRatio = -1`
  2. 目标武将经验减少，源武将经验增加
- **影响**: 经验复制漏洞
- **修复建议**: 添加 `ratio = Math.max(0, ratio)` 或检查 `expRatio < 0`

### CH-011 | executeExperienceHeritage newSourceExp可能为负

- **严重度**: 🟡 P1
- **源码**: `HeritageSystem.ts:242`
- **质疑**: `newSourceExp = source.exp - Math.floor(rawExp)`。当 `ratio` 接近 `maxExpRatio=0.8` 且 `efficiency=0.7` 时，`rawExp = source.exp * 0.8`，`Math.floor(rawExp)` 可能等于 `source.exp`（当exp很小时）。此时 `newSourceExp = 0`，这是安全的。但如果 `expRatio` 未被裁剪且 > 1（外部直接传入），`newSourceExp` 可能为负。
- **影响**: 低风险（有 maxExpRatio 裁剪），但缺少显式 Math.max(0, ...) 防护

### CH-012 | executeEquipmentHeritage rarityDiff NaN获得最优效率

- **严重度**: 🟡 P1
- **源码**: `HeritageSystem.ts:198-204`
- **质疑**: rarityDiff 分支只处理 -2, -1, 0, 1, >=2 五种情况。如果 `source.rarity` 或 `target.rarity` 为 NaN，`rarityDiff = NaN`，所有条件判断 `NaN === 0` → false，最终 `efficiency = RARITY_DIFF_EFFICIENCY['lower_2'] = 1.2`。NaN输入意外获得最高效率。
- **影响**: NaN输入获得最优效率（逻辑错误但不崩溃）

### CH-013 | instantUpgrade getRebirthCount未注入 → 永远无法升级

- **严重度**: 🔴 P0
- **源码**: `HeritageSimulation.ts:95-97`
- **质疑**: `rebirthCount = callbacks.getRebirthCount?.() ?? 0`，`maxInstantUpgrades = rebirthCount * INSTANT_UPGRADE_COUNT_PER_REBIRTH`。当 `getRebirthCount` 回调未注入（undefined）时，`rebirthCount=0`，`maxInstantUpgrades=0`。`accelState.instantUpgradeCount(初始0) >= 0` → true → 永远返回"瞬间升级次数已用完"。
- **复现场景**:
  1. 未调用 `setCallbacks` 或 `callbacks.getRebirthCount` 未提供
  2. 调用 `instantUpgrade('farm')` → 永远失败
- **影响**: 功能完全不可用（无错误提示说明原因）
- **修复建议**: 当 rebirthCount=0 时返回更明确的错误信息"转生数据不可用"

### CH-014 | claimInitialGift resources硬编码不含gold

- **严重度**: 🟡 P1
- **源码**: `HeritageSimulation.ts:34-37`
- **质疑**: `resources = { grain, copper, enhanceStone }` 但 `SIMULATION_BASE_DAILY` 含 `gold`。初始赠送不含gold，但模拟器以gold计算收益。配置不一致。
- **影响**: 配置不一致（低风险，设计选择）

### CH-015 | executeRebuild config合并空数组覆盖默认

- **严重度**: 🟡 P1
- **源码**: `HeritageSimulation.ts:68`
- **质疑**: `const cfg = { ...DEFAULT_REBUILD_CONFIG, ...config }`。当 `config.buildingPriority` 为空数组 `[]` 时，覆盖默认优先级，导致不升级任何建筑。返回 `{ success: true, upgradedBuildings: [] }` — "成功"但实际什么都没做。
- **影响**: 语义不一致（成功但无效果）

---

## F-Error: 错误路径质疑

### CH-016 | executeHeroHeritage 回调异常未捕获

- **严重度**: 🟡 P1
- **源码**: `HeritageSystem.ts:155-165`
- **质疑**: `this.updateHeroCallback?.(target.id, { exp: newTargetExp })` 如果回调内部抛出异常（如目标武将不存在于数据库），异常会传播到调用方。但 `addResourcesCallback?.({ copper: -copperCost })` 在 updateHero 之后执行，如果 updateHero 抛异常，资源不会被扣除（好），但前面的 updateHero 已经部分执行（如果回调内部有多步操作）。
- **影响**: 回调异常可能导致部分状态更新

### CH-017 | recordHeritage 在 addResources 之后调用

- **严重度**: 🟡 P1
- **源码**: `HeritageSystem.ts:279-289`
- **质疑**: `recordHeritage` 在 `addResourcesCallback` 之后调用。如果 `addResourcesCallback` 抛出异常，`recordHeritage` 不会被调用，传承记录丢失。但武将/装备已经被修改（updateHero/updateEquip已执行），形成不一致：武将数据已变但无传承记录。
- **影响**: 传承记录与实际状态不一致

### CH-018 | setCallbacks后addResources未注入 → 免费传承

- **严重度**: 🟡 P1
- **源码**: `HeritageSystem.ts:103-111`
- **质疑**: `setCallbacks` 允许部分回调不传入。后续代码使用 `this.heroCallback?.(id)` 的可选链，返回 undefined 时走 null 检查路径（安全）。但 `this.addResourcesCallback?.({ copper: -copperCost })` 使用可选链，当回调未注入时静默跳过资源扣除 — 传承成功但不扣费。
- **复现场景**:
  1. `setCallbacks({ getHero, updateHero })` — 不传 addResources
  2. `executeHeroHeritage(...)` → 成功
  3. `addResourcesCallback?.({ copper: -500 })` → undefined → 不扣费
- **影响**: 免费传承漏洞
- **修复建议**: 在执行传承前检查必要回调是否已注入

---

## F-Cross: 跨系统交互质疑

### CH-019 | Heritage→Prestige calcRebirthMultiplier Infinity传播

- **严重度**: 🔴 P0
- **源码**: `HeritageSimulation.ts:18, 159`
- **质疑**: `simulateEarnings` 调用 `calcRebirthMultiplier`（来自 prestige/RebirthSystem）。如果 RebirthSystem 未初始化或 calcRebirthMultiplier 返回异常值（如 Infinity），`SIMULATION_BASE_DAILY.gold * Infinity = Infinity`，`Math.floor(Infinity) = Infinity`。收益结果含 Infinity，JSON序列化为 null。
- **影响**: 跨系统Infinity传播
- **修复建议**: 对 multiplier 结果检查 `!Number.isFinite(multiplier)` → 返回安全默认值

### CH-020 | Heritage↔Engine 存档集成缺失验证

- **严重度**: 🔴 P0
- **源码**: `HeritageSystem.ts:267-274`
- **质疑**: `loadSaveData` 和 `getSaveData` 存在，但未验证是否被 engine 的 buildSaveData/applySaveData 调用。根据规则14（BR-023教训），需要验证六处同步：GameSaveData、SaveContext、buildSaveData、toIGameState、fromIGameState、applySaveData。
- **影响**: 可能遗漏存档集成导致传承数据丢失
- **修复建议**: 检查 engine 层是否正确调用 heritage.getSaveData/loadSaveData

### CH-021 | Heritage↔Calendar 日期重置时区问题

- **严重度**: 🟡 P1
- **源码**: `HeritageHelpers.ts:33`
- **质疑**: `getTodayStr()` 使用 `new Date().toISOString().slice(0, 10)` 返回 UTC 日期。如果 Calendar 系统使用本地时间，可能导致日期不一致。例如北京时间凌晨1点（UTC 17:00），getTodayStr 返回昨天日期，但 Calendar 认为是今天 → 每日重置不触发。
- **影响**: 时区差异可能导致每日重置延迟/提前
- **修复建议**: 统一使用 Calendar 系统的日期方法

---

## F-Lifecycle: 数据生命周期质疑

### CH-022 | getMemorialRecord heritageHistory无限增长

- **严重度**: 🟡 P1
- **源码**: `HeritageSystem.ts:291-294`
- **质疑**: `heritageHistory` 是一个数组，每次传承 push 一条记录，无上限。长期游戏中（10000次传承），该数组持续增长，占用内存且影响序列化性能。`getMemorialRecord` 返回完整历史映射，可能产生大量临时对象。
- **影响**: 内存泄漏风险（长期游戏）
- **修复建议**: 添加上限常量 `MAX_HERITAGE_HISTORY = 1000`，超出时裁剪最旧记录

---

## P0 汇总

| # | ID | 问题 | 根因 | 修复文件 |
|---|-----|------|------|---------|
| 1 | CH-001 | executeHeroHeritage NaN→目标exp | source.exp无NaN防护 | HeritageSystem.ts |
| 2 | CH-002 | executeEquipmentHeritage NaN→目标enhanceLevel | source.enhanceLevel无NaN防护 | HeritageSystem.ts |
| 3 | CH-003 | executeExperienceHeritage NaN→双武将exp | source.exp/expRatio无NaN防护 | HeritageSystem.ts |
| 4 | CH-004 | copperCost NaN→资源系统 | level无NaN防护 | HeritageSystem.ts |
| 5 | CH-005 | loadSaveData null崩溃 | 无null guard | HeritageSystem.ts |
| 6 | CH-006 | loadSaveData NaN注入state | 无字段验证 | HeritageSystem.ts |
| 7 | CH-007 | simulateEarnings NaN→收益全NaN | dailyOnlineHours无NaN防护 | HeritageSimulation.ts |
| 8 | CH-008 | simulateEarnings NaN→跨系统传播 | currentRebirthCount无NaN防护 | HeritageSimulation.ts |
| 9 | CH-009 | getSaveData 序列化NaN | 无NaN检查 | HeritageSystem.ts |
| 10 | CH-013 | instantUpgrade 回调未注入→永远失败 | getRebirthCount默认0 | HeritageSimulation.ts |
| 11 | CH-019 | calcRebirthMultiplier Infinity传播 | multiplier无上限检查 | HeritageSimulation.ts |
| 12 | CH-020 | 存档集成可能缺失 | 未验证六处同步 | 需检查engine层 |

**系统性缺陷**: NaN传播链贯穿全部3个传承API + 模拟器，共14个注入点，0个有防护。loadSaveData无null/NaN验证。
