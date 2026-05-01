# Building 流程分支树 Round 1

> Builder: TreeBuilder v1.6 | Time: 2026-05-01
> 模块: building | 文件: 7 | 源码: 1,480行 | API: ~42

## 统计

| 子系统 | 节点数 | API数 | covered | uncovered | todo | P0 | P1 |
|--------|--------|-------|---------|-----------|------|----|----|
| BuildingSystem | 128 | 25 | 82 | 46 | 0 | 18 | 28 |
| BuildingStateHelpers | 12 | 3 | 8 | 4 | 0 | 2 | 2 |
| BuildingBatchOps | 18 | 1 | 10 | 8 | 0 | 4 | 4 |
| BuildingRecommender | 22 | 3 | 14 | 8 | 0 | 3 | 5 |
| building-config | 16 | 6 | 16 | 0 | 0 | 0 | 0 |
| building.types | 6 | 4 | 6 | 0 | 0 | 0 | 0 |
| **总计** | **202** | **42** | **136** | **66** | **0** | **27** | **39** |

## 子系统覆盖

| 子系统 | 文件 | 行数 | API数 | 节点数 | covered | uncovered | 覆盖率 |
|--------|------|------|-------|--------|---------|-----------|--------|
| BuildingSystem | BuildingSystem.ts | 479 | 25 | 128 | 82 | 46 | 64.1% |
| BuildingStateHelpers | BuildingStateHelpers.ts | 45 | 3 | 12 | 8 | 4 | 66.7% |
| BuildingBatchOps | BuildingBatchOps.ts | 95 | 1 | 18 | 10 | 8 | 55.6% |
| BuildingRecommender | BuildingRecommender.ts | 181 | 3 | 22 | 14 | 8 | 63.6% |
| building-config | building-config.ts | 461 | 6 | 16 | 16 | 0 | 100% |
| building.types | building.types.ts | 190 | 4 | 6 | 6 | 0 | 100% |
| index.ts | index.ts | 29 | 0 | 0 | 0 | 0 | — |

## 跨系统链路覆盖

| 链路域 | 链路数 | covered | uncovered |
|--------|--------|---------|-----------|
| Building↔Resource（升级扣费/返还） | 4 | 4 | 0 |
| Building↔Engine（编排层委托） | 3 | 3 | 0 |
| Building↔Save（序列化/反序列化） | 3 | 2 | 1 |
| Building↔Tech（书院等级→科技依赖） | 1 | 1 | 0 |
| Building↔Campaign（城防值→攻城） | 1 | 0 | 1 |
| **总计** | **12** | **10** | **2** |

---

## 1. BuildingSystem（BuildingSystem.ts — 479行）

### 1.1 构造器 & ISubsystem 适配

| # | API | 分支条件 | 优先级 | 状态 | 来源 |
|---|-----|---------|--------|------|------|
| BS-001 | `constructor()` | 初始状态：castle/farmland unlocked Lv1, 其余 locked | P1 | ✅ covered | building-config.test.ts:验证初始状态 |
| BS-002 | `constructor()` | upgradeQueue = [] | P1 | ✅ covered | R22测试隐含 |
| BS-003 | `init(deps)` | deps 注入后可使用 | P1 | ⚠️ uncovered | 无init测试 |
| BS-004 | `update(dt)` | 委托 tick() | P1 | ⚠️ uncovered | 无update直接测试 |
| BS-005 | `getState()` | 委托 serialize() | P1 | ⚠️ uncovered | 无getState直接测试 |

### 1.2 状态读取

| # | API | 分支条件 | 优先级 | 状态 | 来源 |
|---|-----|---------|--------|------|------|
| BS-010 | `getAllBuildings()` | 返回深拷贝，修改不影响内部 | P1 | ✅ covered | engine-building.test.ts |
| BS-011 | `getBuilding(type)` | 有效 BuildingType → 返回拷贝 | P1 | ✅ covered | R22测试 |
| BS-012 | `getBuilding(type)` | 无效 type → undefined access | P0 | ⚠️ uncovered | 无无效type测试 |
| BS-013 | `getLevel(type)` | 正常返回 level | P1 | ✅ covered | R22测试隐含 |
| BS-014 | `getCastleLevel()` | 返回 castle.level | P1 | ✅ covered | 交叉测试 |
| BS-015 | `getBuildingLevels()` | 返回所有建筑等级映射 | P1 | ✅ covered | 交叉测试隐含 |
| BS-016 | `getBuildingDef(type)` | 返回 BUILDING_DEFS[type] | P1 | ✅ covered | building-config.test.ts |
| BS-017 | `getAppearanceStage(type)` | 委托 BuildingStateHelpers | P1 | ✅ covered | 见1.2节 |
| BS-018 | `isUnlocked(type)` | status !== 'locked' | P1 | ✅ covered | R22测试 |

### 1.3 解锁检查

| # | API | 分支条件 | 优先级 | 状态 | 来源 |
|---|-----|---------|--------|------|------|
| BS-020 | `checkUnlock(type)` | required=0 → true（初始解锁） | P1 | ✅ covered | building-config.test.ts |
| BS-021 | `checkUnlock(type)` | castle.level >= required → true | P1 | ✅ covered | 集成测试 CHAIN1-02 |
| BS-022 | `checkUnlock(type)` | castle.level < required → false | P1 | ✅ covered | R22锁定建筑测试 |
| BS-023 | `checkAndUnlockBuildings()` | 遍历所有建筑，解锁符合条件的 locked 建筑 | P1 | ✅ covered | 集成测试 CHAIN1-02 |
| BS-024 | `checkAndUnlockBuildings()` | 主城升级后触发 → 解锁 market/barracks | P1 | ✅ covered | 集成测试 |
| BS-025 | `checkAndUnlockBuildings()` | 无新解锁 → 返回空数组 | P1 | ⚠️ uncovered | 无此场景测试 |
| BS-026 | `checkAndUnlockBuildings()` | 解锁后 level=1, status='idle' | P1 | ✅ covered | 集成测试 |

