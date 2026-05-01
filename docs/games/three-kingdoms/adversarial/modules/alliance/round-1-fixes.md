# Alliance R1 Fixer 修复报告

> 模块: engine/alliance | 日期: 2026-05-01
> 修复P0数: 3 | TypeScript编译: ✅ 通过 | 测试: 265 passed

## 修复清单

### FIX-P0-001: Alliance 接入 engine-save 六处

**关联缺陷**: P0-001 (Alliance 4个子系统完全未接入 engine-save)

**修改文件**: `engine/engine-save.ts`, `shared/types.ts`

**修改内容**:

1. **SaveContext 接口** (engine-save.ts L143-146): 新增 4 个可选字段
   ```typescript
   readonly allianceSystem?: AllianceSystem;
   readonly allianceTaskSystem?: AllianceTaskSystem;
   readonly allianceBossSystem?: AllianceBossSystem;
   readonly allianceShopSystem?: AllianceShopSystem;
   ```

2. **GameSaveData 接口** (shared/types.ts): 新增 3 个可选字段
   ```typescript
   alliance?: AllianceSaveData;
   allianceTask?: { tasks: [...] };
   allianceShop?: { items: [...] };
   ```

3. **buildSaveData()** (engine-save.ts): 新增 3 行序列化调用
   ```typescript
   alliance: ctx.allianceSystem?.serialize(...),
   allianceTask: ctx.allianceTaskSystem?.serialize(),
   allianceShop: ctx.allianceShopSystem?.serialize(),
   ```

4. **applySaveData()** (engine-save.ts): 新增 3 段反序列化逻辑
   - alliance: deserialize → resetAllianceData
   - allianceTask: deserialize
   - allianceShop: deserialize

5. **toIGameState()** (engine-save.ts): 新增 3 个 subsystems 映射

6. **fromIGameState()** (engine-save.ts): 新增 3 个字段提取

**验证**: `npx tsc --noEmit` ✅ 通过

---

### FIX-P0-002: AllianceTaskSystem 添加 serialize/deserialize

**关联缺陷**: P0-002 (Set<string> 无法 JSON 序列化)

**修改文件**: `engine/alliance/AllianceTaskSystem.ts`

**修改内容**: 新增 `serialize()` 和 `deserialize()` 方法

```typescript
serialize(): { tasks: [...] } {
  return { tasks: this.serializeTasks() };
}

deserialize(data: { tasks: [...] }): void {
  if (!data || !Array.isArray(data.tasks)) return;
  this.deserializeTasks(data.tasks);
}
```

**设计**: 复用已有的 `serializeTasks()`/`deserializeTasks()` 方法，将 Set<string> ↔ string[] 转换封装在内部。

---

### FIX-P0-003: AllianceShopSystem 添加 serialize/deserialize

**关联缺陷**: P0-003 (purchased 状态无法持久化)

**修改文件**: `engine/alliance/AllianceShopSystem.ts`

**修改内容**: 新增 `serialize()` 和 `deserialize()` 方法

```typescript
serialize(): { items: Array<{ id: string; purchased: number }> } {
  return { items: this.shopItems.map(i => ({ id: i.id, purchased: i.purchased })) };
}

deserialize(data: { items: Array<{ id: string; purchased: number }> }): void {
  if (!data || !Array.isArray(data.items)) return;
  for (const saved of data.items) {
    const item = this.shopItems.find(i => i.id === saved.id);
    if (item) item.purchased = Math.max(0, saved.purchased);
  }
}
```

**设计**: 只持久化 purchased 状态（商品定义由代码配置），新增商品时旧存档自动兼容。

---

### FIX-P0-001b: AllianceBossSystem 添加 serialize/deserialize

**修改文件**: `engine/alliance/AllianceBossSystem.ts`

**说明**: Boss 状态由 AllianceData 的 `bossKilledToday`/`lastBossRefreshTime` 字段承载，通过 `getCurrentBoss()` 重建。serialize/deserialize 为空实现以满足统一接口。

---

## 验证结果

| 检查项 | 结果 |
|--------|------|
| `npx tsc --noEmit` | ✅ 无错误 |
| Alliance 单元测试 | ✅ 265 passed |
| engine-save 编译 | ✅ 通过 |
| 六处同步验证 | ✅ SaveContext + GameSaveData + buildSaveData + applySaveData + toIGameState + fromIGameState |

## P1 修复建议（R2处理）

6个 P1 缺陷统一修复模式:

```typescript
// 替换 Math.max(0, x) 为:
if (!Number.isFinite(x) || x < 0) throw new Error('参数必须为非负有限数');
```

影响位置:
- AllianceSystem.ts L229 (addExperience)
- AllianceBossSystem.ts L161 (challengeBoss damage)
- AllianceTaskSystem.ts L175 (updateProgress)
- AllianceTaskSystem.ts L192 (recordContribution)
- AllianceBossSystem.ts L56 (createBoss allianceLevel)
- AllianceShopSystem.ts L147 (buyShopItemBatch count)
