# 武将系统架构审查报告 (R9) — Hook模块化拆分 + 引导路径统一

> **审查日期**: 2026-04-27
> **审查版本**: HEAD + R9（useHeroEngine 662行→9文件/987行 + useHeroGuide桥接层 + 向后兼容代理）
> **审查员**: 系统架构师
> **审查范围**: hooks/(9文件/987行) + HeroTab.tsx(引导路径) + hero-ui.types.ts(136行) + useHeroEngine.ts代理(16行)
> **前次审查**: R8(8.4/10)

## 架构综合评分: 8.9/10（+0.5，从"良好"迈向"优秀"）

> **评分说明**: R9架构评分从8.4提升至8.9（+0.5），是自R6(+0.6)以来最大单轮提升。
>
> **核心成就**：useHeroEngine巨石Hook（662行）成功拆分为9个职责单一的文件（最大251行），采用"聚合层+子Hook"微内核架构模式。引导路径从"双路径"统一为"单路径"。向后兼容代理确保零破坏升级。
>
> **扣分项**：子Hook缺少独立测试（-0.3）、useHeroGuide类型断言使用`as unknown as`（-0.1）、heroNames字段连续3轮为空（-0.1）、错误处理策略仍为静默吞错（-0.1）。

---

## 架构评分轨迹

| 轮次 | 架构评分 | 变化 | 核心事件 |
|:----:|:-------:|:----:|---------|
| R8 | 8.4 | — | 老组件CSS迁移+引导引擎对接 |
| R9 | **8.9** | **+0.5** | **Hook模块化拆分+引导路径统一+向后兼容** |

---

## 7维度架构评分

| 维度 | R8 | R9 | 变化 | 详细说明 |
|------|:--:|:--:|:----:|---------|
| **分层清晰度** | 8.0 | **9.2** | ↑↑ | 聚合层→子Hook→引擎的三层架构清晰。类型定义(hero-hook.types.ts)和常量(hero-constants.ts)独立提取，职责边界明确。子Hook间依赖通过参数注入而非隐式引用。向后兼容代理层确保迁移平滑。扣分：useHeroGuide未纳入聚合层组合（独立于useHeroEngine之外） |
| **组件内聚性** | 8.5 | **9.3** | ↑↑ | 每个子Hook职责高度单一：useHeroList仅管列表数据、useHeroSkills仅管技能、useHeroBonds仅管羁绊、useHeroDispatch仅管派遣、useFormation仅管编队、useHeroGuide仅管引导。聚合层useHeroEngine仅63行纯组合逻辑。扣分：useFormation(251行)内含推荐算法生成，可进一步拆分 |
| **代码规范** | 8.5 | **9.0** | ↑ | 所有文件统一JSDoc注释风格，模块声明`@module`一致。文件头注释清晰描述职责。导出使用统一的index.ts barrel文件。扣分：useHeroGuide中`as unknown as`类型断言违反TypeScript最佳实践；heroNames字段为空数组属于未完成的TODO |
| **测试覆盖** | 7.0 | **7.5** | ↑ | 引擎测试519文件/231861行，密度极高。UI测试20文件/6569行/806用例。集成测试覆盖聚合Hook。扣分：6个子Hook无独立测试文件（-1.0），useHeroGuide引导关键路径无测试（-0.5），集成测试仍使用mock引擎（-0.5） |
| **可维护性** | 8.5 | **9.5** | ↑↑ | **最大进步维度**。从需要理解662行全局上下文降为按需阅读单个Hook（平均~110行）。新增功能只需新增子Hook+修改聚合层一行spread。向后兼容代理确保迁移零风险。扣分：useFormation中generateRecommendations(约120行)复杂度较高，但仍在可控范围 |
| **性能** | 8.5 | **8.5** | → | useMemo/useCallback依赖项正确。子Hook间依赖通过useMemo缓存避免不必要重计算。snapshotVersion作为统一刷新触发器。无性能回退。但也无性能优化（如useFormation的推荐算法每次调用都重新计算） |
| **扩展性** | 8.5 | **9.5** | ↑↑ | **第二大进步维度**。微内核架构使得扩展成本极低：新增子Hook（如useHeroStarUp、useHeroEquipment）只需①新建文件②聚合层加一行spread③类型定义加一个Return类型。向后兼容代理模式可复用于未来其他模块拆分。扣分：useHeroEngineParams接口耦合了所有子Hook的参数需求 |

