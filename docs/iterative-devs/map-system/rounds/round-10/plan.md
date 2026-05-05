# Round 10 计划

> **迭代**: map-system
> **轮次**: Round 10
> **来源**: `PLAN.md` + Round 9 `challenger-attack-r9.md` + `judge-ruling-r9.md` + 复盘改进(R8 IMP-01~04)
> **日期**: 2026-05-04

## 本轮焦点

| 优先级 | 领域 | 来源 | 原因 |
|:------:|------|------|------|
| P0 | WorldMapTab.test.tsx 回归修复 | R9 Judge #3 | 2个测试失败，行军触发+攻城动画核心功能测试断裂 |
| P1 | PathfindingSystem TS 错误修复 | R9 Judge #6 | `previousOwner`/`siege-task.types`/`CooldownManager` 共3处TS错误，`isFirstCapture` 逻辑可能偏差 |
| P1 | createReturnMarch 单元测试 | R9 Judge #2 | 关键方法零单元测试，回城速度 x0.8 无断言验证 |
| P1 | Path B cancelBattle 缺失 | R9 Judge #4 | battle:completed 路径战斗会话泄漏，SiegeBattleSystem 可能空转 |
| P1 | E1-3 行军→攻占完整链路 | PLAN.md | E系列最后未完成项之一，全流程E2E验证 |
| P1 | I11 行军精灵渲染+路线交互 | PLAN.md | I系列高优先级未完成项(P6阶段) |
| P2 | H7 将领受伤影响战力 | PLAN.md | H系列收尾，受伤将领战力衰减 |
| P2 | originalPath 参数清理 | R9 Judge #1 | createReturnMarch 冗余参数，JSDoc与实现不符 |
| P2 | 高亮行军路线 E2E 测试 | R9 Judge #5 | Canvas渲染和状态传递未验证 |
| P2 | 集成测试回城行军覆盖 | R9 Judge #8 | execute-siege-path 集成测试截断于cancelBattle，回城阶段未覆盖 |
| P2 | 城防血条边界值测试修正 | R9 Judge #7 | ratio=0.6 测试标题与实际传入值不符 |

---

## 详细任务分解

### Phase 1: R9 P0/P1 遗留修复 (Task 1-4)

#### Task 1: WorldMapTab.test.tsx 回归修复 (P0, Medium)

**问题**: R9 commit `e22dcf90` 对 `WorldMapTab.tsx` 做了 +562/-112 行大规模重构，改变了行军交互和攻城流程，但 `WorldMapTab.test.tsx` 的测试 mock 未同步更新，导致 2 个核心测试失败：
- `选中己方城市后点击目标城市触发行军` — `mockCreateMarch` 未被调用
- `攻城成功后触发 conquestAnimSystem.create` — `mockConquestCreate` 未被调用

R9 Judge 确认 git stash 回退后全部 33 个测试通过，确认是 R9 引入的回归。

**计划**:
1. 运行 `npx vitest run src/components/idle/panels/map/__tests__/WorldMapTab.test.tsx` 定位失败详情
2. 分析 R9 对 `WorldMapTab.tsx` 的修改对测试的影响：
   - 行军触发流程是否由直接调用 `marchingSystem.createMarch()` 改为通过事件总线或间接调用
   - 攻城动画触发是否由 `conquestAnimSystem.create()` 改为 `siegeBattleAnimSystem` 相关接口
3. 更新 `WorldMapTab.test.tsx` 中的 mock 以匹配新的交互流程：
   - 如果行军触发改为 `createReturnMarch`，更新 mock 监控
   - 如果攻城动画改用新的系统接口，更新对应的 mock 断言
4. 验证全部 33 个测试通过

**验证标准**: `WorldMapTab.test.tsx` 全部 33 个测试通过，0 失败

**涉及文件**:
- `src/components/idle/panels/map/__tests__/WorldMapTab.test.tsx` — 更新 mock 和断言

---

#### Task 2: TypeScript 类型错误修复 (P1, Small)

