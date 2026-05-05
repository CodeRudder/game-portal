# Builder Manifest — Round 28 异常处理路径审核

> **审核者**: Builder (客观审核)
> **日期**: 2026-05-05
> **范围**: ERR-1 ~ ERR-5 异常处理路径完成状态

## 审核结果汇总

| 检查项 | 状态 | 完成度 | 说明 |
|--------|------|--------|------|
| ERR-1 | 部分完成 | 60% | 有serialize/deserialize，但无自动状态持久化/断网恢复机制 |
| ERR-2 | 已完成 | 100% | launched=false正确降级返回，UI不卡住 |
| ERR-3 | 已完成 | 90% | 动画层5s fallback正确处理；timeExceeded在Path A中不可达但为已知问题(R24-I08) |
| ERR-4 | 已完成 | 95% | siege lock正确防护，有超时释放；但MAX_CONCURRENT_SIEGES未在创建时检查 |
| ERR-5 | 部分完成 | 75% | useEffect cleanup清理了主要资源，但部分setTimeout回调未检查组件挂载状态 |

**总计**: 2个已完成 / 0个未完成 / 3个部分完成

---

## 详细审核

### ERR-1: 攻城期间切后台/断网恢复 — 部分完成 (60%)

#### SiegeTask 状态持久化/恢复

**已有的机制**:
1. `SiegeTaskManager.serialize()` / `deserialize()` — 完整的任务状态序列化，包含所有字段(状态、时间戳、pauseSnapshot等)
2. `SiegeSystem.serialize()` / `deserialize()` — 攻城统计数据持久化(含captureTimestamps、insiderExposures)
3. `SiegeBattleSystem.serialize()` / `deserialize()` — 活跃战斗会话序列化
4. `SiegeBattleAnimationSystem.serialize()` / `deserialize()` — 动画状态序列化(含completedLinger精确恢复)
5. `MarchingSystem.serialize()` / `deserialize()` — 活跃行军序列化
6. `SiegeTaskManager.deserialize()` 在恢复时自动重建 siege locks（从非终态任务）

**缺失的机制**:
1. **无自动触发保存**: 所有serialize/deserialize方法存在，但没有自动定时保存或状态变更时自动持久化的逻辑。调用方需要手动触发。
2. **无断网检测/重连逻辑**: SiegeTaskManager不监听网络状态变化，没有`online`/`offline`事件监听。
3. **无暂停自动保存**: 当用户切后台时(visibilitychange)，没有自动调用serialize保存当前状态。
4. **暂停恢复后状态一致性**: `resumeSiege()`恢复后只恢复到`'sieging'`状态，`pauseSnapshot`被清除，但没有验证游戏世界状态是否与快照一致(如期间资源被其他玩家消耗)。

**结论**: 序列化基础设施完备(数据可完整保存和恢复)，但缺少自动化的状态持久化触发机制和断网恢复流程。需要上层(游戏引擎或App层)实现定时保存和重连逻辑。

---

### ERR-2: 行军中途资源被消耗 — 已完成 (100%)

#### executeSiege 中 checkSiegeConditions 失败的处理

**代码路径分析** (`SiegeSystem.ts`):
```
executeSiege() → checkSiegeConditions() → 返回 SiegeConditionResult
```

当`checkSiegeConditions`返回`canSiege: false`时:
```typescript
if (!condition.canSiege || !territory) {
  return {
    launched: false, victory: false, targetId,
    targetName: territory?.name ?? targetId,
    cost: { troops: 0, grain: 0 },
    failureReason: condition.errorMessage ?? '条件不满足',
    strategy,
  };
}
```

**关键行为**:
- `launched: false` — 明确标识攻城未发动
- `cost: { troops: 0, grain: 0 }` — 未消耗任何资源(资源守恒)
- `failureReason` — 包含具体错误信息(如"兵力不足"或"粮草不足")
- 不进入`resolveSiege()`，因此不扣减资源、不修改领土归属、不更新攻城计数

#### WorldMapTab 中 launched=false 的处理

在`handleArrived`回调中:
```typescript
const siegeResult = siegeSystem.executeSiege(...);
```
攻城结果会走完整的`SettlementPipeline`结算，无论胜利还是失败。`launched=false`时结果包含`victory: false`和`failureReason`，会正常推进状态:
- `sieging → settling → returning → completed`
- 结果弹窗正常显示

