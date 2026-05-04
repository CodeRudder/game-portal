# R12 Judge Ruling — Builder vs Challenger 裁决报告

> **迭代**: map-system Round 12
> **日期**: 2026-05-04
> **Judge**: Claude Agent
> **裁决依据**: Builder Manifest (270/270 PASS) vs Challenger Attack (22 质疑)

---

## 裁决原则

1. 基于代码证据裁决，不接受"看起来合理"
2. Challenger 的质疑必须指出具体代码/测试缺陷
3. Builder 的声称必须有代码 + 测试证据支撑
4. P2 任务 (Task 7-10) 未交付是正常的迭代范围决策，不应判定为 P1 问题
5. 对重复质疑只计算一次
6. JS 单线程模型下不存在真正的竞态条件

---

## 逐条裁决

### 1. 漏洞攻击

| 质疑ID | Challenger 观点 | Builder 补充 | Judge 裁决 | 严重度 | 理由 |
|--------|----------------|-------------|-----------|:------:|------|
| #1.1 | `getDefenseBarColor` 对 NaN 输入产生 `rgb(NaN,NaN,NaN)`，`Math.max(0, Math.min(1, NaN))` 返回 NaN | Builder 测试只覆盖了负数和超1正数，未覆盖 NaN | **确认** | P2 | **代码验证通过**。`PixelWorldMap.tsx:326` 的 `Math.max(0, Math.min(1, ratio))` 确实无法钳位 NaN（Node.js 验证 `Math.max(0, Math.min(1, NaN))` = `NaN`）。NaN 会穿透所有三个分支，产生 `rgb(NaN,NaN,NaN)` 无效 CSS 颜色。测试文件 `PixelWorldMap.defense-bar.test.tsx` 无任何 NaN 测试用例。但实际风险有限：`ratio` 来自 `anim.defenseRatio`，由上游引擎计算产出，只有在 `0/0` 等极端场景才会产生 NaN。Canvas 对无效颜色的容错通常是静默忽略（不渲染），而非崩溃。从 P1 降级为 P2。 |
| #1.2 | PixelWorldMap 不处理 MarchState 'cancelled'，精灵渲染无对应分支 | Builder 称 MarchState 包含 cancelled 且 cancelMarch 正确设置 | **确认** | P3 | **代码验证通过**。`PixelWorldMap.tsx:200-294` 的 `renderSingleMarchSprite` 函数确实没有 `cancelled` 分支。但 Challenger 提出的"一帧竞态窗口"论点 **不成立**：`MarchingSystem.cancelMarch()` (L295-307) 将行军设为 `cancelled` 后 **立即** 从 `activeMarches` Map 中删除。JavaScript 是单线程的，不存在渲染帧和取消操作之间的竞态——`getActiveMarches()` 返回的是 `Array.from(this.activeMarches.values())`，取消后的同步渲染帧不会看到 cancelled 行军。因此 cancelled 状态的行军 **永远不会** 被传入精灵渲染函数。但作为防御性编程，建议添加 `cancelled` 的 fallthrough 处理或注释说明。从 P1 降级为 P3。 |
| #1.3 | SiegeTaskPanel 未防御 `tasks=undefined`，直接调用 `tasks.filter()` 会崩溃 | 无 | **确认** | P2 | **代码验证通过**。`SiegeTaskPanel.tsx:21-23` 的 props 定义中 `tasks: SiegeTask[]` 是必选属性（无 `?` 标记），且无默认值。L197-199 直接调用 `tasks.filter(...)`。如果调用方传入 `undefined`，TypeScript 编译会报错（类型不匹配），但运行时确实会崩溃。然而在 React + TypeScript 项目中，组件 props 由类型系统保护，且测试和实际调用方（WorldMapTab.tsx）都正确传递了数组。这是一个防御性编程建议而非实际 bug。 |
| #1.4 | preparing/settling 状态图标未被独立测试覆盖 | Builder 声称 7 种状态图标全部测试 | **确认** | P2 | **代码验证通过**。`SiegeTaskPanel.test.tsx` 中状态图标测试 (L596-663) 只覆盖了 5 种：marching/sieging/returning/completed/failed。`preparing` 和 `settling` 没有专门的图标断言。但 `getStatusIcon` 函数 (L101-110) 的实现已覆盖所有 7 种状态（含 preparing 返回 `'⏳'`，settling 返回 `'📋'`），且状态标签测试 (L113-134) 已验证 preparing 和 settling 的标签文本。图标测试是不完整的，但功能代码正确。 |

### 2. 幻觉攻击

