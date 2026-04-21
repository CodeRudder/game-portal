# R8 迭代报告：UI合理性审计

> **审计日期**: 2025-07-11
> **审计范围**: `src/components/idle/` 下所有UI组件文件
> **审计版本**: 三国霸业 v1.0 R8
> **审计人**: Game Reviewer Agent

---

## A. 位置与尺寸问题

### P0 — 建筑升级弹窗 z-index 仅 60，在场景区内被覆盖 | `BuildingUpgradeModal.css:23` | 弹窗无法正常显示在最上层

`tk-upgrade-overlay` 的 `z-index: 60`，但场景区 `.tk-scene-area` 的 `z-index: 10`，建筑面板内的 `.tk-bld-queue` 是 `z-index: 30`。虽然升级弹窗使用 `position: fixed` 可以覆盖场景区，但与其他弹窗（Modal z-index:300, FeaturePanel z-index:300）相比严重偏低。如果同时触发其他弹窗（如随机遭遇 z-index:450），升级弹窗会被完全遮挡，用户无法操作。

**修复建议**: 将 `.tk-upgrade-overlay` 的 `z-index` 提升到 `350`，与其他业务弹窗对齐。

---

### P0 — 科技节点详情弹窗 z-index 仅 100，低于 FeatureMenu 下拉面板 | `TechNodeDetailModal.css:15` | 弹窗可能被遮挡

`tk-tech-detail-overlay` 的 `z-index: 100`，而 FeatureMenu 的下拉面板 `.tk-feature-menu-dropdown` 是 `z-index: 200`，通用 Modal 是 `z-index: 300`，FeaturePanel 是 `z-index: 300`。如果用户在科技Tab打开详情弹窗后触发其他弹窗，科技详情会被遮挡在下面。

**修复建议**: 将 `.tk-tech-detail-overlay` 的 `z-index` 提升到 `350`。

---

### P1 — Tab 按钮点击热区高度不足 44px（PC端 48px 容器但按钮无 min-height） | `ThreeKingdomsGame.css:138-153` | 触控设备体验差

`.tk-tab-btn` 使用 `flex: 1` + `max-width: 120px` 在 48px 高度的 tab 栏中拉伸，但按钮本身没有设置 `min-height: 44px`。在 PC 端 48px 容器中实际高度为 48px（满足要求），但在手机端容器缩减到 40px（`ThreeKingdomsGame.css:309`），按钮高度也降为 40px，低于 44px 的最小触控热区标准。

**修复建议**: 在手机端媒体查询中给 `.tk-tab-btn` 添加 `min-height: 44px`，或将手机端 tab 栏高度从 40px 改为 44px。

---

### P1 — 筛选按钮点击热区过小 | `HeroTab.css` / `NPCTab.css` | 触控设备体验差

武将Tab 的阵营筛选按钮 `.tk-hero-filter-btn` 的 padding 为 `5px 12px`，估算高度约 26px，远低于 44px 最小触控标准。NPC Tab 的 `.tk-npc-filter-btn` padding 为 `4px 10px`，同样过小。

**修复建议**: 将筛选按钮的 padding 增加到 `8px 14px`，确保总高度 ≥ 36px（PC端可适当放宽，但手机端必须 ≥44px）。

---

### P1 — 日历区域在 Tab 栏中可能溢出 | `ThreeKingdomsGame.tsx:576-594` + `ThreeKingdomsGame.css:181-216` | 窄屏下文字被截断

Tab 栏有 11 个 Tab 按钮 + FeatureMenu + 日历信息。在 1280px 宽度下，11 个 Tab（每个 max-width 120px = 1320px）+ FeatureMenu + 日历，总宽度远超 1280px。虽然 Tab 使用 `flex: 1` 会自动压缩，但日历区域 `.tk-calendar` 使用 `overflow: hidden` + `white-space: nowrap`，当日历文字较长（如"建安二十三年十月三十"）时会被截断，用户无法看到完整日期。

**修复建议**: 
1. 减少主 Tab 数量（如将"更多"Tab 合并掉低频功能）
2. 日历区域添加 `text-overflow: ellipsis` 或使用 tooltip 显示完整日期
3. 考虑将日历移到资源栏

---

### P1 — FeatureMenu 下拉面板在 Tab 栏底部可能被场景区遮挡 | `FeatureMenu.css:92-102` | 下拉菜单显示不全

