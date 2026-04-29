#!/bin/bash
# ═══════════════════════════════════════════════════════════════════
# 三国霸业引擎 — 变异测试脚本 (Shell 版本)
#
# 注意: 由于沙盒环境限制，推荐使用 Python 版本执行:
#   python3 _mutation_runner.py
#
# 用法: bash run-mutations.sh
# ═══════════════════════════════════════════════════════════════════

WORKSPACE="/mnt/user-data/workspace"
VITEST_CMD="npx vitest run --config vitest.config.three-kingdoms.ts"
RESULTS_FILE="$WORKSPACE/src/games/three-kingdoms/tests/coverage-optimization/mutations/mutation-results.txt"

# 颜色
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# 计数器
TOTAL=0
KILLED=0
SURVIVED=0
SKIPPED=0

# 初始化结果文件
echo "Mutation Test Report - $(date '+%Y-%m-%d %H:%M:%S')" > "$RESULTS_FILE"
echo "" >> "$RESULTS_FILE"

# ═══════════════════════════════════════════════════════════════
# 变异定义 — 格式: FILE|DESC|SEARCH|REPLACE|TEST
# ═══════════════════════════════════════════════════════════════

MUTATIONS=(
  # DamageCalculator.ts (6个)
  "src/games/three-kingdoms/engine/battle/DamageCalculator.ts|M01:DC-getCriticalRate-arithmetic: speed/100->speed*100|speed / BATTLE_CONFIG.SPEED_CRITICAL_COEFFICIENT|speed * BATTLE_CONFIG.SPEED_CRITICAL_COEFFICIENT|src/games/three-kingdoms/engine/battle/__tests__/DamageCalculator.test.ts"
  "src/games/three-kingdoms/engine/battle/DamageCalculator.ts|M02:DC-calculateDamage-boundary: Math.max(1)->Math.max(0)|Math.max(1, rawDamage)|Math.max(0, rawDamage)|src/games/three-kingdoms/engine/battle/__tests__/DamageCalculator.test.ts"
  "src/games/three-kingdoms/engine/battle/DamageCalculator.ts|M03:DC-applyDamage-comparison: hp<=0->hp<0|defender.hp <= 0|defender.hp < 0|src/games/three-kingdoms/engine/battle/__tests__/DamageCalculator.test.ts"
  "src/games/three-kingdoms/engine/battle/DamageCalculator.ts|M04:DC-getRestraintMultiplier-return: advantage->disadvantage|return BATTLE_CONFIG.RESTRAINT_ADVANTAGE; // 克制：×1.5|return BATTLE_CONFIG.RESTRAINT_DISADVANTAGE; // 克制(变异)|src/games/three-kingdoms/engine/battle/__tests__/DamageCalculator.test.ts"
  "src/games/three-kingdoms/engine/battle/DamageCalculator.ts|M05:DC-calculateDamage-arithmetic: (1+atkBonus)->(1-atkBonus)|attacker.attack * (1 + atkBonus)|attacker.attack * (1 - atkBonus)|src/games/three-kingdoms/engine/battle/__tests__/DamageCalculator.test.ts"
  "src/games/three-kingdoms/engine/battle/DamageCalculator.ts|M06:DC-calculateDamage-comparison: finalDamage<min-><=min|finalDamage < minDamage|finalDamage <= minDamage|src/games/three-kingdoms/engine/battle/__tests__/DamageCalculator.test.ts"
  # BuildingSystem.ts (6个)
  "src/games/three-kingdoms/engine/building/BuildingSystem.ts|M07:BS-checkUpgrade-comparison: level>=maxLv->level>maxLv|state.level >= maxLv|state.level > maxLv|src/games/three-kingdoms/engine/building/__tests__/BuildingSystem.test.ts"
  "src/games/three-kingdoms/engine/building/BuildingSystem.ts|M08:BS-cancelUpgrade-arithmetic: 80pct->100pct refund|Math.round(cost.grain * CANCEL_REFUND_RATIO)|Math.round(cost.grain * 1.0)|src/games/three-kingdoms/engine/building/__tests__/BuildingSystem.test.ts"
  "src/games/three-kingdoms/engine/building/BuildingSystem.ts|M09:BS-checkUpgrade-comparison: level>=castle->level>castle|state.level >= this.buildings.castle.level|state.level > this.buildings.castle.level|src/games/three-kingdoms/engine/building/__tests__/BuildingSystem.test.ts"
  "src/games/three-kingdoms/engine/building/BuildingSystem.ts|M10:BS-getProduction-return: lv<=0 return 0->return 1|if (lv <= 0) return 0;|if (lv <= 0) return 1;|src/games/three-kingdoms/engine/building/__tests__/BuildingSystem.test.ts"
  "src/games/three-kingdoms/engine/building/BuildingSystem.ts|M11:BS-isQueueFull-comparison: >=max->>max|this.upgradeQueue.length >= this.getMaxQueueSlots()|this.upgradeQueue.length > this.getMaxQueueSlots()|src/games/three-kingdoms/engine/building/__tests__/BuildingSystem.test.ts"
  "src/games/three-kingdoms/engine/building/BuildingSystem.ts|M12:BS-checkUnlock-comparison: castle>=required->castle>required|this.buildings.castle.level >= required|this.buildings.castle.level > required|src/games/three-kingdoms/engine/building/__tests__/BuildingSystem.test.ts"
  # EquipmentEnhanceSystem.ts (6个)
  "src/games/three-kingdoms/engine/equipment/EquipmentEnhanceSystem.ts|M13:EE-enhance-comparison: roll<rate->roll<=rate|const isSuccess = roll < successRate;|const isSuccess = roll <= successRate;|src/games/three-kingdoms/engine/equipment/__tests__/EquipmentEnhanceSystem.test.ts"
  "src/games/three-kingdoms/engine/equipment/EquipmentEnhanceSystem.ts|M14:EE-getCopperCost-arithmetic: copperGrowth->copperGrowth-0.1|Math.pow(copperGrowth, level)|Math.pow(copperGrowth - 0.1, level)|src/games/three-kingdoms/engine/equipment/__tests__/EquipmentEnhanceSystem.test.ts"
  "src/games/three-kingdoms/engine/equipment/EquipmentEnhanceSystem.ts|M15:EE-enhance-comparison: level>safe->level>=safe|level > ENHANCE_CONFIG.safeLevel|level >= ENHANCE_CONFIG.safeLevel|src/games/three-kingdoms/engine/equipment/__tests__/EquipmentEnhanceSystem.test.ts"
  "src/games/three-kingdoms/engine/equipment/EquipmentEnhanceSystem.ts|M16:EE-getSuccessRate-return: 0.01->1.0|return 0.01;|return 1.0;|src/games/three-kingdoms/engine/equipment/__tests__/EquipmentEnhanceSystem.test.ts"
  "src/games/three-kingdoms/engine/equipment/EquipmentEnhanceSystem.ts|M17:EE-transferEnhance-arithmetic: LEVEL_LOSS->0|source.enhanceLevel - TRANSFER_LEVEL_LOSS|source.enhanceLevel - 0|src/games/three-kingdoms/engine/equipment/__tests__/EquipmentEnhanceSystem.test.ts"
  "src/games/three-kingdoms/engine/equipment/EquipmentEnhanceSystem.ts|M18:EE-enhance-comparison: downgradeRoll<chance-><=chance|downgradeRoll < ENHANCE_CONFIG.downgradeChance|downgradeRoll <= ENHANCE_CONFIG.downgradeChance|src/games/three-kingdoms/engine/equipment/__tests__/EquipmentEnhanceSystem.test.ts"
)

