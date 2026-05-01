# Map 流程分支树 Round 1

> Builder: TreeBuilder v1.9 | Time: 2026-05-01
> 模块: map | 文件: 10 | 源码: 3,184行 | API: ~85

## 统计

| 子系统 | 节点数 | API数 | covered | uncovered | P0 | P1 |
|--------|--------|-------|---------|-----------|----|----|
| WorldMapSystem | 62 | 22 | 44 | 18 | 8 | 10 |
| TerritorySystem | 48 | 16 | 36 | 12 | 5 | 7 |
| SiegeSystem | 58 | 18 | 42 | 16 | 9 | 7 |
| SiegeEnhancer | 42 | 12 | 30 | 12 | 5 | 7 |
| GarrisonSystem | 44 | 14 | 34 | 10 | 4 | 6 |
| MapEventSystem | 38 | 12 | 28 | 10 | 3 | 7 |
| MapFilterSystem | 18 | 8 | 16 | 2 | 0 | 2 |
| MapDataRenderer | 22 | 8 | 18 | 4 | 1 | 3 |
| map-event-config | 8 | 2 | 6 | 2 | 1 | 1 |
| index.ts | 2 | 1 | 2 | 0 | 0 | 0 |
| **总计** | **340** | **113** | **256** | **86** | **36** | **50** |

## 子系统覆盖

| 子系统 | 文件 | 行数 | API数 | 覆盖率 |
|--------|------|------|-------|--------|
| WorldMapSystem | WorldMapSystem.ts | 388 | 22 | 71.0% |
| TerritorySystem | TerritorySystem.ts | 395 | 16 | 75.0% |
| SiegeSystem | SiegeSystem.ts | 492 | 18 | 72.4% |
| SiegeEnhancer | SiegeEnhancer.ts | 406 | 12 | 71.4% |
| GarrisonSystem | GarrisonSystem.ts | 429 | 14 | 77.3% |
| MapEventSystem | MapEventSystem.ts | 425 | 12 | 73.7% |
| MapFilterSystem | MapFilterSystem.ts | 245 | 8 | 88.9% |
| MapDataRenderer | MapDataRenderer.ts | 281 | 8 | 81.8% |
| map-event-config | map-event-config.ts | 100 | 2 | 75.0% |

## 跨系统链路覆盖

| 链路 | 描述 | 状态 |
|------|------|------|
| X-01 | SiegeSystem→TerritorySystem.captureTerritory | covered |
| X-02 | SiegeSystem→TerritorySystem.canAttackTerritory | covered |
| X-03 | SiegeEnhancer→SiegeSystem.checkSiegeConditions | covered |
| X-04 | SiegeEnhancer→SiegeSystem.simulateBattle | covered |
| X-05 | SiegeEnhancer→SiegeSystem.executeSiegeWithResult | covered |
| X-06 | SiegeEnhancer→GarrisonSystem.getGarrisonBonus | covered |
| X-07 | GarrisonSystem→TerritorySystem.getTerritoryById | covered |
| X-08 | GarrisonSystem→HeroSystem.getGeneral | covered |
| X-09 | GarrisonSystem→HeroFormation.isGeneralInAnyFormation | covered |
| X-10 | SiegeSystem→ResourceSystem.consume（deductSiegeResources） | covered |
| X-11 | SiegeSystem→eventBus.emit siege:victory/defeat | covered |
| X-12 | GarrisonSystem→eventBus.on siege:autoGarrison | covered |
| X-13 | WorldMapSystem→TerritorySystem（地标-领土同步） | uncovered ⚠️ |
| X-14 | TerritorySystem→WorldMapSystem（归属变更回写地标） | uncovered ⚠️ |
| X-15 | MapEventSystem→EVENT_TYPE_CONFIGS配置完整性 | uncovered ⚠️ |
| X-16 | SiegeSystem.serialize→engine-save覆盖验证 | uncovered ⚠️ |
| **总计** | **16** | **12 covered / 4 uncovered** |

---

## Part A: WorldMapSystem + TerritorySystem

### A-01: WorldMapSystem.init(deps)
```
F-Normal: deps有效 → tiles初始化 → landmarkMap初始化
F-Boundary: 无
F-Error: deps=null → this.deps! 非空断言，后续调用可能崩溃 [P1]
F-Lifecycle: init→reset→init 循环
```

