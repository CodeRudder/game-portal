# Round 9 计划

> **迭代**: map-system
> **轮次**: Round 9
> **来源**: `PLAN.md` + Round 8 `judge-ruling.md` + R8 P1/P2 前向传递
> **日期**: 2026-05-04

## 本轮焦点

| 优先级 | 领域 | 来源 | 原因 |
|:------:|------|------|------|
| P1 | I10 攻占任务面板增强 | PLAN.md MAP-F06-10 | SiegeTaskPanel 存在但缺少实时状态追踪、点击聚焦行军路线、进度指示器 |
| P1 | I5 城防衰减显示 | PLAN.md MAP-F06-13 | SiegeBattleSystem 运行但无视觉反馈，需 PixelWorldMap 渲染城防血条 |
| P1 | R8 P1-1 激活 createReturnMarch | R8 Judge | createReturnMarch() 是死代码，速度 x0.8 从未生效 |
| P1 | R8 P1-3 executeSiege 同步路径集成测试 | R8 Judge | 路径A 的手动伤亡计算逻辑零测试覆盖 |
| P2 | H5 攻城结果弹窗伤亡详情增强 | PLAN.md MAP-F06 | SiegeResultModal 已有基础框架但缺少恢复时间、伤亡健康色指示、结果等级 |
| P2 | R8 P2-2 战斗引擎空转修复 | R8 Judge | 路径A setResult() 后 SiegeBattleSystem 继续空转 |
| P2 | R8 P2-3 回城路径设计对齐 | R8 Judge | originalPath 参数定义但未使用 |
| P2 | 测试注释修复 P2-1 | R8 Judge | getForceHealthColor 边界注释与断言矛盾 |

## 详细任务分解

### Phase 1: R8 P1 紧急修复 (Task 1-2)

#### Task 1: 激活 createReturnMarch — 回城速度 x0.8 生效 (P1, Small)

**问题**: `MarchingSystem.ts:341-369` 中 `createReturnMarch()` 实现了速度 `BASE_SPEED * 0.8`，但 WorldMapTab.tsx 中两处回城行军创建（行522 march:arrived 路径和行674 battle:completed 路径）均使用 `createMarch()`，回城速度始终为 `BASE_SPEED`（30 px/s），速度 x0.8 功能从未生效。R8 Judge P0-1 降级为 P1。

**计划**:
1. 在 `WorldMapTab.tsx` 中定位两处回城行军创建代码：
   - **位置 A**（march:arrived handler, setTimeout 内约行522）：
     ```typescript
     // 修改前:
     const returnMarch = marchingSystemRef.current!.createMarch(
       currentTask.targetId, currentTask.sourceId, ...);
     // 修改后:
     const returnMarch = marchingSystemRef.current!.createReturnMarch({
       fromCityId: currentTask.targetId,
       toCityId: currentTask.sourceId,
       troops: ...,
       general: ...,
       faction: ...,
       originalPath: currentTask.marchPath,
       siegeTaskId: currentTask.id,
     });
     ```
   - **位置 B**（battle:completed handler 约行674）：同理替换
2. 为 `createReturnMarch()` 添加速度 x0.8 的断言测试
3. 验证两处替换后回城行军速度均为 `24 px/s`（30 * 0.8）

**验证标准**: 全局搜索 `createMarch` 在 WorldMapTab.tsx 中不再有回城用途的调用；`createReturnMarch` 被正确调用 2 处；测试验证 march.speed === BASE_SPEED * 0.8

**涉及文件**:
- `src/components/idle/panels/map/WorldMapTab.tsx` — 两处 createMarch → createReturnMarch
- `src/games/three-kingdoms/engine/map/__tests__/MarchingSystem.return.test.ts`（新建） — 速度 x0.8 测试

---

#### Task 2: executeSiege 同步路径集成测试 (P1, Medium)

**问题**: WorldMapTab.tsx 行448-577 的 `setTimeout` 回调（路径A）包含完整的攻城执行链路：`createBattle()` + `executeSiege()` + 手动伤亡计算（行488-498）+ `setResult()` + `advanceStatus()` + `createMarch()`。这是攻城系统的主执行路径，但零测试覆盖。手动伤亡计算逻辑与 SiegeResultCalculator 是两套不同实现。R8 Judge P1-3。

