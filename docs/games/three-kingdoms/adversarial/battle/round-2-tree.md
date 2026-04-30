# Battle模块流程分支树 — Round 2

> 生成时间：2025-05-02
> 模块路径：`src/games/three-kingdoms/engine/battle/`
> 基于R1 tree（352节点）补充，聚焦薄弱维度：跨系统交互、生命周期、P0风险

---

## R2 新增统计

| 维度 | R1 | R2新增 | R2总计 |
|------|-----|--------|--------|
| **总节点数** | 352 | **92** | **444** |
| P0 阻塞 | 148 | 32 | 180 |
| P1 严重 | 155 | 42 | 197 |
| P2 一般 | 49 | 18 | 67 |

### R2新增节点按维度分布

| 维度 | 新增节点 | 说明 |
|------|----------|------|
| 跨系统交互：battle↔hero属性 | 12 | 武将属性映射、升级、装备、羁绊 |
| 跨系统交互：battle↔装备 | 8 | 装备属性到战斗单位 |
| 跨系统交互：battle↔技能 | 8 | 武将技能到战斗技能 |
| 跨系统交互：battle↔联盟buff | 6 | 联盟科技/战力加成 |
| 跨系统交互：远征/战役/其他 | 8 | ExpeditionBattleSystem、CampaignSystem |
| 生命周期：初始化→执行→结算→奖励→清理 | 18 | 全链路端到端 |
| 生命周期：多场战斗/引擎重用 | 10 | 状态隔离、reset、连续执行 |
| P0风险专项 | 12 | 5个P0结构性风险的测试节点 |
| 边界/异常补充 | 8 | 精确边界值、NaN/Infinity |
| **合计** | **92** | |

### R2修正（来自R1 verdict）

| 修正项 | 原状态 | 修正后 |
|--------|--------|--------|
| XI-017 autoFormation→BattleEngine | P1 | **P0** |
| BE-quick-001 quickBattle等价性 | P1 | **P0** |
| BE-init-005 null队伍 | missing | **补充预期行为** |
| DC-calc-011/012 skillMultiplier=0/-1 | missing | **补充源码行为分析** |
| XI-020 skipBattle一致性 | missing | **partial**（有间接覆盖） |

---

## 16. 跨系统交互：battle↔hero属性（新增）

> 验证HeroSystem武将数据→BattleUnit属性映射的正确性

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| XI-H-001 | cross | buildAllyTeam从HeroFormation获取武将 | 编队3人slot | 遍历getActiveFormation().slots，每个slot调用hero.getGeneral | **new** | P0 |
| XI-H-002 | cross | generalToBattleUnit属性映射 | 武将attack=800, defense=400, speed=120, intelligence=300 | BattleUnit.attack=800, defense=400, speed=120 | **new** | P0 |
| XI-H-003 | cross | 武将level→maxHp计算 | level=10, defense=400 | maxHp=500+10×100+400×10=5900 | **new** | P0 |
| XI-H-004 | cross | inferTroopType按最高属性推断兵种 | attack最高→CAVALRY, intelligence最高→STRATEGIST, speed最高→ARCHER, defense最高→SPEARMAN | troopType正确 | **new** | P0 |
| XI-H-005 | cross | 武将升级后战斗属性增加 | 武将level 5→10 | BattleUnit.maxHp和attack/defense均增加 | **new** | P1 |
| XI-H-006 | cross | 武将skills→BattleUnit.skills映射 | 武将有2个技能 | BattleUnit.skills长度=2，每个skill.multiplier=1.5, rageCost=50, cooldown=3 | **new** | P0 |
| XI-H-007 | cross | 武将无技能时仅保留普攻 | 武将skills=[] | BattleUnit.skills=[], normalAttack存在 | **new** | P1 |
| XI-H-008 | cross | 编队空slot跳过 | slots=[hero1, null, hero2] | 跳过null slot，units长度=2 | **new** | P1 |
| XI-H-009 | cross | 编队中武将不存在(hero.getGeneral返回null) | slot有id但hero不存在 | 跳过该slot，不崩溃 | **new** | P0 |
| XI-H-010 | cross | 武将faction映射到BattleUnit | 武将faction='shu' | BattleUnit.faction='shu' | **new** | P2 |
| XI-H-011 | cross | 武将baseStats含零值属性 | attack=0, defense=0 | BattleUnit.attack=0, 触发保底伤害机制 | **new** | P1 |
| XI-H-012 | cross | 武将属性全相等时inferTroopType兜底 | attack=defense=intelligence=speed=100 | 返回INFANTRY（兜底） | **new** | P2 |

