# R8 UI合理性检查报告

> **审计日期**: 2025-07-09
> **审计范围**: `src/components/idle/` 全部UI组件
> **审计维度**: 位置/尺寸 · 图层/遮挡 · 响应式 · 导航/交互
> **涉及文件**: 30+ TSX/CSS 文件

---

## A. 位置与尺寸

### [A-01] 游戏画框使用固定1280×800像素，无动态缩放
- **文件**: `ThreeKingdomsGame.css`
- **行号**: 103-104
- **严重程度**: P1
- **问题描述**: `.tk-game-frame` 使用硬编码的 `width: 1280px; height: 800px`，虽然CSS中有 `@media (max-width: 1280px)` 规则使用 `transform: scale(var(--tk-scale, 1))`，但 `--tk-scale` 变量从未在JS中计算和设置，导致在小屏幕上游戏画框直接溢出而非等比缩放。
- **修复建议**: 在 `ThreeKingdomsGame.tsx` 中添加 `useEffect` 监听窗口尺寸变化，动态计算并设置 `--tk-scale` CSS变量：
  ```tsx
  useEffect(() => {
    const updateScale = () => {
      const scaleX = window.innerWidth / 1280;
      const scaleY = window.innerHeight / 800;
      const scale = Math.min(scaleX, scaleY, 1);
      document.documentElement.style.setProperty('--tk-scale', String(scale));
    };
    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, []);
  ```

### [A-02] 资源栏高度在PC端固定56px，手机端改为auto但未限制最大高度
- **文件**: `panels/resource/ResourceBar.css`
- **行号**: 19 (PC), 128 (mobile)
- **严重程度**: P2
- **问题描述**: PC端资源栏高度固定56px合理，但手机端改为 `height: auto; min-height: 48px` 并允许 `flex-wrap: wrap`。当资源项换行时，资源栏高度不可控，会挤压下方场景区高度。极端情况下4个资源项可能占据2行，高度达84px+。
- **修复建议**: 手机端资源栏设置 `max-height: 84px` 并对资源项使用更紧凑的布局（如2×2网格），或使用水平滚动而非换行。

### [A-03] Tab栏高度48px，11个Tab按钮使用flex:1 + max-width:120px，文字可能溢出
- **文件**: `ThreeKingdomsGame.css`
- **行号**: 121 (height: 48px), 142-143 (flex:1, max-width:120px)
- **严重程度**: P1
- **问题描述**: 11个Tab按钮 + FeatureMenu按钮 + 日历信息全部放在一个48px高的flex行中。每个Tab按钮 `max-width: 120px`，11个按钮最大总宽度为1320px，已超出1280px画框宽度。即使每个按钮实际宽度约100px（11×100=1100），加上FeatureMenu按钮（~80px）和日历信息（~200px），总宽度约1380px，超出画框。PC端就会出现内容溢出/挤压。
- **修复建议**: 
  1. 将Tab栏改为可横向滚动：`overflow-x: auto; overflow-y: hidden;`
  2. 或将11个Tab分为"主Tab"（显示在Tab栏）和"更多Tab"（通过下拉展开），减少Tab栏压力
  3. 日历信息在PC端也应考虑折叠或移到场景区顶部

### [A-04] 手机端Tab栏order:3但场景区未正确适配底部Tab
- **文件**: `ThreeKingdomsGame.css`
- **行号**: 294-338 (mobile media query)
- **严重程度**: P1
- **问题描述**: 手机端通过CSS `order` 属性将Tab栏移到底部（order:3）、场景区移到中间（order:2），但资源栏没有设置order（默认0）。这意味着flex布局顺序为：资源栏(0) → 场景区(2) → Tab栏(3)，视觉上正确。但场景区使用 `flex: 1` 计算高度时，如果资源栏在手机端因wrap变高，场景区高度会进一步被压缩。此外，底部Tab栏在iPhone等有底部安全区域的设备上可能被Home Indicator遮挡。
- **修复建议**: 
  1. 为 `.tk-tab-bar` 手机端添加 `padding-bottom: env(safe-area-inset-bottom, 0px)`
  2. 为 `.tk-game-frame` 手机端添加 `padding-bottom: env(safe-area-inset-bottom, 0px)`