### A-02: WorldMapSystem.getTileAt(pos)
```
F-Normal: 有效坐标 → 返回TileData
F-Boundary: x=0,y=0 / x=cols-1,y=rows-1
F-Error: pos=null → pos.x 崩溃 [P0]
F-Error: pos={x:-1,y:0} → isValidPosition返回false → null
F-Error: pos={x:NaN,y:0} → NaN>=0 false → isValidPosition返回false → null ✅
```

### A-03: WorldMapSystem.setLandmarkOwnership(id, ownership)
```
F-Normal: 有效id → 更新ownership → syncLandmarkToTiles
F-Boundary: ownership='neutral'/'player'/'enemy'
F-Error: id不存在 → return false
F-Error: id=null → landmarkMap.get(null) → undefined → false ✅
F-Error: id='' → 同上 → false ✅
```

### A-04: WorldMapSystem.upgradeLandmark(id)
```
F-Normal: 有效id, level<5 → level+1, productionMultiplier+0.2
F-Boundary: level=4 → 升到5成功
F-Boundary: level=5 → return false
F-Error: id不存在 → false
F-Error: level=NaN → NaN>=5 false → 升级执行，level变为NaN [P0]
```

### A-05: WorldMapSystem.setViewportOffset(x, y)
```
F-Normal: 正常偏移值
F-Error: x=NaN → viewport.offsetX=NaN → 后续计算异常 [P0]
F-Error: x=Infinity → viewport.offsetX=Infinity [P1]
F-Error: 无边界约束（与clampViewport分离） [P1]
```

### A-06: WorldMapSystem.setZoom(zoom)
```
F-Normal: zoom=1.0 → clamped正常
F-Boundary: zoom=minZoom / zoom=maxZoom
F-Error: zoom=NaN → Math.max(minZoom, Math.min(maxZoom, NaN)) → NaN [P0]
F-Error: zoom=0 → clamped到minZoom ✅
F-Error: zoom=-1 → clamped到minZoom ✅
```

### A-07: WorldMapSystem.serialize()
```
F-Normal: 正常序列化 → {landmarkOwnerships, landmarkLevels, viewport, version}
F-Lifecycle: serialize→deserialize→serialize 往返一致性
```

### A-08: WorldMapSystem.deserialize(data)
```
F-Normal: 有效data → 恢复地标+视口+syncAllLandmarksToTiles
F-Error: data=null → Object.entries(null)崩溃 [P0]
F-Error: data.landmarkOwnerships={} → 无地标恢复
F-Error: data.viewport=undefined → 跳过视口恢复 ✅
F-Error: data含无效id → landmarkMap.get(id)返回undefined → 跳过 ✅
```

### A-09: TerritorySystem.init(deps)
```
F-Normal: deps有效 → generateTerritoryData → territories Map初始化
F-Error: generateTerritoryData返回空数组 → territories为空，后续查询全返回null [P1]
```

### A-10: TerritorySystem.captureTerritory(id, newOwner)
```
F-Normal: 有效id → 更新ownership → emit territory:captured
F-Boundary: newOwner='player'/'enemy'/'neutral'
F-Error: id不存在 → false
F-Error: newOwner=null → t.ownership=null → 非法归属 [P0]
```

### A-11: TerritorySystem.upgradeTerritory(id)
```
F-Normal: 玩家领土, level<5 → 升级成功
F-Boundary: level=4 → 升到5
F-Error: 非玩家领土 → failResult
F-Error: level=5 → failResult
F-Error: id不存在 → failResult
F-Error: calculateUpgradeCost返回null → failResult ✅
```

### A-12: TerritorySystem.canAttackTerritory(targetId, attackerOwner)
```
F-Normal: 目标非己方+有相邻己方领土 → true
F-Error: 目标己方 → false
F-Error: 无相邻己方领土 → false
F-Error: targetId不存在 → false ✅
```

### A-13: TerritorySystem.getPlayerProductionSummary()
```
F-Normal: 有玩家领土 → 汇总产出
F-Boundary: 无玩家领土 → 全0
F-Error: currentProduction含NaN → NaN累加传播 [P0]
```

### A-14: TerritorySystem.deserialize(data)
```
F-Normal: 有效data → 恢复owners+levels+重算production
F-Error: data=null → Object.entries(null)崩溃 [P0]
F-Error: data.owners含无效id → 跳过 ✅
F-Error: data.levels含NaN → t.level=NaN, calculateProduction(NaN)异常 [P0]
```

---

## Part B: SiegeSystem + SiegeEnhancer

