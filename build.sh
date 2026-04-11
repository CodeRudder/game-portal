#!/bin/bash
set -e
echo "=== Installing dependencies ==="
cd /mnt/user-data/workspace/game-portal
npm install 2>&1
echo ""
echo "=== Running build ==="
npm run build 2>&1
echo ""
echo "=== Build complete ==="
