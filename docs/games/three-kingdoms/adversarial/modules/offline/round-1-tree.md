# Offline Module R1 Builder Flow Tree

> 模块: engine/offline | 轮次: R1 | 日期: 2026-05-01
> Builder: v1.8 | 文件数: 11 | 总行数: ~3000

## 模块概览

| 文件 | 行数 | 职责 |
|------|------|------|
| offline.types.ts | 460 | 类型定义（25+ interfaces/types） |
| offline-config.ts | 229 | 数值配置常量 |
| offline-utils.ts | 63 | 资源操作工具函数 |
| offline-snapshot-types.ts | 92 | 快照类型定义 |
| OfflineRewardSystem.ts | 914 | 聚合根（19个公开方法） |
| OfflineRewardEngine.ts | 306 | 纯计算引擎 |
| OfflineSnapshotSystem.ts | 356 | 快照管理 |
| OfflinePanelHelper.ts | 207 | 面板生成 |
| OfflineEstimateSystem.ts | 193 | 预估系统 |
| OfflineTradeAndBoost.ts | 130 | 贸易与道具 |
| index.ts | 61 | 统一导出 |

## 公开API清单

### OfflineRewardSystem（聚合根，19个公开API）

| # | API | 类别 | 参数类型 |
|---|-----|------|----------|
| 1 | `calculateSnapshot(offlineSeconds, productionRates)` | 计算 | number, Resources |
| 2 | `applyDouble(earned, request)` | 翻倍 | Resources, DoubleRequest |
| 3 | `getAvailableDoubles(offlineSeconds, vipLevel)` | 查询 | number, number |
| 4 | `generateReturnPanel(offlineSeconds, productionRates, vipLevel)` | 面板 | number, Resources, number |
| 5 | `getBoostItems()` | 道具查询 | - |
| 6 | `addBoostItem(itemId, count)` | 道具添加 | string, number |
| 7 | `useBoostItemAction(itemId, productionRates)` | 道具使用 | string, Resources |
| 8 | `simulateOfflineTrade(offlineSeconds, tradeProfitPerRun)` | 贸易 | number, Resources |
| 9 | `getVipBonus(vipLevel?)` | VIP查询 | number |
| 10 | `applyVipBonus(earned, vipLevel)` | VIP计算 | Resources, number |
| 11 | `getSystemModifier(systemId)` | 系统修正查询 | string |
| 12 | `applySystemModifier(earned, systemId)` | 系统修正计算 | Resources, string |
| 13 | `applyCapAndOverflow(earned, currentResources, caps)` | 溢出处理 | Resources, Resources, Record |
| 14 | `getResourceProtection(resourceType, currentAmount)` | 资源保护查询 | string, number |
| 15 | `applyResourceProtection(resourceType, currentAmount, requestedAmount)` | 资源保护计算 | string, number, number |
| 16 | `getWarehouseCapacity(resourceType)` | 仓库查询 | string |
| 17 | `upgradeWarehouse(resourceType)` | 仓库升级 | string |
| 18 | `calculateFullReward(...)` | 完整计算 | 6参数 |
| 19 | `calculateOfflineReward(...)` | 领取计算 | 6参数 |
| 20 | `claimReward(reward)` | 领取 | OfflineRewardResultV9 |
| 21 | `serialize()` | 序列化 | - |
| 22 | `deserialize(data)` | 反序列化 | OfflineSaveData |
| 23 | `enqueueStagingMails(mails)` | 暂存邮件 | Array |
| 24 | `dequeueStagingMails(maxCount?)` | 取出邮件 | number |
| 25 | `processExpiredMailCompensation(expiredMails)` | 过期补偿 | Array |
| 26 | `calculateActivityPoints(offlineSeconds, activities)` | 活动积分 | number, Array |
| 27 | `calculateOfflineExp(offlineSeconds, expBonus?)` | 经验计算 | number, number |
| 28 | `setExpState(level, exp, bonus?)` | 经验设置 | number, number, number |
| 29 | `handleDegradationNotice(hasSnapshot, mailSystem?)` | 降级通知 | boolean, Object |
| 30 | `calculateSiegeResult(dispatchedTroops, success, loot?)` | 攻城结算 | number, boolean, Resources |
| 31 | `updateProductionRatesAfterTech(completedTech, currentRates)` | 科技更新 | Array, Resources |
| 32 | `calculateWithSnapshotBonus(offlineSeconds, productionRates, snapshotBonusSources)` | 快照加成 | number, Resources, Object |
| 33 | `calculateCrossSystemReward(...)` | 跨系统汇总 | 5参数 |
| 34 | `resetVipDailyCount()` | VIP重置 | - |
| 35 | `reset()` | 重置 | - |

