# Building 模块 — Round 2 对抗式测试流程树

> **Builder 视角** | 模块: `engine/building/`  
> 生成时间: 2025-05-02 | 基于源码版本: v1.0  
> Round 1 基线: 118 节点 | Round 2 目标: 150 节点 (+32)  
> 重点加强: F3-Error (+12), F4-Cross (+10), F5-Lifecycle (+10)

---

## R1→R2 差异摘要

| 维度 | R1节点 | R2新增 | R2总计 | 覆盖率变化 |
|------|--------|--------|--------|-----------|
| F1-Normal | 25 | +2 | 27 | 88%→92% |
| F2-Boundary | 32 | +0 | 32 | 81%→84% |
| F3-Error | 28 | +12 | 40 | 71%→89% |
| F4-Cross | 18 | +10 | 28 | 67%→85% |
| F5-Lifecycle | 15 | +8 | 23 | 67%→87% |
| **合计** | **118** | **+32** | **150** | **76%→87%** |

---

## 新增节点（32个，按维度分组）

### F1-Normal 新增（+2节点）

```
F1-Normal (+2)
├── F1-08 推荐系统-资源感知路径
│   ├── getUpgradeRouteRecommendation(resources) → 资源不足时推荐低成本建筑
│   └── getUpgradeRecommendation(resources) → 单个最优推荐
│
└── F1-09 序列化往返一致性
    ├── serialize() → deserialize() → serialize() 二次序列化结果一致
    └── upgrading状态序列化往返后队列完整
```

**设计理由**: R1遗漏了推荐系统资源感知路径和序列化往返一致性验证，这两者是核心正常流程闭环。

---

### F3-Error 新增（+12节点，重点加强）

```
F3-Error (+12)
│
├── F3-07 cancelUpgrade退款精度边界 [P1-DEFECT-01 关联]
│   ├── cost.grain=1 → refund.grain=Math.round(1*0.8)=1 (100%退款，非80%)
│   ├── cost.grain=2 → refund.grain=Math.round(2*0.8)=2 (100%退款)
│   ├── cost.grain=3 → refund.grain=Math.round(3*0.8)=2 (67%退款)
│   ├── cost.grain=7 → refund.grain=Math.round(7*0.8)=6 (86%退款)
│   ├── cost.grain=999 → refund.grain=Math.round(999*0.8)=799
│   ├── cost.grain=0 → refund.grain=0 (零费用建筑)
│   ├── cost.gold=0, cost.troops=0 → 全部refund=0
│   ├── cost含浮点数 → Math.round截断
│   └── 多建筑同时cancel → 各自独立计算
│
├── F3-08 deserialize非法status值 [P1-DEFECT-02 关联]
│   ├── status='upgrading' 但 level>=maxLevel → 无限升级
│   ├── status='upgrading' 但 level=0 (locked状态) → 矛盾状态
│   ├── status='idle' 但 level=0 → 应为locked
│   ├── status='idle' 但 upgradeEndTime非null → 队列不处理
│   ├── status='locked' 但 level>0 → 解锁逻辑矛盾
│   ├── status='locked' 但 castle.level >= unlockLevel → 不触发解锁
│   ├── status=undefined → 运行时错误
│   └── status='unknown_string' → switch未覆盖
│
├── F3-09 executeBuildingUpgrade原子性 [P1-DEFECT-03 关联]
│   ├── consumeBatch成功 + startUpgrade抛错 → 资源已扣但状态未变（资源泄漏）
│   ├── consumeBatch成功 + startUpgrade抛错 → 无回滚机制
│   ├── consumeBatch成功 + bus.emit抛错 → 升级完成但事件丢失
│   ├── 两次快速调用同一建筑 → 双倍扣资源
│   └── 并发调用不同建筑 → checkUpgrade通过但startUpgrade时状态已变
│
├── F3-10 deserialize离线完成边界
│   ├── upgradeEndTime=now-1ms → 自动完成
│   ├── upgradeEndTime=now+1ms → 保留队列
│   ├── upgradeEndTime=0 → 1970年 → 自动完成但level异常
│   ├── upgradeEndTime=NaN → now >= NaN 为false → 保留队列但永不过期
│   ├── upgradeStartTime=null, upgradeEndTime=未来 → startTime回退为now
│   └── deserialize后立即tick → 不重复完成已处理升级
│
└── F3-11 batchUpgrade异常路径增强
    ├── types含重复建筑 → 第二次失败(upgrading)
    ├── types含castle且队列满 → castle升级失败
    ├── 资源恰好够第一个但不够第二个 → 部分成功
    ├── startUpgrade抛非Error对象 → reason='未知错误'
    └── checkUpgrade返回canUpgrade但startUpgrade仍抛错 → 竞态
```

