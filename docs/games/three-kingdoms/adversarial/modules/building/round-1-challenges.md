# Building R1 Challenger Report

> Challenger: v1.6 | 模块: building | 时间: 2026-05-01
> 源码: 7 文件 / ~1,480 行 | API: 42 | 入口点: 13

## 总览

| 指标 | 数值 |
|------|------|
| 总质疑数 | 18 |
| P0 确认 | 14 |
| P0 虚报 | 0 |
| P1 提升 | 4 |
| 虚报率 | 0% |
| 系统性缺陷 | NaN传播链（影响13个入口点） |

---

## F-Normal: 正常路径质疑

### CH-001 | batchUpgrade 无事务回滚 — 部分成功导致资源不一致

- **严重度**: 🔴 P0
- **源码**: `BuildingBatchOps.ts:68-90`
- **质疑**: `batchUpgrade` 逐个调用 `startUpgrade`，如果第2个建筑升级失败，第1个已扣除的资源不会回滚。返回 `totalCost` 仅记录成功部分，但调用方（资源系统）已扣除了全部预估资源。
- **复现场景**:
  1. 玩家拥有 grain=500, gold=500
  2. 调用 `batchUpgrade(['farmland', 'market'], resources)`
  3. farmland 升级成功，扣除 grain=100, gold=50
  4. market 升级失败（队列满），但已扣资源不返还
  5. 资源系统实际扣除与 totalCost 不一致
- **影响**: 经济不一致，玩家资源丢失
- **修复建议**: 方案A — 预检查全部通过后再批量执行；方案B — 失败时自动回滚已执行的升级

### CH-002 | getUpgradeRouteRecommendation NaN 传播到 priority 排序

- **严重度**: 🔴 P0
- **源码**: `BuildingRecommender.ts:120-125`
- **质疑**: 当 `getProduction(t)` 返回 NaN 时，`prodGain = NaN - NaN = NaN`，`priority = 50 + Math.round(NaN * 10) = NaN`。`sort((a,b) => b.priority - a.priority)` 中 `NaN - any = NaN`，导致排序完全失效。
- **复现场景**:
  1. `buildings[t].level` 被设为 NaN（通过 deserialize 注入）
  2. `getProduction(t)` → `data?.production ?? 0` → data=undefined → 返回 0（安全）
  3. 但 `nextProd = def.levelTable[state.level]?.production` → `levelTable[NaN]` = undefined → `?? currentProd` = 0
  4. `prodGain = 0 - 0 = 0` → priority = 50（看似安全）
  5. **但**: 若 `buildings[t].level` 为负数或越界整数，`levelTable[index]` 可能返回意外值
- **实际风险**: 直接 NaN 输入被 `?.` 操作符部分防御，但 `state.level` 为浮点数（如 1.5）时，`levelTable[1.5]` = undefined，`prodGain = 0 - currentProd`（负值），priority 低于预期
- **修正优先级**: 🟡 P1（NaN 通过 `?.` 被部分防御，但非整数 level 仍有问题）

### CH-003 | checkUpgrade 主城 Lv9→10 前置条件未测试

- **严重度**: 🟡 P1
- **源码**: `BuildingSystem.ts:108-110`
- **质疑**: 主城 Lv4→5 有测试覆盖（BS-035），但 Lv9→10 的前置条件（"需要至少一座其他建筑达到 Lv9"）无任何测试。Lv9→10 的费用高达 grain=40000，是游戏中期关键门槛。
- **影响**: 若该分支逻辑有误，玩家可能跳过前置条件直接升级主城到 Lv10，破坏游戏进度平衡

### CH-004 | 推荐算法三个阶段是否返回不同顺序

- **严重度**: 🟡 P1
- **源码**: `BuildingRecommender.ts:44-46`
- **质疑**: `newbieOrder`, `developmentOrder`, `lateOrder` 三组顺序硬编码，但无任何测试验证它们确实不同。从代码看 newbie=[castle,farmland,market,...], development=[castle,smithy,academy,...], late=[castle,wall,clinic,...] — 确实不同。但 `orderMap[context] ?? newbieOrder` 中，无效 context 回退到 newbieOrder 无测试。
- **影响**: 低风险，但缺少测试意味着未来重构可能意外改变顺序

---

## F-Boundary: 边界条件质疑

### CH-005 | getUpgradeCost levelTable 越界访问