**计划**:
1. 创建集成测试文件 `src/games/three-kingdoms/engine/map/__tests__/integration/execute-siege-path.integration.test.ts`
2. 提取路径A的核心逻辑为可测试的纯函数（或使用真实的 EventBus + SiegeTaskManager + SiegeBattleSystem 组合）：
   ```typescript
   // 模拟路径A的完整链路
   describe('executeSiege synchronous path (Path A)', () => {
     // 场景 1: 完整链路 — createBattle -> executeSiege -> setResult -> advanceStatus
     // 场景 2: 手动伤亡计算逻辑验证（对比 SiegeResultCalculator 结果）
     // 场景 3: 胜利路径 — setResult(victory) + advanceStatus('returning')
     // 场景 4: 失败路径 — setResult(defeat) + 失败原因记录
     // 场景 5: 无关联任务时的静默处理
   });
   ```
3. 重点验证：
   - 手动伤亡计算（行488-498）的输出范围是否与 SiegeResultCalculator 一致
   - `setResult` 写入的 `SiegeTaskResult` 字段完整性
   - `advanceStatus` 状态推进序列正确性（sieging → settling → returning）
4. 至少覆盖 4 个场景

**验证标准**: >= 4 个集成测试场景通过；手动伤亡计算与 SiegeResultCalculator 结果偏差在配置允许范围内

**涉及文件**:
- `src/games/three-kingdoms/engine/map/__tests__/integration/execute-siege-path.integration.test.ts`（新建）

---

### Phase 2: I5 城防衰减显示 (Task 3)

#### Task 3: PixelWorldMap 城防血条渲染 (P1, Medium)

**问题**: `PLAN.md` I5 — 城防衰减显示（MAP-F06-13）。SiegeBattleSystem 运行时城防值持续衰减，R8 Task 2 已将 defenseRatio 桥接到 SiegeBattleAnimationSystem.updateBattleProgress()，但 PixelWorldMap 的 Canvas 渲染中未利用该数据绘制城防血条。玩家无法直观看到城防消耗进度。

**计划**:
1. 确认 `PixelWorldMap` 已通过 `activeSiegeAnims` prop 接收攻城动画状态（R7 Task 5 应已完成渲染集成）
2. 在攻城动画的 battle 阶段渲染中，增强城防血条显示：
   - **血条位置**: 目标城池上方，宽度与城池 tile 大小一致
   - **血条颜色**: defenseRatio > 0.6 绿色 `#4caf50` / 0.3~0.6 黄色 `#ffc107` / < 0.3 红色 `#e74c3c`
   - **血条宽度**: `baseWidth * defenseRatio`
   - **血条背景**: 半透明黑色底条
   - **衰减动画**: 每帧更新，平滑过渡
3. 在血条上方显示城防百分比文字 `Math.floor(defenseRatio * 100) + '%'`
4. 战斗未进行时不显示血条（仅 `phase === 'battle'` 时渲染）
5. 添加城防血条的 Canvas 渲染单元测试（mock ctx，验证 fillRect 调用参数）

**验证标准**: 攻城进行中目标城池上方显示城防血条；血条颜色和宽度实时反映 defenseRatio；战斗结束后血条消失；测试验证 ctx.fillRect 参数合理

**涉及文件**:
- `src/components/idle/panels/map/PixelWorldMap.tsx` — 城防血条渲染
- `src/components/idle/panels/map/__tests__/PixelWorldMap.defense-bar.test.tsx`（新建）

---

### Phase 3: I10 攻占任务面板增强 (Task 4-5)

#### Task 4: SiegeTaskPanel 实时状态追踪 (P1, Medium)

**问题**: `PLAN.md` I10 — 攻占任务面板。当前 SiegeTaskPanel 仅显示基础信息（状态标签、编队信息、ETA），缺少：
- 实时状态追踪（marching → sieging → settling → returning → completed 的过渡动画）
- 基于实际数据的进度指示器（当前进度条宽度为硬编码 30%/60%）
- 回城中任务的 ETA
- 已完成任务的保留展示（当前直接过滤掉）

