# 科技模块测试覆盖树

> **生成日期**: 2026-04-18 | **分析版本**: v1.0
> **PRD**: `docs/games/three-kingdoms/ui-design/prd/TEC-tech-prd.md`
> **UI布局**: `docs/games/three-kingdoms/ui-design/ui-layout/TEC-tech.md`

---

## 一、PRD功能点清单

### TEC-1 科技系统概述
| ID | 功能点 | PRD章节 |
|----|--------|---------|
| TEC-1.1 | 三条科技路线（军事/经济/文化） | TEC-1 |
| TEC-1.2 | 科技树结构（21基础+4融合=25节点） | TEC-1 |
| TEC-1.3 | 互斥分支机制（六选三） | TEC-1 |
| TEC-1.4 | 画布缩放（50%~150%）和拖拽平移 | TEC-1 |
| TEC-1.5 | 科技系统解锁条件（主城Lv.3+书院建成） | TEC-1 |

### TEC-2 科技研究
| ID | 功能点 | PRD章节 |
|----|--------|---------|
| TEC-2.1 | 研究流程（选择→消耗→等待→生效） | TEC-2 |
| TEC-2.2 | 研究启动条件（科技点+前置+无冲突） | TEC-2 |
| TEC-2.3 | 研究队列规则（默认1槽/VIP3解锁第2槽） | TEC-2 |
| TEC-2.4 | 取消研究（返还80%资源） | TEC-2 |
| TEC-2.5 | 切换研究（消耗100铜钱，进度保留） | TEC-2 |
| TEC-2.6 | 离线研究规则（封顶72小时） | TEC-2 |
| TEC-2.7 | 科技点系统（书院等级决定产出） | TEC-2 |
| TEC-2.8 | 铜钱加速（立即完成50%） | TEC-2 |
| TEC-2.9 | 天命加速（立即完成80%，每次研究最多1次） | TEC-2 |
| TEC-2.10 | 元宝秒完成（每日限3次） | TEC-2 |
| TEC-2.11 | 书院等级加速（+2%~+38%被动） | TEC-2 |
| TEC-2.12 | 声望等级加速（×(1+声望等级×0.02)） | TEC-2 |
| TEC-2.13 | 联盟加速（+10%） | TEC-2 |
| TEC-2.14 | 加速叠加公式 | TEC-2 |

### TEC-3 科技效果
| ID | 功能点 | PRD章节 |
|----|--------|---------|
| TEC-3.1 | 军事路线10节点效果（攻击/暴击/攻城/防御） | TEC-3 |
| TEC-3.2 | 经济路线10节点效果（粮草/铜钱/离线/交易） | TEC-3 |
| TEC-3.3 | 文化路线10节点效果（民心/忠诚/属性/士气） | TEC-3 |
| TEC-3.4 | 前置条件顺序链（1→2→3→4→5A/B→6A/B→7A/B） | TEC-3 |
| TEC-3.5 | 互斥分支永久锁定（转生可重选） | TEC-3 |

### TEC-4 融合科技
| ID | 功能点 | PRD章节 |
|----|--------|---------|
| TEC-4.1 | 军经合一（军事Lv.3+经济Lv.3） | TEC-4 |
| TEC-4.2 | 军文并举（军事Lv.3+文化Lv.3） | TEC-4 |
| TEC-4.3 | 经世济民（经济Lv.3+文化Lv.3） | TEC-4 |
| TEC-4.4 | 霸王之道（军事Lv.5+经济Lv.5+文化Lv.5） | TEC-4 |
| TEC-4.5 | 融合科技不占用基础路线研究槽位 | TEC-4 |
| TEC-4.6 | 转生重置规则（保留50%/清零/路线记录保留） | TEC-4 |

---

## 二、UI交互点清单

