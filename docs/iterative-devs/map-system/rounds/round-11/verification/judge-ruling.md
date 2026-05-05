# R11 Judge Ruling

**Date**: 2026-05-04
**Role**: R11 Judge
**Target**: Builder Manifest + Challenger Attack Report
**Method**: 源代码逐行审查 + 测试实际运行验证

---

## Executive Summary

Challenger 提出 11 个质疑 (P0:2, P1:5, P2:4)。经逐条代码验证和测试运行：

- **P0 质疑: 1 个成立, 1 个部分成立 (降级为 P1)**
- **P1 质疑: 3 个成立, 2 个部分成立 (降级为 P2)**
- **P2 质疑: 2 个成立, 2 个不成立 (驳回)**

**最终判定: P0: 1, P1: 4, P2: 5 个有效问题**

---

## 逐条裁决

### Challenge #1 (P0 -> **P1 降级**): Test 14 Name Claims "仅标记sprites=true" is Misleading

| 项目 | 内容 |
|------|------|
| **Challenger观点** | Test 14 名为"activeMarches变化仅标记sprites=true"，但源码 L997-1003 当 `activeMarches.length > 0` 时调用 `markDirtyRef.current()`，会标记全部4层脏 |
| **Builder补充** | 无 |
| **Judge裁决** | **部分成立，P0 降级为 P1** |
| **理由** | Challenger 的源码分析完全正确：(1) `useEffect` 在 L999 设置 `dirtyFlagsRef.current.sprites = true`，(2) 然后在 L1001-1002 当 `activeMarches.length > 0` 时调用 `markDirtyRef.current()`，(3) `markDirty` (L820-826) 确实将全部4层设为 `true`。因此 test 14 的断言 `expect(flags!.sprites).toBe(true)` 是正确的（sprites 确实为 true），但缺少了对 `terrain/effects/route` 应为 `false` 的断言——如果加上这些断言测试会失败。然而 **降级为 P1**，因为：(a) 测试的核心断言（sprites 被标记为 dirty）是正确的，只是名称中的"仅"字不准确；(b) 这不构成"幻觉"（幻觉意味着核心断言为假），而是测试覆盖不完整——没有验证其他层是否被错误标记。核心功能（dirty flag 机制）本身运作正常，只是测试描述不精确。 |

**代码证据**:

```typescript
// PixelWorldMap.tsx L997-1004 (useEffect for activeMarches)
useEffect(() => {
    marchesRef.current = activeMarches ?? [];
    dirtyFlagsRef.current.sprites = true;          // <-- 标记 sprites
    if (activeMarches && activeMarches.length > 0) {
      markDirtyRef.current();                       // <-- 标记全部4层!
    }
  }, [activeMarches]);

// L820-826 (markDirty)
const markDirty = () => {
    dirtyFlagsRef.current.terrain = true;
    dirtyFlagsRef.current.sprites = true;
    dirtyFlagsRef.current.effects = true;
    dirtyFlagsRef.current.route = true;
};
```

---

### Challenge #2 (P0 -> **P1 降级**): "分层脏标记" is NOT Truly Layered

| 项目 | 内容 |
|------|------|
| **Challenger观点** | 大多数 useEffect 都调用 `markDirtyRef.current()` 标记全部层脏，"分层"优化名存实亡 |
| **Builder补充** | 无 |
| **Judge裁决** | **部分成立，P0 降级为 P1** |
| **理由** | Challenger 的分析基本正确。经代码验证：(1) territories (L982) 调用 `markDirtyRef.current()`；(2) marchRoute (L992) 调用 `markDirtyRef.current()`；(3) activeMarches 有内容时 (L1002) 调用 `markDirtyRef.current()`；(4) activeSiegeAnims 有内容时 (L1013) 调用 `markDirtyRef.current()`；(5) selectedId (L1574) 调用 `markDirtyRef.current()`；(6) highlightedTaskId (L1584) 调用 `markDirtyRef.current()`。确实绝大多数场景都是全层标记。此外，animate loop L842-844 在有活跃行军时每帧强制设置 `flags.sprites = true` 和 `flags.effects = true`，这进一步削弱了"分层"意义。**但降级为 P1**，因为：(a) 当 `activeMarches` 变为空数组时 (L1001 条件不满足)，确实只标记 `sprites=true`——存在一个有效的分层场景；(b) 分层脏标记的数据结构和检查逻辑本身是正确的，只是在当前实现中被保守使用（宁可多标记也不漏标记），这是一种防御性编程策略而非 bug。Builder 声称"分层脏标记机制"在技术上实现了，只是实际优化效果有限。 |