**计划**:
1. 在 `SiegeTaskPanel` 中增强实时状态追踪：
   ```typescript
   // 新增：状态过渡动画
   const [transitioningTask, setTransitioningTask] = useState<string | null>(null);
   // 当 task.status 变化时，触发过渡动画（CSS transition 300ms）
   ```
2. 进度条改为基于实际数据：
   - `marching`: 进度 = (Date.now() - marchStartedAt) / (estimatedArrival - marchStartedAt)
   - `sieging`: 进度 = 1 - (defenseRatio ?? 1)（从 SiegeBattleAnimationSystem 获取）
   - `returning`: 进度 = 基于回城行军的预估时间
   - `completed`: 进度 = 100%
3. 添加回城中任务的 ETA 显示（从 MarchingSystem 获取预估时间）
4. 已完成任务区域：保留最近 5 个已完成任务，可折叠展示
5. 新增 `onStatusTransition` 回调 prop，通知父组件状态变更
6. 扩展 Props：
   ```typescript
   export interface SiegeTaskPanelProps {
     tasks: SiegeTask[];
     onSelectTask?: (task: SiegeTask) => void;
     visible?: boolean;
     onClose?: () => void;
     // 新增
     /** 实时城防比例（taskId -> ratio），用于攻城中进度条 */
     defenseRatios?: Record<string, number>;
     /** 回城行军预估到达时间（taskId -> timestamp） */
     returnETAs?: Record<string, number>;
     /** 点击任务项后聚焦到地图上的行军路线 */
     onFocusMarchRoute?: (taskId: string) => void;
   }
   ```

**验证标准**: 进度条宽度基于实际数据计算；状态变更有视觉过渡；回城中任务显示 ETA；最近已完成任务可查看

**涉及文件**:
- `src/components/idle/panels/map/SiegeTaskPanel.tsx` — 增强组件
- `src/components/idle/panels/map/SiegeTaskPanel.css` — 过渡动画样式

---

#### Task 5: SiegeTaskPanel 点击聚焦行军路线 + 测试 (P1, Medium)

**问题**: PLAN.md I10 要求攻占任务面板支持"点击查看行军路线"。WorldMapTab 需要将面板的 onSelectTask/onFocusMarchRoute 连接到地图的视窗平移和高亮。

**计划**:
1. 在 WorldMapTab 中添加 `handleFocusMarchRoute` 处理函数：
   ```typescript
   function handleFocusMarchRoute(taskId: string) {
     const task = siegeTaskManagerRef.current?.getTask(taskId);
     if (!task) return;
     // 1. 平移视窗到目标城池中心
     const targetCenter = getCityCenter(task.targetId);
     mapViewPort.center(targetCenter);
     // 2. 高亮行军路线（如果有活跃行军）
     if (task.status === 'marching' || task.status === 'returning') {
       setHighlightedTaskId(taskId);
     }
   }
   ```
2. 将 SiegeTaskPanel 的 `onFocusMarchRoute` prop 连接到 `handleFocusMarchRoute`
3. 在 PixelWorldMap 中支持高亮行军路线渲染（将选中任务的路径用高亮色绘制）
4. 扩展 SiegeTaskPanel 测试覆盖：
   - 实时进度条计算正确性
   - 点击任务项触发 onSelectTask
   - onFocusMarchRoute 回调触发
   - 已完成任务折叠/展开
   - defenseRatios 属性传递后进度条更新
5. 至少新增 6 个测试场景

**验证标准**: 点击任务面板中的任务项后地图视窗平移到目标城池；活跃行军路线高亮显示；测试 >= 6 个新场景通过

**涉及文件**:
- `src/components/idle/panels/map/WorldMapTab.tsx` — handleFocusMarchRoute + prop 连接
- `src/components/idle/panels/map/PixelWorldMap.tsx` — 高亮行军路线渲染
- `src/components/idle/panels/map/__tests__/SiegeTaskPanel.test.tsx` — 扩展测试

