# 建筑系统 (Building) — 测试用例清单

> 生成时间：2025-07-11
> 对抗式测试：基于流程分支树枚举

---

## 1. 流程分支树

### 1.1 状态读取类 API

```
getAllBuildings()
├── 正常：返回所有8种建筑状态
├── 隔离：返回深拷贝，修改不影响内部
└── 初始：新实例返回正确初始值

getBuilding(type)
├── 正常：返回指定建筑状态
├── 隔离：返回浅拷贝
└── 边界：每种建筑类型

getLevel(type)
├── 正常：返回等级
└── 边界：Lv0/Lv1/LvMax

getCastleLevel()
├── 正常：返回主城等级
└── 边界：初始值=1

getBuildingLevels()
├── 正常：返回8种建筑等级映射
└── 完整性：包含所有 BUILDING_TYPES

getBuildingDef(type)
├── 正常：返回静态定义
└── 边界：每种建筑类型

getAppearanceStage(type)
├── 正常：返回外观阶段
├── 边界：Lv1→humble, Lv5→humble, Lv6→orderly
│         Lv12→orderly, Lv13→refined, Lv20→refined
│         Lv21→glorious
└── 特殊：Lv0→humble

isUnlocked(type)
├── 正常：已解锁返回 true
├── 正常：未解锁返回 false
└── 边界：初始解锁(castle/farmland) vs 初始锁定(wall)
```

### 1.2 解锁检查类 API

```
checkUnlock(type)
├── 正常：满足条件返回 true
├── 边界：主城等级恰好等于要求
├── 边界：主城等级比要求少1
├── 边界：主城等级比要求多1
└── 特殊：unlockLevel=0（castle/farmland）始终 true

checkAndUnlockBuildings()
├── 正常：主城升级后批量解锁新建筑
├── 边界：无新建筑可解锁
├── 边界：多个建筑同时满足解锁条件
├── 异常：已解锁建筑不被重复处理
└── 跨系统：主城 Lv1→2 解锁 market+barracks
            主城 Lv2→3 解锁 smithy+academy
            主城 Lv3→4 解锁 clinic
            主城 Lv4→5 解锁 wall
```

### 1.3 升级前置条件检查 API

```
checkUpgrade(type, resources?)
├── 正常：满足所有条件返回 canUpgrade=true
├── 异常：建筑锁定 → "建筑尚未解锁"
├── 异常：建筑正在升级 → "建筑正在升级中"
├── 异常：已达等级上限 → "已达等级上限 LvXX"
├── 异常：非主城等级 > 主城等级 → "不能超过主城等级+1"
│   ├── 边界：建筑等级 = 主城等级 → 拒绝
│   └── 边界：建筑等级 = 主城等级 - 1 → 允许
├── 异常：主城特殊前置
│   ├── 主城 Lv4→5，无其他建筑 Lv4 → 拒绝
│   ├── 主城 Lv4→5，有其他建筑 Lv4 → 允许
│   ├── 主城 Lv9→10，无其他建筑 Lv9 → 拒绝
│   └── 主城 Lv9→10，有其他建筑 Lv9 → 允许
├── 异常：队列已满 → "升级队列已满"
├── 异常：粮草不足 → "粮草不足"
├── 异常：铜钱不足 → "铜钱不足"
├── 异常：兵力不足 → "兵力不足"
├── 边界：资源恰好等于费用 → 允许
├── 边界：资源差1 → 拒绝
├── 边界：不传 resources → 跳过资源检查
└── 组合：多个异常原因同时返回
```

### 1.4 升级费用与产出 API

```
getUpgradeCost(type)
├── 正常：返回当前等级的升级费用
├── 边界：level=0 → 返回 null
├── 边界：level=maxLevel → 返回 null
├── 边界：level=1 → 返回 Lv1→2 费用
└── 精确：费用与 levelTable 精确匹配

getProduction(type, level?)
├── 正常：返回当前等级产出
├── 边界：level=0 → 返回 0
├── 边界：level 为负数 → 返回 0
├── 边界：指定 level 参数 → 返回对应等级产出
└── 精确：与 BUILDING_DEFS levelTable 精确匹配

getCastleBonusPercent()
├── 正常：返回主城产出值（百分比）
├── 边界：Lv1 → 0%
└── 精确：Lv2 → 2%, Lv10 → 18%

getCastleBonusMultiplier()
├── 正常：返回 1 + percent/100
├── 边界：Lv1 → 1.0
└── 精确：Lv2 → 1.02
```

