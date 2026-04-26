# 武将系统视觉设计规范

> **文档版本**: v1.0  
> **创建日期**: 2025-07  
> **设计主题**: 水墨江山·铜纹霸业  
> **设计分辨率**: PC 1280×800 / 手机 375×667  
> **评分基线**: R1 视觉 2.5/10 → R4 视觉 3.5/10，本规范目标 ≥7.0/10

---

## 设计原则

### 核心理念

1. **静态优先，动效克制**：所有视觉传达以静态色彩、排版、空间层次为主，动效仅用于结构化反馈（展开/收起/翻转），禁止装饰性动画
2. **信息密度适中**：放置游戏玩家需要快速扫描数据，避免视觉噪音干扰决策
3. **古风不等于花哨**：水墨铜纹风格通过色彩质感和排版留白体现，而非闪烁特效
4. **双端一致性**：PC 和手机端共享配色/字体/组件语义，仅布局结构不同

### 禁止事项清单

| 禁止项 | 原因 | 替代方案 |
|--------|------|---------|
| 闪烁/脉冲动画 | 干扰视觉，引发不适 | 静态高亮边框 |
| 渐变色动画（color/backgroundColor 过渡） | R16审计确认：明暗变化效果被用户反感 | opacity/transform 过渡 |
| 背景色自动切换 | 视觉跳动，影响阅读 | 固定背景色 |
| 品质边框流光动画 | 性能浪费+视觉干扰 | 静态渐变边框（CSS gradient） |
| 多层叠加阴影 | 层次混乱 | 单层固定阴影 |
| 未使用CSS变量的硬编码颜色 | R16审计：100+ 处硬编码导致无法全局换肤 | 统一使用 `var(--tk-*)` |

---

## 一、配色方案

### 1.1 武将系统专用色板

基于项目全局 CSS 变量（定义于 `ThreeKingdomsGame.css` :root），武将系统新增以下专用变量：

```css
:root {
  /* ═══ 武将系统专用色 ═══ */

  /* 主色调 — 继承全局 */
  --hero-primary: var(--tk-gold);           /* #C9A84C 古铜金 — 按钮/高亮/选中态 */
  --hero-primary-light: var(--tk-gold-light); /* #E8D48B 亮金 — 悬停态 */
  --hero-primary-dark: var(--tk-gold-dark);   /* #8B6914 暗金 — 按压态 */

  /* 背景色 — 继承全局 */
  --hero-bg: var(--tk-bg);                  /* #1A1A2E 墨黑 — 主背景 */
  --hero-bg-dark: var(--tk-bg-dark);        /* #0d0a06 深墨 — 次级背景 */
  --hero-panel-bg: var(--tk-panel-bg);      /* rgba(26,35,50,0.95) — 面板背景 */
  --hero-card-bg: var(--tk-card-bg);        /* rgba(26,35,50,0.85) — 卡片背景 */
  --hero-surface: #F5F0E8;                 /* 宣纸白 — 仅用于品质标签底色 */

  /* 文字色 — 继承全局 */
  --hero-text: var(--tk-text-primary);      /* #F0E6D3 暖白 — 正文 */
  --hero-text-secondary: var(--tk-text-secondary); /* #A0A0A0 灰色 — 次要文字 */
  --hero-text-muted: var(--tk-text-muted);  /* #666 暗灰 — 禁用/提示 */

  /* 品质色 — 统一三套混用体系（解决 R16-A04） */
  --hero-quality-common: #9CA3AF;           /* 灰色 — 普通 */
  --hero-quality-fine: #10B981;             /* 翠绿 — 精良 */
  --hero-quality-rare: #3B82F6;             /* 宝蓝 — 稀有 */
  --hero-quality-epic: #8B5CF6;             /* 帝紫 — 史诗 */
  --hero-quality-legendary: #F59E0B;        /* 赤金 — 传说 */

  /* 状态色 */
  --hero-danger: var(--tk-danger);          /* #e74c3c 红色 — 不足/错误 */
  --hero-success: var(--tk-success);        /* #27ae60 绿色 — 成功/提升 */
  --hero-warning: var(--tk-orange);         /* #D4A017 橙色 — 警告/即将过期 */

  /* 禁用态 */
  --hero-disabled: var(--tk-disabled);      /* #4a4a5a — 禁用按钮/不可操作 */
}
```

### 1.2 品质色对照表

> **关键约束**：解决 R16 审计 A-04 问题。品质色必须统一，禁止 `EquipmentPanel`、`ArmyTab`、`HeroCard.css` 三套不同色系混用。

| 品质 | 英文枚举 | 色值 | CSS 变量 | 用途 |
|:----:|:--------:|:----:|:--------:|------|
| 普通 | COMMON | `#9CA3AF` | `--hero-quality-common` | 边框、品质标签底色 |
| 精良 | FINE | `#10B981` | `--hero-quality-fine` | 边框、品质标签底色 |
| 稀有 | RARE | `#3B82F6` | `--hero-quality-rare` | 边框、品质标签底色 |
| 史诗 | EPIC | `#8B5CF6` | `--hero-quality-epic` | 边框、品质标签底色 |
| 传说 | LEGENDARY | `#F59E0B` | `--hero-quality-legendary` | 边框、品质标签底色 |

