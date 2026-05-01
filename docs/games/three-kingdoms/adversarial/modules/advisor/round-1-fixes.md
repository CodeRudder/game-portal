# Advisor R1 Fixes

> Fixer: AdversarialFixer v1.8 | Time: 2026-05-01
> 基于 Arbiter round-1-verdict.md | P0: 9 | P1: 1

---

## 修复总览

| FIX ID | Challenge | 文件 | 状态 |
|--------|-----------|------|------|
| FIX-501 | P0-001 双冷却系统不一致 | AdvisorTriggerDetector.ts | ✅ 已修复 |
| FIX-502 | P0-002 serialize不保存建议 | AdvisorSystem.ts + advisor.types.ts | ✅ 已修复 |
| FIX-503 | P0-003 loadSaveData null防护 | AdvisorSystem.ts | ✅ 已修复 |
| FIX-504 | P0-004 Infinity冷却 | AdvisorSystem.ts | ✅ 已修复 |
| FIX-505 | P0-005 NaN dailyCount | AdvisorSystem.ts | ✅ 已修复 |
| FIX-506 | P0-006 NaN cooldownEnd | AdvisorSystem.ts | ✅ 已修复 |
| FIX-507 | P0-007 null snapshot | AdvisorTriggerDetector.ts | ✅ 已修复 |
| FIX-508 | P0-008 init null防护 | AdvisorSystem.ts | ✅ 已修复 |
| FIX-509 | P0-009 executeSuggestion未初始化 | AdvisorSystem.ts | ✅ 已修复 |
| FIX-510 | P1-010 冷却配置不同步 | — | 📝 记录（P1，下轮处理） |

---

## 修复详情

### FIX-501: 统一冷却系统为 until 模式

**问题**: AdvisorSystem 用 until 模式（存结束时间），Detector 用 since 模式（存开始时间），导致 dismissSuggestion 设置的冷却被 Detector 误解。

**修复**:
- `AdvisorTriggerDetector.isInCooldown()`: 从 `Date.now() - lastTime < COOLDOWN_MS` 改为 `Date.now() < cooldownEnd`
- `AdvisorTriggerDetector.setCooldown()`: 从 `state.cooldowns[type] = Date.now()` 改为 `state.cooldowns[type] = Date.now() + COOLDOWN_MS`
- 增加 `Number.isFinite(cooldownEnd)` 防护

```typescript
// Before (since 模式)
export function isInCooldown(state, triggerType) {
  const lastTime = state.cooldowns[triggerType] ?? 0;
  return Date.now() - lastTime < (COOLDOWN_MS[triggerType] ?? 0);
}

// After (until 模式)
export function isInCooldown(state, triggerType) {
  const cooldownEnd = state.cooldowns[triggerType];
  if (!cooldownEnd || !Number.isFinite(cooldownEnd)) return false;
  return Date.now() < cooldownEnd;
}
```

---

### FIX-502: serialize 保存 allSuggestions

**问题**: serialize() 不保存 allSuggestions，loadSaveData() 后建议列表丢失。

**修复**:
- `advisor.types.ts`: AdvisorSaveData 增加 `suggestions: AdvisorSuggestion[]` 字段
- `AdvisorSystem.serialize()`: 增加 `suggestions` 字段输出
- `AdvisorSystem.loadSaveData()`: 从 `data.suggestions` 恢复，过滤过期项

```typescript
// serialize 新增
suggestions: this.state.allSuggestions.map(s => ({ ...s })),

// loadSaveData 新增
const savedSuggestions = data.suggestions;
if (Array.isArray(savedSuggestions)) {
  const now = Date.now();
  this.state.allSuggestions = savedSuggestions.filter(
    s => s && s.id && (s.expiresAt == null || s.expiresAt > now),
  );
}
```

---

### FIX-503: loadSaveData null/undefined 防护

**问题**: `loadSaveData(null)` 直接崩溃。

**修复**: 入口增加 `if (!data) return;`，cooldowns 使用 `|| []` 默认值。

```typescript
loadSaveData(data: AdvisorSaveData): void {
  if (!data) return;  // FIX-503
  // ...
  const cooldowns = data.cooldowns || [];  // FIX-503
}
```

---

### FIX-504: Infinity cooldownUntil 防护

**问题**: `cooldownUntil = Infinity` 导致永久冷却。

**修复**: loadSaveData 中验证 `Number.isFinite(cd.cooldownUntil)`。

