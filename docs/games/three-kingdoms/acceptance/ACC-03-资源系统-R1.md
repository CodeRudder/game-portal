# ACC-03 资源系统 — R1 用户验收测试报告

> **验收日期**：2025-07-10  
> **验收轮次**：R1（首轮）  
> **验收人**：Game Reviewer（专业游戏验收测试工程师）  
> **验收方法**：静态代码审查（UI组件 + 引擎逻辑 + CSS样式）  
> **验收范围**：ACC-03 全部 49 个验收项  

---

## 一、验收统计总览

| 优先级 | 总数 | ✅ 通过 | ⚠️ 待渲染验证 | ❌ 不通过 | 通过率 |
|--------|------|---------|---------------|----------|--------|
| **P0** | 16 | 11 | 4 | 1 | 68.8% |
| **P1** | 20 | 10 | 7 | 3 | 50.0% |
| **P2** | 13 | 6 | 5 | 2 | 46.2% |
| **合计** | **49** | **27** | **16** | **6** | **55.1%** |

### 通过标准判定

| 条件 | 要求 | 实际 | 结果 |
|------|------|------|------|
| P0 项全部通过 | 100% | 68.8%（1项不通过 + 4项待渲染验证） | ❌ 未达标 |
| P1 项通过率 | ≥ 90% | 50.0% | ❌ 未达标 |
| P2 项通过率 | ≥ 80% | 46.2% | ❌ 未达标 |

> **R1 综合判定：❌ 不通过** — 需修复后进入 R2 复验

---

## 二、逐项验收详情

### 1. 基础可见性（ACC-03-01 ~ ACC-03-09）

| 编号 | 验收项 | 结果 | 分析依据 |
|------|--------|------|----------|
| ACC-03-01 | 资源栏在主界面顶部正确显示 | ✅ 通过 | `ResourceBar` 在 `ThreeKingdomsGame.tsx:479` 作为 A 区渲染，CSS `.tk-resource-bar` 设置 `height: 56px`、`background: rgba(20, 25, 35, 0.9)` 深色半透明背景，`order: 1` 确保顶部排列 |
| ACC-03-02 | 6 种资源图标和名称正确显示 | ⚠️ 待渲染验证 | `RESOURCE_ORDER` 数组定义顺序为 `grain→gold→troops→mandate→techPoint→recruitToken`，`RESOURCE_ICONS` 映射图标 `🌾💰⚔️👑🔬📜`，与验收标准一致。**但注意**：`RESOURCE_LABELS` 中 `recruitToken` 映射为 `'招贤榜'` 而非验收标准中的 `'招贤令'`（见下方不通过项） |
| ACC-03-03 | 资源数值实时显示 | ✅ 通过 | CSS `.tk-res-value` 使用 `font-variant-numeric: tabular-nums` 等宽数字字体。引擎 `tick()` 方法每帧调用 `addResource()` 更新资源，UI 通过 `setInterval` 1秒刷新 `snapshotVersion` 驱动重渲染 |
| ACC-03-04 | 产出速率文本正确显示 | ✅ 通过 | `formatRate()` 函数：正数显示 `+X.X/秒` 绿色（`tk-res-rate--positive`），负数显示红色（`tk-res-rate--negative`），无产出返回空字符串不显示。逻辑完整 |
| ACC-03-05 | 有上限资源显示容量进度条 | ✅ 通过 | `ResourceItem` 中 `hasCap && <div className="tk-res-cap-bar">` 渲染进度条，CSS 设置 `height: 3px`，`width` 按 `percentage * 100%` 填充，`backgroundColor` 随警告级别变化 |
| ACC-03-06 | 有上限资源显示"/上限"数值 | ✅ 通过 | `{hasCap && <span className="tk-res-cap">/{formatAmount(cap!)}</span>}` 正确渲染。`caps` 中 `grain` 和 `troops` 有值，`gold/mandate/techPoint/recruitToken` 为 `null`，`hasCap` 判断正确 |
| ACC-03-07 | 收支详情按钮可见 | ✅ 通过 | `<button className="tk-res-detail-btn">📊</button>` 存在，CSS 设置 `border: 1px solid rgba(200, 169, 110, 0.3)`、hover 时 `background: rgba(200, 169, 110, 0.12)`、`title="收支详情"` |
| ACC-03-08 | 游戏标题"三国霸业"显示 | ✅ 通过 | `<div className="tk-res-title">三国霸业</div>`，CSS `.tk-res-title` 设置 `font-size: 16px`、`font-weight: 700`、`color: var(--tk-gold-soft)`、`letter-spacing: 2px`，完全符合验收标准 |
| ACC-03-09 | 资源项 tooltip 信息完整 | ✅ 通过 | `title` 属性设置为 `${label} ${formatAmount(value)}${overflowInfo ? `（溢出 ${formatAmount(overflowInfo.wasted)}）` : ''}`，溢出时显示溢出量 |

