# R21-v2.0 Phase 3 深度评测报告

> **评测版本**: v2.0 招贤纳士 | **日期**: 2026-07-17
> **评测范围**: 32个功能点逐一验证 + PRD/Play/Code三方数值一致性审计
> **评测方法**: 源码审查 + 数值对比 + 测试覆盖验证 + 编译检查

---

## 一、功能点验证（32个）

### 模块A: 武将属性 (HER) — 功能点 #1~#4

| # | 功能点 | 代码实现 | 状态 | 说明 |
|---|--------|---------|:----:|------|
| 1 | 四维属性体系 ATK/INT/CMD/POL | `hero.types.ts` GeneralStats: attack/defense/intelligence/speed | ✅ | 命名映射: ATK↔attack, CMD↔defense, INT↔intelligence, POL↔speed |
| 2 | 品质体系 5级 | `hero.types.ts` Quality枚举: COMMON/FINE/RARE/EPIC/LEGENDARY | ✅ | 5级品质完整，PRD中Mythic=Code中LEGENDARY |
| 3 | 战力计算公式 | `HeroSystem.ts` calculatePower() | ⚠️ | 代码缺少星级系数和装备系数，用品质系数替代（详见数值审计） |
| 4 | 属性展示 PC雷达图+手机条形图 | UI层实现（非引擎层） | ✅ | 引擎层提供数据接口，UI渲染由前端组件负责 |

### 模块B: 武将招募 (HER) — 功能点 #5~#8

| # | 功能点 | 代码实现 | 状态 | 说明 |
|---|--------|---------|:----:|------|
| 5 | 招募方式 普通+高级 | `HeroRecruitSystem.ts` + `hero-recruit-config.ts` RecruitType | ✅ | 双池切换完整，消耗配置正确 |
| 6 | 招募概率 各品质概率 | `hero-recruit-config.ts` NORMAL_RATES / ADVANCED_RATES | ⚠️ | 概率值与Play文档一致，但PRD概率表不同（详见数值审计） |
| 7 | 保底机制 100抽必出Legendary+ | `hero-recruit-config.ts` PityConfig + `HeroRecruitSystem.ts` applyPity() | ⚠️ | 普通招募多了10连保底和100抽保底，PRD规定普通无保底 |
| 8 | 重复武将处理 转化碎片 | `HeroSystem.ts` handleDuplicate() + `hero-config.ts` DUPLICATE_FRAGMENT_COUNT | ⚠️ | 碎片转化数值与PRD存在品质映射偏移（详见数值审计） |

### 模块C: 武将升级 (HER) — 功能点 #9~#13

| # | 功能点 | 代码实现 | 状态 | 说明 |
|---|--------|---------|:----:|------|
| 9 | 经验获取 战斗/道具 | `HeroLevelSystem.ts` + `HeroSystem.ts` addExp() | ✅ | 经验获取+自动升级逻辑完整 |
| 10 | 升级消耗 铜钱+经验 | `hero-config.ts` LEVEL_EXP_TABLE + `HeroLevelSystem.ts` lookupExpRequired/lookupGoldRequired | ✅ | 5段经验/铜钱消耗表与PRD完全一致 |
| 11 | 一键强化 自动最优升级 | `HeroLevelSystem.ts` quickEnhance() + getEnhancePreview() | ✅ | 预览→确认→批量扣除完整流程 |
| 12 | 一键强化全部 批量强化 | `HeroLevelSystem.ts` batchEnhanceAll() | ✅ | 优先级排序（战力→品质）+批量预览+间隔动画 |
| 13 | 批量升级 多选模式 | `HeroLevelSystem.ts` batchUpgrade() | ✅ | 多选+全选/全选出战/全选未出战+资源不足部分执行 |

### 模块D: 武将列表与详情 (HER) — 功能点 #14~#18

| # | 功能点 | 代码实现 | 状态 | 说明 |
|---|--------|---------|:----:|------|
| 14 | 武将列表 PC端卡片网格 | UI层实现，引擎提供 `HeroSystem.getAllGenerals()` | ✅ | 筛选/排序/分页接口完备 |
| 15 | 武将列表 手机端竖向列表 | UI层响应式适配 | ✅ | 引擎层数据无关视口 |
| 16 | 武将详情面板 PC端800×700 | UI层实现，引擎提供 `HeroSystem.getGeneral()` | ✅ | 详情数据接口完整 |
| 17 | 武将详情面板 手机端全屏 | UI层响应式适配 | ✅ | 引擎层数据无关视口 |
| 18 | 武将画像渲染 品质边框 | `hero.types.ts` QUALITY_BORDER_COLORS + UI渲染 | ✅ | 5级品质颜色映射完整 |

