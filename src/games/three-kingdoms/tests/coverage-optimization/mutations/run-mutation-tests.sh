#!/bin/bash
# ============================================================
# 变异测试自动化脚本
# 三国霸业引擎 — Mutation Testing Runner
# ============================================================

set -e

WORKSPACE="/mnt/user-data/workspace"
MUT_DIR="$WORKSPACE/src/games/three-kingdoms/tests/coverage-optimization/mutations"
RESULTS_FILE="$MUT_DIR/results.txt"

# 清空结果文件
> "$RESULTS_FILE"

echo "============================================================"
echo "  三国霸业引擎 — 变异测试 (Mutation Testing)"
echo "============================================================"
echo ""

# ============================================================
# 模块1: EquipmentEnhanceSystem — 装备强化
# ============================================================
MODULE="EquipmentEnhanceSystem"
TARGET="$WORKSPACE/src/games/three-kingdoms/engine/equipment/EquipmentEnhanceSystem.ts"
TEST="$WORKSPACE/src/games/three-kingdoms/engine/equipment/__tests__/EquipmentEnhanceSystem.test.ts"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  模块: $MODULE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# --- Mutation E1: 算术变异 — newLevel = level + 1 → level - 1 ---
echo "[E1] 算术变异: level + 1 → level - 1"
cp "$TARGET" "$TARGET.bak"
sed -i 's/newLevel = level + 1;/newLevel = level - 1;/' "$TARGET"
cd "$WORKSPACE"
if npx vitest run "$TEST" --reporter=verbose 2>&1 | grep -q "FAIL\|failed"; then
  echo "  结果: KILLED ✅" | tee -a "$RESULTS_FILE"
  echo "E1|KILLED|$MODULE|算术变异: level + 1 → level - 1" >> "$RESULTS_FILE"
else
  echo "  结果: SURVIVED ❌" | tee -a "$RESULTS_FILE"
  echo "E1|SURVIVED|$MODULE|算术变异: level + 1 → level - 1" >> "$RESULTS_FILE"
fi
mv "$TARGET.bak" "$TARGET"

# --- Mutation E2: 比较变异 — >= → > (rarityCap check) ---
echo "[E2] 比较变异: enhanceLevel >= rarityCap → enhanceLevel > rarityCap"
cp "$TARGET" "$TARGET.bak"
sed -i 's/eq.enhanceLevel >= rarityCap/eq.enhanceLevel > rarityCap/' "$TARGET"
cd "$WORKSPACE"
if npx vitest run "$TEST" --reporter=verbose 2>&1 | grep -q "FAIL\|failed"; then
  echo "  结果: KILLED ✅" | tee -a "$RESULTS_FILE"
  echo "E2|KILLED|$MODULE|比较变异: enhanceLevel >= rarityCap → > rarityCap" >> "$RESULTS_FILE"
else
  echo "  结果: SURVIVED ❌" | tee -a "$RESULTS_FILE"
  echo "E2|SURVIVED|$MODULE|比较变异: enhanceLevel >= rarityCap → > rarityCap" >> "$RESULTS_FILE"
fi
mv "$TARGET.bak" "$TARGET"

# --- Mutation E3: 常量变异 — safeLevel check: level > ENHANCE_CONFIG.safeLevel → level >= ENHANCE_CONFIG.safeLevel ---
echo "[E3] 比较变异: level > safeLevel → level >= safeLevel"
cp "$TARGET" "$TARGET.bak"
sed -i 's/level > ENHANCE_CONFIG.safeLevel/level >= ENHANCE_CONFIG.safeLevel/' "$TARGET"
cd "$WORKSPACE"
if npx vitest run "$TEST" --reporter=verbose 2>&1 | grep -q "FAIL\|failed"; then
  echo "  结果: KILLED ✅" | tee -a "$RESULTS_FILE"
  echo "E3|KILLED|$MODULE|比较变异: level > safeLevel → level >= safeLevel" >> "$RESULTS_FILE"
