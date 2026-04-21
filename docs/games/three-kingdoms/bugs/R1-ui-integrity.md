# R1 迭代报告：UI完整性审计

> **审计日期**: 2025-07-11  
> **审计范围**: `ThreeKingdomsGame.tsx` 主入口 → `panels/` 实际组件 → `ui/components/` 孤立组件  
> **审计目标**: 找出所有UI完整性问题，建立修复优先级

---

## 一、架构总览

### 主入口 Tab 结构（ThreeKingdomsGame.tsx）

| Tab | ID | available | 渲染组件 | 状态 |
|-----|----|-----------|----------|------|
| 建筑 | `building` | ✅ | `BuildingPanel` | 完整 |
| 武将 | `hero` | ✅ | `HeroTab` | 完整 |
| 科技 | `tech` | ❌ | "敬请期待"占位 | **TechTab 已实现但未接入** |
| 关卡 | `campaign` | ✅ | `CampaignTab` | 完整 |

### panels/ 已实现但主入口未使用的组件

| 组件 | 路径 | 引擎API调用 | 是否被主入口引用 |
|------|------|-------------|-----------------|
| `TechTab` | `panels/tech/TechTab.tsx` | ✅ 完整调用引擎 | ❌ 未接入 |
| `TechResearchPanel` | `panels/tech/TechResearchPanel.tsx` | ✅ | ❌ 未接入 |
| `TechNodeDetailModal` | `panels/tech/TechNodeDetailModal.tsx` | ✅ | ❌ 未接入 |
| `TechOfflinePanel` | `panels/tech/TechOfflinePanel.tsx` | ✅ | ❌ 未接入 |
| `WorldMapTab` | `panels/map/WorldMapTab.tsx` | ✅ | ❌ 主入口无Tab |
| `NPCTab` | `panels/npc/NPCTab.tsx` | ✅ | ❌ 主入口无Tab |
| `EventBanner` | `panels/event/EventBanner.tsx` | ✅ | ❌ 未挂载 |
| `RandomEncounterModal` | `panels/event/RandomEncounterModal.tsx` | ✅ | ❌ 未挂载 |

### 孤立组件（ui/components/）— 全部未被引用

| 组件 | 对应版本 | 功能 | panels/ 是否有对应实现 |
|------|---------|------|----------------------|
| `BuildingPanel` | v1 | 建筑面板（Grid布局） | ✅ panels版更优（地图布局） |
| `HeroListPanel` | v5 | 武将列表 | ✅ HeroTab 更完整 |
| `CampaignMap` | v6 | 关卡地图 | ✅ CampaignTab 更完整 |
| `ResourceBar` | v1 | 资源栏 | ✅ panels版更完整 |
| `RecruitModal` | v5 | 招募弹窗 | ✅ panels版已有 |
| `HeroDetailModal` | v5 | 武将详情 | ✅ panels版已有 |
| `TechTreeView` | v8 | 科技树视图 | ✅ TechTab 更完整 |
| `OfflineRewardModal` | v9 | 离线收益弹窗 | ❌ panels/ 无对应 |
| `OfflineSummary` | v9 | 离线收益汇总 | ❌ panels/ 无对应 |
| `OfflineEstimate` | v9 | 离线预估 | ❌ panels/ 无对应 |
| `ArmyPanel` | v10 | 军队/编队管理 | ❌ panels/ 无对应 |
| `EquipmentBag` | v10 | 装备背包 | ❌ panels/ 无对应 |
| `ArenaPanel` | v11 | 竞技场 | ❌ panels/ 无对应 |
| `PvPBattleResult` | v11 | PvP战斗结果 | ❌ panels/ 无对应 |
| `ExpeditionPanel` | v12 | 远征面板 | ❌ panels/ 无对应 |
| `ExpeditionResult` | v12 | 远征结果 | ❌ panels/ 无对应 |
| `BattleScene` | v6 | 战斗场景 | ✅ panels版有BattleScene |
| `Modal` | 通用 | 通用弹窗 | ✅ panels版各组件自带 |
| `Panel` | 通用 | 通用面板 | ✅ panels版各组件自带 |
| `Toast` | 通用 | 通知组件 | ✅ panels版有独立Toast |
| `ToastProvider` | 通用 | Toast上下文 | ✅ panels版有独立Toast |
| `GameErrorBoundary` | 通用 | 错误边界 | ❌ panels/ 无对应 |
| `TabNav` | 通用 | 底部导航 | ✅ 主入口自带Tab栏 |
| `CalendarDisplay` | v7 | 日历显示 | ✅ 主入口自带日历 |
| `FormationPanel` (hero/) | v5 | 编队面板 | ✅ panels版已有 |
| `StarUpPanel` (hero/) | v5 | 升星面板 | ✅ panels版已有 |
| `BattleSpeedControl` (battle/) | v6 | 战斗速度控制 | ✅ panels版已有 |
| `SweepPanel` (battle/) | v6 | 扫荡面板 | ✅ panels版已有 |

