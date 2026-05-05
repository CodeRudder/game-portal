# Round 5e Phase 1 — Builder Manifest (Verification Report)

**Date:** 2026-05-04
**Status:** ALL PASS

---

## A. P2-01: emit 泛型参数

**File:** `src/games/three-kingdoms/engine/map/MarchingSystem.ts`

### 验证: 所有4处 emit 调用使用显式泛型参数

| # | 行号 | 代码证据 |
|---|------|----------|
| 1 | L201 | `this.deps.eventBus.emit<MarchArrivedPayload>('march:arrived', { marchId: id, cityId: march.toCityId, troops: march.troops, general: march.general, siegeTaskId: march.siegeTaskId })` |
| 2 | L263 | `this.deps.eventBus.emit<MarchCreatedPayload>('march:created', { marchId: id, fromCityId, toCityId, troops, general, estimatedTime })` |
| 3 | L284 | `this.deps.eventBus.emit<MarchStartedPayload>('march:started', { marchId, fromCityId: march.fromCityId, toCityId: march.toCityId })` |
| 4 | L301 | `this.deps.eventBus.emit<MarchCancelledPayload>('march:cancelled', { marchId, troops: march.troops, siegeTaskId: march.siegeTaskId })` |

**结论:** 全部4处 emit 均使用显式泛型参数 `<...Payload>` -- PASS

### 测试结果

```
RUN  v1.6.1
  src/games/three-kingdoms/engine/map/__tests__/MarchingSystem.test.ts  (30 tests) 5ms
  Test Files  1 passed (1)
       Tests  30 passed (30)
  Duration  470ms
```

---

## B. P2-02: eventBus 类型化

**File:** `src/components/idle/panels/map/WorldMapTab.tsx`

### B.1 验证: `IEventBus` 已被 import

**行号:** L50
```typescript
import type { IEventBus } from '@/games/three-kingdoms/core/types/events';
```

### B.2 验证: `as any` 已替换为 `as IEventBus`

**行号:** L384
```typescript
    } as IEventBus;
```

完整 eventBus 对象字面量定义在 L347-L384，使用 `as IEventBus` 类型断言替代了原来的 `as any`。

### B.3 验证: `once()` 方法返回 `Unsubscribe`

**行号:** L366-L376
```typescript
      once: (event: string, handler: (payload: any) => void) => {
        const wrapper = (payload: any) => {
          handler(payload);
          listeners.get(event)?.delete(wrapper);
        };
        if (!listeners.has(event)) {
          listeners.set(event, new Set());
        }
        listeners.get(event)!.add(wrapper);
        return () => listeners.get(event)?.delete(wrapper);  // <-- 返回 Unsubscribe
      },
```

对照 `IEventBus` 接口定义 (`src/games/three-kingdoms/core/types/events.ts` L77):
```typescript
once<T = unknown>(event: string, handler: (payload: T) => void): Unsubscribe;
```

**结论:** `as IEventBus` 替换完成，`once()` 返回 `Unsubscribe` 函数 -- PASS

---

## C. P1-01 (from R5d): handleCancelled 清理

**File:** `src/components/idle/panels/map/WorldMapTab.tsx`

### 验证: cleanup 函数包含 `eventBus.off('march:cancelled', handleCancelled)`

**行号:** L618-L622 (useEffect cleanup return)
```typescript
    return () => {
      cancelAnimationFrame(marchAnimRef.current);
      eventBus.off('march:arrived', handleArrived);
      eventBus.off('march:cancelled', handleCancelled);
    };
```

**结论:** `handleCancelled` 在 cleanup 中正确解除订阅 -- PASS

---

## D. P2-03 (from R5d): MarchArrivedPayload siegeTaskId

**File:** `src/games/three-kingdoms/engine/map/MarchingSystem.ts`

### D.1 验证: `MarchArrivedPayload` 包含 `siegeTaskId?: string`

**行号:** L108-L115
```typescript
export interface MarchArrivedPayload {
  marchId: string;
  cityId: string;
  troops: number;
  general: string;
  /** 关联的攻占任务ID（与march:cancelled一致，用于行军→攻城联动） */
  siegeTaskId?: string;
}
```

### D.2 验证: emit 包含 `siegeTaskId: march.siegeTaskId`

**行号:** L201-L207
```typescript
        this.deps.eventBus.emit<MarchArrivedPayload>('march:arrived', {
          marchId: id,
          cityId: march.toCityId,
          troops: march.troops,
          general: march.general,
          siegeTaskId: march.siegeTaskId,
        });
```

