# 🎮 Game Portal

一个纯前端的迷你游戏门户，采用暗色霓虹主题设计，像素风字体，支持响应式布局。当前包含俄罗斯方块、贪吃蛇、推箱子三款经典 Canvas 游戏，并规划扩展至 23 款。

[**English**](./README.en.md)

---

## ✨ 特性

- 🎮 三款经典游戏：俄罗斯方块、贪吃蛇、推箱子
- 🏆 游戏记录 & 高分榜（localStorage 持久化）
- 🎨 暗色霓虹主题，像素风字体（Press Start 2P）
- 📱 响应式设计，支持桌面和移动端
- ⚡ Canvas 渲染，统一引擎抽象层
- 🧪 156 个测试用例，100% 通过率
- 🐳 Docker 多阶段构建（最终镜像约 25MB）

## 🛠 技术栈

| 层级 | 技术 |
|------|------|
| 前端框架 | React 18 + TypeScript 5 |
| 构建工具 | Vite 5 |
| 样式方案 | Tailwind CSS 3 |
| 游戏渲染 | Canvas API |
| 路由 | react-router-dom v6 |
| 测试 | Vitest + @testing-library/react |
| 容器化 | Docker + Nginx（多阶段构建） |
| 部署 | Vercel / Docker |

## 🚀 快速开始

```bash
# 安装依赖
npm install

# 开发模式（http://localhost:3000）
npm run dev

# 构建
npm run build

# 预览构建产物
npm run preview

# 运行测试（156 用例）
npm test

# 测试覆盖率
npm run test:coverage
```

### Docker 部署

```bash
# 一键部署
./deploy-docker.sh

# 或手动构建
docker build -t game-portal .
docker run -p 8080:80 game-portal

# docker-compose（生产模式）
docker compose up -d

# docker-compose（开发热更新模式）
docker compose --profile dev up
```

## 📁 项目结构

```
game-portal/
├── src/
│   ├── core/               # GameEngine 抽象基类
│   ├── games/              # 游戏引擎实现
│   │   ├── tetris/         # 俄罗斯方块
│   │   ├── snake/          # 贪吃蛇
│   │   └── sokoban/        # 推箱子
│   ├── components/         # React 组件
│   │   ├── GameContainer   # 游戏容器（Canvas + HUD + Overlay）
│   │   ├── GameCard        # 游戏卡片
│   │   ├── ScoreBoard      # 排行榜
│   │   └── Header          # 导航栏
│   ├── pages/              # 页面
│   │   ├── HomePage        # 首页（游戏列表）
│   │   └── GamePage        # 游戏页（动态加载）
│   ├── services/           # 数据服务（localStorage）
│   ├── types/              # TypeScript 类型定义
│   └── __tests__/          # 测试文件（6 文件 156 用例）
├── Dockerfile              # 多阶段构建（Node 20 + Nginx）
├── docker-compose.yml      # 生产 + 开发双模式
├── nginx.conf              # Gzip + SPA 回退 + 安全头
├── deploy-docker.sh        # 一键部署脚本
├── GAME-EXPANSION-PLAN.md  # 游戏扩展开发计划（中文）
└── DEPLOY.md               # 部署指南
```

## 🎯 游戏引擎架构

所有游戏引擎继承自 `GameEngine` 抽象基类，实现统一的生命周期和事件系统：

```
GameEngine (abstract)
├── 生命周期：init → start → pause → resume → gameover
├── 事件系统：on / off / emit（stateChange, scoreChange, levelChange）
└── 7 个抽象方法：onInit, onStart, update, onRender, handleKeyDown, handleKeyUp, getState
```

### 已实现游戏

| 游戏 | 引擎 | 测试用例 |
|------|------|---------|
| 🟦 俄罗斯方块 | TetrisEngine | 53 |
| 🐍 贪吃蛇 | SnakeEngine | 29 |
| 📦 推箱子 | SokobanEngine | 41 |

### 测试覆盖

| 测试文件 | 用例数 | 覆盖范围 |
|---------|--------|---------|
| tetris.test.ts | 53 | 初始化、方块生成、旋转、碰撞、行消除、计分、等级、游戏结束 |
| snake.test.ts | 29 | 初始化、移动、转向、食物、碰撞、速度、边界 |
| sokoban.test.ts | 41 | 初始化、移动、推箱、胜利判定、撤销、关卡、事件 |
| game-container.test.tsx | 6 | Engine 绑定、生命周期、事件传递 |
| storage.test.ts | 21 | 5 个子服务 + GAME_META |
| routing.test.tsx | 6 | 首页渲染、游戏页导航、404 处理 |
| **合计** | **156** | — |

## 🗺 扩展计划

规划 v2.0 → v5.0 四批次迭代，新增 20 款游戏（扫雷、2048、Flappy Bird、五子棋、跑酷恐龙、打砖块、吃豆人等），引入 GameRegistry 注册机制实现游戏热插拔。

详见 → [GAME-EXPANSION-PLAN.md](./GAME-EXPANSION-PLAN.md)

## 📄 文档

| 文档 | 说明 |
|------|------|
| [README.md](./README.md) | 项目说明（中文） |
| [README.en.md](./README.en.md) | Project README (English) |
| [GAME-EXPANSION-PLAN.md](./GAME-EXPANSION-PLAN.md) | 游戏扩展开发计划（中文） |
| [GAME-EXPANSION-PLAN.en.md](./GAME-EXPANSION-PLAN.en.md) | Game Expansion Plan (English) |
| [DEPLOY.md](./DEPLOY.md) | 部署指南 |

## 📝 License

MIT