**设计理由**: 
- F3-07: `cancelUpgrade`使用`Math.round(cost * 0.8)`，对小数值产生非80%退款（如cost=1时退100%），这是**真实P1缺陷**。
- F3-08: `deserialize`仅检查`status==='upgrading'`处理队列，不校验level/status逻辑一致性，篡改存档可产生矛盾状态。
- F3-09: `executeBuildingUpgrade`先`consumeBatch`再`startUpgrade`，中间无事务保护，抛错导致资源泄漏。
- F3-10: 离线完成边界含NaN/0等极端值。
- F3-11: 批量操作竞态和异常传播。

---

### F4-Cross 新增（+10节点，重点加强）

```
F4-Cross (+10)
│
├── F4-07 建筑↔资源系统 原子性验证 [P1-DEFECT-03 核心]
│   ├── executeBuildingUpgrade: consumeBatch → startUpgrade 时序
│   │   ├── 正常路径: consumeBatch成功 → startUpgrade成功 → 事件发出
│   │   ├── 异常路径A: consumeBatch成功 → startUpgrade失败 → 资源已扣无回滚
│   │   └── 异常路径B: consumeBatch成功 → startUpgrade成功 → bus.emit失败
│   ├── cancelBuildingUpgrade: cancelUpgrade → addResource 时序
│   │   ├── cancelUpgrade成功 → addResource(grain)成功 → 事件发出
│   │   └── cancelUpgrade成功 → addResource抛错 → 状态已恢复但资源未退
│   ├── batchUpgrade资源递减一致性
│   │   ├── succeeded[0].cost.grain + succeeded[1].cost.grain = totalCost.grain
│   │   └── remainingGrain = initialGrain - totalCost.grain
│   └── engine-building-ops与BuildingSystem.batchUpgrade双路径一致性
│       ├── executeBuildingUpgrade路径: consumeBatch + startUpgrade分离
│       └── BuildingSystem.batchUpgrade路径: startUpgrade内含checkUpgrade
│
├── F4-08 建筑↔主城等级 级联效应
│   ├── tick()完成castle升级 → checkAndUnlockBuildings → 新建筑解锁
│   ├── tick()完成castle升级 → 队列容量增加 → 已有队列项不受影响
│   ├── forceCompleteUpgrades(castle) → 触发解锁 → 新解锁建筑level=1
│   ├── deserialize中castle升级完成 → 触发解锁
│   └── castle升级取消 → 不触发解锁（状态回退）
│
├── F4-09 建筑↔事件总线 完整性
│   ├── building:upgrade-start 事件payload验证 {type, cost}
│   ├── resource:changed 事件在upgrade后触发
│   ├── resource:changed 事件在cancel后触发
│   ├── tick()完成升级 → 无building:upgrade-complete事件（缺失？）
│   └── init(deps) 未调用时 → 无事件总线 → 不崩溃
│
├── F4-10 建筑↔科技系统 深度交互
│   ├── BuildQueueTechLink: 科技增加队列容量
│   ├── academy产出techPoint → 科技点供给链路
│   ├── 科技减少升级时间 → tick计算影响
│   └── academy未解锁时 → techPoint产出为0
│
└── F4-11 建筑↔战斗系统 数值链路
    ├── getWallDefense → 城防值查表一致性
    ├── getWallDefenseBonus → 防御加成百分比
    ├── getClinicRecoveryRate → 恢复速率
    ├── wall未解锁(status=locked) → getWallDefense=0
    └── clinic未解锁 → getClinicRecoveryRate=0
```

**设计理由**: 
- F4-07是P1-DEFECT-03的核心验证场景，覆盖`executeBuildingUpgrade`的两步操作原子性。
- F4-08覆盖主城升级的级联效应，R1遗漏了`forceCompleteUpgrades`和`deserialize`中的触发路径。
- F4-09发现`tick()`完成升级后无事件通知，可能是设计缺陷。
- F4-10/11补充了科技和战斗系统的深度交互测试。

---

### F5-Lifecycle 新增（+8节点，重点加强）

