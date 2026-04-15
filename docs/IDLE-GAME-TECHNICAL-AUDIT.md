# 放置游戏引擎技术审计报告

> **审计日期**: 2025-07-10  
> **审计范围**: IdleGameEngine 基类 + 19 个子系统模块 + 三国霸业 + 华夏文明  
> **审计人**: 系统架构师

---

## 执行摘要

当前放置游戏引擎的**后端数据逻辑**架构完善——19 个子系统模块覆盖了放置游戏的核心玩法（资源、建筑、声望、战斗、领土、科技树、武将、粒子、飘字等）。但**前端渲染和交互层**极其薄弱，整体处于「**纯文字终端式 UI**」阶段，距离可发布的游戏体验差距巨大。

| 维度 | 当前状态 | 成熟度 |
|------|---------|--------|
| 数据模型 & 游戏逻辑 | ✅ 完善 | ★★★★☆ |
| Canvas 渲染能力 | ⚠️ 极度原始 | ★☆☆☆☆ |
| 交互能力 | ⚠️ 仅键盘 | ★☆☆☆☆ |
| 视觉表现 | ❌ 纯文字+色块 | ★☆☆☆☆ |
| 场景系统 | ❌ 不存在 | ☆☆☆☆☆ |
| 资源管线 | ❌ 无美术资源 | ☆☆☆☆☆ |

---

## A. 渲染能力审计

### A1. Canvas 渲染架构分析

**当前架构**: 纯 Canvas 2D 即时模式（Immediate Mode），每帧全量重绘。

```
GameEngine.gameLoop()
  → update(deltaTime)       // 逻辑更新
  → render()                // ctx.clearRect → onRender(ctx, w, h)
    → onRender()            // 子类实现，直接调用 fillRect/fillText
```

**核心渲染手段**（全部在 `onRender` 中直接调用）：

| API | 使用场景 | 位置 |
|-----|---------|------|
| `ctx.createLinearGradient` + `fillRect` | 背景渐变 | `drawBg()` |
| `ctx.fillText` | 所有文字（标题、数值、名称） | 全部 draw* 方法 |
| `ctx.beginPath` + `arcTo` + `fill/stroke` | 圆角矩形面板/卡片 | 本地 `rr()` 函数 |
| `ctx.fillStyle` | 纯色填充 | 全部 |
| Emoji 字符渲染 | 图标（🌾💰⚔️🏰等） | 全部 |

**结论**: 渲染 100% 基于 `fillRect` + `fillText` + 圆角矩形路径，是最原始的 Canvas 2D 绘制方式。

### A2. 精灵图(Sprite)渲染能力

| 能力 | 状态 | 说明 |
|------|------|------|
| `drawImage` 调用 | ❌ 不存在 | 整个引擎零 `drawImage` 调用 |
| 精灵图加载/管理 | ❌ 不存在 | 无 Image 对象、无资源预加载 |
| 精灵图动画帧 | ❌ 不存在 | 无 spritesheet、无 frame 概念 |
| 纹理图集(Texture Atlas) | ❌ 不存在 | 无相关基础设施 |

**影响**: 无法渲染任何图片资源，所有视觉元素只能是文字和色块。

### A3. 地图渲染能力

| 能力 | 状态 | 说明 |
|------|------|------|
| 瓦片地图(Tilemap) | ❌ 不存在 | 无瓦片概念 |
| 滚动/平移地图 | ❌ 不存在 | 无视口(viewport)概念 |
| 地图坐标系统 | ⚠️ 数据存在 | `TerritoryDef.position: {x, y}` 已定义但**从未用于渲染** |
| 区域占领可视化 | ❌ 不存在 | 领土只有列表视图，无地图视图 |
| 路径/连接线渲染 | ❌ 不存在 | `TerritoryDef.adjacent` 有连接数据但未可视化 |

**关键发现**: `TerritorySystem` 已定义了 15 块领土的 `position` 坐标和 `adjacent` 连接关系，数据层完全支持地图渲染，但渲染层完全没有利用这些数据。

