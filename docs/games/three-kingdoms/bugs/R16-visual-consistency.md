# R16 — UI 视觉一致性审计报告

> **审计日期**：2025-07-11  
> **审计范围**：`src/components/idle/panels/` 下所有面板组件  
> **审计版本**：R16 迭代  

---

## 一、审计概览

| 维度 | 严重程度 | 问题数 |
|------|----------|--------|
| A. 颜色一致性 | 🔴 严重 | 8 |
| B. 字体一致性 | 🟡 中等 | 5 |
| C. 间距一致性 | 🟡 中等 | 4 |
| D. 按钮样式一致性 | 🔴 严重 | 6 |
| E. 面板头部一致性 | 🟡 中等 | 4 |
| F. 弹窗实现一致性 | 🔴 严重 | 5 |
| **合计** | | **32** |

---

## 二、详细问题列表

### A. 颜色一致性（8 个问题）

#### A-01 🔴 强调色 `#d4a574` vs `#C9A84C` 混用
- **位置**：MailPanel、ShopPanel、ExpeditionPanel、EquipmentPanel、SocialPanel 等使用 `#d4a574`
- **CSS变量**：`--tk-gold: #C9A84C`、`--tk-gold-light: #E8D48B`
- **公共组件**：FeaturePanel 标题使用 `var(--tk-gold, #C9A84C)`
- **问题**：`#d4a574` 是偏暖的铜金色，`#C9A84C` 是正金色。两套颜色在面板间交替出现，视觉上不够统一
- **影响范围**：~60 处内联样式引用 `#d4a574`

#### A-02 🔴 文字主色 `#e8e0d0` vs `#f0e6d3` vs `#e0d8c8` 三色混用
- **位置**：
  - 内联样式面板（Mail/Shop/Expedition/Social/Equipment）→ `#e8e0d0`
  - CSS变量 `--tk-text-primary` → `#f0e6d3`
  - NPCDialogModal.css → `#e0d8c8`
  - NPCInfoModal.css → `#e0d8c8`
- **问题**：三种暖白色混用，在相邻面板切换时能感知到色差

#### A-03 🟡 次要文字色 `#a0a0a0` vs `#888` 混用
- **位置**：`#a0a0a0` 出现在大多数面板，`#888` 出现在 MailPanel（mailSender、activeTabInactive）、ShopPanel（goodsDesc、limitInfo）
- **CSS变量**：`--tk-text-secondary: #A0A0A0`、`--tk-text-dim: #888`

#### A-04 🔴 品质颜色体系不统一
- **EquipmentPanel**（来自 `equipment.types.ts`）：
  - `white: #B0B0B0, green: #5CB85C, blue: #4A90D9, purple: #9B59B6, gold: #D4A843`
- **ArmyTab**（本地 `QUALITY_COLORS`）：
  - `LEGENDARY: #ff9800, EPIC: #c77dff, RARE: #4fc3f7, UNCOMMON: #7EC850, COMMON: #a0a0a0`
- **HeroCard.css**（CSS类）：
  - `legendary: rgba(201,168,76)`, `epic: rgba(212,85,58)`, `rare: rgba(155,109,191)`, `fine: rgba(91,139,212)`, `common: rgba(139,154,107)`
- **问题**：三套完全不同的品质色系，同一品质在不同面板显示不同颜色

#### A-05 🟡 NPC关系颜色未使用CSS变量
- **位置**：NPCTab.tsx、NPCInfoModal.tsx 中 `RELATION_COLORS` / `RELATION_META`
  - `hostile: #b8423a`, `neutral: #a0a0a0`, `friendly: #52a349`, `trusted: #3498db`, `bonded: #c9a84c`
- **问题**：这些颜色与 `--tk-red: #B8423A`、`--tk-blue: #3498DB` 等变量值相同但未引用变量

#### A-06 🟡 硬编码颜色值未使用CSS变量
- **位置**：所有使用内联样式的面板（Mail/Shop/Expedition/Social/Equipment/Arena/Army/Heritage/Activity/Prestige/Alliance/Quest/Achievement）
- **统计**：约 100+ 处 `#xxxxxx` 硬编码颜色值
- **问题**：无法通过修改CSS变量实现全局换肤

