# 武将系统游戏评测报告 (R9) — useHeroEngine 拆分重构 + 引导路径统一

> **评测日期**: 2026-04-27
> **评测版本**: HEAD + R9新增（useHeroEngine 662行→9文件/987行 + useHeroGuide桥接层 + HeroTab引导路径统一 + 向后兼容代理）
> **评测师**: 游戏评测师
> **评测依据**: PRD v1.6 + 引擎源码验证 + 迭代日志 v1.8 + R8评测报告 + hooks/(9文件/987行) + 18个UI组件源码(~5960行) + 引擎测试(519文件/~231861行) + UI测试(20文件/~6569行，含集成测试81用例)
> **评分轨迹**: R1(6.4) → R2(6.7) → R3(7.1) → R4(7.6) → R5(8.1) → R6(8.6) → R7(8.9) → R8(9.1) → R9(**9.3**)

## 综合评分: 9.3/10（+0.2，从"可交付"迈向"可维护交付"）

> **评分说明**: R9评分从9.1提升至9.3（+0.2），标志着武将系统在"架构可维护性"和"引导路径一致性"两个关键维度实现突破。
>
> **三大核心突破**：
> 1. **useHeroEngine从662行巨石拆分为9文件/987行模块化架构**：最大文件useFormation仅251行（原662行的37.9%），每个Hook职责单一。聚合层useHeroEngine仅63行，纯组合逻辑，零业务代码。拆分后代码总量从662行增至987行（+49%），但模块化收益远超行数增长——可维护性从"需要理解662行全局上下文"降为"按需阅读单个Hook（平均~100行）"。
> 2. **引导路径统一：HeroTab→useHeroGuide→Engine**：R8标记的P1-R8-2（引导操作绕过桥接层）已修复。HeroTab从直接调用`engine.recruitHero/enhanceHero/setFormation`改为通过`useHeroGuide(engine)`桥接层调用。引导操作和普通操作现在都经过Hook层，架构一致性从"双路径"恢复为"单路径"。
> 3. **向后兼容零破坏**：原`useHeroEngine.ts`路径保留为16行代理文件，重新导出hooks/目录下的聚合Hook。所有原有import路径继续正常工作。新增hooks/index.ts提供统一导出入口，支持按需导入子Hook。
>
> **但关键挑战仍在**：集成测试仍使用mock引擎（连续3轮P1）；bondCatalog.heroNames字段仍为空数组（连续3轮）；6个UI组件仍未实现（连续4轮）。

---

## 评分轨迹: R1(6.4) → R2(6.7) → R3(7.1) → R4(7.6) → R5(8.1) → R6(8.6) → R7(8.9) → R8(9.1) → R9(9.3)

```
R1 ■■■■■■□□□□ 6.4  初始评测：数值不一致+经济断裂
R2 ■■■■■■■□□□ 6.7  +0.3 文档修复，引擎零改动
R3 ■■■■■■■□□□ 7.1  +0.4 经济重构+引擎首次修改+流程文档
R4 ■■■■■■■■□□ 7.6  +0.5 P0关闭+系统联动+新手引导+数值重设计
R5 ■■■■■■■■□□ 8.1  +0.5 视觉规范+UI组件蓝图+羁绊/引导引擎澄清
R6 ■■■■■■■■■□ 8.6  +0.5 P0技术债清零+4个UI组件实现+测试体系升级
R7 ■■■■■■■■■□ 8.9  +0.3 UI-引擎端到端对接+CSS变量统一+12组羁绊完整
R8 ■■■■■■■■■■ 9.1  +0.2 老组件CSS迁移+引导引擎对接+视觉一致性99%
R9 ■■■■■■■■■■ 9.3  +0.2 Hook模块化拆分+引导路径统一+向后兼容零破坏
```

### 完整评分轨迹表

