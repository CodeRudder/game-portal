#!/usr/bin/env python3
import subprocess, os, re
from datetime import datetime

W = os.path.dirname(os.path.abspath(__file__))
RF = os.path.join(W, "src/games/three-kingdoms/tests/coverage-optimization/mutations/mutation-results.txt")

M = [
    ("src/games/three-kingdoms/engine/battle/DamageCalculator.ts", "M01:DC-getCriticalRate-arithmetic: speed/100->speed*100", "speed / BATTLE_CONFIG.SPEED_CRITICAL_COEFFICIENT", "speed * BATTLE_CONFIG.SPEED_CRITICAL_COEFFICIENT", "src/games/three-kingdoms/engine/battle/__tests__/DamageCalculator.test.ts"),
    ("src/games/three-kingdoms/engine/battle/DamageCalculator.ts", "M02:DC-calculateDamage-boundary: Math.max(1)->Math.max(0)", "Math.max(1, rawDamage)", "Math.max(0, rawDamage)", "src/games/three-kingdoms/engine/battle/__tests__/DamageCalculator.test.ts"),
    ("src/games/three-kingdoms/engine/battle/DamageCalculator.ts", "M03:DC-applyDamage-comparison: hp<=0->hp<0", "defender.hp <= 0", "defender.hp < 0", "src/games/three-kingdoms/engine/battle/__tests__/DamageCalculator.test.ts"),
    ("src/games/three-kingdoms/engine/battle/DamageCalculator.ts", "M04:DC-getRestraintMultiplier-return: advantage->disadvantage", "return BATTLE_CONFIG.RESTRAINT_ADVANTAGE; // \u514b\u5236\uff1a\u00d71.5", "return BATTLE_CONFIG.RESTRAINT_DISADVANTAGE; // \u514b\u5236(mutated)", "src/games/three-kingdoms/engine/battle/__tests__/DamageCalculator.test.ts"),
    ("src/games/three-kingdoms/engine/battle/DamageCalculator.ts", "M05:DC-calculateDamage-arithmetic: (1+atkBonus)->(1-atkBonus)", "attacker.attack * (1 + atkBonus)", "attacker.attack * (1 - atkBonus)", "src/games/three-kingdoms/engine/battle/__tests__/DamageCalculator.test.ts"),
    ("src/games/three-kingdoms/engine/battle/DamageCalculator.ts", "M06:DC-calculateDamage-comparison: finalDamage<min-><=min", "finalDamage < minDamage", "finalDamage <= minDamage", "src/games/three-kingdoms/engine/battle/__tests__/DamageCalculator.test.ts"),
    ("src/games/three-kingdoms/engine/building/BuildingSystem.ts", "M07:BS-checkUpgrade-comparison: level>=maxLv->level>maxLv", "state.level >= maxLv", "state.level > maxLv", "src/games/three-kingdoms/engine/building/__tests__/BuildingSystem.test.ts"),
    ("src/games/three-kingdoms/engine/building/BuildingSystem.ts", "M08:BS-cancelUpgrade-arithmetic: 80pct->100pct refund", "Math.round(cost.grain * CANCEL_REFUND_RATIO)", "Math.round(cost.grain * 1.0)", "src/games/three-kingdoms/engine/building/__tests__/BuildingSystem.test.ts"),
    ("src/games/three-kingdoms/engine/building/BuildingSystem.ts", "M09:BS-checkUpgrade-comparison: level>=castle->level>castle", "state.level >= this.buildings.castle.level", "state.level > this.buildings.castle.level", "src/games/three-kingdoms/engine/building/__tests__/BuildingSystem.test.ts"),
    ("src/games/three-kingdoms/engine/building/BuildingSystem.ts", "M10:BS-getProduction-return: lv<=0 return 0->return 1", "if (lv <= 0) return 0;", "if (lv <= 0) return 1;", "src/games/three-kingdoms/engine/building/__tests__/BuildingSystem.test.ts"),
    ("src/games/three-kingdoms/engine/building/BuildingSystem.ts", "M11:BS-isQueueFull-comparison: >=max->>max", "this.upgradeQueue.length >= this.getMaxQueueSlots()", "this.upgradeQueue.length > this.getMaxQueueSlots()", "src/games/three-kingdoms/engine/building/__tests__/BuildingSystem.test.ts"),
    ("src/games/three-kingdoms/engine/building/BuildingSystem.ts", "M12:BS-checkUnlock-comparison: castle>=required->castle>required", "this.buildings.castle.level >= required", "this.buildings.castle.level > required", "src/games/three-kingdoms/engine/building/__tests__/BuildingSystem.test.ts"),
    ("src/games/three-kingdoms/engine/equipment/EquipmentEnhanceSystem.ts", "M13:EE-enhance-comparison: roll<rate->roll<=rate", "const isSuccess = roll < successRate;", "const isSuccess = roll <= successRate;", "src/games/three-kingdoms/engine/equipment/__tests__/EquipmentEnhanceSystem.test.ts"),
    ("src/games/three-kingdoms/engine/equipment/EquipmentEnhanceSystem.ts", "M14:EE-getCopperCost-arithmetic: copperGrowth->copperGrowth-0.1", "Math.pow(copperGrowth, level)", "Math.pow(copperGrowth - 0.1, level)", "src/games/three-kingdoms/engine/equipment/__tests__/EquipmentEnhanceSystem.test.ts"),
    ("src/games/three-kingdoms/engine/equipment/EquipmentEnhanceSystem.ts", "M15:EE-enhance-comparison: level>safe->level>=safe", "level > ENHANCE_CONFIG.safeLevel", "level >= ENHANCE_CONFIG.safeLevel", "src/games/three-kingdoms/engine/equipment/__tests__/EquipmentEnhanceSystem.test.ts"),
    ("src/games/three-kingdoms/engine/equipment/EquipmentEnhanceSystem.ts", "M16:EE-getSuccessRate-return: 0.01->1.0", "return 0.01;", "return 1.0;", "src/games/three-kingdoms/engine/equipment/__tests__/EquipmentEnhanceSystem.test.ts"),
    ("src/games/three-kingdoms/engine/equipment/EquipmentEnhanceSystem.ts", "M17:EE-transferEnhance-arithmetic: LEVEL_LOSS->0", "source.enhanceLevel - TRANSFER_LEVEL_LOSS", "source.enhanceLevel - 0", "src/games/three-kingdoms/engine/equipment/__tests__/EquipmentEnhanceSystem.test.ts"),
    ("src/games/three-kingdoms/engine/equipment/EquipmentEnhanceSystem.ts", "M18:EE-enhance-comparison: downgradeRoll<chance-><=chance", "downgradeRoll < ENHANCE_CONFIG.downgradeChance", "downgradeRoll <= ENHANCE_CONFIG.downgradeChance", "src/games/three-kingdoms/engine/equipment/__tests__/EquipmentEnhanceSystem.test.ts"),
]