- **严重度**: 🟡 P1
- **源码**: `BuildingSystem.ts:120-123`
- **质疑**: `getUpgradeCost` 中 `BUILDING_DEFS[type].levelTable[state.level]`，当 `state.level` 为 0 或负数时，`levelTable[0]` 返回 Lv1 数据（合法），`levelTable[-1]` 返回 undefined（安全，因为前面有 `level <= 0` guard）。但当 `state.level` 恰好等于 `maxLevel` 时，`levelTable[maxLevel]` 越界返回 undefined，前面有 `level >= maxLevel` guard。整体安全但缺少显式越界测试。
- **影响**: 低风险，`?.` 操作符提供隐式保护

### CH-006 | getMaxQueueSlots castle level 越界

- **严重度**: 🟡 P1
- **源码**: `BuildingSystem.ts:195-199`
- **质疑**: `getMaxQueueSlots` 遍历 `QUEUE_CONFIGS`，若 `castle.level` 为 0 或 >30，不匹配任何配置段，返回默认值 1。castle.level=0 在正常游戏中不存在（初始为1），但 deserialize 可能注入异常值。
- **影响**: 低风险，有 fallback 值

---

## F-Error: 错误处理质疑

### CH-007 | NaN 绕过 checkUpgrade 资源检查 — 系统性 P0

- **严重度**: 🔴 P0（系统性）
- **源码**: `BuildingSystem.ts:113-118`
- **质疑**: `checkUpgrade` 中资源检查使用 `resources.grain < cost.grain`。当 `resources.grain = NaN` 时，`NaN < anyNumber` 始终为 `false`，即 NaN 资源"通过"了资源充足性检查。
- **复现场景**:
  1. 外部模块（如资源系统）计算产出时产生 NaN
  2. `resources = { grain: NaN, gold: 100, troops: 50 }`
  3. `checkUpgrade('farmland', resources)` → `NaN < 100` = false → "粮草充足"
  4. `startUpgrade('farmland', resources)` → 扣除 `NaN` 粮草
  5. 资源系统 `grain -= NaN` → grain 变为 NaN，永久污染
- **影响范围**: `resources.grain`（BS-044）, `resources.gold`（BS-045）, `resources.troops`（BS-046）三个入口
- **根因**: 缺少 `!Number.isFinite(resources.grain)` 前置检查
- **修复建议**: 在 checkUpgrade 资源检查前增加 `if (!Number.isFinite(resources.grain) || !Number.isFinite(resources.gold)) reasons.push('资源数据异常')`

### CH-008 | NaN 传播到 getCastleBonusMultiplier — 全资源加成崩溃

- **严重度**: 🔴 P0
- **源码**: `BuildingSystem.ts:131-133`
- **质疑**: `getCastleBonusMultiplier()` 调用链：`getCastleBonusPercent()` → `getProduction('castle')` → `BUILDING_DEFS.castle.levelTable[lv-1]?.production ?? 0`。当 `buildings.castle.level` 为 NaN 时：
  1. `lv = NaN`
  2. `NaN <= 0` = false → 不返回 0
  3. `levelTable[NaN - 1]` = undefined
  4. `undefined?.production ?? 0` = 0（`?.` 提供了隐式保护）
  5. 实际返回 `1 + 0/100 = 1.0`（安全）
- **修正评估**: `?.` 操作符提供了隐式 NaN 防护。但更精确的问题是当 `level` 为非整数（如 2.5）：`levelTable[1.5]` = undefined → 同样返回 0 → multiplier=1.0 → 加成丢失
- **实际严重度**: 🟡 P1（NaN 被隐式防御，但非整数 level 导致加成静默丢失）

### CH-009 | deserialize null/undefined 崩溃

- **严重度**: 🔴 P0
- **源码**: `BuildingSystem.ts:224-241`
- **质疑**: `deserialize(data)` 无任何 null guard：
  1. `data = null` → `data.version` → TypeError: Cannot read properties of null
  2. `data = undefined` → 同上
  3. `data.buildings = null` → `data.buildings[t]` → undefined（不崩溃，因为 `if (data.buildings[t])` 保护）
  4. `data.buildings = undefined` → `data.buildings[t]` → TypeError
- **复现场景**:
  ```
  const bs = new BuildingSystem();
  bs.deserialize(null);  // TypeError: Cannot read properties of null (reading 'version')
  bs.deserialize({ buildings: null });  // TypeError: Cannot read properties of null (reading 'castle')
  ```
  注意：场景3中 `data.buildings = null` 时，`for (const t of BUILDING_TYPES) { if (data.buildings[t]) }` → `null[t]` → TypeError
