# Round 5d 计划

> **迭代**: map-system
> **轮次**: Round 5d
> **来源**: `PLAN.md` + Round 5c Judge ruling
> **日期**: 2026-05-04

## 本轮焦点

| 优先级 | 领域 | 来源 | 原因 |
|:------:|------|------|------|
| P1 | siegeTaskId serialize/deserialize round-trip 测试 | R5c Judge P1-1 | 序列化后 siegeTaskId 未验证保留 |
| P1 | 事件 payload 类型接口定义 | R5c Judge P1-3 | handleArrived/handleCancelled 使用 data:any，类型逃逸 |
| P2 | WorldMapTab <-> SiegeTaskPanel 集成测试 | R5c Judge P0-2(P2) | 组件间交互未集成验证 |
| P2 | SiegeTaskManager 链路集成测试 | R5c Judge P2-2 | P5->P10 全链路无集成测试 |
| P2 | handleSiegeConfirm 注释修正 | R5c Judge P2-1 | 注释"异步流程"误导，函数实际同步 |
| P2 | engine prop 类型定义(跟踪) | R5c Judge P1-4(dismisssed) | 预存技术债，记录但本轮不解决 |
| P1 | I12 行军->攻占动画无缝切换 | PLAN.md R5c | 行军到达后动画状态切换未实现 |
| P1 | I13 攻占战斗回合制(10s~60s城防衰减) | PLAN.md R5c | 城防衰减引擎+UI均未完成 |
| P2 | I14 攻占结果结算与事件生成 | PLAN.md R5c | 战斗结果事件可回查 |
| P2 | I15 编队伤亡状态更新+自动回城 | PLAN.md R5c | P10 回城闭环 |

## 详细任务分解

### Task 1: siegeTaskId 序列化 round-trip 测试 (P1, Small)

**问题**: `MarchingSystem.serialize()` / `deserialize()` 测试从未验证 `siegeTaskId` 字段在序列化-反序列化后保留。

**计划**:
1. 在 `MarchingSystem.test.ts` 现有序列化测试中添加 siegeTaskId 字段
2. 创建一个带有 `siegeTaskId: 'test-siege-task-001'` 的 march
3. 执行 serialize -> deserialize 循环
4. 断言反序列化后的 march 对象保留 `siegeTaskId` 值
5. 同时测试 `siegeTaskId` 为 `undefined` (默认) 的情况

**验证标准**: 新增测试通过，覆盖 siegeTaskId 有值/无值两种场景

---

### Task 2: 事件 Payload 类型安全 (P1, Small)

**问题**: `WorldMapTab.tsx` 中 `handleArrived` 和 `handleCancelled` 的 `data` 参数类型为 `any`，丧失编译期类型检查。

**计划**:
1. 在 `WorldMapTab.tsx` 或独立 types 文件中定义接口:
   ```typescript
   interface MarchArrivedPayload {
     marchId: string;
     siegeTaskId?: string;
     // ... 其他已知字段
   }
   interface MarchCancelledPayload {
     marchId: string;
     siegeTaskId?: string;
     // ... 其他已知字段
   }
   ```
2. 将 `handleArrived(data: any)` 改为 `handleArrived(data: MarchArrivedPayload)`
3. 将 `handleCancelled(data: any)` 改为 `handleCancelled(data: MarchCancelledPayload)`
4. 确保 eventBus 注册点的类型匹配
5. 更新测试中的 mock 数据以匹配新接口

**验证标准**: 无 `any` 类型在事件 handler 签名中，所有现有测试继续通过

---

### Task 3: WorldMapTab <-> SiegeTaskPanel 集成测试 (P2, Medium)

**问题**: SiegeTaskPanel 有 27 个单元测试，但没有任何测试验证其与 WorldMapTab 的交互。

**计划**:
1. 创建 `WorldMapTab.siege-integration.test.tsx`
2. 测试场景:
   - 创建攻城任务后 SiegeTaskPanel 显示正确任务
   - 点击 SiegeTaskPanel 任务触发 onSelectTask 回调
   - 关闭 SiegeTaskPanel 触发 onClose 回调
   - 任务状态变更后 SiegeTaskPanel 更新显示
   - 已完成任务被过滤不显示
3. 使用 render + fireEvent 模式测试组件间数据流

**验证标准**: 至少 5 个集成测试场景通过

---

### Task 4: SiegeTaskManager 链路集成测试 (P2, Medium)

**问题**: 无端到端测试覆盖 SiegeTaskManager 从 createTask -> advanceStatus -> complete 的完整生命周期。

**计划**:
1. 创建 `SiegeTaskManager.chain.integration.test.ts`
2. 测试场景:
   - P5 创建任务 (createTask) -> 验证初始状态 'preparing'
   - P6 行军创建 -> siegeTaskId 关联 -> advanceStatus('marching')
   - P8 行军到达 -> advanceStatus('sieging') -> 战斗模拟
   - P9 结算 -> advanceStatus('settling') -> advanceStatus('returning')
   - P10 回城完成 -> advanceStatus('completed') -> removeCompletedTasks()
   - 中断路径: march:cancelled -> 任务标记失败并清理
3. 所有步骤在同一测试中串联，验证完整状态机转换

**验证标准**: 覆盖全部 6 个状态转换路径的集成测试通过

---

### Task 5: handleSiegeConfirm 注释修正 (P2, Trivial)

**问题**: 函数注释写"异步流程"但函数本身是同步 `useCallback`，容易误导开发者。

**计划**:
1. 将注释 `// -- 确认攻城执行（异步流程：创建任务->行军->到达时自动攻城） --`
2. 修改为 `// -- 攻城执行入口（同步触发异步流程：创建任务->行军->到达时自动攻城） --`

