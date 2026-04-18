# 三国霸业 - 测试子系统方案

## 1. 总览

测试子系统提供三大核心能力，贯穿开发期到运行期：

| 能力 | 用途 | 时机 |
|------|------|------|
| **单元测试框架** | L1~L4 分层独立测试 | 开发期 / CI |
| **RuntimeValidator** | 运行时状态合法性校验 | 游戏运行中 |
| **UITreeExtractor** | UI 组件层级树提取与快照 | 调试 / E2E 测试 |

### 架构关系

```
┌─────────────────────────────────────────────┐
│              测试子系统 TestSystem            │
├──────────────┬──────────────┬───────────────┤
│ UnitTestFrame│ Runtime      │ UITree        │
│ work (L1-L4) │ Validator    │ Extractor     │
├──────────────┼──────────────┼───────────────┤
│ Vitest +     │ 每帧/每回合  │ 递归遍历       │
│ Mock Layer   │ 状态断言     │ Phaser Scene  │
└──────────────┴──────────────┴───────────────┘
         │              │              │
         ▼              ▼              ▼
   ┌─────────────────────────────────────┐
   │        游戏引擎 (L1-L4 Layers)       │
   └─────────────────────────────────────┘
```

---

## 2. 单元测试策略

### 2.1 分层测试矩阵

| 层级 | 内容 | 测试方式 | Mock 依赖 |
|------|------|----------|-----------|
| **L1 数据** | 数据结构、纯函数、配置表 | 纯单元测试，零依赖 | 无 |
| **L2 逻辑** | 资源计算、建筑升级、战斗公式 | 单元测试 + 边界值 | Mock L1 数据 |
| **L3 系统** | 回合流转、AI决策、事件调度 | Mock L2 接口测试 | Mock IL2Logic |
| **L4 表现** | UI渲染、动画、交互反馈 | 组件测试 + 快照 | Mock IL3System |

### 2.2 关键 Mock 接口

```typescript
// L2 对 L1 的依赖（轻量 mock，多数情况直接用真实 L1）
// L1 是纯数据，通常不需要 mock

// L3 通过此接口 mock L2
interface IL2Logic {
  calculateBattle(attacker: ArmyState, defender: ArmyState): BattleResult;
  getUpgradeCost(buildingType: string, level: number): Resources;
  calculateProduction(city: CityState): Resources;
  canRecruit(barracks: BuildingState, resources: Resources): boolean;
}

// L4 通过此接口 mock L3
interface IL3System {
  getCurrentTurn(): TurnState;
  getPlayerCities(playerId: string): CityState[];
  executeAction(action: GameAction): ActionResult;
  getAvailableActions(playerId: string): GameAction[];
}
```

### 2.3 测试组织

```
tests/
├── unit/
│   ├── l1-data/          # 纯数据结构测试
│   │   ├── resources.test.ts
│   │   └── config.test.ts
│   ├── l2-logic/         # 业务逻辑测试
│   │   ├── battle.test.ts
│   │   ├── building.test.ts
│   │   └── production.test.ts
│   ├── l3-system/        # 系统集成测试（mock L2）
│   │   ├── turn-flow.test.ts
│   │   ├── ai-decision.test.ts
│   │   └── event-scheduler.test.ts
│   └── l4-ui/            # 表现层测试（mock L3）
│       ├── city-panel.test.ts
│       └── battle-scene.test.ts
├── mocks/
│   ├── mock-l2.ts        # IL2Logic 实现
│   └── mock-l3.ts        # IL3System 实现
└── runtime/              # 运行时校验测试
    └── validator.test.ts
```

### 2.4 示例：L3 测试用 mock L2

```typescript
// tests/mocks/mock-l2.ts
export function createMockL2(overrides?: Partial<IL2Logic>): IL2Logic {
  return {
    calculateBattle: vi.fn().mockReturnValue({ winner: 'attacker', losses: {} }),
    getUpgradeCost: vi.fn().mockReturnValue({ gold: 100, food: 50, wood: 0, iron: 0 }),
    calculateProduction: vi.fn().mockReturnValue({ gold: 10, food: 20, wood: 5, iron: 0 }),
    canRecruit: vi.fn().mockReturnValue(true),
    ...overrides,
  };
}

// tests/unit/l3-system/turn-flow.test.ts
describe('TurnFlow', () => {
  it('每回合扣减部队粮草', () => {
    const l2 = createMockL2();
    const turnFlow = new TurnFlow(l2);
    const result = turnFlow.processTurn(armyState);
    expect(result.foodConsumed).toBeGreaterThan(0);
  });
});
```

