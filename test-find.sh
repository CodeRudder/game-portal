#!/bin/bash
cd /home/gongdewei/.deer-flow/threads/54e645f2-e703-4ce9-9914-416288c05d14/user-data/workspace/game-portal
ACC_DIR="src/games/three-kingdoms/tests/acc"
echo "Find count:"
find "$ACC_DIR" -maxdepth 1 -name "FLOW-*.test.tsx" -type f | wc -l
echo ""
echo "Files:"
find "$ACC_DIR" -maxdepth 1 -name "FLOW-*.test.tsx" -type f | sort
echo ""
echo "While loop test:"
count=0
while IFS= read -r f; do
  count=$((count + 1))
done < <(find "$ACC_DIR" -maxdepth 1 -name "FLOW-*.test.tsx" -type f | sort)
echo "Loop count: $count"