**代码证据**:

```typescript
// L842-844 (animate loop) -- 有活跃行军时每帧强制重置 sprites 和 effects
if (hasActiveConquest || hasActiveMarches || hasActiveSiegeAnims) {
    flags.sprites = true;
    flags.effects = true;
}
```

---

### Challenge #3 (P1 -> **P1 确认**): `originalPath` Parameter is Dead Test Code

| 项目 | 内容 |
|------|------|
| **Challenger观点** | 6 个测试传递 `originalPath` 给 `createReturnMarch()`，但函数签名不接受此参数 |
| **Builder补充** | 无 |
| **Judge裁决** | **成立，P1** |
| **理由** | 经 `npx tsc --noEmit --strict` 验证，TypeScript 报告了 5 处 TS2353 错误：`Object literal may only specify known properties, and 'originalPath' does not exist in type '{ fromCityId: string; toCityId: string; troops: number; general: string; faction: ...; siegeTaskId?: string | undefined; }'`。函数签名在 L341-348 明确不接受 `originalPath`。测试中 `originalPath` 被静默忽略（Vitest 不执行严格类型检查），这是一个实实在在的测试代码质量问题。此外，测试"路径基于 calculateMarchRoute（非 originalPath）"（L372）试图证明返回路径不是 `originalPath`，但 `originalPath` 从未被函数使用——测试证明的是一个从未存在的问题。|

**TypeScript 验证结果**:

```
src/.../MarchingSystem.test.ts(293,9): error TS2353: 'originalPath' does not exist in type
src/.../MarchingSystem.test.ts(307,9): error TS2353: 'originalPath' does not exist in type
src/.../MarchingSystem.test.ts(332,9): error TS2353: 'originalPath' does not exist in type
src/.../MarchingSystem.test.ts(362,9): error TS2353: 'originalPath' does not exist in type
src/.../MarchingSystem.test.ts(394,9): error TS2353: 'originalPath' does not exist in type
```

---

### Challenge #4 (P1 -> **P2 降级**): `intercepted` State Has Zero Dedicated Implementation

| 项目 | 内容 |
|------|------|
| **Challenger观点** | `intercepted` 状态在 `PixelWorldMap.tsx` 中无专门渲染逻辑，测试通过是因为 `else` 分支的巧合 |
| **Builder补充** | 无 |
| **Judge裁决** | **部分成立，P1 降级为 P2** |
| **理由** | 经 `grep 'intercepted' PixelWorldMap.tsx` 验证，确实0处匹配。渲染逻辑在 L234-240：`if (march.state === 'retreating')` 使用灰色/0.7透明度，`else` 使用阵营色/1.0透明度。`intercepted` 走 `else` 分支。测试 R11-8 验证了 `intercepted` 状态使用阵营色和完整透明度，这在逻辑上是正确的（`intercepted` 不应被视为撤退）。**但降级为 P2**，因为：(a) "accidental correctness" 需要区分——在当前状态机设计中，`intercepted` 走 `else` 分支获得默认（阵营色）行为是**合理且正确的设计**，而非纯粹的偶然；(b) 如果未来需要 `intercepted` 的特殊视觉表现（如闪烁），那需要新增逻辑，但当前测试验证的行为（使用阵营色）本身就是合理的需求；(c) 这更多是测试描述的精确性问题（应该描述为"intercepted 状态使用默认阵营色渲染"而非"使用阵营色渲染而非retreating灰"），而非功能缺陷。|

---

### Challenge #5 (P1 -> **P1 确认**): Performance Benchmark #8 is Meaningless

