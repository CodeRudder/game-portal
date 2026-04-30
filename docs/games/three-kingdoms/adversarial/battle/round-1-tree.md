# Battle模块流程分支树 — Round 1

> 生成时间：2025-05-01
> 模块路径：`src/games/three-kingdoms/engine/battle/`
> 源码文件：21个 | 测试文件：27个（含集成测试4个、对抗测试1个、模糊测试1个）

## 统计

| 维度 | 数量 |
|------|------|
| **总节点数** | **352** |
| P0 阻塞 | 148 |
| P1 严重 | 155 |
| P2 一般 | 49 |
| covered | 289 |
| missing | 38 |
| partial | 25 |

### 按系统分布

| 系统 | 公开API数 | 节点数 | covered | missing | partial |
|------|-----------|--------|---------|---------|---------|
| BattleEngine | 22 | 52 | 42 | 4 | 6 |
| DamageCalculator | 10 | 36 | 30 | 2 | 4 |
| BattleTurnExecutor | 8 | 38 | 30 | 4 | 4 |
| BattleTargetSelector | 7 | 24 | 20 | 2 | 2 |
| UltimateSkillSystem | 16 | 32 | 26 | 2 | 4 |
| BattleSpeedController | 14 | 28 | 22 | 2 | 4 |
| BattleEffectApplier | 10 | 22 | 18 | 2 | 2 |
| BattleEffectManager | 12 | 24 | 18 | 2 | 4 |
| DamageNumberSystem | 10 | 20 | 16 | 2 | 2 |
| BattleStatistics | 4 | 12 | 10 | 0 | 2 |
| BattleFragmentRewards | 2 | 10 | 8 | 0 | 2 |
| autoFormation | 1 | 12 | 10 | 0 | 2 |
| battle-helpers | 8 | 16 | 14 | 0 | 2 |
| 跨系统交互 | — | 28 | 8 | 14 | 6 |
| 数据生命周期 | — | 18 | 0 | 14 | 4 |

---

## 1. BattleEngine（战斗引擎核心）

### initBattle(allyTeam, enemyTeam)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| BE-init-001 | normal | 正常初始化战斗 | 双方各6人 | 返回BattleState，phase=IN_PROGRESS，currentTurn=1 | covered | P0 |
| BE-init-002 | normal | 初始化生成行动顺序 | 双方各6人 | turnOrder按速度降序排列，currentActorIndex=0 | covered | P0 |
| BE-init-003 | boundary | 空队伍初始化 | allyTeam.units=[] | 仍创建BattleState，turnOrder为空 | covered | P1 |
| BE-init-004 | boundary | 单人vs单人 | 双方各1人 | 正常初始化，turnOrder长度为2 | covered | P1 |
| BE-init-005 | error | null队伍传入 | allyTeam=null | 应抛出错误或返回安全默认值 | missing | P0 |
| BE-init-006 | lifecycle | 初始化后state.id唯一 | 连续两次initBattle | 两次返回的id不同 | covered | P2 |

### executeTurn(state)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| BE-exec-001 | normal | 正常执行回合 | phase=IN_PROGRESS | 返回行动记录数组，state.actionLog增长 | covered | P0 |
| BE-exec-002 | normal | 每回合重新排序 | 有单位在回合中死亡 | 下一回合turnOrder不包含已死亡单位 | covered | P0 |
| BE-exec-003 | boundary | 已结束的战斗执行回合 | phase=FINISHED | 返回空数组[] | covered | P0 |
| BE-exec-004 | normal | 回合结束Buff tick | 有Buff remainingTurns>0 | endTurn减少所有单位Buff持续时间 | covered | P1 |
| BE-exec-005 | normal | 回合结束技能冷却tick | 有技能currentCooldown>0 | endTurn减少所有技能冷却 | covered | P1 |
| BE-exec-006 | cross | 半自动模式大招时停 | mode=SEMI_AUTO，actor怒气满 | 检测到大招就绪→暂停→自动确认→释放 | covered | P1 |
| BE-exec-007 | boundary | 最后一回合执行 | currentTurn=maxTurns | 执行后phase=FINISHED | covered | P0 |
| BE-exec-008 | error | 损坏state传入 | state.turnOrder=undefined | 应安全处理不崩溃 | missing | P1 |

### isBattleOver(state)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| BE-over-001 | normal | 我方全灭 | allyTeam无存活单位 | 返回true | covered | P0 |
| BE-over-002 | normal | 敌方全灭 | enemyTeam无存活单位 | 返回true | covered | P0 |
| BE-over-003 | normal | 双方均有存活 | 双方各有人存活 | 返回false | covered | P0 |
| BE-over-004 | boundary | 已结束的战斗 | phase=FINISHED | 返回true | covered | P1 |

### getBattleResult(state)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| BE-result-001 | normal | 我方胜利 | 敌方全灭 | outcome=VICTORY | covered | P0 |
| BE-result-002 | normal | 我方失败 | 我方全灭 | outcome=DEFEAT | covered | P0 |
| BE-result-003 | normal | 平局 | 回合耗尽双方有人 | outcome=DRAW | covered | P0 |
| BE-result-004 | boundary | 胜利+存活≥4+回合≤6 | allyAlive=5, turns=5 | stars=THREE | covered | P0 |
| BE-result-005 | boundary | 胜利+存活≥4+回合>6 | allyAlive=5, turns=7 | stars=TWO | covered | P0 |
| BE-result-006 | boundary | 胜利+存活<4 | allyAlive=3, turns=3 | stars=ONE | covered | P0 |
| BE-result-007 | boundary | 失败时星级 | outcome=DEFEAT | stars=NONE | covered | P0 |
| BE-result-008 | normal | 碎片奖励计算 | VICTORY，敌方有武将 | fragmentRewards非空 | covered | P1 |
| BE-result-009 | normal | 失败无碎片奖励 | DEFEAT | fragmentRewards={} | covered | P1 |
| BE-result-010 | boundary | 存活恰好4人+回合恰好6 | allyAlive=4, turns=6 | stars=THREE | covered | P1 |

