# 天下地图系统 — 流程文档索引

> **更新日期**: 2026-05-05 | **版本**: v3.3.R4 (R4修复中)
> **总流程数**: 18 | **状态**: R4 P0/P1修复完成（8项P0+12项P1全部解决）
> **达标率**: 180/180 = 100%

## 按功能模块

### 地图核心
| ID | 流程名称 | 文件 | PRD来源 | 状态 |
|----|---------|------|---------|:----:|
| FL-MAP-01 | 进入天下Tab | [FL-MAP-01-enter-tab.md](FL-MAP-01-enter-tab.md) | MAP-1 | v3.4 |
| FL-MAP-02 | 地图浏览与缩放 | [FL-MAP-02-browse-zoom.md](FL-MAP-02-browse-zoom.md) | MAP-1 | v3.2 |
| FL-MAP-03 | 像素地图渲染 | [FL-MAP-03-pixel-render.md](FL-MAP-03-pixel-render.md) | MAP-1 | v3.1 |
| FL-MAP-10 | 筛选与热力图 | [FL-MAP-10-filter-heatmap.md](FL-MAP-10-filter-heatmap.md) | MAP-2 | v3.2 |

### 动画系统
| ID | 流程名称 | 文件 | PRD来源 | 状态 |
|----|---------|------|---------|:----:|
| FL-MAP-04 | 行军动画 | [FL-MAP-04-march-animation.md](FL-MAP-04-march-animation.md) | MAP-3 | v3.3 |
| FL-MAP-05 | 攻城动画 | [FL-MAP-05-siege-animation.md](FL-MAP-05-siege-animation.md) | MAP-4 | v3.2 |

### 领土管理
| ID | 流程名称 | 文件 | PRD来源 | 状态 |
|----|---------|------|---------|:----:|
| FL-MAP-06 | 领土选择与详情 | [FL-MAP-06-territory-detail.md](FL-MAP-06-territory-detail.md) | MAP-3 | v3.3 |
| FL-MAP-07 | 领土征服 | [FL-MAP-07-territory-conquest.md](FL-MAP-07-territory-conquest.md) | MAP-3 | v3.4 |
| FL-MAP-08 | 驻防管理 | [FL-MAP-08-garrison-management.md](FL-MAP-08-garrison-management.md) | MAP-3 | v3.2 |
| FL-MAP-14 | 领土等级提升 | [FL-MAP-14-territory-levelup.md](FL-MAP-14-territory-levelup.md) | MAP-3 | v3.2 |
| FL-MAP-15 | 离线领土变化查看 | [FL-MAP-15-offline-changes.md](FL-MAP-15-offline-changes.md) | MAP-7 | v3.2 |

### 攻城战系统
| ID | 流程名称 | 文件 | PRD来源 | 状态 |
|----|---------|------|---------|:----:|
| FL-MAP-09 | **攻城主流程 (L1)** | [FL-MAP-09-攻城主流程.md](FL-MAP-09-攻城主流程.md) | MAP-4 | v1.1.R4 |
| FL-MAP-09 | 攻城战 (L2+) | [FL-MAP-09-siege-warfare.md](FL-MAP-09-siege-warfare.md) | MAP-4 | v6.4.R4 |
| FL-MAP-11 | 攻城奖励领取 | [FL-MAP-11-siege-rewards.md](FL-MAP-11-siege-rewards.md) | MAP-4 | v3.4 |
| FL-MAP-16 | 编队系统 | [FL-MAP-16-expedition-force.md](FL-MAP-16-expedition-force.md) | MAP-7 | v4.1 |
| FL-MAP-17 | 伤亡系统 | [FL-MAP-17-casualty-system.md](FL-MAP-17-casualty-system.md) | MAP-8 | v3.1 |

### 地图事件与统计
| ID | 流程名称 | 文件 | PRD来源 | 状态 |
|----|---------|------|---------|:----:|
| FL-MAP-12 | 地图事件处理 | [FL-MAP-12-map-events.md](FL-MAP-12-map-events.md) | MAP-5 | v3.4 |
| FL-MAP-13 | 地图统计查看 | [FL-MAP-13-map-statistics.md](FL-MAP-13-map-statistics.md) | MAP-6 | v3.1 |

### 跨切面
| ID | 流程名称 | 文件 | PRD来源 | 状态 |
|----|---------|------|---------|:----:|
| FL-MAP-18 | 手机端适配 | [FL-MAP-18-mobile-adaptation.md](FL-MAP-18-mobile-adaptation.md) | MAP-10 | v2.3 |

## 子流程索引