| 轮次 | 日期 | 综合评分 | 变化 | 核心事件 | 引擎改动 | UI实现 |
|:----:|:----:|:-------:|:----:|---------|:-------:|:-----:|
| R1 | 06-08 | 6.4 | — | 初始评测，发现4处P0 | — | — |
| R2 | 06-10 | 6.7 | +0.3 | 文档修复6处数值不一致 | ❌ 零改动 | — |
| R3 | 06-12 | 7.1 | +0.4 | 经济模型重构+流程文档 | ✅ 招募消耗1→5 | — |
| R4 | 06-14 | 7.6 | +0.5 | P0关闭+联动设计+引导设计 | ⚠️ 被动产出同步 | — |
| R5 | 06-16 | 8.1 | +0.5 | 视觉规范+UI蓝图+羁绊引擎澄清 | ⚠️ 羁绊/引导已有 | — |
| R6 | 04-26 | 8.6 | +0.5 | P0清零+UI组件实现+测试升级 | ✅ 等级上限+装备系数+羁绊系数 | ✅ 4新组件(1315行) |
| R7 | 06-19 | 8.9 | +0.3 | UI-引擎对接+CSS变量统一+12组羁绊 | ✅ 确认12组羁绊完整 | ✅ useHeroEngine(662行)+engineDataSource |
| R8 | 04-26 | **9.1** | +0.2 | 老组件CSS迁移+引导引擎对接+视觉99% | ❌ 零改动 | ✅ GuideOverlay引擎对接+8组件CSS迁移 |
| R9 | 04-27 | **9.3** | **+0.2** | **Hook模块化拆分+引导路径统一+向后兼容** | ❌ 零改动 | ✅ hooks/(9文件/987行)+useHeroGuide桥接 |

---

## 各维度评分对比

| 维度 | R5 | R6 | R7 | R8 | R9 | 变化 | 说明 |
|------|:--:|:--:|:--:|:--:|:--:|:----:|------|
| **核心玩法深度** | 8.3 | 8.5 | 8.7 | 8.7 | **8.7** | → | 核心玩法系统保持稳定，6乘区战力公式+12组羁绊+编队推荐体系成熟 |
| **成长曲线** | 8.2 | 8.7 | 8.7 | 8.7 | **8.7** | → | 等级上限50→100、突破路径保持稳定 |
| **资源循环** | 8.0 | 8.2 | 8.5 | 8.5 | **8.5** | → | useHeroEngine资源查询+引擎消耗表对齐，资源循环稳定 |
| **系统联动性** | 8.5 | 8.8 | 9.3 | 9.5 | **9.7** | ↑ | **引导路径统一修复架构不一致**。HeroTab引导操作从直接调用engine改为通过useHeroGuide桥接层，引导操作和普通操作现在都经过Hook层。系统联动从"双路径"升级为"单路径"，架构一致性大幅提升 |
| **新手引导** | 8.0 | 8.0 | 8.0 | 8.5 | **8.8** | ↑ | useHeroGuide作为独立Hook，引导操作逻辑从HeroTab中抽离，代码更清晰。但OVERLAY_TO_ENGINE_STEP映射不完整问题仍存在（detail/enhance映射到同一引擎步骤） |
| **长期可玩性** | 7.5 | 8.0 | 8.5 | 8.5 | **8.5** | → | 12组搭档羁绊+跨阵营组合提供丰富策略空间，保持稳定 |
| **数值平衡性** | 7.8 | 8.3 | 8.5 | 8.5 | **8.5** | → | 羁绊效果平衡设计+系数上限2.0，数值系统保持稳定 |
| **功能完整性** | 7.5 | 8.5 | 8.8 | 8.9 | **9.0** | ↑ | Hook拆分+引导桥接层补全了架构层面的"最后一块拼图"。模块化架构使得新增功能（如升星操作、装备系统）只需新增子Hook，无需修改聚合层。向后兼容代理确保零破坏升级 |
| **操作体验** | 7.0 | 8.0 | 8.5 | 8.7 | **8.8** | ↑ | 引导操作通过useHeroGuide统一管理，未来添加操作日志/错误提示/性能监控等横切关注点时，引导操作自动受益 |
| **视觉表现** | 7.5 | 7.8 | 8.3 | 9.0 | **9.0** | → | CSS变量99%完成保持稳定，R9无视觉变更 |

---