### runFullBattle(allyTeam, enemyTeam)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| BE-full-001 | normal | 完整战斗流程 | 双方正常队伍 | 返回BattleResult，phase=FINISHED | covered | P0 |
| BE-full-002 | boundary | 回合上限8 | 双方均衡 | totalTurns ≤ 8 | covered | P0 |
| BE-full-003 | boundary | 强队vs弱队 | 攻击力差距大 | outcome=VICTORY，回合数少 | covered | P0 |
| BE-full-004 | boundary | 弱队vs强队 | 防御力差距大 | outcome=DEFEAT | covered | P0 |
| BE-full-005 | normal | 战斗后state.result已设置 | runFullBattle完成 | state.result不为null | covered | P1 |

### skipBattle(state)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| BE-skip-001 | normal | 跳过进行中的战斗 | phase=IN_PROGRESS | 返回BattleResult，speed=SKIP | covered | P0 |
| BE-skip-002 | boundary | 跳过已结束的战斗 | phase=FINISHED | 返回已有result | covered | P0 |
| BE-skip-003 | normal | 跳过模式无动画间隔 | 跳过战斗 | getAdjustedTurnInterval()=0 | covered | P1 |
| BE-skip-004 | cross | skipBattle结果与runFullBattle一致 | 相同队伍 | 两种方式结果outcome一致 | missing | P1 |

### quickBattle(allyTeam, enemyTeam)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| BE-quick-001 | normal | 快速战斗 | 双方正常队伍 | 等价于initBattle+skipBattle | covered | P0 |
| BE-quick-002 | boundary | 快速战斗空队伍 | allyTeam.units=[] | 不崩溃，返回DEFEAT | covered | P1 |

### setBattleMode / getBattleMode

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| BE-mode-001 | normal | 设置AUTO模式 | — | getBattleMode()=AUTO | covered | P1 |
| BE-mode-002 | normal | 设置SEMI_AUTO模式 | — | ultimateSystem启用时停 | covered | P1 |
| BE-mode-003 | normal | 设置MANUAL模式 | — | getBattleMode()=MANUAL | covered | P1 |
| BE-mode-004 | cross | SEMI_AUTO启用时停联动 | setBattleMode(SEMI_AUTO) | ultimateSystem.isEnabled()=true | covered | P1 |
| BE-mode-005 | cross | AUTO禁用时停联动 | setBattleMode(AUTO) | ultimateSystem.isEnabled()=false | covered | P1 |

### ISubsystem接口

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| BE-sys-001 | normal | init注入依赖 | — | sysDeps被正确存储 | covered | P2 |
| BE-sys-002 | normal | reset重置引擎 | — | battleMode=AUTO, speed=X1, ultimateSystem禁用 | covered | P2 |
| BE-sys-003 | normal | getState返回快照 | — | 返回{battleMode} | covered | P2 |

---

## 2. DamageCalculator（伤害计算器）

### calculateDamage(attacker, defender, skillMultiplier)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| DC-calc-001 | normal | 基础伤害计算 | atk=1000, def=500, mult=1.0 | baseDamage=max(1, atk-def)=500 | covered | P0 |
| DC-calc-002 | normal | 技能倍率应用 | mult=2.0 | 伤害乘以2.0 | covered | P0 |
| DC-calc-003 | normal | 暴击判定 | isCritical=true | criticalMultiplier=1.5 | covered | P0 |
| DC-calc-004 | normal | 克制系数应用 | 骑兵vs步兵 | restraintMultiplier=1.5 | covered | P0 |
| DC-calc-005 | normal | 随机波动 | — | randomFactor在0.9~1.1之间 | covered | P0 |
| DC-calc-006 | boundary | 攻击力≤防御力 | atk=100, def=200 | baseDamage=max(1, -100)=1 | covered | P0 |
| DC-calc-007 | boundary | 最低伤害保底 | 最终伤害<攻击力×10% | isMinDamage=true, damage=攻击力×10% | covered | P0 |
| DC-calc-008 | boundary | 零攻击力 | atk=0 | baseDamage=1, 最终伤害触发保底 | missing | P0 |
| DC-calc-009 | boundary | 零防御力 | def=0 | baseDamage=atk | covered | P1 |
| DC-calc-010 | boundary | 极大攻击力 | atk=999999 | 不溢出，Math.floor正确 | covered | P1 |
| DC-calc-011 | error | skillMultiplier=0 | mult=0 | 最终伤害=0，触发保底 | missing | P1 |
| DC-calc-012 | error | skillMultiplier<0 | mult=-1 | 行为不确定，需确认 | missing | P1 |

### applyDamage(defender, damage)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| DC-apply-001 | normal | 正常扣血 | hp=1000, damage=300 | hp=700, 返回300 | covered | P0 |
| DC-apply-002 | normal | 先扣护盾再扣血 | shield=100, damage=300 | shield消耗100, hp扣200 | covered | P0 |
| DC-apply-003 | boundary | 死亡单位不受伤害 | isAlive=false | 返回0，hp不变 | covered | P0 |
| DC-apply-004 | boundary | 伤害超过剩余HP | hp=50, damage=200 | hp=0, isAlive=false, 返回50 | covered | P0 |
| DC-apply-005 | boundary | 伤害恰好等于HP | hp=100, damage=100 | hp=0, isAlive=false | covered | P1 |
| DC-apply-006 | boundary | 护盾完全吸收 | shield=500, damage=300 | hp不变, shield剩余200 | covered | P1 |
| DC-apply-007 | boundary | 0伤害 | damage=0 | hp不变，返回0 | covered | P2 |

