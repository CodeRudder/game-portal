# Battle模块流程分支树 — Round 3

> 生成时间：2025-05-02
> 模块路径：`src/games/three-kingdoms/engine/battle/`
> 基于R2 tree（444节点）补充，聚焦封版4项P0：NaN防护、序列化、autoFormation链路、装备加成确认

---

## R3 新增统计

| 维度 | R2 | R3新增 | R3总计 |
|------|-----|--------|--------|
| **总节点数** | 444 | **68** | **512** |
| P0 阻塞 | 180 | 28 | 208 |
| P1 严重 | 197 | 26 | 223 |
| P2 一般 | 67 | 14 | 81 |

### R3新增节点按维度分布

| 维度 | 新增节点 | 说明 |
|------|----------|------|
| NaN防护专项 | 8 | 全链路NaN传播路径验证 |
| 序列化/反序列化 | 10 | BattleEngine缺失序列化 + 子系统序列化一致性 |
| autoFormation链路 | 12 | 一键布阵→initBattle→战斗执行全链路 |
| 装备加成确认 | 10 | generalToBattleUnit不含装备的确认及影响评估 |
| R2 P0修复验证 | 8 | 验证R2发现的3个P0是否已修复 |
| 边界/回归补充 | 12 | 精确边界值、回归测试 |
| R3新发现P0 | 8 | 源码审查新发现 |
| **合计** | **68** | |

### R3修正（来自R2 verdict和源码审查）

| 修正项 | 原状态 | 修正后 |
|--------|--------|--------|
| XI-EQ-001~002 装备攻击加成 | P0(假设存在) | **P0(确认不存在)** — generalToBattleUnit只用baseStats |
| P0-DMG-001 负伤害治疗漏洞 | 源码确认存在 | **P0(未修复)** — applyDamage无入口guard |
| P0-DMG-003 NaN漏洞 | 源码确认存在 | **P0(未修复)** — Math.min(NaN,hp)=NaN |
| P0-INIT-001 null防护 | 源码确认崩溃 | **P0(未修复)** — initBattle无null guard |
| BattleEngine序列化 | missing | **P0(缺失)** — Engine无serialize/deserialize |

---

## 25. NaN防护专项（新增）

> R2确认NaN可通过applyDamage传播到hp，R3追踪全链路NaN入口和传播路径

### 25a. NaN入口点验证

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| NAN-001 | error | calculateDamage中attack=NaN传播路径 | attacker.attack=NaN | effectiveAttack=NaN→rawDamage=NaN→baseDamage=max(1,NaN)=NaN→damageAfterSkill=NaN→finalDamage=NaN→minDamage=NaN→isMinDamage=NaN<NaN=false→finalDamage=NaN→Math.floor(NaN)=NaN。**保底不兜住NaN** | **new** | P0 |
| NAN-002 | error | calculateDamage中defense=NaN传播路径 | defender.defense=NaN | effectiveDefense=NaN→rawDamage=有效数→baseDamage=max(1,有效数)=有效数→后续正常。**仅当attack也为NaN时才全链NaN** | **new** | P1 |
| NAN-003 | error | applyDamage中damage=NaN→hp=NaN | defender.hp=500, damage=NaN | remainingDamage=NaN→shield检查`NaN>0`为false跳过→actualDamage=Math.min(NaN,500)=NaN→hp-=NaN→hp=NaN→hp<=0为false→isAlive保持true。**NaN单位永死不了，战斗无限** | **new** | P0 |
| NAN-004 | error | NaN hp的单位参与buildTurnOrder | unit.hp=NaN, isAlive=true | getAliveUnits返回该单位→参与速度排序→正常行动。**NaN单位成为不死单位** | **new** | P0 |

### 25b. NaN防护建议

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| NAN-005 | guard | calculateDamage入口NaN检查 | 任何NaN属性 | `if(!isFinite(effectiveAttack)) return fallbackDamage(1)` | **new** | P0 |
| NAN-006 | guard | applyDamage入口NaN检查 | damage=NaN | `if(!isFinite(damage) || damage<=0) return 0` | **new** | P0 |
| NAN-007 | guard | generalToBattleUnit入口NaN检查 | baseStats含NaN | `if(!isFinite(stat)) stat=0` 或抛错 | **new** | P1 |
| NAN-008 | guard | BattleUnit.hp setter防护 | hp被设为NaN | `if(!isFinite(value)) value=0` | **new** | P1 |

---

## 26. 序列化/反序列化（新增）

> R2未覆盖的关键缺失：BattleEngine本身无序列化能力，仅子系统有

