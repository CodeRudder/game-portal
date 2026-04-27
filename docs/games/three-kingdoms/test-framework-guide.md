# 三国霸业 — 测试框架使用说明

> **版本**: v1.0 | **更新日期**: 2026-04-27 | **适用范围**: 三国霸业项目全测试体系

---

## 一、为什么需要这个框架

### 1.1 它解决了什么问题

过去项目出现了多次**测试全绿但生产环境崩溃**的问题：

| Bug | 严重程度 | 测试为什么没发现 |
|-----|---------|----------------|
| 商店 Tab ID 不匹配（`general` vs `normal`） | P0 | ACC 测试 mock 了 engine，mock 的 `getShopGoods('normal')` 硬编码返回数据，与组件自洽但与真实引擎不一致 |
| ShopSystem 未初始化（`init()`/`setCurrencySystem()` 未调用） | P1 | 测试中 `getShopSystem()` 永远返回有效 mock 对象，从未验证真实引擎初始化链路 |
| 武将 Tab 引导系统 registry key 不匹配（`tutorial-state` vs `tutorialStateMachine`） | P0 | ACC 测试 mock 了所有子组件（GuideOverlay 等 8 个组件全部替换成空壳 div），registry 查找逻辑根本不会执行 |
| isStepCompleted localStorage 解析无防御 | P1 | 测试从未覆盖"从 localStorage 加载引导状态"的真实场景 |

**根因**：所有 ACC 测试使用**完全 mock 的 engine 对象**，形成"三重陷阱"——

| 陷阱 | 表现 | 后果 |
|------|------|------|
| **Mock 自洽** | mock 行为与组件期望一致，但与真实 engine 不一致 | 测试通过但生产环境报错 |
| **Mock 覆盖** | 子组件全部 mock 成空壳 div | 子组件的 bug 完全不可见 |
| **类型断言** | `as unknown as ThreeKingdomsEngine` 跳过类型检查 | mock 可以缺少任何方法 |

**一句话总结**：之前的测试验证的是"如果 engine 工作正常，UI 能否正确渲染"，但从未验证"engine 是否真的工作正常"。

### 1.2 新框架的解决思路

引入**四层测试架构**，在 mock 测试和 E2E 测试之间增加两个关键层级：

```
┌─────────────────────────────────────────────────────────┐
│  L3  E2E 冒烟测试 (Playwright)                          │
│  真实浏览器 + 真实引擎 + 真实渲染                         │
│  覆盖：7个Tab切换 + 16个功能面板 + Console错误捕获         │
│  用例：6个  执行：~3分钟  触发：CI/手动                   │
├─────────────────────────────────────────────────────────┤
│  L2  组件集成测试 (Vitest + jsdom)          ← 新增       │
│  真实引擎 + 真实组件 + jsdom渲染                          │
│  覆盖：Tab切换渲染 + 商店购买流程 + 面板打开               │
│  用例：24个  执行：~10秒  触发：每次提交                   │
├─────────────────────────────────────────────────────────┤
│  L1  Engine 契约测试 (Vitest + jsdom)      ← 新增       │
│  真实引擎初始化验证（不涉及UI渲染）                        │
│  覆盖：106个getter非null + 51个registry key + 依赖注入    │
│  用例：20个  执行：~2秒  触发：每次提交                    │
├─────────────────────────────────────────────────────────┤
│  L0  引擎单元测试 (Vitest)                               │
│  纯逻辑测试，~15,821 用例                                 │
│  覆盖：所有引擎子系统的内部逻辑                            │
│  执行：~3分钟  触发：CI                                   │
├─────────────────────────────────────────────────────────┤
│  L0  ACC 验收测试 (Vitest + jsdom)                       │
│  Mock Engine + 组件渲染测试，468 用例                     │
│  覆盖：13个模块的用户验收标准                              │
│  执行：~30秒  触发：每次提交                               │
└─────────────────────────────────────────────────────────┘
```

**关键设计原则**：
- **L1/L2 使用真实 `ThreeKingdomsEngine` 实例**，不做 mock，直接暴露初始化问题
- **L2 在 jsdom 中渲染真实 React 组件**，不需要启动浏览器，执行速度接近单元测试
- **L3 仅用于关键路径的冒烟验证**，避免所有测试都依赖 Playwright

---

## 二、四层测试架构详解

### 2.1 L0 — 引擎单元测试 + ACC 验收测试

**这是现有测试，保持不变。**

