# Judge 裁决报告 — Round 22 Phase 1 (P1~P5)

> 裁决日期: 2026-05-05
> 裁决角色: Judge
> 审查对象: Builder 客观审核清单 + Challenger 攻击报告
> 裁决方法: 逐条审查双方论据，**实际读取源代码验证**，不接受纯文字主张

---

## 总览

| 类别 | 数量 |
|------|------|
| 总质疑点 | 19 (ATT-01 ~ ATT-19) |
| 质疑成立 (确认问题) | 5 |
| 质疑部分成立 (存在风险但不严重) | 6 |
| 质疑不成立 (驳回) | 8 |
| P0 问题 | 2 |
| P1 问题 | 3 |
| P2 问题 | 6 |

---

## 逐条裁决

### ATT-01: P2-6 并发上限 SiegeSystem 层完全缺失

| 项目 | 内容 |
|------|------|
| Challenger观点 | SiegeSystem.checkSiegeConditions (L231-291) 中没有任何并发上限检查，`activeCount` 在 SiegeSystem.ts 中无引用 |
| Builder补充 | Builder已自认"部分完成"，指出ExpeditionSystem有间接限制 |
| **Judge裁决** | **质疑成立** |
| 理由 | 实际验证 SiegeSystem.ts L231-291: checkSiegeConditions 检查了 TARGET_NOT_FOUND、TARGET_ALREADY_OWNED、NOT_ADJACENT、INSUFFICIENT_TROOPS、INSUFFICIENT_GRAIN、STRATEGY_ITEM_MISSING、INSIDER_EXPOSED、DAILY_LIMIT_REACHED、CAPTURE_COOLDOWN 共9个条件。grep 确认 `activeCount` 在 SiegeSystem.ts 中0匹配。SiegeTaskManager 有 `activeCount` getter (L240-241)，但 SiegeSystem 未引用。ExpeditionSystem.MAX_EXPEDITION_FORCES=3 仅限制编队数量，不等价于攻城并发上限。此为功能缺失 |
| **优先级** | **P1** (非P0: ExpeditionSystem提供了间接限制，正常游戏路径难以绕过，但设计不完整) |

---

### ATT-02: P5-5 cancelSiege 不释放锁

| 项目 | 内容 |
|------|------|
| Challenger观点 | cancelSiege (L338-386) 将状态改为 'returning' 但不调用 releaseSiegeLock，锁需等5分钟超时 |
| Builder补充 | 未就此点专项反驳 |
| **Judge裁决** | **质疑部分成立，但风险可控** |
| 理由 | 实际验证 SiegeTaskManager.ts L338-386: cancelSiege 确实不调用 releaseSiegeLock。锁仅在 advanceStatus 到 completed (L176) 和 removeCompletedTasks (L520) 时释放。cancelSiege 将状态改为 'returning'，根据状态转换表 (L567) `returning: ['completed']`，后续必须走 returning->completed 路径才释放锁。cancelSiege 文档注释(L332)声称"释放攻占锁"但代码未实现。**但**: cancelSiege 创建了 returnMarch，行军到达后会推进到 completed 状态释放锁，正常流程锁会释放。问题在于如果 returning->completed 流程中断，SIEGE_LOCK_TIMEOUT_MS=5分钟 (L65) 会兜底。**实际风险**: cancelSiege 的注释与代码不一致，存在文档撒谎；5分钟窗口内同一目标无法再次攻城 |
| **优先级** | **P2** (注释与代码不一致需修复；5分钟超时兜底，不会永久死锁) |

---

### ATT-03: P4-4 内应信三态测试覆盖不完整

| 项目 | 内容 |
|------|------|
| Challenger观点 | InsiderLetterSystem.test.ts 未覆盖"暴露冷却"状态，InsiderLetterSystem 无 exposed 概念 |
| Builder补充 | SiegeSystem.insiderExposures (Map) 管理暴露冷却，InsiderLetterSystem.test.ts 21个测试只覆盖获取/存储/消费 |
| **Judge裁决** | **质疑成立** |
| 理由 | 实际验证: grep InsiderLetterSystem.test.ts 中 "exposed\|暴露" 返回0结果。InsiderLetterSystem 确实不管理暴露状态，暴露逻辑在 SiegeSystem.ts L669-678 (setInsiderExposure/isInsiderExposed)。Builder声称P4-4"已完成"的三态测试实际分散在两个系统中，InsiderLetterSystem.test.ts 只验证了两态。暴露冷却态的测试需在 SiegeSystem 或集成测试中覆盖 |
| **优先级** | **P1** (三态是核心业务逻辑，暴露冷却态缺失测试) |

