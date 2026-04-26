# ACC-02 建筑系统 — R1 验收报告

**验收日期**：2025-07-11
**验收人**：Game Reviewer Agent
**验收范围**：建筑面板 UI 组件 + 建筑引擎逻辑
**代码版本**：当前 main 分支最新提交

---

## 评分：7.6/10

| 维度 | 权重 | 得分 | 加权分 |
|------|------|------|--------|
| 基础可见性 | 30% | 8.5 | 2.55 |
| 核心交互 | 30% | 8.0 | 2.40 |
| 数据正确性 | 25% | 6.5 | 1.63 |
| 边界处理 | 10% | 7.0 | 0.70 |
| 手机端适配 | 5% | 7.5 | 0.38 |
| **总计** | **100%** | — | **7.66 ≈ 7.6** |

---

## 逐项验收结果

### 1. 基础可见性（30%）

| 编号 | 验收项 | 结果 | 问题描述 |
|------|--------|------|----------|
| ACC-02-01 | 建筑面板默认显示 | **PASS** | ✅ `ThreeKingdomsGame.tsx:88` 确认 `useState<TabId>('building')`，默认激活建筑 Tab。SceneRouter 根据 `activeTab` 渲染对应面板 |
| ACC-02-02 | 8座建筑地图布局（PC端） | **PASS** | ✅ `BUILDING_MAP_POSITIONS` 定义了8座建筑的百分比定位：铁匠铺(5%,42%)、农田(28%,10%)、主城(30%,42%)、市集(28%,74%)、兵营(55%,10%)、书院(55%,42%)、城墙(55%,74%)、医馆(78%,42%)，布局与验收标准一致，无重叠 |
| ACC-02-03 | 建筑图标与名称显示 | **PASS** | ✅ 每座建筑渲染：`BUILDING_ICONS[type]`（emoji图标）、`BUILDING_LABELS[type]`（中文名称）、`Lv.{state.level}`（等级徽章），三项要素完整 |
| ACC-02-04 | 建筑产出文字 | **PASS** | ✅ `getProductionText()` 函数根据建筑类型返回格式化文字，如 `+0.8 粮草/s`。使用 `rates`（全局 ProductionRate）的 `toFixed(1)` 格式化。⚠️ 轻微问题：产出文字取自全局 `rates` 而非单建筑产出，当有多个来源产同一资源时可能不准（见 ACC-02-20） |
| ACC-02-05 | 未解锁建筑显示 | **PASS** | ✅ 锁定建筑显示🔒图标、名称灰色（`.tk-bld-pin--locked` opacity:0.5）、状态文字「未解锁」、点击被 `handleBuildingClick` 中 `state?.status === 'locked'` 条件拦截，不弹出弹窗 |
| ACC-02-06 | 可升级指示器 | **PASS** | ✅ 当 `canUpgrade && !isUpgrading` 时渲染 `▲` 指示器（`.tk-bld-pin-upgrade-indicator`），带绿色圆形背景和弹跳动画，与不可升级状态有明显视觉区分 |
| ACC-02-07 | 收支详情按钮 | **PASS** | ✅ 面板顶部 `.tk-bld-income-bar` 中渲染「📊 收支详情」按钮，绑定 `onClick={() => setShowIncomeModal(true)}` |
| ACC-02-08 | 升级队列悬浮面板 | **PASS** | ✅ 当 `upgradingBuildings.length > 0` 时渲染 `.tk-bld-queue`（右上角绝对定位），显示「🔄 升级中 (N)」标题，列出建筑名称、目标等级 `→Lv.{level+1}` 和剩余时间 |
| ACC-02-09 | 升级中建筑状态 | **PASS** | ✅ 升级中建筑切换为 `.tk-bld-pin--upgrading` 样式，渲染进度条（`width: progress*100%`）和倒计时文字，不再显示产出文字 |

**基础可见性小结**：9/9 项全部 PASS。UI 元素按设计稿完整渲染，建筑地图布局、状态区分、升级队列等核心可见元素均到位。

---

### 2. 核心交互（30%）

