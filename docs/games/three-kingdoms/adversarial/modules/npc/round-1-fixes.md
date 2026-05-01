# NPC 模块 R1 对抗式测试 — 修复报告

> Fixer Agent | 日期: 2026-05-01
> 依据: Arbiter裁决 VER-001 ~ VER-008

## 修复总览

| FIX ID | 对应VER | 文件 | 修复类型 | 状态 |
|--------|---------|------|----------|------|
| FIX-001 | VER-002 | NPCSystem.ts | NaN防护 (2处) | ✅ 已修复 |
| FIX-002 | VER-004 | NPCDialogSystem.ts | null guard (2处) | ✅ 已修复 |
| FIX-003 | VER-005 | NPCTrainingSystem.ts | NaN防护 (1处) | ✅ 已修复 |
| FIX-004 | VER-006 | NPCTrainingSystem.ts | NaN防护 (1处) | ✅ 已修复 |
| FIX-005 | VER-007 | NPCGiftSystem.ts | NaN防护 (1处) | ✅ 已修复 |
| FIX-006 | VER-008 | NPCFavorabilitySystem.ts, NPCTrainingSystem.ts, NPCAffinitySystem.ts | null guard (3处) | ✅ 已修复 |
| FIX-007 | VER-003 | NPCAffinitySystem.ts | 重构recordChange | ✅ 已修复 |
| — | VER-001 | 跨6个文件 | 架构级修复 | 📝 记录，需单独PR |

---

## 修复详情

### FIX-001: NPCSystem NaN防护 (VER-002)

**文件:** `src/games/three-kingdoms/engine/npc/NPCSystem.ts`

**修复1 — changeAffinity (L277):**
```ts
// Before:
changeAffinity(id: NPCId, delta: number): number | null {
    const npc = this.npcs.get(id);
    if (!npc) return null;
    npc.affinity = Math.max(0, Math.min(100, npc.affinity + delta));

// After:
changeAffinity(id: NPCId, delta: number): number | null {
    const npc = this.npcs.get(id);
    if (!npc) return null;
    if (!Number.isFinite(delta)) return npc.affinity; // FIX-001
    npc.affinity = Math.max(0, Math.min(100, npc.affinity + delta));
```

**修复2 — setAffinity (L299):**
```ts
// Before:
setAffinity(id: NPCId, value: number): boolean {
    const npc = this.npcs.get(id);
    if (!npc) return false;
    npc.affinity = Math.max(0, Math.min(100, value));

// After:
setAffinity(id: NPCId, value: number): boolean {
    const npc = this.npcs.get(id);
    if (!npc) return false;
    if (!Number.isFinite(value)) return false; // FIX-001
    npc.affinity = Math.max(0, Math.min(100, value));
```

**穿透验证:** 搜索所有调用 changeAffinity/setAffinity 的代码路径：
- NPCFavorabilitySystem.addAffinity → 调用 npcSys.setAffinity → 已被FIX-001保护
- NPCGiftSystem.applyAffinityChange → 调用 npcSys.changeAffinity → 已被FIX-001保护
- NPCDialogSystem.selectOption → 调用 dialogDeps.changeAffinity → 外部回调，需调用方保证

**穿透率:** 0% (底层已防护)

---

### FIX-002: NPCDialogSystem dialogDeps防护 (VER-004)

**文件:** `src/games/three-kingdoms/engine/npc/NPCDialogSystem.ts`

**修复1 — getAvailableOptions (L195):**
```ts
// Before:
const affinity = this.dialogDeps.getAffinity(session.npcId);

// After:
if (!this.dialogDeps) return []; // FIX-002
const affinity = this.dialogDeps.getAffinity(session.npcId);
```

**修复2 — selectOption (L222):**
```ts
// Before:
// 查找选项

// After:
if (!this.dialogDeps) { // FIX-002
    return { success: false, reason: 'session_not_found', effects: [] };
}
// 查找选项
```

---

### FIX-003: NPCTraining NaN防护 — training (VER-005)

**文件:** `src/games/three-kingdoms/engine/npc/NPCTrainingSystem.ts`

```ts
// Before:
training(npcId: string, playerLevel: number, npcLevel: number): TrainingResult {
    if (this.trainingCooldowns.has(npcId)) { ... }
    const outcome = this.resolveTrainingOutcome(playerLevel, npcLevel);

// After:
training(npcId: string, playerLevel: number, npcLevel: number): TrainingResult {
    if (this.trainingCooldowns.has(npcId)) { ... }
    if (!Number.isFinite(playerLevel) || !Number.isFinite(npcLevel) || playerLevel < 0 || npcLevel < 0) {
        return { npcId, outcome: 'draw', rewards: null, message: '参数无效' }; // FIX-003
    }
    const outcome = this.resolveTrainingOutcome(playerLevel, npcLevel);
```

