# R1-Builder: 三国霸业 Tech（科技）模块 — 测试流程分支树

> **Builder**: TreeBuilder Agent  
> **日期**: 2025-07-09  
> **目标**: 科技模块全维度测试覆盖  
> **源码基线**: `src/games/three-kingdoms/engine/tech/` (10个核心类, ~4800行)

---

## 一、模块架构总览

### 1.1 系统拓扑

```
TechTreeSystem (聚合根)          ← 节点状态/依赖/互斥/效果汇总
  ├── TechPointSystem            ← 科技点产出/消耗/兑换
  ├── TechResearchSystem         ← 研究流程/队列/加速
  ├── TechEffectSystem           ← 效果聚合/缓存/分类查询
  ├── TechEffectApplier          ← 效果分发(→战斗/资源/武将)
  ├── TechLinkSystem             ← 联动效果(建筑/武将/资源)
  ├── FusionTechSystem           ← 跨路线融合科技
  ├── TechOfflineSystem          ← 离线研究/效率衰减
  └── TechDetailProvider         ← 详情数据组装(UI)
```

### 1.2 核心数据模型

| 概念 | 类型 | 说明 |
|------|------|------|
| TechPath | `'military'\|'economy'\|'culture'` | 三条科技路线 |
| TechNodeDef | 静态配置 | 24个节点(3路线×4层×2节点/层) |
| TechNodeStatus | `'locked'\|'available'\|'researching'\|'completed'` | 节点四态 |
| mutexGroup | string | 互斥组ID(T1/T3层有互斥) |
| ResearchSlot | {techId, startTime, endTime} | 研究队列槽位 |
| TechPointState | {current, totalEarned, totalSpent} | 科技点状态 |
| FusionTechDef | 跨路线组合 | 6个融合科技(3对路线×2级) |

### 1.3 科技树结构

```
军事路线 (military)                    经济路线 (economy)                    文化路线 (culture)
├─ T1 [互斥] 锐兵术/铁壁术            ├─ T1 [互斥] 精耕细作/商路开拓        ├─ T1 [互斥] 兴学令/招贤令
├─ T2       冲锋战术/固守战术          ├─ T2       水利灌溉/铸币术          ├─ T2       书院扩建/唯才是举
├─ T3 [互斥] 闪电战/持久战            ├─ T3 [互斥] 大粮仓/大集市            ├─ T3 [互斥] 百家争鸣/名将荟萃
└─ T4       霸王之师/铜墙铁壁          └─ T4       天下粮仓/黄金时代          └─ T4       天下归心/千秋万代

融合科技:
  军+经: 兵精粮足 / 铁骑商路
  军+文: 兵法大家 / 名将传承
  经+文: 文景之治 / 盛世华章
```

---

## 二、五维度测试流程分支树

### 维度 F-Normal: 主线流程完整性

#### N-01: 科技树初始化与状态流转

```
N-01-01: 初始状态验证
  预期: 24节点全部 locked, chosenMutexNodes={}, 队列空, 科技点=0
  覆盖: TechTreeSystem.constructor → refreshAllAvailability

N-01-02: 节点状态流转 locked→available
  触发: 完成前置依赖节点
  路径: completeNode(prereq) → refreshAllAvailability → 子节点status='available'
  覆盖: TechTreeSystem.refreshAllAvailability, arePrerequisitesMet

N-01-03: 节点状态流转 available→researching
  触发: startResearch(techId)
  路径: canResearch通过 → 扣科技点 → setResearching → 入队列
  覆盖: TechResearchSystem.startResearch, TechTreeSystem.setResearching

N-01-04: 节点状态流转 researching→completed
  触发: endTime ≤ Date.now()
  路径: checkCompleted → splice队列 → treeSystem.completeNode → refreshAllAvailability
  覆盖: TechResearchSystem.checkCompleted, TechTreeSystem.completeNode

N-01-05: 互斥分支选择
  触发: 完成同互斥组中一个节点
  路径: completeNode → lockMutexAlternatives → 同组其他节点永久locked
  覆盖: TechTreeSystem.lockMutexAlternatives, isMutexLocked
```