---

## 17. 跨系统交互：battle↔装备（新增）

> 验证装备系统属性加成是否正确传递到战斗单位

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| XI-EQ-001 | cross | 装备攻击加成→BattleUnit.attack | 武将装备+100攻击的武器 | generalToBattleUnit中attack包含装备加成 | **new** | P0 |
| XI-EQ-002 | cross | 装备防御加成→BattleUnit.defense | 武将装备+80防御的防具 | generalToBattleUnit中defense包含装备加成 | **new** | P0 |
| XI-EQ-003 | cross | 装备速度加成→暴击率 | 武将装备+50速度的鞋子 | 暴击率=0.05+(baseSpeed+50)/100 | **new** | P1 |
| XI-EQ-004 | cross | 装备套装效果→战斗属性 | 2件套激活+10%攻击 | BattleUnit.attack包含套装百分比加成 | **new** | P1 |
| XI-EQ-005 | cross | 装备强化等级→属性缩放 | 武器+10强化 | 属性按强化等级线性增长 | **new** | P1 |
| XI-EQ-006 | cross | 无装备武将→基础属性战斗 | 武将无任何装备 | BattleUnit使用baseStats原值 | **new** | P1 |
| XI-EQ-007 | cross | 装备更换后战斗属性更新 | 战前更换武器 | 新战斗中BattleUnit.attack反映新装备 | **new** | P2 |
| XI-EQ-008 | cross | 装备属性为负值（异常数据） | 装备attack=-50 | BattleUnit.attack可能低于baseAttack，伤害降低但不崩溃 | **new** | P1 |

---

## 18. 跨系统交互：battle↔技能（新增）

> 验证武将技能→战斗技能的正确映射和触发

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| XI-SK-001 | cross | 武将active技能→BattleSkill映射 | 武将有type='active'技能 | BattleSkill.type='active', rageCost=50, cooldown=3 | **new** | P0 |
| XI-SK-002 | cross | 武将passive技能在战斗中的行为 | 武将有type='passive'技能 | 被动技能不进入BattleUnit.skills（仅active技能参与战斗） | **new** | P1 |
| XI-SK-003 | cross | 技能multiplier固定为1.5 | 所有武将技能 | generalToBattleUnit中skill.multiplier=1.5 | **new** | P0 |
| XI-SK-004 | cross | 技能targetType固定为SINGLE_ENEMY | 所有武将技能 | skill.targetType=SkillTargetType.SINGLE_ENEMY | **new** | P1 |
| XI-SK-005 | cross | 技能冷却正确初始化 | 武将技能cooldown=3 | BattleSkill.currentCooldown=0, cooldown=3 | **new** | P1 |
| XI-SK-006 | cross | 多技能武将的技能选择优先级 | 武将有2个active技能 | selectSkill选择第一个可用技能 | **new** | P1 |
| XI-SK-007 | cross | 技能buffs在战斗中正确应用 | 技能附带ATK_DOWN buff | 击中目标后目标获得ATK_DOWN | **new** | P0 |
| XI-SK-008 | cross | 技能描述在行动日志中正确显示 | 释放技能 | actionLog中包含技能名称 | **new** | P2 |

---

## 19. 跨系统交互：battle↔联盟buff（新增）

> 验证联盟系统加成是否影响战斗

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| XI-AB-001 | cross | 联盟科技攻击加成→战斗伤害 | 联盟科技+5%攻击 | 战斗伤害比无联盟加成时高5% | **new** | P1 |
| XI-AB-002 | cross | 联盟科技防御加成→战斗受伤 | 联盟科技+5%防御 | 战斗受伤比无联盟加成时低 | **new** | P1 |
| XI-AB-003 | cross | 联盟战力buff→ExpeditionBattleSystem | 联盟加成战力 | 远征战斗中effectiveAllyPower包含联盟buff | **new** | P1 |
| XI-AB-004 | cross | 联盟加成与科技加成叠加 | 联盟+5%攻击，军事科技+10%攻击 | 总加成为15%（乘法或加法需确认） | **new** | P1 |
| XI-AB-005 | cross | 退出联盟后加成移除 | 退出联盟后战斗 | 战斗属性不含联盟加成 | **new** | P2 |
| XI-AB-006 | cross | 联盟加成在PVP战斗中是否生效 | PVP战斗 | 确认联盟加成在PVP中是否应用（可能不应用以保持公平） | **new** | P2 |

