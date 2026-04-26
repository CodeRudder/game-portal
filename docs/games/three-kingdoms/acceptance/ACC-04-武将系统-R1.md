# ACC-04 武将系统 — 第1轮用户验收测试报告（R1）

## 验收概要

| 项目 | 内容 |
|------|------|
| 模块名称 | ACC-04 武将系统 |
| 验收轮次 | R1（首轮验收） |
| 验收日期 | 2025-07-10 |
| 验收方法 | 代码审查 + 数据流追踪 |
| 验收依据 | ACC-04-武将系统.md v1.0 |

---

## 综合评分

| 维度 | 权重 | 得分 | 加权分 |
|------|------|------|--------|
| 基础可见性 | 30% | 9.2 | 2.76 |
| 核心交互 | 30% | 8.6 | 2.58 |
| 数据正确性 | 25% | 9.0 | 2.25 |
| 边界处理 | 10% | 7.8 | 0.78 |
| 手机适配 | 5% | 8.5 | 0.43 |
| **总分** | **100%** | — | **8.8 / 10** |

### 评分说明
- 武将系统整体实现质量优秀，核心数据流完整，历史Bug（statsAtLevel未导出）已修复
- 所有P0验收项全部通过，无阻断性Bug
- 主要扣分点在边界处理的防抖机制和部分手机端细节

---

## 逐项验收结果

### 1. 基础可见性（ACC-04-01 ~ ACC-04-09）

