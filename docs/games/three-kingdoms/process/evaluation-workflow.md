# 三国霸业 — 评测迭代流程规范 v2.0

> **版本**: v2.0
> **创建日期**: 2026-04-21
> **基于**: 两轮60次迭代经验（R1-R30 + NEW-R1~R19）
> **定位**: 评测迭代的执行纲领，与 [iteration-rules.md](./iteration-rules.md)（开发迭代规则）和 [development-workflow.md](./development-workflow.md)（开发流程规范）并列
> **核心变化**: 小范围迭代 + 真实运行验证 + 评测工具持续进化

---

## 一、核心原则

### 1.1 三大铁律

| # | 铁律 | 说明 | 违反后果 |
|---|------|------|---------|
| 1 | **小范围** | 每轮只评1-3个关联版本 | 范围过大→修复率暴跌（历史33%） |
| 2 | **真实验证** | 每轮必须启动dev-server验证页面 | 不启动→运行时错误零发现（历史最大盲点） |
| 3 | **持续进化** | 每轮记录经验教训，改进评测方法 | 不复盘→同类问题反复出现 |

### 1.2 迭代单元

```
一个迭代单元 = 1-3个关联版本的功能

示例：
  迭代单元A = v1.0 基业初立（建筑+资源，2个子系统）
  迭代单元B = v2.0 招贤纳士（武将招募+升级+碎片，3个子系统）
  迭代单元C = v3.0+v4.0 攻城略地（战役+战斗，关联版本合并）
  迭代单元D = v5.0 百家争鸣（科技树，1个子系统）
```

**合并规则**：功能强关联的版本可合并为一个迭代单元（如v3+v4都是战斗系统），但不超过3个版本。

---

## 二、单轮评测标准流程

### 2.1 总览

```
Phase 1: 静态检查 ──── 15min
Phase 2: 动态验证 ──── 20min  ← 核心改进：必须启动dev-server
Phase 3: 问题修复 ──── 30-60min
Phase 4: 复盘记录 ──── 10min
                        ─────────
                        总计: 75-105min/轮
```

### 2.2 Phase 1: 静态检查（15min）

**目标**：在代码层面确认基础质量。

| # | 检查项 | 命令 | 通过标准 |
|---|--------|------|---------|
| 1 | TypeScript编译 | `npx tsc --noEmit` | 0错误 |
| 2 | 全量测试 | `npx vitest run src/games/three-kingdoms` | 100%通过 |
| 3 | 文件行数 | 检查活跃文件 | 所有文件≤500行 |
| 4 | 禁止模式扫描 | grep检查 | 无alert/prompt/Math.random伪造 |

**禁止模式扫描脚本**：
```bash
# P0禁止模式
grep -rn "alert(" src/components/idle/ --include="*.tsx" && echo "❌ 发现alert"
grep -rn "prompt(" src/components/idle/ --include="*.tsx" && echo "❌ 发现prompt"
grep -rn "Math.random()" src/components/idle/ --include="*.tsx" | grep -v "test\|mock" && echo "❌ 发现Math.random伪造"
grep -rn "engine: any" src/components/idle/ --include="*.tsx" && echo "❌ 发现engine:any"
```

### 2.3 Phase 2: 动态验证（20min）⭐ 核心改进

**目标**：在真实浏览器环境中验证游戏可用性。

#### 2.3.1 启动开发服务器

```bash
cd /mnt/user-data/workspace/game-portal
npm run dev
# 等待编译完成，确认无编译错误
```

#### 2.3.2 浏览器验证检查点

| # | 检查项 | 验证方法 | 通过标准 |
|---|--------|---------|---------|
| D-1 | 页面加载 | 打开游戏URL | 无白屏、无JS错误 |
| D-2 | 控制台错误 | F12→Console | 0个Error（Warning≤5可接受） |
| D-3 | 资源栏渲染 | 查看顶部 | 4种资源+数值可见且实时变化 |
| D-4 | Tab栏渲染 | 查看底部Tab | 当前版本对应Tab存在且可点击 |
| D-5 | 面板数据对接 | 点击Tab→查看面板 | 数据非空、非undefined、非占位文字 |
| D-6 | 操作反馈 | 点击按钮 | Toast提示/数值变化/动画响应 |
| D-7 | 弹窗交互 | 打开/关闭弹窗 | ESC关闭+遮罩关闭+X关闭均正常 |
| D-8 | 移动端适配 | F12→Toggle Device（375px） | 布局不错乱、触摸热区≥44px |

