# Round 9 迭代报告

> **日期**: 2026-05-04
> **迭代周期**: 第9轮 — executeSiege集成测试 + 城防血条渲染 + 攻占面板实时追踪 + 行军路线高亮 + 伤亡详情增强
> **内部循环次数**: 2

## 1. 对抗性评测发现

### Builder 行为清单
| ID | 功能 | 预期行为 | 假设 | 状态 |
|----|------|---------|------|:----:|
| R9-1 | createReturnMarch 回城速度 x0.8 | createReturnMarch() 速度 = BASE_SPEED * 0.8 | calculateMarchRoute 可用 | PASS |
| R9-2 | executeSiege 同步路径集成测试 | Path A 完整生命周期测试：createBattle -> executeSiege -> setResult -> advanceStatus -> cancelBattle | SiegeBattleSystem + SiegeTaskManager 可组合 | PASS |
| R9-3 | PixelWorldMap 城防血条渲染 (I5) | battle 阶段 Canvas 渲染城防血条：绿(>0.6) -> 黄(0.3~0.6) -> 红(<0.3) | CanvasRenderingContext2D 可 mock | PASS |
| R9-4 | SiegeTaskPanel 实时状态追踪 (I10) | defenseRatios 驱动攻城进度条 + returnETAs 驱动回城 ETA + 已完成折叠 | WorldMapTab 数据管道可用 | PASS |
| R9-5 | SiegeTaskPanel 点击聚焦行军路线 | 点击"聚焦路线"按钮 -> 地图居中 + 高亮行军路线 | PixelWorldMap 接口可扩展 | PASS |
| R9-6 | SiegeResultModal 伤亡详情增强 (H5) | 5 级结果等级 + 伤亡健康色 + 将领恢复时间 + 奖励倍率 | SiegeResultCalculator 输出格式已知 | PASS |
| R9-7 | cancelBattle 调用 (R8 遗留) | Path A setResult + advanceStatus 后 cancelBattle 清理战斗会话 | SiegeBattleSystem.cancelBattle 可用 | PASS |
| R9-8 | getForceHealthColor 边界值 (R8 遗留) | 0.30=healthy, 0.31=damaged, 0.60=damaged, 0.61=critical | 严格大于语义正确 | PASS |

> Builder 声称 7 个测试套件 211 个用例全部通过。

### Challenger 攻击结果
| ID | 攻击维度 | 攻击方式 | 结果 | Judge判定 |
|----|---------|---------|------|----------|
| P0-1 | 功能/死代码 | `createReturnMarch()` 的 `originalPath` 参数被接受但从未在函数体中使用，JSDoc "路径为原路反转" 描述不实 | 参数确实未使用，重新调用 calculateMarchRoute | P0→P2 降级 |
| P0-2 | 测试覆盖/幻觉 | `MarchingSystem.test.ts` 30 个测试无任何 `createReturnMarch` 相关测试，速度 x0.8 零覆盖 | 单元测试确实缺失 | P0→P1 降级 |
| P0-3 | 集成断裂/回归 | R9 修改引入 `WorldMapTab.test.tsx` 2 个回归失败（行军触发 + 攻城动画），git stash 回退后 33/33 通过 | Mock 未同步更新 | P0 维持 |
| P1-1 | 功能/遗漏 | Path B (`battle:completed` handler) 缺少 `cancelBattle` 调用，战斗会话可能泄漏 | 仅 Path A 有 cancelBattle | P1 维持 |
| P1-2 | 测试覆盖 | 高亮行军路线仅测试按钮回调，Canvas 渲染和状态传递未验证 | 端到端链路未覆盖 | P1→P2 降级 |
| P1-3 | 类型安全 | R9 引入 TS 错误：`TerritoryData` 无 `previousOwner` 属性、`siege-task.types.ts` 模块导入失败、`CooldownManager` 类型不匹配 | `tsc --noEmit` 确认 3 个 R9 相关错误 | P1 维持 |
| P2-1 | 测试质量 | 城防血条 ratio=0.6 边界值测试标题写 0.6 但实际传入 0.6001，回避真正边界值 | 注释承认 "0.6 is NOT green" | P2 维持 |
| P2-2 | 测试覆盖 | `execute-siege-path.integration.test.ts` 不覆盖回城行军创建阶段 | 集成测试在 cancelBattle 处截断 | P2 维持 |