```typescript
for (const cd of cooldowns) {
  if (cd && cd.triggerType && Number.isFinite(cd.cooldownUntil) && cd.cooldownUntil > 0) {
    this.state.cooldowns[cd.triggerType] = cd.cooldownUntil;
  }
}
```

---

### FIX-505: NaN dailyCount 防护

**问题**: `dailyCount = NaN` 绕过每日上限。

**修复**: loadSaveData 中验证 `Number.isFinite(dailyCount)`，updateSuggestions 中同步防护。

```typescript
// loadSaveData
this.state.dailyCount = (Number.isFinite(dailyCount) && dailyCount >= 0) ? dailyCount : 0;

// updateSuggestions
const currentCount = Number.isFinite(this.state.dailyCount) ? this.state.dailyCount : 0;
if (currentCount >= ADVISOR_DAILY_LIMIT) break;
```

---

### FIX-506: isInCooldown NaN 防护

**问题**: `cooldownEnd = NaN` 时，NaN 是 truthy，`Date.now() < NaN` 为 false，冷却被绕过。

**修复**: 增加 `!Number.isFinite(cooldownEnd)` 检查。

```typescript
isInCooldown(triggerType: AdvisorTriggerType): boolean {
  const cooldownEnd = this.state.cooldowns[triggerType];
  if (!cooldownEnd || !Number.isFinite(cooldownEnd)) return false;  // FIX-506
  return Date.now() < cooldownEnd;
}
```

---

### FIX-507: detectAllTriggers null 防护

**问题**: `snapshot = null` 或 `snapshot.leavingNpcs = undefined` 导致崩溃。

**修复**:
- 入口 `if (!snapshot) return [];`
- `leavingNpcs` / `newFeatures` / `upgradeableHeroes` 使用 `|| []` 默认值

```typescript
export function detectAllTriggers(snapshot, state, createSuggestion) {
  if (!snapshot) return [];  // FIX-507
  // ...
  const upgradeableHeroes = snapshot.upgradeableHeroes || [];
  const leavingNpcs = snapshot.leavingNpcs || [];
  const newFeatures = snapshot.newFeatures || [];
}
```

---

### FIX-508: init null 防护

**问题**: `deps.eventBus = null` 时 `.on()` 崩溃。

**修复**: 使用可选链 `this.deps.eventBus?.on(...)`.

```typescript
init(deps: ISystemDeps): void {
  this.deps = deps;
  this.deps.eventBus?.on('calendar:dayChanged', () => this.resetDaily());  // FIX-508
}
```

---

### FIX-509: executeSuggestion 未初始化防护

**问题**: `this.deps` 未初始化时 `.eventBus.emit()` 崩溃。

**修复**: 使用可选链 `this.deps?.eventBus?.emit(...)`.

```typescript
executeSuggestion(suggestionId: string) {
  // ...
  this.deps?.eventBus?.emit('advisor:suggestionExecuted', { ... });  // FIX-509
  return { success: true };
}
```

---

## 修复穿透验证

| 修复点 | 穿透检查 | 结果 |
|--------|---------|------|
| FIX-501 Detector.isInCooldown | AdvisorSystem.isInCooldown 是否一致 | ✅ 统一为 until 模式 |
| FIX-501 Detector.setCooldown | AdvisorSystem.dismissSuggestion 是否一致 | ✅ 都是 until 模式 |
| FIX-502 serialize suggestions | loadSaveData 是否恢复 | ✅ 已恢复+过滤过期 |
| FIX-506 isInCooldown NaN | getDisplayState cooldowns 过滤 | ✅ 同步增加 isFinite 检查 |
| FIX-507 detectAllTriggers null | findOverflowResource/findShortageResource | ✅ 已有 null 防护 |
| FIX-508 init eventBus | 其他使用 eventBus 处 | ✅ executeSuggestion 已修(FIX-509) |

## 未修复项（P1，下轮处理）

| ID | 描述 | 原因 |
|----|------|------|
| FIX-510 | 冷却时间配置统一到 advisor.types.ts | Arbiter 降级为 P1，影响有限 |
| P1-001 | suggestionCounter 模块级变量 | 多实例场景罕见 |
| P1-002 | getDisplayedSuggestions 浅拷贝 | 外部修改风险低 |
| P1-003 | getState 浅拷贝 | 同上 |
| P1-004 | createSuggestion 参数类型不安全 | 运行时无实际影响 |
| P1-005 | findOverflowResource 阈值不一致 | AdvisorSystem 内部方法未使用 |

## 编译验证

```
npx tsc --noEmit → 0 errors ✅
```