**问题**: R9 引入 3 处 TypeScript 编译错误：
- `WorldMapTab.tsx(640,37): error TS2339: Property 'previousOwner' does not exist on type 'TerritoryData'` — `TerritoryData` 接口不包含 `previousOwner`，导致 `isFirstCapture: !territory?.previousOwner` 永远为 `true`，所有攻城都被视为首次攻占
- `siege-task.types.ts(13,37): error TS2307: Cannot find module './expedition-types'` — 模块路径错误
- `CooldownManager.ts(112,24): error TS2353: 'remaining' does not exist in type 'CooldownEntry'` — 类型不匹配

**计划**:
1. 修复 `WorldMapTab.tsx:640` — 将 `territory?.previousOwner` 替换为正确的首次攻占判断逻辑：
   - 方案 A: 使用 `territory?.ownership === undefined || territory?.ownership === 'neutral'` 判断
   - 方案 B: 在 `TerritoryData` 接口中添加 `previousOwner` 字段（如果 PRD 要求记录前拥有者）
   - 选择最合适的方案并实现
2. 修复 `siege-task.types.ts:13` — 修正模块导入路径
3. 修复 `CooldownManager.ts:112` — 对齐 `CooldownEntry` 类型定义
4. 运行 `tsc --noEmit` 确认 0 错误

**验证标准**: `tsc --noEmit` 输出 0 错误；`isFirstCapture` 逻辑正确区分首次/重复攻占

**涉及文件**:
- `src/components/idle/panels/map/WorldMapTab.tsx` — previousOwner 修复
- `src/games/three-kingdoms/core/map/siege-task.types.ts` — 模块路径修复
- `src/games/three-kingdoms/engine/map/CooldownManager.ts` — 类型修复

---

#### Task 3: createReturnMarch 单元测试 (P1, Small)

**问题**: `MarchingSystem.test.ts` 的 30 个测试全部覆盖 `createMarch`/`cancelMarch`/`update`/`serialize`，但 `createReturnMarch` 方法零测试覆盖。回城速度 `BASE_SPEED * 0.8` 和路径计算逻辑完全未验证。

**计划**:
1. 在 `MarchingSystem.test.ts`（或新建 `MarchingSystem.return.test.ts`）中添加 `createReturnMarch` 专项测试：
   ```typescript
   describe('createReturnMarch', () => {
     // 场景 1: 基本创建 — 验证返回 MarchUnit 非空
     // 场景 2: 速度验证 — march.speed === BASE_SPEED * 0.8
     // 场景 3: 路径计算 — 路径从 fromCityId 到 toCityId，方向正确
     // 场景 4: siegeTaskId 关联 — march.siegeTaskId 正确保留
     // 场景 5: 无效城市 — fromCityId 不存在时返回 null
     // 场景 6: 不可达城市 — 无路径时返回 null
   });
   ```
2. 每个场景至少 1 个断言验证速度 x0.8

**验证标准**: >= 6 个 createReturnMarch 测试通过；核心断言 `march.speed === BASE_SPEED * 0.8` 存在

**涉及文件**:
- `src/games/three-kingdoms/engine/map/__tests__/MarchingSystem.test.ts` — 扩展测试
  或 `src/games/three-kingdoms/engine/map/__tests__/MarchingSystem.return.test.ts`（新建）

---

#### Task 4: Path B cancelBattle 补充 (P1, Trivial)

**问题**: `cancelBattle` 仅在 Path A (`WorldMapTab.tsx:517-518`) 被调用，Path B (`battle:completed` handler, 行620-690) 完全缺失。通过 `battle:completed` 异步路径完成的攻城任务，其 battle session 未被清理，`SiegeBattleSystem` 可能继续空转。

**计划**:
1. 在 `WorldMapTab.tsx` Path B 的 `advanceStatus('returning')` 之后添加：
   ```typescript
   // 清理战斗会话，防止 SiegeBattleSystem 空转
   if (battleSystem) {
     battleSystem.cancelBattle(task.id);
   }
   ```
2. 确认 Path B 的 `battleSystem` 引用可用（检查变量作用域）
3. 添加测试验证 Path B 的 cancelBattle 被调用

