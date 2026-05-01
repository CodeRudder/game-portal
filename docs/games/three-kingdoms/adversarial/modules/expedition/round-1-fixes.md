# Expedition R1 修复报告

> Fixer Agent | 2026-05-01

## 修复总览

| FIX ID | P0 | 修复文件 | 修复方式 |
|--------|------|---------|---------|
| FIX-601 | P0-1 | engine-save.ts, shared/types.ts | 六处同步：添加 expedition 到保存/加载流程 |
| FIX-602 | P0-2 | ExpeditionSystem.ts:320 | completeRoute 添加 NaN/Infinity/范围校验 |
| FIX-603 | P0-3 | ExpeditionSystem.ts:407 | recoverTroops 添加 NaN/负值校验 |
| FIX-604 | P1-1 | ExpeditionSystem.ts:83 | updateSlots 添加 NaN 校验 |
| FIX-605 | P1-2 | ExpeditionSystem.ts:314 | processNodeEffect healPercent NaN 防护 |

## FIX-601: 保存/加载流程断裂（P0-CRITICAL）

### 修复内容

**六处同步修改：**

1. **GameSaveData** (shared/types.ts:293)
   - 添加 `expedition?: import('../core/expedition/expedition.types').ExpeditionSaveData`

2. **SaveContext** (engine-save.ts:131)
   - 添加 `readonly expedition?: import('./expedition/ExpeditionSystem').ExpeditionSystem`

3. **buildSaveData()** (engine-save.ts:200)
   - 添加 `expedition: ctx.expedition?.serialize()`

4. **toIGameState()** (engine-save.ts:253)
   - 添加 `if (data.expedition) subsystems.expedition = data.expedition`

5. **fromIGameState()** (engine-save.ts:303)
   - 添加 `expedition: s.expedition as ... | undefined`

6. **applySaveData()** (engine-save.ts:598)
   - 添加 `if (data.expedition && ctx.expedition) { ctx.expedition.deserialize(data.expedition); }`
   - 添加向后兼容日志

### 验证

```typescript
// 保存前
sys.completeRoute('team1', 3);
const saveData = buildSaveData(ctx);
expect(saveData.expedition).toBeDefined();
expect(saveData.expedition.clearedRouteIds).toContain('route_hulao_easy');

// 加载后
applySaveData(ctx2, saveData);
expect(ctx2.expedition.getState().clearedRouteIds.has('route_hulao_easy')).toBe(true);
```

## FIX-602: completeRoute NaN/Infinity（P0）

### 修复内容

**ExpeditionSystem.ts:320** — 添加参数校验：
```typescript
completeRoute(teamId: string, stars: number): boolean {
    if (!Number.isFinite(stars) || stars < 0 || stars > 3) return false;
    // ... 原有逻辑
}
```

### 防护范围

| 输入 | 修复前 | 修复后 |
|------|--------|--------|
| `stars = 3` | ✅ 正常 | ✅ 正常 |
| `stars = 0` | ✅ 正常 | ✅ 正常 |
| `stars = NaN` | ⚠️ 不写入但无报错 | ✅ 返回 false |
| `stars = Infinity` | ❌ 写入Infinity | ✅ 返回 false |
| `stars = -1` | ✅ 不写入 | ✅ 返回 false |
| `stars = 4` | ❌ 写入4星 | ✅ 返回 false |

## FIX-603: recoverTroops NaN传播（P0）

### 修复内容

**ExpeditionSystem.ts:407** — 添加参数校验：
```typescript
recoverTroops(elapsedSeconds: number): void {
    if (!Number.isFinite(elapsedSeconds) || elapsedSeconds <= 0) return;
    // ... 原有逻辑
}
```

### 防护范围

| 输入 | 修复前 | 修复后 |
|------|--------|--------|
| `elapsedSeconds = 300` | ✅ 正常恢复 | ✅ 正常恢复 |
| `elapsedSeconds = 0` | ✅ 恢复0 | ✅ 跳过（优化） |
| `elapsedSeconds = NaN` | ❌ 所有队伍兵力变NaN | ✅ 跳过 |
| `elapsedSeconds = -100` | ⚠️ 恢复负数 | ✅ 跳过 |

## FIX-604: updateSlots NaN（P1）

### 修复内容

**ExpeditionSystem.ts:83** — 添加参数校验：
```typescript
updateSlots(castleLevel: number): number {
    if (!Number.isFinite(castleLevel) || castleLevel < 0) return this.state.unlockedSlots;
    // ... 原有逻辑
}
```

## FIX-605: processNodeEffect healPercent NaN（P1）

### 修复内容

**ExpeditionSystem.ts:314** — 添加 NaN 防护：
```typescript
const healPercent = node.healPercent ?? 0.20;
const safeHealPercent = Number.isFinite(healPercent) && healPercent > 0 ? healPercent : 0;
const healAmount = Math.round(team.maxTroops * safeHealPercent);
```

## 编译验证

```
$ npx tsc --noEmit
# 无错误
```

## 测试验证

```
$ npx vitest run ExpeditionSystem-adversarial
Tests: 3 failed | 71 passed (74 total)
# 3个失败为预存问题（dispatchTeam未检查isExpeditioning）
# 我的修复使recoverTroops(-300)测试通过（从4个失败降到3个）
```

## 修改统计

| 文件 | 新增行 | 修改行 |
|------|--------|--------|
| engine-save.ts | +15 | 0 |
| ExpeditionSystem.ts | +5 | 1 |
| shared/types.ts | +2 | 0 |
| **总计** | **+22** | **1** |