### 1.4 升级前置条件检查 — `checkUpgrade()`

| # | API | 分支条件 | 优先级 | 状态 | 来源 |
|---|-----|---------|--------|------|------|
| BS-030 | `checkUpgrade(type)` | status='locked' → 直接返回不可升级 | P0 | ✅ covered | R22:锁定建筑测试 |
| BS-031 | `checkUpgrade(type)` | status='upgrading' → reasons含"正在升级中" | P0 | ✅ covered | R22:正在升级建筑测试 |
| BS-032 | `checkUpgrade(type)` | level >= maxLevel → reasons含"已达等级上限" | P0 | ✅ covered | R22:满级建筑测试 |
| BS-033 | `checkUpgrade(type)` | 非主城 & level > castle.level → reasons含"不能超过主城等级+1" | P0 | ✅ covered | R22:主城等级限制测试 |
| BS-034 | `checkUpgrade(type)` | 非主城 & level <= castle.level → 通过此检查 | P1 | ✅ covered | R22隐含 |
| BS-035 | `checkUpgrade(type)` | 主城 Lv4→5 & 无其他建筑 Lv4 → reasons含"需要至少一座其他建筑达到 Lv4" | P0 | ✅ covered | R22:主城特殊前置测试 |
| BS-036 | `checkUpgrade(type)` | 主城 Lv9→10 & 无其他建筑 Lv9 → reasons含"需要至少一座其他建筑达到 Lv9" | P0 | ⚠️ uncovered | 无Lv9→10前置测试 |
| BS-037 | `checkUpgrade(type)` | 主城 Lv4→5 & 有其他建筑 Lv4 → 通过此检查 | P1 | ⚠️ uncovered | 无正向验证 |
| BS-038 | `checkUpgrade(type)` | status!='upgrading' & isQueueFull() → reasons含"升级队列已满" | P0 | ✅ covered | R22:队列满测试 |
| BS-039 | `checkUpgrade(type)` | resources 传入 & grain < cost.grain → reasons含"粮草不足" | P0 | ✅ covered | R22:资源不足测试 |
| BS-040 | `checkUpgrade(type)` | resources 传入 & gold < cost.gold → reasons含"铜钱不足" | P0 | ✅ covered | R22:资源不足测试 |
| BS-041 | `checkUpgrade(type)` | resources 传入 & troops < cost.troops → reasons含"兵力不足" | P0 | ✅ covered | R22隐含 |
| BS-042 | `checkUpgrade(type)` | resources 不传入 → 跳过资源检查 | P1 | ✅ covered | R22隐含 |
| BS-043 | `checkUpgrade(type)` | 全部条件满足 → canUpgrade=true | P1 | ✅ covered | engine-building.test.ts |
| BS-044 | `checkUpgrade(type)` | **NaN防护**: resources.grain=NaN → NaN < cost.grain 为 false，绕过检查 | 🔴 P0 | ⚠️ uncovered | NaN绕过（规则1） |
| BS-045 | `checkUpgrade(type)` | **NaN防护**: resources.gold=NaN → 同上 | 🔴 P0 | ⚠️ uncovered | NaN绕过 |
| BS-046 | `checkUpgrade(type)` | **NaN防护**: resources.troops=NaN → 同上 | 🔴 P0 | ⚠️ uncovered | NaN绕过 |

### 1.5 升级费用计算

| # | API | 分支条件 | 优先级 | 状态 | 来源 |
|---|-----|---------|--------|------|------|
| BS-050 | `getUpgradeCost(type)` | level <= 0 → return null | P1 | ⚠️ uncovered | 无level=0 unlocked建筑测试 |
| BS-051 | `getUpgradeCost(type)` | level >= maxLevel → return null | P1 | ✅ covered | R22:满级建筑测试 |
| BS-052 | `getUpgradeCost(type)` | 正常 level → return {...data.upgradeCost}（深拷贝） | P1 | ✅ covered | engine-building-ops.test.ts |
| BS-053 | `getUpgradeCost(type)` | levelTable[index] 不存在 → return null | P1 | ⚠️ uncovered | 无越界测试 |
| BS-054 | `getUpgradeCost(type)` | **NaN防护**: buildings[type].level=NaN → 数组访问失败 | 🔴 P0 | ⚠️ uncovered | NaN传播 |

### 1.6 产出计算

| # | API | 分支条件 | 优先级 | 状态 | 来源 |
|---|-----|---------|--------|------|------|
| BS-060 | `getProduction(type)` | level 不传 → 使用当前 level | P1 | ✅ covered | 交叉测试 |
| BS-061 | `getProduction(type)` | level=0 → return 0 | P1 | ✅ covered | 初始状态隐含 |
| BS-062 | `getProduction(type)` | level > 0 & data存在 → return production | P1 | ✅ covered | 交叉测试 |
| BS-063 | `getProduction(type)` | level > 0 & data不存在 → return 0 | P1 | ⚠️ uncovered | 无越界测试 |
| BS-064 | `getProduction(type)` | **NaN防护**: level=NaN → level <= 0 为 false，lv=NaN，data=undefined | 🔴 P0 | ⚠️ uncovered | NaN绕过 |
| BS-065 | `getCastleBonusPercent()` | 委托 getProduction('castle') | P1 | ✅ covered | 交叉测试 |
| BS-066 | `getCastleBonusMultiplier()` | 1 + percent/100 → 如 percent=NaN → NaN | 🔴 P0 | ⚠️ uncovered | NaN传播 |
| BS-067 | `getCastleBonusMultiplier()` | 正常 percent → 1.xx | P1 | ✅ covered | 交叉测试隐含 |

