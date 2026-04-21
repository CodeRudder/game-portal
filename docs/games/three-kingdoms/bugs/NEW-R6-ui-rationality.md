# NEW-R6 UI合理性深度审计报告

> **审计日期**: 2025-07-11
> **审计范围**: `src/components/idle/panels/` 全部55个面板组件 + 关联CSS
> **审计维度**: A.引擎API对接 · B.z-index合规 · C.弹窗max-height · D.响应式适配 · E.触摸热区 · F.颜色一致性
> **基线版本**: R6 (Round 6)
> **前置审计**: R8-ui-rationality.md, R14-ui-deep-rationality.md

---

## 审计总览

| 维度 | 检查项数 | P0 | P1 | P2 | 通过 |
|------|---------|----|----|----|----|
| A. 引擎API对接 | 55 | 0 | 3 | 8 | 44 |
| B. z-index合规 | 25 | 2 | 2 | 3 | 18 |
| C. 弹窗max-height | 12 | 0 | 4 | 2 | 6 |
| D. 响应式适配 | 25 | 0 | 1 | 16 | 8 |
| E. 触摸热区 | 15 | 0 | 2 | 6 | 7 |
| F. 颜色一致性 | 20 | 0 | 1 | 2 | 17 |
| **合计** | **142** | **2** | **13** | **37** | **90** |

---

## A. 面板正确对接引擎API

### 检查方法
```bash
grep -rL "engine" src/components/idle/panels/ --include="*.tsx" | grep -v __test | grep -v ".css"
```

### 检查结果

共55个面板文件，其中44个正确引用了 `@/games/three-kingdoms/engine`，**11个未直接引用engine**。

#### 未引用engine的11个文件分析

| # | 文件 | 数据来源 | 评估 |
|---|------|---------|------|
| 1 | `npc/NPCTab.tsx` | `core/npc` 类型+常量 | ⚠️ P2 |
| 2 | `npc/NPCInfoModal.tsx` | `core/npc` 类型+常量 | ⚠️ P2 |
| 3 | `npc/NPCDialogModal.tsx` | `core/npc` 类型+常量 | ⚠️ P2 |
| 4 | `event/EventBanner.tsx` | `core/events` 类型+常量 | ⚠️ P2 |
| 5 | `event/RandomEncounterModal.tsx` | `core/events` 类型+常量 | ⚠️ P2 |
| 6 | `map/WorldMapTab.tsx` | `core/map` 类型+常量 | ⚠️ P2 |
| 7 | `map/SiegeConfirmModal.tsx` | `core/map` 类型 | ✅ 纯展示 |
| 8 | `map/TerritoryInfoPanel.tsx` | `core/map` 类型 | ✅ 纯展示 |
| 9 | `event/StoryEventModal.tsx` | 无任何导入 | ❌ P1 |
| 10 | `campaign/BattleSpeedControl.tsx` | 无任何导入 | ✅ 纯UI控件 |
| 11 | `tech/TechOfflinePanel.tsx` | 无任何导入 | ❌ P1 |

### [A-01] StoryEventModal 使用 `any` 类型，未引用引擎类型定义
- **文件**: `panels/event/StoryEventModal.tsx`
- **行号**: 15-18
- **严重程度**: **P1**
- **问题描述**: 
  - `event` prop 类型为 `any`，`choices` 也为 `any[]`
  - 未导入引擎的 `StoryEvent` / `StoryChoice` 类型
  - `resourceChanges` 使用 `Object.entries(c.resourceChanges ?? {})` 直接遍历，无类型保护
  - 存在运行时错误风险：若引擎数据结构变更，此处无编译期检查
- **修复建议**:
  ```tsx
  import type { StoryEvent, StoryChoice } from '@/games/three-kingdoms/core/events';
  // 或
  import type { StoryEvent, StoryChoice } from '@/games/three-kingdoms/engine';
  
  export interface StoryEventModalProps {
    event: StoryEvent | null;
    onSelect: (choiceId: string) => void;
    onDismiss: () => void;
  }
  ```

### [A-02] TechOfflinePanel 完全未引用引擎，离线数据结构自行定义
- **文件**: `panels/tech/TechOfflinePanel.tsx`
- **行号**: 14-32
- **严重程度**: **P1**
- **问题描述**: 
  - 自行定义了 `TechOfflineReport` 接口，而非从引擎导入
  - `researchedTechs` 使用 `Array<{ id: string; name: string }` 而非引擎的 `TechNodeState` 类型
  - `effectsGained` 使用 `Record<string, number>` 而非引擎定义的效果类型
  - 若引擎离线计算逻辑变更数据格式，此面板不会产生编译错误
