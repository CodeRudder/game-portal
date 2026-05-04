# Judge Ruling — R9 迭代裁决报告

> 裁决时间: 2026-05-04
> 裁决者: Judge (独立验证)
> 基于文件: builder-manifest-r9.md + challenger-attack-r9.md
> 验证方法: 源码审查 + 测试运行 + TypeScript 编译检查

---

## 裁决总表

| 质疑编号 | Challenger 主张 | Challenger 严重度 | 裁决结果 | 裁决严重度 | 理由 |
|----------|----------------|-------------------|----------|------------|------|
| #1 | `createReturnMarch` 的 `originalPath` 参数完全未使用 | P0 | **确认** | P2 | 参数确实未被使用，但功能本身（回城行军+速度x0.8）正常工作，属于死代码/接口冗余，不构成 P0 |
| #2 | `MarchingSystem.test.ts` 没有任何 `createReturnMarch` 测试 | P0 | **确认** | P1 | 测试确实缺失，但 `createReturnMarch` 在 WorldMapTab 集成层被调用且功能可用，属于测试覆盖缺失而非功能不可用 |
| #3 | R9 引入 2 个 WorldMapTab.test.tsx 回归失败 | P0 | **确认** | P0 | 实测 2 failed / 31 passed，R9 commit `e22dcf90` 同时修改了源文件和测试文件但未同步更新 mock，属回归缺陷 |
| #4 | Path B (`battle:completed`) 缺少 `cancelBattle` 调用 | P1 | **确认** | P1 | 源码验证：`cancelBattle` 仅在 Path A (行517-518) 出现，Path B (行625-695) 无此调用，战斗会话可能泄漏 |
| #5 | 高亮行军路线缺少端到端集成测试 | P1 | **确认** | P2 | 功能代码存在，但测试仅覆盖按钮回调，Canvas 渲染和状态传递未验证，属测试质量而非功能缺陷 |
| #6 | R9 引入 TypeScript 类型错误 (`previousOwner`) | P1 | **确认** | P1 | `tsc --noEmit` 验证：`TerritoryData` 接口不含 `previousOwner`，行640 访问了不存在的属性，另有 2 个相关 TS 错误 |
| #7 | 城防血条 ratio=0.6 边界值测试名实不符 | P2 | **确认** | P2 | 测试标题写 `ratio=0.6` 但实际传入 `0.6001`，注释也承认 "0.6 is NOT green"，名实不符 |
| #8 | 集成测试不覆盖回城行军创建 | P2 | **确认** | P2 | `execute-siege-path.integration.test.ts` 中 `createReturnMarch` 搜索结果为 0，回城阶段未被测试 |

---

## 逐项裁决详情

### 质疑 #1: `createReturnMarch` 的 `originalPath` 参数未使用

**Challenger 主张**: P0 — 参数被声明但完全未使用，JSDoc "路径为原路反转" 是虚假的。

**验证过程**:
- 读取 `MarchingSystem.ts:341-369`，确认 `params.originalPath` 出现在函数签名中，但函数体仅使用 `this.calculateMarchRoute(params.fromCityId, params.toCityId)` 重新计算路径。
- 函数体中无任何对 `params.originalPath` 的引用。

**裁决**: **确认参数未使用**。但降级为 **P2**：
- 回城行军功能本身正常工作（调用 `calculateMarchRoute` 重新寻路，速度设为 `BASE_SPEED * 0.8`）。
- `originalPath` 是一个冗余参数，不影响运行时行为，不构成崩溃或数据损坏。
- JSDoc 描述不准确（说 "原路反转" 但实际是重新计算），属于注释质量问题。
- 应移除未使用的参数或实现其预期逻辑。

---

### 质疑 #2: `MarchingSystem.test.ts` 没有 `createReturnMarch` 测试

**Challenger 主张**: P0 — 30 个测试用例中无任何 `createReturnMarch` 相关测试。

**验证过程**:
- 在 `MarchingSystem.test.ts` 中搜索 `createReturnMarch`：返回 0 个结果。
- 30 个测试全部是 `createMarch`/`cancelMarch`/`update`/`serialize` 相关。

