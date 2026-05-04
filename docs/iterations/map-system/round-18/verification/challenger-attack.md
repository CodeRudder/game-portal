# Challenger Attack Report: Round 18

**Date**: 2026-05-04
**Attacker**: Challenger (adversarial)
**Target**: Builder Manifest for Round 18

---

## Summary of Findings

| Severity | Count | Description |
|:--------:|:-----:|-------------|
| **P0** | 3 | Critical: features claimed as "implemented" are engine-only with zero UI integration; TypeScript build errors in SiegeTaskPanel |
| **P1** | 4 | Major: no E2E tests for interrupt flow; defense recovery never visually rendered; PLAN.md not updated despite claiming it was; Task 3 is a no-op |
| **P2** | 2 | Minor: cancelSiege uses wrong faction in return march; mock-only tests create false confidence |

---

## Detailed Challenges

### C1 [P0]: pause/resume/cancel 有零UI接线 -- Task 1核心功能形同虚设

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 |
|--------|-------------|-------------|-------------|
| Task 1 I4 "PASS" -- 攻城中断处理 | `SiegeTaskManager` 中 `pauseSiege()`, `resumeSiege()`, `cancelSiege()` 实现完毕，26/26测试通过 | 搜索全部非测试生产代码：`pauseSiege`, `resumeSiege`, `cancelSiege` 仅出现在 `SiegeTaskManager.ts` 引擎文件中。`WorldMapTab.tsx` (1682行) 不包含任何对这三个方法的调用。`SiegeTaskPanel.tsx` 不包含 "paused" 或 "pause" 的任何引用。**没有任何UI按钮、事件监听器、或代码路径能触发暂停/恢复/取消操作** | (1) `WorldMapTab` 或 `SiegeTaskPanel` 中调用 `pauseSiege/resumeSiege/cancelSiege` 的代码; (2) 用户触发暂停的UI交互(按钮/快捷键/右键菜单); (3) `siegeTask:paused/resumed/cancelled` 事件被任何组件监听的证据 |

**证据**: 在整个 `src/` 目录中搜索 `pauseSiege|resumeSiege|cancelSiege` (排除 `__tests__` 和 `SiegeTaskManager.ts`)，结果为空。`WorldMapTab.tsx` 的 `handleArrived` 回调 (line 487-753) 是攻城流程的核心集成点，但它完全没有处理 `paused` 状态的任务。

---

### C2 [P0]: SiegeTaskPanel.tsx 无法渲染 paused 状态 -- 3个TS编译错误

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 |
|--------|-------------|-------------|-------------|
| Builder承认 "CAVEAT" 但仍判定 PASS | "3 TS errors, paused status not added to UI status maps" | (1) `STATUS_LABELS` (line 49) 缺少 `paused` key -- TS2741; (2) `STATUS_COLORS` (line 59) 缺少 `paused` key -- TS2741; (3) `getStatusIcon` (line 105) switch 缺少 `paused` return -- TS2366。`ExtendedStatus = SiegeTaskStatus | 'failed'`，`SiegeTaskStatus` 包含 `'paused'`，但三个映射对象都没有覆盖 `paused`。这意味着如果引擎将任务设为 `paused` 状态，UI 将崩溃或显示空白/undefined | 修复这3个TS错误的提交 |

**运行时影响**: 如果 `activeTasks` 中包含 `status === 'paused'` 的任务: `STATUS_LABELS[displayStatus]` 将返回 `undefined` (显示空白文本); `STATUS_COLORS[displayStatus]` 将返回 `undefined` (CSS color 为空); `getStatusIcon(displayStatus)` 将因缺少 return 语句导致 `undefined`。这些不是编译时警告，是**功能性故障**。

---

### C3 [P0]: SiegeTaskPanel 进度条对 paused 任务显示 0%

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 |
|--------|-------------|-------------|-------------|
| Task 1 PASS -- 暂停任务正确展示 | "26/26 tests pass", 引擎逻辑正确 | `getProgressPercent()` (line 151-183) 的 switch 语句没有 `case 'paused'` 分支。`paused` 状态落入 `default: return 0`。一个暂停在 defenseRatio=0.42 的攻城任务，其进度条将显示 **0%** 而非基于快照的正确进度。同时，进度条根本不渲染给 paused 状态的任务，因为条件 (line 339) 只检查 `marching/sieging/returning/settling`，不包含 `paused` | `getProgressPercent` 或 `activeTasks` 过滤逻辑中对 `paused` 状态的处理 |

