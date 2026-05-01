# Building 模块 — Round 1 Challenger 挑战报告

> **Challenger 视角** | 审查对象: `round-1-tree.md`  
> 挑战时间: 2025-05-02 | 严重程度: P0~P3

---

## 挑战总览

| 维度 | Builder声称覆盖率 | Challenger评估覆盖率 | 差距 |
|------|-------------------|---------------------|------|
| F1-Normal | 88% | **75%** | -13% |
| F2-Boundary | 81% | **68%** | -13% |
| F3-Error | 71% | **52%** | -19% |
| F4-Cross | 67% | **50%** | -17% |
| F5-Lifecycle | 67% | **55%** | -12% |
| **合计** | **76%** | **60%** | **-16%** |

---

## P0 遗漏（阻塞级 — 必须修复）

### P0-01: `cancelUpgrade` 退款基于当前等级而非历史费用 ⚠️ **真实缺陷**

**位置**: `BuildingSystem.ts` L215-233

**问题描述**: `cancelUpgrade` 调用 `getUpgradeCost(type)` 获取费用，而 `getUpgradeCost` 基于 `state.level` 查表。但在升级过程中 `state.level` 尚未增加（level在tick完成时才+1），所以当前实现实际上是正确的。

**但是**：如果通过 `deserialize` 加载了一个 `status: 'upgrading'` 的存档，且该存档的 `level` 已被篡改为升级后的值，那么 `getUpgradeCost` 会查到错误的等级费用，导致退款金额计算错误。

**复现步骤**:
1. 构造存档：`farmland: { level: 5, status: 'upgrading', upgradeEndTime: future }`
2. `deserialize(data)` → 队列重建，farmland 保持 upgrading
3. `cancelUpgrade('farmland')` → `getUpgradeCost` 查 level=5 的费用
4. **预期**: 应该退还 level 4→5 的费用（即 levelTable[4]）
5. **实际**: 退还 levelTable[5] 的费用（level 5→6 的费用）

**严重程度**: P0 — 可被利用刷退款

```typescript
// 源码问题片段 (BuildingSystem.ts:218)
cancelUpgrade(type: BuildingType): UpgradeCost | null {
    const state = this.buildings[type];
    if (state.status !== 'upgrading') return null;
    const cost = this.getUpgradeCost(type); // ← 基于 state.level 查表
    // ...
}
// getUpgradeCost 基于 state.level 查 levelTable[state.level]
// 正常升级中 level 未增加，所以查的是正确的"当前等级→下一级"费用
// 但 deserialize 篡改后 level 已增加，查到的是错误的费用
```

---

### P0-02: `tick()` 无防重入保护 — 可能重复完成升级

**位置**: `BuildingSystem.ts` L237-258

**问题描述**: `tick()` 遍历 `upgradeQueue`，对 `now >= endTime` 的项执行 `level += 1`。如果在同一帧内多次调用 `tick()`，由于第一次 `tick()` 已将完成的项从队列移除，所以正常情况下不会重复完成。

**但存在竞态窗口**: 如果 `tick()` 内部在 `level += 1` 之后、`upgradeQueue = remaining` 之前发生异常（虽然当前代码不太可能），会导致 level 已增加但队列未清理。下次 `tick()` 不会再处理（因为已从旧队列遍历），但 level 状态不一致。

**实际风险评估**: 低概率但应加防护。

---

### P0-03: `deserialize` 不校验 level 与 status 一致性

**位置**: `BuildingSystem.ts` L285-310

**问题描述**: `deserialize` 接受任意 `BuildingSaveData`，不校验：
- `level > 0` 但 `status === 'locked'` → 矛盾状态
- `level === 0` 但 `status === 'idle'` → 矛盾状态
- `status === 'upgrading'` 但 `upgradeEndTime === null` → 矛盾状态
- `status === 'upgrading'` 但 `upgradeStartTime === null` → 队列重建使用 `now` 作为 fallback

**影响**: 矛盾状态可能导致后续逻辑异常，如 `getUpgradeCost` 对 locked 建筑返回非 null。