### [A-05] EquipmentTab/ArenaTab/ExpeditionTab/ArmyTab弹窗使用position:fixed但无max-height限制
- **文件**: `panels/equipment/EquipmentTab.tsx` (S.overlay/S.detailPanel), `panels/arena/ArenaTab.tsx` (S.overlay/S.modal), `panels/expedition/ExpeditionTab.tsx` (S.modalOverlay/S.modal)
- **行号**: EquipmentTab:304-310, ArenaTab:326-328, ExpeditionTab:302
- **严重程度**: P1
- **问题描述**: 这三个Tab的弹窗overlay都使用 `position: fixed; inset: 0`，弹窗内容使用 `minWidth: 280-300; maxWidth: 400`，但**没有设置 `max-height`**。在小屏设备上，弹窗内容可能超出视口高度，且弹窗没有 `overflow-y: auto`，导致内容不可见且无法滚动。
- **修复建议**: 为所有弹窗容器添加 `maxHeight: '80vh', overflowY: 'auto'`：
  ```tsx
  modal: { ..., maxHeight: '80vh', overflowY: 'auto' },
  detailPanel: { ..., maxHeight: '80vh', overflowY: 'auto' },
  ```

### [A-06] 按钮触摸热区不足44px最小标准
- **文件**: `panels/arena/ArenaTab.tsx`, `panels/equipment/EquipmentTab.tsx`, `panels/expedition/ExpeditionTab.tsx`
- **行号**: ArenaTab S.buyBtn (padding: 3px 10px), EquipmentTab S.subBtn (padding: 6px 14px), ExpeditionTab S.btnSmall (padding: 4px 10px)
- **严重程度**: P2
- **问题描述**: 多个按钮的padding过小，实际渲染高度远低于44px（Apple HIG和Material Design推荐的最低触摸目标）。例如 `buyBtn` padding `3px 10px` + font-size 11px ≈ 总高度约17px，远低于44px标准。`btnSmall` padding `4px 10px` + font-size 12px ≈ 20px。`filterBtn` padding `4px 8px` + font-size 11px ≈ 19px。
- **修复建议**: 将所有可交互按钮的最小高度设为44px：
  ```tsx
  buyBtn: { ..., minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' },
  ```

### [A-07] MoreTab功能卡片无最小高度保证
- **文件**: `panels/more/MoreTab.tsx`
- **行号**: styles.card (padding: 18px 10px)
- **严重程度**: P2
- **问题描述**: 功能卡片使用 `padding: 18px 10px`，包含图标(30px font-size) + 标签(13px font-size) + gap(8px)，总高度约 18+30+8+13+18 = 87px，满足触摸要求。但在小屏设备上2列网格可能导致卡片过窄，文字换行后高度不一致。
- **修复建议**: 为 `.card` 添加 `minHeight: 80px` 确保一致性。

---

## B. 图层与遮挡

### [B-01] EventBanner z-index:9000 与 Toast z-index:9000 冲突
- **文件**: `panels/event/EventBanner.css` (line 11), `common/Toast.css` (line 9)
- **行号**: EventBanner:11, Toast:9
- **严重程度**: P1
- **问题描述**: EventBanner 使用 `z-index: 9000`，Toast 也使用 `z-index: 9000`。当两者同时出现时，由于DOM顺序决定层叠关系（EventBanner在DOM中位于Toast之前），Toast可能被EventBanner遮挡。EventBanner是 `position: fixed; top: 12px`，Toast也是 `position: fixed; top: 0`，两者在屏幕顶部区域重叠。
- **修复建议**: 将EventBanner的z-index降为8500，Toast保持9000，确保Toast始终在最上层：
  ```css
  .tk-ebanner { z-index: 8500; }
  ```

