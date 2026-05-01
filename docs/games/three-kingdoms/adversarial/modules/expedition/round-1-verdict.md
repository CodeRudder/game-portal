# Expedition R1 仲裁裁决

> Arbiter Agent | 2026-05-01

## 裁决总览

| 挑战 | Builder声称 | Challenger声称 | 裁决 | 理由 |
|------|------------|---------------|------|------|
| P0-1 | FL-05/06/07/08 ❌ | 保存/加载断裂 | ✅ **P0确认** | 六处同步全部缺失 |
| P0-2 | FB-05 ⚠️ | completeRoute NaN/Infinity | ✅ **P0确认** | Infinity写入+序列化损坏 |
| P0-3 | FB-07 ⚠️ | recoverTroops NaN | ✅ **P0确认** | NaN传播到所有队伍兵力 |
| P1-1 | FB-01 ⚠️ | updateSlots NaN | ✅ **P1确认** | 功能降级不崩溃 |
| P1-2 | FB-13 ⚠️ | processNodeEffect NaN | ✅ **P1确认** | 需外部数据注入 |
| P1-3 | FL-07 ❌ | remainingRepeats未持久化 | ✅ **P1确认** | 保存/加载后行为变化 |
| P1-4 | FB-09 ⚠️ | quickBattle NaN | ✅ **P1确认** | 输出含NaN |

## P0 详细裁决

### P0-1: 保存/加载流程断裂 — 确认

**证据链完整性：✅**

1. `ExpeditionSystem.serialize()` 存在（ExpeditionSystem.ts:415）→ ✅ 已实现
2. `ExpeditionSystem.deserialize()` 存在（ExpeditionSystem.ts:449）→ ✅ 已实现
3. `GameSaveData` 无 expedition 字段（shared/types.ts:216-295）→ ✅ 确认缺失
4. `SaveContext` 无 expedition 引用（engine-save.ts:55-131）→ ✅ 确认缺失
5. `buildSaveData()` 未调用 expedition.serialize()（engine-save.ts:135-200）→ ✅ 确认缺失
6. `applySaveData()` 未调用 expedition.deserialize()（engine-save.ts:425-640）→ ✅ 确认缺失

**影响评估：**
- 用户每次保存/加载后远征进度100%丢失
- 包括：通关记录、星级、队伍编成、扫荡次数、里程碑、路线解锁状态
- 这是 BR-014/BR-015 的典型案例（R3教训：6个子系统状态丢失）

**修复方案：**
- GameSaveData 添加 `expedition?: ExpeditionSaveData`
- SaveContext 添加 `readonly expedition?: ExpeditionSystem`
- buildSaveData() 添加 `expedition: ctx.expedition?.serialize()`
- applySaveData() 添加 `ctx.expedition?.deserialize(data.expedition)`
- toIGameState() 添加 expedition 字段
- fromIGameState() 添加 expedition 提取

**严重度：P0-CRITICAL**

---

### P0-2: completeRoute(stars) NaN/Infinity — 确认

**证据链完整性：✅**

1. `completeRoute(teamId: string, stars: number)` 无参数校验（ExpeditionSystem.ts:320）
2. `stars > prevStars` 对 Infinity 为 true → 写入 Infinity
3. `JSON.stringify(Infinity)` → `null` → 反序列化后丢失
4. NaN 情况：`NaN > prevStars` → false → 不写入（安全）

**影响评估：**
- Infinity 写入后序列化损坏（变为null），加载后星级归零
- 负值不会写入（`-1 > 0` → false），安全
- NaN 不会写入（`NaN > 0` → false），安全

**修复方案：**
```typescript
completeRoute(teamId: string, stars: number): boolean {
    if (!Number.isFinite(stars) || stars < 0 || stars > 3) return false;
    // ... 原有逻辑
}
```

**严重度：P0** — 数据损坏

---

### P0-3: recoverTroops(elapsedSeconds) NaN传播 — 确认

**证据链完整性：✅**

1. `recoverTroops(elapsedSeconds: number)` 无参数校验（ExpeditionSystem.ts:407）
2. `NaN / 300` → NaN → `Math.floor(NaN)` → NaN
3. `NaN * 1` → NaN
4. `troopCount + NaN` → NaN
5. `Math.min(maxTroops, NaN)` → NaN
6. **所有队伍兵力变为NaN**
7. 后续 `team.troopCount < requiredTroops` → NaN < N → false → **绕过兵力检查**

**影响评估：**
- NaN传播到所有队伍的兵力值
- NaN绕过 `<` 比较（BR-21教训），允许0兵力派遣
- 影响范围：所有使用 troopCount 的逻辑

**修复方案：**
```typescript
recoverTroops(elapsedSeconds: number): void {
    if (!Number.isFinite(elapsedSeconds) || elapsedSeconds <= 0) return;
    // ... 原有逻辑
}
```

**严重度：P0** — NaN传播+安全检查绕过

---

## P1 详细裁决

### P1-1: updateSlots(castleLevel) NaN — 确认为P1

- NaN输入导致 unlockedSlots=0，功能降级
- 不崩溃，不损坏数据
- 建议修复但不阻塞封版

### P1-2: processNodeEffect() healPercent NaN — 确认为P1

- 需要外部数据注入（deserialize损坏数据）
- 正常流程不会触发
- 建议添加 `Number.isFinite` 防护

### P1-3: remainingRepeats 未持久化 — 确认为P1

- 仅影响自动远征有限次数模式
- 保存/加载后变为无限循环
- 建议将 remainingRepeats 加入 ExpeditionSaveData

### P1-4: quickBattle() NaN — 确认为P1

- NaN输入导致 totalTurns=NaN
- allyHpPercent/allyDeaths 正常
- 建议添加入口校验

---

## 封版评估

| 条件 | 状态 |
|------|------|
| P0数量 | 3个（需修复） |
| P0修复难度 | 中等（P0-1需修改6处文件，P0-2/P0-3各1处） |
| R1直接封版 | ❌ 不可 |
| 修复后封版 | ✅ 可行 |

## 修复优先级

1. **P0-1** (保存/加载) → 修改6处文件，最关键
2. **P0-3** (recoverTroops NaN) → 1处修改，简单
3. **P0-2** (completeRoute Infinity) → 1处修改，简单

## 修复后验证要求

- [ ] P0-1: buildSaveData() 输出包含 expedition 字段
- [ ] P0-1: applySaveData() 调用 expedition.deserialize()
- [ ] P0-1: 保存/加载往返测试通过
- [ ] P0-2: completeRoute(Infinity) 返回 false
- [ ] P0-2: completeRoute(NaN) 返回 false
- [ ] P0-3: recoverTroops(NaN) 不修改 troopCount
- [ ] P0-3: recoverTroops(-1) 不修改 troopCount
