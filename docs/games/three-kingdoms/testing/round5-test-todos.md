# 第五轮迭代测试 — 任务清单 (Round 5)

> 目标: 消除所有it.skip，优化求贤令生产方式，全部版本评分>9.5/10
> HEAD: 7de51e9
> 方法文档: testing/game-flow-integration-test-methodology.md
> 核心规则: **不允许跳过测试** — it.skip必须消除

## R5两大任务

### 任务1: 求贤令(recruitToken)生产方式优化
- [ ] P0: 新手礼包 +10个求贤令 (INITIAL_RESOURCES.recruitToken: 0→10)
- [ ] P0: 关卡奖励 +10个/大关卡 (campaign-config.ts)
- [ ] P1: 被动产出速率3倍 (0.001→0.003/秒)
- [ ] P1: 资源产出速率显示优化

### 任务2: 消除所有it.skip (当前99个)
- [ ] v1: 统计并消除skip
- [ ] v2: 统计并消除skip
- [ ] v3: 统计并消除skip
- [ ] v4~v20: 逐版本消除skip
- [ ] 全量回归验证

## 版本迭代子流程（循环直到评分>9.5）

```
① 读取play文档 → 根据测试方法文档修正集成测试（消除it.skip）
② 运行测试发现问题 → 修复代码/测试
③ 重新运行确认全通过（0 skip）
④ 游戏评测师评审 + 修复
⑤ 架构评审 + 修复
⑥ 评分>9.5 → 封版提交
```
