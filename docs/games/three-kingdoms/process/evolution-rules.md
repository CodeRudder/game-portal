# 游戏迭代进化规则

> **范围**: v1-v20 所有版本，每轮评测改进一个迭代单元（1-3关联版本）。
> **编译要求**: `pnpm run build` 每次变更后必须通过。
> **执行方式**: 主会话编排，subagent 执行每个步骤。
> **配套文档**: [进化计划](../evolution/evo-plans/index.md) | [进化日志](../evolution/evo-logs/index.md) | [完成记录模板](../evolution/evolution-record-template.md) | [进化知识库](../evolution/evo-knowledge/index.md)

---

## 一、核心原则

| # | 原则 | 说明 |
|---|------|------|
| 1 | **眼见为实** | 所有结论必须有截图/数据/日志作证据，禁止纯推理判定 |
| 2 | **小范围迭代** | 每轮只处理1-3个关联版本，避免修复率暴跌 |
| 3 | **发现即修复** | 问题在本轮立即修复，不遗留到下一轮 |
| 4 | **每轮必复盘** | 复盘产出经验教训+进化规则，这是进化的核心引擎 |
| 5 | **UI测试不可跳过** | 每个Play流程步骤必须启动dev-server真实验证，禁止仅凭代码推理判定 |
| 6 | **修复必须回归** | 修复代码后必须重新测试验证，不通过则继续修复，直到回归通过 |

---

## 二、评测线索：Plan + Play 双驱动

> **Plan（版本计划）定义"要测什么"**——功能清单、覆盖度保证。
> **Play（用户流程）定义"怎么测"**——执行顺序、验证深度、跨系统集成。
> 两者交叉验证：Play走完后用Plan检查覆盖度，确保无遗漏。

| 对比 | 功能点驱动（旧） | Play流程驱动（新） |
|------|----------------|-------------------|
| 视角 | 开发者视角，孤立测试每个功能 | 用户视角，按真实游戏流程走 |
| 跨系统bug | 功能点间不关联，跨系统问题发现晚 | 流程自然串联多系统，早发现集成问题 |
| 文档读取 | 同一PRD被多个功能点反复引用 | Play步骤直接关联PRD/UI，一次读取 |
| 效率 | 每个功能点独立测试，重复操作多 | 一个Play流程覆盖多个功能点 |

**Play文档的PRD/UI关联格式**（评测时直接对照，无需反复查找）：

```markdown
## 步骤3: 武将招募
> PRD: ui-design/prd/HER-heroes-prd.md §3.2 招募流程
> UI:  ui-design/ui-layout/HER-heroes.md §2 招募面板

操作: 点击"招贤馆"Tab → 选择武将 → 点击招募
验证:
  - [ ] 招募按钮资源不足时置灰 (PRD §3.2.1)
  - [ ] 招募成功后武将进入已拥有列表 (UI §2.3)
  - [ ] 碎片数量正确扣除 (PRD §3.2.3 数值表)
  - [ ] 移动端375px下招募面板布局正常
```

---

## 三、单轮进化流程（6阶段）

> 每个迭代单元执行一轮完整流程。封版不通过则回到 Phase 2。

```
Phase 1: 准备 ──────────────────────── 10min
    │  读取Plan/Play/PRD/UI/进化规则
    ▼
Phase 2: 冒烟测试（Play第1遍）────────── 15min
    │  快速走通Play流程，验证基本可用性
    │  P0问题立即修复→回归验证（循环直到通过）
    ▼
Phase 3: 深度评测（Play第2遍）────────── 30-40min
    │  对照PRD/UI逐条验证每个Play步骤
    │  发现问题记录到UI评测报告
    ▼
Phase 4: 修复 + 回归验证（循环）──────── 20-40min
    │  修复Phase 3发现的问题
    │  每个修复后必须UI回归测试
    │  回归不通过→继续修复→再次回归（循环直到全部通过）
    ▼
Phase 5: 架构审查 + 修复回归 ────────── 20min
    │  全局架构合规检查
    │  发现问题→修复→回归验证（循环直到通过）
    ▼
Phase 6: 封版判定 + 复盘进化 ────────── 15min
    ├─ 通过 → 复盘→记录日志→commit→下一版本
    └─ 不通过 → 回到 Phase 2
```

