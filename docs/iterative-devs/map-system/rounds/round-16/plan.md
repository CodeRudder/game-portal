# Round 16 迭代计划

> **日期**: 2026-05-04
> **迭代周期**: 第16轮 -- Enhancement + P2 Fix Phase
> **前置条件**: R15 已完成攻城渲染流水线修复 (黑屏/时序/死代码), P0/P1 清零
> **内部循环目标**: <= 2

## 1. R16 主题

**功能增强 + P2 遗留修复 + PLAN.md 功能推进**

R16 聚焦于四个方向:
1. **I11 Enhancement**: 实现行军精灵持续时间约束 (min 10s, max 60s) -- PRD 新需求
2. **P2 Fix**: Terrain dirty flag 优化 (transition-frame-only 标记)
3. **P2 Fix**: 真实子系统集成测试 (减少 mock 依赖)
4. **PLAN.md 功能推进**: E1-3, I3, I10, I11, I4 功能实现 + 完成率追踪

## 2. R15 遗留问题清单

| ID | 问题 | 优先级 | 来源 | 本轮处理 |
|----|------|:------:|------|---------|
| R16-I1 | Terrain 性能优化: transition-frame-only dirty marking | P2 | R15 A1/A2 | Task 1 |
| R16-I2 | 集成测试: 补充真实子系统交互测试 | P2 | R15 A8 | Task 3 |
| R16-I3 | EventBus.once 实现: 逐个删除 handler | P3 | R15 A4 | 延后 |
| R16-I4 | 行军精灵持续时间约束 (min 10s, max 60s) | P2 | PRD 新需求 | Task 2 |
| R16-I5 | PLAN.md 剩余功能推进 | P3 | PLAN.md | Task 4 |
| R16-I6 | mapInjuryData 硬编码 recoveryHours | P2 | R14 遗留 | Task 5 |
| R16-I7 | InjuryLevel 映射位置优化 | P2 | R14 遗留 | Task 5 |

## 3. 任务计划

### Task 1 (P2): Terrain Dirty Flag 优化

**目标**: 将 terrain dirty 标记策略从 "每帧标记" 优化为 "仅在转换帧标记"

**背景**: R15 Task 1 为修复黑屏添加了 `if (flags.sprites || flags.effects) { flags.terrain = true; }`, 导致动画期间 (sprites/effects 持续 dirty) terrain 每帧重绘. 动画 60fps 运行 5s = 300 帧, terrain 重绘 300 次, 而实际只需在 transition 帧重绘 2 次.

**方案**:
```typescript
// 当前 (R15): 每帧标记 terrain dirty -- 性能不优
if (flags.sprites || flags.effects) {
  flags.terrain = true;
}

// 优化后 (R16): 仅在 transition frame 标记
const prevSprites = prevFlagsRef.current.sprites;
const prevEffects = prevFlagsRef.current.effects;
const spritesTransition = prevSprites !== flags.sprites;
const effectsTransition = prevEffects !== flags.effects;
if (spritesTransition || effectsTransition) {
  flags.terrain = true;
}
prevFlagsRef.current = { sprites: flags.sprites, effects: flags.effects };
```

**影响范围**: `PixelWorldMap.tsx` animate() 渲染循环 (~line 1054)
**新增测试**: >= 4 个 (transition detection / 静态帧 no redraw / 行军添加移除 / 多次 transition 计数)
**验证**: terrain-persist 测试仍通过 + 地形在攻城全过程中仍然可见 (无黑屏回归)

### Task 2 (P2): 行军精灵持续时间约束 (I11 Enhancement)

**目标**: 实现行军动画时长 min 10s / max 60s 约束, 符合 PRD 新需求

**背景**: R15 已将行军精灵持续时间约束写入 PRD 和 flow 文档 (min 10s, max 60s), R16 负责代码实现.

**实现要点**:
- 行军精灵创建时计算实际动画持续时间
- 若计算时长 < 10s, 强制使用 10s 最小值 (短距离行军)
- 若计算时长 > 60s, 强制使用 60s 最大值 (长距离行军)
- 在 `SiegeBattleAnimationSystem.startSiegeAnimation()` 或 `PixelWorldMap` march sprite 创建逻辑中应用约束
- 使用 `clamp(duration, MIN_MARCH_DURATION, MAX_MARCH_DURATION)` 模式

**影响范围**: `PixelWorldMap.tsx` march sprite 创建 / `SiegeBattleAnimationSystem.ts` 动画时长
**新增测试**: >= 4 个 (短距离 clamp / 长距离 clamp / 正常范围不 clamp / 边界值)
**验证**: 行军精灵动画时长在 [10s, 60s] 范围内

### Task 3 (P2): 真实子系统集成测试

**目标**: 补充关键路径的真实子系统集成测试, 减少 mock 依赖

**背景**: R15 A3 (Mock 断裂 P0) 和 A8 (集成验证缺失 P2) 暴露了重度 mock 策略的风险. R15 F-02 已新增 siege-animation-chain.integration.test.ts, R16 进一步扩展.