### A4. 场景/画面切换能力

| 能力 | 状态 | 说明 |
|------|------|------|
| 场景管理器 | ❌ 不存在 | 无 SceneManager |
| 画面切换动画 | ❌ 不存在 | 无过渡效果 |
| 面板切换 | ⚠️ 基础实现 | `ActivePanel` 枚举 + `switch/case` 硬切换 |
| 弹窗/对话框 | ❌ 不存在 | 无 Modal/Dialog 组件 |
| 多层渲染(背景/前景/UI) | ⚠️ 手动分层 | `drawBg → drawHeader → drawResBar → drawContent → drawFooter` |

**当前面板切换机制**（以三国霸业为例）：
```typescript
type ActivePanel = 'none' | 'prestige' | 'tech' | 'territory' | 'battle' | 'generals';
// switch(this.panel) 硬编码 6 个分支，无动画、无过渡
```

### A5. 分辨率和自适应方案

| 能力 | 状态 | 说明 |
|------|------|------|
| 固定分辨率 | ✅ 480×640 | `BASE_W = 480; BASE_H = 640` 硬编码 |
| CSS 缩放适配 | ✅ 有 | Canvas 通过 CSS `max-width: 100%` 缩放 |
| DPR 适配 | ❌ 不存在 | 未使用 `devicePixelRatio`，高分屏模糊 |
| 响应式布局 | ❌ 不存在 | 所有坐标基于 480px 宽度硬编码 |
| 横竖屏适配 | ❌ 不存在 | 仅支持竖屏 |

**坐标转换**（GameContainer.tsx）：
```typescript
const toCanvasCoords = (clientX, clientY) => {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;   // canvas.width = 480
  const scaleY = canvas.height / rect.height;  // canvas.height = 640
  return [(clientX - rect.left) * scaleX, (clientY - rect.top) * scaleY];
};
```

---

## B. 交互能力审计

### B1. 输入事件处理

**InputHandler 模块**（~300行）是一个纯**键盘输入映射器**：

| 输入类型 | 支持程度 | 说明 |
|---------|---------|------|
| 键盘按下 | ✅ 完整 | `handleKeyDown(key)` → 查映射表 → 分发回调 |
| 键盘释放 | ⚠️ 预留 | `handleKeyUp` 空实现，注释"预留长按检测" |
| 鼠标点击 | ❌ 不处理 | IdleGameEngine 未使用 `handleClick` |
| 鼠标移动 | ❌ 不处理 | 未实现 hover 效果 |
| 触摸事件 | ❌ 不处理 | GameContainer 转发了触摸事件但引擎未消费 |
| 拖拽操作 | ❌ 不存在 | 无 drag & drop 基础设施 |
| 滚轮滚动 | ❌ 不存在 | 列表滚动通过键盘 ↑↓ |

**关键问题**: GameContainer 已经把 `click/mousedown/mouseup/mousemove/touchstart/contextmenu/dblclick` 全部转发到引擎的 `handleClick/handleMouseDown/...` 方法，但 `IdleGameEngine` 和所有子类**完全没有覆盖这些方法**。鼠标/触摸事件被直接丢弃。

### B2. UI 交互能力

| 交互模式 | 状态 | 说明 |
|---------|------|------|
| 点击建筑卡片 | ❌ 不支持 | 建筑选择仅通过 ↑↓ 键 |
| 点击面板标签 | ❌ 不支持 | Tab 切换仅通过键盘快捷键 |
| 点击购买按钮 | ❌ 不支持 | 购买仅通过 Enter 键 |
| 悬停高亮 | ❌ 不存在 | 无 hover 状态 |
| 弹窗确认 | ❌ 不存在 | 声望转生无确认弹窗 |
| 拖拽排序 | ❌ 不存在 | 无 |
| 捏合缩放 | ❌ 不存在 | 无 |
| 长按操作 | ❌ 不存在 | 无 |

**结论**: 当前游戏**只能通过键盘操作**，完全不支持鼠标/触摸交互，在移动端基本不可用。