---

## 3. RuntimeValidator 设计

### 3.1 核心接口

```typescript
/** 校验严重级别 */
type Severity = 'error' | 'warn' | 'info';

/** 单条校验结果 */
interface ValidationIssue {
  rule: string;           // 规则标识，如 'resource.negative'
  severity: Severity;
  message: string;        // 人类可读描述
  context: Record<string, unknown>; // 相关上下文数据
}

/** 校验报告 */
interface ValidationReport {
  timestamp: number;
  turn: number;
  issues: ValidationIssue[];
  passed: boolean;        // 无 error 级别问题即为 passed
}

/** 运行时校验器 */
interface IRuntimeValidator {
  /** 校验全量游戏状态 */
  validate(state: GameState): ValidationReport;
  /** 校验单座城市 */
  validateCity(city: CityState): ValidationIssue[];
  /** 校验战斗结果合理性 */
  validateBattle(result: BattleResult): ValidationIssue[];
  /** 注册自定义规则 */
  addRule(rule: ValidationRule): void;
}

/** 校验规则定义 */
interface ValidationRule {
  id: string;
  name: string;
  severity: Severity;
  check(state: GameState): ValidationIssue | null;
}
```

### 3.2 内置检测规则清单

| 规则 ID | 检测内容 | 级别 |
|---------|----------|------|
| `resource.negative` | 金/粮/木/铁任一 < 0 | error |
| `resource.overflow` | 单项资源超过上限 999,999 | warn |
| `building.level_range` | 建筑等级 < 1 或 > 最大等级 | error |
| `building.type_valid` | 建筑类型在配置表中存在 | error |
| `building.prerequisite` | 升级前置建筑条件满足 | warn |
| `army.size_limit` | 部队人数超过城市容量 | error |
| `army.hero_assigned` | 部队必须分配至少一名武将 | warn |
| `battle.loss_ratio` | 伤亡比超过 95%（疑似异常） | warn |
| `battle.power_delta` | 战力差 > 10倍却获胜（疑似作弊） | error |
| `turn.action_count` | 单回合操作数超过上限 | warn |
| `city.ownership` | 城市归属与玩家领土连通 | info |
| `hero.duplicate` | 同一武将出现在多个部队 | error |

### 3.3 使用方式

```typescript
const validator = new RuntimeValidator();

// 开发模式：每帧校验（仅开发环境）
if (import.meta.env.DEV) {
  game.events.on('turnEnd', (state) => {
    const report = validator.validate(state);
    if (!report.passed) {
      console.warn('[RuntimeValidator]', report.issues);
    }
  });
}

// 测试模式：主动校验
const report = validator.validate(gameState);
expect(report.passed).toBe(true);
```

---

## 4. UITreeExtractor 设计

### 4.1 核心接口

```typescript
/** UI 节点（递归树结构） */
interface UINode {
  id: string;             // 组件唯一标识
  type: string;           // 组件类型：Panel / Button / Text / Sprite / Container ...
  name: string;           // 语义名称：'city-panel' / 'recruit-btn'
  position: { x: number; y: number };
  size: { width: number; height: number };
  state: Record<string, unknown>;  // 组件特有状态：visible / text / disabled ...
  children: UINode[];
}

/** UI 树快照 */
interface UITreeSnapshot {
  timestamp: number;
  scene: string;          // 当前场景名
  root: UINode;
}

/** UI 树提取器 */
interface IUITreeExtractor {
  /** 提取当前场景完整 UI 树 */
  extract(scene: Phaser.Scene): UITreeSnapshot;
  /** 提取指定节点子树 */
  extractSubtree(node: Phaser.GameObjects.GameObject, depth?: number): UINode;
  /** 导出为 JSON 字符串 */
  toJSON(snapshot: UITreeSnapshot): string;
  /** 与基准快照 diff（用于回归测试） */
  diff(base: UITreeSnapshot, current: UITreeSnapshot): UITreeDiff;
}

/** UI 树差异 */
interface UITreeDiff {
  added: string[];        // 新增节点 id
  removed: string[];      // 移除节点 id
  changed: Array<{        // 属性变化
    id: string;
    field: string;
    before: unknown;
    after: unknown;
  }>;
}
```