else
  echo "  结果: SURVIVED ❌" | tee -a "$RESULTS_FILE"
  echo "E3|SURVIVED|$MODULE|比较变异: level > safeLevel → level >= safeLevel" >> "$RESULTS_FILE"
fi
mv "$TARGET.bak" "$TARGET"

# --- Mutation E4: 逻辑变异 — isGoldSafe check: && → || ---
echo "[E4] 逻辑变异: isGoldSafe条件 && → ||"
cp "$TARGET" "$TARGET.bak"
sed -i 's/eq.rarity === '\''gold'\'' && level >= 12/eq.rarity === '\''gold'\'' || level >= 12/' "$TARGET"
cd "$WORKSPACE"
if npx vitest run "$TEST" --reporter=verbose 2>&1 | grep -q "FAIL\|failed"; then
  echo "  结果: KILLED ✅" | tee -a "$RESULTS_FILE"
  echo "E4|KILLED|$MODULE|逻辑变异: gold && level>=12 → gold || level>=12" >> "$RESULTS_FILE"
else
  echo "  结果: SURVIVED ❌" | tee -a "$RESULTS_FILE"
  echo "E4|SURVIVED|$MODULE|逻辑变异: gold && level>=12 → gold || level>=12" >> "$RESULTS_FILE"
fi
mv "$TARGET.bak" "$TARGET"

# --- Mutation E5: 返回值变异 — transferEnhance: Math.max(0, ...) → Math.min(0, ...) ---
echo "[E5] 算术变异: Math.max(0, source.enhanceLevel - TRANSFER_LEVEL_LOSS) → Math.min(0, ...)"
cp "$TARGET" "$TARGET.bak"
sed -i 's/Math.max(0, source.enhanceLevel - TRANSFER_LEVEL_LOSS)/Math.min(0, source.enhanceLevel - TRANSFER_LEVEL_LOSS)/' "$TARGET"
cd "$WORKSPACE"
if npx vitest run "$TEST" --reporter=verbose 2>&1 | grep -q "FAIL\|failed"; then
  echo "  结果: KILLED ✅" | tee -a "$RESULTS_FILE"
  echo "E5|KILLED|$MODULE|返回值变异: Math.max(0,...) → Math.min(0,...)" >> "$RESULTS_FILE"
else
  echo "  结果: SURVIVED ❌" | tee -a "$RESULTS_FILE"
  echo "E5|SURVIVED|$MODULE|返回值变异: Math.max(0,...) → Math.min(0,...)" >> "$RESULTS_FILE"
fi
mv "$TARGET.bak" "$TARGET"

# --- Mutation E6: 常量变异 — protectionCost check: protCost > 0 → protCost >= 0 ---
echo "[E6] 比较变异: protCost > 0 → protCost >= 0"
cp "$TARGET" "$TARGET.bak"
sed -i 's/if (useProtection && protCost > 0)/if (useProtection \&\& protCost >= 0)/' "$TARGET"
cd "$WORKSPACE"
if npx vitest run "$TEST" --reporter=verbose 2>&1 | grep -q "FAIL\|failed"; then
  echo "  结果: KILLED ✅" | tee -a "$RESULTS_FILE"
  echo "E6|KILLED|$MODULE|比较变异: protCost > 0 → protCost >= 0" >> "$RESULTS_FILE"
else
  echo "  结果: SURVIVED ❌" | tee -a "$RESULTS_FILE"
  echo "E6|SURVIVED|$MODULE|比较变异: protCost > 0 → protCost >= 0" >> "$RESULTS_FILE"
fi
mv "$TARGET.bak" "$TARGET"

# --- Mutation E7: 语句删除 — 移除 protectionCount 减少 ---
echo "[E7] 语句删除: 移除 this.protectionCount -= protCost"
cp "$TARGET" "$TARGET.bak"
sed -i 's/this.protectionCount -= protCost;/\/\/ MUTATION: removed this.protectionCount -= protCost;/' "$TARGET"
cd "$WORKSPACE"
if npx vitest run "$TEST" --reporter=verbose 2>&1 | grep -q "FAIL\|failed"; then
  echo "  结果: KILLED ✅" | tee -a "$RESULTS_FILE"
  echo "E7|KILLED|$MODULE|语句删除: 移除 protectionCount -= protCost" >> "$RESULTS_FILE"
