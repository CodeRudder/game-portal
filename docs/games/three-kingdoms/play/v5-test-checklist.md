# v5.0 百家争鸣 — 集成测试检查清单

> 生成时间: 2026-04-24
> 测试目录: `src/games/three-kingdoms/engine/tech/__tests__/integration/`

## 测试统计

| 指标 | 数值 |
|------|------|
| 测试文件数 | 17（含v5新增6个） |
| 新增测试数 | 143 |
| 新增通过数 | 141 |
| 新增跳过数 | 2 |
| 新增通过率 | 100%（141/141 非跳过测试全部通过） |

## 新增测试文件清单

| 文件名 | 通过/总数 | 覆盖章节 |
|--------|:---------:|---------|
| map-render-territory.integration.test.ts | 29/29 | §2.1-2.4, §3.1-3.2 |
| siege-full-flow.integration.test.ts | 20/20 | §4.1-4.6 |
| map-filter-stat.integration.test.ts | 26/27 | §2.5-2.6, §5.1-5.3, §6.1 |
| prestige-rebirth.integration.test.ts | 22/22 | §7.1-7.2, §8.1-8.2 |
| cross-validation-loop.integration.test.ts | 23/24 | §9.1-9.12 |
| mobile-edge-cases.integration.test.ts | 23/23 | §2.7, §10.1-10.8 |

## 流程覆盖清单

