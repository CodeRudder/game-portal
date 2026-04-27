# 子系统可见范围限制方案 — 调研报告

> **日期**: 2025-07
> **状态**: 调研完成，待决策
> **背景**: 引擎单元测试 (L0) 有 419 处 `new XxxSystem()`；需防止 L1/L2 直接实例化子系统或引擎

---

## 1. 现状分析

### 1.1 测试层级定义

| 层级 | 位置 | 职责 | 应使用的入口 |
|------|------|------|-------------|
| **L0** 引擎单元测试 | `engine/*/__tests__/` | 单个子系统逻辑验证 | 允许 `new XxxSystem()` |
| **L1** 引擎集成测试 | `tests/integration/` | 多子系统协作验证 | `GameEventSimulator` |
| **L2** UI 组件测试 | `tests/acc/`, `tests/ui-*/` | UI + 引擎联调 | `GameEventSimulator` |

### 1.2 当前违规情况

```
# L1/L2 中直接 new 子系统
tests/acc/acc-10-shop-regression.test.tsx → new ShopSystem() ×2
tests/acc/acc-10-shop-regression.test.tsx → new ThreeKingdomsEngine() ×10

# L1/L2 中直接 import 子系统
tests/acc/acc-10-shop-regression.test.tsx → import { ShopSystem }
tests/acc/ACC-04-武将系统.test.tsx       → import { statsAtLevel } (子系统内部函数)
tests/acc/ACC-05-招贤馆.test.tsx         → import type { HeroRecruitSystem }
```

**规模**: 引擎共 **102 个** `*System.ts` 文件，L0 中有 **419 处** 直接实例化。L1/L2 违规量较小（约 15 处），但需要机制防止新增。

### 1.3 项目技术栈

- TypeScript 5.x + Vitest
- 引擎 barrel file: `engine/index.ts` 重导出所有子系统
- 测试基础设施: `GameEventSimulator` (封装 `ThreeKingdomsEngine`)
- Vitest 配置: `vitest.config.three-kingdoms.ts`，单进程 fork 模式

---

## 2. 方案分析

### 方案 1: TypeScript 访问修饰符 (@internal JSDoc + 自定义 lint 规则)

**原理**: 给子系统构造函数加 `@internal` 标记，配合自定义 TSLint/ESLint 规则，在 L1/L2 目录中禁止调用标记为 internal 的 API。

```
// BuildingSystem.ts
export class BuildingSystem implements ISubsystem {
  /** @internal */
  constructor() { ... }
}
```

**优点**: 标记贴近源码，语义清晰
**缺点**: TypeScript 不原生支持，必须配套 lint 规则才有约束力；需为 102 个子系统逐一标记
**结论**: ⚠️ 不推荐单独使用，可作为方案 3 的补充注解。

---

### 方案 2: Barrel File 策略

**原理**: `engine/index.ts` 是引擎的统一导出入口。通过控制 test-utils 的 barrel file，只导出 `GameEventSimulator`，不导出子系统类。

当前 `engine/index.ts` 已经重导出所有子系统（如 `export * from './hero'`），这是 L0 测试所需要的。关键在于 L1/L2 不应直接从 `engine/` 导入。

**优点**:
- 不需要修改引擎源码
- 配合方案 3（ESLint no-restricted-imports）效果最好

**缺点**:
- TypeScript 本身无法阻止 `import { ShopSystem } from '@/games/three-kingdoms/engine/shop/ShopSystem'` 绕过 barrel file
- 需要配合 lint 或 CI 才有约束力

**结论**: ✅ 作为防御层之一，但需配合 lint 规则。

---

### 方案 3: ESLint no-restricted-imports 规则 ⭐

**原理**: 在 ESLint 配置中使用 `no-restricted-imports` 规则，禁止 L1/L2 目录中的文件直接导入子系统或引擎类。

```js
// eslint.config.js
{
  files: [
    'src/games/three-kingdoms/tests/integration/**',
    'src/games/three-kingdoms/tests/acc/**',
    'src/games/three-kingdoms/tests/ui-*/**',
  ],
  rules: {
    'no-restricted-imports': ['error', {
      patterns: [
        // 禁止直接 import 子系统
        '@/games/three-kingdoms/engine/**/!index',
        // 禁止直接 import 引擎（应通过 GameEventSimulator）
        '@/games/three-kingdoms/engine/ThreeKingdomsEngine',
      ],
      // 允许白名单
      allow: [
        '@/games/three-kingdoms/engine',           // barrel file (types only)
        '@/games/three-kingdoms/test-utils/**',     // GameEventSimulator
        '@/games/three-kingdoms/shared/**',         // 共享类型
      ],
    }],
  },
}
```