#### 2.3.3 评测工具使用（AI按情况选择）

**原则：评测工具不固定，AI根据当前版本特点和发现的问题灵活选择和改进工具。**

以下是可用工具库，AI可自由组合、扩展或创建新工具：

##### 工具A: UITreeExtractor（已有，组件树提取）

```typescript
// 位置: src/games/three-kingdoms/tests/ui-extractor/
// 能力:
//   - ReactDOMAdapter: React DOM组件树提取
//   - PixiJSAdapter: PixiJS渲染树提取
//   - CompositeExtractor: 双层合并提取
//   - UITreeDiffer: 快照差异对比
//   - query(): 按名称/类型/状态/位置查询节点

// 使用方式1: 浏览器Console脚本
// 在dev-server运行时，粘贴到Console执行
const root = document.getElementById('root');
// ... 提取并查询组件树

// 使用方式2: Vitest集成测试
import { ReactDOMAdapter } from '../ui-extractor';
const adapter = new ReactDOMAdapter();
const snapshot = adapter.extractFromDOM(container);
const panels = adapter.query(snapshot, { namePattern: /BuildingPanel/ });
expect(panels.length).toBeGreaterThan(0);
```

**AI可改进UITreeExtractor**：当发现现有能力不足以验证某类问题时，直接修改/扩展代码。例如：
- 新增 `AccessibilityChecker` 适配器检查ARIA属性
- 新增 `StyleAnalyzer` 分析CSS合规性
- 新增 `InteractionSimulator` 模拟用户操作

##### 工具B: Playwright（E2E自动化）

```typescript
// 安装: npm install -D @playwright/test
// 适用: 完整用户流程验证、截图对比、性能测量

import { test, expect } from '@playwright/test';

test('v1.0 建筑升级流程', async ({ page }) => {
  await page.goto('http://localhost:5173/games/three-kingdoms');
  
  // 检查页面加载
  await expect(page.locator('.tk-game-container')).toBeVisible();
  
  // 检查控制台无错误
  const errors: string[] = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  
  // 执行操作流程
  await page.click('[data-testid="tab-building"]');
  await expect(page.locator('.tk-building-panel')).toBeVisible();
  
  // 验证无错误
  expect(errors).toHaveLength(0);
});
```

##### 工具C: Agent Browser（AI驱动浏览器）

```typescript
// 适用: AI自主探索页面、发现未知问题
// AI可编写浏览器自动化脚本，模拟真实用户行为
// 包括：随机点击探索、边界值输入、快速切换面板等
```

##### 工具D: 截图对比（视觉回归）

```typescript
// 适用: 确认修复未引入视觉回归
// Playwright内置截图能力:
await page.screenshot({ path: `screenshots/${version}-home.png` });

// 也可使用UITreeDiffer对比组件树快照:
import { UITreeDiffer } from '../ui-extractor';
const differ = new UITreeDiffer();
const diff = differ.diff(baselineSnapshot, currentSnapshot);
```

##### 工具E: AI自创工具

**AI有权根据需要创建全新的评测工具**，不限于上述列表。例如：
- 性能分析工具（FPS监控、内存泄漏检测）
- 数据一致性校验器（面板数据vs引擎数据对比）
- 操作录制回放器（记录用户操作序列并回放验证）
- 无障碍扫描器（WCAG合规性自动检查）

#### 2.3.4 工具选择策略

| 场景 | 推荐工具 | 理由 |
|------|---------|------|
| 快速验证组件是否渲染 | UITreeExtractor Console脚本 | 零配置，即时反馈 |
| 完整用户流程验证 | Playwright E2E | 可靠、可重复、可CI |
| 探索性测试（发现未知问题） | Agent Browser | AI自主探索，覆盖盲区 |
| 修复后回归验证 | 截图对比 + UITreeDiffer | 快速确认无回归 |
| 特定问题深度分析 | AI自创工具 | 针对性强 |

### 2.4 Phase 3: 问题修复（30-60min）

**修复原则**：