### [B-02] z-index层级体系混乱，缺乏统一规范
- **文件**: 多个CSS文件
- **行号**: 见下方
- **严重程度**: P1
- **问题描述**: 当前z-index分布如下，存在多处冲突和层级倒置：
  
  | 层级 | z-index | 组件 | 预期层级 |
  |------|---------|------|---------|
  | 内容 | 5 | BuildingPanel内部元素 | ✅ |
  | 内容 | 10 | 场景区、其他Pixi游戏 | ✅ |
  | 面板 | 30 | BuildingPanel | ✅ |
  | Tab栏 | 100 | Tab栏、资源栏、Panel | ⚠️ 冲突 |
  | 菜单 | 300 | FeatureMenu下拉 | ✅ |
  | 弹窗 | 350 | NPCInfoModal | ⚠️ 与300接近 |
  | 弹窗 | 400 | RecruitModal, HeroDetailModal | ⚠️ |
  | 事件 | 450 | RandomEncounterModal | ⚠️ |
  | 事件 | 500 | EventBanner | ⚠️ 层级倒置 |
  | 弹窗 | 1000 | Modal, FeaturePanel, 多个内联弹窗 | ❌ 大量冲突 |
  | 弹窗 | 1050 | BattleScene | ⚠️ |
  | 详情弹窗 | 1100 | TechNodeDetail, BuildingUpgrade, BattleResult, RandomEncounter | ❌ 与1000冲突 |
  | Toast | 9000 | Toast, EventBanner | ❌ 冲突 |
  | 引导 | 9500 | GuideOverlay | ✅ |
  
  **关键问题**：
  1. EventBanner(500) 低于 FeaturePanel(1000)，如果FeaturePanel打开时触发事件，Banner会被遮挡
  2. 多个弹窗组件共享z-index:1000（Modal、FeaturePanel、EquipmentTab overlay、ArenaTab overlay等），同时打开时DOM顺序决定谁在上面，不可控
  3. BattleScene(1050)介于Modal(1000)和DetailModal(1100)之间，层级定位不明确

- **修复建议**: 建立统一的z-index token体系，在CSS变量中定义：
  ```css
  :root {
    --tk-z-content: 1;
    --tk-z-panel: 10;
    --tk-z-tab-bar: 50;
    --tk-z-dropdown: 100;
    --tk-z-modal: 200;
    --tk-z-modal-detail: 250;
    --tk-z-battle-scene: 300;
    --tk-z-banner: 400;
    --tk-z-toast: 500;
    --tk-z-guide: 600;
  }
  ```
  全局替换所有硬编码的z-index值。

### [B-03] 内联样式中的z-index:1000与CSS类中的z-index:1000冲突
- **文件**: `panels/equipment/EquipmentTab.tsx` (S.overlay), `panels/arena/ArenaTab.tsx` (S.overlay), `panels/expedition/ExpeditionTab.tsx` (S.modalOverlay), `panels/shop/ShopPanel.tsx`, `panels/mail/MailPanel.tsx`
- **行号**: EquipmentTab:304, ArenaTab:326, ExpeditionTab:302
- **严重程度**: P2
- **问题描述**: 这些组件使用内联样式 `zIndex: 1000`，与 `Modal.css` 和 `FeaturePanel.css` 中的 `z-index: 1000` 相同。当这些面板在FeaturePanel内部渲染时（如ShopPanel、MailPanel），面板内部的弹窗overlay与FeaturePanel overlay处于同一层级，可能导致点击穿透或遮挡异常。
- **修复建议**: 
  1. FeaturePanel内部的子面板弹窗应使用更高的z-index（如1100）
  2. 或改为使用统一的Modal组件而非自定义overlay

### [B-04] GuideOverlay z-index:9500（原CSS中为10000）低于Toast(9000)但高于EventBanner(9000)
- **文件**: `panels/hero/GuideOverlay.css`
- **行号**: 6
- **严重程度**: P2
- **问题描述**: GuideOverlay使用 `z-index: 9500`（代码中实际值，与grep结果中显示的10000不一致，需确认）。如果引导遮罩需要遮挡所有UI元素包括Toast，则9500可能不够（如果Toast后续提升z-index）。同时GuideOverlay没有阻止背景滚动的机制。
- **修复建议**: 确认GuideOverlay的z-index为最高层级（建议10000），并在打开时禁用body滚动。

