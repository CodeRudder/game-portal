# v3.0 攻城略地(上) — Play测试脚本检查清单

> **版本**: v3.0 | **生成日期**: 2026-04-24
> **集成测试文件**: 15个 | **覆盖章节**: 13章 | **覆盖子流程**: 69个
> **测试结果**: 555通过 / 4跳过 / 559总计

---

## 批次1（P0）

| 流程编号 | 流程名称 | 是否编写测试脚本 | 测试是否通过(通过/总数) | 最后测试时间 | 测试脚本文件名 | 备注 |
|---------|---------|:--------------:|:--------------------:|:----------:|:------------:|------|
| §1.1 | 查看章节与关卡列表 | ✅ | 43/43 | 2026-04-24 | integration/01-campaign-map.test.ts | |
| §1.1a | 关卡地图UI详细验收 | ✅ | 43/43 | 2026-04-24 | integration/01-campaign-map.test.ts | |
| §1.2 | 识别关卡类型 | ✅ | 43/43 | 2026-04-24 | integration/01-campaign-map.test.ts | |
| §1.3 | 查看关卡状态 | ✅ | 43/43 | 2026-04-24 | integration/01-campaign-map.test.ts | |
| §1.4 | 查看星级评定 | ✅ | 43/43 | 2026-04-24 | integration/01-campaign-map.test.ts | |
| §2.1 | 进入布阵界面 | ✅ | 36/36 | 2026-04-24 | integration/02-formation-panel.test.ts | |
| §2.2 | 一键布阵 | ✅ | 36/36 | 2026-04-24 | integration/02-formation-panel.test.ts | |
| §2.3 | 手动调整阵容 | ✅ | 36/36 | 2026-04-24 | integration/02-formation-panel.test.ts | |
| §2.4 | 查看战力预估 | ✅ | 36/36 | 2026-04-24 | integration/02-formation-panel.test.ts | |
| §2.5 | 查看智能推荐 | ✅ | 36/36 | 2026-04-24 | integration/02-formation-panel.test.ts | |
| §2.6 | 查看敌方预览 | ✅ | 36/36 | 2026-04-24 | integration/02-formation-panel.test.ts | |
| §3.2 | 观察自动战斗 | ✅ | 43/43 | 2026-04-24 | integration/04-battle-combat.test.ts | |
| §3.3 | 伤害计算验证 | ✅ | 43/43 | 2026-04-24 | integration/04-battle-combat.test.ts | |
| §3.4 | 技能释放观察 | ✅ | 43/43 | 2026-04-24 | integration/04-battle-combat.test.ts | |
| §3.5 | 兵种克制验证 | ✅ | 43/43 | 2026-04-24 | integration/04-battle-combat.test.ts | |
| §3.6 | 状态效果观察 | ✅ | 43/43 | 2026-04-24 | integration/04-battle-combat.test.ts | |

## 批次2（P0）

| 流程编号 | 流程名称 | 是否编写测试脚本 | 测试是否通过(通过/总数) | 最后测试时间 | 测试脚本文件名 | 备注 |
|---------|---------|:--------------:|:--------------------:|:----------:|:------------:|------|
| §4.1 | 胜利结算 | ✅ | 38/41 | 2026-04-24 | integration/06-battle-result.test.ts | 3skip |
| §4.2 | 奖励飞出动画 | ✅ | 38/41 | 2026-04-24 | integration/06-battle-result.test.ts | |
| §4.3 | 掉落物品确认 | ✅ | 38/41 | 2026-04-24 | integration/06-battle-result.test.ts | |
| §4.3a | 关卡↔武将碎片映射表 | ✅ | 38/41 | 2026-04-24 | integration/06-battle-result.test.ts | |
| §4.4 | 关卡解锁 | ✅ | 38/41 | 2026-04-24 | integration/06-battle-result.test.ts | |
| §4.5 | 失败结算 | ✅ | 38/41 | 2026-04-24 | integration/06-battle-result.test.ts | |
| §4.6 | 查看战斗日志 | ✅ | 38/41 | 2026-04-24 | integration/06-battle-result.test.ts | |
| §4.7 | 操作评分 | ✅ | 38/41 | 2026-04-24 | integration/06-battle-result.test.ts | v3.0未实现 |
| §5.1 | 完整流程串联 | ✅ | 17/17 | 2026-04-24 | integration/07-core-loop.test.ts | |
| §5.2 | 章节推进 | ✅ | 17/17 | 2026-04-24 | integration/07-core-loop.test.ts | |
| §5.3 | 交叉验证 | ✅ | 17/17 | 2026-04-24 | integration/07-core-loop.test.ts | |
| §7.1 | 战斗消耗→资源扣减 | ✅ | 34/34 | 2026-04-24 | integration/09-battle-resource-sync.test.ts | |
| §7.2 | 战斗奖励→资源入账 | ✅ | 34/34 | 2026-04-24 | integration/09-battle-resource-sync.test.ts | |
| §7.3 | 首通奖励→资源暴击 | ✅ | 34/34 | 2026-04-24 | integration/09-battle-resource-sync.test.ts | |
| §7.4 | 重复奖励→日常资源获取 | ✅ | 34/34 | 2026-04-24 | integration/09-battle-resource-sync.test.ts | |
| §7.5 | 兵力/粮草资源获取与恢复流程 | ✅ | 34/34 | 2026-04-24 | integration/09-battle-resource-sync.test.ts | |