| 项目 | 内容 |
|------|------|
| **Challenger观点** | Benchmark 8 "1000次fillRect < 1ms" 测试的是 mock 函数的 `array.push()` 开销，不反映实际渲染性能 |
| **Builder补充** | 无 |
| **Judge裁决** | **成立，P1** |
| **理由** | 经代码验证（`PixelWorldMap.perf.test.tsx` L539-548），该测试在一个循环中调用 `mockCtx.fillRect(i, i, 10, 10)` 1000次。`mockCtx.fillRect` 的实现是 `vi.fn()`，即只是将参数推入调用数组。这确实只测量了 `vi.fn()` mock 的调用开销（本质上是 `array.push()`），与实际 Canvas 渲染性能无关。文件头部也明确注明"使用mock canvas避免真实DOM渲染开销，测量的是纯逻辑+Canvas API调用的CPU时间"（L13-14），但 Benchmark 8 连"纯逻辑"都没有——它只是裸调 mock。该基准测试的数值对实际性能评估无参考价值。|

---

### Challenge #6 (P1 -> **P2 降级**): All Performance Claims Use Mock Canvas

| 项目 | 内容 |
|------|------|
| **Challenger观点** | 所有11个性能基准使用 mock canvas，声称的"60fps"在实际渲染中不可验证 |
| **Builder补充** | 无 |
| **Judge裁决** | **部分成立，P1 降级为 P2** |
| **理由** | Challenger 的观察正确——所有基准使用 mock canvas。**但降级为 P2**，因为：(a) 测试文件头明确声明了使用 mock canvas 的局限性（L13-14），不存在隐瞒；(b) Mock canvas 基准测试的价值在于测量**算法逻辑的 CPU 开销**（布局计算、遍历、坐标变换等），这部分在真实环境中不会有显著差异；(c) Jest/Vitest 环境中测试真实 Canvas 渲染在技术上极其困难（JSDOM 不支持真实 Canvas）；(d) 其他10个基准测试虽然使用 mock，但它们至少测量了组件渲染逻辑的完整路径，而非裸调 mock 函数。这在单元测试中是可接受的折衷。标记为 P2 是因为 Builder 应该在报告中更清晰地说明局限性。|

---

### Challenge #7 (P1 -> **P2 降级**): MarchingSystem Tests Use Fully Mocked EventBus

| 项目 | 内容 |
|------|------|
| **Challenger观点** | 所有43个测试使用 mock EventBus，无法验证事件是否正确传播到真实消费者 |
| **Builder补充** | 无 |
| **Judge裁决** | **部分成立，P1 降级为 P2** |
| **理由** | **降级为 P2**，因为这是标准的单元测试模式。MarchingSystem 是引擎层（engine）模块，其测试职责是验证自身的业务逻辑——包括在正确时机发射正确格式的事件。验证事件消费者（如 UI 组件）对事件的响应属于集成测试的范畴，不是单元测试的职责。R11-2 的功能点明确是"return march 异常路径测试"，其测试范围是 MarchingSystem 自身的行为，而非整个事件传播链。测试确实验证了 `emit` 被调用且参数正确，这已满足单元测试的目标。缺少集成测试覆盖是一个合理的补充建议（P2），但不是当前功能点验证的缺陷。|

---

### Challenge #8 (P2 -> **P2 确认**): No Test for activeMarches Emptying Path

| 项目 | 内容 |
|------|------|
| **Challenger观点** | 没有测试覆盖 `activeMarches` 从非空变为空时，精灵层是否正确清除 |
| **Builder补充** | 无 |
| **Judge裁决** | **成立，P2** |
| **理由** | 经代码验证，`renderMarchSpritesOverlay` 在 L1150 有 `if (!marches.length || !renderer || !canvas) return;` 的提前返回。当 `activeMarches` 从非空变为空时：useEffect 会设置 `dirtyFlagsRef.current.sprites = true`（因为 `activeMarches.length` 不大于0，不会调用 `markDirtyRef.current()`），但 animate loop 中 `hasActiveMarches` 为 false，所以 L842-844 不会重新标记。然而，`wasSpritesDirty` 为 true，`renderMarchSpritesOverlay` 被调用但立即返回（marches 为空），没有清除操作。旧的精灵像素会残留在 canvas 上，直到 terrain 层的下一次完整重绘。这确实是一个未被测试覆盖的边界情况。|

