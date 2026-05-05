# Round 8 计划

> **迭代**: map-system
> **轮次**: Round 8
> **来源**: `PLAN.md` + Round 7 `judge-ruling.md`
> **日期**: 2026-05-04

## 本轮焦点

| 优先级 | 领域 | 来源 | 原因 |
|:------:|------|------|------|
| P0 | R7 P0-1 destroy遗漏修复 | R7 Judge | siegeBattleAnimSystem.destroy() 在 cleanup 中遗漏，导致事件监听器泄漏 |
| P0 | R7 P0-2 defenseRatio断链修复 | R7 Judge | updateBattleProgress() 从未被生产代码调用，城防血条永远满血 |
| P1 | R7 P1-1 集成测试缺失 | R7 Judge | SiegeBattleSystem↔AnimationSystem→WorldMapTab 零集成测试 |
| P1 | R7 P1-3 事件链未验证 | R7 Judge | EventBus mock 导致跨系统事件桥接从未在测试中验证（与 P1-1 合并处理） |
| P2 | R7 P1-2→P2 Canvas零测试 | R7 Judge | Canvas渲染层无测试，降级为 P2 |
| P2 | R7 P2-1 destroy/reset冗余 | R7 Judge | SiegeBattleSystem.destroy() 与 reset() 实现相同 |
| P1 | I14 攻占结果结算与事件生成 | PLAN.md MAP-F06-14 | 新功能：伤亡计算+将领受伤+奖励发放+事件记录 |
| P1 | I15 编队伤亡状态更新+自动回城 | PLAN.md MAP-F06-15 | 新功能：编队状态刷新+自动回城行军+到达处理 |

## 详细任务分解

### Phase 1: R7 P0 修复 (Task 1-2)

#### Task 1: siegeBattleAnimSystem.destroy() cleanup 遗漏修复 (P0, Trivial)

**问题**: WorldMapTab.tsx useEffect cleanup 中调用了 `siegeBattleSystem.destroy()` 但完全遗漏了 `siegeBattleAnimSystem.destroy()`，导致 `battle:started` 和 `battle:completed` 两个事件监听器不被移除，且 `siegeBattleAnimRef.current` 未置 null（R7 Judge P0-1）。

**计划**:
1. 在 WorldMapTab.tsx 的 useEffect cleanup return 函数中，补充两行：
   ```typescript
   siegeBattleAnimSystem.destroy();
   siegeBattleAnimRef.current = null;
   ```
2. 验证：SiegeBattleAnimationSystem 的两个事件监听器在 cleanup 后被正确取消

**验证标准**: cleanup 执行后 siegeBattleAnimRef.current === null；SiegeBattleAnimationSystem._initialized === false；animations Map 为空

**涉及文件**:
- `src/components/idle/panels/map/WorldMapTab.tsx` — cleanup return 函数

---

#### Task 2: defenseRatio 桥接缺失修复 (P0, Small)

**问题**: SiegeBattleSystem.update(dt) 内部正确衰减 defenseValue，但这个值没有桥接到 SiegeBattleAnimationSystem.updateBattleProgress()，导致 anim.defenseRatio 永远为初始值 1.0，城防血条永远显示满血（R7 Judge P0-2）。

**计划**:
1. 在 WorldMapTab.tsx 的 rAF 循环中（siegeBattleSystem.update(dt) 与 siegeBattleAnimSystem.update(dt) 之间），添加桥接代码：
   ```typescript
   // 桥接: 将 SiegeBattleSystem 的 defenseValue 同步到 SiegeBattleAnimationSystem
   const activeBattles = siegeBattleSystem.getState().activeBattles;
   for (const battle of activeBattles) {
     if (battle.maxDefense > 0) {
       siegeBattleAnimSystem.updateBattleProgress(
         battle.taskId,
         battle.defenseValue / battle.maxDefense
       );
     }
   }
   ```
