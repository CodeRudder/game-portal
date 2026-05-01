# NPC 模块 R2 对抗式测试 — 挑战报告

> Challenger Agent | 日期: 2026-05-01
> 目标: 验证FIX-001~007穿透完整性，探索新攻击面

## FIX 穿透验证

### PT-001: FIX-001 (NaN防护) 穿透验证 ✅ 通过

**攻击路径1: NPCFavorabilitySystem → NPCSystem**
```
addAffinity(npcId, NaN_delta)
→ npcSys.setAffinity(npcId, NaN)  // NPCFavorabilitySystem.ts
→ if (!Number.isFinite(value)) return false  // FIX-001
→ affinity 不变 ✅
```

**攻击路径2: NPCGiftSystem → NPCSystem**
```
applyAffinityChange(npcId, NaN_delta)
→ npcSys.changeAffinity(npcId, NaN)  // NPCGiftSystem.ts
→ if (!Number.isFinite(delta)) return npc.affinity  // FIX-001
→ affinity 不变 ✅
```

**攻击路径3: NPCAffinitySystem → NPCSystem (FIX-007路径)**
```
recordChange(npcId, npc, NaN_delta, ...)
→ newAffinity = clampAffinity(npc.affinity + NaN) = NaN
→ npcSys.setAffinity(npcId, NaN)  // FIX-007
→ if (!Number.isFinite(value)) return false  // FIX-001
→ affinity 不变 ✅
```

**穿透结论:** 所有NaN路径最终汇聚到 NPCSystem.setAffinity/changeAffinity，被 FIX-001 拦截。穿透率 0%。

---

### PT-002: FIX-002 (dialogDeps guard) 穿透验证 ✅ 通过

**攻击路径1: getAvailableOptions 未初始化**
```
this.dialogDeps = undefined
→ if (!this.dialogDeps) return []  // FIX-002
→ 安全返回空数组 ✅
```

**攻击路径2: selectOption 未初始化**
```
this.dialogDeps = undefined
→ if (!this.dialogDeps) { return { success: false, ... } }  // FIX-002
→ 安全返回失败 ✅
```

**攻击路径3: recordHistoryEntry**
```
this.dialogDeps?.getCurrentTurn?.() ?? 0  // 已有可选链
→ 安全 ✅
```

**穿透结论:** 所有 dialogDeps 访问路径均有防护。

---

### PT-003: FIX-003/004 (NPCTraining NaN) 穿透验证 ✅ 通过

**攻击路径1: training NaN level**
```
training(npcId, NaN, NaN)
→ if (!Number.isFinite(playerLevel) || !Number.isFinite(npcLevel))  // FIX-003
→ return { outcome: 'draw', ... }
→ 安全 ✅
```

**攻击路径2: formAlliance NaN affinity**
```
formAlliance(npcId, defId, NaN, bonuses)
→ if (!Number.isFinite(currentAffinity))  // FIX-004
→ return { success: false, ... }
→ 安全 ✅
```

**穿透结论:** NPCTraining NaN 防护完整。

---

### PT-004: FIX-005 (NPCGift NaN) 穿透验证 ✅ 通过

**攻击路径1: giveGift NaN affinity**
```
giveGift(request) where npcData.affinity = NaN
→ if (!Number.isFinite(npcData.affinity))  // FIX-005
→ return failResult('好感度不足')
→ 安全 ✅
```

**穿透结论:** NPCGift NaN 防护完整。

---

### PT-005: FIX-006 (deserialize null guard) 穿透验证 ✅ 通过

**攻击路径1: NPCFavorabilitySystem.deserialize(undefined)**
```
deserialize(undefined)
→ if (!data) { this.changeHistory = []; ... return; }  // FIX-006
→ 安全 ✅
```

**攻击路径2: NPCTrainingSystem.deserialize(undefined)**
```
deserialize(undefined)
→ if (!data) { this.trainingRecords = []; ... return; }  // FIX-006
→ 安全 ✅
```

**攻击路径3: NPCAffinitySystem.importSaveData(undefined)**
```
importSaveData(undefined)
→ if (!data) { this.changeHistory = []; ... return; }  // FIX-006
→ 安全 ✅
```

**穿透结论:** 所有 deserialize/importSaveData null guard 完整。

---

### PT-006: FIX-007 (recordChange重构) 穿透验证 ✅ 通过

**攻击路径: gainFromDialog → recordChange → NPCSystem**
```
gainFromDialog(npcId, npcCopy, bonus)
→ recordChange(npcId, npcCopy, delta, 'dialog', ...)
→ npcSys = this.getNPCSystem()  // 通过registry获取
→ npcSys.setAffinity(npcId, newAffinity)  // 修改原始数据
→ npc.affinity = newAffinity  // 同步更新本地副本
→ 安全 ✅
```

**降级路径: registry获取失败**
```
npcSys = null
→ if (npcSys) { ... } else { npc.affinity = newAffinity; }  // 退化为副本修改
→ 好感度不持久化，但不会崩溃
```

**穿透结论:** 正常路径下 FIX-007 正确修改原始数据。降级路径（registry失败）退化为R1问题但不会崩溃。