---

### Challenge #9 (P2 -> **不成立，驳回**): No End-to-End Flow Test for Canvas Rendering

| 项目 | 内容 |
|------|------|
| **Challenger观点** | 所有16个smoke test + 17个I11测试都只测试单个 `flushRAF()` 周期的渲染输出，没有端到端流程测试 |
| **Builder补充** | 无 |
| **Judge裁决** | **不成立，驳回** |
| **理由** | 实际上 dirty-flag 测试套件（R11-4）已经覆盖了 Challenger 描述的端到端流程的大部分环节：(1) Test 4 "仅activeMarches变化" 覆盖了 state change -> React re-render -> useEffect -> dirty flag set -> animate loop -> Canvas draw；(2) Test 2 "无变化时重渲染" 覆盖了 dirty flag reset -> no redraw；(3) Test 14 覆盖了 flag state 检查。dirty-flag 测试本质上就是"数据变化 -> 脏标记 -> 分层渲染"的端到端测试。Challenger 所说的"用户交互"部分（如点击按钮触发状态变化）属于 UI 交互测试，超出 Canvas 渲染层的测试范围。|

---

### Challenge #10 (P2 -> **P2 确认**): cancelMarch Sets "retreating" But Never Creates Return Animation

| 项目 | 内容 |
|------|------|
| **Challenger观点** | `cancelMarch` 设置 `state = 'retreating'` 后立即从 active map 中删除，`retreating` 状态是瞬时的，从未被渲染 |
| **Builder补充** | 无 |
| **Judge裁决** | **成立，P2** |
| **理由** | 经代码验证（MarchingSystem.ts L295-307）：`cancelMarch` 确实先设置 `march.state = 'retreating'`，然后立即 `this.activeMarches.delete(marchId)`。测试通过对象引用访问（`march.state` 在删除后仍可通过引用读取），验证了 state 被设置为 `retreating`。但在实际运行时，该行军已从 active map 中移除，不会被渲染系统获取到，因此 `retreating` 状态的视觉效果永远不会出现。测试验证的状态变化在技术上是正确的，但其实际效果为零。这是一个设计层面的语义问题：`cancelMarch` 的语义应该是"取消行军"，而非"启动撤退"。|

---

### Challenge #11 (P2 -> **不成立，驳回**): `getDirtyFlagsForTest()` Uses Unsafe Global Reference

| 项目 | 内容 |
|------|------|
| **Challenger观点** | 模块级全局 `_testDirtyFlagsRef` 在多实例时会被覆盖 |
| **Builder补充** | 无 |
| **Judge裁决** | **不成立，驳回** |
| **理由** | (a) `getDirtyFlagsForTest()` 明确标注为测试专用工具（"仅用于测试"），且函数名包含 `ForTest` 后缀；(b) 在生产代码中不会调用此函数；(c) 在测试环境中，通常只有一个 `PixelWorldMap` 实例存在（测试隔离保证）；(d) 这是一个标准的测试辅助模式（test-only export），不是生产代码的缺陷。Challenger 提出的"多实例场景"在实际应用中不会出现（地图组件是单例）。如果未来需要多实例测试，只需扩展测试辅助函数即可。这不构成任何级别的有效问题。|

---

## Summary Table

