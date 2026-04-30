# DAG Game Tester Skill

## 概述
DAG测试评估-改进闭环Skill，用于系统化发现游戏未覆盖测试场景并迭代改进。

## 触发条件
- 用户要求"评估DAG测试覆盖率"、"发现未覆盖场景"、"运行DAG测试闭环"
- 用户要求"迭代优化测试"、"提升测试覆盖率"
- 用户提到"DAG测试"、"dag-test"

## 工作流程

### Phase 1: 路径枚举
1. 加载 `dag-data/definitions/` 下的5类DAG JSON
2. 执行路径枚举脚本 `npx tsx src/games/three-kingdoms/dag-test/scripts/enumerate-all-paths.ts`
3. 输出路径到 `dag-data/paths/`

### Phase 2: 覆盖率计算
1. 执行覆盖率脚本 `npx tsx src/games/three-kingdoms/dag-test/scripts/calculate-coverage.ts`
2. 读取 `dag-data/reports/coverage-report.json`
3. 分析未覆盖路径

### Phase 3: 评估（每轮迭代）
1. 读取覆盖率报告
2. 对每类DAG分析未覆盖路径
3. 按严重程度分级：
   - P0: 核心流程完全未覆盖（如建筑升级、武将招募）
   - P1: 重要分支未覆盖（如资源不足分支、战斗失败）
   - P2: 边界场景未覆盖（如最大等级、空状态）
   - P3: 次要路径未覆盖（如动画、样式相关）
4. 生成评估报告到 `dag-data/reports/evaluation-R{N}.json`

### Phase 4: 改进（每轮迭代）
1. 根据评估报告的P0/P1/P2优先级
2. 为未覆盖路径生成测试骨架代码
3. 实现测试用例
4. 运行测试验证
5. 重新计算覆盖率

### Phase 5: 闭环检查
1. 对比前后覆盖率变化 (delta)
2. 终止条件：
   - 覆盖率 ≥ 95%
   - P0 = 0
   - 连续3轮无提升
   - 达到50轮上限
3. 生成最终报告

## 覆盖率公式
```
overall = 0.25 × nodeCoverage + 0.25 × edgeCoverage + 0.20 × pathCoverage + 0.15 × dataCoverage + 0.15 × stateCoverage
```

## 评估报告格式
```json
{
  "iteration": 1,
  "timestamp": "2025-01-01T00:00:00Z",
  "coverage": {
    "nodeCoverage": 0.85,
    "edgeCoverage": 0.72,
    "pathCoverage": 0.60,
    "dataCoverage": 0.50,
    "stateCoverage": 0.65,
    "overall": 0.67,
    "previousOverall": 0.55,
    "delta": 0.12
  },
  "issues": [
    {
      "id": "P0-001",
      "severity": "P0",
      "dagType": "FlowDAG",
      "path": ["flow-v1-res-gather", "flow-v1-bld-upgrade", "flow-v1-bld-done"],
      "description": "建筑升级完整流程未覆盖",
      "suggestion": "添加建筑升级E2E测试"
    }
  ],
  "fixes": [],
  "nextActions": ["修复P0-001: 添加建筑升级E2E测试"]
}
```

## 迭代策略
- 每轮最多修复5个P0 + 10个P1
- P0必须全部修复才能进入下一轮
- 每轮结束后运行全量回归测试
- 保留每轮评估报告供回溯分析

## 关键文件
- DAG定义: `dag-data/definitions/*.json`
- 路径枚举: `dag-data/paths/*.json`
- 覆盖率报告: `dag-data/reports/coverage-report.json`
- 评估报告: `dag-data/reports/evaluation-R{N}.json`
- 枚举脚本: `src/games/three-kingdoms/dag-test/scripts/enumerate-all-paths.ts`
- 覆盖率脚本: `src/games/three-kingdoms/dag-test/scripts/calculate-coverage.ts`
