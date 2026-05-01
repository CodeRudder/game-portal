# Bond R2 — Challenger 挑战报告

> Challenger Agent | 2026-05-01 | BondSystem (engine/bond/BondSystem.ts)

## R1 FIX 回归验证

### ✅ FIX-B01: addFavorability NaN/Infinity/负数 — 已修复
```typescript
if (!heroId || !Number.isFinite(amount) || amount <= 0) return;
```
- NaN → `Number.isFinite(NaN)=false` → return ✅
- Infinity → `Number.isFinite(Infinity)=false` → return ✅
- -Infinity → 同上 ✅
- 负数 → `amount <= 0` → return ✅
- **穿透**: triggerStoryEvent 调用 addFavorability(heroId, event.rewards.favorability)，rewards 来自 STORY_EVENTS 配置常量，安全 ✅

### ✅ FIX-B02: addFavorability 上限保护 — 已修复
```typescript
const MAX_FAVORABILITY = 99999;
fav.value = Math.min(fav.value + amount, MAX_FAVORABILITY);
```
- Infinity 不可能到达此处（已被 FIX-B01 拦截）✅
- 正常大数累加被截断至 99999 ✅
- 序列化安全：`JSON.stringify(99999)` = "99999" ✅

### ✅ FIX-B03: loadSaveData null/undefined — 已修复
```typescript
if (!data) return;
const favs = data.favorabilities ?? {};
// + Number.isFinite(value.value) 过滤
```
- null → return ✅
- undefined → return ✅
- favorabilities 含 NaN → 跳过 ✅
- completedStoryEvents 含空字符串 → 跳过 ✅

### ✅ FIX-B04: 存档系统六处同步 — 已修复
验证穿透：
1. `shared/types.ts:339` — `bond?: BondSaveData` ✅
2. `engine-save.ts:166` — `SaveContext.bond?: BondSystem` ✅
3. `engine-save.ts:267` — `bond: ctx.bond?.serialize()` ✅
4. `engine-save.ts:886-887` — `ctx.bond.loadSaveData(data.bond)` ✅
5. `ThreeKingdomsEngine.ts:889` — `bond: this.bondSystem` ✅
6. `ThreeKingdomsEngine.ts:234` — `register('bond', this.bondSystem)` ✅

### ✅ FIX-B05: triggerStoryEvent 前置条件 — 已修复
```typescript
for (const heroId of event.condition.heroIds) {
  const fav = this.getFavorability(heroId);
  if (!Number.isFinite(fav.value) || fav.value < event.condition.minFavorability) {
    return { success: false, reason: `武将${heroId}好感度不足` };
  }
}
```
- 好感度不足 → success=false ✅
- **注意**: 仅校验好感度，未校验英雄存在性和等级（依赖 getAvailableStoryEvents 的前置过滤）
- **评估**: triggerStoryEvent 是内部 API，调用前应通过 getAvailableStoryEvents 过滤。当前防护等级可接受，但建议 R3 补充 heroIds 存在性校验。→ **降级为 P2 建议**

### ✅ FIX-B06: triggerStoryEvent deps 未初始化 — 已修复
```typescript
if (!this.deps) return { success: false, reason: '系统未初始化' };
```
- deps 未 init → 安全返回 ✅

### ✅ FIX-B07: getAvailableStoryEvents null — 已修复
```typescript
if (!heroes) return [];
```
- null → [] ✅
- undefined → [] ✅

### ✅ FIX-B08: getFactionDistribution faction — 已修复
```typescript
if (hero && hero.faction && hero.faction in dist) {
  dist[hero.faction]++;
}
```
- undefined faction → 跳过 ✅
- 无效 faction（如 'jin'）→ `'jin' in dist` = false → 跳过 ✅

## R2 新维度探索

