# Battle模块挑战清单 — Round 1

> 生成时间: 2025-05-01
> 挑战者: TreeChallenger (Tester Agent)
> 范围: `src/games/three-kingdoms/engine/battle/` 全部源码 + `__tests__/` 全部测试

---

## 统计

| 指标 | 数值 |
|------|------|
| 源码文件数（非test/config/types） | 16 |
| 测试文件数 | 27 |
| 测试用例总数（估算） | ~2,300 |
| System 公开 API 总数 | ~143 |
| 已测试 API 数（估算） | ~110 |
| 未测试 API 数（估算） | ~33 |
| API 覆盖率 | **~77%** |

### 各 System API 覆盖概览

| System | 公开 API 数 | 已测试 | 覆盖率 | 测试文件 |
|--------|------------|--------|--------|----------|
| BattleEngine | 22 | 18 | 82% | BattleEngine-p1/p2/boundary/v4/skip/path-coverage.test.ts |
| DamageCalculator | 10 | 10 | 100% | DamageCalculator.test.ts, DamageCalculator.adversarial.test.ts |
| BattleTurnExecutor | 8 | 7 | 88% | BattleTurnExecutor.test.ts, -p1/p2/combat.test.ts |
| BattleTargetSelector | 7 | 7 | 100% | BattleTargetSelector.test.ts |
| UltimateSkillSystem | 16 | 14 | 88% | UltimateSkillSystem.test.ts |
| BattleSpeedController | 14 | 12 | 86% | BattleSpeedController.test.ts |
| BattleEffectApplier | 10 | 9 | 90% | BattleEffectApplier.test.ts |
| BattleEffectManager | 12 | 9 | 75% | BattleEffectManager-p1/p2.test.ts |
| DamageNumberSystem | 10 | 9 | 90% | DamageNumberSystem.test.ts |
| BattleStatistics | 4 | 4 | 100% | BattleStatistics.test.ts |
| BattleFragmentRewards | 2 | 2 | 100% | BattleFragmentRewards.test.ts |
| autoFormation | 1 | 1 | 100% | autoFormation.test.ts |
| battle-helpers | 8 | 8 | 100% | battle-helpers.test.ts |

---

## F-Normal 遗漏（公开API完全没有测试）

| # | System | API | 说明 |
|---|--------|-----|------|
| 1 | BattleEngine | `quickBattle(allyTeam, enemyTeam)` 结果与 `initBattle+skipBattle` 等价性验证 | 虽有基础测试但缺少与手动流程的对比验证 |
| 2 | BattleEngine | `isSkipMode()` | 无独立测试 |
| 3 | BattleEngine | `isTimeStopPaused()` | 无独立测试，仅在间接场景中覆盖 |
| 4 | BattleEngine | `getUltimateSystem()` | 无测试验证返回值正确 |
| 5 | BattleEngine | `getSpeedController()` | 无测试验证返回值正确 |
| 6 | BattleEngine | `getAdjustedTurnInterval()` | 仅在skip模式测试中间接覆盖，X1/X2/X4无独立验证 |
| 7 | BattleEngine | `getAnimationSpeedScale()` | 无独立测试 |
| 8 | BattleEffectManager | `generateHealAnimation(healerId, targetId, amount)` | 治疗动画无独立验证 |
| 9 | BattleEffectManager | `generateDotAnimation(targetId, dmg)` | DOT动画无独立验证 |
| 10 | BattleEffectManager | `update(currentTime)` | 生命周期update无独立测试 |
| 11 | BattleEffectApplier | `reset()` | 重置后techEffect=null未验证 |
| 12 | DamageNumberSystem | `createBatchDamageNumbers(...)` | 批量创建便捷方法测试不足 |
| 13 | DamageNumberSystem | `updateConfig(partial)` 动态更新 | 配置动态更新后行为验证 |

---

## F-Boundary 遗漏（缺少边界条件测试）

