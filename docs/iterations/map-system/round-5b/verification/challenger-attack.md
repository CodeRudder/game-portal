# Challenger Attack Report: 攻占任务完整流程 (MAP-F06-P5~P10)

> Challenger 角色 | 攻击时间: 2026-05-04
> 目标: 推翻 Builder "MAP-F06-P5~P10 已完整实现，16/16 测试通过" 的结论
> 攻击对象: builder-manifest.md (最新版)

---

## Executive Summary

Builder 声称 P5~P10 攻占任务完整流程已实现，16/16 测试通过。经代码级验证，**SiegeTaskManager 引擎层确实存在且测试通过**，但 **P10 回城完成逻辑存在一个致命 bug 会导致运行时必定失败**，UI 集成层零测试覆盖，`march:cancelled` 异常场景完全未处理。Builder 的结论可信度约 **30%**。

---

## 攻击矩阵

### 1. 漏洞攻击: 双路径共存 -- 异步流程可能被旁路

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 |
|--------|--------------|-------------|-------------|
| handleSiegeConfirm 是否一定走异步流程 | P5~P10 完整异步链路已实现 | WorldMapTab.tsx 中存在**两套行军流程**: (1) `handleStartMarch`(行652-693) -- 旧同步行军，**不创建 SiegeTask**、**不设置 `_siegeTaskId`**;(2) `handleSiegeConfirm`(行877-967) -- 新异步流程。当用户通过 `handleSelectTerritory` -> `handleStartMarch` 路径触发行军时(行715-719)，**完全绕过 SiegeTaskManager**，行军到达后走到 `handleArrived` 的 else 分支(行525-536)打开旧攻城弹窗。 | 缺少证据证明旧路径已被禁用或统一。`handleStartMarch` 没有任何 SiegeTask 集成代码，仍可被用户操作直接触发。 |
| `onSiegeTerritory` 外部回调旁路 | 完整流程已实现 | 行745-748: 如果上层组件传入 `onSiegeTerritory` prop，则 `handleSiege` 直接 return，**完全跳过内部攻城弹窗和 handleSiegeConfirm**，SiegeTaskManager 不会被调用。 | 缺少对 `onSiegeTerritory` 使用场景的说明和测试。 |

**代码证据**:
- `WorldMapTab.tsx` 行652-693 (`handleStartMarch`): 创建行军但不创建 SiegeTask，不设 `_siegeTaskId`
- `WorldMapTab.tsx` 行715-719: `handleSelectTerritory` 中直接调用 `handleStartMarch`
- `WorldMapTab.tsx` 行745-748: `onSiegeTerritory` 存在时直接透传，不进入内部流程

---

### 2. 幻觉攻击: 行号验证与测试覆盖

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 |
|--------|--------------|-------------|-------------|
| 行877/912/937/947/949/952 行号准确性 | 引用了精确行号 | **经验证，Builder引用的行号全部准确**: 行877确实为`handleSiegeConfirm`入口，行912为`createTask`调用，行937为`createMarch`调用，行947为`_siegeTaskId`赋值，行949为`startMarch`，行952为`advanceStatus`。行1344-1349的SiegeTaskPanel绑定也准确。 | 行号本身无误，但Builder选择性忽略了旧路径代码(行652-693)的存在。 |
| 16/16测试 = P5~P10完整覆盖 | 测试全通过所以实现完整 | **全部16个测试仅覆盖 `SiegeTaskManager`（引擎层）的纯逻辑**，不涉及任何 UI 集成。测试中从未创建 MarchingSystem、从未发射 march:arrived 事件、从未验证 `_siegeTaskId` 关联机制。UI 集成层的关键流程（`handleSiegeConfirm` -> `handleArrived` -> 回城行军）**零测试覆盖**。 | 缺少 UI 集成层测试。WorldMapTab.test.tsx 中的攻城测试(行543-601)测试的是列表模式下的同步攻城流程，不涉及 SiegeTask 异步链路。 |

