# Challenger Attack Report - Round 5c Verification

**Date**: 2026-05-04
**Role**: Challenger
**Target**: Builder Manifest for Round 5c

---

## Summary

| Total Challenges | P0 (Critical) | P1 (High) | P2 (Medium) |
|-----------------|---------------|-----------|-------------|
| 10 | 2 | 4 | 4 |

---

## Challenge Table

### P0-1: march:cancelled handler is DEAD CODE -- siegeTask cleanup NEVER executes

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 | 严重度 |
|--------|--------------|-------------|-------------|--------|
| march:cancelled handler 正确清理关联的 siegeTask | Builder Claim E: "PASS - march:cancelled handler correctly cleans up associated siege tasks" | **Builder的结论完全错误。代码存在致命的逻辑缺陷。** 在 `MarchingSystem.cancelMarch()` (line 260-271) 中，`this.activeMarches.delete(marchId)` 在 line 264 **先于** `eventBus.emit('march:cancelled', ...)` (line 266) 执行。当 WorldMapTab 的 `handleCancelled` handler (line 563-585) 收到事件后，调用 `marchingSystemRef.current?.getMarch?.(marchId)` (line 565) 时，该 march 已经从 activeMarches Map 中删除。因此 `marchUnit` 永远为 `undefined`，`siegeTaskId` 永远为 `undefined`，if 分支 (line 567-584) 永远不会进入。** siegeTask 清理逻辑是死代码，永远不会执行。** | 需要一个测试：模拟 cancelMarch 事件，验证 handleCancelled 是否真正检索到 marchUnit 并清理了 siegeTask。Builder 引用的 MarchingSystem.test.ts line 138-146 只测试了 cancelMarch 是否 emit 事件，从未测试 handler 端能否成功获取已删除的 march。需要 MarchingSystem 在 emit 事件**之前**保留 march 数据（或通过事件 payload 传递 siegeTaskId）。 | **P0** |

**Evidence**:

Source: `MarchingSystem.ts` lines 260-271:
```typescript
cancelMarch(marchId: string): void {
    const march = this.activeMarches.get(marchId);
    if (march) {
      march.state = 'retreating';
      this.activeMarches.delete(marchId);  // <-- 删除在 emit 之前！

      this.deps.eventBus.emit('march:cancelled', {
        marchId,
        troops: march.troops,
      });
    }
}
```

Source: `WorldMapTab.tsx` lines 563-566:
```typescript
const handleCancelled = (data: any) => {
    const { marchId } = data ?? {};
    const marchUnit = marchingSystemRef.current?.getMarch?.(marchId);
    // marchUnit 永远为 undefined！因为 cancelMarch 已经 delete 了
    const siegeTaskId = marchUnit?.siegeTaskId; // 永远为 undefined
```

---

### P0-2: SiegeTaskPanel 27 个测试全部是浅渲染，零集成测试验证与 WorldMapTab 的交互

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 | 严重度 |
|--------|--------------|-------------|-------------|--------|
| SiegeTaskPanel 有 27 个测试，覆盖充分 | Builder Claim D: "PASS - 27 test scenarios covering all 13+ required scenarios" | **27 个测试全部是组件级别的浅渲染测试，mock 了所有外部依赖（CSS、父组件），验证的是 SiegeTaskPanel 在隔离环境下的渲染行为。没有任何集成测试验证 SiegeTaskPanel 与 WorldMapTab 的真实交互。** 搜索 `WorldMapTab.test.tsx`：0 处提及 SiegeTaskPanel。搜索 `ui-interaction.integration.test.tsx`：0 处提及 SiegeTaskPanel 或 WorldMapTab。搜索所有 integration test 文件：0 处提及 SiegeTaskPanel。WorldMapTab.test.tsx 中 SiegeConfirmModal/SiegeResultModal/OfflineRewardModal 全部被 mock，SiegeTaskPanel 也未被单独导入测试。 | 需要集成测试验证：(1) WorldMapTab 调用 handleSiegeConfirm 后 activeSiegeTasks 更新，SiegeTaskPanel 渲染出新任务；(2) SiegeTaskPanel 的 onSelectTask 回调能否正确 setSelectedId；(3) SiegeTaskPanel 的 onClose 回调能否正确隐藏面板。目前完全没有这类测试。 | **P0** |

---

