# 三国霸业测试子系统设计

> v1.0 | 草案 | 2025-07-09

## 1. 测试架构总览

### 1.1 测试金字塔

```
          ╱╲
         ╱E2E╲          5% — 关键用户路径（3-5条）
        ╱──────╲
       ╱ 集成测试 ╲       20% — 子系统交互、数据流
      ╱────────────╲
     ╱    单元测试     ╲    75% — 函数/类/模块隔离测试
```

| 层级 | 占比 | 覆盖率目标 | 工具 | 用例规划 |
|------|------|-----------|------|---------|
| L1 单元 | 75% | >90% | Vitest + ts-mockito | ~180 |
| L2 集成 | 20% | >80% | Vitest + GameTestRunner | ~50 |
| L3 E2E | 5% | 关键路径 | Playwright + UITreeExtractor | ~10 |

### 1.2 目录结构

```
tests/
├── unit/core/          # 引擎内核
├── unit/systems/       # 6大领域子系统
├── unit/ui/            # React组件
├── unit/rendering/     # 渲染层
├── integration/        # 子系统交互、数据流
├── e2e/                # 关键路径
├── fixtures/           # Mock数据与固件
└── utils/              # GameTestRunner + UITreeExtractor
```

技术栈：Vitest 1.x / ts-mockito / @testing-library/react / c8

---

## 2. L1 内核层测试

### 2.1 EngineFacade 测试矩阵

| 场景 | 方法 | 预期 | 优先级 |
|------|------|------|--------|
| 初始化 | `init(config)` | 按序注册子系统、触发READY | P0 |
| 注册 | `registerSystem(name, sys)` | 成功；重复注册抛EngineError | P0 |
| 获取 | `getSystem<T>(name)` | 返回正确类型；未注册返回null | P0 |
| 生命周期 | `start/pause/resume/stop` | 状态机正确转换 | P0 |
| 销毁 | `destroy()` | 逆序销毁、释放资源 | P1 |
| 异常 | `onError(handler)` | 捕获子系统异常不崩溃 | P1 |

### 2.2 子系统注册测试

```typescript
describe('EngineFacade', () => {
  let engine: EngineFacade;
  beforeEach(() => { engine = new EngineFacade(); });
  it('按依赖顺序注册6大子系统', () => { /* 注册map→hero→army→diplo→econ→battle，验证顺序 */ });
  it('重复注册抛 EngineError', () => { /* expect().toThrow(EngineError) */ });
  it('未注册返回 null', () => { /* expect(engine.getSystem('x')).toBeNull() */ });
});
```

### 2.3 基础设施测试
- 事件总线（emit/on/off 单播·多播·通配符）、资源加载器（正常·404·超时·取消）、配置管理（读写·热更新·校验）

---

## 3. L2 逻辑层测试

### 3.1 六大领域子系统

| 子系统 | 核心方法 | 用例数 | 覆盖率 |
|--------|---------|--------|--------|
| MapSystem | `getTerrain`/`getCity`/`getPath` | 25 | >90% |
| HeroSystem | `recruit`/`levelUp`/`equip`/`dismiss` | 30 | >90% |
| ArmySystem | `create`/`merge`/`split`/`march` | 25 | >85% |
| DiplomacySystem | `formAlliance`/`breakAlliance`/`tribute` | 20 | >85% |
| EconomySystem | `collectTax`/`trade`/`build`/`upgrade` | 25 | >85% |
| BattleSystem | `simulate`/`calculateDamage`/`resolve` | 30 | >90% |

### 3.2 Mock数据工厂

```typescript
export class TestDataProvider {
  static hero(overrides?: Partial<HeroData>): HeroData {
    return { id: 'hero-liubei', name: '刘备', faction: 'shu',
      level: 1, attack: 75, defense: 60, intelligence: 80, loyalty: 100, ...overrides };
  }
  static army(overrides?: Partial<ArmyData>): ArmyData { /* ... */ }
  static city(overrides?: Partial<CityData>): CityData { /* ... */ }
  static heroes(count: number, overrides?: Partial<HeroData>): HeroData[] { /* 批量生成 */ }
  static threeKingdomsSetup(): { factions; cities; heroes } { /* 标准三方初始数据 */ }
}
```

---

## 4. L3 UI层测试

### 4.1 React组件mock策略

```typescript
function renderWithGameLogic(ui: React.ReactElement, logic?: Partial<IGameLogic>) {
  const mockLogic = new MockGameLogic(logic);
  return render(<GameLogicProvider value={mockLogic}>{ui}</GameLogicProvider>);
}
```

### 4.2 UI组件测试矩阵

| 组件 | 测试重点 | 用例数 |
|------|---------|--------|
| GameBoard | 地图网格渲染、城市点击响应 | 8 |
| HeroPanel | 武将列表、属性展示、装备操作 | 10 |
| BattleView | 战斗动画触发、结果展示 | 6 |
| DiplomacyDialog | 外交选项、确认流程 | 6 |
| CityManagement | 建筑列表、升级操作 | 8 |
| TopBar | 资源显示、回合信息 | 4 |

---

