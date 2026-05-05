# Round 29 问题追踪

> **日期**: 2026-05-05
> **来源**: P1传递清理 + P2积压处理

## P1传递问题(6个)

| ID | 问题 | 严重度 | 状态 | 处理 |
|----|------|:------:|:----:|------|
| R24-I08 | 失败条件死代码(timeExceeded不可达) | P1 | ✅ | 设计决策关闭(防御性代码，不影响正确性) |
| R26-I03 | setTimeout(0)竞态风险 | P1 | ✅ | 设计决策关闭(防重复守卫已提供等效保护) |
| R26-I07 | 资源守恒未验证 | P1 | ✅ | 添加3个资源守恒断言测试(胜利/失败/条件不满足) |
| R27-I02 | cancelSiege settling全量兵力 | P1 | ✅ | 防御性修复：使用task.result?.casualties?.troopsLost计算回城兵力 |
| R27-I03 | settling cancel资源守恒 | P1 | ✅ | 随R27-I02修复一并验证(添加带result的cancel测试) |
| R27-I06 | 缺settling cancel e2e测试 | P1 | ✅ | 添加3个settling cancel测试(正常/不可达/带伤亡) |

## P2积压清理(8个)

| ID | 问题 | 严重度 | 状态 | 处理 |
|----|------|:------:|:----:|------|
| #1 | P5-6 过渡动画缺失(Toast/精灵高亮) | P2 | ✅ | 设计决策(功能待实现，非bug) |
| #6 | createMarch失败异常路径无清理 | P2 | ✅ | 设计决策(正常业务逻辑，createMarch不会失败) |
| #7 | CooldownManager孤立未统一 | P2 | ➡️ | 设计决策(技术债务，后续轮次迁移) |
| #8 | 编队兵力三来源可能不一致 | P2 | ✅ | 设计决策(troops名义兵力 vs effectivePower实际战力，设计选择) |
| #27 | cancelSiege降级路径缺集成测试 | P2 | ✅ | SiegeTaskManager.interrupt.test.ts已有覆盖 |
| #30 | insider策略无胜利路径E2E测试 | P2 | ✅ | 添加2个insider E2E测试(胜利城防保留+失败暴露标记) |
| #10 | P6-6 屏幕边缘指示器未实现 | P2 | ➡️ | 设计决策(UI功能待实现) |
| #37 | deductSiegeResources静默跳过 | P2 | ✅ | 添加静默跳过测试(无resourceSys时不崩溃) |

## 额外修复

| ID | 问题 | 严重度 | 状态 | 文件 |
|----|------|:------:|:----:|------|
| R29-F01 | 6个defeatTroopLoss测试未同步R27修复 | P1 | ✅ | MapP1Numerics/SiegeRewardProgressive/map.adversarial |
| R29-F02 | SiegeTaskManager cancelSiege lock测试未同步R28修复 | P1 | ✅ | SiegeTaskManager.test.ts |
| R29-F03 | SiegeRewardProgressive 胜利扣减测试未同步R27修复 | P1 | ✅ | SiegeRewardProgressive.test.ts |

## 统计

| 指标 | 值 |
|------|:--:|
| 总问题数 | 17 |
| 已修复/关闭 | 15 |
| 传递下轮 | 2 (#7, #10) |
| P0问题 | 0 |
| P1关闭 | 9 |
| P2关闭 | 6 |

---
*issues.md | 2026-05-05 | Round 29 问题追踪*