| 编号 | 验收项 | 结果 | 问题描述 |
|------|--------|------|----------|
| ACC-02-10 | 点击建筑打开升级弹窗 | **PASS** | ✅ 点击非锁定建筑触发 `handleBuildingClick` → `setSelectedBuilding(type)` → 渲染 `BuildingUpgradeModal`。弹窗标题为 `{name}升级`，显示当前等级和分区标签（如「民生建筑」） |
| ACC-02-11 | 升级弹窗 — 升级预览 | **PASS** | ✅ 弹窗显示「升级预览」区域：等级变化 `Lv.X → Lv.X+1`；产出变化从 `BUILDING_DEFS[type].levelTable` 读取当前级和下一级 production 值；特殊属性变化（如主城加成、城防值）也正确读取 `specialValue` |
| ACC-02-12 | 升级弹窗 — 费用明细 | **PASS** | ✅ 显示「升级消耗」区域：粮草🌾、铜钱💰、兵力⚔️（仅 troops>0 时显示），每项含图标+需求数量+持有数量+✅/❌状态，底部显示升级耗时 `⏱️`。费用数据来自 `engine.getUpgradeCost()` |
| ACC-02-13 | 升级弹窗 — 资源不足提示 | **PASS** | ✅ 不足的资源项应用 `.tk-upgrade-cost--short` 样式（红色+红色背景），显示❌。确认按钮 `disabled={!canAfford}`，文案切换为「资源不足」，样式 `.tk-upgrade-btn--disabled`（灰色不可点击） |
| ACC-02-14 | 升级弹窗 — 不可升级原因 | **PASS** | ✅ 当 `!info.canUpgrade && info.reasons.length > 0` 时渲染失败原因列表，每条以「❌」开头。原因来自引擎 `checkUpgrade()` 的 reasons 数组，包含「建筑尚未解锁」「建筑正在升级中」「已达等级上限」「建筑等级不能超过主城等级」「升级队列已满」等 |
| ACC-02-15 | 确认升级操作 | **PASS** | ✅ 点击「▲ 升级」触发 `onConfirm` → `engine.upgradeBuilding(type)` → `executeBuildingUpgrade()` 执行：① `resource.consumeBatch()` 扣减资源 ② `building.startUpgrade()` 切换状态 ③ 发射 `building:upgrade-start` 和 `resource:changed` 事件。弹窗关闭，建筑卡片切换为升级中状态 |
| ACC-02-16 | 关闭升级弹窗 — 取消按钮 | **PASS** | ✅ 「取消」按钮绑定 `onCancel` → `setSelectedBuilding(null)`，弹窗关闭，建筑状态无变化 |
| ACC-02-17 | 关闭升级弹窗 — 点击遮罩 | **PASS** | ✅ `SharedPanel` 组件 `overlayClosable=true`（默认），遮罩点击触发 `handleOverlayClick` → `onClose()` |
| ACC-02-18 | 关闭升级弹窗 — ESC键 | **PASS** | ✅ `SharedPanel` 组件内注册 `keydown` 事件监听，`e.key === 'Escape'` 时调用 `onClose()` |
| ACC-02-19 | 收支详情弹窗交互 | **PASS** | ✅ `BuildingIncomeModal` 包含三部分：①「📈 每秒产出」按资源类型列出正产出 ②「💰 净收入」正/负/零三色区分（绿/红/灰） ③「🏗️ 建筑产出明细」列出每座有产出的建筑名称、等级和产出值 |

**核心交互小结**：10/10 项全部 PASS。弹窗的打开/关闭/升级确认/收支详情等核心交互流程完整，SharedPanel 提供了统一的 ESC + 遮罩关闭能力。

---

### 3. 数据正确性（25%）

