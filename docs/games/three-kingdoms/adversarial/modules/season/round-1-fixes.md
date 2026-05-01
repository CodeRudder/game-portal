# Season 模块 R1 修复记录

> Fixer Agent | 日期: 2026-05-01
> 依据: round-1-verdict.md 裁决

## 修复概要

| FIX ID | 对应VER | 严重度 | 文件 | 状态 |
|--------|---------|--------|------|------|
| FIX-S01 | VER-001 | P0 | SeasonSystem.ts:197 | ✅ 已修复 |
| FIX-S02 | VER-002 | P0 | SeasonSystem.ts:212 | ✅ 已修复 |
| FIX-S03 | VER-003+004 | P0 | SeasonSystem.ts:130-132 | ✅ 已修复 |
| FIX-S04 | VER-005+006 | P0 | SeasonSystem.ts:355-357 | ✅ 已修复 |
| FIX-S05 | VER-007 | P0 | SeasonSystem.ts:360-362 | ✅ 已修复 |

---

## 修复详情

### FIX-S01: addScore NaN 穿透防护

**文件:** SeasonSystem.ts
**修改:**
```diff
  addScore(heroId: string, score: number): void {
    this.ensureActiveSeason();
-   if (score <= 0) return;
+   // FIX-S01: 使用 Number.isFinite 防止 NaN/Infinity 绕过 (BR-01/BR-06)
+   if (!Number.isFinite(score) || score <= 0) return;
```

**防护范围:** NaN → return, Infinity → return, 负数 → return, 0 → return

---

### FIX-S02: setScore NaN/负值防护

**文件:** SeasonSystem.ts
**修改:**
```diff
  setScore(heroId: string, score: number): void {
    this.ensureActiveSeason();
+   // FIX-S02: 拒绝 NaN/Infinity/负数 (BR-20: 与 addScore 对称修复)
+   if (!Number.isFinite(score) || score < 0) return;
```

**防护范围:** NaN → return, Infinity → return, 负数 → return
**对称性:** 与 FIX-S01 对称（BR-20: 对称函数修复验证）

---

### FIX-S03: createSeason durationDays 校验

**文件:** SeasonSystem.ts
**修改:**
```diff
  createSeason(name: string, durationDays: number = DEFAULT_SEASON_DURATION_DAYS): SeasonInfo {
+   // FIX-S03: 校验 durationDays，防止 NaN/Infinity/非正值导致 endTime 异常
+   if (!Number.isFinite(durationDays) || durationDays <= 0) {
+     durationDays = DEFAULT_SEASON_DURATION_DAYS;
+   }
+
    // 如果有进行中的赛季，先结算
```

**防护范围:** NaN → 回退默认值, Infinity → 回退默认值, 0/负数 → 回退默认值
**覆盖:** VER-003 (NaN) + VER-004 (Infinity) 合并修复

---

### FIX-S04: loadSaveData null 防护

**文件:** SeasonSystem.ts
**修改:**
```diff
  loadSaveData(data: SeasonSaveData): void {
-   if (data.version !== SEASON_SAVE_VERSION) return;
+   // FIX-S04: null/undefined 输入防护
+   if (!data || data.version !== SEASON_SAVE_VERSION) return;
+   if (!data.state) return;
```

**防护范围:** data=null → return, data=undefined → return, data.state=null → return

---

### FIX-S05: loadSaveData scores 过滤

**文件:** SeasonSystem.ts
**修改:**
```diff
-   scores: data.state.scores.map(s => ({ ...s })),
+   // FIX-S05: 过滤无效 score（NaN/Infinity/负数），防止损坏数据恢复
+   scores: data.state.scores
+     .filter(s => s && Number.isFinite(s.score) && s.score >= 0)
+     .map(s => ({ ...s })),
```

**防护范围:** score=NaN → 过滤, score=Infinity → 过滤, score=负数 → 过滤, entry=null → 过滤

---

## 回归验证

```
✓ src/games/three-kingdoms/engine/season/__tests__/SeasonSystem.test.ts  (23 tests)
✓ src/games/three-kingdoms/engine/season/__tests__/season-config.test.ts  (23 tests)
✓ src/games/three-kingdoms/engine/season/__tests__/season-system.test.ts  (56 tests)

Test Files  3 passed (3)
     Tests  102 passed (102)
```

所有 102 个既有测试全部通过，无回归。

---

## FIX 穿透检查 (BR-10)

| 修复 | 穿透检查 | 结果 |
|------|---------|------|
| FIX-S01 addScore | 检查 setScore 是否需要相同修复 | ✅ FIX-S02 已同步修复 |
| FIX-S02 setScore | 检查 addScore 是否需要相同修复 | ✅ FIX-S01 已同步修复 |
| FIX-S03 createSeason | 检查 endTime 下游使用 | ✅ getRemainingDays/getElapsedDays 已有 Math.max(0,...) 防护 |
| FIX-S04 loadSaveData | 检查 serialize/getSaveData 是否需要相同修复 | ❌ 不需要 — 输出方向无需null guard |
| FIX-S05 scores过滤 | 检查 history 过滤是否需要 | ❌ history 是 SeasonInfo[] 不含 score，无需过滤 |

**穿透率:** 0% (2个对称修复已同步，无遗漏)
