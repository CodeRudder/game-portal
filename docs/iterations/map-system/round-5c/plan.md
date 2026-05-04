# Round 5c 计划

> **迭代**: map-system
> **轮次**: Round 5c
> **来源**: `PLAN.md` + Round 5b Challenger findings
> **日期**: 2026-05-04

## 本轮焦点

| 优先级 | 领域 | 来源 | 原因 |
|:------:|------|------|------|
| P1 | 统一旧行军路径 | R5b Challenger C2 | handleStartMarch 绕过 SiegeTaskManager |
| P1 | _siegeTaskId 类型安全 | R5b Challenger C1 | as any 逃逸，序列化丢失 |
| P1 | 攻城异步流 UI 集成测试 | R5b Challenger C3 | P5~P10 零 UI 测试覆盖 |
| P1 | SiegeTaskPanel 组件测试 | R5b Challenger C4 | 组件零测试 |
| P1 | returnRoute null fallback | R5b Challenger C6 | 已修复，需测试覆盖 |

## 对抗性评测重点
- [ ] 端到端 P5~P10 完整链路是否有测试
- [ ] _siegeTaskId 是否在 MarchUnit 接口中
- [ ] handleStartMarch 是否已统一

## 质量目标
| 指标 | 目标 |
|------|------|
| P0 | 0 |
| P1 | 0 |
| 测试通过率 | 100% |
