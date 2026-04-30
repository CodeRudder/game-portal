# Battle 挑战清单 Round 1 — Part A: 核心引擎层

> Challenger: TreeChallenger v1.3 | Time: 2026-05-01
> 范围：BattleEngine.ts, BattleTurnExecutor.ts, DamageCalculator.ts, BattleTargetSelector.ts

---

## BAT-A-001 [P0] DamageCalculator.calculateDotDamage 无NaN防护，NaN可绕过 `dotDamage > 0` 检查

**文件**: `DamageCalculator.ts` 行 390-414  
**模式**: 模式9 — NaN绕过数值检查

**源码**:
```typescript
// 行 390-414
calculateDotDamage(unit: BattleUnit): number {
  let totalDot = 0;
  for (const buff of unit.buffs) {
    switch (buff.type) {
      case BuffType.BURN:
        totalDot += Math.floor(unit.maxHp * BATTLE_CONFIG.BURN_DAMAGE_RATIO);
        break;
      case BuffType.POISON:
        totalDot += Math.floor(unit.maxHp * BATTLE_CONFIG.POISON_DAMAGE_RATIO);
        break;
      case BuffType.BLEED:
        totalDot += Math.floor(unit.attack * BATTLE_CONFIG.BLEED_DAMAGE_RATIO);
        break;
    }
  }
  return totalDot; // 无NaN检查！
}
```

**调用方**（BattleTurnExecutor.ts 行 115-116）:
```typescript
const dotDamage = this.damageCalculator.calculateDotDamage(actor);
if (dotDamage > 0) {  // NaN > 0 === false，绕过！
```

**复现场景**:
1. 创建 BattleUnit，设置 `maxHp = NaN` 或 `attack = NaN`
2. 给单位添加 BURN buff
3. `calculateDotDamage` 返回 `NaN`（`Math.floor(NaN * 0.05)` = `NaN`）
4. `NaN > 0` 为 `false`，DOT伤害被跳过
5. 但如果 `maxHp = undefined`，`Math.floor(undefined * 0.05)` = `NaN`，同样绕过

**影响**: NaN的unit.maxHp或unit.attack导致DOT伤害完全失效，单位不会受到灼烧/中毒/流血伤害

**修复建议**: 在 `calculateDotDamage` 返回前加NaN防护：
```typescript
return Number.isFinite(totalDot) ? totalDot : 0;
```

---

## BAT-A-002 [P0] DamageCalculator.getAttackBonus/getDefenseBonus 无NaN防护，buff.value为NaN时全链污染

**文件**: `DamageCalculator.ts` 行 126-156  
**模式**: 模式2 — 数值溢出/非法值

**源码**:
```typescript
// 行 126-139
export function getAttackBonus(unit: BattleUnit): number {
  let bonus = 0;
  for (const buff of unit.buffs) {
    if (buff.type === BuffType.ATK_UP) {
      bonus += buff.value;  // buff.value 为 NaN → bonus 变 NaN
    } else if (buff.type === BuffType.ATK_DOWN) {
      bonus -= buff.value;
    }
  }
  return bonus; // 可能返回 NaN
}
```

**调用链**:
```
getAttackBonus() → NaN bonus
  → effectiveAttack = attacker.attack * (1 + NaN) = NaN  (行 248)
  → rawDamage = NaN - effectiveDefense = NaN  (行 252)
  → baseDamage = Math.max(1, NaN) = NaN  (行 253)
```

**复现场景**:
1. 给单位添加buff `{ type: BuffType.ATK_UP, value: NaN, remainingTurns: 2 }`
2. `getAttackBonus` 返回 `NaN`
3. `effectiveAttack = attack * (1 + NaN) = NaN`
4. `baseDamage = Math.max(1, NaN) = NaN`（`Math.max(1, NaN)` 返回 `NaN`！）
5. 行 256 的 `Number.isNaN(baseDamage)` 检查会拦截，但返回 `damage: 0`
6. 更严重的是：`getDefenseBonus` 同样的问题，defender的NaN防御加成也会污染

**影响**: 单个NaN buff.value导致所有伤害计算返回0，战斗完全失效

**修复建议**: 在 `getAttackBonus`/`getDefenseBonus` 中对 `buff.value` 做NaN过滤：
```typescript
if (Number.isFinite(buff.value)) {
  bonus += buff.value;
}
```

---

## BAT-A-003 [P0] DamageCalculator.calculateDamage — skillMultiplier为NaN/0/负数时伤害计算异常

**文件**: `DamageCalculator.ts` 行 268  
**模式**: 模式9 — NaN绕过数值检查 + 模式3 — 负值漏洞