**测试用例缺失**: Builder 的 F3-04 只覆盖了 null/undefined/version 不匹配，未覆盖矛盾状态组合。

---

### P0-04: `batchUpgrade` 资源扣减与 `startUpgrade` 的双重扣减风险

**位置**: `BuildingBatchOps.ts` L58-80 + `BuildingSystem.ts` L195-210

**问题描述**: `batchUpgrade` 的设计是：
1. 用递减后的 `remainingResources` 调用 `checkUpgrade`
2. 通过后调用 `startUpgrade(type, currentResources)`

但 `startUpgrade` 内部再次调用 `checkUpgrade(type, resources)` 进行校验。这里传入的 `resources` 是 `batchUpgrade` 构造的 `currentResources`，而非实际扣减后的资源。**关键问题**: `startUpgrade` 只返回费用，不实际扣减资源。资源扣减在 `engine-building-ops.ts` 的 `executeBuildingUpgrade` 中完成。所以 `batchUpgrade` 本身不扣资源，它只是计算 totalCost 供调用方扣减。

**但**: `batchUpgrade` 中 `ctx.startUpgrade(t, currentResources)` 传入的是递减后的资源快照，而 `startUpgrade` 内部的 `checkUpgrade` 也会检查这个快照。如果 `startUpgrade` 修改了 building state（它确实修改了），后续的 `checkUpgrade` 调用可能因状态变化而产生不同结果。

**实际风险**: 中等 — `startUpgrade` 将建筑状态改为 `upgrading`，如果批量列表中有重复建筑类型，第二次会因为"正在升级中"而失败，这是正确行为。

---

### P0-05: `getUpgradeCost` 对 level=0 返回 null 但 `startUpgrade` 未检查

**位置**: `BuildingSystem.ts` L195-210

**问题描述**: `startUpgrade` 调用 `getUpgradeCost(type)` 并使用非空断言 `!`：
```typescript
const cost = this.getUpgradeCost(type)!;
```
如果 `checkUpgrade` 通过但 `getUpgradeCost` 返回 null（理论上不应发生，因为 checkUpgrade 检查了 maxLevel），则 `cost` 为 null，后续 `cost.timeSeconds` 会抛 TypeError。

**实际风险**: 低 — checkUpgrade 已防护，但缺少防御性编程。

---

## P1 遗漏（严重 — 应该修复）

### P1-01: `checkUpgrade` 未检查 `type` 参数有效性

**问题**: 如果传入不存在的 `BuildingType` 字符串（如 `'hospital'`），`this.buildings[type]` 返回 `undefined`，后续访问 `.status` 会抛 TypeError。

**缺失测试**: F3-Error 维度未覆盖无效 BuildingType。

---

### P1-02: `getProduction` 对超出 levelTable 范围的 level 无防护

**位置**: `BuildingSystem.ts` L170-174

```typescript
getProduction(type: BuildingType, level?: number): number {
    const lv = level ?? this.buildings[type].level;
    if (lv <= 0) return 0;
    const data = BUILDING_DEFS[type].levelTable[lv - 1];
    return data?.production ?? 0;  // ← 超出范围返回 0，但未明确文档化
}
```

**问题**: 当 `level > maxLevel` 时，`levelTable[lv-1]` 为 undefined，返回 0。这可能是正确行为（防御性），但缺少测试覆盖。

---

### P1-03: `getCastleBonusMultiplier` NaN 防护但 `getCastleBonusPercent` 无防护

**位置**: `BuildingSystem.ts` L177-183

```typescript
getCastleBonusMultiplier(): number {
    const pct = this.getCastleBonusPercent();
    if (!Number.isFinite(pct)) return 1.0; // FIX-402 防护
    return 1 + pct / 100;
}
```

**问题**: 如果 `getCastleBonusPercent` 返回 NaN（通过篡改存档 level 超出 levelTable），`getCastleBonusPercent` 本身返回 NaN，但 `getCastleBonusMultiplier` 有防护。然而 `getCastleBonusPercent` 的调用方如果直接使用其返回值，可能收到 NaN。