### OfflineRewardEngine（纯计算，10个导出函数）

| # | API | 类别 |
|---|-----|------|
| E1 | `calculateTierDetails(offlineSeconds, productionRates)` | 衰减计算 |
| E2 | `calculateOverallEfficiency(offlineSeconds)` | 效率计算 |
| E3 | `calculateBonusCoefficient(sources)` | 加成系数 |
| E4 | `calculateOfflineSnapshot(offlineSeconds, productionRates, bonusSources, timestamp?)` | 快照计算 |
| E5 | `applyDouble(earned, request, adUsedToday?)` | 翻倍 |
| E6 | `applyOverflowRules(earned, currentResources, caps, rules?)` | 溢出 |
| E7 | `getSystemModifier(systemId)` | 系统修正 |
| E8 | `applySystemModifier(earned, systemId)` | 系统修正 |
| E9 | `calculateFullOfflineReward(ctx)` | 完整计算 |
| E10 | `estimateOfflineReward(hours, productionRates, bonusSources)` | 预估 |

### OfflineSnapshotSystem（快照管理）

| # | API | 类别 |
|---|-----|------|
| S1 | `createSnapshot(systemState)` | 创建快照 |
| S2 | `getSnapshot()` | 获取快照 |
| S3 | `isSnapshotValid()` | 验证快照 |
| S4 | `getOfflineSeconds()` | 离线时长 |
| S5 | `getCompletedBuildings(now?)` | 建筑完成 |
| S6 | `getCompletedTech(now?)` | 科技完成 |
| S7 | `getCompletedExpeditions(now?)` | 远征完成 |
| S8 | `getCompletedTrades(now?)` | 贸易完成 |
| S9 | `useBoostItem(itemId, items, productionRates, bonusSources?)` | 道具使用 |
| S10 | `expandWarehouse(resourceType, expansions?)` | 仓库扩容 |
| S11 | `getSaveData()` | 存档获取 |
| S12 | `recordAdDouble()` | 广告翻倍记录 |
| S13 | `resetDailyDoubles()` | 每日重置 |
| S14 | `checkDailyReset()` | 重置检查 |
| S15 | `clearSnapshot()` | 清除快照 |
| S16 | `reset()` | 重置 |

### OfflineEstimateSystem（预估系统）

| # | API | 类别 |
|---|-----|------|
| ES1 | `estimate(productionRates)` | 预估时间线 |
| ES2 | `estimateForHours(hours, productionRates, systemId?)` | 指定小时预估 |
| ES3 | `getEfficiencyCurve(maxHours?)` | 效率曲线 |
| ES4 | `reset()` | 重置 |

### OfflineTradeAndBoost（贸易与道具，3个导出函数）

| # | API | 类别 |
|---|-----|------|
| T1 | `getBoostItemList(inventory)` | 道具列表 |
| T2 | `useBoostItem(itemId, inventory, productionRates)` | 使用道具 |
| T3 | `simulateOfflineTrade(offlineSeconds, tradeProfitPerRun, lastOfflineTime)` | 模拟贸易 |

### OfflinePanelHelper（面板辅助，4个导出函数）

| # | API | 类别 |
|---|-----|------|
| P1 | `formatOfflineDuration(seconds)` | 格式化时长 |
| P2 | `shouldShowOfflinePopup(offlineSeconds)` | 弹窗判定 |
| P3 | `generateReturnPanelData(snapshot, adUsedToday?)` | 面板数据 |
| P4 | `estimateOfflineReward(hours, productionRates, bonusSources, _calculateSnapshot?)` | 预估收益 |

### offline-utils（5个导出函数）

| # | API | 类别 |
|---|-----|------|
| U1 | `zeroRes()` | 零资源 |
| U2 | `cloneRes(r)` | 克隆资源 |
| U3 | `addRes(a, b)` | 资源相加 |
| U4 | `mulRes(r, f)` | 资源乘法 |
| U5 | `floorRes(r)` | 资源取整 |

---

## 流程树节点

### F-Normal（正常流程）— 48个节点