### 1.5 升级执行 API

```
startUpgrade(type, resources)
├── 正常：开始升级，返回费用
│   ├── 状态变为 upgrading
│   ├── upgradeStartTime/endTime 正确设置
│   └── 加入升级队列
├── 异常：checkUpgrade 不通过 → 抛错
├── 异常：重复升级同一建筑 → 抛错"正在升级中"
├── 异常：升级锁定建筑 → 抛错"尚未解锁"
├── 异常：资源不足 → 抛错
├── 边界：恰好满足资源 → 成功
├── 边界：队列恰好有空位 → 成功
└── 验证：返回的 cost 是深拷贝

cancelUpgrade(type)
├── 正常：取消升级，返回 80% 退款
│   ├── 状态恢复为 idle
│   ├── upgradeStartTime/endTime 清空
│   └── 从队列中移除
├── 异常：非升级中建筑 → 返回 null
├── 精确：退款 = Math.round(cost * 0.8)
├── 边界：cost.troops=0 时退款 troops=0
└── 边界：取消后队列有空间，可开始新升级
```

### 1.6 升级计时 API

```
tick()
├── 正常：到期升级完成，返回完成列表
│   ├── level += 1
│   ├── status → idle
│   └── 从队列移除
├── 正常：未到期不处理
├── 边界：恰好到期（now = endTime）
├── 边界：空队列 → 返回空数组
├── 跨系统：主城升级后触发 checkAndUnlockBuildings
└── 多个：多个建筑同时到期

getUpgradeRemainingTime(type)
├── 正常：返回剩余秒数
├── 边界：非升级中 → 返回 0
├── 边界：恰好到期 → 返回 0
└── 精确：值 = (endTime - now) / 1000

getUpgradeProgress(type)
├── 正常：返回 0~1 进度
├── 边界：非升级中 → 返回 0
├── 边界：total=0 → 返回 1
├── 边界：恰好开始 → 接近 0
└── 边界：恰好完成 → 1
```

### 1.7 队列管理 API

```
getUpgradeQueue()
├── 正常：返回队列副本
└── 隔离：修改返回值不影响内部

getMaxQueueSlots()
├── 正常：根据主城等级返回槽位数
├── 边界：Lv1~5 → 1 槽
├── 边界：Lv6~10 → 2 槽
├── 边界：Lv11~20 → 3 槽
├── 边界：Lv21~30 → 4 槽
└── 边界：主城 Lv0 → 默认 1 槽

isQueueFull()
├── 正常：队列长度 >= maxSlots → true
├── 边界：恰好等于 → true
└── 边界：恰好少1 → false
```

### 1.8 产出关联 API

```
calculateTotalProduction()
├── 正常：汇总所有产出建筑（排除 castle）
├── 边界：所有建筑 Lv0 → 空对象
├── 精确：各建筑产出值与 getProduction 一致
└── 跨系统：产出受主城加成影响（由调用方应用）

getProductionBuildingLevels()
├── 正常：返回非主城建筑等级映射
└── 完整：包含 7 种非主城建筑
```

### 1.9 特殊属性 API

```
getWallDefense()
├── 正常：返回城墙 specialValue
├── 边界：Lv0 → 返回 0
└── 精确：与 levelTable specialValue 匹配

getWallDefenseBonus()
├── 正常：返回城墙 production 值
└── 精确：与 getProduction('wall') 一致

getClinicRecoveryRate()
├── 正常：返回医馆 production 值
└── 精确：与 getProduction('clinic') 一致
```

### 1.10 序列化 API