#### A-07 🟡 TechTab颜色体系与全局不一致
- **位置**：TechTab.css
  - 使用 `#DC2626`/`#FCA5A5`（Tailwind红）、`#D97706`/`#FCD34D`（Tailwind黄）、`#7C3AED`/`#C4B5FD`（Tailwind紫）
  - 全局变量使用 `--tk-red: #B8423A`、`--tk-orange: #D4A017`、`--tk-purple: #7B5EA7`
- **问题**：TechTab 似乎使用了 Tailwind 色板而非项目配色方案

#### A-08 🟡 成功色 `#7EC850` vs `#27ae60` 混用
- **位置**：ExpeditionPanel/ExpeditionTab → `#7EC850`；TechTab.css → `#27ae60`
- **CSS变量**：`--tk-green: #7EC850`、`--tk-success: #27ae60`
- **问题**：两个绿色语义不同但用法重叠

---

### B. 字体一致性（5 个问题）

#### B-01 🔴 面板标题字号不统一
| 面板 | 标题字号 | 位置 |
|------|----------|------|
| FeaturePanel | 16px | FeaturePanel.css |
| Panel (公共) | 15px | Panel.css |
| Modal (公共) | 16px | Modal.css |
| EquipmentPanel | 16px | 内联 |
| ExpeditionPanel | 13px | 内联 |
| ExpeditionTab | 14px (sectionTitle) | 内联 |
| ArmyTab | 13-14px | 内联 |
| HeritagePanel | 14px | 内联 |
| ActivityPanel | 14px | 内联 |
| PrestigePanel | 14px | 内联 |
| ArenaTab | 16px (modalTitle) | 内联 |

**问题**：标题字号从 13px 到 16px 不等，缺乏统一规范

#### B-02 🟡 正文字号混用
- **11px**：MailPanel(mailSender)、ExpeditionPanel(btn)、ShopPanel(goodsDesc)
- **12px**：MailPanel(toast)、ShopPanel(tabBtn)、ExpeditionTab(toast)
- **13px**：MailPanel(mailTitle)、EquipmentPanel(cardName)、ArmyTab(heroName)
- **14px**：ShopPanel(goodsName)、ExpeditionTab(sectionTitle)
- **问题**：正文内容字号从 11px 到 14px 跨度较大

#### B-03 🟡 fontWeight 不统一
- 标题 `fontWeight: 600`（大多数面板）
- 标题 `fontWeight: 700`（ExpeditionTab.modalTitle）
- 标题 `fontWeight: 500`（MoreTab.cardTitle）
- **问题**：同一层级标题粗细不一致

#### B-04 🟡 数字未使用等宽字体
- **CSS变量**：`--tk-font-num: 'Impact', 'Arial Narrow', monospace` 已定义
- **实际使用**：所有面板的数字显示均未应用该字体
- **问题**：资源数量、战斗力等数字在变化时会产生宽度抖动

#### B-05 🟡 面板内容行高不一致
- MailPanel.detailContent: `lineHeight: 1.6`
- Modal公共: `line-height: 1.6`
- 其他面板: 未显式设置（依赖浏览器默认 ~1.2）

---

### C. 间距一致性（4 个问题）

#### C-01 🔴 面板内边距不统一
| 面板 | 容器 padding |
|------|-------------|
| Mail/Shop/Social/Equipment/Army/Heritage/Activity/Arena | 12px |
| ExpeditionPanel | 8px |
| ArenaPanel (PvP) | 8px |
| Achievement/Quest/Alliance/Prestige | 12px (wrap) |
| FeaturePanel-body | 0（由子面板自带） |

**问题**：ExpeditionPanel 和 ArenaPanel 使用 8px，其他面板使用 12px

