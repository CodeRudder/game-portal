# Game Portal — 构建与验证阶段计划

> 生成时间：2026-04-11
> 项目路径：`/mnt/user-data/workspace/game-portal/`
> 技术栈：React 18 + TypeScript 5 + Vite 5 + Tailwind CSS 3 + Canvas API

---

## 一、当前状态

### 已完成 ✅
- 核心引擎：TetrisEngine / SnakeEngine / SokobanEngine（均实现 7 个抽象方法）
- React 组件：GameContainer / GameCard / ScoreBoard / Header
- 页面路由：HomePage（`/`）+ GamePage（`/game/:gameType`），react-router-dom v6
- 服务层：StorageService（RecordService / HighScoreService / FavoriteService / CommentService）
- 样式系统：Tailwind 自定义暗色霓虹主题 + 像素字体（Press Start 2P）
- Bug 修复：font-pixel→font-game、SokobanEngine stateChange emit、GameStatus gameOver→gameover
- 静态分析：import 链完整、类型一致、抽象方法覆盖

### 待完成 🔲
- 清理 7 个 orphan 文件
- 创建 `.gitignore` + `README.md`
- 本地构建验证（npm install && npm run build）
- 编写自动化测试脚本
- Vercel 部署

---

## 二、子任务拆分

### Batch 1：清理 + 构建（3 个并行）

| 编号 | 任务 | Agent | 预计耗时 | 产出物 |
|------|------|-------|---------|--------|
| T1 | 删除 7 个 orphan 文件 + 创建 `.gitignore` | developer | 2min | 清理后的项目 + `.gitignore` |
| T2 | 创建 `README.md` | developer | 2min | `README.md` |
| T3 | 创建 `DEPLOY.md` + `public/vercel.json` | devops | 2min | `DEPLOY.md` + `vercel.json` |

**Orphan 文件清单（T1 删除）：**
1. `src/components/GameList.tsx`
2. `src/games/config.ts`
3. `src/games/tetris/constants.ts`
4. `src/games/snake/constants.ts`
5. `src/contexts/AppProviders.tsx`
6. `src/contexts/GameContext.tsx`
7. `src/contexts/UserContext.tsx`

**T1 .gitignore 内容：** node_modules、dist、.env、IDE、OS、日志、coverage

**T2 README.md 结构：** 项目介绍 → 功能列表 → 技术栈 → 快速开始 → 目录结构 → 引擎架构 → License

**T3 DEPLOY.md 内容：** 前置条件 → 本地构建 → 开发模式 → 预览验证 → Vercel 部署（CLI/GitHub） → 常见问题排查

**T3 vercel.json：** SPA 路由 rewrites 配置 `{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }`

> ⏸ **Batch 1 完成后暂停，等待用户本地执行构建：**
> ```bash
> cd game-portal && npm install && npm run build
> ```
> 如有报错，贴回错误信息修复后重新构建，直到构建成功。

---

### Batch 2：游戏引擎测试脚本（3 个并行）

| 编号 | 任务 | Agent | 预计耗时 | 产出物 |
|------|------|-------|---------|--------|
| T4 | TetrisEngine 测试脚本 | tester | 5min | `src/__tests__/tetris.test.ts` |
| T5 | SnakeEngine 测试脚本 | tester | 5min | `src/__tests__/snake.test.ts` |
| T6 | SokobanEngine 测试脚本 | tester | 5min | `src/__tests__/sokoban.test.ts` |

**测试框架：** Vitest（与 Vite 原生集成，零配置）

**T4 TetrisEngine 测试用例：**
- 初始化：引擎创建后状态为 idle，Canvas 尺寸正确（10×20 格）
- 方块生成：能生成 7 种标准方块（I/O/T/S/Z/J/L）
- 旋转：方块旋转后形状正确，碰墙/碰底不旋转
- 碰撞检测：方块触底停止、不能穿墙、不能重叠
- 行消除：满行消除、多行同时消除、消除后上方下落
- 计分：单行/双行/三行/四行分数递增
- 等级提升：分数达到阈值后 level++
- gameOver：方块堆到顶部触发 gameover 状态

**T5 SnakeEngine 测试用例：**
- 初始化：蛇初始位置、方向、长度正确
- 移动：蛇按当前方向移动、身体跟随头部
- 转向：方向键改变方向、不能 180° 掉头
- 食物：吃到食物后蛇变长、分数增加、新食物生成
- 碰撞：撞墙 gameOver、撞自身 gameOver
- 速度：等级提升后 gameLoop 间隔缩短
- 边界：蛇不能移出网格范围