### 26a. BattleEngine序列化缺失

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| SER-001 | missing | BattleEngine无serialize/deserialize方法 | 查看源码 | **确认缺失**：BattleEngine类无serialize/deserialize。仅getState返回{battleMode}，不含BattleState | **new** | P0 |
| SER-002 | missing | BattleState无法持久化/恢复 | 战斗进行中需要存档 | BattleState是纯数据接口，但无对应的序列化器。**存档/读档功能无法实现** | **new** | P0 |
| SER-003 | missing | 战斗回放无法实现 | 战斗结束需要回放 | actionLog在BattleState中，但BattleState不可序列化→回放功能缺失 | **new** | P1 |

### 26b. 子系统序列化一致性

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| SER-004 | cross | BattleSpeedController.serialize/deserialize一致性 | serialize→deserialize | speed, turnInterval, animationScale完全恢复 | **covered** | P0 |
| SER-005 | cross | UltimateSkillSystem.serialize/deserialize一致性 | serialize→deserialize | state, enabled, pendingUnitId, pendingSkillId完全恢复 | **new** | P0 |
| SER-006 | cross | DamageCalculator无序列化需求 | 纯函数无状态 | serialize不适用（无状态），正确 | **new** | P2 |
| SER-007 | cross | BattleTurnExecutor无序列化需求 | 无持久状态 | serialize不适用（无状态），正确 | **new** | P2 |

### 26c. 序列化边界场景

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| SER-008 | boundary | SKIP速度序列化后反序列化 | speed=SKIP→serialize→deserialize | 恢复为SKIP状态，getAdjustedTurnInterval()=0 | **new** | P0 |
| SER-009 | boundary | 时停暂停中序列化 | ultimateSystem.state=PAUSED | serialize包含PAUSED状态，deserialize后仍为PAUSED | **new** | P1 |
| SER-010 | error | 反序列化null/undefined数据 | deserialize(null) | 应抛出明确错误或安全忽略，不崩溃 | **new** | P1 |

---

## 27. autoFormation链路（新增）

> 一键布阵是核心用户路径（R2升级为P0），R3覆盖完整链路

### 27a. autoFormation核心逻辑

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| AF-001 | core | autoFormation按防御降序分配前排 | 6人(防御: 300,200,100,50,50,50) | 前排=防御300/200/100的3人 | **covered** | P0 |
| AF-002 | core | autoFormation同防御按HP降序 | 2人防御=200, HP分别为5000/3000 | HP5000排前面 | **new** | P1 |
| AF-003 | core | autoFormation空队伍 | units=[] | team.units=[], score=0 | **covered** | P0 |
| AF-004 | core | autoFormation 1人队伍 | 1人 | frontLine=[该人], backLine=[], score计算正确 | **new** | P1 |
| AF-005 | core | autoFormation 7人截断为6人 | 7个存活单位 | 取前6人，忽略第7人 | **new** | P0 |
| AF-006 | core | autoFormation跳过死亡单位 | 6人中2人死亡 | 有效4人，前排min(3,4)=3，后排1人 | **new** | P0 |
| AF-007 | core | autoFormation评分公式验证 | frontDef=600, backAtk=400, valid=4 | score=min(100, round((600×0.5+400×0.5)/4))=min(100,125)=100 | **new** | P1 |

### 27b. autoFormation→initBattle→战斗执行链路

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| AF-LINK-001 | lifecycle | autoFormation结果直接传入initBattle | autoFormation返回team | initBattle正常接受，turnOrder正确生成 | **new** | P0 |
| AF-LINK-002 | lifecycle | autoFormation后runFullBattle完整战斗 | autoFormation→runFullBattle | 战斗正常结束，结果有效 | **new** | P0 |
| AF-LINK-003 | lifecycle | autoFormation side='ally'传入enemyTeam位置 | team.side='ally'作为enemyTeam | 不影响战斗逻辑（side仅标识） | **new** | P2 |
| AF-LINK-004 | lifecycle | autoFormation修改了原数组中的position | autoFormation执行后 | 原始units数组中的position被修改（**副作用确认**） | **new** | P1 |
| AF-LINK-005 | lifecycle | HeroFormation.autoFormation→buildAllyTeam→autoFormation | HeroFormation层autoFormation | HeroFormation.autoFormationByIds调用engine battle autoFormation | **new** | P0 |

---

## 28. 装备加成确认（新增）

> **R3关键发现**：generalToBattleUnit只使用g.baseStats，不含装备/羁绊加成

