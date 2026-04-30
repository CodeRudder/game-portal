# Battle 流程分支树 Round 1 — Part A: 核心引擎层

> Builder: TreeBuilder v1.3 | Time: 2026-05-01
> 文件: BattleEngine.ts (552行) · BattleTurnExecutor.ts (355行) · DamageCalculator.ts (424行) · BattleTargetSelector.ts (87行) · autoFormation.ts (76行) · battle.types.ts (317行) · battle-base.types.ts (205行)

---

## 子系统: BattleEngine

### API: initBattle(allyTeam, enemyTeam)
| # | 分支条件 | 预期行为 | 状态 | 优先级 | 源码/测试位置 |
|---|---------|---------|------|--------|--------------|
| 1 | 正常双方队伍（各6人） | 创建BattleState，生成turnOrder | covered | P0 | `BattleEngine-p1.test.ts` |
| 2 | allyTeam=null | 抛出Error "teams cannot be null" | covered | P0 | `P0-crash-fixes.test.ts:DEF-004` |
| 3 | enemyTeam=undefined | 抛出Error | covered | P0 | `P0-crash-fixes.test.ts:DEF-004` |
| 4 | allyTeam.units=[] 空队伍 | 正常创建state，turnOrder=[] | uncovered | P0 | — |
| 5 | enemyTeam.units=[] 空队伍 | 正常创建state，turnOrder=[] | uncovered | P0 | — |
| 6 | 队伍含已死亡单位(isAlive=false) | 仅存活单位参与turnOrder | covered | P1 | `BattleEngine-p1.test.ts` |
| 7 | 双方各1人 | 正常创建，turnOrder含2人 | covered | P1 | `BattleEngine-p1.test.ts` |
| 8 | allyTeam和enemyTeam是同一引用 | 正常创建（不深拷贝） | uncovered | P2 | — |
| 9 | units中含NaN speed | sortBySpeed可能异常排序 | uncovered | P0 | — |
| 10 | units中含Infinity attack | 正常创建但后续伤害可能溢出 | uncovered | P1 | — |

### API: executeTurn(state)
| # | 分支条件 | 预期行为 | 状态 | 优先级 | 源码/测试位置 |
|---|---------|---------|------|--------|--------------|
| 1 | 正常IN_PROGRESS状态 | 执行所有存活单位行动，返回actions | covered | P0 | `BattleEngine-p1.test.ts` |
| 2 | phase=FINISHED | 返回空数组[] | covered | P0 | `BattleEngine-p1.test.ts` |
| 3 | phase=INIT | 返回空数组[]（INIT≠IN_PROGRESS） | uncovered | P0 | — |
| 4 | 一方全灭在回合中发生 | 中断循环，返回已执行actions | covered | P1 | `BattleEngine-p1.test.ts` |
| 5 | 单位在本回合中被击杀 | 跳过该单位行动(actor.isAlive=false) | covered | P1 | `BattleTurnExecutor.test.ts` |
| 6 | SEMI_AUTO模式+大招就绪 | 触发时停→自动确认→释放大招 | covered | P1 | `BattleEngine.v4.test.ts` |
| 7 | AUTO模式+大招就绪 | 不触发时停，直接执行 | covered | P1 | `BattleEngine.v4.test.ts` |
| 8 | state=null | 访问state.phase崩溃 | uncovered | P0 | — |
| 9 | state.turnOrder=[] 空队伍 | for循环不执行，返回[] | uncovered | P1 | — |
| 10 | maxTurns=1且currentTurn=1 | 执行后endTurn设置FINISHED | covered | P1 | `BattleEngine-p1.test.ts` |
| 11 | SEMI_AUTO模式+怒气满但技能在冷却 | 不触发时停，使用普攻 | uncovered | P1 | — |

### API: isBattleOver(state)
| # | 分支条件 | 预期行为 | 状态 | 优先级 | 源码/测试位置 |
|---|---------|---------|------|--------|--------------|
| 1 | 双方都有存活 | 返回false | covered | P0 | `BattleEngine-p1.test.ts` |
| 2 | 我方全灭 | 返回true | covered | P0 | `BattleEngine-p1.test.ts` |
| 3 | 敌方全灭 | 返回true | covered | P0 | `BattleEngine-p1.test.ts` |
| 4 | phase=FINISHED | 返回true（短路） | covered | P0 | `BattleEngine-p1.test.ts` |
| 5 | allyTeam.units含NaN hp | getAliveUnits过滤可能异常 | uncovered | P0 | — |