`.tk-feature-menu-dropdown` 使用 `position: absolute; top: calc(100% + 6px)` 从 Tab 栏向下展开，但 Tab 栏的 `z-index: 90`，场景区的 `z-index: 10`。虽然 FeatureMenu 自身 `z-index: 100`（下拉面板 `z-index: 200`），但下拉面板的 `max-height: 420px` 在 800px 高度的游戏框中可能超出底部边界（Tab 栏在约 56+48=104px 位置，下拉面板底部 = 104+6+420=530px，尚在 800px 内，但内容多时底部可能被场景区的滚动内容遮挡视觉层）。

**修复建议**: 给下拉面板添加 `max-height: calc(100vh - 120px)` 或 `max-height: min(420px, calc(800px - 120px))` 限制。

---

### P2 — MoreTab 使用内联样式，无响应式适配 | `MoreTab.tsx` 全文件 | 手机端布局不合理

`MoreTab` 组件完全使用 `styles` 对象内联样式，没有 CSS 类和媒体查询。卡片 padding `18px 10px` 在手机端偏大，2列网格在小屏上间距不足。且按钮没有 hover 效果（inline style 不支持伪类）。

**修复建议**: 将 MoreTab 改为使用 CSS 类 + 媒体查询的方式，与其他面板保持一致。

---

### P2 — 武将详情弹窗 800px 宽度在 1280px 游戏框中占比过大 | `HeroDetailModal.css:23` | 视觉压迫感

`.tk-hero-detail-modal` 宽度 `800px`，在 1280px 游戏框中占比 62.5%，加上 `max-width: 95vw` 的限制，在较小屏幕上几乎全屏。弹窗左右分栏（左 220px + 右侧自适应），在 800px 宽度下右侧空间约 556px（减去 padding 和 gap），但雷达图 + 属性条 + 技能列表的纵向堆叠可能需要大量滚动。

**修复建议**: 考虑将弹窗宽度缩减到 `720px`，或在 1280px 以下使用全屏面板模式。

---

## B. 图层与遮挡问题

### P0 — z-index 层级体系混乱，缺乏统一规范 | 全局 | 弹窗叠加时遮挡关系不可预测

当前 z-index 分布：

| 层级 | z-index | 组件 |
|------|---------|------|
| 场景区 | 10 | `.tk-scene-area` |
| 建筑面板内部 | 10-30 | 建筑图标/队列 |
| Tab栏 | 90 | `.tk-tab-bar` |
| 资源栏 | 100 | `.tk-resource-bar` |
| FeatureMenu | 100/200 | 触发按钮/下拉面板 |
| 科技详情弹窗 | 100 | `.tk-tech-detail-overlay` |
| 建筑升级弹窗 | 60 | `.tk-upgrade-overlay` |
| 通用Panel | 200 | `.tk-panel-overlay` |
| 通用Modal | 300 | `.tk-modal-overlay` |
| FeaturePanel | 300 | `.tk-feature-panel-overlay` |
| NPC弹窗 | 350-400 | NPCInfo/NPCDialog |
| 武将详情/招募 | 400 | HeroDetail/Recruit |
| EventBanner | 500 | 急报横幅 |
| 随机遭遇 | 450 | RandomEncounterModal |
| 战斗布阵 | 1000 | BattleFormationModal |
| 战斗结果/扫荡 | 1100 | BattleResult/SweepModal |
| 武将升星/对比 | 1000 | HeroStarUp/HeroCompare |
| 战斗场景 | 1050 | BattleScene |
| 新手引导 | 10000 | GuideOverlay |
| Toast | 9999 | `.tk-toast-portal` |

**关键问题**:
1. 科技详情弹窗(100) < FeatureMenu下拉(200)，可能被遮挡
2. 建筑升级弹窗(60) 远低于其他弹窗
3. 战斗相关弹窗(1000-1100) 远高于通用弹窗(300)，但没有层级分组说明
4. Toast(9999) 和 GuideOverlay(10000) 几乎同级，Toast可能被引导遮挡
5. EventBanner(500) 高于通用弹窗(300)，如果弹窗打开时触发急报，横幅会遮挡弹窗内容

**修复建议**: 建立统一的 z-index 层级规范：
```
Layer 1 (10-50):   场景区内容
Layer 2 (90-99):   导航栏、Tab栏
Layer 3 (100-199): 资源栏、下拉菜单
Layer 4 (200-299): 通用面板、二级面板
Layer 5 (300-399): 通用弹窗、功能面板弹窗
Layer 6 (400-499): 业务弹窗（武将详情、NPC对话、事件）
Layer 7 (500-599): 系统通知（EventBanner）
Layer 8 (1000-1099): 全屏遮罩（战斗场景、战斗弹窗）
Layer 9 (9000-9999): Toast提示
Layer 10 (10000): 新手引导
```

