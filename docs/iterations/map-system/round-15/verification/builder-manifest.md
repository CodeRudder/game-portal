# R15 Builder Manifest — 攻城渲染流水线修复 (黑屏/时序/死代码)

**日期**: 2026-05-04
**角色**: Builder
**结论**: 3个功能点全部有证据，0个无证据

---

## Task 1 (P0): 黑屏修复 — clearRect 移除 + 强制 terrain dirty flag

### 证据 1.1: renderMarchSpritesOverlay 中不再有 ctx.clearRect(0,0,canvas.width,canvas.height)

- **文件**: `src/components/idle/panels/map/PixelWorldMap.tsx`
- **行号**: 1352-1361
- **验证方法**: Grep `clearRect(0,\s*0` 在 PixelWorldMap.tsx 中
- **结果**: 唯一匹配在行 1634 (`renderMinimap` 函数中，对 minimap canvas 的 clearRect，不影响主画布)。`renderMarchSpritesOverlay` 函数(行 1352-1450)中 **不存在** 任何 `clearRect` 调用。
- **替代逻辑** (行 1358-1361): 当 `marches.length === 0` 时直接 `return`，不做任何 canvas 操作，terrain 自然保持。

### 证据 1.2: 强制 terrain dirty flag 当 sprites 或 effects 变脏时

- **文件**: `src/components/idle/panels/map/PixelWorldMap.tsx`
- **行号**: 1054-1058
- **代码**:
```typescript
// R15 Task1: Force terrain redraw when overlays change
// (prevents black screen when sprite layer clears but terrain wasn't marked dirty)
if (flags.sprites || flags.effects) {
  flags.terrain = true;
}
```
- **位置**: `animate()` 渲染循环内，在脏标记快照(行 1061-1064)之前执行。确保任何 sprites/effects 层的重绘都强制触发 terrain 层重绘，防止黑屏。

### 证据 1.3: PixelWorldMap.terrain-persist 测试通过

- **测试文件**: `src/components/idle/panels/map/__tests__/PixelWorldMap.terrain-persist.test.tsx`
- **运行命令**: `npx vitest run src/components/idle/panels/map/__tests__/PixelWorldMap.terrain-persist.test.tsx`
- **结果**: 6/6 tests passed (18ms)

---

## Task 2 (P0): 动画时序修复 — handleArrived 推迟显示结果弹窗到 siegeAnim:completed 事件

### 证据 2.1: pendingSiegeResultRef 和 siegeAnimTimeoutRef refs 存在

- **文件**: `src/components/idle/panels/map/WorldMapTab.tsx`
- **行号**: 261-262
- **代码**:
```typescript
const pendingSiegeResultRef = useRef<any>(null);
const siegeAnimTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
```

### 证据 2.2: setSiegeResultVisible(true) 不在 executeSiege 后立即调用

- **文件**: `src/components/idle/panels/map/WorldMapTab.tsx`
- **行号**: 703-705
- **代码**:
```typescript
// Store result but don't show modal yet — wait for animation to complete
pendingSiegeResultRef.current = siegeResultData;
setSiegeResultData(siegeResultData);
```
- **说明**: 此处仅存储结果数据和设置 siegeResultData state，**不调用** `setSiegeResultVisible(true)`。

### 证据 2.3: eventBus.once('siegeAnim:completed', animHandler) 事件监听存在

- **文件**: `src/components/idle/panels/map/WorldMapTab.tsx`
- **行号**: 708-718
- **代码**:
```typescript
const animHandler = (animData: { taskId: string; targetCityId: string; victory: boolean }) => {
  if (animData.taskId === currentTask.id) {
    if (siegeAnimTimeoutRef.current) {
      clearTimeout(siegeAnimTimeoutRef.current);
      siegeAnimTimeoutRef.current = null;
    }
    setSiegeResultVisible(true);
  }
};
eventBus.once('siegeAnim:completed', animHandler);
```

### 证据 2.4: 5s fallback timeout 存在

- **文件**: `src/components/idle/panels/map/WorldMapTab.tsx`
- **行号**: 720-725
- **代码**:
```typescript
// Safety fallback: show modal after 5s even if animation event never fires
siegeAnimTimeoutRef.current = setTimeout(() => {
  eventBus.off('siegeAnim:completed', animHandler);
  siegeAnimTimeoutRef.current = null;
  setSiegeResultVisible(true);
}, 5000);
```

### 证据 2.5: Cleanup 在组件卸载时清除 timeout