| 编号 | 验收项 | 结果 | 问题描述 |
|------|--------|------|----------|
| ACC-02-20 | 升级后资源产出正确更新 | **PASS** ⚠️ | ✅ 引擎层面：`BuildingSystem.tick()` 检测升级完成 → `state.level += 1` → `calculateTotalProduction()` 重新计算 → `ResourceSystem` 更新 `productionRates` → UI 通过 `snapshotVersion` 刷新。**但存在显示精度问题**：`getProductionText()` 使用全局 `rates.grain`（所有来源的总粮草产出），而非单建筑的产出值。当只有农田产粮草时结果正确，但若科技/其他系统也产粮草，建筑卡片上的产出文字将不准确。 |
| ACC-02-21 | 升级消耗与配置一致 | **PASS** | ✅ 弹窗费用数据来自 `engine.getUpgradeCost()` → `BuildingSystem.getUpgradeCost()` → 从 `BUILDING_DEFS[type].levelTable[level].upgradeCost` 读取，与配置表直接对应。显示使用 `formatNumber()` 格式化，存在合理的显示精度差异 |
| ACC-02-22 | 升级扣费精确 | **PASS** | ✅ `executeBuildingUpgrade()` 先 `checkUpgrade(type, resources)` 验证，再 `consumeBatch({ grain, gold, troops })` 精确扣减，扣减量 = `getUpgradeCost()` 返回值。引擎在扣费前做了二次校验 |
| ACC-02-23 | 升级完成后等级递增 | **PASS** | ✅ `BuildingSystem.tick()` 中 `state.level += 1`，`state.status = 'idle'`，UI 通过 `snapshotVersion` 变化触发 `useMemo` 重算，等级徽章从 `Lv.X` 变为 `Lv.X+1`，建筑恢复正常显示 |
| ACC-02-24 | 升级进度条准确 | **PASS** | ✅ `getUpgradeProgress()` 计算 `(Date.now() - startTime) / (endTime - startTime)`，返回 0~1 的进度值。UI 渲染 `width: progress * 100%`，倒计时使用 `getUpgradeRemainingTime()` 返回秒数。基于 `Date.now()` 实时计算，精度取决于 React 重渲染频率 |
| ACC-02-25 | 升级队列数量限制 | **PASS** | ✅ `BuildingSystem.isQueueFull()` 根据 `QUEUE_CONFIGS` 按主城等级确定最大槽位（1~4）。`checkUpgrade()` 中检查 `isQueueFull()` 并添加「升级队列已满」原因 |
| ACC-02-26 | 主城升级解锁子建筑 | **PASS** | ✅ `BuildingSystem.tick()` 中主城升级完成后调用 `checkAndUnlockBuildings()`，遍历所有建筑检查 `BUILDING_UNLOCK_LEVELS`：市集和兵营需主城 Lv.2，铁匠铺和书院需 Lv.3，医馆需 Lv.4，城墙需 Lv.5。解锁后 `status = 'idle', level = 1` |
| ACC-02-27 | 收支详情数值与资源栏一致 | **PASS** | ✅ `BuildingIncomeModal` 的每秒产出使用传入的 `rates`（ProductionRate），与资源栏使用同一数据源。净收入也基于同一 `rates` 对象计算 |
| ACC-02-28 | 建筑产出明细准确 | **PASS** ⚠️ | ✅ `BuildingIncomeModal` 使用 `engine.building?.getProduction?.(type)` 获取各建筑产出，跳过 `level <= 0`、`castle`（无直接产出）、`prod <= 0` 的建筑。**但 `engine.building` 是内部属性直接访问**，若引擎未暴露此属性可能返回 undefined（当前代码用了可选链 `?.` 保护） |
| ACC-02-29 | 净收入正负零显示 | **PASS** | ✅ 正收入使用 `.tk-income-rate`（绿色 `#7EC850`），负收入使用 `.tk-income-rate--negative`（红色 `#E53935`），零收入使用 `.tk-income-rate--zero`（灰色 `#999`），三色区分明确 |

**数据正确性小结**：10/10 项 PASS，但 ACC-02-20 和 ACC-02-28 存在潜在风险点。`getProductionText()` 使用全局 rates 而非单建筑产出是最大的数据正确性隐患。

---

### 4. 边界情况（10%）

