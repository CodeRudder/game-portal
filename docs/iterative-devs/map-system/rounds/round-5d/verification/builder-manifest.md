# Round 5d Builder Manifest — 对抗性评测验证报告

**日期**: 2026-05-04
**角色**: Builder
**状态**: ALL PASS

---

## A: siegeTaskId 序列化 round-trip

### 功能点描述
`MarchUnit.siegeTaskId` 字段在 `serialize()` / `deserialize()` 往返后完整保留，覆盖有值和无值两种场景。

### 实现位置
- **接口定义**: `src/games/three-kingdoms/engine/map/MarchingSystem.ts:63` — `MarchUnit.siegeTaskId?: string`
- **序列化**: `src/games/three-kingdoms/engine/map/MarchingSystem.ts:497-510` — `serialize()` 直接保存 `activeMarches` 数组（含 siegeTaskId），`deserialize()` 逐条恢复

### 测试文件
`src/games/three-kingdoms/engine/map/__tests__/MarchingSystem.test.ts`

### 测试结果

```
 ✓ src/games/three-kingdoms/engine/map/__tests__/MarchingSystem.test.ts  (29 tests) 5ms
 Test Files  1 passed (1)
      Tests  29 passed (29)
```

### 覆盖的场景
| 测试用例 | 行号 | 场景 |
|---------|------|------|
| `siegeTaskId在序列化/反序列化后保留` | L293-305 | siegeTaskId 有值（`'task-serialize-123'`）时 round-trip 保留 |
| `未设置siegeTaskId的行军序列化/反序列化后仍为undefined` | L307-319 | siegeTaskId 未设置时 round-trip 后仍为 `undefined` |

---

## B: 事件 payload 类型接口

### 功能点描述
四个行军事件拥有强类型 payload 接口，UI 层使用类型化接口而非 `data: any`。

### 实现位置
- **MarchCreatedPayload**: `src/games/three-kingdoms/engine/map/MarchingSystem.ts:91-98`
- **MarchStartedPayload**: `src/games/three-kingdoms/engine/map/MarchingSystem.ts:101-105`
- **MarchArrivedPayload**: `src/games/three-kingdoms/engine/map/MarchingSystem.ts:108-113`
- **MarchCancelledPayload**: `src/games/three-kingdoms/engine/map/MarchingSystem.ts:116-120`
- **UI import**: `src/components/idle/panels/map/WorldMapTab.tsx:36` — `import type { ..., MarchArrivedPayload, MarchCancelledPayload } from '.../MarchingSystem'`
- **handleArrived 类型签名**: `src/components/idle/panels/map/WorldMapTab.tsx:403` — `const handleArrived = (data: MarchArrivedPayload) => {`
- **handleCancelled 类型签名**: `src/components/idle/panels/map/WorldMapTab.tsx:564` — `const handleCancelled = (data: MarchCancelledPayload) => {`

### 测试文件
类型安全由 TypeScript 编译器验证。构建通过即证明类型一致。

### 测试结果

```
✓ built in 7.06s
```

### 覆盖的场景
- `handleArrived` 使用 `MarchArrivedPayload` 类型（不再是 `data: any`）
- `handleCancelled` 使用 `MarchCancelledPayload` 类型（不再是 `data: any`）
- `MarchingSystem.ts` 中 `emit('march:created', ...)` / `emit('march:started', ...)` / `emit('march:arrived', ...)` / `emit('march:cancelled', ...)` 的 payload 结构与接口定义匹配

---

## C: handleSiegeConfirm 注释修正

### 功能点描述
`handleSiegeConfirm` 函数的注释已改为"同步触发异步流程"，准确描述其语义（同步创建任务+行军，异步等待到达后攻城）。

### 实现位置
- `src/components/idle/panels/map/WorldMapTab.tsx:877` — 注释原文: `// ── 攻城执行入口（同步触发异步流程：创建任务→行军→到达时自动攻城） ──`

### 测试文件
静态代码审查，无需单独测试。

### 覆盖的场景
- 注释语义正确：函数在同步上下文中创建 SiegeTask + MarchUnit，实际攻城在 `handleArrived` 回调中异步执行

---

## D: cancelMarch siegeTaskId 事件 payload

### 功能点描述
`cancelMarch` 在删除 march 之前将 `siegeTaskId` 附加到事件 payload，UI 层 `handleCancelled` 从 payload 直接读取 `siegeTaskId` 以清理关联的攻占任务。

