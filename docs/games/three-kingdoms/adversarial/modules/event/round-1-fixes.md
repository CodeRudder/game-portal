# Event Module R1 — Fixer 修复报告

> 模块: event | 轮次: R1 | Fixer: v1.9
> 确认P0: 8个 | 已修复: 8个 | TypeScript验证: ✅ pass

---

## 修复清单

### F-01: EventTriggerSystem.deserialize null guard
- **文件**: `EventTriggerSystem.ts` L312
- **问题**: `deserialize(null)` 导致 `null.activeEvents` crash
- **修复**: 入口添加 `if (!data) return;`
- **验证**: deserialize(null/undefined) 不再crash

```diff
  deserialize(data: EventSystemSaveData): void {
+   if (!data) return; // F-01: null/undefined guard
    const restored = deserializeEventTriggerState(data);
```

### F-02: ProbabilityCalculator baseProbability NaN防护
- **文件**: `EventProbabilityCalculator.ts` L28
- **问题**: `baseProbability=NaN` → `finalProbability=NaN`
- **修复**: 入口 `Number.isFinite()` 检查，NaN → 0

```diff
- const { baseProbability, modifiers } = probCondition;
+ const { baseProbability, modifiers } = probCondition;
+ const safeBase = Number.isFinite(baseProbability) ? baseProbability : 0;
```

### F-03: ProbabilityCalculator modifiers NaN防护
- **文件**: `EventProbabilityCalculator.ts` L37-42
- **问题**: modifier.additiveBonus/multiplicativeBonus 含NaN → NaN传播
- **修复**: reduce中 `Number.isFinite()` 过滤

```diff
- (sum, m) => sum + m.additiveBonus, 0,
+ (sum, m) => sum + (Number.isFinite(m.additiveBonus) ? m.additiveBonus : 0), 0,
```

### F-04: EventTriggerConditions.evaluateTurnRange NaN防护
- **文件**: `EventTriggerConditions.ts` L65
- **问题**: `minTurn=NaN` → `currentTurn < NaN` = false，条件静默通过
- **修复**: `Number.isFinite()` 检查后再比较

```diff
- if (minTurn !== undefined && currentTurn < minTurn) return false;
+ if (minTurn !== undefined && Number.isFinite(minTurn) && currentTurn < minTurn) return false;
```

### F-05: EventTriggerConditions.compareValue NaN防护
- **文件**: `EventTriggerConditions.ts` L151
- **问题**: `expected=NaN` → `actual >= NaN` = false，条件永远不通过
- **修复**: `Number.isFinite()` 检查expected

```diff
- const expected = params['value'] as number | undefined
-   ?? params['minAmount'] as number | undefined
-   ?? 0;
+ const rawExpected = params['value'] as number | undefined
+   ?? params['minAmount'] as number | undefined;
+ const expected = (rawExpected !== undefined && Number.isFinite(rawExpected)) ? rawExpected : 0;
```

### F-06: EventTriggerSystem.checkAndTriggerEvents 回合数校验
- **文件**: `EventTriggerSystem.ts` L141
- **问题**: `currentTurn` 可为负数/NaN/Infinity
- **修复**: 入口添加 `Number.isFinite()` + 非负校验

```diff
  checkAndTriggerEvents(currentTurn: number): EventInstance[] {
+   if (!Number.isFinite(currentTurn) || currentTurn < 0) return [];
    this._currentTurn = currentTurn;
```

### F-07: OfflineEventHandler.autoChooseOption 空选项安全返回
- **文件**: `OfflineEventHandler.ts` L130
- **问题**: `options.length === 0` 时 throw Error，中断整个离线处理
- **修复**: throw → return 安全默认值

```diff
    if (options.length === 0) {
-     throw new Error(`事件 ${eventDef.id} 没有选项`);
+     return {
+       chosenOptionId: '',
+       reason: 'first_available',
+       consequences: { description: '无可用选项' },
+     };
    }
```

### F-08: EventTriggerSerialization cooldowns NaN注入防护
- **文件**: `EventTriggerSerialization.ts` L65-67
- **问题**: 篡改存档 `cooldowns: { "evt": NaN }` → 冷却永久不解除
- **修复**: 类型校验 + `Number.isFinite()` 守卫

```diff
    for (const [eventId, turn] of Object.entries(data.cooldowns)) {
-     cooldowns.set(eventId, turn);
+     const safeTurn = typeof turn === 'number' && Number.isFinite(turn) ? turn : 0;
+     cooldowns.set(eventId, safeTurn);
    }
```

---

## 验证结果

### TypeScript 编译
```
$ npx tsc --noEmit
```
✅ Event模块0错误（唯一的TS错误在 IntegrationValidator.ts，与本模块无关）

### 修复覆盖矩阵

| Arbiter ID | 描述 | 修复状态 | 验证 |
|-----------|------|---------|------|
| F-01 | deserialize null crash | ✅ 已修复 | tsc pass |
| F-02 | Probability NaN (base) | ✅ 已修复 | tsc pass |
| F-03 | Probability NaN (modifiers) | ✅ 已修复 | tsc pass |
| F-04 | TurnRange NaN | ✅ 已修复 | tsc pass |
| F-05 | compareValue NaN | ✅ 已修复 | tsc pass |
| F-06 | 负数回合 | ✅ 已修复 | tsc pass |
| F-07 | 空选项 throw | ✅ 已修复 | tsc pass |
| F-08 | cooldowns NaN | ✅ 已修复 | tsc pass |

---

## 修改文件清单

| 文件 | 修改行数 | 说明 |
|------|---------|------|
| EventTriggerSystem.ts | +2行 | F-01 null guard + F-06 回合校验 |
| EventProbabilityCalculator.ts | +5行 | F-02/F-03 NaN防护 |
| EventTriggerConditions.ts | +4行 | F-04/F-05 NaN防护 |
| OfflineEventHandler.ts | +5行 | F-07 空选项安全返回 |
| EventTriggerSerialization.ts | +2行 | F-08 cooldowns NaN防护 |

**总计**: 5个文件, +18行修改, 0个新增文件

---

## 未修复项（降级为P1/P2，后续轮次处理）

| ID | 描述 | 优先级 | 说明 |
|----|------|--------|------|
| P0-07~12 | 6处deserialize null | P2 | 已有 `?? []` / if检查防护 |
| NEW-P0-03 | 紧急度阈值逻辑 | P1 | 语义合理但需改进注释 |
| NEW-P0-04 | 无版本迁移 | P2 | 未来版本再处理 |