### API: getBattleResult(state)
| # | 分支条件 | 预期行为 | 状态 | 优先级 | 源码/测试位置 |
|---|---------|---------|------|--------|--------------|
| 1 | 敌方全灭→VICTORY | outcome=VICTORY，计算星级 | covered | P0 | `BattleEngine-p1.test.ts` |
| 2 | 我方全灭→DEFEAT | outcome=DEFEAT，stars=NONE | covered | P0 | `BattleEngine-p1.test.ts` |
| 3 | 回合耗尽→DRAW | outcome=DRAW | covered | P0 | `BattleEngine-p1.test.ts` |
| 4 | VICTORY+存活≥4+回合≤6 | stars=THREE | covered | P0 | `BattleEngine-p1.test.ts` |
| 5 | VICTORY+存活≥4+回合>6 | stars=TWO | covered | P0 | `BattleEngine-p1.test.ts` |
| 6 | VICTORY+存活<4 | stars=ONE | covered | P0 | `BattleEngine-p1.test.ts` |
| 7 | DEFEAT | stars=NONE | covered | P0 | `BattleEngine-p1.test.ts` |
| 8 | DRAW+存活=0 | stars=NONE | covered | P1 | `BattleEngine-p1.test.ts` |
| 9 | 碎片奖励-胜利 | 计算fragmentRewards | covered | P1 | `BattleFragmentRewards.test.ts` |
| 10 | 碎片奖励-失败 | fragmentRewards={} | covered | P1 | `BattleFragmentRewards.test.ts` |
| 11 | actionLog为空 | stats全为0 | uncovered | P1 | — |

### API: runFullBattle(allyTeam, enemyTeam)
| # | 分支条件 | 预期行为 | 状态 | 优先级 | 源码/测试位置 |
|---|---------|---------|------|--------|--------------|
| 1 | 正常队伍 | 自动执行所有回合，返回BattleResult | covered | P0 | `BattleEngine-p1.test.ts` |
| 2 | 一方秒杀（首回合全灭） | 1回合结束 | covered | P1 | `BattleEngine-p1.test.ts` |
| 3 | 达到MAX_TURNS(8回合) | DRAW结束 | covered | P1 | `BattleEngine-p1.test.ts` |
| 4 | allyTeam=null | initBattle抛出Error | covered | P0 | `P0-crash-fixes.test.ts` |
| 5 | SKIP模式后速度恢复 | skipBattle后恢复X1 | covered | P0 | `DEF-010-speed-restore.test.ts` |
| 6 | SEMI_AUTO模式运行 | 自动确认大招 | covered | P1 | `BattleEngine.v4.test.ts` |

### API: skipBattle(state)
| # | 分支条件 | 预期行为 | 状态 | 优先级 | 源码/测试位置 |
|---|---------|---------|------|--------|--------------|
| 1 | IN_PROGRESS状态 | 快速执行所有回合，返回结果 | covered | P0 | `BattleEngine.skip.test.ts` |
| 2 | FINISHED状态 | 返回已有result | covered | P0 | `BattleEngine.skip.test.ts` |
| 3 | FINISHED但result=null | 调用getBattleResult生成 | covered | P1 | `BattleEngine.skip.test.ts` |
| 4 | 结束后恢复X1速度 | setSpeed(X1) | covered | P0 | `DEF-010-speed-restore.test.ts` |

### API: quickBattle(allyTeam, enemyTeam)
| # | 分支条件 | 预期行为 | 状态 | 优先级 | 源码/测试位置 |
|---|---------|---------|------|--------|--------------|
| 1 | 正常队伍 | initBattle+skipBattle | covered | P0 | `BattleEngine.skip.test.ts` |
| 2 | null队伍 | initBattle抛出Error | covered | P0 | `P0-crash-fixes.test.ts` |