**测试用例** (使用真实 EventBus + 真实 SiegeBattleSystem + 真实 SiegeBattleAnimationSystem):
1. 完整链路: createBattle -> battle:started -> startSiegeAnimation -> completeSiegeAnimation -> siegeAnim:completed
2. cancelBattle 后 battle:completed 不再触发
3. 多 battle 并发时各自独立触发 siegeAnim:completed
4. siegeAnim:completed payload 完整性 (taskId, targetCityId, victory)
5. 动画阶段转换 (assembly -> battle -> completion)

**影响范围**: 新增/扩展集成测试文件
**新增测试**: >= 5 个
**验证**: 使用真实 EventBus (非 mock emit/once); 已有引擎测试不回归

### Task 4: PLAN.md 功能推进 + 完成率追踪

**目标**: 推进 Top 5 优先功能并更新 PLAN.md 完成率

**Top 5 优先功能**:

| 优先级 | 功能 ID | 功能名称 | 预计工作 |
|--------|---------|---------|---------|
| 1 | E1-3 | 行军→攻占 E2E 集成 | 引擎层完整行军生命周期测试 |
| 2 | I3 | 攻城锁定机制 | 同一城市攻城锁定/排队逻辑 |
| 3 | I10 | 攻占任务面板 | SiegeTaskPanel 实时状态跟踪增强 |
| 4 | I11 | 行军精灵交互 | 点击精灵聚焦/查看详情 |
| 5 | I4 | 攻城中断 | 中途取消攻城任务 |

**PLAN.md 更新内容**:
- 标记 R16 完成的功能项
- 更新 I 系列完成数
- 更新总完成率 (目标 >= 87%)
- 添加 R17 计划
- 更新迭代行状态: R16: ⬜ -> ✅

### Task 5: R14 遗留 P2 清理

**目标**: 清理 R14 遗留的两个 P2 问题

**5a. mapInjuryData recoveryHours 配置来源修正**:
- 当前: WorldMapTab 中硬编码 recoveryHours (minor: 2h, moderate: 6h, severe: 24h)
- 目标: 从引擎层 CasualtyCalculator 配置读取
- 影响: `WorldMapTab.tsx` mapInjuryData 函数

**5b. InjuryLevel 映射位置优化**:
- 当前: InjuryLevel 枚举映射 (engine minor -> UI light) 在 WorldMapTab 中定义
- 目标: 移至 shared 层或引擎层
- 影响: `WorldMapTab.tsx` mapInjuryLevel 函数 + 新增 shared 类型文件

**新增测试**: >= 3 个
**验证**: WorldMapTab 中无硬编码 recoveryHours; InjuryLevel 映射在 shared 层定义

## 4. 质量目标

| 指标 | 目标 | 来源 |
|------|------|------|
| P0 问题 | 0 | R15 遗留: 0, 目标维持 |
| P1 问题 | 0 | R15 遗留: 0, 目标维持 |
| P2 问题 | <= 2 | 处理 4 个 P2, 目标修复至少 2 个 |
| 测试通过率 | 100% | 持续保持 |
| 新增测试 | >= 16 | Task 1(4) + Task 2(4) + Task 3(5) + Task 5(3) |
| 集成测试占比 | >= 20% | 减少 mock 依赖 |
| PLAN.md 完成率 | >= 87% | 从 85% (55/65) 提升 |
| 渲染性能 WARN | 0 | Task 1 修复 terrain 性能 |
| TypeScript 错误 | 0 新增 | tsc --noEmit 检查 |

## 5. R15 经验教训

### Mock 保真度改进

**A3 教训**: Mock SiegeBattleAnimationSystem.init() 未注册 battle:started 监听器, 导致核心路径完全未被测试. 生产代码正确但测试无效.

**改进措施**: 每新增或修改 mock 时, 对照以下检查清单:
1. Mock init() 是否注册了与真实实现相同的事件监听器?
2. Mock 方法签名是否与真实实现一致?
3. Mock 状态管理 (Map, Set, etc.) 是否与真实实现一致?
4. 是否有仅靠 mock 无法发现的逻辑错误?
5. **是否可以用真实系统替代 mock?** (优先使用真实系统)

### 集成测试策略改进

**A6/A8 教训**: 重度 mock 无法验证真实子系统交互. cancelBattle→completeSiegeAnimation 链路缺少集成测试.

**改进措施**:
- 优先使用真实子系统测试, 仅 mock 外部边界 (Canvas, DOM)
- 每 2 轮至少新增 1 个使用真实系统的端到端测试
- 关键链路 (battle:started -> siegeAnim:completed) 必须有真实系统测试覆盖

### 方案设计改进

**A1/A2 教训**: "大锤" 方案 (每帧强制 terrain dirty) 虽然正确但不优. 应在设计阶段考虑 transition-frame 精确方案.

**改进措施**: 方案设计时评估性能影响; 对高频调用路径 (渲染循环) 采用精确方案而非保守方案.

