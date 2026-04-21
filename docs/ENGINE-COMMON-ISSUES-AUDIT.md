# 三国霸业引擎层常见问题审计报告

> **审计范围**：v1.0(基业初立) + v2.0(招贤纳士) 引擎层核心代码  
> **审计日期**：2025-01-XX  
> **审计人**：Game Developer Agent  

---

## 🔴 P0（必须修复）：会导致数据损坏/游戏崩溃

### P0-01 | quickEnhance 资源消耗失败时武将仍被升级（免费升级漏洞）

**文件**：`engine/hero/HeroLevelSystem.ts:308-310`

**问题描述**：`quickEnhance` 方法调用 `spendResource` 但**不检查返回值**。`spendResource`（实际是 `safeSpendResource`）在资源不足时捕获异常并返回 `false`，但 `quickEnhance` 忽略了该返回值，继续执行 `syncToHeroSystem`，导致武将**免费升级**。

```typescript
// 第 308-310 行
if (goldNeed > 0) this.levelDeps.spendResource(GOLD_TYPE, goldNeed);  // 返回值被忽略！
if (expNeed > 0) this.levelDeps.spendResource(EXP_TYPE, expNeed);    // 返回值被忽略！
this.syncToHeroSystem(heroSystem, generalId, final, 0);              // 无条件执行！
```

**复现场景**：
1. 武将 A 的 `calculateMaxAffordableLevel` 计算出可升到 20 级
2. 在计算和实际消耗之间，另一个操作（如建筑升级）消耗了铜钱
3. `spendResource` 返回 `false`（资源不足）
4. 武将仍然被升到 20 级，铜钱未扣除

**建议修复**：
```typescript
if (goldNeed > 0 && !this.levelDeps.spendResource(GOLD_TYPE, goldNeed)) return null;
if (expNeed > 0 && !this.levelDeps.spendResource(EXP_TYPE, expNeed)) return null;
this.syncToHeroSystem(heroSystem, generalId, final, 0);
```

---

### P0-02 | addExp 中 spendResource 失败但武将仍升级 + goldSpent 计数错误

**文件**：`engine/hero/HeroLevelSystem.ts:205-209`

**问题描述**：`addExp` 方法在循环中调用 `spendResource` 但不检查返回值。如果消耗失败：
1. `goldSpent` 仍然累加了未实际消耗的金额（报告错误的消耗量）
2. `curLv` 仍然递增（武将免费升级一级）

```typescript
// 第 205-209 行
this.levelDeps.spendResource(GOLD_TYPE, goldReq);  // 返回值被忽略
goldSpent += goldReq;                              // 即使消耗失败也累加
rem = acc - expReq;
curLv += 1;                                        // 即使消耗失败也升级
```

**建议修复**：
```typescript
if (!this.levelDeps.spendResource(GOLD_TYPE, goldReq)) {
  curExp = acc; rem = 0; break;  // 消耗失败，停止升级
}
goldSpent += goldReq;
rem = acc - expReq;
curLv += 1; curExp = 0; gained += 1;
```

---

### P0-03 | ResourceSystem.setResource 无负数防护（存档篡改可注入负值）

**文件**：`engine/resource/ResourceSystem.ts:179-181`

**问题描述**：`setResource` 方法用于加载存档，但没有对负值做防护。如果存档数据被篡改（或序列化/反序列化过程中出现错误），资源值可能变为负数，导致后续所有资源检查逻辑异常。

```typescript
setResource(type: ResourceType, amount: number): void {
  const cap = this.caps[type];
  this.resources[type] = cap !== null ? Math.min(amount, cap) : amount;
  // amount 为负数时直接赋值，无 Math.max(0, amount) 保护
}
```

**对比**：`CurrencySystem.setCurrency` 已正确处理：`Math.max(0, amount)`

**建议修复**：
```typescript
setResource(type: ResourceType, amount: number): void {
  const cap = this.caps[type];
  const safe = Math.max(0, amount);
  this.resources[type] = cap !== null ? Math.min(safe, cap) : safe;
}
```

---

### P0-04 | ResourceSystem.deserialize 无负数/NaN 防护

**文件**：`engine/resource/ResourceSystem.ts:363-377`

