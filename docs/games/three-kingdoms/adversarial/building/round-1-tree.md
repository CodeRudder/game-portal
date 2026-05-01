# Building 模块 — Round 1 对抗式测试流程树

> **Builder 视角** | 模块: `engine/building/`  
> 生成时间: 2025-05-02 | 基于源码版本: v1.0

---

## 模块概览

### 核心文件
| 文件 | 职责 | 行数 |
|------|------|------|
| `BuildingSystem.ts` | 聚合根：状态管理、升级逻辑、队列、序列化 | ~450 |
| `building-config.ts` | 零逻辑数值配置（8种建筑×等级表） | ~850 |
| `building.types.ts` | 类型定义 + re-export | ~180 |
| `BuildingBatchOps.ts` | 批量升级操作 | ~100 |
| `BuildingRecommender.ts` | 升级推荐纯函数 | ~200 |
| `BuildingStateHelpers.ts` | 初始状态创建、外观阶段 | ~40 |
| `engine-building-ops.ts` | 引擎编排层升级辅助（跨域） | ~80 |

### 建筑 API 清单（共 28 个公开方法）
| # | API | 分类 | 风险等级 |
|---|-----|------|----------|
| 1 | `getAllBuildings()` | 读取 | 低 |
| 2 | `getBuilding(type)` | 读取 | 低 |
| 3 | `getLevel(type)` | 读取 | 低 |
| 4 | `getCastleLevel()` | 读取 | 低 |
| 5 | `getBuildingLevels()` | 读取 | 低 |
| 6 | `getBuildingDef(type)` | 读取 | 低 |
| 7 | `getAppearanceStage(type)` | 读取 | 低 |
| 8 | `isUnlocked(type)` | 读取 | 低 |
| 9 | `checkUnlock(type)` | 解锁 | 中 |
| 10 | `checkAndUnlockBuildings()` | 解锁 | 高 |
| 11 | `checkUpgrade(type, resources?)` | 升级检查 | **极高** |
| 12 | `getUpgradeCost(type)` | 费用 | **高** |
| 13 | `getProduction(type, level?)` | 产出 | 中 |
| 14 | `getCastleBonusPercent()` | 产出 | 中 |
| 15 | `getCastleBonusMultiplier()` | 产出 | 中 |
| 16 | `startUpgrade(type, resources)` | 升级执行 | **极高** |
| 17 | `cancelUpgrade(type)` | 取消升级 | **高** |
| 18 | `tick()` | 计时 | **极高** |
| 19 | `getUpgradeRemainingTime(type)` | 计时 | 低 |
| 20 | `getUpgradeProgress(type)` | 计时 | 低 |
| 21 | `getUpgradeQueue()` | 队列 | 低 |
| 22 | `getMaxQueueSlots()` | 队列 | 中 |
| 23 | `isQueueFull()` | 队列 | 中 |
| 24 | `calculateTotalProduction()` | 产出汇总 | 中 |
| 25 | `serialize()` | 序列化 | **高** |
| 26 | `deserialize(data)` | 反序列化 | **极高** |
| 27 | `reset()` | 重置 | 中 |
| 28 | `batchUpgrade(types, resources)` | 批量升级 | **极高** |

---

## 测试流程树（5维度 × 分支枚举）

### F1: Normal Flow（正常流程）

