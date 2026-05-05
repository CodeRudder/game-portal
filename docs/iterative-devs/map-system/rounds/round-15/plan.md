# Round 15 计划

> **迭代**: map-system
> **轮次**: Round 15
> **来源**: `PLAN.md` + R14 Judge Ruling + R14 对抗性修复后遗留问题 + R10-R14 跨轮趋势
> **日期**: 2026-05-04

## 本轮焦点

> **R15 定位: Integration Verification + Critical Bug Fix Phase** -- R14 修复了双路径架构并统一到 SettlementPipeline, 本轮验证集成端到端正确性, 修复 R14 遗留的 2 个渲染 P0 (黑屏+动画时序), 并推进 PLAN.md 剩余功能.

| 优先级 | 领域 | 来源 | 原因 |
|:------:|------|------|------|
| P0 | Task 1: SettlementPipeline E2E 验证 | R14 修复后验证 | R14 合并双路径后需验证 handleArrived -> Pipeline -> Modal 完整链路使用真实数据 |
| P0 | Task 2: WorldMapTab 集成测试 | R14 P1-03 | 3 个集成测试文件均不 import WorldMapTab, 需新增 mock eventBus -> SiegeResultModal E2E 测试 |
| P0 | Task 3: 修复攻城黑屏 (canvas clearRect) | R14 遗留 P0 | renderMarchSpritesOverlay 在无行军时 clearRect 全屏, 地形被清除导致黑屏 |
| P0 | Task 4: 修复动画时序 (弹窗提前出现) | R14 遗留 P0 | handleArrived 同步结算后立即 setSiegeResultVisible, 不等待攻城动画完成 |
| P2 | Task 5: R14 P2 遗留修复 | R14 P2-01/02 | 掉落概率测试精度统一 + z-order 渲染语义断言补充 |
| P3 | Task 6: PLAN.md 更新 + 剩余功能推进 | PLAN.md | 标记 I14/I15 状态更新 + 识别下批功能 |

## 对抗性评测重点

- [ ] **SettlementPipeline E2E**: handleArrived 通过 SettlementPipeline.execute() 产出的 casualties 包含真实 heroInjured/injuryLevel (非硬编码 false)
- [ ] **SettlementPipeline E2E**: itemDrops 通过 Pipeline.distribute() 获取 (非 WorldMapTab 直接调用 shouldDropInsiderLetter)
- [ ] **SettlementPipeline E2E**: reward 值来自 SIEGE_REWARD_CONFIG (非硬编码)
- [ ] **WorldMapTab 集成**: mock march:arrived 事件 -> SiegeResultModal 显示正确内容 (胜利/失败/取消)
- [ ] **WorldMapTab 集成**: 结果弹窗中的 injuryData/troopLoss/itemDrops/rewards 字段映射正确
- [ ] **黑屏修复**: 攻城全过程中地形始终可见, sprite 层清除不影响 terrain 层
- [ ] **动画时序**: 结果弹窗仅在 siegeAnim:completed 事件触发后出现, 绝不提前
- [ ] **状态一致性**: 延迟显示弹窗时 result data 不被后续操作覆盖
- [ ] **并发行军**: 多支行军同时到达时各自时序独立正确
- [ ] **Builder 交付门禁**: 必须报告全部已有测试套件运行结果, 测试总数 >= 2236
- [ ] **TypeScript 门禁**: `tsc --noEmit` 零新增错误 (排除 pre-existing PathfindingSystem)

## 质量目标

| 指标 | 目标 |
|------|------|
| P0 | 0 (修复 R14 遗留 2 个渲染 P0) |
| P1 | 0 (R14 P1-03 WorldMapTab 集成测试已补充) |
| P2 | <= 2 (修复 R14 P2-01/02, 接受 P2-06/07 推迟) |
| 测试通过率 | 100% |
| TS 错误 | 0 (排除 pre-existing PathfindingSystem 5 个错误) |
| 内部循环次数 | <= 2 |
| 新增测试用例 | >= 30 (E2E 验证 8 + WorldMapTab 集成 7 + 黑屏 5 + 时序 5 + P2 修复 3 + PLAN 2) |
| 攻城全流程黑屏 | 0 帧 |
| 弹窗-动画时序偏差 | 0 ms (弹窗仅在动画完成后出现) |

