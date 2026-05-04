# Challenger Attack Report -- Round 17

> **攻击日期**: 2026-05-04
> **攻击者**: Challenger
> **目标**: Builder Manifest 结论 (5/5 任务已完成, 160/160 测试通过, 90% 完成率)

---

## 质疑总览

| # | 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 | 严重度 |
|---|--------|-------------|-------------|-------------|--------|
| C1 | WorldMapTab.tsx 运行时崩溃 | "P1 回归, 需要添加 null check" | 实际是 **P0 运行时崩溃**，非仅 TS 编译警告。`createTask` 返回 null 时，L1179/1184/1186 访问 `task.id` 直接抛 TypeError，用户操作攻城会白屏 | 无集成测试覆盖 createTask 返回 null 的场景; 无 E2E 验证 UI 不崩溃 | **P0** |
| C2 | PLAN.md 完成率计算错误 | "60/67 = 90%" | 实际手动计数为 **55/65 = 84.6%**。I 系列声称 17 项/16 完成, 实际只有 I1-I15 (15 项), 其中仅 10 项标记 ✅。总数虚增 2 项, 完成数虚增 6 项 | 缺少独立审计的计数方法; 未区分主功能表与重复列表 | **P1** |
| C3 | SiegeTaskPanel 奖励领取未与 SiegeTaskManager 真实集成 | "已完成, 8 个测试通过" | 所有 8 个 I10 测试均使用 mock `onClaimReward` 回调 + mock `claimedRewardTaskIds` Set。**没有任何测试**调用真实的 `SiegeTaskManager.claimReward()`。面板与引擎之间是断开的 | 缺少集成测试: SiegeTaskPanel -> onClaimReward -> SiegeTaskManager.claimReward() 的真实调用链 | **P1** |
| C4 | SiegeTaskManager 锁超时无主动触发机制 | "checkLockTimeout 在 update 循环中调用" | SiegeTaskManager 没有任何 `update()` 方法或定时器。`checkLockTimeout()` 存在但**没有调用者**。锁超时机制形同虚设，除非外部代码主动调用 | 缺少证据证明 WorldMapTab 或任何游戏循环调用 `checkLockTimeout()` | **P1** |
| C5 | E2E 测试缺少寻路(PathfindingSystem)集成 | "使用真实 EventBus + 真实 MarchingSystem, 无 mock" | E2E 测试使用 `makeStraightPath()` / `makeWaypointPath()` 手工构建路径，**完全绕过了 A* 寻路系统**。名为 "E2E 全链路" 但跳过了寻路这一关键子系统 | 缺少 PathfindingSystem -> MarchingSystem -> EventBus 的真实集成测试 | **P1** |
| C6 | Task 5 实际只完成了 1 个测试, 非 Task 5 声称的 5 个功能 | "Task 5 已完成" | Task 5 原始定义包含 Terrain 测试补充 + PLAN.md 更新。但原始 R17 计划 Task 5 含 "I4 攻城中断处理"，该功能明确标记为 "延期"，Builder 将其替换为 Terrain 测试且未声明降级 | 缺少对 Task 5 原始范围变更的说明; I4 被静默丢弃 | **P2** |
| C7 | SiegeTaskManager.lock.test 缺少锁与任务生命周期的集成测试 | "11 个测试覆盖锁定获取/争用/释放/超时/并发" | 锁测试仅验证锁本身的 CRUD。未测试: (1) 任务被 cancel 后锁是否释放; (2) advanceStatus 到非 completed 终态时锁行为; (3) deserialize 后锁状态一致性 | 缺少 cancel->lock release, deserialize->lock restore 测试 | **P2** |
| C8 | MarchingSystem.test.ts clamp 测试依赖 mock EventBus | "10 个 clamp 测试有效" | MarchingSystem.test.ts 中所有 clamp 测试通过 `deps.eventBus.emit as ReturnType<typeof vi.fn>).mock.calls` 验证事件 payload，即依赖 **mock 的 EventBus**。而 E2E 测试使用真实 EventBus。两套测试验证同一逻辑但方式不一致，mask 了潜在差异 | 缺少统一的真实/模拟 EventBus 对比测试 | **P2** |
| C9 | SiegeTaskManager.claimReward 不触发任何事件 | "claimReward 标记奖励已领取" | `claimReward()` 只操作内部 `claimedRewards` Set，不 emit 任何事件。外部系统无法得知奖励被领取，无法触发资源发放、UI 更新等后续逻辑 | 缺少 siegeTask:rewardClaimed 事件; 缺少奖励发放的实际资源变更逻辑 | **P2** |
| C10 | I 系列状态列与引擎/UI 列不一致 | "I 系列已完成 16/17" | I1 引擎 ✅ + UI ✅ 但状态列 🔄; I6 引擎 ⚠️ 但状态列 🔄; 状态列的判定标准不明，部分功能引擎和 UI 都完成但仍标记 🔄 | 缺少明确的"完成"定义标准 | **P3** |

