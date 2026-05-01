# NPC 模块 R1 对抗式测试 — 仲裁裁决

> Arbiter Agent | 日期: 2026-05-01
> 依据: Builder流程树 + Challenger挑战报告

## 裁决原则

1. P0 = 数据丢失 / 崩溃 / 核心逻辑绕过
2. 需要源码行号支撑
3. 需要评估修复范围和风险

---

## P0 裁决

### VER-001: NPC子系统存档完全缺失 ✅ P0 确认

**来源:** CH-001 / F-0.1
**严重度:** 数据丢失 — 玩家所有NPC交互进度在存档/读档后丢失
**影响子系统:** NPCSystem, NPCFavorabilitySystem, NPCAffinitySystem, NPCGiftSystem, NPCPatrolSystem, NPCSpawnSystem, NPCTrainingSystem (7个)

**修复范围:**
1. `shared/types.ts` — GameSaveData 添加NPC字段
2. `engine-save.ts` — SaveContext 添加NPC引用 + buildSaveData调用NPC序列化 + toIGameState/fromIGameState包含NPC
3. `engine-extended-deps.ts` — 注册所有NPC子系统 + init/reset
4. `ThreeKingdomsEngine.ts` — buildSaveCtx 添加NPC引用

**注意:** 此修复范围极大，涉及6处同步（BR-15），但作为架构级问题必须修复。由于本模块是新增子系统，属于遗漏而非回归。

**裁决:** ✅ P0 确认 — 但标记为 **架构级P0**，修复需要跨多个文件协调。本R1仅记录，建议在专门的PR中修复。

---

### VER-002: changeAffinity / setAffinity NaN穿透 ✅ P0 确认

**来源:** CH-002 / F-1.1-N01, F-1.2-N01
**严重度:** 数据损坏 — NaN写入affinity后永久损坏，影响所有后续比较
**源码:** NPCSystem.ts:277-290, 299

**修复方案:**
```ts
changeAffinity(id: NPCId, delta: number): number | null {
    const npc = this.npcs.get(id);
    if (!npc) return null;
    if (!Number.isFinite(delta)) return npc.affinity; // FIX
    npc.affinity = Math.max(0, Math.min(100, npc.affinity + delta));
    // ...
}

setAffinity(id: NPCId, value: number): boolean {
    const npc = this.npcs.get(id);
    if (!npc) return false;
    if (!Number.isFinite(value)) return false; // FIX
    npc.affinity = Math.max(0, Math.min(100, value));
    return true;
}
```

**裁决:** ✅ P0 确认 — 修复简单，2处guard

---

### VER-003: NPCAffinitySystem.gainFrom* 修改副本 ✅ P0 确认

**来源:** CH-003 / F-3.1-N01
**严重度:** 数据丢失 — 好感度变更不持久化
**源码:** NPCAffinitySystem.ts:196-243

**问题分析:** NPCAffinitySystem.recordChange 直接修改传入的 NPCData 对象。由于 NPCSystem.getNPCById 返回深拷贝，外部获取的NPCData是副本，修改不影响原始数据。

**修复方案:** 改为通过 registry 获取 NPCSystem 并调用 setAffinity（与 NPCFavorabilitySystem 一致）
```ts
private recordChange(npcId, npc, delta, source, description) {
    const previousAffinity = npc.affinity;
    const newAffinity = clampAffinity(previousAffinity + delta);
    // 不再直接修改npc对象，而是通过NPCSystem
    const npcSys = this.getNPCSystem();
    if (npcSys) npcSys.setAffinity(npcId, newAffinity);
    // ...
}
```

**裁决:** ✅ P0 确认 — 需要重构recordChange方法

---

### VER-004: NPCDialogSystem dialogDeps未初始化崩溃 ✅ P0 确认

**来源:** CH-004 / F-5.1-N02
**严重度:** 运行时崩溃 — TypeError: Cannot read properties of undefined
**源码:** NPCDialogSystem.ts:195, 222

**修复方案:**
```ts
getAvailableOptions(sessionId: SessionId): DialogOption[] {
    // ...
    if (!this.dialogDeps) return []; // FIX: 防护
    const affinity = this.dialogDeps.getAffinity(session.npcId);
    // ...
}

selectOption(sessionId: SessionId, optionId: string): DialogSelectResult {
    // ...
    if (!this.dialogDeps) {
        return { success: false, reason: 'session_not_found', effects: [] }; // FIX
    }
    // ...
}
```