```
serialize()
├── 正常：返回完整存档数据
├── 隔离：返回深拷贝
└── 版本：包含正确版本号

deserialize(data)
├── 正常：恢复建筑状态
├── 异常：版本不匹配 → 警告但不崩溃
├── 边界：部分建筑数据 → 保留其余默认值
├── 跨系统：离线期间完成的升级自动处理
│   ├── 已到期 → 直接完成升级
│   └── 未到期 → 重建队列
└── 跨系统：反序列化后触发 checkAndUnlockBuildings

reset()
├── 正常：恢复初始状态
├── 验证：建筑状态全部回到初始
└── 验证：队列清空
```

### 1.11 推荐 API

```
recommendUpgradePath(context)
├── 正常：newbie 阶段推荐
├── 正常：development 阶段推荐
├── 正常：late 阶段推荐
├── 边界：所有建筑满级 → 空列表
├── 边界：建筑正在升级 → 跳过
└── 边界：建筑锁定 → 跳过

getUpgradeRouteRecommendation(resources?)
├── 正常：按优先级排序
├── 资源影响：资源不足降低优先级
└── 边界：所有建筑满级 → 空列表

getUpgradeRecommendation(resources?)
├── 正常：简化版推荐
└── 委托：委托给 getUpgradeRouteRecommendation
```

### 1.12 批量升级 API

```
batchUpgrade(types, resources)
├── 正常：全部成功
├── 正常：部分成功部分失败
├── 正常：全部失败
├── 边界：空列表 → 全空结果
├── 边界：资源恰好够第一个 → 第一个成功其余失败
├── 异常：资源不足的建筑跳过
└── 精确：totalCost 为所有成功升级费用之和
```

### 1.13 测试基础设施 API

```
forceCompleteUpgrades()
├── 正常：完成所有升级中建筑
├── 跨系统：主城升级后触发解锁
├── 验证：队列清空
└── 边界：无升级中建筑 → 空列表
```

---

## 2. 测试用例清单

### 2.1 状态读取类（TR-READ-001 ~ TR-READ-015）

| 用例ID | API | 场景 | 预期结果 | 优先级 |
|--------|-----|------|----------|--------|
| TR-READ-001 | `getAllBuildings` | 新实例获取全部建筑 | 返回8种建筑，castle/farmland 状态 idle+Lv1，其余 locked+Lv0 | P0 |
| TR-READ-002 | `getAllBuildings` | 深拷贝隔离 | 修改返回值不影响系统内部状态 | P1 |
| TR-READ-003 | `getBuilding` | 获取单个建筑 | 返回正确的 type/level/status | P0 |
| TR-READ-004 | `getBuilding` | 浅拷贝隔离 | 修改返回值不影响系统内部 | P1 |
| TR-READ-005 | `getLevel` | 各建筑类型 | 返回对应等级 | P0 |
| TR-READ-006 | `getCastleLevel` | 初始状态 | 返回 1 | P0 |
| TR-READ-007 | `getBuildingLevels` | 完整性 | 包含所有 BUILDING_TYPES 键 | P1 |
| TR-READ-008 | `getBuildingDef` | 各建筑类型 | 返回正确的 BuildingDef | P1 |
| TR-READ-009 | `getAppearanceStage` | Lv1 → humble | 返回 'humble' | P1 |
| TR-READ-010 | `getAppearanceStage` | Lv5 → humble, Lv6 → orderly | 阈值边界 | P1 |
| TR-READ-011 | `getAppearanceStage` | Lv12 → orderly, Lv13 → refined | 阈值边界 | P1 |
| TR-READ-012 | `getAppearanceStage` | Lv20 → refined, Lv21 → glorious | 阈值边界 | P1 |
| TR-READ-013 | `isUnlocked` | castle(初始解锁) | 返回 true | P0 |
| TR-READ-014 | `isUnlocked` | wall(初始锁定) | 返回 false | P0 |
| TR-READ-015 | `isUnlocked` | 解锁后查询 | 返回 true | P1 |

### 2.2 解锁检查类（TR-UNLOCK-001 ~ TR-UNLOCK-008）

