# Advisor R1 Challenges

> Challenger: AdversarialChallenger v1.8 | Time: 2026-05-01
> 目标: AdvisorSystem + AdvisorTriggerDetector | P0: 10 | P1: 8

---

## P0 Challenges（必须修复）

### P0-001: 双冷却系统语义冲突 — 冷却绕过

**类型**: 逻辑缺陷 | **规则**: BR-009 双系统并存 | **严重度**: 🔴 Critical

**源码定位**:
- `AdvisorSystem.ts:isInCooldown()` — until模式（cooldowns存结束时间戳）
- `AdvisorTriggerDetector.ts:isInCooldown()` — since模式（cooldowns存开始时间戳）
- `AdvisorSystem.ts:dismissSuggestion()` — 写入 until 模式
- `AdvisorTriggerDetector.ts:detectAllTriggers()` — 读取 since 模式

**攻击路径**:
```
1. 用户 dismissSuggestion('resource_overflow')
2. AdvisorSystem.cooldowns['resource_overflow'] = Date.now() + 1800000  (until模式)
3. 下次 updateSuggestions() 调用 detectAllTriggers(snapshot, this.state, ...)
4. detectAllTriggers 调用 Detector.isInCooldown(state, 'resource_overflow')
5. Detector 读 state.cooldowns['resource_overflow'] = 未来时间戳（如 1746100000000）
6. Date.now() - 1746100000000 = 负数 < 30min → isInCooldown 返回 false
7. 冷却被绕过！dismiss 30分钟冷却失效
```

**实际影响**: 用户关闭建议后，同类型建议会立即重新出现（冷却形同虚设）。

**修复建议**: 统一冷却语义。推荐将 Detector.isInCooldown 改为 until 模式，或 AdvisorSystem 的 cooldowns 改为 since 模式。两处必须一致。

---

### P0-002: serialize 不保存 allSuggestions — 建议列表丢失

**类型**: 数据丢失 | **规则**: BR-014 保存/加载覆盖扫描 | **严重度**: 🔴 Critical

**源码定位**:
- `AdvisorSystem.ts:serialize()` — 只保存 cooldowns/dailyCount/lastDailyReset
- `AdvisorSystem.ts:loadSaveData()` — 不恢复 allSuggestions

**攻击路径**:
```
1. 玩家游戏中有3条活跃建议
2. 保存游戏 → serialize() 不保存 allSuggestions
3. 加载游戏 → loadSaveData() → allSuggestions = []（createInitialState默认值）
4. 玩家看到0条建议，需等下次 updateSuggestions 重新生成
5. 之前高优先级建议丢失
```

**实际影响**: 存档/读档后所有活跃建议丢失。

**修复建议**: serialize 增加 allSuggestions 字段，loadSaveData 恢复时验证并过滤过期建议。

---

### P0-003: loadSaveData null/undefined 防护缺失 — 崩溃

**类型**: 运行时崩溃 | **规则**: BR-010 deserialize覆盖验证 | **严重度**: 🔴 Critical

**源码定位**: `AdvisorSystem.ts:loadSaveData(data)`

```typescript
loadSaveData(data: AdvisorSaveData): void {
  this.state.dailyCount = data.dailyCount;        // data=null → TypeError
  this.state.lastDailyReset = data.lastDailyReset;
  this.state.cooldowns = {};
  for (const cd of data.cooldowns) {              // data.cooldowns=undefined → TypeError
    this.state.cooldowns[cd.triggerType] = cd.cooldownUntil;
  }
}
```

**攻击路径**:
```
1. 存档文件损坏或版本不兼容 → data=null/undefined
2. loadSaveData(null) → TypeError: Cannot read properties of null
3. 游戏崩溃
```

**修复建议**: loadSaveData 入口增加 null/undefined 检查，无效数据时使用默认值。

---

### P0-004: Infinity cooldownUntil 导致永久冷却

**类型**: Infinity序列化 | **规则**: BR-019 Infinity序列化 | **严重度**: 🔴 Critical

**源码定位**: `AdvisorSystem.ts:loadSaveData()` → `isInCooldown()`