---

## 新维度探索

### ND-1: clampAffinity NaN穿透 (P2)

**发现:** NPCAffinitySystem.ts 中的 `clampAffinity` 函数不防护 NaN：
```ts
function clampAffinity(value: number): number {
    return Math.max(0, Math.min(100, value));
}
```
`clampAffinity(NaN)` = `NaN`

**影响链:**
```
recordChange(npcId, npc, NaN_delta, ...)
→ newAffinity = clampAffinity(affinity + NaN) = NaN
→ npcSys.setAffinity(npcId, NaN) → FIX-001 拦截 → return false
→ npc.affinity = NaN  // 本地副本被设为NaN
→ changeHistory 记录 { previousAffinity: 50, newAffinity: NaN, ... }
```

**结论:** NaN 不会持久化到 NPCSystem（被 FIX-001 拦截），但 changeHistory 中会记录 NaN 值。NPCAffinitySystem 内部的 bondSkillCooldowns 等依赖 changeHistory 的逻辑可能受影响。

**优先级: P2** — 影响有限，NaN来源需外部传入。

---

### ND-2: getNPCSystem registry依赖 (P2)

**发现:** FIX-007 添加的 `getNPCSystem()` 依赖 registry 中注册了 'npc'：
```ts
private getNPCSystem(): import('./NPCSystem').NPCSystem | null {
```

engine-extended-deps.ts:172 已注册 `r.register('npc', systems.npcSystem)`。

**风险:** 如果 NPCAffinitySystem 在 engine 初始化之前被使用（单元测试中可能发生），registry 中无 'npc'，getNPCSystem() 返回 null。

**优先级: P2** — 仅影响测试环境，生产环境 registry 必定已初始化。

---

### ND-3: 双好感度系统并存 (P1)

**发现:** NPCFavorabilitySystem 和 NPCAffinitySystem 功能高度重叠：

| 功能 | NPCFavorabilitySystem | NPCAffinitySystem |
|------|----------------------|-------------------|
| dialog好感度 | ✅ addFromDialog | ✅ gainFromDialog |
| gift好感度 | ✅ addFromGift | ✅ gainFromGift |
| quest好感度 | ✅ addFromQuest | ✅ gainFromQuestComplete |
| trade好感度 | ✅ addFromTrade | ✅ gainFromTrade |
| battle好感度 | ✅ addFromBattleAssist | ✅ gainFromBattleAssist |
| 衰减 | ✅ applyDecay | ✅ gainFromTimeDecay |
| 羁绊技能 | ✅ activateBondSkill | ✅ useBondSkill |
| 序列化 | serialize/deserialize | exportSaveData/importSaveData |

如果两个系统同时被调用（例如 UI 层同时触发两个系统的好感度计算），好感度会被**双重计算**。

**关键问题:** 需要确认引擎中实际使用的是哪个系统。从 engine-extended-deps.ts 来看，只注册了 NPCSystem，两个好感度子系统都未注册到 registry。

**优先级: P1** — 架构设计问题，可能导致好感度翻倍。

---

### ND-4: NPCGiftSystem dailyGiftCount NaN (P1, R1 CH-010 遗留)

**发现:**
```ts
if (this.config.dailyGiftLimit > 0 && this.dailyGiftCount >= this.config.dailyGiftLimit) {
```
`NaN >= 10` = `false` → 绕过日限购

**攻击路径:** 通过 importSaveData 注入 `{ dailyGiftCount: NaN }` → 无限赠送

**优先级: P1** — 攻击面较窄（需存档注入），但违反 BR-21。

---

### ND-5: NPC子系统序列化方法不一致 (P2)

**发现:** NPC子系统序列化方法命名不统一：

| 子系统 | 序列化 | 反序列化 |
|--------|--------|----------|
| NPCSystem | exportSaveData | importSaveData |
| NPCFavorabilitySystem | serialize | deserialize |
| NPCAffinitySystem | exportSaveData | importSaveData |
| NPCGiftSystem | exportSaveData | importSaveData |
| NPCPatrolSystem | exportSaveData | importSaveData |
| NPCSpawnSystem | serialize | deserialize |
| NPCTrainingSystem | serialize | deserialize |

两套命名约定并存（export/import vs serialize/deserialize）。在 engine-save 接入时需要处理这种不一致。

**优先级: P2** — 不影响功能，但增加维护成本。

---

## 挑战结果汇总

| 类别 | 数量 | 说明 |
|------|------|------|
| FIX穿透验证 | 6/6 通过 | FIX-001~007穿透完整 |
| 新P0发现 | 0 | 无新P0 |
| 新P1发现 | 2 | ND-3(双系统并存), ND-4(dailyGiftCount NaN) |
| 新P2发现 | 3 | ND-1(clampAffinity), ND-2(registry依赖), ND-5(命名不一致) |
| 遗留P0 | 2 | F-0-ARCH-N01(存档缺失), F-0-ARCH-N02(读档缺失) |

**R2判定: 需修复架构级P0 (engine-save接入NPC) 方可封版**