**验证标准**: Path B 的 `cancelBattle` 调用存在；`SiegeBattleSystem.activeBattles` 在 Path B 完成后不包含该 taskId

**涉及文件**:
- `src/components/idle/panels/map/WorldMapTab.tsx` — Path B 添加 cancelBattle

---

### Phase 2: E1-3 行军→攻占完整链路 E2E (Task 5)

#### Task 5: 行军→寻路→精灵移动→到达→攻城事件 E2E (P1, Large)

**问题**: PLAN.md E1-3 — "行军→网格A*寻路→精灵沿道路移动→到达→触发事件" 是 E 系列最后未完成项之一。当前虽有单元测试覆盖各子系统，但缺少从行军创建到攻城触发的端到端集成测试。R9 Challenger 也指出高亮行军路线 E2E 测试覆盖不足。

**计划**:
1. 创建 E2E 集成测试文件 `src/games/three-kingdoms/engine/map/__tests__/integration/march-to-siege-chain.integration.test.ts`
2. 测试场景设计：
   ```typescript
   describe('E1-3: 行军→攻占完整链路', () => {
     // 场景 1: 完整链路 — createMarch → A*寻路 → 路径验证 → update推进 → 到达 → march:arrived事件
     // 场景 2: 行军精灵渲染数据 — 验证 MarchUnit.path / .position / .progress 可供 Canvas 渲染
     // 场景 3: 到达后攻城触发 — march:arrived → SiegeTaskManager.advanceStatus('sieging')
     // 场景 4: 回城完整链路 — 攻城完成 → createReturnMarch → 速度x0.8 → 回到原城 → completed
     // 场景 5: 多城市链路 — A→B攻城成功后，B→C继续攻城，验证无状态污染
     // 场景 6: 中断恢复 — 行军中 cancelMarch → SiegeTaskManager 状态正确回退
   });
   ```
3. 使用真实 EventBus + MarchingSystem + SiegeTaskManager + SiegeBattleSystem 组合
4. 验证完整事件链：`march:created` → `march:updated`(多次) → `march:arrived` → `siege:started` → `battle:completed` → `march:returning` → `march:arrived`(回城)

**验证标准**: >= 6 个 E2E 集成测试通过；完整事件链从行军到回城均有断言

**涉及文件**:
- `src/games/three-kingdoms/engine/map/__tests__/integration/march-to-siege-chain.integration.test.ts`（新建）

---

### Phase 3: I11 行军精灵显示与路线交互 (Task 6)

#### Task 6: 行军精灵 Canvas 渲染 + 路线高亮完善 (P1, Large)

**问题**: PLAN.md I11 — "行军精灵显示与路线交互"（P6阶段）。R9 Task 5 已实现高亮行军路线的基础渲染（`renderHighlightedMarchOverlay`），但 `PixelWorldMap` 的行军精灵渲染需要增强：
- 行军精灵动画（非静态标记，而是沿路径移动的视觉效果）
- 路线高亮与精灵的视觉一致性
- 行军状态（行军中/暂停/到达）的视觉区分

**计划**:
1. 增强 `PixelWorldMap` 的行军精灵渲染（`renderMarchSpritesOverlay` 或等效函数）：
   - **精灵动画**: 基于 `MarchUnit.progress` 在路径上插值位置，每帧移动
   - **精灵样式**: 根据阵营色绘制小旗帜/骑士标记（像素风格）
   - **路线渲染**: 行军路径用虚线绘制（非高亮状态），高亮状态用 R9 Task 5 的金色脉冲线
   - **状态区分**: marching=移动中 / returning=带衰减alpha / arrived=短暂闪烁后消失
2. 在 `PixelWorldMap.defense-bar.test.tsx` 或新建测试中添加行军精灵渲染断言：
   ```typescript
   describe('行军精灵渲染', () => {
     // 场景 1: 活跃行军在路径上显示精灵
     // 场景 2: 精灵位置随 progress 更新
     // 场景 3: 回城行军有不同视觉标记
     // 场景 4: 多个行军同时渲染互不干扰
     // 场景 5: 无活跃行军时不渲染精灵
   });
   ```
