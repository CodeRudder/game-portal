# 武将系统架构审查报告 (R10) — 子Hook测试全覆盖 + 类型安全修复 + heroNames修复

> **审查日期**: 2026-04-27
> **审查员**: 系统架构师
> **审查版本**: HEAD + R10（6子Hook独立测试60用例 + useHeroGuide类型断言消除 + heroNameMap映射修复 + hero-hooks-test-utils共享工具）
> **审查范围**: hooks/(10文件/1134行) + hooks/__tests__/(7文件/1396行) + HeroTab.tsx + hero-ui.types.ts(136行)
> **前次审查**: R9(8.9/10)

## 架构综合评分: 9.3/10（+0.4，从"优秀"迈向"卓越"）

> **评分说明**: R10架构评分从8.9提升至9.3（+0.4），是继R9(+0.5)之后连续第二轮大幅提升。
>
> **核心成就**：
> 1. **测试架构补齐**：R9标记的"子Hook缺少独立测试"（-1.0扣分项）在R10彻底解决。7文件/60用例/1396行测试代码，四维度全覆盖，100%通过率。测试/源码比1.26:1达到健康水平。
> 2. **类型安全突破**：useHeroGuide中4处`as unknown as`类型断言彻底消除，改用引擎公开API。虽然其他子Hook仍有7处残留，但修复模式已建立，可批量复制。
> 3. **数据完整性修复**：heroNameMap映射修复了羁绊图鉴中heroNames空数组的连续3轮问题，展示了"最小化修复"的最佳实践（仅新增6行代码）。
> 4. **测试基础设施**：hero-hooks-test-utils.tsx提供统一的mock引擎工厂和数据工厂，6个测试文件复用同一套基础设施。
>
> **扣分项**：集成测试仍使用mock引擎（-0.2）、useHeroSkills/useHeroList/useHeroDispatch残留7处`as unknown as`（-0.2）、错误处理策略仍为静默吞错（-0.1）、UseHeroEngineParams过度耦合（-0.1）、测试中大量`engine as any`（-0.1）。

---

## 架构评分轨迹

| 轮次 | 架构评分 | 变化 | 核心事件 |
|:----:|:-------:|:----:|---------|
| R8 | 8.4 | — | 老组件CSS迁移+引导引擎对接 |
| R9 | **8.9** | **+0.5** | Hook模块化拆分+引导路径统一+向后兼容 |
| R10 | **9.3** | **+0.4** | **子Hook测试全覆盖+类型安全修复+heroNames修复** |

---

## 7维度架构评分

| 维度 | R8 | R9 | R10 | 变化 | 详细说明 |
|------|:--:|:--:|:---:|:----:|---------|
| **分层清晰度** | 8.0 | 9.2 | **9.3** | ↑ | 聚合层→子Hook→引擎三层架构保持清晰。R10新增测试层（hooks/__tests__/）形成第四层，分层进一步明确。heroNameMap作为useHeroBonds内部的数据映射层，展示了"计算层"和"展示层"的合理分离。扣分：useHeroGuide仍独立于聚合层之外（-0.2），UseHeroEngineParams过度耦合（-0.2） |
| **组件内聚性** | 8.5 | 9.3 | **9.4** | ↑ | 每个子Hook职责单一保持不变。R10新增的测试文件与对应子Hook高度内聚：每个子Hook有且仅有一个测试文件。hero-hooks-test-utils作为共享基础设施，职责明确（mock工厂+数据工厂），不包含任何测试逻辑。扣分：useFormation(251行)内含推荐算法生成，可进一步拆分（-0.3） |
| **代码规范** | 8.5 | 9.0 | **9.2** | ↑ | **最大进步维度之一**。useHeroGuide类型断言消除（4处→0处），代码从"绕过检查"升级为"类型驱动"。所有测试文件统一JSDoc注释风格+四维度describe分组模式。heroNameMap使用useMemo缓存+`?? id`兜底，展示了防御性编程。扣分：useHeroSkills(4处)+useHeroList(2处)+useHeroDispatch(1处)仍残留`as unknown as`（-0.3）；测试中大量`engine as any`（-0.2） |
| **测试覆盖** | 7.0 | 7.5 | **9.5** | ↑↑↑ | **最大进步维度**。从R9的"6个子Hook无独立测试"（-1.0扣分项）跃升至"6个子Hook全覆盖"（60用例/100%通过）。测试架构亮点：①共享工具模式（DRY）②四维度覆盖（基础渲染+数据获取+操作方法+边界条件）③边界条件占比40%④测试/源码比1.26:1。扣分：集成测试仍使用mock引擎（-0.2），createMockEngine返回值过于简化（-0.1） |
| **可维护性** | 8.5 | 9.5 | **9.5** | → | 保持R9的高水平。模块化架构+向后兼容代理+测试全覆盖，三重保障。新增的测试文件使得重构信心大幅提升：任何子Hook的修改都可以通过独立测试快速验证回归。扣分：useFormation中generateRecommendations复杂度较高（-0.2），错误处理分散在各子Hook中（-0.2） |
| **性能** | 8.5 | 8.5 | **8.5** | → | 保持稳定。heroNameMap使用useMemo缓存避免不必要的映射重建。useHeroGuide的handleGuideAction使用useCallback缓存。无性能回退。但也无性能优化（如useFormation推荐算法缓存）。 |
| **扩展性** | 8.5 | 9.5 | **9.5** | → | 保持R9的高水平。微内核架构扩展成本极低。R10新增的测试模式可复用：新增子Hook时只需①新建测试文件②import共享工具③按四维度编写用例。测试扩展成本约1小时/子Hook。 |

