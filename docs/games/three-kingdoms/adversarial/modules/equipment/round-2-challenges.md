# Equipment R2 Challenges

> Challenger: 基于 R2 Builder Tree 逐条验证
> 规则: Challenger Rules v1.8
> 扫描范围: 13个文件, ~2,374行源码 (9个核心子系统)
> R2 Builder声称: 7 P0 (1新 + 6遗留)
> 日期: 2026-05-02

---

## 一、FIX 穿透完整性验证

### FIX-601: setCapacity NaN — ✅ 穿透验证通过

```typescript
// EquipmentBagManager.ts:128-131
if (!Number.isFinite(capacity) || capacity <= 0) {
  this.bagCapacity = DEFAULT_BAG_CAPACITY;
  return;
}
```

**测试矩阵**:
| 输入 | 预期 | 实际 | 结果 |
|------|------|------|------|
| NaN | DEFAULT_BAG_CAPACITY | DEFAULT_BAG_CAPACITY | ✅ |
| Infinity | DEFAULT_BAG_CAPACITY | DEFAULT_BAG_CAPACITY | ✅ |
| -Infinity | DEFAULT_BAG_CAPACITY | DEFAULT_BAG_CAPACITY | ✅ |
| -1 | DEFAULT_BAG_CAPACITY | DEFAULT_BAG_CAPACITY | ✅ |
| 0 | DEFAULT_BAG_CAPACITY | DEFAULT_BAG_CAPACITY | ✅ |
| 50 | 50 | 50 | ✅ |

**穿透结论**: 完整，无回归。

### FIX-602: deserialize(null) — ✅ 穿透验证通过

```typescript
// EquipmentSystem.ts:349
if (!data || typeof data !== 'object') { /* 恢复默认 */ }
// EquipmentForgeSystem.ts:311
if (!data || typeof data !== 'object') { /* 恢复默认 */ }
```

| 输入 | 预期 | 实际 | 结果 |
|------|------|------|------|
| null | 默认状态 | 默认状态 | ✅ |
| undefined | 默认状态 | 默认状态 | ✅ |
| '' | 默认状态 | 默认状态 | ✅ |
| 0 | 默认状态 | 默认状态 | ✅ |
| {} | 正常反序列化 | 正常反序列化 | ✅ |

**穿透结论**: 完整，无回归。

### FIX-603: 免费强化 — ✅ 穿透验证通过

```typescript
// EquipmentEnhanceSystem.ts:96-99
if (!this.deductResources) {
  return this.failResult(level, 0, false, 0);
}
```

| 场景 | 预期 | 实际 | 结果 |
|------|------|------|------|
| 未注入 deductResources | failResult | failResult | ✅ |
| 注入但返回 false | failResult | failResult | ✅ |
| 注入且返回 true | 正常强化 | 正常强化 | ✅ |

**穿透结论**: 完整。副作用：集成测试需适配（7个用例需注入 deductResources）。

### FIX-604: 免费扩容 — ❌ 穿透失败

```typescript
// EquipmentBagManager.ts:147-155
const costCheck = { cost: BAG_EXPAND_COST, currency: 'copper', phase: 'precheck' as const };
this.emitEvent('equipment:bag_expand_precheck', costCheck);
// ⚠️ 没有检查返回值，直接继续扩容
this.emitEvent('equipment:bag_expand_cost', { cost: BAG_EXPAND_COST, currency: 'copper' });
this.bagCapacity = Math.min(this.bagCapacity + BAG_EXPAND_INCREMENT, MAX_BAG_CAPACITY);
```

**穿透验证**:
- `emitEvent` 签名: `(event: string, data: any) => void` — 无返回值
- precheck 事件后无条件执行 `this.bagCapacity += BAG_EXPAND_INCREMENT`
- **无论外部系统是否拦截，扩容都会成功**

**穿透结论**: **FIX-604 未实际修复免费扩容漏洞。Builder 标注正确。**

### FIX-605: forge无回滚 — ✅ 穿透验证通过

```typescript
// EquipmentForgeSystem.ts:168-177
const equipment: EquipmentInstance | null = this.equipmentSystem
  ? this.equipmentSystem.generateEquipment(outputSlot, outputRarity, 'forge')
  : null;
if (equipment) {
  this.consumeInputEquipments(inputUids);
}
```

