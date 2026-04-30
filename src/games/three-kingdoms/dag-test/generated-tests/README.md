# DAG测试覆盖率分析报告 — 生成文件索引

## 生成时间
2026-04-30

## 覆盖率报告摘要

| DAG类型 | 路径覆盖 | 节点覆盖 | 边覆盖 | 数据覆盖 | 状态覆盖 | 综合 |
|---------|---------|---------|--------|---------|---------|------|
| NavigationDAG | 100.0% | 100.0% | 99.2% | 95.8% | 80.5% | **96.2%** |
| FlowDAG | 100.0% | 100.0% | 100.0% | 95.8% | 80.5% | **96.5%** |
| ResourceDAG | 100.0% | 100.0% | 98.8% | 95.8% | 80.5% | **96.2%** |
| EventDAG | 100.0% | 100.0% | 100.0% | 95.8% | 80.5% | **96.5%** |
| **StateDAG** | **63.3%** | **47.7%** | **36.1%** | 95.8% | 80.5% | **60.1%** |
| **综合** | | | | | | **89.1%** |

## StateDAG覆盖率低的根因分析

### 核心问题：匹配算法与节点ID格式不兼容

StateDAG节点ID格式为 `entity:state`（如 `building:locked`），使用冒号分隔。
而覆盖率匹配算法 `calculate-coverage.ts` 中使用 `split(/[-_]/)` 分割关键词，
**冒号 `:` 不在分割字符集中**，导致：
- `building:locked` 被作为整体处理，无法匹配到测试中的 `building` 或 `locked`
- 86个状态节点中仅56个被匹配（47.7%），大量有效测试未被识别

### 次要问题：测试描述风格差异
- 测试文件通常描述**操作行为**（如"升级建筑"、"招募武将"）
- StateDAG描述的是**状态名称**（如 `building:idle`、`hero:recruited`）
- 两者之间的语义鸿沟导致匹配率低

## 生成的测试文件

### P0 — StateDAG未覆盖路径（紧急）
**文件**: `state-dag-p0-paths.test.ts`
- 11个describe块（对应11条未覆盖路径）
- 46个it块（含状态验证+边界条件测试）
- 覆盖实体: alliance, building, campaign-stage, battle, alliance-task, prestige, rebirth, activity, bond, vip, tutorial

### P1 — StateDAG已覆盖路径深度测试（重要）
**文件**: `state-dag-p1-paths.test.ts`
- 19个describe块（对应19条已覆盖但需加强的路径）
- 42个it块（含完整状态链+边界条件测试）
- 覆盖实体: equipment, hero, quest(×2), tech, fusion-tech, stage, alliance(×3), expedition, arena, achievement, map-city, season, activity

### P2 — NavigationDAG/ResourceDAG未覆盖边（建议）
**文件**: `nav-resource-dag-p2-edges.test.ts`
- 3个describe块（对应3条未覆盖边）
- 9个it块（含边界条件测试）
- 覆盖: 竞技场赛季入口、声望商店消耗、建筑取消返还

## 覆盖率提升预估

| 阶段 | StateDAG综合 | 全局综合 | 提升 |
|------|-------------|---------|------|
| 当前 | 60.1% | 89.1% | — |
| 修复匹配算法后 | ~87% | ~93.5% | +4.4% |
| 所有生成测试通过后 | ~97% | ~96.5% | +7.4% |

## 测试用例统计

| 优先级 | 文件数 | describe块 | it块 | 行数 |
|--------|--------|-----------|------|------|
| P0 | 1 | 11 | 46 | 801 |
| P1 | 1 | 19 | 42 | 912 |
| P2 | 1 | 3 | 9 | 112 |
| **合计** | **3** | **33** | **97** | **1,825** |

## 文件清单

```
dag-test/
├── data/
│   └── coverage-report.json          # 详细覆盖率报告（含根因分析）
└── generated-tests/
    ├── state-dag-p0-paths.test.ts     # P0: StateDAG 11条未覆盖路径
    ├── state-dag-p1-paths.test.ts     # P1: StateDAG 19条路径深度测试
    └── nav-resource-dag-p2-edges.test.ts  # P2: Navigation/Resource 未覆盖边
```

## 后续行动建议

1. **立即修复**：在 `calculate-coverage.ts` 的 `split(/[-_]/)` 中添加冒号分割支持
2. **执行测试**：运行生成的测试骨架，补充实际断言逻辑
3. **持续监控**：每次迭代后重新运行 `calculate-coverage.ts` 跟踪覆盖率变化
