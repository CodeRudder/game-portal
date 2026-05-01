# Season 模块 R1 对抗式测试 — 仲裁裁决

> Arbiter Agent | 日期: 2026-05-01
> 依据: Builder流程树(round-1-tree.md) + Challenger挑战报告(round-1-challenges.md)

## 裁决原则

1. P0 = 数据丢失 / 崩溃 / 核心逻辑绕过
2. 需要源码行号支撑
3. 需要评估修复范围和风险

---

## P0 裁决

### VER-001: `addScore()` NaN 穿透 ✅ P0 确认

**来源:** CH-01 / SS-034
**严重度:** 数据损坏 — NaN写入score后永久损坏，影响排行榜和存档
**源码:** SeasonSystem.ts:191-193

**修复方案:**
```typescript
addScore(heroId: string, score: number): void {
    this.ensureActiveSeason();
    if (!Number.isFinite(score) || score <= 0) return;  // FIX
    // ...
}
```

**裁决:** ✅ P0 确认 — 1处guard，修复简单

---

### VER-002: `setScore()` 无 NaN/负值防护 ✅ P0 确认

**来源:** CH-02 / SS-040, SS-041
**严重度:** 数据损坏 — NaN/负数/Infinity直接写入score
**源码:** SeasonSystem.ts:205-213

**修复方案:**
```typescript
setScore(heroId: string, score: number): void {
    this.ensureActiveSeason();
    if (!Number.isFinite(score) || score < 0) return;  // FIX: 拒绝NaN/Infinity/负数
    // ...
}
```

**裁决:** ✅ P0 确认 — 1处guard，与VER-001对称修复（BR-20: 对称函数修复验证）

---

### VER-003: `createSeason()` durationDays=NaN → endTime=NaN ✅ P0 确认

**来源:** CH-03 / SS-014
**严重度:** 逻辑绕过 — 赛季创建成功但endTime=NaN，所有时间查询返回NaN
**源码:** SeasonSystem.ts:130-131

**修复方案:**
```typescript
createSeason(name: string, durationDays: number = DEFAULT_SEASON_DURATION_DAYS): SeasonInfo {
    // FIX: 校验durationDays
    if (!Number.isFinite(durationDays) || durationDays <= 0) {
      durationDays = DEFAULT_SEASON_DURATION_DAYS;
    }
    // ...
}
```

**裁决:** ✅ P0 确认 — 1处guard，使用默认值回退

---

### VER-004: `createSeason()` durationDays=Infinity → 序列化破坏 ✅ P0 确认

**来源:** CH-04 / SS-017
**严重度:** 存档损坏 — Infinity序列化为null，加载后赛季状态改变
**源码:** SeasonSystem.ts:130-131

**修复方案:** 与VER-003合并修复 — `!Number.isFinite(durationDays)` 已覆盖Infinity情况。

**裁决:** ✅ P0 确认 — 与VER-003合并，无需额外修复

---

### VER-005: `loadSaveData(null)` 崩溃 ✅ P0 确认

**来源:** CH-05 / SS-087
**严重度:** 崩溃 — null输入导致TypeError
**源码:** SeasonSystem.ts:345-346

**修复方案:**
```typescript
loadSaveData(data: SeasonSaveData): void {
    if (!data || data.version !== SEASON_SAVE_VERSION) return;  // FIX: null guard
    // ...
}
```

**裁决:** ✅ P0 确认 — 1处null guard

---

### VER-006: `loadSaveData()` data.state=null 崩溃 ✅ P0 确认

**来源:** CH-06 / SS-088
**严重度:** 崩溃 — state为null导致TypeError
**源码:** SeasonSystem.ts:348-354

**修复方案:** 与VER-005合并修复 — 在null guard后增加state校验：
```typescript
loadSaveData(data: SeasonSaveData): void {
    if (!data || data.version !== SEASON_SAVE_VERSION) return;
    if (!data.state) return;  // FIX: state null guard
    // ...
}
```

**裁决:** ✅ P0 确认 — 与VER-005合并，1处额外guard

---

### VER-007: `loadSaveData()` scores含NaN/Infinity恢复 ✅ P0 确认

**来源:** CH-07 / SS-089
**严重度:** 数据损坏 — 恶意/损坏存档中的NaN/Infinity直接恢复
**源码:** SeasonSystem.ts:350

**修复方案:**
```typescript
scores: data.state.scores
    .filter(s => s && Number.isFinite(s.score) && s.score >= 0)  // FIX: 过滤无效score
    .map(s => ({ ...s })),
```

**裁决:** ✅ P0 确认 — 1处filter，防御性编程

---

## 修复汇总

| FIX ID | 对应VER | 文件 | 修改点 | 行号 |
|--------|---------|------|--------|------|
| FIX-S01 | VER-001 | SeasonSystem.ts | addScore NaN guard | L192 |
| FIX-S02 | VER-002 | SeasonSystem.ts | setScore NaN/负数 guard | L207 |
| FIX-S03 | VER-003+004 | SeasonSystem.ts | createSeason durationDays校验 | L119 |
| FIX-S04 | VER-005+006 | SeasonSystem.ts | loadSaveData null guard | L345-347 |
| FIX-S05 | VER-007 | SeasonSystem.ts | loadSaveData scores过滤 | L350 |

**总计: 5处修改，覆盖7个P0**

---

## P1 记录（不修复，记录待R2处理）

| P1 ID | 描述 | 原因 |
|-------|------|------|
| P1-01 | durationDays=0/负数无最小值校验 | 被FIX-S03部分覆盖（负数回退默认值） |
| P1-02 | 积分无上限常量 | BR-22规则，需策划定义MAX_SCORE |
| P1-03 | getLeaderboard(NaN)返回空数组 | 低优先级，建议R2处理 |

---

## 覆盖率评估

| 维度 | R1 结果 |
|------|---------|
| 公开API覆盖 | 18/18 API已枚举 (100%) |
| NaN防护 | 7个P0中3个NaN相关 → 修复后0 |
| 序列化完整性 | serialize/deserialize路径已验证 |
| Null防护 | loadSaveData null guard已修复 |
| Infinity防护 | durationDays Infinity已修复 |
| 对称函数 | addScore/setScore 同步修复 (BR-20) |
