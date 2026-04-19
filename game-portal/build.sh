#!/bin/bash
# ============================================================================
# Game Portal 构建脚本
# 用法: ./build.sh [dev|prod|check|test]
#
# 模式说明:
#   dev   - 开发构建（仅 vite build，跳过 tsc 和测试）
#   prod  - 完整生产构建（依赖安装 → tsc 检查 → 测试 → vite build）
#   check - 仅类型检查（tsc --noEmit）
#   test  - 仅运行测试
#   (默认) - 标准构建（依赖安装 → tsc 检查 → vite build）
# ============================================================================

set -euo pipefail

# ---- 颜色定义 ----
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# ---- 工具函数 ----

log_info()    { echo -e "${BLUE}[INFO]${NC}  $1"; }
log_success() { echo -e "${GREEN}[OK]${NC}    $1"; }
log_warn()    { echo -e "${YELLOW}[WARN]${NC}  $1"; }
log_error()   { echo -e "${RED}[ERROR]${NC} $1"; }
log_step()    { echo -e "\n${BOLD}${CYAN}━━━ $1 ━━━${NC}"; }

# 计时器
timer_start() { TIMER_START=$(date +%s); }
timer_end()   {
    local end=$(date +%s)
    local elapsed=$((end - TIMER_START))
    echo -e "       ${CYAN}耗时: ${elapsed}s${NC}"
}

# 步骤执行（带计时和状态报告）
run_step() {
    local description="$1"
    local command="$2"
    log_step "$description"
    timer_start
    if eval "$command"; then
        timer_end
        log_success "$description 完成"
    else
        timer_end
        log_error "$description 失败！"
        exit 1
    fi
}

# ---- 项目路径 ----
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ---- 解析参数 ----
MODE="${1:-build}"

echo -e "\n${BOLD}╔══════════════════════════════════════╗${NC}"
echo -e "${BOLD}║      Game Portal 构建系统 v1.0       ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════╝${NC}"
echo -e "  模式: ${BOLD}${MODE}${NC}"
echo -e "  目录: ${SCRIPT_DIR}"
echo -e "  时间: $(date '+%Y-%m-%d %H:%M:%S')\n"

TOTAL_START=$(date +%s)

# ---- 环境检查 ----
log_step "环境检查"

# 检查 Node.js
if ! command -v node &> /dev/null; then
    log_error "未找到 Node.js，请先安装 Node.js >= 18"
    exit 1
fi
NODE_VERSION=$(node -v)
log_info "Node.js 版本: $NODE_VERSION"

# 检查 Node.js 版本 >= 18
NODE_MAJOR=$(echo "$NODE_VERSION" | sed 's/v//' | cut -d. -f1)
if [ "$NODE_MAJOR" -lt 18 ]; then
    log_error "Node.js 版本过低（需要 >= 18），当前: $NODE_VERSION"
    exit 1
fi

# 检查 pnpm
if ! command -v pnpm &> /dev/null; then
    log_error "未找到 pnpm，请运行: npm install -g pnpm"
    exit 1
fi
PNPM_VERSION=$(pnpm -v)
log_info "pnpm 版本: $PNPM_VERSION"

# 检查项目 package.json
if [ ! -f "package.json" ]; then
    log_error "未找到 package.json，请确认项目目录正确"
    exit 1
fi

log_success "环境检查通过"

# ---- 根据模式执行 ----

case "$MODE" in

    dev)
        # 开发构建：仅 vite build
        run_step "开发构建 (vite build)" "pnpm exec vite build"
        ;;

    check)
        # 仅类型检查
        run_step "TypeScript 类型检查" "pnpm exec tsc --noEmit"
        ;;

    test)
        # 仅运行测试
        run_step "运行测试" "pnpm run test"
        ;;

    prod)
        # 完整生产构建
        run_step "安装依赖" "pnpm install --frozen-lockfile 2>/dev/null || pnpm install"
        run_step "TypeScript 类型检查" "pnpm exec tsc --noEmit"
        run_step "运行测试" "pnpm run test"
        run_step "Vite 生产构建" "pnpm exec vite build"
        ;;

    build|"")
        # 标准构建
        run_step "安装依赖" "pnpm install --frozen-lockfile 2>/dev/null || pnpm install"
        run_step "TypeScript 类型检查" "pnpm exec tsc --noEmit"
        run_step "Vite 构建" "pnpm run build"
        ;;

    *)
        log_error "未知模式: $MODE"
        echo ""
        echo "用法: ./build.sh [dev|prod|check|test]"
        echo ""
        echo "  dev   - 开发构建（仅 vite build）"
        echo "  prod  - 完整生产构建（依赖 + tsc + 测试 + vite build）"
        echo "  check - 仅 TypeScript 类型检查"
        echo "  test  - 仅运行测试"
        echo "  (默认) - 标准构建（依赖 + tsc + vite build）"
        exit 1
        ;;
esac

# ---- 构建结果 ----
TOTAL_END=$(date +%s)
TOTAL_ELAPSED=$((TOTAL_END - TOTAL_START))

echo -e "\n${BOLD}╔══════════════════════════════════════╗${NC}"
echo -e "${GREEN}${BOLD}  ✔ 构建成功！总耗时: ${TOTAL_ELAPSED}s${NC}"
echo -e "${BOLD}╚══════════════════════════════════════╝${NC}"

# 检查 dist 目录
if [ -d "dist" ]; then
    DIST_SIZE=$(du -sh dist | cut -f1)
    DIST_FILES=$(find dist -type f | wc -l)
    log_info "输出目录: dist/ (${DIST_SIZE}, ${DIST_FILES} 个文件)"
fi