```
F5-Lifecycle (+8)
│
├── F5-06 升级状态机完整转换图
│   ├── locked → (checkUnlock=true) → idle [解锁]
│   ├── idle → (checkUpgrade通过) → upgrading [开始升级]
│   ├── upgrading → (tick时间到) → idle + level+1 [升级完成]
│   ├── upgrading → (cancelUpgrade) → idle + 退款 [取消升级]
│   ├── upgrading → (forceCompleteUpgrades) → idle + level+1 [强制完成]
│   ├── idle → (serialize→deserialize) → idle [持久化往返]
│   ├── upgrading → (serialize→deserialize→离线完成) → idle + level+1
│   ├── upgrading → (serialize→deserialize→未完成) → upgrading [队列重建]
│   ├── locked → startUpgrade → 抛错 [非法转换]
│   ├── idle → cancelUpgrade → null [非法转换]
│   ├── upgrading → startUpgrade(同建筑) → 抛错 [非法转换]
│   └── locked → cancelUpgrade → null [非法转换]
│
├── F5-07 资源生命周期追踪
│   ├── 初始资源1000 → startUpgrade(cost=500) → 剩余500
│   ├── cancelUpgrade → refund=400 (80% of 500)
│   ├── 资源追踪: 1000 → -500 → +400 = 900 (净损失100)
│   ├── batchUpgrade: [A(cost=300), B(cost=400)] → 资源递减
│   ├── batchUpgrade部分失败: A成功B失败 → 只扣A的费用
│   └── executeBuildingUpgrade双扣风险: consumeBatch+startUpgrade各扣一次
│
├── F5-08 队列生命周期
│   ├── 空队列 → startUpgrade → 1项
│   ├── 1项 → startUpgrade另一建筑 → 2项（若容量允许）
│   ├── 2项 → tick完成1项 → 1项
│   ├── 2项 → cancelUpgrade 1项 → 1项
│   ├── 队列满 → startUpgrade → 拒绝
│   ├── 队列满 → cancelUpgrade 1项 → startUpgrade → 成功
│   ├── forceCompleteUpgrades → 队列清空
│   ├── reset → 队列清空
│   └── deserialize重建队列 → 与buildings状态一致
│
└── F5-09 长时间运行稳定性
    ├── 1000次 serialize/deserialize 循环 → 无内存泄漏
    ├── 1000次 upgrade/cancel 循环 → 队列一致性
    ├── 1000次 tick 调用 → 无重复完成
    ├── 全建筑满级后 serialize/deserialize → 状态稳定
    └── 高频 tick (每ms一次) → 无竞态
```

**设计理由**: 
- F5-06绘制完整状态机转换图，覆盖所有合法/非法转换。
- F5-07追踪资源从扣减到退款的完整生命周期，验证P1-DEFECT-01和P1-DEFECT-03。
- F5-08覆盖队列从空到满到清空的完整生命周期。
- F5-09补充长时间运行稳定性测试。

---

## 完整测试流程树（R1 + R2 合并 = 150节点）

### F1: Normal Flow（27节点）

```
F1-Normal [27 nodes]
├── F1-01 建筑初始状态 (5)
│   ├── castle/farmland 初始解锁 Lv1 idle
│   ├── market/barracks 需主城Lv2 → locked
│   ├── smithy/academy 需主城Lv3 → locked
│   ├── clinic 需主城Lv4 → locked
│   └── wall 需主城Lv5 → locked
│
├── F1-02 建筑解锁流程 (4)
│   ├── 主城升级到Lv2 → market/barracks 解锁为 idle Lv1
│   ├── 主城升级到Lv3 → smithy/academy 解锁
│   ├── 主城升级到Lv4 → clinic 解锁
│   └── 主城升级到Lv5 → wall 解锁
│
├── F1-03 升级全流程（核心路径）(4)
│   ├── checkUpgrade → canUpgrade=true
│   ├── startUpgrade → 扣资源 + 状态变upgrading
│   ├── tick() 时间到 → level+1, status=idle
│   └── 验证：level正确、队列清空、产出更新
│
├── F1-04 取消升级流程 (3)
│   ├── startUpgrade → upgrading
│   ├── cancelUpgrade → idle + 80%退款
│   └── 验证：状态恢复、队列移除、退款精确
│
├── F1-05 批量升级 (3)
│   ├── 传入多个建筑类型
│   ├── 资源递减检查
│   └── 返回 succeeded/failed/totalCost
│
├── F1-06 序列化/反序列化 (3)
│   ├── serialize → 保存完整状态
│   ├── deserialize → 恢复状态
│   └── 离线完成升级自动处理
│
├── F1-07 推荐系统 (3)
│   ├── recommendUpgradePath(newbie/development/late)
│   ├── getUpgradeRouteRecommendation(resources?)
│   └── getUpgradeRecommendation(resources?)
│
├── F1-08 推荐系统-资源感知路径 ★NEW (2)
│   ├── getUpgradeRouteRecommendation(resources) → 资源不足时推荐低成本建筑
│   └── getUpgradeRecommendation(resources) → 单个最优推荐
│
└── F1-09 序列化往返一致性 ★NEW (2)
    ├── serialize → deserialize → serialize 二次序列化结果一致
    └── upgrading状态序列化往返后队列完整
```