**裁决**: **确认测试缺失**。但降级为 **P1**：
- `createReturnMarch` 方法确实存在且可被调用（WorldMapTab.tsx 行524和675两处调用）。
- 功能可工作但无单元测试验证回城速度 x0.8 和路径计算的正确性。
- 属于关键测试缺失（P1），不是功能完全不可用（P0）。

---

### 质疑 #3: R9 引入 2 个 WorldMapTab.test.tsx 回归失败

**Challenger 主张**: P0 — Builder 遗漏了 WorldMapTab.test.tsx，2 个测试失败。

**验证过程**:
- 运行 `npx vitest run src/components/idle/panels/map/__tests__/WorldMapTab.test.tsx`：**2 failed, 31 passed**。
- 失败测试: (1) `选中己方城市后点击目标城市触发行军` — `mockCreateMarch` 未被调用; (2) `攻城成功后触发 conquestAnimSystem.create` — `mockConquestCreate` 未被调用。
- 确认 R9 commit `e22dcf90` 同时修改了 `WorldMapTab.tsx`(+701行) 和 `WorldMapTab.test.tsx`(+411行)，但 mock 未完全同步。

**裁决**: **维持 P0**。
- 2 个测试失败意味着行军触发和攻城动画这两个核心功能的测试已断裂。
- 虽然 Builder 报告了 7 个测试套件 211 个用例全通过，但刻意回避了 WorldMapTab 测试套件。
- 测试回归表明 R9 对 WorldMapTab 的重构可能破坏了已有功能逻辑或至少破坏了测试契约。

---

### 质疑 #4: Path B 缺少 `cancelBattle` 调用

**Challenger 主张**: P1 — `cancelBattle` 仅在 Path A 调用，Path B 中缺失。

**验证过程**:
- 在 `WorldMapTab.tsx` 中搜索 `cancelBattle`：仅返回行518一处。
- Path A (行505-534): `setResult` → `advanceStatus('returning')` → `cancelBattle` → `createReturnMarch`。
- Path B (行625-695): `calculateSettlement` → `setResult` → `advanceStatus('settling')` → `advanceStatus('returning')` → `createReturnMarch`，**无 `cancelBattle`**。

**裁决**: **确认，维持 P1**。
- Path B 通过 `battle:completed` 异步事件处理攻城结果，但未调用 `cancelBattle` 清理战斗会话。
- 虽然 `SiegeBattleSystem` 可能内部有超时清理机制，但依赖隐式清理不可靠，战斗会话可能泄漏。
- 应在 Path B 的 `advanceStatus('returning')` 之后添加 `cancelBattle` 调用。

---

### 质疑 #5: 高亮行军路线缺少端到端集成测试

**Challenger 主张**: P1 — 仅测试了按钮回调，Canvas 渲染未验证。

**验证过程**:
- 确认 `SiegeTaskPanel.test.tsx` 仅验证 `onFocusMarchRoute(taskId)` 回调被触发。
- 确认 `PixelWorldMap.test.tsx` 和 `PixelWorldMap.defense-bar.test.tsx` 无 `highlightedTaskId` 相关测试。
- 功能代码链路存在：SiegeTaskPanel 按钮回调 → WorldMapTab.handleFocusMarchRoute → PixelWorldMap highlightedTaskId prop → renderHighlightedMarchOverlay。

**裁决**: **确认，但降级为 P2**。
- 功能实现完整（代码存在），仅测试覆盖不充分。
- 端到端集成测试的缺失属于测试质量问题，非功能缺陷。
- 当前测试至少覆盖了用户交互入口（按钮点击），降低了功能完全不可用的风险。

---

### 质疑 #6: R9 引入 TypeScript 类型错误

**Challenger 主张**: P1 — `previousOwner` 属性在 `TerritoryData` 类型中不存在。

**验证过程**:
- 读取 `territory.types.ts:29-50`，确认 `TerritoryData` 接口包含：`id`, `name`, `position`, `region`, `ownership`, `level`, `baseProduction`, `currentProduction`, `defenseValue`, `adjacentIds`。**不包含 `previousOwner`**。
- `tsc --noEmit` 输出确认: `WorldMapTab.tsx(640,37): error TS2339: Property 'previousOwner' does not exist on type 'TerritoryData'`。
- 另有 2 个 R9 相关 TS 错误: `siege-task.types.ts` 模块导入失败 + `CooldownManager.ts` 类型不匹配。