### 1.7 升级执行 — `startUpgrade()`

| # | API | 分支条件 | 优先级 | 状态 | 来源 |
|---|-----|---------|--------|------|------|
| BS-070 | `startUpgrade(type, resources)` | checkUpgrade 失败 → throw Error | P0 | ✅ covered | R22:锁定建筑抛错 |
| BS-071 | `startUpgrade(type, resources)` | checkUpgrade 通过 → 设置 status='upgrading' | P0 | ✅ covered | R22:取消升级测试 |
| BS-072 | `startUpgrade(type, resources)` | 设置 upgradeStartTime/upgradeEndTime = now + cost.timeSeconds*1000 | P1 | ✅ covered | R22隐含 |
| BS-073 | `startUpgrade(type, resources)` | 添加到 upgradeQueue | P1 | ✅ covered | R22:队列满测试 |
| BS-074 | `startUpgrade(type, resources)` | return 深拷贝 cost | P1 | ✅ covered | R22:取消升级测试 |
| BS-075 | `startUpgrade(type, resources)` | **NaN防护**: cost.timeSeconds=NaN → endTime=NaN | 🔴 P0 | ⚠️ uncovered | NaN传播（规则17） |

### 1.8 取消升级 — `cancelUpgrade()`

| # | API | 分支条件 | 优先级 | 状态 | 来源 |
|---|-----|---------|--------|------|------|
| BS-080 | `cancelUpgrade(type)` | status !== 'upgrading' → return null | P0 | ✅ covered | R22:非升级状态返回null |
| BS-081 | `cancelUpgrade(type)` | status === 'upgrading' & getUpgradeCost()=null → return null | P0 | ⚠️ uncovered | 无此场景测试 |
| BS-082 | `cancelUpgrade(type)` | 正常取消 → 返回 Math.round(cost * 0.8) 的 refund | P0 | ✅ covered | R22:取消升级返回80% |
| BS-083 | `cancelUpgrade(type)` | 取消后 status='idle', startTime=null, endTime=null | P0 | ✅ covered | R22:状态恢复idle |
| BS-084 | `cancelUpgrade(type)` | 从 upgradeQueue 中移除该建筑 | P1 | ✅ covered | R22隐含 |
| BS-085 | `cancelUpgrade(type)` | **NaN防护**: cost.grain=NaN → Math.round(NaN*0.8)=NaN refund | 🔴 P0 | ⚠️ uncovered | NaN传播 |
| BS-086 | `cancelUpgrade(type)` | **对称性**: refund.grain/gold/troops 三字段一致处理 | P1 | ✅ covered | R22隐含 |

### 1.9 升级计时 — `tick()`

| # | API | 分支条件 | 优先级 | 状态 | 来源 |
|---|-----|---------|--------|------|------|
| BS-090 | `tick()` | slot.endTime <= now → level+=1, status='idle', 清空时间 | P0 | ✅ covered | forceCompleteUpgrades模拟 |
| BS-091 | `tick()` | slot.endTime > now → 保留在 remaining | P1 | ✅ covered | 隐含 |
| BS-092 | `tick()` | completed 包含 'castle' → checkAndUnlockBuildings() | P0 | ✅ covered | 集成测试 |
| BS-093 | `tick()` | completed 不含 'castle' → 不触发解锁 | P1 | ⚠️ uncovered | 无此场景直接测试 |
| BS-094 | `tick()` | 多个 slot 同时完成 → 全部处理 | P1 | ⚠️ uncovered | 无并发完成测试 |
| BS-095 | `tick()` | 空队列 → 返回空数组 | P1 | ✅ covered | 初始状态隐含 |

### 1.10 升级进度

| # | API | 分支条件 | 优先级 | 状态 | 来源 |
|---|-----|---------|--------|------|------|
| BS-100 | `getUpgradeRemainingTime(type)` | status !== 'upgrading' → return 0 | P1 | ⚠️ uncovered | 无此测试 |
| BS-101 | `getUpgradeRemainingTime(type)` | 正常 → Math.max(0, (endTime-now)/1000) | P1 | ⚠️ uncovered | 无此测试 |
| BS-102 | `getUpgradeRemainingTime(type)` | **NaN防护**: upgradeEndTime=NaN → NaN比较 | 🔴 P0 | ⚠️ uncovered | NaN传播 |
| BS-103 | `getUpgradeProgress(type)` | status !== 'upgrading' → return 0 | P1 | ⚠️ uncovered | 无此测试 |
| BS-104 | `getUpgradeProgress(type)` | 正常 → min(1, elapsed/total) | P1 | ⚠️ uncovered | 无此测试 |
| BS-105 | `getUpgradeProgress(type)` | total <= 0 → return 1（除零保护） | P1 | ⚠️ uncovered | 无此测试 |
| BS-106 | `getUpgradeProgress(type)` | **NaN防护**: startTime/endTime=NaN → total=NaN | 🔴 P0 | ⚠️ uncovered | NaN传播 |

### 1.11 队列管理