---

## 任务清单

### Task 1: SettlementPipeline E2E 端到端验证 (P0, Medium)

- **来源**: R14 修复 F-01 (双路径合并) 后需验证真实数据端到端正确性
- **涉及文件**:
  - `src/games/three-kingdoms/engine/map/__tests__/integration/settlement-e2e.integration.test.ts` (新增)
  - 依赖: `SettlementPipeline.ts`, `WorldMapTab.tsx`, `SiegeItemSystem.ts`, `ExpeditionSystem.ts`
- **背景**:
  - R14 将 siegeSystem.executeSiege() 替换为 SettlementPipeline.execute(), heroInjured 从硬编码 false 改为引擎真实值, itemDrops 从 WorldMapTab 直接调用改为通过 Pipeline.distribute() 获取
  - 这些修改的正确性需要端到端验证: SettlementPipeline 四阶段 (validate->calculate->distribute->notify) 在 handleArrived 路径下的完整输出
- **步骤**:
  1. **E2E 测试 1: 胜利路径完整输出** -- 构造攻城胜利场景 (cityDefense=0, troopsSufficient):
     - SettlementPipeline.execute() 返回 settlement 含: outcome='victory', casualties.heroInjured=true/false (由引擎计算), rewards 含 gold/grain/reputation (来自 SIEGE_REWARD_CONFIG), itemDrops 含内应信 (由 Pipeline.distribute() 调用 shouldDropInsiderLetter)
     - 逐字段验证: outcome, casualties (heroInjured, injuryLevel, troopsLost, troopsLostPercent), rewards (gold, grain, reputation, multiplier), itemDrops (type, name, quantity)
  2. **E2E 测试 2: 失败路径完整输出** -- 构造攻城失败场景 (cityDefense>0, troopsInsufficient):
     - 验证 outcome='defeat', rewards 为空/衰减, casualties.heroInjured 可能为 true, itemDrops 为空
  3. **E2E 测试 3: 取消路径完整输出** -- 构造攻城取消场景:
     - 验证 outcome='cancelled', 无结算数据, 无 rewards/itemDrops
  4. **E2E 测试 4: casualties 真实值验证** -- 对比 SettlementPipeline 产出的 casualties 与 ExpeditionSystem 引擎计算值:
     - heroInjured: 非硬编码 false, 值来自引擎 CasualtyCalculator
     - injuryLevel: 非 'none', 值来自引擎 (light/medium/severe 按 H2 概率)
     - troopsLost/troopsLostPercent: 与引擎 effectiveTroopsLost 一致
  5. **E2E 测试 5: itemDrops 来源验证** -- 确认 itemDrops 通过 Pipeline.distribute() 获取:
     - 验证 handleArrived 中无直接 shouldDropInsiderLetter 调用 (grep 确认)
     - 验证 distribute() 阶段在 execute() 的 executedPhases 中被记录
  6. **E2E 测试 6: rewards 来源验证** -- 确认 rewards 来自 SIEGE_REWARD_CONFIG:
     - 验证 baseGrain/baseGold 与 SIEGE_REWARD_CONFIG 一致
     - 验证 multiplier 按攻城次数衰减
  7. **E2E 测试 7: SiegeBattleSystem 时序验证** -- 确认 cancelBattle 不再影响结算:
     - SettlementPipeline 在 cancelBattle 之前完成 execute()
     - settlement 结果在 cancelBattle 后仍然可用
  8. **E2E 测试 8: 与旧路径等价性** -- 对比 SettlementPipeline 输出与旧 siegeSystem.executeSiege() 输出:
     - 相同输入下 outcome 一致
     - rewards 总量差异 < 5% (渐进式奖励 vs 固定值)
     - casualties 完全一致 (使用同一引擎)