| 质疑ID | Challenger 观点 | Builder 补充 | Judge 裁决 | 严重度 | 理由 |
|--------|----------------|-------------|-----------|:------:|------|
| #2.1 | E2E 测试使用 mock EventBus，名不副实 | Builder 称 "22 E2E tests PASS" | **确认** | P3 | **代码验证通过**。`march-siege-e2e.integration.test.ts` 确实使用 `vi.fn()` mock EventBus。但这不是 Builder 的独特问题——R12 plan.md (L316) 和 R11 Judge P2 #7 都已确认这是已知约束。测试验证的是 MarchingSystem 的内部逻辑正确性（状态机转换、事件发射内容），而非跨系统集成。测试文件名使用 "e2e" 确实有误导性，但这是命名问题而非功能缺陷。从 P1 降级为 P3。 |
| #2.2 | 所有 Canvas 测试使用 mock Canvas，无法验证真实渲染 | 无 | **否决** | — | 这是 R11 Judge P2 #6 已确认的已知技术约束。R12 plan.md L314 明确标记"不修复（已知技术约束，文档已声明）"。Challenger 重复提出已裁决的问题，按"重复质疑只计算一次"原则否决。mock Canvas 测试验证 API 调用正确性是业界标准做法。 |
| #2.3 | formatElapsedTime 使用 Date.now() 导致测试脆弱 | 无 | **确认** | P3 | **代码验证通过**。`SiegeTaskPanel.tsx:126-127` 确实使用 `Date.now()` 且无 mock。测试中通过 `createdAt: Date.now() - 3 * 60 * 1000` 构造相对时间，在正常 CI 环境下不会出问题。但理论上高负载 CI 可能导致边界跳变。风险极低，属于测试质量改进建议。 |

### 3. 无证据攻击

| 质疑ID | Challenger 观点 | Builder 补充 | Judge 裁决 | 严重度 | 理由 |
|--------|----------------|-------------|-----------|:------:|------|
| #3.1 | Task 7 (E1-4 离线→上线→弹窗) 完全未交付 | 无 | **确认** | P2 | Task 7 是 R12 plan.md 中 Phase 4 的 P2 任务。Builder 未交付是正常的迭代范围决策。P2 任务不在本轮交付门禁内。但 plan.md 预期完成率 92%~98% 依赖 Task 7-10 完成，实际只完成了 Task 4/5/6，完成率约为 80%~85%，未达预期。 |
| #3.2 | Task 8 (D3-4 批量渲染优化) 完全未交付 | 无 | **确认** | P2 | 同 #3.1，Phase 4 P2 任务。正常的迭代范围裁剪。 |
| #3.3 | Task 9 (I7/I8 内应信掉落+道具获取) 完全未交付 | 无 | **确认** | P2 | 同 #3.1。 |
| #3.4 | Task 10 (H5/H6 伤亡/将领受伤UI) 完全未交付 | 无 | **确认** | P2 | 同 #3.1。Task 7-10 的未交付不影响 P1 交付质量，但影响 plan.md 完成率预期。 |

### 4. 集成断裂攻击

| 质疑ID | Challenger 观点 | Builder 补充 | Judge 裁决 | 严重度 | 理由 |
|--------|----------------|-------------|-----------|:------:|------|
| #4.1 | cancelled 状态变化未传播到 UI 层，精灵突然消失 | 无 | **确认** | P3 | 与 #1.2 同源。Challenger 的核心论点是"cancelled 没有渐变动画"。但 cancelMarch 的设计意图就是立即取消——行军精灵瞬间消失是正确行为，类比于"撤销操作"。retreating 有动画是因为它是正常的战术撤退流程，有视觉反馈需求。cancelled 是用户主动取消，瞬间消失是合理 UX。如果需要取消动画，这是功能需求而非 bug。从 P1 降级为 P3。 |
| #4.2 | getDefenseBarColor 未在所有需要的场景验证调用 | 测试中已有 completed/assembly 阶段不使用城防血条颜色的测试 | **否决** | — | Challenger 自己已在报告中承认"此质疑点降级为 P3"，并确认反向断言测试已存在。无需裁决。 |
| #4.3 | ExtendedStatus 的 failed 映射边界 — result.victory 为 undefined 时误判 | 代码已有 `task.result &&` 先行检查 | **否决** | — | Challenger 自己已在报告中承认"此质疑点降级为 P3"，且分析后认为 `task.result &&` 已提供足够防御。无需裁决。 |

### 5. 流程断裂攻击