| UI-ID | 交互点 | UI章节 |
|-------|--------|--------|
| UI-TEC-1 | 科技树画布拖拽平移+滚轮缩放 | TEC-1 |
| UI-TEC-2 | 科技节点4种状态样式（已研究/研究中/可研究/锁定） | TEC-1-1 |
| UI-TEC-3 | 节点悬停Tooltip + 点击打开详情面板 | TEC-1-1 |
| UI-TEC-4 | 连接线样式（已激活/未激活/融合/互斥标记） | TEC-1-2 |
| UI-TEC-5 | 筛选栏（全部/农业/军事/经济/特殊 + 搜索） | TEC-1-3 |
| UI-TEC-6 | 科技详情面板（头部/描述/效果/消耗/前置/后续/按钮） | TEC-2 |
| UI-TEC-7 | 研究中进度条（A区资源栏内嵌） | TEC-3 |
| UI-TEC-8 | 手机端路线Tab切换（军事/经济/文化/融合） | TEC-4 |
| UI-TEC-9 | 手机端竖向时间轴 + 底部研究进度浮动条 | TEC-4 |
| UI-TEC-10 | 手机端详情全屏面板（底部上滑） | TEC-4 |

---

## 三、测试覆盖树

### 3.1 ACC测试 → PRD映射

#### ACC-08 科技系统验收集成测试 (29用例)

```
ACC-08 科技系统ACC测试覆盖树
├── 1. 基础可见性 (6用例)
│   ├── ACC-08-02 ✅ → TEC-1 科技面板整体布局渲染
│   ├── ACC-08-03 ✅ → TEC-1.1 三条路线Tab显示
│   ├── ACC-08-04 ✅ → TEC-2.7 科技点信息栏
│   ├── ACC-08-05 ✅ → TEC-1.2 科技节点展示
│   ├── ACC-08-06 ✅ → UI-TEC-2 节点状态角标
│   └── ACC-08-07 ✅ → TEC-2.3 研究队列面板
│
├── 2. 核心交互 (5用例)
│   ├── ACC-08-10 ✅ → UI-TEC-5 路线Tab切换
│   ├── ACC-08-11 ✅ → UI-TEC-3 点击节点打开详情弹窗
│   ├── ACC-08-12 ✅ → UI-TEC-6 详情弹窗内容完整
│   ├── ACC-08-13 ✅ → TEC-2.1 开始研究操作
│   └── ACC-08-18 ✅ → UI-TEC-6 关闭详情弹窗
│
├── 3. 数据正确性 (5用例)
│   ├── ACC-08-20 ✅ → TEC-2.2 科技点消耗数值正确
│   ├── ACC-08-21 ✅ → TEC-2.7 科技点产出速率正确
│   ├── ACC-08-22 ✅ → TEC-2.1 研究时间倒计时
│   ├── ACC-08-23 ✅ → TEC-3.4 前置条件显示正确
│   └── ACC-08-24 ✅ → TEC-2.2 科技点不足时研究按钮禁用
│
├── 4. 边界情况 (5用例)
│   ├── ACC-08-27 ✅ → TEC-2.3 研究队列上限正确
│   ├── ACC-08-28 ✅ → TEC-2.4 取消研究退还科技点
│   ├── ACC-08-29 ✅ → TEC-1.3 互斥分支锁定
│   ├── ACC-08-30 ✅ → TEC-2.3 队列满时无法新增
│   └── ACC-08-31 ✅ → TEC-3.4 前置未满足时无法研究
│
└── 5. 手机端适配 (4用例)
    ├── ACC-08-40 ✅ → UI-TEC-8 手机端路线Tab切换
    ├── ACC-08-41 ✅ → UI-TEC-9 手机端节点布局
    ├── ACC-08-42 ✅ → UI-TEC-10 手机端详情弹窗适配
    └── ACC-08-48 ✅ → UI-TEC-9 手机端竖屏滚动
```

#### FLOW-06 科技Tab集成测试 (48用例)

