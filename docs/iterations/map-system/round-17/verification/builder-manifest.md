# Builder Manifest -- Round 17 客观事实清单

> **审核日期**: 2026-05-04
> **审核者**: Builder (客观审核者)
> **审核范围**: Round 17 全部 5 个 Task

---

## 总览

| 计划任务ID | 完成状态 | 实现位置 | 测试文件 | 测试结果 | 测试有效性 | 覆盖场景 |
|------------|---------|---------|---------|---------|-----------|---------|
| Task 1 (P1) | **已完成** | `src/games/three-kingdoms/engine/map/MarchingSystem.ts` (L243-247, L384-386) — clamp 逻辑在 `createMarch` 和 `generatePreview` 中 | `src/games/three-kingdoms/engine/map/__tests__/MarchingSystem.test.ts` (L546-709) | 53/53 通过 | **有效** — 10 个 clamp 测试覆盖短距离/长距离/正常范围/边界值/多段路径 | 短距离 clamp 10s (createMarch + generatePreview), 长距离 clamp 60s (createMarch + generatePreview), 正常范围不变, 边界值 10s/60s 不变, 多段路径总距离低于 clamp |
| Task 2 (P1) | **已完成** | 无新实现代码，纯测试任务 | `src/games/three-kingdoms/engine/map/__tests__/integration/march-e2e-full-chain.integration.test.ts` | 17/17 通过 | **有效** — 使用真实 EventBus + 真实 MarchingSystem, 无 mock | 正常行军全链路 (create->start->arrive), 事件链顺序验证, 短距离 clamp 验证, 长距离 clamp 验证, 多路并发行军, 行军取消 (mid-way cancel + 不触发 arrived + siegeTaskId 传播 + 其他行军不受影响), 通配符事件订阅, siegeTaskId 全链路保留, EventBus once() 行为 |
| Task 3 (P0) | **已完成** | `src/games/three-kingdoms/engine/map/SiegeTaskManager.ts` (L60-61, L69-70, L96-101, L165-169, L242-275, L284-346) | `src/games/three-kingdoms/engine/map/__tests__/SiegeTaskManager.lock.test.ts` | 11/11 通过 | **有效** — 11 个测试覆盖锁定获取/争用/释放/超时/并发 | 锁获取 (首次/多目标), 锁争用 (同目标二次拒绝/任务阶段中拒绝), 锁完成释放 (completed 时释放/释放后可再次攻城), 锁超时 (5 分钟超时/超时后可再次攻城/仅释放过期锁), 并发攻城 (5 个不同目标并发/独立释放) |
| Task 4 (P0) | **已完成** | `src/components/idle/panels/map/SiegeTaskPanel.tsx` (L36-39, L457-492) + `src/games/three-kingdoms/engine/map/SiegeTaskManager.ts` (L284-346) + `src/games/three-kingdoms/core/map/siege-task.types.ts` (L129-152) | `src/components/idle/panels/map/__tests__/SiegeTaskPanel.test.tsx` (L854-1121) | 67/67 通过 | **有效** — 8 个 R17-I10 测试覆盖面板渲染/状态流转/奖励领取 | 面板渲染 (活跃任务实时状态), 状态标签 (marching/sieging/completed), 状态流转 (marching->sieging->completed), 奖励领取按钮回调, 失败任务无领取按钮, 已领取显示"已领取"标签, 无 onClaimReward 时无按钮, 胜利/失败结果显示 |
| Task 5 (P3) | **已完成** | A 部分: `src/components/idle/panels/map/__tests__/PixelWorldMap.terrain-persist.test.tsx` (L636-723). B 部分: `docs/iterations/map-system/PLAN.md` | `src/components/idle/panels/map/__tests__/PixelWorldMap.terrain-persist.test.tsx` | 12/12 通过 | **有效** — 2 个新测试断言非 transition 帧 fillRect 调用严格少于 transition 帧 | sprites dirty 持续 true 时零重绘断言 (4 帧), effects dirty 持续 true 时零重绘断言 (4 帧). PLAN.md 完成率 60/67 = 90% |

