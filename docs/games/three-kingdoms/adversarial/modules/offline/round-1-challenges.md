# Offline Module R1 Challenger Report

> 模块: engine/offline | 轮次: R1 | 日期: 2026-05-01
> Challenger: v1.4 | P0模式库: v1.9 (23个模式)

## 审查方法

逐文件审查全部11个源文件（~3000行），按23个P0模式系统性扫描。
所有P0声称均附源码行号和复现场景。

---

## P0 缺陷清单

### P0-001: OfflineRewardSystem/OfflineSnapshotSystem serialize() 未被 engine-save 调用 — 存档数据丢失

- **模式**: 模式7(数据丢失) + 模式15(保存/加载流程缺失子系统)
- **严重度**: 🔴 架构级P0
- **源码位置**:
  - `OfflineRewardSystem.ts:379` — `serialize()` 方法存在
  - `OfflineSnapshotSystem.ts` — `getSaveData()` 方法存在
  - `engine-save.ts:146-220` — `buildSaveData()` 中无 `offlineReward`/`offlineSnapshot` 引用
- **复现场景**:
  1. 玩家使用加速道具、升级仓库、积累VIP翻倍次数
  2. 游戏调用 `buildSaveData()` 保存
  3. OfflineRewardSystem 的 boostInventory、warehouseLevels、vipDoubleUsedToday 全部丢失
  4. OfflineSnapshotSystem 的 lastOfflineTime、snapshot 全部丢失
  5. 下次加载时，离线收益计算从零开始，玩家损失所有离线进度
- **影响范围**: OfflineRewardSystem 全部状态（道具库存、仓库等级、VIP计数、经验等级）+ OfflineSnapshotSystem 全部状态（快照、离线时间）
- **关联规则**: BR-014(保存/加载覆盖扫描), BR-015(deserialize覆盖验证)

### P0-002: calculateSnapshot NaN 传播 — 全链路 NaN 感染

- **模式**: 模式2(数值溢出/非法值) + 模式9(NaN绕过数值检查)
- **严重度**: 🔴 P0
- **源码位置**: `OfflineRewardSystem.ts:113-145`
- **复现场景**:
  ```
  calculateSnapshot(NaN, rates)
  → offlineSeconds <= 0 ? NaN <= 0 → false (绕过空结果返回)
  → effectiveSeconds = Math.min(NaN, 259200) → NaN
  → effectiveHours = NaN / 3600 → NaN
  → tierSeconds = Math.min(NaN, tierEndSec) - tierStartSec → NaN
  → gain = productionRates[key] * NaN * tier.efficiency → NaN
  → totalEarned 全部变为 NaN
  ```
- **NaN传播路径**: calculateSnapshot → calculateFullReward → generateReturnPanel → 面板显示NaN
- **影响**: 玩家看到NaN收益，VIP加成/系统修正/溢出截断全部失效

### P0-003: calculateSnapshot Infinity 绕过封顶

- **模式**: 模式2(数值溢出/非法值)
- **严重度**: 🟡 P0（低概率但后果严重）
- **源码位置**: `OfflineRewardSystem.ts:121-122`
- **复现场景**:
  ```
  calculateSnapshot(Infinity, rates)
  → capped = Infinity > 259200 → true
  → effectiveSeconds = Math.min(Infinity, 259200) → 259200 ✓ (封顶有效)
  ```
  Infinity 在 Math.min 下被正确封顶，但 `offlineSeconds` 字段仍为 Infinity，序列化时 `JSON.stringify(Infinity)` → `null`，反序列化后变为 null → 崩溃
- **影响**: 序列化/反序列化链路断裂

### P0-004: applyDouble NaN 倍率导致收益变为 NaN

- **模式**: 模式2(数值溢出) + 模式9(NaN绕过)
- **严重度**: 🔴 P0
- **源码位置**: `OfflineRewardSystem.ts:155-165`
- **复现场景**:
  ```
  applyDouble(earned, { source: 'ad', multiplier: NaN, description: '' })
  → multiplier = NaN (无验证)
  → doubledEarned = mulRes(earned, NaN) → 全部NaN
  → success: true, appliedMultiplier: NaN
  ```
- **影响**: 翻倍后收益全部为NaN，后续VIP加成/系统修正全部失效

### P0-005: addBoostItem NaN 绕过 <= 0 检查