**品质色使用规则**：
- 边框：`border: 3px solid var(--hero-quality-{quality})`
- 标签底色：品质色 + 20% 透明度背景 `rgba(R,G,B,0.2)`
- 文字：品质色直接用于品质名称文字
- 禁止：品质色不用于大面积背景填充（避免视觉过重）

### 1.3 阵营色

| 阵营 | 色值 | CSS 变量 | 标识 |
|:----:|:----:|:--------:|:----:|
| 蜀 | `#DC2626` | `--hero-faction-shu` | 🔴 |
| 魏 | `#2563EB` | `--hero-faction-wei` | 🔵 |
| 吴 | `#16A34A` | `--hero-faction-wu` | 🟢 |
| 群 | `#9333EA` | `--hero-faction-qun` | 🟣 |

---

## 二、武将卡片设计

### 2.1 卡片尺寸

| 模式 | 尺寸 | 用途 |
|:----:|:----:|------|
| 列表模式 | 120 × 160 px | 武将列表网格、编队选择 |
| 详情模式 | 240 × 320 px | 武将详情面板左侧立绘区 |
| 招募结果 | 180 × 240 px | 招贤馆抽卡结果展示 |

### 2.2 卡片结构（列表模式 120×160）

```
┌─────────────────────────┐
│  ┌───────────────────┐  │  ← 品质边框 3px（品质色）
│  │                   │  │
│  │    武将头像        │  │  ← 头像区 96×96px，居中
│  │    占位图          │  │     背景：#2A2A3E
│  │                   │  │
│  └───────────────────┘  │
│                         │
│  刘备                   │  ← 名称 14px bold，--hero-text
│  🔴蜀 · Lv.25          │  ← 阵营色标+等级 12px，--hero-text-secondary
│  ★★★★☆                 │  ← 星级 12px，金色实心/空心
│  战力 680               │  ← 战力 12px，--hero-primary
│                         │
│  [精良]                 │  ← 品质标签 10px，品质色底+品质色文字
└─────────────────────────┘
```

**CSS 规范**：

```css
.hero-card {
  width: 120px;
  height: 160px;
  background: var(--hero-card-bg);
  border: 3px solid var(--hero-quality-common); /* 默认普通，JS动态设置 */
  border-radius: var(--tk-radius-lg);            /* 8px */
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  padding: var(--tk-gap-sm);                     /* 8px */
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
  transition: transform 0.15s var(--tk-ease-out); /* 仅 transform */
}

.hero-card:hover {
  transform: translateY(-2px);                   /* 轻微上浮 */
}

/* 品质边框 — 静态，禁止动画 */
.hero-card--common    { border-color: var(--hero-quality-common); }
.hero-card--fine      { border-color: var(--hero-quality-fine); }
.hero-card--rare      { border-color: var(--hero-quality-rare); }
.hero-card--epic      { border-color: var(--hero-quality-epic); }
.hero-card--legendary { border-color: var(--hero-quality-legendary); }
```

### 2.3 星级显示

- 字符：实心星 `★`（已激活）+ 空心星 `☆`（未激活）
- 颜色：`var(--hero-primary)` 即 `#C9A84C` 古铜金
- 字号：12px
- 最大星级：5 星
- 示例：3 星显示为 `★★★☆☆`

```css
.hero-star--active    { color: var(--hero-primary); }     /* ★ */
.hero-star--inactive  { color: var(--hero-text-muted); }  /* ☆ */
```

### 2.4 品质标签

```css
.hero-quality-tag {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: var(--tk-radius-sm);  /* 4px */
  font-weight: 600;
  /* 品质色文字 + 20%透明度底色 */
}

.hero-quality-tag--common {
  color: var(--hero-quality-common);
  background: rgba(156, 163, 175, 0.2);
}
.hero-quality-tag--fine {
  color: var(--hero-quality-fine);
  background: rgba(16, 185, 129, 0.2);
}
.hero-quality-tag--rare {
  color: var(--hero-quality-rare);
  background: rgba(59, 130, 246, 0.2);
}
.hero-quality-tag--epic {
  color: var(--hero-quality-epic);
  background: rgba(139, 92, 246, 0.2);
}
.hero-quality-tag--legendary {
  color: var(--hero-quality-legendary);
  background: rgba(245, 158, 11, 0.2);
}
```

### 2.5 品质边框视觉层次

> **核心原则**：仅用静态 CSS，禁止闪烁/脉冲/流光动画。

| 品质 | 边框样式 | 视觉效果 |
|:----:|---------|---------|
| COMMON | 3px solid #9CA3AF | 纯色边框，无额外效果 |
| FINE | 3px solid #10B981 | 纯色边框 + 内部 1px rgba(16,185,129,0.1) 微光（box-shadow inset） |
| RARE | 3px solid #3B82F6 + box-shadow: 0 0 6px rgba(59,130,246,0.3) | 静态蓝色外发光 |
| EPIC | 3px solid #8B5CF6 + box-shadow: 0 0 8px rgba(139,92,246,0.35) | 静态紫色外发光 |
| LEGENDARY | 3px solid #F59E0B + box-shadow: 0 0 12px rgba(245,158,11,0.4) | 静态金色外发光 |