### API: serialize(state) / deserialize(data)
| # | 分支条件 | 预期行为 | 状态 | 优先级 | 源码/测试位置 |
|---|---------|---------|------|--------|--------------|
| 1 | 正常state | structuredClone深拷贝 | covered | P0 | `DEF-008-serialize.test.ts` |
| 2 | data=null | 抛出Error | covered | P0 | `DEF-008-serialize.test.ts` |
| 3 | data=非object | 抛出Error | covered | P0 | `DEF-008-serialize.test.ts` |
| 4 | data缺少必要字段 | 抛出Error含字段名 | covered | P0 | `DEF-008-serialize.test.ts` |
| 5 | data含额外字段 | 正常恢复（忽略额外字段） | covered | P1 | `DEF-008-serialize.test.ts` |
| 6 | serialize→deserialize往返 | 数据一致 | covered | P0 | `DEF-008-serialize.test.ts` |
| 7 | data含循环引用 | structuredClone可能抛错 | uncovered | P1 | — |
| 8 | data.actionLog含大量记录 | 性能问题 | uncovered | P2 | — |

### API: setBattleMode(mode) / getBattleMode()
| # | 分支条件 | 预期行为 | 状态 | 优先级 | 源码/测试位置 |
|---|---------|---------|------|--------|--------------|
| 1 | mode=AUTO | 设置AUTO，禁用时停 | covered | P1 | `BattleEngine.v4.test.ts` |
| 2 | mode=SEMI_AUTO | 设置SEMI_AUTO，启用时停 | covered | P1 | `BattleEngine.v4.test.ts` |
| 3 | mode=MANUAL | 设置MANUAL，禁用时停 | uncovered | P1 | — |

### API: ISubsystem适配 (init/update/getState/reset)
| # | 分支条件 | 预期行为 | 状态 | 优先级 | 源码/测试位置 |
|---|---------|---------|------|--------|--------------|
| 1 | init(deps) | 保存deps引用 | covered | P1 | `BattleEngine-p1.test.ts` |
| 2 | reset() | 恢复AUTO+X1+禁用时停 | covered | P1 | `BattleEngine-p1.test.ts` |
| 3 | getState() | 返回{battleMode} | covered | P1 | `BattleEngine-p1.test.ts` |
| 4 | update(dt) | 空操作 | uncovered | P2 | — |

---

## 子系统: DamageCalculator

### API: calculateDamage(attacker, defender, skillMultiplier)
| # | 分支条件 | 预期行为 | 状态 | 优先级 | 源码/测试位置 |
|---|---------|---------|------|--------|--------------|
| 1 | 正常攻击计算 | 返回DamageResult | covered | P0 | `DamageCalculator.test.ts` |
| 2 | attacker.attack=NaN | baseDamage=NaN→返回damage=0 | covered | P0 | `P0-crash-fixes.test.ts:DEF-006` |
| 3 | defender.defense=NaN | rawDamage=NaN→baseDamage=NaN→damage=0 | covered | P0 | `P0-crash-fixes.test.ts:DEF-006` |
| 4 | skillMultiplier=NaN | finalDamage=NaN→返回damage=0 | covered | P0 | `P0-crash-fixes.test.ts:DEF-006` |
| 5 | skillMultiplier=0 | damageAfterSkill=0→可能触发minDamage | uncovered | P0 | — |
| 6 | skillMultiplier<0 | damageAfterSkill<0→可能触发minDamage | uncovered | P0 | — |
| 7 | skillMultiplier=Infinity | finalDamage=Infinity→NaN防护触发 | uncovered | P0 | — |
| 8 | attacker.attack=0 | baseDamage=max(1, -defense)→保底1 | uncovered | P1 | — |
| 9 | defender.defense远大于attack | rawDamage<0→baseDamage=1 | covered | P1 | `DamageCalculator.test.ts` |
| 10 | 暴击判定 | criticalMultiplier=1.5 | covered | P0 | `DamageCalculator.test.ts` |
| 11 | 非暴击 | criticalMultiplier=1.0 | covered | P0 | `DamageCalculator.test.ts` |
| 12 | 克制关系（骑兵→步兵） | restraintMultiplier=1.5 | covered | P0 | `DamageCalculator.test.ts` |
| 13 | 被克制关系（步兵→骑兵） | restraintMultiplier=0.7 | covered | P0 | `DamageCalculator.test.ts` |
| 14 | 无克制（弓兵/谋士） | restraintMultiplier=1.0 | covered | P0 | `DamageCalculator.test.ts` |
| 15 | ATK_UP buff | atkBonus增加 | covered | P1 | `DamageCalculator.test.ts` |
| 16 | ATK_DOWN buff | atkBonus减少 | covered | P1 | `DamageCalculator.test.ts` |
| 17 | DEF_UP buff | defBonus增加 | covered | P1 | `DamageCalculator.test.ts` |
| 18 | DEF_DOWN buff | defBonus减少 | covered | P1 | `DamageCalculator.test.ts` |
| 19 | 多个buff叠加 | 累加计算 | covered | P1 | `DamageCalculator.test.ts` |
| 20 | 最低伤害保底(finalDamage<minDamage) | isMinDamage=true，finalDamage=minDamage | covered | P0 | `DamageCalculator.test.ts` |
| 21 | attacker.speed=NaN | getCriticalRate可能返回NaN | uncovered | P0 | — |
| 22 | attacker.speed=Infinity | getCriticalRate=1.0 | uncovered | P1 | — |
| 23 | attacker=null | 访问属性崩溃 | uncovered | P0 | — |
| 24 | defender=null | 访问属性崩溃 | uncovered | P0 | — |

