# 装备模块对抗式测试 — R1 Challenger 挑战书

> 轮次: R1 | 挑战方: Challenger | 目标: Builder测试树 | 挑战维度: 5

---

## 挑战总评: 🟡 中等覆盖，存在显著盲区

Builder测试树覆盖了主要API路径，但以下维度存在系统性遗漏。

---

## 挑战一: 装备耐久/损坏 — 完全缺失 ❌ [严重度: P0]

**问题**: 需求明确要求覆盖"装备耐久/损坏"，但测试树中 **零个分支** 测试耐久相关逻辑。

**代码证据**: `EquipmentInstance` 接口无 `durability` 字段。需确认：
- 耐久系统是否已实现？
- 如果未实现，是否应标记为TODO？
- 如果已实现在其他模块，是否需要跨模块集成测试？

**建议补充**:
- D-09: 装备耐久度初始化
- D-10: 战斗消耗耐久
- D-11: 耐久归零→装备损坏/属性清零
- D-12: 修理恢复耐久

**影响**: 如耐久系统是PRD需求，当前为 **P0级遗漏**。

---

## 挑战二: 强化降级路径覆盖不足 ❌ [严重度: P0]

**问题**: B-05/B-06只测了"强化上限"的边界，但 **强化失败降级** 的核心路径测试不足：

**缺失场景**:
1. **安全等级内失败不降级** — enhanceLevel ≤ safeLevel(5)时失败，等级不变
2. **安全等级外失败50%降级** — enhanceLevel > 5时失败，50%概率降1级
3. **保护符防降级** — 有保护符时不降级，消耗保护符
4. **金色装备+12以上失败不降级** — 特殊金色保护规则
5. **降级后再次强化** — 降级→再强化的循环验证

**代码证据**:
```typescript
// EquipmentEnhanceSystem.ts L137-155
const isGoldSafe = eq.rarity === 'gold' && level >= 12;
if (level > ENHANCE_CONFIG.safeLevel && !isGoldSafe) {
  if (useProtection) { /* 不降级 */ }
  else {
    const downgradeRoll = this.randomFloat();
    if (downgradeRoll < ENHANCE_CONFIG.downgradeChance) {
      outcome = 'downgrade'; newLevel = level - 1;
    }
  }
}
```

**建议补充**:
- N-19: safeLevel内失败→等级不变
- N-20: safeLevel外失败→可能降级
- N-21: 金色+12失败→不降级
- N-22: 保护符消耗→protectionCount减少

---

## 挑战三: 保底机制路径覆盖不足 ⚠️ [严重度: P1]

**问题**: 测试树仅覆盖了正常锻造流程(N-13/14/15)，但 **保底触发** 的关键路径缺失：

**缺失场景**:
1. **基础炼制10次未出紫→第11次保底紫** — shouldTrigger('basic') = true
2. **高级炼制10次未出紫→保底紫** — shouldTrigger('advanced') = true
3. **定向炼制20次未出金→保底金** — shouldTrigger('targeted') = true
4. **保底触发后计数器重置** — update()返回true后pityState归零
5. **保底未触发时计数器递增** — 非紫/金产出时counter++

**代码证据**:
```typescript
// ForgePityManager.ts - update方法
if (RARITY_ORDER[outputRarity] >= RARITY_ORDER.purple) {
  this.pityState.basicBluePity = 0; // 重置
} else {
  this.pityState.basicBluePity++; // 递增
}
```

**建议补充**:
- N-23: 基础炼制保底紫触发
- N-24: 定向炼制保底金触发
- N-25: 保底后计数器归零
- B-17: 保底计数器溢出(>阈值后行为)

---

## 挑战四: 装备属性计算精度 ⚠️ [严重度: P1]

**问题**: X-01/X-02测试了属性计算，但缺少 **精度和一致性** 验证：

**缺失场景**:
1. **Math.floor截断验证** — calculateMainStatValue/calculateSubStatValue都用了Math.floor
2. **baseValue=0时的计算** — 返回0而非NaN
3. **baseValue为负数** — 返回0
4. **recalculateStats 副属性独立计算** — 每个subStat独立应用倍率
5. **calculatePower 特效权重×5** — specialEffect.value × 5