#### C-02 🟡 卡片间距不统一
- 卡片 marginBottom：4px（ExpeditionPanel.routeCard）、6px（AchievementPanel.card、QuestPanel.card）、8px（ExpeditionTab.routeCard）
- 卡片 padding：8px（ExpeditionPanel）、10px（Achievement/Quest/Social）、12px（Army.formationBox）

#### C-03 🟡 按钮内边距不统一
| 按钮类型 | padding |
|---------|---------|
| 小按钮 | `4px 10px`（ExpeditionPanel.btn） |
| Tab按钮 | `4px 10px`（Mail.tabBtn）、`5px 10px`（Mail.activeTabInactive） |
| 中按钮 | `6px 14px`（Mail.attachmentBtn）、`6px 14px`（ExpeditionTab.btnPrimary） |
| 操作按钮 | `8px 12px`（ExpeditionTab.btnAction）、`8px`（EquipmentPanel.actionBtn） |
| 确认按钮 | `8px 20px`（Modal公共） |

#### C-04 🟡 Section标题下边距不统一
- `marginBottom: 4`（Heritage.accelTitle、Activity.signInTitle）
- `marginBottom: 6`（Expedition.title）
- `marginBottom: 8`（Expedition.sectionTitle、Army.sectionTitle、Prestige.sectionTitle）
- `marginBottom: 10`（Army.formationTitle）
- `marginBottom: 12`（Equipment.sectionTitle）

---

### D. 按钮样式一致性（6 个问题）

#### D-01 🔴 按钮圆角不统一
- **3px**：EquipmentPanel.rarityTab
- **4px**：Mail.tabBtn、ExpeditionPanel.btn、ExpeditionTab.btnSmall
- **6px**：大多数按钮（Modal公共、Mail.attachmentBtn、Shop.buyBtn、Equipment.actionBtn）
- **8px**：ExpeditionTab.btnAction、ExpeditionTab.routeCard
- **10px**：MoreTab.card
- **CSS变量**：`--tk-radius-sm: 4px, --tk-radius-md: 6px, --tk-radius-lg: 8px` 已定义但未被内联样式使用

#### D-02 🔴 按钮悬停效果缺失
- **有悬停效果**：Panel公共（close/collapse）、Modal公共（close/btn）、FeaturePanel（close）、HeroCard（CSS hover）
- **无悬停效果**：所有内联样式按钮（Mail/Shop/Expedition/Equipment/Social/Arena/Army等）
- **问题**：内联样式无法定义 `:hover` 伪类，导致大量按钮缺少悬停反馈

#### D-03 🔴 按钮按下效果缺失
- **有 active 反馈**：Panel/Modal/FeaturePanel 公共组件（`transform: scale(0.97)`）
- **无 active 反馈**：所有内联样式按钮
- **问题**：内联样式按钮缺少按下缩放反馈

#### D-04 🟡 禁用状态样式不统一
- **ShopPanel**：`opacity: 0.5, cursor: 'not-allowed'`（内联）
- **Modal公共**：`opacity: 0.5, cursor: not-allowed`（CSS）
- **ExpeditionTab**：`opacity: 0.4`（内联，用在路由卡片上）
- **BuildingUpgradeModal**：使用 CSS class `tk-upgrade-btn--disabled`
- **问题**：禁用状态实现方式不统一

#### D-05 🟡 主操作按钮样式不统一
- **ExpeditionTab.btnPrimary**：渐变背景 `linear-gradient(135deg,#d4a574,#b8864a)`，白色文字，无边框
- **Modal确认按钮**：半透明背景 `rgba(200,168,76,0.2)`，金色边框 `#c9a84c`，金色文字
- **Shop/Equipment 确认按钮**：半透明背景 `rgba(212,165,116,0.2)`，铜金色边框
- **问题**：三种不同的"主操作"按钮视觉语言

#### D-06 🟡 次要按钮/取消按钮样式不统一
- **Modal取消按钮**：`border: 1px solid rgba(200,168,76,0.3)`，灰色文字
- **Mail/Shop/Equipment 取消按钮**：`border: 1px solid rgba(255,255,255,0.1)`，灰色文字
- **问题**：边框颜色和文字颜色不同

---

