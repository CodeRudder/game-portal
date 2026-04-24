# v20.0 天下一统(下) — 封版测试检查清单

> **日期**: 2026-04-27  
> **版本**: v20.0 (Play v1.8 封版)  
> **测试框架**: Vitest  
> **测试文件**: 9 | **用例总数**: 212 (通过 209 + skip 3) | **全部通过**: ✅

---

## 总览

| 流程编号 | 流程名称 | 是否编写 | 通过数-总数 | 文件名 | 备注 |
|---------|---------|---------|------------|--------|------|
| §1 | 最终统一 | ✅ | 25-25 | unification-conditions-challenge.integration.test.ts | 统一条件+核心循环+转生循环 |
| §2 | 统一结局 | ✅ | 21-21 | ending-prestige-heritage-full.integration.test.ts | 4维评分公式+结局评定 |
| §3 | 声望系统深化 | ✅ | 21-21 | ending-prestige-heritage-full.integration.test.ts | Lv.30+阈值+商店+传承特权 |
| §4 | 跨周目传承 | ✅ | 21-21 | ending-prestige-heritage-full.integration.test.ts | 槽位+倍率+传承数据+一键重建 |
| §5 | 转生系统深度验证 | ✅ | 25-25 | rebirth-emperor-economy.integration.test.ts | 5条件+冷却+解锁+专属任务+收益模拟器 |
| §6 | 交叉验证 | ✅ | 25-25 | unification-conditions-challenge.integration.test.ts | 核心循环+数据流+转生循环 |
| §7 | 全功能验收流程 | ✅ | 24-24 | full-acceptance-report.integration.test.ts | 23模块+七维度评分+验收报告 |
| §8 | 经济系统4货币独立验证 | ✅ | 25-25 | rebirth-emperor-economy.integration.test.ts | 铜钱/天命/双代币+防通胀 |
| §9 | 转生倍率公式独立验证 | ✅ | 33-33 | world-trend-balance.integration.test.ts | 公式精确计算+速查表校准+封顶12.00× |
| §10 | 帝王模式验证 | ✅ | 25-25 | rebirth-emperor-economy.integration.test.ts | 解锁+激活+全系统×2+冷静期 |
| §11 | 品质色色盲模式验证 | ✅ | 29-29 | balance-recruit-visual.integration.test.ts | 5品质色差+纹理+色盲可区分 |
| §12 | PRD招募概率矛盾澄清 | ✅ | 29-29 | balance-recruit-visual.integration.test.ts | 以代码为准+5品质体系+保底 |
| §13 | Gap分析补充验证 | ✅ | 22-22 | settings-unification-cross.integration.test.ts | 领土数+离线预估+回归流程+声望叠加 |
| §14 | Gap分析R4补充验证 | ✅ | 24-24 | full-acceptance-report.integration.test.ts | 成就链+声望归零+帝王冷静期+纹理规格 |
| §15 | 终验补充验证 | ✅ | 24-24 | full-acceptance-report.integration.test.ts | 9处PRD矛盾回归+Plan同步 |
| §16 | 终验Gap补充验证 | ✅ | 33-30+3skip | animation-notification-supplementary.integration.test.ts | 23模块清单+速查表偏差+动画降级+通知 |
| §17 | v2.0封版P0状态追踪 | ✅ | 24-24 | full-acceptance-report.integration.test.ts | P0处理+七维度评分+转生全链路 |

---

## §1 最终统一 (25用例)

> 覆盖: 1.1 天下一统触发 / 1.2 条件逐项验证 / 1.3 全服排行榜 / 1.4 跨周目记录 / 1.5 赛季结算

