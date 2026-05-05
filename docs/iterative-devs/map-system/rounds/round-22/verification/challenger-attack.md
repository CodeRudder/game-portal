# Challenger 攻击报告 — Round 22 Phase 1 (P1~P5)

> 攻击日期: 2026-05-05
> 攻击角色: Challenger
> 目标: Builder声称 Phase 1 有 21/27 已完成
> 策略: 从代码实现、测试有效性、集成断裂、流程断裂、数据一致性五个维度系统性攻击

---

## 总览

| 类别 | 有效质疑数 |
|------|-----------|
| P0 (推翻"已完成"结论) | 7 |
| P1 (严重问题，降低完成度) | 7 |
| P2 (中等问题，影响质量评估) | 5 |
| **合计** | **19** |

Builder原结论: 21/27 已完成。经攻击后修正估计: **14/27 已完成** (降级7项)。

---

## 1. 漏洞攻击 — 代码是否真实存在

### ATT-01: P2-6 并发上限 SiegeSystem 层完全缺失

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 | 优先级 |
|--------|-------------|-------------|-------------|--------|
| P2-6 并发上限 | "部分完成" | SiegeSystem.checkSiegeConditions (L240-291) 的6条校验中，**没有任何一条检查 activeCount**。SiegeSystem.ts 中全文搜索 `activeCount` 返回0结果。ExpeditionSystem 的 MAX_EXPEDITION_FORCES=3 仅限制编队数量，与 SiegeSystem 的并发攻城任务数是两个不同概念。绕过 ExpeditionSystem 直接调用 SiegeSystem 即可创建无限并发攻城 | SiegeSystem.checkSiegeConditions 中缺少 `if (activeCount >= MAX_CONCURRENT_SIEGES)` 检查 | **P0** |

**证据**: `SiegeSystem.ts:240-291` 完整的 checkSiegeConditions 方法中检查了: TARGET_NOT_FOUND, TARGET_ALREADY_OWNED, NOT_ADJACENT, INSUFFICIENT_TROOPS, INSUFFICIENT_GRAIN, STRATEGY_ITEM_MISSING, INSIDER_EXPOSED, DAILY_LIMIT_REACHED, CAPTURE_COOLDOWN — 共9个条件，但没有并发上限检查。

### ATT-02: P5-5 acquireSiegeLock 在取消路径不释放

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 | 优先级 |
|--------|-------------|-------------|-------------|--------|
| P5-5 攻城锁全路径生效 | "已完成" | acquireSiegeLock 在 createTask 时获取(L104)，仅在 advanceStatus 到 completed(L176) 和 removeCompletedTasks(L520) 时释放。**cancelSiege 方法(L338-386)将任务状态改为 'returning' 但不释放锁**。如果取消后没有完成 returning->completed 流程，锁将保持直到5分钟超时。这意味着取消攻城后同一目标最多5分钟内无法再次攻城 | cancelSiege 中应调用 releaseSiegeLock 或在 returning 状态完成后确保锁释放的测试 | **P0** |

**证据**: `SiegeTaskManager.ts:338-386` cancelSiege 方法中 task.status 改为 'returning' 但无 releaseSiegeLock 调用。对比 L176 (advanceStatus completed 时释放锁)。

### ATT-03: P4-4 内应信三态测试覆盖不完整

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 | 优先级 |
|--------|-------------|-------------|-------------|--------|
| P4-4 内应信三态 | "已完成" | InsiderLetterSystem.test.ts 的21个测试全部围绕"获取/存储/消费/堆叠上限/序列化"，**没有一个测试覆盖"暴露冷却"状态**。InsiderLetterSystem 本身根本没有 exposed 概念 — 暴露冷却逻辑完全在 SiegeSystem.insiderExposures (Map) 中管理(L669-678)。InsiderLetterSystem 只有 canConsume/count>0 两态，缺少第三个"暴露冷却"状态。三态实际分散在 SiegeSystem + SiegeConfirmModal 中，InsiderLetterSystem.test.ts 无法验证三态集成 | InsiderLetterSystem.test.ts 中无 "exposed/暴露" 相关测试；InsiderLetterSystem.ts 中无 exposed 状态管理代码 | **P1** |

**证据**: 搜索 InsiderLetterSystem.test.ts 中 "暴露/exposed" 关键词返回0结果。InsiderLetterSystem.ts 中无 insiderExposures 相关字段。

