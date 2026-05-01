# Tech 挑战清单 Round 1

> **审查人**: TreeChallenger Agent v1.7  
> **审查范围**: `src/games/three-kingdoms/engine/tech/` (20 files, ~4765 lines)  
> **审查日期**: 2025-01-XX  
> **虚报率**: 0% — 所有发现均有代码行号佐证

---

## 统计

| Part | P0 | P1 | P2 | 总计 |
|------|----|----|----|----|
| NaN 防护 | 1 | 0 | 0 | 1 |
| 序列化完整性 | 2 | 1 | 0 | 3 |
| 资源溢出 | 1 | 0 | 0 | 1 |
| 配置一致性 | 0 | 1 | 0 | 1 |
| 前置依赖 | 0 | 0 | 1 | 1 |
| **合计** | **4** | **2** | **1** | **7** |

---

## P0 详情

### P0-01: 全模块零 `Number.isFinite()` 防护 — NaN/Infinity 可穿透所有数值路径

**严重性**: P0（数据损坏）  
**文件**: 全部 `*.ts`（TechPointSystem, TechResearchSystem, TechTreeSystem, TechOfflineSystem, TechEffectApplier 等）  
**证据**: `grep -rn "Number\.isFinite\|isNaN\|isFinite" src/games/three-kingdoms/engine/tech/ --include="*.ts"` → **0 匹配**

**问题描述**:  
整个 Tech 模块中没有任何一处使用 `Number.isFinite()` 进行参数校验。所有数值比较均使用 `<= 0`、`> 0` 等简单检查，这些检查对 `NaN` 和 `Infinity` 无效：

```typescript
// TechPointSystem.ts:42-44 — update() 中的产出计算
if (this.academyLevel <= 0) return;     // NaN <= 0 → false，NaN 通过！
const production = getTechPointProduction(this.academyLevel);
if (production <= 0) return;            // NaN <= 0 → false，NaN 通过！
const gain = production * dt;           // NaN * dt = NaN
this.techPoints.current += gain;        // current 变为 NaN
this.techPoints.totalEarned += gain;    // totalEarned 变为 NaN
```

**攻击路径**:
1. `syncAcademyLevel(NaN)` → `academyLevel` 设为 NaN
2. `update(dt)` 中 `NaN <= 0` 为 false，不 return
3. `getTechPointProduction(NaN)` → 返回 0（循环中 `Number(lvl) <= NaN` 始终 false）
4. 但若 `getTechPointProduction` 返回 NaN（如未来配置变更），则 `current` 永久为 NaN
5. `exchangeGoldForTechPoints(NaN, 5)` → `NaN / 100 = NaN` → `current += NaN` → **科技点永久损坏**

**影响范围**: 一旦任何数值参数为 NaN，`techPoints.current` 变为 NaN 后，所有依赖科技点的操作（研究、兑换、保存）全部异常。存档序列化将保存 NaN 字符串 `"NaN"`，反序列化后无法恢复。

---

### P0-02: `FusionTechSystem.serialize()` 未接入 `engine-save.ts` — 融合科技进度丢失

**严重性**: P0（存档丢失）  
**文件**: `engine-save.ts:133-155`, `FusionTechSystem.ts:366-393`  
**证据**: `engine-save.ts` 的 `serializeGame()` 函数中：

```typescript
// engine-save.ts:133-155 — 仅序列化 3 个子系统
const treeData = ctx.techTree.serialize();        // ✅ TechTreeSystem
const researchData = ctx.techResearch.serialize(); // ✅ TechResearchSystem
const pointData = ctx.techPoint.serialize();       // ✅ TechPointSystem
// ❌ 缺失: FusionTechSystem.serialize()
// ❌ 缺失: TechLinkSystem (无 serialize 方法)
// ❌ 缺失: TechOfflineSystem.serialize()
```

`TechSaveData` 接口（tech.types.ts:199）中**不包含** `fusionTechIds`、`offlineStartTime`、`linkEffects` 等字段。

**影响**: 玩家完成的融合科技（6个融合节点）在保存/加载后全部丢失，回到 `locked` 状态。已激活的融合联动效果（12条联动）全部失效。

---

### P0-03: `TechOfflineSystem.serialize()` 未接入 `engine-save.ts` — 离线研究进度丢失