---

## 架构详细分析

### 1. 分层架构（9.2/10）

```
┌─────────────────────────────────────────────────────────────┐
│                       UI 组件层                              │
│  HeroTab / FormationPanel / RecruitModal / GuideOverlay ... │
└──────────────────────┬──────────────────────────────────────┘
                       │ import { useHeroEngine, useHeroGuide }
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                    Hook 聚合层                               │
│                                                             │
│  ┌─────────────────┐    ┌──────────────────┐                │
│  │ useHeroEngine   │    │ useHeroGuide     │                │
│  │ (63行，纯组合)   │    │ (76行，引导桥接)  │                │
│  └────────┬────────┘    └────────┬─────────┘                │
│           │ 6路spread            │ 独立入口                  │
│  ┌────────┴──────────────────────────────────┐              │
│  │              子 Hook 层                     │              │
│  │  useHeroList  useHeroSkills  useHeroBonds  │              │
│  │  useHeroDispatch  useFormation             │              │
│  └───────────────────────────────────────────┘              │
│                                                             │
│  ┌───────────────────────────────────────────┐              │
│  │           共享基础设施层                     │              │
│  │  hero-hook.types.ts  hero-constants.ts    │              │
│  │  hero-ui.types.ts    index.ts             │              │
│  └───────────────────────────────────────────┘              │
└──────────────────────┬──────────────────────────────────────┘
                       │ engine.xxx()
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                    引擎层                                    │
│  ThreeKingdomsEngine                                        │
│  ├─ HeroSystem / BondSystem / FormationSystem               │
│  ├─ SkillUpgradeSystem / HeroDispatchSystem                 │
│  ├─ HeroStarSystem / RecruitSystem                          │
│  └─ ResourceSystem / BuildingSystem                         │
└─────────────────────────────────────────────────────────────┘
```

**优点**：
- 三层架构（UI→Hook→Engine）职责清晰，每层只依赖下一层
- Hook层内部进一步分为聚合层、子Hook层、共享基础设施层
- 层间依赖通过接口（TypeScript类型）而非实现耦合

**改进空间**：
- useHeroGuide独立于useHeroEngine聚合层之外，形成了"第二入口"。理想情况应将useHeroGuide也纳入聚合层组合，但这需要评估是否会引入不必要的重渲染

### 2. 模块依赖分析（9.0/10）

```
useHeroEngine (聚合)
  ├── useHeroList          [无外部依赖]
  ├── useHeroSkills        [无外部依赖]
  ├── useHeroBonds         [依赖 useHeroList.allGenerals, useHeroList.ownedHeroIds]
  ├── useHeroDispatch      [无外部依赖]
  ├── useFormation         [依赖 useHeroList.heroInfos]
  └── (useHeroGuide)       [独立，由HeroTab直接调用]
```

**依赖注入模式**：子Hook间的数据依赖通过`deps`参数显式注入，而非在子Hook内部直接调用其他子Hook。这是一个优秀的设计决策：

```typescript
// useHeroBonds 接收 useHeroList 的数据作为参数
const heroBonds = useHeroBonds(params, useMemo(() => ({
  allGenerals: heroList.allGenerals,
  ownedHeroIds: heroList.ownedHeroIds,
}), [heroList.allGenerals, heroList.ownedHeroIds]));
```

**优点**：
- 依赖关系显式化，一目了然
- 子Hook可独立测试（传入mock deps即可）
- 避免循环依赖

**改进空间**：
- useFormation的deps使用了`useMemo(() => ({ heroInfos }), [heroInfos])`，但对象引用在heroInfos不变时仍可能因重渲染而变化。建议使用`useRef`或自定义`useDeepMemo`