---

## 二、发现问题

### P0 — 阻断性问题

#### [P0-01] 科技Tab已完整实现但主入口标记为不可用
- **描述**: `panels/tech/TechTab.tsx` 已完整实现（包含三路线科技树、研究队列、节点详情弹窗），但 `ThreeKingdomsGame.tsx` 中 `TABS` 配置将 `tech` 设为 `available: false`，渲染"敬请期待"占位
- **文件**: `src/components/idle/ThreeKingdomsGame.tsx` 第 82 行 `{ id: 'tech', icon: '📜', label: '科技', available: false }`
- **影响范围**: 科技系统完全不可达，用户无法使用已开发完成的核心功能
- **修复方案**: 
  1. 将 `available: false` 改为 `available: true`
  2. 在 `renderSceneContent` 的 `case 'tech'` 中导入并渲染 `TechTab` 组件
  3. 添加 `import TechTab from '@/components/idle/panels/tech/TechTab'`

#### [P0-02] 离线收益弹窗完全缺失
- **描述**: 引擎 `engine.load()` 返回 `offlineEarnings` 数据，但主入口仅做了 `if (!offlineEarnings) { engine.init(); }` 判断，从未弹出离线收益弹窗。孤立组件 `OfflineRewardModal` 已实现但未被使用
- **文件**: `src/components/idle/ThreeKingdomsGame.tsx` 第 139-142 行
- **影响范围**: 玩家重新上线后看不到离线收益，无法领取挂机资源，严重影响放置游戏核心体验
- **修复方案**:
  1. 在主入口添加离线收益状态管理
  2. 当 `engine.load()` 返回非空 `offlineEarnings` 时，弹出离线收益弹窗
  3. 可参考孤立组件 `OfflineRewardModal` 的实现，或将其迁移到 panels/ 后接入

#### [P0-03] 孤立组件体系使用完全不同的数据获取模式，无法直接接入主入口
- **描述**: 孤立组件（`ui/components/`）通过 `useGameContext()` 获取 `engine` 和 `snapshot`，而主入口 `ThreeKingdomsGame.tsx` 通过 props 直接传递 `engine` 实例。两套体系不兼容
- **文件**: 
  - `src/games/three-kingdoms/ui/context/GameContext.tsx` — Context 模式
  - `src/components/idle/ThreeKingdomsGame.tsx` — Props 模式
- **影响范围**: 所有孤立组件（23个）均无法在主入口中使用，需要重写数据获取逻辑
- **修复方案**:
  1. **方案A（推荐）**: 为孤立组件创建 props 版本的包装器，将 `useGameContext()` 替换为 props 接收
  2. **方案B**: 在主入口添加 `GameProvider`，使两套体系共存
  3. 优先对离线收益、装备、远征等 panels/ 中缺失的功能进行迁移

---

### P1 — 严重问题

#### [P1-01] 事件系统（EventBanner + RandomEncounterModal）已实现但未挂载
- **描述**: `panels/event/EventBanner.tsx` 和 `RandomEncounterModal.tsx` 已完整实现，包含急报横幅通知和随机遭遇弹窗，但主入口未引入、未挂载、未监听事件
- **文件**: `src/components/idle/panels/event/` 目录
- **影响范围**: 玩家无法收到游戏内事件通知，随机遭遇系统不可达
- **修复方案**:
  1. 在主入口引入 `EventBanner`，放在资源栏下方
  2. 监听引擎事件系统，触发 `RandomEncounterModal`
  3. 添加 `engine.on('event:triggered', ...)` 事件监听