**攻击路径**:
```
1. 恶意存档注入 cooldowns: [{triggerType: 'resource_overflow', cooldownUntil: Infinity}]
2. loadSaveData 恢复 cooldowns['resource_overflow'] = Infinity
3. isInCooldown: Date.now() < Infinity → true → 永久冷却
4. 该触发类型永远不再生成建议
5. 9个触发类型全部注入Infinity → 系统完全瘫痪
```

**修复建议**: loadSaveData 中验证 cooldownUntil 为有限数（`Number.isFinite`），Infinity/NaN 使用默认值。

---

### P0-005: NaN dailyCount 绕过每日上限

**类型**: NaN绕过 | **规则**: BR-001 数值API入口检查 | **严重度**: 🔴 Critical

**源码定位**: `AdvisorSystem.ts:updateSuggestions()` → `if (this.state.dailyCount >= ADVISOR_DAILY_LIMIT)`

**攻击路径**:
```
1. 恶意存档注入 dailyCount: NaN
2. loadSaveData 恢复 dailyCount = NaN
3. NaN >= 15 → false → 永远不触发每日上限
4. updateSuggestions 无限添加建议
5. allSuggestions 无限增长 → 内存泄漏
```

**修复建议**: loadSaveData 中验证 `Number.isFinite(data.dailyCount) && data.dailyCount >= 0`。

---

### P0-006: NaN cooldownEnd 绕过冷却检查

**类型**: NaN绕过 | **规则**: BR-001 数值API入口检查 | **严重度**: 🔴 Critical

**源码定位**: `AdvisorSystem.ts:isInCooldown()`

```typescript
isInCooldown(triggerType: AdvisorTriggerType): boolean {
  const cooldownEnd = this.state.cooldowns[triggerType];
  if (!cooldownEnd) return false;          // NaN 是 falsy? 不！NaN 是 truthy
  return Date.now() < cooldownEnd;         // Date.now() < NaN → false → 不在冷却中
}
```

**攻击路径**:
```
1. cooldownEnd = NaN（通过 loadSaveData 注入或内部bug）
2. !NaN → false（NaN 是 truthy）→ 不提前返回
3. Date.now() < NaN → false → isInCooldown 返回 false
4. 冷却被绕过
```

**注意**: NaN 在 JavaScript 中是 truthy 值，`!NaN === false`，所以 `if (!cooldownEnd)` 不会拦截 NaN。

**修复建议**: 使用 `!cooldownEnd || !Number.isFinite(cooldownEnd)` 检查。

---

### P0-007: detectTriggers/detectAllTriggers null snapshot 崩溃

**类型**: 运行时崩溃 | **规则**: BR-010 null防护 | **严重度**: 🔴 Critical

**源码定位**:
- `AdvisorTriggerDetector.ts:detectAllTriggers()` — 直接访问 snapshot.buildingQueueIdle
- `AdvisorTriggerDetector.ts:findOverflowResource()` — 有 null 检查但 detectAllTriggers 没有

```typescript
export function detectAllTriggers(snapshot: GameStateSnapshot, ...): AdvisorSuggestion[] {
  // 无 null 检查，直接使用 snapshot
  if (snapshot.buildingQueueIdle && ...) { ... }           // snapshot=null → 崩溃
  if (snapshot.upgradeableHeroes.length > 0 && ...) { ... } // snapshot=null → 崩溃
  for (const npc of snapshot.leavingNpcs) { ... }          // leavingNpcs=undefined → 崩溃
  for (const feature of snapshot.newFeatures) { ... }      // newFeatures=undefined → 崩溃
}
```

**攻击路径**:
```
1. 上层调用 updateSuggestions(null) 或 detectTriggers(null)
2. detectAllTriggers(null) → TypeError: Cannot read properties of null
3. 游戏崩溃
```

**修复建议**: detectAllTriggers 入口增加 snapshot null 检查，提前返回空数组。

---

### P0-008: init 时 deps.eventBus 为 null 崩溃