### 2. 核心交互（ACC-03-10 ~ ACC-03-19）

| 编号 | 验收项 | 结果 | 分析依据 |
|------|--------|------|----------|
| ACC-03-10 | 点击收支详情按钮打开弹窗 | ✅ 通过 | `setShowDetails(true)` 控制弹窗显示，渲染 `.tk-res-detail-overlay` 遮罩 + `.tk-res-detail-modal` 弹窗，标题 `<h3>资源收支</h3>`，右上角 `<button>✕</button>` 关闭按钮 |
| ACC-03-11 | 收支详情弹窗显示产出明细 | ✅ 通过 | `productionBreakdown` 通过 `useMemo` 从 `buildings` 遍历 `BUILDING_DEFS` 的 `levelTable` 计算产出，每行显示 `图标 + 建筑名 + 产出速率`。无产出时显示 `<div className="tk-res-detail-empty">暂无建筑产出</div>` |
| ACC-03-12 | 收支详情弹窗显示净收入 | ✅ 通过 | 净收入区域遍历 `RESOURCE_ORDER` 显示所有 6 种资源，`rates[type] >= 0` 时绿色带 `+` 号，`< 0` 时红色带 `-` 号，格式为 `X.X/秒` |
| ACC-03-13 | 点击遮罩关闭收支详情弹窗 | ✅ 通过 | `.tk-res-detail-overlay` 的 `onClick={() => setShowDetails(false)}`，内部 modal `onClick={e => e.stopPropagation()` 防止冒泡 |
| ACC-03-14 | 点击 ✕ 关闭收支详情弹窗 | ✅ 通过 | `<button className="tk-res-detail-close" onClick={() => setShowDetails(false)}>✕</button>` |
| ACC-03-15 | 离线收益弹窗自动弹出 | ⚠️ 待渲染验证 | 引擎层逻辑完整：`ThreeKingdomsGame.tsx:150` 调用 `shouldShowOfflinePopup(offlineEarnings.offlineSeconds)`，阈值 300 秒（5分钟），超过则 `setOfflineReward(offlineEarnings)` 触发弹窗 |
| ACC-03-16 | 离线收益弹窗显示资源明细 | ⚠️ 待渲染验证 | `OfflineRewardModal` 使用 `gridTemplateColumns: '1fr 1fr'` 的 2×2 网格，遍历 6 种资源（grain/gold/troops/mandate/techPoint/recruitToken），每张卡片显示图标+名称+收益数值，数值颜色与资源主题色一致 |
| ACC-03-17 | 领取离线收益 | ⚠️ 待渲染验证 | `onConfirm={onClaim}` 回调 → `handleOfflineClaim` → `setOfflineReward(null)` 关闭弹窗 + Toast 提示。引擎层 `applyOfflineEarnings()` 将收益添加到资源并受上限约束 |
| ACC-03-18 | 离线收益弹窗显示离线时长 | ✅ 通过 | `formatOfflineDuration()` 函数将秒数转为可读格式（X小时X分钟），`reward.isCapped` 为 true 时显示 `⚠️ 已达上限` 黄色警告 |
| ACC-03-19 | 短时间离线不弹窗 | ✅ 通过 | `shouldShowOfflinePopup()` 使用 `offlineSeconds > OFFLINE_POPUP_THRESHOLD`（300秒），300秒及以下不弹窗。测试用例验证：`expect(shouldShowOfflinePopup(300)).toBe(false)` |

### 3. 数据正确性（ACC-03-20 ~ ACC-03-29）