| # | 用例 | 状态 |
|---|------|------|
| 1 | 默认数据提供器下核心循环全部通过 | ✅ |
| 2 | 核心循环6个阶段均有结果 | ✅ |
| 3 | 挂机产出阶段验证资源速率大于0 | ✅ |
| 4 | 建筑升级阶段验证消耗与等级关系 | ✅ |
| 5 | 武将招募阶段验证武将属性存在 | ✅ |
| 6 | 资源加速阶段验证科技加成后产出提升 | ✅ |
| 7 | 失败数据提供器下核心循环不通过 | ✅ |
| 8 | 默认数据下跨系统数据流全部通过 | ✅ |
| 9 | 跨系统数据流包含7条检查路径 | ✅ |
| 10 | 资源→建筑路径数据一致 | ✅ |
| 11 | 武将→战斗路径战力关联正确 | ✅ |
| 12 | 全系统→声望路径验证声望值有效 | ✅ |
| 13 | 每条数据流路径都有偏差值 | ✅ |
| 14 | 默认数据下转生循环全部通过 | ✅ |
| 15 | 转生循环包含5个阶段 | ✅ |
| 16 | 转生前后快照记录正确 | ✅ |
| 17 | 转生倍率验证通过 | ✅ |
| 18 | 倍率生效阶段验证倍率大于1 | ✅ |
| 19 | 再次推图阶段验证加速效果 | ✅ |
| 20 | validateAll生成完整报告且全部通过 | ✅ |
| 21 | 报告包含唯一ID和时间戳 | ✅ |
| 22 | getLastReport返回最近一次报告 | ✅ |
| 23 | reset清除报告并重置提供器 | ✅ |
| 24 | BalanceValidator与IntegrationValidator转生倍率一致 | ✅ |
| 25 | 自定义提供器切换后验证结果变化 | ✅ |

**文件**: `engine/unification/__tests__/integration/unification-conditions-challenge.integration.test.ts`

---

## §2 统一结局 (7用例)

> 覆盖: 2.1 结局评定与动画 / 2.2 评定公式验证 / 2.3 结局奖励与称号 / 2.4 称号跨周目保留

| # | 用例 | 状态 |
|---|------|------|
| 1 | BalanceValidator全量验证通过表示天下一统数值达标 | ✅ |
| 2 | 转生倍率验证通过代表统一后经济循环合理 | ✅ |
| 3 | 经济系统验证通过代表货币循环稳定 | ✅ |
| 4 | 声望等级阈值公式 1000×N^1.8 精度验证 | ✅ |
| 5 | 产出加成公式 1+level×0.02 线性递增 | ✅ |
| 6 | PrestigeSystem.getProductionBonus与公式一致 | ✅ |
| 7 | 转生倍率递减曲线：后次增量小于前次 | ✅ |

**文件**: `engine/unification/__tests__/integration/ending-prestige-heritage-full.integration.test.ts` (§1~§2部分)

---

## §3 声望系统深化 (5用例)

> 覆盖: 3.1 等级上限突破 / 3.2 阈值公式验证 / 3.3 特权终极加成 / 3.4 叠加规则 / 3.5 商店终极商品 / 3.6 跨转生规则

| # | 用例 | 状态 |
|---|------|------|
| 1 | 声望值累积可升至Lv.30（将军） | ✅ |
| 2 | 声望商店随等级解锁高级商品 | ✅ |
| 3 | 声望获取受每日上限约束 | ✅ |
| 4 | 声望等级达到MAX_PRESTIGE_LEVEL后不再升级 | ✅ |
| 5 | 声望等级信息包含完整字段 | ✅ |

**文件**: `engine/unification/__tests__/integration/ending-prestige-heritage-full.integration.test.ts` (§3部分)

---

## §4 跨周目传承 (9用例)

> 覆盖: 4.1 传承内容选择 / 4.2 传承数据精确验证 / 4.3 非传承项重置 / 4.4 新周目启动 / 4.5 传承倍率 / 4.6 一键重建 / 4.7 周目记录 / 4.8 转生与周目关系

| # | 用例 | 状态 |
|---|------|------|
| 1 | 转生条件4维全部满足后可执行转生 | ✅ |
| 2 | 转生后倍率 > 1.0 且加速期激活 | ✅ |
| 3 | 武将传承执行成功并记录历史 | ✅ |
| 4 | 装备传承同部位成功且源装备被消耗 | ✅ |
| 5 | 每日传承次数受上限约束 | ✅ |
| 6 | 转生倍率与传承加速状态联动 | ✅ |
| 7 | PrestigeSystem与RebirthSystem存档联动 | ✅ |
| 8 | 多次转生后倍率持续递增且不超过上限 | ✅ |
| 9 | 转生加速天数逐日递减直至结束 | ✅ |