3. 与 Task 5 的 E2E 集成测试联动，验证精灵数据可供渲染层消费

**验证标准**: 行军精灵在 Canvas 上随 progress 移动；路线高亮与精灵视觉一致；>= 5 个精灵渲染测试通过

**涉及文件**:
- `src/components/idle/panels/map/PixelWorldMap.tsx` — 精灵渲染增强
- `src/components/idle/panels/map/__tests__/PixelWorldMap.defense-bar.test.tsx` — 扩展测试
  或 `src/components/idle/panels/map/__tests__/PixelWorldMap.march-sprites.test.tsx`（新建）

---

### Phase 4: H7 将领受伤影响战力 (Task 7)

#### Task 7: 受伤将领战力衰减计算 (P2, Medium)

**问题**: PLAN.md H7 — "将领受伤影响战力"（MAP-F06）。当前 `ExpeditionSystem` 有受伤恢复机制（H3）和健康色标记（H4），但受伤将领的战力衰减未集成到攻城战力计算中。轻伤/中伤/重伤将领应分别有战力系数影响攻城结果。

**计划**:
1. 在 `ExpeditionSystem` 中添加受伤战力系数计算：
   ```typescript
   /** 将领受伤对战力的影响系数 */
   getInjuryPowerModifier(injuryLevel: InjuryLevel): number {
     switch (injuryLevel) {
       case 'none': return 1.0;
       case 'light': return 0.8;   // 轻伤: 战力降至80%
       case 'moderate': return 0.5; // 中伤: 战力降至50%
       case 'severe': return 0.2;   // 重伤: 战力降至20%
     }
   }

   /** 计算编队实际战力（含受伤衰减） */
   calculateEffectivePower(force: ExpeditionForce): number {
     const basePower = this.calculateRemainingPower(force);
     const heroModifier = force.generalId
       ? this.getInjuryPowerModifier(this.getHeroInjuryLevel(force.generalId))
       : 1.0;
     return basePower * heroModifier;
   }
   ```
2. 将 `calculateEffectivePower` 集成到攻城战力计算：
   - `SiegeResultCalculator` 使用 `calculateEffectivePower` 替代 `calculateRemainingPower`
   - 攻城确认弹窗显示衰减后战力
3. 添加单元测试：
   ```typescript
   describe('受伤战力衰减', () => {
     // 场景 1: 无伤 → 系数1.0
     // 场景 2: 轻伤 → 系数0.8
     // 场景 3: 中伤 → 系数0.5
     // 场景 4: 重伤 → 系数0.2
     // 场景 5: 编队战力 = 基础战力 * 受伤系数
     // 场景 6: 无将领编队不受影响
   });
   ```

**验证标准**: 受伤将领参与攻城时战力正确衰减；6 个单元测试通过

**涉及文件**:
- `src/games/three-kingdoms/engine/map/ExpeditionSystem.ts` — 战力衰减方法
- `src/games/three-kingdoms/engine/map/__tests__/ExpeditionSystem.casualties.test.ts` — 扩展测试

---

### Phase 5: R9 P2 遗留清理 (Task 8-10)

#### Task 8: originalPath 参数清理 (P2, Trivial)

**问题**: R9 Judge #1 — `createReturnMarch` 的 `originalPath` 参数在函数体内从未被访问，`calculateMarchRoute` 重新计算路径。JSDoc 说"路径为原路反转"与实际不符。

**计划**:
1. 选择方案：保持重新寻路（A*在确定性图上给出确定性路径），移除 `originalPath` 参数
2. 更新 `MarchingSystem.ts` 中 `createReturnMarch` 签名：
   ```typescript
   // 移除 originalPath 参数
   createReturnMarch(params: {
     fromCityId: string;
     toCityId: string;
     troops: number;
     general?: string;
     faction: string;
     siegeTaskId?: string;
   }): MarchUnit | null {
     const route = this.calculateMarchRoute(params.fromCityId, params.toCityId);
     // ...
   }
   ```