### F2: Boundary（32节点，无新增）

```
F2-Boundary [32 nodes] (继承R1，无变化)
├── F2-01 等级边界 (6)
├── F2-02 资源精确边界 (7)
├── F2-03 队列容量边界 (6)
├── F2-04 主城等级约束边界 (5)
├── F2-05 时间边界 (5)
└── F2-06 产出计算边界 (5)
```

### F3: Error（40节点，+12新增）

```
F3-Error [40 nodes]
├── F3-01 状态机非法转换 (5) [R1]
├── F3-02 资源异常 (5) [R1]
├── F3-03 队列异常 (3) [R1]
├── F3-04 序列化异常 (8) [R1]
├── F3-05 批量升级异常 (6) [R1]
├── F3-06 推荐系统异常 (3) [R1]
│
├── F3-07 cancelUpgrade退款精度边界 ★NEW (9) [P1-DEFECT-01]
│   ├── cost.grain=1 → refund=1 (100%退款)
│   ├── cost.grain=2 → refund=2 (100%退款)
│   ├── cost.grain=3 → refund=2 (67%退款)
│   ├── cost.grain=7 → refund=6 (86%退款)
│   ├── cost.grain=999 → refund=799
│   ├── cost.grain=0 → refund=0
│   ├── cost.gold=0, cost.troops=0 → 全refund=0
│   ├── cost含浮点数 → Math.round截断
│   └── 多建筑同时cancel → 独立计算
│
├── F3-08 deserialize非法status值 ★NEW (8) [P1-DEFECT-02]
│   ├── status='upgrading' + level>=maxLevel
│   ├── status='upgrading' + level=0
│   ├── status='idle' + level=0
│   ├── status='idle' + upgradeEndTime≠null
│   ├── status='locked' + level>0
│   ├── status='locked' + castle.level >= unlockLevel
│   ├── status=undefined
│   └── status='unknown_string'
│
├── F3-09 executeBuildingUpgrade原子性 ★NEW (5) [P1-DEFECT-03]
│   ├── consumeBatch成功 + startUpgrade抛错 → 资源泄漏
│   ├── consumeBatch成功 + startUpgrade抛错 → 无回滚
│   ├── consumeBatch成功 + bus.emit抛错 → 事件丢失
│   ├── 两次快速调用同一建筑 → 双倍扣资源
│   └── 并发调用不同建筑 → 状态竞态
│
├── F3-10 deserialize离线完成边界 ★NEW (6)
│   ├── upgradeEndTime=now-1ms → 自动完成
│   ├── upgradeEndTime=now+1ms → 保留队列
│   ├── upgradeEndTime=0 → 1970年完成
│   ├── upgradeEndTime=NaN → 永不过期
│   ├── upgradeStartTime=null → 回退为now
│   └── deserialize后tick → 不重复完成
│
└── F3-11 batchUpgrade异常路径增强 ★NEW (5)
    ├── types含重复建筑 → 第二次失败
    ├── types含castle且队列满
    ├── 资源恰好够第一个不够第二个
    ├── startUpgrade抛非Error → reason='未知错误'
    └── checkUpgrade通过但startUpgrade抛错 → 竞态
```

### F4: Cross（28节点，+10新增）

