# 放置游戏子系统审查汇总报告

> **审查日期**: 2025-07-10
> **审查范围**: 19 个子系统模块
> **审查方法**: 代码审查 + 测试分析 + 架构评估
> **评分体系**: 7 维度 × 5 分制 = 满分 35 分

---

## 一、总览

### 1.1 评分排行表

| 排名 | 子系统 | 评分 | 等级 | 🔴严重 | 🟡中等 | 🟢轻微 |
|:----:|--------|:----:|:----:|:------:|:------:|:------:|
| 1 | BuildingSystem | 29/35 | A- | 1 | 5 | 4 |
| 1 | PrestigeSystem | 29/35 | A- | 2 | 3 | 2 |
| 3 | CharacterLevelSystem | 28/35 | B+ | 2 | 8 | 6 |
| 3 | FloatingTextSystem | 28/35 | B+ | 2 | 4 | 5 |
| 3 | SeasonSystem | 28/35 | B+ | 3 | 4 | 4 |
| 3 | StageSystem | 28/35 | B+ | 4 | 8 | 7 |
| 7 | ExpeditionSystem | 27/35 | B+ | 3 | 5 | 4 |
| 7 | ParticleSystem | 27/35 | B+ | 2 | 4 | 3 |
| 7 | TechTreeSystem | 27/35 | B+ | 1 | 4 | 3 |
| 7 | UnlockChecker | 27/35 | B+ | 2 | 3 | 5 |
| 11 | CraftingSystem | 25.5/35 | B | 3 | 5 | 3 |
| 12 | UnitSystem | 25/35 | B | 3 | 4 | 3 |
| 13 | EquipmentSystem | 26/35 | B | 4 | 7 | 6 |
| 14 | InputHandler | 26/35 | B- | 2 | 3 | 3 |
| 15 | TerritorySystem | 24.5/35 | B- | 4 | 5 | 4 |
| 16 | StatisticsTracker | 22.5/35 | C+ | 3 | 4 | 3 |
| 17 | DeitySystem | 21/35 | C | 3 | 6 | 4 |
| 18 | CanvasUIRenderer | 20/35 | C | 4 | 6 | 6 |
| — | BattleSystem* | — | C+ | 2 | 5 | 3 |

> *BattleSystem 无标准评分格式，采用深度分析+改进方案替代，评级基于问题严重度和架构瓶颈综合判断。

### 1.2 评分分布

```
  优秀(≥30)  ░░░░░░░░░░░░░░░░░░░░  0 个
  良好(25-29) ██████████████████░░  14 个 (73.7%)
  一般(20-24) ████░░░░░░░░░░░░░░░░  3 个 (15.8%)
  需改进(<20) ░░░░░░░░░░░░░░░░░░░░  0 个
  未评分      █░░░░░░░░░░░░░░░░░░░  1 个 (BattleSystem)
  ─────────────────────────────────
  平均分: 26.2 / 35 (74.9%)
  中位数: 27 / 35 (77.1%)
  最高分: 29 / 35 (BuildingSystem, PrestigeSystem)
  最低分: 20 / 35 (CanvasUIRenderer)
```

---

## 二、跨模块共性问题

### 2.1 所有模块共有的问题模式

| # | 共性问题 | 出现模块数 | 典型表现 |
|---|---------|:----------:|---------|
| 1 | **`loadState`/`deserialize` 无输入校验** | 18/19 | 信任外部数据，可注入非法状态（负数等级、越界值、非法 ID） |
| 2 | **`Date.now()` 硬编码** | 8/19 | 无法注入时间源，导致测试不可控、离线收益计算不灵活 |
| 3 | **零依赖但集成不足** | 15/19 | 模块独立设计优秀，但与 IdleGameEngine 实际集成度低，多为"定义未消费" |
| 4 | **事件监听器异常静默吞没** | 12/19 | `catch {}` 模式普遍，调试困难，生产环境问题难以定位 |
| 5 | **放置游戏核心特性缺失** | 16/19 | 缺少离线收益计算、自动操作、批量处理、加速机制等放置游戏标配 |
| 6 | **`reset()` 不触发事件** | 9/19 | 重置是重要状态变更，但 UI 层无法通过事件系统感知 |
| 7 | **性能无缓存机制** | 11/19 | 频繁查询方法（`getBonus`、`getTotalStats`、`getEffects`）每次全量遍历 |
| 8 | **存档格式缺版本号** | 17/19 | 无版本化支持，未来数据结构变更时迁移困难 |

