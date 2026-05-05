# R10 Judge Ruling — 裁决报告

> 裁决时间: 2026-05-04
> 裁决依据: Builder Manifest v1 vs Challenger Attack v1
> 源码版本: main 分支 e22dcf90

---

## 裁决总览

| # | Challenger 级别 | 功能点 | 质疑摘要 | 裁决结果 | 最终级别 |
|---|----------------|--------|----------|----------|----------|
| 1 | P0 | H7 | `calculateEffectivePower` 是死代码/空壳函数 | **部分成立** | P1 |
| 2 | P1 | E1-3 | march:arrived->sieging 是测试粘合代码 | **不成立** | - |
| 3 | P1 | I11 | 16/35 行军精灵测试为无断言烟雾测试 | **成立** | P1 |
| 4 | P1 | I11 | "路线交互" 无测试证据 | **部分成立** | P2 |
| 5 | P2 | H7 | 9/37 H7 测试与功能无关 | **成立** | P2 |
| 6 | P2 | E1-3 | 回城链路核心mock影响测试完整度 | **成立** | P2 |

**最终统计: P0: 0, P1: 2, P2: 3 个问题**

---

## 逐条裁决

---

### 质疑 #1: `calculateEffectivePower` 是死代码/空壳函数

**Challenger 级别**: P0 | **裁决: 部分成立** | **最终级别: P1**

#### 源码验证

实际源码 (`src/games/three-kingdoms/engine/map/ExpeditionSystem.ts` 行 334-337):

```typescript
calculateEffectivePower(force: ExpeditionForce): number {
    const basePower = this.calculateRemainingPower(force.id);
    return basePower;  // 直接返回，无额外乘法
}
```

Challenger 关于函数体是 `calculateRemainingPower` 的透传这一点**完全正确**。函数 JSDoc 声称"额外考虑编队中将领受伤带来的战力衰减"，但实际实现未添加任何独立逻辑。受伤衰减计算完全由 `calculateRemainingPower` (行 383-390) 内部的 `getHeroPowerMultiplier` 完成。

#### 然而: 该函数并非死代码

在 `src/games/three-kingdoms/engine/map/SiegeSystem.ts` 行 787-789:

```typescript
// 应用将领战力加成（考虑受伤）— 使用 calculateEffectivePower
const effectivePower = expeditionSys.calculateEffectivePower(force);
const effectiveTroops = Math.floor(effectivePower);
```

`calculateEffectivePower` 在生产代码中被 `SiegeSystem.executeSiege()` 实际调用。虽然当前实现是透传，但它作为 SiegeSystem 与 ExpeditionSystem 之间的**接口门面 (facade)** 存在，未来可以在不修改调用方的情况下增加编队级别的额外战力计算逻辑。

#### 裁决理由

1. **Builder 文档失实**: Builder 声称 "计算编队实际战力 (基础战力 x 受伤系数)"，但实际上函数内部并无独立的乘法操作，受伤系数已被 `calculateRemainingPower` 处理。这是**文档描述不准确**，降级为 P1。
2. **非死代码**: 函数在生产代码 `SiegeSystem.ts:788` 被调用，且测试 `ExpeditionSystem.casualties.test.ts:350` 也调用了它。它是有意义的接口封装，不是死代码。
3. **功能验证有效**: 测试通过 `calculateEffectivePower` 验证了完整链路 (applyCasualties -> calculateEffectivePower -> 期望结果)，虽然核心逻辑在下层函数，测试仍然验证了调用链的正确性。

#### 修复建议

- 修正 `calculateEffectivePower` 的 JSDoc，明确说明它是 `calculateRemainingPower` 的门面封装
- 或者在函数中添加独立的注释解释其架构意图
- Builder Manifest 中应准确描述为 "封装 `calculateRemainingPower` 的门面方法"，而非夸大其独立功能

---

### 质疑 #2: march:arrived->sieging 集成是测试粘合代码

**Challenger 级别**: P1 | **裁决: 不成立**

#### 源码验证

Challenger 声称 "生产代码中没有任何文件将 `march:arrived` 事件与 `sieging` 状态推进连接起来"。**这是错误的。**

在 `src/components/idle/panels/map/WorldMapTab.tsx` 行 427-596，生产代码中存在完整的 `march:arrived` 处理器:

```typescript
// 行 427: 定义处理器
const handleArrived = (data: MarchArrivedPayload) => {
    // ...
    // 行 446-460: 关联攻占任务并自动推进
    if (associatedTask && !associatedTask.result) {
        const taskId = associatedTask.id;
        setTimeout(() => {
            // ...
            // 行 460: 推进到 sieging 状态!
            siegeTaskManager.advanceStatus(currentTask.id, 'sieging');
            // 行 466-476: 启动攻城战斗
            // ...
        }, 0);
    }
    // ...
};

// 行 596: 注册事件监听
eventBus.on('march:arrived', handleArrived);
```

**关键事实**:
1. `WorldMapTab.tsx:460` 在 `march:arrived` 处理器中调用 `siegeTaskManager.advanceStatus(currentTask.id, 'sieging')` — 这是生产代码，不是测试粘合代码
2. `WorldMapTab.tsx:596` 注册了 `eventBus.on('march:arrived', handleArrived)` — 事件监听已连接
3. 处理器还包含完整的攻城流程: `createBattle` (行 466), `executeSiege` (行 479), `advanceStatus('settling')` (行 487)

#### 测试粘合代码的定位

测试中 (行 283-288) 的粘合代码:
```typescript
eventBus.on('march:arrived', (payload: any) => {
    if (payload.siegeTaskId) {
        taskManager.advanceStatus(payload.siegeTaskId, 'sieging');
    }
});
```

这段代码是对生产代码中 `WorldMapTab.tsx:427-460` 的**简化版重现**。因为集成测试不渲染 React 组件 (不加载 WorldMapTab)，所以需要在测试中手动建立事件监听。这是集成测试的标准做法，不是伪造集成。

#### 裁决理由

1. **生产代码存在完整集成**: `march:arrived -> siegeTaskManager.advanceStatus('sieging')` 在 `WorldMapTab.tsx` 中有完整实现
2. **测试粘合代码是合理抽象**: 集成测试聚焦于引擎层 (MarchingSystem + SiegeTaskManager)，不涉及 UI 层 (WorldMapTab)，所以需要在测试中重建事件监听
3. **Challenger 搜索不充分**: Challenger 声称 "搜索整个 src/ 目录" 没有找到连接代码，但实际上连接代码在 `WorldMapTab.tsx` 中存在

#### 修复建议

无需修复。但 Builder 可以改进测试注释，明确说明测试粘合代码是生产代码 `WorldMapTab.tsx:427-460` 的简化版。

---

### 质疑 #3: 16/35 行军精灵测试为无断言烟雾测试

**Challenger 级别**: P1 | **裁决: 成立** | **最终级别: P1**

#### 源码验证

测试文件 `PixelWorldMapMarchSprites.test.tsx`:

- **总测试数**: 35 (经验证确认)
- **Part 1 (行 276-548)**: 16 个测试，全部使用 `expect(() => { render(...) }).not.toThrow()` 模式
- **Part 2 (行 552-811)**: 19 个测试，使用 Canvas Mock 并有具体断言

16 个 Part 1 测试的断言模式确认:
```
toThrow 出现次数: 16 (验证通过 Grep)
```

这些测试确实只验证组件不抛异常，不验证任何渲染输出。在没有 Canvas Mock 的情况下 (Part 1 不调用 `setupCanvasMock()`)，`getContext('2d')` 在 JSDOM 中返回 null，`renderSingleMarch` 和 `renderMarchSpritesOverlay` 的核心渲染逻辑**不会被执行**。

#### 裁决理由

1. **16/35 = 45.7% 的测试是烟雾测试**: 这些测试验证的是"组件接收不同 props 不崩溃"，而非"渲染结果正确"
2. **烟雾测试有价值但不等于功能验证**: 这些测试确保组件在各种输入下不会因 null/undefined 报错，属于健壮性测试，但不应计入 Canvas 渲染功能的测试覆盖
3. **Builder 报告误导**: Builder 将 35 个测试全部作为 "行军精灵Canvas渲染" 的证据，实际上只有 Part 2 的 19 个测试验证了 Canvas 渲染

#### 修复建议