### D.3 验证: handleArrived 直接从 payload 读取 siegeTaskId（不再需要 getMarch 二次查找）

**File:** `src/components/idle/panels/map/WorldMapTab.tsx`

**行号:** L405-L422 (handleArrived 函数)
```typescript
    const handleArrived = (data: MarchArrivedPayload) => {
      const { marchId, cityId, troops, general } = data ?? {};
      // ...
      const siegeTaskManager = siegeTaskManagerRef.current;
      const siegeTaskId = data.siegeTaskId;                          // <-- 直接从 payload 读取
      const associatedTask = siegeTaskId ? siegeTaskManager.getTask(siegeTaskId) : null;
```

无需调用 `marchingSystem.getMarch(marchId)?.siegeTaskId` 二次查找，直接使用 payload 中的 `siegeTaskId`。

**结论:** siegeTaskId 通过 payload 传递，handleArrived 直接读取 -- PASS

---

## E. P2-04: 异步 siege 执行

**File:** `src/components/idle/panels/map/WorldMapTab.tsx`

### E.1 验证: siege 执行块被 `setTimeout(0)` 包裹

**行号:** L428-L539
```typescript
        setTimeout(() => {
          // 防重复处理守卫：再次检查任务状态是否仍有效
          const currentTask = siegeTaskManager.getTask(taskId);
          if (!currentTask || currentTask.result) return;

          const eng = engineRef.current;
          if (eng) {
            const siegeSystem = eng.getSiegeSystem?.() ?? eng?.siege;
            if (siegeSystem?.executeSiege) {
              // ... 攻城执行逻辑 (L438-L534)
            }
          }
          // 更新攻占任务列表
          setActiveSiegeTasks(siegeTaskManager.getActiveTasks());
        }, 0);
```

整个 siege 执行（executeSiege、伤亡计算、结果设置、回城行军创建）均在 `setTimeout(() => {...}, 0)` 内部。

### E.2 验证: 状态更新（通知、活跃行军更新）保持同步

**行号:** L410-L417 (在 setTimeout 外部，同步执行)
```typescript
      // 更新活跃行军列表 (同步)
      setActiveMarches(marchingSystem.getActiveMarches());

      // 查找目标领土信息
      const targetTerritory = territoriesRef.current.find((t) => t.id === cityId);
      const targetName = targetTerritory?.name ?? cityId ?? '未知';

      // 显示到达通知 (同步)
      setMarchNotification(`${general ?? '部队'}率${troops ?? 0}兵到达${targetName}`);
```

`setActiveMarches` 和 `setMarchNotification` 在 setTimeout 之前同步调用，确保 UI 即时更新。

**结论:** siege 异步执行，状态更新同步 -- PASS

---

## F. 整体测试

### 运行命令
```bash
npx vitest run \
  src/games/three-kingdoms/engine/map/__tests__/MarchingSystem.test.ts \
  src/games/three-kingdoms/engine/map/__tests__/SiegeTaskManager.chain.test.ts \
  src/games/three-kingdoms/engine/map/__tests__/SiegeTaskManager.test.ts
```

### 测试结果

```
RUN  v1.6.1

  MarchingSystem.test.ts       (30 tests) 5ms   -- PASS
  SiegeTaskManager.chain.test  (25 tests) 4ms   -- PASS
  SiegeTaskManager.test.ts     (16 tests) 3ms   -- PASS

  Test Files  3 passed (3)
       Tests  71 passed (71)
  Duration  482ms
```

**结论:** 全部 3 个测试文件、71 个用例通过 -- PASS

---

## 汇总

| 验证项 | 状态 | 证据 |
|--------|------|------|
| A. P2-01 emit泛型参数 | PASS | 4处 emit 均使用显式 `<Payload>` 泛型 |
| B. P2-02 eventBus类型化 | PASS | `as IEventBus` + import + once返回Unsubscribe |
| C. P1-01 handleCancelled清理 | PASS | cleanup中 `eventBus.off('march:cancelled', handleCancelled)` |
| D. P2-03 siegeTaskId传递 | PASS | payload含 siegeTaskId，handleArrived直接读取 |
| E. P2-04 异步siege执行 | PASS | setTimeout(0)包裹siege，状态更新同步 |
| F. 整体测试 | PASS | 3文件/71用例全部通过 |

**Phase 1 验证完成: 6/6 PASS**
