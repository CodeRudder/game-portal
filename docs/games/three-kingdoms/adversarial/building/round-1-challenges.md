# 建筑系统对抗式测试 — Round 1 挑战报告

> **角色**: TreeChallenger
> **模块**: building（建筑系统）
> **Round**: 1
> **日期**: 2026-05-01

---

## 挑战总览

| 维度 | 代号 | 发现遗漏数 | 严重等级 |
|------|------|-----------|---------|
| 正常流程 | F-Normal | 6 | 🔴 高 |
| 边界条件 | F-Boundary | 8 | 🔴 高 |
| 异常路径 | F-Error | 7 | 🔴 高 |
| 跨系统交互 | F-Cross | 5 | 🟡 中 |
| 状态转换 | F-State | 6 | 🔴 高 |
| **合计** | — | **32** | — |

---

## F-Normal: 正常流程遗漏

### N-01: 完整升级生命周期流程未串联
**严重度**: P0
**描述**: 流程树将checkUpgrade、startUpgrade、tick拆为独立节点，但未枚举"检查→启动→等待→完成"的完整生命周期串联流程。这是一个端到端的核心用户路径。
**遗漏**: 需要一个从checkUpgrade通过→startUpgrade→tick定时→升级完成的完整流程节点。

### N-02: 主城升级解锁链路未完整覆盖
**严重度**: P0
**描述**: 8种建筑的解锁等级分别为0/0/2/2/3/3/4/5，但流程树只泛化描述了"主城升级后解锁"，未枚举每个解锁阈值的具体触发场景：
- 主城Lv2→解锁market+barracks（同时解锁2个建筑）
- 主城Lv3→解锁smithy+academy（同时解锁2个建筑）
- 主城Lv4→解锁clinic
- 主城Lv5→解锁wall

### N-03: 队列满时升级流程缺失
**严重度**: P0
**描述**: 当队列已满（如主城Lv1-5时只有1个槽位），尝试startUpgrade应被checkUpgrade拦截。但流程树未明确描述"队列满→尝试升级→被拒绝"的完整流程。

### N-04: 批量升级资源递减计算流程
**严重度**: P1
**描述**: batchUpgrade中资源是递减的——第一个建筑扣减后，第二个建筑用的是剩余资源。流程树未描述"第一个建筑成功消耗大量资源→第二个建筑因剩余资源不足而失败"的典型场景。

### N-05: 推荐系统与实际升级的联动
**严重度**: P2
**描述**: recommendUpgradePath返回推荐列表后，用户按推荐执行升级，流程树未覆盖"获取推荐→逐一执行升级"的完整使用流程。

### N-06: deserialize后状态一致性验证
**严重度**: P1
**描述**: deserialize恢复数据后，应验证恢复后的状态与序列化前一致。流程树未覆盖"serialize→deserialize→验证数据一致性"的往返测试流程。

---

## F-Boundary: 边界条件遗漏

### B-01: 建筑等级为0时的操作边界
**严重度**: P0
**描述**: locked建筑level=0，此时调用getUpgradeCost返回null、getProduction返回0。但流程树未覆盖：
- level=0时调用getAppearanceStage(0)的返回值（应为'humble'）
- level=0时getWallDefense()返回0（已覆盖）
- level=0时getProduction(type, 0)返回0（已覆盖）

### B-02: 主城等级刚好等于解锁等级的精确触发
**严重度**: P0
**描述**: checkUnlock在主城等级**等于**解锁等级时返回true。需验证边界：主城Lv1时market（需Lv2）应不可解锁；主城Lv2时market刚好可解锁。

### B-03: 队列槽位边界值
**严重度**: P0
**描述**: getMaxQueueSlots在主城Lv5时返回1，Lv6时返回2。流程树未覆盖主城Lv5→6时队列从1→2的扩容边界：
- 主城Lv5时队列有1个升级→升级主城到Lv6→队列应变为2个槽位
- 此时能否立即添加第二个升级？