| 维度 | 引擎单元测试 | ACC 验收测试 |
|------|------------|-------------|
| 文件位置 | `src/games/three-kingdoms/engine/**/__tests__/` | `src/games/three-kingdoms/tests/acc/` |
| 文件数 | ~499 | ~15 |
| 用例数 | ~15,821 | ~468 |
| Engine | 真实实例（纯逻辑） | Mock 对象 |
| UI渲染 | 无 | jsdom（mock engine） |
| 执行命令 | `pnpm test:tk` | `pnpm test:tk` |
| 用途 | 验证引擎子系统内部逻辑正确 | 验证组件在给定数据下的渲染行为 |

**局限性**：ACC 测试使用 mock engine，无法发现引擎初始化问题和前后端不一致。

### 2.2 L1 — Engine 契约测试（新增）

**核心价值**：用真实 Engine 实例验证"引擎初始化后，UI 依赖的所有接口都可用"。

#### 文件结构
```
src/games/three-kingdoms/
├── test-utils/                            ← 共享测试工具（81+文件使用）
│   ├── GameEventSimulator.ts              ← 真实引擎封装（含createShared/clearCache）
│   ├── engine-contracts.ts                ← 契约常量定义
│   ├── test-helpers.ts                    ← 工厂函数+常量re-export
│   ├── TimeAccelerator.ts                 ← 时间加速器
│   ├── GameMilestone.ts                   ← 里程碑枚举
│   └── test-constants.ts                  ← 语义化常量
├── tests/
│   ├── contract/
│   │   └── engine-contract.test.ts        ← 契约测试用例
│   └── integration/
│       ├── scene-router.test.tsx          ← Tab切换集成测试
│       └── shop-integration.test.tsx      ← 商店深度集成测试
```

#### 契约常量（`test-utils/engine-contracts.ts`）

集中管理 UI 对 Engine 的所有依赖关系，通过 `test-helpers.ts` 统一导出，**任何变更都必须在此处更新**：

```typescript
import {
  ENGINE_GETTER_CONTRACT,      // 106 个 getter 方法名
  ENGINE_DEPENDENCY_CONTRACT,  // 子系统间依赖关系
  REGISTRY_KEY_CONTRACT,       // 51 个 registry key
  TAB_ID_CONTRACT,             // 前端 Tab ID 映射
} from '../../test-utils/test-helpers';

// 1. Getter 契约 — 106 个 getter 方法，init() 后必须返回非 null
export const ENGINE_GETTER_CONTRACT = [
  'getHeroSystem', 'getShopSystem', 'getCurrencySystem',
  'getTutorialStateMachine', 'getTutorialStepManager',
  // ... 共 106 个
] as const;

// 2. 依赖注入契约 — 子系统间的 setter 注入关系
export const ENGINE_DEPENDENCY_CONTRACT = [
  { system: 'ShopSystem', dependency: 'CurrencySystem', via: 'setCurrencySystem' },
] as const;

// 3. Registry Key 契约 — 51 个注册键，前后端必须一致
export const REGISTRY_KEY_CONTRACT = [
  { subsystem: 'ShopSystem', registeredKey: 'shop' },
  { subsystem: 'TutorialStateMachine', registeredKey: 'tutorialStateMachine' },
  // ... 共 51 个
] as const;

// 4. Tab ID 契约 — 前端 Tab ID 与后端枚举的映射
export const TAB_ID_CONTRACT = {
  shop: {
    frontend: ['normal', 'black_market', 'limited_time', 'vip'],
    backendType: 'ShopType',
  },
} as const;
```

#### 测试用例（20 个）

| 编号 | 测试内容 | 能发现的 Bug |
|------|---------|-------------|
| EC-01-01 | `engine.init()` 不抛异常 | 初始化链路断裂 |
| EC-01-02~05 | 所有 getter（核心/R11/引导/离线）返回非 null | `getShopSystem()` 返回 null、`getTutorialStateMachine()` 返回 null |
| EC-02-01~03 | 子系统依赖关系正确 | `setCurrencySystem()` 未调用、registry 不完整 |
| EC-03-01~04 | 所有 registry key 可获取 | key 拼写错误（`tutorial-state` vs `tutorialStateMachine`） |
| EC-04-01~05 | Tab ID 与后端枚举匹配 | `general` vs `normal` 不匹配 |
| EC-05-01~03 | Engine reset + reinit 后仍完整 | 重置后子系统丢失 |

#### 执行
```bash
pnpm test:contract
# 或
pnpm vitest run --config vitest.config.three-kingdoms.ts 'src/games/three-kingdoms/tests/contract/'
```