| 用例ID | API | 场景 | 预期结果 | 优先级 |
|--------|-----|------|----------|--------|
| TR-UNLOCK-001 | `checkUnlock` | castle(要求Lv0) | 始终 true | P0 |
| TR-UNLOCK-002 | `checkUnlock` | market(要求Lv2)，主城Lv2 | 恰好满足，true | P0 |
| TR-UNLOCK-003 | `checkUnlock` | market(要求Lv2)，主城Lv1 | 差1，false | P0 |
| TR-UNLOCK-004 | `checkUnlock` | wall(要求Lv5)，主城Lv6 | 超出要求，true | P1 |
| TR-UNLOCK-005 | `checkAndUnlockBuildings` | 主城 Lv1→2 | 解锁 market + barracks | P0 |
| TR-UNLOCK-006 | `checkAndUnlockBuildings` | 主城 Lv2→3 | 解锁 smithy + academy | P0 |
| TR-UNLOCK-007 | `checkAndUnlockBuildings` | 主城 Lv3→4 | 解锁 clinic | P0 |
| TR-UNLOCK-008 | `checkAndUnlockBuildings` | 无新建筑可解锁 | 返回空数组 | P2 |

### 2.3 升级前置条件检查类（TR-CHECK-001 ~ TR-CHECK-020）

| 用例ID | API | 场景 | 预期结果 | 优先级 |
|--------|-----|------|----------|--------|
| TR-CHECK-001 | `checkUpgrade` | 全部满足 | canUpgrade=true, reasons=[] | P0 |
| TR-CHECK-002 | `checkUpgrade` | 建筑锁定 | canUpgrade=false, "建筑尚未解锁" | P0 |
| TR-CHECK-003 | `checkUpgrade` | 建筑升级中 | canUpgrade=false, "正在升级中" | P0 |
| TR-CHECK-004 | `checkUpgrade` | 已达等级上限 | canUpgrade=false, "已达等级上限" | P0 |
| TR-CHECK-005 | `checkUpgrade` | 非主城 level=主城level | canUpgrade=false, "不能超过主城等级" | P0 |
| TR-CHECK-006 | `checkUpgrade` | 非主城 level=主城level-1 | canUpgrade=true | P0 |
| TR-CHECK-007 | `checkUpgrade` | 主城Lv4→5无前置 | canUpgrade=false, "需要Lv4" | P0 |
| TR-CHECK-008 | `checkUpgrade` | 主城Lv4→5有前置 | canUpgrade=true | P0 |
| TR-CHECK-009 | `checkUpgrade` | 主城Lv9→10无前置 | canUpgrade=false, "需要Lv9" | P0 |
| TR-CHECK-010 | `checkUpgrade` | 主城Lv9→10有前置 | canUpgrade=true | P0 |
| TR-CHECK-011 | `checkUpgrade` | 队列已满 | canUpgrade=false, "队列已满" | P0 |
| TR-CHECK-012 | `checkUpgrade` | 粮草不足 | canUpgrade=false, "粮草不足" | P0 |
| TR-CHECK-013 | `checkUpgrade` | 铜钱不足 | canUpgrade=false, "铜钱不足" | P0 |
| TR-CHECK-014 | `checkUpgrade` | 兵力不足(cost.troops>0) | canUpgrade=false, "兵力不足" | P0 |
| TR-CHECK-015 | `checkUpgrade` | 资源恰好等于费用 | canUpgrade=true | P0 |
| TR-CHECK-016 | `checkUpgrade` | 资源差1(粮草) | canUpgrade=false | P0 |
| TR-CHECK-017 | `checkUpgrade` | 不传 resources | 跳过资源检查 | P1 |
| TR-CHECK-018 | `checkUpgrade` | 多条件同时不满足 | reasons 包含多条 | P1 |
| TR-CHECK-019 | `checkUpgrade` | 非主城 level > 主城level+1 | 拒绝 | P2 |
| TR-CHECK-020 | `checkUpgrade` | 兵力费用=0时不检查兵力 | 即使 troops=0 也通过 | P1 |

### 2.4 升级费用与产出类（TR-COST-001 ~ TR-COST-012）