## 5. UI组件层级树提取系统（核心重点）

### 5.1 设计目标

为评测师（AI Agent）提供**结构化UI组件树**：定位任意组件的位置和状态、按条件检索、生成快照用于回归比对。

### 5.2 UITreeNode 接口定义

```typescript
/** UI组件树节点 — 描述运行时UI的完整结构 */
interface UITreeNode {
  /** 节点唯一标识（自动生成的层级路径） */
  id: string;
  /** 组件类型（React组件名或HTML标签名） */
  type: string;
  /** 组件显示名称（中文，供评测师理解） */
  name: string;
  /** 屏幕坐标与尺寸（CSS像素） */
  position: { x: number; y: number; width: number; height: number };
  /** 组件运行时状态 */
  state: Record<string, unknown>;
  /** 子节点列表 */
  children: UITreeNode[];
  /** 是否可见（display/visibility/opacity综合判断） */
  visible: boolean;
  /** 是否可交互（未disabled且可见） */
  enabled: boolean;
}

/** 组件查询条件 */
interface UITreeQuery {
  type?: string;
  name?: string;
  state?: Record<string, unknown>;
  visible?: boolean;
  enabled?: boolean;
}

/** 快照差异 */
interface UITreeDiff {
  added: UITreeNode[];
  removed: UITreeNode[];
  changed: { node: UITreeNode; field: string; before: unknown; after: unknown }[];
}

/** 提取配置 */
interface UITreeExtractorConfig {
  maxDepth: number;           // 最大递归深度，默认20
  includeHidden: boolean;     // 是否包含不可见节点，默认false
  captureState: boolean;      // 是否提取组件state，默认true
  filter?: (node: UITreeNode) => boolean;  // 自定义过滤器
}
```

### 5.3 UITreeExtractor 类

```typescript
class UITreeExtractor {
  constructor(config?: Partial<UITreeExtractorConfig>);
  extractTree(rootEl: HTMLElement | React.Root): UITreeNode;        // 提取完整UI树
  findByType(type: string): UITreeNode[];          // 按类型查找（深度优先）
  findByName(name: string): UITreeNode[];          // 按名称查找（模糊匹配）
  findByState(state: Record<string, unknown>): UITreeNode[];  // 按状态查找
  getComponentPosition(nodeId: string): { x; y; width; height } | null;  // 获取坐标
  getComponentState(nodeId: string): Record<string, unknown> | null;     // 获取状态
  snapshot(rootEl: HTMLElement): { tree: UITreeNode; diff: UITreeDiff }; // 快照+差异
}
```

### 5.4 extractTree 核心逻辑

```typescript
private buildNode(el: HTMLElement, depth: number, path: string): UITreeNode | null {
  if (depth > this.config.maxDepth) return null;
  const visible = this.checkVisibility(el);
  if (!visible && !this.config.includeHidden) return null;
  const rect = el.getBoundingClientRect();
  const node: UITreeNode = {
    id: `${path}/${el.tagName}#${el.id || el.dataset.testid || uid()}`,
    type: this.resolveComponentType(el),   // __reactFiber$ 获取组件名
    name: this.resolveDisplayName(el),     // aria-label / textContent
    position: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
    state: this.config.captureState ? this.extractState(el) : {},
    children: [], visible, enabled: !el.hasAttribute('disabled') && visible,
  };
  if (this.config.filter && !this.config.filter(node)) return null;
  for (const child of el.children) {
    const cn = this.buildNode(child as HTMLElement, depth + 1, node.id);
    if (cn) node.children.push(cn);
  }
  return node;
}
```

### 5.5 与评测师集成方案

```typescript
interface IUITreeInspector {
  getUITree(): Promise<UITreeNode>;
  queryComponents(query: UITreeQuery): Promise<UITreeNode[]>;
  inspectComponent(nodeId: string): Promise<UITreeNode | null>;
  diffSnapshot(): Promise<{ tree: UITreeNode; diff: UITreeDiff }>;
}

// 注册：runner.registerInspector('ui-tree', new UITreeExtractor());
// 调用：const tree = await runner.inspect('ui-tree').getUITree();
//       const btns = await runner.inspect('ui-tree').queryComponents({ type: 'Button' });
```

### 5.6 输出示例（节选）

```json
{
  "id": "/DIV#game-root", "type": "GameBoard", "name": "三国霸业主界面",
  "position": { "x": 0, "y": 0, "width": 1920, "height": 1080 },
  "state": { "currentRound": 3, "currentFaction": "shu" },
  "children": [
    { "id": ".../DIV#top-bar", "type": "TopBar", "name": "顶部信息栏",
      "position": { "x": 0, "y": 0, "width": 1920, "height": 60 },
      "state": { "gold": 5000, "food": 8000 }, "children": [],
      "visible": true, "enabled": true },
    { "id": ".../BUTTON#btn-recruit", "type": "Button", "name": "招募武将",
      "position": { "x": 1420, "y": 80, "width": 120, "height": 40 },
      "state": { "disabled": false }, "children": [],
      "visible": true, "enabled": true }
  ], "visible": true, "enabled": true
}
```

---

## 6. 运行时测试框架

### 6.1 核心接口

```typescript
interface GameTestCase {
  name: string; category: 'core' | 'system' | 'ui' | 'e2e';
  setup?: (ctx: GameTestContext) => Promise<void>;
  execute: (ctx: GameTestContext) => Promise<void>;
  teardown?: (ctx: GameTestContext) => Promise<void>;
  timeout?: number; tags?: string[];
}

