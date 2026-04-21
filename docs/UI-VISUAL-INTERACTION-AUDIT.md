# 三国霸业 UI 视觉与交互审计报告

> **审计日期**：2025-07  
> **审计范围**：`src/components/idle/` 全部面板、弹窗、资源栏、Tab 栏  
> **审计维度**：弹窗一致性、错误处理、加载状态、Tab 栏交互、资源显示一致性  
> **严重等级**：P0（阻断级）→ P1（体验级）→ P2（优化级）

---

## 问题汇总

| 等级 | 数量 |
|------|------|
| P0 | 4 |
| P1 | 8 |
| P2 | 7 |
| **合计** | **19** |

---

## P0 — 阻断级问题（必须修复）

### P0-01：引擎初始化无 try-catch 保护，崩溃后白屏

- **文件**：`src/components/idle/ThreeKingdomsGame.tsx`
- **行号**：L443–L453
- **问题**：`engine.load()` 和 `engine.init()` 在 `useEffect` 中直接调用，无任何错误捕获。若引擎初始化失败（存档损坏、localStorage 异常等），整个游戏组件将崩溃白屏，无任何用户反馈。
- **修复建议**：
  ```tsx
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    try {
      const offlineEarnings = engine.load();
      if (!offlineEarnings) {
        engine.init();
      } else {
        // ... 离线收益逻辑
      }
      setSnapshotVersion(1);
    } catch (e: any) {
      Toast.danger('游戏初始化失败，请刷新重试');
      console.error('[TK] Init failed:', e);
      // 可选：清除损坏存档后重试
      try { localStorage.removeItem('tk-save'); engine.init(); setSnapshotVersion(1); } catch {}
    }
  }, [engine]);
  ```

### P0-02：多个自定义弹窗缺少 ESC 键关闭支持

- **文件**（均无 `keydown/Escape` 监听）：
  - `src/components/idle/panels/hero/HeroDetailModal.tsx` — L192
  - `src/components/idle/panels/hero/RecruitModal.tsx` — L149
  - `src/components/idle/panels/hero/HeroCompareModal.tsx` — L72
  - `src/components/idle/panels/hero/HeroStarUpModal.tsx` — L338
  - `src/components/idle/panels/npc/NPCInfoModal.tsx` — L90
  - `src/components/idle/panels/npc/NPCDialogModal.tsx` — L134
  - `src/components/idle/panels/event/RandomEncounterModal.tsx` — L111
  - `src/components/idle/panels/campaign/BattleResultModal.tsx` — L173
  - `src/components/idle/panels/campaign/SweepModal.tsx` — L266
- **问题**：通用 `Modal` 组件（`common/Modal.tsx`）已正确实现 ESC 关闭，但以上 9 个自定义弹窗全部自行实现 overlay，均未添加 `keydown` 事件监听。用户按 ESC 无反应，严重影响键盘操作体验。
- **修复建议**：在每个自定义弹窗中添加统一的 ESC 监听 hook，或提取公共 `useEscapeClose(onClose)` hook：
  ```tsx
  useEffect(() => {
    if (!visible) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [visible, onClose]);
  ```

### P0-03：HeroTab/HeroCard 中引擎调用无 try-catch，渲染时崩溃

- **文件**：
  - `src/components/idle/panels/hero/HeroTab.tsx` — L91, L100, L112
  - `src/components/idle/panels/hero/HeroCard.tsx` — L62
- **问题**：`engine.getGenerals()`、`engine.getHeroSystem().calculatePower()`、`engine.getHeroSystem().calculateTotalPower()` 在 `useMemo` 中直接调用，无错误保护。若引擎子系统返回异常数据（如 `null`/`undefined`），将导致整个 Tab 崩溃。
- **修复建议**：
  ```tsx
  const allGenerals = useMemo(() => {
    void snapshotVersion;
    try { return engine.getGenerals(); } catch { return []; }
  }, [engine, snapshotVersion]);
  
  const totalPower = useMemo(() => {
    try { return engine.getHeroSystem().calculateTotalPower(); } catch { return 0; }
  }, [engine, allGenerals]);
  ```

### P0-04：BattleResultModal 和 SweepModal 遮罩层点击无法关闭

- **文件**：
  - `src/components/idle/panels/campaign/BattleResultModal.tsx` — L173：`<div className="tk-brm-overlay">` 无 `onClick` 处理
  - `src/components/idle/panels/campaign/SweepModal.tsx` — L266：`<div className="tk-sweep-overlay">` 无 `onClick` 处理
- **问题**：这两个弹窗的 overlay 层没有 `onClick` 事件，用户点击遮罩区域无法关闭弹窗。对比 `BattleFormationModal`（L251–252）已正确实现 `onClick={onClose}`。
- **修复建议**：添加遮罩点击关闭，并阻止冒泡：
  ```tsx
  <div className="tk-brm-overlay" onClick={onConfirm} role="dialog" aria-modal="true">
    <div className="tk-brm-modal" onClick={(e) => e.stopPropagation()}>
  ```