else
  echo "  结果: SURVIVED ❌" | tee -a "$RESULTS_FILE"
  echo "E7|SURVIVED|$MODULE|语句删除: 移除 protectionCount -= protCost" >> "$RESULTS_FILE"
fi
mv "$TARGET.bak" "$TARGET"

# --- Mutation E8: 返回值变异 — getSuccessRate: return ... ?? 0.01 → ?? 0.99 ---
echo "[E8] 常量变异: getSuccessRate fallback 0.01 → 0.99"
cp "$TARGET" "$TARGET.bak"
sed -i '/getSuccessRate(level: number)/,/return ENHANCE_CONFIG/s/return ENHANCE_CONFIG.successRates\[level\] ?? 0.01/return ENHANCE_CONFIG.successRates[level] ?? 0.99/' "$TARGET"
cd "$WORKSPACE"
if npx vitest run "$TEST" --reporter=verbose 2>&1 | grep -q "FAIL\|failed"; then
  echo "  结果: KILLED ✅" | tee -a "$RESULTS_FILE"
  echo "E8|KILLED|$MODULE|常量变异: getSuccessRate fallback 0.01 → 0.99" >> "$RESULTS_FILE"
else
  echo "  结果: SURVIVED ❌" | tee -a "$RESULTS_FILE"
  echo "E8|SURVIVED|$MODULE|常量变异: getSuccessRate fallback 0.01 → 0.99" >> "$RESULTS_FILE"
fi
mv "$TARGET.bak" "$TARGET"

# --- Mutation E9: 比较变异 — autoEnhance: totalCopper >= config.maxCopper → totalCopper > config.maxCopper ---
echo "[E9] 比较变异: totalCopper >= maxCopper → totalCopper > maxCopper"
cp "$TARGET" "$TARGET.bak"
sed -i 's/totalCopper >= config.maxCopper/totalCopper > config.maxCopper/' "$TARGET"
cd "$WORKSPACE"
if npx vitest run "$TEST" --reporter=verbose 2>&1 | grep -q "FAIL\|failed"; then
  echo "  结果: KILLED ✅" | tee -a "$RESULTS_FILE"
  echo "E9|KILLED|$MODULE|比较变异: totalCopper >= maxCopper → > maxCopper" >> "$RESULTS_FILE"
else
  echo "  结果: SURVIVED ❌" | tee -a "$RESULTS_FILE"
  echo "E9|SURVIVED|$MODULE|比较变异: totalCopper >= maxCopper → > maxCopper" >> "$RESULTS_FILE"
fi
mv "$TARGET.bak" "$TARGET"

# --- Mutation E10: 常量变异 — getStoneCost: Math.max(1, ...) → Math.max(0, ...) ---
echo "[E10] 常量变异: getStoneCost Math.max(1,...) → Math.max(0,...)"
cp "$TARGET" "$TARGET.bak"
sed -i 's/return Math.max(1, Math.floor(baseStone/return Math.max(0, Math.floor(baseStone/' "$TARGET"
cd "$WORKSPACE"
if npx vitest run "$TEST" --reporter=verbose 2>&1 | grep -q "FAIL\|failed"; then
  echo "  结果: KILLED ✅" | tee -a "$RESULTS_FILE"
  echo "E10|KILLED|$MODULE|常量变异: getStoneCost Math.max(1,...) → Math.max(0,...)" >> "$RESULTS_FILE"
else
  echo "  结果: SURVIVED ❌" | tee -a "$RESULTS_FILE"
  echo "E10|SURVIVED|$MODULE|常量变异: getStoneCost Math.max(1,...) → Math.max(0,...)" >> "$RESULTS_FILE"