## R8问题修复验证

### ✅ 已修复

| # | R8问题 | 修复状态 | 验证详情 |
|---|--------|:-------:|---------|
| 1 | **P1-R8-2 引导操作绕过useHeroEngine桥接层** | ✅ 已修复 | HeroTab.tsx第32行`import { useHeroGuide } from './hooks'`，第148行`const { handleGuideAction } = useHeroGuide(engine)`。引导操作不再直接调用engine，而是通过useHeroGuide桥接层。useHeroGuide(76行)封装了recruit/enhance/formation/detail四种引导动作的引擎调用逻辑，HeroTab仅持有`handleGuideAction`引用，完全不感知引擎调用细节 |
| 2 | **P2-R8-3 HeroTab引导状态初始化使用localStorage** | ⚠️ 未修复 | HeroTab的showGuide初始化仍使用localStorage读取`tk-guide-progress`（连续2轮） |

### ⚠️ 未修复（R8遗留）

| # | R8问题 | 状态 | 说明 |
|---|--------|:----:|------|
| 1 | **P1-R8-1 集成测试使用mock引擎** | ❌ | 仍使用mock引擎验证数据流，缺少真实引擎端到端验证（连续3轮） |
| 2 | **P2-R7-1 useHeroEngine错误处理策略为静默吞错** | ❌ | 所有引擎操作失败仍静默处理（连续3轮）。拆分后各子Hook独立catch，但策略未变 |
| 3 | **P2-R7-2 generateRecommendations羁绊算法可优化** | ❌ | 跨阵营搭档羁绊可能被错过（连续3轮）。useFormation中算法逻辑未变 |
| 4 | **P2-R7-3 bondCatalog.heroNames字段始终为空数组** | ❌ | useHeroBonds.ts中heroNames仍为`[]`（连续3轮） |
| 5 | **P2-R7-4 剩余6个UI组件仍未实现** | ❌ | 连续4轮未实现 |
| 6 | **P2-R6-1 SkillUpgradePanel缺少技能预览功能** | ❌ | 连续4轮 |
| 7 | **P2-R6-2 HeroDispatchPanel缺少推荐武将标记** | ❌ | 连续4轮 |
| 8 | **P2-R6-3 BondCollectionPanel羁绊进度百分比** | ❌ | 连续4轮 |
| 9 | **P2-R6-4 FormationRecommendPanel缺少收藏方案** | ❌ | 连续4轮 |
| 10 | **P2-R5-1 高品质武将占位图缺乏差异化** | ❌ | 连续5轮 |
| 11 | **P2-R5-2 编队阵容保存/分享功能** | ❌ | 连续5轮 |
| 12 | **P2-R5-3 概率公示详情页未设计** | ❌ | 合规要求未满足（连续5轮） |
| 13 | **P2-R5-4 羁绊图标使用Emoji跨平台不一致** | ❌ | 连续5轮 |
| 14 | **P2-R8-2 GuideOverlay引擎步骤映射不完整** | ❌ | detail/enhance映射到同一引擎步骤（连续2轮） |
| 15 | **HER-11扩展路线图缺优先级** | ❌ | 连续7轮 |
| 16 | **经济健康度监控阈值** | ❌ | 连续7轮 |

---

## R9新发现的问题

### P0（阻塞核心玩法）

> **本轮无P0问题。** 连续4轮P0清零，核心玩法引擎层、UI-引擎对接层和视觉一致性均已稳定。

### P1（影响核心体验）

#### P1-R9-1：集成测试仍使用mock引擎，缺少真实引擎端到端验证

**问题**: `hero-engine-integration.test.tsx`（81用例/732行）仍使用mock引擎对象。R7标记此问题，R9仍未修复（连续3轮P1）。mock引擎与真实引擎存在以下差异：
- mock的`getHeroSystem().calculatePower()`返回固定值，未验证6乘区战力公式
- mock的`getBondSystem().getActiveBonds()`返回预设数据，未验证12组羁绊的实际激活逻辑
- mock的`getFormationSystem().setFormation()`仅记录调用，未验证编队约束
- useHeroGuide桥接层的引导动作未在集成测试中覆盖

