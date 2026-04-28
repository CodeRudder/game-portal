# 武将升星后四维属性变化 — 测试/文档覆盖调研报告

> **调研日期**: 2025-01-24  
> **调研范围**: `src/games/three-kingdoms/` 引擎层 + UI层 + ACC验收测试 + 文档  
> **核心问题**: 武将升星后，武将详情页四维属性（攻击/防御/智力/速度）是否正确变化

---

## 一、代码实现路径（引擎 → UI）

### 1.1 属性计算存在两套独立公式

| 计算函数 | 所在文件 | 公式 | 是否含星级倍率 |
|----------|----------|------|----------------|
| `statsAtLevel(base, level)` | `engine/hero/HeroLevelSystem.ts:116` | `base × (1 + (level-1) × 0.03)` | ❌ **不含** |
| `calculateStarStats(general, star)` | `engine/hero/HeroStarSystem.ts:240` | `baseStats × getStarMultiplier(star)` | ✅ **含** |
| `calculatePower(general, star, ...)` | `engine/hero/HeroSystem.ts:178` | `statsPower × levelCoeff × qualityCoeff × starCoeff × ...` | ✅ **含** |

### 1.2 星级倍率配置 (`star-up-config.ts`)

```
STAR_MULTIPLIERS = [1.0(1星), 1.15(2星), 1.35(3星), 1.6(4星), 2.0(5星), 2.5(6星)]
```

### 1.3 HeroDetailModal 属性显示数据流

```
HeroDetailModal.tsx:154
  → const effectiveStats = statsAtLevel(general.baseStats, general.level)  // ❌ 不含星级
  → stats.map(stat => { key, label, value: effectiveStats[key], percentage, color })
  → 渲染属性条 + 雷达图
```

**问题**: `statsAtLevel` 只计算等级成长（3%/级），**不包含星级倍率**。升星后 `baseStats` 不变，`level` 不变，因此属性条数值不变。

### 1.4 战力计算数据流

```
HeroDetailModal.tsx:112
  → heroSystem.calculatePower(general, heroStarSystem.getStar(general.id))  // ✅ 含星级
```

### 1.5 ThreeKingdomsEngine.getHeroAttrs 数据流

```
ThreeKingdomsEngine.ts:636-641
  → getHeroAttrs: (heroId) => { attack: s.attack, defense: s.defense, ... }  // ❌ 直接返回 baseStats，无等级/星级
  → simulateLevel: (heroId, level) => { attack: Math.floor(s.attack * levelCoeff), ... }  // ❌ 有等级无星级
```

---

## 二、确认存在的代码缺陷

### 🔴 P0 缺陷：升星后详情页属性条数值不变

**现象**: 武将升星后（如 1星→2星），详情页四维属性条数值不变，但战力数值增大。

**根因**: `HeroDetailModal.tsx` 第154行使用 `statsAtLevel(general.baseStats, general.level)` 计算属性，该函数只考虑等级成长率，不考虑星级倍率。升星操作只修改 `HeroStarSystem` 内部状态中的星级数字，不修改 `general.baseStats`。

**影响范围**:
- 详情页四维属性条（武力/统率/智力/政治）❌ 不变
- 雷达图 ❌ 不变（同样使用 `statsAtLevel`）
- 战力数值 ✅ 正确变化（使用 `calculatePower` 含星级系数）
- **用户感知**: "属性没变但战力涨了" — 严重的数据不一致

**数学验证**（以关羽为例，baseStats.attack=115, level=10）:

| 场景 | statsAtLevel (当前实现) | calculateStarStats (正确值) | calculatePower (战力) |
|------|------------------------|---------------------------|---------------------|
| 1星 | 115 × 1.27 = 146 | 115 × 1.0 = 115 | ✅ 含 starCoeff=1.0 |
| 2星 | 115 × 1.27 = 146 (不变!) | 115 × 1.15 = 132 | ✅ 含 starCoeff=1.15 |
| 3星 | 115 × 1.27 = 146 (不变!) | 115 × 1.35 = 155 | ✅ 含 starCoeff=1.35 |

