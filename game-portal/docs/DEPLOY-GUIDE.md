# Game Portal 发布注意事项文档

> **项目**: Game Portal — React + TypeScript + Vite + Tailwind CSS  
> **规模**: 88 个游戏，182,000+ 行代码  
> **部署**: Vercel 自动部署，绑定 GitHub 仓库 `CodeRudder/game-portal`  
> **包管理器**: pnpm

---

## 目录

1. [发布前检查清单](#发布前检查清单)
2. [Vercel 部署注意事项](#vercel-部署注意事项)
3. [常见 TypeScript 构建错误及修复](#常见-typescript-构建错误及修复)
4. [本地与 Vercel 环境差异](#本地与-vercel-环境差异)
5. [Git 提交规范](#git-提交规范)
6. [快速操作指南](#快速操作指南)

---

## 发布前检查清单

每次发布前，逐项确认以下内容：

### 构建验证

- [ ] `pnpm run build` 本地通过（**必须用 pnpm**，和 Vercel 保持一致）
- [ ] `npx tsc --noEmit` 零 TypeScript 错误
- [ ] `pnpm run test` 全量测试通过
- [ ] `pnpm run build:prod` 完整生产构建通过（含测试 + 类型检查 + 构建）

### 游戏集成检查

添加新游戏时，确认以下 **6 个位置** 均已正确集成：

- [ ] **`src/types/`** — GameType 枚举中添加新游戏类型
- [ ] **`src/types/`** — GameCard 接口中如需新字段，确保类型正确
- [ ] **`src/services/StorageService.ts`** — GAME_META 中添加新游戏的元数据
- [ ] **`src/components/GameContainer.tsx`** — 游戏加载映射中添加新游戏组件
- [ ] **`src/pages/GamePage.tsx`** — VALID_TYPES 集合中添加新游戏类型
- [ ] **`src/pages/HomePage.tsx`** — 游戏列表中展示新游戏卡片

### 数据完整性

- [ ] 确认没有**重复的 GAME_META 条目**（StorageService.ts 中同一个 GameType 不能出现两次）
- [ ] 确认 GamePage.tsx 的 **VALID_TYPES 覆盖所有游戏**（遗漏会导致路由 404）
- [ ] 确认所有 GameType 枚举值在 GAME_META 中都有对应条目

### 一键验证

```bash
# 快速验证（推荐）
./build.sh prod

# 或手动逐步验证
pnpm install
pnpm exec tsc --noEmit
pnpm run test
pnpm run build
```

---

## Vercel 部署注意事项

### 基本配置

| 配置项 | 值 |
|--------|-----|
| **Framework** | Vite（自动检测） |
| **构建命令** | `pnpm run build`（即 `tsc && vite build`） |
| **输出目录** | `dist` |
| **包管理器** | pnpm（通过 `pnpm-lock.yaml` 自动检测） |
| **Node.js 版本** | 18.x（可在 Vercel 设置中调整） |

### 关键要点

1. **Vercel 使用 pnpm**：Vercel 检测到 `pnpm-lock.yaml` 后自动使用 pnpm 安装依赖。本地必须也用 pnpm 验证，避免环境差异导致构建失败。

2. **TypeScript 严格模式**：项目启用了 TypeScript 严格模式。`tsc` 作为构建第一步，**所有类型错误都会导致构建失败**。Vercel 不会跳过类型检查。

3. **构建流程**：`pnpm run build` = `tsc && vite build`
   - 先执行 `tsc` 进行完整类型检查
   - 类型检查通过后才执行 `vite build`
   - 任何一步失败都会终止构建

4. **部署触发**：每次推送到 GitHub 仓库的 main 分支，Vercel 自动触发部署。

### 常见构建失败原因

| 原因 | 症状 | 解决方案 |
|------|------|----------|
| TypeScript 类型错误 | `tsc` 阶段失败 | 本地运行 `tsc --noEmit` 修复 |
| 依赖版本不一致 | `pnpm install` 失败 | 删除 `node_modules`，重新 `pnpm install` |
| pnpm 版本不匹配 | lockfile 警告/错误 | 查看 `pnpm-lock.yaml` 头部的版本号 |
| 内存不足 | 构建过程 OOM | 检查是否有超大文件或循环依赖 |
| esbuild 构建脚本被忽略 | 依赖安装后构建失败 | 运行 `pnpm approve-builds` |

---

## 常见 TypeScript 构建错误及修复

### 1. State 接口缺少索引签名

**错误信息**：
```
Element implicitly has an 'any' type because expression of type 'string' can't be used to index type 'State'.
```

**原因**：动态访问 State 对象属性时，TypeScript 无法推断 key 的类型。

**修复**：在 State 接口中添加索引签名
```typescript
// ❌ 错误
interface State {
  board: string[];
  currentPlayer: string;
}

// ✅ 修复
interface State {
  [key: string]: unknown;
  board: string[];
  currentPlayer: string;
}
```

---

### 2. 类型缩窄错误（TS2367）

**错误信息**：
```
error TS2367: This condition will always return 'false' since the types have no overlap.
```

**原因**：TypeScript 认为两个类型永远不可能相等，通常发生在从联合类型中提取值时。

**修复**：使用类型断言
```typescript
// ❌ 错误
if (gameType === 'tic-tac-toe') { ... }

// ✅ 修复
if ((gameType as string) === 'tic-tac-toe') { ... }
```

---

### 3. StorageService 重复属性（TS1117）

**错误信息**：
```
error TS1117: An object literal cannot have multiple properties with the same name.
```

**原因**：GAME_META 对象中存在重复的 GameType key，通常是在添加新游戏时不小心重复添加。

**修复**：检查并删除重复条目
```typescript
// ❌ 错误 — tic-tac-toe 出现了两次
export const GAME_META: Record<GameType, GameMeta> = {
  'tic-tac-toe': { ... },
  'sudoku': { ... },
  'tic-tac-toe': { ... },  // ← 重复！
};

// ✅ 修复 — 每个游戏只出现一次
export const GAME_META: Record<GameType, GameMeta> = {
  'tic-tac-toe': { ... },
  'sudoku': { ... },
};
```

**快速检测**：
```bash
# 检查 StorageService.ts 中是否有重复 key
grep -o "'[a-z-]*':" src/services/StorageService.ts | sort | uniq -d
```

---

### 4. StorageService 缺少属性（TS2741）

**错误信息**：
```
error TS2741: Property 'game-name' is missing in type ... but required in type 'Record<GameType, GameMeta>'.
```

**原因**：GameType 枚举中新增了游戏类型，但 GAME_META 中没有添加对应的元数据。

**修复**：补全所有 GameType 对应的 GAME_META 条目
```typescript
// 1. 先确认 GameType 枚举中有哪些游戏
export type GameType = 
  | 'tic-tac-toe'
  | 'sudoku'
  | 'new-game';  // ← 新增的游戏

// 2. 在 GAME_META 中补全
export const GAME_META: Record<GameType, GameMeta> = {
  'tic-tac-toe': { ... },
  'sudoku': { ... },
  'new-game': {    // ← 必须补全
    name: '新游戏',
    description: '游戏描述',
    category: 'puzzle',
    // ...
  },
};
```

---

## 本地与 Vercel 环境差异

### 包管理器差异

| 场景 | 本地 | Vercel | 风险 |
|------|------|--------|------|
| 使用 npm | `npm install` | pnpm（自动检测） | ⚠️ **依赖树可能不同** |
| 使用 pnpm | `pnpm install` | pnpm | ✅ 一致 |

**最佳实践**：本地开发始终使用 `pnpm`，确保与 Vercel 环境一致。

```bash
# 检查本地是否使用 pnpm
ls pnpm-lock.yaml  # 应该存在

# 安装依赖
pnpm install

# 不要使用 npm
# rm package-lock.json  # 如果存在，可以删除
```

### pnpm 版本差异

Vercel 使用的 pnpm 版本可能与本地不同。查看 lockfile 要求的版本：

```bash
head -5 pnpm-lock.yaml
# 输出示例:
# lockfileVersion: '6.0'
# settings:
#   autoInstallPeers: true
#   excludeLinksFromLockfile: false
```

如果版本不匹配，可以指定：
```bash
# 使用 corepack 管理 pnpm 版本
corepack enable
corepack prepare pnpm@<version> --activate
```

### esbuild 构建脚本

某些依赖（如 `esbuild`）需要在安装后运行构建脚本。Vercel 默认可能跳过这些脚本。

```bash
# 如果遇到 esbuild 相关错误，运行：
pnpm approve-builds

# 或在 Vercel 设置中确保构建脚本不被跳过
```

### Node.js 版本

在项目根目录创建 `.nvmrc` 或 `.node-version` 文件来统一 Node.js 版本：

```bash
# .nvmrc
18
```

---

## Git 提交规范

### Commit Message 格式

```
<type>(<scope>): <description>

[可选的详细说明]

[可选的 Breaking Changes]
```

### Type 类型

| Type | 说明 | 示例 |
|------|------|------|
| `feat` | 新功能 | `feat(game): 添加 2048 游戏` |
| `fix` | 修复 Bug | `fix(storage): 修复游戏分数保存失败` |
| `docs` | 文档更新 | `docs: 更新部署指南` |
| `style` | 代码格式（不影响逻辑） | `style: 统一缩进为 2 空格` |
| `refactor` | 重构（不改变功能） | `refactor(engine): 抽取公共游戏逻辑` |
| `test` | 测试相关 | `test(tictactoe): 添加胜负判断测试` |
| `chore` | 构建/工具/杂项 | `chore: 升级 vite 到 5.1` |
| `perf` | 性能优化 | `perf(home): 懒加载游戏组件` |

### Scope 范围

常用 scope：
- `game` — 新增/修改游戏
- `engine` — 游戏引擎
- `storage` — 存储服务
- `ui` — UI 组件
- `build` — 构建配置
- `deploy` — 部署相关

### 示例

```bash
# 新增游戏
git commit -m "feat(game): 添加扫雷游戏"

# 修复 Bug
git commit -m "fix(storage): 修复 GAME_META 重复 key 导致构建失败"

# 文档更新
git commit -m "docs: 添加发布注意事项文档"

# 多行提交信息
git commit -m "feat(game): 添加数独游戏

- 实现 9x9 数独生成算法
- 添加难度选择（简单/中等/困难）
- 集成到游戏门户路由和导航"
```

---

## 快速操作指南

### 日常开发流程

```bash
# 1. 启动开发服务器
pnpm dev

# 2. 开发过程中类型检查
pnpm run lint

# 3. 运行测试
pnpm run test

# 4. 构建验证
pnpm run build
```

### 发布流程

```bash
# 方式一：使用发布脚本（推荐）
./deploy.sh "feat(game): 添加新游戏"

# 方式二：手动发布
./build.sh prod          # 完整构建检查
git add -A
git commit -m "feat(game): 添加新游戏"
git push origin main
```

### 紧急修复

```bash
# 快速修复并发布
pnpm exec tsc --noEmit   # 快速类型检查
pnpm run build            # 构建
git add -A
git commit -m "fix: 紧急修复 xxx"
git push origin main
```

### 回滚部署

```bash
# 查看 Vercel 部署历史
# https://vercel.com/dashboard → 选择项目 → Deployments

# Git 回滚
git revert HEAD
git push origin main
```

---

## 脚本说明

### build.sh — 一键构建脚本

```bash
./build.sh          # 标准构建（依赖 + tsc + vite build）
./build.sh dev      # 开发构建（仅 vite build）
./build.sh prod     # 完整生产构建（依赖 + tsc + 测试 + vite build）
./build.sh check    # 仅类型检查
./build.sh test     # 仅运行测试
```

### deploy.sh — 一键发布脚本

```bash
./deploy.sh                          # 交互式输入 commit message
./deploy.sh "feat(game): 添加新游戏"  # 直接指定 commit message
```

### package.json scripts

```bash
pnpm run dev            # 启动开发服务器
pnpm run build          # 标准构建（tsc + vite build）
pnpm run build:check    # 类型检查 + 构建
pnpm run build:prod     # 完整生产构建（测试 + 类型检查 + 构建）
pnpm run predeploy      # 构建前类型检查
pnpm run lint           # 基本代码检查（tsc --noEmit）
pnpm run test           # 运行测试
pnpm run test:watch     # 监听模式运行测试
pnpm run test:coverage  # 运行测试并生成覆盖率报告
```
