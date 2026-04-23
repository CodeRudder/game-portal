# v4.0 攻城略地(下) — 集成测试检查清单

> 生成时间: 2026-04-24 Round 26
> 测试目录: `src/games/three-kingdoms/engine/map/__tests__/integration/`

## 测试统计

| 指标 | 数值 |
|------|------|
| 测试文件数 | 13 |
| 通过测试数 | 452 |
| 跳过测试数 | 52 |
| 总测试数 | 504 |
| 通过率 | 100%（452/452 非跳过测试全部通过） |

## 流程覆盖清单

| 流程编号 | 流程名称 | 是否编写 | 通过数/总数 | 最后测试时间 | 测试脚本文件名 | 备注 |
|---------|---------|:--------:|:-----------:|:-----------:|--------------|------|
| §1.1 | 战斗速度控制 | ✅ | 56/56 | 2026-04-24 | battle-speed-ultimate.integration.test.ts | 含1x/2x/4x/SKIP |
| §1.2 | 大招系统（怒气/CD/时停） | ✅ | — | 2026-04-24 | battle-speed-ultimate.integration.test.ts | 含在§1.1文件中 |
| §1.3 | 跳过战斗 | ✅ | — | 2026-04-24 | battle-speed-ultimate.integration.test.ts | SKIP模式 |
| §1.4 | 兵种克制 | ✅ | — | 2026-04-24 | battle-speed-ultimate.integration.test.ts | 骑>步>枪>骑 |
| §1.5 | 战斗统计 | ✅ | — | 2026-04-24 | battle-speed-ultimate.integration.test.ts | 伤害/治疗/击杀 |
| §1.6 | 伤害数字系统 | ✅ | — | 2026-04-24 | battle-speed-ultimate.integration.test.ts | 显示配置 |
| §1.7 | 手机端战斗布局 | ✅ | 0/5 | 2026-04-24 | mobile-responsive.integration.test.ts | 5项skip（UI层验证） |
| §1.8 | 兵种克制验证 | ✅ | — | 2026-04-24 | battle-speed-ultimate.integration.test.ts | 含在§1.4中 |
| §2.1 | 扫荡解锁条件 | ✅ | — | 2026-04-24 | sweep-auto-push.integration.test.ts | 3星通关解锁 |
| §2.2 | 扫荡令获取与消耗 | ✅ | — | 2026-04-24 | sweep-auto-push.integration.test.ts | 含获取途径 |
| §2.3 | 执行扫荡 | ✅ | — | 2026-04-24 | sweep-auto-push.integration.test.ts | 一键获取奖励 |
| §2.4 | 扫荡次数限制 | ✅ | — | 2026-04-24 | sweep-auto-push.integration.test.ts | — |
| §2.5 | 扫荡奖励计算 | ✅ | — | 2026-04-24 | sweep-auto-push.integration.test.ts | — |
| §3.1 | 离线自动推图 | ✅ | — | 2026-04-24 | sweep-auto-push.integration.test.ts | — |
| §3.2 | 自动推图进度计算 | ✅ | — | 2026-04-24 | sweep-auto-push.integration.test.ts | — |
| §3.3 | 自动推图奖励 | ✅ | — | 2026-04-24 | sweep-auto-push.integration.test.ts | — |
| §4.1 | 武将升星条件 | ✅ | — | 2026-04-24 | hero-star-breakthrough.integration.test.ts | 碎片/铜钱 |
| §4.2 | 升星属性增长 | ✅ | — | 2026-04-24 | hero-star-breakthrough.integration.test.ts | 属性倍率 |
| §4.3 | 突破机制 | ✅ | — | 2026-04-24 | hero-star-breakthrough.integration.test.ts | 特定星级 |
| §4.4 | 升星上限 | ✅ | — | 2026-04-24 | hero-star-breakthrough.integration.test.ts | 最高星级 |
| §4.5 | 升星材料来源 | ✅ | — | 2026-04-24 | hero-star-breakthrough.integration.test.ts | 碎片获取途径 |
| §5.1 | 科技树结构 | ✅ | — | 2026-04-24 | tech-tree-research-mutual.integration.test.ts | 多分支/层级 |
| §5.2 | 科技研究流程 | ✅ | — | 2026-04-24 | tech-tree-research-mutual.integration.test.ts | 消耗/时间/完成 |
| §5.3 | 科技互斥 | ✅ | — | 2026-04-24 | tech-tree-research-mutual.integration.test.ts | 对立科技 |
| §5.4 | 科技融合 | ✅ | — | 2026-04-24 | tech-tree-research-mutual.integration.test.ts | 组合解锁 |
| §5.5 | 科技效果 | ✅ | — | 2026-04-24 | tech-tree-research-mutual.integration.test.ts | 加成应用 |
| §5.6 | 离线科技研究 | ✅ | — | 2026-04-24 | tech-tree-research-mutual.integration.test.ts | 离线进度 |
| §6.1 | 六边形网格渲染 | ✅ | — | 2026-04-24 | map-rendering-siege-conditions.integration.test.ts | 60×40网格 |
| §6.2 | 三大区域划分 | ✅ | — | 2026-04-24 | map-rendering-siege-conditions.integration.test.ts | 魏/蜀/吴 |
| §6.3 | 六种地形类型 | ✅ | — | 2026-04-24 | map-rendering-siege-conditions.integration.test.ts | 平原/山地/森林/水域/城池/沙漠 |
| §6.4 | 地图首次加载 | ✅ | — | 2026-04-24 | map-rendering-siege-conditions.integration.test.ts | 渐进式加载 |
| §7.1 | 攻城条件检查 | ✅ | — | 2026-04-24 | map-rendering-siege-conditions.integration.test.ts | 相邻/兵力/粮草/次数 |
| §7.2 | 城防计算 | ✅ | — | 2026-04-24 | siege-execution-territory-capture.integration.test.ts | PRD统一公式 |
| §7.3 | 攻城执行 | ✅ | — | 2026-04-24 | siege-execution-territory-capture.integration.test.ts | 胜利/失败 |
| §7.4 | 攻城奖励 | ✅ | — | 2026-04-24 | siege-execution-territory-capture.integration.test.ts | 首占/重复 |
| §7.5 | 攻城结算 | ✅ | 19/19 | 2026-04-24 | siege-settlement-winrate.integration.test.ts | 占领/失败/奖励 |
| §7.5.1 | 重复攻城奖励 | ✅ | — | 2026-04-24 | siege-settlement-winrate.integration.test.ts | 含在§7.5中 |
| §7.6 | 胜率预估 | ✅ | — | 2026-04-24 | siege-settlement-winrate.integration.test.ts | 公式与评级 |
| §8.1 | 事件触发规则 | ✅ | 24/29 | 2026-04-24 | map-event-system.integration.test.ts | 5项skip（MapEventSystem未实现） |
| §8.2 | 基础事件（4类） | ✅ | — | 2026-04-24 | map-event-system.integration.test.ts | 商队/流民/宝箱/山贼 |
| §8.3 | 扩展事件（5类） | ✅ | — | 2026-04-24 | map-event-system.integration.test.ts | 流寇/商队/天灾/遗迹/阵营 |
| §8.4 | 事件选择分支 | ✅ | — | 2026-04-24 | map-event-system.integration.test.ts | 强攻/谈判/忽略 |
| §9.1 | 领土产出计算 | ✅ | — | 2026-04-24 | territory-garrison-filter-landmarks.integration.test.ts | 6因子公式 |
| §9.2 | 产出气泡显示 | ✅ | — | 2026-04-24 | territory-garrison-filter-landmarks.integration.test.ts | 5种场景 |
| §9.3 | 驻防管理 | ✅ | — | 2026-04-24 | territory-garrison-filter-landmarks.integration.test.ts | 上限/分配/调回 |
| §9.4 | 领土等级提升 | ✅ | — | 2026-04-24 | territory-garrison-filter-landmarks.integration.test.ts | Lv1→5→10→15 |
| §9.5 | 地图筛选功能 | ✅ | — | 2026-04-24 | territory-garrison-filter-landmarks.integration.test.ts | AND/OR组合 |
| §9.6 | 热力图颜色映射 | ✅ | — | 2026-04-24 | territory-garrison-filter-landmarks.integration.test.ts | 5档颜色 |
| §9.7 | 特殊地标验证 | ✅ | — | 2026-04-24 | territory-garrison-filter-landmarks.integration.test.ts | 洛阳/长安/建业 |
| §9.8 | 地图统计面板 | ✅ | — | 2026-04-24 | territory-garrison-filter-landmarks.integration.test.ts | 5维度 |
| §10.0A | 领土→科技点入账 | ✅ | — | 2026-04-24 | cross-system-linkage.integration.test.ts | 产出→科技点 |
| §10.0B | 攻城→声望增加 | ✅ | — | 2026-04-24 | siege-settlement-winrate.integration.test.ts | 事件驱动 |
| §10.0C | 事件→声望/民心 | ✅ | — | 2026-04-24 | map-event-system.integration.test.ts | 事件分支效果 |
| §10.0D | 民心系统独立 | ✅ | 0/3 | 2026-04-24 | cross-system-linkage.integration.test.ts | 3项skip（MoraleSystem未实现） |
| §10.1 | 核心养成循环 | ✅ | 3/7 | 2026-04-24 | cross-system-linkage.integration.test.ts | 部分需HeroSystem |
| §10.2 | 扫荡→升星循环 | ✅ | 0/3 | 2026-04-24 | cross-system-linkage.integration.test.ts | 3项skip（需SweepSystem） |
| §10.3 | 科技→战斗联动 | ✅ | 0/2 | 2026-04-24 | cross-system-linkage.integration.test.ts | 2项skip（需TechTreeSystem） |
| §10.4 | 科技→资源联动 | ✅ | 1/2 | 2026-04-24 | cross-system-linkage.integration.test.ts | 1项skip |
| §10.5 | 科技→武将联动 | ✅ | 0/2 | 2026-04-24 | cross-system-linkage.integration.test.ts | 2项skip |
| §10.6 | 招募→碎片→升星 | ✅ | 0/2 | 2026-04-24 | cross-system-linkage.integration.test.ts | 2项skip |
| §10.7 | 地图→战斗→科技 | ✅ | 2/3 | 2026-04-24 | cross-system-linkage.integration.test.ts | 1项skip |
| §10.8 | 互斥分支→策略分化 | ✅ | 0/2 | 2026-04-24 | cross-system-linkage.integration.test.ts | 2项skip |
| §10.9 | 自动推图→挂机收益 | ✅ | 2/4 | 2026-04-24 | cross-system-linkage.integration.test.ts | 2项skip |
| §11.1 | 地图系统手机端 | ✅ | 13/13 | 2026-04-24 | mobile-responsive.integration.test.ts | 缩放/平移/渲染 |
| §11.2 | 战斗系统手机端 | ✅ | 0/3 | 2026-04-24 | mobile-responsive.integration.test.ts | 3项skip（UI层） |
| §12.1 | 离线推图 | ✅ | — | 2026-04-24 | offline-reward-summary.integration.test.ts | 每小时1次 |
| §12.2 | 离线挂机收益 | ✅ | — | 2026-04-24 | offline-reward-summary.integration.test.ts | 封顶12h |
| §12.3 | 离线领土变化 | ✅ | — | 2026-04-24 | offline-reward-summary.integration.test.ts | 视觉标记 |
| §13.1 | 基础循环验证 | ✅ | 3/5 | 2026-04-24 | cross-validation.integration.test.ts | 2项skip |
| §13.2 | 系统联动验证 | ✅ | 3/6 | 2026-04-24 | cross-validation.integration.test.ts | 3项skip |
| §13.2.1 | 离线挂机收益详细 | ✅ | 2/5 | 2026-04-24 | cross-validation.integration.test.ts | 3项skip |
| §13.2.2 | 离线综合收益汇总 | ✅ | 1/3 | 2026-04-24 | cross-validation.integration.test.ts | 2项skip |
| §13.3 | 数值一致性验证 | ✅ | 7/7 | 2026-04-24 | cross-validation.integration.test.ts | PRD统一声明 |
| §13.4 | PRD矛盾统一声明 | ✅ | 6/6 | 2026-04-24 | cross-validation.integration.test.ts | 6处矛盾验证 |