**问题描述**：`deserialize` 直接使用 `cloneResources(data.resources)` 恢复数据，没有对每个字段做 NaN、负数、undefined 防护。如果存档数据损坏，可能导致所有资源变为 NaN，使游戏完全崩溃。

```typescript
deserialize(data: ResourceSaveData): void {
  this.resources = cloneResources(data.resources);  // 无校验
  this.productionRates = { ...data.productionRates }; // 无校验
  this.caps = { ...data.caps };
  this.lastSaveTime = data.lastSaveTime;
  this.enforceCaps();
}
```

**建议修复**：在 `deserialize` 中增加数据校验：
```typescript
for (const type of RESOURCE_TYPES) {
  if (!isFinite(this.resources[type])) this.resources[type] = 0;
  if (this.resources[type] < 0) this.resources[type] = 0;
}
```

---

### P0-05 | tick() 无负数 dtSec 防护（系统时钟回拨可导致负产出）

**文件**：`engine/ThreeKingdomsEngine.ts:155-157`

**问题描述**：`tick()` 方法计算 `dt = deltaMs ?? (now - this.lastTickTime)`。如果系统时钟被回拨（如 NTP 校正、手动改时间），`now - this.lastTickTime` 可能为负数，导致 `dtSec` 为负，进而导致资源**倒扣**（addResource 收到负值会返回 0，但 autoSaveAccumulator 和 onlineSeconds 会变为负数）。

```typescript
tick(deltaMs?: number): void {
  const now = Date.now();
  const dt = deltaMs ?? (now - this.lastTickTime);  // 可能为负
  this.lastTickTime = now;
  const dtSec = dt / 1000;  // 可能为负
  // ...
  this.autoSaveAccumulator += dtSec;  // 累加负值
  this.onlineSeconds += dtSec;        // 累加负值
}
```

**建议修复**：
```typescript
const dt = Math.max(0, deltaMs ?? (now - this.lastTickTime));
```

---

## 🟡 P1（建议修复）：边界条件/性能问题

### P1-01 | 招募系统极端情况返回 null as unknown as GeneralData

**文件**：`engine/hero/HeroRecruitSystem.ts:366-371`

**问题描述**：当所有品质池中都没有武将定义时（极端情况），`executeSinglePull` 返回 `{ general: null as unknown as GeneralData, ... }`。资源已扣除，但返回了一个 `null` 伪装的 GeneralData。任何访问 `result.general.id` 的代码都会崩溃。

虽然当前有 14 个武将定义覆盖所有品质，但这是一个类型安全的隐患。

**建议修复**：返回一个特殊的"空武将"对象，或在 `executeRecruit` 中过滤无效结果并补偿资源。

---

### P1-02 | 建筑取消升级返还资源基于当前等级查表（非升级时快照）

**文件**：`engine/building/BuildingSystem.ts:254-268`

**问题描述**：`cancelUpgrade` 调用 `getUpgradeCost(type)` 获取费用，该方法基于 `state.level` 查表。虽然升级中 `state.level` 未变（仍是升级前的等级），所以当前逻辑是正确的。但这是一个脆弱的设计——如果未来有人在 `startUpgrade` 中提前递增 level，取消返还金额就会错误。

**建议优化**：在 `startUpgrade` 时将实际消耗的 cost 存入 QueueSlot，`cancelUpgrade` 时从队列中读取原始 cost。

---

### P1-03 | BuildingSystem.batchUpgrade 不消耗资源（纯规划方法，易被误用）

**文件**：`engine/building/BuildingSystem.ts:542-580`

**问题描述**：`batchUpgrade` 方法内部跟踪了 `remainingGrain/Gold/Troops`，调用了 `startUpgrade`（不消耗资源），但**没有调用 ResourceSystem 消耗资源**。方法签名暗示它会执行升级，但实际上只修改了建筑状态。

如果 UI 直接调用此方法，建筑会升级但资源不会被扣除。

**建议修复**：在方法文档中明确标注"此方法不消耗资源，调用者需自行处理资源扣除"，或将资源消耗逻辑集成到此方法中。

---

### P1-04 | 离线收益浮点精度累积（save/load 后数值微小漂移）