### E. 面板头部一致性（4 个问题）

#### E-01 🔴 头部实现方式分裂
- **使用公共 Panel 组件**：ExpeditionPanel、ArenaPanel（导入 `Panel` from `common/Panel`）
- **使用 FeaturePanel 组件**：Mail、Shop、Social、Equipment、Achievement、Quest、Alliance、Prestige、Heritage、Activity（通过 FeaturePanel 弹窗承载）
- **使用 CSS 类**：NPCTab、TechTab、HeroTab、BuildingPanel、CampaignTab（独立 CSS 文件）
- **使用内联样式**：EquipmentPanel、ExpeditionTab、ArmyTab、ArenaTab、MoreTab（Tab内自建头部）
- **问题**：四种头部实现方式并存，视觉细节难以统一

#### E-02 🟡 标题颜色不一致
- **FeaturePanel 标题**：`color: var(--tk-gold, #C9A84C)` → 正金色
- **Panel 公共标题**：`color: #f0e6d3` → 暖白色
- **Modal 公共标题**：`color: #f0e6d3` → 暖白色
- **内联标题**：`color: '#d4a574'` → 铜金色
- **问题**：标题颜色有金色和白色两种风格

#### E-03 🟡 关闭按钮位置和样式不一致
- **Panel 公共**：右上角，`padding: 4px 8px`，`font-size: 14px`，`border-radius: 4px`
- **Modal 公共**：右上角绝对定位，`padding: 4px 8px`，`font-size: 14px`，`border-radius: 4px`
- **FeaturePanel**：右上角，`28×28px`，`border-radius: 6px`，有边框
- **内联关闭按钮**：各面板自行定义，大小、圆角、位置各异

#### E-04 🟡 子Tab导航样式不统一
- **CSS实现**：NPCTab（`.tk-npc-filter-btn`）、HeroTab（`.tk-hero-sub-tab`）→ 使用 CSS 类
- **内联实现**：Mail/Shop/Social（`tabBtn` + `activeTab`）→ 使用内联样式
- **差异**：
  - CSS 版有 hover 过渡效果
  - 内联版无 hover 效果
  - active 状态背景色略有差异（CSS用变量，内联用 `rgba(212,165,116,0.2)`）

---

### F. 弹窗实现一致性（5 个问题）

#### F-01 🔴 弹窗遮罩层实现不统一
- **使用公共 Modal 组件**：ExpeditionPanel、ArenaPanel、TechOfflinePanel、SiegeConfirmModal
- **自建遮罩层**：Mail/Shop/Equipment/ExpeditionTab/ArenaTab → 各自实现 `position: fixed` + `rgba(0,0,0,0.5~0.6)` 遮罩
- **使用 CSS 类**：HeroDetailModal/HeroStarUpModal/RecruitModal → 使用 CSS 类名 `.tk-starup-overlay` 等
- **问题**：遮罩层透明度从 0.5 到 0.6 不等，入场动画有无不一

#### F-02 🔴 弹窗面板背景色不统一
- **公共 Modal**：`background: rgba(26, 35, 50, 0.97)`
- **FeaturePanel**：`background: rgba(20, 25, 35, 0.98)`
- **内联弹窗**（Mail/Shop/Equipment）：`background: '#1a1a2e'`
- **ExpeditionTab.modal**：`background: '#2a2520'`
- **问题**：四种不同的弹窗背景色

#### F-03 🔴 弹窗边框样式不统一
- **公共 Modal**：`border: 2px solid rgba(200, 168, 76, 0.5)` → 2px 金色边框
- **FeaturePanel**：`border: 1px solid rgba(200, 168, 76, 0.3)` → 1px 淡金色边框
- **内联弹窗**：`border: '1px solid #d4a574'` → 1px 铜金色边框
- **问题**：边框宽度和颜色都不一致

#### F-04 🟡 弹窗圆角不统一
- **公共 Modal**：`border-radius: 10px`
- **FeaturePanel**：`border-radius: 12px`
- **内联弹窗**：`borderRadius: 12`（Mail/Shop/Equipment）
- **ExpeditionTab.modal**：`borderRadius: 12`

