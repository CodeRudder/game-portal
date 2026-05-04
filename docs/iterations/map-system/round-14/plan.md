# Round 14 计划

> **迭代**: map-system
> **轮次**: Round 14
> **来源**: `PLAN.md` + Round 13 Judge Ruling + Round 13 Report + R10-R13 跨轮趋势
> **日期**: 2026-05-04

## 本轮焦点

> **R14 定位: Integration Phase** — 将 R13 创建的 3 个孤立子系统 (SiegeItemSystem / InjuryUI / SettlementPipeline) 接线到 WorldMapTab, 使其产生用户可感知的价值。

| 优先级 | 领域 | 来源 | 原因 |
|:------:|------|------|------|
| P2 | Task 1: SiegeItemSystem → siege settlement flow 接线 | R13 Judge P2 #1 | 引擎层正确但未接入, 用户无法看到掉落 |
| P2 | Task 2: injuryData/troopLoss → WorldMapTab props 接线 | R13 Judge P2 #2 | UI组件正确但父组件未传递 props |
| P2 | Task 3: SettlementPipeline → 替换 SiegeResultCalculator | R13 Judge P2 #3 | 架构设计正确但未替换旧路径 |
| P1 | Task 4: R13 P2/P1 问题修复 | R13 Judge P1 #5 + P2 #8/#10/#11 | z-order + 掉落断言 + import 位置 + 硬编码替换 |
| P3 | Task 5: PLAN.md 更新 + 剩余功能识别 | R13 Report Section 8 | 完成率追踪 + 后续规划 |

## 对抗性评测重点

- [ ] **SiegeItemSystem 集成**: 攻城胜利后 SiegeResultModal 显示内应信掉落, 掉落物品写入玩家背包
- [ ] **injuryData/troopLoss 接线**: WorldMapTab 正确传递 props, InjuryLevel enum (minor→light) 映射一致
- [ ] **SettlementPipeline 替换**: 旧 SiegeResultCalculator 调用替换完成, 双路径收敛为单路径
- [ ] **集成后回归**: 所有已有 SiegeResultModal / WorldMapTab 测试不回归
- [ ] **z-order 修复**: 同阵营精灵按创建时间排序后批量合并
- [ ] **Builder交付门禁**: 必须报告全部已有测试套件运行结果, 测试总数 >= 2148
- [ ] **TypeScript门禁**: `tsc --noEmit` 零新增错误 (排除 pre-existing PathfindingSystem)

## 质量目标

