# R12 Challenger Attack Report

> **迭代**: map-system Round 12
> **日期**: 2026-05-04
> **Challenger**: Claude Agent
> **攻击对象**: `builder-manifest.md` (270/270 PASS)

---

## 攻击总览

| 类别 | 质疑数 | 已验证问题 | 待验证问题 |
|:----:|:------:|:----------:|:----------:|
| 漏洞攻击 | 4 | 3 | 1 |
| 幻觉攻击 | 3 | 1 | 2 |
| 无证据攻击 | 4 | 4 | 0 |
| 集成断裂攻击 | 3 | 2 | 1 |
| 流程断裂攻击 | 3 | 2 | 1 |
| 边界攻击 | 5 | 3 | 2 |
| **合计** | **22** | **15** | **7** |

---

## 1. 漏洞攻击

### 1.1 [P1] getDefenseBarColor 对 NaN 输入产生 `rgb(NaN,NaN,NaN)`

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 |
|--------|-------------|-------------|-------------|
| getDefenseBarColor 对 NaN/Infinity 的边界处理 | Builder声称"边界值钳位 (ratio < 0 / > 1)"已覆盖，测试 ratio=-0.5 和 ratio=1.5 | **NaN 不被 Math.max/min 钳位**。`Math.max(0, Math.min(1, NaN))` 返回 `NaN`，导致函数返回 `rgb(NaN,NaN,NaN)` — 一个无效CSS颜色值。测试只验证了负数和超1的正数，未验证NaN | 缺少 `ratio=NaN` 的测试用例和防御性代码（如 `isNaN` 检查） |

**验证代码** (独立复现):
```javascript
Math.max(0, Math.min(1, NaN))  // => NaN (NOT 0)
Math.max(0, Math.min(1, Infinity))  // => 1 (OK)
Math.max(0, Math.min(1, -Infinity))  // => 0 (OK)
```

**影响**: 当上游计算产出 NaN (如除以零: `0/0`), 城防血条颜色变成无效值, Canvas渲染可能出现未定义行为。

**源代码位置**: `/Users/gongdewei/work/projects/game-portal/src/components/idle/panels/map/PixelWorldMap.tsx:326`
```typescript
const r = Math.max(0, Math.min(1, ratio)); // NaN passes through!
```

**测试文件**: `/Users/gongdewei/work/projects/game-portal/src/components/idle/panels/map/__tests__/PixelWorldMap.defense-bar.test.tsx` — 无任何 NaN 测试用例。

---

### 1.2 [P1] PixelWorldMap 不处理 MarchState 'cancelled' — 精灵渲染无对应分支

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 |
|--------|-------------|-------------|-------------|
| cancelled 状态在 UI 精灵层的处理 | Builder声称 MarchState 包含 'cancelled' 且 cancelMarch 正确设置该状态 | **PixelWorldMap.tsx 的精灵渲染函数完全忽略 cancelled 状态**。`renderSingleMarchSprite` 只处理 `preparing`/`marching`/`retreating`/`arrived`，无 `cancelled` 分支。虽然 `cancelMarch` 会从 `activeMarches` 中删除行军，但存在一帧竞态窗口：取消瞬间 + 渲染帧之间，cancelled 状态的行军可能仍被传入渲染 | 缺少 cancelled 状态在精灵渲染中的显式处理逻辑，缺少 cancelled 状态的精灵渲染测试，缺少竞态条件分析 |

**源代码位置**: `/Users/gongdewei/work/projects/game-portal/src/components/idle/panels/map/PixelWorldMap.tsx:200-240` — 精灵渲染的状态分支：
```typescript
if (march.state === 'preparing') { ... }
if (march.state === 'marching') { ... }
else if (march.state === 'retreating') { ... }
if (march.state === 'retreating') { ... }
if (march.state === 'arrived') { ... }
// 注意: 无 'cancelled' 分支!
```