### 2.2 最普遍的 5 个问题及影响范围

```
loadState 无校验   ████████████████████  18/19 模块 — 存档安全风险
放置特性缺失       ████████████████░░░░  16/19 模块 — 产品竞争力
集成不足           ████████████████░░░░  15/19 模块 — 架构孤岛
事件异常吞没       ████████████░░░░░░░░  12/19 模块 — 可调试性
无缓存机制         ███████████░░░░░░░░░  11/19 模块 — 运行时性能
```

---

## 三、各模块核心发现

### 3.1 P0 核心模块（5 个）

#### BuildingSystem（29/35 · A-）
- **最严重问题**：缺少离线收益计算能力 `calculateOfflineProduction(elapsedMs)`，放置游戏核心功能缺口
- **最大亮点**：零依赖 + 泛型设计 + 回调委托资源管理，复用性极佳（5/5）
- **核心数据**：617 行源码 / 744 行测试 / 18 个公共方法

#### PrestigeSystem（29/35 · A-）
- **最严重问题**：与 IdleGameEngine 存在数据模型割裂，引擎使用独立 `PrestigeData` 而非本模块
- **最大亮点**：对数公式声望计算 + 四级警告策略，核心逻辑满分（5/5）
- **核心数据**：410 行源码 / 587 行测试 / 11 个公共方法

#### UnitSystem（25/35 · B）
- **最严重问题**：`saveState()` 丢失 `equippedIds` 字段，存档后装备数据丢失
- **最大亮点**：`UnitResult<T>` 统一结果类型 + 事件驱动，架构设计质量高
- **核心数据**：631 行源码 / 776 行测试 / 59 个用例 / 进化系统形同虚设（成功率/前置条件/角色替换均未实现）

#### StageSystem（28/35 · B+）
- **最严重问题**：`advance()` 不扣减资源，调用方易遗忘导致资源漏洞
- **最大亮点**：零依赖 + Result 类型 + 纯函数式条件检查，跨游戏复用性极佳（5/5）
- **核心数据**：520 行源码 / 738 行测试 / 缺少星星评价系统

#### UnlockChecker（27/35 · B+）
- **最严重问题**：递归条件树无深度保护，恶意数据可导致栈溢出
- **最大亮点**：联合类型条件树设计，支持 AND/OR/NOT 组合，灵活性优秀
- **核心数据**：零外部依赖 / 27 个测试用例 / 存在重复测试文件

### 3.2 P1 通用模块（5 个）

#### CraftingSystem（25.5/35 · B）
- **最严重问题**：事件类型分裂（`CraftingEvent` vs `InternalEvent`），公共 API 返回宽泛类型
- **最大亮点**：确定性掷骰可重放 + 炼制队列管理完整
- **核心数据**：源码含 `Date.now()` 硬编码 + `inventory` 参数隐式变异

#### TechTreeSystem（27/35 · B+）
- **最严重问题**：队列研究可绕过资源检查，直接调用 `update()` 即可免费完成研究
- **最大亮点**：零依赖 + 泛型 + 事件驱动，可复用性满分（5/5）
- **核心数据**：离线进度支持好，但缺加速/洗点/条件解锁

#### EquipmentSystem（26/35 · B）
- **最严重问题**：`equip()` 缺少等级校验，低等级角色可穿戴高级装备
- **最大亮点**：泛型架构 + 事件驱动 + 序列化完整
- **核心数据**：套装系统半成品（有统计无实际效果）、镶嵌系统完全缺失

#### TerritorySystem（24.5/35 · B-）
- **最严重问题**：进攻边界条件处理不足 + 随机数可预测（`Math.random()` 未封装）
- **最大亮点**：Map + Set 数据结构合理，无内存泄漏风险，性能优秀（4.5/5）
- **核心数据**：放置适配最低（2.5/5），缺离线产出和领土差异化

