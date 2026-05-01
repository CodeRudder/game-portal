# Unification 模块对抗式测试 — Round 1 挑战报告

> **角色**: TreeChallenger
> **模块**: unification（天下一统引擎层）
> **Round**: 1
> **日期**: 2026-05-01
> **参考缺陷模式**: DEF-001~DEF-023 (23个P0模式)

---

## 挑战总览

| 维度 | 代号 | 发现遗漏数 | 严重等级 |
|------|------|-----------|---------|
| 正常流程 | F-Normal | 5 | 🔴 高 |
| 边界条件 | F-Boundary | 12 | 🔴 高 |
| 异常路径 | F-Error | 8 | 🔴 高 |
| 跨系统交互 | F-Cross | 6 | 🟡 中 |
| 状态转换 | F-State | 4 | 🔴 高 |
| **合计** | — | **35** | — |

---

## F-Normal: 正常流程遗漏

### N-01: EndingSystem.evaluateConditions 除零漏洞未覆盖
**严重度**: P0
**描述**: `calculateScore`中`ctx.powerCap`和`ctx.prestigeCap`作为除数，但无零值防护。当`powerCap=0`时，`(totalPower/0)*100 = Infinity`，`Math.min(100, Infinity) = 100`。这意味着战力为0时powerScore=100，完全反转了评分逻辑。
**源码位置**: EndingSystem.ts:293-298
```typescript
const powerScore = Math.min(100, Math.round((ctx.totalPower / ctx.powerCap) * 100));
const prestigeScore = Math.min(100, Math.round((ctx.prestigeLevel / ctx.prestigeCap) * 100));
```
**遗漏**: 流程树标记了END-B02/B05为P0但未在测试中实际验证此行为。

### N-02: GlobalStatisticsSystem.update dt无NaN/负数/Infinity防护
**严重度**: P0
**描述**: `update(dt)`直接执行`this.accumulatedOnlineSeconds += dt`，无任何验证。NaN/负数/Infinity均可穿透，导致在线时长被污染。一旦accumulatedOnlineSeconds变为NaN，所有后续update和serialize都会传播NaN。
**源码位置**: GlobalStatisticsSystem.ts:64
```typescript
update(dt: number): void {
  this.accumulatedOnlineSeconds += dt;
}
```
**模式匹配**: DEF-006 (NaN全链传播)

### N-03: IntegrationValidator.validateCrossSystemFlow 无异常保护
**严重度**: P0
**描述**: `validateCrossSystemFlow`直接调用provider方法（如`p.getHeroStats('hero_1')`），但不像`validateCoreLoop`使用`makeStep`包装。如果provider方法抛出异常，整个validateAll中断，其他3个维度的验证也不会执行。
**源码位置**: IntegrationValidator.ts:158-215
```typescript
const heroStats = p.getHeroStats('hero_1'); // 无try-catch
checks.push({
  sourceValue: heroStats?.attack ?? 0, // 如果上面抛异常，这里不会执行
  ...
});
```
**模式匹配**: DEF-013 (无try-finally)

### N-04: ObjectPool.deallocate 线性查找性能退化
**严重度**: P2
**描述**: `deallocate`使用`this.pool.find(e => e.object === obj)`，O(n)复杂度。高频场景（粒子系统每帧数百次）会导致性能退化。但更严重的是：如果传入未在池中的对象，静默忽略，不报错。
**源码位置**: ObjectPool.ts:82-87

### N-05: BalanceValidator 配置注入无验证
**严重度**: P1
**描述**: `setResourceConfigs`/`setHeroBaseStats`/`setBattleConfig`等setter方法无输入验证。传入null/undefined/空数组后，后续`validateAll`会在`this.resourceConfigs.map(...)`处崩溃(TypeError: Cannot read properties of null)。
**源码位置**: BalanceValidator.ts:105-125

---

## F-Boundary: 边界条件遗漏

