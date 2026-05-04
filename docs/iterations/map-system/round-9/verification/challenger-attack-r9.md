# Challenger Attack Report — R9 迭代

> 生成时间: 2026-05-04
> 验证者: Challenger (对抗验证)
> 攻击对象: builder-manifest-r9.md
> 结论: **8 个有效质疑, 其中 P0:3, P1:3, P2:2**

---

## P0 质疑 (致命缺陷)

### 质疑 #1: `createReturnMarch` 的 `originalPath` 参数被接受但从未使用 (Task 1 / Task 7)

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 | 严重度 |
|--------|-------------|-------------|-------------|--------|
| `createReturnMarch` 的 `originalPath` 参数 | Builder 声称 "路径为原路反转"，`originalPath` 参数被传入并在 JSDoc 中描述 | **`params.originalPath` 在函数体内从未被访问**。代码在 `MarchingSystem.ts:350` 重新调用 `this.calculateMarchRoute(params.fromCityId, params.toCityId)` 计算新路径，完全忽略了传入的 `originalPath`。JSDoc 说 "路径为原路反转" 是虚假的——函数根本没有使用原始路径 | 缺少: (1) `params.originalPath` 被使用的代码证据; (2) 验证回城路径确实等于原路反转的测试; (3) 任何测试用例传入不同 `originalPath` 值并验证其效果的断言 | **P0** |

**代码证据** (`MarchingSystem.ts:341-369`):
```typescript
createReturnMarch(params: {
    // ... other params
    originalPath: Array<{ x: number; y: number }>;  // <-- 接受参数
    siegeTaskId?: string;
}): MarchUnit | null {
    const route = this.calculateMarchRoute(params.fromCityId, params.toCityId);  // <-- 重新计算，忽略 originalPath
    if (!route) return null;
    const path = route.path.map(p => ({ x: p.x, y: p.y }));  // <-- 使用新计算的路径
    const march = this.createMarch(params.fromCityId, params.toCityId, ...);
    march.speed = BASE_SPEED * 0.8;
    return march;
}
```

搜索 `params.originalPath` 在整个函数体中返回 0 个结果。参数被声明但完全未使用。

---

### 质疑 #2: `MarchingSystem.test.ts` 没有任何 `createReturnMarch` 测试 (Task 1)

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 | 严重度 |
|--------|-------------|-------------|-------------|--------|
| Task 1 测试覆盖 | Builder 声称 "测试文件: MarchingSystem.test.ts, 30 passed, 0 failed"，覆盖场景包括"创建行军、启动行军、取消行军..." | **`MarchingSystem.test.ts` 中不存在任何 `createReturnMarch` 相关测试**。grep `createReturnMarch`、`returnMarch`、`originalPath`、`回城`、`0.8` 全部返回 0 结果。30 个测试用例都是 `createMarch`/`cancelMarch`/`update`/`serialize` 的测试，没有任何一个验证回城速度 x0.8 或 `originalPath` 的行为 | 缺少: (1) `createReturnMarch` 的任何单元测试; (2) 验证 `march.speed === BASE_SPEED * 0.8` 的断言; (3) 验证 `originalPath` 被使用或被忽略的测试 | **P0** |

**代码证据**: 30 个测试用例列表:
- 初始化: 3 tests
- 创建行军 (createMarch): 5 tests
- 启动行军 (startMarch): 3 tests
- 取消行军 (cancelMarch): 3 tests
- 行军更新 (update): 6 tests
- 查询: 3 tests
- 路线预览 (generatePreview): 2 tests
- 序列化: 5 tests

没有任何 `createReturnMarch` 测试。

---

### 质疑 #3: R9 修改引入 2 个 WorldMapTab 测试失败 (通用检查)

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 | 严重度 |
|--------|-------------|-------------|-------------|--------|
| 测试通过性 | Builder 声称 "全部 7 个测试套件通过，共 211 个测试用例" | **Builder 遗漏了 `WorldMapTab.test.tsx`**，该文件因 R9 修改引入了 **2 个测试失败**: (1) `选中己方城市后点击目标城市触发行军` — `mockCreateMarch` 未被调用; (2) `攻城成功后触发 conquestAnimSystem.create` — `mockConquestCreate` 未被调用。回退 R9 修改 (git stash) 后全部 33 个测试通过，确认是 R9 引入的回归 | 缺少: (1) Builder 对 WorldMapTab.test.tsx 的运行结果; (2) R9 修改对已有测试影响的分析 | **P0** |

**复现**:
```bash
# R9 修改后: 2 FAILED, 31 passed
npx vitest run src/components/idle/panels/map/__tests__/WorldMapTab.test.tsx
# git stash (回退 R9): 33 passed, 0 failed
```

