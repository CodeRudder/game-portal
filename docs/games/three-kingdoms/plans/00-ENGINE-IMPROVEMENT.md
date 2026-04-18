# 三国霸业游戏引擎改进计划

> **创建日期**: 2026-04-19
> **目标**: 将游戏引擎从扁平架构升级为4层架构，添加测试子系统，支撑20版本迭代开发
> **关联文档**: [架构调整方案](./00-ARCHITECTURE-REFACTOR.md) | [测试子系统方案](./00-TEST-SUBSYSTEM.md) | [版本路线图](./00-VERSION-ROADMAP.md)

---

## 一、改进总览

### 1.1 现状

| 维度 | 现状 | 问题 |
|------|------|------|
| 架构 | 39文件扁平结构 | 无分层，耦合严重 |
| 核心引擎 | ThreeKingdomsEngine.ts 2,902行 | God Object，持有35个子系统 |
| UI组件 | ThreeKingdomsPixiGame.tsx 6,077行 | 巨型组件，247个函数 |
| CSS | 单文件 5,054行 | 无模块化 |
| 测试 | 27个测试文件，12模块无测试 | 覆盖率~69% |
| 渲染 | PixiJS内嵌在UI组件中 | 无法独立测试 |

### 1.2 目标

| 维度 | 目标 | 指标 |
|------|------|------|
| 架构 | 4层分层架构 | L1/L2/L3/L4 各层独立 |
| 核心引擎 | Facade模式，<500行 | 单文件<500行 |
| UI组件 | ~15个子组件 | 每个组件<400行 |
| 测试 | 覆盖率>90% | 含RuntimeValidator+UITreeExtractor |
| 渲染 | 独立渲染层 | 可替换渲染器 |

---

## 二、架构调整计划

> 详细方案见 [00-ARCHITECTURE-REFACTOR.md](./00-ARCHITECTURE-REFACTOR.md)

### 2.1 四层架构

```
┌─────────────────────────────────────┐
│  L3 游戏UI层 (ui/)                  │  React组件，通过mock测试
├─────────────────────────────────────┤
│  L4 游戏渲染层 (rendering/)         │  PixiJS渲染，独立可测
├─────────────────────────────────────┤
│  L2 游戏逻辑层 (systems/)           │  6领域分组，独立可测
├─────────────────────────────────────┤
│  L1 内核/子系统/基础设施 (core/)     │  Facade+通用子系统
└─────────────────────────────────────┘
```

### 2.2 迁移6阶段

| 阶段 | 内容 | 预估 |
|------|------|------|
| M1 | 创建目录结构+类型定义+接口 | 1天 |
| M2 | 拆分L2子系统（从Engine.ts提取） | 2天 |
| M3 | 拆分L4渲染器 | 1天 |
| M4 | 重构L1内核（Engine→Facade） | 2天 |
| M5 | 拆分L3 UI组件（从PixiGame.tsx提取） | 2天 |
| M6 | 更新import+测试+验证 | 2天 |

---

## 三、测试子系统计划

> 详细方案见 [00-TEST-SUBSYSTEM.md](./00-TEST-SUBSYSTEM.md)

### 3.1 三大测试能力

| 能力 | 组件 | 用途 |
|------|------|------|
| 单元测试 | Jest + 自定义Matchers | 每层独立测试，L3可mock L2 |
| 运行时测试 | RuntimeValidator | 检测资源非负/建筑合法/战斗合理等12+规则 |
| UI组件树 | UITreeExtractor | 提取组件层级树，供自测和评测使用 |

### 3.2 UITreeExtractor 输出示例

```json
{
  "id": "game-root",
  "type": "GameContainer",
  "position": { "x": 0, "y": 0 },
  "size": { "width": 1280, "height": 696 },
  "state": { "activeTab": "map" },
  "children": [
    {
      "id": "resource-bar",
      "type": "ResourceBar",
      "position": { "x": 0, "y": 0 },
      "size": { "width": 1280, "height": 48 },
      "state": { "food": 1500, "gold": 800, "troops": 200, "destiny": 50 },
      "children": []
    }
  ]
}
```