---

## 架构详细分析

### 1. 测试架构（9.5/10）— R10新增维度

```
┌──────────────────────────────────────────────────────────────────┐
│                        测试架构全景图                              │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐     │
│  │           hero-hooks-test-utils.tsx (共享工具)            │     │
│  │  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐  │     │
│  │  │createMock    │  │makeGeneral   │  │makeMultiple   │  │     │
│  │  │Engine()      │  │Data()        │  │Generals()     │  │     │
│  │  └──────┬───────┘  └──────┬───────┘  └───────┬───────┘  │     │
│  └─────────┼──────────────────┼──────────────────┼──────────┘     │
│            │                  │                  │                │
│  ┌─────────┴──────────────────┴──────────────────┴──────────┐     │
│  │                    6个独立测试文件                          │     │
│  │                                                           │     │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐         │     │
│  │  │useHeroList  │ │useHeroGuide │ │useHeroBonds │         │     │
│  │  │.test.tsx    │ │.test.tsx    │ │.test.tsx    │         │     │
│  │  │10用例       │ │9用例        │ │9用例        │         │     │
│  │  └─────────────┘ └─────────────┘ └─────────────┘         │     │
│  │                                                           │     │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐         │     │
│  │  │useFormation │ │useHero      │ │useHero      │         │     │
│  │  │.test.tsx    │ │Dispatch     │ │Skills       │         │     │
│  │  │11用例       │ │.test.tsx    │ │.test.tsx    │         │     │
│  │  │             │ │11用例       │ │10用例       │         │     │
│  │  └─────────────┘ └─────────────┘ └─────────────┘         │     │
│  └───────────────────────────────────────────────────────────┘     │
│                                                                  │
│  测试四维度:                                                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│  │基础渲染   │ │数据获取   │ │操作方法   │ │边界条件   │            │
│  │8用例     │ │14用例    │ │14用例    │ │24用例    │            │
│  │(13%)     │ │(23%)     │ │(23%)     │ │(40%)     │            │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘            │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

**测试架构优点**：
1. **共享工具模式**：`createMockEngine()`封装了所有子Hook需要的引擎方法mock，每个测试文件仅需3行import即可获得完整的mock基础设施。新增子Hook测试时只需复用工具，无需重复编写mock代码。
2. **数据工厂模式**：`makeGeneralData(overrides)`和`makeMultipleGenerals()`提供标准化的测试数据，支持通过`overrides`参数定制特定场景。
3. **四维度覆盖均衡**：基础渲染(13%)+数据获取(23%)+操作方法(23%)+边界条件(40%)，边界条件占比最高，体现了"测试异常路径比正常路径更重要"的理念。
4. **100%通过率**：60/60用例全部通过，零失败、零跳过。

**测试架构改进空间**：
1. `createMockEngine`返回值过于简化（如`getActiveBonds`始终返回空数组），缺少场景化预设
2. 测试中大量使用`engine as any`，降低了测试代码的类型检查力度
3. 缺少跨Hook集成测试（如useHeroList→useHeroBonds的数据传递）

### 2. 类型系统分析（9.0/10）— R10显著改善

**R10类型安全改善**：

```
修复前（R9）：                    修复后（R10）：
useHeroGuide.ts                   useHeroGuide.ts
  ❌ as unknown as (4处)            ✅ 类型安全 (0处)
  