total = 0
killed = 0
survived = 0
skipped = 0
results = []

sep = "=" * 60
print(sep)
print("  Mutation Testing Start")
print(sep)

for rel_file, desc, search, replace, test_file in M:
    total += 1
    target = os.path.join(W, rel_file)
    test_path = os.path.join(W, test_file)
    print("[MUT %d] %s" % (total, desc))

    if not os.path.exists(target):
        skipped += 1
        results.append((desc, "SKIP", "file not found"))
        print("  SKIPPED - file not found")
        continue

    with open(target, "r") as f:
        original = f.read()

    if search not in original:
        skipped += 1
        results.append((desc, "SKIP", "pattern not found: " + search[:40]))
        print("  SKIPPED - pattern not found")
        continue

    mutated = original.replace(search, replace, 1)
    with open(target, "w") as f:
        f.write(mutated)

    try:
        r = subprocess.run(
            ["npx", "vitest", "run", "--config", "vitest.config.three-kingdoms.ts", test_path],
            cwd=W, capture_output=True, text=True, timeout=60
        )
        output = r.stdout + r.stderr
        fm = re.search(r"(\d+) failed", output)
        if fm and int(fm.group(1)) > 0:
            killed += 1
            results.append((desc, "KILLED", fm.group(1) + " tests failed"))
            print("  KILLED (" + fm.group(1) + " tests failed)")
        elif "passed" in output:
            survived += 1
            results.append((desc, "SURVIVED", "all passed"))
            print("  SURVIVED (all passed)")
        else:
            survived += 1
            results.append((desc, "SURVIVED", "exit=" + str(r.returncode)))
            print("  SURVIVED (exit=" + str(r.returncode) + ")")
    except subprocess.TimeoutExpired:
        survived += 1
        results.append((desc, "SURVIVED", "timeout"))
        print("  SURVIVED (timeout)")
    finally:
        with open(target, "w") as f:
            f.write(original)

effective = total - skipped
kill_rate = (killed * 100.0 / effective) if effective > 0 else 0

print("")
print(sep)
print("  Total=%d Effective=%d Killed=%d Survived=%d Skipped=%d KillRate=%.1f%%" % (total, effective, killed, survived, skipped, kill_rate))

with open(RF, "w") as f:
    f.write("Mutation Test Report - " + datetime.now().strftime("%Y-%m-%d %H:%M:%S") + "\n\n")
    for i, (desc, status, detail) in enumerate(results, 1):
        f.write("#%02d [%s] %s - %s\n" % (i, status, desc, detail))
    f.write("\nTotal=%d Effective=%d Killed=%d Survived=%d Skipped=%d KillRate=%.1f%%\n" % (total, effective, killed, survived, skipped, kill_rate))

print("Report: " + RF)