**类型**: 运行时崩溃 | **规则**: BR-006 注入点验证 | **严重度**: 🔴 Critical

**源码定位**: `AdvisorSystem.ts:init()`

```typescript
init(deps: ISystemDeps): void {
  this.deps = deps;
  this.deps.eventBus.on('calendar:dayChanged', () => this.resetDaily());
  // deps.eventBus = null → TypeError
}
```

**攻击路径**:
```
1. Engine 初始化时 deps.eventBus 未就绪
2. init(deps) → deps.eventBus.on() → TypeError
3. AdvisorSystem 初始化失败 → 后续所有调用异常
```

**修复建议**: init 中验证 deps.eventBus 存在，可选注册事件。

---

### P0-009: executeSuggestion 在 deps 未初始化时崩溃

**类型**: 运行时崩溃 | **规则**: BR-006 注入点验证 | **严重度**: 🔴 Critical

**源码定位**: `AdvisorSystem.ts:executeSuggestion()`

```typescript
executeSuggestion(suggestionId: string): { success: boolean; reason?: string } {
  // ...找到建议...
  this.deps.eventBus.emit('advisor:suggestionExecuted', { ... });
  // this.deps 未初始化 → TypeError
}
```

**攻击路径**:
```
1. AdvisorSystem 未调用 init() 或 init 失败
2. 调用 executeSuggestion('adv_1_xxx')
3. this.deps.eventBus.emit() → TypeError
```

**修复建议**: executeSuggestion 中检查 this.deps 是否已初始化。

---

### P0-010: AdvisorTriggerDetector.COOLDOWN_MS 与 ADVISOR_CLOSE_COOLDOWN_MS 不同步

**类型**: 配置不一致 | **规则**: BR-007 配置交叉验证 | **严重度**: 🔴 Critical

**源码定位**:
- `advisor.types.ts:ADVISOR_CLOSE_COOLDOWN_MS = 30 * 60 * 1000`（30分钟）
- `AdvisorTriggerDetector.ts:COOLDOWN_MS` — 9种触发类型各有不同冷却时间

**问题**: AdvisorSystem.dismissSuggestion 使用 ADVISOR_CLOSE_COOLDOWN_MS（30min）设置冷却，但 detectAllTriggers 使用 COOLDOWN_MS[type]（各类型不同）检查冷却。这两个冷却时间表完全独立，没有交叉验证。

**实际影响**: 即使 P0-001 修复后（统一语义），两套冷却时间常量仍可能导致行为不一致。

**修复建议**: 统一冷却时间配置到一处（advisor.types.ts），两处引用同一常量。

---

## P1 Challenges（建议修复）

### P1-001: suggestionCounter 模块级变量 — 多实例冲突

**源码定位**: `AdvisorSystem.ts:let suggestionCounter = 0`

**问题**: suggestionCounter 是模块级变量，多个 AdvisorSystem 实例共享。reset() 重置为0，会影响其他实例的ID唯一性。

**建议**: 将 counter 移入实例属性。

---

### P1-002: getDisplayedSuggestions 返回排序后的新数组但 allSuggestions 引用共享

**源码定位**: `AdvisorSystem.ts:getDisplayedSuggestions()`

```typescript
return [...this.state.allSuggestions]
  .sort((a, b) => b.priority - a.priority)
  .slice(0, ADVISOR_MAX_DISPLAY);
```

**问题**: 返回的是浅拷贝数组，但数组元素（AdvisorSuggestion对象）仍是引用。外部修改会影响内部状态。

**建议**: 返回深拷贝或冻结对象。

---

### P1-003: getState 返回浅拷贝 — allSuggestions 引用共享

**源码定位**: `AdvisorSystem.ts:getState()`

```typescript
getState(): AdvisorInternalState {
  return { ...this.state };  // allSuggestions 数组引用共享
}
```

**问题**: 外部通过 getState().allSuggestions 可以直接修改内部状态。

**建议**: 深拷贝 allSuggestions。

---

### P1-004: createSuggestion priority 类型不安全

**源码定位**: `AdvisorSystem.ts:detectTriggers()`