---

## P1 — 体验级问题（强烈建议修复）

### P1-01：数字格式化不统一，同一资源在不同面板显示格式不同

- **文件**：
  - `src/components/idle/panels/resource/ResourceBar.tsx` — L50–L60：`formatAmount()` — `k`(小写)/`M`(大写)，1万以上用 `k`，100万以上用 `M`
  - `src/components/idle/panels/building/BuildingPanel.tsx` — L86–L88：`formatNum()` — `K`(大写)/`M`(大写)，1万以上用 `K`，100万以上用 `M`
  - `src/components/idle/panels/building/BuildingUpgradeModal.tsx` — L37–L39：同上 `K`(大写)
  - `src/components/idle/ThreeKingdomsGame.tsx` — L497, L948：直接使用 `.toLocaleString()`
  - `src/components/idle/panels/shop/ShopPanel.tsx` — L132：直接使用 `.toLocaleString()`
- **问题**：
  1. `k` vs `K` 大小写不一致
  2. 缩写阈值不一致（ResourceBar 1万起缩写 vs BuildingPanel 1万起缩写，但 ResourceBar compact 模式 1000 起缩写）
  3. 部分面板用 `toLocaleString()` 全量展示，部分用缩写
- **修复建议**：提取统一 `formatNumber(n: number, compact?: boolean)` 到 `common/constants.ts`，所有面板统一引用。

### P1-02：NPCInfoModal 点击遮罩直接关闭，未阻止冒泡

- **文件**：`src/components/idle/panels/npc/NPCInfoModal.tsx` — L90
- **问题**：`<div className="tk-npcinfo-overlay" onClick={onClose}>` 直接在 overlay 上绑定 `onClose`，但内部 modal 没有显式 `e.stopPropagation()`（虽然在 L91 有 `onClick={(e) => e.stopPropagation()}`，但 overlay 的 `onClick` 会在冒泡阶段触发）。对比 `RandomEncounterModal`（L112）正确实现了 `onClick={(e) => e.stopPropagation()}`。
- **修复建议**：确认内部 modal 的 `stopPropagation` 是否正确生效。建议统一使用 `e.target === e.currentTarget` 模式判断。

### P1-03：HeroStarUpModal 遮罩层无点击关闭能力

- **文件**：`src/components/idle/panels/hero/HeroStarUpModal.tsx` — L338
- **问题**：`<div className="tk-starup-overlay">` 没有 `onClick` 处理，用户点击遮罩无法关闭弹窗。且无 ESC 键支持（见 P0-02）。只能通过右上角 ✕ 按钮关闭。
- **修复建议**：
  ```tsx
  <div className="tk-starup-overlay" onClick={(e) => e.target === e.currentTarget && onClose()} ...>
  ```

### P1-04：engine.getSnapshot() 无错误保护

- **文件**：`src/components/idle/ThreeKingdomsGame.tsx` — L571
- **问题**：`engine.getSnapshot()` 在 `useMemo` 中直接调用，若引擎内部状态异常（如 tick 期间数据不一致），将导致整个游戏 UI 崩溃。
- **修复建议**：
  ```tsx
  const snapshot: EngineSnapshot = useMemo(() => {
    void snapshotVersion;
    try { return engine.getSnapshot(); }
    catch { return engine.getDefaultSnapshot?.() ?? DEFAULT_SNAPSHOT; }
  }, [engine, snapshotVersion]);
  ```

### P1-05：engine.tick() 无 try-catch，tick 异常将中断游戏循环

- **文件**：`src/components/idle/ThreeKingdomsGame.tsx` — L464–L466
- **问题**：`setInterval` 中直接调用 `engine.tick(TICK_INTERVAL)`，若某次 tick 抛出异常，`setInterval` 不会中断但错误会被吞掉（在 setInterval 回调中未捕获的异常不会冒泡），导致游戏静默停止更新。
- **修复建议**：
  ```tsx
  useEffect(() => {
    const timer = setInterval(() => {
      try { engine.tick(TICK_INTERVAL); }
      catch (e) { console.error('[TK] Tick error:', e); }
    }, TICK_INTERVAL);
    return () => clearInterval(timer);
  }, [engine]);
  ```

### P1-06：大部分面板缺少 loading 状态

- **文件**：所有 `panels/` 下的组件
- **问题**：除 `NPCDialogModal`（L158 有 "加载中..." 文案）外，其余面板均无 loading 状态。当引擎计算耗时较长时（如后期大量武将数据），UI 会短暂无响应而无法给用户反馈。
- **修复建议**：对于数据量大的面板（武将列表、科技树、世界地图），在首次渲染或数据刷新时显示骨架屏或 loading 动画。

