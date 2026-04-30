# Battle模块挑战清单 — Round 2

> 生成时间: 2025-05-02
> 挑战者: TreeChallenger (Tester Agent)
> 范围: R2 tree完整性审查 + 5个P0源码验证 + 新增节点质量评估

---

## 一、R2 Tree完整性审查

### 1.1 覆盖维度检查

| 维度 | R1状态 | R2补充 | 评估 |
|------|--------|--------|------|
| 跨系统交互: battle↔hero属性 | 8/28 covered | +12节点 | ✅ 覆盖了属性映射、升级、编队、技能映射 |
| 跨系统交互: battle↔装备 | 0节点 | +8节点 | ✅ 新增维度，覆盖装备属性传递 |
| 跨系统交互: battle↔技能 | 间接覆盖 | +8节点 | ✅ 细化了技能映射和触发 |
| 跨系统交互: battle↔联盟buff | 0节点 | +6节点 | ✅ 新增维度，覆盖联盟加成 |
| 跨系统交互: 远征/战役 | 2个missing | +8节点 | ✅ 覆盖ExpeditionBattleSystem和CampaignSystem |
| 生命周期: 全链路 | 4/18 covered | +18节点 | ✅ 覆盖初始化→执行→结算→奖励→清理5个阶段 |
| 生命周期: 多场/重用 | 0节点 | +10节点 | ✅ 覆盖连续战斗、reset、状态隔离 |
| P0风险专项 | 0节点 | +12节点 | ✅ 5个P0风险各有2-3个专项节点 |

### 1.2 R1 Verdict要求对照

| R2要求 | 节点数要求 | 实际交付 | 状态 |
|--------|-----------|----------|------|
| R2-01 null防护测试 | ~8 | 5 (P0-INIT×3, P0-ACT×2) | ⚠️ 略少，但覆盖了3个核心API |
| R2-02 负伤害/非法数值 | ~6 | 4 (P0-DMG×3, BDY-006/007) | ⚠️ 覆盖了关键场景 |
| R2-03 碎片→HeroSystem链路 | ~6 | 4 (LC-REWARD×4) | ⚠️ 覆盖了核心场景 |
| R2-04 skipBattle一致性 | ~4 | 3 (P0-SKIP×3) + XI-020修正 | ✅ |
| R2-05 多场战斗隔离 | ~6 | 6 (LC-MULTI-001~006) | ✅ |
| R2-06 SKIP速度恢复 | ~4 | 3 (P0-SKIP-001~003) | ✅ |
| R2-07 序列化/反序列化 | ~6 | 0 | ❌ **未补充** |
| R2-08 远征→战斗复用 | ~4 | 4 (XI-EXP-001~004) | ✅ |
| R2-09 科技加成端到端 | ~6 | 0 | ❌ **未补充**（R1已有XI-006/007） |
| R2-10 autoFormation→BattleEngine | ~4 | 0独立节点 | ❌ **未补充**（优先级已提升至P0） |
| R2-11 战斗模式中途切换 | ~3 | 0 | ❌ **未补充** |
| R2-12 handler回调异常安全 | ~4 | 0 | ❌ **未补充** |
| R2-13 BattleEngine.reset() | ~4 | 2 (LC-MULTI-006/007) | ⚠️ 部分 |
| R2-14 多层Buff叠加 | ~4 | 0 | ❌ **未补充** |
| R2-15 羁绊→编队→战斗 | ~4 | 0 | ❌ **未补充** |
| R2-16 精确边界值 | ~10 | 5 (BDY-001~005) | ⚠️ 部分 |

### 1.3 缺失维度（仍需补充）

| # | 缺失内容 | 优先级 | 影响 |
|---|----------|--------|------|
| 1 | 战斗状态序列化/反序列化 | P0 | R1的LC-002仍为missing，R2未补充 |
| 2 | autoFormation→initBattle→前排承伤验证 | P0 | 优先级已提升但无独立节点 |
| 3 | 战斗模式中途切换(AUTO→SEMI_AUTO) | P1 | R1的XI-021仍为missing |
| 4 | handler回调异常安全 | P1 | UltimateSkillSystem handler抛异常时战斗不卡住 |
| 5 | 多层Buff叠加伤害计算 | P1 | ATK_UP+DEF_DOWN+克制+暴击同时作用 |
| 6 | 羁绊→编队→战斗属性链路 | P1 | BondSystem加成在BattleUnit属性中体现 |
| 7 | 科技加成端到端应用链路 | P1 | TechEffect→BattleEffectApplier→runFullBattle |

