#!/bin/bash
# ============================================================
# 变异测试自动化脚本 — Bash版本
# 三国霸业引擎 — Mutation Testing Runner
# ============================================================

set -e

W="/mnt/user-data/workspace"
MUT_DIR="$W/src/games/three-kingdoms/tests/coverage-optimization/mutations"
RESULTS="$MUT_DIR/mutation-results.txt"
JSON_RESULTS="$MUT_DIR/mutation-results.json"

# 清空结果
> "$RESULTS"
echo '{"mutations": []}' > "$JSON_RESULTS"

KILLED=0
SURVIVED=0
TOTAL=0

run_mutation() {
    local ID="$1"
    local MODULE="$2"
    local TARGET="$3"
    local TEST="$4"
    local DESC="$5"
    local CATEGORY="$6"
    local OLD="$7"
    local NEW="$8"
    
    TOTAL=$((TOTAL + 1))
    
    echo "[$ID] $DESC"
    
    # 备份
    cp "$TARGET" "$TARGET.bak"
    
    # 应用变异
    # 使用 Python 进行精确替换
    python3 -c "
import sys
target = sys.argv[1]
old = sys.argv[2]
new = sys.argv[3]
with open(target, 'r') as f:
    content = f.read()
if old not in content:
    print('NOT_FOUND')
    sys.exit(1)
content = content.replace(old, new, 1)
with open(target, 'w') as f:
    f.write(content)
print('OK')
" "$TARGET" "$OLD" "$NEW"
    
    if [ $? -ne 0 ]; then
        echo "  ⚠️ 变异未应用（代码未找到），跳过"
        mv "$TARGET.bak" "$TARGET"
        return
    fi
    
    # 运行测试
    cd "$W"
    local OUTPUT
    OUTPUT=$(npx vitest run "$TEST" --reporter=verbose 2>&1 || true)
    
    # 检查是否有失败
    if echo "$OUTPUT" | grep -q "Tests.*failed\|FAIL\|❌\|✕"; then
        echo "  结果: KILLED ✅"
        echo "$ID|KILLED|$MODULE|$CATEGORY|$DESC" >> "$RESULTS"
        KILLED=$((KILLED + 1))
    else
        echo "  结果: SURVIVED ❌"
        echo "$ID|SURVIVED|$MODULE|$CATEGORY|$DESC" >> "$RESULTS"
        SURVIVED=$((SURVIVED + 1))
    fi
    
    # 恢复
    mv "$TARGET.bak" "$TARGET"
}

echo "============================================================"
echo "  三国霸业引擎 — 变异测试 (Mutation Testing)"
echo "============================================================"
echo ""

# ============================================================
# 模块1: EquipmentEnhanceSystem — 装备强化
# ============================================================
EQ="$W/src/games/three-kingdoms/engine/equipment/EquipmentEnhanceSystem.ts"
EQ_TEST="$W/src/games/three-kingdoms/engine/equipment/__tests__/EquipmentEnhanceSystem.test.ts"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  模块: EquipmentEnhanceSystem — 装备强化"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

run_mutation "E1" "EquipmentEnhanceSystem" "$EQ" "$EQ_TEST" \
    "算术变异: newLevel = level + 1 → level - 1" "算术" \
    "      newLevel = level + 1;" \
    "      newLevel = level - 1;"

run_mutation "E2" "EquipmentEnhanceSystem" "$EQ" "$EQ_TEST" \
    "比较变异: enhanceLevel >= rarityCap → > rarityCap" "比较" \
    "eq.enhanceLevel >= rarityCap" \
    "eq.enhanceLevel > rarityCap"

run_mutation "E3" "EquipmentEnhanceSystem" "$EQ" "$EQ_TEST" \
    "比较变异: level > safeLevel → level >= safeLevel" "比较" \
    "level > ENHANCE_CONFIG.safeLevel" \
    "level >= ENHANCE_CONFIG.safeLevel"

run_mutation "E4" "EquipmentEnhanceSystem" "$EQ" "$EQ_TEST" \
    "逻辑变异: gold && level>=12 → gold || level>=12" "逻辑" \
    "eq.rarity === 'gold' && level >= 12" \
    "eq.rarity === 'gold' || level >= 12"

