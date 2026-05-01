# Bond R1 — Fix Report

> Fixer Agent | 2026-05-01 | BondSystem (engine/bond/BondSystem.ts)

## 修复摘要

| FIX ID | P0 Ref | 描述 | 文件 | 状态 |
|--------|--------|------|------|------|
| FIX-B01 | P0-001 | addFavorability NaN/Infinity/负数防护 | bond/BondSystem.ts | ✅ |
| FIX-B02 | P0-002 | addFavorability 上限保护 MAX_FAVORABILITY=99999 | bond/BondSystem.ts | ✅ |
| FIX-B03 | P0-003 | loadSaveData null/undefined输入防护+数据校验 | bond/BondSystem.ts | ✅ |
| FIX-B04 | P0-004 | BondSystem接入引擎存档系统（六处同步） | 多文件 | ✅ |
| FIX-B05 | P0-005 | triggerStoryEvent 前置条件校验（好感度） | bond/BondSystem.ts | ✅ |
| FIX-B06 | P0-006 | triggerStoryEvent deps初始化检查 | bond/BondSystem.ts | ✅ |
| FIX-B07 | P0-007 | getAvailableStoryEvents null防护 | bond/BondSystem.ts | ✅ |
| FIX-B08 | P0-008 | getFactionDistribution faction有效性检查 | bond/BondSystem.ts | ✅ |

## 修复详情

### FIX-B01: addFavorability NaN/Infinity/负数防护
```ts
// Before:
addFavorability(heroId: string, amount: number): void {
  const fav = this.favorabilities.get(heroId) ?? { heroId, value: 0, triggeredEvents: [] };
  fav.value += amount;
  this.favorabilities.set(heroId, fav);
}

// After:
addFavorability(heroId: string, amount: number): void {
  if (!heroId || !Number.isFinite(amount) || amount <= 0) return;
  const fav = this.favorabilities.get(heroId) ?? { heroId, value: 0, triggeredEvents: [] };
  fav.value = Math.min(fav.value + amount, MAX_FAVORABILITY);
  this.favorabilities.set(heroId, fav);
}
```
- 防护: NaN, Infinity, -Infinity, 负数, 空字符串heroId
- 规则: BR-001, BR-017, BR-019

### FIX-B02: addFavorability 上限保护
```ts
const MAX_FAVORABILITY = 99999;
fav.value = Math.min(fav.value + amount, MAX_FAVORABILITY);
```
- 防止Infinity序列化为null
- 规则: BR-022

### FIX-B03: loadSaveData null/undefined防护
```ts
loadSaveData(data: BondSaveData): void {
  if (!data) return;
  // ...
  for (const [key, value] of Object.entries(data.favorabilities ?? {})) {
    if (key && value && Number.isFinite(value.value)) {
      this.favorabilities.set(key, value);
    }
  }
  for (const eventId of data.completedStoryEvents ?? []) {
    if (eventId) this.completedStoryEvents.add(eventId);
  }
}
```
- 防护: null输入, undefined字段, NaN值过滤
- 规则: BR-010

### FIX-B04: BondSystem接入引擎存档系统
六处同步修改：

| # | 位置 | 修改 |
|---|------|------|
| 1 | `shared/types.ts` GameSaveData | +bond?: BondSaveData |
| 2 | `engine-save.ts` SaveContext | +bond?: BondSystem |
| 3 | `engine-save.ts` buildSaveData() | +bond: ctx.bond?.serialize() |
| 4 | `engine-save.ts` applySaveData() | +ctx.bond.loadSaveData(data.bond) |
| 5 | `ThreeKingdomsEngine.ts` buildSaveCtx() | +bond: this.bondSystem |
| 6 | (已存在) ThreeKingdomsEngine.ts | bondSystem已注册、init、reset |

- 规则: BR-014, BR-015

### FIX-B05: triggerStoryEvent 前置条件校验
```ts
// 新增好感度前置条件检查
for (const heroId of event.condition.heroIds) {
  const fav = this.getFavorability(heroId);
  if (!Number.isFinite(fav.value) || fav.value < event.condition.minFavorability) {
    return { success: false, reason: `武将${heroId}好感度不足` };
  }
}
```
- 防止绕过好感度直接触发事件获取奖励
- 规则: BR-020

### FIX-B06: triggerStoryEvent deps初始化检查
```ts
if (!this.deps) return { success: false, reason: '系统未初始化' };
```
- 防止deps未初始化时eventBus.emit崩溃
- 规则: BR-006

### FIX-B07: getAvailableStoryEvents null防护
```ts
if (!heroes) return [];
```

### FIX-B08: getFactionDistribution faction有效性检查
```ts
if (hero && hero.faction && hero.faction in dist) {
  dist[hero.faction]++;
}
```

## 穿透验证

| 修复 | 穿透检查 | 结果 |
|------|---------|------|
| FIX-B01 (addFavorability NaN) | triggerStoryEvent调用addFavorability | ✅ rewards.favorability来自配置常量，安全 |
| FIX-B01 (addFavorability NaN) | getAvailableStoryEvents读取fav.value | ✅ 现在fav.value不会为NaN |
| FIX-B03 (loadSaveData) | applySaveData调用loadSaveData | ✅ data.bond可能为undefined，已有if检查 |
| FIX-B05 (前置条件) | getAvailableStoryEvents相同逻辑 | ✅ getAvailableStoryEvents已有完整条件检查 |

## 改动统计

| 文件 | 改动 |
|------|------|
| engine/bond/BondSystem.ts | +15行（防护代码） |
| engine/engine-save.ts | +12行（SaveContext+buildSaveData+applySaveData） |
| engine/ThreeKingdomsEngine.ts | +2行（buildSaveCtx） |
| shared/types.ts | +3行（GameSaveData） |
| **总计** | **+32行** |
