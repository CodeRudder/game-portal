# 放置游戏引擎优化建议

> **版本**: v1.0 | **日期**: 2026-04-15
> **基于**: 19 个子系统模块全面审查（详见 `subsystem-review/` 目录）
> **目标**: 将当前引擎从"数据逻辑完善、渲染交互不足"提升到"全链路生产级品质"

---

## 一、现状评估

### 1.1 审查数据总览

| 指标 | 数值 |
|------|------|
| 审查模块数 | 19 个 |
| 平均评分 | 26.2 / 35（74.9%） |
| 最高分 | BuildingSystem / PrestigeSystem（29/35） |
| 最低分 | CanvasUIRenderer（20/35） |
| 总代码行数 | ~10,251 行（19 个模块） |
| 总测试用例 | ~850 个 |
| 零测试模块 | 3 个（CanvasUIRenderer / InputHandler / StatisticsTracker） |

### 1.2 三层能力评估

```
数据逻辑层 ████████████████████░░  85%  ← 完善，核心玩法逻辑正确
渲染交互层 █░░░░░░░░░░░░░░░░░░░░   5%  ← 严重不足，纯 fillRect+fillText
视觉品质层 █░░░░░░░░░░░░░░░░░░░░   5%  ← 零 drawImage，无精灵动画
```

**核心矛盾**: 引擎的数据层设计优秀（零依赖+泛型+事件驱动），但渲染层几乎为零，玩家无法获得有品质的游戏体验。

---

## 二、五大优化方向

### 方向一：渲染架构升级（最高优先级）

**现状**: 所有游戏使用 `CanvasRenderingContext2D` 的 `fillRect` + `fillText` 绘制，零图片资源。

**目标**: 基于 PixiJS v8 构建高清渲染管线，支持 1080P+ 分辨率。

**已完成基础**:
- ✅ PixiJS v8 + GSAP 3.x + @pixi/tilemap 架构验证通过
- ✅ GameRenderer / MapScene / CombatScene / AnimationManager 骨架已搭建
- ✅ ThreeKingdomsPixiGame 已完成重建（完整数据流链路打通）
- ✅ SpritePOC 真实素材验证（Kenney 瓦片 + 建筑放置 + 战斗效果）

**待推进**:
- [ ] 将 PixiJS 渲染架构应用到更多放置游戏（目前仅三国霸业）
- [ ] Tile 游戏地图生成器（含不同地形、建筑、风景、NPC）
- [ ] NPC 系统（按职业活动、玩家聊天、NPC 间交谈协作）

**预估工时**: 每款游戏 2-3 人日（渲染适配）

### 方向二：放置游戏核心特性补全

**现状**: 16/19 模块缺少放置游戏核心特性（离线收益、自动操作、加速等）。

**具体缺失项**:

| 特性 | 缺失模块数 | 重要性 |
|------|:----------:|:------:|
| 离线收益计算 | 16/19 | 🔴 |
| 自动操作（自动升级/购买/合成） | 14/19 | 🔴 |
| 加速机制（时间加速/跳过） | 15/19 | 🟡 |
| 批量操作（批量购买/合成） | 12/19 | 🟡 |
| 数值膨胀防护（大数支持） | 8/19 | 🟡 |
| 存档版本迁移 | 17/19 | 🟡 |

**建议方案**: 抽取统一的 `IdleGameFeatures` 层：

```typescript
// src/engines/idle/IdleGameFeatures.ts
export interface IdleGameFeatures {
  /** 离线收益计算 */
  calculateOfflineRewards(elapsedMs: number): OfflineReward;
  /** 自动操作控制器 */
  autoPlay: AutoPlayController;
  /** 加速管理器 */
  speed: SpeedManager;
  /** 批量操作 */
  batch: BatchOperationHandler;
}
```

**预估工时**: ~40 人时（5 人日）

### 方向三：模块集成与通信标准化

**现状**: 19 个模块近乎完全独立，15/19 模块与 IdleGameEngine 实际集成度低（"定义未消费"）。

**问题示例**:
- PrestigeSystem 与引擎使用不同的 `PrestigeData` 类型（双轨制）
- StatisticsTracker 已导出但引擎完全未使用（死代码）
- CanvasUIRenderer 零外部调用者

**建议方案**: 建立轻量级模块通信协议

```typescript
// src/engines/idle/ModuleBus.ts
export interface ModuleBus {
  /** 注册模块 */
  register<T>(moduleId: string, module: T): void;
  /** 获取模块 */
  get<T>(moduleId: string): T | undefined;
  /** 模块间事件通信 */
  emit(event: ModuleEvent): void;
  on(eventType: string, handler: EventHandler): void;
}
```