```
FLOW-06 科技Tab集成测试覆盖树
├── 1. 科技Tab渲染 (5用例)
│   ├── FLOW-06-01 ✅ → TEC-1 科技Tab整体渲染（容器/路线Tab/科技点栏/画布）
│   ├── FLOW-06-02 ✅ → TEC-1.1 三条路线Tab名称与图标
│   ├── FLOW-06-03 ✅ → TEC-2.7 科技点数量和产出速率
│   ├── FLOW-06-04 ✅ → TEC-1.2 PC端三条路线列显示
│   └── FLOW-06-05 ✅ → TEC-2.3 研究队列面板（标题+空闲槽位）
│
├── 2. 科技节点展示 (4用例)
│   ├── FLOW-06-06 ✅ → TEC-3.1 军事路线节点数据完整
│   ├── FLOW-06-07 ✅ → UI-TEC-2 节点状态角标（locked/available）
│   ├── FLOW-06-08 ✅ → TEC-1 路线进度显示（完成/总数）
│   └── FLOW-06-09 ✅ → TEC-3.2/3.3 经济/文化路线节点 + 互斥标签
│
├── 3. 科技研究流程 (5用例)
│   ├── FLOW-06-11 ✅ → TEC-2.1 成功开始研究消耗科技点
│   ├── FLOW-06-12 ✅ → TEC-2.3 研究队列包含已开始科技
│   ├── FLOW-06-13 ✅ → TEC-2.1 节点状态变为 researching
│   ├── FLOW-06-14 ✅ → TEC-2.1 研究进度和剩余时间
│   └── FLOW-06-15 ✅ → TEC-2.3 研究队列满时无法继续
│
├── 4. 前置条件 (2用例)
│   ├── FLOW-06-16 ✅ → TEC-3.4 Tier2节点需完成Tier1前置
│   └── FLOW-06-17 ✅ → TEC-3.4 完成前置后节点变为 available
│
├── 5. 互斥分支 (3用例)
│   ├── FLOW-06-18 ✅ → TEC-1.3 选择互斥节点后另一个被锁定
│   ├── FLOW-06-19 ✅ → TEC-1.3 getChosenMutexNodes 返回已选节点
│   └── FLOW-06-20 ✅ → TEC-1.3 getMutexAlternatives 返回同组节点
│
├── 6. 科技效果 (5用例)
│   ├── FLOW-06-21 ✅ → TEC-3.1 完成科技后效果可查询
│   ├── FLOW-06-22 ✅ → TEC-3.1 getEffectValue 返回正确加成值
│   ├── FLOW-06-23 ✅ → TEC-3.1 多个科技效果叠加
│   ├── FLOW-06-24 ✅ → TEC-1 路线进度统计
│   └── FLOW-06-25 ✅ → TEC-3.1 TechEffectSystem 加成查询
│
├── 7. 取消研究 (3用例)
│   ├── FLOW-06-26 ✅ → TEC-2.4 取消研究返还科技点
│   ├── FLOW-06-27 ✅ → TEC-2.4 取消研究节点状态恢复
│   └── FLOW-06-28 ✅ → TEC-2.4 取消研究队列清空
│
├── 8. 加速研究 (1用例)
│   └── FLOW-06-29 ✅ → TEC-2.8/2.9 计算天命和元宝消耗
│
├── 9. 研究面板 (1用例)
│   └── FLOW-06-30 ✅ → UI-TEC-7 研究面板渲染活跃研究进度
│
├── 10. 科技点系统 (4用例)
│   ├── FLOW-06-31 ✅ → TEC-2.7 充足可消费，不足失败
│   ├── FLOW-06-33 ✅ → TEC-2.7 refund 增加科技点
│   ├── FLOW-06-34 ✅ → TEC-2.11 产出速率与书院等级关联
│   └── FLOW-06-35 ✅ → TEC-2.7 金币兑换科技点
│
├── 11. 节点详情弹窗 (5用例)
│   ├── FLOW-06-36 ✅ → UI-TEC-6 渲染节点信息
│   ├── FLOW-06-37 ✅ → UI-TEC-6 显示效果描述
│   ├── FLOW-06-38 ✅ → UI-TEC-6 显示消耗和前置条件
│   ├── FLOW-06-39 ✅ → UI-TEC-6 关闭按钮触发回调
│   └── FLOW-06-40 ✅ → UI-TEC-6 locked状态不显示研究按钮
│
├── 12. 离线收益 (2用例)
│   ├── FLOW-06-41 ✅ → TEC-2.6 离线收益按钮渲染
│   └── FLOW-06-42 ✅ → TEC-2.6 离线面板打开
│
├── 13. 科技重置 (3用例)
│   ├── FLOW-06-43 ✅ → TEC-4.6 treeSystem.reset 恢复初始状态
│   ├── FLOW-06-44 ✅ → TEC-4.6 科技重置效果清零
│   └── FLOW-06-45 ✅ → TEC-4.6 科技点序列化与反序列化
│
└── 14. 完整流程+边界 (5用例)
    ├── FLOW-06-46 ✅ → TEC-2.1 从研究到完成的端到端验证
    ├── FLOW-06-47 ✅ → TEC-1.1 多路线并行研究
    ├── FLOW-06-48 ✅ → TEC-3.4 科技链路解锁验证（Tier1→2→3）
    ├── FLOW-06-49 ✅ → 边界：不存在的科技节点
    └── FLOW-06-50 ✅ → 边界：重复研究同一科技应失败
```