#### 衰减计算流程 (N1-N6)
| ID | 节点 | API | 输入 | 预期 | covered |
|----|------|-----|------|------|---------|
| N1 | 5档衰减-完整2h | `calculateSnapshot(7200, rates)` | 2小时 | tier1完整 | ✅ |
| N2 | 5档衰减-跨档8h | `calculateSnapshot(28800, rates)` | 8小时 | tier1+tier2 | ✅ |
| N3 | 5档衰减-满档72h | `calculateSnapshot(259200, rates)` | 72小时 | 5档全部 | ✅ |
| N4 | 5档衰减-超时封顶 | `calculateSnapshot(300000, rates)` | >72h | isCapped=true | ✅ |
| N5 | 零秒离线 | `calculateSnapshot(0, rates)` | 0秒 | 空结果 | ✅ |
| N6 | 负秒离线 | `calculateSnapshot(-100, rates)` | -100 | 空结果 | ✅ |

#### 翻倍机制流程 (N7-N12)
| ID | 节点 | API | 输入 | 预期 | covered |
|----|------|-----|------|------|---------|
| N7 | 广告翻倍成功 | `applyDouble(earned, {source:'ad', multiplier:2})` | 广告 | ×2 | ✅ |
| N8 | VIP翻倍成功 | `applyDouble(earned, {source:'vip', multiplier:2})` | VIP | ×2 | ✅ |
| N9 | 回归奖励翻倍 | `applyDouble(earned, {source:'return_bonus', multiplier:2})` | 回归 | ×2 | ✅ |
| N10 | 道具翻倍 | `applyDouble(earned, {source:'item', multiplier:2})` | 道具 | ×2 | ✅ |
| N11 | VIP翻倍次数耗尽 | `applyDouble` ×N+1 | 超限 | success=false | ✅ |
| N12 | 获取可用翻倍选项 | `getAvailableDoubles(offlineSeconds, vipLevel)` | 查询 | 列表 | ✅ |

#### VIP加成流程 (N13-N16)
| ID | 节点 | API | 输入 | 预期 | covered |
|----|------|-----|------|------|---------|
| N13 | VIP0无加成 | `getVipBonus(0)` | VIP0 | bonus=0 | ✅ |
| N14 | VIP5最高加成 | `getVipBonus(5)` | VIP5 | bonus=0.25 | ✅ |
| N15 | VIP加成应用 | `applyVipBonus(earned, 3)` | VIP3 | +15% | ✅ |
| N16 | VIP每日重置 | `resetVipDailyCount()` | 新一天 | count=0 | ✅ |

#### 道具管理流程 (N17-N20)
| ID | 节点 | API | 输入 | 预期 | covered |
|----|------|-----|------|------|---------|
| N17 | 添加道具 | `addBoostItem('offline_boost_1h', 3)` | 添加 | 库存+3 | ✅ |
| N18 | 使用加速道具 | `useBoostItemAction('offline_boost_1h', rates)` | 使用 | 收益增加 | ✅ |
| N19 | 道具不足 | `useBoostItemAction('offline_boost_1h', rates)` | 空库存 | success=false | ✅ |
| N20 | 查询道具列表 | `getBoostItems()` | 查询 | 列表 | ✅ |

#### 贸易流程 (N21-N23)
| ID | 节点 | API | 输入 | 预期 | covered |
|----|------|-----|------|------|---------|
| N21 | 正常贸易完成 | `simulateOfflineTrade(7200, profit, time)` | 2h | ≤3次 | ✅ |
| N22 | 离线不足1次 | `simulateOfflineTrade(1800, profit, time)` | <1h | 0次 | ✅ |
| N23 | 贸易达到上限 | `simulateOfflineTrade(999999, profit, time)` | 超长 | max=3 | ✅ |

#### 溢出与保护流程 (N24-N28)
| ID | 节点 | API | 输入 | 预期 | covered |
|----|------|-----|------|------|---------|
| N24 | 资源溢出截断 | `applyCapAndOverflow(earned, current, caps)` | 超限 | 截断 | ✅ |
| N25 | 无上限资源 | `applyCapAndOverflow(earned, current, {gold:null})` | null | 全额 | ✅ |
| N26 | 资源保护查询 | `getResourceProtection('grain', 1000)` | grain | max(300,100) | ✅ |
| N27 | 资源保护扣除 | `applyResourceProtection('grain', 1000, 800)` | 扣除 | 受保护 | ✅ |
| N28 | 仓库容量查询 | `getWarehouseCapacity('grain')` | grain | 2000 | ✅ |

