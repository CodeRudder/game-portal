# 三国霸业 v1.0 架构审查报告

> 审查时间：2025-07-11  
> 审查范围：`src/games/three-kingdoms/` 全部源码（排除 `bak/`）  
> 审查依据：iteration-rules.md 阶段3.5 架构审查清单  

---

## 一、文件行数检查

### 1.1 源码文件（排除测试和 bak/）

| 状态 | 文件 | 行数 | 说明 |
|:---:|------|-----:|------|
| ⚠️ | `engine/resource/ResourceSystem.ts` | **573** | 超标 73 行 |
| ✅ | `engine/ThreeKingdomsEngine.ts` | 500 | 恰好达标 |
| ✅ | `engine/building/BuildingSystem.ts` | 429 | |
| ✅ | `engine/building/building-config.ts` | 457 | |
| ✅ | `engine/calendar/CalendarSystem.ts` | 422 | |
| ✅ | `core/events/__tests__/EventBus.test.ts` | 664 | 测试文件，见下 |
| ✅ | 其余所有源码文件 | <500 | |

### 1.2 测试文件

| 状态 | 文件 | 行数 |
|:---:|------|-----:|
| ⚠️ | `core/events/__tests__/EventBus.test.ts` | **664** |
| ⚠️ | `engine/calendar/__tests__/CalendarSystem.test.ts` | **569** |
| ⚠️ | `engine/__tests__/ThreeKingdomsEngine.test.ts` | **640** |

> **结论：⚠️ 不通过** — 1 个源码文件超标（ResourceSystem.ts 573行），3 个测试文件超标。

---

## 二、单一职责检查

| 文件类别 | 职责描述 | 通过？ |
|---------|---------|:-----:|
| **Engine** — `ThreeKingdomsEngine.ts` | 编排子系统、协调业务流程、存档管理、事件代理 | ✅ |
| **System** — `ResourceSystem.ts` | 资源存储/产出/消耗/上限/离线收益/序列化 | ⚠️ 职责偏多 |
| **System** — `BuildingSystem.ts` | 建筑状态管理/升级逻辑/费用计算/升级计时 | ✅ |
| **System** — `CalendarSystem.ts` | 游戏时间/年号/季节/天气 | ✅ |
| **Config** — `*-config.ts` (×3) | 纯数据常量，零函数定义 | ✅ |
| **Types** — `*.types.ts` (×3) | 只有类型定义 + 枚举常量 | ✅ |
| **Types** — `shared/types.ts` | 跨域共享类型定义（无逻辑） | ✅ |
| **Types** — `shared/constants.ts` | 跨域共享常量（25行，无函数） | ✅ |
| **Core** — `EventBus.ts` | 事件发布/订阅 | ✅ |
| **Core** — `SubsystemRegistry.ts` | 子系统注册/查找 | ✅ |
| **Core** — `SaveManager.ts` | 存档读写/序列化 | ✅ |
| **Core** — `ConfigRegistry.ts` | 配置键值注册/查找 | ✅ |
| **UI** — `useGameEngine.ts` | 引擎生命周期管理 | ✅ |
| **UI** — `useBuildingActions.ts` | 建筑操作封装 | ✅ |
| **UI** — `useSystemState.ts` | 子系统状态提取 | ✅ |
| **UI** — `Modal/Panel/Toast` | 纯 UI 组件，无游戏逻辑 | ✅ |

> **结论：⚠️ 基本通过** — ResourceSystem 职责略重（含离线收益计算 + 格式化工具方法），建议将离线收益拆为独立文件。

---

## 三、依赖方向检查

### 3.1 预期依赖方向

```
UI → Engine → SubSystem → Config/Types
                ↓
              Core（基础设施）
```

### 3.2 实际依赖分析

| 依赖关系 | 方向 | 合规？ |
|---------|------|:-----:|
| UI → Engine | `useGameEngine` → `ThreeKingdomsEngine` | ✅ |
| UI → Shared Types | hooks → `shared/types.ts` | ✅ |
| UI → Engine Subsystem Types | `useGameEngine` → `engine/resource/resource.types` | ❌ |
| Engine → Core | `ThreeKingdomsEngine` → `core/events,save,config,engine` | ✅ |
| Engine → Shared | `ThreeKingdomsEngine` → `shared/constants,types` | ✅ |
| SubSystem → Core Types | 所有 System → `core/types` (ISubsystem) | ✅ |
| SubSystem → Domain Config | 各 System → 自己的 `*-config.ts` | ✅ |
| SubSystem → Shared Types | 各 `*.types.ts` → `shared/types.ts` | ✅ |
| SubSystem 跨域引用 | Building/Resource/Calendar 互不引用 | ✅ |
| Core → Engine | **无反向依赖** | ✅ |
| Rendering → Engine | **无直接依赖** | ✅ |
| Rendering → Core | `RenderStateBridge` → `core/state,types` | ✅ |

### 3.3 违规详情

```
❌ ui/hooks/useGameEngine.ts:20
   import type { OfflineEarnings } from '@/games/three-kingdoms/engine/resource/resource.types'
   
   问题：UI 层直接引用了 engine 子系统的内部类型
   修复：将 OfflineEarnings 类型提升到 shared/types.ts
```

> **结论：⚠️ 基本通过，1 处违规** — UI 层存在一处对子系统内部类型的直接引用。

---

## 四、子系统 API 检查

### 4.1 ISubsystem 接口实现