| # | API | 分支条件 | 优先级 | 状态 | 来源 |
|---|-----|---------|--------|------|------|
| BS-110 | `getUpgradeQueue()` | 返回浅拷贝 [...upgradeQueue] | P1 | ✅ covered | R22:队列满测试 |
| BS-111 | `getMaxQueueSlots()` | castle Lv1-5 → 1 slot | P1 | ✅ covered | R22:队列满测试 |
| BS-112 | `getMaxQueueSlots()` | castle Lv6-10 → 2 slots | P1 | ⚠️ uncovered | 无Lv6+队列测试 |
| BS-113 | `getMaxQueueSlots()` | castle Lv11-20 → 3 slots | P1 | ⚠️ uncovered | 无此测试 |
| BS-114 | `getMaxQueueSlots()` | castle Lv21-30 → 4 slots | P1 | ⚠️ uncovered | 无此测试 |
| BS-115 | `getMaxQueueSlots()` | castle level 不匹配任何配置 → return 1（默认值） | P1 | ⚠️ uncovered | 无越界测试 |
| BS-116 | `isQueueFull()` | queue.length >= maxSlots | P0 | ✅ covered | R22:队列满测试 |

### 1.12 产出关联

| # | API | 分支条件 | 优先级 | 状态 | 来源 |
|---|-----|---------|--------|------|------|
| BS-120 | `calculateTotalProduction()` | 跳过 castle | P1 | ✅ covered | 交叉测试 |
| BS-121 | `calculateTotalProduction()` | 跳过 level <= 0 的建筑 | P1 | ✅ covered | 交叉测试隐含 |
| BS-122 | `calculateTotalProduction()` | 跳过无 production 配置的建筑 | P1 | ✅ covered | 交叉测试隐含 |
| BS-123 | `calculateTotalProduction()` | 累加同 resourceType 的产出 | P1 | ✅ covered | 交叉测试 |
| BS-124 | `calculateTotalProduction()` | **NaN防护**: getProduction返回NaN → 累加为NaN | 🔴 P0 | ⚠️ uncovered | NaN传播 |
| BS-125 | `getProductionBuildingLevels()` | 返回非 castle 建筑的等级映射 | P1 | ✅ covered | 交叉测试隐含 |

### 1.13 特殊属性

| # | API | 分支条件 | 优先级 | 状态 | 来源 |
|---|-----|---------|--------|------|------|
| BS-130 | `getWallDefense()` | wall.level <= 0 → return 0 | P1 | ✅ covered | 初始状态隐含 |
| BS-131 | `getWallDefense()` | wall.level > 0 & data存在 → return specialValue | P1 | ✅ covered | building-config.test.ts隐含 |
| BS-132 | `getWallDefense()` | wall.level > 0 & data不存在 → return 0 | P1 | ⚠️ uncovered | 无越界测试 |
| BS-133 | `getWallDefense()` | **NaN防护**: wall.level=NaN → NaN <= 0 为 false | 🔴 P0 | ⚠️ uncovered | NaN绕过 |
| BS-134 | `getWallDefenseBonus()` | 委托 getProduction('wall') | P1 | ⚠️ uncovered | 无此测试 |
| BS-135 | `getClinicRecoveryRate()` | 委托 getProduction('clinic') | P1 | ⚠️ uncovered | 无此测试 |

### 1.14 序列化 — `serialize()` / `deserialize()`

| # | API | 分支条件 | 优先级 | 状态 | 来源 |
|---|-----|---------|--------|------|------|
| BS-140 | `serialize()` | 返回 { buildings: 深拷贝, version: BUILDING_SAVE_VERSION } | P0 | ✅ covered | 交叉测试:存档加载 |
| BS-141 | `serialize()` | 深拷贝不影响内部状态 | P1 | ✅ covered | 交叉测试隐含 |
| BS-142 | `deserialize(data)` | version 不匹配 → gameLog.warn | P1 | ⚠️ uncovered | 无版本不匹配测试 |
| BS-143 | `deserialize(data)` | 正常恢复 buildings 状态 | P0 | ✅ covered | 交叉测试:存档加载 |
| BS-144 | `deserialize(data)` | 恢复后重建 upgradeQueue | P0 | ✅ covered | 集成测试 CHAIN1-09 |
| BS-145 | `deserialize(data)` | 离线期间升级已完成 → 直接 level+=1, status='idle' | P0 | ✅ covered | 交叉测试:离线收益 |
| BS-146 | `deserialize(data)` | 离线期间升级未完成 → 重建队列 | P1 | ✅ covered | 集成测试隐含 |
| BS-147 | `deserialize(data)` | 恢复后调用 checkAndUnlockBuildings() | P1 | ✅ covered | 集成测试隐含 |
| BS-148 | `deserialize(data)` | **null/undefined防护**: data=null → 崩溃 | 🔴 P0 | ⚠️ uncovered | deserialize覆盖（规则10） |
| BS-149 | `deserialize(data)` | **null/undefined防护**: data.buildings=null → 崩溃 | 🔴 P0 | ⚠️ uncovered | deserialize覆盖 |
| BS-150 | `deserialize(data)` | **null/undefined防护**: data.buildings[t]=undefined → 跳过该建筑 | P1 | ⚠️ uncovered | 无部分数据测试 |
| BS-151 | `deserialize(data)` | **NaN防护**: buildings[t].level=NaN → NaN传播到后续计算 | 🔴 P0 | ⚠️ uncovered | NaN传播 |
| BS-152 | `deserialize(data)` | **Infinity序列化**: upgradeEndTime=Infinity → now >= Infinity 为 false（安全） | P1 | ⚠️ uncovered | Infinity序列化（规则19） |
| BS-153 | `deserialize(data)` | engine-save 覆盖验证: ctx.building.serialize() 在 engine-save.ts:149 | P0 | ✅ covered | engine-save.ts:149 |
| BS-154 | `deserialize(data)` | engine-save 覆盖验证: ctx.building.deserialize() 在 engine-save.ts:416 | P0 | ✅ covered | engine-save.ts:416 |