搜索 `PixelWorldMap.tsx` 中所有 `cancelled` 引用: **0处**。搜索 `PixelWorldMapMarchSprites.test.tsx` 中所有 `cancelled` 引用: **0处**。

**风险评估**: 如果 cancelled 行军在取消帧被渲染，它将以默认样式（`globalAlpha=1.0`, 派系颜色）渲染一帧 — 看起来和正常行军一模一样。这不是崩溃性 bug，但是逻辑漏洞。

---

### 1.3 [P2] SiegeTaskPanel 未防御 tasks=undefined 的 prop

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 |
|--------|-------------|-------------|-------------|
| SiegeTaskPanel 的 tasks prop 安全性 | Builder声称空状态在所有无任务场景生效 | SiegeTaskPanel 的 `tasks` prop 是必选的（无默认值、无 `?` 标记），但组件内部直接调用 `tasks.filter(...)` 而无空值保护。如果上层传入 `undefined`（如异步数据加载中），将抛出 `TypeError: Cannot read properties of undefined (reading 'filter')` | 缺少 `tasks=undefined` 的测试用例，缺少防御性代码（`tasks ?? []` 或 `tasks?.filter`） |

**源代码位置**: `/Users/gongdewei/work/projects/game-portal/src/components/idle/panels/map/SiegeTaskPanel.tsx:197-199`:
```typescript
const activeTasks = useMemo(
  () => tasks.filter((t) => t.status !== 'completed'),  // tasks = undefined => CRASH
  [tasks],
);
```

**测试文件**: `/Users/gongdewei/work/projects/game-portal/src/components/idle/panels/map/__tests__/SiegeTaskPanel.test.tsx` — 所有测试都传入 `tasks={[]}` 或 `tasks={[...]}`，从未传入 `undefined`。

---

### 1.4 [P2] prepare/settling 状态图标未被独立测试覆盖

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 |
|--------|-------------|-------------|-------------|
| 7种状态图标的测试覆盖 | Builder声称 "7种状态对应图标" 全部通过测试 | 测试文件只验证了 `marching`(→)、`sieging`(⚔)、`returning`(←)、`completed`(✓)、`failed`(✗) 共 **5种** 状态图标。`preparing`(⏳) 和 `settling`(📋) 的状态图标测试 **完全缺失** | 缺少 `preparing` 状态图标 = ⏳ 的断言，缺少 `settling` 状态图标 = 📋 的断言 |

**测试文件**: `/Users/gongdewei/work/projects/game-portal/src/components/idle/panels/map/__tests__/SiegeTaskPanel.test.tsx` — 搜索 `status-icon-task-icon` 相关测试：
- `marching` → 测试存在 (line 600-607)
- `sieging` → 测试存在 (line 609-616)
- `returning` → 测试存在 (line 618-625)
- `completed` → 测试存在 (line 627-644)
- `failed` → 测试存在 (line 646-663)
- `preparing` → **缺失**
- `settling` → **缺失**

Builder 声称 7 种全部覆盖，实际只有 5 种有直接断言。

---

## 2. 幻觉攻击

### 2.1 [P1] E2E 测试并非真正端到端 — 使用 mock EventBus

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 |
|--------|-------------|-------------|-------------|
| "E2E march-siege integration" 测试的端到端性 | Builder声称 "22 E2E tests PASS"，暗示端到端链路验证 | **所有 "E2E" 测试使用 mock EventBus** (`vi.fn()`)。这意味着事件发射被 spy 捕获，但没有消费者。`march:arrived` 事件不会触发 SiegeBattleSystem 的攻城逻辑。测试验证了 MarchingSystem 的内部逻辑，但 **没有验证跨系统事件传递**（MarchingSystem → SiegeBattleSystem → UI） | 缺少使用真实 EventBus 的跨系统测试，缺少 MarchingSystem → SiegeBattleSystem 的事件驱动集成测试 |

