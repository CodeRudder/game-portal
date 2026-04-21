# NEW-R5: 三国霸业 UI 面板合理性深度审计

> **审计日期**: 2025-04-21  
> **审计范围**: `src/components/idle/panels/` 下全部 25 个面板模块（54 个 TSX 文件）  
> **审计基线**: 设计 token 系统（`ThreeKingdomsGame.css`）、共享组件（`Panel.tsx`/`Modal.tsx`）  
> **审计人**: Game Reviewer Agent

---

## 审计总览

| 维度 | 问题数 | P0 | P1 | P2 |
|------|--------|----|----|----|
| A. 面板布局一致性 | 8 | 2 | 4 | 2 |
| B. 按钮一致性 | 6 | 1 | 3 | 2 |
| C. 弹窗层级 | 7 | 2 | 3 | 2 |
| D. 移动端适配 | 16 | 3 | 8 | 5 |
| E. 列表滚动 | 6 | 1 | 3 | 2 |
| **合计** | **43** | **9** | **21** | **13** |

---

## A. 面板布局一致性

### 问题描述

项目定义了统一的设计 token（`--tk-gap-*`、`--tk-radius-*`、`--tk-text-*`）和共享 `Panel` 组件（含标准标题栏 + 内容区 + 滚动），但 **绝大多数面板未使用共享组件**，而是自行内联样式，导致布局模式严重碎片化。

### A-1. 外层 padding 不统一 [P1]

**现状**: 各面板外层 padding 存在 3 种不同值：

| padding 值 | 使用面板 |
|------------|---------|
| `12px` | AchievementPanel, AlliancePanel, HeritagePanel, PrestigePanel, QuestPanel, ActivityPanel, EquipmentPanel, EquipmentTab, ArenaTab, ArmyTab, ExpeditionTab, SocialPanel, ShopPanel, MailPanel |
| `16px` | MoreTab, TradePanel, SettingsPanel |
| `8px` | ArenaPanel (container) |

**标准**: 共享 `Panel.tsx` 内容区 padding 为 `16px`（`Panel.css` `.tk-panel-content { padding: 16px }`）。  
**影响**: 用户在不同面板间切换时，内容区宽窄不一，视觉跳动明显。  
**修复建议**: 统一为 `padding: 16px` 或使用 token `var(--tk-gap-md)`。所有 Tab 面板（作为 Tab 容器子页面）也应统一为 `12px` 或 `16px`，保持二选一。

### A-2. 标题样式碎片化 [P1]

**现状**: 标题的 fontSize / fontWeight / color / 标签类型在各面板间不统一：

| 面板 | 标签 | fontSize | fontWeight | color |
|------|------|----------|------------|-------|
| SettingsPanel | `<h3>` | 16 | 默认 | `#d4a574` |
| TradePanel | `<h3>` | 16 | 默认 | `#d4a574` |
| BuildingPanel (弹窗) | `<h3>` | 16 | 默认 | `#d4a574` |
| EquipmentPanel | `<span>` | 16 | 600 | `#d4a574` |
| MoreTab | `<span>` (styles.title) | 16 | 600 | `#d4a574` |
| AlliancePanel | `<span>` (styles.name) | 18 | 600 | `#d4a574` |
| PrestigePanel | `<span>` (styles.badge) | 20 | 600 | `#d4a574` |
| ArenaTab | 无独立标题 | — | — | — |
| 其他多数面板 | 无标题区 | — | — | — |

**标准**: 共享 Panel 标题为 `font-size: 15px; font-weight: 600; color: #f0e6d3`。  
**影响**: 标题大小从 13px 到 20px 不等，颜色在 `#d4a574` 和 `#f0e6d3` 间摇摆，缺乏统一感。  
**修复建议**: 定义 `--tk-panel-title-size: 16px` token，所有面板标题统一使用。

### A-3. 面板背景色不统一 [P1]

