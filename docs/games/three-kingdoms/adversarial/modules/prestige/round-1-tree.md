# Prestige R1 — 测试分支树

> Builder Agent 产出 | 2026-05-01
> 源码: `src/games/three-kingdoms/engine/prestige/`
> 子系统: PrestigeSystem, RebirthSystem, PrestigeShopSystem, RebirthSystem.helpers

## 公开 API 清单

### PrestigeSystem (PS)
| API | 行号 | 说明 |
|-----|------|------|
| `init(deps)` | L78 | 初始化，注册事件监听 |
| `addPrestigePoints(source, basePoints, relatedId?)` | L155 | 手动增加声望值 |
| `getPrestigePanel()` | L139 | 获取声望分栏 |
| `getLevelInfo(level)` | L149 | 获取等级信息 |
| `getCurrentLevelInfo()` | L153 | 当前等级信息 |
| `getProductionBonus()` | L180 | 产出加成 |
| `claimLevelReward(level)` | L192 | 领取等级奖励 |
| `getPrestigeQuests()` | L216 | 声望任务列表 |
| `getRebirthQuests(rebirthCount)` | L220 | 转生任务列表 |
| `checkPrestigeQuestCompletion(questId)` | L228 | 检查任务完成 |
| `getSaveData()` | L247 | 存档 |
| `loadSaveData(data)` | L260 | 读档 |

### RebirthSystem (RS)
| API | 行号 | 说明 |
|-----|------|------|
| `init(deps)` | L75 | 初始化 |
| `setCallbacks(callbacks)` | L89 | 配置外部回调 |
| `checkRebirthConditions()` | L100 | 检查转生条件 |
| `executeRebirth()` | L123 | 执行转生 |
| `calcRebirthMultiplier(count)` | L65 | 计算转生倍率 |
| `getEffectiveMultipliers()` | L155 | 有效倍率 |
| `simulateEarnings(params)` | L169 | 收益模拟 |
| `loadSaveData(data)` | L199 | 读档 |
| `calculateBuildTime(baseTime, buildingLevel)` | L205 | 建筑时间 |

### PrestigeShopSystem (PSS)
| API | 行号 | 说明 |
|-----|------|------|
| `init(deps)` | L56 | 初始化 |
| `updatePrestigeInfo(points, level)` | L82 | 更新声望信息 |
| `buyGoods(goodsId, quantity)` | L104 | 购买商品 |
| `canBuyGoods(goodsId)` | L154 | 检查可买 |
| `loadPurchases(purchases)` | L174 | 加载购买记录 |

### RebirthSystem.helpers (RSH)
| 函数 | 行号 | 说明 |
|------|------|------|
| `calculateBuildTime(baseTime, buildingLevel, multiplier, accelDays)` | L46 | 建筑时间计算 |
| `getAutoRebuildPlan(rebirthCount)` | L72 | 一键重建 |
| `compareRebirthTiming(count, waitHours?)` | L120 | 转生时机对比 |
| `simulateEarningsV16(params, baseResult)` | L162 | v16收益模拟 |

---

## 测试分支树

### F-PS-01: addPrestigePoints — 正常流程
```
addPrestigePoints(source, basePoints)
├── F-PS-01-N01: 正常增加声望值 → currentPoints += actualPoints [covered: PrestigeSystem.ts:L168-176]
├── F-PS-01-N02: 达到每日上限后返回0 [covered: PrestigeSystem.ts:L162-163]
├── F-PS-01-N03: 接近上限时部分获得 [covered: PrestigeSystem.ts:L166-167]
├── F-PS-01-N04: dailyCap=-1(无限)时不检查上限 [covered: PrestigeSystem.ts:L162, main_quest]
├── F-PS-01-N05: 未知source返回0 [covered: PrestigeSystem.ts:L160]
├── F-PS-01-N06: 触发升级检查 → checkLevelUp [covered: PrestigeSystem.ts:L178]
└── F-PS-01-N07: 更新声望任务进度 [covered: PrestigeSystem.ts:L180]
```