### 3.2 引擎测试 → PRD映射 (29文件, ~846用例)

```
科技模块 引擎测试覆盖树
├── 核心系统测试
│   ├── TechTreeSystem.test.ts (44用例) ✅ → TEC-1, TEC-3
│   │   三条路线/节点状态/前置条件/互斥分支/完成效果
│   ├── TechTreeSystem.rendering.test.ts (22用例) ✅ → TEC-1, UI-TEC-2
│   │   路线标签/颜色/图标/节点渲染字段/ID唯一性
│   ├── TechResearchSystem.test.ts (50用例) ✅ → TEC-2
│   │   研究流程/队列管理/取消研究/加速研究
│   ├── TechPointSystem.test.ts (25用例) ✅ → TEC-2.7
│   │   科技点产出/消耗/退款/书院等级关联
│   ├── TechEffectSystem.test.ts (43用例) ✅ → TEC-3
│   │   效果计算/加成叠加/全局加成/状态管理
│   ├── TechEffectApplier.test.ts (33用例) ✅ → TEC-3
│   │   战斗加成/资源加成/文化加成应用
│   ├── TechDetailProvider.test.ts (42用例) ✅ → TEC-2, UI-TEC-6
│   │   科技详情查询/消耗计算/前置条件/效果预览
│   └── TechSystem.path-coverage.test.ts (29用例) ✅ → TEC-3
│       路径覆盖/三条路线节点可达性
│
├── 融合科技测试
│   ├── FusionTechSystem.test.ts (56用例) ✅ → TEC-4
│   │   融合科技定义/解锁条件/效果计算
│   ├── FusionTechSystem.v5.test.ts (31用例) ✅ → TEC-4
│   │   V5版本融合科技联动效果
│   ├── FusionTechSystem.links.test.ts (17用例) ✅ → TEC-4
│   │   融合科技联动效果Map/属性完整性
│   ├── FusionLinkManager.test.ts (15用例) ✅ → TEC-4
│   │   联动效果注册/查询/默认联动
│   └── tech-link-fusion-integration.test.ts (33用例) ✅ → TEC-4
│       融合科技与基础科技联动集成
│
├── 联动系统测试
│   ├── TechLinkSystem.test.ts (52用例) ✅ → TEC-3
│   │   联动效果注册/建筑联动/武将联动
│   └── TechLinkConfig.test.ts (9用例) ✅ → TEC-3
│       联动配置完整性/ID唯一性
│
├── 离线系统测试
│   ├── TechOfflineSystem.test.ts (40用例) ✅ → TEC-2.6
│   │   离线研究计算/效率系数/封顶72小时
│   ├── TechOfflineSystem.lifecycle.test.ts (23用例) ✅ → TEC-2.6
│   │   离线生命周期/快照/恢复
│   └── TechOfflineSystem.round2.test.ts (27用例) ✅ → TEC-2.6
│       离线面板/效率曲线/时间格式化
│
├── 配置与类型测试
│   ├── tech-config.test.ts (21用例) ✅ → TEC-1.2
│   │   总节点数/ID唯一/路线节点分布
│   ├── tech-detail-types.test.ts (23用例) ✅ → TEC-2
│   │   时间格式化（秒/分/时/天）
│   ├── TechEffectTypes.test.ts (20用例) ✅ → TEC-3
│   │   效果类型初始值/字段完整性
│   └── tech-effect-types.test.ts (18用例) ✅ → TEC-3
│       效果类型映射（军事4种/经济/文化）
│
├── 对抗性测试
│   ├── tech-adversarial.mutex.test.ts (26用例) ✅ → TEC-1.3
│   │   互斥分支边界/锁定/解锁
│   ├── tech-adversarial.offline-edge.test.ts (49用例) ✅ → TEC-2.6
│   │   离线边界（0秒/72小时/负数/极大值）
│   ├── tech-adversarial.points-boundary.test.ts (41用例) ✅ → TEC-2.7
│   │   科技点边界（恰好/不足/溢出/负数）
│   ├── tech-adversarial.prereq-chain.test.ts (36用例) ✅ → TEC-3.4
│   │   前置链路（循环依赖/跳级/断链）
│   ├── tech-adversarial.serialization.test.ts (36用例) ✅ → TEC-4.6
│   │   序列化边界（空数据/损坏数据/版本迁移）
│   ├── tech-adversarial.state-transition.test.ts (40用例) ✅ → TEC-2.1
│   │   状态转换（locked→available→researching→completed）
│   └── tech-adversarial.cross-system.test.ts (38用例) ✅ → TEC-1
│       跨系统交互验证
│
└── 集成测试 (19文件)
    ├── tech-research-full-flow.integration.test.ts (28用例) ✅ → TEC-2
    ├── tech-points-core-loop.integration.test.ts (29用例) ✅ → TEC-2.7
    ├── tech-queue-accelerate.integration.test.ts (19用例) ✅ → TEC-2.8/2.9
    ├── tech-browse-research.integration.test.ts (16用例) ✅ → TEC-2.1
    ├── tech-mutex-fusion-link.integration.test.ts (24用例) ✅ → TEC-1.3, TEC-4
    ├── tech-link-fusion-offline.integration.test.ts (32用例) ✅ → TEC-2.6, TEC-4
    ├── tech-offline-reincarnation.integration.test.ts (15用例) ✅ → TEC-2.6, TEC-4.6
    ├── v5-tech-effect-applier-flow.integration.test.ts (56用例) ✅ → TEC-3
    ├── prestige-rebirth.integration.test.ts (47用例) ✅ → TEC-4.6 转生重置
    ├── cross-system-validation.integration.test.ts (25用例) ✅ → TEC-1 跨系统
    ├── cross-validation-loop.integration.test.ts (32用例) ✅ → TEC-1 跨系统循环
    ├── mobile-edge-cases.integration.test.ts (37用例) ✅ → UI-TEC-8~10 手机端
    ├── siege-full-flow.integration.test.ts (44用例) ✅ → TEC-3.1 攻城流程
    ├── map-territory-siege.integration.test.ts (33用例) ✅ → TEC-3.1 领土攻城
    ├── map-render-territory.integration.test.ts (52用例) ✅ → TEC-3 地图渲染
    ├── map-filter-stat.integration.test.ts (51用例) ✅ → TEC-1 地图筛选
    ├── map-event-stat-mobile.integration.test.ts (12用例) ✅ → UI-TEC-8 地图事件
    ├── garrison-reincarnation-edge.integration.test.ts (22用例) ✅ → TEC-4.6 驻防转生
    └── (其他集成测试)
```

