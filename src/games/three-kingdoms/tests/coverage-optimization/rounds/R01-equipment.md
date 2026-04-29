# Round 1: equipment 模块盲区扫描

**日期**: 2025-04-27
**执行人**: Tester Agent
**状态**: ✅ 全部通过

## 扫描结果

- 发现无覆盖文件: **10个**（EquipmentGenerator、EquipmentBagManager、ForgePityManager、EquipmentDecomposer、EquipmentForgeSystem、EquipmentEnhanceSystem、EquipmentSetSystem、EquipmentRecommendSystem、EquipmentGenHelper、EquipmentDropWeights）
- 已有覆盖文件: **2个**（EquipmentSystem.ts — 通过 EquipmentSystem-p1/p2.test.ts、equipment-v10-p1/p2.test.ts 覆盖）
- 新增测试文件: **10个**
- 新增测试用例: **249个**
- 全部测试通过: 746/746 ✅

## 新增测试文件清单

| 测试文件 | 测试数 | 覆盖源文件 |
|---------|--------|-----------|
| `EquipmentGenerator.test.ts` | 42 | EquipmentGenerator.ts |
| `EquipmentBagManager.test.ts` | 35 | EquipmentBagManager.ts |
| `ForgePityManager.test.ts` | 23 | ForgePityManager.ts |
| `EquipmentDecomposer.test.ts` | 20 | EquipmentDecomposer.ts |
| `EquipmentForgeSystem.test.ts` | 26 | EquipmentForgeSystem.ts |
| `EquipmentEnhanceSystem.test.ts` | 33 | EquipmentEnhanceSystem.ts |
| `EquipmentSetSystem.test.ts` | 22 | EquipmentSetSystem.ts |
| `EquipmentRecommendSystem.test.ts` | 14 | EquipmentRecommendSystem.ts |
| `EquipmentGenHelper.test.ts` | 22 | EquipmentGenHelper.ts |
| `EquipmentDropWeights.test.ts` | 12 | EquipmentDropWeights.ts |

## 覆盖的源文件及函数/方法

### EquipmentGenerator.ts (42 tests)
- `generateUid()` — UID格式、唯一性、重置
- `randInt(min, max, seed)` — 范围、确定性、边界
- `randFloat(min, max, seed)` — 范围、确定性
- `seedPick(arr, seed)` — 选取、确定性、空数组
- `weightedPickRarity(weights, seed)` — 权重选取、零权重、空权重
- `isSlot(value)` — 合法部位识别、非法字符串
- `generateBySlot(slot, rarity, source, seed)` — 完整实例生成、所有部位×品质组合、名称前缀、来源记录、确定性
- `generateByTemplate(templateId, rarity, seed)` — 有效/无效模板、主属性一致性
- `genMainStat(slot, rarity, seed)` — 类型正确性、范围验证、倍率计算
- `genSubStats(slot, rarity, seed)` — 数量范围、去重、池类型、池大小限制
- `genSpecialEffect(slot, rarity, seed)` — 白/绿无词条、金必出、类型在池中、描述格式

### EquipmentBagManager.ts (35 tests)
- `add(equipment)` — 成功添加、幂等、背包满、事件触发
- `get(uid)` — 存在/不存在
- `remove(uid)` / `removeFromBag(uid)` — 成功/失败、已穿戴不可移除、事件触发
- `update(eq)` — 更新/静默忽略
- `getAll()` / `getUsedCount()` / `getSize()` — 数量一致性
- `getCapacity()` / `isFull()` — 默认容量、满载判断
- `expand()` — 成功扩容、达上限、双事件
- `sort(mode, list?)` — 6种排序模式、不修改原数组、自定义列表
- `filter(filter)` — 部位/品质/未穿戴/套装筛选
- `groupBySlot()` — 正确分组
- `reset()` — 清空+恢复容量

### ForgePityManager.ts (23 tests)
- `getState()` — 初始状态、快照非引用
- `shouldTrigger(type)` — 未达/达阈值
- `getPityRarity(type)` — basic→紫、advanced→紫、targeted→金
- `update(type, outputRarity)` — 计数器递增/重置、保底触发返回true、互不影响
- `getThreshold(type)` / `getProgress(type)` — 阈值查询、进度查询
- `restore(state)` / `reset()` — 序列化/反序列化

### EquipmentDecomposer.ts (20 tests)
- `calculateDecomposeReward(eq)` — 各品质基础奖励、强化等级加成
- `getDecomposePreview(uid)` — 存在/不存在
- `decomposeSingle(uid)` — 成功/不存在/已穿戴、事件触发
- `decompose(uidOrUids)` — 字符串→单件、数组→批量
- `batchDecompose(uids)` — 批量成功、跳过已穿戴和不存在、空列表
- `decomposeAllUnequipped(getAll)` — 只分解未穿戴、空结果
- 图鉴: `isCodexDiscovered` / `getCodexEntry` / `updateCodex` — 发现、计数、品质记录

### EquipmentForgeSystem.ts (26 tests)
- ISubsystem接口: name、init、update、reset
- `basicForge(uids)` — 3件白成功、数量不足、品质不一致、已穿戴不可、金色不可、不存在、消耗验证、计数递增
- `advancedForge(uids)` — 5件绿成功、数量不足
- `targetedForge(...)` — 3件蓝+指定部位、自动选材、无参数
- 品质确定: 白色输入范围、紫色→金
- `getForgeCostPreview(type)` / `getForgeCost(type)` — 费用预览
- `serialize()` / `deserialize(data)` — 序列化
- 无装备系统场景

