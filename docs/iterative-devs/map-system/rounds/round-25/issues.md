# Round 25 问题追踪

> **轮次**: Round 25 — 结算回城(P9~P10)对抗性核验
> **创建**: 2026-05-05
> **来源**: Builder/Challenger/Judge 对抗性评测

## 问题清单

| ID | 严重度 | 类型 | 来源 | 描述 | 涉及文件 | 状态 |
|----|:------:|------|:----:|------|---------|:----:|
| R25-I01 | P1 | 功能 | Judge P1-1 | SiegeSystem胜利路径扣100%兵力与plan要求10%不一致 | SiegeSystem.ts | ✅ |
| R25-I02 | P1 | 功能 | Judge P1-2 | cancelSiege在createReturnMarch返回null时任务卡returning | SiegeTaskManager.ts | ✅ |
| R25-I03 | P1 | 功能 | Judge P1-3 | cancelSiege不支持settling状态取消 | SiegeTaskManager.ts | ✅ |
| R25-I04 | P2 | UX | Judge P2-1 | SiegeResultModal缺少5秒自动关闭fallback | SiegeResultModal.tsx | ➡️ |
| R25-I05 | P2 | 功能 | Judge P2-2 | deductSiegeResources缺少siege:resourceError事件 | SiegeSystem.ts | ➡️ |
| R25-I06 | P2 | 测试 | Judge P2-3 | cancelSiege降级路径缺少集成测试 | tests/ | ➡️ |
| R25-I07 | P2 | 代码 | Judge P2-4 | SiegeTaskManager.ts:9注释声称监听march:arrived但实际无实现 | SiegeTaskManager.ts | ➡️ |

## 修复记录

### R25-I01 ✅ 已修复
- **问题**: SiegeSystem胜利路径`deductSiegeResources(cost)`扣减全部cost.troops，与plan公式`victory ? *0.1 : *0.3`严重偏差
- **修复**: SiegeSystem胜利路径改为`deductSiegeResources({ troops: 0, grain: cost.grain })`，不扣兵力。伤亡计算由SettlementPipeline统一负责
- **验证**: 107/107 tests PASS

### R25-I02 ✅ 已修复
- **问题**: cancelSiege中`createReturnMarch`返回null时（回城路线不可达），任务卡在returning无法完成
- **修复**: cancelSiege增加null检查，回城不可达时直接`advanceStatus(taskId, 'completed')`
- **验证**: 107/107 tests PASS

### R25-I03 ✅ 已修复
- **问题**: cancelSiege状态守卫仅允许paused/sieging，settling状态无法取消
- **修复**: 扩展状态守卫增加settling，settling→returning转换
- **验证**: 107/107 tests PASS，新增4个测试覆盖

## 传递问题

### R24 传递 P1 (3个，继续传递)
| ID | 问题 | 传递去向 |
|----|------|---------|
| R24-I07 | 连续时间vs回合制+同步阻塞结算需确认设计方向 | → R26 |
| R24-I08 | 失败条件死代码(SiegeBattleSystem.timeExceeded不可达) | → R26 |
| R24-I11 | 城防衰减公式偏差(与PRD公式不同) | → R26 |

### R25 P2 传递 (4个)
| ID | 问题 | 传递去向 |
|----|------|---------|
| R25-I04 | SiegeResultModal缺少5秒自动关闭 | → PROGRESS.md #25 |
| R25-I05 | deductSiegeResources缺siege:resourceError事件 | → PROGRESS.md #26 |
| R25-I06 | cancelSiege降级路径缺集成测试 | → PROGRESS.md #27 |
| R25-I07 | SiegeTaskManager注释误导 | → PROGRESS.md #28 |

---
*issues.md | Round 25 | 2026-05-05*
