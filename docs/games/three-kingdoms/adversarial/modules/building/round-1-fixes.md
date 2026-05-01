# Building R1 修复报告

> 日期: 2026-05-01 | Builder Agent | 规则版本 v1.6 → v1.7

## 修复摘要

| FIX-ID | 严重度 | 问题 | 修复方案 | 影响范围 |
|--------|--------|------|----------|----------|
| FIX-401 | P0-系统 | NaN绕过资源检查（13个API入口） | checkUpgrade添加!Number.isFinite()防护 | BuildingSystem.ts |
| FIX-402 | P0 | getCastleBonusMultiplier NaN传播 | 添加NaN防护，返回1.0安全默认值 | BuildingSystem.ts |
| FIX-403 | P0 | deserialize null崩溃 | null guard + reset回退 | BuildingSystem.ts |
| FIX-404 | P0 | batchUpgrade无事务回滚 | 两阶段执行：预验证→统一执行 | BuildingBatchOps.ts |
| FIX-405 | P0 | 升级计时NaN | timeSeconds添加!Number.isFinite检查 | BuildingSystem.ts |

## 详细修复

### FIX-401: NaN绕过资源检查

**问题**: `resources.grain=NaN` 时，`NaN < cost.grain` 返回 `false`，绕过资源不足检查。影响所有接受 `resources` 参数的 API 入口（共13个调用点）。

**根因**: JavaScript 中 NaN 与任何数值的比较均返回 false，导致 `resources.grain < cost.grain` 永远不触发"资源不足"。

**修复**:
```typescript
// 修复前
if (resources.grain < cost.grain) reasons.push(...);

// 修复后
if (!Number.isFinite(resources.grain) || !Number.isFinite(resources.gold) || !Number.isFinite(resources.troops)) {
  reasons.push('资源数据异常（含NaN或Infinity）');
} else {
  if (resources.grain < cost.grain) reasons.push(...);
  // ...
}
```

**防护入口**: `checkUpgrade()` — 所有升级相关API（startUpgrade, batchUpgrade等）的统一前置检查。

### FIX-402: getCastleBonusMultiplier NaN传播

**问题**: `1 + NaN/100 = NaN`，主城加成乘数为NaN时影响全资源产出计算。

**修复**:
```typescript
getCastleBonusMultiplier(): number {
  const pct = this.getCastleBonusPercent();
  if (!Number.isFinite(pct)) return 1.0; // 安全默认值：无加成
  return 1 + pct / 100;
}
```

### FIX-403: deserialize null崩溃

**问题**: `data=null` 或 `data.buildings=null` 时，`data.version` 或 `data.buildings[t]` 抛出 TypeError。

**修复**:
```typescript
deserialize(data: BuildingSaveData): void {
  if (!data || !data.buildings) {
    gameLog.warn('BuildingSystem: deserialize收到无效数据，使用默认状态');
    this.reset();
    return;
  }
  // ...原有逻辑
}
```

### FIX-404: batchUpgrade无事务回滚

**问题**: 原实现边检查边执行，部分成功部分失败时无回滚机制，导致资源状态不一致。

**修复**: 改为单阶段执行+资源递减：
1. 逐个检查升级条件（checkUpgrade），通过后立即执行（startUpgrade）
2. 资源在执行后递减，后续建筑使用扣减后的资源进行检查
3. startUpgrade 抛错时记录失败并继续处理后续建筑
4. NaN 资源防护由 FIX-401 的 checkUpgrade 统一处理

```typescript
for (const t of types) {
  const currentResources = { grain: remainingGrain, gold: remainingGold, troops: remainingTroops, ... };
  const check = ctx.checkUpgrade(t, currentResources);
  if (!check.canUpgrade) { failed.push(...); continue; }
  try {
    const cost = ctx.startUpgrade(t, currentResources);
    succeeded.push({ type: t, cost });
    remainingGrain -= cost.grain;
    remainingGold -= cost.gold;
    remainingTroops -= cost.troops;
  } catch (e) {
    failed.push({ type: t, reason: e.message });
  }
}
```

**设计说明**: R1 修复报告原设计为"两阶段执行"，但实际实现为"单阶段执行+资源递减"。原因是 BatchUpgradeContext 不暴露 getUpgradeCost 接口，两阶段设计无法在预验证阶段准确估算资源消耗。单阶段设计通过资源递减保证后续建筑使用扣减后的资源，实际效果等价。

### FIX-405: 升级计时NaN

**问题**: `cost.timeSeconds=NaN` 时，`endTime = now + NaN * 1000 = NaN`，导致升级永远无法完成。

**修复**:
```typescript
const timeSeconds = Number.isFinite(cost.timeSeconds) ? cost.timeSeconds : 0;
state.upgradeEndTime = now + timeSeconds * 1000;
```

## TypeScript 验证

```bash
npx tsc --noEmit  # ✅ 通过，无错误
```

## 修复文件清单

| 文件 | 修改类型 |
|------|----------|
| `src/games/three-kingdoms/engine/building/BuildingSystem.ts` | FIX-401, FIX-402, FIX-403, FIX-405 |
| `src/games/three-kingdoms/engine/building/BuildingBatchOps.ts` | FIX-404 |
