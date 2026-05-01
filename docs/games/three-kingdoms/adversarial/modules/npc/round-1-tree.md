# NPC 模块 R1 对抗式测试 — 流程树

> Builder Agent | 版本: v1.9 规则 | 日期: 2026-05-01
> 模块: `src/games/three-kingdoms/engine/npc/`
> 源文件: 16个 | 总行数: ~4,233行

## 模块概览

| 子系统 | 文件 | 行数 | 公开API数 | 序列化 |
|--------|------|------|-----------|--------|
| NPCSystem | NPCSystem.ts | 354 | 15 | exportSaveData/importSaveData |
| NPCFavorabilitySystem | NPCFavorabilitySystem.ts | 225 | 16 | serialize/deserialize |
| NPCAffinitySystem | NPCAffinitySystem.ts | 248 | 20 | exportSaveData/importSaveData |
| NPCGiftSystem | NPCGiftSystem.ts | 389 | 16 | exportSaveData/importSaveData |
| GiftPreferenceCalculator | GiftPreferenceCalculator.ts | 307 | 7 | N/A (纯计算) |
| NPCDialogSystem | NPCDialogSystem.ts | 398 | 12 | N/A (会话态) |
| NPCPatrolSystem | NPCPatrolSystem.ts | 369 | 20 | exportSaveData/importSaveData |
| NPCSpawnSystem | NPCSpawnSystem.ts | 242 | 14 | serialize/deserialize |
| NPCSpawnManager | NPCSpawnManager.ts | 260 | 12 | exportSaveData/importSaveData |
| NPCMapPlacer | NPCMapPlacer.ts | 449 | 10 | N/A (缓存态) |
| PatrolPathCalculator | PatrolPathCalculator.ts | 185 | 2 | N/A (纯计算) |
| NPCTrainingSystem | NPCTrainingSystem.ts | 365 | 18 | serialize/deserialize |
| NPCTrainingTypes | NPCTrainingTypes.ts | 257 | N/A (类型) | N/A |
| PatrolConfig | PatrolConfig.ts | 21 | N/A (常量) | N/A |

**总计公开API: ~162个**

---

## F-0: 跨系统链路验证

### F-0.1: 保存/加载覆盖扫描 [BR-14/15/16]

**发现: NPC子系统完全缺失于 engine-save.ts 的 buildSaveData / SaveContext / GameSaveData**

| 检查点 | 状态 | 说明 |
|--------|------|------|
| GameSaveData 接口 | ❌ 无NPC字段 | NPC数据不在存档类型中 |
| SaveContext 接口 | ❌ 无NPC引用 | engine-save.ts 不引用任何NPC子系统 |
| buildSaveData() | ❌ 未调用NPC序列化 | NPC数据不会被保存 |
| toIGameState() | ❌ 未包含NPC数据 | 加载时无法恢复NPC状态 |
| applyLoadedState() | ❌ 未调用NPC反序列化 | NPC子系统状态在加载后丢失 |
| engine-extended-deps.ts | ⚠️ 仅注册npcSystem | 其他7个NPC子系统未注册 |

**严重度: P0 — 玩家所有NPC交互进度（好感度、赠送、结盟、巡逻、切磋）在存档/读档后全部丢失**

### F-0.2: 双系统并存分析 — NPCFavorabilitySystem vs NPCAffinitySystem

两个系统功能高度重叠：
- 都管理好感度获取（dialog/gift/quest/trade/battle_assist/decay）
- 都管理羁绊技能和冷却
- 都有序列化方法（但方法名不同：serialize vs exportSaveData）
- 都有可视化方法
- NPCFavorabilitySystem 通过 registry 获取 NPCSystem
- NPCAffinitySystem 通过构造函数接收 NPCData（直接修改对象属性）

**风险: 双系统同时存在可能导致好感度被双重计算、状态不一致**

### F-0.3: 引擎注册缺失

