# R12 Task 6: I10 攻占任务面板UI完善 — 验证报告

## 概述
对 SiegeTaskPanel 组件进行增强，新增编队摘要、状态图标、空状态引导、创建时间显示等 4 项功能，并新增 17 个测试用例（全部通过）。

## 修改文件

### 1. `src/components/idle/panels/map/SiegeTaskPanel.tsx`
**变更类型：功能增强**

主要修改：
- **ExtendedStatus 类型**：新增 `failed` 扩展状态，将已完成但失败的任务区分显示
- **getStatusIcon()** 更新：按照任务要求替换图标
  - `marching` → `→`（原为 `⚔`）
  - `sieging` → `⚔`（原为 `🗡`）
  - `returning` → `←`（原为 `🏠`）
  - `completed` → `✓`（保持不变）
  - 新增 `failed` → `✗`
- **getDisplayStatus()**：新增函数，根据 `task.result.victory` 判断是否为失败状态
- **formatElapsedTime()**：新增函数，格式化创建至今的经过时间（秒前/分钟前/小时前/天前）
- **编队摘要 (Formation Summary)**：新增 `.siege-task-panel__formation-summary` 区域，格式 `⚔ [将名] × [兵力]兵`
- **状态图标 (Status Icons)**：每个任务状态图标使用独立 `<span>` 包裹，带有 `data-testid="status-icon-{taskId}"`
- **空状态引导 (Empty State)**：任务为空时不再返回 null，而是显示带有 `data-testid="siege-task-empty-state"` 的引导提示 "选择敌方城市开始攻城"
- **创建时间显示 (Creation Time)**：每个任务项底部显示创建经过时间，`data-testid="created-time-{taskId}"`
- **STATUS_COLORS** 新增 `failed: '#f44336'`（红色）
- **STATUS_LABELS** 新增 `failed: '失败'`

### 2. `src/components/idle/panels/map/__tests__/SiegeTaskPanel.test.tsx`
**变更类型：测试扩展**

修改 1 个现有测试：
- 原 `'任务数组为空时返回null'` 改为 `'任务数组为空时显示空状态引导'`，适配新的空状态面板行为

新增 17 个 R12 测试用例：

| # | 测试名 | 覆盖功能 |
|---|--------|----------|
| 1 | R12: 编队摘要显示将领名称 | Formation Summary |
| 2 | R12: 编队摘要显示兵力数量 | Formation Summary |
| 3 | R12: 行军中(marching)状态图标为 → | Status Icons |
| 4 | R12: 攻城中(sieging)状态图标为 ⚔ | Status Icons |
| 5 | R12: 回城中(returning)状态图标为 ← | Status Icons |
| 6 | R12: 已完成(completed)状态图标为 ✓（绿色） | Status Icons |
| 7 | R12: 失败(failed)状态图标为 ✗（红色） | Status Icons |
| 8 | R12: 无任务时显示空状态容器 | Empty State |
| 9 | R12: 空状态显示正确的引导文本 | Empty State |
| 10 | R12: 显示创建时间（分钟前） | Creation Time |
| 11 | R12: 显示创建时间（小时前） | Creation Time |
| 12 | R12: 向后兼容 — 进度条仍然正常显示 | Backward Compat |
| 13 | R12: 向后兼容 — ETA仍然正常显示 | Backward Compat |
| 14 | R12: 向后兼容 — 已完成任务折叠展开仍然正常 | Backward Compat |

## 测试结果

```
 ✓ src/components/idle/panels/map/__tests__/SiegeTaskPanel.test.tsx  (55 tests) 109ms

 Test Files  1 passed (1)
      Tests  55 passed (55)
   Duration  551ms
```

全部 55 个测试通过（原 38 个 + 修改 1 个 + 新增 17 个）。

## 新增 data-testid 清单

| data-testid | 用途 |
|---|---|
| `siege-task-panel` | 面板根容器 |
| `siege-task-empty-state` | 空状态引导区域 |
| `status-icon-{taskId}` | 活跃任务状态图标 |
| `status-icon-completed-{taskId}` | 已完成任务状态图标 |
| `formation-summary-{taskId}` | 活跃任务编队摘要 |
| `formation-summary-completed-{taskId}` | 已完成任务编队摘要 |
| `created-time-{taskId}` | 活跃任务创建时间 |
| `created-time-completed-{taskId}` | 已完成任务创建时间 |

## 向后兼容性

- 所有原有功能（进度条、ETA、折叠展开、聚焦路线、状态标签/颜色、策略标签、编队信息）保持不变
- 原有编队信息区（`expedition`）保留，编队摘要是额外新增区域
- `visible=false` 行为不变，仍返回 null
- 唯一行为变更：空任务数组时不再返回 null，而是显示空状态引导面板

## 问题与注意事项

1. **SiegeTaskStatus 类型不包含 `failed`**：使用 `ExtendedStatus` 扩展类型处理，`failed` 状态通过 `completed` + `result.victory === false` 推导，不修改原始类型定义
2. **无 CSS 文件**：SiegeTaskPanel 没有独立的 CSS 文件，样式通过内联 style 属性实现
3. **formatElapsedTime 使用 Date.now()**：在测试中直接使用相对时间偏移，不依赖 mock timer
