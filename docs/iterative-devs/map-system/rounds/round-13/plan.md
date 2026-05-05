# Round 13 计划

> **迭代**: map-system
> **轮次**: Round 13
> **来源**: `PLAN.md` + Round 12 `judge-ruling.md` + Round 12 `builder-manifest.md` + R10-R12 跨轮趋势
> **日期**: 2026-05-04

## 本轮焦点

| 优先级 | 领域 | 来源 | 原因 |
|:------:|------|------|------|
| P2 | Task 7: E1-4 离线→上线→奖励弹窗E2E | PLAN.md E1-4 (MAP-F10~F12) | R12 Phase 4 未交付，离线系统端到端闭环，R10/R11/R12均未推进 |
| P2 | Task 8: D3-4 行军精灵批量渲染优化 | PLAN.md D3-4 | R12 Phase 4 未交付，性能优化收尾项 |
| P2 | Task 9: I7/I8 内应信掉落+道具获取 | PLAN.md I7 (MAP-F08-01) + I8 (MAP-F06-03) | R12 Phase 4 未交付，攻城流程道具系统闭环 |
| P2 | Task 10: H5/H6 伤亡/将领受伤UI | PLAN.md H5/H6 | R12 Phase 4 未交付，R9已实现SiegeResultModal伤亡详情基础版 |
| P2 | R12遗留P2修复: 双路径结算架构统一 | R10 DEFERRED, R12 DEFERRED | 连续3轮( R10/R11/R12 )延期，本轮必须启动 |
| P3 | R12遗留P3改善(选择性) | R12 Judge Ruling | 8项P3中选择性修复高价值项 |

## 对抗性评测重点

- [ ] **E1-4 离线链路**: 离线时长计算 → 奖励生成 → 弹窗 → 领取 → 资源增量，>= 5 个集成测试场景
- [ ] **D3-4 批量渲染**: 50精灵场景 drawCall 数较优化前减少 >= 30%，无视觉回归
- [ ] **I7 内应信掉落**: 攻城胜利 20% 概率掉落，确定性随机种子，>= 5 个测试
- [ ] **I8 道具获取**: 夜袭令/内应信商店获取途径，道具消耗校验，>= 3 个测试
- [ ] **H5 伤亡详情增强**: 将领受伤状态图标(轻伤/中伤/重伤颜色编码)，恢复倒计时
- [ ] **H6 将领受伤UI**: 将领选择面板受伤标记，受伤将领不可选，恢复进度条
- [ ] **双路径结算**: 统一架构方案设计文档 + 至少1个引擎层重构实现
- [ ] **Builder交付门禁**: 必须报告全部已有测试套件运行结果（含R12之前套件），测试总数 >= 369
- [ ] **TypeScript门禁**: `tsc --noEmit` 零错误（排除pre-existing PathfindingSystem 5个错误）

## 质量目标

| 指标 | 目标 |
|------|------|
| P0 | 0 |
| P1 | 0 |
| P2 | <= 2（R12遗留0个P2 + 本轮新增，至少清除4个功能缺口） |
| 测试通过率 | 100% |
| TS错误 | 0（排除pre-existing PathfindingSystem 5个错误） |
| PLAN.md完成率 | >= 90%（当前~82%，目标新增E1-4/D3-4/I7/I8/H5/H6） |
| 内部循环次数 | <= 2 |
| 新增测试用例 | >= 35（E1-4 离线 5 + D3-4 渲染 5 + I7/I8 道具 8 + H5/H6 UI 8 + 双路径 3 + P3改善 6） |

---

## 任务清单

### Task 1: E1-4 离线→上线→奖励弹窗→资源更新 E2E (P2, Large)

- **来源**: PLAN.md E1-4 (MAP-F10~F12), R12 Task 7 未交付
- **涉及文件**:
  - `src/games/three-kingdoms/engine/map/OfflineRewardSystem.ts` 或相关离线系统 — 离线奖励计算
  - `src/components/idle/panels/map/` 离线奖励弹窗组件 — 弹窗UI
  - `src/games/three-kingdoms/engine/map/ResourceSystem.ts` 或资源管理 — 资源更新
  - 新增: `src/games/three-kingdoms/engine/map/__tests__/integration/offline-e2e.integration.test.ts`