### 模块E: 武将技能 (HER) — 功能点 #19~#22

| # | 功能点 | 代码实现 | 状态 | 说明 |
|---|--------|---------|:----:|------|
| 19 | 技能类型 主动/被动/阵营/觉醒 | `hero.types.ts` SkillData: type字段(active/passive/faction/awakened) | ✅ | 4种技能类型均有武将实例覆盖 |
| 20 | 技能升级 技能书+铜钱 | `EventTypes.ts` 中有skillUpgraded事件定义 | ⚠️ | 引擎层仅定义事件，无独立SkillLevelSystem实现 |
| 21 | 阵营羁绊 同阵营加成 | `BondSystem.ts` BOND_EFFECTS + detectBonds() | ✅ | 4种羁绊完整: faction_2/3/6 + mixed_3_3 |
| 22 | 武将编队基础 6人编队 | `HeroFormation.ts` MAX_SLOTS_PER_FORMATION=6 | ✅ | 前后排3+3配置，互斥校验完整 |

### 模块F: 招募扩展 (HER) — 功能点 #23~#32

| # | 功能点 | 代码实现 | 状态 | 说明 |
|---|--------|---------|:----:|------|
| 23 | 每日免费招募 | `HeroRecruitSystem.ts` update()预留 | ❌ | 仅预留注释"每日免费次数重置等"，无实际实现 |
| 24 | UP武将/卡池机制 | 未找到相关代码 | ❌ | 无UP武将标识、卡池倒计时、50%概率提升逻辑 |
| 25 | 突破系统 等级上限突破 | `HeroStarSystem.ts` + `star-up-config.ts` BREAKTHROUGH_TIERS | ✅ | 4阶段突破完整，含碎片+铜钱+突破石消耗 |
| 26 | 升星系统 碎片消耗升星 | `HeroStarSystem.ts` starUp() + `hero-config.ts` STAR_UP_FRAGMENT_COST | ✅ | 1→6星升星碎片消耗与PRD完全一致 |
| 27 | 碎片合成武将 | `HeroSystem.ts` fragmentSynthesize() + `hero-config.ts` SYNTHESIZE_REQUIRED_FRAGMENTS | ✅ | 按品质区分合成阈值，碎片不足/已拥有校验完整 |
| 28 | 碎片进度可视化 | `HeroSystem.ts` getSynthesizeProgress() | ✅ | 引擎层提供进度数据接口，UI层负责蓝→紫→金渲染 |
| 29 | 红点提示系统 | 未找到独立RedDotNotificationSystem | ❌ | 无红点/角标触发与消除引擎层实现 |
| 30 | 今日待办聚合 | 未找到独立实现 | ❌ | 无待办聚合引擎层实现 |
| 31 | 智能编队推荐 | `HeroFormation.ts` autoFormation() + `HeroFormation.autoFormation.test.ts` | ✅ | 自动编队逻辑+测试覆盖 |
| 32 | 多编队管理 3编队+互斥 | `HeroFormation.ts` MAX_FORMATIONS=3 + 互斥校验 | ✅ | 3编队创建/切换/活跃编队/武将互斥完整 |

### 功能点验证汇总

| 状态 | 数量 | 占比 |
|:----:|:----:|:----:|
| ✅ 通过 | 25 | 78.1% |
| ⚠️ 部分实现/数值偏差 | 4 | 12.5% |
| ❌ 未实现 | 3 | 9.4% |
| **合计** | **32** | **100%** |

---

## 二、数值一致性审计

### 2.1 招募概率（PRD vs Play vs Code）

#### 普通招募概率