> ⚠️ 注意: `statsAtLevel` 和 `calculateStarStats` 是**两套独立的属性计算体系**，前者只看等级，后者只看星级，两者互不包含。正确的实现应该**同时包含等级成长和星级倍率**。

### 🟡 P1 缺陷：ThreeKingdomsEngine.getHeroAttrs 不含等级和星级

`ThreeKingdomsEngine.ts:636-641` 中 `getHeroAttrs` 直接返回 `baseStats` 原始值，`simulateLevel` 只有等级系数没有星级倍率。这影响 `HeroAttributeCompare`（武将对比）系统的属性计算。

---

## 三、测试覆盖分析

### 3.1 升星操作测试覆盖 ✅

| 测试文件 | 用例 | 覆盖内容 |
|----------|------|----------|
| `HeroStarSystem.test.ts` | 14个用例 | 碎片获取、升星消耗、升星执行、属性倍率计算、序列化 |
| `ACC-04-武将系统.test.tsx` | ACC-04-14, ACC-04-23 | 升星操作成功、星级+1 |
| `ACC-13-觉醒系统.test.tsx` | ACC-13-07, ACC-13-10, ACC-13-24 | 升星预览属性对比、升星操作、属性差值 |

### 3.2 属性变化测试覆盖 ⚠️ 部分覆盖

| 测试文件 | 用例 | 覆盖内容 | 缺失 |
|----------|------|----------|------|
| `HeroStarSystem.test.ts` | "should calculate stats correctly" | 验证 `starUp()` 返回的 `statsBefore`/`statsAfter` 差异 | ✅ 引擎层覆盖 |
| `HeroStarSystem.test.ts` | "属性倍率" describe | `calculateStarStats` 各星级属性递增 | ✅ 引擎层覆盖 |
| `ACC-04-武将系统.test.tsx` | ACC-04-20 | `statsAtLevel` 不同等级属性增长 | ✅ 但不含星级 |
| `ACC-04-武将系统.test.tsx` | ACC-04-53~55 | `statsAtLevel` 函数可用性和增长性 | ✅ 但不含星级 |
| `HeroDetailModal.test.tsx` | level=10 属性值测试 | 验证 `statsAtLevel` 被调用 | ✅ 但不含星级 |

### 3.3 升星 + 属性变化 联合覆盖 ❌ 关键缺失

| 缺失场景 | 说明 |
|----------|------|
| **ACC-04-23 断言不完整** | 测试名称"升星后属性面板立即更新"，但断言只验证 `result.success === true` 和 `currentStar > previousStar`，**未验证任何属性值变化** |
| **HeroDetailModal 无升星后属性测试** | `HeroDetailModal.test.tsx` 只测试了 level=1 和 level=10 的属性值，没有测试升星后属性值变化的场景 |
| **无端到端测试** | 没有测试覆盖"执行升星→打开详情页→验证属性条数值变化"的完整链路 |
| **无 statsAtLevel vs calculateStarStats 一致性测试** | 没有测试验证两套属性计算体系是否一致 |

### 3.4 测试覆盖矩阵

```
                          升星操作  属性变化  升星后属性变化(联合)
HeroStarSystem.test.ts     ✅        ✅         ✅ (引擎层)
ACC-04-武将系统.test.tsx    ✅        ⚠️         ❌ (只验证星级数字)
ACC-13-觉醒系统.test.tsx    ✅        ✅         ✅ (预览层)
HeroDetailModal.test.tsx   ❌        ✅         ❌
E2E/集成测试                ❌        ❌         ❌
```

---

## 四、文档覆盖分析

### 4.1 已有文档