| # | Severity | Challenger观点 | Builder补充 | Judge裁决 | 理由 |
|---|----------|---------------|-------------|-----------|------|
| 1 | P0 -> **P1** | Test 14 名称"仅标记sprites"不实 | 无 | **P1 成立** | 源码验证当 `activeMarches.length>0` 时确实标记全部4层；测试缺少对 `terrain/effects/route === false` 的断言；但核心断言(sprites=true)正确，名称描述不精确而非幻觉 |
| 2 | P0 -> **P1** | "分层脏标记"大部分场景全层标记 | 无 | **P1 成立** | 6个useEffect中5个调用 `markDirtyRef.current()` 全层标记；但空行军时确实只标记sprites层；优化效果有限但非幻觉 |
| 3 | **P1** | `originalPath` 是死测试代码 | 无 | **P1 成立** | TypeScript strict模式报告5处TS2353错误；函数签名确实不接受该参数；测试证明的是一个不存在的问题 |
| 4 | P1 -> **P2** | `intercepted` 无专门实现 | 无 | **P2 成立** | grep验证0处匹配；但 `else` 分支的默认行为（阵营色）对 `intercepted` 状态是合理的；属于测试描述精确性问题 |
| 5 | **P1** | Benchmark 8 无意义 | 无 | **P1 成立** | 验证确认只测 `vi.fn()` 的调用开销；与渲染性能无关 |
| 6 | P1 -> **P2** | 所有性能基准用 mock canvas | 无 | **P2 成立** | 文件头已声明局限性；mock benchmark 测算法逻辑有参考价值；JSDOM 限制是已知技术约束 |
| 7 | P1 -> **P2** | EventBus 完全 mock | 无 | **P2 成立** | 标准单元测试模式；事件传播验证属于集成测试范畴；当前测试范围正确 |
| 8 | **P2** | 无空行军清除测试 | 无 | **P2 成立** | L1150 提前返回导致旧精灵残留；未测试的边界情况 |
| 9 | P2 | 无端到端流程测试 | 无 | **不成立，驳回** | dirty-flag 测试套件已覆盖 state->useEffect->flag->animate->Canvas 流程；UI交互测试超出范围 |
| 10 | **P2** | `retreating` 状态瞬时无效果 | 无 | **P2 成立** | cancel 后立即 delete；state 设置虽正确但无实际渲染效果 |
| 11 | P2 | 全局引用多实例不安全 | 无 | **不成立，驳回** | 测试专用工具；单例场景；标准测试辅助模式 |

---

## Final Verdict

### 问题统计

| 级别 | 数量 | 质疑编号 |
|------|------|----------|
| P0 (Critical) | **0** | -- |
| P1 (Major) | **4** | #1, #2, #3, #5 |
| P2 (Minor) | **5** | #4, #6, #7, #8, #10 |
| 驳回 | **2** | #9, #11 |

### 裁决结论

**R11 整体状态: 有条件通过**

Builder 的4个功能点实体验证结论：

1. **R11-1 (行军精灵smoke tests)**: **通过** -- 51个测试全部通过，16个Canvas API断言有效。存在 P2 #4 (intercepted 描述不精确) 和驳回的 #9，不影响功能验证结论。
2. **R11-2 (return march异常路径测试)**: **有条件通过** -- 43个测试全部通过，8个异常场景覆盖完整。存在 P1 #3 (死测试参数) 和 P2 #10 (retreating瞬时状态)。核心逻辑正确，但测试代码质量需改进（移除 `originalPath` 死参数）。
3. **R11-3 (性能基准测试)**: **有条件通过** -- 11个测试全部通过。存在 P1 #5 (Benchmark 8无意义) 和 P2 #6 (mock canvas局限性)。建议移除 Benchmark 8 或改造为有意义的测试。
4. **R11-4 (脏标记渲染机制)**: **有条件通过** -- 14个测试全部通过。存在 P1 #1 (测试描述不精确) 和 P1 #2 (优化效果有限)。机制本身正确实现，但测试覆盖需要补充对"仅标记单层"场景的完整断言。

### Required Actions (按优先级)

1. **[P1] 移除 `originalPath` 死参数** -- MarchingSystem.test.ts 中5处 `originalPath` 应删除
2. **[P1] 修正 Test 14 名称和断言** -- dirty-flag 测试中 Test 14 应改名为"activeMarches变化标记全部层脏"，或改用空数组到空数组的变化场景
3. **[P1] 移除或改造 Benchmark 8** -- 当前测试无实际意义，建议移除或改为测量组件渲染逻辑的完整路径
4. **[P1] 脏标记分层优化** -- 当前 `markDirtyRef.current()` 被过度调用，考虑为各 useEffect 实现更精细的脏标记策略

---

Judge完成, 确认P0:0, P1:4, P2:5个问题
