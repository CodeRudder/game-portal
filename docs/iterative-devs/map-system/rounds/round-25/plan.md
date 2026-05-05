# Round 25 计划

> **迭代**: map-system (攻城主流程集成测试)
> **轮次**: Round 25
> **来源**: FL-MAP-09 攻城主流程 — Phase 4 结算回城
> **日期**: 2026-05-05

## 本轮焦点

> **Phase 4: 结算回城 (P9~P10)** — 验证攻城结果判定→资源结算→道具掉落→回城行军→任务完成的完整链路

**用户线性链**: 战斗结果 → 资源扣算 → 领土占领变更 → 奖励发放 → 道具掉落 → 回城行军创建 → 回城精灵到达 → 任务完成

## 传递问题

### R24 传递 P1 (3个)
| ID | 问题 | 本轮处理 |
|----|------|---------|
| I-07 | 连续时间vs回合制+同步阻塞结算需确认 | 需用户确认即时战斗模式后关闭 |
| I-08 | 失败条件死代码(timeExceeded不可达) | 随异步结算改造解决 |
| I-11 | 城防衰减公式偏差 | 随异步结算改造对齐 |

### R22-R24 累积 P2 (24个)
- 见 PROGRESS.md P2问题积压追踪

### Stage P9: 攻城结果结算

| 序号 | 检查项 | 验收标准 | 关键约束 |
|:----:|--------|---------|---------|
| P9-1 | 战斗结果判定 | SiegeSystem.executeSiege()返回结果含launched/victory/cost | 同步阻塞 |
| P9-2 | 资源扣算 | deductSiegeResources正确扣减兵力+粮草 | 失败时emit siege:resourceError |
| P9-3 | 领土占领变更 | 胜利时ownership变更+emit capture事件 | SettlementPipeline |
| P9-4 | 奖励发放 | SettlementPipeline.distribute()发放奖励含道具掉落 | FL-MAP-11 |
| P9-5 | 伤亡计算 | effectiveTroopsLost = victory ? cost.troops * 0.1 : cost.troops * 0.3 | PRD v1.1 |
| P9-6 | 结果弹窗 | SiegeResultModal显示结果+道具掉落+奖励倍率 | 5秒fallback |
| P9-7 | 征服动画 | conquestAnimSystem.create()触发占领动画 | 攻城成功时 |

### Stage P10: 回城行军

| 序号 | 检查项 | 验收标准 | 关键约束 |
|:----:|--------|---------|---------|
| P10-1 | 回城行军创建 | createReturnMarch创建回程精灵 | 速度x0.8 |
| P10-2 | 回城路线不可达 | 回城失败时直接advanceStatus→completed | 无精灵消失 |
| P10-3 | 回城到达处理 | 行军到达→advanceStatus→completed+释放lock | 状态转换 |
| P10-4 | 任务完成清理 | removeCompletedTasks清理已完成任务+释放资源 | 内存管理 |
| P10-5 | 精灵移除 | 回城到达后3秒removeMarch(非攻城行军) | 正常清除 |

## 对抗性评测重点

1. **结算完整性**: 资源扣减+领土变更+奖励发放是否原子性
2. **失败路径**: 攻城失败时的伤亡计算+退款+回城是否正确
3. **SettlementPipeline**: distribute()的道具掉落逻辑是否与PRD对齐
4. **回城链路**: createReturnMarch→到达→completed完整路径
5. **异常恢复**: 回城路线不可达时的降级处理

## 质量目标

- P0: 0
- P1: 0 (或传递到R26)
- 测试通过率: >99%
- P9~P10 流程链路100%有集成测试覆盖

---
*Round 25 计划 | 2026-05-05 | Phase 4 结算回城*