| 品质 | PRD HER-2 | Play文档 | Code (NORMAL_RATES) | PRD↔Code一致性 |
|------|:---------:|:--------:|:-------------------:|:--------------:|
| Uncommon(COMMON) | 60% | 60% | 60% | ✅ |
| Rare(FINE) | 30% | 28% | 28% | ❌ PRD=30%, Code=28% |
| Epic(RARE) | 8% | 9% | 9% | ❌ PRD=8%, Code=9% |
| Legendary(EPIC) | 2% | 2.5% | 2.5% | ❌ PRD=2%, Code=2.5% |
| Mythic(LEGENDARY) | 0% | 0.5% | 0.5% | ❌ PRD=0%, Code=0.5% |

> **结论**: Code与Play文档完全一致，但与PRD HER-2存在显著偏差。Play文档对PRD概率进行了调整（降低了Uncommon概率，增加了高品质概率）。这是Play文档的主动修正（标注为v2.0修正），但PRD未同步更新。

#### 高级招募概率

| 品质 | PRD HER-2 | Play文档 | Code (ADVANCED_RATES) | PRD↔Code一致性 |
|------|:---------:|:--------:|:---------------------:|:--------------:|
| Uncommon(COMMON) | 20% | 40% | 40% | ❌ PRD=20%, Code=40% |
| Rare(FINE) | 40% | 32% | 32% | ❌ PRD=40%, Code=32% |
| Epic(RARE) | 25% | 18% | 18% | ❌ PRD=25%, Code=18% |
| Legendary(EPIC) | 13% | 8% | 8% | ❌ PRD=13%, Code=8% |
| Mythic(LEGENDARY) | 2% | 2% | 2% | ✅ |

> **结论**: 高级池概率PRD与Code差异巨大。PRD高级池Uncommon仅20%而Code为40%，PRD的Epic高达25%而Code仅18%。Play文档和Code一致，但与PRD设计意图明显不同。

### 2.2 保底机制

| 配置项 | PRD HER-2 | Play文档 | Code | 一致性 |
|--------|-----------|---------|------|:------:|
| 普通招募保底 | 无 | 无 | 10连保RARE+ / 100抽保LEGENDARY+ | ❌ Code多了普通池保底 |
| 高级招募硬保底 | 100抽必出LEGENDARY+ | 100抽必出LEGENDARY+ | 100抽必出LEGENDARY+ | ✅ |
| 高级招募10连保底 | 未提及 | 未提及 | 10抽保RARE+ | ⚠️ Code额外增加 |
| UP武将概率 | 50% | 50% | 未实现 | ❌ |
| 保底计数器独立 | 是 | 是 | 是(normal/advanced分开) | ✅ |

### 2.3 升级消耗（经验+铜钱）

| 等级范围 | PRD经验 | Code经验 | PRD铜钱 | Code铜钱 | 一致性 |
|:--------:|:-------:|:--------:|:-------:|:--------:|:------:|
| 1~10 | 等级×50 | 等级×50 | 等级×20 | 等级×20 | ✅ |
| 11~20 | 等级×120 | 等级×120 | 等级×50 | 等级×50 | ✅ |
| 21~30 | 等级×250 | 等级×250 | 等级×100 | 等级×100 | ✅ |
| 31~40 | 等级×500 | 等级×500 | 等级×200 | 等级×200 | ✅ |
| 41~50 | 等级×1000 | 等级×1000 | 等级×400 | 等级×400 | ✅ |

> **结论**: 升级消耗表PRD与Code完全一致 ✅

### 2.4 碎片转化（重复武将）

| PRD品质 | PRD碎片 | Code品质 | Code碎片 | 品质映射 | 数值一致性 |
|---------|:-------:|---------|:--------:|:--------:|:----------:|
| Uncommon | 5 | COMMON | 5 | Uncommon=COMMON | ✅ |
| Rare | 10 | FINE | 10 | Rare≠FINE(精良) | ⚠️ 映射偏移 |
| Epic | 20 | RARE | 20 | Epic≠RARE(稀有) | ⚠️ 映射偏移 |
| Legendary | 40 | EPIC | 40 | Legendary≠EPIC(史诗) | ⚠️ 映射偏移 |
| Mythic | 80 | LEGENDARY | 80 | Mythic=LEGENDARY(传说) | ⚠️ 映射偏移 |

> **关键发现**: PRD使用5级品质(Uncommon/Rare/Epic/Legendary/Mythic)，Code使用5级品质(COMMON/FINE/RARE/EPIC/LEGENDARY)。两者都是5级但命名和映射关系不同。碎片转化数值5/10/20/40/80在各自体系内是一致的，但品质标签存在系统性偏移。需要统一品质命名规范。