**测试文件**: `/Users/gongdewei/work/projects/game-portal/src/games/three-kingdoms/engine/map/__tests__/integration/march-siege-e2e.integration.test.ts:23-32`:
```typescript
function createMockDeps(): ISystemDeps {
  return {
    eventBus: {
      emit: vi.fn(),   // MOCK! Not a real EventBus
      on: vi.fn(),
      off: vi.fn(),
      once: vi.fn(),
    },
  } as unknown as ISystemDeps;
}
```

**测试文件名含 "e2e" 但实际只测了 MarchingSystem 单系统**。没有 SiegeBattleSystem、没有 SiegeTaskManager、没有 UI 组件参与。

---

### 2.2 [P2] 所有 Canvas 测试使用 mock Canvas — 无真实渲染验证

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 |
|--------|-------------|-------------|-------------|
| Canvas 渲染测试的有效性 | Builder声称 "41 defense-bar PASS" + "32 siege-render PASS" + "53 march sprites PASS" | 所有 Canvas 测试通过 `HTMLCanvasElement.prototype.getContext = vi.fn()` 替换为 mock ctx。mock ctx 的 `fillRect`、`strokeRect` 等方法是 `vi.fn()`，只记录调用但不执行任何实际渲染。这意味着测试验证的是 **"调用了正确的 API"** 而非 **"像素被正确渲染"**。无法发现坐标系变换错误、裁剪区域错误、颜色空间问题等 | 缺少任何像素级别的验证（如 getImageData 对比），缺少真实 Canvas 的渲染测试 |

**所有三个测试文件** 都使用完全相同的 mock Canvas 模式：
- `/Users/gongdewei/work/projects/game-portal/src/components/idle/panels/map/__tests__/PixelWorldMap.defense-bar.test.tsx:104-158`
- `/Users/gongdewei/work/projects/game-portal/src/components/idle/panels/map/__tests__/PixelWorldMapMarchSprites.test.tsx:106-158`
- `/Users/gongdewei/work/projects/game-portal/src/components/idle/panels/map/__tests__/PixelWorldMap.siege-render.test.tsx` (类似模式)

这是 R11 Judge P2 #6 已知的约束，Builder 在 R12 计划中标记为 "不修复（已知技术约束）"。但需要再次指出：**mock Canvas 测试无法验证渲染正确性**。

---

### 2.3 [P2] formatElapsedTime 使用 Date.now() 导致测试脆弱

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 |
|--------|-------------|-------------|-------------|
| formatElapsedTime 的可测试性 | Builder声称 "各时间区间格式化正确" | `formatElapsedTime` 内部调用 `Date.now()`，测试依赖 `createdAt: Date.now() - 3 * 60 * 1000` 的隐式假设：测试执行时间 < 1分钟。如果 CI 环境负载高导致测试延迟执行，`3分钟前` 可能变成 `4分钟前`（边界跳变）。没有 `vi.useFakeTimers()` 固定时间 | 缺少对 `Date.now()` 的 mock，缺少边界值测试（59秒 vs 61秒、59分 vs 61分） |

**源代码位置**: `/Users/gongdewei/work/projects/game-portal/src/components/idle/panels/map/SiegeTaskPanel.tsx:126-137`
```typescript
function formatElapsedTime(createdAt: number): string {
  const elapsed = Date.now() - createdAt;  // 依赖真实 Date.now()
  ...
}
```

**测试**: 只测试了 "分钟前" 和 "小时前" 的粗粒度断言（`toContain('分钟前')`），未测试边界跳变。

---

## 3. 无证据攻击

### 3.1 [P1] Task 7 (E1-4 离线→上线→弹窗) 完全未交付

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 |
|--------|-------------|-------------|-------------|
| E1-4 离线系统端到端闭环 | Builder manifest 中完全未提及 Task 7 | R12 计划明确要求 Task 7 (P2, Large): "离线时长计算→奖励生成→弹窗→领取→资源增量, >= 5个集成测试场景"。Builder 完全跳过了此任务，manifest 中零提及 | 无相关测试文件 (`offline-e2e.integration.test.ts` 不存在)，无实现变更 |