### Phase 1: 准备（10min）

| 步骤 | 动作 | 产出 |
|------|------|------|
| 1.1 | 读取版本计划 `plans/v{X}.md` 功能清单 | 本轮要评测的功能点列表 |
| 1.2 | 读取/更新 Play 流程 `play/{version}-play.md`，标注PRD/UI关联 | 带引用的评测路线图 |
| 1.3 | 读取评测规范 `checklist/ui-checklist.md` + `architecture/ddd-architecture.md` | 检查标准 |
| 1.4 | 读取进化规则 `evolution/INDEX.md` + 上轮完成记录 | 历史经验+当前进度 |
| 1.5 | 读取评测工具索引 | 可用工具清单 |

补充Play流程时覆盖：主流程跑通、关联系统验证、条件与限制、边界与异常。

### Phase 2: 冒烟测试（Play第1遍，15min）

**必须启动dev-server，禁止跳过。**

| 验证项 | 通过标准 |
|--------|---------|
| 页面加载 | 无白屏、无JS Error |
| 资源栏 | 4种资源+数值可见 |
| Tab切换 | 面板正常显示 |
| 核心操作 | 有反馈（数值变化/Toast/动画） |

P0问题立即修复→UI回归验证（循环直到通过）→冒烟通过后进入Phase 3。

### Phase 3: 深度评测（Play第2遍，30-40min）

**必须启动dev-server，在真实浏览器中逐条验证，禁止跳过。**

按Play流程逐步走，每步对照PRD验证业务规则、对照UI验证布局交互、截图保存证据、记录问题。

| 验证维度 | 对照文档 |
|---------|---------|
| 业务规则 | PRD数值表、流程描述 |
| UI布局 | UI Layout规范 |
| 交互行为 | PRD交互+UI交互 |
| 数据对接 | 面板显示非空非占位 |
| 边界场景 | 空列表/满级/资源不足 |
| 响应式 | 375px/768px布局 |

问题记录到 `ui-reviews/{prd-code}-review-{round}.md`。

### Phase 4: 修复 + 回归验证循环（20-40min）

**铁律: 修复后必须UI回归测试，不通过则继续修复，直到通过。禁止未验证的修复。**

```
取一个待修复问题 → 修复代码 → pnpm build
  ├─ 编译失败 → 继续修复 → 重新编译
  └─ 编译通过 → UI回归（重新执行关联Play步骤）
       ├─ 回归失败 → 继续修复 → 重新回归
       ├─ 引入新问题 → 记录 → 继续修复
       └─ 通过 ✅ → 下一个问题
全部关闭 → Phase 5
```

P0/P1修复后额外执行一次冒烟测试。每个回归结果记录到评测报告。

### Phase 5: 架构审查 + 修复回归（20min）

| 审查维度 | 标准 |
|---------|------|
| 文件行数 | ≤500行（预警400行） |
| 单一职责 | 每个文件可一句话描述 |
| DDD分层 | UI→Engine→SubSystem→Config单向 |
| ISubsystem合规 | 实现率100% |
| 门面违规 | 无跨层直接引用 |
| 类型安全 | as any零容忍 |
| 死代码 | 无废弃文件/bak目录 |
| data-testid | 关键组件根元素有 |

审查结果写入 `tech-reviews/{prd-code}-review-{round}.md`。架构问题同样执行修复-回归循环。

### Phase 6: 封版判定 + 复盘进化（15min）

**Plan覆盖度检查**：每个功能点被至少一个Play步骤覆盖。

**封版条件**：

| 条件 | 要求 |
|------|------|
| 静态检查 | TypeScript编译0错误 + 全量测试通过 |
| 冒烟测试 | Phase 2所有验证项通过 |
| 深度评测 | 所有问题已修复并回归通过 |
| 架构审查 | 无P0/P1遗留 |
| Plan覆盖度 | 所有功能点被Play覆盖且验证通过 |

**通过** → 填写完成记录 → 更新进化日志 → commit → 下一版本
**不通过** → 回到Phase 2，开启新一轮（R+1）

---

## 四、多轮迭代循环

### 迭代收敛模型