---

### P1 — Toast z-index(9999) 与 GuideOverlay z-index(10000) 几乎同级 | `Toast.css:9` + `GuideOverlay.css:6` | 新手引导期间 Toast 被遮挡

新手引导的 `z-index: 10000` 高于 Toast 的 `z-index: 9999`，导致在新手引导期间如果触发 Toast 提示（如升级成功），Toast 会被引导遮罩覆盖，用户看不到反馈信息。

**修复建议**: 将 Toast 的 `z-index` 提升到 `10001`，确保始终在最顶层。

---

### P1 — EventBanner z-index(500) 高于功能面板弹窗(300) | `EventBanner.css:11` | 弹窗内操作被横幅遮挡

当用户正在操作 FeaturePanel 或 Modal 弹窗时，如果触发急报横幅（z-index:500），横幅会覆盖在弹窗上方，可能遮挡弹窗的标题栏或操作按钮。横幅的 `position: fixed; top: 12px` 使其始终在屏幕顶部，与弹窗的居中位置有重叠风险。

**修复建议**: 
1. 当有弹窗打开时，延迟显示急报横幅
2. 或将 EventBanner 的 z-index 降到 250（低于弹窗层级），仅在无弹窗时全层级显示

---

### P1 — 多个弹窗同时打开时无层级管理 | `ThreeKingdomsGame.tsx` | 弹窗叠加不可控

主组件中同时渲染了多个弹窗的入口：
- 离线收益弹窗（Modal, z:300）
- 10个 FeaturePanel（z:300）
- EventBanner（z:500）
- RandomEncounterModal（z:450）

如果用户在 FeaturePanel 打开时触发随机遭遇，两个弹窗同时存在（z:300 vs z:450），遭遇弹窗在上层。但用户关闭遭遇弹窗后，FeaturePanel 仍在底层，可能造成用户困惑。

**修复建议**: 实现弹窗队列管理，新弹窗打开时暂停/隐藏底层弹窗，关闭时恢复。

---

### P2 — Panel 组件无遮罩时 pointer-events 仍生效 | `Panel.css:5-9` | 误触底层元素

`.tk-panel-overlay` 默认 `pointer-events: none`，但当 `showOverlay` 为 false 时，面板本身 `pointer-events: auto`。如果面板位置不完全覆盖 overlay 区域，用户可能点击穿透到下方元素。这本身是设计意图，但缺少文档说明。

**修复建议**: 在 Panel 组件的 JSDoc 中明确说明 `showOverlay` 对 pointer-events 的影响。

---

## C. 导航与交互问题

### P0 — TechTab 使用 `window.innerWidth` 直接判断设备类型 | `TechTab.tsx:337` | SSR 报错 + 窗口缩放不响应

```tsx
{(window.innerWidth < 768 ? [activePath] : TECH_PATHS).map((path) => (
```

此代码在渲染时直接读取 `window.innerWidth`，存在两个问题：
1. **SSR/预渲染崩溃**: 在 Node.js 环境中 `window` 不存在，会抛出 `ReferenceError`
2. **不响应窗口缩放**: 用户调整浏览器窗口大小时，不会触发重新渲染，布局不会切换

**修复建议**: 使用 `useMemo` + `window.matchMedia('(max-width: 767px)')` 或自定义 hook 监听媒体查询变化。

---

### P1 — Tab 切换不保留子面板状态 | `ThreeKingdomsGame.tsx` renderSceneContent | 切换Tab丢失滚动位置和筛选状态

`renderSceneContent()` 使用 `switch(activeTab)` 直接渲染组件，每次切换 Tab 都会卸载旧组件并挂载新组件。这意味着：
- 武将Tab的筛选/排序状态会丢失
- 科技Tab的路线选择会重置
- 关卡Tab的章节选择和滚动位置会重置
- 建筑面板的升级队列滚动位置丢失

**修复建议**: 
1. 使用 CSS `display: none` 隐藏非活动 Tab，而非卸载组件
2. 或使用状态提升将各 Tab 的筛选状态保存到父组件

---

### P1 — FeaturePanel 关闭不确认未保存操作 | `FeaturePanel.tsx` | 数据丢失风险