### B-04: 升级费用刚好等于持有资源
**严重度**: P1
**描述**: 资源检查使用`<`比较（`resources.grain < cost.grain`），意味着资源**等于**费用时可以通过。需验证：grain=200, cost.grain=200时能否正常升级。

### B-05: 升级费用差1时被拒绝
**严重度**: P1
**描述**: grain=199, cost.grain=200时应被拒绝。需验证精确的边界拒绝。

### B-06: 取消退款的Math.round精度
**严重度**: P1
**描述**: cancelUpgrade使用Math.round(cost.grain * 0.8)计算退款。对于奇数费用值，需验证四舍五入的正确性：
- cost.grain=201 → refund=Math.round(160.8)=161
- cost.grain=1 → refund=Math.round(0.8)=1（几乎全额退款）

### B-07: getUpgradeProgress的total<=0边界
**严重度**: P1
**描述**: 代码中有`total <= 0 ? 1 : ...`，当endTime===startTime时（timeSeconds=0的升级），进度直接返回1。流程树未覆盖timeSeconds=0的升级场景。

### B-08: levelTable越界访问
**严重度**: P1
**描述**: getProduction使用`levelTable[lv-1]`，如果level超过levelTable数组长度，`data`为undefined，返回0。需验证：主城Lv30（maxLevel）时getProduction是否正确返回最后一个值。

---

## F-Error: 异常路径遗漏

### E-01: startUpgrade传入无效BuildingType
**严重度**: P1
**描述**: 如果传入不存在的BuildingType（如'tower'），`this.buildings[type]`为undefined，后续访问.level会抛TypeError。流程树未覆盖非法type输入。

### E-02: startUpgrade资源为null/undefined
**严重度**: P1
**描述**: startUpgrade的resources参数如果为null，checkUpgrade中resources检查被跳过（`if (resources && ...)`），但后续getUpgradeCost和返回值处理可能正常。需验证resources=null时的行为。

### E-03: cancelUpgrade时getUpgradeCost返回null
**严重度**: P0
**描述**: cancelUpgrade中调用`this.getUpgradeCost(type)`，如果建筑level=0（理论上不会是upgrading，但数据可能损坏），getUpgradeCost返回null，后续`Math.round(null.grain * 0.8)`会抛TypeError。

### E-04: deserialize传入空对象
**严重度**: P1
**描述**: 如果传入`{version: 1, buildings: {}}`，所有建筑都不会被恢复，但upgradeQueue重建和checkAndUnlockBuildings仍会执行。系统状态可能不一致。

### E-05: deserialize传入部分建筑数据
**严重度**: P1
**描述**: 如果buildings中只有castle的数据，其他建筑不会被恢复，保持构造时的初始状态。这可能导致已解锁的建筑回退到locked。

### E-06: tick在非upgrading建筑上的安全性
**严重度**: P2
**描述**: tick()遍历upgradeQueue，如果队列中有一个slot但对应建筑的status已被外部改为非upgrading（如通过直接修改buildings对象），升级仍会执行level+1。

### E-07: batchUpgrade中startUpgrade抛异常
**严重度**: P1
**描述**: batchUpgrade中try-catch捕获了startUpgrade的异常，但此时checkUpgrade已通过。需验证：checkUpgrade通过但startUpgrade失败时，failed列表是否正确记录。

---

## F-Cross: 跨系统交互遗漏

### C-01: 建筑→资源系统：产出如何被资源系统消费
**严重度**: P0
**描述**: calculateTotalProduction()返回产出汇总，但流程树未描述资源系统如何调用此方法并应用主城加成乘数。需验证：资源系统调用calculateTotalProduction()→乘以getCastleBonusMultiplier()→更新资源池。

### C-02: 建筑→战斗系统：城墙城防值如何影响战斗
**严重度**: P1
**描述**: getWallDefense()和getWallDefenseBonus()是战斗系统的输入，但流程树未覆盖战斗系统读取这些值的交互。