---

### ATT-04: P2-5 攻城冷却与 CooldownManager 零集成

| 项目 | 内容 |
|------|------|
| Challenger观点 | CooldownManager 在生产代码中从未被 SiegeSystem/SiegeTaskManager/WorldMapTab 引用 |
| Builder补充 | SiegeSystem 自行管理冷却 (captureTimestamps Map) |
| **Judge裁决** | **质疑不成立** |
| 理由 | 实际验证: SiegeSystem.ts L280-289 使用 `isInCaptureCooldown` 和 `captureTimestamps` Map 自行管理攻城冷却。CooldownManager 是一个通用冷却管理工具类，未被攻城系统使用不代表功能缺失。SiegeSystem 的冷却逻辑独立完整(有时间戳存储、序列化/反序列化 L492-494/L522-528、冷却检查)。CooldownManager 虽然孤立，但这不是 SiegeSystem 的问题——两套冷却方案可共存，各自服务不同子系统。CooldownManager 孤立是代码冗余问题，非功能缺失 |
| **优先级** | **P2** (代码冗余，非功能缺陷。建议后续统一冷却管理方案) |

---

### ATT-05: SiegeSystem.test.ts 使用 mock registry

| 项目 | 内容 |
|------|------|
| Challenger观点 | TerritorySystem 是真实实例但 registry.get 是 mock，TerritorySystem 内部数据依赖 mock 初始化 |
| Builder补充 | 使用真实TerritorySystem联动 |
| **Judge裁决** | **质疑不成立** |
| 理由 | 实际验证: SiegeSystem 通过 `this.territorySys?.getTerritoryById()` 调用 TerritorySystem。TerritorySystem.init() 接受 registry 参数，但 TerritorySystem 有自己的默认领土数据(硬编码地图)。mock registry 用于隔离外部依赖，TerritorySystem 的核心相邻判定逻辑是真实的。这是标准的单元测试实践——真实测试核心逻辑，mock 外部依赖。eventBus.emit 是 mock 不影响 SiegeSystem 的校验逻辑正确性测试 |
| **优先级** | **--** (驳回) |

---

### ATT-06: SiegeStrategy.test.ts 使用 jest.fn() + configRegistry 命名不匹配

| 项目 | 内容 |
|------|------|
| Challenger观点 | 使用 jest.fn() 而非 vi.fn()；configRegistry 与 ISystemDeps.config 命名不匹配 |
| Builder补充 | 无专项反驳 |
| **Judge裁决** | **质疑不成立 (jest.fn) + 质疑成立 (configRegistry命名)** |
| 理由 | 实际验证两子论点: (1) jest.fn: setup.ts L21-40 提供 `jest -> vi` 兼容 shim，`jest.fn()` 在运行时等于 `vi.fn()`。这是项目的标准化做法，所有使用 jest.fn 的测试均能正常运行。(2) configRegistry 命名: ISystemDeps 接口 (subsystem.ts L39) 定义的属性名是 `config`，但测试 L28 传入 `{ eventBus, registry, configRegistry: {} as any }`。由于 `as any` 绕过类型检查，运行时 `this.deps.config` 为 undefined。实际验证 SiegeSystem.init() (L144-151) 中未访问 `this.deps.config`，因此不影响功能。但这是一个类型安全隐患，未来如果 SiegeSystem 使用 config 会运行时报错 |
| **优先级** | **P2** (命名不一致需修复，但不影响当前功能) |

---

### ATT-07: SiegeConfirmModal.test.tsx 只测渲染未测确认交互

| 项目 | 内容 |
|------|------|
| Challenger观点 | fireEvent.click 只有1处(L199)且是取消按钮，确认按钮点击从未测试 |
| Builder补充 | 声称覆盖"确认按钮：条件全通过时可点击" |
| **Judge裁决** | **质疑成立** |
| 理由 | 实际验证 SiegeConfirmModal.test.tsx: 搜索 fireEvent.click 仅在 L199 出现1次，点击的是 cancelBtn (取消按钮)。onConfirm callback (defaultProps.onConfirm) 仅在 L45 定义为 vi.fn()，从未被 fireEvent 触发验证。测试文件的注释(L8)声称"确认按钮：条件全通过时可点击"与实际代码不符。**确认按钮交互零覆盖** |
| **优先级** | **P0** (确认按钮是攻城流程的核心交互，测试注释存在误导) |

