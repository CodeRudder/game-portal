# Prestige R1 — 修复清单

> Fixer Agent 产出 | 2026-05-01
> 修复对象: round-1-verdict.md 确认的12个P0

---

## 修复总览

| FIX ID | P0 | 文件 | 状态 | 测试 |
|--------|-----|------|------|------|
| FIX-501 | P0-01 | PrestigeSystem.ts | ✅ | 341 passed |
| FIX-502 | P0-02/03 | PrestigeSystem.ts | ✅ | 341 passed |
| FIX-503 | P0-04 | prestige-config.ts | ✅ | 341 passed |
| FIX-504 | P0-05/06 | RebirthSystem.ts | ✅ | 341 passed |
| FIX-505 | P0-07/08/09 | PrestigeShopSystem.ts | ✅ | 341 passed |
| FIX-506 | P0-10 | PrestigeShopSystem.ts | ✅ | 341 passed |
| FIX-507 | P0-11 | RebirthSystem.helpers.ts | ✅ | 341 passed |
| FIX-508 | P0-12 | engine-save.ts + ThreeKingdomsEngine.ts | ✅ | 341 passed |

---

## FIX-501: addPrestigePoints NaN/负值/Infinity防护

**P0-01**: `addPrestigePoints` 接受NaN/负值/Infinity，导致声望值污染

**修复**:
```typescript
// PrestigeSystem.ts:addPrestigePoints 入口
if (!Number.isFinite(basePoints) || basePoints <= 0) return 0;
// dailyGained NaN防护
const safeDailyGained = Number.isFinite(dailyGained) ? dailyGained : 0;
```

**穿透验证**: 搜索所有调用方，确认无其他入口需要防护。

---

## FIX-502: PrestigeSystem.loadSaveData null/NaN防护

**P0-02/03**: `loadSaveData` 不验证data.prestige的null/NaN

**修复**:
```typescript
loadSaveData(data: PrestigeSaveData): void {
    if (!data || data.version !== PRESTIGE_SAVE_VERSION) return;
    if (!data.prestige) return; // null防护
    const loaded = { ...data.prestige };
    loaded.currentPoints = Number.isFinite(loaded.currentPoints) ? loaded.currentPoints : 0;
    loaded.totalPoints = Number.isFinite(loaded.totalPoints) ? loaded.totalPoints : 0;
    loaded.currentLevel = Number.isFinite(loaded.currentLevel) && loaded.currentLevel > 0
      ? Math.min(loaded.currentLevel, MAX_PRESTIGE_LEVEL) : 1;
    this.state = { ...createInitialState(), ...loaded };
}
```

---

## FIX-503: calcRebirthMultiplierFromConfig NaN防护

**P0-04**: `calcRebirthMultiplier(NaN)` 返回NaN，传播到全局乘数

**修复**:
```typescript
// prestige-config.ts:calcRebirthMultiplierFromConfig
if (!Number.isFinite(count) || count <= 0) return 1.0;
```

**穿透验证**: RebirthSystem.calcRebirthMultiplier调用此函数，入口已防护。

---

## FIX-504: RebirthSystem.loadSaveData null/NaN防护

**P0-05/06**: `loadSaveData` 不验证data.rebirth的null/NaN

**修复**:
```typescript
loadSaveData(data: { rebirth: RebirthState }): void {
    if (!data || !data.rebirth) return;
    const loaded = { ...data.rebirth };
    loaded.rebirthCount = Number.isFinite(loaded.rebirthCount) && loaded.rebirthCount >= 0 ? loaded.rebirthCount : 0;
    loaded.currentMultiplier = Number.isFinite(loaded.currentMultiplier) && loaded.currentMultiplier > 0 ? loaded.currentMultiplier : 1.0;
    loaded.accelerationDaysLeft = Number.isFinite(loaded.accelerationDaysLeft) && loaded.accelerationDaysLeft >= 0 ? loaded.accelerationDaysLeft : 0;
    loaded.rebirthRecords = Array.isArray(loaded.rebirthRecords) ? loaded.rebirthRecords : [];
    loaded.completedRebirthQuests = Array.isArray(loaded.completedRebirthQuests) ? loaded.completedRebirthQuests : [];
    loaded.rebirthQuestProgress = loaded.rebirthQuestProgress && typeof loaded.rebirthQuestProgress === 'object' ? loaded.rebirthQuestProgress : {};
    this.state = loaded;
}
```