---

## C. 游戏系统深度审计

### C1. 建筑系统

**数据层**（BuildingSystem ~617行）：✅ 完善

| 功能 | 状态 | 说明 |
|------|------|------|
| 建筑注册/购买/升级 | ✅ | 泛型 `BuildingSystem<Def>` |
| 费用递增公式 | ✅ | `baseCost × costMultiplier^level` |
| 产出计算 | ✅ | `baseProduction × level × globalMultiplier` |
| 前置解锁 | ✅ | `requires` 数组 |
| 存档/读档 | ✅ | `saveState/loadState` |

**渲染层**：❌ 极度简陋

| 视觉功能 | 状态 | 说明 |
|---------|------|------|
| 建筑图标 | ⚠️ Emoji | `🌾💰⚔️🔨📚💊🏰🏯` — 依赖系统字体渲染 |
| 建筑等级显示 | ✅ 文字 | `Lv.${lv}` 纯文本 |
| 产出显示 | ✅ 文字 | `产出: 1.5K/s` |
| 费用显示 | ✅ 文字 | 颜色区分可否购买 |
| 建造动画 | ❌ | 点击购买后无任何动画效果 |
| 升级动画 | ❌ | 等级变化无视觉反馈 |
| 建筑外观变化 | ❌ | Lv.1 和 Lv.100 外观完全一样 |
| 驻留英雄展示 | ❌ | 无武将驻留建筑的视觉 |
| 建筑详情面板 | ❌ | 无点击展开详情 |

### C2. 战斗系统

**数据层**（BattleSystem ~297行）：✅ 完善

| 功能 | 状态 | 说明 |
|------|------|------|
| 波次管理 | ✅ | `startWave/settleWave` |
| 敌人实例化 | ✅ | HP/攻击/防御/掉落 |
| 伤害计算 | ✅ | `attack(enemyId, damage)` |
| Buff/Debuff | ✅ | 有持续时间倒计时 |
| 掉落掷骰 | ✅ | 概率掉落系统 |
| Boss 判定 | ✅ | `isBoss` 标记 |
| 事件系统 | ✅ | 6 种事件类型 |

**渲染层**：❌ 几乎没有

| 视觉功能 | 状态 | 说明 |
|---------|------|------|
| 战斗场景 | ❌ | 无独立战斗画面 |
| 敌人形象 | ❌ | 只有名字文字 |
| HP 条 | ⚠️ 基础 | `drawBar()` 绘制简单进度条 |
| 战斗动画 | ❌ | 无攻击/受击/死亡动画 |
| 技能特效 | ❌ | `abilities: ['thunder']` 有数据无渲染 |
| 伤害数字 | ❌ | 无战斗中的伤害飘字 |
| 战斗日志 | ❌ | 无文字战斗日志 |
| 战斗结算画面 | ❌ | 无胜利/失败展示 |

**关键缺失**: 三国霸业定义了 15 场战斗（5 关卡 × 3 波），敌人有 `abilities`（thunder, unmatched, charge 等），但**战斗完全是自动数值计算**，玩家看到的只是列表中的一行文字和一个小进度条。

### C3. 地图/领土系统

**数据层**（TerritorySystem ~225行）：✅ 完善

| 功能 | 状态 | 说明 |
|------|------|------|
| 图结构领土 | ✅ | `adjacent` 连接关系 |
| 进攻/征服 | ✅ | `attack/conquer` 完整流程 |
| 繁荣度系统 | ✅ | 自动增长 + 驻军加速 |
| 征服加成 | ✅ | `conquestBonus` |
| 收入计算 | ✅ | `getIncomePerSecond()` |
| 存档/读档 | ✅ | `serialize/deserialize` |

**渲染层**：❌ 完全缺失