#### 仓库扩容流程 (N29-N31)
| ID | 节点 | API | 输入 | 预期 | covered |
|----|------|-----|------|------|---------|
| N29 | 正常升级 | `upgradeWarehouse('grain')` | grain | +1000 | ✅ |
| N30 | 达到最大等级 | `upgradeWarehouse('grain')` ×30 | 满级 | success=false | ✅ |
| N31 | 无效资源类型 | `upgradeWarehouse('invalid')` | 未知 | success=false | ✅ |

#### 领取与防重流程 (N32-N35)
| ID | 节点 | API | 输入 | 预期 | covered |
|----|------|-----|------|------|---------|
| N32 | 正常领取 | `claimReward(result)` | 首次 | 返回资源 | ✅ |
| N33 | 重复领取 | `claimReward(result)` ×2 | 二次 | null | ✅ |
| N34 | 重新计算后领取 | `calculateOfflineReward` → `claimReward` | 新一轮 | 允许 | ✅ |
| N35 | 完整收益计算 | `calculateFullReward(...)` | 全参数 | 完整结果 | ✅ |

#### 暂存邮件流程 (N36-N39)
| ID | 节点 | API | 输入 | 预期 | covered |
|----|------|-----|------|------|---------|
| N36 | 正常入队 | `enqueueStagingMails([mail])` | 1封 | accepted | ✅ |
| N37 | 队列满溢出 | `enqueueStagingMails([21封])` | 超限 | discarded | ✅ |
| N38 | FIFO取出 | `dequeueStagingMails(5)` | 取5封 | FIFO | ✅ |
| N39 | 过期补偿 | `processExpiredMailCompensation([mail])` | 含gold | 50% | ✅ |

#### 经验系统流程 (N40-N43)
| ID | 节点 | API | 输入 | 预期 | covered |
|----|------|-----|------|------|---------|
| N40 | 正常经验计算 | `calculateOfflineExp(3600, 0.1)` | 1h | 有经验 | ✅ |
| N41 | 经验升级 | `calculateOfflineExp(99999, 1.0)` | 超长 | didLevelUp | ✅ |
| N42 | 设置经验状态 | `setExpState(5, 100, 0.2)` | 设置 | 更新 | ✅ |
| N43 | 注册经验系统 | `registerExpSystem()` | 注册 | true | ✅ |

#### 降级通知与攻城 (N44-N48)
| ID | 节点 | API | 输入 | 预期 | covered |
|----|------|-----|------|------|---------|
| N44 | 快照正常 | `handleDegradationNotice(true)` | 有快照 | 不通知 | ✅ |
| N45 | 快照丢失首次 | `handleDegradationNotice(false, mailSystem)` | 丢失 | 弹窗+邮件 | ✅ |
| N46 | 快照丢失重复 | `handleDegradationNotice(false)` ×2 | 重复 | isDuplicate | ✅ |
| N47 | 攻城成功 | `calculateSiegeResult(1000, true, loot)` | 成功 | 无损失 | ✅ |
| N48 | 攻城失败 | `calculateSiegeResult(1000, false)` | 失败 | -30% | ✅ |

---

### F-Boundary（边界条件）— 24个节点