- **验证**:
  - >= 8 个 E2E 测试通过
  - heroInjured 非硬编码 false (有真实运行时路径产生 true)
  - itemDrops 来源为 Pipeline.distribute() (无直接 shouldDropInsiderLetter 调用)
  - 已有 settlement-pipeline-integration 18 个测试不回归
  - `tsc --noEmit` 零新增错误

### Task 2: WorldMapTab 集成测试 (P0, Medium)

- **来源**: R14 P1-03 -- 3 个集成测试文件均不 import WorldMapTab, 未验证事件处理 -> UI 传递
- **涉及文件**:
  - `src/components/idle/panels/map/__tests__/WorldMapTab.integration.test.tsx` (新增)
  - 依赖: `WorldMapTab.tsx`, `SiegeResultModal.tsx`, `SettlementPipeline.ts`
- **背景**:
  - R14 的集成测试只测孤立类 (纯函数/独立组件/引擎类), 未验证 WorldMapTab 内事件处理链路
  - 如果存在 WorldMapTab 级别集成测试, R14 P0-01 (handleBattleCompleted 死路径) 会被立即发现
- **步骤**:
  1. **测试 1: march:arrived -> SiegeResultModal 胜利显示**:
     - Mock EventBus 发出 march:arrived 事件 (含 siegeTask 数据)
     - 验证 SiegeResultModal 变为 visible
     - 验证 siegeResultData 包含正确的 outcome='victory'
  2. **测试 2: march:arrived -> SiegeResultModal 失败显示**:
     - Mock EventBus 发出 march:arrived 事件 (失败场景)
     - 验证 siegeResultData.outcome='defeat'
  3. **测试 3: march:arrived -> injuryData 映射验证**:
     - 构造 settlement.casualties.heroInjured=true, injuryLevel='medium'
     - 验证 SiegeResultModal 接收的 injuryData 包含 level='medium', recoveryHours=2
  4. **测试 4: march:arrived -> troopLoss 映射验证**:
     - 构造 settlement.casualties.troopsLost=500
     - 验证 SiegeResultModal 接收的 troopLoss 包含正确的数值
  5. **测试 5: march:arrived -> itemDrops 映射验证**:
     - 构造 settlement.itemDrops 含内应信
     - 验证 SiegeResultModal 接收的 result.itemDrops 包含掉落物品
  6. **测试 6: march:arrived -> rewards 映射验证**:
     - 构造 settlement.rewards 含 gold/grain/reputation
     - 验证 SiegeResultModal 接收的 rewards 字段正确
  7. **测试 7: battle:completed 不再触发攻城结算**:
     - Mock EventBus 发出 battle:completed 事件
     - 验证 SiegeResultModal 不变 (无新弹窗/无数据变化)
     - 确认 handleBattleCompleted 已移除或不再处理攻城
- **验证**:
  - >= 7 个 WorldMapTab 集成测试通过
  - 覆盖事件处理 -> 数据映射 -> UI 显示完整链路
  - 已有 WorldMapTab.test.tsx 33 个测试不回归
  - `tsc --noEmit` 零新增错误

### Task 3: 修复攻城黑屏 -- canvas clearRect 擦除地形 (P0, Medium)

- **来源**: R14 遗留 P0-I1, PixelWorldMap.tsx lines 1354-1359
- **涉及文件**:
  - `src/components/idle/panels/map/PixelWorldMap.tsx` -- renderMarchSpritesOverlay (1354-1359) + 渲染循环 (1060-1110)
- **问题根因**:
  1. `renderMarchSpritesOverlay` 在 `activeMarches` 为空时调用 `ctx.clearRect(0, 0, canvas.width, canvas.height)` 擦除整个 canvas (包括地形层)
  2. 渲染循环中 terrain 层仅在 `wasTerrainDirty === true` 时重绘; 当 sprite 层 clearRect 擦除地形后, terrain dirty flag 已是 false, 后续帧不会重绘地形
  3. 攻城动画尝试在空白 canvas 上渲染, 出现黑屏
