# 建筑系统 游戏流程枚举 — Round 1

> Builder: FlowBuilder v1.0 | 时间: 2026-05-02
> 基于: PRD(BLD-buildings-prd.md) + UI(BLD-buildings.md) + 源码(BuildingSystem.ts + building-config.ts)

---

## 统计

| 指标 | 数值 |
|------|------|
| 主流程数 | 9 |
| 子流程数 | 28 |
| 跨系统流程(XI) | 6 |
| 触发事件(TE) | 5 |
| 流程断裂点(GAP) | 6 |
| 数据追溯覆盖率 | 92% |

---

## 一、主流程

### BLD-F01 资源产出循环 {#bld-f01}

**玩家视角**: 建筑持续产出资源 → 资源累积 → 用于升级/消费

**流程步骤**:
1. [系统触发-TE01] 每帧 tick 调用 `calculateTotalProduction()`
2. [系统计算] 遍历所有非 castle 建筑，累加各 resourceType 产出
3. [系统计算] 产出 = 基础产出 × 主城加成(`getCastleBonusMultiplier`) × 科技加成 × 武将加成
4. [数据变更] 资源系统：grain/gold/troops += 产出值 × dt
5. [UI反馈] 顶部资源栏数字递增、各建筑上方飘出产出数字

**数据变更**:
| 数据 | 变更前 | 变更后 | 来源 |
|------|--------|--------|------|
| resources.grain | X | X + farmland产出×dt | calculateTotalProduction |
| resources.gold | X | X + market产出×dt | calculateTotalProduction |
| resources.troops | X | X + barracks产出×dt | calculateTotalProduction |
| resources.techPoints | X | X + academy产出×dt | calculateTotalProduction |

**前置条件**: 建筑已解锁且 level > 0
**后置流程**: → RES-F01（资源累积）、→ BLD-F02（产出上限检查）

**流程编号引用**:
- 主城加成计算: BLD-F01-01
- 科技加成注入: → TEC-F02（跨系统）
- 武将加成注入: → HER-F02（跨系统）

---

#### BLD-F01-01 主城全资源加成计算

**流程步骤**:
1. 调用 `getCastleBonusPercent()` → `getProduction('castle')`
2. 返回 castle.levelTable[level-1].production（如 Lv5 → 8%）
3. 转换为乘数: `1 + percent/100`（如 1.08）

**数据来源**: castle 等级 → levelTable 配置

---

#### BLD-F01-02 产出上限检查

**流程步骤**:
1. 资源系统检查当前资源是否达到上限
2. 达到上限 → 产出停止累加（溢出丢弃或等待收取）

**断裂点**: 当前引擎未实现资源上限机制 → 见 GAP-004

---

### BLD-F02 建筑升级流程 {#bld-f02}

**玩家视角**: 点击建筑 → 查看详情 → 点击升级 → 等待 → 升级完成

**流程步骤**:
1. [玩家操作] 点击建筑网格中的建筑
2. [UI响应] 弹出建筑详情面板，显示当前等级、产出、升级费用、所需时间
3. [玩家操作] 点击"升级"按钮
4. [系统校验] `checkUpgrade(type, resources)` 检查:
   - a. 建筑未锁定 (`status !== 'locked'`)
   - b. 未在升级中 (`status !== 'upgrading'`)
   - c. 未达等级上限 (`level < maxLevel`)
   - d. 非主城: `level <= castle.level + 1`
   - e. 主城特殊: Lv4→5需任一建筑Lv4, Lv9→10需任一建筑Lv9
   - f. 队列未满 (`!isQueueFull()`)
   - g. 资源充足 (grain >= cost.grain, gold >= cost.gold, troops >= cost.troops)
5. [校验失败] 返回失败原因，UI提示
6. [校验通过] `startUpgrade(type, resources)`:
   - a. 扣除资源费用
   - b. 设置 status='upgrading', upgradeStartTime=now, upgradeEndTime=now+timeSeconds*1000
   - c. 添加到 upgradeQueue