fi
mv "$TARGET.bak" "$TARGET"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ============================================================
# 模块2: BuildingSystem — 建筑系统
# ============================================================
MODULE="BuildingSystem"
TARGET="$WORKSPACE/src/games/three-kingdoms/engine/building/BuildingSystem.ts"
TEST="$WORKSPACE/src/games/three-kingdoms/engine/__tests__/engine-building.test.ts"

echo "  模块: $MODULE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# --- Mutation B1: 比较变异 — state.level >= maxLv → state.level > maxLv ---
echo "[B1] 比较变异: state.level >= maxLv → state.level > maxLv"
cp "$TARGET" "$TARGET.bak"
sed -i 's/state.level >= maxLv/state.level > maxLv/' "$TARGET"
cd "$WORKSPACE"
if npx vitest run "$TEST" --reporter=verbose 2>&1 | grep -q "FAIL\|failed"; then
  echo "  结果: KILLED ✅" | tee -a "$RESULTS_FILE"
  echo "B1|KILLED|$MODULE|比较变异: state.level >= maxLv → > maxLv" >> "$RESULTS_FILE"
else
  echo "  结果: SURVIVED ❌" | tee -a "$RESULTS_FILE"
  echo "B1|SURVIVED|$MODULE|比较变异: state.level >= maxLv → > maxLv" >> "$RESULTS_FILE"
fi
mv "$TARGET.bak" "$TARGET"

# --- Mutation B2: 比较变异 — castle level check: >= → > ---
echo "[B2] 比较变异: state.level >= this.buildings.castle.level → > "
cp "$TARGET" "$TARGET.bak"
sed -i 's/state.level >= this.buildings.castle.level/state.level > this.buildings.castle.level/' "$TARGET"
cd "$WORKSPACE"
if npx vitest run "$TEST" --reporter=verbose 2>&1 | grep -q "FAIL\|failed"; then
  echo "  结果: KILLED ✅" | tee -a "$RESULTS_FILE"
  echo "B2|KILLED|$MODULE|比较变异: building level >= castle → >" >> "$RESULTS_FILE"
else
  echo "  结果: SURVIVED ❌" | tee -a "$RESULTS_FILE"
  echo "B2|SURVIVED|$MODULE|比较变异: building level >= castle → >" >> "$RESULTS_FILE"
fi
mv "$TARGET.bak" "$TARGET"

# --- Mutation B3: 算术变异 — cancelUpgrade refund: CANCEL_REFUND_RATIO → 1.0 ---
echo "[B3] 常量变异: CANCEL_REFUND_RATIO → hardcoded 1.0"
cp "$TARGET" "$TARGET.bak"
sed -i 's/Math.round(cost.grain \* CANCEL_REFUND_RATIO)/Math.round(cost.grain * 1.0)/' "$TARGET"
sed -i 's/Math.round(cost.gold \* CANCEL_REFUND_RATIO)/Math.round(cost.gold * 1.0)/' "$TARGET"
sed -i 's/Math.round(cost.troops \* CANCEL_REFUND_RATIO)/Math.round(cost.troops * 1.0)/' "$TARGET"
cd "$WORKSPACE"
if npx vitest run "$TEST" --reporter=verbose 2>&1 | grep -q "FAIL\|failed"; then
  echo "  结果: KILLED ✅" | tee -a "$RESULTS_FILE"
  echo "B3|KILLED|$MODULE|常量变异: CANCEL_REFUND_RATIO → 1.0" >> "$RESULTS_FILE"
else
  echo "  结果: SURVIVED ❌" | tee -a "$RESULTS_FILE"
  echo "B3|SURVIVED|$MODULE|常量变异: CANCEL_REFUND_RATIO → 1.0" >> "$RESULTS_FILE"
fi
mv "$TARGET.bak" "$TARGET"

# --- Mutation B4: 语句删除 — 移除 upgradeQueue push ---
echo "[B4] 语句删除: 移除 upgradeQueue.push"
cp "$TARGET" "$TARGET.bak"
sed -i 's/this.upgradeQueue.push({/\/\/ MUTATION: removed queue push ({/' "$TARGET"
sed -i '/\/\/ MUTATION: removed queue push/{N;N;N;d;}' "$TARGET"
cd "$WORKSPACE"
if npx vitest run "$TEST" --reporter=verbose 2>&1 | grep -q "FAIL\|failed"; then
  echo "  结果: KILLED ✅" | tee -a "$RESULTS_FILE"
  echo "B4|KILLED|$MODULE|语句删除: 移除 upgradeQueue.push" >> "$RESULTS_FILE"
