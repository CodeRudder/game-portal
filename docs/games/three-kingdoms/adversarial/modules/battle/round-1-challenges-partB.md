# Battle 挑战清单 Round 1 — Part B: 效果+大招层

> Challenger: TreeChallenger v1.3 | Time: 2026-05-01
> 范围：BattleEffectApplier.ts, BattleEffectManager.ts, UltimateSkillSystem.ts, BattleSpeedController.ts

---

## BAT-B-001 [P0] 配置不一致 — AVAILABLE_SPEEDS 缺少 X4 档位，但代码多处引用 BattleSpeed.X4

**文件**: `battle-config.ts` 行 83 vs `battle-ultimate.types.ts` 行 106  
**模式**: 模式10 — 配置交叉不一致

**源码对比**:
```typescript
// battle-config.ts 行 83
AVAILABLE_SPEEDS: [1, 2, 3] as const,  // 只有 1, 2, 3（对应 X1, X2, X3）

// battle-ultimate.types.ts 行 103-107
export enum BattleSpeed {
  SKIP = 0,
  X1 = 1,
  X2 = 2,
  X3 = 3,
  X4 = 4,   // X4 = 4 存在于枚举中
}
```

**受影响的代码**:
1. `BattleSpeedController.cycleSpeed()` 行 160: 循环只遍历 `[1, 2, 3]`，永远无法切换到 X4
2. `BattleSpeedController.createSpeedState()` 行 310: `speed >= BattleSpeed.X4` 检查 X4，但 `setSpeed(X4)` 的 `isValidSpeed` 检查 `AVAILABLE_SPEEDS.includes(speed)` → `[1,2,3].includes(4)` = `false` → X4 档位无法设置
3. `BattleEffectManager.ts` 行 162, 197: `this.battleSpeed === BattleSpeed.X4` 永远不会为 true（因为无法设置X4）
4. `battle-config.ts` 行 85: `SIMPLIFY_EFFECTS_AT_X4: true` 配置项存在但永远不生效

**复现场景**:
1. 调用 `controller.setSpeed(BattleSpeed.X4)` → `isValidSpeed(4)` → `[1,2,3].includes(4)` = `false` → 返回 `false`
2. 调用 `controller.cycleSpeed()` → 只在 `[1, 2, 3]` 间循环
3. 4x 简化特效功能完全不可用

**影响**: 
- X4 速度档位完全不可用（枚举定义了但配置不支持）
- 注释中说"4倍速"但实际只有3倍速
- `SIMPLIFY_EFFECTS_AT_X4` 配置项无效
- 测试中 `setSpeed(BattleSpeed.X4)` 的调用实际上会被静默拒绝

**修复建议**: 二选一：
1. 在 `AVAILABLE_SPEEDS` 中添加 `4`：`[1, 2, 3, 4] as const`
2. 或者移除 `BattleSpeed.X4` 枚举值和所有 X4 相关代码

---

## BAT-B-002 [P0] BattleEffectApplier.getTechTroopAttackBonus — 兵种加成可能返回负值

**文件**: `BattleEffectApplier.ts` 行 357-361  
**模式**: 模式3 — 负值漏洞

**源码**:
```typescript
// 行 357-361
private getTechTroopAttackBonus(troop: string): number {
  if (!this.techEffect) return 0;
  return this.techEffect.getEffectValueByTarget('troop_attack' as const, troop)
    - this.getTechAttackBonusForAllOnly();  // 可能返回负值！
}
```

**分析**: `getEffectValueByTarget('troop_attack', troop)` 返回的是该兵种的**总**攻击加成（包含 `all` 的部分）。减去 `getTechAttackBonusForAllOnly()` 后，意图是得到"仅兵种专属"的部分。但如果 `getEffectValueByTarget` 的实现中，`troop` 的效果值小于 `all` 的效果值（例如科技配置异常），结果为负。