7. [UI反馈] 建筑上方显示升级进度条、倒计时
8. [系统触发-TE02] 每帧 `tick()` 检查 endTime <= now
9. [升级完成] level += 1, status='idle', 清空时间
10. [UI反馈] 建筑外观变化、升级完成特效
11. [系统触发] 若为主城升级 → BLD-F05（解锁链）

**数据变更**:
| 数据 | 变更前 | 变更后 | 来源 |
|------|--------|--------|------|
| buildings[type].level | N | N+1 | tick() |
| buildings[type].status | 'upgrading' | 'idle' | tick() |
| buildings[type].upgradeStartTime | timestamp | null | tick() |
| buildings[type].upgradeEndTime | timestamp | null | tick() |
| resources.grain | X | X - cost.grain | startUpgrade |
| resources.gold | X | X - cost.gold | startUpgrade |
| resources.troops | X | X - cost.troops | startUpgrade |
| upgradeQueue | [...] | [...+slot] | startUpgrade |

**前置条件**: 建筑已解锁、资源充足、队列未满
**后置流程**: → BLD-F05（解锁检查）、→ BLD-F01（产出重新计算）

---

#### BLD-F02-01 升级费用计算

**流程步骤**:
1. `getUpgradeCost(type)` 读取 `BUILDING_DEFS[type].levelTable[level]`
2. 返回 `{ grain, gold, troops, timeSeconds }` 深拷贝
3. 等级越界 (level <= 0 或 level >= maxLevel) → return null

**数据来源**: building-config.ts 静态配置

---

#### BLD-F02-02 升级前置条件 — 主城等级限制

**流程步骤**:
1. 非主城建筑: `level > castle.level` → 拒绝（允许领先1级）
2. 主城 Lv4→5: 需要 `BUILDING_TYPES.some(t !== castle && level >= 4)`
3. 主城 Lv9→10: 需要 `BUILDING_TYPES.some(t !== castle && level >= 9)`

**流程断裂**: Lv10→15→20→25→30 无额外前置条件 → 见 GAP-001

---

#### BLD-F02-03 升级前置条件 — 队列管理

**流程步骤**:
1. `getMaxQueueSlots()` 根据 castle.level 返回槽位数:
   - Lv1-5 → 1 slot
   - Lv6-10 → 2 slots
   - Lv11-20 → 3 slots
   - Lv21-30 → 4 slots
2. `isQueueFull()` 检查 queue.length >= maxSlots
3. 队列满 → 拒绝升级

---

### BLD-F03 取消升级流程 {#bld-f03}

**玩家视角**: 在升级中点击建筑 → 点击"取消升级" → 返还80%资源

**流程步骤**:
1. [玩家操作] 点击正在升级的建筑
2. [UI响应] 详情面板显示升级进度和"取消升级"按钮
3. [玩家操作] 点击"取消升级"
4. [系统处理] `cancelUpgrade(type)`:
   - a. 校验 status === 'upgrading'
   - b. 计算 refund = Math.round(cost * 0.8)
   - c. status = 'idle', 清空时间
   - d. 从 upgradeQueue 移除
5. [数据变更] 资源系统：grain/gold/troops += refund
6. [UI反馈] 资源数字增加、升级进度消失

**数据变更**:
| 数据 | 变更前 | 变更后 | 来源 |
|------|--------|--------|------|
| buildings[type].status | 'upgrading' | 'idle' | cancelUpgrade |
| resources.grain | X | X + refund.grain | cancelUpgrade |
| resources.gold | X | X + refund.gold | cancelUpgrade |
| upgradeQueue | [..slot..] | [..] | cancelUpgrade |

**前置条件**: 建筑正在升级中
**后置流程**: → BLD-F01（产出重新计算）

---

### BLD-F04 批量升级流程 {#bld-f04}

**玩家视角**: 选择多个建筑 → 一键批量升级 → 依次执行

**流程步骤**:
1. [玩家操作] 通过推荐系统或手动选择多个建筑类型
2. [玩家操作] 点击"批量升级"
3. [系统处理] `batchUpgrade(types, resources)`:
   - a. 遍历 types 列表
   - b. 对每个 type: checkUpgrade → 通过则 startUpgrade，失败则记录原因
   - c. 资源递减：第一个升级扣费后，第二个用剩余资源
   - d. 返回 { succeeded, failed, totalCost }