2. 验证：战斗过程中 defenseRatio 从 1.0 逐步递减至 0；PixelWorldMap 城防血条颜色从绿到黄到红变化

**验证标准**: updateBattleProgress() 在每帧被生产代码调用；defenseRatio 在战斗全程实时反映城防进度

**涉及文件**:
- `src/components/idle/panels/map/WorldMapTab.tsx` — rAF 循环

---

### Phase 2: R7 P1 集成测试 (Task 3)

#### Task 3: SiegeBattleSystem↔AnimationSystem 集成测试 (P1, Medium)

**问题**: R7 Phase 2 的 5 个集成点全靠"代码审查"验证，零自动化测试。SiegeBattleSystem 与 SiegeBattleAnimationSystem 之间的事件桥接从未在测试中被验证。EventBus 在测试中被 mock，真实事件链路未覆盖（R7 Judge P1-1 + P1-3）。

**计划**:
1. 创建集成测试文件 `src/games/three-kingdoms/engine/map/__tests__/integration/siege-battle-chain.integration.test.ts`
2. 使用**真实 EventBus**（不 mock），连接 SiegeBattleSystem + SiegeBattleAnimationSystem
3. 测试场景：
   - **场景 A — 完整生命周期**: createBattle() -> battle:started -> AnimationSystem 自动启动动画 -> update(dt) 多帧直到战斗完成 -> battle:completed -> AnimationSystem 自动完成动画 -> destroy() 两个系统 -> 验证事件监听器全部移除
   - **场景 B — defenseRatio 桥接验证**: createBattle() -> 循环 update(dt) -> 每帧检查 getBattle().defenseValue 衰减 -> 调用 updateBattleProgress() -> 验证 anim.defenseRatio 同步递减 -> 最终 battle:completed 时 anim.phase === 'completed'
   - **场景 C — 多任务并发**: createBattle() 两次（不同 taskId）-> update(dt) -> 验证两个动画状态独立 -> 一个完成不影响另一个
   - **场景 D — cancelBattle 中断**: createBattle() -> update(dt) 一帧 -> cancelBattle() -> 验证 battle:cancelled 事件触发 -> AnimationSystem 中对应动画被清除
4. 验证事件名和数据字段完全匹配

**验证标准**: >= 4 个集成测试场景全部通过；使用真实 EventBus；覆盖完整事件链 createBattle -> battle:started -> animation start -> update -> battle:completed -> animation complete -> destroy

**涉及文件**:
- `src/games/three-kingdoms/engine/map/__tests__/integration/siege-battle-chain.integration.test.ts`（新建）

---

### Phase 3: R7 P2 修复与 Canvas 基础测试 (Task 4-5)

#### Task 4: SiegeBattleSystem destroy()/reset() 语义统一 (P2, Trivial)

**问题**: SiegeBattleSystem.destroy() 与 reset() 实现完全相同（均为 `this.activeBattles.clear()`），语义不清晰（R7 Judge P2-1）。

**计划**:
1. 将 `destroy()` 改为委托调用 `reset()`：
   ```typescript
   destroy(): void {
     this.reset();
   }
   ```
2. 添加 JSDoc 注释说明 destroy 语义上是"释放资源并重置"，当前实现与 reset 等价是因为 SiegeBattleSystem 不订阅事件

**验证标准**: destroy() 内部调用 reset()；现有 28 个 SiegeBattleSystem 测试全部通过

**涉及文件**:
- `src/games/three-kingdoms/engine/map/SiegeBattleSystem.ts`

---

#### Task 5: Canvas 渲染基础测试 (P2, Medium)

**问题**: PixelWorldMap 的 renderAssemblyPhase、renderBattlePhase、renderCompletedPhase、renderSiegeAnimationOverlay 无任何测试（R7 Judge P1-2->P2 降级）。