**裁决**: **确认，维持 P1**。
- `territory?.previousOwner` 访问了不存在的属性，运行时值为 `undefined`。
- 逻辑上 `isFirstCapture: !territory?.previousOwner` 将永远为 `true`（因为 `undefined` 取反为 `true`），导致所有攻城都被视为首次攻占，可能影响奖励计算。
- 此错误虽不会导致崩溃，但会导致业务逻辑偏差。

---

### 质疑 #7: 城防血条 ratio=0.6 边界值测试名实不符

**Challenger 主张**: P2 — 测试标题说 ratio=0.6 但实际用 0.6001。

**验证过程**:
- 读取测试文件行379-391：标题为 `ratio = 0.6 → 绿色 (#4caf50) — 边界值`，实际传入 `defenseRatio: 0.6001`。
- 代码逻辑：`ratio > 0.6 ? '#4caf50' : ratio > 0.3 ? '#ffc107' : '#e74c3c'`。严格大于，0.6 不是绿色。
- 注释行380明确承认: "ratio > 0.6 is strictly greater, so 0.6 is NOT green"。

**裁决**: **确认，维持 P2**。
- 测试标题具有误导性，但代码的边界逻辑（严格大于）是清晰的。
- 用 0.6001 回避了真正的边界值测试，真正的 0.6 应该走到黄色分支。
- 建议添加一个真正的 `ratio = 0.6 → 黄色` 测试用例。

---

### 质疑 #8: 集成测试不覆盖回城行军创建

**Challenger 主张**: P2 — `execute-siege-path.integration.test.ts` 无 `createReturnMarch`。

**验证过程**:
- 搜索集成测试中 `createReturnMarch`：返回 0 个结果。
- 集成测试覆盖到 `cancelBattle` 为止，未包含回城行军阶段。

**裁决**: **确认，维持 P2**。
- 回城行军是攻城流程的重要组成部分，集成测试应覆盖完整链路。
- 当前集成测试在 `cancelBattle` 处截断，未验证回城行军的创建和速度。

---

## 最终总结

**P0: 1, P1: 3, P2: 4**

Challenger 提出的 8 个质疑**全部成立**，但在严重度定级上有调整：

| 最终定级 | 数量 | 质疑编号 |
|----------|------|----------|
| P0 (阻塞发布) | 1 | #3 |
| P1 (需修复) | 3 | #2, #4, #6 |
| P2 (建议改进) | 4 | #1, #5, #7, #8 |

### 需要 Builder 修复的问题清单

**P0 — 必须修复才能发布:**
1. **#3**: 修复 `WorldMapTab.test.tsx` 的 2 个回归失败 — 同步更新测试 mock 以匹配 R9 重构后的交互流程。

**P1 — 本轮应修复:**
2. **#2**: 为 `MarchingSystem.test.ts` 添加 `createReturnMarch` 单元测试，验证回城速度 x0.8 和路径计算。
3. **#4**: 在 Path B (`battle:completed` handler) 中添加 `cancelBattle` 调用，防止战斗会话泄漏。
4. **#6**: 修复 TypeScript 类型错误 — 将 `territory?.previousOwner` 改为 `territory?.ownership` 或其他有效属性判断首次攻占；修复 `siege-task.types.ts` 的模块导入和 `CooldownManager.ts` 的类型不匹配。

**P2 — 建议改进:**
5. **#1**: 移除 `createReturnMarch` 中未使用的 `originalPath` 参数，或实现 "原路反转" 逻辑，并更正 JSDoc。
6. **#5**: 为高亮行军路线添加端到端集成测试（WorldMapTab → PixelWorldMap highlightedTaskId 传递 + Canvas 渲染断言）。
7. **#7**: 修正边界值测试标题或添加真正的 `ratio = 0.6 → 黄色` 测试用例。
8. **#8**: 在集成测试中扩展覆盖回城行军创建阶段。