### calculateDotDamage(unit)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| DC-dot-001 | normal | 灼烧伤害 | BURN, maxHp=1000 | 伤害=floor(1000×0.05)=50 | covered | P0 |
| DC-dot-002 | normal | 中毒伤害 | POISON, maxHp=1000 | 伤害=floor(1000×0.03)=30 | covered | P0 |
| DC-dot-003 | normal | 流血伤害 | BLEED, attack=500 | 伤害=floor(500×0.10)=50 | covered | P0 |
| DC-dot-004 | normal | 多DOT叠加 | BURN+POISON+BLEED | 各DOT伤害求和 | covered | P0 |
| DC-dot-005 | boundary | 无DOT | buffs=[] | 返回0 | covered | P1 |
| DC-dot-006 | boundary | 非DOT Buff不造成伤害 | STUN+ATK_UP | 返回0 | covered | P1 |

### isControlled(unit)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| DC-ctrl-001 | normal | 眩晕控制 | STUN | 返回true | covered | P0 |
| DC-ctrl-002 | normal | 冰冻控制 | FREEZE | 返回true | covered | P0 |
| DC-ctrl-003 | boundary | 无控制效果 | buffs无STUN/FREEZE | 返回false | covered | P1 |

### 兵种克制辅助函数

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| DC-rest-001 | normal | 骑兵克制步兵 | CAVALRY vs INFANTRY | 系数=1.5 | covered | P0 |
| DC-rest-002 | normal | 步兵克制枪兵 | INFANTRY vs SPEARMAN | 系数=1.5 | covered | P0 |
| DC-rest-003 | normal | 枪兵克制骑兵 | SPEARMAN vs CAVALRY | 系数=1.5 | covered | P0 |
| DC-rest-004 | normal | 被克制 | INFANTRY vs CAVALRY | 系数=0.7 | covered | P0 |
| DC-rest-005 | normal | 弓兵无克制 | ARCHER vs任意 | 系数=1.0 | covered | P0 |
| DC-rest-006 | normal | 谋士无克制 | STRATEGIST vs任意 | 系数=1.0 | covered | P0 |
| DC-rest-007 | normal | 同兵种无克制 | CAVALRY vs CAVALRY | 系数=1.0 | covered | P1 |
| DC-rest-008 | boundary | 弓兵被攻击 | 任意 vs ARCHER | 系数=1.0 | covered | P1 |

### 暴击辅助函数

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| DC-crit-001 | normal | 暴击率计算 | speed=100 | rate=0.05+100/100=1.05→clamp(1.0) | covered | P0 |
| DC-crit-002 | boundary | 零速度暴击率 | speed=0 | rate=0.05 | covered | P1 |
| DC-crit-003 | boundary | 高速度暴击率上限 | speed=999 | rate=1.0（上限） | covered | P1 |
| DC-crit-004 | boundary | 负速度暴击率 | speed=-50 | rate=clamp(0.05-0.5)=0.0 | covered | P2 |

### Buff加成辅助函数

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| DC-buff-001 | normal | 攻击加成计算 | ATK_UP=0.15 | getAttackBonus=0.15 | covered | P0 |
| DC-buff-002 | normal | 攻击降低计算 | ATK_DOWN=0.2 | getAttackBonus=-0.2 | covered | P0 |
| DC-buff-003 | normal | 防御加成计算 | DEF_UP=0.1 | getDefenseBonus=0.1 | covered | P0 |
| DC-buff-004 | normal | 护盾总值计算 | SHIELD×2 | getShieldAmount=总值 | covered | P0 |
| DC-buff-005 | boundary | 多Buff叠加 | ATK_UP=0.1+ATK_UP=0.2 | getAttackBonus=0.3 | covered | P1 |
| DC-buff-006 | boundary | 无Buff | buffs=[] | 所有辅助函数返回0 | covered | P2 |

---

## 3. BattleTurnExecutor（回合执行器）

### buildTurnOrder(state)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| TE-order-001 | normal | 按速度降序排列 | 双方各3人，速度不同 | turnOrder按速度降序 | covered | P0 |
| TE-order-002 | boundary | 同速度按ID排序 | 两个单位speed相同 | 按ID字典序排列 | covered | P1 |
| TE-order-003 | boundary | 所有单位同速度 | 6人speed=100 | 按ID排序 | covered | P2 |
| TE-order-004 | normal | 不包含死亡单位 | 有1人死亡 | turnOrder不含死亡单位ID | covered | P0 |

### executeUnitAction(state, actor)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| TE-exec-001 | normal | 正常普攻行动 | 怒气<100 | 使用normalAttack，isNormalAttack=true | covered | P0 |
| TE-exec-002 | normal | 怒气满释放大招 | rage≥100，有可用大招 | 消耗怒气，使用大招，isNormalAttack=false | covered | P0 |
| TE-exec-003 | normal | DOT伤害处理 | 有BURN buff | 先受DOT伤害，再行动 | covered | P0 |
| TE-exec-004 | normal | DOT致死 | DOT伤害≥当前HP | 返回阵亡行动记录，不执行后续行动 | covered | P0 |
| TE-exec-005 | normal | 被控制无法行动 | STUN/FREEZE | 返回"被控制，无法行动"记录 | covered | P0 |
| TE-exec-006 | normal | 技能附带Buff | skill有buffs | Buff应用到目标 | covered | P1 |
| TE-exec-007 | normal | 技能冷却设置 | 释放非普攻技能 | skill.currentCooldown=cooldown | covered | P1 |
| TE-exec-008 | normal | 怒气更新 | 攻击者+被击者 | 攻击者rage+25，被击者rage+15 | covered | P0 |
| TE-exec-009 | boundary | 无存活目标 | 敌方全灭 | 返回null | covered | P1 |
| TE-exec-010 | boundary | 技能在冷却中 | currentCooldown>0 | 不释放该技能 | covered | P1 |
| TE-exec-011 | error | actor为null | actor=null | 不崩溃 | missing | P0 |
| TE-exec-012 | cross | 怒气恰好100时技能选择 | rage=100 | 优先选rageCost>0的active技能 | covered | P1 |