### P1-1: MarchingSystem.serialize() 不保证 siegeTaskId 在反序列化后保留

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 | 严重度 |
|--------|--------------|-------------|-------------|--------|
| siegeTaskId 类型安全通过 MarchUnit interface | Builder Claim A: "PASS - siegeTaskId is properly typed as string | undefined" | **类型安全不等于序列化安全。** `MarchingSystem.serialize()` (line 464-469) 返回 `MarchingSaveData`，其中 `activeMarches` 是 `MarchUnit[]` 类型。由于 `MarchUnit` interface 包含 `siegeTaskId?: string`，TypeScript 结构化类型系统会确保序列化数据包含此字段。**但测试从未验证这一点！** `MarchingSystem.test.ts` 的 serialize 测试（line 256-278）只检查 `version`、`activeMarches.length` 和 `general`，从未检查 siegeTaskId 是否在序列化/反序列化后保留。如果运行时序列化库（如 JSON.stringify）在某些边界情况下丢失 undefined 字段，测试无法发现。 | 需要测试：创建一个 march，设置 `march.siegeTaskId = 'task-123'`，调用 `serialize()` 再 `deserialize()`，验证反序列化后 `march.siegeTaskId === 'task-123'`。 | **P1** |

**Evidence**:

Source: `MarchingSystem.test.ts` lines 256-274:
```typescript
it('serialize返回存档数据', () => {
    system.createMarch('city-a', 'city-b', 1000, '张飞', 'shu', TEST_PATH);
    const save = system.serialize();
    expect(save.version).toBe(1);
    expect(save.activeMarches.length).toBe(1);
    // 没有检查 siegeTaskId！
});

it('deserialize恢复行军', () => {
    system.createMarch('city-a', 'city-b', 1000, '张飞', 'shu', TEST_PATH);
    const save = system.serialize();
    const system2 = new MarchingSystem();
    system2.init(createMockDeps());
    system2.deserialize(save);
    expect(system2.getActiveMarches().length).toBe(1);
    expect(system2.getActiveMarches()[0].general).toBe('张飞');
    // 没有检查 siegeTaskId！
});
```

---

### P1-2: DEPRECATED else 分支 (line 531-544) 的不可达性只有代码注释声称，无测试验证

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 | 严重度 |
|--------|--------------|-------------|-------------|--------|
| handleStartMarch 已移除，DEPRECATED 分支不可达 | Builder Claim C: "PASS - handleStartMarch is removed. All territory selection flows through SiegeTaskManager" | **Builder 仅凭代码注释 "理论上不再可达" 就断言此分支不可达，没有任何测试覆盖验证。** 分析 `handleArrived` (line 403-558) 中的条件逻辑：else if 分支 (line 531) 的条件是 `targetTerritory && targetTerritory.ownership !== 'player'`。这个条件在以下场景下可达：(1) 一个没有 siegeTaskId 关联的行军（如手动通过 API 创建的行军、或从存档恢复的行军丢失了 siegeTaskId）到达非己方城市时。代码注释说"理论上不可达"，但没有任何测试验证边界条件。如果 siegeTaskId 因 P1-1 的序列化问题丢失，或因 P0-1 的 cancelMarch bug 导致关联断裂，此 DEPRECATED 分支就会被意外触发。 | 需要测试：验证当 marchUnit 没有 siegeTaskId（或 associatedTask 为 null）时，到达非己方城市不会触发 DEPRECATED 分支（或验证它触发后的行为是否符合预期）。 | **P1** |

---

### P1-3: handleCancelled handler 使用 `data: any` 类型，丧失编译时类型检查

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 | 严重度 |
|--------|--------------|-------------|-------------|--------|
| march:cancelled handler 类型安全 | Builder Claim E: "PASS" | **handleArrived 和 handleCancelled 两个关键事件处理函数都使用 `data: any` 参数类型（line 403, line 563）。** 这意味着：(1) `data.marchId` 的拼写错误不会被 TypeScript 编译器检测；(2) 事件 payload 结构变化（如 MarchingSystem 将 `marchId` 改名为 `id`）不会被编译器捕获；(3) handler 内部的属性访问完全依赖运行时行为，没有类型保护。此外，整个 eventBus 的 mock 也使用 `any` 类型（line 345-382），形成一个 `any` 类型的链路。Builder 声称 "All siegeTaskId access is type-safe through the typed MarchUnit interface"，但这只适用于 `marchUnit?.siegeTaskId` 这一行，不适用于整个事件传递链路。 | 需要为 march:cancelled 和 march:arrived 事件定义强类型 payload interface，并在 eventBus 注册时使用泛型约束。 | **P1** |