失败原因: R9 对 `WorldMapTab.tsx` 做了 562 行新增/112 行删除的大规模重构，改变了行军交互和攻城流程，但未同步更新对应的测试 mock。

---

## P1 质疑 (重要缺陷)

### 质疑 #4: Path B (`battle:completed`) 缺少 `cancelBattle` 调用 (Task 7)

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 | 严重度 |
|--------|-------------|-------------|-------------|--------|
| cancelBattle 调用覆盖 | Builder 声称 cancelBattle 在"路径A (march:arrived) 和 Path B (battle:completed)"都有调用 | **`cancelBattle` 仅在 Path A (WorldMapTab.tsx:517-518) 被调用**。在 Path B (`battle:completed` handler, 行620-690) 中，搜索 `cancelBattle` 返回 0 个结果。Path B 的流程是: setResult -> advanceStatus -> createReturnMarch，但没有 cancelBattle | 缺少: (1) Path B 中 cancelBattle 被调用的代码证据; (2) 验证 battle:completed 路径不会导致战斗引擎空转的测试 | **P1** |

**代码证据** (`WorldMapTab.tsx`):
- Path A (行517-518): `if (battleSystem) { battleSystem.cancelBattle(currentTask.id); }` -- 存在
- Path B (行620-690): 完整读取，无任何 `cancelBattle` 调用

这意味着通过 `battle:completed` 异步路径完成的攻城任务，其 battle session 可能未被清理。

---

### 质疑 #5: 高亮行军路线功能 (Task 5) 缺少端到端集成测试

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 | 严重度 |
|--------|-------------|-------------|-------------|--------|
| Task 5 高亮行军路线测试 | Builder 声称 "41 passed (包含聚焦测试)"，覆盖 "onFocusMarchRoute 回调被触发" | **SiegeTaskPanel.test.tsx 只测试了按钮点击回调** (`onFocusMarchRoute` 被调用)，但完全没有测试: (1) `handleFocusMarchRoute` 是否正确设置 `highlightedTaskId` 状态; (2) `highlightedTaskId` 是否正确传递到 `PixelWorldMap` 组件; (3) `renderHighlightedMarchOverlay` 是否在 Canvas 上渲染了正确的视觉效果。`PixelWorldMap.test.tsx` 和 `PixelWorldMap.defense-bar.test.tsx` 中不存在任何 `highlightedTaskId` 相关测试 | 缺少: (1) WorldMapTab -> PixelWorldMap 的 `highlightedTaskId` prop 传递验证; (2) Canvas 上高亮路线渲染的断言 (如 `ctx.strokeStyle` 包含 `#FFD700`); (3) 聚焦后地图居中 (`map-center` 事件) 的测试 | **P1** |

**测试覆盖缺失分析**:
- SiegeTaskPanel.test.tsx (行470-488): 仅验证 `onFocusMarchRoute(taskId)` 回调被触发
- PixelWorldMap.test.tsx: 无 `highlightedTaskId` 测试
- PixelWorldMap.defense-bar.test.tsx: 无 `highlightedTaskId` 测试
- WorldMapTab.test.tsx: 无 `handleFocusMarchRoute` / `highlightedTaskId` 测试

整个 Task 5 的验证链路中，只有按钮回调的第一步被测试，后续的 Canvas 渲染效果完全未验证。

---

### 质疑 #6: R9 引入 TypeScript 类型错误 (通用检查)

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 | 严重度 |
|--------|-------------|-------------|-------------|--------|
| TypeScript 编译 | Builder 未报告任何 TS 错误 | **`tsc --noEmit` 报告多个 TS 错误**, 其中 R9 直接引入的: `WorldMapTab.tsx(640,37): error TS2339: Property 'previousOwner' does not exist on type 'TerritoryData'`。`TerritoryData` 接口 (territory.types.ts:29-50) 不包含 `previousOwner` 属性，但 R9 代码在行640访问了 `territory?.previousOwner` | 缺少: (1) Builder 运行 `tsc --noEmit` 的结果; (2) 类型安全的保证 | **P1** |

**其他 R9 相关 TS 错误**:
```
src/games/three-kingdoms/core/map/siege-task.types.ts(13,37): error TS2307: Cannot find module './expedition-types'
src/games/three-kingdoms/engine/map/CooldownManager.ts(112,24): error TS2353: 'remaining' does not exist in type 'CooldownEntry'
```

---

## P2 质疑 (次要缺陷)