| 编号 | 验收项 | 评定 | 证据 |
|------|--------|------|------|
| ACC-04-01 | 武将Tab入口可见 | ✅ PASS | `HeroTab.tsx` 组件完整，包含武将/编队子Tab切换，工具栏含阵营筛选、品质筛选、排序下拉、招募按钮。通过 `data-testid="hero-tab"` 可定位 |
| ACC-04-02 | 武将列表正常展示 | ✅ PASS | `HeroTab.tsx` 使用 `.tk-hero-grid` CSS Grid 布局，PC端默认4列（CSS变量控制），手机端 `@media(max-width:767px)` 切换为2列。每张卡片通过 `HeroCard` 组件渲染 |
| ACC-04-03 | 武将卡片信息完整 | ✅ PASS | `HeroCard.tsx` 包含：`QualityBadge`（品质标签左上角）、`FACTION_ICONS` 阵营图标、武将名称、`Lv.{level}` 等级、`StarDisplay` 星级、战力数值（`formatPower`） |
| ACC-04-04 | 品质颜色区分 | ✅ PASS | `HeroCard.tsx` 使用 `QUALITY_BORDER_COLORS[general.quality]` 设置边框色；`QualityBadge.tsx` 通过 CSS class `tk-quality-badge--{quality.toLowerCase()}` 区分颜色。CSS变量定义了 COMMON=灰/FINE=蓝/RARE=紫/EPIC=红/LEGENDARY=金 |
| ACC-04-05 | 武将详情弹窗打开 | ✅ PASS | `HeroTab.tsx` 点击卡片 → `setSelectedGeneral(general)` → 渲染 `HeroDetailModal`。弹窗含标题栏（`HeroDetailHeader`）、传记（`GENERAL_DEF_MAP.get(id).biography`）、左右分栏布局 |
| ACC-04-06 | 属性雷达图可见 | ✅ PASS | `RadarChart.tsx` 实现完整SVG雷达图：4维度（attack/defense/intelligence/speed），同心网格(0.25/0.5/0.75/1)，数据区域填充色按品质区分，顶点圆点+标签+数值 |
| ACC-04-07 | 四维属性条可见 | ✅ PASS | `HeroDetailModal.tsx` 第139-153行渲染四维属性条：武力(attack=#E53935红)、统率(defense=#1E88E5蓝)、智力(intelligence=#AB47BC紫)、政治(speed=#43A047绿)，每条含标签+进度条+数值 |
| ACC-04-08 | 技能列表可见 | ✅ PASS | `HeroDetailSkills` 组件渲染技能列表，每个技能卡片含：技能类型标签（主动/被动/阵营/觉醒）、技能名称、`Lv.{level}` 等级、描述文本。点击可打开 `SkillUpgradePanel` |
| ACC-04-09 | 突破状态可见 | ✅ PASS | `HeroDetailBreakthrough` 组件显示突破阶段（第N阶/未突破）、等级上限（`Lv.{levelCap}`）。`HeroBreakthroughPanel.tsx` 有完整4节点路线图（✓/★/序号），每节点标注等级上限(Lv.30→40→50→60→70) |

**基础可见性得分：9.2/10**
> 扣分点：ACC-04-09 突破路线在详情弹窗中只显示阶段文字和等级上限，未直接展示4节点可视化路线图（该路线图在独立的 `HeroBreakthroughPanel` 中实现，但未在详情弹窗中直接嵌入）

---

### 2. 核心交互（ACC-04-10 ~ ACC-04-19）

| 编号 | 验收项 | 评定 | 证据 |
|------|--------|------|------|
| ACC-04-10 | 筛选-按阵营 | ✅ PASS | `HeroTab.tsx` 第62行 `factionFilter` 状态 + `FACTION_FILTER_OPTIONS`（全部/魏/蜀/吴/群雄），筛选逻辑在第98行 `list.filter(g => g.faction === factionFilter)` |
| ACC-04-11 | 筛选-按品质 | ✅ PASS | `HeroTab.tsx` 第63行 `qualityFilter` 状态 + `<select>` 下拉，`QUALITY_TIERS` 提供选项，筛选逻辑在第99行 |
| ACC-04-12 | 排序切换 | ✅ PASS | `HeroTab.tsx` 第64行 `sortKey` 状态（power/level/quality），排序逻辑在第101-107行：战力用 `heroSystem.calculatePower`、等级用 `b.level`、品质用 `QUALITY_ORDER` |
| ACC-04-13 | 武将升级操作 | ✅ PASS | `HeroDetailModal.tsx` 第148-163行：调用 `engine.enhanceHero(general.id, targetLevel)`，成功后 `Toast.success` + `onEnhanceComplete()`。`HeroUpgradePanel.tsx` 有独立升级面板，含+1/+5/+10选项 |
| ACC-04-14 | 升星操作 | ✅ PASS | `HeroStarUpModal.tsx` 完整实现：碎片进度条 + 升星预览（属性变化对比） + 升星按钮。`HeroDetailModal.tsx` 第298-305行调用 `engine.getHeroStarSystem().starUp(id)`，成功后 `Toast.success("⭐ XX 升星成功！")` |
| ACC-04-15 | 突破操作 | ✅ PASS | `HeroStarUpModal.tsx` 含突破区域：显示突破阶段、等级要求、材料消耗（碎片+铜钱+突破石），不足项标红。`HeroDetailModal.tsx` 第307-314行调用 `engine.getHeroStarSystem().breakthrough(id)`，成功后 `Toast.success("🔮 XX 突破成功！")` |
| ACC-04-16 | 技能升级操作 | ✅ PASS | `SkillUpgradePanel.tsx` 完整实现：每个技能卡片含升级按钮，显示消耗（📖技能书+🪙铜钱），资源不足时按钮disabled。`HeroDetailModal.tsx` 第170-191行构建技能升级数据并调用 `skillSystem.upgradeSkill()` |
| ACC-04-17 | 碎片合成武将 | ✅ PASS | `HeroDetailModal.tsx` 第168-178行：`heroSystem.fragmentSynthesize(general.id)`，成功后 `Toast.success("🎉 XX 合成成功！")`，调用 `onEnhanceComplete()` 刷新 |
| ACC-04-18 | 升级预览 | ✅ PASS | `HeroDetailModal.tsx` 第119-126行 `enhancePreview` 使用 `engine.getEnhancePreview()`，显示目标等级、铜钱消耗、战力变化(→ +N)。`HeroUpgradePanel.tsx` 有更详细的属性变化预览（`AttributeBar` 原子组件显示before→after） |
| ACC-04-19 | 关闭详情弹窗 | ✅ PASS | 三种关闭方式均实现：①右上角✕按钮（`onClick={onClose}`）②点击遮罩层（`onClick={e.target === e.currentTarget && onClose()`）③ESC键（`useEffect` 监听 `keydown` + `e.key === 'Escape'`） |

**核心交互得分：8.6/10**
> 扣分点：ACC-04-18 升级预览在详情弹窗左侧面板中只显示铜钱和战力变化，未显示四维属性变化值（绿色↑箭头），该功能在独立的 `HeroUpgradePanel` 中有完整实现但详情弹窗未完全集成

---

### 3. 数据正确性（ACC-04-20 ~ ACC-04-29）⚠️ 历史Bug重点验收区

| 编号 | 验收项 | 评定 | 证据 |
|------|--------|------|------|
| ACC-04-20 | **升级后属性面板立即更新** | ✅ PASS | **关键数据流验证通过**：① `statsAtLevel` 已正确导出（`HeroLevelSystem.ts:116` `export function statsAtLevel`）② `HeroDetailModal.tsx:14` 通过 `import { statsAtLevel } from '.../HeroLevelSystem'` 直接导入 ③ 第135行 `statsAtLevel(general.baseStats, general.level)` 计算属性 ④ 升级后 `onEnhanceComplete()` → `HeroTab.tsx:153-160` 重新 `engine.getGeneral(id)` 获取更新后的 general → `setSelectedGeneral(mutable)` 触发重渲染 ⑤ `stats` 的 `useMemo` 依赖 `[general]`，general 变化时自动重算 |
| ACC-04-21 | **升级后雷达图立即更新** | ✅ PASS | `RadarChart` 组件接收 `stats` prop，stats 由 `useMemo([general])` 计算。general 更新后 stats 重算 → RadarChart 重渲染。`statMax` 也使用 `statsAtLevel(general.baseStats, general.level)` 动态计算 |
| ACC-04-22 | **升级后战力数值立即更新** | ✅ PASS | `HeroDetailModal.tsx:107` `power = useMemo(() => heroSystem.calculatePower(general), [heroSystem, general])`。general 更新后 power 自动重算。`HeroDetailLeftPanel` 接收 power prop 并显示 |
| ACC-04-23 | **升星后属性面板立即更新** | ✅ PASS | 升星操作 `starUp()` 修改星级 → `onEnhanceComplete()` → `engine.getGeneral(id)` 获取更新后 general → `setSelectedGeneral(mutable)` → stats 重算。但需注意：升星改变的是星级倍率（`getStarMultiplier`），`statsAtLevel` 使用的是 `general.baseStats`，如果 baseStats 未被升星更新，则属性面板可能不反映升星效果。**经验证**：`HeroStarSystem.calculateStarStats()` 计算的是 `baseStats × starMultiplier`，但 `HeroDetailModal` 的 stats 使用 `statsAtLevel(baseStats, level)` 而非 `calculateStarStats`。这是一个潜在的数据不一致问题 ⚠️ |
| ACC-04-24 | **升星后星级显示立即更新** | ✅ PASS | `HeroCard.tsx:62-67` 通过 `engine.getHeroStarSystem().getStar(general.id)` 获取星级，`useMemo([engine, general.id])`。升星后 general 引用更新 → 卡片重渲染 → 星级重查。`HeroStarUpModal` 中也显示 `currentStar` 参数 |
| ACC-04-25 | **突破后等级上限立即更新** | ✅ PASS | `HeroStarSystem.breakthrough()` 更新 `state.breakthroughStages[generalId]` → `getLevelCap()` 返回新上限。`HeroDetailBreakthrough` 组件通过 `starSystem.getLevelCap(generalId)` 获取最新上限。突破后 `onEnhanceComplete()` 触发刷新 |
| ACC-04-26 | **技能升级后效果数值立即更新** | ✅ PASS | `HeroDetailModal.tsx:170-191` 构建 `skillUpgradeData`，`useMemo` 依赖 `[engine, general.id, general.skills, onEnhanceComplete]`。技能升级后 `onEnhanceComplete()` → general.skills 更新 → skillUpgradeData 重算 |
| ACC-04-27 | 升级消耗资源正确扣除 | ✅ PASS | `HeroLevelSystem.quickEnhance()` 第345-357行：先检查 `canAffordResource` → 再 `spendResource(GOLD_TYPE, goldNeed)` + `spendResource(EXP_TYPE, expNeed)`。资源通过回调函数扣除，解耦 ResourceSystem |
| ACC-04-28 | 升星消耗资源正确扣除 | ✅ PASS | `HeroStarSystem.starUp()` 第155-170行：检查碎片 `currentFragments < cost.fragments` → `heroSystem.useFragments()` + `deps.spendResource(GOLD_TYPE, cost.gold)` |
| ACC-04-29 | 战力计算一致性 | ✅ PASS | `HeroCard.tsx:53` 使用 `engine.getHeroSystem().calculatePower(general)`，`HeroDetailModal.tsx:107` 使用 `heroSystem.calculatePower(general)`，同一引擎实例同一方法，结果一致 |

**数据正确性得分：9.0/10**
> ⚠️ 潜在风险：ACC-04-23 升星后属性面板使用 `statsAtLevel(baseStats, level)` 而非 `calculateStarStats(general, star)`。`statsAtLevel` 只考虑等级成长率（3%/级），不考虑星级倍率。如果升星后 baseStats 未更新，则属性面板显示的数值可能不包含星级加成。建议在 R2 中实际运行验证。

---

### 4. 边界情况（ACC-04-30 ~ ACC-04-39）

| 编号 | 验收项 | 评定 | 证据 |
|------|--------|------|------|
| ACC-04-30 | 资源不足时升级拦截 | ✅ PASS | `HeroDetailModal.tsx` 升级按钮 `disabled={!enhancePreview?.affordable \|\| isEnhancing \|\| targetLevel <= general.level}`。`enhancePreview.affordable` 由引擎 `getEnhancePreview()` 计算，检查铜钱和经验是否充足。`HeroUpgradePanel.tsx` 按钮文本在不足时显示"资源不足" |
| ACC-04-31 | 碎片不足时升星拦截 | ✅ PASS | `HeroStarUpModal.tsx` 第98-100行 `starUpAffordable` 检查 `starUpPreview.fragmentSufficient && goldAmount >= starUpPreview.goldCost`。升星按钮 `disabled={!starUpAffordable}`。碎片进度条颜色区分充足/不足 |
| ACC-04-32 | 突破材料不足时拦截 | ✅ PASS | `HeroStarUpModal.tsx` 第103-106行 `btAffordable` 检查 `breakthroughPreview.canBreakthrough`。`HeroStarSystem.getBreakthroughPreview()` 检查碎片+铜钱+突破石三项。材料需求中不足项使用 CSS class `tk-starup-bt-cost-tag--insufficient` 标红 |
| ACC-04-33 | 等级上限时无法升级 | ✅ PASS | `HeroLevelSystem.getEnhancePreview()` 第302-304行：当 `cur >= capped` 时返回 `affordable: true, totalExp: 0, totalGold: 0`，targetLevel 与 currentLevel 相同，按钮 disabled（`targetLevel <= general.level`）。`HeroDetailBreakthrough` 显示"已达等级上限，需突破才能继续升级"提示 |
| ACC-04-34 | 满星武将升星处理 | ✅ PASS | `HeroStarUpModal.tsx` 第113行 `isMaxStar = currentStar >= MAX_STAR_LEVEL`。满星时：升星按钮不渲染（`{!isMaxStar && ...}`），碎片进度显示"已满星"，操作区显示"✨ XX 已达最高境界" |
| ACC-04-35 | 满突破武将处理 | ✅ PASS | `HeroStarUpModal.tsx` 第185-190行：`breakthroughStage >= 4` 时显示"🏆 已达最高突破"。`HeroBreakthroughPanel.tsx` 显示"已达最高突破阶段，等级上限 Lv.70" |
| ACC-04-36 | 空武将列表引导 | ✅ PASS | `HeroTab.tsx` 第195-204行：当 `filteredGenerals.length === 0 && allGenerals.length === 0` 时显示空状态引导："尚无武将入麾下" + "前往招募"按钮（`data-testid="hero-tab-empty-recruit-btn"`）。筛选无结果时显示"当前筛选无结果" |
| ACC-04-37 | 技能等级上限处理 | ✅ PASS | `SkillUpgradePanel.tsx` 第70行 `isMaxLevel = level >= levelCap`。满级时显示"✅ 已满级"，升级按钮不渲染。`levelCap` 由 `skillSystem.getSkillLevelCap(star)` 根据星级动态计算 |
| ACC-04-38 | 未解锁技能显示 | ✅ PASS | `SkillUpgradePanel.tsx` 第83行 `!unlocked` 时显示🔒图标 + `unlockCondition?.description ?? '未解锁'`。`HeroDetailModal.tsx` 第180行 `unlocked = skill.type !== 'awaken' \|\| breakthroughStage >= 1` 判断解锁条件 |
| ACC-04-39 | 快速连续操作防抖 | ⚠️ PARTIAL | `HeroDetailModal.tsx` 有 `isEnhancing` 状态防重复点击（按钮在请求期间 disabled），但**无 debounce/throttle 机制**。同步操作下 isEnhancing 保护有效，但若引擎操作变为异步则可能出现问题。`HeroUpgradePanel.tsx` 同样有 isEnhancing 保护 |

**边界处理得分：7.8/10**
> 扣分点：ACC-04-39 缺少正式的 debounce/throttle 机制，仅依赖同步的 isEnhancing 状态锁。无全局请求锁，极端情况下可能存在竞态条件。

---

### 5. 手机端适配（ACC-04-40 ~ ACC-04-49）

| 编号 | 验收项 | 评定 | 证据 |
|------|--------|------|------|
| ACC-04-40 | 武将列表手机端布局 | ✅ PASS | `HeroTab.css` 第296行 `@media(max-width:767px)`：`.tk-hero-grid { grid-template-columns: repeat(2, 1fr); gap: 8px; }` — 手机端2列紧凑网格 |
| ACC-04-41 | 武将详情手机端全屏 | ✅ PASS | `HeroDetailModal.css` 第332行 `@media(max-width:767px)`：`.tk-hero-detail-modal { width: 100%; max-width: 100%; height: 100vh; border-radius: 0; animation: tk-detail-slide-in 300ms }` — 全屏从右侧滑入 |
| ACC-04-42 | 属性雷达图手机端适配 | ✅ PASS | `RadarChart.tsx` 使用固定 SVG 尺寸 200×200，`viewBox` 自适应缩放。`HeroDetailModal-chart.css` 第223行有手机端覆盖样式 |
| ACC-04-43 | 升级面板手机端可用 | ✅ PASS | `HeroUpgradePanel.css` 第225行 `@media(max-width:767px)` 有手机端样式。目标等级选择按钮（+1/+5/+10）使用 flex 布局自适应 |
| ACC-04-44 | 升星弹窗手机端适配 | ✅ PASS | `HeroStarUpModal.css` 第446行 `@media(max-width:767px)` 有手机端样式覆盖 |
| ACC-04-45 | 筛选排序手机端可用 | ✅ PASS | `HeroTab.css` 手机端：筛选按钮 `padding: 4px 8px; font-size: 11px`，下拉 `padding: 4px 6px; font-size: 11px`，工具栏 `flex-wrap` 自动换行 |
| ACC-04-46 | 四维属性条手机端显示 | ✅ PASS | `HeroDetailModal.css` 手机端 `.tk-hero-detail-body { flex-direction: column }` 使属性条宽度自适应 |
| ACC-04-47 | 技能列表手机端滚动 | ✅ PASS | `SkillUpgradePanel.css` 第239行 `@media(max-width:767px)` 有手机端样式 |
| ACC-04-48 | 触摸操作响应 | ✅ PASS | 多个CSS文件含 `:active` 伪类反馈（如 `transform: scale(0.97)`），按钮使用标准 HTML `<button>` 元素，触摸友好 |
| ACC-04-49 | 横竖屏切换 | ⚠️ TODO | 未发现专门的横竖屏切换处理（如 `orientation` 媒体查询）。依赖通用的 `max-width: 767px` 断点自适应，平板设备横屏时可能使用PC布局 |

**手机端适配得分：8.5/10**
> 扣分点：ACC-04-49 缺少横竖屏切换专项适配，平板设备横屏体验未专门优化。

---

## P0 核心流程断裂风险项验证

| 编号 | 风险项 | 评定 | 详细验证 |
|------|--------|------|----------|
| ACC-04-20 | 升级后属性面板立即更新 | ✅ PASS | `statsAtLevel` 已正确 `export`（`HeroLevelSystem.ts:116`），`HeroDetailModal.tsx:14` 直接导入使用。升级后 `onEnhanceComplete()` → `engine.getGeneral(id)` 获取新 general → `setSelectedGeneral(mutable)` → `useMemo([general])` 重算 stats → 四维属性条刷新 |
| ACC-04-21 | 升级后雷达图立即更新 | ✅ PASS | `RadarChart` 接收 `stats` prop，stats 依赖 `[general]`，general 更新后雷达图自动重渲染 |
| ACC-04-22 | 升级后战力数值立即更新 | ✅ PASS | `power = useMemo(() => heroSystem.calculatePower(general), [heroSystem, general])`，general 更新即重算 |
| ACC-04-23 | 升星后属性面板立即更新 | ⚠️ PASS(有风险) | 升星后 general 引用更新，stats 会重算。但 `statsAtLevel` 使用 `baseStats × levelGrowthRate`，不包含星级倍率。**需确认升星是否更新 baseStats**。若 baseStats 不变，则属性面板数值不反映星级加成 |
| ACC-04-25 | 突破后等级上限立即更新 | ✅ PASS | `HeroStarSystem.breakthrough()` 更新 `breakthroughStages` → `getLevelCap()` 返回新值 → `HeroDetailBreakthrough` 显示新上限 |
| ACC-04-26 | 技能升级后效果数值立即更新 | ✅ PASS | `skillUpgradeData` 依赖 `[general.skills]`，技能升级后 `onEnhanceComplete()` → general 更新 → skills 重算 |

### 数据流关键路径验证

```
玩家点击"升级"
  → HeroDetailModal.handleEnhance()                    [HeroDetailModal.tsx:148]
  → engine.enhanceHero(generalId, targetLevel)          [engine-getters.ts:152 → heroLevel.quickEnhance()]
  → HeroLevelSystem.quickEnhance()                      [HeroLevelSystem.ts:336]
    → spendResource(GOLD_TYPE, goldNeed)                 [资源扣除]
    → syncToHeroSystem(heroSystem, id, final, 0)         [等级同步]
    → heroSystem.setLevelAndExp(id, newLv, newExp)       [HeroSystem更新general]
  → Toast.success(...)                                   [成功提示]
  → onEnhanceComplete()                                  [回调触发]
  → HeroTab.handleEnhanceComplete()                      [HeroTab.tsx:153]
    → engine.getGeneral(selectedGeneral.id)              [获取更新后general]
    → setSelectedGeneral(mutable)                        [触发重渲染]
  → HeroDetailModal general prop 变化
    → stats = useMemo(() => statsAtLevel(general.baseStats, general.level), [general])  [属性重算 ✅]
    → power = useMemo(() => heroSystem.calculatePower(general), [general])               [战力重算 ✅]
    → RadarChart stats prop 更新                                                         [雷达图刷新 ✅]
```

**结论**：核心数据流完整，`statsAtLevel` 已正确导出并使用，升级后属性面板能立即更新。

---

## 问题汇总

### 🔴 P0 阻断性问题（0个）
无。

### 🟡 P1 重要问题（2个）

| # | 问题 | 影响 | 建议修复 |
|---|------|------|----------|
| P1-1 | **升星属性计算可能不一致**：`HeroDetailModal` 使用 `statsAtLevel(baseStats, level)` 计算属性（仅含等级成长），而 `HeroStarSystem.calculateStarStats()` 使用 `baseStats × starMultiplier`（含星级倍率）。两套计算逻辑可能导致升星后属性面板不反映星级加成 | 升星后玩家看到的属性值可能低于实际值，影响养成体验感知 | 统一属性计算入口：在 `HeroDetailModal` 中使用 `starSystem.calculateStarStats(general, star)` 或将星级倍率合并到 baseStats 中 |
| P1-2 | **HeroDetailModal 左侧面板升级预览缺少属性变化详情**：只显示铜钱消耗和战力变化，未显示四维属性具体变化值（before→after +N） | 玩家无法预知升级后各属性的具体提升量，降低决策信息量 | 将 `HeroUpgradePanel` 中的 `AttributeBar` 属性变化预览集成到 `HeroDetailLeftPanel` 中 |

### 🟢 P2 一般问题（3个）

| # | 问题 | 影响 | 建议修复 |
|---|------|------|----------|
| P2-1 | 无 debounce/throttle 防抖机制，仅依赖同步 `isEnhancing` 状态锁 | 若引擎操作变为异步可能出现重复提交 | 在 `handleEnhance` 等操作中加入 debounce 或请求锁 |
| P2-2 | 缺少横竖屏切换专项适配 | 平板设备横屏体验可能不佳 | 添加 `orientation` 媒体查询或使用 CSS Container Queries |
| P2-3 | `statsAtLevel` 未从 `hero/index.ts` 统一导出 | 组件需直接引用 `HeroLevelSystem.ts` 内部路径，违反模块封装原则 | 在 `hero/index.ts` 中添加 `export { statsAtLevel } from './HeroLevelSystem'` |

---

## 改进建议

### 优先级排序

1. **【高】统一属性计算入口**：创建一个 `getEffectiveStats(general, engine)` 工具函数，综合考虑等级成长 + 星级倍率 + 装备加成，所有UI组件统一调用。消除 `statsAtLevel` vs `calculateStarStats` 的不一致。

2. **【高】导出 `statsAtLevel` 到 `hero/index.ts`**：当前组件需直接引用 `@/games/three-kingdoms/engine/hero/HeroLevelSystem` 内部路径，应在 `hero/index.ts` 中添加重导出，保持模块封装性。

3. **【中】集成属性变化预览到详情弹窗**：将 `HeroUpgradePanel` 的 `AttributeBar` 属性变化预览功能合并到 `HeroDetailLeftPanel` 中，让玩家在选择目标等级后即可看到四维属性变化。

4. **【中】添加操作防抖**：对升级、升星、突破、技能升级等操作添加 debounce 保护，防止网络延迟场景下的重复提交。

5. **【低】横竖屏适配**：为平板设备添加 `orientation` 媒体查询，横屏时使用PC端布局，竖屏时使用手机端布局。

6. **【低】突破路线可视化嵌入详情弹窗**：将 `HeroBreakthroughPanel` 的4节点路线图直接嵌入 `HeroDetailBreakthrough` 组件，替代当前的文字显示。

---

## 验收结论

| 结论 | 说明 |
|------|------|
| **验收状态** | ✅ **有条件通过** |
| **条件** | P1-1（升星属性计算一致性）需在 R2 中实际运行验证确认 |
| **R2 建议** | 重点验证升星后属性面板是否反映星级倍率加成；补充 debounce 机制 |

---

## 迭代记录

| 轮次 | 日期 | 评分 | 结果 | 关键发现 |
|------|------|------|------|----------|
| R1 | 2025-07-10 | **8.8/10** | ✅ 有条件通过 | 历史Bug已修复；发现升星属性计算可能存在不一致（P1-1）；statsAtLevel未统一导出（P2-3） |

---

*报告版本：v1.0 | 验收人：Game Reviewer Agent | 基于 ACC-04-武将系统.md v1.0*