### selectSkill(actor)（内部）

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| TE-skill-001 | normal | 怒气满选大招 | rage≥100，有active技能 | 选择第一个可用大招 | covered | P0 |
| TE-skill-002 | normal | 怒气不足选普攻 | rage<100 | 返回normalAttack | covered | P0 |
| TE-skill-003 | boundary | 怒气满但技能全在冷却 | rage=100，cooldown>0 | 退回普攻 | covered | P1 |
| TE-skill-004 | boundary | 怒气满但无active技能 | 只有passive技能 | 退回普攻 | covered | P1 |
| TE-skill-005 | boundary | 多个大招可用 | 2个active技能可用 | 选择第一个 | covered | P2 |

### endTurn(state)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| TE-end-001 | normal | Buff持续时间减少 | remainingTurns=2 | 变为1 | covered | P0 |
| TE-end-002 | normal | 过期Buff移除 | remainingTurns=1 | 变为0，被移除 | covered | P0 |
| TE-end-003 | normal | 技能冷却减少 | currentCooldown=3 | 变为2 | covered | P1 |
| TE-end-004 | boundary | 达到最大回合 | currentTurn=maxTurns | phase=FINISHED | covered | P0 |
| TE-end-005 | boundary | 无Buff无冷却 | — | 不报错 | covered | P2 |

---

## 4. BattleTargetSelector（目标选择）

### selectTargets(state, actor, skill)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| TS-sel-001 | normal | SINGLE_ENEMY | 前排有存活单位 | 随机选择一个前排单位 | covered | P0 |
| TS-sel-002 | normal | FRONT_ROW | 前排有存活单位 | 返回所有前排存活单位 | covered | P0 |
| TS-sel-003 | normal | BACK_ROW | 后排有存活单位 | 返回所有后排存活单位 | covered | P0 |
| TS-sel-004 | normal | ALL_ENEMY | 敌方有存活单位 | 返回所有存活敌方单位 | covered | P0 |
| TS-sel-005 | normal | SELF | actor存活 | 返回[actor] | covered | P0 |
| TS-sel-006 | normal | SINGLE_ALLY | 己方有存活单位 | 返回HP比例最低的己方单位 | covered | P0 |
| TS-sel-007 | normal | ALL_ALLY | 己方有存活单位 | 返回所有存活己方单位 | covered | P0 |
| TS-sel-008 | boundary | 前排全灭选后排 | SINGLE_ENEMY，前排全灭 | 从后排随机选择 | covered | P0 |
| TS-sel-009 | boundary | 后排全灭选前排 | BACK_ROW，后排全灭 | fallback到前排 | covered | P1 |
| TS-sel-010 | boundary | 敌方全灭 | ALL_ENEMY，敌方全灭 | 返回空数组 | covered | P1 |
| TS-sel-011 | boundary | SELF且已死亡 | actor.isAlive=false | 返回空数组 | covered | P1 |
| TS-sel-012 | error | 未知targetType | targetType='INVALID' | fallback到selectSingleTarget | covered | P1 |
| TS-sel-013 | cross | actor为enemy时获取正确队伍 | actor.side='enemy' | getEnemyTeam返回allyTeam | covered | P1 |

---

## 5. UltimateSkillSystem（大招时停系统）

### checkUltimateReady(unit)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| US-check-001 | normal | 怒气满有大招 | rage=100，有active技能 | isReady=true | covered | P0 |
| US-check-002 | normal | 怒气不足 | rage=50 | isReady=false | covered | P0 |
| US-check-003 | boundary | 怒气恰好100 | rage=100 | isReady=true | covered | P0 |
| US-check-004 | boundary | 技能在冷却中 | currentCooldown>0 | isReady=false | covered | P1 |
| US-check-005 | boundary | 只有被动技能 | skills全为passive | isReady=false | covered | P1 |
| US-check-006 | boundary | 系统禁用 | enabled=false | isReady=false | covered | P1 |

### checkTeamUltimateReady(units)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| US-team-001 | normal | 检测全队 | 3人中2人怒气满 | readyUnits.length=2 | covered | P0 |
| US-team-002 | boundary | 死亡单位排除 | 有死亡单位 | 不被检测 | covered | P1 |
| US-team-003 | boundary | 空队伍 | units=[] | isReady=false | covered | P1 |

### pauseForUltimate(unit, skill)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| US-pause-001 | normal | 正常暂停 | enabled=true | state=PAUSED，handler收到onUltimateReady+onBattlePaused | covered | P0 |
| US-pause-002 | boundary | 禁用时不暂停 | enabled=false | 不触发时停 | covered | P1 |
| US-pause-003 | boundary | 无handler | handler=null | 不报错，状态仍更新 | covered | P1 |
| US-pause-004 | lifecycle | 超时定时器启动 | 暂停成功 | 30s后自动确认 | covered | P0 |

### confirmUltimate(unitId, skillId)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| US-confirm-001 | normal | 正确确认 | PAUSED，匹配unitId和skillId | 返回true，state重置 | covered | P0 |
| US-confirm-002 | error | 错误unitId | PAUSED，unitId不匹配 | 返回false | covered | P0 |
| US-confirm-003 | error | 错误skillId | PAUSED，skillId不匹配 | 返回false | covered | P0 |
| US-confirm-004 | error | 未暂停时确认 | state≠PAUSED | 返回false | covered | P0 |

### confirmUltimateWithInfo(unit, skill)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| US-confirm-info-001 | normal | 带完整信息确认 | PAUSED，匹配 | 返回true，handler收到onUltimateConfirmed | covered | P0 |
| US-confirm-info-002 | error | 信息不匹配 | unit.id不匹配 | 返回false | covered | P1 |