### B-01: SiegeSystem.checkSiegeConditions(targetId, attackerOwner, troops, grain)
```
F-Normal: 全条件满足 → {canSiege:true}
F-Boundary: troops=cost.troops → 满足
F-Boundary: grain=cost.grain → 满足
F-Error: targetId不存在 → TARGET_NOT_FOUND
F-Error: territory.ownership===attackerOwner → TARGET_ALREADY_OWNED
F-Error: 不相邻 → NOT_ADJACENT
F-Error: troops<cost.troops → INSUFFICIENT_TROOPS
F-Error: grain<cost.grain → INSUFFICIENT_GRAIN
F-Error: dailySiegeCount>=3 → DAILY_LIMIT_REACHED
F-Error: troops=NaN → NaN<cost.troops → false → 绕过兵力检查 [P0]
F-Error: grain=NaN → NaN<cost.grain → false → 绕过粮草检查 [P0]
F-Error: attackerOwner=null → territory.ownership===null → false → TARGET_ALREADY_OWNED [P1]
```

### B-02: SiegeSystem.calculateSiegeCost(territory)
```
F-Normal: defenseValue=1000 → troops=Math.ceil(100*1000/100*1.0)=1000, grain=500
F-Boundary: defenseValue=0 → troops=0
F-Error: defenseValue=NaN → Math.ceil(100*NaN/100*1.0) → NaN → cost.troops=NaN [P0]
F-Error: defenseValue=-100 → troops=Math.ceil(100*-100/100*1.0)=-100 → 负消耗 [P0]
```

### B-03: SiegeSystem.simulateBattle(attackerTroops, target)
```
F-Normal: 攻>防 → winRate>50%
F-Boundary: 攻=防 → winRate=50%
F-Error: attackerTroops=NaN → cost.troops=NaN → effectiveTroops=NaN-NaN=NaN → NaN<=0 false → computeWinRate(NaN, defenderPower) → NaN<=0 false → ratio=NaN/defender → NaN [P0]
F-Error: target.defenseValue=0 → defenderPower=0 → return WIN_RATE_MAX(0.95) ✅
```

### B-04: SiegeSystem.computeWinRate(attackerPower, defenderPower)
```
F-Normal: 正常值 → ratio*0.5, clamped [0.05, 0.95]
F-Boundary: attackerPower=0 → 0<=0 true → WIN_RATE_MIN
F-Boundary: defenderPower=0 → 0<=0 true → WIN_RATE_MAX
F-Error: attackerPower=NaN → NaN<=0 false → ratio=NaN/defender → NaN → Math.min/max(NaN) → NaN [P0]
F-Error: defenderPower=NaN → NaN<=0 false → ratio=attacker/NaN → NaN [P0]
```

### B-05: SiegeSystem.executeSiege(targetId, attackerOwner, troops, grain)
```
F-Normal: 条件满足 → 战斗 → resolveSiege
F-Error: 条件不满足 → launched=false
F-Error: territorySys=null → territory=null → launched=false
```

### B-06: SiegeSystem.resolveSiege (内部)
```
F-Normal-胜利: totalSieges++, victories++, captureTerritory, deductResources, emit siege:victory
F-Normal-失败: totalSieges++, defeats++, defeatTroopLoss=30%*cost.troops, deductResources, emit siege:defeat
F-Error: territorySys=null → captureTerritory不执行（静默失败） [P1]
F-Error: resourceSys=null → deductSiegeResources静默处理 [P1]
F-Error: cost.troops=NaN → defeatTroopLoss=Math.floor(NaN*0.3)=NaN [P0]
F-Error: dailySiegeCount++无溢出保护（但DAILY_SIEGE_LIMIT=3，checkSiegeConditions已限制） [P2]
```

### B-07: SiegeSystem.isInCaptureCooldown(territoryId)
```
F-Normal: 有timestamp且未过期 → true
F-Boundary: 恰好过期 → false
F-Error: territoryId不存在 → captureTimestamps.get返回undefined → false ✅
```

### B-08: SiegeSystem.serialize/deserialize
```
F-Normal: 正常序列化/反序列化
F-Error: deserialize(null) → data.totalSieges → 崩溃 [P0]
F-Error: deserialize含NaN → totalSieges=NaN [P1]
F-Error: serialize不包含captureTimestamps → 冷却信息丢失 [P0]
F-Error: serialize不包含history → 历史记录丢失 [P1]
```

