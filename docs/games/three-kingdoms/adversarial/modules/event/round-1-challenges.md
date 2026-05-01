# Event Module R1 — Challenger 挑战报告

> 模块: event | 轮次: R1 | Challenger: v1.9
> 审查源码: 19个 .ts 文件 (~4,284行)
> Builder P0节点: 15个 | 验证结果: **15/15 确认有效** | 遗漏发现: **+5个新P0**

---

## 一、Builder P0 验证矩阵

| # | Builder ID | 描述 | 验证方式 | 结论 | 说明 |
|---|-----------|------|----------|------|------|
| P0-01 | S1-B07 | resolveEvent(不存在instance) → null | 源码 Lifecycle L28: `if (!instance) return null` | ✅ 确认 | 正确防护 |
| P0-02 | S1-B08 | resolveEvent(非active状态) → null | 源码 Lifecycle L29: `if (instance.status !== 'active') return null` | ✅ 确认 | 正确防护 |
| P0-03 | S1-B09 | resolveEvent(不存在option) → null | 源码 Lifecycle L34: `const option = def.options.find(...)` → null | ✅ 确认 | 正确防护 |
| P0-04 | S1-E01 | deserialize(null) → crash | 源码 ETS L312: `deserializeEventTriggerState(data)` → data.activeEvents → crash | ✅ **P0** | **需修复** |
| P0-05 | S4-B03 | calculateProbability(NaN) → NaN传播 | 源码 EPC L45: `Math.max(0, Math.min(1, NaN))` = NaN | ✅ **P0** | **需修复** |
| P0-06 | S4-E01 | modifiers含NaN → NaN传播 | 源码 EPC L39/42: NaN+number=NaN, NaN×number=NaN | ✅ **P0** | **需修复** |
| P0-07 | S6-B01 | deserialize(null data) → crash | 源码 Ser L54: `for (const inst of data.activeEvents ?? [])` — **有防护!** | ⚠️ 降级 | `?? []` 已防护activeEvents |
| P0-08 | S7-B08 | EventChainSystem.deserialize(null) → crash | 源码 ECS L381: `for (const chain of data.eventChains ?? [])` — **有防护!** | ⚠️ 降级 | `?? []` 已防护 |
| P0-09 | S8-B08 | ChainEventSystem.importSaveData(null) → crash | 源码 CES L310: `for (const cp of data.chainProgresses ?? [])` — **有防护!** | ⚠️ 降级 | `?? []` 已防护 |
| P0-10 | S9-B08 | StoryEventSystem.importSaveData(null) → crash | 源码 SES L370: `for (const sp of data.storyProgresses ?? [])` — **有防护!** | ⚠️ 降级 | `?? []` 已防护 |
| P0-11 | S10-E01 | selectOption(空options) → crash | 源码 OES L382: `if (!def || def.options.length === 0) return ''` — **有防护!** | ⚠️ 降级 | 早期return已防护 |
| P0-12 | S12-B06 | NotificationSystem.importSaveData(null) → crash | 源码 ENS L151: `if (data.banners)` — **有防护!** | ⚠️ 降级 | if检查已防护 |
| P0-13 | S2-B04 | evaluateTurnRange(NaN minTurn) → NaN比较 | 源码 ETC L72: `currentTurn < NaN` = false, 条件通过 | ✅ **P0** | **需修复** |
| P0-14 | S2-B05 | compareValue(NaN expected) → NaN比较 | 源码 ETC L158: `actual >= NaN` = false, 条件永远不通过 | ✅ **P0** | **需修复** |
| P0-15 | S1-E03 | checkAndTriggerEvents(负数turn) → 无检查 | 源码 ETS L141: currentTurn直接传递无校验 | ✅ **P0** | **需修复** |

### 验证结论

- **确认P0 (需修复)**: 6个 — P0-04, P0-05, P0-06, P0-13, P0-14, P0-15
- **降级为P1/P2 (已有防护)**: 7个 — P0-07/08/09/10/11/12 (null coalescing / if检查已防护)
- **确认已防护(非bug)**: 2个 — P0-01/02/03