```
F1-Normal
├── F1-01 建筑初始状态
│   ├── castle/farmland 初始解锁 Lv1 idle
│   ├── market/barracks 需主城Lv2 → locked
│   ├── smithy/academy 需主城Lv3 → locked
│   ├── clinic 需主城Lv4 → locked
│   └── wall 需主城Lv5 → locked
│
├── F1-02 建筑解锁流程
│   ├── 主城升级到Lv2 → market/barracks 解锁为 idle Lv1
│   ├── 主城升级到Lv3 → smithy/academy 解锁
│   ├── 主城升级到Lv4 → clinic 解锁
│   └── 主城升级到Lv5 → wall 解锁
│
├── F1-03 升级全流程（核心路径）
│   ├── checkUpgrade → canUpgrade=true
│   ├── startUpgrade → 扣资源 + 状态变upgrading
│   ├── tick() 时间到 → level+1, status=idle
│   └── 验证：level正确、队列清空、产出更新
│
├── F1-04 取消升级流程
│   ├── startUpgrade → upgrading
│   ├── cancelUpgrade → idle + 80%退款
│   └── 验证：状态恢复、队列移除、退款精确
│
├── F1-05 批量升级
│   ├── 传入多个建筑类型
│   ├── 资源递减检查
│   └── 返回 succeeded/failed/totalCost
│
├── F1-06 序列化/反序列化
│   ├── serialize → 保存完整状态
│   ├── deserialize → 恢复状态
│   └── 离线完成升级自动处理
│
└── F1-07 推荐系统
    ├── recommendUpgradePath(newbie/development/late)
    ├── getUpgradeRouteRecommendation(resources?)
    └── getUpgradeRecommendation(resources?)
```

### F2: Boundary（边界条件）

```
F2-Boundary
├── F2-01 等级边界
│   ├── level=0 → getUpgradeCost=null, getProduction=0
│   ├── level=1 → 首次升级费用查表
│   ├── level=maxLevel-1 → 最后一次可升级
│   ├── level=maxLevel → getUpgradeCost=null, checkUpgrade拒绝
│   ├── level=maxLevel+1 → 超限数据（篡改存档）
│   └── level=负数 → getProduction=0
│
├── F2-02 资源精确边界
│   ├── 资源恰好=费用 → 允许
│   ├── 资源=费用-1 → 拒绝
│   ├── 资源=0 → 拒绝
│   ├── 资源=MAX_SAFE_INTEGER → 不崩溃
│   ├── 资源=负数 → 拒绝
│   ├── troops=0 且 cost.troops=0 → 允许（不检查兵力）
│   └── troops=负数 且 cost.troops>0 → 拒绝
│
├── F2-03 队列容量边界
│   ├── 主城Lv1~5 → 1槽
│   ├── 主城Lv6~10 → 2槽
│   ├── 主城Lv11~20 → 3槽
│   ├── 主城Lv21~30 → 4槽
│   ├── 队列恰好满 → 拒绝新升级
│   └── 队列满→取消一个→立即可升级
│
├── F2-04 主城等级约束边界
│   ├── 子建筑 level=castle.level → 允许升级
│   ├── 子建筑 level=castle.level+1 → 拒绝（超过主城）
│   ├── 子建筑 level=castle.level-1 → 允许
│   └── castle Lv4→5 前置：无Lv4子建筑→拒绝 / 有→允许
│   └── castle Lv9→10 前置：无Lv9子建筑→拒绝 / 有→允许
│
├── F2-05 时间边界
│   ├── 升级时间=0 → 立即完成
│   ├── 升级时间=极大值 → 不溢出
│   ├── tick时恰好=endTime → 完成
│   ├── tick时=endTime+1ms → 完成
│   └── tick时=endTime-1ms → 未完成
│
└── F2-06 产出计算边界
    ├── 主城Lv1 → 加成0%, multiplier=1.0
    ├── 主城Lv30 → 加成58%, multiplier=1.58
    ├── 城墙Lv0 → defense=0
    ├── 城墙Lv20 → defense=15000
    └── calculateTotalProduction 排除主城
```

### F3: Error（错误路径/异常）