**优点**:
- **实施成本最低**：纯配置变更，零代码修改
- **即时生效**：IDE 实时红线提示，CI 中报错
- **灵活可控**：通过 `allow` 白名单精确控制例外
- **可逐步收紧**：先 warning 后 error

**缺点**:
- 开发者可通过 `// eslint-disable-next-line` 绕过（但代码审查可捕获）
- 需要维护 patterns 列表

**结论**: ✅ **强烈推荐**，应作为核心方案。

---

### 方案 4: Vitest Setup 拦截

**原理**: 在 Vitest setup 文件中 monkey-patch 子系统构造函数，检测到非 L0 调用时抛出错误。

```ts
// setup.ts
const originalCtor = BuildingSystem.prototype.constructor;
BuildingSystem = new Proxy(BuildingSystem, {
  construct(target, args, newTarget) {
    const stack = new Error().stack;
    if (stack?.includes('tests/integration') || stack?.includes('tests/acc')) {
      throw new Error('L1/L2 测试禁止直接 new BuildingSystem，请使用 GameEventSimulator');
    }
    return Reflect.construct(target, args, newTarget);
  }
});
```

**优点**: 运行时强制，错误信息可自定义
**缺点**: Proxy 包装 102 个子系统影响性能，维护成本高，依赖 stack trace 字符串匹配
**结论**: ❌ 不推荐。成本高、维护难。

---

### 方案 5: 依赖注入容器

**原理**: 引入 DI 容器（如 tsyringe、inversify），子系统不再手动 new，而是通过容器解析。L1/L2 只能通过容器获取 `GameEventSimulator`，容器不向 L1/L2 注册子系统。

```
@injectable()
class BuildingSystem implements ISubsystem { ... }

// L0 测试
const container = createTestContainer();
const building = container.resolve(BuildingSystem);

// L1/L2 测试
const sim = container.resolve(GameEventSimulator);
// container.resolve(BuildingSystem) → Error: not registered
```

**优点**: 架构层面最优雅，子系统生命周期统一管理
**缺点**: 改动量巨大（102 子系统 + 419 处调用），引入新依赖，过度工程
**结论**: ⚠️ 长期可考虑，短期 ROI 太低。

---

### 方案 6: 目录结构约定 + CI 脚本

**原理**: 通过目录命名约定（如 `engine/_internal/`）+ CI 中的检查脚本，验证 L1/L2 不引用引擎内部。

```bash
#!/bin/bash
# scripts/check-test-imports.sh
VIOLATIONS=$(grep -rn \
  "from.*engine/[^i]" \
  src/games/three-kingdoms/tests/integration/ \
  src/games/three-kingdoms/tests/acc/ \
  2>/dev/null)
if [ -n "$VIOLATIONS" ]; then
  echo "❌ L1/L2 测试禁止直接导入引擎子系统"
  echo "$VIOLATIONS"
  exit 1
fi
```

**优点**: 零依赖，CI 中强制执行
**缺点**: 无 IDE 实时反馈，grep 模式容易误报，本质是方案 3 的粗糙版本
**结论**: ⚠️ 可作为 CI 最后一道防线。

---

## 3. 方案对比总结

| 维度 | 方案1 @internal | 方案2 Barrel | 方案3 ESLint ⭐ | 方案4 Vitest拦截 | 方案5 DI容器 | 方案6 CI脚本 |
|------|:---:|:---:|:---:|:---:|:---:|:---:|
| **实施成本** | 高 | 低 | **低** | 中 | 极高 | 低 |
| **约束力度** | 弱 | 弱 | **强** | 强 | 极强 | 中 |
| **IDE 支持** | ❌ | ❌ | **✅** | ❌ | ❌ | ❌ |
| **运行时开销** | 无 | 无 | **无** | 高 | 低 | 无 |
| **改动范围** | 102文件 | 1文件 | **1配置** | setup文件 | 全部 | 1脚本 |
| **可维护性** | 差 | 好 | **好** | 差 | 好 | 中 |
| **对L0影响** | 无 | 无 | **无** | 有 | 重写 | 无 |

---

## 4. 推荐方案

### 组合策略: **ESLint 为主 + Barrel File 为辅 + CI 兜底**