---

### Phase 4: H5 攻城结果弹窗伤亡详情增强 (Task 6)

#### Task 6: SiegeResultModal 伤亡详情与结果等级显示 (P2, Medium)

**问题**: `PLAN.md` H5 — 攻城结果弹窗显示伤亡详情。SiegeResultModal 已有基础伤亡展示（士兵伤亡数+将领受伤等级），但缺少：
- 伤亡健康色指示器（绿/黄/红背景条）
- 将领受伤恢复时间显示（轻伤2h / 中伤8h / 重伤24h）
- 战斗结果等级（大胜/胜利/险胜/失败/惨败）
- 奖励明细带倍率显示

**计划**:
1. 在 `SiegeResultData` 类型中扩展字段：
   ```typescript
   export interface SiegeResultData {
     // ...existing...
     /** 战斗结果等级 */
     outcome?: 'decisiveVictory' | 'victory' | 'narrowVictory' | 'defeat' | 'rout';
     /** 将领恢复时间(ms) */
     heroRecoveryTime?: number;
   }
   ```
2. 在 SiegeResultModal 中添加伤亡健康色指示器：
   ```typescript
   // 伤亡比例健康色
   function getCasualtyHealthColor(percent: number): string {
     if (percent <= 0.2) return '#4caf50';  // 绿色 — 低伤亡
     if (percent <= 0.4) return '#ffc107';  // 黄色 — 中等伤亡
     return '#e74c3c';                       // 红色 — 高伤亡
   }
   ```
3. 添加战斗结果等级显示（outcome → 中文标签 + 图标）：
   ```typescript
   const OUTCOME_LABELS = {
     decisiveVictory: { label: '大捷', icon: '🏆' },
     victory: { label: '胜利', icon: '⚔️' },
     narrowVictory: { label: '险胜', icon: '😰' },
     defeat: { label: '失败', icon: '💀' },
     rout: { label: '惨败', icon: '🔥' },
   };
   ```
4. 将领受伤增加恢复时间显示：
   ```
   将领受伤: 中伤 (恢复时间: 8小时)
   ```
5. 奖励明细增加倍率说明（首次 x2 / 重复 x1）
6. 扩展 SiegeResultModal 测试覆盖新增展示逻辑

**验证标准**: 弹窗显示结果等级标签；伤亡健康色条根据伤亡比例变色；受伤将领显示恢复时间；奖励显示倍率

**涉及文件**:
- `src/components/idle/panels/map/SiegeResultModal.tsx` — 增强展示
- `src/components/idle/panels/map/__tests__/SiegeResultModal.test.tsx` — 扩展测试

---

### Phase 5: R8 P2 修复与清理 (Task 7-8)

#### Task 7: 战斗引擎空转修复 + originalPath 设计对齐 (P2, Small)

**问题**: 两个 R8 Judge P2 问题需一并修复：
- **P2-2 战斗引擎空转**: 路径A `setResult()` 完成后，`SiegeBattleSystem.update()` 继续运行直到城防自然耗尽。应在路径A `setResult()` 后调用 `battleSystem.cancelBattle(taskId)` 停止无用计算。
- **P2-3 originalPath 设计对齐**: `createReturnMarch()` 接受 `originalPath` 参数但内部未使用，仍用 `calculateMarchRoute()` 重新寻路。需决定：使用原路反转 or 保持重新寻路，并在 JSDoc 中明确设计意图。

**计划**:
1. 在 WorldMapTab.tsx 路径A的 `setResult()` + `advanceStatus('returning')` 之后，添加：
   ```typescript
   // 停止战斗引擎空转
   battleSystem.cancelBattle(currentTask.id);
   ```
2. 对 `createReturnMarch` 的 `originalPath` 参数做设计决策：
   - **方案 A（推荐）**: 保持重新寻路，将 `originalPath` 参数标记为 `@deprecated`，未来版本移除。理由：A* 在确定性图上给出确定性路径，去程和回程路径等价（仅方向不同）。
   - **方案 B**: 实现原路反转，将 `originalPath` 数组 `.reverse()` 后使用。理由：严格遵循"原路返回"语义。
   - 选择方案 A，添加注释说明设计理由。
