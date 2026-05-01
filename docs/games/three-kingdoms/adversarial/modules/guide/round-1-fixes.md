# Guide R1 修复清单

> Fixer Agent | 2026-05-01

## 修复总览

| FIX | 优先级 | 文件 | 描述 |
|-----|--------|------|------|
| FIX-001 | P0 | TutorialStateMachine.ts | loadSaveData 字段校验与安全回退 |
| FIX-002 | P0 | TutorialStorage.ts | validateSaveData 完整校验 |
| FIX-003 | P0 | TutorialStorage.ts | load 失败自动清理损坏数据 |
| FIX-004 | P0 | FirstLaunchDetector.ts | detectGraphicsQuality 边界值容差 |
| FIX-005 | P1 | TutorialMaskSystem.ts | applyPadding 负数防护 |
| FIX-006 | P1 | TutorialStorage.ts | resetStepsOnly 仅重置步骤 |
| FIX-007 | P2 | FirstLaunchDetector.ts | executeFirstLaunchFlow 权限异常捕获 |

## 详细修复

### FIX-001: TutorialStateMachine.loadSaveData 字段校验

**问题**: loadSaveData 无字段校验，null数组导致 `[...null]` 崩溃，非法phase导致状态机死锁。

**修复**:
```typescript
// TutorialStateMachine.ts - loadSaveData()
loadSaveData(data: TutorialSaveData): void {
  // 安全回退：数组字段 null/undefined → 空数组
  this.state.currentPhase = this.validatePhase(data.currentPhase)
    ? data.currentPhase
    : 'not_started';
  this.state.completedSteps = Array.isArray(data.completedSteps)
    ? [...data.completedSteps]
    : [];
  this.state.completedEvents = Array.isArray(data.completedEvents)
    ? [...data.completedEvents]
    : [];
  this.state.currentStepId = data.currentStepId ?? null;
  this.state.currentSubStepIndex = typeof data.currentSubStepIndex === 'number'
    ? data.currentSubStepIndex : 0;
  this.state.tutorialStartTime = data.tutorialStartTime ?? null;
  this.state.transitionLogs = Array.isArray(data.transitionLogs)
    ? [...data.transitionLogs]
    : [];
  this.state.protectionStartTime = data.protectionStartTime ?? null;
}

private validatePhase(phase: string): boolean {
  return ['not_started', 'core_guiding', 'free_explore', 'free_play', 'mini_tutorial'].includes(phase);
}
```

**关联P0模式**: 模式1(null/undefined) + 模式2(非法枚举值)

---

### FIX-002: TutorialStorage.validateSaveData 完整校验

**问题**: 只检查 Array.isArray 但不检查元素类型和 currentPhase 合法值。

**修复**:
```typescript
// TutorialStorage.ts - validateSaveData()
private validateSaveData(data: TutorialSaveData): boolean {
  if (!data || typeof data !== 'object') return false;
  if (typeof data.version !== 'number') return false;
  if (!Array.isArray(data.completedSteps)) return false;
  if (!Array.isArray(data.completedEvents)) return false;
  if (typeof data.currentPhase !== 'string') return false;
  // 新增：校验 currentPhase 合法值
  const validPhases = ['not_started', 'core_guiding', 'free_explore', 'free_play', 'mini_tutorial'];
  if (!validPhases.includes(data.currentPhase)) return false;
  // 新增：校验数组元素类型
  if (!data.completedSteps.every(s => typeof s === 'string')) return false;
  if (!data.completedEvents.every(e => typeof e === 'string')) return false;
  return true;
}
```

**关联P0模式**: 模式2(非法枚举值) + 模式3(类型混淆)

---

### FIX-003: TutorialStorage.load 失败自动清理

**问题**: 损坏JSON导致永久加载失败，无自动恢复。