### [B-05] RandomEncounterModal z-index:1100 高于 EventBanner z-index:9000，但语义上Banner应低于Modal
- **文件**: `panels/event/RandomEncounterModal.css` (line 9), `panels/event/EventBanner.css` (line 11)
- **行号**: RandomEncounterModal:9, EventBanner:11
- **严重程度**: P2
- **问题描述**: RandomEncounterModal使用z-index:1100，EventBanner使用z-index:9000。虽然9000>1100，但这两个组件属于不同层级体系——Modal类组件（1000-1100）和通知类组件（9000+）。EventBanner的z-index(9000)远高于RandomEncounterModal(1100)，这意味着当随机遭遇弹窗打开时，EventBanner仍然会显示在弹窗之上，遮挡弹窗内容。
- **修复建议**: EventBanner在Modal打开时应自动隐藏，或降低EventBanner的z-index到500以下。

---

## C. 响应式

### [C-01] EquipmentTab/ArenaTab/ExpeditionTab/ArmyTab/MoreTab 完全没有响应式适配
- **文件**: `panels/equipment/EquipmentTab.tsx`, `panels/arena/ArenaTab.tsx`, `panels/expedition/ExpeditionTab.tsx`, `panels/army/ArmyTab.tsx`, `panels/more/MoreTab.tsx`
- **严重程度**: P1
- **问题描述**: 这5个Tab面板全部使用纯内联样式（`const S: Record<string, React.CSSProperties>`），没有任何 `@media` 查询、`matchMedia` 监听或响应式断点处理。在手机端：
  - EquipmentTab的装备网格 `gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))'` 在小屏上可能只显示1列，但卡片内容仍按PC布局
  - ArenaTab的对手卡片、排行榜弹窗没有适配小屏
  - ExpeditionTab的节点链 `overflowX: 'auto'` 虽然可以横向滚动，但体验不佳
  - ArmyTab的阵型槽位 `width: 90` 在小屏上可能溢出
  - MoreTab的2列网格在极小屏幕(<320px)上可能过窄
- **修复建议**: 
  1. 为这些组件添加 `isMobile` 状态（参考TechTab的matchMedia方案）
  2. 手机端调整网格列数、字体大小、间距
  3. 或将这些内联样式迁移到CSS文件中，使用 `@media` 查询

### [C-02] 手机端Tab栏11个Tab无滚动能力
- **文件**: `ThreeKingdomsGame.css`
- **行号**: 294-338 (mobile media query)
- **严重程度**: P0
- **问题描述**: 手机端Tab栏高度40px，11个Tab按钮 + FeatureMenu按钮水平排列。手机端Tab按钮 `max-width: none`，每个按钮宽度由内容决定（图标14px + 4px gap + 文字11px ≈ 50px），11个按钮约550px + FeatureMenu约60px = 610px。在375px宽的手机上，内容严重溢出。但Tab栏没有设置 `overflow-x: auto`，导致右侧Tab完全不可见且无法访问。
- **修复建议**: 为手机端Tab栏添加横向滚动：
  ```css
  @media (max-width: 767px) {
    .tk-tab-bar {
      overflow-x: auto;
      overflow-y: hidden;
      -webkit-overflow-scrolling: touch;
      scrollbar-width: none;
    }
    .tk-tab-bar::-webkit-scrollbar { display: none; }
  }
  ```

### [C-03] 响应式断点不统一：767px vs 768px
- **文件**: 多个CSS文件
- **行号**: ThreeKingdomsGame.css:294 (767px), ResourceBar.css:90 (768px), BuildingPanel.css:203 (768px)
- **严重程度**: P2
- **问题描述**: 不同组件使用不同的移动端断点值。大部分使用 `@media (max-width: 767px)`，但ResourceBar和BuildingPanel使用 `@media (max-width: 768px)`。在768px宽的设备（如iPad竖屏）上，ResourceBar和BuildingPanel已经应用移动端样式，但ThreeKingdomsGame主框架仍然是PC布局，导致样式不一致。
- **修复建议**: 统一所有断点为 `767px`（或统一为 `768px`），并在CSS变量中定义断点值以便维护。