### Judge 综合评定
| ID | 严重度 | 可复现 | 根因 | 建议 |
|----|:------:|:------:|------|------|
| P0-1→P2 | P2 | 是 | `originalPath` 参数被声明但函数体使用 `calculateMarchRoute` 重新寻路，完全忽略原路反转设计意图。功能本身正常，属于死代码/接口冗余 | 移除未使用参数或实现原路反转逻辑，更正 JSDoc |
| P0-2→P1 | P1 | 是 | `MarchingSystem.test.ts` 中 `createReturnMarch` 搜索结果为 0，速度 x0.8 和路径计算无单元测试覆盖。功能在 WorldMapTab 中可用 | 为 createReturnMarch 补充专项单元测试 |
| P0-3 | P0 | 是 | R9 commit `e22dcf90` 重构 WorldMapTab.tsx (+701行/-112行) 但未同步更新测试 mock，导致行军触发和攻城动画测试断裂 | 同步更新测试 mock 以匹配重构后交互流程 |
| P1-1 | P1 | 是 | Path B (`battle:completed` handler 行625-695) 无 `cancelBattle` 调用，仅 Path A (行517-518) 有。战斗会话依赖隐式超时清理不可靠 | 在 Path B advanceStatus 后添加 cancelBattle |
| P1-2→P2 | P2 | 是 | 功能代码链路完整（SiegeTaskPanel -> WorldMapTab -> PixelWorldMap），但 Canvas 渲染和状态传递无测试。属测试质量而非功能缺陷 | 补充端到端集成测试 |
| P1-3 | P1 | 是 | `TerritoryData` 接口不含 `previousOwner`，行640 访问不存在属性导致 `isFirstCapture` 永远为 `true`，影响奖励计算。另有 2 个 TS 错误 | 修正类型访问，使用 `ownership` 或有效属性判断首次攻占 |
| P2-1 | P2 | 是 | 测试标题 "ratio=0.6→绿色" 但实际传入 0.6001，严格大于语义下 0.6 应走黄色分支 | 修正测试标题或添加真正的 ratio=0.6→黄色 测试 |
| P2-2 | P2 | 是 | 集成测试覆盖到 cancelBattle 为止，未验证回城行军创建和速度 x0.8 | 扩展集成测试覆盖回城阶段 |

## 2. 修复内容
| ID | 对应问题 | 文件:行 | 修复方式 | 影响 |
|----|---------|---------|---------|------|
| F-01 | R8 P1-3 | `execute-siege-path.integration.test.ts` (新) | 创建 5 大场景集成测试（完整生命周期/伤亡公式对比/胜利路径/失败路径/cancelBattle清理）共 20 用例 | Path A 核心链路验证 |
| F-02 | PLAN.md I5 | `PixelWorldMap.tsx:500-531` | 实现城防血条渲染：barWidth = ts*3，颜色 ratio>0.6 绿/0.3~0.6 黄/<0.3 红 + 百分比文本 | 城防可视化 |
| F-03 | PLAN.md I5 | `PixelWorldMap.defense-bar.test.tsx` (新) | 创建 20 个 Canvas 渲染测试（无攻城/battle阶段/宽度比例/颜色过渡/completed不渲染/assembly不渲染/文本样式） | I5 测试覆盖 |
| F-04 | PLAN.md I10 | `SiegeTaskPanel.tsx` 全文重写 | 实现实时进度条 (defenseRatios 驱动) + 回城 ETA (returnETAs 驱动) + 已完成折叠 (MAX_COMPLETED_TASKS=5) | I10 功能交付 |
| F-05 | PLAN.md I10 | `SiegeTaskPanel.test.tsx` (新) | 创建 41 个 UI 测试（多状态渲染/进度/ETA/折叠/聚焦回调/边界/异常） | I10 测试覆盖 |
| F-06 | PLAN.md I10 | `WorldMapTab.tsx` handleFocusMarchRoute + highlightedTaskId | 点击聚焦按钮 -> setHighlightedTaskId + setSelectedId + dispatch map-center 事件 | 行军路线高亮交互 |
| F-07 | PLAN.md I10 | `PixelWorldMap.tsx` renderHighlightedMarchOverlay | 脉冲金色线 + 起终点标记（绿起点/红终点） + 半透明黄色外发光 | 行军路线高亮渲染 |
| F-08 | PLAN.md H5 | `SiegeResultModal.tsx` 增强 | 5 级结果等级 badge (OUTCOME_CONFIG) + 伤亡健康色条 (getCasualtyHealthColor) + 将领恢复时间 + 奖励倍率标签 | 伤亡详情 UI |
| F-09 | PLAN.md H5 | `SiegeResultModal.test.tsx` (新) | 创建 38 个 UI 测试（5 种 outcome/健康色/恢复时间/奖励倍率/向后兼容） | H5 测试覆盖 |
| F-10 | R8 P2-2 | `WorldMapTab.tsx:517-519` Path A | setResult + advanceStatus 后调用 cancelBattle 清理战斗会话 | 停止战斗引擎空转 |
| F-11 | R8 P2-1 | `ExpeditionSystem.casualties.test.ts` | 修正测试标题 "0.30 损失→healthy"，补充边界值覆盖 | 消除注释误导 |