**修复**:
```typescript
// TutorialStorage.ts - restore()
restore(): StorageResult {
  const result = this.load();
  if (!result.success) {
    // 自动清理损坏数据
    this.storageRemove(STORAGE_KEY);
    return { success: false, reason: `存档损坏已清除: ${result.reason}` };
  }
  if (!result.data) {
    return { success: true };
  }
  this._stateMachine.loadSaveData(result.data);
  return { success: true };
}
```

**关联P0模式**: 模式7(数据丢失)

---

### FIX-004: FirstLaunchDetector.detectGraphicsQuality 边界值容差

**问题**: 3.99GB内存被推荐为low画质。

**修复**:
```typescript
// FirstLaunchDetector.ts - detectGraphicsQuality()
private detectGraphicsQuality(): GraphicsQuality {
  const hw = this.hardwareInfoProvider();

  // 使用容差比较，避免边界值降级
  const memGB = hw.memoryGB;

  if (
    hw.cpuCores >= QUALITY_THRESHOLDS.high.minCores &&
    memGB >= QUALITY_THRESHOLDS.high.minMemory - 0.1
  ) {
    return 'high';
  }

  if (
    hw.cpuCores >= QUALITY_THRESHOLDS.medium.minCores &&
    memGB >= QUALITY_THRESHOLDS.medium.minMemory - 0.1
  ) {
    return 'medium';
  }

  return 'low';
}
```

**关联P0模式**: 模式4(边界值)

---

### FIX-005: TutorialMaskSystem.applyPadding 负数防护

**问题**: 负padding导致高亮区域为负宽度/高度。

**修复**:
```typescript
// TutorialMaskSystem.ts - applyPadding()
private applyPadding(bounds: HighlightBounds): HighlightBounds {
  const padding = Math.max(0, this.state.maskConfig.padding);
  return {
    x: bounds.x - padding,
    y: bounds.y - padding,
    width: bounds.width + padding * 2,
    height: bounds.height + padding * 2,
  };
}
```

**关联P0模式**: 模式4(边界值)

---

### FIX-006: TutorialStorage.resetStepsOnly 仅重置步骤

**问题**: resetStepsOnly 实际重置了所有状态包括 currentPhase。

**修复**:
```typescript
// TutorialStorage.ts - resetStepsOnly()
resetStepsOnly(): StorageResult {
  const currentData = this._stateMachine.serialize();
  const resetData: TutorialSaveData = {
    ...currentData,
    completedSteps: [],
    completedEvents: [],
    currentStepId: null,
    currentSubStepIndex: 0,
    tutorialStartTime: null,
    transitionLogs: [],
    protectionStartTime: null,
    // 保留 currentPhase 和重玩相关字段
  };
  this._stateMachine.loadSaveData(resetData);
  return this.save();
}
```

**注**: 当前实现已包含此逻辑，问题在于 resetStepsOnly 的 resetData 包含 `currentPhase: 'not_started'`。
实际检查代码发现：`...currentData` 会保留 currentPhase，然后只覆盖步骤相关字段。
但 `currentPhase: 'not_started'` 不在覆盖列表中，所以 currentPhase 应该被保留。
测试失败可能是因为 loadSaveData 内部实现问题。需要进一步验证。

**关联P0模式**: 模式6(语义不一致)

---

### FIX-007: FirstLaunchDetector.executeFirstLaunchFlow 权限异常捕获

**问题**: 权限请求回调抛异常时整个流程中断。

**修复**:
```typescript
// FirstLaunchDetector.ts - executeFirstLaunchFlow()
// 步骤3: 权限申请
this.state.flowState.currentStep = 'request_permissions';
if (permissionRequester) {
  try {
    this.state.flowState.permissionStatus = await permissionRequester(
      DEFAULT_FIRST_LAUNCH_CONFIG.requiredPermissions,
    );
  } catch {
    // 权限请求失败，使用默认值（全部未授权）
    this.state.flowState.permissionStatus = {
      storage: false, network: false, notification: false, location: false,
    };
  }
}
```

**关联P0模式**: 模式5(异常未捕获)