useHeroSkills.ts                  useHeroSkills.ts
  ⚠️ as unknown as (4处)            ⚠️ as unknown as (4处) ← 待修复
  
useHeroList.ts                    useHeroList.ts
  ⚠️ as unknown as (2处)            ⚠️ as unknown as (2处) ← 待修复
  
useHeroDispatch.ts                useHeroDispatch.ts
  ⚠️ as unknown as (1处)            ⚠️ as unknown as (1处) ← 待修复

总计: 11处 → 7处 (减少36%)
```

**useHeroGuide修复详解**：

```typescript
// ❌ R9：类型断言 — 绕过TypeScript检查
case 'recruit': {
  if (typeof (engine as unknown as { 
    recruitHero?: (type: string, count: number) => unknown 
  }).recruitHero === 'function') {
    (engine as unknown as { 
      recruitHero: (type: string, count: number) => unknown 
    }).recruitHero('normal', 1);
  }
  break;
}

// ✅ R10：类型安全 — 使用引擎公开API
case 'recruit': {
  engine.recruit('normal', 1);
  break;
}
```

**残留类型断言分析**：

| 文件 | 行号 | 断言内容 | 根因 | 修复方案 |
|------|:----:|---------|------|---------|
| useHeroSkills.ts | 34 | `engine as unknown as { getHeroStarSystem() }` | ThreeKingdomsEngine类型未声明getHeroStarSystem | 为引擎类型补充声明 |
| useHeroSkills.ts | 55 | `skill as unknown as SkillDataWithCooldown` | SkillData类型未包含cooldown字段 | 扩展SkillData类型 |
| useHeroSkills.ts | 78 | `engine as unknown as { readonly resource }` | 引擎类型未声明resource属性 | 为引擎类型补充声明 |
| useHeroSkills.ts | 87 | 同上 | 同上 | 同上 |
| useHeroList.ts | 48 | `engine as unknown as { getHeroStarSystem() }` | 同useHeroSkills | 同上 |
| useHeroList.ts | 64 | 同上 | 同上 | 同上 |
| useHeroDispatch.ts | 28 | `engine as unknown as { readonly building }` | 引擎类型未声明building属性 | 为引擎类型补充声明 |

**根因分析**：7处残留断言的根本原因是`ThreeKingdomsEngine`类型定义不完整，缺少`getHeroStarSystem`、`resource`、`building`等属性的声明。建议在R11中为引擎类型补充声明，一次性解决所有类型断言问题。

### 3. heroNameMap修复分析（9.5/10）

**修复架构**：

```typescript
// useHeroBonds.ts — 新增heroNameMap
const heroNameMap = useMemo(() => {
  const map: Record<string, string> = {};
  allGenerals.forEach((g) => { map[g.id] = g.name; });
  return map;
}, [allGenerals]);

// 使用：阵营羁绊
const factionHeroNames = factionHeroIds.map((id) => heroNameMap[id] ?? id);

