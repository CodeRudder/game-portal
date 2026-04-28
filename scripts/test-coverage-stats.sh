#!/bin/bash
# 三国霸业集成测试覆盖率统计脚本
# 使用 game-portal 本地 vitest + --root 确保路径别名正确解析

VITEST="/mnt/user-data/workspace/game-portal/node_modules/.bin/vitest"
ROOT="/mnt/user-data/workspace/game-portal"

echo "======================================"
echo "三国霸业集成测试覆盖率统计"
echo "======================================"
echo ""

echo "--- FLOW集成测试文件统计 ---"
total_lines=0
total_cases=0
flow_count=0
for f in $ROOT/src/games/three-kingdoms/tests/acc/FLOW-*.test.tsx; do
    lines=$(wc -l < "$f")
    cases=$(grep -c "it(" "$f" 2>/dev/null || echo 0)
    name=$(basename "$f")
    printf "%-55s %4d行 %3d用例\n" "$name" "$lines" "$cases"
    total_lines=$((total_lines + lines))
    total_cases=$((total_cases + cases))
    flow_count=$((flow_count + 1))
done
echo "--------------------------------------"
printf "合计: %48s %4d行 %3d用例 (%d个文件)\n" "" "$total_lines" "$total_cases" "$flow_count"
echo ""

echo "--- ACC验收测试文件统计 ---"
acc_lines=0
acc_cases=0
acc_count=0
for f in $ROOT/src/games/three-kingdoms/tests/acc/ACC-*.test.tsx; do
    name=$(basename "$f")
    if [[ "$name" == *"模板"* ]]; then
        continue
    fi
    lines=$(wc -l < "$f")
    cases=$(grep -c "it(" "$f" 2>/dev/null || echo 0)
    printf "%-55s %4d行 %3d用例\n" "$name" "$lines" "$cases"
    acc_lines=$((acc_lines + lines))
    acc_cases=$((acc_cases + cases))
    acc_count=$((acc_count + 1))
done
echo "--------------------------------------"
printf "合计: %48s %4d行 %3d用例 (%d个文件)\n" "" "$acc_lines" "$acc_cases" "$acc_count"
echo ""

echo "--- 其他测试文件统计 ---"
other_lines=0
other_cases=0
other_count=0
for f in $ROOT/src/games/three-kingdoms/tests/acc/acc-*.test.tsx; do
    lines=$(wc -l < "$f")
    cases=$(grep -c "it(" "$f" 2>/dev/null || echo 0)
    name=$(basename "$f")
    printf "%-55s %4d行 %3d用例\n" "$name" "$lines" "$cases"
    other_lines=$((other_lines + lines))
    other_cases=$((other_cases + cases))
    other_count=$((other_count + 1))
done
echo "--------------------------------------"
printf "合计: %48s %4d行 %3d用例 (%d个文件)\n" "" "$other_lines" "$other_cases" "$other_count"
echo ""

echo "--- 总体统计 ---"
all_lines=$((total_lines + acc_lines + other_lines))
all_cases=$((total_cases + acc_cases + other_cases))
all_files=$((flow_count + acc_count + other_count))
echo "FLOW集成测试: $flow_count 文件, $total_cases 用例, $total_lines 行"
echo "ACC验收测试:  $acc_count 文件, $acc_cases 用例, $acc_lines 行"
echo "其他测试:     $other_count 文件, $other_cases 用例, $other_lines 行"
echo "总计:         $all_files 文件, $all_cases 用例, $all_lines 行"
echo ""

echo "--- 全量测试运行 ---"
timeout 300 "$VITEST" run "src/games/three-kingdoms/tests/acc/" --root "$ROOT" 2>&1 | grep -E "Test Files|Tests|Duration"