| 视觉功能 | 状态 | 说明 |
|---------|------|------|
| 可视化地图 | ❌ | `position: {x, y}` 数据已定义但未渲染 |
| 区域占领着色 | ❌ | 已征服/未征服无视觉区分 |
| 连接线 | ❌ | `adjacent` 关系未可视化 |
| 进攻进度 | ❌ | `attackProgress` 未渲染 |
| 地形类型图标 | ❌ | `type: plains/mountain/forest` 未渲染 |
| 点击选择领土 | ❌ | 无交互 |

**关键发现**: 15 块领土的坐标数据已完整定义（如洛阳 `{x:380, y:180}`），数据层已完全支持地图渲染，但渲染层**只渲染了一个垂直列表**。

### C4. 武将/英雄系统

**数据层**（UnitSystem ~631行）：✅ 完善

| 功能 | 状态 | 说明 |
|------|------|------|
| 武将定义 | ✅ | 12 个武将，5 个稀有度 |
| 招募系统 | ✅ | 费用 + 条件 |
| 等级/经验 | ✅ | `level/exp/growthRates` |
| 进化系统 | ✅ | `evolutions` 分支 |
| 稀有度颜色 | ✅ | `RARITY_COLORS` 映射 |

**渲染层**：❌ 极度简陋

| 视觉功能 | 状态 | 说明 |
|---------|------|------|
| 武将立绘 | ❌ | 无任何图片资源 |
| 稀有度边框 | ❌ | 仅文字颜色区分 |
| 属性面板 | ⚠️ 文字 | `攻65 防70 智80 统90` |
| 技能展示 | ❌ | 无技能图标/描述 |
| 进化预览 | ❌ | `evolution` 字段仅文字 |
| 武将详情页 | ❌ | 无点击展开 |
| 阵营标识 | ❌ | 仅文字 `SHU` |

### C5. 剧情/事件系统

| 功能 | 状态 | 说明 |
|------|------|------|
| 剧情系统 | ❌ 不存在 | 无 StorySystem / EventSystem |
| 对话系统 | ❌ 不存在 | 无 DialogSystem |
| 剧情触发器 | ❌ 不存在 | 无条件触发机制 |
| 过场动画 | ❌ 不存在 | 无 CutsceneSystem |
| 随机事件 | ❌ 不存在 | 无 RandomEventSystem |

---

## D. 画面质量审计

### D1. 当前 UI 风格

**整体风格**: 暗色背景 + 半透明面板 + 纯文字 + Emoji 图标

```
┌──────────────────────────────┐
│  ██████ 渐变背景 ██████       │  ← createLinearGradient
│                              │
│     ★ 三国霸业 ★             │  ← fillText (金色)
│  ⚔️黄巾之乱 — 天下大乱...    │  ← fillText (棕色)
│                              │
│ [🏗️建筑][⚔️武将][🗺️领土]...  │  ← rr() 圆角矩形 + fillText
│                              │
│ ┌────────────────────────┐   │
│ │ 🌾1.5K  💰800  ⚔️200  │   │  ← 资源条 (Emoji + 数字)
│ └────────────────────────┘   │
│                              │
│ ┌────────────────────────┐   │
│ │ 🌾 农田 Lv.15          │   │  ← 建筑卡片
│ │ 产出: 1.5K/s            │   │     (rr() + fillText)
│ │              升级: 2.3K  │   │
│ └────────────────────────┘   │
│ ┌────────────────────────┐   │
│ │ 💰 市集 Lv.8           │   │
│ │ ...                     │   │
│ └────────────────────────┘   │
│                              │
│ [Space]点击 [↑↓]选择 ...     │  ← 操作提示
└──────────────────────────────┘
```

### D2. 视觉元素清单

| 元素 | 当前实现 | 缺失 |
|------|---------|------|
| 背景 | ✅ 线性渐变 | ❌ 无纹理/图案/粒子背景 |
| 面板 | ✅ 半透明圆角矩形 | ❌ 无装饰边框/花纹 |
| 图标 | ⚠️ Emoji | ❌ 无自定义图标/矢量图标 |
| 文字 | ✅ 基础排版 | ❌ 无文字特效/描边/阴影(除飘字外) |
| 进度条 | ✅ 简单填充 | ❌ 无动画/渐变/花纹 |
| 按钮 | ❌ 不存在 | 所有操作通过键盘 |
| 列表滚动 | ⚠️ 键盘滚动 | ❌ 无滚动条/触摸滑动 |
| 动画 | ⚠️ 飘字+粒子 | ❌ 无 UI 过渡动画 |