- **模式**: 模式9(NaN绕过 <= 0 检查)
- **严重度**: 🟡 P0
- **源码位置**: `OfflineRewardSystem.ts:217`
- **复现场景**:
  ```
  addBoostItem('offline_boost_1h', NaN)
  → count <= 0 ? NaN <= 0 → false (绕过检查)
  → boostInventory.set(id, (0 ?? 0) + NaN) → NaN
  → 后续 useBoostItemAction 检查 count <= 0 时 NaN <= 0 → false (绕过)
  → 道具数量变为NaN，可无限使用
  ```
- **影响**: NaN道具数量导致无限使用道具

### P0-006: deserialize(null) 崩溃

- **模式**: 模式1(null/undefined防护缺失)
- **严重度**: 🔴 P0
- **源码位置**: `OfflineRewardSystem.ts:387-394`
- **复现场景**:
  ```
  deserialize(null)
  → data.lastOfflineTime → TypeError: Cannot read properties of null
  ```
- **影响**: 存档损坏时游戏崩溃

### P0-007: claimReward(reward) 访问 reward.cappedEarned 无null检查

- **模式**: 模式1(null/undefined防护缺失)
- **严重度**: 🟡 P0
- **源码位置**: `OfflineRewardSystem.ts:371-374`
- **复现场景**:
  ```
  claimReward(null)
  → this.rewardClaimed → false
  → return cloneRes(null.cappedEarned) → TypeError
  ```
- **影响**: 传入null时崩溃

### P0-008: calculateOfflineExp NaN 经验加成传播

- **模式**: 模式2(NaN传播) + 模式9(NaN绕过)
- **严重度**: 🟡 P0
- **源码位置**: `OfflineRewardSystem.ts:575-600`
- **复现场景**:
  ```
  calculateOfflineExp(3600, NaN)
  → cappedBonus = Math.min(NaN, 1.0) → NaN
  → bonusExp = Math.floor(decayedExp * NaN) → NaN
  → finalExp = decayedExp + NaN → NaN
  → totalExp = currentExp + NaN → NaN
  → totalExp < levelConfig.expRequired → NaN < N → false (永远不升级)
  → 但 finalExp = NaN 会被返回
  ```
- **影响**: NaN经验值传播到上层

### P0-009: calculateSiegeResult 负兵力漏洞

- **模式**: 模式3(负值漏洞)
- **严重度**: 🟡 P0
- **源码位置**: `OfflineRewardSystem.ts:688-700`
- **复现场景**:
  ```
  calculateSiegeResult(-100, false)
  → lostTroops = Math.floor(-100 * 0.3) → -30
  → remainingTroops = -100 - (-30) → -70
  ```
- **影响**: 负数兵力/损失，可能导致后续计算异常

### P0-010: OfflineRewardEngine.applyDouble NaN multiplier

- **模式**: 模式2(NaN传播)
- **严重度**: 🟡 P0
- **源码位置**: `OfflineRewardEngine.ts:156-168`
- **复现场景**:
  ```
  applyDouble(earned, { source: 'ad', multiplier: NaN })
  → multiplier = NaN ?? 2 → NaN (??不处理NaN)
  → floorRes(mulRes(earned, NaN)) → 全部NaN
  → success: true
  ```
- **影响**: 与P0-004对称，OfflineRewardEngine侧同样无NaN防护

### P0-011: OfflineSnapshotSystem.expandWarehouse 不修改实际状态

- **模式**: 模式5(状态泄漏) — 函数式计算但不更新传入对象
- **严重度**: 🟡 P0 (逻辑错误)
- **源码位置**: `OfflineSnapshotSystem.ts:219-244`
- **复现场景**:
  ```
  expandWarehouse('grain')
  → expansion = DEFAULT_WAREHOUSE_EXPANSIONS[0] (const!)
  → expansion.currentLevel >= expansion.maxLevel → 检查的是配置常量的currentLevel
  → newLevel = expansion.currentLevel + 1 → 但这是只读配置，不会持久化
  → 返回 { success: true, newCapacity, newLevel } 但实际仓库等级未改变
  ```
  对比 OfflineRewardSystem.upgradeWarehouse() 使用 `this.warehouseLevels` Map 持久化状态。
  OfflineSnapshotSystem 的 expandWarehouse 是纯计算，不修改任何状态，但返回 success:true 给调用者造成"升级成功"的假象。