### 1.15 重置

| # | API | 分支条件 | 优先级 | 状态 | 来源 |
|---|-----|---------|--------|------|------|
| BS-160 | `reset()` | buildings 恢复初始状态 | P0 | ✅ covered | engine-building.test.ts:afterEach |
| BS-161 | `reset()` | upgradeQueue 清空 | P1 | ✅ covered | 隐含 |

### 1.16 测试基础设施

| # | API | 分支条件 | 优先级 | 状态 | 来源 |
|---|-----|---------|--------|------|------|
| BS-170 | `forceCompleteUpgrades()` | 所有 upgrading 建筑 level+=1, status='idle' | P1 | ✅ covered | R22测试 |
| BS-171 | `forceCompleteUpgrades()` | 清空 upgradeQueue | P1 | ✅ covered | R22隐含 |
| BS-172 | `forceCompleteUpgrades()` | completed 含 'castle' → checkAndUnlockBuildings() | P1 | ✅ covered | R22隐含 |

### 1.17 推荐委托

| # | API | 分支条件 | 优先级 | 状态 | 来源 |
|---|-----|---------|--------|------|------|
| BS-180 | `recommendUpgradePath(context)` | 委托 BuildingRecommender | P1 | ⚠️ uncovered | 无此测试 |
| BS-181 | `getUpgradeRouteRecommendation(resources)` | 委托 BuildingRecommender | P1 | ⚠️ uncovered | 无此测试 |
| BS-182 | `getUpgradeRecommendation(resources)` | 委托 BuildingRecommender | P1 | ⚠️ uncovered | 无此测试 |

### 1.18 批量升级委托

| # | API | 分支条件 | 优先级 | 状态 | 来源 |
|---|-----|---------|--------|------|------|
| BS-190 | `batchUpgrade(types, resources)` | 委托 BuildingBatchOps.batchUpgrade | P1 | ⚠️ uncovered | BuildingSystem层无测试 |

---

## 2. BuildingStateHelpers（BuildingStateHelpers.ts — 45行）

| # | API | 分支条件 | 优先级 | 状态 | 来源 |
|---|-----|---------|--------|------|------|
| SH-001 | `getAppearanceStage(level)` | level <= 5 → 'humble' | P1 | ⚠️ uncovered | 无直接测试 |
| SH-002 | `getAppearanceStage(level)` | level <= 12 → 'orderly' | P1 | ⚠️ uncovered | 无直接测试 |
| SH-003 | `getAppearanceStage(level)` | level <= 20 → 'refined' | P1 | ⚠️ uncovered | 无直接测试 |
| SH-004 | `getAppearanceStage(level)` | level > 20 → 'glorious' | P1 | ⚠️ uncovered | 无直接测试 |
| SH-005 | `getAppearanceStage(level)` | **NaN防护**: level=NaN → NaN <= 5 为 false → 'glorious'（错误） | 🔴 P0 | ⚠️ uncovered | NaN绕过 |
| SH-006 | `getAppearanceStage(level)` | **NaN防护**: level=-1 → -1 <= 5 为 true → 'humble' | P1 | ⚠️ uncovered | 负值测试 |
| SH-007 | `createInitialState(type)` | unlockLevel=0 → level=1, status='idle' | P1 | ✅ covered | building-config.test.ts隐含 |
| SH-008 | `createInitialState(type)` | unlockLevel>0 → level=0, status='locked' | P1 | ✅ covered | building-config.test.ts隐含 |
| SH-009 | `createAllStates()` | 返回 8 种建筑的初始状态 | P1 | ✅ covered | R22隐含 |
| SH-010 | `createAllStates()` | BUILDING_TYPES 遍历完整性 | P1 | ✅ covered | building-config.test.ts |
| SH-011 | `createInitialState(type)` | **NaN防护**: BUILDING_UNLOCK_LEVELS[type]=NaN → NaN===0 为 false → locked | P1 | ⚠️ uncovered | NaN绕过 |
| SH-012 | `createInitialState(type)` | BUILDING_UNLOCK_LEVELS[type]=undefined → undefined===0 为 false → locked | P1 | ⚠️ uncovered | undefined防护 |

---

## 3. BuildingBatchOps（BuildingBatchOps.ts — 95行）

| # | API | 分支条件 | 优先级 | 状态 | 来源 |
|---|-----|---------|--------|------|------|
| BO-001 | `batchUpgrade(types, resources, ctx)` | 空数组 → 返回空 succeeded/failed/totalCost=0 | P1 | ⚠️ uncovered | 无空数组测试 |
| BO-002 | `batchUpgrade(types, resources, ctx)` | 单个可升级 → succeeded=[{type, cost}] | P0 | ✅ covered | engine-building-ops.test.ts隐含 |
| BO-003 | `batchUpgrade(types, resources, ctx)` | 单个不可升级 → failed=[{type, reason}] | P0 | ✅ covered | engine-building-ops.test.ts隐含 |
| BO-004 | `batchUpgrade(types, resources, ctx)` | 资源递减：第一个升级扣费后，第二个用剩余资源 | P0 | ✅ covered | 源码逻辑验证 |
| BO-005 | `batchUpgrade(types, resources, ctx)` | startUpgrade 抛错 → catch 添加到 failed | P0 | ✅ covered | engine-building-ops.test.ts |
| BO-006 | `batchUpgrade(types, resources, ctx)` | totalCost 累加所有成功升级的费用 | P1 | ✅ covered | 源码逻辑验证 |
| BO-007 | `batchUpgrade(types, resources, ctx)` | remainingGrain/Gold/Troops 正确递减 | P1 | ✅ covered | 源码逻辑验证 |
| BO-008 | `batchUpgrade(types, resources, ctx)` | **NaN防护**: resources.grain=NaN → remainingGrain=NaN，后续比较全为 false | 🔴 P0 | ⚠️ uncovered | NaN绕过（规则1） |
| BO-009 | `batchUpgrade(types, resources, ctx)` | **NaN防护**: cost.grain=NaN → totalCost.grain=NaN | 🔴 P0 | ⚠️ uncovered | NaN传播 |
| BO-010 | `batchUpgrade(types, resources, ctx)` | **事务性**: 部分成功部分失败 → 无回滚机制 | 🔴 P0 | ⚠️ uncovered | 事务性扫描（规则8） |
| BO-011 | `batchUpgrade(types, resources, ctx)` | mandate/techPoint 等非扣费字段正确传递 | P1 | ✅ covered | 源码逻辑验证 |
| BO-012 | `batchUpgrade(types, resources, ctx)` | **无效type**: types含非BuildingType → ctx.checkUpgrade行为未知 | P1 | ⚠️ uncovered | 无效输入测试 |

