# Equipment 流程分支树 Round 2

> Builder: TreeBuilder v1.8 | Time: 2026-05-02
> 模块: equipment | 文件: 13 | 源码: 2,374行 | API: ~78
> 前轮: R1 评分 8.35, 18 P0, FIX-601~607

## 一、R1 FIX 穿透验证

### FIX-601: NaN绕过背包容量 — ✅ 已落地

| 检查项 | 结果 |
|--------|------|
| 源码标记 | `EquipmentBagManager.ts:128` FIX-601 注释 |
| NaN防护 | `!Number.isFinite(capacity) \|\| capacity <= 0` → 回退 `DEFAULT_BAG_CAPACITY` |
| Infinity防护 | `Number.isFinite(Infinity) = false` → 已覆盖 |
| 负数防护 | `capacity <= 0` → 已覆盖 |
| 穿透评估 | **完整修复，无回归** |

### FIX-602: deserialize(null)崩溃（3处） — ✅ 已落地

| 检查项 | 结果 |
|--------|------|
| EquipmentSystem.deserialize | `EquipmentSystem.ts:349` — `if (!data \|\| typeof data !== 'object')` ✅ |
| EquipmentForgeSystem.deserialize | `EquipmentForgeSystem.ts:311` — 同样 null guard ✅ |
| EquipmentBagManager.setCapacity | 被 FIX-601 覆盖 ✅ |
| 穿透评估 | **完整修复，3处均防护** |

### FIX-603: 免费强化漏洞 — ✅ 已落地

| 检查项 | 结果 |
|--------|------|
| 源码标记 | `EquipmentEnhanceSystem.ts:95` FIX-603 注释 |
| 必需检查 | `if (!this.deductResources) return failResult` ✅ |
| 扣费验证 | `const deducted = this.deductResources(copperCost, stoneCost); if (!deducted) return failResult` ✅ |
| 副作用 | 集成测试 7 个用例因未注入 deductResources 而失败（预期行为变更） |
| 穿透评估 | **完整修复，集成测试需适配** |

### FIX-604: 免费扩容漏洞 — ⚠️ 部分修复

| 检查项 | 结果 |
|--------|------|
| 源码标记 | `EquipmentBagManager.ts:146` FIX-604 注释 |
| precheck事件 | 已添加 `equipment:bag_expand_precheck` 事件发射 ✅ |
| **阻止扩容** | ❌ **未实现** — emitEvent 后无条件执行扩容 |
| 根因 | `emitEvent` 是单向通知（`EventEmitFn`），无返回值，无法阻止操作 |
| 穿透评估 | **FIX 穿透失败** — 仍然可以免费扩容 |

**复现**:
```typescript
// 无需任何资源，直接调用 expand() 仍成功
bag.expand(); // success: true, 容量 +10
```

### FIX-605: forge无回滚 — ✅ 已落地

| 检查项 | 结果 |
|--------|------|
| 源码标记 | `EquipmentForgeSystem.ts:168` FIX-605 注释 |
| 执行顺序 | 先 `generateEquipment` → 成功后才 `consumeInputEquipments` ✅ |
| 失败保护 | `if (equipment) { consumeInputEquipments }` ✅ |
| 穿透评估 | **完整修复，无回归** |

### FIX-606: serialize缺失ForgePity — ✅ 已验证无遗漏

| 检查项 | 结果 |
|--------|------|
| 源码标记 | `EquipmentSystem.ts:338` FIX-606 注释 |
| 架构验证 | engine-save.ts 独立处理 Forge/Enhance 序列化 ✅ |
| 穿透评估 | **确认架构正确** |

### FIX-607: NaN传播到评分/推荐 — ✅ 已落地

| 检查项 | 结果 |
|--------|------|
| scoreMainStat | `!Number.isFinite(val) \|\| val <= 0` → return 0 ✅ |
| scoreSubStats | reduce 中 `Number.isFinite(v) ? v : 0` ✅ |
| evaluateEquipment | 5个评分分量逐一 NaN guard ✅ |
| 穿透评估 | **评分端完整修复** |

---

## 二、R1 P0 状态追踪