**影响**: 集成测试验证了"数据流闭环"但未验证"计算正确性"和"引导操作正确性"。

**建议修复**:
1. 新增`hero-engine-e2e.test.tsx`，使用真实`ThreeKingdomsEngine`实例
2. 覆盖4个关键场景：战力计算一致性、羁绊激活准确性、编队操作约束、引导动作执行
3. 预估工作量2~3天

#### P1-R9-2：拆分子Hook缺少独立测试

**问题**: R9将useHeroEngine拆分为6个子Hook（useHeroList/useHeroSkills/useHeroBonds/useHeroDispatch/useFormation/useHeroGuide），但**没有新增任何子Hook独立测试**。当前测试结构：
- `hero-engine-integration.test.tsx`（732行）：测试聚合Hook，使用mock引擎
- 各UI组件测试（16文件）：测试组件渲染和交互
- **无子Hook独立测试**：useHeroList/useHeroSkills/useHeroBonds/useHeroDispatch/useFormation/useHeroGuide均无独立测试文件

这意味着：
- 子Hook的数据转换逻辑（如useHeroList的HeroBrief/HeroInfo生成）未独立验证
- useFormation的generateRecommendations算法（251行中最复杂的部分）无单元测试
- useHeroGuide的引导动作分发逻辑无测试覆盖
- 重构可能引入的回归风险无法通过测试捕获

**影响**: 模块化拆分提升了可维护性，但缺少测试覆盖降低了重构信心。

**建议修复**:
1. 新增`hooks/__tests__/`目录
2. 优先为useFormation（最复杂，251行）和useHeroGuide（引导关键路径）编写单元测试
3. 其余4个子Hook可复用集成测试覆盖
4. 预估工作量1~2天

### P2（锦上添花）

#### P2-R9-1：useHeroGuide中engine类型断言使用`as unknown as`

**问题**: useHeroGuide.ts中`engine`参数类型为`ThreeKingdomsEngine`，但在recruit分支中使用`(engine as unknown as { recruitHero?: ... })`进行类型断言。这表明`ThreeKingdomsEngine`类型定义中可能缺少`recruitHero`方法，或者useHeroGuide没有使用正确的引擎子系统入口。

```typescript
// useHeroGuide.ts 第38-41行
if (typeof (engine as unknown as { recruitHero?: (type: string, count: number) => unknown }).recruitHero === 'function') {
  (engine as unknown as { recruitHero: (type: string, count: number) => unknown }).recruitHero('normal', 1);
}
```

**影响**: 类型安全性降低，运行时可能出现undefined调用。

**建议修复**: 使用`engine.getRecruitSystem().recruitHero()`或为ThreeKingdomsEngine添加recruitHero方法声明。

#### P2-R9-2：heroNames字段连续3轮为空数组

**问题**: useHeroBonds.ts中羁绊图鉴的`heroNames`字段始终为空数组`[]`。阵营羁绊和搭档羁绊均未填充。搭档羁绊已有`pb.generalIds`，只需从`allGenerals`查找对应名字即可。

```typescript
// useHeroBonds.ts 第79行和第97行
heroNames: [],  // 应填充实际武将名字
```

**影响**: 羁绊图鉴UI无法展示搭档武将名字。

**建议修复**:
```typescript
heroNames: pb.generalIds.map(id => allGenerals.find(g => g.id === id)?.name ?? id),
```

---

## Hook拆分架构详解（R9新增）

### 拆分前后对比

| 指标 | R8（拆分前） | R9（拆分后） | 变化 |
|------|:----------:|:----------:|:----:|
| 文件数 | 1 | 9 (+1代理) | +9 |
| 最大文件行数 | 662 | 251 (useFormation) | -62% |
| 平均文件行数 | 662 | ~110 | -83% |
| 总代码行数 | 662 | 987 | +49% |
| 聚合层行数 | 662（全部） | 63（纯组合） | -90% |
| 类型定义行数 | 内联 | 85（独立文件） | 独立 |
| 常量定义行数 | 内联 | 59（独立文件） | 独立 |