1. **发现即修复**：Phase 2发现的问题在本轮Phase 3立即修复
2. **修一个验一个**：每个修复后立即运行测试+编译确认
3. **修复后重验证**：Phase 3结束后重新执行Phase 2确认修复有效
4. **P0不过夜**：P0问题必须在当轮修复

**修复流程**：
```
发现问题 → 定位根因 → 编写修复 → 运行测试 → 启动dev-server验证 → 确认修复
```

### 2.5 Phase 4: 复盘记录（10min）

**每轮必须完成以下记录**，这是评测进化的核心机制。

#### 2.5.1 评测报告

保存到 `docs/games/three-kingdoms/bugs/reviews/review-vX-vY.md`：

```markdown
# 评测报告 — vX.X~vY.Y [版本名]

> 日期: YYYY-MM-DD
> commit: xxxxxxx
> 评测工具: [使用的工具列表]

## 静态检查结果
| 检查项 | 结果 |
|--------|------|
| TypeScript编译 | ✅ 0错误 |
| 全量测试 | ✅ N文件M测试 |
| 禁止模式 | ✅ 无违规 |

## 动态验证结果
| 检查项 | 结果 | 截图/证据 |
|--------|------|----------|
| 页面加载 | ✅/❌ | [截图] |
| 控制台错误 | 0/N个 | [截图] |
| 功能Tab | ✅/❌ | [截图] |
| 面板数据 | ✅/❌ | [截图] |
| 操作反馈 | ✅/❌ | [截图] |
| 弹窗交互 | ✅/❌ | [截图] |
| 移动端 | ✅/❌ | [截图] |

## UITreeExtractor验证（如使用）
[组件树统计、关键组件查询结果]

## 发现问题
| # | 问题 | P级 | 修复状态 | 修复commit |
|---|------|-----|---------|-----------|

## 评分
| 维度 | 分数 |
|------|------|
| 功能完整性 | X/10 |
| UI合理性 | X/10 |
| 交互体验 | X/10 |
| 综合评分 | X/10 |
```

#### 2.5.2 经验教训追加

追加到 `docs/games/three-kingdoms/bugs/lessons-learned.md`：

```markdown
### LL-[编号]: [简短标题]
- **发现轮次**: review-vX-vY
- **问题类型**: 评测遗漏 / 工具不足 / 流程缺陷 / 检查点缺失
- **描述**: 具体描述
- **根因**: 为什么现有方法没发现
- **改进措施**: 新增的检查点/工具/流程
- **验证结果**: 下一轮是否有效
```

#### 2.5.3 评测工具改进记录

追加到本文档的「附录A: 评测工具进化日志」：

```markdown
| 日期 | 轮次 | 改进内容 | 效果 |
|------|------|---------|------|
| YYYY-MM-DD | review-vX | 新增XXX检查点 | 发现N个新问题 |
```

---

## 三、评测检查点体系

### 3.1 通用检查点（每轮必检）

| # | 检查点 | 加入轮次 | 加入原因 |
|---|--------|---------|---------|
| S-1 | TypeScript编译0错误 | R1 | 基础类型安全 |
| S-2 | 全量测试100%通过 | R1 | 功能回归防护 |
| S-3 | 文件行数≤500 | v1.0 | 代码质量 |
| S-4 | 禁止模式扫描 | R11 | alert/prompt/Math.random |
| D-1 | 页面加载无白屏 | **v2.0** | 运行时错误零发现是最大盲点 |
| D-2 | Console无Error | **v2.0** | TypeError等运行时错误 |
| D-3 | 资源栏渲染正确 | **v2.0** | 核心UI组件验证 |
| D-4 | Tab栏可见可点击 | **v2.0** | 功能可达性 |
| D-5 | 面板数据非空非占位 | **v2.0** | 引擎对接验证 |
| D-6 | 操作有反馈 | **v2.0** | 交互完整性 |
| D-7 | 弹窗三种关闭方式 | **v2.0** | SharedPanel一致性 |
| D-8 | 移动端布局正确 | **v2.0** | 响应式验证 |

### 3.2 版本专属检查点（按版本添加）

每个版本在首次评测时，根据PRD/UI文档制定专属检查点：