| 用例ID | API | 场景 | 预期结果 | 优先级 |
|--------|-----|------|----------|--------|
| TR-COST-001 | `getUpgradeCost` | 正常等级 | 返回正确的 UpgradeCost | P0 |
| TR-COST-002 | `getUpgradeCost` | level=0(锁定) | 返回 null | P0 |
| TR-COST-003 | `getUpgradeCost` | level=maxLevel | 返回 null | P0 |
| TR-COST-004 | `getUpgradeCost` | level=1 | 返回 Lv1→2 费用 | P0 |
| TR-COST-005 | `getUpgradeCost` | 返回深拷贝 | 修改不影响 levelTable | P1 |
| TR-COST-006 | `getProduction` | 正常等级 | 与 levelTable 精确匹配 | P0 |
| TR-COST-007 | `getProduction` | level=0 | 返回 0 | P0 |
| TR-COST-008 | `getProduction` | 负数等级 | 返回 0 | P1 |
| TR-COST-009 | `getProduction` | 指定 level 参数 | 返回对应等级产出 | P0 |
| TR-COST-010 | `getCastleBonusPercent` | Lv1 → 0% | 精确值 | P1 |
| TR-COST-011 | `getCastleBonusMultiplier` | Lv1 → 1.0 | 精确值 | P1 |
| TR-COST-012 | `getCastleBonusMultiplier` | Lv2 → 1.02 | 精确值 | P1 |

### 2.5 升级执行类（TR-EXEC-001 ~ TR-EXEC-015）

| 用例ID | API | 场景 | 预期结果 | 优先级 |
|--------|-----|------|----------|--------|
| TR-EXEC-001 | `startUpgrade` | 正常升级 | 返回费用，状态变 upgrading | P0 |
| TR-EXEC-002 | `startUpgrade` | upgradeStartTime/endTime | 正确设置时间戳 | P0 |
| TR-EXEC-003 | `startUpgrade` | 加入队列 | getUpgradeQueue 长度+1 | P0 |
| TR-EXEC-004 | `startUpgrade` | 条件不满足 | 抛错，包含原因 | P0 |
| TR-EXEC-005 | `startUpgrade` | 重复升级同一建筑 | 抛错"正在升级中" | P0 |
| TR-EXEC-006 | `startUpgrade` | 升级锁定建筑 | 抛错"尚未解锁" | P0 |
| TR-EXEC-007 | `startUpgrade` | 返回深拷贝 | 修改不影响内部 | P1 |
| TR-EXEC-008 | `startUpgrade` | 恰好满足资源 | 成功 | P0 |
| TR-EXEC-009 | `cancelUpgrade` | 正常取消 | 返回 80% 退款 | P0 |
| TR-EXEC-010 | `cancelUpgrade` | 状态恢复 | status→idle, 时间清空 | P0 |
| TR-EXEC-011 | `cancelUpgrade` | 队列移除 | getUpgradeQueue 不含该建筑 | P0 |
| TR-EXEC-012 | `cancelUpgrade` | 非升级中建筑 | 返回 null | P0 |
| TR-EXEC-013 | `cancelUpgrade` | 退款精确值 | Math.round(cost * 0.8) | P0 |
| TR-EXEC-014 | `cancelUpgrade` | troops=0时退款 | troops 退款 = 0 | P1 |
| TR-EXEC-015 | `cancelUpgrade` | 取消后可重新升级 | 队列有空位，可再次 startUpgrade | P1 |

### 2.6 升级计时类（TR-TICK-001 ~ TR-TICK-010）

| 用例ID | API | 场景 | 预期结果 | 优先级 |
|--------|-----|------|----------|--------|
| TR-TICK-001 | `tick` | 到期完成 | level+1, status→idle, 返回完成列表 | P0 |
| TR-TICK-002 | `tick` | 未到期 | 不处理，返回空数组 | P0 |
| TR-TICK-003 | `tick` | 恰好到期(now=endTime) | 完成 | P0 |
| TR-TICK-004 | `tick` | 空队列 | 返回空数组 | P1 |
| TR-TICK-005 | `tick` | 主城升级触发解锁 | checkAndUnlockBuildings 被调用 | P0 |
| TR-TICK-006 | `tick` | 多个建筑同时到期 | 全部完成，列表完整 | P1 |
| TR-TICK-007 | `getUpgradeRemainingTime` | 升级中 | 正确剩余秒数 | P0 |
| TR-TICK-008 | `getUpgradeRemainingTime` | 非升级中 | 返回 0 | P1 |
| TR-TICK-009 | `getUpgradeProgress` | 升级中 | 0~1 之间 | P0 |
| TR-TICK-010 | `getUpgradeProgress` | 非升级中 | 返回 0 | P1 |

