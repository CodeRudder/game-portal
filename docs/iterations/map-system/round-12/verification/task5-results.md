# R12 Task5: I5 城防衰减显示 — UI动画与实时渲染

## 概要

为城防血条实现了平滑颜色插值、攻击指示器(脉冲边框+交叉剑图标)和恢复状态指示，并创建了完整的Canvas渲染测试。

## 修改文件

### 1. `src/components/idle/panels/map/PixelWorldMap.tsx`

**变更内容:**

1. **新增 `getDefenseBarColor()` 导出函数** (约第310行)
   - 实现基于 `defenseRatio` 的平滑RGB颜色插值
   - 绿色区间 (ratio > 0.6): `rgb(76-56, 175-205, 80-60)` — 从标准绿到更鲜亮绿色
   - 黄色区间 (0.3 < ratio <= 0.6): `rgb(255→76, 193→175, 7→80)` — 从暖黄到绿黄过渡
   - 红色区间 (ratio <= 0.3): `rgb(180→231, 30→76, 20→60)` — 从深红到亮红过渡
   - 包含 `[0,1]` 范围 clamp 保护

2. **增强 `renderBattlePhase()` 中的城防血条渲染** (约第575行)
   - 替换硬编码颜色选择 (`#4caf50` / `#ffc107` / `#e74c3c`) 为 `getDefenseBarColor()` 平滑插值
   - 新增攻击脉冲边框: 使用 `rgba(255,68,68, pulseAlpha)` 在血条外围绘制脉动红色边框
   - 新增交叉剑攻击图标: 在血条上方使用金色(`#FFD700`)绘制交叉双剑
   - 调整百分比文本位置以适配新增的图标空间

### 2. `src/components/idle/panels/map/__tests__/PixelWorldMap.defense-bar.test.tsx`

**完全重写，新增41个测试:**

- 原有测试 (21个) 全部更新为适配新的RGB颜色格式
- R12 Task5 增强测试 (10个)
- `getDefenseBarColor` 单元测试 (10个)

### 3. `src/components/idle/panels/map/__tests__/PixelWorldMap.siege-render.test.tsx`

**变更内容:**
- 导入 `getDefenseBarColor` 函数
- 更新3个颜色测试用例，从硬编码hex颜色改为使用 `getDefenseBarColor()` 动态计算

## 测试结果

### 防御条专项测试 (41 tests)
```
PASS src/components/idle/panels/map/__tests__/PixelWorldMap.defense-bar.test.tsx (41 tests) 43ms
```

测试覆盖:

| # | 测试场景 | 状态 |
|---|---------|:----:|
| 1 | 无活跃攻城时不渲染城防血条 | PASS |
| 2 | ctx.fillRect被调用绘制血条背景和前景 | PASS |
| 3 | 血条前景fillRect宽度与defenseRatio成正比 | PASS |
| 4 | ctx.fillText被调用绘制百分比文本 | PASS |
| 5 | defenseRatio=1.0时百分比文本为100% | PASS |
| 6 | defenseRatio=0.0时百分比文本为0% | PASS |
| 7 | ratio > 0.6 → 绿色系 (R12: rgb插值) | PASS |
| 8 | ratio = 0.6001 → 绿色系 (严格大于0.6) | PASS |
| 9 | ratio = 0.6 → 黄绿色系 (R12: 在0.6处接近绿/黄边界) | PASS |
| 10 | ratio = 0.5 → 黄色系 (R12: rgb插值) | PASS |
| 11 | 0.3 < ratio <= 0.6 → 黄绿色系 (R12: rgb插值) | PASS |
| 12 | ratio <= 0.3 → 红色系 (R12: rgb插值) | PASS |
| 13 | ratio = 0.3 → 红色系 (R12: 边界值) | PASS |
| 14 | ratio = 0 → 红色系 (R12: 深红) | PASS |
| 15 | completed阶段不渲染城防百分比文本 | PASS |
| 16 | completed阶段不使用城防血条RGB颜色 | PASS |
| 17 | assembly阶段不渲染城防百分比文本 | PASS |
| 18 | assembly阶段不使用城防血条RGB颜色 | PASS |
| 19 | 百分比文本使用白色 (#ffffff) | PASS |
| 20 | 百分比文本使用monospace字体 | PASS |
| 21 | textAlign被设置为center | PASS |
| **R12-T1** | 高城防(ratio=0.8)渲染绿色血条且宽度正确 | PASS |
| **R12-T2** | 中等城防(ratio=0.5)渲染黄绿色血条 | PASS |
| **R12-T3** | 低城防(ratio=0.2)渲染红色血条 | PASS |
| **R12-T4** | 零城防(ratio=0)渲染极小血条且百分比显示0% | PASS |
| **R12-T5** | 血条宽度与ratio成正比(ratio=0.5 → 50%宽度) | PASS |
| **R12-T6** | ratio=0.6边界处颜色平滑过渡(绿→黄) | PASS |
| **R12-T7** | ratio=0.3边界处颜色平滑过渡(黄→红) | PASS |
| **R12-T8** | 多城池独立渲染各自城防血条 | PASS |
| **R12-T9** | 被攻城市显示攻击指示器(脉冲边框+交叉剑图标) | PASS |
| **R12-T10** | 城防恢复时血条颜色正确反映恢复状态 | PASS |
| **Unit-1** | getDefenseBarColor: ratio=1.0 返回绿色范围 | PASS |
| **Unit-2** | getDefenseBarColor: ratio=0.8 返回绿色范围 | PASS |
| **Unit-3** | getDefenseBarColor: ratio=0.5 返回黄绿色范围 | PASS |
| **Unit-4** | getDefenseBarColor: ratio=0.2 返回红色范围 | PASS |
| **Unit-5** | getDefenseBarColor: ratio=0.0 返回深红色范围 | PASS |
| **Unit-6** | getDefenseBarColor: 超出范围值被clamp | PASS |
| **Unit-7** | getDefenseBarColor: 相近ratio产生相近颜色 | PASS |
| **Unit-8** | getDefenseBarColor: 边界值ratio=0.6落在黄色区间 | PASS |
| **Unit-9** | getDefenseBarColor: 边界值ratio=0.3落在红色区间 | PASS |
| **Unit-10** | getDefenseBarColor: ratio=0.3+epsilon落在黄色区间 | PASS |

### 全量回归测试 (194 tests)
```
PASS src/components/idle/panels/map/__tests__/PixelWorldMap.test.tsx (31 tests)
PASS src/components/idle/panels/map/__tests__/PixelWorldMapMinimap.test.tsx (10 tests)
PASS src/components/idle/panels/map/__tests__/PixelWorldMap.dirty-flag.test.tsx (14 tests)
PASS src/components/idle/panels/map/__tests__/PixelWorldMap.siege-render.test.tsx (32 tests)
PASS src/components/idle/panels/map/__tests__/PixelWorldMap.defense-bar.test.tsx (41 tests)
PASS src/components/idle/panels/map/__tests__/PixelWorldMap.touch.test.tsx (3 tests)
PASS src/components/idle/panels/map/__tests__/PixelWorldMapMarchSprites.test.tsx (53 tests)
PASS src/components/idle/panels/map/__tests__/PixelWorldMap.perf.test.tsx (10 tests)

Test Files: 8 passed (8)
Tests: 194 passed (194)
```

## 设计决策

1. **平滑颜色插值 vs 渐变**: 选择在每个区间内进行线性RGB插值而非Canvas渐变，因为:
   - 血条填充区域已经用fillRect绘制，渐变需要额外计算
   - 线性插值在视觉上足够平滑，且实现简单高效
   - 避免创建额外的Canvas gradient对象

2. **攻击指示器集成**: 脉冲边框和交叉剑图标直接集成在 `renderBattlePhase()` 中，因为:
   - 城市被围攻时必然处于战斗阶段
   - 不需要额外的数据字段来判断是否被攻击
   - 使用 `Date.now()` 实现脉冲效果，无需外部状态

3. **颜色范围选择**: 保持与原有绿色(#4CAF50)、黄色(#FFC107)、红色(#E74C3C)的主色调一致，仅在区间内做微调平滑

## 已知限制

- 恢复指示器通过颜色变化隐式表达，未添加独立的向上箭头/蓝色恢复线(因为 `SiegeAnimationState` 缺少 `previousDefenseRatio` 字段，无法在渲染层检测恢复方向)
- 如需显式恢复指示器，需要在 `SiegeBattleAnimationSystem` 中添加 `previousDefenseRatio` 或 `isRecovering` 字段
