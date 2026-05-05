# Challenger 攻击报告 — R30 P2集中清理

> **攻击者**: Challenger
> **日期**: 2026-05-05
> **攻击对象**: Builder 客观审核清单 (builder-manifest.md)
> **攻击范围**: 全部 16 个 P2 修复项 + 6 个评估关闭项

## 攻击方法

逐项读取源代码验证：(1) 代码是否存在 (2) 是否真正解决问题 (3) 测试是否验证真实路径 (4) 评估关闭是否合理

---

## 一、有效质疑

### C-01 [P0]: cancelReason 字段无任何测试断言其值 — 无效证据

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 |
|--------|--------------|-------------|-------------|
| #35 cancelReason 字段测试 | "代码存在=YES, 测试覆盖=PARTIAL, 真实路径=YES" | Builder 自己承认 "测试验证事件存在但未断言 cancelReason 字段"。经 grep 全量测试文件，`cancelReason` 在任何 `.test.ts` 文件中 **零匹配**。这意味着代码添加了 cancelReason 字段，但没有测试证明它被正确设置为 `escape_hatch`、`return_unreachable` 或 `user_cancel`。这等于没有验证修复正确性。 | 需要测试断言 `expect(cancelledEvent.data.cancelReason).toBe('escape_hatch')` 等具体值 |

**代码证据**:
- `SiegeTaskManager.ts:277` — `cancelReason: 'escape_hatch'` 代码存在
- `SiegeTaskManager.ts:436` — `cancelReason: 'return_unreachable'` 代码存在
- `SiegeTaskManager.ts:451` — `cancelReason: 'user_cancel'` 代码存在
- `SiegeTaskManager.interrupt.test.ts:337-342` — 测试仅断言 `{ taskId, targetId }`，**未包含 cancelReason**
- `grep -rn "cancelReason" __tests__/` — **零匹配**

**结论**: cancelReason 字段已添加到源代码中，但无任何测试验证其值正确性。这是一个 **无验证的修复**。

---

### C-02 [P1]: try/catch 中 cancelTask 路径 — createMarch 不可能抛异常

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 |
|--------|--------------|-------------|-------------|
| #6/#16 try/catch + cancelTask | "真实路径=YES, 信心度=HIGH" | `MarchingSystem.createMarch()` 方法内部没有任何可能抛出异常的代码路径——它只做 `new Map().set()`、简单算术和 `eventBus.emit()`。`startMarch()` 同样只做 map lookup + 状态设置。try/catch 保护的是一个 **实际上永远不会触发的代码路径**，这使修复变成了防御性代码而非真实bug修复。 | 需要：(1) 证明 createMarch 在什么条件下会抛异常 (2) 或承认这是防御性代码而非bug修复 |

**代码证据**:
- `MarchingSystem.ts:235-282` — `createMarch` 全部是简单赋值和 Map 操作，无 throw
- `WorldMapTab.tsx:1217-1241` — try/catch 包裹 createMarch + startMarch
- `WorldMapTab.tsx:1238` — catch 块调用 `siegeTaskManager.cancelTask(task.id)`

**结论**: try/catch 本身代码存在且逻辑正确，但 Builder 声称修复 "createMarch失败异常路径" 是误导——该路径在正常情况下不可能触发。

---

### C-03 [P1]: #11 clamp后speed与estimatedTime不一致 — 评估关闭理由不充分

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 |
|--------|--------------|-------------|-------------|
| #11 clamp/eta不一致 | "EVAL-CLOSE: 显示预估值与物理速度解耦，设计合理" | 实际不一致确实存在。`createMarch` 中 `speed=BASE_SPEED(30px/s)` 是固定值，`estimatedTime` 经过 clamp(10s-60s)。对于短路径（如相邻格子，实际距离 <300px），实际移动时间 <10s，但 eta 显示 10s。这意味着 UI 显示的到达时间与精灵实际到达时间不一致。Builder 将此称为 "设计决策"，但未提供任何 PRD 或设计文档引用来证明这是有意为之。 | 需要设计文档引用证明 "显示eta与实际到达时间允许不一致" 是需求而非bug |

**代码证据**:
- `MarchingSystem.ts:246` — `const speed = BASE_SPEED` (固定30)
- `MarchingSystem.ts:248` — `estimatedTime` 被 clamp 到 [10s, 60s]
- `MarchingSystem.ts:265` — `eta: Date.now() + estimatedTime * 1000` (使用 clamp 后的值)
- `MarchingSystem.ts:478` — `moveAmount = march.speed * dt` (使用原始 speed=30)

**结论**: 不一致性确实存在，将其评估关闭需要设计文档支持，而非仅凭 Builder 的个人判断。

---

### C-04 [P1]: #12 dist<2 网格坐标跳跃 — 评估关闭理由不完整

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 |
|--------|--------------|-------------|-------------|
| #12 dist<2 跳跃 | "EVAL-CLOSE: 网格路径 dist=1, 阈值 2 合理" | Builder 的分析仅在 "网格坐标恰好为整数" 时成立。如果路径点坐标来自浮点数计算（如 `extractWaypoints` 生成的转折点），`dist<2` 可能导致在非路径点处提前跳跃。没有证据表明所有路径点坐标都是整数网格坐标。 | 需要证明 `calculateMarchRoute` 返回的路径坐标始终为整数 |