#### [P1-02] 世界地图（WorldMapTab）已实现但主入口无Tab入口
- **描述**: `panels/map/WorldMapTab.tsx` 已完整实现（包含领土信息面板、攻城确认弹窗），但主入口只有4个Tab，没有世界地图入口
- **文件**: `src/components/idle/panels/map/WorldMapTab.tsx`
- **影响范围**: 世界地图、领土争夺、攻城功能完全不可达
- **修复方案**:
  1. 在 `TABS` 数组中添加 `{ id: 'map', icon: '🗺️', label: '天下', available: true }`
  2. 在 `renderSceneContent` 中添加 `case 'map'` 渲染 `WorldMapTab`

#### [P1-03] NPC名册（NPCTab）已实现但主入口无Tab入口
- **描述**: `panels/npc/NPCTab.tsx` 已完整实现（包含NPC对话弹窗、NPC信息弹窗），但主入口无NPC相关入口
- **文件**: `src/components/idle/panels/npc/NPCTab.tsx`
- **影响范围**: NPC系统不可达，玩家无法与NPC交互
- **修复方案**:
  1. 在 `TABS` 数组中添加 `{ id: 'npc', icon: '👤', label: '名士', available: true }`
  2. 在 `renderSceneContent` 中添加 `case 'npc'` 渲染 `NPCTab`

#### [P1-04] 装备系统（EquipmentBag）完全无UI入口
- **描述**: 引擎层 `engine/equipment/` 已完整实现（EquipmentSystem、Forge、Enhance、Set、Recommend 五个子系统），但 panels/ 中无装备相关UI组件。孤立组件 `EquipmentBag` 存在但使用不兼容的数据获取模式
- **文件**: 
  - 引擎: `src/games/three-kingdoms/engine/equipment/`
  - 孤立UI: `src/games/three-kingdoms/ui/components/EquipmentBag.tsx`
- **影响范围**: 装备获取、穿戴、强化、套装、推荐功能完全不可达
- **修复方案**:
  1. 在 `panels/` 下新建 `equipment/` 目录
  2. 参考孤立组件 `EquipmentBag` 的UI设计，使用 props 模式重写
  3. 在武将Tab或新建装备Tab中挂载

#### [P1-05] 竞技场（ArenaPanel）完全无UI入口
- **描述**: 引擎层 `engine/pvp/` 已完整实现（PvPBattleSystem），但 panels/ 中无竞技场UI。孤立组件 `ArenaPanel` 和 `PvPBattleResult` 存在但使用不兼容模式
- **文件**: 
  - 引擎: `src/games/three-kingdoms/engine/pvp/`
  - 孤立UI: `src/games/three-kingdoms/ui/components/ArenaPanel.tsx`
- **影响范围**: PvP竞技、段位、赛季功能完全不可达
- **修复方案**:
  1. 在 `panels/` 下新建 `arena/` 目录
  2. 参考孤立组件 `ArenaPanel` 的UI设计，使用 props 模式重写
  3. 在主入口添加竞技场入口（可放在关卡Tab内或独立Tab）

#### [P1-06] 远征系统（ExpeditionPanel）完全无UI入口
- **描述**: 引擎层 `engine/expedition/` 已完整实现（ExpeditionSystem、BattleSystem、RewardSystem、AutoExpeditionSystem），但 panels/ 中无远征UI。孤立组件 `ExpeditionPanel` 和 `ExpeditionResult` 存在但使用不兼容模式
- **文件**: 
  - 引擎: `src/games/three-kingdoms/engine/expedition/`
  - 孤立UI: `src/games/three-kingdoms/ui/components/ExpeditionPanel.tsx`
- **影响范围**: 远征、自动远征、离线远征功能完全不可达
- **修复方案**:
  1. 在 `panels/` 下新建 `expedition/` 目录
  2. 参考孤立组件 `ExpeditionPanel` 的UI设计，使用 props 模式重写
  3. 在主入口添加远征入口