**复现场景**:
1. 配置 `all` 攻击加成 = 20%
2. 配置 `cavalry` 攻击加成 = 10%（配置错误，比 all 还小）
3. `getTechTroopAttackBonus('cavalry')` = `10 - 20` = `-10`
4. 在 `getEnhancedStats` 中：`attackBonusPercent = 20 + (-10) = 10`（看起来还好）
5. 但 `enhancedAttack = Math.floor(unit.baseAttack * (1 + 10/100))` = 正常值

**实际影响**: 当 `getEffectValueByTarget(troop)` 返回值小于 `getEffectValueByTarget('all')` 时，兵种专属加成变负，但因为有 `all` 加成兜底，最终结果可能不会变成负攻击力。但如果 `all` 加成为0，兵种专属为负，则攻击力会降低。

**修复建议**: 加下限保护：
```typescript
return Math.max(0, this.techEffect.getEffectValueByTarget(...) - this.getTechAttackBonusForAllOnly());
```

---

## BAT-B-003 [P0] BattleSpeedController.createSpeedState — SKIP 模式返回 Infinity 动画速度

**文件**: `BattleSpeedController.ts` 行 295-300  
**模式**: 模式2 — 数值溢出/非法值

**源码**:
```typescript
// 行 295-300
if (speed === BattleSpeed.SKIP) {
  return {
    speed: BattleSpeed.SKIP,
    turnIntervalScale: 0,
    animationSpeedScale: Infinity,   // Infinity!
    simplifiedEffects: true,
  };
}
```

**分析**: `animationSpeedScale: Infinity` 会被 `getAnimationSpeedScale()` 返回。如果渲染层使用此值做乘法（如 `animation.duration / scale`），则 `duration / Infinity = 0`，动画时长为0（这是期望行为）。但如果渲染层做加法（如 `baseInterval + scale`），则结果为 `Infinity`。

**影响**: 
- `getAnimationSpeedScale()` 返回 `Infinity`
- `BattleSpeedState` 的 `animationSpeedScale` 字段为 `Infinity`
- 如果此值被序列化（`serialize()`），`JSON.stringify` 会将其转为 `null`，反序列化后为 `null` 而非 `Infinity`
- `Infinity` 传播到渲染层可能导致意外行为

**修复建议**: 使用一个大的有限值替代 `Infinity`：
```typescript
animationSpeedScale: 999, // 足够大的有限值
```
或确保渲染层正确处理 `Infinity`。

---

## BAT-B-004 [P1] BattleEffectManager.effectIdCounter 模块级全局变量 — 跨实例共享且永不重置

**文件**: `BattleEffectManager.ts` 行 100  
**模式**: 模式5 — 竞态/状态泄漏

**源码**:
```typescript
// 行 100（模块顶层）
let effectIdCounter = 0;
```

**分析**: 
1. `effectIdCounter` 是模块级变量，所有 `BattleEffectManager` 实例共享
2. `reset()` 方法（行 239-242）不重置此计数器
3. 长时间运行后，计数器可能溢出（虽然 JS 的 number 安全整数范围很大，但 `fx_${++effectIdCounter}` 的字符串会越来越长）
4. 如果在多个战斗场景间复用，ID不会从0开始

**影响**: 低风险，但违反了"每个实例独立"的设计原则

**修复建议**: 将计数器移入实例：
```typescript
private effectIdCounter = 0;
```

---

## BAT-B-005 [P1] UltimateSkillSystem.startTimeout 使用 setTimeout — 在测试/SSR环境中可能不可用

**文件**: `UltimateSkillSystem.ts` 行 316-323  
**模式**: 模式5 — 竞态/状态泄漏

**源码**:
```typescript
// 行 316-323
private startTimeout(unit: BattleUnit, skill: BattleSkill): void {
  this.clearTimeout();
  this.timeoutId = setTimeout(() => {
    if (this.state === TimeStopState.PAUSED) {
      this.confirmUltimateWithInfo(unit, skill);
    }
  }, BATTLE_CONFIG.TIME_STOP_TIMEOUT_MS);
}
```