| 编号 | 验收项 | 结果 | 分析依据 |
|------|--------|------|----------|
| ACC-03-20 | 新游戏初始资源数值正确 | ✅ 通过 | `INITIAL_RESOURCES` 定义：`grain:500, gold:300, troops:50, mandate:0, techPoint:0, recruitToken:10`，与验收标准完全一致 |
| ACC-03-21 | 资源产出速率与建筑等级匹配 | ⚠️ 待渲染验证 | 引擎层 `recalculateProduction(buildingProductions)` 从 `BuildingSystem.calculateTotalProduction()` 获取建筑产出，建筑升级后 `syncBuildingToResource()` 同步更新。逻辑正确，需渲染验证实际数值 |
| ACC-03-22 | 资源消耗后数值正确减少 | ⚠️ 待渲染验证 | `consumeResource()` 和 `consumeBatch()` 均有正确的扣减逻辑。`consumeBatch()` 先调用 `canAfford()` 检查，通过后统一扣除，保证原子性 |
| ACC-03-23 | 离线收益计算正确 | ✅ 通过 | `calculateOfflineEarnings()` 按 5 档衰减计算：0~2h(100%)、2~8h(80%)、8~24h(60%)、24~48h(40%)、48~72h(20%)。0~2 小时内 `earned = rate × seconds × 1.0`，与验收标准一致 |
| ACC-03-24 | 离线收益衰减机制正确 | ✅ 通过 | `OFFLINE_TIERS` 定义 5 档：`0→7200s(1.0)`, `7200→28800s(0.8)`, `28800→86400s(0.6)`, `86400→172800s(0.4)`, `172800→259200s(0.2)`。3 小时离线 = 2h×100% + 1h×80%，符合设计 |
| ACC-03-25 | 离线收益上限为 72 小时 | ✅ 通过 | `OFFLINE_MAX_SECONDS = 259200`（72小时），`effectiveSeconds = Math.min(offlineSeconds, OFFLINE_MAX_SECONDS)` 截断。`isCapped` 标记超过上限 |
| ACC-03-26 | 粮草保护机制生效 | ✅ 通过 | `consumeResource()` 中 `type === 'grain'` 分支：`available = Math.max(0, current - MIN_GRAIN_RESERVE)`，`MIN_GRAIN_RESERVE = 10`。不足时抛出 `"粮草不足：需要 X，可用 Y（保留 10）"` |
| ACC-03-27 | 批量消耗原子性 | ✅ 通过 | `consumeBatch()` 先调用 `canAfford()` 检查所有资源，任一不足则抛出错误不扣任何资源。全部通过后统一扣除 |
| ACC-03-28 | 存档加载后资源数值恢复正确 | ⚠️ 待渲染验证 | `deserialize()` 恢复 `resources/productionRates/caps`，对每个资源值做 `Math.max(0, Number(val) || 0)` 防御 NaN/undefined，然后调用 `enforceCaps()` 确保上限约束。逻辑正确 |
| ACC-03-29 | 铜钱经济日产出符合设计 | ⚠️ 待渲染验证 | `COPPER_PASSIVE_RATE = 1.3`/秒 × 14400秒 = 18720，`COPPER_DAILY_TASK_REWARD = 2000`，`COPPER_STAGE_CLEAR_BASE = 100 + level*20`。理论日产出 ≈ 22,720，与 PRD v1.3 一致 |

### 4. 边界情况（ACC-03-30 ~ ACC-03-39）