3. 更新 `WorldMapTab.tsx` 中两处调用，移除 `originalPath` 传入
4. 更新 JSDoc 注释说明回城使用 A* 重新寻路

**验证标准**: `originalPath` 参数从签名和调用中移除；JSDoc 准确描述行为

**涉及文件**:
- `src/games/three-kingdoms/engine/map/MarchingSystem.ts` — 移除参数
- `src/components/idle/panels/map/WorldMapTab.tsx` — 两处调用更新

---

#### Task 9: 高亮行军路线 E2E 测试 + 城防血条边界修正 (P2, Medium)

**问题**: 两个 R9 Judge P2 问题需一并修复：
- **P2 #5**: 高亮行军路线缺少端到端测试 — 仅验证了按钮回调，`highlightedTaskId` 传递和 Canvas 渲染未验证
- **P2 #7**: 城防血条 `ratio=0.6` 边界值测试名实不符 — 标题说 0.6 但传入 0.6001

**计划**:
1. 为高亮行军路线添加集成测试：
   ```typescript
   describe('高亮行军路线 E2E', () => {
     // 场景 1: highlightedTaskId prop 传递 → Canvas 渲染高亮线
     // 场景 2: 高亮线 ctx.strokeStyle 包含金色 (#FFD700 或 rgba 黄色)
     // 场景 3: 非 marching/returning 状态不渲染高亮
     // 场景 4: highlightedTaskId=null 时不渲染
   });
   ```
2. 修正城防血条边界值测试：
   ```typescript
   // 将 ratio=0.6001 改为 ratio=0.6，断言为黄色
   it('ratio = 0.6 → 黄色 (#ffc107) — 边界值（严格大于，0.6 不算绿色）', () => {
     const anim = makeSiegeAnim({ defenseRatio: 0.6, ... });
     expect(capturedFillStyles).toContain('#ffc107');
   });
   // 添加 ratio=0.61 为绿色
   it('ratio = 0.61 → 绿色 (#4caf50) — 刚超过边界', () => {
     const anim = makeSiegeAnim({ defenseRatio: 0.61, ... });
     expect(capturedFillStyles).toContain('#4caf50');
   });
   ```

**验证标准**: >= 4 个高亮路线 E2E 测试通过；城防血条 ratio=0.6 断言为黄色

**涉及文件**:
- `src/components/idle/panels/map/__tests__/PixelWorldMap.highlight.test.tsx`（新建）
- `src/components/idle/panels/map/__tests__/PixelWorldMap.defense-bar.test.tsx` — 边界值修正

---

#### Task 10: 集成测试回城行军覆盖扩展 (P2, Small)

**问题**: R9 Judge #8 — `execute-siege-path.integration.test.ts` 覆盖到 `cancelBattle` 为止，回城行军创建（`createReturnMarch`）和速度验证未包含。

**计划**:
1. 在 `execute-siege-path.integration.test.ts` 的 Scenario 1（完整生命周期）中扩展：
   ```typescript
   // 扩展：cancelBattle 后创建回城行军
   const returnMarch = marchingSystem.createReturnMarch({
     fromCityId: targetId,
     toCityId: sourceId,
     troops: remainingTroops,
     general: generalId,
     faction: 'wei',
     siegeTaskId: taskId,
   });
   expect(returnMarch).not.toBeNull();
   expect(returnMarch!.speed).toBe(BASE_SPEED * 0.8);
   expect(returnMarch!.siegeTaskId).toBe(taskId);
   ```
2. 添加回城行军到达测试：推进时间至回城行军到达源城市

**验证标准**: 集成测试覆盖从攻城到回城到达的完整链路；回城速度 x0.8 有断言

**涉及文件**:
- `src/games/three-kingdoms/engine/map/__tests__/integration/execute-siege-path.integration.test.ts` — 扩展

---

## 对抗性评测重点