### B-01: EndingSystem — powerCap=0导致评分反转
**严重度**: P0
**描述**: 当`EndingContext.powerCap=0`时：
- `totalPower / 0 = Infinity`（JS除零行为）
- `Math.round(Infinity * 100) = NaN`（实际上Infinity*100=Infinity, Math.round(Infinity)=NaN）
- `Math.min(100, NaN) = NaN`

等等，让我重新分析：
- `0 / 0 = NaN` → `NaN * 100 = NaN` → `Math.round(NaN) = NaN` → `Math.min(100, NaN) = NaN`
- `100 / 0 = Infinity` → `Infinity * 100 = Infinity` → `Math.round(Infinity) = NaN` → `Math.min(100, NaN) = NaN`

所以powerCap=0时powerScore=NaN，totalScore=NaN，determineGrade(NaN)中`NaN >= 90 = false`，所有比较都false，最终返回'C'级。这虽然不是评分反转，但NaN污染了整个评分结果。
**源码位置**: EndingSystem.ts:293
**模式匹配**: DEF-006 (NaN传播)

### B-02: EndingSystem — prestigeCap=0 同理NaN
**严重度**: P0
**描述**: 与B-01相同的除零问题，prestigeCap=0时prestigeScore=NaN。
**源码位置**: EndingSystem.ts:296

### B-03: GlobalStatisticsSystem — deserialize无输入验证
**严重度**: P0
**描述**: `deserialize(data)`直接访问`data.accumulatedOnlineSeconds`，如果data为null/undefined，TypeError崩溃。如果data.accumulatedOnlineSeconds为NaN/负数/Infinity，状态被污染。
**源码位置**: GlobalStatisticsSystem.ts:114
```typescript
deserialize(data: GlobalStatisticsSaveData): void {
  this.accumulatedOnlineSeconds = data.accumulatedOnlineSeconds;
}
```
**模式匹配**: DEF-010 (deserialize null防护)

### B-04: PerformanceMonitor — dt=0导致fps=Infinity
**严重度**: P1
**描述**: `update(dt)`中如果dt=0（帧间隔为0），则`deltaMs = now - lastFrameTime`可能非常小甚至为0，导致`fps = 1000 / 0 = Infinity`。Infinity被推入fpsSamples，影响所有统计计算（average/min/max/onePercentLow）。
**源码位置**: PerformanceMonitor.ts:108
```typescript
const fps = 1000 / deltaMs;
this.fpsSamples.push({ timestamp: now, deltaMs, fps });
```

### B-05: EndingSystem — deserialize无深拷贝
**严重度**: P1
**描述**: `deserialize`直接赋值`this.state.finalScore = data.finalScore`，如果finalScore是对象引用，外部修改会影响内部状态。虽然EndingSaveData中的finalScore是只读使用的，但违反了BR-16规则（serialize/deserialize必须使用深拷贝）。
**源码位置**: EndingSystem.ts:219-224

### B-06: GraphicsQualityManager — Auto模式无detectionResult时回退
**严重度**: P1
**描述**: `getPresetConfig`在Auto模式无detectionResult时回退到Medium配置。但`detectDeviceCapability`在init中被调用，如果init未被调用（如直接new后getPresetConfig），detectionResult=null。
**源码位置**: GraphicsQualityManager.ts:167-171

### B-07: DirtyRectManager.merge — 脏矩形合并后宽度/高度可能为负
**严重度**: P2
**描述**: merge中使用`Math.max(overlap.x + overlap.width, rect.x + rect.width) - x`计算宽度。如果输入的DirtyRect有负width/height，合并结果可能异常。但正常使用不会出现负值。

### B-08: calcRebirthMultiplier — count=0返回1.0但count=-1未处理
**严重度**: P1
**描述**: `calcRebirthMultiplier(count, config)`在count<=0时返回1.0，但负数count在for循环中`i <= count`不会执行，也返回1.0。对数曲线分支中`Math.log(1 + (-1)) = Math.log(0) = -Infinity`，但被`Math.min(baseMultiplier + (-Infinity), maxMultiplier)`截断为baseMultiplier=1.0。虽然结果正确，但路径不清晰。
**源码位置**: BalanceUtils.ts:88-99

