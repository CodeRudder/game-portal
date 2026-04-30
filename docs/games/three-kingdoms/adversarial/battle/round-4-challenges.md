# Round 4 Challenges — 最终P0遗漏审查

> 审查时间：2025-05-02
> 审查角色：Challenger（R4封版轮）
> 审查目标：确认7个已知P0真实性，扫描遗漏P0，评估封版可行性

---

## 审查方法论

R4作为封版轮，采用**极简审查**策略：
1. 对7个已知P0做最终源码确认（不重复R3的详细追踪）
2. 仅关注**是否有未发现的P0**（不关注P1/P2）
3. 对BattleEngine 25个公共API逐一检查异常路径

---

## Part A: 7个已知P0最终确认

### P0-1: initBattle null guard缺失

**源码确认**（BattleEngine.ts:104-120）：

```typescript
initBattle(allyTeam: BattleTeam, enemyTeam: BattleTeam): BattleState {
    const state = {
      // 无null检查
      allyTeam,    // 直接赋值
      enemyTeam,   // 直接赋值
    };
    this.turnExecutor.buildTurnOrder(state);
```

- `initBattle(null, team)` → `getAliveUnits(null)` → `null.units` → **TypeError**
- **R4状态：未修复** ✅ 真实P0

### P0-2: applyDamage负伤害治疗漏洞

**源码确认**（DamageCalculator.ts:303-328）：

```typescript
applyDamage(defender: BattleUnit, damage: number): number {
    if (!defender.isAlive) return 0;
    // ❌ 无 damage <= 0 检查
    let remainingDamage = damage;  // damage = -100
    // shield: -100 > 0 = false，跳过
    const actualDamage = Math.min(-100, 500);  // = -100
    defender.hp -= (-100);  // hp += 100 → 治疗！
```

- **R4状态：未修复** ✅ 真实P0

### P0-3: applyDamage NaN漏洞

**源码确认**（DamageCalculator.ts:240-280）：

```typescript
const baseDamage = Math.max(1, NaN);  // = NaN（Math.max不兜NaN）
// ... 全链NaN传播
applyDamage: Math.min(NaN, hp) = NaN → hp = NaN → NaN <= 0 = false → 不死
```

- **R4状态：未修复** ✅ 真实P0

### P0-4: 装备加成不传递到战斗

**源码确认**（engine-campaign-deps.ts:160-175）：

```typescript
attack: g.baseStats.attack,      // 只用baseStats
defense: g.baseStats.defense,    // 只用baseStats
```

- HeroSystem.calculatePower使用equipPower，但generalToBattleUnit不用
- **R4状态：未修复** ✅ 真实P0（需产品确认是否设计意图）

### P0-5: BattleEngine无序列化能力

**源码确认**（BattleEngine.ts全文）：
- 无serialize/deserialize/toJSON方法
- getState()仅返回`{battleMode}`
- 子系统（SpeedController、UltimateSkillSystem）有serialize/deserialize
- **R4状态：未修复** ✅ 真实P0

### P0-6: autoFormation修改原对象position

**源码确认**（autoFormation.ts:53-62）：

```typescript
const sorted = [...valid].sort(...);  // 浅拷贝数组
sorted.forEach((u, i) => {
    u.position = pos;  // 修改原对象属性
});
```

- `[...valid]`只拷贝数组引用，不拷贝对象
- **R4状态：未修复** ✅ 真实P0

### P0-7: quickBattle后speedController累积SKIP

**源码确认**（BattleEngine.ts:415-417）：

```typescript
quickBattle(allyTeam, enemyTeam) {
    const state = this.initBattle(allyTeam, enemyTeam);
    return this.skipBattle(state);  // skipBattle设置speed=SKIP，不恢复
}
```

- skipBattle: `this.speedController.setSpeed(BattleSpeed.SKIP)` — 不恢复
- quickBattle不调用reset()
- 后续runFullBattle使用累积的SKIP速度
- **R4状态：未修复** ✅ 真实P0

### P0确认总结