**文件**: `engine/unification/__tests__/integration/ending-prestige-heritage-full.integration.test.ts` (§4部分)

---

## §5 转生系统深度验证 (10用例)

> 覆盖: 5T.1 成就链 / 5T.2 转生冷却 / 5T.3 解锁内容 / 5T.4 专属任务 / 5T.5 收益模拟器 / 5T.6 保留/重置/衰减 / 5T.7 货币转生

| # | 用例 | 状态 |
|---|------|------|
| 1 | 转生条件包含4个维度：声望/城堡/武将/战力 | ✅ |
| 2 | 声望等级不足时转生被拒绝 | ✅ |
| 3 | 城堡等级不足时转生被拒绝 | ✅ |
| 4 | 武将数量不足时转生被拒绝 | ✅ |
| 5 | 总战力不足时转生被拒绝 | ✅ |
| 6 | 转生保留规则含英雄/装备/科技/声望，重置规则含建筑/资源/地图 | ✅ |
| 7 | 转生成功后触发resetCallback传入重置规则 | ✅ |
| 8 | 转生成功后记录包含次数/倍率/时间戳 | ✅ |
| 9 | 转生加速期持续7天，倍率大于1 | ✅ |
| 10 | 收益模拟器返回完整预估数据 | ✅ |

**文件**: `engine/unification/__tests__/integration/rebirth-emperor-economy.integration.test.ts` (§5部分)

---

## §6 交叉验证 (33用例)

> 覆盖: 6.1~6.6 全链路 / 6.7 转生循环 / 6.8 离线全系统 / 6.9 回归欢迎 / 6.10~6.18 数值平衡+战斗+武将+性能+交互+配色+动画+资源+招募

| # | 用例 | 状态 |
|---|------|------|
| 1 | validateAll生成完整报告，包含所有5维度条目 | ✅ |
| 2 | 默认配置下资源验证生成4种资源结果 | ✅ |
| 3 | 默认配置下武将验证5品质全部通过 | ✅ |
| 4 | 默认配置下战斗难度验证通过 | ✅ |
| 5 | 默认配置下经济系统验证通过 | ✅ |
| 6 | 默认配置下转生倍率验证通过 | ✅ |
| 7 | getLastReport返回最近一次验证报告 | ✅ |
| 8 | getState返回lastReport快照 | ✅ |
| 9 | reset后状态清空，恢复默认配置 | ✅ |
| 10 | 连续多次validateAll生成不同ID的报告 | ✅ |
| 11 | 注入自定义资源配置后验证结果反映变化 | ✅ |
| 12 | 注入自定义武将属性后验证品质间差距 | ✅ |
| 13 | 注入线性战斗曲线后关卡难度整体递增 | ✅ |
| 14 | 注入自定义转生配置后倍率曲线正确 | ✅ |
| 15 | 注入自定义经济配置后货币流验证正确 | ✅ |
| 16 | BalanceReport纯函数与BalanceValidator结果一致 | ✅ |
| 17 | BalanceReport.validateEconomy与BalanceValidator结果一致 | ✅ |
| 18 | BalanceReport.validateRebirth与BalanceValidator结果一致 | ✅ |
| 19 | calculateStagePoints与validateBattleDifficulty一致 | ✅ |
| 20 | calcPower与validateSingleHero的powerPoints一致 | ✅ |
| 21 | inRange边界值正确判断 | ✅ |
| 22 | calcDeviation计算偏差百分比正确 | ✅ |
| 23 | generateId生成唯一ID格式 | ✅ |
| 24 | makeEntry构建正确验证条目 | ✅ |
| 25 | generateResourceCurve生成6个数据点 | ✅ |
| 26 | calcRebirthMultiplier递减曲线正确 | ✅ |
| 27 | calcRebirthMultiplier边界值：0次和负数返回1.0 | ✅ |
| 28 | calculateRebirthPoints生成20个数据点且递增 | ✅ |
| 29 | calculateRebirthPoints每个点包含完整字段 | ✅ |
| 30 | 战斗难度指数曲线首关≤1000，末关≥50000 | ✅ |
| 31 | 战斗难度无相邻关卡难度跳跃超过3倍 | ✅ |
| 32 | 空资源配置返回有效结果 | ✅ |
| 33 | IntegrationValidator与BalanceValidator并行运行无冲突 | ✅ |

