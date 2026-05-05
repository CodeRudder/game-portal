# Round 26 问题追踪

> **轮次**: Round 26 — 全流程E2E(胜利路径)对抗性核验
> **创建**: 2026-05-05
> **来源**: Builder/Challenger/Judge 对抗性评测

## 问题清单

| ID | 严重度 | 类型 | 来源 | 描述 | 涉及文件 | 状态 |
|----|:------:|------|:----:|------|---------|:----:|
| R26-I01 | P0 | 功能 | Judge C-15 | SiegeTaskManager在WorldMapTab中未调用setDependencies，siegeTask:*事件静默失败 | WorldMapTab.tsx | ✅ |
| R26-I02 | P0 | 功能 | Judge C-03 | executeSiege未传strategy参数，策略差异化在Path A中完全失效 | WorldMapTab.tsx | ✅ |
| R26-I03 | P1 | 时序 | Judge C-01 | setTimeout(0)竞态风险（降级自P0） | WorldMapTab.tsx | ➡️ |
| R26-I04 | P1 | 架构 | Judge C-02 | UI EventBus与引擎EventBus完全隔离 | WorldMapTab.tsx | ➡️ |
| R26-I05 | P1 | 测试 | Judge C-04 | 集成测试mock率高，事件驱动交互验证有效性降低 | tests/ | ➡️ |
| R26-I06 | P1 | 测试 | Judge C-05 | 无全链路事件断言测试(siegeTask:created→completed) | tests/ | ➡️ |
| R26-I07 | P1 | 测试 | Judge C-06 | 攻城前后资源守恒未验证 | tests/ | ➡️ |
| R26-I08 | P1 | 测试 | Judge C-12 | 无单次连续E2E测试覆盖完整流程 | tests/ | ➡️ |
| R26-I09 | P2 | 文档 | Judge C-07 | "智取"策略不存在，计划与代码命名不对齐 | plan.md | ➡️ |
| R26-I10 | P2 | 测试 | Judge C-08 | insider策略无胜利路径E2E测试 | tests/ | ➡️ |
| R26-I11 | P2 | 架构 | Judge C-09 | battle:completed在Path A中不自然发出（已有补偿） | WorldMapTab.tsx | ➡️ |
| R26-I12 | P2 | 时序 | Judge C-11 | useEffect清理后setTimeout回调可能仍在队列 | WorldMapTab.tsx | ➡️ |
| R26-I13 | P2 | 测试 | Judge C-13 | requiredItem在测试中被绕过 | tests/ | ➡️ |
| R26-I14 | P2 | 文档 | Judge C-14 | Builder行号引用不准确 | docs/ | ➡️ |
| R26-I15 | P2 | 测试 | Judge C-16 | 领土变更传播为mock验证 | tests/ | ➡️ |

## 修复记录

### R26-I01 ✅ 已修复
- **问题**: SiegeTaskManager在WorldMapTab中创建实例后从未调用setDependencies({ eventBus })，导致deps为null，所有siegeTask:*事件通过可选链`this.deps?.eventBus.emit(...)`静默跳过
- **修复**: WorldMapTab.tsx在settlementPipeline.setDependencies后添加`siegeTaskManagerRef.current.setDependencies({ eventBus })`
- **验证**: 784/784集成测试通过，37/37 UI测试通过

### R26-I02 ✅ 已修复
- **问题**: WorldMapTab.tsx:539调用executeSiege仅传4个参数，缺少strategy。SiegeSystem.executeSiege第5个参数strategy为可选，不传时走基础模拟路径，策略差异化(胜率修正/消耗系数/特殊效果)完全失效
- **修复**: 添加第5个参数`currentTask.strategy`
- **验证**: 784/784集成测试通过，37/37 UI测试通过

### R25-I07(P2-4) ✅ 顺带修复
- **问题**: SiegeTaskManager.ts:9注释声称"监听march:arrived事件推进状态"但实际无实现
- **修复**: 更新注释为"UI层(WorldMapTab)负责监听march:arrived事件并调用advanceStatus推进状态"

## 传递问题

### R24传递P1(3个，继续传递)
| ID | 问题 | 传递去向 |
|----|------|---------|
| R24-I07 | 连续时间vs回合制+同步阻塞结算需确认 | → R27 |
| R24-I08 | 失败条件死代码 | → R27 |
| R24-I11 | 城防衰减公式偏差 | → R27 |

### R26 P1传递(6个)
| ID | 问题 | 传递去向 |
|----|------|---------|
| R26-I03 | setTimeout(0)竞态风险 | → R27 |
| R26-I04 | UI EventBus与引擎EventBus隔离 | → R27(需评估) |
| R26-I05 | 集成测试mock率高 | → R27 |
| R26-I06 | 缺全链路事件断言测试 | → R27 |
| R26-I07 | 资源守恒未验证 | → R27 |
| R26-I08 | 无单次连续E2E测试 | → R27 |

---
*issues.md | Round 26 | 2026-05-05*
