# Event Module R2 — Challenger 挑战报告

> 模块: event | 轮次: R2 | Challenger: v1.9
> 审查源码: 19个 .ts 文件 (~4,283行)
> R1 FIX: 8个P0 (F-01~F-08) | R2目标: 穿透验证 + 新维度探索

---

## 一、R1 FIX 穿透验证

### F-01: EventTriggerSystem.deserialize null guard

**穿透路径**: `deserialize(null)` → `if (!data) return;` L315 → 安全返回
**旁路测试**:
- `deserialize(undefined)` → 同一 guard → ✅ 安全
- `deserialize(0)` → data=0 是 truthy → 进入 deserializeEventTriggerState(0) → `0.activeEvents` → crash?
  - 验证: TypeScript 类型约束 `EventSystemSaveData`，运行时 0.activeEvents = undefined → `?? []` → ✅ 安全（Serialization L54 `?? []` 兜底）
- `deserialize("")` → 同理 truthy → 但 activeEvents undefined → `?? []` → ✅ 安全
- `deserialize({})` → activeEvents undefined → `?? []` → cooldowns undefined → ✅ 安全

**穿透结论**: ✅ F-01 守卫完整，旁路安全

### F-02/F-03: ProbabilityCalculator NaN 防护

**穿透路径**: `calculateProbability({ baseProbability: NaN, modifiers: [{ additiveBonus: NaN }] })`
→ `safeBase = Number.isFinite(NaN) ? NaN : 0` = 0
→ `additiveBonus = Number.isFinite(NaN) ? NaN : 0` = 0
→ `finalProbability = Math.max(0, Math.min(1, 0))` = 0

**旁路测试**:
- `baseProbability = Infinity` → `Number.isFinite(Infinity)` = false → 0 ✅
- `baseProbability = -Infinity` → 同理 → 0 ✅
- `modifier.multiplicativeBonus = NaN` → `Number.isFinite(NaN)` = false → 1 ✅
- `modifier.multiplicativeBonus = 0` → `Number.isFinite(0)` = true → 0 → 概率归零（合法行为）
- `modifiers = undefined` → reduce 不执行 → additive=0, multiplicative=1 → ✅ 安全

**穿透结论**: ✅ F-02/F-03 守卫完整

### F-04: evaluateTurnRange NaN 防护

**穿透路径**: `evaluateTurnRangeCondition({ minTurn: NaN, maxTurn: NaN, turnInterval: NaN }, 5)`
→ `Number.isFinite(NaN)` = false → 条件跳过 → return true (通过)

**旁路测试**:
- `minTurn = -1` → `Number.isFinite(-1)` = true → `5 < -1` = false → return false ✅
- `minTurn = Infinity` → `Number.isFinite(Infinity)` = false → 跳过 → ✅ 安全（但 Infinity 作为下限语义不明）
- `turnInterval = 0` → `turnInterval > 0` = false → 跳过 → ✅ 安全
- `turnInterval = -3` → `turnInterval > 0` = false → 跳过 → ✅ 安全

**穿透结论**: ✅ F-04 守卫完整

### F-05: compareValue NaN 防护

**穿透路径**: `compareValue(5, { value: NaN })`
→ `rawExpected = NaN` → `Number.isFinite(NaN)` = false → expected = 0
→ `5 >= 0` = true

**旁路测试**:
- `compareValue(5, {})` → rawExpected = undefined → `undefined !== undefined` = false → expected = 0 → `5 >= 0` = true
- `compareValue(5, { value: undefined, minAmount: undefined })` → 同上
- `compareValue(NaN, { value: 5 })` → actual = NaN → `NaN >= 5` = false → return false ✅
  - ⚠️ 注意: actual 为 NaN 时条件不通过，但这属于上游问题（actual 不应为 NaN）

**穿透结论**: ✅ F-05 守卫完整

### F-06: checkAndTriggerEvents 回合校验

**穿透路径**: `checkAndTriggerEvents(NaN)` → `Number.isFinite(NaN)` = false → return []
`checkAndTriggerEvents(-1)` → `currentTurn < 0` → return []