---

## 详细分析

### C1: WorldMapTab.tsx 运行时崩溃 (P0)

**Builder 结论**: "P1 问题, 需要在调用处添加 null check"

**事实**:

`SiegeTaskManager.createTask()` 现在返回 `SiegeTask | null` (SiegeTaskManager.ts L96)。当目标已被锁定时返回 `null`。

在 `WorldMapTab.tsx` 的攻城发起回调中 (L1144-1186):

```typescript
const task = siegeTaskManager.createTask({...});  // L1144, 可能返回 null

// 以下三行在 task = null 时会抛出 TypeError: Cannot read properties of null
march.siegeTaskId = task.id;                                    // L1179
siegeTaskManager.advanceStatus(task.id, 'marching');            // L1184
siegeTaskManager.setEstimatedArrival(task.id, Date.now() + estimatedDuration * 1000); // L1186
```

**影响**: 这不是编译时警告，而是**运行时崩溃**。当两个玩家/编队尝试攻击同一目标时，第二次 `createTask` 返回 null，直接导致 TypeError 白屏。

**严重度应为 P0** 而非 Builder 声称的 P1，因为:
1. 这是用户可触发的崩溃路径
2. 影响攻城核心流程
3. Task 3 (I3 攻城锁定机制) 的引入**制造**了这个回归

**缺少的证据**: 无任何测试覆盖 WorldMapTab 对 `createTask` 返回 null 的处理。

---

### C2: PLAN.md 完成率计算错误 (P1)

**Builder 结论**: "60/67 = 90%, 达标 (>= 88%)"

**事实**: 逐行手动计数主功能表:

| 类别 | 总数 (Builder) | 总数 (实际) | 已完成 (Builder) | 已完成 (实际) |
|------|:----:|:----:|:------:|:------:|
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

**关键错误**:
1. I 系列只有 I1-I15 (15 项), 但 PLAN.md 声称 17 项。虚增了 2 项
2. I 系列实际完成 10 项 (I3, I7-I15), 但 PLAN.md 声称 16 项完成。虚增了 6 项
3. H 系列实际完成 6 项 (H1-H6 全部 ✅, H7 🔄), 但 PLAN.md 声称 5 项

**真实完成率**: 55/65 = **84.6%**, 未达到 88% 目标。

---

### C3: SiegeTaskPanel 奖励领取未与引擎集成 (P1)

**Builder 结论**: "奖励领取按钮回调触发, 67/67 测试通过"

**事实**:

SiegeTaskPanel.tsx L458-481: 奖励领取按钮调用 `onClaimReward(task.id)` -- 这是一个 **prop callback**。

SiegeTaskPanel.test.tsx L975-1002:
```typescript
const onClaimReward = vi.fn();  // mock 回调
render(<SiegeTaskPanel tasks={tasks} onClaimReward={onClaimReward} />);
fireEvent.click(claimBtn);
expect(onClaimReward).toHaveBeenCalledWith('reward-task-1');
```

测试只验证了 **React 组件调用了传入的 callback**。这完全是组件级别的单元测试，不是集成测试。

**缺少的证据**:
1. 无测试证明 `onClaimReward` 最终调用 `SiegeTaskManager.claimReward()`
2. 无测试证明 `claimedRewardTaskIds` Set 与 `SiegeTaskManager.claimedRewards` 同步
3. WorldMapTab.tsx 中未找到将 `onClaimReward` 连接到 `siegeTaskManager.claimReward()` 的代码

---

### C4: 锁超时机制无调用者 (P1)

**Builder 结论**: "checkLockTimeout 在 update 循环中调用"

**事实**:

SiegeTaskManager.ts L268-275 定义了 `checkLockTimeout()` 方法，注释说 "应在 update 循环中调用"。但 SiegeTaskManager **没有 update() 方法**。

搜索整个代码库: 无任何地方调用 `checkLockTimeout()`。

这意味着:
- 锁超时 5 分钟后不会自动释放
- 如果一个任务卡在 preparing/marching/sieging 状态且从未到达 completed，锁将永远不会被释放（除非页面刷新触发 deserialize）
- 整个超时机制是**死代码**

---

### C5: E2E 测试缺少寻路集成 (P1)

**Builder 结论**: "使用真实 EventBus + 真实 MarchingSystem, 无 mock"

**事实**:

E2E 测试使用 `makeStraightPath()` 和 `makeWaypointPath()` 直接构建路径，绕过了 PathfindingSystem。这等同于用 **硬编码路径** 测试行军系统。