**源码**:
```typescript
// 行 268
const damageAfterSkill = baseDamage * skillMultiplier;
```

**分析**:
- `skillMultiplier = NaN`: `baseDamage * NaN = NaN`，虽然行 298 有最终NaN防护返回0，但中间计算链全部污染
- `skillMultiplier = 0`: `baseDamage * 0 = 0`，伤害归零但 `isMinDamage` 可能被触发（取决于 `minDamage`）
- `skillMultiplier = -1`: `baseDamage * -1 = -baseDamage`，负伤害！行 293 的 `finalDamage < minDamage` 为 true（负数 < 正数），最终被设为 `minDamage`（正数），所以不会变成治疗，但伤害被错误地设为最低保底值

**复现场景**:
1. 创建技能 `{ multiplier: -1 }`
2. `damageAfterSkill = baseDamage * (-1)` = 负值
3. `finalDamage = 负值 * 1.5 * 1.0 * 1.0` = 负值
4. `finalDamage < minDamage` → `true`，`finalDamage = minDamage`
5. 虽然不会变成治疗，但负倍率技能被错误地当作最低保底伤害处理

**修复建议**: 在 `calculateDamage` 入口加参数校验：
```typescript
if (!Number.isFinite(skillMultiplier) || skillMultiplier <= 0) {
  skillMultiplier = 1.0; // 降级为普攻
}
```

---

## BAT-A-004 [P0] BattleTurnExecutor.applySkillBuffs 浅拷贝导致buff对象引用共享

**文件**: `BattleTurnExecutor.ts` 行 267-276  
**模式**: 模式4 — 浅拷贝副作用

**源码**:
```typescript
// 行 267-276
private applySkillBuffs(
  actor: BattleUnit,
  targets: BattleUnit[],
  buffs: BuffEffect[],
): void {
  for (const target of targets) {
    if (!target.isAlive) continue;
    for (const buff of buffs) {
      target.buffs.push({
        ...buff,           // 浅拷贝！
        sourceId: actor.id,
      });
    }
  }
}
```

**分析**: `{ ...buff }` 是浅拷贝。如果 `BuffEffect` 未来扩展包含嵌套对象（如 `effectData: { stacks: number }`），多个目标会共享同一个嵌套对象引用，修改一个目标的buff会影响其他目标。

**当前影响**: 当前 `BuffEffect` 类型只有基本类型字段（type, remainingTurns, value, sourceId），所以**当前不会触发实际bug**。但这是一个架构风险。

**降级为 P2**: 当前类型定义下无实际影响，但建议在 BuffEffect 扩展时同步修复。

---

## BAT-A-005 [P1] BattleEngine.serialize 不包含子系统状态（ultimateSystem/speedController）

**文件**: `BattleEngine.ts` 行 446-458  
**模式**: 模式15 — 保存/加载流程缺失子系统

**源码**:
```typescript
// 行 446-458
serialize(state: BattleState): BattleState {
  return structuredClone(state);
}
```

**分析**: `serialize` 只保存了 `BattleState`，不包含：
- `this.battleMode`（当前战斗模式）
- `this.ultimateSystem` 的状态（时停状态、pendingUnitId等）
- `this.speedController` 的状态（速度档位、监听器历史）

**影响**: 断线重连后：
- 战斗模式丢失（半自动变全自动）
- 大招时停状态丢失（正在等待确认的大招被取消）
- 战斗速度丢失（4x变1x）

**修复建议**: 扩展序列化范围：
```typescript
serialize(state: BattleState): BattleState & { meta: { battleMode, ultimateState, speedState } }
```

---

## BAT-A-006 [P1] BattleEngine.deserialize 不恢复子系统状态

**文件**: `BattleEngine.ts` 行 462-483  
**模式**: 模式15 — 保存/加载流程缺失子系统

**分析**: `deserialize` 只恢复 `BattleState`，不恢复 `battleMode`、`ultimateSystem`、`speedController`。与 BAT-A-005 配对。

---

## BAT-A-007 [P1] BattleTurnExecutor.selectSkill 怒气溢出风险 — rageCost > rage 时怒气变负

**文件**: `BattleTurnExecutor.ts` 行 216-230  
**模式**: 模式3 — 负值漏洞

**源码**:
```typescript
// 行 216-230
private selectSkill(actor: BattleUnit): {
  skill: BattleSkill;
  isNormalAttack: boolean;
} {
  if (actor.rage >= BATTLE_CONFIG.MAX_RAGE) {
    for (const skill of actor.skills) {
      if (
        skill.type === 'active' &&
        skill.rageCost > 0 &&
        skill.currentCooldown === 0
      ) {
        actor.rage -= skill.rageCost;  // rageCost可能 > rage（如配置错误）
        return { skill, isNormalAttack: false };
      }
    }
  }
  // ...
}
```