- **步骤**:
  1. 梳理已有离线系统实现：
     - C1/C2已在R6完成(离线奖励弹窗+产出管理面板)
     - 确认离线奖励计算逻辑位置和数据结构
     - 确认离线时长存储机制（localStorage / state / save data）
     - 确认领土产出数据源
  2. 设计离线端到端测试场景：
     - **场景1: 正常离线奖励** — 离线8小时 → 上线 → 弹窗显示奖励 → 领取 → 资源增量 = 领土产出 * 8h
     - **场景2: 离线时间过短** — 离线5分钟 → 无弹窗或最低奖励
     - **场景3: 离线时间过长** — 离线72小时 → 奖励封顶（如有上限机制）
     - **场景4: 多资源类型** — 领土产出粮草/金币/元宝等多种资源分别计算
     - **场景5: 领土变化影响** — 离线期间领土被占 → 产出按实际占领时间计算
  3. 实现测试基础设施：
     - 创建 `offline-e2e.integration.test.ts`，使用真实 EventBus（非mock）
     - 模拟时间流逝（`vi.useFakeTimers()`）替代 `Date.now()` 依赖
     - 构造领土数据、产出配置、玩家资源快照
  4. 验证离线时长计算精度（秒级）
  5. 验证弹窗UI数据与实际奖励数据一致
  6. 验证领取后资源增量精确匹配（无浮点误差）
- **验证**:
  - >= 5 个端到端集成测试通过
  - 离线时长计算误差 < 1秒
  - 资源增量精确到整数
  - 弹窗数据与计算数据一致
  - `tsc --noEmit` 零新增错误

### Task 2: D3-4 行军精灵批量渲染减少drawCall (P2, Medium)

- **来源**: PLAN.md D3-4, R12 Task 8 未交付
- **涉及文件**:
  - `src/components/idle/panels/map/PixelWorldMap.tsx` — renderMarchSpritesOverlay优化
  - `src/components/idle/panels/map/__tests__/PixelWorldMap.perf.test.tsx` — 性能对比基准
- **步骤**:
  1. 分析当前 `renderMarchSpritesOverlay` 的drawCall模式：
     - 每个精灵独立调用 `fillRect`/`arc` → N个精灵 = N * k 次drawCall
     - 识别可批量化的操作（同色精灵合并、路径批量绘制等）
     - 使用现有 mock Canvas 的 `fillStyle` 设置次数作为 drawCall 代理指标
  2. 实现批量渲染优化：
     - **方案A（推荐）: 同色批量** — 将同阵营精灵的 `fillRect` 调用合并为一个 `beginPath` + 多个 `rect` + 一个 `fill`
     - **方案B（备选）: 离屏Canvas预渲染** — 将静态精灵图预渲染到离屏Canvas，主Canvas直接 `drawImage`
     - **方案C（备选）: 路径合并** — 同路线的多精灵共享一次 `setLineDash` + `stroke` 调用
  3. 建立优化前后性能对比基准：
     - 10精灵场景 drawCall数对比
     - 50精灵场景 drawCall数对比
     - 100精灵场景 drawCall数对比（压力测试）
  4. 编写视觉回归测试：
     - 逐精灵颜色/位置断言（确保优化不改变视觉输出）
     - 行军路线叠加正确性
     - 多阵营精灵颜色不混淆
  5. 补充 R12 P3 #6.5 修复：troops=0 时不渲染精灵
- **验证**:
  - 50精灵场景 drawCall 数减少 >= 30%
  - 视觉回归测试通过（颜色/位置/动画正确）
  - 性能基准测试通过
  - 全部已有精灵测试通过（53个，不回归）
  - troops=0 不渲染精灵

### Task 3: I7 内应信掉落 + I8 攻城策略道具获取 (P2, Medium)