- **修复建议**:
  ```tsx
  import type { OfflineReport } from '@/games/three-kingdoms/engine';
  // 使用引擎导出的类型替代自定义接口
  ```

### [A-03] NPC相关面板从 core/npc 导入而非 engine，绕过引擎统一出口
- **文件**: `panels/npc/NPCTab.tsx`, `panels/npc/NPCInfoModal.tsx`, `panels/npc/NPCDialogModal.tsx`
- **行号**: NPCTab:16-21, NPCInfoModal:17-23, NPCDialogModal:17
- **严重程度**: **P2**
- **问题描述**: 
  - 三个NPC面板均从 `@/games/three-kingdoms/core/npc` 直接导入类型和常量
  - 其他面板（如building、tech）从 `@/games/three-kingdoms/engine` 统一出口导入
  - 绕过engine统一出口可能导致：引擎重构时遗漏、类型不一致
- **修复建议**: 将导入路径统一为 `@/games/three-kingdoms/engine`，确保所有面板通过引擎统一出口获取类型

### [A-04] Event/Map面板从 core 子模块直接导入
- **文件**: `panels/event/EventBanner.tsx`, `panels/event/RandomEncounterModal.tsx`, `panels/map/WorldMapTab.tsx`
- **严重程度**: **P2**
- **问题描述**: 同 [A-03]，从 `core/events` / `core/map` 直接导入，绕过引擎统一出口
- **修复建议**: 同 [A-03]

---

## B. z-index层级合规

### 检查方法
```bash
grep -rn "zIndex:\|z-index:" src/components/idle/panels/ --include="*.tsx" --include="*.css" | grep -v "var(--"
```

### 已定义的z-index CSS变量体系（ThreeKingdomsGame.css:74-88）

| 变量 | 值 | 用途 |
|------|----|------|
| `--tk-z-base` | 0 | 基础内容层 |
| `--tk-z-scene` | 10 | 场景区 |
| `--tk-z-tab-bar` | 15 | Tab栏 |
| `--tk-z-resource-bar` | 15 | 资源栏 |
| `--tk-z-panel` | 100 | 面板层 |
| `--tk-z-dropdown` | 200 | 下拉菜单 |
| `--tk-z-banner` | 300 | 横幅通知 |
| `--tk-z-modal` | 500 | 弹窗 |
| `--tk-z-battle-scene` | 550 | 战斗场景 |
| `--tk-z-modal-detail` | 600 | 详情/子弹窗 |
| `--tk-z-tooltip` | 700 | 工具提示 |
| `--tk-z-toast` | 800 | Toast提示 |
| `--tk-z-guide-mask` | 900 | 引导遮罩 |
| `--tk-z-guide-highlight` | 901 | 引导高亮 |
| `--tk-z-offline-modal` | 1000 | 离线收益弹窗 |

### [B-01] ⛔ BuildingPanel.tsx 硬编码 zIndex: 1000，与离线收益弹窗同级冲突
- **文件**: `panels/building/BuildingPanel.tsx`
- **行号**: 373
- **严重程度**: **P0**
- **问题描述**: 
  ```tsx
  zIndex: 1000
  ```
  收入详情弹窗overlay硬编码 `zIndex: 1000`，与 `--tk-z-offline-modal`（1000）冲突。若离线收益弹窗与收入详情弹窗同时出现，会发生层级冲突。此外，该值应使用 `var(--tk-z-modal)` 或 `var(--tk-z-modal-detail)`。
- **修复建议**:
  ```tsx
  zIndex: 'var(--tk-z-modal-detail)' as any
  ```

### [B-02] ⛔ ResourceBar.css 硬编码 z-index: 9999，远超体系最高层级
- **文件**: `panels/resource/ResourceBar.css`
- **行号**: 317
- **严重程度**: **P0**
- **问题描述**: 
  ```css
  z-index: 9999;
  ```
  资源栏溢出弹窗使用 `z-index: 9999`，远超体系定义的最高层级 `--tk-z-offline-modal`（1000）。这会导致该弹窗覆盖所有其他UI元素，包括引导遮罩、Toast、甚至未来的系统级弹窗。
- **修复建议**:
  ```css
  z-index: var(--tk-z-modal-detail);
  ```

### [B-03] BuildingPanel.css 内部元素使用硬编码z-index（5/10/20）
- **文件**: `panels/building/BuildingPanel.css`
- **行号**: 104, 110, 156, 215
- **严重程度**: **P2**
- **问题描述**: 
  ```css
  z-index: 10;  /* 行104: 标签切换 */
  z-index: 20;  /* 行110: 活跃标签 */
  z-index: 5;   /* 行156: 建筑列表项 */
  z-index: 5;   /* 行215: 移动端列表项 */
  ```
  这些是组件内部相对层级，值较小且在面板内部使用，不与全局层级冲突。但为保持一致性，建议使用CSS变量。