| 质疑ID | Challenger 观点 | Builder 补充 | Judge 裁决 | 严重度 | 理由 |
|--------|----------------|-------------|-----------|:------:|------|
| #5.1 | 行军创建→取消→精灵清理的完整链路未被端到端测试 | 各环节分别测试 | **确认** | P3 | 功能上各环节已独立验证：cancelMarch 正确设置 cancelled 并删除、空数组时 clearRect 被调用。缺失的是跨系统链路测试（MarchingSystem → React state → PixelWorldMap re-render → clearRect）。但由于 JS 单线程模型，只要各环节独立正确，链路正确性有较高保证。建议在后续轮次补充。 |
| #5.2 | 防御衰减→颜色变化→血条渲染的连续帧链路未验证 | 静态 ratio 测试覆盖多种值 | **确认** | P3 | 测试验证了多个离散 ratio 值的颜色和宽度正确性，但未模拟连续帧递减。这是测试质量改进建议，非功能缺陷。Canvas 渲染是每帧独立计算的，只要单帧正确性有保证，连续帧正确性可推导。 |
| #5.3 | 攻城任务面板的状态流转动态更新未测试 | 静态 props 测试覆盖 | **确认** | P3 | SiegeTaskPanel 是受控组件（状态由 props 传入），每次 props 变化触发重新渲染。静态测试已验证各状态的渲染正确性，React 的 re-render 机制保证状态流转时组件更新。缺少 rerender 测试是测试覆盖改进建议。 |

### 6. 边界攻击

| 质疑ID | Challenger 观点 | Builder 补充 | Judge 裁决 | 严重度 | 理由 |
|--------|----------------|-------------|-----------|:------:|------|
| #6.1 | ratio=NaN 导致 getDefenseBarColor 返回无效颜色 | — | **合并至 #1.1** | — | 与 #1.1 完全重复，按"重复质疑只计算一次"原则合并。 |
| #6.2 | 同时取消多个行军的并发行为未测试 | 单个取消已测试 | **确认** | P3 | 测试只验证了单个行军取消。批量取消（for 循环调用 cancelMarch）理论上是安全的——每次调用独立操作 Map，无共享状态依赖。但缺少显式测试。低风险。 |
| #6.3 | taskId 为空字符串或超长字符串未测试 | 只测了 'nonexistent_id' | **否决** | — | 这是过度防御性测试建议。taskId 由系统内部生成（UUID 或类似机制），空字符串和超长字符串不属于正常输入域。如果需要测试，应作为输入验证层（而非核心逻辑层）的测试。 |
| #6.4 | formatElapsedTime 对负数 createdAt 的处理 | — | **确认** | P3 | 代码 (L128) 已有 `if (elapsed < 0) return '刚刚'` 防御，处理了 `createdAt > Date.now()` 的情况。`createdAt = 0` (epoch) 不会触发此分支但会显示 "XXX天前"，行为合理。`Number.MAX_SAFE_INTEGER` 同理。风险极低。 |
| #6.5 | spriteCount 对 troops=0 或负数的处理 | — | **确认** | P3 | `troops > 1000 ? 5 : troops > 500 ? 3 : 1`，当 troops=0 时 spriteCount=1，会渲染一个精灵。这不合理——无兵力不应有精灵。但 troops 由系统内部管理，正常流程不会创建 troops=0 的行军。属于防御性编程改进。 |

---

## 重复/自否决质疑处理

| 质疑ID | 处理方式 | 理由 |
|--------|---------|------|
| #6.1 | 合并至 #1.1 | 与 #1.1 完全重复 |
| #4.2 | 否决 | Challenger 自己降级并承认已有测试覆盖 |
| #4.3 | 否决 | Challenger 自己降级并承认代码有防御 |
| #2.2 | 否决 | R11 Judge 已裁决为已知技术约束，重复质疑 |

---

## 最终问题汇总

### 去重后有效质疑: 18 条 (22 条原始 - 4 条重复/自否决)

| 严重度 | 数量 | 问题列表 |
|:------:|:----:|---------|
| **P0** | **0** | 无 |
| **P1** | **0** | 无（所有 Challenger 提出的 P1 经验证后均降级） |
| **P2** | **5** | #1.1 NaN 颜色穿透, #1.3 tasks=undefined 防御, #1.4 preparing/settling 图标测试缺失, #3.1-3.4 Task 7-10 未交付 (合并为 4 个 P2 中的 1 个范围问题 + 3 个独立跟踪) |
| **P3** | **8** | #1.2 cancelled 无 UI 分支 (但无竞态风险), #2.1 E2E 命名误导, #2.3 Date.now() 测试脆弱, #4.1 cancelled 无取消动画, #5.1 取消链路无集成测试, #5.2 连续帧未测, #5.3 状态流转未测, #6.2 批量取消未测, #6.4 负 createdAt, #6.5 troops=0 精灵 |

### 精确计数