| 指标 | 目标 |
|------|------|
| P0 | 0 |
| P1 | 0 (修复 R13 遗留 P1 #5 z-order) |
| P2 | <= 3 (R13 遗留 8 个 P2, 本轮至少修复 5 个) |
| 测试通过率 | 100% |
| TS错误 | 0 (排除 pre-existing PathfindingSystem 5 个错误) |
| PLAN.md完成率 | >= 80% (标记 I7/I8/H5/H6 为 ✅, 含集成完成) |
| 内部循环次数 | <= 2 |
| 新增测试用例 | >= 15 (集成测试 10 + 质量修复 5) |

---

## 任务清单

### Task 1: SiegeItemSystem → siege settlement flow 接线 (P2, Medium)

- **来源**: R13 Judge P2 #1, R13 Task 3 引擎层已完成
- **涉及文件**:
  - `src/components/idle/panels/map/WorldMapTab.tsx` — 攻城胜利处理流程
  - `src/components/idle/panels/map/SiegeResultModal.tsx` — 掉落物品显示
  - `src/games/three-kingdoms/engine/map/SiegeItemSystem.ts` — 已有引擎层 (R13)
- **步骤**:
  1. 在 siege settlement flow 中 import SiegeItemSystem
  2. 在攻城胜利回调中调用 `SiegeItemSystem.shouldDropInsiderLetter(taskId, siegeTime)` 判断掉落
  3. 如掉落, 将掉落物品添加到结果数据中 (SiegeResult.itemDrops)
  4. SiegeResultModal 中渲染掉落物品区域 (内应信图标 + 数量 + 获得动画)
  5. 验证掉落物品写入玩家背包 (如有背包系统)
  6. 编写集成测试:
     - 攻城胜利 → 调用 shouldDropInsiderLetter → 结果包含 itemDrops
     - 攻城失败 → 不调用 shouldDropInsiderLetter → 结果无 itemDrops
     - SiegeResultModal 渲染掉落物品
     - 掉落概率与引擎层一致 (20%)
- **验证**:
  - >= 4 个集成测试通过
  - 攻城胜利后 SiegeResultModal 可显示内应信掉落
  - 攻城失败/取消无掉落显示
  - 已有 SiegeItemSystem 17 个引擎测试不回归

### Task 2: injuryData/troopLoss → WorldMapTab props 接线 (P2, Medium)

- **来源**: R13 Judge P2 #2, R13 Task 4 UI 组件已完成
- **涉及文件**:
  - `src/components/idle/panels/map/WorldMapTab.tsx` — 父组件 props 传递
  - `src/components/idle/panels/map/SiegeResultModal.tsx` — 接收 injuryData/troopLoss
  - `src/games/three-kingdoms/engine/map/ExpeditionSystem.ts` — 伤亡输出
- **步骤**:
  1. 梳理 ExpeditionSystem 伤亡输出数据结构 (CasualtyResult)
  2. 将 CasualtyResult 映射为 SiegeResultModal 所需的 injuryData/troopLoss props:
     - `injuryData`: { heroId, injuryLevel (light/medium/severe), recoveryTime }
     - `troopLoss`: { total, byUnit: { infantry, cavalry, archer } }
  3. 修复 InjuryLevel enum mismatch:
     - 引擎层使用 `minor` / `moderate` / `severe`
     - UI 层期望 `light` / `medium` / `severe`
     - 添加映射函数 `mapInjuryLevel(engine): UILevel`
  4. 在 WorldMapTab siege result 处理中传递 injuryData/troopLoss 给 SiegeResultModal
  5. 编写集成测试:
     - WorldMapTab 传递 injuryData 给 SiegeResultModal
     - WorldMapTab 传递 troopLoss 给 SiegeResultModal
     - InjuryLevel 枚举映射正确 (minor→light, moderate→medium, severe→severe)
     - 无伤亡时 injuryData=null, troopLoss=0
- **验证**:
  - >= 4 个集成测试通过
  - SiegeResultModal 正确显示伤亡详情
  - InjuryLevel 枚举映射一致
  - 已有 SiegeResultModal.injury 53 个测试不回归

### Task 3: SettlementPipeline → 替换 SiegeResultCalculator (P2, Medium)

- **来源**: R13 Judge P2 #3/#9/#10/#11, R13 Task 5 架构设计已完成
- **涉及文件**:
  - `src/games/three-kingdoms/engine/map/SettlementPipeline.ts` — 已有 (R13)
  - `src/games/three-kingdoms/engine/map/SiegeResultCalculator.ts` — 被替换目标
  - `src/games/three-kingdoms/engine/map/SiegeRewardProgressive.ts` — 奖励集成
  - `src/components/idle/panels/map/WorldMapTab.tsx` — 调用方
- **步骤**:
  1. 替换 WorldMapTab 中的 `SiegeResultCalculator.calculate()` 调用为 `SettlementPipeline.execute(context)`:
     - 构造 SettlementContext (含战斗结果/伤亡/奖励配置)
     - 调用管道四阶段: validate → calculate → distribute → notify
  2. 移动 SettlementPipeline.ts 的 import 语句到文件顶部 (R13 P2 #10)
  3. 修复 executedPhases 语义 (R13 P2 #9):
     - 从 `string[]` 改为 `{ name: string, status: PhaseStatus, duration: number }[]`
     - 更新相关测试断言
  4. 替换硬编码 reward 值为 SiegeRewardProgressive 集成 (R13 P2 #11):
     - 将 `gold: 100` 替换为 `SiegeRewardProgressive.calculateReward(context)`
     - 将 `reputation: 50` 替换为动态计算值
  5. 编写集成测试:
     - 胜利路径: SettlementPipeline 产出与旧 SiegeResultCalculator 等价结果
     - 失败路径: SettlementPipeline 正确处理 (无奖励, 有伤亡)
     - 取消路径: SettlementPipeline 正确处理 (无结算, 触发回城)
     - SiegeRewardProgressive 集成: 奖励值与渐进式系统一致
- **验证**:
  - >= 4 个集成测试通过
  - 旧 SiegeResultCalculator 调用已替换 (grep 确认 0 处直接调用)
  - executedPhases 包含阶段执行结果
  - reward 值来自 SiegeRewardProgressive (无硬编码)
  - import 语句在文件顶部
  - 已有 SettlementPipeline 12 个测试不回归 (或更新后通过)

### Task 4: R13 P2/P1 问题修复 (P1/P2, Small)

- **来源**: R13 Judge P1 #5 + P2 #8/#10/#11
- **涉及文件**:
  - `src/components/idle/panels/map/PixelWorldMap.tsx` — 批量渲染 z-order
  - `src/games/three-kingdoms/engine/map/__tests__/SiegeItemSystem.test.ts` — 掉落断言
  - `src/games/three-kingdoms/engine/map/SettlementPipeline.ts` — import 位置 + 硬编码 (已在 Task 3 处理)
- **步骤**:
  1. **P1 #5: 批量渲染 z-order 修复**:
     - 在 `renderMarchSpritesOverlay` 批量合并前, 按行军创建时间排序同阵营精灵
     - 确保先创建的精灵在底层, 后创建的精灵在顶层
     - 编写测试: 2 个同阵营精灵重叠时, 后创建者覆盖先创建者
  2. **P2 #8: 掉落概率断言收紧**:
     - 将模拟次数从 100 增加到 500
     - 使用二项分布 95% 置信区间: 500 * 0.2 = 100, sigma = sqrt(500*0.2*0.8) ≈ 8.94
     - 断言范围收紧为 82~118 次 (±2sigma)
  3. **P2 #10/#11: SettlementPipeline import + 硬编码** (已在 Task 3 处理, 此处验证)
     - 确认 import 已移动到文件顶部
     - 确认硬编码已替换为 SiegeRewardProgressive
  4. 编写修复验证测试:
     - z-order 测试 2 个
     - 掉落断言收紧测试 1 个
     - import 位置验证 (代码审查, 非测试)
- **验证**:
  - >= 3 个新增/修改测试通过
  - z-order 正确 (同阵营后创建精灵在上层)
  - 掉落断言 500 次模拟, 82~118 次掉落
  - P1 问题清零

### Task 5: PLAN.md 更新 + 剩余功能识别 (P3, Small)

- **来源**: R13 Report Section 8, PLAN.md 剩余 13 项
- **涉及文件**:
  - `docs/iterations/map-system/PLAN.md` — 更新状态
- **步骤**:
  1. 更新 PLAN.md 功能状态:
     - E1-4: ⬜ → ✅ (R13 Task 1 离线 E2E 完成)
     - D3-1: 🔄 → ✅ (R11 性能基准已建立)
     - D3-2: 🔄 → ✅ (R11 脏标记机制已实现)
     - D3-4: ⬜ → ✅ (R13 Task 2 批量渲染优化完成)
     - I7: ⬜ → ✅ (R13 Task 3 + R14 Task 1 集成完成)
     - I8: ⬜ → ✅ (R13 Task 3 + R14 Task 1 集成完成)
     - H5: ⬜ → ✅ (R13 Task 4 + R14 Task 2 接线完成)
     - H6: ⬜ → ✅ (R13 Task 4 + R14 Task 2 接线完成)
  2. 更新统计表:
     - 已完成: 44 + 8 = 52 → D 系列完成 +2 = 54 → 总计更新
     - 重新计算完成率
  3. 更新迭代轮次规划表 R14 状态
  4. 识别下一批功能项 (R15-R17 规划建议):
     - 优先级排序: E1-3 (行军E2E) / I3 (攻城锁定) / I4 (攻城中断) / I10 (攻占任务面板UI) / I11 (行军精灵交互)
  5. 更新验收标准 (如有新增)
- **验证**:
  - PLAN.md 状态与实际交付一致
  - 完成率计算正确
  - 下一批功能项有明确优先级排序

---

## R13遗留问题追踪

| ID | 问题 | 优先级 | 本轮处理 |
|----|------|:------:|---------|
| R14-1 | SiegeItemSystem 未接入 siege settlement flow | P2 | Task 1 |
| R14-2 | injuryData/troopLoss props 未从 WorldMapTab 传递 | P2 | Task 2 |
| R14-3 | SettlementPipeline 未替换 SiegeResultCalculator | P2 | Task 3 |
| R14-4 | 批量渲染 z-order (同阵营精灵间无排序保证) | P1 | Task 4.1 |
| R14-5 | 掉落概率断言收紧 (15%~25%→更精确) | P2 | Task 4.2 |
| R14-6 | executedPhases 语义修正 | P2 | Task 3.3 |
| R14-7 | SettlementPipeline import 位置修正 | P2 | Task 3.2 |
| R14-8 | 硬编码 reward 替换为 SiegeRewardProgressive | P2 | Task 3.4 |
| R14-9 | InjuryLevel enum mismatch (minor→light) | P2 | Task 2.3 |
| R14-10 | PLAN.md 更新 | P3 | Task 5 |
| R14-11 | 下批功能项识别 | P3 | Task 5.4 |

## 跨轮趋势参考（R10-R13）

| 指标 | R10 | R11 | R12 | R13 | R14目标 |
|------|:---:|:---:|:---:|:---:|:-------:|
| 对抗性发现 | 6 | 11 | 22 | 12 | <= 10 |
| P0问题 | 0 | 0 | 0 | 0 | 0 |
| P1问题 | 2→0 | 4→0 | 0 | 1 | 0 |
| P2问题 | 2 | 5 | 5 | 8 | <= 3 |
| P3问题 | — | — | 8 | 2 | <= 2 |
| 内部循环次数 | 1 | 1 | 1 | 1 | <= 2 |
| PLAN.md完成率 | ~80% | ~80% | ~82% | ~90% | >= 80% (含集成) |
| 测试总数 | ~250+ | ~378+ | ~369 | ~2148 | ~2165+ |
| 跨轮遗留P1 | 0 | 4 | 0 | 1 | 0 |
| 孤立子系统 | 0 | 0 | 0 | 3 | 0 |

> R13 暴露的核心问题: Task 3/4/5 创建了 3 个孤立子系统 (引擎+测试通过但未集成)。R14 定位为 Integration Phase, 专门解决接线问题。R13 遗留 1 个 P1 (z-order) + 8 个 P2, R14 目标: 清零 P1, P2 修复至少 5 个。

## 改进措施（来自R9-R13复盘）

| ID | 措施 | 本轮执行 |
|----|------|---------|
| IMP-01 | Builder交付门禁：必须报告全部已有测试套件运行结果 | 所有Task验证步骤已包含 |
| IMP-02 | TypeScript门禁：每Task完成后运行 `tsc --noEmit` | 所有Task验证步骤已包含 |
| IMP-03 | 双路径结算架构统一 | Task 3: 替换旧路径为 SettlementPipeline |
| IMP-04 | 测试回归检查：每次大规模重构后必须运行全量测试 | 所有Task验证步骤已包含 |
| IMP-05 | 遗留P1优先修复 | Task 4.1: z-order P1 修复 |
| IMP-06 | PLAN.md停滞突破 | Task 5: 更新 8 个功能项状态 |
| IMP-07 (R14新增) | **集成验证门禁**: 每个引擎层 Task 必须包含 "wire to WorldMapTab" 验收步骤 | Task 1/2/3 均包含集成验证 |
| IMP-08 (R14新增) | **孤立子系统检测**: Builder 报告必须声明每个新系统的集成状态 (已集成/待集成/孤立) | Builder 行为清单新增"集成状态"列 |

---

## 预期PLAN.md更新

| ID | 当前状态 | 预期状态 | 依据 |
|----|---------|---------|------|
| E1-4 | ⬜ | ✅ | R13 Task 1 完成 |
| D3-1 | 🔄 | ✅ | R11 已完成 (同步更新) |
| D3-2 | 🔄 | ✅ | R11 已完成 (同步更新) |
| D3-4 | ⬜ | ✅ | R13 Task 2 完成 |
| I7 | ⬜ (引擎✅) | ✅ | R14 Task 1 集成完成 |
| I8 | ⬜ | ✅ | R14 Task 1 集成完成 |
| H5 | ⬜ | ✅ | R14 Task 2 接线完成 |
| H6 | ⬜ | ✅ | R14 Task 2 接线完成 |

> 预期完成率: 44(原) + 8(本轮更新) = 52/65 = **~80%**
>
> 注: D3-1/D3-2 实际已在 R11 完成, 本轮同步更新 PLAN.md 状态。考虑 D 系列原完成 10 项, 新增 D3-1/D3-2/D3-4 后 D 系列完成 13/13 = 100%。

## 实施优先序

```
Phase 1 — R13 孤立子系统接线 (核心价值)
  Task 1 (P2, Medium)  → SiegeItemSystem → siege settlement flow
  Task 2 (P2, Medium)  → injuryData/troopLoss → WorldMapTab props
  Task 3 (P2, Medium)  → SettlementPipeline → 替换 SiegeResultCalculator

Phase 2 — R13 遗留问题修复 (依赖 Phase 1)
  Task 4 (P1/P2, Small) → z-order + 掉落断言 + import/硬编码验证

Phase 3 — 文档与规划 (弹性范围)
  Task 5 (P3, Small)    → PLAN.md 更新 + 下批功能识别
```

## 风险评估

| 风险 | 概率 | 影响 | 缓解措施 |
|------|:----:|:----:|----------|
| SettlementPipeline 替换旧路径引入回归 | 中 | 高 | Task 3 编写等价性测试, 确保新路径产出与旧路径一致; grep 确认旧调用已移除 |
| InjuryLevel enum 映射不一致导致运行时错误 | 低 | 中 | Task 2.3 集中映射函数, 统一为一处转换; 添加 TypeScript 联合类型保护 |
| 批量渲染 z-order 修复影响性能 | 低 | 低 | Task 4.1 排序操作为 O(n log n), 精灵数量通常 <100, 性能影响可忽略 |
| WorldMapTab 接线修改影响已有攻城流程 | 中 | 高 | 逐属性接线, 每次接线后运行全量回归测试; 使用 feature flag 控制新功能开关 |
| R13 遗留 8 个 P2 无法在本轮全部修复 | 低 | 低 | Task 4 处理高优先 P2, 剩余低优先 P2 可推入 R15 |

---

## R13交付总结（参考）

| 类别 | R13完成 | R14目标 |
|------|---------|---------|
| Task 1 (E1-4 离线E2E) | 28 测试通过 | 集成验证 |
| Task 2 (D3-4 批量渲染) | 18+56 测试通过, 98.8% drawCall减少 | z-order 修复 |
| Task 3 (I7/I8 道具) | 17 测试通过, 引擎层完成 | 接线到 siege settlement flow |
| Task 4 (H5/H6 伤亡UI) | 53 测试通过, UI组件完成 | 接线到 WorldMapTab |
| Task 5 (结算架构) | 12 测试通过, 设计+初始实现 | 替换旧路径 |
| Task 6 (P3质量) | 5 测试通过 | 验证+收紧 |
| 孤立子系统 | 3 个 | 0 个 (全部接线) |
| P0 | 0 | 0 |
| P1 | 1 (z-order) | 0 |
| P2 | 8 | <= 3 |
| PLAN.md完成率 | ~90% (含待集成) | ~80% (含集成完成, 52/65) |
| 测试总数 | ~2148 | ~2165 |

---

*Round 14 迭代计划 | 2026-05-04*