## 6. 对抗性评测重点

- [ ] **Terrain 性能**: 动画运行期间 terrain 仅在 transition frame (dirty 从 true->false 或 false->true) 时重绘
- [ ] **Terrain 性能**: 静态帧 (无动画无行军) terrain 完全不重绘 (dirty flag 为 false)
- [ ] **Terrain 性能**: 性能基准: 动画期间 terrain redraw 次数 <= transition 次数 + 1
- [ ] **行军精灵时长**: 短距离行军 (计算时长 < 10s) 实际动画时长 = 10s
- [ ] **行军精灵时长**: 长距离行军 (计算时长 > 60s) 实际动画时长 = 60s
- [ ] **行军精灵时长**: 正常范围行军 (10s <= 时长 <= 60s) 不受影响
- [ ] **集成测试**: 使用真实 EventBus + 真实 SiegeBattleSystem + 真实 SiegeBattleAnimationSystem
- [ ] **集成测试**: cancelBattle 后 SiegeBattleAnimationSystem.animations 不受影响
- [ ] **集成测试**: siegeAnim:completed 事件 payload 包含正确的 taskId/targetCityId/victory
- [ ] **Builder 交付门禁**: 必须报告全部已有测试套件运行结果, 测试总数 >= 2176
- [ ] **TypeScript 门禁**: `tsc --noEmit` 零新增错误

## 7. 实施优先序

```
Phase 1 -- 性能优化 + PRD 新需求
  Task 1 (P2)  -> Terrain transition-frame dirty 优化
  Task 2 (P2)  -> 行军精灵持续时间约束 (I11 Enhancement)

Phase 2 -- 测试质量提升
  Task 3 (P2)  -> 真实子系统集成测试

Phase 3 -- P2 清理 + 文档 (弹性范围)
  Task 4 (P3)  -> PLAN.md 更新 + 功能推进
  Task 5 (P2)  -> R14 遗留 P2 清理
```

## 8. 内部循环规划

| 子轮次 | 内容 | 预期 |
|--------|------|------|
| 16.1 | Task 1-5 实现 + 对抗性评测 (Builder/Challenger/Judge) | P0/P1 清零 |
| 16.2 | 修复对抗性评测发现的问题 (如有) | P0/P1 清零 |
| 验收 | 全量测试 + PLAN.md 更新 | 100% 通过 |

## 9. 风险评估

| 风险 | 概率 | 影响 | 缓解措施 |
|------|:----:|:----:|----------|
| Task 1: transition-frame dirty 导致黑屏回归 | 低 | 高 | 保留首帧 dirty 联动; 充分测试 transition 场景; terrain-persist 回归测试 |
| Task 2: 行军精灵时长约束影响现有动画 | 中 | 中 | 10s min 仅对短距离行军有影响; 60s max 对长距离行军有效; 需调整行军速度公式 |
| Task 3: 真实系统集成测试环境配置复杂 | 中 | 低 | R15 F-02 已建立集成测试框架; R16 复用并扩展 |
| Task 4: PLAN.md Top 5 功能范围过大 | 高 | 中 | 按优先级排序; R16 至少完成 E1-3 + I11; 其余移交 R17 |
| Task 5: InjuryLevel 映射重构导致 import 变更 | 低 | 低 | 映射逻辑不变, 仅移动位置; 回归测试覆盖 |

## 10. 跨轮趋势参考 (R12-R16 目标)

| 指标 | R12 | R13 | R14 | R15 | R16 目标 | 趋势 |
|------|:---:|:---:|:---:|:---:|:-------:|:----:|
| 测试通过率 | 100% | 100% | 100% | 100% | 100% | STABLE |
| P0 问题 | 0 | 0 | 2->0 | 1->0 | 0 | 维持 |
| P1 问题 | 0 | 1->0 | 4->0 | 1->0 | 0 | 维持 |
| P2 问题 | 5 | 8 | 3 | 2 | <= 2 | 收敛 |
| 对抗性发现 | 22 | 12 | 9 | 8 | <= 6 | 收敛 |
| 内部循环次数 | 1 | 1 | 2 | 2 | <= 2 | 稳定 |
| PLAN.md 完成率 | 82% | 90% | 80% | 85% | >= 87% | 推进 |
| 渲染性能 WARN | 0 | 2 | 1 | 1 | 0 (Task 1) | 修复 |
| 死代码路径 | 1 | 0 | 0 | 0 | 0 | 维持 |

> R15 核心成果: 黑屏 P0 修复 + 动画时序 P0 修复 + EventBus.once bug 修复 + Mock 断裂修复 (F-01) + 集成测试补充 (F-02). R16 在此基础上: (1) 优化 terrain 性能消除渲染 WARN; (2) 实现 PRD 新需求 (行军精灵时长约束); (3) 补充真实子系统集成测试; (4) 推进 PLAN.md Top 5 功能.

---

*Round 16 迭代计划 | 2026-05-04*
