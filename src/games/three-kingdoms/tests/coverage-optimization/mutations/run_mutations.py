#!/usr/bin/env python3
"""
三国霸业引擎 — 变异测试执行器
用法: python3 run_mutations.py
"""
import subprocess
import shutil
import os
import re
from datetime import datetime

WORKSPACE = "/mnt/user-data/workspace"
RESULTS_DIR = os.path.join(WORKSPACE, "src/games/three-kingdoms/tests/coverage-optimization/mutations")
RESULTS_FILE = os.path.join(RESULTS_DIR, "mutation-results.txt")

# 变异定义: (相对路径, 描述, 搜索串, 替换串, 测试路径)
MUTATIONS = [
    # ── DamageCalculator.ts (6个) ──
    (
        "src/games/three-kingdoms/engine/battle/DamageCalculator.ts",
        "M01:DC-getCriticalRate-算术: speed/100→speed*100",
        "speed / BATTLE_CONFIG.SPEED_CRITICAL_COEFFICIENT",
        "speed * BATTLE_CONFIG.SPEED_CRITICAL_COEFFICIENT",
        "src/games/three-kingdoms/engine/battle/__tests__/DamageCalculator.test.ts",
    ),
    (
        "src/games/three-kingdoms/engine/battle/DamageCalculator.ts",
        "M02:DC-calculateDamage-边界: Math.max(1)→Math.max(0)",
        "Math.max(1, rawDamage)",
        "Math.max(0, rawDamage)",
        "src/games/three-kingdoms/engine/battle/__tests__/DamageCalculator.test.ts",
    ),
    (
        "src/games/three-kingdoms/engine/battle/DamageCalculator.ts",
        "M03:DC-applyDamage-比较: hp<=0→hp<0",
        "defender.hp <= 0",
        "defender.hp < 0",
        "src/games/three-kingdoms/engine/battle/__tests__/DamageCalculator.test.ts",
    ),
    (
        "src/games/three-kingdoms/engine/battle/DamageCalculator.ts",
        "M04:DC-getRestraintMultiplier-返回: 克制返回0.7",
        "return BATTLE_CONFIG.RESTRAINT_ADVANTAGE; // 克制：×1.5",
        "return BATTLE_CONFIG.RESTRAINT_DISADVANTAGE; // 克制(变异)",
        "src/games/three-kingdoms/engine/battle/__tests__/DamageCalculator.test.ts",
    ),
    (
        "src/games/three-kingdoms/engine/battle/DamageCalculator.ts",
        "M05:DC-calculateDamage-算术: (1+atkBonus)→(1-atkBonus)",
        "attacker.attack * (1 + atkBonus)",
        "attacker.attack * (1 - atkBonus)",
        "src/games/three-kingdoms/engine/battle/__tests__/DamageCalculator.test.ts",
    ),
    (
        "src/games/three-kingdoms/engine/battle/DamageCalculator.ts",
        "M06:DC-calculateDamage-比较: finalDamage<min→finalDamage<=min",
        "finalDamage < minDamage",
        "finalDamage <= minDamage",
        "src/games/three-kingdoms/engine/battle/__tests__/DamageCalculator.test.ts",
    ),
    # ── BuildingSystem.ts (6个) ──
    (
        "src/games/three-kingdoms/engine/building/BuildingSystem.ts",
        "M07:BS-checkUpgrade-比较: level>=maxLv→level>maxLv",
        "state.level >= maxLv",
        "state.level > maxLv",
        "src/games/three-kingdoms/engine/building/__tests__/BuildingSystem.test.ts",
    ),
    (
        "src/games/three-kingdoms/engine/building/BuildingSystem.ts",
        "M08:BS-cancelUpgrade-算术: 80%退款→100%退款",
        "Math.round(cost.grain * CANCEL_REFUND_RATIO)",
        "Math.round(cost.grain * 1.0)",
        "src/games/three-kingdoms/engine/building/__tests__/BuildingSystem.test.ts",
    ),
    (
        "src/games/three-kingdoms/engine/building/BuildingSystem.ts",
        "M09:BS-checkUpgrade-比较: level>=castle→level>castle",
        "state.level >= this.buildings.castle.level",
        "state.level > this.buildings.castle.level",
        "src/games/three-kingdoms/engine/building/__tests__/BuildingSystem.test.ts",
    ),
    (
        "src/games/three-kingdoms/engine/building/BuildingSystem.ts",
        "M10:BS-getProduction-返回: lv<=0返回0→返回1",
        "if (lv <= 0) return 0;",
        "if (lv <= 0) return 1;",
        "src/games/three-kingdoms/engine/building/__tests__/BuildingSystem.test.ts",
    ),
    (
        "src/games/three-kingdoms/engine/building/BuildingSystem.ts",
        "M11:BS-isQueueFull-比较: >=max→>max",
        "this.upgradeQueue.length >= this.getMaxQueueSlots()",
        "this.upgradeQueue.length > this.getMaxQueueSlots()",
        "src/games/three-kingdoms/engine/building/__tests__/BuildingSystem.test.ts",
    ),
    (
        "src/games/three-kingdoms/engine/building/BuildingSystem.ts",
        "M12:BS-checkUnlock-比较: castle>=required→castle>required",
        "this.buildings.castle.level >= required",
        "this.buildings.castle.level > required",
        "src/games/three-kingdoms/engine/building/__tests__/BuildingSystem.test.ts",
    ),
    # ── EquipmentEnhanceSystem.ts (6个) ──
    (
        "src/games/three-kingdoms/engine/equipment/EquipmentEnhanceSystem.ts",
        "M13:EE-enhance-比较: roll<rate→roll<=rate",
        "const isSuccess = roll < successRate;",
        "const isSuccess = roll <= successRate;",
        "src/games/three-kingdoms/engine/equipment/__tests__/EquipmentEnhanceSystem.test.ts",
    ),
    (
        "src/games/three-kingdoms/engine/equipment/EquipmentEnhanceSystem.ts",
        "M14:EE-getCopperCost-算术: copperGrowth→copperGrowth-0.1",
        "Math.pow(copperGrowth, level)",
        "Math.pow(copperGrowth - 0.1, level)",
        "src/games/three-kingdoms/engine/equipment/__tests__/EquipmentEnhanceSystem.test.ts",
    ),
    (
        "src/games/three-kingdoms/engine/equipment/EquipmentEnhanceSystem.ts",
        "M15:EE-enhance-比较: level>safe→level>=safe",
        "level > ENHANCE_CONFIG.safeLevel",
        "level >= ENHANCE_CONFIG.safeLevel",
        "src/games/three-kingdoms/engine/equipment/__tests__/EquipmentEnhanceSystem.test.ts",
    ),
    (
        "src/games/three-kingdoms/engine/equipment/EquipmentEnhanceSystem.ts",
        "M16:EE-getSuccessRate-返回: 0.01→1.0",
        "return 0.01;",
        "return 1.0;",
        "src/games/three-kingdoms/engine/equipment/__tests__/EquipmentEnhanceSystem.test.ts",
    ),
    (
        "src/games/three-kingdoms/engine/equipment/EquipmentEnhanceSystem.ts",
        "M17:EE-transferEnhance-算术: LEVEL_LOSS→0",
        "source.enhanceLevel - TRANSFER_LEVEL_LOSS",
        "source.enhanceLevel - 0",
        "src/games/three-kingdoms/engine/equipment/__tests__/EquipmentEnhanceSystem.test.ts",
    ),
    (
        "src/games/three-kingdoms/engine/equipment/EquipmentEnhanceSystem.ts",
        "M18:EE-enhance-比较: downgradeRoll<chance→downgradeRoll<=chance",
        "downgradeRoll < ENHANCE_CONFIG.downgradeChance",
        "downgradeRoll <= ENHANCE_CONFIG.downgradeChance",
        "src/games/three-kingdoms/engine/equipment/__tests__/EquipmentEnhanceSystem.test.ts",
    ),
]