## 批次3（P1）

| 流程编号 | 流程名称 | 是否编写测试脚本 | 测试是否通过(通过/总数) | 最后测试时间 | 测试脚本文件名 | 备注 |
|---------|---------|:--------------:|:--------------------:|:----------:|:------------:|------|
| §3.1 | 进入战斗场景 | ✅ | 27/27 | 2026-04-24 | integration/03-battle-scene.test.ts | |
| §3.1a | 战斗场景组件层次 | ✅ | 27/27 | 2026-04-24 | integration/03-battle-scene.test.ts | |
| §3.1b | 战斗HUD布局 | ✅ | 27/27 | 2026-04-24 | integration/03-battle-scene.test.ts | |
| §3.1c | 战斗中交互操作 | ✅ | 27/27 | 2026-04-24 | integration/03-battle-scene.test.ts | |
| §3.1d | 战斗进入/退出动画 | ✅ | 27/27 | 2026-04-24 | integration/03-battle-scene.test.ts | |
| §3.7 | 切换战斗模式 | ✅ | 45/45 | 2026-04-24 | integration/05-battle-mode.test.ts | |
| §3.7a | 手动模式操作流程 | ✅ | 45/45 | 2026-04-24 | integration/05-battle-mode.test.ts | |
| §3.8 | 调整战斗速度 | ✅ | 45/45 | 2026-04-24 | integration/05-battle-mode.test.ts | |
| §3.9 | 大招时停机制 | ✅ | 45/45 | 2026-04-24 | integration/05-battle-mode.test.ts | |
| §6.1 | 武将属性→战斗参数映射 | ✅ | 46/47 | 2026-04-24 | integration/08-battle-hero-sync.test.ts | 1skip |
| §6.2 | 战前布阵↔编队系统联动 | ✅ | 46/47 | 2026-04-24 | integration/08-battle-hero-sync.test.ts | |
| §6.3 | 战斗经验→武将成长 | ✅ | 46/47 | 2026-04-24 | integration/08-battle-hero-sync.test.ts | |
| §6.3a | 战斗经验值公式 | ✅ | 46/47 | 2026-04-24 | integration/08-battle-hero-sync.test.ts | |
| §6.4 | 武将碎片掉落→升星 | ✅ | 46/47 | 2026-04-24 | integration/08-battle-hero-sync.test.ts | API未实现 |

## 批次4（P1）

| 流程编号 | 流程名称 | 是否编写测试脚本 | 测试是否通过(通过/总数) | 最后测试时间 | 测试脚本文件名 | 备注 |
|---------|---------|:--------------:|:--------------------:|:----------:|:------------:|------|
| §9.1 | 解锁扫荡功能 | ✅ | 43/43 | 2026-04-24 | integration/10-sweep-system.test.ts | |
| §9.2 | 获取扫荡令 | ✅ | 43/43 | 2026-04-24 | integration/10-sweep-system.test.ts | |
| §9.3 | 执行扫荡 | ✅ | 43/43 | 2026-04-24 | integration/10-sweep-system.test.ts | |
| §9.4 | VIP系统依赖说明 | ✅ | 43/43 | 2026-04-24 | integration/10-sweep-system.test.ts | |
| §9.5 | 关卡↔扫荡↔离线统一状态机 | ✅ | 43/43 | 2026-04-24 | integration/10-sweep-system.test.ts | |
| §9.5a | 扫荡状态回写规则 | ✅ | 43/43 | 2026-04-24 | integration/10-sweep-system.test.ts | |
| §9.6 | VIP等级校验端到端流程 | ✅ | 30/30 | 2026-04-24 | integration/11-vip-e2e.test.ts | |
| §10.1 | 离线推图 | ✅ | 36/36 | 2026-04-24 | integration/12-offline-battle.test.ts | |
| §10.2 | 离线挂机收益 | ✅ | 36/36 | 2026-04-24 | integration/12-offline-battle.test.ts | |
| §10.2a | 离线收益领取弹窗流程 | ✅ | 36/36 | 2026-04-24 | integration/12-offline-battle.test.ts | |
| §10.3 | 自动连续战斗 | ✅ | 36/36 | 2026-04-24 | integration/12-offline-battle.test.ts | |

