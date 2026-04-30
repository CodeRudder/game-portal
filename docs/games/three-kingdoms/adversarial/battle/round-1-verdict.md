# Battle模块仲裁裁决 — Round 1

> 仲裁者: TreeArbiter (PM Agent)
> 裁决时间: 2025-05-01
> 依据文件: round-1-tree.md, round-1-challenges.md

---

## 评分

| 维度 | 分数 | 说明 |
|------|------|------|
| 完备性 | **7.5/10** | 树覆盖了16个子系统、352个节点、143个公开API中的约110个（77%）。核心战斗系统（DamageCalculator/BattleTargetSelector/BattleStatistics/BattleFragmentRewards/autoFormation/battle-helpers）API覆盖率达100%。但存在明显盲区：①跨系统交互28节点中14个missing（覆盖率50%），②数据生命周期18节点中14个missing（覆盖率22%），③33个API完全未出现在树中。BattleEngine作为核心入口有82%覆盖率，但quickBattle等便捷方法缺少等价性验证。 |
| 准确性 | **8.0/10** | 已枚举节点的描述与源码逻辑高度吻合。伤害公式（基础伤害=攻击×(1+加成)-防御×(1+加成)，最终=max(1,基础)×倍率×暴击×克制×波动）、星级评定（★=通关，★★=存活≥4，★★★=存活≥4+回合≤6）、怒气机制（攻击+25/被击+15/消耗100）等关键参数描述准确。克制关系（骑兵>步兵>枪兵>骑兵，弓兵/谋士无克制）描述完整。扣分项：①树中BE-init-005标注null队伍为missing但未明确说明源码行为（会崩溃而非返回安全默认值）；②DC-calc-011/012标注skillMultiplier=0/-1为missing但未分析源码中实际行为；③部分跨系统节点（XI-020 skipBattle一致性）标missing但实际有间接测试覆盖。 |
| 优先级 | **8.5/10** | P0/P1/P2分布合理：P0=148(42.0%)、P1=155(44.0%)、P2=49(14.0%)。核心战斗路径（初始化、回合执行、伤害计算、胜负判定、星级评定）均标记为P0。挑战者识别的5个结构性风险全部为P0级，与树中优先级一致。扣分项：①skipBattle与runFullBattle一致性（XI-020）标P0正确，但quickBattle等价性验证仅标P1，应为P0——这是快速扫荡功能的核心保证；②autoFormation→BattleEngine链路（XI-017）标P1，但作为一键布阵→战斗的核心用户路径应提升至P0；③DamageNumberSystem部分节点标P0偏高（创建数字类型是P1级别的UI功能，非核心逻辑）。 |
| 可测试性 | **8.5/10** | 节点设计质量高：每个节点包含ID、类型、描述、前置条件、预期结果、测试状态、优先级七要素，可直接转化为测试用例。ID命名规范（系统前缀-功能-序号）便于追踪。正常/边界/异常/跨系统/生命周期五种类型分类清晰。扣分项：①跨系统交互节点缺少具体的"验证步骤"（如XI-009仅说"碎片奖励→HeroSystem碎片增加"但未说明如何获取HeroSystem实例进行验证）；②部分lifecycle节点（LC-012武将→BattleUnit转换）范围模糊，未明确是哪个系统负责转换；③missing节点未提供"关键断言点"或"最小复现代码"。 |
| 挑战应对 | **7.0/10** | 挑战者发现了重要的结构性遗漏：①F-Error遗漏20项——最突出的是null防护缺失（initBattle、executeUnitAction、calculateDamage），这是P0级生产缺陷隐患；②F-Boundary遗漏25项——负伤害"治疗漏洞"、零攻击力保底机制、NaN/Infinity防护等；③F-Cross遗漏16项——碎片奖励→HeroSystem链路、远征→战斗复用、多场隔离等核心交互缺失；④F-Lifecycle遗漏12项——战斗序列化/反序列化、引擎重用、SKIP后速度恢复等。挑战者还识别了5个结构性风险并提供了源码级别的分析，这是高价值的发现。扣分项：①挑战者对部分已有间接测试覆盖的场景（如XI-020在BattleEngine.skip.test.ts中有部分验证）标为missing，存在一定的虚报；②未识别"战斗引擎并发使用"风险——如果同一引擎实例被两个异步流程同时调用runFullBattle，共享的speedController/ultimateSystem可能导致状态混乱。 |

| **总分** | **7.9/10** | |

---

