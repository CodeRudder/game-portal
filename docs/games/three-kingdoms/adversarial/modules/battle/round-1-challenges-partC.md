# Battle 挑战清单 Round 1 — Part C: 辅助层

> Challenger: TreeChallenger v1.3 | Time: 2026-05-01
> 范围：BattleStatistics.ts, BattleFragmentRewards.ts, battle-helpers.ts, autoFormation.ts

---

## BAT-C-001 [P1] BattleStatistics.calculateBattleStats — damage 值为 NaN 时统计全链污染

**文件**: `BattleStatistics.ts` 行 97-115  
**模式**: 模式2 — 数值溢出/非法值

**源码**:
```typescript
// 行 97-115
export function calculateBattleStats(state: BattleState): BattleStats {
  let allyTotalDamage = 0;
  let enemyTotalDamage = 0;
  let maxSingleDamage = 0;
  // ...
  for (const action of state.actionLog) {
    const isAlly = action.actorSide === 'ally';
    for (const [, result] of Object.entries(action.damageResults)) {
      if (isAlly) {
        allyTotalDamage += result.damage;  // NaN 累加
      } else {
        enemyTotalDamage += result.damage;
      }
      maxSingleDamage = Math.max(maxSingleDamage, result.damage);
      // ...
    }
  }
  return { allyTotalDamage, enemyTotalDamage, maxSingleDamage, maxCombo };
}
```

**分析**: 如果 `result.damage` 为 `NaN`（上游 DamageCalculator 的NaN虽然被防护，但如果 actionLog 中有历史脏数据）：
- `allyTotalDamage += NaN` → `NaN`
- `Math.max(0, NaN)` → `NaN`（`Math.max` 遇到NaN返回NaN）
- 整个 `BattleStats` 对象被NaN污染

**影响**: 统计面板显示 NaN，战斗摘要可能异常

**修复建议**: 在累加前过滤NaN：
```typescript
const dmg = Number.isFinite(result.damage) ? result.damage : 0;
allyTotalDamage += dmg;
```

---

## BAT-C-002 [P1] BattleFragmentRewards.simpleHash — 空字符串输入返回0，可能导致确定性掉落偏差

**文件**: `BattleFragmentRewards.ts` 行 81-90  
**模式**: 模式11 — 算法正确性缺陷

**源码**:
```typescript
// 行 81-90
export function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}
```

**分析**:
1. 空字符串 `""` → `hash = 0` → `Math.abs(0)` = `0`
2. `0 % 100 = 0`，`0 < 10` → 永远掉落
3. 如果有多个敌方单位的 `id` 为空字符串，它们都会100%掉落碎片（而非10%）

**复现场景**:
1. 创建敌方单位 `{ id: "" }`
2. `simpleHash("")` = `0`
3. `0 % 100 = 0 < 10` → 必定掉落碎片
4. 违反 PRD v3.0 §4.3a 的"基础掉率10%"规则

**影响**: 空 ID 的敌方单位100%掉落碎片，违反掉率设计

**修复建议**: 空字符串特殊处理：
```typescript
if (!str || str.length === 0) return 1; // 避免hash=0
```

---

## BAT-C-003 [P1] BattleFragmentRewards.calculateFragmentRewards — enemyTeam.units 中重复ID导致碎片叠加

**文件**: `BattleFragmentRewards.ts` 行 50-58  
**模式**: 模式14 — 资源溢出无上限

**源码**:
```typescript
// 行 50-58（首通路径）
if (isFirstClear) {
  for (const unit of enemyTeam.units) {
    fragments[unit.id] = (fragments[unit.id] ?? 0) + 1;
  }
  return fragments;
}
```

**分析**: 如果 `enemyTeam.units` 中有多个单位使用相同的 `id`（如配置错误或模板复用），碎片会叠加。例如 6 个相同 ID 的单位 → 首通掉落 6 个碎片。

**影响**: 配置错误时碎片奖励可能超出预期

**修复建议**: 去重后再计算：
```typescript
const uniqueIds = new Set(enemyTeam.units.map(u => u.id));
for (const id of uniqueIds) {
  fragments[id] = (fragments[id] ?? 0) + 1;
}
```

---

## BAT-C-004 [P2] autoFormation — 浅拷贝只拷贝一层，嵌套属性（skills, buffs）仍为引用

**文件**: `autoFormation.ts` 行 63  
**模式**: 模式4 — 浅拷贝副作用