```
迭代单元: v1.0 基业初立

R1 ──▶ 发现5个问题 → 修复→回归 → 仍剩2个
R2 ──▶ 发现2遗留+1回归 → 修复→回归 → 仍剩1个
R3 ──▶ 发现1遗留 → 修复→回归 → 0个 → ✅ 封版
```

封版 = 连续1轮无新问题 + 所有检查点通过 + UI回归通过。

### 轮次上限

| 场景 | 上限 | 超限处理 |
|------|------|---------|
| 单个迭代单元 | 5轮 | 暂停，分析根因，考虑架构级重构 |
| 连续3个单元都超3轮 | — | 暂停，重新评估评测方法 |
| 同类问题3个单元重复 | — | 升级为架构级问题，一次性解决 |

### 全局进化循环

所有版本完成后：全局复盘 → 进化方法升级 → 从v1重新开始新一轮。

---

## 五、检查规则

> 检查规则独立存放于 [review-rules/](../evolution/review-rules/) 目录，按类别分文件管理。
> 规则具备进化能力：每轮评测发现新问题时新增或修订规则。
> 索引入口: [review-rules/index.md](../evolution/review-rules/index.md)

Phase 2 冒烟和 Phase 5 架构审查时，按 [快速检查清单](../evolution/review-rules/index.md) 逐项检查。

---

## 六、文档生命周期管理

> 进化文档会持续增长，需要主动管理防止膨胀。

### 6.1 文档分类

| 类型 | 说明 | 存放位置 |
|------|------|---------|
| 规则 | 流程规则，长期有效 | `process/evolution-rules.md` |
| 索引 | 纯链接，不记录具体内容 | `evolution/INDEX.md`、`evolution/evo-plans/index.md`、`evolution/evo-logs/index.md` |
| 知识库 | 积累的进化知识，持续增长，不归档 | `evolution/evo-knowledge/` |
| 计划 | 待实施的改进方案 | `evolution/evo-plans/` |
| 记录 | 已完成的轮次记录 | `evolution/progress/` |
| 归档 | 已压缩/已过期的历史 | `evolution/archive/` |

### 6.2 生命周期规则

```
计划(evo-plans/) ──完成──▶ 移到记录(progress/)
    │                     │
    │                     ├─ 压缩：合并同类项，删除冗余细节
    │                     └─ 归档：超过5轮的旧记录移到archive/
    │
    └─废弃──▶ 删除（从未启动的计划直接删除）

索引文件 ──膨胀检测──▶ 超过200行时压缩：
    ├─ 合并类似条目
    ├─ 删除已归档条目的重复引用
    └─ 无法压缩 → 拆分（如按阶段拆分索引）
```

### 6.3 压缩规则

每5轮或每阶段结束时执行一次文档压缩：

| 规则 | 触发条件 | 动作 |
|------|---------|------|
| **计划完成迁移** | 计划标记为"已完成" | 从 `evo-plans/` 移到 `progress/`，索引中从"活跃"移到"已完成" |
| **旧记录归档** | progress中记录超过5轮 | 移到 `archive/`，日志索引中保留一行摘要 |
| **重复教训合并** | 同类教训出现3次以上 | 合并为一条通用教训，删除重复条目 |
| **冲突内容清理** | 新旧规则矛盾 | 以最新规则为准，删除旧规则中的冲突内容 |
| **索引膨胀检查** | 索引文件超过200行 | 合并/删除/拆分 |
| **废弃文件清理** | evo-plans/中超过2轮未启动 | 确认后删除 |

### 6.4 归档目录