interface GameTestContext {
  engine: EngineFacade; mockLogic: IGameLogic;
  uiExtractor: UITreeExtractor; data: TestDataProvider;
}

interface GameTestResult {
  name: string; status: 'passed' | 'failed' | 'skipped' | 'error';
  duration: number; error?: Error; snapshot?: UITreeNode;
}

interface TestReport {
  timestamp: string; total: number; passed: number; failed: number; skipped: number;
  duration: number; coverage: { lines: number; branches: number; functions: number };
  results: GameTestResult[];
}
```

### 6.2 GameTestRunner

```typescript
class GameTestRunner {
  constructor(engine: EngineFacade);
  registerCase(tc: GameTestCase): void;
  registerInspector(name: string, inspector: IUITreeInspector): void;
  run(filter?: { category?: string; tags?: string[] }): Promise<GameTestResult[]>;
  runSingle(name: string): Promise<GameTestResult>;
  report(): TestReport;
}
```

执行流程：`注册 → setup() → execute() → teardown() → 结果收集`

---

## 7. Mock基础设施

### 7.1 IGameLogic 接口

```typescript
interface IGameLogic {
  // 武将
  getHero(id: string): HeroData | null;
  getHeroesByFaction(faction: string): HeroData[];
  recruitHero(heroId: string, cityId: string): boolean;
  dismissHero(heroId: string): boolean;
  // 军队
  getArmy(id: string): ArmyData | null;
  createArmy(generalId: string, cityId: string, soldiers: number): string;
  mergeArmies(armyIds: string[]): string | null;
  marchArmy(armyId: string, targetCityId: string): boolean;
  // 城市
  getCity(id: string): CityData | null;
  getCitiesByFaction(faction: string): CityData[];
  buildStructure(cityId: string, type: string): boolean;
  // 外交 + 经济 + 战斗 + 回合
  formAlliance(from: string, to: string): boolean;
  breakAlliance(from: string, to: string): boolean;
  getRelationship(a: string, b: string): DiplomacyRelation;
  collectTax(cityId: string): number;
  trade(from: string, to: string, resource: string, amount: number): boolean;
  simulateBattle(attacker: ArmyData, defender: ArmyData): BattleResult;
  getCurrentRound(): number;
  getCurrentFaction(): string;
  endTurn(): void;
}
```

### 7.2 MockGameLogic

```typescript
class MockGameLogic implements IGameLogic {
  private overrides: Partial<IGameLogic>;
  private callLog: Map<string, unknown[][]>;
  constructor(overrides?: Partial<IGameLogic>) { /* 覆盖 + 调用日志 */ }
  getCallCount(method: string): number;   // 查询调用次数
  getCalls(method: string): unknown[][];   // 查询调用参数
  reset(): void;                           // 重置日志

  // 每个方法：record() → override优先 → 默认值
  getHero(id: string): HeroData | null {
    this.record('getHero', [id]);
    return this.overrides.getHero?.(id) ?? TestDataProvider.hero({ id });
  }
  // ... 其余方法模式相同
}
```

---

## 8. 覆盖率达标路径

### 8.1 三阶段计划

| 阶段 | 目标 | 周期 | 重点 | 新增用例 |
|------|------|------|------|---------|
| **P1** | 31% → 50% | 2周 | EngineFacade + Map + Hero | 60 |
| **P2** | 50% → 70% | 2周 | Army + Economy + UI组件 + UITreeExtractor | 70 |
| **P3** | 70% → 90%+ | 3周 | Diplomacy + Battle + E2E + 快照回归 | 50 |

### 8.2 P1 详细任务

```
Week 1: Mock基础设施 → EngineFacade全量测试(20+) → MapSystem单元测试
Week 2: HeroSystem单元测试 → GameTestRunner实现 → 验证达到50%
```

### 8.3 覆盖率配置

```yaml
# vitest.config.ts
coverage:
  provider: istanbul
  thresholds:
    core/:      { lines: 90, branches: 85, functions: 90 }
    systems/:   { lines: 85, branches: 80, functions: 85 }
    ui/:        { lines: 75, branches: 70, functions: 75 }
    rendering/: { lines: 70, branches: 65, functions: 70 }
```

### 8.4 关键指标追踪

| 指标 | 当前 | P1 | P2 | 最终 |
|------|------|----|----|------|
| 测试文件数 | 27 | 45 | 80 | 100+ |
| 代码行数 | 8069 | 12K | 18K | 22K+ |
| 行覆盖率 | ~31% | 50% | 70% | >90% |
| 未覆盖模块 | 12 | 8 | 3 | 0 |

---

*下一步：按P1计划启动Mock基础设施搭建*