### EquipmentEnhanceSystem.ts (33 tests)
- ISubsystem接口: name、reset
- `getSuccessRate(level)` / `getCopperCost(level)` / `getStoneCost(level)` / `getProtectionCost(level)` — 查询验证
- `enhance(uid)` — 不存在、0→1→2→3成功、品质上限、最大等级、资源不足、属性更新
- `autoEnhance(uid, config)` — 目标等级、不存在、铜钱耗尽、石头耗尽、100步安全停止
- `transferEnhance(src, tgt)` — 成功转移、源等级0失败、不存在
- `batchEnhance(uids)` — 批量成功、空列表、不存在跳过、最大等级跳过
- 保护符: addProtection、累加、serialize/deserialize

### EquipmentSetSystem.ts (22 tests)
- ISubsystem接口: name、update、getState
- `getAllSetDefs()` / `getSetDef(id)` / `getAllSetIds()` — 定义查询
- `getSetCounts(heroId)` — 空Map、正确统计、无套装不计
- `getActiveSetBonuses(heroId)` — 无装备、1件不激活、2件激活2件套
- `getTotalSetBonuses(heroId)` — 加成聚合、空对象
- `getClosestSetBonus(heroId)` — null、差距1、已激活阈值
- `getSetCompletionEquipments(heroId)` — 返回可凑套装装备、空

### EquipmentRecommendSystem.ts (14 tests)
- ISubsystem接口: name、update、getState
- `evaluateEquipment(eq, heroId)` — 完整评分、高品质>低品质、强化等级影响、小数位
- `recommendForHero(heroId)` — 空推荐、有装备推荐、最优选择、评分求和
- 套装建议、品质评分验证

### EquipmentGenHelper.ts (22 tests)
- `generateUid()` / `resetUidCounter()` — 格式、唯一性
- `seedPick(arr, seed)` — 选取、确定性
- `weightedPickRarity(weights, seed)` — 选取、零权重、空权重
- `isSlot(value)` — 合法/非法
- `generateBySlot(...)` — 完整实例、所有部位/品质
- `generateByTemplate(...)` — 有效/无效
- `genMainStat(...)` — 类型、范围
- `genSubStats(...)` — 数量范围（池限制）、去重、类型在池中
- `genSpecialEffect(...)` — 白/绿无、金必出

### EquipmentDropWeights.ts (12 tests)
- `CAMPAIGN_DROP_WEIGHTS` — 所有类型、所有品质、非负、normal白最高、boss金最高、normal无金、权重和>0
- `SOURCE_RARITY_WEIGHTS` — equipment_box/event存在、装备箱无白绿、紫色最高、非零为正

## 发现的问题

### P2 — 设计问题

1. **副属性数量受池大小限制**: `genSubStats` 在 `EquipmentGenerator.ts` 和 `EquipmentGenHelper.ts` 中，金色品质配置 `[4, 4]` 条副属性，但武器副属性池只有 3 种类型（critRate、critDamage、hitRate），去重后最多 3 条。配置与实际可生成数量不一致。
   - **影响**: 金色武器永远无法达到 4 条副属性的配置上限
   - **建议**: 扩大副属性池或调整品质配置

2. **副属性 value 计算使用原始浮点数**: `genSubStats` 中 `value = Math.floor(rawBaseValue * multiplier)` 而 `baseValue = Math.floor(rawBaseValue)`，导致 `value ≠ Math.floor(storedBaseValue * multiplier)`。
   - **影响**: 存储的 `baseValue` 无法精确反推 `value`
   - **建议**: 统一使用 `Math.floor` 后的值计算

3. **`ForgePityManager.update()` 在触发时重置计数器**: `shouldTrigger` 和 `update` 是分离的，`update` 触发保底后会立即重置计数器。如果先调用 `shouldTrigger` 检查，再调用 `update`，则 `shouldTrigger` 返回 true 后计数器被重置，第二次调用 `shouldTrigger` 返回 false。
   - **影响**: UI 显示保底进度时可能出现竞态
   - **建议**: 在 `EquipmentForgeSystem` 中确保 `shouldTrigger` 和 `update` 的调用顺序一致

4. **`EquipmentForgeSystem.batchEnhance` 只检查 `maxLevel` 不检查品质上限**: `batchEnhance` 跳过条件是 `eq.enhanceLevel >= ENHANCE_CONFIG.maxLevel`，而不是 `RARITY_ENHANCE_CAP`。白色装备（上限5级）在5级时仍会被尝试强化，然后由 `enhance` 方法内部返回失败。
   - **影响**: 不影响正确性，但产生无意义的 fail 结果
   - **建议**: 在 `batchEnhance` 中增加品质上限检查

## 评估指标

- 装备模块源文件: 12个（不含 index.ts、equipment-reexports.ts）
- 之前有覆盖文件: 2个（EquipmentSystem.ts — 已有测试）
- 之前无覆盖文件: 10个
- 新增测试覆盖: 10个
- **装备模块 BSI: ~8% → ~92%**（估算，基于 10/12 文件现在有直接测试覆盖）
- 新增测试用例: 249个
- 全部通过: ✅ 746/746