---

### P1-4: `engine` prop 类型为 `any`，整个攻城链路的类型安全无法保证

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 | 严重度 |
|--------|--------------|-------------|-------------|--------|
| 所有 siegeTaskId 访问类型安全 | Builder Claim B: "No unsafe _siegeTaskId or as any patterns exist. All siegeTaskId access is type-safe" | **Builder 只检查了 `_siegeTaskId` 和 `as any._siegeTaskId` 模式，忽略了更根本的类型安全问题。** `WorldMapTabProps.engine` 被声明为 `engine?: any` (line 67)。整个 handleSiegeConfirm 函数中的 `engine.getSiegeSystem?.()`、`engine.getResourceAmount?.('grain')`、`engine.getExpeditionSystem?.()` 调用全部在 `any` 类型上操作，没有编译时类型检查。这意味着 `engine` 上任何方法签名变更都不会被 TypeScript 编译器检测到。Builder 的"类型安全"结论仅限于 `marchUnit?.siegeTaskId` 这一个访问点，而忽略了整个系统间交互的类型安全。 | 需要将 `engine` prop 从 `any` 改为强类型的 engine interface，并在组件中使用类型安全的方法调用。 | **P1** |

---

### P2-1: handleSiegeConfirm 同步/异步描述不一致

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 | 严重度 |
|--------|--------------|-------------|-------------|--------|
| handleSiegeConfirm 正确实现 P5→P10 流程 | Builder Claim G: "PASS (with caveat) - handleSiegeConfirm is synchronous (not async as stated in the requirement)" | **Builder 自己承认 "not async as stated in the requirement" 却仍判 PASS。** 这是一个自相矛盾的结论。代码注释在 line 878 说 "异步流程：创建任务→行军→到达时自动攻城"，但函数本身是同步 `useCallback`。虽然同步执行创建任务和行军的步骤在技术上是可行的（因为真正的异步发生在 MarchingSystem.update() 的动画循环中），但函数名和注释的 "异步" 描述会误导开发者。这不是功能性 bug（因为同步调用链是正确的），但它是文档/代码一致性问题。 | 需要统一：要么改注释去掉"异步"字样，要么将函数改为 async。 | **P2** |

---

### P2-2: e2e-map-flow 集成测试完全不覆盖 SiegeTaskManager 链路

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 | 严重度 |
|--------|--------------|-------------|-------------|--------|
| P5→P10 流程有充分测试 | Builder Claim G: "PASS - Full flow: createTask -> createMarch -> link -> start -> advanceStatus" | **Builder 引用的测试只覆盖了 SiegeTaskManager 和 SiegeSystem 的各自单元测试，并非端到端集成测试。** 搜索 `e2e-map-flow.integration.test.ts`：0 处提及 siegeTaskId、SiegeTask、cancelMarch。搜索所有 integration test 文件：0 处提及 SiegeTaskPanel。这意味着 P5→P10 的完整链路（UI交互 → handleSiegeConfirm → createTask → createMarch → march.arrived → executeSiege → setResult → returning → completed → SiegeTaskPanel 更新）从未在集成层面被验证过。 | 需要端到端集成测试，覆盖从 SiegeConfirmModal 确认到 SiegeTaskPanel 显示更新的完整流程。 | **P2** |

---

### P2-3: SiegeTaskPanel 测试中 progress bar 宽度硬编码 (30%/60%)，不反映真实进度

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 | 严重度 |
|--------|--------------|-------------|-------------|--------|
| SiegeTaskPanel 进度条测试覆盖 | Builder Claim D: "PASS - 27 test scenarios" | **SiegeTaskPanel.tsx (line 175) 中进度条宽度被硬编码为 `task.status === 'sieging' ? '60%' : '30%'`。这不是基于真实进度计算，而是静态值。** 测试 (line 232-248) 只是验证了这个硬编码值，而没有测试真实场景下进度条是否随时间推进而变化。例如：(1) 行军任务开始时进度 0%，到达时进度 100%，测试是否反映？(2) 攻城进度是否基于真实计算？目前 30%/60% 是任意的固定值，用户看到的进度条没有任何实际意义。 | 需要基于任务时间计算真实进度的测试，而不是测试硬编码值。 | **P2** |