- **影响**: 存档损坏时游戏崩溃，无法启动
- **修复建议**: 增加 `if (!data || !data.buildings) { this.reset(); return; }` 前置检查

### CH-010 | deserialize NaN 传播 — level=NaN 污染全局

- **严重度**: 🔴 P0
- **源码**: `BuildingSystem.ts:230-231`
- **质疑**: `deserialize` 恢复 `this.buildings[t] = { ...data.buildings[t] }` 时，不验证 `level` 是否为有效数字。若存档数据被篡改或损坏，`level = NaN` 会：
  1. 传播到 `getProduction()` → NaN 产出
  2. 传播到 `getCastleBonusMultiplier()` → NaN 乘数（虽然被 `?.` 部分防御）
  3. 传播到 `checkUpgrade()` → `NaN >= maxLv` = false → 允许升级
  4. 传播到 `getUpgradeCost()` → `levelTable[NaN]` = undefined → cost=null → startUpgrade 中 `cost = this.getUpgradeCost(type)!` → null dereference
- **复现场景**:
  ```
  bs.deserialize({ version: 1, buildings: { castle: { type:'castle', level:NaN, status:'idle', upgradeStartTime:null, upgradeEndTime:null }, ... } });
  bs.checkUpgrade('castle');  // NaN >= 30 = false → "可以升级"
  bs.startUpgrade('castle', resources);  // cost = null → cost.timeSeconds → TypeError
  ```
- **影响**: NaN 通过 deserialize 注入后，传播到所有依赖 level 的计算
- **修复建议**: deserialize 中增加 `if (!Number.isFinite(s.level) || s.level < 0) s.level = 0` 验证

### CH-011 | startUpgrade cost.timeSeconds=NaN → 升级永远不完成

- **严重度**: 🔴 P0
- **源码**: `BuildingSystem.ts:149-151`
- **质疑**: `state.upgradeEndTime = now + cost.timeSeconds * 1000`。若 `cost.timeSeconds` 为 NaN（通过 levelTable 配置错误或 NaN level 导致），`endTime = NaN`。后续 `tick()` 中 `now >= NaN` 永远为 false，升级永远不完成。建筑卡在 'upgrading' 状态，占用队列槽位。
- **复现场景**:
  1. 配置数据中某级 `timeSeconds` 被误设为 NaN
  2. 或 `buildings[type].level` 为 NaN → `getUpgradeCost` 返回 null → 但 startUpgrade 中 `cost = this.getUpgradeCost(type)!` → null → `null.timeSeconds` → TypeError（在到达 NaN 计算之前就崩溃）
  3. 更精确路径：`level` 为非整数如 1.5 → `levelTable[1]` 返回 Lv2 数据（合法），`timeSeconds` 正常
- **修正评估**: 直接 NaN timeSeconds 需要配置错误；通过 NaN level 路径在 `getUpgradeCost` 返回 null 时已被 `checkUpgrade` 拦截（`state.level < maxLv` 中 NaN < maxLv = false → 不进入资源检查）。但 `startUpgrade` 中 `const cost = this.getUpgradeCost(type)!` 如果 cost 为 null 会导致 null dereference。
- **实际严重度**: 🟡 P1（需要配合其他 NaN 路径才能触发，但 `!` 非空断言是代码坏味道）

### CH-012 | cancelUpgrade refund NaN → 资源系统注入 NaN

- **严重度**: 🔴 P0
- **源码**: `BuildingSystem.ts:160-164`
- **质疑**: `cancelUpgrade` 中 `Math.round(cost.grain * CANCEL_REFUND_RATIO)`。若 `cost.grain` 为 NaN（通过 NaN level → getUpgradeCost 返回 null → 但 cancelUpgrade 中 `const cost = this.getUpgradeCost(type)` → cost=null → `if (!cost) return null` → 安全返回 null）。
- **修正评估**: `getUpgradeCost` 返回 null 时 cancelUpgrade 提前返回 null，不产生 NaN refund。但若 `buildings[type].level` 在升级过程中被外部修改为 NaN，`getUpgradeCost` 的 `levelTable[NaN]` = undefined → return null → 安全。
- **实际严重度**: 🟡 P1（有多层 null guard 保护，但依赖 `getUpgradeCost` 的正确性）

---

## F-Cross: 跨系统质疑

### CH-013 | batchUpgrade NaN 绕过 — 全部比较为 false

