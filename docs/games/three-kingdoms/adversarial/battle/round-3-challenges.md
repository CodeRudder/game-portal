# Round 3 Challenges — P0遗漏审查

> 审查时间：2025-05-02
> 审查角色：Challenger
> 审查范围：R2遗留P0 + R3新增P0，快速验证源码真实性

---

## 审查方法论

1. **源码直接验证**：对每个P0缺陷，直接读取源码确认存在性
2. **调用链追踪**：从入口到缺陷点追踪完整调用路径
3. **修复验证**：检查R2后是否有任何commit修复了已知P0
4. **新缺陷发现**：关注R2未覆盖的代码路径

---

## Challenge 1: initBattle null防护（P0-INIT）

### 源码证据

**文件**: `BattleEngine.ts:104-120`

```typescript
initBattle(allyTeam: BattleTeam, enemyTeam: BattleTeam): BattleState {
    const state = {
      // ... 无任何null检查
      allyTeam,    // 直接赋值
      enemyTeam,   // 直接赋值
    };
    this.turnExecutor.buildTurnOrder(state);  // 立即调用
}
```

**调用链**: `initBattle(null, team)` → `buildTurnOrder(state)` → `getAliveUnits(state.allyTeam)` → `null.units` → **TypeError: Cannot read properties of null**

### 判定：✅ **真实P0，未修复**

---

## Challenge 2: applyDamage负伤害治疗漏洞（P0-DMG）

### 源码证据

**文件**: `DamageCalculator.ts:303-328`

```typescript
applyDamage(defender: BattleUnit, damage: number): number {
    if (!defender.isAlive) return 0;     // 死亡检查 ✓
    // ❌ 无 damage <= 0 检查
    // ❌ 无 NaN 检查

    let remainingDamage = damage;        // damage=-100

    const shieldAmount = getShieldAmount(defender);
    if (shieldAmount > 0 && remainingDamage > 0) {  // -100>0 = false，跳过护盾
      // ...
    }

    const actualDamage = Math.min(remainingDamage, defender.hp);  // Math.min(-100, 500) = -100
    defender.hp -= actualDamage;         // hp -= (-100) → hp = 600 ← 治疗！
    // ...
}
```

### 触发路径

1. **直接调用**: `damageCalculator.applyDamage(unit, -100)` → 治疗100HP
2. **间接路径**: `calculateDamage`中`skillMultiplier`为负数时？
   - `baseDamage = Math.max(1, rawDamage)` → 至少为1
   - `damageAfterSkill = 1 * (-1) = -1`
   - `finalDamage = -1 * crit * restraint * random` → 负数
   - `minDamage = effectiveAttack * 0.1` → 正数
   - `isMinDamage = finalDamage < minDamage` → true
   - `finalDamage = minDamage` → **保底兜住了**
   - **结论**: 通过calculateDamage间接调用时保底机制有效，但直接调用applyDamage传入负数时漏洞存在

### 判定：✅ **真实P0，未修复**（直接调用applyDamage路径）

---

## Challenge 3: NaN全链传播（P0-NaN）

### 源码证据

**文件**: `DamageCalculator.ts:240-280` (calculateDamage)

```typescript
calculateDamage(attacker, defender, skillMultiplier) {
    const effectiveAttack = attacker.attack * (1 + atkBonus);
    // attacker.attack=NaN → effectiveAttack=NaN

    const rawDamage = effectiveAttack - effectiveDefense;
    // NaN - anything = NaN

    const baseDamage = Math.max(1, rawDamage);
    // Math.max(1, NaN) = NaN  ← 关键！Math.max不兜NaN

    const damageAfterSkill = baseDamage * skillMultiplier;
    // NaN * 1.0 = NaN

    let finalDamage = damageAfterSkill * criticalMultiplier * restraintMultiplier * randomFactor;
    // NaN * anything = NaN

    const minDamage = effectiveAttack * BATTLE_CONFIG.MIN_DAMAGE_RATIO;
    // NaN * 0.1 = NaN

    const isMinDamage = finalDamage < minDamage;
    // NaN < NaN = false  ← 保底不触发！

    // finalDamage 仍为 NaN
    return { damage: Math.floor(NaN) };  // NaN
}
```

### NaN进入applyDamage的后果

```typescript
applyDamage(defender, NaN):
    remainingDamage = NaN
    shieldAmount > 0 && NaN > 0  // false，跳过护盾
    actualDamage = Math.min(NaN, 500)  // NaN
    defender.hp -= NaN  // hp = NaN
    defender.hp <= 0  // NaN <= 0 = false → isAlive保持true
    // → NaN单位永远不死，战斗可能无限循环
```

### 但实际上runFullBattle有maxTurns保护

```typescript
// BattleEngine.ts:250
while (state.phase === BattlePhase.IN_PROGRESS && state.currentTurn <= state.maxTurns) {
    this.executeTurn(state);
    if (this.isBattleOver(state)) break;
    state.currentTurn++;
}
```

`isBattleOver`检查`getAliveUnits(state.allyTeam).length === 0`，NaN单位isAlive=true所以不会被判定死亡→战斗不会提前结束→到达maxTurns→DRAW。

### 判定：✅ **真实P0，未修复**（NaN单位不死，但不会无限循环，最终DRAW）

---

## Challenge 4: 装备加成不传递到战斗（NEW-P0-001）

### 源码证据

**文件**: `engine-campaign-deps.ts:127-163`