**代码证据**:
- `MarchingSystem.ts:469` — `if (dist < 2)` 硬编码阈值
- `MarchingSystem.ts:362` — `route.path.map(p => ({ x: p.x, y: p.y }))` 路径来自 GridPosition

**注意**: GridPosition 是 `{ x: number; y: number }`，如果底层是整数网格坐标则阈值合理。但 Builder 未验证这一点。

---

### C-05 [P1]: 并发限制硬编码为 3 而非常量 — #24/#42

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 |
|--------|--------------|-------------|-------------|
| #24/#42 MAX_CONCURRENT_SIEGES=3 | "代码存在=YES" | 代码中使用的是硬编码字面量 `>= 3` (WorldMapTab.tsx:1158) 而非命名常量 `MAX_CONCURRENT_SIEGES`。原始问题描述为 "无MAX_CONCURRENT_SIEGES全局限制"，暗示需要定义常量。当前修复仅添加了一个 magic number。 | 需要定义 `const MAX_CONCURRENT_SIEGES = 3` 并引用它 |

**代码证据**:
- `WorldMapTab.tsx:1158` — `if (activeCount >= 3)` 硬编码
- 无 `MAX_CONCURRENT_SIEGES` 常量定义

---

### C-06 [P1]: #18 siegeTaskId 参数化 — 声称修复但仍在剩余列表

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 |
|--------|--------------|-------------|-------------|
| #18 siegeTaskId外部赋值设计脆弱 | 任务描述列为 R30 修复项，但 Builder manifest 和 report.md 均未将其列为已完成 | R30 report.md 第 97 行仍将 #18 列为 "剩余问题(下轮)"。但任务描述明确将 #18 "createMarch参数化" 列为 R30 声称完成的修复。存在矛盾。实际代码中 `createMarch` 第7个参数 `siegeTaskId?: string` 是可选参数，WorldMapTab.tsx:1226 传递 `task.id`。这解决了赋值问题，但未在 manifest 中记录。 | 需要确认 #18 是否已修复并更新 report.md |

**代码证据**:
- `MarchingSystem.ts:242` — `siegeTaskId?: string` 可选参数
- `WorldMapTab.tsx:1226` — `task.id` 作为 siegeTaskId 传递
- R30 report.md 第 97 行 — #18 仍在剩余列表

---

### C-07 [P1]: mountedRef 守卫缺少组件级测试验证 — #32/#36/#41

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 |
|--------|--------------|-------------|-------------|
| #32/#36/#41 mountedRef 守卫 | "代码存在=YES, 真实路径=YES" | Builder 自己承认 "无组件级测试验证卸载后行为"。mountedRef 守卫的核心价值就是在组件卸载后阻止 setState 调用，这只能通过 React Testing Library 的 unmount + act 来验证。没有组件级测试，无法证明守卫真正生效。 | 需要 React Testing Library 测试验证 unmount 后 setTimeout 不触发 setState |

**代码验证结果**: 5 个 setTimeout 回调全部包含 `if (!mountedRef.current) return` 守卫（L515, L709, L762, L769, L1253）。cleanup 函数 L851 设置 `mountedRef.current = false`。代码逻辑正确，但无测试证明。

---

### C-08 [P1]: cancelSiege 从 sieging 自动暂停后缺少 pauseSnapshot 计算 — #35

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 |
|--------|--------------|-------------|-------------|
| cancelSiege 自动暂停逻辑 | "cancelReason 添加到所有 3 处" | `cancelSiege` 在 `SiegeTaskManager.ts:393-403` 中从 `sieging` 状态自动暂停时，硬编码 `pauseSnapshot: { defenseRatio: 1, elapsedBattleTime: 0 }`。这意味着从 sieging 直接撤退时丢失了真实的攻城进度（defenseRatio 应为当前城防比，elapsedBattleTime 应为实际已用时间）。 | 需要证明 `defenseRatio: 1` 和 `elapsedBattleTime: 0` 在撤退场景下不会导致后续逻辑错误 |

---

### C-09 [P2]: #20 全mock测试分类错误 — 无任何修复证据

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 |
|--------|--------------|-------------|-------------|
| #20 mock测试分类修正 | 任务描述列为 R30 修复项，但 manifest 中无记录 | grep 全部测试文件，无任何 "分类标注" 或 "category" 相关修改。R30 report.md 第 99 行将 #20 仍列为剩余问题。该修复项未被实际执行。 | 需要找到 mock 测试分类修正的实际代码变更 |

---

### C-10 [P2]: #33 requiredItem 测试绕过 — 评估关闭理由不够充分

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 |
|--------|--------------|-------------|-------------|
| #33 requiredItem 被绕过 | "canSiege守卫已阻止" | canSiege 确实检查了 requiredItem，但测试中通过 mock engine 绕过了 checkSiegeConditions 直接调用 executeSiege，跳过了 requiredItem 校验。这意味着真实 UI 走 checkSiegeConditions 有保护，但引擎层 executeSiege 本身不检查 requiredItem（只在 checkSiegeConditions 中检查）。 | 需要证明 executeSiege 不需要在内部重复 requiredItem 校验 |

