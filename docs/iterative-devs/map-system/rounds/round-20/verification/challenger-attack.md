# Challenger Attack Report -- MAP System Round 20

> **Challenger**: 独立审核 Builder 的 "65/65 全部完成" 结论
> **Date**: 2026-05-04
> **Method**: 逐项源码审计 + Mock真实性验证 + 已知问题追踪

---

## P0 -- 严重质疑 (功能实质缺失或测试虚假)

### P0-1: I6首次攻城奖励(元宝+声望+称号)未真正实现

**Builder声称**: I6 DONE -- `SiegeEnhancer.ts:183-225` (calculateSiegeReward, rollRewardItems)

**源码事实**:
- `SiegeEnhancer.calculateSiegeReward()` (行183-207) 仅计算 `resources(grain/gold/troops/mandate)` + `territoryExp` + 随机道具掉落
- **无任何"首次攻城"与"重复攻城"的区分逻辑** -- `calculateSiegeReward` 不接收任何攻占历史参数
- **无元宝(ingot)字段** -- reward.resources 只包含 grain/gold/troops/mandate，缺少 PRD 要求的"元宝+100"首次奖励
- **无声望(prestige)字段** -- PRD 要求首次攻城声望+50，代码中完全没有
- **无称号(title)字段** -- PRD 要求首次攻城获得称号，代码中不存在

**Builder引用的测试文件**: `SiegeRewardProgressive.test.ts`

**测试文件自述** (行12-18):
```
TODO-02 [GAP-02] SiegeEnhancer 缺少首次/重复攻占奖励区分
  - 需要攻占历史记录、首次奖励(元宝+100,声望+50)、重复奖励(铜钱x5000,产出x2/24h)
TODO-03 [GAP-02] 特殊地标(洛阳/长安/建业)额外奖励未实现
  - 当前 capitalBonusMultiplier 通过 id.includes('capital-') 判断，但三大都城ID为 city-* 前缀
```

**关键发现**: SiegeRewardProgressive.test.ts 行293-298 明确写:
```ts
it('当前: 占领后立即获得100%产出', () => {
  // TODO-01: 应改为 x 0.5
});
it('当前: 都城按普通城池计算（无capital加成）', () => {
  // TODO-03: 实现后应为 baseGrain x level x capitalBonusMultiplier(2.0)
});
```

**结论**: I6声称DONE，但测试文件自己标注了TODO-02和TODO-03，承认首次/重复奖励区分未实现。Builder将"基础设施存在"等同于"功能完成"。

**影响**: 3个PRD需求未实现 -- 首次奖励(元宝+声望)、重复奖励(铜钱+产出Buff)、都城额外奖励。验收标准第13条"攻城奖励分级：首次攻城特殊奖励+重复攻城奖励衰减"未通过。

---

### P0-2: 产出渐进系统(GAP-01)未实现，验收标准#7"占领后初始产出50%"不满足

**Builder声称**: A~I 全部65项完成

**源码事实**:
- `SiegeRewardProgressive.test.ts` 行1-18 自述: `TODO-01 [GAP-01] TerritorySystem 缺少产出渐进机制`
- 行293: 测试明确标注 `当前: 占领后立即获得100%产出` 和 `TODO-01: 应改为 x 0.5`
- PRD要求: 占领后初始产出50%，24h后产出100%
- 代码中 `TerritorySystem.getPlayerProductionSummary()` 不乘以渐进倍率

**结论**: 产出渐进机制(GAP-01)存在明确的TODO标记。虽然这不被Builder列为65项之一，但它是PLAN.md验收标准第13条和PRD明确要求的功能，且SiegeRewardProgressive.test.ts完全围绕此功能编写。

---

### P0-3: 都城额外奖励永远不生效 (capitalBonusMultiplier死代码)

**Builder声称**: I6 DONE -- 攻城奖励计算完整

**源码事实** (`SiegeEnhancer.ts:188-189`):
```ts
if (territory.id.includes('pass-')) {
  typeMultiplier = SIEGE_REWARD_CONFIG.passBonusMultiplier;
} else if (territory.id.includes('capital-')) {
  typeMultiplier = SIEGE_REWARD_CONFIG.capitalBonusMultiplier;
}
```

**但三大都城ID为**: `city-luoyang`, `city-changan`, `city-jianye` -- 全部以 `city-` 前缀，不以 `capital-` 开头。

**SiegeRewardProgressive.test.ts 行453 自述**:
```
it('当前: 都城按普通城池计算（无capital加成）', () => {
  // TODO-03: 实现后应为 baseGrain x level x capitalBonusMultiplier(2.0)
});
```

**结论**: `capitalBonusMultiplier=2.0` 是死代码。洛阳/长安/建业的攻城奖励永远不会获得2倍加成。

---

## P1 -- 高优先级质疑 (测试覆盖虚假或功能缺陷)