```typescript
this.createSuggestion(trigger, title, desc, priority as AdvisorConfidence, action, target, targetId)
```

**问题**: detectAllTriggers 传入的 priority 是字符串（'high'/'medium'/'low'），但 createSuggestion 期望 AdvisorConfidence 类型，且实际赋值给 suggestion.priority 的是 ADVISOR_TRIGGER_PRIORITY[triggerType]（数值）。参数名冲突：createSuggestion 的第4个参数名为 confidence 但实际传入的是字符串 priority。

**建议**: 修正参数类型和命名。

---

### P1-005: findOverflowResource 阈值不一致

**源码定位**:
- `AdvisorSystem.ts:findOverflowResource()` — 阈值 0.8（80%）
- `AdvisorTriggerDetector.ts:findOverflowResource()` — 阈值 0.9（90%）

**问题**: AdvisorSystem 内部方法用 80% 阈值，但 Detector 用 90% 阈值。虽然 AdvisorSystem 的内部方法未被外部调用（仅保留），但存在不一致。

**建议**: 删除 AdvisorSystem 中未使用的 findOverflowResource/findShortageResource 方法。

---

### P1-006: updateSuggestions 中 break vs continue 逻辑

**源码定位**: `AdvisorSystem.ts:updateSuggestions()`

```typescript
if (this.state.dailyCount >= ADVISOR_DAILY_LIMIT) {
  break;  // 达到上限直接退出循环
}
if (this.isInCooldown(suggestion.triggerType)) {
  continue;  // 冷却中跳过当前
}
```

**问题**: 达到上限后 break 是正确的，但如果某类型在冷却中而后续类型不在冷却中，冷却检查的 continue 会跳过当前但继续处理后续。这是正确行为但需确认意图。

**建议**: 无需修改，确认逻辑正确。

---

### P1-007: cleanExpired 过滤条件 — expiresAt == null 安全性

**源码定位**: `AdvisorSystem.ts:cleanExpired()`

```typescript
this.state.allSuggestions = this.state.allSuggestions.filter(
  s => s.expiresAt == null || s.expiresAt > now,
);
```

**问题**: 使用 `== null` 同时匹配 null 和 undefined，语义正确。但 createSuggestion 总是设置 expiresAt，所以 `== null` 实际不会触发。如果未来有"永不过期"建议，这个逻辑是正确的。

**建议**: 无需修改。

---

### P1-008: loadSaveData 不恢复 allSuggestions — 设计验证

**源码定位**: `AdvisorSystem.ts:loadSaveData()`

**问题**: 与 P0-002 相关。如果设计意图是"加载后重新生成建议"，则 loadSaveData 应该在恢复后调用 updateSuggestions。但目前 loadSaveData 不做此操作。

**建议**: 如果建议是临时性的（可重新生成），在文档中明确说明。否则按 P0-002 修复。

---

## 挑战总结

| 等级 | 数量 | 修复优先级 |
|------|------|-----------|
| 🔴 P0 | 10 | 本轮必须修复 |
| 🟡 P1 | 8 | 建议修复 |
| **总计** | **18** | |

### P0 修复优先级排序

| 优先级 | Challenge | 修复复杂度 | 影响面 |
|--------|-----------|-----------|--------|
| 1 | P0-001 双冷却系统不一致 | 中 | 冷却完全失效 |
| 2 | P0-002 serialize不保存建议 | 低 | 存档数据丢失 |
| 3 | P0-003 loadSaveData null防护 | 低 | 运行时崩溃 |
| 4 | P0-004 Infinity冷却 | 低 | 系统瘫痪 |
| 5 | P0-005 NaN dailyCount | 低 | 无限生成 |
| 6 | P0-006 NaN cooldownEnd | 低 | 冷却绕过 |
| 7 | P0-007 null snapshot | 低 | 运行时崩溃 |
| 8 | P0-008 init null防护 | 低 | 初始化崩溃 |
| 9 | P0-009 executeSuggestion未初始化 | 低 | 运行时崩溃 |
| 10 | P0-010 冷却配置不同步 | 低 | 行为不一致 |