### ATT-04: P2-5 攻城冷却与 CooldownManager 零集成

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 | 优先级 |
|--------|-------------|-------------|-------------|--------|
| P2-5 攻城冷却 | "已完成" | SiegeSystem 自行管理冷却 (captureTimestamps Map + isInCaptureCooldown 方法)，**CooldownManager 在整个攻城流程中从未被引用**。grep 搜索所有生产代码(ts/tsx)，CooldownManager 仅在自己的定义文件中出现。CooldownManager.test.ts 的17个测试全部通过，但测试的是一个**孤立模块**，从未与 SiegeSystem/SiegeTaskManager/WorldMapTab 集成 | SiegeSystem 或 WorldMapTab 中应 import 并使用 CooldownManager 的证据 | **P1** |

**证据**: `grep -rn "CooldownManager" src/games/three-kingdoms/engine/map/*.ts` (排除test) 仅返回 CooldownManager.ts 自身的定义和导出。WorldMapTab.tsx、SiegeSystem.ts、SiegeTaskManager.ts 中无任何 CooldownManager 引用。

---

## 2. 幻觉攻击 — 测试是否真的有效

### ATT-05: SiegeSystem.test.ts 使用 mock registry

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 | 优先级 |
|--------|-------------|-------------|-------------|--------|
| SiegeSystem.test.ts "使用真实TerritorySystem，非mock" | "有效" | TerritorySystem 确实是真实实例(new TerritorySystem())，但 **registry.get 是 mock 函数** (`vi.fn().mockImplementation(...)`)。SiegeSystem 通过 `this.territorySys?.getTerritoryById()` 调用 TerritorySystem，而 TerritorySystem.init() 依赖 registry 获取数据。用 mock registry 初始化的 TerritorySystem 内部数据为空地图，所有领土数据来自 TerritorySystem 的硬编码默认数据而非动态加载。更关键的是: **eventBus 全部是 vi.fn() mock**，SiegeSystem 的攻城执行依赖 eventBus.emit 触发后续流程，但测试中 emit 是空操作 | 用 mock registry 初始化真实 TerritorySystem 的边界条件测试；eventBus emit 后续链路是否实际执行的验证 | **P1** |

**证据**: `SiegeSystem.test.ts:26-53` createMockDeps 函数中 registry.get 是 `vi.fn().mockImplementation(...)`，eventBus.emit 是 `vi.fn()`。

### ATT-06: SiegeStrategy.test.ts 使用 jest.fn() 而非 vi.fn()

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 | 优先级 |
|--------|-------------|-------------|-------------|--------|
| SiegeStrategy.test.ts "四系统联动" | "有效" | 该测试文件使用 `jest.fn()` (L23, L26) 而项目配置为 vitest。更严重的是: **deps 对象使用 `configRegistry: {} as any` 而 ISystemDeps 接口定义的属性名是 `config`** (ISystemDeps.config: IConfigRegistry)。这意味着传递给 init() 的 deps 对象缺少 `config` 属性。虽然 TypeScript 的 `as any` 绕过了类型检查，但运行时 init 中访问 `this.deps.config` 会得到 undefined。此外，`jest.fn()` 在 vitest 环境下可能不可用(取决于 vitest 配置是否兼容 jest globals) | 在纯 vitest 环境下运行该测试的确认；config vs configRegistry 命名不一致的修复 | **P1** |

**证据**: `SiegeStrategy.test.ts:28` — `return { eventBus, registry, configRegistry: {} as any }`。`ISystemDeps` 接口定义在 `subsystem.ts:39` — `readonly config: IConfigRegistry`。

### ATT-07: SiegeConfirmModal.test.tsx 只测渲染未测确认交互

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 | 优先级 |
|--------|-------------|-------------|-------------|--------|
| SiegeConfirmModal.test.tsx "有效" | "有效" | 测试文件注释声称覆盖"确认按钮：条件全通过时可点击"，但**全文搜索 fireEvent.click 只有1处 — 点击取消按钮**(L199)。**确认按钮(发动攻城)的点击交互从未测试**。onConfirm callback 从未被 fireEvent 触发验证。所有测试都是 render + 静态断言，没有交互逻辑测试 | fireEvent.click 确认按钮 + onConfirm 被调用的测试 | **P0** |

**证据**: `SiegeConfirmModal.test.tsx:199` — `fireEvent.click(cancelBtn)` 是唯一的 fireEvent.click 调用，测试的是取消按钮。确认按钮交互零覆盖。