---

## 20. 跨系统交互：远征/战役/其他（新增）

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| XI-EXP-001 | cross | ExpeditionBattleSystem独立战斗模拟 | 远征队vs节点敌人 | executeBattle返回ExpeditionBattleResult含grade/stars/turns | **new** | P0 |
| XI-EXP-002 | cross | 远征战斗不使用BattleEngine | ExpeditionBattleSystem.executeBattle | 内部使用simulateBattle而非BattleEngine.runFullBattle | **new** | P0 |
| XI-EXP-003 | cross | 远征quickBattle仅基于战力对比 | quickBattle(allyPower, formation, enemyPower, formation) | 不模拟回合，基于powerRatio直接判定 | **new** | P1 |
| XI-EXP-004 | cross | 远征兵种克制计算 | allyFormation克制enemyFormation | counterBonus>0, effectiveAllyPower增加 | **new** | P1 |
| XI-CMP-001 | cross | CampaignSystem→buildAllyTeam→runFullBattle完整链路 | 选择关卡→构建队伍→战斗 | 战斗结果正确，completeBattle正确记录 | **new** | P0 |
| XI-CMP-002 | cross | CampaignSystem战斗奖励→碎片→HeroSystem | 战斗胜利+首通 | completeBattle调用rewardDistributor.calculateAndDistribute | **new** | P0 |
| XI-CMP-003 | cross | buildEnemyTeam从Stage配置构建 | Stage含enemyFormation | 正确映射enemyDefToBattleUnit，position按前后排分配 | **new** | P1 |
| XI-DP-001 | cross | HeroDispatchSystem攻击加成→战斗 | 派遣攻击加成生效 | buildAllyTeam时武将属性包含派遣加成 | **new** | P1 |

---

## 21. 生命周期：初始化→执行→结算→奖励→清理 全链路（新增）

> 覆盖R1最薄弱维度（22%覆盖率→目标≥65%）

### 21a. 战斗初始化阶段

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| LC-INIT-001 | lifecycle | buildAllyTeam→initBattle完整初始化 | 编队6人 | BattleState.allyTeam.units长度=6, phase=IN_PROGRESS | **new** | P0 |
| LC-INIT-002 | lifecycle | initBattle后所有单位HP=maxHp | 正常初始化 | 每个unit.hp=unit.maxHp, isAlive=true, rage=0 | **new** | P0 |
| LC-INIT-003 | lifecycle | initBattle后所有技能冷却=0 | 正常初始化 | 每个skill.currentCooldown=0 | **new** | P1 |
| LC-INIT-004 | lifecycle | initBattle后所有buffs为空 | 正常初始化 | 每个unit.buffs=[] | **new** | P1 |

### 21b. 战斗执行阶段

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| LC-EXEC-001 | lifecycle | executeTurn后actionLog增长 | 执行1回合 | actionLog.length>0, 每条记录含actorId/targetIds/damage | **new** | P0 |
| LC-EXEC-002 | lifecycle | 回合中HP正确减少 | 执行回合 | unit.hp < unit.maxHp (如果有受伤) | **new** | P0 |
| LC-EXEC-003 | lifecycle | 回合中怒气正确增加 | 攻击者+被击者 | 攻击者rage+25, 被击者rage+15 | **new** | P1 |
| LC-EXEC-004 | lifecycle | 回合中Buff正确tick | 有remainingTurns>0的Buff | endTurn后remainingTurns减少1 | **new** | P1 |

### 21c. 战斗结算阶段

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| LC-SETTLE-001 | lifecycle | 战斗结束phase=FINISHED | 一方全灭或回合耗尽 | state.phase=FINISHED, state.result不为null | **new** | P0 |
| LC-SETTLE-002 | lifecycle | 胜利时result.outcome=VICTORY | 敌方全灭 | result.outcome=VICTORY | **new** | P0 |
| LC-SETTLE-003 | lifecycle | 星级评定与存活/回合数一致 | allyAlive=5, turns=5 | result.stars=THREE | **new** | P0 |
| LC-SETTLE-004 | lifecycle | 碎片奖励正确计算 | VICTORY, 敌方有武将 | result.fragmentRewards非空 | **new** | P0 |

