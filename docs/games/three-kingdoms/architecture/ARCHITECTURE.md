# 三国霸业 v1.0 — 架构总览

> 最后更新：2025-04

## 1. 系统概览

三国霸业是一款**放置/挂机类策略游戏**，采用纯前端架构，所有游戏逻辑在浏览器端运行。
引擎以 **100ms tick** 驱动，通过事件总线解耦子系统，使用 localStorage 实现存档持久化。

核心技术栈：TypeScript + React + Vite，无后端依赖。

---

## 2. 分层架构

```
┌─────────────────────────────────────────────────────────┐
│  L4 — UI 层 (ui/)                                       │
│  React 组件 + Context + Hooks                            │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │ Resource │ │ Building │ │ Calendar │ │  Toast /  │   │
│  │  Panel   │ │  Panel   │ │  Panel   │ │  Modal   │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │
├─────────────────────────────────────────────────────────┤
│  L3 — 编排层 (engine/ThreeKingdomsEngine.ts)             │
│  统一调度：tick 循环、升级编排、存档/读档、事件路由        │
├─────────────────────────────────────────────────────────┤
│  L2 — 子系统层 (engine/)                                 │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐    │
│  │  Resource    │ │  Building    │ │  Calendar    │    │
│  │  System      │ │  System      │ │  System      │    │
│  └──────────────┘ └──────────────┘ └──────────────┘    │
├─────────────────────────────────────────────────────────┤
│  L1 — 核心层 (core/)                                     │
│  ┌──────────┐ ┌──────────────┐ ┌──────────────┐        │
│  │ EventBus │ │ SaveManager  │ │ConfigRegistry│        │
│  └──────────┘ └──────────────┘ └──────────────┘        │
│  ┌──────────────────┐ ┌─────────────────┐              │
│  │ SubsystemRegistry│ │ StateSerializer │              │
│  └──────────────────┘ └─────────────────┘              │
└─────────────────────────────────────────────────────────┘
```

### 各层职责

| 层级 | 目录 | 职责 | 依赖方向 |
|------|------|------|----------|
| L1 核心层 | `core/` | 事件总线、存档管理、配置注册、子系统注册 | 无外部依赖 |
| L2 子系统层 | `engine/` | 资源/建筑/日历等独立业务逻辑 | 依赖 L1 接口 |
| L3 编排层 | `engine/ThreeKingdomsEngine.ts` | 统一调度子系统、编排业务流程 | 依赖 L1 + L2 |
| L4 UI 层 | `ui/` | React 组件、状态展示、用户交互 | 依赖 L3 |

---

## 3. 引擎 Tick 数据流

```
                 ┌──────────────┐
                 │  tick(dtMs)  │  ← 100ms 定时调用
                 └──────┬───────┘
                        │
          ┌─────────────┼─────────────┐
          ▼             ▼             ▼
   ┌────────────┐ ┌───────────┐ ┌───────────┐
   │ Calendar   │ │ Building  │ │ Resource  │
   │ update(dt) │ │ tick()    │ │ tick(dt,  │
   │ 现实秒→    │ │ 升级计时  │ │ bonuses)  │
   │ 游戏天数   │ │           │ │           │
   └────────────┘ └─────┬─────┘ └─────┬─────┘
                        │              │
              升级完成的建筑           产出资源
                        │              │
                        ▼              │
                 ┌─────────────┐       │
                 │ syncBuilding│───────┘
                 │ ToResource  │ 更新产出速率+上限
                 └──────┬──────┘
                        │
                        ▼
               ┌────────────────┐
               │ detectAndEmit  │  JSON 浅比较
               │ Changes()      │  有变化才 emit
               └───────┬────────┘
                       │
           ┌───────────┼───────────┐
           ▼           ▼           ▼
   resource:     resource:     building:
   changed       rate-changed  upgraded
           │           │           │
           └───────────┼───────────┘
                       ▼
               ┌────────────────┐
               │   EventBus     │  → UI 组件订阅刷新
               └────────────────┘
                       │
                       ▼
               ┌────────────────┐
               │  自动保存累加   │  达到阈值时触发 save()
               └────────────────┘
```