| 文档 | 覆盖内容 |
|------|----------|
| `docs/games/three-kingdoms/lessons-learned.md` LL-002 | ✅ **已记录此Bug**: "ACC测试用例名必须与验证内容严格一致" |
| `docs/games/three-kingdoms/lessons-learned.md` LL-004 | ✅ **已记录**: "验收文档风险标记必须有验证闭环" |
| `docs/games/three-kingdoms/acceptance/ACC-04-武将系统-R1.md` | ✅ **已标记风险**: "statsAtLevel 不含星级倍率" |
| `star-up-config.ts` 注释 | ✅ 星级倍率表和公式说明完整 |

### 4.2 文档缺失

| 缺失文档 | 说明 |
|----------|------|
| **升星后属性变化的PRD/设计文档** | 没有明确的PRD定义"升星后详情页属性应该如何变化" |
| **属性计算统一规范** | 没有文档说明 `statsAtLevel` vs `calculateStarStats` 的关系和使用场景 |
| **修复验证报告** | LL-002 中提到的修复决策未记录是否已执行完成 |

---

## 五、缺陷根因分析

### 5.1 根因链

```
设计缺陷 → 测试遗漏 → 文档风险标记被降级 → Bug长期存在
```

1. **设计缺陷**: 属性计算存在两套独立体系（`statsAtLevel` 和 `calculateStarStats`），UI层选用了不含星级的那个
2. **测试遗漏**: ACC-04-23 用例名声称验证"属性面板更新"，实际只验证了"星级数字变化"
3. **文档降级**: ACC-04-R1 已识别风险并标记⚠️，但R2降级为"P1(监控)"后未实际验证
4. **无端到端测试**: 没有测试覆盖"升星→打开详情→验证属性值"的完整用户路径

### 5.2 Bug发现与记录状态

- **Bug 已在 `lessons-learned.md` 中记录** (LL-002, LL-004)
- **修复方案已在 LL-002 中列出**，但**代码中未见执行证据**：
  - ❌ `HeroDetailModal.tsx` 仍使用 `statsAtLevel`（第154行）
  - ❌ `ThreeKingdomsEngine.getHeroAttrs` 仍返回裸 `baseStats`
  - ❌ ACC-04-23 断言未增加属性值变化验证
  - ❌ 未引入 `getEffectiveStats` 统一函数

---

## 六、修复建议

### 6.1 代码修复 (P0)

**方案A: 创建统一属性计算函数**

```typescript
// engine/hero/HeroLevelSystem.ts 或新建 HeroStatsCalculator.ts
export function getEffectiveStats(
  baseStats: GeneralStats, 
  level: number, 
  star: number
): GeneralStats {
  const levelMultiplier = 1 + (level - 1) * 0.03;
  const starMultiplier = getStarMultiplier(star);
  const totalMultiplier = levelMultiplier * starMultiplier;
  return {
    attack: Math.floor(baseStats.attack * totalMultiplier),
    defense: Math.floor(baseStats.defense * totalMultiplier),
    intelligence: Math.floor(baseStats.intelligence * totalMultiplier),
    speed: Math.floor(baseStats.speed * totalMultiplier),
  };
}
```

**方案B: HeroDetailModal 直接修改（最小改动）**

```typescript
// HeroDetailModal.tsx:154
const effectiveStats = useMemo(() => {
  const levelStats = statsAtLevel(general.baseStats, general.level);
  const star = heroStarSystem.getStar(general.id);
  const starMult = getStarMultiplier(star);
  return {
    attack: Math.floor(levelStats.attack * starMult),
    defense: Math.floor(levelStats.defense * starMult),
    intelligence: Math.floor(levelStats.intelligence * starMult),
    speed: Math.floor(levelStats.speed * starMult),
  };
}, [general, heroStarSystem]);
```

### 6.2 测试补充 (P0)