**分析**:
1. `setTimeout` 的回调持有 `unit` 和 `skill` 的引用，阻止GC回收
2. 如果 `reset()` 被调用但 `clearTimeout` 未执行（虽然当前代码在 `reset` 中调用了 `clearTimeout`），定时器回调可能在战斗结束后触发
3. 在 SSR/Node.js 测试环境中，`setTimeout` 的行为可能与浏览器不同

**当前风险**: 低（`reset()` 正确调用了 `clearTimeout()`），但 `confirmUltimateWithInfo` 中的 `unit` 和 `skill` 引用会在 30 秒内保持存活。

---

## BAT-B-006 [P1] BattleEffectApplier.enhanceDamageResult — result.damage 为 NaN 时 enhancedDamage 也为 NaN

**文件**: `BattleEffectApplier.ts` 行 275-285  
**模式**: 模式2 — 数值溢出/非法值

**源码**:
```typescript
// 行 275-285
enhanceDamageResult(result: DamageResult, attacker: BattleUnit): EnhancedDamageResult {
  const target = TROOP_TYPE_TARGET_MAP.get(attacker.troopType) ?? 'all';
  const techAttackBonus = this.getTechAttackBonus(target);
  const techDefenseBonus = 0;
  const techDamageBonus = 0;
  const techMultiplier = 1 + techAttackBonus / 100;
  const enhancedDamage = Math.floor(result.damage * techMultiplier);
  // ...
}
```

**分析**: 如果上游（DamageCalculator）返回的 `result.damage` 为 `NaN`（虽然 DEF-006 做了防护，但 `enhanceDamageResult` 是独立入口），`NaN * techMultiplier = NaN`，`Math.floor(NaN) = NaN`。

**影响**: 如果 `enhanceDamageResult` 被直接调用（绕过 DamageCalculator 的NaN防护），NaN会传播到 `enhancedDamage`。

**修复建议**: 在入口加NaN防护：
```typescript
const baseDamage = Number.isFinite(result.damage) ? result.damage : 0;
const enhancedDamage = Math.floor(baseDamage * techMultiplier);
```

---

## BAT-B-007 [P1] BattleSpeedController.changeHistory 无上限 — 长时间战斗中内存持续增长

**文件**: `BattleSpeedController.ts` 行 119  
**模式**: 模式14 — 资源溢出无上限

**源码**:
```typescript
// 行 119
this.changeHistory.push(event);
```

**分析**: 每次速度变更都 push 到 `changeHistory`，`reset()` 会清空，但如果在长时间运行的战斗中频繁切换速度（如玩家反复点击加速按钮），`changeHistory` 会持续增长。

**影响**: 低风险（速度变更频率有限），但建议添加上限。

**修复建议**: 限制历史记录长度：
```typescript
if (this.changeHistory.length > 100) this.changeHistory.shift();
this.changeHistory.push(event);
```

---

## BAT-B-008 [P2] BattleEffectApplier.getEnhancedStats — baseAttack/baseDefense 为0时 enhancedAttack 为0

**文件**: `BattleEffectApplier.ts` 行 216-234  
**模式**: 模式2 — 数值溢出/非法值（轻微）

**分析**: `enhancedAttack = Math.floor(unit.baseAttack * (1 + attackBonusPercent / 100))`。如果 `baseAttack = 0`，无论加成多高，`enhancedAttack = 0`。这是数学正确的行为，但可能导致玩家困惑（升级了科技但伤害不变，因为基础攻击为0）。

**降级为 P2**: 这是设计层面的问题，不是bug。

---

## 统计

| 级别 | 数量 | ID列表 |
|------|------|--------|
| P0 | 3 | BAT-B-001, BAT-B-002, BAT-B-003 |
| P1 | 4 | BAT-B-004, BAT-B-005, BAT-B-006, BAT-B-007 |
| P2 | 1 | BAT-B-008 |