FeaturePanel 的关闭按钮和 ESC 键直接调用 `onClose()`，没有检查面板内容是否有未保存的更改。例如：
- 商店面板中选择了商品但未确认购买
- 邮件面板中正在撰写回复
- 社交面板中正在输入消息

**修复建议**: 在 FeaturePanel 中添加 `beforeClose` 回调或 `hasUnsavedChanges` 属性，关闭前弹出确认对话框。

---

### P1 — 所有弹窗的 ESC 键监听会互相干扰 | 多个组件 | 意外关闭多个弹窗

以下组件都监听了 ESC 键：
- `Modal.tsx` (line 48-55)
- `Panel.tsx` (line 56-61)
- `FeaturePanel.tsx` (line 49-54)
- `FeatureMenu.tsx` (line 78-82)
- `BuildingUpgradeModal.tsx` (line 92-96)
- `TechNodeDetailModal.tsx` (line 108-110)

当多个弹窗叠加时（如 FeaturePanel + BuildingUpgradeModal），按一次 ESC 会同时触发所有弹窗的关闭回调，导致全部关闭而非只关闭最上层。

**修复建议**: 
1. 在 ESC 处理中检查 `e.defaultPrevented`，最上层弹窗关闭后 `preventDefault()` 阻止传播
2. 或实现弹窗栈管理，ESC 只关闭栈顶弹窗

---

### P2 — MoreTab 卡片按钮无 hover 反馈 | `MoreTab.tsx` | 交互体验差

MoreTab 使用内联样式，无法定义 `:hover` 伪类。用户鼠标悬停在功能卡片上时没有任何视觉反馈（无背景变化、无阴影、无边框高亮），降低了可交互性的感知。

**修复建议**: 将 MoreTab 改用 CSS 类，添加 hover 效果。

---

### P2 — 空状态提示不够丰富 | 多个面板 | 新手引导不足

以下面板的空状态提示仅显示文字，缺少引导性操作：
- 事件面板（FeaturePanel 内）："暂无活跃事件" — 没有解释如何触发事件
- NPC Tab：如果 `npcData` 为空数组，显示空列表但无空状态占位
- 科技Tab：无空状态处理（科技树始终有节点）

**修复建议**: 
1. 事件面板空状态添加"事件会在游戏过程中随机触发"的说明
2. NPC Tab 添加空状态组件（类似 HeroTab 的 `.tk-hero-empty`）

---

## D. 数据展示问题

### P1 — 资源数值格式化不统一 | 多个文件 | 大数显示不一致

数值格式化函数散布在多个文件中，逻辑不完全一致：

| 文件 | 函数 | 1万 | 100万 | 1亿 |
|------|------|------|-------|------|
| `ResourceBar.tsx` | `formatAmount` | 10,000 | 1.00M | 100.00M |
| `BuildingPanel.tsx` | `formatNum` | 10.0K | 1.0M | 100.0M |
| `BuildingUpgradeModal.tsx` | `formatNum` | 10.0K | 1.0M | 100.0M |

关键差异：
1. ResourceBar 在 1万时显示 `10,000`（带千分位），BuildingPanel 显示 `10.0K`
2. ResourceBar 的 M 精度是 2 位小数，BuildingPanel 是 1 位
3. 没有任何地方处理亿级（100M+）的缩写

**修复建议**: 
1. 创建统一的 `formatNumber(n: number): string` 工具函数
2. 规范：≥1万显示 `X.X万`，≥100万显示 `X.XM`，≥1亿显示 `X.X亿`
3. 所有面板统一引用

---

### P1 — 离线收益弹窗数值未格式化 | `ThreeKingdomsGame.tsx:530` | 大数显示不友好

离线收益弹窗中使用 `Math.floor(val).toLocaleString()` 格式化数值，当离线时间长、收益大时（如 1,234,567），显示为 `1,234,567`，不如缩写格式（`123.5万`）直观。

**修复建议**: 使用统一的数值格式化函数。

---

### P1 — 产出速率格式化缺少单位一致性 | `ResourceBar.tsx` formatRate | 速率显示混乱

```tsx
function formatRate(rate: number): string {
  if (rate === 0) return '';
  const sign = rate > 0 ? '+' : '';
  return `${sign}${rate.toFixed(1)}/秒`;
}
```

当速率非常小（如 0.0）或非常大（如 12345.6）时，显示为 `+0.0/秒` 或 `+12345.6/秒`，后者过长且不够直观。

**修复建议**: 
1. 速率为 0 时不显示（已实现）
2. 速率 < 0.05 时显示为 `<0.1/秒`
3. 速率 ≥ 1000 时使用缩写（如 `+1.2K/秒`）