---

## 四、各Phase引擎能力需求

### 4.1 Phase 1 — 核心框架 (v1.0~v4.0)

| 子系统 | 版本 | 职责 | 依赖 | 状态 |
|--------|------|------|------|------|
| ResourceEngine | v1.0 | 4资源产出/消耗/上限管理 | L1 Core | 改进 |
| BuildingEngine | v1.0 | 8建筑升级/产出/解锁 | ResourceEngine | 改进 |
| SaveEngine | v1.0 | localStorage序列化/反序列化 | L1 Core | 新增 |
| TickEngine | v1.0 | 游戏主循环tick，离线时间计算 | L1 Core | 改进 |
| GeneralEngine | v2.0 | 武将招募/升级/属性/技能 | ResourceEngine | 改进 |
| AssignmentEngine | v2.0 | 武将派遣到建筑的加成计算 | GeneralEngine, BuildingEngine | 新增 |
| BattleEngine | v3.0 | 自动战斗/属性对比/伤害计算 | GeneralEngine | 改进 |
| CampaignEngine | v3.0 | 关卡地图/解锁/星级评定 | BattleEngine | 改进 |
| FormationEngine | v3.0 | 武将编队/阵位/站位加成 | GeneralEngine, BattleEngine | 新增 |
| StarRatingEngine | v3.0 | 1~3星评定/扫荡 | CampaignEngine, BattleEngine | 新增 |
| TechEngine | v4.0 | 3路线科技树/研究/互斥分支 | ResourceEngine | 改进 |
| TechEffectEngine | v4.0 | 科技效果应用/全局加成 | TechEngine | 新增 |
| GeneralStarUpEngine | v4.0 | 武将升星/碎片收集 | GeneralEngine | 新增 |

### 4.2 Phase 2 — 世界探索 (v5.0~v7.0)

| 子系统 | 版本 | 职责 | 依赖 | 状态 |
|--------|------|------|------|------|
| MapEngine | v5.0 | 世界地图渲染/缩放/拖拽/城池 | L4 Rendering | 改进 |
| TerritoryEngine | v5.0 | 领土占领/势力范围/产出 | MapEngine, ResourceEngine | 改进 |
| NPCEngine | v6.0 | NPC巡逻/交互/日程/对话 | MapEngine | 改进 |
| EventEngine | v6.0 | 随机事件/触发条件/奖励 | L1 Core | 改进 |
| QuestEngine | v7.0 | 任务系统/日常/成就型任务 | EventEngine | 改进 |
| ChainEventEngine | v7.0 | 连锁事件/事件链触发 | EventEngine | 新增 |

### 4.3 Phase 3 — 经济体系 (v8.0~v10.0)

| 子系统 | 版本 | 职责 | 依赖 | 状态 |
|--------|------|------|------|------|
| ShopEngine | v8.0 | 商品列表/购买/刷新/限时 | ResourceEngine | 新增 |
| CurrencyEngine | v8.0 | 多货币体系/汇率/转换 | ResourceEngine | 新增 |
| TradeEngine | v8.0 | 商路派遣/自动往返/获利 | MapEngine, CurrencyEngine | 改进 |
| OfflineEngine | v9.0 | 离线收益计算/回归奖励 | ResourceEngine, TickEngine | 改进 |
| MailEngine | v9.0 | 邮件系统/系统通知/奖励领取 | L1 Core | 新增 |
| ResourceProtectEngine | v9.0 | 资源保护/存储上限 | ResourceEngine | 新增 |
| EquipmentEngine | v10.0 | 装备穿戴/卸下/属性加成 | GeneralEngine | 新增 |
| ForgeEngine | v10.0 | 铁匠铺强化/材料消耗/成功率 | EquipmentEngine, ResourceEngine | 新增 |
| SetEffectEngine | v10.0 | 套装效果/集齐判定 | EquipmentEngine | 新增 |