### 3. 类型系统分析（8.5/10）

**类型架构**：

```typescript
// hero-hook.types.ts — 共享类型定义
UseHeroEngineParams          // 所有子Hook共享的参数接口
UseHeroListReturn            // 各子Hook独立返回类型
UseHeroSkillsReturn
UseHeroBondsReturn
UseHeroDispatchReturn
UseFormationReturn
UseHeroEngineReturn          // 聚合返回类型 = 所有子Hook返回类型的交叉类型
```

**优点**：
- 聚合返回类型使用TypeScript交叉类型（`&`），确保类型安全
- 每个子Hook有独立的返回类型，便于按需使用
- 参数类型统一为`UseHeroEngineParams`，简化调用方

**问题**：
1. **UseHeroEngineParams过度耦合**：`selectedHeroId`仅useHeroSkills使用，`formationHeroIds`仅useHeroBonds使用，但所有子Hook都接收完整params
2. **useHeroGuide类型断言**：使用`as unknown as { recruitHero?: ... }`绕过类型检查，表明引擎类型定义不完整
3. **hero-ui.types.ts外部依赖**：子Hook依赖组件级类型（HeroBrief/HeroInfo/SkillItem等），方向为Hook→组件，应考虑将共享类型提升到hooks/目录

### 4. 向后兼容机制（9.5/10）

```typescript
// src/.../hero/useHeroEngine.ts (16行代理)
export { useHeroEngine } from './hooks/useHeroEngine';
export type { UseHeroEngineParams, UseHeroEngineReturn } from './hooks/hero-hook.types';
```

**优点**：
- 零破坏升级：所有原有import路径继续正常工作
- 代理文件仅16行，维护成本极低
- JSDoc注释明确引导新代码使用新路径
- hooks/index.ts提供barrel导出，支持按需导入子Hook

**验证**：grep确认无外部组件直接引用旧路径（HeroTab已改用`import { useHeroGuide } from './hooks'`）

### 5. 错误处理策略（7.0/10）

**现状**：所有子Hook的引擎操作均使用try-catch静默吞错：

```typescript
// 典型模式（出现在每个子Hook中）
try {
  // 引擎操作
} catch {
  // 静默处理
}
```

**问题**：
- 错误被完全吞掉，无法追踪、无法恢复、无法通知用户
- 拆分后6个子Hook各自独立catch，错误处理分散
- 无统一的错误回调机制（如`onEngineError`）
- 连续3轮标记此问题（P2-R7-1→P2-R8→R9）

**建议**：
```typescript
// 方案A：参数层注入错误回调
interface UseHeroEngineParams {
  onEngineError?: (error: Error, context: string) => void;
}

// 方案B：子Hook返回错误状态
interface UseFormationReturn {
  // ...现有字段
  lastError: Error | null;
}
```

### 6. 性能考量（8.5/10）

**现状**：
- 所有数据计算使用`useMemo`缓存，依赖`snapshotVersion`触发更新
- 子Hook间依赖通过`useMemo`包装deps对象避免不必要重计算
- 回调函数使用`useCallback`缓存

**潜在问题**：
1. **useFormation.generateRecommendations**：每次调用都重新计算3套推荐方案（排序+羁绊检测+战力计算），对于大量武将可能较慢。建议缓存结果
2. **聚合层spread合并**：`return { ...heroList, ...heroSkills, ...heroBonds, ...heroDispatch, ...formation }`每次渲染都创建新对象。如果子Hook返回值未变化，仍然会触发消费者重渲染
3. **heroInfos生成**：useHeroList中`heroInfos`和`heroBriefs`对每个武将都创建新对象，在武将数量较多时可能产生GC压力

**建议**：
```typescript
// 缓存推荐方案
const recommendationsCache = useRef<RecommendPlan[]>([]);
const generateRecommendations = useCallback(() => {
  if (recommendationsCache.current.length > 0) return recommendationsCache.current;
  // ...计算
  recommendationsCache.current = plans;
  return plans;
}, [engine, heroInfos]);
```