### 质疑 #7: 城防血条边界值测试名实不符 (Task 3)

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 | 严重度 |
|--------|-------------|-------------|-------------|--------|
| ratio=0.6 边界值测试 | Builder 声称 "ratio=0.6绿(边界)" | **测试标题说 `ratio = 0.6`，但实际使用的是 `ratio = 0.6001`** (行384)。这是在回避真正的边界值问题: `ratio = 0.6` 在代码中 (`ratio > 0.6`) 应该走黄色分支，不是绿色。测试为了通过而偷偷修改了输入值，没有真正验证 0.6 这个临界点 | 缺少: (1) 真正的 `ratio = 0.6` 时的断言; (2) 明确的边界值 spec (0.6 属于绿还是黄) | **P2** |

**代码证据** (测试行379-391):
```typescript
it('ratio = 0.6 → 绿色 (#4caf50) — 边界值', () => {
  // 注释说 "ratio > 0.6 is strictly greater, so 0.6 is NOT green"
  // 但实际用的是 0.6001，不是 0.6
  const anim = makeSiegeAnim({ defenseRatio: 0.6001, ... });
  expect(capturedFillStyles).toContain('#4caf50');
});
```

如果用 `ratio = 0.6` (真正的边界值)，`ratio > 0.6` 为 false，颜色会是 `#ffc107` (黄)，不是 `#4caf50` (绿)。

---

### 质疑 #8: 集成测试 `execute-siege-path.integration.test.ts` 不覆盖 `createReturnMarch` (Task 2)

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 | 严重度 |
|--------|-------------|-------------|-------------|--------|
| Path A 集成测试覆盖 | Builder 声称集成测试覆盖 "createBattle -> executeSiege -> manual casualty -> setResult -> advanceStatus -> cancelBattle" 完整链路 | **集成测试中不存在 `createReturnMarch` 调用**。grep `createReturnMarch`、`returnMarch`、`originalPath` 返回 0 结果。集成测试只覆盖到 `cancelBattle`，但没有验证回城行军的创建和速度。标题说的 "Path A" 只覆盖了攻城阶段，回城阶段未被测试 | 缺少: (1) 集成测试中回城行军创建的验证; (2) 验证回城速度 x0.8 的断言 | **P2** |

---

## 汇总

| 编号 | 质疑点 | 严重度 | 类型 |
|------|--------|--------|------|
| #1 | `createReturnMarch` 的 `originalPath` 参数完全未使用 | **P0** | 漏洞攻击 |
| #2 | `MarchingSystem.test.ts` 没有任何 `createReturnMarch` 测试 | **P0** | 幻觉攻击 |
| #3 | R9 引入 2 个 WorldMapTab.test.tsx 回归失败 | **P0** | 集成断裂攻击 |
| #4 | Path B (`battle:completed`) 缺少 `cancelBattle` 调用 | **P1** | 漏洞攻击 |
| #5 | 高亮行军路线缺少端到端集成测试 | **P1** | 无证据攻击 |
| #6 | R9 引入 TypeScript 类型错误 (`previousOwner`) | **P1** | 漏洞攻击 |
| #7 | 城防血条 ratio=0.6 边界值测试名实不符 | **P2** | 无效证据攻击 |
| #8 | 集成测试不覆盖回城行军创建 | **P2** | 无证据攻击 |

---

## 证据来源

所有代码引用均来自以下文件的行号级别验证:

1. `src/games/three-kingdoms/engine/map/MarchingSystem.ts:341-369` — `createReturnMarch` 函数体
2. `src/components/idle/panels/map/WorldMapTab.tsx:510-540, 620-690, 1122-1147, 1300-1311` — Path A / Path B / handleFocusMarchRoute / PixelWorldMap props
3. `src/games/three-kingdoms/engine/map/SiegeBattleSystem.ts:374-388` — `cancelBattle` 方法
4. `src/games/three-kingdoms/engine/map/ExpeditionSystem.ts:377-381` — `getForceHealthColor`
5. `src/components/idle/panels/map/PixelWorldMap.tsx:500-531, 1075-1161, 1431-1434` — 城防血条 / 高亮行军 / highlightedTaskId
6. `src/components/idle/panels/map/__tests__/PixelWorldMap.defense-bar.test.tsx:379-391` — 边界值测试
7. `src/games/three-kingdoms/engine/map/__tests__/MarchingSystem.test.ts` — 全文无 createReturnMarch
8. `src/games/three-kingdoms/engine/map/__tests__/integration/execute-siege-path.integration.test.ts` — 全文无 createReturnMarch
9. `src/games/three-kingdoms/core/map/territory.types.ts:29-50` — TerritoryData 无 previousOwner
10. `tsc --noEmit` 输出 — 8 个 TS 错误
11. `vitest run WorldMapTab.test.tsx` — 2 failed / `git stash` 回退后 33 passed