- **步骤**:
  1. **移除 clearRect**: 删除 `PixelWorldMap.tsx` lines 1354-1359 的 `ctx.clearRect(0, 0, canvas.width, canvas.height)` 和 early return; 改为在 `!marches.length` 时仅 return (不清除 canvas)
  2. **联动脏标记**: 在渲染循环 (lines 1060-1110) 中, 当 sprites 或 effects dirty 时, 强制设置 terrain dirty flag:
     ```typescript
     if (wasSpritesDirty || wasEffectsDirty) {
       flags.terrain = true;
     }
     ```
  3. **确保 renderMarchSpritesOverlay 不清除全画布**: 检查并移除其他 `clearRect` 全屏调用
  4. 编写测试:
     - 地形在 sprite 清除后仍然可见 (模拟 marches 变空 -> 验证 canvas 非空)
     - sprites dirty 时 terrain dirty flag 自动联动为 true
     - 攻城动画进行中 terrain 持续可见 (无黑帧)
     - 多次 sprite 更新后 terrain 不丢失
     - 渲染循环性能无明显退化 (dirty flag 联动不影响静态帧)
- **验证**:
  - >= 5 个新增测试通过
  - 攻城全过程中 canvas 始终包含地形
  - 已有 PixelWorldMap 渲染测试不回归
  - `tsc --noEmit` 零新增错误

### Task 4: 修复动画时序 -- 结果弹窗提前出现 (P0, Medium)

- **来源**: R14 遗留 P0-I2, WorldMapTab.tsx lines 524-661
- **涉及文件**:
  - `src/components/idle/panels/map/WorldMapTab.tsx` -- handleArrived handler (524-661)
  - `src/games/three-kingdoms/engine/map/SiegeBattleAnimationSystem.ts` -- siegeAnim:completed 事件
- **问题根因**:
  1. `handleArrived` 中 `setTimeout(0)` 同步执行 `settlementPipeline.execute()`, 获得结果后立即调用 `setSiegeResultVisible(true)`
  2. `battleSystem.createBattle()` 触发攻城动画 (集结 3s + 战斗 + 完成 2s)
  3. React 批量状态更新导致弹窗与动画几乎同时出现
- **步骤**:
  1. **存储结果但不显示**: 在 handleArrived 的 siege 执行回调中, execute() 完成后将结果存储到 ref (`pendingResultRef.current = result`), 但不调用 `setSiegeResultVisible(true)`
  2. **注册一次性事件监听**: 存储结果后注册匹配 taskId 的 `siegeAnim:completed` 一次性事件监听器:
     ```typescript
     const handler = (data: { taskId: string; targetCityId: string; victory: boolean }) => {
       if (data.taskId === currentTask.id) {
         setSiegeResultData(pendingResultRef.current);
         setSiegeResultVisible(true);
         eventBus.off('siegeAnim:completed', handler);
       }
     };
     eventBus.once('siegeAnim:completed', handler);
     ```
  3. **安全降级**: 添加超时保护 -- 若动画系统异常 (未在合理时间内触发 siegeAnim:completed), 5s 后强制显示:
     ```typescript
     const fallbackTimer = setTimeout(() => {
       eventBus.off('siegeAnim:completed', handler);
       setSiegeResultData(pendingResultRef.current);
       setSiegeResultVisible(true);
     }, 5000);
     ```
  4. **清理监听器**: 在组件 unmount 或新攻城开始时, 清理未触发的监听器和超时计时器
  5. 编写测试:
     - 弹窗在动画完成前不可见 (siegeResultVisible === false before siegeAnim:completed)
     - 弹窗在动画完成后立即可见 (fire siegeAnim:completed -> siegeResultVisible === true)
     - 结果数据在延迟显示时保持正确 (siegeResultData matches original result)
     - 动画系统异常时 5s 超时降级显示弹窗
     - 组件 unmount 时清理监听器和计时器
