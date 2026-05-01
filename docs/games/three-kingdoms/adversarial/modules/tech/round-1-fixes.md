# Tech 模块 Round-1 修复清单

> **修复人**: TreeBuilder Agent v1.7  
> **修复日期**: 2026-05-01  
> **修复范围**: 4个P0（NaN防护 + 序列化接入 + 科技点上限）  
> **验证**: `npx tsc --noEmit` ✅ 通过

---

## 修复统计

| FIX-ID | 严重度 | 描述 | 修改文件 | 状态 |
|--------|--------|------|---------|------|
| FIX-501 | P0 | 全模块NaN防护 | TechPointSystem.ts, TechResearchSystem.ts, TechTreeSystem.ts | ✅ |
| FIX-502 | P0 | FusionTechSystem接入engine-save | engine-save.ts, tech.types.ts | ✅ |
| FIX-503 | P0 | TechOfflineSystem接入engine-save | engine-save.ts, tech.types.ts | ✅ |
| FIX-504 | P0 | 科技点上限 | TechPointSystem.ts | ✅ |

---

## FIX-501: 全模块NaN防护

**问题**: 整个Tech模块4765行代码中0处`Number.isFinite()`使用，NaN可穿透所有数值路径。

**修复策略**: 在关键public方法入口添加`!Number.isFinite()`检查。

### TechPointSystem.ts 修改点

| # | 方法 | 防护内容 |
|---|------|---------|
| 1 | `update(dt)` | `!Number.isFinite(dt) \|\| dt <= 0` → return |
| 2 | `syncAcademyLevel(level)` | `!Number.isFinite(level) \|\| level < 0` → return |
| 3 | `syncResearchSpeedBonus(bonus)` | `!Number.isFinite(bonus)` → return; `Math.max(0, bonus)` |
| 4 | `canAfford(points)` | `!Number.isFinite(points) \|\| points < 0` → false |
| 5 | `spend(points)` | `!Number.isFinite(points) \|\| points <= 0` → return |
| 6 | `refund(points)` | `!Number.isFinite(points) \|\| points <= 0` → return |
| 7 | `exchangeGoldForTechPoints(goldAmount, ...)` | `!Number.isFinite(goldAmount) \|\| goldAmount <= 0` → 失败 |

### TechResearchSystem.ts 修改点

| # | 方法 | 防护内容 |
|---|------|---------|
| 1 | `startResearch()` speedMultiplier检查 | `!Number.isFinite(speedMultiplier) \|\| speedMultiplier <= 0` → 失败 |
| 2 | `speedUp(techId, method, amount)` | `!Number.isFinite(amount) \|\| amount <= 0` → 失败 |

### TechTreeSystem.ts 修改点

| # | 方法 | 防护内容 |
|---|------|---------|
| 1 | `setResearching(id, startTime, endTime)` | `!Number.isFinite(startTime) \|\| !Number.isFinite(endTime)` → return |

---

## FIX-502: FusionTechSystem接入engine-save

**问题**: FusionTechSystem有serialize()/deserialize()方法但未被engine-save调用，存档后融合科技进度丢失。

**修复**:

1. **TechSaveData接口扩展** (`tech.types.ts`):
   - 新增 `fusionTechData?: FusionTechSaveData` 字段

2. **SaveContext扩展** (`engine-save.ts`):
   - 新增 `fusionTech?: FusionTechSystem` 可选引用

3. **buildSaveData序列化** (`engine-save.ts`):
   - 添加 `ctx.fusionTech?.serialize()` 调用
   - 写入 `techSaveData.fusionTechData`

4. **applySaveData反序列化** (`engine-save.ts`):
   - 添加 `ctx.fusionTech.deserialize(data.tech.fusionTechData)` 调用
   - 条件检查：`data.tech.fusionTechData && ctx.fusionTech`

---

## FIX-503: TechOfflineSystem接入engine-save

**问题**: TechOfflineSystem有serialize()/deserialize()方法但未被engine-save调用，离线研究进度丢失。

**修复**:

1. **TechSaveData接口扩展** (`tech.types.ts`):
   - 新增 `offlineResearchData?: OfflineResearchSaveData` 字段

2. **SaveContext扩展** (`engine-save.ts`):
   - 新增 `techOffline?: TechOfflineSystem` 可选引用

3. **buildSaveData序列化** (`engine-save.ts`):
   - 添加 `ctx.techOffline?.serialize()` 调用
   - 写入 `techSaveData.offlineResearchData`

4. **applySaveData反序列化** (`engine-save.ts`):
   - 添加 `ctx.techOffline.deserialize(data.tech.offlineResearchData)` 调用
   - 条件检查：`data.tech.offlineResearchData && ctx.techOffline`

---

## FIX-504: 科技点上限

**问题**: TechPointSystem无科技点上限，可无限累积导致潜在数值问题。

**修复**:

1. **新增常量** (`TechPointSystem.ts`):
   ```typescript
   static readonly MAX_TECH_POINTS = 99999;
   ```

2. **update()上限检查**:
   ```typescript
   this.techPoints.current = Math.min(this.techPoints.current + gain, TechPointSystem.MAX_TECH_POINTS);
   ```

3. **refund()上限检查**:
   ```typescript
   this.techPoints.current = Math.min(this.techPoints.current + points, TechPointSystem.MAX_TECH_POINTS);
   ```

4. **exchangeGoldForTechPoints()上限检查**:
   ```typescript
   this.techPoints.current = Math.min(this.techPoints.current + pointsGained, TechPointSystem.MAX_TECH_POINTS);
   ```

---

## 六处同步验证

| # | 同步点 | FIX-502 | FIX-503 |
|---|--------|---------|---------|
| 1 | GameSaveData类型 | ✅ tech.types.ts | ✅ tech.types.ts |
| 2 | SaveContext接口 | ✅ engine-save.ts | ✅ engine-save.ts |
| 3 | buildSaveData序列化 | ✅ engine-save.ts | ✅ engine-save.ts |
| 4 | toIGameState传递 | ✅ (通过tech字段) | ✅ (通过tech字段) |
| 5 | fromIGameState提取 | ✅ (通过tech字段) | ✅ (通过tech字段) |
| 6 | applySaveData反序列化 | ✅ engine-save.ts | ✅ engine-save.ts |

---

## 编译验证

```bash
$ npx tsc --noEmit
# 无输出 = 编译通过 ✅
```

---

## 遗留项（R2处理）

| # | 项目 | 优先级 | 说明 |
|---|------|--------|------|
| 1 | TechLinkSystem serialize/deserialize | P1 | 无序列化方法，联动状态依赖运行时重建 |
| 2 | TechEffectSystem.setTechTree()加载流程 | P1 | 需确认engine-tick初始化顺序 |
| 3 | 所有deserialize的null防护 | P1 | 4个deserialize方法无null guard |
| 4 | TechEffectSystem乘数接口NaN传播 | P0 | getAttackMultiplier等返回NaN |
| 5 | TechEffectApplier.apply*系列NaN防护 | P0 | 所有apply方法无NaN检查 |