run_mutation "E5" "EquipmentEnhanceSystem" "$EQ" "$EQ_TEST" \
    "返回值变异: Math.max(0,...) → Math.min(0,...)" "返回值" \
    "Math.max(0, source.enhanceLevel - TRANSFER_LEVEL_LOSS)" \
    "Math.min(0, source.enhanceLevel - TRANSFER_LEVEL_LOSS)"

run_mutation "E6" "EquipmentEnhanceSystem" "$EQ" "$EQ_TEST" \
    "比较变异: protCost > 0 → protCost >= 0" "比较" \
    "if (useProtection && protCost > 0)" \
    "if (useProtection && protCost >= 0)"

run_mutation "E7" "EquipmentEnhanceSystem" "$EQ" "$EQ_TEST" \
    "语句删除: 移除 protectionCount -= protCost" "语句删除" \
    "          this.protectionCount -= protCost;" \
    "          // MUTATION: removed protectionCount decrement;"

run_mutation "E8" "EquipmentEnhanceSystem" "$EQ" "$EQ_TEST" \
    "常量变异: getSuccessRate fallback 0.01 → 0.99" "常量" \
    "return ENHANCE_CONFIG.successRates[level] ?? 0.01;" \
    "return ENHANCE_CONFIG.successRates[level] ?? 0.99;"

run_mutation "E9" "EquipmentEnhanceSystem" "$EQ" "$EQ_TEST" \
    "比较变异: totalCopper >= maxCopper → > maxCopper" "比较" \
    "if (totalCopper >= config.maxCopper) break;" \
    "if (totalCopper > config.maxCopper) break;"

run_mutation "E10" "EquipmentEnhanceSystem" "$EQ" "$EQ_TEST" \
    "常量变异: getStoneCost Math.max(1,...) → Math.max(0,...)" "常量" \
    "return Math.max(1, Math.floor(baseStone" \
    "return Math.max(0, Math.floor(baseStone"

echo ""

# ============================================================
# 模块2: BuildingSystem — 建筑系统
# ============================================================
BLD="$W/src/games/three-kingdoms/engine/building/BuildingSystem.ts"
BLD_TEST="$W/src/games/three-kingdoms/engine/__tests__/engine-building.test.ts"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  模块: BuildingSystem — 建筑系统"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

run_mutation "B1" "BuildingSystem" "$BLD" "$BLD_TEST" \
    "比较变异: state.level >= maxLv → > maxLv" "比较" \
    "state.level >= maxLv" \
    "state.level > maxLv"

run_mutation "B2" "BuildingSystem" "$BLD" "$BLD_TEST" \
    "比较变异: building level >= castle → > castle" "比较" \
    "state.level >= this.buildings.castle.level" \
    "state.level > this.buildings.castle.level"

run_mutation "B3" "BuildingSystem" "$BLD" "$BLD_TEST" \
    "常量变异: CANCEL_REFUND_RATIO → 1.0 (全额退款)" "常量" \
    "Math.round(cost.grain * CANCEL_REFUND_RATIO)" \
    "Math.round(cost.grain * 1.0)"

run_mutation "B4" "BuildingSystem" "$BLD" "$BLD_TEST" \
    "逻辑变异: status === locked → !== locked" "逻辑" \
    "if (s.status === 'locked' && this.checkUnlock" \
    "if (s.status !== 'locked' && this.checkUnlock"

run_mutation "B5" "BuildingSystem" "$BLD" "$BLD_TEST" \
    "常量变异: castle next===5 → next===6" "常量" \
    "if (next === 5 && !BUILDING_TYPES" \
    "if (next === 6 && !BUILDING_TYPES"

run_mutation "B6" "BuildingSystem" "$BLD" "$BLD_TEST" \
    "算术变异: state.level += 1 → += 2 (tick中)" "算术" \
    "        state.level += 1;" \
    "        state.level += 2;"

run_mutation "B7" "BuildingSystem" "$BLD" "$BLD_TEST" \
    "语句删除: 移除 castle升级后的 checkAndUnlockBuildings()" "语句删除" \
    "if (completed.includes('castle')) this.checkAndUnlockBuildings();" \
    "// MUTATION: removed checkAndUnlockBuildings();"