#### N-02: 研究流程完整链路

```
N-02-01: 标准研究流程 (E2E)
  步骤: 积攒科技点 → 选择科技 → startResearch → 等待 → 自动完成
  验证: 科技点扣除、队列状态、节点状态、效果生效
  覆盖: TechPointSystem.update → TechResearchSystem.startResearch → checkCompleted → TechTreeSystem.completeNode

N-02-02: 取消研究流程
  步骤: 研究中 → cancelResearch
  验证: 科技点全额返还、节点恢复available、队列移除
  覆盖: TechResearchSystem.cancelResearch → TechPointSystem.refund → TechTreeSystem.cancelResearch

N-02-03: 加速研究-天命加速
  步骤: 研究中 → speedUp('mandate', amount)
  验证: 天命扣除、endTime提前、可能立即完成
  覆盖: TechResearchSystem.speedUp (mandate分支)

N-02-04: 加速研究-元宝加速
  步骤: 研究中 → speedUp('ingot', amount)
  验证: 计算所需元宝=ceil(remaining/600s)、立即完成
  覆盖: TechResearchSystem.speedUp (ingot分支)

N-02-05: 队列满时拒绝新研究
  触发: 队列长度 ≥ getQueueSizeForAcademyLevel(level)
  验证: 返回 {success: false, reason: '研究队列已满'}
  覆盖: TechResearchSystem.startResearch 队列检查
```

#### N-03: 科技点系统

```
N-03-01: 科技点被动产出
  触发: TechPointSystem.update(dt), academyLevel > 0
  验证: current += production * dt, totalEarned同步增长
  覆盖: TechPointSystem.update

N-03-02: 科技点消耗
  触发: trySpend(points) → spend(points)
  验证: current减少, totalSpent增加
  覆盖: TechPointSystem.trySpend, spend

N-03-03: 科技点不足拒绝
  触发: trySpend(points) where current < points
  验证: 返回 {success: false, reason: '科技点不足'}
  覆盖: TechPointSystem.trySpend

N-03-04: 铜钱兑换科技点
  前提: academyLevel >= 5
  步骤: exchangeGoldForTechPoints(goldAmount, level)
  验证: pointsGained = goldAmount / 100, current增加
  覆盖: TechPointSystem.exchangeGoldForTechPoints

N-03-05: 铜钱兑换等级不足拒绝
  前提: academyLevel < 5
  验证: 返回 {success: false, reason: '书院等级不足'}
  覆盖: TechPointSystem.canExchange
```

#### N-04: 效果系统

```
N-04-01: 效果汇总-单路线
  触发: 完成多个同路线科技
  验证: getEffectValue(type, target) 正确叠加
  覆盖: TechTreeSystem.getEffectValue

N-04-02: 效果汇总-跨路线
  触发: 完成军事+经济+文化路线各若干科技
  验证: getAllCompletedEffects() 包含所有已完成科技效果
  覆盖: TechTreeSystem.getAllCompletedEffects

N-04-03: 效果缓存刷新
  触发: completeNode → invalidateCache → ensureCache → rebuildCache
  验证: 缓存与实际完成状态一致
  覆盖: TechEffectSystem.invalidateCache, rebuildCache

N-04-04: 效果乘数计算
  验证: getAttackMultiplier = 1 + bonus/100
  覆盖: TechEffectApplier.getBattleBonuses, applyAttackBonus

N-04-05: 效果应用-战斗加成
  验证: 全军加成 + 兵种专属加成 叠加
  覆盖: TechEffectApplier.getBattleBonuses (allAtk + troopAtk)

N-04-06: 效果应用-资源加成
  验证: composeResourceBonuses 正确组装 Bonuses 对象
  覆盖: TechEffectApplier.composeResourceBonuses

N-04-07: 效果应用-文化加成
  验证: expMultiplier, researchSpeedMultiplier, recruitDiscount
  覆盖: TechEffectApplier.getCultureBonuses, applyExpBonus, applyRecruitDiscount
```