#### [P1-07] 军队/编队管理（ArmyPanel）孤立组件未接入
- **描述**: 孤立组件 `ArmyPanel` 提供编队管理UI，但使用 `useGameContext()` 和 `engine.getFormations()` 等API。panels/ 中的 `FormationPanel`（在 hero/ 下）已覆盖部分功能，但缺少全军战力汇总、多编队管理等
- **文件**: `src/games/three-kingdoms/ui/components/ArmyPanel.tsx`
- **影响范围**: 多编队管理、全军战力视图缺失
- **修复方案**: 评估 `ArmyPanel` 功能是否已被 `FormationPanel` 覆盖，如未覆盖则迁移

---

### P2 — 一般问题

#### [P2-01] 孤立组件体系（23个组件+测试）为死代码，增加维护负担
- **描述**: `src/games/three-kingdoms/ui/components/` 下共23个组件文件、16个测试文件，全部未被任何地方引用。它们使用 `useGameContext()` + `useDebouncedAction()` 模式，与主入口的 props 传递模式不兼容
- **文件**: `src/games/three-kingdoms/ui/components/` 整个目录
- **影响范围**: 代码库膨胀、新人理解困难、潜在的类型冲突
- **修复方案**:
  1. 逐一评估每个孤立组件是否在 panels/ 中有更好的实现
  2. 对 panels/ 中缺失的功能（装备、竞技场、远征、离线收益），迁移有价值代码到 panels/
  3. 迁移完成后删除整个 `ui/components/` 目录

#### [P2-02] 孤立组件使用 inline styles，panels/ 使用 CSS 文件，风格不统一
- **描述**: 孤立组件全部使用 `style={styles.xxx}` 的 inline styles 模式，而 panels/ 组件使用 `.css` 文件 + className 模式。两种模式混用导致维护困难
- **文件**: 所有 `ui/components/*.tsx` vs `panels/**/*.css`
- **影响范围**: 视觉一致性、主题切换能力、响应式适配
- **修复方案**: 迁移时统一使用 CSS 文件模式

#### [P2-03] 孤立组件的 `useDebouncedAction` hook 未在 panels/ 中使用
- **描述**: 孤立组件广泛使用 `useDebouncedAction` 防抖 hook（如 `ArenaPanel`、`ExpeditionPanel`、`TechTreeView`），但 panels/ 组件未使用此 hook，可能导致快速点击重复操作
- **文件**: `src/games/three-kingdoms/ui/hooks/useDebouncedAction.ts`
- **影响范围**: BuildingPanel 的升级按钮、CampaignTab 的扫荡按钮等可能存在快速点击问题
- **修复方案**: 评估是否在 panels/ 关键操作中也引入防抖

#### [P2-04] 孤立组件 `GameErrorBoundary` 在 panels/ 中无对应实现
- **描述**: 孤立组件体系有 `GameErrorBoundary` 错误边界组件，在 `GameProvider` 中包裹使用。主入口 `ThreeKingdomsGame.tsx` 没有任何错误边界
- **文件**: `src/games/three-kingdoms/ui/components/GameErrorBoundary.tsx`
- **影响范围**: 子组件渲染异常可能导致整个游戏白屏
- **修复方案**: 在主入口添加 React ErrorBoundary

#### [P2-05] 孤立组件 `CalendarDisplay` 功能比主入口日历更丰富
- **描述**: 孤立组件 `CalendarDisplay` 包含季节加成显示、年度进度条、暂停标记等功能。主入口的日历仅显示年号/季节/天气/日期
- **文件**: 
  - 孤立: `src/games/three-kingdoms/ui/components/common/CalendarDisplay.tsx`
  - 主入口: `src/components/idle/ThreeKingdomsGame.tsx` 日历部分
- **影响范围**: 玩家看不到季节加成效果信息
- **修复方案**: 将季节加成信息集成到主入口日历区域

#### [P2-06] 主入口缺少保存/存档相关UI反馈
- **描述**: 引擎有 `engine.save()` / `engine.load()` 方法，但主入口无任何保存状态提示（如"已保存"、"上次保存时间"等）
- **文件**: `src/components/idle/ThreeKingdomsGame.tsx`
- **影响范围**: 玩家不确定游戏进度是否已保存
- **修复方案**: 添加自动保存提示、上次保存时间显示

#### [P2-07] 孤立组件 `OfflineSummary` 和 `OfflineEstimate` 提供离线收益详情功能
- **描述**: 这两个孤立组件分别提供离线收益汇总视图和离线收益预估功能。在 panels/ 中无对应实现
- **文件**: 
  - `src/games/three-kingdoms/ui/components/OfflineSummary.tsx`
  - `src/games/three-kingdoms/ui/components/OfflineEstimate.tsx`