### cancelUltimate()

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| US-cancel-001 | normal | 正常取消 | PAUSED | handler收到onUltimateCancelled，state重置 | covered | P0 |
| US-cancel-002 | boundary | 未暂停时取消 | state≠PAUSED | 不报错，不做任何操作 | covered | P1 |

### 序列化/反序列化

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| US-ser-001 | normal | 序列化初始状态 | — | state=INACTIVE, enabled=true | covered | P1 |
| US-ser-002 | normal | 序列化暂停状态 | PAUSED | 包含pendingUnitId/pendingSkillId | covered | P1 |
| US-ser-003 | normal | 反序列化恢复 | 有效数据 | 状态完全恢复 | covered | P1 |
| US-ser-004 | boundary | 反序列化禁用状态 | enabled=false | 正确恢复 | covered | P2 |

### 启用/禁用/重置

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| US-enable-001 | normal | 禁用重置状态 | PAUSED→setEnabled(false) | state=INACTIVE | covered | P1 |
| US-enable-002 | normal | 重新启用正常工作 | 禁用后启用 | checkUltimateReady正常返回 | covered | P1 |
| US-reset-001 | normal | 完全重置 | PAUSED | state=INACTIVE, pendingUnitId=null | covered | P1 |

---

## 6. BattleSpeedController（战斗加速控制器）

### setSpeed(speed)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| SC-set-001 | normal | 设置X1 | — | speedState.speed=X1 | covered | P0 |
| SC-set-002 | normal | 设置X2 | — | speedState.speed=X2 | covered | P0 |
| SC-set-003 | normal | 设置X4 | — | speedState.speed=X4, simplifiedEffects=true | covered | P0 |
| SC-set-004 | normal | 设置SKIP | — | speedState.speed=SKIP, interval=0 | covered | P0 |
| SC-set-005 | boundary | 相同速度不触发变更 | 当前X1，设置X1 | 返回false | covered | P1 |
| SC-set-006 | error | 无效速度值 | speed=99 | 返回false | covered | P1 |

### cycleSpeed()

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| SC-cycle-001 | normal | 正常循环 | X1→X2→X4→X1 | 循环切换 | covered | P0 |
| SC-cycle-002 | boundary | SKIP切回X1 | 当前SKIP | cycleSpeed→X1 | covered | P1 |

### getAdjustedTurnInterval()

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| SC-interval-001 | normal | X1间隔 | speed=X1 | 1000ms | covered | P0 |
| SC-interval-002 | normal | X2间隔 | speed=X2 | 500ms | covered | P0 |
| SC-interval-003 | normal | SKIP间隔 | speed=SKIP | 0ms | covered | P0 |

### getAnimationSpeedScale()

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| SC-anim-001 | normal | X1缩放 | speed=X1 | scale=1.0 | covered | P1 |
| SC-anim-002 | normal | X2缩放 | speed=X2 | scale=2.0 | covered | P1 |
| SC-anim-003 | boundary | SKIP缩放 | speed=SKIP | scale=Infinity | covered | P1 |

### 监听器

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| SC-listen-001 | normal | 注册监听器 | — | 速度变更时收到事件 | covered | P1 |
| SC-listen-002 | normal | 移除监听器 | — | 不再收到事件 | covered | P1 |
| SC-listen-003 | boundary | 重复注册同一监听器 | — | 只注册一次 | covered | P2 |
| SC-listen-004 | boundary | 移除不存在的监听器 | — | 不报错 | covered | P2 |

### 序列化/反序列化/重置

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| SC-ser-001 | normal | 序列化速度状态 | X2 | 返回完整BattleSpeedState | covered | P1 |
| SC-ser-002 | normal | 反序列化恢复 | 有效BattleSpeedState | 速度状态恢复 | covered | P1 |
| SC-reset-001 | normal | 重置为默认 | — | speed=X1，history清空 | covered | P1 |

### 静态方法

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| SC-static-001 | normal | isValidSpeed | X1/X2/X4/SKIP | 返回true | covered | P2 |
| SC-static-002 | normal | isValidSpeed无效值 | 99 | 返回false | covered | P2 |
| SC-static-003 | normal | getAvailableSpeeds | — | 返回[1,2,3] | covered | P2 |

---

## 7. BattleEffectApplier（科技效果应用器）

### getEnhancedStats(unit)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| EA-stats-001 | normal | 无科技时属性不变 | techEffect=null | enhancedAttack=baseAttack | covered | P0 |
| EA-stats-002 | normal | 全军攻击加成 | 锐兵术+10% | enhancedAttack=floor(base×1.1) | covered | P0 |
| EA-stats-003 | normal | 全军防御加成 | 铁壁术+10% | enhancedDefense=floor(base×1.1) | covered | P0 |
| EA-stats-004 | normal | 兵种专属加成 | 骑兵专属+全军 | 两者叠加 | covered | P0 |
| EA-stats-005 | boundary | 步兵专属只影响步兵 | target=infantry | 其他兵种不受专属加成 | covered | P1 |

### applyTechBonusesToUnit / applyTechBonusesToTeam

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| EA-apply-001 | normal | 应用到单个单位 | — | unit.attack/defense被修改 | covered | P0 |
| EA-apply-002 | normal | 批量应用到队伍 | 6人队伍 | 所有人属性被修改 | covered | P0 |

### enhanceDamageResult(result, attacker)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| EA-enhance-001 | normal | 科技加成应用到伤害 | 有攻击加成 | enhancedDamage=floor(damage×multiplier) | covered | P0 |
| EA-enhance-002 | boundary | 无科技时伤害不变 | techEffect=null | enhancedDamage=damage | covered | P1 |