**计划**:
1. 创建测试文件 `src/components/idle/panels/map/__tests__/PixelWorldMap.siege-render.test.tsx`
2. Mock CanvasRenderingContext2D，验证关键函数调用：
   - **renderAssemblyPhase**: 验证 ctx.arc（脉冲环）被调用、globalAlpha 脉冲值在 [0, 1] 范围
   - **renderBattlePhase**: 验证 ctx.fillRect（城防血条）被调用、血条宽度与 defenseRatio 成正比、颜色值随 ratio 变化
   - **renderCompletedPhase**: 验证胜利/失败分支渲染不同内容
   - **renderSiegeAnimationOverlay**: 验证 ctx.save/restore 配对调用
3. 不测试精确像素值，只测试函数调用和参数合理性

**验证标准**: >= 4 个测试场景；覆盖 4 种渲染函数的基本调用路径；测试全部通过

**涉及文件**:
- `src/components/idle/panels/map/__tests__/PixelWorldMap.siege-render.test.tsx`（新建）

---

### Phase 4: I14 攻占结果结算与事件生成 (Task 6-7)

#### Task 6: 实现 SiegeResultCalculator (P1, Medium)

**问题**: `PLAN.md` I14 — 攻占结果结算与事件生成（MAP-F06-14）。战斗结束后需要计算伤亡、将领受伤概率、奖励发放、生成事件记录。目前 `BattleCompletedEvent` 仅包含基础信息，缺少伤亡计算和事件生成逻辑。

**参考规格** (flows.md MAP-F06-14):

| 结果 | 士兵损失 | 将领受伤概率 |
|------|---------|------------|
| 大胜 | 10%~20% | 5%(仅轻伤) |
| 胜利 | 20%~30% | 15%(轻伤/中伤) |
| 险胜 | 30%~40% | 30%(中伤/重伤) |
| 失败 | 40%~70% | 50%(中伤/重伤) |
| 惨败 | 80%+ | 80%(重伤) |

**计划**:
1. 创建 `src/games/three-kingdoms/engine/map/SiegeResultCalculator.ts`
2. 定义类型：
   ```typescript
   /** 战斗结果等级（基于城防剩余比例 + 战斗时长） */
   type BattleOutcome = 'decisiveVictory' | 'victory' | 'narrowVictory' | 'defeat' | 'rout';

   /** 攻占结算结果 */
   interface SiegeSettlementResult {
     outcome: BattleOutcome;
     victory: boolean;
     troopsLost: number;
     troopsLostPercent: number;
     heroInjured: boolean;
     injuryLevel: InjuryLevel;
     /** 奖励明细 */
     rewards: SiegeReward[];
     /** 结果事件数据 */
     eventData: SiegeResultEventData;
   }

   /** 攻占结果事件数据 */
   interface SiegeResultEventData {
     attacker: string;
     defender: string;
     targetId: string;
     outcome: BattleOutcome;
     casualties: CasualtyResult;
     rewards: SiegeReward[];
     timestamp: number;
   }
   ```
3. 实现 `SiegeResultCalculator` 类：
   - `calculateSettlement(battleCompletedEvent, context)` — 核心结算方法
   - `determineOutcome(victory, remainingDefenseRatio, elapsedRatio)` — 判定战斗结果等级
   - `calculateTroopLoss(outcome, troops)` — 士兵伤亡计算（使用 CASUALTY_RATES 配置）
   - `rollHeroInjury(outcome, rng)` — 将领受伤概率判定（使用 HERO_INJURY_RATES 配置）
   - `generateRewards(outcome, targetLevel, isFirstCapture)` — 奖励生成（复用 SiegeRewardProgressive）
   - `createEvent(result, context)` — 生成事件记录
4. 判定规则：
   - 胜利 + remainingDefenseRatio < 0.1 + elapsedRatio < 0.7 -> 大胜
   - 胜利 + remainingDefenseRatio < 0.3 -> 胜利
   - 胜利（其他）-> 险胜
   - 失败（城防未耗尽但超时）-> 失败
   - 失败 + troops 损失 > 50% -> 惨败
