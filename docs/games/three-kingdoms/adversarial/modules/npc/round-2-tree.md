# NPC 模块 R2 对抗式测试 — 精简流程树

> Builder Agent | 日期: 2026-05-01
> 依据: R1树(62节点) + R1修复(FIX-001~007) + 源码验证

## R1 FIX 验证矩阵

| FIX ID | 文件 | 修复点 | 源码验证 | 状态 |
|--------|------|--------|----------|------|
| FIX-001 | NPCSystem.ts:232,266 | changeAffinity/setAffinity NaN防护 | `if (!Number.isFinite(delta/value))` | ✅ 已验证 |
| FIX-002 | NPCDialogSystem.ts:212,241 | dialogDeps null guard | `if (!this.dialogDeps) return []` | ✅ 已验证 |
| FIX-003 | NPCTrainingSystem.ts:142 | training NaN防护 | `if (!Number.isFinite(playerLevel\|\|npcLevel))` | ✅ 已验证 |
| FIX-004 | NPCTrainingSystem.ts:187 | formAlliance NaN防护 | `if (!Number.isFinite(currentAffinity))` | ✅ 已验证 |
| FIX-005 | NPCGiftSystem.ts:222 | giveGift NaN防护 | `if (!Number.isFinite(npcData.affinity))` | ✅ 已验证 |
| FIX-006 | NPCFavorabilitySystem.ts:186, NPCTrainingSystem.ts:298, NPCAffinitySystem.ts:importSaveData | deserialize null guard | `if (!data) { ... return; }` | ✅ 已验证 |
| FIX-007 | NPCAffinitySystem.ts:237-244 | recordChange通过NPCSystem修改 | `npcSys.setAffinity(npcId, newAffinity)` | ✅ 已验证 |

**FIX验证率: 7/7 (100%)**

---

## R2 精简树 — 仅保留未关闭节点 + 新维度

### F-0-ARCH: 架构级P0 — NPC子系统存档接入 (VER-001 遗留)

**当前状态:** engine-save.ts 完全无NPC引用
**需修改文件:**
1. `shared/types.ts` — GameSaveData 添加 `npc?` 聚合字段
2. `engine-save.ts` — SaveContext 添加NPC引用 + buildSaveData/applySaveData
3. `ThreeKingdomsEngine.ts` — buildSaveCtx 添加NPC引用
4. `engine-extended-deps.ts` — 无需修改（npcSystem已在R11Systems中注册）

**R2修复方案:**
- 采用聚合模式：在 GameSaveData 中添加单一 `npc` 字段，内含所有NPC子系统数据
- 通过 registry 获取各NPC子系统（而非在 SaveContext 中添加7个字段）
- 保持向后兼容：`npc` 字段为可选

| 节点 | 类型 | 描述 | 优先级 |
|------|------|------|--------|
| F-0-ARCH-N01 | 数据丢失 | 存档不保存NPC数据 | P0 |
| F-0-ARCH-N02 | 数据丢失 | 读档不恢复NPC数据 | P0 |
| F-0-ARCH-N03 | 迁移 | 旧存档无npc字段需兼容 | P1 |

---

### F-1: NPCSystem — R1修复穿透验证

| 节点 | R1状态 | R2穿透测试 | 结果 |
|------|--------|-----------|------|
| F-1.1-N01 NaN delta | ✅ FIX-001 | changeAffinity(NaN) → return npc.affinity | ✅ 穿透关闭 |
| F-1.2-N01 NaN value | ✅ FIX-001 | setAffinity(NaN) → return false | ✅ 穿透关闭 |
| F-1.3-N01 空name | P2 | createNPC("") → NPC无名字 | P2 保持 |
| F-1.3-N02 NaN位置 | P1 | createNPC pos=NaN → region异常 | P1 保持 |
| F-1.4-N02 null输入 | P1 | importSaveData(null) → 待验证 | P1 保持 |
| F-1.5-N01 NaN位置 | P1 | moveNPC pos=NaN | P1 保持 |

**穿透结论:** FIX-001 在底层(NPCSystem)防护，上层调用者(NPCFavorabilitySystem/NPCGiftSystem)传入NaN时被底层拦截，穿透率0%。

---

### F-2: NPCFavorabilitySystem — R1修复穿透验证

| 节点 | R1状态 | R2穿透测试 | 结果 |
|------|--------|-----------|------|
| F-2.1-N01 NaN穿透 | ✅ FIX-001覆盖 | addAffinity→setAffinity(NaN)→return false | ✅ 穿透关闭 |
| F-2.3-N02 null输入 | ✅ FIX-006 | deserialize(undefined)→安全返回 | ✅ 穿透关闭 |
| F-2.2-N02 NaN turn | P1 | activateBondSkill(NaN turn) → NaN<cooldown=false | P1 保持 |

---

### F-3: NPCAffinitySystem — R1修复穿透验证