**源码**:
```typescript
// 行 63
const sorted = [...valid].map(u => ({ ...u })).sort((a, b) => {
```

**分析**: `{ ...u }` 是浅拷贝，`u.skills`、`u.buffs`、`u.normalAttack` 仍然是原始对象的引用。如果后续代码修改了 `sorted` 中单位的 `skills` 或 `buffs`，会影响原始单位数据。

**当前影响**: `autoFormation` 只修改 `position`（基本类型），不修改嵌套属性，所以**当前不会触发bug**。但如果调用方后续通过返回的 `team.units` 修改了 `skills` 或 `buffs`，会影响原始数据。

**修复建议**: 使用深拷贝：
```typescript
const sorted = [...valid].map(u => structuredClone(u)).sort(...)
```
或在使用文档中明确说明返回值与输入共享嵌套引用。

---

## BAT-C-005 [P2] autoFormation — score 计算中 defense/attack 为 NaN 时 score 为 NaN

**文件**: `autoFormation.ts` 行 76-77  
**模式**: 模式2 — 数值溢出/非法值

**源码**:
```typescript
// 行 76-77
const frontDef = sorted.slice(0, frontCount).reduce((s, u) => s + u.defense, 0);
const backAtk = sorted.slice(frontCount).reduce((s, u) => s + u.attack, 0);
const score = Math.min(100, Math.round((frontDef * 0.5 + backAtk * 0.5) / valid.length));
```

**分析**: 如果任何单位的 `defense` 或 `attack` 为 `NaN`，`reduce` 累加结果为 `NaN`，`score` 为 `NaN`。`Math.min(100, NaN)` = `NaN`。

**影响**: 布阵评分为 NaN，UI 显示异常

**修复建议**: 在 reduce 中过滤 NaN：
```typescript
const frontDef = sorted.slice(0, frontCount).reduce((s, u) => s + (u.defense || 0), 0);
```

---

## BAT-C-006 [P2] battle-helpers.sortBySpeed — speed 为 NaN 时排序不稳定

**文件**: `battle-helpers.ts` 行 38-42  
**模式**: 模式2 — 数值溢出/非法值

**源码**:
```typescript
// 行 38-42
export function sortBySpeed(units: BattleUnit[]): BattleUnit[] {
  return [...units].sort((a, b) => {
    if (b.speed !== a.speed) return b.speed - a.speed;
    return a.id.localeCompare(b.id);
  });
}
```

**分析**: 如果 `a.speed = NaN`，`b.speed = 100`：
- `NaN !== 100` → `true`
- `100 - NaN` = `NaN`
- `sort` 比较器返回 `NaN` 时，排序行为未定义（取决于引擎实现）

**影响**: 行动顺序不确定，可能导致战斗结果不可预测

**修复建议**: 将 NaN speed 降级为 0：
```typescript
const sa = Number.isFinite(a.speed) ? a.speed : 0;
const sb = Number.isFinite(b.speed) ? b.speed : 0;
if (sb !== sa) return sb - sa;
```

---

## BAT-C-007 [P1] generateSummary — StarRating 为 NaN 时 '★'.repeat(NaN) 返回空字符串

**文件**: `BattleStatistics.ts` 行 143-152  
**模式**: 模式2 — 数值溢出/非法值

**源码**:
```typescript
// 行 143-152
export function generateSummary(
  outcome: BattleOutcome, stars: StarRating, turns: number, allyAlive: number,
): string {
  if (outcome === BattleOutcome.VICTORY) {
    const starStr = '★'.repeat(stars) + '☆'.repeat(3 - stars);
    // ...
  }
}
```

**分析**: 如果 `stars` 为 `NaN`（虽然上游 `calculateStars` 不会返回 NaN，但 `generateSummary` 是公开函数）：
- `'★'.repeat(NaN)` = `''`（空字符串）
- `'☆'.repeat(3 - NaN)` = `'☆'.repeat(NaN)` = `''`
- `starStr` 为空字符串，显示为"战斗胜利！，用时X回合"

**影响**: 低风险（上游防护较好），但作为公开函数应做参数校验

---

## 统计

| 级别 | 数量 | ID列表 |
|------|------|--------|
| P0 | 0 | — |
| P1 | 4 | BAT-C-001, BAT-C-002, BAT-C-003, BAT-C-007 |
| P2 | 3 | BAT-C-004, BAT-C-005, BAT-C-006 |