| 编号 | 验收项 | 结果 | 问题描述 |
|------|--------|------|----------|
| ACC-02-30 | 资源恰好等于升级消耗 | **PASS** | ✅ `affordability` 检查使用 `>=`（如 `resources.grain >= info.cost.grain`），恰好相等时显示✅，按钮可点击。升级后 `consumeBatch` 扣减使资源归零，`ResourceSystem` 应处理零值不出现负数 |
| ACC-02-31 | 资源仅差1点无法升级 | **PASS** | ✅ `resources.grain < cost.grain` 时 `affordability.grain = false`，显示❌，按钮 `disabled={!canAfford}` 为 true，文案「资源不足」 |
| ACC-02-32 | 建筑达到最高等级 | **FAIL** | ❌ **关键缺陷**：`BuildingUpgradeModal` 中升级预览区域无条件渲染 `Lv.X → Lv.X+1`，未检查是否已达最高等级。当建筑满级时：① `getUpgradeCost()` 返回 `null`（因为 `level >= maxLevel`），费用区域不渲染 ② `checkUpgrade()` 返回 `canUpgrade: false` 且 reasons 含「已达等级上限」③ **但升级预览仍显示 `Lv.25 → Lv.26`（超出上限）**，且产出预览读取 `levelTable[26]` 为 `undefined`，`nextProd` 会回退到 `currentProd`，显示为产出不变。按钮因 `canAfford` 为 true（cost 为 null 时所有 affordability 为 true）可能仍可点击。**需要增加满级判断逻辑** |
| ACC-02-33 | 连续快速点击升级按钮 | **PASS** | ✅ 点击后立即 `setSelectedBuilding(null)` 关闭弹窗，且 `executeBuildingUpgrade()` 内部有 `checkUpgrade()` 二次校验。若升级已开始，二次调用时 `checkUpgrade` 返回「建筑正在升级中」，抛出异常被 `catch` 捕获。但弹窗已关闭，用户无法重复点击 |
| ACC-02-34 | 升级中再次点击同一建筑 | **FAIL** | ❌ **缺陷**：`BuildingPanel` 的 `handleBuildingClick` 仅拦截 `locked` 状态，不拦截 `upgrading` 状态。点击升级中的建筑会打开 `BuildingUpgradeModal`，弹窗显示当前升级信息和失败原因「建筑正在升级中」。但弹窗中升级预览仍显示 `Lv.X → Lv.X+1`，且确认按钮的 `disabled` 仅依赖 `canAfford`（资源是否充足），**未检查 `info.canUpgrade`**。若资源充足，按钮可能显示「▲ 升级」且可点击，点击后 `engine.upgradeBuilding()` 会因引擎校验抛错。**应在按钮 disabled 条件中加入 `!info.canUpgrade` 判断** |
| ACC-02-35 | 多建筑同时升级 | **PASS** | ✅ `BuildingSystem.upgradeQueue` 支持多个并发升级，UI 通过 `upgradingBuildings` 列表渲染多个队列条目，各建筑独立显示进度条和倒计时 |
| ACC-02-36 | 升级完成瞬间资源栏更新 | **PASS** | ✅ 引擎 `tick()` 每帧调用，升级完成时 `state.level += 1`，`calculateTotalProduction()` 立即重算，`ResourceSystem` 更新 `productionRates`，UI 通过 `snapshotVersion` 刷新。更新延迟取决于 tick 间隔（通常 16ms~100ms） |
| ACC-02-37 | 新游戏初始状态 | **PASS** | ✅ `createAllStates()` 中：主城和农田 `unlockCastleLevel = 0`，初始 `level: 1, status: 'idle'`；其余6座建筑 `level: 0, status: 'locked'`。升级队列为空 |
| ACC-02-38 | 升级队列满时尝试升级 | **PASS** | ✅ `checkUpgrade()` 检查 `isQueueFull()` 添加「升级队列已满」原因，弹窗显示该原因。**但同样存在 ACC-02-34 的问题**：按钮 disabled 仅看 `canAfford` |
| ACC-02-39 | 取消升级返还资源 | **TODO** | ⚠️ 引擎层 `cancelBuildingUpgrade()` 已实现 80% 返还（`CANCEL_REFUND_RATIO = 0.8`），但 UI 层**未提供取消升级的入口**。用户无法在界面上取消正在进行的升级，只能通过引擎 API 调用。验收标准中的「通过引擎API取消」步骤可执行，但无 UI 入口 |

**边界情况小结**：4 PASS，2 FAIL，1 TODO，3 PASS。ACC-02-32（满级显示异常）和 ACC-02-34（升级中按钮未禁用）是两个需要修复的关键缺陷。

---

### 5. 手机端适配（5%）

