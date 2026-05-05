# Round 6 计划

> **迭代**: map-system
> **轮次**: Round 6
> **来源**: `PLAN.md` + Round 5e `report.md`
> **日期**: 2026-05-04

## 本轮焦点

| 优先级 | 领域 | 来源 | 原因 |
|:------:|------|------|------|
| P1 | 移除DEPRECATED分支 | R5e Judge NOTE | 代码卫生 |
| P2 | WorldMapTab组件测试 | R5e Judge J-06 | 测试覆盖 |
| P1 | I12 动画切换 | PLAN.md | 新功能 |
| P1 | I13 攻占战斗回合制 | PLAN.md | 新功能 |

## 对抗性评测重点
- [ ] DEPRECATED分支完全移除后无回归
- [ ] 动画切换时序正确性
- [ ] 回合制战斗计时器精度
- [ ] WorldMapTab测试覆盖handleArrived/handleCancelled

## 质量目标
| 指标 | 目标 |
|------|------|
| P0 | 0 |
| P1 | 0 |
| 测试通过率 | 100% |

## 实施步骤

### Phase 1: 代码卫生 (Task 1-2)
1. 移除WorldMapTab中L540-553的DEPRECATED else if分支
2. 添加WorldMapTab基础组件测试（handleArrived/handleCancelled集成）

### Phase 2: I12 动画切换 (Task 3-4)
3. 实现行军到达→攻占动画切换（行军精灵消失→攻城动画显示）
4. 添加动画切换测试

### Phase 3: I13 攻占战斗回合制 (Task 5-6)
5. 实现SiegeBattleSystem（城防值递减、回合制计时器10s~60s）
6. 添加战斗回合制测试