## 裁决

- **封版: NO**
- **原因:**

  1. **跨系统交互覆盖率严重不足**：28个跨系统节点中14个missing（50%），远低于封版要求的≥70%。最关键的缺失包括：碎片奖励→HeroSystem链路（核心经济闭环）、远征→战斗复用（核心玩法路径）、skipBattle一致性（快速扫荡功能保证）、多场战斗隔离（引擎重用安全性）。

  2. **数据生命周期覆盖率极低**：18个生命周期节点中14个missing（22%），远低于封版要求的≥65%。战斗状态序列化/反序列化、引擎重用、SKIP后速度恢复等核心生命周期缺失。

  3. **P0级生产风险未解决**：
     - **null防护缺失**：initBattle传入null队伍会直接崩溃，影响所有上游调用者（Campaign/Expedition）。
     - **负伤害"治疗漏洞"**：applyDamage不检查负数，上游异常可能导致HP增加。
     - **SKIP模式速度污染**：skipBattle设置SKIP但不恢复，影响后续战斗。
     - 这些风险必须在封版前通过测试确认源码是否已做防护或补充防护。

  4. **API覆盖率未达标**：77%低于封版要求的≥90%。33个API未被枚举，其中包含isSkipMode/isTimeStopPaused/getUltimateSystem等状态查询API和generateHealAnimation/generateDotAnimation等动画生成API。

  5. **端到端链路缺失**：武将→BattleUnit→战斗→结果→碎片→资源增加的完整链路、科技加成→BattleEffectApplier→伤害结果的应用链路均无端到端测试覆盖。这些是玩家最核心的游戏体验路径。

---

## Round 2 要求

### 1. 优先补充（P0 — 必须完成）

| # | 内容 | 类型 | 预期新增节点 | 说明 |
|---|------|------|-------------|------|
| R2-01 | **null防护测试节点** | F-Error | ~8 | 为initBattle/executeUnitAction/calculateDamage/applyDamage分别补充null/undefined/损坏state的异常路径节点。每个API 2个节点：null输入、undefined输入 |
| R2-02 | **负伤害/非法数值防护** | F-Boundary | ~6 | applyDamage负数、calculateDamage中skillMultiplier=0/-1/NaN/Infinity、attack=0保底机制验证 |
| R2-03 | **碎片奖励→HeroSystem完整链路** | F-Cross | ~6 | VICTORY→calculateFragmentRewards→HeroSystem.addFragment→验证碎片数量。包含首通必掉、普通掉率、失败无碎片3种场景 |
| R2-04 | **skipBattle与runFullBattle一致性** | F-Cross | ~4 | 相同队伍配置下两种方式的outcome/stars/totalTurns一致性验证。包含强vs弱、弱vs强、均势3种场景 |
| R2-05 | **多场战斗状态隔离** | F-Lifecycle | ~6 | 同一引擎连续runFullBattle 10次，验证每次结果独立。包含：速度状态不残留、时停状态不残留、怒气不跨场累积 |
| R2-06 | **SKIP模式速度恢复** | F-Lifecycle | ~4 | skipBattle→验证速度=SKIP→后续runFullBattle→验证速度不影响→手动reset→验证恢复X1 |
| R2-07 | **战斗状态序列化/反序列化** | F-Lifecycle | ~6 | initBattle→执行2回合→serialize→deserialize→继续战斗→结果一致。包含：空state、进行中state、结束state |
| R2-08 | **远征→战斗复用验证** | F-Cross | ~4 | ExpeditionBattleSystem调用BattleEngine→验证战斗参数正确→结果正确传递 |

### 2. 重点改进（P1 — 应完成）