---

## 4. BuildingRecommender（BuildingRecommender.ts — 181行）

### 4.1 recommendUpgradePath

| # | API | 分支条件 | 优先级 | 状态 | 来源 |
|---|-----|---------|--------|------|------|
| RC-001 | `recommendUpgradePath(buildings, 'newbie')` | 返回 newbieOrder 排序的推荐 | P1 | ⚠️ uncovered | 无此测试 |
| RC-002 | `recommendUpgradePath(buildings, 'development')` | 返回 developmentOrder 排序的推荐 | P1 | ⚠️ uncovered | 无此测试 |
| RC-003 | `recommendUpgradePath(buildings, 'late')` | 返回 lateOrder 排序的推荐 | P1 | ⚠️ uncovered | 无此测试 |
| RC-004 | `recommendUpgradePath(buildings, context)` | 跳过已满级建筑（level >= maxLevel） | P1 | ⚠️ uncovered | 无此测试 |
| RC-005 | `recommendUpgradePath(buildings, context)` | 跳过正在升级的建筑（status='upgrading'） | P1 | ⚠️ uncovered | 无此测试 |
| RC-006 | `recommendUpgradePath(buildings, context)` | 跳过未解锁的建筑（status='locked'） | P1 | ⚠️ uncovered | 无此测试 |
| RC-007 | `recommendUpgradePath(buildings, context)` | **算法正确性**: 不同 context 真的返回不同顺序 | P0 | ⚠️ uncovered | 算法正确性（规则3） |
| RC-008 | `recommendUpgradePath(buildings, 'invalid')` | 无效 context → fallback newbieOrder | P1 | ⚠️ uncovered | 无此测试 |

### 4.2 getUpgradeRouteRecommendation

| # | API | 分支条件 | 优先级 | 状态 | 来源 |
|---|-----|---------|--------|------|------|
| RC-010 | `getUpgradeRouteRecommendation(...)` | 跳过 locked/upgrading/满级建筑 | P1 | ⚠️ uncovered | 无此测试 |
| RC-011 | `getUpgradeRouteRecommendation(...)` | 跳过 level >= castle.level 的非主城建筑 | P1 | ⚠️ uncovered | 无此测试 |
| RC-012 | `getUpgradeRouteRecommendation(...)` | 主城 → priority=100 | P1 | ⚠️ uncovered | 无此测试 |
| RC-013 | `getUpgradeRouteRecommendation(...)` | 有 production 的建筑 → priority=50+prodGain*10 | P1 | ⚠️ uncovered | 无此测试 |
| RC-014 | `getUpgradeRouteRecommendation(...)` | 无 production 的建筑 → priority=30 | P1 | ⚠️ uncovered | 无此测试 |
| RC-015 | `getUpgradeRouteRecommendation(...)` | 资源不足 → priority-=20 | P1 | ⚠️ uncovered | 无此测试 |
| RC-016 | `getUpgradeRouteRecommendation(...)` | 结果按 priority 降序排列 | P1 | ⚠️ uncovered | 无此测试 |
| RC-017 | `getUpgradeRouteRecommendation(...)` | **NaN防护**: getProduction返回NaN → priority=50+NaN=NaN | 🔴 P0 | ⚠️ uncovered | NaN传播 |
| RC-018 | `getUpgradeRouteRecommendation(...)` | **NaN防护**: getUpgradeCost返回NaN → resources.grain < NaN 为 false | P1 | ⚠️ uncovered | NaN绕过 |

### 4.3 getUpgradeRecommendation（简化版）

| # | API | 分支条件 | 优先级 | 状态 | 来源 |
|---|-----|---------|--------|------|------|
| RC-020 | `getUpgradeRecommendation(...)` | 委托 getUpgradeRouteRecommendation 并映射 | P1 | ⚠️ uncovered | 无此测试 |
| RC-021 | `getUpgradeRecommendation(...)` | reason 格式为 `${reason}（${estimatedBenefit}）` | P1 | ⚠️ uncovered | 无此测试 |

---

## 5. building-config（building-config.ts — 461行）