### C-03: 建筑→科技系统：书院产出如何驱动科技研究
**严重度**: P1
**description**: 书院的production为techPoint/秒，但流程树未覆盖科技系统如何读取书院产出并消耗科技点。

### C-04: 建筑→武将系统：铁匠铺与装备强化
**严重度**: P2
**描述**: 铁匠铺产出材料/小时，但BuildingSystem中未直接暴露给武将/装备系统的接口。流程树未覆盖跨系统数据流。

### C-05: 主城升级→队列扩容的实时生效
**严重度**: P0
**描述**: 主城升级完成后，getMaxQueueSlots()的返回值应立即变化。流程树未覆盖"主城升级完成→tick返回castle→队列槽位从1变2→立即添加新升级"的时序。

---

## F-State: 状态转换遗漏

### S-01: 完整状态转换矩阵
**严重度**: P0
**描述**: 建筑有3种状态（locked/idle/upgrading），流程树未枚举所有合法状态转换：
- locked → idle（解锁）
- idle → upgrading（开始升级）
- upgrading → idle（升级完成或取消）
- ❌ locked → upgrading（非法，应被拦截）
- ❌ upgrading → locked（不应发生）
- ❌ idle → locked（不应发生）

### S-02: 同一建筑连续升级的状态转换
**严重度**: P0
**描述**: 建筑升级完成后立即再次升级的状态转换：idle→upgrading→idle→upgrading。流程树未覆盖"快速连续升级"场景。

### S-03: 取消升级后的状态恢复
**严重度**: P0
**描述**: cancelUpgrade后建筑回到idle，但level不变。流程树未验证"升级中取消→状态恢复idle→可立即再次升级"的流程。

### S-04: 多建筑同时升级的状态管理
**严重度**: P1
**描述**: 当队列有多个槽位时，可以同时升级多个建筑。流程树未覆盖"3个建筑同时upgrading→逐一完成→队列动态变化"的复杂状态。

### S-05: 满级建筑的状态稳定性
**严重度**: P1
**描述**: 建筑达到maxLevel后，状态应永久为idle。流程树未验证：
- 满级建筑checkUpgrade返回false
- 满级建筑getUpgradeCost返回null
- 满级建筑getProduction返回正确的最终值

### S-06: deserialize恢复upgrading状态后的tick行为
**严重度**: P0
**描述**: deserialize恢复了upgrading状态后，后续tick应正常处理。流程树未覆盖"deserialize恢复upgrading→tick推进→正常完成"的跨操作状态转换。

---

## 挑战总结

### 遗漏严重度分布

| 严重度 | 数量 | 说明 |
|--------|------|------|
| P0 | 14 | 核心流程缺失，必须补充 |
| P1 | 13 | 重要边界/异常，应补充 |
| P2 | 5 | 次要场景，建议补充 |

### 关键遗漏 TOP 5

1. **完整升级生命周期串联** (N-01) — 最核心的用户流程未端到端覆盖
2. **状态转换矩阵** (S-01) — 3状态×3状态的完整转换未枚举
3. **主城升级→队列扩容实时生效** (C-05) — 跨系统时序关键路径
4. **解锁链路的精确触发** (N-02) — 8种建筑的4个解锁阈值未逐一覆盖
5. **批量升级资源递减** (N-04) — 批量操作的核心资源管理逻辑

### API覆盖缺口评估

当前枚举覆盖了39个公开API中的39个（100%），但以下API的**分支路径**覆盖不足：
- `checkUpgrade()`: 缺少多条件同时失败的组合场景
- `tick()`: 缺少多建筑同时到期的处理
- `deserialize()`: 缺少数据损坏/不完整的恢复场景
- `batchUpgrade()`: 缺少资源递减导致的级联失败

### 建议补充方向

1. 增加端到端生命周期流程节点
2. 补充状态转换矩阵的完整枚举
3. 补充跨系统交互的数据流节点
4. 补充边界值的精确测试场景
5. 补充异常数据恢复的鲁棒性测试