**现状**:
- 多数面板: `color: '#e8e0d0'`（暖白）
- TradePanel / SettingsPanel: `color: '#e0d5c0'`（偏冷白）
- 共享 Panel: 标题用 `#f0e6d3`，内容区无显式 color

**修复建议**: 统一使用 token `var(--tk-text-primary)`（即 `#F0E6D3`）。

### A-4. 卡片样式 3 种变体 [P2]

**现状**: 各面板的"卡片"组件有 3 种不同风格：

```css
/* 变体 A — 最常用 */
padding: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8

/* 变体 B — PrestigePanel */
padding: 16, borderRadius: 10, background: 'linear-gradient(135deg, rgba(212,165,116,0.12), rgba(212,165,116,0.04))'

/* 变体 C — ArenaPanel */
padding: 8, background: 'rgba(255,255,255,0.04)', borderRadius: 6
```

**修复建议**: 提取 `Card` 共享组件或统一 CSS class `.tk-card`。

### A-5. Toast/消息提示样式微差异 [P2]

**现状**: 所有面板都有 toast 消息提示，但细节不同：
- padding: `'8px 12px'` vs `'6px 12px'` vs `'6px 10px'`
- borderRadius: `6` vs `8`
- fontSize: `12` vs `13`

**修复建议**: 统一使用共享 `Toast.tsx` 组件，或提取 `tk-toast` CSS class。

### A-6. 大量面板未使用共享 Panel 组件 [P0]

**现状**: 在 25 个面板模块中，仅 **3 个** 使用了共享 `Panel` 组件：
- `ExpeditionPanel` ✅
- `ArenaPanel` ✅
- `TechOfflinePanel`（仅 Modal） ✅

其余 22 个面板均自行实现容器，导致：
- 标题栏样式不一致
- 打开/关闭动画缺失
- ESC 关闭支持缺失
- 滚动条样式不一致

**修复建议**: 所有弹出式面板统一使用 `<Panel>` 组件。Tab 内嵌面板可保持自定义容器，但需统一 padding/color。

### A-7. Section 标题样式不一致 [P1]

**现状**: 各面板的"区块标题"（如"获取途径""等级奖励"等）：
- fontSize: 13 / 14
- fontWeight: 600 / bold
- color: `#d4a574` / 无显式设置
- marginBottom: 4 / 6 / 8

**修复建议**: 定义 `.tk-section-title` class，统一 `fontSize: 14, fontWeight: 600, color: var(--tk-gold-soft)`。

### A-8. 进度条样式碎片化 [P1]

**现状**: 各面板进度条高度和圆角不同：
- height: 4 / 6 / 8
- borderRadius: 2 / 3 / 4
- fill 颜色: `#7EC850` / `linear-gradient(90deg, #d4a574, #e8c49a)`

**修复建议**: 定义 2 种标准进度条（小/大），提取为共享组件。

---

## B. 按钮一致性

### B-1. borderRadius 混乱 [P0]

**现状**: 项目定义了 token `--tk-radius-sm: 4px, --tk-radius-md: 6px, --tk-radius-lg: 8px`，但按钮 borderRadius 实际使用了以下值：

| borderRadius | 使用次数 | 典型场景 |
|-------------|---------|---------|
| 4 | 15+ | 小按钮、标签、排序按钮 |
| 6 | 30+ | 主操作按钮、Tab 按钮 |
| 8 | 10+ | 卡片、区域容器 |
| 10 | 5+ | 概览卡片（PrestigePanel, ArenaTab） |
| 12 | 5+ | 弹窗容器（ShopPanel, MailPanel） |

**修复建议**: 按钮统一使用 `var(--tk-radius-md)` 即 `6px`；卡片使用 `var(--tk-radius-lg)` 即 `8px`；弹窗容器使用 `12px`。消除 `10px` 和自定义值。

### B-2. 主操作按钮样式不统一 [P1]

**现状**: "领取""挑战""保存"等主操作按钮有 3 种风格：