---

## FIX-505: PrestigeShopSystem.buyGoods NaN/负值防护

**P0-07/08/09**: `buyGoods` 的quantity NaN/负值绕过声望检查

**修复**:
```typescript
buyGoods(goodsId: string, quantity: number = 1): {
    // FIX-505: quantity NaN/负值/非有限数防护
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return { success: false, reason: '购买数量无效' };
    }
    // FIX-505: prestigePoints NaN防护
    if (!Number.isFinite(this.prestigePoints)) {
      return { success: false, reason: '声望值数据异常' };
    }
    ...
}
```

---

## FIX-506: PrestigeShopSystem 存档集成

**P0-10**: PrestigeShopSystem无serialize/deserialize，购买记录丢失

**修复**: 添加 `getSaveData()` 和 `loadSaveData()` 方法
```typescript
getSaveData(): { shopPurchases: Record<string, number>; prestigePoints: number; prestigeLevel: number }
loadSaveData(data: { shopPurchases?: Record<string, number>; prestigePoints?: number; prestigeLevel?: number }): void
```

---

## FIX-507: calculateBuildTime NaN/零除防护

**P0-11**: `calculateBuildTime` 的baseTime/multiplier为NaN/0时返回异常值

**修复**:
```typescript
// RebirthSystem.helpers.ts:calculateBuildTime 入口
if (!Number.isFinite(baseTimeSeconds) || baseTimeSeconds <= 0) return baseTimeSeconds > 0 ? baseTimeSeconds : 1;
if (!Number.isFinite(buildingLevel) || buildingLevel < 0) buildingLevel = 0;
if (!Number.isFinite(multiplier) || multiplier <= 0) multiplier = 1.0;
if (!Number.isFinite(accelerationDaysLeft) || accelerationDaysLeft < 0) accelerationDaysLeft = 0;
```

---

## FIX-508: RebirthSystem + PrestigeShopSystem 存档接入

**P0-12**: engine-save未调用RebirthSystem.loadSaveData，转生状态丢失

**修复** (3个文件):

1. **engine-save.ts SaveContext**: 添加 `rebirth?` 和 `prestigeShop?` 字段
2. **engine-save.ts applySaveData**: 添加rebirth和prestigeShop加载逻辑
3. **ThreeKingdomsEngine.ts buildSaveCtx**: 添加 `prestige`, `rebirth`, `prestigeShop` 到保存上下文

```typescript
// engine-save.ts applySaveData
if (data.prestige?.rebirth && ctx.rebirth) {
    ctx.rebirth.loadSaveData({ rebirth: data.prestige.rebirth });
}
if (data.prestige?.prestige && ctx.prestigeShop) {
    ctx.prestigeShop.loadSaveData({
      shopPurchases: data.prestige.prestige.shopPurchases,
      prestigePoints: data.prestige.prestige.currentPoints,
      prestigeLevel: data.prestige.prestige.currentLevel,
    });
}
```

---

## 测试更新

以下测试用例因修复行为变化而更新（从"暴露缺陷"改为"验证修复"）：

| 文件 | 测试 | 变更 |
|------|------|------|
| PrestigeSystem.adversarial.test.ts | 负数声望值 | expect(-100)→expect(0) |
| PrestigeSystem.adversarial.test.ts | NaN声望值 | expect(NaN)→expect(0) |
| PrestigeSystem.adversarial.test.ts | Infinity声望值 | expect(Infinity)→expect(0) |
| PrestigeShopSystem.adversarial.test.ts | 购买数量为0 | expect(success=true)→expect(success=false) |
| RebirthSystem.helpers.adversarial.test.ts | baseTime=0 | expect(0)→expect(1) |

---

## 验证结果

```
TypeScript编译: ✅ 0 errors
测试套件: 9/9 passed
测试用例: 341 passed, 16 todo, 0 failed
```