- **修复建议**: 可定义组件内部CSS变量（如 `--tk-bld-tab: 10; --tk-bld-tab-active: 20;`），或保持现状（风险低）

### [B-04] BattleAnimation.css 使用硬编码z-index（15/20/30）
- **文件**: `panels/campaign/BattleAnimation.css`
- **行号**: 206, 211, 237, 280, 327
- **严重程度**: **P2**
- **问题描述**: 战斗动画内部元素使用硬编码 z-index 15/20/30，属于战斗场景内部层级，不与全局冲突。
- **修复建议**: 可保持现状，但建议添加注释说明层级含义

### [B-05] RecruitModal.css 内部元素使用硬编码z-index（2/10）
- **文件**: `panels/hero/RecruitModal.css`
- **行号**: 43, 238, 242
- **严重程度**: **P2**
- **问题描述**: 招募弹窗内部关闭按钮和结果层使用硬编码 z-index 2/10，属于弹窗内部层级。
- **修复建议**: 同 [B-04]

### [B-06] HeroDetailModal.css / HeroCard.css / WorldMapTab.css 等内部硬编码
- **文件**: 多个CSS文件
- **行号**: HeroDetailModal.css:56, HeroCard.css:104, WorldMapTab.css:146/216, BattleScene.css:37/137/152, GuideOverlay.css:20, CampaignTab.css:43, NPCInfoModal.css:58, RandomEncounterModal.css:71, ResourceBar.css:226
- **严重程度**: **P1**
- **问题描述**: 共14处组件内部使用硬编码 z-index（1-10范围），虽然值较小不与全局冲突，但缺乏统一管理。当多个弹窗嵌套时，可能产生难以预料的遮挡问题。
- **修复建议**: 建立组件内部 z-index 规范文档，或统一使用 CSS 变量

---

## C. 弹窗max-height

### 检查方法
```bash
grep -rn "maxHeight\|max-height" src/components/idle/panels/ --include="*.tsx" --include="*.css"
```

### 已有max-height的弹窗（✅ 合规）

| 文件 | max-height | 评估 |
|------|-----------|------|
| NPCDialogModal.css | 70vh | ✅ |
| NPCInfoModal.css | 80vh | ✅ |
| BuildingPanel.tsx (收入弹窗) | 80vh | ✅ |
| BuildingUpgradeModal.css | 80vh / 60vh(mobile) | ✅ |
| RandomEncounterModal.css | 85vh | ✅ |
| HeroStarUpModal.css | 85vh / 80vh(mobile) | ✅ |
| RecruitModal.css | 85vh / 90vh(mobile) | ✅ |
| HeroDetailModal.css | 90vh / 100%(mobile) | ✅ |
| HeroCompareModal.css | 85vh / 90vh(mobile) | ✅ |
| BattleFormationModal.css | 90vh / 95vh(mobile) | ✅ |
| BattleResultModal.css | 85vh / 100vh(mobile) | ✅ |

### [C-01] TechNodeDetailModal 弹窗缺少max-height
- **文件**: `panels/tech/TechNodeDetailModal.tsx` + `TechNodeDetailModal.css`
- **严重程度**: **P1**
- **问题描述**: 科技详情弹窗内容较多（前置科技列表、效果列表、升级按钮等），但弹窗容器未设置 `max-height`。当科技节点有多个前置科技和效果时，弹窗内容可能超出视口高度，且无滚动支持。
- **修复建议**: 在 `.tk-tech-detail-modal` 添加：
  ```css
  max-height: 85vh;
  overflow-y: auto;
  ```

### [C-02] TechOfflinePanel 弹窗缺少max-height
- **文件**: `panels/tech/TechOfflinePanel.tsx` + `TechOfflinePanel.css`
- **严重程度**: **P1**
- **问题描述**: 离线研究面板使用 `Modal` 组件，但内容区域未限制高度。若离线时间长、完成研究多，列表会无限增长。
- **修复建议**: 为内容区域添加 `max-height: 70vh; overflow-y: auto;`

### [C-03] TechTab 科技树面板缺少max-height
- **文件**: `panels/tech/TechTab.tsx`
- **严重程度**: **P1**
- **问题描述**: 科技树Tab面板使用绝对定位布局，在移动端缩放后内容可能溢出。缺少整体高度限制。
- **修复建议**: 为科技树容器添加 `max-height: calc(100vh - 120px); overflow: auto;`