| # | 内容 | 类型 | 预期新增节点 | 说明 |
|---|------|------|-------------|------|
| R2-09 | **科技加成端到端应用链路** | F-Cross | ~6 | TechEffectSystem注入→BattleEffectApplier.setTechEffectSystem→applyTechBonusesToTeam→runFullBattle→伤害结果包含科技加成 |
| R2-10 | **autoFormation→BattleEngine链路** | F-Cross | ~4 | autoFormation→initBattle→前排承受伤害验证→后排受伤较少验证 |
| R2-11 | **战斗模式中途切换** | F-Cross | ~3 | AUTO→SEMI_AUTO切换→大招时停触发→MANUAL→行为正确 |
| R2-12 | **handler回调异常安全** | F-Error | ~4 | IUltimateTimeStopHandler抛出异常→战斗不卡住、ISpeedChangeListener抛出异常→速度仍正确切换 |
| R2-13 | **BattleEngine.reset()完整验证** | F-Lifecycle | ~4 | 使用引擎→reset→验证battleMode=AUTO/speed=X1/ultimateSystem禁用→可正常使用 |
| R2-14 | **多层Buff叠加伤害计算** | F-Cross | ~4 | ATK_UP+DEF_DOWN+克制+暴击同时作用→伤害结果正确。包含：2层、3层、5层叠加 |
| R2-15 | **羁绊→编队→战斗属性链路** | F-Cross | ~4 | BondSystem加成→编队战力→BattleUnit属性→战斗伤害 |
| R2-16 | **精确边界值补充** | F-Boundary | ~10 | 存活恰好4人+回合恰好6→三星、怒气恰好100→大招就绪、护盾恰好等于伤害、HP恰好为1等 |

### 3. 建议改进（P2 — 可选）

| # | 内容 | 说明 |
|---|------|------|
| R2-17 | 未覆盖查询API补充 | isSkipMode/isTimeStopPaused/getUltimateSystem/getSpeedController等状态查询API |
| R2-18 | 动画生成API补充 | generateHealAnimation/generateDotAnimation/createBatchDamageNumbers |
| R2-19 | DamageNumberSystem配置动态更新 | updateConfig后行为验证 |
| R2-20 | 战斗引擎并发使用安全 | 异步场景下同一引擎实例的安全性 |
| R2-21 | BattleEffectApplier.reset验证 | reset后techEffect=null，行为回退到无科技 |
| R2-22 | 大规模战斗性能 | 6v6满Buff满技能8回合的性能基准 |

### 4. 修正要求

| # | 内容 | 说明 |
|---|------|------|
| R2-FIX-01 | 提升XI-017优先级 | autoFormation→BattleEngine从P1提升至P0，一键布阵是核心用户路径 |
| R2-FIX-02 | 提升quickBattle等价性优先级 | quickBattle与initBattle+skipBattle等价性从P1提升至P0 |
| R2-FIX-03 | 补充BE-init-005预期行为 | null队伍传入应明确预期：抛出错误 or 返回安全默认值 |
| R2-FIX-04 | 补充DC-calc-011/012源码行为分析 | skillMultiplier=0/-1时源码实际行为需明确 |
| R2-FIX-05 | 修正XI-020状态 | 从missing改为partial，BattleEngine.skip.test.ts有部分间接覆盖 |

---

## Round 2 封版门槛

| 指标 | Round 1 现状 | Round 2 门槛 |
|------|-------------|-------------|
| API覆盖率 | ~77% | ≥90% |
| 跨系统交互覆盖率 | 50% | ≥75% |
| 数据生命周期覆盖率 | 22% | ≥65% |
| P0节点covered率 | 89.2% | ≥98% |
| 虚报节点数 | ≥3 | 0 |
| null防护测试 | 0 | 核心API全覆盖 |
| 负伤害防护测试 | 0 | applyDamage全覆盖 |
| 多场隔离测试 | 0 | ≥3种场景 |

> **预期Round 2新增节点: ~75~90个，总节点数达到~430~445个。**

---

## 关键发现总结

### ✅ 做得好的
1. **核心战斗逻辑测试充分**：DamageCalculator/BattleTargetSelector/BattleStatistics/BattleFragmentRewards/autoFormation/battle-helpers 达100% API覆盖
2. **测试文件组织清晰**：按系统+优先级+专项（boundary/path-coverage/fuzz/adversarial）分层
3. **模糊测试已存在**：battle-fuzz.test.ts 提供了随机输入的健壮性验证
4. **对抗测试已存在**：DamageCalculator.adversarial.test.ts 提供了对抗性测试范式
5. **集成测试链路覆盖**：chain2-hero-formation-battle.integration.test.ts 覆盖了武将→编队→战斗的核心链路

### ❌ 需要改进的
1. **跨系统交互是最大短板**：碎片奖励→HeroSystem、远征→战斗、科技→伤害等核心链路缺失
2. **异常输入防护不足**：null/undefined/负数/NaN等边界条件缺少系统性覆盖
3. **引擎重用安全性未验证**：多场战斗隔离、SKIP模式速度污染、reset后状态恢复
4. **序列化/反序列化缺失**：战斗状态的持久化和恢复能力未测试
5. **端到端链路不完整**：缺少从武将数据到最终奖励的完整验证