engine-extended-deps.ts 仅注册了 `npcSystem`，以下子系统未注册到 registry：
- npcFavorability / npcAffinity — NPCFavorabilitySystem/NPCAffinitySystem 无法被其他系统通过 registry 获取
- npcGift — NPCGiftSystem 内部通过 registry 获取 NPCSystem
- npcDialog — NPCDialogSystem 依赖注入 dialogDeps
- npcPatrol — NPCPatrolSystem 内部持有 NPCSpawnManager
- npcSpawn — NPCSpawnSystem 未注册
- npcMapPlacer — NPCMapPlacer 未注册
- npcTraining — NPCTrainingSystem 未注册

---

## F-1: NPCSystem (15 APIs)

### F-1.1: changeAffinity(id, delta) — 数值安全
| 节点 | 类型 | 描述 | 优先级 |
|------|------|------|--------|
| F-1.1-N01 | NaN | delta=NaN → npc.affinity=NaN，Math.max(0, Math.min(100, NaN))=NaN | P0 |
| F-1.1-N02 | Infinity | delta=Infinity → Math.min(100, Infinity)=100，但需验证 | P1 |
| F-1.1-N03 | 负值 | delta=-999 → Math.max(0, affinity-999)=0，正确 | covered |
| F-1.1-N04 | null id | id不存在 → return null，正确 | covered |

**源码验证 (NPCSystem.ts:277-290):**
```ts
npc.affinity = Math.max(0, Math.min(100, npc.affinity + delta));
```
- `delta=NaN` → `affinity + NaN = NaN` → `Math.max(0, Math.min(100, NaN))` = `Math.max(0, NaN)` = `NaN`
- **确认P0: NaN会穿透Math.max/Math.min防护**

### F-1.2: setAffinity(id, value) — 数值安全
| 节点 | 类型 | 描述 | 优先级 |
|------|------|------|--------|
| F-1.2-N01 | NaN | value=NaN → affinity=NaN | P0 |
| F-1.2-N02 | 负值 | value=-1 → Math.max(0,-1)=0，正确 | covered |
| F-1.2-N03 | 溢出 | value=999 → Math.min(100,999)=100，正确 | covered |

**源码验证 (NPCSystem.ts:299):**
```ts
npc.affinity = Math.max(0, Math.min(100, value));
```
- 同 F-1.1，NaN穿透

### F-1.3: createNPC(name, profession, position, options) — 参数验证
| 节点 | 类型 | 描述 | 优先级 |
|------|------|------|--------|
| F-1.3-N01 | 空name | name="" → 创建成功，NPC无名字 | P2 |
| F-1.3-N02 | NaN位置 | position={x:NaN, y:0} → region=getRegionAtPosition(NaN,0) | P1 |
| F-1.3-N03 | NaN好感度 | affinity=NaN → 存入NaN | P1 |

### F-1.4: exportSaveData / importSaveData — 序列化完整性
| 节点 | 类型 | 描述 | 优先级 |
|------|------|------|--------|
| F-1.4-N01 | 覆盖 | engine-save未调用，数据丢失 | P0 (F-0.1) |
| F-1.4-N02 | null输入 | importSaveData(null) → 崩溃 | P1 |

### F-1.5: moveNPC(id, newPosition) — 位置安全
| 节点 | 类型 | 描述 | 优先级 |
|------|------|------|--------|
| F-1.5-N01 | NaN位置 | newPosition={x:NaN,y:NaN} → region=NaN | P1 |

---

## F-2: NPCFavorabilitySystem (16 APIs)

### F-2.1: addAffinity 内部方法 — NaN传播
| 节点 | 类型 | 描述 | 优先级 |
|------|------|------|--------|
| F-2.1-N01 | NaN穿透 | gainConfig中NaN值 → delta=NaN → npcSys.setAffinity(id, NaN) | P0 |
| F-2.1-N02 | 依赖缺失 | deps.registry.get('npc')失败 → return null | P1 |