| ID | 节点 | API | 输入 | 预期 | covered |
|----|------|-----|------|------|---------|
| B1 | 离线0秒 | `calculateSnapshot(0, rates)` | 0 | 空结果 | ✅ |
| B2 | 离线恰好72h | `calculateSnapshot(259200, rates)` | 72h | isCapped=false | ✅ |
| B3 | 离线72h+1s | `calculateSnapshot(259201, rates)` | 72h+1s | isCapped=true | ✅ |
| B4 | 离线恰好5分钟 | `shouldShowOfflinePopup(300)` | 300s | false | ✅ |
| B5 | 离线5分01秒 | `shouldShowOfflinePopup(301)` | 301s | true | ✅ |
| B6 | 回归奖励恰好24h | `getAvailableDoubles(86400, 0)` | 24h | 含return_bonus | ✅ |
| B7 | 回归奖励23h59m | `getAvailableDoubles(86399, 0)` | <24h | 无return_bonus | ✅ |
| B8 | VIP等级超出表范围 | `getVipBonus(99)` | VIP99 | 使用最高VIP5 | ✅ |
| B9 | 零产出速率 | `calculateSnapshot(3600, zeroRates)` | 全0 | 全0收益 | ✅ |
| B10 | 队列恰好20封 | `enqueueStagingMails(20封)` | 满载 | 全部accepted | ✅ |
| B11 | 队列21封 | `enqueueStagingMails(21封)` | 超出1封 | 1封discarded | ✅ |
| B12 | 仓库初始等级 | `getWarehouseLevel('grain')` | 初始 | 1 | ✅ |
| B13 | 仓库满级升级 | `upgradeWarehouse` ×30 | maxLevel | 拒绝 | ✅ |
| B14 | 贸易恰好1次 | `simulateOfflineTrade(3600, profit, t)` | 恰好1h | 1次 | ✅ |
| B15 | 贸易差1秒不够 | `simulateOfflineTrade(3599, profit, t)` | <1h | 0次 | ✅ |
| B16 | 经验加成恰好100% | `calculateOfflineExp(3600, 1.0)` | 100% | 正常翻倍 | ✅ |
| B17 | 经验加成超过100% | `calculateOfflineExp(3600, 1.5)` | 150% | 上限100% | ✅ |
| B18 | 攻城0兵力 | `calculateSiegeResult(0, false)` | 0兵 | 0损失 | ✅ |
| B19 | 添加0个道具 | `addBoostItem('x', 0)` | 0 | 不添加 | ✅ |
| B20 | 添加负数道具 | `addBoostItem('x', -5)` | -5 | 不添加 | ✅ |
| B21 | 资源保护-当前低于floor | `applyResourceProtection('grain', 50, 100)` | 低于floor | 受保护 | ✅ |
| B22 | 科技产出-空列表 | `updateProductionRatesAfterTech([], rates)` | 空 | 无变化 | ✅ |
| B23 | 跨系统收益-零产出 | `calculateCrossSystemReward(0, zeroRates, ...)` | 零 | 全零 | ✅ |
| B24 | 离线经验-0秒 | `calculateOfflineExp(0)` | 0秒 | 0经验 | ✅ |

---

### F-Error（异常路径）— 20个节点

| ID | 节点 | API | 输入 | 预期 | covered |
|----|------|-----|------|------|---------|
| E1 | NaN离线秒数 | `calculateSnapshot(NaN, rates)` | NaN | ⚠️ 需验证 | ❓ |
| E2 | Infinity离线秒数 | `calculateSnapshot(Infinity, rates)` | ∞ | ⚠️ 需验证 | ❓ |
| E3 | 负数离线秒数 | `calculateSnapshot(-100, rates)` | -100 | 空结果 | ✅ |
| E4 | NaN产出速率 | `calculateSnapshot(3600, NaN Rates)` | NaN | ⚠️ NaN传播 | ❓ |
| E5 | null产出速率 | `calculateSnapshot(3600, null)` | null | ⚠️ 崩溃 | ❓ |
| E6 | NaN翻倍倍率 | `applyDouble(earned, {multiplier:NaN})` | NaN | ⚠️ NaN收益 | ❓ |
| E7 | VIP翻倍无init | `applyDouble` VIP路径 | 未init | ⚠️ deps未初始化 | ❓ |
| E8 | 无效道具ID | `useBoostItemAction('invalid', rates)` | 无效ID | success=false | ✅ |
| E9 | 无效系统ID | `getSystemModifier('nonexistent')` | 未知 | 默认1.0 | ✅ |
| E10 | 无效资源类型-仓库 | `upgradeWarehouse('diamond')` | 无效 | success=false | ✅ |
| E11 | deserialize(null) | `deserialize(null)` | null | ⚠️ 崩溃 | ❓ |
| E12 | deserialize(缺字段) | `deserialize({})` | 不完整 | ⚠️ 需验证 | ❓ |
| E13 | claimReward-null | `claimReward(null)` | null | ⚠️ 崩溃 | ❓ |
| E14 | 邮件系统null回调 | `handleDegradationNotice(false, undefined)` | 无邮件系统 | 弹窗无邮件 | ✅ |
| E15 | 负数VIP等级 | `getVipBonus(-1)` | -1 | ⚠️ 使用VIP0 | ❓ |
| E16 | NaN道具数量 | `addBoostItem('x', NaN)` | NaN | ⚠️ NaN绕过 | ❓ |
| E17 | 攻城负兵力 | `calculateSiegeResult(-100, false)` | 负数 | ⚠️ 负损失 | ❓ |
| E18 | NaN经验加成 | `calculateOfflineExp(3600, NaN)` | NaN | ⚠️ NaN传播 | ❓ |
| E19 | 暂存邮件-空附件 | `enqueueStagingMails([{attachments:undefined}])` | 无附件 | 默认空数组 | ✅ |
| E20 | 过期补偿-无gold附件 | `processExpiredMailCompensation([{attachments:[]}])` | 无gold | 空 | ✅ |