### 文件结构

```
hooks/
├── index.ts              (38行)  统一导出入口
├── hero-hook.types.ts    (85行)  共享类型定义
├── hero-constants.ts     (59行)  共享常量
├── useHeroEngine.ts      (63行)  聚合Hook（纯组合）
├── useHeroList.ts        (83行)  武将列表数据
├── useHeroSkills.ts     (122行)  技能数据+升级操作
├── useHeroBonds.ts      (124行)  羁绊数据
├── useHeroDispatch.ts    (86行)  派遣数据+操作
├── useFormation.ts      (251行)  编队数据+推荐
└── useHeroGuide.ts       (76行)  引导操作桥接
```

### 依赖关系图

```
                    ┌──────────────────┐
                    │   useHeroEngine  │  (63行，聚合层)
                    │   (聚合Hook)      │
                    └────────┬─────────┘
                             │ 组合
          ┌──────────┬───────┼───────┬──────────┐
          ▼          ▼       ▼       ▼          ▼
   ┌────────────┐ ┌──────────┐ ┌──────────┐ ┌────────────┐ ┌──────────┐
   │useHeroList │ │useHero   │ │useHero   │ │useHero     │ │useForm   │
   │(83行)      │ │Skills    │ │Bonds     │ │Dispatch    │ │ation     │
   │            │ │(122行)   │ │(124行)   │ │(86行)      │ │(251行)   │
   └─────┬──────┘ └──────────┘ └────┬─────┘ └────────────┘ └─────┬────┘
         │                         │                           │
         │ allGenerals             │ allGenerals               │ heroInfos
         │ ownedHeroIds            │ ownedHeroIds              │
         └─────────────────────────┴───────────────────────────┘
                      (子Hook间数据依赖)

   ┌────────────┐
   │useHeroGuide│  (76行，独立Hook，由HeroTab直接调用)
   │(引导桥接)  │
   └────────────┘
```

### 向后兼容机制

```
原路径: src/.../hero/useHeroEngine.ts (16行代理)
  │
  └── export { useHeroEngine } from './hooks/useHeroEngine'
  └── export type { ... } from './hooks/hero-hook.types'
  
新路径: src/.../hero/hooks/useHeroEngine.ts (63行聚合)
  │
  ├── import { useHeroList } from './useHeroList'
  ├── import { useHeroSkills } from './useHeroSkills'
  ├── import { useHeroBonds } from './useHeroBonds'
  ├── import { useHeroDispatch } from './useHeroDispatch'
  └── import { useFormation } from './useFormation'
```

### 引导路径统一（R9修复）

```
R8（双路径）:
  普通操作: UI组件 → useHeroEngine → engine
  引导操作: GuideOverlay → HeroTab → engine（绕过useHeroEngine）❌

R9（统一路径）:
  普通操作: UI组件 → useHeroEngine → engine
  引导操作: GuideOverlay → HeroTab → useHeroGuide → engine ✅
```

---

## UI组件实现状态总览（18个组件 + 1个聚合Hook + 6个子Hook）

### 组件分类与代码量