---

### 3.2 [P1] Task 8 (D3-4 批量渲染优化) 完全未交付

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 |
|--------|-------------|-------------|-------------|
| 行军精灵批量渲染减少 drawCall | Builder manifest 中完全未提及 Task 8 | R12 计划明确要求 Task 8 (P2, Medium): "50精灵场景drawCall数减少 >= 30%"。Builder 跳过了此任务 | 无 drawCall 计数测试，无优化前后对比基准 |

---

### 3.3 [P2] Task 9 (I7/I8 内应信掉落+道具获取) 完全未交付

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 |
|--------|-------------|-------------|-------------|
| 内应信掉落和道具获取 | Builder manifest 中完全未提及 Task 9 | R12 计划明确要求 Task 9 (P2, Medium): "攻城胜利20%概率掉落内应信"、"道具获取/消耗正确性" | 无 `SiegeReward.drop.test.ts`，无掉落逻辑实现 |

---

### 3.4 [P2] Task 10 (H5/H6 伤亡/将领受伤UI) 完全未交付

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 |
|--------|-------------|-------------|-------------|
| 伤亡/将领受伤UI增强 | Builder manifest 中完全未提及 Task 10 | R12 计划明确要求 Task 10 (P2, Medium): "将领受伤状态图标（轻伤/中伤/重伤）"、"受伤将领不可选" | 无相关实现或测试 |

**综合影响**: R12 计划共 10 个 Task，Builder 只完成了 Task 4/5/6 (3/10)。计划预期 PLAN.md 完成率从 80% 提升到 92%~98%，但 4 个 P2 Task 未交付意味着完成率可能仍停滞在 ~80%。

---

## 4. 集成断裂攻击

### 4.1 [P1] cancelled 状态变化未传播到 UI 层

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 |
|--------|-------------|-------------|-------------|
| MarchingSystem cancelled → PixelWorldMap 的状态传播 | Builder声称 cancelMarch 设置 cancelled 状态并从 activeMarches 删除 | **没有任何机制确保 UI 层知道行军被取消了**。`cancelMarch` 从 `activeMarches` Map 中删除行军 → `getActiveMarches()` 不再返回它 → 下一帧精灵渲染时行军不在列表中 → 精灵消失。但这个过程没有渐变/动画过渡。用户看到的是行军精灵**突然消失**而非播放取消动画 | 缺少 cancelled 状态的渐变动画，缺少 cancelled 行军的视觉反馈，缺少从 cancelled 到清除的过渡测试 |

**具体链路分析**:
1. `MarchingSystem.cancelMarch()`: 设置 `state='cancelled'`，立即删除，发射 `march:cancelled`
2. UI 层 (`PixelWorldMap`) 收到新的 `activeMarches` (不含被取消的行军)
3. `renderMarchSpritesOverlay`: 因为 `marches.length === 0` (如果只有这一个行军)，执行 `clearRect`
4. **结果**: 精灵瞬间消失，无任何过渡

对比 `retreating` 状态: 有 70% 透明度 + 灰色 + 路线半透明的退场动画。`cancelled` 没有任何视觉反馈。

---

### 4.2 [P2] getDefenseBarColor 未在所有需要它的地方被验证调用

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 |
|--------|-------------|-------------|-------------|
| getDefenseBarColor 的调用完整性 | Builder声称 "battle阶段城防血条颜色使用getDefenseBarColor" | 验证通过。`PixelWorldMap.tsx:591` 调用了 `getDefenseBarColor(ratio)`。但测试只验证了 battle 阶段的血条颜色，未验证 assembly 阶段或 completed 阶段是否**不调用**该函数（即确认非 battle 阶段不会错误渲染彩色血条） | 缺少非 battle 阶段不调用 getDefenseBarColor 的反向断言 |