---

## 二、5个P0源码验证

### P0-1: initBattle无null防护 — ✅ 确认真实缺陷

**源码路径**: `BattleEngine.ts:104-128`

```typescript
initBattle(allyTeam: BattleTeam, enemyTeam: BattleTeam): BattleState {
    const state = {
      // ...
      allyTeam,    // 直接赋值，无null检查
      enemyTeam,   // 直接赋值，无null检查
    };
    this.turnExecutor.buildTurnOrder(state);  // 调用getAliveUnits(state.allyTeam)
}
```

**追踪链路**:
1. `initBattle(null, enemyTeam)` → state.allyTeam=null
2. `buildTurnOrder(state)` → `getAliveUnits(state.allyTeam)` → `state.allyTeam.units.filter(...)` → **TypeError: Cannot read properties of null (reading 'units')**

**验证结论**: **真实缺陷**。TypeScript类型系统可防止编译期传入null，但运行时（如从存档反序列化、API边界）无法保证。

**建议修复**: 在initBattle入口添加null guard:
```typescript
if (!allyTeam || !enemyTeam) throw new Error('BattleEngine.initBattle: teams cannot be null');
```

---

### P0-2: applyDamage负伤害"治疗漏洞" — ✅ 确认真实缺陷

**源码路径**: `DamageCalculator.ts:303-330`

```typescript
applyDamage(defender: BattleUnit, damage: number): number {
    if (!defender.isAlive) return 0;
    let remainingDamage = damage;
    // 先扣除护盾
    const shieldAmount = getShieldAmount(defender);
    if (shieldAmount > 0 && remainingDamage > 0) {  // ← 负数跳过护盾检查
      // ...
    }
    // 扣除HP
    const actualDamage = Math.min(remainingDamage, defender.hp);  // Math.min(-100, 500) = -100
    defender.hp -= actualDamage;  // hp -= (-100) → hp += 100 ← 治疗漏洞！
    // ...
    return actualDamage;  // 返回-100
}
```

**验证结论**: **真实缺陷**。当damage<0时:
1. `remainingDamage > 0`检查跳过护盾阶段
2. `Math.min(-100, 500) = -100`
3. `defender.hp -= (-100)` → HP增加100
4. 返回-100（负数"伤害"）

**触发路径分析**: 正常calculateDamage不太可能产生负伤害（保底机制兜住），但如果:
- 上游直接调用applyDamage传入负数
- 未来新增"反伤"机制计算错误
- Buff计算异常导致负值

**建议修复**: 入口添加`if (damage <= 0) return 0;`

---

### P0-3: executeUnitAction无actor null检查 — ⚠️ 部分真实

**源码路径**: `BattleTurnExecutor.ts:109` + `BattleEngine.ts:171`

BattleEngine.executeTurn中的调用链:
```typescript
// BattleEngine.ts:171
const actorId = state.turnOrder[i];
const actor = findUnit(state, actorId);
if (!actor || !actor.isAlive) continue;  // ← 有null防护
const action = this.turnExecutor.executeUnitAction(state, actor);
```

```typescript
// BattleTurnExecutor.ts:109
executeUnitAction(state: BattleState, actor: BattleUnit): BattleAction | null {
    const dotDamage = this.damageCalculator.calculateDotDamage(actor);  // 直接访问actor
}
```

**验证结论**: **间接安全，直接调用有风险**。BattleEngine.executeTurn有`!actor`检查，不会传入null。但如果其他调用者直接调用executeUnitAction且传入null，会崩溃。风险等级从P0降为**P1**（防御性编程建议）。

---

### P0-4: SKIP模式速度污染 — ✅ 确认真实缺陷

**源码路径**: `BattleEngine.ts:372-407`

