#!/usr/bin/env python3
"""
变异测试自动化脚本
三国霸业引擎 — Mutation Testing Runner

对3个核心模块执行变异测试：
1. EquipmentEnhanceSystem — 装备强化
2. BuildingSystem — 建筑系统
3. DamageCalculator — 伤害计算
"""

import subprocess
import os
import re
import json
import shutil
from dataclasses import dataclass, field
from typing import List, Tuple

WORKSPACE = "/mnt/user-data/workspace"

@dataclass
class Mutation:
    """单个变异定义"""
    id: str
    module: str
    target_file: str
    test_file: str
    description: str
    old_code: str
    new_code: str
    category: str  # 算术/比较/逻辑/常量/返回值/语句删除

@dataclass
class MutationResult:
    """变异测试结果"""
    mutation: Mutation
    killed: bool
    test_output: str = ""
    failed_tests: List[str] = field(default_factory=list)

def define_mutations() -> List[Mutation]:
    """定义所有变异"""
    mutations = []

    # ============================================================
    # 模块1: EquipmentEnhanceSystem — 装备强化
    # ============================================================
    eq_target = f"{WORKSPACE}/src/games/three-kingdoms/engine/equipment/EquipmentEnhanceSystem.ts"
    eq_test = f"{WORKSPACE}/src/games/three-kingdoms/engine/equipment/__tests__/EquipmentEnhanceSystem.test.ts"

    mutations.extend([
        Mutation("E1", "EquipmentEnhanceSystem", eq_target, eq_test,
                 "算术变异: newLevel = level + 1 → level - 1",
                 "      newLevel = level + 1;",
                 "      newLevel = level - 1;",
                 "算术"),
        Mutation("E2", "EquipmentEnhanceSystem", eq_target, eq_test,
                 "比较变异: enhanceLevel >= rarityCap → enhanceLevel > rarityCap",
                 "eq.enhanceLevel >= rarityCap",
                 "eq.enhanceLevel > rarityCap",
                 "比较"),
        Mutation("E3", "EquipmentEnhanceSystem", eq_target, eq_test,
                 "比较变异: level > safeLevel → level >= safeLevel",
                 "level > ENHANCE_CONFIG.safeLevel",
                 "level >= ENHANCE_CONFIG.safeLevel",
                 "比较"),
        Mutation("E4", "EquipmentEnhanceSystem", eq_target, eq_test,
                 "逻辑变异: gold && level>=12 → gold || level>=12",
                 "eq.rarity === 'gold' && level >= 12",
                 "eq.rarity === 'gold' || level >= 12",
                 "逻辑"),
        Mutation("E5", "EquipmentEnhanceSystem", eq_target, eq_test,
                 "返回值变异: Math.max(0, ...) → Math.min(0, ...)",
                 "Math.max(0, source.enhanceLevel - TRANSFER_LEVEL_LOSS)",
                 "Math.min(0, source.enhanceLevel - TRANSFER_LEVEL_LOSS)",
                 "返回值"),
        Mutation("E6", "EquipmentEnhanceSystem", eq_target, eq_test,
                 "比较变异: protCost > 0 → protCost >= 0",
                 "if (useProtection && protCost > 0)",
                 "if (useProtection && protCost >= 0)",
                 "比较"),
        Mutation("E7", "EquipmentEnhanceSystem", eq_target, eq_test,
                 "语句删除: 移除 protectionCount -= protCost",
                 "          this.protectionCount -= protCost;",
                 "          // MUTATION: removed protectionCount decrement",
                 "语句删除"),
        Mutation("E8", "EquipmentEnhanceSystem", eq_target, eq_test,
                 "常量变异: getSuccessRate fallback 0.01 → 0.99",
                 "return ENHANCE_CONFIG.successRates[level] ?? 0.01;",
                 "return ENHANCE_CONFIG.successRates[level] ?? 0.99;",
                 "常量"),
        Mutation("E9", "EquipmentEnhanceSystem", eq_target, eq_test,
                 "比较变异: totalCopper >= maxCopper → totalCopper > maxCopper",
                 "if (totalCopper >= config.maxCopper) break;",
                 "if (totalCopper > config.maxCopper) break;",
                 "比较"),
        Mutation("E10", "EquipmentEnhanceSystem", eq_target, eq_test,
                 "常量变异: getStoneCost Math.max(1,...) → Math.max(0,...)",
                 "return Math.max(1, Math.floor(baseStone",
                 "return Math.max(0, Math.floor(baseStone",
                 "常量"),
    ])

    # ============================================================
    # 模块2: BuildingSystem — 建筑系统
    # ============================================================
    bld_target = f"{WORKSPACE}/src/games/three-kingdoms/engine/building/BuildingSystem.ts"
    bld_test = f"{WORKSPACE}/src/games/three-kingdoms/engine/__tests__/engine-building.test.ts"

    mutations.extend([
        Mutation("B1", "BuildingSystem", bld_target, bld_test,
                 "比较变异: state.level >= maxLv → > maxLv",
                 "state.level >= maxLv",
                 "state.level > maxLv",
                 "比较"),
        Mutation("B2", "BuildingSystem", bld_target, bld_test,
                 "比较变异: building level >= castle → > castle",
                 "state.level >= this.buildings.castle.level",
                 "state.level > this.buildings.castle.level",
                 "比较"),
        Mutation("B3", "BuildingSystem", bld_target, bld_test,
                 "常量变异: CANCEL_REFUND_RATIO → 1.0 (全额退款)",
                 "Math.round(cost.grain * CANCEL_REFUND_RATIO)",
                 "Math.round(cost.grain * 1.0)",
                 "常量"),
        Mutation("B4", "BuildingSystem", bld_target, bld_test,
                 "逻辑变异: status === 'locked' → status !== 'locked'",
                 "if (s.status === 'locked' && this.checkUnlock",
                 "if (s.status !== 'locked' && this.checkUnlock",
                 "逻辑"),
        Mutation("B5", "BuildingSystem", bld_target, bld_test,
                 "常量变异: castle next === 5 → next === 6",
                 "if (next === 5 && !BUILDING_TYPES",
                 "if (next === 6 && !BUILDING_TYPES",
                 "常量"),
        Mutation("B6", "BuildingSystem", bld_target, bld_test,
                 "算术变异: state.level += 1 → state.level += 2",
                 "        state.level += 1;\n        state.status = 'idle';",
                 "        state.level += 2;\n        state.status = 'idle';",
                 "算术"),
        Mutation("B7", "BuildingSystem", bld_target, bld_test,
                 "语句删除: 移除 castle升级后的 checkAndUnlockBuildings()",
                 "if (completed.includes('castle')) this.checkAndUnlockBuildings();",
                 "// MUTATION: removed checkAndUnlockBuildings()",
                 "语句删除"),
        Mutation("B8", "BuildingSystem", bld_target, bld_test,
                 "返回值变异: getCastleBonusMultiplier 1 + → 1 -",
                 "return 1 + this.getCastleBonusPercent() / 100;",
                 "return 1 - this.getCastleBonusPercent() / 100;",
                 "返回值"),
    ])

    # ============================================================
    # 模块3: DamageCalculator — 伤害计算
    # ============================================================
    dmg_target = f"{WORKSPACE}/src/games/three-kingdoms/engine/battle/DamageCalculator.ts"
    dmg_test = f"{WORKSPACE}/src/games/three-kingdoms/engine/battle/__tests__/DamageCalculator.test.ts"

    mutations.extend([
        Mutation("D1", "DamageCalculator", dmg_target, dmg_test,
                 "算术变异: Math.max(1, rawDamage) → Math.max(0, rawDamage)",
                 "const baseDamage = Math.max(1, rawDamage);",
                 "const baseDamage = Math.max(0, rawDamage);",
                 "算术"),
        Mutation("D2", "DamageCalculator", dmg_target, dmg_test,
                 "常量变异: MIN_DAMAGE_RATIO → 0 (移除最低伤害保底)",
                 "const minDamage = effectiveAttack * BATTLE_CONFIG.MIN_DAMAGE_RATIO;",
                 "const minDamage = effectiveAttack * 0;",
                 "常量"),
        Mutation("D3", "DamageCalculator", dmg_target, dmg_test,
                 "逻辑变异: isControlled some() → every()",
                 "return unit.buffs.some(",
                 "return unit.buffs.every(",
                 "逻辑"),
        Mutation("D4", "DamageCalculator", dmg_target, dmg_test,
                 "比较变异: defender.hp <= 0 → defender.hp < 0",
                 "if (defender.hp <= 0) {",
                 "if (defender.hp < 0) {",
                 "比较"),
        Mutation("D5", "DamageCalculator", dmg_target, dmg_test,
                 "语句删除: 移除 reduceShield 调用",
                 "      this.reduceShield(defender, shieldAbsorbed);",
                 "      // MUTATION: removed reduceShield call",
                 "语句删除"),
        Mutation("D6", "DamageCalculator", dmg_target, dmg_test,
                 "常量变异: RESTRAINT_ADVANTAGE → RESTRAINT_DISADVANTAGE",
                 "return BATTLE_CONFIG.RESTRAINT_ADVANTAGE; // 克制：×1.5",
                 "return BATTLE_CONFIG.RESTRAINT_DISADVANTAGE; // MUTATION",
                 "常量"),
        Mutation("D7", "DamageCalculator", dmg_target, dmg_test,
                 "算术变异: getAttackBonus += → -= (ATK_UP branch)",
                 "if (buff.type === BuffType.ATK_UP) {\n      bonus += buff.value;",
                 "if (buff.type === BuffType.ATK_UP) {\n      bonus -= buff.value;",
                 "算术"),
        Mutation("D8", "DamageCalculator", dmg_target, dmg_test,
                 "算术变异: effectiveAttack (1 + atkBonus) → (1 - atkBonus)",
                 "const effectiveAttack = attacker.attack * (1 + atkBonus);",
                 "const effectiveAttack = attacker.attack * (1 - atkBonus);",
                 "算术"),
        Mutation("D9", "DamageCalculator", dmg_target, dmg_test,
                 "语句删除: 移除 applyDamage 的 isAlive 检查",
                 "if (!defender.isAlive) return 0;",
                 "// MUTATION: removed isAlive check",
                 "语句删除"),
        Mutation("D10", "DamageCalculator", dmg_target, dmg_test,
                 "返回值变异: applyDamage 返回值 actualDamage → 0",
                 "    return actualDamage;",
                 "    return 0;",
                 "返回值"),
    ])

    return mutations