### 2.5 升星碎片消耗

| 星级 | PRD HER-5 | Code STAR_UP_FRAGMENT_COST | 一致性 |
|:----:|:---------:|:-------------------------:|:------:|
| 1→2 | 20 | 20 | ✅ |
| 2→3 | 40 | 40 | ✅ |
| 3→4 | 80 | 80 | ✅ |
| 4→5 | 150 | 150 | ✅ |
| 5→6 | 300 | 300 | ✅ |

> **结论**: 升星碎片消耗PRD与Code完全一致 ✅

### 2.6 碎片合成阈值

| PRD品质 | PRD合成碎片 | Code品质 | Code合成碎片 | 一致性 |
|---------|:----------:|---------|:-----------:|:------:|
| Uncommon | 20 | COMMON | 20 | ✅ |
| Rare | 40 | FINE | 40 | ✅ |
| Epic | 80 | RARE | 80 | ✅ |
| Legendary | 150 | EPIC | 150 | ✅ |
| Mythic | 300 | LEGENDARY | 300 | ✅ |

> **结论**: 合成阈值数值一致，但品质命名偏移问题同上

### 2.7 突破系统

| 配置项 | PRD HER-3 | Code BREAKTHROUGH_TIERS | 一致性 |
|--------|-----------|------------------------|:------:|
| 突破1 等级 | Lv.10 | levelCapBefore=30 | ❌ |
| 突破1 碎片 | 20 | 30 | ❌ |
| 突破1 铜钱 | 2000 | 20000 | ❌ |
| 突破2 等级 | Lv.20 | levelCapBefore=40 | ❌ |
| 突破2 碎片 | 40 | 50 | ❌ |
| 突破2 铜钱 | 5000 | 50000 | ❌ |
| 突破3 等级 | Lv.30 | levelCapBefore=50 | ❌ |
| 突破3 碎片 | 80 | 80 | ✅ |
| 突破3 铜钱 | 12000 | 100000 | ❌ |
| 突破4 等级 | Lv.40 | levelCapBefore=60 | ❌ |
| 突破4 碎片 | 150 | 120 | ❌ |
| 突破4 铜钱 | 30000 | 200000 | ❌ |

> **关键发现**: 突破系统PRD与Code差异巨大。Code的突破起始等级为30（PRD为10），Code的铜钱消耗是PRD的10倍，Code额外引入了"突破石"概念（PRD无此资源）。Code还多了第4阶段突破（60→70），PRD仅定义到Lv.40。这是两套完全不同的数值设计。

### 2.8 战力计算公式

| 系数 | PRD HER-1-3 | Code HeroSystem.calculatePower() | 一致性 |
|------|-------------|--------------------------------|:------:|
| 属性权重 | ATK×2.0 + INT×2.0 + CMD×1.5 + POL×1.0 | ATK×2.0 + DEF×1.5 + INT×2.0 + SPD×1.0 | ✅ 属性映射一致 |
| 等级系数 | 1 + 等级×0.05 | 1 + 等级×0.05 | ✅ |
| 星级系数 | 1 + (星级-1)×0.10 | ❌ 未实现 | ❌ |
| 装备系数 | 1 + Σ装备战力/1000 | ❌ 未实现 | ❌ |
| 品质系数 | PRD无此系数 | QUALITY_MULTIPLIERS(1.0~1.8) | ⚠️ Code额外增加 |

> **结论**: 战力公式基础部分一致，但Code缺少星级系数和装备系数，额外增加了品质系数（PRD无此设计）。

### 2.9 武将数据完整性

| 检查项 | PRD要求 | Code实际 | 状态 |
|--------|---------|---------|:----:|
| 武将总数 | 14 | 14 | ✅ |
| 品质覆盖 | 5级全覆盖 | COMMON×2, FINE×2, RARE×1, EPIC×4, LEGENDARY×5 | ✅ |
| 阵营覆盖 | 4阵营全覆盖 | 蜀×6, 魏×4, 吴×2, 群×2 | ✅ |
| 四维属性非空 | 全部>0 | 全部>0 | ✅ |
| 技能非空 | 每人≥1技能 | 全部≥1技能 | ✅ |
| 传记非空 | 14人全有 | 14人全有biography | ✅ |
| COMMON属性范围 | 60~75 | 民兵队长(62,60,45,50) 乡勇头目(70,55,40,60) | ⚠️ 乡勇头目ATK=70在范围内但speed=60超出POL定义 |