```
evolution/
├── archive/                    # 归档的历史记录
│   ├── archive-r1-r10.md
│   └── ...
├── evo-knowledge/              # 进化知识库（持续增长，不归档）
│   ├── index.md               # 知识分类索引
│   ├── process-lessons.md     # 流程方法论
│   ├── architecture-lessons.md # 架构实践
│   ├── code-lessons.md        # 代码质量
│   ├── ui-lessons.md          # UI实践
│   └── infrastructure-lessons.md # 游戏基础设施
├── evo-plans/                  # 活跃的进化计划
│   ├── index.md               # 计划索引+方向+指标+里程碑
│   └── game-event-simulator-v2.md
├── evo-logs/                   # 进化迭代日志
│   ├── index.md               # 日志索引
│   └── evolution-r{N}.md      # 各轮详细记录
├── review-rules/               # 检查规则（独立进化）
│   ├── index.md               # 规则索引+快速清单
│   ├── white-screen-rules.md  # WS-01~08
│   ├── ui-integrity-rules.md  # UI-01~07
│   ├── architecture-rules.md  # ARCH-01~10
│   ├── code-quality-rules.md  # CQ-01~07
│   └── build-rules.md         # BLD-01~05
├── progress/                   # 近期完成记录（≤5轮）
├── evolution-record-template.md # 每轮记录模板
└── INDEX.md                    # 纯导航索引
```

---

## 七、游戏流程集成测试

与 UI 评测（Phase 2/3）并行的**引擎层测试**，站在玩家视角验证游戏逻辑、资源流、解锁条件，发现 UI 问题、逻辑漏洞、升级堵塞、未实现功能等问题。

核心原则：通过 `tick()` 时间加速推进游戏状态，禁止直接捏造资源/等级等状态值。测试用例按 Play 文档的流程 ID 组织，便于追溯。运行时机：Phase 4 引擎逻辑修复后回归，Phase 6 封版前全量通过。

测试命令：`pnpm test --project=three-kingdoms`

详细方法论、基础设施说明、测试案例：[game-flow-integration-test-methodology.md](../testing/game-flow-integration-test-methodology.md)

---

## 八、文件索引

| 文档 | 路径 | 用途 |
|------|------|------|
| **检查规则索引** | `evolution/review-rules/index.md` | 检查规则索引+快速检查清单 |
| 白屏防护规则 | `evolution/review-rules/white-screen-rules.md` | WS-01~08 |
| UI完整性规则 | `evolution/review-rules/ui-integrity-rules.md` | UI-01~07 |
| 架构合规规则 | `evolution/review-rules/architecture-rules.md` | ARCH-01~10 |
| 代码质量规则 | `evolution/review-rules/code-quality-rules.md` | CQ-01~07 |
| 构建部署规则 | `evolution/review-rules/build-rules.md` | BLD-01~05 |
| **进化计划（索引）** | `evolution/evo-plans/index.md` | 方向+里程碑+活跃计划链接 |
| **进化迭代日志（索引）** | `evolution/evo-logs/index.md` | 每轮一行+详细记录链接 |
| **进化知识库** | `evolution/evo-knowledge/index.md` | EVO-001~058 按类别分文件（不归档） |
| **完成记录模板** | `evolution/evolution-record-template.md` | 每轮记录的填写模板 |
| **GES v2方案** | `evolution/evo-plans/game-event-simulator-v2.md` | GameEventSimulator升级方案 |
| **完成记录** | `evolution/progress/evolution-record-{round}.md` | 每轮实际记录 |
| **归档记录** | `evolution/archive/` | 已压缩的历史记录 |
| 进化导航索引 | `evolution/INDEX.md` | 纯导航索引 |
| 经验教训 | `lessons/{version}-lessons.md` | 版本级教训 |
| UI测试报告 | `ui-reviews/{prd-code}-review-{round}.md` | UI测试结果 |
| 技术审查报告 | `tech-reviews/{prd-code}-review-{round}.md` | 技术审查结果 |
| Play流程 | `play/{version}-play.md` | 玩游戏测试流程 |
| 评测工作流 | `process/evaluation-workflow.md` | 评测流程细节 |
| 开发工作流 | `process/development-workflow.md` | 开发流程规范 |
| DDD架构规范 | `architecture/ddd-architecture.md` | 架构设计标准 |
| **流程集成测试方法论** | `testing/game-flow-integration-test-methodology.md` | 时间加速测试方法、里程碑设计、测试案例 |
| 集成测试工具 | `src/games/three-kingdoms/test-utils/` | GameMilestone / TimeAccelerator |
| 集成测试用例 | `src/games/three-kingdoms/engine/__tests__/integration/` | 武将招募/建筑解锁/资源流程 |

---

*文档版本: v8.0 | 更新日期: 2026-04-25 | 新增第七节：游戏流程集成测试方法说明*