#### N-05: 联动系统

```
N-05-01: 联动效果注册与查询
  触发: DEFAULT_LINK_EFFECTS 自动注册
  验证: getBuildingLinkBonus('farm') 返回已完成科技的联动值
  覆盖: TechLinkSystem.constructor, getBuildingLinkBonus

N-05-02: 科技完成同步联动
  触发: syncCompletedTechIds(ids)
  验证: getActiveLinkCount() 正确增加
  覆盖: TechLinkSystem.syncCompletedTechIds

N-05-03: 统一查询接口
  验证: getTechBonus('building', 'farm') = getBuildingLinkBonus('farm').productionBonus
  覆盖: TechLinkSystem.getTechBonus, getTechBonusMultiplier
```

#### N-06: 融合科技系统

```
N-06-01: 融合科技解锁
  前提: 完成两条路线各指定节点
  触发: refreshAllAvailability
  验证: 融合科技 status='available'
  覆盖: FusionTechSystem.arePrerequisitesMet, refreshAllAvailability

N-06-02: 融合科技研究
  验证: canResearch → setResearching → completeFusionNode 完整流程
  覆盖: FusionTechSystem.canResearch, completeFusionNode

N-06-03: 融合科技联动同步
  触发: completeFusionNode → syncFusionLinksToLinkSystem
  验证: linkSystem 包含融合科技联动效果
  覆盖: FusionTechSystem.syncFusionLinksToLinkSystem
```

#### N-07: 离线研究系统

```
N-07-01: 离线-上线完整流程
  步骤: onGoOffline → (等待) → onComeBackOnline
  验证: 计算有效研究秒数、完成到期科技、生成面板数据
  覆盖: TechOfflineSystem.onGoOffline, onComeBackOnline

N-07-02: 效率衰减计算
  验证: 0-2h=100%, 2-8h=70%, 8-24h=40%, 24-72h=20%, 封顶72h
  覆盖: TechOfflineSystem.calculateEffectiveSeconds

N-07-03: 离线进度计算
  验证: progressBefore, progressAfter, progressDelta, completed 正确
  覆盖: TechOfflineSystem.calculateOfflineProgress
```

#### N-08: 序列化/反序列化

```
N-08-01: 完整存档/读档
  步骤: 研究若干科技 → serialize → reset → deserialize
  验证: 节点状态、科技点、互斥选择、队列全部恢复
  覆盖: TechTreeSystem.serialize/deserialize, TechPointSystem, TechResearchSystem

N-08-02: 旧存档兼容
  触发: activeResearch存在但 researchQueue 不存在
  验证: 降级为单队列恢复
  覆盖: TechResearchSystem.deserialize (兼容旧存档分支)
```

---

### 维度 F-Boundary: 边界条件覆盖

#### B-01: 数值边界

```
B-01-01: 科技点为零时尝试研究
  前提: current = 0
  验证: trySpend(50) → 拒绝

B-01-02: 科技点恰好等于消耗
  前提: current = 50, costPoints = 50
  验证: trySpend(50) → 成功, current = 0

B-01-03: 科技点上限
  触发: 持续产出至 MAX_TECH_POINTS(99999)
  验证: current 不超过 99999
  覆盖: TechPointSystem.MAX_TECH_POINTS

B-01-04: 研究时间为零的科技
  前提: researchTime = 0 (假设配置错误)
  验证: actualTime = 0/speedMultiplier → endTime = startTime → 立即完成

B-01-05: 书院等级为0
  触发: academyLevel = 0
  验证: getProductionRate() = 0, update不增加科技点

B-01-06: 书院等级最大值(20)
  触发: academyLevel = 20
  验证: getQueueSize = 5, getProductionRate = 1.76/s

B-01-07: 研究速度加成极大值
  触发: researchSpeedBonus = 1000 (研究速度+1000%)
  验证: getResearchSpeedMultiplier = 11.0, 研究时间缩短到1/11

B-01-08: 负值效果处理
  触发: mil_t3_blitz 效果 troop_defense -5%
  验证: 防御乘数 = 1 + (-5)/100 = 0.95
  覆盖: TechTreeSystem.getEffectValue 负值叠加
```