else
  echo "  结果: SURVIVED ❌" | tee -a "$RESULTS_FILE"
  echo "B4|SURVIVED|$MODULE|语句删除: 移除 upgradeQueue.push" >> "$RESULTS_FILE"
fi
mv "$TARGET.bak" "$TARGET"

# --- Mutation B5: 逻辑变异 — checkAndUnlockBuildings: status === 'locked' → status !== 'locked' ---
echo "[B5] 逻辑变异: status === 'locked' → status !== 'locked'"
cp "$TARGET" "$TARGET.bak"
sed -i "s/if (s.status === 'locked' && this.checkUnlock/if (s.status !== 'locked' \&\& this.checkUnlock/" "$TARGET"
cd "$WORKSPACE"
if npx vitest run "$TEST" --reporter=verbose 2>&1 | grep -q "FAIL\|failed"; then
  echo "  结果: KILLED ✅" | tee -a "$RESULTS_FILE"
  echo "B5|KILLED|$MODULE|逻辑变异: status === 'locked' → !== 'locked'" >> "$RESULTS_FILE"
else
  echo "  结果: SURVIVED ❌" | tee -a "$RESULTS_FILE"
  echo "B5|SURVIVED|$MODULE|逻辑变异: status === 'locked' → !== 'locked'" >> "$RESULTS_FILE"
fi
mv "$TARGET.bak" "$TARGET"

# --- Mutation B6: 比较变异 — castle special: next === 5 → next === 6 ---
echo "[B6] 常量变异: castle next === 5 → next === 6"
cp "$TARGET" "$TARGET.bak"
sed -i 's/if (next === 5 && !BUILDING_TYPES/if (next === 6 \&\& !BUILDING_TYPES/' "$TARGET"
cd "$WORKSPACE"
if npx vitest run "$TEST" --reporter=verbose 2>&1 | grep -q "FAIL\|failed"; then
  echo "  结果: KILLED ✅" | tee -a "$RESULTS_FILE"
  echo "B6|KILLED|$MODULE|常量变异: castle next===5 → next===6" >> "$RESULTS_FILE"
else
  echo "  结果: SURVIVED ❌" | tee -a "$RESULTS_FILE"
  echo "B6|SURVIVED|$MODULE|常量变异: castle next===5 → next===6" >> "$RESULTS_FILE"
fi
mv "$TARGET.bak" "$TARGET"

# --- Mutation B7: 算术变异 — tick: state.level += 1 → state.level += 2 ---
echo "[B7] 算术变异: state.level += 1 → state.level += 2"
cp "$TARGET" "$TARGET.bak"
sed -i 's/state.level += 1;/state.level += 2;/' "$TARGET"
cd "$WORKSPACE"
if npx vitest run "$TEST" --reporter=verbose 2>&1 | grep -q "FAIL\|failed"; then
  echo "  结果: KILLED ✅" | tee -a "$RESULTS_FILE"
  echo "B7|KILLED|$MODULE|算术变异: state.level += 1 → += 2" >> "$RESULTS_FILE"
else
  echo "  结果: SURVIVED ❌" | tee -a "$RESULTS_FILE"
  echo "B7|SURVIVED|$MODULE|算术变异: state.level += 1 → += 2" >> "$RESULTS_FILE"
fi
mv "$TARGET.bak" "$TARGET"