```css
/* 品质发光效果 — 全部静态，零动画 */
.hero-card--rare {
  border-color: var(--hero-quality-rare);
  box-shadow: 0 2px 8px rgba(0,0,0,0.15), 0 0 6px rgba(59,130,246,0.3);
}
.hero-card--epic {
  border-color: var(--hero-quality-epic);
  box-shadow: 0 2px 8px rgba(0,0,0,0.15), 0 0 8px rgba(139,92,246,0.35);
}
.hero-card--legendary {
  border-color: var(--hero-quality-legendary);
  box-shadow: 0 2px 8px rgba(0,0,0,0.15), 0 0 12px rgba(245,158,11,0.4);
}
```

### 2.6 红点提示

- 位置：卡片右上角，偏移 `top: -4px; right: -4px`
- 尺寸：8×8px 圆形
- 颜色：`var(--hero-danger)` 即 `#e74c3c`
- 触发条件：材料足够升级 / 有新碎片可合成 / 有可领取奖励
- 禁止：红点脉冲动画

```css
.hero-card__red-dot {
  position: absolute;
  top: -4px;
  right: -4px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--hero-danger);
  border: 1px solid var(--hero-bg);
}
```

---

## 三、武将详情面板

### 3.1 面板布局

**PC 端（1280×800）**：

```
┌────────────────────────────────────────────────────────────────────┐
│  ← 返回                                            武将详情       │
├─────────────────────┬──────────────────────────────────────────────┤
│                     │                                              │
│   武将立绘区         │   信息区                                     │
│   300 × 400 px      │                                              │
│                     │   ┌─ 基础信息 ──────────────────────────┐   │
│   ┌───────────┐     │   │ 刘备  [精良]  Lv.25  ★★★★☆        │   │
│   │           │     │   │ 蜀 · 步兵 · 战力 680                 │   │
│   │  武将     │     │   └─────────────────────────────────────┘   │
│   │  立绘     │     │                                              │
│   │  占位     │     │   ┌─ 属性条 ────────────────────────────┐   │
│   │           │     │   │ 攻击  ████████░░  128 / 200         │   │
│   │           │     │   │ 防御  ██████░░░░   96 / 200         │   │
│   │           │     │   │ 生命  █████████░  456 / 500         │   │
│   └───────────┘     │   │ 速度  ████░░░░░░   64 / 200         │   │
│                     │   └─────────────────────────────────────┘   │
│                     │                                              │
│                     │   ┌─ 技能列表 ───────────────────────────┐   │
│                     │   │ ⚔ 主动：仁德无双 — 对敌方造成...      │   │
│                     │   │ 🛡 被动：蜀汉之主 — 提升全队...       │   │
│                     │   └─────────────────────────────────────┘   │
│                     │                                              │
│                     │   ┌─ 装备槽 ────────────────────────────┐   │
│                     │   │ [武器] [防具] [饰品] [坐骑]          │   │
│                     │   └─────────────────────────────────────┘   │
│                     │                                              │
│                     │   ┌─ 操作按钮 ──────────────────────────┐   │
│                     │   │ [升级] [升星] [突破] [派驻]          │   │
│                     │   └─────────────────────────────────────┘   │
│                     │                                              │
└─────────────────────┴──────────────────────────────────────────────┘
```

**手机端（375×667）**：

```
┌────────────────────────────┐
│  ← 返回         武将详情    │
├────────────────────────────┤
│   武将立绘区（200×267px）   │
│   ┌──────────────────┐     │
│   │   武将立绘占位     │     │
│   └──────────────────┘     │
│                            │
│   刘备 [精良] Lv.25        │
│   蜀 · 步兵 · ★★★★☆       │
│   战力 680                 │
│                            │
├────────────────────────────┤
│   属性条（折叠/展开）       │
│   攻击 128  ████████░░     │
│   防御  96  ██████░░░░     │
│   生命 456  █████████░     │
│   速度  64  ████░░░░░░     │
├────────────────────────────┤
│   技能（折叠/展开）         │
│   ⚔ 仁德无双               │
│   🛡 蜀汉之主               │
├────────────────────────────┤
│   装备                     │
│   [武器] [防具] [饰品] [坐骑]│
├────────────────────────────┤
│   [升级] [升星] [突破] [派驻]│
└────────────────────────────┘
```

### 3.2 基础信息区

| 元素 | 字号 | 字重 | 颜色 | 对齐 |
|------|:----:|:----:|:----:|:----:|
| 武将名 | 18px | bold | `--hero-text` | 左 |
| 品质标签 | 12px | 600 | 品质色 | 武将名右侧 |
| 等级 | 14px | normal | `--hero-text-secondary` | 品质标签右侧 |
| 星级 | 14px | normal | `--hero-primary` | 等级右侧 |
| 阵营·职业 | 12px | normal | `--hero-text-secondary` | 第二行 |
| 战力 | 16px | bold | `--hero-primary` | 右对齐 |