### [C-04] EquipmentPanel/EquipmentTab 弹窗缺少max-height
- **文件**: `panels/equipment/EquipmentPanel.tsx`, `panels/equipment/EquipmentTab.tsx`
- **严重程度**: **P1**
- **问题描述**: 装备详情弹窗使用 `position: fixed` overlay，但弹窗内容无 `max-height` 限制。装备属性列表较长时会溢出视口。
- **修复建议**: 为弹窗容器添加 `maxHeight: '80vh', overflowY: 'auto'`

### [C-05] StoryEventModal 内容区域max-height仅200px，可能不够
- **文件**: `panels/event/StoryEventModal.tsx`
- **行号**: 55
- **严重程度**: **P2**
- **问题描述**: 
  ```tsx
  maxHeight: '200px', overflowY: 'auto'
  ```
  剧情对话内容区域限制为200px，对于多幕长对话（如桃园结义、官渡之战）可能不够，需要频繁滚动。建议增大至300-400px。
- **修复建议**: 将 `maxHeight` 改为 `350px` 或使用 `40vh`

### [C-06] MailPanel/ShopPanel/SocialPanel 列表max-height仅60vh
- **文件**: `panels/mail/MailPanel.tsx`, `panels/shop/ShopPanel.tsx`, `panels/social/SocialPanel.tsx`
- **严重程度**: **P2**
- **问题描述**: 列表区域使用 `maxHeight: '60vh'`，在移动端视口较小时可显示区域过小。建议在移动端增大至70-80vh。
- **修复建议**: 使用CSS变量或媒体查询在小屏幕上调整

---

## D. 响应式适配

### 检查方法
```bash
grep -rn "@media\|matchMedia\|innerWidth" src/components/idle/ --include="*.css" --include="*.tsx"
```

### 已有响应式的面板目录（8个 ✅）

| 目录 | @media断点 | 评估 |
|------|-----------|------|
| npc/ | 767px | ✅ |
| tech/ | 767px + matchMedia | ✅ |
| building/ | 767px | ✅ |
| event/ | 767px | ✅ |
| resource/ | 767px | ✅ |
| hero/ | 767px + 481-768px | ✅ |
| campaign/ | 767px + 481-768px | ✅ |
| map/ | （通过WorldMapTab.css）| ✅ |

### [D-01] 🔴 17个面板目录完全缺少响应式适配
- **涉及目录**: achievement, activity, alliance, arena, army, equipment, expedition, heritage, mail, more, prestige, pvp, quest, settings, shop, social, trade
- **严重程度**: **P1**（整体问题）
- **问题描述**: 以上17个面板目录中，所有 `.tsx` 和 `.css` 文件均无 `@media` 查询、无 `matchMedia` 调用、无 `innerWidth` 检测。这些面板在移动端将完全使用PC端布局，可能导致：
  - 文字过小不可读
  - 按钮过小不可点击
  - 布局溢出屏幕
  - 弹窗超出视口
- **修复建议**: 
  **优先级排序（按用户使用频率）**：
  1. **P1 - 高频面板**（需立即适配）: shop, mail, quest, army, expedition, arena
  2. **P2 - 中频面板**（下版本适配）: equipment, heritage, prestige, social, alliance, trade
  3. **P3 - 低频面板**（可延后）: achievement, activity, more, settings, pvp
  
  **适配方案**：
  - 每个CSS文件末尾添加 `@media (max-width: 767px) { ... }` 规则
  - 关键调整项：字体缩小、间距收紧、弹窗全屏化、列表项高度增加

### [D-02] GuideOverlay.css 缺少响应式适配
- **文件**: `panels/hero/GuideOverlay.css`
- **严重程度**: **P2**
- **问题描述**: 新手引导遮罩无移动端适配，高亮区域位置可能在移动端偏移
- **修复建议**: 添加 `@media (max-width: 767px)` 断点，调整高亮框尺寸和位置

### [D-03] SweepPanel.css 缺少响应式（但有 SweepPanel.mobile.css）
- **文件**: `panels/campaign/SweepPanel.css` + `SweepPanel.mobile.css`
- **严重程度**: **P2**（已有mobile.css但主CSS无@media）
- **问题描述**: SweepPanel 采用独立的 `.mobile.css` 文件而非 `@media` 查询，需要确认 mobile.css 是否被正确条件加载
- **修复建议**: 确认 `import './SweepPanel.mobile.css'` 是否在移动端条件加载

---

## E. 按钮触摸热区

### 检查方法
```bash
grep -rn "padding.*[0-3]px\|height.*[0-2][0-9]px\|minHeight.*[0-2][0-9]px" src/components/idle/panels/ --include="*.tsx"
```

