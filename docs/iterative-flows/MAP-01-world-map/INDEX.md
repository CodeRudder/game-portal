# 天下地图系统 — 流程索引

> **版本**: v4.0 | **更新日期**: 2026-05-05
> **迭代状态**: R4 完成（P0=0, P1=0, 新增L1攻城主流程, 可实施性99%+）
> **达标率**: 180/180 = 100%

## 架构假设声明

三国霸业是**纯客户端本地游戏**，所有战斗逻辑、地图数据、行军计算、事件触发均在客户端本地完成。

| 维度 | 说明 |
|------|------|
| 数据存储 | localStorage / IndexedDB，无服务端依赖 |
| 战斗引擎 | 客户端本地回合制引擎（FL-MAP-09 Stage P8） |
| 敌方实体 | 本地 AI 引擎驱动，非服务端推送 |
| 行军拦截 | 客户端本地判定（FL-MAP-04-02 状态机） |
| 数据同步 | 无在线同步，云存档为可选功能（不影响核心流程） |
| 断线概念 | 不存在网络断线，"断线"场景对应App切后台/页面hidden |
| PRD 来源 | [PRD v2.0 MAP-1 系统概述](../../games/three-kingdoms/ui-design/prd/MAP-world-prd-v2.md#map-1) |

## 流程清单

| ID | 流程名称 | PRD 来源 | 文件 | 状态 |
|----|---------|---------|------|:----:|
| FL-MAP-01 | 进入天下Tab | MAP-1 | [flows/FL-MAP-01-enter-tab.md](flows/FL-MAP-01-enter-tab.md) | v2 |
| FL-MAP-02 | 地图浏览与缩放 | MAP-1 | [flows/FL-MAP-02-browse-zoom.md](flows/FL-MAP-02-browse-zoom.md) | v2 |
| FL-MAP-03 | 像素地图渲染 | MAP-1 | [flows/FL-MAP-03-pixel-render.md](flows/FL-MAP-03-pixel-render.md) | v2 |
| FL-MAP-04 | 行军动画 | MAP-3 | [flows/FL-MAP-04-march-animation.md](flows/FL-MAP-04-march-animation.md) | v2 |
| FL-MAP-05 | 攻城动画 | MAP-4 | [flows/FL-MAP-05-siege-animation.md](flows/FL-MAP-05-siege-animation.md) | v2 |
| FL-MAP-06 | 领土选择与详情 | MAP-3 | [flows/FL-MAP-06-territory-detail.md](flows/FL-MAP-06-territory-detail.md) | v2 |
| FL-MAP-07 | 领土征服 | MAP-3 | [flows/FL-MAP-07-territory-conquest.md](flows/FL-MAP-07-territory-conquest.md) | v2 |
| FL-MAP-08 | 驻防管理 | MAP-3 | [flows/FL-MAP-08-garrison-management.md](flows/FL-MAP-08-garrison-management.md) | v2 |
| FL-MAP-09 | 攻城战 | MAP-4 | [flows/FL-MAP-09-siege-warfare.md](flows/FL-MAP-09-siege-warfare.md) | v2 |
| FL-MAP-10 | 筛选与热力图 | MAP-2 | [flows/FL-MAP-10-filter-heatmap.md](flows/FL-MAP-10-filter-heatmap.md) | v2 |
| FL-MAP-11 | 攻城奖励领取 | MAP-4 | [flows/FL-MAP-11-siege-rewards.md](flows/FL-MAP-11-siege-rewards.md) | v2 |
| FL-MAP-12 | 地图事件处理 | MAP-5 | [flows/FL-MAP-12-map-events.md](flows/FL-MAP-12-map-events.md) | v2 |
| FL-MAP-13 | 地图统计查看 | MAP-6 | [flows/FL-MAP-13-map-statistics.md](flows/FL-MAP-13-map-statistics.md) | v2 |
| FL-MAP-14 | 领土等级提升 | MAP-3 | [flows/FL-MAP-14-territory-levelup.md](flows/FL-MAP-14-territory-levelup.md) | v2 |
| FL-MAP-15 | 离线领土变化查看 | MAP-7 | [flows/FL-MAP-15-offline-changes.md](flows/FL-MAP-15-offline-changes.md) | v2 |
| FL-MAP-16 | 编队系统 | MAP-7 | [flows/FL-MAP-16-expedition-force.md](flows/FL-MAP-16-expedition-force.md) | v2 |
| FL-MAP-17 | 伤亡系统 | MAP-8 | [flows/FL-MAP-17-casualty-system.md](flows/FL-MAP-17-casualty-system.md) | v2 |
| FL-MAP-18 | 手机端适配 | MAP-10 | [flows/FL-MAP-18-mobile-adaptation.md](flows/FL-MAP-18-mobile-adaptation.md) | v2 |

## 子流程索引

| ID | 子流程名称 | 归属流程 | 也服务于 |
|----|-----------|---------|---------|
| FL-MAP-01-01 | 新手引导 | FL-MAP-01 | — |
| FL-MAP-01-02 | 产出上限机制 | FL-MAP-01 | — |
| FL-MAP-02-01 | 缩放约束 | FL-MAP-02 | — |
| FL-MAP-02-02 | 视口裁剪 | FL-MAP-02 | — |
| FL-MAP-03-01 | 地形渲染 | FL-MAP-03 | — |
| FL-MAP-03-02 | 城市渲染 | FL-MAP-03 | — |
| FL-MAP-03-03 | 道路渲染 | FL-MAP-03 | — |
| FL-MAP-03-04 | 视口管理 | FL-MAP-03 | — |
| FL-MAP-04-01 | 路线计算 | FL-MAP-04 | FL-MAP-09 |
| FL-MAP-04-02 | 精灵动画 | FL-MAP-04 | FL-MAP-09 |
| FL-MAP-04-03 | 路线预览 | FL-MAP-04 | — |
| FL-MAP-05-01 | 集结动画 | FL-MAP-05 | FL-MAP-09 |
| FL-MAP-05-02 | 攻城过程动画 | FL-MAP-05 | FL-MAP-09 |
| FL-MAP-05-03 | 结果动画 | FL-MAP-05 | FL-MAP-09 |
| FL-MAP-06-01 | 产出详情展开 | FL-MAP-06 | — |
| FL-MAP-07-01 | 征服失败恢复 | FL-MAP-07 | — |
| FL-MAP-07-02 | 胜率预估 | FL-MAP-07 | FL-MAP-12 |
| FL-MAP-08-01 | 领土放弃 | FL-MAP-08 | — |
| FL-MAP-09-01~15 | 攻城战子流程 | FL-MAP-09 | FL-MAP-05/11/16/17 |
| FL-MAP-10-01 | 筛选器实现逻辑 | FL-MAP-10 | — |
| FL-MAP-11-01~05 | 攻城奖励子流程 | FL-MAP-11 | — |
| FL-MAP-12-01 | 内应信掉落 | FL-MAP-12 | FL-MAP-11 |
| FL-MAP-12-02 | 山贼战斗分支 | FL-MAP-12 | — |
| FL-MAP-14-01 | 等级提升规则详情 | FL-MAP-14 | — |
| FL-MAP-15-01 | 离线事件回归 | FL-MAP-15 | — |
| FL-MAP-15-02 | 双计数器机制 | FL-MAP-15 | — |

## R1 统计

| 指标 | 数值 |
|------|------|
| 流程文档 | 18个 |
| 子流程 | 30+个 |
| R1评审问题 | 82个 (P0:15, P1:30, P2:26, P3:11) |
| R1核验问题 | 55个 (P0:3, P1:14, P2:22, P3:16) |
| P0已修复 | 15/15 (100%) |
| P1已修复 | 44/45 (97.8%) |
| 10维度达标率 | 176/180 (97.8%) |

## R2 统计

| 指标 | 数值 |
|------|------|
| R1遗留P0修复 | 3/3 (100%) |
| R2评审发现 | 35个 (P0:2, P1:14, P2:12, P3:7) |
| R2核验发现 | 25个 (P0:0, P1:5, P2:11, P3:9) |
| P0已修复 | 20/20 (100%) — 含R1 15+R2 5 |
| P1已修复 | 75/75 (100%) — 含R1 44+R2 31 |
| 10维度达标率 | 180/180 (100%) |
| 可实施性(综合) | 96% |
| 跨流程一致性 | 9/10 (90%) |
| 新增产出 | types/map-interfaces.md (30个TS接口) |

## R3 统计

| 指标 | 数值 |
|------|------|
| P2修复 | 25/25 (100%) — 4批修复 |
| P0已修复 | 20/20 (100%) — 维持 |
| P1已修复 | 75/75 (100%) — 维持 |
| 10维度达标率 | 180/180 (100%) — 维持 |
| 可实施性(综合) | 98%+ |
| TS接口定义 | 34个 (新增4个: MapEvent, PathNode, TerritoryType, command字段) |
| 修改文件 | 11个流程文档 |
| 执行方式 | 轻量级修复（无完整三代理循环） |

## R4 质量指标

| 指标 | R3 | R4 | 变化 |
|------|:--:|:--:|:----:|
| 新增流程 | 0 | 1 (FL-MAP-09 L1攻城主流程) | +1 |
| P0已修复 | 20/20 (100%) | 28/28 (100%) | +8 |
| P1已修复 | 75/75 (100%) | 90/90 (100%) | +15 |
| P2已修复 | 25 (8项剩余) | 25项已修复(14项剩余) | +0项修复 |
| 公式矛盾 | 0 | 0 (全部解决) | 持平 |
| 跨流程一致性 | 100% | 100% | 持平 |
| 可实施性 | 98%+ | 99%+ | +1% |

## R1 vs R2 vs R3 vs R4 对比

| 指标 | R1 | R2 | R3 | R4 | 变化(R3->R4) |
|------|:--:|:--:|:--:|:--:|:----:|
| 10维度达标率 | 176/180 (97.8%) | 180/180 (100%) | 180/180 (100%) | 180/180 (100%) | 持平 |
| 未达标维度 | 4个 | 0个 | 0个 | 0个 | 持平 |
| 可实施性 | ~70% | 96% | 98%+ | 99%+ | +1% |
| 架构声明 | 无 | 有 | 有 | 有 | 持平 |
| TS接口定义 | 无 | 30个 | 34个 | 34个 | 持平 |
| 跨流程一致性 | 5/6 (83.3%) | 9/10 (90%) | 10/10 (100%) | 10/10 (100%) | 持平 |
| P2已修复 | 22 (未修复) | 22 (未修复) | 0 (25项已修复) | 0 (25项已修复) | 持平 |

## 术语

| 术语 | 定义 |
|------|------|
| FL-MAP | 天下地图系统流程编号前缀 |
| 旧流程 | 指 docs/games/three-kingdoms/adversarial/flows/map/flows.md（仅参考，不修改） |
| v2 | R1评审修改后的流程文档版本 |
| PRD v2 | MAP-world-prd-v2.md |
| 攻占 | 按钮文案/用户视角的操作名称 |
| 攻城 | 城池战斗系统 (FL-MAP-09) |
| 征服 | 非城池领土的占领流程 (FL-MAP-07) |
| 编队 | 出征部队单位 (FL-MAP-16) |
| 驻防 | 己方领土上的防御兵力部署 |
| 守军 | 敌方/NPC的防御力量 |

## 迭代轮次

| 轮次 | 状态 | 报告 |
|------|:----:|------|
| R0 Setup | 完成 | — |
| R1 首轮全量 | 完成 | [rounds/round-1/report.md](rounds/round-1/report.md) |
| R2 P0修复+P1 | 完成 | [rounds/round-2/report.md](rounds/round-2/report.md) |
| R3 P2修复 | 完成 | [rounds/round-3/report.md](rounds/round-3/report.md) |
| R4 L1攻城主流程 | 完成 | [rounds/round-4/report.md](rounds/round-4/report.md) |

---

*流程索引 v4.0 | 2026-05-05 | R4完成*