| 场景 | 预期 | 实际 | 结果 |
|------|------|------|------|
| equipmentSystem=null | equipment=null, 不消耗输入 | 符合 | ✅ |
| 正常生成 | 先生成后消耗 | 符合 | ✅ |
| 生成失败 | 不消耗输入 | 符合 | ✅ |

**穿透结论**: 完整，无回归。

### FIX-606: serialize完整性 — ✅ 穿透验证通过

engine-save.ts 独立处理 Forge/Enhance 序列化，架构正确。

### FIX-607: NaN评分防护 — ✅ 穿透验证通过

```typescript
// EquipmentRecommendSystem.ts:165
if (!Number.isFinite(val) || val <= 0) return 0;
// EquipmentRecommendSystem.ts:174
return sum + (Number.isFinite(v) ? v : 0);
```

| 输入 | scoreMainStat | scoreSubStats | 结果 |
|------|--------------|---------------|------|
| mainStat.value=NaN | 0 | — | ✅ |
| subStats[i].value=NaN | — | 跳过该项 | ✅ |
| 全NaN | 0 | 0 | ✅ |

**穿透结论**: 评分端完整。但生成端（GenHelper）和分解端（Decomposer）未防护。

---

## 二、R2 P0 逐条验证

### NEW-P0-001: FIX-604穿透失败 — ✅ 确认

**验证**: 源码确认 `emitEvent` 无返回值，扩容无条件执行。
**复现**: `bag.expand()` → `success: true`，无论外部是否有资源。
**严重性**: P0 — 经济漏洞，可无限免费扩容。

### NEW-P0-002: transferEnhance免费转移 — ✅ 确认

**验证**: `EquipmentEnhanceSystem.ts:200-225`
```typescript
const cost = source.enhanceLevel * TRANSFER_COST_FACTOR;
// cost 被计算但从未调用 deductResources 扣除
```
**复现**: 调用 `transferEnhance(srcUid, tgtUid)` → 成功，cost=非零但未扣费。
**严重性**: P0 — 经济漏洞。

### NEW-P0-003: calculateDecomposeReward NaN — ✅ 确认

**验证**: `EquipmentDecomposer.ts:43-47`
```typescript
const enhanceBonus = 1 + eq.enhanceLevel * DECOMPOSE_ENHANCE_BONUS;
// enhanceLevel=NaN → enhanceBonus=NaN → copper=NaN, enhanceStone=NaN
```
**严重性**: P0 — NaN 传播到资源系统。

### NEW-P0-004: generateBySlot NaN seed — ✅ 确认

**验证**: `EquipmentGenHelper.ts:40-45`
```typescript
function randInt(min, max, seed) { return min + (seed % (max - min + 1)); }
// seed=NaN → NaN % anything = NaN → min + NaN = NaN
```
**严重性**: P0 — 生成全 NaN 装备，污染所有下游。

### NEW-P0-005: add(null) 崩溃 — ✅ 确认

**验证**: `EquipmentBagManager.ts:61-69`
```typescript
add(equipment: EquipmentInstance): BagOperationResult {
  if (this.equipments.size >= this.bagCapacity) { ... }
  if (this.equipments.has(equipment.uid)) { ... } // null.uid → TypeError
```
**严重性**: P0 — 崩溃。

### NEW-P0-006: mergeBonuses NaN — ✅ 确认

**验证**: `EquipmentSetSystem.ts:178-181`
```typescript
target[key] = (target[key] ?? 0) + value;
// value=NaN → target[key]=NaN → 累积传播
```
**严重性**: P0 — 配置错误时套装加成全 NaN。

### NEW-P0-007: generateCampaignDrop 无效 campaignType — ✅ 确认

**验证**: `EquipmentSystem.ts:117`
```typescript
const weights = CAMPAIGN_DROP_WEIGHTS[campaignType];
// invalid campaignType → weights=undefined
// weightedPickRarity(undefined, seed) → Object.entries(undefined) → TypeError
```
**严重性**: P0 — 崩溃。

---

## 三、新维度探索

### 维度A: FIX 引入的回归风险

| FIX | 潜在回归 | 验证结果 |
|-----|---------|---------|
| FIX-603 | deductResources 未注入时所有强化被拒绝 | ✅ 预期行为，集成测试需适配 |
| FIX-605 | equipmentSystem=null 时 forge 返回 success=false | ✅ 正确降级 |
| FIX-601 | 合法 capacity=0.5 被拒绝 | 🟡 极端边界，实际无影响 |
| FIX-607 | NaN 属性装备评分=0 但仍存在于背包 | 🟡 评分修复但不阻止 NaN 装备存在 |