```typescript
function generalToBattleUnit(g, side, position) {
  // ...
  return {
    attack: g.baseStats.attack,      // ← 只用baseStats
    baseAttack: g.baseStats.attack,
    defense: g.baseStats.defense,    // ← 只用baseStats
    baseDefense: g.baseStats.defense,
    intelligence: g.baseStats.intelligence,
    speed: g.baseStats.speed,
    // ...
  };
}
```

**对比**: `HeroSystem.calculatePower` 使用了 `equipPower` 和 `bondCoeff`：
```typescript
// HeroSystem.ts:186-190
const equipPower = totalEquipmentPower ?? this._getEquipmentPower?.(general.id) ?? 0;
const equipmentCoeff = 1 + equipPower / 1000;
return Math.floor(statsPower * levelCoeff * qualityCoeff * starCoeff * equipmentCoeff * bondCoeff);
```

**结论**: 装备影响战力数字（calculatePower），但不影响战斗属性（generalToBattleUnit）。

### 影响评估

| 场景 | 战力显示 | 实际战斗伤害 | 差异 |
|------|----------|-------------|------|
| 无装备 | 5000 | 基于baseStats | 基准 |
| +100攻击装备 | 5200（+200战力） | **不变**（仍基于baseStats） | **玩家感知欺骗** |

### 判定：✅ **真实P0** — 核心养成线断裂，需确认是否为设计意图

---

## Challenge 5: BattleEngine无序列化能力（NEW-PO-002）

### 源码证据

**文件**: `BattleEngine.ts` 全文搜索

```
serialize: 无匹配
deserialize: 无匹配
toJSON: 无匹配
fromJSON: 无匹配
```

**对比**: 子系统有序列化：
- `BattleSpeedController.serialize/deserialize` ✅
- `UltimateSkillSystem.serialize/deserialize` ✅
- `DamageCalculator` — 无状态，不需要 ✅

**BattleEngine.getState()** 仅返回 `{ battleMode }`，不含BattleState。

### 影响

- 战斗中存档/读档不可用
- 战斗回放不可用
- 断线重连不可用（如果需要）

### 判定：✅ **真实P0** — 但严重程度取决于是否需要存档/回放功能

---

## Challenge 6: autoFormation副作用（NEW-P0-003）

### 源码证据

**文件**: `autoFormation.ts:53-62`

```typescript
const sorted = [...valid].sort(...);  // 浅拷贝数组
sorted.forEach((u, i) => {
    u.position = pos;  // ← 修改了原对象的position属性！
});
```

`[...valid]` 创建了新数组，但数组元素是对象引用。`u.position = pos` 修改了原始BattleUnit对象。

### 影响

```typescript
const units = [{...unit1, position: 'back'}, {...unit2, position: 'back'}];
autoFormation(units);
// units[0].position 现在可能是 'front'！
```

### 判定：✅ **真实P0** — 但影响范围有限（通常autoFormation后直接使用结果）

---

## Challenge 7: quickBattle速度累积（NEW-P0-006）

### 源码证据

**文件**: `BattleEngine.ts:415-417`

```typescript
quickBattle(allyTeam, enemyTeam) {
    const state = this.initBattle(allyTeam, enemyTeam);
    return this.skipBattle(state);
}
```

**skipBattle**: `this.speedController.setSpeed(BattleSpeed.SKIP);` — 设置后不恢复

**quickBattle后**: `speedController.speed = SKIP`

**如果紧接着调用runFullBattle**: runFullBattle不重置speedController → `getAdjustedTurnInterval() = 0`

### 判定：✅ **真实P0** — 但仅影响需要混合使用quickBattle和runFullBattle的场景

---

## Challenge 8: HP=0但isAlive=true（NEW-P0-004）

### 源码证据

**文件**: `engine-campaign-deps.ts:155-163`

```typescript
function generalToBattleUnit(g, ...) {
  return {
    hp: maxHp,          // 正常情况hp>0
    isAlive: true,
  };
}
```

initBattle不校验hp>0。如果外部构造了hp=0, isAlive=true的BattleUnit：

```typescript
getAliveUnits: return team.units.filter(u => u.isAlive);  // 只检查isAlive
```

→ HP=0单位仍参与战斗，但applyDamage中`Math.min(damage, 0) = 0`→不受伤→永远不死。

### 判定：⚠️ **降级为P1** — 正常路径不会产生hp=0的单位，仅异常数据路径

---

## 审查总结

| Challenge | 描述 | 真实性 | 严重程度 | 修复难度 |
|-----------|------|--------|----------|----------|
| C1 | initBattle null防护 | ✅真实 | P0 | 低 |
| C2 | applyDamage负伤害 | ✅真实 | P0 | 低 |
| C3 | NaN全链传播 | ✅真实 | P0 | 中 |
| C4 | 装备加成不传递 | ✅真实 | P0(需确认设计意图) | 中 |
| C5 | BattleEngine无序列化 | ✅真实 | P0(功能缺失) | 高 |
| C6 | autoFormation副作用 | ✅真实 | P0(影响有限) | 低 |
| C7 | quickBattle速度累积 | ✅真实 | P0 | 低 |
| C8 | HP=0但isAlive=true | ✅真实 | P1(降级) | 低 |

### R3确认的P0缺陷总数：**7个**（C8降级为P1）

### R2的3个P0修复状态：**全部未修复**

### 封版风险评估

**封版条件达成情况**：
1. ❌ NaN防护 — 未修复
2. ❌ 序列化 — 未实现
3. ⚠️ autoFormation链路 — 节点已补充，但副作用未修复
4. ❌ 装备加成 — 确认缺失，未修复
5. ❌ 2个真实P0修复 — 0/2已修复

**封版判定：不满足封版条件**