### 7. 扩展性评估（9.5/10）

**新增子Hook的步骤**（以useHeroStarUp为例）：

```
1. 新建 hooks/useHeroStarUp.ts (~100行)
2. 在 hero-hook.types.ts 添加 UseHeroStarUpReturn 接口
3. 在 hero-hook.types.ts 的 UseHeroEngineReturn 添加 & UseHeroStarUpReturn
4. 在 useHeroEngine.ts 添加一行: const heroStarUp = useHeroStarUp(params);
5. 在 useHeroEngine.ts return 添加: ...heroStarUp
6. 在 hooks/index.ts 添加导出
```

**扩展成本**：约30分钟（不含业务逻辑编写）

**已验证的扩展场景**：
- ✅ useHeroGuide：新增独立Hook，由HeroTab直接调用（不经过聚合层）
- ✅ hero-constants.ts：新增常量无需修改任何现有文件
- ✅ hero-hook.types.ts：新增类型无需修改现有类型定义

---

## 架构决策记录（ADR）

### ADR-001：聚合层 vs 直接导入子Hook

**决策**：保留useHeroEngine聚合层，同时支持直接导入子Hook。

**理由**：
- 聚合层保持向后兼容（R8及之前的所有代码无需修改）
- 直接导入子Hook支持按需使用（如HeroTab仅需useHeroGuide）
- 两种模式共存，调用方按需选择

**权衡**：聚合层会增加不必要的Hook调用（如只需要列表数据时也会调用useFormation），但React Hook的调用成本极低，可接受。

### ADR-002：useHeroGuide独立于聚合层

**决策**：useHeroGuide不纳入useHeroEngine聚合层组合，由HeroTab直接调用。

**理由**：
- 引导操作是HeroTab特有的需求，其他组件不需要
- 纳入聚合层会导致所有使用useHeroEngine的组件都执行引导Hook的逻辑
- 引导操作频率低（仅新手阶段），不需要随snapshotVersion刷新

**权衡**：形成了"第二入口"，打破了"所有操作都经过useHeroEngine"的一致性。但考虑到使用场景的特殊性，这是合理的权衡。

### ADR-003：依赖注入模式

**决策**：子Hook间数据依赖通过deps参数显式注入。

**理由**：
- 避免子Hook内部互相导入，保持独立性
- 依赖关系显式化，便于理解和测试
- 聚合层控制数据流向，避免循环依赖

**权衡**：聚合层代码稍显冗长（每个有依赖的子Hook都需要useMemo包装deps），但可读性收益远大于代码量成本。

---

## 代码质量审查

### 文件头注释规范性 ✅

所有9个文件均包含标准JSDoc注释，格式统一：

```typescript
/**
 * useHeroXxx — 简短描述
 *
 * 职责：
 * - 职责1
 * - 职责2
 *
 * @module components/idle/panels/hero/hooks/useHeroXxx
 */
```

### 导出规范性 ✅

hooks/index.ts提供完整的barrel导出：
- 聚合Hook：`export { useHeroEngine }`
- 子Hook：`export { useHeroList, useHeroSkills, ... }`
- 类型：`export type { UseHeroEngineParams, UseHeroEngineReturn, ... }`
- 常量：`export { QUALITY_ORDER, UPGRADE_COST_TABLE, ... }`

### 命名一致性 ✅

- Hook命名：`use` + 领域名（HeroList/HeroSkills/HeroBonds/HeroDispatch/Formation/HeroGuide）
- 类型命名：`Use` + 领域名 + `Return`/`Params`
- 常量命名：UPPER_SNAKE_CASE

### 问题清单

