#!/bin/bash
cd /home/gongdewei/.deer-flow/threads/54e645f2-e703-4ce9-9914-416288c05d14/user-data/workspace/game-portal
ACC_DIR="src/games/three-kingdoms/tests/acc"
find "$ACC_DIR" -maxdepth 1 -name "FLOW-*.test.tsx" -type f | sort | while IFS= read -r f; do
  name=$(basename "$f" .test.tsx)
  echo "FILE: $name"
done
echo "DONE"