- **影响范围**: 玩家无法预估离线收益，无法查看历史离线收益汇总
- **修复方案**: 配合 P0-02 离线收益弹窗一起迁移

#### [P2-08] 孤立组件 `TabNav` 提供底部导航模式，与主入口顶部Tab不同
- **描述**: 孤立组件 `TabNav` 设计为移动端底部导航（5个Tab：主城/武将/出征/科技/更多），而主入口使用顶部Tab栏（4个Tab）。两种导航模式不兼容
- **文件**: `src/games/three-kingdoms/ui/components/TabNav.tsx`
- **影响范围**: 移动端适配可能需要底部导航
- **修复方案**: 评估是否在移动端响应式布局中切换为底部导航

---

## 三、功能覆盖矩阵

### 引擎系统 vs UI可达性

| 引擎系统 | 引擎模块 | panels/ 有UI | 主入口可达 | 孤立组件有UI |
|---------|---------|-------------|-----------|-------------|
| 建筑 | `engine/building/` | ✅ BuildingPanel | ✅ | ✅ (重复) |
| 资源 | `engine/building/` | ✅ ResourceBar | ✅ | ✅ (重复) |
| 武将 | `engine/hero/` | ✅ HeroTab | ✅ | ✅ (重复) |
| 关卡 | `engine/campaign/` | ✅ CampaignTab | ✅ | ✅ (重复) |
| 科技 | `engine/tech/` | ✅ TechTab | ❌ **P0-01** | ✅ (重复) |
| 日历 | `engine/calendar/` | ✅ 主入口内联 | ✅ | ✅ (重复) |
| 事件 | `engine/event/` | ✅ EventBanner等 | ❌ **P1-01** | ❌ |
| 世界地图 | `engine/map/` | ✅ WorldMapTab | ❌ **P1-02** | ❌ |
| NPC | `engine/npc/` | ✅ NPCTab | ❌ **P1-03** | ❌ |
| 离线收益 | `engine/offline/` | ❌ | ❌ **P0-02** | ✅ |
| 装备 | `engine/equipment/` | ❌ | ❌ **P1-04** | ✅ |
| 竞技场 | `engine/pvp/` | ❌ | ❌ **P1-05** | ✅ |
| 远征 | `engine/expedition/` | ❌ | ❌ **P1-06** | ✅ |
| 编队管理 | `engine/hero/` | ✅ FormationPanel | ✅ | ✅ (部分重复) |
| 成就 | `engine/achievement/` | ❌ | ❌ | ❌ |
| 联盟 | `engine/alliance/` | ❌ | ❌ | ❌ |
| 商店 | `engine/shop/` | ❌ | ❌ | ❌ |
| 任务 | `engine/quest/` | ❌ | ❌ | ❌ |
| 签到 | `engine/activity/` | ❌ | ❌ | ❌ |
| 谋士 | `engine/advisor/` | ❌ | ❌ | ❌ |
| 情义 | `engine/bond/` | ❌ | ❌ | ❌ |
| 货币 | `engine/currency/` | ❌ | ❌ | ❌ |
| 排行榜 | `engine/leaderboard/` | ❌ | ❌ | ❌ |
| 邮件 | `engine/mail/` | ❌ | ❌ | ❌ |
| 交易 | `engine/trade/` | ❌ | ❌ | ❌ |
| 社交 | `engine/social/` | ❌ | ❌ | ❌ |
| 设置 | `engine/settings/` | ❌ | ❌ | ❌ |
| 传承 | `engine/heritage/` | ❌ | ❌ | ❌ |
| 统一 | `engine/unification/` | ❌ | ❌ | ❌ |

---

## 四、修复计划

### Phase 1: 紧急修复（P0，预计 1-2 天）

| # | 任务 | 关联问题 | 工作量 |
|---|------|---------|--------|
| 1 | 科技Tab接入主入口 | P0-01 | 0.5h |
| 2 | 离线收益弹窗实现 | P0-02 | 4h |
| 3 | 确定孤立组件迁移策略 | P0-03 | 2h |

