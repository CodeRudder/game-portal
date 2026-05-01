# NPC 模块 R1 对抗式测试 — 挑战报告

> Challenger Agent | 日期: 2026-05-01
> 目标: 审查源码确认P0节点，寻找遗漏的高危漏洞

## 挑战确认矩阵

### CH-001: NPC子系统存档完全缺失 — 确认 P0 ✅

**源码证据:**
- `engine-save.ts:137-196` — `buildSaveData()` 无任何NPC相关字段
- `shared/types.ts:216-310` — `GameSaveData` 接口无NPC字段
- `engine-save.ts:68-100` — `SaveContext` 接口无NPC引用
- `engine-extended-deps.ts:172` — 仅注册 `npcSystem`，其他7个NPC子系统未注册

**影响范围:**
- NPCSystem.exportSaveData() — 有方法但从未被调用
- NPCFavorabilitySystem.serialize() — 有方法但从未被调用
- NPCAffinitySystem.exportSaveData() — 有方法但从未被调用
- NPCGiftSystem.exportSaveData() — 有方法但从未被调用
- NPCPatrolSystem.exportSaveData() — 有方法但从未被调用
- NPCSpawnSystem.serialize() — 有方法但从未被调用
- NPCTrainingSystem.serialize() — 有方法但从未被调用

**玩家影响:** 所有NPC交互进度（好感度、赠送历史、结盟关系、巡逻状态、切磋记录、对话历史）在存档/读档后全部丢失。这是**数据丢失类P0**。

---

### CH-002: changeAffinity / setAffinity NaN穿透 — 确认 P0 ✅

**源码证据 (NPCSystem.ts:277-290, 299):**
```ts
changeAffinity(id, delta) {
    npc.affinity = Math.max(0, Math.min(100, npc.affinity + delta));
}
setAffinity(id, value) {
    npc.affinity = Math.max(0, Math.min(100, value));
}
```

**NaN穿透路径:**
1. `delta = NaN` → `affinity + NaN = NaN`
2. `Math.min(100, NaN)` = `NaN` (Math.min有NaN时返回NaN)
3. `Math.max(0, NaN)` = `NaN` (同上)
4. `npc.affinity = NaN` — **永久损坏**

**触发场景:**
- NPCFavorabilitySystem.addAffinity 传入NaN delta
- NPCGiftSystem.applyAffinityChange 传入NaN delta
- 外部系统直接调用 changeAffinity(npcId, NaN)

---

### CH-003: NPCAffinitySystem.gainFrom* 修改副本 — 确认 P0 ✅

**源码证据 (NPCAffinitySystem.ts:196-210):**
```ts
gainFromDialog(npcId: NPCId, npc: NPCData, bonus = 0): AffinityChangeRecord {
    return this.recordChange(npcId, npc, this.config.dialogBase + bonus, 'dialog', '与NPC对话');
}

private recordChange(npcId, npc: NPCData, delta, source, description) {
    const previousAffinity = npc.affinity;
    const newAffinity = clampAffinity(previousAffinity + delta);
    npc.affinity = newAffinity; // 修改传入的npc对象
```

**问题:** `gainFromDialog` 等方法接收外部传入的 `NPCData` 对象。如果调用方通过 `npcSystem.getNPCById(id)` 获取（返回深拷贝），则修改的是副本，NPCSystem中的原始数据不变。

**对比 NPCFavorabilitySystem:**
```ts
// NPCFavorabilitySystem.addAffinity 正确地通过 npcSys.setAffinity 修改
npcSys.setAffinity(npcId, newVal);
```

NPCFavorabilitySystem 通过 registry 获取 NPCSystem 并调用 setAffinity，是正确的做法。NPCAffinitySystem 直接修改传入对象，是错误的设计。

**影响:** 使用NPCAffinitySystem的gainFrom*方法时，好感度变更不会持久化到NPCSystem。

---

### CH-004: NPCDialogSystem dialogDeps未初始化崩溃 — 确认 P0 ✅

**源码证据 (NPCDialogSystem.ts:222-229):**
```ts
selectOption(sessionId, optionId) {
    // ...
    const affinity = this.dialogDeps.getAffinity(session.npcId); // 崩溃点
```

**问题:** `dialogDeps` 声明为 `private dialogDeps!: NPCDialogDeps;` (非空断言)，如果 `setDialogDeps()` 未被调用：
- `getAvailableOptions()` → `this.dialogDeps.getAffinity(...)` → TypeError
- `selectOption()` → `this.dialogDeps.getAffinity(...)` → TypeError
- `recordHistoryEntry()` → `this.dialogDeps?.getCurrentTurn?.()` → 安全（可选链）

**触发场景:** 初始化NPCDialogSystem后直接调用startDialog → getAvailableOptions → 崩溃

---

### CH-005: NPCTrainingSystem NaN导致切磋永远胜利 — 确认 P0 ✅