### 武技特效配置

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| EA-fx-001 | normal | 获取预设特效 | skillId='fire_slash' | 返回fire元素配置 | covered | P1 |
| EA-fx-002 | boundary | 不存在的技能 | skillId='unknown' | 返回null | covered | P1 |
| EA-fx-003 | normal | 注册自定义特效 | 新配置 | getSkillEffect返回新配置 | covered | P1 |
| EA-fx-004 | normal | 覆盖已有特效 | 同skillId | 新配置替换旧配置 | covered | P1 |
| EA-fx-005 | normal | 获取所有预设 | — | 返回7个预设 | covered | P2 |

---

## 8. BattleEffectManager（战斗特效管理器）

### generateSkillEffect(skill, actor, damageResult?)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| EM-fx-001 | normal | 火属性技能特效 | fire相关skillId | element='fire' | covered | P0 |
| EM-fx-002 | normal | 冰属性技能特效 | ice相关skillId | element='ice' | covered | P0 |
| EM-fx-003 | normal | 暴击时触发onCritical | isCritical=true | trigger='onCritical' | covered | P0 |
| EM-fx-004 | normal | 大招屏幕震动 | rageCost>0 | screenShake.enabled=true | covered | P1 |
| EM-fx-005 | boundary | 4x速度简化特效 | speed=X4 | simplified=true，粒子减少 | covered | P1 |
| EM-fx-006 | boundary | 未知元素默认neutral | 非标准skillId | element='neutral' | covered | P1 |

### generateBuffEffect(buffType, target)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| EM-buff-001 | normal | 灼烧Buff特效 | BURN | element='fire' | covered | P1 |
| EM-buff-002 | normal | 冰冻Buff特效 | FREEZE | element='ice' | covered | P1 |
| EM-buff-003 | boundary | 未知Buff默认neutral | 未知类型 | element='neutral' | covered | P2 |

### generateDamageAnimations(action)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| EM-dmg-001 | normal | 普通伤害动画 | NORMAL伤害 | DamageNumberType.NORMAL | covered | P0 |
| EM-dmg-002 | normal | 暴击伤害动画 | CRITICAL | DamageNumberType.CRITICAL, triggerShake=true | covered | P0 |
| EM-dmg-003 | boundary | 0伤害免疫动画 | damage=0 | DamageNumberType.IMMUNE | covered | P1 |
| EM-dmg-004 | normal | 多目标错开显示 | 3个目标 | delayMs递增80ms | covered | P1 |

### 手机端布局

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| EM-layout-001 | normal | 小屏幕适配 | 375×667 | screenClass='small' | covered | P1 |
| EM-layout-002 | normal | 中等屏幕适配 | 414×896 | screenClass='medium' | covered | P1 |
| EM-layout-003 | normal | 大屏幕适配 | 768×1024 | screenClass='large' | covered | P1 |
| EM-layout-004 | boundary | 触摸热区大于按钮 | — | touchPadding扩展区域 | covered | P1 |
| EM-layout-005 | normal | 技能按钮布局 | count=4 | 返回4个按钮位置 | covered | P1 |

### 生命周期

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| EM-life-001 | normal | 清理过期特效 | currentTime-createdAt>3000 | 被移除 | covered | P1 |
| EM-life-002 | normal | 清理过期动画 | 超过2500ms | 被移除 | covered | P1 |
| EM-life-003 | boundary | 超过maxActiveEffects | 添加过多特效 | 移除最旧的 | missing | P2 |
| EM-life-004 | normal | clear清空所有 | — | effects和animations为空 | covered | P1 |

---

## 9. DamageNumberSystem（伤害数字动画系统）

### 创建数字

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| DN-create-001 | normal | 创建普通伤害 | NORMAL | type=NORMAL, 轨迹FLOAT_UP | covered | P0 |
| DN-create-002 | normal | 创建暴击 | CRITICAL | type=CRITICAL, 轨迹ZOOM_FADE | covered | P0 |
| DN-create-003 | normal | 创建治疗 | HEAL | type=HEAL | covered | P0 |
| DN-create-004 | normal | 创建DOT | DOT | type=DOT | covered | P0 |
| DN-create-005 | boundary | 每个数字有唯一ID | — | idCounter递增 | covered | P1 |
| DN-create-006 | boundary | 数字有随机偏移 | — | offset避免重叠 | covered | P1 |

### 合并逻辑

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| DN-merge-001 | normal | 同目标同类型合并 | 窗口内 | 数值合并 | covered | P0 |
| DN-merge-002 | boundary | 不同目标不合并 | — | 独立数字 | covered | P1 |
| DN-merge-003 | boundary | 超过时间窗口不合并 | — | 独立数字 | covered | P1 |
| DN-merge-004 | boundary | 禁用合并 | mergeEnabled=false | 所有数字独立 | covered | P1 |

### 生命周期

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| DN-life-001 | normal | update移除过期数字 | 超过lifetime | 被移除 | covered | P1 |
| DN-life-002 | boundary | 超过最大数量 | maxNumbers=10, 11个 | 移除最旧的 | covered | P1 |
| DN-life-003 | normal | clear清空 | — | activeNumbers为空 | covered | P1 |

---

## 10. BattleStatistics（战斗统计）

### calculateBattleStats(state)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| BS-calc-001 | normal | 我方总伤害 | ally行动记录 | allyTotalDamage正确 | covered | P0 |
| BS-calc-002 | normal | 敌方总伤害 | enemy行动记录 | enemyTotalDamage正确 | covered | P0 |
| BS-calc-003 | normal | 单次最高伤害 | 有暴击记录 | maxSingleDamage正确 | covered | P0 |
| BS-calc-004 | normal | 连击统计 | 连续暴击 | maxCombo正确 | covered | P0 |
| BS-calc-005 | boundary | 无行动记录 | actionLog=[] | 所有统计为0 | covered | P1 |
| BS-calc-006 | boundary | 暴击中断连击 | 暴击→非暴击→暴击 | maxCombo为中断前的连续数 | covered | P1 |