# --- Mutation B8: 语句删除 — 移除 checkAndUnlockBuildings() 调用 ---
echo "[B8] 语句删除: 移除 castle升级后的 checkAndUnlockBuildings()"
cp "$TARGET" "$TARGET.bak"
sed -i 's/if (completed.includes('\''castle'\'')) this.checkAndUnlockBuildings();/\/\/ MUTATION: removed checkAndUnlockBuildings()/' "$TARGET"
cd "$WORKSPACE"
if npx vitest run "$TEST" --reporter=verbose 2>&1 | grep -q "FAIL\|failed"; then
  echo "  结果: KILLED ✅" | tee -a "$RESULTS_FILE"
  echo "B8|KILLED|$MODULE|语句删除: 移除 checkAndUnlockBuildings()" >> "$RESULTS_FILE"
else
  echo "  结果: SURVIVED ❌" | tee -a "$RESULTS_FILE"
  echo "B8|SURVIVED|$MODULE|语句删除: 移除 checkAndUnlockBuildings()" >> "$RESULTS_FILE"
fi
mv "$TARGET.bak" "$TARGET"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ============================================================
# 模块3: DamageCalculator — 伤害计算
# ============================================================
MODULE="DamageCalculator"
TARGET="$WORKSPACE/src/games/three-kingdoms/engine/battle/DamageCalculator.ts"
TEST="$WORKSPACE/src/games/three-kingdoms/engine/battle/__tests__/DamageCalculator.test.ts"

echo "  模块: $MODULE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# --- Mutation D1: 算术变异 — baseDamage: Math.max(1, rawDamage) → Math.max(0, rawDamage) ---
echo "[D1] 算术变异: Math.max(1, rawDamage) → Math.max(0, rawDamage)"
cp "$TARGET" "$TARGET.bak"
sed -i 's/const baseDamage = Math.max(1, rawDamage);/const baseDamage = Math.max(0, rawDamage);/' "$TARGET"
cd "$WORKSPACE"
if npx vitest run "$TEST" --reporter=verbose 2>&1 | grep -q "FAIL\|failed"; then
  echo "  结果: KILLED ✅" | tee -a "$RESULTS_FILE"
  echo "D1|KILLED|$MODULE|算术变异: Math.max(1, rawDamage) → Math.max(0, rawDamage)" >> "$RESULTS_FILE"
else
  echo "  结果: SURVIVED ❌" | tee -a "$RESULTS_FILE"
  echo "D1|SURVIVED|$MODULE|算术变异: Math.max(1, rawDamage) → Math.max(0, rawDamage)" >> "$RESULTS_FILE"
fi
mv "$TARGET.bak" "$TARGET"

# --- Mutation D2: 常量变异 — minDamage: MIN_DAMAGE_RATIO → hardcoded 0 ---
echo "[D2] 常量变异: MIN_DAMAGE_RATIO → 0 (移除最低伤害保底)"
cp "$TARGET" "$TARGET.bak"
sed -i 's/const minDamage = effectiveAttack \* BATTLE_CONFIG.MIN_DAMAGE_RATIO;/const minDamage = effectiveAttack * 0;/' "$TARGET"
cd "$WORKSPACE"
if npx vitest run "$TEST" --reporter=verbose 2>&1 | grep -q "FAIL\|failed"; then
  echo "  结果: KILLED ✅" | tee -a "$RESULTS_FILE"
  echo "D2|KILLED|$MODULE|常量变异: MIN_DAMAGE_RATIO → 0" >> "$RESULTS_FILE"
else
  echo "  结果: SURVIVED ❌" | tee -a "$RESULTS_FILE"
  echo "D2|SURVIVED|$MODULE|常量变异: MIN_DAMAGE_RATIO → 0" >> "$RESULTS_FILE"
fi
mv "$TARGET.bak" "$TARGET"

# --- Mutation D3: 返回值变异 — isControlled: some → every ---
echo "[D3] 逻辑变异: isControlled some() → every()"
cp "$TARGET" "$TARGET.bak"
sed -i 's/return unit.buffs.some(/return unit.buffs.every(/' "$TARGET"
cd "$WORKSPACE"
if npx vitest run "$TEST" --reporter=verbose 2>&1 | grep -q "FAIL\|failed"; then
  echo "  结果: KILLED ✅" | tee -a "$RESULTS_FILE"
  echo "D3|KILLED|$MODULE|逻辑变异: isControlled some() → every()" >> "$RESULTS_FILE"