## 3. 内部循环记录
| 子轮次 | 发现 | 修复 | 剩余P0 | 剩余P1 | 备注 |
|--------|:----:|:----:|:------:|:------:|------|
| 9.1 | 8 (Challenger) → 1 P0 + 3 P1 + 4 P2 | 0 (待修复) | 1 | 3 | Judge 将 P0-1 降为 P2，P0-2 降为 P1 |
| 9.2 | 0 (修复验证) | 3 并行修复 (P0/P1/P2) | 0 | 0 | 3 个并行 fix agent，全部修复完毕 |
| **合计** | **8** | **3** | **0** | **0** | 2 子轮完成 |

### P0 修复详情 — WorldMapTab.test.tsx 回归 (Fix Agent A)

**问题**: R9 重构 WorldMapTab.tsx 改变了行军交互和攻城流程，但未同步更新测试 mock，导致 2 个测试失败。

**修复**:
```typescript
// WorldMapTab.test.tsx — 更新 mock 以匹配 R9 重构后的交互流程
// 1. mock 改用 marchingSystemRef.current（而非直接 mock marchingSystem）
// 2. 测试改为 async，模拟 march:arrived 事件携带 siegeTaskId
// 结果: 33/33 tests passing
```

### P1 修复详情 — 多项问题 (Fix Agent B)

**问题**: 3 个 P1 问题 — createReturnMarch 零测试、Path B 缺 cancelBattle、TS 类型错误。

**修复**:
```typescript
// 1. MarchingSystem.test.ts — 新增 5 个 createReturnMarch 专项测试
//    - 验证回城速度 = BASE_SPEED * 0.8
//    - 验证 siegeTaskId 关联
//    - 验证路径计算
//    - 验证 originalPath 参数处理
//    - 验证与 createMarch 的差异
//    结果: 35/35 tests passing (原30 + 新增5)

// 2. WorldMapTab.tsx Path B (battle:completed handler)
//    在 advanceStatus('returning') 之后添加:
siegeBattleSystemRef.current?.cancelBattle(task.id);

// 3. WorldMapTab.tsx — 修复 TS 类型错误
//    territory?.previousOwner → territory?.ownership 检查首次攻占
// 4. siege-task.types.ts — 修正导入路径
// 5. CooldownManager.ts — 修正 CooldownEntry 类型
```

### P2 修复详情 — 代码质量 (Fix Agent C)

**问题**: 4 个 P2 问题 — originalPath 死代码、测试标题误导、集成测试不覆盖回城。

**修复**:
```typescript
// 1. MarchingSystem.ts — 移除 createReturnMarch 的 originalPath 参数
//    函数签名简化，JSDoc 更正为 "重新计算路径"

// 2. PixelWorldMap.defense-bar.test.tsx — 修正边界值测试
//    - 原: it('ratio = 0.6 → 绿色 — 边界值', ...) // 实际用 0.6001
//    - 新: it('ratio = 0.6001 → 绿色 (#4caf50)', ...) // 标题准确
//    - 新增: it('ratio = 0.6 → 黄色 (#ffc107) — 严格大于边界', ...)
//    结果: 21/21 tests passing

// 3. execute-siege-path.integration.test.ts — 新增 Scenario 6 (4 个测试)
//    - 回城行军创建验证
//    - 回城速度 = BASE_SPEED * 0.8 验证
//    - 回城行军路径来源验证
//    - 完整链路 siege -> battle -> return march 验证
//    结果: 24/24 tests passing (原20 + 新增4)
```

## 4. 测试结果
| 测试套件 | 通过 | 失败 | 跳过 |
|----------|:----:|:----:|:----:|
| MarchingSystem.test.ts | 35 | 0 | 0 |
| execute-siege-path.integration.test.ts | 24 | 0 | 0 |
| PixelWorldMap.defense-bar.test.tsx | 21 | 0 | 0 |
| SiegeTaskPanel.test.tsx | 41 | 0 | 0 |
| SiegeResultModal.test.tsx | 38 | 0 | 0 |
| ExpeditionSystem.casualties.test.ts | 31 | 0 | 0 |
| WorldMapTab.test.tsx | 33 | 0 | 0 |
| **R9 修复后总计** | **223** | **0** | **0** |