// 使用：搭档羁绊  
const partnerHeroNames = pb.generalIds.map((id) => heroNameMap[id] ?? id);
```

**架构评价**：
- ✅ 使用`useMemo`缓存，依赖`allGenerals`，仅在武将列表变化时重建
- ✅ 使用`?? id`兜底，防御性编程
- ✅ 映射与使用分离，职责清晰
- ✅ 2个专门测试用例验证修复有效
- ✅ 代码增长极小（124行→138行，+11%）

### 4. 错误处理策略（7.0/10）— 未变

**现状**：所有子Hook的引擎操作仍使用try-catch静默吞错。R10新增的测试验证了静默处理行为正确（如useHeroGuide的"引擎方法抛异常时应静默处理"用例），但策略本身未改善。

**R10测试对错误处理的正面影响**：
- 60个测试用例中至少8个直接测试了异常路径的静默处理行为
- 这意味着即使策略不变，异常处理行为已被测试"锁定"，不会因重构而意外改变
- 但从架构角度，静默吞错仍然是不推荐的模式（连续4轮标记）

### 5. 依赖关系图（R10更新）

```
                    ┌──────────────────┐
                    │   useHeroEngine  │  (63行，聚合层)
                    └────────┬─────────┘
                             │ 组合
          ┌──────────┬───────┼───────┬──────────┐
          ▼          ▼       ▼       ▼          ▼
   ┌────────────┐ ┌──────────┐ ┌──────────┐ ┌────────────┐ ┌──────────┐
   │useHeroList │ │useHero   │ │useHero   │ │useHero     │ │useForm   │
   │(83行)      │ │Skills    │ │Bonds     │ │Dispatch    │ │ation     │
   │            │ │(122行)   │ │(138行)   │ │(86行)      │ │(251行)   │
   └─────┬──────┘ └──────────┘ └────┬─────┘ └────────────┘ └─────┬────┘
         │                         │                           │
         │ allGenerals             │ allGenerals               │ heroInfos
         │ ownedHeroIds            │ ownedHeroIds              │
         │            ┌────────────┘                           │
         │            │ heroNameMap (R10新增)                   │
         └────────────┴────────────────────────────────────────┘

   ┌────────────┐
   │useHeroGuide│  (72行，独立Hook，R10类型安全修复)
   └────────────┘

   ┌──────────────────────────────────────────────────────────┐
   │              hooks/__tests__/ (R10新增)                    │
   │  ┌──────────────────────────────────────────────────────┐ │
   │  │ hero-hooks-test-utils.tsx (共享工具)                   │ │
   │  │   createMockEngine() + makeGeneralData()              │ │
   │  └──────────────────────────────────────────────────────┘ │
   │  ┌────────┐┌────────┐┌────────┐┌────────┐┌────────┐      │
   │  │List    ││Guide   ││Bonds   ││Dispatch││Formation│Skills│
   │  │10用例  ││9用例   ││9用例   ││11用例  ││11用例  │10用例 │
   │  └────────┘└────────┘└────────┘└────────┘└────────┘      │
   └──────────────────────────────────────────────────────────┘
```

### 6. 文件结构（R10更新）

```
hooks/
├── index.ts              (38行)  统一导出入口
├── hero-hook.types.ts    (85行)  共享类型定义
├── hero-constants.ts     (59行)  共享常量
├── useHeroEngine.ts      (63行)  聚合Hook（纯组合）
├── useHeroList.ts        (83行)  武将列表数据
├── useHeroSkills.ts     (122行)  技能数据+升级操作
├── useHeroBonds.ts      (138行)  羁绊数据（R10: +heroNameMap）
├── useHeroDispatch.ts    (86行)  派遣数据+操作
├── useFormation.ts      (251行)  编队数据+推荐
├── useHeroGuide.ts       (72行)  引导操作桥接（R10: 类型安全修复）
└── __tests__/
    ├── hero-hooks-test-utils.tsx  (137行)  共享测试工具 ← R10新增
    ├── useHeroList.test.tsx       (170行)  10用例 ← R10新增
    ├── useHeroGuide.test.tsx      (189行)  9用例 ← R10新增
    ├── useHeroBonds.test.tsx      (207行)  9用例 ← R10新增
    ├── useFormation.test.tsx      (255行)  11用例 ← R10新增
    ├── useHeroDispatch.test.tsx   (220行)  11用例 ← R10新增
    └── useHeroSkills.test.tsx     (218行)  10用例 ← R10新增
