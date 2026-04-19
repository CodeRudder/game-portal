# 三国霸业 — DDD架构设计文档

> 领域驱动设计，按业务域纵向划分目录，每个域自治、可独立扩展。

---

## 一、架构分层

| 层 | 职责 | 依赖方向 |
|---|------|---------|
| **表现层（UI）** | 页面渲染、用户交互、动画 | → 应用层 |
| **应用层（Engine）** | 编排各子系统、协调业务流程 | → 领域层 |
| **领域层（Domain）** | 业务规则、状态管理、聚合根 | → 基础设施层 |
| **基础设施层（Infra）** | 纯数据配置、类型定义、工具函数 | 无外部依赖 |

依赖方向严格单向：UI → Engine → Domain → Infra，禁止反向。

---

## 二、目录结构（按业务域纵向划分）

```
src/games/three-kingdoms/
│
├── engine/                          ← 应用层 + 领域层
│   ├── ThreeKingdomsEngine.ts       ← 应用层：引擎主类（编排，≤500行）
│   │
│   ├── resource/                    ← 领域：资源域
│   │   ├── ResourceSystem.ts        ← 聚合根：资源状态+产出+消耗
│   │   ├── resource-config.ts       ← 配置：资源数值表
│   │   └── resource.types.ts        ← 类型：资源域专用类型
│   │
│   ├── building/                    ← 领域：建筑域
│   │   ├── BuildingSystem.ts        ← 聚合根：建筑状态+升级+产出
│   │   ├── building-config.ts       ← 配置：建筑数值表+升级费用曲线
│   │   └── building.types.ts        ← 类型：建筑域专用类型
│   │
│   ├── hero/                        ← 领域：武将域（v2.0+）
│   │   ├── HeroSystem.ts            ← 聚合根：武将招募+升级+技能
│   │   ├── hero-config.ts           ← 配置：武将数据+品质+成长曲线
│   │   └── hero.types.ts            ← 类型：武将域专用类型
│   │
│   ├── combat/                      ← 领域：战斗域（v3.0+）
│   │   ├── CombatSystem.ts          ← 聚合根：战斗逻辑+阵型+结算
│   │   ├── combat-config.ts         ← 配置：战斗参数+克制表
│   │   └── combat.types.ts          ← 类型：战斗域专用类型
│   │
│   ├── campaign/                    ← 领域：战役域（v3.0+）
│   │   ├── CampaignSystem.ts        ← 聚合根：关卡+进度+星级
│   │   ├── campaign-config.ts       ← 配置：关卡数据+敌人配置
│   │   └── campaign.types.ts        ← 类型：战役域专用类型
│   │
│   ├── tech/                        ← 领域：科技域（v5.0+）
│   │   ├── TechSystem.ts
│   │   ├── tech-config.ts
│   │   └── tech.types.ts
│   │
│   ├── territory/                   ← 领域：领土域（v6.0+）
│   ├── weather/                     ← 领域：天气域（v7.0+）
│   ├── trade/                       ← 领域：商贸域（v8.0+）
│   ├── offline/                     ← 领域：离线收益域（v9.0+）
│   ├── equipment/                   ← 领域：装备域（v10.0+）
│   ├── arena/                       ← 领域：竞技场域（v11.0+）
│   ├── expedition/                  ← 领域：远征域（v12.0+）
│   ├── alliance/                    ← 领域：联盟域（v13.0+）
│   ├── prestige/                    ← 领域：转生域（v14.0+）
│   ├── event/                       ← 领域：事件域（v15.0+）
│   ├── heritage/                    ← 领域：传承域（v16.0+）
│   └── ...                          ← 后续版本按需新增业务域
│
├── shared/                          ← 基础设施层（跨域共享）
│   ├── types.ts                     ← 全局共享类型
│   ├── constants.ts                 ← 全局常量
│   └── utils.ts                     ← 工具函数
│
└── index.ts                         ← 导出入口


src/components/idle/                 ← 表现层
├── ThreeKingdomsGame.tsx            ← 主组件（编排，≤500行）
├── panels/                          ← 面板子组件
│   ├── resource/                    ← 资源域UI
│   │   └── ResourceBar.tsx
│   ├── building/                    ← 建筑域UI
│   │   ├── BuildingPanel.tsx
│   │   └── BuildingUpgradeModal.tsx
│   ├── hero/                        ← 武将域UI（v2.0+）
│   ├── combat/                      ← 战斗域UI（v3.0+）
│   └── ...                          ← 每个业务域对应一个UI子目录
└── ThreeKingdomsGame.css            ← 全局样式（按域分区注释）
```