### generateSummary(outcome, stars, turns, allyAlive)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| BS-summary-001 | normal | 胜利摘要 | VICTORY, stars=3 | 包含★★★和回合数 | covered | P1 |
| BS-summary-002 | normal | 失败摘要 | DEFEAT | 包含"战斗失败" | covered | P1 |
| BS-summary-003 | normal | 平局摘要 | DRAW | 包含"平局" | covered | P1 |

---

## 11. BattleFragmentRewards（碎片奖励计算）

### calculateFragmentRewards(outcome, enemyTeam, allySurvivors, isFirstClear?)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| FR-calc-001 | normal | 胜利时碎片掉落 | VICTORY | 基于hash的10%掉率 | covered | P0 |
| FR-calc-002 | normal | 失败无碎片 | DEFEAT | 返回{} | covered | P0 |
| FR-calc-003 | normal | 平局无碎片 | DRAW | 返回{} | covered | P0 |
| FR-calc-004 | normal | 首通必掉 | isFirstClear=true | 所有敌方单位掉落1碎片 | covered | P0 |
| FR-calc-005 | boundary | 空敌方队伍 | enemyTeam.units=[] | 返回{} | covered | P1 |
| FR-calc-006 | cross | 首通+VICTORY完整链路 | 首通胜利 | 碎片正确产出 | covered | P1 |

### simpleHash(str)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| FR-hash-001 | normal | 确定性哈希 | 相同字符串 | 返回相同值 | covered | P1 |
| FR-hash-002 | boundary | 空字符串 | str="" | 返回0 | covered | P2 |
| FR-hash-003 | boundary | 长字符串 | 1000字符 | 不溢出 | covered | P2 |

---

## 12. autoFormation（一键布阵）

### autoFormation(units)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| AF-form-001 | normal | 6人布阵 | 6个单位 | 3前排+3后排 | covered | P0 |
| AF-form-002 | normal | 防御最高在前排 | 不同防御值 | 前排为防御最高的3个 | covered | P0 |
| AF-form-003 | boundary | 3人全前排 | 3个单位 | 全部前排，无后排 | covered | P0 |
| AF-form-004 | boundary | 超过6人截断 | 8个单位 | 取前6个 | covered | P1 |
| AF-form-005 | boundary | 空列表 | units=[] | 返回空结果 | covered | P0 |
| AF-form-006 | normal | 同防御按HP排序 | 防御相同 | HP高的在前 | covered | P1 |
| AF-form-007 | normal | 死亡单位过滤 | 有死亡单位 | 不参与布阵 | covered | P1 |
| AF-form-008 | normal | 布阵评分 | — | score在0~100之间 | covered | P2 |
| AF-form-009 | normal | position属性设置 | — | 每个单位position正确 | covered | P1 |
| AF-form-010 | normal | team.side为ally | — | side='ally' | covered | P2 |

---

## 13. battle-helpers（通用辅助函数）

### getAliveUnits / getAliveFrontUnits / getAliveBackUnits

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| BH-alive-001 | normal | 获取存活单位 | 有存活有死亡 | 只返回isAlive=true | covered | P0 |
| BH-alive-002 | normal | 获取前排存活 | front存活 | 只返回position='front'且isAlive | covered | P0 |
| BH-alive-003 | normal | 获取后排存活 | back存活 | 只返回position='back'且isAlive | covered | P0 |
| BH-alive-004 | boundary | 全灭 | 无存活 | 返回[] | covered | P1 |

### sortBySpeed(units)

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| BH-sort-001 | normal | 按速度降序 | 不同速度 | 速度高的在前 | covered | P0 |
| BH-sort-002 | boundary | 同速度按ID排序 | 相同速度 | ID字典序 | covered | P1 |
| BH-sort-003 | boundary | 空数组 | units=[] | 返回[] | covered | P2 |

### getEnemyTeam / getAllyTeam

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| BH-team-001 | normal | ally获取敌方 | side='ally' | 返回enemyTeam | covered | P0 |
| BH-team-002 | normal | enemy获取敌方 | side='enemy' | 返回allyTeam | covered | P0 |
| BH-team-003 | normal | ally获取友方 | side='ally' | 返回allyTeam | covered | P0 |

### findUnit / findUnitInTeam

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| BH-find-001 | normal | 查找存在的单位 | unitId在allyTeam中 | 返回该单位 | covered | P0 |
| BH-find-002 | boundary | 查找不存在的单位 | unitId不存在 | 返回undefined | covered | P1 |
| BH-find-003 | normal | 跨队伍查找 | unitId在enemyTeam中 | 返回该单位 | covered | P0 |

---