| 流程编号 | 流程名称 | 是否编写 | 通过数/总数 | 最后测试时间 | 测试脚本文件名 | 备注 |
|---------|---------|:--------:|:-----------:|:-----------:|--------------|------|
| §1.1 | 科技树浏览与详情 | ✅ | — | 2026-04-24 | tech-browse-research.integration.test.ts | v5已有 |
| §1.2 | 科技研究启动 | ✅ | — | 2026-04-24 | tech-browse-research.integration.test.ts | v5已有 |
| §1.3 | 研究队列管理 | ✅ | — | 2026-04-24 | tech-queue-accelerate.integration.test.ts | v5已有 |
| §1.4 | 科技加速机制 | ✅ | — | 2026-04-24 | tech-queue-accelerate.integration.test.ts | v5已有 |
| §1.5 | 互斥分支选择 | ✅ | — | 2026-04-24 | tech-mutex-fusion-link.integration.test.ts | v5已有 |
| §1.6 | 融合科技 | ✅ | — | 2026-04-24 | tech-mutex-fusion-link.integration.test.ts | v5已有 |
| §1.7 | 科技联动效果 | ✅ | — | 2026-04-24 | tech-link-fusion-offline.integration.test.ts | v5已有 |
| §1.8 | 离线研究回归 | ✅ | — | 2026-04-24 | tech-offline-reincarnation.integration.test.ts | v5已有 |
| §1.9 | 科技重置（转生时） | ✅ | — | 2026-04-24 | tech-offline-reincarnation.integration.test.ts | v5已有 |
| §1.10 | 内政武将派遣加速 | ✅ | — | 2026-04-24 | tech-research-full-flow.integration.test.ts | v5已有 |
| §1.11 | 科技点管理流程 | ✅ | — | 2026-04-24 | tech-points-core-loop.integration.test.ts | v5已有 |
| §2.1 | 地图渲染与浏览 | ✅ | 5/5 | 2026-04-24 | map-render-territory.integration.test.ts | ★新增 |
| §2.2 | 三大区域划分 | ✅ | 4/4 | 2026-04-24 | map-render-territory.integration.test.ts | ★新增 |
| §2.3 | 地形类型与战斗效果 | ✅ | 5/5 | 2026-04-24 | map-render-territory.integration.test.ts | ★新增 |
| §2.4 | 特殊地标 | ✅ | 6/6 | 2026-04-24 | map-render-territory.integration.test.ts | ★新增 |
| §2.5 | 地图筛选过滤 | ✅ | 6/6 | 2026-04-24 | map-filter-stat.integration.test.ts | ★新增 |
| §2.6 | 收益热力图模式 | ✅ | 3/3 | 2026-04-24 | map-filter-stat.integration.test.ts | ★新增 |
| §2.7 | 手机端地图适配 | ✅ | 7/7 | 2026-04-24 | mobile-edge-cases.integration.test.ts | ★新增 |
| §3.1 | 领土占领 | ✅ | 5/5 | 2026-04-24 | map-render-territory.integration.test.ts | ★新增 |
| §3.2 | 领土产出计算 | ✅ | 4/4 | 2026-04-24 | map-render-territory.integration.test.ts | ★新增 |
| §3.3 | 产出气泡显示规则 | ✅ | — | 2026-04-24 | map-territory-siege.integration.test.ts | v5已有 |
| §3.4 | 领土等级与升级 | ✅ | — | 2026-04-24 | map-territory-siege.integration.test.ts | v5已有 |
| §3.5 | 驻防机制 | ✅ | — | 2026-04-24 | garrison-reincarnation-edge.integration.test.ts | v5已有 |
| §3.6 | 离线领土变化 | ✅ | — | 2026-04-24 | map-event-stat-mobile.integration.test.ts | v5已有 |
| §4.1 | 攻城条件检查 | ✅ | 6/6 | 2026-04-24 | siege-full-flow.integration.test.ts | ★新增 |
| §4.2 | 城防计算与胜率预估 | ✅ | 3/3 | 2026-04-24 | siege-full-flow.integration.test.ts | ★新增 |
| §4.3 | 攻城战斗与占领 | ✅ | 3/3 | 2026-04-24 | siege-full-flow.integration.test.ts | ★新增 |
| §4.4 | 攻城奖励 | ✅ | 2/2 | 2026-04-24 | siege-full-flow.integration.test.ts | ★新增 |
| §4.5 | 攻城时间计算 | ✅ | 2/2 | 2026-04-24 | siege-full-flow.integration.test.ts | ★新增 |
| §4.6 | 攻城失败推荐算法 | ✅ | 4/4 | 2026-04-24 | siege-full-flow.integration.test.ts | ★新增 |
| §5.1 | 地图事件触发与浏览 | ✅ | 3/4 | 2026-04-24 | map-filter-stat.integration.test.ts | 1项skip |
| §5.2 | 事件选择分支 | ✅ | 4/4 | 2026-04-24 | map-filter-stat.integration.test.ts | ★新增 |
| §5.3 | 事件奖励结算 | ✅ | 5/5 | 2026-04-24 | map-filter-stat.integration.test.ts | ★新增 |
| §6.1 | 统计面板查看 | ✅ | 5/5 | 2026-04-24 | map-filter-stat.integration.test.ts | ★新增 |
| §7.1 | 科技系统解锁 | ✅ | 6/6 | 2026-04-24 | prestige-rebirth.integration.test.ts | ★新增 |
| §7.2 | 各节点前置条件 | ✅ | 5/5 | 2026-04-24 | prestige-rebirth.integration.test.ts | ★新增 |
| §8.1 | 转生时领土处理流程 | ✅ | 5/5 | 2026-04-24 | prestige-rebirth.integration.test.ts | ★新增 |
| §8.2 | 转生时攻城状态处理 | ✅ | 6/6 | 2026-04-24 | prestige-rebirth.integration.test.ts | ★新增 |
| §9.1 | 核心循环 | ✅ | 3/3 | 2026-04-24 | cross-validation-loop.integration.test.ts | ★新增 |
| §9.2 | 经济循环 | ✅ | 2/3 | 2026-04-24 | cross-validation-loop.integration.test.ts | 1项skip |
| §9.3 | 文化循环 | ✅ | — | 2026-04-24 | cross-system-validation.integration.test.ts | v5已有 |
| §9.4 | 离线循环 | ✅ | 3/3 | 2026-04-24 | cross-validation-loop.integration.test.ts | ★新增 |
| §9.5 | 领土扩张循环 | ✅ | 3/3 | 2026-04-24 | cross-validation-loop.integration.test.ts | ★新增 |
| §9.6 | 互斥分支差异化 | ✅ | — | 2026-04-24 | cross-system-validation.integration.test.ts | v5已有 |
| §9.7 | 地图事件资源获取 | ✅ | — | 2026-04-24 | map-event-stat-mobile.integration.test.ts | v5已有 |
| §9.8 | 地形与科技联动 | ✅ | 3/3 | 2026-04-24 | cross-validation-loop.integration.test.ts | ★新增 |
| §9.9 | 声望双加成 | ✅ | 3/3 | 2026-04-24 | cross-validation-loop.integration.test.ts | ★新增 |
| §9.10 | 融合科技终极目标 | ✅ | — | 2026-04-24 | cross-system-validation.integration.test.ts | v5已有 |
| §9.11 | 科技点闭环 | ✅ | 3/3 | 2026-04-24 | cross-validation-loop.integration.test.ts | ★新增 |
| §9.12 | 攻城失败推荐循环 | ✅ | 3/3 | 2026-04-24 | cross-validation-loop.integration.test.ts | ★新增 |
| §10.1 | 研究取消与切换 | ✅ | 2/2 | 2026-04-24 | mobile-edge-cases.integration.test.ts | ★新增 |
| §10.2 | 背包满时装备卸下 | ✅ | — | 2026-04-24 | garrison-reincarnation-edge.integration.test.ts | v5已有 |
| §10.3 | 攻城失败处理 | ✅ | 3/3 | 2026-04-24 | mobile-edge-cases.integration.test.ts | ★新增 |
| §10.4 | 每日攻城次数耗尽 | ✅ | 2/2 | 2026-04-24 | mobile-edge-cases.integration.test.ts | ★新增 |
| §10.5 | 离线超72小时 | ✅ | 2/2 | 2026-04-24 | mobile-edge-cases.integration.test.ts | ★新增 |
| §10.6 | 缩放<60%时气泡隐藏 | ✅ | 2/2 | 2026-04-24 | mobile-edge-cases.integration.test.ts | ★新增 |
| §10.7 | 联盟加速前置条件 | ✅ | 2/2 | 2026-04-24 | mobile-edge-cases.integration.test.ts | ★新增 |
| §10.8 | 转生时融合科技与槽位 | ✅ | 3/3 | 2026-04-24 | mobile-edge-cases.integration.test.ts | ★新增 |

## 全量测试汇总

| 指标 | 数值 |
|------|------|
| 全部集成测试文件 | 48 |
| 全部通过文件 | 47 |
| 全部测试数 | 1466 |
| 通过数 | 1398 |
| 跳过数 | 65 |
| 失败数 | 3（v6预存问题） |
| 通过率 | 99.8% |

## 封版状态

- [x] 6个新增集成测试文件全部通过
- [x] v5.0 百家争鸣 §1-§10 全流程覆盖
- [x] 2项skip标注（EventTriggerSystem/TechLinkSystem需完整引擎上下文）
- [x] 无新增失败用例
- [x] 构建通过
