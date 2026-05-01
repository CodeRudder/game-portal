# Tutorial R1 — Challenger 质疑报告

> Challenger: agent | 日期: 2026-05-01
> 审查范围: `tutorial-system.ts` + `tutorial-config.ts` + `ThreeKingdomsEngine.ts` + `engine-save.ts`

## P0 缺陷（必须修复）

### P0-1: serialize() 丢失 stepCompletionTimes 和 startedAt [FS-01/FS-02]

**严重度**: P0 — 数据丢失  
**源码**: `tutorial-system.ts` L262-266

```typescript
serialize(): TutorialGuideSaveData {
    return {
      version: TUTORIAL_GUIDE_SAVE_VERSION,
      completedSteps: [...this.state.completedSteps],
      skipped: this.state.skipped,
    };
  }
```

**问题**: `stepCompletionTimes` 和 `startedAt` 是 `TutorialGuideInternalState` 的核心字段，但 `serialize()` 不保存它们。`loadSaveData()` 也不恢复它们。

**影响链路**:
1. 玩家完成3步后存档
2. 读档后 `stepCompletionTimes = {}`, `startedAt = null`
3. `getTutorialStats()` 返回 `avgCompletionTimeMs = 0`（错误统计）
4. 如果后续功能依赖 `stepCompletionTimes`（如超时自动完成），将完全失效

**Builder遗漏**: FS-01/FS-02/FS-03 正确识别，但未标注为P0-1独立问题。

---

### P0-2: loadSaveData() 无null防护 [FE-01/FE-02]

**严重度**: P0 — 运行时崩溃  
**源码**: `tutorial-system.ts` L272-275

```typescript
loadSaveData(data: TutorialGuideSaveData): void {
    this.state.completedSteps = [...data.completedSteps]; // data=null → 崩溃
    this.state.skipped = data.skipped; // data.completedSteps=undefined → [undefined] 污染
  }
```

**攻击路径**:
1. `loadSaveData(null)` → `Cannot read properties of null (reading 'completedSteps')`
2. `loadSaveData({version:1, completedSteps: undefined, skipped: false})` → `[...undefined]` → TypeError
3. `loadSaveData({version:1})` → `data.completedSteps` undefined → 同上

**Builder遗漏**: FE-01/FE-02 正确识别。

---

### P0-3: completeCurrentStep() 在 init() 前调用崩溃 [FE-04]

**严重度**: P0 — 运行时崩溃  
**源码**: `tutorial-system.ts` L136

```typescript
completeCurrentStep(action: string): CompleteStepResult {
    // ... 跳过/完成检查 ...
    this.deps.eventBus.emit('tutorial-guide:stepCompleted', { ... }); // this.deps 为 undefined!
  }
```

**攻击路径**:
1. `new TutorialSystem()` → 不调用 `init()`
2. 直接调用 `completeCurrentStep('claim_newbie_pack')`
3. `this.deps` 为 `undefined` → 崩溃

**分析**: `this.deps!` 使用了非空断言，TypeScript编译不报错但运行时崩溃。

**Builder遗漏**: FE-04 正确识别。

---

### P0-4: TutorialSystem 未接入 engine-save 系统 [FC-01/FC-02/FS-04]

**严重度**: P0 — 存档数据完全丢失  
**源码**: `ThreeKingdomsEngine.ts` L842-877

```typescript
private buildSaveCtx(): SaveContext {
    return {
      resource: this.resource, building: this.building, calendar: this.calendar,
      hero: this.hero, recruit: this.heroRecruit, formation: this.heroFormation,
      // ... 20+ 个子系统 ...
      // ❌ 缺少: tutorialGuide: this.tutorialGuide,
    };
  }
```

**验证**: 在 `engine-save.ts` 中搜索 `tutorial` → 零匹配。

**影响**:
1. 玩家完成3步引导后存档
2. 读档后引导状态完全丢失
3. `getCurrentStep()` 返回第1步，玩家被迫重新做引导
4. 如果第1步奖励已发放（100招贤令+5000铜钱+技能书），可能导致重复领取

**Builder遗漏**: FC-01/FC-02/FS-04 正确识别，这是最严重的系统性缺陷。

---

### P0-5: loadSaveData 不恢复 stepCompletionTimes 和 startedAt [FS-03]

**严重度**: P0 — 数据不完整  
**源码**: `tutorial-system.ts` L272-275

即使修复了 serialize() 保存这两个字段，loadSaveData() 也需要恢复它们。当前实现：

```typescript
loadSaveData(data: TutorialGuideSaveData): void {
    this.state.completedSteps = [...data.completedSteps];
    this.state.skipped = data.skipped;
    // ❌ 不恢复 stepCompletionTimes
    // ❌ 不恢复 startedAt
  }
```

**TutorialGuideSaveData 接口也不包含这两个字段**，需要扩展。

---

## P1 缺陷（建议修复）

### P1-1: loadSaveData 不验证 completedSteps 内容 [FE-03]

**源码**: `tutorial-system.ts` L273

```typescript
this.state.completedSteps = [...data.completedSteps];
```

如果 `data.completedSteps` 包含无效的 stepId（如 `'hacked_step'`），会直接注入到状态中，导致：
- `isStepCompleted('hacked_step')` 返回 true
- `isTutorialComplete()` 可能返回 true（如果 length >= 4）
- `getCurrentStep()` 返回 null

### P1-2: skipTutorial() 无防重复emit [FB-04]

**源码**: `tutorial-system.ts` L193-197

```typescript
skipTutorial(): void {
    if (this.isTutorialComplete()) return;
    this.state.skipped = true;
    this.deps.eventBus.emit('tutorial-guide:skipped', { ... });
  }
```

多次调用 `skipTutorial()` 会多次 emit `skipped` 事件。虽然有 `isTutorialComplete()` 检查，但跳过后再次调用时 `skipped` 已经是 true，不会再次 emit（因为不进入 `isTutorialComplete` 分支）。实际上这个检查有漏洞：跳过但未完成时，再次调用会再次emit。

### P1-3: 双引导系统并存无交互 [FC-03]

项目存在两套引导系统：
- `engine/tutorial/TutorialSystem` — 简化版4步引导
- `engine/guide/TutorialStateMachine` — 完整状态机引导

两者无任何交互，可能导致：
- 两套引导同时运行
- 玩家被重复引导
- 存档只保存 guide 系统，丢失 tutorial 系统

## P0 修复优先级

| 优先级 | P0 ID | 修复范围 | 影响面 |
|--------|-------|----------|--------|
| 1 | P0-4 | ThreeKingdomsEngine + engine-save | 存档系统级 |
| 2 | P0-1/P0-5 | TutorialGuideSaveData + serialize + loadSaveData | 数据完整性 |
| 3 | P0-2 | loadSaveData null防护 | 运行时安全 |
| 4 | P0-3 | completeCurrentStep init检查 | 运行时安全 |

## 对 Builder 树的评价

- **Normal/Boundary 覆盖充分**：16+10=26个节点，与现有测试吻合
- **Error 路径识别准确**：FE-01~FE-06 全部为真实风险
- **Serialize 路径发现关键**：FS-01~FS-05 揭示了系统性设计缺陷
- **CrossSystem 是本轮最大价值**：FC-01/FC-02 发现 TutorialSystem 完全游离于存档系统之外
- **评分**: Builder树质量 8.5/10，P0识别完整，扣分在P1-2的skipTutorial重复emit分析不够深入