4. [UI反馈] 显示成功/失败列表，资源变化

**数据变更**:
| 数据 | 变更前 | 变更后 | 来源 |
|------|--------|--------|------|
| resources | R | R - totalCost | batchUpgrade |
| upgradeQueue | [...] | [...+new slots] | batchUpgrade |
| buildings[types] | 各自level | 各自level+1(成功部分) | tick()后续 |

**前置条件**: 至少一个建筑可升级
**后置流程**: → BLD-F02（每个单独升级流程）

---

### BLD-F05 建筑解锁链 {#bld-f05}

**玩家视角**: 主城升级到指定等级 → 新建筑自动解锁 → 出现在建筑网格中

**流程步骤**:
1. [触发] 主城升级完成 (tick 中 completed 包含 'castle')
2. [系统处理] `checkAndUnlockBuildings()`:
   - a. 遍历所有 locked 建筑
   - b. 检查 `checkUnlock(type)`: castle.level >= BUILDING_UNLOCK_LEVELS[type]
   - c. 符合条件 → status='idle', level=1
   - d. 返回新解锁列表
3. [UI反馈] 新建筑出现在网格中、解锁特效

**解锁时间线**:
| 主城等级 | 解锁建筑 | 流程编号 |
|:--------:|---------|---------|
| Lv1 | castle(主城), farmland(农田) | 初始 |
| Lv2 | market(市集), barracks(兵营) | BLD-F05-Lv2 |
| Lv3 | smithy(铁匠铺), academy(书院) | BLD-F05-Lv3 |
| Lv4 | clinic(医馆) | BLD-F05-Lv4 |
| Lv5 | wall(城墙) | BLD-F05-Lv5 |
| Lv6+ | **无新建筑** | **断裂: GAP-001** |

**数据变更**:
| 数据 | 变更前 | 变更后 | 来源 |
|------|--------|--------|------|
| buildings[type].status | 'locked' | 'idle' | checkAndUnlockBuildings |
| buildings[type].level | 0 | 1 | checkAndUnlockBuildings |

**前置条件**: 主城升级完成
**后置流程**: → BLD-F01（新建筑开始产出）

---

### BLD-F06 城墙防御流程 {#bld-f06}

**玩家视角**: 升级城墙 → 城防值增加 → 攻城时防御加成

**流程步骤**:
1. [玩家操作] 升级城墙 (BLD-F02)
2. [数据变更] wall.level += 1
3. [系统计算] `getWallDefense()` → BUILDING_DEFS.wall.levelTable[level-1].specialValue
4. [跨系统] → CPN-F01（攻城防御消费城防值）

**数据来源**: wall.levelTable[level-1].specialValue（城防值）+ production（防御加成%）

---

### BLD-F07 离线建造流程 {#bld-f07}

**玩家视角**: 关闭游戏 → 重新登录 → 查看离线期间完成的升级

**流程步骤**:
1. [触发] 玩家重新登录，调用 `deserialize(saveData)`
2. [系统处理] 遍历所有 upgrading 建筑:
   - a. `now >= upgradeEndTime` → level += 1, status='idle'（离线完成）
   - b. `now < upgradeEndTime` → 重建 upgradeQueue（继续等待）
3. [系统处理] `checkAndUnlockBuildings()` — 检查是否有新建筑可解锁
4. [UI反馈] 离线收益面板显示完成的升级和资源产出

**数据变更**:
| 数据 | 变更前 | 变更后 | 来源 |
|------|--------|--------|------|
| buildings[completed].level | N | N+1 | deserialize |
| buildings[completed].status | 'upgrading' | 'idle' | deserialize |
| upgradeQueue | [] | [remaining slots] | deserialize |

**前置条件**: 有存档数据、有正在升级的建筑
**后置流程**: → BLD-F05（解锁检查）、→ OFR-F01（离线收益计算）

---

### BLD-F08 建筑外观演进 {#bld-f08}

**玩家视角**: 建筑等级提升 → 外观风格变化