---

### ATT-08: InsiderLetterSystem.test.ts 使用 jest.fn()

| 项目 | 内容 |
|------|------|
| Challenger观点 | 同 ATT-06，使用 jest.fn() + configRegistry 命名不匹配 |
| Builder补充 | 无专项反驳 |
| **Judge裁决** | **质疑部分成立** |
| 理由 | 同 ATT-06: jest.fn 通过 setup.ts shim 兼容，不影响运行。configRegistry 命名不匹配存在，但 InsiderLetterSystem 同样未访问 this.deps.config。问题同 ATT-06，属于同一类问题 |
| **优先级** | **P2** (同 ATT-06，合并处理) |

---

### ATT-09: P1-P5 完整链路零集成测试覆盖

| 项目 | 内容 |
|------|------|
| Challenger观点 | 165个引擎测试+108个UI测试全是单元/模块级，无端到端集成测试 |
| Builder补充 | Builder自认"无完整端到端集成测试" |
| **Judge裁决** | **质疑成立** |
| 理由 | 双方观点一致。集成测试缺失是已知的架构决策，单元测试覆盖了各子系统。但 handleSiegeConfirm (WorldMapTab L1109-1208) 作为串联 P1-P5 的核心函数无任何测试，是显著风险。这是测试策略问题而非功能缺失 |
| **优先级** | **P1** (集成测试缺失是风险，但非功能缺陷) |

---

### ATT-10: WorldMapTab.handleSiegeConfirm 无任何测试

| 项目 | 内容 |
|------|------|
| Challenger观点 | handleSiegeConfirm (L1109-1208) 这个120行关键函数没有任何直接测试 |
| Builder补充 | 未专项反驳 |
| **Judge裁决** | **质疑成立** |
| 理由 | 实际验证: grep WorldMapTab.test.tsx 中 "handleSiegeConfirm" 返回0结果。handleSiegeConfirm 是100行的核心入口函数(L1109-1208)，包含多个早期返回路径(L1110, L1113, L1120, L1128, L1168)、任务创建(L1144)、行军创建(L1178)、状态推进(L1193)等关键逻辑。这个函数的零测试覆盖是本轮最大的测试盲区 |
| **优先级** | **P0** (核心入口函数零测试，多个分支路径未验证) |

---

### ATT-11: ui-interaction.integration.test.tsx 非攻城集成测试

| 项目 | 内容 |
|------|------|
| Challenger观点 | 该测试只测 ExpeditionForcePanel 组件交互，不涉及攻城系统 |
| Builder补充 | 用作 P3 编队选择的证据 |
| **Judge裁决** | **质疑成立** |
| 理由 | ExpeditionForcePanel 的组件级测试不应被视为"攻城集成测试"。标题有误导性但测试本身是有效的单元测试。Builder 不应将其用作集成证据 |
| **优先级** | **P2** (测试标题误导，但不影响功能) |

---

### ATT-12: SiegeSystem -> SiegeTaskManager 数据流未串联

| 项目 | 内容 |
|------|------|
| Challenger观点 | 两个系统无直接依赖，校验结果仅通过 React state 传递 |
| Builder补充 | WorldMapTab.handleSiegeConfirm 中串联 |
| **Judge裁决** | **质疑部分成立** |
| 理由 | 实际验证 WorldMapTab L1109-1208: handleSiegeConfirm 确实是串联点——L1140 获取 siegeSystem，L1144 调用 siegeTaskManager.createTask。两个系统通过 WorldMapTab 的 React 组件逻辑串联。这在架构上是合理的(UI层编排业务逻辑)，但 Challenger 指出的校验一致性问题有道理: checkSiegeConditions 的校验在弹窗渲染时执行，而 createTask 的锁检查在确认时执行，两者之间有时间差。不过 SIEGE_LOCK_TIMEOUT 机制提供了保护 |
| **优先级** | **P1** (架构风险，非功能性缺陷。建议后续添加集成测试) |

---

### ATT-13: 编队兵力与 SiegeTask 中的兵力不同步