### F-PS-02: addPrestigePoints — NaN/负值/溢出
```
addPrestigePoints(source, basePoints)
├── F-PS-02-E01: basePoints=NaN → 无防护，NaN传播到currentPoints [P0 ⚠️]
├── F-PS-02-E02: basePoints=-1 → 无防护，负数减少声望 [P0 ⚠️]
├── F-PS-03-E03: basePoints=Infinity → 无防护，Infinity传播 [P0 ⚠️]
├── F-PS-02-E04: basePoints=0 → 正常，actualPoints=0
└── F-PS-02-E05: dailyGained[source]=NaN → NaN比较绕过上限检查 [P0 ⚠️]
```

### F-PS-03: checkLevelUp — 升级循环
```
checkLevelUp()
├── F-PS-03-N01: 单次升级 [covered: PrestigeSystem.ts:L272-279]
├── F-PS-03-N02: 连续升级（跨多级） [covered: PrestigeSystem.ts:L271 while循环]
├── F-PS-03-N03: 已达MAX_PRESTIGE_LEVEL停止 [covered: PrestigeSystem.ts:L271]
└── F-PS-03-E01: currentPoints=NaN → NaN>=required 永远false，不升级但也不崩溃 [P1]
```

### F-PS-04: claimLevelReward — 领取等级奖励
```
claimLevelReward(level)
├── F-PS-04-N01: 正常领取 [covered: PrestigeSystem.ts:L192-212]
├── F-PS-04-N02: 等级不足 → 拒绝 [covered: PrestigeSystem.ts:L193-194]
├── F-PS-04-N03: 已领取 → 拒绝 [covered: PrestigeSystem.ts:L196-197]
├── F-PS-04-N04: 无效等级 → 拒绝 [covered: PrestigeSystem.ts:L199-201]
└── F-PS-04-E01: level=NaN → NaN比较导致条件全false，安全拒绝 [covered]
```

### F-PS-05: getSaveData / loadSaveData — 序列化
```
getSaveData() / loadSaveData(data)
├── F-PS-05-N01: 正常存档恢复 [covered: PrestigeSystem.ts:L247-260]
├── F-PS-05-N02: 版本不匹配拒绝加载 [covered: PrestigeSystem.ts:L328]
├── F-PS-05-E01: data.prestige含NaN → 无防护，NaN直接写入state [P0 ⚠️]
├── F-PS-05-E02: data.prestige=null/undefined → spread崩溃 [P0 ⚠️]
└── F-PS-05-E03: rebirthStateCallback未设置 → 使用默认值，安全 [covered: PrestigeSystem.ts:L311-320]
```

### F-PS-06: resetDailyGains — 每日重置
```
resetDailyGains()
├── F-PS-06-N01: 正常重置所有途径 [covered: PrestigeSystem.ts:L286-289]
└── F-PS-06-N01: 更新lastDailyReset日期 [covered: PrestigeSystem.ts:L290]
```

### F-RS-01: executeRebirth — 正常流程
```
executeRebirth()
├── F-RS-01-N01: 条件满足 → 成功转生 [covered: RebirthSystem.ts:L123-148]
├── F-RS-01-N02: 条件不满足 → 拒绝 [covered: RebirthSystem.ts:L127-130]
├── F-RS-01-N03: resetCallback被调用 [covered: RebirthSystem.ts:L132]
├── F-RS-01-N04: 加速天数设置 [covered: RebirthSystem.ts:L143]
└── F-RS-01-N05: 事件发射 [covered: RebirthSystem.ts:L145]
```

### F-RS-02: executeRebirth — 回调注入
```
executeRebirth() — 回调安全
├── F-RS-02-E01: resetCallback未设置 → if(this.resetCallback)防护，安全 [covered: RebirthSystem.ts:L132]
├── F-RS-02-E02: castleLevelCallback抛异常 → ??0兜底，安全 [covered: RebirthSystem.ts:L108]
├── F-RS-02-E03: heroCountCallback抛异常 → ??0兜底，安全 [covered: RebirthSystem.ts:L109]
└── F-RS-02-E04: totalPowerCallback抛异常 → ??0兜底，安全 [covered: RebirthSystem.ts:L110]
```