### D3. 色彩方案

**三国霸业**: 暗红色系
```typescript
bgGradient1: '#1a0a0a'  // 深暗红
bgGradient2: '#2d1b1b'  // 暗红
accentGold: '#ffd700'   // 金色强调
panelBg: 'rgba(255,255,255,0.05)'  // 几乎透明的面板
```

**华夏文明**: 未自定义（使用默认深蓝）

**CanvasUIRenderer 默认**: 深蓝色系
```typescript
bgGradient1: '#1a1a2e'  // 深蓝紫
bgGradient2: '#16213e'  // 深蓝
```

**问题**: 
1. 面板背景 `rgba(255,255,255,0.05)` 几乎不可见
2. 无色彩层次感，所有面板视觉权重相同
3. Emoji 图标在不同平台渲染不一致

### D4. 特效系统

| 特效 | 模块 | 状态 | 说明 |
|------|------|------|------|
| 飘字效果 | FloatingTextSystem | ✅ 完善 | 5 种轨迹 + 4 种缓动 + 6 种预设 |
| 粒子效果 | ParticleSystem | ✅ 完善 | 多种发射器形状 + 颜色插值 + 重力 |
| 屏幕震动 | ❌ | 不存在 | 无 Camera/Shake 系统 |
| 闪光效果 | ❌ | 不存在 | 无 Flash/Highlight |
| 过渡动画 | ❌ | 不存在 | 无 Tween/Transition |

**矛盾发现**: FloatingTextSystem 和 ParticleSystem 功能完善（分别 574 行和 700 行），但在实际游戏中的**使用极其有限**——仅在购买建筑和阶段解锁时触发飘字，粒子系统几乎未被调用。

---

## E. CanvasUIRenderer 工具类审计

**文件**: `CanvasUIRenderer.ts`（640行）

这是一个**纯静态工具类**，提供 10 个绘制方法：

| 方法 | 功能 | 实际被调用 |
|------|------|-----------|
| `roundRect` | 圆角矩形路径 | ❌ 游戏使用本地 `rr()` 函数 |
| `drawResourcePanel` | 资源面板 | ❌ 未被任何游戏使用 |
| `drawBuildingList` | 建筑列表 | ❌ 未被任何游戏使用 |
| `drawFloatingTexts` | 飘字效果 | ❌ FloatingTextSystem 自带 render |
| `drawBadge` | 徽章 | ❌ 未使用 |
| `drawBottomHint` | 底部提示 | ❌ 未使用 |
| `drawTitle` | 标题 | ❌ 未使用 |
| `drawGradientBg` | 渐变背景 | ❌ 未使用 |
| `drawProgressBar` | 进度条 | ❌ 未使用 |
| `drawPanel` | 面板背景 | ❌ 未使用 |

**关键问题**: CanvasUIRenderer 是一个**完全未被使用的死代码**。每个游戏引擎都自己重新实现了 `rr()`、`drawBg()`、`drawHeader()` 等渲染方法，没有复用这个工具类。

---

## F. 架构层面问题

### F1. 代码重复

| 重复代码 | 出现次数 | 位置 |
|---------|---------|------|
| `rr()` 圆角矩形函数 | 至少 2 次 | ThreeKingdomsEngine, CivChinaEngine |
| `fmt()` 数字格式化函数 | 至少 2 次 | 同上 |
| `drawBg/drawHeader/drawResBar/drawBuildings/drawPrestige/drawTech/drawFooter` | 完全重复 | 同上 |
| `COLOR_THEME` 类型定义 | 2 次 | 各 constants.ts |

**估计**: 每新增一个放置游戏，需要复制粘贴约 300 行渲染代码。