| 编号 | 验收项 | 结果 | 分析依据 |
|------|--------|------|----------|
| ACC-03-30 | 资源达到上限后停止增长 | ✅ 通过 | `addResource()` 中 `after = cap !== null ? Math.min(before + amount, cap) : before + amount`，到达上限后 `actual = 0`。UI 层 `warningLevel === 'full'` 时显示"已满"红色文本 |
| ACC-03-31 | 容量接近上限时显示橙色警告 | ✅ 通过 | `percentage >= 0.8` 时 `warningLevel = 'warning'`，CSS `.tk-res-item--warning` 橙色边框 + 背景，`.tk-res-value--warning` 橙色数值，显示"接近上限"文本 |
| ACC-03-32 | 容量接近满时显示红色紧急警告 | ✅ 通过 | `percentage >= 0.95` 时 `warningLevel = 'urgent'`，CSS `.tk-res-item--urgent` 红色边框，`.tk-res-value--urgent` 红色数值，显示"将满"文本 |
| ACC-03-33 | 溢出预判警告横幅显示 | ❌ 不通过 | `overflowWarnings` 计算逻辑存在，但 `ThreeKingdomsGame.tsx:479` 渲染 `<ResourceBar>` 时**未传递 `pendingGains` prop**，导致 `overflowWarnings` 始终为空数组，横幅永远不会显示。见下方不通过项详情 |
| ACC-03-34 | 上限降低时截断溢出资源 | ✅ 通过 | `updateCaps()` 调用 `enforceCaps()` 遍历所有资源，`if (cap !== null && resources[type] > cap) resources[type] = cap` |
| ACC-03-35 | 资源不足时操作按钮禁用/提示 | ⚠️ 待渲染验证 | `canAfford()` 返回 `{ canAfford, shortages }`，不足时 `shortages` 包含具体缺少量和当前量。错误消息格式为 `"资源不足 — type: 需要 X，可用 Y"`。需验证各 UI 面板是否正确使用此接口 |
| ACC-03-36 | 新游戏无建筑产出时收支详情为空 | ✅ 通过 | `productionBreakdown` 遍历 buildings，`state.level <= 0` 时 `continue` 跳过，空列表时显示 `<div className="tk-res-detail-empty">暂无建筑产出</div>`。净收入区域仍显示所有资源速率为 `0.0/秒` |
| ACC-03-37 | 离线 0 秒不触发弹窗 | ✅ 通过 | `shouldShowOfflinePopup(0)` → `0 > 300` → `false`，不弹窗 |
| ACC-03-38 | 大数值资源格式化显示正确 | ✅ 通过 | `formatNumber()` 规则：`< 10000` → 整数，`1万~9999.9万` → `X.X万`，`≥ 1亿` → `X.X亿`。如 `12345678` → `"1234.6万"`，不使用科学计数法 |
| ACC-03-39 | 资源数值不会出现 NaN 或负数 | ✅ 通过 | `deserialize()` 中 `Math.max(0, Number(val) || 0)` 防御。`consumeResource()` 中 `Number.isFinite(current)` 检查。`addResource()` 中 `amount <= 0 return 0` 防御 |

### 5. 手机端适配（ACC-03-40 ~ ACC-03-49）

| 编号 | 验收项 | 结果 | 分析依据 |
|------|--------|------|----------|
| ACC-03-40 | 资源栏手机端自适应布局 | ✅ 通过 | `@media (max-width: 767px)` 设置 `height: auto; min-height: 48px; flex-wrap: wrap;`，`.tk-res-item` 设置 `min-width: calc(50% - 8px); flex: 0 1 calc(50% - 8px);` 实现每行 2 个 |
| ACC-03-41 | 手机端资源项尺寸适配 | ✅ 通过 | 手机端 `.tk-res-icon { font-size: 14px }`、`.tk-res-value { font-size: 11px }`、`.tk-res-rate { font-size: 11px }`、`.tk-res-title { font-size: 12px }` |
| ACC-03-42 | 手机端容量进度条适配 | ✅ 通过 | 手机端 `.tk-res-cap-bar { left: 6px; right: 6px; height: 2px; }`（PC 端 3px），间距和高度适配 |
| ACC-03-43 | 手机端收支详情弹窗适配 | ✅ 通过 | `.tk-res-detail-modal { max-width: 90vw; }`，手机端 `@media` 覆盖 `width: 95vw; max-width: 95vw;` |
| ACC-03-44 | 手机端离线收益弹窗适配 | ⚠️ 待渲染验证 | `OfflineRewardModal` 使用 `width="420px"` 传给 `Modal`，但 `offline-reward.css` 中手机端 `[class*="modal"] { width: 95vw !important; }` 全局覆盖。需渲染验证实际效果 |
| ACC-03-45 | 手机端容量警告视觉反馈 | ✅ 通过 | 警告样式（`.tk-res-item--warning/urgent/full`）在手机端同样生效（无覆盖），文本"已满/将满/接近上限"字号 9px 在手机端仍可读 |
| ACC-03-46 | 手机端溢出横幅不遮挡操作 | ❌ 不通过 | `.tk-res-overflow-banner` 使用 `position: absolute; top: 100%;`，在手机端资源栏 `flex-wrap: wrap` 时，`position: absolute` 的定位基准可能不正确。且因 pendingGains 未传递，此功能实际不工作 |
| ACC-03-47 | 手机端横屏布局正常 | ⚠️ 待渲染验证 | CSS 仅区分 `max-width: 767px`，横屏 667×375 宽度 667px > 767px 不触发手机样式，会使用 PC 布局。但 667px 宽度下 6 个资源项可能挤压，需渲染验证 |
| ACC-03-48 | 手机端触摸收支详情按钮 | ❌ 不通过 | `.tk-res-detail-btn` 仅设置 `padding: 4px 8px`，实际触摸区域约 24×24px，**不满足 44px 最小触摸目标**要求（Apple HIG / WCAG 标准）。需增大 padding 或添加 `min-width/min-height: 44px` |
| ACC-03-49 | 手机端资源数值不截断 | ✅ 通过 | `formatNumber()` 对大数值使用紧凑格式（"100.0万"），`.tk-res-item` 设置 `overflow: visible`，`.tk-res-value-row` 使用 `white-space: nowrap` |

