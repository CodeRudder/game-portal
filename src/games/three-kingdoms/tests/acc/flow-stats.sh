#!/bin/bash
cd /home/gongdewei/.deer-flow/threads/54e645f2-e703-4ce9-9914-416288c05d14/user-data/workspace/game-portal
ACC_DIR="src/games/three-kingdoms/tests/acc"

echo "=== FLOW Test Files ==="
find "$ACC_DIR" -maxdepth 1 -name "FLOW-*.test.tsx" -type f | sort | while IFS= read -r f; do
  name=$(basename "$f" .test.tsx)
  lines=$(wc -l < "$f")
  cases=$(grep -c "it(" "$f" 2>/dev/null || echo 0)
  echo "  $name: ${lines} lines, ${cases} cases"
done

flow_file_count=$(find "$ACC_DIR" -maxdepth 1 -name "FLOW-*.test.tsx" -type f | wc -l)
flow_total_cases=$(find "$ACC_DIR" -maxdepth 1 -name "FLOW-*.test.tsx" -type f -exec grep -c "it(" {} + | awk -F: '{sum+=$2}END{print sum+0}')
flow_total_lines=$(find "$ACC_DIR" -maxdepth 1 -name "FLOW-*.test.tsx" -type f -exec cat {} + | wc -l)
echo "  TOTAL: $flow_file_count files, $flow_total_cases cases, $flow_total_lines lines"

echo ""
echo "=== ACC Test Files ==="
find "$ACC_DIR" -maxdepth 1 \( -name "ACC-*.test.tsx" -o -name "acc-*.test.tsx" \) -type f | sort | while IFS= read -r f; do
  name=$(basename "$f" .test.tsx)
  [[ "$name" == *"模板"* ]] && continue
  lines=$(wc -l < "$f")
  cases=$(grep -c "it(" "$f" 2>/dev/null || echo 0)
  echo "  $name: ${lines} lines, ${cases} cases"
done

acc_file_count=$(find "$ACC_DIR" -maxdepth 1 \( -name "ACC-*.test.tsx" -o -name "acc-*.test.tsx" \) -type f | wc -l)
acc_total_cases=$(find "$ACC_DIR" -maxdepth 1 \( -name "ACC-*.test.tsx" -o -name "acc-*.test.tsx" \) -type f -exec grep -c "it(" {} + | awk -F: '{sum+=$2}END{print sum+0}')
acc_total_lines=$(find "$ACC_DIR" -maxdepth 1 \( -name "ACC-*.test.tsx" -o -name "acc-*.test.tsx" \) -type f -exec cat {} + | wc -l)
echo "  TOTAL: $acc_file_count files, $acc_total_cases cases, $acc_total_lines lines"

echo ""
echo "=== Grand Total ==="
echo "  $((flow_file_count + acc_file_count)) files, $((flow_total_cases + acc_total_cases)) cases, $((flow_total_lines + acc_total_lines)) lines"

echo ""
echo "=== Quality Checks ==="
echo "1. Files >1000 lines:"
find "$ACC_DIR" -maxdepth 1 -name "FLOW-*.test.tsx" -type f | while IFS= read -r f; do
  lines=$(wc -l < "$f")
  if [ "$lines" -gt 1000 ]; then
    echo "  WARNING: $(basename $f): ${lines} lines"
  fi
done
echo "  (check complete)"

echo "2. Always-pass patterns:"
grep -rn "else.*assertStrict.*true" "$ACC_DIR"/ --include="*.tsx" --include="*.ts" 2>/dev/null || echo "  PASS: none found"

echo "3. GameEventSimulator coverage:"
find "$ACC_DIR" -maxdepth 1 -name "FLOW-*.test.tsx" -type f | while IFS= read -r f; do
  has_sim=$(grep -c "GameEventSimulator" "$f" 2>/dev/null || echo 0)
  if [ "$has_sim" -eq 0 ]; then
    echo "  WARNING: $(basename $f): no GameEventSimulator"
  fi
done
echo "  (check complete)"