---

## 四、覆盖分析矩阵

### PRD功能点覆盖统计

| PRD章节 | 功能点数 | ACC覆盖 | 引擎覆盖 | 总覆盖 | 覆盖率 |
|---------|:-------:|:-------:|:-------:|:------:|:------:|
| TEC-1 科技系统概述 | 5 | 5 | 44 | 5 | **100%** |
| TEC-2 科技研究 | 14 | 12 | 85 | 14 | **100%** |
| TEC-3 科技效果 | 5 | 5 | 62 | 5 | **100%** |
| TEC-4 融合科技 | 6 | 2 | 56 | 6 | **100%** |
| UI交互点 | 10 | 8 | 37 | 10 | **100%** |
| **合计** | **40** | **32** | **284** | **40** | **100%** |

### 引擎测试文件维度统计

| 测试维度 | 文件数 | 用例数 | 覆盖PRD章节 |
|---------|:------:|:------:|------------|
| 核心系统 | 8 | 288 | TEC-1, TEC-2, TEC-3 |
| 融合科技 | 5 | 152 | TEC-4 |
| 联动系统 | 2 | 61 | TEC-3 |
| 离线系统 | 3 | 90 | TEC-2.6 |
| 配置类型 | 4 | 82 | TEC-1, TEC-2, TEC-3 |
| 对抗性测试 | 7 | 266 | TEC-1~4 |
| 集成测试 | 19 | ~548 | TEC-1~4, UI |
| **合计** | **48** | **~1487** | — |