#### ExpeditionSystem（27/35 · B+）
- **最严重问题**：`start()` 隐式修改传入的 `resources` 对象，违反最小惊讶原则
- **最大亮点**：确定性随机种子 + 派遣/进度/结算流程完整
- **核心数据**：58 个测试用例 / 随机精度不足（`Math.floor` 整数化）

### 3.3 P2 特殊模块（9 个）

#### BattleSystem（无标准评分 · C+）
- **最严重问题**：仅支持波次制战斗，架构无法扩展到用户要求的 6-8 种战斗模式
- **最大亮点**：56 个测试用例覆盖所有公开方法，波次制核心功能正确
- **核心数据**：297 行源码 / 需根本性重构 → 新建 BattleEngine 框架
- **配套文档**：`BATTLE-SYSTEM-ANALYSIS.md`（684 行深度分析）+ `BATTLE-SYSTEM-IMPROVEMENT.md`

#### SeasonSystem（28/35 · B+）
- **最严重问题**：历史数据无限增长，长时间运行后内存和性能风险
- **最大亮点**：季节循环算法正确处理大 dt 场景，离线支持好
- **核心数据**：`Date.now()` 耦合是隐患 / 缺时间加速和活动系统

#### DeitySystem（21/35 · C）
- **最严重问题**：新旧 API 双轨制（Favor + Blessing），接口臃肿且互斥行为不一致
- **最大亮点**：核心字段设计合理（好感/祝福双系统概念）
- **核心数据**：测试覆盖最低之一（2/5），新 API 完全零测试

#### CharacterLevelSystem（28/35 · B+）
- **最严重问题**：`unlockedSkills` 使用 `Set<string>` 不可 JSON 序列化
- **最大亮点**：连续升级、经验重算、属性累加逻辑完全正确（5/5）
- **核心数据**：35 个测试用例 / 缺转生、经验加成等放置游戏机制

#### CanvasUIRenderer（20/35 · C）
- **最严重问题**：**零测试覆盖**（13 个同类模块中唯一缺失测试）+ Canvas 状态泄漏
- **最大亮点**：覆盖了核心 UI 元素（资源面板、建筑列表、进度条等 10 个方法）
- **核心数据**：无 DPR 适配 / 飘字与 FloatingTextSystem 功能重叠 / 零外部调用者

#### ParticleSystem（27/35 · B+）
- **最严重问题**：颜色解析瓶颈 + GC 压力，中大量粒子时性能堪忧
- **最大亮点**：零依赖纯 TypeScript，发射/运动/衰减/回收流程完整
- **核心数据**：缺粒子数上限和 LOD 支持

#### FloatingTextSystem（28/35 · B+）
- **最严重问题**：每帧 `filter` 创建新数组导致 GC 压力
- **最大亮点**：769 行测试覆盖所有公共方法，测试/代码比 1.34（全场最高）
- **核心数据**：5 种轨迹 + 4 种缓动 / 无对象池无视口裁剪

#### InputHandler（26/35 · B-）
- **最严重问题**：**零测试覆盖**，所有逻辑未经自动化验证
- **最大亮点**：零依赖 + 不绑定 DOM，O(1) 查找，性能满分（5/5）
- **核心数据**：缺点击坐标、长按、触摸等放置游戏核心输入

#### StatisticsTracker（22.5/35 · C+）
- **最严重问题**：**无测试文件**，所有逻辑未经自动化验证 + `splice` O(n) 性能问题
- **最大亮点**：聚合策略设计正确，StatDefinition/StatRecord 分离合理
- **核心数据**：缺离线结算、Prestige 重置、速率计算等关键特性

---

## 四、优先修复路线图

### Phase 1: 紧急修复（1 周内）— 所有 🔴 严重问题