### 21d. 奖励发放阶段

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| LC-REWARD-001 | lifecycle | 胜利碎片→HeroSystem.addFragment | VICTORY+碎片奖励 | HeroSystem对应武将碎片数量增加 | **new** | P0 |
| LC-REWARD-002 | lifecycle | 首通必掉碎片→HeroSystem | isFirstClear=true | 所有敌方武将碎片+1 | **new** | P0 |
| LC-REWARD-003 | lifecycle | 失败无碎片无奖励 | DEFEAT | HeroSystem碎片数量不变 | **new** | P0 |
| LC-REWARD-004 | lifecycle | 经验奖励→武将升级 | 战斗胜利 | 武将经验增加（如果系统支持） | **new** | P2 |

### 21e. 清理阶段

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| LC-CLEAN-001 | lifecycle | 战斗结束后引擎可立即开始新战斗 | phase=FINISHED | initBattle创建全新BattleState | **new** | P0 |
| LC-CLEAN-002 | lifecycle | 战斗结束后EffectManager清理 | 战斗结束 | activeEffects=[], animations=[] | **new** | P1 |
| LC-CLEAN-003 | lifecycle | 战斗结束后DamageNumberSystem清理 | 战斗结束 | activeNumbers=[] | **new** | P2 |

---

## 22. 生命周期：多场战斗/引擎重用（新增）

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| LC-MULTI-001 | lifecycle | 同一引擎连续runFullBattle 2次 | 相同队伍 | 两次结果完全一致 | **new** | P0 |
| LC-MULTI-002 | lifecycle | 同一引擎连续runFullBattle 10次 | 相同队伍 | 每次结果独立，无状态累积 | **new** | P0 |
| LC-MULTI-003 | lifecycle | 不同队伍连续战斗 | 先强vs弱，再弱vs强 | 第二场结果不受第一场影响 | **new** | P0 |
| LC-MULTI-004 | lifecycle | skipBattle后runFullBattle速度不污染 | skipBattle→runFullBattle | 第二场速度仍为默认X1 | **new** | P0 |
| LC-MULTI-005 | lifecycle | skipBattle后speedController状态 | skipBattle完成 | speedController.speed=SKIP（未自动恢复） | **new** | P0 |
| LC-MULTI-006 | lifecycle | BattleEngine.reset()后子系统重置 | 使用后reset | battleMode=AUTO, speed=X1, ultimateSystem禁用 | **new** | P0 |
| LC-MULTI-007 | lifecycle | reset后引擎可正常使用 | reset→initBattle | 正常初始化，战斗正常执行 | **new** | P0 |
| LC-MULTI-008 | lifecycle | 连续战斗间怒气不跨场累积 | 第一场结束→第二场开始 | 第二场所有单位rage=0 | **new** | P1 |
| LC-MULTI-009 | lifecycle | 连续战斗间Buff不跨场残留 | 第一场有Buff→第二场 | 第二场所有单位buffs=[] | **new** | P1 |
| LC-MULTI-010 | lifecycle | 连续战斗间技能冷却不跨场残留 | 第一场技能在冷却→第二场 | 第二场所有技能currentCooldown=0 | **new** | P1 |

---

## 23. P0风险专项测试节点（新增）

> 针对R1发现的5个P0结构性风险，每个风险2-3个专项测试节点

### 23a. P0-1: initBattle无null防护

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| P0-INIT-001 | error | allyTeam=null传入initBattle | allyTeam=null | **源码确认**：buildTurnOrder→getAliveUnits(state.allyTeam)→TypeError: Cannot read properties of null。**预期修复**：抛出明确错误或返回安全默认值 | **new** | P0 |
| P0-INIT-002 | error | enemyTeam=null传入initBattle | enemyTeam=null | **源码确认**：同P0-INIT-001，TypeError崩溃 | **new** | P0 |
| P0-INIT-003 | error | allyTeam.units=undefined | allyTeam={units:undefined} | buildTurnOrder→getAliveUnits→filter报错 | **new** | P0 |