**流程步骤**:
1. [触发] 建筑升级完成 (BLD-F02)
2. [系统计算] `getAppearanceStage(level)`:
   - level 1~5 → 'humble'（茅屋/木栅）
   - level 6~12 → 'orderly'（瓦房/石墙）
   - level 13~20 → 'refined'（楼阁/砖墙）
   - level 21~30 → 'glorious'（宫殿/铜门）
3. [UI反馈] 建筑外观随等级变化

---

### BLD-F09 升级推荐流程 {#bld-f09}

**玩家视角**: 查看推荐 → 根据建议选择升级目标

**流程步骤**:
1. [玩家操作] 点击"升级推荐"按钮
2. [系统计算] `getUpgradeRouteRecommendation(resources)`:
   - a. 跳过 locked/upgrading/满级建筑
   - b. 主城 priority=100
   - c. 有 production 的建筑: priority=50+prodGain*10
   - d. 无 production 的建筑: priority=30
   - e. 资源不足: priority-=20
   - f. 按 priority 降序排列
3. [UI反馈] 显示推荐列表，包含升级原因和预估收益

**流程断裂**: 推荐系统仅考虑当前资源，不考虑长期规划 → 见 GAP-005

---

## 二、触发事件（TE）

### TE-01 建筑产出 Tick

- **触发条件**: 每帧 update(dt) 调用
- **触发频率**: 60fps（每秒60次）
- **处理**: calculateTotalProduction() → 资源累加
- **关联流程**: BLD-F01

### TE-02 升级计时 Tick

- **触发条件**: 每帧 update(dt) 调用
- **触发频率**: 60fps
- **处理**: tick() 检查 endTime <= now → 完成升级
- **关联流程**: BLD-F02

### TE-03 主城升级解锁

- **触发条件**: tick() 中 completed 包含 'castle'
- **处理**: checkAndUnlockBuildings()
- **关联流程**: BLD-F05

### TE-04 离线升级完成

- **触发条件**: deserialize() 时 now >= upgradeEndTime
- **处理**: level += 1, status='idle'
- **关联流程**: BLD-F07

### TE-05 存档校验修复

- **触发条件**: deserialize() 时数据异常
- **处理**: upgrading状态异常→修正为idle; locked但level>0→修正为idle
- **关联流程**: BLD-F07

---

## 三、跨系统流程（XI）

### XI-001 建筑→资源系统（产出注入）

**衔接点**: BLD-F01 → RES-F01
**数据流**: calculateTotalProduction() 返回值 → 资源系统累加
**加成链**: base × castleBonus × techBonus × heroBonus × prestigeBonus

### XI-002 资源→建筑系统（升级扣费）

**衔接点**: RES-F02 → BLD-F02
**数据流**: startUpgrade() 扣除 resources.grain/gold/troops
**回滚**: cancelUpgrade() 返还 80%

### XI-003 建筑→科技系统（科技点产出）

**衔接点**: BLD-F01 → TEC-F01
**数据流**: academy 产出 techPoints/秒 → 科技系统消费

### XI-004 建筑→攻城系统（城防值）

**衔接点**: BLD-F06 → CPN-F01
**数据流**: getWallDefense() 返回城防值 → 攻城防御计算

### XI-005 武将→建筑系统（加成注入）

**衔接点**: HER-F02 → BLD-F01
**数据流**: 武将政治/统率属性 → 建筑产出加成

### XI-006 科技→建筑系统（加成注入）

**衔接点**: TEC-F02 → BLD-F01
**数据流**: 科技效果（如"农耕改良"粮草+10%）→ 建筑产出加成

---

## 四、数据追溯链

| 数据 | 产生操作 | 触发事件 | 流程编号 |
|------|---------|---------|---------|
| buildings[type].level | 玩家点击升级 | TE-02(tick完成) | BLD-F02 |
| buildings[type].status | 玩家操作/系统 | 多处 | BLD-F02/F03/F05/F07 |
| buildings[type].upgradeStartTime | startUpgrade | 玩家点击升级 | BLD-F02 |
| buildings[type].upgradeEndTime | startUpgrade | 玩家点击升级 | BLD-F02 |
| upgradeQueue | startUpgrade/cancelUpgrade | 玩家操作 | BLD-F02/F03 |
| resources.grain (消耗) | startUpgrade | 玩家点击升级 | BLD-F02 → XI-002 |
| resources.grain (产出) | calculateTotalProduction | TE-01(每帧) | BLD-F01 → XI-001 |
| 城防值 | getWallDefense | 城墙等级变化 | BLD-F06 → XI-004 |
| 解锁状态 | checkAndUnlockBuildings | TE-03(主城升级) | BLD-F05 |