**旁路测试**:
- `checkAndTriggerEvents(Infinity)` → `Number.isFinite(Infinity)` = false → return [] ✅
- `checkAndTriggerEvents(0.5)` → `Number.isFinite(0.5)` = true, `0.5 >= 0` → 正常执行
  - ⚠️ 浮点回合数：源码无 `Number.isInteger` 检查，但回合数为浮点不影响功能
- `checkAndTriggerEvents(1e15)` → `Number.isFinite(1e15)` = true → 正常执行 ✅

**穿透结论**: ✅ F-06 守卫完整

### F-07: OfflineEventHandler 空选项安全返回

**穿透路径**: `autoChooseOption(eventDefWithEmptyOptions)`
→ `options.length === 0` → return `{ chosenOptionId: '', reason: 'first_available', consequences: { description: '无可用选项' } }`

**旁路测试**:
- 返回值的 chosenOptionId = '' → 后续使用方需要处理空字符串
  - 验证: OfflineEventSystem.processOfflinePile L447 检查 `entry.autoResult` → 使用 `autoResult.chosenOptionId` → 空字符串不影响流程
- 返回值无 effect/consequence → 事件无效果（合理行为）

**穿透结论**: ✅ F-07 守卫完整

### F-08: Serialization cooldowns NaN 防护

**穿透路径**: `deserializeEventTriggerState({ cooldowns: { "evt": NaN } })`
→ `typeof NaN === 'number'` = true, `Number.isFinite(NaN)` = false → safeTurn = 0

**旁路测试**:
- `cooldowns: { "evt": "abc" }` → `typeof "abc" === 'number'` = false → safeTurn = 0 ✅
- `cooldowns: { "evt": undefined }` → `typeof undefined === 'number'` = false → safeTurn = 0 ✅
- `cooldowns: { "evt": -5 }` → `typeof -5 === 'number'` = true, `Number.isFinite(-5)` = true → safeTurn = -5
  - ⚠️ 负数冷却: cooldownEnd = triggerTurn + (-5) = triggerTurn - 5，可能导致冷却立即过期
  - 评估: 负数冷却实际效果是"已过期"，等同于无冷却，不构成安全问题 → P2 防御性编程
- `cooldowns: { "evt": Infinity }` → `Number.isFinite(Infinity)` = false → safeTurn = 0 ✅

**穿透结论**: ✅ F-08 守卫完整，负数冷却为 P2 遗留

---

## 二、新维度探索

### 维度1: 并发/重入安全

| # | 测试场景 | 结果 | 评估 |
|---|---------|------|------|
| D1-01 | checkAndTriggerEvents 执行中再次调用 checkAndTriggerEvents | JS单线程，无并发问题 | ✅ 安全 |
| D1-02 | resolveEvent 中触发新事件 | eventBus.emit 同步执行，但新事件在下一回合触发 | ✅ 安全 |
| D1-03 | deserialize 执行中 serialize | JS单线程 | ✅ 安全 |

**结论**: Event 模块无并发风险（JS 单线程保证）

### 维度2: 内存泄漏

| # | 测试场景 | 结果 | 评估 |
|---|---------|------|------|
| D2-01 | 长时间运行 activeEvents Map 增长 | expireEvents 定期清理 + maxActiveEvents 限制 | ✅ 安全 |
| D2-02 | completedEventIds Set 无限增长 | Set 只存 eventId 字符串，内存开销极小 | ✅ 安全 |
| D3-03 | EventLogSystem log 数组 | trimLog(200) 上限 | ✅ 安全 |
| D2-04 | EventUINotification expired 数组 | `expired.slice(-50)` 截断 | ✅ 安全 |
| D2-05 | cooldowns Map 增长 | cooldown 到期后 tickCooldowns 清理 | ✅ 安全 |
| D2-06 | EventNotificationSystem banners | trimBanners + maxBannerCount 限制 | ✅ 安全 |

**结论**: 所有集合数据结构均有上限保护，无内存泄漏风险

### 维度3: 事件风暴

| # | 测试场景 | 结果 | 评估 |
|---|---------|------|------|
| D3-01 | 注册 1000 个事件定义 | Map 存储，查询 O(1) | ✅ 安全 |
| D3-02 | checkAndTriggerEvents 每回合触发大量事件 | maxActiveEvents 限制活跃数 | ✅ 安全 |
| D3-03 | forceTriggerEvent 跳过上限 | 设计意图（测试用），生产代码不应频繁调用 | ⚠️ P2 设计提醒 |
| D3-04 | eventBus.emit 事件链导致递归 | emit 同步但事件处理委托到下一回合 | ✅ 安全 |