**预估工时**: ~24 人时（3 人日）

### 方向四：质量保障补全

**现状**: 3 个模块零测试，部分模块测试仅覆盖公共方法未覆盖边界值。

**优先级排序**:

| 优先级 | 模块 | 当前测试 | 目标 |
|--------|------|:--------:|:----:|
| P0 | CanvasUIRenderer | 0 用例 | ≥ 30 用例 |
| P0 | InputHandler | 0 用例 | ≥ 25 用例 |
| P0 | StatisticsTracker | 0 用例 | ≥ 30 用例 |
| P1 | DeitySystem | 部分覆盖 | 补全新 API 测试 |
| P1 | 所有模块 | — | 补 loadState 非法输入测试 |

**预估工时**: ~20 人时（2.5 人日）

### 方向五：战斗引擎重构

**现状**: BattleSystem 仅支持简单波次制，无法扩展到用户要求的多种战斗模式。

**已完成设计**:
- ✅ BattleEngine 多模式框架设计（8 种战斗模式）
- ✅ 镜头系统设计（平移/缩放/特写/震动）
- ✅ 策略预设系统设计（阵型/技能优先级/目标策略）
- ✅ 完整 TypeScript 接口定义

**实施路线**:

| Phase | 内容 | 预估代码量 |
|-------|------|:----------:|
| 1 | 回合制 + 半回合制 + 伤害管道 | ~1,500 行 |
| 2 | 战棋地图 + 六角网格 | ~1,200 行 |
| 3 | 攻城战 + 城墙/士气 | ~1,000 行 |
| 4 | 自由战斗 + 实时移动 | ~1,500 行 |
| 5 | 镜头系统 + 特写 | ~800 行 |
| 6 | 塔防 + 海战 + 即时对战 | ~1,000 行 |

**预估总工时**: ~80 人时（10 人日）

---

## 三、紧急修复清单

以下为各模块 🔴 严重问题的快速修复清单，按影响面排序：

### 3.1 数据安全类（立即修复）

| # | 模块 | 问题 | 修复方案 | 工时 |
|---|------|------|---------|:----:|
| 1 | **UnitSystem** | `saveState` 丢失 `equippedIds` | 序列化时包含该字段 | 0.5h |
| 2 | **EquipmentSystem** | `equip()` 无等级校验 | 添加 `levelRequired` 检查 | 0.5h |
| 3 | **TechTreeSystem** | 队列可绕过资源检查 | `startNext()` 启动前校验资源 | 1h |
| 4 | **CharacterLevelSystem** | `Set<string>` 不可 JSON 序列化 | 改用 `string[]` 或自定义序列化 | 0.5h |
| 5 | **StageSystem** | `advance()` 不扣减资源 | 方法内集成资源扣减 | 1h |
| 6 | **ExpeditionSystem** | `start()` 隐式修改 resources | 深拷贝后再修改 | 0.5h |

### 3.2 运行时安全类（本周完成）

| # | 模块 | 问题 | 修复方案 | 工时 |
|---|------|------|---------|:----:|
| 7 | **UnlockChecker** | 递归条件树无深度保护 | 添加最大递归深度参数 | 0.5h |
| 8 | **CanvasUIRenderer** | Canvas 状态泄漏 | 所有绘制方法加 `save()/restore()` | 1h |
| 9 | **全部 18 个模块** | `loadState` 无输入校验 | 添加统一的 `validateState()` 函数 | 8h |
| 10 | **8 个模块** | `Date.now()` 硬编码 | 改为可注入时间源 | 4h |

### 3.3 功能补全类（2 周内）

| # | 模块 | 问题 | 修复方案 | 工时 |
|---|------|------|---------|:----:|
| 11 | **UnitSystem** | 进化系统形同虚设 | 补全 successRate/属性替换/前置条件 | 4h |
| 12 | **EquipmentSystem** | 套装加成未生效 | `getBonus()` 中计算套装效果 | 2h |
| 13 | **PrestigeSystem** | 与引擎数据模型割裂 | 统一为单一 PrestigeData 类型 | 2h |
| 14 | **DeitySystem** | 新旧 API 双轨制 | 制定旧 API 废弃计划，统一到新 API | 4h |

**紧急修复总工时**: ~30 人时（约 4 人日）

---

## 四、分阶段实施计划

### Phase 1：紧急修复 + 测试补全（第 1-2 周）

```
Week 1: 数据安全修复（#1-#6） + loadState 统一校验（#9）
Week 2: 运行时安全（#7-#8） + 时间注入（#10） + 零测试模块补全
```