```tsx
// 风格 A — 描边按钮（最常用）
border: '1px solid rgba(212,165,116,0.3)', borderRadius: 4-6, 
background: 'rgba(212,165,116,0.15)', color: '#d4a574'

// 风格 B — 实心按钮（SettingsPanel, TradePanel）
background: '#d4a574', color: '#1a1a2e', border: 'none', borderRadius: 6

// 风格 C — 渐变按钮（ExpeditionTab）
background: 'linear-gradient(135deg,#d4a574,#b8864a)', color: '#fff'
```

**修复建议**: 定义 2 种标准按钮样式（`tk-btn-primary` 实心 + `tk-btn-outline` 描边），全项目统一。

### B-3. Tab 按钮样式微差异 [P1]

**现状**: 各面板的 Tab 按钮激活态：
- 大部分: `background: 'rgba(212,165,116,0.2)', color: '#d4a574', borderColor: '#d4a574'`
- EquipmentTab filterBtn: 同上但 borderRadius: 4
- HeritagePanel: `borderColor: '#d4a574'` 但 border 默认色 `rgba(255,255,255,0.08)` (更浅)

**修复建议**: 提取 `.tk-tab` / `.tk-tab--active` CSS class。

### B-4. 按钮内 padding 不统一 [P2]

**现状**: 同类按钮的 padding 值差异大：
- 小按钮: `'3px 8px'` / `'4px 8px'` / `'4px 10px'` / `'5px 8px'`
- 中按钮: `'5px 10px'` / `'5px 14px'` / `'6px 12px'` / `'6px 14px'` / `'6px 16px'` / `'6px 20px'`
- 大按钮: `'8px 16px'` / `'10px 24px'`

**修复建议**: 定义 3 个尺寸 token（sm/md/lg），如 `--tk-btn-sm: 4px 10px`、`--tk-btn-md: 6px 14px`、`--tk-btn-lg: 8px 20px`。

### B-5. 关闭按钮位置和样式不一致 [P2]

**现状**:
- 共享 Panel: 右上角 `×` 按钮，`padding: 4px 8px`
- BuildingPanel 弹窗: 右上角 `✕` 按钮，`fontSize: 18`
- EquipmentPanel 详情: 底部"关闭"文字按钮
- MailPanel 详情: 底部"关闭"按钮

**修复建议**: 弹窗类统一使用共享 `Modal` 组件（已有标准关闭按钮位置）。

### B-6. 禁用态样式不统一 [P1]

**现状**:
- 部分面板: `opacity: 0.5` + `disabled` 属性
- 部分面板: 替换为灰色样式 `{ background: 'transparent', color: '#666', borderColor: 'rgba(255,255,255,0.06)', cursor: 'default' }`
- ArenaTab: 使用独立的 `S.disabled` 对象

**修复建议**: 定义 `.tk-btn:disabled` / `.tk-btn--disabled` 样式，统一为 `opacity: 0.5, cursor: not-allowed`。

---

## C. 弹窗层级（z-index）

### C-1. BuildingPanel 硬编码 zIndex: 1000 [P0]

**位置**: `BuildingPanel.tsx:373`
```tsx
zIndex: 1000,
```

**问题**: 硬编码 `1000` 与 token `--tk-z-offline-modal: 1000` 冲突。该弹窗会与离线收益弹窗争抢层级。  
**修复建议**: 改为 `zIndex: 'var(--tk-z-modal)' as any` 或使用共享 Modal 组件。

### C-2. ResourceBar 硬编码 z-index: 9999 [P0]

**位置**: `ResourceBar.css:317`
```css
z-index: 9999;
```

**问题**: `9999` 远超 token 系统定义的最高层级（`--tk-z-offline-modal: 1000`），会导致资源栏浮在所有弹窗之上，遮挡弹窗内容。  
**修复建议**: 改为 `z-index: var(--tk-z-guide-mask)`（900）或更低。资源栏应在面板之下。