**代码证据**:
- `SiegeTaskManager.test.ts` 全文373行: 没有任何 `MarchingSystem` import，没有 `_siegeTaskId`，没有 `march:arrived` 事件模拟
- `WorldMapTab.test.tsx` 行443-516 "行军集成" describe 块: 测试的是 `handleStartMarch` 旧路径，不是 `handleSiegeConfirm` 新路径
- `WorldMapTab.test.tsx` 行543-601 "攻城动画集成": 使用列表模式点击攻城按钮，走的是**同步攻城**(通过 SiegeConfirmModal mock 直接 onConfirm)，不验证 SiegeTaskManager 调用

---

### 3. 无证据攻击: 端到端测试缺失

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 |
|--------|--------------|-------------|-------------|
| 完整链路端到端测试 | Builder声称"完整链路验证"(Section 3.3) | Builder声称的"完整链路验证"实际上只是**代码阅读梳理出的调用链**，不是自动化测试。搜索 `e2e-map-flow.integration.test.ts`，其中**不包含任何 SiegeTask/SiegeTaskManager 的 import 或引用**。该集成测试只覆盖 SiegeSystem + MarchingSystem 的旧流程。 | 缺少 P5~P10 端到端集成测试。没有任何测试模拟: createTask -> createMarch -> march:arrived -> executeSiege -> setResult -> returnMarch -> march:arrived(completed) 的完整链路。 |
| SiegeTaskPanel 组件测试 | SiegeTaskPanel 在行为清单中列出 | **SiegeTaskPanel 没有独立测试文件**。glob 搜索 `**/SiegeTaskPanel*.test.*` 返回空。WorldMapTab.test.tsx 中也**未渲染 SiegeTaskPanel**(组件在 JSX 行1344，但测试使用 mock)。 | 缺少 SiegeTaskPanel 的渲染测试: 状态标签显示、ETA 计算、进度条渲染、空列表处理等。 |

**代码证据**:
- `e2e-map-flow.integration.test.ts` 的 import 列表(行7-17): 无 SiegeTaskManager
- Grep 搜索 `SiegeTask|SiegeTaskManager` in `e2e-map-flow.integration.test.ts`: **No matches found**
- glob `**/SiegeTaskPanel*.test.*`: **No files found**

---

### 4. 集成断裂攻击: `_siegeTaskId` 脆弱机制 + P10 致命 bug

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 |
|--------|--------------|-------------|-------------|
| `MarchUnit` 接口是否支持 `_siegeTaskId` | 通过 `(march as any)._siegeTaskId` 可靠关联 | **`MarchUnit` 接口(MarchingSystem.ts 行30-62)中没有 `_siegeTaskId` 字段**。它只有: id, fromCityId, toCityId, x, y, path, pathIndex, speed, faction, troops, general, morale, state, startTime, eta, animFrame。通过 `as any` 逃逸类型检查挂载属性，有以下风险: (a) TypeScript 编译器无法检测拼写错误;(b) 序列化时 `serialize()` 只保存接口定义的字段(行462-466)，`_siegeTaskId` 会丢失;(c) `Map.set(march.id, march)` 存的是对象引用，所以运行时可以读取，但如果 `deserialize` 恢复，属性就消失了。 | 缺少证据证明 `_siegeTaskId` 在序列化/反序列化后仍可工作。缺少 MarchUnit 接口扩展。 |
| **回城行军是否关联 `_siegeTaskId` (致命)** | P10 回城行军完整 | **回城行军(行476-484)没有设置 `_siegeTaskId`**。`handleArrived`(行418-421)通过 `marchUnit._siegeTaskId` 查找关联任务，回城行军到达时 `siegeTaskId` 为 undefined，`associatedTask` 为 null。回城完成的逻辑(行539)依赖 `associatedTask?.status === 'returning'` 判断，**但 `associatedTask` 为 null，此条件永远不会满足**。这是一个**运行时必定失败**的 bug: SiegeTask 永远无法到达 `completed` 状态。 | 需要证据表明回城行军设置了 `_siegeTaskId`，或者回城有其他匹配机制。目前两者都不存在。 |
| 多任务 `_siegeTaskId` 冲突 | "无遗漏" | 全局唯一的 `_siegeTaskId` 使用任务 ID(如 `siege-task-1`)绑定到 march 对象上。问题不在于冲突，而在于 **march 对象在 `cancelMarch` 或 `removeMarch` 后被从 Map 中删除**(行262, 289)，`getMarch(marchId)` 返回 undefined。 | 缺少对 march 生命周期与 SiegeTask 生命周期的同步分析。 |