### 2.7 队列管理类（TR-QUEUE-001 ~ TR-QUEUE-008）

| 用例ID | API | 场景 | 预期结果 | 优先级 |
|--------|-----|------|----------|--------|
| TR-QUEUE-001 | `getUpgradeQueue` | 正常 | 返回队列副本 | P0 |
| TR-QUEUE-002 | `getUpgradeQueue` | 隔离 | 修改返回值不影响内部 | P1 |
| TR-QUEUE-003 | `getMaxQueueSlots` | 主城 Lv1~5 | 返回 1 | P0 |
| TR-QUEUE-004 | `getMaxQueueSlots` | 主城 Lv6~10 | 返回 2 | P0 |
| TR-QUEUE-005 | `getMaxQueueSlots` | 主城 Lv11~20 | 返回 3 | P0 |
| TR-QUEUE-006 | `getMaxQueueSlots` | 主城 Lv21~30 | 返回 4 | P0 |
| TR-QUEUE-007 | `isQueueFull` | 恰好满 | true | P0 |
| TR-QUEUE-008 | `isQueueFull` | 恰好少1 | false | P0 |

### 2.8 产出关联类（TR-PROD-001 ~ TR-PROD-004）

| 用例ID | API | 场景 | 预期结果 | 优先级 |
|--------|-----|------|----------|--------|
| TR-PROD-001 | `calculateTotalProduction` | 正常 | 汇总所有产出建筑 | P0 |
| TR-PROD-002 | `calculateTotalProduction` | 所有建筑Lv0 | 空对象或全0 | P1 |
| TR-PROD-003 | `calculateTotalProduction` | 排除主城 | 不含 castle 产出 | P0 |
| TR-PROD-004 | `getProductionBuildingLevels` | 完整性 | 包含7种非主城建筑 | P1 |

### 2.9 特殊属性类（TR-SPEC-001 ~ TR-SPEC-005）

| 用例ID | API | 场景 | 预期结果 | 优先级 |
|--------|-----|------|----------|--------|
| TR-SPEC-001 | `getWallDefense` | 正常等级 | 与 specialValue 精确匹配 | P0 |
| TR-SPEC-002 | `getWallDefense` | Lv0 | 返回 0 | P0 |
| TR-SPEC-003 | `getWallDefenseBonus` | 正常 | 与 getProduction('wall') 一致 | P1 |
| TR-SPEC-004 | `getClinicRecoveryRate` | 正常 | 与 getProduction('clinic') 一致 | P1 |
| TR-SPEC-005 | `getWallDefense` | Lv1 | specialValue=300 | P1 |

### 2.10 序列化类（TR-SER-001 ~ TR-SER-008）

| 用例ID | API | 场景 | 预期结果 | 优先级 |
|--------|-----|------|----------|--------|
| TR-SER-001 | `serialize` | 正常 | 包含正确版本号和全部建筑 | P0 |
| TR-SER-002 | `serialize` | 深拷贝 | 修改不影响内部 | P1 |
| TR-SER-003 | `deserialize` | 正常恢复 | 建筑状态正确恢复 | P0 |
| TR-SER-004 | `deserialize` | 版本不匹配 | 不崩溃，输出警告 | P0 |
| TR-SER-005 | `deserialize` | 部分数据 | 缺失建筑保持默认 | P1 |
| TR-SER-006 | `deserialize` | 离线完成升级 | 已到期自动完成 | P0 |
| TR-SER-007 | `deserialize` | 离线未完成 | 重建队列 | P0 |
| TR-SER-008 | `reset` | 重置后 | 全部回到初始状态，队列空 | P0 |

### 2.11 推荐类（TR-REC-001 ~ TR-REC-008）

