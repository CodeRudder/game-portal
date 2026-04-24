#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# Game Portal 分组测试脚本
# ═══════════════════════════════════════════════════════════════
# 用法: ./scripts/test.sh [group]
#   all (默认)  = 全量测试
#   tk          = 三国霸业 (~4000+ 用例)
#   idle        = 放置引擎 (~80 用例)
#   arcade      = 经典游戏 + 渲染器 (~200 用例)
#   smoke       = 冒烟测试
#   e2e         = 白屏检测 (Playwright)
#   ci          = CI 模式 (全量 + 构建)
# ═══════════════════════════════════════════════════════════════

set -e
cd "$(dirname "$0")/.."

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

GROUP="${1:-all}"

echo -e "${CYAN}═══════════════════════════════════════════${NC}"
echo -e "${CYAN}  Game Portal Test Runner — ${GROUP}${NC}"
echo -e "${CYAN}═══════════════════════════════════════════${NC}"

case "$GROUP" in
  tk|three-kingdoms)
    echo -e "${YELLOW}[三国霸业] 运行测试...${NC}"
    npx vitest run --config vitest.three-kingdoms.config.ts
    ;;
  idle)
    echo -e "${YELLOW}[放置引擎] 运行测试...${NC}"
    npx vitest run --config vitest.idle.config.ts
    ;;
  arcade)
    echo -e "${YELLOW}[经典游戏] 运行测试...${NC}"
    npx vitest run --config vitest.arcade.config.ts
    ;;
  smoke)
    echo -e "${YELLOW}[冒烟测试] 运行测试...${NC}"
    npx vitest run src/__tests__/smoke/
    ;;
  e2e)
    echo -e "${YELLOW}[白屏检测] 运行 Playwright...${NC}"
    npx playwright test e2e/ --config e2e/playwright.config.ts
    ;;
  ci)
    echo -e "${YELLOW}[CI模式] 全量测试 + 构建...${NC}"
    echo -e "${CYAN}── Step 1: 三国霸业测试 ──${NC}"
    npx vitest run --config vitest.three-kingdoms.config.ts
    echo -e "${CYAN}── Step 2: 放置引擎测试 ──${NC}"
    npx vitest run --config vitest.idle.config.ts
    echo -e "${CYAN}── Step 3: 经典游戏测试 ──${NC}"
    npx vitest run --config vitest.arcade.config.ts
    echo -e "${CYAN}── Step 4: 构建 ──${NC}"
    pnpm run build
    echo -e "${GREEN}✅ CI 全部通过${NC}"
    ;;
  all|"")
    echo -e "${YELLOW}[全量测试] 运行所有测试...${NC}"
    npx vitest run
    ;;
  *)
    echo "用法: $0 [tk|idle|arcade|smoke|e2e|ci|all]"
    exit 1
    ;;
esac

echo -e "${GREEN}═══════════════════════════════════════════${NC}"
echo -e "${GREEN}  ✅ 测试完成: ${GROUP}${NC}"
echo -e "${GREEN}═══════════════════════════════════════════${NC}"