| 项目 | 内容 |
|------|------|
| Challenger观点 | expedition.troops、deployTroops、costEstimate 三者可能不一致 |
| Builder补充 | 无专项反驳 |
| **Judge裁决** | **质疑部分成立** |
| 理由 | 实际验证 WorldMapTab L1136-1166: (1) deployTroops = selectedTroops > 0 ? selectedTroops : availableTroops (L1136); (2) expedition.troops 来自 expeditionSelection.troops (L1155) 或 deployTroops (L1161); (3) march 使用 deployTroops (L1180-1181); (4) costEstimate 由 siegeSystem 计算 (L1141-1142)。当 expeditionSelection 存在时，expedition.troops 使用 expeditionSelection.troops (非 deployTroops)，而 march 使用 deployTroops——两者确实可能不一致。costEstimate 基于 SiegeSystem 的 siegeCost 计算(与 deployTroops 也可能不同)。三个来源不完全一致 |
| **优先级** | **P1** (数据流不一致可能导致显示与实际消耗不匹配) |

---

### ATT-14: 每日次数重置依赖 update() 调用频率

| 项目 | 内容 |
|------|------|
| Challenger观点 | 跨天重置依赖 update() 调用，若 00:00 前未调用则计数不重置 |
| Builder补充 | SiegeSystem.update() 中检查跨天重置 |
| **Judge裁决** | **质疑部分成立** |
| 理由 | SiegeSystem.update() (L153-160) 依赖外部调用。如果游戏引擎在跨天时未调用 update()，dailySiegeCount 不会重置。但 checkSiegeConditions 在每次校验时检查 dailySiegeCount < DAILY_SIEGE_LIMIT，即使 update() 不被调用，checkSiegeConditions 也可在内部添加日期检查。当前实现依赖 update() 是设计选择，正常游戏循环会频繁调用 update()。边界场景(挂机跨天)存在风险 |
| **优先级** | **P2** (边界场景风险，正常流程无问题) |

---

### ATT-15: 完整链路有断裂点 — createMarch 失败

| 项目 | 内容 |
|------|------|
| Challenger观点 | createMarch 失败时 task 已创建但 march 未创建，task 卡在 preparing 状态 |
| Builder补充 | 无专项反驳 |
| **Judge裁决** | **质疑成立** |
| 理由 | 实际验证 WorldMapTab L1178-1200: createMarch 在 L1178 调用，如果返回 null/undefined，L1188 `march.siegeTaskId = task.id` 会抛出 TypeError(march 为 null)。但更微妙的问题是: createTask (L1144) 已经创建了任务并获取了锁。如果 createMarch 抛异常，try-catch 未包裹整个逻辑，setActiveSiegeTasks (L1198) 不会执行，但 task 已存在于 SiegeTaskManager 中。后续代码没有清理机制。同时 siegeVisible 可能在 L1171 或 L1200 被设为 false，弹窗关闭但任务处于僵尸状态。**但**: 这是异常路径，createMarch 在正常情况下不会失败 |
| **优先级** | **P1** (异常路径缺少回滚，建议添加 try-catch 和清理逻辑) |

---

### ATT-16: 攻城确认弹窗关闭 -> 任务面板更新的时间窗口

| 项目 | 内容 |
|------|------|
| Challenger观点 | handleSiegeConfirm 是同步函数，异常可能导致弹窗关闭但任务未创建 |
| Builder补充 | 无专项反驳 |
| **Judge裁决** | **质疑不成立** |
| 理由 | 实际验证 L1109-1208: handleSiegeConfirm 中 `setSiegeVisible(false)` 仅在 L1200 出现一次(正常成功路径)。早期返回路径(L1121, L1129, L1171)确实会关闭弹窗，但这些是预期的用户反馈(源城市不存在/路线不存在/锁被占用)。如果 createTask/createMarch 抛异常(未被 catch)，React 的错误边界会处理，不会出现"弹窗关闭但任务未创建"的不一致状态——因为未 catch 的异常会导致整个渲染失败。正常路径中 L1198 setActiveSiegeTasks 和 L1200 setSiegeVisible(false) 在同一个同步调用中，React 批量更新确保一致性 |
| **优先级** | **--** (驳回。正常路径一致，异常路径由 React 错误边界处理) |

---

### ATT-17: 每日次数重置与跨天场景 — 数据传递

| 项目 | 内容 |
|------|------|
| Challenger观点 | WorldMapTab 是否正确传递 dailySiegesRemaining 到 SiegeConfirmModal 未验证 |
| Builder补充 | SiegeSystem.test.ts 覆盖了跨天重置 |
| **Judge裁决** | **质疑不成立** |
| 理由 | 这是集成测试缺失的重申(同 ATT-09)。SiegeConfirmModal.test.tsx 已验证当传入 dailySiegesRemaining prop 时 UI 正确渲染。WorldMapTab 传递 prop 的逻辑可通过组件渲染测试验证。此质疑本质上重复了 ATT-09 的论点 |
| **优先级** | **--** (驳回，重复 ATT-09) |