- **文件**: `src/components/idle/panels/map/WorldMapTab.tsx`
- **行号**: 854-858
- **代码**:
```typescript
// Cleanup pending siege animation listeners
if (siegeAnimTimeoutRef.current) {
  clearTimeout(siegeAnimTimeoutRef.current);
  siegeAnimTimeoutRef.current = null;
}
```

### 证据 2.6: siege-animation-sequencing 测试通过

- **测试文件**: `src/components/idle/panels/map/__tests__/siege-animation-sequencing.test.tsx`
- **运行命令**: `npx vitest run src/components/idle/panels/map/__tests__/siege-animation-sequencing.test.tsx`
- **结果**: 6/6 tests passed (157ms)
- **覆盖场景**:
  - 结果弹窗在攻城执行后不立即显示
  - siegeAnim:completed 事件触发后弹窗可见
  - 延迟显示后结果数据正确
  - 5s fallback timeout 生效
  - 错误 taskId 不触发弹窗
  - 卸载时清理防止 stale callback

---

## Task 3 (P1): 死代码分析 — handleBattleCompleted 不存在，SettlementPipeline 单路径执行

### 证据 3.1: handleBattleCompleted 不存在于 WorldMapTab.tsx

- **验证方法**: Grep `handleBattleCompleted` 在 `src/components/idle/panels/map/WorldMapTab.tsx`
- **结果**: **0 matches found** — 函数不存在

### 证据 3.2: battle:completed 无监听器注册

- **验证方法**: Grep `battle:completed` 在 `src/components/idle/panels/map/WorldMapTab.tsx`
- **结果**: 仅出现在 **注释** 中(行 573, 577, 578, 657, 727, 811, 813)，无任何 `eventBus.on('battle:completed', ...)` 或 `eventBus.once('battle:completed', ...)` 注册调用。
- **架构说明** (行 570-579): 注释明确说明 SettlementPipeline 是攻城流程中的**唯一执行入口**，cancelBattle() 确保 SiegeBattleSystem 不会发出 battle:completed。

### 证据 3.3: SettlementPipeline 在 handleArrived 中使用

- **文件**: `src/components/idle/panels/map/WorldMapTab.tsx`
- **行号**: 42 (import), 504-506 (初始化), 601-620 (execute 调用)
- **代码** (行 504-506):
```typescript
const settlementPipeline = new SettlementPipeline();
settlementPipeline.setDependencies({ eventBus });
```
- **代码** (行 620):
```typescript
const settlementResult = settlementPipeline.execute(settlementCtx);
```
- **单路径确认**: SettlementPipeline.execute() 仅在 handleArrived 的 setTimeout(0) 回调中被调用，无其他调用路径。

---

## 集成测试验证

### 证据 4.1: WorldMapTab.test.tsx 通过

- **测试文件**: `src/components/idle/panels/map/__tests__/WorldMapTab.test.tsx`
- **运行命令**: `npx vitest run src/components/idle/panels/map/__tests__/WorldMapTab.test.tsx`
- **结果**: 33/33 tests passed (157ms)

### 证据 4.2: SiegeResultModal.test.tsx 通过

- **测试文件**: `src/components/idle/panels/map/__tests__/SiegeResultModal.test.tsx`
- **运行命令**: `npx vitest run src/components/idle/panels/map/__tests__/SiegeResultModal.test.tsx`
- **结果**: 60/60 tests passed (197ms)

---

## 引擎层测试验证

### 证据 5.1: settlement-pipeline-integration.test.ts 通过

- **测试文件**: `src/games/three-kingdoms/engine/map/__tests__/integration/settlement-pipeline-integration.test.ts`
- **运行命令**: `npx vitest run src/games/three-kingdoms/engine/map/__tests__/integration/settlement-pipeline-integration.test.ts`
- **结果**: 18/18 tests passed (6ms)

---

## 测试汇总

| 测试文件 | 测试数 | 结果 | 耗时 |
|---------|--------|------|------|
| PixelWorldMap.terrain-persist.test.tsx | 6 | PASS | 18ms |
| siege-animation-sequencing.test.tsx | 6 | PASS | 157ms |
| WorldMapTab.test.tsx | 33 | PASS | 157ms |
| SiegeResultModal.test.tsx | 60 | PASS | 197ms |
| settlement-pipeline-integration.test.ts | 18 | PASS | 6ms |
| **总计** | **123** | **ALL PASS** | — |

---

## 功能点证据统计

- **有证据**: 3 (Task1 黑屏修复, Task2 动画时序修复, Task3 死代码确认)
- **无证据**: 0
