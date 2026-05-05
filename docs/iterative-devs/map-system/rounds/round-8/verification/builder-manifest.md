# Round 8 Builder Manifest

> 生成时间: 2026-05-04
> 构建者: Builder (Claude Agent)
> 范围: I12/I13/I14/I15 攻城战斗全链路

---

## 总览

| 指标 | 值 |
|------|-----|
| 功能点总数 | 7 |
| 有证据 | 7 |
| 无证据 | 0 |
| 单元测试总数 | 170 (28+47+12+31+20+32) |
| 测试通过率 | 100% |

---

## 功能点 1: I13 攻城战斗回合制 (SiegeBattleSystem)

### 实现位置

| 方法 | 文件:行号 |
|------|-----------|
| `createBattle()` | `src/games/three-kingdoms/engine/map/SiegeBattleSystem.ts:291-354` |
| `update(dt)` | `src/games/three-kingdoms/engine/map/SiegeBattleSystem.ts:201-242` |
| 策略时长修正 `STRATEGY_DURATION_MODIFIER` | `src/games/three-kingdoms/engine/map/SiegeBattleSystem.ts:86-91` |
| 战斗结束 emit `battle:completed` | `src/games/three-kingdoms/engine/map/SiegeBattleSystem.ts:231-239` |
| `cancelBattle()` | `src/games/three-kingdoms/engine/map/SiegeBattleSystem.ts:374-388` |
| `destroy()` 委托 `reset()` | `src/games/three-kingdoms/engine/map/SiegeBattleSystem.ts:271-273` |
| `serialize()` | `src/games/three-kingdoms/engine/map/SiegeBattleSystem.ts:397-402` |
| `deserialize()` | `src/games/three-kingdoms/engine/map/SiegeBattleSystem.ts:412-435` |

### 测试文件

`src/games/three-kingdoms/engine/map/__tests__/SiegeBattleSystem.test.ts`

### 测试结果

```
Tests: 28 passed (28)
```

### 覆盖场景

| 场景类型 | 测试用例 |
|----------|----------|
| 正常 | 初始化正确、自定义配置、创建战斗会话、策略修正(-5s/+15s/-3s/+5s)、城防衰减、城防耗尽胜利、时间到达结束、emit battle:completed、取消活跃战斗、emit battle:cancelled、序列化/反序列化/往返一致性 |
| 异常 | 重复 taskId 拒绝(throw)、取消不存在的 taskId 安全处理 |
| 边界 | dt=0 不修改状态、reset 清空所有战斗、默认城防等级=1、destroy 清除所有活跃战斗 |

---

## 功能点 2: I12 行军攻占动画无缝切换 (SiegeBattleAnimationSystem)

### 实现位置

| 方法 | 文件:行号 |
|------|-----------|
| `init()` 注册 battle:started/battle:completed | `src/games/three-kingdoms/engine/map/SiegeBattleAnimationSystem.ts:192-220` |
| 三阶段动画 assembly -> battle -> completed | `src/games/three-kingdoms/engine/map/SiegeBattleAnimationSystem.ts:238-269` |
| `updateBattleProgress()` 桥接 defenseRatio | `src/games/three-kingdoms/engine/map/SiegeBattleAnimationSystem.ts:377-382` |
| `destroy()` 取消订阅 | `src/games/three-kingdoms/engine/map/SiegeBattleAnimationSystem.ts:300-313` |
| 序列化含 linger 时间 | `src/games/three-kingdoms/engine/map/SiegeBattleAnimationSystem.ts:489-507` |

### 测试文件

`src/games/three-kingdoms/engine/map/__tests__/SiegeBattleAnimationSystem.test.ts`

### 测试结果

```
Tests: 47 passed (47)
```

### 覆盖场景

| 场景类型 | 测试用例 |
|----------|----------|
| 正常 | 初始化正确、自定义配置、init 注册 battle:started/completed 事件、创建攻城动画、emit siegeAnim:started、assembly->battle 精确转换(3s)、phaseChanged 事件、updateBattleProgress、completeSiegeAnimation(胜利/失败)、completed 后 linger 移除(2s)、cancelSiegeAnimation、getAnimation/getActiveAnimations/getAnimCountByPhase、所有4种策略支持、多动画并发、序列化/反序列化/往返、completed 动画 linger 精确恢复、旧存档向后兼容、完整生命周期 |
| 异常 | 重复 taskId 替换旧动画、不存在的 taskId 安全忽略(updateBattleProgress/completeSiegeAnimation/cancelSiegeAnimation)、无效数据反序列化安全处理 |
| 边界 | dt=0 不改变状态、无动画时 update 安全返回、reset 清空所有动画、defenseRatio 限制在 0~1、destroy 移除事件监听、destroy 后事件不再触发、多次 init 幂等(只注册一次)、destroy 后可重新 init、reset 不移除事件监听 |

---

