# Round 7 计划

> **迭代**: map-system
> **轮次**: Round 7
> **来源**: R6 `judge-ruling.md` DEFERRED items + PLAN.md I12 视觉渲染
> **日期**: 2026-05-04

## 本轮焦点

| 优先级 | 领域 | 来源 | 原因 |
|:------:|------|------|------|
| P1 | SiegeBattleAnimationSystem.destroy() + init() 幂等 | R6 C-01/C-06 DEFERRED | 技术债务：缺少生命周期清理和幂等守卫 |
| P1 | SiegeBattleSystem 集成到 WorldMapTab | R6 C-02 DEFERRED | SiegeBattleSystem 已实现但未接入 UI 层，攻城仍走旧同步路径 |
| P1 | BattleStartedEvent 扩展坐标字段 | R6 C-02 DEFERRED | 自动订阅处理器中 targetX/Y 硬编码为 0，接口缺少坐标字段 |
| P2 | 序列化保真度修复 | R6 C-05 SUSTAINED | completed 动画 linger 时间反序列化后重置 |
| P1 | PixelWorldMap 攻城动画 Canvas 渲染 | PLAN.md I12 | activeSiegeAnims prop 已透传但从未在渲染中使用 |
| P2 | WorldMapTab 组件测试 | R5e Judge J-06 | handleArrived/handleCancelled 集成测试缺失 |

## 详细任务分解

### Task 1: SiegeBattleAnimationSystem 生命周期修复 (P1, Small)

**问题**: `SiegeBattleAnimationSystem` 缺少 `destroy()` 方法，`init()` 不幂等，多次调用会累积事件监听器（R6 C-01/C-06）。

**计划**:
1. 在 `ISubsystem` 接口中添加可选 `destroy()` 方法：
   ```typescript
   interface ISubsystem {
     // ...existing...
     destroy?(): void;
   }
   ```
2. 在 `SiegeBattleAnimationSystem` 中实现 `destroy()`:
   - 存储两个 unsubscribe 函数（`battle:started` 和 `battle:completed` 的 off 回调）
   - `destroy()` 中调用所有 unsubscribe 函数
   - 清空 `animations` 和 `completedAtElapsedMs`
3. 为 `init()` 添加幂等守卫:
   ```typescript
   private _initialized = false;
   init(deps: ISystemDeps): void {
     if (this._initialized) return;
     this._initialized = true;
     // ...existing init logic...
   }
   ```
4. `reset()` 时重置 `_initialized = false`，允许重新初始化
5. 为 `SiegeBattleSystem` 也添加 `destroy()` 方法（清理 `activeBattles`）

**验证标准**: `destroy()` 正确取消所有事件监听；多次 `init()` 不累积监听器；测试覆盖 lifecycle: init → update → destroy

**涉及文件**:
- `src/games/three-kingdoms/core/types.ts` — ISubsystem 接口
- `src/games/three-kingdoms/engine/map/SiegeBattleAnimationSystem.ts`
- `src/games/three-kingdoms/engine/map/SiegeBattleSystem.ts`

---

### Task 2: BattleStartedEvent 扩展坐标字段 (P1, Small)

**问题**: `BattleStartedEvent` 缺少 `targetX`/`targetY`/`faction` 字段，导致 `SiegeBattleAnimationSystem.init()` 的自动订阅处理器中坐标硬编码为 0、阵营硬编码为 `'wei'`（R6 C-02）。

**计划**:
1. 扩展 `BattleStartedEvent` 接口:
   ```typescript
   export interface BattleStartedEvent {
     taskId: string;
     targetId: string;
     strategy: SiegeStrategyType;
     troops: number;
     maxDefense: number;
     estimatedDurationMs: number;
     // 新增字段
     targetX: number;
     targetY: number;
     faction: 'wei' | 'shu' | 'wu' | 'neutral';
   }
   ```