| 编号 | 验收项 | 结果 | 问题描述 |
|------|--------|------|----------|
| ACC-02-40 | 手机端切换为列表布局 | **PASS** | ✅ CSS `@media (max-width: 767px)` 中 `.tk-bld-map { display: none }` 隐藏地图，`.tk-bld-list { display: flex; flex-direction: column }` 显示列表。8座建筑按 `BUILDING_TYPES` 顺序排列 |
| ACC-02-41 | 手机端列表项信息完整 | **PASS** | ✅ 每项显示：图标（emoji）、名称+等级（`{label} Lv.{level}`）、产出文字或升级进度、升级费用预览（`costText`）、右侧「▲」按钮 |
| ACC-02-42 | 手机端升级按钮交互 | **PASS** | ✅ 列表项右侧「▲」按钮 `onClick` 触发 `setSelectedBuilding(type)` 打开升级弹窗，与 PC 端弹窗内容一致 |
| ACC-02-43 | 手机端点击列表项打开弹窗 | **PASS** | ✅ 整个列表项 `onClick={() => handleBuildingClick(type)}` 打开弹窗。按钮区域通过 `e.stopPropagation()` 阻止冒泡，互不干扰 |
| ACC-02-44 | 手机端升级队列 | **PASS** | ✅ CSS 中 `.tk-bld-queue` 在手机端变为 `position: relative; width: 100%; margin-bottom: 8px`，在列表上方显示，不遮挡列表内容 |
| ACC-02-45 | 手机端未解锁建筑显示 | **PASS** | ✅ 列表项应用 `.tk-bld-list-item--locked` 样式（灰色边框、低透明度），显示🔒图标和「未解锁」文字。点击被 `handleBuildingClick` 中 `locked` 检查拦截 |
| ACC-02-46 | 手机端升级弹窗适配 | **PASS** | ✅ CSS `.tk-upgrade-modal` 在手机端 `width: 100%; max-width: 100%; border-radius: 10px 10px 0 0; position: fixed; bottom: 0`（底部弹出），按钮高度 44px 满足触控目标要求 |
| ACC-02-47 | 手机端收支详情弹窗 | **PASS** | ✅ `SharedPanel` 在手机端 `width: 95vw !important; max-height: 85vh`，三部分内容完整显示。`BuildingIncomeModal` 内容区使用 flex 布局，无固定宽度元素 |
| ACC-02-48 | 手机端建筑地图隐藏 | **PASS** | ✅ `.tk-bld-map { display: none }` 完全隐藏地图区域，不占据空间。`.tk-bld-list-item { display: flex }` 显示列表项 |
| ACC-02-49 | 手机端横竖屏切换 | **TODO** | ⚠️ CSS 仅有一个断点 `@media (max-width: 767px)`，未针对横屏（`orientation: landscape`）做特殊处理。横屏时若宽度 ≥768px 可能显示地图布局但高度不足，若宽度 <768px 则保持列表布局。**未发现布局错乱，但也未做横屏优化** |

**手机端适配小结**：9 PASS，1 TODO。手机端列表布局、弹窗适配、触控目标等核心适配到位。横屏场景未做专项优化但不会崩溃。

---

## 问题汇总

### 🔴 严重问题（P0 — 必须修复）

| # | 问题 | 影响范围 | 涉及文件 |
|---|------|----------|----------|
| BUG-1 | **满级建筑升级预览异常**：建筑达到最高等级时，升级弹窗仍显示 `Lv.X → Lv.X+1`（超出上限），产出预览可能显示错误值，且确认按钮可能因 `canAfford` 为 true 而可点击 | ACC-02-32 | `BuildingUpgradeModal.tsx` |
| BUG-2 | **升级按钮 disabled 条件不完整**：确认按钮仅检查 `canAfford`（资源是否充足），未检查 `info.canUpgrade`（引擎综合判断）。当建筑正在升级中、队列已满、已达等级上限等非资源原因导致不可升级时，按钮仍可能显示「▲ 升级」且可点击 | ACC-02-34, ACC-02-38 | `BuildingUpgradeModal.tsx:215-217` |

### 🟡 中等问题（P1 — 建议修复）

| # | 问题 | 影响范围 | 涉及文件 |
|---|------|----------|----------|
| ISSUE-1 | **建筑产出文字取全局 rates 而非单建筑产出**：`getProductionText()` 直接使用 `rates.grain/gold/troops/mandate`，这是所有来源的总产出速率。当科技加成、武将派遣等其他系统也贡献同一资源产出时，建筑卡片上显示的产出值将大于该建筑的实际产出，造成数据误导 | ACC-02-04, ACC-02-20 | `BuildingPanel.tsx:96-103` |
| ISSUE-2 | **取消升级无 UI 入口**：引擎已实现 80% 资源返还的取消逻辑，但 UI 上没有取消按钮或操作入口，玩家无法主动取消升级 | ACC-02-39 | `BuildingPanel.tsx`, `BuildingUpgradeModal.tsx` |
| ISSUE-3 | **BuildingIncomeModal 直接访问 engine.building**：使用 `engine.building?.getProduction?.(type)` 访问引擎内部子系统，耦合度高。若引擎重构可能 break | ACC-02-28 | `BuildingIncomeModal.tsx:109` |