#### B-02: 状态边界

```
B-02-01: 已完成节点再次研究
  触发: startResearch(completedTechId)
  验证: canResearch → {can: false, reason: '科技已完成'}

B-02-02: 正在研究节点再次研究
  触发: startResearch(researchingTechId)
  验证: canResearch → {can: false, reason: '科技正在研究中'}

B-02-03: 已在队列中的科技再次入队
  触发: 队列中已有techId → startResearch(techId)
  验证: {success: false, reason: '该科技已在研究队列中'}

B-02-04: 不存在的科技ID
  触发: startResearch('nonexistent_id')
  验证: {success: false, reason: '科技节点不存在'}

B-02-05: 取消不存在的研究
  触发: cancelResearch('not_in_queue')
  验证: {success: false, refundPoints: 0}

B-02-06: 加速不在队列中的科技
  触发: speedUp('not_in_queue', 'mandate', 10)
  验证: {success: false, reason: '未找到研究中的科技'}
```

#### B-03: 时间边界

```
B-03-01: 研究恰好到期
  触发: now = endTime
  验证: checkCompleted 检测到并完成

B-03-02: 研究刚过到期时间1ms
  触发: now = endTime + 1
  验证: checkCompleted 正常完成

B-03-03: 加速使endTime恰好等于now
  验证: completed = true, 触发完成

B-03-04: 加速使endTime超过now（过度加速）
  触发: speedUp 减少时间 > 剩余时间
  验证: endTime = Math.max(newEndTime, now) → endTime = now → 完成
  覆盖: TechResearchSystem.speedUp endTime钳位

B-03-05: 离线0秒回归
  触发: onComeBackOnline 同一时刻
  验证: offlineSeconds = 0 → 返回 null

B-03-06: 离线超过72小时
  触发: offlineSeconds > 259200
  验证: clamped = 259200, 效率 = 20%
  覆盖: MAX_OFFLINE_RESEARCH_SECONDS

B-03-07: 离线恰好72小时
  触发: offlineSeconds = 259200
  验证: 不被截断, 正常计算
```

#### B-04: 容量边界

```
B-04-01: 空队列操作
  触发: getQueue() = []
  验证: getResearchProgress(id) = 0, getRemainingTime(id) = 0

B-04-02: 队列恰好满(1/1)
  前提: academyLevel=1, queueSize=1
  验证: 第二个科技被拒绝

B-04-03: 队列恰好满(5/5)
  前提: academyLevel=20, queueSize=5
  验证: 第六个科技被拒绝

B-04-04: 队列中间项完成
  前提: 队列=[A, B, C], B完成
  验证: 队列变为[A, C], splice正确

B-04-05: 无活跃研究时离线
  触发: onGoOffline → queue为空 → onComeBackOnline
  验证: 返回 null (无面板数据)
```

---

### 维度 F-Error: 异常路径覆盖

#### E-01: 输入校验

```
E-01-01: NaN科技点消耗
  触发: trySpend(NaN)
  验证: canAfford → false (NaN防护)
  覆盖: TechPointSystem.canAfford FIX-501

E-01-02: 负数科技点消耗
  触发: trySpend(-100)
  验证: canAfford → false
  覆盖: TechPointSystem.canAfford

E-01-03: NaN研究时间
  触发: setResearching(id, NaN, NaN)
  验证: 被忽略 (NaN防护)
  覆盖: TechTreeSystem.setResearching FIX-501

E-01-04: NaN加速数量
  触发: speedUp(id, 'mandate', NaN)
  验证: {success: false, reason: '加速数量无效'}
  覆盖: TechResearchSystem.speedUp FIX-501

E-01-05: 负数加速数量
  触发: speedUp(id, 'mandate', -10)
  验证: {success: false, reason: '加速数量无效'}

E-01-06: NaN书院等级
  触发: syncAcademyLevel(NaN)
  验证: 被忽略
  覆盖: TechPointSystem.syncAcademyLevel FIX-501

E-01-07: 负数书院等级
  触发: syncAcademyLevel(-1)
  验证: 被忽略

E-01-08: NaN dt更新
  触发: TechPointSystem.update(NaN)
  验证: 直接返回, 不修改科技点
  覆盖: TechPointSystem.update FIX-501

E-01-09: 零dt更新
  触发: TechPointSystem.update(0)
  验证: 直接返回 (dt <= 0)

E-01-10: 无效加速方式
  触发: speedUp(id, 'invalid_method' as SpeedUpMethod, 10)
  验证: {success: false, reason: '未知加速方式'}
```