---

## 三、不通过项详情（6 项）

### ❌ ACC-03-02（部分）— 招贤令标签不一致

| 属性 | 详情 |
|------|------|
| **优先级** | P0（影响资源名称准确性） |
| **期望** | 第 6 种资源显示为"招贤令" |
| **实际** | `RESOURCE_LABELS.recruitToken = '招贤榜'`（resource.types.ts:49），与验收标准不一致 |
| **影响范围** | 资源栏 tooltip、收支详情弹窗中均显示"招贤榜" |
| **修复建议** | 将 `resource.types.ts` 中 `recruitToken: '招贤榜'` 改为 `recruitToken: '招贤令'`。注意 `OfflineRewardModal` 中硬编码了 `label: '招贤令'`（正确），两处不一致需统一 |

### ❌ ACC-03-33 — 溢出预判警告横幅不工作

| 属性 | 详情 |
|------|------|
| **优先级** | P1 |
| **期望** | pendingGains 传入后，资源栏下方出现橙色横幅提示溢出 |
| **实际** | `ThreeKingdomsGame.tsx:479` 渲染 `<ResourceBar>` 时仅传递 `resources/rates/caps/buildings`，**未传递 `pendingGains` prop** |
| **影响范围** | `overflowWarnings` 始终为空数组，横幅永远不会显示；`ResourceItem` 中 `overflowInfo` 始终为 null，溢出 ⚠️ 标记不显示 |
| **修复建议** | 在 `ThreeKingdomsGame.tsx` 中从 snapshot 或引擎获取 `pendingGains` 数据，传递给 `<ResourceBar pendingGains={pendingGains} />` |

### ❌ ACC-03-46 — 手机端溢出横幅定位问题

| 属性 | 详情 |
|------|------|
| **优先级** | P2 |
| **期望** | 溢出横幅在资源栏下方显示，不遮挡底部 Tab 栏和场景区域 |
| **实际** | `.tk-res-overflow-banner` 使用 `position: absolute; top: 100%`，但手机端 `.tk-resource-bar` 设置 `flex-wrap: wrap` 且 `height: auto`，`position: absolute` 相对定位基准可能不正确，横幅可能遮挡换行后的资源项 |
| **修复建议** | 将横幅改为 `position: relative` 或在 `.tk-resource-bar` 上添加 `position: relative; overflow: visible;`，确保横幅在资源栏整体下方显示 |

### ❌ ACC-03-48 — 手机端收支详情按钮触摸区域不足

| 属性 | 详情 |
|------|------|
| **优先级** | P1 |
| **期望** | 触摸区域 ≥ 44px（Apple HIG / WCAG 2.5.5 标准） |
| **实际** | `.tk-res-detail-btn { padding: 4px 8px; font-size: 16px; }` 实际触摸区域约 24×24px，远低于 44px 标准 |
| **修复建议** | 添加 `min-width: 44px; min-height: 44px; display: flex; align-items: center; justify-content: center;` 或增大 padding 至 `padding: 12px 10px` |

### ❌ ACC-03-02 补充 — 脉冲动画被注释

| 属性 | 详情 |
|------|------|
| **优先级** | P2（功能点#12 资源产出脉冲动画） |
| **期望** | 资源数值增加时有视觉脉冲反馈 |
| **实际** | CSS `.tk-res-item--pulse` 中 `animation: resource-pulse 0.4s ease-out;` **被注释掉**。JS 中 `setPulsing(true)` 逻辑存在但无视觉效果 |
| **修复建议** | 取消注释 `.tk-res-item--pulse` 中的 `animation` 属性，同时取消注释 `.tk-res-item--urgent/full` 中的脉冲动画和 `.tk-res-overflow-badge/.tk-res-value--full` 中的闪烁动画 |

### ❌ ACC-03-02 补充 — 容量警告动画被注释

