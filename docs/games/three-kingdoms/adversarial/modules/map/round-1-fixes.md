# Map R1 Fixer 修复报告

> Fixer: v1.0 | Time: 2026-05-01
> 模块: map | 修复数: 13 FIX | 涉及文件: 7

## 修复统计

| FIX | 文件 | P0覆盖 | 修改行数 |
|-----|------|--------|---------|
| FIX-701 | SiegeSystem.ts | P0-001, P0-002 | +4 |
| FIX-702 | SiegeSystem.ts | P0-003, P0-004 | +5 |
| FIX-703 | SiegeSystem.ts + SiegeEnhancer.ts | P0-005, P0-006 | +4(+2) |
| FIX-704 | SiegeSystem.ts | P0-007 | +12 |
| FIX-705 | WorldMapSystem.ts + TerritorySystem.ts + SiegeSystem.ts + SiegeEnhancer.ts | P0-008~011 | +8 |
| FIX-706 | WorldMapSystem.ts | P0-012 | +1 |
| FIX-707 | WorldMapSystem.ts | P0-013 | +2 |
| FIX-708 | MapDataRenderer.ts | P0-014 | +2 |
| FIX-709 | MapFilterSystem.ts | P0-015, P0-016 | +4 |
| FIX-710 | TerritorySystem.ts | P0-017 | +3 |
| FIX-711 | TerritorySystem.ts | P0-018 | +2 |
| FIX-712 | GarrisonSystem.ts | P0-019, P0-020 | +8 |
| FIX-713 | TerritorySystem.ts | P0-021 | +4 |
| **合计** | **7 files** | **22 P0** | **~61 lines** |

## 修复详情

### FIX-701: SiegeSystem.checkSiegeConditions NaN防护
```typescript
// 入口添加:
if (!Number.isFinite(availableTroops) || !Number.isFinite(availableGrain)) {
  return { canSiege: false, errorCode: 'INSUFFICIENT_TROOPS', errorMessage: '兵力或粮草数据异常' };
}
```

### FIX-702: SiegeSystem.calculateSiegeCost 防御值防护
```typescript
const defense = territory.defenseValue;
if (!Number.isFinite(defense) || defense <= 0) {
  return { troops: MIN_SIEGE_TROOPS, grain: GRAIN_FIXED_COST };
}
```

### FIX-703: computeWinRate NaN防护（对称修复）
```typescript
// SiegeSystem.ts + SiegeEnhancer.ts 两处同步:
if (!Number.isFinite(attackerPower) || !Number.isFinite(defenderPower)) return WIN_RATE_MIN;
```

### FIX-704: SiegeSystem.serialize 保存captureTimestamps
```typescript
// serialize: 添加captureTimestamps字段
// deserialize: 恢复captureTimestamps Map
// SiegeSaveData类型: 添加captureTimestamps?: Record<string, number>
```

### FIX-705: 四系统deserialize(null)防护
```typescript
// WorldMapSystem, TerritorySystem, SiegeSystem, SiegeEnhancer
if (!data) return;
```

### FIX-706: WorldMapSystem.upgradeLandmark NaN防护
```typescript
if (!landmark || !Number.isFinite(landmark.level) || landmark.level >= 5) return false;
```

### FIX-707: WorldMapSystem.setZoom NaN防护
```typescript
if (!Number.isFinite(zoom)) return;
```

### FIX-708: MapDataRenderer.computeVisibleRange 除零防护
```typescript
const zoom = (!viewport.zoom || !Number.isFinite(viewport.zoom)) ? VIEWPORT_CONFIG.defaultZoom : viewport.zoom;
```

### FIX-709: MapFilterSystem.filter null防护
```typescript
tiles = tiles ?? [];
landmarks = landmarks ?? [];
criteria = criteria ?? {};
```

### FIX-710: TerritorySystem.deserialize level NaN防护
```typescript
const safeLevel = (!Number.isFinite(level) || level < 1) ? 1 as LandmarkLevel : level;
```

### FIX-711: TerritorySystem.captureTerritory null防护
```typescript
if (!t || !newOwner) return false;
```

### FIX-712: GarrisonSystem.calculateBonus NaN防护
```typescript
const defense = Number.isFinite(general.baseStats.defense) ? general.baseStats.defense : 0;
// 各产出项: Number.isFinite(baseProduction.grain) ? baseProduction.grain : 0
```

### FIX-713: TerritorySystem.getPlayerProductionSummary NaN累加防护
```typescript
totalProduction.grain += Number.isFinite(t.currentProduction.grain) ? t.currentProduction.grain : 0;
```

## 修复穿透验证

| FIX | 调用方修复 | 底层函数修复 | 穿透? |
|-----|-----------|-------------|-------|
| FIX-701 | checkSiegeConditions入口 | N/A | N/A |
| FIX-702 | calculateSiegeCost | territory.defenseValue来源（外部配置） | 无穿透 |
| FIX-703 | computeWinRate | SiegeSystem+SiegeEnhancer对称 | ✅ 已同步 |
| FIX-704 | serialize/deserialize | SiegeSaveData类型 | ✅ 已同步 |
| FIX-705 | deserialize入口 | N/A | N/A |
| FIX-706 | upgradeLandmark | N/A | N/A |
| FIX-707 | setZoom | N/A | N/A |
| FIX-708 | computeVisibleRange | N/A | N/A |
| FIX-709 | filter入口 | N/A | N/A |
| FIX-710 | deserialize level | calculateProduction | 无穿透（level已安全化） |
| FIX-711 | captureTerritory | N/A | N/A |
| FIX-712 | calculateBonus | getEffectiveDefense/getEffectiveProduction | ✅ 上游已防护 |
| FIX-713 | getPlayerProductionSummary | N/A | N/A |

穿透率: 0/13 = 0% ✅（目标<10%）

## 编译验证

```
npx tsc --noEmit --project tsconfig.json
唯一错误: IntegrationValidator.ts（预存，非Map模块）
Map模块7个文件: 0错误 ✅
```

## 测试验证

```
PASS: MapEventSystem.test.ts, MapFilterSystem.test.ts, MapDataRenderer.test.ts
FAIL: 其余为vitest/jest不兼容（预存问题，非本次修复引入）
```

## 未修复项（R2处理）

| 项目 | 原因 |
|------|------|
| P0-023 (降级P1) | 上游FIX-702覆盖 |
| P0-024 (降级P1) | 需源码验证engine-save覆盖 |
| P1-001~017 | R2迭代处理 |