**代码证据**:
- `SiegeSystem.ts:266` — checkSiegeConditions 检查 requiredItem
- `SiegeSystem.ts:590-591` — executeSiege 中仅 consumeItem 不 checkItem

---

### C-11 [P2]: #38 战斗系统与结算系统判定脱钩 — 评估关闭未充分论证

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 |
|--------|--------------|-------------|-------------|
| #38 战斗与结算脱钩 | R30 report.md 将其列为剩余问题，但任务描述列为 R30 修复项 | WorldMapTab.tsx:543-563 注释说明了单路径架构，但战斗判定（SiegeSystem.executeSiege 确定胜负）与动画引擎（SiegeBattleSystem 驱动城防衰减）确实使用不同机制。SiegeBattleSystem 的 defenseValue 衰减纯粹是视觉效果，不影响胜负判定。Builder 注释了这一分离，但未论证为什么这种脱钩不是bug。 | 需要架构文档明确 "战斗判定与动画引擎是关注点分离设计" |

---

### C-12 [P2]: #34 Builder行号不准确 — 文档质量问题未修复

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 |
|--------|--------------|-------------|-------------|
| #34 行号不准确 | 任务描述列为 R30 修复项，但 manifest 中无记录 | R30 report.md 第 104 行将 #34 仍列为剩余问题。Builder manifest 本身的行号引用（如 "WorldMapTab.tsx:1217-1243"）需要与实际源代码对照验证。经核对，大部分行号基本准确（偏差1-2行），但 manifest 中的行号描述方式（冒号分隔）不够精确。 | 需要 Builder 提供行号验证方法或承认这是持续性问题 |

---

### C-13 [P2]: #17 march:arrived→sieging 非原子 — 状态重检守卫覆盖范围有限

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 |
|--------|--------------|-------------|-------------|
| #17 非原子状态转换 | "EVAL-CLOSE: 状态重检守卫提供事实原子性" | 重检守卫仅在 `setTimeout` 回调内（L515-518）检查 `status !== 'marching'`。但在守卫检查之后、`advanceStatus('sieging')` 之前，如果另一个事件（如 cancelSiege）恰好触发，仍可能导致状态不一致。这不是真正的原子性，而是 "大概率安全"。 | 需要证明在 setTimeout 回调执行期间（同步），cancelSiege 无法被触发 |

---

## 二、已验证项（攻击失败）

以下项目经源代码验证，代码确实存在且逻辑正确：

| # | 修复项 | 验证结果 |
|---|--------|---------|
| #13 | 回城不可达反馈 | WorldMapTab.tsx:661-664 和 SiegeTaskManager.ts:431-437 均有正确处理 |
| #14 | retreating状态 | MarchingSystem.ts:374 设置 `march.state = 'retreating'`，测试 march-siege.integration.test.ts:617 断言通过 |
| #43 | timeExceeded注释 | SiegeBattleSystem.ts:230-232 注释存在且说明完整 |

---

## 三、攻击总结

| 质疑点 | 严重度 | 类型 | 简述 |
|--------|:------:|------|------|
| C-01 | P0 | 无效证据 | cancelReason 零测试断言，无法证明修复正确性 |
| C-02 | P1 | 幻觉攻击 | createMarch 无异常路径，try/catch 保护空路径 |
| C-03 | P1 | 评估关闭攻击 | #11 clamp/eta不一致被关闭但无设计文档支持 |
| C-04 | P1 | 评估关闭攻击 | #12 dist<2 评估关闭未验证坐标为整数 |
| C-05 | P1 | 漏洞攻击 | 并发限制使用 magic number 而非命名常量 |
| C-06 | P1 | 集成断裂 | #18 声称修复但仍在剩余列表，状态矛盾 |
| C-07 | P1 | 无效证据 | mountedRef 守卫无组件级测试验证 |
| C-08 | P1 | 漏洞攻击 | cancelSiege 自动暂停使用硬编码 pauseSnapshot |
| C-09 | P2 | 幻觉攻击 | #20 mock分类修正无实际代码变更 |
| C-10 | P2 | 评估关闭攻击 | #33 requiredItem 绕过的关闭理由不充分 |
| C-11 | P2 | 评估关闭攻击 | #38 战斗/结算脱钩未充分论证 |
| C-12 | P2 | 文档质量 | #34 行号不准确未修复 |
| C-13 | P2 | 评估关闭攻击 | #17 状态重检守卫不是真正原子性 |

---

## 四、统计数据

| 指标 | 数量 |
|------|:----:|
| 有效质疑总数 | 13 |
| P0 (无验证的修复) | 1 |
| P1 (设计/逻辑/集成问题) | 7 |
| P2 (文档/评估理由不足) | 5 |

---

*Challenger 攻击完成 | 2026-05-05 | 13个有效质疑(P0:1, P1:7, P2:5)*