### F-RS-03: calcRebirthMultiplier — 倍率计算
```
calcRebirthMultiplier(count)
├── F-RS-03-N01: count=0 → 返回1.0 [covered: prestige-config.ts calcRebirthMultiplierFromConfig]
├── F-RS-03-N02: count=1 → 对数曲线计算
├── F-RS-03-N03: count=100 → 接近max=10.0
├── F-RS-03-E01: count=NaN → NaN<=0为false，进入计算 → NaN传播 [P0 ⚠️]
├── F-RS-03-E02: count=-1 → <=0返回1.0，安全 [covered]
└── F-RS-03-E03: count=Infinity → Math.min(base+Infinity, max)=max，安全 [covered]
```

### F-RS-04: simulateEarnings — 收益模拟
```
simulateEarnings(params)
├── F-RS-04-N01: 正常模拟 [covered: RebirthSystem.ts:L169-194]
├── F-RS-04-E01: params.dailyOnlineHours=NaN → NaN乘法传播 [P1]
├── F-RS-04-E02: params.simulateDays=0 → accelDays=0, normalDays=0，返回0值
└── F-RS-04-E03: params.currentRebirthCount=NaN → NaN传播到multiplier [P1]
```

### F-RS-05: loadSaveData — 转生存档
```
loadSaveData(data)
├── F-RS-05-N01: 正常恢复 [covered: RebirthSystem.ts:L199]
├── F-RS-05-E01: data.rebirth含NaN → 无防护，NaN写入state [P0 ⚠️]
└── F-RS-05-E02: data.rebirth=null/undefined → spread崩溃 [P0 ⚠️]
```

### F-RS-06: tickAcceleration — 加速衰减
```
tickAcceleration()
├── F-RS-06-N01: 正常衰减 [covered: RebirthSystem.ts:L218-224]
├── F-RS-06-N02: 归零时发射事件 [covered: RebirthSystem.ts:L221]
└── F-RS-06-N03: 已为0时不处理 [covered: RebirthSystem.ts:L218]
```

### F-RS-07: setCallbacks — 回调注入
```
setCallbacks(callbacks)
├── F-RS-07-N01: 正常设置 [covered: RebirthSystem.ts:L89-97]
├── F-RS-07-E01: prestigeLevel回调返回NaN → prestigeLevel=NaN [P0 ⚠️]
└── F-RS-07-E02: prestigeLevel回调未设置 → prestigeLevel保持初始值1 [covered]
```

### F-PSS-01: buyGoods — 购买商品
```
buyGoods(goodsId, quantity)
├── F-PSS-01-N01: 正常购买 [covered: PrestigeShopSystem.ts:L104-151]
├── F-PSS-01-N02: 等级不足拒绝 [covered: PrestigeShopSystem.ts:L114-115]
├── F-PSS-01-N03: 限购已满拒绝 [covered: PrestigeShopSystem.ts:L119-120]
├── F-PSS-01-N04: 声望值不足拒绝 [covered: PrestigeShopSystem.ts:L124-125]
├── F-PSS-01-N05: 商品不存在拒绝 [covered: PrestigeShopSystem.ts:L111-112]
├── F-PSS-01-E01: quantity=NaN → totalCost=NaN, prestigePoints<NaN=false，绕过检查！ [P0 ⚠️]
├── F-PSS-01-E02: quantity=0 → totalCost=0, 免费"购买" [P1]
├── F-PSS-01-E03: quantity=-1 → totalCost为负, prestigePoints < 负数=false，绕过！ [P0 ⚠️]
└── F-PSS-01-E04: prestigePoints=NaN → NaN < totalCost=false，绕过！ [P0 ⚠️]
```

### F-PSS-02: PrestigeShopSystem 序列化缺失
```
PrestigeShopSystem — 存档覆盖
├── F-PSS-02-E01: PrestigeShopSystem无serialize/deserialize → engine-save不保存商店状态 [P0 ⚠️]
├── F-PSS-02-E02: loadPurchases存在但未被engine-save调用 [P0 ⚠️]
└── F-PSS-02-E03: 转生后商店购买记录丢失 [P0 ⚠️]
```