**分析**: 虽然 `actor.rage >= MAX_RAGE(100)` 时才进入分支，但如果 `rageCost` 配置为 150（大于 MAX_RAGE），则 `actor.rage = 100 - 150 = -50`，怒气变负。

**复现场景**:
1. 配置技能 `rageCost = 150`（超过MAX_RAGE）
2. 单位怒气达到100
3. `actor.rage -= 150` → `rage = -50`
4. 负怒气不会自然恢复（每次攻击 `+25`，需要3回合才能回到正数）

**修复建议**: 加下限保护：
```typescript
actor.rage = Math.max(0, actor.rage - skill.rageCost);
```

---

## BAT-A-008 [P2] BattleTargetSelector.selectTargets — SINGLE_ALLY排序后返回的仍是引用

**文件**: `BattleTargetSelector.ts` 行 51-53  
**模式**: 模式4 — 浅拷贝副作用（轻微）

**源码**:
```typescript
case 'SINGLE_ALLY': {
  const allies = getAliveUnits(allyTeam);
  const lowest = allies.sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp);
  return lowest.length > 0 ? [lowest[0]] : [];
}
```

**分析**: `getAliveUnits` 返回 `.filter()` 新数组，`.sort()` 修改的是新数组，不影响原始 `team.units`。但返回的 `lowest[0]` 是原始 `BattleUnit` 的引用，调用方如果修改其属性会影响原始数据。这在战斗系统中是设计意图（需要修改hp等），不构成bug。

**降级为信息性提示**。

---

## BAT-A-009 [P2] BattleEngine.runFullBattle 无限循环防护不足

**文件**: `BattleEngine.ts` 行 222-240  
**模式**: 模式5 — 竞态/状态泄漏

**源码**:
```typescript
// 行 222-240
runFullBattle(allyTeam: BattleTeam, enemyTeam: BattleTeam): BattleResult {
  const state = this.initBattle(allyTeam, enemyTeam);
  while (
    state.phase === BattlePhase.IN_PROGRESS &&
    state.currentTurn <= state.maxTurns
  ) {
    this.executeTurn(state);
    if (this.isBattleOver(state)) break;
    state.currentTurn++;
  }
  // ...
}
```

**分析**: 如果 `executeTurn` 内部异常导致 `state.currentTurn` 未递增（虽然当前代码在循环末尾递增，不太可能），或者 `isBattleOver` 永远返回 `false`（双方都有Infinity HP的单位），循环会持续到 `maxTurns`。`maxTurns = 8`，所以不会真正无限循环，但Infinity HP的单位会导致8回合无意义的计算。

**当前风险**: 低（有maxTurns上限），但建议添加安全计数器。

---

## BAT-A-010 [P1] DamageCalculator.applyDamage — defender.hp 为 NaN 时死亡检查失效

**文件**: `DamageCalculator.ts` 行 355-358  
**模式**: 模式9 — NaN绕过数值检查

**源码**:
```typescript
// 行 355-358
if (defender.hp <= 0) {
  defender.hp = 0;
  defender.isAlive = false;
}
```

**分析**: 如果 `defender.hp` 已经是 `NaN`（由外部设置或之前的NaN传播），则 `NaN <= 0` 为 `false`，单位永远不会被标记为死亡。结合 BAT-A-002，如果攻击加成导致NaN，`applyDamage` 的 `actualDamage = Math.min(remainingDamage, defender.hp)` = `Math.min(x, NaN)` = `NaN`，然后 `defender.hp -= NaN` = `NaN`。

**复现场景**:
1. 单位 `hp = 100`
2. `applyDamage` 被调用，`remainingDamage = 50`
3. `actualDamage = Math.min(50, 100)` = `50`（正常）
4. 但如果之前某次调用导致 `hp` 变为 `NaN`：
   - `actualDamage = Math.min(50, NaN)` = `NaN`
   - `defender.hp -= NaN` → `NaN`
   - `NaN <= 0` → `false` → 单位永远存活

**修复建议**: 在 `applyDamage` 入口加NaN防护：
```typescript
if (!Number.isFinite(defender.hp)) {
  defender.hp = 0;
  defender.isAlive = false;
  return 0;
}
```

---

## 统计

| 级别 | 数量 | ID列表 |
|------|------|--------|
| P0 | 3 | BAT-A-001, BAT-A-002, BAT-A-003 |
| P1 | 3 | BAT-A-005, BAT-A-006, BAT-A-007, BAT-A-010 |
| P2 | 2 | BAT-A-004, BAT-A-008, BAT-A-009 |
