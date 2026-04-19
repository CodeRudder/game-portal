#!/bin/bash
# deploy-docker.sh — 可执行脚本
# ============================================
# Game Portal - Docker 一键构建启动脚本
# ============================================
# 用法：
#   ./deploy-docker.sh           # 完整流程：创建容器→安装依赖→编译→启动服务
#   ./deploy-docker.sh build     # 仅编译
#   ./deploy-docker.sh start     # 仅启动开发服务
#   ./deploy-docker.sh stop      # 停止容器
#   ./deploy-docker.sh logs      # 查看日志
#   ./deploy-docker.sh shell     # 进入容器终端
#   ./deploy-docker.sh status    # 查看运行状态
# ============================================

set -e

# ---------- 配置 ----------
CONTAINER_NAME="game-portal"
IMAGE_NAME="game-portal-dev"
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
PORT=3000

# ---------- 颜色 ----------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log_info()  { echo -e "${CYAN}[INFO]${NC} $1"; }
log_ok()    { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_err()   { echo -e "${RED}[ERROR]${NC} $1"; }

# ---------- 检测容器运行时 ----------
detect_runtime() {
    if command -v docker &>/dev/null; then
        echo "docker"
    elif command -v podman &>/dev/null; then
        echo "podman"
    else
        echo ""
    fi
}

RUNTIME=$(detect_runtime)
if [ -z "$RUNTIME" ]; then
    log_err "未检测到 Docker 或 Podman，请先安装。"
    exit 1
fi

log_info "使用容器运行时: $RUNTIME"

# ---------- 容器是否存在 ----------
container_exists() {
    $RUNTIME ps -a --filter "name=$CONTAINER_NAME" --format '{{.Names}}' 2>/dev/null | grep -q "$CONTAINER_NAME"
}

# ---------- 容器是否运行 ----------
container_running() {
    $RUNTIME ps --filter "name=$CONTAINER_NAME" --format '{{.Names}}' 2>/dev/null | grep -q "$CONTAINER_NAME"
}

# ---------- exec 封装 ----------
container_exec() {
    $RUNTIME exec "$CONTAINER_NAME" sh -c "$1"
}

# ============================================
# 命令：创建容器
# ============================================
cmd_create() {
    if container_running; then
        log_ok "容器 $CONTAINER_NAME 已在运行"
        return 0
    fi

    if container_exists; then
        log_info "启动已有容器..."
        $RUNTIME start "$CONTAINER_NAME"
        log_ok "容器已启动"
        return 0
    fi

    log_info "构建镜像 $IMAGE_NAME ..."
    START_TIME=$(date +%s)

    $RUNTIME build -t "$IMAGE_NAME" -f "$PROJECT_DIR/Dockerfile.dev" "$PROJECT_DIR"

    END_TIME=$(date +%s)
    log_ok "镜像构建完成 ($((END_TIME - START_TIME))s)"

    log_info "创建并启动容器..."
    $RUNTIME run -d \
        --name "$CONTAINER_NAME" \
        -p "${PORT}:3000" \
        -v "$PROJECT_DIR:/app" \
        "$IMAGE_NAME"

    sleep 1

    if container_running; then
        log_ok "容器 $CONTAINER_NAME 已创建并运行"
    else
        log_err "容器启动失败，查看日志："
        $RUNTIME logs "$CONTAINER_NAME"
        exit 1
    fi
}

# ============================================
# 命令：安装依赖
# ============================================
cmd_install() {
    log_info "安装 npm 依赖..."
    container_exec "cd /app && npm install 2>&1"
    log_ok "依赖安装完成"
}

# ============================================
# 命令：编译构建
# ============================================
cmd_build() {
    log_info "开始编译构建..."
    START_TIME=$(date +%s)

    container_exec "cd /app && npm run build 2>&1"

    END_TIME=$(date +%s)
    log_ok "构建完成 ($((END_TIME - START_TIME))s)"
    log_info "产物位于 dist/ 目录"
}

# ============================================
# 命令：启动开发服务
# ============================================
cmd_start() {
    log_info "启动 Vite 开发服务器..."

    # 先杀掉已有的 dev server 进程
    container_exec "pkill -f 'vite' 2>/dev/null || true"
    sleep 1

    # 后台启动 dev server
    $RUNTIME exec -d "$CONTAINER_NAME" sh -c "cd /app && npm run dev -- --host 0.0.0.0 2>&1 > /tmp/vite.log"

    sleep 3

    # 检查是否启动成功
    if container_exec "curl -s http://localhost:3000 > /dev/null 2>&1"; then
        log_ok "开发服务器已启动"
        log_info "访问地址: ${CYAN}http://localhost:${PORT}${NC}"
    else
        log_warn "服务可能还在启动中，稍后请检查日志"
        log_info "查看日志: ./deploy-docker.sh logs"
    fi
}

# ============================================
# 命令：停止容器
# ============================================
cmd_stop() {
    if container_running; then
        $RUNTIME stop "$CONTAINER_NAME"
        log_ok "容器已停止"
    else
        log_warn "容器未在运行"
    fi
}

# ============================================
# 命令：查看日志
# ============================================
cmd_logs() {
    if container_running; then
        log_info "Vite 开发服务器日志:"
        container_exec "cat /tmp/vite.log 2>/dev/null || echo '暂无日志'"
    else
        log_warn "容器未运行"
    fi
}

# ============================================
# 命令：进入容器终端
# ============================================
cmd_shell() {
    if container_running; then
        log_info "进入容器终端 (输入 exit 退出)..."
        $RUNTIME exec -it "$CONTAINER_NAME" sh
    else
        log_err "容器未运行"
    fi
}

# ============================================
# 命令：查看状态
# ============================================
cmd_status() {
    echo ""
    echo "========================================="
    echo "  Game Portal - Docker 状态"
    echo "========================================="
    echo ""

    if container_exists; then
        $RUNTIME inspect "$CONTAINER_NAME" --format '
容器: {{.Name}}
状态: {{.State.Status}}
镜像: {{.Config.Image}}
端口: {{range $p, $conf := .NetworkSettings.Ports}}{{$p}} → {{(index $conf 0).HostPort}} {{end}}
创建: {{.Created}}
' 2>/dev/null || echo "容器 $CONTAINER_NAME 存在"
    else
        echo "容器 $CONTAINER_NAME 不存在"
    fi

    echo ""
}

# ============================================
# 命令：完整流程（默认）
# ============================================
cmd_full() {
    echo ""
    echo "========================================="
    echo "  Game Portal - Docker 构建启动"
    echo "========================================="
    echo ""

    # 1. 创建容器
    cmd_create

    echo ""

    # 2. 安装依赖
    cmd_install

    echo ""

    # 3. 编译构建
    cmd_build

    echo ""

    # 4. 启动开发服务
    cmd_start

    echo ""
    echo "========================================="
    echo "  ✅ 全部完成！"
    echo "  🎮 访问 http://localhost:${PORT}"
    echo "========================================="
    echo ""
    echo "常用命令:"
    echo "  ./deploy-docker.sh logs     # 查看日志"
    echo "  ./deploy-docker.sh stop     # 停止容器"
    echo "  ./deploy-docker.sh shell    # 进入容器"
    echo "  ./deploy-docker.sh start    # 重启开发服务"
    echo ""
}

# ============================================
# 主入口
# ============================================
case "${1:-}" in
    create)  cmd_create  ;;
    install) cmd_install ;;
    build)   cmd_build   ;;
    start)   cmd_start   ;;
    stop)    cmd_stop    ;;
    logs)    cmd_logs    ;;
    shell)   cmd_shell   ;;
    status)  cmd_status  ;;
    *)
        cmd_full
        ;;
esac
