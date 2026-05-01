# Tutorial R2 — Fixer 修复报告

> Fixer: agent | 日期: 2026-05-01
> 基于 Challenger `round-2-challenges.md` 执行修复

## 修复清单

### FIX-T07: skipTutorial 未初始化防护 [P0-7]

**状态**: ✅ 本轮新增修复

**修改文件**: `src/games/three-kingdoms/engine/tutorial/tutorial-system.ts`

```typescript
// 修改前:
skipTutorial(): void {
  // FIX-T06: 防止重复跳过和重复emit
  if (this.state.skipped) return;
  ...

// 修改后:
skipTutorial(): void {
  // FIX-T07 (R2): 未初始化时安全返回（与 FIX-T03 对称）
  if (!this.deps) return;
  // FIX-T06: 防止重复跳过和重复emit
  if (this.state.skipped) return;
  ...
```

**测试覆盖**: `tutorial-adversarial-r2.test.ts` FIX-T07 测试组（3个用例）

---

### FIX-T08: loadSaveData stepCompletionTimes 值类型校验 [P1-4]

**状态**: ✅ 本轮新增修复

**修改文件**: `src/games/three-kingdoms/engine/tutorial/tutorial-system.ts`

```typescript
// 修改前:
this.state.stepCompletionTimes =
  data.stepCompletionTimes && typeof data.stepCompletionTimes === 'object'
    ? { ...data.stepCompletionTimes }
    : {};

// 修改后:
if (data.stepCompletionTimes && typeof data.stepCompletionTimes === 'object') {
  const times: Record<string, number> = {};
  for (const [key, val] of Object.entries(data.stepCompletionTimes)) {
    if (typeof val === 'number' && Number.isFinite(val)) {
      times[key] = val;
    }
  }
  this.state.stepCompletionTimes = times;
} else {
  this.state.stepCompletionTimes = {};
}
```

**测试覆盖**: `tutorial-adversarial-r2.test.ts` FIX-T08 测试组（5个用例）

---

### FIX-T09: loadSaveData startedAt 值合理性校验 [P1-5]

**状态**: ✅ 本轮新增修复

**修改文件**: `src/games/three-kingdoms/engine/tutorial/tutorial-system.ts`

```typescript
// 修改前:
this.state.startedAt =
  data.startedAt !== undefined && data.startedAt !== null
    ? data.startedAt
    : null;

// 修改后:
this.state.startedAt =
  typeof data.startedAt === 'number' && Number.isFinite(data.startedAt) && data.startedAt > 0
    ? data.startedAt
    : null;
```

**测试覆盖**: `tutorial-adversarial-r2.test.ts` FIX-T09 测试组（5个用例）

---

### FIX-T10: loadSaveData completedSteps 去重 [P2-1]

**状态**: ✅ 本轮新增修复

**修改文件**: `src/games/three-kingdoms/engine/tutorial/tutorial-system.ts`

```typescript
// 修改前:
this.state.completedSteps = rawSteps.filter(
  (id: string) => validIds.has(id),
) as TutorialGuideStepId[];

// 修改后:
this.state.completedSteps = [...new Set(
  rawSteps.filter((id: string) => validIds.has(id))
)] as TutorialGuideStepId[];
```

**测试覆盖**: `tutorial-adversarial-r2.test.ts` FIX-T10 测试组（3个用例）

---

## 测试结果

```
✓ tutorial-adversarial-r2.test.ts  (16 tests) — 新增16个测试
✓ tutorial-adversarial-r1.test.ts  (29 tests)
✓ tutorial-system-enhanced.test.ts (37 tests)
✓ tutorial-system.test.ts          (59 tests)
✓ AdvisorRules.test.ts             (47 tests)

Test Files  5 passed (5)
     Tests  188 passed (188)
```

## 修复统计

| FIX ID | P级别 | 状态 | 类型 |
|--------|-------|------|------|
| FIX-T07 | P0 | **本轮新增** | skipTutorial 未初始化防护 |
| FIX-T08 | P1 | **本轮新增** | stepCompletionTimes 值校验 |
| FIX-T09 | P1 | **本轮新增** | startedAt 值合理性校验 |
| FIX-T10 | P2 | **本轮新增** | completedSteps 去重 |

**本轮新增修复**: 4个
**新增测试用例**: 16个
**累计测试**: 188 passed
