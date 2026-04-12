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

### 方式 C：DeerFlow Skill 部署（已验证 ✅）

v2.0 已通过 DeerFlow Vercel Deploy Skill 成功部署。

**部署记录**：

| 项目 | 详情 |
|------|------|
| 版本 | v2.0 Batch 1（8 款游戏） |
| 部署时间 | 2026-04-12 |
| Preview URL | https://skill-deploy-u7xvhb5l1p-agent-skill-vercel.vercel.app |
| Claim URL | https://vercel.com/claim-deployment?code=2dea1012-1232-4078-95c6-ea953efee223 |
| Deployment ID | `dpl_HeL2oZ5yYiQHJZoKwhc9jtFVQ6N2` |
| Project ID | `prj_DGyyxvOwG28Xomo3y4UtwVRk9JnR` |
| Framework | Vite (React + TypeScript) |
| 构建产物 | index.html (0.65 kB) + CSS (21.77 kB) + JS (240.57 kB) |

**部署步骤**：
```bash
# 1. 构建项目
npm run build

# 2. 使用 deploy skill 脚本部署
bash /mnt/skills/public/vercel-deploy-claimable/scripts/deploy.sh /path/to/game-portal

# 3. 访问返回的 Preview URL 验证
# 4. 使用 Claim URL 将部署关联到 Vercel 账号
```

**注意事项**：
- 免费版 Vercel 有部署频率限制（3 次/小时），超出需等待重置
- Claim URL 用于将匿名部署关联到 Vercel 账号，关联后可在 Dashboard 管理
- 部署前确保 `npm run build` 成功且 `dist/` 目录存在

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