```
┌─────────────────────────────────────────────────────┐
│                    开发者写测试                        │
│                       │                              │
│            ┌──────────▼──────────┐                   │
│            │  ESLint 实时检查 ⭐  │ ← IDE 红线提示     │
│            │  no-restricted-     │   即时反馈         │
│            │  imports            │                    │
│            └──────────┬──────────┘                   │
│                       │ 通过                          │
│            ┌──────────▼──────────┐                   │
│            │  Barrel File 约束   │ ← test-utils 只   │
│            │  (防御层)           │   导出 Simulator   │
│            └──────────┬──────────┘                   │
│                       │                               │
│            ┌──────────▼──────────┐                   │
│            │  CI 检查脚本        │ ← 最后一道防线     │
│            │  (兜底)             │                    │
│            └──────────┬──────────┘                   │
│                       │                               │
│                   ✅ 测试通过                          │
└─────────────────────────────────────────────────────┘
```

**选择理由**:
1. **ESLint no-restricted-imports**: 实施成本最低（改一个配置文件），IDE 实时反馈，L0 测试零影响
2. **Barrel File**: 清理 `test-utils/index.ts`，确保只导出 `GameEventSimulator` 和 `createSim`
3. **CI 脚本**: 防止 `eslint-disable` 绕过，CI 中做最终检查

---

## 5. 实施步骤

### Step 1: 添加 ESLint 规则（30 分钟）

在 `eslint.config.js`（或对应配置文件）中添加 overrides：

```js
{
  files: [
    'src/games/three-kingdoms/tests/integration/**/*.test.*',
    'src/games/three-kingdoms/tests/acc/**/*.test.*',
    'src/games/three-kingdoms/tests/ui-*/**/*.test.*',
  ],
  rules: {
    'no-restricted-imports': ['error', {
      patterns: [{
        group: ['@/games/three-kingdoms/engine/**'],
        message: 'L1/L2 禁止直接导入引擎模块，请使用 GameEventSimulator',
      }],
      allowTypeImports: true, // 允许纯类型导入
    }],
  },
}
```

### Step 2: 修复现有违规（1 小时）

将 `tests/acc/acc-10-shop-regression.test.tsx` 中的直接调用改为通过 `GameEventSimulator`：

```diff
- import { ShopSystem } from '@/games/three-kingdoms/engine/shop/ShopSystem';
- const shop = new ShopSystem();
+ const sim = new GameEventSimulator();
+ // 通过 sim 访问 ShopSystem 功能
```

### Step 3: 添加 CI 检查脚本（15 分钟）

```bash
# scripts/check-test-visibility.sh
#!/bin/bash
set -e

VIOLATIONS=$(grep -rn \
  'from.*@/games/three-kingdoms/engine/' \
  src/games/three-kingdoms/tests/integration/ \
  src/games/three-kingdoms/tests/acc/ \
  src/games/three-kingdoms/tests/ui-*/ \
  --include='*.test.ts' --include='*.test.tsx' \
  | grep -v 'import type' \
  || true)

if [ -n "$VIOLATIONS" ]; then
  echo "❌ L1/L2 测试发现直接导入引擎模块:"
  echo "$VIOLATIONS"
  exit 1
fi
echo "✅ 测试层级导入检查通过"
```

在 CI pipeline 中加入此脚本。

---

## 6. 对现有测试的影响评估

| 影响范围 | 详情 | 工作量 |
|----------|------|--------|
| **L0 引擎单元测试** | ✅ **零影响**。ESLint 规则只针对 `tests/integration`、`tests/acc`、`tests/ui-*` 目录 | 0 |
| **L1 集成测试** (2 文件) | `scene-router.test.tsx` 已使用 `GameEventSimulator`，无需改动 | 0 |
| **L2 ACC 测试** (~10 文件) | `acc-10-shop-regression.test.tsx` 需重构 12 处直接 `new` 调用 | ~1h |
| **L2 UI 测试** | 当前未发现违规，无影响 | 0 |
| **GameEventSimulator** | 无需修改，已提供足够的 API | 0 |

**总结**: 实际需要修改的文件仅 **1 个**（`acc-10-shop-regression.test.tsx`），总工作量约 **2 小时**。

---

## 7. 风险与应对

| 风险 | 概率 | 应对 |
|------|------|------|
| ESLint 规则误报 | 低 | `allowTypeImports: true` + 白名单微调 |
| 开发者 `eslint-disable` 绕过 | 中 | CI 脚本兜底 + Code Review 检查 |
| `GameEventSimulator` API 不够用 | 中 | 发现不足时扩展 sim API，而非开放子系统 |
| 未来新增子系统忘记加入限制 | 低 | ESLint 规则是按目录 pattern 匹配，自动覆盖 |

---

## 8. 后续演进

- **方案 5 (DI 容器)**: 引擎重构时考虑引入，作为架构升级的一部分
- **方案 1 (@internal 注解)**: 作为文档化手段配合 ESLint 增强可读性
- **Architectural Fitness Function**: CI 中自动化验证测试层级规则

---

*报告完*