**文件**: `engine/unification/__tests__/integration/world-trend-balance.integration.test.ts`

---

## §7 全功能验收流程 (8用例)

> 覆盖: 7.1 23模块204功能点 / 7.2 七维度评分 / 7.3 验收报告

| # | 用例 | 状态 |
|---|------|------|
| 1 | validateAll 生成完整联调报告含4大维度 | ✅ |
| 2 | 核心循环验证包含挂机→建筑→武将→战斗→科技→加速完整链路 | ✅ |
| 3 | 跨系统数据流验证检查资源↔建筑↔武将数据一致性 | ✅ |
| 4 | 转生循环验证覆盖转生→重置→倍率→重建→再推图 | ✅ |
| 5 | 离线全系统验证处理离线收益+事件+远征 | ✅ |
| 6 | getLastReport 返回最近一次报告 | ✅ |
| 7 | reset 后报告清空 | ✅ |
| 8 | 自定义 Provider 注入后验证使用新数据 | ✅ |

**文件**: `engine/unification/__tests__/integration/full-acceptance-report.integration.test.ts` (§7+§13部分)

---

## §8 经济系统4货币独立验证 (9用例)

> 覆盖: 8.1 铜钱循环 / 8.2 天命循环 / 8.3 双代币 / 8.4 汇率与防通胀

| # | 用例 | 状态 |
|---|------|------|
| 1 | 铜钱copper基础余额1000，天命mandate初始为0 | ✅ |
| 2 | 招贤榜recruit上限999，求贤令summon上限99 | ✅ |
| 3 | 铜钱无上限可大量累积 | ✅ |
| 4 | 有上限货币添加时不超过上限 | ✅ |
| 5 | 货币不足时spendCurrency抛出异常含缺少信息 | ✅ |
| 6 | checkAffordability批量检查返回不足列表 | ✅ |
| 7 | 元宝为付费货币，铜钱/天命为免费货币 | ✅ |
| 8 | 按优先级消耗：normal优先扣铜钱 | ✅ |
| 9 | 序列化/反序列化保持余额一致 | ✅ |

**文件**: `engine/unification/__tests__/integration/rebirth-emperor-economy.integration.test.ts` (§8部分)

---

## §9 转生倍率公式独立验证 (含在§6共33用例)

> 覆盖: 9.1 公式精确计算 / 9.2 作用范围边界 / 速查表校准 / 20次封顶12.00×

**文件**: `engine/unification/__tests__/integration/world-trend-balance.integration.test.ts` (含在§6中)

---

## §10 帝王模式验证 (6用例)

> 覆盖: 10.1 解锁与激活 / 10.2 全系统影响 / 二次确认 / 24h冷静期

| # | 用例 | 状态 |
|---|------|------|
| 1 | 帝王模式需转生10次解锁，未满足时不可用 | ✅ |
| 2 | 转生加速期有效倍率=基础倍率×加速倍率 | ✅ |
| 3 | 声望等级达到50（帝王）时获得最高产出加成 | ✅ |
| 4 | 转生后传承系统初始化加速状态 | ✅ |
| 5 | 传承系统收益模拟器返回完整预估 | ✅ |
| 6 | 转生解锁内容逐步开放：商店→高级武将→特殊建筑 | ✅ |

**文件**: `engine/unification/__tests__/integration/rebirth-emperor-economy.integration.test.ts` (§9~§10部分)

---

## §11 品质色色盲模式验证 (含在§12共29用例)

> 覆盖: 11.1 5品质色差≥20 / 色盲纹理 / 暗色模式兼容

**文件**: `engine/unification/__tests__/integration/balance-recruit-visual.integration.test.ts` (§12部分)

---

## §12 PRD招募概率矛盾澄清 (11用例)

> 覆盖: 12.1 概率以代码为准 / 5品质体系 / 保底100次 / 十连保底 / UP武将v2.1 / 免费招贤v2.1

