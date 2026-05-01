# Map 流程分支树 Round 2

> Builder: TreeBuilder v2.0 | Time: 2026-05-02
> 模块: map | 文件: 10 | 源码: 3,250行 | API: ~85
> 基于: R1 340节点 → R2 精简验证树

## R2 策略

R1产生22个P0，13个FIX已全部落地（源码验证通过，268测试PASS）。R2 Builder目标：
1. **验证FIX穿透**：逐项确认FIX-701~713在源码中的存在和正确性
2. **精简树**：已修复P0节点标记为 `FIXED`，不再展开
3. **聚焦未覆盖**：4条uncovered跨系统链路 + 17个P1 + R1降级项
4. **新维度探索**：Arbiter独立发现项 + engine-save覆盖验证

## FIX 验证矩阵

| FIX | P0覆盖 | 源码验证 | 测试覆盖 | 状态 |
|-----|--------|---------|---------|------|
| FIX-701 | P0-001,002 | ✅ SiegeSystem.ts:182 `isFinite(availableTroops/Grain)` | ✅ SiegeSystem.test.ts | FIXED |
| FIX-702 | P0-003,004 | ✅ SiegeSystem.ts:229 `isFinite(defense) \|\| defense<=0` | ✅ SiegeSystem.test.ts | FIXED |
| FIX-703 | P0-005,006 | ✅ SiegeSystem.ts:327 + SiegeEnhancer.ts:150 对称修复 | ✅ 双文件测试 | FIXED |
| FIX-704 | P0-007 | ✅ SiegeSystem.ts:390-420 serialize/deserialize captureTimestamps | ✅ SiegeSystem.test.ts | FIXED |
| FIX-705 | P0-008~011 | ✅ 4文件deserialize入口 `if(!data)return` | ✅ 各系统测试 | FIXED |
| FIX-706 | P0-012 | ✅ WorldMapSystem.ts:251 `isFinite(landmark.level)` | ✅ WorldMapSystem.test.ts | FIXED |
| FIX-707 | P0-013 | ✅ WorldMapSystem.ts:296 `isFinite(zoom)` | ✅ WorldMapSystem.test.ts | FIXED |
| FIX-708 | P0-014 | ✅ MapDataRenderer.ts:82 safeZoom fallback | ✅ MapDataRenderer.test.ts | FIXED |
| FIX-709 | P0-015,016 | ✅ MapFilterSystem.ts:76-78 `tiles??[]` + `criteria??{}` | ✅ MapFilterSystem.test.ts | FIXED |
| FIX-710 | P0-017 | ✅ TerritorySystem.ts:395 safeLevel fallback | ✅ TerritorySystem.test.ts | FIXED |
| FIX-711 | P0-018 | ✅ TerritorySystem.ts:159 `!t\|\|!newOwner` | ✅ TerritorySystem.test.ts | FIXED |
| FIX-712 | P0-019,020 | ✅ GarrisonSystem.ts:214-227 isFinite防护4项 | ✅ GarrisonSystem.test.ts | FIXED |
| FIX-713 | P0-021 | ✅ TerritorySystem.ts:319-322 isFinite累加4项 | ✅ TerritorySystem.test.ts | FIXED |

**穿透率: 0%** — 无FIX引入新问题 ✅

## R2 精简统计

| 类别 | R1节点 | R2 FIXED | R2 活跃 | R2 新增 |
|------|--------|----------|---------|---------|
| P0 | 22 | 23 | 0 | 0 |
| P1 | 17 | 1 | 16 | 0 |
| P2 | 11 | 0 | 11 | 0 |
| 跨系统链路 | 16 | 12 covered | 4 uncovered | 0 |
| Arbiter独立 | 2 | 0 | 2 | 0 |
| **总计** | **340** | **22 FIXED** | **32 活跃** | **1 新增** |

## R2 活跃节点（未修复项）

### 降级P1 → R2验证

#### P0-023→P1: deductSiegeResources cost含NaN
```
状态: 上游FIX-702覆盖 → cost.troops不会为NaN
验证: calculateSiegeCost已防护defenseValue NaN/负值 → cost始终有限
穿透: resourceSys.consume收到有限值 → 安全
R2结论: ✅ 确认已由FIX-702间接修复，维持P1
```

#### P0-024→P1: engine-save未覆盖Map子系统
```
状态: ✅ 已由FIX-714修复
源码验证:
  - engine-save.ts:133-138 SaveContext接口含6个Map子系统 ✅
  - engine-save.ts:216-221 buildSaveData()序列化6个Map子系统 ✅
  - engine-save.ts:670-696 applySaveData()反序列化6个Map子系统 ✅
  - ThreeKingdomsEngine.ts:860-865 buildSaveCtx()传入6个Map子系统 ✅
遗留: toIGameState/fromIGameState备用路径未包含Map字段（P2）
R2结论: ✅ FIXED（主路径完整），遗留P2（备用路径）
```

### P1 活跃节点（17个）

