# R10 Challenger Attack Report

> 生成时间: 2026-05-04
> 攻击目标: Builder Manifest v1
> 攻击结果: **6个有效质疑 (P0: 1, P1: 3, P2: 2)**

---

## 攻击总览

| # | 级别 | 攻击方向 | 功能点 | 质疑摘要 |
|---|------|----------|--------|----------|
| 1 | P0 | 幻觉攻击 | Task 7 (H7) | `calculateEffectivePower` 是死代码，Builder 的函数描述与实际实现严重不符 |
| 2 | P1 | 集成断裂攻击 | Task 5 (E1-3) | `march:arrived -> sieging` 集成是测试粘合代码，非真实系统连接 |
| 3 | P1 | 无证据攻击 | Task 6 (I11) | 16/35 测试为无断言"不崩溃"测试，覆盖率虚高 |
| 4 | P1 | 无证据攻击 | Task 6 (I11) | 缺少行军精灵点击/悬停交互测试，"路线交互"声明无证据 |
| 5 | P2 | 无效证据攻击 | Task 7 (H7) | `getForceHealthColor` 测试是纯函数单元测试，与"将领受伤影响战力"无关 |
| 6 | P2 | 流程断裂攻击 | Task 5 (E1-3) | 回城行军链路未测试兵力实际变更，仅测试了 `speed * 0.8` |

---

## P0-1: `calculateEffectivePower` 是死代码 — Builder 的函数描述与实际实现严重不符

### 攻击方向: 幻觉攻击 + 漏洞攻击

### 事实

Builder 在 Manifest 中声称:

> 行 334-337 | `calculateEffectivePower(force)` — 计算编队实际战力 (基础战力 x 受伤系数)

这是**虚假描述**。实际源码 (`ExpeditionSystem.ts` 行 334-337):

```typescript
calculateEffectivePower(force: ExpeditionForce): number {
    const basePower = this.calculateRemainingPower(force.id);
    return basePower;  // <-- 直接返回，没有任何额外乘法!
}
```

函数 JSDoc 说 "在 calculateRemainingPower 基础上，额外考虑编队中将领受伤带来的战力衰减"，但实际实现**只是对 `calculateRemainingPower` 的透传**，没有任何独立逻辑。

### 影响

- Builder 声称 H7 Test 5 (`编队实际战力 = 基础战力 * 受伤系数`) 验证了 `calculateEffectivePower`，但实际上该测试调用的是 `calculateEffectivePower`，而它内部调用 `calculateRemainingPower`，后者已经包含了 `heroMultiplier`。所以测试通过是因为**底层函数已经处理了受伤系数**，而不是 `calculateEffectivePower` 自己做了什么。
- `calculateEffectivePower` 是一个空壳函数，其存在本身就是为了满足某个接口声明，但它的文档和 Builder 的描述都严重夸大了它的功能。
- 真正的战力衰减逻辑完全在 `calculateRemainingPower` (行 383-390) 中，但 Builder 把功劳归于 `calculateEffectivePower`。

### 判定: **P0** — Builder 对核心函数的描述是虚假的，测试通过不代表被测函数有实际功能。

---

## P1-1: `march:arrived -> sieging` 集成是测试粘合代码

### 攻击方向: 集成断裂攻击

### 事实

Builder 声称 Scenario 3 验证了:

> 到达触发攻占 — march:arrived -> SiegeTaskManager.advanceStatus('sieging')

但测试代码 (行 283-288) 中的连接是**测试自己写的粘合代码**:

```typescript
// 4. 监听 march:arrived 并自动推进 SiegeTaskManager
eventBus.on('march:arrived', (payload: any) => {
    if (payload.siegeTaskId) {
        taskManager.advanceStatus(payload.siegeTaskId, 'sieging');
    }
});
```

这段代码**不在任何生产代码中**。搜索整个 `src/` 目录:

- `SiegeTaskManager.ts` 的注释 (行 9) 说 "监听 march:arrived 事件推进状态"
- 但 `SiegeTaskManager.ts` 实际代码中**没有任何 `eventBus.on('march:arrived', ...)` 调用**
- 生产代码中没有任何文件将 `march:arrived` 事件与 `sieging` 状态推进连接起来

### 影响

- E2E 测试验证的集成链路在**生产代码中不存在**。真实运行时，`march:arrived` 事件发出后，`SiegeTaskManager` 不会自动推进到 `sieging`。
- 测试证明的是"如果有人写了这段连接代码，它就能工作"，而不是"系统已经正确集成了"。
- 这不是 E2E 测试，而是**手动胶水代码验证**。

### 判定: **P1** — E2E 集成测试的核心链路是伪造的。

---

## P1-2: 16/35 个行军精灵测试为无断言"不崩溃"烟雾测试

### 攻击方向: 无证据攻击

### 事实

Task 6 (I11) 测试文件 `PixelWorldMapMarchSprites.test.tsx` 共 35 个测试。

Part 1 (行 276-548) 有 16 个测试，它们的断言模式全部是:

```typescript
expect(() => {
    render(<PixelWorldMap ... activeMarches={marches} />);
}).not.toThrow();
```

这些测试不验证**任何渲染输出**，只验证组件不抛异常。在 JSDOM 环境下，Canvas 上下文不存在 (`getContext('2d')` 返回 `null`)，所以 `renderSingleMarch`、`renderMarchSpritesOverlay` 等渲染函数实际上**从未被调用**（因为 `ctx` 为 null 时函数直接 return）。

Builder 声称这 35 个测试验证了 "行军精灵Canvas渲染"，但实际上:
- Part 1 的 16 个测试: 仅验证组件不崩溃，Canvas 渲染逻辑**完全未执行**
- Part 2 的 20 个测试 (I11): 使用了 Canvas mock，这部分确实验证了渲染

所以 **16/35 = 46% 的测试是无效的**。Builder 将它们计入 "35 tests PASS" 误导性地提高了覆盖率。

### 判定: **P1** — 近半数测试为无效烟雾测试，不代表Canvas渲染功能被验证。

---

## P1-3: 缺少行军精灵交互测试 — "路线交互"声明无证据

### 攻击方向: 无证据攻击

### 事实

Builder 在功能点 2 标题中声称:

> R10 Task 6 (I11): 行军精灵Canvas渲染**+路线交互**

但在整个测试文件中，搜索 `interact`、`click`、`hover`、`select` 等关键词均**无匹配**。

源码 `PixelWorldMap.tsx` 中也没有任何行军精灵的点击/悬停交互处理。行军精灵 (`renderSingleMarch`) 只是一个纯渲染函数，没有事件绑定。

"路线交互" 可能指的是 `marchRoute` prop (行军路线预览)，但这与 "行军精灵" 无关，且已有的 `activeMarches与marchRoute同时传入不报错` 测试也只是烟雾测试。

### 影响

- Builder 声称验证了 "路线交互"，但**完全没有证据**。
- 功能点标题中包含 "+路线交互" 是不实的。

### 判定: **P1** — "路线交互" 无任何测试证据。

---

## P2-1: `getForceHealthColor` 测试与 "将领受伤影响战力" 功能无关

### 攻击方向: 无效证据攻击

### 事实

`ExpeditionSystem.casualties.test.ts` 中 37 个测试里，有 9 个测试 (行 189-227) 是 `getForceHealthColor` 的测试。这些测试直接调用 `system.getForceHealthColor(0.30)` 等数值，与 "将领受伤影响战力衰减计算" (H7) 完全无关。

`getForceHealthColor` 是一个纯函数，接受一个 0~1 的浮点数参数，返回颜色标识。它不读取编队数据，不读取受伤状态，与 H7 的核心逻辑无关。