| 用例ID | API | 场景 | 预期结果 | 优先级 |
|--------|-----|------|----------|--------|
| TR-REC-001 | `recommendUpgradePath` | newbie 阶段 | castle 排第一 | P1 |
| TR-REC-002 | `recommendUpgradePath` | development 阶段 | smithy/academy 靠前 | P1 |
| TR-REC-003 | `recommendUpgradePath` | late 阶段 | wall/clinic 靠前 | P1 |
| TR-REC-004 | `recommendUpgradePath` | 全满级 | 空列表 | P2 |
| TR-REC-005 | `recommendUpgradePath` | 建筑锁定 | 跳过锁定建筑 | P1 |
| TR-REC-006 | `getUpgradeRouteRecommendation` | 资源不足 | 优先级降低20 | P1 |
| TR-REC-007 | `getUpgradeRouteRecommendation` | 主城优先 | castle priority=100 | P1 |
| TR-REC-008 | `getUpgradeRecommendation` | 委托验证 | 结果包含 reason 和 estimatedBenefit | P2 |

### 2.12 批量升级类（TR-BATCH-001 ~ TR-BATCH-006）

| 用例ID | API | 场景 | 预期结果 | 优先级 |
|--------|-----|------|----------|--------|
| TR-BATCH-001 | `batchUpgrade` | 全部成功 | succeeded=全部, failed=[], totalCost 正确 | P0 |
| TR-BATCH-002 | `batchUpgrade` | 部分成功 | 成功的扣资源，失败的记录原因 | P0 |
| TR-BATCH-003 | `batchUpgrade` | 全部失败 | succeeded=[], failed=全部 | P0 |
| TR-BATCH-004 | `batchUpgrade` | 空列表 | 全空结果 | P1 |
| TR-BATCH-005 | `batchUpgrade` | 资源恰好够第一个 | 第一个成功，其余失败 | P0 |
| TR-BATCH-006 | `batchUpgrade` | totalCost 累加 | 为所有成功升级费用之和 | P1 |

### 2.13 测试基础设施类（TR-FORCE-001 ~ TR-FORCE-003）

| 用例ID | API | 场景 | 预期结果 | 优先级 |
|--------|-----|------|----------|--------|
| TR-FORCE-001 | `forceCompleteUpgrades` | 有升级中建筑 | 全部完成，返回列表 | P0 |
| TR-FORCE-002 | `forceCompleteUpgrades` | 主城升级 | 触发 checkAndUnlockBuildings | P0 |
| TR-FORCE-003 | `forceCompleteUpgrades` | 无升级中 | 返回空数组 | P2 |

### 2.14 跨系统交互类（TR-CROSS-001 ~ TR-CROSS-006）

| 用例ID | 涉及API | 场景 | 预期结果 | 优先级 |
|--------|---------|------|----------|--------|
| TR-CROSS-001 | tick + checkAndUnlockBuildings | 主城升级完成触发解锁 | 新建筑自动解锁 | P0 |
| TR-CROSS-002 | deserialize + tick | 离线期间升级完成 | 自动完成升级+解锁 | P0 |
| TR-CROSS-003 | calculateTotalProduction + getProduction | 产出汇总 | 各建筑产出值一致 | P0 |
| TR-CROSS-004 | startUpgrade + cancelUpgrade + startUpgrade | 升级→取消→重新升级 | 资源退款后可重新使用队列 | P0 |
| TR-CROSS-005 | forceCompleteUpgrades + checkAndUnlockBuildings | 连锁升级解锁 | 主城升级后新建筑解锁 | P0 |
| TR-CROSS-006 | batchUpgrade + checkUpgrade | 批量升级中资源递减 | 后续建筑使用扣减后的资源检查 | P0 |

---

## 3. 统计