| 子流程ID | 名称 | 归属主流程 | 文件位置 |
|---------|------|-----------|---------|
| FL-MAP-01-01 | 新手引导 | FL-MAP-01 | [FL-MAP-01-enter-tab.md](FL-MAP-01-enter-tab.md) |
| FL-MAP-01-02 | 产出上限机制 | FL-MAP-01 | [FL-MAP-01-enter-tab.md](FL-MAP-01-enter-tab.md) |
| FL-MAP-02-01 | 缩放约束 | FL-MAP-02 | [FL-MAP-02-browse-zoom.md](FL-MAP-02-browse-zoom.md) |
| FL-MAP-02-02 | 视口裁剪 | FL-MAP-02 | [FL-MAP-02-browse-zoom.md](FL-MAP-02-browse-zoom.md) |
| FL-MAP-03-01 | 地形渲染 | FL-MAP-03 | [FL-MAP-03-pixel-render.md](FL-MAP-03-pixel-render.md) |
| FL-MAP-03-02 | 城市渲染 | FL-MAP-03 | [FL-MAP-03-pixel-render.md](FL-MAP-03-pixel-render.md) |
| FL-MAP-03-03 | 道路渲染 | FL-MAP-03 | [FL-MAP-03-pixel-render.md](FL-MAP-03-pixel-render.md) |
| FL-MAP-03-04 | 视口管理 | FL-MAP-03 | [FL-MAP-03-pixel-render.md](FL-MAP-03-pixel-render.md) |
| FL-MAP-04-01 | 路线计算 | FL-MAP-04 | [FL-MAP-04-march-animation.md](FL-MAP-04-march-animation.md) |
| FL-MAP-04-02 | 精灵动画 | FL-MAP-04 | [FL-MAP-04-march-animation.md](FL-MAP-04-march-animation.md) |
| FL-MAP-04-03 | 路线预览 | FL-MAP-04 | [FL-MAP-04-march-animation.md](FL-MAP-04-march-animation.md) |
| FL-MAP-05-01 | 集结动画 | FL-MAP-05 | [FL-MAP-05-siege-animation.md](FL-MAP-05-siege-animation.md) |
| FL-MAP-05-02 | 攻城过程动画 | FL-MAP-05 | [FL-MAP-05-siege-animation.md](FL-MAP-05-siege-animation.md) |
| FL-MAP-05-03 | 结果动画 | FL-MAP-05 | [FL-MAP-05-siege-animation.md](FL-MAP-05-siege-animation.md) |
| FL-MAP-06-01 | 产出详情展开 | FL-MAP-06 | [FL-MAP-06-territory-detail.md](FL-MAP-06-territory-detail.md) |
| FL-MAP-07-01 | 征服失败恢复 | FL-MAP-07 | [FL-MAP-07-territory-conquest.md](FL-MAP-07-territory-conquest.md) |
| FL-MAP-07-02 | 胜率预估 | FL-MAP-07 | [FL-MAP-07-territory-conquest.md](FL-MAP-07-territory-conquest.md) |
| FL-MAP-08-01 | 领土放弃 | FL-MAP-08 | [FL-MAP-08-garrison-management.md](FL-MAP-08-garrison-management.md) |
| FL-MAP-09-01~15 | 攻城战子流程 | FL-MAP-09 | [FL-MAP-09-siege-warfare.md](FL-MAP-09-siege-warfare.md) |
| FL-MAP-10-01 | 筛选器实现逻辑 | FL-MAP-10 | [FL-MAP-10-filter-heatmap.md](FL-MAP-10-filter-heatmap.md) |
| FL-MAP-11-01 | 攻城胜利内应信掉落 | FL-MAP-11 | [FL-MAP-11-siege-rewards.md](FL-MAP-11-siege-rewards.md) |
| FL-MAP-11-02 | 背包溢出处理 | FL-MAP-11 | [FL-MAP-11-siege-rewards.md](FL-MAP-11-siege-rewards.md) |
| FL-MAP-11-03 | PendingReward数据结构 | FL-MAP-11 | [FL-MAP-11-siege-rewards.md](FL-MAP-11-siege-rewards.md) |
| FL-MAP-11-04 | 领取网络中断处理 | FL-MAP-11 | [FL-MAP-11-siege-rewards.md](FL-MAP-11-siege-rewards.md) |
| FL-MAP-11-05 | 背包溢出体验优化 | FL-MAP-11 | [FL-MAP-11-siege-rewards.md](FL-MAP-11-siege-rewards.md) |
| FL-MAP-12-01 | 内应信掉落 | FL-MAP-12 | [FL-MAP-12-map-events.md](FL-MAP-12-map-events.md) |
| FL-MAP-12-02 | 山贼战斗分支 | FL-MAP-12 | [FL-MAP-12-map-events.md](FL-MAP-12-map-events.md) |
| FL-MAP-14-01 | 等级提升规则详情 | FL-MAP-14 | [FL-MAP-14-territory-levelup.md](FL-MAP-14-territory-levelup.md) |
| FL-MAP-15-01 | 离线事件回归 | FL-MAP-15 | [FL-MAP-15-offline-changes.md](FL-MAP-15-offline-changes.md) |
| FL-MAP-15-02 | 双计数器机制 | FL-MAP-15 | [FL-MAP-15-offline-changes.md](FL-MAP-15-offline-changes.md) |

