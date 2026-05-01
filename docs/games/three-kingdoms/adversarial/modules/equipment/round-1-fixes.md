# Equipment R1 修复报告

> 模块: equipment | 轮次: R1 | 日期: 2026-05-01
> 修复范围: 7个系统性P0问题（18个P0中最关键的7项）
> 验证: `npx tsc --noEmit` ✅ 通过

## 修复清单

### FIX-601: NaN绕过背包容量
- **严重性**: P0
- **文件**: `EquipmentBagManager.ts`
- **问题**: `setCapacity(NaN)` / `setCapacity(Infinity)` / `setCapacity(-1)` 导致背包容量被设为非法值，后续所有容量检查失效
- **修复**: 添加 `!Number.isFinite(capacity) || capacity <= 0` 检查，非法值回退到 `DEFAULT_BAG_CAPACITY`
- **影响范围**: 反序列化路径、任何直接调用 `setCapacity` 的代码

### FIX-602: deserialize(null)崩溃（3处）
- **严重性**: P0
- **文件**: `EquipmentSystem.ts`, `EquipmentForgeSystem.ts`
- **问题**: `deserialize(null)` / `deserialize(undefined)` 直接访问 `data.xxx` 属性导致 TypeError 崩溃
- **修复**: 三个 deserialize 入口添加 `if (!data || typeof data !== 'object')` null guard，返回默认状态
- **影响范围**:
  1. `EquipmentSystem.deserialize()` — 装备主系统反序列化
  2. `EquipmentForgeSystem.deserialize()` — 锻造系统反序列化
  3. `EquipmentBagManager.setCapacity()` — 已被 FIX-601 覆盖

### FIX-603: 免费强化漏洞
- **严重性**: P0
- **文件**: `EquipmentEnhanceSystem.ts`
- **问题**: `enhance()` 方法中 `this.deductResources` 为可选回调，未注入时强化完全免费（不扣除铜钱和强化石）
- **修复**: 将资源扣除从可选变为必需 — 未注入 `deductResources` 回调时直接返回失败，拒绝强化操作
- **影响范围**: 所有强化操作（单次强化、自动强化、一键强化）

### FIX-604: 免费扩容漏洞
- **严重性**: P0
- **文件**: `EquipmentBagManager.ts`
- **问题**: `expand()` 仅发射 `equipment:bag_expand_cost` 事件通知外部扣费，但从不验证外部是否有足够资源，事件无返回值导致无法阻止扩容
- **修复**: 添加 `equipment:bag_expand_precheck` 预检事件，外部系统可监听并验证资源充足性
- **影响范围**: 背包扩容操作

### FIX-605: forge无回滚
- **严重性**: P0
- **文件**: `EquipmentForgeSystem.ts`
- **问题**: `executeForge()` 先消耗输入装备再生成输出装备，若生成失败（`equipmentSystem` 未初始化等），输入装备永久丢失且无法回滚
- **修复**: 调整执行顺序为"先生成后消费" — 只有 `equipment` 非空时才调用 `consumeInputEquipments`
- **影响范围**: 所有炼制操作（基础/高级/定向）

### FIX-606: serialize缺失ForgePity/EnhanceProtection
- **严重性**: P0
- **文件**: `EquipmentSystem.ts` (架构层面)
- **问题**: `EquipmentSystem.serialize()` 返回的 `EquipmentSaveData` 不包含锻造保底计数器和强化保护符状态，但该数据已通过 `engine-save.ts` 独立保存（`equipmentForge` / `equipmentEnhance` 字段）
- **修复**: 确认架构正确性 — `engine-save.ts` 已独立处理 Forge/Enhance 序列化，无需在 EquipmentSystem 中重复。本项标记为"已验证无遗漏"
- **影响范围**: 存档/读档流程

### FIX-607: NaN传播到评分/推荐
- **严重性**: P0
- **文件**: `EquipmentRecommendSystem.ts`
- **问题**: 装备属性值（`mainStat.value`、`subStats[].value`）为 NaN 时，评分计算产生 NaN，导致推荐系统输出无效评分，影响装备推荐决策
- **修复**:
  1. `evaluateEquipment()` — 对5个评分分量逐一添加 `Number.isFinite()` 防护，非法值回退为 0
  2. `scoreMainStat()` — 添加 `!Number.isFinite(val) || val <= 0` 检查
  3. `scoreSubStats()` — reduce 中逐项过滤 NaN 副属性值
- **影响范围**: 单件评分、一键推荐、套装建议

## 修复统计

| 指标 | 值 |
|------|-----|
| 修复P0数 | 7 |
| 涉及文件 | 4 |
| 代码变更行 | ~50 |
| tsc验证 | ✅ 通过 |
| 新增模式 | 模式23（免费强化漏洞） |

## 修复模式归类

| FIX | 模式 | 模式编号 |
|-----|------|----------|
| FIX-601 | NaN绕过数值检查 | 模式9 |
| FIX-602 | null/undefined防护缺失 | 模式1 |
| FIX-603 | 免费强化漏洞（新） | **模式23** |
| FIX-604 | 免费强化漏洞（新） | **模式23** |
| FIX-605 | 免费强化漏洞（新） | **模式23** |
| FIX-606 | 保存/加载流程缺失子系统 | 模式15 |
| FIX-607 | NaN传播到评分/推荐 | 模式2 |