def apply_mutation(target_file: str, old_code: str, new_code: str) -> bool:
    """应用变异到目标文件"""
    with open(target_file, 'r', encoding='utf-8') as f:
        content = f.read()

    if old_code not in content:
        print(f"    ⚠️ 未找到目标代码: {old_code[:60]}...")
        return False

    content = content.replace(old_code, new_code, 1)

    with open(target_file, 'w', encoding='utf-8') as f:
        f.write(content)
    return True


def restore_file(target_file: str, backup_file: str):
    """从备份恢复文件"""
    shutil.copy2(backup_file, target_file)


def run_test(test_file: str) -> Tuple[bool, str]:
    """运行测试，返回 (是否通过, 输出)"""
    result = subprocess.run(
        ['npx', 'vitest', 'run', test_file, '--reporter=verbose'],
        capture_output=True,
        text=True,
        cwd=WORKSPACE,
        timeout=120
    )
    output = result.stdout + result.stderr
    # 检查是否有失败的测试
    has_failure = result.returncode != 0
    return has_failure, output


def extract_failed_tests(output: str) -> List[str]:
    """从测试输出中提取失败的测试名称"""
    failed = []
    for line in output.split('\n'):
        if 'FAIL' in line or '×' in line or 'failed' in line.lower():
            failed.append(line.strip())
    return failed