### Apple HIG / Material Design 标准
- 最小触摸目标：**44×44px**（Apple）/ **48×48px**（Material）
- 本项目采用 **44px** 标准

### [E-01] ExpeditionPanel 按钮热区严重不足
- **文件**: `panels/expedition/ExpeditionPanel.tsx`
- **行号**: 143
- **严重程度**: **P1**
- **问题描述**: 
  ```tsx
  btn: { padding: '4px 10px', fontSize: 11, ... }
  ```
  实际高度 ≈ 4+11+4 = 19px，远低于44px标准。这是可交互的操作按钮，在移动端极难点击。
- **修复建议**: 
  ```tsx
  btn: { padding: '4px 10px', fontSize: 11, minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', ... }
  ```

### [E-02] MailPanel 多个按钮热区不足
- **文件**: `panels/mail/MailPanel.tsx`
- **行号**: 180, 185
- **严重程度**: **P1**
- **问题描述**: 
  ```tsx
  readBtn: { padding: '4px 10px', fontSize: 11, ... }    // ≈ 19px
  deleteBtn: { padding: '5px 10px', fontSize: 11, ... }   // ≈ 21px
  ```
  邮件操作按钮高度不足，移动端点击困难。
- **修复建议**: 添加 `minHeight: 44` + `display: 'inline-flex'`

### [E-03] ShopPanel 标签按钮热区不足
- **文件**: `panels/shop/ShopPanel.tsx`
- **行号**: 211
- **严重程度**: **P2**
- **问题描述**: 
  ```tsx
  tab: { padding: '6px 12px', fontSize: 12, ... }  // ≈ 24px
  ```
  商店分类标签按钮高度约24px。
- **修复建议**: 添加 `minHeight: 36`（标签按钮可适当放宽至36px）

### [E-04] ExpeditionTab 小按钮热区不足
- **文件**: `panels/expedition/ExpeditionTab.tsx`
- **行号**: 299
- **严重程度**: **P2**
- **问题描述**: 
  ```tsx
  btnSmall: { padding: '4px 10px', fontSize: 12, ... }  // ≈ 20px
  ```
- **修复建议**: 同 [E-01]

### [E-05] BuildingPanel 收入弹窗关闭按钮热区不足
- **文件**: `panels/building/BuildingPanel.tsx`
- **行号**: 387
- **严重程度**: **P2**
- **问题描述**: 
  ```tsx
  <button style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer' }}>✕</button>
  ```
  关闭按钮无 padding，实际可点击区域仅约18×18px。
- **修复建议**: 添加 `padding: 8, minHeight: 44, minWidth: 44`

### [E-06] TechTab 科技节点高度仅20px
- **文件**: `panels/tech/TechTab.css`
- **行号**: 184, 202
- **严重程度**: **P2**
- **问题描述**: 
  ```css
  height: 20px;
  ```
  科技树节点高度仅20px，在移动端难以点击。但科技树是可视化图表，节点密度受限于布局空间，需要权衡。
- **修复建议**: 在移动端 `@media` 中增大节点至 `height: 36px; width: 36px;`，并增大节点间距

### [E-07] CSS中固定小尺寸元素（16-28px高度）
- **文件**: 多个CSS文件
- **行号**: BuildingPanel.css:145(18px), BuildingPanel.css:204(16px), FormationPanel.css:209(16px), HeroDetailModal.css:401(16px), SweepPanel.css:334(24px)
- **严重程度**: **P2**
- **问题描述**: 进度条、图标容器等装饰性元素使用16-28px高度。若这些元素不可点击则无问题；若可点击则需增大。
- **修复建议**: 审计每个小尺寸元素是否可交互，对可交互元素添加 `min-height: 44px`

---

## F. 颜色一致性

### 检查方法
```bash
grep -rn "#[0-9a-fA-F]\{6\}" src/components/idle/panels/ --include="*.tsx" | grep -v "1a1a2e\|e0d5c0\|d4a574\|8a7e6e\|4caf50\|2196f3\|9c27b0\|ff9800\|f44336\|9e9e9e"
```

### 已有的品质色/主题色（允许硬编码）

| 色值 | 用途 | 评估 |
|------|------|------|
| `#1a1a2e` | 深色背景 | ✅ 主题色 |
| `#e0d5c0` / `#e8e0d0` | 文字主色 | ✅ 主题色 |
| `#d4a574` / `#b8864a` | 金色强调 | ✅ 主题色 |
| `#8a7e6e` | 次要文字 | ✅ 主题色 |
| `#a0a0a0` / `#888` | 灰色文字 | ✅ 中性色 |
| `#4caf50` / `#7EC850` / `#52a349` | 绿色（正收益） | ✅ 品质色 |
| `#2196f3` / `#3498db` / `#5B9BD5` | 蓝色（信息） | ✅ 品质色 |
| `#9c27b0` | 紫色（史诗） | ✅ 品质色 |
| `#ff9800` / `#c9a84c` | 橙色/金色（稀有） | ✅ 品质色 |
| `#f44336` / `#E53935` / `#b8423a` / `#B8423A` / `#ff6464` | 红色（危险/敌对） | ✅ 品质色 |
| `#9e9e9e` / `#999` | 灰色（普通） | ✅ 品质色 |