- **来源**: PLAN.md I7 (MAP-F08-01) + I8 (MAP-F06-03), R12 Task 9 未交付
- **涉及文件**:
  - `src/games/three-kingdoms/engine/map/SiegeRewardSystem.ts` — 掉落逻辑
  - `src/components/idle/panels/map/SiegeResultModal.tsx` — 掉落显示
  - 新增: `src/games/three-kingdoms/engine/map/__tests__/SiegeReward.drop.test.ts`
- **步骤**:
  1. **I7 内应信掉落**:
     - 攻城胜利后20%概率掉落内应信
     - 使用确定性随机种子（基于taskId + 攻城时间），保证可测试性
     - 掉落物品添加到玩家背包（需确认背包系统数据结构）
     - SiegeResultModal中显示掉落动画/通知
  2. **I8 攻城策略道具获取**:
     - 定义道具数据结构（夜袭令/内应信/围困手册等）
     - 实现道具获取途径：商店购买 / 攻城掉落 / 每日签到（至少1种）
     - 道具数量检查集成到攻城策略选择UI（R5 I1/I2已有三态卡片，需对接道具数量）
  3. 编写测试：
     - 掉落概率验证（100次模拟中约20次掉落，95%置信区间）
     - 确定性种子验证（相同输入→相同结果）
     - 道具获取/消耗正确性
     - 道具不足时策略选择被禁用
     - 多次攻城掉落独立（无状态污染）
- **验证**:
  - >= 8 个测试通过（掉落5 + 道具获取3）
  - 掉落概率在合理范围内（15%~25%，100次模拟）
  - 道具数据结构完整
  - 与已有策略选择UI集成无冲突
  - 确定性种子保证可复现

### Task 4: H5/H6 伤亡/将领受伤UI显示增强 (P2, Medium)

- **来源**: PLAN.md H5 (MAP-F06) + H6 (MAP-F06), R12 Task 10 未交付
- **涉及文件**:
  - `src/components/idle/panels/map/SiegeResultModal.tsx` — H5增强
  - `src/components/idle/panels/map/` 将领面板组件 — H6新增/增强
  - `src/components/idle/panels/map/SiegeResultModal.test.tsx` — 测试扩展
- **步骤**:
  1. **H5 攻城结果弹窗伤亡详情增强**:
     - 将领受伤状态图标（轻伤/中伤/重伤 + 颜色编码: 黄#FFC107/橙#FF9800/红#F44336）
     - 将领恢复倒计时（实时更新，每秒刷新，使用 `vi.useFakeTimers()` 测试）
     - 伤亡对比可视化（我方损失 vs 预计敌方损失，使用数字 + 百分比 + 简易条形图）
     - 无伤亡时不显示伤亡区域（向后兼容）
  2. **H6 将领受伤状态显示**:
     - 将领选择面板中标记受伤状态（灰色遮罩 + 受伤图标）
     - 受伤将领不可选（编队选择时灰色 + tooltip "恢复中: 剩余X小时"）
     - 恢复进度条（剩余时间/总恢复时间，百分比显示）
     - 受伤级别颜色与 H5 一致（轻/中/重 三级）
  3. 编写UI测试：
     - 3种受伤级别颜色正确
     - 恢复倒计时实时更新（advanceTimer验证）
     - 受伤将领在选择面板中正确标记
     - 受伤将领不可点击
     - 无伤亡时隐藏伤亡区域
     - 向后兼容测试（已有的 SiegeResultModal 测试不回归）
- **验证**:
  - >= 8 个新增UI测试通过
  - 3种受伤级别颜色正确
  - 恢复倒计时实时更新
  - 受伤将领在选择面板中正确标记且不可选
  - 向后兼容（无伤亡时不显示伤亡区域）
  - 已有 SiegeResultModal 测试不回归

### Task 5: 双路径结算架构统一 — 设计与初步实现 (P2, Medium)

- **来源**: R10 DEFERRED → R11 DEFERRED → R12 DEFERRED → R13必须启动
- **涉及文件**:
  - `src/games/three-kingdoms/engine/map/SiegeBattleSystem.ts` — 战斗结算
  - `src/games/three-kingdoms/engine/map/SiegeRewardSystem.ts` — 奖励结算
  - `src/games/three-kingdoms/engine/map/MarchingSystem.ts` — 行军结算
  - 新增: `docs/iterations/map-system/settlement-architecture.md` — 架构设计文档
  - 新增: `src/games/three-kingdoms/engine/map/__tests__/SettlementArchitecture.test.ts`