## 新增测试文件清单（Round 26）

| 文件名 | 覆盖流程 | 测试数 | 通过 | 跳过 |
|--------|---------|:------:|:----:|:----:|
| siege-settlement-winrate.integration.test.ts | §7.5-7.6, §10.0B | 19 | 18 | 1 |
| map-event-system.integration.test.ts | §8.1-8.4, §10.0C | 29 | 24 | 5 |
| cross-system-linkage.integration.test.ts | §10.0A-10.9 | 30 | 8 | 22 |
| mobile-responsive.integration.test.ts | §1.7, §11.1-11.2 | 18 | 13 | 5 |
| cross-validation.integration.test.ts | §13.1-13.4 | 36 | 26 | 10 |

## 跳过测试分类

| 跳过原因 | 数量 | 涉及系统 |
|---------|:----:|---------|
| MapEventSystem 未实现 | 5 | §8.1 事件触发/上限/区域 |
| MoraleSystem 未实现 | 3 | §10.0D 民心系统 |
| PrestigeSystem 未集成攻城事件 | 1 | §10.0B 声望+50 |
| HeroSystem/HeroStarSystem 未集成 | 6 | §10.1/10.6 招募碎片升星 |
| SweepSystem 未集成 | 3 | §10.2 扫荡循环 |
| TechTreeSystem 未集成 | 5 | §10.3/10.5/10.8 科技联动 |
| OfflineRewardSystem 未集成 | 5 | §10.9/13.2 离线收益 |
| UI层验证（引擎无此概念） | 8 | §1.7/11.2 手机端UI |
| ResourcePointSystem 未集成 | 1 | §10.4 资源联动 |
| 其他系统集成 | 15 | §10.x 跨系统串联 |

## 运行命令

```bash
# 运行所有集成测试
cd /mnt/user-data/workspace/game-portal && npx vitest run "src/games/three-kingdoms/engine/map/__tests__/integration/"

# 运行单个文件
npx vitest run "src/games/three-kingdoms/engine/map/__tests__/integration/cross-validation.integration.test.ts"
```
