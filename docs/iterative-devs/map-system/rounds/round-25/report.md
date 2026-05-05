# Round 25 迭代报告

> **日期**: 2026-05-05
> **迭代周期**: 第25轮 — 结算回城(P9~P10)对抗性核验
> **内部循环次数**: 1

## 1. 对抗性评测发现

### Builder 客观事实清单
| ID | 计划任务 | 完成状态 | 测试结果 | 测试有效性 |
|----|---------|:--------:|---------|:---------:|
| P9-1 | 战斗结果判定 | 已完成 | SiegeSystem.executeSiege()返回完整结果 | ✅ |
| P9-2 | 资源扣算 | 基本完成 | 缺siege:resourceError事件 | — |
| P9-3 | 领土占领变更 | 已完成 | captureTerritory+事件完整 | ✅ |
| P9-4 | 奖励发放 | 已完成 | SettlementPipeline.distribute()已接入 | ✅ |
| P9-5 | 伤亡计算 | 已完成(修复后) | SiegeSystem胜利路径改为不扣兵力，SettlementPipeline统一计算 | ✅ |
| P9-6 | 结果弹窗 | 基本完成 | 缺5秒自动关闭 | — |
| P9-7 | 征服动画 | 已完成 | WorldMapTab.tsx已接入ConquestAnimationSystem | ✅ |
| P10-1 | 回城行军创建 | 已完成 | createReturnMarch + 速度x0.8 | ✅ |
| P10-2 | 回城路线不可达 | 已完成(修复后) | 主流程+cancelSiege路径均已处理 | ✅ |
| P10-3 | 回城到达处理 | 已完成 | UI层march:arrived监听→completed | ✅ |
| P10-4 | 任务完成清理 | 已完成 | UI层调用removeCompletedTasks | ✅ |
| P10-5 | 精灵移除 | 已完成 | UI层3秒延迟removeMarch | ✅ |

### Challenger 攻击结果

**P0级质疑(4项)**:
| ID | 质疑点 | Judge裁决 |
|----|--------|-----------|
| P0-1 | SiegeSystem胜利扣100% vs plan要求10% | 降为P1，两套系统并存但UI使用正确值 |
| P0-2 | march:arrived无监听→任务无法完成 | 不成立，UI层WorldMapTab.tsx:763已监听 |
| P0-3 | ConquestAnimationSystem未被调用 | 不成立，WorldMapTab.tsx:37导入+L243实例化 |
| P0-4 | cancelSiege不可达时任务卡returning | 部分成立，降为P1，cancelSiege路径缺null处理 |

**P1级质疑(6项)**:
| ID | 质疑点 | Judge裁决 |
|----|--------|-----------|
| P1-1 | 两套伤亡系统冲突 | 成立P1，已修复 |
| P1-2 | removeMarch无3秒延迟 | 不成立，UI层L753-756已实现 |
| P1-3 | removeCompletedTasks未被调用 | 不成立，WorldMapTab.tsx三处调用 |
| P1-4 | 缺少siege:resourceError事件 | 成立P2 |
| P1-5 | 两套伤亡系统并存 | 成立P1，与P0-1合并 |
| P1-6 | cancelSiege不支持settling | 成立P1，已修复 |

**P2级质疑(3项)**:
| ID | 质疑点 | Judge裁决 |
|----|--------|-----------|
| P2-1 | 链路测试非事件驱动 | 成立，维持P2 |
| P2-2 | cancelSiege null降级测试验证错误行为 | 成立，维持P2 |
| P2-3 | 回城速度x0.8仅单元验证 | 不成立，集成测试已验证 |

### Judge 综合评定
| 编号 | 严重度 | 问题 | 裁决理由 |
|------|:------:|------|---------|
| P1-1 | P1→✅ | 两套伤亡系统，胜利扣100% | SiegeSystem改为不扣兵力，SettlementPipeline统一计算 |
| P1-2 | P1→✅ | cancelSiege回城不可达降级缺失 | cancelSiege增加null→completed处理 |
| P1-3 | P1→✅ | cancelSiege不支持settling | 扩展状态守卫增加settling |
| P2-1 | P2 | 结果弹窗缺5秒自动关闭 | 功能偏差但手动确认可用 |
| P2-2 | P2 | 缺siege:resourceError事件 | 监控能力缺失但不影响功能 |
| P2-3 | P2 | cancelSiege降级缺集成测试 | 测试覆盖缺口 |
| P2-4 | P2 | 注释误导 | 代码维护隐患 |