```
F3-Error
├── F3-01 状态机非法转换
│   ├── locked → startUpgrade → 抛错
│   ├── locked → cancelUpgrade → 返回null
│   ├── upgrading → startUpgrade(同一建筑) → 抛错"正在升级中"
│   ├── idle → cancelUpgrade → 返回null
│   └── locked → checkUpgrade → 拒绝"尚未解锁"
│
├── F3-02 资源异常
│   ├── NaN资源 → 拒绝（FIX-401防护）
│   ├── Infinity资源 → 拒绝
│   ├── -Infinity资源 → 拒绝
│   ├── 部分字段NaN → 拒绝
│   └── undefined资源字段 → 运行时错误？
│
├── F3-03 队列异常
│   ├── 队列满时startUpgrade → checkUpgrade拒绝
│   ├── 队列满时直接startUpgrade(绕过check) → 抛错
│   └── 取消不存在的队列项 → cancelUpgrade返回null
│
├── F3-04 序列化异常
│   ├── null数据 → 使用默认状态（FIX-403）
│   ├── undefined数据 → 使用默认状态
│   ├── 空对象{} → 使用默认状态
│   ├── version不匹配 → 警告但不崩溃
│   ├── 部分建筑缺失 → 保留默认值
│   ├── 篡改level>maxLevel → 不崩溃但getUpgradeCost=null
│   ├── 篡改status为非法值 → 行为未定义
│   └── 篡改upgradeEndTime为过去时间 → 自动完成
│
├── F3-05 批量升级异常
│   ├── 空列表 → 返回空结果
│   ├── 含locked建筑 → failed
│   ├── 含已满级建筑 → failed
│   ├── 资源不足部分建筑 → 部分成功部分失败
│   ├── startUpgrade抛错 → 记录失败继续后续
│   └── 重复建筑类型 → 第二次失败(upgrading)
│
└── F3-06 推荐系统异常
    ├── 所有建筑满级 → 返回空列表
    ├── 所有建筑locked → 返回空列表
    └── 无效context → 使用newbieOrder
```

### F4: Cross（跨系统交互）

```
F4-Cross
├── F4-01 建筑↔资源系统
│   ├── startUpgrade扣资源 → ResourceSystem.consumeBatch
│   ├── cancelUpgrade退资源 → ResourceSystem.addResource
│   ├── 批量升级资源递减 → 资源一致性
│   └── engine-building-ops 事件发射: building:upgrade-start, resource:changed
│
├── F4-02 建筑↔主城等级联动
│   ├── 主城升级完成 → tick触发checkAndUnlockBuildings
│   ├── 主城升级完成 → 队列容量可能增加
│   ├── 主城降级(如果存在) → 子建筑约束变化
│   └── forceCompleteUpgrades → 主城升级触发解锁
│
├── F4-03 建筑↔产出系统
│   ├── calculateTotalProduction → 资源系统产出计算
│   ├── getCastleBonusMultiplier → 全资源加成
│   ├── getProductionBuildingLevels → 资源上限计算
│   └── 升级完成 → 产出变化传播
│
├── F4-04 建筑↔战斗系统
│   ├── getWallDefense → 城防值
│   ├── getWallDefenseBonus → 防御加成百分比
│   └── getClinicRecoveryRate → 恢复速率
│
├── F4-05 建筑↔科技系统
│   ├── BuildQueueTechLink.test.ts 存在 → 队列与科技关联
│   └── academy产出techPoint → 科技点供给
│
└── F4-06 建筑↔事件总线
    ├── building:upgrade-start 事件
    ├── resource:changed 事件
    └── init(deps) 注入依赖
```

### F5: Lifecycle（数据生命周期）

```
F5-Lifecycle
├── F5-01 创建→使用→销毁
│   ├── new BuildingSystem() → 初始状态正确
│   ├── 多次init() → 覆盖deps
│   └── reset() → 完全恢复初始状态
│
├── F5-02 升级生命周期
│   ├── idle → checkUpgrade → startUpgrade → upgrading
│   ├── upgrading → tick(时间到) → idle + level+1
│   ├── upgrading → cancelUpgrade → idle + 退款
│   └── upgrading → forceCompleteUpgrades → idle + level+1
│
├── F5-03 存档生命周期
│   ├── 游戏中状态 → serialize()
│   ├── serialize() → localStorage/服务器
│   ├── 加载 → deserialize()
│   ├── 离线期间升级完成 → 自动处理
│   ├── 离线期间升级未完成 → 重建队列
│   └── 版本迁移 → 警告但继续
│
├── F5-04 长时间运行
│   ├── 30级主城全建筑满级 → 状态一致性
│   ├── 大量序列化/反序列化循环 → 无内存泄漏
│   ├── 频繁升级/取消 → 队列一致性
│   └── tick高频调用 → 无重复完成
│
└── F5-05 批量操作生命周期
    ├── batchUpgrade → 资源递减一致性
    ├── batchUpgrade → succeeded+failed = 总数
    └── batchUpgrade → totalCost = sum(succeeded.cost)
```