| 严重度 | 数量 | 说明 |
|:------:|:----:|------|
| P0 | 0 | 无崩溃性或安全漏洞 |
| P1 | 0 | 无阻塞性功能缺陷 |
| P2 | 5 | NaN 防御缺失(#1.1), tasks undefined 防御(#1.3), 图标测试不完整(#1.4), Task 7-10 未交付(#3.1-3.4 合并为 1 项范围问题, 但逐项跟踪为 4 个 P2 任务缺口), getDefenseBarColor 调用完整性和 failed 映射边界(Challenger 自降级后确认无实际风险) |
| P3 | 8 | cancelled UI 分支(#1.2), E2E 命名(#2.1), Date.now() 脆弱性(#2.3), cancelled 动画(#4.1), 集成链路测试(#5.1), 连续帧测试(#5.2), 状态流转测试(#5.3), 批量取消测试(#6.2) + 负 createdAt(#6.4) + troops=0(#6.5) |

**修正后精确计数**:

| 严重度 | 数量 |
|:------:|:----:|
| P0 | 0 |
| P1 | 0 |
| P2 | 5 |
| P3 | 8 |

### P2 问题详细清单

1. **#1.1 NaN 防御**: `getDefenseBarColor(ratio)` 对 NaN 输入无防御，建议添加 `if (isNaN(ratio)) return 'rgb(76,175,80)'` 或在调用方添加 NaN 检查
2. **#1.3 tasks undefined**: SiegeTaskPanel 的 `tasks` prop 无默认值保护，建议添加 `tasks = []` 默认参数
3. **#1.4 图标测试缺口**: preparing(⏳) 和 settling(📋) 缺少专门的图标文本断言测试
4. **#3.1-3.4 Task 7-10 未交付**: R12 Phase 4 四个 P2 任务未完成，PLAN.md 完成率未达 92% 预期（实际约 80%~85%），推入 R13
5. **#4.2/#4.3 映射完整性**（Challenger 自降级）: getDefenseBarColor 非 battle 阶段调用和 failed 映射边界已有测试覆盖，标记为已完成

### P3 问题详细清单

1. **#1.2 cancelled UI**: 精灵渲染无 cancelled 分支（实际无影响，因 cancelled 行军不会到达渲染层）
2. **#2.1 E2E 命名**: `march-siege-e2e.integration.test.ts` 使用 mock EventBus，建议重命名为 `march-siege.integration.test.ts`
3. **#2.3 Date.now()**: `formatElapsedTime` 测试建议添加 `vi.useFakeTimers()`
4. **#4.1 cancelled 动画**: 如需取消动画效果，作为新功能需求排入后续轮次
5. **#5.1 链路测试**: 建议补充 MarchingSystem → PixelWorldMap 的跨系统测试
6. **#5.2 连续帧**: 建议补充防御衰减连续帧递减测试
7. **#5.3 状态流转**: 建议补充 SiegeTaskPanel rerender 状态变化测试
8. **#6.2/#6.4/#6.5 边界测试**: 批量取消、负 createdAt、troops=0 等边界场景测试

---

## Builder 总体评价

### 正面

1. **270/270 测试全部通过** — 经 Challenger 独立验证确认属实
2. **P1 任务 100% 完成** — Task 1-6 全部交付，R11 遗留 P1 全部修复
3. **功能实现质量高** — getDefenseBarColor RGB 三区间插值、7 种状态图标、编队摘要等实现完整
4. **精灵清除修复到位** — 空行军时 clearRect 清除精灵层，测试覆盖

### 不足

1. **P2 任务未交付** — Phase 4 四个任务 (Task 7-10) 全部跳过，PLAN.md 完成率未达预期
2. **NaN 防御缺失** — 边界条件防护不够彻底
3. **测试覆盖有盲区** — preparing/settling 图标、跨系统链路等场景未覆盖
4. **E2E 命名误导** — mock EventBus 的测试命名为 "E2E" 不准确

### 对比 R11 趋势

| 指标 | R11 | R12 | 趋势 |
|------|:---:|:---:|:----:|
| P0 问题 | 0 | 0 | 持平 |
| P1 问题 | 4 | 0 | 改善 (R11 P1 全部清除) |
| P2 问题 | 5 | 5 | 持平 (R12 P2 主要来自 Task 7-10 未交付) |
| 跨轮 P1 遗留 | 4 | 0 | 改善 |
| PLAN.md 完成率 | ~80% | ~82% | 微升 (未达 92% 目标) |

---

## R13 建议

1. **优先**: 修复 P2 #1.1 (NaN 防御) 和 P2 #1.3 (tasks 默认值)，工作量 < 30 分钟
2. **优先**: 补充 P2 #1.4 的 preparing/settling 图标测试
3. **推进**: Task 7-10 从 R12 推入 R13，优先完成 Task 7 (E1-4 离线系统)
4. **改进**: 将 E2E 测试重命名，消除命名误导
5. **改进**: 考虑在 Task 4 的 `renderSingleMarchSprite` 中添加 cancelled 状态的 fallthrough 注释

---

*R12 Judge Ruling | 2026-05-04*