| # | P0 | 真实性 | 修复难度 | 可修复性 |
|---|-----|--------|----------|----------|
| 1 | initBattle null guard | ✅真实 | 低(0.5h) | ✅可修复 |
| 2 | applyDamage负伤害 | ✅真实 | 低(0.5h) | ✅可修复 |
| 3 | applyDamage NaN | ✅真实 | 中(2h) | ✅可修复 |
| 4 | 装备加成不传递 | ✅真实 | 中(4h) | ✅可修复 |
| 5 | BattleEngine序列化 | ✅真实 | 高(8h) | ✅可修复 |
| 6 | autoFormation副作用 | ✅真实 | 低(0.5h) | ✅可修复 |
| 7 | quickBattle SKIP累积 | ✅真实 | 低(0.5h) | ✅可修复 |

**7/7 P0全部真实，全部可修复。**

---

## Part B: 遗漏P0扫描

### 扫描范围

| 文件 | 行数 | 扫描状态 |
|------|------|----------|
| BattleEngine.ts | 495 | ✅ 完整扫描 |
| DamageCalculator.ts | 391 | ✅ 完整扫描 |
| BattleTurnExecutor.ts | 355 | ✅ 完整扫描 |
| autoFormation.ts | 76 | ✅ 完整扫描 |
| BattleSpeedController.ts | 329 | ✅ 完整扫描 |
| UltimateSkillSystem.ts | 439 | ✅ 完整扫描 |
| battle-helpers.ts | ~100 | ✅ 完整扫描 |
| battle-config.ts | ~95 | ✅ 完整扫描 |
| battle.types.ts | ~310 | ✅ 完整扫描 |
| BattleStatistics.ts | ~180 | ✅ 完整扫描 |
| BattleFragmentRewards.ts | ~95 | ✅ 完整扫描 |
| engine-campaign-deps.ts | ~200 | ✅ 完整扫描 |

### 扫描结果

#### 潜在风险点（已评估，不构成新P0）

| # | 风险点 | 评估 | 结论 |
|---|--------|------|------|
| S1 | `calculateBattleStats`中NaN damage累积 | NaN damage进入actionLog后，统计中`allyTotalDamage += NaN` → 统计全NaN | **P1**（NaN根源在P0-3，修复P0-3后此问题消失） |
| S2 | `simpleHash`对空字符串返回0 | `simpleHash("") = 0`，`0 % 100 = 0 < 10` → 空ID必掉碎片 | **P2**（正常路径不会产生空ID单位） |
| S3 | `BattleSpeedController`的changeHistory无限增长 | 每次setSpeed追加事件，无上限 | **P2**（战斗生命周期内事件数有限） |
| S4 | `getAliveUnits`对空team崩溃 | `team.units.filter(...)` — 如果team.units是undefined则崩溃 | **P1**（与P0-1同源，initBattle null guard修复后覆盖） |
| S5 | `generateBattleId`使用Date.now+random，非严格唯一 | 极端并发下可能碰撞 | **P3**（单线程环境下概率极低） |

#### 结论：**无新P0发现**

所有扫描到的风险点要么是已知P0的衍生问题（S1、S4），要么是低概率/低影响场景（S2、S3、S5）。

---

## Part C: 封版可行性评估

### 封版标准对照

| 标准 | 要求 | 状态 | 说明 |
|------|------|------|------|
| 测试树覆盖所有已知P0 | 7/7 | ✅ **达标** | 每个P0至少2个测试节点 |
| API覆盖率≥90% | 98.9% | ✅ **达标** | 86/87 API覆盖 |
| 无新P0遗漏 | 0新发现 | ✅ **达标** | 全源码扫描无新P0 |
| 跨系统交互覆盖 | 8/8关键交互 | ✅ **达标** | 全部覆盖 |
| P0修复验证节点 | 12个回归节点 | ✅ **达标** | 为修复后回归准备 |

### 封版风险评估

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| 修复P0引入新缺陷 | 中 | 中 | 12个回归测试节点覆盖 |
| 装备加成为设计意图 | 低 | 高 | EQ-IMP-004已标记需产品确认 |
| 序列化需求变更 | 低 | 中 | SER-001~010覆盖多种场景 |
| 遗漏的边界P0 | 低 | 中 | 全源码扫描+API 98.9%覆盖 |

### Challenger最终意见

**建议封版。** 理由：

1. 7个P0全部有对应测试节点，覆盖充分
2. 全源码扫描未发现新P0
3. API覆盖率98.9%，远超90%封版线
4. 12个回归测试节点为修复后验证提供保障
5. 测试树540节点已趋近饱和，继续迭代收益递减

**注意**：封版不等于P0已修复。7个P0仍需开发团队按优先级修复。封版意味着对抗测试阶段完成，测试资产可交付。