## 功能点 3: I14 攻占结果结算 (SiegeResultCalculator)

### 实现位置

| 方法 | 文件:行号 |
|------|-----------|
| `calculateSettlement()` 完整结算 | `src/games/three-kingdoms/engine/map/SiegeResultCalculator.ts:80-108` |
| `determineOutcome()` 5级结果判定 | `src/games/three-kingdoms/engine/map/SiegeResultCalculator.ts:113-131` |
| `calculateTroopLoss()` 伤亡计算 | `src/games/three-kingdoms/engine/map/SiegeResultCalculator.ts:136-145` |
| `rollHeroInjury()` 将领受伤判定 | `src/games/three-kingdoms/engine/map/SiegeResultCalculator.ts:150-162` |
| 奖励倍率(含首次攻占1.5x) | `src/games/three-kingdoms/engine/map/SiegeResultCalculator.ts:96-97` |

### 测试文件

`src/games/three-kingdoms/engine/map/__tests__/SiegeResultCalculator.test.ts`

### 测试结果

```
Tests: 12 passed (12)
```

### 覆盖场景

| 场景类型 | 测试用例 |
|----------|----------|
| 正常 | 5级结果判定(decisiveVictory/victory/narrowVictory/defeat/rout)、伤亡率在配置范围内、将领受伤概率(Monte Carlo 1000次)、首次攻占1.5x奖励倍率、完整结果结构验证、injuryLevel 限定在允许池内、普通胜利判定(remainingDefense>0) |
| 异常 | 失败/惨败零奖励倍率 |
| 边界 | 确定性 RNG 注入保证可复现 |

---

## 功能点 4: I14 集成 (WorldMapTab battle:completed handler)

### 实现位置

| 方法 | 文件:行号 |
|------|-----------|
| battle:completed 事件处理器 | `src/components/idle/panels/map/WorldMapTab.tsx:622-693` |
| SiegeResultCalculator 调用 | `src/components/idle/panels/map/WorldMapTab.tsx:633-638` |
| SiegeTaskManager.setResult + advanceStatus | `src/components/idle/panels/map/WorldMapTab.tsx:650-667` |
| 回城行军创建 | `src/components/idle/panels/map/WorldMapTab.tsx:670-688` |
| defenseRatio 桥接(SiegeBattle->Animation) | `src/components/idle/panels/map/WorldMapTab.tsx:710-718` |

### 测试文件

`src/games/three-kingdoms/engine/map/__tests__/integration/siege-settlement.integration.test.ts`

### 测试结果

```
Tests: 7 passed (7)
```

### 覆盖场景

| 场景类型 | 测试用例 |
|----------|----------|
| 正常 | decisiveVictory 低伤亡高奖励、defeat 高伤亡无奖励、narrowVictory 将领受伤、完整链路(创建->完成->结算->状态推进)、多个战斗连续完成 |
| 异常 | EventBus handler 异常隔离(计算器不受其他 handler 异常影响) |
| 边界 | rout 城防剩余高+极高伤亡 |

---

## 功能点 5: I15 编队伤亡状态更新 (ExpeditionSystem)

### 实现位置

| 方法 | 文件:行号 |
|------|-----------|
| `applyCasualties()` | `src/games/three-kingdoms/engine/map/ExpeditionSystem.ts:325-346` |
| `calculateRemainingPower()` | `src/games/three-kingdoms/engine/map/ExpeditionSystem.ts:357-364` |
| `getForceHealthColor()` | `src/games/three-kingdoms/engine/map/ExpeditionSystem.ts:377-381` |
| `removeForce()` | `src/games/three-kingdoms/engine/map/ExpeditionSystem.ts:392-394` |

### 测试文件

`src/games/three-kingdoms/engine/map/__tests__/ExpeditionSystem.casualties.test.ts`

### 测试结果

```
Tests: 31 passed (31)
```

### 覆盖场景

| 场景类型 | 测试用例 |
|----------|----------|
| 正常 | 正常扣除伤亡+状态设为returning、将领受伤(轻/中/重)记录、零损失兵力不变、健康编队战力=troops、受伤将领战力倍率(0.9/0.7/0.5)、血色判定(healthy/damaged/critical)、移除编队返回true、组合链路(10%/40%/70%损失+战力+血色) |
| 异常 | 不存在的 forceId 返回 null、heroInjured=true 但 injuryLevel=none 不记录受伤 |
| 边界 | 伤亡超过可用兵力时 troops=0(Math.max保护)、不存在的forceId calculateRemainingPower 返回0、血色边界值(0.30/0.60)、移除不存在的编队返回false、移除returning状态编队、移除后可重新创建同将领编队 |

---

## 功能点 6: I15 回城行军 (MarchingSystem)

### 实现位置

| 方法 | 文件:行号 |
|------|-----------|
| `createReturnMarch()` 速度 x 0.8 | `src/games/three-kingdoms/engine/map/MarchingSystem.ts:341-369` |

