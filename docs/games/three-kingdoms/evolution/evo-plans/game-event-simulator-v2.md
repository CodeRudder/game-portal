# GameEventSimulator v2 升级方案

> **状态**: 🔵 待实施 | **优先级**: P1 | **关联方向**: 评测工具进化
> **源码**: `src/games/three-kingdoms/test-utils/GameEventSimulator.ts`（426行）
> **里程碑**: M2 — GameEventSimulator v2

---

## 一、现状分析

### 当前能力（无头模式）

GameEventSimulator 封装 ThreeKingdomsEngine，提供链式API操作引擎状态：
- 资源：addResources / consumeResources / setResource
- 建筑：upgradeBuilding / upgradeBuildingTo
- 武将：recruitHero / addHeroDirectly / addHeroFragments
- 战斗：winBattle / getCampaignProgress
- 时间：fastForward / fastForwardSeconds / fastForwardMinutes / fastForwardHours
- 预设状态：initBeginnerState / initMidGameState
- 快照：getSnapshot / getEventLog

### 核心局限

```
GameEventSimulator ← 只能操作内存中的引擎实例
    ↓ 无法验证
浏览器中的UI ← 需要人工启动dev-server → 手动操作 → 肉眼检查

4套工具各自独立：
  GameEventSimulator ── 只能操作引擎，无法验证UI
  game-actions ──────── 只能操作浏览器，无法准备复杂状态
  UITreeExtractor ───── 只能分析组件树，无法驱动测试
  UIReviewOrchestrator ─ 只做静态分析，不验证运行时
```

**痛点**：测试"武将升星后战力显示"需要手动招募→碎片→升星→刷新→肉眼检查。理想方式是一行代码设置状态，自动验证UI。

---

## 二、目标架构

### 双模式设计

```
┌─────────────────────────────────────────────────────────┐
│              GameEventSimulator v2                       │
│                                                         │
│  无头模式 (Headless)          有头模式 (Headed)          │
│  ─────────────────           ─────────────────          │
│  内存引擎实例                 注入浏览器运行             │
│  纯逻辑测试                   UI+逻辑一体化测试          │
│  Vitest 单元测试              Playwright E2E 测试        │
│  不需要 dev-server            需要 dev-server            │
│                                                         │
│  ┌─────────────┐             ┌─────────────────────┐    │
│  │ 已有能力     │             │ 新增能力             │    │
│  │             │             │                     │    │
│  │ addResources│             │ attachToPage(page)  │    │
│  │ upgradeBldg │             │ syncToBrowser()     │    │
│  │ recruitHero │             │ syncFromBrowser()   │    │
│  │ winBattle   │             │ assertUI()          │    │
│  │ fastForward │             │ verifySnapshot()    │    │
│  │ initXxxState│             │ runPlayScenario()   │    │
│  └─────────────┘             └─────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

### 有头模式工作原理

有头模式下，GameEventSimulator 通过 `page.exposeFunction` 将自身注入浏览器，
浏览器内的游戏引擎直接通过注入的API修改数据，UI实时响应变化。

```
方式1: 状态注入（简单直接）
  sim.initMidGameState()
  sim.syncToBrowser(page)     // 写入localStorage → 刷新页面
  // UI自动反映新状态

方式2: 运行时控制（精准操作）
  sim.attachToPage(page)      // 注入控制API到浏览器
  sim.addResources({gold:5000})  // 浏览器内引擎直接修改
  // UI实时响应，无需刷新

方式3: Play场景模板（端到端）
  sim.runPlayScenario('heroStarUp', page)
  // 自动执行：设置状态→UI操作→截图→断言
```

---

## 三、Tier 分级实施

### Tier 1: 浏览器状态注入

**目标**: 打通引擎↔UI的桥梁，支持状态一键注入和读取。

```typescript
class GameEventSimulator {
  // ── 无头模式（已有，不变）──
  // addResources(), upgradeBuilding(), recruitHero() ...

  // ── 有头模式新增 ──

  /** 导出引擎存档为JSON字符串 */
  exportSaveData(): string {
    return JSON.stringify(this.engine.getState());
  }

  /** 从JSON字符串导入引擎存档 */
  importSaveData(json: string): void {
    this.engine.load(JSON.parse(json));
  }

  /** 将当前引擎状态注入浏览器（通过localStorage） */
  async syncToBrowser(page: Page): Promise<void> {
    const saveData = this.exportSaveData();
    await page.evaluate((data) => {
      localStorage.setItem('three-kingdoms-save', data);
    }, saveData);
    await page.reload({ waitUntil: 'networkidle' });
  }

  /** 从浏览器加载存档到本地引擎（反向同步） */
  async syncFromBrowser(page: Page): Promise<void> {
    const raw = await page.evaluate(() =>
      localStorage.getItem('three-kingdoms-save')
    );
    if (raw) this.importSaveData(raw);
  }

  /** 运行时注入控制API到浏览器（无需刷新，UI实时响应） */
  async attachToPage(page: Page): Promise<void> {
    await page.exposeFunction('simCommand', (cmd: string, args: any[]) => {
      return this.executeCommand(cmd, args);
    });
  }