**文件**：`engine/resource/OfflineEarningsCalculator.ts:55-59` + `engine/resource/ResourceSystem.ts:127-130`

**问题描述**：离线收益计算和每帧资源产出都使用浮点数运算（`rate * deltaSec * multiplier`），不做取整。经过长时间运行或多次 save/load，资源值会出现浮点精度漂移（如 `1000.0000000000001`）。虽然 JSON 序列化可以保持精度，但显示给玩家时可能出现异常。

**建议修复**：在 `addResource` 中对结果取 2 位小数：
```typescript
this.resources[type] = Math.round(after * 100) / 100;
```

---

### P1-05 | 自动存档频率（30秒）可能过于频繁

**文件**：`shared/constants.ts:15` + `engine/ThreeKingdomsEngine.ts:163`

**问题描述**：`AUTO_SAVE_INTERVAL_SECONDS = 30`，即每 30 秒自动存档一次。每次存档涉及 `JSON.stringify` + `localStorage.setItem`，对于大型存档（含武将、建筑、科技等数据），频繁写入可能影响性能，尤其在移动端。

**建议优化**：改为 60 秒，或在资源/建筑状态变化时才触发存档（脏标记机制）。

---

### P1-06 | executeSinglePull 中 heroSystem.getGeneral(generalId)! 非空断言

**文件**：`engine/hero/HeroRecruitSystem.ts:389`

**问题描述**：`executeSinglePull` 在 `addGeneral` 之后使用 `heroSystem.getGeneral(generalId)!` 非空断言。如果 `addGeneral` 因任何原因失败（返回 null），后续代码会崩溃。虽然当前逻辑保证不会发生，但非空断言是运行时隐患。

**建议修复**：
```typescript
const added = heroSystem.addGeneral(generalId);
const general = heroSystem.getGeneral(generalId);
if (!general) { /* 降级处理 */ }
```

---

### P1-07 | EventBus once handler 全局删除（不同 listener 可能冲突）

**文件**：`core/events/EventBus.ts:89-92`

**问题描述**：`once` handler 触发后使用 `this.onceHandlers.delete(event)` 删除**整个事件的所有 once handler**，而不是只删除已触发的那个。如果同一事件注册了多个 `once` handler，只有第一个被触发时所有 handler 都会被删除。

```typescript
const onceSet = this.onceHandlers.get(event);
if (onceSet) {
  this.invokeSet(onceSet, p);
  this.onceHandlers.delete(event);  // 删除所有 once handler！
}
```

**建议修复**：改为逐个删除已触发的 handler：
```typescript
for (const handler of onceSet) {
  try { handler(p); } catch (err) { console.error(err); }
}
onceSet.clear();  // 清空 set 而不是删除 map entry
```
注意：当前实现是**先调用全部再删除**，行为等价于"所有 once handler 只触发一次"。但如果只期望删除被调用的那个，需要修改。

---

### P1-08 | 无 MAX_SAFE_INTEGER 溢出防护

**文件**：`engine/resource/ResourceSystem.ts` 全局

**问题描述**：资源值（grain、gold、troops、mandate）使用 JavaScript `number` 类型存储，理论上最大值为 `Number.MAX_SAFE_INTEGER (2^53 - 1)`。在极端长时间运行（如挂机数月）后，资源产出可能导致数值溢出，出现精度丢失。

**建议修复**：在 `addResource` 中增加上限保护：
```typescript
const MAX_RESOURCE = Number.MAX_SAFE_INTEGER;
this.resources[type] = Math.min(after, MAX_RESOURCE);
```

---

## 🟢 P2（优化建议）：代码质量/可维护性

### P2-01 | ResourceSystem 与 OfflineEarningsCalculator 存在重复的离线收益计算逻辑

**文件**：`engine/resource/resource-calculator.ts:169-198` vs `engine/resource/OfflineEarningsCalculator.ts:34-68`

**问题描述**：`resource-calculator.ts` 和 `OfflineEarningsCalculator.ts` 中存在完全相同的 `calculateOfflineEarnings` 函数实现。`ResourceSystem` 使用 `OfflineEarningsCalculator` 的版本，但 `resource-calculator.ts` 中的版本仍然存在，增加了维护成本。

