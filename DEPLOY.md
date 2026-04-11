# 🚀 Game Portal — 部署指南

## 前置条件

- Node.js >= 18
- npm >= 9

## 本地构建

```bash
cd game-portal
npm install
npm run build
```

构建产物输出到 `dist/` 目录。

## 本地开发

```bash
npm run dev
# 访问 http://localhost:3000
```

## 构建验证

```bash
npm run preview
# 访问 http://localhost:4173
```

## Vercel 部署

### 方式 A：CLI 部署

```bash
npm i -g vercel
vercel --prod
```

### 方式 B：GitHub 导入

1. 推送代码到 GitHub
2. 登录 [Vercel Dashboard](https://vercel.com/dashboard)
3. 点击 "Import Project"
4. 选择 GitHub 仓库
5. Framework Preset 选择 **Vite**
6. 点击 **Deploy**

## 常见构建问题排查

| 错误 | 原因 | 解决方案 |
|------|------|---------|
| TypeScript 编译错误 | 类型不匹配 | 检查 tsconfig.json strict 模式 |
| Tailwind 类名不生效 | 配置路径不匹配 | 检查 tailwind.config.js content 配置 |
| 路由 404 | SPA 路由未配置 | 确认 public/vercel.json rewrites 配置 |
| Canvas 不渲染 | DOM 未就绪 | 检查 useEffect 依赖数组 |
| 字体加载失败 | Google Fonts 被墙 | 使用本地字体文件或 CDN 镜像 |

## Docker 部署

### 前置条件

- Docker >= 20

### 一键脚本（推荐）

```bash
# 完整流程：创建容器 → 安装依赖 → 编译 → 启动开发服务
chmod +x deploy-docker.sh
./deploy-docker.sh

# 单独执行各步骤
./deploy-docker.sh build     # 仅编译构建
./deploy-docker.sh start     # 仅启动开发服务
./deploy-docker.sh stop      # 停止容器
./deploy-docker.sh logs      # 查看 Vite 日志
./deploy-docker.sh shell     # 进入容器终端
./deploy-docker.sh status    # 查看运行状态
```

### 手动 Docker 命令

```bash
# 方式 1：生产模式（Nginx 托管）
docker build -t game-portal:latest .
docker run -d --name game-portal -p 3000:80 game-portal:latest

# 方式 2：开发模式（Vite Dev Server + 热更新）
docker build -f Dockerfile.dev -t game-portal:dev .
docker run -d --name game-portal-dev -p 3000:3000 \
  -v $(pwd)/src:/app/src \
  -v $(pwd)/index.html:/app/index.html \
  game-portal:dev

# 方式 3：编译并提取产物
docker build -f Dockerfile.dev -t game-portal:dev .
docker run --rm -v $(pwd)/dist:/app/dist game-portal:dev sh -c "npm run build"
```

### Docker Compose

```bash
# 生产模式
docker compose up -d

# 开发模式
docker compose --profile dev up -d game-portal-dev
```

## SPA 路由配置

项目已包含 `public/vercel.json`，配置了 SPA 路由 rewrites，确保所有路径都指向 `index.html`。