### 2.3 L2 — 组件集成测试（新增）

**核心价值**：用真实 Engine + 真实 React 组件验证"Tab 切换后面板能正常渲染"。

#### 文件结构
```
src/games/three-kingdoms/tests/integration/
├── scene-router.test.tsx        ← IC-01~03: Tab 切换渲染测试
└── shop-integration.test.tsx    ← IC-04~06: 商店深度集成测试
```

#### 测试用例（24 个）

**scene-router.test.tsx**（11 用例）：

| 编号 | 测试内容 | 能发现的 Bug |
|------|---------|-------------|
| IC-01-01~07 | 每个 Tab 切换后组件不崩溃、DOM 非空 | Tab 切换白屏、组件渲染异常 |
| IC-02-01~03 | 功能面板（商店等）打开后渲染正常 | 面板打开空白、shopSystem 为 null |
| IC-03-01 | Console 无 ReferenceError | 未定义变量、缺失依赖 |

**shop-integration.test.tsx**（13 用例）：

| 编号 | 测试内容 | 能发现的 Bug |
|------|---------|-------------|
| IC-10-01-01~03 | Tab 切换后商品列表正确刷新 | Tab ID 不匹配导致空列表 |
| IC-10-02-01~03 | 购买流程端到端 | setCurrencySystem 未调用导致不扣费 |
| IC-10-03-01~03 | 售罄/库存/折扣商品展示 | 空状态处理异常 |
| IC-10-04-01 | 刷新功能 | manualRefresh 调用失败 |
| IC-10-05-01~03 | Engine 初始化完整性 | init/reset/reinit 链路问题 |

#### 关键实现模式

```typescript
// 创建真实 Engine + 最小化 stub（仅对 ShopSystem 等未完全集成的子系统）
function createEngineWithShopStub() {
  const engine = new ThreeKingdomsEngine();
  engine.init();

  // 对已集成的子系统（如 HeroSystem）不需要 stub
  // 只对 ShopSystem 等需要额外数据的子系统提供最小 stub
  const shopStub = {
    getShopGoods: (tabId: string) => MOCK_GOODS[tabId] ?? [],
    // ...
  };

  const augmentedEngine = engine as unknown as Record<string, unknown>;
  augmentedEngine.getShopSystem = () => shopStub;

  return { engine, shopStub };
}

// 渲染真实组件
render(<ShopPanel engine={engine} visible={true} onClose={vi.fn()} />);

// 验证渲染结果
expect(screen.getByText('杂货铺')).toBeInTheDocument();
```

**与 ACC 测试的关键区别**：
- ACC 测试：`makeMockEngine()` → 全部 mock → `as unknown as Engine`
- 集成测试：`new ThreeKingdomsEngine()` + `engine.init()` → 真实实例 → 仅对未集成的子系统提供最小 stub

#### 执行
```bash
pnpm test:integration
# 或
pnpm vitest run --config vitest.config.three-kingdoms.ts 'src/games/three-kingdoms/tests/integration/'
```

### 2.4 L3 — E2E 冒烟测试（Playwright）

**核心价值**：在真实浏览器中验证关键用户路径。

#### 文件结构
```
e2e/
├── three-kingdoms-smoke.test.ts   ← 冒烟测试主文件
├── playwright.config.ts           ← Playwright 配置
└── screenshots/                   ← 自动截图
```

#### 测试用例（6 个）

| 编号 | 测试内容 | 覆盖范围 |
|------|---------|---------|
| 1 | 首页加载检测 | 无白屏、TabBar 可见、默认 Tab 正确 |
| 2 | 7 个一级 Tab 切换 | 每个 Tab 可点击、内容非空、无 ReferenceError |
| 3 | MoreTab 11 个功能面板 | 每个面板可打开、内容非空 |
| 3b | FeatureMenu 5 个扩展面板 | 远征/装备/名士/竞技/军队 |
| 4 | Console 错误汇总 | 全 Tab 遍历无 ReferenceError |
| 5 | 声望面板专项 | 完整渲染验证 |

#### Console 错误捕获机制

```typescript
class ConsoleErrorCollector {
  private errors: Array<{ type: string; text: string }> = [];

  attach(page: Page) {
    page.on('console', (msg) => {
      if (msg.type() === 'error') this.errors.push({ type: 'console.error', text: msg.text() });
    });
    page.on('pageerror', (err) => {
      this.errors.push({ type: 'pageerror', text: `${err.name}: ${err.message}` });
    });
  }

  getReferenceErrors() {
    return this.errors.filter(e => e.text.includes('ReferenceError'));
  }
}
```