### ATT-08: InsiderLetterSystem.test.ts 同样使用 jest.fn()

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 | 优先级 |
|--------|-------------|-------------|-------------|--------|
| InsiderLetterSystem.test.ts "有效" | "有效" | 与 ATT-06 同样的问题: 使用 `jest.fn()` (L11, L14) 而项目配置为 vitest。使用 `configRegistry: {} as any` 与 ISystemDeps.config 命名不匹配。21个测试虽然通过，但运行环境可能依赖 vitest-jest 兼容层而非真实环境 | 在纯 vitest 环境下的运行确认 | **P2** |

---

## 3. 无证据攻击 — 集成测试空白

### ATT-09: P1-P5 完整链路零集成测试覆盖

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 | 优先级 |
|--------|-------------|-------------|-------------|--------|
| 21/27 已完成 | Builder自认"无完整端到端集成测试" | Builder自己承认了这个致命缺陷。165个引擎测试 + 108个UI测试全部是单元/模块级别，P1(选城)->P2(校验)->P3(编队)->P4(策略)->P5(任务创建) 的完整链路**没有任何自动化测试**。每个子系统的单元测试通过，不能证明系统间串联正确。这是"左轮手枪的每个零件都完美，但组装后不发射"的典型问题 | P1到P5完整链路的集成测试: 点击城池 -> 校验 -> 选编队 -> 选策略 -> 创建任务 -> 任务面板更新 | **P0** |

### ATT-10: WorldMapTab.handleSiegeConfirm 无任何测试

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 | 优先级 |
|--------|-------------|-------------|-------------|--------|
| P5 任务创建流程 | "已完成" (P5-1~P5-5) | handleSiegeConfirm (L1109-1208) 是P1-P5完整链路的核心入口函数，负责: 计算行军路线、创建SiegeTask、创建行军单位、关联任务ID、推进状态、更新UI。**这个120行的关键函数没有任何直接测试**。WorldMapTab.test.tsx 中 grep "handleSiegeConfirm" 返回0结果。该函数包含多个早期返回路径(L1110, L1113, L1120, L1128, L1168)，每个分支都未被测试 | handleSiegeConfirm 的单元测试或集成测试 | **P0** |

### ATT-11: ui-interaction.integration.test.tsx 非攻城集成测试

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 | 优先级 |
|--------|-------------|-------------|-------------|--------|
| P3 编队选择集成 | "有效" | 该测试文件实际只测了 ExpeditionForcePanel 组件的点击选择和滑块交互，不涉及任何攻城系统(SiegeSystem/SiegeTaskManager/SiegeStrategy)。标题虽为"集成测试"，但实际是 ExpeditionForcePanel 的组件级单元测试。编队选择 -> 策略选择 -> 任务创建的数据传递链路完全未被测试 | ExpeditionForcePanel -> SiegeConfirmModal -> WorldMapTab.handleSiegeConfirm 的数据流测试 | **P1** |

---

## 4. 集成断裂攻击

### ATT-12: SiegeSystem -> SiegeTaskManager 数据流未串联

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 | 优先级 |
|--------|-------------|-------------|-------------|--------|
| P2校验 -> P5任务创建 数据流 | "基本完成" | SiegeSystem.checkSiegeConditions 校验通过后，WorldMapTab.handleSiegeConfirm 调用 SiegeTaskManager.createTask 创建任务。但 **SiegeSystem 和 SiegeTaskManager 之间没有直接依赖关系** — SiegeSystem 不知道 SiegeTaskManager 的存在，SiegeTaskManager 不知道 SiegeSystem 的校验结果。校验结果仅通过 WorldMapTab 的 React state 传递给 SiegeConfirmModal 渲染，真正的任务创建依赖 siegeTaskManagerRef.current 而非 SiegeSystem 的校验。如果两个系统的校验逻辑不一致(例如 P2-6 并发上限只在 SiegeTaskManager 层)，会出现校验通过但创建失败的情况 | SiegeSystem -> SiegeTaskManager 的校验一致性测试 | **P0** |