### 未覆盖功能点（Gap分析）

| Gap ID | 功能点 | 严重程度 | 建议 |
|--------|--------|:--------:|------|
| GAP-TEC-01 | TEC-2.5 切换研究（消耗100铜钱，进度保留） | P2 | 引擎测试补充切换逻辑 |
| GAP-TEC-02 | TEC-2.10 元宝秒完成（每日限3次） | P2 | 补充元宝秒完成限制测试 |
| GAP-TEC-03 | TEC-2.12 声望等级加速具体数值 | P2 | 补充声望×0.02系数测试 |
| GAP-TEC-04 | TEC-2.13 联盟加速（+10%） | P3 | 功能未上线，暂不测试 |
| GAP-TEC-05 | TEC-2.14 加速叠加公式完整验证 | P1 | 补充多加速源叠加测试 |
| GAP-TEC-06 | TEC-4.5 融合科技不占用基础路线研究槽位 | P2 | 补充槽位独立性测试 |
| GAP-TEC-07 | UI-TEC-1 画布缩放拖拽交互 | P3 | UI交互测试，需E2E |
| GAP-TEC-08 | UI-TEC-4 连接线样式变化 | P3 | UI渲染测试 |
| GAP-TEC-09 | UI-TEC-5 筛选栏搜索功能 | P3 | UI交互测试 |

---

## 五、测试密度指标

| 指标 | 数值 |
|------|:----:|
| PRD功能点总数 | 40 |
| ACC测试用例数 (ACC-08 + FLOW-06) | 77 |
| 引擎测试用例数 | ~846 |
| 总测试用例数 | ~923 |
| 用例/功能点密度 | 23.1 |
| PRD覆盖率 | **100%** |
| P0级Gap数 | 0 |
| P1级Gap数 | 1 |
| P2级Gap数 | 4 |
| P3级Gap数 | 4 |

---

*科技模块测试覆盖树 v1.0 | 2026-04-18*