def run_single_mutation(rel_file, desc, search, replace, test_file):
    """执行单个变异测试"""
    target = os.path.join(WORKSPACE, rel_file)
    test_path = os.path.join(WORKSPACE, test_file)

    if not os.path.exists(target):
        return "SKIP", f"文件不存在: {target}"

    # 读取源文件
    with open(target, "r") as f:
        original = f.read()

    # 检查搜索串是否存在
    if search not in original:
        return "SKIP", f"搜索串未找到: `{search}`"

    # 应用变异
    mutated = original.replace(search, replace, 1)

    # 写入变异后的文件
    with open(target, "w") as f:
        f.write(mutated)

    # 运行测试
    try:
        result = subprocess.run(
            ["npx", "vitest", "run", "--config", "vitest.config.three-kingdoms.ts", test_path],
            cwd=WORKSPACE,
            capture_output=True,
            text=True,
            timeout=60,
        )
        output = result.stdout + result.stderr

        # 检查是否有测试失败
        # vitest 输出格式: "Tests  X failed | Y passed"
        fail_match = re.search(r"(\d+) failed", output)
        if fail_match and int(fail_match.group(1)) > 0:
            failed_count = int(fail_match.group(1))
            return "KILLED", f"{failed_count} 个测试失败"
        elif "passed" in output:
            return "SURVIVED", "所有测试通过"
        else:
            return "SURVIVED", f"运行异常(退出码{result.returncode})"

    except subprocess.TimeoutExpired:
        return "SURVIVED", "测试超时"
    finally:
        # 恢复原文件
        with open(target, "w") as f:
            f.write(original)