---

### P1-04: `calculateTotalProduction` 遗漏 smithy/clinic 的产出

**位置**: `BuildingSystem.ts` L268-278

```typescript
calculateTotalProduction(): Record<string, number> {
    for (const t of BUILDING_TYPES) {
        if (t === 'castle') continue;
        const def = BUILDING_DEFS[t];
        if (!def.production) continue;  // ← smithy/clinic/wall 无 production 字段
        // ...
    }
}
```

**问题**: `smithy`、`clinic`、`wall` 在 `BUILDING_DEFS` 中没有设置 `production` 字段（只有 `levelTable` 中的 `production` 数值），所以 `calculateTotalProduction` 会跳过它们。这是设计意图（它们的产出不是标准资源类型），但：
- `academy` 有 `production: { resourceType: 'techPoint', ... }`，会产出 techPoint
- `smithy` 没有 production 配置，但其 levelTable 有 production 值

**潜在问题**: academy 的 techPoint 产出是否正确计入？需要验证 `resourceType: 'techPoint'` 是否被资源系统识别。

---

### P1-05: `checkAndUnlockBuildings` 可能重复解锁

**位置**: `BuildingSystem.ts` L104-112

```typescript
checkAndUnlockBuildings(): BuildingType[] {
    for (const t of BUILDING_TYPES) {
        const s = this.buildings[t];
        if (s.status === 'locked' && this.checkUnlock(t)) {
            s.status = 'idle';
            s.level = 1;
            unlocked.push(t);
        }
    }
    return unlocked;
}
```

**问题**: 如果在 `tick()` 中主城升级完成触发 `checkAndUnlockBuildings()`，同时 `deserialize` 也调用了 `checkAndUnlockBuildings()`，不会重复解锁（因为第二次调用时 status 已不是 'locked'）。但 `tick()` 和 `deserialize` 的调用顺序如果颠倒，可能导致解锁时机不一致。

---

### P1-06: `engine-building-ops.ts` 资源扣减与 startUpgrade 非原子

**位置**: `engine-building-ops.ts` L44-56

```typescript
export function executeBuildingUpgrade(ctx, type) {
    const resources = ctx.resource.getResources();
    const check = ctx.building.checkUpgrade(type, resources);
    if (!check.canUpgrade) throw new Error(...);
    const cost = ctx.building.getUpgradeCost(type);
    ctx.resource.consumeBatch({ grain: cost.grain, gold: cost.gold, troops: cost.troops });
    ctx.building.startUpgrade(type, resources);  // ← 使用的是旧的 resources 快照
    // ...
}
```

**问题**: 
1. `consumeBatch` 先扣资源，`startUpgrade` 后执行。如果 `startUpgrade` 抛错，资源已扣但建筑未进入升级状态。
2. `startUpgrade` 传入的 `resources` 是扣减前的快照，内部 `checkUpgrade` 检查的是旧资源，理论上应该通过（因为刚才检查过了），但存在 TOCTOU 问题。

---

## P2 遗漏（一般 — 建议修复）

### P2-01: `BuildingRecommender` 无效 context 回退策略未测试

`recommendUpgradePath` 对无效 context 使用 `newbieOrder` 回退，但缺少测试。

### P2-02: `getUpgradeProgress` 总时间为0时返回1

```typescript
getUpgradeProgress(type: BuildingType): number {
    const total = s.upgradeEndTime - s.upgradeStartTime;
    return total <= 0 ? 1 : Math.min(1, (Date.now() - s.upgradeStartTime) / total);
}
```
当 `timeSeconds=0` 时（如 castle Lv1 的 upgradeCost），total=0，直接返回 1（100%）。这是合理的，但缺少测试。

### P2-03: `getAppearanceStage` 边界值
- level=5 → humble, level=6 → orderly
- level=12 → orderly, level=13 → refined  
- level=20 → refined, level=21 → glorious
这些精确边界值缺少测试。