- 将 Part 1 的 16 个测试重新分类为"组件健壮性/冒烟测试"，与 Canvas 渲染功能测试区分
- 在测试文件中添加注释说明 Part 1 和 Part 2 的区别
- Builder Manifest 中应分别报告: "19 个 Canvas Mock 功能测试 + 16 个健壮性冒烟测试"

---

### 质疑 #4: "路线交互" 无测试证据

**Challenger 级别**: P1 | **裁决: 部分成立** | **最终级别: P2**

#### 源码验证

Builder 在功能点 2 标题中声称:
> R10 Task 6 (I11): 行军精灵Canvas渲染**+路线交互**

在 `PixelWorldMap.tsx` 源码中:
- 行 159 注释: `渲染单个行军精灵 (I11: Canvas渲染+路线交互增强)`
- 行 1076 注释: `渲染行军精灵叠加层 (I11: Canvas渲染+路线交互增强)`
- 行 1098-1142: 路线渲染代码 — 绘制阵营色虚线路线

搜索 `click|hover|interact|onClick|onHover` 在 `PixelWorldMap.tsx` 中:
- **无匹配** (在行军精灵相关代码范围内)

"路线交互" 在源码注释中的含义是**路线与精灵的视觉交互** (路线渲染 + 精灵叠加)，而非用户交互 (点击/悬停)。这从代码上下文可以确认:
- `renderMarchSpritesOverlay()` 先绘制路线 (虚线)，再绘制精灵 (行 1095: "先绘制路线(虚线)，再绘制精灵(精灵在路线之上)")
- 路线渲染在 Part 2 测试中有验证: Test 7 (setLineDash) 和 Test 9 (retreating 路线 0.5 alpha)

#### 裁决理由

1. **"路线交互" 表述有歧义**: 如果理解为 "路线与精灵的视觉叠加"，则有代码和测试证据 (路线渲染在 Part 2 Test 7/9 中验证)；如果理解为 "用户与路线的交互"，则无证据
2. **Builder 使用了模糊术语**: 在功能标题中使用 "路线交互" 容易被理解为用户交互，实际上只是路线渲染
3. **降级为 P2**: 路线渲染本身有测试证据，问题出在术语模糊而非功能缺失

#### 修复建议

- 将功能标题改为 "行军精灵Canvas渲染 + 路线可视化"，避免使用 "交互" 一词
- 如果未来确实需要行军精灵的点击/悬停交互 (如点击行军精灵查看详情)，应单独作为新功能点

---

### 质疑 #5: 9/37 H7 测试与功能无关

**Challenger 级别**: P2 | **裁决: 成立** | **最终级别: P2**

#### 源码验证

`ExpeditionSystem.casualties.test.ts` 中的 `getForceHealthColor` 测试 (行 189-227):

- 9 个独立测试在 `describe('getForceHealthColor')` 块内
- 测试内容: 传入 0~1 的浮点数，验证返回 'healthy'/'damaged'/'critical'
- `getForceHealthColor` 是纯函数，接受数值参数，与将领受伤/编队战力无关

Builder Manifest 中 H7 相关测试的分布:
- H7 直接相关测试: 6 个 (行 323-362, `describe('H7: 将领受伤影响战力')` 块)
- `getForceHealthColor` 测试: 9 个 (行 189-227)
- 其他间接相关测试: ~22 个 (applyCasualties, calculateRemainingPower, removeForce 等)

#### 裁决理由

1. **9 个测试与 H7 核心功能无关**: `getForceHealthColor` 是 UI 辅助函数，不涉及战力衰减计算
2. **但属于同一文件的方法**: 测试文件标题是 "ExpeditionSystem 伤亡方法测试"，覆盖该类所有伤亡相关方法，`getForceHealthColor` 是其中之一
3. **Builder 计入方式有误导**: 将 37 个测试全部作为 H7 "将领受伤影响战力衰减计算" 的证据，虚高了测试数量

#### 修复建议

- Builder 应分别报告: H7 核心测试 6 个 + 间接相关测试 22 个 + 无关测试 9 个
- 在测试文件中为 `getForceHealthColor` 测试块添加注释说明其与 H7 功能的关系

---

### 质疑 #6: 回城链路核心mock影响测试完整度

**Challenger 级别**: P2 | **裁决: 成立** | **最终级别: P2**

#### 源码验证

