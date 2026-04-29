# R10 — Fuzz Testing & Long-Run Stability 测试报告

## 概要

| 指标 | 值 |
|------|------|
| 测试文件 | 3 |
| 测试用例总数 | 30 |
| 通过 | 30 ✅ |
| 失败 | 0 |
| 跳过 | 0 |
| 执行耗时 | ~4.1s |
| PRNG | Park-Miller (seeded, 可重现) |

## 新增文件

### 1. 资源系统模糊测试
**文件**: `src/games/three-kingdoms/engine/resource/__tests__/resource-fuzz.test.ts`

| # | 测试用例 | Seed | 迭代 | 验证项 |
|---|---------|------|------|--------|
| 1 | 随机添加/消耗资源100次后所有资源值非负 | 42 | 100 | 资源 ≥ 0, 有效数值 |
| 2 | 随机设置资源上限10次后资源值受约束 | 123 | 10 | 资源 ≤ cap, ≥ 0 |
| 3 | 随机批量消耗20次后资源保持一致 | 456 | 20 | consumeBatch 一致性 |
| 4 | 随机资源消耗5次后canAfford结果与实际一致 | 789 | 5 | canAfford ↔ consumeBatch |
| 5 | 混合随机操作200次后无NaN/Infinity | 101112 | 200 | 全资源有效 |
| 6 | 随机操作后序列化再反序列化数据一致 | 20240101 | 30 | 序列化一致性 |
| 7 | 随机极端值（极大/极小/0）添加资源后无NaN | 7777 | 6 | 极端值稳定性 |
| 8 | 随机tick间隔累计产出与理论值误差在合理范围 | 5555 | 50 | 产出精度 ≤ 0.01 |
| 9 | 随机操作后canAfford与实际消耗结果一致 | 33333 | 50 | 消耗精确性 |
| 10 | 多个不同seed下100次随机操作后资源始终非负且有效 | 111-555 | 5×100 | 多seed回归 |

**覆盖的操作类型**: `addResource`, `consumeResource`, `setResource`, `setProductionRate`, `tick`, `setCap`, `consumeBatch`, `recalculateProduction`, `serialize/deserialize`, `canAfford`

### 2. 战斗系统模糊测试
**文件**: `src/games/three-kingdoms/engine/battle/__tests__/battle-fuzz.test.ts`

| # | 测试用例 | Seed | 迭代 | 验证项 |
|---|---------|------|------|--------|
| 1 | 随机属性武将战斗100次不崩溃且结果有效 | 1001 | 100 | outcome有效, turns ≤ MAX |
| 2 | 全0属性武将战斗不崩溃 | — | 1 | 零属性边界 |
| 3 | 极高属性武将战斗不崩溃 | 2002 | 1 | 99999属性稳定性 |
| 4 | 1v1到6v6随机人数战斗全部不崩溃 | 3003 | 6 | survivors ≤ teamSize |
| 5 | 随机技能组合战斗50次不崩溃 | 4004 | 50 | 随机技能组合 |
| 6 | 特定克制关系组合战斗结果符合预期 | — | 1 | 骑兵>步兵伤害验证 |
| 7 | 随机不对等人数战斗不崩溃 | 5005 | 6 | 1v6, 6v1, 2v5等 |
| 8 | 1HP单位互攻战斗不崩溃 | — | 1 | 极低HP边界 |
| 9 | 多个seed下随机战斗均不崩溃 | 1111-5555 | 5×20 | 多seed回归 |
| 10 | 满怒气武将战斗中频繁释放大招不崩溃 | 6006 | 1 | 大招频繁释放 |

**覆盖的属性范围**:
- 攻击: 0 ~ 99999
- 防御: 0 ~ 99999
- HP: 1 ~ 999999
- 速度: 0 ~ 99999
- 怒气: 0 ~ 100
- 兵种: 骑兵/步兵/枪兵/弓兵/谋士
- 队伍人数: 1 ~ 6

### 3. 长时间运行稳定性测试
**文件**: `src/games/three-kingdoms/engine/__tests__/long-run-stability.test.ts`

| # | 测试用例 | Ticks | Seed | 验证项 |
|---|---------|-------|------|--------|
| 1 | 1000 tick后所有资源值非负 | 1000 | 88888 | 资源 ≥ 0 |
| 2 | 1000 tick后快照中无NaN或Infinity | 1000 | 99999 | 深度数值校验 |
| 3 | 1000 tick后存档可正常保存和加载 | 1000 | 77777 | 序列化/反序列化一致性 |
| 4 | 1000 tick后建筑状态有效 | 1000 | 66666 | 0 ≤ level ≤ 30 |
| 5 | 1000 tick后资源产出速率有效 | 1000 | 55555 | 速率 ≥ 0, 有效数值 |
| 6 | 1000 tick后资源上限有效 | 1000 | 44444 | cap有效, 资源 ≤ cap |
| 7 | 1000 tick后canAfford与实际资源状态一致 | 1000 | 33333 | canAfford一致性 |
| 8 | 1000 tick后多次序列化结果一致 | 1000 | 22222 | 幂等性验证 |
| 9 | 1000 tick后引擎仍可正常响应tick | 1000+100 | 11111 | 持续稳定性 |
| 10 | 多个seed下1000 tick均保持稳定 | 500×3 | 12345-34567 | 多seed回归 |

**每tick随机操作**: addResource, consumeResource, upgradeBuilding, tick, setResource, setProductionRate

## 设计原则

### Seeded PRNG
所有随机数使用 Park-Miller 线性同余生成器，seed 值固定，确保：
- **可重现**: 任何失败都可通过相同 seed 精确复现
- **确定性**: CI/CD 环境下结果一致
- **无外部依赖**: 不依赖 `Math.random()` 或系统时间

### 错误容忍设计
- 资源消耗操作使用 `try/catch` 包裹，资源不足时优雅跳过
- 战斗引擎通过 `runFullBattle` 完整执行，不依赖中间状态
- 引擎操作异常不传播，只验证最终状态

### 不变量验证
1. **资源非负**: 所有资源值 ≥ 0
2. **数值有效**: 无 NaN、Infinity、undefined
3. **上限约束**: 资源 ≤ cap（有上限的资源）
4. **等级合法**: 0 ≤ building.level ≤ 30
5. **序列化一致**: serialize → deserialize → 资源值一致
6. **canAfford一致**: canAfford=true → consumeBatch 成功

## 测试执行结果

```
✓ resource-fuzz.test.ts     10/10 passed
✓ battle-fuzz.test.ts       10/10 passed  
✓ long-run-stability.test.ts 10/10 passed

Test Files  3 passed (3)
     Tests  30 passed (30)
  Duration  ~4.1s
```

## 已发现并修复的问题

| 问题 | 严重度 | 状态 |
|------|--------|------|
| 建筑初始等级为0（未解锁），测试断言期望 ≥ 1 | P3 | 已修复测试断言为 ≥ 0 |

## 覆盖矩阵

| 子系统 | 正常路径 | 边界条件 | 极端值 | 并发/序列化 |
|--------|---------|---------|--------|------------|
| ResourceSystem | ✅ | ✅ | ✅ | ✅ |
| BattleEngine | ✅ | ✅ | ✅ | N/A |
| ThreeKingdomsEngine | ✅ | ✅ | ✅ | ✅ |
| BuildingSystem | ✅ | ✅ | — | ✅ |