### C-3. BuildingPanel.css 多处硬编码 z-index [P1]

**位置**: `BuildingPanel.css`
```css
z-index: 10;  /* 行 104 */
z-index: 20;  /* 行 110 */
z-index: 5;   /* 行 156, 215 */
```

**问题**: 面板内部元素使用硬编码 z-index，与 token 系统脱节。  
**修复建议**: 使用 CSS 层叠顺序（DOM 顺序）代替 z-index，或定义内部 token。

### C-4. BattleAnimation.css 硬编码 z-index [P1]

**位置**: `BattleAnimation.css`
```css
z-index: 15;  /* 行 206, 211, 237 */
z-index: 20;  /* 行 280 */
z-index: 30;  /* 行 327 */
```

**问题**: 战斗动画内部元素硬编码 z-index。  
**修复建议**: 使用相对层级或内部 token（如 `--tk-battle-z-base: 0`、`--tk-battle-z-effect: 10`、`--tk-battle-z-overlay: 20`）。

### C-5. 多处 z-index: 1 / 2 用于局部层叠 [P2]

**位置**: NPCInfoModal.css:58, RandomEncounterModal.css:71, ResourceBar.css:226, HeroCard.css:104, RecruitModal.css:43/238/242-245, GuideOverlay.css:20, BattleScene.css:137/152, WorldMapTab.css:146/216

**问题**: `z-index: 1` 和 `z-index: 2` 用于局部元素层叠（如徽章浮在卡片上方），虽风险较低但不规范。  
**修复建议**: 优先使用 CSS `isolation: isolate` 或 DOM 顺序解决局部层叠。

### C-6. HeroDetailModal.css z-index: 10 [P1]

**位置**: `HeroDetailModal.css:56`
```css
z-index: 10;
```

**问题**: 详情弹窗内元素使用 `z-index: 10`，可能与弹窗层级 token 冲突。  
**修复建议**: 使用局部层叠方案。

### C-7. CampaignTab.css z-index: 5 [P2]

**位置**: `CampaignTab.css:43`
```css
z-index: 5;
```

**问题**: Tab 内按钮使用 `z-index: 5`。  
**修复建议**: 移除，通过 DOM 顺序解决。

---

## D. 移动端适配

### 总览

| 状态 | 面板模块 |
|------|---------|
| ✅ 有适配 | building, campaign, event, hero, map, npc, resource, tech |
| ❌ 无适配 | **achievement, activity, alliance, arena, army, equipment, expedition, heritage, mail, more, prestige, pvp, quest, settings, shop, social, trade** |

**无适配面板占比: 17/25 = 68%**

### D-1. 17 个面板完全缺少移动端适配 [P0]

**影响面板**: achievement, activity, alliance, arena, army, equipment, expedition, heritage, mail, more, prestige, pvp, quest, settings, shop, social, trade

**问题**: 这些面板在移动端（<768px）可能出现：
- 内容溢出屏幕
- 文字过小无法点击
- 按钮触摸目标不足 44px
- 列表项过密

**修复建议**: 为每个面板添加 `@media (max-width: 767px)` 适配，至少包含：
1. 外层 padding 缩减（16px → 12px）
2. 卡片 padding 缩减
3. 字号适当放大（移动端最小 12px）
4. 按钮触摸区域 ≥ 44px

### D-2. 已有适配的面板质量参差不齐 [P1]

**building**: 适配较好（`BuildingPanel.css:282`，`BuildingUpgradeModal.css:250`）  
**campaign**: 有独立 `SweepPanel.mobile.css`，适配较完善  
**hero**: 6 个 CSS 文件有 `@media` 适配  
**npc**: 3 个 CSS 文件有适配  
**tech**: 4 个 CSS 文件有适配，且 TechTab.tsx 有 `isMobile` 状态检测  
**event**: 2 个 CSS 文件有适配  
**map**: 适配缺失确认  
**resource**: 有适配