else
  echo "  结果: SURVIVED ❌" | tee -a "$RESULTS_FILE"
  echo "D3|SURVIVED|$MODULE|逻辑变异: isControlled some() → every()" >> "$RESULTS_FILE"
fi
mv "$TARGET.bak" "$TARGET"

# --- Mutation D4: 比较变异 — applyDamage: defender.hp <= 0 → defender.hp < 0 ---
echo "[D4] 比较变异: defender.hp <= 0 → defender.hp < 0"
cp "$TARGET" "$TARGET.bak"
sed -i 's/if (defender.hp <= 0)/if (defender.hp < 0)/' "$TARGET"
cd "$WORKSPACE"
if npx vitest run "$TEST" --reporter=verbose 2>&1 | grep -q "FAIL\|failed"; then
  echo "  结果: KILLED ✅" | tee -a "$RESULTS_FILE"
  echo "D4|KILLED|$MODULE|比较变异: defender.hp <= 0 → < 0" >> "$RESULTS_FILE"
else
  echo "  结果: SURVIVED ❌" | tee -a "$RESULTS_FILE"
  echo "D4|SURVIVED|$MODULE|比较变异: defender.hp <= 0 → < 0" >> "$RESULTS_FILE"
fi
mv "$TARGET.bak" "$TARGET"

# --- Mutation D5: 语句删除 — 移除护盾扣除逻辑 ---
echo "[D5] 语句删除: 移除 reduceShield 调用"
cp "$TARGET" "$TARGET.bak"
sed -i 's/this.reduceShield(defender, shieldAbsorbed);/\/\/ MUTATION: removed reduceShield call/' "$TARGET"
cd "$WORKSPACE"
if npx vitest run "$TEST" --reporter=verbose 2>&1 | grep -q "FAIL\|failed"; then
  echo "  结果: KILLED ✅" | tee -a "$RESULTS_FILE"
  echo "D5|KILLED|$MODULE|语句删除: 移除 reduceShield 调用" >> "$RESULTS_FILE"
else
  echo "  结果: SURVIVED ❌" | tee -a "$RESULTS_FILE"
  echo "D5|SURVIVED|$MODULE|语句删除: 移除 reduceShield 调用" >> "$RESULTS_FILE"
fi
mv "$TARGET.bak" "$TARGET"

# --- Mutation D6: 逻辑变异 — getRestraintMultiplier: RESTRAINT_ADVANTAGE → RESTRAINT_DISADVANTAGE ---
echo "[D6] 常量变异: RESTRAINT_ADVANTAGE → RESTRAINT_DISADVANTAGE"
cp "$TARGET" "$TARGET.bak"
sed -i 's/return BATTLE_CONFIG.RESTRAINT_ADVANTAGE; \/\/ 克制：×1.5/return BATTLE_CONFIG.RESTRAINT_DISADVANTAGE; \/\/ MUTATION: 克制→被克制/' "$TARGET"
cd "$WORKSPACE"
if npx vitest run "$TEST" --reporter=verbose 2>&1 | grep -q "FAIL\|failed"; then
  echo "  结果: KILLED ✅" | tee -a "$RESULTS_FILE"
  echo "D6|KILLED|$MODULE|常量变异: RESTRAINT_ADVANTAGE → RESTRAINT_DISADVANTAGE" >> "$RESULTS_FILE"
else
  echo "  结果: SURVIVED ❌" | tee -a "$RESULTS_FILE"
  echo "D6|SURVIVED|$MODULE|常量变异: RESTRAINT_ADVANTAGE → RESTRAINT_DISADVANTAGE" >> "$RESULTS_FILE"
fi
mv "$TARGET.bak" "$TARGET"