**源码证据 (NPCTrainingTypes.ts → NPCTrainingSystem.ts:321-325):**
```ts
resolveTrainingOutcome(playerLevel, npcLevel) {
    const levelDiff = playerLevel - npcLevel;
    const threshold = 50 + levelDiff * 5;
    if (roll >= threshold + 20) return 'lose';  // roll >= NaN = false
    if (roll >= threshold) return 'draw';        // roll >= NaN = false
    return 'win';                                 // 总是执行
}
```

**NaN传播:**
- `playerLevel = NaN` → `levelDiff = NaN` → `threshold = NaN`
- `roll >= NaN + 20` = `false` → 不返回 'lose'
- `roll >= NaN` = `false` → 不返回 'draw'
- **总是返回 'win'** → 无限获取经验和道具

---

### CH-006: NPCTrainingSystem formAlliance NaN绕过 — 确认 P0 ✅

**源码证据 (NPCTrainingSystem.ts:209-211):**
```ts
formAlliance(npcId, defId, currentAffinity, bonuses) {
    if (currentAffinity < ALLIANCE_REQUIRED_AFFINITY) { // NaN < 80 = false
        return { success: false, reason: ... };
    }
```

**触发:** `formAlliance(npcId, defId, NaN, bonuses)` → `NaN < 80 = false` → 绕过检查 → 结盟成功

**违反规则:** BR-21 (资源比较NaN防护)

---

### CH-007: NPCGiftSystem NaN好感度绕过检查 — 确认 P0 ✅

**源码证据 (NPCGiftSystem.ts:196-199):**
```ts
if (npcData.affinity < this.config.minAffinityToGift) {
    return this.failResult(npcId, itemId, '好感度不足，无法赠送');
}
```

**触发:** 如果NPC的好感度已被NaN损坏（通过CH-002），则 `NaN < 20 = false` → 绕过检查 → 可以赠送

**违反规则:** BR-21 (资源比较NaN防护)

---

### CH-008: deserialize(null/undefined) 崩溃 — 确认 P0 ✅

**影响子系统:**
1. **NPCFavorabilitySystem.deserialize(undefined)** (L184):
   ```ts
   this.changeHistory = data.changeHistory ?? [];
   ```
   `data = undefined` → `Cannot read properties of undefined` 崩溃

2. **NPCTrainingSystem.deserialize(undefined)** (L291):
   ```ts
   this.trainingRecords = data.trainingRecords ?? [];
   ```
   同上

**违反规则:** BR-10 (deserialize覆盖验证：null/undefined输入必须安全处理)

---

### CH-009: NPCMapPlacer placerDeps未初始化崩溃 — 确认 P0 ✅

**源码证据 (NPCMapPlacer.ts:157-160):**
```ts
computeMapDisplays() {
    const npcs = this.placerDeps?.getVisibleNPCs?.() ?? [];
```

**修正:** 此处使用了可选链 `?.`，所以实际上不会崩溃。让我重新检查...

**重新验证:** `placerDeps` 声明为 `private placerDeps!: NPCMapPlacerDeps;`，但 `computeMapDisplays` 中使用了 `this.placerDeps?.getVisibleNPCs?.()`，有可选链保护。

**降级为 P2** — placerDeps未设置时返回空数组，不会崩溃但功能异常。

---

### CH-010: 新发现 — NPCGiftSystem dailyGiftCount NaN绕过

**源码证据 (NPCGiftSystem.ts:202-204):**
```ts
if (this.config.dailyGiftLimit > 0 && this.dailyGiftCount >= this.config.dailyGiftLimit) {
    return this.failResult(npcId, itemId, '今日赠送次数已用完');
}
```

如果 `importSaveData` 传入 `dailyGiftCount: NaN`，则 `NaN >= 10 = false` → 绕过日限购

**优先级: P1** — 需要先通过存档注入NaN，攻击面较窄

---

## 挑战结果汇总

| 挑战ID | 描述 | 判定 | 优先级 |
|--------|------|------|--------|
| CH-001 | NPC子系统存档完全缺失 | ✅ 确认 | P0 |
| CH-002 | changeAffinity/setAffinity NaN穿透 | ✅ 确认 | P0 |
| CH-003 | NPCAffinitySystem修改副本好感度丢失 | ✅ 确认 | P0 |
| CH-004 | NPCDialogSystem dialogDeps未初始化崩溃 | ✅ 确认 | P0 |
| CH-005 | NPCTraining NaN导致切磋永远胜利 | ✅ 确认 | P0 |
| CH-006 | formAlliance NaN绕过好感度检查 | ✅ 确认 | P0 |
| CH-007 | NPCGift NaN好感度绕过赠送检查 | ✅ 确认 | P0 |
| CH-008 | deserialize(null/undefined)崩溃 | ✅ 确认 | P0 |
| CH-009 | NPCMapPlacer placerDeps崩溃 | ⬇️ 降级为P2 | P2 |
| CH-010 | dailyGiftCount NaN绕过日限购 | 🆕 新发现 | P1 |

**确认P0数: 8个** (CH-001~CH-008)
**降级: 1个** (CH-009)
**新发现: 1个** (CH-010, P1)