### 3.3 属性条设计

```
攻击  ████████░░░░  128
      └── 进度填充 ──┘  └─ 数值

进度条结构：
┌──────────────────────────────────────────────┐
│  ████████████████░░░░░░░░░░░░░░░░░░░░░░░░░  │
│  └── 已填充（品质色 60% 透明度）──┘            │
└──────────────────────────────────────────────┘
```

**CSS 规范**：

```css
.hero-attr-bar {
  display: flex;
  align-items: center;
  gap: var(--tk-gap-sm);   /* 8px */
  margin-bottom: var(--tk-gap-sm);
}

.hero-attr-bar__label {
  width: 36px;
  font-size: 12px;
  color: var(--hero-text-secondary);
  flex-shrink: 0;
}

.hero-attr-bar__track {
  flex: 1;
  height: 6px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: var(--tk-radius-full);  /* 9999px */
  overflow: hidden;
}

.hero-attr-bar__fill {
  height: 100%;
  border-radius: var(--tk-radius-full);
  /* 颜色由 JS 根据属性类型动态设置 */
  transition: width 0.3s var(--tk-ease-out);  /* 仅 width 过渡 */
}

.hero-attr-bar__value {
  width: 40px;
  font-size: 12px;
  font-family: var(--tk-font-num);
  color: var(--hero-text);
  text-align: right;
  flex-shrink: 0;
}
```

**属性条颜色映射**：

| 属性 | 填充色 | CSS |
|:----:|:------:|:----|
| 攻击 | `#EF4444` | `rgba(239,68,68,0.6)` |
| 防御 | `#3B82F6` | `rgba(59,130,246,0.6)` |
| 生命 | `#22C55E` | `rgba(34,197,94,0.6)` |
| 速度 | `#F59E0B` | `rgba(245,158,11,0.6)` |

### 3.4 技能列表

```
┌──────────────────────────────────────────────┐
│  ⚔ 仁德无双                      [主动]      │
│  对敌方全体造成 120% 攻击力的伤害，           │
│  并恢复己方生命值最低单位 15% 最大生命值。     │
│                                               │
│  🛡 蜀汉之主                      [被动]      │
│  己方蜀阵营武将攻击力 +10%，防御力 +8%。      │
└──────────────────────────────────────────────┘
```

- 技能图标：24×24px，品质色圆形背景
- 技能名称：14px bold，`--hero-text`
- 技能类型标签：10px，`--hero-text-secondary`
- 技能描述：12px，`--hero-text-secondary`，行高 1.5
- 技能间距：12px

### 3.5 装备槽

```
┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
│  ⚔️     │ │  🛡️     │ │  💍     │ │  🐴     │
│  武器   │ │  防具   │ │  饰品   │ │  坐骑   │
│ [已装备]│ │  空     │ │  空     │ │ [已装备]│
└────────┘ └────────┘ └────────┘ └────────┘
```

**装备槽 CSS**：

```css
.hero-equip-slot {
  width: 60px;
  height: 72px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px dashed rgba(255, 255, 255, 0.15);
  border-radius: var(--tk-radius-lg);   /* 8px */
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  cursor: pointer;
  transition: border-color 0.15s;       /* 仅边框颜色过渡 */
}

.hero-equip-slot--filled {
  border-style: solid;
  border-color: var(--hero-primary);
  background: rgba(201, 168, 76, 0.08);
}

.hero-equip-slot:hover {
  border-color: var(--hero-primary-light);
}
```

### 3.6 操作按钮

| 按钮 | 背景色 | 文字色 | 禁用条件 |
|------|:------:|:------:|---------|
| 升级 | `--hero-primary` | `#1A1A2E` | 经验不足 / 等级达上限 |
| 升星 | `--hero-quality-fine` | `#FFFFFF` | 碎片不足 / 已满星 |
| 突破 | `--hero-quality-epic` | `#FFFFFF` | 未达到突破等级 / 材料不足 |
| 派驻 | `--hero-quality-rare` | `#FFFFFF` | 已在编队中 / 无可派驻位置 |

**按钮通用规范**：

```css
.hero-action-btn {
  min-width: 64px;
  height: 36px;
  border-radius: var(--tk-radius-md);   /* 6px */
  font-size: 13px;
  font-weight: 600;
  border: none;
  cursor: pointer;
  padding: 0 16px;
  transition: opacity 0.15s, transform 0.1s;  /* 仅 opacity + transform */
}

.hero-action-btn:active {
  transform: scale(0.96);               /* 按压缩小反馈 */
}

.hero-action-btn:disabled {
  background: var(--hero-disabled);
  color: var(--hero-text-muted);
  cursor: not-allowed;
  opacity: 0.6;
}
```

---

## 四、招贤馆 UI 设计

### 4.1 招贤馆主界面

**PC 端（1280×800）**：