### P1-07：大部分面板缺少空数据状态提示

- **文件**：多个面板组件
- **问题**：仅 `NPCTab`（L201–L205）和 `TechOfflinePanel`（L165–L166）有空状态提示。其余面板如 `ShopPanel`、`TradePanel`、`SocialPanel`、`MailPanel` 等在无数据时无明确提示，可能显示空白区域。
- **修复建议**：为所有列表类面板统一添加空状态组件：
  ```tsx
  {data.length === 0 && (
    <div className="tk-empty-state">
      <span className="tk-empty-icon">📭</span>
      <span className="tk-empty-text">暂无数据</span>
    </div>
  )}
  ```

### P1-08：StoryEventModal 使用内联样式，与其他弹窗风格不一致

- **文件**：`src/components/idle/panels/event/StoryEventModal.tsx` — L51–L95
- **问题**：StoryEventModal 虽然使用了通用 `Modal` 组件，但内部内容全部使用 `style={{...}}` 内联样式（如 `background: 'linear-gradient(135deg, #3a2a1a, #4a3a2a)'`），与其他弹窗使用 CSS class 的风格不一致。且选择按钮的样式与通用 Modal 的按钮样式（金色边框）完全不同。
- **修复建议**：将内联样式提取到 `StoryEventModal.css`，使用统一的 `tk-` 命名空间 class。

---

## P2 — 优化级问题（建议改进）

### P2-01：自定义弹窗未复用通用 Modal 组件，维护成本高

- **文件**：9 个自定义弹窗组件（NPCInfoModal、NPCDialogModal、RandomEncounterModal、HeroDetailModal、RecruitModal、HeroCompareModal、HeroStarUpModal、BattleFormationModal、BattleResultModal、SweepModal）
- **问题**：这些弹窗都自行实现了 overlay/modal 结构、关闭按钮、遮罩点击等逻辑，与通用 `Modal` 组件功能高度重叠。每次修改弹窗基础行为（如添加 ESC 支持）都需要逐一修改 9+ 个文件。
- **修复建议**：逐步重构自定义弹窗，基于 `common/Modal` 组件扩展。对于需要自定义布局的弹窗，可以扩展 Modal 支持 `renderHeader`/`renderBody`/`renderFooter` 插槽。

### P2-02：自定义弹窗的 z-index 未统一管理

- **文件**：各自定义弹窗的 CSS 文件
- **问题**：`ThreeKingdomsGame.css` 定义了完整的 z-index 层级体系（`--tk-z-modal: 500`、`--tk-z-modal-detail: 600` 等），但自定义弹窗的 CSS 中部分直接使用硬编码 z-index，部分使用 CSS 变量。层级关系不透明，可能出现弹窗叠加顺序错误。
- **修复建议**：所有弹窗统一使用 CSS 变量：
  - 主弹窗：`z-index: var(--tk-z-modal)` (500)
  - 详情/子弹窗：`z-index: var(--tk-z-modal-detail)` (600)
  - 战斗场景：`z-index: var(--tk-z-battle-scene)` (550)

### P2-03：Tab 栏 11 个 Tab 在移动端可能超出可视区域

- **文件**：`src/components/idle/ThreeKingdomsGame.css` — L150–L175, L361–L378
- **问题**：Tab 栏已有横向滚动支持（`overflow-x: auto`、`scrollbar-width: none`），但 11 个 Tab 在小屏幕（320px 宽度）上每个 Tab 最小 44px + 间距，总计约 530px，需要滚动。用户可能不知道可以横向滚动（无滚动指示器）。
- **修复建议**：
  1. 在 Tab 栏右侧添加渐变遮罩，暗示可滚动
  2. 或在移动端将低频 Tab 收入 "更多" 菜单

### P2-04：Tab 切换无动画过渡

- **文件**：`src/components/idle/ThreeKingdomsGame.tsx` — `renderSceneContent()` 函数
- **问题**：Tab 切换时场景区内容直接替换，无淡入淡出或滑动动画，切换感觉生硬。
- **修复建议**：添加简单的 `opacity` + `transform` 过渡动画（200ms）。

### P2-05：FeaturePanel 和 Panel 组件功能重叠

- **文件**：
  - `src/components/idle/FeaturePanel.tsx`
  - `src/components/idle/common/Panel.tsx`
- **问题**：`FeaturePanel` 自行实现了面板弹窗逻辑（遮罩、关闭、动画），与通用 `Panel` 组件功能高度重叠。两者样式略有差异（背景色、边框等），导致视觉不一致。
- **修复建议**：`FeaturePanel` 应基于 `common/Panel` 组件构建，确保视觉风格统一。

### P2-06：ResourceBar 详情浮层缺少 ESC 关闭