**修复建议**: 以 campaign/hero 的适配质量为标杆，统一提升其他面板。

### D-3. 仅 TechTab 使用 JS 检测移动端 [P2]

**位置**: `TechTab.tsx:74`
```tsx
const [isMobile, setIsMobile] = useState(false);
```

**问题**: 只有 TechTab 使用 `useState + useEffect` 检测 `window.innerWidth`，其余面板完全依赖 CSS `@media`。两种方案混用增加维护成本。  
**修复建议**: 统一使用 CSS `@media` 方案。如需 JS 检测，提取共享 `useIsMobile()` hook。

### D-4. EquipmentPanel 装备网格在移动端溢出 [P1]

**位置**: `EquipmentPanel.tsx` styles.grid
```tsx
grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8 }
```

**问题**: `minmax(160px, 1fr)` 在 320px 宽设备上只能显示 1 列，但卡片内容（名称 + 属性 + 部位信息）在窄屏下可能溢出。  
**修复建议**: 添加 `@media (max-width: 767px) { gridTemplateColumns: '1fr' }` 或降低 `minmax` 最小值。

### D-5. ShopPanel/MailPanel 弹窗在移动端过宽 [P1]

**位置**: `ShopPanel.tsx:250`, `MailPanel.tsx:206`
```tsx
// ShopPanel
background: '#1a1a2e', border: '1px solid #d4a574', borderRadius: 12,
// MailPanel  
background: '#1a1a2e', border: '1px solid #d4a574', borderRadius: 12,
```

**问题**: 弹窗无 `maxWidth` 限制，在宽屏上可能过宽；在窄屏上无 `width: 95%` 适配。  
**修复建议**: 添加 `maxWidth: 480px, width: 'min(95vw, 480px)'`。

### D-6. SocialPanel 聊天区域固定高度 [P1]

**位置**: `SocialPanel.tsx`
```tsx
chatContainer: { display: 'flex', flexDirection: 'column', height: '50vh' },
```

**问题**: 固定 `50vh` 在移动端横屏时可能过矮，竖屏时可能过高。  
**修复建议**: 使用 `min-height: 200px; max-height: 50vh`。

### D-7. TradePanel 商贸路线无移动端适配 [P1]

**问题**: 商贸路线卡片使用 `flex + space-between`，在窄屏上路线名称和发送按钮可能重叠。  
**修复建议**: 添加 `@media (max-width: 767px)` 下 `flexDirection: 'column'`。

### D-8. AlliancePanel 创建表单无移动端适配 [P1]

**位置**: `AlliancePanel.tsx` styles.input
```tsx
input: { ..., width: 200, ... }
```

**问题**: 输入框固定 `width: 200`，在小屏上可能不够灵活。  
**修复建议**: 改为 `width: '100%', maxWidth: 200`。

### D-9. PrestigePanel 等级奖励列表在移动端过密 [P2]

**问题**: 奖励列表项 `padding: 10, gap: 8`，在移动端触摸目标偏小。  
**修复建议**: 移动端增大 padding 至 `12px`。

### D-10. QuestPanel 活跃度里程碑按钮过小 [P2]

**位置**: `QuestPanel.tsx`
```tsx
msBtn: { padding: '3px 8px', ..., fontSize: 10 }
```

**问题**: `3px 8px` + `fontSize: 10` 在移动端远低于 44px 触摸目标。  
**修复建议**: 移动端 padding 增大至 `8px 14px`，fontSize 至少 `12px`。

### D-11. HeritagePanel 统计概览 4 列在移动端过挤 [P2]

**位置**: `HeritagePanel.tsx`
```tsx
overview: { display: 'flex', gap: 8, ... }
statItem: { flex: 1, textAlign: 'center' }
```

**问题**: 4 个统计项平分宽度，在 320px 屏幕上每项仅 74px，数字和标签可能换行混乱。  
**修复建议**: 移动端改为 `flex-wrap: wrap`，每行 2 个。