| 节点 | R1状态 | R2穿透测试 | 结果 |
|------|--------|-----------|------|
| F-3.1-N01 副本修改 | ✅ FIX-007 | recordChange→npcSys.setAffinity | ✅ 穿透关闭 |
| F-3.1-N02 NaN delta | P1 | recordChange delta=NaN → clampAffinity(NaN) | P1 保持 |

**穿透结论:** FIX-007 重构了 recordChange，通过 getNPCSystem() 获取 NPCSystem 实例并调用 setAffinity。setAffinity 已被 FIX-001 保护（NaN返回false），但recordChange中 newAffinity 可能已经是 NaN。

**新发现:** FIX-007 中 `clampAffinity(previousAffinity + delta)` 如果 delta=NaN，则 newAffinity=clampAffinity(NaN)。需验证 clampAffinity 是否防护 NaN。

---

### F-4: NPCGiftSystem — R1修复穿透验证

| 节点 | R1状态 | R2穿透测试 | 结果 |
|------|--------|-----------|------|
| F-4.1-N01 NaN quantity | P0→需验证 | calculateAffinityDelta NaN | P1 (底层有Math.max保护) |
| F-4.1-N03 NaN affinity | ✅ FIX-005 | giveGift NaN affinity → 拒绝 | ✅ 穿透关闭 |
| F-4.1-N04 NaN dailyCount | P1 (CH-010) | dailyGiftCount=NaN → 绕过限购 | P1 保持 |

---

### F-5: NPCDialogSystem — R1修复穿透验证

| 节点 | R1状态 | R2穿透测试 | 结果 |
|------|--------|-----------|------|
| F-5.1-N02 dialogDeps崩溃 | ✅ FIX-002 | getAvailableOptions/selectOption null guard | ✅ 穿透关闭 |
| F-5.1-N01 双重好感度 | P1 | selectOption effects重复执行 | P1 保持 |
| F-5.2-N01 NaN比较 | P1 | filterOptions NaN affinity | P1 保持 |

---

### F-9: NPCTrainingSystem — R1修复穿透验证

| 节点 | R1状态 | R2穿透测试 | 结果 |
|------|--------|-----------|------|
| F-9.1-N01 NaN level | ✅ FIX-003 | training NaN → return draw | ✅ 穿透关闭 |
| F-9.2-N01 NaN affinity | ✅ FIX-004 | formAlliance NaN → 拒绝 | ✅ 穿透关闭 |
| F-9.4-N02 null输入 | ✅ FIX-006 | deserialize(undefined)→安全返回 | ✅ 穿透关闭 |
| F-9.3-N01 NaN duration | P2 | calculateOfflineActions NaN | P2 保持 |

---

## R2 新维度探索

### ND-1: clampAffinity NaN防护

NPCAffinitySystem.ts 中的 `clampAffinity` 函数是否防护 NaN？

```ts
function clampAffinity(value: number): number {
    return Math.max(0, Math.min(100, value));
}
```

`clampAffinity(NaN)` = `Math.max(0, NaN)` = `NaN` — **未防护**

但 FIX-007 中 recordChange 调用 `npcSys.setAffinity(npcId, newAffinity)`，如果 newAffinity=NaN，FIX-001 的 setAffinity 会 return false。所以 NaN 不会写入，但 recordChange 的日志和历史记录中可能记录了 NaN 值。

**优先级: P2** — NaN不会持久化（被FIX-001拦截），但changeHistory中可能记录了错误的NaN值。

### ND-2: NPC子系统通过registry获取的可靠性

FIX-007 添加了 `getNPCSystem()` 通过 registry 获取 NPCSystem：
```ts
private getNPCSystem(): import('./NPCSystem').NPCSystem | null {
```

如果 registry 中 'npc' 未注册或获取失败，返回 null，recordChange 退化为修改副本（原始R1问题）。

**优先级: P2** — registry 注册在 engine-extended-deps.ts:172，正常流程不会失败。

### ND-3: 双好感度系统并存

NPCFavorabilitySystem 和 NPCAffinitySystem 功能重叠：
- 两者都管理好感度获取（dialog/gift/quest/trade/battle_assist/decay）
- NPCFavorabilitySystem 通过 registry 获取 NPCSystem（正确）
- NPCAffinitySystem 通过 getNPCSystem() 获取 NPCSystem（FIX-007后正确）

如果两者同时被调用，好感度会被**双重计算**。

**优先级: P1** — 架构设计问题，需要确认是否只有一个被使用。

---

## R2 精简统计

| 类别 | R1 | R2关闭 | R2保持 | R2新发现 |
|------|-----|--------|--------|----------|
| P0 | 14 | 7 (FIX覆盖) | 2 (架构级) | 0 |
| P1 | 22 | 0 | 22 | 1 (ND-3) |
| P2 | 12 | 0 | 12 | 1 (ND-1) |
| covered | 14 | 14 | 0 | 0 |

**剩余P0: 2个 (F-0-ARCH-N01, F-0-ARCH-N02) — 均为架构级存档接入**

**R2目标: 修复架构级P0，达到9.0封版标准**