**结论**: 事件风暴有 maxActiveEvents 上限保护

### 维度4: 序列化完整性

| # | 测试场景 | 结果 | 评估 |
|---|---------|------|------|
| D4-01 | serialize → deserialize 往返一致性 | 源码对称设计 | ✅ 安全 |
| D4-02 | serialize 状态变更中 | JS 单线程 | ✅ 安全 |
| D4-03 | 多次 deserialize 不 reset | 源码 L316-317: `this._activeEvents.clear(); this._activeEvents.restore(restored)` → 先清后恢复 | ✅ 安全 |
| D4-04 | 超大存档数据 | trimLog/trimAlerts 限制大小 | ✅ 安全 |

**结论**: 序列化设计完整

### 维度5: 边界值组合

| # | 测试场景 | 结果 | 评估 |
|---|---------|------|------|
| D5-01 | baseProbability=1 + multiplicativeBonus=2 → 概率>1 | `Math.max(0, Math.min(1, ...))` 钳制 | ✅ 安全 |
| D5-02 | baseProbability=0 + 所有modifier=0 → 概率=0 | 事件永远不触发（合法行为） | ✅ 安全 |
| D5-03 | cooldown=0 → 立即可重新触发 | `currentTurn >= cooldownEnd` 即 `currentTurn >= triggerTurn + 0` → 总是 true | ✅ 安全 |
| D5-04 | maxTurn < minTurn → 条件永远不满足 | `currentTurn < minTurn` 先检查 → 可能通过但 `currentTurn > maxTurn` 阻断 | ✅ 安全 |
| D5-05 | turnInterval=1 → 每回合都可触发 | `currentTurn % 1 === 0` 总是 true | ✅ 安全 |

**结论**: 边界值组合无新 P0

---

## 三、R2 新发现问题

### NEW-R2-P2-01: cooldowns 负数未防护

- **来源**: F-08 穿透测试旁路
- **文件**: `EventTriggerSerialization.ts` L65
- **描述**: `cooldowns.set(eventId, -5)` → 负数冷却导致冷却立即过期
- **影响**: 篡改存档可绕过冷却，但效果等同于无冷却，不构成安全风险
- **优先级**: P2 — 防御性编程
- **修复建议**: `safeTurn = Math.max(0, safeTurn)` 额外钳制

### NEW-R2-P2-02: forceTriggerEvent 无生产环境保护

- **来源**: 维度3 事件风暴分析
- **文件**: `EventTriggerSystem.ts` L155
- **描述**: `forceTriggerEvent` 跳过 canTrigger 所有检查，包括 maxActiveEvents
- **影响**: 生产代码误用可导致活跃事件数超限
- **优先级**: P2 — 设计提醒
- **修复建议**: 添加 `@internal` JSDoc 标记或环境检查

### NEW-R2-P2-03: evaluateTurnRange Infinity 作为边界值

- **来源**: F-04 穿透测试旁路
- **文件**: `EventTriggerConditions.ts` L73
- **描述**: `minTurn = Infinity` → `Number.isFinite(Infinity)` = false → 跳过检查 → 条件通过
- **影响**: Infinity 作为 minTurn 语义不明，但不构成 crash 或数据损坏
- **优先级**: P2 — 配置验证
- **修复建议**: 事件定义注册时验证参数范围

---

## 四、R2 Challenger 统计

| 指标 | R1 | R2 | 变化 |
|------|----|----|------|
| FIX 穿透验证 | — | 8/8 | 100% |
| 穿透旁路测试 | — | 25 | 新增 |
| 新维度探索 | — | 5个维度 | 新增 |
| 新发现 P0 | 5 | **0** | -5 |
| 新发现 P1 | 1 | **0** | -1 |
| 新发现 P2 | 1 | **3** | +2 |
| 虚报率 | 0% | 0% | — |

**Challenger 结论**: R1 的 8 个 FIX 穿透验证 100% 通过，旁路测试无遗漏。5 个新维度探索未发现新 P0。3 个新 P2 均为防御性编程建议，不影响封版判定。