| 分类 | 组件名 | 代码行 | CSS行 | 测试数 | 状态 |
|------|--------|:-----:|:-----:|:-----:|:----:|
| **聚合Hook** | **useHeroEngine** | **63** | — | 81(集成) | ✅ R9重构 |
| **子Hook** | useHeroList | 83 | — | — | ✅ R9拆分 |
| | useHeroSkills | 122 | — | — | ✅ R9拆分 |
| | useHeroBonds | 124 | — | — | ✅ R9拆分 |
| | useHeroDispatch | 86 | — | — | ✅ R9拆分 |
| | useFormation | 251 | — | — | ✅ R9拆分 |
| | useHeroGuide | 76 | — | — | ✅ R9新增 |
| **页面级** | HeroTab | 334 | 347 | 52 | ✅ R9引导统一 |
| | FormationPanel | 314 | 349 | — | ✅ R5 |
| **面板级** | HeroDetailModal | 445 | 388+116 | 38 | ✅ R5 |
| | RecruitModal | 368 | 427 | 112 | ✅ R5 |
| | RecruitResultModal | 193 | 334 | 83 | ✅ R5 |
| | HeroStarUpPanel | 386 | 170 | 35 | ✅ R5 |
| | HeroStarUpModal | 388 | 489+84 | 31 | ✅ R5 |
| | HeroCompareModal | 223 | 156 | — | ✅ R5 |
| | HeroUpgradePanel | 267 | 244 | 23 | ✅ R5 |
| | SkillUpgradePanel | 275 | 253 | 29 | ✅ R6 |
| | BondCollectionPanel | 452 | 214 | 23 | ✅ R6 |
| | HeroDispatchPanel | 363 | 315 | 33 | ✅ R6 |
| | FormationRecommendPanel | 458 | 237 | 42 | ✅ R6 |
| **原子级** | HeroCard | 128 | 253 | — | ✅ R5 |
| | StarDisplay | 78 | 53 | 18 | ✅ R5 |
| | AttributeBar | 138 | 89 | 30 | ✅ R5 |
| | QualityBadge | 66 | 89 | 47 | ✅ R5 |
| | ResourceCost | 123 | 109 | 80 | ✅ R5 |
| | RadarChart | 164 | — | 49 | ✅ R5 |
| | GuideOverlay | 400 | 151 | — | ✅ R5→R8 |
| **合计** | **18组件+7Hook** | **~7047** | **~4867** | **806** | — |

### 测试验证结果

| 测试类别 | 文件数 | 行数 | 用例数 | 说明 |
|---------|:-----:|:----:|:-----:|------|
| 引擎测试 | 519 | ~231861 | ~34162+ | 全量通过 |
| UI组件测试 | 16 | ~6337 | ~548 | 16个组件独立测试 |
| UI集成测试 | 1 | 732 | 81 | hero-engine-integration |
| UI原子测试 | 4 | ~791 | ~175 | AttributeBar/QualityBadge/ResourceCost/StarDisplay |
| HeroTab测试 | 1 | 352 | 52 | 含引导动作测试 |
| **UI测试合计** | **20** | **~6569** | **~806** | — |
| **总计** | **~539** | **~238430** | **~34968** | — |

---

## 设计-实现差距评估（R9更新）

### 子系统差距矩阵

| 子系统 | R8状态 | R9状态 | 变化 | 说明 |
|--------|:-----:|:-----:|:----:|------|
| 武将属性/战力 | 🟢 | 🟢 | → | 稳定 |
| 武将招募 | 🟢 | 🟢 | → | 稳定 |
| 武将升级 | 🟢 | 🟢 | → | 稳定 |
| 武将升星 | 🟡 | 🟡 | → | UI已有，Hook未包含升星操作 |
| 武将突破 | 🟢 | 🟢 | → | 稳定 |
| 等级上限联动 | 🟢 | 🟢 | → | 稳定 |
| 招贤令经济 | 🟢 | 🟢 | → | 稳定 |
| 铜钱经济 | 🟡 | 🟡 | → | 引擎已有，Hook通过resource获取 |
| 突破石经济 | 🔴 | 🔴 | → | 零实现 |
| 技能书经济 | 🔴 | 🔴 | → | 零实现 |
| 羁绊系统 | 🟢 | 🟢 | → | 12组搭档羁绊完整 |
| 新手引导 | 🟢 | 🟢 | → | useHeroGuide桥接层完成 |
| 装备系统 | 🟢 | 🟢 | → | 稳定 |
| 派驻系统 | 🟢 | 🟢 | → | 稳定 |
| 视觉设计 | 🟢 | 🟢 | → | CSS变量99%完成 |
| UI组件 | 🟢 | 🟢 | → | 18组件+7Hook |
| UI-引擎对接 | 🟢 | 🟢 | → | useHeroEngine+useHeroGuide |
| Hook架构 | 🟡 | 🟢 | ↑ | **模块化拆分完成，职责单一** |