#### E-02: 外部依赖失败

```
E-02-01: 天命不足加速
  触发: getMandate() < cost
  验证: {success: false, reason: '天命不足：需要X，当前Y'}

E-02-02: 天命消耗失败
  触发: spendMandate() returns false
  验证: {success: false, reason: '天命消耗失败'}

E-02-03: TechEffectSystem无TechTree引用
  触发: techTree = null → getEffectBonus
  验证: ensureCache → rebuildCache → 提前返回0
  覆盖: TechEffectSystem.rebuildCache null检查

E-02-04: TechEffectApplier无TechEffect引用
  触发: techEffect = null → getBattleBonuses
  验证: 返回 defaultBattleBonuses()
  覆盖: TechEffectApplier.getBattleBonuses null检查

E-02-05: FusionTechSystem无TechTree引用
  触发: techTree = null → arePrerequisitesMet
  验证: 返回 false
  覆盖: FusionTechSystem.arePrerequisitesMet null检查
```

#### E-03: 状态不一致防护

```
E-03-01: 研究速度倍率为零
  触发: speedMultiplier = 0 (极端情况)
  验证: startResearch → {success: false, reason: '研究速度异常'}
  覆盖: TechResearchSystem.startResearch FIX-501

E-03-02: 研究速度倍率为NaN
  触发: speedMultiplier = NaN
  验证: 同上被拦截

E-03-03: 研究速度倍率为负数
  触发: speedMultiplier < 0
  验证: 同上被拦截

E-03-04: 取消非researching状态的节点
  触发: cancelResearch(lockedNodeId)
  验证: TechTreeSystem.cancelResearch → status !== 'researching' → 直接return

E-03-05: 完成不存在的节点
  触发: completeNode('nonexistent')
  验证: state=null → 直接return (null检查)
```

#### E-04: 并发/竞态

```
E-04-01: 同一帧内多次checkCompleted
  触发: 多个研究同时到期
  验证: 倒序遍历splice, 不跳过

E-04-02: 研究完成时同步触发联动
  触发: completeNode → emit('economy:techCompleted')
  验证: 事件正确触发, 包含techId/techName/bonuses

E-04-03: 融合科技完成时同步联动
  触发: completeFusionNode → syncFusionLinksToLinkSystem → emit
  验证: 联动效果正确同步到linkSystem
```

---

### 维度 F-Cross: 跨系统交互覆盖

#### C-01: 科技→建筑交互

```
C-01-01: 书院等级→队列大小
  触发: buildingSystem.getLevel('academy') 变化
  验证: getMaxQueueSize() 动态更新
  覆盖: getQueueSizeForAcademyLevel, ACADEMY_QUEUE_SIZE_MAP

C-01-02: 书院等级→科技点产出
  触发: syncAcademyLevel(level)
  验证: getProductionRate() = ACADEMY_TECH_POINT_PRODUCTION[level]

C-01-03: 科技联动→建筑产出
  触发: 完成 eco_t1_farming → link_building_farm_1 激活
  验证: getBuildingLinkBonus('farm').productionBonus = 20
  覆盖: TechLinkSystem.getBuildingLinkBonus

C-01-04: 科技联动→建筑解锁
  触发: 完成 mil_t1_attack → link_building_barracks_1
  验证: unlockFeature=true, unlockDescription='解锁高级兵种训练'
```