5. 与现有类型对齐：复用 `expedition-types.ts` 中的 `CasualtyResult`、`CASUALTY_RATES`、`HERO_INJURY_RATES`

**验证标准**: 纯函数计算，无状态依赖；结果等级判定可测试；伤亡计算在配置范围内；将领受伤概率符合规格

**涉及文件**:
- `src/games/three-kingdoms/engine/map/SiegeResultCalculator.ts`（新建）
- `src/games/three-kingdoms/engine/map/expedition-types.ts` — 复用现有类型

---

#### Task 7: I14 集成到 battle:completed 流程 + 测试 (P1, Medium)

**问题**: SiegeResultCalculator 需要集成到 WorldMapTab 的 battle:completed 处理流程中，替换当前的占位逻辑。

**计划**:
1. 在 WorldMapTab.tsx 的 battle:completed 事件处理器中，调用 SiegeResultCalculator：
   ```typescript
   // 在 battle:completed handler 中：
   const settlement = siegeResultCalculator.calculateSettlement(event, {
     targetLevel: territory?.level ?? 1,
     isFirstCapture: !territory?.previousOwner,
   });
   // 保存结果到 SiegeTaskManager
   siegeTaskManager.setResult(taskId, {
     victory: settlement.victory,
     outcome: settlement.outcome,
     troopsLost: settlement.troopsLost,
     heroInjured: settlement.heroInjured,
     injuryLevel: settlement.injuryLevel,
     rewards: settlement.rewards,
   });
   // 推进任务状态: sieging -> settling
   siegeTaskManager.advanceStatus(taskId, 'settling');
   ```
2. 创建 SiegeResultCalculator 单元测试：
   - 每个 outcome 的正确判定
   - 伤亡计算边界值
   - 将领受伤概率统计验证（大样本蒙特卡罗）
   - 奖励生成正确性
3. 创建集成测试：battle:completed -> calculateSettlement -> setResult -> advanceStatus 完整链路

**验证标准**: SiegeResultCalculator 单元测试 >= 8 个场景；集成测试 >= 1 个；所有测试通过

**涉及文件**:
- `src/games/three-kingdoms/engine/map/__tests__/SiegeResultCalculator.test.ts`（新建）
- `src/components/idle/panels/map/WorldMapTab.tsx` — battle:completed handler

---

### Phase 5: I15 编队伤亡状态更新+自动回城 (Task 8-9)

#### Task 8: 实现编队状态更新与自动回城行军 (P1, Large)

**问题**: `PLAN.md` I15 — 编队伤亡状态更新+自动回城（MAP-F06-15）。战斗结算后需要更新编队状态（伤亡/受伤将领标记），并创建自动回城行军。

**参考规格** (flows.md MAP-F06-15):
- 编队状态更新：血条颜色、将领受伤标记、战力重新计算
- 回城行军：速度 = 出发速度 x 0.8，精灵按剩余兵力计算，沿原路返回
- 到达处理：兵力归入城市池、受伤将领开始恢复、编队销毁、任务面板到已完成

**计划**:
1. 在 `src/games/three-kingdoms/engine/map/ExpeditionSystem.ts` 中添加方法：
   - `applyCasualties(forceId, troopsLost, heroInjured, injuryLevel)` — 应用伤亡到编队
   - `calculateRemainingPower(forceId)` — 重新计算编队战力（基础战力 x (1-伤亡比例) x (1-受伤减益)）
   - `getForceHealthColor(troopsLostPercent)` — 血条颜色判定（<30% 绿 / 30-60% 黄 / >60% 红）
2. 在 WorldMapTab.tsx 中添加回城流程：
   - battle:completed -> calculateSettlement -> applyCasualties
   - 从 SiegeTask 获取 marchPath，反转作为回城路线
   - 调用 MarchingSystem.createMarch() 创建回城行军，速度 x 0.8
   - 推进 SiegeTaskManager 状态: settling -> returning
   - 监听回城行军到达事件（march:arrived + 回城标记）
   - 回城到达后：兵力归入城市池、受伤将领开始恢复倒计时、编队销毁
   - 推进状态: returning -> completed