### B-09: SiegeEnhancer.estimateWinRate(attackerPower, targetTerritoryId)
```
F-Normal: 正常值 → WinRateEstimate
F-Error: attackerPower=NaN → computeWinRate(NaN, defenderPower) → NaN [P0]
F-Error: attackerPower=-100 → -100<=0 true → WIN_RATE_MIN ✅
F-Error: targetTerritoryId不存在 → null ✅
```

### B-10: SiegeEnhancer.calculateDefenderPower(territory)
```
F-Normal: basePower + garrisonBonus
F-Error: territory.defenseValue=NaN → basePower*NaN → NaN [P0]
F-Error: garrisonBonus返回NaN → basePower*(1+NaN) → NaN [P0]
```

### B-11: SiegeEnhancer.computeWinRate (与SiegeSystem重复)
```
⚠️ 两个computeWinRate实现：
  - SiegeSystem: ratio * WIN_RATE_BASE（无terrainBonus参数）
  - SiegeEnhancer: ratio * WIN_RATE_BASE + terrainBonus（有terrainBonus参数）
  公式不完全一致，SiegeEnhancer多了terrainBonus [P1]
```

### B-12: SiegeEnhancer.calculateSiegeReward(territory)
```
F-Normal: 按等级和类型计算奖励
F-Boundary: level=1/level=5
F-Error: territory.level=NaN → NaN乘法传播 → 资源奖励=NaN [P0]
F-Error: territory.id不含'pass-'或'capital-' → typeMultiplier=1.0 ✅
```

### B-13: SiegeEnhancer.executeConquest(...)
```
F-Normal: check→estimate→battle→capture→reward
F-Error: siegeSys=null → fallback到determineBattleOutcome [P1]
F-Error: territorySys=null → territory=null → 失败
```

### B-14: SiegeEnhancer.rollRewardItems(territoryLevel)
```
F-Normal: 按权重随机掉落
F-Boundary: territoryLevel=1 → 只有common道具
F-Error: territoryLevel=NaN → NaN>=entry.minLevel → false → eligible为空 → 返回[] [P1]
```

### B-15: SiegeEnhancer.serialize/deserialize
```
F-Normal: 序列化totalRewardsGranted
F-Error: deserialize(null) → data.totalRewardsGranted → 崩溃 [P0]
```

---

## Part C: GarrisonSystem + MapEventSystem + MapFilterSystem + MapDataRenderer

### C-01: GarrisonSystem.assignGarrison(territoryId, generalId)
```
F-Normal: 全校验通过 → 驻防成功
F-Error: territoryId不存在 → TERRITORY_NOT_FOUND
F-Error: territory非player → TERRITORY_NOT_OWNED
F-Error: generalId不存在 → GENERAL_NOT_FOUND
F-Error: 武将已在其他领土驻防 → GENERAL_ALREADY_GARRISONED
F-Error: 武将在编队中 → GENERAL_IN_FORMATION
F-Error: 领土已有驻防 → TERRITORY_ALREADY_GARRISONED
F-Error: territorySys=null → getTerritoryById返回null → TERRITORY_NOT_FOUND [P1]
F-Error: heroSys=null → getGeneralData返回null → GENERAL_NOT_FOUND [P1]
```

### C-02: GarrisonSystem.withdrawGarrison(territoryId)
```
F-Normal: 有驻防 → 移除 → emit garrison:withdrawn
F-Error: 无驻防 → success=false
```

### C-03: GarrisonSystem.calculateBonus(general, baseProduction)
```
F-Normal: defenseBonus = defense * DEFENSE_BONUS_FACTOR
F-Normal: productionBonus = baseProduction * qualityBonus
F-Error: general.baseStats.defense=NaN → defenseBonus=NaN [P0]
F-Error: baseProduction.grain=NaN → NaN*qualityBonus=NaN [P0]
F-Error: general.quality不在QUALITY_PRODUCTION_BONUS → qualityBonus=0.05(fallback) ✅
```

### C-04: GarrisonSystem.getEffectiveDefense(territoryId, baseDefense)
```
F-Normal: baseDefense * (1 + bonus.defenseBonus)
F-Error: baseDefense=NaN → NaN*(1+bonus) → NaN [P0]
F-Error: bonus.defenseBonus=NaN → baseDefense*(1+NaN) → NaN [P0]
```

### C-05: GarrisonSystem.serialize/deserialize
```
F-Normal: 序列化assignments数组
F-Error: deserialize(null) → data?.assignments → undefined → clear ✅
F-Error: deserialize含无效territoryId → 仍写入assignments [P1]
```