2. 更新 `SiegeBattleSystem.createBattle()` 参数和 emit 调用，传入 `targetX`/`targetY`/`faction`
3. 更新 `SiegeBattleAnimationSystem.init()` 自动订阅处理器，使用事件数据中的真实坐标和阵营：
   ```typescript
   this.deps.eventBus.on<BattleStartedEvent>('battle:started', (data) => {
     this.startSiegeAnimation({
       taskId: data.taskId,
       targetCityId: data.targetId,
       targetX: data.targetX,
       targetY: data.targetY,
       strategy: data.strategy,
       faction: data.faction,
       troops: data.troops,
     });
   });
   ```
4. 更新所有使用 `BattleStartedEvent` 的测试用例

**验证标准**: 自动订阅处理器不再有硬编码值；`BattleStartedEvent` 包含完整位置和阵营信息；所有测试通过

**涉及文件**:
- `src/games/three-kingdoms/engine/map/SiegeBattleSystem.ts`
- `src/games/three-kingdoms/engine/map/SiegeBattleAnimationSystem.ts`
- `src/games/three-kingdoms/engine/map/__tests__/` 相关测试

---

### Task 3: SiegeBattleSystem 集成到 WorldMapTab (P1, Large)

**问题**: `WorldMapTab` 的攻城执行流仍使用旧同步路径 `siegeSystem.executeSiege()`，`SiegeBattleSystem` 从未实例化。`battle:started`/`battle:completed` 事件永远不会被 emit（R6 Judge Finding #1）。

**计划**:
1. 在 `WorldMapTab` 的 marching `useEffect` 中创建 `SiegeBattleSystem` 实例：
   ```typescript
   const siegeBattleSystem = new SiegeBattleSystem();
   siegeBattleSystem.init(mockDeps);
   ```
2. 替换 `handleArrived` 中的攻城执行逻辑:
   - 移除旧的 `siegeSystem.executeSiege()` 同步调用
   - 改为 `siegeBattleSystem.createBattle()` 创建异步战斗会话
   - 战斗会话由 rAF 循环中的 `siegeBattleSystem.update(dt)` 驱动
3. 将 `siegeBattleSystem.update(dt)` 添加到动画循环中
4. 监听 `battle:completed` 事件触发后续结算流程:
   - 计算伤亡
   - 设置攻城结果到 SiegeTaskManager
   - 创建回城行军
   - 显示结果弹窗
5. 清理 useEffect cleanup 中调用 `siegeBattleSystem.destroy()`
6. 同步移除手动调用 `startSiegeAnimation`/`completeSiegeAnimation` 的代码，改为通过事件自动触发

**验证标准**: `SiegeBattleSystem` 成为攻城执行的唯一入口；`battle:started`/`battle:completed` 事件正确触发；动画通过事件自动启动/完成

**涉及文件**:
- `src/components/idle/panels/map/WorldMapTab.tsx`

---

### Task 4: 序列化保真度修复 (P2, Small)

**问题**: `SiegeBattleAnimationSystem.deserialize()` 中 completed 动画的 `completedAtElapsedMs` 被设为当前 `totalElapsedMs`（反序列化时为 0），导致 linger 倒计时重置，每次加载都多等 2s（R6 C-05）。

**计划**:
1. 在 `SiegeBattleAnimSaveData` 的序列化格式中保存 completed 动画的已完成 linger 时间:
   ```typescript
   export interface CompletedLingerInfo {
     taskId: string;
     /** 已消耗的 linger 时间 (ms) */
     lingerElapsedMs: number;
   }

   export interface SiegeBattleAnimSaveData {
     version: number;
     animations: SiegeAnimationState[];
     /** 序列化时各 completed 动画已消耗的 linger 时间 */
     completedLinger?: CompletedLingerInfo[];
   }
   ```
2. `serialize()` 中保存每个 completed 动画的已消耗 linger:
   ```typescript
   const completedLinger: CompletedLingerInfo[] = [];
   for (const [taskId, completedAt] of this.completedAtElapsedMs) {
     completedLinger.push({
       taskId,
       lingerElapsedMs: this.totalElapsedMs - completedAt,
     });
   }
   ```
3. `deserialize()` 中恢复时使用保存的 linger 而非重置:
   ```typescript
   if (anim.phase === 'completed' && lingerInfo) {
     this.completedAtElapsedMs.set(anim.taskId, this.totalElapsedMs - lingerInfo.lingerElapsedMs);
   }
   ```