## 2. 修复内容

| 修复ID | 对应问题 | 修复内容 | 新增测试 | 验证结果 |
|--------|---------|---------|:-------:|---------|
| F-01 | P1-1 | SiegeSystem胜利路径改为`deductSiegeResources({ troops: 0, grain: cost.grain })`，伤亡由SettlementPipeline统一计算 | 0 | 107/107 PASS |
| F-02 | P1-2 | cancelSiege增加createReturnMarch返回null检查，不可达时直接completed | 2 | 107/107 PASS |
| F-03 | P1-3 | cancelSiege状态守卫扩展支持settling→returning | 2 | 107/107 PASS |

## 3. 内部循环记录
| 子轮次 | 发现 | 修复 | 剩余P0 | 剩余P1 | 备注 |
|--------|:----:|:----:|:------:|:------:|------|
| 25.1 | 7(3P1+4P2) | 3(全部P1) | 0 | 0 | P2全部传递 |

## 4. 测试结果
| 测试套件 | 通过 | 失败 |
|----------|:----:|:----:|
| SiegeSystem单元测试 | 26 | 0 |
| SiegeTaskManager单元测试 | 32 | 0 |
| SiegeTaskManager中断测试 | 24 | 0 |
| 攻城集成测试 | 25 | 0 |
| **合计** | **107** | **0** |

## 5. 架构审查结果
| 检查项 | 状态 | 问题描述 |
|--------|:----:|----------|
| 伤亡计算统一 | ✅ | SiegeSystem胜利路径不再扣兵力，SettlementPipeline为权威源 |
| 回城降级完整性 | ✅ | 主流程+cancelSiege路径均已处理不可达降级 |
| cancelSiege状态覆盖 | ✅ | 支持paused/sieging/settling三种状态 |
| 事件监听架构 | ✅ | UI层协调模式确认合理 |

## 6. 回顾(跨轮趋势)
| 指标 | R22 | R23 | R24 | R25 | 趋势 |
|------|:--:|:--:|:--:|:--:|:----:|
| 测试通过率 | 100% | 100% | 99.8% | 100% | → STABLE |
| P0问题 | 2→0 | 2→0 | 3→0 | 0 | STABLE |
| P1问题 | 3→0 | 4→0 | 8(修5/传3) | 3→0 | ↓ 改善 |
| 对抗性发现 | 5 | 5 | 16 | 13(4P0否+6P1+3P2) | → |
| 内部循环次数 | 1 | 1 | 1 | 1 | STABLE |
| P2累积 | 8 | 19 | 24 | 28 | ↑ |

## 7. 剩余问题(移交下轮)

### R24传递P1(继续传递，3个)
| ID | 严重度 | 类型 | 描述 | 传递去向 |
|----|:------:|------|------|---------|
| R24-I07 | P1 | 设计 | 连续时间vs回合制+同步阻塞需确认 | → R26 |
| R24-I08 | P1 | 功能 | 失败条件死代码 | → R26 |
| R24-I11 | P1 | 设计 | 城防衰减公式偏差 | → R26 |

### R25 P2传递(4个)
| ID | 严重度 | 描述 | 传递去向 |
|----|:------:|------|---------|
| R25-I04 | P2 | SiegeResultModal缺5秒自动关闭 | → PROGRESS.md #25 |
| R25-I05 | P2 | deductSiegeResources缺siege:resourceError事件 | → PROGRESS.md #26 |
| R25-I06 | P2 | cancelSiege降级路径缺集成测试 | → PROGRESS.md #27 |
| R25-I07 | P2 | SiegeTaskManager注释误导 | → PROGRESS.md #28 |

## 8. 下轮计划
> 详见 `rounds/round-26/plan.md`

## 9. 复盘（R25 % 3 ≠ 0，跳过）