---

## 三、业务域划分

每个业务域是一个独立的垂直切片，包含该域所需的全部内容。

| 业务域 | 版本 | 聚合根 | 核心职责 |
|--------|------|--------|---------|
| resource | v1.0 | ResourceSystem | 资源存储、产出、消耗、上限 |
| building | v1.0 | BuildingSystem | 建筑状态、升级、产出关联 |
| hero | v2.0 | HeroSystem | 武将招募、升级、技能、品质 |
| combat | v3.0 | CombatSystem | 战斗逻辑、阵型、结算 |
| campaign | v3.0 | CampaignSystem | 关卡、进度、星级评定 |
| tech | v5.0 | TechSystem | 科技树、研究、加成 |
| territory | v6.0 | TerritorySystem | 领土、扩张、占领 |
| weather | v7.0 | WeatherSystem | 天气系统、季节效果 |
| trade | v8.0 | TradeSystem | 商贸路线、贸易收益 |
| offline | v9.0 | OfflineSystem | 离线收益计算、衰减 |
| equipment | v10.0 | EquipmentSystem | 装备、强化、套装 |
| arena | v11.0 | ArenaSystem | 竞技场、匹配、段位 |
| expedition | v12.0 | ExpeditionSystem | 远征、副本、扫荡 |
| alliance | v13.0 | AllianceSystem | 联盟、公会、Boss |
| prestige | v14.0 | PrestigeSystem | 转生、声望、倍率 |
| event | v15.0 | EventSystem | 随机事件、剧情事件 |
| heritage | v16.0 | HeritageSystem | 传承、军师推荐 |

---

## 四、每个业务域的内部结构

每个业务域目录包含3种文件，职责清晰：

| 文件 | 职责 | 规则 |
|------|------|------|
| `{Domain}System.ts` | 聚合根，业务逻辑+状态管理 | 可引用config和types，禁止引用其他域的System |
| `{domain}-config.ts` | 纯数据，数值表 | 零逻辑，只有常量和数据结构 |
| `{domain}.types.ts` | 类型定义 | 只有interface/type，零逻辑 |

**域间通信规则**：
- 子系统间**禁止直接调用**，必须通过 Engine 编排
- 子系统可以接收 Engine 传入的参数，但不持有其他子系统的引用
- 需要跨域数据时，由 Engine 在调用时注入

---

## 五、Engine编排规则

ThreeKingdomsEngine.ts 是唯一的应用服务层文件：

- 持有所有子系统的实例
- 暴露 `tick()` 驱动所有子系统更新
- 暴露 `serialize()/deserialize()` 统一存档
- 协调子系统间的数据流转（如：建筑升级→消耗资源→更新产出速率）
- **不包含任何具体业务逻辑**，只做编排

---

## 六、扩展方式

新增版本时，只需：
1. 在 `engine/` 下新建业务域目录（如 `engine/hero/`）
2. 在域目录内创建 System + Config + Types 三个文件
3. 在 Engine 中导入并编排新子系统
4. 在 `panels/` 下新建对应UI子目录

**不影响任何已有业务域**，完全增量扩展。

---

## 七、重构策略（从零重写，不迁移旧代码）

### 核心原则：严格按新规范重写，不接受任何历史原因的旧代码

**禁止**：
- 从旧代码迁移/复制/改编任何逻辑到新架构
- 保留旧文件"暂时不动"——所有旧文件必须移到bak/或删除
- 以"历史原因"为由在新架构中引入不符合规范的设计

**正确做法**：
- 每个业务域从空文件开始，严格按PRD文档重新实现
- 数值配置从PRD数值表重新录入，不从旧constants.ts复制
- 类型定义按新架构重新设计，不沿用旧接口
- UI组件严格按UI布局文档重新实现，不沿用旧TSX/CSS

### 旧代码处理

所有旧代码移到 `bak/` 目录，仅作为参考（非复制来源）：
- 旧引擎文件 → `bak/ThreeKingdomsEngine.old.ts`
- 旧UI组件 → `bak/ThreeKingdomsPixiGame.old.tsx` + `.old.css`
- 旧子系统文件 → `bak/` 对应目录
- 旧常量文件 → `bak/constants.old.ts`
- 旧数据文件 → `bak/GeneralData.old.ts` 等

所有常量和领域模型都按业务域拆分到对应的 `{domain}-config.ts` 中，不存在跨域的共享数据文件。

---

*文档版本：v1.1 | 更新日期：2026-04-19 | 变更：新增重构策略章节*