---

## 详细验证记录

### Task 1: 行军精灵持续时间 clamp(10s~60s) 代码验证 + 测试

**实现验证**:
- `MarchingSystem.ts` L243-247: `createMarch()` 中使用 `Math.max(MIN_MARCH_DURATION_MS, Math.min(MAX_MARCH_DURATION_MS, rawEstimatedTime))` 实现 clamp
- `MarchingSystem.ts` L384-386: `generatePreview()` 中使用相同 clamp 逻辑
- `MIN_MARCH_DURATION_MS = 10_000` (L143), `MAX_MARCH_DURATION_MS = 60_000` (L146) — 作为导出常量定义
- clamp 逻辑在 `createMarch` 和 `generatePreview` 两处一致应用

**测试验证**: 10 个测试在 `March duration clamp constraints` describe block 中
- 短距离 (150px): raw=5000ms -> clamp 到 10s, event payload 验证
- 短距离 (50px): generatePreview clamp 到 10s
- 长距离 (3000px): raw=100000ms -> clamp 到 60s, event payload 验证
- 长距离 (5000px): generatePreview clamp 到 60s
- 正常范围 (600px=20s): 不变, event payload 验证
- 正常范围 (900px=30s): generatePreview 不变
- 边界值 (300px=10s): 不变
- 边界值 (1800px=60s): 不变
- generatePreview 边界值验证
- 多段路径 (150px 总距离): clamp 到 10s

**测试运行结果**: 53/53 通过 (包含原有 43 个 + 新增 10 个)

### Task 2: E1-3 行军 E2E 全链路测试

**测试验证**: 17 个测试, 使用真实 EventBus + 真实 MarchingSystem
- 正常行军全链路: create -> start -> update -> arrive -> event trigger (含完整 payload 验证)
- 事件链顺序: created -> started -> arrived
- 短距离 clamp: 150px 和 1px 都 clamp 到 10s
- 长距离 clamp: 3000px 和 50000px 都 clamp 到 60s
- 多路并发: 3 路独立行军各自到达, 位置不互相干扰
- 行军取消: mid-way cancel + cancelled 不触发 arrived + siegeTaskId 传播 + 其他行军不受影响
- 通配符: march:* 事件顺序验证
- siegeTaskId 全链路保留: creation -> arrived event 包含 siegeTaskId
- EventBus once(): 只触发一次

**测试运行结果**: 17/17 通过

### Task 3: I3 攻城锁定机制

**实现验证**:
- `SIEGE_LOCK_TIMEOUT_MS = 5 * 60 * 1000` (5 分钟超时)
- `siegeLocks: Map<string, { taskId: string; lockedAt: number }>` — 锁状态存储
- `acquireSiegeLock(targetId, taskId)`: 已锁返回 false
- `releaseSiegeLock(targetId)`: 删除锁
- `isSiegeLocked(targetId)`: 查询锁状态
- `checkLockTimeout()`: 遍历释放超时锁
- `createTask()` 返回类型改为 `SiegeTask | null`, 先获取锁再创建任务
- `advanceStatus()` 在 status='completed' 时自动释放锁
- `removeCompletedTasks()` 清理时释放锁
- `deserialize()` 清空 siegeLocks

**测试验证**: 11 个测试
- 锁获取 (2 tests): 首次获取成功, 多目标独立获取
- 锁争用 (2 tests): 同目标二次拒绝, 任务阶段中拒绝
- 锁完成释放 (2 tests): completed 时释放, 释放后可再次攻城
- 锁超时 (3 tests): 5 分钟超时自动释放, 超时后可再攻城, 仅释放过期锁
- 并发攻城 (2 tests): 5 个目标并发, 独立释放

**测试运行结果**: 11/11 通过

### Task 4: I10 攻占任务面板