### C-06: MapEventSystem.checkAndTrigger(now)
```
F-Normal: 过了interval + 10%概率 → 新事件
F-Boundary: activeEvents=3 → 不触发
F-Error: now=NaN → now-lastCheckTime → NaN → NaN<interval → false → 不触发 ✅
F-Error: now=0 → 首次检查(lastCheckTime=0) → 0-0=0 < interval → 不触发 ✅
```

### C-07: MapEventSystem.resolveEvent(eventId, choice)
```
F-Normal: 有效事件+有效选择 → rewards+移除+resolvedCount++
F-Error: eventId不存在 → success=false, rewards=[]
F-Error: choice无效（如'attack'但config.choices不含'attack'） → rewards=[] [P1]
F-Error: eventId=null → findIndex返回-1 → success=false ✅
```

### C-08: MapEventSystem.cleanExpiredEvents(now)
```
F-Normal: now>expiresAt → 移除
F-Error: now=NaN → NaN>=expiresAt → false → 不过期（事件永不过期） [P1]
F-Error: event.expiresAt=null → 不过期 ✅
```

### C-09: MapEventSystem.serialize/deserialize
```
F-Normal: 正常序列化
F-Error: deserialize(null) → !data → return ✅
F-Error: deserialize(version≠SAVE_VERSION) → return ✅
F-Error: deserialize含NaN字段 → 直接赋值 [P1]
```

### C-10: MapEventSystem.forceTrigger(eventType, now)
```
F-Normal: 指定类型触发
F-Error: eventType无效 → throw Error [P1]
F-Error: activeEvents=3 → 返回最后一个事件（不创建新的）
```

### C-11: MapFilterSystem.filter(tiles, landmarks, criteria)
```
F-Normal: 多条件筛选
F-Error: tiles=null → .filter崩溃 [P0]
F-Error: criteria=null → criteria.regions → 崩溃 [P0]
F-Error: criteria.regions=[] → 不筛选该维度 ✅
```

### C-12: MapDataRenderer.computeVisibleRange(viewport)
```
F-Normal: 正常视口 → 有效范围
F-Error: viewport.zoom=0 → 除以0 → Infinity → Math.floor(Infinity)=Infinity [P0]
F-Error: viewport.zoom=NaN → NaN运算传播 [P0]
F-Error: viewport.offsetX=NaN → NaN传播 [P1]
```

### C-13: MapDataRenderer.clampViewport(viewport)
```
F-Normal: 约束在合法范围
F-Error: viewport含NaN → Math.min/max(NaN) → NaN [P1]
```

### C-14: map-event-config EVENT_TYPE_CONFIGS
```
F-Normal: 5种事件类型
F-Error: disaster的choices不含'attack' → 但attackRewards=[] → resolveEvent选attack时走default分支rewards=[] [P1]
F-验证: EVENT_TYPE_CONFIGS长度=5 vs MapEventType枚举值=5 ✅
```

---

## 特别关注项汇总（23模式扫描）

