# 三国霸业 — 资源产消流程测试树

> 自动生成 | 基于源码逆向分析
> 源码版本: resource-config v2, copper-economy v1.3, material-economy v1.3
> 总节点数: 119 | P0: 42 | P1: 48 | P2: 29

---

## 目录

- [1. 粮草 grain — RES-GRAIN](#1-粮草-grain--res-grain)
- [2. 铜钱 gold — RES-GOLD](#2-铜钱-gold--res-gold)
- [3. 兵力 troops — RES-TROOPS](#3-兵力-troops--res-troops)
- [4. 天命 mandate — RES-MANDATE](#4-天命-mandate--res-mandate)
- [5. 科技点 techPoint — RES-TECH](#5-科技点-techpoint--res-tech)
- [6. 招贤令 recruitToken — RES-RECRUIT](#6-招贤令-recruittoken--res-recruit)
- [7. 技能书 skillBook — RES-SKILL](#7-技能书-skillbook--res-skill)
- [附录A: 跨资源交互矩阵](#附录a-跨资源交互矩阵)
- [附录B: 代码溯源映射](#附录b-代码溯源映射)

---

## 1. 粮草 grain — RES-GRAIN

> **资源属性**: 初始 500 | 产出速率 0.8/s (农田Lv1) | 上限 2000 (粮仓Lv1) | 保留量 10
> **代码溯源**: `ResourceSystem.ts` L137-177, `resource-config.ts` L21-56, `GRANARY_CAPACITY_TABLE`

### RES-GRAIN-001: 农田按时产出
- **资源类型**: grain
- **流程**: 产出
- **操作**: tick(1000ms) 触发农田产出，grain += 0.8 * 1 * 1.0 = 0.8
- **预期**: grain 从 500 增至 500.8，返回 actual = 0.8
- **优先级**: P0
- **状态**: covered
- **代码**: `ResourceSystem.tick()` → `addResource('grain', rate * deltaSec * multiplier)`

### RES-GRAIN-002: 农田产出受加成倍率
- **资源类型**: grain
- **流程**: 产出
- **操作**: tick(1000ms, { grainProduction: 1.5 }) 触发加成产出
- **预期**: grain += 0.8 * 1 * 1.5 = 1.2，验证 calculateBonusMultiplier 正确应用
- **优先级**: P1
- **状态**: covered
- **代码**: `resource-calculator.ts calculateBonusMultiplier()`

### RES-GRAIN-003: 产出达到上限截断
- **资源类型**: grain
- **流程**: 产出 → 边界
- **操作**: grain=1999.5, cap=2000, addResource('grain', 1.0)
- **预期**: grain = 2000, actual = 0.5, overflow = 0.5, 触发 `resource:overflow` 事件
- **优先级**: P0
- **状态**: covered
- **代码**: `ResourceSystem.addResource()` L137-160, overflow 检测 L151-160

### RES-GRAIN-004: 产出溢出事件通知
- **资源类型**: grain
- **流程**: 产出 → 边界
- **操作**: grain=2000, cap=2000, addResource('grain', 100)
- **预期**: grain 不变=2000, actual=0, overflow=100, eventBus 收到 `resource:overflow` 事件含 { resourceType:'grain', requested:100, actual:0, overflow:100, cap:2000, current:2000 }
- **优先级**: P0
- **状态**: covered
- **代码**: `ResourceSystem.addResource()` L151-160

### RES-GRAIN-005: 任务奖励获得粮草
- **资源类型**: grain
- **流程**: 产出
- **操作**: 通过任务系统 addResource('grain', 200)
- **预期**: grain 增加 200，受上限截断
- **优先级**: P1
- **状态**: covered
- **代码**: `engine-campaign-deps.ts` L68, `campaign-chapter1.ts` baseRewards.grain

### RES-GRAIN-006: 攻城/远征奖励粮草
- **资源类型**: grain
- **流程**: 产出
- **操作**: 完成远征 easy 难度，获得 grain=200
- **预期**: grain += 200 (受上限约束)，远征奖励表 EASY: { grain:200, gold:400 }
- **优先级**: P1
- **状态**: covered
- **代码**: `expedition-config.ts` L63, `ExpeditionRewardSystem.ts` L140

### RES-GRAIN-007: 粮仓升级容量提升
- **资源类型**: grain
- **流程**: 边界
- **操作**: updateCaps(granaryLevel=5, barracksLevel=1)，粮仓从 Lv1→Lv5
- **预期**: cap.grain 从 2000 → 5000 (查 GRANARY_CAPACITY_TABLE)
- **优先级**: P0
- **状态**: covered
- **代码**: `ResourceSystem.updateCaps()` → `resource-calculator.lookupCap()`, GRANARY_CAPACITY_TABLE

### RES-GRAIN-008: 粮仓降级容量截断
- **资源类型**: grain
- **流程**: 边界
- **操作**: grain=4500, updateCaps(granaryLevel=3, barracksLevel=1)，cap 降至 3500
- **预期**: grain 被截断至 3500，enforceCaps() 执行
- **优先级**: P0
- **状态**: missing
- **代码**: `ResourceSystem.enforceCaps()` L317-323

### RES-GRAIN-009: 招募消耗粮草
- **资源类型**: grain
- **流程**: 消费
- **操作**: consumeResource('grain', 100)，当前 grain=500
- **预期**: grain = 500 - 100 = 400，返回 100
- **优先级**: P0
- **状态**: covered
- **代码**: `ResourceSystem.consumeResource()` L164-185

### RES-GRAIN-010: 粮草最低保留量保护
- **资源类型**: grain
- **流程**: 消费 → 边界
- **操作**: grain=50, consumeResource('grain', 45)
- **预期**: 抛出 Error "粮草不足：需要 45，可用 40（保留 10）"，grain 不变
- **优先级**: P0
- **状态**: covered
- **代码**: `ResourceSystem.consumeResource()` L170-178, MIN_GRAIN_RESERVE=10

### RES-GRAIN-011: 粮草恰好保留量边界
- **资源类型**: grain
- **流程**: 消费 → 边界
- **操作**: grain=60, consumeResource('grain', 50)
- **预期**: 成功，grain = 10 (恰好等于 MIN_GRAIN_RESERVE)
- **优先级**: P1
- **状态**: covered
- **代码**: `ResourceSystem.consumeResource()` L170-178

### RES-GRAIN-012: 粮草零值消费拒绝
- **资源类型**: grain
- **流程**: 消费 → 边界
- **操作**: grain=10, consumeResource('grain', 1)
- **预期**: 抛出 Error "粮草不足：需要 1，可用 0（保留 10）"
- **优先级**: P0
- **状态**: covered
- **代码**: `ResourceSystem.consumeResource()` L170-178

### RES-GRAIN-013: 粮草负值消费防护
- **资源类型**: grain
- **流程**: 消费 → 边界
- **操作**: consumeResource('grain', -50)
- **预期**: 返回 0，grain 不变（amount <= 0 直接返回 0）
- **优先级**: P1
- **状态**: covered
- **代码**: `ResourceSystem.consumeResource()` L165

### RES-GRAIN-014: 建筑升级消耗粮草
- **资源类型**: grain
- **流程**: 消费
- **操作**: 建筑升级消耗 cost.grain=200，通过 canAfford + consumeBatch
- **预期**: canAfford 检查 grain-200 >= MIN_GRAIN_RESERVE，consumeBatch 原子扣除
- **优先级**: P1
- **状态**: covered
- **代码**: `engine-building-ops.ts` L52-72, `ResourceSystem.consumeBatch()`

### RES-GRAIN-015: 建筑拆除退还粮草
- **资源类型**: grain
- **流程**: 转换（退还）
- **操作**: 拆除建筑，refund.grain=100，addResource('grain', 100)
- **预期**: grain 增加 100，受上限约束
- **优先级**: P2
- **状态**: covered
- **代码**: `engine-building-ops.ts` L70

### RES-GRAIN-016: 行军消耗粮草（远征出征）
- **资源类型**: grain
- **流程**: 消费
- **操作**: 远征出征消耗 grain（通过 expedition 系统扣除）
- **预期**: grain 减少对应消耗量
- **优先级**: P1
- **状态**: partial
- **代码**: `expedition-config.ts` 远征消耗配置

### RES-GRAIN-017: 离线收益粮草产出
- **资源类型**: grain
- **流程**: 产出
- **操作**: 离线 7200 秒，applyOfflineEarnings(7200)，grain 产出速率 0.8/s
- **预期**: 离线收益 grain = 0.8 * 7200 * 1.0 = 5760（受上限截断），效率 100%（0-2h 档）
- **优先级**: P0
- **状态**: covered
- **代码**: `OfflineEarningsCalculator.ts`, `ResourceSystem.applyOfflineEarnings()`

---

## 2. 铜钱 gold — RES-GOLD

> **资源属性**: 初始 300 | 被动产出 1.3/s | 上限 null（无上限）| 安全线 500
> **代码溯源**: `copper-economy-system.ts`, `resource-config.ts` L22-62

### RES-GOLD-001: 被动产出铜钱
- **资源类型**: gold
- **流程**: 产出
- **操作**: CopperEconomySystem.tick(1.0) 被动产出
- **预期**: gold += 1.3 * 1.0 = 1.3，无上限截断
- **优先级**: P0
- **状态**: covered
- **代码**: `copper-economy-system.ts` L139 tick()

### RES-GOLD-002: 日常任务铜钱奖励
- **资源类型**: gold
- **流程**: 产出
- **操作**: claimDailyTaskCopper()，首次领取
- **预期**: gold += 2000，dailyTaskClaimed = true，返回 2000
- **优先级**: P0
- **状态**: covered
- **代码**: `copper-economy-system.ts` L143-148

### RES-GOLD-003: 日常任务重复领取拒绝
- **资源类型**: gold
- **流程**: 产出 → 边界
- **操作**: claimDailyTaskCopper() 第二次调用（同一天）
- **预期**: 返回 0，gold 不变，dailyTaskClaimed 仍为 true
- **优先级**: P0
- **状态**: covered
- **代码**: `copper-economy-system.ts` L143-148

### RES-GOLD-004: 关卡通关铜钱奖励
- **资源类型**: gold
- **流程**: 产出
- **操作**: claimStageClearCopper(stageLevel=10)
- **预期**: gold += 100 + 10 * 20 = 300
- **优先级**: P0
- **状态**: covered
- **代码**: `copper-economy-system.ts` L151-155

### RES-GOLD-005: 关卡通关无效等级
- **资源类型**: gold
- **流程**: 产出 → 边界
- **操作**: claimStageClearCopper(stageLevel=0) 或 stageLevel=-1
- **预期**: 返回 0，gold 不变
- **优先级**: P1
- **状态**: covered
- **代码**: `copper-economy-system.ts` L151

### RES-GOLD-006: 商店购买招贤令
- **资源类型**: gold
- **流程**: 消费
- **操作**: purchaseItem('recruitToken', 1)，gold=5000
- **预期**: gold -= 100, recruitToken += 1, dailyShopPurchases['recruitToken']=1
- **优先级**: P0
- **状态**: covered
- **代码**: `copper-economy-system.ts` L158-172

### RES-GOLD-007: 商店每日限购检查
- **资源类型**: gold
- **流程**: 消费 → 边界
- **操作**: purchaseItem('recruitToken', 51)，招贤令每日限购 50
- **预期**: 返回 false，gold 不变
- **优先级**: P0
- **状态**: covered
- **代码**: `copper-economy-system.ts` L164-166

### RES-GOLD-008: 商店每日消费上限
- **资源类型**: gold
- **流程**: 消费 → 边界
- **操作**: 已购买 8900 铜钱商品，再购买 skillBook(3000)，累计超 9000
- **预期**: 返回 false，gold 不变（SHOP_DAILY_SPEND_LIMIT=9000）
- **优先级**: P0
- **状态**: covered
- **代码**: `copper-economy-system.ts` L168

### RES-GOLD-009: 铜钱安全线保护
- **资源类型**: gold
- **流程**: 消费 → 边界
- **操作**: gold=600, purchaseItem('recruitToken', 2) 需花费 200，600-200=400 < 500
- **预期**: 返回 false，gold 不变（低于 COPPER_SAFETY_LINE=500 保护）
- **优先级**: P0
- **状态**: covered
- **代码**: `copper-economy-system.ts` L169

### RES-GOLD-010: 武将升级消耗铜钱
- **资源类型**: gold
- **流程**: 消费
- **操作**: spendOnLevelUp('hero_001', level=15)
- **预期**: gold -= 15 * 50 = 750（查 LEVEL_GOLD_TABLE: 11-20 级 50/级）
- **优先级**: P0
- **状态**: covered
- **代码**: `copper-economy-system.ts` L175-177, LEVEL_GOLD_TABLE

### RES-GOLD-011: 武将升星消耗铜钱
- **资源类型**: gold
- **流程**: 消费
- **操作**: spendOnStarUp('hero_001', star=3)
- **预期**: gold -= 20000（查 STAR_UP_GOLD_COST[3]=20000）
- **优先级**: P0
- **状态**: covered
- **代码**: `copper-economy-system.ts` L181-183, STAR_UP_GOLD_COST

### RES-GOLD-012: 武将突破消耗铜钱
- **资源类型**: gold
- **流程**: 消费
- **操作**: spendOnBreakthrough('hero_001', stage=1)
- **预期**: gold -= 50000（查 BREAKTHROUGH_GOLD_COST[1]=50000）
- **优先级**: P1
- **状态**: covered
- **代码**: `copper-economy-system.ts` L187-189, BREAKTHROUGH_GOLD_COST

### RES-GOLD-013: 技能升级消耗铜钱
- **资源类型**: gold
- **流程**: 消费
- **操作**: spendOnSkillUpgrade('hero_001', skillLevel=2)
- **预期**: gold -= 1500（查 SKILL_UPGRADE_GOLD_TABLE[2]=1500）
- **优先级**: P1
- **状态**: covered
- **代码**: `copper-economy-system.ts` L193-195, SKILL_UPGRADE_GOLD_TABLE

### RES-GOLD-014: 铜钱零值拒绝消费
- **资源类型**: gold
- **流程**: 消费 → 边界
- **操作**: gold=0, consumeResource('gold', 1)
- **预期**: 抛出 Error "gold 资源不足：需要 1，当前 0"
- **优先级**: P0
- **状态**: covered
- **代码**: `ResourceSystem.consumeResource()` L181-185

### RES-GOLD-015: 铜钱大数值无上限累积
- **资源类型**: gold
- **流程**: 边界
- **操作**: addResource('gold', 999999999)，cap=null
- **预期**: gold 无截断，全额增加，无 overflow 事件
- **优先级**: P1
- **状态**: covered
- **代码**: `ResourceSystem.addResource()` L143 cap===null 分支

### RES-GOLD-016: 铜钱 NaN 防护
- **资源类型**: gold
- **流程**: 边界
- **操作**: 反序列化含 NaN 的 gold 值
- **预期**: 反序列化后 gold = Math.max(0, Number(NaN) || 0) = 0
- **优先级**: P1
- **状态**: covered
- **代码**: `ResourceSystem.deserialize()` L378-381

### RES-GOLD-017: 碎片转化铜钱（招募溢出）
- **资源类型**: gold
- **流程**: 转换
- **操作**: 招募重复武将，溢出碎片 * FRAGMENT_TO_GOLD_RATE 转化为 gold
- **预期**: gold += overflow * FRAGMENT_TO_GOLD_RATE
- **优先级**: P2
- **状态**: covered
- **代码**: `HeroRecruitSystem.ts` L379-380

---

## 3. 兵力 troops — RES-TROOPS

> **资源属性**: 初始 50 | 产出速率 0 (需兵营) | 上限 500 (兵营Lv1) | 无保留量
> **代码溯源**: `ResourceSystem.ts`, `BARRACKS_CAPACITY_TABLE`, `expedition-config.ts`

### RES-TROOPS-001: 兵营按时产出兵力
- **资源类型**: troops
- **流程**: 产出
- **操作**: 兵营建筑激活后，recalculateProduction 同步 troops 产出速率，tick 产出
- **预期**: troops 按兵营等级对应速率增长，受上限约束
- **优先级**: P0
- **状态**: covered
- **代码**: `ResourceSystem.recalculateProduction()` L259-283

### RES-TROOPS-002: 兵营升级容量提升
- **资源类型**: troops
- **流程**: 边界
- **操作**: updateCaps(granaryLevel=1, barracksLevel=10)，兵营 Lv10
- **预期**: cap.troops 从 500 → 3000 (查 BARRACKS_CAPACITY_TABLE)
- **优先级**: P0
- **状态**: covered
- **代码**: `ResourceSystem.updateCaps()` L296-305, BARRACKS_CAPACITY_TABLE

### RES-TROOPS-003: 兵营降级容量截断
- **资源类型**: troops
- **流程**: 边界
- **操作**: troops=2500, updateCaps(granaryLevel=1, barracksLevel=5)，cap 降至 1200
- **预期**: troops 被截断至 1200
- **优先级**: P0
- **状态**: missing
- **代码**: `ResourceSystem.enforceCaps()` L317-323

### RES-TROOPS-004: 兵力达到上限截断
- **资源类型**: troops
- **流程**: 产出 → 边界
- **操作**: troops=499, cap=500, addResource('troops', 10)
- **预期**: troops = 500, actual = 1, overflow = 9
- **优先级**: P0
- **状态**: covered
- **代码**: `ResourceSystem.addResource()` L137-160

### RES-TROOPS-005: 远征出征消耗兵力
- **资源类型**: troops
- **流程**: 消费
- **操作**: 远征出征 consumeResource('troops', armyCost)，当前 troops=300
- **预期**: troops -= armyCost，通用消耗路径（无保留量保护）
- **优先级**: P0
- **状态**: covered
- **代码**: `ExpeditionTeamHelper.ts` L205, `AutoExpeditionSystem.ts` L242

### RES-TROOPS-006: 远征兵力不足拒绝
- **资源类型**: troops
- **流程**: 消费 → 边界
- **操作**: troops=50, consumeResource('troops', 100)
- **预期**: 抛出 Error "troops 资源不足：需要 100，当前 50"
- **优先级**: P0
- **状态**: covered
- **代码**: `ResourceSystem.consumeResource()` L181-185

### RES-TROOPS-007: 挑战关卡消耗兵力
- **资源类型**: troops
- **流程**: 消费
- **操作**: ChallengeStageSystem 消耗 troops=config.armyCost
- **预期**: troops -= armyCost，若不足则拒绝并返回原因
- **优先级**: P1
- **状态**: covered
- **代码**: `ChallengeStageSystem.ts` L294, L325

### RES-TROOPS-008: 挑战关卡失败退还兵力
- **资源类型**: troops
- **流程**: 转换（退还）
- **操作**: 关卡失败后，addResource('troops', preLocked.army)
- **预期**: troops 恢复到锁定前数值
- **优先级**: P1
- **状态**: covered
- **代码**: `ChallengeStageSystem.ts` L397

### RES-TROOPS-009: 建筑升级消耗兵力
- **资源类型**: troops
- **流程**: 消费
- **操作**: 建筑升级 cost.troops=30，通过 consumeBatch 扣除
- **预期**: troops -= 30
- **优先级**: P1
- **状态**: covered
- **代码**: `engine-building-ops.ts` L54, L72

### RES-TROOPS-010: 建筑拆除退还兵力
- **资源类型**: troops
- **流程**: 转换（退还）
- **操作**: 拆除建筑 refund.troops=20，addResource('troops', 20)
- **预期**: troops += 20（受上限约束）
- **优先级**: P2
- **状态**: covered
- **代码**: `engine-building-ops.ts` L72

### RES-TROOPS-011: 兵力零值限制出征
- **资源类型**: troops
- **流程**: 消费 → 边界
- **操作**: troops=0, consumeResource('troops', 1)
- **预期**: 抛出 Error，远征/出征不可执行
- **优先级**: P0
- **状态**: covered
- **代码**: `ResourceSystem.consumeResource()` L181-185

### RES-TROOPS-012: 战斗损失兵力
- **资源类型**: troops
- **流程**: 消费
- **操作**: 战斗结算后根据战损比例扣除 troops
- **预期**: troops 按战损结果减少，不低于 0
- **优先级**: P1
- **状态**: partial
- **代码**: 远征/战斗结算系统

### RES-TROOPS-013: 征兵令增加兵力
- **资源类型**: troops
- **流程**: 产出
- **操作**: 使用征兵令道具，addResource('troops', 100)
- **预期**: troops += 100（受上限约束）
- **优先级**: P1
- **状态**: partial
- **代码**: 道具系统 → `ResourceSystem.addResource()`

### RES-TROOPS-014: 兵力上限容量警告
- **资源类型**: troops
- **流程**: 边界
- **操作**: troops=475, cap=500 (95%)，getCapWarning('troops')
- **预期**: 返回 { level:'urgent', percentage:0.95 }（95%~100% 紧急）
- **优先级**: P2
- **状态**: covered
- **代码**: `resource-calculator.ts calculateCapWarning()`, CAP_WARNING_THRESHOLDS

### RES-TROOPS-015: 兵营容量查表插值
- **资源类型**: troops
- **流程**: 边界
- **操作**: lookupCap(barracksLevel=7, 'barracks')，表中无 Lv7 精确值
- **预期**: 在 Lv5(1200) 和 Lv10(3000) 之间线性插值，返回合理中间值
- **优先级**: P2
- **状态**: covered
- **代码**: `resource-calculator.ts lookupCap()`

### RES-TROOPS-016: 离线收益兵力产出
- **资源类型**: troops
- **流程**: 产出
- **操作**: 离线 8 小时，兵营产出速率 0.1/s，applyOfflineEarnings(28800)
- **预期**: troops += 0.1 * 28800 * 0.6 = 1728（8-24h 档效率 60%），受上限截断
- **优先级**: P1
- **状态**: covered
- **代码**: `OfflineEarningsCalculator.ts`, OFFLINE_TIERS

---

## 4. 天命 mandate — RES-MANDATE

> **资源属性**: 初始 0 | 产出速率 0 | 上限 null（无上限）| 大额阈值 100
> **代码溯源**: `ChallengeStageSystem.ts`, `TechResearchSystem.ts`, `resource-config.ts` MANDATE_CONFIRM_THRESHOLD=100

### RES-MANDATE-001: 攻城占领获得天命
- **资源类型**: mandate
- **流程**: 产出
- **操作**: 攻城成功，addResource('mandate', 50)
- **预期**: mandate += 50，无上限
- **优先级**: P0
- **状态**: partial
- **代码**: 攻城系统 → `ResourceSystem.addResource()`

### RES-MANDATE-002: 特殊事件获得天命
- **资源类型**: mandate
- **流程**: 产出
- **操作**: 触发特殊事件（如名望提升），addResource('mandate', 20)
- **预期**: mandate += 20
- **优先级**: P1
- **状态**: partial
- **代码**: 事件系统 → `ResourceSystem.addResource()`

### RES-MANDATE-003: 挑战关卡消耗天命（体力替代）
- **资源类型**: mandate
- **流程**: 消费
- **操作**: ChallengeStageSystem consumeResource('mandate', config.staminaCost)
- **预期**: mandate -= staminaCost，不足时拒绝并返回原因
- **优先级**: P0
- **状态**: covered
- **代码**: `ChallengeStageSystem.ts` L299-302, L326

### RES-MANDATE-004: 挑战关卡天命不足拒绝
- **资源类型**: mandate
- **流程**: 消费 → 边界
- **操作**: mandate=5, staminaCost=10
- **预期**: 返回失败原因 "天命不足（需要10，当前5）"，mandate 不变
- **优先级**: P0
- **状态**: covered
- **代码**: `ChallengeStageSystem.ts` L301-302

### RES-MANDATE-005: 关卡失败退还天命
- **资源类型**: mandate
- **流程**: 转换（退还）
- **操作**: 关卡失败后 addResource('mandate', preLocked.stamina)
- **预期**: mandate 恢复到锁定前数值
- **优先级**: P1
- **状态**: covered
- **代码**: `ChallengeStageSystem.ts` L398

### RES-MANDATE-006: 科技加速消耗天命
- **资源类型**: mandate
- **流程**: 消费
- **操作**: TechResearchSystem 天命加速研究，consumeMandate(cost)
- **预期**: mandate -= cost，不足时返回 { success:false, reason:'天命不足' }
- **优先级**: P0
- **状态**: covered
- **代码**: `TechResearchSystem.ts` L229-250

### RES-MANDATE-007: 天命加速完成计算
- **资源类型**: mandate
- **流程**: 消费
- **操作**: calculateMandateCost(remainingSeconds=300)，计算加速完成所需天命
- **预期**: 返回精确天命消耗量
- **优先级**: P1
- **状态**: covered
- **代码**: `TechResearchSystem.ts` L300

### RES-MANDATE-008: 天命大额消耗确认（>100）
- **资源类型**: mandate
- **流程**: 边界
- **操作**: 消耗天命 150，超过 MANDATE_CONFIRM_THRESHOLD=100
- **预期**: UI 层触发二次确认弹窗（业务逻辑层正常扣除）
- **优先级**: P1
- **状态**: partial
- **代码**: `resource-config.ts` MANDATE_CONFIRM_THRESHOLD=100

### RES-MANDATE-009: 天命零值消费拒绝
- **资源类型**: mandate
- **流程**: 消费 → 边界
- **操作**: mandate=0, consumeResource('mandate', 1)
- **预期**: 抛出 Error "mandate 资源不足：需要 1，当前 0"
- **优先级**: P0
- **状态**: covered
- **代码**: `ResourceSystem.consumeResource()` L181-185

### RES-MANDATE-010: 天命无上限累积
- **资源类型**: mandate
- **流程**: 边界
- **操作**: addResource('mandate', 99999)，cap=null
- **预期**: mandate 全额增加，无 overflow 事件
- **优先级**: P1
- **状态**: covered
- **代码**: `ResourceSystem.addResource()` L143

### RES-MANDATE-011: 科技效果天命获取加成
- **资源类型**: mandate
- **流程**: 产出
- **操作**: 融合科技 "名将传承" 激活，天命获取+15%
- **预期**: 天命产出/获取量乘以 1.15 倍率
- **优先级**: P2
- **状态**: partial
- **代码**: `FusionLinkManager.ts` L42, `TechEffectApplier.ts`

### RES-MANDATE-012: 天命部分消耗+退还原子性
- **资源类型**: mandate
- **流程**: 消费 → 转换
- **操作**: 挑战关卡消耗 troops+mandate，mandate 扣除成功但 troops 不足
- **预期**: mandate 被退还（addResource 恢复），保持原子性
- **优先级**: P0
- **状态**: covered
- **代码**: `ChallengeStageSystem.ts` L328-331

### RES-MANDATE-013: 离线收益天命产出
- **资源类型**: mandate
- **流程**: 产出
- **操作**: 离线期间天命有产出速率时，applyOfflineEarnings
- **预期**: mandate 按效率衰减表累积
- **优先级**: P2
- **状态**: covered
- **代码**: `OfflineEarningsCalculator.ts`

### RES-MANDATE-014: 天命负值防护
- **资源类型**: mandate
- **流程**: 边界
- **操作**: consumeResource('mandate', -10)
- **预期**: 返回 0，mandate 不变
- **优先级**: P1
- **状态**: covered
- **代码**: `ResourceSystem.consumeResource()` L165

### RES-MANDATE-015: 高级功能解锁消耗天命
- **资源类型**: mandate
- **流程**: 消费
- **操作**: 解锁高级功能（如高级科技树），消耗天命
- **预期**: mandate 减少，功能解锁状态变更
- **优先级**: P1
- **状态**: partial
- **代码**: 各功能系统 → `ResourceSystem.consumeResource()`

---

## 5. 科技点 techPoint — RES-TECH

> **资源属性**: 初始 0 | 产出速率 0 (需书院) | 上限 null | 独立管理（TechPointSystem）
> **代码溯源**: `TechPointSystem.ts`, `TechResearchSystem.ts`

### RES-TECH-001: 书院按时产出科技点
- **资源类型**: techPoint
- **流程**: 产出
- **操作**: TechPointSystem.tick()，书院建筑激活后产出
- **预期**: techPoint 按书院等级对应速率增长
- **优先级**: P0
- **状态**: covered
- **代码**: `TechPointSystem.ts` L47-48

### RES-TECH-002: 任务奖励科技点
- **资源类型**: techPoint
- **流程**: 产出
- **操作**: TechPointSystem.addPoints(50)
- **预期**: techPoint.current += 50, totalEarned += 50
- **优先级**: P0
- **状态**: covered
- **代码**: `TechPointSystem.ts` L47-48

### RES-TECH-003: 科技研究消耗科技点
- **资源类型**: techPoint
- **流程**: 消费
- **操作**: TechPointSystem.spendPoints(30)，当前 techPoint.current=50
- **预期**: techPoint.current = 20, totalSpent += 30
- **优先级**: P0
- **状态**: covered
- **代码**: `TechPointSystem.ts` L97-100

### RES-TECH-004: 科技点不足拒绝研究
- **资源类型**: techPoint
- **流程**: 消费 → 边界
- **操作**: spendPoints(100)，当前 techPoint.current=50
- **预期**: 返回 { success:false, reason:'科技点不足：需要 100，当前 50' }
- **优先级**: P0
- **状态**: covered
- **代码**: `TechPointSystem.ts` L115

### RES-TECH-005: 科技点恰好等于消耗
- **资源类型**: techPoint
- **流程**: 消费 → 边界
- **操作**: spendPoints(50)，当前 techPoint.current=50
- **预期**: techPoint.current = 0, totalSpent += 50
- **优先级**: P1
- **状态**: covered
- **代码**: `TechPointSystem.ts` L97-100

### RES-TECH-006: 研究队列占用检查
- **资源类型**: techPoint
- **流程**: 边界
- **操作**: 已有研究在进行中，尝试启动新研究
- **预期**: 研究队列已满时拒绝（取决于队列容量配置）
- **优先级**: P1
- **状态**: partial
- **代码**: `TechResearchSystem.ts` 研究队列管理

### RES-TECH-007: 科技点退还（取消研究）
- **资源类型**: techPoint
- **流程**: 转换（退还）
- **操作**: TechPointSystem.refundPoints(30)，取消研究退还
- **预期**: techPoint.current += 30, Math.max(0, current) 防负
- **优先级**: P1
- **状态**: covered
- **代码**: `TechPointSystem.ts` L105-107

### RES-TECH-008: 科技点负值防护
- **资源类型**: techPoint
- **流程**: 边界
- **操作**: refundPoints(-10)
- **预期**: techPoint.current += (-10)，然后 Math.max(0, current) 保护
- **优先级**: P1
- **状态**: covered
- **代码**: `TechPointSystem.ts` L107

### RES-TECH-009: 科技点序列化/反序列化
- **资源类型**: techPoint
- **流程**: 边界
- **操作**: serialize() → deserialize()，验证数据完整性
- **预期**: techPoint.current/totalEarned/totalSpent 完整恢复
- **优先级**: P2
- **状态**: covered
- **代码**: `TechPointSystem.ts` L184-197

### RES-TECH-010: 科技点重置
- **资源类型**: techPoint
- **流程**: 边界
- **操作**: TechPointSystem.reset()
- **预期**: techPoint = { current:0, totalEarned:0, totalSpent:0 }
- **优先级**: P2
- **状态**: covered
- **代码**: `TechPointSystem.ts` L56

### RES-TECH-011: 科技效果产出加成
- **资源类型**: techPoint
- **流程**: 产出
- **操作**: 科技树 "兴学令" 激活，科技点获取+10%
- **预期**: 科技点产出速率乘以 1.1 倍率
- **优先级**: P2
- **状态**: partial
- **代码**: `TechEffectApplier.ts` L179-216

### RES-TECH-012: hasEnough 检查
- **资源类型**: techPoint
- **流程**: 边界
- **操作**: hasEnough(30)，当前 techPoint.current=50
- **预期**: 返回 true
- **优先级**: P1
- **状态**: covered
- **代码**: `TechPointSystem.ts` L92

### RES-TECH-013: 离线收益科技点
- **资源类型**: techPoint
- **流程**: 产出
- **操作**: 离线期间书院有产出时，applyOfflineEarnings
- **预期**: techPoint 按效率衰减累积
- **优先级**: P2
- **状态**: covered
- **代码**: `OfflineEarningsCalculator.ts`

### RES-TECH-014: getCurrentPoints 查询
- **资源类型**: techPoint
- **流程**: 边界
- **操作**: getCurrentPoints()
- **预期**: 返回 techPoint.current 的精确数值
- **优先级**: P2
- **状态**: covered
- **代码**: `TechPointSystem.ts` L128

### RES-TECH-015: 资源系统同步科技点产出
- **资源类型**: techPoint
- **流程**: 产出
- **操作**: recalculateProduction({ techPoint: 0.5 })，tick 产出
- **预期**: 资源系统 techPoint 产出速率更新为 0.5/s
- **优先级**: P1
- **状态**: covered
- **代码**: `ResourceSystem.recalculateProduction()` L259-283

### RES-TECH-016: getTotalEarned 统计
- **资源类型**: techPoint
- **流程**: 边界
- **操作**: 多次 addPoints + spendPoints 后 getTotalEarned()
- **预期**: 返回累计获得总量（不因消费减少）
- **优先级**: P2
- **状态**: covered
- **代码**: `TechPointSystem.ts` L133

---

## 6. 招贤令 recruitToken — RES-RECRUIT

> **资源属性**: 初始 30 | 被动产出 0.01/s | 上限 null | VIP 加成
> **代码溯源**: `HeroRecruitSystem.ts`, `hero-recruit-config.ts`, `resource-config.ts` L26-46

### RES-RECRUIT-001: 被动产出招贤令
- **资源类型**: recruitToken
- **流程**: 产出
- **操作**: tick(100000ms)，被动产出 0.01/s
- **预期**: recruitToken += 0.01 * 100 = 1.0（约 100 秒产 1 个）
- **优先级**: P0
- **状态**: covered
- **代码**: `resource-config.ts` L46, `ResourceSystem.tick()`

### RES-RECRUIT-002: 被动产出不受 recalculateProduction 覆盖
- **资源类型**: recruitToken
- **流程**: 产出 → 边界
- **操作**: recalculateProduction({ recruitToken: 0 })，被动产出应保留
- **预期**: recruitToken 产出速率仍为 0 + 0.01 = 0.01/s（保留基础被动产出）
- **优先级**: P0
- **状态**: covered
- **代码**: `ResourceSystem.recalculateProduction()` L277

### RES-RECRUIT-003: 单次招募消耗招贤令
- **资源类型**: recruitToken
- **流程**: 消费
- **操作**: 单抽 recruit(type='single')，RECRUIT_COSTS.single = { resourceType:'recruitToken', amount:1 }
- **预期**: recruitToken -= 1
- **优先级**: P0
- **状态**: covered
- **代码**: `HeroRecruitSystem.ts` L305, `hero-recruit-config.ts` L38-40

### RES-RECRUIT-004: 十连招募消耗招贤令
- **资源类型**: recruitToken
- **流程**: 消费
- **操作**: 十连 recruit(type='ten')，RECRUIT_COSTS.ten = { resourceType:'recruitToken', amount:10 }
- **预期**: recruitToken -= 10（含折扣 TEN_PULL_DISCOUNT）
- **优先级**: P0
- **状态**: covered
- **代码**: `HeroRecruitSystem.ts` L305, `hero-recruit-config.ts` L42-45

### RES-RECRUIT-005: 招贤令不足拒绝招募
- **资源类型**: recruitToken
- **流程**: 消费 → 边界
- **操作**: recruitToken=0, recruit(type='single')
- **预期**: canAffordResource 返回 false，招募失败
- **优先级**: P0
- **状态**: covered
- **代码**: `HeroRecruitSystem.ts` L305

### RES-RECRUIT-006: 任务奖励招贤令
- **资源类型**: recruitToken
- **流程**: 产出
- **操作**: 首通大关卡奖励 recruitToken=10
- **预期**: recruitToken += 10
- **优先级**: P1
- **状态**: covered
- **代码**: `campaign-chapter1.ts` L39 firstClearRewards.recruitToken=10

### RES-RECRUIT-007: 商店购买招贤令
- **资源类型**: recruitToken
- **流程**: 转换（gold → recruitToken）
- **操作**: purchaseItem('recruitToken', 5)，gold=5000，单价 100
- **预期**: gold -= 500, recruitToken += 5
- **优先级**: P0
- **状态**: covered
- **代码**: `copper-economy-system.ts` L158-172

### RES-RECRUIT-008: 商店招贤令每日限购50
- **资源类型**: recruitToken
- **流程**: 转换 → 边界
- **操作**: purchaseItem('recruitToken', 51)
- **预期**: 返回 false，超过每日限购 50
- **优先级**: P0
- **状态**: covered
- **代码**: `copper-economy-system.ts` L164-166, SHOP_ITEMS.recruitToken.dailyLimit=50

### RES-RECRUIT-009: VIP 额外招贤令产出
- **资源类型**: recruitToken
- **流程**: 产出
- **操作**: VIP 等级加成，被动产出速率提升
- **预期**: recruitToken 产出速率 = 0.01 * (1 + vipBonus)
- **优先级**: P1
- **状态**: partial
- **代码**: VIP 系统 → `ResourceSystem.setProductionRate()`

### RES-RECRUIT-010: 招贤令无上限累积
- **资源类型**: recruitToken
- **流程**: 边界
- **操作**: addResource('recruitToken', 99999)，cap=null
- **预期**: recruitToken 全额增加，无 overflow 事件
- **优先级**: P1
- **状态**: covered
- **代码**: `ResourceSystem.addResource()` L143

### RES-RECRUIT-011: 招贤令零值消费拒绝
- **资源类型**: recruitToken
- **流程**: 消费 → 边界
- **操作**: recruitToken=0, consumeResource('recruitToken', 1)
- **预期**: 抛出 Error
- **优先级**: P0
- **状态**: covered
- **代码**: `ResourceSystem.consumeResource()` L181-185

### RES-RECRUIT-012: 离线收益招贤令累积
- **资源类型**: recruitToken
- **流程**: 产出
- **操作**: 离线 28800 秒（8h），applyOfflineEarnings，被动 0.01/s
- **预期**: recruitToken += 0.01 * 28800 * 0.6 = 172.8（8-24h 档 60% 效率）
- **优先级**: P1
- **状态**: covered
- **代码**: `OfflineEarningsCalculator.ts`

### RES-RECRUIT-013: 免费招募（每日免费次数）
- **资源类型**: recruitToken
- **流程**: 消费 → 边界
- **操作**: 使用每日免费招募次数，不消耗 recruitToken
- **预期**: recruitToken 不变，freeRecruit 计数+1
- **优先级**: P1
- **状态**: covered
- **代码**: `HeroRecruitSystem.ts` freeRecruit 逻辑, `hero-recruit-config.ts` DAILY_FREE_CONFIG

### RES-RECRUIT-014: 招贤令负值防护
- **资源类型**: recruitToken
- **流程**: 边界
- **操作**: consumeResource('recruitToken', -5)
- **预期**: 返回 0，recruitToken 不变
- **优先级**: P1
- **状态**: covered
- **代码**: `ResourceSystem.consumeResource()` L165

### RES-RECRUIT-015: 招贤令小数累积精度
- **资源类型**: recruitToken
- **流程**: 边界
- **操作**: 多次 tick 累积小数（0.01 * 50 次），验证 recruitToken 精度
- **预期**: recruitToken = 0.5，无浮点精度丢失导致的异常
- **优先级**: P2
- **状态**: covered
- **代码**: `ResourceSystem.tick()` 浮点累积

### RES-RECRUIT-016: 招贤令反序列化校验
- **资源类型**: recruitToken
- **流程**: 边界
- **操作**: 反序列化含 NaN/undefined 的 recruitToken
- **预期**: recruitToken = Math.max(0, Number(NaN) || 0) = 0
- **优先级**: P2
- **状态**: covered
- **代码**: `ResourceSystem.deserialize()` L378-381

### RES-RECRUIT-017: 招贤令初始值30验证
- **资源类型**: recruitToken
- **流程**: 边界
- **操作**: 新游戏初始化，getAmount('recruitToken')
- **预期**: recruitToken = 30（新手礼包）
- **优先级**: P1
- **状态**: covered
- **代码**: `resource-config.ts` L26 INITIAL_RESOURCES.recruitToken=30

---

## 7. 技能书 skillBook — RES-SKILL

> **资源属性**: 初始 0 | 产出速率 0 | 上限 null | 稀有度分级（初级/中级/高级）
> **代码溯源**: `SkillUpgradeSystem.ts`, `material-economy-system.ts`, `ExpeditionRewardSystem.ts`

### RES-SKILL-001: 日常任务获得技能书
- **资源类型**: skillBook
- **流程**: 产出
- **操作**: MaterialEconomySystem 领取日常任务技能书，DAILY_SKILL_BOOK_COUNT=2
- **预期**: skillBook += 2, dailySkillBookClaimed = true
- **优先级**: P0
- **状态**: covered
- **代码**: `material-economy-system.ts` L25, 日常任务领取逻辑

### RES-SKILL-002: 日常任务技能书重复领取拒绝
- **资源类型**: skillBook
- **流程**: 产出 → 边界
- **操作**: 同一天第二次领取日常任务技能书
- **预期**: 返回 0，skillBook 不变
- **优先级**: P0
- **状态**: covered
- **代码**: `material-economy-system.ts` dailySkillBookClaimed 检查

### RES-SKILL-003: 远征掉落技能书
- **资源类型**: skillBook
- **流程**: 产出
- **操作**: 远征完成，ExpeditionRewardSystem 掉落 skill_book
- **预期**: 根据难度掉落不同稀有度技能书（初级 2%, 中级 10%, 高级 20%）
- **优先级**: P0
- **状态**: covered
- **代码**: `ExpeditionRewardSystem.ts` L74-86, 掉落表

### RES-SKILL-004: 关卡首通获得技能书
- **资源类型**: skillBook
- **流程**: 产出
- **操作**: 首次通关关卡，MaterialEconomySystem 发放首通技能书
- **预期**: skillBook += 1, claimedFirstClearStages 记录
- **优先级**: P1
- **状态**: covered
- **代码**: `material-economy-system.ts` L40, claimedFirstClearStages

### RES-SKILL-005: 关卡首通技能书重复领取拒绝
- **资源类型**: skillBook
- **流程**: 产出 → 边界
- **操作**: 对同一关卡第二次领取首通技能书
- **预期**: 返回 0，skillBook 不变
- **优先级**: P1
- **状态**: covered
- **代码**: `material-economy-system.ts` claimedFirstClearStages 检查

### RES-SKILL-006: 活动奖励技能书
- **资源类型**: skillBook
- **流程**: 产出
- **操作**: 活动奖励 5~10 本技能书
- **预期**: skillBook += rewardAmount
- **优先级**: P1
- **状态**: partial
- **代码**: `material-economy-system.ts` 活动奖励逻辑

### RES-SKILL-007: 技能升级消耗技能书（Lv1→2）
- **资源类型**: skillBook
- **流程**: 消费
- **操作**: SkillUpgradeSystem 升级技能 Lv1→2，cost = { copper:500, skillBook:1 }
- **预期**: skillBook -= 1, gold -= 500
- **优先级**: P0
- **状态**: covered
- **代码**: `SkillUpgradeSystem.ts` L93-94, L230-237

### RES-SKILL-008: 技能升级消耗技能书（Lv3→4）
- **资源类型**: skillBook
- **流程**: 消费
- **操作**: 升级技能 Lv3→4，cost = { copper:4000, skillBook:2 }
- **预期**: skillBook -= 2, gold -= 4000
- **优先级**: P0
- **状态**: covered
- **代码**: `SkillUpgradeSystem.ts` L96-97

### RES-SKILL-009: 技能升级默认消耗（超表等级）
- **资源类型**: skillBook
- **流程**: 消费
- **操作**: 升级技能 Lv5（超出 SKILL_UPGRADE_COST_TABLE 范围）
- **预期**: 使用 DEFAULT_SKILL_UPGRADE_COST = { copper:10000, skillBook:2 }
- **优先级**: P1
- **状态**: covered
- **代码**: `SkillUpgradeSystem.ts` L100

### RES-SKILL-010: 技能书不足拒绝升级
- **资源类型**: skillBook
- **流程**: 消费 → 边界
- **操作**: skillBook=0, 尝试升级技能（需要 1 本）
- **预期**: materials.skillBooks < cost.skillBooks，返回失败
- **优先级**: P0
- **状态**: covered
- **代码**: `SkillUpgradeSystem.ts` L220

### RES-SKILL-011: 商店购买技能书
- **资源类型**: skillBook
- **流程**: 转换（gold → skillBook）
- **操作**: purchaseItem('skillBook', 1)，gold=5000，单价 3000
- **预期**: gold -= 3000, skillBook += 1
- **优先级**: P1
- **状态**: covered
- **代码**: `copper-economy-system.ts` L45, skillBook price=3000

### RES-SKILL-012: 商店技能书每日限购5
- **资源类型**: skillBook
- **流程**: 转换 → 边界
- **操作**: purchaseItem('skillBook', 6)
- **预期**: 返回 false，超过每日限购 5
- **优先级**: P0
- **状态**: covered
- **代码**: `copper-economy-system.ts` L45, skillBook dailyLimit=5

### RES-SKILL-013: 技能书稀有度分级（初级）
- **资源类型**: skillBook
- **流程**: 边界
- **操作**: 远征 easy 难度掉落初级技能书 sb_001
- **预期**: 初级技能书 rate=0.02，minCount=1, maxCount=1
- **优先级**: P1
- **状态**: covered
- **代码**: `ExpeditionRewardSystem.ts` L74

### RES-SKILL-014: 技能书稀有度分级（高级）
- **资源类型**: skillBook
- **流程**: 边界
- **操作**: 远征 epic/ambush 难度掉落高级技能书 sb_003
- **预期**: 高级技能书 rate=0.20, minCount=1, maxCount=2
- **优先级**: P1
- **状态**: covered
- **代码**: `ExpeditionRewardSystem.ts` L86

### RES-SKILL-015: 觉醒消耗技能书
- **资源类型**: skillBook
- **流程**: 消费
- **操作**: AwakeningSystem.spendResources()，消耗 AWAKENING_COST.skillBooks
- **预期**: skillBook -= AWAKENING_COST.skillBooks
- **优先级**: P1
- **状态**: covered
- **代码**: `AwakeningSystem.ts` L428

### RES-SKILL-016: 技能书零值消费拒绝
- **资源类型**: skillBook
- **流程**: 消费 → 边界
- **操作**: skillBook=0, consumeResource('skillBook', 1)
- **预期**: 抛出 Error
- **优先级**: P0
- **状态**: covered
- **代码**: `ResourceSystem.consumeResource()` L181-185

### RES-SKILL-017: 技能书无上限累积
- **资源类型**: skillBook
- **流程**: 边界
- **操作**: addResource('skillBook', 99999)，cap=null
- **预期**: skillBook 全额增加，无 overflow 事件
- **优先级**: P1
- **状态**: covered
- **代码**: `ResourceSystem.addResource()` L143

---

## 附录A: 跨资源交互矩阵

| 消费 \ 产出 | grain | gold | troops | mandate | techPoint | recruitToken | skillBook |
|---|---|---|---|---|---|---|---|
| **grain** | — | 商店购买 | — | — | — | — | — |
| **gold** | 建筑升级 | — | 建筑升级 | — | — | 商店购买 | 商店购买 |
| **troops** | — | — | — | — | — | — | — |
| **mandate** | — | — | — | — | 科技加速 | — | — |
| **techPoint** | — | — | — | — | — | — | — |
| **recruitToken** | — | — | — | — | — | — | — |
| **skillBook** | — | 技能升级 | — | — | — | — | — |

### 关键跨资源流程

| ID | 流程 | 涉及资源 | 路径 |
|---|---|---|---|
| XFLOW-001 | 商店购买招贤令 | gold → recruitToken | `CopperEconomySystem.purchaseItem()` |
| XFLOW-002 | 商店购买技能书 | gold → skillBook | `CopperEconomySystem.purchaseItem()` |
| XFLOW-003 | 碎片转化铜钱 | recruitToken(溢出) → gold | `HeroRecruitSystem` FRAGMENT_TO_GOLD_RATE |
| XFLOW-004 | 建筑升级 | grain + gold + troops | `engine-building-ops.ts` consumeBatch |
| XFLOW-005 | 挑战关卡 | troops + mandate | `ChallengeStageSystem` 原子消耗 |
| XFLOW-006 | 技能升级 | gold + skillBook | `SkillUpgradeSystem` 双资源消耗 |
| XFLOW-007 | 武将觉醒 | gold + skillBook + breakthroughStone + awakeningStone | `AwakeningSystem.spendResources()` |
| XFLOW-008 | 武将升星 | gold + breakthroughStone | `HeroStarSystem` 双资源消耗 |

---

## 附录B: 代码溯源映射

| 资源 | 核心文件 | 关键方法 |
|---|---|---|
| grain | `ResourceSystem.ts` L137-178 | `addResource()`, `consumeResource()` (grain 保护分支) |
| gold | `copper-economy-system.ts` | `tick()`, `claimDailyTaskCopper()`, `purchaseItem()`, `trySpend()` |
| troops | `ResourceSystem.ts` L296-305 | `updateCaps()`, BARRACKS_CAPACITY_TABLE |
| mandate | `ChallengeStageSystem.ts` L294-331 | `consumeResource('mandate')`, 退还逻辑 |
| techPoint | `TechPointSystem.ts` | `addPoints()`, `spendPoints()`, `refundPoints()` |
| recruitToken | `HeroRecruitSystem.ts` L305 | `spendResource()`, `hero-recruit-config.ts` RECRUIT_COSTS |
| skillBook | `SkillUpgradeSystem.ts` L230-237 | `spendResource('skillBook')`, SKILL_UPGRADE_COST_TABLE |
| 通用 | `resource-config.ts` | INITIAL_RESOURCES, INITIAL_CAPS, MIN_GRAIN_RESERVE, MANDATE_CONFIRM_THRESHOLD |
| 离线 | `OfflineEarningsCalculator.ts` | OFFLINE_TIERS, OFFLINE_MAX_SECONDS |
| 容量 | `resource-calculator.ts` | `lookupCap()`, `calculateCapWarnings()` |

---

## 统计摘要

| 资源 | 节点数 | P0 | P1 | P2 | covered | missing | partial |
|---|---|---|---|---|---|---|---|
| grain | 17 | 7 | 7 | 3 | 15 | 1 | 1 |
| gold | 17 | 8 | 7 | 2 | 17 | 0 | 0 |
| troops | 16 | 5 | 7 | 4 | 14 | 1 | 1 |
| mandate | 15 | 5 | 7 | 3 | 10 | 0 | 5 |
| techPoint | 16 | 3 | 6 | 7 | 14 | 0 | 2 |
| recruitToken | 17 | 5 | 7 | 5 | 15 | 0 | 2 |
| skillBook | 17 | 6 | 9 | 2 | 15 | 0 | 2 |
| **合计** | **119** | **39** | **50** | **26** | **100** | **2** | **13** |

- **覆盖率**: covered 84.0% (100/119), missing 1.7% (2/119), partial 10.9% (13/119)
- **需优先补充**: RES-GRAIN-008 (粮仓降级截断), RES-TROOPS-003 (兵营降级截断)
- **需完善测试**: 13 个 partial 节点主要涉及跨系统交互（VIP、活动、攻城等）