---

### P2 — 容量进度条无百分比文字 | `ResourceBar.tsx` | 用户无法精确判断剩余容量

资源栏的容量进度条（`.tk-res-cap-bar`）仅通过颜色变化（绿→橙→红）提示容量状态，但没有显示具体百分比文字。当进度条宽度很窄时（如 30%），颜色差异不明显，用户难以判断是否接近上限。

**修复建议**: 在进度条旁或 tooltip 中显示百分比（如 `85%`）。

---

### P2 — 科技点数值未格式化 | `TechTab.tsx` | 大数显示不友好

科技点显示使用 `Math.floor(techPoints.current)`，当科技点积累到数万时，显示为 `12345`，不如 `12.3K` 直观。

**修复建议**: 使用统一的数值格式化函数。

---

## 汇总

| 等级 | 数量 | 说明 |
|------|------|------|
| **P0** | **3** | 必须修复，影响核心功能 |
| **P1** | **12** | 强烈建议修复，影响用户体验 |
| **P2** | **6** | 优化提升，改善整体品质 |
| **合计** | **21** | |

### P0 问题清单（必须修复）

| # | 问题 | 文件 |
|---|------|------|
| 1 | 建筑升级弹窗 z-index(60) 过低，被其他弹窗遮挡 | `BuildingUpgradeModal.css:23` |
| 2 | 科技详情弹窗 z-index(100) 低于 FeatureMenu 下拉面板 | `TechNodeDetailModal.css:15` |
| 3 | TechTab 使用 `window.innerWidth` 直接判断设备，SSR 崩溃 + 不响应窗口缩放 | `TechTab.tsx:337` |

### P1 问题清单（强烈建议）

| # | 问题 | 文件 |
|---|------|------|
| 4 | 手机端 Tab 按钮热区 < 44px | `ThreeKingdomsGame.css:309` |
| 5 | 筛选按钮热区过小（~26px） | `HeroTab.css` / `NPCTab.css` |
| 6 | 日历区域在窄屏下文字截断 | `ThreeKingdomsGame.css:181-216` |
| 7 | FeatureMenu 下拉面板可能超出底部边界 | `FeatureMenu.css:92-102` |
| 8 | z-index 层级体系混乱，缺乏统一规范 | 全局 |
| 9 | Toast(9999) 被新手引导(10000)遮挡 | `Toast.css:9` + `GuideOverlay.css:6` |
| 10 | EventBanner(500) 遮挡功能面板弹窗(300) | `EventBanner.css:11` |
| 11 | 多弹窗同时打开无层级管理 | `ThreeKingdomsGame.tsx` |
| 12 | Tab 切换不保留子面板状态 | `ThreeKingdomsGame.tsx` renderSceneContent |
| 13 | FeaturePanel 关闭不确认未保存操作 | `FeaturePanel.tsx` |
| 14 | 所有弹窗 ESC 键监听互相干扰 | 多个组件 |
| 15 | 资源数值格式化不统一 | 多个文件 |

### P2 问题清单（优化提升）

| # | 问题 | 文件 |
|---|------|------|
| 16 | MoreTab 使用内联样式，无响应式适配 | `MoreTab.tsx` |
| 17 | 武将详情弹窗 800px 宽度占比过大 | `HeroDetailModal.css:23` |
| 18 | Panel 组件无遮罩时 pointer-events 行为未文档化 | `Panel.css:5-9` |
| 19 | MoreTab 卡片按钮无 hover 反馈 | `MoreTab.tsx` |
| 20 | 空状态提示不够丰富 | 多个面板 |
| 21 | 容量进度条/科技点数值未格式化 | `ResourceBar.tsx` / `TechTab.tsx` |

---

## 修复优先级建议

### 第一批（P0，立即修复）
1. 统一 z-index 层级规范，修复 BuildingUpgradeModal 和 TechNodeDetailModal 的 z-index
2. 修复 TechTab 的 `window.innerWidth` 问题，改用 `matchMedia` 或自定义 hook

### 第二批（P1，本周修复）
3. 建立弹窗栈管理机制，解决 ESC 键冲突和多弹窗叠加问题
4. 统一数值格式化函数
5. 修复触控热区不足的问题
6. Tab 切换保留状态（CSS display 切换方案）

### 第三批（P2，下个迭代）
7. MoreTab 改用 CSS 类 + 响应式
8. 完善空状态提示
9. 优化弹窗尺寸和布局