- [ ] **R9 P0 #3 验证**: `WorldMapTab.test.tsx` 全部 33 个测试通过，0 失败
- [ ] **R9 P1 #2 验证**: `MarchingSystem.test.ts` 新增 >= 6 个 `createReturnMarch` 测试，速度 x0.8 断言存在
- [ ] **R9 P1 #4 验证**: Path B (`battle:completed` handler) 中 `cancelBattle` 被调用
- [ ] **R9 P1 #6 验证**: `tsc --noEmit` 输出 0 错误（map-system 相关文件）
- [ ] **E1-3 完整链路**: 行军创建 → A*寻路 → 精灵移动数据 → 到达事件 → 攻城触发 → 回城 → 到达原城，>= 6 个 E2E 测试
- [ ] **I11 精灵渲染**: Canvas 上行军精灵随 progress 移动；路线高亮金色脉冲线；>= 5 个渲染测试
- [ ] **H7 战力衰减**: 受伤将领攻城战力正确衰减（轻伤0.8/中伤0.5/重伤0.2）
- [ ] **originalPath 清理**: 参数从签名和调用中移除，JSDoc 准确
- [ ] **城防血条边界**: ratio=0.6 断言黄色，ratio=0.61 断言绿色
- [ ] **高亮路线 E2E**: highlightedTaskId 传递 + Canvas 渲染验证
- [ ] **回归**: 全量测试套件通过率 >= 99.7%；R9 功能不受影响

## 质量目标

| 指标 | 目标 |
|------|------|
| P0 | 0（R9遗留 1 个 P0 必须修复） |
| P1 | 0（R9遗留 3 个 P1 + E1-3 + I11 必须交付） |
| P2 | <= 2（R9遗留 4 个 P2，至少修复 2 个） |
| 测试通过率 | 100%（含 WorldMapTab.test.tsx） |
| TypeScript错误 | 0（map-system 相关文件） |
| 新增单元测试 | >= 22 场景（createReturnMarch 6 + H7 战力 6 + 边界修正 2 + 精灵渲染 5 + cancelBattle 3） |
| 新增集成测试 | >= 10 场景（E1-3 E2E 6 + 高亮路线 4） |
| R9 P0 修复 | 1/1 完成 |
| R9 P1 修复 | 3/3 完成 |
| R9 P2 修复 | 4/4 完成（全部清理） |
| E1-3 交付 | 行军→攻占完整链路E2E通过 |
| I11 交付 | 行军精灵渲染+路线交互完成 |
| H7 交付 | 受伤战力衰减计算集成 |

## 风险评估

| 风险 | 概率 | 影响 | 缓解措施 |
|------|:----:|:----:|----------|
| WorldMapTab.test.tsx mock 同步复杂度高 | 中 | 高 | 逐个测试分析失败原因，必要时重写整个测试套件的 mock setup |
| I11 精灵渲染与现有攻城动画 Canvas 层冲突 | 低 | 中 | R9 Task 5 已建立高亮渲染层，精灵渲染在现有渲染函数中追加 |
| E1-3 E2E 集成测试需要真实 WorldMapTab 依赖 | 中 | 中 | 仅测试引擎层数据流，UI 层用 mock Canvas 测试 |
| H7 战力衰减影响已有攻城结果计算 | 中 | 高 | 衰减系数需与 PRD 对齐；添加回归测试验证已有结果不受影响 |
| originalPath 移除导致 WorldMapTab 两处调用编译失败 | 低 | 低 | 同步更新两处调用，编译验证 |

## 改进措施（来自R8复盘）

| ID | 措施 | 验收标准 | 状态 |
|----|------|---------|:----:|
| IMP-01 | 新方法激活检查：每个新增 public 方法必须有一个非测试调用点 | createReturnMarch 在 WorldMapTab 中被调用 | ✅ R8已验证 |
| IMP-02 | WorldMapTab React 集成测试基础设施搭建 | 至少 1 个 React 层集成测试覆盖 battle:completed handler | 🔄 R10 Task 1 间接推进 |
| IMP-03 | 双路径结算统一方案设计 | 移除 executeSiege 路径或统一为 SiegeResultCalculator | 🔄 R10 可选推进 |
| IMP-04 | CI 死代码检测引入 | ts-prune/knip 在 CI 中运行，报告未使用导出 | ⬜ 待推进 |