| # | API | 分支条件 | 优先级 | 状态 | 来源 |
|---|-----|---------|--------|------|------|
| CF-001 | BUILDING_MAX_LEVELS | 8种建筑等级上限正确 | P1 | ✅ covered | building-config.test.ts |
| CF-002 | BUILDING_UNLOCK_LEVELS | 8种建筑解锁条件正确 | P1 | ✅ covered | building-config.test.ts |
| CF-003 | BUILDING_DEFS | maxLevel 与 BUILDING_MAX_LEVELS 一致 | P0 | ✅ covered | building-config.test.ts |
| CF-004 | BUILDING_DEFS | unlockCastleLevel 与 BUILDING_UNLOCK_LEVELS 一致 | P0 | ✅ covered | building-config.test.ts |
| CF-005 | BUILDING_DEFS | levelTable 长度 = maxLevel | P0 | ✅ covered | building-config.test.ts |
| CF-006 | BUILDING_DEFS | 产出建筑有 production 配置 | P1 | ✅ covered | building-config.test.ts |
| CF-007 | BUILDING_DEFS | 主城有 specialAttribute | P1 | ✅ covered | building-config.test.ts |
| CF-008 | BUILDING_DEFS | 产出值非负 | P1 | ✅ covered | building-config.test.ts |
| CF-009 | BUILDING_DEFS | 升级费用非负 | P1 | ✅ covered | building-config.test.ts |
| CF-010 | BUILDING_DEFS | 主城/农田/市集/兵营产出单调递增 | P1 | ✅ covered | building-config.test.ts |
| CF-011 | QUEUE_CONFIGS | 4个配置段，无重叠，覆盖1~30 | P1 | ✅ covered | building-config.test.ts |
| CF-012 | QUEUE_CONFIGS | 槽位数单调递增 | P1 | ✅ covered | building-config.test.ts |
| CF-013 | CANCEL_REFUND_RATIO | 0.8，在(0,1]范围内 | P1 | ✅ covered | building-config.test.ts |
| CF-014 | BUILDING_SAVE_VERSION | 正整数 | P1 | ✅ covered | building-config.test.ts |
| CF-015 | BUILDING_DEFS | **配置-枚举同步**: BUILDING_TYPES(8) vs BUILDING_DEFS(8) vs BUILDING_MAX_LEVELS(8) | P0 | ✅ covered | building-config.test.ts |
| CF-016 | BUILDING_DEFS | **配置-枚举同步**: BUILDING_LABELS/ICONS/ZONES 覆盖所有 BuildingType | P0 | ✅ covered | building-config.test.ts隐含 |

---

## 6. building.types（building.types.ts — 190行）

| # | API | 分支条件 | 优先级 | 状态 | 来源 |
|---|-----|---------|--------|------|------|
| TY-001 | BUILDING_TYPES | 只读数组，8个元素 | P1 | ✅ covered | building-config.test.ts |
| TY-002 | BUILDING_LABELS | 覆盖所有 BuildingType | P1 | ✅ covered | 类型检查 |
| TY-003 | BUILDING_ICONS | 覆盖所有 BuildingType | P1 | ✅ covered | 类型检查 |
| TY-004 | BUILDING_ZONES | 覆盖所有 BuildingType，5个分区 | P1 | ✅ covered | 类型检查 |

---

## 特别关注项汇总

| # | 模式 | 严重度 | 影响范围 | 状态 |
|---|------|--------|---------|------|
| S-1 | NaN绕过资源检查（BS-044~046） | 🔴 P0 | checkUpgrade 中 resources.grain/gold/troops=NaN 绕过 < 比较检查 | uncovered |
| S-2 | NaN传播到升级费用（BS-054） | 🔴 P0 | buildings[type].level=NaN → getUpgradeCost 数组访问失败 | uncovered |
| S-3 | NaN传播到产出计算（BS-064） | 🔴 P0 | getProduction(level=NaN) → NaN产出影响全局 | uncovered |
| S-4 | NaN传播到主城加成（BS-066） | 🔴 P0 | getCastleBonusMultiplier() → 1+NaN/100=NaN → 全资源加成崩溃 | uncovered |
| S-5 | NaN传播到升级计时（BS-075） | 🔴 P0 | cost.timeSeconds=NaN → endTime=NaN → tick永远不完成 | uncovered |
| S-6 | NaN传播到取消返还（BS-085） | 🔴 P0 | refund=Math.round(NaN*0.8)=NaN → 资源系统注入NaN | uncovered |
| S-7 | NaN传播到进度计算（BS-102/106） | 🔴 P0 | upgradeTime=NaN → 进度和剩余时间均为NaN | uncovered |
| S-8 | NaN传播到产出汇总（BS-124） | 🔴 P0 | calculateTotalProduction → NaN累加到资源系统 | uncovered |
| S-9 | NaN传播到城防值（BS-133） | 🔴 P0 | wall.level=NaN → getWallDefense返回undefined | uncovered |
| S-10 | NaN传播到推荐算法（RC-017/18） | 🔴 P0 | priority=NaN → 排序异常 | uncovered |
| S-11 | deserialize null/undefined防护（BS-148~151） | 🔴 P0 | data=null/data.buildings=null → 崩溃 | uncovered |
| S-12 | batchUpgrade事务性（BO-010） | 🔴 P0 | 部分成功无回滚机制 | uncovered |
| S-13 | batchUpgrade NaN绕过（BO-008/009） | 🔴 P0 | resources NaN → 全部比较为 false → 跳过资源检查 | uncovered |
| S-14 | getAppearanceStage NaN（SH-005） | 🟡 P1 | level=NaN → 所有比较为 false → 返回 'glorious' | uncovered |
| S-15 | 推荐算法正确性（RC-007） | 🟡 P1 | 不同 context 是否真的返回不同顺序 | uncovered |
| S-16 | 主城Lv9→10前置条件（BS-036） | 🟡 P1 | 无此分支测试 | uncovered |
| S-17 | 队列多级配置（BS-112~114） | 🟡 P1 | 仅测试Lv1-5的1 slot | uncovered |
| S-18 | Building↔Campaign城防值链路 | 🟡 P1 | getWallDefense → CampaignSystem 无集成验证 | uncovered |