---

## 五、流程断裂点与缺失功能

### GAP-001 主城Lv5后无新建筑/新机制 🔴

**位置**: BLD-F05（解锁链）
**现象**: 主城Lv5解锁城墙后，Lv6~30无新建筑解锁，后续仅数值堆叠
**影响**: 游戏中期（第5天后）失去新鲜感，玩家目标感丧失
**数据支撑**: BUILDING_UNLOCK_LEVELS 中 wall=5 是最高解锁等级
**建议**:
- 方案A: 新增高级建筑（如 Lv10 解锁"工坊"、Lv15 解锁"藏宝阁"）
- 方案B: 建筑特化系统（Lv10 后建筑可选择特化方向）
- 方案C: 建筑联动系统（特定建筑组合产生额外效果）

### GAP-002 世界地图缺失 🔴

**位置**: 跨系统（BLD ↔ MAP）
**现象**: 建筑仅在固定网格中，无地理维度；攻城无实际地图
**影响**: 策略深度不足，建筑布局无意义
**建议**: 引入地图系统，建筑位置影响产出/防御

### GAP-003 资源产出与升级费用失衡 🟡

**位置**: BLD-F01（产出）vs BLD-F02（费用）
**现象**:
- Lv1 农田产出 0.8 粮草/秒
- Lv5→6 升级需要 5000 粮草 → 需要 ~6250 秒（~104分钟）纯等待
- Lv10→11 升级需要 72000 粮草 → 产出不足，等待时间过长
**影响**: 中后期升级节奏过慢，玩家体验差
**建议**:
- 提高基础产出速率
- 引入离线产出加成
- 增加资源获取渠道（任务、战斗、贸易）

### GAP-004 建筑间无协同/对抗机制 🟡

**位置**: BLD-F01（产出计算）
**现象**: 8座建筑独立运作，无互相加成/限制
**影响**: 升级策略单一（均衡升级即可），缺乏决策深度
**建议**:
- 建筑协同: 农田+市集="商贸繁荣"额外+15%产出
- 建筑冲突: 兵营+农田="屯田vs征兵"资源竞争
- 建筑组合: 特定等级组合触发特殊效果

### GAP-005 自动升级功能缺失 🟡

**位置**: BLD-F02（升级流程）
**现象**: PRD 提到"可开启开关，系统自动将可升级建筑加入队列"，但引擎未实现
**影响**: 后期操作繁琐，玩家需要手动升级每个建筑
**建议**: 实现自动升级开关，按推荐顺序自动升级

### GAP-006 升级路线推荐缺乏长期规划 🟡

**位置**: BLD-F09（推荐流程）
**现象**: 推荐仅基于当前资源和 priority 算法，不考虑:
- 玩家当前游戏阶段
- 下一个解锁里程碑
- 资源产出-消耗平衡
**影响**: 推荐不够智能，玩家可能按推荐升级后陷入资源困境
**建议**: 引入阶段性推荐策略，考虑资源平衡

---

## 六、关键数值追溯

### 6.1 升级费用曲线

| 主城等级 | 升级费用(grain) | 升级时间 | 累计费用 |
|:--------:|:--------------:|:--------:|:--------:|
| Lv1→2 | 200 | 10s | 200 |
| Lv5→6 | 5,000 | 8m | ~9,400 |
| Lv9→10 | 40,000 | 2h | ~93,400 |
| Lv14→15 | 755,827 | 64h | ~1.56M |
| Lv19→20 | 1,981,358 | 50.6天 | ~4.2M |
| Lv24→25 | 15,002,676 | 115.6天 | ~26M |
| Lv29→30 | 80,808,755 | 2.64年 | ~215M |