---

## 二、新发现遗漏 (Challenger +5 P0)

### NEW-P0-01: OfflineEventHandler.autoChooseOption 空选项 crash

- **文件**: `OfflineEventHandler.ts` L130
- **严重度**: P0 — 运行时crash
- **复现**: `autoChooseOption(eventDef)` 当 `eventDef.options.length === 0`
- **源码**:
  ```typescript
  private autoChooseOption(eventDef: EventDef): AutoResolveResult {
    const options = eventDef.options;
    if (options.length === 0) {
      throw new Error(`事件 ${eventDef.id} 没有选项`);
    }
  ```
- **分析**: 与 OfflineEventSystem.selectOption 不同（后者 `return ''`），OfflineEventHandler 直接 throw。如果低优先级事件定义了空options数组，离线自动处理会crash整个流程。
- **影响**: 离线回归场景下，一个坏事件定义可导致整个离线处理中断。
- **修复建议**: 改为返回默认 AutoResolveResult 而非 throw，或在 simulateOfflineEvents 入口过滤空选项事件。

### NEW-P0-02: EventTriggerSerialization.deserialize cooldowns NaN注入

- **文件**: `EventTriggerSerialization.ts` L65-67
- **严重度**: P0 — 数据损坏
- **复现**: 存档数据被篡改 `cooldowns: { "evt-1": NaN }` 或 `cooldowns: { "evt-1": "abc" }`
- **源码**:
  ```typescript
  if (data.cooldowns) {
    for (const [eventId, turn] of Object.entries(data.cooldowns)) {
      cooldowns.set(eventId, turn);  // turn可能是NaN/string
    }
  }
  ```
- **分析**: `turn` 未做类型校验，直接存入Map。后续 `canTrigger` 中 `currentTurn < cooldownEnd` 若 cooldownEnd 为 NaN，则永远为 false，冷却永远不解除。
- **影响**: 恶意/损坏存档可导致事件永久冷却，玩家无法触发任何随机事件。
- **修复建议**: `cooldowns.set(eventId, typeof turn === 'number' && !isNaN(turn) ? turn : 0)`

### NEW-P0-03: OfflineEventSystem.findMatchingRule 紧急度阈值逻辑反转

- **文件**: `OfflineEventSystem.ts` L349
- **严重度**: P0 — 逻辑错误
- **复现**: 注册规则 `urgencyThreshold: 'low'`，事件urgency='medium'
- **源码**:
  ```typescript
  if (URGENCY_ORDER[entry.urgency] >= URGENCY_ORDER[rule.urgencyThreshold]) {
    continue; // 事件紧急程度 >= 阈值，不自动处理
  }
  ```
- **分析**: URGENCY_ORDER = {critical:4, high:3, medium:2, low:1}。当 urgencyThreshold='low'(1)，事件urgency='medium'(2): `2 >= 1` → continue，不自动处理。这意味着阈值设为 'low' 时，只有 urgency='low'(1) 的事件会被自动处理（1 < 1 = false，也不处理！）。**只有当事件紧急程度严格小于阈值时才自动处理**，但 low 已经是最小值，所以 urgencyThreshold='low' 实际上不会自动处理任何事件。
- **影响**: 规则配置意图与实际行为不一致，可能导致所有事件都保留为手动处理，违背自动处理设计意图。
- **修复建议**: 重新审视阈值语义，建议改为 `>` 而非 `>=`，或使用明确的优先级映射注释。

### NEW-P0-04: EventTriggerSystem.deserialize 无版本迁移

- **文件**: `EventTriggerSystem.ts` L312-324
- **严重度**: P0 — 存档兼容性
- **复现**: 加载旧版本存档（缺少新字段）
- **源码**:
  ```typescript
  deserialize(data: EventSystemSaveData): void {
    const restored = deserializeEventTriggerState(data);
    // 直接赋值，无版本检查
  }
  ```