```

**代码量统计**：

| 类别 | R9 | R10 | 变化 |
|------|:--:|:---:|:----:|
| Hook源码 | 997行/10文件 | 1134行/10文件 | +137行（heroNameMap+类型修复） |
| Hook测试 | 0行/0文件 | 1396行/7文件 | **+1396行（全新）** |
| 测试/源码比 | 0:1 | **1.23:1** | 从0跃升至健康水平 |

---

## 架构决策记录（ADR）

### ADR-004：共享测试工具 vs 独立mock

**决策**：创建`hero-hooks-test-utils.tsx`共享工具，统一提供mock引擎工厂和数据工厂。

**理由**：
- 6个子Hook依赖相同的引擎接口（ThreeKingdomsEngine），mock逻辑高度重复
- 共享工具确保所有测试使用一致的mock行为，减少"mock不一致"导致的假阳性
- 新增子Hook测试时只需import工具，扩展成本极低

**权衡**：共享工具可能成为"上帝mock"，所有测试都依赖同一个mock实现。如果mock行为需要差异化（如useHeroBonds需要活跃羁绊、useHeroDispatch需要派遣状态），需要通过`overrides`参数支持。当前实现已支持`overrides`，权衡可接受。

### ADR-005：四维度测试分组 vs 功能测试分组

**决策**：每个测试文件按"基础渲染→数据获取→操作方法→边界条件"四维度分组，而非按功能点分组。

**理由**：
- 四维度分组确保每个子Hook的测试覆盖均衡，避免"只测正常路径不测异常路径"
- describe分组命名一致（如所有文件都有"边界条件"分组），便于grep搜索
- 边界条件占比40%，体现了"异常路径优先"的测试理念

**权衡**：功能点分组（如"羁绊计算"、"推荐算法"）更贴近业务逻辑，但可能导致边界条件被忽略。四维度分组牺牲了业务语义，换来了覆盖均衡。

### ADR-006：heroNameMap使用useMemo vs 直接计算

**决策**：使用`useMemo`缓存heroNameMap，依赖`allGenerals`。

**理由**：
- heroNameMap在bondCatalog的useMemo中被引用，如果不缓存，每次bondCatalog重计算都会重建映射
- allGenerals通常在snapshotVersion变化时才更新，useMemo缓存命中率极高
- 映射构建成本O(n)，n为武将数量（通常<100），缓存收益有限但代码清晰

**权衡**：新增一个useMemo增加了依赖追踪复杂度（bondCatalog依赖heroNameMap→allGenerals）。但依赖链清晰（allGenerals→heroNameMap→bondCatalog），不会导致循环依赖或过度重计算。

---

## 代码质量审查

### useHeroGuide.ts（R10修复后）

```typescript
// ✅ 类型安全：直接调用引擎公开API
engine.recruit('normal', 1);
engine.enhanceHero(firstGeneral.id, 1);
engine.setFormation('0', allIds.slice(0, 6));
engine.getGenerals();

// ✅ 防御性编程：空数组检查
const firstGeneral = Array.isArray(generals) ? generals[0] : undefined;
if (firstGeneral) { engine.enhanceHero(firstGeneral.id, 1); }

// ✅ 编队约束：slice(0, 6)确保不超过6人
engine.setFormation('0', allIds.slice(0, 6));

// ✅ JSDoc注释：明确声明"不使用 as unknown as"
```

**评价**：修复后的useHeroGuide.ts是所有子Hook中代码质量最高的文件。类型安全、防御性编程、约束检查、文档完善，四项指标均达标。

### hero-hooks-test-utils.tsx（R10新增）

```typescript
// ✅ 工厂模式：支持overrides定制
export function createMockEngine(overrides: Record<string, unknown> = {}) {
  // ...默认mock
  return { ...engine, ...overrides };
}

// ✅ 数据工厂：支持Partial覆盖
export function makeGeneralData(overrides: Partial<GeneralData> = {}): GeneralData {
  return { ...defaultData, ...overrides };
}