---

### ATT-18: deductSiegeResources 失败时 SiegeTask 泄漏

| 项目 | 内容 |
|------|------|
| Challenger观点 | handleSiegeConfirm 中无 deductSiegeResources 调用，资源扣减延迟到 executeSiege 异步执行，try-catch 静默吞异常 |
| Builder补充 | 已识别为"部分完成" |
| **Judge裁决** | **质疑成立，但严重程度低于Challenger声称** |
| 理由 | 实际验证: (1) handleSiegeConfirm (L1109-1208) 中确实无 deductSiegeResources 调用 (grep 确认 0 结果)。(2) deductSiegeResources 在 SiegeSystem.executeSiege (L595/L621) 中异步调用。(3) deductSiegeResources (L634-643) 使用 try-catch 静默处理失败。这是**延迟扣费**设计——创建任务时不扣费，到达目标时才扣费。问题: a) try-catch 吞异常，扣费失败时任务继续执行但资源未扣——这是 bug; b) 创建任务到到达之间的时间窗口，玩家可能消耗资源导致到达时扣费失败。Builder 已将其标为"部分完成"，定位准确 |
| **优先级** | **P0** (try-catch 吞异常是实际 bug，需添加失败处理或回滚) |

---

### ATT-19: 攻城冷却存储格式与序列化一致性

| 项目 | 内容 |
|------|------|
| Challenger观点 | SiegeSystem 和 CooldownManager 使用不同的冷却存储格式 |
| Builder补充 | 无专项反驳 |
| **Judge裁决** | **质疑不成立** |
| 理由 | SiegeSystem 使用 `Map<string, number>` 管理冷却时间戳，有完整的序列化/反序列化逻辑。CooldownManager 使用 `CooldownEntry` 格式管理通用冷却。两个系统管理不同类型的冷却数据，格式不同是合理的。此质疑重复了 ATT-04 的论点(CooldownManager 孤立问题)。只要 SiegeSystem 的冷却逻辑自洽，就不存在"格式不一致"的问题 |
| **优先级** | **--** (驳回，重复 ATT-04) |

---

## 裁决汇总

| 质疑点 | Challenger观点 | Builder补充 | Judge裁决 | 理由 | 优先级 |
|--------|---------------|-------------|-----------|------|--------|
| ATT-01 | P2-6 并发上限 SiegeSystem 层缺失 | 已自认部分完成 | **成立** | 代码验证确认 SiegeSystem.checkSiegeConditions 无并发上限检查，仅 9 个条件 | P1 |
| ATT-02 | cancelSiege 不释放锁 | 未反驳 | **部分成立** | cancelSiege 确不释放锁，但注释声称释放；returning->completed 路径会释放，5分钟超时兜底 | P2 |
| ATT-03 | 内应信三态测试不完整 | SiegeSystem 有暴露逻辑 | **成立** | InsiderLetterSystem.test.ts 无暴露冷却测试，三态分散在两系统 | P1 |
| ATT-04 | CooldownManager 与 SiegeSystem 零集成 | SiegeSystem 自管理冷却 | **不成立** | SiegeSystem 冷却逻辑独立完整，CooldownManager 孤立是冗余非缺陷 | -- |
| ATT-05 | SiegeSystem.test.ts mock registry | 真实 TerritorySystem | **不成立** | 标准 单元测试 实践，核心逻辑真实，外部依赖 mock | -- |
| ATT-06 | jest.fn() + configRegistry 命名错误 | 未反驳 | **部分成立** | jest.fn 通过 shim 兼容无问题；configRegistry vs config 命名不匹配属实，但 SiegeSystem 未访问 config | P2 |
| ATT-07 | SiegeConfirmModal 确认按钮未测试 | 声称已覆盖 | **成立** | fireEvent.click 仅1处(取消按钮)，确认按钮交互零覆盖，注释误导 | P0 |
| ATT-08 | InsiderLetterSystem jest.fn() | 未反驳 | **部分成立** | 同 ATT-06，jest.fn 兼容无问题，configRegistry 命名问题存在 | P2 |
| ATT-09 | P1-P5 零集成测试 | 自认无集成测试 | **成立** | 双方一致，集成测试缺失是已知风险 | P1 |
| ATT-10 | handleSiegeConfirm 零测试 | 未反驳 | **成立** | grep 确认 WorldMapTab.test.tsx 中无 handleSiegeConfirm，100行核心函数零覆盖 | P0 |
| ATT-11 | integration.test 非攻城集成 | 用作 P3 证据 | **成立** | 仅测试 ExpeditionForcePanel，不应作为集成证据 | P2 |
| ATT-12 | SiegeSystem->SiegeTaskManager 未串联 | WorldMapTab 串联 | **部分成立** | UI 层编排合理，但校验一致性依赖时间窗口 | P1 |
| ATT-13 | 编队兵力不同步 | 未反驳 | **部分成立** | expeditionSelection.troops 与 deployTroops 确实可能不一致 | P1 |
| ATT-14 | 每日次数重置依赖 update() | update() 中检查 | **部分成立** | 正常游戏循环无问题，挂机跨天有边界风险 | P2 |
| ATT-15 | createMarch 失败 task 泄漏 | 未反驳 | **成立** | 异常路径缺少 try-catch 和清理逻辑 | P1 |
| ATT-16 | 弹窗关闭与任务更新不一致 | 未反驳 | **不成立** | React 批量更新保证一致性，异常路径由错误边界处理 | -- |
| ATT-17 | dailySiegesRemaining 传递未验证 | SiegeSystem.test 覆盖 | **不成立** | 重复 ATT-09 论点 | -- |
| ATT-18 | deductSiegeResources 失败 task 泄漏 | 已自认部分完成 | **成立** | handleSiegeConfirm 无资源扣减，executeSiege 的 try-catch 吞异常是实际 bug | P0 |
| ATT-19 | 冷却存储格式不一致 | 未反驳 | **不成立** | 重复 ATT-04 论点，两系统格式不同是合理的 | -- |