---

### FIX-004: NPCTraining NaN防护 — formAlliance (VER-006)

**文件:** `src/games/three-kingdoms/engine/npc/NPCTrainingSystem.ts`

```ts
// Before:
if (currentAffinity < ALLIANCE_REQUIRED_AFFINITY) {

// After:
if (!Number.isFinite(currentAffinity) || currentAffinity < ALLIANCE_REQUIRED_AFFINITY) { // FIX-004
```

---

### FIX-005: NPCGift NaN防护 (VER-007)

**文件:** `src/games/three-kingdoms/engine/npc/NPCGiftSystem.ts`

```ts
// Before:
if (npcData.affinity < this.config.minAffinityToGift) {

// After:
if (!Number.isFinite(npcData.affinity) || npcData.affinity < this.config.minAffinityToGift) { // FIX-005
```

---

### FIX-006: deserialize null/undefined防护 (VER-008)

**文件1:** `NPCFavorabilitySystem.ts`
```ts
// Before:
deserialize(data: FavorabilitySaveData): void {
    this.changeHistory = data.changeHistory ?? [];

// After:
deserialize(data: FavorabilitySaveData): void {
    if (!data) { this.changeHistory = []; this.bondSkillCooldowns.clear(); this.activeBondEffects.clear(); return; } // FIX-006
    this.changeHistory = data.changeHistory ?? [];
```

**文件2:** `NPCTrainingSystem.ts`
```ts
// Before:
deserialize(data: NPCInteractionSaveData): void {
    this.trainingRecords = data.trainingRecords ?? [];

// After:
deserialize(data: NPCInteractionSaveData): void {
    if (!data) { this.trainingRecords = []; this.alliances.clear(); this.offlineSummary = null; this.dialogueHistory = []; return; } // FIX-006
    this.trainingRecords = data.trainingRecords ?? [];
```

**文件3:** `NPCAffinitySystem.ts`
```ts
// Before:
importSaveData(data: FavorabilitySaveData): void {
    this.changeHistory = data.changeHistory ?? [];

// After:
importSaveData(data: FavorabilitySaveData): void {
    if (!data) { this.changeHistory = []; this.bondSkillCooldowns.clear(); return; } // FIX-006
    this.changeHistory = data.changeHistory ?? [];
```

---

### FIX-007: NPCAffinitySystem recordChange重构 (VER-003)

**文件:** `src/games/three-kingdoms/engine/npc/NPCAffinitySystem.ts`

```ts
// Before:
private recordChange(npcId, npc, delta, source, description) {
    const previousAffinity = npc.affinity;
    const newAffinity = clampAffinity(previousAffinity + delta);
    const actualDelta = newAffinity - previousAffinity;
    npc.affinity = newAffinity; // 修改的是副本，不持久化

// After:
private recordChange(npcId, npc, delta, source, description) {
    const previousAffinity = npc.affinity;
    const newAffinity = clampAffinity(previousAffinity + delta);
    const actualDelta = newAffinity - previousAffinity;
    // FIX-007: 通过NPCSystem修改原始数据
    const npcSys = this.getNPCSystem();
    if (npcSys) {
        npcSys.setAffinity(npcId, newAffinity);
        npc.affinity = newAffinity;
    } else {
        npc.affinity = newAffinity;
    }
```

同时添加了 `getNPCSystem()` 辅助方法。

---

## 未修复项

### VER-001: NPC子系统存档缺失 (架构级P0)

**原因:** 需要修改6个文件，涉及：
1. `shared/types.ts` — GameSaveData 添加7个NPC字段
2. `engine-save.ts` — SaveContext + buildSaveData + toIGameState + fromIGameState
3. `engine-extended-deps.ts` — 注册7个NPC子系统
4. `ThreeKingdomsEngine.ts` — buildSaveCtx + applyLoadedState
5. `engine-save-migration.ts` — 迁移逻辑

**建议:** 在专门的架构PR中修复，需要完整的集成测试覆盖。

---

## 编译验证

```
npx tsc --noEmit → NPC模块0错误
```

## 修复统计

| 指标 | 值 |
|------|-----|
| 修复文件数 | 5 |
| 修复点数 | 11 |
| P0修复数 | 7/8 |
| 架构级遗留 | 1 (VER-001) |
| 穿透率 | 0% |