- **验证**:
  - >= 5 个新增测试通过
  - `setSiegeResultVisible(true)` 不在 handleArrived 同步路径中直接调用 (grep 确认)
  - 已有 handleArrived / SiegeResultModal 测试不回归
  - `tsc --noEmit` 零新增错误

### Task 5: R14 P2 遗留修复 (P2, Small)

- **来源**: R14 P2-01 (掉落概率测试精度) + P2-02 (z-order 渲染语义)
- **涉及文件**:
  - `src/games/three-kingdoms/engine/map/__tests__/integration/siege-item-integration.test.ts` -- 掉落概率断言
  - `src/components/idle/panels/map/__tests__/PixelWorldMap.batch-render.test.tsx` -- z-order 测试
- **步骤**:
  1. **掉落概率统一精度**:
     - siege-item-integration.test.ts: 100 次 + [8, 35] 改为 500 次 + [82, 118] (与 SiegeItemSystem.test.ts 一致)
     - 使用二项分布 95% 置信区间 (p=0.2, n=500, mu=100, sigma=sqrt(80)~8.94, +-2sigma=[82, 118])
  2. **z-order 渲染语义断言**:
     - 新增测试: 验证先创建精灵 (startTime 小) 在 fill 调用序列中先绘制 (数组索引小 = 先绘制 = 在底层)
     - 新增测试: 验证后创建精灵 (startTime 大) 在后绘制 (后绘制 = 覆盖前者 = 在上层)
  3. 回归验证: 确认修改后测试仍然通过
- **验证**:
  - >= 2 个新增/修改测试通过
  - 掉落概率测试精度: 两文件一致使用 500 次 + [82, 118]
  - z-order 测试: 含 "先创建在底层" 语义断言
  - `tsc --noEmit` 零新增错误

### Task 6: PLAN.md 更新 + 剩余功能识别 (P3, Small)

- **来源**: PLAN.md 功能状态更新 + R15 修复后状态变更
- **涉及文件**:
  - `docs/iterations/map-system/PLAN.md`
- **步骤**:
  1. 更新 PLAN.md 功能状态:
     - I14: `⚠️` -> `✅` (SettlementPipeline 统一路径完成, 攻占结果结算与事件生成闭环)
     - I15: `⚠️` -> `✅` (伤亡状态更新通过 SettlementPipeline 正确集成)
  2. 更新统计表:
     - I 系列已完成: 9 + 2 = 11
     - 总已完成: 52 + 2 = 54
     - 重新计算完成率: 54/65 = ~83%
  3. 更新迭代轮次规划表:
     - R15 状态: `⬜` -> `🔄` (进行中)
     - R15 描述: "集成验证 + 攻城渲染修复"
  4. 识别下批功能优先级 (R16):
     - 基于 PLAN.md 剩余 11 项 ⬜ 功能, 按优先级排序
     - Top 3: E1-3 (行军E2E), I3 (攻城锁定), I10 (攻占任务面板)
- **验证**:
  - PLAN.md 状态与实际交付一致
  - 完成率计算正确
  - 迭代轮次规划表 R15 状态已更新

---

## R14 遗留问题追踪

| ID | 问题 | 优先级 | 本轮处理 |
|----|------|:------:|---------|
| R15-I1 | 黑屏: renderMarchSpritesOverlay clearRect 擦除整个 canvas | P0 | Task 3 |
| R15-I2 | 动画时序: 结果弹窗在 siegeAnim:completed 前出现 | P0 | Task 4 |
| R15-I3 | 掉落概率测试精度不一致 | P2 | Task 5 |
| R15-I4 | z-order 渲染语义断言缺失 | P2 | Task 5 |
| R15-I5 | PLAN.md H6 完成率 | P2 | 验证 (R14 修复后应可标记) |
| R15-I6 | mapInjuryData 硬编码 recoveryHours | P2 | 接受推迟 (R16) |
| R15-I7 | InjuryLevel 映射位置 | P2 | 接受推迟 (R16) |
| R15-I8 | WorldMapTab 集成测试缺失 | P1 | Task 2 |
| R15-I9 | SettlementPipeline E2E 验证 | P1 | Task 1 |