### ATT-13: 编队兵力与 SiegeTask 中的兵力不同步

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 | 优先级 |
|--------|-------------|-------------|-------------|--------|
| P3 编队 -> P5 任务兵力同步 | "已完成" | WorldMapTab.handleSiegeConfirm L1136 使用 `selectedTroops > 0 ? selectedTroops : availableTroops` 计算出兵量，但 L1144-1166 创建 task 时 expedition.troops 来自 expeditionSelection.troops(L1155) 或 deployTroops(L1161)。而 L1178 createMarch 使用 deployTroops(L1180)。**三个系统(SiegeTask.expedition.troops, March.troops, 实际扣减的 resources)可能不一致**: ExpeditionSelection 的 troops、deployTroops(可能不同)、costEstimate(由 SiegeSystem 计算)三者分别传递给不同系统，无统一来源 | expedition.troops == march.troops == deductResources.troops 的一致性断言 | **P1** |

### ATT-14: 每日次数重置依赖 update() 调用频率

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 | 优先级 |
|--------|-------------|-------------|-------------|--------|
| P2-4 每日次数跨天重置 | "已完成" | SiegeSystem.update() (L153-160) 中检查跨天重置 dailySiegeCount，但依赖 `new Date().toISOString().slice(0,10)` 进行日期比较。问题: **update() 调用频率取决于游戏引擎主循环，如果玩家在 23:58 发起攻城、update() 在 00:00 前未再调用，则 lastSiegeDate 不会更新，下次 checkSiegeConditions 时 dailySiegeCount 仍为旧值**。重置逻辑不在 checkSiegeConditions 中，而是依赖外部 update() 调用 | 跨天场景的竞态条件测试；update() 不被调用时的行为测试 | **P1** |

---

## 5. 流程断裂攻击

### ATT-15: 用户从点击城池到看到任务卡片的完整链路有断裂点

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 | 优先级 |
|--------|-------------|-------------|-------------|--------|
| P1->P5 完整链路 | "部分完成" | 完整链路: 点击城池 -> TerritoryInfoPanel 显示 -> 点击攻占 -> SiegeConfirmModal 弹出 -> 校验 -> 选编队 -> 选策略 -> 点确认 -> handleSiegeConfirm -> createTask -> createMarch -> advanceStatus(marching) -> setActiveSiegeTasks -> SiegeTaskPanel 显示。**断裂点**: (1) handleSiegeConfirm 中 createMarch 失败时(L1178返回null/undefined)，task已创建但march未创建，task卡在 preparing 状态，**UI不显示任务**(setActiveSiegeTasks在L1198才调用，但march创建失败不会到达)；(2) marchingSystem.startMarch 可能静默失败； (3) siegeTaskManagerRef.current 为 null 时(L1135)直接 return，无用户反馈 | createMarch 失败时的回滚/错误处理测试；task创建成功但march失败的场景测试 | **P0** |

### ATT-16: 攻城确认弹窗关闭 -> 任务面板更新的时间窗口

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 | 优先级 |
|--------|-------------|-------------|-------------|--------|
| P5-3 任务面板更新 | "已完成" | SiegeTaskPanel 的73个测试全部是独立的组件渲染测试(传入props验证UI)。真实流程中，SiegeTaskPanel 的数据来自 WorldMapTab 的 `activeSiegeTasks` state (useState)。**WorldMapTab.handleSiegeConfirm 是同步函数**，L1198 setActiveSiegeTasks 和 L1200 setSiegeVisible(false) 在同一个 useCallback 中执行。在 React 的批量更新机制下，两个 setState 会在同一次渲染中生效。但如果 createTask 或 createMarch 抛出异常(未被 try-catch 包裹)，setActiveSiegeTasks 不会执行，SiegeTaskPanel 不会更新，而弹窗已关闭(setSiegeVisible 在异常前可能已执行L1121/1129/1171) | handleSiegeConfirm 的异常路径测试；弹窗关闭但任务未创建的边界场景 | **P1** |

### ATT-17: 每日次数重置与跨天场景

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 | 优先级 |
|--------|-------------|-------------|-------------|--------|
| P2-4 跨天重置 | "已完成" | SiegeSystem.test.ts L475-558 的每日次数测试虽然覆盖了6个场景，但这些测试直接调用 SiegeSystem 方法，**绕过了 WorldMapTab 的 handleSiegeConfirm 流程**。真实场景中，dailySiegesRemaining 的显示值来自哪里? SiegeConfirmModal 接收 `dailySiegesRemaining` prop，但 WorldMapTab 是否正确从 SiegeSystem 获取并传递该值? 没有集成测试验证 WorldMapTab -> SiegeSystem.getDailySiegesRemaining() -> SiegeConfirmModal 的数据传递 | WorldMapTab 正确传递 dailySiegesRemaining 到 SiegeConfirmModal 的测试 | **P2** |

---