| 分类 | 用例数 | P0 | P1 | P2 | P3 |
|------|--------|----|----|----|----|
| 状态读取 | 15 | 4 | 10 | 1 | 0 |
| 解锁检查 | 8 | 5 | 0 | 3 | 0 |
| 升级前置条件 | 20 | 13 | 5 | 2 | 0 |
| 升级费用与产出 | 12 | 5 | 7 | 0 | 0 |
| 升级执行 | 15 | 9 | 6 | 0 | 0 |
| 升级计时 | 10 | 5 | 5 | 0 | 0 |
| 队列管理 | 8 | 6 | 2 | 0 | 0 |
| 产出关联 | 4 | 2 | 2 | 0 | 0 |
| 特殊属性 | 5 | 2 | 3 | 0 | 0 |
| 序列化 | 8 | 5 | 3 | 0 | 0 |
| 推荐 | 8 | 0 | 6 | 2 | 0 |
| 批量升级 | 6 | 4 | 2 | 0 | 0 |
| 测试基础设施 | 3 | 2 | 0 | 1 | 0 |
| 跨系统交互 | 6 | 6 | 0 | 0 | 0 |
| **合计** | **128** | **68** | **51** | **9** | **0** |

---

## 4. 对抗式测试重点（Adversarial Focus）

### 4.1 资源边界攻击

| 攻击向量 | 测试方法 | 预期防护 |
|----------|----------|----------|
| 资源恰好等于费用 | 传入 grain=cost.grain, gold=cost.gold | checkUpgrade 通过 |
| 资源差1（每种资源） | 传入 grain=cost.grain-1 | checkUpgrade 拒绝 |
| 负数资源 | 传入 grain=-999 | checkUpgrade 拒绝 |
| 零资源 | 全部为 0 | checkUpgrade 拒绝 |
| 资源溢出 | 传入 Number.MAX_SAFE_INTEGER | 不崩溃 |

### 4.2 等级边界攻击

| 攻击向量 | 测试方法 | 预期防护 |
|----------|----------|----------|
| 等级=0 | getUpgradeCost / getProduction | 返回 null / 0 |
| 等级=maxLevel | checkUpgrade / getUpgradeCost | 拒绝 / null |
| 等级=maxLevel-1 | checkUpgrade | 允许（最后一次升级） |
| 负数等级 | getProduction(type, -1) | 返回 0 |
| 等级=主城等级 | 非主城建筑 | checkUpgrade 拒绝 |
| 等级=主城等级-1 | 非主城建筑 | checkUpgrade 允许 |

### 4.3 状态机攻击

| 攻击向量 | 测试方法 | 预期防护 |
|----------|----------|----------|
| locked → startUpgrade | 直接升级锁定建筑 | 抛错 |
| upgrading → startUpgrade | 重复升级 | 抛错 |
| idle → cancelUpgrade | 取消非升级中建筑 | 返回 null |
| upgrading → cancelUpgrade → startUpgrade | 取消后重新升级 | 成功 |
| locked → checkAndUnlock → idle | 主城升级触发解锁 | 状态正确转换 |

### 4.4 队列攻击

| 攻击向量 | 测试方法 | 预期防护 |
|----------|----------|----------|
| 队列满 → startUpgrade | 超出队列限制 | checkUpgrade 拒绝 |
| 队列满 → cancel → startUpgrade | 取消释放槽位 | 成功 |
| 多个建筑同时到期 | tick 处理 | 全部完成 |
| 空队列 tick | 无升级中建筑 | 返回空数组 |

### 4.5 序列化攻击

| 攻击向量 | 测试方法 | 预期防护 |
|----------|----------|----------|
| 版本号不匹配 | version=999 | 不崩溃，输出警告 |
| 部分建筑数据 | 只有 castle | 其余保持默认 |
| 空建筑数据 | buildings={} | 全部保持默认 |
| 离线完成升级 | endTime < now | 自动完成 |
| 离线未完成升级 | endTime > now | 重建队列 |
| 篡改 level 超过 maxLevel | level=999 | 不崩溃（但逻辑可能异常） |

### 4.6 数值精确性攻击

| 攻击向量 | 测试方法 | 预期防护 |
|----------|----------|----------|
| 退款比例精确值 | cancelUpgrade | Math.round(cost * 0.8) |
| 主城加成乘数 | getCastleBonusMultiplier | 1 + percent/100 |
| 产出值查表 | getProduction | 与 levelTable 精确匹配 |
| 费用查表 | getUpgradeCost | 与 levelTable 精确匹配 |
| 城防值查表 | getWallDefense | 与 specialValue 精确匹配 |