## 跨轮趋势参考 (R10-R14)

| 指标 | R10 | R11 | R12 | R13 | R14 | R15 目标 |
|------|:---:|:---:|:---:|:---:|:---:|:-------:|
| 对抗性发现 | 6 | 11 | 22 | 12 | 9 | <= 7 |
| P0 问题 | 0 | 0 | 0 | 0 | 2->0 | 0 |
| P1 问题 | 2->0 | 4->0 | 0 | 1->0 | 4->0 | 0 |
| P2 问题 | 2 | 5 | 5 | 8 | 3 | <= 2 |
| 内部循环次数 | 1 | 1 | 1 | 1 | 2 | <= 2 |
| PLAN.md 完成率 | ~80% | ~80% | ~82% | ~90% | 80% | ~83% (54/65) |
| 测试总数 | ~250+ | ~378+ | ~369 | ~2148 | ~2236 | ~2266 |
| 跨轮遗留 P0 | 0 | 0 | 0 | 0 | 2 | 0 |
| 跨轮遗留 P1 | 0 | 4 | 0 | 1 | 0 | 0 |

> R14 的核心成果: 双路径架构修复为单一 SettlementPipeline 入口, 3 个孤立子系统真正接入运行时活跃路径. R15 在此基础上验证端到端正确性, 修复渲染层遗留问题.

## 改进措施 (来自 R9-R14 复盘)

| ID | 措施 | 本轮执行 |
|----|------|---------|
| IMP-01 | Builder 交付门禁: 必须报告全部已有测试套件运行结果 | 所有 Task 验证步骤已包含 |
| IMP-02 | TypeScript 门禁: 每 Task 完成后运行 `tsc --noEmit` | 所有 Task 验证步骤已包含 |
| IMP-03 | 双路径结算架构统一 | R14 已完成; R15 Task 1 验证统一后正确性 |
| IMP-04 | 测试回归检查: 每次大规模重构后必须运行全量测试 | 所有 Task 验证步骤已包含 |
| IMP-05 | 遗留 P0/P1 优先修复 | Task 3 (P0 黑屏) + Task 4 (P0 时序) + Task 2 (P1 集成测试) |
| IMP-06 | E2E 集成测试覆盖关键用户流程 | Task 1: SettlementPipeline E2E 8 场景; Task 2: WorldMapTab 集成 7 场景 |
| IMP-07 | 集成验证门禁: 每个引擎层 Task 必须包含 "wire to WorldMapTab" 验收步骤 | Task 1/2 均包含集成到 WorldMapTab 的验证 |
| IMP-08 | 孤立子系统检测 | R14 已完成接线, Task 1 验证无孤立子系统 |
| IMP-09 | **渲染层脏标记联动**: overlay 变化时强制联动 terrain 层重绘 | Task 3: sprites/effects dirty -> terrain dirty |
| IMP-10 | **异步事件驱动 UI 时序**: UI 状态变更由业务事件驱动 | Task 4: siegeAnim:completed -> setSiegeResultVisible |
| IMP-11 (R15 新增) | **WorldMapTab 集成测试门禁**: 每个 round 必须包含至少一个 WorldMapTab 组件级集成测试 | Task 2: 新增 7 个 WorldMapTab 集成测试 |

---

## 预期 PLAN.md 更新

| ID | 当前状态 | 预期状态 | 依据 |
|----|---------|---------|------|
| I14 | ⚠️ | ✅ | R14 SettlementPipeline 统一路径完成, 结果结算+事件生成为单一入口 |
| I15 | ⚠️ | ✅ | R14 伤亡状态更新通过 SettlementPipeline 正确传递 |
| I12 | ✅ | ✅ | Task 3/4: 确认行军->攻占动画无缝切换修复后正确 (无黑屏+时序正确) |