| 子系统 | `implements ISubsystem` | `name` | `init(deps)` | `update(dt)` | `getState()` | `reset()` |
|--------|:----------------------:|:------:|:------------:|:------------:|:------------:|:---------:|
| `ResourceSystem` | ✅ | `'resource'` | ✅ | ✅ | ✅ | ✅ |
| `BuildingSystem` | ✅ | `'building'` | ✅ | ✅ | ✅ | ✅ |
| `CalendarSystem` | ✅ | `'calendar'` | ✅ | ✅ | ✅ | ✅ |

### 4.2 API 边界清晰度

| 检查项 | 结果 |
|--------|:----:|
| 子系统通过 `ISystemDeps` 接收依赖（非自行创建） | ✅ |
| 子系统间通过 EventBus 通信（非直接引用） | ✅ |
| 子系统返回不可变数据（`cloneResources`, `{...spread}`） | ✅ |
| 子系统内部状态无外部可变引用泄漏 | ✅ |
| 引擎通过 `SubsystemRegistry` 管理子系统 | ✅ |

> **结论：✅ 通过** — 所有子系统完整实现 ISubsystem 接口，API 边界清晰。

---

## 五、UI 组件检查

| 检查项 | 结果 |
|--------|:----:|
| UI 组件不包含游戏逻辑 | ✅ |
| Modal/Panel/Toast 为纯展示组件 | ✅ |
| 通过 `useGameContext()` 获取引擎（非直接 new） | ✅ |
| `useSystemState` 仅从 snapshot 提取数据 | ✅ |
| `useBuildingActions` 仅封装引擎调用 | ✅ |
| `useGameEngine` 管理引擎生命周期 | ✅ |

> **结论：✅ 通过** — UI 层架构清晰，逻辑与展示完全分离。

---

## 六、问题清单

### 🔴 必须修复（P0）

| # | 问题 | 文件 | 修复建议 |
|---|------|------|---------|
| 1 | **源码文件超 500 行** | `engine/resource/ResourceSystem.ts` (573行) | 将离线收益相关代码（`calculateOfflineEarnings`, `applyOfflineEarnings`, `formatOfflineTime`, `getOfflineEfficiencyPercent`）提取到 `engine/resource/OfflineEarningsCalculator.ts` |
| 2 | **UI 反向依赖子系统类型** | `ui/hooks/useGameEngine.ts:20` | 将 `OfflineEarnings` 类型从 `engine/resource/resource.types.ts` 提升到 `shared/types.ts` |

### 🟡 建议修复（P1）

| # | 问题 | 文件 | 修复建议 |
|---|------|------|---------|
| 3 | 测试文件超 500 行 | `EventBus.test.ts` (664), `CalendarSystem.test.ts` (569), `ThreeKingdomsEngine.test.ts` (640) | 按测试场景拆分为多个 describe 块文件 |
| 4 | ThreeKingdomsEngine 恰好 500 行 | `engine/ThreeKingdomsEngine.ts` | 随着新子系统接入（武将、战役等），极易超标。建议将存档加载逻辑（`load/applyLoadedState/tryLoadLegacyFormat`）提取到独立类 |
| 5 | Engine 存在 `as any` 类型断言 | `ThreeKingdomsEngine.ts` 构造函数中 `this.registry.register('resource', this.resource as any)` | 让子系统接口更精确，或使用泛型注册方法消除断言 |

### 🟢 已达标（无需修复）

- ✅ Config 文件全部纯数据零逻辑
- ✅ Types 文件全部只有类型定义
- ✅ 子系统间零跨域引用
- ✅ Core 层零反向依赖
- ✅ Rendering 层零 Engine 依赖
- ✅ 所有子系统完整实现 ISubsystem
- ✅ UI 组件无游戏逻辑

---

## 七、整体架构评分

### 评分：8.0 / 10

| 维度 | 得分 | 说明 |
|------|:----:|------|
| **分层清晰度** | 9/10 | core → engine → ui 三层分明，rendering 独立 |
| **接口契约** | 9/10 | ISubsystem/ISystemDeps 设计优秀，依赖注入规范 |
| **模块内聚** | 8/10 | 各子系统域边界清晰，ResourceSystem 略胖 |
| **依赖方向** | 8/10 | 整体单向，1 处 UI→Subsystem 类型违规 |
| **代码规范** | 8/10 | 文件头注释清晰，命名规范统一 |
| **可扩展性** | 7/10 | Engine 500 行接近上限，新子系统接入需重构 |
| **测试覆盖** | 8/10 | 测试齐全但部分文件过大 |

### 架构亮点

1. **ISubsystem 接口设计** — 统一生命周期（init/update/getState/reset），依赖注入通过 ISystemDeps，子系统的注册/发现/遍历通过 ISubsystemRegistry，扩展新子系统只需实现接口
2. **子系统零跨域引用** — Building/Resource/Calendar 完全独立，仅通过 EventBus 通信，符合 DDD 聚合根原则
3. **UI 层 hooks 分层** — useGameEngine（生命周期）/ useSystemState（数据读取）/ useBuildingActions（操作封装）职责清晰
4. **Config 零逻辑** — 所有配置文件纯数据，无函数定义，便于热更新和数值策划调整

---

## 八、修复优先级路线图

```
Phase 1 (立即) ─── 修复 P0 问题
  ├── 提取 OfflineEarningsCalculator.ts（ResourceSystem 573→~400行）
  └── 提升 OfflineEarnings 类型到 shared/types.ts

Phase 2 (下个迭代) ─── 修复 P1 问题
  ├── 拆分 Engine 存档加载逻辑（为武将/战役子系统预留空间）
  └── 消除 registry.register 的 as any 断言

Phase 3 (可选) ─── 测试文件拆分
  └── 按场景拆分超 500 行的测试文件
```