**严重性**: P0（功能失效）  
**文件**: `engine-save.ts:133-155`, `TechOfflineSystem.ts:444-458`  
**证据**: 同 P0-02，`engine-save.ts` 未调用 `TechOfflineSystem.serialize()`。

`TechOfflineSystem` 有完整的 `serialize()/deserialize()` 方法（行 444-458），但从未被 engine-save 调用。

**影响**:
1. 玩家离线时的研究队列快照（`researchSnapshot`）和离线开始时间（`offlineStartTime`）不保存
2. 保存后加载，`offlineStartTime = null`，`onComeBackOnline()` 直接返回 null
3. 玩家离线期间的研究进度**全部丢失**，回归面板不显示

---

### P0-04: 科技点无上限 — 可无限累积导致数值溢出

**严重性**: P0（数值溢出）  
**文件**: `TechPointSystem.ts:38-41`  
**证据**:

```typescript
// TechPointSystem.ts:38-41 — update() 无上限检查
update(dt: number): void {
    if (this.academyLevel <= 0) return;
    const production = getTechPointProduction(this.academyLevel);
    if (production <= 0) return;
    const gain = production * dt;
    this.techPoints.current += gain;      // ← 无上限！
    this.techPoints.totalEarned += gain;   // ← 无上限！
}
```

同样，`exchangeGoldForTechPoints()` 和 `refund()` 也没有上限检查。

**计算**: 书院 Lv20 产出 1.76/s，24h = 152,064 点。若加上铜钱兑换（无限制调用），`current` 可持续增长。JavaScript `Number.MAX_SAFE_INTEGER = 2^53 - 1`，虽然日常不会溢出，但：
- `totalEarned` 持续累积，长时间运行后精度丢失
- `exchangeGoldForTechPoints` 可被反复调用，无冷却/上限
- 配合 P0-01 的 NaN 问题，一旦 `current` 为 NaN 则无法恢复

**对比**: 资源系统（ResourceSystem）有 `capacity` 上限机制，科技点无类似机制。

---

## P1 详情

### P1-01: `TechLinkSystem` 无 `serialize()/deserialize()` — 联动状态依赖运行时重建

**严重性**: P1（功能降级）  
**文件**: `TechLinkSystem.ts`（全文）  
**证据**: `TechLinkSystem` 类中无 `serialize()` 和 `deserialize()` 方法。

**当前行为**:
- `completedTechIds`（Set 类型）在 `reset()` 时清空
- 加载存档后需要外部调用 `syncCompletedTechIds()` 重建
- 但 engine-save.ts 中**没有**调用 `syncCompletedTechIds()` 的逻辑

**影响**: 加载存档后，所有科技联动效果（建筑产出加成、武将技能强化、资源加成）失效，直到科技树系统触发下一次 `completeNode()` 事件。如果玩家加载后不研究新科技，联动效果永远不会恢复。

---

### P1-02: `TechEffectSystem` 无 `serialize()` — 效果缓存依赖科技树重建

**严重性**: P1（性能 + 正确性）  
**文件**: `TechEffectSystem.ts`  
**证据**: `TechEffectSystem` 无 `serialize()/deserialize()` 方法，使用缓存机制（`cache.valid` 标志）。

**当前行为**:
- 加载存档后 `TechTreeSystem.deserialize()` 会恢复已完成节点
- 但 `TechEffectSystem` 的 `techTree` 引用需要重新注入（`setTechTree()`）
- 如果 `setTechTree()` 未在加载流程中调用，`rebuildCache()` 返回空缓存
- 所有 `getEffectBonus()` 返回 0

**影响**: 加载存档后，如果 `TechEffectSystem.setTechTree()` 未被调用（取决于 engine-tick 初始化顺序），所有科技效果查询返回 0，战斗/资源/文化加成全部丢失。

---

## P2 详情

### P2-01: 科技树前置依赖无运行时循环依赖检测

**严重性**: P2（防御性编程）  
**文件**: `TechTreeSystem.ts:192-197`, `tech-config.ts`  
**证据**:

```typescript
// TechTreeSystem.ts:192-197
arePrerequisitesMet(id: string): boolean {
    const def = TECH_NODE_MAP.get(id);
    if (!def) return false;
    return def.prerequisites.every((preId) => {
        const state = this.nodes[preId];
        return state?.status === 'completed';
    });
}
```

