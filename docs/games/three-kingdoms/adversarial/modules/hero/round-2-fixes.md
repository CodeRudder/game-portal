# Round 2 P0 缺陷修复记录

> 修复时间：2025-01-XX
> 修复范围：Hero 模块 R2 裁决中的 P0 缺陷

## 修复清单总览

| FIX ID | 优先级 | 状态 | 说明 |
|--------|--------|------|------|
| FIX-201 | P0 | ✅ 已验证 | setBondMultiplierGetter/setEquipmentPowerGetter 集成 |
| FIX-202 | P0 | ✅ 已验证 | getStarMultiplier NaN 防护 + cloneGeneral null guard |
| FIX-203 | P0 | ✅ 已验证 | calculatePower NaN 最终输出防护 |
| FIX-204 | P0 | ✅ 已验证 | 碎片溢出上限处理 |

---

## FIX-201: setBondMultiplierGetter/setEquipmentPowerGetter 集成缺失

### 问题描述
羁绊系数永远 1.0，装备战力永远为 0。`setBondMultiplierGetter` 和 `setEquipmentPowerGetter` 虽然在 `HeroSystem` 中定义，但从未在引擎初始化时被调用。

### 修复方案
在 `engine-hero-deps.ts` 的 `initHeroSystems()` 中添加集成调用：

1. **羁绊系数注入**（L123）：
   ```typescript
   if (systems.bondSystem) {
     systems.hero.setBondMultiplierGetter((generalIds: string[]) =>
       systems.bondSystem!.getBondMultiplier(generalIds),
     );
   }
   ```

2. **装备战力注入**（L131）：
   ```typescript
   if (systems.equipmentSystem) {
     systems.hero.setEquipmentPowerGetter((generalId: string) => {
       const equips = systems.equipmentSystem!.getHeroEquipments(generalId);
       let total = 0;
       for (const eq of equips) {
         total += systems.equipmentSystem!.calculatePower(eq);
       }
       return total;
     });
   }
   ```

3. **calculatePower 装备战力 fallback 链**（HeroSystem.ts L190）：
   ```typescript
   const equipPower = totalEquipmentPower ?? this._getEquipmentPower?.(general.id) ?? 0;
   ```

4. **calculateFormationPower 羁绊系数 fallback 链**（HeroSystem.ts L229）：
   ```typescript
   const bondCoeff = bondMultiplier ?? this._getBondMultiplier?.(generalIds) ?? 1.0;
   ```

### 涉及文件
- `src/games/three-kingdoms/engine/engine-hero-deps.ts` — 集成调用
- `src/games/three-kingdoms/engine/hero/HeroSystem.ts` — fallback 链

---

## FIX-202: getStarMultiplier NaN 防护 + cloneGeneral null guard

### 问题描述
1. `getStarMultiplier(NaN)` 导致 `STAR_MULTIPLIERS[NaN]` = `undefined`，战力公式结果为 NaN
2. `cloneGeneral(null)` 导致 `null.skills.map()` 崩溃
3. `deserializeHeroState` 中 null/undefined 武将数据导致崩溃

### 修复方案

**getStarMultiplier**（`star-up-config.ts` L60-63）：
```typescript
export function getStarMultiplier(star: number): number {
  // R2-FIX-P02: NaN/非有限值防护
  if (!Number.isFinite(star) || star < 0) return 1;
  if (star < 1) return STAR_MULTIPLIERS[0];
  if (star >= STAR_MULTIPLIERS.length) return STAR_MULTIPLIERS[STAR_MULTIPLIERS.length - 1];
  return STAR_MULTIPLIERS[star];
}
```

**cloneGeneral**（`HeroSerializer.ts` L33）：
```typescript
export function cloneGeneral(g: GeneralData): GeneralData {
  // R2-FIX-P02: null/undefined 防护
  if (!g) return null as unknown as GeneralData;
  return { ...g, baseStats: { ...g.baseStats }, skills: g.skills.map((s) => ({ ...s })) };
}
```

**deserializeHeroState**（`HeroSerializer.ts` L91-92）：
```typescript
// R2-FIX-P02: 跳过 null/undefined 武将数据
if (g) generals[id] = cloneGeneral(g);
```