**实际验证结果**: defense-bar 测试中 "completed阶段不使用城防血条RGB颜色" 和 "assembly阶段不使用城防血条RGB颜色" 两个测试通过，间接验证了这一点。此质疑点 **降级为 P3**。

---

### 4.3 [P2] ExtendedStatus 的 'failed' 与后端 SiegeTask 状态映射

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 |
|--------|-------------|-------------|-------------|
| failed 状态的映射正确性 | Builder声称 "getDisplayStatus 将失败与完成区分" | `getDisplayStatus` 依赖 `task.result.victory === false` 来判断 failed。但如果 `task.result` 为 `null`（攻城尚未完成）或 `task.result` 存在但 `victory` 为 `undefined`，`!task.result.victory` 会返回 `true`（因为 `!undefined === true`），导致一个非 completed 状态的 task 被错误显示为 'failed' | 缺少 `result=null` 且 `status=completed` 的边界测试，缺少 `result.victory=undefined` 的边界测试 |

**源代码位置**: `/Users/gongdewei/work/projects/game-portal/src/components/idle/panels/map/SiegeTaskPanel.tsx:116-121`:
```typescript
function getDisplayStatus(task: SiegeTask): ExtendedStatus {
  if (task.status === 'completed' && task.result && !task.result.victory) {
    return 'failed';
  }
  return task.status;
}
```

实际分析: 由于 `task.result &&` 先检查了 result 不为 null，且 SiegeTaskResult 类型中 victory 是 `boolean` (非 optional)，所以 `victory=undefined` 的情况不应发生。但如果后端序列化/反序列化过程丢失字段，这个防御可能不够。**此质疑点降级为 P3**。

---

## 5. 流程断裂攻击

### 5.1 [P1] 行军创建→取消→精灵清理的完整链路未被端到端测试

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 |
|--------|-------------|-------------|-------------|
| 行军取消后的精灵清理链路 | Builder声称 "空行军时精灵层 Canvas 清除" 和 "cancelMarch 设置 cancelled" | 这两个功能分别在独立的测试中验证（MarchingSystem.test.ts 验证 cancelMarch，PixelWorldMapMarchSprites.test.tsx 验证空数组 clearRect），但 **没有测试验证完整链路**：创建行军 → 渲染精灵 → 取消行军 → 下一帧渲染 → 精灵消失 + clearRect 被调用 | 缺少跨系统的集成测试：MarchingSystem 取消 → activeMarches 更新 → PixelWorldMap 重新渲染 → clearRect 验证 |

**具体缺失场景**:
1. 创建行军 → startMarch → 渲染1帧(有精灵) → cancelMarch → 渲染1帧(应调用clearRect)
2. 创建3个行军 → cancel其中1个 → 渲染1帧(应只剩2个精灵,非clearRect)
3. 创建行军 → cancelMarch → 立即创建新行军 → 渲染1帧(应有新精灵,非clearRect)

---

### 5.2 [P2] 防御衰减→颜色变化→血条渲染的链路部分验证

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 |
|--------|-------------|-------------|-------------|
| 防御衰减动画的实时性 | Builder声称 "衰减过程中 ratio 递减 → 血条宽度递减" | 测试只验证了静态的 ratio → 颜色映射。没有测试验证 **连续帧** 中 ratio 递减时血条宽度的连续变化。即没有 "ratio=1.0 → 0.8 → 0.6 → 0.4 → 0.2 → 0" 的多帧渲染测试 | 缺少多帧渲染的集成测试，缺少 "每帧递减0.1时连续10帧的fillRect宽度序列" 测试 |

**已验证**: `PixelWorldMap.defense-bar.test.tsx` 中 Test1-Test8 验证了不同 ratio 的颜色和宽度正确性。

**未验证**: 没有模拟时间推进 (如 `vi.advanceTimersByTime(1000)`) 后 ratio 变化的连续渲染测试。

---

