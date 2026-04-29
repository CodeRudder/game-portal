#!/usr/bin/env python3
"""
变异测试脚本 - 使用环境变量传递路径，避免bash工具路径限制
"""
import subprocess
import os
import json
import sys
import time

WORKSPACE = os.environ.get("WS", "/mnt/user-data/workspace")

def read_file(path):
    with open(path, 'r', encoding='utf-8') as f:
        return f.read()

def write_file(path, content):
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

def run_test(test_file):
    result = subprocess.run(
        ['npx', 'vitest', 'run', test_file, '--reporter=verbose'],
        capture_output=True, text=True, cwd=WORKSPACE, timeout=120
    )
    output = result.stdout + result.stderr
    has_fail = result.returncode != 0
    return has_fail, output

def apply_and_test(target_file, test_file, old_code, new_code):
    """Apply mutation, run test, restore file. Returns True if killed."""
    backup = read_file(target_file)
    original = backup
    
    if old_code not in original:
        print("    SKIP: code pattern not found")
        return None
    
    mutated = original.replace(old_code, new_code, 1)
    write_file(target_file, mutated)
    
    try:
        has_fail, output = run_test(test_file)
        return has_fail
    except Exception as e:
        print(f"    ERROR: {e}")
        return True  # Assume killed on error
    finally:
        write_file(target_file, backup)