```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│              招  贤  馆                                          │
│              招贤令余额：128                                     │
│                                                                  │
├──────────────────────────────┬───────────────────────────────────┤
│                              │                                   │
│   ┌─ 招募区 ─────────────┐  │   ┌─ 当前卡池预览 ─────────────┐  │
│   │                      │  │   │                             │  │
│   │  [普通招募]  5 令     │  │   │  武将头像  武将头像  武将头像│  │
│   │  [高级招募]  100 令   │  │   │  关羽 3%   张飞 3%  赵云 3% │  │
│   │                      │  │   │  ...                        │  │
│   │  [免费招募] 23:59:48  │  │   │  概率公示 >                 │  │
│   │  （倒计时显示）       │  │   │                             │  │
│   │                      │  │   └─────────────────────────────┘  │
│   └──────────────────────┘  │                                   │
│                              │   ┌─ 最近招募记录 ─────────────┐  │
│                              │   │  1. [精良] 张辽             │  │
│                              │   │  2. [普通] 小兵             │  │
│                              │   │  3. [稀有] 周瑜 ★          │  │
│                              │   │  ...（最近10条）            │  │
│                              │   └─────────────────────────────┘  │
│                              │                                   │
└──────────────────────────────┴───────────────────────────────────┘
```

**手机端（375×667）**：

```
┌────────────────────────────┐
│  招贤馆      招贤令：128    │
├────────────────────────────┤
│                            │
│  [普通招募 5令] [高级招募]  │
│  [免费招募 23:59:48]       │
│                            │
├────────────────────────────┤
│  当前卡池（横向滚动）       │
│  [关羽] [张飞] [赵云] ...  │
│  概率公示 >                 │
├────────────────────────────┤
│  最近记录                   │
│  1. [精良] 张辽             │
│  2. [普通] 小兵             │
│  3. [稀有] 周瑜 ★          │
└────────────────────────────┘
```

### 4.2 招募按钮设计

| 按钮 | 尺寸 | 背景 | 文字 | 特殊 |
|------|:----:|:----:|:----:|------|
| 普通招募 | 160×44px | `--hero-primary` 渐变 | 深色 | 消耗：5 铜钱 |
| 高级招募 | 160×44px | `--hero-quality-epic` 渐变 | 白色 | 消耗：1 招贤令 |
| 免费招募 | 160×44px | `--hero-success` 渐变 | 白色 | 倒计时 / 可用态 |

**免费招募倒计时**：
- 可用态：按钮正常显示"免费招募"，绿色背景
- 冷却态：按钮灰色（`--hero-disabled`），显示倒计时 `HH:MM:SS`
- 字体：`var(--tk-font-num)` 等宽数字字体

### 4.3 招募结果展示

**卡牌翻转动画**：

```css
/* 招募结果卡牌翻转 — 唯一允许的动画效果 */
.recruit-result-card {
  width: 180px;
  height: 240px;
  perspective: 800px;
}

.recruit-result-card__inner {
  position: relative;
  width: 100%;
  height: 100%;
  transition: transform 0.3s var(--tk-ease-out);
  transform-style: preserve-3d;
}

.recruit-result-card--flipped .recruit-result-card__inner {
  transform: rotateY(180deg);
}

.recruit-result-card__front,
.recruit-result-card__back {
  position: absolute;
  width: 100%;
  height: 100%;
  backface-visibility: hidden;
  border-radius: var(--tk-radius-lg);
}

.recruit-result-card__front {
  /* 卡牌背面 — 统一古铜金花纹 */
  background: linear-gradient(135deg, #8B6914, #C9A84C);
  display: flex;
  align-items: center;
  justify-content: center;
}

.recruit-result-card__back {
  transform: rotateY(180deg);
  /* 卡牌正面 — 武将信息 */
  background: var(--hero-card-bg);
  border: 3px solid var(--hero-quality-common); /* JS 动态设置品质色 */
}
```

**动画约束**：
- 翻转时长：0.3 秒（不超过）
- 缓动：`var(--tk-ease-out)`
- 禁止：翻转后的闪烁、光效、粒子
- 禁止：背景色渐变过渡

---

## 五、编队界面设计

### 5.1 阵型布局

**六宫格阵型（前后排各3格）**：

```
        ┌─── 前排 ───────────────────┐
        │                            │
        │  ┌──────┐ ┌──────┐ ┌──────┐ │
        │  │ 位置1 │ │ 位置2 │ │ 位置3 │ │
        │  │ 前排  │ │ 前排  │ │ 前排  │ │
        │  └──────┘ └──────┘ └──────┘ │
        │                            │
        ├─── 后排 ───────────────────┤
        │                            │
        │  ┌──────┐ ┌──────┐ ┌──────┐ │
        │  │ 位置4 │ │ 位置5 │ │ 位置6 │ │
        │  │ 后排  │ │ 后排  │ │ 后排  │ │
        │  └──────┘ └──────┘ └──────┘ │
        │                            │
        └────────────────────────────┘
```

**阵位 CSS**：

```css
.formation-slot {
  width: 80px;
  height: 96px;
  background: rgba(255, 255, 255, 0.04);
  border: 2px dashed rgba(255, 255, 255, 0.15);
  border-radius: var(--tk-radius-lg);   /* 8px */
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  transition: border-color 0.15s, background 0.15s;
}

/* 拖拽悬停高亮 */
.formation-slot--drag-over {
  border-color: var(--hero-primary);
  border-style: solid;
  background: rgba(201, 168, 76, 0.1);
}

/* 已占用 */
.formation-slot--filled {
  border-style: solid;
  border-color: rgba(255, 255, 255, 0.2);
  background: var(--hero-card-bg);
}
```