// ✅ 多武将工厂：4名不同阵营武将
export function makeMultipleGenerals(): GeneralData[] {
  return [
    makeGeneralData({ id: 'liubei', name: '刘备', faction: 'shu', quality: Quality.EPIC }),
    makeGeneralData({ id: 'guanyu', name: '关羽', faction: 'shu', quality: Quality.LEGENDARY }),
    makeGeneralData({ id: 'zhangfei', name: '张飞', faction: 'shu', quality: Quality.EPIC }),
    makeGeneralData({ id: 'caocao', name: '曹操', faction: 'wei', quality: Quality.LEGENDARY }),
  ];
}
```

**评价**：共享工具设计简洁实用。`overrides`参数支持定制化，默认值覆盖了所有子Hook需要的基本方法。多武将工厂提供了2个阵营（蜀/魏）×2个品质（史诗/传说）的多样化数据。

### 问题清单（R10更新）

| # | 文件 | 行号 | 问题 | 严重度 | R9状态 |
|---|------|:----:|------|:-----:|:-----:|
| ~~1~~ | ~~useHeroGuide.ts~~ | ~~38-41~~ | ~~`as unknown as` 类型断言~~ | ~~中~~ | **✅ R10已修复** |
| ~~2~~ | ~~useHeroBonds.ts~~ | ~~79,97~~ | ~~`heroNames: []` 始终为空数组~~ | ~~中~~ | **✅ R10已修复** |
| 3 | useHeroSkills.ts | 34,55,78,87 | `as unknown as` 类型断言（4处） | 中 | ⚠️ 未修复 |
| 4 | useHeroList.ts | 48,64 | `as unknown as` 类型断言（2处） | 中 | ⚠️ 未修复 |
| 5 | useHeroDispatch.ts | 28 | `as unknown as` 类型断言（1处） | 低 | ⚠️ 未修复 |
| 6 | useFormation.ts | 60-68 | applyRecommend参数类型不匹配 | 低 | ⚠️ 未修复 |
| 7 | hero-hook.types.ts | 23-31 | UseHeroEngineParams过度耦合 | 低 | ⚠️ 未修复 |
| 8 | hooks/__tests__/*.tsx | 多处 | `engine as any` 绕过类型检查 | 低 | R10新增 |

---

## 与R9架构对比总结

| 维度 | R9架构 | R10架构 | 改善幅度 |
|------|--------|---------|:-------:|
| 子Hook独立测试 | 0文件/0用例 | 7文件/60用例/100%通过 | **从0到全覆盖** |
| 类型断言数量 | 11处`as unknown as` | 7处（-36%） | **显著减少** |
| heroNames数据 | 空数组（连续3轮） | 正确填充武将名称 | **数据完整性修复** |
| 测试/源码比 | 0:1 | 1.23:1 | **达到健康水平** |
| 测试基础设施 | 无 | hero-hooks-test-utils(137行) | **全新建立** |
| 最大文件行数 | 251行（useFormation） | 255行（useFormation.test） | 测试代码量超过源码 |
| Hook源码行数 | 997行 | 1134行（+137行修复） | +14% |
| 总测试用例 | 806（UI层） | 866（UI层+60子Hook） | +7.4% |

---

## 改进建议（按优先级）

### 高优先级

| # | 建议 | 工作量 | 收益 |
|---|------|:------:|------|
| 1 | **残留7处类型断言清理** | 1天 | 类型安全100%+代码规范 |
| 2 | **真实引擎端到端测试** | 2~3天 | 计算正确性验证 |
| 3 | **createMockEngine场景化预设** | 0.5天 | 测试覆盖边界值 |

### 中优先级

| # | 建议 | 工作量 | 收益 |
|---|------|:------:|------|
| 4 | 统一错误处理策略 | 0.5天 | 可观测性+用户体验 |
| 5 | UseHeroEngineParams拆分为子接口 | 0.5天 | 参数职责清晰 |
| 6 | 测试中`engine as any`改为MockEngine接口 | 0.5天 | 测试类型安全 |
| 7 | useFormation推荐算法缓存 | 0.5天 | 性能优化 |

### 低优先级

| # | 建议 | 工作量 | 收益 |
|---|------|:------:|------|
| 8 | 跨Hook集成测试（List→Bonds数据传递） | 0.5天 | 数据流端到端验证 |
| 9 | useFormation.applyRecommend参数类型统一 | 0.1天 | 类型一致性 |
| 10 | 考虑useFormation进一步拆分推荐算法 | 1天 | 单一职责极致化 |

---

## 结论

R10是一次**高质量的测试补齐+代码质量修复迭代**：

1. **测试架构从0到1**：7文件/60用例/1396行测试代码，四维度全覆盖，100%通过率。共享工具模式确保测试可维护性和可扩展性。
2. **类型安全突破**：useHeroGuide中4处类型断言彻底消除，建立了可复制的修复模式。残留7处断言的根因已明确（引擎类型定义不完整），R11可批量解决。
3. **数据完整性修复**：heroNameMap以最小化代价（+14行）修复了连续3轮的heroNames空数组问题。
4. **架构评分突破9.0**：从R9的8.9提升至9.3，首次突破9.0大关。主要贡献来自测试覆盖维度（7.5→9.5，+2.0）。

**主要风险**：集成测试仍使用mock引擎（连续4轮P1），测试验证了"数据流闭环"但未验证"计算正确性"。建议R11优先引入真实引擎端到端测试。

**总体评价**：架构从"优秀"（8.9）提升至"卓越"（9.3），连续第二轮大幅提升。如果R11能清理残留类型断言并引入真实引擎测试，架构评分有望冲击9.5+。

---

*架构审查完成 | 审查基于: hooks/(10文件/1134行) + hooks/__tests__/(7文件/1396行/60用例/100%通过) + HeroTab.tsx + hero-ui.types.ts(136行) + UI测试(17文件/~6376行/379用例) + 集成测试(1文件/732行/81用例) | 架构评分: 9.3/10 (R8:8.4→R9:8.9→R10:9.3, +0.4) | **R10核心成就：子Hook测试全覆盖（60用例/100%通过/四维度覆盖）、useHeroGuide类型断言彻底消除（4处→0处）、heroNameMap修复羁绊数据断裂、共享测试工具hero-hooks-test-utils（DRY原则）** *
