#!/bin/bash
# Game Portal 构建和启动脚本
set -e

echo "========================================="
echo "  Game Portal - 构建和启动"
echo "========================================="

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

echo ""
echo "[1/3] 安装依赖..."
npm install 2>&1
echo "✅ 依赖安装完成"

echo ""
echo "[2/3] 构建项目..."
npm run build 2>&1
echo "✅ 构建完成"

echo ""
echo "[3/3] 启动开发服务器..."
echo "服务器将在 http://localhost:3000 启动"
npm run dev &

echo ""
echo "========================================="
echo "  ✅ 所有步骤完成！"
echo "  访问 http://localhost:3000 开始游戏"
echo "========================================="