3. 回城到达处理函数 `handleReturnArrived`:
   ```typescript
   function handleReturnArrived(data) {
     // 1. 剩余兵力归入出发城市兵力池
     // 2. 受伤将领开始恢复（记录受伤时间 + 恢复时间）
     // 3. 编队对象销毁 (ExpeditionSystem.removeForce)
     // 4. 将领状态更新为"可用"（受伤将领为"恢复中"）
     // 5. 任务面板状态 -> completed
   }
   ```

**验证标准**: 编队伤亡后状态正确更新；回城行军速度为出发速度的 80%；回城路线为原路反转；到达后兵力归入城市、将领恢复、编队销毁、任务完成

**涉及文件**:
- `src/games/three-kingdoms/engine/map/ExpeditionSystem.ts` — 添加 applyCasualties 等方法
- `src/components/idle/panels/map/WorldMapTab.tsx` — battle:completed handler 扩展 + handleReturnArrived
- `src/games/three-kingdoms/engine/map/SiegeTaskManager.ts` — 状态链完整性验证

---

#### Task 9: I15 测试 (P1, Medium)

**问题**: 编队伤亡状态更新和自动回城需要完整的测试覆盖。

**计划**:
1. ExpeditionSystem 伤亡测试：
   - applyCasualties 正确更新 troops 和 heroInjured
   - calculateRemainingPower 战力计算正确（基础 x 存活比例 x 受伤减益）
   - getForceHealthColor 三档颜色判定边界值
   - 英雄受伤状态在 ExpeditionForce 中正确记录
2. 回城流程集成测试：
   - 战斗完成 -> 伤亡应用 -> 回城行军创建 -> 回城路线为原路反转 -> 速度 x 0.8
   - 回城到达 -> 兵力归入城市 -> 编队销毁 -> 任务状态 completed
   - 受伤将领恢复倒计时正确启动
3. 边界场景测试：
   - 全灭编队（100% 伤亡）-> troops = 0，回城行军仍创建但无兵力
   - 将领重伤 -> 恢复时间 = 24 小时（INJURY_RECOVERY_TIME.severe）
   - 无伤编队 -> 回城后编队正常销毁、将领立即可用

**验证标准**: >= 8 个测试场景；覆盖正常流程 + 边界场景；所有测试通过

**涉及文件**:
- `src/games/three-kingdoms/engine/map/__tests__/ExpeditionSystem.casualties.test.ts`（新建）
- `src/games/three-kingdoms/engine/map/__tests__/integration/return-march.integration.test.ts`（新建）

---

## 对抗性评测重点

- [ ] **P0-1 修复验证**: cleanup 执行后 siegeBattleAnimRef.current === null，SiegeBattleAnimationSystem._initialized === false
- [ ] **P0-2 修复验证**: 战斗全程 defenseRatio 从 1.0 递减至 0，城防血条颜色实时变化
- [ ] **集成测试覆盖**: SiegeBattleSystem 与 AnimationSystem 与 WorldMapTab 完整事件链有自动化测试
- [ ] **SiegeResultCalculator 正确性**: 每个 outcome 的伤亡范围和将领受伤概率符合 flows.md MAP-F06-14 规格
- [ ] **I14 集成链**: battle:completed -> calculateSettlement -> setResult -> advanceStatus('settling') 无断裂
- [ ] **编队伤亡一致性**: ExpeditionForce 状态与 CasualtyResult 数据一致
- [ ] **回城路线正确性**: 回城路径为原路反转，速度 x 0.8
- [ ] **回城到达完整性**: 兵力归入城市 + 将领恢复 + 编队销毁 + 任务 completed 四步全部执行
- [ ] **全灭边界**: 100% 伤亡时不崩溃，回城行军仍可创建
- [ ] **SiegeBattleSystem destroy() 委托**: destroy 内部调用 reset()，语义清晰
- [ ] **Canvas 渲染测试**: 至少验证函数调用和参数合理性