| # | 文件 | 行号 | 问题 | 严重度 |
|---|------|:----:|------|:-----:|
| 1 | useHeroGuide.ts | 38-41 | `as unknown as { recruitHero?: ... }` 类型断言 | 中 |
| 2 | useHeroBonds.ts | 79,97 | `heroNames: []` 始终为空数组 | 中 |
| 3 | useFormation.ts | 60-68 | `applyRecommend`中`engine.getFormationSystem().setFormation(0, validIds)`参数类型可能不匹配（数字0 vs 字符串'0'） | 低 |
| 4 | useHeroList.ts | 35 | `void snapshotVersion` 表达式无实际意义，仅用于触发依赖更新 | 低 |
| 5 | hero-hook.types.ts | 23-31 | `UseHeroEngineParams`包含所有子Hook参数（selectedHeroId仅Skills用，formationHeroIds仅Bonds用） | 低 |

---

## 改进建议（按优先级）

### 高优先级

| # | 建议 | 工作量 | 收益 |
|---|------|:------:|------|
| 1 | **子Hook独立测试** | 1~2天 | 重构信心+回归保护 |
| 2 | **useHeroGuide类型断言修复** | 0.5天 | 类型安全+代码规范 |
| 3 | **heroNames字段填充** | 0.5天 | 羁绊图鉴功能完整 |

### 中优先级

| # | 建议 | 工作量 | 收益 |
|---|------|:------:|------|
| 4 | 统一错误处理策略 | 0.5天 | 可观测性+用户体验 |
| 5 | UseHeroEngineParams拆分为子接口 | 0.5天 | 参数职责清晰 |
| 6 | useFormation推荐算法缓存 | 0.5天 | 性能优化 |
| 7 | 共享类型提升到hooks/目录 | 0.5天 | 依赖方向优化 |

### 低优先级

| # | 建议 | 工作量 | 收益 |
|---|------|:------:|------|
| 8 | void snapshotVersion改为注释说明 | 0.1天 | 代码可读性 |
| 9 | useFormation.applyRecommend参数类型统一 | 0.1天 | 类型一致性 |
| 10 | 考虑useFormation进一步拆分推荐算法 | 1天 | 单一职责极致化 |

---

## 与R8架构对比总结

| 维度 | R8架构 | R9架构 | 改善幅度 |
|------|--------|--------|:-------:|
| 最大文件行数 | 662行（巨石Hook） | 251行（useFormation） | **-62%** |
| 平均文件行数 | 662行 | ~110行 | **-83%** |
| 职责划分 | 1个Hook承担6种职责 | 6个子Hook各1种职责 | **质的飞跃** |
| 引导路径 | 双路径（Hook+直接调用） | 单路径（全部经过Hook层） | **架构一致性** |
| 向后兼容 | N/A | 16行代理+barrel导出 | **零破坏** |
| 扩展成本 | 修改662行文件 | 新增文件+1行spread | **从小时级到分钟级** |
| 测试覆盖 | 1个集成测试 | 1个集成测试（未同步拆分） | **待改善** |

---

## 结论

R9的Hook模块化拆分是一次**教科书级的重构**：

1. **拆分策略正确**：按业务领域（列表/技能/羁绊/派遣/编队/引导）拆分，而非按技术层（数据/操作/计算）拆分，使得每个子Hook都是完整的业务单元
2. **向后兼容完美**：16行代理文件+barrel导出，所有原有代码零修改
3. **引导路径统一**：useHeroGuide桥接层修复了R8的架构债务
4. **扩展性大幅提升**：新增功能从"修改巨石文件"变为"新增独立文件"

**主要风险**：测试覆盖未同步跟进。6个子Hook无独立测试，重构引入的潜在回归风险无法通过测试捕获。建议R10优先补充子Hook测试。

**总体评价**：架构从"良好"（8.4）提升至"优秀"（8.9），是武将系统架构演进的里程碑。如果R10能补齐测试覆盖并修复类型断言问题，架构评分有望突破9.0。

---

*架构审查完成 | 审查基于: hooks/(9文件/987行)全量审查 + HeroTab.tsx(引导路径) + hero-ui.types.ts(136行) + useHeroEngine.ts代理(16行) + 测试文件(20文件/6569行) | 架构评分: 8.9/10 (R8:8.4→R9:8.9, +0.5) | **R9核心成就：巨石Hook拆分为微内核架构（聚合层+子Hook）、引导路径统一修复架构债务、向后兼容零破坏升级** *