### F-RSH-01: calculateBuildTime — 建筑时间
```
calculateBuildTime(baseTimeSeconds, buildingLevel, multiplier, accelDays)
├── F-RSH-01-N01: 无加速返回原始时间 [covered: RebirthSystem.helpers.ts:L56-57]
├── F-RSH-01-N02: 低级建筑瞬间升级 [covered: RebirthSystem.helpers.ts:L59-61]
├── F-RSH-01-N03: 加速期内除以倍率 [covered: RebirthSystem.helpers.ts:L63-65]
├── F-RSH-01-N04: 非加速期除以倍率 [covered: RebirthSystem.helpers.ts:L67]
├── F-RSH-01-E01: baseTimeSeconds=NaN → Math.floor(NaN)=NaN, Math.max(1,NaN)=NaN [P0 ⚠️]
├── F-RSH-01-E02: multiplier=0 → 除以0 → Infinity [P0 ⚠️]
└── F-RSH-01-E03: multiplier=NaN → NaN除法传播 [P0 ⚠️]
```

### F-RSH-02: compareRebirthTiming — 时机对比
```
compareRebirthTiming(currentRebirthCount, waitHoursOptions)
├── F-RSH-02-N01: 正常对比3个选项 [covered: RebirthSystem.helpers.ts:L120-155]
├── F-RSH-02-N02: 自定义waitHoursOptions [covered]
└── F-RSH-02-E01: currentRebirthCount=NaN → NaN算术传播 [P1]
```

---

## 跨系统链路

### X-PRS-01: PrestigeSystem → PrestigeShopSystem
```
addPrestigePoints → prestigePoints更新 → shop.updatePrestigeInfo未自动调用
问题: PrestigeShopSystem的prestigePoints仅在levelUp事件时更新，不随声望值变化同步
风险: 购买商品时prestigePoints可能过时 [P1]
```

### X-PRS-02: PrestigeSystem → RebirthSystem
```
executeRebirth → resetCallback → PrestigeSystem.reset()
问题: PrestigeSystem.reset()清除所有状态包括声望等级，但RebirthSystem未重置
转生保留规则包含keep_prestige，但reset()会清除声望 → 矛盾 [P1]
```

### X-PRS-03: engine-save → PrestigeSystem → RebirthSystem
```
engine-save调用 prestige.getSaveData() → 内部调用 rebirthStateCallback
engine-save调用 prestige.loadSaveData() → 仅恢复PrestigeSystem状态
问题: RebirthSystem.loadSaveData()需要单独调用，但engine-save中无此调用 [P0 ⚠️]
```

### X-PRS-04: PrestigeShopSystem — 存档黑洞
```
engine-save buildSaveData: 无prestigeShop字段
engine-save applySaveData: 无prestigeShop加载
PrestigeShopSystem.loadPurchases: 存在但未被调用
结果: 商店购买记录在存档/读档后丢失 [P0 ⚠️]
```

---

## P0 汇总

| ID | 类型 | 位置 | 描述 |
|----|------|------|------|
| P0-01 | NaN | PrestigeSystem.addPrestigePoints | basePoints无NaN/负数防护 |
| P0-02 | NaN | PrestigeSystem.loadSaveData | data.prestige含NaN无防护 |
| P0-03 | Null | PrestigeSystem.loadSaveData | data.prestige=null时spread崩溃 |
| P0-04 | NaN | calcRebirthMultiplier | count=NaN传播 |
| P0-05 | NaN | RebirthSystem.loadSaveData | data.rebirth含NaN无防护 |
| P0-06 | Null | RebirthSystem.loadSaveData | data.rebirth=null时spread崩溃 |
| P0-07 | NaN | PrestigeShopSystem.buyGoods | quantity=NaN绕过声望检查 |
| P0-08 | NaN | PrestigeShopSystem.buyGoods | quantity=-1绕过声望检查 |
| P0-09 | NaN | PrestigeShopSystem.buyGoods | prestigePoints=NaN绕过检查 |
| P0-10 | Serialize | PrestigeShopSystem | 无存档集成，购买记录丢失 |
| P0-11 | NaN | calculateBuildTime | baseTime/multiplier=NaN/0 |
| P0-12 | Serialize | RebirthSystem | engine-save未调用loadSaveData |
| P0-13 | NaN | setCallbacks | prestigeLevel回调返回NaN |

**总计: 13个P0节点**