**建议修复**：删除 `resource-calculator.ts` 中的重复实现，统一使用 `OfflineEarningsCalculator`。

---

### P2-02 | HeroLevelSystem.addExp 的 expSpent 计算逻辑不直观

**文件**：`engine/hero/HeroLevelSystem.ts:221`

**问题描述**：
```typescript
expSpent: amount - Math.max(0, curExp - general.exp),
```
这行代码计算实际消耗的经验值，逻辑不直观。当 `gained === 0` 且 `curExp > general.exp` 时，`expSpent = amount - (curExp - general.exp)`；当没有升级时 `expSpent = amount`。建议使用更清晰的变量名和注释。

---

### P2-03 | HeroRecruitSystem.getRecruitHistory 返回副本但未深拷贝 results

**文件**：`engine/hero/HeroRecruitSystem.ts:237-239`

**问题描述**：
```typescript
getRecruitHistory(): Readonly<RecruitHistoryEntry[]> {
  return [...this.history].reverse();
}
```
返回的是浅拷贝 + 反转的数组，但数组中的 `RecruitHistoryEntry` 对象（含 `results: RecruitResult[]`）仍然是引用。外部代码可以修改历史记录中的数据。

**建议修复**：深拷贝历史记录或使用 `Object.freeze`。

---

### P2-04 | BuildingSystem.checkUpgrade 中资源检查与 executeBuildingUpgrade 重复

**文件**：`engine/engine-building-ops.ts:44-60` + `engine/building/BuildingSystem.ts:133-189`

**问题描述**：`executeBuildingUpgrade` 调用了 `checkUpgrade`（含资源检查），然后又调用 `consumeBatch`（内部也有 `canAfford` 检查）。资源被检查了两次。虽然不影响正确性，但增加了不必要的计算。

**建议优化**：`executeBuildingUpgrade` 中跳过资源检查，直接调用 `consumeBatch`（它已有原子性检查）。

---

### P2-05 | SaveManager.startAutoSave 未被引擎使用（存在两套自动保存机制）

**文件**：`core/save/SaveManager.ts:193-210` vs `engine/ThreeKingdomsEngine.ts:161-165`

**问题描述**：`SaveManager` 提供了 `startAutoSave/stopAutoSave`（基于 `setInterval`），但 `ThreeKingdomsEngine` 使用了自己的 `autoSaveAccumulator`（基于 tick 累加）来实现自动保存。两套机制并存，可能导致混淆。

**建议优化**：统一为一套机制，推荐使用引擎层的 tick-based 方案（更精确控制）。

---

### P2-06 | engine-save.ts 中 applySaveData 缺少 tech 子系统的 null check

**文件**：`engine/engine-save.ts:195-210`

**问题描述**：`applySaveData` 中对 `data.tech` 做了存在性检查后才反序列化，但内部直接访问 `data.tech.completedTechIds` 等字段时，如果 `data.tech` 存在但字段缺失，可能导致 undefined 传入 deserialize。

```typescript
if (data.tech) {
  ctx.techTree.deserialize({
    completedTechIds: data.tech.completedTechIds,        // 可能为 undefined
    chosenMutexNodes: data.tech.chosenMutexNodes,        // 可能为 undefined
  });
```

**建议修复**：增加默认值：
```typescript
completedTechIds: data.tech.completedTechIds ?? [],
chosenMutexNodes: data.tech.chosenMutexNodes ?? [],
```

---

## 📊 审计汇总

| 严重程度 | 数量 | 关键问题 |
|---------|------|---------|
| 🔴 P0 | 5 | 武将免费升级漏洞(×2)、资源负值、存档数据损坏、时钟回拨 |
| 🟡 P1 | 8 | null 安全、浮点精度、存档频率、溢出防护 |
| 🟢 P2 | 6 | 代码重复、设计不一致 |
| **合计** | **19** | |

### 修复优先级建议

1. **立即修复**：P0-01、P0-02（武将免费升级漏洞，可被玩家利用）
2. **尽快修复**：P0-03、P0-04（数据完整性防护）
3. **版本迭代中修复**：P0-05、P1 系列
4. **持续优化**：P2 系列