### 5.2 武将拖拽

- 拖拽开始：武将卡片 opacity 降至 0.5，原位保留占位
- 拖拽中：跟随光标移动，目标阵位高亮（金色边框 + 半透明底色）
- 拖拽放下：武将卡牌出现在阵位中（0.15s transform 过渡）
- 拖拽取消：武将卡片回到原位（0.15s transform 过渡）
- 禁止：拖拽过程中的缩放/旋转特效

### 5.3 羁绊显示

```
┌─ 已激活羁绊 ─────────────────────────────────────────────┐
│                                                            │
│  🔗 桃园结义（刘备+关羽+张飞）                              │
│     全体攻击力 +15%，生命值 +10%                            │
│                                                            │
│  🔗 蜀汉核心（刘备+诸葛亮）                                 │
│     蜀阵营武将防御力 +12%                                   │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

- 羁绊图标：20×20px
- 羁绊名称：14px bold，`--hero-primary`
- 羁绊成员：12px，`--hero-text-secondary`
- 属性加成：12px，`--hero-success`
- 羁绊间距：12px
- 未激活羁绊：整体 opacity 0.4，灰色显示

### 5.4 战力预览

```
┌──────────────────────────────────┐
│  编队总战力                       │
│  ██████████████████  4,280       │
│  ↑ +320（较上次编队）             │
└──────────────────────────────────┘
```

- 战力数值：24px bold，`var(--tk-font-num)`，`--hero-primary`
- 变化值：14px，`--hero-success`（提升）/ `--hero-danger`（下降）
- 位置：编队界面顶部右侧

---

## 六、通用 UI 规范

### 6.1 字体

| 用途 | 字号 | 字重 | 字体族 | 颜色 |
|------|:----:|:----:|:------:|:----:|
| 面板标题 | 16px | bold | `--tk-font-title` | `--hero-text` |
| 正文 | 14px | normal | `--tk-font-body` | `--hero-text` |
| 辅助文字 | 12px | normal | `--tk-font-body` | `--hero-text-secondary` |
| 数值/战力 | 14px+ | bold | `--tk-font-num` | `--hero-primary` |
| 小标签 | 10px | 600 | `--tk-font-body` | 品质色/状态色 |

### 6.2 间距

| 场景 | 间距值 | CSS 变量 |
|------|:------:|:--------:|
| 组件之间 | 12px | `var(--tk-gap-sm)` + 4px |
| 元素之间 | 8px | `var(--tk-gap-sm)` |
| 内边距（卡片） | 8px | `var(--tk-gap-sm)` |
| 内边距（面板） | 16px | `var(--tk-gap-md)` |
| 区块分隔 | 24px | `var(--tk-gap-lg)` |

### 6.3 圆角

| 元素 | 圆角 | CSS 变量 |
|------|:----:|:--------:|
| 卡片 | 8px | `var(--tk-radius-lg)` |
| 按钮 | 6px | `var(--tk-radius-md)` |
| 面板 | 12px | `var(--tk-radius-xl)` |
| 标签 | 4px | `var(--tk-radius-sm)` |
| 头像 | 50% | `var(--tk-radius-full)` |

### 6.4 阴影

```css
/* 卡片阴影 — 统一，禁止多层叠加 */
--hero-shadow-card: 0 2px 8px rgba(0, 0, 0, 0.15);

/* 面板阴影 */
--hero-shadow-panel: 0 4px 16px rgba(0, 0, 0, 0.25);

/* 弹窗阴影 */
--hero-shadow-modal: 0 8px 32px rgba(0, 0, 0, 0.4);
```

### 6.5 过渡与动画

**允许的过渡属性**：

| 属性 | 时长 | 缓动 | 场景 |
|------|:----:|:----:|------|
| `opacity` | 0.15s | `--tk-ease-out` | 淡入淡出 |
| `transform` | 0.15s | `--tk-ease-out` | 位移/缩放 |
| `width`（进度条） | 0.3s | `--tk-ease-out` | 属性条填充 |
| `border-color` | 0.15s | linear | 状态切换 |

**禁止的过渡属性**：

| 属性 | 原因 |
|------|------|
| `color` | 文字颜色渐变造成闪烁感 |
| `background-color` | 背景色变化干扰阅读（R16用户反馈） |
| `background`（渐变） | 渐变动画性能差且视觉干扰 |
| `box-shadow`（动画） | 阴影闪烁引发不适 |

**过渡写法规范**：

```css
/* ✅ 正确 — 明确列出允许的属性 */
.hero-card {
  transition: transform 0.15s var(--tk-ease-out),
              opacity 0.15s var(--tk-ease-out);
}

