# Judge Ruling -- Round 17

> **裁决日期**: 2026-05-04
> **裁决者**: Judge
> **审核对象**: Builder Manifest vs Challenger Attack Report

---

## 裁决总览

| 质疑ID | Challenger观点 | Builder观点 | 裁决 | 理由摘要 |
|--------|---------------|------------|------|---------|
| C1 | WorldMapTab.tsx 运行时崩溃 P0 | P1 TS编译错误 | **成立 -- P0** | createTask返回null时L1179/1184/1186解引用必崩,无null guard |
| C2 | PLAN.md 完成率计算错误(84.6%) | 60/67=90% | **部分成立** | I系列总数和完成数均有统计错误,但影响幅度小于Challenger声称 |
| C3 | 奖励领取未与引擎集成 | 8个测试通过 | **成立 -- P1** | WorldMapTab未传递onClaimReward/claimedRewardTaskIds给SiegeTaskPanel |
| C4 | 锁超时无调用者(死代码) | checkLockTimeout已实现 | **成立 -- P1** | 全代码库搜索仅测试文件调用checkLockTimeout,无生产代码调用 |
| C5 | E2E测试跳过寻路 | 真实EventBus+MarchingSystem | **不成立 -- 降为P2** | 行军E2E聚焦MarchingSystem链路,寻路有独立测试,分层测试是合理设计 |
| C6 | Task5范围变更未声明 | Task5已完成 | **成立 -- P2** | R17计划Task5=I4,实际替换为Terrain测试,I4被标记延期但未在Manifest中声明 |
| C7 | 锁测试缺少生命周期集成 | 11个测试覆盖 | **成立 -- P2** | cancel场景和deserialize后锁恢复确实未覆盖,但属于边界场景 |
| C8 | clamp测试依赖mock EventBus | 两套测试验证一致 | **不成立** | 单元测试用mock是标准实践,E2E用真实EventBus互补,不构成问题 |
| C9 | claimReward不触发事件 | 标记奖励已领取 | **成立 -- P2** | 违反了系统内事件驱动模式,外部系统无法感知奖励领取 |
| C10 | I系列状态列判定标准不明 | 状态列正常 | **成立 -- P3** | I1/I2引擎+UI均为done但状态列仍为in-progress,判定标准不一致 |

---

## 逐项详细裁决

### C1: WorldMapTab.tsx 运行时崩溃 -- 裁决: 成立, P0

**代码证据**:

`SiegeTaskManager.createTask()` 返回类型为 `SiegeTask | null` (SiegeTaskManager.ts L96). 当目标已被锁定时返回 `null`.

`WorldMapTab.tsx` L1144-1186:
```
L1144: const task = siegeTaskManager.createTask({...});  // 可返回 null
L1179: march.siegeTaskId = task.id;                      // null.id -> TypeError
L1184: siegeTaskManager.advanceStatus(task.id, ...);      // null.id -> TypeError
L1186: siegeTaskManager.setEstimatedArrival(task.id, ...);// null.id -> TypeError
```

L1144与L1179之间**没有任何null检查**。这是一个必然的运行时崩溃路径: 当两个编队尝试攻击同一目标时,第二个createTask返回null,立即触发TypeError.

**Challenger正确**: 这是P0而非P1. Builder将其归类为"P1 TS编译错误"严重低估了影响. 这不是编译警告,而是用户可直接触发的白屏崩溃.

**建议**: 在L1144后立即添加 `if (!task) { ... early return ... }`.

---

### C2: PLAN.md 完成率计算错误 -- 裁决: 部分成立, P1

**代码证据(独立计数)**:

I系列主功能表: I1~I15 = 15项 (非PLAN.md声称的17项)
- 状态done (10项): I3, I7, I8, I9, I10, I11, I12, I13, I14, I15
- 状态in-progress (3项): I1, I2, I6
- 状态not-started (2项): I4, I5

H系列: 7项
- 实际已完成: 6项 (H1-H6) -- PLAN.md统计表声称5项,实际表格显示6项done

**统计表错误清单**:
1. I系列总数: 声称17, 实际15 (多2项)
2. I系列完成数: 声称16, 实际10 (多6项)
3. H系列完成数: 声称5, 实际6 (少1项)

**修正后计数**:

| 类别 | 总数(PLAN) | 总数(修正) | 已完成(PLAN) | 已完成(修正) |
|------|:---------:|:---------:|:-----------:|:-----------:|
| A | 6 | 6 | 6 | 6 |
| B | 7 | 7 | 7 | 7 |
| C | 2 | 2 | 2 | 2 |
| D | 13 | 13 | 13 | 13 |
| E | 6 | 6 | 6 | 6 |
| F | 3 | 3 | 1 | 1 |
| G | 6 | 6 | 4 | 4 |
| H | 7 | 7 | 5 | 6 |
| I | 17 | 15 | 16 | 10 |
| **总计** | **67** | **65** | **60** | **55** |

**修正完成率**: 55/65 = **84.6%**, 未达88%目标.

**Challenger计数基本正确**. Builder的统计表有系统性虚增问题. 这主要是I系列的"已完成"判定过于宽松 (I1/I2引擎+UI均done但仍标in-progress, 不影响done计数; 但I6引擎为partial done也计入16项完成).

**裁决**: 统计表数字不准确, 完成率低于声称值. 这需要修正.

---

### C3: 奖励领取未与引擎集成 -- 裁决: 成立, P1

**代码证据**:

1. `SiegeTaskPanel.tsx` L37: `onClaimReward?: (taskId: string) => void` 是可选prop
2. `WorldMapTab.tsx` L1644-1652: `<SiegeTaskPanel>` 使用处**未传递 onClaimReward 和 claimedRewardTaskIds props**
3. 全代码库搜索: WorldMapTab.tsx 中不存在 `claimReward` 的任何引用

**影响**: 奖励领取按钮的完整链路断开. SiegeTaskPanel测试验证了按钮callback,但生产代码中该callback从未连接到SiegeTaskManager.claimReward(). 用户看到的奖励按钮要么不显示(onClaimReward未传则无按钮), 要么点击无效果.

**Challenger正确**: 这是集成断裂. 8个测试验证的是组件单元, 但生产接线未完成.

---

### C4: 锁超时无调用者 -- 裁决: 成立, P1

**代码证据**:

全代码库搜索 `checkLockTimeout`:
- 定义: `SiegeTaskManager.ts:268`
- 调用: 仅 `SiegeTaskManager.lock.test.ts` 中4处

**零生产代码调用**. SiegeTaskManager没有update()方法, 没有定时器. 注释说"应在update循环中调用", 但没有任何代码实现这个调用.

**影响**: 锁超时机制是死代码. 如果任务卡在preparing/marching/sieging状态且从未到达completed, 锁永远不会被释放(除非页面刷新).

**Challenger正确**: 锁超时形同虚设.

---

### C5: E2E测试缺少寻路 -- 裁决: 不成立(降为P2设计建议)

**分析**:

E2E测试文件名 `march-e2e-full-chain.integration.test.ts` 描述的是"March E2E Full Chain", 聚焦于MarchingSystem的完整链路. 测试使用手工构建的路径, 绕过了PathfindingSystem.

**裁决依据**:
1. Task 2 (E1-3) 的PLAN.md描述是"行军E2E全链路测试", 聚焦行军链路而非寻路
2. PathfindingSystem (B2) 是独立子系统, 应有独立测试覆盖
3. 分层测试是合理的工程实践: 寻路层测试A*正确性, 行军层测试行军链路
4. 测试确实覆盖了真实EventBus + 真实MarchingSystem

**但**: 文件头注释声称 "create march -> pathfinding -> sprite movement -> arrival -> event trigger" 中提到了pathfinding但实际未包含, 存在文档与实现不一致.

**裁决**: 不是P1问题. 寻路集成测试属于后续Task范畴. 但文档描述应修正.

---

### C6: Task5范围变更未声明 -- 裁决: 成立, P2

**代码证据**:

PLAN.md R17计划表:
- Task 5原始定义: "I4 攻城中断处理"
- R17完成表: Task 5变为 "Terrain non-transition zero-redraw断言测试"

I4在PLAN.md的"R16未完成(移交R17)"表中标记为 "延期", Builder Manifest未将其作为未完成项报告.

**裁决**: 范围变更是合理的(I4是P1且有依赖), 但应在Manifest中明确声明"I4延期, Task5替换为Terrain测试". 不声明的做法降低了透明度.

---

### C7: 锁测试缺少生命周期集成 -- 裁决: 成立, P2

**分析**:

11个锁测试覆盖了锁的CRUD操作, 但缺少:
1. cancel场景的锁释放 (当前无cancel方法, 但属于未来风险)
2. deserialize清空siegeLocks后, 已恢复的active任务锁不会恢复
3. removeCompletedTasks的锁一致性