**T6 SokobanEngine 测试用例：**
- 初始化：加载第一关地图、玩家/箱子/目标位置正确
- 移动：玩家上下左右移动、不能穿墙
- 推箱：玩家推箱子移动、箱子不能推入墙壁、不能推两个箱子
- 胜利：所有箱子到达目标位置触发 win
- undo：撤销上一步操作、连续撤销多步
- 关卡切换：通关后加载下一关、最后一关通关后全部完成
- stateChange 事件：每次移动后触发 stateChange

---

### Batch 3：UI + 服务测试脚本（3 个并行）

| 编号 | 任务 | Agent | 预计耗时 | 产出物 |
|------|------|-------|---------|--------|
| T7 | GameContainer 集成测试 | tester | 5min | `src/__tests__/game-container.test.tsx` |
| T8 | StorageService 测试 | tester | 5min | `src/__tests__/storage.test.ts` |
| T9 | 路由 + 页面导航测试 | tester | 5min | `src/__tests__/routing.test.tsx` |

**T7 GameContainer 测试用例：**
- 引擎创建：根据 gameType 创建对应引擎（tetris/snake/sokoban）
- 生命周期：init → start → pause → resume → gameover 流程完整
- 状态显示：idle 显示开始按钮、playing 隐藏 overlay、paused 显示暂停、gameover 显示结束
- HUD 数据绑定：score/level/moves 与引擎事件同步
- 记录保存：gameOver 时调用 RecordService.add 和 HighScoreService.update
- Canvas 响应式：容器 resize 时 Canvas 跟随调整

**T8 StorageService 测试用例：**
- RecordService.add：添加记录后自动生成 id 和 date
- RecordService.getByGame：按游戏类型查询、按日期倒序
- HighScoreService.update：新高分返回 true、非高分返回 false
- HighScoreService.get：返回当前最高分、无数据返回 0
- GAME_META：包含 tetris/snake/sokoban 三个游戏的完整元数据
- 序列化：localStorage 读写正确序列化/反序列化
- 边界情况：空数据查询、重复写入、大量数据性能

**T9 路由测试用例：**
- 首页路由：`/` 渲染 HomePage
- 游戏页路由：`/game/tetris` 渲染 GamePage + TetrisEngine
- 游戏页路由：`/game/snake` 渲染 GamePage + SnakeEngine
- 游戏页路由：`/game/sokoban` 渲染 GamePage + SokobanEngine
- 无效路由：`/game/unknown` 显示无效提示或重定向
- 导航链接：首页游戏卡片点击跳转到对应游戏页

---

### Batch 4：执行测试 + 部署（顺序执行）

| 编号 | 任务 | Agent | 预计耗时 | 说明 |
|------|------|-------|---------|------|
| T10 | 用户本地执行测试 | — | 3min | `npm test`，报错贴回修复 |
| T11 | Vercel 部署 | devops | 3min | `npx vercel --prod`，输出线上 URL |

---

## 三、依赖关系

```
Batch 1 (T1 T2 T3) ──并行──→ ⏸ 等待用户构建 ──→ 修复报错（如有）
                                                      │
                                                      ▼ 构建成功
Batch 2 (T4 T5 T6) ──并行──→ 3 个引擎测试脚本
                                                      │
                                                      ▼
Batch 3 (T7 T8 T9) ──并行──→ 3 个 UI/服务测试脚本
                                                      │
                                                      ▼
Batch 4 (T10) ──用户执行──→ npm test ──→ 修复失败用例（如有）
      │
      ▼ 全部通过
(T11) ──部署──→ Vercel 上线
```

---

## 四、测试环境配置

需要在 `package.json` 中添加测试依赖和脚本：

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  },
  "devDependencies": {
    "vitest": "^1.0.0",
    "@testing-library/react": "^14.0.0",
    "@testing-library/jest-dom": "^6.0.0",
    "jsdom": "^23.0.0"
  }
}
```

需要在项目根目录创建 `vitest.config.ts`：

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/__tests__/setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

需要在 `src/__tests__/setup.ts` 中配置：

```typescript
import '@testing-library/jest-dom';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock Canvas getContext
HTMLCanvasElement.prototype.getContext = jest.fn() as any;
```

---

## 五、执行约束

- **每批次最多 3 个 subagent 并行**
- **每个子任务 ≤ 5 分钟**
- **构建报错时不逐文件审查，只修复报错**
- **测试失败时只修复失败用例，不扩大范围**
- **用户本地执行 npm 命令，agent 不尝试执行**