#### 执行
```bash
pnpm test:e2e
# 需要先启动开发服务器
pnpm preview &  pnpm test:e2e
```

---

## 三、共享测试基础设施

### 3.1 GameEventSimulator（`test-utils/GameEventSimulator.ts`）

项目核心测试工具，封装真实 ThreeKingdomsEngine，提供高层 API。已被 81+ 个测试文件使用。

```typescript
import { GameEventSimulator } from '../../test-utils/GameEventSimulator';
import { createSim } from '../../test-utils/test-helpers';

// 方式 1: 独立实例（每次创建新实例，测试间隔离）
const sim = createSim();  // 等价于 new GameEventSimulator() + sim.init()

// 方式 2: 共享实例（测试间复用，适合只读验证）
const sim = GameEventSimulator.createShared();

// 方式 3: 清除缓存
GameEventSimulator.clearCache();

// 使用
sim.addResources({ gold: 5000 });
sim.upgradeBuilding('farmland');
sim.engine.getShopSystem();  // 直接访问真实引擎
```

| 方法 | 说明 | 适用场景 |
|------|------|---------|
| `createSim()` | 创建独立实例并初始化 | 一般测试（test-helpers.ts） |
| `GameEventSimulator.createShared()` | 创建或获取共享实例 | 只读验证（契约测试） |
| `GameEventSimulator.clearCache()` | 清除共享实例缓存 | afterAll 全局清理 |
| `sim.initBeginnerState()` | 初始化新手状态 | 需要基础游戏进度 |
| `sim.initMidGameState()` | 初始化中期状态 | 需要高级游戏进度 |

### 3.2 契约常量（`test-utils/engine-contracts.ts`）

集中管理 UI 对 Engine 的所有依赖关系。通过 `test-helpers.ts` 统一导出：

```typescript
import {
  ENGINE_GETTER_CONTRACT,      // 106 个 getter 方法名
  ENGINE_DEPENDENCY_CONTRACT,  // 子系统间依赖关系
  REGISTRY_KEY_CONTRACT,       // 51 个 registry key
  TAB_ID_CONTRACT,             // 前端 Tab ID 映射
} from '../../test-utils/test-helpers';
```

**维护规则**：
1. 新增 getter → 在 `ENGINE_GETTER_CONTRACT` 中添加
2. 新增子系统注册 → 在 `REGISTRY_KEY_CONTRACT` 中添加
3. 新增子系统间依赖 → 在 `ENGINE_DEPENDENCY_CONTRACT` 中添加
4. 新增 Tab ID 映射 → 在 `TAB_ID_CONTRACT` 中添加
5. 每次修改后运行 `pnpm test:contract` 验证

---

## 四、执行命令速查

| 命令 | 层级 | 范围 | 预计耗时 |
|------|------|------|---------|
| `pnpm test:contract` | L1 | Engine 契约测试（20 用例） | ~2 秒 |
| `pnpm test:integration` | L2 | 组件集成测试（35 用例） | ~10 秒 |
| `pnpm test:tk` | L0+L1+L2 | 三国全量测试（~16,344 用例） | ~3 分钟 |
| `pnpm test:e2e` | L3 | E2E 冒烟测试（6 用例） | ~3 分钟 |
| `pnpm test` | 全部 | 项目全量测试（~40,804 用例） | ~10 分钟 |

### 推荐工作流

```
开发新功能/修复 Bug 时：
  1. pnpm test:contract       ← 快速验证引擎初始化完整性（2秒）
  2. pnpm test:integration     ← 验证组件渲染正常（10秒）
  3. git commit                ← 提交

CI 流水线：
  1. pnpm test:tk              ← 三国全量测试（3分钟）
  2. pnpm test:e2e             ← E2E 冒烟（3分钟）

发布前：
  1. pnpm test                 ← 项目全量测试（10分钟）
  2. pnpm test:e2e             ← E2E 冒烟（3分钟）
```

---

## 五、如何为新模块添加测试

### 5.1 新增引擎子系统

**步骤 1**：在 `engine-contracts.ts` 中注册