### 6.2 产出速率

| 建筑 | Lv1产出 | Lv10产出 | Lv20产出 | Lv25/30产出 |
|------|:-------:|:--------:|:--------:|:-----------:|
| 农田(粮草/秒) | 0.8 | ~5.5 | ~22 | ~45 |
| 市集(铜钱/秒) | 0.6 | ~4.8 | ~18 | ~35 |
| 兵营(兵力/秒) | 0.4 | ~3.2 | ~14 | ~28 |
| 书院(科技点/秒) | 0.2 | ~1.8 | ~6.0 | ~8.0 |

### 6.3 ROI 分析

```
Lv5→6 农田: 产出提升 = 3.8-3.0 = 0.8/秒, 费用 = 5000粮草
回本时间 = 5000 / 0.8 = 6250秒 ≈ 104分钟

Lv10→11 农田: 产出提升 = 8.8-8.0 = 0.8/秒, 费用 = 14400粮草
回本时间 = 14400 / 0.8 = 18000秒 ≈ 300分钟 = 5小时

Lv20→21 农田: 产出提升 = 24-22 = 2/秒, 费用 = ~2954880粮草
回本时间 = 2954880 / 2 = 1477440秒 ≈ 17天
```

**问题**: Lv10 后 ROI 急剧恶化，升级变得不划算 → GAP-003

---

## 七、PRD 需求覆盖检查

| PRD编号 | 需求 | 流程覆盖 | 状态 |
|---------|------|---------|------|
| BLD-1-1 | 8座建筑总览 | BLD-F05 | ✅ |
| BLD-1-2 | 建筑外观演进 | BLD-F08 | ✅ |
| BLD-2 | 建筑升级（费用/时间/前置） | BLD-F02 | ✅ |
| BLD-3 | 资源产出 | BLD-F01 | ✅ |
| BLD-4-1 | 前置关系 | BLD-F02-02/F05 | ✅ |
| BLD-4-2 | 联动加成 | XI-005/XI-006 | ⚠️ 引擎部分实现 |
| BLD-4-3 | 队列管理 | BLD-F02-03 | ✅ |
| BLD-4-4 | 离线建造进度 | BLD-F07 | ✅ |
| BLD-5-1 | 升级路线推荐 | BLD-F09 | ✅ |
| BLD-5-2 | 资源死锁避免 | GAP-003/GAP-006 | ⚠️ 部分覆盖 |
| BLD-5-3 | 一键收取 | 无流程 | ❌ 缺失 |
| BLD-4-3 | 自动升级 | 无流程 | ❌ GAP-005 |
| BLD-4-3 | 加速选项 | 无流程 | ❌ 缺失 |

**PRD覆盖率**: 10/13 = 76.9%

---

## 八、流程图（核心循环）

```
┌──────────────────────────────────────────────────────────────────┐
│                     建筑系统核心循环                               │
│                                                                  │
│  ┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐   │
│  │ BLD-F01 │────→│ RES-F01 │────→│ 玩家决策 │────→│ BLD-F02 │   │
│  │ 资源产出 │     │ 资源累积 │     │         │     │ 建筑升级 │   │
│  └─────────┘     └─────────┘     └─────────┘     └────┬────┘   │
│       ↑                                                │        │
│       │           ┌─────────┐                          │        │
│       └───────────│ BLD-F01 │←─────────────────────────┘        │
│                   │ 产出提升 │   升级完成后产出重新计算            │
│                   └─────────┘                                    │
│                                                                  │
│  BLD-F05 解锁链:                                                │
│  主城Lv2→市集+兵营 → Lv3→铁匠+书院 → Lv4→医馆 → Lv5→城墙       │
│  Lv6+ → ??? (GAP-001: 无新内容)                                  │
│                                                                  │
│  跨系统:                                                         │
│  BLD-F01 → XI-005(武将加成) → XI-006(科技加成)                   │
│  BLD-F06 → XI-004(城防值→攻城)                                   │
│  BLD-F01 → XI-003(科技点→科技系统)                                │
└──────────────────────────────────────────────────────────────────┘
```