集成测试 Scenario 4 (行 340-464) 中:
- `calculateMarchRoute` 被 mock 为返回固定路径
- 测试手动设置 `troopsLost: 750` 并手动创建回城行军
- 攻城伤亡计算与回城行军创建之间的自动化链路未被验证

Builder 在 Manifest 中声称 "唯一mock: `calculateMarchRoute` 在Scenario 4中mock为返回固定路径，因为路径计算依赖地图数据，与E2E链路无关"。但 Challenger 正确指出，这个 mock 影响**整个回城行军测试链路**，因为它绕过了路径计算这一核心步骤。

#### 裁决理由

1. **mock 影响范围大于声称**: `calculateMarchRoute` 是回城行军创建的必要步骤，mock 它等于跳过了回城路径的完整逻辑
2. **伤亡到回城的自动化链路缺失**: 测试手动传入伤亡后的兵力，未验证攻城结算 -> 伤亡扣除 -> 回城创建的自动化流程
3. **降为 P2 仍然成立**: 测试验证了回城行军的基本属性 (speed x0.8, 到达出发城市)，但链路完整度确实低于声称

#### 修复建议

- 在有地图数据的集成环境中测试完整的回城链路 (不 mock `calculateMarchRoute`)
- 或者在测试注释中明确说明 mock 的影响范围
- 考虑添加攻城结算 -> 伤亡扣除 -> 回城创建的自动化链路测试

---

## 功能点最终状态

### Task 5 (E1-3): 行军->攻占E2E集成测试 — **有条件通过**

- march:arrived -> sieging 的集成在**生产代码中存在** (`WorldMapTab.tsx:460`)
- 回城链路测试的 mock 影响测试完整度 (P2)
- 事件顺序验证有效，核心链路验证有效
- **需要改进**: 回城链路测试的 mock 透明度

### Task 6 (I11): 行军精灵Canvas渲染 — **有条件通过**

- 19 个 Canvas Mock 测试**有效**，验证了精灵渲染、阵营颜色、路线虚线、透明度、旗帜等
- 16 个烟雾测试**不验证渲染输出**，应重新分类
- "路线交互" 术语有歧义 (实际为路线可视化，非用户交互)
- **需要改进**: 重新分类测试，修正功能标题

### Task 7 (H7): 将领受伤战力衰减 — **通过**

- 核心逻辑 (`getInjuryPowerModifier`, `getHeroPowerMultiplier`, `calculateRemainingPower`) 实现正确
- 6 个 H7 直接测试验证了受伤等级 -> 战力系数的完整映射
- `calculateEffectivePower` 是透传门面，文档描述不准确但非死代码
- 9 个 `getForceHealthColor` 测试与 H7 无关
- **需要改进**: 修正 `calculateEffectivePower` 的 JSDoc

---

## 修复优先级排序

| 优先级 | 问题 | 建议操作 |
|--------|------|----------|
| **P1-高** | `calculateEffectivePower` JSDoc 失实 | 修正 JSDoc，准确描述为门面封装 |
| **P1-中** | 16/35 测试为烟雾测试 | 在 Manifest 中分别报告功能测试和冒烟测试数量 |
| **P2-1** | "路线交互" 术语歧义 | 将功能标题改为 "路线可视化" |
| **P2-2** | 9/37 测试与 H7 无关 | 在测试文件中标注与 H7 的关系 |
| **P2-3** | 回城链路 mock 影响范围 | 在测试注释中说明 mock 的具体影响 |

---

## 裁决结论

Challenger 提出了 6 个质疑，经过源码验证:

- **1 个推翻** (P1-2: march:arrived->sieging 粘合代码) — 生产代码中存在完整集成
- **2 个降级** (P0->P1: calculateEffectivePower; P1->P2: 路线交互)
- **3 个维持原级** (P1: 烟雾测试; P2: 无关测试; P2: mock影响)

**最终统计: P0: 0, P1: 2, P2: 3**

Builder 的 3 个功能点**全部有条件通过**，不存在致命缺陷 (P0)。主要问题集中在:
1. 文档描述的准确性 (calculateEffectivePower JSDoc, "路线交互" 术语)
2. 测试计数的透明度 (烟雾测试/无关测试的分别报告)
3. 测试链路的完整度 (回城 mock 的影响)

这些问题不影响功能本身的正确性，但影响 Builder Manifest 的可信度。