3. 在 `cancelBattle` 后验证 `SiegeBattleSystem` 不再对该 taskId 调用 update

**验证标准**: 路径A setResult 后 SiegeBattleSystem.cancelBattle 被调用；activeBattles 中该 taskId 被移除；createReturnMarch 的 originalPath 参数有清晰的 JSDoc 说明

**涉及文件**:
- `src/components/idle/panels/map/WorldMapTab.tsx` — 添加 cancelBattle 调用
- `src/games/three-kingdoms/engine/map/MarchingSystem.ts` — originalPath 参数 JSDoc 更新

---

#### Task 8: 测试注释修复 + getForceHealthColor 边界精确化 (P2, Trivial)

**问题**: R8 Judge P2-1 — `ExpeditionSystem.casualties.test.ts` 行198 测试标题 "0.30 损失 -> damaged" 但断言为 `toBe('healthy')`。注释与断言矛盾。

**计划**:
1. 修复测试标题：
   ```typescript
   // 修改前:
   it('0.30 损失 → damaged（边界值，严格大于 0.3 才进入 damaged）', () => {
   // 修改后:
   it('0.30 损失 → healthy（边界值，> 0.3 才进入 damaged）', () => {
   ```
2. 补充精确的边界值测试：
   ```typescript
   it('0.31 损失 → damaged（刚超过边界）', () => {
     expect(system.getForceHealthColor(0.31)).toBe('damaged');
   });
   it('0.60 损失 → damaged（刚好不超过 critical）', () => {
     expect(system.getForceHealthColor(0.60)).toBe('damaged');
   });
   it('0.61 损失 → critical（刚超过边界）', () => {
     expect(system.getForceHealthColor(0.61)).toBe('critical');
   });
   ```

**验证标准**: 测试标题与断言一致；边界值 0.30/0.31/0.60/0.61 均有明确测试

**涉及文件**:
- `src/games/three-kingdoms/engine/map/__tests__/ExpeditionSystem.casualties.test.ts`

---

## 对抗性评测重点

- [ ] **R8 P1-1 验证**: `createReturnMarch()` 在 WorldMapTab.tsx 中被正确调用 2 处；回城行军速度为 24 px/s
- [ ] **R8 P1-3 验证**: executeSiege 同步路径有 >= 4 个集成测试；手动伤亡计算结果在配置范围内
- [ ] **I5 城防血条**: PixelWorldMap 攻城动画 battle 阶段目标城池上方显示城防血条；defenseRatio 实时更新
- [ ] **I10 面板增强**: 进度条宽度基于实际数据（非硬编码）；点击任务项地图视窗平移到目标城池
- [ ] **I10 状态追踪**: 状态变更有视觉过渡动画；已完成任务可折叠查看
- [ ] **H5 伤亡详情**: 弹窗显示结果等级（大胜/胜利/险胜/失败/惨败）；伤亡健康色指示器正确
- [ ] **H5 恢复时间**: 受伤将领显示恢复时间（轻伤2h / 中伤8h / 重伤24h）
- [ ] **P2-2 空转修复**: 路径A setResult 后 SiegeBattleSystem.cancelBattle 被调用
- [ ] **P2-3 originalPath**: 参数设计意图在 JSDoc 中明确记录
- [ ] **测试注释**: getForceHealthColor 边界值测试标题与断言一致
- [ ] **速度 x0.8 测试**: createReturnMarch 专项测试验证 march.speed === BASE_SPEED * 0.8
- [ ] **回归**: 现有 170+ 测试全部通过；R8 功能不受影响

## 质量目标