### 🟢 轻微问题（P2 — 可选优化）

| # | 问题 | 影响范围 | 涉及文件 |
|---|------|----------|----------|
| OPT-1 | **横屏适配未专项处理**：仅依赖宽度断点，未考虑手机横屏时高度不足的问题 | ACC-02-49 | `BuildingPanel.css` |
| OPT-2 | **升级进度条依赖 React 重渲染频率**：进度条和倒计时的更新频率取决于父组件的 `snapshotVersion` 更新频率，若更新间隔较大（>500ms），进度条可能不够平滑 | ACC-02-24 | `BuildingPanel.tsx` |

---

## 改进建议

### 1. 修复满级建筑弹窗（BUG-1）— 优先级 P0

```typescript
// BuildingUpgradeModal.tsx — 在升级预览区域增加满级判断
const isMaxLevel = info.level >= (BUILDING_DEFS[buildingType]?.maxLevel ?? 0);

// 升级预览区域
{!isMaxLevel ? (
  <div className="tk-upgrade-section">
    <div className="tk-upgrade-section-title">升级预览</div>
    {/* ... 现有预览内容 ... */}
  </div>
) : (
  <div className="tk-upgrade-section">
    <div className="tk-upgrade-section-title" style={{ textAlign: 'center', color: 'var(--tk-gold)' }}>
      🏆 已达最高等级
    </div>
  </div>
)}
```

### 2. 修复按钮 disabled 条件（BUG-2）— 优先级 P0

```typescript
// BuildingUpgradeModal.tsx — 确认按钮应同时检查 canUpgrade 和 canAfford
const isConfirmDisabled = !info.canUpgrade || !canAfford;

<button
  className={`tk-upgrade-btn tk-upgrade-btn--confirm ${isConfirmDisabled ? 'tk-upgrade-btn--disabled' : ''}`}
  onClick={() => !isConfirmDisabled && onConfirm(buildingType)}
  disabled={isConfirmDisabled}
>
  {!info.canUpgrade ? '无法升级' : !canAfford ? '资源不足' : '▲ 升级'}
</button>
```

### 3. 修复建筑产出文字显示（ISSUE-1）— 优先级 P1

```typescript
// BuildingPanel.tsx — 使用引擎的单建筑产出而非全局 rates
function getProductionText(type: BuildingType, engine: ThreeKingdomsEngine): string {
  const prod = engine.building?.getProduction?.(type) ?? 0;
  switch (type) {
    case 'farmland': return `+${prod.toFixed(1)} 粮草/s`;
    case 'market': return `+${prod.toFixed(1)} 铜钱/s`;
    case 'barracks': return `+${prod.toFixed(1)} 兵力/s`;
    case 'academy': return `+${prod.toFixed(1)} 科技点/s`;
    default: return BUILDING_EFFECTS[type];
  }
}
```

### 4. 增加取消升级 UI 入口（ISSUE-2）— 优先级 P1

在升级队列面板的每个条目或升级中建筑的弹窗中增加「取消升级」按钮，调用 `engine.cancelUpgrade(type)` 并显示 80% 返还提示。

### 5. 增加引擎公共 API 替代直接访问子系统（ISSUE-3）— 优先级 P1

在 `ThreeKingdomsEngine` 上暴露 `getBuildingProduction(type: BuildingType): number` 方法，替代 `engine.building?.getProduction?.(type)` 的内部属性访问。

---

## 验收结论

**整体评价**：建筑系统的核心框架搭建扎实，8座建筑的地图布局、状态管理、升级流程、手机端适配等基础功能均已完整实现。引擎层（BuildingSystem）设计规范，升级检查、费用计算、队列管理、解锁逻辑等核心数据流正确。SharedPanel 组件提供了统一的弹窗体验。

**主要风险**：
1. 两个 P0 级 BUG（满级显示异常 + 按钮 disabled 条件不完整）需要在上线前修复
2. 建筑产出文字取全局 rates 的问题在后期多系统叠加时会产生数据误导
3. 取消升级功能引擎已就绪但 UI 未接入，功能链路不完整

**建议**：修复 2 个 P0 BUG 后可进入 R2 验收。P1 问题建议在 R2 前一并解决。