### API: applyDamage(defender, damage)
| # | 分支条件 | 预期行为 | 状态 | 优先级 | 源码/测试位置 |
|---|---------|---------|------|--------|--------------|
| 1 | 正常伤害 | 扣除HP，返回actualDamage | covered | P0 | `DamageCalculator.test.ts` |
| 2 | damage=NaN | 返回0（NaN防护） | covered | P0 | `P0-crash-fixes.test.ts:DEF-006` |
| 3 | damage=负数 | 返回0（负伤害防护） | covered | P0 | `P0-crash-fixes.test.ts:DEF-005` |
| 4 | damage=0 | 返回0（<=0检查） | covered | P0 | `P0-crash-fixes.test.ts:DEF-005` |
| 5 | damage=Infinity | 正常扣除（可能溢出） | uncovered | P0 | — |
| 6 | defender.isAlive=false | 返回0 | covered | P1 | `DamageCalculator.test.ts` |
| 7 | damage>defender.hp | actualDamage=hp，hp=0，isAlive=false | covered | P0 | `DamageCalculator.test.ts` |
| 8 | damage=defender.hp（恰好击杀） | hp=0，isAlive=false | covered | P1 | `DamageCalculator.test.ts` |
| 9 | 有护盾buff | 先扣护盾再扣HP | covered | P0 | `DamageCalculator.test.ts` |
| 10 | 护盾>damage | 护盾减少，HP不变 | covered | P1 | `DamageCalculator.test.ts` |
| 11 | 多层护盾 | 按顺序减少 | covered | P1 | `DamageCalculator.test.ts` |
| 12 | 护盾值=0 | splice移除buff | covered | P1 | `DamageCalculator.test.ts` |
| 13 | damage=NaN且defender.hp=NaN | NaN防护→返回0 | uncovered | P0 | — |

### API: calculateDotDamage(unit)
| # | 分支条件 | 预期行为 | 状态 | 优先级 | 源码/测试位置 |
|---|---------|---------|------|--------|--------------|
| 1 | BURN buff | maxHp*5% | covered | P0 | `DamageCalculator.test.ts` |
| 2 | POISON buff | maxHp*3% | covered | P0 | `DamageCalculator.test.ts` |
| 3 | BLEED buff | attack*10% | covered | P0 | `DamageCalculator.test.ts` |
| 4 | 无DOT buff | 返回0 | covered | P1 | `DamageCalculator.test.ts` |
| 5 | 多个DOT叠加 | 累加 | covered | P1 | `DamageCalculator.test.ts` |
| 6 | unit.maxHp=NaN | BURN/POISON返回NaN | uncovered | P0 | — |
| 7 | unit.attack=NaN | BLEED返回NaN | uncovered | P0 | — |
| 8 | unit.maxHp=0 | BURN/POISON返回0 | uncovered | P1 | — |