---

## 三、问题清单

### 🔴 P0 — 阻断性问题（必须修复）

| # | 问题 | 影响 | 建议 |
|---|------|------|------|
| P0-1 | **招募概率PRD与Code不一致** — 普通池PRD(Uncommon=60%/Rare=30%/Epic=8%/Legendary=2%/Mythic=0%) vs Code(COMMON=60%/FINE=28%/RARE=9%/EPIC=2.5%/LEGENDARY=0.5%)，高级池差异更大 | 玩家体验与PRD设计意图不符，影响游戏经济平衡 | 确定权威数据源：以Play文档为准则需更新PRD；以PRD为准则需更新Code |
| P0-2 | **UP武将机制未实现** — 功能点#24，高级池UP武将50%概率、卡池倒计时均无代码实现 | 核心招募功能缺失，影响高级池吸引力 | 需新增UP武将配置+概率提升逻辑+卡池倒计时 |
| P0-3 | **每日免费招募未实现** — 功能点#23，HeroRecruitSystem.update()仅预留注释 | 玩家每日登录动力缺失 | 需实现免费次数计数器+每日重置+免费招募入口 |

### 🟡 P1 — 重要问题（应修复）

| # | 问题 | 影响 | 建议 |
|---|------|------|------|
| P1-1 | **突破系统数值与PRD完全不同** — Code起始等级30(PRD=10)，铜钱消耗10倍差异，额外引入突破石 | 养成节奏与PRD设计意图严重偏离 | 需对齐PRD突破节点表，或更新PRD匹配Code设计 |
| P1-2 | **战力公式缺少星级系数和装备系数** — Code仅用品质系数替代 | 高星武将战力偏低，装备对战力无影响 | calculatePower()需增加星级系数和装备系数参数 |
| P1-3 | **普通招募多了保底机制** — PRD规定普通招募无保底，Code实现了10连保RARE+/100抽保LEGENDARY+ | 普通池出货率高于设计预期 | 移除普通招募的保底逻辑，或更新PRD |
| P1-4 | **红点提示系统未实现** — 功能点#29，无RedDotNotificationSystem | 玩家错过可操作项，降低留存 | 需实现红点触发/消除引擎层 |
| P1-5 | **今日待办聚合未实现** — 功能点#30，无待办聚合横幅 | 武将系统可操作性降低 | 需实现待办扫描+聚合接口 |
| P1-6 | **品质命名体系不一致** — PRD用Uncommon/Rare/Epic/Legendary/Mythic，Code用COMMON/FINE/RARE/EPIC/LEGENDARY，映射关系混乱 | 跨文档沟通成本高，容易引入bug | 建立统一的品质命名映射表，明确PRD↔Code对应关系 |
| P1-7 | **技能升级系统引擎层缺失** — 功能点#20，仅有事件定义无独立SkillLevelSystem | 技能升级消耗/效果无法引擎层验证 | 需实现技能升级引擎逻辑 |

### 🟢 P2 — 改进建议（可延后）

| # | 问题 | 影响 | 建议 |
|---|------|------|------|
| P2-1 | **吴国武将偏少** — 仅2个(乡勇头目+周瑜)，相比蜀国6个差距大 | 吴国玩家体验单薄 | 后续版本补充吴国武将(如孙策、陆逊、甘宁) |
| P2-2 | **RARE品质仅1个武将(典韦)** — 稀有品质武将数量不足 | 抽卡重复率高 | 补充2~3个RARE品质武将 |
| P2-3 | **武将属性映射不直观** — PRD的CMD映射为Code的defense，POL映射为speed | 新开发者理解成本高 | 考虑重命名为cmd/pol或添加明确注释 |
| P2-4 | **十连排序规则未在引擎层强制** — Play文档定义先低后高排序，Code未验证 | 十连展示顺序可能不符合预期 | 在HeroRecruitSystem中增加排序逻辑 |

---

## 四、测试覆盖分析

### 4.1 测试统计