**差距总结**: 18个子系统中12个已连接(🟢)、2个部分连接(🟡)、2个设计-实现断裂(🔴)。相比R8（11🟢+4🟡+2🔴），R9将Hook架构从🟡提升至🟢，设计-实现差距从约10%缩窄至约8%。

### 设计-实现差距趋势

```
R1: ████████████████░░░░  设计领先实现约40%
R2: █████████████████░░░  设计领先实现约50%（纯文档迭代）
R3: ████████████████░░░░  设计领先实现约40%（引擎首次修改）
R4: ██████████████████░░  设计领先实现约55%（大量新设计）
R5: ████████████████░░░░  设计领先实现约40%（羁绊/引导引擎澄清）
R6: █████████████░░░░░░░  设计领先实现约25%（P0清零+UI组件实现）
R7: ██████████░░░░░░░░░░  设计领先实现约15%（UI-引擎端到端对接）
R8: █████████░░░░░░░░░░░  设计领先实现约10%（CSS迁移+引导对接）
R9: ████████░░░░░░░░░░░░  设计领先实现约8%（Hook模块化+引导统一）
```

---

## 改进建议（按优先级）

### P0 — 无（连续4轮P0清零 🎉）

### P1 — 影响核心体验（R10优先完成）

| # | 任务 | 工作量 | 说明 |
|---|------|:------:|------|
| 1 | **真实引擎端到端测试** | 2~3天 | 新增hero-engine-e2e.test.tsx（连续3轮P1） |
| 2 | **子Hook独立测试** | 1~2天 | hooks/__tests__/，优先useFormation+useHeroGuide |
| 3 | **剩余6个UI组件实现** | 8~10天 | HeroBreakthroughPanel/BondActivateModal优先（连续4轮） |

### P2 — 提升体验（后续迭代）

| # | 任务 | 工作量 | 说明 |
|---|------|:------:|------|
| 4 | useHeroGuide类型断言修复 | 0.5天 | 移除`as unknown as`，使用正确的引擎子系统入口 |
| 5 | heroNames字段填充 | 0.5天 | 从allGenerals查找武将名字（连续3轮） |
| 6 | 残留硬编码色值清理 | 0.5天 | 添加--tk-text-primary/--tk-gradient-primary变量 |
| 7 | 引擎步骤映射完善 | 0.5天 | 为detail/enhance分配独立引擎步骤ID |
| 8 | HeroTab引导状态初始化对接引擎 | 0.5天 | showGuide初始化优先查询引擎（连续2轮） |
| 9 | useHeroEngine统一错误处理 | 0.5天 | onEngineError回调（连续3轮） |
| 10 | generateRecommendations羁绊算法优化 | 1天 | 增加"搭档羁绊优先"策略（连续3轮） |
| 11 | SkillUpgradePanel技能升级预览 | 0.5天 | 展示升级前后属性对比（连续4轮） |
| 12 | BondCollectionPanel收集进度百分比 | 0.5天 | 进度条+百分比展示（连续4轮） |
| 13 | 概率公示详情页设计+实现 | 1天 | 合规要求（连续5轮） |
| 14 | 短期武将扩展(+6名) | 2天 | HER-11路线图（连续7轮） |
| 15 | 经济健康度监控阈值 | 0.5天 | 自动化经济调节（连续7轮） |

---

## 关键发现总结

### 发现1：模块化拆分从"巨石Hook"到"微内核架构"

R9的Hook拆分采用了"聚合层+子Hook"的微内核架构模式：
- **聚合层useHeroEngine（63行）**：纯组合逻辑，零业务代码，仅负责合并6个子Hook的返回值
- **子Hook各自独立**：每个Hook职责单一（列表/技能/羁绊/派遣/编队/引导），可独立测试、独立使用
- **依赖关系清晰**：useHeroBonds依赖useHeroList的allGenerals，useFormation依赖useHeroList的heroInfos，依赖通过参数注入而非隐式引用
- **向后兼容代理**：原路径16行代理文件确保零破坏升级

这种架构使得新增功能（如升星操作Hook、装备系统Hook）只需新增子Hook文件+修改聚合层一行spread，扩展成本极低。

### 发现2：引导路径统一修复R8架构债务