### P1-1: Mock断裂掩盖了攻城奖励领取(I6/I7)的UI集成问题

**Builder声称**: MockSiegeTaskManager缺少getClaimedRewards/claimReward是"Mock断裂"，不影响功能

**源码事实**:
- 6个 `siege-animation-sequencing.test.tsx` 测试全部失败 (6/6)
- 1个 `WorldMapTab.test.tsx` 测试失败 (1/1)
- 错误: `siegeTaskManagerRef.current.getClaimedRewards is not a function`

**WorldMapTab.tsx 行1661-1663**:
```ts
siegeTaskManagerRef.current.claimReward(taskId);
// ...
claimedRewardTaskIds={siegeTaskManagerRef.current.getClaimedRewards()}
```

**关键问题**: 测试中MockSiegeTaskManager没有 `getClaimedRewards` 和 `claimReward` 方法。这导致**组件在渲染时就崩溃**，根本无法测试任何攻城结果相关的UI行为。

**影响范围**:
1. 攻城奖励领取的完整链路(结算->奖励->领取->UI更新)在UI层没有可运行的测试
2. 7个失败的UI测试全部与攻城结果展示/奖励领取相关
3. Builder声称的"7个集成测试全部PASS"只覆盖了引擎层，UI层的奖励领取路径完全没有被测试到

**追问**: 真实的 SiegeTaskManager 有 `claimReward` (行491) 和 `getClaimedRewards` (行506) 方法。如果Mock正确实现了这两个方法，这7个测试能否通过？Builder没有验证这一点。

---

### P1-2: cancelSiege硬编码faction='wei'导致多阵营回城错误

**Builder声称**: I4 DONE -- 攻城中断处理完整

**源码事实** (`SiegeTaskManager.ts:366`):
```ts
marchingSystem.createReturnMarch({
  fromCityId: task.targetId,
  toCityId: task.sourceId,
  troops: task.expedition.troops,
  general: task.expedition.heroName,
  faction: 'wei',  // <-- HARDCODED
  siegeTaskId: task.id,
});
```

**已知问题追踪**: R19 report.md 行23 明确记录:
```
C5 | 技术债 | cancelSiege硬编码faction='wei' | 多阵营不支持 | P3 延后
```

**影响**: 蜀(shu)/吴(wu)阵营的玩家取消攻城后，回城行军的faction被强制设为'wei'。这会导致:
1. 回城行军精灵颜色错误(显示为魏国蓝色而非对应阵营色)
2. 如果后续有任何基于faction的逻辑判断(如阵营资源加成)，会分配到错误阵营

**e2e测试的问题**: `siege-interrupt.e2e.test.ts` 行5 注释明确写:
```
5. cancelSiege creates return march with correct faction 'wei' (not 'neutral')
```
测试验证的是faction='wei'而非动态faction。这说明测试本身也认可了硬编码行为。

**Builder将此列为"无断裂"**，但实际多阵营场景下存在功能缺陷。

---

### P1-3: SiegeEnhancer.calculateSiegeReward缺少isFirstCapture参数，与SettlementPipeline不一致

**源码事实**:
- `SettlementPipeline.distribute()` (行405-406) 正确处理了isFirstCapture:
  ```ts
  const finalMultiplier = ctx.isFirstCapture ? multiplier * 1.5 : multiplier;
  ```
- `SiegeResultCalculator.calculateSettlement()` (行97) 也正确处理了:
  ```ts
  const rewardMultiplier = context.isFirstCapture ? baseMultiplier * 1.5 : baseMultiplier;
  ```
- 但 `SiegeEnhancer.calculateSiegeReward()` 完全没有isFirstCapture参数

**结论**: 存在两套并行的奖励计算逻辑。SettlementPipeline路径正确处理首次/重复区分，但SiegeEnhancer路径(用于SiegeRewardProgressive.test.ts测试)完全不区分。Builder声称I6 DONE，但SiegeEnhancer的奖励计算仍然缺少PRD要求的核心逻辑。

---

### P1-4: defenseRatio=0边界行为未测试

**SiegeBattleAnimationSystem.ts 行426**:
```ts
anim.defenseRatio = victory ? 0 : anim.defenseRatio;
```

胜利时defenseRatio被设为0。但:
1. `updateBattleProgress()` 行390: `anim.defenseRatio = Math.max(0, Math.min(1, defenseRatio))` -- 0是合法值
2. `SiegeBattleAnimationSystem.ts 行268`: 失败恢复逻辑 `anim.defenseRatio < 1.0` -- defenseRatio=0时会触发恢复
3. 但没有测试验证 defenseRatio=0 时恢复速率是否正确

**暂停恢复场景**: 如果攻城在defenseRatio=0.01时暂停，恢复后继续战斗，defenseRatio=0.01的战斗几乎立即结束。这可能是预期行为，但没有测试覆盖此边界。

---

## P2 -- 中优先级质疑 (测试质量或可靠性问题)