### API: isControlled(unit)
| # | 分支条件 | 预期行为 | 状态 | 优先级 | 源码/测试位置 |
|---|---------|---------|------|--------|--------------|
| 1 | STUN buff | 返回true | covered | P0 | `DamageCalculator.test.ts` |
| 2 | FREEZE buff | 返回true | covered | P0 | `DamageCalculator.test.ts` |
| 3 | 无控制buff | 返回false | covered | P0 | `DamageCalculator.test.ts` |
| 4 | STUN+FREEZE同时 | 返回true | covered | P1 | `DamageCalculator.test.ts` |
| 5 | buffs=[] | 返回false | covered | P1 | `DamageCalculator.test.ts` |

### 辅助函数: getRestraintMultiplier(attackerTroop, defenderTroop)
| # | 分支条件 | 预期行为 | 状态 | 优先级 | 源码/测试位置 |
|---|---------|---------|------|--------|--------------|
| 1 | 骑兵→步兵(克制) | 1.5 | covered | P0 | `DamageCalculator.test.ts` |
| 2 | 步兵→枪兵(克制) | 1.5 | covered | P0 | `DamageCalculator.test.ts` |
| 3 | 枪兵→骑兵(克制) | 1.5 | covered | P0 | `DamageCalculator.test.ts` |
| 4 | 步兵→骑兵(被克制) | 0.7 | covered | P0 | `DamageCalculator.test.ts` |
| 5 | 枪兵→步兵(被克制) | 0.7 | covered | P0 | `DamageCalculator.test.ts` |
| 6 | 骑兵→枪兵(被克制) | 0.7 | covered | P0 | `DamageCalculator.test.ts` |
| 7 | 弓兵→任意 | 1.0 | covered | P0 | `DamageCalculator.test.ts` |
| 8 | 谋士→任意 | 1.0 | covered | P0 | `DamageCalculator.test.ts` |
| 9 | 任意→弓兵 | 1.0 | covered | P0 | `DamageCalculator.test.ts` |
| 10 | 同兵种对打 | 1.0 | covered | P1 | `DamageCalculator.test.ts` |

### 辅助函数: getCriticalRate(speed) / rollCritical(speed)
| # | 分支条件 | 预期行为 | 状态 | 优先级 | 源码/测试位置 |
|---|---------|---------|------|--------|--------------|
| 1 | speed=0 | rate=0.05 | covered | P1 | `DamageCalculator.test.ts` |
| 2 | speed=100 | rate=0.05+1.0=1.0 | covered | P1 | `DamageCalculator.test.ts` |
| 3 | speed=50 | rate=0.55 | covered | P1 | `DamageCalculator.test.ts` |
| 4 | speed=NaN | rate=NaN→Math.min(NaN,1)=NaN | uncovered | P0 | — |
| 5 | speed=-100 | rate=0.05-1.0→Math.max(0,-0.95)=0 | uncovered | P1 | — |
| 6 | speed=Infinity | rate=Infinity→Math.min(Inf,1)=1 | uncovered | P1 | — |

---

## 子系统: BattleTurnExecutor

### API: buildTurnOrder(state)
| # | 分支条件 | 预期行为 | 状态 | 优先级 | 源码/测试位置 |
|---|---------|---------|------|--------|--------------|
| 1 | 双方各3人 | 按速度降序排列 | covered | P0 | `BattleTurnExecutor.test.ts` |
| 2 | 一方全灭 | turnOrder仅含对方 | covered | P1 | `BattleTurnExecutor.test.ts` |
| 3 | 速度相同 | 按ID稳定排序 | covered | P1 | `BattleTurnExecutor.test.ts` |
| 4 | 双方全灭 | turnOrder=[] | uncovered | P1 | — |
| 5 | 所有单位speed=0 | 按ID排序 | uncovered | P2 | — |