```typescript
skipBattle(state: BattleState): BattleResult {
    // ...
    this.speedController.setSpeed(BattleSpeed.SKIP);  // 设置SKIP
    // 快速执行所有剩余回合
    while (...) { this.executeTurn(state); ... }
    // ← 没有恢复速度！
    return result;
}
```

```typescript
quickBattle(allyTeam, enemyTeam): BattleResult {
    const state = this.initBattle(allyTeam, enemyTeam);
    return this.skipBattle(state);  // skipBattle设置SKIP不恢复
}
```

**验证结论**: **真实缺陷**。skipBattle和quickBattle都会将speedController设置为SKIP且不恢复。后续使用同一引擎实例的runFullBattle时:
- `getAdjustedTurnInterval()` 返回0（无间隔）
- `getAnimationSpeedScale()` 返回Infinity
- 但runFullBattle本身不依赖interval（直接循环执行），所以**对战斗结果无影响**
- 影响的是**UI层**：如果UI使用getAdjustedTurnInterval来控制动画，会出问题

**风险等级**: 从P0降为**P1**（不影响战斗逻辑正确性，但影响UI体验）

---

### P0-5: 多场战斗状态隔离 — ⚠️ 部分真实

**源码路径**: `BattleEngine.ts:248`

```typescript
runFullBattle(allyTeam, enemyTeam): BattleResult {
    const state = this.initBattle(allyTeam, enemyTeam);  // 每次创建新BattleState
    // ...
}
```

**验证结论**: **BattleState隔离正确**（每次创建新对象）。但**子系统状态可能残留**:
- speedController: 如果上一场skipBattle设置了SKIP，下一场runFullBattle不会重置
- ultimateSystem: 如果上一场PAUSED未确认，下一场可能异常
- battleMode: 不会自动重置为AUTO

**风险等级**: 从P0降为**P1**（核心数据隔离正确，子系统状态需手动reset）

---

## 三、P0源码验证总结

| P0风险 | 验证结果 | 真实性 | 修正后等级 |
|--------|----------|--------|-----------|
| P0-1: initBattle无null防护 | ✅ 确认TypeError崩溃 | **真实** | **P0** |
| P0-2: applyDamage负伤害治疗漏洞 | ✅ 确认HP增加 | **真实** | **P0** |
| P0-3: executeUnitAction无actor null | ⚠️ BattleEngine有防护 | **部分真实** | **P1** |
| P0-4: SKIP模式速度污染 | ✅ 确认不恢复 | **真实但影响有限** | **P1** |
| P0-5: 多场战斗状态隔离 | ⚠️ BattleState隔离正确 | **部分真实** | **P1** |

**真实P0缺陷: 2个**（initBattle null防护、applyDamage负伤害）
**降级为P1: 3个**（actor null检查、SKIP速度污染、多场隔离）

---

## 四、R2 Tree新增节点质量评估

### 4.1 节点设计质量

| 评估项 | 评分 | 说明 |
|--------|------|------|
| ID命名规范 | 9/10 | XI-H-/XI-EQ-/XI-SK-/LC-INIT-/P0-INIT-等前缀清晰 |
| 描述完整性 | 8/10 | 大部分节点有明确的前置条件和预期结果 |
| 源码行为分析 | 9/10 | P0风险节点包含详细的源码追踪和漏洞确认 |
| 优先级准确性 | 8/10 | P0/P1/P2分布合理，与风险等级匹配 |
| 可测试性 | 7/10 | 部分跨系统节点缺少具体的验证方法（如XI-AB-004如何获取联盟加成数据） |

### 4.2 新增维度覆盖质量

| 维度 | 节点数 | 覆盖深度 | 评估 |
|------|--------|----------|------|
| battle↔hero属性 | 12 | 深 | ✅ 覆盖映射、升级、编队、属性推断、空值处理 |
| battle↔装备 | 8 | 中 | ✅ 覆盖攻击/防御/速度/套装/强化/无装备/更换/异常 |
| battle↔技能 | 8 | 中 | ✅ 覆盖active/passive映射、multiplier、cooldown、buffs |
| battle↔联盟buff | 6 | 浅 | ⚠️ 缺少具体的联盟科技数据获取方式 |
| 远征/战役 | 8 | 中 | ✅ 覆盖ExpeditionBattleSystem独立模拟和CampaignSystem完整链路 |
| 生命周期全链路 | 18 | 深 | ✅ 覆盖5个阶段，每个阶段3-4个节点 |
| 多场/引擎重用 | 10 | 深 | ✅ 覆盖连续战斗、reset、状态隔离、SKIP污染 |
| P0风险专项 | 12 | 深 | ✅ 每个风险有源码级分析和2-3个测试节点 |
| 边界/异常 | 8 | 中 | ✅ 覆盖精确边界值和NaN/Infinity |