| 优先级 | 模块 | 问题 | 预估工时 | 影响面 |
|:------:|------|------|:--------:|--------|
| P0 | UnitSystem | `saveState` 丢失 `equippedIds` 数据 | 0.5h | 存档完整性 |
| P0 | EquipmentSystem | `equip()` 等级校验缺失 | 0.5h | 游戏平衡性 |
| P0 | TechTreeSystem | 队列研究绕过资源检查 | 1h | 经济安全 |
| P0 | CharacterLevelSystem | `Set<string>` 不可序列化 | 0.5h | 存档功能 |
| P0 | UnlockChecker | 递归条件树无深度保护 | 0.5h | 运行时安全 |
| P0 | CanvasUIRenderer | Canvas 状态泄漏（save/restore） | 1h | 渲染正确性 |
| P1 | StageSystem | `advance()` 不扣减资源 | 1h | 经济漏洞 |
| P1 | ExpeditionSystem | `start()` 隐式修改 resources | 1h | API 安全 |
| P1 | CraftingSystem | 事件类型分裂修复 | 1h | 类型安全 |
| P1 | PrestigeSystem | 与引擎数据模型割裂 | 2h | 架构一致性 |
| P1 | CanvasUIRenderer | 补全单元测试 | 4h | 质量保障 |
| P1 | InputHandler | 补全单元测试 | 3h | 质量保障 |
| P1 | StatisticsTracker | 补全单元测试 | 4h | 质量保障 |

**Phase 1 总工时估算**: ~20 人时（约 2.5 人日）

### Phase 2: 短期改进（2-4 周）— 高优先级 🟡 问题

| 类别 | 改进项 | 涉及模块数 | 预估工时 |
|------|--------|:----------:|:--------:|
| 时间注入 | 将 `Date.now()` 改为可注入时间源 | 8 | 4h |
| 存档校验 | 所有 `loadState` 增加输入验证 | 18 | 8h |
| 事件增强 | `reset()` 触发事件 + 异常不再静默吞没 | 12 | 4h |
| 性能缓存 | 高频查询方法增加脏标记+缓存 | 11 | 8h |
| 放置适配 | 补充离线收益计算接口 | 16 | 16h |
| 存档版本 | 增加版本号字段 | 17 | 4h |
| 进化补全 | UnitSystem 进化逻辑实现 | 1 | 8h |
| 套装补全 | EquipmentSystem 套装加成生效 | 1 | 4h |

**Phase 2 总工时估算**: ~56 人时（约 7 人日）

### Phase 3: 长期架构升级（1-2 月）

| 改进方向 | 说明 | 涉及模块 |
|---------|------|---------|
| **BattleEngine 框架** | 从单一波次管理器升级为多模式战斗引擎 | BattleSystem |
| **模块集成总线** | 建立子系统间标准化通信协议，消除"定义未消费" | 全部 19 个 |
| **DeitySystem 重构** | 统一新旧 API，消除双轨制 | DeitySystem |
| **CanvasUIRenderer 重构** | 分层缓存 + DPR 适配 + 与 FloatingTextSystem 合并飘字 | CanvasUIRenderer |
| **放置游戏特性层** | 统一的离线收益、自动操作、加速消耗框架 | 全部 |
| **大数支持** | 引入 BigInt 或大数库，防止后期数值精度丢失 | PrestigeSystem 等 |

---

## 五、子系统成熟度矩阵