> 预期完成率: 52(原) + 2(I14+I15) = 54/65 = **~83%**

## 实施优先序

```
Phase 1 -- 集成验证 (验证 R14 修复正确性)
  Task 1 (P0, Medium)  -> SettlementPipeline E2E 端到端验证
  Task 2 (P0, Medium)  -> WorldMapTab 集成测试

Phase 2 -- P0 修复 (核心用户体验, 依赖 Phase 1)
  Task 3 (P0, Medium)  -> 修复攻城黑屏 (canvas clearRect)
  Task 4 (P0, Medium)  -> 修复动画时序 (弹窗提前出现)

Phase 3 -- P2 修复 + 文档 (弹性范围)
  Task 5 (P2, Small)   -> 掉落概率 + z-order P2 修复
  Task 6 (P3, Small)   -> PLAN.md 更新
```

## 风险评估

| 风险 | 概率 | 影响 | 缓解措施 |
|------|:----:|:----:|----------|
| Task 1: SettlementPipeline E2E 发现 R14 修复引入新回归 | 中 | 高 | 编写等价性测试, 逐字段对比 SettlementPipeline 与旧路径输出 |
| Task 2: WorldMapTab 组件渲染测试环境配置复杂 | 中 | 中 | 使用 React Testing Library + mock EventBus, 参考已有 WorldMapTab.test.tsx 模式 |
| Task 3: 脏标记联动导致性能退化 | 低 | 中 | 仅在 sprites/effects dirty 时联动 terrain, 静态帧无额外开销 |
| Task 4: 事件监听器泄漏 (unmount 时未清理) | 中 | 中 | useEffect cleanup 统一清理 + fallbackTimer 清理 + unmount 清理测试 |
| Task 4: 超时降级时间设置不当 | 低 | 低 | 5s 超时 = 集结 3s + 完成 2s, 可通过配置调整 |
| Task 4: 动画系统在修复后与 SettlementPipeline 冲突 | 中 | 高 | Task 1 E2E 测试覆盖动画时序场景; 等价性测试验证 |

---

## R14 交付总结 (参考)

| 类别 | R14 完成 | R15 目标 |
|------|---------|---------|
| Task 1 (SiegeItemSystem 接线) | 21 测试通过, Pipeline 统一路径 | Task 1: E2E 端到端验证 |
| Task 2 (injuryData/troopLoss 接线) | 21 测试通过, 真实 casualties | Task 1: E2E casualties 验证 |
| Task 3 (SettlementPipeline 替换) | 18 测试通过, 单一入口 | Task 1: E2E 完整管道验证 |
| Task 4 (P2/P1 修复) | 6 测试通过, z-order 修复 | Task 5: 掉落精度 + z-order 语义 |
| Task 5 (PLAN.md) | 完成率 52/65 = 80% | Task 6: 54/65 = 83% |
| 对抗性修复 (14.2) | 5 fixes: 双路径合并 + 死代码移除 + 硬编码消除 + 双重调用消除 + itemDrops 测试 | Task 1/2: 验证修复正确性 |
| P0 | 2->0 (集成层) + 2 (渲染层遗留) | 0 |
| P1 | 4->0 + 1 (集成测试遗留) | 0 |
| UI 测试 | 152 (33+60+59) | >= 189 (152+30+7) |
| 孤立子系统 | 0 | 0 |
| 死代码路径 | 0 (handleBattleCompleted 移除) | 0 |

---

## 技术方案详细设计

### Task 1: SettlementPipeline E2E 验证架构