### 5.3 [P2] 攻城任务创建→状态变化→面板显示的链路未集成测试

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 |
|--------|-------------|-------------|-------------|
| 攻城任务面板的状态流转 | Builder声称 "7种状态对应图标" 和 "进度条渲染" | SiegeTaskPanel 测试全部使用静态 props 渲染。没有测试验证任务状态的 **动态变化**（如从 marching 变为 sieging 再变为 returning）时面板是否正确更新。`rerender` 测试有一个（"向后兼容 — 进度条仍然正常显示"），但没有覆盖状态流转场景 | 缺少任务状态流转的 rerender 测试，缺少从 marching → sieging → completed 的渐进更新测试 |

---

## 6. 边界攻击

### 6.1 [P1] ratio=NaN 导致 getDefenseBarColor 返回无效颜色

(已在 1.1 中详述)

### 6.2 [P2] 同时取消多个行军的并发行为

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 |
|--------|-------------|-------------|-------------|
| 批量取消行军 | Builder声称 cancelMarch 正确清理 | 测试只验证了单个行军的取消。没有测试验证同时取消多个行军（如 for 循环调用 cancelMarch）后 activeMarches 的状态 | 缺少 "创建5个行军 → 全部取消 → activeMarches为空" 的测试 |

**E2E 测试中**: 只有 "多个行军可以同时存在且独立到达" (Scenario 10)，但没有 "多个行军同时取消" 的场景。

---

### 6.3 [P2] taskId 为空字符串或超长字符串

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 |
|--------|-------------|-------------|-------------|
| taskId 边界值 | Builder声称 cancelMarch 对不存在的 ID 不崩溃 | 测试只验证了 `'nonexistent_id'`。没有验证 `''` (空字符串)、超长字符串（1MB）、特殊字符（`<script>alert(1)</script>`）等边界 | 缺少极端 taskId 的测试用例 |

---

### 6.4 [P3] formatElapsedTime 对负数 createdAt 的处理

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 |
|--------|-------------|-------------|-------------|
| 时间格式化的负值防御 | Builder声称各时间区间格式化正确 | `formatElapsedTime` 对 `createdAt > Date.now()` (未来的创建时间) 有防御 (`elapsed < 0 => '刚刚'`)，但对 `createdAt = 0` (epoch) 的极端场景未测试 | 缺少 `createdAt=0`、`createdAt=Number.MAX_SAFE_INTEGER` 的测试 |

---

### 6.5 [P3] spriteCount 对 troops=0 或负数的处理

| 质疑点 | Builder的结论 | 为什么不可信 | 缺少什么证据 |
|--------|-------------|-------------|-------------|
| 精灵数量对零/负兵力的处理 | Builder声称 "不同兵力对应的精灵数量" | 精灵数量逻辑: `troops > 1000 ? 5 : troops > 500 ? 3 : 1`。当 `troops = 0` 或 `troops = -100` 时，spriteCount = 1，会渲染一个空兵力精灵。这不是崩溃性 bug，但不符合直觉（无兵力的行军不应渲染精灵） | 缺少 `troops=0` 和 `troops<0` 的测试用例 |

---

## 7. 综合评估

### 7.1 Builder 声称的测试通过情况

| 套件 | Builder声称 | 实际运行结果 | 验证状态 |
|------|-----------|------------|---------|
| MarchingSystem | 43/43 PASS | 43/43 PASS | **已验证通过** |
| march-siege-e2e | 22/22 PASS | 22/22 PASS | **已验证通过** (但非真正E2E) |
| defense-bar | 41/41 PASS | 41/41 PASS | **已验证通过** |
| siege-render | 32/32 PASS | 32/32 PASS | **已验证通过** |
| SiegeTaskPanel | 55/55 PASS | 55/55 PASS | **已验证通过** |
| dirty-flag | 14/14 PASS | 14/14 PASS | **已验证通过** |
| march sprites | 53/53 PASS | 53/53 PASS | **已验证通过** |
| perf | 10/10 PASS | 10/10 PASS | **已验证通过** |
| **合计** | **270/270** | **270/270** | **全部通过** |

