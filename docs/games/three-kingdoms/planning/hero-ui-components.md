# 武将系统 UI 组件设计文档

> **版本**: 1.0 | **日期**: 2026-06-12 | **作者**: 游戏策划
> **背景**: R4 评测指出功能完整性仅 5.5/10，UI 组件层完全缺失（0/149）。本文档定义武将系统所有 UI 组件的接口规范、交互流程和状态管理，为后续开发阶段提供实现蓝图。
> **数据来源**: PRD(HER-heroes-prd.md) + UI 设计文档(04-hero-system.md) + 引擎类型(hero.types.ts / star-up.types.ts / formation-types.ts / recruit-types.ts) + 功能检查清单(hero-feature-checklist.md)

---

## 目录

1. [组件清单与层级](#1-组件清单与层级)
2. [页面级组件 Props 设计](#2-页面级组件-props-设计)
3. [面板级组件 Props 设计](#3-面板级组件-props-设计)
4. [弹窗级组件 Props 设计](#4-弹窗级组件-props-设计)
5. [原子级组件 Props 设计](#5-原子级组件-props-设计)
6. [组件间交互流程](#6-组件间交互流程)
7. [状态管理设计](#7-状态管理设计)
8. [实现优先级与里程碑](#8-实现优先级与里程碑)
9. [附录：引擎类型引用](#9-附录引擎类型引用)

---

## 1. 组件清单与层级

### 1.1 层级架构总览

```
┌─────────────────────────────────────────────────────────────────┐
│                        页面级组件 (Page)                        │
│  HeroPage · RecruitPage · FormationPage                        │
├─────────────────────────────────────────────────────────────────┤
│                        面板级组件 (Panel)                        │
│  HeroListPanel · HeroDetailPanel · HeroUpgradePanel            │
│  HeroStarUpPanel · HeroBreakthroughPanel · RecruitPanel        │
│  FormationGridPanel · BondPanel                                │
├─────────────────────────────────────────────────────────────────┤
│                        弹窗级组件 (Modal)                        │
│  RecruitResultModal · StarUpResultModal                        │
│  BreakthroughResultModal · BondActivateModal                   │
│  HeroDispatchModal · ConfirmModal                              │
├─────────────────────────────────────────────────────────────────┤
│                        原子级组件 (Atom)                         │
│  HeroCard · AttributeBar · StarDisplay · QualityBadge          │
│  ResourceCost · SkillCard · EquipmentSlot                      │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 组件清单与功能映射

| 层级 | 组件名 | 职责 | 对应 PRD | 对应功能检查项 |
|------|--------|------|----------|---------------|
| **页面** | HeroPage | 武将系统主页面（Tab 容器） | HER-1 | F10.01~F10.13 |
| **页面** | RecruitPage | 招贤馆页面 | HER-2 | F1.01~F1.14 |
| **页面** | FormationPage | 编队管理页面 | HER-6 | F6.01~F6.11 |
| **面板** | HeroListPanel | 武将列表（网格/列表切换） | HER-1 | F10.01~F10.05, F12.01~F12.08 |
| **面板** | HeroDetailPanel | 武将详情（左立绘+右信息） | HER-1 | F10.06~F10.13 |
| **面板** | HeroUpgradePanel | 升级面板（经验条+消耗+确认） | HER-3 | F2.01~F2.14 |
| **面板** | HeroStarUpPanel | 升星面板（碎片进度+属性预览） | HER-5 | F3.01~F3.12 |
| **面板** | HeroBreakthroughPanel | 突破面板（突破条件+解锁预览） | HER-3 | F4.01~F4.08 |
| **面板** | RecruitPanel | 招募面板（普通/高级/免费） | HER-2 | F1.01~F1.14 |
| **面板** | FormationGridPanel | 编队网格（前排3+后排3） | HER-6 | F6.01~F6.11 |
| **面板** | BondPanel | 羁绊面板（已激活/未激活羁绊） | HER-4 | F11.01~F11.11 |
| **弹窗** | RecruitResultModal | 招募结果弹窗（卡牌翻转动画） | HER-2 | F1.06, F14.06 |
| **弹窗** | StarUpResultModal | 升星结果弹窗（属性对比） | HER-5 | F3.05~F3.07, F14.05 |
| **弹窗** | BreakthroughResultModal | 突破结果弹窗（新技能展示） | HER-3 | F4.06~F4.08 |
| **弹窗** | BondActivateModal | 羁绊激活弹窗 | HER-4 | F11.05~F11.06 |
| **弹窗** | HeroDispatchModal | 武将派驻弹窗（建筑选择） | BLD-3 | F7.01~F7.09 |
| **弹窗** | ConfirmModal | 通用确认弹窗 | — | 通用 |
| **原子** | HeroCard | 武将卡片（品质边框+星级+等级） | HER-1 | F10.01~F10.05, F12.01~F12.03 |
| **原子** | AttributeBar | 属性条（名称+数值+进度条） | HER-1 | F10.08~F10.11 |
| **原子** | StarDisplay | 星级显示（实心/空心星） | HER-5 | F3.06 |
| **原子** | QualityBadge | 品质标签 | HER-1 | F10.12 |
| **原子** | ResourceCost | 资源消耗显示（图标+数量+是否足够） | HER-3 | F2.02, F3.05, F4.02 |
| **原子** | SkillCard | 技能卡片（图标+名称+描述+等级） | HER-4 | F5.01~F5.10 |
| **原子** | EquipmentSlot | 装备槽（空/已装备状态） | EQP-5 | F8.01~F8.03 |

### 1.3 组件总数统计

| 层级 | 数量 | 说明 |
|------|------|------|
| 页面级 | 3 | 顶层路由容器 |
| 面板级 | 8 | 功能区域容器 |
| 弹窗级 | 6 | 模态交互 |
| 原子级 | 7 | 最小可复用单元 |
| **合计** | **24** | — |

---

## 2. 页面级组件 Props 设计

### 2.1 HeroPage — 武将系统主页面

**职责**: 武将系统的顶层 Tab 容器，承载"武将列表"、"招贤馆"、"编队"三个子页面，管理 Tab 切换和全局红点聚合。

```typescript
interface HeroPageProps {
  /** 当前激活的 Tab */
  activeTab: 'heroes' | 'recruit' | 'formation';

  /** Tab 切换回调 */
  onTabChange: (tab: 'heroes' | 'recruit' | 'formation') => void;

  /** 武将 Tab 角标数据 */
  heroTabBadge: {
    /** 可升级武将数量（红色数字角标） */
    levelUpCount: number;
    /** 可升星武将数量（金色角标） */
    starUpCount: number;
  };

  /** 招贤馆 Tab 角标数据 */
  recruitTabBadge: {
    /** 是否有免费招募次数 */
    hasFreeRecruit: boolean;
  };

  /** 编队 Tab 角标数据 */
  formationTabBadge: {
    /** 当前编队是否为空 */
    isEmpty: boolean;
  };

  /** 今日待办数据 */
  todayTodos: TodayTodoItem[];

  /** 引擎引用（供子组件调用） */
  engine: ThreeKingdomsEngine;
}
```

**内部状态**:
```typescript
interface HeroPageState {
  activeTab: 'heroes' | 'recruit' | 'formation';
  selectedHeroId: string | null;
  showTodayTodoPanel: boolean;
}
```

**子组件组合**:
```
HeroPage
├── TabBar (heroes / recruit / formation)
├── TodayTodoBanner (可展开)
├── { activeTab === 'heroes'    → HeroListPanel }
├── { activeTab === 'recruit'   → RecruitPanel }
└── { activeTab === 'formation' → FormationGridPanel }
```

**对应 UI 设计**: 04-hero-system.md §1.1（PC端）、§1.2（手机端）

---

### 2.2 RecruitPage — 招贤馆页面

**职责**: 招贤馆的独立页面入口（从主城建筑或 HeroPage Tab 进入），管理招募流程和保底可视化。

```typescript
interface RecruitPageProps {
  /** 招募系统引用 */
  recruitSystem: HeroRecruitSystem;

  /** 武将系统引用（用于查询已有武将） */
  heroSystem: HeroSystem;

  /** 当前招贤令/求贤令数量 */
  resources: {
    /** 招贤榜数量 */
    recruitScrolls: number;
    /** 求贤令数量 */
    recruitTokens: number;
    /** 铜钱数量 */
    gold: number;
  };

  /** 保底进度数据 */
  pityState: PityState;

  /** UP 武将配置 */
  upHero: UpHeroState;

  /** 每日免费招募状态 */
  freeRecruitState: FreeRecruitState;

  /** 招募完成回调 */
  onRecruitComplete: (output: RecruitOutput) => void;

  /** 招募历史记录 */
  recruitHistory: RecruitHistoryEntry[];
}
```

**对应 UI 设计**: 04-hero-system.md §8.1~§8.4

---

### 2.3 FormationPage — 编队页面

**职责**: 编队管理页面，支持多编队切换、拖拽布阵、智能推荐。

```typescript
interface FormationPageProps {
  /** 编队系统引用 */
  formationSystem: HeroFormation;

  /** 武将系统引用 */
  heroSystem: HeroSystem;

  /** 羁绊系统引用 */
  bondSystem: BondSystem;

  /** 编队推荐系统引用 */
  recommendSystem: FormationRecommendSystem;

  /** 所有编队数据 */
  formations: Record<string, FormationData>;

  /** 当前活跃编队 ID */
  activeFormationId: string | null;

  /** 关卡上下文（用于智能推荐，可选） */
  stageContext?: {
    stageId: string;
    enemyTraits: string[];
    recommendedPower: number;
  };

  /** 编队变更回调 */
  onFormationChange: (formationId: string, slots: string[]) => void;

  /** 活跃编队切换回调 */
  onActiveFormationChange: (formationId: string) => void;
}
```

**对应 UI 设计**: 04-hero-system.md §9.1（PC端）、§9.2（手机端）

---

## 3. 面板级组件 Props 设计

### 3.1 HeroListPanel — 武将列表

**职责**: 展示所有已拥有武将的网格/列表视图，支持筛选、排序、一键强化、批量升级。

```typescript
interface HeroListPanelProps {
  /** 武将数据列表 */
  heroes: GeneralData[];

  /** 碎片进度数据（用于显示碎片进度条） */
  fragmentProgress: Map<string, FragmentProgress>;

  /** 红点数据（哪些武将有可操作提示） */
  badgeData: Map<string, {
    canLevelUp: boolean;
    canStarUp: boolean;
    canEquip: boolean;
  }>;

  /** 显示模式 */
  viewMode: 'grid' | 'list';

  /** 筛选条件 */
  filters: HeroListFilters;

  /** 排序规则 */
  sortBy: 'power' | 'level' | 'quality' | 'recent';

  /** 武将总数/上限 */
  heroCount: { current: number; max: number };

  /** 事件回调 */
  onHeroClick: (heroId: string) => void;
  onViewModeChange: (mode: 'grid' | 'list') => void;
  onFiltersChange: (filters: HeroListFilters) => void;
  onSortChange: (sortBy: string) => void;
  onQuickEnhanceAll: () => void;
  onBatchUpgrade: (heroIds: string[]) => void;
  onFormationClick: () => void;
}

/** 武将列表筛选条件 */
interface HeroListFilters {
  /** 阵营筛选 */
  faction: Faction | 'all';
  /** 品质筛选 */
  quality: Quality | 'all';
  /** 职业筛选 */
  role: string | 'all';
  /** 仅显示未出战 */
  onlyUndeployed: boolean;
  /** 搜索关键词 */
  searchKeyword: string;
}
```

**内部组件**:
```
HeroListPanel
├── FilterBar (阵营Tab + 稀有度下拉 + 职业下拉 + 搜索框)
├── HeroCard[] (武将卡片网格/列表)
├── BottomActionBar (一键强化全部 + 批量升级 + 编队)
└── BatchSelectOverlay (多选模式遮罩)
```

**对应 UI 设计**: 04-hero-system.md §1.1~§1.2、§2.4、§3.1~§3.4

---

### 3.2 HeroDetailPanel — 武将详情

**职责**: 展示单个武将的完整信息，包含立绘、属性、技能、装备、碎片、生平。

```typescript
interface HeroDetailPanelProps {
  /** 武将完整数据 */
  hero: GeneralData;

  /** 武将运行时状态（星级、经验等） */
  heroRuntime: {
    star: number;
    exp: number;
    expToNextLevel: number;
    levelCap: number;
    breakthroughStage: number;
  };

  /** 四维属性（含装备/科技/buff 加成） */
  stats: {
    base: GeneralStats;
    withEquipment: GeneralStats;
    withTech: GeneralStats;
    withBuffs: GeneralStats;
  };

  /** 碎片进度 */
  fragmentProgress: FragmentProgress;

  /** 已穿戴装备 */
  equipment: {
    weapon: EquipmentData | null;
    armor: EquipmentData | null;
    accessory: EquipmentData | null;
    book: EquipmentData | null;
  };

  /** 技能列表（含等级） */
  skills: SkillData[];

  /** 武将战力 */
  power: number;

  /** 是否在编队中 */
  isInFormation: boolean;

  /** 是否已派驻到建筑 */
  isDispatched: boolean;
  dispatchedBuilding?: string;

  /** 事件回调 */
  onBack: () => void;
  onQuickEnhance: () => void;
  onStarUp: () => void;
  onBreakthrough: () => void;
  onEquip: (slot: EquipmentSlotType) => void;
  onDispatch: () => void;
  onToggleFormation: (heroId: string) => void;
  onSkillClick: (skillId: string) => void;
}

/** 装备槽位类型 */
type EquipmentSlotType = 'weapon' | 'armor' | 'accessory' | 'book';
```

**内部组件**:
```
HeroDetailPanel
├── PortraitSection (立绘 + 阵营色条 + 品质边框)
├── AttributeSection
│   ├── RadarChart (PC端雷达图 260×260px)
│   └── AttributeBar[] (手机端条形图 28px/条)
├── SkillSection → SkillCard[]
├── EquipmentSection → EquipmentSlot[] ×4
├── FragmentSection (碎片进度条 + 获取途径)
├── BiographySection (生平文本)
└── ActionBar (一键强化 + 出战/休息)
```

**对应 UI 设计**: 04-hero-system.md §5.1（PC端）、§5.2（手机端）、§6.1~§6.3（属性展示）、§7.1~§7.3（碎片收集）

---

### 3.3 HeroUpgradePanel — 升级面板

**职责**: 单武将升级/一键强化操作面板，显示经验进度、消耗资源、属性变化预览。

```typescript
interface HeroUpgradePanelProps {
  /** 武将数据 */
  hero: GeneralData;

  /** 当前经验 / 升级所需经验 */
  expInfo: {
    current: number;
    toNextLevel: number;
    percentage: number;
  };

  /** 一键强化预览数据 */
  enhancePreview: {
    /** 当前等级 */
    currentLevel: number;
    /** 资源允许的目标等级 */
    targetLevel: number;
    /** 资源消耗明细 */
    costs: ResourceCostItem[];
    /** 属性变化 */
    statsDiff: {
      before: GeneralStats;
      after: GeneralStats;
    };
    /** 战力变化 */
    powerDiff: {
      before: number;
      after: number;
    };
  } | null;

  /** 当前持有资源 */
  ownedResources: {
    gold: number;
    expBooksSmall: number;
    expBooksMedium: number;
    expBooksLarge: number;
  };

  /** 是否正在执行强化 */
  isEnhancing: boolean;

  /** 事件回调 */
  onLevelUp: () => void;
  onQuickEnhance: () => void;
  onClose: () => void;
}

/** 资源消耗项 */
interface ResourceCostItem {
  /** 资源类型 */
  type: 'gold' | 'expBookSmall' | 'expBookMedium' | 'expBookLarge';
  /** 资源图标 */
  icon: string;
  /** 资源名称 */
  label: string;
  /** 需要数量 */
  required: number;
  /** 持有数量 */
  owned: number;
  /** 是否充足 */
  sufficient: boolean;
}
```

**对应 UI 设计**: 04-hero-system.md §2.1~§2.3

---

### 3.4 HeroStarUpPanel — 升星面板

**职责**: 武将升星操作面板，显示碎片进度、升星消耗、属性飞跃预览。

```typescript
interface HeroStarUpPanelProps {
  /** 武将数据 */
  hero: GeneralData;

  /** 升星预览数据（来自 HeroStarSystem.getStarUpPreview） */
  starUpPreview: StarUpPreview;

  /** 碎片进度（来自 HeroStarSystem.getFragmentProgress） */
  fragmentProgress: FragmentProgress;

  /** 当前星级 */
  currentStar: number;

  /** 最大星级 */
  maxStar: number;

  /** 碎片获取途径 */
  fragmentSources: {
    type: FragmentSource;
    label: string;
    available: boolean;
    quickJumpTarget?: string;
  }[];

  /** 事件回调 */
  onStarUp: () => void;
  onClose: () => void;
  onFragmentSourceClick: (source: FragmentSource) => void;
}
```

**内部组件**:
```
HeroStarUpPanel
├── StarDisplay (当前星级 → 目标星级)
├── FragmentProgressBar (碎片进度条，蓝/紫/金渐变)
├── ResourceCost[] (碎片消耗 + 铜钱消耗)
├── StatsDiffPreview (属性飞跃预览: before → after)
├── FragmentSourceList (获取途径快捷跳转)
└── ActionButton (升星按钮: 材料充足时金色可点击，不足时灰色禁用)
```

**对应 UI 设计**: 04-hero-system.md §7.1~§7.3

---

### 3.5 HeroBreakthroughPanel — 突破面板

**职责**: 武将突破操作面板，显示突破条件、消耗资源、解锁预览。

```typescript
interface HeroBreakthroughPanelProps {
  /** 武将数据 */
  hero: GeneralData;

  /** 突破预览数据（来自 HeroStarSystem.getBreakthroughPreview） */
  breakthroughPreview: BreakthroughPreview;

  /** 当前突破阶段 */
  currentStage: number;

  /** 突破条件检查 */
  conditions: {
    /** 等级是否达标 */
    levelMet: boolean;
    /** 碎片是否充足 */
    fragmentsMet: boolean;
    /** 铜钱是否充足 */
    goldMet: boolean;
    /** 突破石是否充足 */
    breakthroughStoneMet: boolean;
    /** 全部条件是否满足 */
    allMet: boolean;
  };

  /** 突破解锁预览 */
  unlocks: {
    /** 新等级上限 */
    newLevelCap: number;
    /** 解锁的技能（如有） */
    newSkills: SkillData[];
    /** 强化的技能（如有） */
    enhancedSkills: SkillData[];
  };

  /** 事件回调 */
  onBreakthrough: () => void;
  onClose: () => void;
}
```

**对应 UI 设计**: 04-hero-system.md §5.1（详情面板内的突破入口）

---

### 3.6 RecruitPanel — 招募面板

**职责**: 招贤馆核心交互面板，包含普通/高级招募按钮、保底进度、UP 武将展示。

```typescript
interface RecruitPanelProps {
  /** 招募系统引用 */
  recruitSystem: HeroRecruitSystem;

  /** 资源数据 */
  resources: {
    recruitScrolls: number;
    recruitTokens: number;
    gold: number;
  };

  /** 保底进度 */
  pityProgress: {
    /** 十连保底进度 */
    tenPullPity: {
      current: number;
      max: number;
      percentage: number;
    };
    /** 硬保底进度 */
    hardPity: {
      current: number;
      max: number;
      percentage: number;
    };
  };

  /** UP 武将信息 */
  upHero: {
    generalId: string | null;
    name: string;
    quality: Quality;
    upRate: number;
    description: string;
  };

  /** 每日免费招募状态 */
  freeRecruit: {
    normal: { available: boolean; usedToday: number };
    advanced: { available: boolean; usedToday: number };
  };

  /** 招募历史记录 */
  history: RecruitHistoryEntry[];

  /** 事件回调 */
  onRecruitSingle: (type: RecruitType) => void;
  onRecruitTen: () => void;
  onHistoryClick: () => void;
}
```

**内部组件**:
```
RecruitPanel
├── RecruitScene (水墨招贤台场景)
├── RecruitButton[] (普通招贤 + 高级招贤)
├── PityProgressBar (保底进度条)
├── UpHeroDisplay (UP武将展示)
└── RecruitHistoryButton (招募历史入口)
```

**对应 UI 设计**: 04-hero-system.md §8.1~§8.4

---

### 3.7 FormationGridPanel — 编队网格

**职责**: 6 人编队的网格布局（前排 3 + 后排 3），支持拖拽/点击布阵、羁绊检测、战力计算。

```typescript
interface FormationGridPanelProps {
  /** 编队数据 */
  formation: FormationData;

  /** 编队中武将的详细信息 Map<slotIndex, GeneralData | null> */
  slotHeroes: Map<number, GeneralData | null>;

  /** 编队总战力 */
  totalPower: number;

  /** 已激活的羁绊列表 */
  activeBonds: BondEffect[];

  /** 潜在羁绊提示 */
  potentialBonds: PotentialBond[];

  /** 可用武将列表（未在编队中的） */
  availableHeroes: GeneralData[];

  /** 编队索引（1/2/3） */
  formationIndex: number;

  /** 编队总数 */
  totalFormations: number;

  /** 操作模式 */
  mode: 'drag' | 'click';  // PC端拖拽 / 手机端点击

  /** 事件回调 */
  onSlotChange: (slotIndex: number, heroId: string | null) => void;
  onSwapSlots: (from: number, to: number) => void;
  onAutoFormation: () => void;
  onSmartRecommend: () => void;
  onClearFormation: () => void;
  onSaveFormation: () => void;
  onFormationSwitch: (index: number) => void;
}

/** 羁绊效果 */
interface BondEffect {
  id: string;
  name: string;
  description: string;
  bonus: Record<string, number>;  // e.g., { attack: 0.15, defense: 0 }
  icon?: string;
}

/** 潜在羁绊 */
interface PotentialBond {
  bondId: string;
  name: string;
  description: string;
  missingCount: number;  // 还差几个武将可激活
  missingHeroes: string[];  // 缺失的武将ID列表
}
```

**内部组件**:
```
FormationGridPanel
├── FormationSlot[] ×6 (前排3 + 后排3)
│   └── HeroCard (已部署时显示武将卡片)
├── BondStatus (羁绊状态摘要)
├── PowerDisplay (总战力)
├── AvailableHeroList (可用武将列表)
├── ActionBar (智能推荐 + 一键布阵 + 清空 + 保存)
└── FormationTabSwitch (编队1/2/3切换)
```

**对应 UI 设计**: 04-hero-system.md §9.1（PC端）、§9.2（手机端）、§4.1~§4.4（智能推荐）

---

### 3.8 BondPanel — 羁绊面板

**职责**: 展示当前编队已激活和未激活的羁绊列表、羁绊加成详情、潜在羁绊提示。

```typescript
interface BondPanelProps {
  /** 已激活羁绊列表 */
  activeBonds: BondEffect[];

  /** 未激活但可触发的羁绊 */
  inactiveBonds: InactiveBond[];

  /** 潜在羁绊（差 N 人可激活） */
  potentialBonds: PotentialBond[];

  /** 羁绊总加成汇总 */
  totalBonus: {
    attack: number;
    defense: number;
    intelligence: number;
    speed: number;
  };

  /** 当前编队阵营分布 */
  factionDistribution: Record<Faction, number>;

  /** 事件回调 */
  onBondClick: (bondId: string) => void;
}

/** 未激活羁绊 */
interface InactiveBond {
  id: string;
  name: string;
  description: string;
  requiredHeroes: string[];
  ownedHeroes: string[];
  missingHeroes: string[];
  bonus: Record<string, number>;
}
```

**对应 UI 设计**: 04-hero-system.md §9.1（编队界面内的羁绊区域）

---

## 4. 弹窗级组件 Props 设计

### 4.1 RecruitResultModal — 招募结果弹窗

**职责**: 展示单抽/十连招募结果，包含卡牌翻转动画、新武将/重复武将区分。

```typescript
interface RecruitResultModalProps {
  /** 是否显示 */
  visible: boolean;

  /** 招募结果列表 */
  results: RecruitResult[];

  /** 招募类型 */
  recruitType: RecruitType;

  /** 是否为十连 */
  isTenPull: boolean;

  /** 动画配置 */
  animation: {
    /** 是否播放揭示动画 */
    playReveal: boolean;
    /** 揭示动画时长（ms） */
    revealDuration: number;
    /** 最高品质（决定动画规格） */
    highestQuality: Quality;
  };

  /** 事件回调 */
  onClose: () => void;
  onHeroClick: (heroId: string) => void;
  onViewAllNewHeroes: () => void;
  onRecruitAgain: () => void;
}
```

**动画规格**（引用 04-hero-system.md §11.2）:

| 品质 | 揭示时长 | 特效 |
|------|---------|------|
| COMMON / FINE | 1000ms | 水墨云雾散开 |
| RARE | 1500ms | 蓝色光芒 + 云雾 |
| EPIC | 2000ms | 赤金光芒 + 屏幕微震 |
| LEGENDARY | 3000ms | 紫光 + 屏幕震动 + 全屏水墨 |

**对应 UI 设计**: 04-hero-system.md §8.3

---

### 4.2 StarUpResultModal — 升星结果弹窗

**职责**: 展示升星成功后的属性对比和星级变化。

```typescript
interface StarUpResultModalProps {
  /** 是否显示 */
  visible: boolean;

  /** 升星结果（来自 HeroStarSystem.starUp） */
  result: StarUpResult;

  /** 武将名称 */
  heroName: string;

  /** 武将品质 */
  quality: Quality;

  /** 动画配置 */
  animation: {
    /** 爆发特效时长 */
    burstDuration: number;  // 默认 800ms
  };

  /** 事件回调 */
  onClose: () => void;
  onViewDetail: (heroId: string) => void;
}
```

**对应 UI 设计**: 04-hero-system.md §11.2（升星爆发特效 800ms）

---

### 4.3 BreakthroughResultModal — 突破结果弹窗

**职责**: 展示突破成功后的新等级上限、解锁技能。

```typescript
interface BreakthroughResultModalProps {
  /** 是否显示 */
  visible: boolean;

  /** 突破结果（来自 HeroStarSystem.breakthrough） */
  result: BreakthroughResult;

  /** 武将名称 */
  heroName: string;

  /** 解锁内容 */
  unlocks: {
    /** 新等级上限 */
    newLevelCap: number;
    /** 新解锁的技能 */
    newSkills: SkillData[];
    /** 强化的技能 */
    enhancedSkills: SkillData[];
  };

  /** 事件回调 */
  onClose: () => void;
  onViewDetail: (heroId: string) => void;
}
```

---

### 4.4 BondActivateModal — 羁绊激活弹窗

**职责**: 编队调整后自动检测并展示新激活的羁绊。

```typescript
interface BondActivateModalProps {
  /** 是否显示 */
  visible: boolean;

  /** 激活的羁绊信息 */
  bond: BondEffect;

  /** 参与羁绊的武将列表 */
  participatingHeroes: GeneralData[];

  /** 属性加成预览 */
  bonusPreview: Record<string, number>;

  /** 事件回调 */
  onClose: () => void;
}
```

---

### 4.5 HeroDispatchModal — 武将派驻弹窗

**职责**: 选择武将派驻到建筑，显示加成预览。

```typescript
interface HeroDispatchModalProps {
  /** 是否显示 */
  visible: boolean;

  /** 武将数据 */
  hero: GeneralData;

  /** 可派驻的建筑列表 */
  availableBuildings: DispatchBuilding[];

  /** 当前已派驻的建筑（如有） */
  currentDispatch: {
    buildingId: string;
    buildingName: string;
    bonus: number;
  } | null;

  /** 加成预览 */
  bonusPreview: {
    buildingId: string;
    buildingName: string;
    currentOutput: number;
    boostedOutput: number;
    bonusPercentage: number;
  }[];

  /** 事件回调 */
  onDispatch: (buildingId: string) => void;
  onUndeploy: () => void;
  onClose: () => void;
}

/** 可派驻建筑 */
interface DispatchBuilding {
  id: string;
  name: string;
  icon: string;
  currentOutput: number;
  hasDispatchedHero: boolean;
  dispatchedHeroName?: string;
}
```

**对应功能**: hero-feature-checklist.md F7.01~F7.09

---

### 4.6 ConfirmModal — 通用确认弹窗

**职责**: 通用确认/取消弹窗，用于升级确认、升星确认、批量操作确认等场景。

```typescript
interface ConfirmModalProps {
  /** 是否显示 */
  visible: boolean;

  /** 标题 */
  title: string;

  /** 内容文本（支持 ReactNode） */
  content: string | React.ReactNode;

  /** 确认按钮文本 */
  confirmText?: string;  // 默认 "确认"

  /** 取消按钮文本 */
  cancelText?: string;  // 默认 "取消"

  /** 确认按钮是否可用 */
  confirmDisabled?: boolean;

  /** 确认按钮样式 */
  confirmVariant?: 'primary' | 'danger' | 'gold';

  /** 事件回调 */
  onConfirm: () => void;
  onCancel: () => void;
}
```

---

## 5. 原子级组件 Props 设计

### 5.1 HeroCard — 武将卡片

**职责**: 最核心的原子组件，在武将列表、编队、招募结果等多处复用。

```typescript
interface HeroCardProps {
  /** 武将 ID */
  heroId: string;

  /** 武将名称 */
  name: string;

  /** 武将品质 */
  quality: Quality;

  /** 阵营 */
  faction: Faction;

  /** 当前等级 */
  level: number;

  /** 当前星级 */
  stars: number;

  /** 战力 */
  power: number;

  /** 半身像/头像资源路径 */
  portraitUrl: string;

  /** 红点提示 */
  badge?: {
    /** 可升级红点 */
    canLevelUp: boolean;
    /** 可升星金框 */
    canStarUp: boolean;
    /** 新装备可穿戴蓝点 */
    canEquip: boolean;
  };

  /** 是否为新获得武将 */
  isNew?: boolean;

  /** 是否在编队中 */
  isInFormation?: boolean;

  /** 碎片进度（微型进度条） */
  fragmentProgress?: {
    current: number;
    required: number;
    percentage: number;
  };

  /** 卡片尺寸 */
  size: 'small' | 'medium' | 'large';
  // small: 80×60 (编队槽位)
  // medium: 160×120 (列表卡片)
  // large: 240×180 (详情页)

  /** 是否可选中（多选模式） */
  selectable?: boolean;

  /** 是否已选中 */
  selected?: boolean;

  /** 显示模式（PC/手机影响信息层级） */
  displayMode: 'pc' | 'mobile';

  /** 事件回调 */
  onClick?: (heroId: string) => void;
  onLongPress?: (heroId: string) => void;  // 手机端长按进入多选
}
```

**视觉规格**（引用 04-hero-system.md §11.1、§11.4）:

| 属性 | PC端 (medium) | 手机端 (medium) |
|------|--------------|----------------|
| 卡片尺寸 | 160×120px | 160×120px |
| 触控区域 | — | ≥160×120px |
| 品质边框 | 2px 实色边框 | 2px 实色边框 |
| 红点位置 | 右上角 | 右上角 |
| 碎片进度条 | 底部 3px | 底部 3px |
| 信息层级 | 半身像+名字+阵营色条+等级+战力 | 半身像+名字+阵营·等级+战力 |

**品质边框色**（引用 hero.types.ts QUALITY_BORDER_COLORS）:

| 品质 | 色值 | 边框样式 |
|------|------|---------|
| COMMON | #9e9e9e | 灰色实线 |
| FINE | #2196f3 | 蓝银实线 |
| RARE | #9c27b0 | 紫金实线 |
| EPIC | #f44336 | 赤金实线 |
| LEGENDARY | #ff9800 | 天命紫+流光渐变 |

**阵营色条**（引用 04-hero-system.md §11.1）:

| 阵营 | 色值 |
|------|------|
| 蜀(shu) | #E53935 |
| 魏(wei) | #1E88E5 |
| 吴(wu) | #43A047 |
| 群(qun) | #8E24AA |

---

### 5.2 AttributeBar — 属性条

**职责**: 展示单个属性值的进度条，用于武将详情页和属性对比。

```typescript
interface AttributeBarProps {
  /** 属性名称 */
  name: string;  // 武力/智力/统率/政治

  /** 当前数值 */
  value: number;

  /** 最大值（用于计算进度条宽度） */
  maxValue: number;

  /** 进度条颜色（默认使用阵营色） */
  color?: string;

  /** 显示模式 */
  displayMode: 'bar' | 'radar';
  // bar: 手机端条形图（28px/条）
  // radar: PC端雷达图（260×260px，4条轴线）

  /** 是否为最高属性（末端加★标记） */
  isHighest?: boolean;

  /** 是否可展开详细构成 */
  expandable?: boolean;

  /** 属性构成（展开时显示） */
  breakdown?: {
    base: number;
    equipment: number;
    tech: number;
    buff: number;
  };

  /** 条形高度 */
  barHeight?: number;  // 默认 28px（手机端）/ 20px（小手机 <480px）

  /** 事件回调 */
  onExpand?: () => void;
}
```

**对应 UI 设计**: 04-hero-system.md §6.1（PC端雷达图）、§6.2（手机端条形图）、§6.3（紧凑条形图）

---

### 5.3 StarDisplay — 星级显示

**职责**: 显示武将的星级（1~6星），使用实心/空心星表示。

```typescript
interface StarDisplayProps {
  /** 当前星级 */
  current: number;

  /** 最大星级 */
  max: number;  // 默认 6

  /** 显示尺寸 */
  size: 'small' | 'medium' | 'large';
  // small: 12px/星 (卡片内)
  // medium: 16px/星 (面板内)
  // large: 24px/星 (升星结果)

  /** 是否显示动画（升星时） */
  animated?: boolean;

  /** 目标星级（升星预览时显示） */
  targetStar?: number;
}
```

**视觉规则**:
- 实心星（金色 #FFD700）：已达到的星级
- 空心星（灰色 #9e9e9e）：未达到的星级
- 升星预览时：current 颗实心 + (target - current) 颗闪烁金色

---

### 5.4 QualityBadge — 品质标签

**职责**: 显示武将品质的文字标签，带品质色背景。

```typescript
interface QualityBadgeProps {
  /** 品质 */
  quality: Quality;

  /** 显示模式 */
  variant: 'text' | 'border' | 'full';
  // text: 仅文字 + 品质色文字
  // border: 品质色边框 + 文字
  // full: 品质色背景 + 白色文字

  /** 尺寸 */
  size: 'small' | 'medium';
  // small: 36×18px (卡片内)
  // medium: 56×24px (面板内)

  /** 是否显示中文名 */
  showLabel?: boolean;  // 默认 true
}
```

**品质中文名**（引用 hero.types.ts QUALITY_LABELS）:
- COMMON → "普通"
- FINE → "精良"
- RARE → "稀有"
- EPIC → "史诗"
- LEGENDARY → "传说"

---

### 5.5 ResourceCost — 资源消耗显示

**职责**: 显示操作所需的资源消耗，包含图标、数量、是否充足。

```typescript
interface ResourceCostProps {
  /** 资源类型 */
  resourceType: string;

  /** 资源图标 URL 或 emoji */
  icon: string;

  /** 资源名称 */
  label: string;

  /** 需要数量 */
  required: number;

  /** 持有数量 */
  owned: number;

  /** 是否充足 */
  sufficient: boolean;

  /** 显示模式 */
  variant: 'compact' | 'detail';
  // compact: 图标 + 数量 + ✓/✗ (一行)
  // detail: 图标 + 名称 + 需要/持有 + ✓/✗ (两行)

  /** 不足时是否显示快捷购买链接 */
  showQuickBuy?: boolean;

  /** 事件回调 */
  onQuickBuy?: (resourceType: string) => void;
}
```

**视觉规则**:
- 充足：绿色 ✓ (#4CAF50)
- 不足：红色 ✗ (#F44336) + 快捷购买链接

---

### 5.6 SkillCard — 技能卡片

**职责**: 展示单个技能的完整信息。

```typescript
interface SkillCardProps {
  /** 技能数据 */
  skill: SkillData;

  /** 技能图标 URL */
  iconUrl?: string;

  /** 技能等级上限 */
  maxLevel: number;

  /** 是否可升级 */
  canUpgrade: boolean;

  /** 升级消耗 */
  upgradeCost?: {
    gold: number;
    skillBooks: number;
  };

  /** 突破前置条件 */
  breakthroughRequired?: number;

  /** 显示模式 */
  variant: 'compact' | 'full';
  // compact: 图标 + 名称 + 等级 (卡片内)
  // full: 图标 + 名称 + 类型 + 描述 + 等级 + 升级按钮

  /** 事件回调 */
  onUpgrade?: (skillId: string) => void;
  onClick?: (skillId: string) => void;
}
```

**技能类型标签色**:

| 类型 | 标签色 | 中文名 |
|------|--------|--------|
| active | #FF9800 (橙) | 主动 |
| passive | #4CAF50 (绿) | 被动 |
| faction | #2196F3 (蓝) | 阵营 |
| awaken | #9C27B0 (紫) | 觉醒 |

---

### 5.7 EquipmentSlot — 装备槽

**职责**: 展示装备槽位的空/已装备状态。

```typescript
interface EquipmentSlotProps {
  /** 槽位类型 */
  slotType: EquipmentSlotType;

  /** 槽位标签 */
  slotLabel: string;
  // weapon → "武器"
  // armor → "防具"
  // accessory → "饰品"
  // book → "兵书"

  /** 已装备的装备数据（null 表示空槽） */
  equipment: EquipmentData | null;

  /** 是否有更好的装备可穿戴（蓝点提示） */
  hasBetterEquipment?: boolean;

  /** 槽位尺寸 */
  size: 'small' | 'medium' | 'large';
  // small: 48×48px (详情面板紧凑模式)
  // medium: 64×64px (详情面板标准模式)
  // large: 80×80px (装备管理页)

  /** 是否可交互 */
  interactive?: boolean;

  /** 事件回调 */
  onClick?: (slotType: EquipmentSlotType) => void;
  onUnequip?: (slotType: EquipmentSlotType) => void;
}

/** 装备数据（简化） */
interface EquipmentData {
  uid: string;
  name: string;
  quality: Quality;
  mainStat: { type: string; value: number };
  iconUrl?: string;
  setName?: string;
}
```

**视觉规则**:
- 空槽：虚线边框 + 槽位图标（武器剑/防具盾/饰品环/兵书卷）
- 已装备：品质色边框 + 装备图标 + 品质底色
- 蓝点：右上角蓝色圆点（#2196F3）

---

## 6. 组件间交互流程

### 6.1 主导航流程

```
┌──────────────────────────────────────────────────────────────────┐
│                         主界面入口                                │
│                   [武将系统图标 + 红点角标]                       │
└──────────────────────┬───────────────────────────────────────────┘
                       │ 点击
                       ▼
              ┌────────────────┐
              │   HeroPage     │ ← Tab容器
              │ ┌─────────────┐│
              │ │heroes|recruit││
              │ │  |formation ││
              │ └─────────────┘│
              └───┬────┬────┬──┘
                  │    │    │
     ┌────────────┘    │    └──────────────┐
     ▼                 ▼                   ▼
HeroListPanel    RecruitPanel      FormationGridPanel
```

### 6.2 武将详情流程

```
HeroListPanel
  │ 点击武将卡片
  ▼
HeroDetailPanel ←────────────────────────────────────┐
  │                                                   │
  ├──→ 点击"一键强化" → HeroUpgradePanel               │
  │      │                    │                       │
  │      │  确认升级           │ 取消                   │
  │      ▼                    ▼                       │
  │   ConfirmModal        返回详情 ←──────────────────┤
  │      │ 确认                                      │
  │      ▼                                           │
  │   执行升级 → 刷新 HeroDetailPanel ────────────────┤
  │                                                   │
  ├──→ 点击"升星" → HeroStarUpPanel                    │
  │      │                   │                        │
  │      │ 确认升星           │ 取消                    │
  │      ▼                   ▼                        │
  │   ConfirmModal         返回详情 ←─────────────────┤
  │      │ 确认                                      │
  │      ▼                                           │
  │   StarUpResultModal → 关闭 → 刷新详情 ────────────┤
  │                                                   │
  ├──→ 点击"突破" → HeroBreakthroughPanel              │
  │      │                     │                      │
  │      │ 确认突破              │ 取消                  │
  │      ▼                     ▼                      │
  │   ConfirmModal            返回详情 ←──────────────┤
  │      │ 确认                                      │
  │      ▼                                           │
  │   BreakthroughResultModal → 关闭 → 刷新详情 ──────┤
  │                                                   │
  ├──→ 点击装备槽 → EquipmentSlot 交互                  │
  │                                                   │
  └──→ 点击"派驻" → HeroDispatchModal                  │
         │                                           │
         └─ 选择建筑 → 确认派驻 → 刷新详情 ────────────┘
```

### 6.3 招募流程

```
RecruitPanel
  │
  ├──→ 点击"普通招贤" → 检查资源
  │      │ 资源充足           │ 资源不足
  │      ▼                   ▼
  │   执行招募            ConfirmModal
  │      │               "资源不足，是否前往商店？"
  │      ▼                   │
  │   RecruitResultModal     │
  │      │                   │
  │      ├── 新武将 → 显示"新!"标签 ──→ 点击"查看详情" → HeroDetailPanel
  │      │
  │      └── 重复武将 → 显示碎片转化 → 碎片飞入动画
  │
  ├──→ 点击"高级招贤" → 同上流程
  │
  ├──→ 点击"十连招贤" → 执行十连
  │      │
  │      ▼
  │   RecruitResultModal (2×5网格)
  │      │ 按品质排序，最高品质先揭示
  │      │
  │      └── 点击"一键查看新武将" → 依次展示新武将详情
  │
  └──→ 点击"招募历史" → 展示最近20条记录
```

### 6.4 编队流程

```
FormationGridPanel
  │
  ├──→ 拖拽武将到槽位 (PC) / 点击武将→点击空格 (手机)
  │      │
  │      ▼
  │   onSlotChange → HeroFormation 更新
  │      │
  │      ├──→ BondSystem.detectActiveBonds → 检测羁绊变化
  │      │      │
  │      │      ├── 新羁绊激活 → BondActivateModal
  │      │      └── 羁绊无变化 → 静默更新 BondPanel
  │      │
  │      └──→ HeroFormation.calculateFormationPower → 更新总战力
  │
  ├──→ 点击"智能推荐"
  │      │
  │      ▼
  │   FormationRecommendSystem.recommend
  │      │ 返回1~3套方案
  │      ▼
  │   推荐方案面板（每套显示：阵容+羁绊+战力+匹配度）
  │      │ 选择方案
  │      ▼
  │   自动填入编队 → 触发羁绊检测
  │
  ├──→ 点击"一键布阵"
  │      │
  │      ▼
  │   autoFormationByIds → 按战力降序自动填入
  │
  └──→ 编队切换 (1/2/3)
         │
         ▼
      setActiveFormation → 刷新编队数据
```

### 6.5 红点/今日待办流程

```
HeroBadgeSystem (引擎层聚合)
  │
  │ 聚合数据源：
  ├── HeroLevelSystem.canLevelUp → 可升级武将列表
  ├── HeroStarSystem.getFragmentProgress → 可升星武将列表
  ├── EquipmentSystem → 可穿戴装备武将列表
  └── HeroRecruitSystem → 免费招募次数
  │
  ▼
BadgeSystemState
  │
  ├──→ mainEntryRedDot → 主界面武将图标红点
  ├──→ tabLevelBadge → 武将Tab数字角标（可升级数量）
  ├──→ tabStarBadge → 武将Tab金色角标（可升星数量）
  └──→ todayTodos → 今日待办列表
       │
       ▼
TodayTodoBanner (HeroPage 顶部)
  ├── "3位武将可升级" → [一键强化] → HeroUpgradePanel
  ├── "1位武将可升星" → [去升星] → HeroStarUpPanel
  ├── "2件新装备可穿戴" → [去穿戴] → HeroDetailPanel
  └── "免费招募未使用" → [去招募] → RecruitPanel
```

### 6.6 数据流方向总结

```
┌─────────────────────────────────────────────────────────┐
│                    ThreeKingdomsEngine                   │
│  ┌────────────┐ ┌──────────────┐ ┌───────────────────┐ │
│  │ HeroSystem │ │ HeroRecruit  │ │ HeroFormation     │ │
│  │            │ │ System       │ │                   │ │
│  │ - generals │ │ - pityState  │ │ - formations      │ │
│  │ - fragments│ │ - freeRecruit│ │ - activeFormation │ │
│  └─────┬──────┘ └──────┬───────┘ └────────┬──────────┘ │
│        │               │                   │            │
│  ┌─────┴──────┐ ┌──────┴───────┐ ┌────────┴──────────┐ │
│  │ HeroLevel  │ │ HeroStar     │ │ BondSystem        │ │
│  │ System     │ │ System       │ │                   │ │
│  └─────┬──────┘ └──────┬───────┘ └────────┬──────────┘ │
│        │               │                   │            │
│  ┌─────┴──────────────┴───────────────────┴──────────┐ │
│  │              HeroBadgeSystem (聚合层)               │ │
│  └─────────────────────┬─────────────────────────────┘ │
└────────────────────────┼───────────────────────────────┘
                         │
          ┌──────────────┼──────────────────┐
          │              │                  │
          ▼              ▼                  ▼
    ┌──────────┐  ┌──────────┐  ┌──────────────────┐
    │ HeroPage │  │ UI 组件  │  │ HeroBadgeSystem  │
    │ (状态层) │→ │ (展示层) │← │ → 红点/角标/待办 │
    └──────────┘  └──────────┘  └──────────────────┘
```

---

## 7. 状态管理设计

### 7.1 全局状态定义

```typescript
/**
 * 武将系统全局 UI 状态
 *
 * 管理武将系统的所有 UI 层状态，与引擎层状态分离。
 * 引擎层负责业务逻辑和持久化，UI 层负责展示和交互状态。
 */
interface HeroUIState {
  // ─── 导航状态 ───
  /** 当前激活的 Tab */
  activeTab: 'heroes' | 'recruit' | 'formation';

  /** 当前选中的武将 ID */
  selectedHeroId: string | null;

  /** 当前查看的详情面板子视图 */
  detailSubView: 'info' | 'upgrade' | 'starUp' | 'breakthrough' | null;

  // ─── 列表状态 ───
  /** 列表显示模式 */
  viewMode: 'grid' | 'list';

  /** 筛选条件 */
  filters: HeroListFilters;

  /** 排序规则 */
  sortBy: 'power' | 'level' | 'quality' | 'recent';

  /** 是否处于批量选择模式 */
  batchMode: boolean;

  /** 批量选中的武将 ID 列表 */
  batchSelectedIds: string[];

  // ─── 编队状态 ───
  /** 当前编辑的编队 ID */
  editingFormationId: string | null;

  /** 编队中正在拖拽的武将 ID */
  draggingHeroId: string | null;

  /** 编队中选中的槽位索引（手机端点击模式） */
  selectedSlotIndex: number | null;

  // ─── 弹窗状态 ───
  /** 各弹窗的显示状态 */
  modals: {
    recruitResult: boolean;
    starUpResult: boolean;
    breakthroughResult: boolean;
    bondActivate: boolean;
    heroDispatch: boolean;
    confirm: boolean;
  };

  /** 弹窗携带的数据 */
  modalData: {
    recruitResult: RecruitOutput | null;
    starUpResult: StarUpResult | null;
    breakthroughResult: BreakthroughResult | null;
    activatedBond: BondEffect | null;
    dispatchHero: GeneralData | null;
    confirmConfig: {
      title: string;
      content: string;
      onConfirm: () => void;
    } | null;
  };

  // ─── 今日待办状态 ───
  /** 今日待办面板是否展开 */
  todayTodoExpanded: boolean;

  // ─── 引导状态 ───
  /** 新手引导当前步骤 */
  tutorialStep: number;

  /** 引导是否完成 */
  tutorialCompleted: boolean;

  // ─── 加载状态 ───
  /** 是否正在执行异步操作 */
  loading: {
    upgrading: boolean;
    starUp: boolean;
    breakthrough: boolean;
    recruiting: boolean;
  };
}
```

### 7.2 引擎层状态（已有，引用）

```typescript
/**
 * 引擎层状态 — 已在 hero.types.ts / formation-types.ts / recruit-types.ts 中定义
 * UI 层通过 ThreeKingdomsEngine 的 getter 方法读取
 */

// HeroSystem 状态（hero.types.ts HeroState）
interface HeroState {
  generals: Record<string, GeneralData>;
  fragments: Record<string, number>;
}

// HeroFormation 状态（formation-types.ts FormationState）
interface FormationState {
  formations: Record<string, FormationData>;
  activeFormationId: string | null;
}

// HeroRecruitSystem 状态（recruit-types.ts）
interface RecruitState {
  pity: PityState;
  freeRecruit: FreeRecruitState;
  upHero: UpHeroState;
  history: RecruitHistoryEntry[];
}

// HeroBadgeSystem 状态（HeroBadgeSystem.ts BadgeSystemState）
interface BadgeSystemState {
  mainEntryRedDot: boolean;
  tabLevelBadge: number;
  tabStarBadge: number;
  todayTodos: TodayTodoItem[];
}
```

### 7.3 状态更新 Actions

```typescript
/**
 * UI 状态更新动作定义
 */
type HeroUIAction =
  // ─── 导航 ───
  | { type: 'SET_ACTIVE_TAB'; tab: 'heroes' | 'recruit' | 'formation' }
  | { type: 'SELECT_HERO'; heroId: string | null }
  | { type: 'SET_DETAIL_SUB_VIEW'; subView: HeroUIState['detailSubView'] }

  // ─── 列表 ───
  | { type: 'SET_VIEW_MODE'; mode: 'grid' | 'list' }
  | { type: 'SET_FILTERS'; filters: Partial<HeroListFilters> }
  | { type: 'SET_SORT'; sortBy: HeroUIState['sortBy'] }
  | { type: 'TOGGLE_BATCH_MODE' }
  | { type: 'BATCH_SELECT'; heroIds: string[] }
  | { type: 'BATCH_DESELECT'; heroIds: string[] }
  | { type: 'BATCH_SELECT_ALL' }
  | { type: 'BATCH_CLEAR' }

  // ─── 编队 ───
  | { type: 'EDIT_FORMATION'; formationId: string }
  | { type: 'SET_DRAGGING_HERO'; heroId: string | null }
  | { type: 'SELECT_SLOT'; index: number | null }

  // ─── 弹窗 ───
  | { type: 'SHOW_MODAL'; modal: keyof HeroUIState['modals']; data?: any }
  | { type: 'HIDE_MODAL'; modal: keyof HeroUIState['modals'] }

  // ─── 今日待办 ───
  | { type: 'TOGGLE_TODAY_TODO' }

  // ─── 引导 ───
  | { type: 'SET_TUTORIAL_STEP'; step: number }
  | { type: 'COMPLETE_TUTORIAL' }

  // ─── 加载 ───
  | { type: 'SET_LOADING'; key: keyof HeroUIState['loading']; value: boolean };
```

### 7.4 状态管理架构

```
┌─────────────────────────────────────────────────────┐
│                   UI 状态管理层                       │
│  ┌─────────────────────────────────────────────┐    │
│  │           HeroUIState (全局 UI 状态)          │    │
│  │  - activeTab / selectedHeroId / modals / ... │    │
│  └──────────────────┬──────────────────────────┘    │
│                     │ dispatch(HeroUIAction)          │
│  ┌──────────────────▼──────────────────────────┐    │
│  │           HeroUIReducer (纯函数)              │    │
│  └──────────────────┬──────────────────────────┘    │
│                     │                                │
│  ┌──────────────────▼──────────────────────────┐    │
│  │         UI 组件 (订阅状态变化)                 │    │
│  │  HeroPage / HeroListPanel / HeroDetailPanel  │    │
│  └──────────────────┬──────────────────────────┘    │
│                     │ 用户操作                        │
└─────────────────────┼───────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────┐
│                   引擎层 (业务逻辑)                    │
│  ┌─────────────────────────────────────────────┐    │
│  │         ThreeKingdomsEngine                   │    │
│  │  ├── HeroSystem (武将CRUD/战力计算)           │    │
│  │  ├── HeroLevelSystem (升级/强化)              │    │
│  │  ├── HeroStarSystem (升星/突破)               │    │
│  │  ├── HeroRecruitSystem (招募/保底)            │    │
│  │  ├── HeroFormation (编队管理)                 │    │
│  │  ├── BondSystem (羁绊检测)                    │    │
│  │  ├── HeroDispatchSystem (派驻)                │    │
│  │  └── HeroBadgeSystem (红点聚合)               │    │
│  └─────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
```

**关键原则**:
1. **单向数据流**: UI 组件 → dispatch Action → Reducer → 新状态 → UI 更新
2. **引擎层不感知 UI**: 引擎方法返回数据，UI 层负责展示
3. **UI 状态与引擎状态分离**: UI 状态（弹窗/选中/筛选）不持久化；引擎状态（武将/编队/保底）序列化存档
4. **事件驱动更新**: 引擎操作完成后，通过事件通知 UI 层刷新

---

## 8. 实现优先级与里程碑

### 8.1 优先级定义

| 级别 | 含义 | 标准 |
|------|------|------|
| **P0** | 核心流程 | 无此组件则武将系统无法使用 |
| **P1** | 深度玩法 | 缺失影响体验但不阻塞核心流程 |
| **P2** | 完善体验 | 锦上添花，可延后实现 |

### 8.2 P0 — 核心流程（必须实现）

**目标**: 武将系统的最小可用闭环 — 查看武将 → 升级 → 招募 → 编队

| # | 组件 | 依赖组件 | 预估工作量 | 说明 |
|---|------|---------|-----------|------|
| 1 | **HeroCard** | QualityBadge, StarDisplay | 2d | 最核心原子组件，所有列表/编队都依赖 |
| 2 | **QualityBadge** | — | 0.5d | HeroCard 内嵌 |
| 3 | **StarDisplay** | — | 0.5d | HeroCard 内嵌 |
| 4 | **ResourceCost** | — | 1d | 升级/升星/突破都依赖 |
| 5 | **HeroListPanel** | HeroCard | 3d | 武将列表+筛选+排序 |
| 6 | **HeroDetailPanel** | AttributeBar, SkillCard, EquipmentSlot | 5d | 武将详情全貌 |
| 7 | **AttributeBar** | — | 1d | 属性展示（手机端条形图优先） |
| 8 | **HeroUpgradePanel** | ResourceCost | 2d | 一键强化/单次升级 |
| 9 | **ConfirmModal** | — | 1d | 通用确认弹窗 |
| 10 | **RecruitPanel** | — | 3d | 招贤馆核心交互 |
| 11 | **RecruitResultModal** | HeroCard | 2d | 招募结果展示+动画 |
| 12 | **HeroPage** | 上述所有 | 2d | Tab 容器+路由 |

**P0 合计**: 12 个组件，约 23 个工作日

**P0 闭环验证**:
```
玩家可以:
1. 在 HeroListPanel 浏览武将 → 点击进入 HeroDetailPanel
2. 在 HeroDetailPanel 查看属性/技能/装备
3. 在 HeroUpgradePanel 一键强化武将
4. 在 RecruitPanel 招募新武将
5. 在 RecruitResultModal 查看招募结果
```

### 8.3 P1 — 深度玩法（第二批实现）

**目标**: 完善武将养成深度 — 升星、突破、编队、羁绊

| # | 组件 | 依赖组件 | 预估工作量 | 说明 |
|---|------|---------|-----------|------|
| 1 | **HeroStarUpPanel** | ResourceCost, StarDisplay | 2d | 升星面板+碎片进度 |
| 2 | **StarUpResultModal** | StarDisplay | 1d | 升星结果+属性对比 |
| 3 | **HeroBreakthroughPanel** | ResourceCost | 2d | 突破面板+解锁预览 |
| 4 | **BreakthroughResultModal** | SkillCard | 1.5d | 突破结果+新技能展示 |
| 5 | **FormationGridPanel** | HeroCard, BondPanel | 4d | 编队网格+拖拽/点击 |
| 6 | **BondPanel** | — | 2d | 羁绊列表+加成详情 |
| 7 | **BondActivateModal** | — | 1d | 羁绊激活弹窗 |
| 8 | **SkillCard** | — | 1.5d | 技能卡片（P0 简化版，P1 完整版） |
| 9 | **FormationPage** | FormationGridPanel | 2d | 编队管理页面 |

**P1 合计**: 9 个组件，约 17 个工作日

### 8.4 P2 — 完善体验（第三批实现）

**目标**: 体验打磨 — 派驻、装备交互、动画效果

| # | 组件 | 依赖组件 | 预估工作量 | 说明 |
|---|------|---------|-----------|------|
| 1 | **HeroDispatchModal** | ResourceCost | 2d | 武将派驻弹窗 |
| 2 | **EquipmentSlot** | QualityBadge | 1.5d | 装备槽完整交互 |
| 3 | **RecruitPage** | RecruitPanel | 1d | 招贤馆独立页面 |
| 4 | 动画效果 | — | 3d | 全部 8 种动画（§11.2） |
| 5 | 红点角标系统 | HeroBadgeSystem | 2d | 红点/角标/今日待办 |
| 6 | PC端雷达图 | AttributeBar | 2d | 四维属性雷达图（260×260px） |
| 7 | 属性对比功能 | AttributeBar | 1.5d | 武将属性叠加对比 |
| 8 | 新手引导 | — | 3d | 武将系统引导流程 |

**P2 合计**: 8 项任务，约 16 个工作日

### 8.5 里程碑时间线

```
Week 1-3: P0 核心流程 (12 组件)
  ├── Week 1: HeroCard + QualityBadge + StarDisplay + ResourceCost + AttributeBar
  ├── Week 2: HeroListPanel + HeroDetailPanel + ConfirmModal
  └── Week 3: HeroUpgradePanel + RecruitPanel + RecruitResultModal + HeroPage

Week 4-6: P1 深度玩法 (9 组件)
  ├── Week 4: HeroStarUpPanel + StarUpResultModal + SkillCard
  ├── Week 5: HeroBreakthroughPanel + BreakthroughResultModal + BondPanel + BondActivateModal
  └── Week 6: FormationGridPanel + FormationPage

Week 7-9: P2 完善体验 (8 项)
  ├── Week 7: HeroDispatchModal + EquipmentSlot + RecruitPage
  ├── Week 8: 动画效果 + 红点角标系统
  └── Week 9: PC端雷达图 + 属性对比 + 新手引导

总计: 约 56 个工作日（~9 周）
```

---

## 9. 附录：引擎类型引用

### 9.1 引擎类型 → UI Props 映射表

| 引擎类型 | 文件 | UI 组件引用 |
|---------|------|-----------|
| `Quality` | hero.types.ts | HeroCard, QualityBadge, SkillCard, EquipmentSlot |
| `Faction` | shared/types.ts | HeroCard, HeroListPanel, FormationGridPanel |
| `GeneralStats` | shared/types.ts | AttributeBar, HeroUpgradePanel, HeroStarUpPanel |
| `GeneralData` | hero.types.ts | HeroCard, HeroDetailPanel, HeroDispatchModal |
| `SkillData` | hero.types.ts | SkillCard, HeroDetailPanel |
| `SkillType` | hero.types.ts | SkillCard |
| `HeroState` | hero.types.ts | 状态管理 |
| `FormationData` | formation-types.ts | FormationGridPanel, FormationPage |
| `FormationState` | formation-types.ts | 状态管理 |
| `StarUpPreview` | star-up.types.ts | HeroStarUpPanel |
| `StarUpResult` | star-up.types.ts | StarUpResultModal |
| `FragmentProgress` | star-up.types.ts | HeroCard, HeroStarUpPanel, HeroDetailPanel |
| `BreakthroughTier` | star-up.types.ts | HeroBreakthroughPanel |
| `BreakthroughResult` | star-up.types.ts | BreakthroughResultModal |
| `BreakthroughPreview` | star-up.types.ts | HeroBreakthroughPanel |
| `FragmentSource` | star-up.types.ts | HeroStarUpPanel |
| `RecruitResult` | recruit-types.ts | RecruitResultModal |
| `RecruitOutput` | recruit-types.ts | RecruitResultModal |
| `PityState` | recruit-types.ts | RecruitPanel |
| `FreeRecruitState` | recruit-types.ts | RecruitPanel |
| `UpHeroState` | recruit-types.ts | RecruitPanel |
| `TodayTodoItem` | HeroBadgeSystem.ts | HeroPage, TodayTodoBanner |
| `BadgeSystemState` | HeroBadgeSystem.ts | HeroPage, HeroListPanel |

### 9.2 引擎方法 → UI 操作映射表

| UI 操作 | 引擎方法 | 文件 |
|---------|---------|------|
| 获取所有武将 | `HeroSystem.getAllGenerals()` | HeroSystem.ts |
| 获取单个武将 | `HeroSystem.getGeneral(id)` | HeroSystem.ts |
| 按阵营筛选 | `HeroSystem.getGeneralsByFaction(faction)` | HeroSystem.ts |
| 按品质筛选 | `HeroSystem.getGeneralsByQuality(quality)` | HeroSystem.ts |
| 按战力排序 | `HeroSystem.getGeneralsSortedByPower()` | HeroSystem.ts |
| 计算战力 | `HeroSystem.calculatePower(id)` | HeroSystem.ts |
| 单次升级 | `HeroLevelSystem.levelUp(id)` | HeroLevelSystem.ts |
| 一键强化 | `HeroLevelSystem.quickEnhance(id)` | HeroLevelSystem.ts |
| 一键强化全部 | `HeroLevelSystem.quickEnhanceAll()` | HeroLevelSystem.ts |
| 强化预览 | `HeroLevelSystem.getEnhancePreview(id)` | HeroLevelSystem.ts |
| 批量升级 | `HeroLevelSystem.batchUpgrade(ids)` | HeroLevelSystem.ts |
| 是否可升级 | `HeroLevelSystem.canLevelUp(id)` | HeroLevelSystem.ts |
| 升星 | `HeroStarSystem.starUp(id)` | HeroStarSystem.ts |
| 升星预览 | `HeroStarSystem.getStarUpPreview(id)` | HeroStarSystem.ts |
| 碎片进度 | `HeroStarSystem.getFragmentProgress(id)` | HeroStarSystem.ts |
| 突破 | `HeroStarSystem.breakthrough(id)` | HeroStarSystem.ts |
| 突破预览 | `HeroStarSystem.getBreakthroughPreview(id)` | HeroStarSystem.ts |
| 单抽 | `HeroRecruitSystem.recruitSingle(type)` | HeroRecruitSystem.ts |
| 十连 | `HeroRecruitSystem.recruitTen()` | HeroRecruitSystem.ts |
| 每日免费 | `HeroRecruitSystem.freeRecruitSingle()` | HeroRecruitSystem.ts |
| 招募历史 | `HeroRecruitSystem.getRecruitHistory()` | HeroRecruitSystem.ts |
| 创建编队 | `HeroFormation.createFormation()` | HeroFormation.ts |
| 编辑编队 | `HeroFormation.setFormationSlot(formationId, slot, heroId)` | HeroFormation.ts |
| 活跃编队 | `HeroFormation.setActiveFormation(id)` | HeroFormation.ts |
| 编队战力 | `HeroFormation.calculateFormationPower(id)` | HeroFormation.ts |
| 一键布阵 | `HeroFormation.autoFormationByIds(ids)` | HeroFormation.ts |
| 智能推荐 | `FormationRecommendSystem.recommend(context)` | FormationRecommendSystem.ts |
| 羁绊检测 | `BondSystem.detectActiveBonds(heroIds)` | BondSystem.ts |
| 潜在羁绊 | `BondSystem.getPotentialBonds(heroIds)` | BondSystem.ts |
| 派驻武将 | `HeroDispatchSystem.dispatchHero(heroId, buildingId)` | HeroDispatchSystem.ts |
| 取消派驻 | `HeroDispatchSystem.undeployHero(heroId)` | HeroDispatchSystem.ts |
| 红点聚合 | `HeroBadgeSystem.getBadgeState()` | HeroBadgeSystem.ts |
| 今日待办 | `HeroBadgeSystem.getTodayTodos()` | HeroBadgeSystem.ts |

---

> **文档结束**
> 本文档定义了武将系统 24 个 UI 组件的完整规范。所有 Props 接口均对齐引擎层类型定义，交互流程覆盖 PRD 全部功能点。开发团队可按 P0→P1→P2 优先级逐步实现。