### [C-04] 缺少平板端(768-1024px)响应式适配
- **文件**: 所有活跃组件（非backup）
- **严重程度**: P2
- **问题描述**: 当前只有两个断点：PC(>1280px)和手机(<767px)。768-1280px的平板设备（如iPad横屏1024×768）没有专门的适配。游戏画框在1280px以下使用 `transform: scale(var(--tk-scale, 1))`，但 `--tk-scale` 未被设置（见A-01），导致平板端显示1280px画框但被截断。
- **修复建议**: 
  1. 修复 `--tk-scale` 计算（见A-01）
  2. 或为768-1280px范围添加专门的布局调整

### [C-05] 全局缺少safe-area-inset处理
- **文件**: 全局CSS
- **严重程度**: P1
- **问题描述**: 整个项目中没有任何 `env(safe-area-inset-*)` 或 `constant(safe-area-inset-*)` 的使用。在iPhone X及以上机型上：
  - 底部Tab栏会被Home Indicator遮挡
  - 顶部资源栏可能被刘海遮挡
  - 弹窗的底部按钮可能被安全区域覆盖
- **修复建议**: 
  1. 在 `index.html` 中确保有 `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`
  2. 为手机端Tab栏添加 `padding-bottom: env(safe-area-inset-bottom, 0px)`
  3. 为资源栏添加 `padding-top: env(safe-area-inset-top, 0px)`
  4. 为弹窗底部按钮区添加 `padding-bottom: env(safe-area-inset-bottom, 0px)`

---

## D. 导航与交互

### [D-01] Tab栏11个Tab + FeatureMenu + 日历信息在PC端溢出
- **文件**: `ThreeKingdomsGame.tsx` (lines 549-569), `ThreeKingdomsGame.css` (lines 121-165)
- **严重程度**: P0
- **问题描述**: Tab栏在同一行中包含：
  - 11个Tab按钮（每个含图标+文字，约90-100px）
  - 1个FeatureMenu按钮（约80px）
  - 日历信息区域（年号+季节+天气+日期，约200px）
  
  总宽度估算：11×95 + 80 + 200 = 1325px，超出1280px画框宽度约45px。日历信息使用 `margin-left: auto` 推到右侧，但会挤压Tab按钮的空间。当前Tab按钮使用 `flex: 1; max-width: 120px`，11个按钮会均分剩余空间，每个约(1280-80-200-16)/11 ≈ 90px，文字部分约45px，中文2字约26px，勉强放下。但一旦添加更多Tab或日历文字变长，就会溢出。
- **修复建议**: 
  1. 将日历信息从Tab栏移到资源栏右侧或场景区顶部
  2. 或将部分低频Tab（如"名士"、"军队"）移到FeatureMenu中
  3. Tab栏添加 `overflow-x: auto` 作为保底方案

### [D-02] Tab切换无动画过渡，视觉反馈生硬
- **文件**: `ThreeKingdomsGame.tsx` (renderSceneContent)
- **严重程度**: P2
- **问题描述**: Tab切换时，场景区内容直接替换（`switch (activeTab)` 返回不同组件），没有任何过渡动画。用户点击Tab后内容瞬间切换，体验生硬。对比Tab按钮本身有 `transition: color 0.15s, background 0.15s` 的hover动画，但内容区没有。
- **修复建议**: 为场景区添加淡入淡出或滑动过渡动画：
  ```css
  .tk-scene-area > * {
    animation: tk-scene-fade-in 0.2s ease-out;
  }
  @keyframes tk-scene-fade-in {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }
  ```

### [D-03] Tab高亮仅通过底部2px金色线条区分，不够醒目
- **文件**: `ThreeKingdomsGame.css`
- **行号**: 155-163 (.tk-tab-btn--active)
- **严重程度**: P2
- **问题描述**: 当前激活Tab的视觉反馈为：文字变金色(font-weight:600) + 底部2px金色线条 + 背景微弱金色(rgba 0.12)。在深色背景上，2px线条和0.12透明度的背景变化非常微弱，用户难以快速定位当前Tab。
- **修复建议**: 增强激活Tab的视觉反馈：
  1. 增加底部线条高度到3px
  2. 增加背景透明度到0.2
  3. 或添加顶部高亮线条形成"框选"效果