| # | System | API | 边界条件 | 说明 |
|---|--------|-----|----------|------|
| 1 | BattleEngine | `initBattle(allyTeam, enemyTeam)` | allyTeam=null / enemyTeam=null | **P0** 空指针防护缺失，源码直接解构team.units |
| 2 | BattleEngine | `initBattle` | team.units包含死亡单位 | 死亡单位是否参与turnOrder？源码buildTurnOrder使用getAliveUnits过滤，但initBattle直接调用buildTurnOrder，应确认 |
| 3 | BattleEngine | `executeTurn(state)` | state.turnOrder=undefined | **P0** 损坏state防护 |
| 4 | BattleEngine | `runFullBattle` | 双方完全相同属性 | 可能产生极长战斗或无限循环？MAX_TURNS=8保护 |
| 5 | DamageCalculator | `calculateDamage` | attacker.attack=0 | **P0** 零攻击力时baseDamage=max(1,0-0)=1，保底机制是否正确触发 |
| 6 | DamageCalculator | `calculateDamage` | skillMultiplier=0 | 最终伤害=0，保底机制是否触发 |
| 7 | DamageCalculator | `calculateDamage` | skillMultiplier<0 | 负倍率行为不确定 |
| 8 | DamageCalculator | `calculateDamage` | 双方全零属性 | attack=0, defense=0, speed=0 |
| 9 | DamageCalculator | `applyDamage` | damage=负数 | 负伤害是否"治疗"？源码无防护 |
| 10 | DamageCalculator | `applyDamage` | damage=NaN/Infinity | 非法数值防护 |
| 11 | BattleTurnExecutor | `executeUnitAction` | actor=null | **P0** 空actor防护 |
| 12 | BattleTurnExecutor | `selectSkill` | rage=100但所有active技能rageCost>100 | 怒气满足阈值但不足以支付任何技能 |
| 13 | BattleTurnExecutor | `selectSkill` | 技能列表为空 skills=[] | 无普攻技能定义 |
| 14 | BattleTurnExecutor | `endTurn` | 所有Buff remainingTurns=0 | 全部被移除，无残留 |
| 15 | BattleTargetSelector | `selectSingleTarget` | 前排后排全灭 | 返回空数组，后续executeUnitAction返回null |
| 16 | BattleTargetSelector | `SINGLE_ALLY` | 己方全灭 | 返回空数组 |
| 17 | BattleSpeedController | `setSpeed` | speed=NaN | isValidSpeed是否正确返回false |
| 18 | BattleSpeedController | `deserialize` | 篡改的BattleSpeedState | 反序列化后速度是否合法 |
| 19 | UltimateSkillSystem | `confirmUltimate` | 并发确认（快速双击） | 第二次确认是否被正确拒绝 |
| 20 | UltimateSkillSystem | `pauseForUltimate` | 连续暂停（前一个未确认） | 是否覆盖前一个暂停 |
| 21 | BattleFragmentRewards | `calculateFragmentRewards` | enemyTeam.units含100个单位 | 哈希碰撞概率验证 |
| 22 | autoFormation | `autoFormation` | 所有单位防御相同且HP相同 | 排序稳定性 |
| 23 | BattleEffectManager | `generateSkillEffect` | 极短lifetime特效 | cleanupEffects是否立即清理 |
| 24 | DamageNumberSystem | `createDamageNumber` | damage=0且type=NORMAL | 是否应为IMMUNE |
| 25 | BattleEngine | `skipBattle` | state.phase=INIT | INIT状态跳过是否正常处理 |

---

## F-Cross 遗漏（跨系统交互缺失）

| # | 交互链路 | 说明 | 优先级 |
|---|----------|------|--------|
| 1 | **战斗→碎片奖励→HeroSystem碎片增加** | 胜利后碎片奖励是否正确传递到HeroSystem.addFragment | **P0** |
| 2 | **远征系统→战斗系统** | ExpeditionBattleSystem复用BattleEngine，远征战斗配置是否正确 | **P0** |
| 3 | **skipBattle与runFullBattle结果一致性** | 相同队伍配置下两种方式结果是否一致（outcome/stars） | **P0** |
| 4 | **多场战斗连续执行状态隔离** | 同一BattleEngine实例连续runFullBattle，状态是否隔离 | **P0** |
| 5 | **战斗序列化/反序列化** | BattleState完整序列化→反序列化→继续战斗 | **P0** |
| 6 | **科技加成→BattleEngine→伤害结果** | TechEffectSystem注入BattleEffectApplier→应用到runFullBattle | P1 |
| 7 | **战斗速度→特效管理器联动** | setSpeed(X4)后BattleEffectManager.shouldSimplifyEffects=true | P1 |
| 8 | **autoFormation→BattleEngine** | 自动布阵结果直接传入initBattle，前排承受伤害验证 | P1 |
| 9 | **BattleEngine.reset()→子系统重置** | reset后speedController+ultimateSystem全部重置 | P1 |
| 10 | **战斗模式切换中途战斗** | AUTO→SEMI_AUTO切换，大招时停是否正确触发 | P1 |
| 11 | **HeroDispatchSystem攻击加成→战斗** | 派遣系统攻击加成在战斗中生效 | P1 |
| 12 | **羁绊系统→编队战力→战斗属性** | BondSystem加成在BattleUnit属性中体现 | P1 |
| 13 | **兵种克制→伤害计算→星级评定** | 克制关系影响伤害→影响存活→影响星级 | P1 |
| 14 | **多层Buff叠加→伤害计算** | ATK_UP+DEF_DOWN+克制同时作用的伤害结果 | P1 |
| 15 | **SKIP模式战斗→后续战斗速度恢复** | skipBattle后速度状态是否正确恢复 | P1 |
| 16 | **武将防御属性→战斗受伤量** | 不同防御武将在战斗中受伤差异 | 已覆盖 |