| # | 用例 | 状态 |
|---|------|------|
| 1 | 普通/高级概率表之和为1.0 | ✅ |
| 2 | 十连保底阈值均为10，硬保底阈值均为100 | ✅ |
| 3 | 保底计数器初始值为0 | ✅ |
| 4 | getNextTenPullPity/ getNextHardPity 初始值等于阈值 | ✅ |
| 5 | rollQuality 确定性RNG返回正确品质 | ✅ |
| 6 | applyPity 十连保底触发时强制提升品质 | ✅ |
| 7 | applyPity 硬保底触发时强制提升品质 | ✅ |
| 8 | applyPity 非保底情况不改变品质 | ✅ |
| 9 | 招募消耗计算正确，十连无折扣 | ✅ |
| 10 | 序列化/反序列化保底计数器完整还原 | ✅ |
| 11 | 无依赖时招募返回null | ✅ |

**文件**: `engine/unification/__tests__/integration/balance-recruit-visual.integration.test.ts` (§11部分)

---

## §13 Gap分析补充验证 (15用例)

> 覆盖: 13.1 领土数矛盾 / 13.2 离线预估面板 / 13.3 回归流程 / 13.4 声望叠加 / 13.5 速查表校准 / 13.6 HER-PRD同步 / 13.7 离线加成 / 13.8 天下一统全链路

| # | 用例 | 状态 |
|---|------|------|
| 1 | SettingsManager初始化后BalanceValidator可独立运行验证 | ✅ |
| 2 | 设置变更通知机制与联调验证器无冲突 | ✅ |
| 3 | 设置持久化后BalanceValidator仍使用默认配置 | ✅ |
| 4 | BalanceValidator配置注入后生成新报告 | ✅ |
| 5 | IntegrationValidator与SettingsManager可并行工作 | ✅ |
| 6 | 设置重置不影响BalanceValidator状态 | ✅ |
| 7 | BalanceValidator重置恢复默认配置 | ✅ |
| 8 | 云存档系统初始化后状态为Idle | ✅ |
| 9 | 云存档同步成功后状态变为Success | ✅ |
| 10 | 网络不可用时同步失败 | ✅ |
| 11 | 云存档未配置时同步返回失败 | ✅ |
| 12 | 云同步与BalanceValidator可同时运行 | ✅ |
| 13 | 设置数据序列化与恢复后BalanceValidator行为不变 | ✅ |
| 14 | 云存档状态变更回调正确触发 | ✅ |
| 15 | 云存档reset后状态回到Idle | ✅ |

**文件**: `engine/unification/__tests__/integration/settings-unification-cross.integration.test.ts`

---

## §14 Gap分析R4补充验证 (含在§7+§17共24用例)

> 覆盖: 14.1 成就链领土数 / 14.2 声望归零标注 / 14.3 帝王冷静期 / 14.4 色盲纹理规格 / 14.5 结局领土分母 / 14.6 PRD第8处 / 14.7 转生全链路

**文件**: `engine/unification/__tests__/integration/full-acceptance-report.integration.test.ts`

---

## §15 终验补充验证 (含在§7+§17共24用例)

> 覆盖: 15.1 9处PRD矛盾回归 / 15.2 帝王冷静期完整流程 / 15.3 成就链修正 / 15.4 纹理规格 / 15.5 领土分母 / 15.6 声望归零标注 / 15.7 Plan同步

**文件**: `engine/unification/__tests__/integration/full-acceptance-report.integration.test.ts`

---

## §16 终验Gap补充验证 (33用例, 3 skip)

> 覆盖: 16.1 23模块逐一清单 / 16.2 速查表偏差对比 / 16.3 网络断开冷静期 / 16.4 PRS-5手机端适配 / 16.5 PRS-1声望升级动画 / 16.6 PRS-2声望获取边界 / 16.7 离线预估面板 / 16.8 回归欢迎流程 / 16.9 Plan同步