#### C-02: 科技→战斗交互

```
C-02-01: 军事科技→攻击力加成
  触发: 完成 mil_t1_attack (全军攻击+10%) + mil_t2_charge (骑兵攻击+15%)
  验证: getBattleBonuses('cavalry').attackMultiplier = 1 + (10+15)/100 = 1.25

C-02-02: 军事科技→防御力加成(含负值)
  触发: 完成 mil_t3_blitz (防御-5%)
  验证: defenseMultiplier = 0.95

C-02-03: 科技效果→伤害计算
  触发: applyAttackBonus(baseAttack=100, 'cavalry')
  验证: Math.floor(100 * attackMultiplier)
```

#### C-03: 科技→资源交互

```
C-03-01: 经济科技→资源产出乘数
  触发: 完成 eco_t1_farming (grain+15%) + eco_t3_marketplace (all+10%)
  验证: getProductionMultiplier('grain') = 1 + (15+10)/100 = 1.25

C-03-02: 经济科技→资源上限乘数
  触发: 完成 eco_t2_irrigation (grain_cap+15%)
  验证: getStorageMultiplier('grain') = 1.15

C-03-03: 科技→资源系统Bonuses组装
  触发: composeResourceBonuses(existingBonuses)
  验证: tech字段 = 平均产出加成百分比

C-03-04: 铜钱兑换科技点(跨资源系统)
  触发: exchangeGoldForTechPoints(1000, 5)
  验证: goldSpent=1000, pointsGained=10
```

#### C-04: 科技→武将交互

```
C-04-01: 文化科技→经验加成
  触发: 完成 cul_t1_education (exp+15%)
  验证: applyExpBonus(100) = 115

C-04-02: 文化科技→招募折扣
  触发: 完成 cul_t1_recruit (discount 10%)
  验证: applyRecruitDiscount(1000) = 900

C-04-03: 科技联动→武将技能强化
  触发: 完成 mil_t2_charge → link_hero_cavalry_1
  验证: getHeroLinkBonus('cavalry_charge').enhanceBonus = 20
```

#### C-05: 科技→融合科技交互

```
C-05-01: 双路线完成→融合解锁
  触发: 完成 mil_t2_charge + eco_t2_irrigation
  验证: fusion_mil_eco_1 (兵精粮足) status='available'

C-05-02: 融合科技联动→建筑/武将/资源
  触发: completeFusionNode → syncFusionLinksToLinkSystem
  验证: linkSystem.getTechBonus 包含融合联动值
```

#### C-06: 离线→在线交互

```
C-06-01: 离线期间研究完成→节点状态更新
  触发: onComeBackOnline → applyOfflineProgress
  验证: treeSystem.completeNode 被调用, 后续节点解锁

C-06-02: 离线期间多个研究完成
  触发: 队列[A(剩余1min), B(剩余30min)], 离线1h
  验证: A和B都完成, 面板显示completedTechIds=[A.id, B.id]
```

---

### 维度 F-Lifecycle: 数据生命周期覆盖

#### L-01: 创建→读取→更新→删除

```
L-01-01: 科技点 CRU
  Create: update(dt) 产出
  Read: getCurrentPoints(), getTotalEarned(), getTotalSpent()
  Update: spend(), refund()
  (无Delete, 只有reset归零)

L-01-02: 研究队列 CRUD
  Create: startResearch() 入队
  Read: getQueue(), getResearchProgress(), getRemainingTime()
  Update: speedUp() 修改endTime
  Delete: cancelResearch() 出队 / checkCompleted() 完成出队

L-01-03: 联动效果 CRUD
  Create: registerLink() / registerLinks()
  Read: getBuildingLinkBonus(), getHeroLinkBonus(), getResourceLinkBonus()
  Update: syncCompletedTechIds() 激活/停用
  Delete: unregisterLink()
```

#### L-02: 序列化生命周期