```
测试结构:
  settlement-e2e.integration.test.ts
    |-- SettlementContext 构造器 (辅助函数)
    |-- 场景 1: 胜利路径 (validate->calculate->distribute->notify 全阶段)
    |-- 场景 2: 失败路径
    |-- 场景 3: 取消路径
    |-- 场景 4: casualties 真实值 (对比引擎输出)
    |-- 场景 5: itemDrops 来源 (Pipeline.distribute, 非直接调用)
    |-- 场景 6: rewards 来源 (SIEGE_REWARD_CONFIG, 非硬编码)
    |-- 场景 7: cancelBattle 时序 (Pipeline 在 cancel 前完成)
    |-- 场景 8: 与旧路径等价性 (逐字段对比)
```

### Task 2: WorldMapTab 集成测试架构

```
测试结构:
  WorldMapTab.integration.test.tsx
    |-- 渲染 WorldMapTab (mock 依赖: EventBus, SiegeTaskManager, etc.)
    |-- 场景 1: march:arrived -> 胜利弹窗显示
    |-- 场景 2: march:arrived -> 失败弹窗显示
    |-- 场景 3: march:arrived -> injuryData 映射 (heroInjured=true)
    |-- 场景 4: march:arrived -> troopLoss 映射 (troopsLost=500)
    |-- 场景 5: march:arrived -> itemDrops 映射 (内应信掉落)
    |-- 场景 6: march:arrived -> rewards 映射 (gold/grain/reputation)
    |-- 场景 7: battle:completed 不触发攻城结算 (死代码已移除)
```

### Task 3: 渲染循环脏标记联动

```
当前流程 (有 bug):
  frame() {
    if (wasTerrainDirty)  -> renderer.render()  // clearRect + 重绘地形
    if (wasEffectsDirty)  -> renderEffectsOverlay()
    if (wasSpritesDirty)  -> renderMarchSpritesOverlay()
  }
  // renderMarchSpritesOverlay 在 marches=[] 时 clearRect(0,0,w,h)
  // -> 地形被清除 -> 后续帧 wasTerrainDirty=false -> 不重绘 -> 黑屏

修复后流程:
  frame() {
    // 新增: overlay 变化时强制重绘地形
    if (wasSpritesDirty || wasEffectsDirty) {
      flags.terrain = true;
    }
    if (wasTerrainDirty)  -> renderer.render()  // 始终在地形层重绘
    if (wasEffectsDirty)  -> renderEffectsOverlay()
    if (wasSpritesDirty)  -> renderMarchSpritesOverlay()
    // renderMarchSpritesOverlay 在 marches=[] 时仅 return, 不 clearRect
  }
```

### Task 4: 事件驱动弹窗时序

```
当前流程 (有 bug):
  handleArrived() {
    setTimeout(0, () => {
      battleSystem.createBattle()  // 触发动画开始
      settlement = settlementPipeline.execute(ctx)  // 统一路径 (R14 修复)
      battleSystem.cancelBattle()
      setSiegeResultData(siegeResultData)  // 立即设置数据
      setSiegeResultVisible(true)          // 立即显示弹窗 <- BUG
    })
  }

修复后流程:
  handleArrived() {
    setTimeout(0, () => {
      battleSystem.createBattle()  // 触发动画开始
      settlement = settlementPipeline.execute(ctx)  // 统一路径
      battleSystem.cancelBattle()
      pendingResultRef.current = buildResultData(settlement)  // 存储, 不显示

      // 监听动画完成事件
      const handler = (data) => {
        if (data.taskId === currentTask.id) {
          clearTimeout(fallbackTimer)
          setSiegeResultData(pendingResultRef.current)
          setSiegeResultVisible(true)  // 动画完成后才显示
          eventBus.off('siegeAnim:completed', handler)
        }
      }
      eventBus.once('siegeAnim:completed', handler)

      // 安全降级: 5s 超时
      fallbackTimer = setTimeout(() => {
        eventBus.off('siegeAnim:completed', handler)
        setSiegeResultData(pendingResultRef.current)
        setSiegeResultVisible(true)
      }, 5000)
    })
  }
```

---

*Round 15 迭代计划 | 2026-05-04*