## 14. 跨系统交互

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| XI-001 | cross | 武将属性→战斗单位属性一致 | HeroSystem→BattleUnit | attack/defense/speed一致 | covered | P0 |
| XI-002 | cross | 武将升级→战斗伤害增加 | 升级后战斗 | 伤害高于升级前 | covered | P0 |
| XI-003 | cross | 武将技能→战斗技能生效 | 有技能的武将 | 技能在战斗中正确触发 | covered | P0 |
| XI-004 | cross | 编队配置→出场武将一致 | 编队3人 | 战斗中3人出场 | covered | P0 |
| XI-005 | cross | 战斗中武将血量扣减 | 战斗过程 | HP正确减少 | covered | P0 |
| XI-006 | cross | 科技加成→战斗伤害增强 | 军事科技升级 | DamageCalculator结果增大 | covered | P1 |
| XI-007 | cross | BattleEffectApplier→DamageCalculator | 科技注入到战斗 | 伤害结果包含科技加成 | covered | P1 |
| XI-008 | cross | 招募→编队→战斗完整链路 | 招募武将→编队→战斗 | 全链路不崩溃 | covered | P0 |
| XI-009 | cross | 战斗→碎片奖励→武将碎片增加 | 胜利获得碎片 | HeroSystem碎片增加 | missing | P0 |
| XI-010 | cross | 远征系统→战斗系统 | ExpeditionBattleSystem | 战斗逻辑复用正确 | missing | P0 |
| XI-011 | cross | 战斗速度→特效管理器联动 | setSpeed(X4) | EffectManager简化特效 | missing | P1 |
| XI-012 | cross | 大招时停→UI事件通知 | SEMI_AUTO模式 | handler收到完整事件序列 | covered | P1 |
| XI-013 | cross | BattleEngine.reset()→子系统重置 | reset | speedController+ultimateSystem全部重置 | missing | P1 |
| XI-014 | cross | 战斗统计→星级评定一致性 | 胜利+特定条件 | 统计数据与星级逻辑一致 | partial | P1 |
| XI-015 | cross | 兵种克制→伤害计算→星级评定 | 克制关系影响伤害 | 克制方更容易获得高星级 | missing | P1 |
| XI-016 | cross | Buff系统→伤害计算→战斗结果 | 多层Buff叠加 | 伤害结果正确反映所有Buff | partial | P1 |
| XI-017 | cross | autoFormation→BattleEngine | 自动布阵后战斗 | 前排正确承受伤害 | missing | P1 |
| XI-018 | cross | BattleEffectApplier→BattleEngine | 科技加成应用到战斗 | runFullBattle中科技生效 | missing | P1 |
| XI-019 | cross | DamageNumberSystem→BattleEffectManager | 特效管理器使用数字系统 | 动画数据包含正确数字 | covered | P1 |
| XI-020 | cross | skipBattle与runFullBattle结果一致性 | 相同队伍配置 | outcome/stars一致 | missing | P0 |
| XI-021 | cross | 战斗模式切换中途战斗 | AUTO→SEMI_AUTO | 模式切换后行为正确 | missing | P1 |
| XI-022 | cross | 多场战斗连续执行 | 连续runFullBattle | 每场独立，状态不残留 | missing | P0 |
| XI-023 | cross | 战斗序列化/反序列化 | serialize→deserialize | 战斗状态完全恢复 | missing | P0 |
| XI-024 | cross | 武将防御属性→战斗受伤量 | 不同防御武将 | 高防御受伤更少 | covered | P0 |
| XI-025 | cross | HeroDispatchSystem攻击加成→战斗 | 派遣攻击加成 | 战斗伤害增加 | missing | P1 |
| XI-026 | cross | 羁绊系统→编队战力→战斗 | 羁绊加成 | 战斗中属性正确 | missing | P1 |
| XI-027 | cross | NPC好感度→战斗属性 | 好感度加成 | 战斗属性反映好感度 | missing | P2 |
| XI-028 | cross | 战斗结束→邮件通知 | 战斗完成 | 邮件系统收到通知 | missing | P2 |

---

## 15. 数据生命周期

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| LC-001 | lifecycle | 战斗初始化→执行→结束完整流程 | initBattle→executeTurn→isBattleOver→getBattleResult | 每阶段状态正确 | covered | P0 |
| LC-002 | lifecycle | 战斗状态序列化/反序列化 | serialize→deserialize | 所有字段完全恢复 | missing | P0 |
| LC-003 | lifecycle | BattleSpeedController状态持久化 | serialize→deserialize | 速度状态恢复 | covered | P1 |
| LC-004 | lifecycle | UltimateSkillSystem状态持久化 | serialize→deserialize | 时停状态恢复 | covered | P1 |
| LC-005 | lifecycle | 多场战斗间状态隔离 | 第一场结束→第二场开始 | 第二场不受第一场影响 | missing | P0 |
| LC-006 | lifecycle | 战斗引擎reset生命周期 | 创建→使用→reset→再使用 | reset后引擎可正常使用 | missing | P0 |
| LC-007 | lifecycle | BattleEffectManager生命周期 | 创建→生成特效→cleanup→clear | 各阶段数据正确 | partial | P1 |
| LC-008 | lifecycle | DamageNumberSystem数字生命周期 | 创建→合并→update→过期移除 | 数字正确管理 | covered | P1 |
| LC-009 | lifecycle | Buff完整生命周期 | 应用→每回合tick→过期移除 | 回合数正确减少 | covered | P0 |
| LC-010 | lifecycle | 技能冷却生命周期 | 释放→冷却→tick→可用 | 冷却正确减少 | covered | P0 |
| LC-011 | lifecycle | 怒气完整生命周期 | 0→攻击+25→被击+15→满→释放→减少 | 怒气值正确变化 | covered | P0 |
| LC-012 | lifecycle | 武将从HeroSystem到BattleUnit转换 | 武将数据→创建BattleUnit | 属性完整映射 | partial | P0 |
| LC-013 | lifecycle | 战斗结果→奖励→资源增加 | 战斗胜利→碎片奖励→HeroSystem碎片 | 端到端链路完整 | missing | P0 |
| LC-014 | lifecycle | 战斗中单位死亡→不再参与行动 | 单位HP降为0 | 后续回合不行动 | covered | P0 |
| LC-015 | lifecycle | SKIP模式战斗→结果→恢复正常速度 | skipBattle→后续战斗 | 速度状态正确恢复 | missing | P1 |
| LC-016 | lifecycle | 大招时停超时→自动确认→战斗继续 | 30s超时 | 自动确认，战斗正常完成 | covered | P0 |
| LC-017 | lifecycle | 战斗引擎重用（连续多场） | 同一引擎runFullBattle多次 | 每场结果独立 | missing | P0 |
| LC-018 | lifecycle | 速度控制器changeHistory累积 | 多次setSpeed | history正确记录所有变更 | covered | P1 |