```markdown
### v1.0 专属检查点
| # | 检查点 | 验证方法 |
|---|--------|---------|
| V1-1 | 建筑升级消耗扣除 | 升级建筑→检查资源减少 |
| V1-2 | 建筑升级倒计时 | 开始升级→进度条可见且递减 |
| V1-3 | 资源自动产出 | 等待→资源数值递增 |
| V1-4 | 建筑解锁条件 | 检查未解锁建筑显示锁定状态 |
```

### 3.3 检查点进化规则

```
1. 每轮评测结束后，评估检查点的有效性
2. 发现新问题类型 → 新增对应检查点
3. 连续3轮未触发问题的检查点 → 降级为抽样检查
4. AI有权根据经验动态调整检查点优先级
```

---

## 四、评测工具体系

### 4.1 工具全景

```
┌─────────────────────────────────────────────────────┐
│                  评测工具体系                         │
│                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────┐ │
│  │ 静态分析工具  │  │ 动态验证工具  │  │ AI自创工具 │ │
│  │              │  │              │  │           │ │
│  │ TypeScript   │  │ Playwright   │  │ 按需创建   │ │
│  │ Vitest       │  │ Agent Browser│  │ 灵活扩展   │ │
│  │ ESLint       │  │ 截图对比     │  │ 持续进化   │ │
│  │ grep扫描     │  │ Console脚本  │  │           │ │
│  └──────────────┘  └──────────────┘  └───────────┘ │
│         │                 │                │        │
│         └────────┬────────┘                │        │
│                  ▼                         │        │
│         ┌──────────────┐                   │        │
│         │UITreeExtractor│◄─────────────────┘        │
│         │ (核心基础设施)  │                          │
│         │              │                           │
│         │ DOM树提取     │                           │
│         │ PixiJS树提取  │                           │
│         │ 快照+差异对比  │                           │
│         │ 组件查询      │                           │
│         └──────────────┘                           │
└─────────────────────────────────────────────────────┘
```

### 4.2 UITreeExtractor — 核心基础设施

**位置**: `src/games/three-kingdoms/tests/ui-extractor/`

**已有能力**:
| 模块 | 能力 | 状态 |
|------|------|------|
| `types.ts` | 统一类型定义（UITreeNode/Snapshot/Diff/Query/Report） | ✅ 完整 |
| `ReactDOMAdapter.ts` | React DOM组件树提取（Fiber解析+DOM遍历） | ✅ 完整 |
| `PixiJSAdapter.ts` | PixiJS渲染树提取 | ✅ 完整 |
| `CompositeExtractor.ts` | 双层合并提取+快照+统计 | ✅ 完整 |
| `UITreeDiffer.ts` | 快照差异对比（增/删/改/移动） | ✅ 完整 |

**AI可扩展方向**（不限于以下，根据实际需要自由扩展）:

| 扩展方向 | 说明 | 优先级 |
|---------|------|--------|
| `ConsoleErrorCollector` | 自动收集浏览器Console错误并关联到组件树节点 | 高 |
| `AccessibilityChecker` | 基于组件树检查ARIA属性、对比度、键盘可达性 | 中 |
| `StyleAnalyzer` | 分析组件树中的CSS合规性（token使用、硬编码值） | 中 |
| `InteractionSimulator` | 基于组件树自动生成点击/输入操作序列 | 中 |
| `PerformanceMonitor` | 在组件树上标注渲染耗时、识别性能瓶颈 | 低 |
| `DataConsistencyChecker` | 对比组件树显示数据与引擎实际数据 | 高 |

**扩展规范**:
```
1. 新适配器放在 ui-extractor/ 目录下
2. 遵循已有的类型系统（types.ts）
3. 导出通过 index.ts 统一入口
4. 必须有对应的 __tests__/ 测试文件
5. 在本规范文档的「附录A」中记录新增工具
```

### 4.3 Playwright — E2E自动化

**适用场景**: 完整用户流程验证、回归测试、截图对比

**安装与配置**:
```bash
npm install -D @playwright/test
npx playwright install chromium
```

**测试文件组织**:
```
e2e/
├── v1-building.spec.ts      # v1.0 建筑升级流程
├── v2-hero.spec.ts          # v2.0 武将招募流程
├── v3-campaign.spec.ts      # v3.0 战役流程
├── common/
│   ├── game-page.ts         # 游戏页面对象
│   └── helpers.ts           # 辅助函数
└── screenshots/             # 截图基线
```