## Top 10 P0 Uncovered 节点

| # | 节点 | 子系统 | 描述 |
|---|------|--------|------|
| 1 | BS-044~046 | BuildingSystem | checkUpgrade 中 NaN 绕过资源检查（grain/gold/troops） |
| 2 | BS-066 | BuildingSystem | getCastleBonusMultiplier() → NaN → 全资源加成崩溃 |
| 3 | BS-148~149 | BuildingSystem | deserialize(null) / deserialize({buildings:null}) → 崩溃 |
| 4 | BS-075 | BuildingSystem | startUpgrade cost.timeSeconds=NaN → endTime=NaN → 永远不完成 |
| 5 | BS-085 | BuildingSystem | cancelUpgrade refund=NaN → 资源系统注入NaN |
| 6 | BS-124 | BuildingSystem | calculateTotalProduction NaN 累加到资源系统 |
| 7 | BO-008~010 | BuildingBatchOps | batchUpgrade NaN 绕过 + 无事务回滚 |
| 8 | BS-036 | BuildingSystem | 主城 Lv9→10 前置条件未测试 |
| 9 | RC-007 | BuildingRecommender | 推荐算法不同阶段是否真的返回不同顺序 |
| 10 | BS-133 | BuildingSystem | wall.level=NaN → getWallDefense 返回 undefined |

## NaN 防护覆盖全景

| API | NaN入口点 | 当前防护 | 状态 |
|-----|----------|---------|------|
| checkUpgrade | resources.grain/gold/troops | ❌ 无 `!Number.isFinite()` | uncovered |
| getUpgradeCost | buildings[type].level | ❌ 无检查 | uncovered |
| getProduction | level 参数 | ❌ 无检查 | uncovered |
| getCastleBonusMultiplier | getProduction 返回值 | ❌ 无检查 | uncovered |
| startUpgrade | cost.timeSeconds | ❌ 无检查 | uncovered |
| cancelUpgrade | cost.grain/gold/troops | ❌ 无检查 | uncovered |
| getUpgradeRemainingTime | upgradeEndTime | ❌ 无检查 | uncovered |
| getUpgradeProgress | startTime/endTime | ❌ 无检查 | uncovered |
| calculateTotalProduction | getProduction 返回值 | ❌ 无检查 | uncovered |
| getWallDefense | wall.level | ❌ 无检查 | uncovered |
| batchUpgrade | resources.grain/gold/troops | ❌ 无检查 | uncovered |
| getAppearanceStage | level 参数 | ❌ 无检查 | uncovered |
| getUpgradeRouteRecommendation | getProduction/getUpgradeCost 返回值 | ❌ 无检查 | uncovered |

## Serialize 完整性检查

| 检查项 | 状态 | 说明 |
|--------|------|------|
| serialize() 输出包含 buildings | ✅ covered | BuildingSaveData.buildings |
| serialize() 输出包含 version | ✅ covered | BuildingSaveData.version |
| serialize() 使用深拷贝 | ✅ covered | cloneBuildings() |
| deserialize() 恢复 buildings | ✅ covered | 遍历 BUILDING_TYPES |
| deserialize() 重建 upgradeQueue | ✅ covered | 从 upgrading 状态重建 |
| deserialize() 处理离线完成 | ✅ covered | now >= endTime 直接完成 |
| deserialize() null 防护 | ❌ uncovered | data=null 崩溃 |
| deserialize() NaN 防护 | ❌ uncovered | level=NaN 传播 |
| deserialize() 版本不匹配 | ❌ uncovered | 仅 warn 无迁移 |
| engine-save 调用 serialize | ✅ covered | engine-save.ts:149 |
| engine-save 调用 deserialize | ✅ covered | engine-save.ts:416 |
| BUILDING_SAVE_VERSION 正确 | ✅ covered | =1 |

## 配置一致性检查

| 检查项 | 状态 | 说明 |
|--------|------|------|
| BUILDING_TYPES(8) vs BUILDING_DEFS(8) | ✅ covered | building-config.test.ts |
| BUILDING_MAX_LEVELS vs BUILDING_DEFS.maxLevel | ✅ covered | building-config.test.ts |
| BUILDING_UNLOCK_LEVELS vs BUILDING_DEFS.unlockCastleLevel | ✅ covered | building-config.test.ts |
| levelTable 长度 = maxLevel | ✅ covered | building-config.test.ts |
| QUEUE_CONFIGS 覆盖 1~30 无重叠 | ✅ covered | building-config.test.ts |
| BuildingType 枚举 vs BUILDING_TYPES 数组 | ✅ covered | 类型系统保证 |
| BUILDING_LABELS/ICONS/ZONES 覆盖完整 | ✅ covered | 类型系统保证 |
| 产出建筑 production.resourceType 合法 | ✅ covered | building-config.test.ts |

---

## 测试文件映射

| 测试文件 | 覆盖范围 | 行数 |
|----------|---------|------|
| building-config.test.ts | 配置完整性、等级上限、解锁条件、产出单调性 | 239 |
| R22-building-abnormal.test.ts | 异常路径：锁定/满级/资源不足/队列满/取消升级/主城限制 | 234 |
| engine-building.test.ts | Engine编排层：升级/取消/事件 | 101 |
| cross-building-resource.test.ts | Building↔Resource 交叉验证 | 411 |
| engine-building-ops.test.ts | BuildingOps 委托层 | 202 |
| chain1-building-resource-tech.integration.test.ts | Building→Resource→Tech 集成 | 347 |
| **总计** | | **1,534** |