**潜在问题**: `launched=false`时仍走SettlementPipeline，pipeline会计算伤亡(基于失败路径)。但这不是"任务卡住"，而是降级处理。任务不会被卡住。

**结论**: launched=false路径完整降级，不扣资源，任务不卡住，用户能看到结果弹窗。

---

### ERR-3: 攻城超时处理 — 已完成 (90%)

#### SiegeBattleSystem.timeExceeded

**代码路径** (`SiegeBattleSystem.ts` line 230-232):
```typescript
const defenseDepleted = session.defenseValue <= 0;
const timeExceeded = session.elapsedMs >= session.estimatedDurationMs;

if (defenseDepleted || timeExceeded) {
  session.victory = defenseDepleted;
  ...
}
```

`timeExceeded`**是可达的**: 在SiegeBattleSystem的`update(dt)`循环中，当城防未在预估时间内耗尽，`timeExceeded`会触发战斗结束，此时`victory = false`(因为`defenseDepleted`为false)。

**但Path A(同步结算)中**:
- `handleArrived`中使用`executeSiege()`同步判定胜负
- 紧接着调用`cancelBattle()`取消战斗引擎中的会话
- SiegeBattleSystem永远不会为该任务自然完成

这意味着:
1. **战斗判定**: 由`executeSiege()`一次性决定(不依赖超时)
2. **动画超时**: 由`SiegeBattleAnimationSystem`和WorldMapTab中的5s fallback处理

#### 5s Fallback 分析

WorldMapTab line 706-710:
```typescript
siegeAnimTimeoutRef.current = setTimeout(() => {
  eventBus.off('siegeAnim:completed', animHandler);
  siegeAnimTimeoutRef.current = null;
  setSiegeResultVisible(true);
}, 5000);
```

**正确行为**:
- 正常路径: `completeSiegeAnimation()`触发`siegeAnim:completed` → `animHandler`显示弹窗
- 异常路径: 5s后自动显示弹窗(即使动画事件未触发)
- cleanup中清理timeout: `clearTimeout(siegeAnimTimeoutRef.current)`

**已知传递问题**: R24-I08记录了"timeExceeded不可达"问题，但实际审核发现timeExceeded在SiegeBattleSystem中是可达的。不可达性仅限于Path A(同步结算)，这是设计意图(战斗判定由executeSiege决定)。

**结论**: 超时处理通过5s fallback正确兜底。Path A中timeExceeded不可达是已知架构特性。

---

### ERR-4: 并发攻城竞态 — 已完成 (95%)

#### SiegeTaskManager Siege Lock

**acquireSiegeLock** (`SiegeTaskManager.ts` line 458-469):
```typescript
acquireSiegeLock(targetId: string, taskId: string): boolean {
  const existingLock = this.siegeLocks.get(targetId);
  if (existingLock && Date.now() - existingLock.lockedAt >= SIEGE_LOCK_TIMEOUT_MS) {
    this.siegeLocks.delete(targetId);
  }
  if (this.siegeLocks.has(targetId)) {
    return false;
  }
  this.siegeLocks.set(targetId, { taskId, lockedAt: Date.now() });
  return true;
}
```

**正确行为**:
- 同一targetId同一时刻只能被一个任务锁定
- 锁超时5分钟自动释放(在acquire时内联检查)
- `createTask()`在创建前先尝试获取锁，失败返回null

**releaseSiegeLock调用路径**:
1. `advanceStatus(taskId, 'completed')` — 任务正常完成时释放 (line 176)
2. `cancelTask(taskId)` — 强制取消时释放 (line 279)
3. `cancelSiege(taskId, ...)` — 回城不可达直接完成时释放 (line 430)
4. `removeCompletedTasks()` — 清理已完成任务时释放 (line 584)
5. `checkLockTimeout()` — 在update循环中检查并释放超时锁 (line 489-496)

#### MAX_CONCURRENT_SIEGES 检查

**问题**: WorldMapTab中没有定义`MAX_CONCURRENT_SIEGES`常量，`handleSiegeConfirm`中创建任务时**未检查并发任务数上限**。

当前仅有的并发限制是:
- SiegeTaskManager的siege lock: 同一targetId只允许一个任务
- 无全局并发数限制