```typescript
// ACC-04-武将系统.test.tsx — 补充 ACC-04-23 的断言
it(accTest('ACC-04-23', '升星后属性面板立即更新 — starUp返回新星级'), () => {
  const { engine, sim } = makeEngineForEnhance('guanyu');
  sim.addHeroFragments('guanyu', 50);
  const starSystem = engine.getHeroStarSystem();
  const result = starSystem.starUp('guanyu');
  assertStrict(result.success === true, 'ACC-04-23', '升星应成功');
  assertStrict(result.currentStar > result.previousStar, 'ACC-04-23', '星级应增加');
  // ===== 新增：验证属性值变化 =====
  assertStrict(result.statsAfter.attack > result.statsBefore.attack, 'ACC-04-23', 
    `攻击应增大：${result.statsBefore.attack}→${result.statsAfter.attack}`);
  assertStrict(result.statsAfter.defense > result.statsBefore.defense, 'ACC-04-23', 
    `防御应增大：${result.statsBefore.defense}→${result.statsAfter.defense}`);
  assertStrict(result.statsAfter.intelligence > result.statsBefore.intelligence, 'ACC-04-23', 
    '智力应增大');
  assertStrict(result.statsAfter.speed > result.statsBefore.speed, 'ACC-04-23', 
    '速度应增大');
});

// 新增：HeroDetailModal 升星后属性条变化测试
it('升星后HeroDetailModal属性条数值应增大', () => {
  const { engine, sim } = makeEngineForEnhance('guanyu');
  sim.addHeroFragments('guanyu', 50);
  
  // 升星前渲染
  const g = engine.getGeneral('guanyu')!;
  const { rerender } = render(<HeroDetailModal general={g} engine={engine} onClose={vi.fn()} />);
  const beforeAttack = screen.getAllByText(/\d+/)[0].textContent;
  
  // 执行升星
  engine.getHeroStarSystem().starUp('guanyu');
  const updatedG = engine.getGeneral('guanyu')!;
  rerender(<HeroDetailModal general={updatedG} engine={engine} onClose={vi.fn()} />);
  
  // 验证属性条数值变化（需要修复代码后才能通过）
  // ...
});
```

### 6.3 ThreeKingdomsEngine.getHeroAttrs 修复 (P1)

```typescript
getHeroAttrs: (heroId: string): Record<string, number> => {
  const g = this.hero.getGeneral(heroId);
  if (!g) return {};
  const star = this.heroStar.getStar(heroId);
  const effectiveStats = getEffectiveStats(g.baseStats, g.level, star);
  return { 
    attack: effectiveStats.attack, 
    defense: effectiveStats.defense, 
    intelligence: effectiveStats.intelligence, 
    speed: effectiveStats.speed 
  };
},
```

---

## 七、总结

| 维度 | 状态 | 说明 |
|------|------|------|
| **代码缺陷** | 🔴 **存在且未修复** | `HeroDetailModal` 使用 `statsAtLevel` 不含星级倍率，升星后属性条不变 |
| **引擎层测试** | ✅ **覆盖充分** | `HeroStarSystem.test.ts` 完整覆盖了升星和属性倍率 |
| **UI层测试** | ❌ **关键缺失** | ACC-04-23 断言不匹配，无升星后属性变化验证 |
| **E2E测试** | ❌ **完全缺失** | 无"升星→详情页→属性变化"端到端测试 |
| **文档记录** | ✅ **已记录但未闭环** | LL-002/LL-004 已记录Bug和教训，但修复未执行 |
| **根因** | 设计 + 测试 + 流程 | 两套属性计算体系、测试名与断言不匹配、风险降级后遗忘 |

**优先级建议**: 
1. **P0** — 修复 `HeroDetailModal.tsx` 属性计算，加入星级倍率
2. **P0** — 补充 ACC-04-23 属性值变化断言
3. **P1** — 修复 `ThreeKingdomsEngine.getHeroAttrs`
4. **P1** — 引入统一属性计算函数 `getEffectiveStats`
5. **P2** — 新增升星后属性变化的 E2E 测试
