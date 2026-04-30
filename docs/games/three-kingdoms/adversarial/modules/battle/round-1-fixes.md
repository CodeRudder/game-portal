# Battle R1 P0 缺陷修复记录

> **修复日期**: 2025-01-21
> **修复范围**: Battle 模块 6 个 P0 级关键缺陷
> **验证状态**: ✅ 805 tests passed (31 files)

---

## 修复清单

### FIX-101: calculateDotDamage NaN 防护
| 属性 | 值 |
|------|------|
| **文件** | `DamageCalculator.ts` |
| **问题** | `calculateDotDamage` 无 NaN 防护，当 `unit.maxHp` 或 `unit.attack` 为 NaN/Infinity 时，NaN 绕过 `> 0` 检查污染伤害链 |
| **修复** | 每个 DOT 类型计算后添加 `Number.isFinite()` 检查，最终返回前再次验证 |

```typescript
// 修复前
totalDot += Math.floor(unit.maxHp * BATTLE_CONFIG.BURN_DAMAGE_RATIO);

// 修复后
let dot = Math.floor(unit.maxHp * BATTLE_CONFIG.BURN_DAMAGE_RATIO);
if (Number.isFinite(dot)) {
  totalDot += dot;
}
// ... 最终防护
return Number.isFinite(totalDot) ? totalDot : 0;
```

---

### FIX-102: getAttackBonus/getDefenseBonus NaN 防护
| 属性 | 值 |
|------|------|
| **文件** | `DamageCalculator.ts` |
| **问题** | `buff.value` 为 NaN 时直接累加到 bonus，导致全伤害链污染（effectiveAttack/effectiveDefense 变为 NaN） |
| **修复** | 累加前对 `buff.value` 添加 `Number.isFinite()` 检查 |

```typescript
// 修复前
bonus += buff.value;

// 修复后
bonus += Number.isFinite(buff.value) ? buff.value : 0;
```

---

### FIX-103: skillMultiplier 负数/NaN/Infinity 防护
| 属性 | 值 |
|------|------|
| **文件** | `DamageCalculator.ts` |
| **问题** | `skillMultiplier` 为负数时伤害变加血；为 NaN/Infinity 时传播到整个伤害计算链 |
| **修复** | 在应用技能倍率前添加早期返回，非有限值或负值直接返回 `damage: 0` |

```typescript
// 修复后
if (!Number.isFinite(skillMultiplier) || skillMultiplier < 0) {
  return {
    damage: 0,
    baseDamage: Math.floor(baseDamage),
    skillMultiplier,
    isCritical: false,
    criticalMultiplier: 1.0,
    restraintMultiplier: 1.0,
    randomFactor: 1.0,
    isMinDamage: false,
  };
}
```

---

### FIX-104: AVAILABLE_SPEEDS 缺少 X4
| 属性 | 值 |
|------|------|
| **文件** | `battle-config.ts` |
| **问题** | `AVAILABLE_SPEEDS = [1, 2, 3]` 但 `BattleSpeed` 枚举有 `X4 = 4`，导致 X4 速度不可选 |
| **修复** | 添加 `4` 到 `AVAILABLE_SPEEDS` 数组 |

```typescript
// 修复前
AVAILABLE_SPEEDS: [1, 2, 3] as const,

// 修复后
AVAILABLE_SPEEDS: [1, 2, 3, 4] as const,
```

---

### FIX-105: 兵种加成负值防护
| 属性 | 值 |
|------|------|
| **文件** | `BattleEffectApplier.ts` |
| **问题** | `getTechTroopAttackBonus` 中 `getEffectValueByTarget(troop) - getTechAttackBonusForAllOnly()` 减法可能返回负值 |
| **修复** | 使用 `Math.max(0, result)` 确保非负 |

```typescript
// 修复前
return this.techEffect.getEffectValueByTarget('troop_attack', troop)
  - this.getTechAttackBonusForAllOnly();

// 修复后
const result = this.techEffect.getEffectValueByTarget('troop_attack', troop)
  - this.getTechAttackBonusForAllOnly();
return Math.max(0, result);
```

---

### FIX-106: Infinity 序列化防护
| 属性 | 值 |
|------|------|
| **文件** | `BattleSpeedController.ts` |
| **问题** | SKIP 模式返回 `animationSpeedScale: Infinity`，JSON 序列化后变为 `null`，反序列化时导致异常 |
| **修复** | 使用有限大值 `9999` 替代 `Infinity` |

```typescript
// 修复前
animationSpeedScale: Infinity,

// 修复后
animationSpeedScale: 9999,
```

---

## 测试更新

以下测试文件因修复而更新断言：

| 文件 | 变更说明 |
|------|----------|
| `BattleSpeedController.test.ts` | cycleSpeed 循环增加 X4；isValidSpeed(4) 改为 true；getAvailableSpeeds 包含 4 |
| `BattleEngine.skip.test.ts` | SKIP 模式 animationSpeedScale 断言从 Infinity 改为 9999；cycleSpeed 循环增加 X4 |

---

## 验证结果

```
✅ npx tsc --noEmit — 编译通过，无类型错误
✅ 31 test files, 805 tests — 全部通过
```