### 实现位置
- **cancelMarch 方法**: `src/games/three-kingdoms/engine/map/MarchingSystem.ts:292-303`
  - L301: `siegeTaskId: march.siegeTaskId` — 在 `this.activeMarches.delete(marchId)` 之前读取
- **handleCancelled**: `src/components/idle/panels/map/WorldMapTab.tsx:564-584`
  - L565: `const { siegeTaskId } = data ?? {};` — 从 event payload 直接解构
  - L566-583: 使用 `siegeTaskId` 查找并清理关联任务

### 测试文件
`src/games/three-kingdoms/engine/map/__tests__/MarchingSystem.test.ts`

### 测试结果

```
 ✓ src/games/three-kingdoms/engine/map/__tests__/MarchingSystem.test.ts  (29 tests) 5ms
 Test Files  1 passed (1)
      Tests  29 passed (29)
```

### 覆盖的场景
| 测试用例 | 行号 | 场景 |
|---------|------|------|
| `cancelMarch事件payload包含siegeTaskId` | L148-158 | 设置 `march.siegeTaskId = 'task-test-123'`，验证 `march:cancelled` payload 包含该值 |

---

## E: SiegeTaskPanel 测试完整性

### 功能点描述
SiegeTaskPanel 组件测试覆盖渲染、状态展示、用户交互等场景。

### 实现位置
- **组件**: `src/components/idle/panels/map/SiegeTaskPanel.tsx`
- **测试**: `src/components/idle/panels/map/__tests__/SiegeTaskPanel.test.tsx`

### 测试结果

```
 ✓ src/components/idle/panels/map/__tests__/SiegeTaskPanel.test.tsx  (27 tests) 55ms
 Test Files  1 passed (1)
      Tests  27 passed (27)
```

### 覆盖的场景
- 27 个测试用例全部通过
- 涵盖组件渲染、任务状态展示、交互行为等

---

## F: SiegeTaskManager 状态机

### 功能点描述
SiegeTaskManager 管理攻占任务全生命周期：preparing -> marching -> sieging -> settling -> returning -> completed。

### 实现位置
- **实现**: `src/games/three-kingdoms/engine/map/SiegeTaskManager.ts`
- **测试**: `src/games/three-kingdoms/engine/map/__tests__/SiegeTaskManager.test.ts`

### 测试结果

```
 ✓ src/games/three-kingdoms/engine/map/__tests__/SiegeTaskManager.test.ts  (16 tests) 3ms
 Test Files  1 passed (1)
      Tests  16 passed (16)
```

### 覆盖的场景
- 16 个测试用例全部通过
- 涵盖状态创建、推进、结果设置、完成清理等

---

## G: 编队系统测试

### 功能点描述
ExpeditionSystem 管理英雄编队，支持编队创建、英雄派遣、伤亡处理等。

### 实现位置
- **实现**: `src/games/three-kingdoms/engine/map/ExpeditionSystem.ts`
- **测试**: `src/games/three-kingdoms/engine/map/__tests__/ExpeditionSystem.test.ts`

### 测试结果

```
 ✓ src/games/three-kingdoms/engine/map/__tests__/ExpeditionSystem.test.ts  (20 tests) 3ms
 Test Files  1 passed (1)
      Tests  20 passed (20)
```

### 覆盖的场景
- 20 个测试用例全部通过
- 涵盖编队创建、英雄分配、状态管理等

---

## 汇总

| 验证点 | 状态 | 测试数 | 通过 | 失败 |
|-------|------|--------|------|------|
| A: siegeTaskId 序列化 round-trip | PASS | 2 (within 29) | 2 | 0 |
| B: 事件 payload 类型接口 | PASS | build pass | - | - |
| C: handleSiegeConfirm 注释修正 | PASS | static review | - | - |
| D: cancelMarch siegeTaskId payload | PASS | 1 (within 29) | 1 | 0 |
| E: SiegeTaskPanel 测试 | PASS | 27 | 27 | 0 |
| F: SiegeTaskManager 状态机 | PASS | 16 | 16 | 0 |
| G: 编队系统测试 | PASS | 20 | 20 | 0 |
| **总计** | **ALL PASS** | **92+** | **92+** | **0** |

**构建状态**: `vite build` 通过 (7.06s)