### 4.4 Phase 4 — 社交竞技 (v11.0~v14.0)

| 子系统 | 版本 | 职责 | 依赖 | 状态 |
|--------|------|------|------|------|
| PVPEngine | v11.0 | 竞技场匹配/战斗/排名 | BattleEngine | 新增 |
| LeaderboardEngine | v11.0 | 排行榜/赛季刷新/奖励 | L1 Core | 新增 |
| SocialEngine | v12.0 | 好友/聊天/赠送 | L1 Core | 新增 |
| ExpeditionEngine | v12.0 | 远征派遣/自动探索/奖励 | GeneralEngine, MapEngine | 新增 |
| AllianceEngine | v13.0 | 联盟创建/加入/加成/捐献 | SocialEngine | 新增 |
| SeasonEngine | v13.0 | 赛季系统/重置/奖励 | LeaderboardEngine | 新增 |
| ActivityEngine | v13.0 | 限时活动/签到/累计奖励 | L1 Core | 新增 |
| PrestigeEngine | v14.0 | 声望转生/永久加成/重置 | L1 Core | 改进 |
| AchievementEngine | v14.0 | 成就定义/进度/奖励 | L1 Core | 新增 |

### 4.5 Phase 5~6 — 长线养成+体验优化 (v15.0~v20.0)

| 子系统 | 版本 | 职责 | 依赖 | 状态 |
|--------|------|------|------|------|
| StoryEventEngine | v15.0 | 武将剧情事件/触发/分支 | GeneralEngine, EventEngine | 改进 |
| BondEngine | v16.0 | 武将羁绊/组合加成 | GeneralEngine | 改进 |
| InheritEngine | v16.0 | 传承系统/属性继承 | PrestigeEngine, GeneralEngine | 新增 |
| ResponsiveEngine | v17.0 | 响应式布局/断点适配 | L3 UI, L4 Rendering | 新增 |
| TouchEngine | v17.0 | 触控优化/手势识别 | L3 UI | 新增 |
| TutorialEngine | v18.0 | 引导状态机/步骤管理/高亮遮罩 | L1 Core | 改进 |
| AudioEngine | v19.0 | BGM/音效/程序化音频 | L1 Core | 改进 |
| SettingsEngine | v19.0 | 设置持久化/导入导出 | SaveEngine | 新增 |
| BalanceEngine | v20.0 | 数值平衡/经济校验 | ResourceEngine, all | 新增 |
| PerformanceEngine | v20.0 | 性能监控/帧率优化/内存管理 | L1 Core | 新增 |

---

## 五、子系统汇总统计

| 分类 | 新增 | 改进 | 合计 |
|------|------|------|------|
| Phase 1 核心框架 | 6 | 7 | 13 |
| Phase 2 世界探索 | 2 | 4 | 6 |
| Phase 3 经济体系 | 7 | 2 | 9 |
| Phase 4 社交竞技 | 8 | 1 | 9 |
| Phase 5~6 长线优化 | 6 | 4 | 10 |
| **合计** | **29** | **18** | **47** |

---

## 六、执行计划

### 6.1 阶段A：架构调整+测试子系统（先于版本开发）

```
Week 1: M1 目录结构+接口定义 + M2 L2子系统拆分
Week 2: M3 L4渲染器拆分 + M4 L1内核重构
Week 3: M5 L3 UI组件拆分 + M6 验证+测试
```

**阶段A验收**：
- [ ] 4层目录结构创建完成
- [ ] Engine.ts < 500行（Facade模式）
- [ ] PixiGame.tsx < 500行（拆分为~15子组件）
- [ ] 所有现有测试通过
- [ ] RuntimeValidator可运行
- [ ] UITreeExtractor可提取组件树

### 6.2 阶段B：v1.0~v4.0 引擎能力开发（与版本开发同步）

每个版本开发时同步添加/改进对应的子系统。

### 6.3 阶段C：后续版本按需迭代

v5.0起每个版本的"游戏引擎需求"部分明确列出需要的子系统，开发时同步实现。