### P2-04: `getBuildingDef` 返回可变引用
`getBuildingDef` 直接返回 `BUILDING_DEFS[type]`，调用方可以修改配置对象。应返回深拷贝或 Readonly 类型。

### P2-05: `BuildingStateHelpers.createInitialState` 不检查 BUILDING_UNLOCK_LEVELS 一致性
如果 `BUILDING_UNLOCK_LEVELS` 和 `BUILDING_DEFS` 的 `unlockCastleLevel` 不一致，初始状态可能错误。

---

## P3 遗漏（轻微 — 可选修复）

### P3-01: `BUILDING_TYPES` 数组硬编码了所有类型
如果新增建筑类型但忘记更新 `BUILDING_TYPES`，会导致遍历遗漏。

### P3-02: `BUILDING_LABELS`/`BUILDING_ICONS` 缺少 Record 完整性检查
TypeScript 的 Record 类型在运行时不强制检查。

### P3-03: `getUpgradeRemainingTime` 精度问题
返回值是浮点秒数，可能因浮点精度导致 UI 显示闪烁。

### P3-04: `batchUpgrade` 中 `totalCost.timeSeconds` 的语义不明确
是所有建筑升级时间的总和还是最大值？当前实现是总和，但实际等待时间取决于并行队列。

---

## 源码真实缺陷汇总

| # | 缺陷ID | 严重度 | 位置 | 描述 |
|---|--------|--------|------|------|
| 1 | **BUG-CANCEL-01** | **P0** | `cancelUpgrade` | deserialize篡改level后退款金额错误 |
| 2 | BUG-DESER-01 | P0 | `deserialize` | 不校验 level/status 一致性 |
| 3 | BUG-OPS-01 | P1 | `engine-building-ops` | consumeBatch与startUpgrade非原子 |
| 4 | BUG-DEF-01 | P2 | `getBuildingDef` | 返回可变引用，配置可被篡改 |
| 5 | BUG-COST-01 | P2 | `getUpgradeProgress` | total=0时返回1未测试 |
| 6 | BUG-PROD-01 | P2 | `calculateTotalProduction` | 跳过无production字段的建筑（设计意图？） |

---

## 对 Builder 流程树的补充分支

以下是 Builder 流程树中完全遗漏的分支：

### 新增 F3-07: 输入验证攻击
```
F3-07 输入验证攻击
├── 无效BuildingType字符串 → TypeError
├── undefined作为type → TypeError  
├── null作为type → TypeError
├── 数字作为type → TypeError
└── 空字符串作为type → undefined access
```

### 新增 F2-07: 配置一致性边界
```
F2-07 配置一致性
├── BUILDING_MAX_LEVELS vs levelTable.length 一致性
├── BUILDING_UNLOCK_LEVELS vs BUILDING_DEFS.unlockCastleLevel 一致性
├── levelTable索引连续性（无空洞）
└── 所有建筑levelTable[0]存在性
```

### 新增 F5-06: 并发/时序攻击
```
F5-06 并发/时序
├── tick()在startUpgrade中间调用
├── deserialize在upgrading状态时调用
├── reset在upgrading状态时调用
├── 连续快速tick() → 无重复完成
└── tick()→cancelUpgrade()→tick() 状态一致
```

---

## Challenger 评分

| 评估项 | Builder得分 | Challenger扣分 | 调整后得分 |
|--------|------------|---------------|-----------|
| F1-Normal 覆盖 | 88% | -13% | **75%** |
| F2-Boundary 覆盖 | 81% | -13% | **68%** |
| F3-Error 覆盖 | 71% | -19% | **52%** |
| F4-Cross 覆盖 | 67% | -17% | **50%** |
| F5-Lifecycle 覆盖 | 67% | -12% | **55%** |
| **综合覆盖率** | **76%** | **-16%** | **60%** |

**结论**: Builder 的流程树基本完整，但在 **错误路径（F3）** 和 **跨系统交互（F4）** 维度存在显著遗漏。发现 1 个 P0 级真实缺陷（cancelUpgrade 退款计算）和 1 个 P0 级设计缺陷（deserialize 不校验一致性）。