**关键代码证据 -- 致命 bug**:

**MarchUnit 接口 (无 `_siegeTaskId`)**:
```typescript
// MarchingSystem.ts:30-62
export interface MarchUnit {
  id: string;
  fromCityId: string;
  toCityId: string;
  // ... 15个字段，无 _siegeTaskId
}
```

**回城行军创建 (无 `_siegeTaskId` 赋值)**:
```typescript
// WorldMapTab.tsx:476-484
const returnMarch = marchingSystemRef.current!.createMarch(
  associatedTask.targetId,
  associatedTask.sourceId,
  associatedTask.expedition.troops - effectiveTroopsLost,
  associatedTask.expedition.heroName,
  'wei',
  returnRoute.path.map((p) => ({ x: p.x, y: p.y })),
);
marchingSystemRef.current!.startMarch(returnMarch.id);
// 注意: 没有 (returnMarch as any)._siegeTaskId = task.id
```

**回城检测 (依赖 `associatedTask` 非 null)**:
```typescript
// WorldMapTab.tsx:539
if (targetTerritory && targetTerritory.ownership === 'player' && associatedTask?.status === 'returning') {
  siegeTaskManager.advanceStatus(associatedTask.id, 'completed');
```
由于回城 march 没有 `_siegeTaskId`，`associatedTask` 为 null，`associatedTask?.status === 'returning'` 为 `undefined === 'returning'`，结果为 false。**SiegeTask 永远停在 `returning` 状态。**

---

### 5. 流程断裂攻击: 异常场景未处理

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 |
|--------|--------------|-------------|-------------|
| **`march:cancelled` 后 SiegeTask 卡死** | 状态机完整 | `MarchingSystem.cancelMarch()`(行258-269)发射 `march:cancelled` 事件并删除 march。但 **WorldMapTab.tsx 没有监听 `march:cancelled` 事件**。Grep 搜索 `march:cancelled` 在 WorldMapTab.tsx 中返回**零匹配**。如果行军被取消(例如用户操作或系统异常)，SiegeTask 将永久停留在 `marching` 状态，永远无法推进。 | 缺少 `march:cancelled` 事件监听器。缺少 SiegeTask 超时/回退机制。缺少 "stuck task" 检测与恢复逻辑。 |
| 攻城失败后回城行军是否仍创建 | P9/P10 完整 | 攻城失败时(行445-447) `effectiveTroopsLost` 使用 `defeatTroopLoss`，回城行军(行476-484)仍会创建，使用 `troops - effectiveTroopLoss` 兵力。这部分逻辑确实存在，但**回城行军的 `_siegeTaskId` 问题**(见质疑4)导致 P10 completed 状态无法正确到达。 | 攻城失败的回城行军确实创建了，但由于 `_siegeTaskId` 缺失，`completed` 状态无法被触发。 |
| `returnRoute` 为 null 时 P10 断裂 | P10 完整 | 行471-485: 回城行军创建包裹在 `if (returnRoute)` 条件中。如果 `calculateMarchRoute` 返回 null（路径不可达），回城行军不会被创建，SiegeTask 将停留在 `returning` 状态，永远不会完成。 | 缺少 `returnRoute` 为 null 时的 fallback 处理。缺少 SiegeTask 超时自动完成机制。 |

---

## 测试覆盖严重不足汇总