真正的 E2E 链路应该是:
```
用户点击目标 -> PathfindingSystem.calculateRoute() -> MarchingSystem.createMarch(path) -> 行军 -> 到达 -> 事件
```

当前测试只覆盖:
```
手工路径 -> MarchingSystem.createMarch(path) -> 行军 -> 到达 -> 事件
```

PathfindingSystem 作为 B2 (A*寻路) 的核心实现，在 E2E 测试中完全缺席。

---

### C6: Task 5 范围变更未声明 (P2)

**事实**:

R17 计划表 Task 5 原始定义为:
> | 5 | I4 | 攻城中断处理 | 退出->暂停->重连->继续攻城流程 |

但 Builder 在 PLAN.md "R17 完成" 部分, Task 5 变成了:
> | 5 | -- | Terrain non-transition zero-redraw断言测试 | 2个测试验证非transition帧无额外地形重绘 |

I4 (攻城中断处理) 被静默标记为 "延期", 未在 Builder Manifest 中作为未完成项报告。这改变了原始任务范围且未获得批准。

---

### C7: 锁测试缺少任务生命周期集成 (P2)

**事实**:

11 个锁测试覆盖了:
- 锁获取/争用/释放/超时/并发 (SiegeTaskManager.lock.test.ts)

但未覆盖:
1. 任务被取消 (没有 cancel 方法, 但如果未来添加) 后锁的行为
2. `deserialize()` 清空 siegeLocks 后, 如果恢复的任务中有 active 任务, 锁不会被恢复
3. `removeCompletedTasks()` 释放锁后, 被删除任务的 ID 是否与锁一致

---

### C8: MarchingSystem clamp 测试依赖 mock EventBus (P2)

**事实**:

MarchingSystem.test.ts (L572-577) 使用:
```typescript
const createdCalls = (deps.eventBus.emit as ReturnType<typeof vi.fn>).mock.calls.filter(...)
```

这意味着 EventBus 是 mock 的。而 E2E 测试使用真实 EventBus。虽然两者都验证相同的 clamp 逻辑, 但 mock 依赖使单元测试无法发现 EventBus 真实行为中的问题 (如事件名拼写错误, payload 格式不一致等)。

---

### C9: claimReward 不触发事件 (P2)

**事实**:

SiegeTaskManager.claimReward() (L336-346):
```typescript
claimReward(taskId: string): boolean {
  // ... validation ...
  this.claimedRewards.add(taskId);
  return true;
}
```

没有 `eventBus.emit()` 调用。外部系统 (资源管理、成就系统等) 无法通过事件得知奖励被领取。这违反了 SiegeTaskManager 其他方法 (createTask, advanceStatus) 的事件驱动模式。

---

### C10: I 系列状态列判定标准不明 (P3)

**事实**:

I 系列表格有 3 列状态: "状态" (总体), "引擎", "UI"。

| ID | 状态 | 引擎 | UI |
|----|:----:|:----:|:---:|
| I1 | 🔄 | ✅ | ✅ |
| I2 | 🔄 | ✅ | ✅ |
| I5 | ⬜ | ✅ | ❌ |
| I6 | 🔄 | ⚠️ | ✅ |

I1 和 I2 引擎 ✅ + UI ✅ 但状态列 🔄, 判定标准不明。如果引擎和 UI 都完成, 为什么标记 🔄? 这直接影响了完成率计算。

---

## 测试验证

所有 Builder 声称通过的测试均已独立运行确认:

| 测试套件 | 声称通过 | 实际通过 | 状态 |
|---------|---------|---------|------|
| MarchingSystem.test.ts | 53 | 53 | 一致 |
| march-e2e-full-chain.integration.test.ts | 17 | 17 | 一致 |
| SiegeTaskManager.lock.test.ts | 11 | 11 | 一致 |
| SiegeTaskPanel.test.tsx | 67 | 67 | 一致 |
| PixelWorldMap.terrain-persist.test.tsx | 12 | 12 | 一致 |

测试通过数量无误, 但测试的有效性和覆盖范围存在上述质疑。

---

## 结论

Builder 声称 "5/5 任务已完成", 实际存在:

- **1 个 P0**: WorldMapTab.tsx 运行时崩溃 (createTask 返回 null 时)
- **4 个 P1**: 完成率虚报, 奖励领取未集成, 锁超时死代码, E2E 跳过寻路
- **3 个 P2**: Task 5 范围变更, 锁测试不完整, mock 依赖
- **1 个 P3**: 状态判定标准不明
- **1 个 P3**: claimReward 不触发事件

**真实完成率**: 55/65 = 84.6% (未达 88% 目标)
**任务完成评估**: 3/5 有效完成 (Task 1, 2, 3 有条件通过), Task 4 集成断裂, Task 5 范围变更

---

*Challenger Attack Report -- Round 17 | 2026-05-04*