**交付标准**: 所有 🔴 严重问题清零，3 个零测试模块达到 ≥ 25 用例

### Phase 2：放置特性 + 模块集成（第 3-4 周）

```
Week 3: IdleGameFeatures 层开发（离线收益/自动操作/加速）
Week 4: ModuleBus 通信协议 + 各模块集成到 IdleGameEngine
```

**交付标准**: 离线收益计算可用，所有模块通过 ModuleBus 与引擎交互

### Phase 3：战斗引擎重构（第 5-8 周）

```
Week 5: BattleEngine 框架 + 回合制/半回合制
Week 6: 攻城战 + 战棋类
Week 7: 自由战斗 + 镜头系统
Week 8: 塔防 + 扩展模式 + 集成测试
```

**交付标准**: 支持 ≥ 4 种战斗模式，策略预设系统可用

### Phase 4：渲染架构全面升级（第 9-12 周）

```
Week 9-10: Tile 地图生成器 + NPC 系统
Week 11-12: 逐游戏渲染升级（优先三国霸业/四大文明）
```

**交付标准**: ≥ 5 款游戏完成 PixiJS 渲染升级，1080P 高清画质

---

## 五、技术债务追踪

### 5.1 高优债务

| 债务 | 影响 | 清理方案 |
|------|------|---------|
| `Date.now()` 硬编码（8 模块） | 测试不可控、离线计算不准 | 统一时间注入接口 |
| `loadState` 无校验（18 模块） | 存档安全风险 | 统一 `validateState<T>()` 工具函数 |
| 存档无版本号（17 模块） | 数据迁移困难 | 定义 `SaveData<T>` 含 `version` 字段 |
| 事件异常吞没（12 模块） | 生产环境调试困难 | 改为 `console.error` + 可选上报 |

### 5.2 架构级债务

| 债务 | 影响 | 清理方案 |
|------|------|---------|
| 模块孤岛（15/19 未集成） | 功能无法协同 | ModuleBus 通信协议 |
| 渲染层几乎为零 | 玩家体验极差 | PixiJS 渲染架构全面升级 |
| 无大数支持 | 后期数值溢出 | 引入 BigInt 或 break_infinity.js |
| DeitySystem 双轨 API | 维护成本高 | 统一到新 API，废弃旧接口 |

---

## 六、成功指标

| 指标 | 当前值 | Phase 1 目标 | Phase 4 目标 |
|------|:------:|:----------:|:----------:|
| 🔴 严重问题数 | ~45 个 | **0 个** | 0 个 |
| 零测试模块数 | 3 个 | **0 个** | 0 个 |
| 平均模块评分 | 26.2/35 | 28/35 | 30/35 |
| 渲染覆盖率 | 5% | 10% | **60%** |
| 放置特性覆盖率 | 20% | 50% | **80%** |
| 战斗模式数 | 1 种 | 1 种 | **≥ 4 种** |
| PixiJS 渲染游戏数 | 1 款 | 2 款 | **≥ 5 款** |

---

## 附录

### A. 相关文档索引

| 文档 | 路径 |
|------|------|
| 审查汇总报告 | `docs/subsystem-review/IDLE-SUBSYSTEM-REVIEW-SUMMARY.md` |
| 审查任务描述 | `docs/subsystem-review/IDLE-SUBSYSTEM-REVIEW-TASK.md` |
| BattleSystem 深度分析 | `docs/subsystem-review/BattleSystem-ANALYSIS.md` |
| BattleSystem 改进方案 | `docs/subsystem-review/BattleSystem-IMPROVEMENT.md` |
| 各模块审查报告 | `docs/subsystem-review/{Module}-REVIEW.md` |
| 放置游戏设计指南 | `docs/IDLE-GAME-DESIGN-GUIDE-v3.md` |
| 开发流程 | `docs/IDLE-GAMES-DEVELOPMENT-PROCESS.md` |
| 部署指南 | `docs/DEPLOY-GUIDE.md` |

### B. 审查评分体系

7 维度 × 5 分制 = 满分 35 分：
- **接口设计**: API 清晰度、完整性、易用性
- **数据模型**: 结构合理性、可扩展性、序列化支持
- **核心逻辑**: 算法正确性、边界处理、防御性编程
- **可复用性**: 零依赖、泛型支持、跨游戏适用性
- **性能**: 时间/空间复杂度、缓存机制、GC 压力
- **测试覆盖**: 用例数量、边界覆盖、异常路径
- **放置游戏适配**: 离线收益、自动操作、加速、批量处理

---

*本文档基于 19 个子系统全面审查结果生成，随优化进展持续更新。*