---

## F-Error 遗漏（异常路径缺失）

| # | System | 异常场景 | 说明 | 优先级 |
|---|--------|----------|------|--------|
| 1 | BattleEngine | null/undefined队伍传入initBattle | **P0** 源码直接解构team.units，无null检查 |
| 2 | BattleEngine | 损坏的BattleState传入executeTurn | **P0** turnOrder/allyTeam/enemyTeam缺失 |
| 3 | BattleEngine | executeTurn在非IN_PROGRESS阶段调用 | 已覆盖返回空数组 |
| 4 | BattleTurnExecutor | actor为null/undefined传入executeUnitAction | **P0** 源码直接访问actor.buffs/actor.rage |
| 5 | DamageCalculator | attacker/defender为null | calculateDamage直接访问属性 |
| 6 | DamageCalculator | skillMultiplier为NaN/Infinity | 伤害计算结果是否为NaN |
| 7 | DamageCalculator | applyDamage负数伤害 | 负伤害是否导致HP增加（治疗漏洞） |
| 8 | DamageCalculator | reduceShield护盾值为负 | buff.value可能被减为负数 |
| 9 | BattleSpeedController | 反序列化篡改数据 | 速度值=999等非法值 |
| 10 | UltimateSkillSystem | handler抛出异常 | handler回调中抛出错误是否导致战斗卡住 |
| 11 | UltimateSkillSystem | clearTimeout后timeoutId残留 | 定时器竞态条件 |
| 12 | BattleEffectApplier | TechEffectSystem未注入时调用enhanceDamageResult | 已有null检查返回0 |
| 13 | BattleEffectManager | generateSkillEffect传入null skill | element推断失败 |
| 14 | BattleFragmentRewards | simpleHash传入非字符串 | charCodeAt可能报错 |
| 15 | autoFormation | units包含null元素 | filter和sort可能报错 |
| 16 | BattleEngine | runFullBattle无限循环防护 | MAX_TURNS=8是否足够？如果每回合无人死亡 |
| 17 | BattleTurnExecutor | 技能buffs包含无效BuffType | switch不匹配被忽略 |
| 18 | DamageNumberSystem | config.maxNumbers=0 | 立即移除所有数字 |
| 19 | BattleEngine | skipBattle后继续调用executeTurn | SKIP模式下状态是否一致 |
| 20 | BattleSpeedController | listener回调中抛出异常 | notifyListeners是否安全 |

---

## F-Lifecycle 遗漏（生命周期路径缺失）

| # | 生命周期 | 说明 | 优先级 |
|---|----------|------|--------|
| 1 | **战斗状态序列化/反序列化** | BattleState完整serialize→deserialize→继续战斗→结果一致 | **P0** |
| 2 | **多场战斗间状态隔离** | 同一引擎实例连续执行runFullBattle，第二场不受第一场影响 | **P0** |
| 3 | **战斗引擎reset生命周期** | 创建→使用→reset→再使用，reset后所有子系统状态正确 | **P0** |
| 4 | **武将→BattleUnit→战斗→结果→碎片→资源 端到端** | 从HeroSystem武将数据到最终碎片奖励的完整链路 | **P0** |
| 5 | **SKIP模式→后续战斗速度恢复** | skipBattle设置SKIP→后续runFullBattle速度应恢复 | P1 |
| 6 | **BattleEffectManager完整生命周期** | 创建→生成特效→update清理→clear→再生成 | P1 |
| 7 | **BattleEngine重用连续多场** | 同一引擎runFullBattle 10次，每次结果独立 | P1 |
| 8 | **怒气完整生命周期** | 0→攻击+25→被击+15→100→释放大招→剩余→继续积累 | P1 |
| 9 | **Buff完整生命周期** | 应用(remainingTurns=3)→回合1(2)→回合2(1)→回合3(移除) | 已覆盖 |
| 10 | **技能冷却生命周期** | 释放(cooldown=3)→回合1(2)→回合2(1)→回合3(0)→可再次释放 | 已覆盖 |
| 11 | **大招时停超时→自动确认→战斗继续** | 30s超时自动确认 | 已覆盖 |
| 12 | **战斗中单位死亡→后续回合不参与** | 单位死亡后不再出现在turnOrder中 | 已覆盖 |

