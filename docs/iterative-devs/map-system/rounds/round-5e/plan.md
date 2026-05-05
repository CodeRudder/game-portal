# Round 5e 计划

> **迭代**: map-system
> **轮次**: Round 5e
> **来源**: `PLAN.md` + Round 5d Judge ruling
> **日期**: 2026-05-04

## 本轮焦点

| 优先级 | 领域 | 来源 | 原因 |
|:------:|------|------|------|
| P1 | handleCancelled listener 未清理 (内存泄漏) | R5d Judge P1-01 | 已确认 bug：useEffect cleanup 缺少 off('march:cancelled') |
| P2 | Payload 接口在 emit 端装饰性问题 | R5d Judge P2-01 | emit<T=unknown> 默认泛型，接口无编译期约束 |
| P2 | 本地 eventBus 类型为 `any` | R5d Judge P2-02 | WorldMapTab.tsx 内 eventBus `as any`，类型安全仅消费端单向 |
| P2 | MarchArrivedPayload 缺少 siegeTaskId | R5d Judge P2-03 | march:arrived 与 march:cancelled 的 payload 不对称 |
| P2 | 同步 siege 执行阻塞动画帧 | R5d Judge P2-04 | handleArrived 同步链式调用在 rAF 回调内执行 |
| P1 | I12 行军->攻占动画无缝切换 | PLAN.md R5c/R5d | 行军到达后动画状态切换未实现 |
| P1 | I13 攻占战斗回合制(10s~60s城防衰减) | PLAN.md R5c/R5d | 城防衰减引擎+UI均未完成 |
| P2 | I14 攻占结果结算与事件生成 | PLAN.md R5c/R5d | 战斗结果事件可回查 |
| P2 | I15 编队伤亡状态更新+自动回城 | PLAN.md R5c/R5d | P10 回城闭环 |

## 详细任务分解

### Task 1: handleCancelled 清理缺失修复 (P1, Small)

**问题**: `WorldMapTab.tsx` 的 useEffect cleanup 中只清理了 `handleArrived`，遗漏了 `handleCancelled`，导致潜在的内存泄漏和卸载后状态更新。

**计划**:
1. 在 `WorldMapTab.tsx` useEffect cleanup return 函数中添加:
   ```typescript
   eventBus.off('march:cancelled', handleCancelled);
   ```
2. 添加对应测试：模拟组件 mount/unmount 周期，验证两个 listener 均被清理
3. 检查是否有其他 listener 注册点被遗漏

**验证标准**: cleanup 函数包含所有已注册 listener 的 off 调用；测试验证 mount/unmount 后无残留 listener

---

### Task 2: Payload 接口 emit 端泛型约束 (P2, Small)

**问题**: `MarchingSystem.ts` 中 4 处 `emit()` 调用未使用 Payload 接口作为泛型参数，接口仅为装饰性文档。

**计划**:
1. 将 `emit('march:arrived', {...})` 改为 `emit<MarchArrivedPayload>('march:arrived', {...})`
2. 将 `emit('march:created', {...})` 改为 `emit<MarchCreatedPayload>('march:created', {...})`
3. 将 `emit('march:started', {...})` 改为 `emit<MarchStartedPayload>('march:started', {...})`
4. 将 `emit('march:cancelled', {...})` 改为 `emit<MarchCancelledPayload>('march:cancelled', {...})`
5. 验证 IEventBus.emit<T> 签名是否支持泛型参数（events.ts:88）
6. 运行构建确认类型检查通过

**验证标准**: 所有 emit 调用使用显式泛型参数；`vite build` 通过无类型错误

---

### Task 3: 本地 eventBus 类型化 (P2, Medium)

**问题**: `WorldMapTab.tsx` 中本地 eventBus 对象使用 `as any` 类型转换，削弱了跨组件类型保证。