### 测试文件

`src/games/three-kingdoms/engine/map/__tests__/integration/return-march.integration.test.ts`

### 测试结果

```
Tests: 9 passed (9)
```

### 覆盖场景

| 场景类型 | 测试用例 |
|----------|----------|
| 正常 | 完整链路(创建编队->出征->战斗结束->伤亡应用->行军创建+事件发布)、战斗失败+将领受伤+剩余战力、血色随伤亡等级变化(healthy/damaged/critical递进)、编队回城到达后移除、移除后将领不再忙碌 |
| 异常 | 无 |
| 边界 | 多个编队部分移除不影响其他编队 |

---

## 功能点 7: 集成测试覆盖

### 测试文件

| 测试文件 | 测试数 | 结果 |
|----------|--------|------|
| `siege-battle-chain.integration.test.ts` | 4 | 4 passed |
| `siege-settlement.integration.test.ts` | 7 | 7 passed |
| `return-march.integration.test.ts` | 9 | 9 passed |
| `PixelWorldMap.siege-render.test.tsx` | 32 | 32 passed |

### 测试结果汇总

```
siege-battle-chain:  4 passed (4)
siege-settlement:    7 passed (7)
return-march:        9 passed (9)
PixelWorldMap:      32 passed (32)
Integration total:  52 passed (52)
```

### 覆盖场景

**siege-battle-chain.integration.test.ts:**
- Scenario A: 完整生命周期 (create -> assembly -> battle -> completed -> destroy)
- Scenario B: defenseRatio 手动桥接 (逐帧同步城防比值, 单调递减验证)
- Scenario C: 多任务并发 (两个独立战斗/动画并行, 不同时序完成)
- Scenario D: cancelBattle 中断 (取消后动画残留)

**siege-settlement.integration.test.ts:**
- decisiveVictory + 首次攻占奖励
- defeat + 高伤亡 + 无奖励
- narrowVictory + 将领受伤
- 完整链路: 创建战斗 -> 完成 -> 结算 -> 状态推进
- 多个战斗连续完成
- rout: 城防剩余高 + 极高伤亡
- EventBus 异常隔离

**return-march.integration.test.ts:**
- 战斗结束 -> 伤亡应用 -> 回城行军创建完整流程
- 战斗失败 + 将领受伤 + 剩余战力计算
- 编队血色随伤亡等级变化(healthy/damaged/critical递进)
- 编队回城到达后移除 + 将领释放
- 多编队部分移除隔离

**PixelWorldMap.siege-render.test.tsx:**
- renderAssemblyPhase: ctx.fillRect/fillText/measureText、globalAlpha闪烁、阵营颜色
- renderBattlePhase: ctx.fillRect(粒子+血条)、血条颜色(绿/黄/红)、4种策略特效(forceAttack/siege/nightRaid/insider)
- renderCompletedPhase-胜利: 金色填充、旗杆、光环、旗帜纹理
- renderCompletedPhase-失败: 灰色填充、无金色、烟雾粒子、不同fillRect模式
- ctx.save/restore 配对验证(assembly/battle/completed/多动画)
- 渲染安全性: 空/undefined数组不崩溃、多同阶段不崩溃、所有策略/阵营不崩溃、defenseRatio边界值(0/1)不崩溃

---

## 测试执行日志

```
$ npx vitest run src/games/three-kingdoms/engine/map/__tests__/SiegeBattleSystem.test.ts
  Tests: 28 passed (28) | Duration: 393ms

$ npx vitest run src/games/three-kingdoms/engine/map/__tests__/SiegeBattleAnimationSystem.test.ts
  Tests: 47 passed (47) | Duration: 408ms

$ npx vitest run src/games/three-kingdoms/engine/map/__tests__/SiegeResultCalculator.test.ts
  Tests: 12 passed (12) | Duration: 459ms

$ npx vitest run src/games/three-kingdoms/engine/map/__tests__/ExpeditionSystem.casualties.test.ts
  Tests: 31 passed (31) | Duration: 392ms

$ npx vitest run src/games/three-kingdoms/engine/map/__tests__/integration/siege-battle-chain.integration.test.ts \
    src/games/three-kingdoms/engine/map/__tests__/integration/siege-settlement.integration.test.ts \
    src/games/three-kingdoms/engine/map/__tests__/integration/return-march.integration.test.ts
  Tests: 20 passed (20) | Duration: 479ms

$ npx vitest run src/components/idle/panels/map/__tests__/PixelWorldMap.siege-render.test.tsx
  Tests: 32 passed (32) | Duration: 482ms
```

**总计: 170 tests passed, 0 failed**

---

## 结论

Round 8 所有 9 个 Task 的功能点均已完整实现且有测试覆盖:
- 7 个功能点全部有实现证据和通过测试
- 0 个功能点无证据
- 正常/异常/边界场景均有覆盖