### 28a. 源码确认

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| EQ-CONF-001 | confirm | generalToBattleUnit使用baseStats非totalStats | 查看engine-campaign-deps.ts:160 | `attack: g.baseStats.attack` — **确认不含装备加成** | **confirmed** | P0 |
| EQ-CONF-002 | confirm | GeneralData.baseStats是原始属性不含任何加成 | 查看hero.types.ts:143 | baseStats: GeneralStats — 静态配置属性 | **confirmed** | P0 |
| EQ-CONF-003 | confirm | HeroSystem.calculatePower含装备系数但仅用于战力 | 查看HeroSystem.ts:186 | equipPower仅影响calculatePower，不影响baseStats | **confirmed** | P1 |

### 28b. 影响评估

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| EQ-IMP-001 | impact | 装备+100攻击的武将在战斗中无加成效果 | 武将baseStats.attack=500, 装备+100 | BattleUnit.attack=500（不含装备+100）。**玩家感知：装备无用** | **new** | P0 |
| EQ-IMP-002 | impact | 装备战力高但战斗伤害不增加 | 装备战力1000 vs 0 | calculatePower差1000，但battle damage完全相同 | **new** | P0 |
| EQ-IMP-003 | impact | 羁绊系数同样不影响战斗属性 | 羁绊系数=1.2 | calculatePower含羁绊，battle不含 | **new** | P1 |
| EQ-IMP-004 | design | 这是否为设计意图（装备仅影响战力数字） | — | 需确认：如果设计意图是装备不影响战斗，则需文档说明；否则为P0缺陷 | **new** | P0 |

### 28c. 修复方向建议

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| EQ-FIX-001 | fix | generalToBattleUnit应使用totalStats | HeroAttributeCompare分解total | `attack: totalStats.attack`（base + equip + tech + buff） | **new** | P0 |
| EQ-FIX-002 | fix | buildAllyTeam需注入EquipmentSystem | buildAllyTeam签名 | 新增参数获取装备加成，或从HeroSystem获取totalStats | **new** | P1 |
| EQ-FIX-003 | fix | enemyDefToBattleUnit不受影响（敌方无装备系统） | — | 敌方直接使用配置值，正确 | **new** | P2 |

---

## 29. R2 P0修复验证（新增）

> 验证R2发现的3个确认P0是否已修复

### 29a. P0-1: initBattle null防护

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| FIX-INIT-001 | verify | allyTeam=null传入initBattle | R2 P0-INIT-001 | **未修复**：initBattle直接赋值state.allyTeam=null，buildTurnOrder→getAliveUnits(null)→TypeError | **verified-unfixed** | P0 |
| FIX-INIT-002 | verify | allyTeam={units:null}传入initBattle | allyTeam.units=null | **未修复**：getAliveUnits→null.filter→TypeError | **verified-unfixed** | P0 |
| FIX-INIT-003 | verify | 建议修复方案 | — | initBattle入口：`if(!allyTeam?.units || !enemyTeam?.units) throw new Error('...')` | **new** | P0 |

### 29b. P0-2: applyDamage负伤害治疗漏洞

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| FIX-DMG-001 | verify | applyDamage(damage=-100) | R2 P0-DMG-001 | **未修复**：remainingDamage=-100→shield检查`-100>0`跳过→actualDamage=Math.min(-100,500)=-100→hp-=(-100)→hp=600。**治疗漏洞仍存在** | **verified-unfixed** | P0 |
| FIX-DMG-002 | verify | 建议修复方案 | — | applyDamage入口：`if(!isFinite(damage) || damage<=0) return 0` | **new** | P0 |

### 29c. P0-3: NaN漏洞

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| FIX-NAN-001 | verify | applyDamage(damage=NaN) | R2 P0-DMG-003 | **未修复**：Math.min(NaN,hp)=NaN→hp=NaN→NaN单位不死 | **verified-unfixed** | P0 |
| FIX-NAN-002 | verify | calculateDamage中attack=NaN | NAN-001 | **未修复**：全链NaN传播，保底不兜住 | **verified-unfixed** | P0 |

---

## 30. R3新发现P0（源码审查）

