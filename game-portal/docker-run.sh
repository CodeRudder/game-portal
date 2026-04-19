#!/bin/bash
# ============================================
# Game Portal - Docker 运行环境一键脚本
# ============================================
set -e

IMAGE_NAME="game-portal"
DEV_CONTAINER="game-portal-dev"
SERVE_CONTAINER="game-portal"
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

info()  { echo -e "${CYAN}[INFO]${NC} $1"; }
ok()    { echo -e "${GREEN}[OK]${NC} $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
err()   { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

build_dev_image() {
    info "Building dev image ${IMAGE_NAME}:dev ..."
    docker build -f Dockerfile.dev -t ${IMAGE_NAME}:dev "${PROJECT_DIR}"
    ok "Dev image built"
}

build_prod_image() {
    info "Building prod image ${IMAGE_NAME}:latest ..."
    docker build -f Dockerfile -t ${IMAGE_NAME}:latest "${PROJECT_DIR}"
    ok "Prod image built"
}

do_build() {
    info "Compiling project in Docker..."
    build_dev_image
    docker run --rm \
        -v "${PROJECT_DIR}/dist:/app/dist" \
        ${IMAGE_NAME}:dev \
        sh -c "npm run build && echo '--- BUILD SUCCESS ---'"
    if [ -d "${PROJECT_DIR}/dist" ]; then
        ok "Build success! Output in dist/"
        ls -la "${PROJECT_DIR}/dist/"
    else
        err "Build failed, dist/ not found"
    fi
}

do_dev() {
    docker rm -f ${DEV_CONTAINER} 2>/dev/null || true
    build_dev_image
    info "Starting dev server..."
    docker run -d \
        --name ${DEV_CONTAINER} \
        -p 3000:3000 \
        -v "${PROJECT_DIR}/src:/app/src" \
        -v "${PROJECT_DIR}/index.html:/app/index.html" \
        -v "${PROJECT_DIR}/tailwind.config.js:/app/tailwind.config.js" \
        -v "${PROJECT_DIR}/postcss.config.js:/app/postcss.config.js" \
        -v "${PROJECT_DIR}/vite.config.ts:/app/vite.config.ts" \
        ${IMAGE_NAME}:dev
    sleep 3
    ok "Dev server started!"
    ok "Visit http://localhost:3000"
    echo ""
    docker logs ${DEV_CONTAINER} 2>&1 | tail -20
}

do_serve() {
    docker rm -f ${SERVE_CONTAINER} 2>/dev/null || true
    build_prod_image
    docker run -d \
        --name ${SERVE_CONTAINER} \
        -p 3000:80 \
        --restart unless-stopped \
        ${IMAGE_NAME}:latest
    sleep 2
    ok "Production server started!"
    ok "Visit http://localhost:3000"
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ 2>/dev/null || echo "000")
    if [ "$HTTP_CODE" = "200" ]; then
        ok "HTTP status: ${HTTP_CODE}"
    else
        warn "HTTP status: ${HTTP_CODE} (may still be starting)"
    fi
}

do_shell() {
    if docker ps --format '{{.Names}}' | grep -q "^${DEV_CONTAINER}$"; then
        docker exec -it ${DEV_CONTAINER} sh
    elif docker ps --format '{{.Names}}' | grep -q "^${SERVE_CONTAINER}$"; then
        docker exec -it ${SERVE_CONTAINER} sh
    else
        docker run --rm -it -v "${PROJECT_DIR}:/app" -w /app ${IMAGE_NAME}:dev sh
    fi
}

do_exec() {
    local cmd="${@:-sh}"
    if docker ps --format '{{.Names}}' | grep -q "^${DEV_CONTAINER}$"; then
        info "Executing in ${DEV_CONTAINER}: $cmd"
        docker exec ${DEV_CONTAINER} sh -c "$cmd"
    else
        info "No running container, creating temp..."
        build_dev_image
        docker run --rm -v "${PROJECT_DIR}:/app" -w /app ${IMAGE_NAME}:dev sh -c "$cmd"
    fi
}

do_stop() {
    docker rm -f ${DEV_CONTAINER} 2>/dev/null && ok "Dev container stopped" || true
    docker rm -f ${SERVE_CONTAINER} 2>/dev/null && ok "Prod container stopped" || true
}

do_logs() {
    if docker ps --format '{{.Names}}' | grep -q "^${DEV_CONTAINER}$"; then
        docker logs -f ${DEV_CONTAINER}
    elif docker ps --format '{{.Names}}' | grep -q "^${SERVE_CONTAINER}$"; then
        docker logs -f ${SERVE_CONTAINER}
    else
        err "No running containers"
    fi
}

case "${1:-}" in
    build) do_build ;;
    dev)   do_dev ;;
    serve) do_serve ;;
    shell) do_shell ;;
    exec)  shift; do_exec "$@" ;;
    stop)  do_stop ;;
    logs)  do_logs ;;
    *)
        echo "Game Portal - Docker Runner"
        echo ""
        echo "Usage: $0 <command>"
        echo ""
        echo "Commands:"
        echo "  build       Build image + compile project (output to dist/)"
        echo "  dev         Start dev server with HMR (port 3000)"
        echo "  serve       Start production server with Nginx (port 3000)"
        echo "  exec <cmd>  Execute command in running container"
        echo "  shell       Open shell in container"
        echo "  stop        Stop all containers"
        echo "  logs        Follow container logs"
        echo ""
        echo "Quick start:"
        echo "  $0 build    # Compile first"
        echo "  $0 dev      # Then start dev server"
        echo "  $0 serve    # Or start production server"
        ;;
esac