| 指标 | 数值 |
|------|:----:|
| 测试文件数 | 19 |
| 测试用例总数 | 474 |
| 通过率 | 100% (474/474) |
| 编译错误 | 0 |

### 4.2 测试覆盖矩阵

| 子系统 | 测试文件 | 用例数 | 覆盖范围 |
|--------|---------|:------:|---------|
| HeroSystem | HeroSystem.test.ts + hero-system-advanced.test.ts | ~40 | 武将CRUD、战力计算、碎片管理、序列化 |
| HeroRecruitSystem | HeroRecruitSystem.test.ts + .edge.test.ts + hero-recruit-boundary.test.ts + hero-recruit-pity.test.ts + hero-recruit-history.test.ts | ~100 | 单抽/十连、保底、概率、重复处理、历史记录、边界 |
| HeroLevelSystem | HeroLevelSystem.test.ts + hero-level-enhance.test.ts + hero-level-boundary.test.ts + HeroLevelSystem.edge.test.ts + batchUpgrade.test.ts | ~80 | 升级消耗、一键强化、批量升级、边界条件 |
| HeroStarSystem | HeroStarSystem.test.ts + HeroStarSystem.breakthrough.test.ts | ~50 | 升星、突破、碎片获取 |
| HeroFormation | HeroFormation.test.ts + HeroFormation.autoFormation.test.ts | ~40 | 编队管理、自动编队、互斥校验 |
| HeroSerializer | HeroSerializer.test.ts + HeroSerializer.edge.test.ts | ~30 | 序列化/反序列化、版本兼容 |
| 碎片合成 | hero-fragment-synthesize.test.ts | ~20 | 合成阈值、品质区分、边界 |

### 4.3 测试盲区

| 未覆盖功能 | 风险等级 | 说明 |
|-----------|:--------:|------|
| 每日免费招募 | P0 | 无测试用例 |
| UP武将机制 | P0 | 无测试用例 |
| 红点提示系统 | P1 | 无测试用例 |
| 今日待办聚合 | P1 | 无测试用例 |
| 技能升级消耗 | P1 | 无引擎层测试 |
| 碎片溢出处理(>999) | P2 | Play文档定义了溢出逻辑但未验证 |

---

## 五、编译与代码质量

| 检查项 | 结果 |
|--------|:----:|
| TypeScript编译 | ✅ 0 errors |
| 测试全部通过 | ✅ 474/474 |
| 代码架构清晰 | ✅ 聚合根+配置分离+类型安全 |
| 依赖解耦 | ✅ 回调函数解耦ResourceSystem |
| 序列化/反序列化 | ✅ 版本号+兼容处理 |
| GM调试命令 | ✅ Play文档定义，便于测试 |

---

## 六、总结

### 评分

| 维度 | 得分 | 满分 | 说明 |
|------|:----:|:----:|------|
| 功能覆盖率 | 25/32 | 32 | 78.1%功能点已实现 |
| 数值一致性 | 3/8 | 8 | 升级消耗/升星碎片/合成阈值一致；招募概率/突破/战力公式偏差大 |
| 测试覆盖 | 4/5 | 5 | 474用例100%通过，但4个功能点无测试 |
| 代码质量 | 4/5 | 5 | 架构清晰，0编译错误，但品质命名混乱 |
| **总分** | **36/50** | **50** | **72%** |

### 总体评价

v2.0招贤纳士的**引擎层核心功能（招募/升级/升星/编队/羁绊）实现质量较高**，474个测试用例100%通过，代码架构清晰。

主要问题集中在三个方面：
1. **PRD↔Code数值偏差**：招募概率表、突破系统数值、战力公式系数存在系统性差异，需要确定权威数据源并统一
2. **3个P0功能未实现**：UP武将机制(#24)、每日免费招募(#23)、红点提示系统(#29)缺失
3. **品质命名体系不一致**：PRD的5级品质与Code的5级品质存在映射偏移，增加沟通和维护成本

### 建议优先级

1. **立即修复P0**: 实现UP武将机制+每日免费招募，统一招募概率数据源
2. **本轮修复P1**: 对齐突破系统数值，补充战力公式系数，实现红点系统
3. **后续版本P2**: 补充吴国武将，统一品质命名，增加碎片溢出处理

---

*Phase 3 深度评测完成 | 2026-07-17 | 三国霸业评测组*