> R3源码审查中发现的新的P0级问题

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| NEW-P0-001 | design | **装备加成不传递到战斗** — 最严重的设计缺陷 | 武将有装备 | generalToBattleUnit只用baseStats，装备完全无效。**玩家核心养成线断裂** | **new** | P0 |
| NEW-P0-002 | missing | **BattleEngine无序列化能力** — 存档/读档不可用 | 战斗中存档 | Engine无serialize/deserialize，BattleState无法持久化 | **new** | P0 |
| NEW-P0-003 | side-effect | **autoFormation修改原始units数组的position** | autoFormation(units) | sorted=[...valid]浅拷贝，但sorted.forEach中`u.position=pos`修改了原对象。**副作用污染调用方数据** | **new** | P0 |
| NEW-P0-004 | logic | **HP=0但isAlive=true的单位仍参与战斗** | hp=0, isAlive=true | getAliveUnits检查isAlive不检查hp→HP=0单位仍行动。initBattle不校验hp>0 | **new** | P1 |
| NEW-P0-005 | logic | **endTurn在currentTurn>=maxTurns时设置FINISHED，但executeTurn中也会设置** | 回合恰好=maxTurns | endTurn设FINISHED→executeTurn中isBattleOver检查phase=FINISHED返回true→双重设置不冲突，但逻辑冗余 | **new** | P2 |
| NEW-P0-006 | edge | **quickBattle等价性未保证** — skipBattle设置SKIP速度后不恢复 | quickBattle调用 | quickBattle=initBattle+skipBattle，skipBattle设speed=SKIP不恢复。**连续quickBattle后speedController累积为SKIP** | **new** | P0 |
| NEW-P0-007 | edge | **ExpeditionBattleSystem完全独立于BattleEngine** — 两套战斗逻辑 | 远征战斗 | ExpeditionBattleSystem使用自己的simulateBattle（基于战力比），不使用BattleEngine。**战斗结果可能不一致** | **new** | P1 |
| NEW-P0-008 | edge | **generalToBattleUnit的skillMultiplier硬编码1.5** | 所有武将技能 | 所有技能multiplier=1.5，rageCost=50，cooldown=3。**技能差异化缺失** | **new** | P1 |

---

## 31. 边界/回归补充（新增）

| ID | 类型 | 描述 | 前置条件 | 预期结果 | 测试状态 | 优先级 |
|----|------|------|----------|----------|----------|--------|
| BDY-R3-001 | boundary | autoFormation评分恰好100边界 | frontDef×0.5+backAtk×0.5=valid.length×100 | score=100（不截断） | **new** | P1 |
| BDY-R3-002 | boundary | autoFormation评分超过100 | 计算值=150 | score=min(100,150)=100 | **new** | P1 |
| BDY-R3-003 | boundary | 6人全防御相同全HP相同 | 6人防御=200, HP=5000 | 按数组原序分配前排/后排 | **new** | P2 |
| BDY-R3-004 | regression | R2修复后skipBattle+runFullBattle速度隔离 | skipBattle→reset→runFullBattle | reset恢复X1，第二场正常速度 | **new** | P0 |
| BDY-R3-005 | regression | R2修复后连续runFullBattle结果一致 | 相同队伍×10次 | 每次结果独立（随机波动导致数值略有差异，但胜负一致） | **new** | P0 |
| BDY-R3-006 | boundary | BattleState.actionLog极大（100回合战斗） | maxTurns=100 | actionLog.length合理，内存不溢出 | **new** | P2 |
| BDY-R3-007 | boundary | 武将level=0时maxHp计算 | level=0, defense=0 | maxHp=500+0×100+0×10=500（最低500） | **new** | P1 |
| BDY-R3-008 | boundary | 武将level=100时maxHp计算 | level=100, defense=500 | maxHp=500+100×100+500×10=15500 | **new** | P1 |
| BDY-R3-009 | boundary | 武将defense=0时maxHp最低值 | level=1, defense=0 | maxHp=500+100+0=600 | **new** | P2 |
| BDY-R3-010 | regression | autoFormation空队伍score=0 | units=[] | {team:{units:[]}, frontLine:[], backLine:[], score:0} | **new** | P1 |
| BDY-R3-011 | boundary | ExpeditionBattleSystem quickBattle中powerRatio=0 | allyPower=0, enemyPower=100 | powerRatio=0/Math.max(100,1)=0→压倒性劣势→allyHpPercent=random×10 | **new** | P1 |
| BDY-R3-012 | boundary | ExpeditionBattleSystem enemyPower=0 | allyPower=100, enemyPower=0 | powerRatio=100/Math.max(0,1)=100→压倒性优势→allyHpPercent=85~100 | **new** | P1 |

---

## R3 更新后的总统计

