#!/usr/bin/env python3
import subprocess, os, re
from datetime import datetime

W = os.path.dirname(os.path.abspath(__file__))
RF = os.path.join(W, "src/games/three-kingdoms/tests/coverage-optimization/mutations/mutation-results-round2.txt")

# Only test the 5 surviving mutations, now with adversarial test files
M = [
    ("src/games/three-kingdoms/engine/battle/DamageCalculator.ts", "M06:DC-calculateDamage-comparison: finalDamage<min-><=min", "finalDamage < minDamage", "finalDamage <= minDamage", "src/games/three-kingdoms/engine/battle/__tests__/DamageCalculator.adversarial.test.ts"),
    ("src/games/three-kingdoms/engine/equipment/EquipmentEnhanceSystem.ts", "M13:EE-enhance-comparison: roll<rate->roll<=rate", "const isSuccess = roll < successRate;", "const isSuccess = roll <= successRate;", "src/games/three-kingdoms/engine/equipment/__tests__/EquipmentEnhanceSystem.adversarial.test.ts"),
    ("src/games/three-kingdoms/engine/equipment/EquipmentEnhanceSystem.ts", "M14:EE-getCopperCost-arithmetic: copperGrowth->copperGrowth-0.1", "Math.pow(copperGrowth, level)", "Math.pow(copperGrowth - 0.1, level)", "src/games/three-kingdoms/engine/equipment/__tests__/EquipmentEnhanceSystem.adversarial.test.ts"),
    ("src/games/three-kingdoms/engine/equipment/EquipmentEnhanceSystem.ts", "M15:EE-enhance-comparison: level>safe->level>=safe", "level > ENHANCE_CONFIG.safeLevel", "level >= ENHANCE_CONFIG.safeLevel", "src/games/three-kingdoms/engine/equipment/__tests__/EquipmentEnhanceSystem.adversarial.test.ts"),
    ("src/games/three-kingdoms/engine/equipment/EquipmentEnhanceSystem.ts", "M18:EE-enhance-comparison: downgradeRoll<chance-><=chance", "downgradeRoll < ENHANCE_CONFIG.downgradeChance", "downgradeRoll <= ENHANCE_CONFIG.downgradeChance", "src/games/three-kingdoms/engine/equipment/__tests__/EquipmentEnhanceSystem.adversarial.test.ts"),
]

total = 0; killed = 0; survived = 0; skipped = 0; results = []
sep = "=" * 60
print(sep)
print("  Round 2: Testing Surviving Mutations with Adversarial Tests")
print(sep)

for target_path, desc, search, replace, test_file in M:
    total += 1
    target = os.path.join(W, target_path)
    test_path = os.path.join(W, test_file)
    print("[MUT %d] %s" % (total, desc))

    if not os.path.exists(target):
        skipped += 1; results.append((desc, "SKIP", "file not found"))
        print("  SKIPPED"); continue
    with open(target, "r") as f: original = f.read()
    if search not in original:
        skipped += 1; results.append((desc, "SKIP", "pattern not found"))
        print("  SKIPPED - pattern not found"); continue
    mutated = original.replace(search, replace, 1)
    with open(target, "w") as f: f.write(mutated)
    try:
        r = subprocess.run(["npx", "vitest", "run", "--config", "vitest.config.three-kingdoms.ts", test_path], cwd=W, capture_output=True, text=True, timeout=60)
        output = r.stdout + r.stderr
        fm = re.search(r"(\d+) failed", output)
        if fm and int(fm.group(1)) > 0:
            killed += 1; results.append((desc, "KILLED", fm.group(1) + " tests failed"))
            print("  KILLED (" + fm.group(1) + " tests failed)")
        elif "passed" in output:
            survived += 1; results.append((desc, "SURVIVED", "all passed"))
            print("  SURVIVED (all passed)")
        else:
            survived += 1; results.append((desc, "SURVIVED", "exit=" + str(r.returncode)))
            print("  SURVIVED (exit=" + str(r.returncode) + ")")
    except subprocess.TimeoutExpired:
        survived += 1; results.append((desc, "SURVIVED", "timeout"))
        print("  SURVIVED (timeout)")
    finally:
        with open(target, "w") as f: f.write(original)

print("")
print(sep)
print("  Total=%d Killed=%d Survived=%d Skipped=%d" % (total, killed, survived, skipped))

with open(RF, "w") as f:
    f.write("Round 2 Report - " + datetime.now().strftime("%Y-%m-%d %H:%M:%S") + "\n\n")
    for i, (desc, status, detail) in enumerate(results, 1):
        f.write("#%02d [%s] %s - %s\n" % (i, status, desc, detail))
    f.write("\nTotal=%d Killed=%d Survived=%d Skipped=%d\n" % (total, killed, survived, skipped))

print("Report: " + RF)