---

## 4. 存档数据流

### 4.1 Save（保存）

```
ThreeKingdomsEngine.save()
  │
  ├─ 收集各子系统 serialize() 数据
  │   ├─ resource.serialize()  → ResourceSaveData
  │   ├─ building.serialize()  → BuildingSaveData
  │   └─ calendar.serialize()  → CalendarSaveData
  │
  ├─ 组装 GameSaveData → 转换为 IGameState
  │
  └─ SaveManager.save(state)
      │
      ├─ 更新 metadata（saveCount、timestamp）
      │
      └─ StateSerializer.serialize(state)
          │
          ├─ 嵌入版本号 + 计算校验和
          │
          └─ JSON.stringify({ v, checksum, data }) → localStorage
```

### 4.2 Load（加载）

```
ThreeKingdomsEngine.load()
  │
  ├─ SaveManager.load()
  │   │
  │   ├─ isNewFormat(raw)? ─── 是 ──→ StateSerializer.deserialize()
  │   │                                │
  │   │                                ├─ 校验 checksum
  │   │                                ├─ 版本迁移（如需）
  │   │                                └─ 返回 IGameState
  │   │
  │   └─ 否（旧格式）→ 返回 null
  │
  ├─ state 不为 null → applyLoadedState(state)
  │   │                  ├─ 反序列化各子系统
  │   │                  ├─ syncBuildingToResource()
  │   │                  └─ computeOfflineAndFinalize()
  │
  └─ state 为 null → tryLoadLegacyFormat()
      │
      ├─ 直接 JSON.parse 检查旧格式
      │   （有 version/resource/building，无 v/checksum/data）
      │
      └─ applyLegacyState(data)
          ├─ 反序列化各子系统
          └─ computeOfflineAndFinalize()
```

---

## 5. 子系统依赖关系

```
                  ThreeKingdomsEngine（编排层）
                 ┌────────┼────────┐
                 │        │        │
                 ▼        ▼        ▼
           Resource    Building  Calendar
           System      System    System
              ▲        │
              │        │
              └────────┘
         syncBuildingToResource()
         （Building 产出 → Resource 速率/上限）
```

| 子系统 | 依赖 | 被依赖 | 说明 |
|--------|------|--------|------|
| ResourceSystem | 无 | BuildingSystem（通过 Engine 编排） | 管理四种资源、产出速率、上限 |
| BuildingSystem | 无 | ResourceSystem（通过 Engine 编排） | 管理八种建筑、升级计时 |
| CalendarSystem | EventBus | 无 | 现实时间→游戏日历，季节/事件 |

> **设计原则**：子系统之间无直接 import 依赖，全部通过 Engine 编排层协调。
> 子系统通过 EventBus 发布事件，通过 ISystemDeps 接收依赖注入。

---

## 6. 目录结构（DDD 域划分）