### D-12. MoreTab 2 列网格在移动端可接受但无优化 [P2]

**位置**: `MoreTab.tsx`
```tsx
grid: { gridTemplateColumns: '1fr 1fr', gap: 10 }
```

**问题**: 2 列布局本身适合移动端，但卡片内 `fontSize: 30` 的图标 + `fontSize: 13` 的文字无移动端调整。  
**修复建议**: 添加 `@media` 适当调整间距。

### D-13. ArenaTab 对手列表在移动端缺少滚动限制 [P1]

**问题**: 对手列表无 `maxHeight` 限制，在移动端如果对手数量多，会撑开面板导致底部操作按钮被推到视口外。  
**修复建议**: 添加 `maxHeight: '40vh', overflowY: 'auto'`。

### D-14. SettingsPanel 无移动端适配 [P1]

**问题**: 设置面板 `padding: 16`，开关按钮 `padding: '4px 12px'`，在移动端触摸目标不足。  
**修复建议**: 移动端 padding 缩减至 `12px`，开关按钮增大至 `8px 16px`。

### D-15. ArmyTab 容器无移动端适配 [P2]

**位置**: `ArmyTab.tsx`
```tsx
container: { padding: 12, color: '#e8e0d0', minHeight: '100%', overflow: 'auto' }
```

**问题**: 虽有 `overflow: 'auto'`，但无 `@media` 适配，内部元素在小屏上可能溢出。  
**修复建议**: 添加基础 `@media` 断点。

### D-16. ExpeditionPanel/ExpeditionTab 移动端缺失 [P1]

**问题**: 远征面板有列表和路线详情，在移动端需要适配滚动和布局。  
**修复建议**: 添加 `@media` 适配。

---

## E. 列表滚动

### E-1. HeritagePanel 传承记录列表无滚动限制 [P0]

**位置**: `HeritagePanel.tsx`
```tsx
historySection: { padding: 10, borderRadius: 8, ... }
```

**问题**: 传承记录列表（`state.heritageHistory.slice(-3).reverse().map(...)`）无 `maxHeight` 和 `overflow` 设置。虽然当前限制为最近 3 条，但如果未来扩展为更多记录，会导致面板无限拉长。  
**修复建议**: 添加 `maxHeight: '30vh', overflowY: 'auto'`。

### E-2. AchievementPanel 成就列表无滚动限制 [P1]

**问题**: 成就列表直接 `.map()` 渲染，无 `maxHeight` 和 `overflow`。当成就数量增多时（5 个维度 × 多个成就），面板会无限拉长。  
**修复建议**: 添加 `maxHeight: '60vh', overflowY: 'auto'` 包裹列表。

### E-3. AlliancePanel 成员列表无滚动限制 [P1]

**问题**: 成员列表（`members.map(...)`）无滚动限制。大型联盟可能有 50+ 成员。  
**修复建议**: 添加 `maxHeight: '50vh', overflowY: 'auto'`。

### E-4. QuestPanel 任务列表无滚动限制 [P1]

**问题**: 任务列表直接 `.map()` 渲染，无滚动限制。日常任务可能有 10+ 条。  
**修复建议**: 添加 `maxHeight: '60vh', overflowY: 'auto'`。

### E-5. EquipmentPanel 装备网格无滚动限制 [P2]

**位置**: `EquipmentPanel.tsx`
```tsx
grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8 }
```

**问题**: 装备网格无 `maxHeight` 和 `overflow`。背包容量 100，满背包时面板极长。  
**修复建议**: 添加 `maxHeight: '65vh', overflowY: 'auto'`。

### E-6. ArenaTab 排行榜弹窗无滚动限制 [P2]

**位置**: `ArenaTab.tsx`
```tsx
rankList: { display: 'flex', flexDirection: 'column', gap: 4 }
```