```typescript
// 1. 添加到 ENGINE_GETTER_CONTRACT
export const ENGINE_GETTER_CONTRACT = [
  // ... 现有
  'getNewSystem',           // ← 新增
] as const;

// 2. 添加到 REGISTRY_KEY_CONTRACT
export const REGISTRY_KEY_CONTRACT = [
  // ... 现有
  { subsystem: 'NewSystem', registeredKey: 'newSystem' },  // ← 新增
] as const;

// 3. 如果有依赖注入，添加到 ENGINE_DEPENDENCY_CONTRACT
export const ENGINE_DEPENDENCY_CONTRACT = [
  // ... 现有
  { system: 'NewSystem', dependency: 'OtherSystem', via: 'setOtherSystem' },  // ← 新增
] as const;
```

**步骤 2**：运行契约测试验证

```bash
pnpm test:contract
```

如果新 getter 或 registry key 在 init() 后返回 null，测试会立即失败并报告具体编号。

### 5.2 新增 UI 面板

**步骤 1**：添加集成测试

```typescript
// tests/integration/new-panel.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ThreeKingdomsEngine } from '../../engine/ThreeKingdomsEngine';
import NewPanel from '@/components/idle/panels/new/NewPanel';

describe('NewPanel 集成测试 (IC-XX)', () => {
  let engine: ThreeKingdomsEngine;

  beforeEach(() => {
    engine = new ThreeKingdomsEngine();
    engine.init();
  });

  afterEach(() => {
    cleanup();
    engine.reset();
  });

  it('IC-XX-01: 面板渲染不崩溃', () => {
    const { container } = render(
      <NewPanel engine={engine} visible={true} onClose={vi.fn()} />
    );
    expect(container.innerHTML).not.toBe('');
  });

  it('IC-XX-02: 显示预期内容', () => {
    render(<NewPanel engine={engine} visible={true} onClose={vi.fn()} />);
    expect(screen.getByText('预期文本')).toBeInTheDocument();
  });
});
```

**步骤 2**：在 E2E 冒烟测试中添加面板验证

```typescript
// e2e/three-kingdoms-smoke.test.ts
// 在 FEATURE_PANELS 或 moreTabPanels 中添加新面板
```

### 5.3 新增 Tab ID 映射

**步骤 1**：在 `engine-contracts.ts` 中注册

```typescript
export const TAB_ID_CONTRACT = {
  shop: { frontend: [...], backendType: 'ShopType' },
  newModule: {                           // ← 新增
    frontend: ['tab_a', 'tab_b'] as const,
    backendType: 'NewModuleType' as const,
  },
} as const;
```

**步骤 2**：在 `engine-contract.test.ts` 中添加验证用例

```typescript
describe('NewModule Tab ID 契约 (EC-XX)', () => {
  it('EC-XX-01: 每个 tab id 对应有效的后端数据', () => {
    const system = engine.getNewModuleSystem();
    for (const tabId of TAB_ID_CONTRACT.newModule.frontend) {
      const data = system.getData(tabId);
      expect(data, `[EC-XX-01] tab "${tabId}" 返回 undefined`).toBeDefined();
    }
  });
});
```

---

## 六、与旧测试体系的关系

### 6.1 ACC 测试保持不变

现有的 13 个 ACC 验收测试（468 用例）**继续保留**，它们验证的是"在给定数据下组件的渲染行为"，仍有价值。

### 6.2 新旧测试的互补关系

| 场景 | 旧 ACC 测试 | 新契约/集成测试 |
|------|-----------|---------------|
| 组件在给定数据下渲染正确 | ✅ 覆盖 | — |
| Engine 初始化后所有 getter 可用 | ❌ 盲区 | ✅ L1 契约测试 |
| Tab 切换后面板不白屏 | ❌ 盲区 | ✅ L2 集成测试 |
| 前后端 ID/Key 一致 | ❌ 盲区 | ✅ L1 契约测试 |
| 子系统依赖注入完整 | ❌ 盲区 | ✅ L1 契约测试 |
| 真实浏览器中无 JS 错误 | ❌ 盲区 | ✅ L3 E2E 测试 |

### 6.3 迁移路径（可选）

如果未来需要将 ACC 测试从 mock engine 迁移到真实 engine：

1. **Phase 1**（已完成）：新增 L1 契约测试 + L2 集成测试，覆盖核心链路
2. **Phase 2**（可选）：逐步将 ACC 测试中的 `makeMockEngine()` 替换为 `GameEventSimulator.createShared()`
3. **Phase 3**（可选）：移除 ACC 测试中的 `vi.mock()` 子组件替换

> **注意**：Phase 2/3 是可选的，当前 L1+L2 已经覆盖了 ACC 测试的盲区。

---

## 七、常见问题

### Q1: 为什么不把所有测试都改成用真实 Engine？

