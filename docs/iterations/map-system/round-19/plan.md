# Round 19 计划

> **迭代**: map-system
> **轮次**: Round 19
> **来源**: `PLAN.md` + Round 18 `report.md`
> **日期**: 2026-05-04

## 本轮焦点

**PLAN.md 收尾 + P2清理 + 验收准备**

R19 聚焦两个方向:
1. **PLAN.md收尾**: 剩余2项(F2集成状态文档 + F3测试覆盖文档)推至100%
2. **P2清理**: R18遗留P2问题(E2E测试 + 集成测试 + mock替换)

## R18 遗留问题清单

| ID | 问题 | 优先级 | 来源 | 本轮处理 |
|----|------|:------:|------|---------|
| R19-I1 | C4: defense recovery在completed阶段不可视 | P2 | R18 C4 | Task 3 |
| R19-I2 | C5: 攻城中断→重连→继续无E2E测试 | P2 | R18 C5 | Task 2 |
| R19-I3 | C9: cancelSiege集成用mock测试 | P2 | R18 C9 | Task 2 |
| R19-I4 | F2: MAP-INTEGRATION-STATUS文档更新 | P2 | PLAN.md | Task 4 |
| R19-I5 | F3: 测试覆盖文档更新 | P2 | PLAN.md | Task 4 |

## 任务计划

### Task 1 (P1): 验收准备 — PLAN.md完成率推至100%

**目标**: 完成F2/F3, 将PLAN.md完成率从96.9%推至100%

**实现要点**:
- F2: 更新MAP-INTEGRATION-STATUS.md集成状态文档
- F3: 更新测试覆盖文档, 包含R15-R18所有新增测试
- 更新PLAN.md中F2/F3状态标记为✅
- 确认统计: 65/65 = 100%

**影响范围**: docs/

### Task 2 (P2): 攻城中断E2E集成测试

**目标**: 补充攻城中断流程的E2E集成测试

**实现要点**:
- 使用真实EventBus + 真实SiegeTaskManager + 真实MarchingSystem
- 测试完整链路: pauseSiege → cancelSiege → returnMarch
- 替换部分mock测试为真实子系统测试

**影响范围**: tests/
**新增测试**: >= 3个

### Task 3 (P2): defense recovery在completed阶段可视化

**目标**: completed阶段defense恢复可见

**实现要点**:
- 在PixelWorldMap的renderCompletedPhase中添加defense recovery进度指示
- 或在completed defeat效果中显示defense恢复百分比

**影响范围**: PixelWorldMap.tsx
**新增测试**: >= 2个

### Task 4 (P2): 文档收尾 + 统计更新

**目标**: 完成所有文档工作

**要点**:
- F2: 创建/更新MAP-INTEGRATION-STATUS.md
- F3: 创建/更新测试覆盖文档
- 更新PLAN.md迭代记录表
- 生成SUMMARY.md(如完成率100%)

## 质量目标

| 指标 | 目标 |
|------|------|
| P0 | 0 |
| P1 | 0 |
| 测试通过率 | 100% |
| 新增测试 | >= 5 |
| PLAN.md 完成率 | 100% |
| 内部循环次数 | <= 2 |

## 对抗性评测重点

- [ ] F2/F3文档是否准确反映当前系统状态
- [ ] E2E中断测试是否使用真实子系统
- [ ] defense recovery可视化是否与引擎状态同步
- [ ] PLAN.md 100%是否真实(非虚报)

## 实施优先序

```
Phase 1 -- P2 功能收尾
  Task 2 (P2)  -> 攻城中断E2E测试
  Task 3 (P2)  -> defense recovery可视化

Phase 2 -- 文档收尾
  Task 1 (P1)  -> PLAN.md完成率100%
  Task 4 (P2)  -> 文档收尾
```

---

*Round 19 迭代计划 | 2026-05-04*