### C2-001: getBondEffect 无效 BondType — P1 → 降级为 P2
```typescript
getBondEffect(type: BondType): BondEffect {
  return { ...BOND_EFFECTS[type] };
}
```
- 若传入无效 type（如 `'invalid'`），BOND_EFFECTS['invalid'] = undefined
- 返回 `{ ...undefined }` = `{}`，不会崩溃
- TypeScript 类型系统在编译期防护，运行时返回空对象
- **评估**: 非崩溃行为，静默返回空对象。→ **P2，不阻塞封版**

### C2-002: addFavorability 空字符串 heroId — P1 → 已修复
- FIX-B01 已包含 `if (!heroId)` 检查，空字符串 `''` 为 falsy → return ✅
- **评估**: R1 P1-002 已被 FIX-B01 顺便修复。→ **关闭**

### C2-003: 双 BondSystem name 冲突 — P1 → 降级为 P2
- `engine/bond/BondSystem.name = 'bond'`
- `engine/hero/FactionBondSystem.name = 'factionBond'`（实际注册名）
- ThreeKingdomsEngine.ts:234-235 分别注册为 `'bond'` 和 `'factionBond'`
- **评估**: 无实际冲突，name 不同。R1 误判。→ **关闭**

### C2-004: STORY_EVENTS 前置事件链 — P1 → 降级为 P2
- STORY_EVENTS 中部分事件有 prerequisiteEventId，部分无
- 无前置事件的事件可直接触发（设计意图）
- 有前置事件的已通过 completedStoryEvents.has() 检查
- **评估**: 配置层面问题，非代码缺陷。→ **P2，不阻塞封版**

### C2-005: loadSaveData 版本兼容 — P1 → 降级为 P2
- loadSaveData 不检查 version 字段
- 当前 BOND_SAVE_VERSION = 1，无历史版本需兼容
- **评估**: 无当前影响，未来版本升级时需注意。→ **P2，不阻塞封版**

### C2-006: calculateTotalBondBonuses NaN 注入（R1 T3-N04 回归）
```typescript
total[k] = (total[k] ?? 0) + value;
```
- BOND_EFFECTS 配置来自 bond-config.ts 静态常量
- value 来源是 `bond.effect.bonuses` → BOND_EFFECTS[type].bonuses
- 只要配置值合法，此处不会产生 NaN
- **评估**: 配置数据安全，非运行时注入路径。→ **P2，不阻塞封版**

### C2-007: getFormationPreview heroes 为空数组
- 传入 `[]` → getFactionDistribution 返回全零 → detectActiveBonds 返回 [] → 正常
- **评估**: 已安全处理。→ **关闭**

### C2-008: triggerStoryEvent 仅校验好感度，未校验 heroIds 存在性
- 若直接调用 triggerStoryEvent('some_event')，且 event.condition.heroIds 中的武将不在系统中
- getFavorability(不存在的heroId) 返回 { heroId, value: 0, triggeredEvents: [] }
- 若 minFavorability=0，则校验通过，addFavorability 会为不存在的武将创建好感度条目
- **评估**: triggerStoryEvent 是内部 API，正常流程通过 getAvailableStoryEvents 过滤。边缘场景，不崩溃但创建无效条目。→ **P2，建议 R3 修复**

## 挑战结论

| 维度 | R1 评分 | R2 评分 | 变化 |
|------|---------|---------|------|
| Normal flow | 90% | 95% | ↑ 配置完整性已验证 |
| Boundary | 70% | 85% | ↑ 极端值/空值已覆盖 |
| Error path | 95% | 98% | ↑ 所有 NaN/null/undefined 路径已修复 |
| Cross-system | 95% | 98% | ↑ 存档六处同步已验证 |
| Data lifecycle | 100% | 100% | → 保持 |

### 新发现缺陷

| ID | 描述 | 严重度 | 阻塞封版？ |
|----|------|--------|-----------|
| C2-008 | triggerStoryEvent 未校验 heroIds 存在性 | P2 | ❌ |

### 结论

**R1 的 8 个 P0 全部修复验证通过。R2 未发现新的 P0/P1 缺陷。所有遗留 P1 均已评估并降级为 P2。建议封版。**