- **文件**：`src/components/idle/panels/resource/ResourceBar.tsx` — L263
- **问题**：`<div className="tk-res-detail-overlay" onClick={() => setShowDetails(false)}>` 有遮罩点击关闭，但无 ESC 键支持。
- **修复建议**：添加 `useEffect` 监听 ESC 键。

### P2-07：Toast 组件使用 `createRoot`，与 React 18 并行模式可能冲突

- **文件**：`src/components/idle/common/Toast.tsx` — L44–L48
- **问题**：Toast 使用 `createRoot` 独立创建 React 树来渲染，脱离了主应用的 Context 体系（如主题、国际化等）。且 `root.render()` 每次调用都是同步渲染，在高频触发时可能造成性能问题。
- **修复建议**：考虑使用 React Portal + 状态管理（如 zustand/jotai）替代 `createRoot` 方案，使 Toast 保持在与主应用同一 React 树中。

---

## 附录 A：弹窗一致性检查矩阵

| 弹窗组件 | 通用Modal | ESC关闭 | 遮罩点击 | X按钮 | max-height | overflow-y |
|----------|:---------:|:-------:|:--------:|:-----:|:----------:|:----------:|
| Modal (通用) | ✅ | ✅ | ✅ | ✅ | 85vh | ✅ (body) |
| Panel (通用) | ✅ | ✅ | ✅ | ✅ | 90vh | ✅ |
| 离线收益弹窗 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 欢迎弹窗 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| StoryEventModal | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| SiegeConfirmModal | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ExpeditionPanel内Modal | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ArenaPanel内Modal | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| NPCInfoModal | ❌ 自定义 | ❌ | ✅ | ✅ | 80vh | ✅ |
| NPCDialogModal | ❌ 自定义 | ❌ | ✅ | ✅ | 70vh | ✅ |
| RandomEncounterModal | ❌ 自定义 | ❌ | ✅ | ✅ | 85vh | ✅ |
| HeroDetailModal | ❌ 自定义 | ❌ | ✅ | ✅ | — | — |
| RecruitModal | ❌ 自定义 | ❌ | ✅ | ✅ | — | — |
| HeroCompareModal | ❌ 自定义 | ❌ | ✅ | — | — | — |
| HeroStarUpModal | ❌ 自定义 | ❌ | ❌ | ✅ | — | — |
| BattleFormationModal | ❌ 自定义 | ❌ | ✅ | ✅ | — | — |
| BattleResultModal | ❌ 自定义 | ❌ | ❌ | — | — | — |
| SweepModal | ❌ 自定义 | ❌ | ❌ | ✅ | — | — |
| TechNodeDetailModal | ❌ 自定义 | ✅ | ✅ | — | 80vh | ✅ |
| BuildingUpgradeModal | ❌ 自定义 | ✅ | ✅ | — | 80vh | ✅ |

> ✅ = 已实现  ❌ = 未实现  — = 未明确设置

---

## 附录 B：数字格式化对比

| 位置 | 函数名 | 1,000 | 10,000 | 1,000,000 | 大小写 |
|------|--------|-------|--------|-----------|--------|
| ResourceBar | `formatAmount()` | `1,000` / `1.0k`(compact) | `10.0k` | `1.00M` | `k`小写 `M`大写 |
| BuildingPanel | `formatNum()` | `1,000` | `10.0K` | `1.0M` | `K`大写 `M`大写 |
| BuildingUpgradeModal | `formatNum()` | `1,000` | `10.0K` | `1.0M` | `K`大写 `M`大写 |
| ThreeKingdomsGame | `.toLocaleString()` | `1,000` | `10,000` | `1,000,000` | 无缩写 |
| ShopPanel | `.toLocaleString()` | `1,000` | `10,000` | `1,000,000` | 无缩写 |

---

## 修复优先级路线图

### 第一阶段（P0，立即修复）
1. 引擎初始化添加 try-catch（P0-01）
2. 所有自定义弹窗添加 ESC 键关闭（P0-02）— 提取 `useEscapeClose` hook
3. HeroTab/HeroCard 引擎调用添加错误保护（P0-03）
4. BattleResultModal/SweepModal 添加遮罩点击关闭（P0-04）

### 第二阶段（P1，本周修复）
1. 统一 `formatNumber` 工具函数（P1-01）
2. engine.getSnapshot() / engine.tick() 添加错误保护（P1-04, P1-05）
3. HeroStarUpModal 添加遮罩点击关闭（P1-03）
4. 添加空状态组件（P1-07）
5. StoryEventModal 样式重构（P1-08）

### 第三阶段（P2，迭代优化）
1. 自定义弹窗逐步迁移到通用 Modal（P2-01）
2. z-index 统一管理（P2-02）
3. Tab 栏移动端优化（P2-03）
4. FeaturePanel 统一到 Panel（P2-05）