### 4.2 提取策略

```
Phaser.Scene
  └─ displayList (场景显示列表)
       └─ 递归遍历每个 GameObject
            ├─ 有 name → 用作 id（开发者命名）
            ├─ 无 name → 自动生成 id（type + index）
            ├─ Container → 递归 children
            └─ 叶节点 → 收集 position / size / state
```

**关键实现逻辑：**

1. **入口**：从 `scene.children.getChildren()` 获取根节点列表
2. **类型识别**：通过 `instanceof` 判断 `Container / Text / Image / Graphics` 等
3. **尺寸获取**：Container 用 `getBounds()`，其他用 `displayWidth/displayHeight`
4. **状态采集**：提取 `visible / alpha / active / text(文本组件) / textureKey(精灵组件)` 等
5. **深度控制**：默认最大深度 20 层，防止无限递归

### 4.3 使用方式

```typescript
const extractor = new UITreeExtractor();

// 调试：打印当前 UI 树
const snapshot = extractor.extract(game.scene.getScene('CityScene'));
console.log(extractor.toJSON(snapshot));

// E2E 测试：UI 回归
const baseSnapshot = extractor.extract(scene);
// ... 执行操作 ...
const newSnapshot = extractor.extract(scene);
const diff = extractor.diff(baseSnapshot, newSnapshot);
expect(diff.removed).not.toContain('recruit-btn');
```

### 4.4 输出示例

```json
{
  "timestamp": 1719000000,
  "scene": "CityScene",
  "root": {
    "id": "city-root",
    "type": "Container",
    "name": "city-panel",
    "position": { "x": 0, "y": 0 },
    "size": { "width": 1280, "height": 720 },
    "state": { "visible": true, "alpha": 1 },
    "children": [
      {
        "id": "gold-text",
        "type": "Text",
        "name": "resource-gold",
        "position": { "x": 100, "y": 20 },
        "size": { "width": 120, "height": 24 },
        "state": { "text": "金: 1500", "visible": true },
        "children": []
      }
    ]
  }
}
```

---

## 5. 实现计划

| 阶段 | 内容 | 产出 | 工期 |
|------|------|------|------|
| **P1 基础框架** | Vitest 配置 + Mock 接口定义 + L1 测试 | `tests/` 目录结构 + 30+ L1 用例 | 2天 |
| **P2 L2/L3 测试** | L2 业务逻辑测试 + L3 mock L2 测试 | 60+ L2/L3 用例 + mock 工厂 | 3天 |
| **P3 RuntimeValidator** | 内置 12 条规则 + 开发模式集成 | `RuntimeValidator` 类 + 规则测试 | 2天 |
| **P4 UITreeExtractor** | Phaser 遍历 + JSON 输出 + diff 算法 | `UITreeExtractor` 类 + 快照测试 | 2天 |

**依赖关系：** P1 → P2（串行），P3/P4 与 P2 可并行。

---

## 6. 验收标准

### 单元测试框架
- [ ] L1~L4 每层测试可独立运行（`vitest run tests/unit/l1-data/`）
- [ ] L3 测试不依赖真实 L2 实现，仅通过 `IL2Logic` mock
- [ ] L4 测试不依赖真实 L3 实现，仅通过 `IL3System` mock
- [ ] 总用例数 ≥ 100，覆盖率 ≥ 80%

### RuntimeValidator
- [ ] 12 条内置规则全部实现并有对应测试
- [ ] `validate()` 单次执行 < 5ms（100座城市规模）
- [ ] 开发模式下 `turnEnd` 事件自动触发校验
- [ ] 生产环境可通过配置关闭或降级为 warn-only

### UITreeExtractor
- [ ] 输出 JSON 结构严格符合 `UINode` 接口定义
- [ ] 支持最大 20 层深度递归，超限截断并标记
- [ ] `diff()` 正确识别 add/remove/change 三种变化
- [ ] 提取完整 UI 树（100 节点）< 10ms
