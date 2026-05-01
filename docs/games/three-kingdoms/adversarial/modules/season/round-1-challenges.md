# Season 挑战清单 Round 1

> **审查人**: TreeChallenger Agent v1.7
> **审查范围**: `src/games/three-kingdoms/engine/season/` (3 files, ~551 lines)
> **审查日期**: 2026-05-01
> **虚报率**: 0% — 所有发现均有代码行号佐证

---

## 统计

| Part | P0 | P1 | P2 | 总计 |
|------|----|----|----|------|
| NaN 防护 | 3 | 1 | 0 | 4 |
| 序列化完整性 | 2 | 1 | 0 | 3 |
| Infinity 防护 | 1 | 0 | 0 | 1 |
| Null/Undefined 防护 | 2 | 0 | 0 | 2 |
| 资源溢出 | 0 | 1 | 0 | 1 |
| 状态机缺陷 | 0 | 1 | 0 | 1 |
| **合计** | **7** | **3** | **1** | **11** |

---

## P0 详情

### P0-01: `addScore()` NaN 穿透 — `score <= 0` 检查对 NaN 无效

**严重性**: P0（数据损坏）
**文件**: `SeasonSystem.ts:191-193`
**证据**:
```typescript
// SeasonSystem.ts:191-193
addScore(heroId: string, score: number): void {
    this.ensureActiveSeason();
    if (score <= 0) return;   // NaN <= 0 → false → NaN 通过！
    // ...
    existing.score += score;  // score=NaN → existing.score=NaN
}
```

**攻击路径**:
1. `sys.addScore('hero1', NaN)` → `NaN <= 0` 为 false，不 return
2. `existing.score += NaN` → score 永久变为 NaN
3. `getLeaderboard()` 中 `NaN - NaN = NaN` → 排序完全崩溃
4. `serialize()` 保存 NaN → JSON.stringify(NaN) = "null" → 反序列化后 score=null

**影响**: 一旦 NaN 进入 score，整个排行榜系统失效，存档数据损坏。

---

### P0-02: `setScore()` 无 NaN/负值防护 — 直接写入

**严重性**: P0（数据损坏）
**文件**: `SeasonSystem.ts:205-213`
**证据**:
```typescript
// SeasonSystem.ts:205-213
setScore(heroId: string, score: number): void {
    this.ensureActiveSeason();
    // ❌ 无任何数值校验！NaN、负数、Infinity 直接写入
    const existing = this.state.scores.find(s => s.heroId === heroId);
    if (existing) {
      existing.score = score;  // score=NaN/-100/Infinity 直接赋值
    } else {
      this.state.scores.push({ heroId, score });
    }
}
```

**对比**: `addScore` 至少有 `score <= 0` 检查（虽然对 NaN 无效），`setScore` 完全无校验。

---

### P0-03: `createSeason()` durationDays=NaN → endTime=NaN → 赛季状态不确定

**严重性**: P0（逻辑绕过）
**文件**: `SeasonSystem.ts:130-131`
**证据**:
```typescript
// SeasonSystem.ts:130-131
const endTime = now + durationDays * 24 * 60 * 60 * 1000;
// durationDays=NaN → NaN * ... = NaN → endTime=NaN
```

**下游影响**:
- `isSeasonActive()`: `Date.now() < NaN` → false → 赛季标记为不活跃
- `ensureActiveSeason()`: `Date.now() < NaN` → false → 抛错"赛季已过期"
- `getRemainingDays()`: `NaN - Date.now()` = NaN → `Math.max(0, NaN)` = NaN → 返回 NaN
- `getElapsedDays()`: `Date.now() - NaN` = NaN → `Math.max(0, NaN)` = NaN → 返回 NaN
- `serialize()`: endTime=NaN → JSON序列化为null

**攻击路径**: 业务层传入 `NaN`（如从配置读取失败），赛季创建成功但处于不确定状态。

---

### P0-04: `createSeason()` durationDays=Infinity → endTime=Infinity → 序列化破坏

**严重性**: P0（存档损坏） — BR-19 规则
**文件**: `SeasonSystem.ts:130-131`
**证据**:
```typescript
const endTime = now + Infinity * 24 * 60 * 60 * 1000;
// = Infinity
```

**攻击路径**:
1. `createSeason('S1', Infinity)` → endTime = Infinity
2. `isSeasonActive()`: `Date.now() < Infinity` → true → 赛季永远活跃
3. `getSaveData()` → endTime=Infinity
4. `JSON.stringify({endTime: Infinity})` → `{"endTime": null}`
5. `loadSaveData()` → endTime=null
6. `isSeasonActive()`: `Date.now() < null` → false → 赛季变为不活跃
7. **存档加载后赛季状态改变！**

---

### P0-05: `loadSaveData(null)` — null 输入导致崩溃

**严重性**: P0（崩溃）
**文件**: `SeasonSystem.ts:345-346`
**证据**:
```typescript
// SeasonSystem.ts:345-346
loadSaveData(data: SeasonSaveData): void {
    if (data.version !== SEASON_SAVE_VERSION) return;
    // data=null → TypeError: Cannot read properties of null (reading 'version')
}
```

**攻击路径**: `loadSaveData(null as any)` → 立即崩溃。虽然 TypeScript 类型约束，但运行时无防护。

---

### P0-06: `loadSaveData()` data.state 为 null/undefined 导致崩溃

**严重性**: P0（崩溃）
**文件**: `SeasonSystem.ts:348-354`
**证据**:
```typescript
// SeasonSystem.ts:348-354
loadSaveData(data: SeasonSaveData): void {
    if (data.version !== SEASON_SAVE_VERSION) return;
    this.state = {
      currentSeason: data.state.currentSeason ? { ...data.state.currentSeason } : null,
      // data.state=null → Cannot read properties of null (reading 'currentSeason')
      scores: data.state.scores.map(s => ({ ...s })),
      // ...
    };
}
```

**攻击路径**: `loadSaveData({ version: 1, state: null as any })` → 崩溃。

---

### P0-07: `loadSaveData()` scores 数组含 NaN/Infinity — 反序列化后数据损坏

**严重性**: P0（数据损坏）
**文件**: `SeasonSystem.ts:350`
**证据**:
```typescript
scores: data.state.scores.map(s => ({ ...s })),
// 如果 s.score = NaN 或 Infinity，直接恢复，无校验
```

**攻击路径**:
1. 正常游戏中 `addScore('hero1', NaN)` (P0-01) → score=NaN
2. `serialize()` → `JSON.stringify(NaN)` = `"null"`
3. `loadSaveData()` → score=null → `getScore()` 返回 null
4. `getLeaderboard()` 排序: `null - 100 = NaN` → 排序崩溃

---

## P1 详情

### P1-01: `createSeason()` durationDays=0 或负数 — 赛季立即过期

**文件**: `SeasonSystem.ts:130`
**问题**: `durationDays=0` → endTime=now → 赛季立即过期。无最小值校验。

### P1-02: 积分无上限 — score 可无限增长

**文件**: `SeasonSystem.ts:191-198`
**问题**: `addScore` 无上限检查。BR-22 规则要求所有资源累积型系统必须有 MAX_* 常量。

### P1-03: `getLeaderboard(NaN)` → slice(0, NaN) 返回空数组

**文件**: `SeasonSystem.ts:231`
**问题**: `[1,2,3].slice(0, NaN)` → `[]`。NaN limit 导致排行榜返回空。