### B-09: BalanceReport.calculateStagePoints — totalStages=0时progress=NaN
**严重度**: P1
**描述**: 当`totalChapters=0`或`stagesPerChapter=0`时，`totalStages=0`，`progress = 0 / (0 - 1) = 0 / -1 = 0`。不会NaN，但for循环不执行，返回空结果。这是安全的。

### B-10: VisualSpecDefaults.hexToRgb — 短格式hex不匹配
**严重度**: P2
**描述**: `hexToRgb`只匹配6位hex(`[0-9a-f]{2}`)，不支持3位简写格式（如`#FFF`）。传入`#FFF`返回null，后续colorDifference返回100。

### B-11: GraphicsQualityManager.setFrameRateLimit — 仅允许30/60
**严重度**: P2
**描述**: `setFrameRateLimit`只接受30和60，其他值强制为60。但高刷新率设备(120Hz/144Hz)无法利用。这是设计决策而非缺陷，但应在文档中说明。

### B-12: ObjectPool — initialSize为负数时pool为空
**严重度**: P2
**描述**: `constructor`中`for (let i = 0; i < initialSize; i++)`，如果initialSize为负数或0，不预分配任何对象。这不是bug，但应在文档中说明。

---

## F-Error: 异常路径遗漏

### E-01: EndingSystem — deps未初始化时调用buildContextFromDeps
**严重度**: P0
**描述**: 如果在`init(deps)`之前调用`triggerUnification()`或`checkTrigger()`，`this.deps`为`undefined`，`this.deps.registry`→TypeError崩溃。
**源码位置**: EndingSystem.ts:271
```typescript
private buildContextFromDeps(): EndingContext {
  // ...
  const registry = this.deps?.registry; // deps未初始化时this.deps为undefined
  // this.deps?.registry 安全，但 this.deps! 可能不安全
```
实际上代码使用了`this.deps?.registry`可选链，所以deps=undefined时`registry=undefined`，不会崩溃。但`this.deps!.eventBus`在triggerUnification中使用了非空断言。
**修正**: triggerUnification.ts:206 `this.deps.eventBus.emit(...)` — deps未初始化时TypeError。
**源码位置**: EndingSystem.ts:206

### E-02: GlobalStatisticsSystem — deps未初始化时getSnapshot
**严重度**: P1
**描述**: `getSnapshot`中`this.deps?.registry`使用了可选链，deps未初始化时registry=undefined，不会崩溃。安全。

### E-03: IntegrationValidator — validateCrossSystemFlow异常未捕获
**严重度**: P0
**描述**: 与N-03相同。validateCoreLoop使用makeStep包装（有try-catch），但validateCrossSystemFlow直接调用provider方法，无异常保护。如果provider实现有bug抛出异常，validateAll中断。
**源码位置**: IntegrationValidator.ts:158-215
**模式匹配**: DEF-013

### E-04: PerformanceMonitor — sampleMemory performance.memory不存在
**严重度**: P1
**描述**: 已处理。代码检查`perf.memory`是否存在，不存在时使用估算值50MB。✅ 安全。

### E-05: EndingSystem — triggerUnification事件发射失败
**严重度**: P1
**描述**: `this.deps.eventBus.emit('ending:unified', ...)` — 如果eventBus为null或emit方法抛异常，统一状态已经修改(unified=true)但事件未发出。这不是原子性问题（状态已变更），但事件丢失可能导致UI不更新。
**源码位置**: EndingSystem.ts:206-210

### E-06: BalanceValidator — validateAll中途异常导致部分结果丢失
**严重度**: P1
**描述**: `validateAll`按顺序执行5个验证步骤，如果第3步(validateBattleDifficulty)抛异常，前2步的结果也丢失。无try-catch保护每个步骤。
**源码位置**: BalanceValidator.ts:134-161