---

### P2-4: 2 个 cross-system-linkage 测试失败被标记为"与 Round 5c 无关"但未证明

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 | 缺少什么证据 | 严重度 |
|--------|--------------|-------------|-------------|-------------|--------|
| 2 个失败测试与 Round 5c 无关 | Builder: "2 in cross-system-linkage.integration.test.ts (HeroStarSystem starUp returning false - unrelated to Round 5c scope)" | **Builder 声称失败与 Round 5c 无关，但没有提供证据。** cross-system-linkage 集成测试名暗示它测试跨系统链接。如果 Round 5c 修改了 siege/march 系统的接口或行为，可能间接影响了 HeroStarSystem 的集成。Builder 未展示：(1) 这 2 个测试在 Round 5c 之前是否通过；(2) 失败的根因分析；(3) 为什么可以安全忽略。 | 需要 git bisect 或 baseline 测试结果，证明这 2 个测试在 Round 5c 变更之前就已经失败。 | **P2** |

---

## Attack Summary

### P0 (Critical -- 系统性缺陷)

| # | 质疑点 | 核心问题 |
|---|--------|---------|
| P0-1 | march:cancelled handler 是死代码 | cancelMarch 在 emit 前删除 march，导致 handler 永远无法获取 siegeTaskId，siegeTask 清理永远不会执行。这是一个功能性 bug，会导致用户取消行军后攻占任务卡在 "行军中" 状态无法完成。 |
| P0-2 | SiegeTaskPanel 零集成测试 | 27 个浅渲染测试只验证了组件在隔离环境下的渲染行为，没有任何测试验证 SiegeTaskPanel 与 WorldMapTab 的真实交互。 |

### P1 (High -- 测试覆盖缺失 / 类型安全薄弱)

| # | 质疑点 | 核心问题 |
|---|--------|---------|
| P1-1 | serialize() 不保证 siegeTaskId 保留 | 序列化/反序列化测试从未验证 siegeTaskId 字段的持久性。如果运行时丢失此字段，整个 P5→P10 链路在存档恢复后会断裂。 |
| P1-2 | DEPRECATED 分支不可达性无测试 | 只有代码注释声称不可达，但边界条件（序列化丢失 siegeTaskId、cancelMarch bug）可能导致意外触发。 |
| P1-3 | handleCancelled 使用 `data: any` | 事件处理链路完全没有类型保护，payload 结构变更不会被编译器检测。 |
| P1-4 | engine prop 类型为 `any` | 整个攻城链路的核心依赖是 untyped 的，Builder 的"类型安全"结论仅限于局部。 |

### P2 (Medium -- 描述不一致 / 覆盖盲区)

| # | 质疑点 | 核心问题 |
|---|--------|---------|
| P2-1 | handleSiegeConfirm 同步/异步描述矛盾 | 函数注释说"异步"但实现是同步的，Builder 判 PASS 同时承认不匹配。 |
| P2-2 | e2e-map-flow 不覆盖 SiegeTaskManager | 核心端到端流程在集成测试中完全缺失。 |
| P2-3 | 进度条硬编码 | 30%/60% 是任意固定值，不反映真实进度，测试只是验证了硬编码值。 |
| P2-4 | 失败测试无 baseline | 2 个集成测试失败被标记为"无关"但缺少证据。 |

---

## Verdict

**Builder 的 Round 5c 验证结论不可信。** 存在 2 个 P0 级别的关键问题：

1. `march:cancelled` handler 的核心逻辑是**死代码**（由于 cancelMarch 在 emit 前删除 march），Builder 测试未发现此问题是因为测试只验证了 MarchingSystem 发出事件，从未验证 WorldMapTab 的 handler 能否成功获取已删除的 march 数据。

2. SiegeTaskPanel 的 27 个测试**全部是浅渲染隔离测试**，没有任何集成测试验证组件与 WorldMapTab 的交互。

建议 Builder 修复 P0-1 的逻辑缺陷（在 emit 之前保存 siegeTaskId 到事件 payload，或在 delete 之后仍通过闭包传递 march 数据），并补充 SiegeTaskPanel 与 WorldMapTab 的集成测试。