---

### C4 [P1]: I5 defense recovery 在 PixelWorldMap 中不可见

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 |
|--------|-------------|-------------|-------------|
| Task 2 PASS -- "Engine-side implementation complete. UI rendering of defense bar was pre-existing (42 tests)" | `defenseRecoveryRate` 在 `SiegeBattleAnimationSystem.update()` 中自动恢复城防; 19个测试通过 | 防御恢复仅发生在 `completed` 阶段且 `victory === false` 的动画上。但 `PixelWorldMap.tsx` 的 `renderCompletedPhase` (line 774-830) **不渲染防御条** -- 它只渲染胜利旗帜或失败灰色效果。因此，即使 `anim.defenseRatio` 在引擎中从 0.3 恢复到 1.0，用户也看不到任何视觉变化，因为完成阶段的渲染完全忽略了 `defenseRatio` | `PixelWorldMap` 中 `completed` 阶段渲染防御恢复进度的证据 |

**证据**: `renderCompletedPhase` 代码 (line 774-830) 只处理 `isVictory` (金色旗帜) 和 `!isVictory` (灰色烟雾效果)，没有使用 `anim.defenseRatio` 绘制任何防御条。

---

### C5 [P1]: 攻城中断 -> 重连 -> 继续的完整链路没有E2E测试

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 |
|--------|-------------|-------------|-------------|
| "All 4 tasks completed with 58 tests passing" | 58/58 全部通过，核心引擎实现稳固 | 所有26个中断测试都是对 `SiegeTaskManager` 的**单元测试**，使用 mock eventBus 和 mock MarchingSystem。没有集成测试验证: (1) WorldMapTab 中的攻城流程是否支持暂停; (2) `cancelSiege` 是否与真实的 `MarchingSystem.createReturnMarch` 正确集成; (3) 暂停后的序列化/反序列化是否在 `WorldMapTab` 生命周期中正确恢复; (4) UI 是否能正确显示 `paused` 状态的任务 | 跨越 `WorldMapTab` -> `SiegeTaskManager` -> `MarchingSystem` 的集成/E2E测试 |

---

### C6 [P1]: Task 3 G5 "Already fully wired" = R18 实际未做任何代码修改

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 |
|--------|-------------|-------------|-------------|
| Task 3 PASS -- G5 integration verified | "G5 is already fully wired... confirmation-only task" | Builder声称 Task 3 完成 G5 编队确认弹窗集成 + 状态修复，但 **没有产生任何代码变更**。Task 3 results 文件明确说 "No code changes were made that would affect test results"。这意味着 R18 Task 3 是一个纯文档/验证任务，不应被计为 "completed task"。同时 I4/I5 被标记为 "still ⬜" 但 Builder 仍然声称 13/15 I-series completed | Task 3 产生的代码变更(git diff) |

**矛盾**: Task 3 results 说 I-series 是 "12/15 completed" (I4=延期, I5=延期)，但 Builder Manifest 的 Task 1 和 Task 2 分别声称 I4 和 I5 PASS。同一个 Round 内的文档自相矛盾。

---

### C7 [P1]: PLAN.md 未更新 -- Builder自己承认但声称 Task 4 Part C 已完成

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 |
|--------|-------------|-------------|-------------|
| Task 4 Part C PASS -- "Statistics verified at 93.8%" | Task 4 Part C 完成 PLAN.md 统计重算 | `PLAN.md` 中 I4 和 I5 仍然标记为 `⬜` (line 145-146: `I4 = 攻城中断处理...⬜`, `I5 = 城防衰减显示...⬜`)。Task 4 results 声称 "61/65 = 93.8%" 但如果 I4/I5 引擎代码已完成 (Task 1/2 PASS)，则应为 63/65 = 96.9%。Builder 自相矛盾: Task 4 说 "Remaining incomplete: I4, I5" 但 Task 1/2 说它们 PASS | PLAN.md 中 I4/I5 状态标记从 `⬜` 更新为 `✅` 的证据 |

---