### API: executeUnitAction(state, actor)
| # | 分支条件 | 预期行为 | 状态 | 优先级 | 源码/测试位置 |
|---|---------|---------|------|--------|--------------|
| 1 | 正常行动 | 选择技能→选目标→计算伤害→更新怒气 | covered | P0 | `BattleTurnExecutor.test.ts` |
| 2 | DOT伤害→存活 | 先受DOT再行动 | covered | P0 | `BattleTurnExecutor-p2.test.ts` |
| 3 | DOT伤害→死亡 | 返回死亡action | covered | P0 | `BattleTurnExecutor-p2.test.ts` |
| 4 | 被控制(STUN) | 返回控制action，无法行动 | covered | P0 | `BattleTurnExecutor-p2.test.ts` |
| 5 | 被控制(FREEZE) | 返回控制action | covered | P0 | `BattleTurnExecutor-p2.test.ts` |
| 6 | DOT+控制同时存在 | DOT先结算，再检查控制 | covered | P0 | `BattleTurnExecutor-p2.test.ts` |
| 7 | DOT致死在控制检查前 | 返回死亡action，不检查控制 | covered | P0 | `BattleTurnExecutor-p2.test.ts` |
| 8 | 怒气满→释放大招 | 消耗怒气，使用大招技能 | covered | P0 | `BattleTurnExecutor.test.ts` |
| 9 | 怒气不满→普攻 | 使用normalAttack | covered | P0 | `BattleTurnExecutor.test.ts` |
| 10 | 怒气满但技能在冷却 | 使用普攻 | covered | P1 | `BattleTurnExecutor.test.ts` |
| 11 | 怒气满但无主动技能 | 使用普攻 | covered | P1 | `BattleTurnExecutor.test.ts` |
| 12 | 目标全部死亡 | targets=[]→返回null | uncovered | P0 | — |
| 13 | 技能附带buff | 应用buff到目标 | covered | P0 | `BattleTurnExecutor-p2.test.ts` |
| 14 | buff不应用到死亡目标 | 跳过死亡目标 | covered | P0 | `BattleTurnExecutor-p2.test.ts` |
| 15 | 技能冷却更新 | 使用后设置cooldown | covered | P1 | `BattleTurnExecutor-p2.test.ts` |
| 16 | 普攻不设冷却 | currentCooldown不变 | covered | P1 | `BattleTurnExecutor-p2.test.ts` |

### API: endTurn(state)
| # | 分支条件 | 预期行为 | 状态 | 优先级 | 源码/测试位置 |
|---|---------|---------|------|--------|--------------|
| 1 | 正常回合结束 | 减少buff持续时间+技能冷却 | covered | P0 | `BattleTurnExecutor-p2.test.ts` |
| 2 | buff remainingTurns=1 | 移除buff | covered | P0 | `BattleTurnExecutor-p2.test.ts` |
| 3 | buff remainingTurns>1 | 减1 | covered | P1 | `BattleTurnExecutor-p2.test.ts` |
| 4 | 技能冷却=1 | 减为0 | covered | P0 | `BattleTurnExecutor-p2.test.ts` |
| 5 | 技能冷却=0 | 不变 | covered | P1 | `BattleTurnExecutor-p2.test.ts` |
| 6 | currentTurn>=maxTurns | 设置FINISHED | covered | P0 | `BattleTurnExecutor-p2.test.ts` |
| 7 | 空buffs/空skills | 正常处理 | covered | P1 | `BattleTurnExecutor-p2.test.ts` |
| 8 | 双方单位都处理 | ally+enemy都tick | covered | P1 | `BattleTurnExecutor-p2.test.ts` |

---

## 子系统: BattleTargetSelector

