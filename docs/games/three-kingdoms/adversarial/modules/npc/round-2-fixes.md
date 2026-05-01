# NPC 模块 R2 对抗式测试 — 修复报告

> Fixer Agent | 日期: 2026-05-01
> 依据: R1遗留 VER-001 (架构级P0)

## 修复总览

| FIX ID | 对应VER | 文件 | 修复类型 | 状态 |
|--------|---------|------|----------|------|
| FIX-008 | VER-001 | shared/types.ts, engine-save.ts, ThreeKingdomsEngine.ts | 架构级存档接入 | ✅ 已修复 |

---

## FIX-008: NPC子系统存档接入 (VER-001)

**严重度:** P0 — 数据丢失（玩家所有NPC交互进度在存档/读档后丢失）

### 修改文件清单

#### 1. `shared/types.ts` — GameSaveData 添加NPC字段

```ts
// 添加:
/** NPC系统数据（可选，v19.0+，FIX-008: R2 存档接入） */
npc?: import('../core/npc/npc.types').NPCSaveData;
```

#### 2. `engine/engine-save.ts` — 4处修改

**2a. SaveContext 添加NPC引用:**
```ts
/** NPC系统（可选，v19.0+，FIX-008: R2 存档接入） */
readonly npc?: import('./npc/NPCSystem').NPCSystem;
```

**2b. buildSaveData() 添加NPC序列化:**
```ts
// ── NPC系统 v19.0 (FIX-008: R2 存档接入) ──
npc: ctx.npc?.exportSaveData(),
```

**2c. toIGameState() 添加NPC数据传递:**
```ts
// ── NPC系统 v19.0 (FIX-008: R2 存档接入) ──
if (data.npc) subsystems.npc = data.npc;
```

**2d. fromIGameState() 添加NPC数据提取:**
```ts
// ── NPC系统 v19.0 (FIX-008: R2 存档接入) ──
npc: s.npc as import('../core/npc/npc.types').NPCSaveData | undefined,
```

**2e. applySaveData() 添加NPC反序列化:**
```ts
// ── NPC系统 v19.0 (FIX-008: R2 存档接入) ──
if (data.npc && ctx.npc) {
  ctx.npc.importSaveData(data.npc);
} else {
  gameLog.info('[Save] v19.0 存档迁移：无NPC数据，自动初始化默认NPC状态');
}
```

#### 3. `ThreeKingdomsEngine.ts` — buildSaveCtx 添加NPC引用

```ts
// ── NPC系统 v19.0 (FIX-008: R2 存档接入) ──
npc: this.r11.npcSystem,
```

### 设计决策

1. **聚合模式:** 只保存 NPCSystem 的核心数据（NPC列表），其他子系统（NPCFavorabilitySystem 等）的数据暂不接入。
   - 理由：其他子系统在引擎中未被使用（仅存在于 npc/ 目录内部和测试中），接入会增加不必要的复杂度。
   - NPCSystem.exportSaveData() 导出的是 NPCSaveData，包含所有 NPC 的完整状态（含好感度），足以恢复核心交互进度。

2. **可选字段:** `npc` 字段为可选，旧存档无此字段时自动初始化默认状态。

3. **通过 r11.npcSystem:** NPCSystem 已在 R11Systems 中注册和实例化，直接通过 `this.r11.npcSystem` 引用，无需修改 engine-extended-deps.ts。

### 编译验证

```
npx tsc --noEmit → 0 NPC相关错误（1个预存在的unification错误）
```

### 测试验证

```
vitest run src/games/three-kingdoms/engine/npc/__tests__/ → 27 suites, 788 tests passed
vitest run src/games/three-kingdoms/engine/__tests__/engine-save → 2 suites, 29 tests passed
```

---

## R1+R2 修复统计

| 指标 | R1 | R2 | 总计 |
|------|-----|-----|------|
| 修复文件数 | 5 | 3 | 8 |
| 修复点数 | 11 | 6 | 17 |
| P0修复数 | 7/8 | 1/1 | 8/8 |
| 架构级修复 | 0 | 1 | 1 |
| 穿透率 | 0% | 0% | 0% |

**所有P0已修复，0遗留。**