4. 版本号不变（新增字段为 optional，向后兼容）

**验证标准**: 序列化 → 反序列化后 completed 动画的剩余 linger 时间与序列化前一致（误差 < 1s）

**涉及文件**:
- `src/games/three-kingdoms/engine/map/SiegeBattleAnimationSystem.ts`
- `src/games/three-kingdoms/engine/map/__tests__/` 相关测试

---

### Task 5: PixelWorldMap 攻城动画 Canvas 渲染 (P1, Medium)

**问题**: `PixelWorldMap` 接收 `activeSiegeAnims` prop 但从未在 Canvas 渲染循环中使用，注释标为 "用于未来的攻城动画渲染"（R6 C-03 / PLAN.md I12）。

**计划**:
1. 在 `PixelMapRenderer` 或 `PixelWorldMap` 的 Canvas 渲染循环中添加攻城动画绘制层
2. 绘制内容（基于 `SiegeAnimationState`）:
   - **城防血条**: 在目标城池上方绘制水平血条，颜色随 `defenseRatio` 变化（绿→黄→红）
   - **集结指示器**: `assembly` 阶段显示脉冲环效果
   - **策略特效标识**: 根据 `strategy` 显示不同图标/标记:
     - `forceAttack`: 剑形标记
     - `siege`: 包围环
     - `nightRaid`: 月牙标记
     - `insider`: 城门标记
   - **完成动画**: `completed` 阶段显示胜利/失败旗帜效果
3. 坐标转换: `targetX`/`targetY`（格子坐标）→ Canvas 像素坐标（使用已有的 grid→pixel 映射）
4. 阵营色使用 `faction` 字段映射到已有 `FACTION_COLORS`
5. 渲染优先级: 攻城动画层在城池标记之上、行军精灵之下
6. 使用已有的 `renderTerrain` 渲染循环后追加 `renderSiegeAnimations` 调用

**验证标准**: 攻城动画在 Canvas 上可见；城防血条实时反映战斗进度；4 种策略有视觉差异；胜利/失败有不同表现

**涉及文件**:
- `src/components/idle/panels/map/PixelWorldMap.tsx`
- `src/games/three-kingdoms/engine/map/PixelMapRenderer.ts`（可能需要添加 siege 渲染方法）

---

### Task 6: WorldMapTab 组件测试 (P2, Medium)

**问题**: `WorldMapTab` 缺少 `handleArrived`/`handleCancelled` 的集成测试（R5e Judge J-06）。

**计划**:
1. 创建 `src/components/idle/panels/map/__tests__/WorldMapTab.integration.test.tsx`
2. 测试场景:
   - **handleArrived 正常流程**: 行军到达 → 启动战斗 → 战斗完成 → 回城创建
   - **handleArrived 无关联任务**: 行军到达但无 siegeTaskId → 仅更新 UI
   - **handleArrived 回城到达**: 返回行军到达己方城市 → 任务推进到 completed
   - **handleCancelled 正常流程**: 行军取消 → 关联任务推进到 completed 并清理
   - **handleCancelled 无关联任务**: 行军取消但无 siegeTaskId → 静默忽略
   - **组件卸载清理**: mount → unmount 后无残留监听器
3. 使用 `@testing-library/react` 的 `render` + `act`
4. Mock `MarchingSystem`、`SiegeBattleSystem`、`SiegeTaskManager`
5. 验证事件触发后的状态变化

**验证标准**: >= 6 个测试场景全部通过；覆盖 handleArrived/handleCancelled 的正常和边界路径

**涉及文件**:
- `src/components/idle/panels/map/__tests__/WorldMapTab.integration.test.tsx`（新建）

---

## 对抗性评测重点