### F-2.2: activateBondSkill(npcId, currentTurn) — 冷却绕过
| 节点 | 类型 | 描述 | 优先级 |
|------|------|------|--------|
| F-2.2-N01 | 负数turn | currentTurn=-1 → cooldownEnd=5, -1<5, 被冷却阻挡 | P2 |
| F-2.2-N02 | NaN turn | currentTurn=NaN → NaN < cooldownEnd = false → 可激活 | P1 |

### F-2.3: serialize / deserialize — 完整性
| 节点 | 类型 | 描述 | 优先级 |
|------|------|------|--------|
| F-2.3-N01 | 覆盖 | engine-save未调用 | P0 (F-0.1) |
| F-2.3-N02 | null输入 | deserialize(undefined) → changeHistory=undefined → .push崩溃 | P0 |
| F-2.3-N03 | gainConfig丢失 | serialize不保存gainConfig，加载后重置为默认 | P1 |

---

## F-3: NPCAffinitySystem (20 APIs)

### F-3.1: recordChange — 直接修改NPCData
| 节点 | 类型 | 描述 | 优先级 |
|------|------|------|--------|
| F-3.1-N01 | 对象引用 | recordChange直接修改传入的NPCData.affinity，但getNPCById返回副本，修改副本无效 | P0 |
| F-3.1-N02 | NaN delta | delta=NaN → clampAffinity(NaN) → 需检查clampAffinity实现 | P1 |

**源码验证 (NPCAffinitySystem.ts:232-236):**
```ts
private recordChange(npcId, npc, delta, source, description) {
    const previousAffinity = npc.affinity;
    const newAffinity = clampAffinity(previousAffinity + delta);
    npc.affinity = newAffinity; // 修改的是传入的npc对象
```
- gainFromDialog等方法的调用方传入的npc是通过什么获取的？
- 如果是外部获取的NPCData副本，修改不会反映到NPCSystem内部
- **关键问题：NPCAffinitySystem.gainFrom*系列方法修改的NPCData是否是NPCSystem中的原始数据？**
- 从接口看 `gainFromDialog(npcId, npc: NPCData, bonus)` — npc由外部传入
- 如果外部通过 `npcSystem.getNPCById(id)` 获取，得到的是副本，修改无效
- **确认P0: 好感度变更可能丢失**

### F-3.2: useBondSkill(npcId, npc) — 冷却管理
| 节点 | 类型 | 描述 | 优先级 |
|------|------|------|--------|
| F-3.2-N01 | NaN currentTurn | currentTurn未设置时=0，bondSkillCooldowns.get返回undefined | P2 |

---

## F-4: NPCGiftSystem (16 APIs)

### F-4.1: giveGift(request) — 完整流程
| 节点 | 类型 | 描述 | 优先级 |
|------|------|------|--------|
| F-4.1-N01 | NaN quantity | quantity=NaN → calculateAffinityDelta中 item.baseAffinityValue * NaN = NaN | P0 |
| F-4.1-N02 | 负数quantity | quantity=-1 → baseValue为负 → Math.max(0, negative)=0 | P2 |
| F-4.1-N03 | NaN好感度 | npcData.affinity=NaN → NaN < minAffinityToGift = false → 绕过检查 | P0 |
| F-4.1-N04 | 日限购绕过 | dailyGiftCount=NaN → NaN >= dailyGiftLimit = false → 无限赠送 | P1 |

**源码验证 (NPCGiftSystem.ts:196-199):**
```ts
if (npcData.affinity < this.config.minAffinityToGift) {
```
- `NaN < 20` = `false` → 绕过好感度检查 [BR-21]

### F-4.2: calculateAffinityDelta — 数值计算
| 节点 | 类型 | 描述 | 优先级 |
|------|------|------|--------|
| F-4.2-N01 | NaN baseValue | item.baseAffinityValue=NaN → 全链NaN | P1 |
| F-4.2-N02 | 负数baseValue | baseAffinityValue=-5 → baseValue最终被Math.max(0, ...)保护 | P2 |
| F-4.2-N03 | 权重NaN | config.repeatDecayFactor=NaN → Math.pow(NaN, n)=NaN | P1 |