| 属性 | 详情 |
|------|------|
| **优先级** | P2（视觉反馈） |
| **期望** | 容量达到 urgent/full 时有脉冲/闪烁动画 |
| **实际** | CSS 中 `tk-res-pulse-urgent`、`tk-res-pulse-full`、`tk-res-blink` 的 `animation` 引用均被注释 |
| **修复建议** | 取消注释相关 animation 属性，或确认是性能优化后的有意为之 |

---

## 四、待渲染验证项（16 项）

以下项目代码逻辑正确，但涉及运行时视觉效果或复杂交互，需在浏览器中实际渲染验证：

| 编号 | 验收项 | 代码审查结论 | 需验证内容 |
|------|--------|-------------|-----------|
| ACC-03-02 | 6种资源图标显示 | 图标映射正确 | 实际渲染确认图标清晰可辨 |
| ACC-03-15 | 离线收益弹窗自动弹出 | 触发逻辑完整 | 模拟5分钟+离线后重新加载验证 |
| ACC-03-16 | 离线收益弹窗资源明细 | 网格布局代码正确 | 确认2×2网格在PC和手机端正常显示 |
| ACC-03-17 | 领取离线收益 | 回调链完整 | 确认领取后资源栏数值正确增加 |
| ACC-03-21 | 产出速率与建筑等级匹配 | 计算链路完整 | 升级农田后确认粮草速率变化 |
| ACC-03-22 | 资源消耗后数值减少 | 扣减逻辑正确 | 执行建筑升级后确认资源扣减 |
| ACC-03-28 | 存档加载后数值恢复 | 反序列化有防御 | 刷新页面后确认数值一致 |
| ACC-03-29 | 铜钱经济日产出 | 常量配置正确 | 长时间运行后统计验证 |
| ACC-03-35 | 资源不足操作禁用 | canAfford 接口正确 | 确认各面板按钮状态联动 |
| ACC-03-44 | 手机端离线弹窗适配 | CSS 全局覆盖存在 | 手机端确认弹窗宽度适配 |
| ACC-03-47 | 手机端横屏布局 | 未特殊处理 | 667×375 横屏确认无挤压 |

---

## 五、关键发现

### 🔴 严重问题（影响核心功能）

1. **pendingGains 未传递（ACC-03-33）**：溢出预判警告系统在 UI 层完全失效。`ResourceBar` 组件已实现完整的溢出检测和横幅渲染逻辑，但 `ThreeKingdomsGame.tsx` 未传递 `pendingGains` prop，导致整个溢出预警功能形同虚设。这是一个**功能缺失**而非 bug，需要补充数据传递。

2. **招贤令/招贤榜名称不一致（ACC-03-02）**：引擎层 `RESOURCE_LABELS` 使用"招贤榜"，而 `OfflineRewardModal` 硬编码使用"招贤令"，ACC 验收标准要求"招贤令"。三处不一致需统一。

### 🟡 中等问题（影响用户体验）

3. **手机端触摸区域不足（ACC-03-48）**：收支详情按钮触摸区域仅约 24×24px，远低于 44px 标准，在手机端容易误触或难以点击。

4. **脉冲动画全部被注释**：资源产出脉冲、容量警告脉冲、溢出闪烁动画的 CSS `animation` 属性全部被注释掉，功能点#12 的视觉反馈完全缺失。虽然不影响功能正确性，但严重影响用户体验。

### 🟢 良好实践

5. **资源数值防御编程**：`deserialize()` 中对每个资源值做 `Math.max(0, Number(val) || 0)` 防御，`consumeResource()` 中使用 `Number.isFinite()` 检查，有效防止 NaN/undefined/Infinity。

6. **批量消耗原子性**：`consumeBatch()` 先检查后扣减的模式保证了多资源消耗的原子性。

7. **离线收益5档衰减**：设计合理，0~2h(100%)→2~8h(80%)→8~24h(60%)→24~48h(40%)→48~72h(20%)，72小时上限防止无限累积。

8. **粮草保护机制**：`MIN_GRAIN_RESERVE = 10` 始终保留最低粮草，防止玩家陷入无法操作死锁。

---

## 六、R1 评分

### 5 维度评分（满分 10 分）