| 层级 | Builder声称 | 实际情况 | 缺失 |
|------|-----------|---------|------|
| 引擎层 SiegeTaskManager | 16/16 通过 | 确认通过，纯逻辑覆盖 | 状态机逻辑 OK |
| UI 集成层 handleSiegeConfirm | "PASS" | **零测试** | 无测试验证 SiegeTask 创建 + March 创建 + `_siegeTaskId` 关联的完整流程 |
| UI 集成层 handleArrived | "PASS" | **零测试** | 无测试验证 march:arrived -> SiegeTask 匹配 -> executeSiege -> setResult 的完整流程 |
| UI 集成层 回城行军 | "PASS" | **零测试** | 无测试验证回城行军创建和 completed 状态到达 |
| SiegeTaskPanel 组件 | "集成于E2E" | **零测试** | 无组件渲染测试 |
| 端到端集成 P5~P10 | "完整链路验证" | **零测试**，仅为代码阅读 | 缺少自动化 E2E 测试 |
| 异常场景(取消/超时/断裂) | 未提及 | **零测试** | march:cancelled、returnRoute=null、多重任务并发 |

---

## 严重度分类

### P0 -- 致命 (Blocker, 运行时必定失败)

| # | 质疑点 | 影响 |
|---|--------|------|
| B1 | **回城行军不设 `_siegeTaskId`，P10 completed 状态永远无法到达** | SiegeTask 永远停在 `returning` 状态，`removeCompletedTasks()` 永远不会清理该任务，任务面板永远显示已回城但未完成的任务 |
| B2 | **`march:cancelled` 无监听，SiegeTask 永久卡在 marching** | 用户取消行军后，任务面板显示"行军中"但实际行军已消失，无法恢复 |

### P1 -- 严重 (Critical)

| # | 质疑点 | 影响 |
|---|--------|------|
| C1 | `_siegeTaskId` 使用 `as any` 逃逸类型系统 | 不在 MarchUnit 接口中，序列化会丢失，TypeScript 无法保护 |
| C2 | 旧同步路径仍存在 (`handleStartMarch`) | 用户可通过旧路径触发不含 SiegeTask 的行军 |
| C3 | 零 UI 集成测试 | P5~P10 核心逻辑在 WorldMapTab.tsx 中，但无测试覆盖 |
| C4 | SiegeTaskPanel 无测试 | 组件存在但零测试 |
| C5 | `onSiegeTerritory` 旁路 | 外部回调可跳过整个异步流程 |
| C6 | `returnRoute` 为 null 时无 fallback | SiegeTask 卡在 returning |

### P2 -- 一般 (Minor)

| # | 质疑点 | 影响 |
|---|--------|------|
| M1 | Builder 选择性忽略旧路径代码 | 清单完整性存疑 |

---

## 总体结论

### Builder 结论可信度: **低 (约30%)**

Builder 的 16/16 测试通过是真实的，但只证明了 **SiegeTaskManager 纯状态机逻辑** 的正确性，远不足以证明 P5~P10 完整流程已实现。

### 最致命的发现

**P10 回城完成逻辑断裂**: 回城行军不设 `_siegeTaskId`，导致 `handleArrived` 中 `associatedTask` 为 null，行539的条件永远不满足，SiegeTask 永远无法到达 `completed` 状态。这是一个**通过代码阅读即可确认的、运行时必定复现的 bug**，任何端到端测试都能发现，但 Builder 没有运行端到端测试。

### 建议修复

1. **[P0]** 给回城行军也设置 `_siegeTaskId`，或将 `_siegeTaskId` 加入 MarchUnit 接口
2. **[P0]** 添加 `march:cancelled` 监听器清理/回退 SiegeTask
3. **[P1]** 添加至少一个端到端集成测试覆盖 P5~P10 完整链路
4. **[P1]** 禁用或统一旧行军路径
5. **[P1]** 添加 `returnRoute` 为 null 时的 fallback 处理

---

*Challenger 攻击完成。10 个有效质疑点 (P0: 2, P1: 6, P2: 1, 维持 Builder 行号准确性: 1)*
