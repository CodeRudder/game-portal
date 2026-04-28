#!/bin/bash
cd /home/gongdewei/.deer-flow/threads/54e645f2-e703-4ce9-9914-416288c05d14/user-data/workspace/game-portal
ACC_DIR="src/games/three-kingdoms/tests/acc"
echo "=== Find in script ===" > /home/gongdewei/.deer-flow/threads/54e645f2-e703-4ce9-9914-416288c05d14/user-data/workspace/game-portal/debug-result.txt
find "$ACC_DIR" -maxdepth 1 -name "FLOW-*.test.tsx" -type f | sort >> /home/gongdewei/.deer-flow/threads/54e645f2-e703-4ce9-9914-416288c05d14/user-data/workspace/game-portal/debug-result.txt
echo "" >> /home/gongdewei/.deer-flow/threads/54e645f2-e703-4ce9-9914-416288c05d14/user-data/workspace/game-portal/debug-result.txt
echo "=== Count ===" >> /home/gongdewei/.deer-flow/threads/54e645f2-e703-4ce9-9914-416288c05d14/user-data/workspace/game-portal/debug-result.txt
find "$ACC_DIR" -maxdepth 1 -name "FLOW-*.test.tsx" -type f | wc -l >> /home/gongdewei/.deer-flow/threads/54e645f2-e703-4ce9-9914-416288c05d14/user-data/workspace/game-portal/debug-result.txt