/* ❌ 错误 — 禁止 all */
.hero-card {
  transition: all 0.3s;  /* 会包含 color/background-color */
}
```

### 6.6 响应式断点

| 断点 | 布局 | 说明 |
|:----:|:----:|------|
| > 1024px | PC 布局 | 双栏（立绘+信息）、4列卡片网格 |
| 768px ~ 1024px | 平板布局 | 双栏压缩、3列卡片网格 |
| < 768px | 手机布局 | 单栏、2列卡片网格、底部固定操作栏 |

```css
/* 武将系统响应式 */
@media (max-width: 768px) {
  .hero-detail-panel {
    flex-direction: column;  /* 立绘和信息区纵向排列 */
  }
  .hero-detail-portrait {
    width: 200px;
    height: 267px;           /* 等比缩放 300×400 → 200×267 */
  }
  .hero-card-grid {
    grid-template-columns: repeat(2, 1fr);  /* 2列 */
  }
}

@media (min-width: 1025px) {
  .hero-card-grid {
    grid-template-columns: repeat(4, 1fr);  /* 4列 */
  }
}
```

---

## 七、图标和资源清单

### 7.1 必需图标列表

#### 品质图标（5个）

| 图标 | 名称 | 尺寸 | 用途 |
|:----:|:----:|:----:|------|
| ○ | quality-common | 16×16 | 普通品质标识 |
| ◆ | quality-fine | 16×16 | 精良品质标识 |
| ◇ | quality-rare | 16×16 | 稀有品质标识 |
| ★ | quality-epic | 16×16 | 史诗品质标识 |
| ✦ | quality-legendary | 16×16 | 传说品质标识 |

> 实现方式：CSS 绘制或 SVG 内联，颜色使用 `var(--hero-quality-*)`

#### 操作图标（8个）

| 图标 | 名称 | 尺寸 | 用途 |
|:----:|:----:|:----:|------|
| ⬆ | icon-upgrade | 20×20 | 升级按钮 |
| ★ | icon-star-up | 20×20 | 升星按钮 |
| 💥 | icon-breakthrough | 20×20 | 突破按钮 |
| 🎯 | icon-recruit | 20×20 | 招募按钮 |
| ⚔ | icon-formation | 20×20 | 编队按钮 |
| 📍 | icon-dispatch | 20×20 | 派驻按钮 |
| 🛡 | icon-equip | 20×20 | 装备按钮 |
| ⚡ | icon-skill | 20×20 | 技能按钮 |

> 实现方式：SVG 内联图标，单色 `currentColor`，方便通过 CSS `color` 属性控制颜色

#### 装备类型图标（4个）

| 图标 | 名称 | 尺寸 | 用途 |
|:----:|:----:|:----:|------|
| ⚔ | equip-weapon | 24×24 | 武器槽位 |
| 🛡 | equip-armor | 24×24 | 防具槽位 |
| 💍 | equip-accessory | 24×24 | 饰品槽位 |
| 🐴 | equip-mount | 24×24 | 坐骑槽位 |

#### 羁绊图标（10个初始羁绊）

| 羁绊名 | 图标建议 | 尺寸 |
|--------|:-------:|:----:|
| 桃园结义 | 🌸 桃花 | 20×20 |
| 蜀汉核心 | 🏛 蜀旗 | 20×20 |
| 五虎上将 | 🐅 虎符 | 20×20 |
| 卧龙凤雏 | 🪶 羽扇 | 20×20 |
| 江东双杰 | 🌊 波浪 | 20×20 |
| 曹魏栋梁 | ⚔ 双剑 | 20×20 |
| 黄巾之乱 | 🔥 火焰 | 20×20 |
| 群雄割据 | 🏰 城池 | 20×20 |
| 赤壁之战 | 🚢 战船 | 20×20 |
| 三顾茅庐 | 🏔 山门 | 20×20 |

### 7.2 占位图资源

| 资源 | 尺寸 | 说明 |
|------|:----:|------|
| 武将头像占位 | 96×96 px | 灰色剪影 + "暂无头像" 文字 |
| 武将立绘占位 | 300×400 px | 灰色全身剪影 + 武将名 |
| 装备图标占位 | 24×24 px | 虚线框 + 类型名 |
| 阵营徽章占位 | 16×16 px | 阵营色圆形 |

> 所有占位图使用 CSS 绘制，不依赖外部图片文件。

### 7.3 资源存放路径规范

```
src/
├── components/idle/
│   ├── panels/hero/
│   │   ├── HeroCard.css          # 武将卡片样式
│   │   ├── HeroDetailModal.css   # 详情面板样式
│   │   ├── RecruitModal.css      # 招贤馆样式
│   │   └── FormationPanel.css    # 编队界面样式
│   └── ThreeKingdomsGame.css     # 全局变量（新增武将专用变量）
├── assets/
│   └── icons/
│       ├── hero-quality/         # 品质图标 SVG
│       ├── hero-actions/         # 操作图标 SVG
│       ├── hero-equipment/       # 装备图标 SVG
│       └── hero-bonds/           # 羁绊图标 SVG
```

---

## 八、设计规范实施检查清单

> 供开发人员自查使用。

### 配色一致性

- [ ] 所有颜色使用 `var(--tk-*)` 或 `var(--hero-*)` CSS 变量，无硬编码色值
- [ ] 品质色统一使用 `--hero-quality-*` 系列，EquipmentPanel/ArmyTab/HeroCard 三处一致
- [ ] 文字色仅使用 `--hero-text` / `--hero-text-secondary` / `--hero-text-muted`
- [ ] 强调色仅使用 `--hero-primary`（古铜金），不混用 `#d4a574` 和 `#C9A84C`

