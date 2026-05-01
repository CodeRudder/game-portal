# Tutorial R2 — Challenger 挑战报告

> Challenger: agent | 日期: 2026-05-01
> 挑战对象: Builder `round-2-tree.md` + R1 修复后源码

## 挑战总览

| 指标 | 值 |
|------|-----|
| 审查节点数 | 28 (Builder R2) |
| R1 修复穿透验证 | 6/6 ✅ |
| 新发现 P0 | 1 |
| 新发现 P1 | 2 |
| 新发现 P2 | 1 |

---

## R1 修复穿透验证

| FIX ID | 穿透状态 | 验证方式 |
|--------|----------|----------|
| FIX-T01 (serialize stepCompletionTimes/startedAt) | ✅ 穿透 | L347-348 保存，L375-381 恢复 |
| FIX-T02 (loadSaveData null 防护) | ✅ 穿透 | L357 `if (!data)` |
| FIX-T03 (completeCurrentStep init 防护) | ✅ 穿透 | L142 `if (!this.deps)` |
| FIX-T04 (engine-save 接入) | ✅ 穿透 | engine-save.ts 5处引用 |
| FIX-T05 (过滤无效 stepId) | ✅ 穿透 | L366-369 validIds Set |
| FIX-T06 (skipTutorial 防重复 emit) | ✅ 穿透 | L235 `if (this.state.skipped) return` |

**结论**: R1 全部 6 个 FIX 已穿透到源码，无遗漏。

---

## 新发现问题

### P0-7: skipTutorial() 未初始化时崩溃 [🔴 P0]

**严重度**: P0 — 运行时崩溃  
**位置**: `tutorial-system.ts` L238 `this.deps.eventBus.emit(...)`  
**Builder 节点**: T4-1/T4-2/T4-3 未覆盖

**分析**:
- `completeCurrentStep()` 有 FIX-T03 的 `if (!this.deps)` 防护
- 但 `skipTutorial()` **没有相同的防护**
- 如果在 `init(deps)` 之前调用 `skipTutorial()`：
  1. `this.state.skipped` = false → 通过
  2. `this.isTutorialComplete()` = false → 通过
  3. `this.deps.eventBus.emit(...)` → **TypeError: Cannot read properties of undefined**

**复现**:
```typescript
const tutorial = new TutorialSystem();
// 未调用 init(deps)
tutorial.skipTutorial(); // 💥 TypeError crash
```

**与 FIX-T03 不一致**: `completeCurrentStep` 有防护但 `skipTutorial` 没有，是 R1 修复遗漏。

**修复建议**: 在 `skipTutorial()` 入口添加 `if (!this.deps)` 防护，或安全访问 `this.deps?.eventBus`。

---

### P1-4: loadSaveData 不校验 stepCompletionTimes 值类型 [🟡 P1]

**严重度**: P1 — 恶意存档可注入非数值  
**位置**: `tutorial-system.ts` L375-377  
**Builder 节点**: T5-4 部分覆盖（只测了字段缺失，未测值类型）

**分析**:
```typescript
this.state.stepCompletionTimes =
  data.stepCompletionTimes && typeof data.stepCompletionTimes === 'object'
    ? { ...data.stepCompletionTimes }
    : {};
```
- 只检查了 `typeof === 'object'`，未校验每个 value 是否为 finite number
- 恶意存档可注入 `{ stepCompletionTimes: { claim_newbie_pack: NaN } }` 或 `{ claim_newbie_pack: Infinity }`
- `getTutorialStats()` 使用 `times.reduce((sum, t) => sum + (t - startedAt), 0)` → NaN 传播
- `avgCompletionTimeMs` 返回 NaN → UI 显示异常

**修复建议**: loadSaveData 恢复 stepCompletionTimes 时过滤非 finite number 值：
```typescript
Object.entries(data.stepCompletionTimes).forEach(([key, val]) => {
  if (typeof val === 'number' && Number.isFinite(val)) {
    result[key] = val;
  }
});
```

---

### P1-5: loadSaveData 不校验 startedAt 值合理性 [🟡 P1]

**严重度**: P1 — 异常值导致统计计算错误  
**位置**: `tutorial-system.ts` L379-381  
**Builder 节点**: 无覆盖

**分析**:
```typescript
this.state.startedAt =
  data.startedAt !== undefined && data.startedAt !== null
    ? data.startedAt
    : null;
```
- 未校验 `startedAt` 是否为 finite number
- `data.startedAt = NaN` → `NaN !== undefined && NaN !== null` → true → `startedAt = NaN`
- `getTutorialStats()` 中 `t - startedAt` → NaN
- `data.startedAt = -1` → 负时间戳 → avgCompletionTimeMs 为极大值

**修复建议**: 添加 `typeof data.startedAt === 'number' && Number.isFinite(data.startedAt) && data.startedAt > 0` 校验。

---

### P2-1: loadSaveData 不验证 completedSteps 去重 [⚪ P2]

**严重度**: P2 — 重复 ID 不影响功能但数据不干净  
**位置**: `tutorial-system.ts` L366-369  
**Builder 节点**: T5-3 部分覆盖

**分析**:
```typescript
const rawSteps = Array.isArray(data.completedSteps) ? data.completedSteps : [];
this.state.completedSteps = rawSteps.filter(
  (id: string) => validIds.has(id),
) as TutorialGuideStepId[];
```
- 过滤了非法 ID，但未去重
- 恶意存档 `{ completedSteps: ['claim_newbie_pack', 'claim_newbie_pack'] }` → `completedSteps` 包含重复
- `getProgress().completed` 返回 2 而非 1 → 百分比计算错误 (50% 而非 25%)
- `isTutorialComplete()` 依赖 `completedSteps.length >= TOTAL_STEPS` → 可能误判

**修复建议**: 添加去重 `[...new Set(rawSteps.filter(...))]`。

---

## Builder R2 树评审

| Builder 节点 | 评审意见 |
|-------------|----------|
| T1-1 ~ T1-3 | ✅ 充分 |
| T2-1 ~ T2-4 | ✅ 充分 |
| T3-1 ~ T3-5 | ✅ 充分，T3-4 回归 FIX-T03 |
| T4-1 ~ T4-3 | ⚠️ 缺少 skipTutorial 未初始化场景（P0-7） |
| T5-1 ~ T5-6 | ⚠️ T5-4 缺少值类型校验（P1-4），T5-6 版本迁移合理 |
| T6-1 ~ T6-4 | ✅ T6-4 全链路是好的新增 |
| T7-1 ~ T7-3 | ✅ 充分 |
| T8-1 ~ T8-2 | ✅ T8-2 奖励防重是好的新增 |

**Builder 覆盖率评估**: 7.5/10 — 缺少 skipTutorial 未初始化场景和 loadSaveData 值类型校验

---

## 修复优先级建议

| 优先级 | ID | 修复内容 | 工作量 |
|--------|-----|----------|--------|
| **P0** | P0-7 | skipTutorial 添加 deps null 防护 | 1行 |
| P1 | P1-4 | loadSaveData stepCompletionTimes 值校验 | 5行 |
| P1 | P1-5 | loadSaveData startedAt 值校验 | 3行 |
| P2 | P2-1 | loadSaveData completedSteps 去重 | 1行 |

**总工作量**: ~10行代码 + 4个测试用例
