# Round 6: 变异测试

> 执行时间: 2025-01-XX
> 变异测试范围: 3个核心文件 × 3个变异 = 9个变异

## 变异结果

| 变异ID | 目标文件 | 变异描述 | 测试失败数 | 结果 |
|--------|---------|---------|-----------|------|
| M1 | DamageCalculator.ts | 最终伤害计算：乘法→加法 (`damageAfterSkill * criticalMultiplier * restraintMultiplier * randomFactor` → `+`) | 4 failed / 37 total | ✅ 杀死 |
| M2 | DamageCalculator.ts | 暴击倍率改为1.0 (`BATTLE_CONFIG.CRITICAL_MULTIPLIER` → `1.0`) | 1 failed / 37 total | ✅ 杀死 |
| M3 | DamageCalculator.ts | 防御减免改为0 (`effectiveDefense = 0`) | 8 failed / 37 total | ✅ 杀死 |
| M4 | BuildingSystem.ts | 升级消耗返回值全改为0 (`{ grain:0, gold:0, troops:0, timeSeconds:0 }`) | 9 failed / 62 total | ✅ 杀死 |
| M5 | BuildingSystem.ts | 等级上限检查改大 (`>= maxLv` → `>= maxLv + 100`) | 4 failed / 62 total | ✅ 杀死 |
| M6 | BuildingSystem.ts | 建筑完成判定条件改为永远不完成 (`now >= slot.endTime` → `now >= slot.endTime + 999999999`) | 6 failed / 62 total | ✅ 杀死 |
| M7 | EquipmentEnhanceSystem.ts | 强化成功率改为1.0 (`getSuccessRate` 始终返回1.0) | 2 failed / 33 total | ✅ 杀死 |
| M8 | EquipmentEnhanceSystem.ts | 强化成功等级不变 (`newLevel = level + 1` → `level`) | 5 failed / 33 total | ✅ 杀死 |
| M9 | EquipmentEnhanceSystem.ts | 等级上限检查改为+5 (`>= maxLevel` → `>= maxLevel + 5`) | 0 failed / 33 total | ❌ **存活** |

## 变异杀死率: 8/9 = 88.9%

## 存活变异分析

### M9: 等级上限检查被绕过 — 测试盲区

**变异内容**: 将 `eq.enhanceLevel >= ENHANCE_CONFIG.maxLevel` 改为 `eq.enhanceLevel >= ENHANCE_CONFIG.maxLevel + 5`，即允许装备强化超过最大等级5级。

**存活原因**: 现有测试没有构造"装备已达到最大强化等级时再次强化应被拒绝"的测试用例。测试覆盖了正常强化流程、降级、保护符、自动强化、转移等场景，但缺少**边界值测试**：在 `enhanceLevel === maxLevel` 时调用 `enhance()` 应返回失败。

**影响评估**: P1 严重。如果该检查被绕过，玩家可以将装备强化到超出设计上限的等级，破坏游戏平衡。

### 补充测试建议

```typescript
// 建议在 EquipmentEnhanceSystem.test.ts 中添加:

describe('EquipmentEnhanceSystem — 等级上限边界', () => {
  it('已达最大强化等级时应拒绝强化', () => {
    // 将装备设置为 maxLevel，调用 enhance 应返回 fail
    const eq = equipmentSystem.getEquipment(uid);
    equipmentSystem.updateEquipment({ ...eq, enhanceLevel: ENHANCE_CONFIG.maxLevel });
    const result = enhance.enhance(uid);
    expect(result.outcome).toBe('fail');
    expect(result.currentLevel).toBe(ENHANCE_CONFIG.maxLevel);
  });

  it('已达品质强化上限时应拒绝强化', () => {
    // 测试不同品质装备的强化上限
    // 例如: 白色装备上限低于 maxLevel
    const whiteEq = createEquipment('white');
    equipmentSystem.updateEquipment({ ...whiteEq, enhanceLevel: RARITY_ENHANCE_CAP.white });
    const result = enhance.enhance(whiteEq.uid);
    expect(result.outcome).toBe('fail');
  });

  it('强化成功后等级不应超过品质上限', () => {
    // 在品质上限-1时强化成功，验证不会超过上限
    // 即使 getSuccessRate 返回成功，等级也不能超过品质上限
  });
});
```

## 总结

| 文件 | 杀死/总数 | 杀死率 |
|------|----------|-------|
| DamageCalculator.ts | 3/3 | 100% |
| BuildingSystem.ts | 3/3 | 100% |
| EquipmentEnhanceSystem.ts | 2/3 | 66.7% |
| **总计** | **8/9** | **88.9%** |

### 关键发现

1. **DamageCalculator 测试质量最高**：伤害公式、暴击、防御三大核心逻辑均有充分测试覆盖，变异全部被杀死。
2. **BuildingSystem 测试覆盖良好**：升级费用、等级上限、完成判定均有对应断言。
3. **EquipmentEnhanceSystem 存在测试盲区**：缺少等级上限边界测试，建议优先补充。

### 改进优先级

1. 🔴 **P1**: 为 EquipmentEnhanceSystem 添加 `maxLevel` 边界测试（M9 存活）
2. 🟡 **P2**: 考虑添加品质强化上限 (`RARITY_ENHANCE_CAP`) 的独立测试用例
3. 🟢 **P3**: 可考虑添加更多 DamageCalculator 边界值测试（如极端攻击/防御比例）