**计划**:
1. 移除 `as any` 类型转换
2. 使用 `IEventBus` 接口类型化本地 eventBus 对象
3. 将 `handler: (payload: any) => void` 改为泛型或联合类型签名
4. 确保 `on`/`off`/`emit` 方法签名与 `IEventBus` 一致
5. 验证 `handleArrived`/`handleCancelled` 注册点的类型匹配
6. 运行测试确认无回归

**验证标准**: `as any` 在 eventBus 构造处消除；类型系统在 emit 和 on 两侧均提供约束；构建和测试通过

---

### Task 4: MarchArrivedPayload 添加 siegeTaskId (P2, Small)

**问题**: `MarchArrivedPayload` 接口缺少 `siegeTaskId` 字段，导致 `handleArrived` 必须通过二次查找 `marchingSystem.getMarch()` 获取 siegeTaskId，存在脆弱的时序耦合。

**计划**:
1. 在 `MarchArrivedPayload` 接口中添加 `siegeTaskId?: string`
2. 在 `MarchingSystem.ts` 的 `march:arrived` emit 调用中包含 `siegeTaskId: march.siegeTaskId`
3. 在 `handleArrived` 中改为直接从 `data.siegeTaskId` 读取，移除二次查找
4. 更新 `handleArrived` 中的防御性 `data ?? {}` 为直接解构（类型已保证）
5. 更新相关测试

**验证标准**: `handleArrived` 不再需要 `getMarch()` 二次查找；`data ?? {}` 可简化为直接解构；所有测试通过

---

### Task 5: 同步 siege 执行异步化 (P2, Medium)

**问题**: `handleArrived` 在 requestAnimationFrame 回调内同步执行攻城计算、伤亡结算、行军创建等操作，可能阻塞渲染帧。

**计划**:
1. 将 `handleArrived` 中的攻城执行链包裹在 `queueMicrotask()` 或 `setTimeout(0, ...)` 中
2. 保持动画状态更新同步（确保 UI 即时响应行军到达）
3. 将 `executeSiege()`、`createMarch()`、`startMarch()` 等操作延迟到微任务中执行
4. 处理延迟期间的中间状态：设置 'processing' 标记防止重复触发
5. 添加测试验证异步执行链的完整性

**验证标准**: rAF 回调内不再包含同步攻城计算；微任务中完成攻城链路；动画帧时间 < 16ms

---

### Task 6: I12 行军->攻占动画无缝切换 (P1, Large)

**问题**: 行军到达后需要从行军动画状态无缝切换到攻占动画状态，当前无切换逻辑。

**计划**:
1. 在 `handleArrived` 中添加动画状态切换逻辑（与 Task 5 异步化配合）
2. 定义动画阶段枚举: `marching` -> `rallying` -> `sieging` -> `result`
3. 不同策略对应不同攻占动画:
   - 强攻: 直接冲击动画
   - 围困: 包围收缩动画
   - 夜袭: 潜入+爆发动画
   - 内应: 城门打开动画
4. 使用 CSS transition 或 requestAnimationFrame 实现平滑过渡
5. 添加动画完成回调触发下一阶段（I13 战斗开始）
6. 动画阶段与 SiegeTaskManager 状态同步

**验证标准**: 行军到达后动画连续无跳变；4 种策略各有对应动画；动画阶段与任务状态一致

---

### Task 7: I13 攻占战斗回合制 (P1, Large)

**问题**: 攻城战斗需要支持 10s~60s 的城防衰减机制，当前为即时执行。

**计划**:
1. 在引擎层实现 `SiegeBattleSystem`:
   - 城防值初始化(基于城市等级和基础防御)
   - 每回合衰减(基于编队战力 + 策略加成)
   - 回合间隔 1s，总计 10~60 回合
   - 城防归零 = 胜利；回合耗尽 = 根据剩余城防判定失败/惨败
2. 定义 `SiegeBattleProgress` 接口追踪战斗进度:
   ```typescript
   interface SiegeBattleProgress {
     siegeTaskId: string;
     currentRound: number;
     maxRounds: number;
     cityDefense: number;
     maxCityDefense: number;
     attackerPower: number;
     strategy: SiegeStrategy;
   }
   ```