| 指标 | 目标 |
|------|------|
| P0 | 0 |
| P1 | 0（R8 遗留 2 个 P1 必须修复 + I5/I10 交付） |
| P2 | 0（R8 遗留 5 个 P2 至少修复 3 个） |
| 测试通过率 | 100% |
| 新增单元测试 | >= 14 场景（defense-bar 4 + SiegeTaskPanel 6 + SiegeResultModal 4） |
| 新增集成测试 | >= 6 场景（execute-siege-path 4 + return-speed 2） |
| R8 P1 修复 | 2/2 完成（createReturnMarch 激活 + executeSiege 测试） |
| R8 P2 修复 | 3/5 完成（空转 + originalPath + 注释） |
| I5 交付 | 城防血条 Canvas 渲染完成 |
| I10 交付 | 攻占任务面板增强（实时进度 + 点击聚焦 + 已完成折叠） |
| H5 进展 | 结果弹窗伤亡详情增强（结果等级 + 恢复时间 + 健康色） |

## 风险评估

| 风险 | 概率 | 影响 | 缓解措施 |
|------|:----:|:----:|----------|
| createReturnMarch 替换后回城行军参数不匹配 | 低 | 中 | createReturnMarch 内部调用 createMarch，参数兼容；逐一比对两处替换的参数映射 |
| I10 进度条计算依赖 MarchingSystem 的预估时间精度 | 中 | 低 | 预估时间由 MarchingSystem.calculateMarchRoute 提供，已有单元测试；进度条允许 ±5% 误差 |
| I5 城防血条与现有攻城动画 Canvas 渲染层冲突 | 低 | 低 | R7 Task 5 已建立攻城动画渲染层；城防血条在现有渲染函数中追加，不改变现有渲染顺序 |
| H5 outcome 字段需从 SiegeResultCalculator 传递到 SiegeResultModal | 中 | 中 | 需在 WorldMapTab battle:completed handler 中将 outcome 字段写入 SiegeResultData；验证数据流完整性 |
| executeSiege 同步路径集成测试 mock 复杂度 | 中 | 低 | 使用真实 EventBus + 真实 SiegeTaskManager + 真实 SiegeBattleSystem，仅 mock 外部数据（territory、hero） |

## 与 PLAN.md 对齐

本轮完成后 PLAN.md 预期状态变化:

| 功能 | 当前状态 | R9 预期 |
|------|:--------:|:--------:|
| I5 城防衰减显示 | ⬜ | ✅ |
| I10 攻占任务面板 | ⬜ | ✅ |
| H5 攻城结果弹窗显示伤亡详情 | ⬜ | 🔄（UI增强完成，待集成完整 outcome 数据流） |
| R8 P1-1 createReturnMarch 死代码 | P1 | ✅ |
| R8 P1-3 executeSiege 同步路径测试 | P1 | ✅ |
| R8 P2-2 战斗引擎空转 | P2 | ✅ |
| R8 P2-3 originalPath 设计对齐 | P2 | ✅ |
| R8 P2-1 测试注释修复 | P2 | ✅ |
| R8 P1-2 battle:completed React 集成测试 | P2 | ⬜（降级至 R10） |
| R8 P2 速度 x0.8 零测试 | P2 | ✅（Task 1 包含） |

## 实施优先序

```
Phase 1 — R8 P1 紧急修复（必须，无功能依赖）
  Task 1 (P1, Small)   → createReturnMarch 激活 + 速度 x0.8 测试
  Task 2 (P1, Medium)  → executeSiege 同步路径集成测试

Phase 2 — I5 城防衰减显示（独立，可与 Phase 1 并行）
  Task 3 (P1, Medium)  → PixelWorldMap 城防血条渲染

Phase 3 — I10 攻占任务面板增强（依赖 Phase 2 的 defenseRatios 数据）
  Task 4 (P1, Medium)  → SiegeTaskPanel 实时状态追踪
  Task 5 (P1, Medium)  → 点击聚焦行军路线 + 测试

Phase 4 — H5 攻城结果弹窗增强（独立，可与 Phase 3 并行）
  Task 6 (P2, Medium)  → 伤亡详情与结果等级显示

Phase 5 — R8 P2 修复与清理（独立，可与任何 Phase 并行）
  Task 7 (P2, Small)   → 战斗引擎空转 + originalPath 对齐
  Task 8 (P2, Trivial) → 测试注释修复 + 边界精确化
```

---

*Round 9 计划 | 2026-05-04*