## 跨流程引用关系

```
FL-MAP-01 ──→ FL-MAP-02, FL-MAP-03, FL-MAP-10
FL-MAP-02 ──→ FL-MAP-03, FL-MAP-06, FL-MAP-10
FL-MAP-04 ──→ FL-MAP-03 (叠加渲染)
FL-MAP-05 ──→ FL-MAP-03 (覆盖层), FL-MAP-09 (P7/P8/P9)
FL-MAP-06 ──→ FL-MAP-07, FL-MAP-08, FL-MAP-09, FL-MAP-14
FL-MAP-07 ──→ FL-MAP-08, FL-MAP-17
FL-MAP-08 ──→ FL-MAP-06, FL-MAP-07, FL-MAP-09
FL-MAP-09 ──→ FL-MAP-04, FL-MAP-05, FL-MAP-11, FL-MAP-16, FL-MAP-17
FL-MAP-11 ──→ FL-MAP-09, FL-MAP-12, FL-MAP-08
FL-MAP-12 ──→ FL-MAP-07 (事件战斗分支)
FL-MAP-15 ──→ FL-MAP-12, FL-MAP-06
FL-MAP-17 ──→ FL-MAP-09, FL-MAP-07
FL-MAP-18 ──→ (跨切面，影响所有UI流程)
```

## 架构假设声明

> **本系统为纯客户端本地游戏**，所有数据存储在 localStorage/IndexedDB，无服务端依赖。
> AI敌方行为由本地引擎驱动，无网络通信。
>
> **影响范围**:
> - 敌方行军实体 (FL-MAP-04): 由本地AI触发，非服务端推送
> - 攻城战斗 (FL-MAP-09): 本地战斗引擎计算结果
> - 离线变化 (FL-MAP-15): 基于时间戳差值本地模拟，非服务端同步
> - 数据结构 (types/map-interfaces.md): 所有接口为本地数据模型，无API响应类型

## R2 质量指标

| 指标 | R1 | R2 | 变化 |
|------|:--:|:--:|:----:|
| P0已修复 | 15/15 (100%) | 20/20 (100%) | +5 |
| P1已修复 | 44/45 (97.8%) | 75/75 (100%) | +31 |
| 10维度达标率 | 176/180 (97.8%) | 180/180 (100%) | +2.2% |
| 跨流程一致性 | 5/6 (83.3%) | 10/10 (100%) | +16.7% |
| 可实施性(综合) | ~70% | 96% | +26% |
| TS接口定义 | 无 | 30个接口/类型 | 新增 |

## R3 质量指标

| 指标 | R2 | R3 | 变化 |
|------|:--:|:--:|:----:|
| P0已修复 | 20/20 (100%) | 20/20 (100%) | 持平 |
| P1已修复 | 75/75 (100%) | 75/75 (100%) | 持平 |
| P2已修复 | 22 (未修复) | 25项已修复(~8项剩余) | +25项修复 |
| 10维度达标率 | 180/180 (100%) | 180/180 (100%) | 持平 |
| 可实施性(综合) | 96% | 98%+ | +2%+ |
| TS接口定义 | 30个 | 34个 | +4 |

## AI 敌方系统范围声明

> **当前状态**: AI 敌方行为规则已在R2中定义基础框架。以下流程中提及的 AI 行为由本地引擎驱动：
> - FL-MAP-04 行军拦截: AI行军触发条件和敌方数据来源已补充
> - FL-MAP-09 攻城战: 本地战斗引擎声明（FR-09-ARCH）已添加
> - FL-MAP-06 E06-04: "已被 AI 敌方占领"场景
> - FL-MAP-12 地图事件: AI 相关事件
> - FL-MAP-15 离线变化: 基于时间戳差值本地模拟产出/事件
>
> 当前阶段，离线变化模拟产出/事件，不模拟AI领土变化。行军拦截使用简化规则。

## R3完成 — 后续待处理

- [x] 25项P2全部修复完毕
- [ ] 21项P3 Backlog（低优先级优化，实施阶段随需处理）
- [x] 综合可实施性目标: 98%+ 已达成

---

*流程文档索引 v3.3.R4 | 2026-05-05 | R4 P0/P1修复完成*