**裁决**: 这些是合理的测试增强建议. 当前cancel功能未实现, 测试无法覆盖不存在的方法. deserialize场景确实是一个应覆盖的边界. 降为P2合理.

---

### C8: clamp测试依赖mock EventBus -- 裁决: 不成立

**分析**:

MarchingSystem.test.ts 使用 mock EventBus 验证事件payload是标准的单元测试实践. E2E测试使用真实 EventBus. 两套测试互补:
- 单元测试: 精确验证payload内容 (通过mock.calls)
- E2E测试: 验证真实事件传播链路

**裁决**: 这是合理的测试分层, 不构成问题.

---

### C9: claimReward不触发事件 -- 裁决: 成立, P2

**代码证据**:

`SiegeTaskManager.claimReward()` (L336-346):
```typescript
claimReward(taskId: string): boolean {
  // ... validation ...
  this.claimedRewards.add(taskId);
  return true;
}
```

没有 `this.deps.eventBus.emit()` 调用. 对比 `createTask()` 和 `advanceStatus()` 都会emit事件.

**影响**: 外部系统(资源管理、成就等)无法通过事件感知奖励领取.

**裁决**: 这是设计缺陷, 违反系统内的事件驱动模式. 但由于奖励领取的整体接线(C3)还未完成, 当前影响有限. P2合理.

---

### C10: I系列状态列判定标准不明 -- 裁决: 成立, P3

**代码证据**:

PLAN.md I系列:
- I1: 状态=🔄, 引擎=done, UI=done
- I2: 状态=🔄, 引擎=done, UI=done

引擎和UI均标记done但总体状态仍为in-progress. 缺乏明确的"完成"定义.

**裁决**: 这是PLAN.md的标记一致性问题, 不影响功能, 但影响完成率计算的可信度. P3合理.

---

## 最终问题清单

| ID | 严重度 | 可复现 | 根因 | 建议 |
|----|:------:|:------:|------|------|
| C1 | **P0** | 是 | createTask返回null时无null guard, 导致运行时TypeError | 在WorldMapTab.tsx L1144后添加 `if (!task) return;` 并添加toast提示 |
| C2 | **P1** | 是 | PLAN.md统计表I系列虚增2项总数和6项完成数; H系列少计1项 | 修正统计表: 55/65=84.6%; 重新审计所有系列计数 |
| C3 | **P1** | 是 | WorldMapTab未传递onClaimReward给SiegeTaskPanel, 奖励领取链路断开 | 在WorldMapTab中连接onClaimReward->siegeTaskManager.claimReward(); 添加集成测试 |
| C4 | **P1** | 是 | checkLockTimeout无生产调用者, 锁超时为死代码 | 在游戏主循环或setInterval中调用checkLockTimeout; 或在acquireSiegeLock中内联超时检查 |
| C5 | P2 | N/A | E2E测试文档声称包含pathfinding但实际未集成 | 修正测试文件头注释; 后续添加PathfindingSystem集成测试 |
| C6 | P2 | 是 | Task5原始范围(I4)被替换为Terrain测试, 未声明 | 在Manifest中明确声明范围变更和I4延期原因 |
| C7 | P2 | 部分 | 锁测试未覆盖deserialize/极端场景 | 添加deserialize后锁一致性测试 |
| C8 | 驳回 | N/A | mock EventBus是标准单元测试实践 | 无需修改 |
| C9 | P2 | 是 | claimReward不emit事件, 违反事件驱动模式 | 添加 `siegeTask:rewardClaimed` 事件 |
| C10 | P3 | 是 | I系列状态列与引擎/UI列不一致 | 统一状态判定标准, 或增加判定标准说明 |

---

## 裁决统计

| 严重度 | 数量 | 问题ID |
|:------:|:----:|--------|
| **P0** | 1 | C1 |
| **P1** | 3 | C2, C3, C4 |
| **P2** | 4 | C5, C6, C7, C9 |
| **P3** | 1 | C10 |
| 驳回 | 1 | C8 |

---

## 对Builder结论的修正

| Builder结论 | Judge修正 |
|------------|----------|
| 5/5任务已完成 | 4/5有效完成; Task4存在集成断裂(C3); Task5范围变更未声明(C6) |
| 160/160测试通过 | 测试通过数无误, 但覆盖有效性存疑(C3/C4) |
| 60/67=90%完成率 | 实际55/65=84.6%, 未达88%目标(C2) |
| 1个P1问题 | 实际1个P0 + 3个P1 + 4个P2 + 1个P3 |

---

*Judge Ruling -- Round 17 | 2026-05-04*