R8标记的P1-R8-2（引导操作绕过桥接层）在R9通过useHeroGuide独立Hook彻底解决。修复路径：
- **R8问题**：HeroTab中`handleGuideAction`直接调用`engine.recruitHero/enhanceHero/setFormation`
- **R9修复**：HeroTab中`const { handleGuideAction } = useHeroGuide(engine)`，引导操作逻辑完全封装在useHeroGuide中
- **架构收益**：引导操作和普通操作现在都经过Hook层，未来添加横切关注点（操作日志、错误处理、性能监控）时，引导操作自动受益

### 发现3：测试覆盖与模块化不同步

R9的Hook拆分提升了代码可维护性，但测试覆盖没有同步跟进：
- 拆分前：1个集成测试文件覆盖1个聚合Hook（合理）
- 拆分后：6个子Hook+1个聚合Hook，仍只有1个集成测试文件（不足）
- 特别是最复杂的useFormation（251行，含3套推荐方案算法）无独立测试
- 建议R10优先补充子Hook测试，特别是useFormation和useHeroGuide

### 发现4：引擎测试规模爆发式增长

引擎测试从R8的491文件增长至R9的519文件（+28文件），测试行数达到231861行。这意味着引擎层每行业务代码对应约3-4行测试代码，测试密度极高。相比之下，UI层测试仅6569行（20文件），测试密度约为业务代码的0.9倍（7047行业务代码），存在明显差距。

---

## 开发阶段进度评估

| 阶段 | R8规划 | R9实际 | 完成度 | 说明 |
|------|--------|--------|:-----:|------|
| 第一阶段：技术债清理 | ✅ 完成 | ✅ 完成 | 100% | P0清零+CSS迁移+Hook拆分 |
| 第二阶段：P0核心UI | ✅ 完成 | ✅ 完成 | 100% | 18组件+7Hook+引导统一 |
| 第三阶段：P1深度玩法 | ⚠️ ~80% | ⚠️ ~85% | ~85% | Hook拆分+引导统一完成，真实引擎测试+子Hook测试未完成 |
| 第四阶段：P2完善体验 | ❌ ~15% | ❌ ~15% | ~15% | P2功能多数未开始 |

### 剩余工作量估算

| 任务 | 工作量 | 优先级 |
|------|:-----:|:-----:|
| 真实引擎端到端测试 | 2~3天 | P1 |
| 子Hook独立测试 | 1~2天 | P1 |
| 剩余6个UI组件 | 8~10天 | P1 |
| P2体验优化 | 5~7天 | P2 |
| **合计** | **16~22天** | — |

---

## R10预期评分展望

| 维度 | R9评分 | R10预期 | 改善条件 |
|------|:-----:|:------:|---------|
| 系统联动性 | 9.7 | 9.8+ | 引导步骤映射完善+HeroTab状态初始化对接引擎 |
| 新手引导 | 8.8 | 9.0+ | 引擎步骤映射完善+引导状态一致性 |
| 功能完整性 | 9.0 | 9.3+ | 剩余6个UI组件实现 |
| 操作体验 | 8.8 | 9.0+ | useHeroEngine错误处理+技能预览 |
| **综合预期** | **9.3** | **9.4~9.5** | P1任务完成可冲击9.5+ |

---

*评测完成 | 评测基于: PRD v1.6、引擎源码验证(519文件/~231861行)、UI组件源码(18组件+7Hook/~7047行+~4867行CSS)、hooks/(9文件/987行)、HeroTab.tsx(引导路径统一)、UI测试(20文件/~6569行含集成测试81用例)、R8评测报告、迭代日志v1.8 | 综合评分: 9.3/10 (R1:6.4→R2:6.7→R3:7.1→R4:7.6→R5:8.1→R6:8.6→R7:8.9→R8:9.1→R9:9.3, +0.2) | **R9核心成就：useHeroEngine巨石拆分为9文件模块化架构（-62%最大文件行数）、引导路径统一修复架构债务（useHeroGuide桥接层）、向后兼容零破坏升级（16行代理文件）** *
