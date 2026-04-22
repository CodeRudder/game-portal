# v16.0 传承有序 — Play 文档 (Round 2)

> 版本: v16.0 传承有序 | 引擎域: engine/heritage/(HeritageSystem + HeritageSimulation)
> 日期: 2025-07-20 | 轮次: Round 2

## P1: 武将传承 → 品质校验 → 同阵营加成 → 经验转移 → 源武将重置

```
1. HeritageSystem.executeHeroHeritage(request)
   → checkDailyReset() → dailyHeritageCount < 10
   → heroCallback(sourceId) → 品质≥minSourceQuality(2)
   → heroCallback(targetId) → 品质≥minTargetQuality(3)
2. 效率: baseEfficiency = QUALITY_EXP_EFFICIENCY[source.quality]
   → 同阵营+0.1 / 异阵营-0.1 → clamp(base+modifier, 0, 1)
3. transferredExp = floor(source.exp × efficiency × options.expEfficiency)
   → updateHero(target, {exp, skillLevels?, favorability?})
   → updateHero(source, {level:1, exp:0}) // sourceAfterState='reset'
4. copperCost = source.level × 500 → recordHeritage
```
**验证**: 精良(2)→稀有(3)同阵营 = 0.4+0.1 = **0.5效率**

## P2: 装备传承 → 同部位校验 → 品质差效率 → 强化等级转移 → 源装备消耗

```
1. executeEquipmentHeritage(request) → mustSameSlot=true
   → transferredLevel = max(0, source.enhanceLevel - levelLoss)
2. 品质差: same=1.0 / higher_1=0.9 / lower_1=1.1
   → finalLevel = floor(transferredLevel × efficiency)
3. updateEquip(target, {enhanceLevel: finalLevel})
   → sourceAfterState='consumed' → removeEquip(source.uid)
4. copperCost = rawLevel × 200
```
**验证**: +10装备传给高1品质 = floor((10-1)×0.9) = **+8**

## P3: 经验传承 → 等级校验 → 比例限制 → 双向更新

```
1. executeExperienceHeritage(request) → source.level ≥ 10
   → ratio = min(request.expRatio, maxExpRatio=0.8)
2. transferredExp = floor(source.exp × ratio × efficiency=0.7)
   → updateHero(source, {exp: source.exp - floor(source.exp×ratio)})
   → updateHero(target, {exp: target.exp + transferredExp})
3. copperCost = floor(source.level × 100 × ratio)
```
**验证**: ratio=0.8, eff=0.7 → 实际转移 = source.exp×0.56

## P4: 转生后加速 → 初始赠送 → 瞬间升级 → 一键重建

```
1. initRebirthAcceleration() → 创建初始加速状态
2. claimInitialGift() → {grain:5000, copper:3000, enhanceStone:10} 一次性
3. instantUpgrade(buildingId) → 次数上限 = rebirthCount × 5
4. executeRebuild() → [castle,farm,lumber,barracks,academy] 按优先级
```
**验证**: 2次转生 → 瞬间升级上限 = **10次**

## P5: 收益模拟器 → 倍率对比 → 推荐时机 → 置信度

```
1. simulateEarnings(params)
   → immediateMultiplier = calcRebirthMultiplier(count+1)
   → immediateEarnings = calcEarnings(multiplier, 30天, dailyHours)
2. waitEarnings = calcEarnings(multiplier, 30-waitDays, dailyHours)
3. 拐点: SIMULATION_DIMINISHING_THRESHOLD = 24h
4. confidence = min(1, dailyOnlineHours / 8)
```
**验证**: dailyHours=4 → confidence = **0.5**

---

## 交叉验证矩阵

| 流程 | HeritageSys | Simulation | Config | Types | UI | Deps |
|------|:-----------:|:----------:|:------:|:-----:|:--:|:----:|
| P1   | ✅ | — | ✅ | ✅ | ✅ | ✅ |
| P2   | ✅ | — | ✅ | ✅ | ✅ | ✅ |
| P3   | ✅ | — | ✅ | ✅ | — | ✅ |
| P4   | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| P5   | ✅ | ✅ | ✅ | ✅ | — | ✅ |