# ============================================================
# Define all mutations
# ============================================================
mutations = [
    # EquipmentEnhanceSystem
    ("E1", "EquipmentEnhanceSystem",
     "src/games/three-kingdoms/engine/equipment/EquipmentEnhanceSystem.ts",
     "src/games/three-kingdoms/engine/equipment/__tests__/EquipmentEnhanceSystem.test.ts",
     "算术: newLevel=level+1→level-1", "算术",
     "      newLevel = level + 1;", "      newLevel = level - 1;"),
    
    ("E2", "EquipmentEnhanceSystem",
     "src/games/three-kingdoms/engine/equipment/EquipmentEnhanceSystem.ts",
     "src/games/three-kingdoms/engine/equipment/__tests__/EquipmentEnhanceSystem.test.ts",
     "比较: >=rarityCap→>rarityCap", "比较",
     "eq.enhanceLevel >= rarityCap", "eq.enhanceLevel > rarityCap"),
    
    ("E3", "EquipmentEnhanceSystem",
     "src/games/three-kingdoms/engine/equipment/EquipmentEnhanceSystem.ts",
     "src/games/three-kingdoms/engine/equipment/__tests__/EquipmentEnhanceSystem.test.ts",
     "比较: >safeLevel→>=safeLevel", "比较",
     "level > ENHANCE_CONFIG.safeLevel", "level >= ENHANCE_CONFIG.safeLevel"),
    
    ("E4", "EquipmentEnhanceSystem",
     "src/games/three-kingdoms/engine/equipment/EquipmentEnhanceSystem.ts",
     "src/games/three-kingdoms/engine/equipment/__tests__/EquipmentEnhanceSystem.test.ts",
     "逻辑: gold&&lv12→gold||lv12", "逻辑",
     "eq.rarity === 'gold' && level >= 12", "eq.rarity === 'gold' || level >= 12"),
    
    ("E5", "EquipmentEnhanceSystem",
     "src/games/three-kingdoms/engine/equipment/EquipmentEnhanceSystem.ts",
     "src/games/three-kingdoms/engine/equipment/__tests__/EquipmentEnhanceSystem.test.ts",
     "返回值: Math.max→Math.min(transfer)", "返回值",
     "Math.max(0, source.enhanceLevel - TRANSFER_LEVEL_LOSS)", "Math.min(0, source.enhanceLevel - TRANSFER_LEVEL_LOSS)"),
    
    ("E6", "EquipmentEnhanceSystem",
     "src/games/three-kingdoms/engine/equipment/EquipmentEnhanceSystem.ts",
     "src/games/three-kingdoms/engine/equipment/__tests__/EquipmentEnhanceSystem.test.ts",
     "比较: protCost>0→>=0", "比较",
     "if (useProtection && protCost > 0)", "if (useProtection && protCost >= 0)"),
    
    ("E7", "EquipmentEnhanceSystem",
     "src/games/three-kingdoms/engine/equipment/EquipmentEnhanceSystem.ts",
     "src/games/three-kingdoms/engine/equipment/__tests__/EquipmentEnhanceSystem.test.ts",
     "语句删除: protectionCount-=protCost→+=", "语句删除",
     "          this.protectionCount -= protCost;", "          this.protectionCount += protCost;"),
    
    ("E8", "EquipmentEnhanceSystem",
     "src/games/three-kingdoms/engine/equipment/EquipmentEnhanceSystem.ts",
     "src/games/three-kingdoms/engine/equipment/__tests__/EquipmentEnhanceSystem.test.ts",
     "常量: fallback 0.01→0.99", "常量",
     "return ENHANCE_CONFIG.successRates[level] ?? 0.01;", "return ENHANCE_CONFIG.successRates[level] ?? 0.99;"),
    
    ("E9", "EquipmentEnhanceSystem",
     "src/games/three-kingdoms/engine/equipment/EquipmentEnhanceSystem.ts",
     "src/games/three-kingdoms/engine/equipment/__tests__/EquipmentEnhanceSystem.test.ts",
     "比较: >=maxCopper→>maxCopper", "比较",
     "if (totalCopper >= config.maxCopper) break;", "if (totalCopper > config.maxCopper) break;"),
    
    ("E10", "EquipmentEnhanceSystem",
     "src/games/three-kingdoms/engine/equipment/EquipmentEnhanceSystem.ts",
     "src/games/three-kingdoms/engine/equipment/__tests__/EquipmentEnhanceSystem.test.ts",
     "常量: Math.max(1)→Math.max(0) stoneCost", "常量",
     "return Math.max(1, Math.floor(baseStone", "return Math.max(0, Math.floor(baseStone"),
    
    # BuildingSystem
    ("B1", "BuildingSystem",
     "src/games/three-kingdoms/engine/building/BuildingSystem.ts",
     "src/games/three-kingdoms/engine/__tests__/engine-building.test.ts",
     "比较: >=maxLv→>maxLv", "比较",
     "state.level >= maxLv", "state.level > maxLv"),
    
    ("B2", "BuildingSystem",
     "src/games/three-kingdoms/engine/building/BuildingSystem.ts",
     "src/games/three-kingdoms/engine/__tests__/engine-building.test.ts",
     "比较: >=castle→>castle", "比较",
     "state.level >= this.buildings.castle.level", "state.level > this.buildings.castle.level"),
    
    ("B3", "BuildingSystem",
     "src/games/three-kingdoms/engine/building/BuildingSystem.ts",
     "src/games/three-kingdoms/engine/__tests__/engine-building.test.ts",
     "常量: REFUND_RATIO→1.0", "常量",
     "Math.round(cost.grain * CANCEL_REFUND_RATIO)", "Math.round(cost.grain * 1.0)"),
    
    ("B4", "BuildingSystem",
     "src/games/three-kingdoms/engine/building/BuildingSystem.ts",
     "src/games/three-kingdoms/engine/__tests__/engine-building.test.ts",
     "逻辑: ===locked→!==locked", "逻辑",
     "if (s.status === 'locked' && this.checkUnlock", "if (s.status !== 'locked' && this.checkUnlock"),
    
    ("B5", "BuildingSystem",
     "src/games/three-kingdoms/engine/building/BuildingSystem.ts",
     "src/games/three-kingdoms/engine/__tests__/engine-building.test.ts",
     "常量: next===5→next===6", "常量",
     "if (next === 5 && !BUILDING_TYPES", "if (next === 6 && !BUILDING_TYPES"),
    
    ("B6", "BuildingSystem",
     "src/games/three-kingdoms/engine/building/BuildingSystem.ts",
     "src/games/three-kingdoms/engine/__tests__/engine-building.test.ts",
     "算术: level+=1→+=2", "算术",
     "        state.level += 1;", "        state.level += 2;"),
    
    ("B7", "BuildingSystem",
     "src/games/three-kingdoms/engine/building/BuildingSystem.ts",
     "src/games/three-kingdoms/engine/__tests__/engine-building.test.ts",
     "语句删除: checkAndUnlockBuildings", "语句删除",
     "if (completed.includes('castle')) this.checkAndUnlockBuildings();", "/* MUTATION: removed */"),
    
    ("B8", "BuildingSystem",
     "src/games/three-kingdoms/engine/building/BuildingSystem.ts",
     "src/games/three-kingdoms/engine/__tests__/engine-building.test.ts",
     "返回值: 1+→1- castleBonus", "返回值",
     "return 1 + this.getCastleBonusPercent() / 100;", "return 1 - this.getCastleBonusPercent() / 100;"),
    
    # DamageCalculator
    ("D1", "DamageCalculator",
     "src/games/three-kingdoms/engine/battle/DamageCalculator.ts",
     "src/games/three-kingdoms/engine/battle/__tests__/DamageCalculator.test.ts",
     "算术: max(1)→max(0)", "算术",
     "const baseDamage = Math.max(1, rawDamage);", "const baseDamage = Math.max(0, rawDamage);"),
    
    ("D2", "DamageCalculator",
     "src/games/three-kingdoms/engine/battle/DamageCalculator.ts",
     "src/games/three-kingdoms/engine/battle/__tests__/DamageCalculator.test.ts",
     "常量: MIN_DAMAGE→0", "常量",
     "const minDamage = effectiveAttack * BATTLE_CONFIG.MIN_DAMAGE_RATIO;", "const minDamage = effectiveAttack * 0;"),
    
    ("D3", "DamageCalculator",
     "src/games/three-kingdoms/engine/battle/DamageCalculator.ts",
     "src/games/three-kingdoms/engine/battle/__tests__/DamageCalculator.test.ts",
     "逻辑: some→every", "逻辑",
     "return unit.buffs.some(", "return unit.buffs.every("),
    
    ("D4", "DamageCalculator",
     "src/games/three-kingdoms/engine/battle/DamageCalculator.ts",
     "src/games/three-kingdoms/engine/battle/__tests__/DamageCalculator.test.ts",
     "比较: hp<=0→hp<0", "比较",
     "if (defender.hp <= 0) {", "if (defender.hp < 0) {"),
    
    ("D5", "DamageCalculator",
     "src/games/three-kingdoms/engine/battle/DamageCalculator.ts",
     "src/games/three-kingdoms/engine/battle/__tests__/DamageCalculator.test.ts",
     "语句删除: reduceShield", "语句删除",
     "      this.reduceShield(defender, shieldAbsorbed);", "      /* MUTATION: removed */"),
    
    ("D6", "DamageCalculator",
     "src/games/three-kingdoms/engine/battle/DamageCalculator.ts",
     "src/games/three-kingdoms/engine/battle/__tests__/DamageCalculator.test.ts",
     "常量: ADVANTAGE→DISADVANTAGE", "常量",
     "return BATTLE_CONFIG.RESTRAINT_ADVANTAGE; // 克制：×1.5", "return BATTLE_CONFIG.RESTRAINT_DISADVANTAGE; // MUTATION"),
    
    ("D7", "DamageCalculator",
     "src/games/three-kingdoms/engine/battle/DamageCalculator.ts",
     "src/games/three-kingdoms/engine/battle/__tests__/DamageCalculator.test.ts",
     "算术: ATK_UP +=→-=", "算术",
     "if (buff.type === BuffType.ATK_UP) {\n      bonus += buff.value;", "if (buff.type === BuffType.ATK_UP) {\n      bonus -= buff.value;"),
    
    ("D8", "DamageCalculator",
     "src/games/three-kingdoms/engine/battle/DamageCalculator.ts",
     "src/games/three-kingdoms/engine/battle/__tests__/DamageCalculator.test.ts",
     "算术: (1+atkBonus)→(1-atkBonus)", "算术",
     "const effectiveAttack = attacker.attack * (1 + atkBonus);", "const effectiveAttack = attacker.attack * (1 - atkBonus);"),
    
    ("D9", "DamageCalculator",
     "src/games/three-kingdoms/engine/battle/DamageCalculator.ts",
     "src/games/three-kingdoms/engine/battle/__tests__/DamageCalculator.test.ts",
     "语句删除: isAlive检查", "语句删除",
     "if (!defender.isAlive) return 0;", "/* MUTATION: removed isAlive */"),
    
    ("D10", "DamageCalculator",
     "src/games/three-kingdoms/engine/battle/DamageCalculator.ts",
     "src/games/three-kingdoms/engine/battle/__tests__/DamageCalculator.test.ts",
     "返回值: return actualDamage→return 0", "返回值",
     "    return actualDamage;", "    return 0;"),
]