**实现验证**:
- `SiegeTaskSummary` 接口: 新增于 `siege-task.types.ts` L129-152
- `SiegeTaskManager.getTaskSummary()`: L284-329, 返回进度/结果/奖励
- `SiegeTaskManager.claimReward()`: L336-346, 标记奖励已领取
- `SiegeTaskPanel.tsx` 新增 props: `onClaimReward`, `claimedRewardTaskIds`
- 已完成胜利任务显示"领取奖励"按钮 (L458-481)
- 已领取显示"奖励已领取"标签 (L484-492)
- 失败任务无领取按钮
- `stopPropagation` 防止冒泡

**测试验证**: 8 个 R17-I10 测试
- 面板渲染活跃任务实时状态
- 状态标签正确 (marching/sieging/completed)
- 状态流转 (marching->sieging->completed(victory))
- 奖励领取按钮回调触发
- 失败任务无领取按钮
- 已领取显示标签而非按钮
- 无 onClaimReward prop 时向后兼容
- 胜利/失败结果显示

**测试运行结果**: 67/67 通过 (包含原有 59 个 + 新增 8 个)

### Task 5: Terrain 测试补充 + PLAN.md 更新

**A 部分: Terrain 非过渡零重绘断言**
- 2 个新测试在 `Non-transition zero-redraw assertions` describe block
- sprites dirty 持续 true: 非 transition 帧 fillRect 严格少于 transition 帧 (4 帧验证)
- effects dirty 持续 true: 非 transition 帧 fillRect 严格少于 transition 帧 (4 帧验证)

**B 部分: PLAN.md 更新**
- I3: -> done (攻城锁定机制)
- I10: -> done (攻占任务面板)
- I11: -> done (行军精灵持续时间约束)
- E1-3: -> done (行军E2E全链路测试)
- R17 迭代行: -> done
- 完成率: 56/65 (86%) -> 60/67 (90%), 达标 (目标 >= 88%)

**测试运行结果**: 12/12 通过 (包含原有 10 个 + 新增 2 个)

---

## TypeScript 检查

```
npx tsc --noEmit: 18 errors
```

**R17 新增错误 (3 个)**:
- `WorldMapTab.tsx:1179` — `task` 可能为 null (因 createTask 返回类型变为 SiegeTask | null)
- `WorldMapTab.tsx:1184` — `task` 可能为 null
- `WorldMapTab.tsx:1186` — `task` 可能为 null

**预存在错误 (15 个)**: ThreeKingdomsGame.tsx (4), AutoUpgradeSystem.ts (5), engine-save.ts (1), PathfindingSystem.ts (5)

**评估**: 3 个新增 TS 错误源于 Task 3 将 `createTask` 返回类型从 `SiegeTask` 改为 `SiegeTask | null`, 但调用方 `WorldMapTab.tsx` 未添加 null check. 这是一个需要修复的 P1 回归.

---

## 测试汇总

| 测试套件 | 测试数 | 通过 | 失败 |
|---------|--------|------|------|
| MarchingSystem.test.ts | 53 | 53 | 0 |
| march-e2e-full-chain.integration.test.ts | 17 | 17 | 0 |
| SiegeTaskManager.lock.test.ts | 11 | 11 | 0 |
| SiegeTaskPanel.test.tsx | 67 | 67 | 0 |
| PixelWorldMap.terrain-persist.test.tsx | 12 | 12 | 0 |
| **总计** | **160** | **160** | **0** |

---

## 结论

- **5/5 任务已完成** (代码实现 + 测试)
- **新增测试数**: 48 个 (10 + 17 + 11 + 8 + 2), 超过计划目标 (>= 12)
- **PLAN.md 完成率**: 90% (60/67), 超过目标 (>= 88%)
- **P1 问题**: 1 个 — WorldMapTab.tsx 中 3 处 `task` 可能为 null 的 TypeScript 错误, 源于 Task 3 的 `createTask` 返回类型变更, 需要在调用处添加 null check

---

*Builder Manifest -- Round 17 | 2026-05-04*