**结论**: 无严重回归。集成测试失败是预期行为变更。

### 维度B: 配置热更新场景

| 场景 | 风险 | 验证 |
|------|------|------|
| 运行时修改 EQUIPMENT_RARITIES | 品质配置变化 → 已生成装备不一致 | P2 — 配置管理问题 |
| 运行时修改 FORGE_WEIGHTS | 锻造概率变化 → 保底计数器状态不一致 | P2 |
| 运行时修改 ENHANCE_CONFIG | 强化费用/成功率变化 → 已有装备强化等级异常 | P2 |

**结论**: 无新 P0。配置热更新属于架构级问题，不在 R2 范围。

### 维度C: 并发/时序场景

| 场景 | 风险 | 验证 |
|------|------|------|
| 同时 forge + decompose 同一装备 | 竞态条件 | P2 — JS 单线程无实际并发 |
| expand 在 deserialize 期间调用 | 状态不一致 | P2 — 同步调用无风险 |
| autoEnhance 中装备被外部删除 | getEquipment 返回 null | ✅ 已有 `if (!current) break` 保护 |

**结论**: 无新 P0。

### 维度D: 数值边界

| 边界 | 风险 | 验证 |
|------|------|------|
| enhanceLevel = MAX_SAFE_INTEGER | 溢出 | P2 — 实际游戏不会达到 |
| bagCapacity = MAX_BAG_CAPACITY | expand 返回 fail | ✅ 已有检查 |
| totalForgeCount = MAX_SAFE_INTEGER | 溢出 | P2 — 仅统计用途 |
| protectionCount = 9999 | 达到上限 | ✅ 有 MAX_PROTECTION_COUNT 限制 |

**结论**: 无新 P0。

### 维度E: FIX-604 深度分析

FIX-604 的修复方案是添加 `equipment:bag_expand_precheck` 事件。但 `emitEvent` 是 `EventEmitFn` 类型：

```typescript
type EventEmitFn = (event: string, data: any) => void;
```

**问题**: `void` 返回值意味着外部系统无法通过返回值阻止扩容。要真正修复需要：
1. 方案A: 改为回调模式 `expand(canExpand?: () => boolean)`
2. 方案B: 改 emitEvent 签名为 `(event: string, data: any) => boolean`
3. 方案C: 添加 `setExpandValidator(fn: () => boolean)` 注入点（类似 setResourceDeductor）

**推荐方案C** — 与 FIX-603 的 setResourceDeductor 模式一致。

---

## 四、虚报率检查

| Builder声称 | Challenger验证 | 结果 |
|-------------|---------------|------|
| NEW-P0-001 (FIX-604穿透) | ✅ 源码确认 emitEvent 无返回值 | 真实 |
| NEW-P0-002 (transferEnhance) | ✅ cost 计算不扣除 | 真实 |
| NEW-P0-003 (decompose NaN) | ✅ 无 NaN guard | 真实 |
| NEW-P0-004 (NaN seed) | ✅ randInt(NaN) = NaN | 真实 |
| NEW-P0-005 (add null) | ✅ null.uid 崩溃 | 真实 |
| NEW-P0-006 (mergeBonuses) | ✅ NaN 累积 | 真实 |
| NEW-P0-007 (invalid campaignType) | ✅ undefined→崩溃 | 真实 |
| FIX-601 穿透成功 | ✅ | 真实 |
| FIX-602 穿透成功 | ✅ | 真实 |
| FIX-603 穿透成功 | ✅ | 真实 |
| FIX-604 穿透失败 | ✅ | 真实 |
| FIX-605 穿透成功 | ✅ | 真实 |
| FIX-606 穿透成功 | ✅ | 真实 |
| FIX-607 穿透成功 | ✅ | 真实 |

**虚报率: 0/14 = 0%** ✅

---

## 五、Challenger 结论

1. **FIX 穿透**: 6/7 成功，FIX-604 穿透失败（precheck 事件无法阻止扩容）
2. **R2 P0**: 7个全部确认，0虚报
3. **新维度**: 探索5个新维度，未发现新P0
4. **回归风险**: 无严重回归，集成测试失败属预期行为变更
5. **建议**: FIX-604 需重新修复（推荐 setExpandValidator 注入点模式）