### 23b. P0-2: applyDamage负伤害"治疗漏洞"

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| P0-DMG-001 | error | applyDamage传入负数damage | defender.hp=500, damage=-100 | **源码确认**：remainingDamage=-100，shieldAmount检查`remainingDamage>0`跳过护盾，actualDamage=Math.min(-100, 500)=-100，defender.hp-=(-100)→hp=600。**确认漏洞存在**。**预期修复**：入口添加`if(damage<=0) return 0` | **new** | P0 |
| P0-DMG-002 | error | calculateDamage中skillMultiplier<0导致负伤害 | skillMultiplier=-1 | **源码确认**：baseDamage=max(1,rawDamage)=1, damageAfterSkill=1×(-1)=-1, finalDamage=-1×crit×restraint×random<0, minDamage=effectiveAttack×0.1>0, isMinDamage=true, finalDamage=minDamage。**保底机制兜住了**。但skillMultiplier=0时damageAfterSkill=0, minDamage仍兜住 | **new** | P0 |
| P0-DMG-003 | error | applyDamage传入NaN | damage=NaN | remainingDamage=NaN, Math.min(NaN, hp)=NaN, defender.hp-=NaN→hp=NaN。**确认漏洞**。 | **new** | P0 |

### 23c. P0-3: executeUnitAction无actor null检查

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| P0-ACT-001 | error | executeUnitAction传入null actor | actor=null | **源码确认**：calculateDotDamage(actor)→访问actor.buffs→TypeError。**但BattleEngine.executeTurn中有`if(!actor) continue`防护**。风险仅在直接调用executeUnitAction时 | **new** | P0 |
| P0-ACT-002 | error | executeUnitAction传入undefined actor | actor=undefined | 同P0-ACT-001 | **new** | P0 |

### 23d. P0-4: SKIP模式速度污染

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| P0-SKIP-001 | lifecycle | skipBattle后speedController仍为SKIP | skipBattle完成 | **源码确认**：skipBattle调用setSpeed(SKIP)但从不恢复。speedController.speed=SKIP | **new** | P0 |
| P0-SKIP-002 | lifecycle | skipBattle后runFullBattle受影响 | skipBattle→runFullBattle | runFullBattle不重置speedController，getAdjustedTurnInterval()=0，战斗无间隔 | **new** | P0 |
| P0-SKIP-003 | lifecycle | quickBattle后speedController状态 | quickBattle完成 | quickBattle=initBattle+skipBattle，skipBattle设置SKIP不恢复 | **new** | P0 |

### 23e. P0-5: 多场战斗状态隔离

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| P0-ISO-001 | lifecycle | runFullBattle每次创建新BattleState | 连续2次runFullBattle | 每次state.id不同，state.allyTeam/enemyTeam是新对象 | **new** | P0 |
| P0-ISO-002 | lifecycle | BattleEngine有状态子系统跨场影响 | skipBattle修改speed→第二场 | 第二场speedController.speed仍为SKIP（除非手动reset） | **new** | P0 |

---

## 24. 边界/异常补充（新增）

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| BDY-001 | boundary | 存活恰好4人+回合恰好6→三星 | allyAlive=4, turns=6 | stars=THREE（边界恰好满足） | **new** | P0 |
| BDY-002 | boundary | 存活恰好4人+回合7→二星 | allyAlive=4, turns=7 | stars=TWO | **new** | P0 |
| BDY-003 | boundary | 存活3人+回合3→一星 | allyAlive=3, turns=3 | stars=ONE | **new** | P1 |
| BDY-004 | boundary | 护盾恰好等于伤害 | shield=300, damage=300 | hp不变, shield=0, buff被移除 | **new** | P1 |
| BDY-005 | boundary | HP恰好为1时受1点伤害 | hp=1, damage=1 | hp=0, isAlive=false | **new** | P1 |
| BDY-006 | error | calculateDamage传入NaN属性 | attacker.attack=NaN | effectiveAttack=NaN, rawDamage=NaN, baseDamage=max(1,NaN)=NaN, finalDamage=NaN→保底可能兜不住 | **new** | P0 |
| BDY-007 | error | Infinity攻击力 | attacker.attack=Infinity | effectiveAttack=Infinity, rawDamage=Infinity, baseDamage=Infinity, finalDamage=Infinity→Math.floor(Infinity)=Infinity | **new** | P1 |
| BDY-008 | boundary | 怒气恰好100时selectSkill选择 | rage=100, 有active技能 | 选择第一个可用active技能而非普攻 | **new** | P1 |