Builder 的 "270/270 PASS" 声称是 **真实的**。所有 270 个测试在本地运行时确实通过。

### 7.2 功能实现验证

| Task | 计划要求 | Builder声称 | 实际验证 |
|------|---------|-----------|---------|
| Task 1 (P1) | dirty-flag Test 14 修正 + 分层策略 | 未提及在 manifest | Test 14 名称已修正为 "仅标记sprites层脏"，但**未新增 Test 15**（计划要求的空数组→空数组场景）|
| Task 2 (P1) | originalPath 死参数清理 | 隐含在 MarchingSystem 43 PASS | 测试文件中 `originalPath` 只剩一处引用（测试名称），参数已移除。**已验证通过** |
| Task 3 (P1) | Benchmark 8 改造 | 未提及在 manifest | Benchmark 8 已改为 "大量领土数据渲染" (100个领土)，不再是裸 mock 调用。**已验证通过** |
| Task 4 (P1) | E2E 增强 + 精灵清除 + cancelled | 全部声称完成 | E2E 场景 1-12 覆盖了主要链路，精灵清除测试存在，cancelled 状态在引擎层实现。**部分完成** (UI 层无 cancelled 处理) |
| Task 5 (P1) | 城防衰减 UI 动画 | 全部声称完成 | getDefenseBarColor RGB 插值、攻击指示器（脉冲边框+交叉剑）已实现。**但 NaN 边界未防御** |
| Task 6 (P1) | 攻占任务面板 UI 增强 | 全部声称完成 | 编队摘要、空状态、创建时间、5种状态图标已测试。**preparing/settling 图标未测试** |
| Task 7 (P2) | 离线 E2E | 未提及 | **未交付** |
| Task 8 (P2) | 批量渲染优化 | 未提及 | **未交付** |
| Task 9 (P2) | 内应信掉落+道具 | 未提及 | **未交付** |
| Task 10 (P2) | 伤亡/受伤UI | 未提及 | **未交付** |

### 7.3 问题严重性汇总

| 优先级 | 问题数 | 说明 |
|:------:|:------:|------|
| P0 | 0 | 无崩溃性或安全漏洞 |
| P1 | 4 | NaN 颜色值(#1.1), cancelled UI 缺失(#1.2/#4.1), E2E mock 假象(#2.1), 取消链路无集成测试(#5.1) |
| P2 | 7 | tasks=undefined 崩溃(#1.3), 2种图标未测(#1.4), 离线未交付(#3.1), 批量渲染未交付(#3.2), 道具未交付(#3.3), 伤亡UI未交付(#3.4), 批量取消未测(#6.2) |
| P3 | 4 | getDefenseBarColor 调用完整性(#4.2), failed 映射边界(#4.3), 负 createdAt(#6.4), troops=0(#6.5) |

### 7.4 总体评判

Builder 的核心声称（270 测试全部通过、Task 4/5/6 功能实现）**基本可信**，但存在以下系统性问题：

1. **"E2E" 名不副实**: 所谓的 "E2E integration test" 使用完全 mock 的 EventBus，只验证了单系统逻辑，未验证跨系统集成
2. **边界防御薄弱**: NaN 输入导致无效 CSS 颜色值，undefined prop 导致运行时崩溃
3. **cancelled 状态半成品**: 引擎层有 cancelled 状态，但 UI 层完全不知道其存在
4. **计划完成度严重不足**: 10 个 Task 只完成 3 个（P1 完成率 6/6 = 100%，但 P2 完成率 0/4 = 0%），PLAN.md 完成率未如预期提升
5. **测试覆盖有盲区**: preparing/settling 图标、多行军取消、NaN ratio、tasks=undefined 等边界场景未覆盖

---

*Challenger Attack Report | R12 map-system | 2026-05-04*