- **影响**: 调用方以为仓库已扩容但实际未扩容

### P0-012: OfflineRewardSystem.applyDouble VIP路径 getVipBonus() 无参数

- **模式**: 模式1(null/undefined防护) — 默认参数陷阱
- **严重度**: 🟡 P0
- **源码位置**: `OfflineRewardSystem.ts:159`
- **复现场景**:
  ```
  applyDouble(earned, { source: 'vip', multiplier: 2 })
  → const vipBonus = this.getVipBonus()  // 无参数！使用默认值0
  → this.vipDoubleUsedToday >= vipBonus.dailyDoubleLimit
  → VIP0的dailyDoubleLimit=1，但玩家可能是VIP5
  → 导致VIP5玩家只能使用1次翻倍而非5次
  ```
  `applyDouble` 方法签名 `applyDouble(earned, request)` 不接受 vipLevel 参数，
  内部调用 `this.getVipBonus()` 使用默认值0，始终按VIP0计算翻倍次数上限。
- **影响**: 所有VIP等级的玩家都按VIP0计算翻倍次数上限（每日1次），VIP5应为5次

---

## P1 缺陷清单

### P1-001: OfflinePanelHelper.estimateOfflineReward 未使用传入的 _calculateSnapshot 参数

- **源码位置**: `OfflinePanelHelper.ts:155`
- **说明**: 参数 `_calculateSnapshot` 被声明但未使用，OfflineRewardEngine.estimateOfflineReward 传入 `calculateOfflineSnapshot` 但被忽略。功能上不影响正确性（内部重复实现了相同逻辑），但违反DRY原则。

### P1-002: OfflineRewardSystem 内部 formatOfflineTime 与 OfflinePanelHelper.formatOfflineDuration 重复

- **源码位置**: `OfflineRewardSystem.ts:53-64` vs `OfflinePanelHelper.ts:39-55`
- **说明**: 两处完全相同的格式化函数，违反DRY原则

### P1-003: OfflineTradeAndBoost.useBoostItem 不验证 productionRates null

- **源码位置**: `OfflineTradeAndBoost.ts:72`
- **说明**: productionRates 为 null 时崩溃

### P1-004: OfflineSnapshotSystem.useBoostItem 不修改传入的 items 数组

- **源码位置**: `OfflineSnapshotSystem.ts:186-210`
- **说明**: 返回 remainingCount = item.count - 1 但不修改 items 数组本身，下次调用仍是原数量

### P1-005: OfflineRewardSystem.calculateOfflineExp 经验溢出无上限

- **源码位置**: `OfflineRewardSystem.ts:600-612`
- **说明**: while循环中 `totalExp -= levelConfig.expRequired` 无上限保护，如果EXP_LEVEL_TABLE数据异常可能导致死循环

---

## 统计

| 级别 | 数量 | 模式分布 |
|------|------|----------|
| P0 | 12 | 模式1:2, 模式2:4, 模式3:1, 模式5:1, 模式7:1, 模式9:3, 模式15:1 |
| P1 | 5 | 模式1:1, 模式4:1, 模式14:1, DRY:2 |

## 虚报率评估

- P0-003 (Infinity): Infinity在Math.min下被正确封顶，但序列化问题真实存在 → 维持P0
- P0-011 (expandWarehouse): 函数设计为纯计算返回结果，但success:true误导 → 维持P0
- 其余P0均有明确复现场景和源码证据 → 虚报率预估: 0%

## 高风险P0排序

| 优先级 | P0 ID | 原因 |
|--------|-------|------|
| 1 | P0-001 | 架构级：全部离线数据丢失 |
| 2 | P0-002 | 系统级：NaN全链路感染 |
| 3 | P0-012 | 经济级：VIP翻倍次数计算错误 |
| 4 | P0-006 | 崩溃级：deserialize(null) |
| 5 | P0-004 | 经济级：NaN翻倍 |
| 6 | P0-005 | 经济级：NaN道具无限使用 |
| 7 | P0-007 | 崩溃级：claimReward(null) |
| 8 | P0-008 | 数值级：NaN经验 |
| 9 | P0-009 | 数值级：负兵力 |
| 10 | P0-010 | 数值级：Engine侧NaN |
| 11 | P0-003 | 序列化级：Infinity→null |
| 12 | P0-011 | 逻辑级：仓库假升级 |