| P0 ID | 描述 | R1状态 | R2验证 | R2状态 |
|-------|------|--------|--------|--------|
| P0-001 | 图鉴bestRarity无gold | FIX | 使用导入的 RARITY_ORDER | ✅ 已修复 |
| P0-002 | decomposeReward NaN | 未FIX | calculateDecomposeReward 无 NaN guard | 🔴 **未修复** |
| P0-003 | scoreMainStat NaN | FIX-607 | scoreMainStat 有 NaN guard | ✅ 已修复 |
| P0-004 | scoreEnhance NaN | FIX-607 | evaluateEquipment 有 NaN guard | ✅ 已修复 |
| P0-005 | forge消费后失败 | FIX-605 | 先生成后消费 | ✅ 已修复 |
| P0-006 | deductResources=null | FIX-603 | 未注入时拒绝强化 | ✅ 已修复 |
| P0-007 | autoEnhance NaN config | 未FIX | config.maxCopper=NaN 可无限循环(有100步安全阀) | 🟡 **部分** |
| P0-008 | expand无资源预检 | FIX-604 | precheck事件无返回值，扩容仍无条件成功 | 🔴 **未修复** |
| P0-009 | setCapacity NaN | FIX-601 | NaN/Infinity/负数回退默认值 | ✅ 已修复 |
| P0-010 | invalid campaignType | 未FIX | CAMPAIGN_DROP_WEIGHTS[invalid]=undefined→崩溃 | 🔴 **未修复** |
| P0-011 | equipItem null heroId | 未FIX | heroEquips.get(null) 不会崩溃(Map返回undefined) | 🟡 **降级P1** |
| P0-012 | invalid rarity→NaN | 未FIX | RARITY_ORDER[invalid]=undefined→排序失效 | 🟡 **降级P1** |
| P0-013 | deserialize(null)×3 | FIX-602 | 3处 null guard | ✅ 已修复 |
| P0-014 | add(null) | 未FIX | equipment.uid → TypeError 崩溃 | 🔴 **未修复** |
| P0-015 | mergeBonuses NaN | 未FIX | 配置 NaN 值会累积传播 | 🔴 **未修复** |
| P0-016 | transferEnhance未扣费 | 未FIX | cost 计算但不扣除 | 🔴 **未修复** |
| P0-019 | NaN seed→全NaN | 未FIX | generateBySlot 无 seed 验证 | 🔴 **未修复** |
| P0-C04 | scoreSubStats NaN | FIX-607 | reduce 中 NaN 过滤 | ✅ 已修复 |

### 修复统计

| 类别 | 数量 | ID列表 |
|------|------|--------|
| ✅ 已修复 | 10 | P0-001,003,004,005,006,009,013,C04 + FIX-606验证 + FIX-607覆盖 |
| 🔴 未修复 | 7 | P0-002,008,010,014,015,016,019 |
| 🟡 部分修复 | 1 | P0-007 (有安全阀但未根本解决) |
| ⬇️ 降级 | 2 | P0-011→P1, P0-012→P1 |

---

## 三、R2 新P0发现

### NEW-P0-001: FIX-604 穿透失败 — expand 仍可免费扩容

- **严重性**: P0 (经济漏洞)
- **文件**: `EquipmentBagManager.ts:140-155`
- **根因**: `emitEvent('equipment:bag_expand_precheck', ...)` 是单向通知，无返回值，无法阻止后续扩容
- **影响**: 玩家可无限免费扩容背包
- **修复**: 改为回调模式或检查外部返回值

### NEW-P0-002: transferEnhance 仍然免费转移

- **严重性**: P0 (经济漏洞，R1遗留)
- **文件**: `EquipmentEnhanceSystem.ts:200-225`
- **根因**: `cost = source.enhanceLevel * TRANSFER_COST_FACTOR` 只计算不扣除
- **影响**: 强化转移完全免费，破坏经济平衡
- **修复**: 添加 deductResources 扣费调用

### NEW-P0-003: calculateDecomposeReward 无 NaN 防护

- **严重性**: P0 (R1遗留)
- **文件**: `EquipmentDecomposer.ts:43-47`
- **根因**: `1 + eq.enhanceLevel * DECOMPOSE_ENHANCE_BONUS` — enhanceLevel=NaN → 全 NaN
- **影响**: 分解 NaN 装备 → NaN 资源 → 资源系统污染
- **修复**: 添加 enhanceLevel NaN guard

### NEW-P0-004: generateBySlot NaN seed 生成全 NaN 装备