### F2. 渲染与逻辑耦合

当前架构中，游戏引擎类**同时负责**：
1. 游戏逻辑（资源计算、建筑购买、战斗结算）
2. 渲染输出（Canvas 绘制、布局计算）
3. 输入处理（键盘映射）

这违反了关注点分离原则，导致：
- 无法独立测试渲染逻辑
- 无法替换渲染方案（如从 Canvas 切换到 DOM/WebGL）
- 每个游戏都要重写渲染代码

### F3. 缺失的中间层

```
当前架构:
  GameEngine (Canvas + Loop)
    └── IdleGameEngine (Resources + Upgrades + Save)
          └── ThreeKingdomsEngine (Logic + Render + Input 全部混在一起)

理想架构:
  GameEngine (Canvas + Loop)
    └── IdleGameEngine (Resources + Upgrades + Save)
          └── ThreeKingdomsGameLogic (纯逻辑)
          └── IdleGameRenderer (通用渲染)
                └── ThreeKingdomsTheme (主题配置)
          └── IdleGameInputHandler (通用交互)
```

---

## G. 缺失功能完整清单

### G1. 渲染层缺失（优先级 P0）

| # | 缺失功能 | 影响 | 工作量估计 |
|---|---------|------|-----------|
| 1 | **鼠标/触摸点击交互** | 移动端完全不可用 | 3-5天 |
| 2 | **通用渲染框架**（复用而非每个游戏重写） | 可维护性 | 5-7天 |
| 3 | **场景/面板管理器**（带过渡动画） | 用户体验 | 3-5天 |
| 4 | **弹窗/对话框系统** | 基本交互 | 2-3天 |
| 5 | **DPR 高清适配** | 高分屏显示 | 1天 |

### G2. 视觉表现缺失（优先级 P1）

| # | 缺失功能 | 影响 | 工作量估计 |
|---|---------|------|-----------|
| 6 | **图片资源加载管线** | 无法使用任何美术资源 | 3-5天 |
| 7 | **精灵图渲染 + 动画帧** | 无动画能力 | 5-7天 |
| 8 | **地图渲染引擎**（瓦片/节点图） | 领土/世界地图 | 7-10天 |
| 9 | **建筑可视化升级**（外观变化） | 建筑系统深度 | 3-5天 |
| 10 | **战斗场景渲染** | 战斗系统深度 | 7-10天 |
| 11 | **UI 过渡动画系统** | 视觉流畅度 | 3-5天 |

### G3. 游戏深度缺失（优先级 P2）

| # | 缺失功能 | 影响 | 工作量估计 |
|---|---------|------|-----------|
| 12 | **剧情/事件系统** | 游戏沉浸感 | 5-7天 |
| 13 | **武将立绘/详情页** | 角色系统深度 | 3-5天 |
| 14 | **技能特效渲染** | 战斗视觉 | 5-7天 |
| 15 | **成就/任务 UI** | 玩家目标感 | 2-3天 |
| 16 | **设置面板** | 用户体验 | 1-2天 |

---

## H. 子系统模块完整度矩阵