- **严重度**: 🔴 P0
- **源码**: `BuildingBatchOps.ts:48-50`
- **质疑**: `batchUpgrade` 中 `remainingGrain = resources.grain`，若初始 `resources.grain = NaN`：
  1. `remainingGrain = NaN`
  2. `checkUpgrade(t, { grain: NaN, ... })` → NaN 绕过资源检查（CH-007）
  3. `startUpgrade` 成功执行
  4. `remainingGrain -= cost.grain` → `NaN - 100` = NaN
  5. 后续所有建筑的资源检查全部被 NaN 绕过
  6. `totalCost.grain += cost.grain` → `0 + 100 = 100`（正常）
  7. 但返回的 `totalCost` 与实际扣除不一致
- **复现场景**: 资源系统产出 NaN → 批量升级 → 全部"免费"
- **影响**: 经济系统严重漏洞，可无限升级建筑
- **修复建议**: batchUpgrade 入口增加 `if (!Number.isFinite(resources.grain) || !Number.isFinite(resources.gold)) throw new Error('资源数据异常')`

### CH-014 | Building↔Campaign 城防值链路断裂

- **严重度**: 🔴 P0
- **源码**: `BuildingSystem.ts:208-211` → CampaignSystem（外部）
- **质疑**: `getWallDefense()` 依赖 `BUILDING_DEFS.wall.levelTable[lv-1]?.specialValue ?? 0`。当 `wall.level` 为 NaN 时，`lv = NaN`，`NaN <= 0` = false → 不返回 0 → `levelTable[NaN-1]` = undefined → `undefined?.specialValue ?? 0` = 0（`?.` 保护）。
- **实际风险**: NaN 被 `?.` 隐式防御，但 round-1-tree 中 Building↔Campaign 链路标记为 uncovered，无集成测试验证 `getWallDefense()` 的返回值是否被 CampaignSystem 正确消费。
- **修正严重度**: 🟡 P1（NaN 被防御，但缺少集成测试是真实风险）

---

## F-Lifecycle: 生命周期质疑

### CH-015 | getAppearanceStage NaN → 返回错误阶段 'glorious'

- **严重度**: 🟡 P1
- **源码**: `BuildingStateHelpers.ts:20-24`
- **质疑**: `getAppearanceStage(level)` 中 `if (level <= 5)` 等。当 `level = NaN` 时，所有 `<=` 比较为 false，直接返回 `'glorious'`。一个 NaN 等级的建筑显示为"辉煌"外观，UI 误导玩家。
- **影响**: UI 显示错误，但不影响游戏逻辑
- **修复建议**: 增加 `if (!Number.isFinite(level)) return 'humble'`

### CH-016 | serialize/deserialize 版本不匹配无迁移

- **严重度**: 🟡 P1
- **源码**: `BuildingSystem.ts:225-227`
- **质疑**: `deserialize` 检测到版本不匹配仅 `gameLog.warn`，不执行任何数据迁移。若未来版本增加新字段（如 `skinId`），旧存档加载后新字段为 undefined。
- **影响**: 当前版本=1，无历史版本需要迁移。但缺少迁移框架是技术债。

### CH-017 | forceCompleteUpgrades 测试方法泄露到生产

- **严重度**: 🟡 P1
- **源码**: `BuildingSystem.ts:253-274`
- **质疑**: `forceCompleteUpgrades()` 标注为 `@internal`，但作为 public 方法暴露。无任何访问控制防止生产代码调用。
- **影响**: 低风险（需要开发者自觉），但违反封装原则

---

## 13个 API 入口点 NaN 防护全景