---

## 结构性风险（P0 级生产缺陷隐患）

### 风险1：BattleEngine.initBattle 无 null 防护

**源码位置**: `BattleEngine.ts` → `initBattle()`

```typescript
initBattle(allyTeam: BattleTeam, enemyTeam: BattleTeam): BattleState {
  const state = {
    // ...
    allyTeam,   // 直接赋值，无null检查
    enemyTeam,  // 直接赋值，无null检查
  };
  this.turnExecutor.buildTurnOrder(state);  // 内部调用getAliveUnits
}
```

**风险**: 如果 `allyTeam` 或 `enemyTeam` 为 null/undefined，`buildTurnOrder` 中的 `getAliveUnits(state.allyTeam)` 会抛出 TypeError。虽然 TypeScript 类型系统应阻止此情况，但运行时（如从存档反序列化）无法保证。

**建议**: 补充 null guard 或在 `buildTurnOrder` 中添加防御性检查。

### 风险2：DamageCalculator.applyDamage 负伤害漏洞

**源码位置**: `DamageCalculator.ts` → `applyDamage()`

```typescript
applyDamage(defender: BattleUnit, damage: number): number {
  // ...
  const actualDamage = Math.min(remainingDamage, defender.hp);
  defender.hp -= actualDamage;  // 如果remainingDamage为负数，actualDamage可能为负
}
```

**风险**: 如果上游传入负数 `damage`（如技能倍率为负或Buff计算异常），`remainingDamage` 可能为负，导致 `actualDamage` 为负，HP反而增加。这是一个"治疗漏洞"。

**建议**: 在 `applyDamage` 入口添加 `if (damage <= 0) return 0;` 防护。

### 风险3：BattleTurnExecutor.executeUnitAction 无 actor null 检查

**源码位置**: `BattleTurnExecutor.ts` → `executeUnitAction()`

```typescript
executeUnitAction(state: BattleState, actor: BattleUnit): BattleAction | null {
  const dotDamage = this.damageCalculator.calculateDotDamage(actor);  // 直接访问actor
}
```

**风险**: 如果 `actor` 为 null/undefined（如 `findUnit` 返回 undefined），直接访问 `actor` 属性会崩溃。`BattleEngine.executeTurn` 中通过 `findUnit` 获取 actor，虽然有 `!actor` 检查，但仅跳过不报错。

### 风险4：多场战斗状态残留

**源码位置**: `BattleEngine.ts` → `runFullBattle()`

```typescript
runFullBattle(allyTeam, enemyTeam): BattleResult {
  const state = this.initBattle(allyTeam, enemyTeam);  // 每次创建新state
  // ...
}
```

**分析**: `runFullBattle` 每次创建新的 `BattleState`，理论上不存在状态残留。但 `BattleEngine` 实例持有 `battleMode`、`speedController`、`ultimateSystem` 等有状态子系统的引用。如果上一场战斗修改了速度或时停状态且未重置，可能影响下一场。

**建议**: 验证 `runFullBattle` 开始前是否需要重置子系统状态。

### 风险5：skipBattle 与 runFullBattle 结果不一致

**源码位置**: `BattleEngine.ts`

`skipBattle` 调用 `setSpeed(BattleSpeed.SKIP)` 但不恢复。如果后续使用同一引擎实例，速度状态被污染。

**建议**: skipBattle 结束后应恢复原始速度，或在 runFullBattle 开始时重置速度。

---

## 挑战评分

| 维度 | 评分 | 说明 |
|------|------|------|
| API覆盖率 | **7.5/10** | 77%覆盖率，核心系统（DamageCalculator/BattleTargetSelector/BattleStatistics/BattleFragmentRewards/autoFormation/battle-helpers）达100%。但跨系统交互和生命周期维度覆盖严重不足。 |
| 边界遗漏 | **7.0/10** | 核心边界（全灭、零伤害、满怒气、恰好条件）覆盖较好。但null/undefined防护、负数伤害、NaN/Infinity等异常输入防护缺失。 |
| 跨系统遗漏 | **5.5/10** | 28个跨系统节点中14个missing（50%），最关键的缺失：碎片奖励→HeroSystem链路、远征→战斗复用、skipBattle一致性、多场隔离、序列化/反序列化。 |
| 异常路径遗漏 | **6.0/10** | 20项异常路径遗漏，其中3项为P0级（null队伍、损坏state、null actor）。handler回调异常、定时器竞态等也需要关注。 |

| **综合评分** | **6.5/10** | 核心战斗逻辑测试充分，但系统间交互和异常防护是明显短板。 |