| 模块 | 文件 | 行数 | 数据层 | 渲染层 | 交互层 |
|------|------|------|--------|--------|--------|
| BuildingSystem | BuildingSystem.ts | 617 | ✅ 完善 | ❌ 列表文字 | ❌ 仅键盘 |
| PrestigeSystem | PrestigeSystem.ts | ~300 | ✅ 完善 | ⚠️ 简单面板 | ❌ 仅键盘 |
| UnitSystem | UnitSystem.ts | 631 | ✅ 完善 | ❌ 列表文字 | ❌ 仅键盘 |
| StageSystem | StageSystem.ts | 520 | ✅ 完善 | ⚠️ 标题文字 | ❌ 自动 |
| BattleSystem | BattleSystem.ts | 297 | ✅ 完善 | ❌ 列表+进度条 | ❌ 自动 |
| TechTreeSystem | TechTreeSystem.ts | ~400 | ✅ 完善 | ❌ 列表文字 | ❌ 仅键盘 |
| TerritorySystem | TerritorySystem.ts | 225 | ✅ 完善 | ❌ 列表文字 | ❌ 仅键盘 |
| FloatingTextSystem | FloatingTextSystem.ts | 574 | ✅ 完善 | ✅ 自带渲染 | N/A |
| ParticleSystem | ParticleSystem.ts | 700 | ✅ 完善 | ✅ 自带渲染 | N/A |
| StatisticsTracker | StatisticsTracker.ts | ~300 | ✅ 完善 | ❌ 无 UI | N/A |
| UnlockChecker | UnlockChecker.ts | ~200 | ✅ 完善 | N/A | N/A |
| InputHandler | InputHandler.ts | ~300 | ✅ 完善 | N/A | ⚠️ 仅键盘 |
| CanvasUIRenderer | CanvasUIRenderer.ts | 640 | N/A | ⚠️ 未使用 | N/A |
| SeasonSystem | SeasonSystem.ts | ~300 | ✅ 完善 | ❌ 无渲染 | N/A |
| CraftingSystem | CraftingSystem.ts | ~400 | ✅ 完善 | ❌ 无渲染 | N/A |
| ExpeditionSystem | ExpeditionSystem.ts | ~400 | ✅ 完善 | ❌ 无渲染 | N/A |
| CharacterLevelSystem | CharacterLevelSystem.ts | ~200 | ✅ 完善 | ❌ 无渲染 | N/A |
| EquipmentSystem | EquipmentSystem.ts | ~300 | ✅ 完善 | ❌ 无渲染 | N/A |
| DeitySystem | DeitySystem.ts | ~200 | ✅ 完善 | ❌ 无渲染 | N/A |

---

## I. 核心结论与建议

### 现状总结

```
┌─────────────────────────────────────────────────┐
│              放置游戏引擎能力图谱                  │
│                                                   │
│  数据逻辑层  ████████████████████░░░░  85%        │
│  渲染能力    ██░░░░░░░░░░░░░░░░░░░░░░  10%        │
│  交互能力    █░░░░░░░░░░░░░░░░░░░░░░░░   5%        │
│  视觉表现    █░░░░░░░░░░░░░░░░░░░░░░░░   5%        │
│  资源管线    ░░░░░░░░░░░░░░░░░░░░░░░░░   0%        │
│                                                   │
│  → "后端完善，前端原始" 的典型状态                  │
└─────────────────────────────────────────────────┘
```

### 建议路线图

**Phase 1 — 基础交互（2周）**
1. 实现鼠标/触摸点击检测 → 映射到 UI 元素
2. 统一渲染框架，消除代码重复
3. DPR 适配

**Phase 2 — 视觉升级（3周）**
4. 图片资源加载管线（Image 预加载 + 缓存）
5. 精灵图渲染 + 简单动画帧
6. 地图渲染引擎（利用已有 position 数据）
7. UI 过渡动画

**Phase 3 — 游戏深度（3周）**
8. 战斗场景渲染
9. 弹窗/详情面板系统
10. 建筑可视化升级
11. 剧情/事件系统

**Phase 4 — 打磨（2周）**
12. 美术资源制作/集成
13. 音效系统
14. 性能优化
15. 移动端适配测试

---

> **报告结束** — 本审计基于对以下文件的完整阅读：  
> `GameEngine.ts` (173行) · `IdleGameEngine.ts` (310行) · `CanvasUIRenderer.ts` (640行) ·  
> `BattleSystem.ts` (297行) · `TerritorySystem.ts` (225行) · `InputHandler.ts` (~300行) ·  
> `ParticleSystem.ts` (700行) · `FloatingTextSystem.ts` (574行) · `BuildingSystem.ts` (617行) ·  
> `ThreeKingdomsEngine.ts` (657行) · `CivChinaEngine.ts` (565行) ·  
> `three-kingdoms/constants.ts` (600行) · `GameContainer.tsx` (部分) · `IdleGamePage.tsx` (213行)