**验证标准**: 注释准确描述函数行为

---

### Task 6: I12 行军->攻占动画无缝切换 (P1, Large)

**问题**: 行军到达后需要从行军动画状态无缝切换到攻占动画状态。

**计划**:
1. 在 `handleArrived` 中添加动画状态切换逻辑
2. 定义动画阶段枚举: `marching` -> `rallying` -> `sieging` -> `result`
3. 不同策略对应不同攻占动画(强攻/围困/夜袭/内应)
4. 动画切换使用 CSS transition 或 requestAnimationFrame 实现平滑过渡
5. 添加动画完成回调触发下一阶段

**验证标准**: 行军到达后动画连续无跳变，4 种策略各有对应动画

---

### Task 7: I13 攻占战斗回合制 (P1, Large)

**问题**: 攻城战斗需要支持 10s~60s 的城防衰减机制，当前为即时执行。

**计划**:
1. 在引擎层实现 `SiegeBattleSystem`:
   - 城防值初始化(基于城市等级)
   - 每回合衰减(基于编队战力 + 策略加成)
   - 回合间隔 1s，总计 10~60 回合
   - 城防归零 = 胜利；回合耗尽 = 根据剩余城防判定失败/惨败
2. 添加 `SiegeBattleProgress` 接口追踪战斗进度
3. SiegeTaskManager 在 'sieging' 状态中运行战斗循环
4. 战斗结束后生成结果事件

**验证标准**: 战斗持续 10~60s，城防值每秒衰减，最终生成胜负结果

---

### Task 8: I14 攻占结果结算与事件生成 (P2, Medium)

**问题**: 战斗结束后需要生成可回查的结果事件。

**计划**:
1. 定义 `SiegeResultEvent` 接口: 战斗时长、城防变化、伤亡详情、奖励列表
2. 战斗结束时生成事件并存入 SiegeTaskManager
3. 事件可被 UI 层订阅和回查
4. 与现有 SiegeResultModal 集成显示

**验证标准**: 战斗结束后可查询完整结果事件

---

### Task 9: I15 编队伤亡状态更新 + 自动回城 (P2, Medium)

**问题**: P10 回城阶段需要自动沿原路返回并更新兵力/将领状态。

**计划**:
1. 战斗结算后触发回城: `advanceStatus('returning')`
2. 使用 `calculateMarchRoute` 计算返回路线(已实现)
3. 创建返回行军精灵，沿原路返回
4. 到达源城市后:
   - 兵力归入城市驻防池
   - 受伤将领开始恢复计时
   - 更新编队状态为已归队
5. 处理 returnRoute null fallback (已有兜底逻辑)
6. 完成任务清理: `advanceStatus('completed')` + `removeCompletedTasks()`

**验证标准**: 战斗结束后编队自动回城，兵力/将领状态正确更新

---

## 对抗性评测重点

- [ ] siegeTaskId 是否在 serialize/deserialize 后保留 (R5c P1-1)
- [ ] 事件 payload 是否有类型定义替代 any (R5c P1-3)
- [ ] WorldMapTab 与 SiegeTaskPanel 集成是否测试覆盖 (R5c P2)
- [ ] SiegeTaskManager 全状态链路是否有集成测试 (R5c P2)
- [ ] handleSiegeConfirm 注释是否准确 (R5c P2)
- [ ] I12 行军->攻占动画是否无缝切换 (PLAN.md)
- [ ] I13 战斗回合制是否实现10s~60s衰减 (PLAN.md)
- [ ] I14 结果事件是否可生成和回查 (PLAN.md)
- [ ] I15 编队回城是否自动完成、兵力是否正确归入 (PLAN.md)
- [ ] handleSiegeConfirm 是否仍然绕过异步流程(同步直接执行siege)
- [ ] 新增代码是否有与现有行军系统断裂的风险(回顾R5b教训)

## 质量目标

| 指标 | 目标 |
|------|------|
| P0 | 0 |
| P1 | 0 (含 R5c 遗留 P1) |
| P2 | 0 (含 R5c 遗留 P2) |
| 测试通过率 | 100% |
| 新增集成测试 | >= 10 场景 |
| siegeTaskId round-trip | 验证通过 |
| 事件 handler any 类型 | 0 处 |
| 行军->攻城断裂 | 已修复(R5b核心问题) |

## 风险评估

| 风险 | 概率 | 影响 | 缓解措施 |
|------|:----:|:----:|----------|
| I12~I15 实现量大超出单轮容量 | 高 | 中 | 按优先级裁剪，P1 必须完成，P2 可延后 |
| 战斗回合制改变现有同步攻城流程 | 中 | 高 | 保持 SiegeTaskManager 作为中间层，渐进替换 |
| 事件 payload 类型改动影响测试 | 低 | 低 | 先定义接口，再逐步替换 any |
| 新动画系统与现有渲染冲突 | 中 | 中 | 使用独立状态机管理动画阶段 |

## 与 PLAN.md 对齐

本轮完成后 PLAN.md 预期状态变化:

| 功能 | 当前状态 | R5d 预期 |
|------|:--------:|:--------:|
| I12 行军->攻占动画无缝切换 | ⬜ | 🔄/✅ |
| I13 攻占战斗回合制 | ⬜ | 🔄/✅ |
| I14 攻占结果结算与事件生成 | ⬜ | 🔄 |
| I15 编队伤亡状态更新+自动回城 | ⬜ | 🔄 |
| D3-1 像素地图渲染60fps | 🔄 | 🔄(后续R7) |
| D3-2 脏标记渲染 | 🔄 | 🔄(后续R7) |

---

*Round 5d 计划 | 2026-05-04*