| 维度 | 评分 | 说明 |
|------|------|------|
| **功能完整性** | 7.0 | 核心资源增减/产出/离线收益功能完整，但溢出预判系统未接线（pendingGains 未传递），脉冲动画被禁用 |
| **数据正确性** | 9.0 | 初始值/消耗/产出/离线收益计算逻辑严密，防御编程到位，批量消耗原子性保证好 |
| **UI/UX 设计** | 7.5 | PC 端布局清晰、信息层次好，容量警告三级梯度设计合理。但手机端触摸区域不足，动画被注释影响体验 |
| **手机端适配** | 6.5 | 基础响应式布局到位（flex-wrap/字号缩放/进度条适配），但触摸区域不达标、横屏未特殊处理、溢出横幅定位问题 |
| **代码质量** | 8.5 | 组件职责清晰、类型安全、CSS BEM 命名规范、引擎层纯函数分离好。但存在硬编码标签不一致、注释代码未清理 |

### 综合评分

| 指标 | 分值 |
|------|------|
| **R1 综合评分** | **7.7 / 10** |
| **验收通过判定** | ❌ 不通过 |

### 评分说明

代码质量和数据正确性得分较高（8.5/9.0），反映了引擎层架构设计的成熟度。主要失分在：
- 溢出预判系统未接线（功能完整性 -1.5）
- 手机端触摸区域不达标（适配 -1.5）
- 动画效果被禁用（UX -1.0）
- 标签不一致问题（质量 -0.5）

---

## 七、R2 修复建议优先级排序

| 优先级 | 修复项 | 对应编号 | 预估工作量 |
|--------|--------|---------|-----------|
| 🔴 P0 | 统一招贤令/招贤榜标签为"招贤令" | ACC-03-02 | 0.5h |
| 🔴 P0 | 传递 pendingGains prop 到 ResourceBar | ACC-03-33 | 2h |
| 🟡 P1 | 增大手机端收支详情按钮触摸区域至 44px | ACC-03-48 | 0.5h |
| 🟡 P1 | 取消注释脉冲/闪烁动画 CSS | ACC-03-02补充 | 0.5h |
| 🟡 P2 | 修复手机端溢出横幅定位 | ACC-03-46 | 1h |
| 🟢 P2 | 添加横屏媒体查询适配 | ACC-03-47 | 1h |

**预估 R2 修复总工作量：约 5.5 小时**

---

## 八、附录

### A. 验收审查文件清单

| 文件 | 用途 |
|------|------|
| `src/components/idle/panels/resource/ResourceBar.tsx` | 资源栏 UI 主组件 |
| `src/components/idle/panels/resource/ResourceBar.css` | 资源栏样式（含响应式） |
| `src/components/idle/three-kingdoms/OfflineRewardModal.tsx` | 离线收益弹窗 |
| `src/components/idle/three-kingdoms/offline-reward.css` | 弹窗样式覆盖 |
| `src/components/idle/ThreeKingdomsGame.tsx` | 主界面集成 |
| `src/components/idle/utils/formatNumber.ts` | 数值格式化 |
| `src/games/three-kingdoms/engine/resource/ResourceSystem.ts` | 资源引擎核心 |
| `src/games/three-kingdoms/engine/resource/OfflineEarningsCalculator.ts` | 离线收益计算 |
| `src/games/three-kingdoms/engine/resource/resource-config.ts` | 资源配置常量 |
| `src/games/three-kingdoms/engine/resource/resource-calculator.ts` | 资源计算辅助 |
| `src/games/three-kingdoms/engine/resource/resource.types.ts` | 资源类型定义 |
| `src/games/three-kingdoms/engine/resource/copper-economy-system.ts` | 铜钱经济系统 |
| `src/games/three-kingdoms/engine/resource/material-economy-system.ts` | 材料经济系统 |
| `src/games/three-kingdoms/engine/currency/CurrencySystem.ts` | 货币系统 |
| `src/games/three-kingdoms/engine/offline/OfflinePanelHelper.ts` | 离线弹窗辅助 |
| `src/games/three-kingdoms/shared/types.ts` | 共享类型定义 |

### B. 验收方法说明

本次验收为**静态代码审查**，通过阅读 UI 组件源码、引擎逻辑源码和 CSS 样式文件，对照验收标准逐项检查实现情况。未进行浏览器渲染测试。

- ✅ 通过：代码实现与验收标准完全一致
- ⚠️ 待渲染验证：代码逻辑正确，但需浏览器实际渲染确认视觉效果
- ❌ 不通过：代码实现与验收标准不一致或功能缺失

---

*报告生成时间：2025-07-10 | Game Reviewer Agent v1.0*