---

## 分支覆盖率矩阵

| 维度 | 总分支数 | 已有测试覆盖 | 新发现分支 | 覆盖率 |
|------|----------|-------------|-----------|--------|
| F1-Normal | 25 | 22 | 3 | 88% |
| F2-Boundary | 32 | 26 | 6 | 81% |
| F3-Error | 28 | 20 | 8 | 71% |
| F4-Cross | 18 | 12 | 6 | 67% |
| F5-Lifecycle | 15 | 10 | 5 | 67% |
| **合计** | **118** | **90** | **28** | **76%** |

### 已有测试文件覆盖情况
| 测试文件 | 覆盖维度 | 测试用例数 |
|----------|---------|-----------|
| `BuildingSystem.test.ts` | F1, F2 | ~40 |
| `BuildingSystem.adversarial.v2.test.ts` | F2, F3, F4 | ~55 |
| `BuildingSystem.boundary.test.ts` | F2 | ~15 |
| `R22-building-abnormal.test.ts` | F3 | ~20 |
| `BuildingBatchOps.test.ts` | F1, F3 | ~20 |
| `BuildingRecommender.test.ts` | F1 | ~15 |
| `BuildingStateHelpers.test.ts` | F1 | ~10 |
| `BuildQueueTechLink.test.ts` | F4 | ~30 |
| `building-config.test.ts` | F2 | ~15 |

---

## 高优先级测试用例（Builder推荐新增）

### P0 - 必须覆盖
| ID | 分支 | 描述 |
|----|------|------|
| BT-P0-01 | F3-02 | `checkUpgrade` 传入 `undefined` 资源字段时的行为 |
| BT-P0-02 | F3-04 | `deserialize` 中 `status` 为非法字符串时的行为 |
| BT-P0-03 | F5-04 | `tick()` 多次调用同一已完成升级（防重复完成） |
| BT-P0-04 | F4-02 | 主城升级后队列容量增加，已有队列项不受影响 |
| BT-P0-05 | F3-05 | `batchUpgrade` 中 `startUpgrade` 抛非Error对象 |
| BT-P0-06 | F2-05 | `startUpgrade` 中 `cost.timeSeconds` 为NaN时的防护（FIX-405） |
| BT-P0-07 | F5-03 | `deserialize` 后 `tick()` 不重复完成已处理的升级 |

### P1 - 应该覆盖
| ID | 分支 | 描述 |
|----|------|------|
| BT-P1-01 | F2-06 | `getProduction` level参数超过levelTable范围的边界 |
| BT-P1-02 | F3-03 | `startUpgrade` 绕过 `checkUpgrade` 直接调用时队列满的行为 |
| BT-P1-03 | F4-03 | `calculateTotalProduction` 含未解锁建筑时的产出 |
| BT-P1-04 | F5-02 | `forceCompleteUpgrades` 后再 `tick()` 不会重复升级 |
| BT-P1-05 | F3-06 | `recommendUpgradePath` 所有建筑locked时的返回值 |
| BT-P1-06 | F2-01 | `getUpgradeCost` level超出levelTable索引时的返回值 |
| BT-P1-07 | F4-01 | `executeBuildingUpgrade` 资源扣减与startUpgrade的原子性 |
| BT-P1-08 | F5-05 | `batchUpgrade` totalCost精确等于succeeded项费用之和 |