### 涉及文件
- `src/games/three-kingdoms/engine/hero/star-up-config.ts`
- `src/games/three-kingdoms/engine/hero/HeroSerializer.ts`

---

## FIX-203: calculatePower NaN 最终输出防护

### 问题描述
即使各子系数有 NaN 防护，如果 `baseStats` 中存在 NaN/Infinity，或 `quality` 为非法值导致 `QUALITY_MULTIPLIERS[quality]` = `undefined`，最终战力仍可能为 NaN/Infinity/负数，传播到排序、编队、UI 层。

### 修复方案（HeroSystem.ts calculatePower 末尾）
```typescript
const raw = statsPower * levelCoeff * qualityCoeff * starCoeff * equipmentCoeff * bondCoeff;
// R2-FIX-P05: NaN/Infinity/负数 最终输出防护
if (!Number.isFinite(raw) || raw < 0) return 0;
return Math.floor(raw);
```

### 测试对齐更新
旧测试 `HeroSystem.boundary.test.ts` 和 `power-formula-boundary.test.ts` 期望 NaN/Infinity/负值传播，已更新为期望防护后的安全值 0：
- `武将属性含NaN时计算战力应返回0（R2-FIX-P05: NaN防护）`
- `武将属性含Infinity时计算战力应返回0（R2-FIX-P05: 非有限值防护）`
- `羁绊系数负值时战力返回0（R2-FIX-P05: 负数防护）`

### 涉及文件
- `src/games/three-kingdoms/engine/hero/HeroSystem.ts`
- `src/games/three-kingdoms/engine/hero/__tests__/HeroSystem.boundary.test.ts`（测试对齐）
- `src/games/three-kingdoms/engine/hero/__tests__/power-formula-boundary.test.ts`（测试对齐）

---

## FIX-204: 碎片溢出上限

### 问题描述
碎片添加无上限，可通过大量碎片溢出获取超额资源。

### 修复方案（HeroSystem.ts addFragment）
```typescript
static readonly FRAGMENT_CAP = 999;
static readonly FRAGMENT_TO_GOLD_RATE = 100;

addFragment(generalId: string, count: number): number {
  if (!Number.isFinite(count) || count <= 0) return 0;
  const current = this.state.fragments[generalId] ?? 0;
  const newTotal = current + count;
  const cap = HeroSystem.FRAGMENT_CAP;
  if (newTotal <= cap) {
    this.state.fragments[generalId] = newTotal;
    return 0;
  }
  this.state.fragments[generalId] = cap;
  return newTotal - cap; // 溢出碎片返回给调用方转化为铜钱
}
```

溢出处理在 `HeroStarSystem` 的三个入口统一处理：
- `addFragmentFromActivity` — 溢出碎片 × 100 转铜钱
- `addFragmentFromExpedition` — 溢出碎片 × 100 转铜钱
- `exchangeFragmentsFromShop` — 溢出碎片 × 单价退铜钱

### 涉及文件
- `src/games/three-kingdoms/engine/hero/HeroSystem.ts`
- `src/games/three-kingdoms/engine/hero/HeroStarSystem.ts`

---

## 验证结果

### 测试通过
```
✓ round-2-fixes.test.ts — 33 tests passed
✓ HeroSystem.boundary.test.ts — 13 tests passed
✓ power-formula-boundary.test.ts — 19 tests passed
```

### TypeScript 编译
```
npx tsc --noEmit — 无错误
```

### 已知预存在问题（非 R2 修复范围）
- `HeroRecruitSystem.test.ts` — 6 tests failed（招募成本配置差异，非 R2 修复范围）
- `SkillUpgradeSystem.supplement.test.ts` — 2 tests failed（技能升级补充，非 R2 修复范围）
- `hero-recruit-boundary.test.ts` — 4 tests failed（招募边界，非 R2 修复范围）
- `HeroRecruitSystem.edge.test.ts` — 4 tests failed（招募边界，非 R2 修复范围）
- `hero-recruit-history.test.ts` — 1 test failed（招募历史，非 R2 修复范围）