- **步骤**:
  1. 梳理当前结算路径：
     - **路径A（胜利）**: SiegeBattleSystem 计算 victory → SiegeRewardSystem 生成奖励 → MarchingSystem 触发回城
     - **路径B（失败/取消）**: SiegeBattleSystem 计算 defeat → 无奖励 → MarchingSystem 触发回城
     - **路径C（取消）**: cancelMarch → 直接回城 → 无结算
     - 识别三路径的重复逻辑和分叉点
  2. 设计统一结算架构：
     - 定义 `SettlementContext` 数据结构（包含战斗结果/伤亡/奖励/回城信息）
     - 设计 `SettlementPipeline` 接口：`validate → calculate → distribute → notify`
     - 各路径通过不同配置复用同一管道
  3. 编写架构设计文档（简洁，1-2页）
  4. 实现至少1个引擎层重构（如统一奖励计算逻辑）
  5. 编写架构验证测试：
     - 胜利路径通过统一管道产出正确结果
     - 失败路径通过统一管道产出正确结果
     - 取消路径通过统一管道产出正确结果
- **验证**:
  - 架构设计文档完成
  - >= 3 个架构验证测试通过
  - 至少1处引擎层重构完成
  - 已有结算测试不回归

### Task 6: R12遗留P3改善 — 高价值选择性修复 (P3, Small)

- **来源**: R12 Judge Ruling P3 问题清单
- **涉及文件**:
  - `src/games/three-kingdoms/engine/map/__tests__/integration/march-siege-e2e.integration.test.ts` — 重命名
  - `src/components/idle/panels/map/PixelWorldMap.tsx` — cancelled fallthrough注释
  - `src/components/idle/panels/map/__tests__/PixelWorldMapMarchSprites.test.tsx` — 补充测试
  - `src/components/idle/panels/map/SiegeTaskPanel.tsx` — formatElapsedTime fakeTimers
  - `src/components/idle/panels/map/__tests__/SiegeTaskPanel.test.tsx` — 补充测试
- **步骤**:
  1. **P3 #2.1 E2E命名修正** (Trivial):
     - 将 `march-siege-e2e.integration.test.ts` 重命名为 `march-siege.integration.test.ts`
     - 更新文件内部描述注释
     - 更新 R12 builder-manifest 中的引用
  2. **P3 #1.2 cancelled fallthrough注释** (Trivial):
     - 在 `renderSingleMarchSprite` 函数的末尾添加注释：`// cancelled: 不渲染（已从activeMarches删除，不会到达此处）`
     - 添加 `cancelled` 的空分支（含注释），增强代码可读性
  3. **P3 #5.1 取消链路集成测试** (Small):
     - 新增1-2个测试验证 MarchingSystem → PixelWorldMap 的取消链路
     - 场景：创建行军 → startMarch → cancelMarch → 验证精灵层清除
  4. **P3 #2.3 Date.now() 脆弱性** (Trivial):
     - 在 `formatElapsedTime` 测试中使用 `vi.useFakeTimers()`
     - 补充边界值测试（59秒 vs 61秒）
  5. **P3 #6.5 troops=0 精灵** (已在 Task 2 中修复):
     - 如 Task 2 已完成则标记为已修复
  6. 其余P3（#4.1 cancelled动画、#5.2 连续帧、#5.3 状态流转、#6.2 批量取消、#6.4 负createdAt）本轮不处理
- **验证**:
  - E2E文件重命名完成，测试仍通过
  - cancelled fallthrough注释/空分支添加
  - >= 2 个新增链路测试通过
  - formatElapsedTime 测试使用 fakeTimers
  - 全部已有测试不回归

---

## R12遗留问题追踪