### 4.3 发现的新问题

| # | 问题 | 严重程度 | 说明 |
|---|------|----------|------|
| 1 | **applyDamage NaN漏洞** | P0 | NaN传入时Math.min(NaN, hp)=NaN, hp-=NaN→hp=NaN。比负伤害更严重 |
| 2 | **calculateDamage NaN属性** | P0 | attack=NaN时整个伤害计算链产生NaN，保底机制minDamage也是NaN |
| 3 | **generalToBattleUnit固定multiplier=1.5** | P2 | 所有武将技能multiplier固定为1.5，无差异化。可能是设计选择而非缺陷 |
| 4 | **inferTroopType属性相等时返回INFANTRY** | P2 | 四维属性完全相等时返回INFANTRY（兜底），但代码中attack==max先判断，实际不会到达INFANTRY |
| 5 | **ExpeditionBattleSystem不使用BattleEngine** | P1 | 远征战斗使用独立的simulateBattle，与BattleEngine.runFullBattle是两套逻辑，结果可能不一致 |
| 6 | **buildAllyTeam不包含装备/羁绊加成** | P1 | generalToBattleUnit仅使用baseStats，未查询EquipmentSystem/BondSystem的加成。装备和羁绊的属性加成可能未传递到战斗 |

---

## 五、R2 Tree挑战评分

| 维度 | 评分 | 说明 |
|------|------|------|
| 完整性 | **8.0/10** | 新增92个节点，覆盖了R1最薄弱的跨系统交互和生命周期维度。但R1 verdict的7项P1要求（序列化、autoFormation链路、模式切换、handler异常、多层Buff、羁绊链路、科技端到端）未补充。 |
| 准确性 | **9.0/10** | P0风险节点包含详细的源码追踪分析，准确识别了2个真实P0缺陷（initBattle null、applyDamage负伤害）。3个P0降级为P1的分析有理有据。 |
| 优先级 | **8.5/10** | 新增节点P0/P1/P2分布合理（32/42/18）。R1的优先级修正（XI-017→P0, quickBattle→P0）已执行。 |
| 可测试性 | **7.5/10** | P0风险节点可直接转化为测试用例。但跨系统节点（联盟buff、羁绊→战斗）缺少具体的测试实现指导（如何mock联盟数据、如何验证羁绊加成传递）。 |
| 新发现价值 | **8.0/10** | 发现了NaN漏洞（比负伤害更严重）、ExpeditionBattleSystem独立逻辑（两套战斗系统不一致风险）、buildAllyTeam不含装备加成（核心经济系统断裂风险） |

| **综合评分** | **8.2/10** | R2在P0风险验证和生命周期覆盖上显著提升，但仍有7项R1要求的P1内容未补充。 |

---

## 六、Round 3 建议（如果需要）

### 必须补充（P0）

| # | 内容 | 预期节点 |
|---|------|----------|
| 1 | 战斗状态序列化/反序列化 | 6 |
| 2 | autoFormation→initBattle→前排承伤验证 | 4 |
| 3 | NaN/Infinity全面防护测试 | 4 |

### 应该补充（P1）

| # | 内容 | 预期节点 |
|---|------|----------|
| 4 | 战斗模式中途切换 | 3 |
| 5 | handler回调异常安全 | 4 |
| 6 | 多层Buff叠加伤害计算 | 4 |
| 7 | 羁绊→编队→战斗属性链路 | 4 |
| 8 | 科技加成端到端应用链路 | 6 |
| 9 | ExpeditionBattleSystem vs BattleEngine结果一致性 | 4 |
| 10 | buildAllyTeam是否包含装备/羁绊加成验证 | 4 |

> **预期Round 3新增节点: ~43个，总节点数达到~487个。**