echo -e "${CYAN}═════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  三国霸业引擎 — 变异测试开始${NC}"
echo -e "${CYAN}═════════════════════════════════════════════════════════${NC}"
echo ""

for m in "${MUTATIONS[@]}"; do
  IFS='|' read -r rel_file desc pattern replacement test_file <<< "$m"
  target_file="$WORKSPACE/$rel_file"
  test_path="$WORKSPACE/$test_file"
  
  TOTAL=$((TOTAL + 1))
  
  echo -e "${CYAN}[MUT $TOTAL]${NC} $desc"
  echo "  变异: $pattern → $replacement"
  
  if [ ! -f "$target_file" ]; then
    SKIPPED=$((SKIPPED + 1))
    echo -e "  ${YELLOW}SKIPPED${NC} — 文件不存在"
    echo "#$(printf '%02d' $TOTAL) [SKIP] $desc - file not found" >> "$RESULTS_FILE"
    echo ""
    continue
  fi
  
  # 备份
  cp "$target_file" "${target_file}.bak"
  
  # 应用变异
  sed -i "s|${pattern}|${replacement}|" "$target_file"
  
  # 验证变异是否被应用
  if ! grep -qF "$replacement" "$target_file"; then
    SKIPPED=$((SKIPPED + 1))
    cp "${target_file}.bak" "$target_file"
    rm -f "${target_file}.bak"
    echo -e "  ${YELLOW}SKIPPED${NC} — 模式未匹配"
    echo "#$(printf '%02d' $TOTAL) [SKIP] $desc - pattern not found" >> "$RESULTS_FILE"
    echo ""
    continue
  fi
  
  # 运行测试
  cd "$WORKSPACE"
  TEST_OUTPUT=$($VITEST_CMD "$test_path" 2>&1) || true
  
  FAILED_COUNT=$(echo "$TEST_OUTPUT" | grep -oE "[0-9]+ failed" | head -1 | grep -oE "[0-9]+" || echo "0")
  
  if [ "$FAILED_COUNT" != "0" ] && [ -n "$FAILED_COUNT" ]; then
    KILLED=$((KILLED + 1))
    echo -e "  ${GREEN}KILLED${NC} ✓ ($FAILED_COUNT tests failed)"
    echo "#$(printf '%02d' $TOTAL) [KILLED] $desc - $FAILED_COUNT tests failed" >> "$RESULTS_FILE"
  else
    SURVIVED=$((SURVIVED + 1))
    echo -e "  ${RED}SURVIVED${NC} ✗ (all tests passed)"
    echo "#$(printf '%02d' $TOTAL) [SURVIVED] $desc - all passed" >> "$RESULTS_FILE"
  fi
  
  # 恢复
  cp "${target_file}.bak" "$target_file"
  rm -f "${target_file}.bak"
  echo ""
done

# 汇总
EFFECTIVE=$((TOTAL - SKIPPED))
KILL_RATE="0"
if [ $EFFECTIVE -gt 0 ]; then
  KILL_RATE=$(echo "scale=1; $KILLED * 100 / $EFFECTIVE" | bc)
fi

echo "" >> "$RESULTS_FILE"
echo "Total=$TOTAL Effective=$EFFECTIVE Killed=$KILLED Survived=$SURVIVED Skipped=$SKIPPED KillRate=${KILL_RATE}%" >> "$RESULTS_FILE"

echo -e "${CYAN}═════════════════════════════════════════════════════════${NC}"
echo -e "  变异总数: $TOTAL | 有效: $EFFECTIVE"
echo -e "  ${GREEN}杀死: $KILLED${NC} | ${RED}存活: $SURVIVED${NC} | ${YELLOW}跳过: $SKIPPED${NC}"
echo -e "  ${YELLOW}杀死率: ${KILL_RATE}%${NC}"
echo -e "${CYAN}═════════════════════════════════════════════════════════${NC}"