# --- Mutation D7: 算术变异 — getAttackBonus: bonus += buff.value → bonus -= buff.value ---
echo "[D7] 算术变异: getAttackBonus bonus += buff.value → bonus -= buff.value"
cp "$TARGET" "$TARGET.bak"
sed -i '/if (buff.type === BuffType.ATK_UP)/{n;s/bonus += buff.value/bonus -= buff.value/}' "$TARGET"
cd "$WORKSPACE"
if npx vitest run "$TEST" --reporter=verbose 2>&1 | grep -q "FAIL\|failed"; then
  echo "  结果: KILLED ✅" | tee -a "$RESULTS_FILE"
  echo "D7|KILLED|$MODULE|算术变异: getAttackBonus += → -=" >> "$RESULTS_FILE"
else
  echo "  结果: SURVIVED ❌" | tee -a "$RESULTS_FILE"
  echo "D7|SURVIVED|$MODULE|算术变异: getAttackBonus += → -=" >> "$RESULTS_FILE"
fi
mv "$TARGET.bak" "$TARGET"

# --- Mutation D8: 比较变异 — rollCritical: Math.random() < rate → Math.random() <= rate ---
echo "[D8] 比较变异: rollCritical < rate → <= rate"
cp "$TARGET" "$TARGET.bak"
sed -i 's/return Math.random() < rate;/return Math.random() <= rate;/' "$TARGET"
cd "$WORKSPACE"
if npx vitest run "$TEST" --reporter=verbose 2>&1 | grep -q "FAIL\|failed"; then
  echo "  结果: KILLED ✅" | tee -a "$RESULTS_FILE"
  echo "D8|KILLED|$MODULE|比较变异: rollCritical < → <=" >> "$RESULTS_FILE"
else
  echo "  结果: SURVIVED ❌" | tee -a "$RESULTS_FILE"
  echo "D8|SURVIVED|$MODULE|比较变异: rollCritical < → <=" >> "$RESULTS_FILE"
fi
mv "$TARGET.bak" "$TARGET"

# --- Mutation D9: 算术变异 — effectiveAttack: (1 + atkBonus) → (1 - atkBonus) ---
echo "[D9] 算术变异: effectiveAttack (1 + atkBonus) → (1 - atkBonus)"
cp "$TARGET" "$TARGET.bak"
sed -i 's/const effectiveAttack = attacker.attack \* (1 + atkBonus);/const effectiveAttack = attacker.attack * (1 - atkBonus);/' "$TARGET"
cd "$WORKSPACE"
if npx vitest run "$TEST" --reporter=verbose 2>&1 | grep -q "FAIL\|failed"; then
  echo "  结果: KILLED ✅" | tee -a "$RESULTS_FILE"
  echo "D9|KILLED|$MODULE|算术变异: effectiveAttack (1+atkBonus) → (1-atkBonus)" >> "$RESULTS_FILE"
else
  echo "  结果: SURVIVED ❌" | tee -a "$RESULTS_FILE"
  echo "D9|SURVIVED|$MODULE|算术变异: effectiveAttack (1+atkBonus) → (1-atkBonus)" >> "$RESULTS_FILE"
fi
mv "$TARGET.bak" "$TARGET"

# --- Mutation D10: 语句删除 — 移除 isAlive 检查 ---
echo "[D10] 语句删除: 移除 applyDamage 的 isAlive 检查"
cp "$TARGET" "$TARGET.bak"
sed -i 's/if (!defender.isAlive) return 0;/\/\/ MUTATION: removed isAlive check/' "$TARGET"
cd "$WORKSPACE"
if npx vitest run "$TEST" --reporter=verbose 2>&1 | grep -q "FAIL\|failed"; then
  echo "  结果: KILLED ✅" | tee -a "$RESULTS_FILE"
  echo "D10|KILLED|$MODULE|语句删除: 移除 isAlive 检查" >> "$RESULTS_FILE"
else
  echo "  结果: SURVIVED ❌" | tee -a "$RESULTS_FILE"
  echo "D10|SURVIVED|$MODULE|语句删除: 移除 isAlive 检查" >> "$RESULTS_FILE"
fi
mv "$TARGET.bak" "$TARGET"

echo ""
echo "============================================================"
echo "  变异测试完成！"
echo "============================================================"
echo ""
echo "结果汇总："
cat "$RESULTS_FILE"