### F-4.3: exportSaveData / importSaveData
| 节点 | 类型 | 描述 | 优先级 |
|------|------|------|--------|
| F-4.3-N01 | 覆盖 | engine-save未调用 | P0 (F-0.1) |
| F-4.3-N02 | config丢失 | exportSaveData不保存config、items、preferences | P1 |

---

## F-5: NPCDialogSystem (12 APIs)

### F-5.1: selectOption(sessionId, optionId) — 效果执行
| 节点 | 类型 | 描述 | 优先级 |
|------|------|------|--------|
| F-5.1-N01 | 双重好感度 | option.effects中affinity_change被executeEffects记录到accumulatedEffects，又被dialogDeps.changeAffinity执行 | P1 |
| F-5.1-N02 | dialogDeps未设置 | dialogDeps未初始化 → getAffinity调用崩溃 | P0 |
| F-5.1-N03 | NaN好感度 | getAffinity返回NaN → NaN < requiredAffinity = false → 绕过限制 | P1 |

**源码验证 (NPCDialogSystem.ts:222-229):**
```ts
if (option.effects) {
    this.executeEffects(option.effects, session);
    for (const effect of option.effects) {
        if (effect.type === 'affinity_change') {
            this.dialogDeps.changeAffinity(session.npcId, effect.value as number);
        }
    }
}
```
- 如果 `this.dialogDeps` 未初始化（undefined），调用 `.changeAffinity` 会崩溃
- **确认P0: dialogDeps未设置时崩溃**

### F-5.2: filterOptions — 好感度比较
| 节点 | 类型 | 描述 | 优先级 |
|------|------|------|--------|
| F-5.2-N01 | NaN比较 | affinity=NaN → NaN < requiredAffinity = false → 显示所有选项 | P1 |

---

## F-6: NPCPatrolSystem (20 APIs)

### F-6.1: registerPatrolPath(path) — 参数验证
| 节点 | 类型 | 描述 | 优先级 |
|------|------|------|--------|
| F-6.1-N01 | 空路径点 | waypoints=[] → throw Error（有防护） | covered |
| F-6.1-N02 | NaN坐标 | waypoints=[{x:NaN,y:0},{x:0,y:0}] → 巡逻计算NaN | P1 |

### F-6.2: assignPatrol(npcId, pathId, options) — 边界检查
| 节点 | 类型 | 描述 | 优先级 |
|------|------|------|--------|
| F-6.2-N01 | startIndex越界 | startIndex=999 → return false（有防护） | covered |
| F-6.2-N02 | 负数direction | direction=-1 as any → 类型不匹配，TypeScript编译阻止 | P2 |

### F-6.3: exportSaveData / importSaveData
| 节点 | 类型 | 描述 | 优先级 |
|------|------|------|--------|
| F-6.3-N01 | 覆盖 | engine-save未调用 | P0 (F-0.1) |
| F-6.3-N02 | 路径不恢复 | importSaveData只恢复patrolStates，不恢复paths | P1 |

---

## F-7: NPCSpawnSystem (14 APIs)

### F-7.1: checkSpawnConditions — 条件评估
| 节点 | 类型 | 描述 | 优先级 |
|------|------|------|--------|
| F-7.1-N01 | NaN params | cond.params.minTurn=NaN → NaN比较 | P2 |
| F-7.1-N02 | 回调缺失 | spawnCallback未设置 → return fail | covered |

### F-7.2: serialize / deserialize
| 节点 | 类型 | 描述 | 优先级 |
|------|------|------|--------|
| F-7.2-N01 | 覆盖 | engine-save未调用 | P0 (F-0.1) |
| F-7.2-N02 | rules丢失 | serialize不保存rules | P1 |