**AI有权根据需要**:
- 创建新的E2E测试用例
- 修改现有测试以覆盖新发现的问题模式
- 创建Page Object模型简化测试编写
- 集成到CI流水线

### 4.4 Agent Browser — AI自主探索

**适用场景**: 探索性测试、发现未知问题、边界条件测试

**AI可自主决定**:
- 使用哪种浏览器自动化方案（Playwright/Puppeteer/其他）
- 探索策略（随机点击/定向流程/边界值输入）
- 问题记录方式（截图/日志/组件树快照）

### 4.5 工具选择决策树

```
需要验证什么？
│
├─ 代码质量 → 静态分析（TypeScript + Vitest + grep）
│
├─ 组件是否渲染 → UITreeExtractor（Console脚本或Vitest）
│
├─ 用户流程是否通顺 → Playwright E2E
│
├─ 是否有未知问题 → Agent Browser探索
│
├─ 修复是否引入回归 → UITreeDiffer快照对比 + 截图对比
│
├─ 特定问题深度分析 → AI自创工具
│
└─ 不确定 → 组合使用多种工具
```

---

## 五、评测方法进化机制

### 5.1 进化闭环

```
    ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
    │  执行评测 │────▶│  记录教训 │────▶│  改进方法 │────▶│  下轮应用 │
    │          │     │          │     │          │     │          │
    │ 发现问题  │     │ 什么问题  │     │ 怎么避免  │     │ 验证改进  │
    │ 使用工具  │     │ 工具不足  │     │ 新工具    │     │ 效果量化  │
    └──────────┘     └──────────┘     └──────────┘     └──────────┘
         ▲                                                    │
         └────────────────────────────────────────────────────┘
                          持续循环
```

### 5.2 每轮必须回答的4个问题

| # | 问题 | 记录位置 |
|---|------|---------|
| 1 | 本轮发现了哪些上一轮没发现的问题？ | 评测报告 |
| 2 | 为什么上一轮的方法没发现这些问题？ | 经验教训 |
| 3 | 需要新增或改进什么工具/检查点？ | 评测工具改进记录 |
| 4 | 上一轮的改进措施是否有效？ | 经验教训验证结果 |

### 5.3 进化指标

| 指标 | 计算方式 | 目标 |
|------|---------|------|
| 问题修复率 | 已修复/已发现 | >90% |
| 新问题发现率 | 本轮新发现/总问题 | 持续下降 |
| 回归率 | 修复引入的新问题/总修复 | <5% |
| 评测效率 | 发现问题数/评测耗时 | 持续提升 |
| 工具覆盖率 | 有工具辅助的检查点/总检查点 | 持续提升 |

---

## 六、迭代计划与调度

### 6.1 20版本评测调度

| 批次 | 版本范围 | 迭代单元数 | 预计轮数 |
|------|---------|-----------|---------|
| 1 | v1.0 基业初立 | 1 | 1轮 |
| 2 | v2.0 招贤纳士 | 1 | 1轮 |
| 3 | v3.0+v4.0 攻城略地 | 1（合并） | 1轮 |
| 4 | v5.0 百家争鸣 | 1 | 1轮 |
| 5 | v6.0+v7.0 天下大势+草木皆兵 | 1（合并） | 1轮 |
| 6 | v8.0+v9.0 商贸+离线 | 1（合并） | 1轮 |
| 7 | v10.0 兵强马壮 | 1 | 1轮 |
| 8 | v11.0+v12.0 群雄+远征 | 1（合并） | 1轮 |
| 9 | v13.0+v14.0 联盟+传承 | 1（合并） | 1轮 |
| 10 | v15.0+v16.0 事件+传承深化 | 1（合并） | 1轮 |
| 11 | v17.0 竖屏适配 | 1 | 1轮 |
| 12 | v18.0 新手引导 | 1 | 1轮 |
| 13 | v19.0+v20.0 天下一统 | 1（合并） | 1轮 |
| **合计** | **v1~v20** | **13个迭代单元** | **13轮** |

### 6.2 每轮时间预算