3. SiegeTaskManager 在 'sieging' 状态中运行战斗循环
4. 战斗进度事件: 每回合 emit `siege:round` 事件，UI 可订阅显示实时进度
5. 战斗结束后生成结果事件并 advanceStatus('settling')
6. 为 SiegeBattleSystem 编写单元测试覆盖:
   - 城防归零判定胜利
   - 回合耗尽判定失败/惨败
   - 不同策略的衰减速率差异
   - 边界: 城防为 0 时攻击 / 战力为 0 时攻击

**验证标准**: 战斗持续 10~60s；城防值每秒衰减；最终生成胜负结果；4 种策略有不同衰减公式

---

### Task 8: I14 攻占结果结算与事件生成 (P2, Medium)

**问题**: 战斗结束后需要生成可回查的结果事件。

**计划**:
1. 定义 `SiegeResultEvent` 接口:
   ```typescript
   interface SiegeResultEvent {
     siegeTaskId: string;
     cityId: string;
     result: 'victory' | 'defeat' | 'pyrrhic';
     battleDuration: number;
     roundsFought: number;
     cityDefenseRemaining: number;
     casualties: CasualtyResult;
     rewards: SiegeReward[];
     timestamp: number;
   }
   ```
2. 战斗结束时生成事件并存入 SiegeTaskManager
3. 事件可被 UI 层订阅（通过 `siege:result` 事件）
4. 与现有 SiegeResultModal 集成显示
5. 结果事件支持按 siegeTaskId 回查

**验证标准**: 战斗结束后可查询完整结果事件；SiegeResultModal 可显示结果详情

---

### Task 9: I15 编队伤亡状态更新 + 自动回城 (P2, Medium)

**问题**: P10 回城阶段需要自动沿原路返回并更新兵力/将领状态。

**计划**:
1. 战斗结算后触发回城: `advanceStatus('returning')`
2. 使用 `calculateMarchRoute` 计算返回路线（已实现）
3. 创建返回行军精灵，沿原路返回
4. 到达源城市后:
   - 兵力归入城市驻防池
   - 受伤将领开始恢复计时
   - 更新编队状态为已归队
5. 处理 returnRoute null fallback（已有兜底逻辑）
6. 完成任务清理: `advanceStatus('completed')` + `removeCompletedTasks()`
7. 编写集成测试覆盖完整回城链路:
   - 胜利后自动回城
   - 失败后自动回城（兵力减少）
   - 将领受伤状态正确设置

**验证标准**: 战斗结束后编队自动回城；兵力/将领状态正确更新；SiegeTask 状态流转至 completed

---

## 对抗性评测重点

- [ ] handleCancelled 是否在 useEffect cleanup 中正确清理 (R5d P1-01)
- [ ] 所有 emit 调用是否使用显式泛型参数 (R5d P2-01)
- [ ] 本地 eventBus 是否消除 `as any` (R5d P2-02)
- [ ] MarchArrivedPayload 是否包含 siegeTaskId (R5d P2-03)
- [ ] handleArrived 是否消除对 getMarch 的二次查找 (R5d P2-03)
- [ ] siege 执行是否从 rAF 回调中异步化 (R5d P2-04)
- [ ] I12 行军->攻占动画是否无缝切换 (PLAN.md)
- [ ] I12 4种策略是否各有对应动画 (PLAN.md)
- [ ] I13 战斗回合制是否实现 10s~60s 衰减 (PLAN.md)
- [ ] I13 不同策略是否有不同衰减公式 (PLAN.md)
- [ ] I14 结果事件是否可生成和回查 (PLAN.md)
- [ ] I15 编队回城是否自动完成 (PLAN.md)
- [ ] I15 兵力是否正确归入城市驻防池 (PLAN.md)
- [ ] I15 受伤将领恢复计时是否正确启动 (PLAN.md)
- [ ] SiegeBattleSystem 边界条件: 战力为 0 / 城防为 0 / 空编队 (边界攻击)
- [ ] 动画阶段与 SiegeTaskManager 状态同步 (状态攻击)
- [ ] 回城行军创建是否在攻城结算后（时序正确） (序列攻击)
- [ ] 多个攻城任务并发时状态是否隔离 (并发攻击)