### API: selectTargets(state, actor, skill)
| # | 分支条件 | 预期行为 | 状态 | 优先级 | 源码/测试位置 |
|---|---------|---------|------|--------|--------------|
| 1 | SINGLE_ENEMY | 随机选前排1人 | covered | P0 | `BattleTargetSelector.test.ts` |
| 2 | SINGLE_ENEMY+前排全灭 | 选后排 | covered | P0 | `BattleTargetSelector.test.ts` |
| 3 | SINGLE_ENEMY+前后排全灭 | 返回[] | covered | P0 | `BattleTargetSelector.test.ts` |
| 4 | FRONT_ROW | 选前排全部 | covered | P0 | `BattleTargetSelector.test.ts` |
| 5 | FRONT_ROW+前排全灭 | fallback后排 | covered | P0 | `BattleTargetSelector.test.ts` |
| 6 | BACK_ROW | 选后排全部 | covered | P0 | `BattleTargetSelector.test.ts` |
| 7 | BACK_ROW+后排全灭 | fallback前排 | covered | P0 | `BattleTargetSelector.test.ts` |
| 8 | ALL_ENEMY | 所有存活敌方 | covered | P0 | `BattleTargetSelector.test.ts` |
| 9 | ALL_ENEMY+排除死亡 | 仅存活 | covered | P1 | `BattleTurnExecutor-p2.test.ts` |
| 10 | SELF+存活 | [actor] | covered | P0 | `BattleTargetSelector.test.ts` |
| 11 | SELF+死亡 | [] | covered | P0 | `BattleTargetSelector.test.ts` |
| 12 | SINGLE_ALLY | 选HP比例最低的友方 | covered | P0 | `BattleTargetSelector.test.ts` |
| 13 | SINGLE_ALLY+全灭 | [] | uncovered | P1 | — |
| 14 | ALL_ALLY | 所有存活友方 | covered | P0 | `BattleTargetSelector.test.ts` |
| 15 | ALL_ALLY+排除死亡 | 仅存活 | covered | P1 | `BattleTurnExecutor-p2.test.ts` |
| 16 | default(未知targetType) | fallback选单体 | covered | P1 | `BattleTargetSelector.test.ts` |

---

## 子系统: autoFormation

### API: autoFormation(units)
| # | 分支条件 | 预期行为 | 状态 | 优先级 | 源码/测试位置 |
|---|---------|---------|------|--------|--------------|
| 1 | 正常6人队伍 | 防御最高的3人前排，其余后排 | covered | P0 | `autoFormation.test.ts` |
| 2 | 空数组 | 返回空team，score=0 | covered | P0 | `autoFormation.test.ts` |
| 3 | 1人队伍 | 前排1人，后排0人 | covered | P1 | `autoFormation.test.ts` |
| 4 | 3人队伍 | 前排3人，后排0人 | covered | P1 | `autoFormation.test.ts` |
| 5 | 7人队伍(超过6人) | 截取前6人 | covered | P1 | `autoFormation.test.ts` |
| 6 | 含死亡单位 | 过滤掉死亡单位 | covered | P0 | `autoFormation.test.ts` |
| 7 | 全部死亡 | 返回空team | covered | P0 | `autoFormation.test.ts` |
| 8 | 同防御值 | 按HP降序排 | covered | P1 | `autoFormation.test.ts` |
| 9 | 不修改原对象position | 深拷贝后修改 | covered | P0 | `DEF-009-autoFormation.test.ts` |
| 10 | NaN defense | 排序可能异常 | uncovered | P0 | — |
| 11 | NaN maxHp | 排序可能异常 | uncovered | P0 | — |

---

## 子系统: battle-helpers

### API: getAliveUnits / getAliveFrontUnits / getAliveBackUnits
| # | 分支条件 | 预期行为 | 状态 | 优先级 | 源码/测试位置 |
|---|---------|---------|------|--------|--------------|
| 1 | 正常队伍 | 返回isAlive=true的单位 | covered | P0 | `battle-helpers.test.ts` |
| 2 | 全灭 | [] | covered | P0 | `battle-helpers.test.ts` |
| 3 | 前排/后排过滤 | 正确按position过滤 | covered | P0 | `battle-helpers.test.ts` |
| 4 | team.units=undefined | .filter崩溃 | uncovered | P0 | — |

### API: sortBySpeed(units)
| # | 分支条件 | 预期行为 | 状态 | 优先级 | 源码/测试位置 |
|---|---------|---------|------|--------|--------------|
| 1 | 不同速度 | 降序排列 | covered | P0 | `battle-helpers.test.ts` |
| 2 | 相同速度 | 按ID稳定排序 | covered | P0 | `battle-helpers.test.ts` |
| 3 | 空数组 | [] | covered | P1 | `battle-helpers.test.ts` |
| 4 | 含NaN speed | 排序不确定 | uncovered | P0 | — |