| ID | 问题 | 优先级 | 本轮处理 |
|----|------|:------:|---------|
| R13-1 | R12 Phase 4: Task 7 (E1-4 离线→上线→奖励弹窗E2E) | P2 | Task 1 |
| R13-2 | R12 Phase 4: Task 8 (D3-4 行军精灵批量渲染优化) | P2 | Task 2 |
| R13-3 | R12 Phase 4: Task 9 (I7/I8 内应信掉落+道具获取) | P2 | Task 3 |
| R13-4 | R12 Phase 4: Task 10 (H5/H6 伤亡/将领受伤UI) | P2 | Task 4 |
| R13-5 | R10 DEFERRED: 双路径结算架构统一 | P2 | Task 5 |
| R13-6 | R12 P3 #2.1: E2E命名误导 | P3 | Task 6.1 |
| R13-7 | R12 P3 #1.2: cancelled无UI分支 | P3 | Task 6.2 |
| R13-8 | R12 P3 #5.1: 取消链路无集成测试 | P3 | Task 6.3 |
| R13-9 | R12 P3 #2.3: Date.now()测试脆弱性 | P3 | Task 6.4 |
| R13-10 | R12 P3 #6.5: troops=0精灵不合理 | P3 | Task 2 (合并修复) |
| R13-11 | R12 P2 #1.1: NaN防御 (已修复) | — | 已在R12 p2-fixes中修复 |
| R13-12 | R12 P2 #1.3: tasks默认值 (已修复) | — | 已在R12 p2-fixes中修复 |
| R13-13 | R12 P2 #1.4: 图标测试缺口 (已修复) | — | 已在R12 p2-fixes中修复 |

## 跨轮趋势参考（R10-R12）

| 指标 | R10 | R11 | R12 | R13目标 |
|------|:---:|:---:|:---:|:-------:|
| 对抗性发现 | 6 | 11 | 22(18有效) | <= 12 |
| P0问题 | 0 | 0 | 0 | 0 |
| P1问题 | 2→0 | 4(未修复) | 0 | 0 |
| P2问题 | 2 | 5 | 5 | <= 2 |
| P3问题 | — | — | 8 | <= 4 |
| 内部循环次数 | 1 | N/A | N/A | <= 2 |
| PLAN.md完成率 | ~80% | ~80% | ~82% | >= 90% |
| 测试总数 | ~250+ | ~378+ | ~369(270+99) | ~405+ |
| 跨轮遗留P1 | 0 | 4 | 0 | 0 |
| 跨轮遗留P2(功能缺口) | 0 | 0 | 4(Task 7-10) | 0 |

> R12 清除了所有跨轮 P1 遗留，但 Phase 4 的 4 个 P2 任务未交付。PLAN.md 完成率从 ~80% 提升至 ~82%（+2%），仍远低于 92% 目标。R13 核心目标是完成 Task 7-10，将完成率推至 >= 90%。双路径结算架构已连续 3 轮 DEFERRED，本轮必须启动。

## 改进措施（来自R9-R12复盘）

| ID | 措施 | 本轮执行 |
|----|------|---------|
| IMP-01 | Builder交付门禁：必须报告全部已有测试套件运行结果 | 所有Task验证步骤已包含 |
| IMP-02 | TypeScript门禁：每Task完成后运行 `tsc --noEmit` | 所有Task验证步骤已包含 |
| IMP-03 | 高亮行军路线E2E集成测试 | R9/R10/R12已完成基础版 |
| IMP-04 | 双路径结算架构统一 | Task 5: 设计+初步实现 |
| IMP-05 | 测试回归检查：每次大规模重构后必须运行全量测试 | 所有Task验证步骤已包含 |
| IMP-06 | TypeScript编译门禁：每次提交前 `tsc --noEmit` | 所有Task验证步骤已包含 |
| IMP-07 | 边界值测试规范：严格边界值使用精确值 | Task 1/3/6 遵循 |
| IMP-08 | 对称路径验证：Path A/B对称逻辑必须同时覆盖 | Task 5 双路径验证 |
| IMP-09 | 遗留P1优先修复 | R12 已全部清除，本轮无遗留P1 |
| IMP-10 | PLAN.md停滞突破 | Task 1-4 目标新增 6 个功能项到✅ |
| IMP-11 (R13新增) | Phase 4 弹性范围控制：本轮无 Phase 4，所有任务为 P2 核心交付 | 全部6个Task均为必须交付 |
| IMP-12 (R13新增) | 离线系统使用真实EventBus | Task 1 使用真实EventBus替代mock |
| IMP-13 (R13新增) | 时间相关测试统一使用 fakeTimers | Task 1/4/6 遵循 |