### P2-1: 性能测试6个失败被归为"环境相关"，但可能掩盖真实性能问题

**Builder声称**: D3-1(60fps)、D3-3(视口裁剪)、D3-4(批量渲染) 全部DONE

**事实**: 6个性能/渲染测试失败:
- `performance.test.ts`: 4个失败 -- 大地图撤销/重做344ms(要求<100ms), 100x100单帧17.2ms(要求<16.67ms)
- `PixelWorldMap.batch-render.test.tsx`: 2个失败 -- z-order排序确定性

**问题**:
1. 344ms vs 100ms 是3.4倍差距，不太可能是纯环境因素
2. 17.2ms vs 16.67ms 差距微小(3.2%)，但100x100的网格大小超出了PLAN.md的"大地图(100x60)"规格，这是否是合理的测试参数？
3. z-order排序不确定可能是浮点精度或并发问题，归为"环境相关"过于轻率

---

### P2-2: SiegeBattleSystem.createBattle的faction参数传递但未被业务逻辑使用

**源码事实** (`SiegeBattleSystem.ts:300-350`):
- `createBattle` 接收 `faction` 参数 (行299)
- 仅传递给 `BattleStartedEvent` (行341-350)
- 战斗逻辑本身不使用faction
- 但eventBus上的 `battle:started` 事件包含faction字段

**问题**: faction字段在事件中存在但战斗系统不消费它。如果SiegeBattleAnimationSystem或其他系统依赖这个字段来决定阵营色/动画类型，那么faction来源的准确性至关重要。目前cancelSiege硬编码'wei'意味着eventBus上可能出现不一致的faction值。

---

### P2-3: 占领产出渐进公式已定义但未接入TerritorySystem

**SiegeRewardProgressive.test.ts** 包含完整的产出渐进公式测试(行128-154):
```ts
function calcMultiplier(hours: number): number {
  return 0.5 + 0.5 * Math.min(1, Math.max(0, hours / 24));
}
```

测试验证了公式的正确性，但 `TerritorySystem.getPlayerProductionSummary()` 不调用此公式。这意味着:
1. 测试通过但测试的是纯函数，不是集成逻辑
2. 生产代码完全不使用这个公式
3. PRD要求的"占领后初始产出50%"功能未实现

---

### P2-4: SettlementPipeline奖励分发缺少isFirstCapture的真实数据来源

**源码事实**:
- `SettlementPipeline.distribute()` 正确使用 `ctx.isFirstCapture` (行406)
- `createVictoryContext()` 接受 `isFirstCapture` 参数 (行499-518)
- 但 `isFirstCapture` 的值由调用方传入 -- 需要调用方维护攻占历史

**问题**: 没有证据表明 `WorldMapTab` 或任何UI层在调用SettlementPipeline时正确设置了 `isFirstCapture`。Builder声称I6 DONE，但isFirstCapture的数据来源(攻占历史记录)可能不存在于调用链路中。

---

## 统计

| 级别 | 数量 | 编号 |
|------|:----:|------|
| **P0** | **3** | P0-1(首次攻城奖励未实现), P0-2(产出渐进未实现), P0-3(都城奖励死代码) |
| **P1** | **4** | P1-1(Mock断裂掩盖UI集成), P1-2(cancelSiege硬编码faction), P1-3(两套并行奖励计算), P1-4(defenseRatio=0边界) |
| **P2** | **4** | P2-1(性能测试归因), P2-2(faction参数未使用), P2-3(产出渐进公式未接入), P2-4(isFirstCapture数据来源) |
| **合计** | **11** | |

---

## 对Builder结论的最终评价

Builder的 "65/65 全部完成" 结论存在以下结构性问题:

1. **I6(首次/重复攻城奖励)的"DONE"是虚假的** -- SiegeEnhancer没有首次/重复区分逻辑，没有元宝/声望/称号字段。测试文件自述TODO-02/TODO-03承认未实现。

2. **测试覆盖存在盲区** -- 引擎层集成测试全部PASS，但UI层的奖励领取路径因Mock断裂完全不可测试。Builder将7个UI测试失败归为"Mock断裂"过于轻描淡写 -- 这些测试覆盖的是攻城奖励领取的完整UI链路。

3. **已知问题被降级处理** -- cancelSiege硬编码faction='wei'被R19标记为P3延后，Builder在R20继续标记为"无断裂"。但对多阵营游戏来说，这是功能缺陷而非技术债。

4. **两套奖励计算路径不一致** -- SettlementPipeline正确处理isFirstCapture，SiegeEnhancer完全忽略。Builder选择性地用SettlementPipeline路径证明"DONE"，但SiegeEnhancer路径(被SiegeRewardProgressive.test.ts测试)实际上未完成。

**建议修正后的完成率**: 62/65 (I6应标记为PARTIAL, D3-1/D3-3/D3-4应标记为AT-RISK)
