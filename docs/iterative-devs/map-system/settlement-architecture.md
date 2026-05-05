# 双路径结算架构统一设计

> 版本: 1.0 | 日期: 2026-05-04 | 任务: R13-T5

## 1. 背景与问题

当前攻城结算流程分散在多个系统中，缺乏统一的结算入口：

| 路径 | 流程 | 涉及系统 |
|------|------|----------|
| **Path A (Victory)** | 战斗胜利 → 计算伤亡 → 发放奖励 → 触发回城 | SiegeBattleSystem, SiegeResultCalculator, SiegeEnhancer, MarchingSystem |
| **Path B (Defeat)** | 战斗失败 → 计算伤亡 → 不发奖励 → 触发回城 | SiegeBattleSystem, SiegeResultCalculator, MarchingSystem |
| **Path C (Cancel)** | 取消行军 → 直接回城 → 无结算 | MarchingSystem |

**痛点：**
1. 结算逻辑散布在事件监听器中，链路难以追踪
2. 三条路径的回城触发逻辑各自实现，代码重复
3. 缺少统一的 `SettlementContext` 数据结构，状态传递依赖事件 payload
4. 新增结算步骤（如道具掉落、声望计算）需要修改多处代码

## 2. 架构设计

### 2.1 核心数据结构: SettlementContext

```typescript
interface SettlementContext {
  // --- 标识 ---
  taskId: string;
  targetId: string;
  sourceId: string;

  // --- 路径标识 ---
  path: 'victory' | 'defeat' | 'cancel';

  // --- 战斗数据 ---
  battleEvent: BattleCompletedEvent | null;  // cancel时为null
  outcome: BattleOutcome | null;             // cancel时为null

  // --- 伤亡结果 ---
  casualties: {
    troopsLost: number;
    troopsLostPercent: number;
    heroInjured: boolean;
    injuryLevel: InjuryLevel;
  } | null;  // cancel时为null

  // --- 奖励结果 ---
  rewards: {
    resources: { grain: number; gold: number; troops: number };
    items: Array<{ type: string; count: number }>;
    rewardMultiplier: number;
  } | null;  // defeat/cancel时为null

  // --- 回城信息 ---
  returnMarch: {
    fromCityId: string;
    toCityId: string;
    troops: number;
    general: string;
  };

  // --- 元数据 ---
  timestamp: number;
  forceId?: string;
  heroId?: string;
}
```

### 2.2 SettlementPipeline 接口

```typescript
interface ISettlementPipeline {
  /** 阶段1: 验证上下文合法性 */
  validate(ctx: SettlementContext): SettlementResult;

  /** 阶段2: 计算伤亡和结果等级 */
  calculate(ctx: SettlementContext): SettlementContext;

  /** 阶段3: 分发奖励(胜利路径) */
  distribute(ctx: SettlementContext): SettlementContext;

  /** 阶段4: 触发通知事件 */
  notify(ctx: SettlementContext): SettlementContext;

  /** 统一入口: 执行完整结算流水线 */
  execute(ctx: SettlementContext): SettlementResult;
}
```

### 2.3 流水线执行流程

```
                    ┌─────────────┐
                    │   execute   │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │  validate   │ ──── 检查ctx完整性
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │  calculate  │ ──── 计算伤亡/结果等级
                    │             │      Path C: 跳过
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │ distribute  │ ──── 发放奖励
                    │             │      Path B/C: 跳过
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │   notify    │ ──── 发射事件 + 触发回城
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │   result    │
                    └─────────────┘
```

### 2.4 三路径配置差异

| 步骤 | Path A (Victory) | Path B (Defeat) | Path C (Cancel) |
|------|------------------|-----------------|-----------------|
| validate | 检查 battleEvent 非空 | 检查 battleEvent 非空 | 跳过 battleEvent 检查 |
| calculate | 完整伤亡计算 | 完整伤亡计算 | casualties = null |
| distribute | 发放奖励 + 道具 | rewards = null | rewards = null |
| notify | settlement:complete | settlement:complete | settlement:cancelled |

### 2.5 事件设计

```
settlement:complete   — 胜利/失败结算完成
settlement:cancelled  — 取消结算完成
settlement:reward     — 奖励已发放(仅胜利)
settlement:return     — 回城行军已创建
```

### 2.6 与现有系统的集成

SettlementPipeline 不替换现有系统，而是作为**编排层**统一调用：

```
SettlementPipeline
  ├── SiegeResultCalculator.calculateSettlement()  // 计算伤亡
  ├── SiegeEnhancer.calculateSiegeReward()          // 计算奖励
  ├── ExpeditionSystem.applyCasualties()            // 应用伤亡
  └── MarchingSystem.createReturnMarch()            // 创建回城
```

## 3. 实现计划

### Phase 1 (R13-T5, 当前)
- [x] 定义 `SettlementContext` 类型
- [x] 实现 `SettlementPipeline` 类
- [x] 集成 Victory 路径
- [x] 编写架构验证测试(3条路径)

### Phase 2 (后续迭代)
- [ ] 在 SiegeTaskManager 中用 SettlementPipeline 替换分散的结算逻辑
- [ ] 将 Defeat/Cancel 路径也接入 Pipeline
- [ ] 添加道具掉落步骤到 distribute 阶段
- [ ] 性能监控和日志

## 4. 文件结构

```
engine/map/
  SettlementPipeline.ts          ← 新增: 统一结算流水线
  SiegeResultCalculator.ts       ← 已有: 伤亡计算(被Pipeline调用)
  SiegeBattleSystem.ts           ← 已有: 战斗引擎(产生battle:completed事件)
  SiegeEnhancer.ts               ← 已有: 奖励计算(被Pipeline调用)
  MarchingSystem.ts              ← 已有: 行军系统(被Pipeline触发回城)
  ExpeditionSystem.ts            ← 已有: 编队系统(被Pipeline应用伤亡)
  SiegeTaskManager.ts            ← 已有: 任务管理器(调用Pipeline)
```