---

### F-Cross（跨系统链路）— 12个节点

| ID | 节点 | 链路 | 预期 | covered |
|----|------|------|------|---------|
| C1 | 衰减→VIP→系统修正→溢出→面板 | calculateFullReward全链路 | 完整结果 | ✅ |
| C2 | 衰减→科技加成→快照收益 | calculateWithSnapshotBonus | 快照加成正确 | ✅ |
| C3 | 资源+建筑+远征三系统汇总 | calculateCrossSystemReward | 无重复 | ✅ |
| C4 | 科技完成→产出更新 | updateProductionRatesAfterTech | 速率更新 | ✅ |
| C5 | 快照丢失→降级通知→邮件 | handleDegradationNotice | 双通道通知 | ✅ |
| C6 | 序列化→反序列化→状态恢复 | serialize/deserialize闭环 | 数据一致 | ✅ |
| C7 | OfflineRewardSystem ↔ OfflineTradeAndBoost | 贸易委托调用 | 结果正确 | ✅ |
| C8 | OfflineRewardSystem ↔ OfflineRewardEngine | 加成系数委托 | 委托正确 | ✅ |
| C9 | OfflineSnapshotSystem → OfflineRewardSystem | 快照→收益计算 | 数据传递 | ✅ |
| C10 | 经验系统→等级→奖励 | calculateOfflineExp升级链 | 奖励正确 | ✅ |
| C11 | 暂存队列→取出→邮箱补发 | enqueue→dequeue | FIFO正确 | ✅ |
| C12 | engine-save覆盖验证 | serialize是否被buildSaveData调用 | ⚠️ 需验证 | ❓ |

---

### F-Lifecycle（生命周期）— 10个节点

| ID | 节点 | API | 预期 | covered |
|----|------|-----|------|---------|
| L1 | init(deps) | `init(deps)` | deps注入 | ✅ |
| L2 | 完整生命周期 | init→calculate→claim→serialize | 全流程 | ✅ |
| L3 | reset清理 | `reset()` | 全部清零 | ✅ |
| L4 | 序列化完整性 | `serialize()` 输出字段 | 所有状态字段 | ✅ |
| L5 | 反序列化恢复 | `deserialize(data)` | 状态恢复 | ✅ |
| L6 | VIP每日重置 | `resetVipDailyCount()` | 跨日重置 | ✅ |
| L7 | 快照创建→验证→清除 | createSnapshot→isSnapshotValid→clearSnapshot | 生命周期 | ✅ |
| L8 | OfflineSnapshotSystem存储加载 | constructor(storage) | localStorage读写 | ✅ |
| L9 | OfflineSnapshotSystem版本校验 | loadSaveData版本检查 | 版本不匹配用默认值 | ✅ |
| L10 | OfflineEstimateSystem无状态 | reset()空操作 | 纯计算 | ✅ |

---

## 统计

| 维度 | 节点数 | covered | 待验证 |
|------|--------|---------|--------|
| F-Normal | 48 | 48 | 0 |
| F-Boundary | 24 | 24 | 0 |
| F-Error | 20 | 8 | 12 |
| F-Cross | 12 | 11 | 1 |
| F-Lifecycle | 10 | 10 | 0 |
| **总计** | **114** | **101** | **13** |

## 高风险API（按P0模式库扫描）

| API | 风险模式 | 严重度 |
|-----|----------|--------|
| `calculateSnapshot` | 模式2/9: NaN传播 | 🔴 高 |
| `applyDouble` | 模式6: 经济漏洞 | 🔴 高 |
| `claimReward` | 模式1: null崩溃 | 🟡 中 |
| `deserialize` | 模式1: null崩溃 | 🔴 高 |
| `addBoostItem` | 模式9: NaN绕过 | 🟡 中 |
| `calculateOfflineExp` | 模式2: NaN传播 | 🟡 中 |
| `calculateSiegeResult` | 模式3: 负值漏洞 | 🟡 中 |
| `applyCapAndOverflow` | 模式14: 溢出无上限 | 🟡 中 |
| `serialize/deserialize` | 模式7/15: 数据丢失 | 🔴 高 |
