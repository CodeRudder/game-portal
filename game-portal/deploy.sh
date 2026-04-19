#!/bin/bash
# ============================================================================
# Game Portal 发布脚本
# 用法: ./deploy.sh [commit message]
#
# 功能:
#   1. 执行完整构建检查（类型检查 + 测试 + 构建）
#   2. 确认所有测试通过
#   3. Git add + commit + push
#   4. 等待 Vercel 自动部署
# ============================================================================

set -euo pipefail

# ---- 颜色定义 ----
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

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

# ---- 项目路径 ----
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ---- 参数 ----
COMMIT_MSG="${1:-}"

echo -e "\n${BOLD}╔══════════════════════════════════════╗${NC}"
echo -e "${BOLD}║      Game Portal 发布系统 v1.0       ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════╝${NC}"
echo -e "  时间: $(date '+%Y-%m-%d %H:%M:%S')\n"

TOTAL_START=$(date +%s)

# ============================================================================
# 第 1 步: 环境检查
# ============================================================================
log_step "环境检查"

if ! command -v git &> /dev/null; then
    log_error "未找到 git"
    exit 1
fi

if ! command -v pnpm &> /dev/null; then
    log_error "未找到 pnpm，请运行: npm install -g pnpm"
    exit 1
fi

# 检查是否在 git 仓库中
if ! git rev-parse --is-inside-work-tree &> /dev/null; then
    log_error "当前目录不是 Git 仓库"
    exit 1
fi

log_success "环境检查通过"

# ============================================================================
# 第 2 步: 检查工作区状态
# ============================================================================
log_step "检查 Git 工作区"

# 检查是否有变更
if git diff --quiet && git diff --cached --quiet; then
    log_warn "没有检测到文件变更"
    echo -n "  是否继续发布？(y/N): "
    read -r CONFIRM
    if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
        log_info "发布已取消"
        exit 0
    fi
fi

# 显示变更文件
CHANGED_FILES=$(git diff --name-only && git diff --cached --name-only)
if [ -n "$CHANGED_FILES" ]; then
    log_info "变更的文件:"
    echo "$CHANGED_FILES" | while read -r file; do
        echo -e "       ${YELLOW}•${NC} $file"
    done
fi

# ============================================================================
# 第 3 步: 完整构建检查
# ============================================================================
log_step "安装依赖"
timer_start
pnpm install --frozen-lockfile 2>/dev/null || pnpm install
timer_end
log_success "依赖安装完成"

log_step "TypeScript 类型检查"
timer_start
if pnpm exec tsc --noEmit; then
    timer_end
    log_success "TypeScript 类型检查通过"
else
    timer_end
    log_error "TypeScript 类型检查失败！请修复所有错误后再发布。"
    exit 1
fi

log_step "运行测试"
timer_start
if pnpm run test; then
    timer_end
    log_success "所有测试通过"
else
    timer_end
    log_error "测试未通过！请修复失败的测试后再发布。"
    exit 1
fi

log_step "Vite 生产构建"
timer_start
if pnpm run build; then
    timer_end
    log_success "生产构建成功"
else
    timer_end
    log_error "构建失败！请检查错误信息。"
    exit 1
fi

# ============================================================================
# 第 4 步: 确认发布
# ============================================================================
echo -e "\n${BOLD}${YELLOW}⚠ 即将发布到生产环境${NC}"
echo -e "  仓库: CodeRudder/game-portal"
echo -e "  分支: $(git branch --show-current)"
echo -e "  变更: $(echo "$CHANGED_FILES" | wc -l) 个文件"

# 如果没有提供 commit message，提示输入
if [ -z "$COMMIT_MSG" ]; then
    echo -n "  请输入 commit message: "
    read -r COMMIT_MSG
fi

if [ -z "$COMMIT_MSG" ]; then
    log_error "Commit message 不能为空"
    exit 1
fi

echo -n -e "\n  确认发布？(y/N): "
read -r CONFIRM
if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
    log_info "发布已取消"
    exit 0
fi

# ============================================================================
# 第 5 步: Git 提交和推送
# ============================================================================
log_step "Git 提交"

# 添加所有变更
git add -A
log_info "已暂存所有变更文件"

# 提交
git commit -m "$COMMIT_MSG"
log_success "已提交: $COMMIT_MSG"

# 推送
log_step "推送到远程仓库"
timer_start
CURRENT_BRANCH=$(git branch --show-current)
git push origin "$CURRENT_BRANCH"
timer_end
log_success "已推送到 origin/$CURRENT_BRANCH"

# ============================================================================
# 第 6 步: 等待 Vercel 部署
# ============================================================================
TOTAL_END=$(date +%s)
TOTAL_ELAPSED=$((TOTAL_END - TOTAL_START))

echo -e "\n${BOLD}╔══════════════════════════════════════╗${NC}"
echo -e "${GREEN}${BOLD}  ✔ 发布成功！总耗时: ${TOTAL_ELAPSED}s${NC}"
echo -e "${BOLD}╚══════════════════════════════════════╝${NC}"
echo ""
log_info "Vercel 将自动检测推送并开始部署"
log_info "查看部署状态: https://vercel.com/dashboard"
log_info "提交哈希: $(git rev-parse --short HEAD)"
echo ""
log_warn "请确认 Vercel 部署成功后再进行其他操作"
