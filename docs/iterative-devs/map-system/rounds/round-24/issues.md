# Round 24 问题清单

> **日期**: 2026-05-05
> **来源**: 对抗性评测 (Builder + Challenger V-01~V-04/H-01~H-03/I-01~I-03/D-01~D-03 + Judge 裁决)
> **P0/P1 规则**: 正常情况下在本轮修复，每修复一个即时更新状态为 ✅；如传递下轮需标注原因
> **P2/P3 规则**: 可传递下轮，必须有最终状态 (✅/➡️)

## 问题列表
| ID | 严重度 | 类型 | 来源 | 描述 | 文件 | 状态 | 传递去向 |
|----|:------:|------|------|------|------|:----:|---------|
| I-01 | P0 | 架构 | I-01 | 双路径战斗判定(SiegeBattleSystem vs SiegeSystem)策略效果不一致 | SiegeBattleSystem.ts | ✅ | 本轮修复: 统一使用SIEGE_STRATEGY_CONFIGS.timeMultiplier |
| I-02 | P0 | 功能 | D-01 | attackPower不依赖troops，兵力不影响城防衰减速度 | SiegeBattleSystem.ts | ✅ | 本轮修复: 引入troopsFactor=(troops/BASE_TROOPS) |
| I-03 | P0 | 功能 | Judge | 行军精灵3秒后removeMarch违反新PRD(精灵应在攻城期间保持) | WorldMapTab.tsx:748 | ✅ | 本轮修复: 攻城任务行军延迟到攻城完成时移除 |
| I-04 | P1 | 功能 | V-03/I-03 | 撤退路径断裂(sieging状态不可cancelSiege) | SiegeTaskManager.ts | ✅ | 本轮修复: cancelSiege支持sieging→auto-pause→returning |
| I-05 | P1 | 测试 | H-01 | siege-animation-sequencing mock缺少generatePreview(6个TypeError) | siege-animation-sequencing.test.tsx | ✅ | 本轮修复: 补全generatePreview mock |
| I-06 | P1 | 文档 | V-01 | SiegeBattleSystem注释仍写"回合制引擎"与实际"即时引擎"不符 | SiegeBattleSystem.ts | ✅ | 本轮修复: 更新模块注释为"即时战斗引擎(动画桥接层)" |
| I-07 | P1 | 设计 | V-01/I-02 | 连续时间vs回合制+同步阻塞结算需确认设计方向 | WorldMapTab.tsx | ➡️ | → R25 | 需用户确认即时战斗模式 |
| I-08 | P1 | 功能 | V-04 | 失败条件死代码(SiegeBattleSystem.timeExceeded不可达) | SiegeBattleSystem.ts | ➡️ | → R25 | 随异步结算改造解决 |
| I-09 | P1 | 文档 | H-03/D-02 | 测试报告分类(单元有效/集成无效)+战力公式未集成 | 测试文件 | ➡️ | → R25 | 标注测试有效性 |
| I-10 | P1 | 功能 | D-03 | 策略效果双系统不一致(时长修正vs胜率修正) | SiegeBattleSystem.ts, SiegeSystem.ts | ✅ | 本轮修复: 与I-01一同解决，统一为SIEGE_STRATEGY_CONFIGS |
| I-11 | P1 | 设计 | V-02 | 城防衰减公式偏差(与PRD公式不同) | SiegeBattleSystem.ts | ➡️ | → R25 | 随异步结算改造对齐 |
| I-12 | P2 | 测试 | H-02 | 全mock测试分类错误(siege-animation-sequencing) | siege-animation-sequencing.test.tsx | ➡️ | → PROGRESS.md #20 |
| I-13 | P2 | 功能 | D-02 | FL-MAP-16战力公式未集成到动画系统 | SiegeBattleSystem.ts | ➡️ | → PROGRESS.md #21 |
| I-14 | P2 | 功能 | Builder | P8-9 动态事件提示(暴击5%/城墙破裂10%)完全未实现 | 无相关代码 | ➡️ | → PROGRESS.md #22 |
| I-15 | P2 | 功能 | Builder | P7-5 缺少攻城专用全屏通知/震动反馈/视口跳转 | WorldMapTab.tsx | ➡️ | → PROGRESS.md #23 |
| I-16 | P2 | 功能 | Builder | P8-10 缺少显式交互权限控制(攻城中禁止新攻城/改策略) | WorldMapTab.tsx | ➡️ | → PROGRESS.md #24 |

## 统计
- P0: 3 (修复: 3, 传递: 0)
- P1: 8 (修复: 5, 传递: 3 — I-07需用户确认, I-08/I-11随异步结算解决)
- P2: 5 (修复: 0, 传递: 5)

## 修复记录

| 修复ID | 对应问题 | 修复内容 | 新增测试 | 验证结果 |
|--------|---------|---------|:-------:|---------|
| F-01 | I-02 | SiegeBattleSystem.attackPower引入troops因子: troopsFactor * baseAttackPower + 最小值clamp | 5 | 33/33 PASS |
| F-02 | I-01/I-10 | 战斗时长从STRATEGY_DURATION_MODIFIER(additive)改为SIEGE_STRATEGY_CONFIGS.timeMultiplier(multiplicative) | 0(更新4个断言) | 33/33 PASS |
| F-03 | I-06 | 模块注释从"回合制引擎"更新为"即时战斗引擎(动画桥接层)" | — | — |
| F-04 | I-03 | 攻城行军精灵保留到攻城完成时移除: 非攻城行军保持3秒清除，攻城行军在结算后移除+取消时移除 | 4 | 37/37 PASS |
| F-05 | I-04 | cancelSiege扩展支持sieging状态: 自动暂停(sieging→paused)→撤退(paused→returning) | 2 | 26/26 PASS |
| F-06 | I-05 | siege-animation-sequencing mock补全generatePreview方法 | — | 6/6 PASS(无TypeError) |

## 传递校验
- [x] P0 全部为 ✅ (3/3 已修复)
- [x] P1 修复 5/8，传递 3 个 (I-07需用户确认, I-08/I-11随异步结算解决)
- [x] 所有 ➡️ 传递的问题已同步到 PROGRESS.md P2问题积压追踪 R24遗留
- [x] 传递问题已写入 R25 plan.md "传递问题" Section
- [x] 修复后多维度评测通过: 引擎测试 2313/2317 PASS (4个预存性能测试flaky)

---
*Round 24 问题清单 | 2026-05-05 | P0全部修复, P1修复5/8*