- [ ] `destroy()` 是否正确取消所有事件监听（C-01 验证）
- [ ] `init()` 幂等性：多次调用是否只注册一组监听器（C-06 验证）
- [ ] `BattleStartedEvent` 是否包含 targetX/targetY/faction（C-02 验证）
- [ ] 自动订阅处理器是否使用事件数据中的真实坐标（C-02 验证）
- [ ] `SiegeBattleSystem` 是否成为攻城执行的唯一入口（集成正确性）
- [ ] battle:completed 事件触发后结算链是否完整（伤亡→结果→回城→弹窗）
- [ ] 序列化/反序列化后 completed 动画 linger 时间是否保持（C-05 验证）
- [ ] PixelWorldMap Canvas 上攻城动画是否正确渲染（I12 视觉验证）
- [ ] 攻城动画坐标是否与城池位置对齐（坐标转换正确性）
- [ ] WorldMapTab 组件测试覆盖 handleArrived/handleCancelled（J-06 验证）
- [ ] SiegeBattleAnimationSystem lifecycle: init → update → destroy 无资源泄漏
- [ ] 多个攻城任务并发时动画状态是否隔离（并发攻击）

## 质量目标

| 指标 | 目标 |
|------|------|
| P0 | 0 |
| P1 | 0（含 R6 DEFERRED C-01/C-02/C-06） |
| P2 | 0（含 R6 SUSTAINED C-05） |
| 测试通过率 | 100% |
| 新增单元测试 | >= 8 场景（lifecycle + serialization + event fields） |
| 新增集成测试 | >= 6 场景（WorldMapTab integration） |
| destroy() 覆盖 | SiegeBattleSystem + SiegeBattleAnimationSystem 均实现 |
| init() 幂等 | SiegeBattleAnimationSystem 多次调用安全 |
| BattleStartedEvent 字段 | 含 targetX/targetY/faction |
| activeSiegeAnims 渲染 | Canvas 上可见攻城动画 |

## 风险评估

| 风险 | 概率 | 影响 | 缓解措施 |
|------|:----:|:----:|----------|
| SiegeBattleSystem 集成改变攻城时序 | 中 | 高 | 保持 SiegeTaskManager 作为中间层；先加 destroy/init 修复再集成；逐步替换 |
| Canvas 渲染性能影响 60fps | 低 | 中 | 攻城动画数量少（通常 0-2 个）；仅在动画存在时绘制 |
| 序列化格式变更影响存档兼容 | 低 | 中 | 新增字段为 optional；版本号不变；缺少字段时 fallback 到旧行为 |
| WorldMapTab 组件测试 mock 复杂度高 | 中 | 低 | 聚焦 handleArrived/handleCancelled 两个回调的测试；避免完整组件渲染 |

## 与 PLAN.md 对齐

本轮完成后 PLAN.md 预期状态变化:

| 功能 | 当前状态 | R7 预期 |
|------|:--------:|:--------:|
| I12 行军→攻占动画无缝切换 | 🔄 | 🔄(引擎完成，集成+渲染完成) |
| I13 攻占战斗回合制 | 🔄 | 🔄(集成到 WorldMapTab) |
| R6 C-01 destroy() 方法 | DEFERRED | ✅ |
| R6 C-02 BattleStartedEvent 坐标字段 | DEFERRED | ✅ |
| R6 C-05 序列化保真度 | LOW | ✅ |
| R6 C-06 init() 幂等 | LOW | ✅ |
| D3-1 像素地图渲染60fps | 🔄 | 🔄 |
| WorldMapTab 组件测试 | ⬜ | ✅ |

## 实施优先序

```
Phase 1 — R6 技术债务清理（必须，无功能依赖）
  Task 1 (P1, Small)   → destroy() + init() 幂等
  Task 2 (P1, Small)   → BattleStartedEvent 扩展
  Task 4 (P2, Small)   → 序列化保真度修复

Phase 2 — SiegeBattleSystem 集成（核心，依赖 Task 1/2）
  Task 3 (P1, Large)   → WorldMapTab 攻城执行流替换

Phase 3 — 视觉渲染 + 测试（依赖 Task 3）
  Task 5 (P1, Medium)  → PixelWorldMap Canvas 渲染
  Task 6 (P2, Medium)  → WorldMapTab 组件测试
```

---

*Round 7 计划 | 2026-05-04*