| 子系统 | 接口 | 数据 | 逻辑 | 复用 | 性能 | 测试 | 放置适配 | 总分 |
|--------|:----:|:----:|:----:|:----:|:----:|:----:|:--------:|:----:|
| BuildingSystem | 4 | 4 | 4 | 5 | 5 | 4 | 3 | **29** |
| PrestigeSystem | 4 | 3 | 5 | 4 | 5 | 4 | 4 | **29** |
| CharacterLevelSystem | 4 | 4 | 5 | 4 | 4 | 4 | 3 | **28** |
| FloatingTextSystem | 4 | 4 | 4 | 5 | 3 | 5 | 3 | **28** |
| SeasonSystem | 4 | 4 | 4 | 5 | 3 | 4 | 4 | **28** |
| StageSystem | 4 | 4 | 4 | 5 | 4 | 4 | 3 | **28** |
| ExpeditionSystem | 4 | 4 | 4 | 5 | 3 | 4 | 3 | **27** |
| ParticleSystem | 4 | 4 | 4 | 5 | 3 | 3 | 3 | **27** |
| TechTreeSystem | 4 | 4 | 3 | 5 | 4 | 4 | 3 | **27** |
| UnlockChecker | 4 | 4 | 4 | 3 | 4 | 4 | 4 | **27** |
| EquipmentSystem | 4 | 3.5 | 3.5 | 4.5 | 4 | 3.5 | 3 | **26** |
| InputHandler | 4 | 4 | 4 | 5 | 5 | 1 | 3 | **26** |
| CraftingSystem | 3.5 | 4 | 3.5 | 4 | 3.5 | 4 | 3 | **25.5** |
| UnitSystem | 4 | 4 | 3 | 4 | 3 | 4 | 3 | **25** |
| TerritorySystem | 3.5 | 3.5 | 3 | 4 | 4.5 | 3.5 | 2.5 | **24.5** |
| StatisticsTracker | 4 | 4 | 3.5 | 4 | 3 | 1 | 3 | **22.5** |
| DeitySystem | 2.5 | 3.5 | 3 | 3.5 | 3.5 | 2 | 3 | **21** |
| CanvasUIRenderer | 3.5 | 3.5 | 3 | 3 | 2.5 | 1 | 3.5 | **20** |

### 维度分析

```
最强维度: 可复用性 (平均 4.3/5) — 零依赖+泛型设计是全项目最大亮点
最弱维度: 放置适配 (平均 3.1/5) — 放置游戏核心特性普遍缺失
差距最大: 测试覆盖 (1.0 ~ 5.0) — 3个模块零测试，最高28/35测试满分
```

---

## 六、关键建议

### 6.1 立即行动项（Top 5）

| # | 行动项 | 理由 | 工时 |
|---|--------|------|:----:|
| 1 | **修复 UnitSystem `saveState` 数据丢失** | 玩家装备存档后丢失，严重破坏游戏体验 | 0.5h |
| 2 | **补全 3 个零测试模块的单元测试** | CanvasUIRenderer、InputHandler、StatisticsTracker 完全无测试保障 | 11h |
| 3 | **修复 TechTreeSystem 资源绕过漏洞** | 可免费完成研究，破坏游戏经济 | 1h |
| 4 | **统一 `loadState` 输入校验** | 18/19 模块信任外部数据，存档篡改风险 | 8h |
| 5 | **注入时间源替代 `Date.now()`** | 8 个模块硬编码时间，测试和离线计算不可控 | 4h |

### 6.2 架构级建议

1. **建立子系统通信协议**：当前 19 个模块近乎完全独立，缺乏标准化交互方式。建议引入轻量级事件总线或消息队列，使模块间通过定义良好的接口协作，而非各自为政。

2. **统一放置游戏特性层**：离线收益、自动操作、加速消耗等放置游戏核心特性不应由各模块各自实现。建议抽取为独立的 `IdleGameFeatures` 层，各模块通过接口对接。

3. **存档系统标准化**：当前各模块 `saveState`/`loadState` 格式各异、无版本号、无校验。建议定义统一的 `SaveData<T>` 泛型接口，包含版本号、校验和、数据迁移钩子。

4. **性能监控框架**：建议引入统一的性能探针，标记各模块热路径（`getBonus`、`getTotalStats`、`getEffects` 等），在检测到性能退化时自动告警。

5. **BattleSystem 架构重构**：当前波次制架构无法扩展。建议保持向后兼容的同时，新建 `BattleEngine` 战斗引擎框架，采用策略模式支持多种战斗模式。

### 6.3 测试策略建议

| 现状 | 目标 | 行动 |
|------|------|------|
| 3 个模块零测试 | 所有模块 ≥ 80% 覆盖率 | 优先补全 CanvasUIRenderer、InputHandler、StatisticsTracker |
| 测试覆盖公共方法为主 | 覆盖边界值和异常场景 | 增加 `loadState` 非法输入、大数值、空数据等边界测试 |
| 无集成测试 | 关键模块间交互有保障 | 建立 BuildingSystem↔PrestigeSystem、UnitSystem↔BattleSystem 等集成测试 |
| 时间相关测试不可控 | 所有时间逻辑可测 | 注入时间源后重写 `Date.now()` 相关测试 |