---

## 预期PLAN.md更新

| ID | 当前状态 | 预期状态 | 依据 |
|----|---------|---------|------|
| E1-4 | ⬜ | ✅ | Task 1: 离线E2E |
| D3-4 | ⬜ | ✅ | Task 2: 批量渲染优化 |
| I7 | ⬜ (引擎✅) | ✅ | Task 3: 内应信掉落 |
| I8 | ⬜ | ✅ | Task 3: 道具获取 |
| H5 | ⬜ (基础版已有) | ✅ | Task 4: 伤亡详情增强 |
| H6 | ⬜ | ✅ | Task 4: 将领受伤UI |

预期完成率: 44 + 6 = 50/65 = **82% → ~90%**

> 注: D3-1/D3-2 在 R12 Judge 中已隐性标记完成（性能基准已建立、脏标记机制已实现），但 PLAN.md 状态未更新。如果本轮同步更新 D3-1/D3-2 为 ✅，完成率为 52/65 = 80% → **~92%**。

## 实施优先序

```
Phase 1 — R12遗留核心功能交付（本轮全部为P2，按影响力排序）
  Task 1 (P2, Large)   → E1-4 离线系统E2E（3轮未推进，最高优先）
  Task 2 (P2, Medium)  → D3-4 批量渲染优化（性能收尾）
  Task 3 (P2, Medium)  → I7/I8 内应信掉落+道具获取
  Task 4 (P2, Medium)  → H5/H6 伤亡/受伤UI增强

Phase 2 — 架构改进（依赖Phase 1完成后启动）
  Task 5 (P2, Medium)  → 双路径结算架构统一（设计+初步实现）

Phase 3 — 质量改善（弹性范围，可按时间裁剪）
  Task 6 (P3, Small)   → R12遗留P3高价值选择性修复
```

## 风险评估

| 风险 | 概率 | 影响 | 缓解措施 |
|------|:----:|:----:|----------|
| E1-4离线系统代码可能不完整或接口变化 | 中 | 高 | Task 1步骤1先梳理已有实现，确认数据结构可用再编写测试；如接口不兼容，优先补充引擎层实现 |
| Task 1-4工作量总计Large+3Medium可能超出轮次容量 | 中 | 中 | Task 5/6为弹性范围，如Task 1-4耗时超预期可裁剪Phase 2/3 |
| D3-4批量渲染优化导致视觉回归 | 低 | 中 | Task 2步骤4逐精灵颜色/位置断言回归测试 |
| 双路径结算架构重构引入回归 | 中 | 高 | Task 5仅做设计+1处重构，不全面替换；已有结算测试作为回归保障 |
| 道具系统与已有策略UI集成冲突 | 低 | 中 | Task 3步骤2中I8对接R5已有I1/I2三态卡片，使用适配器模式避免修改已有代码 |
| 连续4轮PLAN.md完成率未达90%目标 | 中 | 中 | 本轮Task 1-4为最小可行集，6个功能项全部推进到✅可达成90%+ |

---

## R12交付总结（参考）

| 类别 | R12完成 | R13目标 |
|------|---------|---------|
| Task 1-3 (P1遗留修复) | 3/3 完成 | N/A (无遗留P1) |
| Task 4 (E1-3 E2E增强) | 完成 | N/A |
| Task 5 (I5 城防衰减UI) | 完成 | N/A |
| Task 6 (I10 攻占任务面板) | 完成 | N/A |
| Task 7-10 (Phase 4) | 0/4 完成 | 4/4 完成 |
| P2修复 | 3/5 修复 | 5/5 修复 (含NaN/tasks/图标) |
| PLAN.md完成率 | ~82% | >= 90% |
| 测试总数 | 369 | >= 405 |

---

*Round 13 迭代计划 | 2026-05-04*