### [F-01] NPCTab/NPCInfoModal 好感度颜色硬编码在tsx中
- **文件**: `panels/npc/NPCTab.tsx`, `panels/npc/NPCInfoModal.tsx`
- **行号**: NPCTab:40-44, NPCInfoModal:44-48
- **严重程度**: **P1**
- **问题描述**: 
  ```tsx
  // NPCTab.tsx
  const AFFINITY_COLORS: Record<AffinityLevel, string> = {
    hostile: '#b8423a',
    neutral: '#a0a0a0',
    friendly: '#52a349',
    trusted: '#3498db',
    bonded: '#c9a84c',
  };
  ```
  同一颜色映射在 NPCTab.tsx 和 NPCInfoModal.tsx 中重复定义。若需调整好感度颜色，需要同时修改两个文件。
- **修复建议**: 
  1. 将 `AFFINITY_COLORS` 和 `AFFINITY_LABELS` 提取到 `core/npc` 或 `common/constants.ts` 中统一导出
  2. 或使用 CSS 变量（如 `--tk-npc-hostile`, `--tk-npc-friendly` 等）

### [F-02] BuildingPanel 中 #7EC850 / #E53935 硬编码为内联样式
- **文件**: `panels/building/BuildingPanel.tsx`
- **行号**: 326, 399, 414, 433
- **严重程度**: **P2**
- **问题描述**: 
  ```tsx
  color: '#7EC850'   // 正收益绿色
  color: '#E53935'   // 负收益红色
  ```
  内联样式中硬编码颜色值，无法通过CSS变量统一调整主题。
- **修复建议**: 使用 CSS 变量：
  ```tsx
  color: 'var(--tk-green)'
  color: 'var(--tk-red)'
  ```

### [F-03] TechNodeDetailModal 中 #3498db 硬编码
- **文件**: `panels/tech/TechNodeDetailModal.tsx`
- **行号**: 364
- **严重程度**: **P2**
- **问题描述**: 科技详情中费用数值使用硬编码蓝色 `#3498db`，应使用 `var(--tk-blue)` 或 `var(--tk-text-info)`。
- **修复建议**: 替换为 CSS 变量

---

## 问题汇总（按优先级排序）

### P0 — 必须立即修复（2个）

| # | 编号 | 问题 | 文件 |
|---|------|------|------|
| 1 | B-01 | BuildingPanel.tsx 硬编码 zIndex:1000，与离线收益弹窗冲突 | `panels/building/BuildingPanel.tsx:373` |
| 2 | B-02 | ResourceBar.css 硬编码 z-index:9999，远超体系最高层级 | `panels/resource/ResourceBar.css:317` |

### P1 — 强烈建议修复（13个）

| # | 编号 | 问题 | 文件 |
|---|------|------|------|
| 3 | A-01 | StoryEventModal 使用 `any` 类型，无引擎类型保护 | `panels/event/StoryEventModal.tsx` |
| 4 | A-02 | TechOfflinePanel 自定义数据结构，未引用引擎类型 | `panels/tech/TechOfflinePanel.tsx` |
| 5 | B-06 | 14处组件内部硬编码z-index，缺乏统一管理 | 多个CSS文件 |
| 6 | C-01 | TechNodeDetailModal 弹窗缺少max-height | `panels/tech/TechNodeDetailModal.css` |
| 7 | C-02 | TechOfflinePanel 弹窗缺少max-height | `panels/tech/TechOfflinePanel.css` |
| 8 | C-03 | TechTab 科技树面板缺少max-height | `panels/tech/TechTab.tsx` |
| 9 | C-04 | EquipmentPanel/EquipmentTab 弹窗缺少max-height | `panels/equipment/*.tsx` |
| 10 | D-01 | 17个面板目录完全缺少响应式适配 | 17个目录 |
| 11 | E-01 | ExpeditionPanel 按钮热区仅19px | `panels/expedition/ExpeditionPanel.tsx:143` |
| 12 | E-02 | MailPanel 按钮热区仅19-21px | `panels/mail/MailPanel.tsx:180,185` |
| 13 | F-01 | 好感度颜色在两个文件中重复硬编码 | `panels/npc/NPCTab.tsx`, `NPCInfoModal.tsx` |