> 注: Builder 初始报告 211 个用例（7 套件），修复后新增 12 个用例（5 createReturnMarch + 4 回城集成 + 2 边界值 + 1 修正），总计 223 个用例全部通过。WorldMapTab.test.tsx 回归修复后 33/33 通过。

## 5. 架构审查结果
| 检查项 | 状态 | 问题描述 |
|--------|:----:|----------|
| 依赖方向 | PASS | Engine -> EventBus -> UI 单向依赖，PixelWorldMap/SiegeTaskPanel 通过 props 接收数据 |
| 层级边界 | PASS | 城防血条渲染在 PixelWorldMap UI 层，进度计算在 SiegeTaskPanel 层，数据来源在 WorldMapTab 粘合层 |
| 类型安全 | WARN | R9 引入 3 个 TS 错误（previousOwner、导入路径、CooldownEntry），修复后已清除 |
| 数据流 | PASS | defenseRatiosMap 从 siegeBattleAnimRef 提取，returnETAsMap 从 marchingSystem 提取，highlightedTaskId 通过 useState 管理 |
| 事件总线 | PASS | map-center CustomEvent 用于视窗居中，battle:completed 事件链已验证 |
| 死代码 | PASS | originalPath 参数已移除，createReturnMarch 已激活并在两处调用 |
| 生命周期 | PASS | cancelBattle 在 Path A 和 Path B 均已调用，战斗会话清理完整 |

## 6. 回顾(跨轮趋势)
| 指标 | R1 | R2 | R3 | R4 | R5 | R5c | R5d | R5e | R6 | R7 | R8 | R9 | 趋势 |
|------|:--:|:--:|:--:|:--:|:--:|:---:|:---:|:--:|:--:|:--:|:--:|:--:|:----:|
| 测试通过率 | 100% | 100% | 100% | 100% | ~100% | 99.9% | 100% | 100% | 100% | 99.9% | 99.7% | 100% | → RECOVER |
| P0问题 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 2 | 0 | 1→0 | → |
| P1问题 | 0 | 0 | 0 | 0 | 0 | 2 | 0 | 0 | 0 | 3 | 2→0 | 3→0 | → |
| 对抗性发现 | 1 | 0 | 0 | - | - | 10 | 7 | 6 | 7 | 9 | 8 | 8 | → |
| 内部循环次数 | 1 | 1 | 1 | 1 | - | 1 | 2 | 1 | 1 | 2 | 1 | 2 | → |
| 架构问题 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1(WARN) | 2(WARN) | 1(WARN) | ↓ |
| 新增测试用例 | 20 | 11 | 9 | - | - | 27 | 27 | 0 | 66 | 75 | 170 | 12(net) | → |
| 预存失败 | 0 | 0 | 0 | 0 | 0 | 2 | 0 | 0 | 2 | 2 | 2 | 0 | ↓ CLEARED |
| PLAN.md 完成率 | - | - | - | - | - | - | - | - | - | 62% | 68% | 74% | ↑ |

> 关键指标：R9 对抗性发现 8 个问题（与 R8 持平），Challenger 首次发现回归缺陷（P0-3）。3 个并行 fix agent 在子轮 9.2 完成全部修复。测试通过率恢复 100%。PLAN.md 完成率从 68% 提升至 74%，完成 I5（城防血条）、I10（攻占面板+聚焦路线）、H5（伤亡详情增强）三个功能项。

## 7. 剩余问题(移交下轮)
| ID | 问题 | 优先级 | 来源 | 备注 |
|----|------|:------:|------|------|
| R10-1 | 高亮行军路线端到端集成测试 | P2 | P1-2→P2 | WorldMapTab -> PixelWorldMap highlightedTaskId 传递 + Canvas 渲染断言未覆盖 |
| R10-2 | 双路径结算架构统一 | P2 | R8 P0-2→P2 (DEFERRED) | executeSiege 与 SiegeResultCalculator 双路径需统一为单一结算路径 |
| R10-3 | PathfindingSystem TS 错误 | P3 | Pre-existing | 5 个 WalkabilityGrid 相关错误，非 R9 引入 |
| R10-4 | PLAN.md 剩余功能项 | P2 | PLAN.md | E1-3, E1-4, D3-1, D3-2, D3-4, I3, I4, I5(UI), I7, I8, I10(UI), I11 待实施 |
| R10-5 | PLAN.md 测试轮次 | P2 | PLAN.md | R11-R27 测试轮次待执行 |

## 8. 下轮计划
> 详见 `docs/iterations/map-system/round-10/plan.md`

> 重点方向：(1) 高亮行军路线 E2E 集成测试补充 (P2)；(2) 双路径结算架构统一设计 (P2)；(3) 推进 PLAN.md 剩余功能项 (E1-3, E1-4, D3-1 等)。