  /** 在浏览器内执行模拟器命令 */
  private async executeCommand(cmd: string, args: any[]): Promise<any> {
    switch (cmd) {
      case 'addResources': this.addResources(args[0]); break;
      case 'upgradeBuilding': this.upgradeBuilding(args[0]); break;
      case 'setResource': this.setResource(args[0], args[1]); break;
      // ... 其他命令
    }
    return this.getSnapshot();
  }
}
```

**验收标准**: `sim.initMidGameState().syncToBrowser(page)` 后，浏览器显示5个武将、6个通关关卡、正确的资源数值。

---

### Tier 2: UI验证断言库

**目标**: 自动对比引擎状态与UI显示，发现数据不一致。

```typescript
class GameEventSimulator {
  /** 对比引擎状态与UI显示的一致性 */
  async assertUIConsistency(page: Page): Promise<ConsistencyReport> {
    const engineState = this.getSnapshot();
    const bodyText = await page.textContent('body');

    const issues: ConsistencyIssue[] = [];

    // 检查资源数值
    for (const [type, amount] of Object.entries(engineState.resources)) {
      if (amount > 0 && !bodyText.includes(String(amount))) {
        issues.push({ type: 'resource', detail: `${type}: engine=${amount}, UI未找到` });
      }
    }

    // 检查武将数量
    const heroElements = await page.$$('[data-testid*="hero"]');
    if (heroElements.length !== engineState.generalCount) {
      issues.push({ type: 'hero', detail: `engine=${engineState.generalCount}, UI=${heroElements.length}` });
    }

    return { consistent: issues.length === 0, issues };
  }

  /** 验证特定UI元素是否存在且可见 */
  async assertVisible(page: Page, testId: string): Promise<boolean> {
    const el = await page.$(`[data-testid="${testId}"]`);
    return el !== null && await el.isVisible();
  }

  /** 截图并保存证据 */
  async captureEvidence(page: Page, name: string): Promise<string> {
    return takeScreenshot(page, name);
  }
}
```

**验收标准**: `sim.assertUIConsistency(page)` 自动发现"引擎有5个武将但UI只显示3个"这类不一致。

---

### Tier 3: Play场景模板

**目标**: 可复用的"状态准备→UI操作→结果验证"端到端测试场景。

```typescript
interface PlayScenario {
  name: string;
  description: string;
  /** 准备引擎状态（无头模式） */
  setup: (sim: GameEventSimulator) => void;
  /** 在浏览器中执行UI操作并验证（有头模式） */
  execute: (sim: GameEventSimulator, page: Page) => Promise<ScenarioResult>;
}

/** 场景注册表 */
const scenarioRegistry: Map<string, PlayScenario> = new Map();

/** 注册场景 */
function defineScenario(scenario: PlayScenario): void {
  scenarioRegistry.set(scenario.name, scenario);
}

// ── 预置场景 ──

defineScenario({
  name: 'fullPlaythrough',
  description: '从零开始完整游戏流程',
  setup: (sim) => sim.initBeginnerState(),
  execute: async (sim, page) => {
    await sim.syncToBrowser(page);
    await enterGame(page);
    await verifyResourceProducing(page);
    await switchTab(page, '建筑');
    await openBuildingModal(page, 0);
    return { passed: true, evidence: [] };
  },
});

defineScenario({
  name: 'heroStarUp',
  description: '武将升星流程验证',
  setup: (sim) => {
    sim.initMidGameState().addHeroFragments('liubei', 100);
  },
  execute: async (sim, page) => {
    await sim.syncToBrowser(page);
    await enterGame(page);
    await switchTab(page, '武将');
    const starBtn = await page.$('[data-testid="star-up-liubei"]');
    if (!starBtn) return { passed: false, evidence: ['star-up button not found'] };
    await starBtn.click();
    const report = await sim.assertUIConsistency(page);
    return { passed: report.consistent, evidence: report.issues };
  },
});

defineScenario({
  name: 'insufficientResources',
  description: '资源不足操作拦截',
  setup: (sim) => sim.initBeginnerState().setResource('gold', 0),
  execute: async (sim, page) => {
    await sim.syncToBrowser(page);
    await enterGame(page);
    const upgradeBtn = await page.$('[data-testid="upgrade-building"]');
    const disabled = upgradeBtn && await upgradeBtn.isDisabled();
    return { passed: !!disabled, evidence: [`button disabled: ${disabled}`] };
  },
});
```

**验收标准**: `sim.runPlayScenario('heroStarUp', page)` 自动完成：状态准备→注入浏览器→操作UI→验证结果。

---

## 四、工具链集成

| 工具 | 当前 | 集成后 |
|------|------|--------|
| GameEventSimulator | 引擎操作（无头） | +有头模式/+状态注入/+UI断言/+场景模板 |
| game-actions | 浏览器操作（基础） | +GameEventSimulator集成/+场景回放 |
| UITreeExtractor | 组件树分析 | +断言API/+引擎数据对比 |
| UIReviewOrchestrator | 静态分析 | +运行时验证 |

---

## 五、实施计划

| 阶段 | 内容 | 预计改动量 | 验收方式 |
|------|------|-----------|---------|
| Tier 1 | syncToBrowser / syncFromBrowser / attachToPage | ~80行新增 | v1.0冒烟测试通过自动注入 |
| Tier 2 | assertUIConsistency / assertVisible | ~100行新增 | 发现一个已知数据不一致 |
| Tier 3 | 场景注册表 + 3个预置场景 | ~150行新增 | heroStarUp场景自动通过 |
| 集成 | game-actions 引用 GameEventSimulator | ~30行修改 | E2E脚本使用新能力 |

---

*方案版本: v1.0 | 创建日期: 2026-04-23*