## 质量目标

| 指标 | 目标 |
|------|------|
| P0 | 0（R7 遗留 2 个 P0 必须修复） |
| P1 | 0 |
| P2 | 0 |
| 测试通过率 | 100% |
| 新增单元测试 | >= 16 场景（SiegeResultCalculator 8 + ExpeditionSystem.casualties 8） |
| 新增集成测试 | >= 6 场景（siege-battle-chain 4 + return-march 2） |
| R7 P0 修复 | 2/2 完成（destroy 遗漏 + defenseRatio 断链） |
| I14 交付 | SiegeResultCalculator + 集成到 battle:completed 流程 |
| I15 交付 | 编队伤亡更新 + 自动回城行军 + 到达处理 |

## 风险评估

| 风险 | 概率 | 影响 | 缓解措施 |
|------|:----:|:----:|----------|
| I14 伤亡计算与现有 CombatResolver 逻辑冲突 | 低 | 中 | SiegeResultCalculator 专注攻城结算，不复用山贼战斗公式；复用 expedition-types.ts 中的配置常量 |
| I15 回城行军速度计算依赖 MarchingSystem 内部参数 | 中 | 中 | 在 MarchingSystem 中暴露 `createReturnMarch()` 方法，封装速度 x 0.8 逻辑 |
| WorldMapTab battle:completed handler 逻辑膨胀 | 中 | 高 | 将结算+回城逻辑提取为独立函数/类，handler 只做调度 |
| 集成测试 mock 复杂度高 | 中 | 低 | 使用真实 EventBus + 真实系统实例，仅 mock 外部依赖（territory、hero 数据） |
| Canvas 测试 mock CanvasRenderingContext2D 工作量大 | 中 | 低 | 只验证函数调用和参数，不验证像素级渲染结果 |

## 与 PLAN.md 对齐

本轮完成后 PLAN.md 预期状态变化:

| 功能 | 当前状态 | R8 预期 |
|------|:--------:|:--------:|
| R7 P0-1 destroy 遗漏 | P0 | done |
| R7 P0-2 defenseRatio 断链 | P0 | done |
| R7 P1-1 集成测试缺失 | P1 | done |
| R7 P1-3 事件链未验证 | P1 | done |
| R7 P2-1 destroy/reset 冗余 | P2 | done |
| R7 P2 Canvas 渲染测试 | P2 | done |
| I14 攻占结果结算与事件生成 | 待办 | done |
| I15 编队伤亡状态更新+自动回城 | 待办 | done |
| H4 伤亡集成到攻城流程 | 进行中 | done |

## 实施优先序

```
Phase 1 — R7 P0 紧急修复（必须，无功能依赖）
  Task 1 (P0, Trivial)  -> siegeBattleAnimSystem.destroy() cleanup 补充
  Task 2 (P0, Small)    -> defenseRatio 桥接代码

Phase 2 — R7 P1 集成测试（依赖 Phase 1 修复完成后验证）
  Task 3 (P1, Medium)   -> SiegeBattleSystem 与 AnimationSystem 集成测试

Phase 3 — R7 P2 修复 + Canvas 测试（独立，可与 Phase 4 并行）
  Task 4 (P2, Trivial)  -> destroy() 委托 reset()
  Task 5 (P2, Medium)   -> Canvas 渲染基础测试

Phase 4 — I14 攻占结果结算（新功能）
  Task 6 (P1, Medium)   -> SiegeResultCalculator 实现
  Task 7 (P1, Medium)   -> I14 集成到 battle:completed + 测试

Phase 5 — I15 编队伤亡+回城（依赖 Phase 4 产出）
  Task 8 (P1, Large)    -> 编队状态更新 + 自动回城行军
  Task 9 (P1, Medium)   -> I15 测试
```

---

*Round 8 计划 | 2026-05-04*