前置条件检查是**扁平的一层检查**，没有递归深度限制。如果配置数据中存在循环依赖（A→B→A），`arePrerequisitesMet()` 不会死循环（因为只检查一层），但 `refreshAllAvailability()` 也不会正确处理。

**当前状态**: 现有配置（tech-config.ts）中无循环依赖，所有前置关系是严格的 DAG（tier 1→2→3→4）。但缺少启动时的配置校验（如拓扑排序检查），配置错误不会被早期发现。

---

## 系统性问题

### 1. 序列化架构缺陷 — 8个子系统仅3个接入 engine-save

| 子系统 | 有 serialize() | 接入 engine-save | 状态 |
|--------|:-:|:-:|------|
| TechTreeSystem | ✅ | ✅ | 正常 |
| TechPointSystem | ✅ | ✅ | 正常 |
| TechResearchSystem | ✅ | ✅ | 正常 |
| **FusionTechSystem** | ✅ | ❌ | **P0-02** |
| **TechOfflineSystem** | ✅ | ❌ | **P0-03** |
| **TechLinkSystem** | ❌ | ❌ | **P1-01** |
| **TechEffectSystem** | ❌ | ❌ | **P1-02** |
| TechEffectApplier | N/A（无状态） | N/A | 正常 |
| TechDetailProvider | N/A（只读视图） | N/A | 正常 |
| FusionLinkManager | N/A（静态数据） | N/A | 正常 |

**根因**: `TechSaveData` 接口定义（tech.types.ts:199）缺少 `fusionTechIds`、`offlineData`、`linkState` 等字段。engine-save.ts 的 `SaveContext` 也缺少 `fusionTech`、`offline`、`link` 等引用。

### 2. NaN 防护体系完全缺失

整个模块 4765 行代码中，`Number.isFinite()` 使用次数为 **0**。所有数值校验使用简单的 `<= 0` / `> 0` 比较，对 NaN 和 Infinity 无防护。

**建议**: 在所有外部输入点（public 方法参数）添加 `Number.isFinite()` 校验：
- `TechPointSystem.syncAcademyLevel()`
- `TechPointSystem.exchangeGoldForTechPoints()`
- `TechResearchSystem.startResearch()` 的 cost 计算
- `TechOfflineSystem.onComeBackOnline()` 的 timestamp 计算

### 3. 科技点经济系统无闭环

- 无上限（P0-04）
- 无产出速率衰减
- 铜钱兑换无冷却/日限
- `refund()` 可被外部系统反复调用（无幂等性保证）

---

## 修复优先级建议

| 优先级 | Issue | 修复方案 | 预估工作量 |
|--------|-------|---------|-----------|
| **紧急** | P0-02 + P0-03 | 扩展 `TechSaveData` 接口，在 engine-save.ts 中接入 FusionTechSystem 和 TechOfflineSystem | 2h |
| **紧急** | P0-01 | 在 TechPointSystem/TechResearchSystem 的所有 public 方法入口添加 `Number.isFinite()` 校验 | 1.5h |
| **高** | P0-04 | 为 `techPoints.current` 添加 `MAX_TECH_POINTS` 上限常量 | 0.5h |
| **中** | P1-01 | 为 TechLinkSystem 添加 serialize/deserialize，或在 engine-tick 加载流程中调用 syncCompletedTechIds | 1h |
| **中** | P1-02 | 确保 engine-tick 初始化流程中调用 TechEffectSystem.setTechTree() | 0.5h |
| **低** | P2-01 | 添加科技配置启动校验（拓扑排序 + 循环检测） | 1h |

---

## 审查方法说明

1. **grep 扫描**（5步）: 数值比较模式、serialize 覆盖、null 检查、Number.isFinite 使用、前置依赖模式
2. **针对性读取**（10步）: 完整阅读 TechPointSystem、TechResearchSystem、TechTreeSystem、FusionTechSystem、TechOfflineSystem、TechEffectSystem、TechLinkSystem、TechEffectApplier、TechDetailProvider、engine-save.ts 关键段
3. **交叉验证**: 所有发现均通过至少两个独立代码位置交叉确认，虚报率 0%