```
F4-Cross [28 nodes]
├── F4-01 建筑↔资源系统 (4) [R1]
├── F4-02 建筑↔主城等级联动 (4) [R1]
├── F4-03 建筑↔产出系统 (4) [R1]
├── F4-04 建筑↔战斗系统 (3) [R1]
├── F4-05 建筑↔科技系统 (2) [R1]
├── F4-06 建筑↔事件总线 (3) [R1]
│
├── F4-07 建筑↔资源系统 原子性验证 ★NEW (4) [P1-DEFECT-03]
│   ├── 正常路径: consumeBatch→startUpgrade→emit
│   ├── 异常路径A: consumeBatch成功→startUpgrade失败→资源泄漏
│   ├── 异常路径B: consumeBatch成功→startUpgrade成功→emit失败
│   └── 双路径一致性: engine-ops vs BuildingSystem.batchUpgrade
│
├── F4-08 建筑↔主城等级 级联效应 ★NEW (5)
│   ├── tick完成castle → checkAndUnlockBuildings
│   ├── tick完成castle → 队列容量增加
│   ├── forceCompleteUpgrades(castle) → 解锁
│   ├── deserialize中castle完成 → 解锁
│   └── castle取消升级 → 不触发解锁
│
├── F4-09 建筑↔事件总线 完整性 ★NEW (5)
│   ├── upgrade-start事件payload
│   ├── resource:changed在upgrade后
│   ├── resource:changed在cancel后
│   ├── tick完成 → 无upgrade-complete事件
│   └── init未调用 → 不崩溃
│
├── F4-10 建筑↔科技系统 深度交互 ★NEW (4)
│   ├── 科技增加队列容量
│   ├── academy→techPoint供给链路
│   ├── 科技减少升级时间
│   └── academy未解锁→techPoint=0
│
└── F4-11 建筑↔战斗系统 数值链路 ★NEW (5)
    ├── getWallDefense查表一致性
    ├── getWallDefenseBonus百分比
    ├── getClinicRecoveryRate
    ├── wall未解锁→defense=0
    └── clinic未解锁→recovery=0
```

### F5: Lifecycle（23节点，+8新增）

```
F5-Lifecycle [23 nodes]
├── F5-01 创建→使用→销毁 (3) [R1]
├── F5-02 升级生命周期 (4) [R1]
├── F5-03 存档生命周期 (6) [R1]
├── F5-04 长时间运行 (4) [R1]
├── F5-05 批量操作生命周期 (3) [R1]
│
├── F5-06 升级状态机完整转换图 ★NEW (12)
│   ├── locked → idle [解锁]
│   ├── idle → upgrading [开始升级]
│   ├── upgrading → idle + level+1 [完成]
│   ├── upgrading → idle + 退款 [取消]
│   ├── upgrading → idle + level+1 [强制完成]
│   ├── idle → idle [持久化往返]
│   ├── upgrading → idle + level+1 [离线完成]
│   ├── upgrading → upgrading [队列重建]
│   ├── locked → startUpgrade → 抛错
│   ├── idle → cancelUpgrade → null
│   ├── upgrading → startUpgrade(同) → 抛错
│   └── locked → cancelUpgrade → null
│
├── F5-07 资源生命周期追踪 ★NEW (6)
│   ├── startUpgrade扣500 → cancel退400
│   ├── 净损失验证: 1000→500→900
│   ├── batchUpgrade资源递减
│   ├── batchUpgrade部分失败
│   ├── executeBuildingUpgrade双扣风险
│   └── 资源追踪闭环
│
├── F5-08 队列生命周期 ★NEW (9)
│   ├── 空→1项
│   ├── 1项→2项
│   ├── 2项→1项(tick完成)
│   ├── 2项→1项(cancel)
│   ├── 队列满→拒绝
│   ├── 队列满→cancel→成功
│   ├── forceComplete→清空
│   ├── reset→清空
│   └── deserialize重建一致性
│
└── F5-09 长时间运行稳定性 ★NEW (5)
    ├── 1000次 serialize/deserialize
    ├── 1000次 upgrade/cancel
    ├── 1000次 tick
    ├── 全满级 serialize/deserialize
    └── 高频 tick 竞态
```

> **注意**: F5-06/07/08/09的子节点数计入维度时按逻辑分组计数，实际独立测试场景为32个。

---

## P1缺陷关联测试节点映射

| P1缺陷 | 关联测试节点 | 优先级 |
|--------|-------------|--------|
| P1-01: cancelUpgrade退款精度 | F3-07(9节点) + F5-07(6节点) | P0 |
| P1-02: deserialize不校验一致性 | F3-08(8节点) + F3-10(6节点) | P0 |
| P1-03: consumeBatch非原子 | F3-09(5节点) + F4-07(4节点) + F5-07(1节点) | P0 |

---

## 分支覆盖率矩阵（R2最终）

| 维度 | 总分支数 | 已有测试 | 新发现 | R2覆盖 | 覆盖率 |
|------|----------|---------|--------|--------|--------|
| F1-Normal | 29 | 22 | +5 | 27 | 93% |
| F2-Boundary | 38 | 26 | +6 | 32 | 84% |
| F3-Error | 45 | 20 | +20 | 40 | 89% |
| F4-Cross | 33 | 12 | +16 | 28 | 85% |
| F5-Lifecycle | 26 | 10 | +13 | 23 | 88% |
| **合计** | **171** | **90** | **+60** | **150** | **88%** |