---

## F-8: NPCSpawnManager (12 APIs)

### F-8.1: trySpawn — 刷新逻辑
| 节点 | 类型 | 描述 | 优先级 |
|------|------|------|--------|
| F-8.1-N01 | deps未设置 | deps=null → return fail（有防护） | covered |
| F-8.1-N02 | NaN权重 | template.weight=NaN → totalWeight=NaN → random*NaN=NaN → 选择失败 | P1 |
| F-8.1-N03 | NPC创建失败 | createNPC返回null → return fail | covered |

### F-8.2: selectTemplateByWeight — 算法正确性
| 节点 | 类型 | 描述 | 优先级 |
|------|------|------|--------|
| F-8.2-N01 | 全零权重 | 所有模板weight=0 → totalWeight=0 → return templates[0]（有防护） | covered |
| F-8.2-N02 | 负数权重 | weight=-5 → totalWeight可能<=0 → return templates[0] | P2 |

---

## F-9: NPCTrainingSystem (18 APIs)

### F-9.1: training(npcId, playerLevel, npcLevel) — 数值安全
| 节点 | 类型 | 描述 | 优先级 |
|------|------|------|--------|
| F-9.1-N01 | NaN level | playerLevel=NaN → levelDiff=NaN → threshold=50+NaN*5=NaN → roll>=NaN=false | P0 |
| F-9.1-N02 | 负数level | playerLevel=-10 → levelDiff=-10 → threshold=0 → 总是lose | P2 |
| F-9.1-N03 | Infinity level | playerLevel=Infinity → threshold=Infinity → 总是win | P1 |

**源码验证 (NPCTrainingSystem.ts:321-325):**
```ts
private resolveTrainingOutcome(playerLevel, npcLevel) {
    const levelDiff = playerLevel - npcLevel;
    const roll = Math.random() * 100;
    const threshold = 50 + levelDiff * 5;
    if (roll >= threshold + 20) return 'lose';
    if (roll >= threshold) return 'draw';
    return 'win';
}
```
- `playerLevel=NaN` → `levelDiff=NaN` → `threshold=NaN` → `roll >= NaN` = `false` → 总是返回 'win'
- **确认P0: NaN输入导致切磋永远胜利**

### F-9.2: formAlliance(npcId, defId, currentAffinity, bonuses) — 前置条件
| 节点 | 类型 | 描述 | 优先级 |
|------|------|------|--------|
| F-9.2-N01 | NaN好感度 | currentAffinity=NaN → NaN < 80 = false → 绕过检查直接结盟 | P0 |
| F-9.2-N02 | 重复结盟 | 已结盟 → return fail（有防护） | covered |

**源码验证 (NPCTrainingSystem.ts:209-211):**
```ts
if (currentAffinity < ALLIANCE_REQUIRED_AFFINITY) {
    return { success: false, reason: ... };
}
```
- `NaN < 80` = `false` → 绕过好感度检查 [BR-21]

### F-9.3: calculateOfflineActions — 离线行为
| 节点 | 类型 | 描述 | 优先级 |
|------|------|------|--------|
| F-9.3-N01 | NaN duration | offlineDuration=NaN → Math.min(NaN, 50)=NaN → actionCount=NaN → for循环不执行 | P2 |
| F-9.3-N02 | 负数duration | offlineDuration=-1 → actionCount=Math.min(-1/300, 50) → 负数 → 不执行 | covered |
| F-9.3-N03 | 空NPC列表 | npcs=[] → return empty（有防护） | covered |

### F-9.4: serialize / deserialize
| 节点 | 类型 | 描述 | 优先级 |
|------|------|------|--------|
| F-9.4-N01 | 覆盖 | engine-save未调用 | P0 (F-0.1) |
| F-9.4-N02 | null输入 | deserialize(undefined) → trainingRecords=undefined → .filter崩溃 | P0 |
| F-9.4-N03 | 冷却丢失 | serialize不保存trainingCooldowns | P1 |