---

## 七、验收标准

### 7.1 架构验收
- [ ] 4层目录结构完整（core/systems/ui/rendering）
- [ ] 单文件 < 500行
- [ ] 层间依赖方向正确（L3→L2→L1，L4→L1，L3↔L4通过接口）
- [ ] 每层可独立编译

### 7.2 测试验收
- [ ] 游戏引擎内核及基础设施测试覆盖率 > 90%
- [ ] 每个子系统有独立单元测试
- [ ] L3 UI层可通过mock进行单元测试
- [ ] RuntimeValidator可检测12+种异常状态
- [ ] UITreeExtractor可提取完整组件层级树

### 7.3 CSS模块化方案

现有CSS单文件5,054行需按组件拆分：

```
src/games/three-kingdoms/
├── ui/
│   ├── styles/
│   │   ├── variables.css          — 全局变量（颜色/字号/间距/动画）
│   │   ├── base.css               — 基础重置+通用样式
│   │   ├── resource-bar.css       — 资源栏组件样式
│   │   ├── building-panel.css     — 建筑面板样式
│   │   ├── hero-panel.css         — 武将面板样式
│   │   ├── tech-panel.css         — 科技面板样式
│   │   ├── campaign-panel.css     — 关卡面板样式
│   │   ├── map-view.css           — 地图视图样式
│   │   ├── combat-view.css        — 战斗视图样式
│   │   ├── dialog.css             — 弹窗/对话框样式
│   │   ├── tutorial.css           — 新手引导样式
│   │   └── mobile.css             — 手机端适配样式
```

拆分原则：
- 每个L3 UI组件对应一个CSS文件
- 全局变量（颜色/字号/间距）提取到 variables.css
- 手机端适配规则统一在 mobile.css 中用媒体查询
- 目标：每个CSS文件 < 400行

### 7.4 L3↔L4接口契约

```typescript
/** L3 UI层 → L4渲染层的渲染请求接口 */
interface IRenderRequest {
  type: 'sprite' | 'text' | 'shape' | 'container';
  id: string;
  props: Record<string, unknown>;
  children?: IRenderRequest[];
}

/** L4渲染层 → L3 UI层的事件回调接口 */
interface IRenderEvent {
  type: 'click' | 'hover' | 'drag' | 'animation-end';
  targetId: string;
  data: Record<string, unknown>;
}

/** L3↔L4双向交互接口 */
interface IUIRendererBridge {
  /** L3→L4: 提交渲染请求 */
  submitRender(request: IRenderRequest): void;
  /** L3→L4: 更新渲染元素 */
  updateRender(id: string, props: Partial<IRenderRequest>): void;
  /** L3→L4: 移除渲染元素 */
  removeRender(id: string): void;
  /** L4→L3: 注册事件监听 */
  onRenderEvent(callback: (event: IRenderEvent) => void): void;
}
```

### 7.5 功能验收
- [ ] 100%符合游戏引擎改进计划文档的要求
- [ ] 满足单元测试及运行时测试提取UI组件层级树
- [ ] 真正能投入评测游戏使用
- [ ] 所有现有功能不丢失

---

## 附录：文件清单

| 文件 | 说明 |
|------|------|
| [00-ARCHITECTURE-ANALYSIS.md](./00-ARCHITECTURE-ANALYSIS.md) | 架构调研报告 |
| [00-ARCHITECTURE-REFACTOR.md](./00-ARCHITECTURE-REFACTOR.md) | 4层架构调整方案 |
| [00-TEST-SUBSYSTEM.md](./00-TEST-SUBSYSTEM.md) | 测试子系统方案 |
| [00-FEATURE-INVENTORY.md](./00-FEATURE-INVENTORY.md) | 功能清单 |
| [00-VERSION-ROADMAP.md](./00-VERSION-ROADMAP.md) | 20版本路线图 |
| [00-ENGINE-IMPROVEMENT.md](./00-ENGINE-IMPROVEMENT.md) | 本文件 |