| 阶段 | 时间 | 说明 |
|------|------|------|
| Phase 1: 静态检查 | 15min | 编译+测试+扫描 |
| Phase 2: 动态验证 | 20min | dev-server+浏览器+工具 |
| Phase 3: 问题修复 | 30-60min | 发现即修复 |
| Phase 4: 复盘记录 | 10min | 报告+教训+工具改进 |
| **合计** | **75-105min** | |

### 6.3 封版标准

单个迭代单元封版条件：
- [ ] Phase 1静态检查全部通过
- [ ] Phase 2动态验证全部通过（D-1~D-8）
- [ ] 版本专属检查点全部通过
- [ ] 无P0/P1遗留问题
- [ ] 评测报告已记录
- [ ] 经验教训已追加

---

## 七、文件结构

```
docs/games/three-kingdoms/
├── process/
│   ├── iteration-rules.md          # 开发迭代调度规则
│   ├── development-workflow.md     # 开发流程规范
│   └── evaluation-workflow.md      # 本文档：评测迭代流程规范
├── bugs/
│   ├── BUGS-STATUS-SUMMARY.md      # Bug状态汇总
│   ├── lessons-learned.md          # 经验教训（持续追加）
│   ├── UI-CHECKLIST.md             # UI检查清单
│   └── reviews/                    # 每轮评测报告
│       ├── review-v1.md
│       ├── review-v2.md
│       └── ...
├── screenshots/                    # 截图记录
│   ├── v1-home.png
│   └── ...
└── plans/
    └── ...                         # 版本计划文档

src/games/three-kingdoms/tests/
├── ui-extractor/                   # UITreeExtractor（核心工具）
│   ├── types.ts
│   ├── ReactDOMAdapter.ts
│   ├── PixiJSAdapter.ts
│   ├── CompositeExtractor.ts
│   ├── UITreeDiffer.ts
│   ├── index.ts
│   └── __tests__/
├── e2e/                            # E2E测试（Playwright）
│   ├── v1-building.spec.ts
│   └── ...
└── ui-snapshots/                   # 组件树快照基线
    ├── baseline-v1.json
    └── ...
```

---

## 附录A: 评测工具进化日志

| 日期 | 轮次 | 改进内容 | 效果 |
|------|------|---------|------|
| 2026-04-21 | 规范创建 | 建立评测流程规范v2.0 | 基础框架 |
| - | - | *后续每轮迭代持续追加* | - |

## 附录B: 经验教训索引

| 编号 | 标题 | 发现轮次 | 类型 |
|------|------|---------|------|
| LL-R2-001 | 弹窗组件必须统一 | NEW-R15 | 评测遗漏 |
| LL-R2-002 | 引擎调用必须防御性编程 | NEW-R12 | 评测遗漏 |
| LL-R2-003 | 数字格式化应尽早统一 | NEW-R13 | 评测遗漏 |
| LL-R2-004 | 移动端触摸热区是基础要求 | NEW-R10 | 检查点缺失 |
| LL-R2-005 | 内联style应最小化 | NEW-R19 | 工具不足 |
| - | *后续每轮迭代持续追加* | - | - |

## 附录C: 评测工具开发规范

当AI需要创建或改进评测工具时，遵循以下规范：

### C.1 UITreeExtractor扩展规范

```
1. 新适配器文件: ui-extractor/{Name}Adapter.ts
2. 遵循types.ts中的类型定义
3. 实现统一的extract()/query()接口
4. 导出通过index.ts
5. 测试文件: ui-extractor/__tests__/{Name}Adapter.test.ts
6. 在本附录中记录
```

### C.2 Playwright测试规范

```
1. 测试文件: e2e/v{X}-{feature}.spec.ts
2. 使用Page Object模式: e2e/common/{feature}-page.ts
3. 每个测试覆盖一个完整用户流程
4. 包含正向和反向测试
5. 截图基线: e2e/screenshots/{version}/
```

### C.3 新工具创建规范

```
1. 明确工具要解决的问题
2. 选择合适的技术方案
3. 编写工具代码+测试
4. 在本规范中记录用途和使用方法
5. 在下一轮迭代中验证效果
```

---

*文档版本: v2.0 | 创建日期: 2026-04-21 | 基于两轮60次迭代经验*