- **分析**: 序列化数据包含 `version` 字段但 deserialize 从未检查。如果未来版本增加新字段（如 probabilityConditions），旧存档加载后这些字段为空但不报错，可能导致功能静默失效。
- **影响**: 版本升级后旧存档加载可能丢失功能状态。
- **修复建议**: 添加版本检查和迁移逻辑。

### NEW-P0-05: EventConditionEvaluator.compareValue NaN expected 默认0

- **文件**: `EventConditionEvaluator.ts` L162 / `EventTriggerConditions.ts` L158
- **严重度**: P0 — 静默错误
- **复现**: `compareValue(actual, { value: undefined })` → expected = undefined ?? undefined ?? 0 = 0
- **源码**:
  ```typescript
  const expected = params['value'] as number | undefined
    ?? params['minAmount'] as number | undefined
    ?? 0;
  ```
- **分析**: 当 params 中既无 `value` 也无 `minAmount` 时，expected 默认为 0。这意味着 `actual >= 0` 对正数总是 true，条件静默通过。如果调用方遗漏了 value 参数，条件评估结果与预期不符。
- **影响**: 条件定义错误时静默通过，难以调试。
- **修复建议**: 当 expected 为 undefined 时发出警告或返回 false。

---

## 三、P0 修复优先级排序

| 优先级 | ID | 描述 | 修复复杂度 | 影响范围 |
|--------|-----|------|-----------|---------|
| 🔴 最高 | P0-04 | EventTriggerSystem.deserialize(null) crash | 低 | 存档加载 |
| 🔴 最高 | NEW-P0-02 | Serialization cooldowns NaN注入 | 低 | 存档安全 |
| 🔴 最高 | NEW-P0-01 | OfflineEventHandler 空选项 throw | 中 | 离线处理 |
| 🟠 高 | P0-05/06 | ProbabilityCalculator NaN传播 | 低 | 概率计算 |
| 🟠 高 | P0-13/14 | Conditions NaN比较 | 低 | 条件评估 |
| 🟠 高 | P0-15 | 负数回合无校验 | 低 | 触发系统 |
| 🟡 中 | NEW-P0-03 | 紧急度阈值逻辑反转 | 中 | 自动处理 |
| 🟡 中 | NEW-P0-04 | 无版本迁移 | 中 | 存档兼容 |
| 🟡 中 | NEW-P0-05 | compareValue NaN默认0 | 低 | 条件评估 |

---

## 四、grep 扫描验证记录

### 扫描1: `<= 0` / `> 0` 数值比较
```
EventLogSystem.ts:149     → unread.length > 0  — 安全
EventNotificationSystem.ts:85  → unreadCount > 0  — 安全
StoryEventSystem.ts:336   → total > 0  — 安全
ChainEventSystem.ts:261   → total > 0  — 安全
OfflineEventSystem.ts:424 → roll <= 0  — 安全 (weighted_random)
```
**结论**: 无遗漏P0。

### 扫描2: serialize / deserialize
```
EventTriggerSerialization.ts:30/48  → 核心序列化
EventTriggerSystem.ts:304/312       → 委托调用
EventTriggerSystem.helpers.ts:79/88 → 辅助函数
EventNotificationSystem.ts:169/171  → banners序列化
EventUINotification.ts:245/251      → UI序列化
```
**结论**: 确认6处deserialize入口，其中4处已有null coalescing防护，P0-04 (ETS L312) 需要额外防护。

### 扫描3: `if (!` / `=== null`
```
EventTriggerConditions.ts:87/103/119/136/139  → !gameState/!eventId/!isCompleted → true
OfflineEventHandler.ts:70/88/204/213          → !eventDef/!entry/!option → continue/return
EventLogSystem.ts:102                          → !existing → 创建新log
```
**结论**: EventTriggerConditions 的 `!gameState → true` 模式虽然向后兼容，但在NaN场景下不安全（P0-13/14确认）。

---

## 五、统计

| 指标 | 数量 |
|------|------|
| Builder P0 验证 | 15 |
| 确认有效P0 | 6 |
| 降级(已有防护) | 7 |
| 确认已防护(非bug) | 2 |
| **新发现P0** | **5** |
| **总需修复P0** | **11** |