### E-07: VisualConsistencyChecker — findExpectedColor未知category
**严重度**: P1
**描述**: `findExpectedColor`的switch没有default分支。如果category不是'quality'/'faction'/'functional'/'status'之一，函数返回undefined（TypeScript中不是null）。调用方检查`!expectedColor`，undefined也是falsy，所以行为正确。但类型签名声明返回`string | null`，实际可能返回undefined。

### E-08: GraphicsQualityManager — applyPresetConfig未知preset
**严重度**: P1
**描述**: `applyPresetConfig(preset)`查找`PRESET_CONFIGS[preset]`，如果preset不是预定义的4个值之一，config=undefined，`if (!config) return`安全退出。但advanced选项不会被修改，可能处于不一致状态。

---

## F-Cross: 跨系统交互遗漏

### C-01: EndingSystem ↔ GlobalStatisticsSystem 统一后统计同步
**严重度**: P1
**描述**: EndingSystem触发统一后，GlobalStatisticsSystem.getSnapshot()应反映统一状态。但两个系统独立查询registry，没有直接交互。如果EndingSystem的triggerUnification修改了territory系统状态，GlobalStatisticsSystem应自动反映。但如果没有修改territory（仅读取），则统计一致。需验证。

### C-02: PerformanceMonitor ↔ ObjectPool 注册时机
**严重度**: P1
**描述**: ObjectPool通过`registerPool`注册到PerformanceMonitor，但如果ObjectPool.clear()后未重新注册，getPoolStates返回的poolSize=0但pool对象仍被引用。这不是内存泄漏（Map持有引用），但状态可能不一致。

### C-03: GraphicsQualityManager ↔ SettingsManager 同步
**严重度**: P1
**描述**: `syncGraphicsSettings`从外部同步设置，但`setPreset`不通知SettingsManager。如果只通过GraphicsQualityManager修改画质，SettingsManager中的设置可能不同步。双向同步缺失。

### C-04: VisualConsistencyChecker.generateReport 交互报告占位
**严重度**: P2
**描述**: `generateReport`中的interactionReport是硬编码的空报告：
```typescript
interactionReport: {
  id: '', timestamp: Date.now(),
  totalComponents: 0, results: [],
  summary: { totalRules: 0, passedRules: 0, ... }
}
```
未实际调用InteractionAuditor.audit()。综合评分中交互维度被忽略，overallScore只基于动画+配色。

### C-05: BalanceValidator → BalanceReport 重复逻辑
**严重度**: P2
**描述**: BalanceValidator中`validateSingleResource`和BalanceReport中`validateSingleResource`有几乎相同的逻辑。BalanceValidator的版本是私有方法，而BalanceReport的版本是导出函数。BalanceValidator.validateResourceBalance调用的是自己的私有方法，不调用BalanceReport的导出函数。代码重复，维护风险。

### C-06: IntegrationValidator → SimulationDataProvider 硬编码数据
**严重度**: P2
**描述**: DefaultSimulationDataProvider使用硬编码数据（hero_1固定attack=100等）。validateCoreLoop中检查`stats.attack > 0`永远为true（硬编码数据）。这不是真正的验证，只是形式检查。真实场景应注入真实系统数据。

---

## F-State: 状态转换遗漏

### S-01: EndingSystem — serialize→deserialize往返一致性
**严重度**: P0
**描述**: 流程树标记为⚠️未测试。需要验证：
1. 初始状态serialize → deserialize(初始数据) → 状态不变
2. 触发统一后serialize → reset → deserialize → 状态恢复
3. finalScore对象是否深拷贝（引用问题）
**模式匹配**: BR-03 (状态变更API必须检查serialize/deserialize路径)

### S-02: GlobalStatisticsSystem — serialize→deserialize往返
**严重度**: P0
**描述**: 同S-01，需验证accumulatedOnlineSeconds的往返一致性。特别关注：
1. 大数值（如累计100天=8,640,000秒）的精度
2. deserialize(null)的行为
**模式匹配**: BR-03