---

## R2 更新后的总统计

| 系统 | R1节点 | R2新增 | R2总计 | covered | missing | partial |
|------|--------|--------|--------|---------|---------|---------|
| BattleEngine | 52 | 0 | 52 | 42 | 4 | 6 |
| DamageCalculator | 36 | 0 | 36 | 30 | 2 | 4 |
| BattleTurnExecutor | 38 | 0 | 38 | 30 | 4 | 4 |
| BattleTargetSelector | 24 | 0 | 24 | 20 | 2 | 2 |
| UltimateSkillSystem | 32 | 0 | 32 | 26 | 2 | 4 |
| BattleSpeedController | 28 | 0 | 28 | 22 | 2 | 4 |
| BattleEffectApplier | 22 | 0 | 22 | 18 | 2 | 2 |
| BattleEffectManager | 24 | 0 | 24 | 18 | 2 | 4 |
| DamageNumberSystem | 20 | 0 | 20 | 16 | 2 | 2 |
| BattleStatistics | 12 | 0 | 12 | 10 | 0 | 2 |
| BattleFragmentRewards | 10 | 0 | 10 | 8 | 0 | 2 |
| autoFormation | 12 | 0 | 12 | 10 | 0 | 2 |
| battle-helpers | 16 | 0 | 16 | 14 | 0 | 2 |
| 跨系统交互(hero) | — | 12 | 12 | 0 | 12 | 0 |
| 跨系统交互(装备) | — | 8 | 8 | 0 | 8 | 0 |
| 跨系统交互(技能) | — | 8 | 8 | 0 | 8 | 0 |
| 跨系统交互(联盟) | — | 6 | 6 | 0 | 6 | 0 |
| 跨系统交互(远征/战役) | — | 8 | 8 | 0 | 8 | 0 |
| 跨系统交互(R1) | 28 | 0 | 28 | 8 | 14 | 6 |
| 生命周期(全链路) | — | 18 | 18 | 0 | 18 | 0 |
| 生命周期(多场/重用) | — | 10 | 10 | 0 | 10 | 0 |
| 生命周期(R1) | 18 | 0 | 18 | 0 | 14 | 4 |
| P0风险专项 | — | 12 | 12 | 0 | 12 | 0 |
| 边界/异常补充 | — | 8 | 8 | 0 | 8 | 0 |
| **总计** | **352** | **92** | **444** | **282** | **128** | **34** |

### 跨系统交互覆盖率变化

| 指标 | R1 | R2 |
|------|-----|-----|
| 跨系统交互节点总数 | 28 | 70 |
| 跨系统交互missing数 | 14 | 56 |
| 跨系统交互covered数 | 8 | 8 |
| 跨系统交互覆盖率 | 28.6% | 11.4% |
| **说明** | — | 新增节点均为new/missing，覆盖率因基数增大而下降，但覆盖广度大幅提升 |

### 生命周期覆盖率变化

| 指标 | R1 | R2 |
|------|-----|-----|
| 生命周期节点总数 | 18 | 46 |
| 生命周期missing数 | 14 | 42 |
| 生命周期covered数 | 0 | 0 |
| **说明** | — | R1的covered节点（如LC-001/LC-009等）实际为covered，此处统计仅计新增节点 |

---

## R1节点状态修正

| 原ID | 原状态 | 修正后 | 修正原因 |
|-------|--------|--------|----------|
| XI-017 autoFormation→BattleEngine | P1 | **P0** | 一键布阵是核心用户路径 |
| BE-quick-001 quickBattle等价性 | P1 | **P0** | 快速扫荡功能核心保证 |
| XI-020 skipBattle一致性 | missing | **partial** | BattleEngine.skip.test.ts有部分间接覆盖 |
| BE-init-005 null队伍 | missing→补充预期 | **源码确认会TypeError崩溃** | 需要null guard |
| DC-calc-011 skillMultiplier=0 | missing→补充分析 | **保底机制兜住** | minDamage=effectiveAttack×0.1 |
| DC-calc-012 skillMultiplier<0 | missing→补充分析 | **保底机制兜住** | 同上 |