## 质量目标

| 指标 | 目标 |
|------|------|
| P0 | 0 |
| P1 | 0（含 R5d 遗留 P1-01） |
| P2 | 0（含 R5d 遗留 P2-01~P2-04） |
| 测试通过率 | 100% |
| 新增单元测试 | >= 15 场景（SiegeBattleSystem + 动画系统） |
| 新增集成测试 | >= 8 场景（攻城链路 P6~P10） |
| eventBus `as any` | 0 处 |
| emit 无泛型参数 | 0 处 |
| listener 清理遗漏 | 0 处 |
| 二次查找 siegeTaskId | 0 处 |

## 风险评估

| 风险 | 概率 | 影响 | 缓解措施 |
|------|:----:|:----:|----------|
| I12~I15 实现量大超出单轮容量 | 高 | 中 | P1 必须完成（Task 1, 6, 7），P2 按优先级裁剪（Task 2~5, 8~9） |
| SiegeBattleSystem 改变现有同步攻城流程 | 中 | 高 | 保持 SiegeTaskManager 作为中间层，渐进替换；Task 5 异步化先行 |
| eventBus 类型化改动影响测试 | 低 | 低 | 先定义接口，再逐步替换；构建通过即验证 |
| 动画系统与现有渲染冲突 | 中 | 中 | 使用独立状态机管理动画阶段；动画阶段与任务状态解耦 |
| 回城行军与现有行军系统冲突 | 低 | 高 | 复用现有 createMarch/startMarch API；与 Task 4 siegeTaskId 传递联动 |

## 与 PLAN.md 对齐

本轮完成后 PLAN.md 预期状态变化:

| 功能 | 当前状态 | R5e 预期 |
|------|:--------:|:--------:|
| I12 行军->攻占动画无缝切换 | ⬜ | ✅ |
| I13 攻占战斗回合制 | ⬜ | ✅ |
| I14 攻占结果结算与事件生成 | ⬜ | ✅/🔄 |
| I15 编队伤亡状态更新+自动回城 | ⬜ | ✅/🔄 |
| R5d P1-01 handleCancelled 清理 | ❌ | ✅ |
| R5d P2-01 emit 泛型约束 | ❌ | ✅ |
| R5d P2-02 eventBus 类型化 | ❌ | ✅ |
| R5d P2-03 MarchArrivedPayload siegeTaskId | ❌ | ✅ |
| R5d P2-04 异步化 siege 执行 | ❌ | ✅ |
| D3-1 像素地图渲染60fps | 🔄 | 🔄(后续R7) |
| D3-2 脏标记渲染 | 🔄 | 🔄(后续R7) |

## 实施优先序

```
Phase 1 — R5d 遗留问题清理（必须）
  Task 1 (P1, Small)  → handleCancelled 清理
  Task 2 (P2, Small)  → emit 泛型约束
  Task 3 (P2, Medium) → eventBus 类型化
  Task 4 (P2, Small)  → MarchArrivedPayload siegeTaskId
  Task 5 (P2, Medium) → 异步化 siege 执行

Phase 2 — I 系列新功能（核心）
  Task 6 (P1, Large)  → I12 动画无缝切换
  Task 7 (P1, Large)  → I13 战斗回合制

Phase 3 — I 系列收尾（按容量裁剪）
  Task 8 (P2, Medium) → I14 结果结算
  Task 9 (P2, Medium) → I15 编队回城
```

---

*Round 5e 计划 | 2026-05-04*