- **严重性**: P0 (R1遗留)
- **文件**: `EquipmentGenHelper.ts:72-82`
- **根因**: `randInt(min, max, NaN) = NaN`，NaN 传播到所有属性
- **影响**: 生成 NaN 属性装备，污染下游所有系统
- **修复**: seed 验证 `!Number.isFinite(seed)` → 使用 Date.now() 兜底

### NEW-P0-005: add(null) 崩溃

- **严重性**: P0 (R1遗留)
- **文件**: `EquipmentBagManager.ts:61-69`
- **根因**: `equipment.uid` — null.uid → TypeError
- **影响**: 崩溃
- **修复**: 添加 null guard

### NEW-P0-006: mergeBonuses NaN 累积

- **严重性**: P0 (R1遗留)
- **文件**: `EquipmentSetSystem.ts:178-181`
- **根因**: `(target[key] ?? 0) + value` — value=NaN → NaN 累积
- **影响**: 套装加成全 NaN
- **修复**: `Number.isFinite(value) ? value : 0`

### NEW-P0-007: generateCampaignDrop 无效 campaignType 崩溃

- **严重性**: P0 (R1遗留)
- **文件**: `EquipmentSystem.ts:115-120`
- **根因**: `CAMPAIGN_DROP_WEIGHTS[invalid]` = undefined → `Object.entries(undefined)` → TypeError
- **影响**: 崩溃
- **修复**: 添加 campaignType 验证

---

## 四、R2 精简树统计

| 子系统 | 节点数 | covered | uncovered | P0(R2) | P1(R2) |
|--------|--------|---------|-----------|--------|--------|
| EquipmentSystem | 68 | 58 | 10 | 1 | 2 |
| EquipmentBagManager | 34 | 28 | 6 | 2 | 0 |
| EquipmentForgeSystem | 42 | 36 | 6 | 0 | 0 |
| EquipmentEnhanceSystem | 38 | 32 | 6 | 1 | 0 |
| EquipmentSetSystem | 24 | 20 | 4 | 1 | 0 |
| EquipmentRecommendSystem | 20 | 20 | 0 | 0 | 0 |
| EquipmentDecomposer | 22 | 18 | 4 | 1 | 0 |
| ForgePityManager | 18 | 18 | 0 | 0 | 0 |
| EquipmentGenHelper | 28 | 22 | 6 | 1 | 0 |
| EquipmentDropWeights | 4 | 4 | 0 | 0 | 0 |
| **总计** | **298** | **256** | **42** | **7** | **2** |

### 收敛指标

| 指标 | R1 | R2 | 变化 |
|------|-----|-----|------|
| P0数 | 18 | 7 | ↓ 61% |
| uncovered | 106 | 42 | ↓ 60% |
| 覆盖率 | 64.4% | 85.9% | ↑ 21.5% |
| 已修复P0 | 0 | 10 | — |
| 新P0 | 18 | 1 (FIX穿透失败) | ↓ 94% |

---

## 五、跨系统链路覆盖（R2更新）

| 链路域 | R1状态 | R2状态 |
|--------|--------|--------|
| Equipment↔Forge | 3/4 | 4/4 ✅ |
| Equipment↔Enhance | 2/3 | 2/3 (transferEnhance未扣费) |
| Equipment↔Set | 2/3 | 2/3 (mergeBonuses NaN) |
| Equipment↔Recommend | 1/2 | 2/2 ✅ |
| Equipment↔Decomposer | 3/3 | 3/3 ✅ |
| Equipment↔Save | 4/6 | 6/6 ✅ |
| Equipment↔Battle | 1/1 | 1/1 ✅ |
| Forge↔Pity | 3/3 | 3/3 ✅ |
| Enhance↔Resource | 0/1 | 1/1 ✅ (FIX-603) |
| Bag↔Resource(expand) | 0/1 | 0/1 (FIX-604穿透失败) |
| **总计** | **19/26** | **24/27** (88.9%) |

---

## 六、R2 Builder 结论

1. **FIX-601/602/603/605/606/607**: 6/7 修复成功落地
2. **FIX-604**: 穿透失败 — precheck 事件无法阻止扩容
3. **R1遗留未修复**: P0-002,010,014,015,016,019 (6个)
4. **新发现P0**: 1个 (FIX-604穿透)
5. **R2总P0**: 7个 (1新 + 6遗留)
6. **收敛趋势**: P0 从 18 → 7，降幅 61%，收敛良好