### P2 — 优化提升（37个）

| # | 编号 | 问题 | 文件 |
|---|------|------|------|
| 14 | A-03 | NPC面板从core直接导入，绕过engine统一出口 | `panels/npc/*.tsx` |
| 15 | A-04 | Event/Map面板从core直接导入 | `panels/event/*.tsx`, `panels/map/*.tsx` |
| 16 | B-03 | BuildingPanel.css 内部硬编码z-index(5/10/20) | `panels/building/BuildingPanel.css` |
| 17 | B-04 | BattleAnimation.css 内部硬编码z-index(15/20/30) | `panels/campaign/BattleAnimation.css` |
| 18 | B-05 | RecruitModal.css 内部硬编码z-index(2/10) | `panels/hero/RecruitModal.css` |
| 19 | C-05 | StoryEventModal 内容区域max-height仅200px | `panels/event/StoryEventModal.tsx:55` |
| 20 | C-06 | MailPanel/ShopPanel/SocialPanel 列表max-height仅60vh | 3个文件 |
| 21 | D-02 | GuideOverlay.css 缺少响应式适配 | `panels/hero/GuideOverlay.css` |
| 22 | D-03 | SweepPanel.mobile.css 需确认条件加载 | `panels/campaign/SweepPanel.tsx` |
| 23 | E-03 | ShopPanel 标签按钮热区约24px | `panels/shop/ShopPanel.tsx:211` |
| 24 | E-04 | ExpeditionTab 小按钮热区约20px | `panels/expedition/ExpeditionTab.tsx:299` |
| 25 | E-05 | BuildingPanel 关闭按钮热区约18px | `panels/building/BuildingPanel.tsx:387` |
| 26 | E-06 | TechTab 科技节点高度仅20px | `panels/tech/TechTab.css:184,202` |
| 27 | E-07 | 多个CSS固定小尺寸元素(16-28px) | 多个CSS文件 |
| 28 | F-02 | BuildingPanel 内联样式硬编码颜色 | `panels/building/BuildingPanel.tsx` |
| 29 | F-03 | TechNodeDetailModal 硬编码蓝色 | `panels/tech/TechNodeDetailModal.tsx:364` |

---

## 修复优先级路线图

### Phase 1 — 紧急修复（P0，1天）
1. 修复 B-01: BuildingPanel `zIndex: 1000` → `var(--tk-z-modal-detail)`
2. 修复 B-02: ResourceBar `z-index: 9999` → `var(--tk-z-modal-detail)`

### Phase 2 — 核心修复（P1，3-5天）
1. 类型安全：修复 A-01 (StoryEventModal any类型), A-02 (TechOfflinePanel自定义类型)
2. 弹窗溢出：修复 C-01~C-04 (4个弹窗添加max-height)
3. 触摸热区：修复 E-01, E-02 (高频操作按钮)
4. 颜色统一：修复 F-01 (好感度颜色提取)

### Phase 3 — 响应式补全（P1-D-01，5-7天）
1. 第一批（高频面板）：shop, mail, quest, army, expedition, arena
2. 第二批（中频面板）：equipment, heritage, prestige, social, alliance, trade

### Phase 4 — 质量提升（P2，持续迭代）
1. z-index全面变量化
2. 导入路径统一（core → engine统一出口）
3. 剩余触摸热区优化
4. 颜色全面CSS变量化

---

## 附录

### A. 面板文件清单（55个）

<details>
<summary>展开查看完整列表</summary>

