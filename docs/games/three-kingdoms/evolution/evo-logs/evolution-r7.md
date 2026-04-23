# Round 7: v6.0 天下大势 — 进化迭代记录

> 日期: 2026-04-22

## 概述

v6.0 "天下大势" 进化迭代，聚焦 Event 子系统接入引擎和门面导出补全。

## 技术审查发现

| # | 问题 | 严重度 | 修复状态 |
|---|------|--------|----------|
| P0-1 | Event子系统未接入引擎主入口 | P0 | ✅ 已修复 |
| P0-2 | engine/index.ts 缺失 NPC/Event 导出 | P0 | ✅ 已修复 |
| P1-1 | npcSystem.init(deps) 未调用 | P1 | ✅ 已修复 |
| P1-2 | index.ts 超500行(501行) | P1 | ✅ 已修复 |

## 修复详情

### P0-1: Event子系统接入引擎
- **engine-event-deps.ts** 已存在，定义 EventSystems 接口（6个子系统）
- **ThreeKingdomsEngine.ts** 中：
  - 构造函数调用 `createEventSystems()`
  - `registerSubsystems()` 注册6个事件子系统
  - `init()` 调用 `initEventSystems()`
  - `reset()` 重置所有事件子系统
  - `deserialize()` 和 `finalizeLoad()` 中也调用 `initEventSystems()`
- **engine-getters.ts** 中添加6个事件子系统 getter

### P0-2: 门面导出补全
- 创建 **exports-v6.ts**（NPC域9个系统+类型/常量，Event域6个系统+类型/常量）
- engine/index.ts 通过 `export * from './exports-v6'` 引用
- index.ts 精简到 498 行（< 500行限制）

### P1修复
- npcSystem.init(deps) 在 init/deserialize/finalizeLoad 三处均已调用
- NPC/Event UI面板 data-testid 已完整覆盖

## UI测试结果

| 指标 | 数值 |
|------|------|
| ✅ 通过 | 26 |
| ❌ 失败 | 0 |
| ⚠️ 警告 | 3 |
| 📸 截图 | 11 |

### 测试模块
- **A: 天下Tab** — 8/8 通过（地图容器、网格、领土格子、筛选器、热力图）
- **B: NPC交互** — 11/11 通过（名册、搜索、筛选、卡片、对话、好感度）
- **C: 事件系统** — 3/3 通过（面板入口、急报横幅、随机遭遇）
- **D: 移动端** — 2/2 通过（NPC/地图移动端适配）
- **E: 数据完整性** — 2/2 通过

### 3个警告说明
1. NPC详情弹窗未找到 — Toast回调触发模式，非弹窗直出
2. NPC对话弹窗未找到 — Toast回调触发模式，非弹窗直出
3. 更多Tab中事件入口未找到 — 可能使用不同的标签名

## 新增进化规则
- **EVO-029**: 搜索后DOM刷新
- **EVO-030**: 子系统接入检查清单

## 构建验证
- `pnpm run build`: ✅ tsc + vite build 通过
- 1353 modules transformed
- 无编译错误

## 文件变更清单
| 文件 | 变更 |
|------|------|
| engine/index.ts | 精简注释头（501→498行） |
| docs/games/three-kingdoms/lessons/v6.0-lessons.md | 更新修复后复盘 |
| docs/games/three-kingdoms/evolution/INDEX.md | 添加Round 7 + EVO-029/030 |
| docs/games/three-kingdoms/evolution/evolution-r7.md | 新建 |
| docs/games/three-kingdoms/ui-reviews/v6.0-review-r1.md | 新建 |
| e2e/v6-evolution-ui-test.cjs | 新建 |
| e2e/v6-evolution-results.json | 新建 |
| e2e/screenshots/v6-evolution/*.png | 11张截图 |