**裁决:** ✅ P0 确认 — 修复简单，添加null guard

---

### VER-005: NPCTraining NaN导致切磋永远胜利 ✅ P0 确认

**来源:** CH-005 / F-9.1-N01
**严重度:** 游戏逻辑绕过 — NaN输入导致100%胜率
**源码:** NPCTrainingSystem.ts:321-325

**修复方案:**
```ts
training(npcId: string, playerLevel: number, npcLevel: number): TrainingResult {
    if (!Number.isFinite(playerLevel) || !Number.isFinite(npcLevel) ||
        playerLevel < 0 || npcLevel < 0) {
        return { npcId, outcome: 'draw', rewards: null, message: '参数无效' };
    }
    // ...
}
```

**裁决:** ✅ P0 确认 — 修复简单，入口guard

---

### VER-006: formAlliance NaN绕过好感度检查 ✅ P0 确认

**来源:** CH-006 / F-9.2-N01
**严重度:** 游戏逻辑绕过 — NaN绕过好感度前置条件
**源码:** NPCTrainingSystem.ts:209-211
**违反:** BR-21 (资源比较NaN防护)

**修复方案:**
```ts
formAlliance(npcId, defId, currentAffinity, bonuses) {
    if (!Number.isFinite(currentAffinity) || currentAffinity < ALLIANCE_REQUIRED_AFFINITY) {
        return { success: false, reason: '好感度不足' };
    }
    // ...
}
```

**裁决:** ✅ P0 确认 — 修复简单，1处guard

---

### VER-007: NPCGift NaN好感度绕过赠送检查 ✅ P0 确认

**来源:** CH-007 / F-4.1-N03
**严重度:** 游戏逻辑绕过 — NaN绕过好感度前置条件
**源码:** NPCGiftSystem.ts:196-199
**违反:** BR-21 (资源比较NaN防护)

**修复方案:**
```ts
giveGift(request: GiftRequest): GiftResult {
    // ...
    if (!Number.isFinite(npcData.affinity) || npcData.affinity < this.config.minAffinityToGift) {
        return this.failResult(npcId, itemId, '好感度不足，无法赠送');
    }
    // ...
}
```

**裁决:** ✅ P0 确认 — 修复简单，1处guard

---

### VER-008: deserialize(null/undefined) 崩溃 ✅ P0 确认

**来源:** CH-008 / F-2.3-N02, F-9.4-N02
**严重度:** 运行时崩溃 — 加载损坏存档时崩溃
**违反:** BR-10 (null/undefined输入必须安全处理)

**影响:**
1. NPCFavorabilitySystem.deserialize(undefined) — L184
2. NPCTrainingSystem.deserialize(undefined) — L291

**修复方案:** 两个deserialize方法添加null guard
```ts
deserialize(data: FavorabilitySaveData): void {
    if (!data) { this.changeHistory = []; this.bondSkillCooldowns.clear(); return; }
    // ...
}
```

**裁决:** ✅ P0 确认 — 修复简单，2处guard

---

## 降级裁决

### VER-009: NPCMapPlacer placerDeps崩溃 → 降级为 P2

**来源:** CH-009 (Builder标记P0)
**原因:** 源码验证发现 `this.placerDeps?.getVisibleNPCs?.()` 使用了可选链，不会崩溃
**裁决:** ⬇️ 降级为 P2 — 功能异常但不崩溃

---

## 修复优先级排序

| 优先级 | ID | 修复复杂度 | 风险 |
|--------|-----|-----------|------|
| 1 | VER-002 | 低 (2处guard) | 低 |
| 2 | VER-004 | 低 (2处guard) | 低 |
| 3 | VER-005 | 低 (1处guard) | 低 |
| 4 | VER-006 | 低 (1处guard) | 低 |
| 5 | VER-007 | 低 (1处guard) | 低 |
| 6 | VER-008 | 低 (2处guard) | 低 |
| 7 | VER-003 | 中 (重构recordChange) | 中 |
| 8 | VER-001 | 高 (跨6个文件) | 高 |

**建议:** 先修复 VER-002/004/005/006/007/008 (低风险guard)，VER-003 需要重构，VER-001 需要架构级PR。

---

## 裁决统计

| 判定 | 数量 |
|------|------|
| ✅ P0 确认 | 8 |
| ⬇️ 降级 | 1 |
| ❌ 否决 | 0 |
| **总计** | **9** |