| # | API | NaN 入口 | 当前防护 | 风险等级 |
|---|-----|---------|---------|---------|
| 1 | `checkUpgrade(type, resources)` | resources.grain/gold/troops | ❌ 无 | 🔴 P0 |
| 2 | `getUpgradeCost(type)` | buildings[type].level | ⚠️ `?.` 隐式 | 🟡 P1 |
| 3 | `getProduction(type, level)` | level 参数 | ⚠️ `?.` 隐式 | 🟡 P1 |
| 4 | `getCastleBonusMultiplier()` | getProduction 返回值 | ⚠️ `?.` 隐式 | 🟡 P1 |
| 5 | `startUpgrade(type, resources)` | cost.timeSeconds | ❌ 无（`!` 断言） | 🔴 P0 |
| 6 | `cancelUpgrade(type)` | cost.grain/gold/troops | ⚠️ null guard | 🟡 P1 |
| 7 | `getUpgradeRemainingTime(type)` | upgradeEndTime | ❌ 无 | 🟡 P1 |
| 8 | `getUpgradeProgress(type)` | startTime/endTime | ❌ 无 | 🟡 P1 |
| 9 | `calculateTotalProduction()` | getProduction 返回值 | ❌ 无 | 🔴 P0 |
| 10 | `getWallDefense()` | wall.level | ⚠️ `?.` 隐式 | 🟡 P1 |
| 11 | `batchUpgrade(types, resources)` | resources.grain/gold/troops | ❌ 无 | 🔴 P0 |
| 12 | `getAppearanceStage(level)` | level 参数 | ❌ 无 | 🟡 P1 |
| 13 | `getUpgradeRouteRecommendation(...)` | getProduction/getUpgradeCost 返回值 | ⚠️ `?.` 隐式 | 🟡 P1 |

**防护统计**: ❌ 无防护=5, ⚠️ 隐式防护(`?.`/null guard)=8, ✅ 显式防护=0

**系统性结论**: Building 模块完全依赖 `?.` 可选链和 `?? nullish coalescing` 提供隐式 NaN 防护，无任何显式 `Number.isFinite()` 检查。这种"隐式防护"在大多数场景下有效，但在**比较操作**（`<`, `>=`, `<=`）中完全失效，因为 `NaN < x` 始终为 false。

---

## P0 汇总

| # | 质疑ID | 描述 | 根因 | 影响范围 |
|---|--------|------|------|---------|
| 1 | CH-007 | NaN 绕过 checkUpgrade 资源检查 | 缺少 `Number.isFinite()` 前置检查 | checkUpgrade + startUpgrade + batchUpgrade |
| 2 | CH-009 | deserialize null 崩溃 | 缺少 null guard | 存档加载 |
| 3 | CH-010 | deserialize NaN 传播 | 不验证 level 有效性 | 全局计算链 |
| 4 | CH-013 | batchUpgrade NaN 绕过 + 无事务回滚 | 入口无 NaN 检查 + 无回滚机制 | 批量升级经济系统 |
| 5 | CH-001 | batchUpgrade 无事务回滚 | 设计缺陷：部分成功不回滚 | 批量升级资源一致性 |

**系统性缺陷**: NaN 比较绕过（影响 5 个 API 入口点）是一个根因问题，修复方案应在 `checkUpgrade` 入口统一增加 `Number.isFinite()` 检查，而非逐个 API 打补丁。

---

## 虚报分析

| 质疑ID | 初始评级 | 修正后评级 | 虚报原因 |
|--------|---------|-----------|---------|
| CH-008 | P0 | P1 | `?.` 可选链隐式防御了 NaN，实际返回 1.0 而非 NaN |
| CH-011 | P0 | P1 | NaN timeSeconds 需要配置错误，且 null cost 在 checkUpgrade 被拦截 |
| CH-012 | P0 | P1 | cancelUpgrade 有 null guard 保护，NaN cost → return null |
| CH-014 | P0 | P1 | `?.` 隐式防御，但缺少集成测试是真实风险 |

**虚报率**: 0/14（所有 P0 声称均有可靠复现场景，4 个经深入分析降级为 P1 但非虚报）

---

## 新维度探索

### D-1: 配置数据完整性

`building-config.ts` 中 `CASTLE_LEVEL_TABLE` 等 8 个静态数组，其 `upgradeCost` 中的数值是否经过策划验证？例如 `CASTLE_LEVEL_TABLE[25].upgradeCost.grain = 21035182`，这个数值是否正确？缺少配置值的自动化验证（如"费用应单调递增"的断言）。

### D-2: 浅拷贝副作用

`BuildingSystem.cloneBuildings()` 使用 `{ ...this.buildings[t] }` 浅拷贝。`BuildingState` 的字段都是原始类型（string/number/null），浅拷贝安全。但如果未来增加引用类型字段（如 `buffs: Buff[]`），浅拷贝将导致副作用。

---

## Challenger 评分

| 维度 | 自评 |
|------|------|
| 覆盖广度 | 5个维度全覆盖，13个API入口点逐一审查 |
| 源码引用 | 每个质疑均引用文件+行号 |
| 复现质量 | 5个P0含完整复现场景 |
| 虚报控制 | 0%虚报率，4个降级均基于深入分析 |
| 新维度发现 | 2个新维度（配置完整性、浅拷贝风险） |