### Phase 2: 核心功能补全（P1，预计 3-5 天）

| # | 任务 | 关联问题 | 工作量 |
|---|------|---------|--------|
| 4 | 事件系统挂载 | P1-01 | 3h |
| 5 | 世界地图Tab接入 | P1-02 | 2h |
| 6 | NPC名册Tab接入 | P1-03 | 2h |
| 7 | 装备系统UI迁移 | P1-04 | 8h |
| 8 | 竞技场UI迁移 | P1-05 | 8h |
| 9 | 远征系统UI迁移 | P1-06 | 8h |
| 10 | 军队管理评估与迁移 | P1-07 | 4h |

### Phase 3: 清理优化（P2，预计 2-3 天）

| # | 任务 | 关联问题 | 工作量 |
|---|------|---------|--------|
| 11 | 孤立组件目录清理 | P2-01 | 4h |
| 12 | 样式体系统一 | P2-02 | 随迁移完成 |
| 13 | 防抖hook评估引入 | P2-03 | 2h |
| 14 | ErrorBoundary添加 | P2-04 | 1h |
| 15 | 日历增强 | P2-05 | 2h |
| 16 | 保存反馈UI | P2-06 | 1h |

---

## 五、验证方法

### P0 验证

1. **P0-01 科技Tab**: 启动游戏 → 点击"科技"Tab → 确认科技树三路线正常渲染 → 点击节点确认详情弹窗 → 发起研究确认进度条
2. **P0-02 离线收益**: 进入游戏 → 等待资源积累 → 关闭页面 → 等待30秒 → 重新打开 → 确认弹出离线收益弹窗 → 领取确认资源增加
3. **P0-03 数据模式**: 确认所有迁移后的组件使用 props 模式，不依赖 `useGameContext()`

### P1 验证

4. **P1-01 事件系统**: 触发引擎事件 → 确认 EventBanner 出现 → 点击确认 RandomEncounterModal 弹出
5. **P1-02 世界地图**: 点击"天下"Tab → 确认世界地图渲染 → 点击城池确认攻城弹窗
6. **P1-03 NPC**: 点击"名士"Tab → 确认NPC列表 → 点击NPC确认对话弹窗
7. **P1-04 装备**: 打开装备面板 → 确认装备列表/筛选/穿戴功能正常
8. **P1-05 竞技场**: 打开竞技场 → 确认段位/对手/挑战功能正常
9. **P1-06 远征**: 打开远征 → 确认路线/队伍/出发功能正常

### 代码验证

```bash
# 确认孤立组件不再被引用
grep -r "from.*three-kingdoms/ui/components" src/ | wc -l
# 预期结果: 0

# 确认所有Tab均可用
grep "available: false" src/components/idle/ThreeKingdomsGame.tsx
# 预期结果: 无匹配（或仅保留有意不开放的Tab）

# 运行全量测试
npm test
```

---

## 六、两套UI体系差异对照

| 维度 | panels/（主入口使用） | ui/components/（孤立） |
|------|----------------------|----------------------|
| 数据获取 | props 直接传递 engine | `useGameContext()` Context |
| 样式方案 | CSS 文件 + className | inline styles 对象 |
| 防抖处理 | 无 | `useDebouncedAction` hook |
| 错误边界 | 无 | `GameErrorBoundary` |
| Toast | 独立 `common/Toast` | `ToastProvider` + `useToast` |
| 测试覆盖 | 有（各目录下 `__tests__/`） | 有（`__tests__/` 下） |
| 组件粒度 | 细粒度（每个功能独立组件） | 细粒度（同样独立） |
| 响应式 | CSS media query | inline 条件判断 |
| 组件质量 | 较高（地图布局、动画等） | 基础（Grid/List 布局） |

---

## 七、结论

当前主入口仅覆盖了 4/30+ 引擎系统的UI，大量已实现的功能（科技、事件、地图、NPC、离线收益、装备、竞技场、远征）处于不可达状态。同时存在两套完全独立的UI体系，增加了约 **40+ 文件**的死代码。

**最高优先级修复**:
1. 科技Tab一行代码即可开放（P0-01）
2. 离线收益弹窗是放置游戏核心体验（P0-02）
3. 确定孤立组件迁移策略后逐步补全（P0-03 → P1系列）