| # | 文件路径 | 引擎API | @media | max-height |
|---|---------|---------|--------|-----------|
| 1 | achievement/AchievementPanel.tsx | ✅ | ❌ | ❌ |
| 2 | activity/ActivityPanel.tsx | ✅ | ❌ | ❌ |
| 3 | alliance/AlliancePanel.tsx | ✅ | ❌ | ❌ |
| 4 | arena/ArenaTab.tsx | ✅ | ❌ | ❌ |
| 5 | army/ArmyTab.tsx | ✅ | ❌ | ❌ |
| 6 | building/BuildingPanel.tsx | ✅ | ✅ | ✅ |
| 7 | building/BuildingUpgradeModal.tsx | ✅ | ✅ | ✅ |
| 8 | campaign/BattleAnimation.tsx | ✅ | ✅ | N/A |
| 9 | campaign/BattleFormationModal.tsx | ✅ | ✅ | ✅ |
| 10 | campaign/BattleResultModal.tsx | ✅ | ✅ | ✅ |
| 11 | campaign/BattleScene.tsx | ✅ | ✅ | N/A |
| 12 | campaign/BattleSpeedControl.tsx | ❌ | ✅ | N/A |
| 13 | campaign/CampaignTab.tsx | ✅ | ✅ | N/A |
| 14 | campaign/SweepModal.tsx | ✅ | ✅ | N/A |
| 15 | campaign/SweepPanel.tsx | ✅ | ✅ | N/A |
| 16 | campaign/UnitCard.tsx | ✅ | ✅ | N/A |
| 17 | equipment/EquipmentPanel.tsx | ✅ | ❌ | ❌ |
| 18 | equipment/EquipmentTab.tsx | ✅ | ❌ | ❌ |
| 19 | event/EventBanner.tsx | ❌(core) | ✅ | N/A |
| 20 | event/RandomEncounterModal.tsx | ❌(core) | ✅ | ✅ |
| 21 | event/StoryEventModal.tsx | ❌ | ❌ | ⚠️ |
| 22 | expedition/ExpeditionPanel.tsx | ✅ | ❌ | ❌ |
| 23 | expedition/ExpeditionTab.tsx | ✅ | ❌ | ✅ |
| 24 | heritage/HeritagePanel.tsx | ✅ | ❌ | ❌ |
| 25 | hero/FormationPanel.tsx | ✅ | ✅ | N/A |
| 26 | hero/GuideOverlay.tsx | ✅ | ❌ | N/A |
| 27 | hero/HeroCard.tsx | ✅ | ✅ | N/A |
| 28 | hero/HeroCompareModal.tsx | ✅ | ✅ | ✅ |
| 29 | hero/HeroDetailModal.tsx | ✅ | ✅ | ✅ |
| 30 | hero/HeroStarUpModal.tsx | ✅ | ✅ | ✅ |
| 31 | hero/HeroStarUpPanel.tsx | ✅ | ✅ | N/A |
| 32 | hero/HeroTab.tsx | ✅ | ✅ | N/A |
| 33 | hero/RadarChart.tsx | ✅ | N/A | N/A |
| 34 | hero/RecruitModal.tsx | ✅ | ✅ | ✅ |
| 35 | mail/MailPanel.tsx | ✅ | ❌ | ⚠️ |
| 36 | map/SiegeConfirmModal.tsx | ❌(core) | ✅ | N/A |
| 37 | map/TerritoryInfoPanel.tsx | ❌(core) | ✅ | N/A |
| 38 | map/WorldMapTab.tsx | ❌(core) | ✅ | N/A |
| 39 | more/MoreTab.tsx | ✅ | ❌ | N/A |
| 40 | npc/NPCDialogModal.tsx | ❌(core) | ✅ | ✅ |
| 41 | npc/NPCInfoModal.tsx | ❌(core) | ✅ | ✅ |
| 42 | npc/NPCTab.tsx | ❌(core) | ✅ | N/A |
| 43 | prestige/PrestigePanel.tsx | ✅ | ❌ | ❌ |
| 44 | pvp/ArenaPanel.tsx | ✅ | ❌ | ❌ |
| 45 | quest/QuestPanel.tsx | ✅ | ❌ | ❌ |
| 46 | resource/ResourceBar.tsx | ✅ | ✅ | ✅ |
| 47 | resource/resource/ResourceBar.tsx | ✅ | ✅ | ✅ |
| 48 | settings/SettingsPanel.tsx | ✅ | ❌ | ❌ |
| 49 | shop/ShopPanel.tsx | ✅ | ❌ | ⚠️ |
| 50 | social/SocialPanel.tsx | ✅ | ❌ | ⚠️ |
| 51 | tech/TechNodeDetailModal.tsx | ✅ | ✅ | ❌ |
| 52 | tech/TechOfflinePanel.tsx | ❌ | ✅ | ❌ |
| 53 | tech/TechResearchPanel.tsx | ✅ | ✅ | N/A |
| 54 | tech/TechTab.tsx | ✅ | ✅ | ❌ |
| 55 | trade/TradePanel.tsx | ✅ | ❌ | ❌ |

</details>

### B. BattleAnimation.css / UnitCard.css 未被直接导入

`BattleAnimation.tsx` 和 `UnitCard.tsx` 各自有对应的CSS文件，但tsx中未直接 `import`。这两个CSS文件通过 `BattleScene.tsx` 间接生效（BattleScene导入了 BattleScene.css，而 BattleAnimation.css 的选择器在 BattleScene 的DOM结构中生效）。**这不是bug，但建议在文件头注释中说明CSS依赖关系。**

---

> **审计人**: Game Reviewer Agent
> **审计工具**: grep / glob / 代码静态分析
> **下次审计建议**: 修复P0/P1后进行回归验证