## 6. 数据一致性攻击

### ATT-18: deductSiegeResources 失败时 SiegeTask 泄漏

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 | 优先级 |
|--------|-------------|-------------|-------------|--------|
| P5-1 任务创建原子性 | "部分完成" | Builder已识别此问题但将其定为"部分完成"而非"未完成"。实际问题比Builder描述的更严重: **WorldMapTab.handleSiegeConfirm 中根本没有调用 deductSiegeResources**。资源扣减只在 SiegeSystem.executeSiege 中发生(L595, L621)，而 executeSiege 是在行军到达后异步调用的。这意味着: (1) createTask 创建任务时无资源扣减；(2) 任务已创建并显示在面板上，但玩家可能在此期间花费掉资源；(3) 到达时 executeSiege 发现资源不足，扣减静默失败(try-catch 吞掉异常 L641)，**任务继续执行但资源未扣减** | handleSiegeConfirm 中应立即扣减资源或在 deductSiegeResources 失败时回滚任务的测试 | **P0** |

**证据**: `SiegeSystem.ts:634-643` — deductSiegeResources 使用 try-catch 静默处理失败。`WorldMapTab.tsx:1109-1208` — handleSiegeConfirm 中无 deductSiegeResources 调用。

### ATT-19: 攻城冷却存储格式与序列化一致性

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 | 优先级 |
|--------|-------------|-------------|-------------|--------|
| P2-5 攻城冷却存储 | "已完成" | SiegeSystem 使用 `Map<string, number>` (captureTimestamps) 管理冷却时间戳，序列化时转为 `Record<string, number>` (L492-494)，反序列化时从 Record 恢复 (L522-528)。但 **CooldownManager 有自己独立的存储格式** (CooldownEntry 含 id/type/startAt/duration/endAt/status)，两种冷却存储格式完全不兼容。如果任何代码期望使用 CooldownManager 的统一格式来读取 SiegeSystem 的冷却数据，将无法工作 | 统一使用 CooldownManager 管理冷却的集成证据；或明确冷却存储格式规范的文档 | **P2** |

---

## 7. 修正后的完成度评估

### 被降级的项 (从"已完成"降级)

| 计划任务ID | 原结论 | 修正结论 | 降级原因 |
|-----------|--------|---------|---------|
| P2-6 并发上限 | 部分完成 | **未完成** | SiegeSystem层完全缺失并发检查，ExpeditionSystem间接限制不等价 |
| P4-4 内应信三态 | 已完成 | **部分完成** | InsiderLetterSystem.test.ts未覆盖暴露冷却态，三态分散在两个系统中 |
| P5-1 任务创建原子性 | 部分完成 | **未完成** | handleSiegeConfirm无资源扣减，executeSiege的try-catch静默吞异常，任务泄漏 |
| P5-3 任务面板更新 | 已完成 | **部分完成** | 73个测试均为独立渲染测试，未验证WorldMapTab->SiegeTaskPanel的数据流 |
| P5-5 攻城锁定 | 已完成 | **部分完成** | cancelSiege不释放锁，存在5分钟死锁窗口 |

### 被质疑测试有效性的项

| 计划任务ID | 原测试评级 | 修正评级 | 质疑原因 |
|-----------|-----------|---------|---------|
| P2-7 校验失败提示 | 有效 | **部分有效** | SiegeConfirmModal.test.tsx未测确认按钮交互，只测渲染 |
| P4-1~P4-5 策略测试 | 有效 | **有效性存疑** | SiegeStrategy.test.ts使用jest.fn()+configRegistry命名不匹配 |

### 集成空白的项 (单元通过但集成未验证)

| 链路 | 缺失的集成测试 |
|------|--------------|
| WorldMapTab -> SiegeSystem -> SiegeTaskManager | 零覆盖 |
| ExpeditionForcePanel -> SiegeConfirmModal -> handleSiegeConfirm | 零覆盖 |
| CooldownManager <-> SiegeSystem | 零集成(CooldownManager孤立) |
| handleSiegeConfirm 完整流程 | 零覆盖 |

---

## 8. 修正后的统计

| 统计 | Builder结论 | Challenger修正 |
|------|------------|---------------|
| 已完成 (含实现+测试通过+测试有效) | 21 | **14** |
| 部分完成 | 4 | **7** |
| 未完成 | 2 | **6** |
| 测试有效性存疑 | 2 | **4** |

---

*Challenger 攻击完成 | 2026-05-05*