---

## 七、附录

### 7.1 各模块详细报告链接

| # | 子系统 | 报告文件 | 评分 |
|---|--------|---------|:----:|
| 1 | BuildingSystem | [BuildingSystem-REVIEW.md](./BuildingSystem-REVIEW.md) | 29/35 |
| 2 | PrestigeSystem | [PrestigeSystem-REVIEW.md](./PrestigeSystem-REVIEW.md) | 29/35 |
| 3 | CharacterLevelSystem | [CharacterLevelSystem-REVIEW.md](./CharacterLevelSystem-REVIEW.md) | 28/35 |
| 4 | FloatingTextSystem | [FloatingTextSystem-REVIEW.md](./FloatingTextSystem-REVIEW.md) | 28/35 |
| 5 | SeasonSystem | [SeasonSystem-REVIEW.md](./SeasonSystem-REVIEW.md) | 28/35 |
| 6 | StageSystem | [StageSystem-REVIEW.md](./StageSystem-REVIEW.md) | 28/35 |
| 7 | ExpeditionSystem | [ExpeditionSystem-REVIEW.md](./ExpeditionSystem-REVIEW.md) | 27/35 |
| 8 | ParticleSystem | [ParticleSystem-REVIEW.md](./ParticleSystem-REVIEW.md) | 27/35 |
| 9 | TechTreeSystem | [TechTreeSystem-REVIEW.md](./TechTreeSystem-REVIEW.md) | 27/35 |
| 10 | UnlockChecker | [UnlockChecker-REVIEW.md](./UnlockChecker-REVIEW.md) | 27/35 |
| 11 | EquipmentSystem | [EquipmentSystem-REVIEW.md](./EquipmentSystem-REVIEW.md) | 26/35 |
| 12 | InputHandler | [InputHandler-REVIEW.md](./InputHandler-REVIEW.md) | 26/35 |
| 13 | CraftingSystem | [CraftingSystem-REVIEW.md](./CraftingSystem-REVIEW.md) | 25.5/35 |
| 14 | UnitSystem | [UnitSystem-REVIEW.md](./UnitSystem-REVIEW.md) | 25/35 |
| 15 | TerritorySystem | [TerritorySystem-REVIEW.md](./TerritorySystem-REVIEW.md) | 24.5/35 |
| 16 | StatisticsTracker | [StatisticsTracker-REVIEW.md](./StatisticsTracker-REVIEW.md) | 22.5/35 |
| 17 | DeitySystem | [DeitySystem-REVIEW.md](./DeitySystem-REVIEW.md) | 21/35 |
| 18 | CanvasUIRenderer | [CanvasUIRenderer-REVIEW.md](./CanvasUIRenderer-REVIEW.md) | 20/35 |
| 19 | BattleSystem | [BATTLE-SYSTEM-REVIEW.md](./BATTLE-SYSTEM-REVIEW.md) | — |
| — | BattleSystem 深度分析 | [BATTLE-SYSTEM-ANALYSIS.md](./BATTLE-SYSTEM-ANALYSIS.md) | — |
| — | BattleSystem 改进方案 | [BATTLE-SYSTEM-IMPROVEMENT.md](./BATTLE-SYSTEM-IMPROVEMENT.md) | — |

### 7.2 审查方法论说明

- **审查维度**: 接口设计、数据模型、核心逻辑、可复用性、性能、测试覆盖、放置游戏适配（7 维度 × 5 分制）
- **审查流程**: 源码逐行阅读 → 接口/API 分析 → 核心逻辑追踪 → 测试覆盖评估 → 问题分级（🔴/🟡/🟢）→ 综合评分
- **评分标准**: 5=优秀/4=良好/3=一般/2=不足/1=严重缺失；总分 ≥30 优秀、25-29 良好、20-24 一般、<20 需改进
- **问题分级**: 🔴 严重（数据丢失/安全漏洞/核心功能缺失）、🟡 中等（设计缺陷/性能隐患/扩展不足）、🟢 轻微（代码风格/文档/优化建议）

---

*报告由系统架构师生成 | 放置游戏引擎 v1.0 全子系统审查汇总*