def main():
    total = 0
    killed = 0
    survived = 0
    skipped = 0
    results = []

    print("=" * 60)
    print("  三国霸业引擎 — 变异测试开始")
    print(f"  时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)
    print()

    for rel_file, desc, search, replace, test_file in MUTATIONS:
        total += 1
        print(f"[MUT {total}] {desc}")
        print(f"  文件: {rel_file}")
        print(f"  变异: `{search}` → `{replace}`")

        status, detail = run_single_mutation(rel_file, desc, search, replace, test_file)
        results.append((desc, status, detail))

        if status == "KILLED":
            killed += 1
            print(f"  \033[32mKILLED\033[0m ✓ ({detail})")
        elif status == "SURVIVED":
            survived += 1
            print(f"  \033[31mSURVIVED\033[0m ✗ ({detail})")
        else:
            skipped += 1
            print(f"  \033[33mSKIPPED\033[0m — {detail}")
        print()

    # 计算
    effective = total - skipped
    kill_rate = (killed / effective * 100) if effective > 0 else 0

    # 输出汇总
    print("=" * 60)
    print("  变异测试完成")
    print("=" * 60)
    print(f"  变异总数:    {total}")
    print(f"  有效变异:    {effective} (排除跳过)")
    print(f"  \033[32m被杀死:      {killed}\033[0m")
    print(f"  \033[31m存活:        {survived}\033[0m")
    print(f"  \033[33m跳过:        {skipped}\033[0m")
    print(f"  \033[1;33m杀死率:      {kill_rate:.1f}%\033[0m")
    print()

    # 写入结果文件
    with open(RESULTS_FILE, "w") as f:
        f.write("═" * 60 + "\n")
        f.write("  三国霸业引擎 — 变异测试报告\n")
        f.write(f"  时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write("═" * 60 + "\n\n")

        for i, (desc, status, detail) in enumerate(results, 1):
            f.write(f"── 变异 #{i} ──\n")
            f.write(f"  描述: {desc}\n")
            if status == "KILLED":
                f.write(f"  结果: 💀 被杀死 ({detail})\n")
            elif status == "SURVIVED":
                f.write(f"  结果: 🧟 存活 ({detail})\n")
            else:
                f.write(f"  结果: ⏭️ 跳过 ({detail})\n")
            f.write("\n")

        f.write("═" * 60 + "\n")
        f.write("  汇总统计\n")
        f.write("═" * 60 + "\n")
        f.write(f"  变异总数:    {total}\n")
        f.write(f"  有效变异:    {effective}\n")
        f.write(f"  被杀死:      {killed}\n")
        f.write(f"  存活:        {survived}\n")
        f.write(f"  跳过:        {skipped}\n")
        f.write(f"  杀死率:      {kill_rate:.1f}%\n")
        f.write("═" * 60 + "\n")

    print(f"  详细报告: {RESULTS_FILE}")

    return results, kill_rate


if __name__ == "__main__":
    main()
