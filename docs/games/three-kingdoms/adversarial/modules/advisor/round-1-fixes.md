# Advisor R1 修复报告

> 日期: 2026-05-01 | Fixer Agent | 规则版本 v1.8

## 修复摘要

| FIX-ID | 严重度 | 问题 | 修复方案 | 影响范围 |
|--------|--------|------|----------|----------|
| FIX-601 | P0 | 溢出阈值不一致：Detector 0.9 vs System 0.8 | 统一到0.8，删除System中重复死代码 | AdvisorTriggerDetector.ts + AdvisorSystem.ts |
| FIX-602 | P0 | serialize不保存allSuggestions → 活跃建议丢失 | AdvisorSaveData增加suggestions字段 | advisor.types.ts + AdvisorSystem.ts |
| FIX-603 | P0 | loadSaveData null崩溃 | null guard + reset回退 | AdvisorSystem.ts |
| FIX-604 | P0 | detectTriggers/updateSuggestions null崩溃 | 入口null guard | AdvisorSystem.ts |
| FIX-605 | P0 | detectAllTriggers null崩溃 | 已有FIX-507覆盖 | AdvisorTriggerDetector.ts |
| FIX-606 | P0 | loadSaveData NaN dailyCount绕过上限 | Number.isFinite检查+Math.floor | AdvisorSystem.ts |
| FIX-607 | P0 | loadSaveData非法triggerType写入cooldowns | 枚举白名单验证 | AdvisorSystem.ts |

## 详细修复

### FIX-601: 溢出阈值不一致

**问题**: AdvisorSystem.findOverflowResource 使用 `> 0.8` 阈值，AdvisorTriggerDetector.findOverflowResource 使用 `> 0.9` 阈值。设计规格 #14 要求 >80% 触发，但实际生效的是 Detector 的 0.9（因 detectTriggers 调用链经过 Detector）。System 中的 findOverflowResource 是死代码，从未被调用。

**修复**:
```typescript
// AdvisorTriggerDetector.ts — 阈值从 0.9 改为 0.8
// 修复前
if (cap > 0 && value / cap > 0.9) return key;
// 修复后
if (cap > 0 && value / cap > 0.8) return key;

// AdvisorSystem.ts — 删除死代码 findOverflowResource / findShortageResource
// 替换为注释说明已统一到 Detector
```

**影响**: 所有资源溢出检测现在在 >80% 时触发，符合设计规格。

### FIX-602: serialize丢失活跃建议

**问题**: `serialize()` 只保存 cooldowns/dailyCount/lastDailyReset，不保存 allSuggestions。`loadSaveData()` 恢复后 allSuggestions 为空数组（createInitialState），玩家存档前的活跃建议全部丢失。

**修复**:
```typescript
// advisor.types.ts — AdvisorSaveData 增加 suggestions 字段
export interface AdvisorSaveData {
  // ...原有字段
  suggestions: AdvisorSuggestion[];  // R1 FIX-602
}

// AdvisorSystem.ts — serialize 包含建议列表
return {
  // ...原有字段
  suggestions: this.state.allSuggestions,
};

// AdvisorSystem.ts — loadSaveData 恢复建议列表
this.state.allSuggestions = Array.isArray(data.suggestions)
  ? data.suggestions.filter(s => s && s.id && s.triggerType)
  : [];
```

**影响**: 存档/读档后活跃建议完整保留。

### FIX-603: loadSaveData null崩溃

**问题**: `loadSaveData(null)` 直接访问 `data.dailyCount`，TypeError 崩溃。

**修复**:
```typescript
loadSaveData(data: AdvisorSaveData): void {
  if (!data) {
    this.state = this.createInitialState();
    return;
  }
  // ...
}
```

### FIX-604: detectTriggers / updateSuggestions null崩溃

**问题**: `detectTriggers(null)` 和 `updateSuggestions(null)` 传入 null snapshot 时崩溃。

**修复**:
```typescript
detectTriggers(snapshot: GameStateSnapshot): AdvisorSuggestion[] {
  if (!snapshot) return [];  // FIX-604
  // ...
}

updateSuggestions(snapshot: GameStateSnapshot): void {
  if (!snapshot) return;  // FIX-604
  // ...
}
```

### FIX-605: detectAllTriggers null崩溃

**状态**: 已由 FIX-507 覆盖（之前轮次修复），无需额外修改。

### FIX-606: loadSaveData NaN dailyCount

**问题**: `data.dailyCount = NaN` 时，`NaN >= ADVISOR_DAILY_LIMIT` 为 false，每日上限失效。

**修复**:
```typescript
const rawCount = data.dailyCount;
this.state.dailyCount = (Number.isFinite(rawCount) && rawCount >= 0)
  ? Math.floor(rawCount)
  : 0;
```

### FIX-607: loadSaveData非法triggerType

**问题**: 恶意存档可注入任意字符串作为 triggerType，污染 cooldowns 数据。

**修复**:
```typescript
const validTypes = new Set<string>(Object.keys(ADVISOR_TRIGGER_PRIORITY));
// ...
if (cd && validTypes.has(cd.triggerType) && Number.isFinite(cd.cooldownUntil)) {
  this.state.cooldowns[cd.triggerType] = cd.cooldownUntil;
}
```

## 测试验证

```
✓ AdvisorTriggerDetector.test.ts — 13 tests passed
✓ AdvisorSystem.test.ts — 22 tests passed
✓ TypeScript编译 — 0 errors
✓ 全部35个测试通过
```

## 未修复项（P1，留待R2）

| FIX-ID | 问题 | 原因 |
|--------|------|------|
| FIX-610 | Detector冷却死代码（COOLDOWN_MS/isInCooldown/setCooldown从未被调用） | 不影响功能，R2清理 |
| FIX-611 | calendar:dayChanged事件链路测试缺失 | 需新增测试用例 |
| FIX-612 | executeSuggestion事件发射验证缺失 | 需新增测试用例 |

## 修改文件清单

| 文件 | 修改内容 |
|------|---------|
| `core/advisor/advisor.types.ts` | AdvisorSaveData 增加 suggestions 字段 |
| `engine/advisor/AdvisorSystem.ts` | FIX-601删除死代码 + FIX-602序列化建议 + FIX-603/604/606/607防护 |
| `engine/advisor/AdvisorTriggerDetector.ts` | FIX-601阈值0.9→0.8 |