**性能和维护成本的权衡**。真实 Engine 初始化需要 ~50ms，如果 468 个 ACC 用例每个都创建新实例，总耗时会从 30 秒增加到 ~25 秒（使用 `GameEventSimulator.createShared()` 共享实例可以缓解）。而且某些 ACC 测试需要特定的数据状态（如"武将满级"），用 mock 更容易构造。

### Q2: 为什么 L2 集成测试中 ShopSystem 还是用 stub？

因为 `ThreeKingdomsEngine` 内置的 `ShopSystem` 目前没有内置测试商品数据。`getShopGoods('normal')` 返回空数组，无法验证商品渲染。未来如果 ShopSystem 内置了默认商品数据，可以去掉 stub。

### Q3: L1 契约测试能替代 L3 E2E 测试吗？

**不能**。L1 在 jsdom 中运行，无法验证：
- CSS 布局和动画
- 真实浏览器 API 兼容性
- 网络请求和资源加载
- 真实用户交互体验

L3 是唯一能在真实浏览器环境中运行的测试层级。

### Q4: 如何判断一个 Bug 应该在哪一层写测试？

| Bug 类型 | 推荐层级 |
|---------|---------|
| 引擎子系统内部逻辑错误 | L0 引擎单元测试 |
| Engine getter 返回 null | L1 契约测试 |
| Registry key 拼写错误 | L1 契约测试 |
| Tab ID 与后端不匹配 | L1 契约测试 |
| 子系统依赖注入缺失 | L1 契约测试 |
| 组件渲染崩溃/白屏 | L2 集成测试 |
| Tab 切换后内容为空 | L2 集成测试 |
| 购买/升级等交互流程错误 | L2 集成测试 |
| 真实浏览器中 JS 报错 | L3 E2E 测试 |
| CSS 布局错乱 | L3 E2E 测试（截图对比） |

### Q5: 契约常量如何保持与代码同步？

**手动维护 + 测试守护**。当添加新的 getter/registry key 时，需要同步更新 `engine-contracts.ts`。如果忘记更新，L1 契约测试不会失败（它只验证已注册的契约），但 L2 集成测试或 L3 E2E 测试可能会发现新功能未被覆盖。

建议在 Code Review 中检查：新增 getter → 是否更新了 `ENGINE_GETTER_CONTRACT`。

---

## 八、文件索引

| 文件 | 行数 | 说明 |
|------|------|------|
| `test-utils/GameEventSimulator.ts` | ~400 | 引擎封装 + createShared/clearCache |
| `test-utils/engine-contracts.ts` | 122 | 契约常量定义 |
| `test-utils/test-helpers.ts` | ~110 | 工厂函数 + 常量 re-export |
| `test-utils/TimeAccelerator.ts` | 259 | 时间加速器 |
| `tests/contract/engine-contract.test.ts` | 350 | L1 契约测试（20 用例） |
| `tests/integration/scene-router.test.tsx` | 257 | L2 Tab 切换集成测试（11 用例） |
| `tests/integration/shop-integration.test.tsx` | 440 | L2 商店深度集成测试（13 用例） |
| `e2e/three-kingdoms-smoke.test.ts` | 479 | L3 E2E 冒烟测试（6 用例） |
| `vitest.config.three-kingdoms.ts` | 55 | 三国专用 Vitest 配置 |
| `scripts/acc-check.sh` | — | ACC 验收检查脚本 |
| `scripts/test.sh` | — | 分层测试执行脚本 |

---

## 附录：历史 Bug 与测试层级对照

| Bug | 在哪一层能被发现 | 实际被哪一层发现 |
|-----|----------------|----------------|
| ShopPanel Tab ID 不匹配 (`general` vs `normal`) | L1 契约测试 (EC-04) | 手动测试 |
| ShopSystem.init() 未调用 | L1 契约测试 (EC-01) | 手动测试 |
| ShopSystem.setCurrencySystem() 未调用 | L1 契约测试 (EC-02) | 手动测试 |
| Registry key 不匹配 (`tutorial-state` vs `tutorialStateMachine`) | L1 契约测试 (EC-03) | 手动测试 |
| isStepCompleted localStorage 解析无防御 | L2 集成测试 | 手动测试 |
| 武将 Tab 初始化崩溃 | L2 集成测试 (IC-01) | 手动测试 |
| 商店面板打开但内容为空 | L2 集成测试 (IC-02) | 手动测试 |

> **结论**：所有历史 Bug 都可以通过 L1/L2 测试自动发现，无需 Playwright。