**评估**: 从PRD角度看，没有明确的全局并发限制要求。siege lock足以防止同一目标的竞态。如果需要MAX_CONCURRENT_SIEGES=3限制，需要在WorldMapTab或SiegeTaskManager中添加。

**结论**: siege lock正确防护目标级竞态。缺少全局并发数限制，但非P0。

---

### ERR-5: 组件卸载时攻城进行中 — 部分完成 (75%)

#### useEffect Cleanup 分析

WorldMapTab的useEffect cleanup (line 844-857):
```typescript
return () => {
  cancelAnimationFrame(marchAnimRef.current);
  if (siegeAnimTimeoutRef.current) {
    clearTimeout(siegeAnimTimeoutRef.current);
    siegeAnimTimeoutRef.current = null;
  }
  siegeBattleSystem.destroy();
  siegeBattleSystemRef.current = null;
  siegeBattleAnimSystem.destroy();
  siegeBattleAnimRef.current = null;
  eventBus.off('march:arrived', handleArrived);
  eventBus.off('march:cancelled', handleCancelled);
};
```

**已清理的资源**:
1. `cancelAnimationFrame` — 停止动画循环
2. `clearTimeout(siegeAnimTimeoutRef.current)` — 清理5s fallback timeout
3. `siegeBattleSystem.destroy()` — 销毁战斗引擎(清除活跃战斗、移除事件监听)
4. `siegeBattleAnimSystem.destroy()` — 销毁动画系统(清除动画、移除事件监听)
5. `eventBus.off('march:arrived', handleArrived)` — 移除行军到达监听
6. `eventBus.off('march:cancelled', handleCancelled)` — 移除行军取消监听

**未完全清理的资源**:
1. **handleArrived内的setTimeout(0)**: 行军到达时创建的`setTimeout(() => { ... }, 0)`回调。如果组件在setTimeout触发前卸载，回调仍会执行，尝试调用`setActiveSiegeTasks`等state setter(React会警告"Cannot update an unmounted component")。不过由于SiegeTaskManager和eventBus是内存对象，不会崩溃，只是React警告。
2. **3秒清理timeout**: line 757-765的两个`setTimeout(() => { ... }, 3000)`。如果组件在3s内卸载，回调仍执行，但只调用`marchingSystem.removeMarch`和`setMarchNotification`，不会崩溃。
3. **攻城进行中的SiegeTask**: 组件卸载时SiegeTaskManager中的活跃任务不会被自动取消。如果组件重新挂载，`siegeTaskManagerRef.current`是同一个实例(useRef的持久化特性)，任务仍然存在。

**关于"行军精灵/攻城动画在卸载时清理"**:
- `marchingSystem`未被销毁或reset(它存在ref中，跨组件生命周期)
- 行军精灵继续在内存中更新(但不会渲染)
- 攻城动画通过`siegeBattleAnimSystem.destroy()`清除

**结论**: 核心资源(动画帧、timeout、事件监听)已清理。部分setTimeout回调可能触发已卸载组件的state更新(React warning)，但不会导致崩溃。SiegeTaskManager的任务跨组件生命周期保持，这是预期行为(ref持久化)。

---

## 测试执行结果

### 单元测试: SiegeSystem.test.ts
- **结果**: 40/40 通过
- **耗时**: 58ms

### 集成测试: integration/
- **结果**: 778/784 通过, 6失败
- **失败测试**: 均为`defeatTroopLoss`相关断言，期望480但实际为0
- **根因**: R27修复将失败路径兵力扣减改为由SettlementPipeline统一计算，`defeatTroopLoss`在SiegeSystem中设为0。集成测试仍断言旧值(30%)。这是**测试与代码不同步**问题，非功能缺陷。

---

## 发现的传递问题

| ID | 严重度 | 描述 | 建议处理 |
|----|--------|------|---------|
| R28-I01 | P2 | ERR-1: 无自动状态持久化触发机制 | 文档化，由上层引擎实现 |
| R28-I02 | P2 | ERR-5: handleArrived内setTimeout(0)回调在卸载后可能触发 | 添加isMounted守卫 |
| R28-I03 | P2 | ERR-4: 无MAX_CONCURRENT_SIEGES全局并发限制 | 评估是否PRD需求 |
| R28-I04 | P1 | 集成测试6个defeatTroopLoss断言与代码不同步 | 修复测试对齐R27变更 |

---

*Builder Manifest | Round 28 | 2026-05-05 | 异常处理路径审核*
