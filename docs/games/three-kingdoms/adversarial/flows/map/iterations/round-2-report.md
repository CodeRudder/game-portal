# Round 2 迭代报告

> **日期**: 2026-05-03
> **迭代周期**: 第2轮

---

## 1. 评测结果

### 1.1 离线奖励E2E评测

| 环节 | 状态 | 问题 |
|------|:----:|------|
| 离线检测 | ⚠️ | getOfflineEventSystem()返回错误系统 |
| processOfflineTime() | ✅ | 返回格式正确 |
| 弹窗显示 | ✅ | 时长格式化/资源汇总正确 |
| 24小时上限 | ✅ | UI和引擎层双重截断 |
| 领取逻辑 | ⚠️ | 无己方领土时奖励静默丢失 |
| 关闭后不重复弹出 | ✅ | offlineRewardClaimedRef正确 |
| 测试覆盖 | ✅ | 22/22通过 |

### 1.2 产出面板E2E评测

| 环节 | 状态 | 问题 |
|------|:----:|------|
| 数据源 | ✅ | TerritoryData.currentProduction正确 |
| 己方领土过滤 | ✅ | filter正确 |
| 各领土产出速率 | ✅ | 4种资源正确显示 |
| 存储容量 | ⚠️ | 警告阈值过于敏感(10%/小时) |
| 空状态 | ✅ | 正确处理 |
| 测试覆盖 | ✅ | 16/16通过 |

### 1.3 性能评测

| 检查项 | 状态 | 指标 |
|--------|:----:|------|
| 脏标记渲染 | ✅ | 无变化时跳过渲染 |
| 视口裁剪 | ⚠️ | 地形已裁剪，建筑/道路未裁剪 |
| Canvas优化 | ✅ | requestAnimationFrame + save/restore |
| A*寻路性能 | ✅ | 0.79ms平均(阈值5ms) |
| 整体帧率 | ✅ | 60fps可达 |

### 1.4 架构审查

| 检查项 | 状态 | 问题数 | 最高优先级 |
|--------|:----:|:------:|-----------|
| 模块依赖 | ⚠️ | 3 | D-01: 核心层反向依赖引擎层 |
| 数据流 | ⚠️ | 2 | F-02: 独立事件总线导致通信断裂 |
| 坐标一致性 | ✅ | 2 | C-01: 双重坐标源(已对齐) |
| 事件通信 | ❌ | 3 | E-01: 事件总线分裂 |
| 代码质量 | ⚠️ | 11 | Q-01: any类型逃逸 |

---

## 2. 发现的问题

### 2.1 严重问题

| ID | 问题 | 位置 | 影响 |
|----|------|------|------|
| D-01 | territory-config.ts导入PathfindingSystem(核心层依赖引擎层) | territory-config.ts:13,16 | 架构违反 |
| F-02 | WorldMapTab创建独立eventBus，与引擎eventBus隔离 | WorldMapTab.tsx:219-258 | 行军事件无法被其他系统感知 |
| E-01 | SiegeSystem和MarchingSystem使用不同eventBus | 全局 | 攻城/行军事件通信断裂 |
| Q-01 | engine?: any类型逃逸 | WorldMapTab.tsx:61 | 20+处as any，失去类型检查 |
| Q-09 | WorldMapTab上帝组件(1009行) | WorldMapTab.tsx | 职责过重 |
| Q-04 | 攻城条件异常时默认允许攻城 | WorldMapTab.tsx:543 | catch{canSiege:true}应为false |

### 2.2 中等问题

| ID | 问题 | 位置 |
|----|------|------|
| D-02 | WorldMapTab直接实例化引擎系统 | WorldMapTab.tsx:33-37 |
| D-03 | PixelWorldMap和WorldMapTab重复解析地图 | 两个文件 |
| C-01 | LANDMARK_POSITIONS与parsedMap.cities双重坐标源 | map-config.ts |
| Q-07 | setActiveMarches每帧创建新数组 | WorldMapTab.tsx:328 |
| 离线-1 | getOfflineEventSystem()返回错误系统 | engine-getters.ts:296 |
| 离线-2 | 无己方领土时奖励静默丢失 | WorldMapTab.tsx:346-411 |
| 存储-1 | 警告阈值10%/小时过于敏感 | ProductionPanel.tsx |

---

## 3. 测试结果

| 测试套件 | 通过 | 失败 |
|----------|:----:|:----:|
| 全部map相关测试 | 274 | 0 |
| 性能测试 | 8 | 0 |
| 离线奖励测试 | 22 | 0 |
| 产出面板测试 | 16 | 0 |
| SiegeResultModal测试 | 19 | 0 |
| **总计** | **339** | **0** |

---

## 4. 下轮改进计划

### Round 3: 架构修复

1. **P0**: 修复getOfflineEventSystem()返回错误系统
2. **P0**: 修复攻城条件异常默认允许(Q-04)
3. **P1**: 将deriveAdjacency下沉到核心层(D-01)
4. **P1**: 统一事件总线(F-02/E-01)
5. **P2**: 提高存储警告阈值

### Round 4: 代码质量

1. 定义IGameEngine接口替代any(Q-01)
2. 拆分WorldMapTab为多个hooks(Q-09)
3. PixelMapRenderer添加公共API(Q-02/Q-10)
4. 消除重复地图解析(D-03)

---

## 5. 回顾

### 改进趋势

| 指标 | Round 1 | Round 2 | 趋势 |
|------|---------|---------|:----:|
| 测试通过率 | 250/263(95%) | 339/339(100%) | ↑ |
| P0问题数 | 3 | 0 | ↓ |
| P1问题数 | 4 | 2 | ↓ |
| 架构问题 | 未评估 | 6严重 | 新发现 |
| 功能完成度 | 72.7% | 85% | ↑ |

### 经验教训

1. **E2E验证比单元测试更重要**: 单元测试全部通过但UI层完全断开(行军系统)
2. **事件总线统一是关键**: 局部eventBus导致系统间通信断裂
3. **坐标一致性需要自动化验证**: 手动维护LANDMARK_POSITIONS容易与地图数据脱节

---

*Round 2 迭代报告 | 2026-05-03*