| 系统 | R2节点 | R3新增 | R3总计 | covered | missing | partial | new |
|------|--------|--------|--------|---------|---------|---------|-----|
| BattleEngine | 52 | 0 | 52 | 42 | 4 | 6 | 0 |
| DamageCalculator | 36 | 0 | 36 | 30 | 2 | 4 | 0 |
| BattleTurnExecutor | 38 | 0 | 38 | 30 | 4 | 4 | 0 |
| BattleTargetSelector | 24 | 0 | 24 | 20 | 2 | 2 | 0 |
| UltimateSkillSystem | 32 | 0 | 32 | 26 | 2 | 4 | 0 |
| BattleSpeedController | 28 | 0 | 28 | 22 | 2 | 4 | 0 |
| BattleEffectApplier | 22 | 0 | 22 | 18 | 2 | 2 | 0 |
| BattleEffectManager | 24 | 0 | 24 | 18 | 2 | 4 | 0 |
| DamageNumberSystem | 20 | 0 | 20 | 16 | 2 | 2 | 0 |
| BattleStatistics | 12 | 0 | 12 | 10 | 0 | 2 | 0 |
| BattleFragmentRewards | 10 | 0 | 10 | 8 | 0 | 2 | 0 |
| autoFormation | 12 | 12 | 24 | 10 | 0 | 2 | 12 |
| battle-helpers | 16 | 0 | 16 | 14 | 0 | 2 | 0 |
| 跨系统交互(hero) | 12 | 0 | 12 | 0 | 12 | 0 | 0 |
| 跨系统交互(装备) | 8 | 10 | 18 | 0 | 8 | 0 | 10 |
| 跨系统交互(技能) | 8 | 0 | 8 | 0 | 8 | 0 | 0 |
| 跨系统交互(联盟) | 6 | 0 | 6 | 0 | 6 | 0 | 0 |
| 跨系统交互(远征/战役) | 8 | 0 | 8 | 0 | 8 | 0 | 0 |
| 跨系统交互(R1) | 28 | 0 | 28 | 8 | 14 | 6 | 0 |
| 生命周期(全链路) | 18 | 0 | 18 | 0 | 18 | 0 | 0 |
| 生命周期(多场/重用) | 10 | 0 | 10 | 0 | 10 | 0 | 0 |
| 生命周期(R1) | 18 | 0 | 18 | 0 | 14 | 4 | 0 |
| P0风险专项 | 12 | 0 | 12 | 0 | 12 | 0 | 0 |
| 边界/异常(R2) | 8 | 0 | 8 | 0 | 8 | 0 | 0 |
| NaN防护专项 | — | 8 | 8 | 0 | 0 | 0 | 8 |
| 序列化/反序列化 | — | 10 | 10 | 1 | 0 | 0 | 9 |
| R2 P0修复验证 | — | 8 | 8 | 0 | 0 | 0 | 8 |
| R3新发现P0 | — | 8 | 8 | 0 | 0 | 0 | 8 |
| 边界/回归(R3) | — | 12 | 12 | 0 | 0 | 0 | 12 |
| **总计** | **444** | **68** | **512** | **283** | **128** | **34** | **67** |

### R3关键指标变化

| 指标 | R2 | R3 | 变化 |
|------|-----|-----|------|
| 总节点数 | 444 | 512 | +68 |
| P0节点数 | 180 | 208 | +28 |
| confirmed P0缺陷 | 3 | **5** | +2（装备加成缺失、序列化缺失） |
| verified-unfixed P0 | 0 | **5** | R2的3个P0全部未修复 |
| covered节点 | 282 | 283 | +1（SER-004） |
| new节点 | 92 | 67 | R3新增 |
| 测试覆盖率 | 63.5% | 55.3% | 因新增节点基数增大而下降 |

### R3 P0缺陷清单（封版阻塞项）

| # | 缺陷ID | 描述 | 状态 | 修复难度 |
|---|--------|------|------|----------|
| 1 | FIX-INIT-001/002 | initBattle无null防护→TypeError崩溃 | **未修复** | 低（加guard） |
| 2 | FIX-DMG-001 | applyDamage负伤害治疗漏洞 | **未修复** | 低（加guard） |
| 3 | FIX-NAN-001/002 | NaN全链传播→不死单位 | **未修复** | 中（多处guard） |
| 4 | NEW-P0-001 | 装备加成不传递到战斗 | **新发现** | 中（改generalToBattleUnit） |
| 5 | NEW-P0-002 | BattleEngine无序列化能力 | **新发现** | 高（新增serialize/deserialize） |
| 6 | NEW-P0-003 | autoFormation副作用污染原数据 | **新发现** | 低（深拷贝） |
| 7 | NEW-P0-006 | quickBattle后speedController累积SKIP | **新发现** | 低（quickBattle后reset speed） |