run_mutation "B8" "BuildingSystem" "$BLD" "$BLD_TEST" \
    "返回值变异: getCastleBonusMultiplier 1+ → 1-" "返回值" \
    "return 1 + this.getCastleBonusPercent() / 100;" \
    "return 1 - this.getCastleBonusPercent() / 100;"

echo ""

# ============================================================
# 模块3: DamageCalculator — 伤害计算
# ============================================================
DMG="$W/src/games/three-kingdoms/engine/battle/DamageCalculator.ts"
DMG_TEST="$W/src/games/three-kingdoms/engine/battle/__tests__/DamageCalculator.test.ts"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  模块: DamageCalculator — 伤害计算"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

run_mutation "D1" "DamageCalculator" "$DMG" "$DMG_TEST" \
    "算术变异: Math.max(1, rawDamage) → Math.max(0, rawDamage)" "算术" \
    "const baseDamage = Math.max(1, rawDamage);" \
    "const baseDamage = Math.max(0, rawDamage);"

run_mutation "D2" "DamageCalculator" "$DMG" "$DMG_TEST" \
    "常量变异: MIN_DAMAGE_RATIO → 0 (移除保底)" "常量" \
    "const minDamage = effectiveAttack * BATTLE_CONFIG.MIN_DAMAGE_RATIO;" \
    "const minDamage = effectiveAttack * 0;"

run_mutation "D3" "DamageCalculator" "$DMG" "$DMG_TEST" \
    "逻辑变异: isControlled some() → every()" "逻辑" \
    "return unit.buffs.some(" \
    "return unit.buffs.every("

run_mutation "D4" "DamageCalculator" "$DMG" "$DMG_TEST" \
    "比较变异: defender.hp <= 0 → < 0" "比较" \
    "if (defender.hp <= 0) {" \
    "if (defender.hp < 0) {"

run_mutation "D5" "DamageCalculator" "$DMG" "$DMG_TEST" \
    "语句删除: 移除 reduceShield 调用" "语句删除" \
    "      this.reduceShield(defender, shieldAbsorbed);" \
    "      // MUTATION: removed reduceShield call;"

run_mutation "D6" "DamageCalculator" "$DMG" "$DMG_TEST" \
    "常量变异: RESTRAINT_ADVANTAGE → RESTRAINT_DISADVANTAGE" "常量" \
    "return BATTLE_CONFIG.RESTRAINT_ADVANTAGE; // 克制：×1.5" \
    "return BATTLE_CONFIG.RESTRAINT_DISADVANTAGE; // MUTATION"

run_mutation "D7" "DamageCalculator" "$DMG" "$DMG_TEST" \
    "算术变异: getAttackBonus += → -= (ATK_UP)" "算术" \
    "if (buff.type === BuffType.ATK_UP) {
      bonus += buff.value;" \
    "if (buff.type === BuffType.ATK_UP) {
      bonus -= buff.value;"

run_mutation "D8" "DamageCalculator" "$DMG" "$DMG_TEST" \
    "算术变异: effectiveAttack (1+atkBonus) → (1-atkBonus)" "算术" \
    "const effectiveAttack = attacker.attack * (1 + atkBonus);" \
    "const effectiveAttack = attacker.attack * (1 - atkBonus);"

run_mutation "D9" "DamageCalculator" "$DMG" "$DMG_TEST" \
    "语句删除: 移除 isAlive 检查" "语句删除" \
    "if (!defender.isAlive) return 0;" \
    "// MUTATION: removed isAlive check;"

run_mutation "D10" "DamageCalculator" "$DMG" "$DMG_TEST" \
    "返回值变异: applyDamage 返回 actualDamage → 0" "返回值" \
    "    return actualDamage;" \
    "    return 0;"

echo ""
echo "============================================================"
echo "  变异测试完成！"
echo "============================================================"
echo ""
echo "总变异数: $TOTAL"
echo "杀死数:   $KILLED"
echo "存活数:   $SURVIVED"
if [ $TOTAL -gt 0 ]; then
    echo "变异杀死率: $(echo "scale=1; $KILLED * 100 / $TOTAL" | bc)%"
fi
echo ""
echo "详细结果："
cat "$RESULTS"