### [D-04] FeatureMenu与Tab栏中的重复入口（装备/竞技/远征/NPC/地图）
- **文件**: `ThreeKingdomsGame.tsx` (lines 110-120 FEATURE_ITEMS)
- **严重程度**: P2
- **问题描述**: FeatureMenu中包含"装备背包"、"竞技场"、"远征"、"NPC名册"、"世界地图"等入口，这些功能在Tab栏中已有对应Tab（equipment、arena、expedition、npc、map）。用户可能困惑于两套入口的关系。FeatureMenu点击后打开的是FeaturePanel弹窗，而Tab栏点击切换的是场景区内容，交互方式不一致。
- **修复建议**: 
  1. 从FeatureMenu中移除已有独立Tab的功能项
  2. 或将FeatureMenu改为"快捷入口"，点击后切换到对应Tab而非打开弹窗

### [D-05] 手机端隐藏了日历信息和"即将开放"标签，但无替代方案
- **文件**: `ThreeKingdomsGame.css`
- **行号**: 326-328 (.tk-calendar display:none, .tk-tab-soon display:none)
- **严重程度**: P2
- **问题描述**: 手机端通过 `display: none` 隐藏了日历信息和"即将开放"标签。日历信息包含当前年号、季节、天气、日期，是重要的游戏氛围元素，完全隐藏降低了沉浸感。"即将开放"标签的隐藏则让用户无法区分哪些Tab是可用的。
- **修复建议**: 
  1. 日历信息可折叠为一行简略显示（如"建安元年 春 晴"）
  2. 不可用Tab应在手机端灰显或添加小锁图标，而非隐藏标签

### [D-06] Tab按钮没有focus-visible样式，键盘导航体验差
- **文件**: `ThreeKingdomsGame.css`
- **严重程度**: P2
- **问题描述**: Tab按钮没有 `:focus-visible` 样式定义。虽然组件使用了 `role="tab"` 和 `aria-selected`，但键盘用户使用Tab键导航时无法看到焦点位置。
- **修复建议**: 添加focus-visible样式：
  ```css
  .tk-tab-btn:focus-visible {
    outline: 2px solid var(--tk-gold);
    outline-offset: -2px;
  }
  ```

---

## 问题汇总

| 编号 | 维度 | 严重程度 | 问题 | 文件 |
|------|------|---------|------|------|
| A-01 | 位置与尺寸 | P1 | 游戏画框1280×800固定尺寸，--tk-scale变量未计算 | ThreeKingdomsGame.css:103 |
| A-02 | 位置与尺寸 | P2 | 资源栏手机端auto高度不可控 | ResourceBar.css:128 |
| A-03 | 位置与尺寸 | P1 | 11个Tab+菜单+日历超出1280px画框宽度 | ThreeKingdomsGame.css:121 |
| A-04 | 位置与尺寸 | P1 | 手机端底部Tab栏缺少safe-area适配 | ThreeKingdomsGame.css:294 |
| A-05 | 位置与尺寸 | P1 | 多个面板弹窗无max-height限制 | EquipmentTab/ArenaTab/ExpeditionTab |
| A-06 | 位置与尺寸 | P2 | 按钮触摸热区不足44px | ArenaTab/EquipmentTab/ExpeditionTab |
| A-07 | 位置与尺寸 | P2 | MoreTab卡片小屏高度不一致 | MoreTab.tsx |
| B-01 | 图层与遮挡 | P1 | EventBanner(9000)与Toast(9000) z-index冲突 | EventBanner.css:11, Toast.css:9 |
| B-02 | 图层与遮挡 | P1 | z-index层级体系混乱，缺乏统一规范 | 全局30+文件 |
| B-03 | 图层与遮挡 | P2 | 内联z-index:1000与CSS类z-index:1000冲突 | 5个Panel组件 |
| B-04 | 图层与遮挡 | P2 | GuideOverlay层级定位不明确 | GuideOverlay.css:6 |
| B-05 | 图层与遮挡 | P2 | EventBanner(9000)遮挡RandomEncounterModal(1100) | EventBanner.css, RandomEncounterModal.css |
| C-01 | 响应式 | P1 | 5个Tab面板完全没有响应式适配 | Equipment/Arena/Expedition/Army/More |
| C-02 | 响应式 | P0 | 手机端11个Tab无滚动能力，右侧Tab不可见 | ThreeKingdomsGame.css:294 |
| C-03 | 响应式 | P2 | 响应式断点不统一(767px vs 768px) | 多个CSS文件 |
| C-04 | 响应式 | P2 | 缺少平板端(768-1024px)适配 | 全局 |
| C-05 | 响应式 | P1 | 全局缺少safe-area-inset处理 | 全局 |
| D-01 | 导航与交互 | P0 | Tab栏内容总宽超出画框，PC端溢出 | ThreeKingdomsGame.tsx:549 |
| D-02 | 导航与交互 | P2 | Tab切换无动画过渡 | ThreeKingdomsGame.tsx |
| D-03 | 导航与交互 | P2 | Tab高亮视觉反馈不够醒目 | ThreeKingdomsGame.css:155 |
| D-04 | 导航与交互 | P2 | FeatureMenu与Tab栏存在重复入口 | ThreeKingdomsGame.tsx:110 |
| D-05 | 导航与交互 | P2 | 手机端隐藏日历信息无替代方案 | ThreeKingdomsGame.css:326 |
| D-06 | 导航与交互 | P2 | Tab按钮缺少focus-visible样式 | ThreeKingdomsGame.css |