---

## 最终统计

### 按优先级

| 优先级 | 数量 | 具体问题 |
|--------|------|----------|
| P0 (阻断性) | 2 | ATT-07: 确认按钮零测试覆盖; ATT-18: deductSiegeResources try-catch 吞异常 |
| P1 (严重) | 3 | ATT-01: 并发上限缺失; ATT-03: 内应信暴露冷却态零测试; ATT-10: handleSiegeConfirm 核心函数零测试 |
| P2 (中等) | 6 | ATT-02: cancelSiege 注释与代码不一致; ATT-06/08: configRegistry 命名不匹配(2个合并); ATT-11: 测试标题误导; ATT-14: update() 跨天边界; ATT-15: 异常路径无清理 |

### 修正后的完成度

| 统计 | Builder结论 | Judge修正 |
|------|------------|-----------|
| 已完成 | 21 | **18** |
| 部分完成 | 4 | **5** |
| 未完成 | 2 | **4** |

### 降级项

| 计划任务ID | Builder结论 | Judge修正 | 原因 |
|-----------|------------|-----------|------|
| P2-6 并发上限 | 部分完成 | **未完成** | SiegeSystem 层完全缺失并发检查 |
| P2-8 多条失败推荐 | 部分完成 | **部分完成** (维持) | 无排序逻辑但基本功能存在 |
| P4-4 内应信三态 | 已完成 | **部分完成** | 暴露冷却态测试缺失 |
| P5-1 任务创建原子性 | 部分完成 | **未完成** | deductSiegeResources 的 try-catch 吞异常是实际 bug |
| P5-6 过渡动画 | 未完成 | **未完成** (维持) | 双方一致 |

### 必须修复项 (P0+P1)

1. **ATT-18 [P0]**: SiegeSystem.deductSiegeResources 的 try-catch 不应静默吞异常，扣费失败应返回错误或回滚任务
2. **ATT-07 [P0]**: SiegeConfirmModal.test.tsx 需添加确认按钮点击测试 (fireEvent.click 确认按钮 + onConfirm 被调用)，修复测试注释的误导性描述
3. **ATT-10 [P1]**: WorldMapTab.handleSiegeConfirm 需至少添加关键路径的单元测试(创建成功/锁被占用/源城市不存在)
4. **ATT-01 [P1]**: SiegeSystem.checkSiegeConditions 需添加并发上限检查 (activeCount < MAX)
5. **ATT-03 [P1]**: 需在 SiegeSystem 或集成测试中添加内应暴露冷却态的测试

---

*Judge 裁决完成 | 2026-05-05*
