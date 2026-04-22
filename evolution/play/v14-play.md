# v14.0 千秋万代 — Play 文档 (Round 2)

> 版本: v14.0 千秋万代 | 引擎域: engine/prestige/(PrestigeSystem, PrestigeShopSystem, RebirthSystem, RebirthSystem.helpers)
> 日期: 2025-07-18 | 轮次: Round 2

---

## 玩家流程

### P1: 声望获取 → 等级提升 → 产出加成

```
1. 玩家完成日常任务 → addPrestigePoints('daily_quest', 10)
   → currentPoints += 10, dailyGained['daily_quest'] = 10
2. 玩家战斗胜利 → addPrestigePoints('battle_victory', 5)
   → currentPoints += 5, dailyGained['battle_victory'] = 5
3. 累计声望达阈值 → checkLevelUp() 自动升级
   → currentLevel: 1→2, emit('prestige:levelUp', {level:2})
   → 产出加成: calcProductionBonus(2) = 1 + 2×0.02 = 1.04
4. 每日上限检查: daily_quest cap=100, 已获100 → addPrestigePoints返回0
5. 获取面板: getPrestigePanel() → {currentPoints, currentLevel, nextLevelPoints, productionBonus}
```

**验证点**: `calcRequiredPoints(5) === Math.floor(1000 × 5^1.8) === 8730`

### P2: 声望商店 → 等级解锁 → 声望值兑换

```
1. Lv.1 查看商品: getAllGoods() → psg-001精铁礼包(unlocked=true, canBuy=true)
2. Lv.1 查看高级: psg-003建设加速(requiredLevel=5, unlocked=false, canBuy=false)
3. 购买精铁礼包: buyGoods('psg-001', 1)
   → prestigePoints -= 50, item.purchased = 1, rewards: {iron:100}
4. 限购检查: purchaseLimit=5, 已购1 → canBuy=true
5. 声望值不足: prestigePoints=30, costPoints=50 → buyGoods失败"声望值不足"
6. 升级到Lv.5: updatePrestigeInfo(points, 5) → psg-003自动解锁
```

**验证点**: `canBuyGoods('psg-003').canBuy === false` (Lv.1时等级不足)

### P3: 转生条件检查 → 执行转生 → 倍率生效

```
1. 检查条件: checkRebirthConditions()
   → prestigeLevel:20✅ castleLevel:10✅ heroCount:5✅ totalPower:10000✅
   → canRebirth: true
2. 条件不满足: prestigeLevel=15 → canRebirth: false, "prestigeLevel: 15/20"
3. 执行转生: executeRebirth()
   → resetCallback(REBIRTH_RESET_RULES) → 重置建筑/资源/地图/任务/战役
   → rebirthCount: 0→1, multiplier: calcRebirthMultiplier(1) = 1.0+1×0.5 = 1.5
   → accelerationDaysLeft = 7
4. 倍率生效: getEffectiveMultipliers()
   → buildSpeed: 1.5×1.5=2.25, resource: 1.5×2.0=3.0, exp: 1.5×2.0=3.0
5. 解锁内容: getUnlockContents() → 1次:转生商店(unlocked=true)
```

**验证点**: `calcRebirthMultiplier(5) === Math.min(1.0+5×0.5, 10.0) === 3.5`

### P4: 收益模拟器 → 声望增长预测 → 转生时机推荐

```
1. 模拟参数: {currentPrestigeLevel:10, currentRebirthCount:0, simulateDays:30, dailyOnlineHours:4}
2. 模拟收益: simulateEarnings(params)
   → 7天加速期: gold=100×4×1.5×2.0×7=8400, grain=50×4×1.5×2.0×7=4200
   → 23天正常期: gold=100×4×1.5×23=13800, grain=50×4×1.5×23=6900
   → estimatedPrestigeGain: 20×4×30=2400
3. v16模拟: simulateEarningsV16(params)
   → prestigeGrowthCurve: [{day:1, prestige:160}, {day:2, prestige:320}...]
   → comparison: recommendedAction='rebirth_now'|'wait'|'no_difference'
```

**验证点**: `compareRebirthTiming(0, [24,48,72]).immediateMultiplier === 1.1`

### P5: 声望任务 → 转生任务 → 奖励领取

```
1. 声望任务: getPrestigeQuests() → pq-001~pq-006(按等级过滤)
2. 进度更新: addPrestigePoints('daily_quest', 10) → updatePrestigeQuestProgress
   → pq-002(earn_prestige_points): progress += 10
3. 自动完成: progress >= targetCount → completedPrestigeQuests.push(id), 发放奖励
4. 转生任务: getRebirthQuests(rebirthCount=1) → rq-002~rq-004
5. 等级奖励: claimLevelReward(5) → claimedLevelRewards.push(5), rewardCallback({gold:500})
```

**验证点**: `claimLevelReward(5).success === false` (currentLevel<5时)

---

## 交叉验证矩阵

| 流程 | PrestigeSystem | PrestigeShopSystem | RebirthSystem | helpers | config | types |
|------|:--------------:|:------------------:|:-------------:|:-------:|:------:|:-----:|
| P1   | ✅             | —                  | —             | —       | ✅     | ✅    |
| P2   | ✅             | ✅                 | —             | —       | ✅     | ✅    |
| P3   | ✅             | —                  | ✅             | ✅      | ✅     | ✅    |
| P4   | —              | —                  | ✅             | ✅      | —      | ✅    |
| P5   | ✅             | —                  | ✅             | —       | ✅     | ✅    |
| **覆盖率** | 4/4 | 1/1 | 3/3 | 2/2 | 3/3 | 5/5 |