#### F-05 🟡 弹窗入场动画不统一
- **公共 Modal**：`scale(0.8) → scale(1)` + `cubic-bezier(0.34, 1.56, 0.64, 1)` 弹性动画
- **FeaturePanel**：`translateY(12px) scale(0.97) → translateY(0) scale(1)` 滑入动画
- **内联弹窗**：无入场动画
- **CSS弹窗**：各有不同（HeroStarUpModal 有独立动画）

---

## 三、建议的统一样式规范

### 3.1 颜色规范

```css
/* 统一到 CSS 变量 */
:root {
  /* 强调色 — 统一为 #C9A84C */
  --tk-gold: #C9A84C;
  --tk-gold-light: #E8D48B;
  
  /* 文字色 */
  --tk-text-primary: #F0E6D3;   /* 主文字 */
  --tk-text-secondary: #A0A0A0; /* 次文字 */
  --tk-text-muted: #666;        /* 弱文字 */
  --tk-text-dim: #888;          /* 辅助文字 */
  
  /* 语义色 */
  --tk-success: #7EC850;
  --tk-warning: #D4A017;
  --tk-danger: #B8423A;
  --tk-info: #3498DB;
  
  /* 品质色 — 统一 */
  --tk-quality-common: #8B9A6B;
  --tk-quality-fine: #5B8BD4;
  --tk-quality-rare: #9B6DBF;
  --tk-quality-epic: #D4553A;
  --tk-quality-legendary: #C9A84C;
}
```

### 3.2 字体规范

| 用途 | 字号 | 字重 | 行高 |
|------|------|------|------|
| 面板标题 | 16px | 600 | 1.4 |
| 区块标题 | 14px | 600 | 1.4 |
| 正文内容 | 13px | 400 | 1.6 |
| 辅助文字 | 12px | 400 | 1.5 |
| 标签/徽章 | 11px | 400 | 1.4 |
| 数字显示 | 13px | 600 | 1.4 (font-variant-numeric: tabular-nums) |

### 3.3 间距规范

| 用途 | 值 |
|------|-----|
| 面板容器内边距 | 12px |
| 区块间距 | 12px |
| 卡片间距 | 6px |
| 卡片内边距 | 10px |
| Section标题下边距 | 8px |
| 按钮内边距（小） | 4px 10px |
| 按钮内边距（中） | 6px 14px |
| 按钮内边距（大） | 8px 20px |

### 3.4 按钮规范

| 类型 | 圆角 | 背景 | 边框 | 文字色 |
|------|------|------|------|--------|
| 主操作 | 6px | `rgba(200,168,76,0.2)` | `1px solid var(--tk-gold)` | `var(--tk-gold-light)` |
| 次操作 | 6px | `transparent` | `1px solid rgba(255,255,255,0.1)` | `var(--tk-text-secondary)` |
| 危险操作 | 6px | `rgba(184,66,58,0.2)` | `1px solid var(--tk-danger)` | `#e8a0a0` |
| 禁用 | — | 同上 | 同上 | `opacity: 0.5` |

### 3.5 弹窗规范

| 属性 | 规范值 |
|------|--------|
| 遮罩背景 | `rgba(0,0,0,0.55)` |
| 面板背景 | `rgba(26,35,50,0.97)` |
| 边框 | `1px solid rgba(200,168,76,0.4)` |
| 圆角 | `10px` |
| 入场动画 | `scale(0.95) → scale(1)` + `ease-out 200ms` |
| 最大宽度 | `90vw` |
| 最大高度 | `85vh` |

### 3.6 面板头部规范

| 属性 | 规范值 |
|------|--------|
| 标题字号 | 16px |
| 标题字重 | 600 |
| 标题颜色 | `var(--tk-gold-light)` |
| 标题图标字号 | 18px |
| 头部内边距 | `14px 16px 12px` |
| 关闭按钮尺寸 | 28×28px |
| 关闭按钮圆角 | 6px |
| 底部分割线 | `1px solid rgba(200,168,76,0.15)` |