| # | 模式 | 严重度 | 影响范围 | 状态 |
|---|------|--------|---------|------|
| S-01 | NaN绕过<=0检查（模式9） | 🔴 P0 | SiegeSystem.checkSiegeConditions troops/grain比较 | uncovered |
| S-02 | NaN传播到胜率计算（模式9） | 🔴 P0 | SiegeSystem.computeWinRate, SiegeEnhancer.computeWinRate | uncovered |
| S-03 | NaN传播到奖励计算（模式9） | 🔴 P0 | SiegeEnhancer.calculateSiegeReward, GarrisonSystem.calculateBonus | uncovered |
| S-04 | 负值防御值（模式3） | 🔴 P0 | SiegeSystem.calculateSiegeCost defenseValue<0 → 负消耗 | uncovered |
| S-05 | 资源比较NaN绕过（模式21） | 🔴 P0 | SiegeSystem.checkSiegeConditions NaN<cost → false → 绕过检查 | uncovered |
| S-06 | 保存缺失captureTimestamps（模式7） | 🔴 P0 | SiegeSystem.serialize不保存冷却时间戳 | uncovered |
| S-07 | deserialize(null)崩溃（模式1） | 🔴 P0 | WorldMapSystem, TerritorySystem, SiegeSystem, SiegeEnhancer | uncovered |
| S-08 | 双系统胜率公式不一致（模式11） | 🟡 P1 | SiegeSystem vs SiegeEnhancer computeWinRate | uncovered |
| S-09 | upgradeLandmark level=NaN（模式2） | 🔴 P0 | WorldMapSystem.upgradeLandmark NaN>=5 → false → 执行升级 | uncovered |
| S-10 | 视口zoom=0除零（模式2） | 🔴 P0 | MapDataRenderer.computeVisibleRange zoom=0 → Infinity | uncovered |
| S-11 | MapFilterSystem null输入崩溃（模式1） | 🔴 P0 | filter(tiles=null) / filter(criteria=null) | uncovered |
| S-12 | TerritorySystem.deserialize level=NaN（模式2） | 🔴 P0 | calculateProduction(baseProduction, NaN) | uncovered |
| S-13 | captureTerritory newOwner=null（模式1） | 🔴 P0 | TerritorySystem.captureTerritory(id, null) → ownership=null | uncovered |
| S-14 | setZoom(NaN)（模式2） | 🔴 P0 | WorldMapSystem.setZoom → Math.max/min(NaN) → NaN | uncovered |
| S-15 | setViewportOffset(NaN)（模式2） | 🔴 P0 | WorldMapSystem.setViewportOffset → offsetX=NaN | uncovered |
| S-16 | calculateSiegeCost defenseValue=NaN（模式9） | 🔴 P0 | NaN乘法 → cost.troops=NaN → 后续全链NaN | uncovered |
| S-17 | getEffectiveDefense NaN（模式9） | 🔴 P0 | GarrisonSystem baseDefense=NaN → NaN传播 | uncovered |
| S-18 | calculateBonus NaN（模式9） | 🔴 P0 | GarrisonSystem defense=NaN/production=NaN | uncovered |
| S-19 | production汇总NaN累加（模式2） | 🔴 P0 | TerritorySystem.getPlayerProductionSummary | uncovered |
| S-20 | 配置-枚举同步（模式17） | 🟡 P1 | MapEventType vs EVENT_TYPE_CONFIGS | covered ✅ |
| S-21 | 保存/加载覆盖（模式15） | 🔴 P0 | 需验证engine-save是否覆盖Map全部8个子系统 | uncovered |
| S-22 | 免费攻城漏洞（模式23） | 🟡 P1 | deductSiegeResources依赖可选resourceSys | uncovered |
| S-23 | 序列化Infinity风险（模式18） | 🟡 P1 | viewport值可能为Infinity | uncovered |

## Top 15 P0 Uncovered 节点

| # | 节点 | 子系统 | 描述 |
|---|------|--------|------|
| 1 | checkSiegeConditions(troops=NaN) | SiegeSystem | NaN<cost → false → 绕过兵力检查 |
| 2 | checkSiegeConditions(grain=NaN) | SiegeSystem | NaN<cost → false → 绕过粮草检查 |
| 3 | computeWinRate(NaN, defender) | SiegeSystem | 胜率=NaN |
| 4 | computeWinRate(NaN, defender) | SiegeEnhancer | 胜率=NaN（两处重复） |
| 5 | calculateSiegeCost(defenseValue=NaN) | SiegeSystem | cost.troops=NaN |
| 6 | calculateSiegeCost(defenseValue=-100) | SiegeSystem | cost.troops=-100（负消耗） |
| 7 | serialize不保存captureTimestamps | SiegeSystem | 冷却信息丢失 |
| 8 | deserialize(null) | WorldMapSystem | Object.entries(null)崩溃 |
| 9 | deserialize(null) | TerritorySystem | Object.entries(null)崩溃 |
| 10 | deserialize(null) | SiegeSystem | data.totalSieges崩溃 |
| 11 | upgradeLandmark(level=NaN) | WorldMapSystem | NaN>=5 → false → 非法升级 |
| 12 | setZoom(NaN) | WorldMapSystem | Math.max/min(NaN) → NaN |
| 13 | computeVisibleRange(zoom=0) | MapDataRenderer | 除以0 → Infinity |
| 14 | filter(tiles=null) | MapFilterSystem | null.filter崩溃 |
| 15 | deserialize(level=NaN) | TerritorySystem | calculateProduction(NaN) |

## 与其他模块对比

| 维度 | Hero R1 | Battle R1 | Map R1 |
|------|---------|-----------|--------|
| 总节点数 | ~420 | 488 | 340 |
| P0节点数 | ~32 | 57 | 36 |
| NaN相关P0 | 5+ | 8 | 12 |
| deserialize(null)P0 | 2 | 4 | 4 |
| 跨系统链路 | 10 | 30 | 16 |