Builder 将这 9 个测试计入 "37 tests PASS"，虚高了 H7 功能点的测试数量。如果排除无关测试:
- H7 直接相关测试: 6 个 (行 323-362)
- 间接相关但有效的测试: ~20 个
- 无关测试 (`getForceHealthColor`): 9 个

### 判定: **P2** — 9/37 测试与 H7 功能无关，但测试数量确实通过(真实+虚高)。

---

## P2-2: 回城行军链路未测试兵力实际变更

### 攻击方向: 流程断裂攻击

### 事实

Scenario 4 (行 340-464) 声称验证了 "回城行军完整链路"，但存在以下断裂:

1. **攻城战斗结果与回城行军之间缺少伤亡集成**: 测试手动设置了 `troopsLost: 750`，然后手动传入 `troops: 5000 - 750 = 4250` 创建回城行军。这意味着伤亡计算和回城创建之间没有自动化的集成验证。
2. **`createReturnMarch` 被模拟了**: 测试使用 `vi.spyOn(marchingSystem, 'calculateMarchRoute').mockReturnValue(...)` 来绕过路径计算，但 `calculateMarchRoute` 是 `createReturnMarch` 的核心依赖。这意味着回城行军的路径计算逻辑**完全被跳过**。
3. **第二辆车行军测试 (行 442-463) 同样 mock 了 `calculateMarchRoute`**。

Builder 声称 "唯一mock: `calculateMarchRoute` 在Scenario 4中mock为返回固定路径"，但实际上这个 mock 影响**整个回城行军测试链路**，不是无关紧要的 mock。

### 判定: **P2** — 回城链路测试依赖核心 mock，测试覆盖的完整度低于声称。

---

## 肯定 (Builder 正确的部分)

以下攻击方向**未能推翻**:

1. **测试确实通过了**: 三个测试套件 86/86 全部 PASS，无幻觉。
2. **源码确实存在**: 所有声称的源码文件和函数确实存在，行号基本准确（除 `calculateEffectivePower` 的功能描述失实）。
3. **H7 核心逻辑正确**: `getInjuryPowerModifier`、`getHeroPowerMultiplier`、`calculateRemainingPower` 三个函数的实现与测试完全吻合，受伤等级对应的战力系数 (1.0/0.8/0.5/0.2) 验证正确。
4. **Canvas 渲染测试有效**: Part 2 的 20 个 I11 Canvas Mock 测试确实验证了精灵渲染的 fillRect/fillStyle/globalAlpha/setLineDash 等关键 Canvas API 调用。
5. **事件顺序验证有效**: Scenario 1 和 Scenario 7 的事件顺序验证 (created -> started -> arrived) 是真实有效的集成测试。

---

## 攻击汇总

| # | 级别 | 功能点 | 质疑 | 状态 |
|---|------|--------|------|------|
| 1 | **P0** | H7 | `calculateEffectivePower` 是死代码，Builder 函数描述虚假 | 有效 |
| 2 | **P1** | E1-3 | march:arrived->sieging 集成是测试粘合代码 | 有效 |
| 3 | **P1** | I11 | 16/35 测试为无断言烟雾测试 | 有效 |
| 4 | **P1** | I11 | "路线交互" 无测试证据 | 有效 |
| 5 | P2 | H7 | 9/37 测试与 H7 功能无关 | 有效 |
| 6 | P2 | E1-3 | 回城链路核心 mock 影响测试完整度 | 有效 |

**最终判定: 6个有效质疑 (P0: 1, P1: 3, P2: 2)**

Builder 的 3 个功能点不能全部成立:
- **Task 5 (E1-3)**: P1 级别集成断裂 — E2E 链路中 march:arrived->sieging 的自动连接在生产代码中不存在
- **Task 6 (I11)**: P1 级别证据不足 — "路线交互" 无证据，46% 测试无效
- **Task 7 (H7)**: P0 级别虚假描述 — `calculateEffectivePower` 是空壳函数，Builder 对其功能的描述是虚假的