### API: getEnemyTeam / getAllyTeam
| # | 分支条件 | 预期行为 | 状态 | 优先级 | 源码/测试位置 |
|---|---------|---------|------|--------|--------------|
| 1 | side='ally' | enemy=enemyTeam, ally=allyTeam | covered | P0 | `battle-helpers.test.ts` |
| 2 | side='enemy' | enemy=allyTeam, ally=enemyTeam | covered | P0 | `battle-helpers.test.ts` |

### API: findUnit / findUnitInTeam
| # | 分支条件 | 预期行为 | 状态 | 优先级 | 源码/测试位置 |
|---|---------|---------|------|--------|--------------|
| 1 | 存在的单位ID | 返回BattleUnit | covered | P0 | `battle-helpers.test.ts` |
| 2 | 不存在的ID | 返回undefined | covered | P0 | `battle-helpers.test.ts` |
| 3 | ally和enemy有相同ID | 返回allyTeam中的 | covered | P1 | `battle-helpers.test.ts` |

---

## 跨系统链路 (Part A 内部)

| # | 链路 | 描述 | 状态 | 优先级 |
|---|------|------|------|--------|
| XA-1 | BattleEngine.initBattle → BattleTurnExecutor.buildTurnOrder | 初始化时生成行动顺序 | covered | P0 |
| XA-2 | BattleEngine.executeTurn → BattleTurnExecutor.executeUnitAction | 每个单位行动委托 | covered | P0 |
| XA-3 | BattleTurnExecutor.executeUnitAction → DamageCalculator.calculateDamage | 伤害计算链路 | covered | P0 |
| XA-4 | BattleTurnExecutor.executeUnitAction → DamageCalculator.applyDamage | 伤害应用链路 | covered | P0 |
| XA-5 | BattleTurnExecutor.executeUnitAction → BattleTargetSelector.selectTargets | 目标选择链路 | covered | P0 |
| XA-6 | BattleEngine.executeTurn → BattleTurnExecutor.endTurn | 回合结束链路 | covered | P0 |
| XA-7 | BattleEngine.getBattleResult → BattleStatistics.calculateBattleStats | 统计链路 | covered | P0 |
| XA-8 | BattleEngine.getBattleResult → BattleFragmentRewards.calculateFragmentRewards | 碎片奖励链路 | covered | P0 |
| XA-9 | DamageCalculator.applyDamage → getShieldAmount | 护盾扣除链路 | covered | P0 |
| XA-10 | BattleEngine.skipBattle → BattleSpeedController.setSpeed(SKIP) | 跳过战斗速度设置 | covered | P0 |
| XA-11 | BattleEngine.runFullBattle → BattleEngine.initBattle+executeTurn循环 | 完整战斗循环 | covered | P0 |
| XA-12 | autoFormation → sortBySpeed(间接) | 布阵不依赖sortBySpeed | covered | P1 |

### 特别关注项（基于Hero模块经验）

| # | 模式 | 检查结果 | 状态 | 优先级 |
|---|------|---------|------|--------|
| S-1 | NaN绕过<=0检查（模式9） | DamageCalculator.applyDamage使用Number.isNaN(damage)防护 ✅ | covered | P0 |
| S-2 | 配置交叉不一致（模式10） | BATTLE_CONFIG.AvailableSpeeds=[1,2,3]但BattleSpeed枚举含X4=4 ⚠️ | uncovered | P0 |
| S-3 | setter/getter注入未调用（模式12） | BattleEngine.init(deps)仅保存引用，未注入到子系统 | uncovered | P1 |
| S-4 | 修复穿透不完整（模式13） | DamageCalculator NaN防护覆盖calculateDamage+applyDamage ✅ | covered | P0 |
| S-5 | 资源溢出无上限（模式14） | 怒气有maxRage上限 ✅，但attack/defense无溢出保护 | uncovered | P1 |
| S-6 | 保存/加载流程缺失（模式15） | BattleEngine.serialize/deserialize仅处理BattleState，不含speedMode/ultimateState | uncovered | P0 |