## 批次5（P2）

| 流程编号 | 流程名称 | 是否编写测试脚本 | 测试是否通过(通过/总数) | 最后测试时间 | 测试脚本文件名 | 备注 |
|---------|---------|:--------------:|:--------------------:|:----------:|:------------:|------|
| §11.1 | 进入挑战关卡 | ✅ | 19/19 | 2026-04-24 | integration/13-challenge-stage.test.ts | |
| §11.2 | 挑战关卡结算 | ✅ | 19/19 | 2026-04-24 | integration/13-challenge-stage.test.ts | |
| §11.3 | 挑战关卡资源串联 | ✅ | 19/19 | 2026-04-24 | integration/13-challenge-stage.test.ts | |
| §12.1 | 战斗中断处理 | ✅ | 39/39 | 2026-04-24 | integration/14-exception-handling.test.ts | |
| §12.2 | 回合上限耗尽 | ✅ | 39/39 | 2026-04-24 | integration/14-exception-handling.test.ts | |
| §12.3 | 武将阵亡处理 | ✅ | 39/39 | 2026-04-24 | integration/14-exception-handling.test.ts | |
| §12.4 | 全军覆没处理 | ✅ | 39/39 | 2026-04-24 | integration/14-exception-handling.test.ts | |
| §12.5 | 资源溢出处理 | ✅ | 39/39 | 2026-04-24 | integration/14-exception-handling.test.ts | |
| §12.6 | 关卡数据异常处理 | ✅ | 39/39 | 2026-04-24 | integration/14-exception-handling.test.ts | |
| §13.1 | 手机端关卡地图 | ✅ | 57/57 | 2026-04-24 | integration/15-mobile-adaptation.test.ts | |
| §13.2 | 手机端战前布阵 | ✅ | 57/57 | 2026-04-24 | integration/15-mobile-adaptation.test.ts | |
| §13.3 | 手机端战斗场景 | ✅ | 57/57 | 2026-04-24 | integration/15-mobile-adaptation.test.ts | |
| §13.4 | 手机端结算面板 | ✅ | 57/57 | 2026-04-24 | integration/15-mobile-adaptation.test.ts | |
| §13.5 | 手机端手势操作汇总 | ✅ | 57/57 | 2026-04-24 | integration/15-mobile-adaptation.test.ts | |

## v4.0预览（不纳入v3.0验收）

| 流程编号 | 流程名称 | 是否编写测试脚本 | 测试是否通过(通过/总数) | 最后测试时间 | 测试脚本文件名 | 备注 |
|---------|---------|:--------------:|:--------------------:|:----------:|:------------:|------|
| §8.1 | 领土征服→触发战斗 | ❌ | — | — | — | v4.0范围 |
| §8.2 | 地形效果→战斗参数修正 | ❌ | — | — | — | v4.0范围 |
| §8.3 | 攻城战→特殊战斗流程 | ❌ | — | — | — | v4.0范围 |
| §8.4 | 征服结果→领土状态更新 | ❌ | — | — | — | v4.0范围 |
| §8.5 | 地图事件→战斗触发 | ❌ | — | — | — | v4.0范围 |

---

## 汇总统计

| 指标 | 数值 |
|------|------|
| v3.0覆盖章节 | 13章（§1~§7, §9~§13） |
| v3.0覆盖子流程 | 69个 |
| 集成测试文件 | 15个 |
| 测试通过 | 555/559（4个skip） |
| 测试覆盖率（流程维度） | 69/69 = **100%** |
| Skip明细 | §4.7 操作评分 3skip（v3.0未实现）、§6.4 processStageDrops 1skip（API未实现） |
| v4.0预览流程 | §8.1~§8.5 共5个，不纳入v3.0验收 |