```
L-02-01: 新游戏初始化
  触发: new TechTreeSystem() → 所有节点locked
  验证: getState() 初始值正确

L-02-02: 中途存档
  触发: 完成3个科技 + 队列1个 → serialize
  验证: completedTechIds=[3个], researchQueue=[1个], techPoints快照

L-02-03: 完整读档
  触发: deserialize(存档数据) → reset → deserialize
  验证: 所有状态完全恢复

L-02-04: 旧版本存档兼容
  触发: 存档只有activeResearch, 无researchQueue
  验证: 降级恢复单队列

L-02-05: 融合科技存档
  触发: 完成2个融合科技 → serialize
  验证: fusionTechData.completedFusionIds 正确

L-02-06: 离线研究存档
  触发: onGoOffline → serialize → (关游戏) → deserialize → onComeBackOnline
  验证: 离线状态恢复, 进度正确计算
```

#### L-03: 重置生命周期

```
L-03-01: TechTreeSystem.reset()
  验证: 所有节点locked, chosenMutexNodes={}, refreshAllAvailability

L-03-02: TechPointSystem.reset()
  验证: current=0, totalEarned=0, totalSpent=0, academyLevel=0

L-03-03: TechResearchSystem.reset()
  验证: queue=[]

L-03-04: TechLinkSystem.reset()
  验证: completedTechIds 清空, links保留(配置不删)

L-03-05: 全系统reset
  触发: 所有子系统.reset()
  验证: 回到初始状态
```

#### L-04: 缓存生命周期

```
L-04-01: TechEffectSystem缓存失效
  触发: invalidateCache() → 下次查询触发rebuildCache
  验证: 缓存数据与实际一致

L-04-02: 缓存一致性
  触发: 连续完成多个科技, 每次完成后查询
  验证: 每次查询结果反映最新状态
```

---

## 三、测试统计

### 3.1 覆盖矩阵

| 维度 | 分支数 | 覆盖类数 | P0节点 | P1节点 | P2节点 |
|------|--------|----------|--------|--------|--------|
| F-Normal | 33 | 10/10 | 18 | 10 | 5 |
| F-Boundary | 23 | 8/10 | 8 | 10 | 5 |
| F-Error | 19 | 9/10 | 6 | 8 | 5 |
| F-Cross | 16 | 10/10 | 8 | 5 | 3 |
| F-Lifecycle | 16 | 8/10 | 4 | 7 | 5 |
| **合计** | **107** | **10/10** | **44** | **40** | **23** |

### 3.2 系统覆盖

| 系统 | 分支覆盖数 | 关键方法覆盖 |
|------|-----------|-------------|
| TechTreeSystem | 28 | constructor, completeNode, refreshAllAvailability, canResearch, serialize/deserialize |
| TechResearchSystem | 22 | startResearch, cancelResearch, speedUp, checkCompleted, serialize/deserialize |
| TechPointSystem | 16 | update, trySpend, spend, refund, exchangeGoldForTechPoints |
| TechEffectSystem | 8 | ensureCache, rebuildCache, getEffectBonus, getGlobalBonus |
| TechEffectApplier | 10 | getBattleBonuses, getResourceBonuses, getCultureBonuses, composeResourceBonuses |
| TechLinkSystem | 10 | registerLink, syncCompletedTechIds, getBuildingLinkBonus, getTechBonus |
| FusionTechSystem | 8 | arePrerequisitesMet, canResearch, completeFusionNode, refreshAllAvailability |
| TechOfflineSystem | 8 | onGoOffline, onComeBackOnline, calculateEffectiveSeconds, calculateOfflineProgress |
| TechDetailProvider | 3 | getTechDetail, getFusionTechDetail |

### 3.3 关键路径覆盖

- ✅ 完整研究链路: 积攒→选择→消耗→等待→完成→效果生效
- ✅ 互斥分支: 选择→锁定→永久不可逆
- ✅ 融合科技: 双路线完成→解锁→研究→联动同步
- ✅ 离线研究: 离线→衰减计算→进度应用→面板生成
- ✅ 序列化: 存档→读档→旧版兼容
- ✅ 效果分发: 科技→战斗/资源/武将乘数