---

## 按严重程度排序

### P0 — 必须立即修复（2项）
1. **[C-02]** 手机端Tab栏无滚动能力，右侧Tab不可见
2. **[D-01]** PC端Tab栏内容总宽超出画框

### P1 — 尽快修复（7项）
3. **[A-01]** --tk-scale变量未计算，小屏无法等比缩放
4. **[A-03]** 11个Tab+菜单+日历超出画框宽度
5. **[A-04]** 手机端底部Tab栏缺少safe-area适配
6. **[A-05]** 多个面板弹窗无max-height限制
7. **[B-01]** EventBanner与Toast z-index冲突
8. **[B-02]** z-index层级体系混乱
9. **[C-01]** 5个Tab面板完全没有响应式适配
10. **[C-05]** 全局缺少safe-area-inset处理

### P2 — 后续优化（10项）
11. **[A-02]** 资源栏手机端auto高度不可控
12. **[A-06]** 按钮触摸热区不足44px
13. **[A-07]** MoreTab卡片小屏高度不一致
14. **[B-03]** 内联z-index与CSS类z-index冲突
15. **[B-04]** GuideOverlay层级定位不明确
16. **[B-05]** EventBanner遮挡RandomEncounterModal
17. **[C-03]** 响应式断点不统一
18. **[C-04]** 缺少平板端适配
19. **[D-02]** Tab切换无动画过渡
20. **[D-03]** Tab高亮不够醒目
21. **[D-04]** FeatureMenu与Tab栏重复入口
22. **[D-05]** 手机端隐藏日历无替代
23. **[D-06]** Tab按钮缺少focus-visible样式

---

## 修复优先级建议

### 第一批（P0 + 关键P1）— 阻断性问题
1. **[C-02] + [D-01]**: Tab栏溢出问题 — 手机端添加横向滚动，PC端精简Tab或移出日历
2. **[A-01]**: 实现 `--tk-scale` 动态计算
3. **[A-05]**: 为所有弹窗添加 max-height + overflow-y:auto
4. **[B-02]**: 建立统一z-index token体系

### 第二批（P1 + 高优P2）— 体验性问题
5. **[C-01]**: 为5个无响应式的Tab添加基本的手机端适配
6. **[C-05] + [A-04]**: 添加safe-area-inset处理
7. **[A-06]**: 按钮触摸热区达标
8. **[B-01] + [B-05]**: 修复EventBanner z-index

### 第三批（P2）— 优化提升
9. 其余P2问题按实际影响逐步修复