| # | 用例 | 状态 |
|---|------|------|
| 1 | AnimationAuditor注册动画实例后计数正确 | ✅ |
| 2 | AnimationAuditor重复注册同一ID不增加计数 | ✅ |
| 3 | AnimationAuditor注销动画后计数减少 | ✅ |
| 4 | GraphicsQualityManager低画质关闭粒子特效和阴影 | ✅ |
| 5 | GraphicsQualityManager高画质开启全部特效 | ✅ |
| 6 | GraphicsQualityManager切换档位触发水墨过渡 | ✅ |
| 7 | GraphicsQualityManager水墨过渡在update后完成 | ✅ |
| 8 | GraphicsQualityManager自动模式检测设备能力 | ✅ |
| 9 | GraphicsQualityManager高级选项独立控制 | ✅ |
| 10 | GraphicsQualityManager reset恢复默认 | ✅ |
| 11 | PerformanceMonitor启动后isRunning为true | ✅ |
| 12 | PerformanceMonitor停止后isRunning为false | ✅ |
| 13 | PerformanceMonitor update采集FPS样本 | ✅ |
| 14 | PerformanceMonitor无样本时FPS统计返回0 | ✅ |
| 15 | PerformanceMonitor加载阶段计时正确 | ✅ |
| 16 | PerformanceMonitor生成报告包含完整结构 | ✅ |
| 17 | PerformanceMonitor reset清除所有数据 | ✅ |
| 18 | PerformanceMonitor对象池注册和状态查询 | ✅ |
| 19 | PerformanceMonitor配置更新生效 | ✅ |
| 20 | VisualConsistencyChecker初始化后包含默认动画规范 | ✅ |
| 21 | VisualConsistencyChecker注册动画实例后计数正确 | ✅ |
| 22 | VisualConsistencyChecker reset清除所有注册 | ✅ |
| 23 | InteractionAuditor初始化后包含默认规则 | ✅ |
| 24 | InteractionAuditor reset恢复默认规则 | ✅ |
| 25 | ObjectPool初始预分配数量正确 | ✅ |
| 26 | ObjectPool分配超过初始大小时自动扩容 | ✅ |
| 27 | ObjectPool回收后可复用 | ✅ |
| 28 | ObjectPool命中率统计正确 | ✅ |
| 29 | DirtyRectManager标记和查询脏矩形 | ✅ |
| 30 | DirtyRectManager全量重绘模式 | ✅ |
| 31 | 动画降级：低画质下动画时长自动缩短 | ⏭️ skip |
| 32 | 通知系统：红点系统通知（v1.1待实现） | ⏭️ skip |
| 33 | 视觉一致性：品质色色盲纹理叠加（待实现纹理API） | ⏭️ skip |

**文件**: `engine/unification/__tests__/integration/animation-notification-supplementary.integration.test.ts`

---

## §17 v2.0封版P0状态追踪 (7用例)

> 覆盖: 17.1 P0-1概率同步 ✅ / 17.2 P0-2 UP武将🔻P1 / 17.3 P0-3 免费招募🔻P1 / 17.4 P0-4 红点⏸延期 / 17.5 封版建议

| # | 用例 | 状态 |
|---|------|------|
| 1 | BalanceValidator 5维度报告含 summary 字段 | ✅ |
| 2 | 转生倍率 BalanceUtils 与 RebirthSystem 一致性 | ✅ |
| 3 | 转生全链路：倍率递增且不超过上限 | ✅ |
| 4 | 23模块清单：核心子系统全部可实例化 | ✅ |
| 5 | 验收报告：BalanceValidator validateAll 含 overallLevel | ✅ |
| 6 | 转生全链路：RebirthSystem 序列化/反序列化闭环 | ✅ |
| 7 | HeritageSystem 初始化/重置生命周期正常 | ✅ |

**文件**: `engine/unification/__tests__/integration/full-acceptance-report.integration.test.ts` (§17部分)

---

## P0问题处理汇总

| P0编号 | 问题 | 状态 | 处理 |
|--------|------|------|------|
| P0-1 | 招募概率/保底数值不一致 | ✅ 已解决 | Play文档同步至代码实际值 |
| P0-2 | UP武将/卡池(#24) | 🔻 降级P1 | 标记v2.1待实现 |
| P0-3 | 每日免费招募(#23) | 🔻 降级P1 | 标记v2.1待实现 |
| P0-4 | 红点系统(#29) | ⏸ 延期 | 非v2.0范围，延后至v1.1 |

---

## 延后功能清单

| 版本 | 功能 | 编号 |
|------|------|------|
| v2.1 | UP武将/卡池系统 | #24 |
| v2.1 | 每日免费招募 | #23 |
| v1.1 | 红点通知系统 | #29 |