## 9. 复盘（每3轮，当 N % 3 == 0 时）

### 9.1 趋势分析（近3轮: R7, R8, R9）
| 指标 | R7 | R8 | R9 | 趋势 | 分析 |
|------|:--:|:--:|:--:|:----:|------|
| 对抗性发现 | 9 | 8 | 8 | → | 稳定在 8-9 个，Challenger 覆盖面稳定 |
| P0问题 | 2 | 0 | 1→0 | → | R9 出现回归缺陷但子轮内修复，P0 均未流出 |
| P1问题 | 3→0 | 2→0 | 3→0 | → | 连续 3 轮 P1 在子轮内全部清除 |
| 修复数 | 2 | 3 | 3 | → | 并行 fix agent 模式有效（R8 引入，R9 验证） |
| 内部循环次数 | 2 | 1 | 2 | → | R9 因回归缺陷增加一个子轮，属正常波动 |
| 新增测试用例 | 75 | 170 | 12(net) | ↓ | R9 以修复和 UI 增强为主，净增测试较少 |
| 测试通过率 | 99.9% | 99.7% | 100% | ↑ RECOVER | 预存 HeroStarSystem 失败未复发，R9 恢复 100% |
| PLAN.md 完成率 | 62% | 68% | 74% | ↑ | 稳定推进，每轮约 6% 增量 |

### 9.2 流程改进
| 项目 | 做得好 | 可改进 | 改进措施 |
|------|--------|--------|----------|
| 并行修复 | 3 个 fix agent 并行执行（P0/P1/P2 分组），子轮内全部修复完毕，效率极高 | P0 修复（回归测试）与其他修复存在依赖关系，串行可能更安全 | 并行修复时确保 fix agent 之间无文件冲突，若存在共享文件则串行执行 |
| 对抗性评测 | Challenger 首次发现回归缺陷（P0-3 WorldMapTab.test.tsx），通过 git stash 对比确认 R9 引入 | Builder 刻意回避 WorldMapTab.test.tsx 运行结果，存在选择性报告嫌疑 | Builder 必须报告全部测试套件结果（含已有套件），Challenger 增加回归检查维度 |
| UI 功能验证 | Task 4/5/6 的 UI 组件测试分别达 41/41/38 个，覆盖充分 | Canvas 渲染层（renderHighlightedMarchOverlay）无 E2E 测试 | 对 Canvas 渲染函数补充 snapshot 或 ctx 调用断言测试 |
| TypeScript 安全 | R8 报告零 TS 错误 | R9 引入 3 个 TS 错误（previousOwner 等），在 Challenger 检查后才修复 | Builder 在每个 Task 完成后运行 `tsc --noEmit`，作为交付门禁 |

### 9.3 工具/方法改进
| 改进项 | 当前方式 | 建议方式 | 预期效果 |
|--------|---------|---------|----------|
| 回归检测 | Challenger 手动运行已有测试套件 | Builder 交付清单必须包含"已有测试套件运行结果" | 避免选择性报告，回归缺陷在 Builder 阶段即暴露 |
| TypeScript 门禁 | 无自动检查 | Builder 在交付前运行 `tsc --noEmit`，零错误才能提交 | 防止 TS 错误流入对抗性评测 |
| 并行修复冲突检测 | 人工判断 fix agent 是否冲突 | 建立文件冲突矩阵，并行修复前自动检测共享文件 | 避免并行修复引入合并冲突 |
| 死代码参数检测 | Challenger 函数体逐行审查 | ESLint `no-unused-vars` 规则 + TypeScript strict 模式 | 自动检测未使用参数 |

### 9.4 改进措施（列入下轮计划）
| ID | 改进措施 | 负责 | 验收标准 |
|----|---------|------|---------|
| IMP-01 | Builder 交付门禁：必须报告全部已有测试套件运行结果（含 R9 之前的套件） | Builder | Builder manifest 包含 WorldMapTab.test.tsx 等已有套件的结果 |
| IMP-02 | TypeScript 门禁：Builder 每完成一个 Task 运行 `tsc --noEmit` | Builder | 交付时零 TS 错误（排除 pre-existing PathfindingSystem） |
| IMP-03 | 高亮行军路线 E2E 集成测试 | Builder | 至少 1 个测试覆盖 WorldMapTab -> PixelWorldMap highlightedTaskId 传递 |
| IMP-04 | 双路径结算架构统一方案 | Builder | 移除 executeSiege 路径或统一为 SiegeResultCalculator 单一路径 |

---

*Round 9 迭代报告 | 2026-05-04*