**问题**: 排行榜弹窗内列表无 `maxHeight`，当前取 top 10 影响有限，但若扩展为 top 100 则溢出。  
**修复建议**: 添加 `maxHeight: '50vh', overflowY: 'auto'`。

---

## 修复优先级总表

### P0 — 必须修复（影响功能/层级冲突）

| # | 问题 | 影响 | 修复工作量 |
|---|------|------|-----------|
| A-6 | 22/25 面板未使用共享 Panel 组件 | 标题/动画/ESC/滚动全部不一致 | 大（建议分批迁移） |
| B-1 | borderRadius 混乱，未使用 token | 视觉不一致 | 中（全局替换） |
| C-1 | BuildingPanel zIndex: 1000 硬编码 | 与离线弹窗层级冲突 | 小（1 行修改） |
| C-2 | ResourceBar z-index: 9999 | 资源栏遮挡所有弹窗 | 小（1 行修改） |
| D-1 | 17 个面板无移动端适配 | 移动端体验严重受损 | 大（建议分批） |
| D-4 | EquipmentPanel 网格移动端溢出 | 移动端装备卡片溢出 | 小 |
| E-1 | HeritagePanel 列表无滚动 | 面板无限拉长 | 小 |

### P1 — 强烈建议修复

| # | 问题 | 面板数 |
|---|------|--------|
| A-1 | 外层 padding 不统一 | 15+ |
| A-2 | 标题样式碎片化 | 10+ |
| A-3 | 面板背景色不统一 | 5+ |
| A-7 | Section 标题不一致 | 10+ |
| A-8 | 进度条样式碎片化 | 8+ |
| B-2 | 主操作按钮 3 种风格 | 10+ |
| B-3 | Tab 按钮微差异 | 8+ |
| B-6 | 禁用态样式不统一 | 6+ |
| C-3 | BuildingPanel.css 硬编码 z-index | 1 |
| C-4 | BattleAnimation.css 硬编码 z-index | 1 |
| C-6 | HeroDetailModal z-index: 10 | 1 |
| D-2 | 已有适配质量参差 | 8 |
| D-5 | Shop/Mail 弹窗移动端宽度 | 2 |
| D-6 | SocialPanel 聊天固定高度 | 1 |
| D-7 | TradePanel 移动端布局 | 1 |
| D-8 | AlliancePanel 输入框宽度 | 1 |
| D-13 | ArenaTab 对手列表无滚动限制 | 1 |
| D-14 | SettingsPanel 无适配 | 1 |
| D-16 | ExpeditionPanel 无适配 | 2 |
| E-2 | AchievementPanel 无滚动 | 1 |
| E-3 | AlliancePanel 无滚动 | 1 |
| E-4 | QuestPanel 无滚动 | 1 |

### P2 — 优化提升

| # | 问题 |
|---|------|
| A-4 | 卡片 3 种变体 |
| A-5 | Toast 微差异 |
| B-4 | 按钮 padding 不统一 |
| B-5 | 关闭按钮位置不一致 |
| C-5 | 局部 z-index: 1/2 |
| C-7 | CampaignTab z-index: 5 |
| D-3 | JS/CSS 混用移动检测 |
| D-9 | PrestigePanel 移动端过密 |
| D-10 | QuestPanel 里程碑按钮过小 |
| D-11 | HeritagePanel 4 列过挤 |
| D-12 | MoreTab 无优化 |
| D-15 | ArmyTab 无适配 |
| E-5 | EquipmentPanel 网格无滚动 |
| E-6 | ArenaTab 排行榜无滚动 |

---

## 推荐修复路线图

### Phase 1 — 紧急修复（1-2 天）
1. 修复 C-1、C-2（z-index 硬编码冲突）— 各 1 行改动
2. 修复 E-1（HeritagePanel 滚动）
3. 修复 D-4（EquipmentPanel 网格溢出）