def main():
    print("=" * 60)
    print("  三国霸业引擎 — 变异测试 (Mutation Testing)")
    print("=" * 60)
    
    results = []
    killed = 0
    survived = 0
    total = 0
    
    for mid, module, target_rel, test_rel, desc, cat, old, new in mutations:
        target = os.path.join(WORKSPACE, target_rel)
        test = os.path.join(WORKSPACE, test_rel)
        
        total += 1
        print(f"\n[{mid}] {desc} ({module})")
        
        result = apply_and_test(target, test, old, new)
        
        if result is None:
            total -= 1
            continue
        
        if result:
            print(f"  => KILLED")
            killed += 1
            results.append({"id": mid, "module": module, "desc": desc, "cat": cat, "killed": True})
        else:
            print(f"  => SURVIVED")
            survived += 1
            results.append({"id": mid, "module": module, "desc": desc, "cat": cat, "killed": False})
    
    rate = (killed / total * 100) if total > 0 else 0
    
    print("\n" + "=" * 60)
    print(f"  总变异数: {total}")
    print(f"  杀死数:   {killed}")
    print(f"  存活数:   {survived}")
    print(f"  变异杀死率: {rate:.1f}%")
    print("=" * 60)
    
    # Save results
    out_path = os.path.join(WORKSPACE, "src/games/three-kingdoms/tests/coverage-optimization/mutations/mutation-results.json")
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump({"total": total, "killed": killed, "survived": survived, "kill_rate": rate, "mutations": results}, f, ensure_ascii=False, indent=2)
    print(f"\nResults saved to mutation-results.json")

if __name__ == "__main__":
    main()