### S-03: PerformanceMonitor — reset清除pools但不重建
**严重度**: P1
**描述**: `reset()`中`this.pools.clear()`清除所有注册的pool引用。但reset后如果继续使用，之前的pool对象仍然存在（外部引用），只是不再被Monitor跟踪。可能导致内存泄漏感知不准确。

### S-04: GraphicsQualityManager — reset不重置detectionResult
**严重度**: P1
**描述**: `reset()`重置preset和advanced选项，但不重置`detectionResult`。这意味着reset后如果设为Auto模式，会使用旧的检测结果而非重新检测。

---

## P0 汇总（需立即修复）

| # | 代号 | 严重度 | 子系统 | 缺陷描述 | 模式匹配 |
|---|------|--------|--------|----------|----------|
| 1 | B-01 | P0 | EndingSystem | powerCap=0导致powerScore=NaN | DEF-006 |
| 2 | B-02 | P0 | EndingSystem | prestigeCap=0导致prestigeScore=NaN | DEF-006 |
| 3 | B-03 | P0 | GlobalStatisticsSystem | deserialize(null)崩溃 | DEF-010 |
| 4 | N-02 | P0 | GlobalStatisticsSystem | update(dt)无NaN/负数/Infinity防护 | DEF-006 |
| 5 | N-03 | P0 | IntegrationValidator | validateCrossSystemFlow无异常保护 | DEF-013 |
| 6 | E-01 | P0 | EndingSystem | deps未初始化时triggerUnification崩溃 | DEF-004 |
| 7 | E-03 | P0 | IntegrationValidator | validateCrossSystemFlow异常中断validateAll | DEF-013 |
| 8 | S-01 | P0 | EndingSystem | serialize→deserialize往返未验证 | BR-03 |
| 9 | S-02 | P0 | GlobalStatisticsSystem | serialize→deserialize往返未验证 | BR-03 |

**P0总数**: 9个

---

## P1 汇总（需后续修复）

| # | 代号 | 子系统 | 缺陷描述 |
|---|------|--------|----------|
| 1 | N-05 | BalanceValidator | 配置注入无null验证 |
| 2 | B-04 | PerformanceMonitor | dt=0导致fps=Infinity |
| 3 | B-05 | EndingSystem | deserialize无深拷贝 |
| 4 | B-06 | GraphicsQualityManager | Auto模式无detectionResult回退 |
| 5 | B-08 | BalanceUtils | calcRebirthMultiplier负数count |
| 6 | E-05 | EndingSystem | 事件发射失败状态已变更 |
| 7 | E-06 | BalanceValidator | validateAll中途异常丢失结果 |
| 8 | E-07 | VisualConsistencyChecker | findExpectedColor无default分支 |
| 9 | E-08 | GraphicsQualityManager | applyPresetConfig未知preset |
| 10 | C-01 | Ending↔GlobalStats | 统一后统计同步验证 |
| 11 | C-02 | PerformanceMonitor↔ObjectPool | clear后注册状态不一致 |
| 12 | C-03 | GraphicsQuality↔Settings | 双向同步缺失 |
| 13 | S-03 | PerformanceMonitor | reset清除pools不重建 |
| 14 | S-04 | GraphicsQualityManager | reset不重置detectionResult |

**P1总数**: 14个

---

## P2 汇总（记录跟踪）

| # | 代号 | 子系统 | 缺陷描述 |
|---|------|--------|----------|
| 1 | N-04 | ObjectPool | deallocate线性查找+静默忽略 |
| 2 | B-07 | DirtyRectManager | 负width/height合并异常 |
| 3 | B-10 | VisualSpecDefaults | 不支持3位hex简写 |
| 4 | B-11 | GraphicsQualityManager | 仅允许30/60帧率 |
| 5 | B-12 | ObjectPool | initialSize为0时无预分配 |
| 6 | C-04 | VisualConsistencyChecker | 交互报告硬编码空值 |
| 7 | C-05 | BalanceValidator↔BalanceReport | 重复验证逻辑 |
| 8 | C-06 | IntegrationValidator | 硬编码模拟数据 |

**P2总数**: 8个