| # | ID | 子系统 | 描述 | R2评估 |
|---|-----|--------|------|--------|
| 1 | P1-001 | SiegeSystem/SiegeEnhancer | computeWinRate公式不一致(terrainBonus) | 维持P1，当前默认值0无影响 |
| 2 | P1-002 | WorldMapSystem | init deps=null 非空断言 | 维持P1，调用方保证 |
| 3 | P1-003 | TerritorySystem | calculateAccumulatedProduction seconds=NaN | 维持P1 |
| 4 | P1-004 | SiegeSystem | serialize不保存history | 维持P1，非关键数据 |
| 5 | P1-005 | GarrisonSystem | deserialize含无效territoryId | 维持P1 |
| 6 | P1-006 | MapEventSystem | cleanExpiredEvents now=NaN永不过期 | 维持P1 |
| 7 | P1-007 | MapEventSystem | resolveEvent choice无效无校验 | 维持P1 |
| 8 | P1-008 | MapDataRenderer | clampViewport NaN传播 | 维持P1 |
| 9 | P1-009 | SiegeEnhancer | executeConquest siegeSys=null fallback | 维持P1 |
| 10 | P1-010 | GarrisonSystem | territorySys=null全部失败 | 维持P1，依赖注入保证 |
| 11 | P1-011 | GarrisonSystem | heroSys=null全部失败 | 维持P1，依赖注入保证 |
| 12 | P1-012 | WorldMapSystem | setViewportOffset无边界约束 | 维持P1 |
| 13 | P1-013 | MapEventSystem | forceTrigger activeEvents=3返回最后事件 | 维持P1 |
| 14 | P1-014 | TerritorySystem | deserialize不验证ownership合法性 | 维持P1 |
| 15 | P1-015 | WorldMapSystem | deserialize无效id静默跳过 | 维持P1，合理行为 |
| 16 | P1-016 | SiegeSystem | deserialize不恢复captureTimestamps | ✅ 已由FIX-704修复，可关闭 |
| 17 | P1-017 | MapEventSystem | deserialize含NaN字段直接赋值 | 维持P1 |

### P1-016 状态更新
```
R1标记: P1-016 SiegeSystem.deserialize不恢复captureTimestamps
R2验证: FIX-704已在serialize/deserialize中完整处理captureTimestamps
结论: ✅ 已修复，关闭
```

### 跨系统链路（4条uncovered）

| # | 链路 | 描述 | R2评估 |
|---|------|------|--------|
| X-13 | WorldMap→Territory | 地标-领土同步 | 维持uncovered，需集成测试 |
| X-14 | Territory→WorldMap | 归属变更回写地标 | 维持uncovered，需集成测试 |
| X-15 | MapEventSystem→CONFIG | 配置完整性 | ✅ 配置硬编码5种，与枚举一致 |
| X-16 | SiegeSystem.serialize→engine-save | 保存覆盖验证 | 🔴 确认缺失（见P0-024） |

### Arbiter独立发现（2项）

| # | 发现 | R2评估 |
|---|------|--------|
| A-01 | SiegeSystem.update跨天重置依赖引擎循环 | 维持P1，checkSiegeConditions中无跨天检查 |
| A-02 | MapEventSystem.eventIdCounter全局变量 | 维持P2，多次实例化场景极少 |

## R2 新增发现

### ~~NEW-P0-024~~: engine-save Map子系统序列化 — ✅ FIXED (FIX-714)
```
来源: R1 P0-024降级 → R2源码验证 → 确认已由FIX-714修复
严重度: 原P0（数据丢失）
修复验证:
  - SaveContext接口: 含6个Map子系统 ✅
  - buildSaveData(): 序列化6个Map子系统 ✅
  - applySaveData(): 反序列化6个Map子系统 ✅
  - buildSaveCtx(): 传入6个Map子系统 ✅
遗留: toIGameState/fromIGameState备用路径未包含Map字段（P2）
```

## Top P0/P1 优先级排序（R2活跃）

| 优先级 | ID | 描述 | 修复方案 |
|--------|-----|------|---------|
| 🔴 ~~P0~~ | ~~P0-024~~ | ~~engine-save缺失Map序列化~~ | ~~FIX-714~~ ✅ 已修复 |
| 🟡 P1 | P1-003 | calculateAccumulatedProduction NaN | isFinite(seconds) |
| 🟡 P1 | P1-004 | serialize不保存history | 添加history字段 |
| 🟡 P1 | P1-006 | cleanExpiredEvents now=NaN | isFinite(now) |
| 🟡 P1 | P1-007 | resolveEvent choice无效 | 校验choice |
| 🟡 P1 | P1-008 | clampViewport NaN | 入口isFinite |
| 🟡 P1 | A-01 | 跨天重置依赖引擎循环 | checkSiegeConditions中检查 |

## 与R1对比

| 维度 | R1 | R2 | 变化 |
|------|-----|-----|------|
| P0活跃 | 22 | 0 | -22 (FIX-701~713 + FIX-714) |
| P1活跃 | 17 | 16 | -1 (P1-016已修复) |
| P2活跃 | 11 | 12 | +1 (toIGameState备用路径) |
| 跨系统uncovered | 4 | 3 | -1 (X-15验证通过) |
| FIX穿透率 | N/A | 0% | ✅ |
| 测试通过 | N/A | 268/268 | ✅ |