### 动效合规

- [ ] 无 `transition: all` 写法
- [ ] 无 `color` / `background-color` / `background` 过渡动画
- [ ] 无闪烁/脉冲/流光关键帧动画
- [ ] 品质边框仅用静态 `box-shadow`，无 `@keyframes`
- [ ] 卡牌翻转动画时长 ≤ 0.3s

### 布局规范

- [ ] 卡片尺寸符合规范（列表120×160 / 详情240×320 / 招募180×240）
- [ ] 按钮最小尺寸 44×44px（移动端可点击区域）
- [ ] 响应式断点：768px / 1024px
- [ ] 间距使用 `var(--tk-gap-*)` 变量

### 可访问性

- [ ] 文字对比度 ≥ 4.5:1（WCAG AA）
- [ ] 品质色不仅依赖颜色区分，同时使用图标/文字标签
- [ ] 按钮有明确的禁用态视觉反馈
- [ ] 弹窗支持 ESC 键关闭（R16 P0-02）

---

## 附录 A：与现有文档的关联

| 文档 | 路径 | 关联说明 |
|------|------|---------|
| 武将系统 UI 设计 | `docs/games/three-kingdoms/ui-design/04-hero-system.md` | 本规范为其提供视觉层面的细化约束 |
| 交互设计规范 | `docs/games/three-kingdoms/ui-design/20-interaction-spec.md` | 本规范定义视觉表现，交互规范定义操作行为 |
| 主界面布局 | `docs/games/three-kingdoms/ui-design/01-main-layout.md` | 全局配色/字体/间距基线 |
| 武将系统架构 | `docs/games/three-kingdoms/architecture/hero-system-design.md` | 技术实现参考 |
| R16 视觉一致性审计 | `docs/games/three-kingdoms/bugs/R16-visual-consistency.md` | 本规范直接解决其发现的 32 个视觉问题 |
| 全局 CSS 变量 | `src/components/idle/ThreeKingdomsGame.css` | 本规范新增变量追加到 `:root` |

## 附录 B：品质色统一迁移映射

> 解决 R16-A04：三套品质色系统一为 `--hero-quality-*`

| 来源 | 原色值 | 统一为 |
|------|:------:|:------:|
| EquipmentPanel `white` | `#B0B0B0` | `--hero-quality-common: #9CA3AF` |
| EquipmentPanel `green` | `#5CB85C` | `--hero-quality-fine: #10B981` |
| EquipmentPanel `blue` | `#4A90D9` | `--hero-quality-rare: #3B82F6` |
| EquipmentPanel `purple` | `#9B59B6` | `--hero-quality-epic: #8B5CF6` |
| EquipmentPanel `gold` | `#D4A843` | `--hero-quality-legendary: #F59E0B` |
| ArmyTab `LEGENDARY` | `#ff9800` | `--hero-quality-legendary: #F59E0B` |
| ArmyTab `EPIC` | `#c77dff` | `--hero-quality-epic: #8B5CF6` |
| ArmyTab `RARE` | `#4fc3f7` | `--hero-quality-rare: #3B82F6` |
| ArmyTab `UNCOMMON` | `#7EC850` | `--hero-quality-fine: #10B981` |
| ArmyTab `COMMON` | `#a0a0a0` | `--hero-quality-common: #9CA3AF` |
| HeroCard.css `legendary` | `rgba(201,168,76)` | `--hero-quality-legendary: #F59E0B` |
| HeroCard.css `epic` | `rgba(212,85,58)` | `--hero-quality-epic: #8B5CF6` |
| HeroCard.css `rare` | `rgba(155,109,191)` | `--hero-quality-rare: #3B82F6` |
| HeroCard.css `fine` | `rgba(91,139,212)` | `--hero-quality-fine: #10B981` |
| HeroCard.css `common` | `rgba(139,154,107)` | `--hero-quality-common: #9CA3AF` |

## 附录 C：强调色统一迁移映射

> 解决 R16-A01：`#d4a574` 与 `#C9A84C` 混用问题

| 原色值 | 统一为 | 说明 |
|:------:|:------:|------|
| `#d4a574`（~60处内联样式） | `var(--hero-primary)` → `#C9A84C` | 统一使用古铜金 |
| `#C9A84C`（CSS变量 `--tk-gold`） | `var(--hero-primary)` | 保持不变，作为唯一标准值 |
| `#e8e0d0`（内联文字色） | `var(--hero-text)` → `#F0E6D3` | 统一文字主色 |
| `#f0e6d3`（CSS变量 `--tk-text-primary`） | `var(--hero-text)` | 保持不变 |
| `#e0d8c8`（NPC弹窗） | `var(--hero-text)` → `#F0E6D3` | 统一文字主色 |