---

## F-10: NPCMapPlacer (10 APIs)

### F-10.1: computeMapDisplays — 空依赖
| 节点 | 类型 | 描述 | 优先级 |
|------|------|------|--------|
| F-10.1-N01 | deps未设置 | placerDeps未初始化 → getVisibleNPCs()崩溃 | P0 |
| F-10.1-N02 | NaN坐标 | NPC position含NaN → pixelPos=NaN → 过滤失效 | P2 |

### F-10.2: getNPCsInViewport — 视口计算
| 节点 | 类型 | 描述 | 优先级 |
|------|------|------|--------|
| F-10.2-N01 | NaN zoom | zoom=NaN → px=NaN → NaN >= -margin = false → 所有NPC被过滤 | P2 |

---

## F-11: GiftPreferenceCalculator (7 APIs)

### F-11.1: calculateAffinityDelta — 完整计算链
| 节点 | 类型 | 描述 | 优先级 |
|------|------|------|--------|
| F-11.1-N01 | NaN baseValue | baseAffinityValue=NaN → 全链NaN → Math.max(0,NaN)=NaN | P1 |
| F-11.1-N02 | 零quantity | quantity=0 → baseValue=0 → return 0 | P2 |

---

## F-12: PatrolPathCalculator (2 APIs)

### F-12.1: updateSinglePatrol — 移动计算
| 节点 | 类型 | 描述 | 优先级 |
|------|------|------|--------|
| F-12.1-N01 | NaN speed | path.speed=NaN → moveDistance=NaN → NaN >= distance = false → 无限循环 | P1 |
| F-12.1-N02 | 零speed | path.speed=0 → moveDistance=0 → 永远不移动 | P2 |
| F-12.1-N03 | NaN dt | dt=NaN → moveDistance=NaN → 同N01 | P1 |

---

## 统计

| 类别 | 数量 |
|------|------|
| 总节点数 | 62 |
| P0 节点 | 14 |
| P1 节点 | 22 |
| P2 节点 | 12 |
| covered | 14 |
| 跨系统链路 | 3 (F-0.1/0.2/0.3) |

### P0 汇总

| ID | 子系统 | 节点 | 描述 |
|----|--------|------|------|
| P0-001 | 跨系统 | F-0.1 | NPC子系统完全缺失于engine-save，存档/读档后数据丢失 |
| P0-002 | 跨系统 | F-0.2 | 双好感度系统并存，可能双重计算 |
| P0-003 | NPCSystem | F-1.1-N01 | changeAffinity delta=NaN穿透Math.max/min |
| P0-004 | NPCSystem | F-1.2-N01 | setAffinity value=NaN穿透Math.max/min |
| P0-005 | NPCFavorability | F-2.1-N01 | gainConfig含NaN → setAffinity(id, NaN) |
| P0-006 | NPCFavorability | F-2.3-N02 | deserialize(undefined) → changeHistory.push崩溃 |
| P0-007 | NPCAffinity | F-3.1-N01 | gainFrom*修改NPCData副本，好感度变更丢失 |
| P0-008 | NPCGift | F-4.1-N01 | quantity=NaN → calculateAffinityDelta返回NaN |
| P0-009 | NPCGift | F-4.1-N03 | affinity=NaN绕过好感度检查 [BR-21] |
| P0-010 | NPCDialog | F-5.1-N02 | dialogDeps未初始化时selectOption崩溃 |
| P0-011 | NPCTraining | F-9.1-N01 | playerLevel=NaN → 切磋永远胜利 |
| P0-012 | NPCTraining | F-9.2-N01 | currentAffinity=NaN绕过结盟好感度检查 [BR-21] |
| P0-013 | NPCTraining | F-9.4-N02 | deserialize(undefined) → .filter崩溃 |
| P0-014 | NPCMapPlacer | F-10.1-N01 | placerDeps未初始化时computeMapDisplays崩溃 |