**代码证据**:
```typescript
// EquipmentSystem.ts calculateMainStatValue
if (!Number.isFinite(baseValue) || baseValue <= 0) return 0;
return Math.floor(baseValue * rarityMul * (1 + eq.enhanceLevel * ENHANCE_MAIN_STAT_FACTOR.min));
```

**建议补充**:
- B-18: baseValue=0 → 返回0
- B-19: baseValue=负数 → 返回0
- B-20: enhanceLevel=Infinity → 安全降级
- X-13: recalculateStats一致性(与手动计算对比)

---

## 挑战五: 并发/竞态场景 ⚠️ [严重度: P2]

**问题**: 装备系统在以下场景可能存在竞态问题，测试树完全未覆盖：

**缺失场景**:
1. **同一装备同时穿戴到两个武将** — equipItem的isEquipped检查是否原子
2. **强化过程中装备被分解** — enhance→updateEquipment vs decompose→removeFromBag
3. **锻造过程中装备被穿戴** — validateForgeInput检查isEquipped vs equipItem

**建议补充**:
- X-14: 同一装备并发穿戴
- X-15: 强化+分解竞态

---

## 挑战六: 排序/筛选覆盖不足 ⚠️ [严重度: P2]

**问题**: EquipmentBagManager有6种排序模式和筛选功能，测试树未覆盖：

**缺失场景**:
1. **sort('rarity_desc')** — 金→白排序
2. **sort('level_desc')** — 高强化→低强化
3. **sort('slot_type')** — weapon→armor→accessory→mount
4. **filter({ unequippedOnly: true })** — 只看未穿戴
5. **filter({ setOnly: true })** — 只看套装
6. **groupBySlot()** — 按部位分组

**建议补充**:
- N-26: 6种排序模式验证
- N-27: 筛选条件组合验证
- N-28: groupBySlot分组正确性

---

## 挑战七: 图鉴系统边缘路径 ⚠️ [严重度: P2]

**问题**: 图鉴更新逻辑有多个分支未测试：

**缺失场景**:
1. **首次发现图鉴** — updateCodex创建新条目
2. **重复获得同模板装备** — obtainCount++
3. **获得更高品质→bestRarity更新** — RARITY_ORDER比较
4. **获得更低品质→bestRarity不变** — 不降级

**建议补充**:
- N-29: 首次发现图鉴
- N-30: 重复获得→计数增加
- N-31: 品质更新逻辑

---

## 挑战八: 推荐系统评分权重 ⚠️ [严重度: P2]

**问题**: EquipmentRecommendSystem的评分公式有5个权重分量，测试树未验证：

**缺失场景**:
1. **evaluateEquipment评分公式正确性** — 5个权重×分数
2. **一键推荐recommend最优选择** — 选择最高分装备
3. **无可用装备时的推荐** — 返回null
4. **getClosestSetBonus 最近套装建议** — 返回最接近激活的套装

---

## 挑战九: 装备生成确定性 ⚠️ [严重度: P1]

**问题**: 装备生成使用seed，但测试树未验证确定性：

**缺失场景**:
1. **相同seed→相同装备** — generateEquipment两次同seed
2. **不同seed→不同装备** — 确认seed影响结果
3. **seed递增→不同装备** — seedCounter++机制

**建议补充**:
- N-32: seed确定性验证
- B-21: seed边界(0, -1, MAX_SAFE_INTEGER)

---

## 挑战总结

| 挑战 | 严重度 | 缺失分支数 | 覆盖缺口 |
|------|--------|-----------|---------|
| C1: 耐久/损坏 | P0 | 4 | 完全缺失 |
| C2: 强化降级 | P0 | 5 | 核心路径遗漏 |
| C3: 保底机制 | P1 | 5 | 关键路径缺失 |
| C4: 属性计算精度 | P1 | 5 | 精度验证不足 |
| C5: 并发竞态 | P2 | 2 | 未覆盖 |
| C6: 排序筛选 | P2 | 3 | 未覆盖 |
| C7: 图鉴边缘 | P2 | 3 | 未覆盖 |
| C8: 推荐评分 | P2 | 4 | 未覆盖 |
| C9: 生成确定性 | P1 | 2 | 未覆盖 |
| **合计** | — | **33** | — |

**当前覆盖率评估**: ~65% (68/101分支)
**封版线**: 9.0 → 当前预估: **7.2** ❌ 未达标