def main():
    print("=" * 60)
    print("  三国霸业引擎 — 变异测试 (Mutation Testing)")
    print("=" * 60)
    print()

    mutations = define_mutations()
    results: List[MutationResult] = []

    for i, mut in enumerate(mutations):
        print(f"[{i+1}/{len(mutations)}] {mut.id}: {mut.description}")
        print(f"  模块: {mut.module} | 类别: {mut.category}")

        # 备份原文件
        backup_file = mut.target_file + ".bak"
        shutil.copy2(mut.target_file, backup_file)

        # 应用变异
        applied = apply_mutation(mut.target_file, mut.old_code, mut.new_code)
        if not applied:
            print("  ⚠️ 变异未应用（代码未找到），跳过")
            restore_file(mut.target_file, backup_file)
            os.remove(backup_file)
            continue

        # 运行测试
        try:
            has_failure, output = run_test(mut.test_file)
            failed_tests = extract_failed_tests(output)

            if has_failure:
                print(f"  结果: KILLED ✅ ({len(failed_tests)} 个测试失败)")
                results.append(MutationResult(mut, killed=True, test_output=output, failed_tests=failed_tests))
            else:
                print(f"  结果: SURVIVED ❌ (所有测试通过)")
                results.append(MutationResult(mut, killed=False, test_output=output))
        except subprocess.TimeoutExpired:
            print(f"  结果: TIMEOUT ⚠️")
            results.append(MutationResult(mut, killed=True, test_output="TIMEOUT"))
        except Exception as e:
            print(f"  结果: ERROR ⚠️ {str(e)}")
            results.append(MutationResult(mut, killed=False, test_output=str(e)))

        # 恢复原文件
        restore_file(mut.target_file, backup_file)
        os.remove(backup_file)
        print()

    # ============================================================
    # 汇总报告
    # ============================================================
    print()
    print("=" * 60)
    print("  变异测试结果汇总")
    print("=" * 60)
    print()

    killed = sum(1 for r in results if r.killed)
    survived = sum(1 for r in results if not r.killed)
    total = len(results)
    kill_rate = (killed / total * 100) if total > 0 else 0

    print(f"  总变异数: {total}")
    print(f"  杀死数:   {killed}")
    print(f"  存活数:   {survived}")
    print(f"  变异杀死率: {kill_rate:.1f}%")
    print()

    # 按模块分组
    modules = {}
    for r in results:
        if r.mutation.module not in modules:
            modules[r.mutation.module] = []
        modules[r.mutation.module].append(r)

    for module, module_results in modules.items():
        mk = sum(1 for r in module_results if r.killed)
        ms = sum(1 for r in module_results if not r.killed)
        mt = len(module_results)
        mr = (mk / mt * 100) if mt > 0 else 0
        print(f"  📦 {module}: {mk}/{mt} 杀死 ({mr:.0f}%)")

        for r in module_results:
            status = "✅ KILLED" if r.killed else "❌ SURVIVED"
            print(f"    {status} [{r.mutation.id}] {r.mutation.description}")
        print()

    # 存活变异分析
    survived_results = [r for r in results if not r.killed]
    if survived_results:
        print("  ⚠️ 存活变异分析:")
        for r in survived_results:
            print(f"    [{r.mutation.id}] {r.mutation.description}")
            print(f"      原因: 现有测试未检测到此变异")
            print(f"      类别: {r.mutation.category}")
            print()

    # 保存JSON结果
    json_results = {
        "total": total,
        "killed": killed,
        "survived": survived,
        "kill_rate": kill_rate,
        "mutations": [
            {
                "id": r.mutation.id,
                "module": r.mutation.module,
                "description": r.mutation.description,
                "category": r.mutation.category,
                "killed": r.killed,
                "old_code": r.mutation.old_code,
                "new_code": r.mutation.new_code,
            }
            for r in results
        ]
    }

    output_path = f"{WORKSPACE}/src/games/three-kingdoms/tests/coverage-optimization/mutations/mutation-results.json"
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(json_results, f, ensure_ascii=False, indent=2)
    print(f"\n  结果已保存到: {output_path}")


if __name__ == "__main__":
    main()