### R10 新增改进措施

| ID | 措施 | 验收标准 |
|----|------|---------|
| IMP-05 | 测试回归检查：每次大规模重构后必须运行全量测试套件 | CI 中 `vitest run` 覆盖所有测试文件，不选择性报告 |
| IMP-06 | TypeScript 编译门禁：每次提交前 `tsc --noEmit` 必须通过 | map-system 相关文件 0 TS 错误 |
| IMP-07 | 边界值测试规范：严格边界值测试必须使用精确值（如 0.6），不能用近似值（0.6001）回避 | 所有边界值测试的输入值与标题描述一致 |
| IMP-08 | 对称路径验证：Path A 和 Path B 的对称逻辑必须同时覆盖测试 | cancelBattle/returnMarch 等在两条路径中均被验证 |

## 与 PLAN.md 对齐

本轮完成后 PLAN.md 预期状态变化：

| 功能 | 当前状态 | R10 预期 |
|------|:--------:|:--------:|
| E1-3 行军→攻占完整链路 | ⬜ | ✅ |
| I11 行军精灵显示与路线交互 | ⬜ | ✅ |
| H7 将领受伤影响战力 | 🔄 | ✅ |
| D3-1 像素地图渲染60fps | 🔄 | 🔄（R10性能基准，R11优化） |
| D3-2 脏标记渲染 | 🔄 | 🔄（同上） |
| E1-4 离线奖励弹窗 | ⬜ | ⬜（R11推进） |
| G4 编队UI组件 | 🔄 | 🔄（R11推进） |
| G5 攻城确认弹窗集成编队 | ⬜ | ⬜（R11推进） |
| H5 攻城结果弹窗伤亡详情 | ⬜ | ✅（R9已完成UI增强，R10修复TS后标记完成） |
| H6 将领受伤状态显示 | ⬜ | ⬜（R11推进） |

### PLAN.md 完成率预期

| 类别 | 当前完成 | R10新增 | R10总计 |
|------|:--------:|:-------:|:-------:|
| A系列 | 6/6 | — | 6/6 |
| B系列 | 7/7 | — | 7/7 |
| C系列 | 2/2 | — | 2/2 |
| D系列 | 10/13 | — | 10/13 |
| E系列 | 4/6 | +1 (E1-3) | 5/6 |
| F系列 | 1/3 | — | 1/3 |
| G系列 | 4/6 | — | 4/6 |
| H系列 | 3/7 | +2 (H5+H7) | 5/7 |
| I系列 | 7/15 | +1 (I11) | 8/15 |
| **总计** | **44/65** | **+4** | **48/65** |

**预期完成率**: 48/65 = 74%（从 68% 提升 6 个百分点）

## 实施优先序

```
Phase 1 — R9 P0/P1 遗留修复（阻塞一切，最高优先）
  Task 1 (P0, Medium)  → WorldMapTab.test.tsx 回归修复
  Task 2 (P1, Small)   → TypeScript 类型错误修复
  Task 3 (P1, Small)   → createReturnMarch 单元测试
  Task 4 (P1, Trivial) → Path B cancelBattle 补充

Phase 2 — E1-3 完整链路（PLAN.md P1 功能，依赖 Phase 1）
  Task 5 (P1, Large)   → 行军→攻占完整链路 E2E 集成测试

Phase 3 — I11 行军精灵（PLAN.md P1 功能，可与 Phase 2 并行）
  Task 6 (P1, Large)   → 行军精灵 Canvas 渲染 + 路线交互

Phase 4 — H7 战力衰减（PLAN.md P2 功能，可与 Phase 3 并行）
  Task 7 (P2, Medium)  → 受伤将领战力衰减计算

Phase 5 — R9 P2 遗留清理（收尾，可与 Phase 4 并行）
  Task 8 (P2, Trivial) → originalPath 参数清理
  Task 9 (P2, Medium)  → 高亮路线 E2E + 城防血条边界修正
  Task 10 (P2, Small)  → 集成测试回城行军覆盖扩展
```

---

*Round 10 计划 | 2026-05-04*