### C8 [P1]: cancelSiege 使用错误的 faction 'neutral' 创建返回行军

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 |
|--------|-------------|-------------|-------------|
| Task 1 PASS -- cancelSiege 正确创建回城行军 | `cancelSiege` 方法通过 `marchingSystem.createReturnMarch()` 创建回城行军 | `cancelSiege` (SiegeTaskManager.ts line 362-363) 硬编码 `faction: 'neutral'`。但在 `WorldMapTab.tsx` 的正常攻城流程中 (line 649)，创建回城行军使用 `faction: 'wei'` (玩家阵营)。取消攻城时返回的部队应该是玩家阵营而非中立。测试 (interrupt.test.ts line 269) 也验证了 `faction: 'neutral'` 而非正确的 `faction: 'wei'`。这可能导致 MarchingSystem 对回城行军的渲染/处理不一致 | `cancelSiege` 接受 faction 参数或使用 task.expedition 中的阵营信息的证据 |

---

### C9 [P2]: cancelSiege 的 MarchingSystem 集成仅被 mock 测试

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 |
|--------|-------------|-------------|-------------|
| "cancelSiege...creates return march via MarchingSystem" | mock `createReturnMarch` 被 cancelSiege 调用，push 到 `returnMarches` 数组 | 测试使用的是一个手写的 mock 对象 (interrupt.test.ts line 43-66)，只验证参数被传递。没有测试验证: (1) 真实的 `MarchingSystem.createReturnMarch()` 是否接受这些参数格式; (2) 创建的回城行军是否能正确开始 (`startMarch`); (3) 回城行军到达后是否能正确推进任务到 `completed` 状态 | 使用真实 `MarchingSystem` 实例的 `cancelSiege` 集成测试 |

---

### C10 [P2]: getProgressPercent 对 paused 任务返回 0 但进度条条件也不渲染 paused

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 |
|--------|-------------|-------------|-------------|
| SiegeTaskPanel 正确显示活跃任务 | "real-time progress bars based on defenseRatios" | `activeTasks` (line 203) 过滤 `t.status !== 'completed'` -- `paused` 任务会出现在活跃列表中。但进度条渲染条件 (line 339) 只匹配 `marching/sieging/returning/settling`，**不包含 `paused`**。同时 `getProgressPercent` 缺少 `case 'paused'`，返回 0%。两个错误叠加: paused 任务在列表中可见但无进度条、无正确图标、无正确状态标签、无正确颜色 | `SiegeTaskPanel` 中对 `paused` 状态任务的完整 UI 处理 |

---

## Verdict Matrix

| Challenge | Severity | Builder Claim | Actual Status | Impact |
|:---------:|:--------:|:------------:|:-------------:|:------:|
| C1 | **P0** | I4 PASS | Engine only, zero UI wiring | pause/resume/cancel buttons do not exist; feature is unreachable |
| C2 | **P0** | PASS with caveat | 3 TS compile errors in production code | UI crashes on paused task display |
| C3 | **P0** | PASS | paused tasks show 0% progress, no bar | Visual regression |
| C4 | **P1** | I5 PASS | Recovery invisible in completed phase | Feature has no user-visible effect |
| C5 | **P1** | "solid engine" | No integration/E2E tests | Cannot verify interrupt flow works end-to-end |
| C6 | **P1** | Task 3 completed | Zero code changes; documentation only | Inflated task completion count |
| C7 | **P1** | Task 4 Part C done | PLAN.md I4/I5 still marked incomplete | Self-contradictory documentation |
| C8 | **P1** | cancelSiege correct | Hardcoded 'neutral' faction instead of player faction | Potential MarchingSystem inconsistency |
| C9 | **P2** | Tests verify integration | Mock-only tests | False confidence in MarchingSystem compatibility |
| C10 | **P2** | Panel correctly displays tasks | No paused case in any UI mapping | 4 separate UI defects for paused state |

---

## Overall Challenger Verdict

**Builder's "PASS with 2 issues" is materially overstated.**

- **3 P0 issues** mean the core feature of Task 1 (siege interrupt) is **engine-only dead code** -- no user can ever trigger pause/resume/cancel because there is no UI wiring whatsoever.
- **4 P1 issues** mean: defense recovery is invisible to users (Task 2 has no visual impact); the full interrupt-to-reconnect flow is untested; Task 3 counts as a "completed task" with zero code changes; documentation contradicts itself.
- Builder correctly identified the SiegeTaskPanel TS errors but **understated their severity** from P0 (functional breakage) to "MEDIUM". These are not cosmetic -- they mean the UI will crash or display garbage for any paused task.

**Recommended downgrade**: Task 1 from PASS to **FAIL** (engine-only, no UI integration). Task 2 from PASS to **PARTIAL** (engine complete but visual rendering gap). Task 3 from PASS to **NO-OP** (zero code changes). Task 4 from PASS to **PARTIAL** (PLAN.md not actually updated).