### Phase 2 — 设计系统统一（3-5 天）
1. 定义缺失的 CSS token（`--tk-panel-title-size`、`--tk-btn-*`）
2. 提取共享组件：`Card`、`SectionTitle`、`ProgressBar`、`TabBar`
3. 统一 borderRadius 使用 token
4. 统一按钮样式（`tk-btn-primary`、`tk-btn-outline`、`tk-btn-sm`）

### Phase 3 — 面板迁移（5-7 天）
1. 将弹出式面板迁移到共享 `Panel`/`Modal` 组件
2. Tab 内嵌面板统一容器样式
3. 分批为 17 个无适配面板添加移动端 `@media`

### Phase 4 — 精细打磨（3-5 天）
1. 统一禁用态、Toast、进度条样式
2. 清理局部 z-index
3. 移动端触摸目标优化
4. 列表滚动限制完善

---

## 附录：面板清单与问题矩阵

| 面板 | 布局(A) | 按钮(B) | 层级(C) | 移动端(D) | 滚动(E) |
|------|---------|---------|---------|-----------|---------|
| AchievementPanel | ⚠️ | ⚠️ | ✅ | ❌ | ⚠️ |
| ActivityPanel | ⚠️ | ⚠️ | ✅ | ❌ | ✅ |
| AlliancePanel | ⚠️ | ⚠️ | ✅ | ❌ | ⚠️ |
| ArenaPanel | ⚠️ | ⚠️ | ✅ | ❌ | ✅ |
| ArenaTab | ⚠️ | ⚠️ | ✅ | ❌ | ⚠️ |
| ArmyTab | ⚠️ | ⚠️ | ✅ | ❌ | ✅ |
| BuildingPanel | ⚠️ | ⚠️ | ❌ | ✅ | ✅ |
| CampaignTab | ✅ | ✅ | ⚠️ | ✅ | ✅ |
| EquipmentPanel | ⚠️ | ⚠️ | ✅ | ❌ | ⚠️ |
| EquipmentTab | ⚠️ | ⚠️ | ✅ | ❌ | ✅ |
| EventBanner | ✅ | ✅ | ✅ | ✅ | ✅ |
| ExpeditionPanel | ⚠️ | ⚠️ | ✅ | ❌ | ✅ |
| ExpeditionTab | ⚠️ | ⚠️ | ✅ | ❌ | ✅ |
| HeritagePanel | ⚠️ | ⚠️ | ✅ | ❌ | ⚠️ |
| HeroTab | ✅ | ✅ | ⚠️ | ✅ | ✅ |
| MailPanel | ⚠️ | ⚠️ | ✅ | ❌ | ✅ |
| MoreTab | ⚠️ | ✅ | ✅ | ❌ | ✅ |
| NPCDialogModal | ✅ | ✅ | ✅ | ✅ | ✅ |
| NPCInfoModal | ✅ | ✅ | ⚠️ | ✅ | ✅ |
| NPCTab | ✅ | ✅ | ✅ | ✅ | ✅ |
| PrestigePanel | ⚠️ | ⚠️ | ✅ | ❌ | ✅ |
| QuestPanel | ⚠️ | ⚠️ | ✅ | ❌ | ⚠️ |
| ResourceBar | ✅ | ✅ | ❌ | ✅ | ✅ |
| SettingsPanel | ⚠️ | ⚠️ | ✅ | ❌ | ✅ |
| ShopPanel | ⚠️ | ⚠️ | ✅ | ❌ | ✅ |
| SocialPanel | ⚠️ | ⚠️ | ✅ | ❌ | ✅ |
| TechTab | ✅ | ✅ | ✅ | ✅ | ✅ |
| TradePanel | ⚠️ | ⚠️ | ✅ | ❌ | ✅ |
| WorldMapTab | ✅ | ✅ | ⚠️ | ✅ | ✅ |

> ✅ = 通过 / ⚠️ = 存在问题 / ❌ = 严重缺失