---

## 四、修复优先级

### P0 — 必须修复（影响用户体验）

| 编号 | 问题 | 修复方案 | 工作量 |
|------|------|----------|--------|
| F-01 | 弹窗遮罩层实现不统一 | 所有弹窗统一使用公共 Modal 组件 | 3d |
| F-02 | 弹窗背景色不统一 | 统一为 `rgba(26,35,50,0.97)` | 0.5d |
| A-04 | 品质颜色体系不统一 | 建立统一品质色常量，所有面板引用 | 2d |
| D-02 | 按钮悬停效果缺失 | 将内联样式按钮迁移到 CSS 类 | 3d |

### P1 — 强烈建议（影响视觉一致性）

| 编号 | 问题 | 修复方案 | 工作量 |
|------|------|----------|--------|
| A-01 | 强调色混用 | 统一为 `var(--tk-gold)` / `var(--tk-gold-light)` | 1d |
| A-02 | 文字主色三色混用 | 统一为 `var(--tk-text-primary)` | 1d |
| B-01 | 面板标题字号不统一 | 统一为 16px | 0.5d |
| E-01 | 头部实现方式分裂 | 统一使用 Panel/FeaturePanel 公共组件 | 5d |
| C-01 | 面板内边距不统一 | 统一为 12px | 0.5d |
| D-01 | 按钮圆角不统一 | 统一使用 CSS 变量 `--tk-radius-md` | 0.5d |

### P2 — 优化提升（提升品质感）

| 编号 | 问题 | 修复方案 | 工作量 |
|------|------|----------|--------|
| A-06 | 硬编码颜色值 | 逐步将内联颜色替换为 CSS 变量 | 3d |
| A-07 | TechTab Tailwind色 | 替换为项目配色方案 | 0.5d |
| B-04 | 数字未使用等宽字体 | 添加 `.tk-num` 工具类 | 0.5d |
| B-05 | 行高不一致 | 统一正文 `line-height: 1.6` | 0.5d |
| D-03 | 按钮按下效果缺失 | 添加全局按钮 active 规则 | 0.5d |
| E-04 | 子Tab导航不统一 | 建立公共 SubTab 组件 | 2d |
| F-05 | 弹窗入场动画不统一 | 统一动画曲线 | 0.5d |

---

## 五、实施建议

### 阶段一：建立基础设施（1-2天）
1. 在 `ThreeKingdomsGame.css` 的 `:root` 中补充缺失的 CSS 变量（品质色、语义色）
2. 在 `common/` 下建立 `Button.css` / `Button.tsx` 公共按钮组件
3. 在 `common/` 下建立 `SubTab.css` / `SubTab.tsx` 公共子Tab组件
4. 导出统一的品质颜色常量 `QUALITY_COLORS` 供所有面板引用

### 阶段二：统一弹窗（2-3天）
1. 将 Mail/Shop/Equipment/ExpeditionTab/ArenaTab 的自建弹窗迁移到公共 Modal 组件
2. 统一弹窗背景色、边框、圆角、动画

### 阶段三：统一面板样式（3-5天）
1. 将内联样式面板逐步迁移到 CSS 文件
2. 替换硬编码颜色为 CSS 变量
3. 统一字号、间距、按钮样式

### 阶段四：品质打磨（1-2天）
1. 添加按钮 hover/active 效果
2. 统一数字字体
3. 统一行高

---

## 六、风险提示

1. **内联样式迁移风险**：大量面板使用内联 `style={}` 对象，迁移到 CSS 类时需确保动态样式（如条件颜色）仍能正确工作
2. **品质色迁移影响范围**：品质色涉及 EquipmentPanel、ArmyTab、HeroCard 三个独立体系，修改需同步更新类型定义和UI组件
3. **弹窗组件统一**：部分弹窗有特殊的布局需求（如 EquipmentPanel 的三按钮操作区），统一到 Modal 组件时需确保灵活性
4. **回归测试**：样式修改可能影响快照测试，需同步更新 `__tests__` 中的快照