```
src/games/three-kingdoms/
├── core/                          # L1 核心层 — 基础设施
│   ├── events/                    #   事件域
│   │   ├── EventBus.ts            #     发布/订阅总线，通配符支持
│   │   └── EventTypes.ts          #     事件类型常量
│   ├── save/                      #   存档域
│   │   ├── SaveManager.ts         #     存档生命周期管理
│   │   ├── StateSerializer.ts     #     序列化/校验/版本迁移
│   │   └── OfflineRewardCalculator.ts  # 离线收益计算
│   ├── config/                    #   配置域
│   │   ├── ConfigRegistry.ts      #     运行时配置注册表
│   │   └── ConstantsLoader.ts     #     常量批量加载
│   ├── engine/                    #   引擎内核域
│   │   ├── SubsystemRegistry.ts   #     子系统注册/查找
│   │   ├── LifecycleManager.ts    #     生命周期管理
│   │   └── GameEngineFacade.ts    #     引擎门面接口
│   ├── state/                     #   状态域
│   │   ├── GameState.ts           #     游戏状态定义
│   │   └── RenderStateAdapter.ts  #     渲染状态适配
│   └── types/                     #   核心类型定义
│       ├── events.ts              #     事件接口
│       ├── save.ts                #     存档接口
│       ├── config.ts              #     配置接口
│       ├── state.ts               #     状态接口
│       ├── engine.ts              #     引擎接口
│       └── subsystem.ts           #     子系统接口
│
├── engine/                        # L2 子系统层 + L3 编排层
│   ├── ThreeKingdomsEngine.ts     #   L3 编排主类
│   ├── resource/                  #   资源域
│   │   ├── ResourceSystem.ts      #     资源管理子系统
│   │   ├── OfflineEarningsCalculator.ts  # 离线收益
│   │   ├── resource-calculator.ts #     产出计算
│   │   └── resource-config.ts     #     资源配置常量
│   ├── building/                  #   建筑域
│   │   ├── BuildingSystem.ts      #     建筑管理子系统
│   │   ├── building-config.ts     #     建筑配置（等级表）
│   │   └── building.types.ts      #     建筑类型定义
│   └── calendar/                  #   日历域
│       ├── CalendarSystem.ts      #     日历子系统
│       ├── calendar-config.ts     #     日历配置
│       └── calendar.types.ts      #     日历类型定义
│
├── ui/                            # L4 UI 层
│   ├── components/                #   通用 UI 组件
│   │   ├── Modal.tsx              #     模态框
│   │   ├── Panel.tsx              #     信息面板
│   │   ├── Toast.tsx              #     提示通知
│   │   └── ToastProvider.tsx      #     Toast 上下文
│   ├── context/                   #   React Context
│   └── hooks/                     #   自定义 Hooks
│
├── shared/                        # 跨域共享
│   ├── types.ts                   #   全局共享类型
│   └── constants.ts               #   全局常量
│
├── rendering/                     # 渲染层（PixiJS）
│   ├── adapters/                  #   渲染适配器
│   ├── battle/                    #   战斗渲染
│   ├── general/                   #   武将渲染
│   └── map/                       #   地图渲染
│
└── tests/                         # 测试
    ├── __tests__/                 #   基础设施测试
    ├── fixtures/                  #   测试固件
    └── utils/                     #   测试工具
```

### 域划分说明

| 域 | 目录 | 核心概念 |
|----|------|----------|
| 事件域 | `core/events/` | EventBus、事件类型、发布/订阅 |
| 存档域 | `core/save/` | 序列化、校验、版本迁移、离线收益 |
| 配置域 | `core/config/` | ConfigRegistry、运行时配置 |
| 资源域 | `engine/resource/` | 四种资源、产出速率、上限、离线收益 |
| 建筑域 | `engine/building/` | 八种建筑、升级系统、等级表 |
| 日历域 | `engine/calendar/` | 游戏日历、季节、时间推进 |
| 展示域 | `ui/` | React 组件、状态展示、用户交互 |
| 渲染域 | `rendering/` | PixiJS 渲染、地图、武将、战斗 |

---

## 7. 关键设计决策

| 决策 | 理由 |
|------|------|
| 子系统零直接依赖 | 通过 Engine 编排 + EventBus 解耦，便于独立测试和替换 |
| JSON 浅比较变化检测 | 避免每帧 emit 事件导致 UI 不必要重渲染 |
| 存档格式预判 | 区分新旧格式，避免 try-catch 日志噪音 |
| 加成框架预留 | castle 加成已生效，tech/hero/rebirth/vip 预留接口 |
| DDD 域划分 | 按业务领域组织代码，而非技术层，便于功能扩展 |
